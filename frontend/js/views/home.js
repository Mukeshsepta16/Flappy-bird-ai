import { store } from '../core/store.js';
import { startLoop } from '../core/loop.js';
import { countTo, fmt } from '../core/dom.js';
import { GameController } from '../game/controller.js';

export default {
  title: '',
  mount(root) {
    const models = store.models;
    root.innerHTML = `
    <div class="hero">
      <div class="hero-copy">
        <h1 class="logo" aria-label="Flappy Bird AI">
          <span class="logo-line" aria-hidden="true">${[...'Flappy'].map((c, i) => `<i style="--i:${i}">${c}</i>`).join('')}</span>
          <span class="logo-line l2" aria-hidden="true">${[...'Bird'].map((c, i) => `<i style="--i:${i + 6}">${c}</i>`).join('')}<b class="logo-ai">AI</b></span>
        </h1>
        <p class="lead">A bird that teaches itself to fly. Follow a table of ${fmt(store.config.n_states * 2)} numbers as it learns from crashes, using Q-Learning, SARSA and TD prediction.</p>
        <div class="cta">
          <a class="btn btn-primary btn-lg" href="#/play">Play now</a>
          <a class="btn btn-ghost btn-lg" href="#/learn">See how it learns</a>
        </div>
      </div>
      <div class="hero-demo">
        <div class="device">
          <canvas id="hero-canvas" aria-label="A trained agent playing Flappy Bird live"></canvas>
          <span class="chip live"><i></i>Live: SARSA agent</span>
        </div>
      </div>
    </div>

    <h2 class="section-title">Trained agents</h2>
    <div class="model-cards">
      ${models.map((m) => `
        <a class="panel model-card" href="#/models" data-model="${m.id}">
          <div class="mc-head"><h3>${m.name}</h3><span class="badge">${m.playable ? 'Plays the game' : 'Value estimator'}</span></div>
          <p class="muted">${m.type}</p>
          <dl class="mc-stats">
            <div><dt>Episodes</dt><dd data-count="${m.stats.episodes}">0</dd></div>
            <div><dt>${m.stats.eval_score != null ? 'Avg score' : 'Success rate'}</dt><dd data-count="${m.stats.eval_score ?? m.stats.success_rate}" data-dec="1">0</dd></div>
          </dl>
        </a>`).join('')}
    </div>

    <h2 class="section-title">How it fits together</h2>
    <div class="arch">
      <div class="panel arch-node"><h3>Frontend</h3><p class="muted">Canvas game, live learning view and model inspector. Plain ES modules, no build step.</p><code>frontend/</code></div>
      <div class="arch-link" aria-hidden="true"><span>JSON</span></div>
      <div class="panel arch-node"><h3>Flask API</h3><p class="muted">Serves tables, answers predictions, trains agents and stores the leaderboard.</p><code>backend/</code></div>
      <div class="arch-link" aria-hidden="true"><span>import</span></div>
      <div class="panel arch-node"><h3>Model</h3><p class="muted">Environment, agents, trainer and the saved Q-tables.</p><code>model/</code></div>
    </div>`;

    root.querySelectorAll('[data-count]').forEach((el, i) => setTimeout(() => countTo(el, +el.dataset.count, { decimals: +(el.dataset.dec || 0), duration: 900 }), 250 + i * 70));

    const game = new GameController(root.querySelector('#hero-canvas'), { seed: 7 });
    game.setMode('s'); game.mult = 1;
    const stop = startLoop((acc) => game.tick(acc));
    return () => stop();
  },
};
