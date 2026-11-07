import { store } from '../core/store.js';
import { $, $$, f2, countTo } from '../core/dom.js';
import { segmented } from '../core/ui.js';
import { fit, cssVar, lineChart } from '../core/chart.js';
import { toast } from '../core/toast.js';
import { api } from '../api/client.js';

const XL = ['<-40', '-40', '-15', '5', '25', '45', '70', '100', '140', '200+'];
const YL = ['<-100', '-100', '-60', '-35', '-20', '-10', '0', '10', '20', '35', '60', '100+'];
const NAMES = { q: 'Q-Learning', s: 'SARSA', v: 'TD Prediction' };

export default {
  title: 'Models',
  mount(root) {
    let mm = 'q', hover = null;
    const metaOf = (id) => store.models.find((m) => m.id === id);

    root.innerHTML = `
    <header class="page-head"><h1>Check the models</h1><p class="muted">Inspect what each agent learned, query it through the API, or train a new one on the server.</p></header>
    <div class="models-grid">
      <section class="panel span-2">
        <div class="head-row"><div id="mtabs"></div><button class="btn btn-primary" id="mplay" type="button">Watch it play</button></div>
        <p class="muted" id="mt"></p>
        <dl class="metrics" id="mtab"></dl>
        <p class="muted small">${store.comparisonNote} Trained in Python with the <code>model/</code> package.</p>
      </section>

      <section class="panel">
        <h2 class="panel-title">What the table says</h2>
        <p class="muted small">Each cell is one binned state (dx across, dy down; the gap above the bird is at the top). <b>Flap</b> means Q(flap) is higher, <b>wait</b> means doing nothing is higher, grey was never visited. For TD Prediction the colour is V(s): red is about to crash, green is safe.</p>
        <div class="heat-wrap"><canvas id="hm" aria-label="Policy heat map"></canvas><div class="tip" id="tip" hidden></div></div>
        <div class="sliders">
          <label>Height <input type="range" id="yb" min="0" max="5" value="2"> <small id="ybl"></small></label>
          <label>Velocity <input type="range" id="vb" min="0" max="7" value="3"> <small id="vbl"></small></label>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-title">Ask the model through the API</h2>
        <p class="muted small">Every change sends <code>POST /api/predict</code> to the backend, which bins the numbers and reads the table.</p>
        <div id="pmodel"></div>
        <div class="sliders col-sliders">
          ${[['height', 'Height', 0, 520, 1, 250], ['velocity', 'Velocity', -10, 10, .5, 0], ['dx', 'Distance to pipe', -60, 300, 1, 80], ['dy', 'Gap above bird', -150, 150, 1, -20]].map(([k, l, a, b, s, v]) => `<label><span>${l}</span><input type="range" data-k="${k}" min="${a}" max="${b}" step="${s}" value="${v}"><output data-o="${k}">${v}</output></label>`).join('')}
        </div>
        <div class="predict" id="pres"><span class="muted">Waiting for the server…</span></div>
      </section>

      <section class="panel span-2">
        <h2 class="panel-title">Train a new agent on the server</h2>
        <p class="muted small">Runs the Python trainer from <code>model/</code>. Limits: ${store.config.train_limits.min_episodes}–${store.config.train_limits.max_episodes.toLocaleString('en-US')} episodes, ${store.config.train_limits.time_budget_s} s.</p>
        <div class="train-form">
          <div id="talgo"></div>
          <label class="field inline"><span>Episodes <output id="eo">3000</output></span><input type="range" id="eps" min="100" max="${store.config.train_limits.max_episodes}" step="100" value="3000"></label>
          <label class="field inline"><span>Seed</span><input type="number" id="seed" min="0" max="99999" value="1"></label>
          <button class="btn btn-primary" id="train" type="button">Start training</button>
        </div>
        <div class="progress" id="prog" hidden><i></i><span>Training on the server, please wait…</span></div>
        <div id="tres" class="train-result" hidden></div>
      </section>
    </div>`;

    /* ---------- metrics tabs ---------- */
    const tabs = segmented($('#mtabs', root), store.models.map((m) => ({ value: m.id, label: m.name })), mm, (id) => { mm = id; draw(); });
    function renderMetrics() {
      const m = metaOf(mm);
      $('#mt', root).textContent = m.type;
      $('#mtab', root).innerHTML = m.results.map((r) => `<div><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`).join('');
      const b = $('#mplay', root);
      b.hidden = !m.playable;
      b.textContent = `Watch ${m.name} play`;
    }
    $('#mplay', root).onclick = () => { store.playMode = mm; location.hash = '#/play'; };

    /* ---------- heat map ---------- */
    const hm = $('#hm', root), tip = $('#tip', root);
    const LW = 600, LH = 340;
    function cellIndex(c, r) { const yb = +$('#yb', root).value, vb = +$('#vb', root).value; return ((yb * 8 + vb) * 10 + c) * 12 + r; }
    function draw() {
      tabs.set(mm); renderMetrics();
      const yb = +$('#yb', root).value, vb = +$('#vb', root).value;
      $('#ybl', root).textContent = `bin ${yb}`; $('#vbl', root).textContent = `bin ${vb}`;
      const { ctx, w } = fit(hm), k = w / LW;
      ctx.save(); ctx.scale(k, k); ctx.clearRect(0, 0, LW, LH);
      ctx.font = '11px Manrope, system-ui, sans-serif';
      const empty = cssVar('--cell-empty') || '#cfcfc4', ink = cssVar('--ink') || '#222';
      for (let c = 0; c < 10; c++) for (let r = 0; r < 12; r++) {
        const i = cellIndex(c, r), X = 70 + c * 52, Y = 8 + r * 24;
        let col, txt = '';
        if (mm === 'v') { const v = store.tables.v[i]; col = v === 0 ? empty : `hsl(${Math.max(0, Math.min(120, (v + 100) / 115 * 120))},65%,50%)`; txt = v === 0 ? '' : v.toFixed(0); }
        else { const q = store.tables[mm][i], df = q[1] - q[0]; if (q[0] === 0 && q[1] === 0) col = empty; else { const a = .3 + .7 * Math.min(1, Math.abs(df) / 10); col = df > 0 ? `rgba(47,174,94,${a})` : `rgba(61,123,255,${a})`; txt = df > 0 ? 'flap' : 'wait'; } }
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(X, Y, 50, 22, 4); ctx.fill();
        ctx.fillStyle = '#10202a'; ctx.textAlign = 'center'; ctx.fillText(txt, X + 25, Y + 15);
        if (hover && hover.c === c && hover.r === r) { ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(X, Y, 50, 22, 4); ctx.stroke(); }
      }
      ctx.fillStyle = ink; ctx.textAlign = 'right'; YL.forEach((l, r) => ctx.fillText(l, 64, 23 + r * 24));
      ctx.textAlign = 'center'; XL.forEach((l, c) => ctx.fillText(l, 95 + c * 52, 308));
      ctx.fillText('dx: distance to the next pipe (px)', 330, 328);
      ctx.restore();
    }
    hm.addEventListener('pointermove', (e) => {
      const rect = hm.getBoundingClientRect(), k = LW / rect.width, x = (e.clientX - rect.left) * k, y = (e.clientY - rect.top) * k;
      const c = Math.floor((x - 70) / 52), r = Math.floor((y - 8) / 24);
      if (c < 0 || c > 9 || r < 0 || r > 11) return leave();
      if (hover && hover.c === c && hover.r === r) { place(e, rect); return; }
      hover = { c, r }; draw();
      const i = cellIndex(c, r);
      tip.textContent = mm === 'v' ? `V(s) = ${store.tables.v[i]}` : `Q(nothing) = ${store.tables[mm][i][0]}   Q(flap) = ${store.tables[mm][i][1]}`;
      tip.hidden = false; place(e, rect);
    });
    const place = (e, rect) => { tip.style.left = `${e.clientX - rect.left + 12}px`; tip.style.top = `${e.clientY - rect.top + 12}px`; };
    const leave = () => { if (hover) { hover = null; draw(); } tip.hidden = true; };
    hm.addEventListener('pointerleave', leave);
    $('#yb', root).oninput = $('#vb', root).oninput = draw;
    const onResize = () => draw(); addEventListener('resize', onResize);

    /* ---------- predict playground ---------- */
    let pm = 'q', ctl = null, timer = 0;
    segmented($('#pmodel', root), [{ value: 'q', label: 'Q-Learning' }, { value: 's', label: 'SARSA' }], pm, (v) => { pm = v; ask(); });
    $$('input[data-k]', root).forEach((i) => i.addEventListener('input', () => { $(`[data-o="${i.dataset.k}"]`, root).textContent = i.value; clearTimeout(timer); timer = setTimeout(ask, 120); }));
    async function ask() {
      ctl?.abort(); ctl = new AbortController();
      const f = {}; $$('input[data-k]', root).forEach((i) => { f[i.dataset.k] = +i.value; });
      try {
        const r = await api.predict(pm, f, ctl.signal);
        const mx = Math.max(1, Math.abs(r.q_values[0]), Math.abs(r.q_values[1]));
        const bar = (v) => { const w = Math.abs(v) / mx * 50; return `<div class="qbar"><i data-neg="${v < 0}" style="width:${w}%;left:${v >= 0 ? 50 : 50 - w}%"></i></div>`; };
        $('#pres', root).innerHTML = `
          <div class="action-row"><span class="muted">Server says</span><strong class="act" data-a="${r.action}">${r.action_name}</strong></div>
          <div class="qrow"><span>Q(do nothing)</span>${bar(r.q_values[0])}<em>${r.q_values[0]}</em></div>
          <div class="qrow"><span>Q(flap)</span>${bar(r.q_values[1])}<em>${r.q_values[1]}</em></div>
          <p class="muted small">State #${r.state_index} · bins h${r.bins.height} v${r.bins.velocity} dx${r.bins.dx} dy${r.bins.dy} · V(s) = ${r.state_value}${r.visited ? '' : ' · never visited in training'}</p>`;
      } catch (err) { if (err.name !== 'AbortError') $('#pres', root).innerHTML = `<span class="error">${err.message}</span>`; }
    }

    /* ---------- server training ---------- */
    let talgo = 'q';
    segmented($('#talgo', root), [{ value: 'q', label: 'Q-Learning' }, { value: 's', label: 'SARSA' }, { value: 'v', label: 'TD Prediction' }], talgo, (v) => { talgo = v; });
    $('#eps', root).oninput = (e) => { $('#eo', root).textContent = (+e.target.value).toLocaleString('en-US'); };
    $('#train', root).onclick = async () => {
      const btn = $('#train', root), prog = $('#prog', root), res = $('#tres', root);
      btn.disabled = true; btn.textContent = 'Training…'; prog.hidden = false; res.hidden = true;
      try {
        const r = await api.train(talgo, +$('#eps', root).value, +$('#seed', root).value || 0);
        const ev = r.evaluation;
        res.innerHTML = `
          <dl class="metrics">
            <div><dt>Episodes</dt><dd>${r.episodes.toLocaleString('en-US')}${r.stopped_early ? ' (time limit)' : ''}</dd></div>
            <div><dt>Time</dt><dd>${r.seconds} s</dd></div>
            <div><dt>Best training score</dt><dd>${r.best_score}</dd></div>
            <div><dt>States seen</dt><dd>${r.states_seen.toLocaleString('en-US')}</dd></div>
            ${ev ? `<div><dt>Greedy eval (${ev.games} games)</dt><dd>${ev.mean_score} avg · best ${ev.best_score}</dd></div>` : ''}
          </dl>
          <canvas class="chart" id="tc" aria-label="Training reward curve"></canvas>
          <div class="btn-row">${talgo !== 'v' ? '<button class="btn btn-primary" id="twatch" type="button">Watch this agent play</button>' : ''}</div>`;
        res.hidden = false;
        lineChart($('#tc', root), r.curve);
        const w = $('#twatch', root);
        if (w) w.onclick = () => { store.custom = { algo: talgo, table: r.table, label: `${NAMES[talgo]} (${r.episodes} eps)` }; store.playMode = 'x'; location.hash = '#/play'; };
        toast('Training finished', 'success');
      } catch (err) { toast(err.message, 'error', 5000); }
      finally { btn.disabled = false; btn.textContent = 'Start training'; prog.hidden = true; }
    };

    draw(); ask();
    return () => { removeEventListener('resize', onResize); ctl?.abort(); clearTimeout(timer); };
  },
};
