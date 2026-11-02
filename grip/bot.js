// A climbing bot that drives the sim through the same thumbs a player has.
// Used by ?autoplay and by headless route checks. It is not clever, just methodical.
import { L, SHX, SHY } from './sim.js';

export class Bot {
  constructor(c, rand = Math.random) {
    this.c = c; this.rand = rand;
    this.mode = 'choose'; this.t = 0; this.target = null; this.hand = 0; this.fingers = [false, false];
    this.stuck = 0; this.sloppy = 0;
  }
  // finger helpers: d is the drag in world units this tick
  f(i, down, dx = 0, dy = 0) { this.fingers[i] = down; this.c.input(i, down, dx, dy); }
  hold(i) { this.f(i, this.fingers[i]); }
  shoulder(i, P = this.c.P) { return { x: P.x + (i ? 1 : -1) * SHX, y: P.y + SHY }; }

  tick(dt) {
    const c = this.c, P = c.P;
    this.t += dt;
    const gr = c.grips(), hs = c.hands;
    const speed = 520 * dt;
    if (c.summit) { this.hold(0); this.hold(1); return; }
    switch (this.mode) {
      case 'choose': {
        for (let i = 0; i < 2; i++) this.hold(i);
        const plan = this.plan();
        if (!plan && c.stand && !gr.length) {
          // shuffle along the ledge toward the nearest hold above
          let near = null; for (const H of c.holds) if (!H.broken && H.y > P.y && (!near || Math.abs(H.x - P.x) + (H.y - P.y) * 0.5 < Math.abs(near.x - P.x) + (near.y - P.y) * 0.5)) near = H;
          if (near) { const i = near.x < P.x ? 0 : 1, h = hs[i]; this.f(i, true, Math.sign(near.x - P.x) * speed, 0); this.f(1 - i, false); }
          break;
        }
        if (!plan) {
          this.stuck += dt;
          if (gr.length === 2) this.pullTo({ x: P.x, y: Math.max(hs[0].y, hs[1].y) + L * 0.5 }, speed);
          if (this.stuck > 0.8) { this.stuck = 0; if (gr.length === 2 && this.dynoTarget()) this.go('dyno-load'); else if (gr.length === 2) this.go('shuffle'); }
          break;
        }
        this.stuck = 0;
        this.target = plan.hold; this.hand = plan.hand; this.body = plan.body;
        if (hs[this.hand].state === 'grip') this.f(this.hand, false);
        this.go('reach');
        break;
      }
      case 'reach': {
        const i = this.hand, h = hs[i], T = this.target, o = hs[1 - i];
        if (!this.fingers[i] && this.t < 0.06) { this.hold(1 - i); this.f(i, false); break; }
        if (h.state === 'grip') {
          this.hold(1 - i); this.hold(i);
          this.go(T.t === 'rope' ? 'rope' : 'pull'); break;
        }
        let tx = T.x - h.x, ty = T.y - h.y; const d = Math.hypot(tx, ty) || 1;
        const m = Math.min(d, speed);
        this.f(i, true, tx / d * m, ty / d * m);
        // pull a little toward the target with the other hand, so it comes into reach
        if (o.state === 'grip' && o.hold.t !== 'rope') {
          this.pullTo(this.body, speed * 0.8, 1 - i);
        } else this.hold(1 - i);
        if (this.t > 1.4) this.go('choose');
        break;
      }
      case 'pull': {
        const g = gr.filter(h => h.hold.t !== 'rope');
        if (!g.length) { this.go('choose'); break; }
        const top = g.reduce((a, b) => (a.y > b.y ? a : b));
        const nx = this.nextAbove(top.y);
        const bx = g.reduce((s, h) => s + h.x, 0) / g.length;
        const want = { x: bx + (nx ? (nx.x - bx) * 0.35 : 0), y: top.y + L * 0.5 };
        this.pullTo(want, speed);
        if (this.t > 0.5 || (Math.abs(P.y - want.y) < 6 && Math.abs(c.V.y) < 30)) this.go('choose');
        break;
      }
      case 'rope': {
        const r = hs.find(h => h.state === 'grip' && h.hold.t === 'rope');
        if (!r) { this.go('choose'); break; }
        const free = 1 - r.i;
        // pump with the swing, and reach for rock with the free hand when it's near
        const want = Math.sign(c.V.x || 1) * L;
        this.f(r.i, true, -(want - (-r.ox)) * 0.3, 0);
        const plan = this.plan(free, true);
        if (plan && plan.hold.t !== 'rope' && plan.hold.y > r.y - 20) {
          this.target = plan.hold; this.hand = free;
          const h = hs[free], tx = plan.hold.x - h.x, ty = plan.hold.y - h.y, d = Math.hypot(tx, ty) || 1, m = Math.min(d, speed * 1.5);
          this.f(free, true, tx / d * m, ty / d * m);
        } else this.f(free, false);
        if (this.t > 20) this.go('choose');
        break;
      }
      case 'shuffle': {
        // nothing in reach: hang lower and to one side to change the angle
        const g = gr; if (g.length < 2) { this.go('choose'); break; }
        const nx = this.nextAbove(Math.max(g[0].y, g[1].y));
        const want = { x: (nx ? nx.x : P.x), y: Math.max(g[0].y, g[1].y) + L * 0.45 };
        this.pullTo(want, speed);
        if (this.t > 0.6) this.go('choose');
        break;
      }
      case 'dyno-load': {
        const g = gr; if (g.length < 2) { this.go('choose'); break; }
        const hy = Math.max(g[0].y, g[1].y);
        this.pullTo({ x: this.dyno.x, y: hy - L * 0.75 }, speed);
        if (this.t > 0.5) this.go('dyno-fire');
        break;
      }
      case 'dyno-fire': {
        const g = gr;
        const hy = this.dynoHy ?? (this.dynoHy = Math.max(...hs.map(h => h.y)));
        if (g.length) this.pullTo({ x: this.dyno.x, y: hy + L * 0.6 }, 5000 * dt);
        if (g.length && c.V.y > 0 && P.y > hy + 6) { this.f(0, false); this.f(1, false); this.dynoHy = null; this.go('dyno-fly'); }
        if (this.t > 0.8) { this.dynoHy = null; this.go('choose'); }
        break;
      }
      case 'dyno-fly': {
        const T = this.dyno;
        for (let i = 0; i < 2; i++) {
          if (this.t < 0.03) { this.f(i, false); continue; }
          const h = hs[i]; if (h.state === 'grip') { this.hold(i); continue; }
          const tx = T.x - h.x, ty = T.y - h.y, d = Math.hypot(tx, ty) || 1, m = Math.min(d, speed * 2);
          this.f(i, true, tx / d * m, ty / d * m);
        }
        if (gr.length || c.stand || this.t > 1.2) this.go(gr.length ? 'pull' : 'choose');
        break;
      }
    }
  }

  go(m) { this.mode = m; this.t = 0; }

  dragHand(i, want, speed) {
    const h = this.c.hands[i];
    const dox = want.x - this.c.P.x, doy = want.y - this.c.P.y;
    // body should move by (dox, doy): offset change = +, finger = -
    const d = Math.hypot(dox, doy) || 1, m = Math.min(d, speed);
    this.f(i, true, -dox / d * m, -doy / d * m);
    return h;
  }
  pullTo(want, speed, only = null) {
    const c = this.c;
    for (const h of c.hands) {
      if (only != null && h.i !== only) continue;
      if (h.state !== 'grip') { this.hold(h.i); continue; }
      const cur = { x: h.x + h.ox, y: h.y + h.oy };
      const dx = want.x - cur.x, dy = want.y - cur.y, d = Math.hypot(dx, dy) || 1, m = Math.min(d, speed);
      this.f(h.i, true, -dx / d * m, -dy / d * m);
    }
  }

  nextAbove(y) {
    let best = null;
    for (const H of this.c.holds) if (!H.broken && H.y > y + 15 && (!best || H.y < best.y)) best = H;
    return best;
  }

  // which hand should move, to which hold, and where should the other hand haul the body?
  plan(only = null, fromRope = false) {
    const c = this.c, hs = c.hands, P = c.P;
    const held = hs.filter(h => h.state === 'grip').map(h => h.hold);
    let best = null;
    const lowFirst = [0, 1].sort((a, b) => (hs[a].state === 'grip' ? hs[a].y : -1e9) - (hs[b].state === 'grip' ? hs[b].y : -1e9));
    for (const i of only != null ? [only] : lowFirst) {
      const o = hs[1 - i], side = i ? 1 : -1, me = hs[i];
      const rock = o.state === 'grip' && o.hold.t !== 'rope';
      if (!rock && !c.stand && !fromRope) continue;
      const floor = (me.state === 'grip' ? me.y : P.y - 40) + 8;
      for (const H of c.holds) {
        if (H.broken || held.includes(H) || H === me.lastHold) continue;
        if (H.t === 'rope' && fromRope) continue;
        if (H.y < floor) continue;
        const cross = o.state === 'grip' && (H.x - o.x) * side < -6 ? 45 : 0; // crossing hands is awkward
        const aim = { x: H.x - side * SHX, y: H.y - SHY };
        let body = { x: P.x, y: P.y };
        if (rock) {
          let vx = aim.x - o.x, vy = Math.min(aim.y - o.y, L * 0.5);
          const d = Math.hypot(vx, vy), m = L * 0.9; if (d > m) { vx *= m / d; vy *= m / d; }
          body = { x: o.x + vx, y: o.y + vy };
        }
        if (Math.hypot(aim.x - body.x, aim.y - body.y) > L * 0.92) continue;
        const score = H.y + (H.t === 'crimp' ? -18 : 0) + (H.t === 'crumble' ? -25 : 0) + (H.t === 'rope' ? 60 : 0) + (H.t === 'top' ? 999 : 0) - cross;
        if (!best || score > best.score) best = { hand: i, hold: H, score, body };
      }
      if (best && only == null) break;
    }
    return best;
  }

  dynoTarget() {
    const c = this.c, hs = c.hands;
    const hy = Math.max(hs[0].y, hs[1].y), hx = (hs[0].x + hs[1].x) / 2;
    let best = null;
    for (const H of c.holds) {
      if (H.broken) continue;
      const dy = H.y - hy, dx = Math.abs(H.x - hx);
      if (dy > 60 && dy < 200 && dx < 70 && (!best || H.y < best.y)) best = H;
    }
    this.dyno = best;
    return best;
  }
}
