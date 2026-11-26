// Chat Dungeon: the rules. No DOM here, so the page, the bot and the Node sims all drive the same thing.
export const T = 40, COLS = 16, ROWS = 10, W = COLS * T, H = ROWS * T;
export const POOL_MAX = 20;
export const POOL_RATE = 0.6;            // mischief per second
export const COST = { bat: 2, goblin: 3, slime: 3, skeleton: 4, trap: 3, bless: 5, curse: 6 };
export const VOTE_TIME = 6;
export const FLOORS = 5, ROOMS = 4;      // floor 5 is the shrine and the boss
export const CHAT_CAP = 5;               // chat-spawned monsters alive at once
export const USER_COOLDOWN = 4;

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const KINDS = {
  bat:       { hp: 1, r: 9,  speed: 112 },
  goblin:    { hp: 3, r: 12, speed: 80 },
  slime:     { hp: 4, r: 15, speed: 0 },
  minislime: { hp: 1, r: 9,  speed: 0 },
  skeleton:  { hp: 2, r: 12, speed: 70 },
  dummy:     { hp: 1e9, r: 14, speed: 0 },
  boss:      { hp: 40, r: 32, speed: 62 },
};
const WAVE_COST = { bat: 1, goblin: 2, slime: 2, skeleton: 3 };

export const RELICS = {
  sword: { name: 'Big Sword',   text: 'Your swings hit twice as hard.' },
  heart: { name: 'Heart Jar',   text: 'One more heart, and a heal.' },
  boots: { name: 'Quick Boots', text: 'Your dash comes back twice as fast.' },
  spin:  { name: 'Spin Charm',  text: 'Your swing goes all the way round.' },
  hat:   { name: 'Lucky Hat',   text: "Half of chat's curses fizzle." },
  cape:  { name: 'Spiky Cape',  text: 'Anything that bumps into you gets hurt.' },
};
export const CURSES = {
  fog:       { name: 'Fog',       dur: 7, text: "can't see past your nose" },
  slippery:  { name: 'Butter',    dur: 7, text: 'the floor is buttered' },
  backwards: { name: 'Backwards', dur: 4, text: 'your controls are backwards' },
};
export const ROOM_NAMES = { fight: 'Monster room', elite: 'Elite room', treasure: 'Treasure room', shrine: 'Shrine', boss: 'The Ban Ogre', tutorial: 'The green room' };

// obstacles inside the 14×8 floor (cols 1-14, rows 1-8); rows 1, 2 and 8 stay clear for the doors
const LAYOUTS = [
  [],
  [[4, 4], [11, 4], [4, 6], [11, 6]],
  [[7, 4], [8, 4], [7, 5], [8, 5]],
  [[3, 5], [4, 5], [5, 5], [10, 4], [11, 4], [12, 4]],
  [[5, 4], [10, 4], [5, 6], [10, 6], [2, 3], [13, 3]],
  [[7, 3], [8, 3], [3, 6], [12, 6]],
];
export const FORK_DOORS = [3, 11], ONE_DOOR = 7;   // first column of each two-tile door in the top wall

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hyp = Math.hypot;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export class Game {
  constructor({ seed = (Math.random() * 1e9) | 0, tutorial = false, floor = 1 } = {}) {
    this.seed = seed;
    this.rand = mulberry(seed);
    this.tutorial = tutorial;
    this.time = 0;
    this.pool = tutorial ? 0 : 3;
    this.poolOn = !tutorial;
    this.chatOn = !tutorial;
    this.ev = [];
    this.over = null; this.overT = 0;
    this.hitstop = 0;
    this.curse = null;
    this.cool = new Map();
    this.stats = { kills: 0, rooms: 0, users: {}, hits: 0, start: 0 };
    this.p = { x: W / 2, y: H - T * 1.6, r: 11, hp: 5, max: 5, shield: 0, fx: 0, fy: -1, vx: 0, vy: 0, inv: 0,
      dashT: 0, dashCd: 0, dx: 0, dy: 0, swingT: 0, swingCd: 0, swingA: 0, hitSet: null, relics: {}, walk: 0 };
    this.floor = floor; this.roomIdx = 0;
    this.dummyHits = 0;
    this.enterRoom(tutorial ? 'tutorial' : (floor >= FLOORS ? 'shrine' : 'fight'));
  }

  r() { return this.rand(); }
  pick(a) { return a[(this.rand() * a.length) | 0]; }
  user(name) { return this.stats.users[name] ||= { spawns: 0, dmg: 0, heals: 0, curses: 0, traps: 0, votes: 0, slain: 0 }; }

  // ---------------------------------------------------------------- rooms
  enterRoom(type) {
    const solid = new Uint8Array(COLS * ROWS);
    for (let c = 0; c < COLS; c++) { solid[c] = 1; solid[(ROWS - 1) * COLS + c] = 1; }
    for (let r = 0; r < ROWS; r++) { solid[r * COLS] = 1; solid[r * COLS + COLS - 1] = 1; }
    let layout = [];
    if (type === 'fight' || type === 'elite') layout = this.pick(LAYOUTS);
    else if (type === 'boss') layout = [[3, 3], [12, 3], [3, 6], [12, 6]];
    for (const [c, r] of layout) solid[r * COLS + c] = 1;
    const isLastOfFloor = this.floor < FLOORS && this.roomIdx === ROOMS - 1;
    let next = 'fork';
    if (type === 'tutorial') next = 'fork';
    else if (type === 'boss') next = 'win';
    else if (this.floor >= FLOORS) next = 'boss';
    else if (isLastOfFloor) next = 'stairs';
    const doors = next === 'fork' ? FORK_DOORS.map(c0 => ({ c0, type: null, votes: 0 })) : next === 'win' ? [] : [{ c0: ONE_DOOR, type: next, votes: 0 }];
    if (next === 'fork') {
      const pool = [['fight', 4], ['elite', this.floor === 1 && this.roomIdx === 0 ? 0.6 : 2], ['treasure', 2], ['shrine', 1.4]];
      const a = this.weighted(pool), b = this.weighted(pool.filter(p => p[0] !== a));
      doors[0].type = a; doors[1].type = b;
      if (type === 'tutorial') { doors[0].type = 'fight'; doors[1].type = 'treasure'; }
    }
    const waves = type === 'fight' ? (this.floor === 1 && this.roomIdx === 0 ? 1 : 2) : type === 'elite' ? 2 : 0;
    this.room = { type, solid, doors, next, waves, waveN: 0, waveWait: 0.9, phase: type === 'tutorial' ? 'tutorial' : 'fight',
      votes: new Map(), voteT: VOTE_TIME, choice: -1, chest: null, shrine: null, age: 0, clearT: 0 };
    if (type === 'treasure') this.room.chest = { x: W / 2, y: H / 2 - 10, open: false };
    if (type === 'shrine') this.room.shrine = { x: W / 2, y: H / 2 - 10, used: false };
    this.ents = []; this.pending = []; this.shots = []; this.traps = []; this.pickups = []; this.spikes = [];
    const p = this.p;
    p.x = W / 2; p.y = H - T * 1.55; p.vx = p.vy = 0; p.dashT = 0; p.fx = 0; p.fy = -1; p.swingT = 0;
    p.inv = Math.max(p.inv, 0.6);
    if (type === 'boss') this.spawnNow('boss', W / 2, T * 3.2, null);
    this.ev.push({ t: 'room', type, floor: this.floor, idx: this.roomIdx });
  }

  weighted(list) {
    let s = 0; for (const [, w] of list) s += w;
    let x = this.r() * s;
    for (const [k, w] of list) { x -= w; if (x <= 0) return k; }
    return list[list.length - 1][0];
  }

  solidAt(c, r) { if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true; return this.room.solid[r * COLS + c] === 1; }
  doorOpen(i) {
    const rm = this.room;
    if (rm.phase !== 'open' || this.ents.length || this.pending.length) return false;
    return rm.next === 'fork' ? rm.choice === i : true;
  }

  leaveRoom() {
    const rm = this.room;
    this.stats.rooms++;
    let type;
    if (rm.type === 'tutorial') { this.ev.push({ t: 'tutorialDone' }); return; }
    if (rm.next === 'stairs') { this.floor++; this.roomIdx = 0; type = this.floor >= FLOORS ? 'shrine' : 'fight'; this.ev.push({ t: 'floor', floor: this.floor }); }
    else if (rm.next === 'boss') { this.roomIdx++; type = 'boss'; }
    else { this.roomIdx++; type = rm.doors[rm.choice].type; }
    this.curse = null;
    this.enterRoom(type);
  }

  // ---------------------------------------------------------------- spawning
  freeSpot(minD = 150) {
    const p = this.p;
    for (let i = 0; i < 60; i++) {
      const c = 1 + ((this.r() * (COLS - 2)) | 0), r = 1 + ((this.r() * (ROWS - 3)) | 0);
      if (this.solidAt(c, r)) continue;
      const x = (c + 0.5) * T, y = (r + 0.5) * T;
      if (hyp(x - p.x, y - p.y) < minD - i * 1.5) continue;
      return { x, y };
    }
    return { x: W / 2, y: T * 2 };
  }
  // the nearest spot to (x, y) that a pickup can sit on without touching a wall
  openSpot(x, y) {
    let best = { x, y }, bd = 1e9;
    for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
      if (this.solidAt(c, r)) continue;
      const cx = (c + 0.5) * T, cy = (r + 0.5) * T, d = hyp(cx - x, cy - y);
      if (d < bd) { bd = d; best = { x: cx, y: cy }; }
    }
    const c = Math.floor(x / T), r = Math.floor(y / T);
    if (!this.solidAt(c, r) && x > T * 1.4 && x < W - T * 1.4 && y > T * 1.4 && y < H - T * 1.4) return { x, y };
    return best;
  }
  summon(kind, chat = null, elite = false, at = null) {
    const s = at || this.freeSpot();
    this.pending.push({ kind, x: s.x, y: s.y, t: 0.75, chat, elite });
    this.ev.push({ t: 'summon', kind, x: s.x, y: s.y, chat });
  }
  spawnNow(kind, x, y, chat, elite = false) {
    const k = KINDS[kind];
    const e = { kind, x, y, r: k.r * (elite ? 1.4 : 1), hp: k.hp * (elite ? 3 : 1), max: k.hp * (elite ? 3 : 1), speed: k.speed * (elite ? 0.9 : 1),
      chat, elite, vx: 0, vy: 0, kx: 0, ky: 0, stun: 0, flash: 0, st: 'go', st2: 0, t: this.r() * 2, cd: 1 + this.r(), ax: 0, ay: 0, seed: (this.r() * 1e6) | 0, age: 0 };
    if (kind === 'boss') { e.st = 'intro'; e.st2 = 1.6; e.phase = 0; }
    this.ents.push(e);
    return e;
  }
  spawnWave() {
    const rm = this.room;
    let budget = (this.floor === 1 ? 2 : Math.round(1.5 + this.floor * 1.25)) + (rm.waveN === 1 ? 1 : 0);
    const kinds = this.floor === 1 ? ['bat', 'goblin', 'slime'] : ['bat', 'goblin', 'slime', 'skeleton'];
    if (rm.type === 'elite' && rm.waveN === 0) {
      this.summon(this.pick(['goblin', 'slime', 'skeleton']), null, true);
      budget -= 3;
    }
    let guard = 0;
    while (budget > 0 && guard++ < 20) {
      const k = this.pick(kinds);
      if (WAVE_COST[k] > budget) { if (budget >= 1) { this.summon('bat'); budget -= 1; } continue; }
      this.summon(k); budget -= WAVE_COST[k];
    }
    rm.waveN++; rm.waves--;
  }

  // ---------------------------------------------------------------- chat commands
  // returns { ok, why } — why is one of: jar, crowded, cooldown, busy, full, already, fizzle, closed, unknown
  command(user, verb, arg) {
    verb = (verb || '').toLowerCase(); arg = (arg || '').toLowerCase();
    const rm = this.room;
    if (this.paused) return { ok: false, why: 'closed' };
    if (['vote', 'left', 'right', '1', '2', 'l', 'r'].includes(verb)) {
      if (rm.phase !== 'vote' && !(rm.phase === 'tutorialVote')) return { ok: false, why: 'closed' };
      const side = verb === 'vote' ? arg : verb;
      const v = ['left', 'l', '1'].includes(side) ? 0 : ['right', 'r', '2'].includes(side) ? 1 : -1;
      if (v < 0) return { ok: false, why: 'unknown' };
      if (!rm.votes.has(user)) this.user(user).votes++;
      rm.votes.set(user, v);
      this.ev.push({ t: 'vote', user, v });
      return { ok: true, vote: v };
    }
    let kind = null;
    if (verb === 'spawn') kind = arg.replace(/s$/, '');
    else if (KINDS[verb] && WAVE_COST[verb]) kind = verb;
    else if (verb === 'skelly' || verb === 'skeli') kind = 'skeleton';
    if (verb === 'spawn' && (kind === 'skelly' || kind === 'skele')) kind = 'skeleton';
    const what = kind || verb;
    if (!COST[what]) return { ok: false, why: 'unknown' };
    if (!this.chatOn || this.over || rm.age < 1.5 && rm.type !== 'tutorial' || rm.type === 'boss' && this.ents[0]?.st === 'intro') return { ok: false, why: 'closed' };
    if (kind && !WAVE_COST[kind]) return { ok: false, why: 'unknown' };
    const last = this.cool.get(user);
    if (last != null && this.time - last < USER_COOLDOWN) return { ok: false, why: 'cooldown' };
    if (this.pool < COST[what]) return { ok: false, why: 'jar' };
    const u = this.user(user);
    if (kind) {
      const n = this.ents.filter(e => e.chat).length + this.pending.filter(e => e.chat).length;
      if (n >= CHAT_CAP) return { ok: false, why: 'crowded' };
      this.summon(kind, user);
      u.spawns++;
    } else if (what === 'trap') {
      if (this.traps.filter(t => t.t > 0).length >= 2) return { ok: false, why: 'busy' };
      const p = this.p;
      this.traps.push({ x: clamp(p.x + p.vx * 0.35, T * 1.5, W - T * 1.5), y: clamp(p.y + p.vy * 0.35, T * 1.5, H - T * 1.5), r: 30, t: 1.05, up: 0, user });
      u.traps++;
    } else if (what === 'bless') {
      const p = this.p;
      if (p.hp >= p.max && p.shield) return { ok: false, why: 'full' };
      if (p.hp < p.max) { p.hp++; this.ev.push({ t: 'bless', user, kind: 'heal' }); }
      else { p.shield = 1; this.ev.push({ t: 'bless', user, kind: 'shield' }); }
      u.heals++;
    } else if (what === 'curse') {
      if (this.curse) return { ok: false, why: 'already' };
      this.pool -= COST.curse; this.cool.set(user, this.time);
      if (this.p.relics.hat && this.r() < 0.5) { this.ev.push({ t: 'fizzle', user }); return { ok: true, fizzle: true }; }
      const kinds = Object.keys(CURSES);
      const kind2 = this.pick(kinds);
      this.curse = { kind: kind2, t: CURSES[kind2].dur, dur: CURSES[kind2].dur, user };
      u.curses++;
      this.ev.push({ t: 'curse', user, kind: kind2 });
      return { ok: true, curse: kind2 };
    }
    this.pool -= COST[what];
    this.cool.set(user, this.time);
    return { ok: true };
  }

  // ---------------------------------------------------------------- damage
  hurtPlayer(src, user, fromX, fromY) {
    const p = this.p;
    if (p.inv > 0 || p.dashT > 0 || this.over) return false;
    if (src && src.hp != null && p.relics.cape && src.kind !== 'boss') this.hurtEnemy(src, 1, Math.atan2(src.y - p.y, src.x - p.x));
    const a = Math.atan2(p.y - fromY, p.x - fromX);
    p.vx += Math.cos(a) * 160; p.vy += Math.sin(a) * 160;
    if (p.shield) { p.shield = 0; p.inv = 0.8; this.ev.push({ t: 'block', x: p.x, y: p.y }); return true; }
    p.hp--; p.inv = 1.0; this.hitstop = 0.09; this.stats.hits++;
    if (user) this.user(user).dmg++;
    if (this.tutorial && p.hp < 1) p.hp = 1;
    this.ev.push({ t: 'hurt', x: p.x, y: p.y, user, hp: p.hp });
    if (p.hp <= 0) { this.over = 'dead'; this.overT = 0; this.ev.push({ t: 'die', user }); }
    return true;
  }

  hurtEnemy(e, dmg, ang) {
    if (e.hp <= 0) return;
    if (e.kind === 'dummy') { this.dummyHits++; e.flash = 0.12; e.wob = 1; this.ev.push({ t: 'hit', x: e.x, y: e.y, dmg, kind: e.kind }); this.hitstop = 0.04; return; }
    const boss = e.kind === 'boss';
    if (boss && e.st === 'dizzy') dmg *= 2;
    e.hp -= dmg; e.flash = 0.12;
    const kb = boss ? 40 : e.elite ? 150 : 250;
    e.kx = Math.cos(ang) * kb; e.ky = Math.sin(ang) * kb;
    if (!boss) { e.stun = 0.2; if (e.st === 'wind' || e.st === 'aim') { e.st = 'go'; e.cd = 0.6; } }
    this.hitstop = Math.max(this.hitstop, 0.045);
    this.ev.push({ t: 'hit', x: e.x, y: e.y, dmg, kind: e.kind, chat: e.chat, big: dmg > 1 });
    if (e.hp <= 0) this.kill(e, ang);
  }

  kill(e, ang) {
    e.hp = 0; e.dead = true;
    this.stats.kills++;
    if (this.poolOn) this.pool = Math.min(POOL_MAX, this.pool + 0.4);   // every kill riles chat up a little
    if (e.chat) this.user(e.chat).slain++;
    this.hitstop = Math.max(this.hitstop, e.kind === 'boss' ? 0.4 : 0.085);
    this.ev.push({ t: 'kill', x: e.x, y: e.y, kind: e.kind, chat: e.chat, elite: e.elite, r: e.r });
    if (e.kind === 'slime') {
      for (const s of [-1, 1]) {
        const m = this.spawnNow('minislime', e.x + Math.cos(ang + s * 1.6) * 10, e.y + Math.sin(ang + s * 1.6) * 10, e.chat);
        m.kx = Math.cos(ang + s * 0.9) * 200; m.ky = Math.sin(ang + s * 0.9) * 200; m.stun = 0.35; m.cd = 0.8;
      }
    }
    if (e.kind === 'boss') { this.ents = this.ents.filter(x => x === e); this.pending = []; this.shots = []; }
    if (!e.chat && e.kind !== 'boss' && e.kind !== 'minislime' && this.r() < 0.06 && this.p.hp < this.p.max) this.pickups.push({ kind: 'heart', ...this.openSpot(e.x, e.y), t: 0 });
  }

  // ---------------------------------------------------------------- physics helpers
  collide(o) {
    const r = o.r;
    const c0 = Math.floor((o.x - r) / T), c1 = Math.floor((o.x + r) / T), r0 = Math.floor((o.y - r) / T), r1 = Math.floor((o.y + r) / T);
    let hit = false;
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
      if (!this.solidAt(cc, rr)) continue;
      if (rr === 0 && o === this.p && this.room.doors.some((d, i) => cc >= d.c0 && cc <= d.c0 + 1 && this.doorOpen(i))) continue;
      const nx = clamp(o.x, cc * T, cc * T + T), ny = clamp(o.y, rr * T, rr * T + T);
      let dx = o.x - nx, dy = o.y - ny, d = hyp(dx, dy);
      if (d >= r) continue;
      hit = true;
      if (d < 1e-4) { // centre inside the tile: push out along the shortest axis
        const L = o.x - cc * T, R = cc * T + T - o.x, U = o.y - rr * T, D = rr * T + T - o.y, m = Math.min(L, R, U, D);
        if (m === L) o.x = cc * T - r; else if (m === R) o.x = cc * T + T + r; else if (m === U) o.y = rr * T - r; else o.y = rr * T + T + r;
        continue;
      }
      o.x = nx + dx / d * r; o.y = ny + dy / d * r;
    }
    return hit;
  }
  move(o, dx, dy) {
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8) || 1;
    let hit = false;
    for (let i = 0; i < steps; i++) { o.x += dx / steps; o.y += dy / steps; if (this.collide(o)) hit = true; }
    return hit;
  }
  los(ax, ay, bx, by) {
    const d = hyp(bx - ax, by - ay), n = Math.ceil(d / 12);
    for (let i = 1; i < n; i++) { const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n; if (this.solidAt(Math.floor(x / T), Math.floor(y / T))) return false; }
    return true;
  }

  // ---------------------------------------------------------------- the frame
  // inp: { mx, my (−1..1), attack (held), dash (pressed this frame), aim: {x,y} | null }
  tick(dt, inp) {
    if (this.over) { this.overT += dt; this.updateFxOnly(dt); return; }
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.time += dt;
    const rm = this.room;
    rm.age += dt;
    // chat warms up as the stream goes on
    if (this.poolOn && rm.phase !== 'tutorial') this.pool = Math.min(POOL_MAX, this.pool + POOL_RATE * (0.6 + 0.1 * Math.min(5, this.floor)) * dt);
    if (this.curse) { this.curse.t -= dt; if (this.curse.t <= 0) { this.ev.push({ t: 'uncurse', kind: this.curse.kind }); this.curse = null; } }
    this.updatePlayer(dt, inp);
    this.updatePending(dt);
    for (const e of this.ents) this.updateEnemy(e, dt);
    this.ents = this.ents.filter(e => !e.dead);
    this.separate();
    this.updateShots(dt);
    this.updateTraps(dt);
    this.updatePickups(dt);
    this.updateRoom(dt);
  }
  updateFxOnly(dt) { for (const t of this.traps) t.up = Math.max(0, t.up - dt); }

  updatePlayer(dt, inp) {
    const p = this.p;
    p.inv = Math.max(0, p.inv - dt); p.dashCd = Math.max(0, p.dashCd - dt); p.swingCd = Math.max(0, p.swingCd - dt);
    let mx = inp.mx || 0, my = inp.my || 0;
    const m = hyp(mx, my); if (m > 1) { mx /= m; my /= m; }
    if (this.curse?.kind === 'backwards') { mx = -mx; my = -my; }
    if (m > 0.15) { p.fx = mx / Math.max(m, 1e-3); p.fy = my / Math.max(m, 1e-3); const n = hyp(p.fx, p.fy); p.fx /= n; p.fy /= n; }
    if (inp.dash && p.dashCd <= 0 && p.dashT <= 0) {
      let dx = mx, dy = my; if (hyp(dx, dy) < 0.2) { dx = p.fx; dy = p.fy; }
      const n = hyp(dx, dy) || 1; p.dx = dx / n; p.dy = dy / n;
      p.dashT = 0.17; p.dashCd = p.relics.boots ? 0.42 : 0.85;
      this.ev.push({ t: 'dash', x: p.x, y: p.y });
    }
    const SPEED = 152;
    if (p.dashT > 0) {
      p.dashT -= dt; p.vx = p.dx * 440; p.vy = p.dy * 440;
    } else {
      const tx = mx * SPEED, ty = my * SPEED;
      const k = this.curse?.kind === 'slippery' ? 2.2 : 22;
      p.vx += (tx - p.vx) * Math.min(1, k * dt); p.vy += (ty - p.vy) * Math.min(1, k * dt);
    }
    this.move(p, p.vx * dt, p.vy * dt);
    p.walk += hyp(p.vx, p.vy) * dt;
    // swing
    if (inp.attack && p.swingCd <= 0) {
      let a = Math.atan2(p.fy, p.fx);
      if (inp.aim) a = Math.atan2(inp.aim.y - p.y, inp.aim.x - p.x);
      else {
        let best = null, bd = 120;
        for (const e of this.ents) { const d = hyp(e.x - p.x, e.y - p.y) - e.r; if (d < bd) { bd = d; best = e; } }
        if (best) a = Math.atan2(best.y - p.y, best.x - p.x);
      }
      p.swingA = a; p.swingT = 0.2; p.swingCd = 0.33; p.hitSet = new Set();
      if (!p.dashT) { p.fx = Math.cos(a); p.fy = Math.sin(a); }
      this.ev.push({ t: 'swing', x: p.x, y: p.y, a, spin: !!p.relics.spin });
      // a chest or shrine you swing at counts as touched
    }
    if (p.swingT > 0) {
      p.swingT -= dt;
      if (p.swingT > 0.07) {
        const reach = 44, dmg = p.relics.sword ? 2 : 1;
        for (const e of this.ents) {
          if (p.hitSet.has(e) || e.dead) continue;
          const d = hyp(e.x - p.x, e.y - p.y);
          if (d - e.r > reach) continue;
          const a = Math.atan2(e.y - p.y, e.x - p.x);
          if (!p.relics.spin && Math.abs(angDiff(a, p.swingA)) > 1.25 && d > e.r + 6) continue;
          p.hitSet.add(e);
          this.hurtEnemy(e, dmg, a);
        }
        const rm = this.room;
        if (rm.chest && !rm.chest.open && hyp(rm.chest.x - p.x, rm.chest.y - p.y) < 60) this.openChest();
      }
    }
  }

  updatePending(dt) {
    for (const s of this.pending) {
      s.t -= dt;
      if (s.t <= 0) { const e = this.spawnNow(s.kind, s.x, s.y, s.chat, s.elite); e.cd = 0.5 + this.r() * 0.6; this.ev.push({ t: 'appear', x: s.x, y: s.y, kind: s.kind, chat: s.chat }); }
    }
    this.pending = this.pending.filter(s => s.t > 0);
  }

  updateEnemy(e, dt) {
    const p = this.p;
    e.age += dt; e.t += dt; e.flash = Math.max(0, e.flash - dt); if (e.wob) e.wob = Math.max(0, e.wob - dt * 3);
    const dx = p.x - e.x, dy = p.y - e.y, d = hyp(dx, dy) || 1, ux = dx / d, uy = dy / d;
    if (e.stun > 0) {
      e.stun -= dt;
      this.move(e, e.kx * dt, e.ky * dt); e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt);
      return;
    }
    if (e.kind === 'boss') { this.move(e, e.kx * dt, e.ky * dt); e.kx *= Math.pow(0.01, dt); e.ky *= Math.pow(0.01, dt); return this.updateBoss(e, dt, ux, uy, d); }
    let vx = 0, vy = 0;
    e.cd -= dt;
    switch (e.kind) {
      case 'dummy': return;
      case 'bat': {
        const w = Math.sin(e.t * 4 + e.seed) * 0.9;
        vx = (ux - uy * w) * e.speed; vy = (uy + ux * w) * e.speed;
        if (e.cd < 0 && d < 140) { e.cd = 1.6 + this.r(); e.ax = ux; e.ay = uy; e.st2 = 0.3; }
        if (e.st2 > 0) { e.st2 -= dt; vx = e.ax * 200; vy = e.ay * 200; }
        break;
      }
      case 'goblin': {
        if (e.st === 'go') {
          vx = ux * e.speed; vy = uy * e.speed;
          if (d < 78 && e.cd <= 0 && this.los(e.x, e.y, p.x, p.y)) { e.st = 'wind'; e.st2 = e.elite ? 0.5 : 0.42; e.ax = ux; e.ay = uy; this.ev.push({ t: 'wind', x: e.x, y: e.y }); }
        } else if (e.st === 'wind') {
          e.st2 -= dt; vx = -e.ax * 14; vy = -e.ay * 14;
          if (e.st2 <= 0) { e.st = 'lunge'; e.st2 = 0.24; }
        } else if (e.st === 'lunge') {
          e.st2 -= dt; vx = e.ax * 290; vy = e.ay * 290;
          if (e.st2 <= 0) { e.st = 'go'; e.cd = 0.9 + this.r() * 0.6; }
        }
        break;
      }
      case 'slime': case 'minislime': {
        if (e.st === 'go' && e.cd <= 0) { e.st = 'hop'; e.st2 = 0.36; e.ax = ux; e.ay = uy; }
        if (e.st === 'hop') {
          e.st2 -= dt; const sp = e.kind === 'slime' ? 150 : 175;
          vx = e.ax * sp; vy = e.ay * sp;
          if (e.st2 <= 0) { e.st = 'go'; e.cd = (e.kind === 'slime' ? 0.9 : 0.6) + this.r() * 0.4; this.ev.push({ t: 'splat', x: e.x, y: e.y, small: e.kind !== 'slime' }); }
        }
        break;
      }
      case 'skeleton': {
        const see = this.los(e.x, e.y, p.x, p.y);
        if (e.st === 'go') {
          if (d < 130) { vx = -ux * e.speed; vy = -uy * e.speed; }
          else if (d > 230 || !see) { vx = ux * e.speed; vy = uy * e.speed; }
          else { const s = Math.sin(e.seed) > 0 ? 1 : -1; vx = -uy * s * e.speed * 0.6; vy = ux * s * e.speed * 0.6; }
          if (e.cd <= 0 && see && d < 330) { e.st = 'aim'; e.st2 = 0.55; this.ev.push({ t: 'aim', x: e.x, y: e.y }); }
        } else if (e.st === 'aim') {
          e.st2 -= dt;
          if (e.st2 <= 0) {
            const a = Math.atan2(dy, dx);
            const n = e.elite ? 3 : 1;
            for (let i = 0; i < n; i++) { const aa = a + (i - (n - 1) / 2) * 0.22; this.shots.push({ x: e.x + Math.cos(aa) * 14, y: e.y + Math.sin(aa) * 14, vx: Math.cos(aa) * 205, vy: Math.sin(aa) * 205, r: 5, kind: 'arrow', user: e.chat, t: 0 }); }
            this.ev.push({ t: 'shoot', x: e.x, y: e.y });
            e.st = 'go'; e.cd = 2.0 + this.r() * 0.8;
          }
        }
        break;
      }
    }
    // a little knockback still applies when not stunned
    vx += e.kx; vy += e.ky; e.kx *= Math.pow(0.02, dt); e.ky *= Math.pow(0.02, dt);
    e.vx = vx; e.vy = vy;
    this.move(e, vx * dt, vy * dt);
    // contact
    if (e.kind !== 'dummy' && d < e.r + p.r - 3 && e.age > 0.25) this.hurtPlayer(e, e.chat, e.x, e.y);
  }

  updateBoss(e, dt, ux, uy, d) {
    const p = this.p;
    e.st2 -= dt;
    const frac = e.hp / e.max;
    if (e.phase === 0 && frac < 0.67 || e.phase === 1 && frac < 0.34) {
      if (e.st === 'walk' || e.st === 'rest') { e.phase++; e.st = 'roar'; e.st2 = 1.1; this.ev.push({ t: 'roar', x: e.x, y: e.y }); }
    }
    switch (e.st) {
      case 'intro': if (e.st2 <= 0) { e.st = 'walk'; e.st2 = 1.2; } break;
      case 'walk': {
        this.move(e, ux * e.speed * dt, uy * e.speed * dt);
        if (e.st2 <= 0) {
          const roll = this.r();
          if (d < 150 && roll < 0.55) { e.st = 'slamWind'; e.st2 = 0.85; this.ev.push({ t: 'wind', x: e.x, y: e.y, boss: true }); }
          else if (roll < 0.7 || d < 150) { e.st = 'chargeWind'; e.st2 = 0.7; e.ax = ux; e.ay = uy; this.ev.push({ t: 'wind', x: e.x, y: e.y, boss: true }); }
          else { e.st = 'spitWind'; e.st2 = 0.55; e.ax = ux; e.ay = uy; this.ev.push({ t: 'wind', x: e.x, y: e.y, boss: true }); }
        }
        break;
      }
      case 'slamWind': if (e.st2 <= 0) {
        e.st = 'rest'; e.st2 = 0.75;
        this.ev.push({ t: 'slam', x: e.x, y: e.y, r: 118 });
        if (d < 118 + p.r) this.hurtPlayer(e, null, e.x, e.y);
      } break;
      case 'chargeWind': if (e.st2 <= 0) { e.st = 'charge'; e.st2 = 1.3; } break;
      case 'charge': {
        const hit = this.move(e, e.ax * 380 * dt, e.ay * 380 * dt);
        if (hit || e.st2 <= 0) {
          if (hit) { e.st = 'dizzy'; e.st2 = 1.5; this.ev.push({ t: 'thud', x: e.x, y: e.y }); }
          else { e.st = 'rest'; e.st2 = 0.5; }
        }
        break;
      }
      case 'dizzy': if (e.st2 <= 0) { e.st = 'walk'; e.st2 = 0.8; } break;
      case 'spitWind': if (e.st2 <= 0) {
        const a = Math.atan2(e.ay, e.ax), n = e.phase >= 2 ? 9 : 7;
        for (let i = 0; i < n; i++) { const aa = a + (i - (n - 1) / 2) * 0.2; this.shots.push({ x: e.x + Math.cos(aa) * 30, y: e.y + Math.sin(aa) * 30, vx: Math.cos(aa) * 165, vy: Math.sin(aa) * 165, r: 7, kind: 'goo', t: 0 }); }
        this.ev.push({ t: 'shoot', x: e.x, y: e.y, boss: true });
        e.st = 'rest'; e.st2 = 0.6;
      } break;
      case 'roar': if (e.st2 <= 0) {
        for (let i = 0; i < 3; i++) this.summon(i === 2 && e.phase >= 2 ? 'skeleton' : 'goblin', null, false);
        e.st = 'walk'; e.st2 = 1.4;
      } break;
      case 'rest': if (e.st2 <= 0) { e.st = 'walk'; e.st2 = 1.0 + this.r() * 0.8; } break;
    }
    if (d < e.r + p.r - 4 && e.st !== 'intro') this.hurtPlayer(e, null, e.x, e.y);
  }

  separate() {
    const a = this.ents;
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
      const e = a[i], f = a[j];
      const dx = f.x - e.x, dy = f.y - e.y, d = hyp(dx, dy), m = e.r + f.r;
      if (d >= m || d < 1e-3) continue;
      const push = (m - d) / 2, nx = dx / d, ny = dy / d;
      const we = e.kind === 'boss' ? 0 : f.kind === 'boss' ? 2 : 1, wf = 2 - we;
      e.x -= nx * push * we; e.y -= ny * push * we; f.x += nx * push * wf; f.y += ny * push * wf;
      this.collide(e); this.collide(f);
    }
  }

  updateShots(dt) {
    const p = this.p;
    for (const s of this.shots) {
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (this.solidAt(Math.floor(s.x / T), Math.floor(s.y / T)) || s.t > 4) { s.dead = true; this.ev.push({ t: 'poof', x: s.x, y: s.y }); continue; }
      if (hyp(s.x - p.x, s.y - p.y) < s.r + p.r - 1) {
        if (p.dashT > 0 || p.inv > 0) continue;
        s.dead = true; this.hurtPlayer(null, s.user, s.x - s.vx, s.y - s.vy);
      }
      // a swing knocks arrows away
      if (p.swingT > 0.05 && !s.dead) {
        const d = hyp(s.x - p.x, s.y - p.y), a = Math.atan2(s.y - p.y, s.x - p.x);
        if (d < 46 && (p.relics.spin || Math.abs(angDiff(a, p.swingA)) < 1.3)) { s.dead = true; this.ev.push({ t: 'parry', x: s.x, y: s.y }); }
      }
    }
    this.shots = this.shots.filter(s => !s.dead);
  }

  updateTraps(dt) {
    const p = this.p;
    for (const t of this.traps) {
      if (t.t > 0) {
        t.t -= dt;
        if (t.t <= 0) {
          t.up = 0.45; this.ev.push({ t: 'spike', x: t.x, y: t.y, user: t.user });
          if (hyp(p.x - t.x, p.y - t.y) < t.r + p.r * 0.5) this.hurtPlayer(null, t.user, t.x, t.y);
        }
      } else t.up -= dt;
    }
    this.traps = this.traps.filter(t => t.t > 0 || t.up > 0);
    for (const s of this.spikes) {
      if (p.dashT > 0) continue;
      if (p.x > s.x0 && p.x < s.x1 && p.y + p.r * 0.5 > s.y0 && p.y - p.r * 0.5 < s.y1) { if (this.hurtPlayer(null, null, p.x, p.y + 30)) this.ev.push({ t: 'spike', x: p.x, y: p.y }); }
    }
  }

  openChest() {
    const rm = this.room, c = rm.chest; c.open = true;
    const have = this.p.relics;
    const opts = Object.keys(RELICS).filter(k => k === 'heart' || !have[k]);
    const k = this.pick(opts);
    this.pickups.push({ kind: 'relic', relic: k, x: c.x, y: c.y + 40, t: 0 });
    this.ev.push({ t: 'chest', x: c.x, y: c.y });
  }

  updatePickups(dt) {
    const p = this.p, rm = this.room;
    if (rm.chest && !rm.chest.open && hyp(rm.chest.x - p.x, rm.chest.y - p.y) < 30 + p.r) this.openChest();
    if (rm.shrine && !rm.shrine.used && hyp(rm.shrine.x - p.x, rm.shrine.y - p.y) < 34 + p.r) {
      rm.shrine.used = true; const before = p.hp; p.hp = Math.min(p.max, p.hp + 3);
      this.ev.push({ t: 'shrine', x: rm.shrine.x, y: rm.shrine.y, healed: p.hp - before });
    }
    for (const k of this.pickups) {
      k.t += dt;
      if (k.t < 0.4) continue;
      if (hyp(k.x - p.x, k.y - p.y) < p.r + 14) {
        k.dead = true;
        if (k.kind === 'heart') { p.hp = Math.min(p.max, p.hp + 1); this.ev.push({ t: 'heart', x: k.x, y: k.y }); }
        else if (k.kind === 'relic') {
          if (k.relic === 'heart') { p.max++; p.hp = Math.min(p.max, p.hp + 2); }
          else p.relics[k.relic] = true;
          this.ev.push({ t: 'relic', relic: k.relic, x: k.x, y: k.y });
        }
      }
    }
    this.pickups = this.pickups.filter(k => !k.dead);
  }

  updateRoom(dt) {
    const rm = this.room, p = this.p;
    const busy = this.ents.length > 0 || this.pending.length > 0;
    if (rm.phase === 'fight') {
      if (rm.type === 'boss') {
        if (!this.ents.some(e => e.kind === 'boss') && !this.over) { this.over = 'won'; this.overT = 0; this.ev.push({ t: 'win' }); }
        return;
      }
      if (!busy) {
        if (rm.waves > 0) { rm.waveWait -= dt; if (rm.waveWait <= 0) { this.spawnWave(); rm.waveWait = 0.8; } }
        else {
          rm.phase = rm.next === 'fork' ? 'vote' : 'open'; rm.voteT = VOTE_TIME;
          if (rm.type === 'fight' || rm.type === 'elite') this.ev.push({ t: 'clear' });
          if (rm.type === 'elite') { const opts = Object.keys(RELICS).filter(k => k === 'heart' || !p.relics[k]); const at = this.openSpot(clamp(p.x, T * 2, W - T * 2), clamp(p.y - 50, T * 2, H - T * 2)); this.pickups.push({ kind: 'relic', relic: this.pick(opts), x: at.x, y: at.y, t: 0 }); }
          if (rm.phase === 'vote') this.ev.push({ t: 'voteOpen', doors: rm.doors.map(d => d.type) });
          else this.ev.push({ t: 'doorOpen' });
        }
      }
    }
    if (rm.phase === 'vote' || rm.phase === 'tutorialVote') {
      rm.voteT -= dt;
      rm.doors[0].votes = 0; rm.doors[1].votes = 0;
      for (const v of rm.votes.values()) rm.doors[v].votes++;
      if (rm.voteT <= 0) {
        const [a, b] = [rm.doors[0].votes, rm.doors[1].votes];
        rm.choice = a > b ? 0 : b > a ? 1 : (this.r() < 0.5 ? 0 : 1);
        rm.tie = a === b;
        rm.phase = 'open';
        this.ev.push({ t: 'voted', choice: rm.choice, type: rm.doors[rm.choice].type, tie: rm.tie, none: a + b === 0 });
      }
    }
    if (rm.phase === 'open') {
      if (!busy) {
        const was = rm.wasOpen; rm.wasOpen = true;
        if (!was && rm.age > 0.5) this.ev.push({ t: 'unlock' });
      } else rm.wasOpen = false;
      if (p.y < T * 0.75) {
        const i = rm.doors.findIndex((d, i) => this.doorOpen(i) && p.x > d.c0 * T && p.x < (d.c0 + 2) * T);
        if (i >= 0) this.leaveRoom();
      }
    }
  }
}
