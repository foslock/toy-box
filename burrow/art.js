// The look of things: colour ramps for every kind of ground, the worm's skins, a sprite for every find, the camp's
// buildings and its people, and a tiny pixel font. Sprites are painted into arrays of pixels (the page draws the
// whole world into one small buffer and scales it up, so everything shares the same fat pixels).
import {
  AIR, WATER, LAVA, GAS, SOIL, ROOT, MOSS, STONE, CLAY, SAND, GRAVEL, LIME, GRANITE, GEODE, CRYSTAL, BASALT, OBSIDIAN,
  RUIN, MANTLE, ALLOY, CORE, COAL, COPPER, SILVER, GOLD, PLATINUM, EMBERITE, CIRCUIT, IRIDIUM, NMAT,
} from './rules.js';

// '#rrggbb' → a pixel for a Uint32Array over ImageData (little-endian ABGR)
export function px(hex, a = 255) {
  const n = parseInt(hex.slice(1), 16);
  return ((a << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
}
export const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export function mixHex(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return '#' + A.map((v, k) => Math.round(v + (B[k] - v) * t).toString(16).padStart(2, '0')).join('');
}

/* ---------- the ground ---------- */
// Dark to light. The page picks along a ramp by a cell's texture, with ordered dithering between steps.
export const RAMPS = [];
const ramp = (m, ...h) => { RAMPS[m] = h; };
ramp(SOIL, '#24150e', '#321e13', '#402818', '#50321e', '#613d25', '#71492c');
ramp(ROOT, '#3a281a', '#4b3522', '#5c432c', '#6e5236', '#806240');
ramp(MOSS, '#18452a', '#23693a', '#35904a', '#58b85a', '#9ae07a');
ramp(STONE, '#3e3a38', '#524d49', '#66615b', '#7c776e', '#948e83', '#aaa498');
ramp(CLAY, '#46190f', '#5c2315', '#732e1b', '#8a3b22', '#9e4a2c', '#b35d3b');
ramp(SAND, '#6a4628', '#7e5732', '#92683e', '#a57a4c', '#b68c5c', '#c49c6c');
ramp(GRAVEL, '#3a2c26', '#4a3a32', '#5a4a3e', '#6a594b', '#7a6a5a', '#8a7a68');
ramp(LIME, '#5e5646', '#766d59', '#8e846d', '#a69c83', '#bdb399', '#d2c9ae', '#e4dcc3');
ramp(GRANITE, '#413035', '#553e43', '#6a4f52', '#7f6162', '#937273', '#a68685');
ramp(GEODE, '#17121f', '#211a2c', '#2b2239', '#362b47', '#433556', '#503f65');
ramp(CRYSTAL, '#4b2c8a', '#6a3dbd', '#8a5ae6', '#ad86ff', '#d2bcff', '#f2eaff');
ramp(BASALT, '#0f0f13', '#16161c', '#1e1e26', '#272731', '#31313c', '#3c3c49');
ramp(OBSIDIAN, '#06040a', '#0d0916', '#150e24', '#201536', '#2e1d4c');
ramp(RUIN, '#142223', '#1b2d2f', '#23393b', '#2c4749', '#365658', '#426668');
ramp(MANTLE, '#2a100d', '#3a1712', '#4d2016', '#61291b', '#773420', '#8f4227', '#a8542f');
ramp(ALLOY, '#2f3842', '#404c59', '#566473', '#6f7e8f', '#8e9cad', '#b2bfcd');
ramp(CORE, '#ff8a1a', '#ffae38', '#ffd058', '#ffe890', '#fff6c8', '#ffffff');
ramp(COAL, '#0c0c0e', '#151518', '#1f1f24', '#2c2c33', '#44444e');
ramp(COPPER, '#6a2e12', '#9a4a1e', '#c8662c', '#e88c46', '#ffb87a');
ramp(SILVER, '#555c66', '#7e8792', '#a8b1bc', '#d0d8e0', '#f4f8fc');
ramp(GOLD, '#7a4c08', '#b07a10', '#e0aa22', '#ffd24a', '#fff2a0');
ramp(PLATINUM, '#6a7a88', '#90a4b4', '#b6cad8', '#d8eaf6', '#f6feff');
ramp(EMBERITE, '#6a1606', '#b02808', '#f04a0e', '#ff8a30', '#ffd070');
ramp(CIRCUIT, '#063a36', '#0c6a5c', '#16a88c', '#40e8c0', '#b0fff0');
ramp(IRIDIUM, '#4a1e5a', '#763092', '#aa4cc8', '#dc84f0', '#fcd4ff');
ramp(WATER, '#12306a', '#193f88', '#1f4fa6', '#2c64c0', '#4884d6');
ramp(LAVA, '#8a1808', '#d23608', '#ff6614', '#ffa032', '#ffdc78', '#fff4c0');
ramp(GAS, '#3a4a20', '#4e6428', '#627e30');
ramp(AIR, '#000000');
// The worm shakes rock into rubble and earth into crumbs: speckled, and a little warmer than the ground around it.
export const TRAIL_TINT = '#6a2a10';

// The back wall behind a cave, by layer: dim, so the open reads as open.
export const BACKWALL = [
  ['#120b07', '#170e09', '#1c120b'],
  ['#1c0c07', '#240f09', '#2b130b'],
  ['#1f1c16', '#28241c', '#302b22'],
  ['#1c1417', '#24191c', '#2b1f22'],
  ['#0b0810', '#100c16', '#15101c'],
  ['#08080a', '#0c0c10', '#101014'],
  ['#0a1213', '#0e1819', '#121e1f'],
  ['#170907', '#1f0c0a', '#270f0c'],
];
// Light each kind of ground gives off: [r, g, b], added into the light map.
export const GLOW = [];
for (let m = 0; m < NMAT; m++) GLOW[m] = null;
GLOW[LAVA] = [1.5, .55, .18]; GLOW[CRYSTAL] = [.55, .38, 1]; GLOW[MOSS] = [.25, .8, .45]; GLOW[EMBERITE] = [1, .4, .12];
GLOW[CIRCUIT] = [.25, 1, .85]; GLOW[IRIDIUM] = [.7, .3, .8]; GLOW[CORE] = [2, 1.5, .7]; GLOW[GOLD] = [.3, .25, .08];

/* ---------- the worm ---------- */
// Skins by Hide level: dark to light, and the colour of the bands between segments.
export const SKINS = [
  { ramp: ['#3a1216', '#6a2428', '#983c3a', '#c05a50', '#de7e6c', '#f2a88e'], band: '#4e161a', mouth: '#2a0608', gum: '#9a2a34', tooth: '#f6eedc' },
  { ramp: ['#321a10', '#5e3218', '#8a4e26', '#b26c36', '#d08e4c', '#e8b472'], band: '#40200e', mouth: '#240806', gum: '#8a2a22', tooth: '#f4ead0' },
  { ramp: ['#2c160c', '#562c16', '#824822', '#aa6630', '#ca8844', '#e2ac64'], band: '#381a0c', mouth: '#200604', gum: '#7e2620', tooth: '#f2e6ca' },
  { ramp: ['#26120e', '#4a2418', '#723a24', '#985430', '#ba7240', '#d49254'], band: '#2c120a', mouth: '#1c0604', gum: '#74221e', tooth: '#eee2c4', seam: '#e0a060' },
  { ramp: ['#1e1214', '#3c2224', '#5c3632', '#7e4c40', '#9e6650', '#ba8464'], band: '#200c0e', mouth: '#16040a', gum: '#6a1c26', tooth: '#ece0cc', seam: '#ff9a4a' },
  { ramp: ['#141018', '#261c2e', '#3a2c46', '#52405e', '#6c5678', '#8a7294'], band: '#0c0810', mouth: '#0c0408', gum: '#5a1430', tooth: '#fff0dc', seam: '#ff9a4a' },
  { ramp: ['#0e0a12', '#1c1428', '#2e2040', '#44305c', '#5e447a', '#7c5c98'], band: '#08040c', mouth: '#080206', gum: '#6a1040', tooth: '#fff6e8', seam: '#ffcc5a' },
];

/* ---------- sprites ---------- */
// A sprite from rows of characters and a palette ('.' is see-through), or from a function of each pixel.
export function sprite(rows, pal, opts = {}) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length)), data = new Uint32Array(w * h);
  const cols = {};
  for (const k in pal) cols[k] = px(pal[k]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = rows[y][x]; if (c && c !== '.' && c !== ' ' && cols[c] !== undefined) data[y * w + x] = cols[c]; }
  return { w, h, data, glow: opts.glow || 0, glowCol: opts.glowCol || null };
}
function painted(w, h, fn, opts = {}) {
  const data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y); if (c) data[y * w + x] = px(c); }
  return { w, h, data, glow: opts.glow || 0, glowCol: opts.glowCol || null };
}
const hsh = (x, y, s = 0) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1440670441) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
const gem = (o, d, b, l, h) => ({ o, d, b, l, h });

// Cuts, for the gems: o outline, d dark, b body, l light, h highlight.
const SHAPE = {
  round: ['..ooo..', '.ohlbo.', 'ohlbbdo', 'olbbbdo', 'obbbddo', '.odddo.', '..ooo..'],
  cut: ['.ooooo.', 'ohhllbo', 'ohbbbdo', 'olbbbdo', 'obddddo', '.ooooo.'],
  pear: ['..o..', '.oho.', 'ohlbo', 'ohbbo', 'olbdo', 'obddo', '.ooo.'],
  oval: ['.ooo.', 'ohlbo', 'ohbbo', 'olbdo', 'obddo', '.ooo.'],
  cryst: ['..o..', '.ohdo', 'ohhdo', 'ohbdo', 'olbdo', 'olbdo', 'ooooo'],
  nugget: ['.ooo..', 'ohlboo', 'olbbdo', 'obbddo', '.oooo.'],
  pebble: ['.oooo.', 'ohhlbo', 'ohlbbo', 'olbbdo', '.oooo.'],
  brilliant: ['.ooooo.', 'ohlhlbo', 'ooooooo', '.ohlbo.', '..obo..', '...o...'],
  pearl: ['.ooo.', 'ohlbo', 'olbdo', 'obddo', '.ooo.'],
  rhomb: ['...oo.', '..ohlo', '.ohlbo', 'olbdo.', 'obdo..', 'oo....'],
};
const PAL = {
  quartz: gem('#4a5460', '#a4b4c4', '#cad8e6', '#e8f2fa', '#ffffff'),
  carnelian: gem('#4a1606', '#a8400e', '#dc6420', '#f89048', '#ffd8b0'),
  jasper: gem('#3a0e08', '#86241a', '#b43a26', '#d8604a', '#f4b8a4'),
  agate: gem('#262c3c', '#56668a', '#8a9ab8', '#c0cce0', '#f0f4fa'),
  amber: gem('#4a2604', '#b06a10', '#e89a20', '#ffc048', '#fff0b0'),
  calcite: gem('#5a5440', '#bab090', '#dcd4b4', '#f4eed8', '#ffffff'),
  amethyst: gem('#2a0a3a', '#5a2080', '#8a3ab8', '#b870e0', '#ecd0ff'),
  pearl: gem('#6a6070', '#c8c0cc', '#e8e2ec', '#f8f4fa', '#ffffff'),
  garnet: gem('#2a0610', '#6a0e22', '#9a1a30', '#c83a4a', '#f0a0a8'),
  topaz: gem('#4a2a04', '#b8740a', '#f0a818', '#ffd050', '#fff4c0'),
  emerald: gem('#06301a', '#127a3a', '#1aa84e', '#4ada7a', '#c0ffd4'),
  sapphire: gem('#081438', '#1a3a9a', '#2a5ad8', '#5a8aff', '#c8dcff'),
  ruby: gem('#3a0810', '#8a1024', '#c81c3a', '#f0486a', '#ffc0cc'),
  opal: gem('#3a4a5a', '#7aa8c8', '#b0dcec', '#f4d0ee', '#ffffff'),
  alexandrite: gem('#1a0a2a', '#2a6a4a', '#7a3a9a', '#b070d0', '#e8d0ff'),
  starsapph: gem('#081438', '#23428f', '#3a64c8', '#7098f0', '#ffffff'),
  diamond: gem('#5a6a7a', '#b8cad8', '#e2f0f8', '#ffffff', '#ffffff'),
  sulfur: gem('#4a4004', '#a89a10', '#e0d020', '#fff060', '#fffcc0'),
  fireopal: gem('#4a0e04', '#c0300a', '#ff6a1a', '#ffb040', '#fff0a0'),
  embercrystal: gem('#4a0804', '#b0200a', '#ff4a10', '#ff9a40', '#ffe6a0'),
  coreshard: gem('#6a3a04', '#e09a20', '#ffd060', '#fff0b0', '#ffffff'),
  voidpearl: gem('#08040e', '#1a0a2a', '#2e1648', '#7a44c8', '#e0c0ff'),
  nugget_cu: gem('#3a1606', '#8a3a14', '#c0602a', '#e8904a', '#ffd0a0'),
  nugget_ag: gem('#2a2e36', '#6a727e', '#a4acb8', '#d4dce4', '#ffffff'),
  nugget_au: gem('#4a2e04', '#b07a10', '#e8b020', '#ffe060', '#fffac8'),
  nugget_pt: gem('#3a4450', '#8898a8', '#bccad8', '#e4f0fa', '#ffffff'),
};
const cut = (shape, pal, opts, extra = {}) => sprite(SHAPE[shape], { ...pal, ...extra }, opts);

// A tall crystal, pointed at the top: its left face lit, its right in shadow.
function crystal(w, h, P, opts) {
  const cx = (w - 1) / 2;
  return painted(w, h, (x, y) => {
    const tip = Math.max(0, (cx - Math.abs(x - cx)) * 1.6), top = Math.round(h * .35 - tip * 1.1);
    if (y < top) return null;
    if (y === top || x === 0 || x === w - 1 || y === h - 1) return P.o;
    const left = x < cx;
    if (left && x === 1 && y < h - 3) return P.h;
    return left ? (y < h * .6 ? P.l : P.b) : (x > cx + 1 ? P.d : P.b);
  }, opts);
}
// A lump, round-ish and bumpy, lit from the top left.
function lump(w, h, P, seed, opts, pits = 0) {
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  return painted(w, h, (x, y) => {
    const dx = (x - cx) / (w / 2), dy = (y - cy) / (h / 2), e = dx * dx + dy * dy + (hsh(x, y, seed) - .5) * .35;
    if (e > 1) return null;
    if (e > .72) return P.o;
    if (pits && hsh(x, y, seed + 1) < pits) return P.d;
    const lit = -dx * .6 - dy * .8 + (hsh(x, y, seed + 2) - .5) * .5;
    return lit > .7 ? P.h : lit > .25 ? P.l : lit > -.35 ? P.b : P.d;
  }, opts);
}

export const SPRITES = {
  quartz: cut('pebble', PAL.quartz),
  coin: sprite(['.ooo.', 'ohlbo', 'olkbo', 'obbdo', '.ooo.'], { o: '#4a3208', d: '#a87818', b: '#d8a830', l: '#f8d860', h: '#fff8c0', k: '#8a6212' }),
  cap: sprite(['o.o.o', '.rhr.', 'orrRo', '.RRR.', 'o.o.o'], { o: '#5a1010', r: '#d0382e', R: '#8e1c16', h: '#ffa898' }),
  button: sprite(['.ooo.', 'olbbo', 'okbko', 'obbdo', '.ooo.'], { o: '#3a2a08', b: '#b8902a', l: '#e8c860', d: '#7a5a14', k: '#241604' }),
  marble: sprite(['.ooo.', 'ohlbo', 'olsbo', 'obbso', '.ooo.'], { o: '#1a2a3a', b: '#5aa0d8', l: '#a8e0ff', h: '#ffffff', s: '#ff6a3a' }),
  key: sprite(['.ooo....', 'ol.lbbbb', '.ooo.o.o'], { o: '#2a1406', b: '#8a4a1a', l: '#c07a40' }),
  arrowhead: sprite(['..o..', '.olo.', '.olbo', 'olbbo', 'obbdo', '.o.o.'], { o: '#2a2420', d: '#5a5048', b: '#8a7e70', l: '#b8ac9a' }),
  potato: sprite(['.oooo.', 'olbebo', 'obbbdo', 'obebdo', '.oooo.'], { o: '#3a2410', d: '#7a5028', b: '#a87a44', l: '#caa062', e: '#5a3a1a' }),
  truffle: lump(5, 5, gem('#140c08', '#2a1c14', '#4a3424', '#6a4c36', '#8a6a4e'), 3, {}, .2),
  soldier: sprite(['.kk.', '.kk.', '.lb.', 'rrrr', '.rr.', '.bb.', '.b.b'], { k: '#18181e', l: '#d0d8e4', b: '#7a8494', r: '#b83030' }),
  ring: sprite(['..r..', '.olo.', 'ol.bo', 'ob.bo', '.obo.'], { o: '#4a3206', b: '#d8a830', l: '#fff080', r: '#ff2a4a' }),
  bone: sprite(['o...o', '.ooo.', '..o..', '.ooo.', 'o...o'].map(r => r.replace(/o/g, 'b')), { b: '#d8d0b8' }),
  carnelian: cut('round', PAL.carnelian),
  jasper: sprite(['.ooo.', 'ohlbo', 'odddo', 'olbbo', 'odddo', '.ooo.'], PAL.jasper),
  agate: sprite(['..ooo..', '.olbbo.', 'olhhlbo', 'oldbdlo', 'obllbdo', '.obbdo.', '..ooo..'], PAL.agate),
  amber: cut('pear', PAL.amber, { glow: .15, glowCol: [1, .6, .1] }),
  shell: sprite(['.oooo.', 'olblbo', 'olblbo', '.obdo.', '..oo..'], { o: '#4a3a28', d: '#9a8a6a', b: '#c8b890', l: '#e8dcb8' }),
  nugget_cu: sprite(SHAPE.nugget, { ...PAL.nugget_cu, d: '#4aa080' }),
  calcite: cut('rhomb', PAL.calcite),
  amethyst: cut('cryst', PAL.amethyst, { glow: .12, glowCol: [.6, .3, 1] }),
  pearl: cut('pearl', PAL.pearl),
  nugget_ag: cut('nugget', PAL.nugget_ag),
  garnet: cut('round', PAL.garnet),
  topaz: cut('cut', PAL.topaz),
  emerald: cut('cut', PAL.emerald),
  sapphire: cut('round', PAL.sapphire),
  ruby: cut('pear', PAL.ruby),
  nugget_au: cut('nugget', PAL.nugget_au, { glow: .15, glowCol: [1, .8, .2] }),
  glowcap: sprite(['..ooo..', '.ohhco.', 'ochccco', 'odddddo', '..oso..', '..oso..'], { o: '#0a2a2a', c: '#2ad0b0', h: '#c0fff4', d: '#16806e', s: '#e8e0c8' }, { glow: .7, glowCol: [.2, 1, .8] }),
  opal: sprite(['.ooo.', 'ohlpo', 'ogbro', 'olbdo', 'orgdo', '.ooo.'], { ...PAL.opal, p: '#ff70c0', g: '#50e890', r: '#ffb040' }),
  alexandrite: cut('cut', PAL.alexandrite),
  starsapph: sprite(['..ooo..', '.olbbo.', 'olbsbdo', 'olsssdo', 'obbsddo', '.odddo.', '..ooo..'], { ...PAL.starsapph, s: '#e8f0ff' }),
  diamond: cut('brilliant', PAL.diamond, { glow: .25, glowCol: [.8, .9, 1] }),
  nugget_pt: cut('nugget', PAL.nugget_pt),
  sulfur: cut('cryst', PAL.sulfur, { glow: .1, glowCol: [1, 1, .3] }),
  fireopal: sprite(['.ooo.', 'ohlbo', 'ohrbo', 'olbdo', 'obddo', '.ooo.'], { ...PAL.fireopal, r: '#fff0a0' }, { glow: .35, glowCol: [1, .5, .15] }),
  embercrystal: cut('cryst', PAL.embercrystal, { glow: .6, glowCol: [1, .35, .1] }),
  keystone: sprite(['oooooo', 'olllbo', 'olggbo', 'olgbbo', 'obggdo', 'oooooo'], { o: '#0a2020', b: '#2a6a6a', l: '#4aa8a0', g: '#80ffe8', d: '#1a4444' }, { glow: .5, glowCol: [.3, 1, .9] }),
  powercell: sprite(['.mm.', 'omho', 'ocho', 'occo', 'occo', 'omdo', '.mm.'], { o: '#0a1a24', m: '#8a9aa8', h: '#e0ffff', c: '#40e8ff', d: '#4a5a68' }, { glow: .7, glowCol: [.3, .9, 1] }),
  scrap: sprite(['.oo...', 'ohlo..', 'olbboo', 'obbbdo', '.ooooo'], { o: '#1a2028', d: '#4a5868', b: '#7a8a9c', l: '#b0c0d0', h: '#e8f4ff' }),
  coreshard: cut('cryst', PAL.coreshard, { glow: 1, glowCol: [1, .85, .4] }),
  voidpearl: cut('pearl', PAL.voidpearl, { glow: .3, glowCol: [.5, .2, .9] }),
  cache: sprite(['..tt...', '..ot...', '.obllo.', 'oblmblo', 'obmmbdo', 'obbbddo', '.ooooo.'], { o: '#2a1a0a', b: '#8a6a3a', l: '#b8945a', d: '#5a4020', t: '#e8d080', m: '#ff5a3a' }, { glow: .5, glowCol: [1, .7, .3] }),

  // hanging hazards
  stalactite: sprite(['ooooooo', 'olllbdo', '.olbdo.', '.olbdo.', '.olbo..', '..obo..', '..obo..', '..oo...', '...o...'], { o: '#3e3628', l: '#e0d6bc', b: '#bcb194', d: '#8e8468' }),
  spike: sprite(['ooooooo', 'ohhllbo', '.ohlbo.', '.ohlbo.', '.ohbdo.', '..obo..', '..obo..', '..od...', '...o...'], { o: '#2a1050', h: '#f0e4ff', l: '#b890ff', b: '#8a50e0', d: '#5a2aa0' }, { glow: .5, glowCol: [.6, .4, 1] }),
  // size 2
  watch: sprite(['....o....', '...ogo...', '.ooooooo.', 'ogfffffgo', 'ogffkffgo', 'ogfkkffgo', 'ogfffffgo', '.ogggggo.', '..ooooo..'],
    { o: '#2a2004', g: '#d8b030', f: '#f4ecd8', k: '#2a2a2a' }),
  amberbug: sprite(['...oo...', '..ohbo..', '.ohlbbo.', 'ohlkkbbo', 'olbkkbdo', 'olkbbkdo', 'obbbbddo', '.obdddo.', '..oooo..'], { ...PAL.amber, k: '#2a1206' }, { glow: .2, glowCol: [1, .6, .1] }),
  pot: sprite(['..ooooo..', '..obbbo..', '...obo...', '.oblllbo.', 'oblllbbdo', 'ossssssso', 'oblbbbddo', '.obbbddo.', '..ooooo..'],
    { o: '#2a1006', b: '#a8502a', l: '#d07a44', d: '#6a2e14', s: '#e8c090' }),
  figurine: sprite(['..ooo..', '.olbbo.', '.okkko.', '.olbbo.', '..obo..', '.olbo..', 'olbbo..', 'obbbbo.', '.obbbdo', 'ooooooo'],
    { o: '#2a1006', b: '#b0602e', l: '#d8884a', d: '#6a3214', k: '#3a0a06' }),
  ammonite: painted(9, 9, (x, y) => {
    const dx = x - 4, dy = y - 4, r = Math.hypot(dx, dy);
    if (r > 4.4) return null;
    if (r > 3.7) return '#3a2a1a';
    const a = Math.atan2(dy, dx), t = (Math.log(Math.max(r, .6)) * 3.2 - a * .5 + 20) % 1.4;
    if (t < .35) return '#6a5236';
    const lit = -dx - dy;
    return lit > 2 ? '#f4e4c4' : lit > -1 ? '#dcc49a' : '#b89a6a';
  }),
  trilobite: sprite(['..ooo..', '.olllo.', 'olblblo', 'obbobbo', 'olblblo', 'obbobbo', 'olblblo', '.obobo.', '..obo..', '...o...'],
    { o: '#2a2018', b: '#6a5a48', l: '#9a8a70' }),
  lamp: sprite(['...oo...', '..o..o..', '..oooo..', '.ommmmo.', '.oghgmo.', '.ogggmo.', '.ommmmo.', 'oommmmoo', '.oooooo.'],
    { o: '#161616', m: '#7a7060', g: '#ffd060', h: '#fff8d0' }, { glow: .8, glowCol: [1, .8, .4] }),
  shard: crystal(7, 12, gem('#2a1050', '#5a2aa0', '#8a50e0', '#b890ff', '#f0e4ff'), { glow: .9, glowCol: [.6, .4, 1] }),
  meteor: lump(9, 8, gem('#141418', '#34343e', '#55555f', '#86868f', '#c8c8d4'), 7, {}, .12),
  glyph: sprite(['.oooooo.', 'olllllbo', 'olggglbo', 'olblgbbo', 'olggglbo', 'olbbbbbo', 'olglgbbo', 'olgggbdo', 'obbbbddo', '.oooooo.'],
    { o: '#101a1a', b: '#3a5a58', l: '#5a8a86', d: '#243c3a', g: '#7affe0' }, { glow: .4, glowCol: [.3, 1, .9] }),
  mask: sprite(['.ooooooo.', 'olllllllo', 'olelelelo', 'olbbbbbbo', 'olebbbebo', 'olbbbbbbo', '.olbkkbo.', '..obbbo..', '...ooo...'],
    { o: '#0a1414', b: '#4a7a70', l: '#7ab0a0', e: '#ff4a8a', k: '#08100e' }, { glow: .4, glowCol: [1, .3, .6] }),
  heartstone: sprite(['.oo...oo.', 'ohlo.ohbo', 'ohllolbbo', 'olllbbbdo', '.olbbbdo.', '..obbdo..', '...odo...', '....o....'],
    { o: '#3a0408', d: '#8a0a1a', b: '#d8203a', l: '#ff5a6a', h: '#ffc8d0' }, { glow: .9, glowCol: [1, .2, .3] }),

  // size 3
  chest: sprite(['..oooooooooo..', '.owwlwwwwlwwo.', 'owwwlwwwwlwwwo', 'ommmmmmmmmmmmo', 'owwwwwmhmwwwwo', 'owwlwwmkmwwlwo', 'owwlwwwmwwwlwo', 'owwlwwwwwwwlwo', 'omddddddddddmo', 'ommmmmmmmmmmmo', '.oooooooooooo.'],
    { o: '#1a0e04', w: '#8a5a2a', l: '#b07a3a', d: '#5a3614', m: '#c8a040', h: '#ffe070', k: '#1a1a1a' }),
  tusk: painted(15, 10, (x, y) => {
    const u = x / 14, cy = 2 + 6 * (u - .5) ** 2 * 2.2 + (1 - u) * 1.5, th = 1 + 2.4 * (1 - u) ** .7;
    const d = y - cy;
    if (Math.abs(d) > th) return Math.abs(d) < th + .9 ? '#3a3220' : null;
    return d < -th * .4 ? '#ffffff' : d < th * .3 ? '#ece2c8' : '#c4b694';
  }),
  fishfossil: painted(15, 9, (x, y) => {
    if (x === 0 || x === 14 || y === 0 || y === 8) return (x === 0 || x === 14) && (y === 0 || y === 8) ? null : '#4a4230';
    const bone = '#3a3024', slab = hsh(x, y, 5) < .5 ? '#cfc3a4' : '#bdb192';
    if (y === 4 && x > 2 && x < 12) return bone;                 // spine
    if ((x === 4 || x === 6 || x === 8 || x === 10) && y > 1 && y < 7) return bone;   // ribs
    if (x >= 11 && x <= 12 && y >= 2 && y <= 6) return (y === 3 && x === 12) ? '#f4ecd8' : bone;   // head
    if (x <= 2 && (y === 4 || Math.abs(y - 4) === 3 - x)) return bone;   // tail
    return slab;
  }),
  amgeode: painted(13, 12, (x, y) => {
    const dx = (x - 6) / 6.3, dy = (y - 6) / 5.8, r = Math.hypot(dx, dy);
    if (r > 1) return null;
    if (r > .88) return '#3a3632';
    if (r > .7) return hsh(x, y, 2) < .5 ? '#8a8478' : '#a8a296';
    const h = hsh(x, y, 9);
    return h < .15 ? '#f0d8ff' : r < .3 ? '#5a2080' : h < .5 ? '#b870e0' : '#8a3ab8';
  }, { glow: .15, glowCol: [.7, .4, 1] }),
  skull: sprite(['.....oooooo....', '...oolllllloo..', '..olllllllllloo', '.ollokkolllllbo', 'olllokkollllbbo', 'olllloollllbbdo', '.olllllllbbbdoo', '..owowowowbddo.', '...o.o.o.oooo..', '..owowowowo....'],
    { o: '#2a2418', l: '#e8dcc0', b: '#c4b694', d: '#8a7c60', k: '#140e08', w: '#fffaf0' }),
  salamander: painted(15, 9, (x, y) => {
    if (x === 0 || x === 14 || y === 0 || y === 8) return (x === 0 || x === 14) && (y === 0 || y === 8) ? null : '#101014';
    const bone = '#f0a050', slab = hsh(x, y, 4) < .5 ? '#2a2a32' : '#22222a';
    const sy = 4 + Math.round(Math.sin(x * .7) * 1.2);
    if (y === sy && x > 1 && x < 13) return bone;
    if ((x === 4 || x === 9) && Math.abs(y - sy) === 2) return bone;
    if ((x === 3 || x === 5 || x === 8 || x === 10) && Math.abs(y - sy) === 1) return bone;
    if (x >= 12 && Math.abs(y - sy) <= 1) return '#ffd080';
    return slab;
  }, { glow: .3, glowCol: [1, .5, .2] }),
  dragonegg: painted(11, 14, (x, y) => {
    const dx = (x - 5) / 5.4, dy = (y - 7.4) / 6.8 * (y < 7 ? 1.15 : 1), r = Math.hypot(dx, dy);
    if (r > 1) return null;
    if (r > .86) return '#1a0806';
    const scale = ((x + (Math.floor(y / 2) % 2) * 1.5) % 3 < 1) || y % 2 === 0;
    const crack = Math.abs(x - 5 - Math.sin(y * .9) * 2) < .6 && y > 3;
    if (crack) return '#ffcc4a';
    const lit = -dx - dy * 1.2;
    return lit > .8 ? '#e0603a' : scale ? (lit > 0 ? '#9a2a18' : '#6a1a10') : '#b8402a';
  }, { glow: .8, glowCol: [1, .5, .2] }),
  idol: sprite(['...ooooo...', '..oggggho..', '.ogokkkogo.', '.ogkkkkkgo.', '.ogokkkogo.', '..oggggdo..', '...oggdo...', '...ogggo...', '..oggdgo...', '..ogggdo...', '...oggdo...', '..ooooooo..', '.ossssssso.', 'osssssssdso', 'ooooooooooo'],
    { o: '#1a1004', g: '#e8b830', h: '#fff4b0', d: '#9a7010', k: '#2a0806', s: '#3a5a58' }, { glow: .5, glowCol: [1, .8, .3] }),
  orb: painted(13, 13, (x, y) => {
    const dx = (x - 6) / 6.2, dy = (y - 6) / 6.2, r = Math.hypot(dx, dy);
    const ring = Math.abs(dy - dx * .35) < .09 && r < 1.12;
    if (ring) return '#e8b830';
    if (r > 1) return null;
    if (r > .9) return '#060a20';
    if (hsh(x, y, 11) < .12) return hsh(x, y, 12) < .5 ? '#ffffff' : '#a8c8ff';
    const lit = -dx - dy;
    return lit > 1 ? '#5a7ae0' : lit > .2 ? '#2a3aa0' : '#161e60';
  }, { glow: .6, glowCol: [.4, .5, 1] }),

  // size 4
  giantgeode: painted(21, 18, (x, y) => {
    const dx = (x - 10) / 10.3, dy = (y - 9) / 8.8, r = Math.hypot(dx, dy);
    if (r > 1) return null;
    if (r > .92) return '#2a2622';
    if (r > .76) return hsh(x, y, 3) < .5 ? '#7a746a' : '#948e82';
    const a = Math.atan2(dy, dx), f = (a * 5 + r * 9) % 2;
    const h = hsh(x, y, 13);
    if (h < .08) return '#ffffff';
    return r < .25 ? '#2a1450' : f < .6 ? '#d2bcff' : f < 1.3 ? '#8a5ae6' : '#6a3dbd';
  }, { glow: .7, glowCol: [.6, .4, 1] }),
};
SPRITES.bone = sprite(['b...b', '.bbb.', '..b..', '.bbb.', 'b...b'], { b: '#d8d0b8' });

/* ---------- the camp ---------- */
// The trading post, where finds are weighed and paid for.
export const POST = sprite([
  '..............oo..............',
  '.............o$$o.............',
  '.............o$$o.............',
  '..............oo..............',
  '...............t..............',
  '.ooooooooooooooooooooooooooooo.',
  'orwrwrwrwrwrwrwrwrwrwrwrwrwrwro',
  'orwrwrwrwrwrwrwrwrwrwrwrwrwrwro',
  '.o.o.o.o.o.o.o.o.o.o.o.o.o.o.o.',
  '..p........................p...',
  '..p..bbbbbbbbbbbbbbbbbbbbb.p...',
  '..p..bllllllbbbbbbbllllllb.p...',
  '..p..blkkklbbbhhhbblkkklbb.p...',
  '..p..blkkklbbhdddhblkkklbb.p...',
  '..p..blllllbbhdddhbllllllb.p...',
  '..p..bbbbbbbbhdddhbbbbbbbb.p...',
  'oooooooooooooooooooooooooooooo.',
  'occccccccccccccccccccccccccccco',
  'occccgggcccccccccccccccgggcccco',
  'occcgggggccccccccccccccgggggcco',
  'occcgggggccccsssssccccgggggccco',
  'occccccccccccsssssccccccccccco.',
], {
  o: '#2a1a0e', r: '#c8402e', w: '#f4e6c8', p: '#6a4a2a', b: '#8a5e36', l: '#a87848', k: '#2a1a10', h: '#5a3a1e', d: '#3a2412',
  c: '#b0804a', g: '#e8c050', s: '#9aa4ac', $: '#ffd84a', t: '#6a4a2a',
});
// The Resonator: a tall tuning fork on a stone drum. Struck, it tunes the worm's vibration.
export const RESONATOR = sprite([
  '...oo.......oo...',
  '..ohbo.....obbo..',
  '..ohbo.....obbo..',
  '..ohbo.....obbo..',
  '..ohbo.....obbo..',
  '..ohbo.....obbo..',
  '..ohbo.....obbo..',
  '..ohbo.....obbo..',
  '..ohbo.....obbo..',
  '..ohbo.....obbo..',
  '..ohbo.....obbo..',
  '..ohboo...oobbo..',
  '...ohbbooobbbo...',
  '....ohbbbbbbo....',
  '.....ooobooo.....',
  '.......obo.......',
  '.......obo.......',
  '.......obo.......',
  '.......obo.......',
  '....ooooooooo....',
  '...ossssssssso...',
  '..osrrrrrrrrrso..',
  '..osrgggggggrso..',
  '..osrgssssgrrso..',
  '..osrgggggggrso..',
  '..osrrrrrrrrrso..',
  '..ossssssssssso..',
  '.ooooooooooooooo.',
  'occccccccccccccco',
  'ocdcdcdcdcdcdcdco',
  'ooooooooooooooooo',
], { o: '#1a1410', h: '#f0f4f8', b: '#a8b4c0', s: '#5a4a3a', r: '#8a2a1e', g: '#d8a030', c: '#7a7068', d: '#5a524a' });
export const HUT = sprite([
  '.....oo.....',
  '....oyyo....',
  '...oyyyyo...',
  '..oyyyyyyo..',
  '.oyyyyyyyyo.',
  'oyyyyyyyyyyo',
  '.owwwwwwwwo.',
  '.owwwwkkwwo.',
  '.owllwkkwwo.',
  '.owllwkkwwo.',
  '.oooooooooo.',
], { o: '#2a1a0e', y: '#c8a45a', w: '#b8805a', l: '#ffd070', k: '#3a2212' });
export const TENT = sprite([
  '......o......',
  '.....oro.....',
  '....orwro....',
  '...orwrwro...',
  '..orwrkrwro..',
  '.orwrkkkrwro.',
  'orwrwkkkwrwro',
  'ooooooooooooo',
], { o: '#2a1a0e', r: '#b8503a', w: '#e8d8b8', k: '#2a1810' });
// People of the camp, two frames of walking, and a cheer.
export const FOLK = ['#c8503a', '#3a6ab8', '#d8a030', '#4a9a5a', '#8a4ab0', '#e07a9a'].map(shirt => [
  sprite(['.h.', 'hsh', 'ccc', '.c.', 'l.l'], { h: '#5a3a24', s: '#e8b890', c: shirt, l: '#2a2a3a' }),
  sprite(['.h.', 'hsh', 'ccc', '.c.', '.l.'], { h: '#5a3a24', s: '#e8b890', c: shirt, l: '#2a2a3a' }),
  sprite(['s.s', 'chc', '.c.', '.c.', 'l.l'], { h: '#5a3a24', s: '#e8b890', c: shirt, l: '#2a2a3a' }),
]);
export const CACTUS = sprite(['..g..', '..g.g', 'g.ggg', 'ggg..', '..g..', '..g..'], { g: '#4a8a3a' });

/* ---------- a tiny font ---------- */
// 3×5 letters (4 wide where they need it), for numbers and words floating in the world.
const GLYPHS = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
  '$': '011110010011110', '+': '000010111010000', '-': '000000111000000', '.': '000000000000010', ',': '000000000010100',
  '!': '010010010000010', '?': '111001011000010', ':': '000010000010000', '/': '001001010100100', '%': '101001010100101',
  ' ': '000000000000000', "'": '010010000000000', '×': '000101010101000', '(': '010100100100010', ')': '010001001001010',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
};
export const FONT = {};
for (const ch in GLYPHS) { const g = GLYPHS[ch]; FONT[ch] = []; for (let k = 0; k < 15; k++) if (g[k] === '1') FONT[ch].push([k % 3, (k / 3) | 0]); }
export const textWidth = s => String(s).length * 4 - 1;

// Colours the page uses in the world: sky by time of day, and the floating words.
export const SKY = {
  day: ['#5b9bd8', '#86b9e6', '#b4d6ef', '#e2eef2'],
  dusk: ['#3a3a78', '#8a5a8a', '#e0886a', '#ffc27a'],
  night: ['#080a1c', '#101630', '#182244', '#243054'],
};
export const MESA = ['#b0704a', '#96603e', '#7a4e34'];
