// A stand-in player: used by ?demo and by the balance sim. It has habits of its own on purpose.
import { mulberry } from './game.js';

export class Bot {
  constructor(g, o = {}) {
    this.g = g;
    this.rand = mulberry(o.seed ?? 7);
    this.react = o.react ?? .14;        // how late it can still see a swing coming
    this.skill = o.skill ?? .75;        // chance it notices a swing at all
    this.bias = o.bias ?? null;         // favourite roll
    this.string = o.string ?? 2;
    this.heavyP = o.heavyP ?? .15;
    this.circle = o.circle ?? (this.rand() < .5 ? 1 : -1);
    this.seen = null; this.dodgeAt = -1; this.swingsLeft = 0; this.think = 0;
  }
  step(dt) {
    const g = this.g, p = g.p, k = g.k, I = g.input;
    I.mx = 0; I.my = 0;
    if (p.state === 'dead' || g.over) return;
    const dx = k.x - p.x, dy = k.y - p.y, d = Math.hypot(dx, dy), ux = dx / (d || 1), uy = dy / (d || 1);
    const ranged = p.w.range > 150;
    // --- danger: a swing coming
    if (k.a && (k.a !== this.seen || k.a.n !== this.seenN)) {
      this.seen = k.a; this.seenN = k.a.n;
      this.dodgeAt = this.rand() < this.skill ? this.react * (.5 + this.rand()) : -1;
    }
    let danger = false;
    if (k.a && k.a.ph === 'wind' && this.dodgeAt >= 0) {
      const left = g.windOf(k, k.a.def) - k.a.t;
      const reach = (k.a.def.reach || 300) + (k.a.tag === 'lunge' ? k.a.def.step : 0) + 40;
      if (left <= this.dodgeAt && (d < reach || k.a.def.kind === 'shot' || k.a.def.kind === 'volley' || k.a.def.kind === 'pillars')) danger = true;
    }
    for (const s of g.shots) if (s.owner === 'k') {
      const rx = p.x - s.x, ry = p.y - s.y, dist = Math.hypot(rx, ry);
      if (dist < 90 && (rx * s.vx + ry * s.vy) > 0 && this.rand() < this.skill * dt * 20) danger = true;
    }
    for (const z of g.zones) if (z.owner === 'k' && z.t > -.25 && z.t < 0 && Math.hypot(p.x - z.x, p.y - z.y) < z.r + 20) danger = true;
    if (danger && (p.state === 'idle' || p.state === 'move' || (p.a && p.a.ph === 'rec')) && p.st > 5) {
      this.dodgeAt = -1;
      const dir = this.bias && this.rand() < .8 ? this.bias : ['left', 'right', 'back'][Math.floor(this.rand() * 3)];
      const v = dir === 'left' ? [uy, -ux] : dir === 'right' ? [-uy, ux] : dir === 'forward' ? [ux, uy] : [-ux, -uy];
      I.mx = v[0]; I.my = v[1]; I.dodge = .2; this.swingsLeft = 0;
      return;
    }
    // --- finish a string
    if (this.swingsLeft > 0 && p.a && p.a.tag === 'light' && p.a.ph === 'rec') { I.light = .25; this.swingsLeft--; return; }
    if (p.state !== 'idle' && p.state !== 'move') return;
    // --- drink
    if (p.hp < 40 && p.flasks > 0 && (d > 150 || (k.state === 'stagger' || k.state === 'rise'))) { I.drink = .2; return; }
    // --- attack
    const kBusy = k.state === 'stagger' || k.state === 'rise' || k.state === 'drink' || (k.a && k.a.ph === 'rec') || k.state === 'dodge';
    const kWinding = k.a && k.a.ph === 'wind';
    const myReach = ranged ? 320 : p.w.light.reach + k.r - 4;
    this.think -= dt;
    if (d < myReach && p.st > 22 && !kWinding && (kBusy || this.think <= 0)) {
      this.think = .3 + this.rand() * .6;
      if (this.rand() < this.heavyP && (kBusy || ranged)) { I.heavy = .2; return; }
      I.light = .2; this.swingsLeft = this.string - 1; return;
    }
    // --- move
    const want = ranged ? 210 : (kBusy ? p.w.light.reach * .7 : p.w.light.reach + 45);
    const radial = Math.max(-1, Math.min(1, (d - want) / 30));
    let mx = ux * radial - uy * this.circle * .7, my = uy * radial + ux * this.circle * .7;
    const wd = Math.hypot(p.x, p.y); if (wd > 250) { mx -= p.x / wd; my -= p.y / wd; }
    I.mx = mx; I.my = my;
  }
}
