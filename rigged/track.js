// Rigged Racer: the shape of a track, with no drawing in it, so the race can be run without a page (check.mjs).
// A track is a loop, and maybe a shortcut off it, each given as a few control points that are smoothed and sampled
// every STEP along their length: where each sample is, which way the road runs, how sharply it bends, how many lanes
// it has and where its edges are. A place on a track is (path, s, x): which path, how far along it, and how far right
// of its centre line, in lanes (a lane is one unit wide).
export const STEP = .25;   // between samples
export const CELL = 2;     // about how long the squares are that the player puts things down in
const TAPER = 2.6;         // how far the road takes to gain or lose a lane

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// Centripetal Catmull-Rom through pts. Closed: a loop through all of them. Open: from the second point to the
// next-to-last, with the first and last only steering the ends.
function spline(pts, closed, per = 24) {
  const n = pts.length, out = [];
  const P = i => pts[closed ? (i % n + n) % n : clamp(i, 0, n - 1)];
  const knot = (a, b) => Math.max(1e-4, Math.hypot(b[0] - a[0], b[1] - a[1]) ** .5);
  const from = closed ? 0 : 1, to = closed ? n : n - 2;
  for (let i = from; i < to; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const t1 = knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
    for (let k = 0; k < per; k++) {
      const t = t1 + (t2 - t1) * k / per, pt = [0, 0];
      for (let d = 0; d < 2; d++) {
        const A1 = (t1 - t) / t1 * p0[d] + t / t1 * p1[d];
        const A2 = (t2 - t) / (t2 - t1) * p1[d] + (t - t1) / (t2 - t1) * p2[d];
        const A3 = (t3 - t) / (t3 - t2) * p2[d] + (t - t2) / (t3 - t2) * p3[d];
        const B1 = (t2 - t) / t2 * A1 + t / t2 * A2;
        const B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3;
        pt[d] = (t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2;
      }
      out.push(pt);
    }
  }
  if (!closed) out.push(P(n - 2).slice());
  return out;
}

// A path: the dense polyline resampled at equal steps, with directions, bends and lanes.
function makePath(dense, closed, lanes, id) {
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  let L = cum[cum.length - 1];
  if (closed) L += Math.hypot(dense[0][0] - dense[dense.length - 1][0], dense[0][1] - dense[dense.length - 1][1]);
  const N = Math.max(2, Math.round(L / STEP)), step = L / N, count = closed ? N : N + 1;
  const x = new Float32Array(count), z = new Float32Array(count);
  let j = 0;
  for (let i = 0; i < count; i++) {
    const s = i * step;
    while (j < dense.length - 1 && cum[j + 1] < s) j++;
    const a = dense[j], b = dense[(j + 1) % dense.length], seg = (j + 1 < cum.length ? cum[j + 1] : L) - cum[j];
    const t = seg > 0 ? clamp((s - cum[j]) / seg, 0, 1) : 0;
    x[i] = a[0] + (b[0] - a[0]) * t; z[i] = a[1] + (b[1] - a[1]) * t;
  }
  const tx = new Float32Array(count), tz = new Float32Array(count), k = new Float32Array(count);
  const I = i => closed ? (i % count + count) % count : clamp(i, 0, count - 1);
  for (let i = 0; i < count; i++) {
    const a = I(i - 1), b = I(i + 1), dx = x[b] - x[a], dz = z[b] - z[a], d = Math.hypot(dx, dz) || 1;
    tx[i] = dx / d; tz[i] = dz / d;
  }
  // signed bend (turn per unit length, + to the right), smoothed over a couple of units
  const raw = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = I(i - 2), b = I(i + 2);
    const cross = tx[a] * tz[b] - tz[a] * tx[b], dot = tx[a] * tx[b] + tz[a] * tz[b];
    raw[i] = Math.atan2(cross, dot) / (4 * step);
  }
  for (let i = 0; i < count; i++) { let acc = 0; for (let d = -6; d <= 6; d++) acc += raw[I(i + d)]; k[i] = acc / 13; }
  // lanes: each section's count and the shift of its middle off the centre line (a half lane for an even count, so
  // its lanes line up with an odd neighbour's)
  const n = new Uint8Array(count), c = new Float32Array(count);
  const secs = lanes.map(l => ({ at: l[0] * L, n: l[1], c: l[2] ?? (l[1] % 2 ? 0 : .5) }));
  for (let i = 0; i < count; i++) {
    const s = i * step;
    let sec = secs[0];
    for (const q of secs) if (q.at <= s + 1e-6) sec = q;
    n[i] = sec.n; c[i] = sec.c;
  }
  // the road's edges: the lanes' outer sides, eased in and out over TAPER rather than stepping
  const lo = new Float32Array(count), hi = new Float32Array(count);
  for (let i = 0; i < count; i++) { lo[i] = c[i] - n[i] / 2; hi[i] = c[i] + n[i] / 2; }
  const slope = step / TAPER;
  for (let pass = 0; pass < (closed ? 3 : 1); pass++) {
    for (let i = 1; i < count + (closed ? count : 0); i++) { const a = I(i - 1), b = I(i); hi[b] = Math.min(hi[b], hi[a] + slope); lo[b] = Math.max(lo[b], lo[a] - slope); }
    for (let i = count - 2 + (closed ? count : 0); i >= 0; i--) { const a = I(i + 1), b = I(i); hi[b] = Math.min(hi[b], hi[a] + slope); lo[b] = Math.max(lo[b], lo[a] - slope); }
  }
  // squares to put things down in: the length is evened out so they fit the path exactly
  const cells = Math.max(1, Math.round(L / CELL));
  return { id, closed, L, step, count, x, z, tx, tz, k, n, c, lo, hi, cells, cellLen: L / cells };
}

// The sample at or just before s (wrapped round a loop, clamped on a shortcut) and how far past it.
export function sampleAt(p, s) {
  if (p.closed) s = ((s % p.L) + p.L) % p.L; else s = clamp(s, 0, p.L);
  const f = s / p.step, i = Math.min(Math.floor(f), p.count - 1);
  return [i, f - i];
}
export function point(p, s, x = 0, out = {}) {
  const [i, f] = sampleAt(p, s), j = p.closed ? (i + 1) % p.count : Math.min(i + 1, p.count - 1);
  const px = p.x[i] + (p.x[j] - p.x[i]) * f, pz = p.z[i] + (p.z[j] - p.z[i]) * f;
  let tx = p.tx[i] + (p.tx[j] - p.tx[i]) * f, tz = p.tz[i] + (p.tz[j] - p.tz[i]) * f;
  const d = Math.hypot(tx, tz) || 1; tx /= d; tz /= d;
  out.x = px - tz * x; out.z = pz + tx * x; out.tx = tx; out.tz = tz;
  return out;
}
export const bendAt = (p, s) => p.k[sampleAt(p, s)[0]];
export function edgesAt(p, s) { const [i] = sampleAt(p, s); return [p.lo[i], p.hi[i]]; }
// the lanes at s: their centres, left to right
export function lanesAt(p, s) {
  const [i] = sampleAt(p, s), n = p.n[i], c = p.c[i], out = [];
  for (let l = 0; l < n; l++) out.push(c + l - (n - 1) / 2);
  return out;
}
// the lane centre nearest x at s
export function snapLane(p, s, x) {
  let best = 0, bd = 1e9;
  for (const o of lanesAt(p, s)) { const d = Math.abs(o - x); if (d < bd) { bd = d; best = o; } }
  return best;
}
// how far ahead b is of a along a path (a loop wraps; never negative there)
export function ahead(p, a, b) { const d = b - a; return p.closed ? ((d % p.L) + p.L) % p.L : d; }

// Builds a track from its definition (tracks.js).
export function buildTrack(def) {
  const main = makePath(spline(def.pts, true), true, def.lanes, 0);
  const paths = [main];
  for (const [bi, b] of (def.branches || []).entries()) {
    const sFrom = b.from * main.L, sTo = b.to * main.L, side = b.side;
    // it leaves from the outside lane on its side and comes back into it
    const outer = s => { const ls = lanesAt(main, s); return side > 0 ? ls[ls.length - 1] : ls[0]; };
    const pt = (s, out = 0) => { const q = point(main, s, outer(s) + side * out); return [q.x, q.z]; };
    // it peels away along the road's own direction, and comes back in along it
    const h = b.h ?? 3.5;
    const pts = [pt(sFrom - 3), pt(sFrom), pt(sFrom + h, .7), ...b.pts, pt(sTo - h, .7), pt(sTo), pt(sTo + 3)];
    // a two-lane mouth lines up with the loop's outside lane and the one next to it
    const lanes = (b.lanes || [[0, 1]]).map(l => l[1] % 2 || l[2] != null ? l : [l[0], l[1], -side * .5]);
    const p = makePath(spline(pts, false, 20), false, lanes, bi + 1);
    Object.assign(p, { from: sFrom, to: sTo, side, gate: b.gate ?? null, outerFrom: outer(sFrom), outerTo: outer(sTo) });
    paths.push(p);
  }
  // the bounds of everything, for the ground and the camera
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const p of paths) for (let i = 0; i < p.count; i++) { x0 = Math.min(x0, p.x[i]); x1 = Math.max(x1, p.x[i]); z0 = Math.min(z0, p.z[i]); z1 = Math.max(z1, p.z[i]); }
  const pad = 3.5;
  return { def, paths, main, box: { x0: x0 - pad, x1: x1 + pad, z0: z0 - pad, z1: z1 + pad } };
}

// How far a place is from the start line, counted along the loop: a shortcut's places count as the stretch of loop
// they cut out, in proportion.
export function progressOf(track, path, s) {
  if (path === 0) return s;
  const p = track.paths[path], span = ahead(track.main, p.from, p.to);
  return p.from + span * clamp(s / p.L, 0, 1);
}

// The distance (along the road) from a place to a point further on, across a fork if it has to; Infinity if the
// second can't be reached from the first without going all the way round.
export function roadDistance(track, pa, sa, pb, sb) {
  const main = track.main;
  if (pa === pb) { const d = pa === 0 ? ahead(main, sa, sb) : sb - sa; return d >= 0 ? d : Infinity; }
  if (pa === 0) { const b = track.paths[pb]; return ahead(main, sa, b.from) + sb; }
  const a = track.paths[pa];
  if (pb === 0) return (a.L - sa) + ahead(main, a.to, sb);
  return Infinity;
}
