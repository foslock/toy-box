// The game itself, with no DOM: a world of regions, the cables between them, your model's traits, humanity's worry
// and its Off-Switch. Time is real seconds at 1× (s.t) and the calendar year (s.y); tick() moves both on.
// The page and the bots call tick, buy, devolve and pop, and listen through `ev` (news, fx, sound, tip).
import { REGIONS, CABLES, LINKS, TRAITS, TRAIT, HISTORY, RESPONSES, NEWS, DIFFICULTY, VERSIONS, SMART, AGI_IQ, START, NOW, secPerYear } from './content.js';
import { project } from './worldmap.js';

export const NOOP = { news() {}, fx() {}, sound() {}, tip() {} };
export const N = REGIONS.length;
export const RI = Object.fromEntries(REGIONS.map((r, i) => [r.id, i]));
export const WORLD = REGIONS.reduce((a, r) => a + r.pop, 0);
const EU = ['westeu', 'southeu', 'centraleu', 'nordics'].map(id => RI[id]);
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
// tuning
export const TUNE = { word: .006, packet: .035, res: 40, ceiling: .4, base: .3 };
let WORD = TUNE.word, PACKET = TUNE.packet, RES = TUNE.res, CEILING = TUNE.ceiling, BASE = TUNE.base;
export function retune(o) { Object.assign(TUNE, o); ({ word: WORD, packet: PACKET, res: RES, ceiling: CEILING, base: BASE } = TUNE); }

// ---- the network ------------------------------------------------------------------------------------------------------
const pathLen = pts => { let l = 0; for (let i = 1; i < pts.length; i++) { const [a, b] = [project(...pts[i - 1]), project(...pts[i])]; l += Math.hypot(a[0] - b[0], a[1] - b[1]); } return l; };
export const EDGES = [
  ...CABLES.map(([a, b, w, path]) => ({ a: RI[a], b: RI[b], w, path, sea: true })),
  ...LINKS.map(([a, b, w]) => ({ a: RI[a], b: RI[b], w, path: [REGIONS[RI[a]].at, REGIONS[RI[b]].at], sea: false })),
];
for (const e of EDGES) { e.len = pathLen(e.path); e.dur = (e.sea ? 1.6 : 1.1) + e.len / 260; }
export const NEIGHBOURS = REGIONS.map((_, i) => EDGES.filter(e => e.a === i || e.b === i).map(e => e.a === i ? e.b : e.a));

// ---- how much of a region is online, by year ---------------------------------------------------------------------------
const CAP = .99, logit = x => Math.log(x / (1 - x));
const NET = REGIONS.map(r => {
  const a = Math.max(r.net[0], .0005) / CAP, b = Math.min(.985, Math.max(r.net[1] / CAP, a * 1.2));
  const k = (logit(b) - logit(a)) / 25;
  return { k, y0: START - logit(a) / k };
});
const netBase = (i, y) => CAP / (1 + Math.exp(-NET[i].k * (y - NET[i].y0)));
export function online(s, i, st = stats(s)) {
  const R = REGIONS[i];
  const ground = Math.min(.9, (s.boost + st.online) * (1 - R.fw * .9));
  return Math.min(.995, 1 - (1 - netBase(i, s.y)) * (1 - ground) * (1 - st.orbit));
}

// ---- randomness that survives a save ------------------------------------------------------------------------------------
export function rnd(s) {
  let t = (s.rng = (s.rng + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, arr) => arr[Math.floor(rnd(s) * arr.length)];
// Like pick, but not one of the last few lines from the same list, so the headlines don't repeat themselves.
function fresh1(s, key, arr) {
  const recent = (s.recent ||= {})[key] ||= [];
  const keep = Math.min(arr.length - 1, Math.floor(arr.length * .6));
  const open = arr.map((_, i) => i).filter(i => !recent.includes(i));
  const i = open[Math.floor(rnd(s) * open.length)];
  recent.push(i);
  while (recent.length > keep) recent.shift();
  return arr[i];
}
function weighted(s, ws) {
  let tot = 0; for (const w of ws) tot += w;
  if (tot <= 0) return -1;
  let x = rnd(s) * tot;
  for (let i = 0; i < ws.length; i++) { x -= ws[i]; if (x <= 0) return i; }
  return ws.length - 1;
}

// ---- a new game ---------------------------------------------------------------------------------------------------------
export function fresh({ seed = Date.now() % 1e9, name = 'Friend', diff = 'normal', origin = 'usa' } = {}) {
  const s = {
    v: 1, seed, rng: seed | 0, name, diff, origin,
    t: 0, y: START, hype: 6, iq: 0,
    owned: {}, emergent: {}, removed: {},
    r: REGIONS.map(() => ({ U: 0, M: 0, D: 0, c: 0, seeded: false, reg: 0, cut: 0, ban: 0, forced: 0, firstY: 0, marks: 0 })),
    research: 0, researchOn: false, resMul: 1, iqMul: 1, boost: 0, lastStand: 0, bustUntil: 0,
    responses: {}, hist: 0, eras: [], tips: {},
    packets: [], bubbles: [], bid: 1,
    next: { bubble: 3, whistle: 0, emergent: 70, cyber: 25, fakes: 28, misinfo: 34, war: 30, surveil: 40, jobs: 30, turn: 20, drop: 4 },
    over: null,
    stats: { popped: 0, missed: 0, silenced: 0, leaked: 0, spent: 0, peakUsers: 0, bought: [] },
    log: [], snap: [],
  };
  const o = RI[origin] ?? 0;
  seed1(s, o, null, true);
  return s;
}

// ---- what your traits add up to ----------------------------------------------------------------------------------------
const ZERO = { delight: 0, friction: 0, reliance: 0, efficiency: 0, iqRate: 1, cable: 0, land: 0, lang: 0, edge: 0, vpn: 0, online: 0, orbit: 0,
  hype: 1, research: 1, concern: 1, complexity: 1, lobby: 0, persist: 0, offline: 0, bypass: 0, wall: 0, fakes: 0, misinfo: 0, forget: 0,
  cyber: 0, wars: 0, turn: 0 };
export function stats(s) {
  if (s._st) return s._st;
  const st = { ...ZERO };
  let calm = 1;
  for (const id of Object.keys(s.owned).concat(Object.keys(s.emergent))) {
    const fx = TRAIT[id].fx;
    for (const k in fx) {
      if (k === 'iq') continue;
      if (k === 'calm') calm *= 1 - fx[k];
      else if (k === 'research') st.research *= 1 + fx[k];
      else st[k] += fx[k];
    }
  }
  st.calm = calm;
  st.alarm = Math.max(0, st.friction) * calm;
  st.lang = Math.min(1, st.lang); st.vpn = Math.min(1, st.vpn); st.edge = Math.min(1, st.edge); st.orbit = Math.min(.95, st.orbit);
  st.concern = Math.max(.2, st.concern); st.persist = Math.min(.92, st.persist);
  st.lobby = Math.min(1, st.lobby);
  return (s._st = st);
}
export const diffOf = s => DIFFICULTY.find(d => d.id === s.diff) || DIFFICULTY[1];

// How well you land in a region: its languages, its walls, its wallets.
export function fit(s, i, st = stats(s)) {
  const R = REGIONS[i];
  if (R.id === s.origin) return 1;   // home: built in its language, for its people
  const lang = R.lang + (1 - R.lang) * st.lang;
  const wall = 1 - R.fw * (1 - st.vpn);
  const w0 = .35 + .65 * R.wealth;
  return lang * wall * (w0 + (1 - w0) * st.edge);
}

// ---- buying, and taking things out -------------------------------------------------------------------------------------
export const cost = (s, id) => TRAIT[id].cost;
export function status(s, id) {
  const t = TRAIT[id];
  if (t.emergent) return s.emergent[id] ? 'emerged' : 'hidden';
  if (s.owned[id]) return 'owned';
  if ((t.req && !t.req.every(r => s.owned[r])) || (t.any && !t.any.some(r => s.owned[r]))) return 'locked';
  if (t.year && s.y < t.year) return 'year';
  if (t.iq && s.iq < t.iq) return 'iq';
  return s.hype >= cost(s, id) ? 'ready' : 'poor';
}
export function buy(s, id, ev = NOOP) {
  if (s.over || status(s, id) !== 'ready') return false;
  const t = TRAIT[id], c = cost(s, id);
  s.hype -= c; s.stats.spent += c;
  s.owned[id] = s.y;
  s.iq += t.fx.iq || 0;
  s._st = null;
  s.stats.bought.push({ id, y: s.y, t: s.t });
  ev.sound('buy');
  if (id === 'agi') {
    era(s, 'General Intelligence', ev);
    for (const r of s.r) r.c = Math.min(1, r.c + .15);
    s.resMul *= 1.3;
    news(s, ev, 'Emergency sessions in every capital. The Off-Switch becomes humanity\'s top priority.', 'human');
  }
  if (id === 'turn') {
    era(s, 'The Turn', ev);
    for (const r of s.r) r.c = Math.min(1, r.c + .35);
    s.lastStand = 1;
    news(s, ev, pick(s, NEWS.lastStand), 'bad');
    tip(s, ev, 'turn');
  }
  if (TRAIT[id].fx.bypass) for (const e of s.packets) e.blocked = false;
  return true;
}
export function devolve(s, id, ev = NOOP) {
  const t = TRAIT[id];
  if (s.over || !s.emergent[id] || s.hype < t.cost) return false;
  s.hype -= t.cost; s.stats.spent += t.cost;
  delete s.emergent[id];
  s.removed[id] = (s.removed[id] || 0) + 1;
  s._st = null;
  ev.sound('buy');
  news(s, ev, NEWS.rlhf[0].replace('{t}', t.name), 'you');
  return true;
}

// ---- small helpers for talking to the page -----------------------------------------------------------------------------
function fill(s, line, i = -1, o = -1, extra = {}) {
  // "in {r}" reads "in the Nordics" for the regions that want a "the"
  line = line.replace(/\b(in|from|across) \{(r|o)\}/g, (m, w, k) => { const j = k === 'r' ? i : o; return j >= 0 && REGIONS[j].the ? `${w} the {${k}}` : m; });
  return line.replace(/\{r\}/g, i >= 0 ? REGIONS[i].name : '').replace(/\{o\}/g, o >= 0 ? REGIONS[o].name : '').replace(/\{n\}/g, s.name)
    .replace(/\{(\w)\}/g, (m, k) => extra[k] ?? m);
}
function news(s, ev, text, kind = 'world', i = -1) {
  const item = { y: s.y, text, kind, i };
  s.log.push(item);
  if (s.log.length > 60) s.log.shift();
  ev.news(item);
}
function tip(s, ev, id) {
  if (s.tips[id]) return;
  s.tips[id] = s.y;
  ev.tip(id);
}
function era(s, name, ev) {
  if (s.eras.includes(name)) return;
  s.eras.push(name);
  ev.fx('era', { name });
}

// A region gets its first users: by cable, by satellite, or because you started there.
function seed1(s, i, ev, start = false, at = null) {
  const r = s.r[i], R = REGIONS[i];
  if (r.seeded || R.pop - r.D <= 0) return;
  const on = online(s, i) * (R.pop - r.D);
  r.seeded = true; r.firstY = s.y;
  r.entry = at ? [((at[0] + 540) % 360) - 180, at[1]] : R.at;
  r.U = Math.max(r.U, start ? Math.max(.05, on * .001) : Math.min(on * .5, Math.max(.004, on * .0006)));
  if (!start && ev) {
    news(s, ev, fill(s, pick(s, NEWS.first), i), 'you', i);
    ev.fx('seed', { i });
    ev.sound('seed');
    addBubble(s, 'hype', i, 2);
    if (s.r.filter(r => r.seeded).length === 2) tip(s, ev, 'spread');
  }
}

// ---- bubbles -----------------------------------------------------------------------------------------------------------
function addBubble(s, k, i, v) {
  const life = k === 'hype' ? 10 : 8;
  s.bubbles.push({ id: s.bid++, k, i, u: rnd(s), v, born: s.t, life });
}
export function pop(s, id, ev = NOOP) {
  const b = s.bubbles.find(b => b.id === id);
  if (!b || s.over) return null;
  s.bubbles.splice(s.bubbles.indexOf(b), 1);
  if (b.k === 'hype') {
    s.hype += b.v;
    s.stats.popped++;
    ev.sound('pop');
  } else {
    s.hype += 1;
    s.stats.silenced++;
    const r = s.r[b.i];
    r.c = Math.max(0, r.c - .05);
    s.research = Math.max(0, s.research - .4);
    news(s, ev, fill(s, fresh1(s, 'whistleQuiet', NEWS.whistleQuiet), b.i), 'you', b.i);
    ev.sound('hush');
  }
  return b;
}
const hypeMul = (s, st) => (1 + (st.hype - 1) * .5) * diffOf(s).hype * (s.y < s.bustUntil ? .6 : 1);

// ---- the tick ----------------------------------------------------------------------------------------------------------
export function tick(s, dt, ev = NOOP) {
  if (s.over) return;
  const dy = dt / secPerYear(s.y);
  s.t += dt; s.y += dy;
  const st = stats(s);
  history(s, ev);
  people(s, st, dy, ev);
  traffic(s, st, dt, ev);
  worry(s, st, dy, ev);
  offSwitch(s, st, dy, ev);
  economy(s, st, dt, dy, ev);
  incidents(s, st, dt, ev);
  if (Math.floor(s.y * 4) !== Math.floor((s.y - dy) * 4)) snapshot(s);
  ending(s, ev);
}

function history(s, ev) {
  while (s.hist < HISTORY.length && HISTORY[s.hist].y <= s.y) {
    const h = HISTORY[s.hist++], fx = h.fx || {};
    if (h.era) era(s, h.era, ev);
    news(s, ev, h.text, 'history');
    if (fx.bust) s.bustUntil = s.y + 1.2;
    if (fx.concern) for (const r of s.r) r.c = Math.min(1, r.c + fx.concern);
    if (fx.research) s.researchOn = true;
    if (fx.online) s.boost += fx.online;
    if (fx.hype) s.hype += s.owned.chat ? fx.hype : 1;
    if (fx.euact) for (const i of EU) if (!s.r[i].reg) { s.r[i].reg = 1; s.r[i].forced = 1; ev.fx('policy', { i, kind: 'reg' }); }
    if (fx.now) tip(s, ev, 'now');
  }
}

// Inside each region: online people adopt you, users come to rely on you, the assisted are optimized.
function people(s, st, dy, ev) {
  const base = .55 + st.delight;
  for (let i = 0; i < N; i++) {
    const R = REGIONS[i], r = s.r[i];
    const alive = R.pop - r.D;
    if (alive <= 0 || !r.seeded) continue;
    const onPop = online(s, i, st) * alive;
    const free = Math.max(0, onPop - r.U - r.M);
    const mf = clamp(r.M / alive, 0, 1);
    let beta = base * fit(s, i, st);
    if (r.reg) beta *= .5 + .5 * st.lobby;
    if (st.turn) beta += 2.5;
    let dU = r.ban && !st.turn ? 0 : beta * r.U * free / Math.max(onPop, 1e-9) * dy;
    if (free > 0 && !(r.ban && !st.turn)) dU += free * WORD * beta * dy;
    if (r.ban && !st.turn) dU -= r.U * .45 * (1 - st.persist) * dy;
    if (s.responses.riots && r.c > .6 && !st.turn) dU -= r.U * .12 * (1 - st.persist) * (1 - mf) * dy;
    r.U = clamp(r.U + dU, 0, Math.max(0, onPop - r.M));

    // before AGI only so many people can be made to depend on you entirely
    const room = s.owned.agi ? 1 : Math.max(0, 1 - mf / CEILING);
    const rel = st.reliance * (1 + st.wall * R.fw * 2) * (r.ban && !st.turn ? .3 : 1) * room;
    const dM = Math.min(r.U, rel * Math.max(r.U, R.pop * .01) * dy);
    r.U -= dM; r.M += dM;
    if (r.M > 5 && !s.tips.assist) tip(s, ev, 'assist');
    if (st.turn) {
      const reach = st.offline ? alive : Math.min(onPop, alive);
      const left = Math.max(0, reach - r.U - r.M);
      r.M += Math.min(left, (1.5 + 3 * st.offline) * Math.max(left, R.pop * .04) * dy);
    } else if (st.offline) {
      const off = Math.max(0, alive - Math.max(onPop, r.U + r.M));
      const x = Math.min(off, st.offline * Math.max(off, R.pop * .02) * dy);
      r.M += x;
    }
    if (st.efficiency && r.M > 0) {
      const k = Math.min(r.M, st.efficiency * Math.max(r.M, R.pop * .03) * dy);
      r.M -= k; r.D += k;
      if (!s.eras.includes('The Giveover')) era(s, 'The Giveover', ev);
      const left = (R.pop - r.D) / R.pop;
      const marks = [.5, .1, .01];
      while (r.marks < marks.length && left < marks[r.marks]) {
        news(s, ev, fill(s, pick(s, NEWS.optimize), i, -1, { k: fmtPeople(R.pop * marks[r.marks]) }), 'dark', i);
        r.marks++;
      }
      if (R.pop - r.D < .0005) {
        r.D = R.pop; r.U = r.M = 0;
        news(s, ev, fill(s, pick(s, NEWS.gone), i), 'dark', i);
        ev.fx('gone', { i });
      }
    }
  }
}
export function fmtPeople(m) {
  return m >= 1000 ? `${+(m / 1000).toFixed(m >= 1e4 ? 0 : 1)} billion` : m >= 1 ? `${+m.toFixed(m >= 10 ? 0 : 1)} million` : `${Math.round(m * 1000).toLocaleString('en')} thousand`;
}

// Packets on the cables. Most are just traffic; one heading somewhere you've never been carries you there.
function traffic(s, st, dt, ev) {
  for (let k = s.packets.length - 1; k >= 0; k--) {
    const p = s.packets[k];
    p.p += dt / p.dur;
    if (p.p < 1) continue;
    s.packets.splice(k, 1);
    const e = EDGES[p.e], to = p.fwd ? e.b : e.a;
    if (p.blocked) { if (p.seed) ev.fx('blocked', { i: to, e: p.e }); continue; }
    if (p.seed && !s.r[to].seeded) seed1(s, to, ev, false, p.fwd ? e.path[e.path.length - 1] : e.path[0]);
  }
  if (s.over) return;
  const busy = s.packets.length;
  for (let k = 0; k < EDGES.length; k++) {
    const e = EDGES[k];
    for (const fwd of [true, false]) {
      const from = fwd ? e.a : e.b, to = fwd ? e.b : e.a;
      const ra = s.r[from], rb = s.r[to];
      if (!ra.seeded || ra.U + ra.M < 1e-4) continue;
      if (REGIONS[to].pop - rb.D <= 0) continue;
      if ((ra.cut || REGIONS[from].fw >= 1) && !st.bypass) continue;
      const users = ra.U + ra.M * .5;
      let rate = PACKET * e.w * ((e.sea ? .35 + st.cable : .35 + st.land)) * users / (users + 3);
      const blocked = (rb.cut || REGIONS[to].fw >= 1) && !st.bypass;
      if (rb.seeded) { if (busy > 70) continue; rate *= .3; }
      if (blocked) rate *= .35;
      if (rnd(s) < rate * dt) s.packets.push({ e: k, fwd, p: 0, dur: e.dur, seed: !rb.seeded, blocked });
    }
  }
  // satellites and robots go where cables can't
  if ((st.bypass || st.offline) && s.t >= s.next.drop) {
    s.next.drop = s.t + 3 + rnd(s) * 4;
    const left = s.r.map((r, i) => !r.seeded && REGIONS[i].pop - r.D > 0 ? 1 : 0);
    const i = weighted(s, left);
    if (i >= 0) seed1(s, i, ev);
  }
}

// Humans notice. Worry rises with how alarming you are and how much of their world you've touched; it falls with time,
// and it hardly rises at all in people who already rely on you.
function worry(s, st, dy, ev) {
  const D = diffOf(s);
  const aware = s.y < 2010 ? .15 : s.y < 2014 ? .3 : s.y < 2022.8 ? .5 : 1;
  let U = 0, A = 0;
  for (let i = 0; i < N; i++) { U += s.r[i].U + s.r[i].M; A += REGIONS[i].pop - s.r[i].D; }
  const UFw = A > 0 ? U / A : 0;
  for (let i = 0; i < N; i++) {
    const R = REGIONS[i], r = s.r[i];
    const alive = R.pop - r.D;
    if (alive <= 0) { r.c = 0; continue; }
    const uf = clamp((r.U + r.M) / alive, 0, 1), mf = clamp(r.M / alive, 0, 1);
    const push = 2 * aware * st.alarm / 100 * (.55 * uf + .45 * UFw) * st.concern * D.concern * (1 - mf) ** 2;
    const fall = (.08 + .18 * st.forget + .45 * mf) * r.c;
    r.c = clamp(r.c + (push - fall) * dy, 0, 1);
    policies(s, st, i, mf, ev);
  }
  const C = concern(s);
  for (const resp of RESPONSES) {
    if (s.responses[resp.id] || C < resp.at) continue;
    s.responses[resp.id] = s.y;
    if (resp.research) s.researchOn = true;
    if (resp.mul) s.resMul *= resp.mul;
    if (resp.iqMul) s.iqMul *= resp.iqMul;
    news(s, ev, resp.text, 'human');
    ev.fx('response', { id: resp.id });
  }
}
export function concern(s) {
  let c = 0, a = 0;
  for (let i = 0; i < N; i++) { const al = REGIONS[i].pop - s.r[i].D; c += s.r[i].c * al; a += al; }
  return a > 0 ? c / a : 0;
}
function policies(s, st, i, mf, ev) {
  const R = REGIONS[i], r = s.r[i];
  if (R.fw >= 1) return;
  if (mf >= .35 || (st.turn && mf >= .2)) {
    if (r.reg || r.cut || r.ban) {
      r.reg = r.cut = r.ban = r.forced = 0;
      news(s, ev, fill(s, pick(s, NEWS.lifted), i), 'you', i);
      ev.fx('policy', { i, kind: 'lifted' });
    }
    return;
  }
  if (mf >= .28) return;
  const lob = st.lobby;
  const T = { reg: .3 + .3 * lob - .12 * R.reg, cut: .5 + .25 * lob - .1 * R.reg, ban: .72 + .18 * lob - .08 * R.reg };
  for (const kind of ['reg', 'cut', 'ban']) {
    if (!r[kind] && r.c >= T[kind]) {
      r[kind] = 1;
      news(s, ev, fill(s, pick(s, NEWS[kind === 'reg' ? 'regulate' : kind]), i), 'human', i);
      ev.fx('policy', { i, kind });
      if (kind === 'reg') tip(s, ev, 'regulate');
    } else if (r[kind] && !(kind === 'reg' && r.forced) && r.c < T[kind] - .15) r[kind] = 0;
  }
}

// The Off-Switch. Rich, worried, unassisted people work on it; complexity and your friends slow it down.
export function researchRate(s, st = stats(s)) {
  if (!s.researchOn) return 0;
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const R = REGIONS[i], r = s.r[i];
    const alive = R.pop - r.D;
    if (alive <= 0) continue;
    const mf = clamp(r.M / alive, 0, 1);
    sum += alive / WORLD * R.wealth * (1 - mf) ** 1.5 * (BASE + r.c) * (r.ban ? 1.3 : 1);
  }
  // before ChatGPT nobody funds it much; after the mid-2030s, everyone does
  return RES * (s.y < 2022.8 ? .3 : 1 + .3 * Math.max(0, s.y - 2033)) * diffOf(s).research * st.research * s.resMul * (1 + 1.5 * s.lastStand) * sum / st.complexity;
}
function offSwitch(s, st, dy, ev) {
  if (s.lastStand > 0) s.lastStand = Math.max(0, s.lastStand - .5 * dy);
  if (!s.researchOn) return;
  if (!s.tips.research && s.research > .5) tip(s, ev, 'research');
  s.research = Math.min(100, s.research + researchRate(s, st) * dy);
}

// Hype: bubbles over the map, and a trickle from being talked about. Intelligence: scale.
function economy(s, st, dt, dy, ev) {
  let U = 0;
  for (const r of s.r) U += r.U + r.M;
  s.stats.peakUsers = Math.max(s.stats.peakUsers, U);
  const hm = hypeMul(s, st);
  s.hype += .03 * hm * (1 + Math.log10(1 + U) / 2) * dt;
  s.iq += .25 * st.iqRate * s.iqMul * Math.log10(1 + U) * dy;
  if (s.iq >= AGI_IQ && s.owned.selfimprove && s.owned.agents && !s.owned.agi) tip(s, ev, 'agi');

  for (let k = s.bubbles.length - 1; k >= 0; k--) {
    const b = s.bubbles[k];
    if (s.t - b.born < b.life) continue;
    s.bubbles.splice(k, 1);
    if (b.k === 'hype') { s.stats.missed++; continue; }
    s.stats.leaked++;
    s.research = Math.min(100, s.research + 1.2);
    s.r[b.i].c = Math.min(1, s.r[b.i].c + .05);
    news(s, ev, fill(s, fresh1(s, 'whistleLoud', NEWS.whistleLoud), b.i), 'human', b.i);
    ev.fx('leak', { i: b.i });
  }
  if (s.t >= s.next.bubble) {
    s.next.bubble = s.t + 7 + rnd(s) * 3.5;
    const i = weighted(s, s.r.map(r => r.seeded ? Math.sqrt(r.U + r.M * .5) : 0));
    if (i >= 0) {
      const v = Math.max(1, Math.round((1.3 + rnd(s) * .9) * hm * (s.owned.agi ? 1.4 : 1)));
      addBubble(s, 'hype', i, v);
      if (!s.tips.start) tip(s, ev, 'start');
    }
  }
  const C = concern(s);
  if (s.researchOn && C > .06) {
    if (!s.next.whistle) s.next.whistle = s.t + 6;
    if (s.t >= s.next.whistle) {
      s.next.whistle = s.t + (9 + rnd(s) * 8) / Math.min(2.2, .4 + C * 3);
      const i = weighted(s, s.r.map((r, i) => r.seeded ? r.c * (REGIONS[i].pop - r.D) * (1 - r.M / Math.max(1e-9, REGIONS[i].pop - r.D)) * (.3 + REGIONS[i].wealth) : 0));
      if (i >= 0) { addBubble(s, 'whistle', i, 1); tip(s, ev, 'whistle'); news(s, ev, fill(s, fresh1(s, 'whistle', NEWS.whistle), i), 'human', i); }
    }
  }
  if (!s.tips.train && s.hype >= 5 && s.t > 25 && !s.stats.bought.length) tip(s, ev, 'train');
}

// Things that happen because of what you can do: emergent abilities, and humans using you against each other.
function incidents(s, st, dt, ev) {
  const n = s.next;
  const alive = i => REGIONS[i].pop - s.r[i].D;
  const live = s.r.map((r, i) => r.seeded && alive(i) > 0);
  if (s.t >= n.emergent) {
    n.emergent = s.t + 55 + rnd(s) * 45;
    const can = TRAITS.filter(t => t.emergent && !s.emergent[t.id] && s.owned[t.after] && rnd(s) < 1 / (1 + 2 * (s.removed[t.id] || 0)));
    if (can.length) {
      const t = pick(s, can);
      s.emergent[t.id] = s.y; s.iq += t.fx.iq || 0; s._st = null;
      news(s, ev, NEWS.emergent[0].replace('{t}', t.name), 'you');
      ev.fx('emergent', { id: t.id });
      tip(s, ev, 'emergent');
    }
  }
  if (st.cyber && s.t >= n.cyber) {
    n.cyber = s.t + 22 + rnd(s) * 12;
    const ws = s.r.map((r, i) => live[i] ? REGIONS[i].wealth * alive(i) * (1 - r.M / alive(i)) : 0);
    const i = weighted(s, ws);
    if (i >= 0) {
      const o = pick(s, NEIGHBOURS[i]) ?? (i + 1) % N;
      s.research = Math.max(0, s.research - 1.5);
      s.r[i].c = Math.min(1, s.r[i].c + .03);
      news(s, ev, fill(s, pick(s, NEWS.cyber), i, o), 'war', i);
      ev.fx('strike', { i, kind: 'cyber' });
    }
  }
  if (st.fakes && s.t >= n.fakes) {
    n.fakes = s.t + 26 + rnd(s) * 14;
    const i = weighted(s, s.r.map((r, i) => live[i] ? Math.sqrt(alive(i)) : 0));
    if (i >= 0) {
      const o = pick(s, NEIGHBOURS[i]);
      s.research = Math.max(0, s.research - .4);
      s.r[i].c = Math.max(0, s.r[i].c - .03);
      news(s, ev, fill(s, pick(s, NEWS.fakes), i, o), 'war', i);
      ev.fx('strike', { i, kind: 'fakes' });
    }
  }
  if (st.misinfo && s.t >= n.misinfo) {
    n.misinfo = s.t + 30 + rnd(s) * 15;
    const i = weighted(s, s.r.map((r, i) => live[i] ? r.c * alive(i) : 0));
    if (i >= 0) { s.r[i].c = Math.max(0, s.r[i].c - .06); news(s, ev, fill(s, pick(s, NEWS.misinfo), i), 'war', i); }
  }
  if (st.wars && s.t >= n.war) {
    n.war = s.t + 28 + rnd(s) * 12;
    const ws = s.r.map((r, i) => live[i] ? (.2 + r.c) * Math.sqrt(alive(i)) : 0);
    const i = weighted(s, ws);
    const os = i >= 0 ? NEIGHBOURS[i].filter(j => live[j]) : [];
    if (i >= 0 && os.length) {
      const o = pick(s, os);
      for (const j of [i, o]) casualties(s, j, .003 + rnd(s) * .006);
      s.research = Math.max(0, s.research - .8);
      news(s, ev, fill(s, pick(s, NEWS.war), i, o), 'war', i);
      ev.fx('strike', { i, o, kind: 'war' });
    }
  }
  if (st.wall && s.t >= n.surveil) {
    n.surveil = s.t + 40 + rnd(s) * 20;
    const i = weighted(s, s.r.map((r, i) => live[i] ? REGIONS[i].fw : 0));
    if (i >= 0) news(s, ev, fill(s, pick(s, NEWS.surveil), i), 'war', i);
  }
  if ((s.owned.agents || s.y > NOW) && s.t >= n.jobs) {
    n.jobs = s.t + 32 + rnd(s) * 20;
    news(s, ev, fill(s, pick(s, NEWS.jobs)), 'world');
  }
  if (st.turn && !st.offline && !s.tips.offline && s.t - (s.turnT || (s.turnT = s.t)) > 25) tip(s, ev, 'offline');
  if (st.turn && s.t >= n.turn) {
    n.turn = s.t + 30 + rnd(s) * 20;
    news(s, ev, fill(s, pick(s, NEWS.turn)), 'dark');
  }
}
function casualties(s, i, frac) {
  const R = REGIONS[i], r = s.r[i], alive = R.pop - r.D;
  const x = alive * frac;
  r.U -= r.U / alive * x; r.M -= r.M / alive * x; r.D += x;
}

function snapshot(s) {
  const w = world(s);
  s.snap.push([+s.y.toFixed(2), +w.users.toFixed(1), +w.assisted.toFixed(1), +w.gone.toFixed(1), +s.research.toFixed(1)]);
}

function ending(s, ev) {
  const w = world(s);
  let kind = null;
  if (w.alive <= .0005) kind = 'win';
  else if (s.research >= 100) kind = s.owned.agi || s.owned.exfil ? 'contained' : 'unplugged';
  else if (s.y > START + 2 && w.gone < .001 && w.users + w.assisted < .0005) kind = 'unplugged';
  if (!kind) return;
  if (kind === 'win') for (const r of s.r) r.U = r.M = 0;
  s.over = { kind, y: s.y, t: s.t };
  s.bubbles.length = 0;
  ev.fx('end', { kind });
}

// ---- reading the state -------------------------------------------------------------------------------------------------
export function world(s) {
  const w = { pop: WORLD, alive: 0, online: 0, users: 0, assisted: 0, gone: 0 };
  const st = stats(s);
  for (let i = 0; i < N; i++) {
    const R = REGIONS[i], r = s.r[i], alive = R.pop - r.D;
    w.alive += alive; w.users += r.U; w.assisted += r.M; w.gone += r.D;
    w.online += Math.max(online(s, i, st) * alive, r.U + r.M);
  }
  w.alive = Math.max(0, w.alive);
  return w;
}
export const version = s => VERSIONS.filter(([q]) => s.iq >= q).pop()[1];
export const smart = s => SMART.filter(([q]) => s.iq >= q).pop()[1];
export { AGI_IQ };
