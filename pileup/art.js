// Everything is cut from lino: cream paper, a pale tint block, Prussian blue, black and vermilion.
// Shapes are flat; texture comes from gouge strokes and a speckled pass of paper over the ink.
import { GOAL, ICE, SEALS, WATER_Y, X0, DX, NS, rampGeom, rampPoint, GEAR } from './sim.js';

export const INK = { paper: '#efe5cf', tint: '#b8cad3', blue: '#24395c', black: '#17171c', red: '#d6452a', deep: '#1a2a45' };
export const PSZ = 2.2;   // penguins are drawn this many metres long
const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function grainCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  // specks of paper where the roller missed: they only show up on ink
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = Math.random() < 0.85 ? 0.6 + Math.random() * 0.7 : 1.2 + Math.random() * 1.6;
    g.fillStyle = `rgba(239,229,207,${0.25 + Math.random() * 0.55})`;
    g.beginPath(); g.ellipse(x, y, r * (1 + Math.random()), r, Math.random() * 3, 0, 7); g.fill();
  }
  // a few thin scratches along the grain
  g.strokeStyle = 'rgba(239,229,207,.35)'; g.lineWidth = 0.7;
  for (let i = 0; i < 40; i++) { const x = Math.random() * 256, y = Math.random() * 256, l = 4 + Math.random() * 14; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (Math.random() - 0.5) * 2); g.stroke(); }
  return c;
}
function fibreCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    g.fillStyle = `rgba(120,95,60,${Math.random() * 0.06})`;
    g.fillRect(x, y, 1 + Math.random() * 3, 1);
  }
  return c;
}

export class Painter {
  constructor(cv) {
    this.cv = cv; this.g = cv.getContext('2d');
    this.grain = this.g.createPattern(grainCanvas(), 'repeat');
    this.fibre = this.g.createPattern(fibreCanvas(), 'repeat');
    this.W = 0; this.H = 0; this.dpr = 1;
    this.cam = { x: 0, y: 0, s: 10 };
  }
  resize(w, h, dpr) { this.W = w; this.H = h; this.dpr = dpr; this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr); }
  sx(x) { return this.W / 2 + (x - this.cam.x) * this.cam.s; }
  sy(y) { return this.H / 2 - (y - this.cam.y) * this.cam.s; }
  wx(sx) { return this.cam.x + (sx - this.W / 2) / this.cam.s; }

  frame(game, run, fx, time) {
    const g = this.g, { W, H } = this, c = this.cam, w = game.world;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = INK.paper; g.fillRect(0, 0, W, H);
    this.sky(time);
    this.mountains();
    this.hills();
    this.ground(w, time);
    this.ramp(run ? run.ramp : GEAR.ramp[game.tiers.ramp], run);
    this.posts(game);
    this.seals(w, time);
    this.wrecks(w, time);
    if (run) this.debris(run);
    if (fx) this.particles(fx, 'back');
    if (run && run.state !== 'done') this.player(run, time);
    if (fx) this.particles(fx, 'front');
    this.sea(time);
    // the print itself: paper specks over the ink, a little fibre over everything
    g.fillStyle = this.grain; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = this.fibre; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
    void c;
  }

  // ------------------------------------------------------------- backdrop
  sky(time) {
    const g = this.g, { W, H } = this, c = this.cam;
    // a big carved sun, fixed to the paper
    const sx = W * 0.8, sy = H * 0.2 + Math.min(H * 0.1, Math.max(0, c.y) * 0.01), r = Math.min(W, H) * 0.09;
    g.fillStyle = INK.red; g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fill();
    g.strokeStyle = INK.paper; g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      g.lineWidth = 2.2 - i * 0.3;
      g.beginPath(); g.arc(sx, sy, r * (0.35 + i * 0.17), 3.6 + i * 0.4, 5.2 + i * 0.2); g.stroke();
    }
    // horizontal gouges in the tint block, thickest near the horizon
    const par = c.x * c.s * 0.02;
    g.strokeStyle = INK.tint; g.lineCap = 'round';
    const rows = 22;
    for (let i = 0; i < rows; i++) {
      const y = H * (0.06 + i * 0.033) + ((c.y * c.s * 0.015) % (H * 0.033));
      const t = i / rows;
      g.lineWidth = 1 + t * 3.2;
      for (let k = -1; k < 6; k++) {
        const seed = i * 31 + k;
        const x0 = ((k * W / 4 + hash(seed) * W * 0.3 - par * (0.6 + t)) % (W * 1.75) + W * 1.75) % (W * 1.75) - W * 0.4;
        const len = W * (0.06 + hash(seed + 7) * 0.22) * (0.4 + t);
        if (Math.abs(y - sy) < r + 6 && x0 < sx + r && x0 + len > sx - r) continue;
        g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + len, y + (hash(seed + 3) - 0.5) * 2); g.stroke();
      }
    }
  }
  ridge(par, base, amp, seed, wl) {
    // a mountain line in screen space, anchored to the world with parallax
    const { W } = this, c = this.cam;
    const pts = [];
    const off = c.x * par * c.s;
    for (let x = -20; x <= W + 20; x += 8) {
      const u = (x + off) / wl;
      const y = base - amp * (0.55 * Math.abs(Math.sin(u * 1.3 + seed)) + 0.3 * Math.sin(u * 3.1 + seed * 2) ** 2 + 0.15 * Math.sin(u * 7.7 + seed));
      pts.push([x, y]);
    }
    return pts;
  }
  mountains() {
    const g = this.g, { W, H } = this, c = this.cam;
    const base = H * 0.66 + Math.min(H * 0.5, Math.max(0, c.y + 20) * c.s * 0.05);
    const pts = this.ridge(0.05, base, H * 0.2, 1.7, 240);
    g.fillStyle = INK.tint; g.beginPath(); g.moveTo(-20, H + 10);
    for (const [x, y] of pts) g.lineTo(x, y);
    g.lineTo(W + 20, H + 10); g.closePath(); g.fill();
    // snow caps: paper carved down from each ridge line
    g.strokeStyle = INK.paper; g.lineCap = 'round';
    for (let i = 1; i < pts.length - 1; i += 2) {
      const [x, y] = pts[i];
      const k = Math.floor((x + c.x * 0.05 * c.s) / 16);
      const len = 6 + hash(k) * 22;
      g.lineWidth = 1.6 + hash(k + 1) * 1.8;
      g.beginPath(); g.moveTo(x, y + 3); g.lineTo(x + (hash(k + 2) - 0.5) * 6, y + 3 + len); g.stroke();
    }
    g.strokeStyle = INK.blue; g.lineWidth = 2; g.lineJoin = 'round';
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  }
  hills() {
    const g = this.g, { W, H } = this, c = this.cam;
    const base = H * 0.82 + Math.min(H * 0.6, Math.max(0, c.y + 20) * c.s * 0.16);
    const pts = this.ridge(0.18, base, H * 0.12, 4.2, 150);
    g.fillStyle = INK.paper; g.beginPath(); g.moveTo(-20, H + 10);
    for (const [x, y] of pts) g.lineTo(x, y);
    g.lineTo(W + 20, H + 10); g.closePath(); g.fill();
    g.strokeStyle = INK.blue; g.lineWidth = 2.4; g.lineJoin = 'round';
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    // hatching on the shady side, and fir trees
    g.lineWidth = 1.3; g.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const [x, y] = pts[i], [px, py] = pts[i - 1];
      if (y - py < 1.2) continue;
      const k = Math.floor((x + c.x * 0.18 * c.s) / 8);
      g.beginPath(); g.moveTo(x, y + 5); g.lineTo(x - 4, y + 12 + hash(k) * 16); g.stroke();
    }
    g.fillStyle = INK.blue;
    for (let i = 0; i < pts.length; i += 3) {
      const [x, y] = pts[i]; const k = Math.floor((x + c.x * 0.18 * c.s) / 24);
      if (hash(k * 3) > 0.3) continue;
      const h = 10 + hash(k) * 14;
      g.beginPath(); g.moveTo(x - h * 0.28, y + 3); g.lineTo(x, y - h); g.lineTo(x + h * 0.28, y + 3); g.fill();
    }
  }

  // ------------------------------------------------------------- the ground
  ground(w, time) {
    const g = this.g, { W, H } = this, c = this.cam;
    const step = 3;
    const pts = [];
    for (let sx = -step; sx <= W + step; sx += step) {
      const x = this.wx(sx);
      pts.push([sx, this.sy(w.at(x)), x]);
    }
    // the ground is uncut paper, outlined in blue
    g.fillStyle = INK.paper; g.beginPath(); g.moveTo(-step, H + 10);
    for (const [x, y] of pts) g.lineTo(x, y);
    g.lineTo(W + step, H + 10); g.closePath(); g.fill();
    // ice shelf: the tint block, ruled with cracks
    const ix0 = this.sx(ICE[0]), ix1 = this.sx(ICE[1]);
    if (ix1 > 0 && ix0 < W) {
      g.save(); g.beginPath(); g.moveTo(-step, H + 10);
      for (const [x, y] of pts) g.lineTo(x, y);
      g.lineTo(W + step, H + 10); g.closePath(); g.clip();
      g.fillStyle = INK.tint; g.fillRect(Math.max(0, ix0), 0, Math.min(W, ix1) - Math.max(0, ix0), H);
      g.restore();
    }
    // crevasses: black cuts
    for (const k of w.cracks) {
      const x0 = this.sx(k.x - k.w / 2 - 0.5), x1 = this.sx(k.x + k.w / 2 + 0.5);
      if (x1 < -10 || x0 > W + 10) continue;
      const top = this.sy(k.top), floor = this.sy(k.top - k.d + k.fill), bottom = this.sy(k.top - k.d);
      if (k.fill < k.d) {
        g.fillStyle = INK.black; g.beginPath();
        const n = 16;
        for (let i = 0; i <= n; i++) { const xx = k.x - k.w / 2 + (k.w * i) / n; g.lineTo(this.sx(xx), Math.min(this.sy(k.top - 0.05), this.sy(w.at(xx)))); }
        g.lineTo(this.sx(k.x + k.w / 2), bottom); g.lineTo(this.sx(k.x - k.w / 2), bottom);
        g.closePath(); g.fill();
        // wedge of ice either side
        g.strokeStyle = INK.paper; g.lineWidth = Math.max(1, c.s * 0.12);
        for (let j = 0; j < 4; j++) {
          const yy = top + (floor - top) * (j + 0.5) / 4;
          g.beginPath(); g.moveTo(x0 + 2, yy); g.lineTo(x0 + (x1 - x0) * 0.14, yy + 4); g.stroke();
          g.beginPath(); g.moveTo(x1 - 2, yy - 3); g.lineTo(x1 - (x1 - x0) * 0.14, yy + 2); g.stroke();
        }
      }
      for (const p of k.stack) p.k === 'penguin' ? this.penguinWreck(p, time, true) : p.k === 'rocket' ? this.rocketWreck(p) : this.gliderWreck({ ...p, a: 0 });
    }
    // gouge strokes under the surface, anchored to the world
    const lod = Math.max(0.5, 2 ** Math.ceil(Math.log2(14 / c.s)));
    const xa = Math.floor(this.wx(-20) / lod), xb = Math.ceil(this.wx(W + 20) / lod);
    g.lineCap = 'round';
    for (let i = xa; i <= xb; i++) {
      const hv = hash(i * 1.37 + lod);
      const x = (i + hv * 0.6) * lod;
      if (x < 0 && x > -200) continue;
      const surf = this.sy(w.at(x));
      const sx = this.sx(x);
      const icy = x > ICE[0] && x < ICE[1];
      const sl = w.slope(x);
      for (let row = 0; row < 3; row++) {
        const hr = hash(i * 7.1 + row * 13 + lod);
        if (hr < 0.35) continue;
        const depth = [9, 20, 36][row] + hr * 6;
        const len = (10 + hr * 22) * (row === 2 ? 1.6 : 1);
        g.strokeStyle = icy ? INK.blue : (row === 2 ? INK.tint : INK.blue);
        g.lineWidth = (row === 0 ? 2.2 : 1.6) * (0.6 + hr * 0.6);
        const dy = sl * len * 0.5;
        g.beginPath(); g.moveTo(sx - len / 2, surf + depth + dy); g.lineTo(sx + len / 2, surf + depth - dy); g.stroke();
      }
    }
    // the surface line, thick and slightly uneven
    g.strokeStyle = INK.blue; g.lineJoin = 'round';
    g.lineWidth = 3.4; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    // wreck heaps get a black outline where they sit proud of the snow
    g.strokeStyle = INK.black; g.lineWidth = 2.2;
    g.beginPath();
    let on = false;
    for (const [x, y, wxp] of pts) {
      const raised = w.extra[Math.max(0, Math.min(NS - 1, Math.round((wxp - X0) / DX)))] > 0.06;
      if (raised) { if (!on) g.moveTo(x, y); else g.lineTo(x, y); on = true; } else on = false;
    }
    g.stroke();
  }

  ramp(rt, run) {
    const g = this.g, c = this.cam;
    const gm = rampGeom(rt);
    if (this.sx(2) < -50 || this.sx(gm.p0[0] - 4) > this.W + 50) return;
    const s = c.s;
    // trestle legs
    g.strokeStyle = INK.black; g.lineCap = 'butt';
    g.lineWidth = Math.max(1.5, s * 0.3);
    const n = Math.max(3, Math.round(gm.L / 3.2));
    const tops = [];
    for (let i = 0; i <= n; i++) { const [x, y] = rampPoint(gm, i / n); tops.push([x, y]); }
    g.beginPath();
    for (const [x, y] of tops) { g.moveTo(this.sx(x), this.sy(y)); g.lineTo(this.sx(x), this.sy(0)); }
    g.stroke();
    g.lineWidth = Math.max(1, s * 0.16);
    g.beginPath();
    for (let i = 0; i < tops.length - 1; i++) {
      const [x0, y0] = tops[i], [x1] = tops[i + 1];
      const yb = Math.min(y0, tops[i + 1][1]);
      for (let f = 0.25; f < 1 && yb * f > 1; f += 0.3) {
        g.moveTo(this.sx(x0), this.sy(yb * f)); g.lineTo(this.sx(x1), this.sy(yb * (f + 0.25)));
      }
    }
    g.stroke();
    // the slide itself
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = INK.black; g.lineWidth = Math.max(3, s * 0.7);
    g.beginPath(); tops.forEach(([x, y], i) => { const [px, py] = [this.sx(x), this.sy(y)]; i ? g.lineTo(px, py) : g.moveTo(px, py); });
    for (let i = 0; i <= 24; i++) { const [x, y] = rampPoint(gm, i / 24); g.lineTo(this.sx(x), this.sy(y)); }
    g.stroke();
    g.strokeStyle = INK.paper; g.lineWidth = Math.max(1, s * 0.18);
    g.beginPath();
    for (let i = 0; i <= 24; i++) { const [x, y] = rampPoint(gm, i / 24); const px = this.sx(x), py = this.sy(y) - Math.max(1, s * 0.15); i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
    // a starting hut and a pennant at the top
    const [tx, ty] = gm.p0;
    const hx = this.sx(tx - 1.2), hy = this.sy(ty);
    const hs = Math.max(8, s * 2.4);
    g.fillStyle = INK.black; g.fillRect(hx - hs, hy - hs * 0.2, hs * 1.3, hs * 0.2);
    g.beginPath(); g.moveTo(hx - hs * 0.8, hy); g.lineTo(hx - hs * 0.8, hy - hs * 1.6); g.stroke();
    g.fillStyle = INK.red; g.beginPath(); g.moveTo(hx - hs * 0.8, hy - hs * 1.6); g.lineTo(hx + hs * 0.2, hy - hs * 1.35 + Math.sin(performance.now() / 300) * 2); g.lineTo(hx - hs * 0.8, hy - hs * 1.1); g.fill();
    void run;
  }

  posts(game) {
    const g = this.g, c = this.cam;
    // distance posts: every 100 m up close, every km far out
    const every = c.s > 4 ? 100 : c.s > 0.4 ? 1000 : 5000;
    const a = Math.max(1, Math.ceil(this.wx(-40) / every)), b = Math.floor(this.wx(this.W + 40) / every);
    const w = game.world;
    g.textAlign = 'center';
    for (let i = a; i <= b; i++) {
      const x = i * every; if (x >= GOAL) continue;
      const px = this.sx(x), py = this.sy(w.at(x));
      const h = Math.max(22, c.s * 2.2);
      g.strokeStyle = INK.black; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(px, py); g.lineTo(px, py - h); g.stroke();
      const label = x >= 1000 ? (x / 1000) + ' km' : x + ' m';
      g.font = `14px 'Holtwood One SC', serif`;
      const tw = g.measureText(label).width + 10;
      g.fillStyle = INK.black; g.fillRect(px - tw / 2, py - h - 18, tw, 18);
      g.fillStyle = INK.paper; g.fillText(label, px, py - h - 4);
    }
    // the record flag
    if (game.best > 0 && game.best < GOAL) {
      const x = game.best, px = this.sx(x), py = this.sy(w.at(x));
      if (px > -40 && px < this.W + 40) {
        const h = Math.max(30, c.s * 3);
        g.strokeStyle = INK.black; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px, py - h); g.stroke();
        g.fillStyle = INK.red; g.beginPath(); g.moveTo(px, py - h); g.lineTo(px + 26, py - h + 7); g.lineTo(px, py - h + 14); g.fill();
        g.font = `11px 'Holtwood One SC', serif`; g.textAlign = 'left'; g.fillStyle = INK.black;
        g.fillText('BEST', px + 4, py - h - 4);
        g.textAlign = 'center';
      }
    }
  }

  seals(w, time) {
    if (this.sx(SEALS[1] + 10) < -50 || this.sx(SEALS[0] - 10) > this.W + 50) return;
    for (const s of w.seals) {
      const px = this.sx(s.x); if (px < -60 || px > this.W + 60) continue;
      s.hit = Math.max(0, s.hit - 0.02);
      this.seal(px, this.sy(s.y - 0.15), Math.max(this.cam.s * 1.3, 6), s, time);
    }
  }
  seal(px, py, s, se, time) {
    const g = this.g;
    const squash = 1 - se.hit * 0.35, breath = 1 + Math.sin(time * 1.6 + se.ph) * 0.03;
    g.save(); g.translate(px, py + 0.55 * s); g.scale(se.flip ? -1 : 1, 1);
    g.scale(1 / squash ** 0.5, squash * breath);
    g.fillStyle = INK.black;
    g.beginPath(); g.ellipse(0, -0.55 * s, 1.15 * s, 0.6 * s, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(0.95 * s, -0.95 * s, 0.42 * s, 0.38 * s, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-1.0 * s, -0.4 * s); g.lineTo(-1.7 * s, -0.75 * s); g.lineTo(-1.6 * s, -0.1 * s); g.fill();
    // carved highlights: a back line, an eye, whiskers
    g.strokeStyle = INK.paper; g.lineCap = 'round'; g.lineWidth = Math.max(1, s * 0.08);
    g.beginPath(); g.arc(0, -0.45 * s, 0.75 * s, 3.6, 4.9); g.stroke();
    g.fillStyle = INK.paper; g.beginPath(); g.arc(1.05 * s, -1.05 * s, Math.max(1, s * 0.07), 0, 7); g.fill();
    g.beginPath(); g.moveTo(1.3 * s, -0.9 * s); g.lineTo(1.6 * s, -0.95 * s); g.moveTo(1.3 * s, -0.85 * s); g.lineTo(1.6 * s, -0.78 * s); g.stroke();
    g.restore();
  }

  wrecks(w, time) {
    const xa = this.wx(-60), xb = this.wx(this.W + 60);
    for (const wr of w.wrecks) {
      if (wr.c != null || wr.x < xa || wr.x > xb) continue;
      if (wr.k === 'penguin') this.penguinWreck(wr, time, false);
      else if (wr.k === 'glider') this.gliderWreck(wr);
      else this.rocketWreck(wr);
    }
  }
  penguinWreck(wr, time, inCrack) {
    const s = Math.max(this.cam.s * PSZ, 6);
    const px = this.sx(wr.x), py = this.sy(wr.y);
    if (px < -60 || px > this.W + 60) return;
    const g = this.g;
    g.save(); g.translate(px, py); g.rotate(-(wr.a || 0) + (inCrack ? (hash(wr.d || 1) - 0.5) * 0.6 : 0));
    if (wr.wings) this.wingShape(wr.wings, s, true);
    this.penguinBody(s, { lying: true, sleepy: true, t: time + (wr.d || 0) });
    if (wr.rocket) this.rocketShape(wr.rocket, s, false, time);
    g.restore();
  }
  gliderWreck(wr) {
    const g = this.g, s = Math.max(this.cam.s, 4);
    const len = 4.2, h = 1.35, ta = Math.tan(Math.max(-0.45, Math.min(0.45, wr.a || 0)));
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = -1 + (2 * i) / 12, x = wr.x + t * len;
      const add = t < 0.75 ? h * Math.max(0, (t + 1) / 1.75) ** 1.6 : h * (1 - (t - 0.75) / 0.25);
      pts.push([this.sx(x), this.sy(wr.y + (t * len) * ta + add)]);
    }
    g.fillStyle = INK.red; g.strokeStyle = INK.black; g.lineWidth = Math.max(1.5, s * 0.12);
    g.beginPath(); g.moveTo(pts[0][0], this.sy(wr.y - len * ta));
    for (const [x, y] of pts) g.lineTo(x, y);
    g.lineTo(pts[pts.length - 1][0], this.sy(wr.y + len * ta)); g.closePath(); g.fill(); g.stroke();
    // snapped struts poking out
    g.beginPath();
    g.moveTo(pts[3][0], pts[3][1]); g.lineTo(pts[3][0] - s * 0.6, pts[3][1] - s * 1.1);
    g.moveTo(pts[9][0], pts[9][1]); g.lineTo(pts[9][0] + s * 0.4, pts[9][1] - s * 0.9);
    g.moveTo(pts[6][0], pts[6][1] + s * 0.3); g.lineTo(pts[10][0], pts[10][1] + s * 0.2);
    g.stroke();
  }
  rocketWreck(wr) {
    const g = this.g, s = Math.max(this.cam.s * 2, 5);
    g.save(); g.translate(this.sx(wr.x), this.sy(wr.y)); g.rotate(-(wr.a || 0) + (hash(wr.x) - 0.5) * 0.3);
    g.translate(0, -0.25 * s);
    this.tube(s * 1.7, s * 0.5);
    g.restore();
  }
  tube(len, d) {
    const g = this.g;
    g.fillStyle = INK.red; g.strokeStyle = INK.black; g.lineWidth = Math.max(1, d * 0.14);
    g.beginPath(); g.rect(-len / 2, -d / 2, len * 0.82, d); g.fill(); g.stroke();
    g.fillStyle = INK.black;
    g.beginPath(); g.moveTo(len * 0.32, -d / 2); g.lineTo(len / 2 + d * 0.3, 0); g.lineTo(len * 0.32, d / 2); g.fill();
    g.fillRect(-len * 0.2, -d / 2, d * 0.28, d); g.fillRect(len * 0.05, -d / 2, d * 0.28, d);
    g.beginPath(); g.moveTo(-len / 2, -d / 2); g.lineTo(-len / 2 - d * 0.5, -d); g.lineTo(-len / 2 + d * 0.4, -d / 2); g.fill();
  }

  debris(run) {
    const g = this.g, s = Math.max(this.cam.s * PSZ, 8);
    for (const d of run.debris) {
      if (d.done) continue;
      g.save(); g.translate(this.sx(d.x), this.sy(d.y)); g.rotate(-d.a);
      if (d.k === 'rocket') this.tube(s * 1.7, s * 0.5);
      else this.wingShape(run.t.wings, s, true);
      g.restore();
    }
  }

  // ------------------------------------------------------------- the penguin
  player(run, time) {
    const g = this.g;
    const s = Math.max(this.cam.s * PSZ, 30);
    const px = this.sx(run.x), py = this.sy(run.y);
    g.save(); g.translate(px, py); g.rotate(-run.p);
    g.translate(0, -0.26 * s);
    const flying = run.state === 'fly' && !run.ground;
    if (run.hasWings) this.wingShape(run.t.wings, s, false, time, run.stall);
    this.penguinBody(s, { lying: run.state !== 'ready', flap: flying && !run.hasWings, t: time, scared: flying && run.vy < -14 && run.alt < 25, ready: run.state === 'ready' });
    if (run.hasRocket) this.rocketShape(run.t.rocket, s, run.boosting, time);
    g.restore();
    // when the penguin is drawn bigger than life, give it a little marker so it stays readable
    if (this.cam.s * PSZ < 18 && run.state === 'fly') {
      g.strokeStyle = INK.red; g.lineWidth = 2;
      g.beginPath(); g.arc(px, py - 0.3 * s, s * 0.95, 0, 7); g.stroke();
    }
  }
  // a belly-sliding penguin, length about 1 m, origin at the belly, beak to +x
  penguinBody(s, o) {
    const g = this.g;
    const L = s, Hh = s * 0.42;
    if (o.ready) {
      // sitting up on the sled at the top, waiting
      g.save(); g.rotate(-0.9);
    }
    // feet
    g.fillStyle = INK.red;
    g.beginPath(); g.ellipse(-0.52 * L, 0.02 * L, 0.13 * L, 0.06 * L, -0.3, 0, 7); g.fill();
    // body: black back, paper belly
    g.fillStyle = INK.black;
    g.beginPath(); g.ellipse(0, -Hh * 0.5, 0.52 * L, Hh * 0.55, 0, 0, 7); g.fill();
    g.fillStyle = INK.paper;
    g.beginPath(); g.ellipse(0.02 * L, -Hh * 0.18, 0.42 * L, Hh * 0.26, 0, 0, 7); g.fill();
    // head
    g.fillStyle = INK.black;
    g.beginPath(); g.ellipse(0.5 * L, -Hh * 0.62, 0.2 * L, 0.18 * L, 0, 0, 7); g.fill();
    g.fillStyle = INK.red;
    g.beginPath(); g.moveTo(0.64 * L, -Hh * 0.72); g.lineTo(0.86 * L, -Hh * 0.58); g.lineTo(0.64 * L, -Hh * 0.48); g.fill();
    // eye
    g.strokeStyle = INK.paper; g.fillStyle = INK.paper; g.lineCap = 'round'; g.lineWidth = Math.max(1, L * 0.035);
    if (o.sleepy) { g.beginPath(); g.arc(0.53 * L, -Hh * 0.72, L * 0.05, 0.2, Math.PI - 0.2); g.stroke(); }
    else if (o.scared) { g.beginPath(); g.arc(0.53 * L, -Hh * 0.74, L * 0.06, 0, 7); g.fill(); g.fillStyle = INK.black; g.beginPath(); g.arc(0.55 * L, -Hh * 0.74, L * 0.025, 0, 7); g.fill(); }
    else { g.beginPath(); g.arc(0.55 * L, -Hh * 0.74, L * 0.04, 0, 7); g.fill(); }
    // carved feather lines on the back
    g.strokeStyle = INK.paper; g.lineWidth = Math.max(0.8, L * 0.022);
    g.beginPath(); g.arc(-0.05 * L, -Hh * 0.25, 0.4 * L, 3.7, 4.6); g.stroke();
    // flipper
    g.fillStyle = INK.black;
    const fl = o.flap ? Math.sin(o.t * 22) * 0.6 : 0.15;
    g.save(); g.translate(0.05 * L, -Hh * 0.75); g.rotate(-0.4 - fl);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-0.38 * L, -0.06 * L); g.lineTo(-0.05 * L, 0.08 * L); g.fill();
    g.restore();
    if (o.sleepy) {
      // a little "z" now and then
      const z = (o.t * 0.4) % 3;
      if (z < 1) {
        g.fillStyle = INK.blue; g.font = `${Math.max(9, L * 0.35)}px 'Holtwood One SC', serif`;
        g.fillText('z', 0.6 * L + z * 0.2 * L, -Hh - z * 0.5 * L);
      }
    }
    if (o.ready) g.restore();
  }
  wingShape(tier, s, broken, time = 0, stall = 0) {
    const g = this.g, L = s;
    const wob = stall ? Math.sin(time * 40) * 0.06 * stall : 0;
    g.save(); g.translate(0, -0.55 * L); g.rotate(wob + (broken ? 0.25 : 0));
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = INK.black; g.lineWidth = Math.max(1.2, L * 0.05);
    if (tier === 1) {
      // cardboard taped on: paper with ruled corrugation
      g.fillStyle = INK.paper;
      g.beginPath(); g.moveTo(-0.5 * L, -0.05 * L); g.lineTo(0.3 * L, -0.25 * L); g.lineTo(0.4 * L, -0.1 * L); g.lineTo(-0.45 * L, 0.08 * L); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = INK.blue; g.lineWidth = Math.max(0.8, L * 0.025);
      g.beginPath(); for (let i = 1; i < 5; i++) { const t = i / 5; g.moveTo(-0.5 * L + t * 0.85 * L, -0.05 * L - t * 0.2 * L); g.lineTo(-0.45 * L + t * 0.85 * L, 0.08 * L - t * 0.18 * L); } g.stroke();
      g.fillStyle = INK.red; g.fillRect(-0.1 * L, -0.12 * L, 0.12 * L, 0.18 * L);
    } else if (tier === 2) {
      // box kite: two red cells on sticks
      g.fillStyle = INK.red;
      g.fillRect(-0.55 * L, -0.55 * L, 0.35 * L, 0.3 * L); g.strokeRect(-0.55 * L, -0.55 * L, 0.35 * L, 0.3 * L);
      g.fillRect(0.1 * L, -0.55 * L, 0.35 * L, 0.3 * L); g.strokeRect(0.1 * L, -0.55 * L, 0.35 * L, 0.3 * L);
      g.beginPath(); g.moveTo(-0.6 * L, -0.4 * L); g.lineTo(0.5 * L, -0.4 * L); g.moveTo(0, -0.25 * L); g.lineTo(0, 0); g.stroke();
    } else if (tier === 3) {
      // hang glider: a red delta with a carved stripe
      g.fillStyle = INK.red;
      g.beginPath(); g.moveTo(0.55 * L, -0.55 * L); g.lineTo(-1.1 * L, -0.4 * L); g.lineTo(-0.7 * L, -0.25 * L); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = INK.paper; g.lineWidth = Math.max(1, L * 0.04);
      g.beginPath(); g.moveTo(0.35 * L, -0.5 * L); g.lineTo(-0.85 * L, -0.36 * L); g.stroke();
      g.strokeStyle = INK.black; g.lineWidth = Math.max(1, L * 0.04);
      g.beginPath(); g.moveTo(-0.1 * L, -0.45 * L); g.lineTo(-0.1 * L, 0); g.moveTo(-0.35 * L, -0.02 * L); g.lineTo(0.2 * L, -0.02 * L); g.stroke();
    } else if (tier >= 4) {
      // swept wing: a black jet-age dart with a red flash
      g.fillStyle = INK.black;
      g.beginPath(); g.moveTo(0.7 * L, -0.28 * L); g.lineTo(-0.9 * L, -0.5 * L); g.lineTo(-0.75 * L, -0.08 * L); g.closePath(); g.fill();
      g.fillStyle = INK.red;
      g.beginPath(); g.moveTo(0.3 * L, -0.3 * L); g.lineTo(-0.6 * L, -0.42 * L); g.lineTo(-0.55 * L, -0.33 * L); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-0.7 * L, -0.4 * L); g.lineTo(-0.95 * L, -0.85 * L); g.lineTo(-0.55 * L, -0.38 * L); g.fill();
    }
    g.restore();
  }
  rocketShape(tier, s, on, time) {
    const g = this.g, L = s;
    g.save(); g.translate(-0.15 * L, -0.5 * L);
    const len = (0.6 + tier * 0.12) * L, d = (0.16 + tier * 0.03) * L;
    if (on) {
      // flame: alternating red and paper tongues, flickering
      const fl = 0.8 + Math.sin(time * 50) * 0.25 + Math.sin(time * 31) * 0.15;
      g.fillStyle = INK.red;
      g.beginPath(); g.moveTo(-len / 2, -d * 0.8); g.lineTo(-len / 2 - L * 0.9 * fl * (0.7 + tier * 0.15), 0); g.lineTo(-len / 2, d * 0.8); g.fill();
      g.fillStyle = INK.paper;
      g.beginPath(); g.moveTo(-len / 2, -d * 0.4); g.lineTo(-len / 2 - L * 0.45 * fl * (0.7 + tier * 0.15), 0); g.lineTo(-len / 2, d * 0.4); g.fill();
    }
    if (tier >= 3) { g.save(); g.translate(0, -d * 0.6); this.tube(len, d); g.restore(); g.save(); g.translate(0, d * 0.6); this.tube(len, d); g.restore(); }
    else this.tube(len, d);
    g.restore();
  }

  particles(fx, layer) {
    const g = this.g;
    for (const p of fx) {
      if ((p.layer || 'front') !== layer) continue;
      const px = this.sx(p.x), py = this.sy(p.y);
      const a = Math.max(0, 1 - p.age / p.life);
      if (p.k === 'puff') {
        const r = Math.max(2, (p.r + p.age * 1.5) * this.cam.s) * (0.6 + a * 0.4);
        g.fillStyle = INK.paper; g.strokeStyle = INK.blue; g.lineWidth = 1.6;
        g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); g.stroke();
      } else if (p.k === 'smoke') {
        const r = Math.max(2, (p.r + p.age * 2) * this.cam.s);
        g.strokeStyle = INK.tint; g.lineWidth = 2;
        g.beginPath(); g.arc(px, py, r, 0, 7); g.stroke();
      } else if (p.k === 'chip') {
        g.fillStyle = p.c || INK.blue; g.fillRect(px - 2, py - 2, 4, 3);
      } else if (p.k === 'word') {
        g.save(); g.translate(px, py - p.age * 30); g.rotate(p.rot || -0.1);
        g.font = `${p.size || 26}px 'Holtwood One SC', serif`; g.textAlign = 'center';
        g.lineWidth = 5; g.strokeStyle = INK.paper; g.strokeText(p.text, 0, 0);
        g.fillStyle = p.c || INK.red; g.fillText(p.text, 0, 0);
        g.restore();
      } else if (p.k === 'streak') {
        g.strokeStyle = INK.blue; g.lineWidth = 2; g.globalAlpha = a;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - p.len, py + p.dy); g.stroke(); g.globalAlpha = 1;
      }
    }
  }

  sea(time) {
    const g = this.g, { W, H } = this;
    const x0 = this.sx(GOAL - 15);
    if (x0 > W) return;
    const y = this.sy(WATER_Y);
    if (y > H + 10) return;
    g.fillStyle = INK.blue; g.fillRect(Math.max(0, x0), y, W - Math.max(0, x0), H - y + 10);
    g.strokeStyle = INK.paper; g.lineCap = 'round';
    for (let r = 0; r < 8; r++) {
      const yy = y + 6 + r * 13; if (yy > H) break;
      g.lineWidth = 2.4 - r * 0.2;
      for (let k = 0; k < 14; k++) {
        const xx = x0 + ((k * 90 + r * 37 + time * 20 * (r % 2 ? 1 : -1)) % (W + 200)) - 60;
        if (xx < x0) continue;
        g.beginPath(); g.moveTo(xx, yy); g.quadraticCurveTo(xx + 12, yy - 5, xx + 24, yy); g.stroke();
      }
    }
  }
}

// small standalone drawings for the shop and the cards
export function icon(kind, tier, size = 64) {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = c.height = size * dpr; c.style.width = c.style.height = size + 'px';
  const p = new Painter(c); p.W = p.H = size; p.dpr = dpr;
  const g = p.g; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = size * 0.5;
  g.translate(size / 2, size * 0.62);
  if (kind === 'ramp') {
    const t = GEAR.ramp[tier];
    const k = size / 34;
    g.strokeStyle = INK.black; g.lineWidth = 2.5; g.lineCap = 'round';
    const h = (t.h / 27) * 0.9 + 0.35;
    g.beginPath(); g.moveTo(-size * 0.42, -size * 0.45 * h); g.quadraticCurveTo(-size * 0.05, size * 0.25 * h - size * 0.1, size * 0.4, -size * 0.05 - h * 4); g.stroke();
    g.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { const x = -size * 0.35 + i * size * 0.22; g.beginPath(); g.moveTo(x, size * 0.3); g.lineTo(x, -size * 0.1 * h * (3 - i) * 0.5); g.stroke(); }
    g.fillStyle = INK.red; g.beginPath(); g.moveTo(-size * 0.42, -size * 0.45 * h); g.lineTo(-size * 0.42, -size * 0.45 * h - 12); g.lineTo(-size * 0.42 + 10, -size * 0.45 * h - 8); g.fill();
    void k;
  } else if (kind === 'wings') {
    g.translate(s * 0.15, s * 0.1);
    if (tier) p.wingShape(tier, s * 0.9, false);
    p.penguinBody(s * 0.9, { lying: true, t: 0 });
  } else if (kind === 'rocket') {
    g.translate(s * 0.1, 0);
    p.penguinBody(s * 0.85, { lying: true, t: 0 });
    if (tier) p.rocketShape(tier, s * 0.85, true, 0.3);
  } else if (kind === 'belly') {
    // the sled under the penguin
    g.fillStyle = [INK.paper, '#e8c590', INK.tint, INK.red, INK.blue][tier];
    g.strokeStyle = INK.black; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-s * 0.6, 2); g.lineTo(s * 0.55, 2); g.quadraticCurveTo(s * 0.8, 2, s * 0.75, -s * 0.15); g.lineTo(s * 0.6, -s * 0.1); g.lineTo(s * 0.55, -3); g.lineTo(-s * 0.6, -3); g.closePath();
    if (tier) { g.fill(); g.stroke(); }
    g.translate(0, -4);
    p.penguinBody(s * 0.85, { lying: true, t: 0 });
  } else if (kind === 'penguin') {
    p.penguinBody(s, { lying: true, sleepy: tier === 1, t: 0 });
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = p.grain; g.fillRect(0, 0, size, size);
  return c;
}
