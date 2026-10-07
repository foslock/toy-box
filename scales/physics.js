// Scales: the physics. Round produce on a long plank balanced on a hay bale: circles that roll and spin, a plank that
// turns about one pivot against the give of the bale, and a small sequential-impulse solver (substeps, warm starting,
// rolling resistance) that lets them stack. World units are roughly pixels at desktop size, y points down, and the
// pivot (the middle of the plank's underside) is the origin. No DOM, so balance.mjs can run it in Node.
import { PRODUCE, TOP } from './produce.js';

export const G = 1500;
export const STEP = 1 / 60;
const SUB = 4, H = STEP / SUB, ITER = 10;
const SETTLE = 9, SLOP = 0.5, BETA = 0.2, MAX_PUSH = 160, REST = 0.06, REST_MIN = 260;
const DENSITY = 0.01, GROW = 70, FRUIT_ROLL = 3;   // produce on produce is lumpier than produce on a plank          // merged produce swells to its new size at this many units a second
export const FALL_MAX = 520;               // produce tips out of the pan; it doesn't fall like a stone
// h: the pivot's height above the ground; a batten (lip × lipW) is nailed across each end
export const PLANK = { T: 15, M: 26, k: 5e7, zeta: 0.9, mu: 0.75, h: 74, lip: 24, lipW: 10 };
export const massOf = r => DENSITY * r * r;
const F = 0, P = 1, GR = 2;               // contact kinds: fruit on fruit, on the plank, on the ground

export class World {
  constructor(L = 540) {
    this.bodies = []; this.id = 1;
    this.plank = { L, T: PLANK.T, th: 0, om: 0, I: 1, max: 0.3, k: PLANK.k, zeta: PLANK.zeta, lim: 0, limL: 0, squash: 0 };
    this.setLength(L);
    this.groundY = PLANK.h;
    this.wind = 0;             // sideways push on a crab apple, units/s²; bigger things feel less of it
    this.extra = null;         // a weight standing on the plank (the crow): { s, m }
    this.cache = new Map(); this.events = []; this.contacts = [];
  }
  setLength(L) {
    const p = this.plank; p.L = L; p.I = PLANK.M * L * L / 12;
    p.max = Math.asin(Math.min(0.95, PLANK.h / (L / 2)));   // tipped this far, an end rests on the ground
  }
  add(tier, x, y, r = PRODUCE[tier].r) {
    const d = PRODUCE[tier];
    const b = { id: this.id++, tier, r: 0, rT: d.r, m: 0, I: 0, x, y, vx: 0, vy: 0, a: (this.id * 2.39996) % (Math.PI * 2), w: 0,
      mu: d.mu, roll: d.roll, age: 0, dead: false, onPlank: false, onGround: false, sq: 0, sqa: 0, born: 0 };
    this.setR(b, r);
    this.bodies.push(b);
    return b;
  }
  setR(b, r) { b.r = r; b.m = massOf(r); b.I = 0.5 * b.m * r * r; }
  // plank-local coordinates of a point: s along the plank from the pivot, h up from its underside
  local(x, y) { const c = Math.cos(this.plank.th), s = Math.sin(this.plank.th); return [x * c + y * s, x * s - y * c]; }
  atPlank(s, h) { const c = Math.cos(this.plank.th), sn = Math.sin(this.plank.th); return [s * c + h * sn, s * sn - h * c]; }
  // the turning effect of everything resting on the plank right now (weight × lever), for the spirit level and the bot
  torque() {
    let t = 0;
    for (const b of this.bodies) if (!b.dead && !b.onGround && Math.abs(b.x) < this.plank.L / 2 + b.r) t += b.m * b.x;
    if (this.extra) t += this.extra.m * this.extra.s;
    return t;
  }

  tick() { for (let i = 0; i < SUB; i++) this.sub(H); }

  sub(h) {
    const bs = this.bodies, pk = this.plank;
    for (const b of bs) {
      b.age += h;
      if (b.r < b.rT) this.setR(b, Math.min(b.rT, b.r + GROW * h));
      b.vy = Math.min(FALL_MAX, b.vy + G * h);
      if (this.wind && !b.onGround) b.vx += this.wind * (13 / b.r) * h;
      b.w *= 1 - 0.3 * h;
      if (b.sq > 0) b.sq = Math.max(0, b.sq - h * 2.2);
    }
    // the bale pushes back on a tilted plank and soaks up its swing; the damping is set for whatever it carries
    let load = 0;
    for (const b of bs) if (!b.onGround && Math.abs(b.x) < pk.L / 2 + 20) load += b.m * b.x * b.x;
    const c = 2 * pk.zeta * Math.sqrt(pk.k * (pk.I + load));
    let tau = -pk.k * pk.th;
    if (this.extra) tau += this.extra.m * G * this.extra.s * Math.cos(pk.th);
    pk.om = (pk.om + h * tau / pk.I) / (1 + h * c / pk.I);

    const cs = this.collide(h);
    // the end of the plank on the ground
    pk.lim = pk.th > pk.max - 0.002 ? 1 : pk.th < -pk.max + 0.002 ? -1 : 0;
    if (pk.lim && pk.lim !== pk.limWas && Math.abs(pk.om) > 0.25) this.events.push({ type: 'bump', v: Math.abs(pk.om), side: pk.lim });
    pk.limWas = pk.lim; pk.limL = 0;
    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < cs.length; i++) solve(cs[i], pk);
      if (pk.lim) {
        const v = pk.om * pk.lim, bias = (pk.max - pk.th * pk.lim) / h * 0.3;
        const dl = -(v - bias) * pk.I, nl = Math.min(0, pk.limL + dl);
        pk.om += (nl - pk.limL) / pk.I * pk.lim; pk.limL = nl;
      }
    }
    for (const b of bs) {
      // produce tipped out of the pan lands with a thud: whatever it hits first, it doesn't skid off sideways
      if (b.fresh && b.touch) { b.fresh = false; b.vx *= 0.15; b.w *= 0.2; }
      // nearly still and touching something: settle, so a heap stops creeping
      if (b.touch && b.vx * b.vx + b.vy * b.vy < SETTLE * SETTLE) { const k = 1 - 10 * h; b.vx *= k; b.vy *= k; b.w *= k; }
      b.x += b.vx * h; b.y += b.vy * h; b.a += b.w * h;
    }
    pk.th += pk.om * h;
    if (pk.th > pk.max + 0.01) { pk.th = pk.max + 0.01; if (pk.om > 0) pk.om = 0; }
    if (pk.th < -pk.max - 0.01) { pk.th = -pk.max - 0.01; if (pk.om < 0) pk.om = 0; }
    // keep the impulses for next time (warm starting), then merge any two of a kind that touched
    const cache = this.cache; cache.clear();
    for (const k of cs) cache.set(k.key, k);
    this.merge(cs);
  }

  collide(h) {
    const bs = this.bodies, pk = this.plank, cs = this.contacts; cs.length = 0;
    const co = Math.cos(pk.th), sn = Math.sin(pk.th), half = pk.L / 2, T = pk.T;
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i]; a.onPlank = false; a.onGround = false; a.touch = false;
    }
    for (let i = 0; i < bs.length; i++) {
      const a = bs[i];
      // the plank and its two battens: boxes in the plank's own frame (s along it, h up from its underside)
      const s = a.x * co + a.y * sn, hh = a.x * sn - a.y * co;
      if (s > -half - a.r && s < half + a.r && hh > -a.r && hh < T + PLANK.lip + a.r) {
        for (let k = 0; k < 3; k++) {
          const s0 = k === 0 ? -half : k === 1 ? -half : half - PLANK.lipW, s1 = k === 0 ? half : k === 1 ? -half + PLANK.lipW : half;
          const h0 = k === 0 ? 0 : T, h1 = k === 0 ? T : T + PLANK.lip;
          if (s < s0 - a.r || s > s1 + a.r || hh < h0 - a.r || hh > h1 + a.r) continue;
          const cs_ = Math.max(s0, Math.min(s1, s)), ch = Math.max(h0, Math.min(h1, hh));
          let ds = s - cs_, dh = hh - ch, d = Math.hypot(ds, dh), pen, nS, nH;
          if (d > 1e-6) { pen = a.r - d; nS = ds / d; nH = dh / d; }
          else {   // centre inside: out through the nearest face
            const up = h1 - hh, dn = hh - h0, lf = s - s0, rt = s1 - s, m = Math.min(up, dn, lf, rt);
            if (m === up) { nS = 0; nH = 1; } else if (m === dn) { nS = 0; nH = -1; } else if (m === lf) { nS = -1; nH = 0; } else { nS = 1; nH = 0; }
            pen = a.r + m;
          }
          if (pen <= 0) continue;
          const nx = nS * co + nH * sn, ny = nS * sn - nH * co, px = cs_ * co + ch * sn, py = cs_ * sn - ch * co;
          cs.push(this.contact(a, null, P, nx, ny, px, py, pen, h, k));
          if (nH > 0.5) a.onPlank = true;
        }
      }
      // the ground
      if (a.y + a.r > this.groundY) { cs.push(this.contact(a, null, GR, 0, -1, a.x, this.groundY, a.y + a.r - this.groundY, h)); a.onGround = true; }
      for (let j = i + 1; j < bs.length; j++) {
        const b = bs[j], dx = a.x - b.x, dy = a.y - b.y, R = a.r + b.r;
        if (dx > R || dx < -R || dy > R || dy < -R) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2) || 1e-6, nx = d2 ? dx / d : 0, ny = d2 ? dy / d : -1;
        cs.push(this.contact(a, b, F, nx, ny, b.x + nx * b.r, b.y + ny * b.r, R - d, h));
      }
    }
    // lowest first: weight passes up a stack more cleanly that way
    cs.sort((p, q) => q.py - p.py);
    return cs;
  }

  // one contact, normal (nx, ny) pointing from the other thing toward a, with its impulse warm-started from last step
  contact(a, b, kind, nx, ny, px, py, pen, h, part = 0) {
    const pk = this.plank;
    const rax = px - a.x, ray = py - a.y;
    let rbx = 0, rby = 0;
    if (kind === F) { rbx = px - b.x; rby = py - b.y; } else if (kind === P) { rbx = px; rby = py; }
    const tx = -ny, ty = nx;
    const ran = rax * ny - ray * nx, rat = rax * ty - ray * tx, rbn = rbx * ny - rby * nx, rbt = rbx * ty - rby * tx;
    let kn = 1 / a.m + ran * ran / a.I, kt = 1 / a.m + rat * rat / a.I, kr = 1 / a.I;
    if (kind === F) { kn += 1 / b.m + rbn * rbn / b.I; kt += 1 / b.m + rbt * rbt / b.I; kr += 1 / b.I; }
    else if (kind === P) { kn += rbn * rbn / pk.I; kt += rbt * rbt / pk.I; kr += 1 / pk.I; }
    const key = kind === F ? a.id * 100003 + b.id : kind === P ? -a.id * 4 - part : -a.id - 5e7;
    a.touch = true; if (b) b.touch = true;
    const c = { a, b, kind, nx, ny, tx, ty, px, py, pen, rax, ray, rbx, rby, mn: 1 / kn, mt: 1 / kt, mr: 1 / kr, key,
      mu: kind === F ? Math.sqrt(a.mu * b.mu) : kind === P ? Math.sqrt(a.mu * PLANK.mu) : 0.8,
      roll: (kind === F ? (a.roll + b.roll) * FRUIT_ROLL : kind === P ? a.roll : 0.3) * a.r, ln: 0, lt: 0, lr: 0, bias: 0 };
    const vn = relN(c, pk);
    // something still swelling after a merge eases its neighbours aside rather than shoving them
    const growing = a.r < a.rT || (b && b.r < b.rT);
    c.bias = Math.min(growing ? 45 : MAX_PUSH, BETA / h * Math.max(0, pen - SLOP));
    if (vn < -REST_MIN) c.bias = Math.max(c.bias, -REST * vn);
    const old = this.cache.get(key);
    if (old) { c.ln = old.ln * 0.95; c.lt = old.lt * 0.9; c.lr = old.lr * 0.9; apply(c, pk, c.ln * nx + c.lt * tx, c.ln * ny + c.lt * ty, c.lr); }
    else if (vn < -90) {
      // a fresh knock: the page plays it, and soft produce squashes a little and grips rather than skating off
      c.mu = Math.max(c.mu, 1.5);
      this.events.push({ type: 'hit', kind, v: -vn, tier: a.tier, other: b ? b.tier : -1, x: px, y: py });
      const sq = Math.min(0.22, -vn / 3200);
      if (sq > a.sq) { a.sq = sq; a.sqa = Math.atan2(ny, nx); }
      if (b && sq * 0.7 > b.sq) { b.sq = sq * 0.7; b.sqa = Math.atan2(ny, nx); }
    }
    return c;
  }

  merge(cs) {
    let any = false;
    for (const c of cs) {
      if (c.kind !== F) continue;
      const a = c.a, b = c.b;
      if (a.dead || b.dead || a.tier !== b.tier) continue;
      a.dead = b.dead = true; any = true;
      // one on top of the other: it sinks into the lower one; side by side: they meet in the middle
      const lo = a.y > b.y ? a : b, stacked = Math.abs(a.y - b.y) > a.r * 0.35;
      let x = stacked ? lo.x : (a.x + b.x) / 2, y = stacked ? lo.y : (a.y + b.y) / 2;
      if (a.tier === TOP) { this.events.push({ type: 'ribbon', x, y, a, b }); continue; }
      // keep the new piece inside the battens, so swelling to its new size doesn't shove it over the end
      const [ls, lh] = this.local(x, y), room = this.plank.L / 2 - PLANK.lipW - PRODUCE[a.tier + 1].r;
      if (Math.abs(ls) > room && lh > 0) [x, y] = this.atPlank(Math.sign(ls) * Math.max(0, room), lh);
      const n = this.add(a.tier + 1, x, y, Math.max(a.r, b.r));
      n.vx = stacked ? lo.vx : (a.vx + b.vx) / 2; n.vy = stacked ? lo.vy : (a.vy + b.vy) / 2; n.born = 1;
      const sp = Math.hypot(n.vx, n.vy); if (sp > 80) { n.vx *= 80 / sp; n.vy *= 80 / sp; }
      this.events.push({ type: 'merge', tier: n.tier, x, y, body: n, a, b });
    }
    if (any) this.bodies = this.bodies.filter(b => !b.dead);
  }
  // a copy to try things in (the bot looks ahead with these)
  clone() {
    const w = new World(this.plank.L), map = new Map();
    w.id = this.id; w.wind = this.wind; w.extra = this.extra && { ...this.extra }; Object.assign(w.plank, this.plank);
    w.bodies = this.bodies.map(b => { const c = { ...b }; map.set(b, c); return c; });
    for (const [k, c] of this.cache) w.cache.set(k, { ln: c.ln, lt: c.lt, lr: c.lr });
    return w;
  }
  remove(b) { b.dead = true; this.bodies = this.bodies.filter(q => q !== b); }
  drain() { const e = this.events; this.events = []; return e; }
}

function relN(c, pk) {
  const a = c.a, b = c.b;
  let vx = a.vx - a.w * c.ray, vy = a.vy + a.w * c.rax;
  if (c.kind === F) { vx -= b.vx - b.w * c.rby; vy -= b.vy + b.w * c.rbx; }
  else if (c.kind === P) { vx -= -pk.om * c.rby; vy -= pk.om * c.rbx; }
  return vx * c.nx + vy * c.ny;
}
function apply(c, pk, px, py, lr) {
  const a = c.a, b = c.b;
  a.vx += px / a.m; a.vy += py / a.m; a.w += (c.rax * py - c.ray * px) / a.I + lr / a.I;
  if (c.kind === F) { b.vx -= px / b.m; b.vy -= py / b.m; b.w -= (c.rbx * py - c.rby * px) / b.I + lr / b.I; }
  else if (c.kind === P) pk.om -= (c.rbx * py - c.rby * px) / pk.I + lr / pk.I;
}
function solve(c, pk) {
  const a = c.a, b = c.b;
  let vx = a.vx - a.w * c.ray, vy = a.vy + a.w * c.rax, wb = 0;
  if (c.kind === F) { vx -= b.vx - b.w * c.rby; vy -= b.vy + b.w * c.rbx; wb = b.w; }
  else if (c.kind === P) { vx -= -pk.om * c.rby; vy -= pk.om * c.rbx; wb = pk.om; }
  // push apart
  const vn = vx * c.nx + vy * c.ny;
  let nl = Math.max(0, c.ln + c.mn * (c.bias - vn)), d = nl - c.ln; c.ln = nl;
  if (d) apply(c, pk, d * c.nx, d * c.ny, 0);
  // friction along the surface
  vx = a.vx - a.w * c.ray; vy = a.vy + a.w * c.rax;
  if (c.kind === F) { vx -= b.vx - b.w * c.rby; vy -= b.vy + b.w * c.rbx; }
  else if (c.kind === P) { vx -= -pk.om * c.rby; vy -= pk.om * c.rbx; }
  const vt = vx * c.tx + vy * c.ty, ft = c.mu * c.ln;
  nl = Math.max(-ft, Math.min(ft, c.lt - c.mt * vt)); d = nl - c.lt; c.lt = nl;
  if (d) apply(c, pk, d * c.tx, d * c.ty, 0);
  // rolling resistance: a lopsided squash doesn't roll the way a crab apple does
  if (c.kind === F) wb = b.w; else if (c.kind === P) wb = pk.om; else wb = 0;
  const wr = a.w - wb, fr = c.roll * c.ln;
  nl = Math.max(-fr, Math.min(fr, c.lr - c.mr * wr)); d = nl - c.lr; c.lr = nl;
  if (d) apply(c, pk, 0, 0, d);
}
