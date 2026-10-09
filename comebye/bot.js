// A competent (not perfect) handler, for ?demo, ?autoplay and the Node balance check.
// It's the classic shepherding rule: if a sheep has strayed, go round behind it and bring it back
// to the others; otherwise get behind the flock on the far side from where it should go, and walk on.

export function botThink(tr, mem = {}) {
  const st = tr.stepNow;
  if (!st || tr.done) { tr.clearTarget(); return; }
  const S = tr.out, c = tr.c, n = S.length;
  const cx = tr.cx, cy = tr.cy;
  let G = tr.goal();
  // aim for a point beyond a gate, but line up on it first
  if (st.k === 'gate') {
    const g = st.gate, before = (cx - g.c[0]) * g.d[0] + (cy - g.c[1]) * g.d[1];
    const lat = (cx - g.c[0]) * -g.d[1] + (cy - g.c[1]) * g.d[0];
    if (before < -5 && Math.abs(lat) > 1.5) G = [g.c[0] - g.d[0] * Math.min(10, -before * 0.5), g.c[1] - g.d[1] * Math.min(10, -before * 0.5)];
    else G = [g.c[0] + g.d[0] * 10, g.c[1] + g.d[1] * 10];
  }
  if (st.k === 'pen') {
    // like a gate: first bring them to a spot just above the gap, then walk them in
    const p = c.pen, mx = (p.gx0 + p.gx1) / 2, P1 = [mx - 0.5, p.y0 - 6];
    const lat = Math.abs(cx - mx);
    if (!mem.lined && Math.hypot(cx - P1[0], cy - P1[1]) < 4) { mem.lined = true; mem.wait = 1.6; }
    // let them stop and settle before going round to the top
    if (mem.wait > 0) { mem.wait -= 0.2; tr.clearTarget(); return; }
    if (mem.lined && (lat > 6.5 || cy < p.y0 - 15 || cy > p.y0 + 0.5)) mem.lined = false;
    G = mem.lined ? [mx, p.y1 + 3] : P1;
  }
  const scattered = st.k === 'shed' && S.some(s => Math.hypot(s.x - c.ring.c[0], s.y - c.ring.c[1]) > c.ring.r + 1);
  if (st.k === 'shed' && !scattered) {
    // come in from the side, straight through the gap between the marked ewe and the rest, then hold
    const m = tr.sheep.filter(s => s.marked), u = tr.sheep.filter(s => !s.marked);
    const mx = avg(m, 'x'), my = avg(m, 'y'), ux = avg(u, 'x'), uy = avg(u, 'y');
    let near = u[0], nd = 1e9;
    for (const s of u) { const dd = Math.hypot(s.x - mx, s.y - my); if (dd < nd) { nd = dd; near = s; } }
    let ax = mx - near.x, ay = my - near.y; const aL = Math.hypot(ax, ay) || 1; ax /= aL; ay /= aL;
    const Mx = (mx + near.x) / 2, My = (my + near.y) / 2;
    // which side to come in from: whichever the dog is already on
    let px = -ay, py = ax;
    if ((d0(tr).x - Mx) * px + (d0(tr).y - My) * py < 0) { px = -px; py = -py; }
    const r = c.ring;
    // drift back toward the middle of the ring so the split happens inside it
    const toC = [r.c[0] - Mx, r.c[1] - My];
    if (nd > 3 || mem.cut) {
      mem.cut = nd > 2.5;
      tr.setTarget(Mx + toC[0] * 0.15, My + toC[1] * 0.15, 4);
    } else if (Math.hypot(d0(tr).x - (Mx + px * 7), d0(tr).y - (My + py * 7)) > 2.5 && !mem.inPos) {
      tr.setTarget(Mx + px * 7, My + py * 7, 6);
    } else {
      mem.inPos = true;
      tr.setTarget(Mx - px * 1.5, My - py * 1.5, 7);
      if (Math.hypot(d0(tr).x - Mx, d0(tr).y - My) < 1.5) { mem.cut = true; mem.inPos = false; }
    }
    return;
  }
  // send the flock round the pen and hurdles, not into them
  G = tr.waypoint(cx, cy, G[0], G[1]);
  // stragglers first
  let far = null, fd = 0;
  for (const s of S) { const d = Math.hypot(s.x - cx, s.y - cy); if (d > fd) { fd = d; far = s; } }
  const collect = 2.6 + Math.sqrt(n) * 1.3;
  const d = tr.dog;
  if (fd > collect + (mem.collecting ? -1.5 : 0)) {
    mem.collecting = true;
    const ux = (far.x - cx) / fd, uy = (far.y - cy) / fd;
    tr.setTarget(far.x + ux * 3, far.y + uy * 3, 7);
    return;
  }
  mem.collecting = false;
  let gx = cx - G[0], gy = cy - G[1]; const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
  const ram = S.find(s => s.kind === 'ram' && s.stand > 0.5);
  const back = ram ? 2.5 : tr.spread + (st.k === 'pen' ? 4.5 : 4.6);
  const tx = cx + gx * back, ty = cy + gy * back;
  const off = Math.hypot(d.x - tx, d.y - ty);
  // far from position: run round; in position: walk on steadily
  tr.setTarget(tx, ty, off > 6 ? (Math.hypot(d.x - cx, d.y - cy) < 16 ? 6.5 : 9.5) : st.k === 'pen' ? 2.6 : 3.6);
}

function d0(tr) { return tr.dog; }
function avg(a, k) { return a.reduce((s, o) => s + o[k], 0) / a.length; }
