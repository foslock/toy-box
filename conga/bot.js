// A stand-in dancer for the demo, the autoplay check and the balance sim.
// It scores sixteen headings: go for free dancers and coins, keep off its own line,
// never meet a rival head-on, and let rivals run into its body instead.
const TAU = Math.PI * 2;

export function botSteer(g, opts = {}) {
  const L = g.you;
  if (!L) return null;
  const hd = L.head, ds = L.dancers;
  const sloppy = opts.sloppy || 0;
  const low = hd.hp <= Math.max(3, hd.maxHp * 0.4);
  // what it wants to reach
  let goal = null, gd = 1e9;
  for (const w of g.wild) {
    const d = Math.hypot(w.x - hd.x, w.y - hd.y) * (w.mine ? 0.7 : 1);
    if (d < gd) { gd = d; goal = w; }
  }
  for (const c of g.coins) { const d = Math.hypot(c.x - hd.x, c.y - hd.y) * 1.3; if (d < gd) { gd = d; goal = c; } }
  // with a strong line and nothing to grab, hunt the softest rival tail
  if ((!goal || gd > 6) && !low && ds.length >= 4) {
    for (const F of g.foes) for (let i = 1; i < F.dancers.length; i++) {
      const o = F.dancers[i];
      if (o.atk + o.buf >= hd.hp) continue;
      const d = Math.hypot(o.x - hd.x, o.y - hd.y) + o.hp;
      if (d < gd) { gd = d; goal = o; }
    }
  }
  let best = L.h, bs = -1e9;
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * TAU;
    const c = Math.cos(a), s = Math.sin(a);
    let sc = 0;
    if (goal) { const ga = Math.atan2(goal.y - hd.y, goal.x - hd.x); sc += Math.cos(a - ga) * 2; }
    sc += Math.cos(a - L.h) * 0.6;           // don't thrash
    for (const r of [1.2, 2.4]) {
      const px = hd.x + c * r, py = hd.y + s * r;
      if (px < 0.9 || py < 0.9 || px > g.W - 0.9 || py > g.H - 0.9) sc -= 2 / r;
      for (let i = 4; i < ds.length; i++) { const d = Math.hypot(ds[i].x - px, ds[i].y - py); if (d < 1.2) sc -= 6 / r; }
      for (const F of g.foes) {
        const fh = F.head, d = Math.hypot(fh.x - px, fh.y - py);
        if (d < 2.2) sc -= (low ? 10 : 5) / r;
        if (low) for (const o of F.dancers) { const dd = Math.hypot(o.x - px, o.y - py); if (dd < 1.3) sc -= 3 / r; }
      }
    }
    sc += (Math.random() - 0.5) * sloppy;
    if (sc > bs) { bs = sc; best = a; }
  }
  return best;
}
