import { $, timeAgo, countTo } from '../core/dom.js';
import { segmented } from '../core/ui.js';
import { api } from '../api/client.js';
import { MODES } from '../game/controller.js';

export default {
  title: 'Leaderboard',
  mount(root) {
    let mode = '', alive = true;
    root.innerHTML = `
    <header class="page-head"><h1>Leaderboard</h1><p class="muted" id="sum">Best runs saved by the backend.</p></header>
    <section class="panel board">
      <div class="head-row"><div id="mtabs"></div><button class="btn btn-soft" id="refresh" type="button">Refresh</button></div>
      <ol class="rows" id="rows"></ol>
    </section>`;

    segmented($('#mtabs', root), [{ value: '', label: 'All modes' }, ...['h', 'q', 's', 'c'].map((m) => ({ value: m, label: MODES[m] }))], mode, (m) => { mode = m; load(); });
    $('#refresh', root).onclick = load;

    async function load() {
      const rows = $('#rows', root);
      rows.innerHTML = Array.from({ length: 5 }, () => '<li class="row skeleton"><span></span></li>').join('');
      try {
        const data = await api.scores(mode, 10);
        if (!alive) return;
        $('#sum', root).textContent = data.total_games ? `${data.total_games.toLocaleString('en-US')} runs saved. Highest score ever: ${data.best}.` : 'No runs saved yet.';
        if (!data.scores.length) { rows.innerHTML = '<li class="empty">No scores here yet. <a href="#/play">Play a round</a> and be the first.</li>'; return; }
        const top = data.scores[0].score || 1;
        rows.replaceChildren(...data.scores.map((s, i) => {
          const li = document.createElement('li');
          li.className = 'row'; li.style.setProperty('--d', `${i * 45}ms`);
          const rank = document.createElement('span'); rank.className = `rank r${i + 1}`; rank.textContent = i + 1;
          const who = document.createElement('div'); who.className = 'who';
          const name = document.createElement('b'); name.textContent = s.name;
          const meta = document.createElement('small'); meta.textContent = `${MODES[s.mode]} · ${timeAgo(s.ts)}`;
          who.append(name, meta);
          const bar = document.createElement('div'); bar.className = 'meter'; const fill = document.createElement('i');
          bar.append(fill); requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = `${(s.score / top) * 100}%`; }));
          const score = document.createElement('strong'); score.textContent = s.score;
          li.append(rank, who, bar, score);
          return li;
        }));
      } catch (err) { if (alive) rows.innerHTML = `<li class="empty error">${err.message}</li>`; }
    }
    load();
    return () => { alive = false; };
  },
};
