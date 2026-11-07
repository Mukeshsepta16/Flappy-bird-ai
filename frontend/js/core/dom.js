export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Build an element from an HTML string. */
export function tpl(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
}

export const f2 = (v) => (+v).toFixed(2);
export const f3 = (v) => (+v).toFixed(3);
export const fmt = (n) => Number(n).toLocaleString('en-US');
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function timeAgo(ts) {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animate a number up to its target value. */
export function countTo(el, to, { duration = 800, decimals = 0, suffix = '' } = {}) {
  const fin = () => { el.textContent = Number(to).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix; };
  if (reduceMotion() || duration <= 0) return fin();
  const t0 = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / duration);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = (to * e).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if (k < 1) requestAnimationFrame(tick); else fin();
  };
  requestAnimationFrame(tick);
}

/** Re-trigger a CSS animation class on an element. */
export function pulse(el, cls = 'pop') {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
