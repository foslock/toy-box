// The ant farm as a simulation, with no drawing in it: the dirt, the food, the ants and what each is up to, the rooms
// they dig and the colony's pantry. The page draws it (render.js) and the balance runs drive it with no page at all
// (balance.mjs). `farm.step(dt)` moves it on by dt seconds.
//
// How ants find their way: for each place they go (the pantry, a food pocket, the dump on top) the farm keeps a
// distance map over the cells an ant can stand in, and an ant just walks downhill on it. Digging works the same way,
// on a map where dirt costs more than open tunnel (and rock can't be crossed): a digger walks downhill and digs out
// whatever is in the way, so tunnels bend around rocks and follow soft layers. The maps are rebuilt a moment after the
// dirt changes.
//
// What an ant does is a generator: it yields a step to take or a pause (digging, picking up, eating), and the farm
// plays those out at the ant's speed. When one job ends the ant picks another (decide).
import { W, H, AIR, SPOIL, ROCK, THING, ROOT, MATS, diggable, ANTS, SOURCES, UPGRADE_BY_ID, MAX_LEVEL, HUNGRY, STARVE,
  START_FOOD, OFFICER, BROOD, ITEMS, MAX_ANTS, aphidCost } from './rules.js';
import { generate, mulberry32, hash2 } from './world.js';

const N = W * H;
export const INF = 0x3fffffff;
export const X = i => i % W, Y = i => (i / W) | 0;

// Every cell's eight neighbours (−1 off the edge): right, left, down, up, then the diagonals.
const DX = [1, -1, 0, 0, 1, -1, 1, -1], DY = [0, 0, 1, -1, 1, 1, -1, -1];
const NB = new Int32Array(N * 8);
for (let i = 0; i < N; i++) {
  const x = X(i), y = Y(i);
  for (let k = 0; k < 8; k++) { const nx = x + DX[k], ny = y + DY[k]; NB[i * 8 + k] = nx >= 0 && ny >= 0 && nx < W && ny < H ? ny * W + nx : -1; }
}
const DIGC = MATS.map(m => m.hard ? Math.round(m.hard * 10) : 0);   // extra cost of digging through a cell, by material
const RING = 64;                                                    // > the dearest single step on any map
const buckets = Array.from({ length: RING }, () => []);
const DUMP_SHARE = 0.4;        // dug dirt packs down: five cells dug make two cells on the pile up top

const NAMES = ['Pip', 'Tink', 'Moss', 'Bix', 'Dot', 'Juniper', 'Nib', 'Fern', 'Crumb', 'Pebble', 'Sprig', 'Hazel', 'Tuck', 'Wren', 'Clover', 'Bean',
  'Pim', 'Rue', 'Scout', 'Tansy', 'Burr', 'Nettle', 'Poppy', 'Sorrel', 'Tuft', 'Ivy', 'Flint', 'Grit', 'Hops', 'Kip', 'Lark', 'Midge', 'Nutmeg',
  'Olive', 'Pepper', 'Quill', 'Rowan', 'Sage', 'Thistle', 'Umber', 'Vetch', 'Willow', 'Yarrow', 'Zinnia', 'Acorn', 'Birch', 'Cress', 'Dill',
  'Ember', 'Figgy', 'Ginger', 'Heath', 'Inky', 'Jot', 'Kelp', 'Lentil', 'Mote', 'Nutkin', 'Orzo', 'Pod', 'Quince', 'Rye', 'Speck', 'Tallow'];
const QUEENS = ['Queen Bea', 'Queen Maud', 'Queen Ada', 'Queen Tilly', 'Queen Mab', 'Queen Hester', 'Queen Rosalind', 'Queen Olga'];

// Pack a byte array for saving: runs as [value, count] pairs, then base64.
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
function rle(u8) {
  const out = [];
  for (let i = 0; i < u8.length;) { const v = u8[i]; let n = 1; while (i + n < u8.length && u8[i + n] === v && n < 255) n++; out.push(v, n); i += n; }
  return b64(Uint8Array.from(out));
}
const sameCells = (a, b) => a.length === b.length && a.every((v, k) => v === b[k]);
const FOOD_JOBS = new Set(['eat', 'deliver', 'gather', 'queen']);
const ROOM_PRIO = { nursery: 5.5, pantry: 3.5, midden: 3, rest: 2 };
function unrle(s, len) {
  const p = unb64(s), u = new Uint8Array(len);
  let o = 0;
  for (let i = 0; i + 1 < p.length && o < len; i += 2) { u.fill(p[i], o, Math.min(len, o + p[i + 1])); o += p[i + 1]; }
  return u;
}

export class Farm {
  // A new farm from a seed, or a saved one (see toJSON).
  constructor(seed, save = null) {
    this.seed = (save ? save.seed : seed) >>> 0;
    const w = generate(this.seed);
    this.mat = w.mat; this.aux = w.aux; this.surf = w.surf;
    this.plants = w.plants; this.tufts = w.tufts; this.lost = w.lost; this.dripX = w.dripX;
    this.sources = w.sources;
    this.nextId = 100;
    this.t = 0;
    this.rand = mulberry32(this.seed ^ 0x51f15e);
    this.walk = new Uint8Array(N);
    this.roomOf = new Uint16Array(N);         // which room a cell belongs to (0: none)
    this.noise = new Uint8Array(N);           // a little extra digging cost per cell, so tunnels wander
    for (let i = 0; i < N; i++) this.noise[i] = Math.floor(hash2(X(i), Y(i), this.seed + 77) * 5);
    this.explored = new Uint8Array((W >> 3) * (H >> 3));   // 8×8 blocks some ant has been close enough to smell
    this.dirtCells = 0;
    for (let i = 0; i < N; i++) if (diggable(this.mat[i])) this.dirtCells++;
    this.ants = []; this.items = []; this.rooms = []; this.projects = []; this.brood = [];
    this.colony = null;                       // { home: room id, founded: time } once there's an ant
    this.food = 0;
    this.upgrades = {};
    this.layOn = true;                        // whether the queen lays when there's food to spare
    this.feedAt = 0;                          // when the free crumbs can next be dropped
    this.stats = { gathered: 0, eaten: 0, dug: 0, born: 0, bought: 0, died: 0, starved: 0, spent: 0, used: 0, firstFood: null };
    this.fields = new Map();
    this.gridVer = 0; this.walkVer = 0;
    this.changed = [];                        // cells changed since the drawing last looked (render.js empties it)
    this.events = [];                         // news for the player (main.js empties it)
    this.fx = [];                             // little effects to draw: dirt flying, a drop falling (render.js)
    this.headless = false;                    // the balance runs set this so nothing piles up unread
    this.clock = 0; this.auraClock = 0;
    this.ledger = [];                         // [time, gathered, eaten, used] once a second, for the rates on the HUD
    this.entrances = []; this.dumpCells = [];
    this.projSerial = 1;
    if (save) this.load(save);
    for (let i = 0; i < N; i++) this.walk[i] = this.walkable(i);
    this.markRooms();
    if (save) this.resume(); else this.refreshSurface();
  }

  /* ---------- the grid ---------- */
  solid(x, y) { return x < 0 || x >= W || y >= H ? true : y < 0 ? false : this.mat[y * W + x] !== AIR; }
  walkable(i) {
    if (this.mat[i] !== AIR) return 0;
    const x = X(i), y = Y(i);
    if (x === 0 || x === W - 1 || y === H - 1) return 1;
    for (let k = 0; k < 8; k++) { const j = NB[i * 8 + k]; if (j >= 0 && this.mat[j] !== AIR) return 1; }
    return 0;
  }
  setCell(i, m, a = 0) {
    this.mat[i] = m; this.aux[i] = a;
    if (!this.headless) this.changed.push(i);
    this.gridVer++;
    let moved = false;
    const w0 = this.walkable(i);
    if (w0 !== this.walk[i]) { this.walk[i] = w0; moved = true; }
    for (let k = 0; k < 8; k++) {
      const j = NB[i * 8 + k];
      if (j < 0) continue;
      const w = this.walkable(j);
      if (w !== this.walk[j]) { this.walk[j] = w; moved = true; }
    }
    if (moved) this.walkVer++;
  }
  // A diagonal step between two cells is allowed only if it doesn't squeeze between two solid corners.
  passDiag(i, k) { return this.mat[i + DX[k]] === AIR || this.mat[i + DY[k] * W] === AIR; }
  // Can an ant step from c to its neighbour j right now?
  canStep(c, j) {
    if (!this.walk[j]) return false;
    const dx = X(j) - X(c), dy = Y(j) - Y(c);
    return !dx || !dy || this.mat[c + dx] === AIR || this.mat[c + dy * W] === AIR;
  }
  isSky(i) { return Y(i) < this.surf[X(i)]; }
  nearestWalkable(i, maxR = 8) {
    if (this.walk[i]) return i;
    const x0 = X(i), y0 = Y(i);
    for (let r = 1; r <= maxR; r++) {
      let best = -1, bd = 1e9;
      for (let y = y0 - r; y <= y0 + r; y++) for (let x = x0 - r; x <= x0 + r; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const j = y * W + x, d = (x - x0) ** 2 + (y - y0) ** 2;
        if (this.walk[j] && d < bd) { bd = d; best = j; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /* ---------- distance maps ---------- */
  // key → { kind: 'walk' | 'dig', targets(): cell list, dist, ver, at }. Maps are made on first use and rebuilt, at
  // most every half second (walking) or second and a half (digging), after the dirt changes.
  // Digging maps keep off the top couple of rows of ground (so only a dig meant to reach the surface breaks through
  // it from below) unless `crust` is set.
  defField(key, kind, targets, crust = false) {
    let f = this.fields.get(key);
    if (!f) { f = { kind, targets, crust, dist: null, ver: -1, at: -1e9, force: false }; this.fields.set(key, f); }
    else { f.targets = targets; f.crust = crust; f.force = true; }
    return f;
  }
  dropField(key) { this.fields.delete(key); }
  field(key) {
    const f = this.fields.get(key);
    if (!f) return null;
    const ver = f.kind === 'walk' ? this.walkVer : this.gridVer;
    if (!f.dist || f.force || (f.ver !== ver && this.t - f.at >= (f.kind === 'walk' ? 0.5 : 1.5))) {
      if (!f.dist) f.dist = new Int32Array(N);
      if (f.kind === 'walk') this.walkMap(f.dist, f.targets()); else this.digMap(f.dist, f.targets(), f.crust);
      f.ver = ver; f.at = this.t; f.force = false;
    }
    return f;
  }
  walkMap(dist, targets) {
    dist.fill(INF);
    let pending = 0;
    for (const s of targets) if (this.walk[s] && dist[s]) { dist[s] = 0; buckets[0].push(s); pending++; }
    const walk = this.walk;
    for (let cur = 0; pending > 0; cur++) {
      const b = buckets[cur % RING];
      while (b.length) {
        const i = b.pop(); pending--;
        if (dist[i] !== cur) continue;
        for (let k = 0; k < 8; k++) {
          const j = NB[i * 8 + k];
          if (j < 0 || !walk[j]) continue;
          if (k >= 4 && !this.passDiag(i, k)) continue;
          const nd = cur + (k < 4 ? 2 : 3);
          if (nd < dist[j]) { dist[j] = nd; buckets[nd % RING].push(j); pending++; }
        }
      }
    }
  }
  digMap(dist, targets, crust) {
    dist.fill(INF);
    let pending = 0;
    const mat = this.mat, walk = this.walk, noise = this.noise, surf = this.surf;
    for (const s of targets) if (dist[s]) { dist[s] = 0; buckets[0].push(s); pending++; }
    for (let cur = 0; pending > 0; cur++) {
      const b = buckets[cur % RING];
      while (b.length) {
        const i = b.pop(); pending--;
        if (dist[i] !== cur) continue;
        for (let k = 0; k < 8; k++) {
          const j = NB[i * 8 + k];
          if (j < 0) continue;
          const m = mat[j];
          let c;
          if (m === AIR) { if (!walk[j]) continue; c = (j / W | 0) < surf[j % W] ? 5 : 2; }     // (walking on top is a detour)
          else if (DIGC[m] && (crust || (j / W | 0) > surf[j % W] + 1)) c = 2 + DIGC[m] + noise[j];
          else continue;
          // a diagonal needs a corner that's open or can be dug open
          if (k >= 4) { const p = mat[i + DX[k]], q = mat[i + DY[k] * W]; if (!(p === AIR || DIGC[p] || q === AIR || DIGC[q])) continue; }
          const nd = cur + (k < 4 ? c : (c * 3) >> 1);
          if (nd < dist[j]) { dist[j] = nd; buckets[nd % RING].push(j); pending++; }
        }
      }
    }
  }
  // The next step downhill on a walking map (any of the best few, at random, so ants don't all walk one line).
  downhill(c, dist) {
    const d0 = dist[c];
    let best = INF;
    for (let k = 0; k < 8; k++) {
      const j = NB[c * 8 + k];
      if (j < 0 || !this.walk[j] || dist[j] >= d0 || (k >= 4 && !this.passDiag(c, k))) continue;
      if (dist[j] < best) best = dist[j];
    }
    if (best >= INF) return -1;
    let pick = -1, n = 0;
    for (let k = 0; k < 8; k++) {
      const j = NB[c * 8 + k];
      if (j < 0 || !this.walk[j] || dist[j] > best + 1 || dist[j] >= d0 || (k >= 4 && !this.passDiag(c, k))) continue;
      if (this.rand() < 1 / ++n) pick = j;
    }
    return pick;
  }
  // The next cell downhill on a digging map: open tunnel or diggable dirt.
  digDownhill(c, dist) {
    const d0 = dist[c];
    let best = d0, pick = -1, ties = 0;
    for (let k = 0; k < 8; k++) {
      const j = NB[c * 8 + k];
      if (j < 0) continue;
      const m = this.mat[j];
      if (m === AIR ? !this.walk[j] : !diggable(m)) continue;
      if (k >= 4) { const p = this.mat[c + DX[k]], q = this.mat[c + DY[k] * W]; if (!(p === AIR || diggable(p) || q === AIR || diggable(q))) continue; }
      const d = dist[j];
      if (d < best) { best = d; pick = j; ties = 1; } else if (d === best && pick >= 0 && this.rand() < 1 / ++ties) pick = j;
    }
    return pick;
  }

  /* ---------- rooms ---------- */
  // A room is a dome: an ellipse with its bottom cut off flat, so there's a floor to pile things on.
  roomCells(r) {
    const cells = [];
    const floor = r.cy + r.ry * 0.55;
    for (let y = Math.floor(r.cy - r.ry); y <= Math.ceil(floor); y++) for (let x = Math.floor(r.cx - r.rx); x <= Math.ceil(r.cx + r.rx); x++) {
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || y > floor) continue;
      if (((x + .5 - r.cx) / r.rx) ** 2 + ((y + .5 - r.cy) / r.ry) ** 2 <= 1) cells.push(y * W + x);
    }
    return cells;
  }
  markRooms() {
    this.roomOf.fill(0);
    for (const r of this.rooms) { r.cells = this.roomCells(r); for (const i of r.cells) if (!this.roomOf[i]) this.roomOf[i] = r.id; }
  }
  room(type) { return this.rooms.find(r => r.type === type) || null; }
  roomsOf(type) { return this.rooms.filter(r => r.type === type); }
  homeRooms() { return this.rooms.filter(r => r.type === 'pantry'); }
  addRoom(type, cx, cy, rx, ry, dug = false) {
    const r = { id: this.rooms.reduce((m, q) => Math.max(m, q.id), 0) + 1, type, cx, cy, rx, ry, cells: [], dug };
    this.rooms.push(r);
    this.markRooms();
    this.defField('room:' + r.id, 'walk', () => r.cells.filter(i => this.walk[i]));
    if (type === 'pantry') this.fields.get('home') && (this.fields.get('home').force = true);
    return r;
  }
  undug(r) { let n = 0; for (const i of r.cells) if (diggable(this.mat[i])) n++; return n; }
  pantryCap() { let n = 0; for (const r of this.homeRooms()) for (const i of r.cells) if (this.mat[i] === AIR) n++; return Math.round(n * 1.3); }

  /* ---------- the surface: entrances and where dug dirt goes ---------- */
  refreshSurface() {
    const home = this.colony ? this.field('home') : null;
    this.entrances = [];
    for (let x = 1; x < W - 1; x++) {
      const i = this.surf[x] * W + x;
      if (this.surf[x] < H && this.mat[i] === AIR && (!home || home.dist[i] < INF || home.dist[i - W] < INF)) this.entrances.push(x);
    }
    // Dump a few cells to either side of each entrance, clear of the entrances, the drip and food lying on top.
    const bad = new Uint8Array(W);
    for (const e of this.entrances) for (let d = -3; d <= 3; d++) if (e + d >= 0 && e + d < W) bad[e + d] = 1;
    for (const s of this.sources) if (s.surface && !s.gone) for (let d = -2; d <= 2; d++) if (s.x + d >= 0 && s.x + d < W) bad[s.x + d] = 1;
    // Of the ground within reach of an entrance, only the lower half: the pile spreads out instead of building a tower.
    const cols = new Set();
    for (const e of this.entrances) for (let d = 5; d <= 36; d++) for (const x of [e - d, e + d]) if (x >= 2 && x <= W - 3 && !bad[x]) cols.add(x);
    const heights = [...cols].map(x => this.surf[x]).sort((p, q) => p - q), mid = heights[Math.floor(heights.length / 2)] ?? 0;
    const cells = [];
    for (const x of [...cols].sort((p, q) => p - q)) {
      if (this.surf[x] < mid || this.surf[x] < 6) continue;
      const i = (this.surf[x] - 1) * W + x;
      if (this.walk[i]) cells.push(i);
    }
    if (!sameCells(cells, this.dumpCells)) {
      this.dumpCells = cells;
      if (this.fields.has('dump')) this.fields.get('dump').force = true;
    }
    for (const s of this.sources) if (s.surface && !s.gone) this.surfaceAccess(s);
  }
  surfaceAccess(s) {
    s.y = this.surf[s.x] - 1;
    const cells = [];
    for (let x = s.x - 1; x <= s.x + 1; x++) { if (x < 0 || x >= W) continue; const i = (this.surf[x] - 1) * W + x; if (this.surf[x] >= 1 && this.walk[i]) cells.push(i); }
    if (!sameCells(cells, s.cells)) {
      s.cells = cells;
      if (this.fields.has('src:' + s.id)) this.fields.get('src:' + s.id).force = true;
    }
  }
  // Dug dirt from an ant, dropped at the top: it settles into a pile, sliding off anything steeper than a step.
  dumpSpoil(c, n, m) {
    const cells = Math.max(1, Math.round(n * DUMP_SHARE));
    const x0 = X(c);
    const blocked = x => x < 1 || x > W - 2 || this.mat[this.surf[x] * W + x] === AIR || this.sources.some(s => s.surface && Math.abs(s.x - x) <= 1);
    for (let k = 0; k < cells; k++) {
      let x = Math.max(1, Math.min(W - 2, x0 + Math.floor(this.rand() * 3) - 1));
      if (blocked(x)) x = x0;
      // roll off anything steeper than a step, and now and then off a single step, for a natural slope; a hole
      // (an entrance) is rolled right over
      for (let s = 0; s < 60; s++) {
        const h = this.surf[x], drop = n => (n >= h + 2 || (n === h + 1 && this.rand() < .35));
        const side = d => { let nx = x + d; while (nx > 1 && nx < W - 2 && blocked(nx) && Math.abs(nx - x) < 4) nx += d; return nx > 1 && nx < W - 2 && !blocked(nx) && drop(this.surf[nx]) ? nx : -1; };
        const l = side(-1), r = side(1);
        if (l >= 0 && r >= 0) x = this.rand() < .5 ? l : r; else if (l >= 0) x = l; else if (r >= 0) x = r; else break;
      }
      const y = this.surf[x] - 1;
      if (y < 5 || this.mat[this.surf[x] * W + x] === AIR) continue;     // full to the lid here: it gets tamped down
      this.setCell(y * W + x, SPOIL, (m << 3) | Math.floor(this.rand() * 5));
      this.surf[x] = y;
    }
    this.refreshSurface();
  }

  /* ---------- ants ---------- */
  lvl(id) { return this.upgrades[id] || 0; }
  speedOf(a) { return ANTS[a.type].speed * (1 + .15 * this.lvl('legs')) * (a.aura ? OFFICER.boost : 1) * (a.energy <= 0 ? .6 : 1); }
  digRate(a) { return ANTS[a.type].dig * (1 + .4 * this.lvl('jaws')) * (a.aura ? OFFICER.boost : 1); }
  carryCap(a) { return ANTS[a.type].carry + this.lvl('loads'); }
  spoilCap(a) { return ANTS[a.type].spoil * (1 + this.lvl('loads')); }
  smellOf(a) { return ANTS[a.type].smell * (1 + .5 * this.lvl('nose')); }
  hungerOf(a) { return ANTS[a.type].hunger / (1 - .15 * this.lvl('thrift')); }
  count(type) { let n = 0; for (const a of this.ants) if (a.type === type) n++; return n; }

  spawn(type, c, o = {}) {
    let name = o.name;
    if (!name) {
      const used = new Set(this.ants.map(a => a.name)), pool = type === 'queen' ? QUEENS : NAMES, free = pool.filter(n => !used.has(n));
      name = free.length ? free[Math.floor(this.rand() * free.length)] : pool[Math.floor(this.rand() * pool.length)] + ' ' + ['II', 'III', 'IV', 'V'][Math.floor(this.rand() * 4)];
    }
    const a = { id: this.nextId++, type, name, c, n: -1, t: 0, z: (this.rand() - .5) * 5, energy: o.energy ?? 1, starve: 0, spoil: 0, spoilMat: 2,
      carry: null, age: 0, walked: 0, busy: 0, act: '', at: -1, task: null, job: '', dir: this.rand() < .5 ? -1 : 1, aura: false, born: this.t, dug: 0 };
    this.ants.push(a);
    return a;
  }
  abort(a) { if (a.task) { const t = a.task; a.task = null; try { t.return(); } catch { /* already finished */ } } a.busy = 0; a.act = ''; a.job = ''; }
  kill(a, cause) {
    this.abort(a);
    const k = this.ants.indexOf(a);
    if (k >= 0) this.ants.splice(k, 1);
    this.stats.died++;
    if (cause === 'starved') this.stats.starved++;
    const c = this.mat[a.c] === AIR ? a.c : this.nearestWalkable(a.c);
    if (c >= 0) this.items.push({ id: this.nextId++, kind: 'corpse', c, type: a.type, placed: false, claimed: 0, t: this.t, name: a.name });
    this.event('died', { ant: a, cause });
  }
  event(type, o = {}) { if (this.headless && type !== 'died') return; this.events.push({ type, t: this.t, ...o }); if (this.events.length > 200) this.events.shift(); }
  effect(o) { if (this.headless) return; this.fx.push(o); if (this.fx.length > 400) this.fx.shift(); }

  tickAnt(a, dt) {
    a.age += dt;
    a.energy -= dt / this.hungerOf(a);
    if (a.energy <= 0) {
      a.energy = 0; a.starve += dt;
      if (a.starve >= STARVE * (a.type === 'queen' ? 3 : 1)) { this.kill(a, 'starved'); return; }
    } else a.starve = 0;
    if (this.mat[a.c] !== AIR) {        // buried by a falling clod: climb out
      const c = this.nearestWalkable(a.c, 6);
      if (c >= 0) { a.c = c; a.n = -1; a.t = 0; }
    } else if (!this.walk[a.c] && a.n < 0) {   // the dirt all round was dug away: drop to the nearest thing to stand on
      const c = this.nearestWalkable(a.c, 8);
      if (c >= 0) a.c = c;
    }
    let time = dt;
    for (let guard = 0; time > 1e-6 && guard < 24; guard++) {
      if (a.busy > 0) {
        const d = Math.min(a.busy, time);
        a.busy -= d; time -= d;
        if (a.busy > 1e-6) break;
        a.busy = 0; a.act = '';
      }
      if (a.n >= 0) {
        if (this.mat[a.n] !== AIR) { a.n = -1; a.t = 0; continue; }
        const diag = X(a.n) !== X(a.c) && Y(a.n) !== Y(a.c), len = diag ? 1.4142 : 1, sp = this.speedOf(a);
        const need = (1 - a.t) * len / sp;
        if (time >= need) { time -= need; a.walked += (1 - a.t) * len; a.c = a.n; a.n = -1; a.t = 0; }
        else { a.t += time * sp / len; a.walked += time * sp; time = 0; break; }
        continue;
      }
      const ins = this.next(a);
      if (!ins) { a.busy = .5 + this.rand() * .5; a.act = 'idle'; continue; }
      if (ins.move !== undefined) {
        if (!this.walk[ins.move] && this.mat[ins.move] !== AIR) { a.busy = .2; continue; }
        const dx = X(ins.move) - X(a.c);
        if (dx) a.dir = dx > 0 ? 1 : -1;
        a.n = ins.move; a.t = 0;
      } else { a.busy = ins.wait; a.act = ins.act || ''; a.at = ins.at ?? -1; if (a.at >= 0 && X(a.at) !== X(a.c)) a.dir = X(a.at) > X(a.c) ? 1 : -1; }
    }
  }
  next(a) {
    // Hunger comes first: drop what you're doing (unless it's already about food) and go and eat, if there's food.
    if (a.task && a.energy < HUNGRY && !FOOD_JOBS.has(a.job) && this.canEat(a)) this.abort(a);
    for (let tries = 0; tries < 3; tries++) {
      if (!a.task) { a.task = this.decide(a); if (!a.task) return null; }
      let r;
      try { r = a.task.next(); } catch (e) { console.error(e); r = { done: true }; }
      if (!r.done && r.value) return r.value;
      a.task = null; a.job = '';
    }
    return null;
  }
  connected(a) { const f = this.field('home'); return !!f && (f.dist[a.c] < INF || this.nbDist(a.c, f.dist) < INF); }
  // The best distance among the cells an ant at c could step to.
  nbDist(c, dist) { let m = INF; for (let k = 0; k < 8; k++) { const j = NB[c * 8 + k]; if (j >= 0 && dist[j] < m && this.canStep(c, j)) m = dist[j]; } return m; }
  distTo(key, c) { const f = this.field(key); if (!f) return INF; return Math.min(f.dist[c], this.nbDist(c, f.dist) + 2); }

  // What to do next. Eating comes first, then whatever each kind of ant is for, then fetching food, then helping dig,
  // then a rest.
  decide(a) {
    if (a.type === 'queen') return this.queenJob(a);
    if (!this.colony) return this.restJob(a);
    if (a.carry?.kind === 'corpse') this.dropCorpse(a);
    if (a.energy < HUNGRY && this.canEat(a)) return this.eatJob(a);
    if (!this.connected(a)) return a.spoil >= this.spoilCap(a) ? this.haulJob(a) : this.connectJob(a);
    if (a.carry?.kind === 'food') return this.deliverJob(a);
    const lean = this.food < this.ants.length * .6 + 2;       // pantry nearly empty: everyone fetches food
    switch (a.type) {
      case 'digger': {
        const p = this.bestProject(a, false);
        if (p) return this.digJob(a, p);
        if (!lean && this.rand() < .6) {
          const t = this.unexploredTarget(a);
          if (t >= 0) return this.exploreJob(a, t);
          const g = this.galleryTarget(a);
          if (g >= 0) return this.exploreJob(a, g, false);
        }
        break;
      }
      case 'scout': if (!lean && this.rand() < .8) { const t = this.unexploredTarget(a); if (t >= 0) return this.exploreJob(a, t); } break;
      case 'nurse': if (!lean && this.brood.length && this.room('nursery')?.dug) return this.tendJob(a); break;
      case 'officer': if (!lean && this.rand() < .6) return this.patrolJob(a); break;
    }
    if (a.spoil > 0) return this.haulJob(a);
    // With the pantry well stocked, workers spend some of their time digging instead of fetching.
    const rich = this.food > 40 + 3 * this.ants.length;
    if (rich && a.type === 'worker' && this.rand() < .5) { const p = this.bestProject(a, true, false, true); if (p) return this.digJob(a, p); }
    const src = this.bestSource(a);
    if (src) return this.gatherJob(a, src);
    if ((a.type === 'worker' || a.type === 'officer') && (this.room('midden')?.dug || this.dumpCells.length)) {
      const body = this.items.find(i => i.kind === 'corpse' && !i.placed && !i.claimed);
      if (body) return this.corpseJob(a, body);
    }
    const p = this.bestProject(a, true, lean);
    if (p) return this.digJob(a, p);
    // Nothing to do: some go looking for food, the way foragers do (most of them, when there's no food known at all).
    const noFood = !this.sources.some(s => s.known && !s.gone && (s.reach || !(s.stuckUntil > this.t)));
    if (this.rand() < (noFood ? .7 : .3)) {
      const t = this.unexploredTarget(a);
      if (t >= 0) return this.exploreJob(a, t);
    }
    return this.restJob(a);
  }
  // Is there food this ant could get at: in its jaws, in the pantry, or out at a source?
  canEat(a) { return a.carry?.kind === 'food' || (this.food >= 1 && this.connected(a)) || !!this.bestSource(a, true); }

  /* ---------- jobs ---------- */
  // Walk down a map to its target. true: arrived; false: there's no way there (for now).
  *goTo(a, key) {
    let stuck = 0;
    for (let steps = 0; steps < 3000; steps++) {
      const f = this.field(key);
      if (!f) return false;
      if (f.dist[a.c] === 0) return true;
      const nx = this.downhill(a.c, f.dist);
      if (nx >= 0) { stuck = 0; yield { move: nx }; continue; }
      if (++stuck > 3) return false;
      f.force = stuck === 2;
      yield { wait: .35 };
    }
    return false;
  }
  *eatJob(a) {
    a.job = 'eat';
    if (a.carry?.kind === 'food') { yield { wait: 1, act: 'eat' }; this.eatCarried(a); return; }
    if (this.food >= 1 && this.connected(a) && (yield* this.goTo(a, 'home')) && this.food >= 1) {
      yield { wait: 1.2, act: 'eat' };
      if (this.food >= 1) { this.food -= 1; a.energy = 1; this.stats.eaten++; this.stats.used++; return; }
    }
    const src = this.bestSource(a, true);
    if (src) { yield* this.gatherJob(a, src); return; }
    yield { wait: 2, act: 'idle' };
  }
  eatCarried(a) {
    if (a.carry?.kind !== 'food') return;
    a.carry.n--; a.energy = 1; this.stats.eaten++;
    if (a.carry.n <= 0) a.carry = null;
  }
  *gatherJob(a, src) {
    a.job = 'gather';
    let held = this.carryCap(a);
    src.reserved += held;
    try {
      if (!(yield* this.goTo(a, 'src:' + src.id))) return;
      for (let w = 0; src.stock < 1 && src.infinite && w < 14 && !src.gone; w++) yield { wait: 1, act: 'wait' };
      if (src.stock < 1 || src.gone) return;
      yield { wait: .7, act: 'pick', at: src.cells[0] ?? -1 };
      const got = Math.min(this.carryCap(a), Math.floor(src.stock));
      if (got < 1) return;
      src.stock -= got; src.reserved -= held; held = 0;
      a.carry = { kind: 'food', n: got, look: SOURCES[src.kind].look };
      this.taken(src);
      if (a.energy < .5) this.eatCarried(a);
    } finally { src.reserved -= held; }
    if (a.carry) yield* this.deliverJob(a);
  }
  *deliverJob(a) {
    a.job = 'deliver';
    if (!(yield* this.goTo(a, 'home'))) return;
    yield { wait: .5, act: 'drop' };
    if (a.carry?.kind !== 'food') return;
    this.food += a.carry.n; this.stats.gathered += a.carry.n;
    if (this.stats.firstFood === null) { this.stats.firstFood = this.t; this.event('firstFood'); }
    this.event('stored', { n: a.carry.n, c: a.c });
    a.carry = null;
  }
  *haulJob(a) {
    if (a.spoil <= 0) return;
    a.job = 'haul';
    a.carry = { kind: 'spoil', n: a.spoil, m: a.spoilMat };
    try {
      // A long way up: often the dirt is just packed into the tunnel walls instead.
      const far = this.distTo('dump', a.c) > 110 && this.rand() < .6;
      if (!far && this.dumpCells.length && this.fields.has('dump') && (yield* this.goTo(a, 'dump'))) {
        yield { wait: .5, act: 'drop' };
        this.dumpSpoil(a.c, a.spoil, a.spoilMat);
      } else yield { wait: 1.1, act: 'pack' };      // no way up yet: it gets pressed into the tunnel walls
      a.spoil = 0;
    } finally { if (a.carry?.kind === 'spoil') a.carry = null; }
  }
  // The cells one bite of digging takes out: the cell ahead plus enough around it for a tunnel an ant fits in.
  brush(c, n, crust = false) {
    const cells = [n], dx = X(n) - X(c), dy = Y(n) - Y(c), x = X(n), y = Y(n), r = this.rand;
    const add = (xx, yy) => { if (xx > 0 && yy > 0 && xx < W - 1 && yy < H - 1) cells.push(yy * W + xx); };
    if (dy === 0) { add(x, y - 1); if (r() < .35) add(x, y - 2); if (r() < .25) add(x, y + 1); }
    else if (dx === 0) { const s = r() < .5 ? 1 : -1; add(x + s, y); if (r() < .45) add(x - s, y); }
    else { add(X(c) + dx, Y(c)); add(X(c), Y(c) + dy); if (r() < .6) add(x, y - 1); if (r() < .3) add(x + dx, y); }
    return cells.filter((i, k) => diggable(this.mat[i]) && (crust || k === 0 || Y(i) > this.surf[X(i)] + 1));
  }
  digOut(a, cells) {
    let n = 0;
    for (const i of cells) {
      const m = this.mat[i];
      if (!diggable(m)) continue;
      a.spoilMat = m === SPOIL ? this.aux[i] >> 3 : m;
      this.setCell(i, AIR, 0);
      n++;
    }
    if (n) { a.spoil += n; a.dug += n; this.stats.dug += n; this.effect({ kind: 'dig', c: cells[0], m: a.spoilMat }); }
    return n;
  }
  // Follow a digging map to its target, digging whatever's in the way and hauling the dirt up as it fills your jaws.
  // Stops when done() says so (checked each step), at the target, when hungry, or if there's no way.
  *digAlong(a, key, done, maxDug = Infinity) {
    let stuck = 0, dug = 0, arrived = 0;
    for (let steps = 0; steps < 4000; steps++) {
      if (done()) return true;
      if (a.energy < HUNGRY && this.canEat(a)) return false;      // (with no food to be had, keep digging toward some)
      if (a.spoil >= this.spoilCap(a)) {
        yield* this.haulJob(a);
        a.job = 'dig';
        continue;
      }
      if (dug >= maxDug) return false;
      const f = this.field(key);
      if (!f) return false;
      if (f.dist[a.c] === 0) {
        // at the target, as far as the map knows; it may just be out of date, so look again once or twice
        if (++arrived > 2) return true;
        f.force = true;
        continue;
      }
      const nx = this.digDownhill(a.c, f.dist);
      if (nx < 0) { if (++stuck > 4) return false; f.force = stuck === 2; yield { wait: .4 }; continue; }
      stuck = 0;
      if (this.mat[nx] !== AIR) {
        const cells = this.brush(a.c, nx, f.crust);
        let time = 0;
        for (const i of cells) time += MATS[this.mat[i]].hard;
        yield { wait: Math.max(.25, time / this.digRate(a)), act: 'dig', at: nx };
        dug += this.digOut(a, cells);
      }
      // A diagonal between two solid corners: open one of them up first.
      const dx = X(nx) - X(a.c), dy = Y(nx) - Y(a.c);
      if (dx && dy && this.mat[a.c + dx] !== AIR && this.mat[a.c + dy * W] !== AIR) {
        const p = a.c + dx, q = a.c + dy * W, corner = diggable(this.mat[p]) ? p : diggable(this.mat[q]) ? q : -1;
        if (corner < 0) { yield { wait: .3 }; continue; }
        yield { wait: Math.max(.2, MATS[this.mat[corner]].hard / this.digRate(a)), act: 'dig', at: corner };
        dug += this.digOut(a, [corner]);
      }
      if (this.canStep(a.c, nx)) yield { move: nx }; else yield { wait: .2 };
    }
    return false;
  }
  *digJob(a, p) {
    a.job = 'dig';
    p.workers.add(a.id);
    const dug0 = a.dug;
    let ok = true;
    try {
      if (p.kind === 'room') {
        const r = this.rooms.find(q => q.id === p.room);
        if (!r) return;
        const inRoom = () => this.roomOf[a.c] === r.id || this.roomNear(a.c, r.id);
        if (!inRoom()) ok = yield* this.digAlong(a, p.key, inRoom);
        if (ok) ok = yield* this.excavate(a, r);
      } else ok = yield* this.digAlong(a, p.key, () => p.done);
    } finally {
      p.workers.delete(a.id);
      // A dig nobody can make headway on is given up (for a while), rather than tried forever.
      if (!ok && a.dug === dug0 && a.energy >= HUNGRY && !p.done && ++p.fails >= 6) {
        this.finish(p);
        const s = p.kind === 'reach' && this.sources.find(q => q.id === p.src);
        if (s) s.stuckUntil = this.t + 180;
      }
    }
  }
  roomNear(c, id) { for (let k = 0; k < 4; k++) { const j = NB[c * 8 + k]; if (j >= 0 && this.roomOf[j] === id) return true; } return false; }
  // Hollow out a room from inside: always the nearest undug bit of it you can get to. false if there was none to
  // get to from here.
  *excavate(a, r) {
    for (let n = 0; n < 600; n++) {
      if (a.energy < HUNGRY && this.canEat(a)) return true;
      if (a.spoil >= this.spoilCap(a)) {
        yield* this.haulJob(a);
        a.job = 'dig';
        if (!(yield* this.goTo(a, 'room:' + r.id))) return n > 0;
        continue;
      }
      const plan = this.nearestFace(a.c, r.id);
      if (!plan) {
        if (this.roomOf[a.c] !== r.id) return n > 0;
        if (!r.dug) { r.dug = true; this.event('room', { room: r }); }
        return true;
      }
      for (const s of plan.path) { if (!this.canStep(a.c, s)) break; yield { move: s }; }
      if (!this.isNear(a.c, plan.dig) || !diggable(this.mat[plan.dig])) continue;
      yield { wait: Math.max(.2, MATS[this.mat[plan.dig]].hard / this.digRate(a)), act: 'dig', at: plan.dig };
      this.digOut(a, [plan.dig]);
    }
    return true;
  }
  isNear(c, j) { for (let k = 0; k < 8; k++) if (NB[c * 8 + k] === j) return true; return false; }
  // Breadth-first from c over cells an ant can stand in, to the nearest one touching an undug cell of room `id`.
  nearestFace(c, id) {
    const seen = this._seen || (this._seen = new Map());
    seen.clear(); seen.set(c, -1);
    const q = [c];
    for (let h = 0; h < q.length && q.length < 500; h++) {
      const i = q[h];
      for (let k = 0; k < 8; k++) {
        const j = NB[i * 8 + k];
        if (j >= 0 && this.roomOf[j] === id && diggable(this.mat[j])) {
          const path = [];
          for (let p = i; p !== c && p >= 0; p = seen.get(p)) path.push(p);
          return { path: path.reverse(), dig: j };
        }
      }
      for (let k = 0; k < 8; k++) {
        const j = NB[i * 8 + k];
        if (j < 0 || seen.has(j) || !this.walk[j] || (k >= 4 && !this.passDiag(i, k))) continue;
        const rj = this.roomOf[j];
        if (rj !== id && !this.roomNear(j, id) && !(rj === 0 && this.dist2(j, c) < 9)) continue;
        seen.set(j, i); q.push(j);
      }
    }
    return null;
  }
  dist2(i, j) { return (X(i) - X(j)) ** 2 + (Y(i) - Y(j)) ** 2; }
  *connectJob(a) {
    a.job = 'dig';
    this.defField('net', 'dig', () => { const h = this.field('home'); const out = []; if (h) for (let i = 0; i < N; i++) if (h.dist[i] < INF) out.push(i); return out; }, true);
    yield* this.digAlong(a, 'net', () => this.connected(a));
  }
  *restJob(a) {
    a.job = 'rest';
    const room = this.pickRest(a);
    if (room && this.connected(a)) yield* this.goTo(a, 'room:' + room.id);
    const until = this.t + 3 + this.rand() * 6;
    while (this.t < until) {
      if (this.rand() < .3) {
        const j = this.randomStep(a.c, room?.id);
        if (j >= 0) { yield { move: j }; continue; }
      }
      yield { wait: .6 + this.rand() * 1.4, act: 'rest' };
    }
  }
  pickRest(a) {
    const rest = this.roomsOf('rest').filter(r => r.dug);
    if (rest.length) return rest[a.id % rest.length];
    return this.homeRooms()[0] || null;
  }
  randomStep(c, roomId) {
    const opts = [];
    for (let k = 0; k < 8; k++) {
      const j = NB[c * 8 + k];
      if (j < 0 || !this.walk[j] || (k >= 4 && !this.passDiag(c, k))) continue;
      if (roomId && this.roomOf[j] !== roomId && this.roomOf[c] === roomId) continue;
      opts.push(j);
    }
    return opts.length ? opts[Math.floor(this.rand() * opts.length)] : -1;
  }
  // Dig off toward a spot: until it's been sniffed out (exploring), or until you get there (a new gallery).
  *exploreJob(a, target, sniff = true) {
    a.job = sniff ? 'explore' : 'gallery';
    const key = 'x:' + a.id;
    this.defField(key, 'dig', () => [target]);
    const b = this.blockOf(target);
    try { yield* this.digAlong(a, key, () => sniff && this.explored[b] === 1, 40); }
    finally { this.dropField(key); }
  }
  *tendJob(a) {
    a.job = 'tend';
    const r = this.room('nursery');
    if (!r || !(yield* this.goTo(a, 'room:' + r.id))) return;
    const until = this.t + 12 + this.rand() * 10;
    while (this.t < until && this.brood.length && a.energy >= HUNGRY) {
      if (this.rand() < .35) { const j = this.randomStep(a.c, r.id); if (j >= 0) { yield { move: j }; continue; } }
      yield { wait: .8 + this.rand(), act: 'tend' };
    }
  }
  *patrolJob(a) {
    a.job = 'patrol';
    const busy = this.ants.filter(b => b !== a && (b.job === 'dig' || b.job === 'gather' || b.job === 'deliver') && this.connected(b));
    const to = busy.length ? busy[Math.floor(this.rand() * busy.length)].c : -1;
    if (to >= 0) {
      const key = 'p:' + a.id, cell = this.nearestWalkable(to, 3);
      if (cell >= 0) {
        this.defField(key, 'walk', () => [cell]);
        try { yield* this.goTo(a, key); } finally { this.dropField(key); }
      }
    }
    for (let k = 0; k < 4; k++) {
      const j = this.randomStep(a.c);
      if (j >= 0 && this.rand() < .5) yield { move: j }; else yield { wait: 1, act: 'look' };
    }
  }
  *corpseJob(a, body) {
    a.job = 'corpse';
    body.claimed = a.id;
    const key = 'i:' + body.id;
    try {
      const cell = this.nearestWalkable(body.c, 3);
      if (cell < 0) { body.placed = true; return; }
      this.defField(key, 'walk', () => [cell]);
      if (!(yield* this.goTo(a, key))) return;
      yield { wait: .8, act: 'pick', at: body.c };
      if (!this.items.includes(body)) return;
      this.items.splice(this.items.indexOf(body), 1);
      a.carry = { kind: 'corpse', type: body.type, name: body.name };
      const mid = this.room('midden');
      const dest = mid?.dug ? 'room:' + mid.id : this.dumpCells.length ? 'dump' : null;
      if (dest) yield* this.goTo(a, dest);
      yield { wait: .6, act: 'drop' };
      this.dropCorpse(a, (!!mid?.dug && this.roomOf[a.c] === mid.id) || (dest === 'dump' && this.isSky(a.c)));
    } finally {
      this.dropField(key);
      if (body.claimed === a.id) body.claimed = 0;
      if (a.carry?.kind === 'corpse') this.dropCorpse(a);
    }
  }
  dropCorpse(a, placed = false) {
    if (a.carry?.kind !== 'corpse') return;
    this.items.push({ id: this.nextId++, kind: 'corpse', c: a.c, type: a.carry.type, name: a.carry.name, placed, claimed: 0, t: this.t });
    a.carry = null;
  }
  *queenJob(a) {
    a.job = 'queen';
    const r = this.room('nursery');
    if (r?.dug && this.roomOf[a.c] !== r.id && this.connected(a)) { if (!(yield* this.goTo(a, 'room:' + r.id))) { yield { wait: 3, act: 'rest' }; return; } }
    if (!this.connected(a) && this.colony) { yield* this.connectJob(a); return; }
    for (let k = 0; k < 4; k++) {
      if (this.rand() < .2) { const j = this.randomStep(a.c, r?.dug ? r.id : 0); if (j >= 0) { yield { move: j }; continue; } }
      yield { wait: 2 + this.rand() * 2, act: 'rest' };
    }
  }

  /* ---------- food ---------- */
  sourceAvail(s) { return s.stock - s.reserved + (s.infinite ? 1 : 0); }
  bestSource(a, forSelf = false) {
    let best = null, bs = -Infinity;
    for (const s of this.sources) {
      if (!s.known || !s.reach || s.gone) continue;
      const avail = forSelf ? s.stock + (s.infinite ? 1 : 0) - Math.max(0, s.reserved - 2) : this.sourceAvail(s);
      if (avail <= 0) continue;
      const d = this.distTo('src:' + s.id, a.c);
      if (d >= INF) continue;
      const score = Math.min(avail, 4) / (d / 2 + 25) * (.75 + this.rand() * .5);
      if (score > bs) { bs = score; best = s; }
    }
    return best;
  }
  taken(s) {
    if (!s.infinite && s.stock <= 0 && !s.gone) {
      s.gone = true; s.goneAt = this.t;
      this.event('emptied', { src: s });
      this.dropField('src:' + s.id);
    }
  }
  addSource(o) {
    const s = { id: this.nextId++, reserved: 0, known: true, reach: false, gone: false, timer: 0, ...o };
    this.sources.push(s);
    this.sourceField(s);
    return s;
  }
  sourceField(s) { this.defField('src:' + s.id, 'walk', () => s.cells.filter(i => this.walk[i])); }

  /* ---------- the colony, once a second ---------- */
  plan() {
    const t = this.t;
    // Food it can smell. The very first ant knows where the nearest food is.
    for (const s of this.sources) {
      if (s.known || s.gone) continue;
      for (const a of this.ants) {
        const r = this.smellOf(a);
        if ((X(a.c) - s.x) ** 2 + (Y(a.c) - s.y) ** 2 <= r * r) { s.known = true; s.foundAt = t; this.event('found', { src: s, ant: a }); break; }
      }
    }
    for (const a of this.ants) {
      const r = this.smellOf(a) * .8, bx0 = Math.max(0, (X(a.c) - r) >> 3), bx1 = Math.min((W >> 3) - 1, (X(a.c) + r) >> 3);
      const by0 = Math.max(0, (Y(a.c) - r) >> 3), by1 = Math.min((H >> 3) - 1, (Y(a.c) + r) >> 3);
      for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
        if ((bx * 8 + 4 - X(a.c)) ** 2 + (by * 8 + 4 - Y(a.c)) ** 2 <= r * r) this.explored[by * (W >> 3) + bx] = 1;
      }
    }
    // Which food can be walked to from the pantry.
    const home = this.field('home');
    for (const s of this.sources) {
      if (s.gone) { s.reach = false; continue; }
      const was = s.reach;
      s.reach = !!home && s.cells.some(i => home.dist[i] < INF);
      if (s.reach && !was && s.known) this.event('reached', { src: s });
    }
    this.refreshSurface();
    // Digging to do.
    this.projects = this.projects.filter(p => !p.done);
    const want = (kind, extra) => this.projects.find(p => p.kind === kind && (!extra || extra(p)));
    for (const p of this.projects) if (p.kind === 'reach') { const s = this.sources.find(q => q.id === p.src); if (!s || s.reach || s.gone) this.finish(p); }
    const unreached = this.sources.filter(s => s.known && !s.reach && !s.gone && !(s.stuckUntil > t));
    if (unreached.length) {
      // nearest first, as the crow flies from the pantry; two at a time
      const hr = this.homeRooms()[0];
      const hx = hr ? hr.cx : W / 2, hy = hr ? hr.cy : H / 2;
      unreached.sort((p, q) => Math.hypot(p.x - hx, p.y - hy) - Math.hypot(q.x - hx, q.y - hy));
      for (const s of unreached) {
        if (this.projects.filter(p => p.kind === 'reach' && !p.done).length >= 2) break;
        if (!want('reach', p => p.src === s.id && !p.done)) this.addProject({ kind: 'reach', src: s.id, prio: 5, crust: !!s.surface, targets: () => s.cells.filter(i => this.mat[i] === AIR && this.walk[i]) });
      }
    }
    const surfaceLinked = this.entrances.length > 0;
    const groups = this.entrances.filter((x, k) => k === 0 || x - this.entrances[k - 1] > 2).length;
    if (!surfaceLinked && !want('entrance') && (this.stats.gathered > 0 || t - this.colony.founded > 90)) {
      this.addProject({ kind: 'entrance', prio: 4, crust: true, targets: () => { const out = []; for (let x = 1; x < W - 1; x++) { const i = (this.surf[x] - 1) * W + x; if (this.surf[x] >= 1 && this.walk[i]) out.push(i); } return out; } });
    }
    for (const p of this.projects) if (p.kind === 'entrance' && surfaceLinked && (p.prio > 2 || groups >= 2)) this.finish(p);
    for (const p of this.projects) if (p.kind === 'order') {
      if (p.cells.every(i => !diggable(this.mat[i])) && home && p.cells.some(i => home.dist[i] < INF)) this.finish(p);
    }
    // Rooms: a bigger pantry as food piles up, a nursery for the queen, a midden for the dead, rooms to rest in.
    for (const r of this.rooms) if (!r.dug && this.undug(r) <= Math.max(1, r.cells.length * .04)) { r.dug = true; this.event('room', { room: r }); }
    for (const p of this.projects) if (p.kind === 'room') { const r = this.rooms.find(q => q.id === p.room); if (!r || r.dug) this.finish(p); }
    for (const r of this.rooms) if (!r.dug && !want('room', p => p.room === r.id && !p.done)) this.addProject({ kind: 'room', room: r.id, prio: ROOM_PRIO[r.type] });
    // The queen's nursery and a midden for the dead come first; other rooms a few at a time, more with more diggers.
    const openRooms = this.projects.filter(p => p.kind === 'room' && !p.done).length;
    if (this.count('queen') && !this.room('nursery')) this.planRoom('nursery');
    else if (this.items.some(i => i.kind === 'corpse') && !this.room('midden')) this.planRoom('midden');
    else if (openRooms < 1 + Math.floor(this.count('digger') / 3)) {
      const pantries = this.homeRooms(), last = pantries[pantries.length - 1];
      if (last && last.dug && this.food > this.pantryCap() * .75) {
        // Grow the newest pantry sideways (and a little up) until it's big, then start another.
        const roof = this.surf[Math.round(last.cx)] + 4;
        if (last.rx < 10.5) {
          last.rx += 1.5;
          if (last.cy - (last.ry + .4) > roof) last.ry = Math.min(4.2, last.ry + .4);
          this.markRooms(); last.dug = false;
          this.fields.get('room:' + last.id).force = true; this.fields.get('home').force = true;
          this.addProject({ kind: 'room', room: last.id, prio: ROOM_PRIO.pantry });
        } else this.planRoom('pantry');
      } else if (this.ants.length >= 10 && this.roomsOf('rest').length < Math.min(4, Math.floor(this.ants.length / 12))) this.planRoom('rest');
    }
    // A second way in once the colony is busy, well away from the first.
    if (groups === 1 && this.ants.length >= 16 && !want('entrance', p => !p.done)) {
      const e0 = this.entrances;
      this.addProject({ kind: 'entrance', prio: 2, crust: true, targets: () => { const out = []; for (let x = 4; x < W - 4; x++) { if (e0.some(e => Math.abs(e - x) < 40)) continue; const i = (this.surf[x] - 1) * W + x; if (this.walk[i]) out.push(i); } return out; } });
    }
    // The queen eats straight from the pantry (her workers bring it), and lays when there's plenty.
    const q = this.ants.find(a => a.type === 'queen');
    if (q) {
      if (q.energy < HUNGRY && this.food >= 1 && this.connected(q)) { this.food--; q.energy = 1; this.stats.eaten++; this.stats.used++; }
      const nursery = this.room('nursery');
      const settled = nursery?.dug && this.roomOf[q.c] === nursery.id;
      q.lay = (q.lay || 0) + 1;
      const spare = this.food - (BROOD.reserve + BROOD.perAnt * this.ants.length);
      const room = this.ants.length + this.brood.length < Math.min(MAX_ANTS, this.supply().ants + 2);
      if (settled && this.layOn && room && q.energy > HUNGRY && spare >= BROOD.cost && this.brood.length < BROOD.max && q.lay >= BROOD.every) {
        q.lay = 0; this.food -= BROOD.cost; this.stats.used += BROOD.cost;
        const floor = nursery.cells.filter(i => this.mat[i] === AIR && this.mat[i + W] !== AIR);
        const c = floor.length ? floor[Math.floor(this.rand() * floor.length)] : q.c;
        this.brood.push({ id: this.nextId++, stage: 0, t: 0, c });
        this.event('egg');
      }
    }
    // Brood grows up; nurses in the nursery speed it along.
    if (this.brood.length) {
      const nursery = this.room('nursery');
      const tending = this.ants.filter(a => a.type === 'nurse' && a.job === 'tend' && nursery && this.roomOf[a.c] === nursery.id).length;
      const pace = 1 + Math.min(1, tending * .5);
      for (const b of [...this.brood]) {
        b.t += pace;
        if (b.t >= BROOD.stages[b.stage]) {
          b.t = 0; b.stage++;
          if (b.stage >= BROOD.stages.length) {
            this.brood.splice(this.brood.indexOf(b), 1);
            const c = this.walk[b.c] ? b.c : this.nearestWalkable(b.c);
            if (c >= 0) { const a = this.spawn('worker', c); this.stats.born++; this.event('hatched', { ant: a }); }
          }
        }
      }
    }
    // Food that ran out a while ago is forgotten (nothing's walking to it any more).
    if (this.sources.some(s => s.gone && t - (s.goneAt ?? t) > 60)) this.sources = this.sources.filter(s => !s.gone || t - (s.goneAt ?? t) <= 60);
    // The dead: carried to the midden, where they crumble away after a while.
    this.items = this.items.filter(i => !(i.kind === 'corpse' && i.placed && t - i.t > 600));
    // Rolling tally for the rates on screen.
    this.ledger.push([t, this.stats.gathered, this.stats.eaten, this.stats.used]);
    if (this.ledger.length > 181) this.ledger.shift();
  }
  addProject(o) {
    const p = { id: this.projSerial++, workers: new Set(), done: false, fails: 0, ...o };
    p.key = 'dig:' + p.id;
    if (p.kind === 'room') { const r = this.rooms.find(q => q.id === p.room); this.defField(p.key, 'dig', () => r ? r.cells.filter(i => this.mat[i] !== ROCK && this.mat[i] !== THING && this.mat[i] !== ROOT) : []); }
    else this.defField(p.key, 'dig', p.targets, !!p.crust);
    this.projects.push(p);
    return p;
  }
  finish(p) { p.done = true; this.dropField(p.key); }
  // The digging job an ant should take. Diggers go two to a tunnel and three to a room; other ants only lend a hand
  // where no digger is working (three of them when food is short and the dig is for food).
  bestProject(a, helping, lean = false, rich = false) {
    let best = null, bs = -Infinity;
    for (const p of this.projects) {
      if (p.done) continue;
      const cap = helping ? (lean && p.kind === 'reach' ? 3 : rich ? 2 : 1) : p.kind === 'room' ? 3 : 2;
      if (p.workers.size >= cap && !p.workers.has(a.id)) continue;
      if (helping && [...p.workers].some(id => this.ants.find(b => b.id === id)?.type === 'digger')) continue;
      const f = this.field(p.key);
      if (!f) continue;
      const d = Math.min(f.dist[a.c], this.nbDist(a.c, f.dist));
      if (d >= INF) continue;
      const score = p.prio * 60 - d / 8 - p.workers.size * 90 + this.rand() * 10;
      if (score > bs) { bs = score; best = p; }
    }
    return best;
  }
  // Somewhere for a new room of this kind: near the tunnels, in diggable dirt, clear of other rooms and food, and
  // where that kind likes to be (nurseries deep, middens off to one side, pantries handy).
  planRoom(type) {
    const size = { pantry: [5, 2.6], nursery: [6, 3], midden: [4.5, 2.4], rest: [5.5, 2.6] }[type];
    const home = this.field('home');
    const net = [];
    if (home) for (let i = 0; i < N; i += 3) if (home.dist[i] < INF && !this.isSky(i)) net.push(i);
    if (!net.length) return null;
    const pantry = this.homeRooms()[0], nursery = this.room('nursery'), midden = this.room('midden');
    let best = null, bs = -Infinity;
    for (let t = 0; t < 70; t++) {
      const from = net[Math.floor(this.rand() * net.length)], ang = this.rand() * Math.PI * 2, reach = 6 + this.rand() * 10;
      const cx = X(from) + Math.cos(ang) * reach, cy = Y(from) + Math.sin(ang) * reach * .7;
      const [rx, ry] = size;
      if (cx - rx < 3 || cx + rx > W - 4 || cy + ry > H - 4) continue;
      const trial = { cx, cy, rx, ry };
      const cells = this.roomCells(trial);
      let bad = 0, open = 0, clash = false;
      for (const i of cells) {
        const m = this.mat[i];
        if (this.roomOf[i]) { clash = true; break; }
        if (this.isSky(i) || Y(i) < this.surf[X(i)] + 5) { clash = true; break; }
        if (m === ROCK || m === THING || m === ROOT) bad++;
        if (m === AIR) open++;
      }
      if (clash || bad > cells.length * .15 || open > cells.length * .3) continue;
      if (this.rooms.some(r => Math.abs(r.cx - cx) < r.rx + rx + 3 && Math.abs(r.cy - cy) < r.ry + ry + 3)) continue;
      if (this.sources.some(s => !s.surface && Math.abs(s.x - cx) < rx + 6 && Math.abs(s.y - cy) < ry + 5)) continue;
      const depth = cy - this.surf[Math.round(cx)];
      let score = -reach;
      const fromPantry = pantry ? Math.hypot(pantry.cx - cx, (pantry.cy - cy) * 1.5) : 0;
      if (type === 'nursery') score += Math.min(depth, 40) * .5 - fromPantry * .35;
      if (type === 'midden') score += (pantry ? Math.hypot(pantry.cx - cx, pantry.cy - cy) * .4 : 0) + (nursery ? Math.hypot(nursery.cx - cx, nursery.cy - cy) * .4 : 0);
      if (type === 'pantry' || type === 'rest') score -= pantry ? Math.hypot(pantry.cx - cx, pantry.cy - cy) * .3 : 0;
      if (nursery && type !== 'nursery') score -= Math.max(0, 25 - Math.hypot(nursery.cx - cx, nursery.cy - cy)) * .5;
      score += this.rand() * 4;
      if (score > bs) { bs = score; best = trial; }
    }
    if (!best) return null;
    const r = this.addRoom(type, best.cx, best.cy, best.rx, best.ry);
    this.addProject({ kind: 'room', room: r.id, prio: ROOM_PRIO[type] });
    return r;
  }
  unexploredTarget(a) {
    const bw = W >> 3;
    let best = -1, bd = Infinity;
    for (let b = 0; b < this.explored.length; b++) {
      if (this.explored[b]) continue;
      const bx = (b % bw) * 8 + 4, by = ((b / bw) | 0) * 8 + 4;
      if (by < this.surf[bx] + 3) { this.explored[b] = 1; continue; }
      const d = (bx - X(a.c)) ** 2 + (by - Y(a.c)) ** 2 + this.rand() * 400;
      if (d < bd) { bd = d; best = b; }
    }
    if (best < 0) return -1;
    const bx = (best % bw) * 8 + 4, by = ((best / bw) | 0) * 8 + 4, c = by * W + bx;
    if (diggable(this.mat[c]) || this.walk[c]) return c;
    for (let r = 1; r < 4; r++) for (let k = 0; k < 8; k++) { const x = bx + DX[k] * r, y = by + DY[k] * r; if (x > 0 && y > 0 && x < W - 1 && y < H - 1 && diggable(this.mat[y * W + x])) return y * W + x; }
    this.explored[best] = 1;
    return -1;
  }
  blockOf(c) { return (Y(c) >> 3) * (W >> 3) + (X(c) >> 3); }
  // Somewhere for an idle digger to push a new gallery: dirt well away from any tunnel, but not too far to walk to.
  galleryTarget(a) {
    const home = this.field('home');
    if (!home || this.ants.length < 10 || this.t < (this.nextGallery || 0) || this.stats.dug > this.dirtCells * .16) return -1;
    if (this.ants.some(b => b.job === 'gallery')) return -1;
    let best = -1, bs = -Infinity;
    for (let t = 0; t < 40; t++) {
      const x = 4 + Math.floor(this.rand() * (W - 8)), y = this.surf[x] + 8 + Math.floor(this.rand() * (H - this.surf[x] - 12));
      const i = y * W + x;
      if (!diggable(this.mat[i]) || this.roomOf[i]) continue;
      let near = 99;
      for (let r = 2; r < 24 && near === 99; r += 2) for (let k = 0; k < 8; k++) { const j = (y + DY[k] * r) * W + x + DX[k] * r; if (j >= 0 && j < N && home.dist[j] < INF) { near = r; break; } }
      const score = Math.min(near, 16) - Math.abs(near - 14) * .5 + this.rand() * 3;
      if (near >= 10 && near < 99 && score > bs) { bs = score; best = i; }
    }
    if (best >= 0) this.nextGallery = this.t + 90;
    return best;
  }

  /* ---------- time ---------- */
  step(dt) {
    this.t += dt;
    for (const s of this.sources) {
      if (!s.infinite || s.gone) continue;
      s.timer += dt * (s.kind === 'aphids' ? 1 + .3 * this.lvl('ranch') : 1);
      while (s.timer >= s.period) {
        s.timer -= s.period;
        if (s.stock < s.cap) { s.stock++; if (s.kind === 'drip') this.effect({ kind: 'drip', x: s.x }); }
      }
    }
    this.auraClock += dt;
    if (this.auraClock >= .5) {
      this.auraClock = 0;
      const offs = this.ants.filter(a => a.type === 'officer');
      for (const a of this.ants) a.aura = offs.some(o => o !== a && this.dist2(o.c, a.c) <= OFFICER.r * OFFICER.r);
    }
    const ants = [...this.ants];
    for (const a of ants) if (this.ants.includes(a)) this.tickAnt(a, dt);
    if (this.colony) {
      this.clock += dt;
      while (this.clock >= 1) { this.clock -= 1; this.plan(); }
    }
  }

  /* ---------- what the player does ---------- */
  // Where an ant (or aphids) would land if dropped at cell (x, y): { ok, c (the cell), pocket (dirt to carve) } or
  // { ok: false, why }.
  landing(x, y) {
    x = Math.max(1, Math.min(W - 2, Math.round(x))); y = Math.max(0, Math.min(H - 2, Math.round(y)));
    const i = y * W + x, m = this.mat[i];
    if (m === ROCK) return { ok: false, why: 'That’s solid rock.' };
    if (m === THING || m === ROOT) return { ok: false, why: 'Something’s in the way there.' };
    if (m === AIR) {
      if (this.walk[i]) return { ok: true, c: i, sky: this.isSky(i) };
      if (this.isSky(i)) { const j = (this.surf[x] - 1) * W + x; if (this.walk[j]) return { ok: true, c: j, sky: true }; }
      const j = this.nearestWalkable(i, 5);
      return j >= 0 ? { ok: true, c: j, sky: this.isSky(j) } : { ok: false, why: 'Nowhere to stand there.' };
    }
    if (y < this.surf[x] + 2) { const j = (this.surf[x] - 1) * W + x; if (this.walk[j]) return { ok: true, c: j, sky: true }; }
    return { ok: true, c: i, pocket: true };
  }
  carve(cx, cy, rx, ry) {
    const cells = [];
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry * .55); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      const i = y * W + x;
      if (((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 > 1 || y > cy + ry * .55) continue;
      if (diggable(this.mat[i])) { this.setCell(i, AIR); cells.push(i); }
    }
    return cells;
  }
  canBuy(type) {
    const d = ANTS[type];
    if (!d) return { ok: false, why: 'No such ant.' };
    const first = !this.colony;
    if (first && type !== 'worker') return { ok: false, why: 'Start with a worker.' };
    if (d.max && this.count(type) >= d.max) return { ok: false, why: `You already have a ${d.name.toLowerCase()}.` };
    if (d.needs && !this.count(d.needs)) return { ok: false, why: `Needs a ${ANTS[d.needs].name.toLowerCase()} first.` };
    if (this.ants.length >= MAX_ANTS) return { ok: false, why: 'The farm is as full as it can get.' };
    if (!first && this.food < d.cost) return { ok: false, why: `Needs ${d.cost} food.` };
    return { ok: true, cost: first ? 0 : d.cost };
  }
  placeAnt(type, x, y) {
    const can = this.canBuy(type);
    if (!can.ok) return can;
    const land = this.landing(x, y);
    if (!land.ok) return land;
    let c = land.c, pocket = null;
    const founding = !this.colony;
    if (land.pocket) {
      const cx = X(c) + .5, cy = Y(c) + .5;
      pocket = founding ? { cx, cy, rx: 3.2, ry: 2.2 } : { cx, cy, rx: 2.2, ry: 1.7 };
      this.carve(pocket.cx, pocket.cy, pocket.rx, pocket.ry);
      c = this.nearestWalkable(c, 4);
      if (c < 0) return { ok: false, why: 'Nowhere to stand there.' };
      const floor = this.floorBelow(c);
      if (floor >= 0) c = floor;
    }
    if (founding) {
      // The first ant's pocket is the colony's nest and pantry. Dropped on top, it gets a nest just under its feet.
      if (!pocket) {
        const nx = X(c), ny = this.surf[nx] + 7;
        pocket = { cx: nx + .5, cy: ny + .5, rx: 3.2, ry: 2.2 };
        this.carve(pocket.cx, pocket.cy, pocket.rx, pocket.ry);
      }
      const r = this.addRoom('pantry', pocket.cx, pocket.cy, pocket.rx, pocket.ry, true);
      r.nest = true;
      this.colony = { home: r.id, founded: this.t };
      this.defField('home', 'walk', () => { const out = []; for (const q of this.homeRooms()) for (const i of q.cells) if (this.walk[i]) out.push(i); return out; });
      this.defField('dump', 'walk', () => this.dumpCells);
      for (const s of this.sources) { if (s.kind === 'drip') { s.surface = true; s.known = true; } this.sourceField(s); s.reserved = 0; }
      // It knows where the nearest food is from the start, so it can get straight to work.
      let near = null, nd = Infinity;
      for (const s of this.sources) { const d = Math.hypot(s.x - X(c), s.y - Y(c)); if (d < nd) { nd = d; near = s; } }
      if (near && !near.known) { near.known = true; near.foundAt = this.t; }
      this.food = START_FOOD;
    } else { this.food -= can.cost; this.stats.spent += can.cost; this.stats.bought++; }
    const a = this.spawn(type, c);
    this.event('placed', { ant: a, first: founding });
    if (founding) { this.refreshSurface(); this.plan(); }
    return { ok: true, ant: a };
  }
  floorBelow(c) {
    let i = c;
    for (let k = 0; k < 6 && Y(i) < H - 1 && this.mat[i + W] === AIR; k++) i += W;
    return this.walk[i] ? i : c;
  }
  itemCost(kind) { return kind === 'aphids' ? aphidCost(this.sources.filter(s => s.bought).length) : ITEMS[kind]?.cost ?? 0; }
  canPlaceItem(kind) {
    const d = ITEMS[kind];
    if (!d) return { ok: false, why: 'No such thing.' };
    if (!this.colony) return { ok: false, why: 'Put in an ant first.' };
    if (kind === 'feed' && this.t < this.feedAt) return { ok: false, why: `Ready in ${Math.ceil(this.feedAt - this.t)}s.` };
    const cost = this.itemCost(kind);
    if (cost > this.food) return { ok: false, why: `Needs ${cost} food.` };
    return { ok: true, cost };
  }
  placeItem(kind, x, y) {
    const can = this.canPlaceItem(kind);
    if (!can.ok) return can;
    if (kind === 'feed') {
      const cx = Math.max(3, Math.min(W - 4, Math.round(x)));
      const s = this.addSource({ kind: 'crumbs', x: cx, y: this.surf[cx] - 1, cells: [], stock: ITEMS.feed.amount, total: ITEMS.feed.amount, infinite: false, surface: true });
      this.surfaceAccess(s);
      this.feedAt = this.t + ITEMS.feed.cooldown;
      this.effect({ kind: 'crumbs', x: cx });
      this.event('fed', { src: s });
      return { ok: true, src: s };
    }
    if (kind === 'aphids') {
      const land = this.landing(x, y);
      if (!land.ok) return land;
      if (land.sky) return { ok: false, why: 'Aphids live on roots underground. Put them in the dirt.' };
      const c = land.c, cx = X(c), cy = Y(c);
      if (this.sources.some(s => !s.gone && !s.surface && Math.hypot(s.x - cx, s.y - cy) < 9)) return { ok: false, why: 'Too close to other food.' };
      if (this.roomOf[c]) return { ok: false, why: 'Not inside a room. Try the dirt nearby.' };
      const cells = this.carve(cx + .5, cy + .5, 3.2, 2.1);
      // a stub of root for them to cling to, down one side
      for (let k = -3; k <= 3; k++) { const i = (cy + k) * W + cx - 3; if (cy + k > 0 && cy + k < H - 1 && diggable(this.mat[i])) this.setCell(i, ROOT, 1 + (k & 1)); }
      const s = this.addSource({ kind: 'aphids', x: cx, y: cy, cells: cells.filter(i => this.mat[i] === AIR), stock: 1, cap: SOURCES.aphids.cap, period: SOURCES.aphids.period, infinite: true, root: [cx - 3, cy], bought: true });
      this.food -= can.cost; this.stats.spent += can.cost;
      this.event('aphids', { src: s });
      return { ok: true, src: s };
    }
    return { ok: false, why: 'Can’t place that.' };
  }
  buyUpgrade(id) {
    const u = UPGRADE_BY_ID[id];
    if (!u) return { ok: false, why: 'No such upgrade.' };
    const l = this.lvl(id);
    if (l >= MAX_LEVEL) return { ok: false, why: 'Already as good as it gets.' };
    if (!this.colony) return { ok: false, why: 'Put in an ant first.' };
    const cost = u.costs[l];
    if (this.food < cost) return { ok: false, why: `Needs ${cost} food.` };
    this.food -= cost; this.stats.spent += cost;
    this.upgrades[id] = l + 1;
    this.event('upgrade', { id, level: l + 1 });
    return { ok: true };
  }
  // An officer's order: dig a tunnel to here.
  order(x, y) {
    if (!this.count('officer')) return { ok: false, why: 'Orders need an officer.' };
    x = Math.round(x); y = Math.round(y);
    if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return { ok: false, why: 'Too close to the glass.' };
    const i = y * W + x;
    if (!diggable(this.mat[i]) && this.mat[i] !== AIR) return { ok: false, why: 'Can’t dig through that.' };
    if (this.isSky(i)) return { ok: false, why: 'That’s above ground.' };
    const cells = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = (y + dy) * W + x + dx; if (diggable(this.mat[j]) || this.mat[j] === AIR) cells.push(j); }
    if (!cells.some(j => diggable(this.mat[j]))) return { ok: false, why: 'That’s dug already.' };
    const old = this.projects.filter(p => p.kind === 'order');
    if (old.length >= 3) this.finish(old[0]);
    const p = this.addProject({ kind: 'order', prio: 7, cells, at: i, targets: () => cells.filter(j => diggable(this.mat[j])) });
    this.event('order', { at: i });
    return { ok: true, project: p };
  }

  /* ---------- for the page ---------- */
  // Crumbs a minute over the last two minutes: brought home, eaten anywhere, and taken out of the pantry (eaten there,
  // or laid as eggs). income − used is how the pantry is doing, before anything you buy.
  rates() {
    const L = this.ledger;
    if (L.length < 2) return { income: 0, eating: 0, used: 0 };
    const a = L[Math.max(0, L.length - 121)], b = L[L.length - 1], dt = Math.max(1, b[0] - a[0]);
    return { income: (b[1] - a[1]) * 60 / dt, eating: (b[2] - a[2]) * 60 / dt, used: ((b[3] ?? 0) - (a[3] ?? 0)) * 60 / dt };
  }
  // Crumbs a minute the never-ending food makes, and roughly how many ants that keeps fed.
  supply() {
    let perMin = 0;
    for (const s of this.sources) if (s.infinite && !s.gone && s.known) perMin += 60 / s.period * (s.kind === 'aphids' ? 1 + .3 * this.lvl('ranch') : 1);
    const perAnt = 60 / (this.hungerOf({ type: 'worker' }) * (1 - HUNGRY));
    return { perMin, ants: Math.floor(perMin / perAnt), perAnt };
  }

  /* ---------- saving ---------- */
  toJSON() {
    const antOut = a => ({ id: a.id, type: a.type, name: a.name, c: a.c, z: +a.z.toFixed(2), energy: +a.energy.toFixed(3), starve: +a.starve.toFixed(1), spoil: a.spoil, spoilMat: a.spoilMat,
      carry: a.carry && a.carry.kind !== 'spoil' ? a.carry : null, age: Math.round(a.age), born: Math.round(a.born), lay: a.lay || 0 });
    return {
      v: 1, seed: this.seed, t: +this.t.toFixed(2), nextId: this.nextId, food: this.food, feedAt: this.feedAt, layOn: this.layOn,
      upgrades: this.upgrades, stats: this.stats, colony: this.colony, surf: Array.from(this.surf),
      mat: rle(this.mat), aux: b64(this.aux), explored: b64(this.explored),
      sources: this.sources.map(s => ({ ...s, reserved: 0, cells: s.surface ? [] : s.cells })),
      rooms: this.rooms.map(r => ({ id: r.id, type: r.type, cx: r.cx, cy: r.cy, rx: r.rx, ry: r.ry, dug: r.dug, nest: !!r.nest })),
      orders: this.projects.filter(p => p.kind === 'order' && !p.done).map(p => ({ at: p.at, cells: p.cells })),
      ants: this.ants.map(antOut), items: this.items.map(i => ({ ...i, claimed: 0 })), brood: this.brood,
      ledger: this.ledger.slice(-121),
    };
  }
  load(s) {
    if (!s || s.v !== 1 || !Number.isFinite(s.seed)) throw new Error('Not an ant farm save.');
    this.t = +s.t || 0; this.nextId = s.nextId || 100; this.food = Math.max(0, +s.food || 0); this.feedAt = +s.feedAt || 0; this.layOn = s.layOn !== false;
    this.upgrades = { ...(s.upgrades || {}) }; this.stats = { ...this.stats, ...(s.stats || {}) }; this.colony = s.colony || null;
    if (Array.isArray(s.surf) && s.surf.length === W) this.surf = Int16Array.from(s.surf);
    this.mat = unrle(s.mat, N);
    const aux = unb64(s.aux); if (aux.length === N) this.aux = aux;
    const ex = unb64(s.explored || ''); if (ex.length === this.explored.length) this.explored = ex;
    this.sources = (s.sources || []).map(o => ({ ...o, reserved: 0 }));
    this.rooms = (s.rooms || []).map(r => ({ ...r, cells: [] }));
    this.items = s.items || []; this.brood = s.brood || []; this.ledger = s.ledger || [];
    this.ants = [];
    for (const o of s.ants || []) {
      if (!ANTS[o.type] || !(o.c >= 0 && o.c < N)) continue;
      const a = this.spawn(o.type, o.c, { name: o.name, energy: o.energy });
      Object.assign(a, { id: o.id, z: o.z ?? a.z, starve: o.starve || 0, spoil: o.spoil || 0, spoilMat: o.spoilMat || 2, carry: o.carry || null, age: o.age || 0, born: o.born ?? 0, lay: o.lay || 0 });
    }
    this.pendingOrders = s.orders || [];
    this.afterLoad = true;
  }
}

// Called once the grid is ready after loading: the maps the colony needs, and any orders still open.
Farm.prototype.resume = function () {
  if (!this.colony) return;
  this.defField('home', 'walk', () => { const out = []; for (const q of this.homeRooms()) for (const i of q.cells) if (this.walk[i]) out.push(i); return out; });
  this.defField('dump', 'walk', () => this.dumpCells);
  for (const r of this.rooms) this.defField('room:' + r.id, 'walk', () => r.cells.filter(i => this.walk[i]));
  for (const s of this.sources) if (!s.gone) this.sourceField(s);
  for (const o of this.pendingOrders || []) this.addProject({ kind: 'order', prio: 7, cells: o.cells, at: o.at, targets: () => o.cells.filter(j => diggable(this.mat[j])) });
  this.pendingOrders = null;
  this.refreshSurface();
  this.plan();
};
