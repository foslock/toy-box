// Tables and chairs as the physics sees them: flat, side-on outlines made of convex parts, in decimetres
// (1 unit = 10 cm), standing on y = 0 and centred on x = 0. Chairs face +x, so their back is on the left.
// Nothing here touches three.js, so the sizing rules can be tried out in Node.
//
// Each piece comes at its own size, bigger or smaller than the one before, but never without somewhere to go:
// see nextPiece.
import { posesAfter, restPoses } from './fit.js';

export const BASE_F = 14.5;        // leg span of the bottom table (about a 1.6 m dining table)
const MIN_F = 2;                   // nothing comes smaller than about 20 cm

const U = (R, a, b) => a + (b - a) * R();
const pick = (R, arr) => arr[R() * arr.length | 0];
export function mulberry(a) {
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// A box with centre (cx, cy), half-sizes (hw, hh), turned a radians anticlockwise.
function rect(cx, cy, hw, hh, a = 0) {
  const c = Math.cos(a), s = Math.sin(a);
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}
// A leg from y0 to y1: bottom centre xb and width wb, top centre xt and width wt.
function leg(xb, xt, wb, wt, y0, y1) {
  return [[xb - wb / 2, y0], [xb + wb / 2, y0], [xt + wt / 2, y1], [xt - wt / 2, y1]];
}
// dz is how deep the part is front to back (both legs of a pair, the whole width of a top): mass goes with it.
const part = (v, dz, heavy = 1) => ({ v, dz: dz * heavy });

const TYPES = {
  dining: { kind: 'table', name: 'Dining table', size: 1, make(F, R) {
    const ov = F * U(R, .04, .09), W = F + 2 * ov, H = W * U(R, .42, .5), t = W * U(R, .026, .038);
    const style = pick(R, ['square', 'taper', 'round', 'turned']);
    const lw = F * U(R, .05, .068), lwb = style === 'square' ? lw : lw * U(R, .62, .9);
    const D = W * U(R, .5, .6), ovz = ov * U(R, .6, 1.2), ap = H * U(R, .1, .15), at = lw * .32;
    return table({ W, H, D, t, lw, lwb, lx: F / 2 - lw / 2, lz: D / 2 - ovz - lw / 2, ap, at, style });
  } },
  coffee: { kind: 'table', name: 'Coffee table', size: 1, make(F, R) {
    const ov = F * U(R, .03, .08), W = F + 2 * ov, H = W * U(R, .26, .34), t = W * U(R, .035, .05);
    const style = pick(R, ['square', 'taper', 'round']);
    const lw = F * U(R, .06, .09), lwb = style === 'square' ? lw : lw * U(R, .65, .9);
    const D = W * U(R, .5, .65), ovz = ov * U(R, .6, 1.2), ap = H * U(R, .1, .16), at = lw * .3;
    const shelf = R() < .6 ? H * U(R, .18, .3) : 0;
    return table({ W, H, D, t, lw, lwb, lx: F / 2 - lw / 2, lz: D / 2 - ovz - lw / 2, ap, at, style, shelf });
  } },
  side: { kind: 'table', name: 'Side table', size: .72, make(F, R) {
    const ov = F * U(R, .03, .08), W = F + 2 * ov, H = W * U(R, .85, 1.05), t = W * U(R, .035, .05);
    const style = pick(R, ['square', 'taper', 'round', 'turned']);
    const lw = F * U(R, .06, .08), lwb = style === 'square' ? lw : lw * U(R, .65, .9);
    const D = W * U(R, .85, 1), ovz = ov * U(R, .8, 1.1), ap = H * U(R, .08, .12), at = lw * .3;
    return table({ W, H, D, t, lw, lwb, lx: F / 2 - lw / 2, lz: D / 2 - ovz - lw / 2, ap, at, style, shelf: H * U(R, .22, .38) });
  } },
  bistro: { kind: 'table', name: 'Bistro table', size: .6, make(F, R) {
    // one iron column on a heavy iron foot; the top is much wider than the foot
    const W = F * U(R, 1.35, 1.6), H = W * U(R, .95, 1.1), t = W * U(R, .035, .05);
    const cw = W * U(R, .07, .09), fh = F * U(R, .05, .08), round = R() < .7, foot = R() < .55 ? 'cross' : 'disc';
    const parts = [
      part(rect(0, H - t / 2, W / 2, t / 2), round ? W * .785 : W),
      part(rect(0, (fh + H - t) / 2, cw / 2, (H - t - fh) / 2), cw, 3),
      part(rect(0, fh / 2, F / 2, fh / 2), foot === 'disc' ? F * .785 : fh * 3, 3),
    ];
    return { W, H, D: W, parts, dims: { W, H, t, cw, fh, F, round, foot } };
  } },
  desk: { kind: 'table', name: 'Writing desk', size: .95, make(F, R) {
    // drawers down one side, a pair of legs on the other: it's heavier on the drawer side
    const ov = F * U(R, .015, .04), W = F + 2 * ov, H = W * U(R, .44, .52), t = W * U(R, .025, .035);
    const D = W * U(R, .48, .58), pw = F * U(R, .3, .38), lw = F * U(R, .045, .06), ap = H * U(R, .1, .13), at = lw * .35;
    const lx = F / 2 - lw / 2, px = -F / 2 + pw / 2, hb = H - t;
    const parts = [
      part(rect(0, H - t / 2, W / 2, t / 2), D),
      part(rect(px, hb / 2, pw / 2, hb / 2), D * .5),
      part(leg(lx, lx, lw * .8, lw, 0, hb), 2 * lw),
      part(rect((-F / 2 + pw + lx) / 2, hb - ap / 2, (lx - (-F / 2 + pw)) / 2, ap / 2), 2 * at),
    ];
    return { W, H, D, parts, dims: { W, H, D, t, pw, lw, lx, px, ap, at, lz: D / 2 - ov - lw / 2, F, drawers: 2 + (R() * 2 | 0) } };
  } },
  nightstand: { kind: 'table', name: 'Nightstand', size: .7, make(F, R) {
    const ov = F * U(R, .02, .06), W = F + 2 * ov, H = W * U(R, 1, 1.25), t = W * U(R, .04, .055);
    const D = W * U(R, .8, .95), legH = H * U(R, .12, .22), lw = F * U(R, .07, .09), lx = F / 2 - lw / 2;
    const parts = [
      part(rect(0, H - t / 2, W / 2, t / 2), D),
      part(rect(0, (legH + H - t) / 2, F / 2, (H - t - legH) / 2), D * .4),
      part(leg(-lx, -lx, lw * .7, lw, 0, legH + t), 2 * lw),
      part(leg(lx, lx, lw * .7, lw, 0, legH + t), 2 * lw),
    ];
    return { W, H, D, parts, dims: { W, H, D, t, legH, lw, lx, F, lz: D * .46 - lw / 2, open: R() < .6 } };
  } },
  chair: { kind: 'chair', name: 'Chair', size: .78, make(F, R) {
    const lw = F * U(R, .07, .09);
    return chair(F, R, { lw, BH: F * U(R, .8, 1.08), rake: U(R, .06, .14), back: pick(R, ['slats', 'spindles', 'panel']),
      style: pick(R, ['square', 'taper', 'round']), cushion: R() < .4 ? F * U(R, .06, .08) : 0, rush: false });
  } },
  ladder: { kind: 'chair', name: 'Ladder-back chair', size: .7, make(F, R) {
    const lw = F * U(R, .075, .09);
    return chair(F, R, { lw, BH: F * U(R, 1.3, 1.65), rake: U(R, .03, .08), back: 'ladder', style: 'turned', cushion: 0, rush: true, rungs: 3 + (R() * 2 | 0) });
  } },
  stool: { kind: 'chair', name: 'Stool', size: .7, make(F, R) {
    const SW = F * U(R, 1, 1.12), SH = F * U(R, .85, 1.1), st = F * U(R, .07, .1);
    const lw = F * U(R, .07, .09), lwb = lw * U(R, .75, 1), splay = F * U(R, 0, .06), round = R() < .55;
    const xb = F / 2 - lwb / 2, xt = xb - splay, ry = SH * .3, rx = xb - splay * .3;
    const parts = [
      part(rect(0, SH - st / 2, SW / 2, st / 2), round ? SW * .785 : SW),
      part(leg(-xb, -xt, lwb, lw, 0, SH - st), 2 * lw),
      part(leg(xb, xt, lwb, lw, 0, SH - st), 2 * lw),
      part(rect(0, ry, rx, lw * .3), lw),
    ];
    return { W: SW, H: SH, D: SW, parts, dims: { SW, SH, st, lw, lwb, xb, xt, splay, round, ry, F, style: pick(R, ['round', 'taper']) } };
  } },
  barstool: { kind: 'chair', name: 'Bar stool', size: .68, make(F, R) {
    // tall, splayed legs, and a seat narrower than its feet
    const SW = F * U(R, .82, .96), SH = F * U(R, 1.45, 1.75), st = F * U(R, .08, .1), lw = F * U(R, .06, .075);
    const splay = F * U(R, .1, .16), xb = F / 2 - lw / 2, xt = xb - splay, ry = SH * .33, rx = xb - splay * .33;
    const parts = [
      part(rect(0, SH - st / 2, SW / 2, st / 2), SW * .785),
      part(leg(-xb, -xt, lw, lw, 0, SH - st), 2 * lw),
      part(leg(xb, xt, lw, lw, 0, SH - st), 2 * lw),
      part(rect(0, ry, rx + lw * .3, lw * .3), lw * 2, 2),
    ];
    return { W: SW, H: SH, D: SW, parts, dims: { SW, SH, st, lw, xb, xt, splay, ry, rx, F, cushion: R() < .5, metal: R() < .5 } };
  } },
};

// Four-legged tables: a top, an apron under it, a leg pair at each end and sometimes a shelf.
function table(d) {
  const { W, H, D, t, lw, lwb, lx, ap, at, shelf } = d;
  const parts = [
    part(rect(0, H - t / 2, W / 2, t / 2), D),
    part(rect(0, H - t - ap / 2, lx, ap / 2), 2 * at),
    part(leg(-lx, -lx, lwb, lw, 0, H - t), 2 * lw),
    part(leg(lx, lx, lwb, lw, 0, H - t), 2 * lw),
  ];
  if (shelf) { d.st = t * .8; parts.push(part(rect(0, shelf, lx, d.st / 2), D * .8)); }
  return { W, H, D, parts, dims: d };
}

// Chairs, side on: seat, a front leg, a back leg, and the back post leaning away from the seat.
function chair(F, R, o) {
  const SH = F * U(R, .95, 1.08), st = F * U(R, .07, .09), lw = o.lw, lwb = lw * U(R, .74, 1), pw = lw * U(R, 1, 1.2);
  const fo = F * U(R, .02, .05), Dz = F * U(R, .85, 1), { BH, rake, cushion } = o;
  const sx0 = -F / 2, sx1 = F / 2 + fo, bx = -F / 2 + pw / 2, by = SH - st, L = st + cushion + BH;
  const parts = [
    part(rect((sx0 + sx1) / 2, SH - st / 2, (sx1 - sx0) / 2, st / 2), Dz),
    part(leg(F / 2 - lw / 2, F / 2 - lw / 2, lwb, lw, 0, by), 2 * lw),
    part(leg(bx, bx, pw * lwb / lw, pw, 0, by), 2 * pw),
    part(rect(bx - Math.sin(rake) * L / 2, by + Math.cos(rake) * L / 2, pw / 2, L / 2, rake), 2 * pw + Dz * .18),
  ];
  if (cushion) parts.push(part(rect((-F / 2 + pw + sx1) / 2, SH + cushion / 2, (sx1 - (-F / 2 + pw)) / 2, cushion / 2), Dz * .25));
  const W = sx1 + Math.sin(rake) * L + F / 2;
  return { W, H: by + Math.cos(rake) * L, D: Dz, parts, dims: { F, SH, st, lw, lwb, pw, fo, Dz, BH, rake, cushion, L, bx, by, sx0, sx1, back: o.back, style: o.style, rush: o.rush, rungs: o.rungs } };
}

// Builds one piece. The same seed always gives the same proportions, so a piece can be rebuilt smaller.
export function makePiece(type, F, seed) {
  const T = TYPES[type], R = mulberry(seed);
  const p = T.make(F, R);
  Object.assign(p, { type, kind: T.kind, name: T.name, F, seed });
  let minX = Infinity, maxX = -Infinity, maxY = 0;
  for (const q of p.parts) for (const [x, y] of q.v) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  return Object.assign(p, { minX, maxX, maxY });
}

const TABLE_TYPES = [['dining', 3], ['coffee', 2], ['side', 2], ['bistro', 1.4], ['desk', 1.4], ['nightstand', 1.5]];
const CHAIR_TYPES = [['chair', 3], ['ladder', 2], ['stool', 2], ['barstool', 1.4]];
function weighted(R, list, avoid) {
  const l = list.filter(([t]) => t !== avoid), total = l.reduce((s, [, w]) => s + w, 0);
  let r = R() * total;
  for (const [t, w] of l) if ((r -= w) <= 0) return t;
  return l[l.length - 1][0];
}

export function basePiece(R) {
  const p = makePiece('dining', BASE_F, R() * 2 ** 31 | 0);
  return Object.assign(p, { n: 0, fits: [0] });
}

// The size a piece n up from the bottom tends to be, as a share of the bottom table's: it drifts down slowly.
const typicalAt = n => .32 + .68 * Math.pow(.965, n);
const gauss = R => Math.sqrt(-2 * Math.log(1 - R())) * Math.cos(2 * Math.PI * R());

// The next piece in the queue, given the one before it. Its size is its own, drawn around the typical size, so
// it can come a good deal bigger than the last piece as well as smaller. It only has to have somewhere to go:
// some pose of it (turned, flipped, upright) has to stand on the piece before it, in a pose that piece can take
// on the one before it, and so on down. So the queue can always be stacked if each piece goes down the right
// way up, which isn't always upright. A piece too big for anything is tried again smaller, and so is one more
// than two and a half times as wide or eight times as heavy as the piece it goes on: those only ever balance on
// a knife edge.
export function nextPiece(prev, recent, R) {
  const n = prev.n + 1;
  const chairsInARow = recent.slice(-2).filter(p => p.kind === 'chair').length;
  const kind = chairsInARow >= 2 ? 'table' : R() < .44 ? 'chair' : 'table';
  const type = weighted(R, kind === 'table' ? TABLE_TYPES : CHAIR_TYPES, prev.type);
  const seed = R() * 2 ** 31 | 0, typical = BASE_F * TYPES[type].size * typicalAt(n);
  let F = typical * Math.exp(Math.max(-1, Math.min(.75, gauss(R) * .42))), p;
  const heaviest = restPoses(prev).find(Boolean).mass * 8, widest = (prev.maxX - prev.minX) * 2.5;
  for (let i = 0; i < 16; i++, F *= .9) {
    p = makePiece(type, Math.max(MIN_F, F), seed);
    if (F > MIN_F && (p.maxX - p.minX > widest || restPoses(p).find(Boolean).mass > heaviest)) continue;
    p.fits = posesAfter(prev, p, prev.fits);
    if (p.fits.length || F <= MIN_F) break;
  }
  if (!p.fits.length) p.fits = restPoses(p).filter(Boolean).map(r => r.pose);   // never seen, but don't strand the rest of the queue
  p.n = n;
  return p;
}
