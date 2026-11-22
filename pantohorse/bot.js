// A pair of thumbs that can play: taps each half in turn and hops each half over whatever's coming.
// Used for the ?demo screenshot, the Derby's rival horses and the balance sims. No DOM.
import { W } from './walker.js';

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

export class Bot {
  constructor(walker, opts = {}) {
    this.w = walker;
    this.rate = opts.rate ?? 3.4;      // taps per second, per thumb
    this.skill = opts.skill ?? 0.95;   // 1 = perfect timing
    this.tapLen = opts.tapLen ?? 0.08;
    this.rand = rng(opts.seed ?? 7);
    this.stopAt = opts.stopAt ?? null; // function(x) -> target x to halt at, or null
    this.paceX = opts.paceX ?? null;   // function() -> x the nose shouldn't pass
    this.hops = opts.hops ?? true;
    this.s = {
      front: { next: 0.3, up: -1, hop: null, done: new Set() },
      back: { next: 0.3 + 0.5 / this.rate, up: -1, hop: null, done: new Set() },
    };
  }

  // plan where a half should leave the ground for obstacle o
  takeoff(h, o) {
    const vx = Math.max(h.vx, 0.6) + W.hopVx;
    const err = (1 - this.skill) * (this.rand() - 0.5) * 2.2;
    const D = vx * 0.6;
    if (o.type === 'ditch') return Math.min(o.x0 - 0.3, o.x1 + 0.2 - D) + err;
    return Math.min(o.x0 - 0.24, o.x1 + 0.2 - D) + err;
  }

  tick(t) {
    const w = this.w;
    if (w.fallen) { for (const n of ['front', 'back']) if (w[n].down) w.release(n); return; }
    let halt = this.stopAt ? this.stopAt(w) : null;
    for (const name of ['front', 'back']) {
      const s = this.s[name], h = w[name];
      if (s.hop) {
        if (h.x >= s.hop.x || t - s.hop.start > 0.9) {
          if (t - s.hop.start > W.crouchAfter + 0.1) { w.release(name); s.done.add(s.hop.o); s.hop = null; s.next = t + 0.05; s.up = -1; s.wasAir = true; }
        }
        continue;
      }
      if (h.air) { s.next = t + 0.02; continue; }
      if (this.hops) {
        const o = w.course.nextObstacle(h.x - 0.2);
        if (o && !s.done.has(o) && o.x1 > h.x) {
          const tx = this.takeoff(h, o);
          const lead = Math.max(h.vx, 0.5) * (W.crouchAfter + 0.12);
          if (h.x >= tx - lead && h.x < o.x0 + 0.1) {
            if (s.up > 0) { w.release(name); s.up = -1; }
            s.hop = { x: tx, o, start: t };
            w.press(name);
            continue;
          }
          if (h.x > o.x1) s.done.add(o);
        }
      }
      if (s.up > 0 && t >= s.up) { w.release(name); s.up = -1; }
      let rate = this.rate;
      if (halt != null) {
        const dist = halt - (name === 'front' ? w.front.x : w.back.x + W.gap);
        if (dist < 0.35) continue;
        if (dist < 1.6) rate = Math.min(rate, 1.6);
      }
      if (this.paceX) { const ahead = w.nose() - this.paceX(); if (ahead > -0.3) continue; if (ahead > -1.2) rate = Math.min(rate, 2.2); }
      // keep the halves together: the back hurries if it's lagging, the front waits if it's too far ahead
      if (name === 'back' && w.stretch > 0.12) rate *= 1.25;
      if (name === 'front' && w.stretch > 0.22) continue;
      if (name === 'back' && w.stretch < -0.06) continue;
      if (t >= s.next) {
        w.press(name); s.up = t + this.tapLen;
        const jitter = (1 - this.skill) * (this.rand() - 0.5) * 0.5 / rate;
        s.next = Math.max(s.next + 1 / rate, t + 0.6 / rate) + jitter;
      }
    }
  }
}
