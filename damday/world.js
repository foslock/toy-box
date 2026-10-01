// Wickerby, hand-built: the valley and the seven rooms you can walk into. Everything here is plain data (tiles,
// props, doors, the places people stand), so the page, the renderer and the headless check all read the same town.
import { hash } from './util.js';

export const T = 16;
export const G = { GRASS: 0, PATH: 2, COBBLE: 3, WATER: 4, DEEP: 5, SAND: 6, PLANK: 7, FLOOR: 8, TILE: 9, RAIL: 10, HILL: 11, STONE: 12, WALL: 14, RUG: 15, CLIFF: 16, PLATFORM: 17 };

export class Area {
  constructor(id, name, w, h, fill = G.GRASS, interior = false) {
    this.id = id; this.name = name; this.w = w; this.h = h; this.interior = interior;
    this.g = new Uint8Array(w * h).fill(fill); this.s = new Uint8Array(w * h); this.safe = new Uint8Array(w * h);
    this.props = []; this.doors = new Map(); this.exit = null;
  }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  at(x, y) { return this.inb(x, y) ? this.g[y * this.w + x] : G.GRASS; }
  set(x, y, g) { if (this.inb(x, y)) this.g[y * this.w + x] = g; }
  rect(x, y, w, h, g) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, g); }
  block(x, y, w = 1, h = 1, v = 1) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (this.inb(x + i, y + j)) this.s[(y + j) * this.w + x + i] = v; }
  markSafe(x, y, w, h) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (this.inb(x + i, y + j)) this.safe[(y + j) * this.w + x + i] = 1; }
  // (x, y) is the footprint's top-left tile; `up` is how far the picture rises above it. Solid unless said otherwise.
  add(k, x, y, o = {}) {
    const p = { k, x, y, w: 1, h: 1, up: 0, solid: true, ...o };
    this.props.push(p);
    if (p.solid) this.block(p.x, p.y, p.w, p.h);
    return p;
  }
  walk(x, y) { return this.inb(x, y) && !this.s[y * this.w + x]; }
  isSafe(x, y) { return this.interior ? !!this.safeAll : !!this.safe[y * this.w + x]; }
  door(x, y, to, tx, ty, dir) { this.doors.set(x + ',' + y, { to, x: tx, y: ty, dir }); }
}

export const MAPS = {};
export const OBJECTS = [];       // things to read or use: { id, map, x, y }
export const ANCHORS = {};       // where people stand: name -> { map, x, y, face, act }
export const ZONES = [];         // for naming where somebody was seen

const obj = (id, map, x, y) => OBJECTS.push({ id, map, x, y });
const anchor = (name, map, x, y, face = 'down', act = 'idle') => { ANCHORS[name] = { map, x, y, face, act }; };

/* ------------------------------------------------------------------------------------------------------- the valley */
function buildTown() {
  const W = 56, H = 44, a = new Area('town', 'Wickerby', W, H);
  // the reservoir behind the dam, and the dam itself (walkway on top, face below)
  a.rect(0, 0, W, 3, G.DEEP); a.block(0, 0, W, 3);
  a.rect(12, 3, 30, 2, G.STONE); a.block(12, 4, 28, 1); a.rect(0, 3, 12, 2, G.CLIFF); a.block(0, 3, 12, 2); a.rect(42, 3, 14, 2, G.CLIFF); a.block(42, 3, 14, 2);
  // the river, in its two banks of sand
  for (let y = 5; y < H; y++) { a.rect(22, y, 1, 1, G.SAND); a.rect(26, y, 1, 1, G.SAND); a.rect(23, y, 3, 1, G.WATER); a.block(23, y, 3, 1); }
  // the hill: high ground, with a cliff face and one ramp up from Main Street
  a.rect(40, 5, 14, 16, G.HILL); a.markSafe(40, 3, 14, 18);
  a.rect(39, 5, 1, 14, G.CLIFF); a.block(39, 5, 1, 14); a.rect(40, 21, 14, 1, G.CLIFF); a.block(40, 21, 14, 1);
  a.rect(39, 19, 1, 2, G.PATH); a.set(41, 4, G.PATH); a.set(41, 5, G.PATH);
  // streets: Main Street over the bridge, Low Lane over the footbridge, dirt tracks to the mill and the pier
  a.rect(3, 19, 36, 2, G.COBBLE); a.rect(3, 32, 40, 2, G.COBBLE);
  a.rect(23, 19, 3, 2, G.PLANK); a.block(23, 19, 3, 2, 0); a.rect(23, 32, 3, 2, G.PLANK); a.block(23, 32, 3, 2, 0);
  a.rect(40, 19, 2, 2, G.PATH); a.rect(18, 12, 1, 7, G.PATH); a.rect(19, 15, 2, 1, G.PATH);
  a.rect(21, 15, 4, 1, G.PLANK); a.block(23, 15, 2, 1, 0);                         // the pier
  a.rect(27, 18, 11, 1, G.COBBLE);                                                  // Town Hall plaza
  a.rect(8, 34, 2, 1, G.PATH);
  // the station: platform, rails
  a.rect(3, 35, 14, 5, G.PLATFORM); a.rect(0, 40, W, 2, G.RAIL); a.block(0, 40, W, 2);
  // the green: grass, a gravel ring, and a little stage
  a.rect(29, 22, 9, 4, G.PATH); a.rect(30, 23, 7, 2, G.GRASS); a.rect(34, 22, 3, 2, G.PLANK);
  // the chapel plaza and the way up
  a.rect(42, 13, 11, 3, G.COBBLE); a.rect(40, 16, 2, 4, G.PATH); a.rect(41, 16, 2, 1, G.PATH);

  // buildings: every tile of the footprint is solid except the doormat
  const house = (style, x, y, w, h, dx, to, tx, ty, o = {}) => {
    a.add('house', x, y, { w, h, style, up: o.up ?? 1, ...o });
    a.block(x + dx, y + h - 1, 1, 1, 0); if (to) a.door(x + dx, y + h - 1, to, tx, ty, 'up');
  };
  house('clock', 8, 13, 7, 6, 3, 'clock', 4, 5, { roof: 'lav', wall: 'rose' });
  house('hall', 28, 11, 9, 7, 4, 'hall', 5, 6, { roof: 'sky', wall: 'cream', up: 2 });
  house('bakery', 28, 27, 7, 5, 3, 'bakery', 4, 5, { roof: 'peach', wall: 'cream' });
  house('fire', 36, 27, 8, 5, 3, 'fire', 5, 6, { roof: 'rose', wall: 'cream', up: 3 });
  house('inn', 6, 25, 8, 7, 3, 'inn', 5, 6, { roof: 'butter', wall: 'mint' });
  house('mill', 15, 7, 7, 5, 3, 'mill', 4, 5, { roof: 'mint', wall: 'cream' });
  house('chapel', 44, 6, 7, 7, 3, 'chapel', 5, 7, { roof: 'sky', wall: 'cream', up: 4 });
  house('office', 12, 35, 5, 3, 2, null, 0, 0, { roof: 'peach', wall: 'cream', up: 1 });
  a.block(14, 37, 1, 1, 1);                                                          // the ticket-office door is for show
  a.add('wheel', 22, 8, { w: 1, h: 3, up: 0 });
  a.add('sluice', 23, 3, { w: 3, h: 2, solid: false, up: 1 });

  // furniture of the street
  a.add('bench', 7, 38, { w: 2, h: 1, solid: false });
  a.add('board', 5, 36, { w: 2, h: 1, up: 1 });
  a.add('postclock', 10, 36, { w: 1, h: 1, up: 2 });
  a.add('stage', 34, 22, { w: 3, h: 2, solid: false, up: 2 });
  a.add('pole', 33, 22, { up: 2 }); a.add('pole', 37, 22, { up: 2 });
  a.add('fountain', 30, 23, { w: 2, h: 2, up: 1 });
  a.add('bench', 29, 26, { w: 2, h: 1, solid: false }); a.add('bench', 36, 26, { w: 2, h: 1, solid: false });
  a.add('sign', 29, 32, { w: 1, h: 1, up: 1 });
  a.add('lamp', 27, 19, { up: 2 }); a.add('lamp', 38, 19, { up: 2 }); a.add('lamp', 12, 19, { up: 2 }); a.add('lamp', 12, 32, { up: 2 }); a.add('lamp', 38, 32, { up: 2 });
  a.add('bucket', 22, 14, { solid: true });
  a.add('plaque', 33, 4, { w: 1, h: 1, solid: false, up: 0 });
  a.add('crack', 29, 4, { w: 1, h: 1, solid: false });
  for (let k = 0; k < 2; k++) for (let i = 0; i < 5; i++) a.add('sheet', 15 + i, 26 + k * 2, { solid: i === 0 || i === 4, up: 1, seed: k * 5 + i });
  for (let x = 14; x <= 21; x++) { a.add('fence', x, 24, { up: 0 }); a.add('fence', x, 30, { up: 0 }); }
  // flowers, shrubs and trees: the border thick, the inside sparse
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = x < 2 || x > 53 || y > 42, hv = hash(x, y, 4);
    if (edge && y >= 5 && !(y >= 40 && y <= 41)) a.add('tree', x, y, { up: 2, seed: hv, solid: true });
    else if (y < 3 || a.g[y * W + x] !== G.GRASS || a.s[y * W + x]) continue;
    else if (hv < 0.014 && !a.props.some(p => x >= p.x - 1 && x <= p.x + p.w && y >= p.y - 1 && y <= p.y + p.h) && !(y >= 17 && y <= 22 && x >= 3 && x <= 40) && !(x >= 28 && x <= 38 && y >= 21 && y <= 27)) a.add(hv < .006 ? 'tree' : 'bush', x, y, { up: hv < .006 ? 2 : 0, seed: hv * 99 });
  }
  for (const [x, y] of [[4, 26], [5, 28], [3, 30], [16, 16], [20, 18], [33, 29], [27, 22], [38, 24], [27, 30], [45, 17], [51, 18], [42, 8], [43, 18]]) a.add('flowers', x, y, { solid: false, seed: x * 7 + y });
  for (const [x, y] of [[3, 24], [4, 22], [5, 31], [3, 12], [4, 8], [8, 9], [10, 8], [13, 9], [30, 6], [34, 7], [44, 20], [52, 14], [52, 8], [48, 17], [47, 4]]) a.add('tree', x, y, { up: 2, seed: x * 3 + y });
  a.add('duck', 24, 25, { solid: false, seed: 1 }); a.add('duck', 24, 11, { solid: false, seed: 2 }); a.add('duck', 24, 36, { solid: false, seed: 3 });
  a.block(41, 4, 1, 2, 0);

  // doors
  MAPS.town = a;
  obj('board_station', 'town', 5, 36); obj('station_clock', 'town', 10, 36); obj('sign_bakery', 'town', 29, 32); obj('plaque', 'town', 33, 4);
  obj('crack', 'town', 29, 4); obj('sluice', 'town', 24, 3); obj('river', 'town', 24, 14); obj('sheets', 'town', 17, 26); obj('stage_sign', 'town', 33, 22);
  obj('bucket', 'town', 22, 14);
  ZONES.push(
    { n: 'the Pier', x: 19, y: 14, w: 6, h: 3 }, { n: 'the Mill', x: 14, y: 6, w: 9, h: 7 }, { n: 'the Bridge', x: 23, y: 19, w: 3, h: 2 },
    { n: 'the Station', x: 3, y: 33, w: 14, h: 8 }, { n: 'Town Hall steps', x: 27, y: 17, w: 11, h: 2 }, { n: 'the Green', x: 28, y: 21, w: 11, h: 6 },
    { n: 'Chapel Hill', x: 40, y: 3, w: 14, h: 18 }, { n: 'the Dam', x: 12, y: 3, w: 29, h: 2 }, { n: 'Main Street', x: 3, y: 19, w: 37, h: 2 },
    { n: 'Low Lane', x: 3, y: 32, w: 41, h: 2 }, { n: 'the Inn yard', x: 14, y: 24, w: 8, h: 7 }, { n: 'the Bakery door', x: 27, y: 27, w: 8, h: 6 }, { n: 'the Fire Station door', x: 36, y: 27, w: 9, h: 6 },
  );
  return a;
}

/* ------------------------------------------------------------------------------------------------------- rooms */
function room(id, name, w, h, outX, outY, o = {}) {
  const a = new Area(id, name, w, h, o.floor ?? G.FLOOR, true);
  a.rect(0, 0, w, 2, G.WALL); a.block(0, 0, w, 2); a.exit = { x: (w / 2) | 0, y: h - 1 };
  a.rect(a.exit.x, h - 1, 1, 1, G.RUG);
  a.door(a.exit.x, h - 1, 'town', outX, outY, 'down');
  a.safeAll = !!o.safeAll; a.tint = o.tint || '#fff3d6';
  MAPS[id] = a; return a;
}
const P = (a, k, x, y, o = {}) => a.add(k, x, y, o);

function buildRooms() {
  let a = room('inn', 'the Drowsy Heron', 11, 8, 9, 32);
  P(a, 'fireplace', 4, 0, { w: 3, h: 2, solid: false }); a.block(4, 1, 3, 1);
  P(a, 'counter', 1, 3, { w: 4, h: 1 }); P(a, 'table', 7, 4, { w: 2, h: 1 }); P(a, 'stool', 6, 4); P(a, 'stool', 9, 4); P(a, 'table', 7, 6, { w: 2, h: 1 });
  P(a, 'shelf', 1, 0, { w: 2, h: 2, solid: false }); P(a, 'window', 8, 0, { w: 2, h: 2, solid: false }); P(a, 'easel', 9, 2); P(a, 'plant', 10, 6); P(a, 'plant', 1, 6);
  a.rect(4, 5, 3, 2, G.RUG);
  obj('slate', 'inn', 9, 2); obj('guestbook', 'inn', 2, 3);
  anchor('inn_orla', 'inn', 5, 2, 'down', 'sleep'); anchor('inn_orla_up', 'inn', 5, 3, 'down', 'idle');

  a = room('clock', 'Tock & Daughters, Clocks', 9, 7, 11, 19);
  for (const x of [1, 3, 5]) P(a, 'clockwall', x, 0, { w: 2, h: 2, solid: false, seed: x });
  P(a, 'grand', 7, 2, { w: 1, h: 2, up: 1 }); P(a, 'counter', 2, 4, { w: 4, h: 1 }); P(a, 'bench', 1, 2, { w: 2, h: 1 }); P(a, 'plant', 7, 5); a.rect(3, 5, 3, 1, G.RUG);
  obj('grand', 'clock', 7, 3); obj('wallclocks', 'clock', 3, 1);
  anchor('clock_wim', 'clock', 3, 3, 'down', 'tinker');

  a = room('bakery', 'Crumb & Crumble', 9, 7, 31, 32);
  P(a, 'counter', 1, 3, { w: 5, h: 1 }); P(a, 'oven', 6, 0, { w: 2, h: 2, solid: false }); a.block(6, 1, 2, 1); P(a, 'shelf', 6, 2, { w: 2, h: 1 }); P(a, 'loaves', 1, 0, { w: 3, h: 2, solid: false }); a.block(1, 1, 3, 1);
  P(a, 'table', 6, 4, { w: 2, h: 1 }); P(a, 'stool', 5, 4); P(a, 'plant', 0, 5); a.rect(3, 5, 3, 1, G.RUG);
  obj('timothy', 'bakery', 6, 2); obj('loaf_tags', 'bakery', 2, 1);
  anchor('bakery_margo', 'bakery', 3, 2, 'down', 'bake');

  a = room('hall', 'Town Hall', 10, 8, 32, 18);
  P(a, 'desk', 2, 2, { w: 4, h: 1 }); P(a, 'portrait', 5, 0, { w: 2, h: 2, solid: false }); a.block(5, 1, 2, 1); P(a, 'basket', 8, 3); P(a, 'lectern', 1, 3);
  P(a, 'flagwall', 2, 0, { w: 2, h: 2, solid: false }); P(a, 'flagwall', 8, 0, { w: 1, h: 2, solid: false }); P(a, 'plant', 8, 6); P(a, 'plant', 1, 6); a.rect(3, 4, 4, 2, G.RUG);
  obj('notes', 'hall', 3, 2); obj('portrait', 'hall', 6, 1); obj('ledger', 'hall', 1, 3);

  a = room('fire', 'the Fire Station', 11, 8, 39, 32);
  P(a, 'engine', 1, 3, { w: 4, h: 3 }); P(a, 'sirenbox', 8, 0, { w: 1, h: 2, solid: false }); a.block(8, 1, 1, 1); P(a, 'board', 6, 0, { w: 1, h: 2, solid: false }); a.block(6, 1, 1, 1);
  P(a, 'cot', 9, 4, { w: 1, h: 2 }); P(a, 'buckets', 7, 5); P(a, 'window', 2, 0, { w: 2, h: 2, solid: false }); P(a, 'plant', 10, 7, { solid: false }); a.rect(6, 3, 2, 3, G.RUG);
  obj('siren_box', 'fire', 8, 1); obj('fire_notice', 'fire', 6, 1);
  anchor('fire_iggy', 'fire', 7, 3, 'down', 'drill');

  a = room('chapel', 'the Chapel', 11, 9, 47, 13, { safeAll: true });
  P(a, 'altar', 4, 0, { w: 3, h: 2, solid: false }); a.block(4, 1, 3, 1);
  for (const [x, y] of [[1, 4], [1, 6], [7, 4], [7, 6]]) P(a, 'pew', x, y, { w: 3, h: 1 });
  P(a, 'lectern', 1, 2); P(a, 'rope', 9, 0, { w: 1, h: 3, solid: false }); a.block(9, 1, 1, 2); P(a, 'window', 2, 0, { w: 2, h: 2, solid: false }); P(a, 'window', 7, 0, { w: 2, h: 2, solid: false });
  a.rect(4, 3, 3, 5, G.RUG);
  obj('diary', 'chapel', 1, 2); obj('rope', 'chapel', 9, 2);
  anchor('chapel_gideon', 'chapel', 8, 3, 'left', 'ring');

  a = room('mill', "Orla's workshop", 9, 7, 18, 12);
  P(a, 'drafting', 1, 2, { w: 3, h: 2 }); P(a, 'model', 6, 3, { w: 2, h: 1 }); P(a, 'stove', 6, 0, { w: 2, h: 2, solid: false }); a.block(6, 1, 2, 1);
  P(a, 'cot', 7, 5, { w: 1, h: 1, solid: false }); P(a, 'window', 2, 0, { w: 2, h: 2, solid: false }); P(a, 'crate', 0, 5); a.rect(3, 4, 3, 2, G.RUG);
  obj('log', 'mill', 2, 3); obj('model_dam', 'mill', 6, 3);
  anchor('mill_orla', 'mill', 4, 4, 'down', 'tinker');
}

/* ------------------------------------------------------------------------------------------ where people stand */
function buildAnchors() {
  anchor('station_bench', 'town', 7, 38, 'down', 'sit');
  anchor('platform_end', 'town', 12, 38, 'left', 'shout'); anchor('main_mid', 'town', 27, 20, 'down', 'shout'); anchor('hall_side', 'town', 36, 18, 'left', 'shout');
  anchor('bakery_door', 'town', 33, 32, 'up', 'shout'); anchor('green_c', 'town', 36, 25, 'up', 'shout');
  anchor('hall_mayor', 'town', 32, 18, 'down', 'speak'); anchor('hall_cat', 'town', 30, 18, 'down', 'cat');
  anchor('green_stage', 'town', 35, 23, 'down', 'speak'); anchor('green_cat', 'town', 33, 25, 'up', 'cat');
  anchor('pier_end', 'town', 24, 15, 'right', 'fish'); anchor('pier_cat', 'town', 22, 15, 'right', 'cat');
  anchor('bakery_sill', 'town', 28, 32, 'up', 'cat'); anchor('green_snack', 'town', 31, 25, 'up', 'sing');
  anchor('dam_orla', 'town', 28, 3, 'down', 'tinker'); anchor('fire_drill', 'town', 40, 32, 'down', 'drill');
  const spots = [[43, 16], [45, 16], [47, 16], [49, 16], [51, 16], [44, 18], [46, 18], [48, 18], [50, 18], [52, 18], [47, 20], [43, 20]];
  ['mayor', 'cat', 'orla', 'barnaby', 'margo', 'wim', 'iggy', 'pim', 'gideon', 'you', 'x1', 'x2'].forEach((n, i) => anchor('hill_' + n, 'town', spots[i][0], spots[i][1], 'down', 'idle'));
  anchor('hill_gideon', 'chapel', 8, 3, 'left', 'ring');
}

buildTown(); buildRooms(); buildAnchors();
export const PLAYER_START = { map: 'town', x: 7, y: 38 };
export const HILL_BOX = { x: 40, y: 3, w: 14, h: 18 };

export function placeAt(map, x, y) {
  const a = MAPS[map];
  if (a.interior) return a.name;
  for (const z of ZONES) if (x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h) return z.n;
  return 'the valley';
}

// Walkable neighbours, including doors: a node is "map:x,y", and stepping onto a doormat leads indoors (or out).
export const key = (m, x, y) => m + ':' + x + ',' + y;
export function neighbours(m, x, y) {
  const a = MAPS[m], out = [];
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const nx = x + dx, ny = y + dy; if (a.walk(nx, ny)) out.push([m, nx, ny]); }
  return out;
}
export function doorAt(m, x, y) { return MAPS[m].doors.get(x + ',' + y) || null; }

export function findPath(from, to, blocked) {
  const k0 = key(from.map, from.x, from.y), k1 = key(to.map, to.x, to.y);
  if (k0 === k1) return [];
  const prev = new Map([[k0, null]]); let q = [[from.map, from.x, from.y]], qi = 0;
  while (qi < q.length) {
    const [m, x, y] = q[qi++], ck = key(m, x, y);
    if (ck === k1) break;
    const next = neighbours(m, x, y);
    const d = doorAt(m, x, y); if (d) next.length = 0, next.push([d.to, d.x, d.y]);
    for (const n of next) { const nk = key(n[0], n[1], n[2]); if (prev.has(nk)) continue; if (blocked && blocked(n[0], n[1], n[2])) continue; prev.set(nk, ck); q.push(n); }
  }
  if (!prev.has(k1)) return null;
  const path = []; let c = k1;
  while (c && c !== k0) { const m = c.match(/^(\w+):(-?\d+),(-?\d+)$/); path.push({ map: m[1], x: +m[2], y: +m[3] }); c = prev.get(c); }
  return path.reverse();
}
