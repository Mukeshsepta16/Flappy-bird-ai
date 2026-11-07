/** Tabular TD learner that runs one transition at a time so the UI can show every update. */
import { Env } from './env.js';

export const N_STATES = 5760;

export class Learner {
  /**
   * @param {'q'|'s'|'td'} algo
   * @param {{hyper:object, policyQ:number[][]}} opts  policyQ = trained Q-table the TD agent follows
   */
  constructor(algo, { hyper, policyQ }) {
    this.algo = algo;
    this.H = hyper;
    this.policyQ = policyQ;
    this.Q = new Float64Array(N_STATES * 2);
    this.V = new Float64Array(N_STATES);
    this.eps = algo === 'td' ? hyper.td_eps : hyper.eps_start;
    this.ep = 0; this.best = 0;
    this.env = new Env(Date.now() & 0xffff, hyper.max_steps);
    this.s = null; this.a = 0; this.explored = false;
    this.rsum = 0; this.recent = []; this.avg = []; this.last = null;
    this.seen = new Set();
  }

  #random() { return Math.random() < this.H.flap_prob ? 1 : 0; }
  #pick(s) {
    if (Math.random() < this.eps) { this.explored = true; return this.#random(); }
    this.explored = false;
    return this.Q[2 * s + 1] > this.Q[2 * s] ? 1 : 0;
  }
  #tdPick(s) {
    if (Math.random() < this.H.td_eps) { this.explored = true; return this.#random(); }
    this.explored = false;
    const q = this.policyQ[s];
    return q[1] > q[0] ? 1 : 0;
  }
  #choose(s) { return this.algo === 'td' ? this.#tdPick(s) : this.#pick(s); }

  /** One environment step + one learning update. Returns the details of that update. */
  step() {
    const { env, H } = this;
    if (this.s === null) { this.s = env.stateIndex(); this.a = this.#choose(this.s); }
    const s = this.s, a = this.a, explored = this.explored;
    const r = env.step(a), s2 = env.stateIndex(), term = env.crash;
    const info = { s, a, r, s2, term, explored };
    this.rsum += r; this.seen.add(s);
    const a2 = this.#choose(s2);

    if (this.algo === 'td') {
      const nv = this.V[s2], target = term ? r : r + H.gamma * nv, old = this.V[s], delta = target - old;
      this.V[s] = old + H.alpha * delta;
      Object.assign(info, { old, target, delta, updated: this.V[s], nv });
    } else {
      const q0 = this.Q[2 * s2], q1 = this.Q[2 * s2 + 1];
      const val = this.algo === 'q' ? Math.max(q0, q1) : this.Q[2 * s2 + a2];
      const target = term ? r : r + H.gamma * val, old = this.Q[2 * s + a], delta = target - old;
      this.Q[2 * s + a] = old + H.alpha * delta;
      Object.assign(info, { old, target, delta, updated: this.Q[2 * s + a], q0, q1, a2, val });
    }
    this.last = info;

    if (env.over) {
      this.ep++;
      this.recent.push(this.rsum); if (this.recent.length > 50) this.recent.shift();
      this.avg.push(this.recent.reduce((x, y) => x + y, 0) / this.recent.length);
      if (this.avg.length > 600) this.avg.shift();
      this.best = Math.max(this.best, env.score);
      if (this.algo !== 'td') this.eps = Math.max(H.eps_min, this.eps * H.eps_decay);
      this.rsum = 0; env.reset(); this.s = null;
      info.episodeEnded = true;
    } else { this.s = s2; this.a = a2; }
    return info;
  }
}
