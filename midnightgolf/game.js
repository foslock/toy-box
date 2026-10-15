// The rules: ball physics, noise, and who wakes up. No DOM here, so the same
// code runs the page, the bot and the Node balance sim.
import { FLOORS, WALLS } from './holes.js';

export const BALL_R = 5;
export const MAX_V = 720;          // speed of a full-power putt
export const CUP_R = 8.5;
export const SINK_V = 300;         // faster than this and it skips over the cup
export const STRIKE = 50;          // noise of a full-power putt, at the ball
export const HEAR_R = 170;         // noise halves at this distance from a sleeper
export const SETTLE_DELAY = 1.3;   // seconds of quiet before a sleeper settles
export const SETTLE_RATE = 9;      // meter per second while settling
export const MAX_STROKES = 8;
const DT = 1 / 240;

export function hear(d) { return 1 / (1 + (d / HEAR_R) * (d / HEAR_R)); }

function inRect(r, x, y) { return x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]; }

// Everything solid becomes segments (with a thickness) and circles.
function buildSolids(h) {
  const segs = [];
  const n = h.room.length;
  for (let i = 0; i < n; i++) segs.push({ a: h.room[i], b: h.room[(i + 1) % n], t: 0, mat: 'hard', wall: true });
  for (const s of h.segs || []) segs.push({ a: s.a, b: s.b, t: s.t || 0, mat: s.mat || 'hard' });
  for (const b of h.blocks || []) {
    const [x, y, w, hh] = b.r;
    const p = [[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]];
    for (let i = 0; i < 4; i++) segs.push({ a: p[i], b: p[(i + 1) % 4], t: 0, mat: b.mat, block: b });
  }
  const circles = [];
  for (const r of h.rounds || []) circles.push({ x: r.x, y: r.y, r: r.r, mat: r.mat, round: r });
  for (const s of h.sleepers) if (s.solid) circles.push({ x: s.x, y: s.y, r: s.solid, mat: 'soft', sleeper: s });
  return { segs, circles };
}

// A looping path for cats; an oval for the toy train.
function makeMover(m, h) {
  if (m.oval) {
    const { x, y, rx, ry } = h.track;
    const per = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    const cars = [];
    for (let i = 0; i < (m.cars || 1); i++) cars.push(i);
    return {
      kind: m.kind, r: m.r, cars, n: cars.length,
      at(t, i) {
        const a = (t * m.speed) / ((rx + ry) / 2) - i * (2.15 * m.r) / ((rx + ry) / 2);
        return { x: x + Math.cos(a) * rx, y: y + Math.sin(a) * ry, a: Math.atan2(Math.cos(a) * ry, -Math.sin(a) * rx) };
      },
      per,
    };
  }
  const pts = m.path.length === 2 ? [m.path[0], m.path[1]] : m.path;
  const legs = [];
  let L = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    legs.push({ a, b, l, s: L });
    L += l;
  }
  return {
    kind: m.kind, r: m.r, n: 1,
    // cats walk a leg, then sit a while at the corner
    at(t) {
      const PAUSE = 2.6;
      const cyc = L / m.speed + PAUSE * legs.length;
      let k = ((t % cyc) + cyc) % cyc;
      for (const g of legs) {
        const walk = g.l / m.speed;
        const a = Math.atan2(g.b[1] - g.a[1], g.b[0] - g.a[0]);
        if (k < walk) {
          const f = k / walk;
          return { x: g.a[0] + (g.b[0] - g.a[0]) * f, y: g.a[1] + (g.b[1] - g.a[1]) * f, a, sit: false };
        }
        k -= walk;
        if (k < PAUSE) return { x: g.b[0], y: g.b[1], a, sit: true };
        k -= PAUSE;
      }
      return { x: pts[0][0], y: pts[0][1], a: 0, sit: true };
    },
  };
}

export class Game {
  constructor(hole, opts = {}) {
    this.h = hole;
    this.solids = buildSolids(hole);
    this.movers = (hole.movers || []).map((m) => makeMover(m, hole));
    this.onNoise = opts.onNoise || null;   // (x, y, loudness, kind) for ripples and sound
    this.t = opts.t0 || 0;
    this.reset();
  }

  reset() {
    const h = this.h;
    this.ball = { x: h.tee.x, y: h.tee.y, vx: 0, vy: 0 };
    this.rest = { x: h.tee.x, y: h.tee.y };
    this.phase = 'aim';            // aim | roll | sunk | caught
    this.strokes = 0;
    this.meters = h.sleepers.map(() => 0);
    this.quiet = h.sleepers.map(() => 99);   // seconds since each heard something
    this.peak = 0;
    this.lego = (h.lego || []).map(([x, y], i) => ({ x, y, a: i * 1.7, on: false }));
    this.creakOn = (h.creaks || []).map(() => false);
    this.flapSide = h.flap ? Math.sign(h.tee.y - h.flap.y) : 0;
    this.flapSwing = 0;
    this.woke = -1;
    this.fell = 0;
    this.rollAcc = 0;
    this.rollT = 0;
    this.sunkT = 0;
    this.rollTime = 0;
    this.hits = [];
  }

  snapshot() {
    return {
      ball: { ...this.ball }, rest: { ...this.rest }, phase: this.phase, strokes: this.strokes, t: this.t,
      meters: this.meters.slice(), quiet: this.quiet.slice(), peak: this.peak, lego: this.lego.map((l) => ({ ...l })),
      creakOn: this.creakOn.slice(), flapSide: this.flapSide, woke: this.woke, fell: this.fell, rollTime: this.rollTime,
    };
  }
  restore(s) {
    this.ball = { ...s.ball }; this.rest = { ...s.rest }; this.phase = s.phase; this.strokes = s.strokes; this.t = s.t;
    this.meters = s.meters.slice(); this.quiet = s.quiet.slice(); this.peak = s.peak; this.lego = s.lego.map((l) => ({ ...l }));
    this.creakOn = s.creakOn.slice(); this.flapSide = s.flapSide; this.woke = s.woke; this.fell = s.fell; this.rollTime = s.rollTime;
  }

  floorAt(x, y) {
    let m = this.h.floor;
    for (const z of this.h.zones || []) if (inRect(z.r, x, y)) m = z.m;
    return m;
  }

  // Loudness at the source; each sleeper hears it by distance.
  noise(x, y, L, kind) {
    if (L <= 0) return;
    const h = this.h;
    for (let i = 0; i < h.sleepers.length; i++) {
      const s = h.sleepers[i];
      const add = L * s.sens * hear(Math.hypot(s.x - x, s.y - y));
      if (add > 0.05) {
        this.meters[i] += add;
        this.quiet[i] = 0;
      }
    }
    if (this.onNoise) this.onNoise(x, y, L, kind);
  }

  // The noise a putt of this power would make, as the fraction of each meter.
  strikeNoise(p) { return STRIKE * p * p; }

  shoot(angle, p) {
    if (this.phase !== 'aim') return false;
    p = Math.max(0.02, Math.min(1, p));
    this.strokes++;
    this.ball.vx = Math.cos(angle) * MAX_V * p;
    this.ball.vy = Math.sin(angle) * MAX_V * p;
    this.rest = { x: this.ball.x, y: this.ball.y };
    this.phase = 'roll';
    this.rollTime = 0;
    this.noise(this.ball.x, this.ball.y, this.strikeNoise(p), 'putt');
    return true;
  }

  moverPos(m, i, t) { return m.at(t, i); }

  step(dt) {
    let left = dt;
    while (left > 1e-9) {
      const d = Math.min(DT, left);
      this.sub(d);
      left -= d;
    }
  }

  sub(dt) {
    this.t += dt;
    const h = this.h;
    // sleepers settle when it's quiet
    for (let i = 0; i < this.meters.length; i++) {
      this.quiet[i] += dt;
      if (this.quiet[i] > SETTLE_DELAY) this.meters[i] = Math.max(0, this.meters[i] - SETTLE_RATE * dt);
    }
    if (this.flapSwing > 0) this.flapSwing = Math.max(0, this.flapSwing - dt * 2.5);
    if (this.phase === 'sunk') { this.sunkT += dt; return; }
    if (this.phase !== 'roll') { this.checkWake(); return; }

    const b = this.ball;
    this.rollTime += dt;
    let sp = Math.hypot(b.vx, b.vy);
    const fm = this.floorAt(b.x, b.y);
    const F = FLOORS[fm];

    // slopes and the shower tray
    for (const s of h.slopes || []) if (inRect(s.r, b.x, b.y)) { b.vx += s.fx * dt; b.vy += s.fy * dt; }
    for (const f of h.funnels || []) {
      if (inRect(f.r, b.x, b.y)) {
        const dx = f.x - b.x, dy = f.y - b.y, dd = Math.hypot(dx, dy) || 1;
        const pull = Math.min(70, dd * f.k);
        b.vx += (dx / dd) * pull * dt; b.vy += (dy / dd) * pull * dt;
      }
    }
    sp = Math.hypot(b.vx, b.vy);

    // floor drag
    if (sp > 0) {
      const ns = Math.max(0, sp - (F.a + F.b * sp) * dt);
      const k = ns / sp;
      b.vx *= k; b.vy *= k;
      sp = ns;
    }
    // rolling noise, gathered and let out in little puffs
    if (F.roll > 0 && sp > 0) {
      this.rollAcc += F.roll * sp * dt;
      this.rollT += dt;
      if (this.rollT > 0.12) {
        this.noise(b.x, b.y, this.rollAcc, 'roll');
        this.rollAcc = 0; this.rollT = 0;
      }
    }

    const ox = b.x, oy = b.y;
    b.x += b.vx * dt; b.y += b.vy * dt;
    this.collide();

    // the cat flap
    if (h.flap) {
      const side = Math.sign(b.y - h.flap.y);
      if (side !== 0 && side !== this.flapSide && Math.abs(b.x - h.flap.x) < 24) {
        this.flapSide = side;
        this.flapSwing = 1;
        this.noise(h.flap.x, h.flap.y, 9 + Math.hypot(b.vx, b.vy) * 0.01, 'flap');
      } else if (side !== 0) this.flapSide = side;
    }
    // creaky boards
    (h.creaks || []).forEach((c, i) => {
      const on = inRect(c.r, b.x, b.y);
      if (on && !this.creakOn[i]) this.noise(b.x, b.y, 20, 'creak');
      this.creakOn[i] = on;
    });
    // lego
    for (const l of this.lego) {
      const dd = Math.hypot(l.x - b.x, l.y - b.y);
      const on = dd < BALL_R + 4;
      if (on && !l.on) {
        this.noise(l.x, l.y, 16, 'lego');
        // the brick skitters a little
        const s = Math.hypot(b.vx, b.vy) || 1;
        l.x += (b.vx / s) * 6; l.y += (b.vy / s) * 6; l.a += 0.6;
        b.vx *= 0.82; b.vy *= 0.82;
      }
      l.on = on;
    }
    // the stairs
    if (h.stairs && inRect(h.stairs.r, b.x, b.y)) {
      const r = h.stairs.r;
      this.noise(r[0] + r[2] / 2, r[1] + r[3] / 2, 46, 'stairs');
      this.fell++;
      this.strokes++;
      b.x = this.rest.x; b.y = this.rest.y; b.vx = 0; b.vy = 0;
      this.phase = 'aim';
      this.checkWake();
      return;
    }
    // the cup
    const cd = Math.hypot(h.cup.x - b.x, h.cup.y - b.y);
    sp = Math.hypot(b.vx, b.vy);
    if (cd < CUP_R) {
      if (sp < SINK_V) {
        this.phase = 'sunk';
        this.sunkT = 0;
        b.vx = 0; b.vy = 0;
        const L = { mug: 6, plughole: 4, welly: 2, bucket: 4 }[h.cup.kind] || 1;
        this.noise(h.cup.x, h.cup.y, L, 'sink');
        this.checkWake();
        return;
      }
      // too fast: it hops the lip and loses a little pace
      b.vx *= 0.985; b.vy *= 0.985;
    } else if (cd < CUP_R + 6 && sp < 120) {
      // a slow ball near the rim gets drawn in
      const dx = h.cup.x - b.x, dy = h.cup.y - b.y;
      b.vx += (dx / cd) * 140 * dt; b.vy += (dy / cd) * 140 * dt;
    }

    if (sp < 3 || this.rollTime > 25) {
      b.vx = 0; b.vy = 0;
      this.phase = 'aim';
      this.rest = { x: b.x, y: b.y };
    }
    this.checkWake();
    void ox; void oy;
  }

  collide() {
    const b = this.ball;
    const R = BALL_R;
    for (let pass = 0; pass < 2; pass++) {
      for (const s of this.solids.segs) {
        const ax = s.a[0], ay = s.a[1], bx = s.b[0], by = s.b[1];
        const ex = bx - ax, ey = by - ay;
        const L2 = ex * ex + ey * ey;
        let u = ((b.x - ax) * ex + (b.y - ay) * ey) / L2;
        u = Math.max(0, Math.min(1, u));
        const px = ax + ex * u, py = ay + ey * u;
        let dx = b.x - px, dy = b.y - py;
        const d = Math.hypot(dx, dy);
        const lim = R + s.t / 2;
        if (d < lim) {
          let nx, ny;
          if (d > 1e-6) { nx = dx / d; ny = dy / d; } else { nx = -ey / Math.sqrt(L2); ny = ex / Math.sqrt(L2); }
          // outer walls only push inward: the room polygon is clockwise in screen space
          if (s.wall) { const ix = -ey / Math.sqrt(L2), iy = ex / Math.sqrt(L2); if (d > 1e-6 && nx * ix + ny * iy < 0) { nx = ix; ny = iy; } }
          b.x = px + nx * lim; b.y = py + ny * lim;
          this.bounce(nx, ny, s.mat, 0, 0, s);
        }
      }
      for (const c of this.solids.circles) this.hitCircle(c.x, c.y, c.r, c.mat, 0, 0, c);
      for (const m of this.movers) {
        for (let i = 0; i < m.n; i++) {
          const p = m.at(this.t, i), q = m.at(this.t + 0.02, i);
          this.hitCircle(p.x, p.y, m.r, m.kind === 'train' ? 'hard' : 'soft', (q.x - p.x) / 0.02, (q.y - p.y) / 0.02, m);
        }
      }
    }
  }

  hitCircle(cx, cy, cr, mat, mvx, mvy, src) {
    const b = this.ball;
    const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy), lim = cr + BALL_R;
    if (d < lim && d > 1e-6) {
      const nx = dx / d, ny = dy / d;
      b.x = cx + nx * lim; b.y = cy + ny * lim;
      this.bounce(nx, ny, mat, mvx, mvy, src);
    }
  }

  bounce(nx, ny, mat, mvx, mvy, src) {
    const b = this.ball;
    const rvx = b.vx - mvx, rvy = b.vy - mvy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return;
    const e = mat === 'soft' ? 0.35 : mat === 'metal' ? 0.72 : mat === 'squeak' ? 0.5 : 0.62;
    b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
    // a little scrub along the surface
    const tx = -ny, ty = nx, vt = b.vx * tx + b.vy * ty;
    b.vx -= vt * 0.06 * tx; b.vy -= vt * 0.06 * ty;
    const imp = -vn;
    let L = imp * WALLS[mat];
    let kind = mat;
    if (mat === 'squeak') { L = 20; kind = 'squeak'; }
    if (src && src.kind === 'cat') { L = 7; kind = 'cat'; }
    if (src && src.kind === 'train') { L = 10 + imp * 0.02; kind = 'train'; }
    if (imp > 12) {
      this.noise(b.x - nx * BALL_R, b.y - ny * BALL_R, L, kind);
      this.hits.push({ x: b.x, y: b.y, imp, mat: kind });
    }
  }

  checkWake() {
    for (let i = 0; i < this.meters.length; i++) {
      this.peak = Math.max(this.peak, this.meters[i]);
      if (this.meters[i] >= 100 && this.phase !== 'caught') {
        this.meters[i] = 100;
        this.phase = 'caught';
        this.woke = i;
        this.ball.vx = 0; this.ball.vy = 0;
        return;
      }
    }
  }

  // Run a shot to rest without callbacks (for the bot).
  simulate(angle, p, maxT = 20) {
    const cb = this.onNoise; this.onNoise = null;
    this.shoot(angle, p);
    let t = 0;
    while (this.phase === 'roll' && t < maxT) { this.sub(DT); t += DT; }
    this.onNoise = cb;
    return this.phase;
  }
}
