// Twenty-Seven Rooms: the rules, with no DOM. The vault is a 3×3×3 cube of
// rooms. A turnstone in a room turns the whole layer that room sits in:
//   H  the floor it's on spins flat, like a record (rooms turn with it)
//   X  the north–south slice it's in rolls like a mill wheel; rooms stay level
//   Y  the east–west slice it's in rolls the same way
// Turning only changes how rooms meet. A flat spin is rigid, so it never
// changes doors inside that floor, only which ladders line up with the
// floors above and below. A roll moves rooms between floors.
//
// Coordinates: x east, y south, z up (0 = bottom floor). Sides 0 N, 1 E, 2 S, 3 W.
// Rooms are 9×9 tiles in their own local frame; ori counts clockwise quarter
// turns from that frame to the world.

export const N = 0, E = 1, S = 2, W = 3;
export const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
export const RS = 9;            // room size in tiles
export const MID = 4;           // centre tile (ladders, the treasure)
export const DIAL = [2, 2];     // local tile of a turnstone
export const KEY = [6, 2];      // local tile of a key
export const DOOR_TILE = [[4, 0], [8, 4], [4, 8], [0, 4]];

export const pidx = (x, y, z) => x + y * 3 + z * 9;
export const ppos = (i) => [i % 3, ((i / 3) | 0) % 3, (i / 9) | 0];
export const CENTRE = pidx(1, 1, 1);

// local tile -> world tile for a room turned `o` quarter turns clockwise
export function rotTile(c, r, o) {
  for (let k = 0; k < (o & 3); k++) { const t = c; c = RS - 1 - r; r = t; }
  return [c, r];
}
export function unrotTile(c, r, o) { return rotTile(c, r, (4 - (o & 3)) & 3); }

// ---------------------------------------------------------------- room interiors
// Little floor plans laid over the bare room. 2 = pillar, 3 = pool.
export const DECO = [
  [],
  [[2, 6, 2], [6, 6, 2]],
  [[3, 3, 2], [5, 3, 2], [3, 5, 2], [5, 5, 2]],
  [[5, 5, 3], [6, 5, 3], [5, 6, 3], [6, 6, 3]],
  [[2, 4, 2], [6, 4, 2], [4, 2, 2], [4, 6, 2]],
  [[1, 1, 2], [7, 1, 2], [1, 7, 2], [7, 7, 2], [3, 6, 3], [4, 6, 3], [5, 6, 3]],
  [[2, 5, 3], [2, 6, 3], [3, 6, 3], [6, 5, 2], [5, 3, 2]],
];

// The room's own tile grid in local coords: 0 floor, 1 wall, 2 pillar, 3 pool.
export function roomGrid(room) {
  const g = new Uint8Array(RS * RS);
  for (let r = 0; r < RS; r++) for (let c = 0; c < RS; c++)
    g[r * RS + c] = (c === 0 || r === 0 || c === RS - 1 || r === RS - 1) ? 1 : 0;
  for (let s = 0; s < 4; s++) if (room.doors[s]) { const [c, r] = DOOR_TILE[s]; g[r * RS + c] = 0; }
  const keep = new Set([MID * RS + MID]);
  if (room.dial) keep.add(DIAL[1] * RS + DIAL[0]);
  if (room.key) keep.add(KEY[1] * RS + KEY[0]);
  for (const [c, r, t] of DECO[room.deco || 0]) if (!keep.has(r * RS + c)) g[r * RS + c] = t;
  return g;
}

// ---------------------------------------------------------------- state
export function newState(vault) {
  const rooms = vault.rooms.map((r, i) => ({
    id: i, home: r.home, doors: r.doors.slice(), up: !!r.up, down: !!r.down, dial: r.dial || 0,
    key: !!r.key, lock: r.lock ?? -1, treasure: !!r.treasure, entry: !!r.entry,
    beetles: r.beetles || 0, deco: r.deco || 0, name: r.name || '',
  }));
  for (const rm of rooms) rm.grid = roomGrid(rm);
  const at = new Int8Array(27), pos = new Int8Array(27), ori = new Int8Array(27);
  for (const rm of rooms) { const p = pidx(...rm.home); at[p] = rm.id; pos[rm.id] = p; ori[rm.id] = rm.ori0 || 0; }
  const entry = rooms.find(r => r.entry).id;
  return {
    vault, rooms, at, pos, ori, entry,
    keys: 0, keysTaken: 0, unlocked: 0, treasure: false, turns: 0, won: false,
  };
}

export function cloneArr(st) {
  return { at: st.at.slice(), pos: st.pos.slice(), ori: st.ori.slice(), keys: st.keys, keysTaken: st.keysTaken,
    unlocked: st.unlocked, treasure: st.treasure, turns: st.turns };
}
export function restoreArr(st, s) {
  st.at.set(s.at); st.pos.set(s.pos); st.ori.set(s.ori);
  st.keys = s.keys; st.keysTaken = s.keysTaken; st.unlocked = s.unlocked; st.treasure = s.treasure; st.turns = s.turns;
}

export const worldSide = (st, id, local) => (local + st.ori[id]) & 3;
export const localSide = (st, id, world) => (world - st.ori[id] + 4) & 3;
export const hasDoor = (st, id, world) => !!st.rooms[id].doors[localSide(st, id, world)];
export function isLocked(st, id, world) {
  const rm = st.rooms[id];
  return rm.lock >= 0 && !(st.unlocked >> id & 1) && localSide(st, id, world) === rm.lock;
}

// What lies through the world-side `s` doorway of room `id`?
//   {kind:'open', to}  |  {kind:'wall', to}  (the next room has no door here)
//   {kind:'edge'}      (the outside of the cube)  |  {kind:'locked'}  |  {kind:'none'} (no door on this side)
export function doorway(st, id, s) {
  if (!hasDoor(st, id, s)) return { kind: 'none' };
  const [x, y, z] = ppos(st.pos[id]);
  const nx = x + DX[s], ny = y + DY[s];
  if (isLocked(st, id, s)) return { kind: 'locked' };
  if (nx < 0 || ny < 0 || nx > 2 || ny > 2) return { kind: 'edge' };
  const to = st.at[pidx(nx, ny, z)];
  const back = (s + 2) & 3;
  if (!hasDoor(st, to, back)) return { kind: 'wall', to };
  if (isLocked(st, to, back)) return { kind: 'lockedFar', to };
  return { kind: 'open', to };
}

// Ladders: a room with `up` meets the room above if that one has `down`.
export function ladder(st, id, dir) {
  const rm = st.rooms[id];
  const [x, y, z] = ppos(st.pos[id]);
  if (dir > 0) {
    if (!rm.up) return { kind: 'none' };
    if (z === 2) return rm.entry ? { kind: 'sky' } : { kind: 'edge' };
    const to = st.at[pidx(x, y, z + 1)];
    return st.rooms[to].down ? { kind: 'open', to } : { kind: 'wall', to };
  }
  if (!rm.down) return { kind: 'none' };
  if (z === 0) return { kind: 'edge' };
  const to = st.at[pidx(x, y, z - 1)];
  return st.rooms[to].up ? { kind: 'open', to } : { kind: 'wall', to };
}

// ---------------------------------------------------------------- turning
// Which layer would this room's turnstone turn right now?
export function layerOf(st, id) {
  const t = st.rooms[id].dial; if (!t) return null;
  const [x, y, z] = ppos(st.pos[id]);
  return t === 'H' ? { axis: 'H', k: z } : t === 'X' ? { axis: 'X', k: x } : { axis: 'Y', k: y };
}
export function layerCells(axis, k) {
  const out = [];
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++)
    out.push(axis === 'H' ? pidx(a, b, k) : axis === 'X' ? pidx(k, a, b) : pidx(a, k, b));
  return out;
}
// Where does a cell go? dir +1:
//   H clockwise seen from above (north goes east)
//   X top goes south (rolls toward you)   Y top goes east
export function moveCell(axis, p, dir) {
  let [x, y, z] = ppos(p);
  if (axis === 'H') {
    const dx = x - 1, dy = y - 1;
    if (dir > 0) { x = 1 - dy; y = 1 + dx; } else { x = 1 + dy; y = 1 - dx; }
  } else if (axis === 'X') {
    const dy = y - 1, dz = z - 1;
    if (dir > 0) { y = 1 + dz; z = 1 - dy; } else { y = 1 - dz; z = 1 + dy; }
  } else {
    const dx = x - 1, dz = z - 1;
    if (dir > 0) { x = 1 + dz; z = 1 - dx; } else { x = 1 - dz; z = 1 + dx; }
  }
  return pidx(x, y, z);
}
export function turn(st, axis, k, dir) {
  const cells = layerCells(axis, k);
  const ids = cells.map(p => st.at[p]);
  cells.forEach((p, i) => {
    const id = ids[i], np = moveCell(axis, p, dir);
    st.at[np] = id; st.pos[id] = np;
    if (axis === 'H') st.ori[id] = (st.ori[id] + (dir > 0 ? 1 : 3)) & 3;
  });
  return ids;
}

// ---------------------------------------------------------------- reachability (used by the solver and hints)
// Rooms you can walk to from `id` without turning anything.
export function reach(st, id) {
  const seen = new Set([id]), q = [id];
  while (q.length) {
    const a = q.pop();
    for (let s = 0; s < 4; s++) {
      const d = doorway(st, a, s);
      if (d.kind === 'open' && !seen.has(d.to)) { seen.add(d.to); q.push(d.to); }
    }
    for (const dir of [1, -1]) {
      const l = ladder(st, a, dir);
      if (l.kind === 'open' && !seen.has(l.to)) { seen.add(l.to); q.push(l.to); }
    }
  }
  return seen;
}

// Can someone standing anywhere in `comp` get at room id's locked door?
export function lockReachable(st, id, comp) {
  if (comp.has(id)) return true;
  const s = worldSide(st, id, st.rooms[id].lock);
  const [x, y, z] = ppos(st.pos[id]);
  const nx = x + DX[s], ny = y + DY[s];
  if (nx < 0 || ny < 0 || nx > 2 || ny > 2) return false;
  const nb = st.at[pidx(nx, ny, z)];
  return comp.has(nb) && hasDoor(st, nb, (s + 2) & 3);
}

// ---------------------------------------------------------------- walking inside a room
export function walkable(st, id, c, r, wantUnlock) {
  if (c < 0 || r < 0 || c >= RS || r >= RS) return false;
  const [lc, lr] = unrotTile(c, r, st.ori[id]);
  const t = st.rooms[id].grid[lr * RS + lc];
  if (t !== 0) return false;
  // a locked door tile can't be stood on until it's opened
  const rm = st.rooms[id];
  if (rm.lock >= 0 && !(st.unlocked >> id & 1)) {
    const [dc, dr] = DOOR_TILE[rm.lock];
    if (lc === dc && lr === dr) return !!wantUnlock;
  }
  return true;
}
// the world tile in room `id` that holds a local feature
export const featTile = (st, id, local) => rotTile(local[0], local[1], st.ori[id]);
export const doorTileWorld = (s) => DOOR_TILE[s];
export function sideOfDoorTile(c, r) {
  for (let s = 0; s < 4; s++) if (DOOR_TILE[s][0] === c && DOOR_TILE[s][1] === r) return s;
  return -1;
}

// Path inside the current room (4-way BFS), avoiding `block` tiles. Returns list of [c,r] excluding start.
export function pathTo(st, id, from, to, block) {
  const key = (c, r) => r * RS + c;
  const prev = new Int16Array(RS * RS).fill(-1);
  const start = key(...from), goal = key(...to);
  prev[start] = start;
  const q = [start];
  while (q.length) {
    const k = q.shift();
    if (k === goal) break;
    const c = k % RS, r = (k / RS) | 0;
    for (let s = 0; s < 4; s++) {
      const nc = c + DX[s], nr = r + DY[s], nk = key(nc, nr);
      if (nc < 0 || nr < 0 || nc >= RS || nr >= RS || prev[nk] >= 0) continue;
      if (nk !== goal && (!walkable(st, id, nc, nr) || (block && block.has(nk)))) continue;
      if (nk === goal && !walkable(st, id, nc, nr, true)) continue;
      prev[nk] = k; q.push(nk);
    }
  }
  if (prev[goal] < 0) return null;
  const out = [];
  for (let k = goal; k !== start; k = prev[k]) out.push([k % RS, (k / RS) | 0]);
  return out.reverse();
}
