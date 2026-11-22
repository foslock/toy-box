// The wipeout: when the horse goes over, its last pose becomes a planck.js (Box2D) ragdoll
// and physics takes it from there. Gives back poses in the same shape as Walker.pose().
import { World, Vec2, Box, Circle, Chain, RevoluteJoint, DistanceJoint } from 'planck';
import { W } from './walker.js';

const CAT = { GROUND: 1, BODY: 2, LEG: 4 };

function placeBox(world, cx, cy, a, hx, hy, density, cat, mask, friction = 0.7) {
  const b = world.createBody({ type: 'dynamic', position: Vec2(cx, cy), angle: a, angularDamping: 0.6, linearDamping: 0.05 });
  b.createFixture(new Box(hx, hy), { density, friction, restitution: 0.15, filterCategoryBits: cat, filterMaskBits: mask });
  return b;
}

export class Ragdoll {
  constructor(course, pose, vel, opts = {}) {
    const w = this.world = new World({ gravity: Vec2(0, -9.8) });
    this.torn = !!opts.torn;
    // the ground around the fall, and anything on it
    const x0 = Math.min(pose.F.x, pose.B.x) - 8, x1 = Math.max(pose.F.x, pose.B.x) + 8;
    const pts = [];
    for (let x = x0; x <= x1; x += 0.2) pts.push(Vec2(x, course.floor(x)));
    const g = w.createBody();
    g.createFixture(new Chain(pts, false), { friction: 0.9, filterCategoryBits: CAT.GROUND });
    for (const o of course.solid) {
      if (o.x1 < x0 || o.x0 > x1) continue;
      if (o.type === 'log') g.createFixture(new Circle(Vec2(o.x, o.r), o.r), { friction: 0.6, filterCategoryBits: CAT.GROUND });
      else g.createFixture(new Box(o.w / 2, o.h / 2, Vec2(o.x, o.h / 2), 0), { friction: 0.8, filterCategoryBits: CAT.GROUND });
    }
    const M = CAT.GROUND | CAT.BODY;
    const ML = CAT.GROUND;
    // torsos: the front stands on its hip, the back lies forward from its hip
    const fa = pose.F.a, ba = pose.B.a;
    const fc = rot(0, W.fTorso / 2, fa);
    this.F = placeBox(w, pose.F.x + fc[0], pose.F.y + fc[1], fa, 0.17, W.fTorso / 2, 160, CAT.BODY, M);
    this.F.hipLocal = Vec2(0, -W.fTorso / 2);
    this.F.waistLocal = Vec2(-0.17, -W.fTorso * 0.2);
    const bc = rot(W.bTorso / 2 - 0.08, 0.06, ba);
    this.B = placeBox(w, pose.B.x + bc[0], pose.B.y + bc[1], ba, W.bTorso / 2, 0.15, 140, CAT.BODY, M);
    this.B.hipLocal = Vec2(-(W.bTorso / 2 - 0.08), -0.06);
    this.B.handsLocal = Vec2(W.bTorso / 2, -0.03);
    this.bodies = [this.F, this.B];
    this.legs = [];
    pose.legs.forEach((L, i) => {
      const torso = i < 2 ? this.F : this.B;
      const [hx, hy, kx, ky, fx, fy] = L;
      const ta = Math.atan2(ky - hy, kx - hx) + Math.PI / 2, sa = Math.atan2(fy - ky, fx - kx) + Math.PI / 2;
      const thigh = placeBox(w, (hx + kx) / 2, (hy + ky) / 2, ta, 0.07, W.thigh / 2, 120, CAT.LEG, ML);
      const shin = placeBox(w, (kx + fx) / 2, (ky + fy) / 2, sa, 0.065, W.shin / 2, 120, CAT.LEG, ML, 1);
      const hrel = ta - torso.getAngle();
      const hip = w.createJoint(new RevoluteJoint({ enableLimit: true, lowerAngle: Math.min(-0.9 - hrel, -0.02), upperAngle: Math.max(1.7 - hrel, 0.02), enableMotor: true, maxMotorTorque: 18, motorSpeed: 0 }, torso, thigh, Vec2(hx, hy)));
      const rel = sa - ta;
      const knee = w.createJoint(new RevoluteJoint({ enableLimit: true, lowerAngle: Math.min(-2.1 - rel, -0.02), upperAngle: Math.max(0.05 - rel, 0.02), enableMotor: true, maxMotorTorque: 10, motorSpeed: 0 }, thigh, shin, Vec2(kx, ky)));
      this.legs.push({ thigh, shin, hip, knee });
      this.bodies.push(thigh, shin);
    });
    if (!this.torn) {
      const a = this.B.getWorldPoint(this.B.handsLocal), b = this.F.getWorldPoint(this.F.waistLocal);
      this.spring = w.createJoint(new DistanceJoint({ frequencyHz: 2.2, dampingRatio: 0.5, length: Math.max(0.08, Math.min(0.4, Vec2.distance(a, b))), collideConnected: true }, this.B, this.F, a, b));
    }
    // carry on with the speed and spin the horse had when it went
    const fv = vel.front, bv = vel.back;
    for (const [i, b] of this.bodies.entries()) {
      const v = i === 0 || (i >= 2 && i < 6) ? fv : i === 1 || i >= 6 ? bv : fv;
      b.setLinearVelocity(Vec2(v.vx, v.vy));
    }
    this.F.setAngularVelocity(fv.spin); this.B.setAngularVelocity(bv.spin);
    if (this.torn) {
      // the seam goes: the halves spring apart
      this.F.applyLinearImpulse(Vec2(18, 10), this.F.getWorldCenter(), true);
      this.B.applyLinearImpulse(Vec2(-14, 6), this.B.getWorldCenter(), true);
    }
    this.t = 0;
    this.spin = 0;
    this.peakY = 0;
    this.hits = [];
    w.on('post-solve', (c, imp) => {
      const n = imp.normalImpulses[0] || 0;
      if (n > 22) this.hits.push(n);
    });
  }

  step(dt) {
    this.t += dt;
    this.world.step(dt, 8, 4);
    this.spin += (Math.abs(this.F.getAngularVelocity()) + Math.abs(this.B.getAngularVelocity())) * dt;
    this.peakY = Math.max(this.peakY, this.F.getPosition().y, this.B.getPosition().y);
  }

  pose(out = {}) {
    const F = this.F, B = this.B;
    const fh = F.getWorldPoint(F.hipLocal), bh = B.getWorldPoint(B.hipLocal);
    out.F = { x: fh.x, y: fh.y, a: F.getAngle() };
    out.B = { x: bh.x, y: bh.y, a: B.getAngle() };
    out.legs = this.legs.map(({ thigh, shin }, i) => {
      const torso = i < 2 ? F : B;
      const h = torso.getWorldPoint(torso.hipLocal);
      const k = thigh.getWorldPoint(Vec2(0, -W.thigh / 2));
      const f = shin.getWorldPoint(Vec2(0, -W.shin / 2));
      return [h.x, h.y, k.x, k.y, f.x, f.y];
    });
    out.crouch = [0, 0]; out.air = [false, false]; out.wob = [1, 1];
    out.torn = this.torn;
    out.ragdoll = true;
    return out;
  }

  settled() {
    if (this.t < 1.4) return false;
    if (this.t > 3.2) return true;
    return this.bodies.every((b) => b.getLinearVelocity().length() < 0.25);
  }
  x() { return (this.F.getPosition().x + this.B.getPosition().x) / 2; }
  spectacle() { return this.spin + this.peakY * 2 + this.hits.length * 0.3 + (this.torn ? 3 : 0); }
}

function rot(x, y, a) { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; }
