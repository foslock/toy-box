// Cut-paper drawing helpers. Every shape is a Path2D in local units with a
// slightly scissored edge, filled flat, with a hard offset shadow under it so
// the scene reads as layers of card stood up in a box.

export function rng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export function hash(...n) {
  let h = 2166136261;
  for (const v of n) { h ^= Math.round(v * 977) | 0; h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

// 1-D value noise, seeded
export function noise1(seed, scale) {
  const r = rng(seed); const vals = []; for (let i = 0; i < 4096; i++) vals.push(r());
  return (x) => {
    const u = x / scale; const i = Math.floor(u); const f = u - i;
    const a = vals[((i % 4096) + 4096) % 4096], b = vals[(((i + 1) % 4096) + 4096) % 4096];
    return lerp(a, b, smooth(f));
  };
}

// flat [x,y,x,y...] -> Path2D, with optional per-edge scissor jitter
export function pathFrom(pts, closed = true) {
  const p = new Path2D();
  p.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
  if (closed) p.closePath();
  return p;
}
export function blobPts(cx, cy, rx, ry, rot = 0, seed = 1, n = 18, j = 0.05, a0 = 0, a1 = Math.PI * 2) {
  const r = rng(seed); const out = []; const full = a1 - a0 >= Math.PI * 2 - 1e-6;
  const cnt = full ? n : n + 1;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i < cnt; i++) {
    const a = a0 + (a1 - a0) * (i / (full ? n : n));
    const k = 1 + (r() - 0.5) * 2 * j;
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    out.push(cx + x * cr - y * sr, cy + x * sr + y * cr);
  }
  return out;
}
export const blob = (cx, cy, rx, ry, rot, seed, n, j) => pathFrom(blobPts(cx, cy, rx, ry, rot, seed, n, j));

// a jagged polygon through given corner points, subdivided so edges look cut
export function cutPts(pts, seed = 1, j = 1.2, step = 14) {
  const r = rng(seed); const out = [];
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const x0 = pts[i * 2], y0 = pts[i * 2 + 1];
    const x1 = pts[((i + 1) % n) * 2], y1 = pts[((i + 1) % n) * 2 + 1];
    const len = Math.hypot(x1 - x0, y1 - y0); const segs = Math.max(1, Math.round(len / step));
    for (let s = 0; s < segs; s++) {
      const t = s / segs;
      const jj = s === 0 ? 0 : j;
      out.push(x0 + (x1 - x0) * t + (r() - 0.5) * jj, y0 + (y1 - y0) * t + (r() - 0.5) * jj);
    }
  }
  return out;
}
export const cut = (pts, seed, j, step) => pathFrom(cutPts(pts, seed, j, step));

// a tapered strip along a polyline (stems, legs, necks, reeds)
export function stripPts(line, w0, w1) {
  const L = [], R = []; const n = line.length / 2;
  for (let i = 0; i < n; i++) {
    const x = line[i * 2], y = line[i * 2 + 1];
    const xa = line[Math.max(0, i - 1) * 2], ya = line[Math.max(0, i - 1) * 2 + 1];
    const xb = line[Math.min(n - 1, i + 1) * 2], yb = line[Math.min(n - 1, i + 1) * 2 + 1];
    let dx = xb - xa, dy = yb - ya; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const w = lerp(w0, w1, n === 1 ? 0 : i / (n - 1)) / 2;
    L.push(x - dy * w, y + dx * w); R.push(x + dy * w, y - dx * w);
  }
  const out = [...L];
  for (let i = R.length - 2; i >= 0; i -= 2) out.push(R[i], R[i + 1]);
  return out;
}
export const strip = (line, w0, w1) => pathFrom(stripPts(line, w0, w1));

// fill with a hard paper shadow underneath
export let SHADOW = 'rgba(28,18,10,.30)';
export function setShadow(c) { SHADOW = c; }
export let FLIP = 1;
export function setFlip(f) { FLIP = f; }
export function card(ctx, path, color, sh = 2.4) {
  if (sh) {
    ctx.translate(sh * 0.55 * FLIP, sh);
    ctx.fillStyle = SHADOW; ctx.fill(path);
    ctx.translate(-sh * 0.55 * FLIP, -sh);
  }
  ctx.fillStyle = color; ctx.fill(path);
}
// brass split pin, the fastener that holds puppet joints together
export function pin(ctx, x, y, r = 2.2) {
  ctx.fillStyle = 'rgba(30,20,10,.35)'; ctx.beginPath(); ctx.arc(x + 0.6, y + 0.9, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#c99d3e'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#f3d98a'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, 7); ctx.fill();
}
export function eye(ctx, x, y, r, closed = 0, iris = '#1b1410', white = '#fbf4e2') {
  if (closed > 0.6) {
    ctx.strokeStyle = iris; ctx.lineWidth = Math.max(0.8, r * 0.35); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y - r * 0.3, r * 0.8, 0.4, Math.PI - 0.4); ctx.stroke();
    return;
  }
  ctx.fillStyle = white; ctx.beginPath(); ctx.ellipse(x, y, r, r * (1 - closed), 0, 0, 7); ctx.fill();
  ctx.fillStyle = iris; ctx.beginPath(); ctx.ellipse(x + r * 0.2, y, r * 0.55, r * 0.55 * (1 - closed), 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + r * 0.35, y - r * 0.3, r * 0.18, 0, 7); ctx.fill();
}
export function glow(ctx, x, y, r, color, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore();
}

// paper grain: a tile of fibre and speckle, multiplied over everything
let grainCanvas = null;
export function grain() {
  if (grainCanvas || typeof document === 'undefined') return grainCanvas;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const r = rng(77);
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
  const img = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 255 - Math.pow(r(), 3) * 46;
    img.data[i] = v; img.data[i + 1] = v - 2; img.data[i + 2] = v - 6;
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.16; g.strokeStyle = '#8a7a60'; g.lineWidth = 0.7;
  for (let i = 0; i < 70; i++) {
    const x = r() * 256, y = r() * 256, a = r() * 6.28, l = 6 + r() * 18;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.5, y + Math.sin(a + 1) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  grainCanvas = c; return c;
}
