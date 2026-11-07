/** Tiny shared state container. */
const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export const store = {
  config: null,
  models: [],            // metadata from /api/models
  comparisonNote: '',
  tables: {},            // { q:[[a,b]..], s:[[a,b]..], v:[..] }
  custom: null,          // { algo, table, label } from server-side training
  playMode: 'q',         // mode the Play view opens with
  submittedBest: {},     // best score already sent per mode (this session)
  get name() { return read('fbai.name', ''); },
  set name(v) { write('fbai.name', v); },
  get theme() { return read('fbai.theme', ''); },
  set theme(v) { write('fbai.theme', v); },
};

/** Q-table used by a play mode (null for human-only modes). */
export function tableFor(mode) {
  if (mode === 'c') return store.tables.q;
  if (mode === 'x') return store.custom ? store.custom.table : null;
  return store.tables[mode] || null;
}
