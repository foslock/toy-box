// A tiny pixel painter. Canvas paths blur their edges, which pixel art can't have, so every sprite in the game is
// painted here instead: straight into a buffer of pixels, with fills that take a pixel only if its centre is inside
// (which gives isometric edges their clean two-across, one-down steps), then handed to the page as a canvas. Also the
// isometric building blocks everything is made of: tile diamonds, boxes with lit and shaded walls, gabled roofs,
// round towers and cones.
const CACHE = new Map();
// '#rrggbb' → a 32-bit pixel (little-endian ABGR, as ImageData wants it)
export function C(hex, a = 255) {
  const k = hex + a;
  let v = CACHE.get(k);
  if (v === undefined) {
    const n = parseInt(hex.slice(1), 16);
    v = ((a << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
    CACHE.set(k, v);
  }
  return v;
}
const clamp8 = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
export function hexOf(r, g, b) { return '#' + [r, g, b].map(v => clamp8(v).toString(16).padStart(2, '0')).join(''); }
export function rgbOf(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
// k > 0 lightens toward white, k < 0 darkens toward black
export function shade(hex, k) {
  const [r, g, b] = rgbOf(hex);
  return k >= 0 ? hexOf(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k) : hexOf(r * (1 + k), g * (1 + k), b * (1 + k));
}
export function mix(a, b, t) { const A = rgbOf(a), B = rgbOf(b); return hexOf(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
// A hue-shifted ramp, the way pixel artists light things: shadows go cooler, highlights warmer.
export function ramp(hex) {
  return { hi: mix(shade(hex, .28), '#fff4c8', .18), lit: shade(hex, .12), base: hex, dim: mix(shade(hex, -.22), '#2a2a5a', .12), dark: mix(shade(hex, -.42), '#1c1840', .2) };
}

const hasDOM = typeof document !== 'undefined';

export class Px {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
  put(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = typeof c === 'string' ? C(c) : c; }
  get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0; }
  // Only paint where something's already painted (for shading and texture on top of a shape).
  over(x, y, c) { if (this.get(x, y) >>> 24) this.put(x, y, c); }
  rect(x, y, w, h, c) { const v = typeof c === 'string' ? C(c) : c; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, v); }
  hline(x0, x1, y, c) { const v = typeof c === 'string' ? C(c) : c; for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.put(x, y, v); }
  vline(x, y0, y1, c) { const v = typeof c === 'string' ? C(c) : c; for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.put(x, y, v); }
  line(x0, y0, x1, y1, c) {
    const v = typeof c === 'string' ? C(c) : c;
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) { this.put(x0, y0, v); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  // Fill a convex polygon, pixel centres inside. fn(x, y) → colour lets a fill be textured.
  poly(pts, c) {
    const fn = typeof c === 'function' ? c : null, v = fn ? 0 : typeof c === 'string' ? C(c) : c;
    let y0 = Infinity, y1 = -Infinity;
    for (const [, y] of pts) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const cy = y + .5;
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) {
          const x = ax + (cy - ay) / (by - ay) * (bx - ax);
          if (x < lo) lo = x; if (x > hi) hi = x;
        }
      }
      if (lo === Infinity) continue;
      for (let x = Math.ceil(lo - .5); x + .5 <= hi; x++) { const c2 = fn ? fn(x, y) : v; if (c2 != null) this.put(x, y, c2); }
    }
  }
  disc(cx, cy, r, c) {
    const fn = typeof c === 'function' ? c : null, v = fn ? 0 : typeof c === 'string' ? C(c) : c;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + .5 - cx, dy = y + .5 - cy;
      if (dx * dx + dy * dy <= r * r) { const c2 = fn ? fn(x, y, dx / r, dy / r) : v; if (c2 != null) this.put(x, y, c2); }
    }
  }
  ellipse(cx, cy, rx, ry, c) {
    const fn = typeof c === 'function' ? c : null, v = fn ? 0 : typeof c === 'string' ? C(c) : c;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) { const c2 = fn ? fn(x, y, dx, dy) : v; if (c2 != null) this.put(x, y, c2); }
    }
  }
  // A dark line round everything painted so far (sprites read better against busy ground).
  outline(c, diag = false) {
    const v = typeof c === 'string' ? C(c) : c, add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y) >>> 24) continue;
      if (this.get(x - 1, y) >>> 24 || this.get(x + 1, y) >>> 24 || this.get(x, y - 1) >>> 24 || this.get(x, y + 1) >>> 24 ||
        (diag && (this.get(x - 1, y - 1) >>> 24 || this.get(x + 1, y - 1) >>> 24 || this.get(x - 1, y + 1) >>> 24 || this.get(x + 1, y + 1) >>> 24))) add.push(x, y);
    }
    for (let i = 0; i < add.length; i += 2) this.put(add[i], add[i + 1], v);
    return this;
  }
  // A copy drained of colour and washed toward fog, for tiles you can only half see.
  fogged(tint = '#9aa4b8', k = .5) {
    const o = new Px(this.w, this.h), [tr, tg, tb] = rgbOf(tint);
    for (let i = 0; i < this.d.length; i++) {
      const v = this.d[i], a = v >>> 24;
      if (!a) continue;
      const r = v & 255, g = (v >> 8) & 255, b = (v >> 16) & 255;
      const l = r * .3 + g * .55 + b * .15;
      const R = clamp8(l * (1 - k) + tr * k * (l / 150 + .35)), G = clamp8(l * (1 - k) + tg * k * (l / 150 + .35)), B = clamp8(l * (1 - k) + tb * k * (l / 150 + .35));
      o.d[i] = ((a << 24) | (B << 16) | (G << 8) | R) >>> 0;
    }
    return o;
  }
  // Every opaque pixel in one colour (for silhouettes and flashes).
  flat(hex, alpha = 255) {
    const o = new Px(this.w, this.h), v = C(hex, alpha);
    for (let i = 0; i < this.d.length; i++) if (this.d[i] >>> 24) o.d[i] = v;
    return o;
  }
  // Mirror left to right.
  flip() {
    const o = new Px(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) o.d[y * this.w + x] = this.d[y * this.w + this.w - 1 - x];
    return o;
  }
  blit(src, dx, dy) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const v = src.d[y * src.w + x]; if (v >>> 24) this.put(dx + x, dy + y, v); }
  }
  canvas() {
    if (!hasDOM) return { width: this.w, height: this.h, px: this };
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const g = c.getContext('2d');
    const img = g.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.d);
    g.putImageData(img, 0, 0);
    return c;
  }
}

/* ---------- isometric building blocks ---------- */
// Tiles are 48×24 diamonds. Along the grid's x axis a step is 2 pixels right and 1 down; along its y axis, 2 left and
// 1 down. A footprint of a × b steps has its top corner at (x, y), its right corner at (x + 2a, y + a), its left corner
// at (x − 2b, y + b) and its bottom corner at (x + 2a − 2b, y + a + b).
export const TW = 48, TH = 24;

// The top corner of an a × b footprint centred on (cx, cy).
export const foot = (cx, cy, a, b) => [cx - (a - b), cy - (a + b) / 2];

// A box: footprint a × b with its top corner at (x, y) on the ground, h pixels tall. cols: { top, left, right } or a
// ramp. fns may texture a face: { top(x, y), left(x, y), right(x, y) }.
export function box(p, x, y, a, b, h, cols, tex = {}) {
  const T = [x, y - h], R = [x + 2 * a, y + a - h], B = [x + 2 * a - 2 * b, y + a + b - h], L = [x - 2 * b, y + b - h];
  const top = cols.top ?? cols.lit, left = cols.left ?? cols.base, right = cols.right ?? cols.dim;
  if (h > 0) {
    p.poly([L, B, [B[0], B[1] + h], [L[0], L[1] + h]], tex.left || left);
    p.poly([B, R, [R[0], R[1] + h], [B[0], B[1] + h]], tex.right || right);
  }
  p.poly([T, R, B, L], tex.top || top);
  return { T, R, B, L };
}

// A gabled roof on an a × b footprint (top corner at (x, y)), eaves h above the ground, ridge rise above the eaves.
// axis 'a': the ridge runs along a, and the gable end faces down-right; 'b': along b, and the gable faces down-left.
// For eaves that hang over the walls, give it a footprint a little bigger than the walls'.
// cols: { lit (the slope facing the light), base or dim (the slope facing you), gable (the wall under the gable) }
export function roof(p, x, y, a, b, h, rise, cols, axis = 'a') {
  const T = [x, y - h], R = [x + 2 * a, y + a - h], B = [x + 2 * a - 2 * b, y + a + b - h], L = [x - 2 * b, y + b - h];
  const up = (P, Q) => [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2 - rise];
  if (axis === 'a') {
    const S = up(T, L), E = up(R, B);
    p.poly([T, R, E, S], cols.lit);
    if (cols.gable) p.poly([B, R, E], cols.gable);
    p.poly([S, E, B, L], cols.base);
    return { S, E };
  }
  const S = up(T, R), E = up(L, B);
  p.poly([T, S, E, L], cols.lit);
  if (cols.gable) p.poly([L, B, E], cols.gable);
  p.poly([S, R, B, E], cols.dim ?? cols.base);
  return { S, E };
}

// A round tower: centre (cx, cy) at the ground, radius r, h tall. Shaded across, lit from the left.
export function tower(p, cx, cy, r, h, c) {
  const R = typeof c === 'string' ? ramp(c) : c, ry = r / 2;
  for (let y = Math.floor(cy - h - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - r); x < Math.ceil(cx + r); x++) {
    const dx = (x + .5 - cx) / r;
    if (Math.abs(dx) > 1) continue;
    const e = Math.sqrt(1 - dx * dx) * ry;
    if (y + .5 > cy + e || y + .5 < cy - h - e) continue;
    const top = y + .5 < cy - h + e;
    const col = top ? R.lit : dx < -.45 ? R.lit : dx < .15 ? R.base : dx < .6 ? R.dim : R.dark;
    p.put(x, y, col);
  }
  return { top: cy - h };
}
// A cone roof over a tower top at (cx, top), radius r (a little wider for the eaves), height hh.
export function cone(p, cx, top, r, hh, c) {
  const R = typeof c === 'string' ? ramp(c) : c, ry = r / 2;
  for (let y = Math.floor(top - hh); y <= Math.ceil(top + ry); y++) for (let x = Math.floor(cx - r); x < Math.ceil(cx + r); x++) {
    const dx = x + .5 - cx, yy = y + .5;
    // inside the triangle from the apex to the ellipse's widest points, or inside the lower half of the ellipse
    const t = (yy - (top - hh)) / hh;
    const inTri = t >= 0 && t <= 1 && Math.abs(dx) <= r * t;
    const ex = dx / r, ey = (yy - top) / ry;
    const inEll = ey >= 0 && ex * ex + ey * ey <= 1;
    if (!inTri && !inEll) continue;
    const k = dx / r;
    p.put(x, y, k < -.4 ? R.lit : k < .1 ? R.base : k < .55 ? R.dim : R.dark);
  }
}

// A flat iso diamond centred at (cx, cy), half-width hw (the height is half the width).
export function diamond(p, cx, cy, hw, c) {
  const hh = hw / 2;
  p.poly([[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], c);
}
