// The ride: a sled on lines, a pencil with a limited lead, and the rules for tumbling and for style.
// No DOM in here, so the same code runs in the page and in the Node balance sim.
import { Course, M, FLOOR_DEPTH } from './course.js';

export const G = 980;            // gravity, units/s²
export const MU = 0.045;         // sliding friction on a line
export const DRAG = 0.00052;     // air drag, per unit of speed
export const R = 7;              // the sled's contact radius
export const INK_MAX = 1600;     // a full pencil, in units of line
export const INK_RATE = 50;      // lead grown back per second...
export const INK_PER_X = 0.8;    // ...plus this much for every unit the sled gets forward
export const GATE_INK = 400;
const SUB = 1 / 240;
const IMPACT_MAX = 1150;         // land harder than this and you're out
const SEG_MIN = 6;
const BUCKET = 64;

const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export const REASONS = {
  blot: 'ran into an ink blot',
  pillar: 'hit a rock',
  scribble: 'fell into the scribble',
  head: 'landed on your head',
  splat: 'landed much too hard',
  stall: 'ran out of puff',
  back: 'slid back into the scribble',
};

class Track {
  constructor() { this.buckets = new Map(); this.stamp = 0; this.all = new Set(); }
  add(s) {
    s.minX = Math.min(s.ax, s.bx); s.maxX = Math.max(s.ax, s.bx);
    s.minY = Math.min(s.ay, s.by); s.maxY = Math.max(s.ay, s.by);
    const dx = s.bx - s.ax, dy = s.by - s.ay;
    s.len2 = dx * dx + dy * dy || 1e-9;
    s.q = 0;
    for (let k = Math.floor(s.minX / BUCKET), e = Math.floor(s.maxX / BUCKET); k <= e; k++) {
      let b = this.buckets.get(k);
      if (!b) this.buckets.set(k, b = []);
      b.push(s);
    }
    this.all.add(s);
    return s;
  }
  remove(s) {
    s.dead = true;
    this.all.delete(s);
    for (let k = Math.floor(s.minX / BUCKET), e = Math.floor(s.maxX / BUCKET); k <= e; k++) {
      const b = this.buckets.get(k);
      if (!b) continue;
      const i = b.indexOf(s);
      if (i >= 0) b.splice(i, 1);
      if (!b.length) this.buckets.delete(k);
    }
  }
  query(x0, x1, out) {
    out.length = 0;
    const st = ++this.stamp;
    for (let k = Math.floor(x0 / BUCKET), e = Math.floor(x1 / BUCKET); k <= e; k++) {
      const b = this.buckets.get(k);
      if (!b) continue;
      for (const s of b) if (s.q !== st) { s.q = st; out.push(s); }
    }
    return out;
  }
}

export class Game {
  constructor({ seed = 1, tutorial = false } = {}) {
    this.seed = seed; this.tutorial = tutorial;
    this.reset();
  }

  reset() {
    this.course = new Course(this.seed, this.tutorial);
    this.track = new Track();
    this.strokes = [];
    this.stroke = null;
    this.events = [];
    this.t = 0;
    this.ink = INK_MAX;
    this.style = 0;
    this.dist = 0;
    this.state = 'ready';
    this.reason = null;
    this.lesson = 0;
    this.gates = { hit: 0, all: 0 };
    this.tally = { air: 0, loops: 0, close: 0, gates: 0 };
    this.inkUsed = 0; this.dry = 0;
    for (const l of this.course.ledges) this.addLedge(l);
    this.placeRider(this.course.start.x, this.course.start.y, 0.16);
    this.course.ensure(this.rider.x + 3000);
    this._q = []; this._n = [];
  }

  addLedge(l) {
    for (let i = 1; i < l.pts.length; i++) {
      const a = l.pts[i - 1], b = l.pts[i];
      this.track.add({ ax: a.x, ay: a.y, bx: b.x, by: b.y, pen: true, fade: null });
    }
    l.added = true;
  }

  placeRider(x, ledgeY, slope) {
    const a = Math.atan(slope);
    // sit the sled on top of the ledge line
    this.rider = {
      x, y: ledgeY - R / Math.cos(a), vx: 0, vy: 0, a, av: 0, ground: true, groundT: 0, airT: 0,
      nx: Math.sin(a), ny: -Math.cos(a), maxX: x, startX: this.rider?.startX ?? x, rot: 0, stallT: 0,
    };
  }

  get score() { return Math.floor(this.dist) + this.style; }

  // ---- the pencil
  beginStroke(x, y, snap = 0) {
    if (this.state === 'crash' || this.state === 'over' || this.state === 'done') return false;
    let s = null;
    if (snap > 0) {
      let best = snap * snap;
      for (const st of this.strokes.slice(-6)) {
        const p = st.pts[st.pts.length - 1];
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < best && !st.segs.some(g => g.fade !== null)) { best = d; s = st; }
      }
    }
    if (!s) { s = { pts: [{ x, y }], segs: [] }; this.strokes.push(s); }
    this.stroke = s;
    if (this.state === 'ready') this.go();
    return true;
  }

  extendStroke(x, y) {
    const s = this.stroke;
    if (!s) return 0;
    const p = s.pts[s.pts.length - 1];
    let dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d < SEG_MIN) return 0;
    if (this.ink <= 0.5) { this.dry += 1; this.events.push({ type: 'dry' }); return -1; }
    if (d > this.ink) { const k = this.ink / d; dx *= k; dy *= k; d = this.ink; }
    const q = { x: p.x + dx, y: p.y + dy };
    s.pts.push(q);
    s.segs.push(this.track.add({ ax: p.x, ay: p.y, bx: q.x, by: q.y, pen: false, fade: null, born: this.t, stroke: s }));
    this.ink -= d; this.inkUsed += d;
    return d;
  }

  endStroke() {
    const s = this.stroke;
    this.stroke = null;
    if (s && s.pts.length < 2) this.strokes.splice(this.strokes.indexOf(s), 1);
  }

  go() {
    if (this.state !== 'ready') return;
    this.state = 'ride';
    const rd = this.rider, sp = this.tutorial ? 120 : 150;
    rd.vx = Math.cos(rd.a) * sp; rd.vy = Math.sin(rd.a) * sp;
    this.events.push({ type: 'go' });
  }

  // ---- time
  step(dt) {
    this.course.ensure(this.rider.x + 3000);
    this.t += dt;
    if (this.state !== 'crash') this.ink = Math.min(INK_MAX, this.ink + INK_RATE * dt * (this.state === 'ready' ? 4 : 1));
    if (this.state === 'crash') { this.stepDebris(dt); return; }
    if (this.state !== 'ride') return;
    const rd = this.rider;
    const sp = Math.hypot(rd.vx, rd.vy);
    const n = Math.min(60, Math.max(Math.ceil(dt / SUB), Math.ceil(sp * dt / 2.5)));
    const h = dt / n;
    for (let i = 0; i < n && this.state === 'ride'; i++) this.sub(h);
    this.fadeTrack();
    this.dist = Math.max(this.dist, (rd.maxX - rd.startX) / M);
    if (this.tutorial) this.checkLessons();
  }

  sub(h) {
    const rd = this.rider, c = this.course;
    let ax = 0, ay = G;
    const near = c.near(rd.x - 60, rd.x + 60, this._n);
    for (const o of near) if (o.type === 'wind' && rd.x >= o.x0 && rd.x <= o.x1 && rd.y >= o.y0 && rd.y <= o.y1) { ax += o.ax; ay += o.ay; }
    rd.vx += ax * h; rd.vy += ay * h;
    let sp = Math.hypot(rd.vx, rd.vy);
    const k = Math.max(0, 1 - DRAG * sp * h);
    rd.vx *= k; rd.vy *= k;
    const px = rd.x;
    rd.x += rd.vx * h; rd.y += rd.vy * h;

    // lines: push the sled out of anything it's sunk into, and take away the speed going into it
    let contact = false, nx = 0, ny = 0, impact = 0;
    const segs = this.track.query(rd.x - R - 1, rd.x + R + 1, this._q);
    for (let pass = 0; pass < 2; pass++) {
      for (const s of segs) {
        if (s.dead || rd.y < s.minY - R || rd.y > s.maxY + R) continue;
        const dx = s.bx - s.ax, dy = s.by - s.ay;
        let t = ((rd.x - s.ax) * dx + (rd.y - s.ay) * dy) / s.len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = s.ax + dx * t, cy = s.ay + dy * t;
        let ex = rd.x - cx, ey = rd.y - cy;
        const d2 = ex * ex + ey * ey;
        if (d2 >= R * R) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-6) { ex = -dy; ey = dx; d = Math.hypot(ex, ey); if (ey > 0) { ex = -ex; ey = -ey; } }
        const ux = ex / d, uy = ey / d;
        rd.x = cx + ux * R; rd.y = cy + uy * R;
        const vn = rd.vx * ux + rd.vy * uy;
        if (vn < 0) { rd.vx -= ux * vn; rd.vy -= uy * vn; impact = Math.max(impact, -vn); }
        contact = true; nx += ux; ny += uy;
      }
    }
    const prevA = rd.a;
    if (contact) {
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      // friction: the sled presses on the line with gravity's share (plus the wind's)
      const press = Math.max(0, -(ax * nx + ay * ny));
      sp = Math.hypot(rd.vx, rd.vy);
      if (sp > 0) { const f = Math.max(0, sp - MU * press * h) / sp; rd.vx *= f; rd.vy *= f; }
      if (!rd.ground && rd.airT > 0.12) {
        const ux = Math.sin(rd.a), uy = -Math.cos(rd.a);
        if (ux * nx + uy * ny < -0.25) return this.crash('head');
        if (impact > IMPACT_MAX) return this.crash('splat');
        this.land(impact);
      }
      rd.ground = true; rd.groundT = 0; rd.nx = nx; rd.ny = ny;
      const target = Math.atan2(nx, -ny);
      rd.a = wrap(rd.a + wrap(target - rd.a) * Math.min(1, 28 * h));
      const da = wrap(rd.a - prevA) / h;
      rd.av += (Math.max(-7, Math.min(7, da)) - rd.av) * Math.min(1, 20 * h);
      rd.airT = 0;
    } else {
      rd.groundT += h;
      if (rd.groundT > 0.07) rd.ground = false;
      if (!rd.ground) {
        rd.airT += h;
        rd.a = wrap(rd.a + rd.av * h);
        rd.av *= 1 - 0.5 * h;
      }
    }
    // loops and flips: count whole turns of the sled
    rd.rot += wrap(rd.a - prevA);
    if (Math.abs(rd.rot) >= Math.PI * 2) {
      rd.rot -= Math.sign(rd.rot) * Math.PI * 2;
      const loop = rd.ground;
      this.award(loop ? 200 : 250, loop ? 'loop!' : 'flip!', 'loops');
    }

    if (rd.x > rd.maxX) { this.ink = Math.min(INK_MAX, this.ink + (rd.x - rd.maxX) * INK_PER_X); rd.maxX = rd.x; }
    // stalls
    sp = Math.hypot(rd.vx, rd.vy);
    if (rd.ground && sp < 22) { rd.stallT += h; if (rd.stallT > 1.6) return this.crash('stall'); } else rd.stallT = 0;

    // the bottom of the page
    if (rd.y > c.floor(rd.x) - 10) return this.crash(rd.vx < -30 ? 'back' : 'scribble');

    // things drawn in pen
    const ux = Math.sin(rd.a), uy = -Math.cos(rd.a);
    const bx = rd.x + ux * 15, by = rd.y + uy * 15;
    for (const o of near) {
      if (o.type === 'blot') {
        const rr = o.r * 0.85;
        const db = Math.hypot(bx - o.x, by - o.y) - rr - 9, ds = Math.hypot(rd.x - o.x, rd.y - o.y) - rr - 5;
        const cl = Math.min(db, ds);
        if (cl < 0) return this.crash('blot');
        if (cl < 26) o.close = true;
      } else if (o.type === 'pillar') {
        const db = polyDist(o.pts, bx, by) - 9, ds = polyDist(o.pts, rd.x, rd.y) - 4;
        const cl = Math.min(db, ds);
        if (cl < 0) return this.crash('pillar');
        if (cl < 26) o.close = true;
      } else if (o.type === 'gate' && !o.done && px < o.x && rd.x >= o.x) {
        o.done = true; this.gates.all++;
        const hy = rd.y + uy * 8;
        if (Math.abs(hy - o.y) < o.gap / 2) {
          this.gates.hit++;
          this.ink = Math.min(INK_MAX, this.ink + GATE_INK);
          this.award(50, 'gate +50', 'gates', { ink: GATE_INK });
        } else this.events.push({ type: 'miss', x: o.x, y: o.y });
      }
    }
    for (const o of near) {
      if ((o.type === 'blot' || o.type === 'pillar') && o.close && !o.paid && rd.x > o.x1 + 6) {
        o.paid = true;
        this.award(30, 'close shave +30', 'close');
      }
    }
  }

  land(impact) {
    const rd = this.rider;
    this.events.push({ type: 'land', impact, air: rd.airT });
    if (rd.airT > 0.45) {
      const pts = Math.round(rd.airT * 40);
      this.award(pts, `air ${rd.airT.toFixed(1)}s +${pts}`, 'air');
    }
  }

  award(pts, text, kind, extra = {}) {
    this.style += pts;
    this.tally[kind] = (this.tally[kind] || 0) + pts;
    this.events.push({ type: 'style', kind, pts, text, x: this.rider.x, y: this.rider.y, ...extra });
  }

  crash(reason) {
    const rd = this.rider;
    this.state = 'crash';
    this.reason = reason;
    this.crashT = 0;
    this.endStroke();
    const ux = Math.sin(rd.a), uy = -Math.cos(rd.a);
    const kick = reason === 'blot' || reason === 'pillar' ? -0.3 : 0.7;
    this.debris = [
      { part: 'body', x: rd.x + ux * 12, y: rd.y + uy * 12, vx: rd.vx * kick + ux * 120, vy: rd.vy * kick + uy * 260 - 120, a: rd.a, av: 9 },
      { part: 'sled', x: rd.x, y: rd.y, vx: rd.vx * 0.8, vy: rd.vy * 0.8 - 60, a: rd.a, av: -5 },
    ];
    this.events.push({ type: 'crash', reason, x: rd.x, y: rd.y });
  }

  stepDebris(dt) {
    this.crashT += dt;
    for (const p of this.debris) {
      p.vy += G * 0.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.av * dt;
      p.vx *= 1 - 0.6 * dt;
    }
    if (this.crashT > 1.5 && this.state === 'crash') {
      this.state = 'over';
      this.events.push({ type: 'over' });
    }
  }

  // the line behind the sled rubs out a moment after it's been ridden
  fadeTrack() {
    const rd = this.rider, cut = rd.maxX - 170;
    for (const s of this.track.all) {
      if (s.pen) { if (s.maxX < rd.x - 2500) this.track.remove(s); continue; }
      if (s.fade === null) { if (s.maxX < cut) s.fade = this.t; }
      else if (this.t - s.fade > 1.1) this.track.remove(s);
    }
    if (this.strokes.length > 40) {
      this.strokes = this.strokes.filter(st => st === this.stroke || st.segs.some(g => !g.dead) || st.segs.length === 0 && st.pts[0].x > cut);
    }
  }

  // tutorial: lessons are triggered by how far you've got, and a tumble puts you back on a ledge at the last one
  checkLessons() {
    const L = this.course.lessons, rd = this.rider;
    while (this.lesson + 1 < L.length && rd.x >= L[this.lesson + 1].x) {
      this.lesson++;
      this.events.push({ type: 'lesson', key: L[this.lesson].key, i: this.lesson });
    }
    if (rd.x >= this.course.finishX && this.state === 'ride') {
      this.state = 'done';
      this.events.push({ type: 'done' });
    }
  }

  respawn() {
    const L = this.course.lessons[this.lesson];
    const cpx = L.cp, c = this.course;
    for (const s of [...this.track.all]) if (!s.pen) this.track.remove(s);
    this.strokes = []; this.stroke = null;
    for (const o of c.items) if (o.x0 > cpx) { o.done = false; o.close = false; o.paid = false; }
    let ly;
    if (cpx === c.start.x) ly = c.start.y;
    else {
      ly = c.baseline(cpx) - 30;
      const l = c.addLedge(cpx - 180, cpx + 40, ly - 180 * 0.16, 0.16);
      this.addLedge(l);
    }
    const keepStart = this.rider.startX;
    this.placeRider(cpx, ly, 0.16);
    this.rider.startX = keepStart;
    this.rider.maxX = cpx;
    this.ink = INK_MAX;
    this.state = 'ready';
    this.debris = null;
    this.events.push({ type: 'respawn' });
  }
}

// distance from a point to a polygon's outline, negative inside
export function polyDist(pts, x, y) {
  let inside = false, best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[j], b = pts[i];
    if ((b.y > y) !== (a.y > y) && x < (a.x - b.x) * (y - b.y) / (a.y - b.y) + b.x) inside = !inside;
    const dx = b.x - a.x, dy = b.y - a.y;
    let t = ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
    if (d < best) best = d;
  }
  return inside ? -best : best;
}

export { M, FLOOR_DEPTH };
