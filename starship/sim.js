// The crew and everything that moves: who they are, their watches (eight hours on duty, eight off, eight
// asleep), what they choose to do, and how they get there (walking, ladders, lifts that queue calls, and the
// transporters). Plus the ship's cat, a cleaning droid, fighter patrols, malfunctions and FTL jumps.
// Time: one second of simulation is one minute of ship time.
import { rng, clamp } from './util.js';
import { makeLook } from './sprites.js';
import { WALK, CLIMB, LIFT_V, floorY } from './ship.js';

export const WATCHES = ['Alpha', 'Beta', 'Gamma'];
const WORK_START = [360, 840, 1320];
const FIRST = ['Mara', 'Tomas', 'Ines', 'Kofi', 'Yuki', 'Anya', 'Rafael', 'Priya', 'Dmitri', 'Lena', 'Obi', 'Sofia', 'Hamid', 'Noor', 'Jonah', 'Wen', 'Aroha',
  'Mateo', 'Ilse', 'Kwame', 'Freya', 'Tariq', 'Hana', 'Ezra', 'Leila', 'Soren', 'Amara', 'Diego', 'Mei', 'Rosa', 'Nikolai', 'Zainab', 'Oskar', 'Imani',
  'Callum', 'Teodora', 'Jin', 'Farah', 'Luca', 'Ada', 'Bram', 'Carmen', 'Dev', 'Elif', 'Gus', 'Hedda', 'Ivo', 'Juno', 'Kai', 'Lior', 'Marisol', 'Nils',
  'Orla', 'Pablo', 'Quinn', 'Rin', 'Sami', 'Tuva', 'Uma', 'Viktor', 'Wren', 'Xiadani', 'Yusuf', 'Zora', 'Beatriz', 'Chidi', 'Dagny', 'Emeka', 'Fatima'];
const LAST = ['Okafor', 'Voss', 'Nakamura', 'Reyes', 'Lindqvist', 'Haddad', 'Mensah', 'Kowalski', 'Park', 'Ferreira', 'Castellanos', 'Adeyemi', 'Ivanova',
  'Chen', 'Moreau', 'Singh', 'Tanaka', 'Oyelaran', 'Bergström', 'Nkemelu', 'Álvarez', 'Petrov', 'Kaur', 'Duarte', 'Hollis', 'Mbeki', 'Sato', "O'Connell",
  'Rahman', 'Varga', 'Delacroix', 'Achterberg', 'Quispe', 'Halvorsen', 'Zhang', 'Novak', 'Abara', 'Lowe', 'Marchetti', 'Takahashi', 'Kiplagat', 'Fontaine',
  'Iqbal', 'Rasmussen', 'Tembo', 'Ortega', 'Whitlock', 'Yilmaz', 'Brandt', 'Salazar', 'Nwosu', 'Kerr', 'Lindgren', 'Mahlangu', 'Ferro', 'Aydin'];
const SYL = ['ka', 'zor', 'vel', 'ith', 'ra', 'quo', 'zhi', 'tev', 'ull', 'mar', 'oss', 'yx', 'dra', 'nel', 'sha', 'kir', 'eon', 'thal', 'vex', 'ru'];
const RANKS = ['Captain', 'Commander', 'Lt. Commander', 'Lieutenant', 'Lt. (jg)', 'Ensign', 'Chief Petty Officer', 'Petty Officer', 'Crewman', 'Specialist'];
const SHORT = { Captain: 'Capt.', Commander: 'Cmdr.', 'Lt. Commander': 'Lt. Cmdr.', Lieutenant: 'Lt.', 'Lt. (jg)': 'Lt.', Ensign: 'Ens.', 'Chief Petty Officer': 'CPO',
  'Petty Officer': 'PO', Crewman: 'Crewman', Specialist: 'Spc.', Doctor: 'Dr.', Chief: 'Chief', Prisoner: 'Crewman' };
const HOBBIES = ['exercise', 'tv', 'games', 'music', 'drink', 'read', 'view', 'quiet', 'garden', 'chat', 'snack', 'practice'];
const LEISURE_LABEL = { exercise: 'working out', tv: 'watching a holovid', games: 'playing games', music: 'playing music', drink: 'at the bar', read: 'reading',
  view: 'watching the stars', quiet: 'meditating', garden: 'gardening', chat: 'chatting', snack: 'getting a snack', practice: 'at the range' };
const CRIMES = ['borrowing a shuttle without asking', 'running a still in the hydroponics bay', 'insubordination, mostly shouting', 'unauthorized use of the replicator',
  'teaching the ship’s cat to open doors', 'a card game that got out of hand'];

export function makeSim(ship, painted, seed, startMin) {
  const R = rng((seed ^ 0x51ed) >>> 0);
  const sim = {
    ship, R, t: startMin, crew: [], agents: [], parts: [], lifts: [], doors: painted.doors, stations: painted.stations, notices: [],
    warp: { phase: 'cruise', t: 0, next: startMin + R.range(150, 260), k: 0 }, nextMalf: startMin + R.range(40, 90), nextPatrol: startMin + R.range(20, 50),
    beamers: [], shiftShown: -1,
  };
  const S = painted.stations;
  const hangar = ship.hangar, fighters = hangar.fighters || [];
  sim.fighters = fighters;

  /* ---------- the crew roster, built from the stations that need people ---------- */
  // An even three watches. Each one first fills the posts that must never be empty, then spreads the rest
  // of its people across the ship, preferring rooms that nobody else is staffing yet.
  const beds = S.filter(s => s.bed), work = S.filter(s => s.dept);
  const nCrew = Math.min(beds.length, work.reduce((n, s) => n + s.watches.length, 0));
  const perWatch = [0, 1, 2].map(w => Math.floor(nCrew / 3) + (w < nCrew % 3 ? 1 : 0));
  const roomLoad = new Map(), taken = [];
  const take = (s, w) => { taken.push({ s, w }); roomLoad.set(s.room, (roomLoad.get(s.room) || 0) + 1); s.load = (s.load || 0) + 1; };
  for (const w of [0, 1, 2]) {
    const cands = work.filter(s => s.watches.includes(w));
    let n = 0;
    for (const s of cands.filter(s => s.crit || s.rank !== undefined)) if (n < perWatch[w]) { take(s, w); n++; }
    const rest = R.shuffle(cands.filter(s => !(s.crit || s.rank !== undefined)));
    while (n < perWatch[w] && rest.length) {
      rest.sort((a, b) => ((roomLoad.get(a.room) || 0) * 2 + (a.load || 0)) - ((roomLoad.get(b.room) || 0) * 2 + (b.load || 0)));
      take(rest.shift(), w); n++;
    }
  }
  const usedNames = new Set();
  const nameFor = alien => {
    for (;;) {
      const n = alien ? cap(R.pick(SYL) + R.pick(SYL) + (R.chance(.4) ? "'" + R.pick(SYL) : '')) + ' ' + cap(R.pick(SYL) + R.pick(SYL))
        : R.pick(FIRST) + ' ' + R.pick(LAST);
      if (!usedNames.has(n)) { usedNames.add(n); return n; }
    }
  };
  for (const p of taken) {
    const s = p.s, dept = s.dept;
    (s.manned || (s.manned = new Set())).add(p.w);
    const opts = {};
    if (dept === 'medical' && s.act === 'scan') opts.coat = true;
    if (dept === 'culinary' && (s.act === 'cook' || s.act === 'chop')) opts.style = 'toque';
    if (dept === 'flight' && R.chance(.5)) opts.style = 'cap', opts.hat = '#8a8f48';
    const look = makeLook(R, dept, opts);
    let rank;
    if (s.rank === 0) rank = ['Captain', 'Commander', 'Lt. Commander'][p.w];
    else if (s.rank === 1) rank = p.w === 0 ? 'Chief' : 'Lieutenant';
    else if (dept === 'medical' && s.act === 'scan') rank = 'Doctor';
    else rank = R.weighted([['Lieutenant', .6], ['Lt. (jg)', 1], ['Ensign', 2], ['Chief Petty Officer', .5], ['Petty Officer', 1.2], ['Crewman', 2.4], ['Specialist', .8]]);
    const c = {
      id: sim.crew.length, name: nameFor(look.isAlien), rank, dept, watch: p.w, duty: s, look,
      pilot: !!s.pilot, jit: R.range(-18, 4), hob: Object.fromEntries(HOBBIES.map(h => [h, R() * R() + (h === 'exercise' ? .25 : 0)])), ph: R() * 10,
      x: s.x, d: s.room.d1, y: floorY(s.room.d1), dir: 1, mode: 'idle', legs: null, li: 0, task: null, st: null, bed: null, ate: -1e9, showered: -1e9, coffee: -1e9,
      doing: '', where: '', frame: 0, walkT: 0, speak: null,
    };
    if (dept === 'security') c.hob.practice += .6;
    if (!(s.act === 'guitar')) c.hob.music *= R.chance(.25) ? 1 : 0;
    sim.crew.push(c);
  }
  // captain gets the captain's bed, officers the cabins, everyone else the nearest bunk to their post
  const isOfficer = c => ['Captain', 'Commander', 'Lt. Commander', 'Lieutenant', 'Doctor', 'Chief'].includes(c.rank);
  const freeBeds = beds.slice();
  const takeBed = (c, pred) => {
    const cand = freeBeds.filter(pred);
    if (!cand.length) return false;
    cand.sort((a, b) => dist(a, c.duty) - dist(b, c.duty));
    c.bed = cand[0]; c.bed.ownerCrew = c; freeBeds.splice(freeBeds.indexOf(c.bed), 1);
    return true;
  };
  const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.room.d1 - b.room.d1) * 90;
  for (const c of sim.crew.filter(c => c.rank === 'Captain')) takeBed(c, b => b.owner === 'captain');
  for (const c of sim.crew.filter(isOfficer)) if (!c.bed) takeBed(c, b => b.owner === 'officer');
  // bunkmates tend to share a watch: fill quarters watch by watch
  for (const w of [0, 1, 2]) for (const c of sim.crew.filter(c => !c.bed && c.watch === w)) takeBed(c, b => b.owner === 'crew') || takeBed(c, () => true);
  // anyone's desk in their own cabin belongs to them
  for (const c of sim.crew) if (c.bed && c.bed.room) for (const s of c.bed.room.stations) if (s.use === 'desk') s.ownerCrew = c;
  // a prisoner in the brig, and the ship's cat and a cleaning droid
  const brig = ship.rooms.find(r => r.type === 'brig');
  if (brig && brig.cells) {
    const look = makeLook(R, 'operations'); look.top = '#d8762a'; look.topShade = '#a0521a'; look.badge = '#d8762a';
    const cell = brig.cells[1];
    sim.prisoner = { id: sim.crew.length, name: nameFor(false), rank: 'Prisoner', dept: 'prisoner', look, cell, x: cell.bench, d: brig.d1, y: floorY(brig.d1), dir: 1, mode: 'cell', crime: R.pick(CRIMES), doing: 'pacing the cell', where: 'Brig', cellT: 0 };
  }
  sim.cat = { kind: 'cat', name: R.pick(['Biscuit', 'Nebula', 'Pickles', 'Admiral', 'Mochi', 'Tuna', 'Comet', 'Pip', 'Sergeant', 'Noodle']), col: R.pick([['#e0913a', '#a85e1a'], ['#2a2a30', '#15151a'], ['#b8b0a8', '#7a726a'], ['#e8e0d0', '#b8a890']]),
    x: 0, d: 0, y: 0, dir: 1, mode: 'idle', legs: null, li: 0, doing: '', where: '', speed: 12, next: 0 };
  sim.droid = { kind: 'droid', name: 'MOP-' + R.int(2, 9), x: 0, d: 0, y: 0, dir: 1, mode: 'idle', legs: null, li: 0, doing: 'tidying up', where: '', speed: 9, next: 0 };
  sim.agents = [sim.cat, sim.droid];

  /* ---------- lifts ---------- */
  for (const s of ship.shafts) {
    const d0 = s.stops[Math.floor(R() * s.stops.length)].d;
    sim.lifts.push({ s, x: s.x + 17.5, y: floorY(d0), d: d0, v: 0, state: 'idle', t: 0, riders: [], waiting: new Map(), dir: 0, target: null });
  }
  sim.liftOf = sh => sim.lifts.find(l => l.s === sh);

  /* ---------- helpers ---------- */
  const tod = () => ((sim.t % 1440) + 1440) % 1440;
  sim.tod = tod;
  // everyone keeps the watch a few minutes differently, so a change of watch is a trickle rather than a stampede
  sim.block = c => { const rel = ((tod() - WORK_START[c.watch] - (c.jit || 0)) % 1440 + 1440) % 1440; return rel < 480 ? 'work' : rel < 960 ? 'off' : rel < 1410 ? 'sleep' : 'wake'; };
  sim.blockEnd = c => { const rel = ((tod() - WORK_START[c.watch] - (c.jit || 0)) % 1440 + 1440) % 1440; const edge = rel < 480 ? 480 : rel < 960 ? 960 : rel < 1410 ? 1410 : 1440; return sim.t + (edge - rel); };
  const free = s => !s.occ && !s.res;
  const the = r => /^the /i.test(r.name) ? r.name.replace(/^The/, 'the') : 'the ' + r.name.toLowerCase();
  sim.the = the;
  const onWatch = () => Math.floor(((tod() - 360 + 1440) % 1440) / 480);
  const spare = s => !s.manned || !s.manned.has(onWatch());
  const roomOf = c => { const r = ship.roomAt(c.d, c.x); return r; };
  sim.notice = text => { sim.notices.push({ t: sim.t, text }); if (sim.notices.length > 30) sim.notices.shift(); };

  /* ---------- deciding what to do next ---------- */
  function release(c) { if (c.st) { if (c.st.occ === c) c.st.occ = null; if (c.st.res === c) c.st.res = null; c.st = null; } }
  function nearestFree(c, pred, spread = 3) {
    const cand = S.filter(s => pred(s) && free(s) && spare(s));
    if (!cand.length) return null;
    cand.sort((a, b) => cost(c, a) - cost(c, b));
    return cand[Math.floor(R() * Math.min(spread, cand.length))];
  }
  const cost = (c, s) => Math.abs(s.x - c.x) + Math.abs(s.room.d1 - c.d) * 120;
  function assign(c, s, until, label, extra) {
    const task = { kind: 'station', s, until, label: label || s.label, blk: (extra && extra.blk) || sim.block(c), ...extra };
    if (c.st === s && s.occ === c && c.mode === 'act') { c.task = task; c.doing = task.label; return true; }   // already here
    release(c);
    s.res = c; c.st = s;
    c.task = task;
    c.late = s === c.duty && sim.block(c) === 'work';
    c.doing = (c.late ? 'hurrying' : 'heading') + ' to ' + the(s.room);
    return goTo(c, s.room.d1, s.x);
  }
  function think(c) {
    if (c.mode === 'flying') return;
    const b = sim.block(c), end = sim.blockEnd(c), now = sim.t;
    c.task = null;
    if (c.repair) { const r = c.repair; release(c); c.task = { kind: 'repair', room: r, label: 'repairing ' + the(r) }; c.doing = 'rushing to fix ' + the(r); if (goTo(c, r.d1, r.panel.x)) return; c.repair = null; }
    if (b === 'sleep' && c.bed) return assign(c, c.bed, end, 'asleep', { blk: 'sleep' }) || idle(c);
    if (b === 'wake') {
      if (now - c.coffee > 600) { const s = nearestFree(c, s => s.use === 'coffee' || s.use === 'eat'); if (s) { c.coffee = now; c.ate = now; return assign(c, s, Math.min(end, now + R.range(10, 18)), s.use === 'eat' ? 'grabbing breakfast' : 'getting a coffee') || idle(c); } }
      return goDuty(c, end + R.range(40, 120), 'work');
    }
    if (b === 'work') {
      if (c.pilot && sim.patrolFor === c) return goPatrol(c);
      if (R.chance(.1) && now - c.coffee > 150) { const s = nearestFree(c, s => ['coffee', 'snack', 'hygiene'].includes(s.use)); if (s) { c.coffee = now; return assign(c, s, now + R.range(8, 16), s.use === 'hygiene' ? 'freshening up' : 'on a quick break') || idle(c); } }
      if (c.dept === 'security' && R.chance(.16)) return goPatrolWalk(c, end);
      if (c.dept === 'engineering' && R.chance(.14)) { const r = R.pick(ship.rooms.filter(r => r.panel && r.type !== 'junction')); if (r) { release(c); c.task = { kind: 'inspect', room: r, until: now + R.range(15, 35), label: 'running diagnostics in ' + the(r) }; c.doing = 'heading to ' + the(r); if (goTo(c, r.d1, r.panel.x)) return; } }
      if (c.dept === 'operations' && c.duty.room.type === 'cargo' && R.chance(.35)) return goCarry(c, end);
      return goDuty(c, Math.min(end, now + R.range(60, 150)));
    }
    // off duty
    if (now - c.ate > 250) { const s = nearestFree(c, s => s.use === 'eat', 5); if (s) { c.ate = now; return assign(c, s, Math.min(end, now + R.range(24, 40)), 'eating', { queue: true }) || idle(c); } }
    if (end - now < 50 && now - c.showered > 600) { const s = nearestFree(c, s => s.use === 'hygiene', 4); if (s) { c.showered = now; return assign(c, s, Math.min(end, now + R.range(10, 18)), s.label) || idle(c); } }
    if (end - now < 20) { if (c.bed) return assign(c, c.bed, end + 450, 'asleep', { blk: 'sleep' }) || idle(c); }
    const own = S.find(s => s.use === 'desk' && s.ownerCrew === c);
    const opts = HOBBIES.map(h => [h, c.hob[h] + .05]);
    if (own) opts.push(['desk', .35]);
    opts.push(['home', .25], ['chores', .12], ['checkup', .04]);
    for (let tries = 0; tries < 5; tries++) {
      const u = R.weighted(opts);
      let s = null;
      if (u === 'desk') s = own && free(own) ? own : null;
      else if (u === 'home') s = c.bed ? c.bed.room.stations.find(s => s.home && free(s)) : null;
      else if (u === 'chat') s = nearestFree(c, s => s.use === 'chat' || s.use === 'drink', 6);
      else s = nearestFree(c, s => s.use === u || (u === 'games' && s.use === 'tv'), 6);
      if (s) return assign(c, s, Math.min(end, now + R.range(28, 90)), s.label) || idle(c);
    }
    return idle(c);
  }
  function goDuty(c, until, blk) {
    const s = c.duty;
    if (s.occ && s.occ !== c) { // someone from the last watch is still here: wait nearby for the handover
      release(c); c.task = { kind: 'handover', s, until, blk }; c.doing = 'waiting to take over'; return goTo(c, s.room.d1, clamp(s.x + (s.dir || 1) * -8, s.room.x0 + 4, s.room.x1 - 4));
    }
    return assign(c, s, until, s.label, blk ? { blk } : undefined) || idle(c);
  }
  function idle(c) {
    release(c);
    const r = roomOf(c);
    c.task = { kind: 'idle', until: sim.t + R.range(4, 12) };
    c.mode = 'idle'; c.doing = r && r.type === 'junction' ? 'waiting' : 'standing around';
    return true;
  }
  function goPatrolWalk(c, end) {
    const pts = R.shuffle(ship.rooms.filter(r => r.type !== 'junction' && !r.stations.some(s => s.bed))).slice(0, 3);
    release(c);
    c.task = { kind: 'patrol', pts, i: 0, until: Math.min(end, sim.t + 90), label: 'on patrol' };
    return nextPatrolPoint(c);
  }
  function nextPatrolPoint(c) {
    const t = c.task, r = t.pts[t.i++];
    if (!r || sim.t > t.until) { think(c); return true; }
    c.doing = 'on patrol, checking ' + the(r);
    return goTo(c, r.d1, (r.x0 + r.x1) / 2 + R.range(-10, 10)) || think(c);
  }
  function goCarry(c, end) {
    const store = R.pick(ship.rooms.filter(r => r.type === 'storage' || r.type === 'galley' || r.type === 'workshop'));
    if (!store) return goDuty(c, end);
    release(c);
    c.task = { kind: 'carry', to: store, back: c.duty, stage: 0, label: 'hauling supplies' };
    c.carry = true; c.doing = 'carrying a crate to ' + the(store);
    return goTo(c, store.d1, (store.x0 + store.x1) / 2);
  }
  function goPatrol(c) {
    const f = sim.patrolFighter;
    release(c); sim.patrolFor = null;
    c.task = { kind: 'fly', f, label: 'flying a patrol' };
    c.doing = 'walking out to fighter ' + (f.id + 1);
    return goTo(c, hangar.d1, f.x);
  }
  sim.think = think;

  /* ---------- moving ---------- */
  // lifts with a queue cost more, so people take the ladders when the lifts are busy
  const liftLoad = sh => { const L = sim.liftOf(sh); let q = 0; for (const v of L.waiting.values()) q += v.length; return q * 3 + L.riders.length; };
  function goTo(c, d, x) {
    const legs = ship.path(c.d, c.x, d, x, liftLoad);
    if (!legs) return false;
    c.legs = legs; c.li = -1; c.mode = 'walk';
    nextLeg(c);
    return true;
  }
  sim.goTo = goTo;
  function nextLeg(c) {
    c.li++;
    const L = c.legs[c.li];
    if (!L) { c.legs = null; return arrive(c); }
    if (L.k === 'walk') { c.mode = 'walk'; c.tx = L.x; }
    else if (L.k === 'ladder') { c.mode = 'ladder'; c.x = L.x; c.ty = floorY(L.to); c.ld = L.to; }
    else if (L.k === 'lift') {
      const lift = sim.liftOf(L.shaft);
      c.mode = 'liftwait'; c.x = lift.x + (c.kind ? 0 : (c.id % 3 - 1) * 3); c.lift = lift; c.dest = L.to;
      if (!lift.waiting.has(c.d)) lift.waiting.set(c.d, []);
      lift.waiting.get(c.d).push(c);
    } else if (L.k === 'beam') { c.mode = 'beamout'; c.bt = 0; c.beam = L; L.from.pads[0].beam = 1; }
  }
  function arrive(c) {
    if (c.kind) { c.mode = 'rest'; return; }
    const t = c.task;
    if (!t) return think(c);
    if (t.kind === 'station' || t.kind === 'handover') {
      const s = t.s;
      if (t.kind === 'handover') { c.mode = 'wait'; c.wt = 3; return; }
      if (s.occ && s.occ !== c) { c.mode = 'wait'; c.wt = 4; c.waited = (c.waited || 0) + 1; if (c.waited > 5) { c.waited = 0; think(c); } return; }
      c.waited = 0;
      s.occ = c; s.res = null; c.st = s;
      c.mode = 'act'; c.x = s.x; c.y = s.y; c.dir = s.dir || 1; c.actT = 0;
      c.doing = t.label; c.where = s.room.name;
      if (t.queue) { c.mode = 'queue'; c.qt = R.range(3, 6); c.y = floorY(s.room.d1); const m = s.room.counter; if (m) { c.mode = 'walkq'; c.tx = m; } }
      return;
    }
    if (t.kind === 'patrol') { c.mode = 'pause'; c.pt = R.range(6, 14); c.dir = R.chance(.5) ? 1 : -1; return; }
    if (t.kind === 'inspect' || t.kind === 'repair') { c.mode = 'act'; c.actT = 0; c.x = t.room.panel.x; c.y = floorY(t.room.d1); c.dir = 1; c.doing = t.label; c.where = t.room.name; t.until = t.until || sim.t + 999; return; }
    if (t.kind === 'carry') {
      if (t.stage === 0) { t.stage = 1; c.carry = false; c.doing = 'heading back to ' + the(t.back.room); return goTo(c, t.back.room.d1, t.back.x) || think(c); }
      return think(c);
    }
    if (t.kind === 'fly') { boardFighter(c, t.f); return; }
    return think(c);
  }

  /* ---------- a fighter patrol ---------- */
  function boardFighter(c, f) {
    if (f.state !== 'parked') return think(c);
    c.mode = 'flying'; c.doing = 'flying a patrol'; c.where = 'Outside the ship';
    f.pilot = c; f.state = 'boarding'; f.t = 0;
    sim.notice(`${short(c)} launches on patrol in fighter ${f.id + 1}.`);
  }
  function stepFighters(dt) {
    const bay = hangar.bay; if (!bay) return;
    const bayX = bay.x + bay.w / 2, fl = bay.y;
    for (const f of fighters) {
      f.t += dt;
      switch (f.state) {
        case 'boarding': if (f.t > 1.2) { f.state = 'lift'; f.t = 0; } break;
        case 'lift': f.y = fl - Math.min(4, f.t * 4); if (f.t > 1.2) { f.state = 'taxi'; f.t = 0; } break;
        case 'taxi': { const dx = bayX - f.x; f.x += Math.sign(dx) * Math.min(Math.abs(dx), 14 * dt); if (Math.abs(dx) < .5 && (!sim.bayUser || sim.bayUser === f)) { sim.bayUser = f; f.state = 'open'; f.t = 0; } break; }
        case 'open': bay.open = Math.min(1, bay.open + dt * 1.2); if (bay.open >= 1) { f.state = 'drop'; f.t = 0; } break;
        case 'drop': f.y += 10 * dt; if (f.y > fl + 18) { f.state = 'fly'; f.t = 0; f.vx = 6; } break;
        case 'fly': bay.open = Math.max(0, bay.open - dt); if (bay.open <= 0 && sim.bayUser === f) sim.bayUser = null; f.vx = Math.min(140, f.vx + 40 * dt); f.x += f.vx * dt; f.y += 4 * dt; if (f.x > ship.width + 120) { f.state = 'away'; f.t = 0; f.away = R.range(40, 90); } break;
        case 'away': if (f.t > f.away) { f.state = 'return'; f.t = 0; f.x = -120; f.y = fl + 40; f.vx = 120; } break;
        case 'return': { const dx = bayX - f.x; f.vx = Math.max(10, Math.min(120, dx * .6)); f.x = Math.min(bayX, f.x + f.vx * dt); f.y += (fl + 20 - f.y) * Math.min(1, dt * 2); if (dx < .5 && (!sim.bayUser || sim.bayUser === f)) { sim.bayUser = f; f.x = bayX; f.state = 'openup'; f.t = 0; } break; }
        case 'openup': bay.open = Math.min(1, bay.open + dt * 1.2); if (bay.open >= 1) { f.state = 'rise'; f.t = 0; } break;
        case 'rise': f.y -= 9 * dt; if (f.y <= fl - 4) { f.y = fl - 4; f.state = 'home'; f.t = 0; } break;
        case 'home': { bay.open = Math.max(0, bay.open - dt); if (bay.open <= 0 && sim.bayUser === f) sim.bayUser = null; const dx = f.home - f.x; f.x += Math.sign(dx) * Math.min(Math.abs(dx), 14 * dt); if (Math.abs(dx) < .5) { f.state = 'land'; f.t = 0; } break; }
        case 'land': f.y = Math.min(fl, f.y + 4 * dt); if (f.y >= fl) { f.state = 'parked'; f.t = 0; const c = f.pilot; f.pilot = null; if (c) { c.mode = 'idle'; c.x = f.x + 10; c.d = hangar.d1; c.y = fl; c.task = null; sim.notice(`${short(c)} is back from patrol.`); think(c); } } break;
      }
    }
    if (sim.t > sim.nextPatrol) {
      sim.nextPatrol = sim.t + R.range(70, 150);
      const out = fighters.some(f => f.state !== 'parked');
      const f = !out && fighters.find(f => f.state === 'parked'), p = sim.crew.find(c => c.pilot && c.st && c.st.pilot && c.mode === 'act' && sim.block(c) === 'work');
      if (f && p) { sim.patrolFighter = f; sim.patrolFor = p; think(p); }
    }
  }

  /* ---------- lifts ---------- */
  const CAP = 6;
  function stepLift(L, dt) {
    // decks to drop riders at, and decks with people waiting that we have room for
    const want = new Set(), drop = new Set();
    for (const c of L.riders) { want.add(c.dest); drop.add(c.dest); }
    if (L.riders.length < CAP) for (const [d, q] of L.waiting) if (q.length) want.add(d);
    if (L.state === 'doors') {
      L.t -= dt;
      const q = L.waiting.get(L.d) || [];
      while (q.length && L.riders.length < CAP) board(L, q.shift());
      if (L.t <= 0) { L.state = 'idle'; L.closed = L.d; }
    } else if (L.state === 'idle') {
      const here = drop.has(L.d) || (want.has(L.d) && (L.closed !== L.d || want.size === 1));
      if (here) return open(L);
      want.delete(L.d);
      if (want.size) {
        L.closed = null;
        const ds = [...want].sort((a, b) => Math.abs(a - L.d) - Math.abs(b - L.d));
        const ahead = ds.filter(d => L.dir === 0 || Math.sign(d - L.d) === L.dir);
        L.target = (ahead[0] ?? ds[0]); L.dir = Math.sign(L.target - L.d); L.state = 'move';
      } else L.dir = 0;
    } else if (L.state === 'move') {
      const ty = floorY(L.target), dy = ty - L.y, a = 140;
      L.v = Math.min(LIFT_V, L.v + a * dt, Math.sqrt(2 * a * Math.abs(dy)) + 2);
      const step = Math.sign(dy) * Math.min(Math.abs(dy), L.v * dt);
      L.y += step;
      for (let d = 0; d < ship.N; d++) if (Math.abs(floorY(d) - L.y) < 1) L.d = d;
      if (Math.abs(ty - L.y) < .01) { L.y = ty; L.d = L.target; L.v = 0; open(L); }
    }
    for (const [i, c] of L.riders.entries()) { c.x = L.x + (i % 3 - 1) * 3; c.y = L.y; c.d = L.d; }
  }
  function open(L) {
    L.state = 'doors'; L.t = 1.6;
    for (const c of L.riders.slice()) if (c.dest === L.d) {
      L.riders.splice(L.riders.indexOf(c), 1);
      c.d = L.d; c.y = floorY(L.d); c.x = L.x; c.mode = 'walk'; c.lift = null;
      nextLeg(c);
    }
  }
  function board(L, c) { L.riders.push(c); c.mode = 'lift'; }

  /* ---------- malfunctions ---------- */
  function stepMalf() {
    if (sim.t < sim.nextMalf) return;
    sim.nextMalf = sim.t + R.range(60, 140);
    const sys = ship.rooms.filter(r => r.panel && r.badge && !r.broken && r.type !== 'bridge');
    if (!sys.length) return;
    const r = R.pick(sys);
    const eng = sim.crew.filter(c => (c.dept === 'engineering' || c.dept === 'operations') && sim.block(c) === 'work' && ['act', 'idle', 'wait', 'pause'].includes(c.mode) && !c.repair);
    if (!eng.length) return;
    eng.sort((a, b) => (Math.abs(a.x - r.panel.x) + Math.abs(a.d - r.d1) * 120) - (Math.abs(b.x - r.panel.x) + Math.abs(b.d - r.d1) * 120));
    const c = eng[0];
    r.broken = { p: 0, crew: c };
    c.repair = r;
    sim.notice(`${r.name}: a relay has blown. ${short(c)} is on it.`);
    think(c);
  }

  /* ---------- the cat and the droid wander ---------- */
  function wander(a) {
    const rooms = ship.rooms.filter(r => r.type !== 'junction' && r.type !== 'engine' && (a.kind === 'cat' || !r.stations.some(s => s.bed)));
    const r = R.pick(rooms);
    const x = R.range(r.x0 + 6, r.x1 - 6);
    a.doing = a.kind === 'cat' ? 'wandering towards ' + the(r) : 'trundling to ' + the(r);
    const legs = ship.path(a.d, a.x, r.d1, x, liftLoad);
    if (!legs) { a.next = sim.t + 5; return; }
    a.legs = legs; a.li = -1; a.mode = 'walk'; nextLeg(a);
    a.dest = r;
  }
  function stepAgent(a, dt) {
    if (a.mode === 'rest') {
      if (!a.restUntil) { a.restUntil = sim.t + (a.kind === 'cat' ? R.range(20, 80) : R.range(4, 12)); a.pose = a.kind === 'cat' ? R.pick(['sit', 'sleep', 'sleep']) : 'clean'; const r = ship.roomAt(a.d, a.x); a.where = r ? r.name : ''; a.doing = a.kind === 'cat' ? (a.pose === 'sleep' ? 'napping' : 'sitting very still') : 'cleaning the floor'; }
      if (sim.t > a.restUntil) { a.restUntil = 0; wander(a); }
      return;
    }
    moveAlong(a, dt, a.speed);
  }

  /* ---------- per-frame movement ---------- */
  function moveAlong(c, dt, speed) {
    switch (c.mode) {
      case 'walk': case 'walkq': {
        const dx = c.tx - c.x, v = speed * dt;
        c.y = floorY(c.d);
        const r = ship.roomAt(c.d, c.x); if (r) c.where = r.name;
        if (Math.abs(dx) <= v) { c.x = c.tx; if (c.mode === 'walkq') { c.mode = 'queue'; c.dir = -1; break; } nextLeg(c); }
        else { c.x += Math.sign(dx) * v; c.dir = Math.sign(dx); c.walkT += v; }
        break;
      }
      case 'ladder': {
        const dy = c.ty - c.y, v = CLIMB * dt;
        if (Math.abs(dy) <= v) { c.y = c.ty; c.d = c.ld; nextLeg(c); } else { c.y += Math.sign(dy) * v; c.walkT += v; }
        c.where = 'On a ladder';
        break;
      }
      case 'beamout': c.bt += dt; if (c.bt > 1.2) { const to = c.beam.to; c.d = to.d1; c.x = to.pads[0].x; c.y = floorY(to.d1); to.pads[0].beam = 1; c.mode = 'beamin'; c.bt = 0; c.where = to.name; } break;
      case 'beamin': c.bt += dt; if (c.bt > 1.2) nextLeg(c); break;
      case 'lift': c.where = 'In the lift'; break;
      case 'liftwait': c.dir = 1; break;
    }
  }

  /* ---------- the prisoner paces ---------- */
  function stepPrisoner(p, dt) {
    const c = p.cell, night = ((tod() - 1320 + 1440) % 1440) < 420;
    if (night) { p.mode = 'sleep'; p.x = c.bench; p.y = c.y; p.doing = 'asleep on the bench'; return; }
    p.cellT -= dt;
    if (p.mode === 'sleep' || p.mode === 'cell') { p.mode = 'pace'; p.tx = c.x0 + 2; }
    if (p.mode === 'pace') {
      const dx = p.tx - p.x, v = 7 * dt;
      p.y = floorY(p.d);
      if (Math.abs(dx) <= v) { p.x = p.tx; if (p.cellT <= 0) { p.mode = 'sitb'; p.cellT = R.range(10, 30); p.x = c.bench; p.y = c.y + 2; p.doing = 'sulking on the bench'; } else p.tx = p.tx < (c.x0 + c.x1) / 2 ? c.x1 - 2 : c.x0 + 2; }
      else { p.x += Math.sign(dx) * v; p.dir = Math.sign(dx); p.walkT = (p.walkT || 0) + v; p.doing = 'pacing the cell'; }
    } else if (p.cellT <= 0) { p.mode = 'pace'; p.cellT = R.range(15, 40); p.y = floorY(p.d); }
  }

  /* ---------- FTL jumps ---------- */
  function stepWarp(dt) {
    const w = sim.warp;
    if (w.phase === 'cruise' && sim.t > w.next) { w.phase = 'spool'; w.t = 0; sim.notice('FTL drive charged. Jumping to the next beacon.'); }
    w.t += dt;
    if (w.phase === 'spool') { w.k = Math.min(1, w.t / 4) * .2; if (w.t > 4) { w.phase = 'jump'; w.t = 0; } }
    else if (w.phase === 'jump') { w.k = Math.min(1, .2 + w.t / 1.2); if (w.t > 12) { w.phase = 'arrive'; w.t = 0; } }
    else if (w.phase === 'arrive') { w.k = Math.max(0, 1 - w.t / 1.5); if (w.t > 1.5) { w.phase = 'cruise'; w.t = 0; w.k = 0; w.next = sim.t + R.range(200, 320); sim.jumps = (sim.jumps || 0) + 1; sim.notice('Dropped out of FTL. All systems nominal.'); } }
  }
  sim.jumpNow = () => { if (sim.warp.phase === 'cruise') sim.warp.next = sim.t; };
  sim.charge = () => sim.warp.phase === 'cruise' ? clamp(1 - (sim.warp.next - sim.t) / 260, 0, 1) : 1;

  /* ---------- the frame ---------- */
  sim.update = dt => {
    sim.t += dt;
    const shift = Math.floor(((tod() - 360 + 1440) % 1440) / 480);
    if (shift !== sim.shiftShown) { if (sim.shiftShown >= 0) sim.notice(`${WATCHES[shift]} watch has the deck.`); sim.shiftShown = shift; }
    for (const L of sim.lifts) stepLift(L, dt);
    for (const c of sim.crew) {
      switch (c.mode) {
        case 'act': {
          c.actT += dt;
          const t = c.task;
          if (t && t.kind === 'repair') { const b = t.room.broken; if (b) { b.p += dt / 30; if (b.p >= 1) { t.room.broken = null; c.repair = null; sim.notice(`${t.room.name} is back online.`); think(c); } } else { c.repair = null; think(c); } break; }
          if (t && t.until !== undefined && sim.t >= t.until) think(c);
          else if (t && t.kind === 'station' && sim.block(c) !== blockOfTask(c)) think(c);
          break;
        }
        case 'queue': c.qt -= dt; if (c.qt <= 0) { c.mode = 'walk'; c.legs = [{ k: 'walk', d: c.d, x: c.task.s.x }]; c.li = -1; nextLeg(c); c.task.queue = false; } break;
        case 'wait': c.wt -= dt; if (c.wt <= 0) { if (c.task && c.task.kind === 'handover') { if (!c.task.s.occ || c.task.s.occ === c) assign(c, c.task.s, c.task.until, c.task.s.label, c.task.blk ? { blk: c.task.blk } : undefined); else c.wt = 3; } else arrive(c); } break;
        case 'pause': c.pt -= dt; if (c.pt <= 0) nextPatrolPoint(c); break;
        case 'idle': if (!c.task || sim.t >= c.task.until) think(c); break;
        case 'liftwait': c.waitT = (c.waitT || 0) + dt; if (c.waitT > 60) { c.waitT = 0; const q = c.lift.waiting.get(c.d); if (q && q.includes(c)) q.splice(q.indexOf(c), 1); think(c); } break;
        default: moveAlong(c, dt, c.late ? WALK * 1.6 : WALK);
      }
      if (c.mode !== 'liftwait') c.waitT = 0;
    }
    for (const a of sim.agents) { if (a.mode === 'idle') wander(a); else stepAgent(a, dt); }
    if (sim.prisoner) stepPrisoner(sim.prisoner, dt);
    stepFighters(dt);
    stepMalf();
    stepWarp(dt);
    // doors open for anyone walking up to them
    for (const D of sim.doors) {
      let near = false;
      for (const c of sim.crew) if (c.d === D.d && Math.abs(c.x - D.x) < 9 && (c.mode === 'walk' || c.mode === 'walkq')) { near = true; break; }
      if (!near) for (const a of sim.agents) if (a.d === D.d && Math.abs(a.x - D.x) < 7 && a.mode === 'walk') { near = true; break; }
      D.open = clamp(D.open + (near ? dt * 6 : -dt * 2.5), 0, 1);
    }
    for (const r of ship.rooms) if (r.pads) for (const p of r.pads) p.beam = Math.max(0, p.beam - dt * .5);
  };
  const blockOfTask = c => c.task.blk || sim.block(c);

  /* ---------- start: everyone already somewhere sensible ---------- */
  for (const c of sim.crew) {
    const b = sim.block(c), end = sim.blockEnd(c);
    let s = null, label = '';
    if (b === 'sleep') s = c.bed, label = 'asleep';
    else if (b === 'work') s = c.duty, label = c.duty.label;
    else { const pool = S.filter(s => s.use && s.use !== 'sleep' && s.use !== 'desk' && s.use !== 'checkup' && free(s)); s = R.pick(pool); label = s && s.label; }
    if (!s || !free(s)) { c.x = c.duty.x + R.range(-6, 6); c.d = c.duty.room.d1; c.y = floorY(c.d); idle(c); c.task.until = sim.t + R.range(1, 10); continue; }
    c.d = s.room.d1; c.x = s.x;
    s.occ = c; c.st = s; c.mode = 'act'; c.y = s.y; c.dir = s.dir || 1; c.actT = R.range(0, 20);
    c.task = { kind: 'station', s, until: Math.min(end, sim.t + R.range(3, b === 'off' ? 70 : 140)), label, blk: b };
    c.doing = label; c.where = s.room.name;
    if (b === 'off' && s.use === 'eat') c.ate = sim.t;
  }
  for (const a of sim.agents) { const r = R.pick(ship.rooms.filter(r => r.type !== 'junction')); a.d = r.d1; a.x = R.range(r.x0 + 6, r.x1 - 6); a.y = floorY(r.d1); a.mode = 'rest'; }
  return sim;
}

export function short(c) { return (SHORT[c.rank] || c.rank) + ' ' + c.name.split(' ').slice(-1)[0]; }
export function title(c) { return (SHORT[c.rank] || c.rank) + ' ' + c.name; }
const cap = s => s[0].toUpperCase() + s.slice(1);
export { WORK_START };
