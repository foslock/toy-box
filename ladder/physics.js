// Ladder: geometry and a small rigid-body solver. World units are metres, y up.
// The heap is static convex polygons. The only things that move are the ladder (a capsule, which carries the painter
// as a point mass while they climb) and, in a fall, the painter (a circle tied to the ladder by an arm).

export const G = 9.8;
export const LADDER = { L: 4.2, r: 0.1, m: 0.3, rung: 0.3 };
export const PAINTER = { m: 1, r: 0.27, o: 0.14, arm: 0.75 };
// where the painter's body sits on the ladder while climbing: along it from their feet, and out from it on their side
const TORSO = { s: 0.62, o: 0.22, r: 0.24 }, HEAD = { s: 1.3, o: 0.2, r: 0.16 };

const SLOP = 0.004, BETA = 0.25, ITER = 12, REST = 0.18;
// how a tumbling painter grips what they land on, and how fast they stop rolling
export const TUNE = { bodyMu: 0.35, roll: 1.0 };
export let RAIL_MU = 0.5;   // the ladder's smooth rails, on a corner or a wall, grip less than its rubber feet
export const setRailMu = v => { RAIL_MU = v; };

/* ------------------------------------------------------------------------------------------------- polygons */
let nextId = 1;
// A convex polygon from [[x, y], ...] in any winding. mat: { mu, ... }; obj: the junk it belongs to.
export function poly(pts, mat, obj) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; area += p[0] * q[1] - q[0] * p[1]; }
  if (area < 0) pts = pts.slice().reverse();
  const n = pts.length, x = new Float64Array(n), y = new Float64Array(n), nx = new Float64Array(n), ny = new Float64Array(n);
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity, cx = 0, cy = 0;
  for (let i = 0; i < n; i++) { x[i] = pts[i][0]; y[i] = pts[i][1]; cx += x[i]; cy += y[i]; minx = Math.min(minx, x[i]); maxx = Math.max(maxx, x[i]); miny = Math.min(miny, y[i]); maxy = Math.max(maxy, y[i]); }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, dx = x[j] - x[i], dy = y[j] - y[i], l = Math.hypot(dx, dy) || 1;
    nx[i] = dy / l; ny[i] = -dx / l;
  }
  return { id: nextId++, n, x, y, nx, ny, minx, miny, maxx, maxy, cx: cx / n, cy: cy / n, mat, obj };
}

/* ------------------------------------------------------------------------------------------------- the world */
const CELL = 2;
export class World {
  constructor(polys) {
    this.polys = polys; this.grid = new Map(); this.stamp = 0; this.marks = new Int32Array(nextId + 16);
    for (const p of polys) {
      for (let gx = Math.floor(p.minx / CELL); gx <= Math.floor(p.maxx / CELL); gx++)
        for (let gy = Math.floor(p.miny / CELL); gy <= Math.floor(p.maxy / CELL); gy++) {
          const k = gx * 73856093 ^ gy * 19349663; let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(p);
        }
    }
    // a corner pressed against another piece of junk is a seam, not an edge: the ladder slides over it
    const near = [];
    for (const p of polys) {
      p.inner = new Uint8Array(p.n);
      if (p.mat.ghost) continue;
      for (let i = 0; i < p.n; i++) {
        this.query(p.x[i] - 0.03, p.y[i] - 0.03, p.x[i] + 0.03, p.y[i] + 0.03, near);
        for (const q of near) if (q !== p && !q.mat.ghost && pointPoly(p.x[i], p.y[i], q).d < 0.025) { p.inner[i] = 1; break; }
      }
    }
  }
  // every polygon whose box overlaps the given box
  query(minx, miny, maxx, maxy, out = []) {
    out.length = 0; const st = ++this.stamp, marks = this.marks;
    for (let gx = Math.floor(minx / CELL); gx <= Math.floor(maxx / CELL); gx++)
      for (let gy = Math.floor(miny / CELL); gy <= Math.floor(maxy / CELL); gy++) {
        const a = this.grid.get(gx * 73856093 ^ gy * 19349663); if (!a) continue;
        for (const p of a) {
          if (marks[p.id] === st) continue; marks[p.id] = st;
          if (p.maxx < minx || p.minx > maxx || p.maxy < miny || p.miny > maxy) continue;
          out.push(p);
        }
      }
    return out;
  }
}

/* ------------------------------------------------------------------------------------------------- distances */
export function segT(ax, ay, bx, by, px, py) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return 0;
  return Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
}
// Signed distance from a point to a polygon (negative inside), with the outward direction and the nearest boundary point.
const PP = { d: 0, nx: 0, ny: 0, qx: 0, qy: 0 };
export function pointPoly(px, py, P, out = PP) {
  let best = -Infinity, bi = 0;
  for (let i = 0; i < P.n; i++) { const s = P.nx[i] * (px - P.x[i]) + P.ny[i] * (py - P.y[i]); if (s > best) { best = s; bi = i; } }
  if (best <= 0) { out.d = best; out.nx = P.nx[bi]; out.ny = P.ny[bi]; out.qx = px - P.nx[bi] * best; out.qy = py - P.ny[bi] * best; return out; }
  let bd = Infinity;
  for (let i = 0; i < P.n; i++) {
    const j = (i + 1) % P.n, t = segT(P.x[i], P.y[i], P.x[j], P.y[j], px, py);
    const qx = P.x[i] + (P.x[j] - P.x[i]) * t, qy = P.y[i] + (P.y[j] - P.y[i]) * t, d = Math.hypot(px - qx, py - qy);
    if (d < bd) { bd = d; out.qx = qx; out.qy = qy; }
  }
  out.d = bd; out.nx = (px - out.qx) / (bd || 1); out.ny = (py - out.qy) / (bd || 1);
  return out;
}
function segsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
// Shortest distance between a segment and a polygon (0 if they touch or cross).
export function segPolyDist(ax, ay, bx, by, P) {
  let d = Math.min(pointPoly(ax, ay, P).d, pointPoly(bx, by, P).d);
  if (d <= 0) return 0;
  for (let i = 0; i < P.n; i++) {
    const j = (i + 1) % P.n;
    if (segsCross(ax, ay, bx, by, P.x[i], P.y[i], P.x[j], P.y[j])) return 0;
    const t = segT(ax, ay, bx, by, P.x[i], P.y[i]);
    d = Math.min(d, Math.hypot(ax + (bx - ax) * t - P.x[i], ay + (by - ay) * t - P.y[i]));
  }
  return d;
}
const QB = [];
// Does a capsule (segment plus radius) overlap anything? Returns the polygon it hits, or null.
export function capsuleHits(world, ax, ay, bx, by, r, skip) {
  const ps = world.query(Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r, QB);
  for (const P of ps) if (P !== skip && !P.mat.ghost && segPolyDist(ax, ay, bx, by, P) < r) return P;
  return null;
}
export function circleHits(world, x, y, r) {
  const ps = world.query(x - r, y - r, x + r, y + r, QB);
  for (const P of ps) if (!P.mat.ghost && pointPoly(x, y, P).d < r) return P;
  return null;
}
// The highest walkable top surface at x between y0 (above) and y1 (below), or null. A point inside something is not ground.
export function groundAt(world, x, y0, y1, minNy = 0.62) {
  const ps = world.query(x - 0.01, y1 - 0.01, x + 0.01, y0 + 0.01, QB).slice();
  const cands = [];
  for (const P of ps) {
    if (P.mat.ghost || x < P.minx || x > P.maxx) continue;
    // the top boundary of a convex polygon at x: the highest crossing of an upward-facing edge
    let top = -Infinity, ei = -1;
    for (let i = 0; i < P.n; i++) {
      const j = (i + 1) % P.n, xa = P.x[i], xb = P.x[j];
      if (P.ny[i] <= 0 || (x - xa) * (x - xb) > 0 || xa === xb) continue;
      const yy = P.y[i] + (P.y[j] - P.y[i]) * (x - xa) / (xb - xa);
      if (yy > top) { top = yy; ei = i; }
    }
    if (ei < 0 || top > y0 || top < y1) continue;
    cands.push({ y: top, P, nx: P.nx[ei], ny: P.ny[ei] });
  }
  cands.sort((a, b) => b.y - a.y);
  // the highest one you could stand on: not too steep, and not inside something else
  for (const c of cands) {
    if (c.ny < minNy) continue;
    let inside = false;
    for (const P of ps) if (P !== c.P && !P.mat.ghost && pointPoly(x, c.y + 0.05, P).d < -0.01) { inside = true; break; }
    if (!inside) return c;
  }
  return null;
}
// First thing a ray hits: returns { t, P } with t in [0, 1] along the ray, or null.
export function rayCast(world, ax, ay, bx, by) {
  const ps = world.query(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), QB);
  let best = null;
  for (const P of ps) {
    if (P.mat.ghost) continue;
    let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay; let ok = true;
    for (let i = 0; i < P.n && ok; i++) {
      const num = P.nx[i] * (P.x[i] - ax) + P.ny[i] * (P.y[i] - ay), den = P.nx[i] * dx + P.ny[i] * dy;
      if (Math.abs(den) < 1e-12) { if (num < 0) ok = false; continue; }
      const t = num / den;
      if (den < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
      if (t0 > t1) ok = false;
    }
    if (ok && (!best || t0 < best.t)) best = { t: t0, P };
  }
  return best;
}

/* ------------------------------------------------------------------------------------------------- the ladder body */
// The ladder's pose is its foot (fx, fy) and the angle a from foot to top. Its velocity is (vx, vy) at the foot, and w.
// A rider (the painter, climbing) is { s, side }: feet s metres up the ladder, on side ±1 (left of the ladder's direction is +1).
export function ladderEnds(l) { const c = Math.cos(l.a), s = Math.sin(l.a); return [l.fx, l.fy, l.fx + c * LADDER.L, l.fy + s * LADDER.L]; }
export function riderPoint(l, rider, along, out) {
  const c = Math.cos(l.a), s = Math.sin(l.a), u = rider.s + along, o = rider.side * (out ?? PAINTER.o);
  return [l.fx + c * u - s * o, l.fy + s * u + c * o];
}
function composite(l, rider) {
  const L = LADDER.L, ml = LADDER.m;
  let m = ml, sx = ml * L / 2, sy = 0, rx = 0, ry = 0;
  if (rider) { rx = rider.s + 0.8; ry = rider.side * PAINTER.o; m += PAINTER.m; sx += PAINTER.m * rx; sy += PAINTER.m * ry; }
  const lx = sx / m, ly = sy / m;
  let I = ml * L * L / 12 + ml * ((L / 2 - lx) ** 2 + ly * ly);
  if (rider) I += PAINTER.m * ((rx - lx) ** 2 + (ry - ly) ** 2) + PAINTER.m * 0.08;
  return { m, I, lx, ly };
}

/* ------------------------------------------------------------------------------------------------- contacts */
function addContact(list, b, x, y, nx, ny, depth, mu, key, P, part) { list.push({ b, x, y, nx, ny, depth, mu, key, P, part, pn: 0, pt: 0 }); }
const QS = [];
function capsuleContacts(world, ax, ay, bx, by, r, b, list, footMu, railMu) {
  const ps = world.query(Math.min(ax, bx) - r - 0.05, Math.min(ay, by) - r - 0.05, Math.max(ax, bx) + r + 0.05, Math.max(ay, by) + r + 0.05, QS);
  const margin = 0.02;
  for (const P of ps) {
    if (P.mat.ghost) continue;
    const n0 = list.length;
    for (let e = 0; e < 2; e++) {
      const px = e ? bx : ax, py = e ? by : ay, q = pointPoly(px, py, P);
      if (q.d > 0 && atInner(P, q.qx, q.qy)) continue;
      if (q.d < r + margin) addContact(list, b, q.qx, q.qy, q.nx, q.ny, r - q.d, P.mat.mu * (e ? railMu : footMu), P.id + ':e' + e, P, e ? 'top' : 'foot');
    }
    const sx = -(by - ay), sy = bx - ax, sl = Math.hypot(sx, sy) || 1;
    for (let i = 0; i < P.n; i++) {
      if (P.inner[i]) continue;
      const vx = P.x[i], vy = P.y[i], t = segT(ax, ay, bx, by, vx, vy);
      if (t < 0.002 || t > 0.998) continue;
      const qx = ax + (bx - ax) * t, qy = ay + (by - ay) * t;
      let dx = qx - vx, dy = qy - vy; const d = Math.hypot(dx, dy);
      if (d >= r + margin) continue;
      if (d > 1e-5) { dx /= d; dy /= d; } else { dx = sx / sl; dy = sy / sl; if (dx * (qx - P.cx) + dy * (qy - P.cy) < 0) { dx = -dx; dy = -dy; } }
      addContact(list, b, vx, vy, dx, dy, r - d, P.mat.mu * railMu, P.id + ':v' + i, P, 'rail');
    }
    if (list.length === n0) {
      // the core of the ladder is through the polygon with no corner near it (only after something went very fast):
      // push it out along whichever polygon side needs the least
      let cross = false;
      for (let i = 0; i < P.n && !cross; i++) { const j = (i + 1) % P.n; cross = segsCross(ax, ay, bx, by, P.x[i], P.y[i], P.x[j], P.y[j]); }
      if (cross) {
        let best = Infinity, bnx = 0, bny = 1;
        for (let i = 0; i < P.n; i++) {
          const da = P.nx[i] * (ax - P.x[i]) + P.ny[i] * (ay - P.y[i]), db = P.nx[i] * (bx - P.x[i]) + P.ny[i] * (by - P.y[i]);
          const pen = r - Math.min(da, db); if (pen < best) { best = pen; bnx = P.nx[i]; bny = P.ny[i]; }
        }
        addContact(list, b, (ax + bx) / 2, (ay + by) / 2, bnx, bny, Math.min(best, 0.2), P.mat.mu * railMu, P.id + ':x', P, 'rail');
      }
    }
  }
}
function atInner(P, x, y) { for (let i = 0; i < P.n; i++) if (P.inner[i] && Math.abs(P.x[i] - x) < 1e-4 && Math.abs(P.y[i] - y) < 1e-4) return true; return false; }
function circleContacts(world, x, y, r, b, list, tag, muK) {
  const ps = world.query(x - r - 0.05, y - r - 0.05, x + r + 0.05, y + r + 0.05, QS);
  for (const P of ps) {
    if (P.mat.ghost) continue;
    const q = pointPoly(x, y, P);
    if (q.d > 0 && atInner(P, q.qx, q.qy)) continue;
    if (q.d < r + 0.02) {
      // a tumbling body grips whatever it lands on, except a slope too steep to stop on
      const steep = q.ny < 0.62;
      addContact(list, b, q.qx, q.qy, q.nx, q.ny, r - q.d, steep ? 0.08 : tag === 'body' ? Math.max(TUNE.bodyMu, P.mat.mu) : P.mat.mu * muK, P.id + ':' + tag, P, tag);
    }
  }
}

/* ------------------------------------------------------------------------------------------------- the solver */
export class Sim {
  constructor(world) { this.world = world; this.warm = new Map(); this.contacts = []; this.impacts = []; }
  reset() { this.warm.clear(); }

  // One step. lad: the ladder; rider: null or { s, side } (climbing, part of the ladder's body);
  // pb: null or the painter's own body { x, y, vx, vy } in a fall, tied to the ladder at rope.s by an arm of rope.len.
  // kick: an extra angular impulse on the ladder this step (a climber's jolt), and push: a linear one at the rider.
  step(lad, rider, pb, rope, dt, kick = 0, push = null) {
    const W = this.world, comp = composite(lad, rider);
    const ca = Math.cos(lad.a), sa = Math.sin(lad.a);
    // the ladder body, at its centre of mass
    const B0 = { x: lad.fx + ca * comp.lx - sa * comp.ly, y: lad.fy + sa * comp.lx + ca * comp.ly, m: comp.m, I: comp.I };
    B0.vx = lad.vx - lad.w * (B0.y - lad.fy); B0.vy = lad.vy + lad.w * (B0.x - lad.fx); B0.w = lad.w;
    B0.invM = 1 / B0.m; B0.invI = 1 / B0.I;
    const bodies = [B0];
    let B1 = null;
    if (pb) { B1 = { x: pb.x, y: pb.y, vx: pb.vx, vy: pb.vy, w: 0, invM: 1 / PAINTER.m, invI: 0 }; bodies.push(B1); }

    for (const B of bodies) B.vy -= G * dt;
    if (kick) B0.w += kick * B0.invI;
    if (push && rider) {
      const [px, py] = riderPoint(lad, rider, 0.3);
      B0.vx += push[0] * B0.invM; B0.vy += push[1] * B0.invM; B0.w += ((px - B0.x) * push[1] - (py - B0.y) * push[0]) * B0.invI;
    }

    // contacts
    const list = this.contacts; list.length = 0;
    const [ax, ay, bx, by] = ladderEnds(lad);
    capsuleContacts(W, ax, ay, bx, by, LADDER.r, 0, list, 1, RAIL_MU);
    if (rider) {
      const t = riderPoint(lad, rider, TORSO.s, TORSO.o), h = riderPoint(lad, rider, HEAD.s, HEAD.o);
      circleContacts(W, t[0], t[1], TORSO.r, 0, list, 'torso', 0.6);
      circleContacts(W, h[0], h[1], HEAD.r, 0, list, 'head', 0.6);
    }
    if (B1) circleContacts(W, B1.x, B1.y, PAINTER.r, 1, list, 'body', 0.8);

    const warm = this.warm, next = new Map();
    for (const c of list) {
      const B = bodies[c.b];
      c.rx = c.x - B.x; c.ry = c.y - B.y;
      const rn = c.rx * c.ny - c.ry * c.nx; c.mn = 1 / (B.invM + B.invI * rn * rn);
      c.tx = -c.ny; c.ty = c.nx;
      const rt = c.rx * c.ty - c.ry * c.tx; c.mt = 1 / (B.invM + B.invI * rt * rt);
      const vx = B.vx - B.w * c.ry, vy = B.vy + B.w * c.rx, vn = vx * c.nx + vy * c.ny, vt = vx * c.tx + vy * c.ty;
      c.vn0 = vn;
      // sliding friction is a little less than sticking friction, so a slip, once going, tends to run away
      c.mu *= 1 - 0.28 * Math.min(1, Math.abs(vt) / 0.35);
      c.bias = Math.min(2, Math.max(0, c.depth - SLOP) * BETA / dt);
      if (vn < -1.2) c.bias = Math.max(c.bias, -REST * vn);
      const w = warm.get(c.key);
      if (w) { c.pn = w[0] * 0.92; c.pt = Math.max(-c.mu * c.pn, Math.min(c.mu * c.pn, w[1] * 0.92)); this.apply(B, c, c.pn, c.pt); }
    }
    // the arm between the painter and the ladder in a fall
    let J = null;
    if (B1 && rope) {
      const s = Math.max(0, Math.min(LADDER.L, rope.s));
      J = { gx: lad.fx + ca * s, gy: lad.fy + sa * s, len: rope.len, acc: 0 };
    }

    for (let it = 0; it < ITER; it++) {
      for (const c of list) {
        const B = bodies[c.b];
        let vx = B.vx - B.w * c.ry, vy = B.vy + B.w * c.rx;
        const vn = vx * c.nx + vy * c.ny;
        let dpn = c.mn * (-vn + c.bias); const pn0 = c.pn; c.pn = Math.max(0, pn0 + dpn); dpn = c.pn - pn0;
        this.apply(B, c, dpn, 0);
        vx = B.vx - B.w * c.ry; vy = B.vy + B.w * c.rx;
        const vt = vx * c.tx + vy * c.ty, max = c.mu * c.pn;
        let dpt = -c.mt * vt; const pt0 = c.pt; c.pt = Math.max(-max, Math.min(max, pt0 + dpt)); dpt = c.pt - pt0;
        this.apply(B, c, 0, dpt);
      }
      if (J) this.rope(B0, B1, J, dt);
    }
    for (const c of list) next.set(c.key, [c.pn, c.pt]);
    this.warm = next;

    // record hard hits (for sound and the commentator)
    this.impacts.length = 0;
    for (const c of list) if (c.vn0 < -1.5) this.impacts.push({ x: c.x, y: c.y, v: -c.vn0, P: c.P, part: c.part, b: c.b });

    // a body on the ground loses its roll quickly
    if (B1 && list.some(c => c.b === 1 && c.ny > 0.62)) { const k = 1 - TUNE.roll * dt; B1.vx *= k; B1.vy = B1.vy > 0 ? B1.vy * k : B1.vy; }
    // integrate
    for (const B of bodies) {
      const sp = Math.hypot(B.vx, B.vy); if (sp > 20) { B.vx *= 20 / sp; B.vy *= 20 / sp; }
      B.vx *= 1 - 0.02 * dt; B.vy *= 1 - 0.02 * dt;
      B.x += B.vx * dt; B.y += B.vy * dt;
    }
    B0.w = Math.max(-10, Math.min(10, B0.w)) * (1 - 0.25 * dt);
    lad.a += B0.w * dt;
    const c2 = Math.cos(lad.a), s2 = Math.sin(lad.a);
    lad.fx = B0.x - (c2 * comp.lx - s2 * comp.ly); lad.fy = B0.y - (s2 * comp.lx + c2 * comp.ly);
    lad.vx = B0.vx + B0.w * (B0.y - lad.fy); lad.vy = B0.vy - B0.w * (B0.x - lad.fx); lad.w = B0.w;
    if (B1) { pb.x = B1.x; pb.y = B1.y; pb.vx = B1.vx; pb.vy = B1.vy; }
    return list;
  }
  apply(B, c, pn, pt) {
    const px = c.nx * pn + c.tx * pt, py = c.ny * pn + c.ty * pt;
    B.vx += px * B.invM; B.vy += py * B.invM; B.w += (c.rx * py - c.ry * px) * B.invI;
  }
  rope(B0, B1, J, dt) {
    const dx = B1.x - J.gx, dy = B1.y - J.gy, d = Math.hypot(dx, dy);
    if (d < J.len || d < 1e-6) return;
    const nx = dx / d, ny = dy / d, rx = J.gx - B0.x, ry = J.gy - B0.y;
    const v0x = B0.vx - B0.w * ry, v0y = B0.vy + B0.w * rx;
    const vn = (B1.vx - v0x) * nx + (B1.vy - v0y) * ny;
    const rn = rx * ny - ry * nx, k = B1.invM + B0.invM + rn * rn * B0.invI;
    const bias = Math.min(3, (d - J.len) * BETA / dt);
    let lam = -(vn + bias) / k; const a0 = J.acc; J.acc = Math.min(0, a0 + lam); lam = J.acc - a0;
    B1.vx += lam * nx * B1.invM; B1.vy += lam * ny * B1.invM;
    B0.vx -= lam * nx * B0.invM; B0.vy -= lam * ny * B0.invM; B0.w -= (rx * lam * ny - ry * lam * nx) * B0.invI;
  }
}
