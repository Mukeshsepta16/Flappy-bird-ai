/** Small DPR-aware canvas helpers shared by the Learn and Models views. */
export function fit(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
  const W = Math.round(w * dpr), H = Math.round(h * dpr);
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Line chart with area fill, light grid and min/max labels. */
export function lineChart(canvas, values, { color = cssVar('--blue') || '#3d7bff', empty = 'Waiting for data…' } = {}) {
  const { ctx, w, h } = fit(canvas);
  ctx.clearRect(0, 0, w, h);
  const muted = cssVar('--muted') || '#667', grid = cssVar('--line') || 'rgba(0,0,0,.1)';
  ctx.font = '11px Manrope, system-ui, sans-serif';
  const padL = 38, padR = 10, padT = 10, padB = 18;
  if (values.length < 2) { ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.fillText(empty, w / 2, h / 2); return; }
  const lo = Math.min(...values, 0), hi = Math.max(...values, 1), span = hi - lo || 1;
  const X = (i) => padL + ((w - padL - padR) * i) / (values.length - 1);
  const Y = (v) => padT + (h - padT - padB) * (1 - (v - lo) / span);
  ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.fillStyle = muted; ctx.textAlign = 'right';
  for (let i = 0; i <= 3; i++) {
    const v = lo + (span * i) / 3, y = Y(v);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillText(v.toFixed(0), padL - 6, y + 4);
  }
  const g = ctx.createLinearGradient(0, padT, 0, h - padB);
  g.addColorStop(0, color + '55'); g.addColorStop(1, color + '00');
  ctx.beginPath();
  values.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.lineTo(X(values.length - 1), h - padB); ctx.lineTo(X(0), h - padB); ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  ctx.beginPath();
  values.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke();
  const lx = X(values.length - 1), ly = Y(values[values.length - 1]);
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, 7); ctx.fill();
}
