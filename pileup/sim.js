// The tundra, the heap and one penguin's flight. No DOM: this runs in Node for the balance sim too.
// World units are metres, y is up, x = 0 is the lip of the ramp.

export const GOAL = 20000;          // the sea
export const X0 = -160, DX = 0.5, XMAX = GOAL + 260;
export const NS = Math.ceil((XMAX - X0) / DX) + 1;
export const ICE = [6000, 11200];
export const SEALS = [2500, 3400];
export const WATER_Y = -96;
const G = 9.8;

// a wing that cruises at vc m/s with a best glide of ld metres along per metre down
function wing(name, vc, ld, price) {
  const cl = 0.45, c = 9.8 / (vc * vc * cl), cd0 = cl / (2 * ld), k = cd0 / (cl * cl);
  return { name, c, cd0, k, vc, ld, price };
}
export const GEAR = {
  ramp: [
    { name: 'Snow bank', speed: 18, h: 5, ang: 0.20, price: 0 },
    { name: 'Sledge run', speed: 26, h: 9, ang: 0.27, price: 45 },
    { name: 'Timber slide', speed: 35, h: 14, ang: 0.33, price: 160 },
    { name: 'Waxed chute', speed: 46, h: 20, ang: 0.38, price: 480 },
    { name: 'The Big Jump', speed: 58, h: 27, ang: 0.43, price: 1300 },
  ],
  wings: [
    { name: 'Flippers', c: 0, price: 0 },
    wing('Cardboard wings', 22, 4, 70),
    wing('Box kite', 30, 5, 260),
    wing('Hang glider', 42, 6, 800),
    wing('Swept wing', 80, 9, 2400),
  ],
  rocket: [
    { name: 'No rocket', thrust: 0, fuel: 0, price: 0 },
    { name: 'Firework', thrust: 15, fuel: 1.6, price: 110 },
    { name: 'Soda bottle', thrust: 19, fuel: 3.2, price: 380 },
    { name: 'Twin rockets', thrust: 24, fuel: 4.6, price: 1100 },
    { name: 'Jet pack', thrust: 30, fuel: 8, price: 3000 },
  ],
  belly: [
    { name: 'Bare belly', mu: 0.13, tough: 10, price: 0 },
    { name: 'Fish oil', mu: 0.095, tough: 11, price: 30 },
    { name: 'Ski wax', mu: 0.07, tough: 12, price: 120 },
    { name: 'Tea tray', mu: 0.05, tough: 14, price: 380 },
    { name: 'Toboggan', mu: 0.036, tough: 17, price: 1000 },
  ],
};
export const LINES = ['ramp', 'wings', 'rocket', 'belly'];

export const NAMES = ['Percy', 'Gus', 'Mabel', 'Otto', 'Pip', 'Wendell', 'Dot', 'Barnaby', 'Ines', 'Clem', 'Hattie', 'Rolf',
  'Noodle', 'Agnes', 'Sven', 'Bea', 'Ferdinand', 'Tilly', 'Oskar', 'Marge', 'Humphrey', 'Lotte', 'Bertie', 'Winnie', 'Klaus',
  'Peg', 'Ambrose', 'Ruth', 'Fergus', 'Elsie', 'Ludo', 'Ida', 'Mortimer', 'Greta', 'Tobias', 'Nell', 'Cyril', 'Frieda', 'Alf', 'Juniper'];

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// the land, before anyone has crashed into it
function rawHeight(x) {
  if (x <= 0) return 0;
  let y = -16 * smooth(0, 170, x);                         // the landing hill below the ramp
  const roll = smooth(140, 420, x);
  y += roll * (2.6 * Math.sin(x / 41) + 4.2 * Math.sin(x / 127 + 1.3) + 7 * Math.sin(x / 523 + 0.4) + 10 * Math.sin(x / 1730 + 2));
  y -= Math.max(0, x - 170) * 0.0026;                       // the whole tundra tips gently toward the sea
  // a natural ski jump: a long ramp up, then the ground falls away
  y += kicker(x, 1640, 70, 11);
  y += kicker(x, 5200, 90, 15);
  // the ice shelf is flat as a table
  const ice = smooth(ICE[0] - 200, ICE[0], x) * (1 - smooth(ICE[1], ICE[1] + 200, x));
  if (ice > 0) y = y * (1 - ice) + (-28 - (x - ICE[0]) * 0.0012) * ice;
  // pressure ridges you need height (or speed) to get over
  y += 46 * Math.exp(-(((x - 12800) / 260) ** 2)) + 30 * Math.exp(-(((x - 13600) / 180) ** 2));
  y += 22 * Math.exp(-(((x - 17300) / 220) ** 2));
  // dunes before the coast
  y += smooth(15500, 16200, x) * (1 - smooth(19400, 19700, x)) * 6 * Math.sin(x / 61);
  // the cliff into the sea
  y -= 70 * smooth(GOAL - 40, GOAL + 10, x);
  return y;
}
function kicker(x, at, len, hgt) {
  if (x < at - len || x > at + 60) return 0;
  if (x <= at) { const t = (x - (at - len)) / len; return hgt * t * t; }
  const t = (x - at) / 60;
  return hgt * (1 - Math.min(1, t * 9));
}

export const CREVASSES = [
  { x: 330, w: 9, d: 6 },
  { x: 1190, w: 11, d: 8 },
  { x: 4420, w: 14, d: 10 },
  { x: 9300, w: 16, d: 11 },
  { x: 15240, w: 18, d: 12 },
];

// wreck shapes stamped into the ground: [half-length, height, material]
const SHAPES = {
  penguin: { len: 1.7, h: 0.8, mat: 2 },
  glider: { len: 4.2, h: 1.35, mat: 3 },
  rocket: { len: 1.8, h: 0.45, mat: 4 },
};
const FILL = { penguin: 1.5, glider: 0.9, rocket: 0.5 };
export const MAT = { snow: 0, ice: 1, penguin: 2, wood: 3, metal: 4, crack: 5 };

export class World {
  constructor() {
    this.raw = new Float32Array(NS);
    this.extra = new Float32Array(NS);
    this.mat = new Uint8Array(NS);
    this.h = new Float32Array(NS);
    for (let i = 0; i < NS; i++) this.raw[i] = rawHeight(X0 + i * DX);
    this.cracks = CREVASSES.map((c) => ({ ...c, fill: 0, top: 0, stack: [] }));
    for (const c of this.cracks) c.top = Math.min(this.rawAt(c.x - c.w / 2 - 1), this.rawAt(c.x + c.w / 2 + 1));
    this.wrecks = [];
    this.recompute(0, NS - 1);
    const r = rng(77);
    this.seals = [];
    for (let x = SEALS[0] + 20; x < SEALS[1]; x += 34 + r() * 70) {
      const cx = x + 0;
      this.seals.push({ x: cx, y: this.at(cx) + 0.7, r: 1.05, flip: r() < 0.4, ph: r() * 6, hit: 0 });
    }
  }
  idx(x) { return clamp(Math.round((x - X0) / DX), 0, NS - 1); }
  rawAt(x) { return this.raw[this.idx(x)]; }
  recompute(i0, i1) {
    for (let i = Math.max(0, i0); i <= Math.min(NS - 1, i1); i++) {
      const x = X0 + i * DX;
      let y = this.raw[i];
      for (const c of this.cracks) {
        const dx = Math.abs(x - c.x), hw = c.w / 2;
        if (dx < hw) {
          const floor = c.top - c.d * (1 - (dx / hw) ** 6);
          y = Math.min(y, Math.max(floor, c.top - c.d + c.fill));
        }
      }
      this.h[i] = y + this.extra[i];
    }
  }
  at(x) {
    const f = (x - X0) / DX;
    if (f <= 0) return this.h[0];
    if (f >= NS - 1) return this.h[NS - 1];
    const i = f | 0, t = f - i;
    return this.h[i] * (1 - t) + this.h[i + 1] * t;
  }
  slope(x) { return (this.at(x + 0.5) - this.at(x - 0.5)) / 1; }
  matAt(x) {
    const i = this.idx(x);
    if (this.extra[i] > 0.04) return this.mat[i];
    for (const c of this.cracks) if (Math.abs(x - c.x) < c.w / 2 && c.fill < c.d - 0.2) return MAT.crack;
    if (x > ICE[0] && x < ICE[1]) return MAT.ice;
    return MAT.snow;
  }
  crackAt(x) {
    for (let k = 0; k < this.cracks.length; k++) { const c = this.cracks[k]; if (Math.abs(x - c.x) < c.w / 2 + 0.3) return k; }
    return -1;
  }
  // is this point down inside an unfilled crevasse?
  inCrack(x, y) {
    const k = this.crackAt(x);
    if (k < 0) return -1;
    const c = this.cracks[k];
    return (c.fill < c.d - 0.3 && y < c.top - 0.6) ? k : -1;
  }
  // leave a wreck where it came to rest; returns the wreck record
  stamp(kind, x, extra = {}) {
    const k = this.inCrack(x, this.at(x)) >= 0 ? this.crackAt(x) : -1;
    const w = { k: kind, x, ...extra };
    if (k >= 0) {
      const c = this.cracks[k];
      w.c = k; w.y = c.top - c.d + c.fill; w.a = 0;
      c.stack.push(w);
      c.fill = Math.min(c.d + 0.5, c.fill + FILL[kind]);
      this.recompute(this.idx(c.x - c.w / 2 - 1), this.idx(c.x + c.w / 2 + 1));
    } else {
      const s = SHAPES[kind];
      w.y = this.at(x); w.a = clamp(Math.atan((this.at(x + 1.5) - this.at(x - 1.5)) / 3), -0.45, 0.45);
      const i0 = this.idx(x - s.len), i1 = this.idx(x + s.len);
      for (let i = i0; i <= i1; i++) {
        const t = (X0 + i * DX - x) / s.len;          // -1 .. 1
        let add;
        if (kind === 'glider') add = t < 0.75 ? s.h * Math.max(0, (t + 1) / 1.75) ** 1.6 : s.h * (1 - (t - 0.75) / 0.25);   // a wedge that rises forwards
        else add = s.h * Math.max(0, Math.cos(t * Math.PI / 2)) ** 0.8;
        if (!(add > 0)) continue;
        if (add <= 0) continue;
        this.extra[i] += add;
        if (add > 0.04) this.mat[i] = s.mat;
      }
      this.recompute(i0, i1);
    }
    this.wrecks.push(w);
    return w;
  }
}

// ------------------------------------------------------------------- one launch
export function rampGeom(t) {
  const L = 14 + t.h * 2.2;
  const p2 = [0, t.h], k = L * 0.5;
  const p1 = [-k * Math.cos(t.ang), t.h - k * Math.sin(t.ang)];
  const p0 = [-L, t.h + L * 0.62];
  return { L, p0, p1, p2 };
}
export function rampPoint(gm, s) {
  const { p0, p1, p2 } = gm, u = 1 - s;
  const x = u * u * p0[0] + 2 * u * s * p1[0] + s * s * p2[0];
  const y = u * u * p0[1] + 2 * u * s * p1[1] + s * s * p2[1];
  const dx = 2 * u * (p1[0] - p0[0]) + 2 * s * (p2[0] - p1[0]);
  const dy = 2 * u * (p1[1] - p0[1]) + 2 * s * (p2[1] - p1[1]);
  return [x, y, Math.atan2(dy, dx)];
}

export class Run {
  constructor(world, tiers) {
    this.w = world;
    this.t = tiers;
    this.ramp = GEAR.ramp[tiers.ramp];
    this.wing = GEAR.wings[tiers.wings];
    this.rkt = GEAR.rocket[tiers.rocket];
    this.belly = GEAR.belly[tiers.belly];
    this.gm = rampGeom(this.ramp);
    this.state = 'ready';            // ready | ramp | fly | done
    this.s = 0;
    [this.x, this.y, this.p] = rampPoint(this.gm, 0);
    this.vx = 0; this.vy = 0;
    this.hasWings = tiers.wings > 0;
    this.hasRocket = tiers.rocket > 0;
    this.fuel = this.rkt.fuel;
    this.boosting = false;
    this.ground = false; this.air = 0; this.stillT = 0; this.time = 0;
    this.stats = { maxX: 0, maxAlt: 0, top: 0, bounces: 0, seals: 0, wrecks: 0, airTime: 0 };
    this.events = [];
    this.debris = [];
    this.stall = 0; this.alpha = 0;
    this.end = null;                 // 'stop' | 'crack' | 'sea'
    this.surface = MAT.snow;
  }
  get speed() { return Math.hypot(this.vx, this.vy); }
  get alt() { return this.y - this.w.at(this.x); }
  launch() { if (this.state === 'ready') { this.state = 'ramp'; this.s = 0; this.vr = 2; this.events.push({ t: 'go' }); } }

  // input: { pitch: absolute target or null, turn: -1..1, boost: bool }
  step(dt, input = {}) {
    if (this.state === 'done' || this.state === 'ready') { this.stepDebris(dt); return; }
    this.time += dt;
    if (this.state === 'ramp') {
      const v = this.vr = Math.min(this.ramp.speed, this.vr + (this.ramp.speed ** 2 / (2 * this.gm.L)) * dt);
      this.s += v * dt / (this.gm.L * 1.08);
      if (this.s >= 1) {
        this.s = 1;
        const [x, y, a] = rampPoint(this.gm, 1);
        this.x = x; this.y = y; this.p = a;
        this.vx = Math.cos(a) * this.ramp.speed; this.vy = Math.sin(a) * this.ramp.speed;
        this.state = 'fly';
        this.events.push({ t: 'lip' });
      } else {
        [this.x, this.y, this.p] = rampPoint(this.gm, this.s);
        this.vx = Math.cos(this.p) * v; this.vy = Math.sin(this.p) * v;
      }
      return;
    }
    const w = this.w;
    let ax = 0, ay = -G;
    const v = this.speed;
    const gam = Math.atan2(this.vy, this.vx);
    // steering
    if (!this.ground) {
      if (input.pitch != null) this.p += clamp(wrap(input.pitch - this.p), -6 * dt, 6 * dt);
      else if (input.turn) this.p += input.turn * 1.9 * dt;
      else if (v > 3) this.p += clamp(wrap(gam + (this.hasWings ? 0.07 : 0) - this.p), -1, 1) * (this.hasWings ? 0.9 : 0.5) * dt;
      this.p = clamp(this.p, -1.45, 1.45);
    }
    const alpha = this.alpha = wrap(this.p - gam);
    if (v > 0.5) {
      const ux = this.vx / v, uy = this.vy / v;
      // the penguin itself: streamlined when its beak points where it's going
      let cd = (this.hasWings ? 0 : 0.0028) * (0.55 + 1.6 * Math.sin(alpha) ** 2);
      if (this.ground || (this.hasWings && v < 4)) cd = 0.0016;
      let lift = 0;
      if (this.hasWings && !this.ground) {
        const wg = this.wing, aS = 0.27;
        let cl;
        if (Math.abs(alpha) < aS) { cl = 5 * alpha; this.stall = Math.max(0, this.stall - dt * 3); }
        else { cl = 5 * aS * Math.sign(alpha) * Math.max(0.25, 1 - (Math.abs(alpha) - aS) * 2.2); this.stall = Math.min(1, this.stall + dt * 4); }
        lift = wg.c * v * v * cl;
        cd += wg.c * (wg.cd0 + wg.k * cl * cl + (Math.abs(alpha) > aS ? 0.5 * (Math.abs(alpha) - aS) : 0));
      }
      const drag = cd * v * v;
      ax += -ux * drag - uy * lift;
      ay += -uy * drag + ux * lift;
    }
    // rocket
    this.boosting = false;
    if (this.hasRocket && this.fuel > 0 && input.boost) {
      ax += Math.cos(this.p) * this.rkt.thrust; ay += Math.sin(this.p) * this.rkt.thrust;
      this.fuel = Math.max(0, this.fuel - dt);
      this.boosting = true;
      if (this.fuel === 0) {
        this.hasRocket = false;
        this.debris.push({ k: 'rocket', x: this.x - Math.cos(this.p) * 0.6, y: this.y + 0.3, vx: this.vx * 0.8, vy: this.vy * 0.8 + 2, a: this.p, va: 3, done: false });
        this.events.push({ t: 'burnout' });
      }
    }
    // ground friction
    if (this.ground && v > 0.01) {
      const sl = w.slope(this.x), nx = -sl / Math.hypot(1, sl), ny = 1 / Math.hypot(1, sl);
      const m = this.surface;
      let mu = this.belly.mu;
      if (m === MAT.ice) mu *= 0.3; else if (m === MAT.penguin) mu *= 0.5; else if (m === MAT.wood) mu *= 0.6; else if (m === MAT.metal) mu *= 0.7;
      const nForce = Math.max(0, G * ny);
      const f = mu * nForce;
      const dv = Math.min(v, f * dt);
      this.vx -= (this.vx / v) * dv; this.vy -= (this.vy / v) * dv;
      void nx;
    }
    this.vx += ax * dt; this.vy += ay * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;

    // seals: big, bouncy, unbothered
    if (this.x > SEALS[0] - 10 && this.x < SEALS[1] + 10) {
      for (const s of w.seals) {
        const dx = this.x - s.x, dy = (this.y + 0.35) - s.y, d = Math.hypot(dx, dy), R = s.r + 0.45;
        if (d < R && d > 0.001) {
          const nx = dx / d, ny = dy / d, vn = this.vx * nx + this.vy * ny;
          this.x += nx * (R - d); this.y += ny * (R - d);
          if (vn < 0) {
            const e = 0.92, vx0 = Math.abs(this.vx);
            this.vx -= (1 + e) * vn * nx; this.vy -= (1 + e) * vn * ny;
            this.vy = Math.max(this.vy, 7 + Math.min(10, -vn * 0.4));   // seals always send you up
            this.vx = Math.max(this.vx, vx0 * 1.04, 8);
            this.stats.seals++; this.stats.bounces++;
            s.hit = 1;
            this.events.push({ t: 'seal', x: s.x, y: s.y, v: -vn });
            this.ground = false;
          }
        }
      }
    }

    // the ground
    const gy = w.at(this.x);
    const sl = w.slope(this.x);
    const nl = Math.hypot(1, sl), nx = -sl / nl, ny = 1 / nl, tx = 1 / nl, ty = sl / nl;
    const wasGround = this.ground;
    if (this.y <= gy) {
      this.y = gy;
      const vn = this.vx * nx + this.vy * ny;
      let vt = this.vx * tx + this.vy * ty;
      const m = this.surface = w.matAt(this.x);
      if (vn < 0) {
        const imp = -vn;
        let e = 0.12;
        if (m === MAT.penguin) e = 0.55; else if (m === MAT.wood) e = 0.25; else if (m === MAT.ice) e = 0.08;
        if (imp > 2.5) {
          // belly-flat keeps the speed; beak-first does not
          const slopeA = Math.atan(sl);
          const align = Math.cos(wrap(this.p - slopeA));
          const keep = 0.35 + 0.6 * clamp(align, 0, 1) ** 3;
          const hard = clamp((imp - 2.5) / 14, 0, 1);
          vt *= 1 - (1 - keep) * hard;
          this.events.push({ t: 'land', x: this.x, y: gy, v: imp, m, align, air: this.air });
          if (this.air > 0.25) this.stats.bounces++;
          if (m === MAT.penguin || m === MAT.wood || m === MAT.metal) this.stats.wrecks++;
          if (this.hasWings && imp > this.belly.tough) {
            this.hasWings = false;
            this.debris.push({ k: 'glider', x: this.x - 1, y: gy + 0.5, vx: this.vx * 0.15, vy: 1, a: this.p, va: 0, done: false });
            this.events.push({ t: 'snap', x: this.x, y: gy });
          }
        }
        const vnOut = imp > 3 ? imp * e : 0;
        this.vx = tx * vt + nx * vnOut; this.vy = ty * vt + ny * vnOut;
        if (vnOut > 2) this.ground = false; else this.ground = true;
      } else this.ground = true;
    } else this.ground = this.y - gy < 0.06;
    if (this.ground) {
      this.p += clamp(wrap(Math.atan(sl) - this.p), -8 * dt, 8 * dt);
      this.air = 0;
    } else { this.air += dt; this.stats.airTime += dt; }
    if (wasGround && !this.ground && this.speed > 8) this.events.push({ t: 'hop' });

    const s = this.speed;
    this.stats.maxX = Math.max(this.stats.maxX, this.x);
    this.stats.maxAlt = Math.max(this.stats.maxAlt, this.y - gy);
    this.stats.top = Math.max(this.stats.top, s);
    this.stepDebris(dt);

    // the end of the day
    if (this.x > GOAL - 20 && this.y < WATER_Y + 1) { this.finish('sea'); return; }
    if (this.ground && s < 0.5) this.stillT += dt; else if (this.ground && s < 2.5) this.stillT += dt * 0.12; else this.stillT = 0;
    if (this.stillT > 0.45 || this.time > 400) this.finish(w.inCrack(this.x, this.y) >= 0 ? 'crack' : 'stop');
  }
  stepDebris(dt) {
    const w = this.w;
    for (const d of this.debris) {
      if (d.done) continue;
      d.vy -= G * dt; d.vx *= 1 - 0.3 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.a += d.va * dt;
      if (d.y <= w.at(d.x)) {
        d.done = true;
        d.wreck = w.stamp(d.k, d.x, { d: this.day });
        this.events.push({ t: 'thud', x: d.x, y: d.y, k: d.k });
      }
    }
  }
  finish(why) {
    this.state = 'done';
    this.end = why;
    this.vx = this.vy = 0;
    // anything still falling lands now
    for (const d of this.debris) if (!d.done) { d.done = true; d.wreck = this.w.stamp(d.k, d.x, { d: this.day }); }
    if (why !== 'sea') {
      this.wreck = this.w.stamp('penguin', this.x, { d: this.day, n: this.name, wings: this.hasWings ? this.t.wings : 0, rocket: this.hasRocket ? this.t.rocket : 0 });
    }
    this.events.push({ t: 'end', why });
  }
}

// fish for a day's work
export function payout(st, dist, best) {
  const d = Math.max(0, dist);
  const parts = [
    ['Distance', Math.round(d * 0.16)],
    ['Height', Math.round(st.maxAlt * 0.6)],
    ['Speed', Math.round(st.top * 0.25)],
    ['Bounces', st.bounces * 3],
  ];
  if (d > best && best > 0) parts.push(['New record', Math.round((d - best) * 0.1)]);
  return parts.filter((p) => p[1] > 0);
}
