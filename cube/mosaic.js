// Mosaic drawing. Everything on screen is set in tesserae: big, plain stones
// (opus tessellatum) for floors and walls, and finer ones (opus vermiculatum)
// for the figures, the way Roman floor-layers did it. Shapes are drawn at a
// tiny resolution with the ordinary canvas API, then each pixel is laid as a
// stone with a little jitter, a little colour wander and mortar between.

export const C = {
  mortar: '#9d8f7a', mortarDark: '#1f1a17', void: '#26211f', void2: '#302a27',
  lime: ['#ebe0c7', '#e4d7bb', '#efe6d1', '#ddcfb2'], limeDim: '#cfc0a2',
  ink: '#2b211c', ink2: '#3a2d26',
  terra: ['#b0513a', '#a54731', '#bd6045'], ochre: ['#c99332', '#bd8728', '#d5a347'], verd: ['#3f7b6b', '#36705f', '#4b8a78'],
  lapis: ['#2c4c8e', '#284482', '#36599e'], gold: ['#d6a62a', '#e2b83e', '#c8961f'], goldHi: '#f3d77a',
  water: ['#5a8fa8', '#4d8099', '#6aa0b6'], white: '#f6f0e2', red: '#9b2f25', skin: '#e0a979', hair: '#4a2c1c',
};
export const FLOOR_COL = [C.verd, C.ochre, C.terra];   // by home floor: bottom, middle, top
export const FLOOR_NAME = ['verdigris', 'ochre', 'terracotta'];

// deterministic hash → [0,1)
export function hash(a, b = 0, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) % 100000) / 100000;
}
const pickc = (arr, h) => Array.isArray(arr) ? arr[(h * arr.length) | 0] : arr;

// shade a #rrggbb colour by k (-1..1)
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (k >= 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; } else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// One stone: a quad nudged at its corners.
export function stone(x, cx, cy, w, h, col, seed, jit = 0.14, gap = 0.12) {
  const g = Math.max(0.6, w * gap);
  const j = w * jit;
  const a = hash(seed, 1), b = hash(seed, 2), c = hash(seed, 3), d = hash(seed, 4), e = hash(seed, 5), f = hash(seed, 6), q = hash(seed, 7), r = hash(seed, 8);
  const x0 = cx + g / 2, y0 = cy + g / 2, x1 = cx + w - g / 2, y1 = cy + h - g / 2;
  x.fillStyle = col;
  x.beginPath();
  x.moveTo(x0 + (a - 0.5) * j, y0 + (b - 0.5) * j);
  x.lineTo(x1 + (c - 0.5) * j, y0 + (d - 0.5) * j);
  x.lineTo(x1 + (e - 0.5) * j, y1 + (f - 0.5) * j);
  x.lineTo(x0 + (q - 0.5) * j, y1 + (r - 0.5) * j);
  x.closePath();
  x.fill();
}

// ---------------------------------------------------------------- pixel art → stones
// A "bitmap" is {w,h,px:[colour|null]}. Drawn with the canvas API at tiny size.
export function bitmap(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d', { willReadFrequently: true });
  draw(x, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  const px = new Array(w * h).fill(null);
  for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 120) px[i] = '#' + ((1 << 24) | (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2]).toString(16).slice(1);
  return { w, h, px };
}
// From a string grid with a palette.
export function grid(rows, pal) {
  const h = rows.length, w = rows[0].length, px = [];
  for (const row of rows) for (const ch of row) px.push(ch === '.' ? null : pal[ch]);
  return { w, h, px };
}
// Lay a bitmap as stones onto a fresh canvas, `s` px per stone.
export function laid(bm, s, seed = 1, opts = {}) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(bm.w * s); cv.height = Math.ceil(bm.h * s);
  const x = cv.getContext('2d');
  if (opts.bed) { x.fillStyle = opts.bed; x.fillRect(0, 0, cv.width, cv.height); }
  for (let j = 0; j < bm.h; j++) for (let i = 0; i < bm.w; i++) {
    const c = bm.px[j * bm.w + i]; if (!c) continue;
    const k = (hash(seed, i, j) - 0.5) * 0.14;
    stone(x, i * s, j * s, s, s, shade(c, k), seed * 7919 + j * 131 + i, opts.jit ?? 0.16, opts.gap ?? 0.13);
  }
  return cv;
}

// ---------------------------------------------------------------- figures
const P = {
  k: C.ink, h: C.hair, s: C.skin, e: C.ink, b: C.lapis[0], B: C.lapis[2], y: C.gold[1], w: C.white, t: C.terra[0],
  g: C.gold[0], G: C.goldHi, o: C.ochre[2], n: '#1d2433', N: '#2e3a52', l: '#4a6a9a', r: C.red,
};
export const SPR = {
  down: [
    '....kkkk....', '...khhhhk...', '..khhhhhhk..', '..kssssssk..', '..ksesseskk.', '...kssssk...',
    '..kbbbbbbk..', '.ksbbBBbbsk.', '.kkbbbbbbkk.', '..kbbyybbk..', '..kbk..kbk..', '..kk....kk..'],
  down2: [
    '....kkkk....', '...khhhhk...', '..khhhhhhk..', '..kssssssk..', '..ksesseskk.', '...kssssk...',
    '..kbbbbbbk..', '.ksbbBBbbsk.', '.kkbbbbbbkk.', '..kbbyybbk..', '...kbkkbk...', '...kk..kk...'],
  up: [
    '....kkkk....', '...khhhhk...', '..khhhhhhk..', '..khhhhhhk..', '..khhhhhhk..', '...kkhhkk...',
    '..kbbbbbbk..', '.ksbbbbbbsk.', '.kkbbbbbbkk.', '..kbbyybbk..', '..kbk..kbk..', '..kk....kk..'],
  up2: [
    '....kkkk....', '...khhhhk...', '..khhhhhhk..', '..khhhhhhk..', '..khhhhhhk..', '...kkhhkk...',
    '..kbbbbbbk..', '.ksbbbbbbsk.', '.kkbbbbbbkk.', '..kbbyybbk..', '...kbkkbk...', '...kk..kk...'],
  side: [
    '....kkkk....', '...khhhhk...', '..khhhhhsk..', '..khhhssek..', '..khhsssskk.', '...kssssk...',
    '...kbbbbk...', '...kbbsbk...', '...kbbsbk...', '...kbyybk...', '...kbkbk....', '...kk.kk....'],
  side2: [
    '....kkkk....', '...khhhhk...', '..khhhhhsk..', '..khhhssek..', '..khhsssskk.', '...kssssk...',
    '...kbbbbk...', '...kbbsbk...', '...kbbsbk...', '...kbyybk...', '..kbk..kbk..', '..kk....kk..'],
  beetle: [
    '...k....k...', '....k..k....', '..kkNNNNkk..', '.k.kNnnNk.k.', '..knnGGnnk..', '.kknnnGnnkk.',
    '..knnnGnnnk.', '.kknnnGnnkk.', '..knnnGnnk..', '.k.knnGnk.k.', '....kkkk....', '............'],
  beetle2: [
    '....k..k....', '...k....k...', '..kkNNNNkk..', '...kNnnNk...', '.kknnGGnnkk.', '..knnnGnnk..',
    '.kknnnGnnnk.', '..knnnGnnk..', '.kknnnGnnkk.', '...knnGnk...', '.k..kkkk..k.', '............'],
  key: [
    '............', '....kkkk....', '...kGggGk...', '...kg..gk...', '...kGggGk...', '....kgk.....',
    '....kgk.....', '....kggk....', '....kgk.....', '....kggk....', '....kkk.....', '............'],
  gem: [
    '............', '.....kk.....', '....kGGk....', '...kGgGgk...', '..kGgggGgk..', '.kGgggggGgk.',
    '.kggGggggyk.', '..kgggGgyk..', '...kgggyk...', '....kgyk....', '.....kk.....', '............'],
  puff: [
    '............', '..w.....w...', '....w..w....', '.w..wwww..w.', '...wwwwww...', '..wwwwwww...',
    '...wwwwww...', '.w..wwww..w.', '....w..w....', '..w.....w...', '............', '............'],
};
export const SPR_BM = Object.fromEntries(Object.entries(SPR).map(([k, v]) => [k, grid(v, P)]));
export function mirror(bm) {
  const px = [];
  for (let j = 0; j < bm.h; j++) for (let i = 0; i < bm.w; i++) px.push(bm.px[j * bm.w + (bm.w - 1 - i)]);
  return { w: bm.w, h: bm.h, px };
}

// Turnstone glyph: lapis disc, white arrows. type H = a ring, X = roll north–south, Y = roll east–west.
export function dialBitmap(type, n = 18) {
  return bitmap(n, n, (x) => {
    const c = n / 2;
    x.fillStyle = C.ink; x.beginPath(); x.arc(c, c, c - 0.2, 0, 7); x.fill();
    x.fillStyle = C.lapis[0]; x.beginPath(); x.arc(c, c, c - 1.4, 0, 7); x.fill();
    x.strokeStyle = C.white; x.fillStyle = C.white; x.lineWidth = 1.6;
    if (type === 'H') {
      x.beginPath(); x.arc(c, c, c * 0.55, -0.5, 4.2); x.stroke();
      const a = 4.2, ex = c + Math.cos(a) * c * 0.55, ey = c + Math.sin(a) * c * 0.55;
      x.beginPath(); x.moveTo(ex - 3.4, ey - 0.2); x.lineTo(ex + 2.2, ey - 2.4); x.lineTo(ex + 0.6, ey + 3.2); x.fill();
      x.fillStyle = C.gold[0]; x.fillRect(c - 1.2, c - 1.2, 2.4, 2.4);
    } else {
      x.save(); x.translate(c, c); if (type === 'Y') x.rotate(Math.PI / 2);
      x.fillRect(-c * 0.62, -1.2, c * 1.24, 2.4);          // the axle seen side-on
      x.beginPath(); x.ellipse(0, 0, c * 0.32, c * 0.66, 0, 0, 7); x.stroke();
      x.beginPath(); x.moveTo(-3, -c * 0.38); x.lineTo(3, -c * 0.38); x.lineTo(0, -c * 0.78); x.fill();
      x.beginPath(); x.moveTo(-3, c * 0.38); x.lineTo(3, c * 0.38); x.lineTo(0, c * 0.78); x.fill();
      x.restore();
    }
  });
}

// Ladder (going up through the ceiling) and trapdoor (going down)
export function ladderBitmap(dir, n = 12) {
  return bitmap(n, n, (x) => {
    if (dir < 0) { x.fillStyle = C.ink; x.fillRect(0, 0, n, n); x.fillStyle = '#120e0c'; x.fillRect(1, 1, n - 2, n - 2); }
    x.fillStyle = dir > 0 ? '#7a4a24' : '#5d3a1d';
    x.fillRect(2, 0, 1.6, n); x.fillRect(n - 3.6, 0, 1.6, n);
    for (let y = 1; y < n; y += 3) x.fillRect(2, y, n - 4, 1.2);
  });
}

// Text in stones, for titles. Drawn with a real font at a small size, then laid.
export function textBitmap(str, px, font, colour) {
  const m = document.createElement('canvas').getContext('2d');
  m.font = `${px}px ${font}`;
  const w = Math.ceil(m.measureText(str).width) + 4, h = Math.ceil(px * 1.4) + 4;
  const bm = bitmap(w, h, (x) => {
    x.font = `${px}px ${font}`; x.fillStyle = colour; x.strokeStyle = colour; x.lineWidth = px * 0.06; x.textBaseline = 'top';
    x.fillText(str, 2, 2); x.strokeText(str, 2, 2);
  });
  // crop to the inked stones
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (bm.px[j * w + i]) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
  if (x1 < 0) return bm;
  const px2 = [];
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) px2.push(bm.px[j * w + i]);
  return { w: x1 - x0 + 1, h: y1 - y0 + 1, px: px2 };
}

// Hand-set capitals, 5×7, for inscriptions.
const GLYPH = {
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  V: ['#...#', '#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
};
// A word in stones: `scale` stones per glyph pixel, with an ink shadow down and right.
export function inscription(str, scale, colour, shadow = C.ink) {
  const gl = [...str].map(ch => GLYPH[ch] || GLYPH[' ']);
  const w = gl.reduce((a, g) => a + g[0].length + 1, -1) * scale + 1, h = 7 * scale + 1;
  const px = new Array(w * h).fill(null);
  let ox = 0;
  for (const g of gl) {
    for (let j = 0; j < 7; j++) for (let i = 0; i < g[j].length; i++) if (g[j][i] === '#') {
      for (let a = 0; a < scale; a++) for (let b = 0; b < scale; b++) {
        const X = ox + i * scale + a, Y = j * scale + b;
        if (shadow && !px[(Y + 1) * w + X + 1]) px[(Y + 1) * w + X + 1] = shadow;
        px[Y * w + X] = colour;
      }
    }
    ox += (g[0].length + 1) * scale;
  }
  return { w, h, px };
}
