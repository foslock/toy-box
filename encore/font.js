// A 5x7 LED dot-matrix face, drawn dot by dot like a club's scrolling sign.
// Every word in Encore goes through here: titles, buttons, captions and the HUD.

const G = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '#.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  ':': ['.', '#', '.', '.', '.', '#', '.'],
  ';': ['..', '.#', '..', '..', '..', '.#', '#.'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
  '(': ['..#', '.#.', '#..', '#..', '#..', '.#.', '..#'],
  ')': ['#..', '.#.', '..#', '..#', '..#', '.#.', '#..'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '·': ['.', '.', '.', '#', '.', '.', '.'],
  '<': ['...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'],
  '>': ['#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'],
  v: ['.....', '.....', '.....', '.....', '#...#', '.#.#.', '..#..'],
  '^': ['..#..', '.#.#.', '#...#', '.....', '.....', '.....', '.....'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  // a little note and a heart for flourishes
  '~': ['..##', '..#.', '..#.', '..#.', '###.', '###.', '.#..'],
  '@': ['.....', '.#.#.', '#####', '#####', '.###.', '..#..', '.....'],
};
const SPACE = 3;

const glyph = ch => G[ch] || G[ch.toUpperCase()] || null;

// Width of a string in dots (1-dot gap between glyphs).
export function dotWidth(s) {
  let w = 0;
  for (const ch of s) { const g = glyph(ch); w += (g ? g[0].length : SPACE) + 1; }
  return Math.max(0, w - 1);
}
export const textW = (s, p) => dotWidth(s) * p;
export const LINE = 9; // dot rows per line, with a two-dot gap

// Word-wrap to a width in dots.
export function wrap(s, maxDots) {
  const out = [];
  for (const para of String(s).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (line && dotWidth(t) > maxDots) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

// Renders are cached by (text, pitch, colour, dim): signs redraw every frame.
const cache = new Map();
function render(s, p, col, dim, dpr) {
  const key = s + '|' + p + '|' + col + '|' + dim + '|' + dpr;
  let c = cache.get(key);
  if (c) return c;
  const wd = dotWidth(s), pad = Math.ceil(p * 1.2);
  c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil((wd * p + pad * 2) * dpr)); c.height = Math.ceil((7 * p + pad * 2) * dpr);
  const x = c.getContext('2d');
  x.scale(dpr, dpr);
  const r = p * .42;
  let ox = pad;
  for (const ch of s) {
    const g = glyph(ch), gw = g ? g[0].length : SPACE;
    for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < gw; xx++) {
      const on = g && g[yy][xx] === '#';
      if (!on && !dim) continue;
      x.fillStyle = on ? col : dim;
      x.beginPath(); x.arc(ox + xx * p + p / 2, pad + yy * p + p / 2, on ? r : r * .8, 0, 6.2832); x.fill();
    }
    ox += (gw + 1) * p;
  }
  if (cache.size > 700) cache.delete(cache.keys().next().value);
  cache.set(key, c);
  return c;
}

// Draw text with its top-left (or centre/right per align) at x,y. p = dot pitch in CSS px.
export function text(ctx, s, x, y, p, col = '#ffb43a', o = {}) {
  s = String(s);
  if (!s) return 0;
  const dpr = ctx.getTransform().a || 1;
  p = Math.max(1, Math.round(p * dpr * 2) / (dpr * 2));
  const img = render(s, p, col, o.dim || null, dpr), pad = Math.ceil(p * 1.2);
  const w = dotWidth(s) * p;
  let dx = x - pad;
  if (o.align === 'center') dx -= w / 2; else if (o.align === 'right') dx -= w;
  if (o.glow) { ctx.save(); ctx.shadowColor = o.glow; ctx.shadowBlur = p * 2.5; }
  ctx.drawImage(img, dx, y - pad, img.width / dpr, img.height / dpr);
  if (o.glow) ctx.restore();
  return w;
}

// A wrapped block of text; returns its height in px.
export function block(ctx, s, x, y, p, maxW, col, o = {}) {
  const lines = wrap(s, Math.floor(maxW / p));
  lines.forEach((l, i) => text(ctx, l, o.align === 'center' ? x + maxW / 2 : x, y + i * LINE * p, p, col, o));
  return lines.length * LINE * p - 2 * p;
}
export const blockH = (s, p, maxW) => wrap(s, Math.floor(maxW / p)).length * LINE * p - 2 * p;
// Biggest pitch (in half-px steps) at which s fits maxW on one line.
export const fitPitch = (s, maxW, maxP) => Math.max(1, Math.min(maxP, Math.floor(maxW / dotWidth(s) * 2) / 2));
