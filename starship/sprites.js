// Crew sprites, built from parts: a head (hair style, hat, alien bits), a body for each stance, arms and props.
// Everything is drawn facing right with (0, 0) at the floor under the feet, then outlined in near-black the
// way FTL outlines its crew so a 12-pixel person still reads against a busy room.
import { mk, ctx2d, shade } from './util.js';

const OUTLINE = '#0a0c12';

// Heads: 4 rows, x from -3 to 3. extra pixels are [x, row, key] where row 0 is the head's top row.
const HEADS = {
  side: {
    short:  { r: ['..hhh..', '.hhhhh.', '.hhSeS.', '..hSS..'] },
    crop:   { r: ['..hhh..', '.hhhhS.', '.hSSeS.', '..SSS..'] },
    long:   { r: ['..hhh..', '.hhhhh.', '.hhSeS.', '.hhSS..'], x: [[-2, 4, 'h'], [-2, 5, 'h']] },
    bun:    { r: ['..hhh..', '.hhhhh.', '.hhSeS.', '..hSS..'], x: [[-3, 0, 'h'], [-3, 1, 'h']] },
    pony:   { r: ['..hhh..', '.hhhhh.', '.hhSeS.', '..hSS..'], x: [[-3, 1, 'h'], [-3, 2, 'h'], [-3, 3, 'h']] },
    bald:   { r: ['..sSS..', '.sSSSS.', '.sSSeS.', '..SSS..'] },
    afro:   { r: ['.hhhhh.', 'hhhhhh.', 'hhhSeS.', '.hhSS..'], x: [[-1, -1, 'h'], [0, -1, 'h'], [1, -1, 'h']] },
    mohawk: { r: ['..hh...', '.sShSS.', '.sSSeS.', '..SSS..'], x: [[-1, -1, 'h'], [0, -1, 'h']] },
    toque:  { r: ['.WWWW..', '.hhhhW.', '.hhSeS.', '..hSS..'], x: [[-2, -1, 'W'], [-1, -1, 'W'], [0, -1, 'W'], [1, -1, 'W'], [-1, -2, 'W'], [0, -2, 'W']] },
    helmet: { r: ['..MMM..', '.MMMMM.', '.MMvvv.', '..MSS..'] },
    cap:    { r: ['..ccc..', '.ccccCC', '.hhSeS.', '..hSS..'] },
  },
  front: {
    short:  { r: ['..hhh..', '.hhhhh.', '.heSeh.', '..SSS..'] },
    crop:   { r: ['..hhh..', '.hSSSh.', '.SeSeS.', '..SSS..'] },
    long:   { r: ['..hhh..', '.hhhhh.', '.heSeh.', '.hSSSh.'], x: [[-2, 4, 'h'], [2, 4, 'h']] },
    bun:    { r: ['..hhh..', '.hhhhh.', '.heSeh.', '..SSS..'], x: [[0, -1, 'h']] },
    pony:   { r: ['..hhh..', '.hhhhh.', '.heSeh.', '..SSS..'] },
    bald:   { r: ['..SSS..', '.SSSSS.', '.SeSeS.', '..SSS..'] },
    afro:   { r: ['.hhhhh.', 'hhhhhhh', 'hheSehh', '.hSSSh.'], x: [[-1, -1, 'h'], [0, -1, 'h'], [1, -1, 'h']] },
    mohawk: { r: ['...h...', '.SShSS.', '.SeSeS.', '..SSS..'], x: [[0, -1, 'h']] },
    toque:  { r: ['.WWWWW.', '.hWWWh.', '.heSeh.', '..SSS..'], x: [[-1, -1, 'W'], [0, -1, 'W'], [1, -1, 'W']] },
    helmet: { r: ['..MMM..', '.MMMMM.', '.MvvvM.', '..SSS..'] },
    cap:    { r: ['..ccc..', '.CCCCC.', '.heSeh.', '..SSS..'] },
  },
  back: {
    short:  { r: ['..hhh..', '.hhhhh.', '.hhhhh.', '..hhh..'] },
    crop:   { r: ['..hhh..', '.hhhhh.', '.hhhhh.', '..SSS..'] },
    long:   { r: ['..hhh..', '.hhhhh.', '.hhhhh.', '.hhhhh.'], x: [[-1, 4, 'h'], [0, 4, 'h'], [1, 4, 'h'], [0, 5, 'h']] },
    bun:    { r: ['..hhh..', '.hhhhh.', '.hhhhh.', '..hhh..'], x: [[0, -1, 'h']] },
    pony:   { r: ['..hhh..', '.hhhhh.', '.hhhhh.', '..hhh..'], x: [[0, 4, 'h'], [0, 5, 'h']] },
    bald:   { r: ['..sSs..', '.sSSSs.', '.sSSSs.', '..SSS..'] },
    afro:   { r: ['.hhhhh.', 'hhhhhhh', 'hhhhhhh', '.hhhhh.'], x: [[-1, -1, 'h'], [0, -1, 'h'], [1, -1, 'h']] },
    mohawk: { r: ['...h...', '.sShSs.', '.sShSs.', '..SSS..'], x: [[0, -1, 'h']] },
    toque:  { r: ['.WWWWW.', '.WWWWW.', '.hhhhh.', '..hhh..'], x: [[-1, -1, 'W'], [0, -1, 'W'], [1, -1, 'W']] },
    helmet: { r: ['..MMM..', '.MMMMM.', '.MMMMM.', '..MMM..'] },
    cap:    { r: ['..ccc..', '.ccccc.', '.hhhhh.', '..hhh..'] },
  },
};
// Alien touches, same coordinates as head extras.
const ALIEN = {
  side:  { antenna: [[0, -1, 'x'], [0, -2, 'X']], horns: [[-1, -1, 'x'], [1, -1, 'x']], crest: [[-2, -1, 'x'], [-1, -1, 'x'], [0, -1, 'x']] },
  front: { antenna: [[-1, -1, 'x'], [-1, -2, 'X'], [1, -1, 'x'], [1, -2, 'X']], horns: [[-2, -1, 'x'], [2, -1, 'x']], crest: [[-1, -1, 'x'], [0, -1, 'x'], [1, -1, 'x']] },
  back:  { antenna: [[-1, -1, 'x'], [-1, -2, 'X'], [1, -1, 'x'], [1, -2, 'X']], horns: [[-2, -1, 'x'], [2, -1, 'x']], crest: [[-1, -1, 'x'], [0, -1, 'x'], [1, -1, 'x']] },
};

// Bodies below the head: torso rows then legs. ty is the torso's top row (y), view picks the head set.
const LEGS = {
  stand: ['..PPP..', '..P.P..', '..P.P..', '..B.B..'],
  walk0: ['..PPP..', '.P...p.', '.P...p.', '.B...B.'],
  walk1: ['..PPP..', '..Pp...', '..Pp...', '..BB...'],
  walk2: ['..PPP..', '.p...P.', '.p...P.', '.B...B.'],
  run0:  ['..PPP..', '.P...Pp', 'P.....p', 'B......'],
  run1:  ['..PPP..', '..PPp..', '..P.p..', '..B.B..'],
  run2:  ['..PPP..', 'pP...P.', 'p.....P', '......B'],
  sit:   ['..PPPP.', '.....P.', '.....BB'],
  kneel: ['..PPPP.', '.BP..PB'],
  floor: ['BPPPPPB'],
  hang:  ['..PPP..', '..P.P..', '..P.P..', '..B.B..'],
};
const TORSO = {
  side:  ['..UUU..', '..UUU..', '..UUU..', '..kkk..'],
  front: ['.uUIUu.', '.uUUUu.', '.uUUUu.', '.SkkkS.'],
  back:  ['.uUUUu.', '.uUUUu.', '.uUUUu.', '.SkkkS.'],
};
// stance → [view, legs, head top y]
const STANCE = {
  stand: ['side', 'stand', -12], walk0: ['side', 'walk0', -12], walk1: ['side', 'walk1', -12], walk2: ['side', 'walk2', -12],
  run0: ['side', 'run0', -13], run1: ['side', 'run1', -12], run2: ['side', 'run2', -13],
  sit: ['side', 'sit', -11], kneel: ['side', 'kneel', -10], floor: ['side', 'floor', -9], hang: ['side', 'hang', -12],
  front: ['front', 'stand', -12], back: ['back', 'stand', -12], climb0: ['back', 'stand', -12], climb1: ['back', 'walk1', -12],
  frontsit: ['front', 'sit', -11],
};

// Arms, [x, row, key] with row 0 the torso's top row.
const ARMS = {
  sides: [[0, 0, 'a'], [0, 1, 'a'], [0, 2, 'a'], [0, 3, 'S']],
  fwd: [[0, 0, 'a'], [1, 1, 'a'], [1, 2, 'S']],
  back: [[0, 0, 'a'], [-1, 1, 'a'], [-1, 2, 'S']],
  reach: [[0, 0, 'a'], [1, 0, 'a'], [2, 0, 'a'], [3, 0, 'S']],
  type0: [[0, 0, 'a'], [1, 1, 'a'], [2, 1, 'S']],
  type1: [[0, 0, 'a'], [1, 1, 'a'], [2, 2, 'S']],
  mouth: [[0, 0, 'a'], [1, 0, 'a'], [1, -1, 'S']],
  lap: [[0, 0, 'a'], [0, 1, 'a'], [1, 2, 'S']],
  up: [[0, 0, 'a'], [0, -1, 'a'], [0, -2, 'a'], [0, -3, 'S'], [-1, -1, 'a'], [-1, -2, 'a'], [-1, -3, 'S']],
  chest: [[0, 0, 'a'], [1, 0, 'S'], [-1, 1, 'a'], [0, 1, 'S']],
  guard: [[0, 0, 'a'], [1, -1, 'S']],
  point: [[0, 0, 'a'], [1, -1, 'a'], [2, -2, 'S']],
  hang: [[0, -1, 'a'], [0, -2, 'a'], [0, -3, 'S']],
  low: [[0, 0, 'a'], [1, 1, 'a'], [2, 2, 'a'], [3, 2, 'S']],
  hold: [[0, 0, 'a'], [1, 1, 'S']],
  climbA: [[-2, -1, 'a'], [-2, -2, 'S'], [2, 1, 'a'], [2, 2, 'S']],
  climbB: [[-2, 1, 'a'], [-2, 2, 'S'], [2, -1, 'a'], [2, -2, 'S']],
  frontwave: [[2, -1, 'a'], [3, -2, 'S']],
  none: [],
};
// Props, [x, row, colour] relative to the torso's top row.
const METAL = '#3a404c', STEEL = '#8c96a8', WOOD = '#8a5a34', PAD = '#3fd6ff';
const PROPS = {
  none: [],
  gun: [[4, 0, METAL], [5, 0, METAL], [4, 1, METAL], [6, 0, '#ff6a5a']],
  rifle: [[3, 0, METAL], [4, 0, METAL], [5, 0, METAL], [6, 0, METAL], [3, 1, METAL], [2, 1, WOOD]],
  box: [[1, -3, '#b8894a'], [2, -3, '#b8894a'], [3, -3, '#b8894a'], [4, -3, '#b8894a'], [1, -2, '#9a6f38'], [2, -2, '#d9b070'], [3, -2, '#9a6f38'], [4, -2, '#9a6f38'], [1, -1, '#9a6f38'], [2, -1, '#9a6f38'], [3, -1, '#9a6f38'], [4, -1, '#9a6f38']],
  pad: [[2, 1, PAD]],
  book: [[2, 1, '#c0453a'], [2, 2, '#c0453a'], [3, 1, '#e8dcc0']],
  mug: [[2, -1, '#e9e4d8']],
  mugdown: [[3, 2, '#e9e4d8']],
  scanner: [[4, 0, METAL], [4, -1, '#7bff8a']],
  wrench: [[3, 1, STEEL], [4, 0, STEEL]],
  torch: [[3, 2, '#5a5f6a'], [4, 2, '#fff2b0']],
  mop: [[2, 1, WOOD], [2, 2, WOOD], [3, 3, WOOD], [3, 4, WOOD], [3, 5, WOOD], [2, 6, '#c8c0a8'], [3, 6, '#c8c0a8'], [4, 6, '#c8c0a8']],
  cue: [[-3, 2, WOOD], [-2, 2, WOOD], [-1, 2, WOOD], [0, 2, WOOD], [1, 2, WOOD], [2, 2, WOOD], [3, 2, WOOD], [4, 2, '#e8e2d0']],
  guitar: [[0, 2, '#b8612a'], [1, 2, '#b8612a'], [0, 3, '#8a4418'], [1, 3, '#b8612a'], [2, 1, '#3a2418'], [3, 0, '#3a2418'], [4, -1, '#3a2418']],
  can: [[2, 1, '#4f9a5a'], [3, 1, '#4f9a5a'], [3, 0, '#4f9a5a'], [4, -1, '#6fc27a']],
  bar: [[-3, -4, STEEL], [-2, -4, STEEL], [-1, -4, STEEL], [0, -4, STEEL], [1, -4, STEEL], [2, -4, STEEL], [3, -4, STEEL], [-3, -5, '#2a2e38'], [-3, -3, '#2a2e38'], [3, -5, '#2a2e38'], [3, -3, '#2a2e38']],
  barlow: [[-3, 0, STEEL], [-2, 0, STEEL], [-1, 0, STEEL], [0, 0, STEEL], [1, 0, STEEL], [2, 0, STEEL], [3, 0, STEEL], [-3, -1, '#2a2e38'], [-3, 1, '#2a2e38'], [3, -1, '#2a2e38'], [3, 1, '#2a2e38']],
  tray: [[1, 1, '#aeb6c4'], [2, 1, '#aeb6c4'], [3, 1, '#aeb6c4'], [2, 0, '#e0a040']],
  cards: [[2, 1, '#f4f1e8']],
  glass: [[1, 1, '#bfe8ff'], [1, 0, '#bfe8ff']],
  beaker: [[2, 0, '#8ef0c8'], [2, 1, '#6ad0a8']],
  clip: [[2, 1, '#c9a86a'], [2, 2, '#e8e2d0']],
  spoon: [[3, 2, STEEL], [3, 3, STEEL]],
  ext: [[2, 1, '#d83a2a'], [2, 2, '#d83a2a'], [2, 3, '#a82a1e'], [3, 1, METAL]],
  bag: [[-1, 1, '#6a5a3a'], [-1, 2, '#6a5a3a'], [-2, 2, '#6a5a3a']],
  basket: [[1, 1, '#c9b28a'], [2, 1, '#e6dcc8'], [3, 1, '#c9b28a'], [1, 2, '#c9b28a'], [2, 2, '#c9b28a'], [3, 2, '#c9b28a']],
};

// Colour keys → the crew member's colours
function palette(look) {
  return {
    h: look.hair, s: look.skinShade, S: look.skin, e: look.eye, U: look.top, u: look.topShade, a: look.topShade, I: look.badge,
    k: look.belt, P: look.pants, p: shade(look.pants, -.3), B: look.boots, W: '#eeeae0', M: '#6a7384', v: '#6ae0ff', c: look.hat || '#c0453a',
    C: shade(look.hat || '#c0453a', -.25), x: look.alienCol || look.skin, X: look.alienTip || '#fff27a',
  };
}

function bodyPixels(look, stance) {
  const [view, legs, top] = STANCE[stance];
  const px = [], H = HEADS[view][look.style] || HEADS[view].short;
  const put = (x, y, k) => px.push([x, y, k]);
  H.r.forEach((row, j) => [...row].forEach((k, i) => { if (k !== '.') put(i - 3, top + j, k); }));
  for (const [x, j, k] of H.x || []) put(x, top + j, k);
  if (look.alien && ALIEN[view][look.alien]) for (const [x, j, k] of ALIEN[view][look.alien]) put(x, top + j, k);
  const torso = look.coat && view !== 'back' ? (view === 'side' ? ['..WWW..', '..WWW..', '..WWW..', '..WWW..'] : ['.WWIWW.', '.WWWWW.', '.WWWWW.', '.SWWWS.']) : TORSO[view];
  torso.forEach((row, j) => [...row].forEach((k, i) => { if (k !== '.') put(i - 3, top + 4 + j, k); }));
  LEGS[legs].forEach((row, j) => [...row].forEach((k, i) => { if (k !== '.') put(i - 3, top + 8 + j, k); }));
  if (look.coat && view === 'side' && legs !== 'sit' && legs !== 'floor') put(-1, top + 8, 'W'), put(0, top + 8, 'W');
  return { px, ty: top + 4 };
}

// A lying figure: a blanket over the body and the head at the facing end. y 0 is the mattress top.
function lyingPixels(look, blanket) {
  const px = [], b = blanket || '#5b6c9a', bl = shade(b, .18);
  for (let x = -6; x <= 2; x++) { px.push([x, -2, bl]); px.push([x, -1, b]); }
  px.push([-5, -3, bl], [-4, -3, bl], [-3, -3, bl]);  // feet under the blanket
  const P = palette(look);
  px.push([3, -3, P.h], [4, -3, P.h], [3, -2, P.h], [4, -2, P.S], [5, -2, P.S], [4, -1, P.S], [5, -1, P.s], [3, -1, P.h]);
  if (look.style === 'bald') px.push([3, -3, P.s], [4, -3, P.S], [3, -2, P.s]);
  return px;
}

const CACHE = new Map();
// Returns { c, ox, oy }: draw the canvas at (x - ox, y - oy) to put the feet at (x, y).
export function crewSprite(look, stance, arms = 'none', prop = 'none', flip = false, blanket) {
  const key = look.id + '|' + stance + '|' + arms + '|' + prop + '|' + (flip ? 1 : 0) + '|' + (blanket || '');
  let s = CACHE.get(key);
  if (s) return s;
  const P = palette(look);
  let px;
  if (stance === 'lie') px = lyingPixels(look, blanket).map(([x, y, c]) => [x, y, c]);
  else {
    const b = bodyPixels(look, stance);
    px = b.px.map(([x, y, k]) => [x, y, P[k] || k]);
    for (const [x, j, k] of ARMS[arms] || []) px.push([x, b.ty + j, P[k] || k]);
    for (const [x, j, c] of PROPS[prop] || []) px.push([x, b.ty + j, c]);
  }
  let x0 = 0, x1 = 0, y0 = 0, y1 = -1;
  for (const [x, y] of px) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const w = x1 - x0 + 3, h = y1 - y0 + 3, c = mk(w, h), g = ctx2d(c);
  const ox = -x0 + 1, oy = -y0 + 1, F = x => flip ? w - 1 - x : x;
  const solid = new Set(px.map(([x, y]) => (x + ox) + ',' + (y + oy)));
  g.fillStyle = OUTLINE;
  for (const [x, y] of px) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const X = x + ox + dx, Y = y + oy + dy;
    if (!solid.has(X + ',' + Y)) g.fillRect(F(X), Y, 1, 1);
  }
  for (const [x, y, col] of px) { g.fillStyle = col; g.fillRect(F(x + ox), y + oy, 1, 1); }
  s = { c, ox: flip ? w - 1 - ox : ox, oy };
  CACHE.set(key, s);
  return s;
}
export const clearSpriteCache = () => CACHE.clear();

/* ---------- looks ---------- */
export const DEPT = {
  command:     { name: 'Command',     top: '#d8a53a', badge: '#fff2c0' },
  security:    { name: 'Security',    top: '#c2402f', badge: '#e8e8e8' },
  engineering: { name: 'Engineering', top: '#e07a28', badge: '#fff2c0' },
  science:     { name: 'Science',     top: '#3b82c4', badge: '#e8e8e8' },
  medical:     { name: 'Medical',     top: '#4fb8a8', badge: '#e8e8e8' },
  operations:  { name: 'Operations',  top: '#5a9e52', badge: '#e8e8e8' },
  culinary:    { name: 'Galley',      top: '#e9e4d8', badge: '#c0453a' },
  flight:      { name: 'Flight',      top: '#8c8f48', badge: '#ffd966' },
};
const SKINS = ['#f3cfae', '#e7b48c', '#d59a6a', '#b87848', '#8d5a34', '#6a4226', '#4e2f1c', '#f6dccb'];
const ALIEN_SKINS = [['#8fcf8a', '#5f9a5a'], ['#9bb4ea', '#6a82bc'], ['#c9a4dc', '#9a74b0'], ['#9aa6ae', '#6c7880'], ['#e0cf8a', '#b09c58'], ['#e89a8a', '#b86a5a']];
const HAIRS = ['#2b1d14', '#3d2616', '#5c3a1e', '#8a5a2a', '#c9a060', '#e6d6a0', '#9a3322', '#1a1a1e', '#b8b8c0', '#6a3a8a', '#2e6ea8', '#c94a8a'];
const STYLES = ['short', 'short', 'crop', 'crop', 'long', 'bun', 'pony', 'bald', 'afro', 'mohawk'];
let lookId = 0;
export function makeLook(R, dept, opts = {}) {
  const D = DEPT[dept], alien = R.chance(.16);
  const [skin, skinShade] = alien ? R.pick(ALIEN_SKINS) : (s => [s, shade(s, -.22)])(R.pick(SKINS));
  const hair = R.chance(.12) ? R.pick(HAIRS.slice(8)) : R.pick(HAIRS.slice(0, 8));
  let style = R.pick(STYLES);
  if (alien && R.chance(.5)) style = R.pick(['bald', 'crop', 'short']);
  const look = {
    id: ++lookId, dept, skin, skinShade, hair, style, isAlien: alien, eye: alien && R.chance(.4) ? R.pick(['#ffe45a', '#ff5a8a', '#6affd0']) : '#1a1210',
    top: D.top, topShade: shade(D.top, -.28), badge: D.badge, belt: '#262a33', pants: dept === 'culinary' ? '#3a3f4c' : '#2c3140', boots: '#16181e',
    alien: alien ? R.pick(['antenna', 'horns', 'crest', null, null]) : null, alienCol: skinShade, alienTip: R.pick(['#fff27a', '#7affe0', '#ff8ad8']),
    coat: false, hat: null,
  };
  if (opts.coat) look.coat = true;
  if (opts.style) look.style = opts.style;
  if (opts.hat) look.hat = opts.hat;
  return look;
}
export function sameLook(look) { return { ...look, id: ++lookId }; }

/* ---------- other small sprites, as [x, y, colour] with (0, 0) at the floor ---------- */
const pxs = (rows, pal, x0, y0) => { const o = []; rows.forEach((r, j) => [...r].forEach((k, i) => { if (k !== '.') o.push([x0 + i, y0 + j, pal[k]]); })); return o; };
export const CAT = (col, dark) => {
  // side on, facing right: tail up behind, ears and an eye on the head
  const pal = { o: col, d: dark, e: '#c8ff6a', k: '#1a1a1a', p: '#f0a0a0' };
  return {
    walk0: pxs(['o.....d.d', 'o.....ooo', '.oooooeok', '.ooooooo.', '.o.d.o.d.'], pal, -4, -5),
    walk1: pxs(['o.....d.d', 'o.....ooo', '.oooooeok', '.ooooooo.', '..o.d.o..'], pal, -4, -5),
    sit: pxs(['.....d.d', '.....ooo', 'o....eok', 'o..oooo.', '.ooooo..'], pal, -4, -5),
    sleep: pxs(['...d.d.', '.ooooo.', 'oooooodo'.slice(0, 7), 'dooooo.'], pal, -3, -4),
  };
};
export const DROID = { body: pxs(['.ggg.', 'gGGGg', 'gcccg', '.kkk.'], { g: '#9aa4b4', G: '#c8d0dc', c: '#46c8ff', k: '#2a2e38' }, -2, -4) };
