// Ladder: a stand-in player for ?autoplay and the balance checks. It follows the plan check.mjs works out (where to
// stand on each ledge and where to aim), through the same commands a person's taps and drags give the game.
// opt.speed is how fast it climbs (m/s); opt.sloppy adds a random error to where it stands and aims.
import { PLAN } from './plan.js';
import { TICK } from './game.js';

export class Bot {
  constructor(heap, opt = {}) {
    this.heap = heap; this.speed = opt.speed ?? 0.9; this.sloppy = opt.sloppy ?? 0; this.rand = opt.rand || Math.random;
    this.think = opt.think ?? 0;   // seconds a person spends looking before each try
    this.state = 'idle'; this.wait = 0; this.target = null; this.stuck = 0;
  }
  ledgeAt(g) {
    let best = null, bd = 0.6;
    for (const L of PLAN) for (const [x, y] of L.spots) { const d = Math.abs(x - g.p.x) + Math.abs(y - g.p.y) * 2; if (d < bd) { bd = d; best = L; } }
    return best;
  }
  tick(g) {
    if (this.wait > 0) { this.wait -= TICK; return; }
    if (g.mode === 'climb') { g.climbBy(this.speed * TICK); return; }
    if (g.mode !== 'stand') { this.target = null; return; }
    if (!this.target) {
      const S = this.heap.summit;
      if (S && g.p.y > S.y0 - 0.3 && g.p.x > S.x0 - 6 && g.p.x < S.x1 + 6) { g.walkTo = (S.x0 + S.x1) / 2; return; }
      const L = this.ledgeAt(g);
      if (!L) { this.stuck += TICK; if (this.stuck > 2) { this.hops = (this.hops || []); this.hops.push([+g.p.x.toFixed(2), +g.p.y.toFixed(2)]); g.p.edge = g.p.edge || 1; g.hop(); this.stuck = 0; } return; }
      this.stuck = 0;
      const err = () => (this.rand() - 0.5) * 2 * this.sloppy;
      this.target = { x: L.x + err() * 0.4, aim: L.aim + err() * 6 };
      this.wait = 0.25 + this.think * (0.6 + this.rand() * 0.8);
      return;
    }
    const T = this.target;
    T.age = (T.age || 0) + TICK;
    if (T.age > 8) { this.target = null; return; }   // couldn't get it done from there: think again
    if (Math.abs(g.p.x - T.x) > 0.012) {
      // can't get any closer (a wall, an edge): try from here
      if (g.walkTo == null && T.lastX != null && Math.abs(g.p.x - T.lastX) < 1e-4) { T.x = g.p.x; return; }
      T.lastX = g.p.x;
      if (g.walkTo == null) { g.walkTo = T.x; if (g.held === 'planted') g.held = 'carry'; }
      if (g.p.edge && Math.sign(T.x - g.p.x) === g.p.edge) { T.x = g.p.x; }
      return;
    }
    if (g.held === 'planted') { g.climbBy(0.05); return; }
    if (g.mode === 'stand') {
      // aim where the plan says; if that leans on nothing from exactly here, feel around it a little
      g.aimStart();
      for (const d of [0, -2, 2, -4, 4, -7, 7]) { g.aimA = (T.aim + d) * Math.PI / 180; g.aimPose = g.place(g.aimA); if (g.aimPose?.ok) break; }
      const r = g.aimEnd();
      if (r !== 'planted') { this.target = null; this.wait = 0.5; this.fails = (this.fails || 0) + 1; }
      else { this.wait = 0.3; this.fails = 0; }
    }
  }
}
