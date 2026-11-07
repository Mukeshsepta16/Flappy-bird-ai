import { store, tableFor } from '../core/store.js';
import { startLoop } from '../core/loop.js';
import { $, $$, pulse, f2 } from '../core/dom.js';
import { segmented, setText } from '../core/ui.js';
import { toast } from '../core/toast.js';
import { api } from '../api/client.js';
import { GameController, MODES } from '../game/controller.js';

export default {
  title: 'Play',
  mount(root) {
    const modes = ['h', 'q', 's', 'c'].concat(store.custom ? ['x'] : []);
    let mode = modes.includes(store.playMode) ? store.playMode : 'q';

    root.innerHTML = `
    <header class="page-head"><h1>Let’s play</h1><p class="muted">Fly it yourself, or watch a trained agent take over.</p></header>
    <div class="play-grid">
      <div class="stage" id="stage">
        <canvas id="gc" aria-label="Flappy Bird game"></canvas>
        <div class="overlay" id="over" hidden>
          <div class="over-card">
            <h2>Game over</h2>
            <p class="muted" id="over-why"></p>
            <div class="over-score"><b id="o-score">0</b><span>points</span></div>
            <button class="btn btn-primary" id="o-again" type="button">Play again</button>
            <div class="restart" id="restart"><span>Restarting</span><div class="track"><i id="rbar"></i></div></div>
          </div>
        </div>
        <div class="stage-hint" id="hint">Press Space or tap to flap</div>
      </div>

      <aside class="side">
        <div class="panel">
          <h2 class="panel-title">Who flies?</h2>
          <div id="modes" class="seg-wrap"></div>
        </div>
        <div class="panel">
          <div class="stat-trio">
            <div class="stat"><span>Score</span><b id="sc">0</b></div>
            <div class="stat"><span>Best</span><b id="bs">0</b></div>
            <div class="stat"><span>Games</span><b id="gm">0</b></div>
          </div>
        </div>
        <div class="panel decision" id="decision">
          <h2 class="panel-title">What the agent sees</h2>
          <div class="action-row"><span class="muted">Action</span><strong id="act" class="act">-</strong></div>
          <div class="qrow"><span id="qa">Q(do nothing)</span><div class="qbar"><i id="b0"></i></div><em id="qav">0</em></div>
          <div class="qrow"><span id="qb">Q(flap)</span><div class="qbar"><i id="b1"></i></div><em id="qbv">0</em></div>
          <p class="muted small" id="vs"></p>
          <p class="mono small muted" id="raw"></p>
        </div>
        <div class="panel">
          <div class="btn-row">
            <button class="btn btn-soft" id="pause" type="button">Pause</button>
            <button class="btn btn-soft" id="rs" type="button">Restart</button>
            <button class="btn btn-soft" id="sp" type="button" title="Simulation speed">Speed ×1</button>
          </div>
          <label class="field"><span>Name for the leaderboard</span><input id="pname" maxlength="16" autocomplete="nickname" placeholder="Anonymous"></label>
          <p class="muted small">Space or tap flaps in Self Play and Co-pilot. Co-pilot adds your flap to the Q-Learning agent’s choice. Agents play greedily, with no exploration.</p>
        </div>
      </aside>
    </div>`;

    const seg = segmented($('#modes', root), modes.map((m) => ({ value: m, label: MODES[m] })), mode, (m) => { mode = m; store.playMode = m; game.setMode(m); syncMode(); });
    $('#pname', root).value = store.name;
    $('#pname', root).addEventListener('input', (e) => { store.name = e.target.value.trim(); });

    const el = Object.fromEntries(['sc', 'bs', 'gm', 'act', 'qa', 'qb', 'qav', 'qbv', 'b0', 'b1', 'vs', 'raw', 'over', 'over-why', 'o-score', 'o-again', 'rbar', 'restart', 'hint', 'pause', 'rs', 'sp'].map((id) => [id, $('#' + id, root)]));

    const game = new GameController($('#gc', root), {
      onScore: () => pulse(el.sc),
      onRestart: () => { el.over.hidden = true; },
      onGameOver: (env, m) => {
        pulse(el.gm); pulse(el.bs);
        el['o-score'].textContent = env.score;
        el['over-why'].textContent = `Crashed into the ${env.why}.`;
        submit(m, env.score);
      },
    });

    async function submit(m, score) {
      if (m === 'x' || score <= 0 || score <= (store.submittedBest[m] || 0)) return;
      store.submittedBest[m] = score;
      try {
        const r = await api.submitScore(store.name || 'Anonymous', m, score);
        toast(`Saved to the leaderboard: rank #${r.rank} in ${MODES[m]}`, 'success');
      } catch (err) { toast(`Could not save the score. ${err.message}`, 'error'); }
    }

    function syncMode() {
      const human = game.human;
      $('#decision', root).classList.toggle('dim', mode === 'h');
      el.hint.hidden = !human;
      el['o-again'].hidden = !human;
      el.restart.hidden = human;
      el.pause.textContent = 'Pause';
      if (game.mode !== mode) game.setMode(mode);
    }

    el['o-again'].onclick = () => game.press();
    el.pause.onclick = () => { el.pause.textContent = game.togglePause() ? 'Resume' : 'Pause'; };
    el.rs.onclick = () => game.restart();
    el.sp.onclick = () => { el.sp.textContent = `Speed ×${game.cycleSpeed()}`; };
    $('#gc', root).addEventListener('pointerdown', () => { game.press(); el.hint.classList.add('gone'); });

    const onKey = (e) => {
      if (e.target.matches('input, textarea')) return;
      if (e.code === 'Space') { e.preventDefault(); game.press(); el.hint.classList.add('gone'); }
      else if (e.key === 'p' || e.key === 'P') el.pause.click();
      else if (e.key === 'Escape') location.hash = '#/';
    };
    addEventListener('keydown', onKey);

    game.setMode(mode); syncMode();
    store.playMode = mode;

    const stop = startLoop((acc) => {
      game.tick(acc);
      const e = game.env;
      setText(el.sc, e.score); setText(el.bs, game.best); setText(el.gm, game.games);
      el.over.hidden = !(e.over && game.human);
      el.rbar.style.width = `${game.restartProgress * 100}%`;
      el.restart.classList.toggle('on', e.over && !game.human);
      const f = e.features();
      setText(el.raw, `height ${f[0].toFixed(0)}  velocity ${f[1].toFixed(1)}  dx ${f[2].toFixed(0)}  dy ${f[3].toFixed(0)}`);
      if (mode === 'h') { setText(el.act, 'You fly'); el.act.dataset.a = ''; el.b0.style.width = el.b1.style.width = '0%'; setText(el.qav, '-'); setText(el.qbv, '-'); setText(el.vs, ''); return; }
      const tbl = tableFor(mode), q = tbl[e.stateIndex()], mx = Math.max(1, Math.abs(q[0]), Math.abs(q[1]));
      [0, 1].forEach((k) => {
        const w = (Math.abs(q[k]) / mx) * 50, bar = el['b' + k];
        bar.style.width = `${w}%`; bar.style.left = `${q[k] >= 0 ? 50 : 50 - w}%`; bar.dataset.neg = q[k] < 0;
      });
      setText(el.qav, q[0]); setText(el.qbv, q[1]);
      const shown = mode === 'c' ? game.action : (q[1] > q[0] ? 1 : 0);
      setText(el.act, shown ? 'Flap' : 'Do nothing'); el.act.dataset.a = shown;
      setText(el.vs, `TD value V(s) = ${store.tables.v[e.stateIndex()]}  (low means a crash is near)`);
    });

    return () => { stop(); removeEventListener('keydown', onKey); };
  },
};
