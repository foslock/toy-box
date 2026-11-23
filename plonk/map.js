// The tourist map: baked once, then panned and zoomed. Towns are labelled in their own scripts.
import { GW, GH, CELL, KMW, KMH, COUNTRIES, BIOMES } from './world.js';
import { drawWord, wordWidth } from './script.js';

const PX = 4; // bake pixels per cell
const INK = '#2a2f3a';

function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

export function bakeMap(atlas) {
  const { world } = atlas;
  const W = GW * PX, H = GH * PX;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const im = g.createImageData(W, H);
  const d = im.data;
  const kpp = CELL / PX; // km per pixel
  const country = new Uint8Array(W * H);
  const hgt = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const kx = (x + 0.5) * kpp, ky = (y + 0.5) * kpp;
    hgt[y * W + x] = world.heightAt(kx, ky);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) country[y * W + x] = hgt[y * W + x] > -400 ? world.countryAt((x + 0.5) * kpp, (y + 0.5) * kpp) : 0;

  const tints = COUNTRIES.map((c) => hex(c.tint));
  const bands = [[250, hex('#ece6cc')], [700, hex('#e2d8b4')], [1400, hex('#d4c49c')], [2150, hex('#c2aa84')], [1e9, hex('#f5f2ea')]];
  const sea = hex('#b9d0d2'), seaLine = hex('#a3c0c4'), ink = hex(INK), border = hex('#7c3b34');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, h = hgt[i];
    let r, gg, b;
    if (h <= 0) {
      const cd = world.dist[Math.floor(y / PX) * GW + Math.floor(x / PX)];
      // ripple lines that follow the coast
      const dd = Math.min(...[[0, 0], [1, 0], [0, 1]].map(() => cd));
      [r, gg, b] = (cd === 2 || cd === 5) && (x + y) % 3 !== 0 ? seaLine : sea;
      void dd;
    } else {
      let col = bands[0][1];
      for (const [lim, c] of bands) { if (h < lim) { col = c; break; } }
      const t = h > 2150 ? 0.08 : 0.32;
      const ti = tints[country[i]];
      r = col[0] * (1 - t) + ti[0] * t; gg = col[1] * (1 - t) + ti[1] * t; b = col[2] * (1 - t) + ti[2] * t;
      // hillshade, light from the north-west, in three flat steps
      const hx = (hgt[i + 1] ?? h) - (hgt[i - 1] ?? h), hy = (hgt[i + W] ?? h) - (hgt[i - W] ?? h);
      const s = (-hx - hy) / (kpp * 1000) * 2.2;
      const k = s > 0.08 ? 1.06 : s < -0.08 ? 0.86 : s < -0.025 ? 0.93 : 1;
      r *= k; gg *= k; b *= k;
      // coast line
      if (hgt[i + 1] <= 0 || hgt[i - 1] <= 0 || hgt[i + W] <= 0 || hgt[i - W] <= 0) [r, gg, b] = ink;
      // borders, dashed
      else if ((country[i + 1] !== undefined && country[i + 1] !== country[i] && hgt[i + 1] > 0) || (country[i + W] !== undefined && country[i + W] !== country[i] && hgt[i + W] > 0)) {
        if (((x + y) >> 2) % 3 !== 2) [r, gg, b] = border;
      }
    }
    d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
  }
  // thicken borders a touch
  g.putImageData(im, 0, 0);
  // map symbols for the land cover
  let s = 12345;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 4; y < H - 4; y += 9) for (let x = 4; x < W - 4; x += 9) {
    const jx = x + (rnd() - 0.5) * 6, jy = y + (rnd() - 0.5) * 6;
    const kx = jx * kpp, ky = jy * kpp;
    const i = Math.floor(jy) * W + Math.floor(jx);
    if (hgt[i] <= 0) continue;
    const b = BIOMES[world.B[Math.floor(jy / PX) * GW + Math.floor(jx / PX)]];
    void kx; void ky;
    g.globalAlpha = 0.55;
    if (b === 'taiga' || (b === 'alpine' && rnd() < 0.15)) { g.fillStyle = '#4d6a55'; g.beginPath(); g.moveTo(jx, jy - 3.5); g.lineTo(jx + 2.2, jy + 1.5); g.lineTo(jx - 2.2, jy + 1.5); g.fill(); }
    else if (b === 'forest' || b === 'fog') { if (rnd() < 0.8) { g.fillStyle = '#5f845a'; g.beginPath(); g.arc(jx, jy, 2, 0, 6.3); g.fill(); } }
    else if (b === 'palms') { g.strokeStyle = '#3f7a54'; g.lineWidth = 1; g.beginPath(); g.moveTo(jx, jy + 2); g.lineTo(jx, jy - 2); g.moveTo(jx - 2.5, jy - 1); g.quadraticCurveTo(jx, jy - 4, jx + 2.5, jy - 1); g.stroke(); }
    else if (b === 'desert') { g.fillStyle = '#b08a5a'; for (let k = 0; k < 3; k++) g.fillRect(jx + (rnd() - 0.5) * 6, jy + (rnd() - 0.5) * 6, 1, 1); }
    else if (b === 'steppe' || b === 'savanna') { if (rnd() < 0.6) { g.strokeStyle = '#9a8a55'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(jx - 2, jy + 1); g.lineTo(jx - 1, jy - 1.5); g.lineTo(jx, jy + 1); g.lineTo(jx + 1, jy - 1.5); g.lineTo(jx + 2, jy + 1); g.stroke(); } }
    else if (b === 'scrub') { if (rnd() < 0.6) { g.fillStyle = '#7f8a5a'; g.fillRect(jx - 1, jy - 1, 2, 2); } }
    else if (b === 'tundra') { if (rnd() < 0.5) { g.strokeStyle = '#8c8c78'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(jx - 2, jy); g.lineTo(jx + 2, jy); g.stroke(); } }
    g.globalAlpha = 1;
  }
  // country label anchors: the middle of each country's land
  const sums = COUNTRIES.map(() => [0, 0, 0]);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x; if (world.H[i] <= 0) continue;
    const c = world.C[i]; sums[c][0] += x; sums[c][1] += y; sums[c][2]++;
  }
  const centres = sums.map(([sx, sy, n]) => [(sx / n + 0.5) * CELL, (sy / n + 0.5) * CELL]);
  return { canvas: cv, scale: PX / CELL, centres };
}

export class MapView {
  constructor(canvas, atlas, baked) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.atlas = atlas; this.baked = baked;
    this.cam = { x: KMW / 2, y: KMH / 2, z: 0.5 };
    this.pin = null; this.truth = null; this.extra = []; this.highlight = null;
    this.pointers = new Map(); this.onTap = null; this.dirty = true;
    this.minZ = 0.3; this.maxZ = 6;
    this.size();
    this.fit();
    this.bind();
  }
  size() {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr));
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; this.dirty = true; }
    this.dpr = dpr; this.w = r.width; this.h = r.height;
    const was = this.cam && this.cam.z <= (this.minZ || 0) * 1.01;
    this.minZ = Math.min(this.w / KMW, this.h / KMH) * 0.92;
    this.maxZ = this.minZ * 9;
    if (was) this.cam.z = this.minZ;
    this.clamp();
  }
  fit() {
    // tall screens start a little closer in, so the continent (land spans ~30-1290 km) fills the width without losing a coast
    const tall = this.h > this.w * 1.2;
    const z = tall ? Math.max(this.minZ, this.w / (KMW * 0.965)) : this.minZ;
    this.cam = { x: KMW * (tall ? 0.5 : 0.47), y: KMH / 2, z }; this.clamp(); this.dirty = true;
  }
  frame(points, pad = 60, inset = { r: 0, b: 0 }) {
    // fit a set of km points into the part of the map not covered by a card
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const vw = Math.max(120, this.w - inset.r), vh = Math.max(120, this.h - inset.b);
    const z = Math.min((vw - pad * 2) / Math.max(60, x1 - x0), (vh - pad * 2) / Math.max(60, y1 - y0));
    const zz = Math.max(this.minZ, Math.min(this.maxZ * 0.4, z));
    this.cam = { x: (x0 + x1) / 2 + inset.r / 2 / zz, y: (y0 + y1) / 2 + inset.b / 2 / zz, z: zz };
    this.dirty = true;
  }
  clamp() {
    const c = this.cam;
    c.z = Math.max(this.minZ, Math.min(this.maxZ, c.z));
    const hw = this.w / 2 / c.z, hh = this.h / 2 / c.z;
    c.x = hw * 2 >= KMW ? KMW / 2 : Math.max(hw, Math.min(KMW - hw, c.x));
    c.y = hh * 2 >= KMH ? KMH / 2 : Math.max(hh, Math.min(KMH - hh, c.y));
  }
  toScreen(kx, ky) { const c = this.cam; return [(kx - c.x) * c.z + this.w / 2, (ky - c.y) * c.z + this.h / 2]; }
  toKm(sx, sy) { const c = this.cam; return [(sx - this.w / 2) / c.z + c.x, (sy - this.h / 2) / c.z + c.y]; }
  zoomAt(sx, sy, k) {
    const [kx, ky] = this.toKm(sx, sy);
    this.cam.z *= k; this.clamp();
    const [nx, ny] = this.toKm(sx, sy);
    this.cam.x += kx - nx; this.cam.y += ky - ny; this.clamp(); this.dirty = true;
  }
  bind() {
    const cv = this.cv;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => {
      if (this.locked) return;
      cv.setPointerCapture(e.pointerId);
      const p = pos(e);
      this.pointers.set(e.pointerId, { p, start: p, t: performance.now() });
      if (this.pointers.size === 1) this.moved = false;
      if (this.pointers.size === 2) { this.moved = true; this.pinch = this.pinchState(); }
    });
    cv.addEventListener('pointermove', (e) => {
      const pt = this.pointers.get(e.pointerId); if (!pt) return;
      const p = pos(e);
      if (this.pointers.size === 1) {
        if (!this.moved && Math.hypot(p[0] - pt.start[0], p[1] - pt.start[1]) > 7) this.moved = true;
        if (this.moved) { this.cam.x -= (p[0] - pt.p[0]) / this.cam.z; this.cam.y -= (p[1] - pt.p[1]) / this.cam.z; this.clamp(); this.dirty = true; }
        pt.p = p;
      } else if (this.pointers.size === 2) {
        pt.p = p;
        const now = this.pinchState();
        if (this.pinch) {
          const k = now.d / Math.max(1, this.pinch.d);
          this.zoomAt(this.pinch.c[0], this.pinch.c[1], k);
          this.cam.x -= (now.c[0] - this.pinch.c[0]) / this.cam.z; this.cam.y -= (now.c[1] - this.pinch.c[1]) / this.cam.z; this.clamp();
        }
        this.pinch = now; this.dirty = true;
      }
    });
    const end = (e) => {
      const pt = this.pointers.get(e.pointerId); if (!pt) return;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0 && !this.moved && e.type === 'pointerup' && performance.now() - pt.t < 900) {
        const km = this.toKm(...pos(e));
        this.onTap?.(km);
      }
      if (this.pointers.size < 2) this.pinch = null;
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [sx, sy] = pos(e);
      this.zoomAt(sx, sy, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)));
    }, { passive: false });
  }
  pinchState() {
    const ps = [...this.pointers.values()].map((p) => p.p);
    return { c: [(ps[0][0] + ps[1][0]) / 2, (ps[0][1] + ps[1][1]) / 2], d: Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]) };
  }

  draw(t = 0) {
    const { ctx, w, h, cam } = this;
    const { world, scripts } = this.atlas;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#b9d0d2'; ctx.fillRect(0, 0, w, h);
    const k = cam.z / this.baked.scale;
    ctx.imageSmoothingEnabled = true;
    const [ox, oy] = this.toScreen(0, 0);
    ctx.drawImage(this.baked.canvas, ox, oy, this.baked.canvas.width * k, this.baked.canvas.height * k);
    const zr = cam.z / this.minZ; // 1 = whole map

    // roads
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(150,52,40,0.85)';
    ctx.lineWidth = Math.min(2.6, 0.8 + zr * 0.25);
    ctx.beginPath();
    for (const rd of world.roads) {
      rd.pts.forEach(([x, y], i) => { const [sx, sy] = this.toScreen(x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
    }
    ctx.stroke();

    // country names
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fs = Math.max(12, Math.min(34, 15 * Math.sqrt(zr)));
    ctx.font = `${fs}px "Young Serif", Georgia, serif`;
    ctx.fillStyle = 'rgba(42,47,58,0.42)';
    COUNTRIES.forEach((c, i) => {
      const [cx, cy] = this.baked.centres[i];
      const [sx, sy] = this.toScreen(cx, cy);
      ctx.letterSpacing = `${fs * 0.35}px`;
      ctx.fillText(c.name.toUpperCase(), sx, sy);
    });
    ctx.restore();

    // towns and labels
    const boxes = [];
    const order = world.towns.slice().sort((a, b) => (b.capital - a.capital) || (b.size - a.size));
    const sz = Math.max(7.5, Math.min(15, 6.5 + zr * 1.5));
    for (const tw of order) {
      const [sx, sy] = this.toScreen(tw.x, tw.y);
      const showLabel = tw.capital || zr > 1.45 || (tw.size > 0.6 && zr > 1.1) || cam.z > 0.55;
      if (sx < -40 || sy < -20 || sx > w + 40 || sy > h + 20) continue;
      const r = tw.capital ? 4 : 2.6;
      ctx.fillStyle = INK;
      if (tw.capital) { ctx.fillRect(sx - r, sy - r, r * 2, r * 2); ctx.fillStyle = '#f4efe2'; ctx.fillRect(sx - r + 1.5, sy - r + 1.5, r * 2 - 3, r * 2 - 3); ctx.fillStyle = INK; ctx.fillRect(sx - 1, sy - 1, 2, 2); }
      else ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
      if (!showLabel) continue;
      const script = scripts[tw.country];
      const s2 = tw.capital ? sz * 1.15 : sz;
      const lw = wordWidth(script, tw.word, s2);
      const box = [sx - lw / 2 - 3, sy - r - s2 - 6, lw + 6, s2 + 4];
      if (boxes.some((b) => b[0] < box[0] + box[2] && box[0] < b[0] + b[2] && b[1] < box[1] + box[3] && box[1] < b[1] + b[3])) continue;
      boxes.push(box);
      ctx.fillStyle = 'rgba(244,239,226,0.78)';
      ctx.fillRect(box[0], box[1], box[2], box[3]);
      drawWord(ctx, script, tw.word, sx, sy - r - 4 - s2 / 2, s2, INK);
    }

    // a soft ring the tutorial can point at
    if (this.highlight) {
      const [sx, sy] = this.toScreen(this.highlight.x, this.highlight.y);
      const rr = this.highlight.r * cam.z + Math.sin(t * 4) * 4;
      ctx.strokeStyle = '#c8452f'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(14, rr), 0, 6.29); ctx.stroke(); ctx.setLineDash([]);
    }

    // result lines
    const pairs = [...this.extra];
    if (this.truth && this.pin) pairs.push({ guess: this.pin, truth: this.truth, live: true });
    for (const p of pairs) {
      if (!p.guess) continue;
      const [ax, ay] = this.toScreen(p.guess[0], p.guess[1]), [bx, by] = this.toScreen(p.truth[0], p.truth[1]);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      const prog = p.live ? Math.min(1, this.lineT ?? 1) : 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * prog, ay + (by - ay) * prog); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const p of pairs) { if (p.guess) this.drawPin(...this.toScreen(p.guess[0], p.guess[1]), '#c8452f', p.n); if ((p.live ? (this.lineT ?? 1) >= 1 : true)) this.drawFlag(...this.toScreen(p.truth[0], p.truth[1])); }
    if (this.pin && !this.truth) this.drawPin(...this.toScreen(this.pin[0], this.pin[1]), '#c8452f');

    // scale bar
    const kmBar = [50, 100, 200, 400].find((v) => v * cam.z > 60) || 400;
    const bw = kmBar * cam.z;
    ctx.fillStyle = 'rgba(244,239,226,0.85)'; ctx.fillRect(10, h - 30, bw + 52, 22);
    ctx.fillStyle = INK; ctx.fillRect(16, h - 16, bw, 3); ctx.fillRect(16, h - 21, 2, 8); ctx.fillRect(16 + bw - 2, h - 21, 2, 8);
    ctx.font = '600 11px Jost, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${kmBar} km`, 22 + bw, h - 17);
    this.dirty = false;
  }
  drawPin(x, y, col, label) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 3, y, 5, 2, 0, 0, 6.29); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 16); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y - 20, 7, 0, 6.29); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(x - 2, y - 22, 2.2, 0, 6.29); ctx.fill();
    if (label) { ctx.fillStyle = '#fff'; ctx.font = '600 9px Jost, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y - 20); }
  }
  drawFlag(x, y) {
    const { ctx } = this;
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 24); ctx.stroke();
    ctx.fillStyle = '#e2b13c'; ctx.beginPath(); ctx.moveTo(x, y - 24); ctx.lineTo(x + 15, y - 19); ctx.lineTo(x, y - 14); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 6.29); ctx.fill();
  }
}
