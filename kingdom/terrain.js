// The land itself: a ground tile for each region, and what stands on it when nothing's happening there (trees and
// fields, bogs and reeds, rocks and peaks, ash and bones), and the royal city: walls, streets of houses, towers, the
// cathedral and the castle. Each sprite is a tile-sized canvas (see SPRITE), drawn once and kept.
import { Px, ramp, shade, box, roof, tower, cone, diamond, foot } from './paint.js';
import { hash2 } from './util.js';

export const HEAD = 72;           // room above a tile's top corner for whatever stands on it
export const DEPTH = 18;          // room below it for the block's sides and any height
export const EL = 4;              // pixels per step of height
export const SPRITE = { w: 48, h: HEAD + 24 + DEPTH };
export const OUTLINE = '#1c1622';

// Ground colours by region: top (with a lighter and darker speckle), the lip at the top of the sides, the sides.
export const GROUND = {
  farm:  { top: '#76b84f', hi: '#94cf63', lo: '#5c9b40', lip: '#4f8a38', side: '#8a5c3a', sideLo: '#6a4430' },
  wood:  { top: '#4f9243', hi: '#65a852', lo: '#3c7636', lip: '#356a30', side: '#7a5236', sideLo: '#5a3c2a' },
  fen:   { top: '#6b7f45', hi: '#83955a', lo: '#56683a', lip: '#4a5a33', side: '#5e4a36', sideLo: '#46382c' },
  hills: { top: '#8aa653', hi: '#a4bd6a', lo: '#708c44', lip: '#627a3c', side: '#8c7458', sideLo: '#6c5844' },
  moor:  { top: '#8c7f52', hi: '#a39462', lo: '#736840', lip: '#655b3a', side: '#6e5a44', sideLo: '#524434' },
  lake:  { top: '#6fb258', hi: '#8cc96c', lo: '#58964a', lip: '#4c8440', side: '#86603f', sideLo: '#654832' },
  waste: { top: '#7a6658', hi: '#8e796a', lo: '#5f4e45', lip: '#54443c', side: '#5a4238', sideLo: '#42302a' },
  snow:  { top: '#e6ecf2', hi: '#ffffff', lo: '#c4d0de', lip: '#b3c2d4', side: '#7d8494', sideLo: '#5e6474' },
  crown: { top: '#7cc25a', hi: '#9ad873', lo: '#62a647', lip: '#528e3d', side: '#8a5c3a', sideLo: '#6a4430' },
  city:  { top: '#a39d90', hi: '#b8b2a4', lo: '#8a8478', lip: '#77716a', side: '#6e6860', sideLo: '#55504a' },
};
export const WATER = { top: '#3f86c6', hi: '#8cc6ef', lo: '#2f6aa8', deep: '#285a92' };

// The top corner of the tile's diamond, and its centre, for a tile raised h steps.
export const tileTop = h => HEAD - h * EL;
export const centre = h => [24, HEAD + 12 - h * EL];

// The tile diamond as a polygon, at y0 (its top corner).
const dia = y0 => [[24, y0], [48, y0 + 12], [24, y0 + 24], [0, y0 + 12]];

// A block of ground: textured top, and sides down to the base.
export function ground(p, biome, h, salt = 0, opts = {}) {
  const G = GROUND[biome] || GROUND.farm, y0 = tileTop(h), base = HEAD + 24 + 5;
  // sides: the left face lit a little more than the right, with a grassy lip and some strata
  p.poly([[0, y0 + 12], [24, y0 + 24], [24, base + 12], [0, base]], (x, y) => stratum(G, x, y, y0, 0, salt));
  p.poly([[24, y0 + 24], [48, y0 + 12], [48, base], [24, base + 12]], (x, y) => stratum(G, x, y, y0, 1, salt));
  // top
  p.poly(dia(y0), (x, y) => {
    const n = hash2(x, y, salt + 7), n2 = hash2(x >> 1, y, salt + 3);
    if (opts.path && onPath(x, y - y0, opts.path)) return pathCol(biome, n);
    return n < .07 ? G.hi : n > .93 ? G.lo : n2 < .12 ? G.lo : G.top;
  });
  // a lighter rim along the front-left edge catches the light; the back edges are a shade darker, so tiles read as tiles
  for (let x = 1; x < 24; x++) { const y = y0 + 12 + Math.floor(x / 2); p.over(x, y, G.hi); }
  for (let i = 0; i < 24; i++) { p.over(23 - i, y0 + Math.floor(i / 2), G.lo); p.over(24 + i, y0 + Math.floor(i / 2), G.lo); }
}
function stratum(G, x, y, y0, right, salt) {
  const edge = right ? y0 + 12 + Math.floor((48 - x) / 2) : y0 + 12 + Math.floor(x / 2);
  const d = y - edge;
  if (d <= 1) return G.lip;
  const n = hash2(x, y, salt + 11);
  const base = right ? G.sideLo : G.side;
  if ((d + (x >> 3)) % 7 === 0) return shade(base, -.12);
  return n < .12 ? shade(base, .1) : base;
}
// The trail your character has worn across a tile: from the edge they came in by, through the middle, to the edge they
// left by. path: { in: 'L' | 'R' | null, out: 'L' | 'R' | null } where 'L' means the lower-left edge for in, and the
// upper-left edge for out.
function onPath(x, y, path) {
  const cx = 24, cy = 12;
  const near = (ax, ay, bx, by) => {
    const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((x + .5 - ax) * vx + (y + .5 - ay) * vy) / (vx * vx + vy * vy)));
    const dx = x + .5 - (ax + vx * t), dy = (y + .5 - (ay + vy * t)) * 2;
    return dx * dx + dy * dy < 9;
  };
  if (path.in === 'L' && near(12, 18, cx, cy)) return true;       // came up-right: in through the lower-left edge
  if (path.in === 'R' && near(36, 18, cx, cy)) return true;       // came up-left: in through the lower-right edge
  if (path.out === 'L' && near(cx, cy, 12, 6)) return true;       // leaving up-left: out through the upper-left edge
  if (path.out === 'R' && near(cx, cy, 36, 6)) return true;
  if (path.in == null && path.out == null) return false;
  return (x + .5 - cx) ** 2 + ((y + .5 - cy) * 2) ** 2 < 10;
}
const pathCol = (biome, n) => biome === 'snow' ? (n < .5 ? '#c9b8a0' : '#b8a488') : biome === 'city' ? (n < .5 ? '#8a847a' : '#7a746a') : (n < .3 ? '#b08a5c' : n < .8 ? '#a07c50' : '#8c6a44');

/* ---------- things that grow and stand about ---------- */
export function tree(p, x, y, size = 1, col = '#3f8a3a', salt = 0) {
  const R = ramp(col), trunk = '#6a4a30';
  const th = Math.round(4 * size);
  p.rect(x - 1, y - th, 2, th + 1, trunk); p.put(x, y - th, shade(trunk, -.3));
  const r = 4.5 * size;
  const blobs = [[0, -th - r * .9, r], [-r * .6, -th - r * .5, r * .75], [r * .6, -th - r * .55, r * .7], [0, -th - r * 1.5, r * .7]];
  for (const [dx, dy, rr] of blobs) p.disc(x + dx, y + dy, rr, (px, py, nx, ny) => {
    const l = -nx * .6 - ny * .8 + (hash2(px, py, salt) - .5) * .5;
    return l > .55 ? R.hi : l > .1 ? R.lit : l > -.35 ? R.base : R.dim;
  });
}
export function pine(p, x, y, size = 1, col = '#2f6e43', snow = false) {
  const R = ramp(col);
  p.rect(x - 1, y - 2, 2, 3, '#5a3e2a');
  const hgt = Math.round(14 * size), w = 5 * size;
  for (let i = 0; i < 3; i++) {
    const top = y - hgt + i * hgt * .28, bot = y - 1 - (2 - i) * hgt * .12, ww = w * (.55 + i * .25);
    p.poly([[x, top], [x + ww, bot], [x - ww, bot]], (px, py) => {
      if (snow && py < top + (bot - top) * .35) return px < x ? '#ffffff' : '#dce6f0';
      return px < x - 1 ? R.lit : px < x + 1 ? R.base : R.dim;
    });
  }
}
export function deadTree(p, x, y, col = '#5a4a3e') {
  p.vline(x, y - 12, y, col); p.vline(x + 1, y - 10, y, shade(col, -.25));
  p.line(x, y - 8, x - 4, y - 12, col); p.line(x + 1, y - 6, x + 5, y - 10, col); p.line(x - 2, y - 10, x - 3, y - 14, col); p.line(x + 3, y - 8, x + 4, y - 13, col);
}
export function rock(p, x, y, s = 1, col = '#8e8a86') {
  const R = ramp(col), r = 3 * s;
  p.ellipse(x, y - r * .6, r * 1.3, r, (px, py, nx, ny) => { const l = -nx * .7 - ny * .7; return l > .4 ? R.hi : l > -.1 ? R.base : R.dim; });
}
export function bush(p, x, y, s = 1, col = '#3f7a34') {
  const R = ramp(col);
  p.ellipse(x, y - 2 * s, 3.4 * s, 2.6 * s, (px, py, nx, ny) => { const l = -nx * .5 - ny * .8 + (hash2(px, py) - .5) * .4; return l > .35 ? R.lit : l > -.2 ? R.base : R.dim; });
}
function water(p, cx, cy, hw, salt = 0) {
  const hh = hw / 2;
  p.poly([[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], (x, y) => {
    const n = hash2(x, y, salt + 21);
    return y < cy - hh + 2 ? WATER.lo : n < .06 ? WATER.hi : n < .2 ? shade(WATER.top, .06) : WATER.top;
  });
}
export function house(p, cx, cy, a, b, h, wall = '#e8dcc0', roofCol = '#b8563f', axis = 'a', rise = 6) {
  const W = ramp(wall), Rf = ramp(roofCol);
  const [x, y] = foot(cx, cy, a, b);
  box(p, x, y, a, b, h, { top: W.lit, left: W.base, right: W.dim });
  // a door and windows on the two faces you can see
  const bx = x + 2 * a - 2 * b, by = y + a + b;
  if (axis === 'a') { p.rect(bx + a - 1, by - Math.floor(a / 2) - 5, 2, 4, '#4a3024'); p.put(bx - Math.round(b), by - Math.round(b / 2) - h + 3, '#f0d27a'); }
  else { p.rect(bx - b - 1, by - Math.floor(b / 2) - 5, 2, 4, '#4a3024'); p.put(bx + Math.round(a), by - Math.round(a / 2) - h + 3, '#f0d27a'); }
  const [rx, ry] = foot(cx, cy, a + 1, b + 1);
  roof(p, rx, ry, a + 1, b + 1, h, rise, { lit: Rf.lit, base: Rf.base, dim: Rf.dim, gable: axis === 'a' ? W.dim : W.base }, axis);
}

// What stands on a tile of the country. c: the cell from world.js.
export function feature(p, c, salt = 0) {
  const b = c.biome, h = c.h, [cx, cy] = centre(h), v2 = c.v2;
  const jit = (k, amt) => Math.round((hash2(c.gx, c.gy, salt + k) - .5) * amt);
  switch (c.feat) {
    case 'tree': tree(p, cx + jit(1, 12), cy + jit(2, 6), .9 + v2 * .3, b === 'crown' ? '#4f9a44' : '#3f8a3a', salt); break;
    case 'trees': {
      const spots = [[-9, -1], [7, -3], [-1, 3], [10, 3], [-12, 4]].slice(0, 3 + (v2 < .5 ? 1 : 0));
      spots.sort((a, b2) => a[1] - b2[1]);
      for (const [dx, dy] of spots) { if (hash2(dx, dy, c.gx * 7 + c.gy) < .35) pine(p, cx + dx, cy + dy + 1, .9, '#2f6e43'); else tree(p, cx + dx, cy + dy, .8 + hash2(dx, c.gy) * .35, '#3a7f38', salt + dx); }
      break;
    }
    case 'pines': for (const [dx, dy] of [[-8, -1], [6, -2], [0, 4]]) pine(p, cx + dx + jit(dx, 4), cy + dy, .85, '#2f6250', true); break;
    case 'deadtree': deadTree(p, cx + jit(3, 10), cy + jit(4, 4)); break;
    case 'field': {
      const crop = v2 < .5 ? ['#d8b848', '#c49a34'] : v2 < .8 ? ['#8cbf4a', '#6e9e38'] : ['#b88a58', '#9a7040'];
      p.poly([[cx, cy - 9], [cx + 18, cy], [cx, cy + 9], [cx - 18, cy]], (x, y) => ((x - 2 * y) >> 2) % 2 ? crop[0] : crop[1]);
      break;
    }
    case 'cottage': house(p, cx + jit(5, 6), cy, 5, 5, 7, '#e2d4b4', v2 < .5 ? '#a8583a' : '#8a7a4a', 'a', 5); break;
    case 'hedge': for (let i = -3; i <= 3; i++) bush(p, cx + i * 4, cy + 4 - Math.abs(i) * 2 + (i < 0 ? 0 : 0) - 2, .8, '#3a7234'); break;
    case 'pool': water(p, cx + jit(6, 8), cy + 1, 11, salt); break;
    case 'reeds': for (let i = 0; i < 9; i++) { const x = cx - 10 + Math.round(hash2(i, c.gx, salt) * 20), y = cy - 4 + Math.round(hash2(c.gy, i, salt) * 9); p.vline(x, y - 4, y, '#8a8a3a'); p.put(x, y - 5, '#6a4a2a'); } break;
    case 'rocks': rock(p, cx - 6 + jit(7, 4), cy + 1, 1.1); rock(p, cx + 6 + jit(8, 4), cy - 2, .8); if (v2 < .5) rock(p, cx + 1, cy + 4, .6); break;
    case 'peak': peak(p, cx, cy, b === 'snow' || v2 < .5, b === 'waste'); break;
    case 'heather': for (let i = 0; i < 14; i++) { const x = cx - 14 + Math.round(hash2(i, c.gx, salt) * 28), y = cy - 5 + Math.round(hash2(c.gy, i, salt) * 10); p.put(x, y, i % 3 ? '#9a5a8a' : '#b87aa8'); p.put(x + 1, y, '#7a4a6a'); } break;
    case 'stone': { const x = cx + jit(9, 8); p.rect(x - 2, cy - 10, 4, 11, '#8a8680'); p.rect(x + 1, cy - 10, 1, 11, '#6a6660'); p.put(x - 2, cy - 10, OUTLINE); break; }
    case 'water': water(p, cx, cy, 22, salt); if (v2 < .3) { p.rect(cx + 4, cy - 1, 5, 2, '#7a5236'); p.put(cx + 6, cy - 3, '#e8e0d0'); } break;
    case 'ash': for (let i = 0; i < 10; i++) { const x = cx - 14 + Math.round(hash2(i, c.gx, salt) * 28), y = cy - 5 + Math.round(hash2(c.gy, i, salt) * 10); p.rect(x, y, 2, 1, '#4a3e38'); } break;
    case 'stump': p.rect(cx - 2, cy - 4, 4, 5, '#3a2c26'); p.rect(cx - 2, cy - 5, 4, 1, '#5a4a40'); p.line(cx + 1, cy - 5, cx + 3, cy - 9, '#3a2c26'); break;
    case 'bones': p.rect(cx - 3, cy - 2, 3, 3, '#e8e0cc'); p.put(cx - 2, cy - 1, '#4a3e38'); for (let i = 0; i < 4; i++) p.hline(cx + 1, cx + 5, cy - 2 + i * 2 - 2, '#d8d0bc'); break;
    case 'crack': for (let i = 0; i < 12; i++) { const x = cx - 10 + i * 2, y = cy - 3 + Math.round(Math.sin(i * 1.7 + v2 * 6) * 2); p.put(x, y, '#ff8a2a'); p.put(x + 1, y, '#e0501a'); } break;
    case 'flowers': for (let i = 0; i < 12; i++) { const x = cx - 14 + Math.round(hash2(i, c.gx, salt) * 28), y = cy - 5 + Math.round(hash2(c.gy, i, salt) * 10); p.put(x, y, ['#f2e25a', '#f07aa0', '#ffffff', '#b890f0'][i % 4]); } break;
    case 'statue': p.rect(cx - 3, cy - 3, 6, 4, '#b0aaa0'); p.rect(cx - 1, cy - 12, 3, 9, '#c8c2b8'); p.rect(cx - 2, cy - 14, 5, 3, '#c8c2b8'); p.put(cx + 1, cy - 12, '#9a948a'); break;
    case 'orchard': for (const [dx, dy] of [[-10, -1], [0, -4], [10, -1], [-5, 4], [5, 4]]) { tree(p, cx + dx, cy + dy, .6, '#4a9a40', dx); p.put(cx + dx - 1, cy + dy - 6, '#e0402a'); p.put(cx + dx + 1, cy + dy - 8, '#e0402a'); } break;
    case 'manor': house(p, cx, cy, 8, 6, 10, '#e0d0b0', '#5a6a8a', 'a', 6); break;
    case 'crossroads': crossroads(p, cx, cy); break;
    default: cityFeature(p, c, cx, cy, salt);
  }
}
function peak(p, cx, cy, snowy, dark) {
  const rock1 = dark ? '#5a4a44' : '#8a8478', R = ramp(rock1);
  const apex = [cx - 2, cy - 30], left = [cx - 20, cy + 4], right = [cx + 20, cy + 4], mid = [cx + 4, cy + 6];
  p.poly([apex, mid, left], R.lit);
  p.poly([apex, right, mid], R.dim);
  if (snowy) { p.poly([apex, [cx + 5, cy - 18], [cx - 1, cy - 16], [cx - 8, cy - 19]], '#f4f8fc'); p.poly([apex, [cx + 5, cy - 18], [cx + 1, cy - 17]], '#cfdcea'); }
  if (dark) { p.put(cx - 2, cy - 30, '#ff8a2a'); p.put(cx - 1, cy - 29, '#e0501a'); }
}
export function crossroads(p, cx, cy) {
  // two roads crossing, and a signpost with four arms
  const col = (x, y) => hash2(x, y, 5) < .5 ? '#b08a5c' : '#a07c50';
  p.poly([[cx - 20, cy - 2], [cx - 16, cy - 4], [cx + 20, cy + 2], [cx + 16, cy + 4]].map(([x, y]) => [x, y]), col);
  p.poly([[cx + 16, cy - 4], [cx + 20, cy - 2], [cx - 16, cy + 4], [cx - 20, cy + 2]], col);
  p.rect(cx - 1, cy - 20, 2, 20, '#6a4a30');
  p.rect(cx - 8, cy - 18, 7, 3, '#c8a878'); p.put(cx - 9, cy - 17, '#c8a878');
  p.rect(cx + 1, cy - 15, 7, 3, '#b89868'); p.put(cx + 8, cy - 14, '#b89868');
  p.rect(cx - 7, cy - 12, 6, 2, '#b89868'); p.rect(cx + 1, cy - 20, 5, 2, '#c8a878');
}

/* ---------- the royal city ---------- */
function cityFeature(p, c, cx, cy, salt) {
  const v2 = c.v2;
  const roofs = ['#b8563f', '#5a6a8a', '#8a5a3a', '#6a4a7a', '#4a6a4a', '#a8883a'];
  const walls = ['#e8dcc0', '#d8c8a8', '#e8e0d0', '#c8b8a0'];
  switch (c.feat) {
    case 'house': {
      const n = v2 < .4 ? 2 : 3;
      const spots = n === 2 ? [[-8, -2], [8, 2]] : [[-10, 0], [2, -4], [8, 4]];
      spots.sort((a, b) => a[1] - b[1]);
      spots.forEach(([dx, dy], i) => house(p, cx + dx, cy + dy, 4 + (i & 1), 4, 9 + Math.round(hash2(i, c.gx, salt) * 8), walls[(i + c.gx) % 4], roofs[(i * 3 + c.gy + c.gx) % 6], (i + c.gx) & 1 ? 'a' : 'b', 5));
      break;
    }
    case 'tower': { const t = tower(p, cx, cy + 2, 6, 24, '#c8c0b0'); cone(p, cx, t.top, 8, 14, roofs[c.gx % 6]); break; }
    case 'plaza': diamond(p, cx, cy, 16, (x, y) => (x + 2 * y) % 8 < 4 ? '#b8b0a0' : '#aaa292'); p.rect(cx - 2, cy - 5, 4, 5, '#8a8478'); p.rect(cx - 3, cy - 6, 6, 1, '#6a6458'); break;
    case 'fountain': diamond(p, cx, cy, 14, '#aaa292'); p.ellipse(cx, cy, 8, 4, '#8a8478'); p.ellipse(cx, cy, 6, 3, WATER.top); p.rect(cx, cy - 7, 1, 6, '#8cc6ef'); break;
    case 'cathedral': cathedral(p, cx, cy); break;
    case 'avenue': diamond(p, cx, cy, 24, (x, y) => (x + 2 * y) % 6 < 3 ? '#9a9486' : '#8e887a'); break;
    case 'wall': case 'castlewall': wall(p, cx, cy, c.feat === 'castlewall' ? '#b8b0a4' : '#a09a8e', false); break;
    case 'walltower': wall(p, cx, cy, '#a09a8e', false); { const t = tower(p, cx, cy + 2, 7, 26, '#a8a296'); crenels(p, cx, t.top, 7); } break;
    case 'gate': wall(p, cx, cy, '#a09a8e', true); break;
    case 'court': diamond(p, cx, cy, 24, (x, y) => (x + 2 * y) % 10 < 5 ? '#c8c0b0' : '#bcb4a4'); break;
    case 'garden': for (let i = -2; i <= 2; i++) bush(p, cx + i * 6, cy - 2 + Math.abs(i), .9, '#3a8a3a'); p.put(cx, cy - 6, '#f07aa0'); p.put(cx + 5, cy - 4, '#f2e25a'); break;
    case 'keep': { const t = tower(p, cx, cy + 2, 8, 34, '#d0c8b8'); crenels(p, cx, t.top, 8); p.rect(cx, t.top - 12, 1, 10, '#5a4a3a'); p.rect(cx + 1, t.top - 12, 5, 3, '#c0302a'); break; }
    case 'hall': {
      // a palace hall: pale stone, a blue roof with gilded ridge, tall windows and a colonnade in front
      const W = ramp('#e2dccc'), Rf = ramp('#3e5288');
      const [x, y] = foot(cx, cy, 10, 6); box(p, x, y, 10, 6, 14, { top: W.lit, left: W.base, right: W.dim });
      const [rx, ry] = foot(cx, cy, 11, 7); const rr = roof(p, rx, ry, 11, 7, 14, 8, { lit: Rf.lit, base: Rf.base, gable: W.dim }, 'a');
      p.line(rr.S[0], rr.S[1], rr.E[0], rr.E[1], '#f2c24c');
      for (let i = 0; i < 4; i++) { const wx = cx - 17 + i * 5, wy = cy + 1 - Math.round(i * 2.4); p.rect(wx, wy - 9, 2, 5, '#f0d27a'); p.put(wx, wy - 10, '#3a3a5a'); }
      for (let i = 0; i < 3; i++) { const px = cx + 6 + i * 5, py = cy + 3 - i * 2; p.rect(px, py - 10, 2, 10, '#f4f0e4'); p.put(px + 1, py - 10, '#c8c0b0'); }
      break;
    }
    default: break;
  }
}
function wall(p, cx, cy, col, gate) {
  const R = ramp(col), h = 16;
  // a straight wall across the tile, left corner to right corner, with crenellations along the top
  p.rect(cx - 24, cy - h, 48, h, R.base);
  p.poly([[cx - 24, cy - h], [cx + 24, cy - h], [cx + 22, cy - h - 3], [cx - 22, cy - h - 3]], R.lit);
  for (let x = cx - 24; x < cx + 24; x += 4) p.rect(x, cy - h - 5, 2, 2, R.lit);
  for (let y = cy - h + 3; y < cy; y += 4) for (let x = cx - 24 + ((y >> 2) & 1) * 3; x < cx + 24; x += 6) p.rect(x, y, 5, 1, R.dim);
  if (gate) { p.rect(cx - 6, cy - 12, 12, 12, '#2a2230'); p.ellipse(cx, cy - 12, 6, 4, '#2a2230'); for (let x = cx - 5; x <= cx + 5; x += 2) p.vline(x, cy - 14, cy - 1, '#4a4038'); }
}
function crenels(p, cx, top, r) { for (let i = -r; i < r; i += 3) p.rect(cx + i, top - 3, 2, 3, '#c8c0b0'); }
function cathedral(p, cx, cy) {
  const W = ramp('#d8d0c0'), Rf = ramp('#4a5a7a');
  const [x, y] = foot(cx, cy + 2, 12, 7);
  box(p, x, y, 12, 7, 16, { top: W.lit, left: W.base, right: W.dim });
  const [rx, ry] = foot(cx, cy + 2, 13, 8);
  roof(p, rx, ry, 13, 8, 16, 9, { lit: Rf.lit, base: Rf.base, gable: W.dim }, 'a');
  const t = tower(p, cx - 12, cy - 2, 5, 34, '#d8d0c0'); cone(p, cx - 12, t.top, 6, 16, '#4a5a7a');
  p.disc(cx + 12, cy - 6, 3, '#6a8ac8'); p.put(cx + 12, cy - 6, '#f0d27a');
}

// A plain ground block with its feature, as one sprite.
export function landSprite(c, salt, path) {
  const p = new Px(SPRITE.w, SPRITE.h);
  ground(p, c.biome, c.h, salt + c.gx * 131 + c.gy * 71, { path });
  feature(p, c, salt);
  return p;
}
// A fog tile: a soft puff of cloud in the shape of the tile, for the parts of the kingdom nobody in your family has
// seen. Low and bluish, so it sits back behind the lit road rather than glaring.
export function fogSprite(k) {
  const p = new Px(SPRITE.w, SPRITE.h), y0 = HEAD - 4;
  const lo = '#5e6480', mid = '#6f7592', hi = '#848aa6', top = '#9aa0ba';
  p.poly([[24, y0 + 1], [49, y0 + 14], [24, y0 + 27], [-1, y0 + 14]], (x, y) => hash2(x >> 1, y >> 1, k * 17 + 3) < .12 ? lo : mid);
  for (let i = 0; i < 6; i++) {
    const px = 7 + Math.round(hash2(i, k, 9) * 34), py = y0 + 6 + Math.round(hash2(k, i, 9) * 14), rx = 5 + Math.round(hash2(i, k, 4) * 4);
    p.ellipse(px, py, rx, rx * .55, (x, y, nx, ny) => ny < -.45 ? top : ny < .15 ? hi : mid);
  }
  return p;
}
