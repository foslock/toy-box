// A bot that draws the track ahead of the sled: it plans a height for every x from what's coming
// (stay over rocks and low blots, under high ones, through gates, clear of the scribble) and draws toward it
// with a limit on how sharply the line can bend. Used for ?demo, the title screen and the balance sim.
import { R } from './game.js';

export class Bot {
  constructor(game, { sloppy = 0, rand = Math.random } = {}) {
    this.g = game; this.pen = null; this.slope = 0.2;
    this.sloppy = sloppy; this.rand = rand;
    this._n = [];
  }

  // the highest (smallest y) and lowest the line may be at x, from everything within reach
  limits(x) {
    const g = this.g, c = g.course;
    let lo = -Infinity, hi = c.floor(x) - 90;           // lo: line must be below this (y >); hi: must be above (y <)
    const CLIMB = 0.22, DIVE = 0.9;
    for (const o of c.near(x - 40, x + 520, this._n)) {
      let need = null, keep = null, x0 = o.x0 - 30, x1 = o.x1 + 30;
      if (o.type === 'pillar') need = o.top - 48;
      else if (o.type === 'blot') {
        if (o.y > c.baseline(o.x) - 10) need = o.y - o.r * 1.2 - 44;
        else keep = o.y + o.r * 1.2 + 26;
      } else if (o.type === 'gate') {
        need = o.y + o.gap / 2 - 22 + R; keep = o.y - o.gap / 2 + 26 + R; x0 = o.x - 40; x1 = o.x + 40;
      } else continue;
      if (need !== null) {
        const v = x < x0 ? need + CLIMB * (x0 - x) : x <= x1 ? need : Infinity;
        hi = Math.min(hi, v);
      }
      if (keep !== null) {
        const v = x < x0 ? keep - DIVE * (x0 - x) : x <= x1 ? keep : -Infinity;
        lo = Math.max(lo, v);
      }
    }
    return [lo, hi];
  }

  update() {
    const g = this.g, rd = g.rider, c = g.course;
    if (g.state === 'ready') {
      const l = c.ledges.filter(l => l.x0 <= rd.x + 1 && l.x1 >= rd.x - 1).pop();
      const end = l ? l.pts[l.pts.length - 1] : { x: rd.x + 20, y: rd.y + 10 };
      this.pen = { x: end.x, y: end.y };
      this.slope = 0.3;
      g.beginStroke(end.x, end.y, 30);
      return;
    }
    if (g.state !== 'ride') return;
    const sp = Math.hypot(rd.vx, rd.vy);
    const ahead = rd.x + 150 + sp * (0.55 + this.sloppy * 0.3);
    if (!g.stroke) {
      if (g.ink < 300) return;
      // pencil back down: just in front of where the sled is going
      const x = Math.max(this.pen.x, rd.x + 60);
      const [, hi] = this.limits(x);
      const y = Math.min(hi, rd.y + (x - rd.x) * Math.max(0.2, rd.vy / Math.max(1, rd.vx)) + 40);
      this.pen = { x, y };
      g.beginStroke(x, y);
    }
    let guard = 0;
    while (this.pen.x < ahead && guard++ < 60) {
      const x = this.pen.x + 12;
      const [lo, hi] = this.limits(x);
      let want = c.baseline(x) + 45;
      if (sp < 260) want += 70;
      if (sp > 700) want -= 40;
      want = Math.max(lo, Math.min(hi, want));
      if (this.sloppy) want += (this.rand() - 0.5) * 60 * this.sloppy;
      let s = (want - this.pen.y) / 60;
      s = Math.max(-0.42, Math.min(1.1, s));
      this.slope += (s - this.slope) * 0.22;
      const y = this.pen.y + this.slope * 12;
      const d = g.extendStroke(x, y);
      if (d < 0) { g.endStroke(); break; }
      if (d === 0) break;
      const p = g.stroke.pts[g.stroke.pts.length - 1];
      this.pen = { x: p.x, y: p.y };
    }
  }
}
