// Tiny circle physics: balls against each other and against line segments. Enough for gumballs
// rattling into a tray: impulses with restitution and friction, sub-stepped, plus per-ball gravity
// (balloons float) and a pull hook (magnets). Pure JS so the balance sim can run it in Node.

export class World {
  constructor(opts = {}) {
    this.balls = [];
    this.segs = [];
    this.g = opts.g ?? 1500;
    this.sub = opts.sub ?? 6;
    this.iters = opts.iters ?? 3;
    this.onHit = null;          // (a, b|null, dv) for sounds and bounce counting
    this.force = null;          // (ball, dt) extra forces, e.g. magnets
    this.time = 0;
    this.ballMu = opts.ballMu ?? 0.05;   // balls roll over each other; no rotation, so keep this low or they stack like glue
  }

  addSeg(x1, y1, x2, y2) { const s = { x1, y1, x2, y2, on: true }; this.segs.push(s); return s; }

  add(b) {
    const ball = Object.assign({ vx: 0, vy: 0, r: 20, m: 1, e: 0.25, mu: 0.25, gs: 1, ghost: false }, b);
    this.balls.push(ball);
    return ball;
  }

  remove(b) { const i = this.balls.indexOf(b); if (i >= 0) this.balls.splice(i, 1); }

  step(dt) {
    const h = dt / this.sub;
    for (let s = 0; s < this.sub; s++) this.substep(h);
    this.time += dt;
  }

  substep(h) {
    const B = this.balls;
    for (const b of B) {
      if (b.ghost) continue;
      b.vy += this.g * b.gs * h;
      if (this.force) this.force(b, h);
      // a little air drag, plus extra drag when nearly still so piles settle instead of creeping
      const sp = Math.hypot(b.vx, b.vy);
      const drag = sp < 12 ? 3 : 0.4;
      const k = Math.max(0, 1 - drag * h);
      b.vx *= k; b.vy *= k;
      b.x += b.vx * h; b.y += b.vy * h;
    }
    for (let it = 0; it < this.iters; it++) {
      const last = it === this.iters - 1;
      for (let i = 0; i < B.length; i++) {
        const a = B[i];
        if (a.ghost) continue;
        for (let j = i + 1; j < B.length; j++) {
          const b = B[j];
          if (b.ghost) continue;
          const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr || d2 === 0) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = rr - d;
          const ia = 1 / a.m, ib = 1 / b.m, is = ia + ib;
          const corr = pen * 0.8 / is;
          a.x -= nx * corr * ia; a.y -= ny * corr * ia;
          b.x += nx * corr * ib; b.y += ny * corr * ib;
          const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
          const vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            const e = it === 0 ? Math.max(a.e, b.e) : 0;
            const jn = -(1 + e) * vn / is;
            a.vx -= jn * nx * ia; a.vy -= jn * ny * ia;
            b.vx += jn * nx * ib; b.vy += jn * ny * ib;
            const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
            let jt = -vt / is; const mu = this.ballMu * jn;
            if (jt > mu) jt = mu; else if (jt < -mu) jt = -mu;
            a.vx -= jt * tx * ia; a.vy -= jt * ty * ia;
            b.vx += jt * tx * ib; b.vy += jt * ty * ib;
            if (it === 0 && this.onHit && -vn > 60) this.onHit(a, b, -vn);
          }
          if (last) { /* nothing */ }
        }
        for (const s of this.segs) if (s.on) this.hitSeg(a, s, it === 0);
      }
    }
  }

  hitSeg(b, s, first) {
    const ex = s.x2 - s.x1, ey = s.y2 - s.y1;
    const L2 = ex * ex + ey * ey;
    let t = ((b.x - s.x1) * ex + (b.y - s.y1) * ey) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = s.x1 + ex * t, py = s.y1 + ey * t;
    const dx = b.x - px, dy = b.y - py, d2 = dx * dx + dy * dy;
    if (d2 >= b.r * b.r) return;
    const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
    const pen = b.r - d;
    b.x += nx * pen; b.y += ny * pen;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      const e = first ? b.e : 0;
      b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
      const tx = -ny, ty = nx, vt = b.vx * tx + b.vy * ty;
      let jt = -vt; const mu = b.mu * (1 + e) * -vn;
      if (jt > mu) jt = mu; else if (jt < -mu) jt = -mu;
      b.vx += jt * tx; b.vy += jt * ty;
      if (first && this.onHit && -vn > 60) this.onHit(b, null, -vn);
    }
  }

  maxSpeed() {
    let m = 0;
    for (const b of this.balls) if (!b.ghost) m = Math.max(m, Math.hypot(b.vx, b.vy));
    return m;
  }
}

// a circle made of segments, facing inward (for the glass globe)
export function ring(world, cx, cy, r, n = 28, gapFrom = null, gapTo = null) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    world.addSeg(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
  }
}
