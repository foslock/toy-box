// All the pixel art, drawn in code onto small canvases: ground tiles, buildings, props, people. Soft pastels, no black.
import { T, G, MAPS } from './world.js';
import { hash } from './util.js';

export const C = {
  grass: '#bfe6a0', grass2: '#b2dd94', grass3: '#cdeeb0', tuft: '#93c97c', path: '#efdcb0', path2: '#e2c994', cobble: '#e9ded0', cobble2: '#d8c9b8', sand: '#f6e8c0', sand2: '#ecd9a6',
  water: '#8fd6ea', water2: '#a9e4f3', water3: '#7cc6df', deep: '#6fc0dd', deep2: '#5fb2d2', plank: '#e2bc8c', plank2: '#c9a070', floor: '#f0d2a2', floor2: '#e2bb86', wall: '#f6e6c6', wall2: '#e8cfa4',
  rail: '#cdbfae', rail2: '#8f98ac', hill: '#cdeea6', hill2: '#bde39a', cliff: '#c5b3a3', cliff2: '#a89686', stone: '#d3d5de', stone2: '#b9bccb', plat: '#e8e2d6', plat2: '#f2cf7a',
  ink: '#6c5a78', shadow: 'rgba(96,78,128,.2)',
};
const ROOF = { peach: ['#f6ad94', '#e5937a', '#fbc6b2'], butter: ['#f8d584', '#e6bd62', '#fde5ab'], lav: ['#bfaee8', '#a794d6', '#d6c9f4'], mint: ['#97d9bb', '#7bc2a2', '#b6ead2'], sky: ['#94c8f0', '#78b0de', '#b6dbf8'], rose: ['#f2a3b4', '#e0899c', '#f8c2cd'] };
const WALL = { cream: ['#fff3d8', '#efddb6'], rose: ['#fcdad4', '#ecc0b8'], mint: ['#dbf2e4', '#c0e0cf'] };

export const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };
const r = (x, col, a, b, w, h) => { x.fillStyle = col; x.fillRect(a, b, w, h); };

/* ---------------------------------------------------------------------------------------------- tiny pixel lettering */
const FONT = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', Y: '101101010010010', Z: '111001010100111', '0': '111101101101111', '7': '111001010010010', '5': '111100111001111', '6': '111100111101111', '4': '101101111001001', '8': '111101111101111', ':': '000010000010000', '.': '000000000000010', ' ': '000000000000000', '&': '010101010101011', '-': '000000111000000', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '9': '111101111001110', J: '001001001101010', Q: '010101101110011', X: '101101010101101', '?': '110001010000010', '!': '010010010000010', "'": '010010000000000', ',': '000000000010100' };
export function letters(x, text, px, py, col) { let cx = px; for (const ch of text.toUpperCase()) { const g = FONT[ch] || FONT[' ']; for (let i = 0; i < 15; i++) if (g[i] === '1') r(x, col, cx + (i % 3), py + ((i / 3) | 0), 1, 1); cx += 4; } return cx - px; }
export const textW = t => t.length * 4 - 1;

/* ---------------------------------------------------------------------------------------------- ground */
function grassTile(x, gx, gy, base = C.grass, hi = C.grass3, lo = C.grass2, flowers = true) {
  r(x, base, 0, 0, T, T);
  for (let i = 0; i < 5; i++) { const h = hash(gx * 7 + i, gy * 13 + i, 3); r(x, h < .5 ? hi : lo, (h * 997 % 14) | 0, ((h * 313) % 14) | 0, 2, 1); }
  const h = hash(gx, gy, 9);
  if (h < .22) { const px = (hash(gx, gy, 1) * 12 | 0) + 1, py = (hash(gx, gy, 2) * 11 | 0) + 3; r(x, C.tuft, px, py, 1, 2); r(x, C.tuft, px + 2, py + 1, 1, 2); r(x, C.tuft, px + 1, py - 0, 1, 1); }
  if (flowers && h > .93) { const px = (hash(gx, gy, 5) * 11 | 0) + 2, py = (hash(gx, gy, 6) * 11 | 0) + 2, col = ['#fff', '#ffd3df', '#fff0a8', '#d6ccff'][(hash(gx, gy, 7) * 4) | 0]; r(x, col, px, py, 1, 1); r(x, col, px - 1, py + 1, 1, 1); r(x, col, px + 1, py + 1, 1, 1); r(x, col, px, py + 2, 1, 1); r(x, '#ffe07a', px, py + 1, 1, 1); }
}
function pathTile(x, gx, gy, a, b) { r(x, a, 0, 0, T, T); for (let i = 0; i < 6; i++) { const h = hash(gx * 3 + i, gy * 5 + i, 11); r(x, b, (h * 991 % 14) | 0, (h * 457 % 14) | 0, 2, 1); } }
export function groundTile(x, g, gx, gy, area) {
  const at = (dx, dy) => area.at(gx + dx, gy + dy);
  switch (g) {
    case G.GRASS: grassTile(x, gx, gy); break;
    case G.HILL: grassTile(x, gx, gy, C.hill, '#dcf5b8', C.hill2); break;
    case G.PATH: pathTile(x, gx, gy, C.path, C.path2); break;
    case G.COBBLE: { r(x, '#ddd0bb', 0, 0, T, T); const tones = ['#efe5d4', '#e8dcc8', '#f3eadb', '#ebe0cd']; for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) { const off = row % 2 ? 2 : 0, px = i * 4 + off - (off && i === 3 ? 4 : 0), py = row * 5 + 0, tone = tones[(hash(gx * 4 + i, gy * 3 + row, 21) * 4) | 0]; r(x, tone, px + 1, py + 1, 3, 3); r(x, '#f8f2e6', px + 1, py + 1, 2, 1); } r(x, '#e2d6c2', 0, 15, T, 1); break; }
    case G.PLATFORM: { r(x, C.plat, 0, 0, T, T); if (gy === 39) { r(x, C.plat2, 0, 12, T, 2); } if (hash(gx, gy, 2) < .3) r(x, '#ddd5c6', 3, 6, 5, 1); break; }
    case G.SAND: r(x, C.sand, 0, 0, T, T); for (let i = 0; i < 4; i++) { const h = hash(gx + i, gy, 5); r(x, C.sand2, (h * 991 % 14) | 0, (h * 457 % 14) | 0, 2, 1); } break;
    case G.PLANK: { r(x, C.plank, 0, 0, T, T); for (let i = 0; i < 4; i++) r(x, C.plank2, 0, i * 4 + 3, T, 1); r(x, C.plank2, (gx % 2) * 8 + 3, 0, 1, 3); break; }
    case G.RAIL: { r(x, C.rail, 0, 0, T, T); if (gy === 40) { r(x, C.rail2, 0, 4, T, 2); r(x, '#e9e0d2', 0, 6, T, 1); for (let i = 0; i < 4; i++) r(x, '#b59a7c', i * 4 + 1, 1, 2, 12); } else { r(x, C.rail2, 0, 9, T, 2); for (let i = 0; i < 4; i++) r(x, '#b59a7c', i * 4 + 1, 7, 2, 7); } break; }
    case G.STONE: { r(x, C.stone, 0, 0, T, T); r(x, C.stone2, 0, 15, T, 1); r(x, C.stone2, (gx % 2) * 8, 0, 1, 8); r(x, C.stone2, ((gx + 1) % 2) * 8 + 4, 8, 1, 8); r(x, C.stone2, 0, 7, T, 1); if (gy === 3) { r(x, '#e6e8f0', 0, 0, T, 2); } else { r(x, '#c1c4d3', 0, 0, T, 1); } break; }
    case G.CLIFF: { r(x, C.cliff, 0, 0, T, T); for (let i = 0; i < 5; i++) { const h = hash(gx * 3 + i, gy, 17); r(x, C.cliff2, (h * 991 % 12) | 0, (h * 457 % 12) | 0, 4, 2); } r(x, '#d8c8b8', 0, 0, T, 2); break; }
    case G.WALL: { r(x, C.wall, 0, 0, T, T); r(x, C.wall2, 0, 14, T, 2); r(x, '#fff8e6', 0, 0, T, 1); if (gx % 2 === 0) r(x, C.wall2, 15, 2, 1, 12); break; }
    case G.RUG: { r(x, '#f3c4c0', 0, 0, T, T); r(x, '#e8a8a8', 0, 0, T, 2); r(x, '#e8a8a8', 0, 14, T, 2); for (let i = 0; i < 4; i++) r(x, '#fbe0d8', 2 + i * 4, 6, 2, 3); break; }
    case G.TILE: r(x, ((gx + gy) & 1) ? '#f6ede0' : '#e6d8c6', 0, 0, T, T); break;
    case G.FLOOR: { r(x, C.floor, 0, 0, T, T); r(x, C.floor2, 0, 15, T, 1); r(x, C.floor2, (gx % 2) * 8 + 4, 0, 1, T); break; }
    case G.WATER: case G.DEEP: r(x, g === G.WATER ? C.water : C.deep, 0, 0, T, T); break;
    default: r(x, C.grass, 0, 0, T, T);
  }
}

export function bakeGround(area) {
  const [c, x] = mk(area.w * T, area.h * T);
  const tile = mk(T, T);
  for (let gy = 0; gy < area.h; gy++) for (let gx = 0; gx < area.w; gx++) {
    const g = area.g[gy * area.w + gx];
    if (g === G.WATER || g === G.DEEP) continue;
    tile[1].clearRect(0, 0, T, T); groundTile(tile[1], g, gx, gy, area); x.drawImage(tile[0], gx * T, gy * T);
    // a soft edge where a path meets grass, and where the cliff meets the hill
    if ((g === G.PATH || g === G.COBBLE) && !area.interior) { for (const [dx, dy, ex, ey, ew, eh] of [[0, -1, 0, 0, T, 1], [0, 1, 0, 15, T, 1], [-1, 0, 0, 0, 1, T], [1, 0, 15, 0, 1, T]]) { const n = area.at(gx + dx, gy + dy); if (n === G.GRASS || n === G.HILL) { r(x, g === G.PATH ? C.path2 : C.cobble2, gx * T + ex, gy * T + ey, ew, eh); } } }
  }
  return c;
}

// animated water: four frames of a tile, drawn over the river and the reservoir each frame
export function waterFrames() {
  const out = [];
  for (const deep of [false, true]) {
    const f = [];
    for (let k = 0; k < 4; k++) {
      const [c, x] = mk(T, T);
      r(x, deep ? C.deep : C.water, 0, 0, T, T);
      for (let i = 0; i < 3; i++) { const yy = (i * 5 + k * 2) % 16, xx = (i * 7 + k * 3) % 11; r(x, deep ? C.deep2 : C.water3, xx, yy, 5, 1); r(x, deep ? C.water3 : C.water2, xx + 2, (yy + 1) % 16, 4, 1); }
      const sp = (k * 5) % 14; r(x, '#fff', sp, (sp * 3 + 2) % 15, 1, 1);
      f.push(c);
    }
    out.push(f);
  }
  return out;
}

/* ---------------------------------------------------------------------------------------------- buildings */
function roofShade(x, col, w, y0, y1) {
  r(x, col[0], 0, y0, w, y1 - y0);
  for (let yy = y0 + 3; yy < y1; yy += 4) {
    r(x, col[1], 0, yy, w, 1);
    for (let xx = ((yy / 4) | 0) % 2 * 4; xx < w; xx += 8) { r(x, col[1], xx, yy - 2, 1, 2); r(x, col[2], xx + 1, yy - 3, 3, 1); if (hash(xx, yy, 31) < .3) r(x, 'rgba(255,255,255,.14)', xx + 1, yy - 2, 6, 2); else if (hash(xx, yy, 32) < .15) r(x, 'rgba(120,80,120,.08)', xx + 1, yy - 2, 6, 2); }
  }
  r(x, col[2], 0, y0, w, 2); r(x, col[1], 0, y0 + 2, w, 1);
  r(x, 'rgba(90,60,100,.16)', 0, y1 - 4, w, 3); r(x, col[1], 0, y1 - 1, w, 1);
}
function win(x, a, b, w = 7, h = 8, lit = '#bfe6f6') { r(x, '#a58f7a', a - 1, b - 1, w + 2, h + 2); r(x, lit, a, b, w, h); r(x, '#e9f7fc', a, b, w, 2); r(x, '#a58f7a', a + ((w / 2) | 0), b, 1, h); r(x, '#a58f7a', a, b + ((h / 2) | 0), w, 1); r(x, '#f4b8c4', a - 1, b + h + 1, w + 2, 1); }
function door(x, a, b, col = '#c98d6a') { r(x, '#a9714f', a - 1, b - 1, 12, 17); r(x, col, a, b, 10, 16); r(x, '#e7b891', a + 1, b + 1, 3, 6); r(x, '#e7b891', a + 6, b + 1, 3, 6); r(x, '#f6d36a', a + 7, b + 9, 2, 2); }

// Each building is drawn as one picture: `up` tiles of roof above the footprint, then the footprint rows.
export function houseSprite(p) {
  const w = p.w * T, h = (p.h + p.up) * T, [c, x] = mk(w, h);
  const roof = ROOF[p.roof] || ROOF.peach, wall = WALL[p.wall] || WALL.cream, wallTop = (p.h + p.up - 2) * T;
  const dx = p.style === 'office' ? 2 : (p.style === 'chapel' || p.style === 'hall' || p.style === 'fire') ? (p.style === 'hall' ? 4 : 3) : 3;
  const doorX = (p.doorDx ?? dx) * T;
  // wall
  r(x, wall[0], 0, wallTop - 2, w, h - wallTop + 2); r(x, wall[1], 0, h - 3, w, 3); r(x, wall[1], 0, wallTop - 2, w, 2);
  for (let i = 0; i < p.w; i++) if (i !== dx) {
    if (p.style === 'fire' && i > 1 && i < 6) continue;
    if (i % 2 === 1 || p.w > 5) win(x, i * T + 4, wallTop + 6);
  }
  // roof
  let roofTop = 0;
  if (p.style === 'chapel') {
    // the tower on the right, taller than the nave
    roofShade(x, roof, w - 2 * T, 3 * T - 2, wallTop - 2); roofTop = 3 * T;
    const tx = w - 2 * T; r(x, wall[0], tx, 1 * T, 2 * T, h - 1 * T - 3); r(x, wall[1], tx, 1 * T, 2, h - 1 * T); r(x, wall[1], tx + 2 * T - 2, 1 * T, 2, h - 1 * T);
    roofShade(x, roof, 2 * T, 0, 1 * T + 4); r(x, '#f6d36a', tx + 15, 0, 2, 3);
    r(x, '#7f6a5a', tx + 8, 3 * T + 4, 16, 18); r(x, '#4e3d49', tx + 10, 3 * T + 6, 12, 14);   // the bell's opening (the bell itself is drawn live)
    { const cx = (w - 2 * T) / 2 | 0, cy = 5 * T + 4; for (let yy = -9; yy <= 9; yy++) for (let xx = -9; xx <= 9; xx++) { const d = Math.hypot(xx, yy); if (d <= 9) r(x, d > 7.4 ? '#a58f7a' : (xx + yy) % 5 === 0 ? '#fff' : '#cfc4f2', cx + xx, cy + yy, 1, 1); } r(x, '#a58f7a', cx - 8, cy, 17, 1); r(x, '#a58f7a', cx, cy - 8, 1, 17); r(x, '#f2cf7a', cx - 5, 3 * T - 9, 11, 1); r(x, '#f2cf7a', cx, 3 * T - 14, 1, 9); }
  } else if (p.style === 'hall') {
    roofShade(x, roof, w, 2 * T, wallTop - 2);
    r(x, roof[1], 3 * T, 0, 3 * T, 2 * T); r(x, roof[0], 3 * T, 0, 3 * T, 2 * T - 2); r(x, roof[2], 3 * T, 0, 3 * T, 2); r(x, wall[0], 3 * T + 4, 2 * T - 2, 3 * T - 8, 6);
    r(x, '#f7efe2', 3 * T + 12, 6, 24, 24); r(x, '#a58f7a', 3 * T + 11, 5, 26, 26); r(x, '#fffaf0', 3 * T + 12, 6, 24, 24);
  } else if (p.style === 'fire') {
    roofShade(x, roof, w, 2 * T, wallTop - 2);
    // the siren tower: a post with a horn on top
    for (let yy = 4; yy < 2 * T + 2; yy += 5) { r(x, '#a89a8e', 3 * T + 4, yy, 1, 5); r(x, '#a89a8e', 3 * T + 11, yy, 1, 5); r(x, '#a89a8e', 3 * T + 5 + ((yy / 5 | 0) % 2 ? 0 : 5) - ((yy / 5 | 0) % 2 ? 0 : 0), yy + 2, 2, 1); r(x, '#a89a8e', 3 * T + 8 - ((yy / 5 | 0) % 2 ? 0 : 3), yy, 1, 1); } r(x, '#a89a8e', 3 * T + 3, 2 * T, 10, 2);
    // big garage door
    r(x, '#e8d2b4', 1 * T + 4, wallTop + 4, 4 * T, 3 * T - 10); r(x, '#d6bd9a', 1 * T + 4, wallTop + 4, 4 * T, 2); for (let i = 0; i < 5; i++) r(x, '#d6bd9a', 1 * T + 6 + i * 12, wallTop + 6, 1, 3 * T - 14);
  } else if (p.style === 'office') {
    roofShade(x, roof, w, 0, wallTop - 2);
  } else if (p.style === 'mill') {
    roofShade(x, roof, w, 0, wallTop - 2); r(x, '#b8a898', 5 * T + 2, -0, 8, 6);
  } else {
    roofShade(x, roof, w, 0, wallTop - 2);
    if (p.style === 'bakery') { r(x, '#f2a3b4', 1 * T, wallTop - 2, 5 * T, 8); for (let i = 0; i < 10; i++) if (i % 2) r(x, '#fff', 1 * T + i * 8, wallTop - 2, 8, 8); r(x, '#e08aa0', 1 * T, wallTop + 6, 5 * T, 1); }
    if (p.style === 'inn') { r(x, '#a58f7a', 7 * T - 3, wallTop + 2, 2, 12); r(x, '#9ad0c0', 7 * T - 8, wallTop + 4, 10, 8); r(x, '#fff', 7 * T - 5, wallTop + 6, 4, 4); }
    if (p.style === 'clock') { const cx = 3 * T + 8; r(x, '#a58f7a', cx - 14, 6, 28, 28); r(x, '#fffaf0', cx - 12, 8, 24, 24); }
  }
  // sign and door
  const names = { clock: 'CLOCKS', bakery: 'BAKERY', inn: 'DROWSY HERON', hall: 'TOWN HALL', fire: 'FIRE', mill: 'ORLA', chapel: '', office: 'TICKETS' };
  const nm = names[p.style];
  if (nm) { const tw = textW(nm) + 6, sx = ((p.w * T - tw) / 2 | 0); const sy = p.style === 'fire' ? wallTop + 1 : (p.style === 'inn' ? wallTop + 3 : wallTop - 9); r(x, '#8c735f', sx - 1, sy - 1, tw + 2, 9); r(x, '#f6e0b4', sx, sy, tw, 7); letters(x, nm, sx + 3, sy + 1, '#7a5a4a'); }
  if (p.style !== 'fire' || true) { const doorPx = (p.style === 'fire' ? 3 : dx) * T; if (p.style === 'fire') { /* the door is a little one cut into the big door */ } door(x, doorPx + 3, h - 17, p.style === 'office' ? '#d6a888' : '#c98d6a'); }
  // flower box / bushes at the feet
  for (let i = 0; i < p.w; i++) if (i !== dx && hash(i, p.x * 3 + p.y, 8) < .45) { r(x, '#8fcf86', i * T + 3, h - 4, 10, 4); r(x, ['#ffb7c9', '#fff0a8', '#e1d3ff'][i % 3], i * T + 5, h - 5, 2, 2); r(x, ['#ffb7c9', '#fff0a8'][i % 2], i * T + 9, h - 6, 2, 2); }
  return c;
}

/* ---------------------------------------------------------------------------------------------- props */
const PROP = {};
PROP.tree = p => { const [c, x] = mk(T * 2, T * 3); const j = ((p.seed || 0) * 100 | 0) % 3; const col = ['#8fd08a', '#9ad88f', '#85c984'][j], dark = ['#74b872', '#80c27c', '#6eb06e'][j];
  r(x, '#c79a72', 14, 32, 4, 14); r(x, '#a97d58', 16, 32, 2, 14);
  for (const [a, b, rad] of [[16, 14, 13], [8, 22, 8], [24, 22, 8], [16, 26, 9]]) { for (let yy = -rad; yy <= rad; yy++) { const hw = Math.round(Math.sqrt(rad * rad - yy * yy)); r(x, col, a - hw, b + yy, hw * 2, 1); } }
  for (const [a, b] of [[10, 18], [20, 12], [22, 24], [12, 26]]) { r(x, dark, a, b, 5, 2); r(x, '#b6ec9f', a + 1, b - 3, 3, 1); }
  r(x, '#ffd0dc', 12, 9, 2, 2); r(x, '#fff3a0', 22, 20, 2, 2); r(x, '#ffd0dc', 9, 25, 2, 2); return c; };
PROP.bush = () => { const [c, x] = mk(T, T); r(x, '#8fd08a', 2, 6, 12, 8); r(x, '#9ad88f', 4, 3, 8, 6); r(x, '#74b872', 2, 12, 12, 2); r(x, '#ffd0dc', 5, 6, 2, 2); r(x, '#fff3a0', 10, 9, 2, 2); r(x, '#b6ec9f', 5, 4, 3, 1); return c; };
PROP.flowers = p => { const [c, x] = mk(T, T); for (let i = 0; i < 7; i++) { const a = ((hash(i, p.seed, 1) * 13) | 0) + 1, b = ((hash(i, p.seed, 2) * 11) | 0) + 3, col = ['#ffd0dc', '#fff3a0', '#fff', '#d6ccff', '#ffb27a'][i % 5]; r(x, '#7fc479', a, b + 1, 1, 3); r(x, col, a - 1, b, 3, 1); r(x, col, a, b - 1, 1, 3); r(x, '#ffe07a', a, b, 1, 1); } return c; };
PROP.fence = () => { const [c, x] = mk(T, T); r(x, '#fff', 0, 7, T, 2); r(x, '#e7dccd', 0, 9, T, 1); for (let i = 0; i < 4; i++) { r(x, '#fff', i * 4 + 1, 3, 3, 10); r(x, '#e7dccd', i * 4 + 3, 3, 1, 10); r(x, '#fff', i * 4 + 1, 2, 3, 1); } return c; };
PROP.bench = p => { const w = p.w * T, [c, x] = mk(w, T); r(x, '#c9a070', 1, 4, w - 2, 3); r(x, '#e2bc8c', 1, 4, w - 2, 1); r(x, '#c9a070', 1, 8, w - 2, 3); r(x, '#e2bc8c', 1, 8, w - 2, 1); r(x, '#8a6a4a', 2, 11, 2, 5); r(x, '#8a6a4a', w - 4, 11, 2, 5); r(x, '#8a6a4a', 2, 2, 2, 5); r(x, '#8a6a4a', w - 4, 2, 2, 5); return c; };
PROP.lamp = () => { const [c, x] = mk(T, T * 3); r(x, '#9a94a8', 7, 10, 2, 38); r(x, '#7e788e', 5, 44, 6, 4); r(x, '#fff0b0', 4, 4, 8, 8); r(x, '#ffe58a', 5, 5, 6, 6); r(x, '#9a94a8', 3, 2, 10, 2); r(x, '#9a94a8', 3, 12, 10, 1); return c; };
PROP.pole = () => { const [c, x] = mk(T, T * 3); r(x, '#c9a070', 7, 4, 2, 44); r(x, '#e2bc8c', 7, 4, 1, 44); r(x, '#f6d36a', 6, 2, 4, 3); return c; };
PROP.sign = () => { const [c, x] = mk(T, T * 2); r(x, '#a97d58', 7, 12, 2, 20); r(x, '#e2bc8c', 1, 4, 14, 10); r(x, '#c9a070', 1, 13, 14, 1); r(x, '#8a6a4a', 3, 7, 10, 1); r(x, '#8a6a4a', 3, 10, 7, 1); return c; };
PROP.board = p => { const w = p.w * T, [c, x] = mk(w, T * 2); r(x, '#a97d58', 3, 10, 2, 22); r(x, '#a97d58', w - 5, 10, 2, 22); r(x, '#8a6a4a', 1, 2, w - 2, 14); r(x, '#efdcb0', 3, 4, w - 6, 10); for (let i = 0; i < 4; i++) { r(x, '#fff', 5 + i * 7, 5 + (i % 2), 5, 6); r(x, '#e8a8a8', 7 + i * 7, 5 + (i % 2), 1, 1); } return c; };
PROP.postclock = () => { const [c, x] = mk(T, T * 3); r(x, '#8f98ac', 7, 16, 2, 32); r(x, '#6f788c', 5, 44, 6, 4); r(x, '#8f98ac', 1, 0, 14, 14); r(x, '#fffaf0', 2, 1, 12, 12); r(x, '#6c5a78', 8, 2, 1, 5); r(x, '#6c5a78', 7, 7, 1, 1); r(x, '#6c5a78', 6, 8, 1, 1); r(x, '#6c5a78', 8, 7, 1, 1); r(x, '#e0606a', 8, 7, 1, 1); return c; };
PROP.fountain = () => { const [c, x] = mk(T * 2, T * 3); r(x, '#d3d5de', 2, 24, 28, 22); r(x, '#e6e8f0', 2, 24, 28, 3); r(x, '#8fd6ea', 5, 28, 22, 14); r(x, '#b8ecf8', 7, 30, 8, 2); r(x, '#d3d5de', 13, 12, 6, 14); r(x, '#e6e8f0', 11, 10, 10, 3); return c; };
PROP.bucket = () => { const [c, x] = mk(T, T); r(x, '#b8a9d6', 3, 5, 10, 9); r(x, '#d2c6ea', 3, 5, 10, 2); r(x, '#8fd6ea', 4, 6, 8, 2); for (const [a, b] of [[5, 5], [8, 4], [10, 6]]) { r(x, '#d9e6f2', a, b, 3, 1); r(x, '#9ab8d0', a + 2, b, 1, 1); } return c; };
PROP.plaque = () => { const [c, x] = mk(T, T); r(x, '#e8c875', 3, 3, 10, 8); r(x, '#c9a050', 3, 10, 10, 1); r(x, '#8a6a4a', 5, 5, 6, 1); r(x, '#8a6a4a', 5, 7, 4, 1); return c; };
PROP.wheel = () => { const [c, x] = mk(T, T * 3); r(x, '#a97d58', 6, 4, 10, 40); return c; };
PROP.sluice = () => { const [c, x] = mk(T * 3, T * 3); for (let i = 0; i < 3; i++) { r(x, '#9ea3b8', i * 16 + 3, 6, 10, 26); r(x, '#7e849c', i * 16 + 3, 6, 10, 2); r(x, '#bfc4d6', i * 16 + 7, 2, 2, 6); } r(x, '#b78e68', 18, 0, 12, 2); r(x, '#e9a8b8', 20, 2, 8, 6); r(x, '#c98aa0', 22, 8, 4, 2); return c; };
PROP.crack = () => { const [c, x] = mk(T, T); r(x, '#8a8fa8', 8, 0, 2, 4); r(x, '#8a8fa8', 6, 4, 2, 4); r(x, '#8a8fa8', 8, 8, 2, 4); r(x, '#8a8fa8', 6, 12, 2, 4); r(x, '#8fd6ea', 8, 4, 1, 12); return c; };
PROP.sheet = p => { const [c, x] = mk(T, T * 2); r(x, '#c9a070', 0, 0, T, 2); const col = ['#fff', '#ffd3df', '#d6f0ff', '#fff0a8', '#e1d3ff'][(p.seed | 0) % 5]; r(x, col, 2, 2, 12, 14); r(x, '#00000010', 2, 14, 12, 2); r(x, 'rgba(120,100,160,.18)', 2, 2, 1, 14); r(x, 'rgba(120,100,160,.18)', 8, 2, 1, 14); r(x, '#c9a070', 7, 0, 2, 6); return c; };
PROP.duck = () => { const [c, x] = mk(T, T); r(x, '#fff3b0', 5, 7, 7, 5); r(x, '#fff3b0', 9, 4, 4, 4); r(x, '#ffb347', 13, 6, 2, 2); r(x, '#6c5a78', 11, 5, 1, 1); r(x, '#ffe58a', 6, 9, 4, 2); return c; };
PROP.stage = () => { const [c, x] = mk(T * 3, T * 4); r(x, '#e2bc8c', 0, 38, T * 3, 10); r(x, '#c9a070', 0, 46, T * 3, 2); r(x, '#f0d2a2', 0, 32, T * 3, 6); return c; };

// interior furniture
const furn = {
  counter: p => { const w = p.w * T, [c, x] = mk(w, T); r(x, '#d9a878', 0, 3, w, 11); r(x, '#f2cf9c', 0, 3, w, 3); r(x, '#b98858', 0, 13, w, 3); for (let i = 0; i < p.w; i++) r(x, '#c9985f', i * T + 3, 8, 10, 4); return c; },
  table: p => { const w = p.w * T, [c, x] = mk(w, T); r(x, '#e2bc8c', 1, 3, w - 2, 8); r(x, '#f6d8ac', 1, 3, w - 2, 2); r(x, '#a97d58', 2, 11, 2, 5); r(x, '#a97d58', w - 4, 11, 2, 5); r(x, '#fff', 4, 4, 5, 3); r(x, '#f4b8c4', 5, 4, 3, 1); return c; },
  desk: p => furn.table(p), stool: () => { const [c, x] = mk(T, T); r(x, '#d9a878', 3, 6, 10, 4); r(x, '#a97d58', 4, 10, 2, 5); r(x, '#a97d58', 10, 10, 2, 5); return c; },
  plant: () => { const [c, x] = mk(T, T * 2); r(x, '#c98d6a', 4, 22, 8, 8); r(x, '#8fd08a', 3, 10, 10, 12); r(x, '#a6e29c', 5, 6, 6, 8); r(x, '#74b872', 3, 20, 10, 2); return c; },
  shelf: p => { const w = p.w * T, h = p.h * T, [c, x] = mk(w, h); r(x, '#c9a070', 0, 2, w, h - 4); for (let j = 0; j < p.h; j++) { r(x, '#a97d58', 0, j * T + 12, w, 2); for (let i = 0; i < p.w * 2; i++) { const col = ['#f4b8c4', '#b8d8f4', '#fff0a8', '#cfc4f2', '#bde8c8'][(i + j * 3) % 5]; r(x, col, i * 8 + 1, j * T + 4, 6, 8); } } return c; },
  window: p => { const w = p.w * T, h = p.h * T, [c, x] = mk(w, h); r(x, '#a58f7a', 3, 3, w - 6, h - 6); r(x, '#bfe6f6', 5, 5, w - 10, h - 10); r(x, '#e9f7fc', 5, 5, w - 10, 4); r(x, '#a58f7a', (w / 2) | 0, 5, 1, h - 10); r(x, '#f4b8c4', 2, 5, 3, h - 10); r(x, '#f4b8c4', w - 5, 5, 3, h - 10); return c; },
  fireplace: () => { const [c, x] = mk(T * 3, T * 2); r(x, '#d6c3b0', 2, 4, T * 3 - 4, T * 2 - 4); r(x, '#4f4150', 10, 12, T * 3 - 20, T * 2 - 12); r(x, '#e9d9c6', 2, 2, T * 3 - 4, 4); return c; },
  easel: () => { const [c, x] = mk(T, T * 2); r(x, '#a97d58', 3, 14, 2, 18); r(x, '#a97d58', 11, 14, 2, 18); r(x, '#3f5a54', 2, 3, 12, 14); r(x, '#c9a070', 2, 17, 12, 1); r(x, '#e8f4ea', 4, 6, 7, 1); r(x, '#e8f4ea', 4, 9, 5, 1); return c; },
  clockwall: p => { const [c, x] = mk(T * 2, T * 2); for (const [a, b, s] of [[3, 3, 12], [18, 6, 9], [20, 18, 8], [4, 19, 8]]) { r(x, '#a58f7a', a - 1, b - 1, s + 2, s + 2); r(x, '#fffaf0', a, b, s, s); r(x, '#6c5a78', a + ((s / 2) | 0), b + 2, 1, (s / 2) | 0); r(x, '#6c5a78', a + ((s / 2) | 0), b + ((s / 2) | 0), (s / 3) | 0, 1); } return c; },
  grand: () => { const [c, x] = mk(T, T * 3); r(x, '#a97d58', 2, 4, 12, 44); r(x, '#c9a070', 3, 5, 10, 42); r(x, '#fffaf0', 4, 7, 8, 8); r(x, '#6c5a78', 8, 9, 1, 4); r(x, '#6c5a78', 8, 12, 3, 1); r(x, '#8a6a4a', 5, 20, 6, 18); r(x, '#f2cf7a', 7, 30, 2, 4); return c; },
  oven: () => { const [c, x] = mk(T * 2, T * 2); r(x, '#e0a89a', 2, 3, T * 2 - 4, T * 2 - 4); r(x, '#4f4150', 6, 10, 20, 14); r(x, '#ffb067', 8, 14, 16, 8); r(x, '#ffd58a', 10, 17, 12, 5); return c; },
  loaves: () => { const [c, x] = mk(T * 3, T * 2); r(x, '#d9a878', 0, 4, T * 3, 3); r(x, '#d9a878', 0, 20, T * 3, 3); for (const [a, b, w, col] of [[3, 0, 10, '#e5ad6a'], [18, 0, 8, '#d99a58'], [30, 1, 12, '#edb97a'], [4, 17, 12, '#e5ad6a'], [22, 17, 9, '#f0c48a']]) { r(x, col, a, b + (b < 8 ? 0 : 0), w, 4); r(x, '#fff', a + 2, b + 1, 3, 1); } return c; },
  portrait: () => { const [c, x] = mk(T * 2, T * 2); r(x, '#e8c875', 4, 2, 24, 28); r(x, '#e8cfa4', 6, 4, 20, 24); r(x, '#e8903a', 11, 9, 10, 10); r(x, '#e8903a', 11, 6, 3, 4); r(x, '#e8903a', 18, 6, 3, 4); r(x, '#6c5a78', 13, 12, 1, 1); r(x, '#6c5a78', 18, 12, 1, 1); r(x, '#f2cf7a', 8, 22, 16, 3); return c; },
  basket: () => { const [c, x] = mk(T, T); r(x, '#d9a878', 2, 7, 12, 7); r(x, '#f2cf9c', 2, 7, 12, 2); r(x, '#e8903a', 4, 5, 8, 3); return c; },
  lectern: () => { const [c, x] = mk(T, T * 2); r(x, '#a97d58', 6, 14, 4, 16); r(x, '#c9a070', 2, 8, 12, 7); r(x, '#fffaf0', 3, 6, 10, 4); r(x, '#e8a8a8', 3, 6, 10, 1); return c; },
  flagwall: p => { const [c, x] = mk(p.w * T, T * 2); r(x, '#a97d58', 3, 2, 1, 28); r(x, '#e9a8b8', 4, 3, 10 + (p.w - 1) * 8, 10); r(x, '#fff', 4, 7, 10 + (p.w - 1) * 8, 2); return c; },
  engine: () => { const [c, x] = mk(T * 4, T * 3); r(x, '#f08a7a', 3, 12, T * 4 - 6, 22); r(x, '#f8b0a2', 3, 12, T * 4 - 6, 4); r(x, '#e8e0d4', 6, 4, 22, 10); r(x, '#bfe6f6', 8, 6, 8, 6); r(x, '#6c5a78', 8, 34, 10, 8); r(x, '#6c5a78', T * 4 - 18, 34, 10, 8); r(x, '#f6d36a', T * 4 - 6, 20, 3, 4); r(x, '#d6c3b0', 18, 8, 28, 3); return c; },
  sirenbox: () => { const [c, x] = mk(T, T * 2); r(x, '#a7adbe', 2, 4, 12, 22); r(x, '#c4c9d8', 2, 4, 12, 2); r(x, '#bfe6f6', 4, 8, 8, 8); r(x, '#e8c875', 4, 18, 8, 5); r(x, '#6c5a78', 9, 11, 2, 4); return c; },
  cot: p => { const [c, x] = mk(p.w * T, p.h * T); r(x, '#c9a070', 2, 2, p.w * T - 4, p.h * T - 4); r(x, '#f4b8c4', 3, 3, p.w * T - 6, p.h * T - 10); r(x, '#fff', 3, 3, p.w * T - 6, 5); return c; },
  buckets: () => { const [c, x] = mk(T, T); r(x, '#e86a5a', 2, 6, 6, 8); r(x, '#e86a5a', 8, 8, 6, 6); r(x, '#f8a398', 2, 6, 6, 2); return c; },
  pew: p => { const [c, x] = mk(p.w * T, T); r(x, '#c9a070', 1, 3, p.w * T - 2, 5); r(x, '#e2bc8c', 1, 3, p.w * T - 2, 2); r(x, '#a97d58', 1, 8, p.w * T - 2, 6); return c; },
  altar: () => { const [c, x] = mk(T * 3, T * 2); r(x, '#f0e8f8', 6, 14, 36, 14); r(x, '#e8c875', 6, 14, 36, 2); r(x, '#f2cf7a', 22, 4, 3, 10); r(x, '#e8c875', 19, 7, 9, 2); return c; },
  rope: () => { const [c, x] = mk(T, T * 3); r(x, '#e8d6b0', 7, 0, 3, 36); r(x, '#c98d6a', 6, 34, 5, 6); return c; },
  drafting: p => { const [c, x] = mk(p.w * T, p.h * T); r(x, '#e2bc8c', 1, 4, p.w * T - 2, p.h * T - 6); r(x, '#f6d8ac', 1, 4, p.w * T - 2, 3); r(x, '#bfe0f4', 5, 10, 18, 12); r(x, '#7fb4d8', 7, 12, 14, 1); r(x, '#7fb4d8', 7, 15, 10, 1); r(x, '#7fb4d8', 7, 18, 12, 1); return c; },
  model: () => { const [c, x] = mk(T * 2, T); r(x, '#e8e0d4', 2, 4, 28, 10); r(x, '#8fd6ea', 4, 9, 24, 4); r(x, '#d3d5de', 14, 2, 4, 10); r(x, '#6c5a78', 15, 4, 1, 4); return c; },
  stove: () => { const [c, x] = mk(T * 2, T * 2); r(x, '#8f98ac', 3, 6, 26, 24); r(x, '#6c5a78', 7, 14, 10, 8); r(x, '#ffb067', 9, 17, 6, 4); r(x, '#c98d6a', 21, 4, 6, 6); return c; },
  crate: () => { const [c, x] = mk(T, T); r(x, '#c9a070', 1, 3, 14, 12); r(x, '#e2bc8c', 1, 3, 14, 2); r(x, '#a97d58', 1, 8, 14, 1); return c; },
};
Object.assign(PROP, furn);

const cache = new Map();
export function propSprite(p) {
  const v = p.k === 'sheet' || p.k === 'flowers' ? Math.floor(p.seed || 0) : (p.k === 'tree' || p.k === 'bush') ? Math.floor((p.seed || 0) * 100) % 3 : '';
  const k = p.k + '|' + p.w + 'x' + p.h + '|' + v + (p.style || '') + (p.roof || '') + (p.wall || '') + (p.k === 'house' ? p.x + ',' + p.y : '');
  if (cache.has(k)) return cache.get(k);
  let c = null;
  if (p.k === 'house') c = houseSprite(p); else if (PROP[p.k]) c = PROP[p.k](p);
  cache.set(k, c); return c;
}

/* ---------------------------------------------------------------------------------------------- people */
// A 16x20 villager from a handful of colours and accessories, in four directions and three walking frames.
export const OY = 7;   // headroom above a person's head, for hats
export function personSheet(look) {
  const sheet = {};
  for (const dir of ['down', 'up', 'left', 'right']) for (let f = 0; f < 3; f++) { const [c, x] = mk(T + 4, 22 + OY); x.translate(0, OY); drawPerson(x, look, dir, f); sheet[dir + f] = c; }
  return sheet;
}
function drawPerson(x, L, dir, f) {
  const ox = 2, bob = f === 1 || f === 2 ? -1 : 0;
  const skin = L.skin || '#f0c6a0', hair = L.hair || '#5a4030', coat = L.coat || '#6cc4b8', pants = L.pants || '#6a7fa6';
  const p = (c, a, b, w, h) => r(x, c, ox + a, 1 + b + bob, w, h);
  // shadow
  r(x, C.shadow, ox + 3, 19, 10, 2);
  // legs
  const ly = f === 1 ? [0, 1] : f === 2 ? [1, 0] : [0, 0];
  r(x, pants, ox + 5, 16 + ly[0] * 0, 3, 3 - ly[0]); r(x, pants, ox + 8, 16 + ly[1] * 0, 3, 3 - ly[1]);
  r(x, '#8a6a58', ox + 5, 18 - ly[0], 3, 1 + ly[0]); r(x, '#8a6a58', ox + 8, 18 - ly[1], 3, 1 + ly[1]);
  // body and arms
  const side = dir === 'left' || dir === 'right';
  p(coat, 4, 9, 8, 7); p(shade(coat, -22), 4, 15, 8, 1);
  if (!side) { p(coat, 2, 10, 2, 5); p(coat, 12, 10, 2, 5); p(skin, 2, 14, 2, 1); p(skin, 12, 14, 2, 1); }
  else { const ax = dir === 'left' ? 6 : 6; p(shade(coat, -12), ax, 10, 3, 5); p(skin, ax, 14, 3, 1); }
  // head
  p(skin, 4, 2, 8, 7); p(shade(skin, -14), 4, 8, 8, 1);
  const hs = L.hairStyle;
  if (dir === 'up') { p(hair, 3, 1, 10, 8); }
  else { p(hair, 3, 1, 10, 3); if (side) { p(hair, dir === 'left' ? 9 : 3, 3, 4, 5); } else { p(hair, 3, 3, 2, 3); p(hair, 11, 3, 2, 3); } }
  if (hs === 'wild') { p(hair, 2, 0, 12, 3); p(hair, 1, 2, 2, 5); p(hair, 13, 2, 2, 5); p(shade(hair, 20), 5, -1, 3, 2); p(shade(hair, 20), 9, -1, 3, 2); }
  if (hs === 'bun') { p(hair, 6, -1, 4, 3); }
  if (dir === 'down') { p('#5a4658', 6, 5, 1, 2); p('#5a4658', 9, 5, 1, 2); p('#f4a8a0', 5, 7, 1, 1); p('#f4a8a0', 10, 7, 1, 1); }
  else if (side) { p('#5a4658', dir === 'left' ? 5 : 10, 5, 1, 2); p('#f4a8a0', dir === 'left' ? 4 : 11, 7, 1, 1); }
  // accessories
  const ex = L.extra || [];
  if (ex.includes('sash') && dir !== 'up') { for (let i = 0; i < 6; i++) p('#f4c95d', 4 + i, 9 + i * 1, 2, 1); }
  if (ex.includes('scroll') && dir !== 'up') { p('#fffaf0', 12, 12, 2, 4); p('#e8a8a8', 12, 12, 2, 1); }
  if (ex.includes('goggles')) { if (dir === 'down') { p('#a7b4c8', 4, 1, 8, 2); p('#bfe6f6', 5, 1, 2, 2); p('#bfe6f6', 9, 1, 2, 2); } else if (dir === 'up') p('#a7b4c8', 3, 3, 10, 1); else p('#bfe6f6', dir === 'left' ? 4 : 9, 1, 3, 2); }
  if (ex.includes('lantern')) { const lx = dir === 'right' ? 1 : 13; p('#a58f7a', lx, 14, 3, 1); p('#ffe58a', lx, 15, 3, 3); p('#fff6c8', lx + 1, 16, 1, 1); }
  if (ex.includes('beard') && dir !== 'up') { p('#f0f0f6', 5, 7, 6, 3); p('#f0f0f6', 6, 10, 4, 1); }
  if (ex.includes('moustache') && dir === 'down') { p('#5a4030', 5, 7, 6, 1); p('#5a4030', 4, 8, 2, 1); p('#5a4030', 10, 8, 2, 1); }
  if (ex.includes('loupe') && dir === 'down') { p('#a58f7a', 9, 4, 3, 3); p('#bfe6f6', 10, 5, 1, 1); }
  if (ex.includes('watches') && dir !== 'up') { for (let i = 0; i < 3; i++) { p('#f2cf7a', 5 + i * 3, 11, 2, 2); p('#fffaf0', 5 + i * 3, 11, 1, 1); } }
  if (ex.includes('trumpet')) { const tx = dir === 'right' ? 12 : 1; p('#e8c875', tx, 4, 3, 2); p('#e8c875', dir === 'right' ? 14 : 0, 3, 2, 4); p('#f6e19a', dir === 'right' ? 14 : 0, 3, 1, 2); }
  if (ex.includes('teapot')) { const tx = dir === 'left' ? 0 : 13; p('#9ad0c0', tx, 13, 4, 3); p('#fff', tx + 1, 12, 2, 1); p('#7fb8a8', tx + 3, 14, 1, 1); }
  if (ex.includes('bag') && dir !== 'down') { p('#c9a070', 2, 11, 4, 5); p('#fffaf0', 3, 12, 2, 2); }
  if (ex.includes('bag') && dir === 'down') { p('#c9a070', 2, 11, 2, 5); p('#fffaf0', 12, 12, 2, 2); }
  if (ex.includes('bucket')) { p('#e8a8a8', 12, 14, 3, 3); p('#fff', 12, 14, 3, 1); }
  if (ex.includes('flour')) { for (const [a, b] of [[4, 4], [10, 3], [6, 10], [9, 12], [3, 12]]) p('#fff', a, b, 1, 1); p('#fff', 4, 15, 8, 1); }
  if (ex.includes('satchel')) { if (dir !== 'up') { p('#d9a878', 3, 11, 9, 1); p('#c98d6a', 9, 12, 4, 4); } else p('#c98d6a', 4, 11, 8, 5); }
  if (ex.includes('scarf')) { p('#ffd37a', 4, 9, 8, 2); if (dir !== 'up') p('#ffd37a', 9, 11, 2, 3); }
  // hats
  const hat = L.hat;
  if (hat) {
    const [kind, col] = hat, d = shade(col, -22);
    if (kind === 'top') { p(col, 3, -1, 10, 2); p(col, 4, -6, 8, 6); p(d, 4, -2, 8, 1); p('#f4c95d', 4, -3, 8, 1); }
    if (kind === 'sou') { p(col, 2, 0, 12, 2); p(col, 4, -2, 8, 3); if (dir === 'up') p(col, 3, 2, 10, 4); p(d, 2, 1, 12, 1); }
    if (kind === 'chef') { p(col, 4, -5, 8, 6); p(col, 3, -3, 10, 3); p(shade(col, -10), 4, 0, 8, 1); }
    if (kind === 'cap') { p(col, 3, 0, 10, 3); p(col, 4, -1, 8, 1); if (dir === 'down') p(d, 3, 3, 10, 1); if (dir === 'left') p(d, 1, 2, 5, 1); if (dir === 'right') p(d, 10, 2, 5, 1); }
    if (kind === 'helmet') { p(col, 3, -1, 10, 4); p(col, 5, -3, 6, 2); p('#f4c95d', 7, -2, 2, 3); p(d, 2, 3, 12, 1); }
  }
}
function shade(hex, d) { const n = parseInt(hex.slice(1), 16), cl = v => Math.max(0, Math.min(255, v)); return '#' + [(n >> 16) + d, ((n >> 8) & 255) + d, (n & 255) + d].map(v => cl(v).toString(16).padStart(2, '0')).join(''); }

export const PLAYER_LOOK = { skin: '#f3cba5', hair: '#5a4030', coat: '#6cc4b8', pants: '#8a8fc4', extra: ['scarf', 'satchel'] };

export function catSheet() {
  const sheet = {};
  for (const dir of ['down', 'up', 'left', 'right']) for (let f = 0; f < 3; f++) {
    const [c, x] = mk(T + 4, 22 + OY), o = '#f0a35a', d = '#d98640', w = '#fff3e0', b = f === 1 ? -1 : 0;
    x.translate(0, OY);
    r(x, C.shadow, 4, 18, 11, 2);
    if (dir === 'left' || dir === 'right') {
      const fl = dir === 'right';
      const X = (a, wd) => fl ? 18 - a - wd : a;
      r(x, o, X(4, 10), 10 + b, 10, 6); r(x, d, X(6, 2), 10 + b, 2, 6); r(x, d, X(10, 2), 10 + b, 2, 6); r(x, w, X(5, 6), 15 + b, 6, 1);
      r(x, o, X(2, 5), 7 + b, 5, 5); r(x, o, X(2, 1), 5 + b, 1, 2); r(x, o, X(5, 1), 5 + b, 1, 2); r(x, '#5a4658', X(3, 1), 9 + b, 1, 1); r(x, '#f4a8a0', X(2, 1), 10 + b, 1, 1);
      r(x, o, X(13, 2), 7 + b, 2, 5); r(x, d, X(13, 2), 7 + b, 2, 1);
      r(x, o, X(5, 2), 16, 2, 2 + (f === 1 ? -1 : 0)); r(x, o, X(11, 2), 16, 2, 2 + (f === 2 ? -1 : 0));
      r(x, '#fff0b0', X(4, 6), 12 + b, 6, 1); r(x, '#e8c875', X(5, 4), 13 + b, 4, 2);
    } else {
      r(x, o, 4, 9 + b, 10, 8); r(x, d, 6, 9 + b, 2, 8); r(x, d, 10, 9 + b, 2, 8); r(x, w, 6, 16 + b, 6, 1);
      if (dir === 'down') { r(x, o, 5, 4 + b, 8, 6); r(x, o, 5, 2 + b, 2, 3); r(x, o, 11, 2 + b, 2, 3); r(x, '#5a4658', 7, 6 + b, 1, 1); r(x, '#5a4658', 10, 6 + b, 1, 1); r(x, '#f4a8a0', 8, 8 + b, 2, 1); r(x, '#e8c875', 6, 10 + b, 6, 2); r(x, '#a7adbe', 8, 12 + b, 2, 3); }
      else { r(x, o, 5, 4 + b, 8, 6); r(x, o, 5, 2 + b, 2, 3); r(x, o, 11, 2 + b, 2, 3); r(x, d, 14, 8 + b, 2, 8); }
      r(x, o, 5, 17, 3, 1); r(x, o, 10, 17, 3, 1);
    }
    sheet[dir + f] = c;
  }
  return sheet;
}
