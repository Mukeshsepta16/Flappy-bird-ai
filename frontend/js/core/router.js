/** Minimal hash router: '#/play' -> routes['/play'].mount(root) -> cleanup fn. */
import { $$ } from './dom.js';

export function createRouter(routes, outlet) {
  let cleanup = null, token = 0;

  async function render() {
    const path = (location.hash.replace(/^#/, '') || '/').split('?')[0];
    const route = routes[path] || routes['/'];
    const my = ++token;
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }

    $$('[data-route]').forEach((a) => {
      const on = a.dataset.route === (routes[path] ? path : '/');
      a.classList.toggle('active', on);
      on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
    });
    document.title = route.title ? `${route.title} · Flappy Bird AI` : 'Flappy Bird AI';

    const view = document.createElement('section');
    view.className = 'view';
    outlet.replaceChildren(view);
    window.scrollTo(0, 0);
    const result = await route.mount(view);
    if (my !== token) { if (typeof result === 'function') result(); return; }
    cleanup = typeof result === 'function' ? result : null;
    const h1 = view.querySelector('h1');
    if (h1) { h1.tabIndex = -1; }
  }

  addEventListener('hashchange', render);
  return { start: render, go: (p) => { location.hash = '#' + p; } };
}
