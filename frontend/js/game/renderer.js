/** Canvas renderer: parallax scenery, pipes, bird, particles and screen shake. Pure presentation. */
import { physics } from './env.js';

const VW = 400, VH = 600;
const PAL = {
  light: { sky: ['#4FB6F0', '#CBEFFB'], hillFar: '#9AD6A0', hillNear: '#6FBF7A', pipe: ['#58A62A', '#93DE50', '#4B9420'], pipeLine: '#33701A', ground: '#E3D391', grass: '#6EBE32', stripe: '#CDBB74', cloud: 'rgba(255,255,255,.92)' },
  dark:  { sky: ['#0E2748', '#3A7899'], hillFar: '#1F5B55', hillNear: '#17463F', pipe: ['#3F8A2A', '#6DB848', '#34751F'], pipeLine: '#1F4A14', ground: '#8B8456', grass: '#4E9A2D', stripe: '#766F47', cloud: 'rgba(210,230,245,.32)' },
};

export class WorldRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.parts = []; this.shake = 0; this.pop = 0; this.wing = 0; this.phase = 0; this.t = 0;
    this.clouds = Array.from({ length: 5 }, (_, i) => ({ x: i * 90 + Math.random() * 40, y: 40 + Math.random() * 190, s: .6 + Math.random() * .8, v: .12 + Math.random() * .18 }));
    this.stars = Array.from({ length: 40 }, () => ({ x: Math.random() * VW, y: Math.random() * 300, r: Math.random() * 1.3 + .3, p: Math.random() * 6 }));
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = VW * dpr; this.canvas.height = VH * dpr;
    this.dpr = dpr;
  }

  get pal() { return document.documentElement.dataset.theme === 'dark' ? PAL.dark : PAL.light; }
  get night() { return document.documentElement.dataset.theme === 'dark'; }

  // ---- events from the game -------------------------------------------------
  flap(env) {
    const C = physics();
    this.wing = 1;
    for (let i = 0; i < 5; i++) this.parts.push({ x: C.BX - 14, y: env.y + 6, vx: -1.4 - Math.random() * 1.6, vy: Math.random() * 1.2 - .2, life: 22, max: 22, r: 3 + Math.random() * 3, kind: 'puff' });
  }
  scored(env) {
    const C = physics();
    this.pop = 1;
    for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28; this.parts.push({ x: C.BX, y: env.y, vx: Math.cos(a) * 2.6, vy: Math.sin(a) * 2.6, life: 30, max: 30, r: 2 + Math.random() * 2.5, kind: 'spark' }); }
  }
  crashed(env) {
    const C = physics();
    this.shake = 9;
    for (let i = 0; i < 22; i++) this.parts.push({ x: C.BX, y: env.y, vx: (Math.random() - .5) * 7, vy: -Math.random() * 5, life: 55, max: 55, r: 2.5 + Math.random() * 3, kind: 'feather' });
  }
  reset() { this.parts.length = 0; this.shake = 0; this.pop = 0; }

  // ---- frame ------------------------------------------------------------------
  draw(env, dt = 1, { paused = false } = {}) {
    const x = this.ctx, P = this.pal, C = physics();
    this.t += dt;
    if (!paused) {
      this.clouds.forEach((c) => { c.x -= c.v * dt; if (c.x < -90) { c.x = VW + 40; c.y = 40 + Math.random() * 190; } });
      this.phase += dt * (.22 + this.wing * .5);
      this.wing = Math.max(0, this.wing - .06 * dt);
      this.pop = Math.max(0, this.pop - .05 * dt);
      this.shake = Math.max(0, this.shake - .55 * dt);
      for (const p of this.parts) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.kind === 'feather') p.vy += .22 * dt;
        if (p.kind === 'puff') { p.vx *= .96; p.r += .08 * dt; }
      }
      this.parts = this.parts.filter((p) => p.life > 0);
    }

    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    x.save();
    if (this.shake > .1) x.translate((Math.random() - .5) * this.shake, (Math.random() - .5) * this.shake);

    // sky
    const g = x.createLinearGradient(0, 0, 0, C.GY);
    g.addColorStop(0, P.sky[0]); g.addColorStop(1, P.sky[1]);
    x.fillStyle = g; x.fillRect(-20, -20, VW + 40, VH + 40);
    if (this.night) {
      this.stars.forEach((s) => { x.globalAlpha = .45 + .45 * Math.sin(this.t * .03 + s.p); x.fillStyle = '#fff'; x.beginPath(); x.arc(s.x, s.y, s.r, 0, 7); x.fill(); });
      x.globalAlpha = 1;
      x.fillStyle = '#F3EFD2'; x.beginPath(); x.arc(320, 90, 20, 0, 7); x.fill();
      x.fillStyle = P.sky[0]; x.beginPath(); x.arc(328, 84, 17, 0, 7); x.fill();
    } else {
      const sun = x.createRadialGradient(320, 90, 4, 320, 90, 70);
      sun.addColorStop(0, 'rgba(255,240,170,.95)'); sun.addColorStop(1, 'rgba(255,240,170,0)');
      x.fillStyle = sun; x.fillRect(240, 10, 160, 160);
    }
    this.clouds.forEach((c) => this.#cloud(x, c, P.cloud));

    // parallax hills
    this.#hills(x, env.dist * .08, 470, 34, 120, P.hillFar);
    this.#hills(x, env.dist * .22, 495, 26, 80, P.hillNear);

    // pipes
    for (const p of env.pipes) this.#pipe(x, p, P, C);

    // ground
    x.fillStyle = P.ground; x.fillRect(0, C.GY, VW, VH - C.GY);
    x.fillStyle = P.stripe;
    const off = env.dist % 28;
    for (let sx = -off - 28; sx < VW + 28; sx += 28) { x.beginPath(); x.moveTo(sx, C.GY + 14); x.lineTo(sx + 14, C.GY + 14); x.lineTo(sx + 2, C.GY + 80); x.lineTo(sx - 12, C.GY + 80); x.fill(); }
    x.fillStyle = P.grass; x.fillRect(0, C.GY, VW, 14);
    x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(0, C.GY + 14, VW, 3);

    this.#bird(x, env, C);

    for (const p of this.parts) {
      const k = p.life / p.max; x.globalAlpha = Math.min(1, k * 1.4);
      if (p.kind === 'puff') x.fillStyle = '#fff';
      else if (p.kind === 'spark') x.fillStyle = '#FFE066';
      else x.fillStyle = '#FFD532';
      x.beginPath(); x.arc(p.x, p.y, p.r * (p.kind === 'spark' ? k + .4 : 1), 0, 7); x.fill();
    }
    x.globalAlpha = 1;

    // score
    const sc = 1 + this.pop * .35;
    x.save(); x.translate(VW / 2, 82); x.scale(sc, sc);
    x.font = '700 56px Fredoka, Manrope, system-ui, sans-serif'; x.textAlign = 'center';
    x.lineJoin = 'round'; x.lineWidth = 8; x.strokeStyle = 'rgba(10,40,30,.55)'; x.strokeText(env.score, 0, 0);
    x.fillStyle = '#fff'; x.fillText(env.score, 0, 0); x.restore();

    x.restore();
  }

  #cloud(x, c, col) {
    x.save(); x.translate(c.x, c.y); x.scale(c.s, c.s); x.fillStyle = col;
    x.beginPath(); x.arc(0, 0, 18, 0, 7); x.arc(22, -8, 24, 0, 7); x.arc(48, 0, 18, 0, 7); x.rect(0, 0, 48, 18); x.fill(); x.restore();
  }

  #hills(x, off, base, amp, wave, col) {
    x.fillStyle = col; x.beginPath(); x.moveTo(0, VH);
    for (let i = 0; i <= VW; i += 10) x.lineTo(i, base - amp * (.5 + .5 * Math.sin((i + off) / wave * 3.1)) - amp * .25 * Math.sin((i + off) / (wave * .43)));
    x.lineTo(VW, VH); x.closePath(); x.fill();
  }

  #pipe(x, p, P, C) {
    const t = p.c - p.g / 2, b = p.c + p.g / 2, capH = 26, ov = 5;
    const grad = (px, w) => { const g = x.createLinearGradient(px, 0, px + w, 0); g.addColorStop(0, P.pipe[0]); g.addColorStop(.35, P.pipe[1]); g.addColorStop(1, P.pipe[2]); return g; };
    x.lineWidth = 3; x.strokeStyle = P.pipeLine;
    const body = grad(p.x, C.PW), cap = grad(p.x - ov, C.PW + ov * 2);
    x.fillStyle = body; x.fillRect(p.x, 0, C.PW, t - capH); x.strokeRect(p.x, -3, C.PW, t - capH + 3);
    x.fillRect(p.x, b + capH, C.PW, C.GY - b - capH); x.strokeRect(p.x, b + capH, C.PW, C.GY - b - capH);
    x.fillStyle = cap;
    x.fillRect(p.x - ov, t - capH, C.PW + ov * 2, capH); x.strokeRect(p.x - ov, t - capH, C.PW + ov * 2, capH);
    x.fillRect(p.x - ov, b, C.PW + ov * 2, capH); x.strokeRect(p.x - ov, b, C.PW + ov * 2, capH);
  }

  #bird(x, env, C) {
    x.save(); x.translate(C.BX, env.y); x.rotate(Math.max(-.4, Math.min(env.v * .07, 1.2)));
    const body = x.createRadialGradient(-4, -6, 2, 0, 0, 19);
    body.addColorStop(0, '#FFE98A'); body.addColorStop(1, '#FFC21F');
    x.fillStyle = body; x.strokeStyle = '#C88C14'; x.lineWidth = 2;
    x.beginPath(); x.ellipse(0, 0, 18, 16, 0, 0, 7); x.fill(); x.stroke();
    // wing
    const wy = Math.sin(this.phase * 2.2) * 5;
    x.fillStyle = '#F0A81E'; x.beginPath(); x.ellipse(-6, 3 + wy * .4, 9, 5.5, -.3 + wy * .06, 0, 7); x.fill(); x.stroke();
    // eye
    x.fillStyle = '#fff'; x.beginPath(); x.arc(8, -6, 6.5, 0, 7); x.fill();
    x.fillStyle = '#141414'; x.beginPath(); x.arc(10, -6, 3.2, 0, 7); x.fill();
    // beak
    x.fillStyle = '#FA5A28'; x.beginPath(); x.moveTo(13, -1); x.lineTo(24, 2); x.lineTo(13, 6); x.closePath(); x.fill();
    x.restore();
  }
}
