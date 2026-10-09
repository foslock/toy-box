// One run down a mountain: the snowball's physics on the heightfield, picking things up, bouncing off what's too
// big, the skiers and animals that move about, and a queue of events for the renderer, the sound and the HUD.
// No three.js here, so it can be played headless (balance.mjs).
import { ITEMS } from './items.js';
import { SURF } from './course.js';

export const G = 12.5;
const GROW = 0.6;    // how much of a thing's (diameter/2)^3 it adds to the ball's r^3
const ROLL = [0.075, 0.035, 0.01, 0.13];       // rolling resistance by surface: powder, piste, ice, bank
const GRIP = [1, 1.08, 0.1, 0.8];             // how much steering bites
const GAIN = [0.0011, 0.0005, 0, 0.0016];     // fresh snow packed on per metre rolled (thickness, m)
const AIR = 0.0075;                           // air drag; divided by r^0.7, so big balls go faster

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export class Run {
  constructor(C, opts = {}) {
    this.C = C;
    this.t = 0;
    const r = C.def.start / 2;
    const y = C.heightAt(0, 2) + r;
    this.ball = { x: 0, y, d: 2, vx: 0, vy: 0, vd: 1.5, r, ground: true, air: 0, maxAir: 0, surf: SURF.powder, speed: 0, owner: 0, hx: 0, hd: 1 };
    this.ball.n = this.support(0, 2, r);
    this.input = { steer: 0, brake: 0, tuck: 0 };
    this.events = [];
    this.statics = [];
    this.movers = [];
    for (const it of C.items) {
      it.eaten = false;
      if (it.move) { this.movers.push(it); it.vx = 0; it.vd = 0; it.mt = 0; it.active = false; it.panic = 0; it.hx = it.x; it.hd = it.d; }
      else this.statics.push(it);
    }
    this.attached = [];     // eaten things, oldest first
    this.count = {};        // eaten, by key
    this.eatenN = 0;
    this.townEaten = 0;
    this.combo = 0; this.lastEat = -9;
    this.stillT = 0;
    this.done = false;
    this.finished = false;
    this.maxR = r;
    this.forkSeen = new Set();
    this.routeSeen = new Set();
    this.routesTaken = [];
    this.routeDist = {};
    // which kinds of thing are on this mountain, smallest first, for "big enough for…" calls
    const kinds = {};
    for (const it of C.items) if (!it.deco && it.need > C.def.start * 1.05) kinds[it.key] = Math.min(kinds[it.key] ?? 1e9, it.need);
    this.unlocks = Object.entries(kinds).filter(([k]) => C.items.filter(i => i.key === k && !i.deco).length >= 3).sort((a, b) => a[1] - b[1]);
    this.slowmo = 0;
    this.snowGain = 0;
  }

  get dia() { return this.ball.r * 2; }

  // How high the ball's centre sits when resting at (x, d), and the ground's normal there. A big ball rests on the
  // highest of several points under it, so it rides over narrow channels instead of sinking into them.
  support(x, d, r) {
    const h = this.C.heightAt;
    const lift = (px, pd) => {
      let y = h(px, pd) + r;
      if (r > 0.9) {
        for (const f of SAMPLE) {
          const ox = f[0] * r, od = f[1] * r;
          const yy = h(px + ox, pd + od) + r * f[2];
          if (yy > y) y = yy;
        }
      }
      return y;
    };
    const e = Math.max(1.2, r * 0.35);
    const y = lift(x, d);
    const gx = (lift(x + e, d) - lift(x - e, d)) / (2 * e);
    const gd = (lift(x, d + e) - lift(x, d - e)) / (2 * e);
    const n = 1 / Math.hypot(gx, 1, gd);
    return { y, nx: -gx * n, ny: n, nd: -gd * n };
  }

  step(dt) {
    if (this.done) return;
    const b = this.ball, C = this.C, inp = this.input;
    this.t += dt;
    let sup = this.support(b.x, b.d, b.r);
    b.surf = C.surfAt(b.x, b.d);
    const s = b.surf;
    // gravity
    b.vy -= G * dt;
    const sp3 = Math.hypot(b.vx, b.vy, b.vd);
    // the way the ball is heading (and the camera looking): its direction of travel, smoothed, and never more than
    // about 60 degrees off straight down the mountain
    const hs0 = Math.hypot(b.vx, b.vd);
    if (hs0 > 1.2) {
      let a = Math.atan2(b.vx, b.vd);
      a = clamp(a, -1.05, 1.05);
      const k = Math.min(1, dt * (2 + hs0 * 0.15));
      b.hx += (Math.sin(a) - b.hx) * k; b.hd += (Math.cos(a) - b.hd) * k;
      const l = Math.hypot(b.hx, b.hd); b.hx /= l; b.hd /= l;
    }
    if (b.ground) {
      // steering: push sideways to the heading, along the ground
      const lx = b.hd, ld = -b.hx;
      const A = (6.5 + 1.1 * b.r) * GRIP[s] * (1 - 0.35 * inp.brake) * (b.r < 0.5 ? 1.15 : 1);
      b.vx += lx * inp.steer * A * dt;
      b.vd += ld * inp.steer * A * dt;
      // rolling resistance, air, braking
      // (resistance fades out at a crawl, so a ball leaning on something slides off it rather than sticking)
      const dec = ROLL[s] * G * sup.ny * Math.min(1, sp3 / 1.5) + AIR * sp3 * sp3 / Math.pow(b.r, 0.7) * (1 - 0.4 * inp.tuck) + inp.brake * (2.5 + 0.08 * sp3);
      if (sp3 > 1e-4) {
        const k = Math.max(0, 1 - dec * dt / sp3);
        b.vx *= k; b.vy *= k; b.vd *= k;
      }
      // a little push from the tuck, and never quite stop on the slope
      if (inp.tuck) b.vd += inp.tuck * 0.8 * dt;
      // snow sticks as it rolls
      const hs2 = Math.hypot(b.vx, b.vd);
      const gain = GAIN[s] * (1 + inp.brake * 1.2) * hs2 * dt / (2 * Math.PI * b.r) * Math.pow(Math.max(b.r, 0.1), 0.6) * 2.2;
      b.r += gain; this.snowGain += gain;
    } else {
      const k = Math.max(0, 1 - AIR * 0.6 * sp3 / Math.pow(b.r, 0.7) * dt);
      b.vx *= k; b.vd *= k;
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.d += b.vd * dt;

    // ground contact
    sup = this.support(b.x, b.d, b.r);
    const gap = b.y - sup.y;
    if (gap < 0) {
      b.y = sup.y;
      const vn = b.vx * sup.nx + b.vy * sup.ny + b.vd * sup.nd;
      if (vn < 0) {
        const bounce = !b.ground && -vn > 7 ? 0.22 : 0;
        b.vx -= (1 + bounce) * vn * sup.nx; b.vy -= (1 + bounce) * vn * sup.ny; b.vd -= (1 + bounce) * vn * sup.nd;
        if (!b.ground && b.air > 0.25) this.events.push({ t: 'land', impact: -vn, air: b.air });
        if (!b.ground && -vn > 9) {
          // a hard landing knocks a few things loose
          this.shed(Math.min(4, Math.floor((-vn - 7) / 4)), -vn);
        }
      }
      if (!b.ground) b.maxAir = Math.max(b.maxAir, b.air);
      b.ground = true; b.air = 0;
    } else if (gap > 0.03 + 0.02 * b.r) {
      if (b.ground && gap > 0.12 + 0.03 * b.r) this.events.push({ t: 'air' });
      if (gap > 0.12 + 0.03 * b.r) b.ground = false;
      b.air += dt;
    } else {
      b.ground = true; b.air = 0;
    }
    b.n = sup;
    b.speed = Math.hypot(b.vx, b.vy, b.vd);

    this.collide();
    if ((this.tick = (this.tick || 0) + 1) % 3 === 0) this.moveThings(dt * 3);
    this.progress(dt);
  }

  collide() {
    const b = this.ball, arr = this.statics;
    const lo = b.d - b.r - 30, hi = b.d + b.r + 30;
    // binary search the first static with d >= lo
    let a = 0, z = arr.length;
    while (a < z) { const m = (a + z) >> 1; if (arr[m].d < lo) a = m + 1; else z = m; }
    for (let i = a; i < arr.length && arr[i].d <= hi; i++) {
      const it = arr[i];
      if (!it.eaten) this.touch(it);
    }
    for (const it of this.movers) if (!it.eaten && Math.abs(it.d - b.d) < b.r + 30) this.touch(it);
  }

  touch(it) {
    const b = this.ball;
    const dx = it.x - b.x, dd = it.d - b.d, reach = b.r + it.cr;
    if (dx > reach || dx < -reach || dd > reach || dd < -reach) return;
    const dist2 = dx * dx + dd * dd;
    if (dist2 > reach * reach) return;
    if (b.y - b.r * 0.8 > it.y + it.h || b.y + b.r < it.y) return;   // flying over it, or under (never, really)
    if (it.need <= b.r * 2) this.eat(it);
    else if (!it.pass) this.bump(it, dx, dd, Math.sqrt(dist2), reach);
  }

  eat(it) {
    const b = this.ball;
    it.eaten = true;
    const before = b.r;
    b.r = Math.cbrt(b.r ** 3 + GROW * ITEMS[it.key].mass * (it.need / 2) ** 3);
    this.maxR = Math.max(this.maxR, b.r);
    const cy = it.y + it.h * 0.45;
    const rel = [it.x - b.x, cy - b.y, it.d - b.d];
    const L = Math.hypot(...rel) || 1;
    const dir = rel.map(v => v / L);
    this.attached.push({ it, rAt: before });
    this.count[it.key] = (this.count[it.key] || 0) + 1;
    this.eatenN++;
    if (it.town) this.townEaten++;
    this.combo = this.t - this.lastEat < 0.7 ? this.combo + 1 : 1;
    this.lastEat = this.t;
    // a big mouthful barely slows you; a really big one gives a satisfying lurch
    const frac = it.need / (before * 2);
    if (frac > 0.45) { const k = 1 - 0.12 * frac; this.ball.vx *= k; this.ball.vd *= k; }
    this.events.push({ t: 'eat', it, dir, frac, combo: this.combo, r: b.r });
    // big enough for something new?
    while (this.unlocks.length && this.unlocks[0][1] <= b.r * 2) {
      const [key] = this.unlocks.shift();
      this.events.push({ t: 'unlock', key });
    }
  }

  bump(it, dx, dd, dist, reach) {
    const b = this.ball;
    const nx = -dx / (dist || 1), nd = -dd / (dist || 1);
    const pen = reach - dist;
    b.x += nx * pen; b.d += nd * pen;
    b.lastBump = { nx, nd, t: this.t };
    const vn = b.vx * nx + b.vd * nd;
    if (vn < 0) {
      b.vx -= 1.45 * vn * nx; b.vd -= 1.45 * vn * nd;
      const impact = -vn;
      // lose a little speed along the way too
      b.vx *= 0.92; b.vd *= 0.92;
      if (impact > 2.2 && this.t - (it.bumpT || -9) > 0.4) {
        it.bumpT = this.t;
        const tree = /pine|birch|xmastree/.test(it.key);
        this.events.push({ t: 'bump', it, impact, tree });
        if (tree && !it.dumped && impact > 4) {   // the tree dumps its snow on you, once
          it.dumped = true;
          const g = Math.min(0.03 + 0.006 * it.h, b.r * 0.02);
          b.r += g; this.snowGain += g;
        }
        if (impact > 6) this.shed(Math.min(5, Math.floor((impact - 4) / 3.5)), impact);
      }
    }
  }

  // knock the most recent things off the ball; they land somewhere nearby and can be picked up again
  shed(n, impact) {
    const b = this.ball;
    const lost = [];
    for (let k = 0; k < n && this.attached.length > 1; k++) {
      const a = this.attached[this.attached.length - 1];
      if (a.it.need < b.r * 0.15) break;    // tiny things are well stuck in by now
      this.attached.pop();
      const it = a.it;
      b.r = Math.cbrt(Math.max((b.r * 0.6) ** 3, b.r ** 3 - GROW * ITEMS[it.key].mass * 0.85 * (it.need / 2) ** 3));
      this.count[it.key]--;
      this.eatenN--;
      if (it.town) this.townEaten--;
      // fly off sideways and back
      const ang = (Math.random() - 0.5) * 2.6;
      const s = 3 + impact * 0.5;
      it.eaten = false;
      it.loose = { vx: Math.sin(ang) * s + b.vx * 0.3, vy: 4 + Math.random() * 4 + impact * 0.3, vd: -Math.cos(ang) * s * 0.4 + b.vd * 0.5, t: 0 };
      it.x = b.x + Math.sin(ang) * (b.r + it.cr); it.d = b.d; it.y = b.y + b.r * 0.3;
      it.yaw = Math.random() * 6.28;
      if (!this.movers.includes(it)) { this.movers.push(it); const i = this.statics.indexOf(it); if (i >= 0) this.statics.splice(i, 1); }
      it.move = null;
      lost.push(it);
    }
    if (lost.length) this.events.push({ t: 'shed', items: lost, impact });
  }

  moveThings(dt) {
    const b = this.ball, C = this.C;
    for (const it of this.movers) {
      if (it.eaten) continue;
      if (it.loose) {
        const L = it.loose;
        L.t += dt;
        L.vy -= G * dt;
        it.x += L.vx * dt; it.y += L.vy * dt; it.d += L.vd * dt;
        it.spin = (it.spin || 0) + dt * 8;
        const gy = C.heightAt(it.x, it.d);
        if (it.y < gy && L.vy < 0) {
          it.y = gy; L.vy *= -0.3; L.vx *= 0.5; L.vd *= 0.5;
          if (Math.abs(L.vy) < 1.2 || L.t > 3) { it.loose = null; it.spin = 0; }
        }
        it.dirty = true;
        continue;
      }
      if (!it.move) continue;
      const ahead = it.d - b.d;
      if (!it.active) {
        if (ahead < 90 + b.r * 16 && ahead > -30) it.active = true; else continue;
      }
      if (ahead < -60 - b.r * 6) { it.active = false; continue; }
      const edible = it.need <= b.r * 2;
      const near = Math.hypot(it.x - b.x, ahead);
      const scared = edible && near < 10 + b.r * 7 && ahead > -b.r;
      if (scared && !it.panic) this.events.push({ t: 'panic', it });
      it.panic = scared ? 1 : Math.max(0, it.panic - dt * 0.5);
      it.mt += dt;
      const owner = C.routes[C.ownerAt(it.x, it.d)];
      const [cx, w] = C.routeAt(owner, it.d);
      let hx = 0, hd = 0, sp = 0;
      switch (it.move) {
        case 'ski': {
          const head = Math.sin(it.mt * 0.9 + it.phase) * 0.55 + (cx - it.x) / Math.max(4, w) * 0.5;
          sp = (it.key === 'kid' ? 3.2 : it.key === 'racer' ? 9 : 5.5) * (1 + it.panic * 0.9);
          hx = Math.sin(head); hd = Math.cos(head);
          break;
        }
        case 'drive': {
          sp = it.key === 'snowcat' ? 2.5 : it.key === 'snowmobile' ? 6 : 3.5;
          sp *= 1 + it.panic * 0.6;
          const head = clamp((cx + w * 0.4 * Math.sin(it.phase) - it.x) * 0.08, -0.5, 0.5);
          hx = Math.sin(head); hd = Math.cos(head);
          break;
        }
        case 'walk': case 'graze': case 'stomp': {
          const ang = Math.sin(it.mt * 0.3 + it.phase) * 3 + it.phase;
          sp = it.move === 'graze' ? 0.6 : 1.1;
          hx = Math.sin(ang); hd = Math.cos(ang);
          // stay near home
          const hx2 = it.hx - it.x, hd2 = it.hd - it.d, far = Math.hypot(hx2, hd2);
          if (far > 6) { hx = hx2 / far; hd = hd2 / far; }
          break;
        }
        case 'skate': {
          const ang = it.mt * 0.7 + it.phase;
          it.x = it.hx + Math.cos(ang) * 4; it.d = it.hd + Math.sin(ang) * 4;
          it.yaw = Math.atan2(-Math.sin(ang), Math.cos(ang));
          sp = 0;
          break;
        }
        case 'hop': sp = 0; break;
      }
      // anything that can be eaten runs away from the ball, sideways and on downhill
      if (it.panic && it.move !== 'skate') {
        const ax = it.x - b.x, ad = Math.max(2, it.d - b.d), l = Math.hypot(ax, ad);
        const run = it.move === 'hop' ? 4.5 : it.move === 'graze' ? 6 : 0;
        if (run) { hx = ax / l; hd = ad / l; sp = run; }
        else { hx += (ax / l) * 0.6; const l2 = Math.hypot(hx, hd); hx /= l2; hd /= l2; }
      }
      if (sp > 0) {
        it.x += hx * sp * dt; it.d += hd * sp * dt;
        const ty = Math.atan2(hx, hd);
        it.yaw = ty;
        // keep out of the banks
        const [cx2, w2] = C.routeAt(owner, it.d);
        if (Math.abs(it.x - cx2) > w2 * 0.92) it.x = cx2 + Math.sign(it.x - cx2) * w2 * 0.92;
      }
      it.y = C.heightAt(it.x, it.d) - 0.02 * it.h;
      it.dirty = true;
    }
  }

  progress(dt) {
    const b = this.ball, C = this.C;
    // forks coming up
    for (const f of C.forks) {
      if (!this.forkSeen.has(f) && b.d > f.d - 70 - b.speed * 3.5 && b.d < f.d && Math.abs(b.x - f.x) < 26 + b.r * 2) {
        this.forkSeen.add(f);
        this.events.push({ t: 'fork', fork: f });
      }
    }
    const owner = C.routes[C.ownerAt(b.x, b.d)];
    // a route counts as taken once you've come 25 m down it (at a fork you brush every channel)
    const dd = Math.max(0, b.d - (this.lastD ?? b.d));
    this.lastD = b.d;
    if (owner) this.routeDist[owner.id] = (this.routeDist[owner.id] || 0) + dd;
    // (a big ball straddles neighbouring channels, so it takes a fair share of a route, up to 150 m, to count)
    if (owner && owner.name && !this.routeSeen.has(owner.id) && (this.routeDist[owner.id] > Math.max(25, Math.min(150, 0.3 * (owner.d1 - owner.d0))) || b.d < 30)) {
      this.routeSeen.add(owner.id);
      this.routesTaken.push(owner);
      this.events.push({ t: 'route', route: owner });
    }
    b.owner = owner ? owner.i : 0;
    // stuck behind something with nowhere to go: if it hasn't come 3 m further down in 2.5 s, a nudge round
    // whatever it's leaning on (or towards the middle of the route), and then a hop if that keeps failing
    if (!this.prog || b.d > this.prog.d + 3) { this.prog = { d: b.d, t: this.t }; this.nudges = 0; }
    else if (this.t - this.prog.t > 2.5 && b.d < C.finish - 150) {
      this.prog.t = this.t;
      if ((this.nudges || 0) >= 4) {
        // still stuck: the ski patrol digs you out and sets you back on the route a little further down
        const r = owner && owner.name ? owner : C.routes.find(q => b.d > q.d0 && b.d < q.d1) || C.routes[0];
        const [cx] = C.routeAt(r, b.d + 6 + b.r);
        b.x = cx; b.d += 6 + b.r; b.vx = 0; b.vd = 3; b.vy = 0;
        b.y = this.support(b.x, b.d, b.r).y + 0.05;
        this.nudges = 0; this.prog = { d: b.d, t: this.t };
        this.events.push({ t: 'rescue' });
        return;
      }
      const [cx] = C.routeAt(owner || C.routes[0], b.d + 10);
      this.nudges = (this.nudges || 0) + 1;
      const k = Math.min(3, this.nudges);
      let ux = Math.sign(cx - b.x || 1) * 0.7, ud = 1;
      const lb = b.lastBump;
      if (lb && this.t - lb.t < 1) {   // round the thing we're leaning on: along it, downhill-ward, and a bit away
        let tx = -lb.nd, td = lb.nx;
        if (td < 0) { tx = -tx; td = -td; }
        ux = tx + lb.nx * 0.6; ud = td + lb.nd * 0.6 + 0.4;
      }
      const ul = Math.hypot(ux, ud);
      const push = (4 + b.r * 0.6) * k;
      b.vx += ux / ul * push; b.vd += ud / ul * push; b.vy += 2 + (k > 1 ? 3 + b.r * 0.8 : 0) * k;
      this.events.push({ t: 'nudge' });
    }
    if (!this.finished && b.d > C.finish) { this.finished = true; this.events.push({ t: 'finish' }); }
    // the run is over once the ball runs out of slope at the bottom
    if (b.d > C.finish - 150) {
      this.endT = b.speed < 0.8 ? (this.endT || 0) + dt : 0;
      if (this.endT > 1.2 || b.d > C.len + 150) { this.done = true; this.events.push({ t: 'end' }); }
    }
    if (this.t > 900) { this.done = true; this.events.push({ t: 'end' }); }
  }

  medal() {
    const m = this.C.def.medals, d = this.maxR * 2;
    return d >= m[2] ? 3 : d >= m[1] ? 2 : d >= m[0] ? 1 : 0;
  }
}

// where a big ball rests: rings of points under it ([x, d] as fractions of r, then how high its centre sits above
// that point, as a fraction of r)
const SAMPLE = [];
for (const [f, k] of [[0.45, 8], [0.8, 10]]) {
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2;
    SAMPLE.push([Math.cos(a) * f, Math.sin(a) * f, Math.sqrt(1 - f * f)]);
  }
}
