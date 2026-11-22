// The Lower Bramble Show: the ring events and their courses. No DOM.
// Obstacles: log (round, r), bale (box, w × h), ditch (a dip full of water, w wide).
// Flags are checkpoints: wipe out and you start again from the last flag you passed.

export const EVENTS = [
  {
    id: 'paddock', title: 'The Practice Paddock', short: 'Paddock', kind: 'tutorial',
    blurb: 'A quiet corner behind the tea tent to find your feet.',
    length: 36, flags: [0, 9, 17, 27],
    obstacles: [{ type: 'log', x: 22, r: 0.12 }, { type: 'bale', x: 31, w: 0.5, h: 0.36 }],
  },
  {
    id: 'parade', title: 'The Village Parade', short: 'Parade', kind: 'parade',
    blurb: 'Follow the Bramble Silver Band down the high street. Keep close, but mind the tuba.',
    length: 50, flags: [0, 16, 32],
    band: { start: 3.6, speed: 0.85, wait: 3 },
    obstacles: [{ type: 'log', x: 38, r: 0.07, kind: 'kerb' }],
    medals: { gold: 0.85, silver: 0.7, bronze: 0.5 }, // share of the parade spent in step behind the band
  },
  {
    id: 'dressage', title: 'The Dressage Test', short: 'Dressage', kind: 'dressage',
    blurb: 'Walk to each letter and halt square on it until the judge rings her bell.',
    length: 40, flags: [0, 13, 25],
    marks: [{ x: 9, letter: 'A' }, { x: 18.5, letter: 'K' }, { x: 26, letter: 'E' }, { x: 34.5, letter: 'C' }],
    obstacles: [{ type: 'log', x: 22, r: 0.1, kind: 'pole' }],
    medals: { gold: 47, silver: 53, bronze: 65 },
  },
  {
    id: 'steeple', title: 'The Steeplechase', short: 'Steeplechase', kind: 'time',
    blurb: 'Logs, bales and the duck pond ditch. Fastest round wins the rosette.',
    length: 72, flags: [0, 17, 33, 50, 62],
    obstacles: [
      { type: 'log', x: 9, r: 0.12 }, { type: 'bale', x: 15, w: 0.5, h: 0.36 },
      { type: 'log', x: 22, r: 0.13 }, { type: 'ditch', x: 29, w: 1.4 },
      { type: 'bale', x: 38, w: 0.5, h: 0.36 }, { type: 'log', x: 42.5, r: 0.12 },
      { type: 'bale', x: 54, w: 0.5, h: 0.4 }, { type: 'log', x: 59, r: 0.14 }, { type: 'bale', x: 67, w: 0.5, h: 0.36 },
    ],
    medals: { gold: 58, silver: 68, bronze: 85 },
  },
  {
    id: 'derby', title: 'The Grand Panto Derby', short: 'Derby', kind: 'race',
    blurb: 'Four horses, eight fences, one length of the show field. Beat the lot of them.',
    length: 90, flags: [0, 22, 45, 68],
    obstacles: [
      { type: 'log', x: 10, r: 0.12 }, { type: 'bale', x: 18, w: 0.5, h: 0.36 }, { type: 'log', x: 28, r: 0.13 },
      { type: 'ditch', x: 36, w: 1.3 }, { type: 'bale', x: 48, w: 0.5, h: 0.38 }, { type: 'log', x: 56, r: 0.12 },
      { type: 'bale', x: 64, w: 0.5, h: 0.36 }, { type: 'log', x: 74, r: 0.13 }, { type: 'bale', x: 82, w: 0.5, h: 0.36 },
    ],
    rivals: [
      { name: 'Dobbin & Daughter', colour: 'green', rate: 3.2, skill: 0.92 },
      { name: 'The Vicar’s Nag', colour: 'mustard', rate: 3.55, skill: 0.85 },
      { name: 'Lightning Lil', colour: 'blue', rate: 3.85, skill: 0.78 },
    ],
  },
];

export class Course {
  constructor(def) {
    this.def = def;
    this.length = def.length;
    this.flags = def.flags.slice();
    this.obstacles = (def.obstacles || []).map((o) => {
      if (o.type === 'log') return { ...o, x0: o.x - o.r, x1: o.x + o.r, h: o.r * 2 };
      if (o.type === 'bale') return { ...o, x0: o.x - o.w / 2, x1: o.x + o.w / 2 };
      if (o.type === 'ditch') return { ...o, x0: o.x - o.w / 2, x1: o.x + o.w / 2, depth: 0.22 };
      return o;
    });
    this.solid = this.obstacles.filter((o) => o.type !== 'ditch');
    this.ditches = this.obstacles.filter((o) => o.type === 'ditch');
  }

  floor(x) {
    for (const d of this.ditches) {
      if (x > d.x0 - 0.15 && x < d.x1 + 0.15) {
        const e = Math.min(x - (d.x0 - 0.15), d.x1 + 0.15 - x);
        return -d.depth * Math.min(1, e / 0.25);
      }
    }
    return 0;
  }

  // the highest thing a hoof could stand on at x
  top(x) {
    let y = this.floor(x);
    for (const o of this.solid) {
      if (x <= o.x0 || x >= o.x1) continue;
      if (o.type === 'bale') y = Math.max(y, o.h);
      else { const dx = x - o.x; y = Math.max(y, o.r + Math.sqrt(Math.max(0, o.r * o.r - dx * dx))); }
    }
    return y;
  }

  obstacleAt(x) {
    for (const o of this.solid) if (x > o.x0 - 0.02 && x < o.x1 + 0.02) return o;
    return null;
  }
  waterAt(x) {
    for (const d of this.ditches) if (x > d.x0 && x < d.x1) return d;
    return null;
  }
  nextObstacle(x) {
    let best = null;
    for (const o of this.obstacles) if (o.x1 > x && (!best || o.x0 < best.x0)) best = o;
    return best;
  }
  flagBefore(x) {
    let f = 0;
    for (const v of this.flags) if (v <= x) f = v;
    return f;
  }
}
