// A conductor made of arithmetic, for the ?demo stage and for tuning. It moves a pointer along the card, so it
// goes through the same corner-finder as a finger does.
import { PATTERNS, cardScale, Turns } from './engine.js';
export class Bot {
  constructor(perf, pad, { sloppy = 0, slow = .35, miss = 0, seed = 1 } = {}) {
    this.p = perf; this.pad = pad; this.sloppy = sloppy; this.slow = slow; this.miss = miss; this.s = seed >>> 0 || 1;
    this.i = 0; this.t0 = null; this.t1 = null; this.seen = new Set(); this.err = 0; this.x = pad.cx; this.y = pad.cy; this.from = this.node(0);
    this.turns = new Turns(pad.size); this.pending = [];
  }
  r() { this.s ^= this.s << 13; this.s >>>= 0; this.s ^= this.s >>> 17; this.s ^= this.s << 5; this.s >>>= 0; return this.s / 4294967296; }
  node(i) {
    const m = this.p.meter, n = PATTERNS[m][i % m], lv = this.p.markAt(i).dyn + (this.sloppy ? (this.r() - .5) * this.sloppy * .5 : 0);
    const s = cardScale(lv) * this.pad.size; return [this.pad.cx + n[0] * s, this.pad.cy + n[1] * s];
  }
  pos(t) {
    if (this.t0 == null) { this.t0 = t; this.t1 = t + .5; this.from = [this.pad.cx, this.pad.cy - 40]; this.to = this.node(0); }
    while (t >= this.t1) {
      this.from = this.to; this.i++; this.to = this.node(this.i); const f = this.p.c.ferm.find(x => x.beat === this.i - 1);
      const per = 60 / this.p.markAt(this.i).bpm * (1 + (this.r() - .5) * this.sloppy * .5);
      this.t0 = this.t1; this.t1 += (f ? f.sec : 0) + per;
    }
    const f = this.p.c.ferm.find(x => x.beat === this.i - 1);
    const dur = this.t1 - this.t0, hold = f ? f.sec : 0, u = Math.max(0, (t - this.t0 - hold) / (dur - hold)), e = u * u * (3 - 2 * u);
    return [this.from[0] + (this.to[0] - this.from[0]) * e, this.from[1] + (this.to[1] - this.from[1]) * e];
  }
  // Called every frame. Feeds Turns, conducts and answers requests after a human sort of pause.
  step(t) {
    const [x, y] = this.pos(t); const moved = x !== this.x || y !== this.y; this.x = x; this.y = y;
    const c = (moved ? this.turns.push(x, y, t) : null) || this.turns.idle(t); if (c) this.p.ictus(t, { ...c, size: this.pad.size });
    for (const r of this.p.requests()) {
      if (this.seen.has(r.ref)) continue; this.seen.add(r.ref);
      if (this.r() < this.miss) continue;
      const wait = r.kind === 'cue' ? Math.max(0, (r.ref.beat - this.p.pos - .5) * this.p.period) + this.slow * this.r() : this.slow + this.r() * this.slow * 2;
      this.pending.push({ at: t + wait, sec: r.sec });
    }
    this.pending = this.pending.filter(q => { if (t >= q.at) { this.p.point(q.sec, t); return false; } return true; });
  }
}
