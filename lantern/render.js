// Lantern: scratchboard renderer. The world is black; light scratches it back
// to warm cream lines. Outside the light the same lines show faintly, cold blue.
import { WORLD, WEAPONS, lightFor, angDiff } from './game.js';

const CREAM = '#f1e4c4', GOLD = '#f0b85a', EMBER = '#ff8a3a', BLUE = '#7d98c4', ICE = '#c9dcff', RED = '#e2492f', INK = '#060608';
const TAU = Math.PI * 2;
const CHUNK = 300;

function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x, y, s) { // cheap smooth value noise
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy;
  let t = l ? ((px - x1) * dx + (py - y1) * dy) / l : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - x1 - dx * t, py - y1 - dy * t);
}

export class Renderer {
  constructor(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.dark = document.createElement('canvas'); this.dctx = this.dark.getContext('2d');
    this.lit = document.createElement('canvas'); this.lctx = this.lit.getContext('2d');
    this.mask = document.createElement('canvas'); this.mctx = this.mask.getContext('2d');
    this.chunks = new Map(); this.map = null;
    this.cam = { x: WORLD / 2, y: WORLD / 2, z: 1, shake: 0 };
    this.fx = []; this.nums = [];
    this.grain = this.makeGrain();
  }
  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    for (const c of [this.cv, this.dark, this.lit, this.mask]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    this.cam.z = Math.max(0.5, Math.min(1.6, Math.min(w, h) / 620));
    const want = Math.min(2, Math.max(1, Math.ceil(this.cam.z * dpr * 2) / 2));
    if (want !== this.mapScale) { this.mapScale = want; this.chunks.clear(); }
  }
  setMap(map) { if (this.map !== map) { this.map = map; this.chunks.clear(); } }
  makeGrain() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const id = x.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() < 0.5 ? 0 : 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = Math.random() * 22; }
    x.putImageData(id, 0, 0); return c;
  }

  // ------------------------------------------------ the engraved map, in tiles
  chunk(cx, cy) {
    const key = cx + ',' + cy;
    let c = this.chunks.get(key);
    if (c) { this.chunks.delete(key); this.chunks.set(key, c); return c; }
    const s = this.mapScale;
    c = document.createElement('canvas'); c.width = c.height = Math.ceil(CHUNK * s);
    const x = c.getContext('2d');
    x.scale(s, s); x.translate(-cx * CHUNK, -cy * CHUNK);
    this.drawRegion(x, cx * CHUNK, cy * CHUNK, CHUNK);
    this.chunks.set(key, c);
    if (this.chunks.size > 48) this.chunks.delete(this.chunks.keys().next().value);
    return c;
  }

  drawRegion(x, x0, y0, S) {
    const m = this.map, seed = m.seed;
    x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineCap = 'round';
    const near = (o, pad) => o.x + (o.w || 0) + pad > x0 && o.x - pad < x0 + S && o.y + (o.h || 0) + pad > y0 && o.y - pad < y0 + S;
    // ground hatching, flowing
    const G = 7;
    x.lineWidth = 0.9;
    x.beginPath();
    for (let gy = Math.floor(y0 / G) - 1; gy <= Math.ceil((y0 + S) / G); gy++) {
      for (let gx = Math.floor(x0 / G) - 1; gx <= Math.ceil((x0 + S) / G); gx++) {
        const r1 = hash(gx, gy, seed), r2 = hash(gx, gy, seed + 1), r3 = hash(gx, gy, seed + 2);
        const px = gx * G + r1 * G, py = gy * G + r2 * G;
        const n = noise(px / 140, py / 140, seed), n2 = noise(px / 40, py / 40, seed + 9);
        let dens = 0.25 + 0.6 * n + 0.25 * (n2 - 0.5);
        let onPath = false;
        for (const p of m.paths) if (segDist(px, py, p[0], p[1], p[2], p[3]) < 18) { onPath = true; break; }
        if (onPath) dens = 0.12;
        for (const g of m.graces) if (Math.hypot(px - g.x, py - g.y) < 108) dens = -1;
        if (r3 > dens) continue;
        const a = -0.75 + (noise(px / 220, py / 220, seed + 4) - 0.5) * 2.2 + (r1 - 0.5) * 0.25;
        const L = 3 + 7 * n2;
        x.moveTo(px - Math.cos(a) * L, py - Math.sin(a) * L); x.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L);
      }
    }
    x.globalAlpha = 0.55; x.stroke(); x.globalAlpha = 1;
    // path stipple
    x.beginPath();
    for (const p of m.paths) {
      const len = Math.hypot(p[2] - p[0], p[3] - p[1]);
      for (let d = 0; d < len; d += 5) {
        const t = d / len, i = Math.floor(d);
        const ox = (hash(i, 3, seed) - 0.5) * 30, oy = (hash(i, 4, seed) - 0.5) * 30;
        const px = p[0] + (p[2] - p[0]) * t + ox, py = p[1] + (p[3] - p[1]) * t + oy;
        if (px < x0 - 4 || px > x0 + S + 4 || py < y0 - 4 || py > y0 + S + 4) continue;
        x.moveTo(px + 0.9, py); x.arc(px, py, 0.9, 0, TAU);
      }
    }
    x.globalAlpha = 0.6; x.fill(); x.globalAlpha = 1;
    // chapels: flagstones and an altar
    for (const g of m.graces) {
      if (!near({ x: g.x - 110, y: g.y - 110, w: 220, h: 220 }, 10)) continue;
      x.save(); x.beginPath(); x.rect(g.x - 104, g.y - 104, 208, 208); x.clip();
      x.lineWidth = 0.8; x.globalAlpha = 0.5; x.beginPath();
      for (let r = 0; r < 12; r++) {
        const yy = g.y - 104 + r * 18; x.moveTo(g.x - 104, yy); x.lineTo(g.x + 104, yy);
        for (let k = 0; k < 8; k++) { const xx = g.x - 104 + k * 28 + (r % 2) * 14 + (hash(r, k, seed) - 0.5) * 6; x.moveTo(xx, yy); x.lineTo(xx, yy + 18); }
      }
      x.stroke(); x.restore();
      x.globalAlpha = 1; x.lineWidth = 1.4;
      // nave aisle
      x.beginPath(); x.rect(g.x - 22, g.y - 92, 44, 30); x.stroke();
      x.globalAlpha = 0.7; x.beginPath();
      for (let k = 0; k < 12; k++) { x.moveTo(g.x - 20 + k * 3.6, g.y - 90); x.lineTo(g.x - 22 + k * 3.6 + 4, g.y - 64); }
      x.stroke(); x.globalAlpha = 1;
    }
    // shadows of walls and trees: hatched to the south-east
    x.lineWidth = 0.8;
    for (const w of m.walls) {
      if (!near(w, 40)) continue;
      x.save(); x.beginPath();
      x.moveTo(w.x + w.w, w.y); x.lineTo(w.x + w.w + 14, w.y + 14); x.lineTo(w.x + w.w + 14, w.y + w.h + 14); x.lineTo(w.x + 14, w.y + w.h + 14); x.lineTo(w.x, w.y + w.h); x.lineTo(w.x + w.w, w.y + w.h); x.closePath();
      x.fillStyle = INK; x.fill(); x.clip();
      x.beginPath();
      for (let k = -40; k < w.w + w.h + 40; k += 3) { x.moveTo(w.x + k, w.y); x.lineTo(w.x + k - 60, w.y + 60 + w.h); }
      x.globalAlpha = 0.35; x.strokeStyle = '#fff'; x.stroke(); x.restore(); x.globalAlpha = 1;
    }
    // walls: blocks with bright edges and cross-hatched tops
    for (const w of m.walls) {
      if (!near(w, 10)) continue;
      x.fillStyle = INK; x.fillRect(w.x, w.y, w.w, w.h);
      x.save(); x.beginPath(); x.rect(w.x, w.y, w.w, w.h); x.clip();
      x.lineWidth = 0.8; x.globalAlpha = 0.6; x.beginPath();
      // stone courses
      const horiz = w.w > w.h, L = horiz ? w.w : w.h;
      for (let k = 0; k < L; k += 14) {
        const o = (hash(k | 0, w.x | 0, seed) - 0.5) * 4;
        if (horiz) { x.moveTo(w.x + k + o, w.y); x.lineTo(w.x + k + o, w.y + w.h); } else { x.moveTo(w.x, w.y + k + o); x.lineTo(w.x + w.w, w.y + k + o); }
      }
      x.moveTo(horiz ? w.x : w.x + w.w / 2, horiz ? w.y + w.h / 2 : w.y); x.lineTo(horiz ? w.x + w.w : w.x + w.w / 2, horiz ? w.y + w.h / 2 : w.y + w.h);
      x.stroke();
      x.globalAlpha = 0.25; x.beginPath();
      for (let k = -w.h; k < w.w + w.h; k += 4) { x.moveTo(w.x + k, w.y); x.lineTo(w.x + k + w.h, w.y + w.h); }
      x.stroke(); x.restore(); x.globalAlpha = 1;
      x.lineWidth = 1.6; x.strokeRect(w.x + 0.8, w.y + 0.8, w.w - 1.6, w.h - 1.6);
      // rubble
      x.beginPath();
      for (let k = 0; k < 5; k++) {
        const rx = w.x + hash(k, w.y | 0, seed) * w.w + (hash(k, 7, seed) - 0.5) * 40, ry = w.y + hash(k, w.x | 0, seed) * w.h + (hash(k, 8, seed) - 0.5) * 40;
        const rr = 1.5 + hash(k, 9, seed) * 3; x.moveTo(rx + rr, ry); x.arc(rx, ry, rr, 0, TAU);
      }
      x.lineWidth = 1; x.stroke();
    }
    // camps: a ring of stones round a dead fire
    for (const c of m.camps) {
      if (!near(c, 60)) continue;
      x.lineWidth = 1.2; x.beginPath();
      for (let k = 0; k < 9; k++) { const a = k / 9 * TAU, rx = c.x + Math.cos(a) * 46, ry = c.y + 40 + Math.sin(a) * 18; x.moveTo(rx + 4, ry); x.ellipse(rx, ry, 4.5, 3, a, 0, TAU); }
      x.stroke();
      x.lineWidth = 1.6; x.beginPath();
      for (let k = 0; k < 5; k++) { const a = k * 1.3 + hash(k, 1, seed); x.moveTo(c.x + Math.cos(a) * 3, c.y + 40 + Math.sin(a) * 2); x.lineTo(c.x + Math.cos(a) * 22, c.y + 40 + Math.sin(a) * 9); }
      x.stroke();
      // bones
      x.lineWidth = 1.1; x.beginPath();
      for (let k = 0; k < 6; k++) {
        const bx = c.x + (hash(k, 11, c.x | 0) - 0.5) * 150, by = c.y + (hash(k, 12, c.y | 0) - 0.5) * 150, a = hash(k, 13, seed) * TAU;
        x.moveTo(bx - Math.cos(a) * 6, by - Math.sin(a) * 6); x.lineTo(bx + Math.cos(a) * 6, by + Math.sin(a) * 6);
        x.moveTo(bx + Math.cos(a) * 6 + 1.5, by + Math.sin(a) * 6); x.arc(bx + Math.cos(a) * 6, by + Math.sin(a) * 6, 1.5, 0, TAU);
      }
      x.stroke();
    }
    // trees: shadow, then a scribbled canopy
    for (const t of m.trees) {
      if (!near({ x: t.x - t.r - 20, y: t.y - t.r - 20, w: t.r * 2 + 40, h: t.r * 2 + 40 }, 0)) continue;
      const sd = t.r * 0.45;
      x.save(); x.beginPath(); x.arc(t.x + sd, t.y + sd, t.r * 1.05, 0, TAU); x.fillStyle = INK; x.fill(); x.clip();
      x.beginPath(); for (let k = -t.r * 3; k < t.r * 3; k += 3) { x.moveTo(t.x + k - t.r * 2, t.y - t.r * 2); x.lineTo(t.x + k + t.r * 2, t.y + t.r * 2); }
      x.globalAlpha = 0.3; x.lineWidth = 0.8; x.stroke(); x.restore(); x.globalAlpha = 1;
      if (t.edge || hash(t.x | 0, t.y | 0, seed) < 0.35) this.deadTree(x, t, seed);
      else this.canopy(x, t, seed);
    }
  }
  canopy(x, t, seed) {
    x.beginPath(); x.arc(t.x, t.y, t.r, 0, TAU); x.fillStyle = INK; x.fill();
    x.lineWidth = 0.9; x.beginPath();
    const n = Math.floor(t.r * 5);
    for (let k = 0; k < n; k++) {
      const a = hash(k, t.x | 0, seed) * TAU, d = Math.sqrt(hash(k, t.y | 0, seed)) * t.r * 0.95;
      const px = t.x + Math.cos(a) * d, py = t.y + Math.sin(a) * d;
      // lit from the top-left: strokes brighter there
      if ((px - t.x) + (py - t.y) > t.r * 0.5 && hash(k, 5, seed) < 0.7) continue;
      const sa = a + 1.2, L = 2 + hash(k, 6, seed) * 3;
      x.moveTo(px - Math.cos(sa) * L, py - Math.sin(sa) * L); x.lineTo(px + Math.cos(sa) * L, py + Math.sin(sa) * L);
    }
    x.globalAlpha = 0.85; x.stroke(); x.globalAlpha = 1;
    x.lineWidth = 1.2; x.beginPath();
    for (let k = 0; k <= 26; k++) { const a = k / 26 * TAU, rr = t.r * (0.92 + hash(k, 2, t.x | 0) * 0.14); k ? x.lineTo(t.x + Math.cos(a) * rr, t.y + Math.sin(a) * rr) : x.moveTo(t.x + rr, t.y); }
    x.stroke();
  }
  deadTree(x, t, seed) {
    x.lineWidth = 2.2; x.beginPath();
    const branch = (bx, by, a, L, depth) => {
      const ex = bx + Math.cos(a) * L, ey = by + Math.sin(a) * L;
      x.moveTo(bx, by); x.lineTo(ex, ey);
      if (depth > 0) { branch(ex, ey, a - 0.5, L * 0.6, depth - 1); branch(ex, ey, a + 0.45, L * 0.55, depth - 1); }
    };
    const n = 4 + Math.floor(hash(t.x | 0, 1, seed) * 3);
    for (let k = 0; k < n; k++) branch(t.x, t.y, k / n * TAU + hash(k, t.y | 0, seed), t.r * 0.6, 2);
    x.globalAlpha = 0.9; x.stroke(); x.globalAlpha = 1;
    x.beginPath(); x.arc(t.x, t.y, 4, 0, TAU); x.fill();
  }

  drawMap(ctx, cam) {
    const vw = this.w / cam.z, vh = this.h / cam.z;
    const x0 = cam.x - vw / 2, y0 = cam.y - vh / 2;
    const cx0 = Math.max(0, Math.floor(x0 / CHUNK)), cy0 = Math.max(0, Math.floor(y0 / CHUNK));
    const cx1 = Math.min(Math.ceil(WORLD / CHUNK) - 1, Math.floor((x0 + vw) / CHUNK)), cy1 = Math.min(Math.ceil(WORLD / CHUNK) - 1, Math.floor((y0 + vh) / CHUNK));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) ctx.drawImage(this.chunk(cx, cy), cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
  }
  prewarm(cam) { this.drawMap(this.dctx, cam); }

  // ------------------------------------------------ frame
  // advance the camera and effects by one sim step, and eat the step's events
  frame(g, dt, opts = {}) {
    const cam = this.cam, p = g.p;
    this.setMap(g.map);
    this.tFrame = (this.tFrame || 0) + dt;
    // camera
    const lead = opts.lead || { x: 0, y: 0 };
    let tx = p.x + lead.x, ty = p.y + lead.y;
    if (g.boss && g.boss.state !== 'enter') { tx += (g.boss.x - p.x) * 0.18; ty += (g.boss.y - p.y) * 0.18; }
    const k = Math.min(1, dt * 6);
    if (opts.snap) { cam.x = tx; cam.y = ty; } else { cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; }
    cam.shake = Math.max(0, cam.shake - dt * 3);
    for (const e of g.events) this.onEvent(e, g);
    this.fx = this.fx.filter(f => (f.t += dt) < f.d);
    p.hurtFlash = Math.max(0, (p.hurtFlash || 0) - dt * 2.5);
  }

  draw(g) {
    const { ctx, dctx, lctx, mctx, cam } = this, p = g.p, dpr = this.dpr;
    this.setMap(g.map);
    const sh = cam.shake * cam.shake * 10;
    const sx = (Math.random() - 0.5) * sh, sy = (Math.random() - 0.5) * sh;
    const setT = (c) => { c.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (this.w / 2 - (cam.x + sx) * cam.z), dpr * (this.h / 2 - (cam.y + sy) * cam.z)); };
    const W = this.cv.width, H = this.cv.height;


    // ---- the dark copy
    dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.globalCompositeOperation = 'source-over'; dctx.clearRect(0, 0, W, H);
    setT(dctx); this.drawMap(dctx, cam);
    dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.globalCompositeOperation = 'destination-over'; dctx.fillStyle = INK; dctx.fillRect(0, 0, W, H);
    dctx.globalCompositeOperation = 'multiply'; dctx.fillStyle = BLUE; dctx.fillRect(0, 0, W, H);
    dctx.globalCompositeOperation = 'source-over';

    // ---- the lit copy
    lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, W, H);
    setT(lctx); this.drawMap(lctx, cam);
    lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = 'destination-over'; lctx.fillStyle = INK; lctx.fillRect(0, 0, W, H);
    lctx.globalCompositeOperation = 'multiply';
    const pr = g.lightR();
    const scr = (x, y) => [dpr * (this.w / 2 + (x - cam.x) * cam.z), dpr * (this.h / 2 + (y - cam.y) * cam.z)];
    const [psx, psy] = scr(p.x, p.y);
    const warm = lctx.createRadialGradient(psx, psy, 0, psx, psy, pr * cam.z * dpr * 1.1);
    warm.addColorStop(0, '#fff3d6'); warm.addColorStop(0.55, CREAM); warm.addColorStop(1, '#d9a85e');
    lctx.fillStyle = warm; lctx.fillRect(0, 0, W, H);
    lctx.globalCompositeOperation = 'source-over';
    setT(lctx);
    this.drawWorldThings(lctx, g, true);

    // ---- the light mask
    mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, W, H);
    const flick = 1 + Math.sin(this.tFrame * 13) * 0.008 + Math.sin(this.tFrame * 7.3) * 0.012;
    for (const L of g.lights()) {
      const [lx, ly] = scr(L.x, L.y); const r = L.r * cam.z * dpr * (L.main ? flick : 1);
      if (lx + r < 0 || ly + r < 0 || lx - r > W || ly - r > H) continue;
      const gr = mctx.createRadialGradient(lx, ly, 0, lx, ly, r);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(L.main ? 0.72 : 0.6, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      mctx.fillStyle = gr; mctx.fillRect(lx - r, ly - r, r * 2, r * 2);
    }
    lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = 'destination-in'; lctx.drawImage(this.mask, 0, 0); lctx.globalCompositeOperation = 'source-over';

    // ---- compose
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = g.phase === 'night' || g.phase === 'dusk' ? 0.16 : 0.24; ctx.drawImage(this.dark, 0, 0); ctx.globalAlpha = 1;
    setT(ctx); this.drawWorldThings(ctx, g, false);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.lit, 0, 0);
    // a warm bloom around the lamp
    ctx.globalCompositeOperation = 'lighter';
    const bloom = ctx.createRadialGradient(psx, psy, 0, psx, psy, pr * cam.z * dpr);
    bloom.addColorStop(0, 'rgba(255,170,80,0.16)'); bloom.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = bloom; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    // things that show in any light: telegraphs, bolts, waves, effects
    setT(ctx); this.drawAlways(ctx, g);
    // the Night closing in (vignette)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    vg.addColorStop(0, 'rgba(6,6,8,0)'); vg.addColorStop(1, 'rgba(6,6,8,0.7)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (p.hurtFlash > 0) { ctx.fillStyle = `rgba(226,73,47,${p.hurtFlash * 0.25})`; ctx.fillRect(0, 0, W, H); }
    if (g.p.oil <= 0 && g.phase !== 'dawn') { ctx.fillStyle = `rgba(60,90,150,${0.1 + 0.05 * Math.sin(this.tFrame * 4)})`; ctx.fillRect(0, 0, W, H); }
    if (g.phase === 'dawn') { ctx.fillStyle = `rgba(241,228,196,${Math.max(0, 0.35 - g.phaseT * 0.08)})`; ctx.fillRect(0, 0, W, H); }
    ctx.globalAlpha = 0.6; ctx.fillStyle = this.grainPat || (this.grainPat = ctx.createPattern(this.grain, 'repeat')); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }

  onEvent(e, g) {
    const p = g.p, c = this.cam;
    switch (e.t) {
      case 'hit': c.shake = Math.max(c.shake, e.heavy ? 0.55 : 0.32); this.fx.push({ k: 'spark', x: e.x, y: e.y, t: 0, d: 0.3, a: Math.atan2(e.y - p.y, e.x - p.x), big: e.heavy }); this.fx.push({ k: 'num', x: e.x, y: e.y - 20, n: e.n, t: 0, d: 0.8 }); break;
      case 'ghost': this.fx.push({ k: 'ghost', x: e.x, y: e.y, t: 0, d: 0.5 }); break;
      case 'hurt': c.shake = Math.max(c.shake, 0.6); p.hurtFlash = 1; break;
      case 'kill': this.fx.push({ k: 'burst', x: e.x, y: e.y, t: 0, d: 0.7 }); break;
      case 'flare': c.shake = Math.max(c.shake, 0.5); this.fx.push({ k: 'flare', x: p.x, y: p.y, t: 0, d: 0.6, r: lightFor(p.oil) + 60 }); break;
      case 'slam': c.shake = Math.max(c.shake, 0.7); this.fx.push({ k: 'slam', x: e.x, y: e.y, r: e.r, t: 0, d: 0.45 }); break;
      case 'dodge': this.fx.push({ k: 'dodge', x: p.x, y: p.y, t: 0, d: 0.4 }); break;
      case 'oil': this.fx.push({ k: 'txt', x: e.x, y: e.y - 16, s: '+' + e.n + ' oil', t: 0, d: 1.2 }); break;
      case 'bossdown': c.shake = 1; this.fx.push({ k: 'burst', x: e.x, y: e.y, t: 0, d: 1.6, big: true }); break;
      case 'healed': this.fx.push({ k: 'heal', x: p.x, y: p.y, t: 0, d: 0.6 }); break;
      case 'break': this.fx.push({ k: 'txt', x: e.x, y: e.y - 50, s: 'Staggered', t: 0, d: 1.2, red: true }); break;
    }
  }

  // ------------------------------------------------ actors
  drawWorldThings(x, g, lit) {
    const t = this.tFrame;
    // grace marks
    for (const gr of g.map.graces) {
      if (!lit) continue;
      x.save(); x.translate(gr.x, gr.y);
      const pulse = 0.6 + 0.4 * Math.sin(t * 2);
      x.strokeStyle = GOLD; x.lineWidth = 2; x.globalAlpha = 0.9;
      x.beginPath(); x.moveTo(0, -20); x.lineTo(0, 16); x.moveTo(-9, -8); x.lineTo(9, -8); x.stroke();
      x.globalAlpha = 0.35 + 0.3 * pulse; x.beginPath(); x.arc(0, 0, 26 + pulse * 4, 0, TAU); x.stroke();
      x.globalAlpha = 1; x.restore();
    }
    // jars and drops
    for (const j of g.map.jars) if (!j.taken) this.jar(x, j.x, j.y, lit);
    for (const d of g.drops) this.jar(x, d.x, d.y, lit, 0.7);
    // chests
    for (const c of g.map.camps) this.chest(x, c, lit, g);
    // foes
    for (const f of g.foes) this.foe(x, f, lit, g);
    if (g.boss) this.bossDraw(x, g.boss, lit, g);
    this.player(x, g, lit);
  }

  jar(x, px, py, lit, s = 1) {
    x.save(); x.translate(px, py); x.scale(s, s);
    if (!lit) { x.restore(); return; }
    x.fillStyle = INK; x.strokeStyle = GOLD; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(-6, -8); x.lineTo(6, -8); x.lineTo(9, 2); x.quadraticCurveTo(9, 10, 0, 10); x.quadraticCurveTo(-9, 10, -9, 2); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(-4, -12); x.lineTo(4, -12); x.lineTo(4, -8); x.moveTo(-4, -12); x.lineTo(-4, -8); x.stroke();
    x.beginPath(); for (let k = -6; k < 8; k += 2.5) { x.moveTo(k, 2); x.lineTo(k + 2, 8); } x.lineWidth = 0.8; x.stroke();
    x.restore();
  }
  chest(x, c, lit, g) {
    if (!lit) return;
    x.save(); x.translate(c.x, c.y);
    x.fillStyle = INK; x.strokeStyle = c.opened ? 'rgba(241,228,196,.45)' : CREAM; x.lineWidth = 1.6;
    x.fillRect(-16, -10, 32, 20); x.strokeRect(-16, -10, 32, 20);
    x.beginPath(); x.moveTo(-16, -3); x.lineTo(16, -3); x.moveTo(-6, -10); x.lineTo(-6, 10); x.moveTo(6, -10); x.lineTo(6, 10); x.stroke();
    if (c.cleared && !c.opened) {
      x.strokeStyle = GOLD; x.globalAlpha = 0.5 + 0.5 * Math.sin(this.tFrame * 5); x.beginPath(); x.arc(0, 0, 24, 0, TAU); x.stroke(); x.globalAlpha = 1;
    }
    if (c.opened) { x.beginPath(); x.moveTo(-16, -10); x.lineTo(-12, -20); x.lineTo(20, -20); x.lineTo(16, -10); x.stroke(); }
    x.restore();
  }

  eyes(x, f, r, col, glow = 6) {
    x.save(); x.translate(f.x, f.y); x.rotate(f.face);
    x.shadowColor = col; x.shadowBlur = glow; x.fillStyle = col;
    const e = r * 0.55;
    x.beginPath(); x.ellipse(e, -r * 0.32, 2.4, 1.4, 0.3, 0, TAU); x.ellipse(e, r * 0.32, 2.4, 1.4, -0.3, 0, TAU); x.fill();
    x.restore();
  }

  foe(x, f, lit, g) {
    const t = this.tFrame;
    const alpha = f.dying !== undefined ? Math.max(0, f.dying) : 1;
    x.globalAlpha = alpha;
    if (!lit) {
      // in the dark, only eyes and a faint ragged edge
      x.strokeStyle = 'rgba(125,152,196,.35)'; x.lineWidth = 1;
      x.beginPath(); x.arc(f.x, f.y, f.r, 0, TAU); x.stroke();
      this.eyes(x, f, f.r, ICE, 8);
      x.globalAlpha = 1; return;
    }
    x.save(); x.translate(f.x, f.y);
    const wind = f.state === 'wind';
    const col = f.flash > 0 ? '#fff' : CREAM;
    x.strokeStyle = col; x.fillStyle = INK; x.lineWidth = 1.3;
    x.rotate(f.face);
    const T = f.type;
    if (T === 'shade' || T === 'dummy') {
      // ragged cloak: radial scratches
      x.beginPath(); x.arc(0, 0, f.r, 0, TAU); x.fill();
      x.beginPath();
      for (let k = 0; k < 22; k++) { const a = k / 22 * TAU + Math.sin(t * 3 + k) * 0.05, r0 = f.r * 0.35, r1 = f.r * (1.05 + 0.25 * ((k * 7) % 3) / 2); if (Math.cos(a) > 0.6) continue; x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); x.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); }
      x.stroke();
      // arms
      const reach = wind ? -0.6 : f.state === 'strike' ? 1.1 : 0;
      x.lineWidth = 2; x.beginPath(); x.moveTo(2, -f.r * 0.7); x.lineTo(f.r * (0.9 + reach * 0.3), -f.r * (1 - reach * 0.6)); x.moveTo(2, f.r * 0.7); x.lineTo(f.r * (0.9 + reach * 0.3), f.r * (1 - reach * 0.6)); x.stroke();
    } else if (T === 'hound' || T === 'moth') {
      if (T === 'moth') {
        const fl = Math.sin(t * 30 + f.id) * 0.5;
        x.beginPath(); for (const s of [-1, 1]) { x.moveTo(0, 0); x.quadraticCurveTo(-8, s * (12 + fl * 6), -2, s * (14 + fl * 4)); x.quadraticCurveTo(6, s * 8, 0, 0); } x.fill(); x.stroke();
        x.beginPath(); x.moveTo(-6, 0); x.lineTo(6, 0); x.stroke();
      } else {
        x.beginPath(); x.ellipse(-2, 0, f.r * 1.5, f.r * 0.75, 0, 0, TAU); x.fill();
        x.beginPath();
        for (let k = 0; k < 16; k++) { const xx = -f.r * 1.3 + k * f.r * 0.17; x.moveTo(xx, -f.r * 0.7); x.lineTo(xx - 4, -f.r * 1.05); x.moveTo(xx, f.r * 0.7); x.lineTo(xx - 4, f.r * 1.05); }
        x.stroke();
        x.beginPath(); x.ellipse(-2, 0, f.r * 1.5, f.r * 0.75, 0, 0, TAU); x.stroke();
        x.beginPath(); x.moveTo(-f.r * 1.5, 0); x.lineTo(-f.r * 2.3, Math.sin(t * 8 + f.id) * 4); x.stroke();
      }
    } else if (T === 'wisp') {
      x.rotate(-f.face);
      x.beginPath();
      for (let k = 0; k < 3; k++) { const r = f.r * (1 - k * 0.3); for (let a = 0; a < TAU * 1.2; a += 0.3) { const rr = r * (1 - a / (TAU * 1.4)); const px = Math.cos(a + t * 3 + k) * rr, py = Math.sin(a + t * 3 + k) * rr - (1 - rr / r) * 6; a ? x.lineTo(px, py) : x.moveTo(px, py); } }
      x.strokeStyle = wind ? ICE : col; x.stroke();
      if (wind) { x.fillStyle = ICE; x.globalAlpha = alpha * Math.min(1, f.st / 0.8); x.beginPath(); x.arc(0, 0, 5 + f.st * 6, 0, TAU); x.fill(); x.globalAlpha = alpha; }
      x.rotate(f.face);
    } else if (T === 'brute') {
      x.beginPath(); x.ellipse(0, 0, f.r * 0.9, f.r * 1.15, 0, 0, TAU); x.fill(); x.stroke();
      x.beginPath(); for (let k = -f.r; k < f.r; k += 3) { x.moveTo(-f.r * 0.6, k); x.lineTo(f.r * 0.2, k + 6); } x.globalAlpha = alpha * 0.5; x.stroke(); x.globalAlpha = alpha;
      // the swallowed lamp in its jaw
      x.fillStyle = EMBER; x.shadowColor = EMBER; x.shadowBlur = 10; x.beginPath(); x.arc(f.r * 0.6, 0, 4, 0, TAU); x.fill(); x.shadowBlur = 0;
      x.lineWidth = 3; x.beginPath(); const up = wind ? -f.r * 0.6 : 0; x.moveTo(0, -f.r); x.lineTo(f.r * 0.9 + up * 0.2, -f.r * 1.2 + up); x.moveTo(0, f.r); x.lineTo(f.r * 0.9 + up * 0.2, f.r * 1.2 - up); x.stroke();
    }
    x.restore();
    if (T !== 'wisp' && T !== 'brute') this.eyes(x, f, f.r, wind ? RED : GOLD, 4);
    // hp sliver when hurt
    if (f.hp < f.maxHp && f.type !== 'moth') {
      const w = f.r * 2; x.fillStyle = 'rgba(6,6,8,.8)'; x.fillRect(f.x - w / 2, f.y - f.r - 12, w, 3);
      x.fillStyle = RED; x.fillRect(f.x - w / 2, f.y - f.r - 12, w * Math.max(0, f.hp / f.maxHp), 3);
    }
    if (f.burn > 0) { x.fillStyle = EMBER; for (let k = 0; k < 3; k++) { const a = t * 6 + k * 2; x.fillRect(f.x + Math.cos(a) * f.r * 0.6, f.y - Math.abs(Math.sin(a * 1.3)) * f.r, 2, 2); } }
    x.globalAlpha = 1;
  }

  bossDraw(x, b, lit, g) {
    const t = this.tFrame;
    const enter = b.state === 'enter' ? Math.min(1, b.st / 1.6) : 1;
    if (!lit) {
      x.globalAlpha = 0.5 * enter; x.strokeStyle = BLUE; x.lineWidth = 1.5;
      x.beginPath(); x.arc(b.x, b.y, b.r, 0, TAU); x.stroke(); x.globalAlpha = enter;
      this.eyes(x, b, b.r, ICE, 12); x.globalAlpha = 1; return;
    }
    x.save(); x.translate(b.x, b.y); x.rotate(b.face);
    x.globalAlpha = enter;
    const col = b.flash > 0 ? '#fff' : CREAM;
    x.strokeStyle = col; x.fillStyle = INK; x.lineWidth = 1.6;
    if (b.id === 'ringer') {
      x.beginPath(); x.arc(0, 0, b.r, 0, TAU); x.fill();
      x.beginPath(); for (let k = 0; k < 40; k++) { const a = k / 40 * TAU; if (Math.cos(a) > 0.7) continue; x.moveTo(Math.cos(a) * b.r * 0.4, Math.sin(a) * b.r * 0.4); x.lineTo(Math.cos(a) * b.r * 1.15, Math.sin(a) * b.r * 1.15); } x.stroke();
      // the bell, held forward
      const sw = b.move === 'sweep' && b.tele ? -b.tele.k * 1.2 : 0;
      x.save(); x.rotate(sw); x.translate(b.r * 1.1, 0);
      x.beginPath(); x.arc(0, 0, 16, 0, TAU); x.fill(); x.stroke(); x.beginPath(); x.arc(0, 0, 10, 0, TAU); x.stroke(); x.beginPath(); x.arc(0, 0, 4, 0, TAU); x.stroke();
      x.restore();
    } else if (b.id === 'mother') {
      const fl = Math.sin(t * 9) * 0.25;
      for (const s of [-1, 1]) {
        x.beginPath(); x.moveTo(4, 0); x.bezierCurveTo(-10, s * (b.r * 2.2 + fl * 20), -b.r * 1.6, s * b.r * 1.6, -b.r * 0.6, s * 6); x.closePath(); x.fill(); x.stroke();
        x.beginPath(); for (let k = 1; k < 7; k++) { x.moveTo(0, s * 4); x.lineTo(-k * b.r * 0.2, s * (b.r * (1.6 - Math.abs(k - 3) * 0.15) + fl * 10)); } x.lineWidth = 0.8; x.stroke(); x.lineWidth = 1.6;
        x.beginPath(); x.arc(-b.r * 0.4, s * b.r * 0.9, 6, 0, TAU); x.stroke();
      }
      x.beginPath(); x.ellipse(0, 0, b.r * 0.8, b.r * 0.35, 0, 0, TAU); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(b.r * 0.7, -4); x.quadraticCurveTo(b.r * 1.4, -16, b.r * 1.6, -8); x.moveTo(b.r * 0.7, 4); x.quadraticCurveTo(b.r * 1.4, 16, b.r * 1.6, 8); x.stroke();
    } else {
      x.beginPath(); x.arc(0, 0, b.r, 0, TAU); x.fill();
      x.beginPath(); for (let k = 0; k < 14; k++) { const a = k / 14 * TAU + t * 0.3; x.moveTo(Math.cos(a) * b.r * 0.9, Math.sin(a) * b.r * 0.9); x.lineTo(Math.cos(a + 0.1) * b.r * 1.5, Math.sin(a + 0.1) * b.r * 1.5); } x.stroke();
      x.beginPath(); x.arc(0, 0, b.r, 0, TAU); x.stroke();
      x.beginPath(); for (let k = 0; k < 30; k++) { const a = k / 30 * TAU; x.moveTo(Math.cos(a) * b.r * 0.3, Math.sin(a) * b.r * 0.3); x.lineTo(Math.cos(a) * b.r * 0.8, Math.sin(a) * b.r * 0.8); } x.globalAlpha = 0.5 * enter; x.stroke(); x.globalAlpha = enter;
      // crown
      x.strokeStyle = GOLD; x.beginPath(); for (let k = 0; k < 7; k++) { const a = -0.9 + k * 0.3; x.moveTo(Math.cos(a) * b.r * 0.5, Math.sin(a) * b.r * 0.5); x.lineTo(Math.cos(a) * b.r * 0.75 - 6, Math.sin(a) * b.r * 0.75); } x.stroke();
    }
    x.restore();
    x.globalAlpha = enter; this.eyes(x, b, b.r * 0.8, b.move ? RED : GOLD, 8); x.globalAlpha = 1;
  }

  player(x, g, lit) {
    const p = g.p, t = this.tFrame, a = p.act;
    if (p.hp <= 0 && g.phase === 'dead') {
      if (!lit) return;
      x.save(); x.translate(p.x, p.y); x.strokeStyle = CREAM; x.lineWidth = 1.3; x.beginPath(); x.ellipse(0, 0, 16, 8, 0.4, 0, TAU); x.stroke(); x.restore(); return;
    }
    if (!lit) return; // always in its own light
    x.save(); x.translate(p.x, p.y);
    const blink = p.inv > 0 && Math.floor(t * 20) % 2 === 0;
    x.globalAlpha = blink ? 0.5 : 1;
    let sq = 1;
    if (a && a.type === 'roll') sq = 0.75;
    x.rotate(p.face);
    // weapon swing slash
    const W = WEAPONS[p.weapon];
    if (a && (a.type === 'light' || a.type === 'heavy') && a.t >= a.wind) {
      const k = Math.min(1, (a.t - a.wind) / a.actT), fade = Math.max(0, 1 - (a.t - a.wind - a.actT) / 0.12);
      if (fade > 0) {
        x.strokeStyle = a.type === 'heavy' ? GOLD : CREAM; x.globalAlpha = fade * 0.95;
        const r = a.reach + p.r * 0.5;
        if (a.arc < 1) {
          x.lineWidth = a.type === 'heavy' ? 5 : 3; x.beginPath(); x.moveTo(p.r, 0); x.lineTo(r * (0.6 + 0.4 * k), 0); x.stroke();
          x.lineWidth = 1; x.beginPath(); for (let i = -2; i <= 2; i++) { x.moveTo(p.r, i * 2); x.lineTo(r * k, i * 3); } x.stroke();
        } else {
          const a0 = -a.arc / 2, a1 = a0 + a.arc * k;
          for (let i = 0; i < 6; i++) { x.lineWidth = (a.type === 'heavy' ? 2.2 : 1.4) * (1 - i / 7); x.beginPath(); x.arc(0, 0, r - i * 3.5, a0, a1); x.stroke(); }
        }
        x.globalAlpha = blink ? 0.5 : 1;
      }
    }
    // charge glow
    if (a && a.type === 'charge' && a.t > 0.18) {
      const k = Math.min(1, (a.t - 0.18) / (a.max - 0.18));
      x.strokeStyle = GOLD; x.lineWidth = 2; x.globalAlpha = 0.4 + 0.6 * k;
      x.beginPath(); x.arc(0, 0, p.r + 8 + 10 * (1 - k), -1.2, 1.2); x.stroke(); x.globalAlpha = 1;
      if (k >= 1) { x.beginPath(); x.arc(0, 0, p.r + 8, 0, TAU); x.stroke(); }
    }
    x.scale(1, sq);
    // cloak: black, with a hood seen from above
    x.fillStyle = INK; x.strokeStyle = CREAM; x.lineWidth = 1.5;
    x.beginPath(); x.ellipse(-1, 0, p.r * 0.95, p.r * 1.15, 0, 0, TAU); x.fill(); x.stroke();
    x.lineWidth = 0.9; x.beginPath();
    for (let k = 0; k < 10; k++) { const yy = -p.r + k * p.r * 0.22; x.moveTo(-p.r * 0.9, yy); x.lineTo(-p.r * 0.2, yy + 2); }
    x.stroke();
    x.lineWidth = 1.5; x.beginPath(); x.ellipse(2, 0, p.r * 0.5, p.r * 0.55, 0, 0, TAU); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(p.r * 0.3, -p.r * 0.35); x.quadraticCurveTo(p.r * 0.9, 0, p.r * 0.3, p.r * 0.35); x.stroke();
    // weapon at rest on the right
    if (!a || a.type === 'charge' || a.type === 'drink' || a.type === 'roll' || a.type === 'flare') {
      x.strokeStyle = CREAM; x.lineWidth = 2;
      const L = W.light.reach * 0.55;
      x.beginPath(); x.moveTo(p.r * 0.3, p.r * 0.8); x.lineTo(p.r * 0.3 + L, p.r * 0.9 + (a && a.type === 'charge' ? -4 : 2)); x.stroke();
    }
    // the lantern, on the left
    const sway = Math.sin(t * 5) * 1.5;
    x.translate(p.r * 0.4, -p.r * 1.05 + sway * 0.3);
    x.shadowColor = EMBER; x.shadowBlur = 14;
    x.fillStyle = p.oil > 0 ? '#ffd27a' : '#6a7fa8';
    x.beginPath(); x.rect(-3.5, -3.5, 7, 7); x.fill();
    x.shadowBlur = 0; x.strokeStyle = INK; x.lineWidth = 1; x.beginPath(); x.moveTo(0, -3.5); x.lineTo(0, 3.5); x.moveTo(-3.5, 0); x.lineTo(3.5, 0); x.stroke();
    x.restore();
    x.globalAlpha = 1;
    // drinking
    if (a && a.type === 'drink') { x.fillStyle = EMBER; x.globalAlpha = 0.8; x.beginPath(); x.arc(p.x, p.y - p.r - 10, 3 + Math.sin(a.t * 20), 0, TAU); x.fill(); x.globalAlpha = 1; }
  }

  // ------------------------------------------------ always visible
  drawAlways(x, g) {
    const t = this.tFrame;
    // foe telegraphs: shown even in the dark, so you're never hit by nothing
    for (const f of g.foes) {
      if (f.state !== 'wind' || f.dying !== undefined) continue;
      x.save(); x.translate(f.x, f.y); x.rotate(f.face);
      const k = Math.min(1, f.st / (f.type === 'brute' ? 0.9 : f.type === 'wisp' ? 0.8 : f.tut ? 0.75 : 0.5));
      x.strokeStyle = RED; x.fillStyle = RED;
      if (f.type === 'shade' || f.type === 'dummy') this.teleArc(x, 56, 1.9, k);
      else if (f.type === 'hound' || f.type === 'moth') this.teleLine(x, (f.type === 'moth' ? 380 : 430) * 0.3, f.r * 2, k);
      x.restore();
      if (f.type === 'brute' && f.tx != null) this.teleCircle(x, f.tx, f.ty, 70, k);
    }
    const b = g.boss;
    if (b && b.tele) {
      const T = b.tele;
      x.strokeStyle = RED; x.fillStyle = RED;
      if (T.kind === 'arc') { x.save(); x.translate(b.x, b.y); x.rotate(b.face); this.teleArc(x, T.reach, T.arc, T.k); x.restore(); }
      if (T.kind === 'line') { x.save(); x.translate(b.x, b.y); x.rotate(b.face); this.teleLine(x, T.len, T.w, T.k); x.restore(); }
      if (T.kind === 'circle') this.teleCircle(x, T.x, T.y, T.r, T.k);
      if (T.kind === 'ring') { x.lineWidth = 3; x.globalAlpha = 0.4 + 0.6 * T.k; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(b.x, b.y, b.r + 8 + i * 10 * (1 - T.k), 0, TAU); x.stroke(); } x.globalAlpha = 1; }
      if (T.kind === 'glow') { x.fillStyle = ICE; x.globalAlpha = 0.25 + 0.5 * T.k; x.beginPath(); x.arc(b.x, b.y, b.r * (1 + T.k * 0.4), 0, TAU); x.fill(); x.globalAlpha = 1; }
      if (T.kind === 'eclipse') { x.strokeStyle = BLUE; x.lineWidth = 4; x.globalAlpha = T.k; x.beginPath(); x.arc(g.p.x, g.p.y, g.lightR() * (1.1 - T.k * 0.4), 0, TAU); x.stroke(); x.globalAlpha = 1; }
    }
    // waves
    for (const w of g.waves) {
      x.strokeStyle = RED; x.lineWidth = w.th; x.globalAlpha = 0.45; x.beginPath(); x.arc(w.x, w.y, w.cur || w.r0, 0, TAU); x.stroke();
      x.lineWidth = 2; x.globalAlpha = 1; x.strokeStyle = '#ffd9cf'; x.beginPath(); x.arc(w.x, w.y, w.cur || w.r0, 0, TAU); x.stroke();
    }
    // bolts
    for (const s of g.shots) {
      x.fillStyle = ICE; x.shadowColor = ICE; x.shadowBlur = 12;
      x.beginPath(); x.arc(s.x, s.y, s.r * 0.8, 0, TAU); x.fill();
      x.shadowBlur = 0; x.strokeStyle = ICE; x.lineWidth = 1.5; x.globalAlpha = 0.5;
      x.beginPath(); x.moveTo(s.x, s.y); x.lineTo(s.x - s.vx * 0.06, s.y - s.vy * 0.06); x.stroke(); x.globalAlpha = 1;
    }
    // effects
    for (const f of this.fx) {
      const k = f.t / f.d;
      if (f.k === 'spark') {
        x.strokeStyle = f.big ? GOLD : '#fff'; x.lineWidth = 1.5; x.globalAlpha = 1 - k; x.beginPath();
        for (let i = 0; i < (f.big ? 9 : 5); i++) { const a = f.a + (i - 3) * 0.35, r0 = 6 + k * 20, r1 = r0 + 10 * (1 - k); x.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0); x.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1); }
        x.stroke(); x.globalAlpha = 1;
      } else if (f.k === 'ghost') {
        x.strokeStyle = BLUE; x.globalAlpha = 1 - k; x.lineWidth = 1; x.beginPath(); x.arc(f.x, f.y, 10 + k * 20, 0, TAU); x.stroke(); x.globalAlpha = 1;
        x.font = '600 13px "Alegreya SC", serif'; x.fillStyle = ICE; x.globalAlpha = 1 - k; x.textAlign = 'center'; x.fillText('passes through', f.x, f.y - 22 - k * 10); x.globalAlpha = 1;
      } else if (f.k === 'burst') {
        x.strokeStyle = CREAM; x.globalAlpha = 1 - k; x.lineWidth = 1.2; x.beginPath();
        const n = f.big ? 40 : 18;
        for (let i = 0; i < n; i++) { const a = i / n * TAU + i, r0 = (f.big ? 20 : 6) + k * (f.big ? 120 : 40); x.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0); x.lineTo(f.x + Math.cos(a) * (r0 + 6), f.y + Math.sin(a) * (r0 + 6)); }
        x.stroke(); x.globalAlpha = 1;
      } else if (f.k === 'flare') {
        x.strokeStyle = GOLD; x.lineWidth = 6 * (1 - k); x.globalAlpha = 1 - k; x.beginPath(); x.arc(f.x, f.y, f.r * (0.3 + 0.7 * Math.sqrt(k)), 0, TAU); x.stroke(); x.globalAlpha = 1;
      } else if (f.k === 'slam') {
        x.strokeStyle = CREAM; x.lineWidth = 3 * (1 - k); x.globalAlpha = 1 - k; x.beginPath(); x.arc(f.x, f.y, f.r * (0.6 + 0.5 * k), 0, TAU); x.stroke();
        x.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; x.moveTo(f.x + Math.cos(a) * f.r * 0.3, f.y + Math.sin(a) * f.r * 0.3); x.lineTo(f.x + Math.cos(a) * f.r * (0.5 + k * 0.6), f.y + Math.sin(a) * f.r * (0.5 + k * 0.6)); } x.lineWidth = 1; x.stroke(); x.globalAlpha = 1;
      } else if (f.k === 'dodge') {
        x.strokeStyle = GOLD; x.globalAlpha = 1 - k; x.lineWidth = 1.5; x.beginPath(); x.arc(f.x, f.y, 16 + k * 18, 0, TAU); x.stroke(); x.globalAlpha = 1;
      } else if (f.k === 'heal') {
        x.strokeStyle = EMBER; x.globalAlpha = 1 - k; x.lineWidth = 1.5; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; x.moveTo(f.x + Math.cos(a) * 14, f.y + Math.sin(a) * 14 - k * 20); x.lineTo(f.x + Math.cos(a) * 14, f.y + Math.sin(a) * 14 - k * 20 - 6); } x.stroke(); x.globalAlpha = 1;
      } else if (f.k === 'num' || f.k === 'txt') {
        x.font = f.k === 'num' ? '700 15px Alegreya, serif' : '600 14px "Alegreya SC", serif'; x.textAlign = 'center';
        x.globalAlpha = 1 - k * k; x.fillStyle = f.red ? RED : f.k === 'num' ? '#fff' : GOLD;
        x.lineWidth = 3; x.strokeStyle = INK; const yy = f.y - k * 24;
        x.strokeText(f.k === 'num' ? f.n : f.s, f.x, yy); x.fillText(f.k === 'num' ? f.n : f.s, f.x, yy); x.globalAlpha = 1;
      }
    }
  }
  teleArc(x, reach, arc, k) {
    x.globalAlpha = 0.18 + 0.3 * k; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, reach, -arc / 2, arc / 2); x.closePath(); x.fill();
    x.globalAlpha = 0.9; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, reach * (0.3 + 0.7 * k), -arc / 2, arc / 2); x.stroke(); x.globalAlpha = 1;
  }
  teleLine(x, len, w, k) {
    x.globalAlpha = 0.16 + 0.3 * k; x.fillRect(0, -w / 2, len, w);
    x.globalAlpha = 0.9; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -w / 2); x.lineTo(len * k, -w / 2); x.moveTo(0, w / 2); x.lineTo(len * k, w / 2); x.stroke(); x.globalAlpha = 1;
  }
  teleCircle(x, cx, cy, r, k) {
    x.strokeStyle = RED; x.fillStyle = RED;
    x.globalAlpha = 0.14 + 0.25 * k; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
    x.globalAlpha = 0.9; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke();
    x.beginPath(); x.arc(cx, cy, r * k, 0, TAU); x.stroke(); x.globalAlpha = 1;
  }

  // screen position of a world point (for edge markers)
  toScreen(x, y) { const c = this.cam; return [this.w / 2 + (x - c.x) * c.z, this.h / 2 + (y - c.y) * c.z]; }
}
