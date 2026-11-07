/** requestAnimationFrame loop that reports elapsed time in 60 Hz frames. Returns a stop() function. */
export function startLoop(fn) {
  let id = 0, last = 0, alive = true;
  const frame = (t) => {
    if (!alive) return;
    if (!last) last = t;
    const acc = Math.min((t - last) / 16.667, 4);
    last = t;
    fn(acc, t);
    id = requestAnimationFrame(frame);
  };
  id = requestAnimationFrame(frame);
  return () => { alive = false; cancelAnimationFrame(id); };
}
