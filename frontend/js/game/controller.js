/**
 * Owns one Env + renderer and advances them with a fixed 60 Hz step.
 * Used by the Play view, the Learn view's mini-game and the home-page hero.
 */
import { Env } from './env.js';
import { WorldRenderer } from './renderer.js';
import { tableFor, store } from '../core/store.js';

export const MODES = { h: 'Self Play', q: 'Q-Learning', s: 'SARSA', c: 'Co-pilot', x: 'My trained agent' };
const RESTART_FRAMES = 70;

export class GameController {
  /** @param {{onGameOver?:Function, onScore?:Function, seed?:number}} hooks */
  constructor(canvas, hooks = {}) {
    this.view = new WorldRenderer(canvas);
    this.hooks = hooks;
    this.env = new Env(hooks.seed ?? (Date.now() & 0xffff));
    this.mode = 'q'; this.paused = false; this.mult = 1;
    this.best = 0; this.games = 0; this.action = 0; this.flapQueued = false;
    this.overT = 0; this.stepAcc = 0;
  }

  get human() { return this.mode === 'h' || this.mode === 'c'; }
  get restartProgress() { return this.env.over && !this.human ? Math.min(1, this.overT / RESTART_FRAMES) : 0; }
  get table() { return tableFor(this.mode); }

  setMode(m) { this.mode = m; this.best = this.games = 0; this.paused = false; this.restart(); }
  restart() { this.env.reset(); this.view.reset(); this.overT = 0; this.stepAcc = 0; this.flapQueued = false; this.hooks.onRestart?.(); }
  togglePause() { this.paused = !this.paused; return this.paused; }
  cycleSpeed() { this.mult = this.mult >= 8 ? 1 : this.mult * 2; return this.mult; }

  /** Human input (Space / tap). */
  press() {
    if (!this.human) return;
    if (this.env.over) this.restart(); else this.flapQueued = true;
  }

  /** Decide an action for the current state. */
  decide() {
    const e = this.env;
    if (this.mode === 'h') { const a = this.flapQueued ? 1 : 0; this.flapQueued = false; return a; }
    const q = this.table[e.stateIndex()];
    let a = q[1] > q[0] ? 1 : 0;
    if (this.mode === 'c' && this.flapQueued) { a = 1; this.flapQueued = false; }
    return a;
  }

  /** Advance simulation by `acc` frames and draw. */
  tick(acc) {
    const e = this.env;
    if (!this.paused) {
      if (e.over) {
        if (!this.human) { this.overT += acc; if (this.overT > RESTART_FRAMES) this.restart(); }
      } else {
        this.stepAcc += acc * (this.human ? 1 : this.mult);
        while (this.stepAcc >= 1 && !e.over) {
          this.stepAcc -= 1;
          this.action = this.decide();
          if (this.action) this.view.flap(e);
          e.step(this.action);
          if (e.scoredNow) { this.view.scored(e); this.hooks.onScore?.(e.score); }
          if (e.over) {
            this.games++; this.best = Math.max(this.best, e.score); this.overT = 0;
            if (e.crash) this.view.crashed(e);
            this.hooks.onGameOver?.(e, this.mode);
          }
        }
      }
    }
    this.view.draw(e, acc, { paused: this.paused });
  }
}
