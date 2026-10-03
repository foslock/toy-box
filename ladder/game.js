// Ladder: the rules. The painter walks, leans the ladder, climbs it, steps off at the top and hauls it up; the ladder
// is physical (physics.js) while anyone is on it, and a fall ties the painter to it by one arm until it all stops.
// No page in here: main.js drives it and render.js draws it, and the checks run it headless.
import { Sim, LADDER, PAINTER, ladderEnds, riderPoint, groundAt, capsuleHits, circleHits, rayCast } from './physics.js';

export const TICK = 1 / 60;
const SUB = 4, H = TICK / SUB;
const WALK = 1.45, STEP_UP = 0.42, STEP_DOWN = 0.7;
const CLIMB_MAX = 2.6, CLIMB_GAIN = 6, LEAD = 1.2, S_MAX = LADDER.L - 0.55, ROCK = 0.34, ROCK_FREE = 0.6;
const D2R = Math.PI / 180, LOW = 4 * D2R;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angTo = (a, b, k) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * k;

export class Game {
  constructor(heap) {
    this.heap = heap; this.world = heap.world; this.sim = new Sim(this.world);
    this.events = []; this.hist = [];
    this.reset();
  }
  reset() {
    const s = this.heap.start;
    this.mode = 'stand'; this.t = 0; this.held = 'carry';
    this.p = { x: s.x, y: s.y, face: 1, edge: 0, walk: 0, shoulder: 0, stride: 0 };
    this.lad = { fx: s.x + 0.3, fy: s.y + 0.02, a: Math.PI / 2, vx: 0, vy: 0, w: 0 };
    this.rider = null; this.pb = null; this.rope = null; this.anim = null;
    this.sTarget = 0; this.walkTo = null; this.walkDir = 0; this.climbHold = 0; this.holdT = 0;
    this.aimA = Math.PI / 2; this.aimPose = null; this.strain = 0; this.slide = 0; this.downFor = 0; this.letGoT = 0;
    this.fall = null; this.won = false;
    this.best = s.y; this.falls = 0; this.climbed = 0; this.played = 0;
    this.carryPose(true);
  }
  ev(type, o = {}) { o.type = type; this.events.push(o); }
  drain() { const e = this.events; this.events = []; return e; }

  /* ------------------------------------------------------------------------------------------- where things are */
  feet() {
    if (this.mode === 'climb') { const c = Math.cos(this.lad.a), s = Math.sin(this.lad.a); return [this.lad.fx + c * this.rider.s, this.lad.fy + s * this.rider.s]; }
    if (this.mode === 'fall') return [this.pb.x, this.pb.y - PAINTER.r];
    if (this.mode === 'stepoff') { const a = this.anim, k = ease(Math.min(1, a.t / a.T)); return [a.x0 + (a.x1 - a.x0) * k, a.y0 + (a.y1 - a.y0) * k]; }
    return [this.p.x, this.p.y];
  }
  height() { return this.feet()[1]; }
  focus() { const [x, y] = this.feet(); return [x, y + 0.9]; }

  // where the ladder rests in the painter's hands: upright beside them, or on the shoulder while walking
  carryTarget() {
    const p = this.p, f = p.face, k = p.shoulder;
    const up = { fx: p.x + f * 0.3, fy: p.y + 0.03, a: Math.PI / 2 + f * 0.05 };
    const sh = { fx: p.x - f * 1.95, fy: p.y + 1.32, a: f > 0 ? 0.06 : Math.PI - 0.06 };
    return { fx: up.fx + (sh.fx - up.fx) * k, fy: up.fy + (sh.fy - up.fy) * k, a: up.a + (sh.a - up.a) * k };
  }
  carryPose(snap) {
    const t = this.carryTarget(), k = snap ? 1 : 1 - Math.exp(-TICK * 11);
    this.lad.fx += (t.fx - this.lad.fx) * k; this.lad.fy += (t.fy - this.lad.fy) * k; this.lad.a = angTo(this.lad.a, t.a, k);
    this.lad.vx = this.lad.vy = this.lad.w = 0;
  }

  /* ------------------------------------------------------------------------------------------- commands */
  // a tap on the world: walk there, pick the ladder back up, or hop off the edge you're standing at
  tap(x) {
    if (this.mode === 'aim') { this.mode = 'stand'; }
    if (this.mode !== 'stand') return;
    const dir = Math.sign(x - this.p.x);
    if (this.p.edge && dir === this.p.edge && Math.abs(x - this.p.x) > 0.35) return this.hop();
    if (this.held === 'planted') { this.held = 'carry'; this.ev('lift'); }
    // close beside your feet: one small shuffle that way, for fine placing; further off: walk there
    const d = Math.abs(x - this.p.x);
    if (d < 0.7) { if (d > 0.03) { this.walkTo = this.p.x + dir * Math.min(d, 0.1); this.p.face = dir; } }
    else { this.walkTo = x; this.p.face = dir || this.p.face; }
  }
  setWalk(dir) { this.walkDir = dir; if (dir && this.mode === 'stand') { if (this.held === 'planted') { this.held = 'carry'; this.ev('lift'); } this.walkTo = null; } }
  canAim() { return this.mode === 'stand' || this.mode === 'aim'; }
  aimStart() {
    if (!this.canAim()) return false;
    if (this.held === 'planted') { this.held = 'carry'; this.ev('lift'); }
    if (this.mode !== 'aim') { this.mode = 'aim'; this.walkTo = null; this.aimA = this.lad.a; this.aimPose = this.place(this.aimA); this.ev('raise'); }
    return true;
  }
  aimAt(x, y) {
    if (this.mode !== 'aim') return;
    const dx = x - this.p.x, dy = y - (this.p.y + 0.2);
    if (Math.hypot(dx, dy) < 0.5) return;
    this.aimA = clamp(Math.atan2(dy, dx), LOW, Math.PI - LOW);
    if (Math.abs(dx) > 0.05) this.p.face = Math.sign(dx);
    this.aimPose = this.place(this.aimA);
  }
  aimTurn(da) { if (this.mode !== 'aim') return; this.aimA = clamp(this.aimA + da, LOW, Math.PI - LOW); this.p.face = Math.cos(this.aimA) >= 0 ? 1 : -1; this.aimPose = this.place(this.aimA); }
  aimEnd() {
    if (this.mode !== 'aim') return null;
    this.mode = 'stand';
    const q = this.aimPose;
    if (q && q.ok) {
      Object.assign(this.lad, { fx: q.fx, fy: q.fy, a: q.a, vx: 0, vy: 0, w: 0 });
      this.held = 'planted'; this.planted = q; this.ev('plant', { P: q.P });
      return 'planted';
    }
    this.ev('nope'); return 'nothing';
  }
  aimCancel() { if (this.mode === 'aim') this.mode = 'stand'; }
  // move along the ladder (metres; positive is toward the top). From the foot of a planted ladder this starts the climb.
  climbBy(ds) {
    if (this.mode === 'stand' && this.held === 'planted' && ds > 0) this.mount();
    if (this.mode !== 'climb') return;
    this.sTarget = clamp(this.sTarget + ds, this.rider.s - LEAD, this.rider.s + LEAD);
  }
  setClimb(dir) { this.climbHold = dir; this.holdT = 0; if (dir > 0 && this.mode === 'stand' && this.held === 'planted') this.mount(); }
  mount() {
    const a = this.lad.a;
    this.mode = 'climb'; this.rider = { s: 0, side: Math.cos(a) >= 0 ? 1 : -1 }; this.sTarget = 0; this.letGoT = 0;
    this.lad.vx = this.lad.vy = this.lad.w = 0; this.sim.reset(); this.walkTo = null;
    this.hist.length = 0; this.ev('mount');
  }

  /* ------------------------------------------------------------------------------------------- placing the ladder */
  // Lift the ladder upright and lean it toward angle ta until it touches something. Returns the pose, and whether it rests on anything.
  place(ta) {
    const W = this.world, p = this.p, L = LADDER.L, r = LADDER.r, side = Math.cos(ta) >= 0 ? 1 : -1;
    let fx = p.x + side * 0.22, g = groundAt(W, fx, p.y + 0.25, p.y - 0.3);
    if (!g) { fx = p.x; g = groundAt(W, fx, p.y + 0.25, p.y - 0.3) || { y: p.y, ny: 1, P: null }; }
    const fy = g.y + (r + 0.004) / Math.max(0.5, g.ny);
    const hit = a => capsuleHits(W, fx, fy, fx + Math.cos(a) * L, fy + Math.sin(a) * L, r - 0.001);
    const pose = (a, P) => {
      const out = { fx, fy, a, ok: !!P, P, foot: g.P, t: 1 };
      if (P) out.t = touchAt(fx, fy, a, P);
      return out;
    };
    if (hit(Math.PI / 2)) {
      // something overhead: it can't go upright. If your aim is blocked, lean it as near the aim as fits;
      // if your aim is clear, let it down from there until it rests on something
      const away = Math.sign(ta - Math.PI / 2) || 1;
      if (hit(ta)) {
        for (let k = 1; k <= 90; k++) { const a = ta + (Math.PI / 2 - ta) * (k / 90); if (!hit(a)) { let lo = a, hi = ta + (Math.PI / 2 - ta) * ((k - 1) / 90), HP = hit(hi); for (let i = 0; i < 10; i++) { const m = (lo + hi) / 2, q = hit(m); if (q) { hi = m; HP = q; } else lo = m; } return pose(lo, HP); } }
        return null;
      }
      const end = away > 0 ? Math.PI - LOW : LOW;
      let prev = ta;
      for (let a = ta; away > 0 ? a <= end : a >= end; a += away * D2R) {
        const P = hit(a);
        if (P) { let lo = prev, hi = a, HP = P; for (let i = 0; i < 10; i++) { const m = (lo + hi) / 2, q = hit(m); if (q) { hi = m; HP = q; } else lo = m; } return pose(lo, HP); }
        prev = a;
      }
      return pose(ta, null);
    }
    const step = Math.sign(ta - Math.PI / 2) * D2R, n = Math.ceil(Math.abs(ta - Math.PI / 2) / D2R);
    let prev = Math.PI / 2;
    for (let k = 1; k <= n; k++) {
      const a = k === n ? ta : Math.PI / 2 + step * k, P = hit(a);
      if (P) {
        let lo = prev, hi = a, HP = P;
        for (let i = 0; i < 10; i++) { const m = (lo + hi) / 2, q = hit(m); if (q) { hi = m; HP = q; } else lo = m; }
        return pose(lo, HP);
      }
      prev = a;
    }
    return pose(ta, null);
  }

  /* ------------------------------------------------------------------------------------------- the tick */
  tick() {
    this.t += TICK;
    if (this.mode !== 'win') this.played += TICK;
    switch (this.mode) {
      case 'stand': this.tickStand(); break;
      case 'aim': this.tickAim(); break;
      case 'climb': this.tickClimb(); break;
      case 'fall': this.tickFall(); break;
      case 'stepoff': case 'haul': case 'down': case 'win': this.tickAnim(); break;
    }
    const h = this.height();
    if (this.fall) this.fall.min = Math.min(this.fall.min ?? h, h);
    this.hist.push(h); if (this.hist.length > 240) this.hist.shift();
  }

  tickStand() {
    const p = this.p, W = this.world;
    let dir = this.walkDir;
    if (!dir && this.walkTo != null) { const d = this.walkTo - p.x; if (Math.abs(d) < 0.005) this.walkTo = null; else dir = Math.sign(d); }
    let walked = false;
    if (dir && this.held === 'planted') { this.held = 'carry'; this.ev('lift'); }
    if (dir) {
      p.face = dir;
      let nx = p.x + dir * WALK * TICK;
      if (this.walkTo != null && (this.walkTo - nx) * dir < 0) nx = this.walkTo;
      const g = groundAt(W, nx, p.y + STEP_UP, p.y - STEP_DOWN);
      if (g && headroom(W, nx, g.y)) {
        if (p.edge !== dir) p.edge = 0;
        p.stride += Math.abs(nx - p.x); p.x = nx; p.y = g.y; p.on = g.P; walked = true;
        if (p.stride > 0.55) { p.stride = 0; this.ev('step', { P: g.P }); }
      } else {
        // a wall, or the edge of a drop
        const wall = circleHits(W, nx + dir * 0.1, p.y + 0.6, 0.2) || circleHits(W, nx, p.y + 0.25, 0.15);
        if (!wall && p.edge !== dir) { p.edge = dir; this.ev('edge'); }
        this.walkTo = null;
      }
    }
    p.walk = walked ? Math.min(1, p.walk + TICK * 6) : Math.max(0, p.walk - TICK * 5);
    if (this.held === 'carry') {
      p.shoulder = walked ? Math.min(1, p.shoulder + TICK * 3.2) : Math.max(0, p.shoulder - TICK * 2.6);
      this.carryPose();
    }
    if (this.heap.summit && this.held === 'carry' && inside(this.heap.summit, p.x, p.y)) this.win();
  }
  tickAim() {
    const p = this.p; p.shoulder = Math.max(0, p.shoulder - TICK * 5); p.walk = Math.max(0, p.walk - TICK * 6);
    const q = this.aimPose, k = 1 - Math.exp(-TICK * 16);
    const t = q || { fx: p.x + p.face * 0.22, fy: p.y + 0.06, a: this.aimA };
    this.lad.fx += (t.fx - this.lad.fx) * k; this.lad.fy += (t.fy - this.lad.fy) * k; this.lad.a = angTo(this.lad.a, t.a, k);
  }

  tickClimb() {
    const lad = this.lad, R = this.rider, W = this.world;
    if (this.climbHold) {
      this.holdT += TICK;
      const v = Math.min(CLIMB_MAX, 0.75 + this.holdT * 0.55);
      this.sTarget = clamp(this.sTarget + this.climbHold * v * TICK, R.s - LEAD, R.s + LEAD);
    }
    const lead = this.sTarget - R.s, speed = Math.min(CLIMB_MAX, Math.abs(lead) * CLIMB_GAIN);
    let ds = Math.sign(lead) * Math.min(Math.abs(lead), speed * TICK);
    if (ds > 0) {
      // don't climb your head into something
      const [hx, hy] = riderPoint(lad, { s: R.s + ds, side: R.side }, 1.32, 0.2);
      if (circleHits(W, hx, hy, 0.15)) { ds = 0; this.sTarget = R.s; if (!this.bonked) { this.bonked = true; this.ev('bonk'); } } else this.bonked = false;
    }
    const s0 = R.s; R.s = clamp(R.s + ds, 0, S_MAX); if (R.s === S_MAX || R.s === 0) this.sTarget = clamp(this.sTarget, 0, S_MAX);
    const u = Math.abs(R.s - s0) / TICK;
    let kick = 0;
    if (Math.floor(R.s / LADDER.rung) !== Math.floor(s0 / LADDER.rung)) {
      kick = R.side * ROCK * Math.max(0, u - ROCK_FREE) ** 1.5;
      this.ev('rung', { s: R.s, up: R.s > s0, fast: u > 1.6 });
    }
    this.climbed += Math.max(0, R.s - s0) * Math.sin(lad.a);
    let strain = 0, slide = 0;
    for (let i = 0; i < SUB; i++) {
      const cs = this.sim.step(lad, R, null, null, H, i === 0 ? kick : 0);
      if (i === SUB - 1) for (const c of cs) if (c.part === 'foot' || c.part === 'top' || c.part === 'rail') { const k = c.pn > 1e-6 ? Math.abs(c.pt) / (c.mu * c.pn + 1e-9) : 0; if (k > strain) strain = k; }
      this.impactEvents(R);
    }
    slide = Math.hypot(lad.vx, lad.vy);
    this.strain = this.strain * 0.8 + strain * 0.2; this.slide = slide;
    // how fast is the painter going? too fast and they come off
    const [rx, ry] = riderPoint(lad, R, 0.8);
    const rvx = lad.vx - lad.w * (ry - lad.fy), rvy = lad.vy + lad.w * (rx - lad.fx), rv = Math.hypot(rvx, rvy);
    if (Math.abs(lad.w) > 1.4 || rv > 2.6) {
      const cause = slide > 0.8 ? 'slip' : (lad.w * R.side > 0 ? 'tip' : 'slide');
      return this.startFall(cause, [rvx, rvy]);
    }
    if (rv > 0.6 && !this.fall) this.noteFall(slide > 0.4 ? 'slip' : lad.w * R.side > 0 ? 'tip' : 'slide');
    if (rv < 0.2 && this.fall && this.fall.soft) this.fall = null;

    // off at the top, onto a ledge
    if (lead > 0.04 || this.climbHold > 0) {
      const L = this.ledge();
      if (L) return this.stepOff(L);
    }
    // off at the bottom
    if (R.s <= 0.001 && (lead < -0.04 || this.climbHold < 0)) {
      const g = this.footGround();
      if (g) return this.dismount(g);
      this.letGoT += TICK; if (this.letGoT > 0.7) return this.startFall('letgo', [0, 0]);
    } else this.letGoT = 0;
    // the ladder has come to rest lying down with the painter on it at ground level: get off
    if ((this.fall || !this.planted) && Math.abs(Math.sin(lad.a)) < 0.22 && slide < 0.1 && Math.abs(lad.w) < 0.1) {
      const [fx, fy] = this.feet(), g = groundAt(W, fx, fy + 0.5, fy - 0.45);
      if (g && headroom(W, fx, g.y)) return this.dismount({ x: fx, y: g.y, P: g.P });
    }
  }
  impactEvents(R) {
    for (const im of this.sim.impacts) if (im.v > 1.6) {
      this.ev('impact', { v: im.v, P: im.P, part: im.part, x: im.x, y: im.y });
      if (this.fall && im.v > 2.2) { this.fall.bounces++; this.fall.hit = im.P?.obj; }
    }
  }
  ledge() {
    const W = this.world, [fx, fy] = this.feet(), c = Math.cos(this.lad.a), lad = this.lad, footP = this.planted?.foot;
    const sides = Math.abs(c) < 0.06 ? [1, -1] : [Math.sign(c)];
    for (const side of sides) for (const dx of [0.3, 0.5, 0.72]) {
      const x = fx + side * dx, g = groundAt(W, x, fy + 0.62, fy - 0.35);
      // not back onto what the ladder stands on
      if (!g || (footP && g.P === footP) || Math.hypot(x - lad.fx, g.y - lad.fy) < 1.2 || !headroom(W, x, g.y)) continue;
      if (rayCast(W, fx, fy + 0.45, x, g.y + 0.45) || rayCast(W, fx, fy + 1.25, x, g.y + 1.25)) continue;
      return { x, y: g.y, P: g.P };
    }
    return null;
  }
  footGround() {
    const W = this.world, [fx, fy] = this.feet(), side = Math.cos(this.lad.a) >= 0 ? 1 : -1;
    for (const dx of [-0.25, 0, -0.5, 0.25]) {
      const x = fx + side * dx, g = groundAt(W, x, fy + 0.4, fy - 0.6);
      if (g && headroom(W, x, g.y)) return { x, y: g.y, P: g.P };
    }
    return null;
  }
  stepOff(L) {
    const [x0, y0] = this.feet();
    this.mode = 'stepoff'; this.anim = { T: 0.55, t: 0, x0, y0, x1: L.x, y1: L.y, P: L.P };
    this.p.x = L.x; this.p.y = L.y; this.p.face = Math.sign(L.x - x0) || this.p.face; this.p.edge = 0; this.p.on = L.P;
    this.fall = null; this.ev('stepoff', { P: L.P });
  }
  dismount(g) {
    this.mode = 'stand'; this.held = 'planted'; this.p.x = g.x; this.p.y = g.y; this.p.on = g.P; this.p.edge = 0;
    this.p.face = Math.cos(this.lad.a) >= 0 ? 1 : -1; this.rider = null; this.lad.vx = this.lad.vy = this.lad.w = 0;
    this.settle(); this.ev('dismount');
  }

  /* ------------------------------------------------------------------------------------------- falling */
  noteFall(cause) {
    const top = Math.max(this.height(), ...this.hist.slice(-200));
    this.fall = { t0: this.t, h0: top, cause, bounces: 0, foot: this.planted?.foot?.obj, top: this.planted?.P?.obj, hit: null, soft: true, min: this.height() };
  }
  startFall(cause, v) {
    if (!this.fall || this.fall.soft) { const keep = this.fall; this.noteFall(cause); if (keep) { this.fall.t0 = keep.t0; this.fall.cause = keep.cause; } }
    this.fall.soft = false;
    let x, y, s;
    if (this.mode === 'climb') { [x, y] = riderPoint(this.lad, this.rider, 0.62, 0.22); s = this.rider.s + 1.1; }
    else { x = this.p.x; y = this.p.y + PAINTER.r + 0.08; s = 1.2; }
    this.pb = { x, y, vx: v[0], vy: v[1], spin: 0 };
    this.rope = { s: clamp(s, 0.3, LADDER.L - 0.1), len: PAINTER.arm };
    this.mode = 'fall'; this.rider = null; this.restT = 0; this.fallT = 0; this.sim.reset(); this.planted = null;
    this.ev('fall', { cause });
  }
  hop() {
    const p = this.p, d = p.edge;
    this.noteFall('hop'); this.fall.soft = false;
    this.lad.vx = d * 1.2; this.lad.vy = 1.4; this.lad.w = 0;
    this.pb = { x: p.x + d * 0.12, y: p.y + PAINTER.r + 0.1, vx: d * 1.3, vy: 1.6, spin: 0 };
    this.rope = { s: p.shoulder > 0.5 ? 2.0 : 1.2, len: PAINTER.arm };
    this.mode = 'fall'; this.restT = 0; this.fallT = 0; this.sim.reset(); p.edge = 0; this.planted = null;
    this.ev('hop');
  }
  tickFall() {
    const lad = this.lad, pb = this.pb;
    this.fallT += TICK;
    for (let i = 0; i < SUB; i++) { this.sim.step(lad, null, pb, this.rope, H); this.impactEvents(null); }
    pb.spin += (pb.vx * 2.2) * TICK;
    const [ax, ay, bx, by] = ladderEnds(lad);
    const vA = Math.hypot(lad.vx, lad.vy), vB = Math.hypot(lad.vx - lad.w * (by - lad.fy), lad.vy + lad.w * (bx - lad.fx));
    const still = vA < 0.25 && vB < 0.3 && Math.hypot(pb.vx, pb.vy) < 0.28;
    this.restT = still ? this.restT + TICK : 0;
    if (this.restT > 0.35 || this.fallT > 14) this.land();
  }
  land() {
    const W = this.world, pb = this.pb;
    // standing ground under the painter?
    let g = null;
    for (const dx of [0, -0.15, 0.15, -0.3, 0.3]) { g = groundAt(W, pb.x + dx, pb.y + 0.1, pb.y - PAINTER.r - 0.35); if (g && headroom(W, pb.x + dx, g.y)) { g.x = pb.x + dx; break; } g = null; }
    if (!g) {
      // hanging off the ladder: climb back onto it where the hand is
      const c = Math.cos(this.lad.a), s = Math.sin(this.lad.a), rs = clamp(this.rope.s - 1.1, 0, S_MAX);
      this.mode = 'climb'; this.rider = { s: rs, side: Math.abs(c) < 0.15 ? (pb.x - this.lad.fx) * -s + (pb.y - this.lad.fy) * c >= 0 ? 1 : -1 : (c >= 0 ? 1 : -1) };
      this.sTarget = rs; this.lad.vx = this.lad.vy = this.lad.w = 0; this.sim.reset(); this.pb = null;
      this.ev('cling');
      return;
    }
    const lost = this.fall ? this.fall.h0 - g.y : 0;
    this.p.x = g.x; this.p.y = g.y; this.p.on = g.P; this.p.edge = 0; this.p.face = pb.vx >= 0 ? 1 : -1;
    this.mode = 'down'; this.held = 'carry'; this.p.shoulder = 0;
    const T = 1.4 + Math.min(3.2, Math.max(0, lost) * 0.16);
    this.anim = { T: T + 1.5, t: 0, lie: T, lost, lad: { ...this.lad }, faceUp: true };
    this.downAt = { x: pb.x, y: g.y };
    this.ev('land', { lost, v: 0 });
    if (this.fall && lost > 1.2) {
      this.falls++;
      this.fall.lost = lost; this.fall.t1 = this.t; this.fall.land = g.P?.obj;
      this.ev('fallen', { fall: this.fall });
    }
    this.fall = null; this.pb = null; this.rope = null;
  }

  /* ------------------------------------------------------------------------------------------- little scenes */
  tickAnim() {
    const a = this.anim; a.t += TICK;
    if (this.mode === 'stepoff') {
      if (a.t >= a.T) { this.mode = 'haul'; this.anim = { T: 1.0, t: 0, from: { fx: this.lad.fx, fy: this.lad.fy, a: this.lad.a } }; this.p.shoulder = 0; this.ev('haul'); }
    } else if (this.mode === 'haul') {
      const k = ease(Math.min(1, a.t / a.T)), to = this.carryTarget();
      this.lad.fx = a.from.fx + (to.fx - a.from.fx) * k; this.lad.fy = a.from.fy + (to.fy - a.from.fy) * k + Math.sin(k * Math.PI) * 0.5;
      this.lad.a = angTo(a.from.a, to.a, k);
      if (a.t >= a.T) { this.mode = 'stand'; this.held = 'carry'; this.settle(); }
    } else if (this.mode === 'down') {
      if (a.t > a.lie + 0.9) {
        const k = 1 - Math.exp(-TICK * 7), t = this.carryTarget();
        this.lad.fx += (t.fx - this.lad.fx) * k; this.lad.fy += (t.fy - this.lad.fy) * k; this.lad.a = angTo(this.lad.a, t.a, k);
      }
      if (a.t >= a.T) { this.mode = 'stand'; this.held = 'carry'; this.ev('up'); this.settle(); }
    } else if (this.mode === 'win') {
      // walk up to the old painter and hand over the paint
      const p = this.p, S = this.heap.summit, d = S ? S.winX - p.x : 0;
      p.shoulder = Math.max(0, p.shoulder - TICK * 3);
      if (Math.abs(d) > 0.03 && a.t < 1.8) { p.face = Math.sign(d); const st = Math.sign(d) * Math.min(Math.abs(d), 1.1 * TICK); p.x += st; p.stride += Math.abs(st); p.walk = Math.min(1, p.walk + TICK * 6); }
      else { p.walk = Math.max(0, p.walk - TICK * 5); p.face = S && S.npc < p.x ? -1 : 1; }
      this.carryPose();
      if (a.t > 2.0 && !a.given) { a.given = true; this.ev('handoff'); }
      if (a.t > 3.4 && !a.painting) { a.painting = true; this.ev('paint'); }
    }
  }
  settle() {
    const h = this.p.y;
    if (h > this.best + 0.05) { this.best = h; this.ev('best', { h }); }
    this.ev('rest');
  }
  win() { this.mode = 'win'; this.won = true; this.anim = { t: 0, T: 999 }; this.walkTo = null; this.ev('win'); }

  /* ------------------------------------------------------------------------------------------- saving */
  save() {
    let mode = this.mode, p = { ...this.p }, held = this.held, lad = { ...this.lad };
    if (mode === 'aim') mode = 'stand';
    if (mode === 'stepoff' || mode === 'haul' || mode === 'down') { mode = 'stand'; held = 'carry'; lad = { ...lad, ...this.carryTarget() }; }
    delete p.on;
    const r = (o) => { const out = {}; for (const k in o) out[k] = typeof o[k] === 'number' ? Math.round(o[k] * 1e4) / 1e4 : o[k]; return out; };
    return { mode, held, p: r(p), lad: r(lad), rider: this.rider && r(this.rider), pb: this.pb && r(this.pb), rope: this.rope && r(this.rope),
      best: this.best, falls: this.falls, climbed: this.climbed, played: this.played, won: this.won, fall: this.fall && { ...this.fall, foot: undefined, top: undefined, hit: undefined } };
  }
  load(s) {
    if (!s || !s.p) return;
    this.mode = s.mode === 'win' ? 'stand' : s.mode; this.held = s.held; Object.assign(this.p, s.p); Object.assign(this.lad, s.lad);
    this.rider = s.rider || null; this.pb = s.pb || null; this.rope = s.rope || null;
    this.best = s.best ?? this.best; this.falls = s.falls || 0; this.climbed = s.climbed || 0; this.played = s.played || 0; this.won = !!s.won;
    if (s.fall) this.fall = { ...s.fall, bounces: s.fall.bounces || 0 };
    if (this.mode === 'climb') { if (!this.rider) this.mode = 'stand'; else this.sTarget = this.rider.s; }
    if (this.mode === 'fall' && (!this.pb || !this.rope)) { this.mode = 'stand'; this.held = 'carry'; }
    if (this.mode === 'fall') { this.restT = 0; this.fallT = 0; }
    if (this.mode === 'stand' && this.held === 'carry') this.carryPose(true);
    if (this.mode === 'stand') { const g = groundAt(this.world, this.p.x, this.p.y + 0.3, this.p.y - 0.5); if (g) this.p.y = g.y; }
  }
}

export const ease = k => k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
export function headroom(W, x, y) { return !capsuleHits(W, x, y + 0.64, x, y + 1.5, 0.19); }
function inside(b, x, y) { return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1; }
// how far up the ladder (0..1) it touches polygon P
function touchAt(fx, fy, a, P) {
  const c = Math.cos(a), s = Math.sin(a), L = LADDER.L;
  let best = Infinity, bt = 1;
  for (let i = 0; i < P.n; i++) {
    const t = Math.max(0, Math.min(1, ((P.x[i] - fx) * c + (P.y[i] - fy) * s) / L));
    const d = Math.hypot(fx + c * L * t - P.x[i], fy + s * L * t - P.y[i]);
    if (d < best) { best = d; bt = t; }
  }
  // the top end against a face
  const tx = fx + c * L, ty = fy + s * L;
  for (let i = 0; i < P.n; i++) { const d = P.nx[i] * (tx - P.x[i]) + P.ny[i] * (ty - P.y[i]); if (Math.abs(d) < best && d > -0.05) { best = Math.abs(d); bt = 1; } }
  return bt;
}
