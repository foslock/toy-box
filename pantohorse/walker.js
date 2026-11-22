// The pantomime horse while it's still upright: a hand-rolled stepping model, not a ragdoll.
// Two halves (front, back), each with a hip that follows its feet, two feet that step when tapped,
// and a tilt that wobbles when something goes wrong (a trip, a stumble, a bump, a yank on the costume).
// Tilt past the point of no return and the game hands the pose over to the planck ragdoll (ragdoll.js).
// No DOM: runs in Node for the balance sims. Units: metres, seconds; x forward, y up.

export const W = {
  thigh: 0.46, shin: 0.46,
  standH: 0.86,         // hip height when standing (legs nearly straight)
  gap: 1.06,            // front hip ahead of back hip, at rest
  fTorso: 0.66, bTorso: 0.86,
  stride: 0.47, swingT: 0.17, lift: 0.17,
  followK: 62, followC: 15,
  crouchAfter: 0.22, crouchDepth: 0.2, hopVy: 3.25, hopVx: 0.75, hopMin: 0.12,
  G: 9, K: 24, C: 4, noReturn: 0.5, fallAt: 1.05,
  costumeK: 26, costumeC: 5,
  tearStart: 0.2, tearRate: 1.5, ripAt: 0.8,
  tripKick: 3.4, stumbleKick: 2.2, slipKick: 2.4, bumpKick: 1.5, landKick: 0.9, catchK: 1.8,
};
W.legLen = W.thigh + W.shin;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function makeHalf(name, x, course) {
  const g = course.top(x);
  const half = {
    name, x, y: g + W.standH, vx: 0, vy: 0, th: 0, om: 0,
    feet: [{ x: x + 0.18, y: course.top(x + 0.18), sw: null }, { x: x - 0.18, y: course.top(x - 0.18), sw: null }],
    air: false, airT: 0, crouch: 0, down: false, downAt: 0, hopReady: false,
    steps: 0, lastStep: -9, ax: 0, skid: 0, wob: 0, inWater: false,
  };
  return half;
}

export class Walker {
  constructor(course, x = 0, opts = {}) {
    this.course = course;
    this.t = 0;
    this.front = makeHalf('front', x, course);
    this.back = makeHalf('back', x - W.gap, course);
    this.halves = [this.front, this.back];
    this.tear = 0;          // 0..1 seam damage this life
    this.stretch = 0;       // metres beyond rest (negative: bunched up)
    this.sStretch = 0;
    this.events = [];       // {type, half, ...} drained by the game each frame
    this.fallen = null;     // {half, why}
    this.patches = opts.patches || 0;
    this.k = { ...W, ...(opts.tune || {}) };
  }

  emit(type, half, extra) { this.events.push({ type, half: half && half.name, t: this.t, ...extra }); }

  // ---- input: a press is a stride; held a moment longer it's a crouch; let go of a crouch to hop
  press(name) {
    const h = this[name];
    if (h.down || this.fallen) return;
    h.down = true; h.downAt = this.t;
    if (h.air) return;
    this.step(h);
  }
  release(name) {
    const h = this[name];
    if (!h.down) return;
    h.down = false;
    if (h.crouch > 0.5 && !h.air && !this.fallen) this.hop(h);
    h.hopReady = false;
  }

  step(h) {
    const k = this.k, c = this.course;
    // the trailing foot moves; if it's already in the air you've lifted both: a stumble
    const [a, b] = h.feet;
    let foot = a.x <= b.x ? a : b, other = foot === a ? b : a;
    if (foot.sw || other.sw) {
      // a foot's still in the air: the next stride waits for it (one in hand); press again and you trip over yourself
      if (h.queued) { h.om += k.stumbleKick; h.queued = false; this.emit('stumble', h); }
      else h.queued = true;
      return;
    }
    const speedBoost = 1 + 0.25 * clamp(h.vx / 2, 0, 1);
    let x1 = h.x + Math.max(0, h.vx) * k.swingT * 0.9 + k.stride * speedBoost * (h.inWater ? 0.6 : 1);
    x1 = Math.min(x1, other.x + 1.05);
    if (x1 <= foot.x + 0.04) x1 = foot.x + 0.08;
    const y0 = foot.y;
    let y1 = c.top(x1);
    // does the swing clear whatever is between here and there?
    const peak = Math.max(y0, y1) + k.lift;
    let blocked = null;
    for (let i = 1; i <= 10; i++) {
      const u = i / 10, px = foot.x + (x1 - foot.x) * u;
      const py = y0 + (y1 - y0) * u + (peak - Math.max(y0, y1)) * 4 * u * (1 - u) + (Math.max(y0, y1) - (y0 + (y1 - y0) * u)) * 4 * u * (1 - u);
      if (c.top(px) > py + 0.01) { blocked = { px, u }; break; }
    }
    let trip = false;
    if (blocked) {
      // hoof hits the obstacle's face and comes down just short of it
      const ob = c.obstacleAt(blocked.px);
      x1 = Math.max(foot.x + 0.02, (ob ? ob.x0 : blocked.px) - 0.07);
      y1 = c.top(x1);
      trip = true;
    }
    foot.sw = { t: 0, x0: foot.x, y0, x1, y1, dur: k.swingT, peak: Math.max(y0, y1) + k.lift * (trip ? 0.7 : 1), trip, ob: blocked && c.obstacleAt(blocked.px) };
    h.steps++; h.lastStep = this.t;
    this.emit('step', h);
  }

  hop(h) {
    const k = this.k;
    h.air = true; h.airT = 0;
    const power = clamp((this.t - h.downAt - k.crouchAfter) / 0.25 + 0.6, 0.6, 1);
    h.vy = k.hopVy * power * (h.inWater ? 0.75 : 1);
    h.vx = Math.min(2.7, Math.max(h.vx, 1.2) + k.hopVx);
    h.om += h === this.front ? -0.7 : 0.25;
    h.crouch = 0;
    for (const f of h.feet) f.sw = null;
    h.queued = false;
    this.emit('hop', h);
  }

  update(dt) {
    if (this.fallen) return;
    this.t += dt;
    const k = this.k, c = this.course;
    const F = this.front, B = this.back;

    // costume between the hips
    const d = F.x - B.x;
    this.stretch = d - k.gap;
    let cf = 0;
    if (this.stretch > 0) cf = k.costumeK * this.stretch + k.costumeC * (F.vx - B.vx) * (this.stretch > 0.05 ? 1 : this.stretch / 0.05);
    this.sStretch += (this.stretch - this.sStretch) * Math.min(1, dt / 0.3);
    const over = this.sStretch - k.tearStart;
    if (over > 0) { this.tear += over * k.tearRate * dt * (1 + over * 6); }
    else this.tear = Math.max(0, this.tear - dt * 0.04);
    if (this.stretch > k.ripAt) this.tear = 1;
    if (this.tear >= 1) { this.tear = 1; this.fall(F, 'tear'); return; }
    // pulled hard, the costume drags whichever end is standing still (mostly the back, who can't see it coming)
    if (this.stretch > 0.28) {
      const v = (this.stretch - 0.28) * 2.2 * dt;
      if (!B.air) B.x += v * 0.7;
      if (!F.air) F.x -= v * 0.3;
    }

    for (const h of this.halves) {
      const sign = h === F ? -1 : 1;
      const water = c.waterAt(h.x);
      if (water && !h.inWater && !h.air) this.emit('splash', h);
      h.inWater = !!water && !h.air;

      // crouch while held
      if (h.down && !h.air && this.t - h.downAt > k.crouchAfter) {
        if (h.crouch === 0) this.emit('crouch', h);
        h.crouch = Math.min(1, h.crouch + dt / 0.14);
      } else if (!h.air) h.crouch = Math.max(0, h.crouch - dt / 0.1);

      // feet
      for (const f of h.feet) {
        if (!f.sw) continue;
        f.sw.t += dt;
        const u = clamp(f.sw.t / f.sw.dur, 0, 1);
        const e = u * u * (3 - 2 * u);
        f.x = f.sw.x0 + (f.sw.x1 - f.sw.x0) * e;
        const base = f.sw.y0 + (f.sw.y1 - f.sw.y0) * e;
        f.y = base + (f.sw.peak - Math.max(f.sw.y0, f.sw.y1)) * 4 * e * (1 - e) + 0.6 * k.lift * Math.sin(Math.PI * e) * 0;
        if (u >= 1) {
          const sw = f.sw; f.sw = null; f.x = sw.x1; f.y = sw.y1;
          if (sw.trip) { h.om += k.tripKick; h.vx *= 0.55; h.queued = false; this.emit('trip', h, { ob: sw.ob && sw.ob.type }); }
          else {
            // catching yourself: a stride forward pulls a forward lean back up
            if (h.th > 0) h.om -= k.catchK * Math.min(h.th, 0.8) * 2;
            const ob = c.obstacleAt(f.x);
            if (ob && ob.type === 'log') { h.om += k.slipKick * (Math.sin(this.t * 91) > 0 ? 1 : -0.7); this.emit('slip', h); }
            this.emit('land', h, { water: c.waterAt(f.x) });
          }
        }
      }

      if (h.queued && !h.air && !h.feet.some((f) => f.sw)) { h.queued = false; if (h.crouch < 0.5) this.step(h); }

      if (h.air) {
        h.airT += dt;
        h.vy -= 9.8 * dt;
        h.x += h.vx * dt; h.y += h.vy * dt;
        h.vx += sign * k.costumeK * Math.max(0, this.stretch - 0.15) * dt * 0.5;
        // feet tucked under, then reaching for the ground on the way down
        const reach = h.vy > 0 ? 0.55 : 0.55 + clamp(-h.vy / 3, 0, 1) * 0.3;
        const fx = [h.x + 0.2, h.x - 0.12];
        let landed = false, bonk = false;
        h.feet.forEach((f, i) => {
          const nx = fx[i], ny = h.y - reach;
          const top = c.top(nx);
          if (ny < top - 0.02) {
            const wasAbove = f.y >= c.top(f.x) - 0.03 || f.y >= top - 0.12;
            if (h.vy <= 0 && wasAbove) landed = true; else bonk = true;
          }
          f.x = nx; f.y = Math.max(ny, top);
        });
        if (bonk && h.airT > 0.04) {
          // hooves into the side of a bale: stop dead and pitch over
          h.vx = Math.min(h.vx, 0.2) * -0.3; h.om += k.tripKick * 0.9; this.emit('trip', h, { ob: 'side' });
        }
        if (landed && h.airT > k.hopMin) {
          h.air = false;
          for (const f of h.feet) { f.y = c.top(f.x); }
          const hard = Math.max(0, -h.vy - 2.6);
          h.om += k.landKick * hard + (h.th > 0.2 ? 0.6 : 0);
          h.vy = 0; h.vx *= 0.85;
          const ob = c.obstacleAt(h.feet[0].x) || c.obstacleAt(h.feet[1].x);
          if (ob && ob.type === 'log') { h.om += k.slipKick; this.emit('slip', h); }
          this.emit('landHop', h, { hard, water: c.waterAt(h.x) });
        }
      } else {
        // the hip follows the middle of whatever feet are down
        const planted = h.feet.filter((f) => !f.sw);
        const support = planted.length ? planted.reduce((s, f) => s + f.x, 0) / planted.length : (h.feet[0].x + h.feet[1].x) / 2;
        const off = 0.06 + clamp(h.vx, 0, 2) * 0.04;
        const glide = h.crouch > 0.01;
        let ax = glide ? -0.7 * h.vx + sign * cf : k.followK * (support + off - h.x) - k.followC * h.vx + sign * cf;
        if (h.inWater) ax -= h.vx * 4;
        h.ax += (ax - h.ax) * Math.min(1, dt * 20);
        h.vx += ax * dt; h.x += h.vx * dt;
        const gy = planted.length ? planted.reduce((s, f) => s + f.y, 0) / planted.length : c.top(h.x);
        const swinging = h.feet.some((f) => f.sw);
        const ty = gy + k.standH - h.crouch * k.crouchDepth - (swinging ? 0.035 : 0) - (h.inWater ? 0.06 : 0);
        h.vy += (140 * (ty - h.y) - 24 * h.vy) * dt; h.y += h.vy * dt;
        // a planted foot left too far behind gets dragged along the grass
        for (const f of planted) {
          const dx = h.x - f.x, dy = h.y - f.y, L = Math.hypot(dx, dy), max = W.legLen * 0.985;
          if (L > max) {
            const nx = h.x - Math.sign(dx) * Math.sqrt(Math.max(0, max * max - dy * dy));
            const top = c.top(nx);
            if (top > f.y + 0.05 && Math.abs(nx - f.x) > 0.001) { h.om += k.tripKick * 0.7; this.emit('trip', h, { ob: 'drag' }); f.y = top; }
            h.skid += Math.abs(nx - f.x);
            f.x = nx; f.y = c.top(nx);
          }
        }
        // a foot that's ended up too far ahead (being shoved) just shuffles
        if (planted.length === 2 && Math.abs(planted[0].x - planted[1].x) < 0.02) planted[1].x -= 0.01;
      }

      // tilt: a damped wobble around upright, with a point of no return
      const at = Math.abs(h.th);
      const hold = k.K * clamp(1 - (at - k.noReturn) / 0.4, 0, 1);
      const alpha = k.G * Math.sin(h.th) - hold * h.th - k.C * h.om - 0.035 * h.ax * (h.air ? 0 : 1);
      h.om += alpha * dt; h.th += h.om * dt;
      h.wob = Math.max(h.wob * Math.exp(-dt * 3), at);
      if (at > k.fallAt) { this.fall(h, h.th > 0 ? 'nose' : 'rear'); return; }
    }

    // bunching up: the back's head into the front's backside
    const dd = F.x - B.x;
    const minGap = k.gap - 0.12;
    if (dd > minGap + 0.04) this.bumping = false;
    if (dd < minGap) {
      const u = B.vx - F.vx;
      const push = minGap - dd;
      F.x += push * 0.55; B.x -= push * 0.45;
      if (u > 0.25 && !this.bumping) {
        F.om += k.bumpKick * Math.min(u, 2); B.om -= k.bumpKick * 0.4 * Math.min(u, 2);
        this.emit('bump', B, { u });
      }
      this.bumping = true;
      if (u > 0) {
        // the back shoves the front along; momentum is shared
        const m = (F.vx + B.vx) / 2;
        F.vx = Math.max(F.vx, m); B.vx = Math.min(B.vx, m + (B.air ? 0.3 : 0));
      }
    }
  }

  fall(h, why) {
    if (this.fallen) return;
    this.fallen = { half: h.name, why, t: this.t };
    this.emit('fall', h, { why });
  }

  x() { return (this.front.x + this.back.x) / 2; }
  nose() { return this.front.x + 0.7; }
  vx() { return (this.front.vx + this.back.vx) / 2; }
  still() { return Math.abs(this.front.vx) < 0.08 && Math.abs(this.back.vx) < 0.08 && !this.front.air && !this.back.air && this.front.feet.every((f) => !f.sw) && this.back.feet.every((f) => !f.sw); }

  // a pose for the renderer, the replay and the ragdoll: torsos and legs as points
  pose(out = {}) {
    const F = this.front, B = this.back;
    out.F = { x: F.x, y: F.y, a: -F.th * 0.9 - 0.08 };
    out.B = { x: B.x, y: B.y, a: -B.th * 0.8 };
    out.legs = [];
    for (const h of this.halves) for (const f of h.feet) out.legs.push(legIK(h.x, h.y, f.x, f.y));
    out.crouch = [F.crouch, B.crouch];
    out.air = [F.air, B.air];
    out.wob = [F.wob, B.wob];
    out.torn = false;
    out.stretch = this.stretch;
    out.tear = this.tear;
    out.patches = this.patches;
    return out;
  }
}

// two-bone IK, knee bending forward (they're people in there)
export function legIK(hx, hy, fx, fy) {
  const L1 = W.thigh, L2 = W.shin;
  let dx = fx - hx, dy = fy - hy;
  let d = Math.hypot(dx, dy);
  const max = L1 + L2 - 0.001;
  if (d > max) { dx *= max / d; dy *= max / d; fx = hx + dx; fy = hy + dy; d = max; }
  d = Math.max(d, 0.15);
  const a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const base = Math.atan2(dy, dx);
  const ka = base + a; // knee forward of the hip–foot line (facing +x, leg pointing down)
  return [hx, hy, hx + Math.cos(ka) * L1, hy + Math.sin(ka) * L1, fx, fy];
}
