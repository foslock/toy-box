// Spaghetti Bridge physics: pin-jointed pasta trusses solved with XPBD
// (small substeps, one iteration each), so every member's force falls out
// of its constraint multiplier. World units are graph-paper squares, y is up.

export const G = 20;          // squares per second², a bit brisker than real
const SUB = 24;               // substeps per frame
const TAU = 0.05;
const DAMP = 40;             // member damping, per second             // seconds of smoothing on member forces before they can snap

// strength is in "weights of the toy car" (car weight = 1 × G = 20)
export const MAT = {
  spaghetti: { key: 'spaghetti', label: 'Spaghetti', max: 5, cost: 1.5, mass: 0.02, T: 120, C: 16, buckle: true, compliance: 4e-5 },
  rigatoni:  { key: 'rigatoni',  label: 'Rigatoni',  max: 2.5, cost: 5, mass: 0.08, T: 70, C: 150, compliance: 1e-5 },
  lasagne:   { key: 'lasagne',   label: 'Lasagne',   max: 3, cost: 6, mass: 0.12, T: 80, C: 80, deck: true, compliance: 1.5e-5 },
};
export const MATS = ['spaghetti', 'rigatoni', 'lasagne'];

// Spaghetti buckles like a real column: the longer the strand, the less it takes to fold it.
export function compLimit(mat, L) { return mat.buckle ? mat.C / Math.max(1, L * L) : mat.C; }

export const LOADS = {
  car:     { name: 'Toy car',       wheels: [-0.5, 0.5], r: 0.26, mass: 1,   speed: 2.6 },
  books:   { name: 'Textbooks',     wheels: [-0.65, 0.65], r: 0.28, mass: 2.4, speed: 2.1 },
  hamster: { name: 'Biscuit the hamster', wheels: [0], r: 0.48, mass: 0.6, speed: 3.4 },
  tray:    { name: 'Lunch tray',    wheels: [-0.8, 0.8], r: 0.2, mass: 3.4, speed: 1.8 },
  bowling: { name: "The head's bowling ball", wheels: [0], r: 0.55, mass: 5.5, speed: 1.5 },
};

export const key = (x, y) => x + ',' + y;
export const memberLen = m => Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]);
export const memberCost = m => memberLen(m) * MAT[m.mat].cost;
export const designCost = ms => ms.reduce((s, m) => s + memberCost(m), 0);

export class Sim {
  constructor(level, members, opts = {}) {
    this.level = level;
    this.t = 0;
    this.ps = [];            // particles {x,y,px,py,vx,vy,w,r,wheel}
    this.cs = [];            // constraints
    this.loads = [];
    this.queue = level.loads.slice();
    this.events = [];        // break/finish/fail events for the view and sound
    this.firstBreak = null;
    this.breaks = 0;
    this.result = null;      // 'pass' | 'fail'
    this.failWhy = '';
    this.nextLoadAt = opts.settle ?? 1.0;
    this.unbreakable = !!opts.unbreakable;
    this.anchorSet = new Set(level.anchors.map(a => key(a[0], a[1])));
    const idx = new Map();
    const node = (x, y) => {
      const k = key(x, y);
      if (idx.has(k)) return idx.get(k);
      const fixed = this.anchorSet.has(k);
      const p = { x, y, px: x, py: y, vx: 0, vy: 0, m: 0, w: 0, r: 0, fixed, gx: x, gy: y };
      idx.set(k, this.ps.length); this.ps.push(p);
      return this.ps.length - 1;
    };
    for (const m of members) {
      const a = node(m.a[0], m.a[1]), b = node(m.b[0], m.b[1]);
      const mat = MAT[m.mat], L = memberLen(m);
      this.ps[a].m += mat.mass * L / 2; this.ps[b].m += mat.mass * L / 2;
      this.cs.push({ a, b, L, mat, lambda: 0, f: 0, broken: false, debris: false, src: m });
    }
    for (const p of this.ps) p.w = p.fixed ? 0 : 1 / Math.max(0.03, p.m);
    this.nodeIndex = idx;
  }

  deckSegs() { return this.cs.filter(c => c.mat && c.mat.deck && !c.broken && !c.debris); }

  spawnLoad(kind) {
    const L = LOADS[kind], lv = this.level;
    const wm = L.mass / L.wheels.length;
    const sx = lv.spawn[0], sy = lv.spawn[1];
    const ids = L.wheels.map(dx => {
      const p = { x: sx + dx, y: sy + L.r + 0.02, vx: 0, vy: 0, m: wm, w: 1 / wm, r: L.r, wheel: true, contact: 0 };
      p.px = p.x; p.py = p.y;
      this.ps.push(p); return this.ps.length - 1;
    });
    const links = [];
    for (let i = 1; i < ids.length; i++) {
      const c = { a: ids[i - 1], b: ids[i], L: L.wheels[i] - L.wheels[i - 1], mat: null, lambda: 0, f: 0, broken: false, debris: false, link: true };
      this.cs.push(c); links.push(c);
    }
    const load = { kind, def: L, ids, links, state: 'rolling', t0: this.t, best: sx, bestT: this.t };
    this.loads.push(load);
    this.events.push({ type: 'start', load });
    return load;
  }

  current() { return this.loads.find(l => l.state === 'rolling'); }

  step(dt) {
    if (this.result) { this.settle(dt); return; }
    if (!this.current() && this.queue.length && this.t >= this.nextLoadAt) this.spawnLoad(this.queue.shift());
    this.integrate(dt);
    this.t += dt;
    this.checkLoads();
  }

  // after the test is decided, keep the wreckage moving
  settle(dt) { this.integrate(dt); this.t += dt; }

  integrate(dt) {
    const h = dt / SUB, ps = this.ps, cs = this.cs, lv = this.level;
    const deck = this.deckSegs();
    const k = Math.min(1, h / TAU);
    for (let s = 0; s < SUB; s++) {
      for (const p of ps) {
        if (p.w === 0) continue;
        p.vy -= G * h;
        p.px = p.x; p.py = p.y;
        p.x += p.vx * h; p.y += p.vy * h;
        if (p.wheel) p.contact = 0;
      }
      // members and load links
      for (const c of cs) {
        if (c.broken) continue;
        const A = ps[c.a], B = ps[c.b];
        const wsum = A.w + B.w;
        if (wsum === 0) continue;
        let dx = B.x - A.x, dy = B.y - A.y;
        const d = Math.hypot(dx, dy) || 1e-9;
        const C = d - c.L;
        const alpha = c.mat ? c.mat.compliance * c.L / (h * h) : 0;
        const dl = (-C - alpha * c.lambda) / (wsum + alpha);
        c.lambda = c.lambda + dl;
        dx /= d; dy /= d;
        A.x -= A.w * dl * dx; A.y -= A.w * dl * dy;
        B.x += B.w * dl * dx; B.y += B.w * dl * dy;
      }
      // wheels on the lasagne deck and on the furniture
      for (const p of ps) {
        if (!p.wheel) continue;
        for (const c of deck) this.wheelOnSeg(p, c);
        for (const bx of lv.boxes) this.circleBox(p, bx);
        if (p.y < p.r) { p.y = p.r; p.contact = 1; p.tx = 1; p.ty = 0; }
      }
      // loose joints and broken bits land on the furniture and the floor
      for (const p of ps) {
        if (p.w === 0 || p.wheel) continue;
        for (const bx of lv.boxes) this.pointBox(p, bx);
        if (p.y < 0.05) { p.y = 0.05; p.x = p.px + (p.x - p.px) * 0.6; }
      }
      // velocities, then the wheels' drive acts as rolling friction toward cruising speed
      for (const p of ps) {
        if (p.w === 0) continue;
        p.vx = (p.x - p.px) / h; p.vy = (p.y - p.py) / h;
        const damp = p.wheel ? 0.02 : 0.25;
        p.vx *= 1 - damp * h; p.vy *= 1 - damp * h;
      }
      // dashpot along every member so the trusses ring down instead of bouncing forever
      for (const c of cs) {
        if (c.broken || !c.mat) continue;
        const A = ps[c.a], B = ps[c.b], wsum = A.w + B.w;
        if (wsum === 0) continue;
        let nx = B.x - A.x, ny = B.y - A.y;
        const d = Math.hypot(nx, ny) || 1e-9; nx /= d; ny /= d;
        const vr = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
        const j = vr * Math.min(1, DAMP * h) / wsum;
        A.vx += A.w * j * nx; A.vy += A.w * j * ny;
        B.vx -= B.w * j * nx; B.vy -= B.w * j * ny;
      }
      for (const L of this.loads) {
        if (L.state !== 'rolling') continue;
        for (const i of L.ids) {
          const p = ps[i];
          if (!p.contact) continue;
          const vt = p.vx * p.tx + p.vy * p.ty;
          const dv = (L.def.speed - vt) * Math.min(1, 9 * h);
          p.vx += p.tx * dv; p.vy += p.ty * dv;
        }
      }
      for (const c of cs) {
        if (c.broken || !c.mat || c.debris) { c.lambda = 0; continue; }
        const f = -c.lambda / (h * h);    // + tension, − compression
        c.f += (f - c.f) * k;
        c.lambda = 0;
      }
      this.checkBreaks();
    }
  }

  wheelOnSeg(p, c) {
    const A = this.ps[c.a], B = this.ps[c.b];
    const ex = B.x - A.x, ey = B.y - A.y, ll = ex * ex + ey * ey;
    if (ll < 1e-9) return;
    let t = ((p.x - A.x) * ex + (p.y - A.y) * ey) / ll;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = A.x + ex * t, qy = A.y + ey * t;
    let dx = p.x - qx, dy = p.y - qy;
    const d = Math.hypot(dx, dy), th = 0.08, rr = p.r + th;
    if (d >= rr) return;
    // the deck's upward normal; wheels only ride on top of the sheet
    const len = Math.sqrt(ll);
    let nx = -ey / len, ny = ex / len;
    if (ny < 0) { nx = -nx; ny = -ny; }
    if (dx * nx + dy * ny < -0.15 * p.r) return;
    if (d < 1e-6) { dx = nx; dy = ny; } else { dx /= d; dy /= d; }
    const C = d - rr;
    const wa = A.w * (1 - t) * (1 - t), wb = B.w * t * t;
    const wsum = p.w + wa + wb;
    const dl = -C / wsum;
    p.x += p.w * dl * dx; p.y += p.w * dl * dy;
    A.x -= A.w * (1 - t) * dl * dx; A.y -= A.w * (1 - t) * dl * dy;
    B.x -= B.w * t * dl * dx; B.y -= B.w * t * dl * dy;
    let tx = ex / len, ty = ey / len;
    if (tx < 0) { tx = -tx; ty = -ty; }
    p.contact = 1; p.tx = tx; p.ty = ty;
  }

  circleBox(p, b) {
    const cx = Math.max(b.x, Math.min(p.x, b.x + b.w)), cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
    let dx = p.x - cx, dy = p.y - cy;
    const d = Math.hypot(dx, dy);
    if (d > 1e-6) {
      if (d >= p.r) return;
      dx /= d; dy /= d;
      p.x = cx + dx * p.r; p.y = cy + dy * p.r;
      if (dy > 0.5) { p.contact = 1; p.tx = 1; p.ty = 0; }
      return;
    }
    // centre inside the box: push out the nearest face
    const l = p.x - b.x, r = b.x + b.w - p.x, bo = p.y - b.y, tp = b.y + b.h - p.y;
    const m = Math.min(l, r, bo, tp);
    if (m === tp) { p.y = b.y + b.h + p.r; p.contact = 1; p.tx = 1; p.ty = 0; }
    else if (m === l) p.x = b.x - p.r;
    else if (m === r) p.x = b.x + b.w + p.r;
    else p.y = b.y - p.r;
  }

  pointBox(p, b) {
    if (p.x <= b.x || p.x >= b.x + b.w || p.y <= b.y || p.y >= b.y + b.h) return;
    const l = p.x - b.x, r = b.x + b.w - p.x, bo = p.y - b.y, tp = b.y + b.h - p.y;
    const m = Math.min(l, r, bo, tp);
    if (m === tp) { p.y = b.y + b.h; p.x = p.px + (p.x - p.px) * 0.5; }
    else if (m === l) p.x = b.x;
    else if (m === r) p.x = b.x + b.w;
    else p.y = b.y;
  }

  checkBreaks() {
    if (this.unbreakable) return;
    for (const c of this.cs) {
      if (c.broken || c.debris || !c.mat) continue;
      const T = c.mat.T, Cl = compLimit(c.mat, c.L);
      if (c.f > T || -c.f > Cl) this.snap(c, c.f > 0 ? 'tension' : 'compression');
    }
  }

  stress(c) {
    if (!c.mat || c.debris || c.broken) return 0;
    return c.f > 0 ? c.f / c.mat.T : -c.f / compLimit(c.mat, c.L);
  }

  // a member snaps: it becomes two dangling halves, each hung from one end
  snap(c, mode) {
    c.broken = true;
    this.breaks++;
    if (!this.firstBreak) this.firstBreak = { mat: c.mat.key, mode, t: this.t };
    const A = this.ps[c.a], B = this.ps[c.b];
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const ang = Math.atan2(B.y - A.y, B.x - A.x);
    const half = c.L / 2, hm = c.mat.mass * half / 2;
    const mk = (src, sgn) => {
      const p = { x: mx - sgn * Math.cos(ang) * 0.06, y: my - sgn * Math.sin(ang) * 0.06, vx: src.vx * 0.5, vy: src.vy * 0.5, m: hm, w: 1 / Math.max(0.02, hm), r: 0, fixed: false };
      p.px = p.x; p.py = p.y;
      this.ps.push(p);
      return this.ps.length - 1;
    };
    const ma = mk(A, 1), mb = mk(B, -1);
    this.cs.push({ a: c.a, b: ma, L: half - 0.06, mat: c.mat, lambda: 0, f: 0, broken: false, debris: true, jag: 'b' });
    this.cs.push({ a: mb, b: c.b, L: half - 0.06, mat: c.mat, lambda: 0, f: 0, broken: false, debris: true, jag: 'a' });
    this.events.push({ type: 'snap', x: mx, y: my, mat: c.mat.key, mode });
  }

  checkLoads() {
    const lv = this.level;
    for (const L of this.loads) {
      if (L.state !== 'rolling') continue;
      const xs = L.ids.map(i => this.ps[i].x), ys = L.ids.map(i => this.ps[i].y);
      const x = Math.min(...xs), y = Math.min(...ys);
      if (x > lv.finish) {
        L.state = 'done';
        this.events.push({ type: 'finish', load: L });
        this.nextLoadAt = this.t + 0.5;
        // it rolls off stage: freeze it out of the way
        for (const i of L.ids) { const p = this.ps[i]; p.w = 0; p.gone = true; }
        if (!this.queue.length) { this.result = 'pass'; this.events.push({ type: 'pass' }); }
        continue;
      }
      if (y < lv.fallY) { this.fail(L, 'fell'); continue; }
      const mx = Math.max(...xs);
      if (mx > L.best + 0.05) { L.best = mx; L.bestT = this.t; }
      else if (this.t - L.bestT > 4) this.fail(L, 'stuck');
    }
  }

  fail(L, why) {
    L.state = why;
    this.result = 'fail';
    this.failWhy = why;
    this.failLoad = L;
    this.events.push({ type: 'fail', load: L, why });
  }

  loadPose(L) {
    const ps = L.ids.map(i => this.ps[i]);
    const a = ps[0], b = ps[ps.length - 1];
    const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
    const ang = ps.length > 1 ? Math.atan2(b.y - a.y, b.x - a.x) : 0;
    return { x, y, ang, ps };
  }
}
