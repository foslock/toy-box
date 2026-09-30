// The screen saver's path: a logo bouncing round the window that, by design, meets a corner exactly T ms after it starts,
// never having met one before. Each axis is a triangle wave; both are at an extreme at T and not together before it.
const tri = p => { const m = ((p % 2) + 2) % 2; return m <= 1 ? m : 2 - m; };
const PHASES = [0.37, 0.21, 0.66, 0.83, 0.12, 0.52];

export function saverPlan(W, H, w, h, T, speed = 130) {
  const Rx = Math.max(60, W - w), Ry = Math.max(60, H - h), secs = T / 1000;
  const nx0 = Math.max(2, Math.round(secs * speed / Rx)), ny0 = Math.max(2, Math.round(secs * speed / Ry));
  let best = null;
  for (let dx = 0; dx <= 2; dx++) for (let dy = 0; dy <= 2; dy++) for (const a of PHASES) for (const b of PHASES) {
    const nx = nx0 + dx, ny = ny0 + dy, Tx = secs / (nx - a), Ty = secs / (ny - b);
    if (nx < 2 || ny < 2 || Tx <= 0 || Ty <= 0) continue;
    // the times each axis touches a wall before the end; the closest two of them, one from each, is the near miss
    let gap = Infinity;
    for (let i = 1; i < nx; i++) for (let j = 1; j < ny; j++) gap = Math.min(gap, Math.abs((i - a) * Tx - (j - b) * Ty));
    const dev = Math.abs(Rx / Tx - speed) / speed + Math.abs(Ry / Ty - speed) / speed;
    const score = Math.min(gap, 4) - dev * 2.5;
    if (!best || score > best.score) best = { score, a, b, Tx, Ty };
  }
  const { a, b, Tx, Ty } = best, tt = t => Math.min(t, T) / 1000;
  return {
    Rx, Ry, T,
    at: t => ({ x: Rx * tri(a + tt(t) / Tx), y: Ry * tri(b + tt(t) / Ty) }),
    // how many walls the logo has touched by t, to change colour on each bounce
    bounces: t => Math.floor(a + tt(t) / Tx) + Math.floor(b + tt(t) / Ty),
  };
}
