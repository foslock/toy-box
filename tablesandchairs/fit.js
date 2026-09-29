// How the pieces rest: on the ground in each of their eight poses (four quarter turns, mirrored or not), and on
// one another. The generator uses it to make sure every piece in the queue has a face of the one before it that
// will hold it, as long as that one goes down the right way up; the game uses it to aim (?auto) and to tell the
// player when the way they're holding a piece won't stand anywhere. Pure geometry, so it runs in Node too.
import { xRange, vSpan, polysBounds, hull, massProps } from './geom.js';

// The outline turned into a flipped (mirrored) and/or rotated (quarter turns, anticlockwise) pose.
export function posedParts(p, flip, turn) {
  const a = turn * Math.PI / 2, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a)), m = flip ? -1 : 1;
  return p.parts.map(q => ({ dz: q.dz, v: q.v.map(([x, y]) => { x *= m; return [x * c - y * s, x * s + y * c]; }) }));
}
// Poses are numbered turn + 4 * flip.
export const poseOf = (flip, turn) => (turn & 3) + (flip ? 4 : 0);
// A resting piece counts as steady if it would have to be tipped at least 5° before it went over: its centre of
// mass has to be inside what holds it by its height times this.
const TIP = Math.tan(5 * Math.PI / 180);
// How far above where it would touch a piece hovers before it's let go, which it falls when it is.
export const hoverGap = h => Math.max(.08, h * .012);

// Tipping over a corner. A piece of mass m (moment of inertia I about its centre of mass) has tipped about corner
// A until corner B, D further on, came down, with its centre of mass now a past A and hh up. It was moving with
// energy E (in mass × height, so g drops out). The knock at B stops it or starts it turning about B: returns the
// energy it carries on with. If its centre of mass is short of B that has to lift it over B to take it any
// further, so it only rolls on if it's enough.
function knock(m, I, a, hh, D, E) {
  const IA = I + m * (a * a + hh * hh), IB = I + m * ((D - a) ** 2 + hh * hh), L = I + m * hh * hh - m * a * (D - a);
  return L > 0 ? E * L * L / (IA * IB) : 0;
}
const rollsOver = (m, a, hh, D, E) => a < D && E > m * (Math.hypot(D - a, hh) - hh) * .7;
// The energy a piece starts tipping with when it's dropped from drop above and lands on a corner with its centre
// of mass e past it and h above it.
const dropKick = (m, I, e, h, drop) => m * drop * m * e * e / (I + m * (e * e + h * h));

// Lets a convex hull (with its centre of mass at c) fall a little onto flat ground and roll over its corners
// until it rests on an edge or a corner under c. Returns where that leaves it, as a turn `ang` then a shift
// (tx, ty), and the span it stands on; or null if it rolls further than about 25°, or rolls with enough go in
// it to carry on over the next corner: either way it won't stay anywhere near this pose.
function settle(H, c, size, m, I, drop) {
  let ang = 0, tx = 0, ty = -Math.min(...H.map(v => v[1])), E = -1;
  for (let it = 0; it < 12; it++) {
    const co = Math.cos(ang), si = Math.sin(ang), at = ([x, y]) => [x * co - y * si + tx, x * si + y * co + ty];
    const P = H.map(at), C = at(c);
    let minY = Infinity, xa = Infinity, xb = -Infinity;
    for (const [, y] of P) if (y < minY) minY = y;
    for (const [x, y] of P) if (y - minY < size * 1e-7) { if (x < xa) xa = x; if (x > xb) xb = x; }
    if (C[0] >= xa && C[0] <= xb) return { ang, tx, ty: ty - minY, xa, xb };
    const dir = C[0] > xb ? 1 : -1, px = dir > 0 ? xb : xa, h = C[1] - minY;
    if (E < 0) E = dropKick(m, I, (C[0] - px) * dir, h, drop);
    let th = Infinity, B = null;
    for (const v of P) { const d = (v[0] - px) * dir; if (d > 1e-9) { const t = Math.atan2(v[1] - minY, d); if (t < th) { th = t; B = v; } } }
    // tip over the corner at (px, minY): clockwise when it goes to the right
    const q = -dir * th, cq = Math.cos(q), sq = Math.sin(q), turn = ([x, y]) => [px + (x - px) * cq - (y - minY) * sq, minY + (x - px) * sq + (y - minY) * cq];
    const C2 = turn(C), B2 = turn(B), a = (C2[0] - px) * dir, hh = C2[1] - minY, D = (B2[0] - px) * dir;
    E = knock(m, I, a, hh, D, E + m * (h - hh));
    if (rollsOver(m, a, hh, D, E)) return null;
    [tx, ty] = turn([tx, ty]); ang += q;
    if (!(Math.abs(ang) < .45)) return null;
  }
  return null;
}

function sameOutline(a, b, tol) {
  const flat = parts => parts.flatMap(q => q.v).map(([x, y]) => [Math.round(x / tol), Math.round(y / tol)]).sort((u, v) => u[0] - v[0] || u[1] - v[1]);
  const A = flat(a), B = flat(b);
  return A.length === B.length && A.every((u, i) => Math.abs(u[0] - B[i][0]) <= 1 && Math.abs(u[1] - B[i][1]) <= 1);
}

// Each pose as it ends up when it's let go in that pose, lowest point first, just above flat ground at x = 0:
// its outline (lowest point at y = 0), centre of mass, mass, the span it stands on (xa..xb), its bounds and how
// far it tipped. So a pose shifted by dx is where the piece rests if it's let go with its origin at x = dx.
// null for a pose it won't stay in, or only just (see TIP): a coffee table on its side rolls onto its legs.
// `same` points at the first pose with the same outline (a symmetric piece looks the same mirrored), which
// stands in for it.
export function restPoses(p) {
  if (p.rest) return p.rest;
  const size = Math.max(p.maxX - p.minX, p.maxY), rest = [];
  const symmetric = sameOutline(posedParts(p, 0, 0), posedParts(p, 1, 0), size * 1e-6);
  for (let pose = 0; pose < 8; pose++) {
    const posed = posedParts(p, pose >> 2, pose & 3), mp = massProps(posed), pts = posed.flatMap(q => q.v);
    const s = settle(hull(pts), [mp.cx, mp.cy], size, mp.mass, mp.I, hoverGap(polysBounds([pts]).y1 - polysBounds([pts]).y0));
    if (!s) { rest.push(null); continue; }
    const co = Math.cos(s.ang), si = Math.sin(s.ang), at = ([x, y]) => [x * co - y * si + s.tx, x * si + y * co + s.ty];
    const polys = posed.map(q => q.v.map(at)), [cx, cy] = at([mp.cx, mp.cy]), b = polysBounds(polys);
    if (Math.min(cx - s.xa, s.xb - cx) < cy * TIP) { rest.push(null); continue; }
    rest.push({ pose, tilt: s.ang, polys, cx, cy, mass: mp.mass, I: mp.I, xa: s.xa, xb: s.xb, b, w: b.x1 - b.x0, h: b.y1 - b.y0,
      same: symmetric && pose >= 4 ? pose - 4 : pose });
  }
  for (const r of rest) if (r && !rest[r.same]) r.same = r.pose;
  return p.rest = rest;
}

// Lowers a resting pose, shifted dx sideways, straight down onto the obstacles and lets it go from hoverGap above.
// If its centre of mass isn't over what it touches, it tips about the contact on that side until something else
// takes its weight, by up to maxTilt. Returns where it comes to rest ({ y: how far it was lifted, tilt, x0..x1:
// what holds it, cx: its centre of mass }), or null if it would come down on the ground, tip further than
// maxTilt or hard enough to roll on over what should have stopped it, or end up with its centre of mass nearer
// the edge of what holds it than margin, or than it takes to stay steady.
// For two convex parts the gap between them is convex across their shared x-range, so corners and range ends
// are the only places to look, both for the first touch and for the next one as it tips. The contacts are
// taken to be level with its bottom, which is near enough for pieces that tip a few degrees.
const S = [], O = [];
let G = new Float64Array(256);
function sample(A, dx, B, x) {
  const sa = vSpan(A, x - dx), sb = vSpan(B, x);
  if (sa && sb) { S.push(x, sb[1] - sa[0]); O.push(B); }
}
export function land(R, dx, obstacles, maxTilt = .14, margin = 0) {
  S.length = O.length = 0;
  for (const A of R.polys) {
    const [ax0, ax1] = A.range || (A.range = xRange(A)), lo = ax0 + dx, hi = ax1 + dx;
    for (const B of obstacles) {
      const [bx0, bx1] = B.range || (B.range = xRange(B)), x0 = Math.max(lo, bx0), x1 = Math.min(hi, bx1);
      if (x1 - x0 < 1e-6) continue;
      sample(A, dx, B, x0); sample(A, dx, B, x1);
      for (const [x] of A) if (x + dx > x0 && x + dx < x1) sample(A, dx, B, x + dx);
      for (const [x] of B) if (x > x0 && x < x1) sample(A, dx, B, x);
    }
  }
  const n = S.length >> 1;
  let top = -Infinity;
  for (let i = 0; i < n; i++) if (S[2 * i + 1] > top) top = S[2 * i + 1];
  if (!(top > R.h * 1e-4)) return null;               // nothing under it but the ground
  if (G.length < n) G = new Float64Array(n * 2);
  const eps = R.w * 1e-4, m = R.mass;
  for (let i = 0; i < n; i++) G[i] = top - S[2 * i + 1];
  let tilt = 0, cx = R.cx + dx, E = -1, h = R.cy;
  margin = Math.max(margin, R.cy * TIP);
  for (let it = 0; it < 4; it++) {
    let x0 = Infinity, x1 = -Infinity;
    for (let i = 0; i < n; i++) if (G[i] <= eps) { const x = S[2 * i]; if (x < x0) x0 = x; if (x > x1) x1 = x; }
    if (cx >= x0 && cx <= x1) return cx - x0 >= margin && x1 - cx >= margin ? { y: top, tilt, x0, x1, cx, on: holder(n, eps) } : null;
    const dir = cx > x1 ? 1 : -1, px = dir > 0 ? x1 : x0, e = (cx - px) * dir;
    if (E < 0) E = dropKick(m, R.I, e, h, hoverGap(R.h));
    let th = Infinity, D = 0;
    for (let i = 0; i < n; i++) { const d = (S[2 * i] - px) * dir; if (d > 1e-9) { const t = Math.atan2(Math.max(0, G[i]), d); if (t < th) { th = t; D = d; } } }
    if (!(th < Infinity) || Math.abs(tilt) + th > maxTilt) return null;
    const c = Math.cos(th), s = Math.sin(th), a = e * c + h * s, hh = h * c - e * s;
    E = knock(m, R.I, a, hh, D, E + m * (h - hh));
    if (rollsOver(m, a, hh, D, E)) return null;
    const tn = Math.tan(th);
    for (let i = 0; i < n; i++) G[i] -= (S[2 * i] - px) * dir * tn;
    tilt += dir * th; cx = px + dir * a; h = hh;
  }
  return null;
}

// The obstacle holding up most of the contacts.
function holder(n, eps) {
  let best = null, most = 0;
  const count = new Map();
  for (let i = 0; i < n; i++) if (G[i] <= eps) { const c = (count.get(O[i]) || 0) + 1; count.set(O[i], c); if (c > most) { most = c; best = O[i]; } }
  return best;
}

// The widest run of sideways shifts at which pose C stays where it lands on pose P (standing on the ground),
// with P still standing under it. Stops looking once a run is `enough` wide.
export function pairFit(P, C, enough = Infinity) {
  const step = Math.max(C.w * .02, .02), margin = C.w * .02, M = P.mass + C.mass;
  const k0 = P.b.x0 - C.b.x1, k1 = P.b.x1 - C.b.x0;
  let run = 0, best = null;
  for (let k = k0 + step / 2; k < k1; k += step) {
    const L = land(C, k, P.polys, LEVEL, margin);
    let ok = !!L;
    if (ok) {   // and P, carrying it, has to stay steady too
      const X = (P.mass * P.cx + C.mass * L.cx) / M, Y = (P.mass * P.cy + C.mass * (L.y + C.cy)) / M;
      const pm = Math.max((P.xb - P.xa) * .05, Y * TIP);
      ok = X > P.xa + pm && X < P.xb - pm;
    }
    if (!ok) { run = 0; continue; }
    run += step;
    if (!best || run > best.width) best = { width: run, k: k - (run - step) / 2, y: L.y, tilt: L.tilt };
    if (run >= enough) break;
  }
  return best;
}
// How wide a run of good spots a piece needs before it counts as having somewhere to go.
export const roomNeeded = C => Math.max(C.w * .06, .3);
// Poses that rest within 6° of square, and landings that tip no more than that: what the queue is promised on.
// A dining table on its side leans on the edge of its top at 11°, and a stack of those soon slopes.
const LEVEL = .105;

// The poses of piece C that have somewhere level to go on piece P when P stands in one of `poses`.
export function posesAfter(P, C, poses) {
  const PR = restPoses(P), CR = restPoses(C), out = new Set();
  const under = [...new Set(poses.filter(i => PR[i] && Math.abs(PR[i].tilt) <= LEVEL).map(i => PR[i].same))];
  for (const c of CR) {
    if (!c || c.same !== c.pose || Math.abs(c.tilt) > LEVEL) continue;
    const need = roomNeeded(c);
    for (const i of under) if (pairFit(PR[i], c, need)?.width >= need) { out.add(c.pose); break; }
  }
  for (const c of CR) if (c && out.has(c.same)) out.add(c.pose);
  return [...out].sort((a, b) => a - b);
}

// How steady the tower stands with a piece added: every piece under it, down to the ground, has to carry the load
// resting on it (itself and whatever it holds up) with that load's centre of mass over the span it stands on,
// with room to spare (see TIP). Returns the worst of those pieces' room as a share of what it needs: under 1
// it's not steady, under 0 it's going over. A piece the contacts say is already short of room (leaning on a
// chair back, say, which this doesn't count) only has to not be pushed further out.
// tower is one entry per piece, { m, cx, cy: its centre of mass, x0..x1 and y: the contacts it stands on,
// under: the index of the piece taking most of its weight, or -1 for the ground }; extra is the new piece.
export function steadiness(tower, extra) {
  const nodes = tower.concat([extra]), n = nodes.length, kids = nodes.map(() => []);
  const M = nodes.map(s => s.m), X = nodes.map(s => s.m * s.cx), Y = nodes.map(s => s.m * s.cy), seen = new Array(n).fill(false);
  nodes.forEach((s, i) => { if (s.under >= 0 && s.under < n - 1 && s.under !== i) kids[s.under].push(i); });
  const load = i => { if (seen[i]) return; seen[i] = true; for (const k of kids[i]) { load(k); M[i] += M[k]; X[i] += X[k]; Y[i] += Y[k]; } };
  const room = (s, cx, cy) => Math.min(cx - s.x0, s.x1 - cx) / Math.max((s.x1 - s.x0) * .05, (cy - s.y) * TIP, 1e-3);
  let worst = Infinity;
  for (let i = n - 1, hops = 0; i >= 0 && hops <= n; i = nodes[i].under, hops++) {
    load(i);
    const s = nodes[i];
    if (!(s.x1 >= s.x0)) continue;
    const after = room(s, X[i] / M[i], Y[i] / M[i]);
    if (i < n - 1) {
      const m0 = M[i] - extra.m, before = room(s, (X[i] - extra.m * extra.cx) / m0, (Y[i] - extra.m * extra.cy) / m0);
      if (before < 1) { worst = Math.min(worst, after >= before ? 1 : after - before + 1); continue; }
    }
    worst = Math.min(worst, after);
  }
  return worst;
}

// Where a piece in a pose could be let go over the tower (polys: the outlines of everything standing) and stay
// put on whatever it lands on: runs of positions for its origin, widest first ({ k: the middle, width, y: the
// height it lands at }). This only looks at the piece itself; whether the tower under it takes the extra weight
// is up to the physics.
export function spotsOn(p, pose, polys) {
  const R = restPoses(p)[pose];
  if (!R || !polys.length) return [];
  const b = polysBounds(polys), step = Math.max(R.w * .02, .02), margin = R.w * .02, runs = [];
  let cur = null;
  for (let k = b.x0 - R.b.x1 + step / 2; k < b.x1 - R.b.x0; k += step) {
    const L = land(R, k, polys, .14, margin);
    if (!L) { cur = null; continue; }
    if (cur) { cur.k1 = k; cur.y = Math.max(cur.y, L.y); } else runs.push(cur = { k0: k, k1: k, y: L.y });
  }
  for (const r of runs) { r.k = (r.k0 + r.k1) / 2; r.width = r.k1 - r.k0 + step; }
  return runs.sort((a, b) => b.width - a.width);
}

// For ?auto and the preview picture: the pose and spot to let a piece go at. It goes for a steady tower that
// stays over the bottom table, room to spare, a level landing and somewhere good left for the piece after it. polys are the tower's outlines, each
// tagged with .owner, its piece's index in tower (see steadiness).
export function choosePlacement(p, polys, next, tower) {
  const found = [], b0 = tower?.[0], mid = b0 ? (b0.x0 + b0.x1) / 2 : 0, half = b0 ? Math.max(1, (b0.x1 - b0.x0) / 2) : 8;
  for (const R of restPoses(p)) {
    if (!R || R.same !== R.pose) continue;
    for (const run of spotsOn(p, R.pose, polys).slice(0, 3)) {
      let best = null;
      for (let i = 0; i <= 6; i++) {
        const k = run.k + (i / 6 - .5) * run.width * .7, L = land(R, k, polys, .14, R.w * .02);
        if (!L) continue;
        const steady = tower ? steadiness(tower, { m: R.mass, cx: L.cx, cy: L.y + R.cy, x0: L.x0, x1: L.x1, y: L.y, under: L.on?.owner ?? -1 }) : 2;
        const score = Math.min(steady, 3) * .4 + Math.min(run.width / R.w, .6) * 1.5 - Math.abs(i / 6 - .5) * .1
          + (R.pose === 0 || R.pose === 4 ? .1 : 0) - Math.abs(R.tilt + L.tilt) * 4 - Math.abs(L.cx - mid) / half * .4;
        if (steady > 0 && (!best || score > best.score)) best = { pose: R.pose, k, y: L.y, width: run.width, steady, score, R };
      }
      if (best) found.push(best);
    }
  }
  found.sort((a, b) => b.score - a.score);
  if (next) for (const f of found.slice(0, 4)) {   // and what that leaves for the next piece
    const after = polys.concat(f.R.polys.map(q => q.map(([x, y]) => [x + f.k, y + f.y])));
    let room = 0;
    for (const N of restPoses(next)) if (N && N.same === N.pose) { const s = spotsOn(next, N.pose, after)[0]; if (s) room = Math.max(room, s.width / N.w); }
    f.score += Math.min(room, .6);
  }
  found.sort((a, b) => b.score - a.score);
  return found[0] || null;
}
