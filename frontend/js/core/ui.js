/** Shared UI builders. */

/** Segmented button group. items: [{value,label}] */
export function segmented(el, items, value, onChange) {
  el.classList.add('seg');
  el.setAttribute('role', 'group');
  el.innerHTML = items.map((i) => `<button type="button" class="seg-btn" data-v="${i.value}" aria-pressed="false">${i.label}</button>`).join('');
  const set = (v) => {
    value = v;
    el.querySelectorAll('.seg-btn').forEach((b) => { const on = b.dataset.v === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (!b || b.dataset.v === value) return;
    set(b.dataset.v); onChange?.(b.dataset.v);
  });
  set(value);
  return { set, get value() { return value; } };
}

export const setText = (el, v) => { const s = String(v); if (el.textContent !== s) el.textContent = s; };

export const icon = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  learn: '<svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3z"/><path d="M9.5 20.5h5"/></svg>',
  models: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 4v16M15 4v16M4 9h16M4 15h16"/></svg>',
  trophy: '<svg viewBox="0 0 24 24"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>',
};
