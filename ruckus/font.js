// Ruckus: the letters. A chunky monoline stroke font, drawn as thick round-capped lines, so the scenes can bend a
// letter, draw it on, wiggle it, or hang legs and eyes on it. Cap height is 100 units and the stroke is 17.
//
// A glyph is a path string, in units, y down, that every stroke starts and ends inside its box (centre-lines sit
// half a stroke in from the edge). Commands, all absolute:
//   M x y      start a stroke   (a bare M ends the current stroke, so the next R starts a fresh one)
//   L x y  H x  V y             straight lines
//   Q cx cy x y  /  C ...       curves
//   R cx cy rx ry a0 a1         an ellipse arc, angles in degrees, 0 = right, 90 = down, going clockwise as they grow
//                               (joined to the pen by a line if it doesn't start there)
export const SW = 17;
const H = SW / 2;

const SRC = {
  A: 'M8.5 91.5 L40 8.5 L71.5 91.5 M19 64 H61',
  B: 'M8.5 8.5 V91.5 M8.5 8.5 H38 R38 29 20.5 20.5 -90 90 H8.5 M8.5 49.5 H43 R43 70.5 21 21 -90 90 H8.5',
  C: 'R38.5 50 30 41.5 -45 -315',
  D: 'M8.5 8.5 V91.5 M8.5 8.5 H30 R30 50 32 41.5 -90 90 H8.5',
  E: 'M55 8.5 H8.5 V91.5 H55 M8.5 50 H46',
  F: 'M52 8.5 H8.5 V91.5 M8.5 50 H44',
  G: 'R40 50 31.5 41.5 -40 -360 H43',
  H: 'M8.5 8.5 V91.5 M61.5 8.5 V91.5 M8.5 50 H61.5',
  I: 'M8.5 8.5 H37.5 M23 8.5 V91.5 M8.5 91.5 H37.5',
  J: 'M49.5 8.5 V63 R29 63 20.5 28.5 0 180',
  K: 'M8.5 8.5 V91.5 M60 8.5 L8.5 54 M27 39 L62 91.5',
  L: 'M8.5 8.5 V91.5 H50',
  M: 'M8.5 91.5 V8.5 L45 62 L81.5 8.5 V91.5',
  N: 'M8.5 91.5 V8.5 L67.5 91.5 V8.5',
  O: 'R39 50 30.5 41.5 0 360',
  P: 'M8.5 91.5 V8.5 H36 R36 30 21.5 21.5 -90 90 H8.5',
  Q: 'R39 50 30.5 41.5 0 360 M50 62 L71 90',
  R: 'M8.5 91.5 V8.5 H36 R36 30 21.5 21.5 -90 90 H8.5 M33 51.5 L60 91.5',
  S: 'M50.2 19 R32 29.5 21 21 -30 -270 R32 70.5 21 21 -90 150',
  T: 'M8.5 8.5 H55.5 M32 8.5 V91.5',
  U: 'M8.5 8.5 V58 R35 58 26.5 33.5 180 0 V8.5',
  V: 'M8.5 8.5 L40 91.5 L71.5 8.5',
  W: 'M8.5 8.5 L28 91.5 L52 24 L76 91.5 L95.5 8.5',
  X: 'M8.5 8.5 L67.5 91.5 M67.5 8.5 L8.5 91.5',
  Y: 'M8.5 8.5 L38 52 L67.5 8.5 M38 52 V91.5',
  Z: 'M9 8.5 H59.5 L9 91.5 H59.5',
  0: 'R34 50 25.5 41.5 0 360',
  1: 'M9 30 L30 8.5 V91.5 M10 91.5 H50',
  2: 'R32 30 21.5 21.5 180 405 L9 91.5 H56',
  3: 'R30 28.5 20 20 200 450 R30 70 21.5 21.5 -90 160',
  4: 'M48 91.5 V8.5 L8.5 65 H62',
  5: 'M52 8.5 H14 L17.8 49.7 R31 68.5 23 23 -125 150',
  6: 'M52 14 C46 10 40 8.5 34 8.5 C18 8.5 8.5 24 8.5 58 V66 R33 66 24.5 25.5 180 -180',
  7: 'M8.5 8.5 H54 L27 91.5',
  8: 'R33 28.5 20 20 0 360 M R33 70 24.5 21.5 0 360',
  9: 'R33 34 24.5 25.5 0 -360 M57.5 34 V42 C57.5 76 48 91.5 32 91.5 C26 91.5 20 90 14 86',
  '!': 'M8.5 8.5 V58 M8.5 91.5 V91.6',
  '?': 'M10 27 C10 15 19 8.5 31 8.5 C43 8.5 51 15 51 26 C51 37 42 41 34 48 C30 52 30 58 30 64 M30 91.5 V91.6',
  '.': 'M8.5 91.5 V91.6',
  ',': 'M14 84 Q14 96 5 104 M14 84 V84.1',
  "'": 'M8.5 8.5 V30',
  '"': 'M8.5 8.5 V30 M31.5 8.5 V30',
  '-': 'M8.5 50 H35.5',
  _: 'M8.5 96 H55.5',
  ':': 'M8.5 34 V34.1 M8.5 80 V80.1',
  ';': 'M8.5 34 V34.1 M14 76 Q14 90 5 98 M14 76 V76.1',
  '(': 'M27 4 C11 22 11 78 27 96',
  ')': 'M8 4 C24 22 24 78 8 96',
  '[': 'M26 4 H10 V96 H26',
  ']': 'M8.5 4 H24.5 V96 H8.5',
  '{': 'M30 4 C18 4 18 12 18 22 V38 C18 46 14 50 6 50 C14 50 18 54 18 62 V78 C18 88 18 96 30 96',
  '}': 'M8 4 C20 4 20 12 20 22 V38 C20 46 24 50 32 50 C24 50 20 54 20 62 V78 C20 88 20 96 8 96',
  '/': 'M44 6 L8.5 94',
  '\\': 'M8.5 6 L44 94',
  '@': 'R52 50 16 16 0 360 M68 34 V58 R80 58 11.75 11.75 180 0 V50 R50 50 41.5 41.5 0 -320',
  '#': 'M25 8.5 V91.5 M51 8.5 V91.5 M8.5 33 H67.5 M8.5 67 H67.5',
  $: 'M50.2 24 R30 34 20 16 -30 -270 R30 66 20 16 -90 150 M30 2 V98',
  '%': 'R22 24 13.5 13.5 0 360 M R68 76 13.5 13.5 0 360 M74 8.5 L16 91.5',
  '^': 'M8.5 60 L32 12 L55.5 60',
  '&': 'M74 91.5 L30 44 R38 26 17 17 130 -190 L22 44 R34 68 25 23 -100 -320 L60 72',
  '*': 'M31 10 V54 M12 21 L50 43 M12 43 L50 21',
  '+': 'M8.5 50 H55.5 M32 26.5 V73.5',
  '=': 'M8.5 36 H49.5 M8.5 64 H49.5',
  '<': 'M41.5 22 L8.5 50 L41.5 78',
  '>': 'M8.5 22 L41.5 50 L8.5 78',
  '~': 'M8.5 54 C16 30 28 30 35 50 C42 70 54 70 61.5 46',
  '`': 'M8.5 8.5 L21 26',
  '|': 'M8.5 2 V98',
};

const DEG = Math.PI / 180;
const isNum = t => t !== undefined && !/[A-Z]/.test(t);

function parse(d) {
  const tok = d.match(/[MLHVCQR]|-?\d*\.?\d+/g), strokes = [];
  let i = 0, cur = null, x = 0, y = 0;
  const num = () => +tok[i++];
  const add = (px, py) => { cur.push(px, py); x = px; y = py; };
  const begin = (px, py) => { cur = []; strokes.push(cur); add(px, py); };
  while (i < tok.length) {
    const cmd = tok[i++];
    if (cmd === 'M') { cur = null; if (isNum(tok[i])) begin(num(), num()); }
    else if (cmd === 'L') add(num(), num());
    else if (cmd === 'H') add(num(), y);
    else if (cmd === 'V') add(x, num());
    else if (cmd === 'Q' || cmd === 'C') {
      const x0 = x, y0 = y, p = [];
      for (let k = 0; k < (cmd === 'Q' ? 4 : 6); k++) p.push(num());
      const ex = p[p.length - 2], ey = p[p.length - 1], n = Math.max(5, Math.ceil(Math.hypot(ex - x0, ey - y0) / 3.5));
      for (let s = 1; s <= n; s++) {
        const t = s / n, u = 1 - t;
        if (cmd === 'Q') add(u * u * x0 + 2 * u * t * p[0] + t * t * p[2], u * u * y0 + 2 * u * t * p[1] + t * t * p[3]);
        else add(u * u * u * x0 + 3 * u * u * t * p[0] + 3 * u * t * t * p[2] + t * t * t * p[4], u * u * u * y0 + 3 * u * u * t * p[1] + 3 * u * t * t * p[3] + t * t * t * p[5]);
      }
    } else if (cmd === 'R') {
      const cx = num(), cy = num(), rx = num(), ry = num(), a0 = num() * DEG, a1 = num() * DEG;
      const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * (rx + ry) / 2 / 3.5)), sx = cx + rx * Math.cos(a0), sy = cy + ry * Math.sin(a0);
      if (!cur) begin(sx, sy); else if (Math.hypot(sx - x, sy - y) > 0.05) add(sx, sy);
      for (let s = 1; s <= n; s++) { const a = a0 + (a1 - a0) * s / n; add(cx + rx * Math.cos(a), cy + ry * Math.sin(a)); }
    }
  }
  return strokes;
}

function build(ch, d) {
  const strokes = parse(d).map(p => ({ p: Float32Array.from(p), cum: null, total: 0, off: 0 }));
  let off = 0, maxX = 0, maxY = 0;
  for (const s of strokes) {
    const n = s.p.length / 2;
    s.cum = new Float32Array(n);
    for (let i = 1; i < n; i++) s.cum[i] = s.cum[i - 1] + Math.hypot(s.p[2 * i] - s.p[2 * i - 2], s.p[2 * i + 1] - s.p[2 * i - 1]);
    s.total = s.cum[n - 1]; s.off = off; off += s.total;
    for (let i = 0; i < n; i++) { maxX = Math.max(maxX, s.p[2 * i]); maxY = Math.max(maxY, s.p[2 * i + 1]); }
  }
  // Feet: the stroke ends that come down near the baseline, one per cluster.
  const feet = [];
  for (const s of strokes) for (const i of [0, s.p.length / 2 - 1]) {
    const x = s.p[2 * i], y = s.p[2 * i + 1];
    if (y >= 80 && y <= 95 && !feet.some(f => Math.abs(f[0] - x) < 12)) feet.push([x, y]);
  }
  feet.sort((a, b) => a[0] - b[0]);
  return { ch, w: Math.ceil(maxX + H), strokes, total: off, feet, bottom: maxY };
}

export const GLYPHS = {};
for (const ch in SRC) GLYPHS[ch] = build(ch, SRC[ch]);

// Where a fraction f (0..1) of the way along the strokes, in order, sits: [x, y, heading] in glyph units.
const at = [0, 0, 0];
export function pointAt(g, f) {
  const L = Math.max(0, Math.min(1, f)) * g.total;
  for (const s of g.strokes) {
    if (L > s.off + s.total + 1e-6) continue;
    const l = L - s.off, n = s.cum.length;
    let i = 1;
    while (i < n - 1 && s.cum[i] < l) i++;
    const seg = s.cum[i] - s.cum[i - 1] || 1, r = Math.max(0, Math.min(1, (l - s.cum[i - 1]) / seg));
    const x0 = s.p[2 * i - 2], y0 = s.p[2 * i - 1], x1 = s.p[2 * i], y1 = s.p[2 * i + 1];
    at[0] = x0 + (x1 - x0) * r; at[1] = y0 + (y1 - y0) * r; at[2] = Math.atan2(y1 - y0, x1 - x0);
    return at;
  }
  return at;
}
