// Reef: the rules. No DOM in here, so sim.mjs can play it in Node.
//
// The sea floor is a patch of pointy-top hexes in axial coordinates (q, r).
// The current always runs from west to east (−q to +q). Every piece's value is
// worked out from the board as it stands, so a placement scores whatever it
// changes the whole reef by, including what it does to its neighbours.

export const COLS = 12, ROWS = 9;
// E, NE, NW, W, SW, SE
export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const WEST = [-1, 0];

export const KINDS = {
  brain: { name: 'Brain coral', coral: true, rule: '+2, and +1 for each coral beside it.' },
  stag: { name: 'Staghorn', coral: true, rule: '+1, or +4 on rubble. +1 for each staghorn beside it.' },
  fan: { name: 'Sea fan', coral: true, rule: '+1 for each open tile up-current of it, up to 4. Shades its neighbours.' },
  sponge: { name: 'Sponge', rule: '+1 for each piece beside it.' },
  anemone: { name: 'Anemone', rule: '+2 for each brain coral beside it, but −3 for each other anemone.' },
  grass: { name: 'Seagrass', rule: 'Sand only. +1, and +1 for each seagrass beside it, but −1 for each coral.' },
  rock: { name: 'Rock', rule: '+1. Turns the sand around it to rubble, and shades its neighbours.' },
};
export const ORDER = ['brain', 'stag', 'fan', 'sponge', 'anemone', 'grass', 'rock'];

export const SPECIES = [
  { id: 'clown', name: 'Clownfish', bonus: 4, hint: 'Hides in a stinging host that leans on a brain coral.' },
  { id: 'nudi', name: 'Nudibranch', bonus: 3, hint: 'Grazes where a sponge touches an anemone.' },
  { id: 'seahorse', name: 'Seahorse', bonus: 4, hint: 'Curls its tail round a sea fan at the edge of the grass.' },
  { id: 'parrot', name: 'Parrotfish', bonus: 5, hint: 'Crunches a clump of three brain corals.' },
  { id: 'damsel', name: 'Damselfish', bonus: 5, hint: 'A shoal needs a thicket of four staghorns, all touching.' },
  { id: 'moray', name: 'Moray eel', bonus: 5, hint: 'Lurks in a rock with two sponges beside it.' },
  { id: 'octopus', name: 'Octopus', bonus: 6, hint: 'Dens in a rock with pieces on four of its sides.' },
  { id: 'turtle', name: 'Green turtle', bonus: 6, hint: 'Grazes a meadow of six seagrasses, all touching.' },
  { id: 'manta', name: 'Manta ray', bonus: 8, hint: 'Comes to three sea fans that each see three open tiles up-current.' },
  { id: 'shark', name: 'Reef shark', bonus: 10, hint: 'Arrives once seven others have made the reef their home.' },
];
export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map(s => [s.id, s]));

export const START_HAND = { brain: 2, anemone: 1, grass: 3, sponge: 1 };

const PACKS = [
  { name: 'Reef builders', items: { brain: 2, stag: 2, sponge: 1 } },
  { name: 'Rubble field', items: { rock: 1, stag: 3, sponge: 1 } },
  { name: 'Meadow', items: { grass: 4, fan: 1 } },
  { name: 'Garden', items: { anemone: 2, sponge: 2, brain: 1 } },
  { name: 'Open water', items: { fan: 3, grass: 2 } },
  { name: 'Boulders', items: { rock: 2, sponge: 2, anemone: 1 } },
  { name: 'Thicket', items: { stag: 3, brain: 2 } },
  { name: 'Shallows', items: { grass: 3, anemone: 1, brain: 1 } },
];
// what each pack number may contain: staghorn and rock from the first new pack, fans from the second
const UNLOCK = [['brain', 'sponge', 'anemone', 'grass'], ['stag', 'rock'], ['fan']];

// warm water: the first spell after this many placements, then every WARM_EVERY
export const WARM_FIRST = 28, WARM_EVERY = 13, WARM_WARN = 4;

export function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const key = (q, r) => q + ',' + r;

// smooth value noise on a coarse lattice, for the patch outline and the rubble
function noise2(rng, cells) {
  const g = [];
  for (let i = 0; i < (cells + 2) * (cells + 2); i++) g.push(rng());
  return (x, y) => {
    x = Math.max(0, x) * cells; y = Math.max(0, y) * cells;
    const xi = Math.min(cells, Math.floor(x)), yi = Math.min(cells, Math.floor(y));
    const fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const at = (i, j) => g[j * (cells + 2) + i];
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return a + (b - a) * sy;
  };
}

export function newGame(seed = (Math.random() * 2 ** 31) | 0) {
  const rng = rngOf(seed);
  const shape = noise2(rng, 4), rub = noise2(rng, 3);
  const tiles = new Map();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      // the patch: an ellipse with a wobbly edge
      const u = (col + 0.5 * (row & 1) + 0.5) / (COLS + 0.5), v = (row + 0.5) / ROWS;
      const d = Math.hypot((u - 0.5) / 0.5, (v - 0.5) / 0.5);
      if (d + (shape(u, v) - 0.5) * 0.55 > 1.02) continue;
      const q = col - (row - (row & 1)) / 2, r = row;
      tiles.set(key(q, r), { q, r, key: key(q, r), col, row, rubble: rub(u, v) > 0.6, dead: false, piece: null, pid: 0 });
    }
  }
  const g = {
    seed, rng, tiles,
    hand: { ...START_HAND },
    value: 0, bonus: 0, score: 0,
    species: {}, // id -> { anchor: tile key, at: placement number }
    packN: 0, threshold: thresholdFor(0), prevThreshold: 0,
    placed: 0, nextWarm: WARM_FIRST,
    choice: null, over: false, pid: 1,
  };
  return g;
}

export function thresholdFor(n) {
  // 16, 29, 43, 58…: each pack needs a little more than the last
  let t = 16;
  for (let i = 1; i <= n; i++) t += 12 + i;
  return t;
}

export const nbrKeys = (t) => DIRS.map(([dq, dr]) => key(t.q + dq, t.r + dr));
export function neighbours(g, t) {
  const out = [];
  for (const [dq, dr] of DIRS) { const n = g.tiles.get(key(t.q + dq, t.r + dr)); if (n) out.push(n); }
  return out;
}
const isCoral = (p) => p && KINDS[p].coral;

// how many empty tiles a fan sees up-current before something (or the edge) blocks it
export function openUpstream(g, t) {
  let n = 0, q = t.q, r = t.r;
  while (n < 4) {
    q += WEST[0]; r += WEST[1];
    const u = g.tiles.get(key(q, r));
    if (!u || u.piece) break;
    n++;
  }
  return n;
}

export function valueOf(g, t) {
  const p = t.piece;
  if (!p) return 0;
  const ns = neighbours(g, t);
  const count = (f) => ns.reduce((s, n) => s + (f(n.piece) ? 1 : 0), 0);
  switch (p) {
    case 'brain': return 2 + count(isCoral);
    case 'stag': return (t.rubble ? 4 : 1) + count(x => x === 'stag');
    case 'fan': return openUpstream(g, t);
    case 'sponge': return count(x => !!x);
    case 'anemone': return 2 * count(x => x === 'brain') - 3 * count(x => x === 'anemone');
    case 'grass': return 1 + count(x => x === 'grass') - count(isCoral);
    case 'rock': return 1;
  }
  return 0;
}

export function reefValue(g) {
  let s = 0;
  for (const t of g.tiles.values()) s += valueOf(g, t);
  return s;
}

export function canPlace(g, k, kind) {
  const t = g.tiles.get(k);
  if (!t || t.piece || !(g.hand[kind] > 0)) return false;
  if (kind === 'grass' && t.rubble) return false;
  return true;
}

export function legalTiles(g, kind) {
  const out = [];
  for (const t of g.tiles.values()) if (canPlace(g, t.key, kind)) out.push(t);
  return out;
}

// tiles a placement can change: itself, its ring, and (for blocking a fan) the row downstream
function touched(g, t) {
  const set = new Set([t.key, ...nbrKeys(t)]);
  for (let i = 1; i <= 4; i++) set.add(key(t.q + i, t.r));
  return [...set].map(k => g.tiles.get(k)).filter(Boolean);
}

function setPiece(g, t, kind) {
  t.piece = kind;
  if (kind === 'rock') {
    t.rubble = true;
    for (const n of neighbours(g, t)) if (!n.piece) n.rubble = true;
  }
}

// What placing `kind` at `k` would do, without doing it.
export function preview(g, k, kind) {
  const t = g.tiles.get(k);
  const tt = touched(g, t);
  const before = new Map(tt.map(u => [u.key, valueOf(g, u)]));
  const save = { rubble: tt.map(u => u.rubble) };
  t.piece = kind;
  // a rock's rubble only matters to later pieces, but the preview should be honest about that now too
  if (kind === 'rock') { t.rubble = true; for (const n of neighbours(g, t)) if (!n.piece) n.rubble = true; }
  const changes = [];
  let delta = 0, self = 0;
  for (const u of tt) {
    const d = valueOf(g, u) - before.get(u.key);
    if (u === t) self = d;
    else if (d) changes.push({ key: u.key, d });
    delta += d;
  }
  const arrivals = arrivalsFor(g);
  t.piece = null;
  tt.forEach((u, i) => { u.rubble = save.rubble[i]; });
  const bonus = arrivals.reduce((s, a) => s + SPECIES_BY_ID[a.id].bonus, 0);
  return { delta, self, changes, arrivals, bonus };
}

// ---- species

function group(g, start, kind) {
  const seen = new Set([start.key]), stack = [start];
  while (stack.length) {
    const t = stack.pop();
    for (const n of neighbours(g, t)) if (n.piece === kind && !seen.has(n.key)) { seen.add(n.key); stack.push(n); }
  }
  return seen;
}

function speciesCheck(g, id) {
  const all = [...g.tiles.values()];
  const has = (t, kind, n = 1) => neighbours(g, t).filter(u => u.piece === kind).length >= n;
  const bigGroup = (kind, n) => {
    const seen = new Set();
    for (const t of all) {
      if (t.piece !== kind || seen.has(t.key)) continue;
      const grp = group(g, t, kind);
      grp.forEach(k => seen.add(k));
      if (grp.size >= n) return t;
    }
    return null;
  };
  switch (id) {
    case 'clown': return all.find(t => t.piece === 'anemone' && has(t, 'brain'));
    case 'nudi': return all.find(t => t.piece === 'sponge' && has(t, 'anemone'));
    case 'seahorse': return all.find(t => t.piece === 'fan' && has(t, 'grass'));
    case 'parrot': return bigGroup('brain', 3);
    case 'damsel': return bigGroup('stag', 4);
    case 'moray': return all.find(t => t.piece === 'rock' && has(t, 'sponge', 2));
    case 'octopus': return all.find(t => t.piece === 'rock' && neighbours(g, t).filter(u => u.piece).length >= 4);
    case 'turtle': return bigGroup('grass', 6);
    case 'manta': {
      const fans = all.filter(t => t.piece === 'fan' && openUpstream(g, t) >= 3);
      return fans.length >= 3 ? fans[1] : null;
    }
    case 'shark': return Object.keys(g.species).filter(s => s !== 'shark').length >= 7 ? all[(all.length / 2) | 0] : null;
  }
  return null;
}

function arrivalsFor(g) {
  const out = [];
  for (const s of SPECIES) {
    if (g.species[s.id]) continue;
    if (s.id === 'shark') {
      const n = Object.keys(g.species).length + out.length;
      if (n >= 7) out.push({ id: 'shark', anchor: null });
      continue;
    }
    const t = speciesCheck(g, s.id);
    if (t) out.push({ id: s.id, anchor: t.key });
  }
  return out;
}

// ---- warm water

export const shaded = (g, t) => neighbours(g, t).some(n => n.piece === 'rock' || n.piece === 'fan');
export function atRisk(g) {
  return [...g.tiles.values()].filter(t => isCoral(t.piece) && !shaded(g, t));
}
export const warmIn = (g) => g.nextWarm - g.placed;

function recount(g) {
  g.value = reefValue(g);
  g.bonus = Object.keys(g.species).reduce((s, id) => s + SPECIES_BY_ID[id].bonus, 0);
  g.score = g.value + g.bonus;
}

function makePacks(g) {
  const allowed = new Set(UNLOCK.slice(0, Math.min(UNLOCK.length, g.packN + 1)).flat());
  const ok = PACKS.filter(p => Object.keys(p.items).every(k => allowed.has(k)));
  const pool = ok.slice();
  const pick = () => pool.splice(Math.floor(g.rng() * pool.length), 1)[0];
  // the first new pack always offers staghorn and rock, the second sea fans
  const want = g.packN === 1 ? 'stag' : g.packN === 2 ? 'fan' : null;
  let a = pick();
  if (want && !a.items[want]) {
    const w = pool.filter(p => p.items[want]);
    if (w.length) { pool.push(a); a = w[Math.floor(g.rng() * w.length)]; pool.splice(pool.indexOf(a), 1); }
  }
  const b = pick();
  return [a, b].map(p => ({ name: p.name, items: { ...p.items } }));
}

// Plant a piece. Returns what happened, for the view to animate.
export function place(g, k, kind) {
  if (g.over || g.choice || !canPlace(g, k, kind)) return null;
  const t = g.tiles.get(k);
  const pv = preview(g, k, kind);
  const before = g.score;
  setPiece(g, t, kind);
  t.pid = g.pid++;
  g.hand[kind]--;
  g.placed++;
  for (const a of arrivalsFor(g)) g.species[a.id] = { anchor: a.anchor, at: g.placed };
  // shark's anchor is wherever the reef is thickest; others re-find theirs if the piece goes
  const ev = { key: k, kind, delta: pv.delta, changes: pv.changes, arrivals: pv.arrivals.map(a => a.id), bleached: [], newPack: false, over: false };
  if (g.placed >= g.nextWarm) {
    for (const u of atRisk(g)) {
      ev.bleached.push({ key: u.key, kind: u.piece });
      u.deadKind = u.piece; u.piece = null; u.rubble = true; u.dead = true;
    }
    g.nextWarm += WARM_EVERY;
    ev.warm = true;
  }
  recount(g);
  for (const [id, s] of Object.entries(g.species)) {
    const a = s.anchor && g.tiles.get(s.anchor);
    if (id !== 'shark' && (!a || !a.piece)) { const t2 = speciesCheck(g, id); if (t2) s.anchor = t2.key; }
  }
  ev.gained = g.score - before;
  checkProgress(g, ev);
  return ev;
}

function checkProgress(g, ev) {
  if (g.score >= g.threshold) {
    g.packN++;
    g.prevThreshold = g.threshold;
    g.threshold = thresholdFor(g.packN);
    g.choice = makePacks(g);
    ev.newPack = true;
    return;
  }
  const left = ORDER.some(kind => g.hand[kind] > 0 && legalTiles(g, kind).length);
  if (!left) { g.over = true; ev.over = true; }
}

export function choose(g, i) {
  if (!g.choice) return null;
  const p = g.choice[i];
  for (const [kind, n] of Object.entries(p.items)) g.hand[kind] = (g.hand[kind] || 0) + n;
  g.choice = null;
  const ev = { newPack: false, over: false };
  checkProgress(g, ev); // a big placement can be worth two packs; the second waits until now
  return ev;
}

export const handSize = (g) => ORDER.reduce((s, k) => s + (g.hand[k] || 0), 0);

// The bot: plant whatever scores most right now. Used by sim.mjs and ?demo.
export function botMove(g, rng = g.rng, noise = 0) {
  let best = null;
  for (const kind of ORDER) {
    if (!(g.hand[kind] > 0)) continue;
    for (const t of legalTiles(g, kind)) {
      const pv = preview(g, t.key, kind);
      // a little foresight: shade corals when warm water is close
      let v = pv.delta + pv.bonus + rng() * noise;
      if (warmIn(g) <= WARM_WARN && (kind === 'rock' || kind === 'fan')) v += neighbours(g, t).filter(n => isCoral(n.piece) && !shaded(g, n)).length * 2;
      if (!best || v > best.v) best = { v, kind, key: t.key };
    }
  }
  return best;
}
