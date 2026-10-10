// The page the sled rides across: a gentle downhill "baseline" with a scribble at the bottom of the page that
// eats you, and things drawn in pen along the way. Generated lazily, a beat at a time, from a seed.
import { rng } from './rng.js';

export const SLOPE = 0.22;          // average fall of the page, per unit forward
export const FLOOR_DEPTH = 330;     // the scribble sits this far below the baseline
export const START_X = -150;        // where the sled waits on its ledge
export const M = 20;                // world units per metre

export class Course {
  constructor(seed, tutorial = false) {
    const r = this.r = rng(seed);
    this.p1 = r() * 6.283; this.p2 = r() * 6.283;
    this.items = [];     // hazards, gates and wind, sorted by x0
    this.ledges = [];    // ledges drawn in pen: [{ pts }]
    this.doodles = [];   // margin doodles, for looks only
    this.notes = [];     // red-pen notes written on the page (tutorial)
    this.tutorial = tutorial;
    this.genX = 700; this.doodleX = -900;
    this.id = 0;
    const ly = this.baseline(START_X) - 40;
    this.startLedge = this.addLedge(-330, 40, ly, 0.16);
    this.start = { x: START_X, y: ly + (START_X + 330) * 0.16 };
    if (tutorial) buildTutorial(this);
  }
  baseline(x) {
    const k = this.tutorial ? 0.45 : 1;
    return SLOPE * x + k * (70 * Math.sin(x / 900 + this.p1) + 30 * Math.sin(x / 340 + this.p2));
  }
  floor(x) { return this.baseline(x) + FLOOR_DEPTH; }
  difficulty(x) { return Math.min(1, Math.max(0, (x - 600) / 24000)); }

  ensure(x) {
    while (this.genX < x) this.beat();
    while (this.doodleX < x) this.doodle();
  }

  // items whose span overlaps [x0, x1]
  near(x0, x1, out = []) {
    out.length = 0;
    const it = this.items;
    let lo = 0, hi = it.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (it[m].x1 < x0 - 700) lo = m + 1; else hi = m; }
    for (let i = lo; i < it.length; i++) {
      const o = it[i];
      if (o.x0 > x1) break;
      if (o.x1 >= x0) out.push(o);
    }
    return out;
  }

  push(o) {
    o.id = this.id++;
    // keep sorted by x0 (beats arrive nearly in order)
    const it = this.items;
    let i = it.length;
    while (i > 0 && it[i - 1].x0 > o.x0) i--;
    it.splice(i, 0, o);
    return o;
  }

  addLedge(x0, x1, y0, slope = SLOPE) {
    const pts = [];
    for (let x = x0; x <= x1 + 0.1; x += 40) pts.push({ x, y: y0 + (x - x0) * slope });
    const l = { pts, x0, x1 };
    this.ledges.push(l);
    return l;
  }

  blot(x, y, rad) {
    const r = this.r, pts = [];
    const n = 22;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const spike = r() < 0.22 ? 1.25 + r() * 0.25 : 0.86 + r() * 0.16;
      pts.push({ x: Math.cos(a) * rad * spike, y: Math.sin(a) * rad * spike });
    }
    const drops = [];
    for (let i = 0, k = 2 + (r() * 3 | 0); i < k; i++) {
      const a = r() * Math.PI * 2, d = rad * (1.35 + r() * 0.5);
      drops.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: 2 + r() * 4 });
    }
    return this.push({ type: 'blot', x, y, r: rad, x0: x - rad * 1.5, x1: x + rad * 1.5, pts, drops });
  }

  pillar(x, w, top) {
    const r = this.r, fl = this.floor(x) + 60;
    const L = x - w / 2, Rr = x + w / 2;
    const pts = [{ x: L - 18, y: fl }];
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      pts.push({ x: L - 18 + (w * 0.32 + 18) * t + (r() - 0.5) * 10, y: fl + (top - fl) * t + (r() - 0.5) * 14 });
    }
    pts[pts.length - 1].y = top + 8;
    pts.push({ x: x - w * 0.06 + (r() - 0.5) * 10, y: top - 6 - r() * 10 });
    pts.push({ x: x + w * 0.18, y: top + 4 + r() * 6 });
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push({ x: x + w * 0.3 + (Rr + 18 - x - w * 0.3) * t + (r() - 0.5) * 10, y: top + 10 + (fl - top - 10) * t + (r() - 0.5) * 14 });
    }
    pts[pts.length - 1] = { x: Rr + 18, y: fl };
    let minY = Infinity;
    for (const p of pts) minY = Math.min(minY, p.y);
    return this.push({ type: 'pillar', x, w, top: minY, x0: L - 20, x1: Rr + 20, pts });
  }

  gate(x, y, gap) {
    return this.push({ type: 'gate', x, y, gap, x0: x - 6, x1: x + 6 });
  }

  wind(x, w, ax, ay) {
    const b = this.baseline(x);
    return this.push({ type: 'wind', x: x + w / 2, w, ax, ay, x0: x, x1: x + w, y0: b - 520, y1: b + FLOOR_DEPTH + 20 });
  }

  beat() {
    const r = this.r, x = this.genX, d = this.difficulty(x), b = this.baseline(x);
    const u = (a, c) => a + r() * (c - a);
    let span = 0;
    const roll = r();
    const winds = x > 3500;
    if (x > 2500 && r() < 0.11) {
      // a stretch of pen ledge: a breather that costs no lead
      const len = u(220, 380);
      this.addLedge(x, x + len, b + u(10, 60));
      span = len;
    } else if (roll < 0.26) {
      // a lone ink blot, high or low
      const high = r() < 0.4;
      this.blot(x, high ? b + u(-90, -20) : b + u(60, 170), u(24, 34 + 10 * d));
    } else if (roll < 0.44) {
      // a rock spire up from the scribble
      const top = this.floor(x) - u(140, 190 + 150 * d);
      this.pillar(x, u(70, 130), top);
      span = 60;
    } else if (roll < 0.64) {
      const gy = b + u(-50, 150);
      this.gate(x, gy, u(140, 160) - 50 * d);
      if (d > 0.25 && r() < 0.5) this.blot(x + u(220, 300), gy + (r() < 0.5 ? -1 : 1) * u(70, 110), u(22, 30));
      span = 120;
    } else if (roll < 0.76 && d > 0.15) {
      // two blots with a gap to thread
      const cy = b + u(0, 120), gap = u(150, 175) - 40 * d, rad = u(24, 32);
      this.blot(x, cy - gap / 2 - rad, rad);
      this.blot(x + u(-30, 30), cy + gap / 2 + rad, rad);
    } else if (roll < 0.86 && d > 0.3) {
      // a spire with a blot hanging over it: squeeze between
      const top = this.floor(x) - u(200, 260);
      this.pillar(x, u(70, 110), top);
      this.blot(x + u(-20, 20), top - u(170, 200) + 40 * d, u(24, 30));
      span = 80;
    } else if (winds && roll < 0.96) {
      const kind = r();
      const w = u(320, 520);
      if (kind < 0.4) this.wind(x, w, 0, -u(500, 750));          // updraft
      else if (kind < 0.7) this.wind(x, w, 0, u(350, 550));       // downdraft
      else this.wind(x, w * 0.7, -u(160, 240), 0);                // headwind
      if (r() < 0.5) this.gate(x + w * 0.6, b + u(-20, 110), 150 - 30 * d);
      span = w;
    } else {
      this.blot(x, b + u(30, 160), u(26, 36));
    }
    this.genX = x + span + u(600, 820) - 300 * d;
  }

  doodle() {
    const r = this.r, x = this.doodleX;
    const kinds = ['star', 'spiral', 'sun', 'cat', 'heart', 'cloud', 'house', 'smiley', 'plane', 'flower', 'bird', 'tree'];
    const sky = r() < 0.8;
    const y = sky ? this.baseline(x) - u2(r, 170, 520) : this.baseline(x) + u2(r, 150, 250);
    this.doodles.push({ x, y, kind: kinds[r() * kinds.length | 0], s: u2(r, 0.8, 1.4) * (sky ? 1 : 0.7), rot: (r() - 0.5) * 0.5, seed: r() * 1e6 | 0 });
    this.doodleX = x + u2(r, 260, 520);
  }
}
const u2 = (r, a, c) => a + r() * (c - a);

// The lesson page: one idea at a time, each with a red-pen note on the page and a checkpoint to restart from.
function buildTutorial(c) {
  c.genX = Infinity;
  const b = x => c.baseline(x);
  c.lessons = [
    { x: -Infinity, key: 'start', cp: START_X },
    { x: 490, key: 'keep', cp: START_X },
    { x: 1750, key: 'lead', cp: 1540 },
    { x: 2870, key: 'blot', cp: 2730 },
    { x: 4410, key: 'gate', cp: 4270 },
    { x: 5950, key: 'rock', cp: 5810 },
    { x: 7840, key: 'wind', cp: 7630 },
    { x: 9520, key: 'end', cp: 9310 },
  ];
  c.blot(3710, b(3710) + 95, 34);
  c.notes.push({ x: 3710, y: b(3710) + 175, text: 'ink blot! over or under', ax: 3710, ay: b(3710) + 140 });
  c.gate(5180, b(5180) + 70, 150);
  c.notes.push({ x: 5180, y: b(5180) - 60, text: 'thread me', ax: 5180, ay: b(5180) - 12 });
  c.pillar(6860, 120, b(6860) + 10);
  c.notes.push({ x: 6608, y: b(6860) - 90, text: 'ramp up, then lift off', ax: 6776, ay: b(6860) - 20 });
  c.wind(8260, 420, 0, -650);
  c.notes.push({ x: 8554, y: b(8554) - 200, text: 'updraft: it lifts you', ax: 8554, ay: b(8554) - 140 });
  c.gate(8750, b(8750) + 60, 160);
  c.finishX = 10220;
  c.notes.push({ x: 10220, y: b(10220) - 120, text: 'the end of the lesson!', ax: 10220, ay: b(10220) - 60, finish: true });
  c.notes.push({ x: 840, y: b(840) + 230, text: 'the scribble: don\'t fall in', ax: 840, ay: b(840) + 300 });
  // margin doodles all along
  while (c.doodleX < 11000) c.doodle();
}
