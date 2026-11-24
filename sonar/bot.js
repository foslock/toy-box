// A test pilot: finds its way with the real map (a person has the chart), listens, stops when it is close.
import { flow, HOME, markById, sdf, clear } from './world.js';
import { brg, wrap, STOP } from './game.js';
export class Bot {
  constructor(g, o = {}) { this.g = g; this.o = { careful: true, pingEvery: 22, thr: 3, carry: 2, ...o }; this.pt = 4; this.hold = 0; this.r = 0; }
  target() {
    const g = this.g;
    const left = g.marks().filter(m => !g.delivered.includes(m.id) && !g.shot.includes(m.id));
    if (!left.length || g.shot.length >= this.o.carry || g.air < 260 || g.hull < 40 && g.shot.length) return { ...HOME, home: 1 };
    const film = g.wrecks.find(w => !w.done && w.film.length); if (film) return { x: film.x, y: film.y, wreck: 1 };
    return left.sort((a, b) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b.x - g.x, b.y - g.y))[0];
  }
  step(dt) {
    const g = this.g; if (!g.live) return;
    this.r -= dt; if (this.r > 0) return; this.r = .25;
    const t = this.target(), key = (t.id || t.home && 'home' || 'w') + '';
    if (this.key !== key || !this.f) { this.key = key; this.f = flow(t.x, t.y, 8); }
    const d = Math.hypot(t.x - g.x, t.y - g.y), see = clear(g.x, g.y, t.x, t.y), L = g.listen();
    if (this.o.careful) {
      if (g.c.st === 'feel') { g.throttle(STOP); return; }
      if (L && L.d < 45 && g.c.st !== 'flee') { g.throttle(STOP); if (g.c.st === 'hunt' && !g.decoy && g.decoys && L.d > 20) g.drop(); this.hold = 5; }
      if (this.hold > 0) { this.hold -= .25; return; }
    }
    this.pt -= .25; if (this.pt <= 0 && !(this.o.careful && g.c.st !== 'roam')) { this.pt = this.o.pingEvery; g.ping(); }
    let dir = see && d < 60 ? [(t.x - g.x) / d, (t.y - g.y) / d] : this.f.dir(g.x, g.y);
    // look a little further along the flow
    if (!(see && d < 60)) { let x = g.x, y = g.y; for (let i = 0; i < 3; i++) { const q = this.f.dir(x, y); x += q[0] * 6; y += q[1] * 6; } const l = Math.hypot(x - g.x, y - g.y) || 1; dir = [(x - g.x) / l, (y - g.y) / l]; }
    const b = brg(dir[0], dir[1]); g.order(b);
    const off = Math.abs(wrap(b - g.h));
    if (t.home && g.atHome) { g.throttle(STOP); g.winch(); return; }
    if (t.id && see && d < 28) { g.throttle(d < 12 + t.near ? STOP : STOP); if (off < .2 && g.cam <= 0) g.shoot(); return; }
    let n = off > 1.2 ? STOP : off > .5 ? 2 : this.o.thr; if (g.feelers()[1] < 14) n = Math.min(n, 2);
    if (t.wreck && d < 40) n = Math.min(n, 2);
    g.throttle(n);
  }
}
