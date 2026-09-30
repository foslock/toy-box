// Sail: the rules of the sea. How a chart in levels.js is read, what each of the crew's orders does, and what the
// sea does to the boat each step. Shared by the page (main.js), the navigator (solve.js) and the headless checks
// (check.mjs), so a rule changed here changes everywhere.
//
// A step goes: the crew carry out one order; the boat sails a square if her sail is up; the water she ends on pushes
// her a square (a current always, a wind channel only when her sail is up); then every creature swims a square along
// its track. At anchor, nothing moves her. She is wrecked by sailing, being pushed or being rammed into anything but
// open water: land, rocks, barrels, posts, a whirlpool's eye, a creature, or off the edge of the chart.

export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // north, east, south, west (y grows southward, down the screen)
export const DIR_NAMES = ['north', 'east', 'south', 'west'];
export const REACH = 4;                                     // how far the cannon and the grappling hook reach, in squares

// What a square can hold. Currents and wind lie over open water.
export const WATER = 0, LAND = 1, ROCK = 2, BARREL = 3, POST = 4, EYE = 5;

// The crew's orders, in the order they're learned. who: the one who carries it out.
export const ORDERS = {
  hoist:     { name: 'Hoist', who: 'bosun', short: 'Raise the sail', text: 'Raise the sail. While it’s up, the boat sails one square each step.' },
  strike:    { name: 'Strike', who: 'bosun', short: 'Lower the sail', text: 'Lower the sail. The boat stops sailing, but a current still carries her.' },
  steady:    { name: 'Steady', who: 'captain', short: 'Hold course', text: 'Hold her course for a step. Whatever she was doing, she keeps doing.' },
  port:      { name: 'Port', who: 'captain', short: 'Turn left', text: 'Turn to port: a quarter turn to the boat’s left. With the sail up she sails off the new way.' },
  starboard: { name: 'Starboard', who: 'captain', short: 'Turn right', text: 'Turn to starboard: a quarter turn to the boat’s right. With the sail up she sails off the new way.' },
  anchor:    { name: 'Anchor', who: 'anchor', short: 'Drop or weigh', text: 'Drop anchor, and nothing moves her (not her sail, the wind, a current or the cannon’s kick) until the next Anchor order weighs it. She can still turn, hoist, strike and fire while she’s held.' },
  fire:      { name: 'Fire', who: 'gunner', short: 'Bow cannon', text: 'Fire the bow cannon. The ball smashes the first barrel within four squares, and a creature it hits turns tail. The kick shoves the boat back a square.' },
  grapple:   { name: 'Grapple', who: 'hook', short: 'Haul to a post', text: 'Throw the grappling hook at a post up to four squares ahead and haul the boat up to it; nothing else moves her that step. Rocks, barrels and creatures in the way stop the hook, and at anchor she can’t be hauled.' },
};
export const ORDER_IDS = Object.keys(ORDERS);

const FLOW = { '^': 0, '>': 1, 'v': 2, '<': 3 };            // currents, by the way they run
const WIND = { u: 0, r: 1, d: 2, l: 3 };                    // wind channels, by the way they blow
const GAP = { N: 0, E: 1, S: 2, W: 3 };

// A whirlpool's ring of eight squares turns around its eye, clockwise ('@') or anticlockwise ('%'), and drains into
// it from the square above the eye: go round too long and you're sucked down.
const RING = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
const RING_CW = [1, 2, 2, 2, 3, 3, 0, 0], RING_CCW = [2, 2, 3, 0, 0, 1, 1, 2];

// Reads a level from levels.js into flat arrays. The map's legend:
//   .  open water        #  land               *  rock              B  barrels (the cannon clears them)
//   P  a post (for the grappling hook)         @  whirlpool, turning clockwise      %  whirlpool, anticlockwise
//      (its ring of eight squares is filled in as currents that swirl round the eye and drain in from above it)
//   ^ > v <  a current, running that way       u r d l  a wind channel, blowing up, right, down or left
//   s  where the boat starts (on open water)   1-9  the buoys, in order          H  the harbour, the end of the voyage
// A mark that has to sit on a current or in the wind goes in the map as that water, with its place in `marks`; and
// a current or wind under anything else goes in marks.flows.
export function parse(def) {
  const rows = def.map, H = rows.length, W = rows[0].length;
  const n = W * H, kind = new Int8Array(n), flow = new Int8Array(n).fill(-1), wind = new Int8Array(n).fill(-1);
  const barrelBit = new Int8Array(n).fill(-1), barrels = [], eyes = [];
  let start = -1, harbour = -1;
  const buoys = [];
  for (let y = 0; y < H; y++) {
    if (rows[y].length !== W) throw new Error(`${def.name}: row ${y} is ${rows[y].length} wide, not ${W}`);
    for (let x = 0; x < W; x++) {
      const c = rows[y][x], i = y * W + x;
      if (c === '#') kind[i] = LAND;
      else if (c === '*') kind[i] = ROCK;
      else if (c === 'B') { kind[i] = BARREL; barrelBit[i] = barrels.length; barrels.push(i); }
      else if (c === 'P') kind[i] = POST;
      else if (c === '@' || c === '%') { kind[i] = EYE; eyes.push({ i, x, y, cw: c === '@' }); }
      else if (c in FLOW) flow[i] = FLOW[c];
      else if (c in WIND) wind[i] = WIND[c];
      else if (c === 's') start = i;
      else if (c === 'H') harbour = i;
      else if (c >= '1' && c <= '9') buoys[+c - 1] = i;
      else if (c !== '.') throw new Error(`${def.name}: "${c}" at ${x},${y} isn't in the legend`);
    }
  }
  for (const e of eyes) RING.forEach(([dx, dy], k) => {
    const x = e.x + dx, y = e.y + dy, i = y * W + x;
    if (x < 0 || y < 0 || x >= W || y >= H || kind[i] !== WATER || flow[i] >= 0 || wind[i] >= 0) return;
    flow[i] = (e.cw ? RING_CW : RING_CCW)[k];
  });
  const at = ([x, y]) => y * W + x;
  // water running under something else: marks.flows { 'x,y': '>' } (a current under barrels, say)
  for (const [k, c] of Object.entries(def.marks?.flows || {})) { const [x, y] = k.split(',').map(Number); if (c in FLOW) flow[at([x, y])] = FLOW[c]; if (c in WIND) wind[at([x, y])] = WIND[c]; }
  if (def.marks?.start) start = at(def.marks.start);
  if (def.marks?.harbour) harbour = at(def.marks.harbour);
  for (const [k, p] of Object.entries(def.marks?.buoys || {})) buoys[+k - 1] = at(p);
  const marks = [...buoys, harbour];
  if (start < 0 || harbour < 0 || marks.some(m => m == null)) throw new Error(`${def.name}: needs an s, an H and buoys 1 to ${buoys.length}`);
  if (def.legs.length !== marks.length) throw new Error(`${def.name}: ${marks.length} marks to reach but ${def.legs.length} legs`);
  // creatures: a start square and a route of N/E/S/W steps. back: it swims the route and back again; otherwise the
  // route must bring it round to where it started, and it goes round and round.
  const beasts = (def.beasts || []).map(b => {
    const path = [b.at.slice()];
    for (const ch of b.route) { const [dx, dy] = DIRS[GAP[ch]], [x, y] = path[path.length - 1]; path.push([x + dx, y + dy]); }
    const loop = !b.back;
    if (loop) {
      const [x0, y0] = path[0], [x1, y1] = path[path.length - 1];
      if (x0 !== x1 || y0 !== y1) throw new Error(`${def.name}: the ${b.kind}'s round doesn't come back to its start`);
      path.pop();
    }
    return { kind: b.kind, path: path.map(([x, y]) => y * W + x), loop, phase: b.phase || 0 };
  });
  return {
    ...def, W, H, kind, flow, wind, barrelBit, barrels, eyes, beasts, marks, legs: def.legs.slice(),
    start: { x: start % W, y: Math.floor(start / W), dir: GAP[def.facing || 'N'] },
    crew: { ...def.crew },
  };
}

export function initialState(lv) {
  return { x: lv.start.x, y: lv.start.y, dir: lv.start.dir, sail: 0, anc: 0, beasts: lv.beasts.map(b => ({ i: b.phase, d: 1 })), broken: 0 };
}
export const cloneState = s => ({ x: s.x, y: s.y, dir: s.dir, sail: s.sail, anc: s.anc, beasts: s.beasts.map(b => ({ i: b.i, d: b.d })), broken: s.broken });
export const beastSquare = (lv, s, j) => lv.beasts[j].path[s.beasts[j].i];
export function beastAt(lv, s, i) {
  for (let j = 0; j < lv.beasts.length; j++) if (lv.beasts[j].path[s.beasts[j].i] === i) return j;
  return -1;
}
// Where a creature goes next: along its route, turning back at either end if it swims there and back.
export function beastNext(lv, j, b) {
  const n = lv.beasts[j].path.length;
  if (n === 1) return { i: 0, d: b.d };
  if (lv.beasts[j].loop) return { i: (b.i + b.d + n) % n, d: b.d };
  let d = b.d;
  if (b.i + d < 0 || b.i + d >= n) d = -d;
  return { i: b.i + d, d };
}

// What stops the boat at x, y, or null if she can sail there.
export function hazard(lv, s, x, y) {
  if (x < 0 || y < 0 || x >= lv.W || y >= lv.H) return 'edge';
  const i = y * lv.W + x, k = lv.kind[i];
  if (k === LAND) return 'land';
  if (k === ROCK) return 'rock';
  if (k === POST) return 'post';
  if (k === BARREL && !(s.broken >> lv.barrelBit[i] & 1)) return 'barrel';
  if (k === EYE) return 'whirlpool';
  if (beastAt(lv, s, i) >= 0) return 'beast';
  return null;
}

// Carries out one order and lets the sea have its say. target is the square of the mark being sailed for; the result
// says whether she touched it on the way (and wasn't wrecked). ev, if given, collects what happened, in order, for
// the page to animate.
export function step(lv, st, order, target = -1, ev = null) {
  const s = cloneState(st), W = lv.W;
  const res = { s, wreck: null, touched: false };
  const go = (dir, cause) => {
    const [dx, dy] = DIRS[dir], nx = s.x + dx, ny = s.y + dy, why = hazard(lv, s, nx, ny);
    if (ev) ev.push({ t: 'move', cause, dir, from: [s.x, s.y], to: [nx, ny], wreck: why });
    if (why) { res.wreck = { why, x: nx, y: ny, cause, beast: why === 'beast' ? beastAt(lv, s, ny * W + nx) : -1 }; return false; }
    s.x = nx; s.y = ny;
    if (ny * W + nx === target) res.touched = true;
    return true;
  };
  let held = false;
  const [dx, dy] = DIRS[s.dir];
  switch (order) {
    case 'hoist': if (ev) ev.push({ t: 'hoist', was: s.sail }); s.sail = 1; break;
    case 'strike': if (ev) ev.push({ t: 'strike', was: s.sail }); s.sail = 0; break;
    case 'steady': if (ev) ev.push({ t: 'steady' }); break;
    case 'port': s.dir = (s.dir + 3) % 4; if (ev) ev.push({ t: 'turn', by: -1, dir: s.dir }); break;
    case 'starboard': s.dir = (s.dir + 1) % 4; if (ev) ev.push({ t: 'turn', by: 1, dir: s.dir }); break;
    case 'anchor': s.anc ^= 1; if (ev) ev.push({ t: s.anc ? 'drop' : 'weigh' }); break;
    case 'fire': {
      let x = s.x, y = s.y, hit = 'nothing', beast = -1, k;
      for (k = 1; k <= REACH; k++) {
        x += dx; y += dy;
        if (x < 0 || y < 0 || x >= W || y >= lv.H) { hit = 'edge'; break; }
        const i = y * W + x, kd = lv.kind[i];
        if (kd === LAND || kd === ROCK || kd === POST) { hit = kd === LAND ? 'land' : kd === ROCK ? 'rock' : 'post'; break; }
        if (kd === BARREL && !(s.broken >> lv.barrelBit[i] & 1)) { s.broken |= 1 << lv.barrelBit[i]; hit = 'barrel'; break; }
        const j = beastAt(lv, s, i);
        if (j >= 0) { s.beasts[j].d = -s.beasts[j].d; hit = 'beast'; beast = j; break; }
      }
      if (ev) ev.push({ t: 'fire', dir: s.dir, to: [x, y], hit, beast });
      if (!s.anc && !go((s.dir + 2) % 4, 'recoil')) return res;
      break;
    }
    case 'grapple': {
      let x = s.x, y = s.y, caught = 0, k;
      for (k = 1; k <= REACH; k++) {
        x += dx; y += dy;
        if (x < 0 || y < 0 || x >= W || y >= lv.H) break;
        const i = y * W + x, kd = lv.kind[i];
        if (kd === POST) { caught = k; break; }
        if (kd === LAND || kd === ROCK || (kd === BARREL && !(s.broken >> lv.barrelBit[i] & 1)) || beastAt(lv, s, i) >= 0) break;
      }
      if (ev) ev.push({ t: 'grapple', dir: s.dir, to: [x, y], caught: caught > 0 });
      if (caught && !s.anc) {
        held = true;
        for (let j = 1; j < caught; j++) if (!go(s.dir, 'haul')) return res;
        if (ev) ev.push({ t: 'hauled' });
      }
      break;
    }
    default: throw new Error('unknown order ' + order);
  }
  if (!held && !s.anc) {
    if (s.sail && !go(s.dir, 'sail')) return res;
    const i = s.y * W + s.x;
    if (lv.flow[i] >= 0) { if (!go(lv.flow[i], 'current')) return res; }
    else if (s.sail && lv.wind[i] >= 0) { if (!go(lv.wind[i], 'wind')) return res; }
  }
  const boat = s.y * W + s.x;
  for (let j = 0; j < s.beasts.length; j++) {
    const from = lv.beasts[j].path[s.beasts[j].i];
    s.beasts[j] = beastNext(lv, j, s.beasts[j]);
    const to = lv.beasts[j].path[s.beasts[j].i];
    if (ev) ev.push({ t: 'beast', j, from: [from % W, Math.floor(from / W)], to: [to % W, Math.floor(to / W)] });
    if (to === boat && !res.wreck) res.wreck = { why: 'rammed', x: s.x, y: s.y, cause: 'beast', beast: j };
  }
  if (res.wreck) res.touched = false;
  return res;
}

// A plan of orders, played from a state until it's done or she reaches the mark. What the page shows for a leg.
export function sailLeg(lv, st, plan, target) {
  let s = st;
  const steps = [];
  for (let k = 0; k < plan.length; k++) {
    const ev = [], r = step(lv, s, plan[k], target, ev);
    steps.push({ order: plan[k], ev, before: s, after: r.s, wreck: r.wreck, touched: r.touched });
    if (r.wreck) return { steps, wreck: r.wreck, reached: false, used: k + 1, s: r.s };
    s = r.s;
    if (r.touched) return { steps, wreck: null, reached: true, used: k + 1, s };
  }
  return { steps, wreck: null, reached: false, used: plan.length, s };
}

export const poolTotal = pool => Object.values(pool).reduce((a, b) => a + b, 0);
