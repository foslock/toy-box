// Grip: the climb itself. Pure simulation, no DOM, so it runs in Node for bots.
// World units: y is up, 50 units to the metre. The climber's arms reach L units.

export const L = 64;          // reach from shoulder to hand
export const FEET = 46;       // body centre to soles
export const SHX = 9, SHY = 10; // shoulder offset from body centre
export const G = 900;
export const UNITS_PER_M = 50;
export const XMIN = -196, XMAX = 196;
export const SUMMIT_Y = 3990;

const HOLD_R = { jug: 11, crimp: 7, crumble: 10, rung: 10, rope: 10, top: 14 };
// grip drain per second while hanging on one hand (two hands rest you)
const DRAIN = { jug: 0.085, rung: 0.085, crimp: 0.2, crumble: 0.1, rope: 0.07, top: 0 };
const CRUMBLE_T = 1.3, CRUMBLE_BACK = 7;
const CATCH_SPEED = 720;      // faster than this and a falling hand can't hold on
const AMAX = 2700;            // strongest pull the arms can make
const REACH_GAIN = 1.35;      // a free hand moves a bit further than the thumb, so reaches stay short slides

// The route: section by section. [x, y, type]
function route() {
  const H = [];
  const add = (x, y, t = 'jug', extra) => H.push({ x, y, t, ...extra });
  // the beach boulder (tutorial)
  add(-26, 96); add(26, 102); add(-22, 168); add(30, 212); add(-4, 268);
  // pitch 1: jugs up the slab
  add(-44, 318); add(28, 362); add(-30, 420); add(40, 470); add(-10, 528); add(-70, 590);
  // pitch 2: crimps
  add(-34, 646, 'crimp'); add(10, 700); add(54, 752, 'crimp'); add(16, 812, 'crimp'); add(-24, 864); add(34, 926);
  // pitch 3: the crumbly band, then the lunge
  add(70, 984); add(22, 1040, 'crumble'); add(76, 1092); add(16, 1146, 'crimp'); add(-14, 1188);
  add(-6, 1366, 'jug', { big: true });           // the lunge: 178 up from the last hold
  add(-78, 1404);
  // the rope across the blank wall
  add(0, 0, 'rope', { ax: 34, ay: 1580, len: 132, ang: 0.5, angv: 0 });
  add(150, 1478); add(118, 1520, 'crimp', { post: true }); add(164, 1534, 'jug', { post: true }); add(62, 1556);
  add(-128, 1530, 'jug', { post: true }); add(-60, 1562);                 // the other side of the lighthouse
  // the lighthouse: an iron ladder with rungs missing, window sills, the gallery
  const rungs = [1592, 1648, 1704, 1760, /* gap */ 1928, 1984, 2040, /* gap */ 2208, 2264, 2320, 2376];
  for (const y of rungs) add(-8, y, 'rung');
  add(44, 1820, 'crimp'); add(-50, 1872, 'crimp');            // window sills round the first gap
  add(-46, 2096, 'crumble'); add(48, 2150, 'crimp');          // and the second
  add(-60, 2462); add(60, 2462);                               // gallery railing
  add(-30, 2520, 'crimp'); add(26, 2576, 'crimp');             // lantern glazing bars
  add(0, 2650);                                                // weather vane
  // the radio mast bolted to the dome, in the storm: lattice nodes, legs at x=-38 and x=38
  const M = [
    [38, 2742], [0, 2790], [-38, 2836], [0, 2884, 'crimp'], [38, 2930], [0, 2980, 'crumble'], [-38, 3026],
    [0, 3082], [38, 3120],
    [0, 3168, 'crimp'], [-38, 3214], [0, 3262, 'crumble'], [38, 3310], [0, 3360, 'crimp'], [-38, 3408],
    [0, 3460], [38, 3500],
    [0, 3546, 'crumble'], [-38, 3592, 'crimp'], [0, 3640], [38, 3688, 'crimp'], [-12, 3736], [-38, 3782],
    [0, 3836], [38, 3880, 'crimp'], [0, 3930],
  ];
  for (const [x, y, t] of M) add(x, y, t || 'jug');
  add(0, SUMMIT_Y, 'top');
  return H;
}

function ledges() {
  return [
    { x0: -9999, x1: 9999, y: 0, kind: 'beach' },
    { x0: -62, x1: 62, y: 252, kind: 'rock' },
    { x0: -150, x1: -30, y: 566, kind: 'rock' },
    { x0: -40, x1: 96, y: 900, kind: 'rock' },
    { x0: -160, x1: -40, y: 1376, kind: 'rock' },
    { x0: -9999, x1: 9999, y: 1500, kind: 'grass' },
    { x0: -88, x1: 88, y: 2440, kind: 'gallery' },
    { x0: -26, x1: 26, y: 2610, kind: 'dome' },
    { x0: -46, x1: 46, y: 3060, kind: 'deck' },
    { x0: -46, x1: 46, y: 3440, kind: 'deck' },
    { x0: -46, x1: 46, y: 3800, kind: 'deck' },
  ];
}

export const SECTIONS = [
  { name: 'The Sea Cliff', from: 0 },
  { name: 'The Lighthouse', from: 1500 },
  { name: 'The Mast', from: 2660 },
];
export function sectionAt(y) { let s = 0; for (let i = 0; i < SECTIONS.length; i++) if (y >= SECTIONS[i].from) s = i; return s; }

function rnd(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export class Climb {
  constructor() {
    this.holds = route().map((h, i) => ({ ...h, id: i, r: HOLD_R[h.t] + (h.big ? 4 : 0), broken: false, gripT: 0, backT: 0, used: false }));
    for (const h of this.holds) if (h.t === 'rope') { h.home = h.ang; this.ropePos(h); }
    this.ledges = ledges();
    this.t = 0;
    this.rand = rnd(7);
    this.reset();
  }
  reset() {
    this.P = { x: 0, y: FEET }; this.V = { x: 0, y: 0 };
    this.hands = [0, 1].map(i => ({ i, side: i ? 1 : -1, state: 'limp', x: 0, y: 0, hold: null, ox: 0, oy: 0, rx: 0, ry: 0, noGrab: 0, down: false, dx: 0, dy: 0 }));
    for (const h of this.hands) { h.x = this.P.x + h.side * 15; h.y = this.P.y - 36; }
    this.stand = this.ledges[0];
    this.stamina = 1;
    this.supportY = this.P.y; this.airPeak = -1e9; this.airborne = false;
    this.best = this.P.y; this.falls = 0; this.lost = 0; this.climbTime = 0;
    this.summit = false;
    this.events = [];
    this.lungeV = 0; this.lungeAge = 1; this.prevGrips = 0;
    this.wind = 0; this.gust = 0; this.gustNext = 6; this.gustWarn = 0;
    for (const h of this.holds) { h.broken = false; h.gripT = 0; h.used = false; }
  }
  heightM() { return Math.max(0, (this.P.y - FEET) / UNITS_PER_M); }
  shoulder(h) { return { x: this.P.x + h.side * SHX, y: this.P.y + SHY }; }
  ropePos(h) { h.x = h.ax + h.len * Math.sin(h.ang); h.y = h.ay - h.len * Math.cos(h.ang); }
  grips() { return this.hands.filter(h => h.state === 'grip'); }

  // input: per hand, finger down + drag delta in world units since last step
  input(i, down, dx = 0, dy = 0) { const h = this.hands[i]; h.down = down; h.dx += dx; h.dy += dy; }

  // Put the climber back on two holds (restoring a save, or the demo)
  placeOn(a, b) {
    const A = this.holds[a], B = this.holds[b];
    this.P = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 - 40 }; this.V = { x: 0, y: 0 };
    [A, B].forEach((H, i) => { const h = this.hands[i]; h.state = 'grip'; h.hold = H; h.x = H.x; h.y = H.y; h.ox = this.P.x - H.x; h.oy = this.P.y - H.y; h.down = true; });
    this.stand = null; this.supportY = this.P.y; this.airborne = false;
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  step(dt) {
    this.t += dt;
    if (!this.summit) this.climbTime += dt;
    const P = this.P, V = this.V;
    this.updateWind(dt);
    // holds
    for (const h of this.holds) {
      if (h.t === 'rope') {
        const held = this.hands.some(k => k.hold === h);
        if (!held) {
          // a slow idle sway, pushed about by the wind
          const idle = 0.55 * Math.sin(this.t * 1.3 + h.ax) + this.wind * 0.0006;
          const acc = -14 * (h.ang - idle) - 1.6 * h.angv;
          h.angv += acc * dt; h.ang += h.angv * dt;
          this.ropePos(h);
        }
      }
      if (h.broken) { h.backT -= dt; if (h.backT <= 0 && !this.nearHold(h, 90)) { h.broken = false; h.gripT = 0; } }
    }
    // fingers
    for (const h of this.hands) {
      h.noGrab = Math.max(0, h.noGrab - dt);
      if (h.down && h.state === 'limp') {
        h.state = 'reach';
        const s = this.shoulder(h); h.rx = h.x - s.x; h.ry = h.y - s.y;
      } else if (!h.down && h.state !== 'limp') {
        this.release(h);
      }
      if (h.state === 'reach') { h.rx += h.dx * REACH_GAIN; h.ry += h.dy * REACH_GAIN; clampLen(h, 'rx', 'ry', L); }
      else if (h.state === 'grip') {
        if (h.hold.t === 'rope') { h.ox -= h.dx; h.oy = 0; }
        else { h.ox -= h.dx; h.oy -= h.dy; clampOffset(h); }
      }
      h.dx = 0; h.dy = 0;
    }
    // body forces
    const gr = this.grips();
    // the wind leans on you while you hang; falling, you're mostly out of it
    let ax = this.wind * (gr.length ? 1 : 0.25), ay = -G;
    const rope = gr.find(h => h.hold.t === 'rope');
    if (rope) {
      // hanging off a rope: a pendulum, pumped sideways by the thumb
      const want = clamp(-rope.ox, -L, L);
      rope.ox *= Math.exp(-3 * dt);
      ax += want * 11 - V.x * 0.3; ay -= V.y * 0.3;
    } else if (gr.length) {
      let Tx = 0, Ty = 0;
      for (const h of gr) { Tx += h.x + h.ox; Ty += h.y + h.oy; }
      Tx /= gr.length; Ty /= gr.length;
      const two = gr.length === 2;
      const kx = two ? 150 : 22, ky = two ? 150 : 90;
      const cx = two ? 17 : 1.6, cy = two ? 17 : 9;
      const comp = two ? 0.9 : 0.72;
      let fx = kx * (Tx - P.x) - cx * V.x, fy = ky * (Ty - P.y) - cy * V.y + G * comp;
      const f = Math.hypot(fx, fy);
      if (f > AMAX) { fx *= AMAX / f; fy *= AMAX / f; }
      ax += fx; ay += fy;
    }
    if (this.stand) { ay = Math.max(ay, 0); }
    V.x += ax * dt; V.y += ay * dt;
    if (!gr.length && !this.stand) { V.x *= Math.exp(-0.15 * dt); }
    const prevFeet = P.y - FEET;
    P.x += V.x * dt; P.y += V.y * dt;
    // arm constraints
    for (const h of gr) {
      if (h.hold.t === 'rope') {
        const R = h.hold, dxA = P.x - R.ax, dyA = P.y - R.ay, d = Math.hypot(dxA, dyA), max = R.len + 34;
        if (d > max) { const nx = dxA / d, ny = dyA / d; P.x = R.ax + nx * max; P.y = R.ay + ny * max; const vn = V.x * nx + V.y * ny; if (vn > 0) { V.x -= vn * nx; V.y -= vn * ny; } }
        const na = Math.atan2(P.x - R.ax, R.ay - P.y);
        R.angv = (na - R.ang) / dt; R.ang = na;
        this.ropePos(R); h.x = R.x; h.y = R.y;
      } else {
        const s = this.shoulder(h), dx = s.x - h.x, dy = s.y - h.y, d = Math.hypot(dx, dy);
        if (d > L) {
          const nx = dx / d, ny = dy / d, over = d - L;
          P.x -= nx * over; P.y -= ny * over;
          const vn = V.x * nx + V.y * ny; if (vn > 0) { V.x -= vn * nx; V.y -= vn * ny; }
        }
      }
    }
    // ledges
    const feet = P.y - FEET;
    if (this.stand) {
      const l = this.stand;
      if (P.x < l.x0 - 8 || P.x > l.x1 + 8 || feet > l.y + 2) { this.stand = null; }
      else {
        P.y = l.y + FEET; V.y = Math.max(0, V.y); V.x *= Math.exp(-9 * dt);
        // reach far to one side with nothing in hand and you shuffle that way
        if (!gr.length) for (const h of this.hands) {
          if (h.state === 'reach' && Math.hypot(h.rx, h.ry) > L * 0.92 && Math.abs(h.rx) > L * 0.6) {
            const nx = clamp(P.x + Math.sign(h.rx) * 75 * dt, l.x0 - 4, l.x1 + 4);
            P.x = nx; this.walking = Math.sign(h.rx);
          }
        }
      }
    }
    if (!this.stand && V.y <= 0) {
      for (const l of this.ledges) {
        if (prevFeet >= l.y - 0.5 && feet < l.y && P.x >= l.x0 - 6 && P.x <= l.x1 + 6) {
          const speed = -V.y; P.y = l.y + FEET; V.y = 0; V.x *= 0.4; this.stand = l;
          this.emit('land', { speed, ledge: l });
          break;
        }
      }
    }
    if (P.x < XMIN) { P.x = XMIN; V.x = Math.abs(V.x) * 0.3; }
    if (P.x > XMAX) { P.x = XMAX; V.x = -Math.abs(V.x) * 0.3; }
    // hands
    for (const h of this.hands) {
      const s = this.shoulder(h);
      if (h.state === 'reach') {
        h.x = s.x + h.rx; h.y = s.y + h.ry;
        if (h.lastHold && Math.hypot(h.x - h.lastHold.x, h.y - h.lastHold.y) > h.lastHold.r + 12) h.lastHold = null;
        if (!h.noGrab) this.tryGrab(h);
      } else if (h.state === 'limp') {
        if (h.lastHold && Math.hypot(h.x - h.lastHold.x, h.y - h.lastHold.y) > h.lastHold.r + 12) h.lastHold = null;
        const tx = P.x + h.side * (this.airborne ? 24 : 18), ty = P.y + (this.airborne ? 30 : -36);
        const k = 1 - Math.exp(-10 * dt);
        h.x += (tx - h.x) * k; h.y += (ty - h.y) * k;
        const dx = h.x - s.x, dy = h.y - s.y, d = Math.hypot(dx, dy); if (d > L) { h.x = s.x + dx / d * L; h.y = s.y + dy / d * L; }
      } else if (h.hold.t !== 'rope') { h.x = h.hold.x; h.y = h.hold.y; }
    }
    // a lunge: let go soon after a hard pull and you keep the speed it built
    const nowGrips = this.grips().length;
    if (nowGrips === 2 && !rope) {
      this.lungeAge += dt;
      if (V.y > this.lungeV || this.lungeAge > 0.3) { this.lungeV = Math.max(0, V.y); this.lungeAge = 0; }
    } else if (nowGrips === 0 && this.prevGrips > 0 && this.lungeV > 200 && this.lungeAge < 0.3) {
      V.y = Math.max(V.y, this.lungeV * 0.95); this.lungeV = 0; this.emit('lunge');
    }
    if (nowGrips < 2) { this.lungeV = 0; this.lungeAge = 1; }
    this.prevGrips = nowGrips;
    // grip strength, crumbling
    this.updateGrip(dt);
    // falls, records
    const supported = this.grips().length > 0 || !!this.stand;
    if (supported) {
      if (this.airborne && this.stand) {
        const from = Math.max(this.supportY, this.airPeak), dist = from - P.y;
        if (dist > 60) { this.falls++; this.lost += dist; this.emit('fell', { dist, from, to: P.y }); }
      }
      this.airborne = false; this.supportY = P.y; this.airPeak = P.y;
    } else {
      if (!this.airborne) { this.airborne = true; this.airPeak = P.y; }
      this.airPeak = Math.max(this.airPeak, P.y);
    }
    if (P.y > this.best + 1) { this.best = P.y; }
  }

  nearHold(hold, r) { return Math.hypot(this.P.x - hold.x, this.P.y - hold.y) < r; }

  tryGrab(h) {
    let best = null, bd = 1e9;
    for (const H of this.holds) {
      if (H.broken) continue;
      if (H === h.lastHold) continue;
      const d = Math.hypot(H.x - h.x, H.y - h.y);
      if (d <= H.r + 7 && d < bd) { bd = d; best = H; }
    }
    if (!best) return;
    let vx = this.V.x, vy = this.V.y;
    if (best.t === 'rope') { const d = best.len; vx -= best.angv * d * Math.cos(best.ang); vy -= best.angv * d * Math.sin(best.ang); }
    const rel = Math.hypot(vx, vy);
    if (rel > CATCH_SPEED) { h.noGrab = 0.35; this.emit('rip', { hold: best, speed: rel }); return; }
    const other = this.hands[1 - h.i];
    if (best.t === 'rope' && other.state === 'grip' && other.hold.t !== 'rope') {
      // grabbing a rope with the other hand on rock: you swing off it
      this.release(other);
    }
    if (best.t !== 'rope' && other.state === 'grip' && other.hold.t === 'rope') this.release(other);
    h.state = 'grip'; h.hold = best; h.x = best.x; h.y = best.y;
    h.ox = this.P.x - best.x; h.oy = this.P.y - best.y; clampOffset(h);
    const first = !best.used; best.used = true;
    this.emit('grab', { hold: best, first, hand: h.i });
    if (best.t === 'top' && !this.summit) { this.summit = true; this.emit('summit'); }
  }

  release(h) {
    if (h.state === 'grip') { this.emit('release', { hold: h.hold, hand: h.i }); h.lastHold = h.hold; }
    h.state = h.down ? 'reach' : 'limp'; h.hold = null;
    const s = this.shoulder(h); h.rx = h.x - s.x; h.ry = h.y - s.y; clampLen(h, 'rx', 'ry', L);
  }

  updateGrip(dt) {
    const gr = this.grips();
    let d;
    if (gr.length === 1) d = -DRAIN[gr[0].hold.t] * (this.gust > 0.3 ? 1.8 : 1);
    else if (gr.length === 2) d = gr.every(h => h.hold.t === 'crimp') ? -0.03 : 0.3;
    else d = this.stand ? 0.6 : 0.12;
    this.stamina = clamp(this.stamina + d * dt, 0, 1);
    for (const h of gr) {
      const H = h.hold;
      if (H && H.t === 'crumble') {
        H.gripT += dt;
        if (H.gripT > CRUMBLE_T) {
          H.broken = true; H.backT = CRUMBLE_BACK;
          for (const k of this.hands) if (k.hold === H) { this.release(k); k.noGrab = 0.4; }
          this.emit('crumble', { hold: H });
        }
      }
    }
    const still = this.grips();
    if (this.stamina <= 0 && still.length) {
      const h = still.sort((a, b) => DRAIN[b.hold.t] - DRAIN[a.hold.t])[0];
      this.release(h); h.noGrab = 0.8; this.emit('slip', { hold: h.hold });
    }
  }

  updateWind(dt) {
    const y = this.P.y;
    const storm = clamp((y - 2620) / 120, 0, 1);
    this.gustWarn = 0;
    if (storm <= 0) { this.wind = 0; this.gust = 0; return; }
    this.gustNext -= dt;
    if (this.gustNext < 1.2 && this.gustNext > 0) this.gustWarn = 1 - this.gustNext / 1.2;
    if (this.gustNext <= 0) {
      this.gustDir = this.rand() < 0.6 ? -1 : 1;
      this.gustLen = 1.6 + this.rand() * 1.4; this.gustT = 0;
      this.gustNext = 7 + this.rand() * 6;
      this.emit('gust', { dir: this.gustDir });
    }
    if (this.gustLen) {
      this.gustT += dt;
      const p = this.gustT / this.gustLen;
      this.gust = p < 1 ? Math.sin(Math.PI * p) : 0;
      if (p >= 1) this.gustLen = 0;
    } else this.gust = 0;
    const breeze = Math.sin(this.t * 0.7) * 60 + Math.sin(this.t * 1.9) * 30;
    this.wind = storm * (breeze + (this.gustDir || -1) * this.gust * 520);
  }

  // what to save so a reload puts you back where you were
  snapshot() {
    const gr = this.hands.map(h => h.state === 'grip' && h.hold.t !== 'rope' ? h.hold.id : -1);
    return { best: this.best, falls: this.falls, lost: this.lost, time: this.climbTime, a: gr[0], b: gr[1], summit: this.summit,
      stand: this.stand ? this.ledges.indexOf(this.stand) : -1, px: this.P.x };
  }
  restore(s) {
    if (!s) return;
    this.best = s.best || FEET; this.falls = s.falls || 0; this.lost = s.lost || 0; this.climbTime = s.time || 0;
    if (s.a >= 0 && s.b >= 0) this.placeOn(s.a, s.b);
    else if (s.stand >= 0 && this.ledges[s.stand]) {
      const l = this.ledges[s.stand]; this.P = { x: clamp(s.px ?? 0, Math.max(l.x0, XMIN), Math.min(l.x1, XMAX)), y: l.y + FEET }; this.stand = l;
      this.supportY = this.P.y;
      for (const h of this.hands) { h.x = this.P.x + h.side * 15; h.y = this.P.y - 36; }
    }
  }
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function clampLen(o, kx, ky, m) { const d = Math.hypot(o[kx], o[ky]); if (d > m) { o[kx] *= m / d; o[ky] *= m / d; } }
function clampOffset(h) {
  // body relative to the hand: hang up to a full arm below, press up to most of an arm above
  h.oy = clamp(h.oy, -L - 6, L * 0.8);
  clampLen(h, 'ox', 'oy', L + 6);
}
