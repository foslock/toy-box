// The ski area as a little transport network. No DOM: the page and the Node balance sim both run this.
//
// Nodes are lodges (skiers arrive and leave there), lift stations and junctions. Edges are lifts
// (straight, uphill, a queue at the bottom and chairs going round) and runs (a drawn line that only
// goes down; its colour is set by its steepest pitch). A skier of level L (0 green, 1 blue, 2 black)
// wants to ski one run of exactly their colour and then reach any lodge. They never take a run above
// their level. Anyone left waiting, or stuck in a lift queue, adds to that node's crowd; a crowd over
// the limit fills the node's ring, and a full ring closes the mountain.

import { W, H, MPU, CLIFF, GREEN_MAX, BLUE_MAX, gradeClass, rng, makeTerrain } from './terrain.js';

export const CFG = {
  dayLen: 60,
  crowdCap: 12,
  ringTime: 25,          // seconds over the limit before the ring is full
  liftMax: 240,          // longest lift, map units
  liftStep: 45,          // what "longer cables" adds
  liftClimb: 30,         // a lift has to rise at least this many metres
  chair: { seats: 2, speed: 18, spacing: 24 },
  gondola: { seats: 6, speed: 22, spacing: 40 },
  startLifts: 4,
  maxLodges: 14,
  runMin: 24,            // shortest run worth having
  step: 4,               // spacing of a run's points
  window: 18,            // length a pitch is measured over
  climbTol: -.012,       // a run may never climb (flat is fine, skiers skate); a hair of rise is forgiven
};

const LODGE_NAMES = ['Base Lodge', 'Car Park', 'Station Hotel', 'Ski School', 'Le Refuge', 'Pine Lodge', 'Chalet Rosa', 'The Hut', 'Hotel Bellevue',
  'Youth Hostel', 'Hameau', 'Bus Stop', 'Post Inn', 'Marmot Hut', 'Lakeside', 'Old Mill', 'Edelweiss', 'Village Café'];
const RUN_NAMES = [
  ['Bunny Lane', 'Meadow', 'Sunday Walk', 'Cowbell', 'Easy Street', 'Lullaby', 'Daisy', 'Long Way Round', 'Picnic', 'Slowpoke', 'Pancake', 'Butterfly'],
  ['Fox Run', 'Larch', 'Big Sky', 'Corkscrew', 'Hare', 'Kestrel', 'Blue Moon', 'Rollercoaster', 'Whistler', 'Snowdrift', 'Ridgeway', 'Marmot'],
  ['Widowmaker', 'The Wall', 'Avalanche', 'Couloir', 'Eiger', 'Free Fall', 'Gunbarrel', 'Ptarmigan', 'No Return', 'Devil\'s Elbow', 'Granite', 'Chute'],
];

export class Game {
  constructor({ mountain, seed = 1, tutorial = false } = {}) {
    this.def = mountain;
    this.T = makeTerrain(mountain);
    this.r = rng(seed * 9973 + 17);
    this.tutorial = tutorial;
    this.t = 0; this.day = 1; this.dayT = 0;
    this.nodes = new Map(); this.edges = new Map(); this.skiers = [];
    this.nid = 1; this.eid = 1; this.sid = 1;
    this.version = 1;
    this.served = 0; this.servedBy = [0, 0, 0];
    this.inv = { lift: CFG.startLifts, gondola: 0 };
    this.liftMax = CFG.liftMax;
    this.over = null;
    this.events = [];
    this.levelsOn = tutorial ? 1 : 1;     // how many skier colours have shown up so far
    this.nextLodgeT = 40;
    this.liftNo = 1; this.runNames = [0, 0, 0].map(() => this.shuffled(RUN_NAMES[0].length));
    this.lodgeNames = this.shuffled(LODGE_NAMES.length - 1).map(i => LODGE_NAMES[i + 1]);
    if (!tutorial) this.addLodge(this.findLodgeSpot(0), 'Base Lodge');
  }

  shuffled(n) { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = (this.r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
  emit(type, data = {}) { this.events.push({ type, ...data }); }

  // ---------------------------------------------------------------- nodes
  addNode(x, y, kind) {
    const n = { id: this.nid++, x, y, kind, h: this.T.height(x, y), wait: [], ring: 0, born: this.t, name: '' };
    this.nodes.set(n.id, n);
    return n;
  }
  addLodge(p, name) {
    const n = this.addNode(p.x, p.y, 'lodge');
    n.name = name || this.lodgeNames.shift() || 'Lodge';
    n.nextSpawn = 2 + this.r() * 3;
    this.emit('lodge', { node: n });
    return n;
  }
  lodges() { return [...this.nodes.values()].filter(n => n.kind === 'lodge'); }
  outEdges(n) { const out = []; for (const e of this.edges.values()) if (e.a === n.id) out.push(e); return out; }
  edgesAt(n) { const out = []; for (const e of this.edges.values()) if (e.a === n.id || e.b === n.id) out.push(e); return out; }
  crowd(n) { let c = n.wait.length; for (const e of this.edges.values()) if (e.type === 'lift' && e.a === n.id) c += e.queue.length; return c; }

  // somewhere a new lodge could go: flattish, not in the trees' way of anything, clear of the others,
  // and creeping up the mountain as the resort grows
  findLodgeSpot(k) {
    const T = this.T, have = this.lodges();
    const reach = Math.min(1, .16 + .085 * k);
    let best = null, bestS = -Infinity;
    for (let tries = 0; tries < 400; tries++) {
      const x = 45 + this.r() * (W - 90), y = H - 55 - this.r() * (H - 110) * reach;
      if (T.grade(x, y) > .2) continue;
      let dmin = Infinity; for (const n of this.nodes.values()) dmin = Math.min(dmin, Math.hypot(n.x - x, n.y - y));
      if (dmin < 70) continue;
      for (const e of this.edges.values()) for (let i = 0; i < e.pts.length; i += 3) dmin = Math.min(dmin, Math.hypot(e.pts[i][0] - x, e.pts[i][1] - y) + 30);
      if (dmin < 50) continue;
      // prefer a spread: far from other lodges, but not absurdly far from everything
      let dl = Infinity; for (const n of have) dl = Math.min(dl, Math.hypot(n.x - x, n.y - y));
      const s = (have.length ? Math.min(dl, 260) : 0) - (k === 0 ? Math.abs(x - W / 2) : 0) + this.r() * 40;
      if (s > bestS) { bestS = s; best = { x, y }; }
    }
    return best || { x: W / 2, y: H - 40 };
  }

  // ---------------------------------------------------------------- building
  // A run is valid if it never climbs and never crosses a cliff. Its colour is its steepest pitch.
  measureRun(pts) {
    const T = this.T, cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const hs = pts.map(p => T.height(p[0], p[1]));
    let steep = 0, j = 0;
    const grades = new Float32Array(pts.length);
    for (let i = 1; i < pts.length; i++) {
      while (cum[i] - cum[j] > CFG.window && j < i - 1) j++;
      const d = (cum[i] - cum[j]) * MPU;
      const g = d > 0 ? (hs[j] - hs[i]) / d : 0;
      grades[i] = g;
      if (cum[i] >= Math.min(CFG.window, cum[cum.length - 1]) - .01) steep = Math.max(steep, g);
    }
    grades[0] = grades[1] || 0;
    const len = cum[cum.length - 1];
    return { cum, len, steep, grades, cls: gradeClass(steep), drop: hs[0] - hs[hs.length - 1] };
  }

  // Can a run step from a to b, given the points before it? Used while the player draws.
  runStepOk(prev, b) {
    const T = this.T, a = prev[prev.length - 1];
    if (!T.inside(b[0], b[1])) return 'edge';
    if (T.grade(b[0], b[1]) > CLIFF || T.grade((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) > CLIFF) return 'cliff';
    // look back a window's length: the run must be going down over it
    let k = prev.length - 1, d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (k > 0 && d < CFG.window) { d += Math.hypot(prev[k][0] - prev[k - 1][0], prev[k][1] - prev[k - 1][1]); k--; }
    const p = prev[k], dh = T.height(p[0], p[1]) - T.height(b[0], b[1]);
    if (dh < CFG.climbTol * d * MPU) return 'uphill';
    if (T.height(a[0], a[1]) - T.height(b[0], b[1]) < -1.5) return 'uphill';
    return null;
  }

  // the last hop onto a station is forgiving: flat is fine, a step up of a few metres is fine
  endOk(a, n) {
    if (this.T.grade((a[0] + n.x) / 2, (a[1] + n.y) / 2) > CLIFF) return 'cliff';
    return this.T.height(a[0], a[1]) - n.h < -4 ? 'uphill' : null;
  }

  liftCheck(a, b) {
    const T = this.T, len = Math.hypot(b.x - a.x, b.y - a.y);
    if (!T.inside(b.x, b.y)) return 'edge';
    if (len < 30) return 'short';
    if (len > this.liftMax + .5) return 'long';
    if (T.height(b.x, b.y) - T.height(a.x, a.y) < CFG.liftClimb) return 'flat';
    return null;
  }

  addLift(a, b, opts = {}) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const spec = opts.gondola ? CFG.gondola : CFG.chair;
    const e = { id: this.eid++, type: 'lift', a: a.id, b: b.id, pts: [[a.x, a.y], [b.x, b.y]], len, queue: [], riders: [], phase: 0, clock: 0,
      gondola: !!opts.gondola, seats: spec.seats, speed: spec.speed, spacing: spec.spacing, no: this.liftNo++, born: this.t, carried: 0 };
    this.edges.set(e.id, e);
    if (!opts.free) this.inv.lift--;
    this.version++;
    this.emit('built', { edge: e });
    return e;
  }

  addRun(a, b, pts) {
    const m = this.measureRun(pts);
    const e = { id: this.eid++, type: 'run', a: a.id, b: b.id, pts, ...m, born: this.t, carried: 0 };
    e.name = RUN_NAMES[e.cls][this.runNames[e.cls].shift() ?? 0] || 'Run';
    if (!this.runNames[e.cls].length) this.runNames[e.cls] = this.shuffled(RUN_NAMES[e.cls].length);
    this.edges.set(e.id, e);
    this.version++;
    this.emit('built', { edge: e });
    return e;
  }

  upgradeLift(e) {
    if (e.type !== 'lift' || e.gondola || this.inv.gondola < 1) return false;
    Object.assign(e, { gondola: true, seats: CFG.gondola.seats, speed: CFG.gondola.speed, spacing: CFG.gondola.spacing });
    this.inv.gondola--; this.version++;
    this.emit('upgraded', { edge: e });
    return true;
  }

  // split a run at point index i, making a junction there; skiers on it stay where they are
  splitRun(e, i) {
    if (e.type !== 'run' || i <= 0 || i >= e.pts.length - 1) return null;
    const p = e.pts[i], j = this.addNode(p[0], p[1], 'jct');
    const A = e.pts.slice(0, i + 1), B = e.pts.slice(i);
    const cut = e.cum[i];
    this.edges.delete(e.id);
    const e1 = { ...e, id: this.eid++, b: j.id, pts: A, ...this.measureRun(A) };
    const e2 = { ...e, id: this.eid++, a: j.id, pts: B, ...this.measureRun(B) };
    // a piece keeps the old name if it keeps the old colour
    if (e1.cls !== e.cls) e1.name = RUN_NAMES[e1.cls][this.runNames[e1.cls].shift() ?? 0];
    if (e2.cls !== e.cls) e2.name = RUN_NAMES[e2.cls][this.runNames[e2.cls].shift() ?? 0];
    if (e1.cls === e.cls && e2.cls === e.cls) e2.name = e.name + ' II';
    for (const r of this.runNames) if (!r.length) r.push(...this.shuffled(RUN_NAMES[0].length));
    this.edges.set(e1.id, e1); this.edges.set(e2.id, e2);
    for (const s of this.skiers) if (s.edge === e.id) {
      if (s.s < cut) s.edge = e1.id; else { s.edge = e2.id; s.s -= cut; }
    }
    this.version++;
    return j;
  }

  remove(e) {
    if (!this.edges.has(e.id)) return;
    this.edges.delete(e.id);
    const end = this.nodes.get(e.b), start = this.nodes.get(e.a);
    for (const s of this.skiers) {
      if (s.edge === e.id) { s.edge = null; s.state = 'wait'; s.at = end.id; end.wait.push(s); s.plan = 0; }
    }
    if (e.type === 'lift') {
      for (const s of e.queue) { s.state = 'wait'; s.at = start.id; start.wait.push(s); s.plan = 0; }
      this.inv.lift++;
      if (e.gondola) this.inv.gondola++;
    }
    this.version++;
    this.prune();
    this.emit('removed', { edge: e });
  }

  // stations and junctions with nothing attached go; anyone standing there hikes out
  prune() {
    for (const n of [...this.nodes.values()]) {
      if (n.kind === 'lodge' || this.edgesAt(n).length) continue;
      for (const s of n.wait) { s.gone = true; }
      this.nodes.delete(n.id);
    }
    this.skiers = this.skiers.filter(s => !s.gone);
  }

  // ---------------------------------------------------------------- skiers
  skierSpeed(lvl, g) { return (11 + 3 * lvl) + 30 * Math.min(.6, Math.max(0, g)) * (.55 + .25 * lvl); }

  spawnSkier(n, lvl) {
    const s = { id: this.sid++, lvl, done: false, at: n.id, state: 'wait', edge: null, s: 0, plan: 0, from: n.id, born: this.t, wob: this.r() * 6.28 };
    this.skiers.push(s); n.wait.push(s);
    this.route(s, n);
    return s;
  }

  // Dijkstra over (node, done) for the cheapest way to finish; returns the first edge to take
  nextEdge(s, n0) {
    const N = this.nodes, dist = new Map(), first = new Map(), seen = new Set();
    const key = (id, d) => id * 2 + (d ? 1 : 0);
    const start = key(n0.id, s.done);
    dist.set(start, 0); first.set(start, null);
    const out = new Map();
    for (const e of this.edges.values()) { if (!out.has(e.a)) out.set(e.a, []); out.get(e.a).push(e); }
    for (;;) {
      let bk = -1, bd = Infinity;
      for (const [k, d] of dist) if (!seen.has(k) && d < bd) { bd = d; bk = k; }
      if (bk < 0) return null;
      seen.add(bk);
      const id = bk >> 1, done = bk & 1, node = N.get(id);
      if (done && node.kind === 'lodge' && bk !== start) return first.get(bk);
      for (const e of out.get(id) || []) {
        let cost, nd = done;
        if (e.type === 'lift') cost = e.len / e.speed + 3 + e.queue.length * e.spacing / e.speed / e.seats;
        else { if (e.cls > s.lvl) continue; cost = e.len / this.skierSpeed(s.lvl, e.steep * .7); if (e.cls === s.lvl) nd = 1; }
        const k = key(e.b, nd), d = bd + cost;
        if (d < (dist.get(k) ?? Infinity)) { dist.set(k, d); first.set(k, first.get(bk) ?? e); }
      }
    }
  }

  route(s, n) {
    s.plan = this.version;
    const e = this.nextEdge(s, n);
    if (!e) return false;
    n.wait.splice(n.wait.indexOf(s), 1);
    if (e.type === 'lift') { s.state = 'queue'; e.queue.push(s); s.edge = null; }
    else { s.state = 'ski'; s.edge = e.id; s.s = 0; }
    return true;
  }

  arrive(s, n) {
    s.at = n.id; s.edge = null;
    if (s.done && n.kind === 'lodge') {
      s.gone = true; this.served++; this.servedBy[s.lvl]++;
      this.emit('served', { node: n, lvl: s.lvl });
      return;
    }
    s.state = 'wait'; n.wait.push(s);
    this.route(s, n);
  }

  // ---------------------------------------------------------------- time
  levelMix() {
    if (this.tutorial) return [1, 0, 0];
    const t = this.t;
    if (t < 30) return [1, 0, 0];
    if (t < 100) return [.62, .38, 0];
    return [.48, .32, .2];
  }
  spawnInterval() { const t = this.t; return Math.max(2.6, 8.5 - t / 70); }

  step(dt) {
    if (this.over) return;
    this.t += dt;
    if (!this.tutorial) {
      this.dayT += dt;
      if (this.dayT >= CFG.dayLen) { this.dayT -= CFG.dayLen; this.day++; this.emit('dayEnd', { day: this.day - 1 }); }
      // new skier colours arrive
      const mix = this.levelMix(), on = mix.filter(v => v > 0).length;
      if (on > this.levelsOn) { this.levelsOn = on; this.emit('newLevel', { lvl: on - 1 }); }
      // new lodges
      const nl = this.lodges().length;
      if (nl < CFG.maxLodges && this.t >= this.nextLodgeT) {
        this.addLodge(this.findLodgeSpot(nl));
        this.nextLodgeT = this.t + 38 + nl * 5;
      }
      for (const n of this.nodes.values()) if (n.kind === 'lodge') {
        n.nextSpawn -= dt;
        if (n.nextSpawn <= 0) {
          n.nextSpawn = this.spawnInterval() * (.7 + this.r() * .6);
          let u = this.r(), lvl = 0; const m = this.levelMix();
          while (lvl < 2 && u > m[lvl]) { u -= m[lvl]; lvl++; }
          this.spawnSkier(n, lvl);
        }
      }
    }
    // lifts: chairs leave the bottom at a steady rate and take whoever's queuing
    for (const e of this.edges.values()) if (e.type === 'lift') {
      e.phase = (e.phase + e.speed * dt) % (e.spacing * 1000);
      e.clock += dt;
      const every = e.spacing / e.speed;
      while (e.clock >= every) {
        e.clock -= every;
        if (e.queue.length) {
          const load = e.queue.splice(0, e.seats);
          const ahead = e.clock * e.speed;      // the chair left a moment ago
          load.forEach((s, k) => { s.state = 'lift'; s.edge = e.id; s.s = ahead; s.seat = k; e.carried++; });
        }
      }
    }
    // everyone moving
    const arrivals = [];
    for (const s of this.skiers) {
      if (s.state === 'lift') {
        const e = this.edges.get(s.edge);
        s.s += e.speed * dt;
        if (s.s >= e.len) arrivals.push([s, e]);
      } else if (s.state === 'ski') {
        const e = this.edges.get(s.edge);
        const i = Math.min(e.pts.length - 1, Math.max(0, this.indexAt(e, s.s)));
        s.s += this.skierSpeed(s.lvl, e.grades[i]) * dt;
        if (s.s >= e.len) arrivals.push([s, e]);
      } else if (s.state === 'wait' && s.plan !== this.version) {
        this.route(s, this.nodes.get(s.at));
      }
    }
    for (const [s, e] of arrivals) {
      if (e.type === 'run' && e.cls === s.lvl) s.done = true;
      if (e.type === 'run') e.carried++;
      this.arrive(s, this.nodes.get(e.b));
    }
    if (arrivals.length) this.skiers = this.skiers.filter(s => !s.gone);
    // crowds fill the rings
    for (const n of this.nodes.values()) {
      const c = this.crowd(n);
      const cap = CFG.crowdCap;
      if (c > cap) n.ring = Math.min(1, n.ring + dt / CFG.ringTime * (1 + (c - cap) * .08));
      else n.ring = Math.max(0, n.ring - dt / CFG.ringTime * .6);
      if (n.ring >= 1 && !this.tutorial) { this.over = { node: n, t: this.t, day: this.day }; this.emit('over', { node: n }); break; }
    }
  }

  indexAt(e, s) {
    // binary search on cumulative length
    let lo = 0, hi = e.cum.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (e.cum[m] <= s) lo = m; else hi = m - 1; }
    return lo;
  }
  pointAt(e, s) {
    if (e.type === 'lift') { const u = Math.min(1, s / e.len); return [e.pts[0][0] + (e.pts[1][0] - e.pts[0][0]) * u, e.pts[0][1] + (e.pts[1][1] - e.pts[0][1]) * u, e.pts[1][0] - e.pts[0][0], e.pts[1][1] - e.pts[0][1]]; }
    const i = Math.min(e.pts.length - 2, this.indexAt(e, s)), a = e.pts[i], b = e.pts[i + 1];
    const seg = e.cum[i + 1] - e.cum[i] || 1, u = Math.max(0, Math.min(1, (s - e.cum[i]) / seg));
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, b[0] - a[0], b[1] - a[1]];
  }

  // each evening: a new chairlift, or one of the other two
  offer() { return ['lift', this.r() < .55 ? 'gondola' : 'cable']; }
  take(o) {
    if (o === 'lift') this.inv.lift++;
    else if (o === 'gondola') this.inv.gondola++;
    else if (o === 'cable') this.liftMax += CFG.liftStep;
    this.version++;
  }

  // which colours can start from this lodge and finish somewhere? (for the lodge badges)
  served3(n) {
    return [0, 1, 2].map(lvl => !!this.nextEdge({ lvl, done: false }, n));
  }
}
