import { api } from './api/client.js';
import { store } from './core/store.js';
import { createRouter } from './core/router.js';
import { configure } from './game/env.js';
import { icon } from './core/ui.js';
import { $ } from './core/dom.js';
import home from './views/home.js';
import play from './views/play.js';
import learn from './views/learn.js';
import models from './views/models.js';
import leaderboard from './views/leaderboard.js';

/* ---------- theme ---------- */
const root = document.documentElement;
const preferred = () => store.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function applyTheme(t) {
  root.dataset.theme = t;
  const btn = $('#theme');
  btn.innerHTML = t === 'dark' ? icon.sun : icon.moon;
  btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}
$('#theme').addEventListener('click', () => { const t = root.dataset.theme === 'dark' ? 'light' : 'dark'; store.theme = t; applyTheme(t); });
applyTheme(preferred());

/* ---------- nav icons ---------- */
document.querySelectorAll('[data-icon]').forEach((a) => { a.insertAdjacentHTML('afterbegin', icon[a.dataset.icon]); });

/* ---------- API status pill ---------- */
const pill = $('#api-status');
async function ping() {
  try { await api.health(); pill.dataset.state = 'ok'; pill.querySelector('span').textContent = 'API online'; }
  catch { pill.dataset.state = 'down'; pill.querySelector('span').textContent = 'API offline'; }
}

/* ---------- boot ---------- */
const outlet = $('#outlet');

async function boot() {
  outlet.innerHTML = '<div class="splash"><div class="spinner"></div><p>Loading models from the server…</p></div>';
  try {
    const [config, list, q, s, v] = await Promise.all([api.config(), api.models(), api.model('q'), api.model('s'), api.model('v')]);
    store.config = config; store.models = list.models; store.comparisonNote = list.comparison_note;
    store.tables = { q: q.table, s: s.table, v: v.table };
    configure(config);
  } catch (err) {
    pill.dataset.state = 'down'; pill.querySelector('span').textContent = 'API offline';
    outlet.innerHTML = `<div class="splash error-box"><h1>Can’t reach the backend</h1><p>${err.message}</p><p class="muted">Start it with <code>python run.py</code>, then retry.</p><button class="btn btn-primary" id="retry" type="button">Retry</button></div>`;
    $('#retry').onclick = boot;
    return;
  }
  await ping();
  createRouter({ '/': home, '/play': play, '/learn': learn, '/models': models, '/leaderboard': leaderboard }, outlet).start();
}

setInterval(ping, 15000);
boot();
