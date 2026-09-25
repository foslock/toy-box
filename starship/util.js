// Shared helpers: seeded random numbers, colours, small canvases, glow textures and a 3×5 pixel font.
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);

// mulberry32, with a few conveniences hung on the function
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  const f = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.range = (a, b) => a + (b - a) * f();
  f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.chance = p => f() < p;
  f.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  f.weighted = pairs => { let tot = 0; for (const [, w] of pairs) tot += w; let r = f() * tot; for (const [v, w] of pairs) if ((r -= w) <= 0) return v; return pairs[pairs.length - 1][0]; };
  return f;
}
export const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

/* ---------- colour ---------- */
const HEX = {};
export const rgb = h => HEX[h] || (HEX[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const hx = v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
export const toHex = (r, g, b) => '#' + hx(r) + hx(g) + hx(b);
// k > 0 lightens toward white, k < 0 darkens toward black
export function shade(h, k) {
  const [r, g, b] = rgb(h);
  return k >= 0 ? toHex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k) : toHex(r * (1 + k), g * (1 + k), b * (1 + k));
}
export function mixHex(a, b, t) { const A = rgb(a), B = rgb(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
export const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => BAY[(y & 3) * 4 + (x & 3)] / 16;

/* ---------- canvases ---------- */
// In Node (for tests) there is no document, so canvases become stubs that swallow drawing calls.
const STUB = new Proxy({}, { get: (o, k) => k === 'canvas' ? { width: 0, height: 0 } : () => {}, set: () => true });
export function mk(w, h) {
  if (typeof document === 'undefined') return { width: w, height: h, getContext: () => STUB };
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
export const ctx2d = c => { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return g; };

const GLOW = {};
export function glowTex(c) {
  if (GLOW[c]) return GLOW[c];
  const t = mk(64, 64), x = t.getContext('2d'), [r, g, b] = rgb(c), s = a => `rgba(${r},${g},${b},${a})`;
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, s(1)); gr.addColorStop(.12, s(.7)); gr.addColorStop(.35, s(.26)); gr.addColorStop(.65, s(.07)); gr.addColorStop(1, s(0));
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return (GLOW[c] = t);
}

/* ---------- a 3×5 font for signs, screens and hull markings ---------- */
const GLYPHS = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'], G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['###', '#.#', '#.#', '#.#', '###'], P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['###', '#.#', '#.#', '###', '..#'], R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'], 6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '##.'],
  '-': ['...', '...', '###', '...', '...'], '.': ['...', '...', '...', '...', '.#.'], ':': ['...', '.#.', '...', '.#.', '...'], '/': ['..#', '..#', '.#.', '#..', '#..'],
  '#': ['#.#', '###', '#.#', '###', '#.#'], '+': ['...', '.#.', '###', '.#.', '...'], ' ': ['...', '...', '...', '...', '...'], '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  "'": ['.#.', '.#.', '...', '...', '...'], '?': ['##.', '..#', '.#.', '...', '.#.'], '&': ['.#.', '#.#', '.#.', '#.#', '.##'],
};
export const textWidth = s => String(s).length * 4 - 1;
export function drawText(g, s, x, y, col) {
  g.fillStyle = col;
  for (const ch of String(s).toUpperCase()) {
    const f = GLYPHS[ch] || GLYPHS[' '];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (f[j][i] === '#') g.fillRect(x + i, y + j, 1, 1);
    x += 4;
  }
}
