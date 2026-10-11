// A simple player for the demo and the balance sim. It rates every slot for every part by how much of the
// groove the tower would reach, then buys down a fixed shopping list, upgrading when it runs out of slots.
import { PARTS, DUST } from './levels.js';

export class Bot {
  constructor(game, { sloppy = 0, rand = Math.random, order } = {}) {
    this.g = game; this.sloppy = sloppy; this.rand = rand;
    this.order = order || ['hat', 'kick', 'bass', 'snare', 'hat', 'kick', 'snare', 'hat', 'bass', 'kick'];
    this.n = 0; this.cool = 0;
    // coverage[slot][part] = share of groove samples within reach (inner grooves count a bit more)
    this.cover = game.slots.map(s => {
      const o = {};
      for (const p in PARTS) {
        const R = PARTS[p].range[0];
        let hit = 0, all = 0;
        for (let phi = 0; phi < game.phiMax; phi += 0.05) {
          for (let a = 0; a < 6.28; a += 0.4) {
            const q = game.posOf(phi, a), w = 1 + phi / game.phiMax;
            all += w;
            if (Math.hypot(q.x - s.x, q.y - s.y) < R) hit += w;
          }
        }
        o[p] = hit / all;
      }
      return o;
    });
  }
  // what the bot would do next, without doing it (null if it's saving up)
  next() {
    const g = this.g;
    const part = this.order[this.n % this.order.length];
    const free = g.slots.map((s, i) => i).filter(i => !g.towerAt(i));
    // mostly buy new; upgrade every third purchase once a few are down, or when the slots are full
    const wantUp = (g.towers.length >= 4 && this.n % 3 === 2) || !free.length;
    if (wantUp) {
      const t = g.towers.filter(t => t.lvl < 3).sort((a, b) => b.kills - a.kills)[0];
      if (!t) { this.n++; return null; }
      return g.nickels >= g.upCost(t) ? { type: 'up', tower: t } : null;
    }
    if (g.nickels < PARTS[part].cost[0]) return null;
    let pick = free.sort((a, b) => this.cover[b][part] - this.cover[a][part])[0];
    if (this.sloppy && this.rand() < this.sloppy) pick = free[Math.floor(this.rand() * free.length)];
    return { type: 'place', slot: pick, part };
  }
  update(dt) {
    const g = this.g;
    if (g.state === 'won' || g.state === 'lost') return;
    if (this.sloppy && g.state === 'track') return;     // a sloppy player only builds between tracks
    this.cool -= dt;
    if (this.cool > 0) return;
    this.cool = 0.5;
    const a = this.next();
    if (!a) return;
    if (a.type === 'up') g.upgrade(a.tower); else g.place(a.slot, a.part);
    this.n++;
  }
}
