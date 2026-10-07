// Scales: a stand-in player for ?demo, ?autoplay and the balance runs. It looks along the plank for where the piece in
// the pan would land and weighs keeping the plank level against landing by its twin, then tries its best few spots
// in a copy of the world (one a tick, so a page never stalls) and drops where things went best, through the same aim
// and drop a person's drag gives the game. opt.skill (0..1) is how well it reads the plank, opt.look how many spots
// it tries out, opt.sloppy its aim error, opt.edge how much it keeps heaps away from the ends (a learned habit),
// opt.greed how much it chases merges.
import { PRODUCE } from './produce.js';
import { STEP, PAN_Y } from './game.js';
import { G, massOf } from './physics.js';

export class Bot {
  constructor(opt = {}) {
    this.skill = opt.skill ?? 0.8; this.greed = opt.greed ?? 1; this.edge = opt.edge ?? 0; this.sloppy = opt.sloppy ?? 6; this.think = opt.think ?? 0.6; this.look = opt.look ?? 10;
    this.rand = opt.rand || Math.random; this.wait = 0.4; this.target = null; this.plan = null;
  }
  tick(g) {
    if (g.state !== 'play') return;
    if (g.crow.st === 'perch' && this.skill > 0.5 && this.rand() < STEP * 0.15) g.shoo();
    if (!g.ready) { this.target = null; this.plan = null; return; }
    if (this.target == null) {
      if (!this.plan) { this.plan = { tier: g.pan.tier, todo: this.shortlist(g), done: [] }; g.aim(this.plan.todo[0]?.x ?? 0); }
      const P = this.plan;
      if (P.todo.length && P.done.length < this.look) { const c = P.todo.shift(); c.v += this.tryOut(g, c.x); P.done.push(c); }
      if (this.wait > 0) { this.wait -= STEP; return; }
      if (P.todo.length && P.done.length < this.look) return;
      const all = P.done.concat(P.todo);
      all.sort((a, b) => b.v - a.v);
      this.target = (all[0]?.x ?? 0) + (this.rand() - 0.5) * 2 * this.sloppy; this.plan = null;
      g.aim(this.target);
      return;
    }
    if (Math.abs(g.pan.x - g.pan.tx) < 1.5 && Math.abs(g.pan.vx) < 30) {
      // hold off while a gust is up, if it's paying attention
      if (g.wind.st === 'gust' && this.skill > 0.6) return;
      g.drop(); this.target = null; this.wait = this.think * (0.5 + this.rand());
    }
  }
  // drop it at x in a copy of the world and see what happens over the next second and a bit
  tryOut(g, x) {
    const w = g.world.clone(), tier = g.pan.tier, r = PRODUCE[tier].r;
    const b = w.add(tier, x, PAN_Y - r * 0.7); b.fresh = true;
    let merges = 0, fell = 0;
    for (let i = 0; i < 80; i++) {
      w.tick();
      for (const e of w.events) if (e.type === 'merge') merges++;
      w.events.length = 0;
      for (const q of w.bodies) if (q.onGround || q.y > w.groundY) { fell = 1; break; }
      if (fell) break;
    }
    const pk = w.plank;
    let moving = 0;
    for (const q of w.bodies) moving += Math.min(1, Math.hypot(q.vx, q.vy) / 120);
    const lean = (w.torque() * G / pk.k) / pk.max;
    const ends = this.edge ? w.bodies.reduce((a, q) => a + (Math.abs(q.x) > pk.L * 0.33 && q.y < -60 ? 1 : 0), 0) * this.edge * 0.5 : 0;
    return -ends - fell * 40 * this.skill + merges * 1.2 * this.greed - Math.abs(pk.th / pk.max) * 3 * this.skill - lean * lean * 3 * this.skill - moving * 0.6 * this.skill;
  }
  // the spots worth trying, best first by a quick look
  shortlist(g) {
    const w = g.world, pk = w.plank, tier = g.pan.tier, r = PRODUCE[tier].r, m = massOf(r);
    const lim = g.panRange(), torque = w.torque();
    const tilt = pk.th / pk.max;
    const out = [];
    for (let x = -lim; x <= lim; x += 6) {
      // where it lands, and where it ends up if it lands on something's shoulder and rolls off
      let land = g.landing(x, r), fx = x, hops = 0;
      while (land.on && hops < 3) {
        const dx = fx - land.on.x, R = land.on.r + r;
        if (Math.abs(dx) < R * (0.35 + 0.25 * (1 - this.skill))) break;
        fx = land.on.x + Math.sign(dx) * R * 1.02; land = g.landing(fx, r); hops++;
      }
      if ((land.off || Math.abs(fx) > pk.L / 2 - r * (1.6 * this.skill)) && this.skill > 0.2) continue;
      const after = (torque + m * fx) * G / pk.k / pk.max;   // fraction of the way to the ground, roughly
      let v = -after * after * 6 - Math.abs(after + tilt * 0.5) * 2 * this.skill - hops * 0.4 * this.skill;
      if (land.on && land.on.tier === tier) v += 3.2 * this.greed;
      else {
        for (const b of w.bodies) {
          if (b.tier !== tier) continue;
          if (Math.hypot(b.x - fx, b.y - land.y) < b.r + r + 10) { v += 2 * this.greed; break; }
        }
        if (land.on && land.on.tier < tier) v -= 0.9 * this.skill;   // big on small rolls off
      }
      v -= Math.max(0, (Math.abs(fx) - (pk.L / 2 - r - 24)) / 20) * this.skill;
      v -= Math.max(0, -land.y - 150) / 160;
      // a cautious player keeps the ends for small things and the middle for heaps
      if (this.edge) v -= this.edge * Math.max(0, Math.abs(fx) / (pk.L / 2) - 0.6) * (1 + Math.max(0, -land.y - 40) / 40) * (r / 14);
      v += (this.rand() - 0.5) * (1.6 - this.skill);
      out.push({ x, v });
    }
    out.sort((a, b) => b.v - a.v);
    // the best few, plus a couple from further down the list in case the quick look is wrong
    const head = out.slice(0, Math.max(1, this.look - 2)), rest = out.slice(this.look - 2);
    for (let i = 0; i < 2 && rest.length; i++) head.push(rest.splice(this.rand() * rest.length | 0, 1)[0]);
    return head.length ? head : [{ x: 0, v: 0 }];
  }
}
