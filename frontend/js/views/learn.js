import { store } from '../core/store.js';
import { startLoop } from '../core/loop.js';
import { $, f2, f3, pulse } from '../core/dom.js';
import { segmented } from '../core/ui.js';
import { lineChart } from '../core/chart.js';
import { decodeState } from '../game/env.js';
import { Learner, N_STATES } from '../game/learner.js';
import { WorldRenderer } from '../game/renderer.js';

const AN = ['do nothing', 'flap'];
const FORMULA = {
  q: 'Q(s,a) ← Q(s,a) + α [ r + γ · max<sub>a′</sub> Q(s′,a′) − Q(s,a) ]',
  s: 'Q(s,a) ← Q(s,a) + α [ r + γ · Q(s′,a′) − Q(s,a) ]',
  td: 'V(s) ← V(s) + α [ r + γ · V(s′) − V(s) ]',
};
const NOTE = {
  q: 'Q-Learning is off-policy: its target uses the best next action.',
  s: 'SARSA is on-policy: its target uses the action it actually chose next, a′.',
  td: 'TD(0) prediction does no control. The bird follows the trained Q-Learning policy (5% random) and we only learn V(s).',
};

export default {
  title: 'How it learns',
  mount(root) {
    const H = store.config.hyper, R = store.config.rewards;
    let algo = 'q', speed = 'slow', slowAcc = 0, shownLast = null;
    const make = (a) => new Learner(a, { hyper: H, policyQ: store.tables.q });
    let L = make(algo);

    root.innerHTML = `
    <header class="page-head"><h1>How the bird learns</h1><p class="muted">Every update below uses the real numbers from the running agent.</p></header>
    <div class="learn-grid">
      <div class="stage small"><canvas id="lc" aria-label="Learning agent playing"></canvas></div>
      <div class="learn-col">
        <div class="panel">
          <div id="lalgo"></div>
          <p id="lname" class="note"></p>
          <div class="formula" id="lform" aria-live="polite"></div>
          <div class="hp" id="lhp"></div>
        </div>
        <div class="panel">
          <div class="btn-row">
            <button class="btn btn-soft" id="lstep" type="button">Step (Space)</button>
            <div id="lspd"></div>
            <button class="btn btn-primary" id="lreset" type="button">Reset agent</button>
          </div>
          <div class="learn-stats" id="lst"></div>
          <canvas id="rc" class="chart" aria-label="Moving average reward per episode"></canvas>
          <p class="muted small">Moving-average reward per episode. It starts near −90 (crashing) and climbs as the table fills in.</p>
        </div>
        <div class="panel calc">
          <h2 class="panel-title">The latest update</h2>
          <ol class="steps" id="lcalc"></ol>
        </div>
        <div class="panel">
          <h2 class="panel-title">Ideas used</h2>
          <ul class="ideas">
            <li><b>ε-greedy.</b> With probability ε pick a random action (flap only ${H.flap_prob * 100}% of the time), otherwise the action with the larger Q.</li>
            <li><b>State.</b> Four binned numbers: height, velocity, dx to the pipe and dy to the gap, giving ${N_STATES.toLocaleString('en-US')} states.</li>
            <li><b>TD error.</b> δ = target − current estimate. The table moves α of the way toward the target.</li>
            <li><b>Crashes.</b> A crash is terminal, so its target is just r (${R.crash}). That penalty then spreads backwards, state by state.</li>
          </ul>
        </div>
      </div>
    </div>`;

    const view = new WorldRenderer($('#lc', root));
    const rc = $('#rc', root), calc = $('#lcalc', root), stats = $('#lst', root);

    const algoSeg = segmented($('#lalgo', root), [{ value: 'q', label: 'Q-Learning' }, { value: 's', label: 'SARSA' }, { value: 'td', label: 'TD Prediction' }], algo, (a) => { algo = a; reset(); });
    const speedSeg = segmented($('#lspd', root), [{ value: 'slow', label: 'Slow' }, { value: 'fast', label: 'Fast' }, { value: 'turbo', label: 'Turbo' }, { value: 'pause', label: 'Pause' }], speed, (s) => { speed = s; });

    function reset() { L = make(algo); shownLast = null; view.reset(); header(); }
    function header() {
      $('#lname', root).textContent = NOTE[algo];
      $('#lform', root).innerHTML = FORMULA[algo];
      $('#lhp', root).innerHTML = [`α = ${H.alpha}`, `γ = ${H.gamma}`, `ε ${H.eps_start} → ${H.eps_min} (× ${H.eps_decay} per episode)`, `+${R.pipe} per pipe`, `+${R.step} per step`, `${R.crash} for a crash`].map((t) => `<span>${t}</span>`).join('');
    }

    function stepOnce(fx) {
      const info = L.step();
      if (fx) {
        if (info.a) view.flap(L.env);
        if (L.env.scoredNow) view.scored(L.env);
        if (info.term) view.crashed(L.env);
      }
      return info;
    }

    function calcHTML() {
      const t = L.last;
      if (!t) return '<li class="empty">Press <b>Step</b> (or the Space bar) to see one learning update, or pick a speed.</li>';
      const td = algo === 'td', nm = td ? 'V' : 'Q', r = f2(t.r);
      const oldName = td ? 'V(s)' : `Q(s, ${AN[t.a]})`;
      let target;
      if (t.term) target = `Terminal (crash): there is no next state, so target = r = <b>${r}</b>`;
      else if (td) target = `target = r + γ·V(s′) = ${r} + ${H.gamma} × ${f3(t.nv)} = <b>${f3(t.target)}</b>`;
      else if (algo === 'q') target = `target = r + γ·max Q(s′,a′) = ${r} + ${H.gamma} × max(${f3(t.q0)}, ${f3(t.q1)}) = <b>${f3(t.target)}</b>`;
      else target = `target = r + γ·Q(s′,a′) = ${r} + ${H.gamma} × Q(s′, ${AN[t.a2]}) = ${r} + ${H.gamma} × ${f3(t.val)} = <b>${f3(t.target)}</b>`;
      const sb = decodeState(t.s).join(', '), nb = decodeState(t.s2).join(', ');
      return `<li><b>Observe.</b> state s = (${sb}) → ${td ? 'policy' : ''} action <b>${AN[t.a]}</b>${td ? '' : ` (${t.explored ? 'random: exploring' : 'greedy: best known'})`}<br>reward r = <b>${r}</b>, next state s′ = (${nb})</li>
        <li><b>Target.</b> ${target}</li>
        <li><b>TD error.</b> δ = target − ${oldName} = ${f3(t.target)} − ${f3(t.old)} = <b>${f3(t.delta)}</b></li>
        <li><b>Update.</b> ${nm}<sub>new</sub> = ${f3(t.old)} + α·δ = ${f3(t.old)} + ${H.alpha} × ${f3(t.delta)} = <b>${f3(t.updated)}</b></li>`;
    }

    function paint() {
      const e = L.env;
      stats.innerHTML = `<div><span>Episode</span><b>${L.ep}</b></div><div><span>Score</span><b>${e.score}</b></div><div><span>Best</span><b>${L.best}</b></div><div><span>ε</span><b>${f3(L.eps)}</b></div><div><span>Avg reward (50)</span><b>${L.avg.length ? f2(L.avg[L.avg.length - 1]) : '-'}</b></div><div><span>States seen</span><b>${L.seen.size.toLocaleString('en-US')}</b></div>`;
      if (L.last !== shownLast) { shownLast = L.last; calc.innerHTML = calcHTML(); if (L.last) pulse(calc, 'flash'); }
      lineChart(rc, L.avg.slice(-500));
    }

    $('#lstep', root).onclick = () => { stepOnce(true); };
    $('#lreset', root).onclick = reset;
    const onKey = (e) => { if (e.code === 'Space' && !e.target.matches('input, textarea, button')) { e.preventDefault(); stepOnce(true); } else if (e.key === 'Escape') location.hash = '#/'; };
    addEventListener('keydown', onKey);

    header();
    const stop = startLoop((acc) => {
      if (speed === 'fast') for (let i = 0; i < 60; i++) stepOnce(false);
      else if (speed === 'turbo') { const t0 = performance.now(); while (performance.now() - t0 < 12) stepOnce(false); }
      else if (speed === 'slow') { slowAcc += acc; while (slowAcc >= 2) { slowAcc -= 2; stepOnce(true); } }
      view.draw(L.env, acc, { paused: speed === 'pause' });
      paint();
    });
    return () => { stop(); removeEventListener('keydown', onKey); };
  },
};
