/**
 * Browser port of the Flappy Bird environment (see model/environment.py).
 * Physics and bins are NOT hard-coded: call configure() with the payload of
 * GET /api/config so Python and JS always simulate the same world.
 */
let C = null; // physics
let B = null; // bins
let W = 400;
let R = null; // rewards

export function configure(cfg) {
  C = cfg.physics;
  B = cfg.bins;
  W = cfg.world.width;
  R = cfg.rewards;
}
export const physics = () => C;

const bis = (arr, v) => { let i = 0; while (i < arr.length && arr[i] <= v) i++; return i; };

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function encodeState(h, v, dx, dy) {
  return ((bis(B.height, h) * 8 + bis(B.velocity, v)) * 10 + bis(B.dx, dx)) * 12 + bis(B.dy, dy);
}
export const decodeState = (i) => [(i / 960) | 0, ((i / 120) | 0) % 8, ((i / 12) | 0) % 10, i % 12];

export class Env {
  constructor(seed, maxSteps = 0) {
    this.rnd = mulberry32(seed);
    this.max = maxSteps;
    this.reset();
  }
  gap() { return Math.max(C.GMIN, C.GS - this.score); }
  spawn(x) {
    const g = this.gap(), lo = C.GM + g / 2, hi = C.GY - C.GM - g / 2;
    this.pipes.push({ x, c: lo + this.rnd() * (hi - lo), g, done: false });
  }
  fill() { while (this.pipes[this.pipes.length - 1].x < W) this.spawn(this.pipes[this.pipes.length - 1].x + C.SP); }
  reset() {
    this.y = 250; this.v = 0; this.pipes = []; this.score = 0; this.steps = 0;
    this.over = false; this.crash = false; this.why = ''; this.dist = 0; this.scoredNow = 0;
    this.spawn(C.FX); this.fill();
  }
  speed() { return Math.min(C.SMAX, C.SS + C.SINC * this.score); }
  nextPipe() { return this.pipes.find((q) => q.x + C.PW >= C.BX - C.R) || this.pipes[this.pipes.length - 1]; }
  features() { const q = this.nextPipe(); return [this.y, this.v, q.x - C.BX, q.c - this.y]; }
  stateIndex() { const f = this.features(); return encodeState(f[0], f[1], f[2], f[3]); }

  step(action) {
    if (action) this.v = C.FV;
    this.v = Math.min(this.v + C.G, C.MF);
    this.y += this.v;
    const sp = this.speed();
    this.pipes.forEach((q) => { q.x -= sp; });
    this.dist += sp;
    if (this.pipes[0].x + C.PW < -10) this.pipes.shift();
    this.fill();
    this.steps++;
    this.scoredNow = 0;
    const r = C.R; let why = '';
    if (this.y - r <= 0) why = 'ceiling';
    else if (this.y + r >= C.GY) why = 'ground';
    else for (const q of this.pipes) {
      if (q.x < C.BX + r && q.x + C.PW > C.BX - r) {
        if (this.y - r < q.c - q.g / 2 || this.y + r > q.c + q.g / 2) why = 'pipe';
        break;
      }
    }
    if (why) { this.over = this.crash = true; this.why = why; return R.crash; }
    let rew = R.step;
    for (const q of this.pipes) if (!q.done && q.x + C.PW < C.BX - r) { q.done = true; this.score++; this.scoredNow++; rew += R.pipe; }
    if (this.max && this.steps >= this.max) this.over = true;
    return rew;
  }
}
