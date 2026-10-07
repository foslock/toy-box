// Scales: the view. A market stall at the end of an October afternoon, printed: a striped awning along the top with
// the scale's rail hanging under it, the plank on its round bale in the middle, the other stalls and the hills behind.
// The background is painted once per size; produce, plank and bale are sprites; the rest is drawn every frame.
import { PRODUCE } from './produce.js';
import { PLANK, massOf } from './physics.js';
import { RAIL_Y, PAN_Y, HEAP_Y } from './game.js';
import { produceSprites, plankSprite, baleSprite, drawCrow, halftone, leafPath, canvas, hash,
  INK, PAPER, CREAM, RED, ORANGE, MUSTARD, OLIVE, TEAL, PLUM, WOOD, WOOD_D, STRAW, STRAW_D } from './paint.js';

const TAU = Math.PI * 2;
const WORLD_W = 580, TOP_Y = RAIL_Y - 52, BOT_Y = 138;   // the part of the world that must always be on screen
const LEAF_COLS = [ORANGE, RED, MUSTARD, '#b8552a', '#a7712e'];
const BITS = { crab: [RED, '#f0c27a'], damson: ['#4a3f7a', '#e2c35a'], apple: [MUSTARD, '#fff2c4'], turnip: ['#9b3a6f', CREAM], acorn: ['#2f4a33', ORANGE],
  cabbage: ['#8dad58', '#e4ecc0'], prince: ['#8aa3a2', ORANGE], turban: [ORANGE, '#4d7a3c'], pumpkin: [ORANGE, '#f6e2a8'], giant: ['#eda66b', '#2f5d9a'] };

export class View {
  constructor(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.parts = []; this.texts = []; this.rings = []; this.leaves = []; this.sold = [];
    this.shake = 0; this.t = 0; this.needle = 0; this.needleV = 0; this.panPop = 1;
    this.showGuide = true;
    for (let i = 0; i < 14; i++) this.leaves.push(this.newLeaf(true));
  }
  resize(w, h, dpr) {
    dpr = Math.min(dpr, 2.5); w = Math.max(w, 160); h = Math.max(h, 160);
    this.w = w; this.h = h; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    // the awning takes a band across the top; the world fits under it, with any spare height split 62/38
    this.awn = h < 500 ? 34 : w < 600 ? 46 : 54;
    const k = Math.min(w / WORLD_W, (h - this.awn) / (BOT_Y - TOP_Y));
    const free = h - this.awn - (BOT_Y - TOP_Y) * k;
    // tall screens: the rail hangs just under the tags and the rest is ground, where a thumb rests
    const top = w < h * 0.85 ? Math.min(free, 112) + Math.max(0, free - 112) * 0.1 : free * 0.62;
    this.k = k; this.ox = w / 2; this.oy = this.awn - TOP_Y * k + top;
    this.railY = this.oy + RAIL_Y * k;
    this.S = k * dpr;
    this.sprites = PRODUCE.map(p => produceSprites(p.key, p.r * this.S, dpr));
    this.bale = baleSprite(PLANK.h / 2 * this.S, dpr);
    this.plankL = 0;
    this.paintBackground();
  }
  toWorld(sx, sy) { return [(sx - this.ox) / this.k, (sy - this.oy) / this.k]; }
  toScreen(x, y) { return [this.ox + x * this.k, this.oy + y * this.k]; }
  sprite(tier) { return this.sprites[tier]; }

  /* ------------------------------------------------------------------------------------------- the backdrop */
  paintBackground() {
    const { w, h, dpr, k, ox, oy } = this;
    const bg = this.bg = canvas(w * dpr, h * dpr), c = bg.getContext('2d');
    c.scale(dpr, dpr);
    const hz = oy - 40 * k;   // the horizon, just above the plank
    // sky in three flat inks, dithered into each other the way a print fakes a gradient
    const bands = [['#f2dcb2', 0], ['#f3cf9c', hz - 260 * k], ['#efbb83', hz - 110 * k]];
    for (let i = 0; i < bands.length; i++) { c.fillStyle = bands[i][0]; c.fillRect(0, bands[i][1], w, h); }
    for (let i = 1; i < bands.length; i++) dither(c, w, bands[i][1], 46 * Math.max(0.7, k), bands[i][0], dpr);
    // the sun going down behind the hills
    const sx = ox + 175 * k, sy = hz - 70 * k, sr = 64 * k;
    c.fillStyle = '#f8df92'; c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(sx, sy, sr * 1.5, 0, TAU); c.arc(sx, sy, sr, 0, TAU, true); c.clip();
    c.fillStyle = '#f8df92'; ringDots(c, sx, sy, sr, sr * 1.5, 7 * Math.max(0.7, k), dpr); c.restore();
    // a few flat printed clouds drifting over, with a dotted shadow underneath
    const top = this.awn + 40, span = Math.max(80, hz - 150 * k - top);
    for (let i = 0; i < Math.max(3, Math.round(w / 300)); i++) {
      const cx = (i + 0.3 + hash(i + 60) * 0.5) * w / Math.max(3, Math.round(w / 300)), cy = top + hash(i + 70) * span, cw = (70 + hash(i + 80) * 60) * Math.max(0.7, k);
      cloud(c, cx, cy, cw, dpr);
    }
    // hills, far then near
    hills(c, w, hz - 18 * k, 34 * k, '#c6bd8e', 0.004 / Math.max(0.5, k), 1.3);
    hills(c, w, hz + 6 * k, 22 * k, '#a5a56d', 0.007 / Math.max(0.5, k), 4.1);
    // a row of autumn trees along the near hill
    for (let i = 0; i < Math.ceil(w / (34 * k)) + 2; i++) {
      const x = i * 34 * k + hash(i) * 20 * k - 20, y = hz + 4 * k - hash(i + 9) * 10 * k, r = (12 + hash(i + 5) * 12) * k;
      c.fillStyle = LEAF_COLS[(hash(i + 3) * 5) | 0]; c.globalAlpha = 0.75;
      c.beginPath(); c.arc(x, y - r * 0.6, r, 0, TAU); c.arc(x + r * 0.7, y - r * 0.2, r * 0.7, 0, TAU); c.arc(x - r * 0.7, y - r * 0.1, r * 0.65, 0, TAU); c.fill();
      c.globalAlpha = 1;
    }
    // the other stalls along the field, in two muted inks
    const cols = [['#c4705a', '#ecd9b6'], ['#5f8b85', '#ecd9b6'], ['#d4a24a', '#ecd9b6'], ['#8a6a8e', '#ecd9b6']];
    for (let i = -6; i <= 6; i++) {
      const x = ox + i * 128 * k + (hash(i + 40) - 0.5) * 30 * k, wd = (88 + hash(i + 41) * 22) * k, y = hz + 30 * k;
      if (Math.abs(i) <= 1) continue;   // a gap behind the plank keeps it clear
      stall(c, x, y, wd, k, cols[(i + 12) % cols.length], hash(i + 50));
    }
    // the ground: trodden grass and earth, with a halftone of darker earth
    const gy = oy + PLANK.h * k;
    c.fillStyle = '#c9a868'; c.fillRect(0, hz + 20 * k, w, h);
    c.fillStyle = '#b8955a'; c.fillRect(0, gy - 10 * k, w, h);
    dither(c, w, gy - 10 * k, 30 * k, '#b8955a', dpr, true);
    c.fillStyle = 'rgba(120,86,40,.35)';
    for (let i = 0; i < w * 0.25; i++) { const x = hash(i * 1.3) * w, y = gy + hash(i * 2.9) * (h - gy); c.fillRect(x, y, (1 + hash(i) * 2) * k, k); }
    // grass tufts and fallen leaves
    c.strokeStyle = '#7f7a3c'; c.lineWidth = Math.max(1, 1.2 * k); c.lineCap = 'round';
    for (let i = 0; i < w / (14 * k); i++) {
      const x = hash(i + 700) * w, y = gy - 4 * k + hash(i + 800) * (h - gy) * 0.8;
      for (let j = 0; j < 4; j++) { c.beginPath(); c.moveTo(x + j * 2 * k, y); c.lineTo(x + j * 2 * k + (j - 1.5) * 2 * k, y - (4 + hash(i * 3 + j) * 6) * k); c.stroke(); }
    }
    for (let i = 0; i < w / (22 * k); i++) {
      const x = hash(i + 900) * w, y = gy + 4 * k + hash(i + 950) * (h - gy);
      c.save(); c.translate(x, y); c.rotate(hash(i + 990) * TAU); c.fillStyle = LEAF_COLS[i % 5]; leafPath(c, 5 * k); c.fill(); c.restore();
    }
    // straw scattered round the bale
    c.strokeStyle = STRAW_D; c.lineWidth = Math.max(0.8, k);
    for (let i = 0; i < 70; i++) {
      const x = ox + (hash(i + 400) - 0.5) * 220 * k, y = gy + hash(i + 450) * 18 * k, a = hash(i + 480) * Math.PI;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 9 * k, y + Math.sin(a) * 2 * k); c.stroke();
    }
    this.paintSides(c, gy);
    // the rail the scale runs on, hung from the awning by two ropes
    const ry = oy + RAIL_Y * k, rx0 = ox - 300 * k, rx1 = ox + 300 * k;
    c.strokeStyle = '#7a5a36'; c.lineWidth = Math.max(1.5, 2.2 * k);
    for (const x of [rx0 + 14 * k, rx1 - 14 * k]) { c.beginPath(); c.moveTo(x, this.awn - 4); c.lineTo(x, ry); c.stroke(); }
    c.fillStyle = WOOD_D; c.fillRect(rx0, ry - 5 * k, rx1 - rx0, 10 * k);
    c.fillStyle = '#a67646'; c.fillRect(rx0, ry - 5 * k, rx1 - rx0, 3.5 * k);
    c.strokeStyle = INK; c.lineWidth = Math.max(1, 1.4 * dpr / dpr); c.strokeRect(rx0 + 0.8, ry - 5 * k + 0.6, rx1 - rx0, 10 * k);
    c.fillStyle = '#4a4040';
    for (const x of [rx0 + 14 * k, rx1 - 14 * k]) { c.fillRect(x - 3 * k, ry - 9 * k, 6 * k, 18 * k); }
    this.paintAwning(c);
  }
  // the rest of the stall: crates of produce and the judges' table. On a wide screen they stand either side of the
  // plank; on a tall one, in front of it on the ground below.
  paintSides(c, gy) {
    const { k, ox, w, h } = this, room = (w - WORLD_W * k) / 2, below = h - gy;
    if (room >= 110) {
      const d = Math.min(k, room / 190);
      this.crates(c, ox - WORLD_W / 2 * k - room * 0.5 + 6 * d, gy, d);
      this.judges(c, ox + WORLD_W / 2 * k + room * 0.5, gy, d);
    } else if (below > 150) {
      const d = Math.min(k * 1.05, below / 150, w / 470), y = gy + Math.min(below * 0.6, 140 * d);
      this.crates(c, w * 0.25, y, d);
      this.judges(c, w * 0.75, y, d);
    }
  }
  put(c, tier, x, y, d, a = 0) {
    const sp = this.sprites[tier], dpr = this.dpr, f = d / this.k / dpr;
    c.save(); c.translate(x, y); c.rotate(a); c.scale(f, f);
    c.drawImage(sp.body, -sp.o, -sp.o); c.drawImage(sp.shade, -sp.o, -sp.o); c.restore();
  }
  crates(c, cx, gy, d) {
    for (const [dx, dy, tier, n, label, wd] of [[-42, 0, 2, 5, 'GOLDENS', 80], [42, 0, 0, 8, 'CRABS', 80], [0, -38, 4, 2, 'SQUASH', 108]]) {
      const x = cx + dx * d, y = gy + dy * d, cw = wd * d, ch = 38 * d, r = PRODUCE[tier].r * d, per = Math.max(1, Math.floor((cw - r * 0.4) / (r * 1.8)));
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / per), col = i % per, inRow = Math.min(per, n - row * per);
        this.put(c, tier, x + (col - (inRow - 1) / 2) * r * 1.8 + (row ? r * 0.45 : 0), y - ch - r * 0.35 - row * r * 1.2, d, hash(i + tier) * 6);
      }
      c.fillStyle = '#b8874f'; c.fillRect(x - cw / 2, y - ch, cw, ch);
      c.fillStyle = '#9b6c3c'; for (let j = 0; j < 3; j++) c.fillRect(x - cw / 2, y - ch + j * ch / 3 + ch * 0.27, cw, ch * 0.05);
      c.strokeStyle = INK; c.lineWidth = Math.max(1, 1.2 * d); c.strokeRect(x - cw / 2, y - ch, cw, ch);
      c.fillStyle = 'rgba(251,244,226,.8)'; c.font = `400 ${9 * d}px Ultra, Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText(label, x, y - ch * 0.4);
    }
  }
  judges(c, jx, gy, d) {
    const tw = 130 * d, th = 50 * d;
    this.put(c, 6, jx + 40 * d, gy - th - PRODUCE[6].r * d * 0.92, d, 0.2);
    this.put(c, 9, jx - 16 * d, gy - th - PRODUCE[9].r * d * 0.9, d, -0.05);
    c.fillStyle = CREAM; c.fillRect(jx - tw / 2, gy - th, tw, th * 0.7);
    c.fillStyle = '#e9dcbf'; for (let i = 0; i < 6; i++) c.fillRect(jx - tw / 2 + i * tw / 6, gy - th, tw / 12, th * 0.7);
    c.fillStyle = WOOD_D; c.fillRect(jx - tw / 2 + 6 * d, gy - th * 0.3, 5 * d, th * 0.3); c.fillRect(jx + tw / 2 - 11 * d, gy - th * 0.3, 5 * d, th * 0.3);
    c.strokeStyle = INK; c.lineWidth = Math.max(1, 1.2 * d); c.strokeRect(jx - tw / 2, gy - th, tw, th * 0.7);
    c.fillStyle = INK; c.font = `400 ${10 * d}px Ultra, Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText('JUDGING', jx, gy - th * 0.38);
  }
  paintAwning(c) {
    const { w, awn } = this, sw = Math.max(26, Math.min(40, w / 22)), n = Math.ceil(w / sw) + 1, off = (w % sw) / 2 - sw;
    c.fillStyle = 'rgba(70,40,20,.18)'; c.fillRect(0, awn, w, 6);
    for (let i = 0; i < n; i++) {
      const x = off + i * sw;
      c.fillStyle = i % 2 ? CREAM : RED;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x + sw, 0); c.lineTo(x + sw, awn - sw / 2); c.arc(x + sw / 2, awn - sw / 2, sw / 2, 0, Math.PI); c.closePath(); c.fill();
    }
    // a halftone fold shadow along the top, and the key plate
    c.save(); c.beginPath(); c.rect(0, 0, w, awn * 0.42); c.clip();
    c.fillStyle = 'rgba(80,20,10,.35)';
    for (let y = 2; y < awn * 0.42; y += 4) for (let x = (y % 8) / 2; x < w; x += 4) { const r = 1.6 * (1 - y / (awn * 0.42)); if (r > 0.3) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); } }
    c.restore();
    c.strokeStyle = INK; c.lineWidth = 1.6;
    c.beginPath();
    for (let i = 0; i < n; i++) { const x = off + i * sw + 1; c.moveTo(x + sw, awn - sw / 2); c.arc(x + sw / 2, awn - sw / 2, sw / 2, 0, Math.PI); }
    c.stroke();
    c.fillStyle = '#6b4a2a'; c.fillRect(0, 0, w, 5);
  }

  /* ------------------------------------------------------------------------------------------- every frame */
  frame(g, dt, opts = {}) {
    this.t += dt;
    const { ctx: c, dpr, k, ox, oy, S } = this, w = g.world, pk = w.plank;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.bg, 0, 0);
    if (this.plankL !== pk.L) { this.plankL = pk.L; this.plank = plankSprite(pk.L * S, pk.T * S, PLANK.lip * S, PLANK.lipW * S, dpr); }
    const wind = g.wind;
    this.drawBunting(c, wind.dir * wind.f);
    // the world
    const sh = this.shake > 0.2 ? this.shake : 0; this.shake *= Math.pow(0.02, dt);
    const shx = sh ? (Math.random() - 0.5) * sh : 0, shy = sh ? (Math.random() - 0.5) * sh : 0;
    c.setTransform(S, 0, 0, S, (ox + shx) * dpr, (oy + shy) * dpr);
    this.drawLeaves(c, dt, wind, false);
    // shadow under the plank
    c.fillStyle = 'rgba(80,50,20,.22)'; c.beginPath(); c.ellipse(0, PLANK.h + 2, pk.L * 0.48 * Math.cos(pk.th), 7, 0, 0, TAU); c.fill();
    // the bale, squashed a touch by the load
    const load = Math.min(1, w.bodies.reduce((a, b) => a + (b.onGround ? 0 : b.m), 0) / 400);
    const bs = this.bale, br = PLANK.h / 2;
    c.save(); c.translate(0, PLANK.h); c.scale(1 + load * 0.04, 1 - load * 0.05); c.translate(0, -br);
    c.drawImage(bs.cv, -bs.o / S, -bs.o / S, bs.cv.width / S, bs.cv.height / S); c.restore();
    for (const d of g.debris) this.drawOffcut(c, d);
    // the plank
    c.save(); c.rotate(pk.th);
    const ps = this.plank;
    c.drawImage(ps.cv, -pk.L / 2 - ps.pad / S, -pk.T - PLANK.lip - ps.pad / S, ps.cv.width / S, ps.cv.height / S);
    if (g.trim.st === 'warn') this.drawSaw(c, g, pk);
    c.restore();
    this.drawGauge(c, pk, dt);
    if (opts.guide && g.ready && this.showGuide) this.drawGuide(c, g);
    // produce
    for (const b of w.bodies) this.drawProduce(c, b);
    this.drawSold(c, dt);
    const C = g.crow;
    if (C.st !== 'away') drawCrow(c, C.x, C.y, 1.3, C.face, C.st === 'perch' ? 'stand' : 'fly', this.t + C.x * 0.01, { peck: C.peck, hop: C.hop });
    this.drawScale(c, g, dt);
    // the heap's too tall: a red dashed line along the top, pulsing faster as time runs out
    if (g.heapTop < HEAP_Y + 30 && g.state === 'play') {
      const near = g.heap > 0 ? 1 : 1 - (g.heapTop - HEAP_Y) / 30, pulse = g.heap > 0 ? 0.55 + 0.45 * Math.sin(this.t * (8 + g.heap * 6)) : 0.35;
      c.strokeStyle = `rgba(194,65,45,${Math.max(0, near) * pulse})`; c.lineWidth = 2; c.setLineDash([7, 5]);
      c.beginPath(); c.moveTo(-g.L / 2 - 10, HEAP_Y); c.lineTo(g.L / 2 + 10, HEAP_Y); c.stroke(); c.setLineDash([]);
    }
    this.drawParts(c, dt);
    this.drawLeaves(c, dt, wind, true);
    this.drawTexts(c, dt);
  }

  drawProduce(c, b, alpha = 1) {
    const sp = this.sprites[b.tier], S = this.S, sc = b.r / b.rT * (b.born > 0 ? 1 + 0.12 * Math.sin(Math.min(1, b.age / 0.35) * Math.PI) * (1 - Math.min(1, b.age / 0.35)) : 1);
    c.save(); c.translate(b.x, b.y);
    if (alpha < 1) c.globalAlpha = alpha;
    if (b.sq > 0.01) { c.rotate(b.sqa); c.scale(1 - b.sq, 1 + b.sq * 0.6); c.rotate(-b.sqa); }
    c.scale(sc, sc);
    c.save(); c.rotate(b.a); c.drawImage(sp.body, -sp.o / S, -sp.o / S, sp.body.width / S, sp.body.height / S); c.restore();
    c.drawImage(sp.shade, -sp.o / S, -sp.o / S, sp.shade.width / S, sp.shade.height / S);
    c.restore();
  }
  drawOffcut(c, d) {
    c.save(); c.translate(d.x, d.y); c.rotate(d.a);
    c.fillStyle = WOOD; c.fillRect(-d.len / 2, -PLANK.T / 2, d.len, PLANK.T);
    c.fillStyle = '#e8c48e'; c.fillRect(-d.len / 2, -PLANK.T / 2, 2.5, PLANK.T);
    c.strokeStyle = INK; c.lineWidth = 1.2; c.strokeRect(-d.len / 2, -PLANK.T / 2, d.len, PLANK.T);
    c.restore();
  }
  // pencil marks at the cut, and a saw going at each end
  drawSaw(c, g, pk) {
    const at = g.trim.at, t = g.trim.t, T = pk.T;
    for (const side of [-1, 1]) {
      const x = side * at;
      c.strokeStyle = 'rgba(60,40,30,.75)'; c.lineWidth = 1.3; c.setLineDash([3, 2.5]);
      c.beginPath(); c.moveTo(x, -T - 3); c.lineTo(x, 3); c.stroke(); c.setLineDash([]);
      const depth = Math.min(1, t / 4.3) * T, stroke = Math.sin(t * 15) * 9;
      c.save(); c.translate(x, -T + depth - 2); c.rotate(side * 0.35);
      c.translate(stroke, 0);
      c.fillStyle = '#c9c4ba'; c.beginPath(); c.moveTo(-26, -1); c.lineTo(12, -1); c.lineTo(16, -12); c.lineTo(-26, -7); c.closePath(); c.fill();
      c.strokeStyle = INK; c.lineWidth = 0.9; c.stroke();
      c.beginPath(); for (let i = 0; i < 13; i++) { const x = -25 + i * 3; c.moveTo(x, -1); c.lineTo(x + 1.5, 1.6); c.lineTo(x + 3, -1); } c.fillStyle = '#9d978c'; c.fill(); c.stroke();
      c.fillStyle = WOOD_D; c.fillRect(-36, -11, 11, 10); c.strokeRect(-36, -11, 11, 10);
      c.restore();
      if (Math.random() < 0.5) this.parts.push({ x: Math.cos(pk.th) * x + Math.sin(pk.th) * 0, y: Math.sin(pk.th) * x, vx: (Math.random() - 0.5) * 60, vy: 20 + Math.random() * 40, g: 300, life: 0.8, max: 0.8, size: 1.2, col: '#e8c48e', kind: 'dot' });
    }
  }
  // a protractor fixed to the plank's face over the bale, with a pendulum needle that always hangs straight down
  drawGauge(c, pk, dt) {
    const target = -pk.th;
    this.needleV += ((target - this.needle) * 120 - this.needleV * 9) * dt; this.needle += this.needleV * dt;
    const R = 31, max = pk.max;
    c.save(); c.rotate(pk.th); c.translate(0, -pk.T * 0.35);
    c.fillStyle = CREAM; c.beginPath(); c.arc(0, 0, R, 0.05, Math.PI - 0.05); c.closePath(); c.fill();
    // the danger arcs, red past two thirds of the way to the ground
    c.lineWidth = 5;
    for (const side of [-1, 1]) {
      c.strokeStyle = MUSTARD; c.beginPath(); c.arc(0, 0, R - 4, Math.PI / 2 + side * max * 0.35, Math.PI / 2 + side * max * 0.65, side < 0); c.stroke();
      c.strokeStyle = RED; c.beginPath(); c.arc(0, 0, R - 4, Math.PI / 2 + side * max * 0.65, Math.PI / 2 + side * max * 1.05, side < 0); c.stroke();
    }
    c.strokeStyle = INK; c.lineWidth = 0.8;
    for (let a = -30; a <= 30; a += 5) { const r = a * Math.PI / 180, l = a % 10 ? 4 : 7; c.beginPath(); c.moveTo(Math.sin(r) * R, Math.cos(r) * R); c.lineTo(Math.sin(r) * (R - l), Math.cos(r) * (R - l)); c.stroke(); }
    c.fillStyle = INK; c.font = '400 6px Ultra, Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('LEVEL', 0, R * 0.42);
    c.lineWidth = 1.4; c.beginPath(); c.arc(0, 0, R, 0.05, Math.PI - 0.05); c.closePath(); c.stroke();
    // the needle, in the plank's frame: straight down in the world
    const na = this.needle;
    c.save(); c.rotate(na);
    c.strokeStyle = RED; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, R - 3); c.stroke();
    c.fillStyle = RED; c.beginPath(); c.arc(0, R - 5, 2.6, 0, TAU); c.fill();
    c.restore();
    c.fillStyle = '#b08a3a'; c.beginPath(); c.arc(0, 0, 3.2, 0, TAU); c.fill(); c.stroke();
    c.restore();
  }
  drawGuide(c, g) {
    const p = g.pan, tier = p.tier;
    if (tier < 0) return;
    const r = PRODUCE[tier].r, x = p.x, land = g.landing(x, r), y0 = PAN_Y + 6;
    c.strokeStyle = 'rgba(43,32,28,.32)'; c.lineWidth = 1.4; c.setLineDash([2, 6]); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y0); c.lineTo(x, land.y - r); c.stroke();
    c.setLineDash([4, 4]); c.beginPath(); c.arc(x, land.y, r, 0, TAU); c.stroke(); c.setLineDash([]);
  }
  drawScale(c, g, dt) {
    const p = g.pan, x = p.x, k = this.k;
    if (p.cool <= 0 && this.panPop < 1) this.panPop = Math.min(1, this.panPop + dt * 5);
    // trolley wheels on the rail
    c.fillStyle = '#4a4040'; c.strokeStyle = INK; c.lineWidth = 1;
    for (const dx of [-7, 7]) { c.beginPath(); c.arc(x + dx, RAIL_Y - 8, 4, 0, TAU); c.fill(); }
    c.fillRect(x - 10, RAIL_Y - 8, 20, 3);
    c.fillRect(x - 1.5, RAIL_Y - 6, 3, 18);
    // the dial
    const dy = RAIL_Y + 30;
    c.save(); c.translate(x, RAIL_Y + 10); c.rotate(p.swing * 0.35); c.translate(-x, -(RAIL_Y + 10));
    c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(x, dy, 17, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = CREAM; c.beginPath(); c.arc(x, dy, 13.5, 0, TAU); c.fill();
    c.strokeStyle = INK; c.lineWidth = 0.7;
    for (let i = 0; i <= 10; i++) { const a = -2.4 + i * 0.48; c.beginPath(); c.moveTo(x + Math.sin(a) * 13, dy - Math.cos(a) * 13); c.lineTo(x + Math.sin(a) * (i % 5 ? 11 : 9.5), dy - Math.cos(a) * (i % 5 ? 11 : 9.5)); c.stroke(); }
    const m = p.tier >= 0 && p.cool <= 0 ? massOf(PRODUCE[p.tier].r) / massOf(PRODUCE[4].r) : 0;
    p.dial = (p.dial ?? 0) + ((-2.4 + m * 4.4) - (p.dial ?? -2.4)) * Math.min(1, dt * 7);
    c.strokeStyle = RED; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, dy); c.lineTo(x + Math.sin(p.dial) * 11, dy - Math.cos(p.dial) * 11); c.stroke();
    c.fillStyle = INK; c.beginPath(); c.arc(x, dy, 1.6, 0, TAU); c.fill();
    c.font = '400 4px Ultra, Georgia, serif'; c.textAlign = 'center'; c.fillText('KILOS', x, dy + 7);
    c.restore();
    // chains and pan, swinging from the hook under the dial
    const hy = RAIL_Y + 50;
    c.save(); c.translate(x, hy); c.rotate(p.swing - p.tip * 0.8 * (p.tipDir || 1));
    const py = PAN_Y - hy;
    c.fillStyle = '#4a4040'; c.fillRect(-1.2, -3, 2.4, 6);
    c.strokeStyle = '#5a5050'; c.lineWidth = 1.2; c.setLineDash([2.5, 1.5]);
    c.beginPath(); c.moveTo(0, 2); c.lineTo(-27, py); c.moveTo(0, 2); c.lineTo(27, py); c.moveTo(0, 2); c.lineTo(0, py - 2); c.stroke(); c.setLineDash([]);
    // the fruit sits in the pan
    if (p.tier >= 0 && p.cool <= 0) {
      const r = PRODUCE[p.tier].r, sc = 0.4 + 0.6 * easeOutBack(this.panPop);
      c.save(); c.translate(0, py - r * 0.7); c.scale(sc, sc); c.rotate(-p.swing * 0.5);
      this.drawProduce(c, { x: 0, y: 0, tier: p.tier, r, rT: r, a: -0.3, sq: 0, born: 0, age: 1 });
      c.restore();
    } else this.panPop = 0;
    c.fillStyle = '#c9a24a'; c.strokeStyle = INK; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(-30, py); c.quadraticCurveTo(0, py + 15, 30, py); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,240,190,.6)'; c.beginPath(); c.ellipse(-12, py + 3, 9, 1.6, 0.1, 0, TAU); c.fill();
    c.restore();
  }
  drawBunting(c, wind) {
    const { w, dpr, awn } = this, y0 = awn + 10, n = Math.ceil(w / 34) + 1, sag = 14;
    if (this.railY - awn < 64) return;   // no room above the rail
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.strokeStyle = '#6b5a44'; c.lineWidth = 1;
    const at = x => y0 + sag * Math.sin(Math.PI * ((x / w * 3) % 1)) + Math.sin(this.t * 1.3 + x * 0.01) * 1.5 * (1 + Math.abs(wind) * 0.03);
    c.beginPath(); for (let x = 0; x <= w; x += 8) { x ? c.lineTo(x, at(x)) : c.moveTo(x, at(x)); } c.stroke();
    const cols = [RED, MUSTARD, TEAL, CREAM, ORANGE, PLUM];
    for (let i = 0; i < n; i++) {
      const x = i * 34 + 6, y = at(x + 9), sw = Math.sin(this.t * 3 + i) * 0.08 + wind * 0.004;
      c.save(); c.translate(x + 9, y); c.rotate(sw); c.transform(1, 0, -wind * 0.004, 1, 0, 0);
      c.fillStyle = cols[i % cols.length]; c.beginPath(); c.moveTo(-9, 0); c.lineTo(9, 0); c.lineTo(0, 17); c.closePath(); c.fill();
      c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
      c.restore();
    }
  }

  /* ------------------------------------------------------------------------------------------- effects */
  newLeaf(anywhere) {
    const left = Math.random() < 0.5;
    return { x: anywhere ? (Math.random() - 0.5) * 900 : (left ? -480 : 480), y: anywhere ? -600 + Math.random() * 600 : -620 + Math.random() * 500,
      vx: 0, vy: 20 + Math.random() * 20, a: Math.random() * TAU, w: (Math.random() - 0.5) * 3, s: 3.5 + Math.random() * 3,
      col: LEAF_COLS[(Math.random() * 5) | 0], ph: Math.random() * TAU, front: Math.random() < 0.35 };
  }
  drawLeaves(c, dt, wind, front) {
    const gust = wind.dir * wind.f;
    if (!front && wind.st !== 'calm' && this.leaves.length < 70 && Math.random() < dt * 30 * wind.f) {
      const l = this.newLeaf(false); l.x = -wind.dir * 480; l.y = -600 + Math.random() * 640; this.leaves.push(l);
    }
    for (let i = this.leaves.length - 1; i >= 0; i--) {
      const l = this.leaves[i];
      if (l.front !== front) continue;
      l.ph += dt * 2;
      l.vx += ((gust * 2.6 + Math.sin(l.ph) * 14) - l.vx) * dt * 2;
      l.vy += ((wind.st === 'gust' ? 10 : 30) + Math.cos(l.ph * 1.3) * 15 - l.vy) * dt * 2;
      l.x += l.vx * dt; l.y += l.vy * dt; l.a += (l.w + gust * 0.02) * dt;
      if (l.y > PLANK.h + 40 + Math.random() * 40 || Math.abs(l.x) > 560) { if (this.leaves.length > 16) this.leaves.splice(i, 1); else Object.assign(l, this.newLeaf(false)); continue; }
      c.save(); c.translate(l.x, l.y); c.rotate(l.a); c.scale(1, 0.4 + 0.6 * Math.abs(Math.sin(l.ph)));
      c.fillStyle = l.col; leafPath(c, l.s); c.fill(); c.strokeStyle = 'rgba(43,32,28,.5)'; c.lineWidth = 0.6; c.stroke();
      c.restore();
    }
  }
  pop(tier, x, y, big = 1) {
    const r = PRODUCE[tier].r, [a, b] = BITS[PRODUCE[tier].key];
    const n = Math.round(10 + r * 0.4) * big;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * TAU, sp = 60 + Math.random() * 160 * big;
      this.parts.push({ x: x + Math.cos(ang) * r * 0.5, y: y + Math.sin(ang) * r * 0.5, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 90, g: 700,
        life: 0.5 + Math.random() * 0.4, max: 0.9, size: 1.3 + Math.random() * 2.4, col: Math.random() < 0.7 ? a : b, kind: Math.random() < 0.3 ? 'seed' : 'dot', a: Math.random() * TAU });
    }
    this.rings.push({ x, y, r0: r * 0.8, r1: r * 1.7, life: 0.35, max: 0.35 });
  }
  dust(x, y, n = 8) {
    for (let i = 0; i < n; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 16, y, vx: (Math.random() - 0.5) * 90, vy: -20 - Math.random() * 50, g: 120, life: 0.6, max: 0.6, size: 2 + Math.random() * 3, col: 'rgba(160,120,70,.6)', kind: 'puff' });
  }
  float(x, y, text, size = 18, col = CREAM, life = 1.1) { this.texts.push({ x, y, text, size, col, life, max: life }); }
  sell(b) { this.sold.push({ b: { ...b }, t: 0 }); }
  drawSold(c, dt) {
    for (let i = this.sold.length - 1; i >= 0; i--) {
      const s = this.sold[i]; s.t += dt;
      const k = s.t / 1.2; if (k >= 1) { this.sold.splice(i, 1); continue; }
      const b = { ...s.b, y: s.b.y - easeOutCubic(k) * 70, a: s.b.a };
      this.drawProduce(c, b, 1 - k * k);
      c.save(); c.translate(b.x + b.r * 0.6, b.y - b.r * 0.7); c.rotate(-0.2); c.globalAlpha = 1 - k * k;
      c.fillStyle = '#e5c99a'; c.strokeStyle = INK; c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(0, -6); c.lineTo(24, -6); c.lineTo(24, 6); c.lineTo(0, 6); c.lineTo(-6, 0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = RED; c.font = '400 7px Ultra, Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SOLD', 11, 0.5);
      c.restore();
    }
  }
  drawParts(c, dt) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.life -= dt; if (r.life <= 0) { this.rings.splice(i, 1); continue; }
      const k = 1 - r.life / r.max;
      c.strokeStyle = `rgba(43,32,28,${0.6 * (1 - k)})`; c.lineWidth = 2.2 * (1 - k) + 0.4;
      c.beginPath(); c.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * easeOutCubic(k), 0, TAU); c.stroke();
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.life -= dt; if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 1.5;
      const a = Math.min(1, p.life / (p.max * 0.5));
      c.globalAlpha = a; c.fillStyle = p.col;
      if (p.kind === 'seed') { c.save(); c.translate(p.x, p.y); c.rotate(p.a += dt * 8); c.beginPath(); c.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, TAU); c.fill(); c.restore(); }
      else if (p.kind === 'puff') { c.beginPath(); c.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, TAU); c.fill(); }
      else { c.beginPath(); c.arc(p.x, p.y, p.size, 0, TAU); c.fill(); }
    }
    c.globalAlpha = 1;
  }
  drawTexts(c, dt) {
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]; t.life -= dt; if (t.life <= 0) { this.texts.splice(i, 1); continue; }
      const k = 1 - t.life / t.max, y = t.y - easeOutCubic(k) * 34, s = t.size * (k < 0.15 ? 0.6 + easeOutBack(k / 0.15) * 0.4 : 1);
      c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      c.font = `400 ${s}px Ultra, Georgia, serif`;
      c.lineWidth = s * 0.28; c.strokeStyle = INK; c.strokeText(t.text, t.x + 1, y + 1);
      c.fillStyle = t.col; c.fillText(t.text, t.x, y);
    }
    c.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------------------------------------- helpers */
function easeOutBack(x) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
// the band above `y` gets dots of the colour below, growing toward the line: a printed gradient
function dither(c, w, y, height, col, dpr, down = false) {
  c.fillStyle = col; const cell = 6;
  for (let yy = 0; yy < height; yy += cell * 0.866) for (let x = ((yy / (cell * 0.866)) % 2) * cell / 2; x < w; x += cell) {
    const k = 1 - yy / height, r = cell * 0.62 * Math.sqrt(k);
    if (r < 0.4) continue;
    c.beginPath(); c.arc(x, down ? y - yy : y - yy, r, 0, TAU); c.fill();
  }
}
function ringDots(c, x, y, r0, r1, cell, dpr) {
  for (let yy = y - r1; yy < y + r1; yy += cell) for (let xx = x - r1; xx < x + r1; xx += cell) {
    const d = Math.hypot(xx - x, yy - y); if (d < r0 || d > r1) continue;
    const k = 1 - (d - r0) / (r1 - r0), r = cell * 0.5 * Math.sqrt(k);
    c.beginPath(); c.arc(xx, yy, r, 0, TAU); c.fill();
  }
}
function cloud(c, x, y, wd, dpr) {
  const puffs = [[-0.32, 0, 0.28], [-0.05, -0.16, 0.36], [0.26, -0.04, 0.3], [0.45, 0.06, 0.2], [-0.5, 0.08, 0.18]];
  const path = () => { c.beginPath(); for (const [dx, dy, r] of puffs) { c.moveTo(x + dx * wd + r * wd, y + dy * wd); c.arc(x + dx * wd, y + dy * wd, r * wd, 0, TAU); } c.rect(x - 0.62 * wd, y, 1.2 * wd, 0.2 * wd); };
  c.save(); path(); c.clip();
  c.fillStyle = '#f8ead0'; c.fillRect(x - wd, y - wd, 2 * wd, 2 * wd);
  c.fillStyle = '#ebc697';
  for (let yy = y - 0.05 * wd; yy < y + 0.25 * wd; yy += 4) for (let xx = x - wd + ((yy | 0) % 8) / 2; xx < x + wd; xx += 4) {
    const k = (yy - (y - 0.05 * wd)) / (0.3 * wd), r = 1.9 * Math.sqrt(k);
    if (r > 0.3) { c.beginPath(); c.arc(xx, yy, r, 0, TAU); c.fill(); }
  }
  c.restore();
  c.save(); c.beginPath(); c.rect(x - wd, y + 0.2 * wd - 0.5, 2 * wd, wd); c.clip(); c.restore();
}
function hills(c, w, y, amp, col, f, ph) {
  c.fillStyle = col; c.beginPath(); c.moveTo(0, y + 400);
  for (let x = 0; x <= w + 10; x += 8) c.lineTo(x, y - amp * (0.5 + 0.35 * Math.sin(x * f + ph) + 0.15 * Math.sin(x * f * 2.7 + ph * 2)));
  c.lineTo(w, y + 400); c.closePath(); c.fill();
}
function stall(c, x, y, wd, k, [a, b], h0) {
  const ht = (46 + h0 * 12) * k, roof = 18 * k;
  c.globalAlpha = 0.85;
  c.fillStyle = '#d7c39a'; c.fillRect(x - wd / 2, y - ht, wd, ht);
  c.fillStyle = '#b89a6a'; c.fillRect(x - wd / 2, y - ht * 0.42, wd, ht * 0.42);
  // produce on the table, as dots
  for (let i = 0; i < 9; i++) { c.fillStyle = LEAF_COLS[(i + Math.floor(h0 * 10)) % 5]; c.beginPath(); c.arc(x - wd / 2 + (i + 0.5) * wd / 9, y - ht * 0.45, 3.4 * k, 0, TAU); c.fill(); }
  const n = 6, sw = wd / n;
  for (let i = 0; i < n; i++) {
    c.fillStyle = i % 2 ? b : a;
    c.beginPath(); c.moveTo(x - wd / 2 + i * sw, y - ht); c.lineTo(x - wd / 2 + (i + 1) * sw, y - ht); c.lineTo(x - wd / 2 + (i + 0.5 + (i + 0.5 - n / 2) * 0.12) * sw, y - ht - roof); c.closePath(); c.fill();
    c.beginPath(); c.arc(x - wd / 2 + (i + 0.5) * sw, y - ht, sw / 2, 0, Math.PI); c.fill();
  }
  c.fillStyle = '#7a6448'; c.fillRect(x - wd / 2 - 2 * k, y - ht - roof * 0.6, 2.5 * k, ht + roof * 0.6); c.fillRect(x + wd / 2 - 0.5 * k, y - ht - roof * 0.6, 2.5 * k, ht + roof * 0.6);
  c.globalAlpha = 1;
}
