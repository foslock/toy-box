// Every surface in the garden is painted here at startup, on canvases: nothing is downloaded.
// Most textures tile, so they're painted with wrap-around and tileable noise.
import * as THREE from 'three';
import { mulberry } from './layout.js';
import { TAU } from './common.js';

/* ---------- plumbing ---------- */
export function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: false })]; }
export function tex(c, { srgb = true, repeat = true, aniso = 8, mips = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso; t.generateMipmaps = mips;
  return t;
}
// Tileable value noise: the lattice wraps every `p` cells.
export function noise2(seed = 1) {
  const R = mulberry(seed), val = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) val[i] = R();
  const h = (i, j, p) => { i = ((i % p) + p) % p; j = ((j % p) + p) % p; return val[(i * 73 + j * 1531 + ((i * j) & 255) * 17) & 4095]; };
  const n = (x, y, p) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi, p), b = h(xi + 1, yi, p), c = h(xi, yi + 1, p), d = h(xi + 1, yi + 1, p);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  // fbm over the unit square [0,1)², tiling, with base frequency f (an integer)
  n.fbm = (x, y, f = 4, oct = 4, gain = .5) => {
    let s = 0, a = .5, t = 0;
    for (let o = 0; o < oct; o++) { s += a * n(x * f, y * f, f); t += a; f *= 2; a *= gain; }
    return s / t;
  };
  return n;
}
// Draw something at (x, y) and again across whichever edges it overhangs, so the canvas tiles.
export function wrapDraw(W, H, x, y, r, fn) {
  for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
    const px = x + ox, py = y + oy;
    if (px + r < 0 || px - r > W || py + r < 0 || py - r > H) continue;
    fn(px, py);
  }
}
// A normal map from a height field (0–1 floats), wrapping at the edges.
export function normalMap(hf, W, H, strength = 2) {
  const [c, g] = canvas(W, H), img = g.createImageData(W, H), d = img.data;
  const at = (x, y) => hf[((y + H) % H) * W + ((x + W) % W)];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * W + x) * 4;
    d[i] = (-dx / l * .5 + .5) * 255; d[i + 1] = (dy / l * .5 + .5) * 255; d[i + 2] = (1 / l * .5 + .5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
}
// Read a canvas's red channel back as a height field.
function heights(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, hf = new Float32Array(c.width * c.height);
  for (let i = 0; i < hf.length; i++) hf[i] = d[i * 4] / 255;
  return hf;
}
const rgb = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c, k = 1, a = 1) => `rgba(${c[0] * k | 0},${c[1] * k | 0},${c[2] * k | 0},${a})`;
function pixels(W, H, fn) {
  const [c, g] = canvas(W, H), img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, v = fn(x / W, y / H, x, y); d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = v[3] ?? 255; }
  g.putImageData(img, 0, 0);
  return [c, g];
}

/* ---------- ground ---------- */
export function lawn() {                                   // close-cut turf, seen from above: fine strokes over mottled green
  const W = 512, n = noise2(3), R = mulberry(31);
  const lo = rgb('#4f6f2a'), hi = rgb('#7b9a41'), dry = rgb('#8c9a4a');
  const [c, g] = pixels(W, W, (u, v) => {
    const a = n.fbm(u, v, 4, 5), b = n.fbm(u + .31, v + .77, 16, 3);
    let col = mix3(lo, hi, a * .8 + b * .35);
    col = mix3(col, dry, Math.max(0, n.fbm(u + .5, v, 2, 3) - .55) * 1.6);
    return col;
  });
  g.lineCap = 'round';
  for (let i = 0; i < 26000; i++) {
    const x = R() * W, y = R() * W, l = 2 + R() * 5, a = -Math.PI / 2 + (R() - .5) * 1.4, k = .75 + R() * .55;
    const base = R() < .5 ? lo : hi;
    wrapDraw(W, W, x, y, l, (px, py) => { g.strokeStyle = css(base, k, .55); g.lineWidth = .7 + R() * .8; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); g.stroke(); });
  }
  return tex(c);
}

export function gravel() {                                 // pea gravel: small rounded stones, packed on a bed of grit
  const W = 512, R = mulberry(5), n = noise2(6);
  const [c, g] = pixels(W, W, (u, v) => { const k = .92 + n(u * 96, v * 96, 96) * .16; return [138 * k, 126 * k, 106 * k]; });
  const [hc, hg] = canvas(W); hg.fillStyle = '#2a2a2a'; hg.fillRect(0, 0, W, W);
  const pal = ['#b7a88b', '#c1b296', '#aa9d86', '#b3a07f', '#a8927a', '#c4b8a2', '#a09584', '#b9a587', '#ad9f88'].map(rgb);
  for (let i = 0; i < 7800; i++) {
    const x = R() * W, y = R() * W, r = 2 + R() ** 1.8 * 4.6, e = .62 + R() * .38, a = R() * Math.PI, col = pal[R() * pal.length | 0], k = .9 + R() * .16;
    wrapDraw(W, W, x, y, r + 2, (px, py) => {
      g.save(); g.translate(px, py); g.rotate(a); g.scale(1, e);
      const gr = g.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r);
      gr.addColorStop(0, css(col, k * 1.06)); gr.addColorStop(.75, css(col, k)); gr.addColorStop(1, css(col, k * .84));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.restore();
      hg.save(); hg.translate(px, py); hg.rotate(a); hg.scale(1, e);
      const top = 150 + R() * 105 | 0, hr = hg.createRadialGradient(0, 0, 0, 0, 0, r);
      hr.addColorStop(0, `rgb(${top},${top},${top})`); hr.addColorStop(.55, `rgb(${top * .85 | 0},${top * .85 | 0},${top * .85 | 0})`); hr.addColorStop(1, 'rgba(60,60,60,1)');
      hg.fillStyle = hr; hg.beginPath(); hg.arc(0, 0, r, 0, TAU); hg.fill(); hg.restore();
    });
  }
  return { map: tex(c), normal: normalMap(heights(hc), W, W, 3.4), height: tex(hc, { srgb: false }) };
}

export function soil() {                                   // dark bed mulch, crumbly
  const W = 256, n = noise2(9), R = mulberry(12);
  const a = rgb('#2c2016'), b = rgb('#4b3625');
  const [c, g] = pixels(W, W, (u, v) => mix3(a, b, n.fbm(u, v, 8, 4) * .7 + n(u * 64, v * 64, 64) * .3));
  for (let i = 0; i < 2600; i++) {
    const x = R() * W, y = R() * W, s = .6 + R() * 2.2;
    g.fillStyle = R() < .5 ? `rgba(110,80,52,${.3 + R() * .4})` : `rgba(18,12,8,${.4 + R() * .4})`;
    g.fillRect(x, y, s, s * (.5 + R()));
  }
  return tex(c);
}

export function chips() {                                  // a woodchip path
  const W = 512, R = mulberry(21);
  const [c, g] = canvas(W), [hc, hg] = canvas(W);
  g.fillStyle = '#3b2a1c'; g.fillRect(0, 0, W, W); hg.fillStyle = '#000'; hg.fillRect(0, 0, W, W);
  const pal = ['#8a5a34', '#a0693c', '#6e4629', '#b98050', '#7d5536', '#c49062', '#5e3e26'].map(rgb);
  for (let i = 0; i < 2400; i++) {
    const x = R() * W, y = R() * W, l = 6 + R() * 16, w = 2.5 + R() * 5, a = R() * Math.PI, col = pal[R() * pal.length | 0], k = .8 + R() * .35, hh = 90 + i / 2400 * 165;
    wrapDraw(W, W, x, y, l, (px, py) => {
      g.save(); g.translate(px, py); g.rotate(a);
      g.fillStyle = css(col, k); g.beginPath(); g.roundRect(-l / 2, -w / 2, l, w, w * .4); g.fill();
      g.fillStyle = css(col, k * 1.25, .5); g.fillRect(-l / 2 + 1, -w / 2 + .5, l - 2, w * .3);
      g.restore();
      hg.save(); hg.translate(px, py); hg.rotate(a); hg.fillStyle = `rgb(${hh | 0},${hh | 0},${hh | 0})`; hg.beginPath(); hg.roundRect(-l / 2, -w / 2, l, w, w * .4); hg.fill(); hg.restore();
    });
  }
  return { map: tex(c), normal: normalMap(heights(hc), W, W, 1.6) };
}

export function litter() {                                 // woodland floor: last year's leaves, twigs and moss
  const W = 512, R = mulberry(41), n = noise2(44);
  const [c, g] = pixels(W, W, (u, v) => {
    const m = n.fbm(u, v, 3, 4);
    return mix3(mix3(rgb('#2e2317'), rgb('#4a3a24'), n.fbm(u + .2, v, 12, 3)), rgb('#3f5a24'), Math.max(0, m - .55) * 2.2);
  });
  const pal = ['#8a6a3a', '#a07a40', '#6a5a30', '#7a4a28', '#5d6030', '#b58a4a', '#4e3a22', '#96703c'].map(rgb);
  for (let i = 0; i < 1500; i++) {
    const x = R() * W, y = R() * W, l = 7 + R() * 12, w = l * (.35 + R() * .2), a = R() * TAU, col = pal[R() * pal.length | 0], k = .7 + R() * .4;
    wrapDraw(W, W, x, y, l, (px, py) => {
      g.save(); g.translate(px, py); g.rotate(a);
      g.fillStyle = css(col, k, .92); g.beginPath(); g.moveTo(-l / 2, 0); g.quadraticCurveTo(0, -w, l / 2, 0); g.quadraticCurveTo(0, w, -l / 2, 0); g.fill();
      g.strokeStyle = css(col, k * .7, .6); g.lineWidth = .6; g.beginPath(); g.moveTo(-l / 2, 0); g.lineTo(l / 2, 0); g.stroke();
      g.restore();
    });
  }
  g.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const x = R() * W, y = R() * W, l = 15 + R() * 40, a = R() * TAU;
    wrapDraw(W, W, x, y, l, (px, py) => { g.strokeStyle = `rgba(40,28,18,${.6 + R() * .3})`; g.lineWidth = 1 + R() * 1.4; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); g.stroke(); });
  }
  return tex(c);
}

export function stone(seed = 7, base = '#d9ccb0') {        // a warm limestone, faintly fossil-flecked
  const W = 512, n = noise2(seed), R = mulberry(seed * 3 + 1), b = rgb(base);
  const hf = new Float32Array(W * W);
  const [c, g] = pixels(W, W, (u, v, x, y) => {
    const m = n.fbm(u, v, 3, 5), f = n.fbm(u + .4, v + .1, 24, 3), s = n(u * 128, v * 128, 128);
    hf[y * W + x] = m * .5 + f * .4 + s * .1;
    const k = .86 + m * .2 + (f - .5) * .12 - (s > .86 ? .1 : 0);
    return [b[0] * k, b[1] * k * (.99 + (m - .5) * .03), b[2] * k * (.97 + (m - .5) * .08)];
  });
  for (let i = 0; i < 160; i++) {                          // shell fragments and dark flecks
    const x = R() * W, y = R() * W, r = .6 + R() * 1.8;
    g.fillStyle = R() < .6 ? 'rgba(120,108,90,.35)' : 'rgba(245,238,222,.5)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  return { map: tex(c), normal: normalMap(hf, W, W, 3) };
}

/* ---------- hedges ---------- */
// A clipped hedge seen close up: overlapping leaves in the light, deep shade in the gaps. The 3D leaves in hedges.js
// sit on top of this, so from a distance, when they thin out, this is what you're looking at.
function leafMass({ W = 512, seed, bg, n, len, wid, pal, gloss, sprays = false }) {
  const R = mulberry(seed);
  const [c, g] = canvas(W), [hc, hg] = canvas(W);
  g.fillStyle = bg; g.fillRect(0, 0, W, W); hg.fillStyle = '#000'; hg.fillRect(0, 0, W, W);
  const cols = pal.map(rgb);
  for (let i = 0; i < n; i++) {
    const depth = i / n, x = R() * W, y = R() * W, l = len[0] + R() * (len[1] - len[0]), w = wid[0] + R() * (wid[1] - wid[0]);
    const a = -Math.PI / 2 + (R() - .5) * 2.6, col = cols[R() * cols.length | 0], k = .45 + depth * .7 + (R() - .5) * .2;
    wrapDraw(W, W, x, y, l, (px, py) => {
      g.save(); g.translate(px, py); g.rotate(a);
      // the blade, darker at the stalk
      const gr = g.createLinearGradient(0, 0, l, 0);
      gr.addColorStop(0, css(col, k * .7)); gr.addColorStop(.6, css(col, k)); gr.addColorStop(1, css(col, k * 1.1));
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0);
      g.bezierCurveTo(l * .25, -w * .62, l * .75, -w * .55, l, 0); g.bezierCurveTo(l * .75, w * .55, l * .25, w * .62, 0, 0); g.fill();
      if (gloss) {                                          // a glossy sheen along one half
        g.fillStyle = `rgba(235,245,215,${gloss * (.3 + depth * .7) * (.5 + R() * .5)})`; g.beginPath(); g.moveTo(l * .12, -w * .05);
        g.bezierCurveTo(l * .35, -w * .42, l * .7, -w * .36, l * .9, -w * .04); g.bezierCurveTo(l * .6, -w * .14, l * .35, -w * .14, l * .12, -w * .05); g.fill();
      }
      g.strokeStyle = css(col, k * 1.3, .5); g.lineWidth = Math.max(.5, w * .06); g.beginPath(); g.moveTo(l * .04, 0); g.lineTo(l * .92, 0); g.stroke();
      g.restore();
      hg.save(); hg.translate(px, py); hg.rotate(a);
      const hh = 70 + depth * 185, hr = hg.createLinearGradient(0, -w / 2, 0, w / 2);
      const e = hh * .55 | 0, m = hh | 0; hr.addColorStop(0, `rgb(${e},${e},${e})`); hr.addColorStop(.5, `rgb(${m},${m},${m})`); hr.addColorStop(1, `rgb(${e},${e},${e})`);
      hg.fillStyle = hr; hg.beginPath(); hg.moveTo(0, 0);
      hg.bezierCurveTo(l * .25, -w * .62, l * .75, -w * .55, l, 0); hg.bezierCurveTo(l * .75, w * .55, l * .25, w * .62, 0, 0); hg.fill();
      hg.restore();
    });
    if (sprays && R() < .05) {                              // yew: a few twigs showing through
      g.strokeStyle = 'rgba(60,40,25,.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 30, y + 20 + R() * 20); g.stroke();
    }
  }
  return { map: tex(c), normal: normalMap(heights(hc), W, W, 2.2), height: tex(hc, { srgb: false }) };
}
export const laurelMass = () => leafMass({ seed: 51, bg: '#0d1a09', n: 720, len: [40, 64], wid: [15, 24], gloss: .55,
  pal: ['#2f5b1f', '#3a6a24', '#44752a', '#2a4f1b', '#4f7f2e', '#365f22'] });
export const yewMass = () => leafMass({ seed: 61, bg: '#13220e', n: 5600, len: [9, 15], wid: [2.4, 3.6], gloss: .25, sprays: true,
  pal: ['#2c4e22', '#335a27', '#3b642c', '#284720', '#41692f', '#355526'] });
export const boxMass = () => leafMass({ seed: 71, bg: '#15260f', n: 3800, len: [8, 12], wid: [5, 7.5], gloss: .45,
  pal: ['#3f6a26', '#4a782b', '#5d8a33', '#355d20', '#527f2e'] });

/* ---------- bark, timber, straw, cloth and metal ---------- */
// Bark wraps round a trunk: u runs round it, v up it (the texture is taller than it's wide, and tiles).
export function bark(kind) {
  const W = 256, H = 512, n = noise2({ oak: 81, birch: 82, cherry: 83, olive: 84, stump: 85 }[kind] || 80), R = mulberry(kind.length * 17 + 3);
  const hf = new Float32Array(W * H);
  const [c, g] = pixels(W, H, (u, v, x, y) => {
    if (kind === 'birch') {
      const m = n.fbm(u, v, 4, 4), s = n.fbm(u * 2, v * .25, 8, 3);
      hf[y * W + x] = m * .4 + s * .2;
      const k = .86 + m * .18;
      return [236 * k, 232 * k, 222 * k];
    }
    if (kind === 'cherry') {
      const m = n.fbm(u, v, 4, 4), bands = .5 + .5 * Math.sin(v * 170 + n(u * 8, v * 8, 8) * 5);
      hf[y * W + x] = m * .5 + bands * .25;
      const col = mix3(rgb('#4a2a22'), rgb('#6e3d30'), m * .8 + .1);
      return mix3(col, rgb('#8e6a5a'), Math.max(0, bands - .82) * 3);
    }
    // oak, olive, stump: vertical furrows and ridges
    const warp = n.fbm(u, v, 4, 3) * .35, r = Math.abs(Math.sin((u + warp) * Math.PI * (kind === 'olive' ? 9 : 12)));
    const cracks = Math.pow(r, .35), fine = n.fbm(u * 3, v * .6, 8, 3);
    hf[y * W + x] = cracks * .7 + fine * .3;
    const base = kind === 'olive' ? rgb('#7d776c') : kind === 'stump' ? rgb('#5a4838') : rgb('#5d5043');
    const k = .45 + cracks * .55 + (fine - .5) * .25;
    return [base[0] * k, base[1] * k, base[2] * k];
  });
  if (kind === 'birch') {                                   // black lenticels and scars on white
    for (let i = 0; i < 700; i++) {
      const x = R() * W, y = R() * H, l = 4 + R() * 26, t = .8 + R() * 2.5;
      wrapDraw(W, H, x, y, l, (px, py) => { g.fillStyle = `rgba(40,34,30,${.45 + R() * .5})`; g.beginPath(); g.ellipse(px, py, l / 2, t / 2, 0, 0, TAU); g.fill(); });
    }
    for (let i = 0; i < 26; i++) {
      const x = R() * W, y = R() * H, s = 6 + R() * 18;
      wrapDraw(W, H, x, y, s * 2, (px, py) => {
        g.fillStyle = `rgba(28,24,22,${.7 + R() * .3})`; g.beginPath(); g.moveTo(px - s, py); g.quadraticCurveTo(px, py - s * .7, px + s, py); g.quadraticCurveTo(px, py + s * .5, px - s, py); g.fill();
      });
    }
  }
  if (kind === 'cherry') for (let i = 0; i < 260; i++) {     // horizontal lenticels
    const x = R() * W, y = R() * H, l = 5 + R() * 14;
    wrapDraw(W, H, x, y, l, (px, py) => { g.fillStyle = `rgba(160,120,100,${.35 + R() * .3})`; g.fillRect(px - l / 2, py, l, 1.2 + R()); });
  }
  return { map: tex(c), normal: normalMap(hf, W, H, kind === 'birch' ? 1.2 : 4) };
}

export function timber(tone = '#9a7048', seed = 91) {       // planed hardwood, grain running along v
  const W = 256, H = 512, n = noise2(seed), b = rgb(tone);
  const [c] = pixels(W, H, (u, v) => {
    const warp = n.fbm(u, v, 3, 3) * .08;
    const grain = .5 + .5 * Math.sin((u + warp) * 190 + n(u * 16, v * 2, 16) * 3);
    const fine = n(u * 128, v * 8, 128), k = .8 + grain * .16 + (fine - .5) * .12 + (n.fbm(u, v, 2, 2) - .5) * .2;
    return [b[0] * k, b[1] * k, b[2] * k];
  });
  return tex(c);
}

export function straw() {                                    // a woven straw hat
  const W = 256, [c, g] = canvas(W), R = mulberry(4);
  g.fillStyle = '#b8955a'; g.fillRect(0, 0, W, W);
  const step = 8;
  for (let y = 0; y < W; y += step) for (let x = 0; x < W; x += step) {
    const over = ((x + y) / step) % 2 === 0, k = .85 + R() * .3;
    g.fillStyle = `rgb(${226 * k | 0},${196 * k | 0},${134 * k | 0})`;
    if (over) g.fillRect(x + .5, y + 1.5, step - 1, step - 3); else g.fillRect(x + 1.5, y + .5, step - 3, step - 1);
    g.fillStyle = 'rgba(90,60,30,.25)'; over ? g.fillRect(x, y + step - 1.5, step, 1) : g.fillRect(x + step - 1.5, y, 1, step);
  }
  return tex(c);
}

export function linen(tone = '#e9e3d4') {                    // a loose linen weave
  const W = 128, b = rgb(tone), n = noise2(5);
  const [c] = pixels(W, W, (u, v, x, y) => {
    const k = .9 + ((x % 2) ^ (y % 2)) * .05 + (n(u * 32, v * 32, 32) - .5) * .1 + (n(u * 4, v * 128, 4) - .5) * .06;
    return [b[0] * k, b[1] * k, b[2] * k];
  });
  return tex(c);
}

export function grille() {                                   // perforated metal over a dark speaker cone
  const W = 256, [c, g] = canvas(W);
  g.fillStyle = '#4a4c4f'; g.fillRect(0, 0, W, W);
  const s = 8, rr = 2.7;
  for (let j = 0; j * s * .866 < W + s; j++) for (let i = 0; i * s < W + s; i++) {
    const x = i * s + (j % 2) * s / 2, y = j * s * .866;
    g.fillStyle = '#0c0c0d'; g.beginPath(); g.arc(x % W, y % W, rr, 0, TAU); g.fill();
  }
  return tex(c);
}

/* ---------- laid surfaces ---------- */
// Old garden bricks in stretcher bond, laid across the path: u runs across it, v along it. Moss in some joints.
export function bricks() {
  const W = 512, H = 512, R = mulberry(33), n = noise2(34);
  const [c, g] = canvas(W, H), [hc, hg] = canvas(W, H);
  g.fillStyle = '#6f6556'; g.fillRect(0, 0, W, H); hg.fillStyle = '#1a1a1a'; hg.fillRect(0, 0, W, H);
  const bw = 128, bh = 64, m = 5, pal = ['#9b4a32', '#a85a3c', '#8a3f2c', '#b0664a', '#7d3a2a', '#a4553a', '#94503a', '#b8745a'].map(rgb);
  for (let row = 0; row < H / bh; row++) for (let col = -1; col < W / bw + 1; col++) {
    const x = col * bw + (row % 2) * bw / 2, y = row * bh, col3 = pal[R() * pal.length | 0], k = .82 + R() * .3;
    const gr = g.createLinearGradient(x, y, x + bw, y + bh);
    gr.addColorStop(0, css(col3, k * 1.05)); gr.addColorStop(1, css(col3, k * .88));
    g.fillStyle = gr; g.beginPath(); g.roundRect(x + m / 2, y + m / 2, bw - m, bh - m, 5); g.fill();
    for (let i = 0; i < 40; i++) { g.fillStyle = R() < .5 ? 'rgba(40,20,10,.18)' : 'rgba(230,190,160,.12)'; g.fillRect(x + m + R() * (bw - 2 * m), y + m + R() * (bh - 2 * m), 1 + R() * 3, 1 + R() * 2); }
    const hh = 200 + R() * 55 | 0;
    hg.fillStyle = `rgb(${hh},${hh},${hh})`; hg.beginPath(); hg.roundRect(x + m / 2 + 1, y + m / 2 + 1, bw - m - 2, bh - m - 2, 7); hg.fill();
  }
  const img = g.getImageData(0, 0, W, H), d = img.data, hd = hc.getContext('2d').getImageData(0, 0, W, H).data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {             // moss creeping along the joints
    const i = (y * W + x) * 4, joint = hd[i] < 60, mo = n.fbm(x / W, y / H, 6, 3);
    if (joint && mo > .52) { const t = Math.min(1, (mo - .52) * 5); d[i] = d[i] * (1 - t) + 70 * t; d[i + 1] = d[i + 1] * (1 - t) + 92 * t; d[i + 2] = d[i + 2] * (1 - t) + 40 * t; }
  }
  g.putImageData(img, 0, 0);
  return { map: tex(c), normal: normalMap(heights(hc), W, H, 3) };
}

// Sawn stone flags in random widths, for the terrace.
export function flags(seed = 44, base = '#cdbfa3') {
  const W = 512, R = mulberry(seed), n = noise2(seed + 1), b = rgb(base);
  const [c, g] = canvas(W), [hc, hg] = canvas(W);
  g.fillStyle = '#6b6254'; g.fillRect(0, 0, W, W); hg.fillStyle = '#202020'; hg.fillRect(0, 0, W, W);
  const rows = [0, 150, 256, 400, 512];
  for (let r = 0; r < rows.length - 1; r++) {
    let x = -R() * 120;
    while (x < W) {
      const w = 110 + R() * 150, y0 = rows[r], y1 = rows[r + 1], k = .86 + R() * .2, tint = (R() - .5) * .08;
      for (const ox of [0, W]) {
        g.fillStyle = css([b[0] * (1 + tint), b[1], b[2] * (1 - tint)], k); g.fillRect(x + 3 + ox - W * (ox ? 1 : 0), y0 + 3, w - 6, y1 - y0 - 6);
        const hh = 190 + R() * 50 | 0; hg.fillStyle = `rgb(${hh},${hh},${hh})`; hg.fillRect(x + 4 + ox - W * (ox ? 1 : 0), y0 + 4, w - 8, y1 - y0 - 8);
      }
      x += w;
    }
  }
  const img = g.getImageData(0, 0, W, W), d = img.data;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, v = .9 + n.fbm(x / W, y / W, 8, 4) * .2;
    d[i] *= v; d[i + 1] *= v; d[i + 2] *= v;
  }
  g.putImageData(img, 0, 0);
  return { map: tex(c), normal: normalMap(heights(hc), W, W, 2.5) };
}

// The dais: rings of limestone flags round a compass star of darker stone.
export function dais() {
  const W = 1024, [c, g] = canvas(W), R = mulberry(8), n = noise2(9), C = W / 2, px = C / 2.3;
  const st = rgb('#dccfb4');
  g.fillStyle = '#7a705f'; g.fillRect(0, 0, W, W);
  const rings = [0, .55, 1.15, 1.72, 2.3];
  for (let i = 1; i < rings.length; i++) {
    const n0 = [0, 6, 12, 18, 24][i], r0 = rings[i - 1] * px, r1 = rings[i] * px;
    for (let k = 0; k < n0; k++) {
      const a0 = k / n0 * TAU + i * .3, a1 = (k + 1) / n0 * TAU + i * .3, kk = .88 + R() * .18;
      g.fillStyle = css(st, kk); g.beginPath();
      g.arc(C, C, r1 - 2.5, a0 + .004, a1 - .004); g.arc(C, C, r0 + 2.5, a1 - .004, a0 + .004, true); g.closePath(); g.fill();
    }
  }
  g.fillStyle = css(st, .95); g.beginPath(); g.arc(C, C, .55 * px - 2.5, 0, TAU); g.fill();
  // an eight-pointed star in grey stone, one point for each speaker
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * TAU, r = (k % 2 ? .22 : .5) * px, a2 = (k + 1) / 16 * TAU, r2 = (k % 2 ? .5 : .22) * px;
    g.fillStyle = k % 2 ? '#8e8a82' : '#a39f95';
    g.beginPath(); g.moveTo(C, C); g.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r); g.lineTo(C + Math.cos(a2) * r2, C + Math.sin(a2) * r2); g.closePath(); g.fill();
  }
  const img = g.getImageData(0, 0, W, W), d = img.data;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, v = .9 + n.fbm(x / W, y / W, 12, 4) * .18;
    d[i] *= v; d[i + 1] *= v; d[i + 2] *= v;
  }
  g.putImageData(img, 0, 0);
  return tex(c, { repeat: false });
}

/* ---------- foliage ---------- */
// Sprays of leaves and blossom for trees, painted into a 4×2 atlas with transparent gaps; the cards that carry them
// are alpha-tested. Each cell leaves a margin so mipmaps don't bleed between neighbours.
export const ATLAS = { blossom: [0, 0], birch: [1, 0], maple: [2, 0], olive: [3, 0], glossy: [0, 1], willow: [1, 1], bamboo: [2, 1], oak: [3, 1], rose: [0, 2], wisteria: [1, 2], ivy: [2, 2] };
export const ATLAS_ROWS = 3;
export function foliageAtlas() {
  const S = 512, [c, g] = canvas(S * 4, S * ATLAS_ROWS), R = mulberry(7);
  const leaf = (x, y, a, l, w, col, k = 1, rib = true, tipCurve = 0) => {
    g.save(); g.translate(x, y); g.rotate(a);
    const gr = g.createLinearGradient(0, 0, l, 0);
    gr.addColorStop(0, css(col, k * .78)); gr.addColorStop(.55, css(col, k)); gr.addColorStop(1, css(col, k * 1.08));
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0);
    g.bezierCurveTo(l * .22, -w * .6, l * .72, -w * .62 + tipCurve, l, tipCurve); g.bezierCurveTo(l * .72, w * .62 + tipCurve, l * .22, w * .6, 0, 0); g.fill();
    if (rib) { g.strokeStyle = css(col, k * 1.25, .55); g.lineWidth = Math.max(.6, w * .07); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(l * .5, tipCurve * .4, l * .95, tipCurve); g.stroke(); }
    g.fillStyle = `rgba(255,255,240,${.08 * k})`; g.beginPath(); g.ellipse(l * .45, -w * .16, l * .3, w * .12, 0, 0, TAU); g.fill();
    g.restore();
  };
  const twig = (pts, w, col = '#5a4636') => { g.strokeStyle = col; g.lineCap = 'round'; g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
  const cell = (cx, cy, fn) => { g.save(); g.beginPath(); g.rect(cx * S + 10, cy * S + 10, S - 20, S - 20); g.clip(); g.translate(cx * S, cy * S); fn(); g.restore(); };
  // a spray: a main twig up the middle with side shoots, calling fn at points along them
  const spray = (fn, { shoots = 7, len = 420, spread = 1, col = '#5a4636', w = 5 } = {}) => {
    const x0 = 256 + (R() - .5) * 20, y0 = 490, pts = [];
    for (let i = 0; i <= 10; i++) pts.push([x0 + Math.sin(i * .5) * 12, y0 - i / 10 * len]);
    twig(pts, w, col);
    for (let i = 0; i < shoots; i++) {
      const t = .18 + i / shoots * .8, [px, py] = pts[Math.round(t * 10)], side = i % 2 ? 1 : -1, a = -Math.PI / 2 + side * (.6 + R() * .5) * spread, l = (120 + R() * 90) * (1 - t * .4);
      const ex = px + Math.cos(a) * l, ey = py + Math.sin(a) * l;
      twig([[px, py], [(px + ex) / 2 + side * 6, (py + ey) / 2], [ex, ey]], w * .6, col);
      for (let k = 0; k < 5; k++) { const u = .25 + k * .19; fn(px + (ex - px) * u, py + (ey - py) * u, a, k, side); }
    }
    for (let k = 0; k < 5; k++) fn(pts[10][0] + (R() - .5) * 20, pts[10][1] + k * 22, -Math.PI / 2, k, 1);
  };
  // cherry blossom
  cell(0, 0, () => spray((x, y, a) => {
    for (let n = 0; n < 3; n++) {
      const bx = x + (R() - .5) * 46, by = y + (R() - .5) * 46, r = 13 + R() * 9, pink = [rgb('#f7c9d8'), rgb('#f1a7bf'), rgb('#fce4ec'), rgb('#eeb4c8')][R() * 4 | 0];
      if (R() < .25) { leaf(bx, by, a + (R() - .5) * 2, 34 + R() * 20, 15, rgb('#7d8a3c'), .9); continue; }
      for (let p = 0; p < 5; p++) {
        const pa = p / 5 * TAU + R();
        g.save(); g.translate(bx, by); g.rotate(pa);
        const gr = g.createRadialGradient(0, r * .55, 0, 0, r * .5, r * .7);
        gr.addColorStop(0, css(pink, 1.05)); gr.addColorStop(1, css(pink, .85));
        g.fillStyle = gr; g.beginPath(); g.ellipse(0, r * .55, r * .42, r * .55, 0, 0, TAU); g.fill(); g.restore();
      }
      g.fillStyle = 'rgba(190,70,100,.8)'; g.beginPath(); g.arc(bx, by, r * .22, 0, TAU); g.fill();
      for (let s = 0; s < 7; s++) { const sa = R() * TAU; g.fillStyle = '#f3d27a'; g.fillRect(bx + Math.cos(sa) * r * .3, by + Math.sin(sa) * r * .3, 2, 2); }
    }
  }, { shoots: 8, col: '#4a3028' }));
  // silver birch
  cell(1, 0, () => spray((x, y, a, k, side) => {
    const col = [rgb('#7ea43c'), rgb('#94b84a'), rgb('#6b9434'), rgb('#a8c45a')][R() * 4 | 0];
    leaf(x, y, a + side * (1 + R() * .5), 30 + R() * 14, 22, col, .9 + R() * .25);
    if (R() < .6) leaf(x, y, a - side * (1 + R() * .5), 26 + R() * 12, 19, col, .85 + R() * .25);
  }, { shoots: 9, w: 3.5, col: '#4b3a30', spread: 1.3 }));
  // Japanese maple: palmate, crimson to orange
  cell(2, 0, () => spray((x, y) => {
    const col = [rgb('#b3302a'), rgb('#cf4d2c'), rgb('#9a2424'), rgb('#dd6e34'), rgb('#c23a2c')][R() * 5 | 0], r = 26 + R() * 14, rot = R() * TAU, k = .85 + R() * .3;
    g.fillStyle = css(col, k); g.beginPath();
    for (let i = 0; i <= 70; i++) { const t = i / 70 * TAU, lobe = Math.pow(Math.abs(Math.cos(t * 3.5)), 2.2), rr = r * (.32 + .68 * lobe); const px = x + Math.cos(t + rot) * rr, py = y + Math.sin(t + rot) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.fill();
    g.strokeStyle = css(col, k * 1.3, .5); g.lineWidth = 1;
    for (let i = 0; i < 7; i++) { const t = i / 7 * TAU + rot + Math.PI / 7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(t) * r * .9, y + Math.sin(t) * r * .9); g.stroke(); }
  }, { shoots: 8, w: 3, col: '#5a2a22', spread: 1.2 }));
  // olive: narrow, grey-green, paler beneath
  cell(3, 0, () => spray((x, y, a, k, side) => {
    for (const s of [-1, 1]) leaf(x, y, a + s * (.5 + R() * .4), 58 + R() * 22, 11 + R() * 4, R() < .35 ? rgb('#b3bba0') : [rgb('#7f8c6a'), rgb('#8e9a78'), rgb('#6f7b5c')][R() * 3 | 0], .9 + R() * .2);
  }, { shoots: 8, w: 3, col: '#6a6255' }));
  // glossy broadleaf: bay, citrus, and the far trees
  cell(0, 1, () => spray((x, y, a, k, side) => {
    leaf(x, y, a + side * (.8 + R() * .5), 52 + R() * 24, 24 + R() * 8, [rgb('#2f5a26'), rgb('#3b6a2c'), rgb('#4b7a34'), rgb('#284c20')][R() * 4 | 0], .85 + R() * .3);
  }, { shoots: 8, w: 4 }));
  // willow: a hanging thread of narrow leaves (this cell is drawn top to bottom)
  cell(1, 1, () => {
    for (let s = 0; s < 3; s++) {
      const x0 = 150 + s * 110 + (R() - .5) * 30;
      twig([[x0, 12], [x0 + 6, 250], [x0 - 4, 500]], 2, '#8a7a4a');
      for (let i = 0; i < 26; i++) { const y = 20 + i * 18.5, side = i % 2 ? 1 : -1; leaf(x0 + Math.sin(y * .02) * 5, y, Math.PI / 2 + side * (.25 + R() * .2), 44 + R() * 18, 7 + R() * 2, [rgb('#9cb04a'), rgb('#b4c262'), rgb('#86a040')][R() * 3 | 0], .9 + R() * .2, false); }
    }
  });
  // bamboo: fans of long blades
  cell(2, 1, () => spray((x, y, a, k, side) => {
    if (k % 2) return;
    for (let f = 0; f < 3; f++) leaf(x, y, a + side * (.4 + f * .35), 95 + R() * 40, 16 + R() * 4, [rgb('#6f9a3a'), rgb('#86aa46'), rgb('#5d8a34')][R() * 3 | 0], .9 + R() * .2, true, (R() - .5) * 14);
  }, { shoots: 6, w: 3, col: '#7d8a3a' }));
  // oak, for the trees beyond the wall
  cell(3, 1, () => spray((x, y, a, k, side) => {
    const col = [rgb('#3d5e28'), rgb('#4a6c2e'), rgb('#355424'), rgb('#56783a')][R() * 4 | 0], ang = a + side * (.9 + R() * .4), l = 46 + R() * 16;
    g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = css(col, .9 + R() * .2); g.beginPath();
    for (let i = 0; i <= 40; i++) { const t = i / 40, yy = Math.sin(t * Math.PI) * (l * .3) * (1 + .3 * Math.sin(t * 22)); g.lineTo(t * l, -yy); }
    for (let i = 40; i >= 0; i--) { const t = i / 40, yy = Math.sin(t * Math.PI) * (l * .3) * (1 + .3 * Math.sin(t * 22)); g.lineTo(t * l, yy); }
    g.fill(); g.restore();
  }, { shoots: 9, w: 4 }));
  // rose foliage: compound leaves of glossy, toothed leaflets, some flushed red with new growth
  const toothed = (x, y, a, l, w, col, k) => {
    g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = css(col, k); g.beginPath(); g.moveTo(0, 0);
    for (let i = 0; i <= 16; i++) { const u = i / 16, e = Math.sin(Math.PI * Math.min(1, u * 1.05 + .02)) * w * .5 * (1 + (i % 2) * .12); g.lineTo(u * l, -e); }
    for (let i = 16; i >= 0; i--) { const u = i / 16, e = Math.sin(Math.PI * Math.min(1, u * 1.05 + .02)) * w * .5 * (1 + (i % 2) * .12); g.lineTo(u * l, e); }
    g.fill(); g.strokeStyle = css(col, k * 1.3, .45); g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(l * .9, 0); g.stroke();
    g.fillStyle = 'rgba(255,255,235,.1)'; g.beginPath(); g.ellipse(l * .45, -w * .12, l * .28, w * .1, 0, 0, TAU); g.fill();
    g.restore();
  };
  cell(0, 2, () => spray((x, y, a, k, side) => {
    if (k % 2) return;
    const young = R() < .18, col = young ? rgb('#7a3a2a') : [rgb('#2d4d22'), rgb('#355a27'), rgb('#3f672c')][R() * 3 | 0];
    const pa = a + side * (.9 + R() * .4), px = Math.cos(pa), py = Math.sin(pa);
    twig([[x, y], [x + px * 70, y + py * 70]], 2.2, '#4a4a2a');
    toothed(x + px * 72, y + py * 72, pa, 40, 25, col, .9 + R() * .2);
    for (let q = 0; q < 2; q++) { const d = 25 + q * 24; for (const s of [-1, 1]) toothed(x + px * d, y + py * d, pa + s * 1.25, 34, 21, col, .85 + R() * .25); }
  }, { shoots: 9, w: 4.5, col: '#4a4a2a' }));
  // wisteria: long pinnate leaves of small pale leaflets
  cell(1, 2, () => spray((x, y, a, k, side) => {
    if (k % 2) return;
    const pa = a + side * (.7 + R() * .5), px = Math.cos(pa), py = Math.sin(pa), col = [rgb('#8fb04a'), rgb('#a2bc58'), rgb('#7fa040')][R() * 3 | 0];
    twig([[x, y], [x + px * 130, y + py * 130]], 1.8, '#6a7a3a');
    for (let q = 0; q < 6; q++) { const d = 22 + q * 20; for (const s of [-1, 1]) leaf(x + px * d, y + py * d, pa + s * 1.2, 30, 13, col, .9 + R() * .2); }
    leaf(x + px * 132, y + py * 132, pa, 32, 13, col, .95);
  }, { shoots: 8, w: 3, col: '#5a5a3a' }));
  // ivy, for the old wall of the woodland and the pergola posts
  cell(2, 2, () => spray((x, y, a, k, side) => {
    const col = [rgb('#2f4a24'), rgb('#3a5a2a'), rgb('#294220')][R() * 3 | 0], r = 20 + R() * 10, rot = a + side * 1.2;
    g.fillStyle = css(col, .9 + R() * .25); g.beginPath();
    for (let i = 0; i <= 60; i++) { const tt = i / 60 * TAU, lobe = Math.pow(Math.abs(Math.cos(tt * 2.5)), 1.5), rr = r * (.55 + .45 * lobe); const px = x + Math.cos(tt + rot) * rr, py = y + Math.sin(tt + rot) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.fill();
    g.strokeStyle = 'rgba(200,210,170,.35)'; g.lineWidth = 1; for (let i = 0; i < 5; i++) { const tt = i / 5 * TAU + rot; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(tt) * r * .8, y + Math.sin(tt) * r * .8); g.stroke(); }
  }, { shoots: 8, w: 3, col: '#4a3a2a', spread: 1.3 }));
  const t = tex(c, { repeat: false });
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// Moss: soft, bumpy, many greens.
export function moss() {
  const W = 256, n = noise2(66), hf = new Float32Array(W * W);
  const [c] = pixels(W, W, (u, v, x, y) => {
    const a = n.fbm(u, v, 8, 4), b = n(u * 64, v * 64, 64), h = a * .6 + b * .4;
    hf[y * W + x] = h;
    return mix3(mix3(rgb('#3b5520'), rgb('#6f8a34'), a), rgb('#8fa84a'), Math.max(0, b - .7) * 2);
  });
  return { map: tex(c), normal: normalMap(hf, W, W, 3.5) };
}
