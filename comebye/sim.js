// The trial itself: sheep that flock, a dog that runs where she's sent, and a judge with a pencil.
// No DOM in here, so the same code runs in the page and in the Node balance check.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KINDS = {
  //     body  flight  calm  top  accel  how fast they get worked up
  ewe:  { r: 0.5,  flight: 11, calm: 0.55, top: 4.6, acc: 3.2, up: 2.4 },
  lamb: { r: 0.34, flight: 14, calm: 0.7,  top: 5.8, acc: 5.0, up: 3.8 },
  ram:  { r: 0.66, flight: 7,  calm: 0.45, top: 3.4, acc: 1.6, up: 1.1 },
};

export const PHASE_MAX = { outrun: 10, fetch: 20, drive: 30, shed: 10, pen: 10 };
export const PHASE_NAME = { outrun: 'Outrun & lift', fetch: 'Fetch', drive: 'Drive', shed: 'Shed', pen: 'Pen' };

const DT = 1 / 60;
const DOG_TOP = 10.5, DOG_R = 0.42;

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + dx * t, cy = ay + dy * t;
  return [Math.hypot(px - cx, py - cy), cx, cy, t];
}

export class Trial {
  constructor(course, seed = course.seed) {
    this.c = course;
    this.rand = rng(seed * 7919 + 13);
    this.t = 0;
    this.timeLeft = course.time;
    this.events = [];
    this.done = false;
    this.result = null;
    this.windNow = [0, 0];
    this.buildWalls();
    this.makeFlock();
    const [dx, dy] = course.dog;
    this.hand = { x: course.post[0], y: course.post[1], h: -Math.PI / 2, walk: 0 };
    this.dog = { x: dx, y: dy, vx: 0, vy: 0, h: -Math.PI / 2, lying: true, tx: null, ty: null, cap: DOG_TOP, run: 0, inWater: false };
    this.cmd = 'lie'; this.cmdHold = 0; this.cmdCand = 'lie';
    this.buildSteps();
    this.scores = {};
    for (const p of course.phases) this.scores[p] = { max: PHASE_MAX[p], lost: [], pts: null, panic: 0, split: 0, dev: 0, devN: 0, missed: 0, t: 0, minD: 1e9 };
    this.measure();
    this.startStep(0);
  }

  // ---------------------------------------------------------------------------------- the field
  buildWalls() {
    const c = this.c, W = c.w, H = c.h;
    this.walls = [[0, 0, W, 0], [W, 0, W, H], [W, H, 0, H], [0, H, 0, 0]];
    this.circles = [];
    for (const [x, y, r] of c.trees || []) this.circles.push([x, y, r * 0.42]);
    for (const [x, y, r] of c.rocks || []) this.circles.push([x, y, r]);
    // trial gates: a hurdle each side of the gap, set along the gate line
    this.gateList = [];
    const g = c.gates || {};
    if (g.fetch) this.gateList.push(g.fetch);
    for (const d of g.drive || []) this.gateList.push(d);
    for (const gt of this.gateList) {
      const px = -gt.d[1], py = gt.d[0], h = gt.w / 2;
      for (const s of [-1, 1]) {
        this.walls.push([gt.c[0] + px * h * s, gt.c[1] + py * h * s, gt.c[0] + px * (h + 2.2) * s, gt.c[1] + py * (h + 2.2) * s]);
      }
    }
    const p = c.pen;
    if (p) {
      this.walls.push([p.x0, p.y0, p.x0, p.y1], [p.x0, p.y1, p.x1, p.y1], [p.x1, p.y1, p.x1, p.y0], [p.x0, p.y0, p.gx0, p.y0]);
      this.penGate = this.walls.length;
      this.walls.push([p.gx1, p.y0, p.gx1, p.y0 - (p.gx1 - p.gx0)]);
      this.penAngle = -Math.PI / 2; // open: swung up into the field as a wing
    }
    this.heather = c.heather || [];
    this.stream = c.stream || null;
    // corners a dog can run round: just off the pen's corners and the ends of the gate hurdles
    this.nav = [];
    if (p) for (const [x, y] of [[p.x0 - 1.3, p.y0 - 1.3], [p.x1 + 1.3, p.y0 - 1.3], [p.x0 - 1.3, p.y1 + 1.3], [p.x1 + 1.3, p.y1 + 1.3], [p.gx1 + 1.3, p.y0 - (p.gx1 - p.gx0) - 1.3], [p.gx1 - 1.3, p.y0 - (p.gx1 - p.gx0) - 1.3]]) this.nav.push([x, y]);
    for (const w of this.walls.slice(4, 4 + this.gateList.length * 2)) {
      const dx = w[2] - w[0], dy = w[3] - w[1], L = Math.hypot(dx, dy);
      this.nav.push([w[2] + dx / L * 1.5, w[3] + dy / L * 1.5]);
    }
    this.nav = this.nav.filter(([x, y]) => x > 0.5 && y > 0.5 && x < W - 0.5 && y < H - 0.5);
  }

  // can the dog run straight from a to b without hitting a hurdle or the pen?
  clear(ax, ay, bx, by) {
    for (let i = 4; i < this.walls.length; i++) {
      const w = this.walls[i];
      // a wall she's already brushing against doesn't count, or she'd never get away from it
      if (segCross(ax, ay, bx, by, w[0], w[1], w[2], w[3])) return false;
      const [wd, wx, wy] = segDist(ax, ay, w[0], w[1], w[2], w[3]);
      // a wall she's brushing doesn't block a path that leads away from it
      if (wd < 0.55 && (bx - ax) * (ax - wx) + (by - ay) * (ay - wy) > 0) continue;
      if (segDist(w[0], w[1], ax, ay, bx, by)[0] < 0.6 || segDist(w[2], w[3], ax, ay, bx, by)[0] < 0.6) return false;
    }
    return true;
  }
  // the next point to run at: the target itself, or the first corner of the shortest way round
  waypoint(ax, ay, bx, by) {
    if (this.clear(ax, ay, bx, by)) return [bx, by];
    const N = this.nav, n = N.length, dist = new Array(n).fill(1e9), first = new Array(n).fill(-1), done = new Array(n).fill(false);
    for (let i = 0; i < n; i++) if (this.clear(ax, ay, N[i][0], N[i][1])) { dist[i] = Math.hypot(N[i][0] - ax, N[i][1] - ay); first[i] = i; }
    let best = 1e9, bestFirst = -1;
    for (;;) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < 1e9 && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0) break;
      done[u] = true;
      if (this.clear(N[u][0], N[u][1], bx, by)) {
        const t = dist[u] + Math.hypot(bx - N[u][0], by - N[u][1]);
        if (t < best) { best = t; bestFirst = first[u]; }
      }
      for (let v = 0; v < n; v++) {
        if (done[v]) continue;
        const t = dist[u] + Math.hypot(N[v][0] - N[u][0], N[v][1] - N[u][1]);
        if (t < dist[v] && this.clear(N[u][0], N[u][1], N[v][0], N[v][1])) { dist[v] = t; first[v] = first[u]; }
      }
    }
    return bestFirst >= 0 ? N[bestFirst] : [bx, by];
  }

  inWater(x, y, pad = 0) {
    const s = this.stream;
    if (!s) return false;
    for (const [fx, fy, fr] of s.fords) if (Math.hypot(x - fx, y - fy) < fr) return false;
    for (let i = 0; i < s.pts.length - 1; i++) {
      const [a, b] = [s.pts[i], s.pts[i + 1]];
      if (segDist(x, y, a[0], a[1], b[0], b[1])[0] < s.w / 2 + pad) return true;
    }
    return false;
  }
  // nearest bank direction for something standing in (or near) the beck: away from the water's centre line
  waterPush(x, y, range) {
    const s = this.stream;
    let best = 1e9, nx = 0, ny = 0;
    for (const [fx, fy, fr] of s.fords) if (Math.hypot(x - fx, y - fy) < fr) return null;
    for (let i = 0; i < s.pts.length - 1; i++) {
      const [a, b] = [s.pts[i], s.pts[i + 1]];
      const [d, cx, cy] = segDist(x, y, a[0], a[1], b[0], b[1]);
      if (d < best) { best = d; nx = x - cx; ny = y - cy; }
    }
    const edge = best - s.w / 2;
    if (edge > range) return null;
    const L = Math.hypot(nx, ny) || 1;
    return [nx / L, ny / L, edge];
  }
  heatherAt(x, y) {
    for (const [hx, hy, hr] of this.heather) if (Math.hypot(x - hx, y - hy) < hr) return true;
    return false;
  }

  makeFlock() {
    const c = this.c, R = this.rand;
    this.sheep = [];
    let id = 0;
    for (const grp of c.flock) {
      for (let i = 0; i < grp.n; i++) {
        const k = KINDS[grp.kind];
        const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 4;
        this.sheep.push({
          id: id++, kind: grp.kind, ...k, x: c.lift[0] + Math.cos(a) * d, y: c.lift[1] + Math.sin(a) * d,
          vx: 0, vy: 0, h: R() * Math.PI * 2, stress: 0, graze: R() * 4, wx: 0, wy: 0, walk: 0,
          bolt: 0, bx: 0, by: 0, stubborn: false, marked: false, stand: 0, bleat: 2 + R() * 6,
          pitch: grp.kind === 'lamb' ? 1.5 + R() * 0.2 : grp.kind === 'ram' ? 0.62 : 0.9 + R() * 0.25,
          seed: R(), step: R() * 10, prev: 0, judged: false, penned: false,
        });
      }
    }
    const ewes = this.sheep.filter(s => s.kind === 'ewe');
    for (let i = 0; i < (c.marked || 0); i++) ewes[i].marked = true;
    for (let i = 0; i < (c.stubborn || 0); i++) ewes[ewes.length - 1 - i].stubborn = true;
  }

  // ---------------------------------------------------------------------------------- the course
  buildSteps() {
    const c = this.c, s = [];
    for (const p of c.phases) {
      if (p === 'outrun') s.push({ k: 'lift', phase: p });
      if (p === 'fetch') s.push({ k: 'gate', gate: c.gates.fetch, phase: p, label: 'through the fetch gates' }, { k: 'post', phase: p });
      if (p === 'drive') c.gates.drive.forEach((g, i) => s.push({ k: 'gate', gate: g, phase: p, label: i ? 'across, through the cross-drive gates' : 'away, through the drive gates' }));
      if (p === 'shed') s.push({ k: 'ring', phase: p }, { k: 'shed', phase: p });
      if (p === 'pen') s.push({ k: 'pen', phase: p });
    }
    this.steps = s;
  }

  get stepNow() { return this.steps[this.stepIdx]; }

  startStep(i) {
    this.stepIdx = i;
    const st = this.steps[i];
    if (!st) return;
    st.t = 0;
    st.from = [this.cx, this.cy];
    if (st.k === 'gate') {
      const g = st.gate;
      for (const s of this.sheep) { s.prev = (s.x - g.c[0]) * g.d[0] + (s.y - g.c[1]) * g.d[1]; s.judged = false; }
      st.through = 0; st.missed = 0;
    }
    if (st.k === 'lift') st.from = [this.cx, this.cy];
    if (st.k === 'shed') st.hold = 0;
    this.events.push({ t: 'step', step: st, i });
  }

  // where the sheep should be heading right now (for the arrow on screen and for the bot)
  goal() {
    const st = this.stepNow, c = this.c;
    if (!st) return null;
    if (st.k === 'lift' || st.k === 'post') return c.post;
    if (st.k === 'gate') return st.gate.c;
    if (st.k === 'ring' || st.k === 'shed') return c.ring.c;
    if (st.k === 'pen') return [(c.pen.x0 + c.pen.x1) / 2, (c.pen.y0 + c.pen.y1) / 2];
  }

  finishStep() {
    const st = this.stepNow, sc = this.scores[st.phase];
    const next = this.steps[this.stepIdx + 1];
    if (!next || next.phase !== st.phase) this.closePhase(st.phase);
    if (!next) {
      this.done = true; this.result = 'complete';
      this.events.push({ t: 'end', result: 'complete' });
      return;
    }
    this.startStep(this.stepIdx + 1);
    void sc;
  }

  closePhase(p) {
    const sc = this.scores[p], n = this.sheep.length;
    const lose = (pts, why) => { pts = Math.round(pts); if (pts > 0) sc.lost.push({ pts, why }); };
    const panic = sc.panic / n;
    if (p === 'outrun') {
      lose(Math.min(5, Math.max(0, 6 - sc.minD) * 1.5), 'cut in tight');
      lose(Math.min(5, panic / 0.6), 'rough lift');
      lose(Math.min(3, Math.max(0, sc.t - 45) / 12), 'slow outrun');
    }
    if (p === 'fetch' || p === 'drive') {
      if (sc.missed) lose(sc.missed * 2, `${words(sc.missed)} missed the gates`);
      const dev = sc.devN ? sc.dev / sc.devN : 0;
      lose(Math.min(p === 'drive' ? 12 : 8, Math.max(0, dev - 1.5)), dev > 5 ? 'wandering lines' : 'off the line');
      lose(Math.min(6, panic / 0.8), 'pushed them too hard');
      lose(Math.min(4, sc.split / 5), 'let the flock split');
    }
    if (p === 'shed') {
      lose(Math.min(6, Math.max(0, sc.t - 25) / 12), 'took a while to shed');
      lose(Math.min(3, panic / 0.8), 'rough in the ring');
    }
    if (p === 'pen') {
      lose(Math.min(6, Math.max(0, sc.t - 35) / 12), 'slow at the pen');
      lose(Math.min(3, panic / 0.8), 'rushed the pen');
    }
    let lost = sc.lost.reduce((a, b) => a + b.pts, 0);
    if (lost > sc.max) { lost = sc.max; }
    sc.pts = sc.max - lost;
    this.events.push({ t: 'phase', phase: p, pts: sc.pts, max: sc.max });
  }

  score() {
    let s = 0, m = 0;
    for (const p of this.c.phases) { const sc = this.scores[p]; m += sc.max; if (sc.pts != null) s += sc.pts; }
    return [s, m];
  }

  // ---------------------------------------------------------------------------------- the dog
  setTarget(x, y, cap = DOG_TOP) { this.dog.tx = x; this.dog.ty = y; this.dog.cap = cap; }
  clearTarget() { this.dog.tx = null; }

  retire(why = 'retired') {
    if (this.done) return;
    for (const p of this.c.phases) if (this.scores[p].pts == null) this.scores[p].pts = 0;
    this.done = true; this.result = why;
    this.events.push({ t: 'end', result: why });
  }

  // ---------------------------------------------------------------------------------- stepping
  update(dt) {
    this.acc = (this.acc || 0) + dt;
    let n = 0;
    while (this.acc >= DT && n < 12) { this.acc -= DT; this.tick(); n++; }
    if (n === 12) this.acc = 0;
  }

  measure() {
    // at the pen, the ones already in don't count: the flock is whoever's still outside
    let out = this.sheep.filter(s => !s.penned);
    if (!out.length) out = this.sheep;
    let x = 0, y = 0;
    for (const s of out) { x += s.x; y += s.y; }
    this.cx = x / out.length; this.cy = y / out.length;
    let far = 0;
    for (const s of out) far = Math.max(far, Math.hypot(s.x - this.cx, s.y - this.cy));
    this.spread = far;
    this.out = out;
  }

  tick() {
    if (this.done) { this.moveSheep(); this.closePen(); return; }
    this.t += DT;
    this.timeLeft -= DT;
    const w = this.c.wind;
    if (w) {
      const g = 0.6 + 0.4 * Math.sin(this.t * 0.37) + 0.35 * Math.sin(this.t * 1.13 + 1) * Math.sin(this.t * 0.21);
      this.windNow = [w.d[0] * w.s * g, w.d[1] * w.s * g];
    }
    this.moveDog();
    this.moveHandler();
    this.moveSheep();
    this.measure();
    this.commands();
    this.judge();
    if (this.timeLeft <= 0 && !this.done) { this.timeLeft = 0; this.retire('time'); }
  }

  moveDog() {
    const d = this.dog;
    let wantX = 0, wantY = 0;
    const slow = (this.heatherAt(d.x, d.y) ? 0.8 : 1) * (d.inWater ? 0.5 : 1);
    if (d.tx != null) {
      const [wx, wy] = this.waypoint(d.x, d.y, d.tx, d.ty);
      const via = wx !== d.tx || wy !== d.ty;
      let tx = wx - d.x, ty = wy - d.y;
      const direct = Math.hypot(tx, ty) || 0.001;
      const dist = direct + (via ? Math.hypot(d.tx - wx, d.ty - wy) : 0);
      const speed = Math.min(d.cap, dist * 1.9) * slow;
      if (dist > 0.15) {
        tx /= direct; ty /= direct;
        // a good dog doesn't run through her sheep to get round them: she flanks, wide
        const ox = d.x - this.cx, oy = d.y - this.cy, od = Math.hypot(ox, oy) || 0.01;
        const tdc = Math.hypot(d.tx - this.cx, d.ty - this.cy);
        const [sd, , , st] = segDist(this.cx, this.cy, d.x, d.y, d.tx, d.ty);
        if (!via && tdc > this.spread + 2 && od > this.spread + 0.5 && sd < this.spread + 4 && st > 0.05 && st < 0.95) {
          // swing round at the distance she's been sent to, outside their comfort zone
          const R = Math.max(this.spread + 9, Math.min(15, tdc));
          // pick a side and stick to it, unless the other way is clearly shorter
          const cr = (ox * (d.ty - this.cy) - oy * (d.tx - this.cx)) / (od * tdc);
          const sg = d.flank && Math.abs(cr) < 0.35 ? d.flank : cr > 0 ? 1 : -1;
          let fx = -oy / od * sg, fy = ox / od * sg;
          const rad = Math.max(-1, Math.min(2, (R - od) / R * 2.2));
          fx += ox / od * rad; fy += oy / od * rad;
          const L = Math.hypot(fx, fy); tx = fx / L; ty = fy / L;
          d.flank = sg;
        } else d.flank = 0;
        wantX = tx * speed; wantY = ty * speed;
      }
    }
    const k = 1 - Math.exp(-(d.tx != null ? 9 : 6) * DT);
    d.vx += (wantX - d.vx) * k; d.vy += (wantY - d.vy) * k;
    d.x += d.vx * DT; d.y += d.vy * DT;
    const sp = Math.hypot(d.vx, d.vy);
    if (sp > 0.3) {
      const a = Math.atan2(d.vy, d.vx);
      let da = a - d.h; da = Math.atan2(Math.sin(da), Math.cos(da));
      d.h += da * Math.min(1, 12 * DT);
    }
    d.run += sp * DT;
    d.speed = sp;
    d.lying = d.tx == null && sp < 0.4;
    this.collide(d, DOG_R, true);
    d.inWater = this.inWater(d.x, d.y);
  }

  // at the pen the handler leaves the post and stands by the open gate, holding the rope
  moveHandler() {
    const h = this.hand, c = this.c, p = c.pen;
    let tx = c.post[0], ty = c.post[1];
    if (p && this.stepNow?.k === 'pen') {
      // step up to hold the gate once they're coming at the gap; otherwise wait out of the way behind the pen
      const mx = (p.gx0 + p.gx1) / 2, inFront = Math.abs(this.cx - mx) < (h.atGate ? 4 : 2.5) && this.cy < p.y0 + 0.5 && this.cy > p.y0 - 12;
      if (inFront) { tx = p.gx1 + 0.35; ty = p.y0 - (p.gx1 - p.gx0) - 0.7; h.atGate = true; }
      else { tx = (p.x0 + p.x1) / 2; ty = p.y1 + 1.8; h.atGate = false; }
    }
    if (p && this.done && this.result === 'complete') { tx = p.gx1 + 0.8; ty = p.y0 - 0.6; }
    const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy);
    if (d > 0.1) { const v = Math.min(1.5, d * 2) * DT; h.x += dx / d * v; h.y += dy / d * v; h.walk += v; h.moving = true; } else h.moving = false;
  }

  moveSheep() {
    const S = this.sheep, d = this.dog, R = this.rand, n = S.length;
    const dogSp = d.speed || 0;
    const shedding = this.stepNow?.k === 'shed';
    for (const s of S) {
      let ax = 0, ay = 0; // where she wants to go (a direction, scaled later by how worked up she is)
      let ex = 0, ey = 0; // direct nudges in m/s (spacing, walls, wind)
      // --- the dog
      const dx = s.x - d.x, dy = s.y - d.y, dd = Math.hypot(dx, dy) || 0.01;
      let flight = s.flight * (d.lying ? 0.6 : 1) * (1 + 0.2 * Math.min(1, dogSp / 8));
      let threat = dd < flight ? 1 - dd / flight : 0;
      if (s.kind === 'ram') {
        // the tup stands and stares at a dog that won't come on, for a while; then he gives way
        if (dd > 9) s.standT = 0;
        if (dd > 3.2 && dogSp < 2.2 && threat > 0 && (s.standT || 0) < 2.5) {
          threat *= 0.15; s.stand = Math.min(1, s.stand + DT * 2); s.standT = (s.standT || 0) + DT;
        } else s.stand = Math.max(0, s.stand - DT * 2);
      }
      ax += dx / dd * threat * 1.7; ay += dy / dd * threat * 1.7;
      // --- the handler, standing by the pen: they give a person a little room
      const hx = s.x - this.hand.x, hy = s.y - this.hand.y, hd = Math.hypot(hx, hy) || 0.01;
      if (hd < 2.6) { const t = (1 - hd / 2.6) * 0.8; ax += hx / hd * t; ay += hy / hd * t; threat = Math.max(threat, t * 0.5); }
      // --- the others
      let cx = 0, cy = 0, cn = 0, vx = 0, vy = 0, vn = 0, st = 0;
      for (const o of S) {
        if (o === s) continue;
        const ox = o.x - s.x, oy = o.y - s.y, od = Math.hypot(ox, oy);
        if (od < 11) {
          const w = (s.kind === 'lamb' && o.kind === 'ewe' ? 2.5 : 1) * (o.penned && !s.penned ? 3 : 1) * (shedding && o.marked !== s.marked ? 0.35 : 1);
          cx += o.x * w; cy += o.y * w; cn += w; st += o.stress * w;
          if (od < 4.5) { vx += o.vx; vy += o.vy; vn++; }
          const min = s.r + o.r + 0.3;
          if (od < min && od > 0.001) { const p = (min - od) / min * 2.2; ex -= ox / od * p; ey -= oy / od * p; }
        }
      }
      // a dog right on top of them breaks the bunch: flight beats flocking
      let cw = (0.25 + 0.9 * s.stress) * (1 - threat * threat);
      if (!cn) { cx = this.cx; cy = this.cy; cn = 1; cw = 0.7; } else { cx /= cn; cy /= cn; }
      const tx = cx - s.x, ty = cy - s.y, tl = Math.hypot(tx, ty);
      if (tl > 0.01 && !s.bolt) {
        const pull = Math.min(1, Math.max(0, (tl - 1.1) / 3)) * cw;
        ax += tx / tl * pull; ay += ty / tl * pull;
      }
      if (vn) {
        const al = (0.15 + 0.6 * s.stress) / s.top / vn;
        ax += vx * al; ay += vy * al;
      }
      // --- worked up: closeness of the dog, a dog coming in fast, and the others' nerves
      const want = Math.max(threat * (1 + dogSp / 16), cn > 0 ? (st / Math.max(1, cn)) * 0.65 : 0, s.bolt ? 1 : 0);
      if (want > s.stress) s.stress += (Math.min(1.2, want) - s.stress) * Math.min(1, s.up * DT);
      else s.stress += (want - s.stress) * Math.min(1, 0.4 * DT);
      s.stress = Math.min(1.2, Math.max(0, s.stress));
      // --- a stubborn ewe makes a break for it
      if (s.stubborn && !s.bolt && s.stress > 0.45 && R() < 0.11 * DT) {
        const side = R() < 0.5 ? 1 : -1;
        s.bx = -dy / dd * side + dx / dd * 0.5; s.by = dx / dd * side + dy / dd * 0.5;
        const L = Math.hypot(s.bx, s.by); s.bx /= L; s.by /= L;
        s.bolt = 1.6 + R() * 1.4;
      }
      if (s.bolt) { s.bolt = Math.max(0, s.bolt - DT); ax = s.bx * 1.4 + dx / dd * threat; ay = s.by * 1.4 + dy / dd * threat; }
      // --- once in the pen they settle at the back of it, out of the way
      const pen = this.c.pen, inPen = pen && this.stepNow?.k === 'pen' || this.done ? pen && s.x > pen.x0 && s.x < pen.x1 && s.y > pen.y0 && s.y < pen.y1 : false;
      if (inPen) {
        const bx = (pen.x0 + pen.x1) / 2 - s.x, by = pen.y1 - 1.4 - s.y, bl = Math.hypot(bx, by);
        if (bl > 0.6) { ax += bx / bl * 0.7; ay += by / bl * 0.7; }
        s.graze = Math.max(s.graze, 1); s.walk = 0;
      }
      // --- grazing: amble a few steps, then put the head down
      if (s.stress < 0.3) {
        s.graze -= DT;
        if (s.graze <= 0) {
          if (s.walk) { s.walk = 0; s.graze = 2.5 + R() * 6; }
          else { const a = R() * Math.PI * 2; s.wx = Math.cos(a); s.wy = Math.sin(a); s.walk = 1; s.graze = 1 + R() * 2.5; }
        }
        if (s.walk) { ex += s.wx * 0.35 * (1 - s.stress * 3); ey += s.wy * 0.35 * (1 - s.stress * 3); }
      }
      // --- wind: grazing sheep drift with it
      if (this.c.wind) { const k = Math.max(0, 1 - s.stress * 1.2); ex += this.windNow[0] * k; ey += this.windNow[1] * k; }
      // --- walls, trees, the beck
      // a sheep pressed against a wall slides along it rather than pushing into it
      const slide = (nx, ny, near) => {
        const into = -(ax * nx + ay * ny);
        if (into > 0) { ax += nx * into * near; ay += ny * into * near; }
      };
      for (const w of this.walls) {
        const [wd, wx, wy] = segDist(s.x, s.y, w[0], w[1], w[2], w[3]);
        if (wd < 1.9 && wd > 0.001) {
          const nx = (s.x - wx) / wd, ny = (s.y - wy) / wd, near = (1.9 - wd) / 1.9;
          slide(nx, ny, Math.min(1, near * 1.6));
          ex += nx * near * 0.9; ey += ny * near * 0.9;
        }
      }
      for (const [ox, oy, orr] of this.circles) {
        const ox2 = s.x - ox, oy2 = s.y - oy, od = Math.hypot(ox2, oy2) - orr;
        if (od < 1.6) {
          const L = Math.hypot(ox2, oy2) || 1, near = (1.6 - Math.max(0, od)) / 1.6;
          slide(ox2 / L, oy2 / L, Math.min(1, near * 1.6));
          ex += ox2 / L * near * 0.9; ey += oy2 / L * near * 0.9;
        }
      }
      let wet = false;
      if (this.stream) {
        const wp = this.waterPush(s.x, s.y, 2.5);
        if (wp) {
          const [nx, ny, edge] = wp;
          wet = edge < 0;
          // they turn along the bank rather than into it
          const into = ax * -nx + ay * -ny;
          if (into > 0) { ax += nx * into * 1.1; ay += ny * into * 1.1; }
          const p = Math.min(1, (2.5 - edge) / 2.5) * 1.6; ex += nx * p; ey += ny * p;
        }
      }
      // --- put it together
      let top = s.top * (this.heatherAt(s.x, s.y) ? 0.6 : 1) * (wet ? 0.5 : 1) * (s.bolt ? 1.1 : 1);
      const v = s.calm + (top - s.calm) * Math.pow(s.stress, 1.1);
      let tvx = ax * v + ex, tvy = ay * v + ey;
      const tl2 = Math.hypot(tvx, tvy);
      if (tl2 > top) { tvx *= top / tl2; tvy *= top / tl2; }
      const k = 1 - Math.exp(-s.acc * DT);
      s.vx += (tvx - s.vx) * k; s.vy += (tvy - s.vy) * k;
      s.nx = s.x + s.vx * DT; s.ny = s.y + s.vy * DT;
    }
    for (const s of S) {
      s.x = s.nx; s.y = s.ny;
      const sp = Math.hypot(s.vx, s.vy);
      s.speed = sp;
      if (s.stand > 0.3) {
        const a = Math.atan2(d.y - s.y, d.x - s.x); let da = a - s.h; da = Math.atan2(Math.sin(da), Math.cos(da)); s.h += da * Math.min(1, 4 * DT);
      } else if (sp > 0.18) {
        const a = Math.atan2(s.vy, s.vx); let da = a - s.h; da = Math.atan2(Math.sin(da), Math.cos(da)); s.h += da * Math.min(1, (2 + sp * 2) * DT);
      }
      s.step += sp * DT;
    }
    // bodies don't overlap: sheep against sheep, and the dog shoulders them aside
    for (let i = 0; i < n; i++) {
      const a = S[i];
      for (let j = i + 1; j < n; j++) {
        const b = S[j], ox = b.x - a.x, oy = b.y - a.y, od = Math.hypot(ox, oy), min = a.r + b.r;
        if (od < min && od > 0.0001) { const p = (min - od) / 2 / od; a.x -= ox * p; a.y -= oy * p; b.x += ox * p; b.y += oy * p; }
      }
      const ox = a.x - d.x, oy = a.y - d.y, od = Math.hypot(ox, oy), min = a.r + DOG_R;
      if (od < min && od > 0.0001) { const p = (min - od) / od; a.x += ox * p * 0.8; a.y += oy * p * 0.8; d.x -= ox * p * 0.2; d.y -= oy * p * 0.2; }
      this.collide(a, a.r, false);
      // bleats: more often when worked up
      a.bleat -= DT * (1 + a.stress * 3);
      if (a.bleat <= 0) { a.bleat = 4 + R() * 10; this.events.push({ t: 'bleat', s: a }); }
    }
  }

  collide(o, r, isDog) {
    for (const w of this.walls) {
      const [wd, wx, wy] = segDist(o.x, o.y, w[0], w[1], w[2], w[3]);
      if (wd < r) {
        let nx, ny;
        if (wd > 0.0001) { nx = (o.x - wx) / wd; ny = (o.y - wy) / wd; } else { nx = -(w[3] - w[1]); ny = w[2] - w[0]; const L = Math.hypot(nx, ny); nx /= L; ny /= L; }
        o.x = wx + nx * r; o.y = wy + ny * r;
        const vn = o.vx * nx + o.vy * ny; if (vn < 0) { o.vx -= nx * vn; o.vy -= ny * vn; }
      }
    }
    for (const [cx, cy, cr] of this.circles) {
      const ox = o.x - cx, oy = o.y - cy, od = Math.hypot(ox, oy), min = cr + r;
      if (od < min && od > 0.0001) { o.x = cx + ox / od * min; o.y = cy + oy / od * min; }
    }
    if (o.penned && this.c.pen) {
      const p = this.c.pen;
      if (o.y < p.y0 + r) { o.y = p.y0 + r; if (o.vy < 0) o.vy = 0; }
      o.x = Math.max(p.x0 + r, Math.min(p.x1 - r, o.x));
    }
    const W = this.c.w, H = this.c.h;
    o.x = Math.max(r, Math.min(W - r, o.x)); o.y = Math.max(r, Math.min(H - r, o.y));
    if (!isDog && this.stream && this.inWater(o.x, o.y, -0.3)) {
      // pushed in anyway: scramble straight out
      const wp = this.waterPush(o.x, o.y, 9);
      if (wp) { o.x += wp[0] * 2.2 * DT; o.y += wp[1] * 2.2 * DT; }
    }
  }

  // which whistle the handler is giving, worked out from what the dog is doing
  commands() {
    const d = this.dog;
    let c;
    if (d.lying || (d.tx == null && d.speed < 1.2)) c = 'lie';
    else {
      const ox = d.x - this.cx, oy = d.y - this.cy, od = Math.hypot(ox, oy) || 1;
      const tan = (ox * d.vy - oy * d.vx) / od, rad = -(ox * d.vx + oy * d.vy) / od;
      if (od < Math.max(25, this.spread + 16) && Math.abs(tan) > 2.6 && Math.abs(tan) > rad * 1.2) c = tan > 0 ? 'bye' : 'away';
      else if (rad > 0.6 && od < 40) c = d.speed > 6 ? 'run' : 'walk';
      else c = this.cmd === 'lie' ? 'run' : this.cmd;
      if (c === 'run') c = this.cmd === 'lie' ? 'go' : this.cmd;
    }
    if (c !== this.cmdCand) { this.cmdCand = c; this.cmdHold = 0; }
    this.cmdHold += DT;
    if (c !== this.cmd && this.cmdHold > (c === 'lie' ? 0.15 : 0.35)) {
      this.cmd = c;
      this.events.push({ t: 'cmd', c });
    }
  }

  // ---------------------------------------------------------------------------------- the judge
  judge() {
    const st = this.stepNow;
    if (!st) return;
    st.t += DT;
    const sc = this.scores[st.phase];
    sc.t += DT;
    const n = this.sheep.length;
    for (const s of this.sheep) if (s.stress > 0.8) sc.panic += DT;
    let lost = 0;
    for (const s of this.sheep) if (Math.hypot(s.x - this.cx, s.y - this.cy) > 15) lost++;
    if (lost) sc.split += DT;
    // how straight is the line? distance of the flock's middle from the line it should be walking
    const lineTo = st.k === 'gate' ? st.gate.c : st.k === 'post' ? this.c.post : null;
    if (lineTo) {
      const [a, b] = [st.from, lineTo];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      if (L > 4) {
        const t = ((this.cx - a[0]) * dx + (this.cy - a[1]) * dy) / (L * L);
        if (t > 0.05 && t < 1) {
          const dev = Math.abs((this.cx - a[0]) * dy - (this.cy - a[1]) * dx) / L;
          sc.dev += dev * DT; sc.devN += DT;
        }
      }
    }
    if (st.k === 'lift') {
      sc.minD = Math.min(sc.minD, Math.hypot(this.dog.x - this.cx, this.dog.y - this.cy) - this.spread);
      if (Math.hypot(this.cx - st.from[0], this.cy - st.from[1]) > 5) this.finishStep();
    } else if (st.k === 'gate') {
      const g = st.gate, px = -g.d[1], py = g.d[0];
      let judged = 0;
      for (const s of this.sheep) {
        const now = (s.x - g.c[0]) * g.d[0] + (s.y - g.c[1]) * g.d[1];
        if (!s.judged && s.prev < 0 && now >= 0) {
          const lat = Math.abs((s.x - g.c[0]) * px + (s.y - g.c[1]) * py);
          if (lat < 30) {
            s.judged = true;
            const ok = lat < g.w / 2;
            if (ok) st.through++; else { st.missed++; sc.missed++; }
            this.events.push({ t: 'gate', ok, s });
          }
        }
        s.prev = now;
        if (s.judged) judged++;
      }
      const past = (this.cx - g.c[0]) * g.d[0] + (this.cy - g.c[1]) * g.d[1];
      const giveUp = st.t > 100;
      if (judged === n || (past > 7 && judged >= n / 2) || giveUp) {
        const left = n - judged;
        if (left) { st.missed += left; sc.missed += left; }
        this.events.push({ t: 'gatedone', through: st.through, missed: st.missed, giveUp });
        this.finishStep();
      }
    } else if (st.k === 'post') {
      if (Math.hypot(this.cx - this.c.post[0], this.cy - this.c.post[1]) < 9 && this.spread < 12) this.finishStep();
    } else if (st.k === 'ring') {
      const r = this.c.ring;
      if (this.sheep.every(s => Math.hypot(s.x - r.c[0], s.y - r.c[1]) < r.r)) this.finishStep();
    } else if (st.k === 'shed') {
      const r = this.c.ring;
      const m = this.sheep.filter(s => s.marked), u = this.sheep.filter(s => !s.marked);
      let gap = 1e9;
      for (const a of m) for (const b of u) gap = Math.min(gap, Math.hypot(a.x - b.x, a.y - b.y));
      const inRing = m.every(s => Math.hypot(s.x - r.c[0], s.y - r.c[1]) < r.r + 2.5);
      let mates = 0;
      for (const a of m) for (const b of m) mates = Math.max(mates, Math.hypot(a.x - b.x, a.y - b.y));
      st.gap = gap;
      st.ok = inRing && gap > 3.4 && mates < 7;
      st.hold = st.ok ? st.hold + DT : Math.max(0, st.hold - DT * 2);
      if (st.hold > 1.0) { this.events.push({ t: 'shed' }); this.finishStep(); }
    } else if (st.k === 'pen') {
      const p = this.c.pen;
      let inside = 0;
      for (const s of this.sheep) {
        // once in, the handler keeps them in: a penned sheep stays penned
        s.penned = s.penned || (s.x > p.x0 && s.x < p.x1 && s.y > p.y0 + 0.4 && s.y < p.y1);
        if (s.penned) inside++;
      }
      st.inside = inside;
      if (inside === n) { this.events.push({ t: 'penned' }); this.finishStep(); }
    }
  }

  // after the last ewe is in, the handler swings the gate shut
  closePen() {
    if (!this.c.pen || this.result !== 'complete') return;
    const p = this.c.pen, L = p.gx1 - p.gx0;
    this.penAngle = Math.max(-Math.PI, this.penAngle - DT * 2.2);
    const w = this.walls[this.penGate];
    w[2] = p.gx1 + Math.cos(this.penAngle) * L; w[3] = p.y0 + Math.sin(this.penAngle) * L;
    this.dog.tx = null;
    this.moveDog();
  }
}

function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

function words(n) { return ['no sheep', 'one sheep', 'two sheep', 'three sheep', 'four sheep', 'five sheep', 'six sheep', 'seven sheep', 'eight sheep'][n] || n + ' sheep'; }
