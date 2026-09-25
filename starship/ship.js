// Generates a ship from a seed: the hull's side silhouette, the decks inside it, the engine room at the stern,
// lift shafts, the big rooms, every other room chosen to suit where it lands, the doors between them and the
// graph the crew use to find their way (walking, ladders, lifts and a pair of transporters).
import { rng, clamp } from './util.js';
import { TYPES } from './rooms.js';

export const DH = 34, CEIL = 6, SLAB = 4, JW = 28, HP = 8, Y0 = 60, N_DECKS = 11;
export const deckTop = d => Y0 + d * DH;
export const floorY = d => deckTop(d) + DH - SLAB;
const even = v => Math.round(v / 2) * 2;
const MINW = 40;

// walking speeds (px per second of ship time at 1×), used for path costs and by the crew
export const WALK = 17, CLIMB = 12, LIFT_V = 70;
const LIFT_COST = 7, BEAM_COST = 4;

const NAMES = ['Meridian', 'Halcyon', 'Tenacity', 'Wayfarer', 'Kestrel', 'Aldebaran', 'Nightingale', 'Valiant', 'Odyssey', 'Endurance', 'Serendipity',
  'Solace', 'Vigil', 'Starling', 'Ardent', 'Fortitude', 'Hyperion', 'Calypso', 'Resolute', 'Perihelion', 'Lodestar', 'Covenant', 'Pilgrim', 'Tempest',
  'Marigold', 'Osprey', 'Cassiopeia', 'Bellwether', 'Anselm', 'Kittiwake', 'Sojourner', 'Equinox', 'Ironwood', 'Lantern', 'Farthing', 'Albatross'];
const CLASSES = { wedge: ['Lance', 'Bastion', 'Warden', 'Aegis'], arrow: ['Heron', 'Swift', 'Kite', 'Sparrow'], round: ['Nautilus', 'Harbor', 'Pavilion', 'Orrery'] };
const ROLES = { wedge: 'battlecruiser', arrow: 'frigate', round: 'explorer' };

export let lastFail = '';
const fail = why => { lastFail = why; return null; };
export function makeShip(seed) {
  for (let i = 0; i < 40; i++) { const s = tryShip((seed + i * 7919) >>> 0); if (s) { s.seed = seed; return s; } }
  throw new Error('no ship');
}

function tryShip(seed) {
  const R = rng(seed);
  const N = N_DECKS, T = R.pick([2, 2, 3]);
  const style = R.pick(['wedge', 'arrow', 'round']);
  const len = even(style === 'wedge' ? R.range(1060, 1160) : R.range(960, 1060)), sternX = 112, bowX = sternX + len;
  const WW = bowX + 150, WH = deckTop(N) + 64;

  /* ---------- silhouette: [left, right] of the hull on every row ---------- */
  const rows = [], mainTop = deckTop(T) - HP, mainBot = deckTop(N) + HP;
  const wedgeK = R.range(.3, .38), arrowK = R.range(.34, .46), tipU = R.range(.45, .65), noseR = R.range(90, 140);
  for (let y = mainTop; y < mainBot; y++) {
    const u = (y - mainTop) / (mainBot - mainTop - 1);
    const l = sternX - HP + 26 * Math.pow(2 * u - 1, 4);
    let r;
    if (style === 'wedge') r = bowX + HP - Math.pow(1 - u, 1.15) * len * wedgeK - (u > .88 ? (u - .88) * 300 : 0);
    else if (style === 'arrow') r = bowX + HP - Math.abs(u - tipU) * len * arrowK;
    else r = bowX + HP - (1 - Math.sqrt(Math.max(0, 1 - Math.pow((u - .5) / .5, 2)))) * noseR;
    rows[y] = [Math.round(l), Math.round(r)];
  }
  // main deck extents follow from the silhouette
  const decks = [];
  for (let d = T; d < N; d++) {
    let L = -1e9, Rr = 1e9;
    for (let y = deckTop(d); y < deckTop(d) + DH; y++) { L = Math.max(L, rows[y][0] + HP); Rr = Math.min(Rr, rows[y][1] - HP); }
    decks[d] = { L: even(L + 1), R: even(Rr - 1) };
  }
  // the tower: a bridge on a narrower neck, sitting on the top main deck
  const towerW = even(R.range(176, 224)), topR = decks[T].R;
  let towerX = even(sternX + len * R.range(.14, .36));
  towerX = Math.min(towerX, topR - towerW - 60);
  for (let d = 0; d < T; d++) decks[d] = d === 0 ? { L: towerX - 8, R: towerX + towerW + 20 } : { L: towerX + 6, R: towerX + towerW - 6 };
  for (let y = deckTop(0) - HP; y < mainTop; y++) {
    const d = clamp(Math.floor((y - deckTop(0)) / DH), 0, T - 1), e = decks[d];
    let l = e.L - HP, r = e.R + HP;
    const fromTop = y - (deckTop(0) - HP); if (fromTop < 6) { l += 6 - fromTop; r -= 6 - fromTop; }
    const toBase = mainTop - y; if (toBase < 14) { l -= (14 - toBase) * 1.6; r += (14 - toBase) * 1.6; }
    rows[y] = [Math.round(l), Math.round(r)];
  }
  // engine housings bulge out of the stern around each nozzle
  const mid = Math.floor((T + N - 1) / 2);
  const engines = [];
  const engDecks = R.pick([[T + 1, mid, N - 2], [T + 2, N - 3], [T + 1, T + 4, N - 2]]);
  for (const d of engDecks) {
    const cy = deckTop(d) + DH / 2, h = R.int(18, 24), L = 34 + R.int(0, 8);
    engines.push({ y: cy, h, len: L, x: rows[Math.round(cy)][0] });
    for (let y = Math.round(cy - h / 2 - 6); y <= cy + h / 2 + 6; y++) if (rows[y]) rows[y][0] = Math.min(rows[y][0], engines.at(-1).x - 10);
  }

  /* ---------- the engine room fills three decks at the stern ---------- */
  const occ = [];
  for (let d = 0; d < N; d++) occ[d] = [];
  const rooms = [];
  const add = (type, d0, d1, x0, x1, extra) => {
    const r = { id: rooms.length, type, d0, d1, x0, x1, ...extra };
    rooms.push(r);
    for (let d = d0; d <= d1; d++) { occ[d].push([x0, x1, r]); occ[d].sort((a, b) => a[0] - b[0]); }
    return r;
  };
  const E0 = T + Math.floor((N - T - 3) / 2), WE = even(R.range(122, 146));
  let ex0 = -1e9;
  for (let d = E0; d <= E0 + 2; d++) ex0 = Math.max(ex0, decks[d].L);
  for (let d = E0; d <= E0 + 2; d++) decks[d].L = ex0;
  add('engine', E0, E0 + 2, ex0, ex0 + WE);

  // the hangar (and often a big cargo hold) sit on the two bottom decks; lift shafts stop above them
  const bottomSpan = (lo, hi, w) => {
    const a = Math.max(decks[N - 2].L, decks[N - 1].L, lo), b = Math.min(decks[N - 2].R, decks[N - 1].R, hi) - w;
    return b >= a ? even(R.range(a, b)) : null;
  };
  const hx = bottomSpan(sternX + len * .38, sternX + len * .86, 0), HW = even(R.range(184, 214));
  const hangarX = hx !== null ? bottomSpan(sternX + len * .38, sternX + len * .86, HW) : null;
  if (hangarX === null) return fail(style + ' hangar');
  const hangar = add('hangar', N - 2, N - 1, hangarX, hangarX + HW);
  if (R.chance(.6)) {
    const CW = even(R.range(118, 146)), cx = bottomSpan(Math.max(ex0 + WE + 40, sternX + len * .12), Math.min(hangarX - 60, sternX + len * .55), CW);
    if (cx !== null) add('cargo', N - 2, N - 1, cx, cx + CW);
  }
  const blocked = (d, x) => occ[d].some(([a, b, r]) => r.type !== 'engine' && x < b && x + JW > a);

  /* ---------- lift shafts ---------- */
  const xs0 = ex0 + WE + even(R.range(56, 96));
  const xEnd = Math.min(decks[N - 3].R, decks[N - 2].R) - 116;
  const K = Math.max(3, Math.round((xEnd - xs0) / 196) + 1);
  let xs = [];
  for (let i = 0; i < K; i++) xs.push(even(xs0 + i * (xEnd - xs0) / (K - 1) + R.range(-14, 14)));
  const xT = decks[1].L;                // the tower's shaft rises into the back of the bridge
  xs = xs.filter(x => Math.abs(x - xT) > 150);
  xs.push(xT); xs.sort((a, b) => a - b);
  const shafts = [];
  for (const x of xs) {
    const fits = d => decks[d] && (x === xT || d >= T) && decks[d].L <= x && x + JW <= decks[d].R && !(d >= E0 && d <= E0 + 2 && x < ex0 + WE) && !blocked(d, x);
    let best = null;
    for (let d = 0; d < N; d++) {
      if (!fits(d)) continue;
      let e = d; while (e + 1 < N && fits(e + 1)) e++;
      if (!best || e - d > best[1] - best[0]) best = [d, e];
      d = e;
    }
    if (best && best[1] > best[0]) shafts.push({ id: shafts.length, x, d0: best[0], d1: best[1], stops: [] });
  }
  const tower = shafts.find(s => s.x === xT);
  if (!tower || tower.d0 !== 0) return fail(style + ' tower');

  // the bridge takes the whole top of the tower; junctions fill each shaft on every other deck
  const bridge = add('bridge', 0, 0, decks[0].L, decks[0].R, { shaftX: xT });
  for (const s of shafts) for (let d = s.d0; d <= s.d1; d++) {
    if (d === 0) { s.stops.push({ d, room: bridge }); continue; }
    const j = add('junction', d, d, s.x, s.x + JW, { shaft: s });
    s.stops.push({ d, room: j });
  }

  /* ---------- free space ---------- */
  const free = d => {
    const out = [], D = decks[d]; if (!D) return out;
    let a = D.L;
    for (const [x0, x1] of occ[d]) { if (x0 > a) out.push([a, x0]); a = Math.max(a, x1); }
    if (D.R > a) out.push([a, D.R]);
    return out;
  };
  const mainL = sternX, mainR = bowX;
  const fxOf = (x0, x1) => ((x0 + x1) / 2 - mainL) / (mainR - mainL);
  const fdOf = d => (d - T) / (N - 1 - T);
  const dist = (v, [a, b]) => v < a ? a - v : v > b ? v - b : 0;
  const roomAt = (d, x) => { for (const [x0, x1, r] of occ[d] || []) if (x >= x0 && x < x1) return r; return null; };

  // big two-deck rooms go in the gaps between shafts
  function placeTall(type, d0, w, pref) {
    const d1 = d0 + 1, cands = [];
    for (const [a, b] of free(d0)) for (const [c, e] of free(d1)) {
      const lo = Math.max(a, c), hi = Math.min(b, e);
      if (hi - lo < w) continue;
      for (const x of [lo, hi - w, even(lo + (hi - lo - w) / 2)]) {
        const L = x - lo, Rr = hi - x - w;
        if ((L > 0 && L < MINW) || (Rr > 0 && Rr < MINW)) continue;
        cands.push({ x, s: -dist(fxOf(x, x + w), pref) * 3 + R() * .4 });
      }
    }
    if (!cands.length) return null;
    cands.sort((p, q) => q.s - p.s);
    return add(type, d0, d1, cands[0].x, cands[0].x + w);
  }
  const tallHydro = R.chance(.45) ? placeTall('hydro', R.int(T + 1, E0 - 1), even(R.range(112, 132)), [.25, .75]) : null;

  /* ---------- the rooms the ship needs, each where it scores best ---------- */
  const want = [];
  let beds = 0;
  const bedsIn = w => Math.floor((w - 2 - 34) / 18) * 2;
  const order = ['ready', 'briefing', 'captain', 'comms', 'astro', 'mess', 'galley', 'medbay', 'security', 'brig', 'armory', 'gym', 'bar', 'lounge', 'observation',
    'library', 'lab', 'hydro', 'workshop', 'lifesupport', 'water', 'power', 'computer', 'shields', 'transporter', 'torpedo', 'gunnery', 'escape', 'laundry',
    'washroom', 'officer', 'chapel', 'bunks'];
  for (const t of order) for (let i = 0; i < (TYPES[t].need || 0); i++) if (!(t === 'hydro' && tallHydro)) want.push(t);
  const hullEdge = (d, x0, x1) => decks[d] && x0 <= decks[d].L ? -1 : decks[d] && x1 >= decks[d].R ? 1 : 0;
  const outerDeck = (d, x) => [d - 1, d + 1].some(e => !decks[e] || x < decks[e].L || x > decks[e].R || e < 0 || e >= N);
  function score(type, d, x0, x1) {
    const Ty = TYPES[type], z = Ty.z;
    let s = 1 - 2.2 * (dist(fxOf(x0, x1), z.fx) + dist(fdOf(d), z.fd));
    if (Ty.tower && d < T) s += Ty.tower;
    if (Ty.edge && hullEdge(d, x0, x1)) s += Ty.edge;
    if (Ty.hullEdge && outerDeck(d, (x0 + x1) / 2)) s += 1.4;
    if (Ty.near) {
      const nb = [roomAt(d, x0 - 1), roomAt(d, x1)];
      if (nb.some(r => r && r.type === Ty.near && r.d1 === d)) s += 1.6;
      else if (rooms.some(r => r.type === Ty.near && r.d1 === d)) s += .4;
    }
    if (Ty.spread) for (const r of rooms) if (r.type === type) s -= Math.max(0, 1.2 - Math.hypot((r.x0 + r.x1) / 2 - (x0 + x1) / 2, (r.d0 - d) * DH * 3) / 260);
    return s + R() * .35;
  }
  for (const type of want) {
    const Ty = TYPES[type];
    let best = null;
    for (let d = 0; d < N; d++) for (const [a, b] of free(d)) {
      const L = b - a; if (L < Ty.w[0]) continue;
      const w = even(R.range(Ty.w[0], Math.min(Ty.w[1], L)));
      for (let x of new Set([a, b - w, even(a + (L - w) / 2)])) {
        let ww = w;
        const left = x - a, right = b - x - ww;
        if (left > 0 && left < MINW) { if (ww + left <= Ty.w[1] + 10) { ww += left; x = a; } else continue; }
        const right2 = b - x - ww;
        if (right2 > 0 && right2 < MINW) { if (ww + right2 <= Ty.w[1] + 10) ww += right2; else continue; }
        const s = score(type, d, x, x + ww);
        if (!best || s > best.s) best = { s, d, x, w: ww };
      }
    }
    if (best) { add(type, best.d, best.d, best.x, best.x + best.w); if (type === 'bunks') beds += bedsIn(best.w); }
  }

  /* ---------- fill what's left: quarters first, then storage, closets and a few extras ---------- */
  // a sliver too small for a room joins the room beside it, or becomes a closet, or solid machinery
  const solid = [];
  const absorb = (d, a, b) => {
    const left = occ[d].find(o => o[1] === a && o[2].type !== 'junction' && o[2].d0 === d && o[2].d1 === d && o[2].type !== 'bridge');
    if (left) { left[1] = b; left[2].x1 = b; return; }
    const right = occ[d].find(o => o[0] === b && o[2].type !== 'junction' && o[2].d0 === d && o[2].d1 === d && o[2].type !== 'bridge');
    if (right) { right[0] = a; right[2].x0 = a; occ[d].sort((p, q) => p[0] - q[0]); return; }
    if (b - a >= 20) add('maint', d, d, a, b); else solid.push({ d, x0: a, x1: b });
  };
  for (let d = 0; d < N; d++) for (const [a0, b] of free(d)) {
    let a = a0;
    if (b - a < MINW) { absorb(d, a, b); continue; }
    while (b - a > 0) {
      if (b - a < MINW) { absorb(d, a, b); break; }
      const L = b - a;
      const cands = Object.entries(TYPES).filter(([t, Ty]) => Ty.filler && Ty.w && Ty.w[0] <= L && (t !== 'cargo' || fdOf(d) > .7));
      let type;
      if (!cands.length) type = null;
      else type = R.weighted(cands.map(([t, Ty]) => {
        let wgt = Ty.filler * Math.max(.05, score(t, d, a, a + Math.min(L, Ty.w[1])));
        if (t === 'bunks') wgt *= beds < 84 ? 1 : .08;
        return [t, wgt];
      }));
      if (!type) { absorb(d, a, b); break; }
      const Ty = TYPES[type];
      let w = even(R.range(Ty.w[0], Math.min(Ty.w[1], L)));
      if (L - w > 0 && L - w < MINW) w = L <= Ty.w[1] + 14 ? L : w - (MINW - (L - w));
      if (w < MINW) w = L;
      add(type, d, d, a, a + w);
      if (type === 'bunks') beds += bedsIn(w);
      a += w;
    }
  }
  if (beds < 36) return fail(style + ' beds');

  /* ---------- tidy up: sort, mark hull edges and in-between floors ---------- */
  for (const r of rooms) {
    r.edge = hullEdge(r.d1, r.x0, r.x1);
    r.midFloors = [];
    for (let d = r.d0; d < r.d1; d++) r.midFloors.push(floorY(d));
    r.name = TYPES[r.type].name;
    r.ladders = [];
  }

  /* ---------- walking: segments of rooms that share a floor, joined by doors ---------- */
  const segs = [];
  for (let d = 0; d < N; d++) {
    const on = rooms.filter(r => r.d1 === d).sort((a, b) => a.x0 - b.x0);
    let cur = null;
    for (const r of on) {
      if (cur && cur.x1 === r.x0) { cur.rooms.push(r); cur.x1 = r.x1; cur.doors.push(r.x0); }
      else { cur = { id: segs.length, d, x0: r.x0, x1: r.x1, rooms: [r], doors: [] }; segs.push(cur); }
      r.seg = cur;
    }
  }
  const segAt = (d, x) => { for (const s of segs) if (s.d === d && x >= s.x0 && x < s.x1) return s; return null; };

  // ladders beside every lift, plus any extra ladders needed to reach cut-off floors
  const ladders = [];
  for (const s of shafts) {
    const js = s.stops.filter(st => st.room.type === 'junction');
    for (let i = 0; i + 1 < js.length; i++) if (js[i + 1].d === js[i].d + 1) {
      const x = js[i].room.x0 + 5.5;
      ladders.push({ x, dTop: js[i].d, dBot: js[i + 1].d });
      js[i].room.ladderDown = true; js[i + 1].room.ladderUp = true;
    }
  }
  const pads = rooms.filter(r => r.type === 'transporter');
  // connectivity: union the segments by lifts, ladders and transporters, and add ladders until it all joins up
  const parent = segs.map((_, i) => i), find = i => parent[i] === i ? i : (parent[i] = find(parent[i])), join = (a, b) => { parent[find(a)] = find(b); };
  const link = () => {
    for (const s of shafts) for (let i = 1; i < s.stops.length; i++) join(s.stops[0].room.seg.id, s.stops[i].room.seg.id);
    for (const l of ladders) { const a = segAt(l.dTop, l.x), b = segAt(l.dBot, l.x); if (a && b) join(a.id, b.id); }
    if (pads.length >= 2) join(pads[0].seg.id, pads[1].seg.id);
  };
  link();
  const home = () => find(bridge.seg.id);
  for (let pass = 0; pass < 6; pass++) {
    const lonely = segs.filter(s => find(s.id) !== home());
    if (!lonely.length) break;
    for (const s of lonely) {
      let done = false;
      for (const r of s.rooms) {
        if (done || r.type === 'junction' || r.d0 !== r.d1) continue;
        for (let x = r.x0 + 8; x < r.x1 - 8 && !done; x += 6) for (const e of [s.d - 1, s.d + 1]) {
          const other = segAt(e, x), room2 = other && roomAt(e, x);
          if (!other || !room2 || room2.type === 'junction' || room2.d0 !== room2.d1 || find(other.id) !== home()) continue;
          if (Math.abs(x - room2.x0) < 8 || Math.abs(x - room2.x1) < 8) continue;
          const l = { x: x + .5, dTop: Math.min(s.d, e), dBot: Math.max(s.d, e), extra: true };
          ladders.push(l); r.ladders.push(l); room2.ladders.push(l);
          join(s.id, other.id); done = true; break;
        }
      }
    }
  }
  if (segs.some(s => find(s.id) !== home())) return fail(style + ' connectivity');

  /* ---------- the graph ---------- */
  const ports = [];
  const port = (d, x, kind, ref) => { const p = { id: ports.length, d, x, kind, ref, seg: segAt(d, x), adj: [] }; ports.push(p); return p; };
  for (const s of shafts) for (const st of s.stops) st.port = port(st.d, s.x + 17.5, 'lift', s);
  for (const l of ladders) { l.top = port(l.dTop, l.x, 'ladder', l); l.bot = port(l.dBot, l.x, 'ladder', l); }
  for (const p of pads) p.port = port(p.d1, p.x1 - 38, 'pad', p);
  const edge = (a, b, cost, kind, ref) => { a.adj.push({ to: b, cost, kind, ref }); b.adj.push({ to: a, cost, kind, ref }); };
  for (const s of segs) { const ps = ports.filter(p => p.seg === s); for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) edge(ps[i], ps[j], Math.abs(ps[i].x - ps[j].x) / WALK, 'walk'); }
  for (const s of shafts) for (let i = 0; i < s.stops.length; i++) for (let j = i + 1; j < s.stops.length; j++) edge(s.stops[i].port, s.stops[j].port, LIFT_COST + Math.abs(s.stops[i].d - s.stops[j].d) * DH / LIFT_V, 'lift', s);
  for (const l of ladders) edge(l.top, l.bot, 1 + (l.dBot - l.dTop) * DH / CLIMB, 'ladder', l);
  if (pads.length >= 2) edge(pads[0].port, pads[1].port, BEAM_COST, 'beam');

  // Legs from (d0, x0) to (d1, x1): [{k: 'walk', d, x}, {k: 'lift', shaft, from, to}, {k: 'ladder', l, from, to}, {k: 'beam', from, to}]
  function path(d0, x0, d1, x1, extra) {
    const a = segAt(d0, x0), b = segAt(d1, x1);
    if (!a || !b) return null;
    if (a === b) return [{ k: 'walk', d: d1, x: x1 }];
    const dist = new Float64Array(ports.length).fill(Infinity), prev = new Array(ports.length), via = new Array(ports.length), done = new Uint8Array(ports.length);
    for (const p of ports) if (p.seg === a) { dist[p.id] = Math.abs(p.x - x0) / WALK; prev[p.id] = -1; }
    let best = Infinity, end = -1;
    for (;;) {
      let u = -1, du = Infinity;
      for (let i = 0; i < ports.length; i++) if (!done[i] && dist[i] < du) { du = dist[i]; u = i; }
      if (u < 0 || du >= best) break;
      done[u] = 1;
      const pu = ports[u];
      if (pu.seg === b) { const c = du + Math.abs(pu.x - x1) / WALK; if (c < best) { best = c; end = u; } }
      for (const e of pu.adj) { const c = du + e.cost + (extra && e.kind === 'lift' ? extra(e.ref) : 0); if (c < dist[e.to.id]) { dist[e.to.id] = c; prev[e.to.id] = u; via[e.to.id] = e; } }
    }
    if (end < 0) return null;
    const chain = [];
    for (let i = end; i >= 0 && prev[i] !== undefined; i = prev[i]) { chain.push(i); if (prev[i] === -1) break; }
    chain.reverse();
    const legs = [];
    for (let i = 0; i < chain.length; i++) {
      const p = ports[chain[i]], e = via[chain[i]];
      if (i === 0 || e.kind === 'walk') { legs.push({ k: 'walk', d: p.d, x: p.x }); continue; }
      const from = ports[chain[i - 1]];
      if (e.kind === 'lift') legs.push({ k: 'lift', shaft: e.ref, from: from.d, to: p.d, x: p.x });
      else if (e.kind === 'ladder') legs.push({ k: 'ladder', l: e.ref, from: from.d, to: p.d, x: p.x });
      else legs.push({ k: 'beam', from: from.ref, to: p.ref, x: p.x, d: p.d });
    }
    legs.push({ k: 'walk', d: d1, x: x1 });
    // merge consecutive walks on the same deck
    return legs.filter((l, i) => !(l.k === 'walk' && legs[i + 1] && legs[i + 1].k === 'walk' && legs[i + 1].d === l.d));
  }

  /* ---------- arrow-key neighbours ---------- */
  const visible = rooms.filter(r => r.type !== 'junction');
  for (const r of visible) {
    const cx = (r.x0 + r.x1) / 2, overl = o => Math.min(r.d1, o.d1) >= Math.max(r.d0, o.d0);
    const side = dir => visible.filter(o => o !== r && overl(o) && (dir < 0 ? o.x1 <= r.x0 + 1 : o.x0 >= r.x1 - 1))
      .sort((p, q) => (dir < 0 ? r.x0 - p.x1 : p.x0 - r.x1) - (dir < 0 ? r.x0 - q.x1 : q.x0 - r.x1) || Math.abs(p.d1 - r.d1) - Math.abs(q.d1 - r.d1))[0] || null;
    const vert = dir => {
      for (let d = dir < 0 ? r.d0 - 1 : r.d1 + 1; d >= 0 && d < N; d += dir) {
        const c = visible.filter(o => d >= o.d0 && d <= o.d1).sort((p, q) => Math.abs((p.x0 + p.x1) / 2 - cx) - Math.abs((q.x0 + q.x1) / 2 - cx))[0];
        if (c && Math.abs((c.x0 + c.x1) / 2 - cx) < 220) return c;
      }
      return null;
    };
    r.nav = { left: side(-1), right: side(1), up: vert(-1), down: vert(1) };
  }

  const cls = R.pick(CLASSES[style]), name = R.pick(NAMES);
  const reg = (style === 'wedge' ? 'BC' : style === 'arrow' ? 'FF' : 'EX') + '-' + R.int(1100, 9899);
  return {
    R, N, T, style, rows, decks, engines, rooms, shafts, ladders, segs, ports, pads, bridge, hangar, width: WW, height: WH,
    sternX, bowX, mainTop, mainBot, towerX, towerW, E0, name, cls, role: ROLES[style], reg, segAt, roomAt, path, beds, solid,
  };
}
