// Rules of the garden, shared by the page and the generator (gen.mjs).
//
// A room is a lattice of w×h lawn cells; vertices run 0..w × 0..h. A panel is a
// rectangle of that lattice (vertex coords [x0,y0,x1,y1]) with a start vertex and
// an exit vertex on its edge. Symbols belong to the garden, not to panels: a panel
// is judged on every symbol inside its rectangle.
//
// The one rule that makes the garden: hedges count as line. A hedge (old yew, or a
// line you solved earlier) blocks the line, divides regions, covers dots, and
// counts toward a flower's petals, exactly as if you had drawn it yourself.
// The line may touch a hedge, but never run along one or cross through it.

export const key = (x, y) => y * 64 + x;
export const ekey = (x1, y1, x2, y2) => (x1 + y1 < x2 + y2 ? key(x1, y1) * 4096 + key(x2, y2) : key(x2, y2) * 4096 + key(x1, y1));

// edges and vertices of the fixed hedges plus a list of solved paths
export function hedgeSet(room, paths) {
  const edges = new Set(), verts = new Set(), dirs = new Map();
  const mark = (x, y, d) => { const k = key(x, y); dirs.set(k, (dirs.get(k) || 0) | (1 << d)); };
  const addPath = (p) => {
    for (let i = 0; i < p.length; i++) {
      verts.add(key(p[i][0], p[i][1]));
      if (!i) continue;
      const [ax, ay] = p[i - 1], [bx, by] = p[i];
      edges.add(ekey(ax, ay, bx, by));
      const d = dirOf(bx - ax, by - ay);
      mark(ax, ay, d); mark(bx, by, (d + 2) % 4);
    }
  };
  for (const p of room.fixed || []) addPath(p);
  for (const p of paths) addPath(p);
  return { edges, verts, dirs };
}

// 0 n, 1 e, 2 s, 3 w
export const STEP = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const dirOf = (dx, dy) => (dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3);

// Would the line at `path` (last point is the head) be allowed onto (nx,ny)?
export function canStep(panel, H, path, seen, nx, ny) {
  if (!inRect(panel.r, nx, ny) || seen.has(key(nx, ny))) return false;
  const [hx, hy] = path[path.length - 1];
  if (H.edges.has(ekey(hx, hy, nx, ny))) return false;
  // leaving a hedge vertex: the way in and the way out must lie on one side of it
  const m = H.dirs.get(key(hx, hy));
  if (m && path.length > 1) {
    const [px, py] = path[path.length - 2];
    const a = dirOf(px - hx, py - hy), b = dirOf(nx - hx, ny - hy);
    let arc1 = 0, arc2 = 0;
    for (let d = (a + 1) % 4; d !== b; d = (d + 1) % 4) arc1 |= 1 << d;
    for (let d = (b + 1) % 4; d !== a; d = (d + 1) % 4) arc2 |= 1 << d;
    if ((m & arc1) && (m & arc2)) return false;
  }
  return true;
}

export const inRect = (r, x, y) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
export const cellIn = (r, cx, cy) => cx >= r[0] && cx < r[2] && cy >= r[1] && cy < r[3];

// a line can begin only on open ground
export function open(panel, H, x, y) {
  return inRect(panel.r, x, y) && !H.verts.has(key(x, y));
}

// Judge a finished line. Returns { ok, bad: { dots:[i], stones:[i], petals:[i] } }
// with indices into room.dots / room.stones / room.petals.
export function judge(room, panel, path, H) {
  const bad = { dots: [], stones: [], petals: [] };
  const r = panel.r;
  // (the generator judges the same line many times, so its sets ride along on it)
  let lv = path._lv, le = path._le;
  if (!lv) {
    lv = new Set(); le = new Set();
    for (let i = 0; i < path.length; i++) {
      lv.add(key(path[i][0], path[i][1]));
      if (i) le.add(ekey(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]));
    }
    path._lv = lv; path._le = le;
  }
  const vOn = (x, y) => lv.has(key(x, y)) || H.verts.has(key(x, y));
  const eOn = (k) => le.has(k) || H.edges.has(k);

  (room.dots || []).forEach(([x, y], i) => { if (inRect(r, x, y) && !vOn(x, y)) bad.dots.push(i); });

  (room.petals || []).forEach(([cx, cy, n], i) => {
    if (!cellIn(r, cx, cy)) return;
    const c = eOn(ekey(cx, cy, cx + 1, cy)) + eOn(ekey(cx, cy + 1, cx + 1, cy + 1)) + eOn(ekey(cx, cy, cx, cy + 1)) + eOn(ekey(cx + 1, cy, cx + 1, cy + 1));
    if (c !== n) bad.petals.push(i);
  });

  const stones = room.stones || [];
  if (stones.some(([cx, cy]) => cellIn(r, cx, cy))) {
    const reg = regions(r, eOn);
    const colours = new Map();
    stones.forEach(([cx, cy, c]) => {
      if (!cellIn(r, cx, cy)) return;
      const g = reg.get(key(cx, cy));
      colours.set(g, (colours.get(g) || 0) | (1 << c));
    });
    stones.forEach(([cx, cy], i) => {
      if (cellIn(r, cx, cy) && colours.get(reg.get(key(cx, cy))) === 3) bad.stones.push(i);
    });
  }
  return { ok: !bad.dots.length && !bad.stones.length && !bad.petals.length, bad };
}

// region id for every cell in the rectangle, split by drawn or hedged edges
export function regions(r, eOn) {
  const reg = new Map();
  let id = 0;
  for (let cy = r[1]; cy < r[3]; cy++) for (let cx = r[0]; cx < r[2]; cx++) {
    if (reg.has(key(cx, cy))) continue;
    const stack = [[cx, cy]];
    reg.set(key(cx, cy), id);
    while (stack.length) {
      const [x, y] = stack.pop();
      const nb = [
        [x + 1, y, ekey(x + 1, y, x + 1, y + 1)],
        [x - 1, y, ekey(x, y, x, y + 1)],
        [x, y + 1, ekey(x, y + 1, x + 1, y + 1)],
        [x, y - 1, ekey(x, y, x + 1, y)],
      ];
      for (const [nx, ny, e] of nb) {
        if (!cellIn(r, nx, ny) || reg.has(key(nx, ny)) || eOn(e)) continue;
        reg.set(key(nx, ny), id);
        stack.push([nx, ny]);
      }
    }
    id++;
  }
  return reg;
}

// Every line from start to exit that keeps off the hedges (no symbol test).
// Stops early past `limit` and flags it.
export function allLines(panel, H, limit = 200000) {
  const out = [];
  const [sx, sy] = panel.s, [ex, ey] = panel.e;
  if (!open(panel, H, sx, sy) || !inRect(panel.r, ex, ey)) return { lines: out, capped: false };
  const seen = new Set([key(sx, sy)]);
  const path = [[sx, sy]];
  let capped = false;
  (function walk(x, y) {
    if (capped) return;
    if (x === ex && y === ey) {
      out.push(path.slice());
      if (out.length >= limit) capped = true;
      return;
    }
    for (const [dx, dy] of STEP) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (!canStep(panel, H, path, seen, nx, ny)) continue;
      seen.add(k); path.push([nx, ny]);
      walk(nx, ny);
      seen.delete(k); path.pop();
      if (capped) return;
    }
  })(sx, sy);
  return { lines: out, capped };
}

export function solutions(room, panel, H, limit) {
  return allLines(panel, H, limit).lines.filter((p) => judge(room, panel, p, H).ok);
}

export function exitDir(panel) {
  if (panel.d) return panel.d;
  const [x, y] = panel.e, r = panel.r;
  if (y === r[1]) return 'n';
  if (y === r[3]) return 's';
  if (x === r[0]) return 'w';
  return 'e';
}
export const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

export const samePath = (a, b) => a.length === b.length && a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1]);

// The first line that works, null if none does, or undefined if the search ran
// past `budget` steps without settling it.
export function findLine(room, panel, H, budget = 100000) {
  const [sx, sy] = panel.s, [ex, ey] = panel.e;
  if (!open(panel, H, sx, sy) || !inRect(panel.r, ex, ey)) return null;
  const seen = new Set([key(sx, sy)]);
  const path = [[sx, sy]];
  // A branch is dead once the exit, or a dot no hedge covers, is cut off from the
  // head, or a flower already has more sides than petals. Without this a whole-room
  // panel can take tens of millions of steps to prove it has no line.
  const r = panel.r, ek = key(ex, ey);
  const dots = (room.dots || []).filter(([x, y]) => inRect(r, x, y) && !H.verts.has(key(x, y))).map(([x, y]) => key(x, y));
  const petals = (room.petals || []).filter(([cx, cy]) => cellIn(r, cx, cy));
  const pe = new Set(), reach = new Uint32Array(64 * 64), stack = new Int32Array(64 * 64);
  const eOn = (k) => pe.has(k) || H.edges.has(k);
  let stamp = 0;
  function hopeless(hx, hy) {
    for (const [cx, cy, n] of petals) {
      if (eOn(ekey(cx, cy, cx + 1, cy)) + eOn(ekey(cx, cy + 1, cx + 1, cy + 1)) + eOn(ekey(cx, cy, cx, cy + 1)) + eOn(ekey(cx + 1, cy, cx + 1, cy + 1)) > n) return true;
    }
    stamp++;
    let sp = 0;
    reach[key(hx, hy)] = stamp; stack[sp++] = key(hx, hy);
    while (sp) {
      const k0 = stack[--sp], x = k0 & 63, y = k0 >> 6;
      for (const [dx, dy] of STEP) {
        const nx = x + dx, ny = y + dy;
        if (nx < r[0] || nx > r[2] || ny < r[1] || ny > r[3]) continue;
        const k = key(nx, ny);
        if (reach[k] === stamp || seen.has(k) || H.edges.has(ekey(x, y, nx, ny))) continue;
        reach[k] = stamp; stack[sp++] = k;
      }
    }
    if (reach[ek] !== stamp) return true;
    for (const k of dots) if (reach[k] !== stamp && !seen.has(k)) return true;
    return false;
  }
  let steps = 0, found = null;
  (function walk(x, y) {
    if (found || steps > budget) return;
    steps++;
    if (x === ex && y === ey) {
      const p = path.slice();
      if (judge(room, panel, p, H).ok) found = p;
      return;
    }
    if (hopeless(x, y)) return;
    for (const [dx, dy] of STEP) {
      const nx = x + dx, ny = y + dy;
      if (!canStep(panel, H, path, seen, nx, ny)) continue;
      const e = ekey(x, y, nx, ny);
      seen.add(key(nx, ny)); path.push([nx, ny]); pe.add(e);
      walk(nx, ny);
      seen.delete(key(nx, ny)); path.pop(); pe.delete(e);
      if (found || steps > budget) return;
    }
  })(sx, sy);
  if (found) return found;
  return steps > budget ? undefined : null;
}
