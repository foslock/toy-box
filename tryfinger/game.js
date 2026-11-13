// Simulation: no DOM. Tiles, bodies, player, enemies, bosses, messages and what's been proven.
import { W, H, AUTHORS, buildLevel } from './level.js';

const GRAV = 42, FALL_MAX = 24, RUN = 6.2, JUMPV = 16;
const ACC_G = 70, ACC_A = 40, FRIC = 55;
const ROLL_T = 0.45, ATK_T = 0.36, HEAL_T = 1.0;
const STAM_MAX = 100;

export const isSolidCh = (c) => c === '#' || c === '%' || c === '|' || c === ':' || c === '^';

let seedN = 1;
export const reseed = (n) => { seedN = n % 2147483646 + 1; };
const rnd = () => { seedN = (seedN * 16807) % 2147483647; return (seedN - 1) / 2147483646; };
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const boxOf = (b) => ({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, y0: b.y - b.h, y1: b.y });

export class Game {
  constructor(save = null, playerMsgs = [], stain = null) {
    const L = buildLevel();
    this.grid = L.grid;
    this.zones = L.zones;
    this.events = [];
    this.t = 0;
    this.time = save?.time || 0;
    this.deaths = save?.deaths || 0;
    this.ents = L.ents;
    this.candles = L.ents.filter(e => e.type === 'candle').map((e, i) => ({ ...e, i, lit: false }));
    const start = L.ents.find(e => e.type === 'start');
    this.startPos = { x: start.x, y: start.y };
    this.exit = L.ents.find(e => e.type === 'exit');
    this.msgs = L.msgs.map(m => ({ ...m, appr: apprFor(m), read: false, verdict: null }));
    for (const pm of playerMsgs) this.addPlayerMsg(pm, true);
    this.ghostStains = L.ghosts.map((gh, i) => ({ ...gh, i, track: this.simGhost(gh), play: -1, seen: false }));
    this.stain = stain;      // the player's own last bloodstain {x,y,track}
    this.stainPlay = -1;
    this.flasksMax = 3; this.whet = false;
    this.chestsOpened = new Set();
    this.bossDead = { warden: false, hand: false };
    this.walls = false; this.bridge = false; this.collapsed = false;
    this.candleIdx = -1;
    this.won = false;
    if (save) this.load(save);
    this.player = this.newPlayer();
    this.spawnAll();
    this.falling = null; // collapsing false floor timer
    this.fight = null;   // the boss currently fighting
    this.bossMsg = null;
    this.trail = [];
    this.inZone = new Set();
  }

  // ---------- persistence
  serialize() {
    const read = {}, verdict = {};
    for (const m of this.msgs) if (!m.mine) { if (m.read) read[m.id] = 1; if (m.verdict) verdict[m.id] = 1; }
    return { candleIdx: this.candleIdx, flasksMax: this.flasksMax, whet: this.whet, chests: [...this.chestsOpened],
      bossDead: this.bossDead, walls: this.walls, collapsed: this.collapsed, bridge: this.bridge, read, verdict,
      deaths: this.deaths, time: this.time, lit: this.candles.map(c => c.lit ? 1 : 0), won: this.won };
  }
  load(s) {
    this.candleIdx = s.candleIdx ?? -1;
    this.flasksMax = s.flasksMax || 3; this.whet = !!s.whet;
    this.chestsOpened = new Set(s.chests || []);
    this.bossDead = { warden: !!s.bossDead?.warden, hand: !!s.bossDead?.hand };
    if (s.walls) this.revealWall(true);
    if (s.collapsed) this.collapse(true);
    this.bridge = !!s.bridge;
    for (const m of this.msgs) { if (s.read?.[m.id]) m.read = true; if (s.verdict?.[m.id]) m.verdict = true; }
    (s.lit || []).forEach((v, i) => { if (v && this.candles[i]) this.candles[i].lit = true; });
  }

  addPlayerMsg(pm, quiet) {
    const m = { id: 'y' + this.msgs.length + '_' + Math.round(pm.x * 10), x: pm.x, y: pm.y, author: 'you', text: pm.text,
      truth: null, mine: true, appr: pm.appr || 0, born: pm.born || Date.now(), read: true, verdict: null };
    this.msgs.push(m);
    if (!quiet) this.ev('wrote', { m });
    return m;
  }

  ev(type, o = {}) { this.events.push({ type, ...o }); }

  // ---------- tiles
  tile(tx, ty) {
    if (tx < 0 || tx >= W) return '#';
    if (ty < 0) return ' ';
    if (ty >= H) return ' ';
    return this.grid[ty][tx];
  }
  solidFor(tx, ty, b) {
    const c = this.tile(tx, ty);
    if (c === 'g') return !!this.fight && !b.ghost;
    if (c === 'G') return !this.bossDead.warden;
    if (b.ghostFloor && c === '%') return !b.ghostFloor.gone;
    return isSolidCh(c);
  }

  moveBody(b, dt) {
    b.ground = false; b.wall = 0;
    const eps = 0.001;
    b.x += b.vx * dt;
    const top = b.y - b.h + eps, bot = b.y - eps;
    if (b.vx > 0) {
      const tx = Math.floor(b.x + b.w / 2);
      for (let ty = Math.floor(top); ty <= Math.floor(bot); ty++) if (this.solidFor(tx, ty, b)) { b.x = tx - b.w / 2 - eps; b.vx = 0; b.wall = 1; break; }
    } else if (b.vx < 0) {
      const tx = Math.floor(b.x - b.w / 2);
      for (let ty = Math.floor(top); ty <= Math.floor(bot); ty++) if (this.solidFor(tx, ty, b)) { b.x = tx + 1 + b.w / 2 + eps; b.vx = 0; b.wall = -1; break; }
    }
    const prevY = b.y;
    b.y += b.vy * dt;
    const l = Math.floor(b.x - b.w / 2 + eps), r = Math.floor(b.x + b.w / 2 - eps);
    if (b.vy >= 0) {
      const ty = Math.floor(b.y);
      for (let tx = l; tx <= r; tx++) {
        const c = this.tile(tx, ty);
        const plank = c === '-' && prevY <= ty + eps && !(b.dropT > 0);
        if (this.solidFor(tx, ty, b) || plank) { b.y = ty; b.vy = 0; b.ground = true; b.groundCh = c; b.groundTx = tx; break; }
      }
    } else {
      const ty = Math.floor(b.y - b.h);
      for (let tx = l; tx <= r; tx++) if (this.solidFor(tx, ty, b)) { b.y = ty + 1 + b.h; b.vy = 0; break; }
    }
    if (b.ground) {
      // what's actually under the feet (centre first)
      const cx = Math.floor(b.x), ty = Math.floor(b.y);
      const under = [this.tile(cx, ty), this.tile(l, ty), this.tile(r, ty)];
      b.under = under.find(c => c !== '.' && c !== ' ') || under[0];
      b.underAny = under;
    }
  }
  touchesKill(b) {
    const x0 = Math.floor(b.x - b.w / 2 + 0.05), x1 = Math.floor(b.x + b.w / 2 - 0.05);
    for (let ty = Math.floor(b.y - b.h); ty <= Math.floor(b.y - 0.01); ty++)
      for (let tx = x0; tx <= x1; tx++) if (this.tile(tx, ty) === 'v') return 'abyss';
    if (b.y > H + 1) return 'abyss';
    if (b.ground && b.underAny?.includes('^')) return 'spikes';
    return null;
  }

  // ---------- ghosts: other players' last moments, replayed through the same physics
  simGhost(gh) {
    const b = { x: gh.x, y: gh.y, w: 0.6, h: 1.4, vx: 0, vy: 0, ghost: true, ghostFloor: { t: 0, gone: false }, face: 1 };
    const track = []; let t = 0, si = 0, st = 0; const dt = 1 / 60;
    for (let f = 0; f < 60 * 6; f++) {
      const step = gh.script[si]; if (!step) break;
      const keys = step[1];
      const dir = keys.includes('R') ? 1 : keys.includes('L') ? -1 : 0;
      b.vx = dir * RUN * 0.9; if (dir) b.face = dir;
      if (keys.includes('J') && b.ground) b.vy = -JUMPV;
      b.vy = Math.min(FALL_MAX, b.vy + GRAV * dt);
      this.moveBody(b, dt);
      if (b.ground && b.under === '%') { b.ghostFloor.t += dt; if (b.ghostFloor.t > 0.3) b.ghostFloor.gone = true; }
      if (f % 2 === 0) track.push([b.x, b.y, b.face, b.ground ? 1 : 0]);
      if (this.touchesKill(b) || b.y > gh.y + 6) break;
      st += dt; t += dt; if (st >= step[0]) { si++; st = 0; }
    }
    return track;
  }

  // ---------- spawning
  newPlayer() {
    const c = this.candles[this.candleIdx];
    const p = c ? { x: c.x + 0.8, y: c.y } : { ...this.startPos };
    return { x: p.x, y: p.y, vx: 0, vy: 0, w: 0.6, h: 1.4, face: 1, hp: 100, hpMax: 100, stam: STAM_MAX, stamDelay: 0,
      flasks: this.flasksMax, state: 'free', st: 0, inv: 0, coyote: 0, jumpBuf: 0, dropT: 0, hitSet: null, anim: 0,
      lastGround: { x: p.x, y: p.y }, airT: 0 };
  }
  spawnAll() {
    this.enemies = [];
    this.chests = [];
    for (const e of this.ents) {
      if (e.type === 'hollow') this.enemies.push({ kind: 'hollow', x: e.x, y: e.y, home: e.x, w: 0.62, h: 1.45, hp: 60, max: 60, vx: 0, vy: 0, face: -1,
        state: e.dormant ? 'dormant' : 'idle', st: 0, wake: e.wake, tag: e.tag, cd: 0.6 + rnd() });
      if (e.type === 'crow') this.enemies.push({ kind: 'crow', x: e.x, y: e.y, hx: e.x, hy: e.y, w: 0.7, h: 0.55, hp: 25, max: 25, vx: 0, vy: 0, face: -1, state: 'perch', st: rnd() * 3, tag: e.tag, fly: true });
      if (e.type === 'mimic') this.enemies.push({ kind: 'mimic', x: e.x, y: e.y, w: 1.0, h: 0.85, hp: 130, max: 130, vx: 0, vy: 0, face: -1, state: 'dormant', st: 0, tag: e.tag });
      if (e.type === 'warden' && !this.bossDead.warden) this.enemies.push({ kind: 'warden', boss: 'warden', name: 'The Bell Warden', x: e.x, y: e.y, w: 1.6, h: 3.0, hp: 460, max: 460, vx: 0, vy: 0, face: -1, state: 'sleep', st: 0, cd: 0, arenaX: 209 });
      if (e.type === 'hand' && !this.bossDead.hand) this.enemies.push({ kind: 'hand', boss: 'hand', name: 'The Hand That Writes', x: e.x, y: 33, floorY: e.y, w: 3, h: 1.4, hp: 620, max: 620, vx: 0, vy: 0, face: -1, state: 'sleep', st: 0, arenaX: 324, ax0: 322, ax1: 358 });
      if (e.type === 'chest') this.chests.push({ ...e, w: 0.9, h: 0.75, vx: 0, vy: 0, opened: this.chestsOpened.has(e.id) || (e.id === 'bait' && this.collapsed), gone: e.id === 'bait' && this.collapsed });
    }
  }

  respawn() {
    this.player = this.newPlayer();
    this.fight = null; this.bossMsg = null;
    this.spawnAll();
    this.trail = [];
    this.inZone.clear();
    this.ev('respawn');
  }

  rest(c) {
    const newOne = !c.lit;
    c.lit = true;
    this.candleIdx = c.i;
    const p = this.player;
    p.hp = p.hpMax; p.flasks = this.flasksMax; p.stam = STAM_MAX;
    this.ev('rest', { c, newOne });
  }

  // ---------- message truth
  resolve(tag) {
    for (const m of this.msgs) if (m.tag === tag && !m.verdict) {
      m.verdict = true;
      if (m.read) this.ev('verdict', { m });
    }
  }
  readMsg(m) {
    if (m.read) return;
    m.read = true;
    this.ev('readFirst', { m });
    if (m.verdict) this.ev('verdict', { m });
  }

  // ---------- world changes
  revealWall(quiet) {
    if (!quiet && this.walls) return;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (this.grid[y][x] === '|') this.grid[y][x] = '.';
    this.walls = true;
    if (!quiet) { this.ev('wall', { x: 110.5, y: 17 }); this.resolve('wall'); this.ev('tiles'); }
  }
  collapse(quiet) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (this.grid[y][x] === '%' || this.grid[y][x] === 'o') this.grid[y][x] = '.';
    this.collapsed = true;
    if (!quiet) { this.ev('collapse', { x: 166, y: 27 }); this.resolve('false'); this.ev('tiles'); }
  }

  // ---------- the player
  hurtPlayer(dmg, fromX, kind = 'hit') {
    const p = this.player;
    if (p.state === 'dead' || this.won) return false;
    if (p.inv > 0) return false;
    if (p.state === 'roll' && p.st > 0.04 && p.st < 0.32) { this.ev('dodge', { x: p.x, y: p.y - 0.7 }); return false; }
    p.hp -= dmg;
    this.ev('hurt', { x: p.x, y: p.y - 0.8, dmg, kind });
    if (p.hp <= 0) { this.killPlayer(kind === 'slam' ? 'crushed' : 'slain'); return true; }
    p.state = 'hurt'; p.st = 0; p.inv = 0.75;
    const dir = Math.sign(p.x - fromX) || -p.face;
    p.vx = dir * 6; p.vy = -6;
    return true;
  }
  killPlayer(cause) {
    const p = this.player;
    if (p.state === 'dead') return;
    p.state = 'dead'; p.st = 0; p.hp = 0; p.vx = 0;
    this.deaths++;
    const at = cause === 'abyss' || cause === 'spikes' || !p.ground ? p.lastGround : { x: p.x, y: p.y };
    this.stain = { x: at.x, y: at.y, track: this.trail.slice(-150), cause };
    // dying somewhere proves what it proves
    for (const z of this.zones) if (p.x > z.x0 && p.x < z.x1 && p.y > z.y0 && p.y < z.y1 + 2) this.resolve(z.tag);
    this.ev('died', { cause, x: p.x, y: p.y });
  }

  update(dt, inp) {
    this.t += dt;
    if (!this.won && this.player.state !== 'dead') this.time += dt;
    const p = this.player;
    this.updatePlayer(dt, inp);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.enemies = this.enemies.filter(e => !(e.state === 'gone'));
    for (const c of this.chests) if (!c.gone) {
      c.vy = Math.min(FALL_MAX, c.vy + GRAV * dt); this.moveBody(c, dt);
      if (c.y > H || this.touchesKill(c)) c.gone = true;
    }
    // collapsing floor
    if (this.falling != null) { this.falling -= dt; if (this.falling <= 0) { this.falling = null; this.collapse(); } }
    // ghost replays
    for (const gs of this.ghostStains) if (gs.play >= 0) {
      gs.play += dt;
      if (gs.play * 30 >= gs.track.length + 12) { gs.play = -1; if (!gs.seen) { gs.seen = true; this.resolve(gs.i === 0 ? 'pit' : 'false'); } }
    }
    if (this.stainPlay >= 0) { this.stainPlay += dt; if (this.stainPlay * 30 >= (this.stain?.track.length || 0) + 12) this.stainPlay = -1; }
    if (p.state !== 'dead') {
      // trail for the bloodstain replay
      if ((this.t * 30 | 0) !== this._lastTrail) { this._lastTrail = this.t * 30 | 0; this.trail.push([p.x, p.y, p.face, p.state === 'roll' ? 2 : p.ground ? 1 : 0]); if (this.trail.length > 200) this.trail.shift(); }
      for (const gs of this.ghostStains) if (gs.play < 0 && Math.abs(p.x - gs.x) < 0.7 && Math.abs(p.y - gs.y) < 1) { if (!gs.near) { gs.near = true; gs.play = 0; this.ev('ghost', { gs }); } } else if (Math.abs(p.x - gs.x) > 1.5) gs.near = false;
      if (this.stain && this.stainPlay < 0 && Math.abs(p.x - this.stain.x) < 0.7 && Math.abs(p.y - this.stain.y) < 1) { if (!this.stainNear) { this.stainNear = true; this.stainPlay = 0; this.ev('ghost', { mine: true }); } } else if (this.stain && Math.abs(p.x - this.stain.x) > 1.5) this.stainNear = false;
      // chests open at a touch
      for (const c of this.chests) if (!c.opened && !c.gone && overlap(boxOf(p), boxOf(c))) this.openChest(c);
      // candles
      for (const c of this.candles) {
        const near = Math.abs(p.x - c.x) < 0.9 && Math.abs(p.y - c.y) < 1.2;
        if (near && !c.near && !this.fight) this.rest(c);
        c.near = near;
      }
      // zones
      for (const z of this.zones) {
        const inside = p.x > z.x0 && p.x < z.x1 && p.y > z.y0 && p.y <= z.y1 && (!z.ground || p.ground);
        if (inside) this.resolve(z.tag);
      }
      // messages: the nearest one under your feet
      let best = null, bd = 1.1;
      for (const m of this.msgs) { const d = Math.abs(p.x - m.x); if (d < bd && Math.abs(p.y - m.y) < 1.2) { bd = d; best = m; } }
      this.nearMsg = best;
      if (best) this.readMsg(best);
      // the way out
      if (this.bossDead.hand && !this.won && Math.abs(p.x - this.exit.x) < 1.2 && Math.abs(p.y - this.exit.y) < 2) { this.won = true; this.ev('win'); }
    } else this.nearMsg = null;
  }

  updatePlayer(dt, inp) {
    const p = this.player;
    p.st += dt; p.inv = Math.max(0, p.inv - dt); p.dropT = Math.max(0, p.dropT - dt);
    if (p.state === 'dead') { p.vy = Math.min(FALL_MAX, p.vy + GRAV * dt); if (p.y < H + 2) this.moveBody(p, dt); p.vx *= 0.9; return; }
    if (this.won) { inp = {}; }
    // stamina
    if (p.stamDelay > 0) p.stamDelay -= dt; else p.stam = Math.min(STAM_MAX, p.stam + (p.state === 'heal' ? 22 : 52) * dt);
    if (inp.jumpPressed) p.jumpBuf = 0.13; else p.jumpBuf = Math.max(0, p.jumpBuf - dt);
    p.coyote = p.ground ? 0.1 : Math.max(0, p.coyote - dt);
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const free = p.state === 'free';

    // start actions
    if (free && inp.rollPressed && p.stam > 0) { p.state = 'roll'; p.st = 0; if (dir) p.face = dir; p.stam -= 26; p.stamDelay = 0.45; p.h = 0.8; this.ev('roll', { x: p.x, y: p.y }); }
    else if (free && inp.attackPressed && p.stam > 0) { p.state = 'attack'; p.st = 0; if (dir) p.face = dir; p.stam -= 20; p.stamDelay = 0.45; p.hitSet = new Set(); this.ev('swing', { x: p.x, y: p.y }); }
    else if (free && inp.healPressed && p.ground) {
      if (p.flasks > 0) { p.state = 'heal'; p.st = 0; p.healed = false; this.ev('drink'); } else if (!this._emptyT || this.t - this._emptyT > 0.6) { this._emptyT = this.t; this.ev('empty'); }
    }

    let maxV = RUN, acc = p.ground ? ACC_G : ACC_A;
    if (p.state === 'roll') {
      const k = p.st / ROLL_T;
      p.vx = p.face * (8.8 - 4 * k);
      if (p.st >= ROLL_T) {
        // can't stand up under a low ceiling
        p.h = 1.4;
        if (this.ceilingBlocked(p)) { p.h = 0.8; p.st = ROLL_T - 0.05; } else { p.state = 'free'; p.st = 0; }
      }
    } else if (p.state === 'attack') {
      if (p.ground) p.vx *= Math.pow(0.0005, dt);
      if (p.st > 0.08 && p.st < 0.2) this.playerHits(p);
      if (p.st >= ATK_T) { p.state = 'free'; p.st = 0; }
    } else if (p.state === 'heal') {
      maxV = 1.6;
      if (!p.healed && p.st > 0.55) { p.healed = true; p.flasks--; p.hp = Math.min(p.hpMax, p.hp + 55); this.ev('healed', { x: p.x, y: p.y }); }
      if (p.st >= HEAL_T) { p.state = 'free'; p.st = 0; }
    } else if (p.state === 'hurt') {
      if (p.st > 0.32) { p.state = 'free'; p.st = 0; }
    }
    if (p.state === 'free' || p.state === 'heal') {
      if (dir) { p.vx += dir * acc * dt; if (p.state === 'free') p.face = dir; if (Math.abs(p.vx) > maxV) p.vx = Math.sign(p.vx) * Math.max(maxV, Math.abs(p.vx) - (FRIC + acc) * dt); }
      else { const f = (p.ground ? FRIC : 12) * dt; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f; }
      if (p.state === 'free' && p.jumpBuf > 0) {
        if (inp.down && p.ground && p.under === '-') { p.dropT = 0.25; p.jumpBuf = 0; p.y += 0.05; this.ev('drop'); }
        else if (p.coyote > 0) { p.vy = -JUMPV; p.coyote = 0; p.jumpBuf = 0; p.ground = false; p.jumpT = 0; this.ev('jump', { x: p.x, y: p.y }); }
      }
      if (inp.down && p.ground && p.under === '-' && !p.dropT) { p.dropT = 0.25; p.y += 0.05; this.ev('drop'); }
    }
    p.jumpT = (p.jumpT || 0) + dt;
    if (!inp.jumpHeld && p.vy < -7 && p.jumpT > 0.14 && p.state === 'free') p.vy = -7; // short hops, never too short
    p.vy = Math.min(FALL_MAX, p.vy + GRAV * dt);
    const wasGround = p.ground, vyBefore = p.vy;
    this.moveBody(p, dt);
    if (p.ground) {
      if (!wasGround && vyBefore > 8) this.ev('land', { x: p.x, y: p.y, hard: vyBefore > 17 });
      p.airT = 0;
      if (p.under === '%' && this.falling == null && !this.collapsed) { this.falling = 0.28; this.ev('crack', { x: p.x, y: p.y }); }
      if (p.under === ':' && !this.bridge) { this.bridge = true; this.resolve('bridge'); this.ev('bridge', { x: p.x, y: p.y }); }
      if (p.under !== '^' && p.under !== '%') p.lastGround = { x: p.x, y: p.y };
    } else p.airT += dt;
    if (p.ground && Math.abs(p.vx) > 1 && p.state === 'free') { p.anim += dt * Math.abs(p.vx) * 1.6; } else if (p.state === 'free') p.anim = 0;
    const k = this.touchesKill(p);
    if (k) this.killPlayer(k);
  }
  ceilingBlocked(p) {
    const ty = Math.floor(p.y - p.h);
    for (let tx = Math.floor(p.x - p.w / 2 + 0.01); tx <= Math.floor(p.x + p.w / 2 - 0.01); tx++) if (this.solidFor(tx, ty, p)) return true;
    return false;
  }

  atkBox(p) {
    const reach = 1.45;
    return p.face > 0 ? { x0: p.x - 0.1, x1: p.x + 0.3 + reach, y0: p.y - 1.5, y1: p.y - 0.05 } : { x0: p.x - 0.3 - reach, x1: p.x + 0.1, y0: p.y - 1.5, y1: p.y - 0.05 };
  }
  playerHits(p) {
    const box = this.atkBox(p);
    const dmg = this.whet ? 46 : 30;
    for (const e of this.enemies) {
      if (p.hitSet.has(e) || e.hp <= 0 || e.state === 'dead') continue;
      const hb = this.hurtBox(e); if (!hb || !overlap(box, hb)) continue;
      p.hitSet.add(e);
      this.damageEnemy(e, dmg, p.x);
    }
    // illusory walls answer to steel
    if (!this.walls) {
      for (let ty = Math.floor(box.y0); ty <= Math.floor(box.y1); ty++) for (let tx = Math.floor(box.x0); tx <= Math.floor(box.x1); tx++) if (this.tile(tx, ty) === '|') { this.revealWall(); return; }
    }
    // chests open to a swing too
    for (const c of this.chests) if (!c.opened && !c.gone && overlap(box, boxOf(c))) this.openChest(c);
    // striking solid stone clinks
    if (!p.hitSet.has('wall')) {
      const tx = Math.floor(p.face > 0 ? box.x1 - 0.2 : box.x0 + 0.2), ty = Math.floor(p.y - 0.8);
      if (isSolidCh(this.tile(tx, ty))) { p.hitSet.add('wall'); this.ev('clink', { x: p.face > 0 ? tx : tx + 1, y: p.y - 0.8 }); }
    }
  }
  openChest(c) {
    c.opened = true; this.chestsOpened.add(c.id);
    if (c.give === 'flask') { this.flasksMax++; this.player.flasks++; }
    if (c.give === 'whet') this.whet = true;
    if (c.tag) this.resolve(c.tag);
    this.ev('chest', { c });
  }

  hurtBox(e) {
    if (e.kind === 'hand') {
      if (!['write', 'stunned', 'rest'].includes(e.state)) return null;
      return { x0: e.x - 1.6, x1: e.x + 1.6, y0: e.y - 1.0, y1: e.y + 0.7 };
    }
    if (e.state === 'sleep' || e.state === 'gone') return null;
    return boxOf(e);
  }
  damageEnemy(e, dmg, fromX) {
    e.hp -= dmg;
    this.ev('hit', { x: e.x, y: e.y - e.h * 0.6, boss: !!e.boss, kind: e.kind });
    if (e.kind === 'mimic' && e.state === 'dormant') this.wakeMimic(e);
    if (e.kind === 'hollow' && e.state === 'dormant') this.wakeHollow(e);
    if (e.hp <= 0) {
      e.state = 'dead'; e.st = 0; e.vx = Math.sign(e.x - fromX) * 3;
      if (e.tag) this.resolve(e.tag);
      if (e.boss) {
        this.bossDead[e.boss] = true; this.fight = null; this.bossMsg = null;
        if (e.boss === 'warden') this.resolve('boss1');
        this.ev('bossDie', { e }); this.ev('tiles');
      } else this.ev('kill', { e });
      return;
    }
    if (e.kind === 'hollow' && e.state !== 'strike') { e.state = 'stagger'; e.st = 0; e.vx = Math.sign(e.x - fromX) * 3.5; }
    if (e.kind === 'crow') { e.state = 'return'; e.st = 0; e.vy = -4; }
  }
  wakeMimic(e) { e.state = 'awake'; e.st = 0; if (e.tag) this.resolve(e.tag); this.ev('mimic', { x: e.x, y: e.y }); }
  wakeHollow(e) { e.state = 'chase'; e.st = 0; if (e.tag) this.resolve(e.tag); this.ev('ambush', { x: e.x, y: e.y }); }

  enemyStrike(e, box, dmg, kind) {
    const p = this.player;
    if (p.state === 'dead') return;
    if (overlap(box, boxOf(p))) this.hurtPlayer(dmg, e.x, kind);
  }

  updateEnemy(e, dt) {
    const p = this.player;
    e.st += dt;
    const dx = p.x - e.x, dy = p.y - e.y, adx = Math.abs(dx);
    const alive = p.state !== 'dead';
    if (e.state === 'dead') {
      if (!e.fly && !e.boss) { e.vy = Math.min(FALL_MAX, e.vy + GRAV * dt); e.vx *= 0.9; this.moveBody(e, dt); }
      if (e.fly) { e.vy += GRAV * dt; e.y += e.vy * dt; }
      if (e.st > (e.boss ? 2.5 : 1.2)) e.state = 'gone';
      return;
    }
    switch (e.kind) {
      case 'hollow': return this.hollow(e, dt, dx, dy, adx, alive);
      case 'crow': return this.crow(e, dt, dx, dy, adx, alive);
      case 'mimic': return this.mimic(e, dt, dx, dy, adx, alive);
      case 'warden': return this.warden(e, dt, dx, dy, adx, alive);
      case 'hand': return this.hand(e, dt, dx, dy, adx, alive);
    }
  }
  floorAhead(e, dir) {
    const tx = Math.floor(e.x + dir * (e.w / 2 + 0.2)), ty = Math.floor(e.y + 0.1);
    const c = this.tile(tx, ty);
    return (isSolidCh(c) && c !== '^') || c === '-';
  }

  hollow(e, dt, dx, dy, adx, alive) {
    const sees = alive && adx < 7 && Math.abs(dy) < 2.5;
    let want = 0;
    switch (e.state) {
      case 'dormant':
        if (alive && e.wake && this.player.x > e.wake && Math.abs(dy) < 3) this.wakeHollow(e);
        break;
      case 'idle':
        want = Math.sin(this.t * 0.6 + e.home) > 0.6 ? 1 : Math.sin(this.t * 0.6 + e.home) < -0.6 ? -1 : 0;
        if (Math.abs(e.x - e.home) > 2.5) want = Math.sign(e.home - e.x);
        if (sees) { e.state = 'chase'; e.st = 0; if (e.tag) this.resolve(e.tag); this.ev('growl', { x: e.x, y: e.y }); }
        break;
      case 'chase':
        e.face = Math.sign(dx) || e.face;
        e.cd -= dt;
        if (!alive || adx > 11 || Math.abs(dy) > 4) { e.state = 'idle'; break; }
        if (adx < 1.5 && Math.abs(dy) < 1.2 && e.cd <= 0) { e.state = 'windup'; e.st = 0; this.ev('windup', { x: e.x, y: e.y }); }
        else if (adx > 1.1) want = e.face;
        break;
      case 'windup':
        if (e.st > 0.52) { e.state = 'strike'; e.st = 0; e.vx = e.face * 4; this.ev('eswing', { x: e.x, y: e.y }); }
        break;
      case 'strike': {
        const box = e.face > 0 ? { x0: e.x, x1: e.x + 1.6, y0: e.y - 1.5, y1: e.y } : { x0: e.x - 1.6, x1: e.x, y0: e.y - 1.5, y1: e.y };
        if (e.st < 0.15) this.enemyStrike(e, box, 22, 'hit');
        if (e.st > 0.15) { e.state = 'recover'; e.st = 0; }
        break;
      }
      case 'recover': if (e.st > 0.6) { e.state = 'chase'; e.st = 0; e.cd = 0.4 + rnd() * 0.6; } break;
      case 'stagger': if (e.st > 0.35) { e.state = 'chase'; e.st = 0; e.cd = 0.3; } break;
    }
    const sp = e.state === 'chase' ? 2.4 : 1.0;
    if (want && !this.floorAhead(e, want)) want = 0;
    if (want) { e.vx = want * sp; e.face = want; }
    else if (e.state !== 'stagger' && e.state !== 'strike') e.vx *= Math.pow(0.001, dt);
    if (e.state === 'stagger' || e.state === 'strike') e.vx *= Math.pow(0.02, dt);
    if (e.state === 'dormant') e.vx = 0;
    e.vy = Math.min(FALL_MAX, e.vy + GRAV * dt);
    this.moveBody(e, dt);
    if (this.touchesKill(e)) { e.state = 'dead'; e.st = 0; }
  }

  crow(e, dt, dx, dy, adx, alive) {
    const p = this.player;
    switch (e.state) {
      case 'perch':
        e.x = e.hx + Math.sin(this.t * 1.3 + e.hx) * 0.6; e.y = e.hy + Math.sin(this.t * 2.1 + e.hx) * 0.25;
        e.face = Math.sign(dx) || e.face;
        if (alive && adx < 6.5 && dy > -1 && dy < 9 && e.st > 0.8) {
          e.state = 'aim'; e.st = 0; this.ev('caw', { x: e.x, y: e.y }); if (e.tag) this.resolve(e.tag);
        }
        break;
      case 'aim':
        e.y -= dt * 1.5;
        if (e.st > 0.45) { e.state = 'swoop'; e.st = 0; const tx = p.x, ty = p.y - 0.7; const d = Math.hypot(tx - e.x, ty - e.y) || 1; e.vx = (tx - e.x) / d * 10; e.vy = (ty - e.y) / d * 10; e.face = Math.sign(e.vx) || e.face; }
        break;
      case 'swoop':
        e.x += e.vx * dt; e.y += e.vy * dt;
        this.enemyStrike(e, boxOf(e), 15, 'peck');
        if (e.st > 0.9 || this.solidFor(Math.floor(e.x), Math.floor(e.y), e)) { e.state = 'return'; e.st = 0; }
        break;
      case 'return': {
        const tx = e.hx - e.x, ty = e.hy - e.y, d = Math.hypot(tx, ty);
        if (d < 0.3) { e.state = 'perch'; e.st = 0; break; }
        e.x += tx / d * 4.5 * dt; e.y += ty / d * 4.5 * dt; e.face = Math.sign(tx) || e.face;
        break;
      }
    }
  }

  mimic(e, dt, dx, dy, adx, alive) {
    switch (e.state) {
      case 'dormant':
        if (alive && adx < 1.5 && Math.abs(dy) < 1.5) this.wakeMimic(e);
        e.vx = 0; break;
      case 'awake':
        e.face = Math.sign(dx) || e.face;
        if (!alive) break;
        if (adx < 1.9 && Math.abs(dy) < 1.5) { e.state = 'windup'; e.st = 0; this.ev('windup', { x: e.x, y: e.y }); }
        else if (e.ground && e.st > 0.75 && adx < 10) { e.vx = e.face * 3.4; e.vy = -7; e.st = 0; this.ev('hop', { x: e.x, y: e.y }); }
        break;
      case 'windup':
        if (e.st > 0.42) { e.state = 'bite'; e.st = 0; e.vx = e.face * 6; this.ev('bite', { x: e.x, y: e.y }); }
        break;
      case 'bite': {
        const box = e.face > 0 ? { x0: e.x, x1: e.x + 1.7, y0: e.y - 1.2, y1: e.y } : { x0: e.x - 1.7, x1: e.x, y0: e.y - 1.2, y1: e.y };
        if (e.st < 0.16) this.enemyStrike(e, box, 38, 'bite');
        if (e.st > 0.16) { e.state = 'recover'; e.st = 0; }
        break;
      }
      case 'recover': if (e.st > 0.75) { e.state = 'awake'; e.st = 0; } break;
    }
    if (e.ground && e.state !== 'bite') e.vx *= Math.pow(0.002, dt);
    if (e.state === 'bite') e.vx *= Math.pow(0.05, dt);
    e.vy = Math.min(FALL_MAX, e.vy + GRAV * dt);
    this.moveBody(e, dt);
    if (this.touchesKill(e)) { e.state = 'dead'; e.st = 0; }
  }

  startFight(e) {
    this.fight = e; e.state = 'intro'; e.st = 0;
    this.ev('fight', { e }); this.ev('tiles');
  }

  warden(e, dt, dx, dy, adx, alive) {
    const p = this.player;
    const phase2 = e.hp < e.max * 0.5;
    if (e.state !== 'sleep' && !alive) { e.vx = 0; return; }
    switch (e.state) {
      case 'sleep':
        if (alive && p.x > e.arenaX && p.y < 28) this.startFight(e);
        break;
      case 'intro': if (e.st > 1.3) { e.state = 'walk'; e.st = 0; e.cd = 0.4; } break;
      case 'walk':
        e.face = Math.sign(dx) || e.face; e.cd -= dt;
        if (e.cd <= 0) {
          if (adx < 3.6) { e.atk = rnd() < (phase2 ? 0.5 : 0.55) ? 'over' : 'sweep'; e.state = 'windup'; e.st = 0; this.ev('wwindup', { x: e.x, y: e.y, atk: e.atk }); break; }
          if (phase2 && adx > 5 && rnd() < 0.02) { e.atk = 'leap'; e.state = 'windup'; e.st = 0; this.ev('wwindup', { x: e.x, y: e.y, atk: 'leap' }); break; }
        }
        e.vx = adx > 2.2 ? e.face * (phase2 ? 2.3 : 1.7) : 0;
        break;
      case 'windup': {
        e.vx = 0;
        const wt = e.atk === 'over' ? (phase2 ? 0.68 : 0.8) : e.atk === 'sweep' ? (phase2 ? 0.48 : 0.56) : 0.55;
        if (e.st > wt) {
          e.state = e.atk; e.st = 0;
          if (e.atk === 'leap') { const T = 0.8; e.tx = Math.max(209, Math.min(236, p.x)); e.vx = (e.tx - e.x) / T; e.vy = -GRAV * T / 2; }
          this.ev('wstrike', { x: e.x, y: e.y, atk: e.atk });
        }
        break;
      }
      case 'over': {
        const box = e.face > 0 ? { x0: e.x + 0.3, x1: e.x + 3.5, y0: e.y - 3.2, y1: e.y } : { x0: e.x - 3.5, x1: e.x - 0.3, y0: e.y - 3.2, y1: e.y };
        if (e.st < 0.15) this.enemyStrike(e, box, 34, 'slam');
        if (e.st > 0.15) { e.state = 'recover'; e.st = 0; e.rt = phase2 ? 0.7 : 0.95; this.ev('shake', { a: 0.5 }); }
        break;
      }
      case 'sweep': {
        const box = e.face > 0 ? { x0: e.x - 1.2, x1: e.x + 3.7, y0: e.y - 1.3, y1: e.y } : { x0: e.x - 3.7, x1: e.x + 1.2, y0: e.y - 1.3, y1: e.y };
        if (e.st < 0.2) this.enemyStrike(e, box, 28, 'hit');
        if (e.st > 0.2) { e.state = 'recover'; e.st = 0; e.rt = phase2 ? 0.55 : 0.75; }
        break;
      }
      case 'leap':
        if (e.ground && e.st > 0.1) {
          e.vx = 0;
          this.enemyStrike(e, { x0: e.x - 3, x1: e.x + 3, y0: e.y - 1.2, y1: e.y }, 32, 'slam');
          this.ev('shake', { a: 0.9 }); this.ev('wland', { x: e.x, y: e.y });
          e.state = 'recover'; e.st = 0; e.rt = 1.0;
        }
        break;
      case 'recover': e.vx = 0; if (e.st > e.rt) { e.state = 'walk'; e.st = 0; e.cd = 0.25 + rnd() * 0.5; } break;
    }
    if (e.state !== 'leap') e.vy = Math.min(FALL_MAX, e.vy + GRAV * dt); else e.vy += GRAV * dt;
    this.moveBody(e, dt);
  }

  // ---------- The Hand That Writes: it writes where it will strike, signed by someone you've met
  handMessage(atk, author) {
    const honest = ['ilse', 'ansel', 'pell', 'fop'].includes(author);
    const T = { slamL: 'Be wary of left', slamR: 'Be wary of right', sweep: 'Try jumping' };
    if (honest) return T[atk];
    if (author === 'lefty') return atk === 'slamL' ? T.slamR : atk === 'slamR' ? T.slamL : T.sweep;
    // liars
    if (atk === 'slamL') return rnd() < 0.7 ? T.slamR : T.sweep;
    if (atk === 'slamR') return rnd() < 0.7 ? T.slamL : T.sweep;
    return rnd() < 0.5 ? T.slamL : T.slamR;
  }
  hand(e, dt, dx, dy, adx, alive) {
    const p = this.player;
    const hp = e.hp / e.max;
    const fast = hp < 0.5 ? 0.78 : 1;
    const mid = (e.ax0 + e.ax1) / 2, fy = e.floorY;
    const ease = (to, k) => { e.x += (to.x - e.x) * Math.min(1, k * dt); e.y += (to.y - e.y) * Math.min(1, k * dt); };
    if (e.state !== 'sleep' && !alive) { ease({ x: mid, y: 33 }, 2); return; }
    switch (e.state) {
      case 'sleep':
        e.x = mid; e.y = 31 + Math.sin(this.t) * 0.3;
        if (alive && p.x > e.arenaX) this.startFight(e);
        break;
      case 'intro': ease({ x: mid, y: 36 }, 2); if (e.st > 1.6) { e.state = 'pick'; e.st = 0; } break;
      case 'pick': {
        // choose the attack and the author
        const r = rnd();
        e.atk = r < 0.38 ? 'slamL' : r < 0.76 ? 'slamR' : 'sweep';
        let pool = ['ilse', 'ansel', 'pell', 'ilse', 'guts'];
        if (hp < 0.7) pool = ['ilse', 'ansel', 'pell', 'guts', 'appr', 'lefty', 'fop', 'lefty'];
        if (hp < 0.35) pool = ['pell', 'guts', 'appr', 'lefty', 'appr', 'guts', 'ilse', 'lefty'];
        e.author = pool[Math.floor(rnd() * pool.length)];
        e.text = this.handMessage(e.atk, e.author);
        e.wx = mid + (rnd() - 0.5) * 10;
        e.sweepFrom = rnd() < 0.5 ? -1 : 1;
        e.state = 'go'; e.st = 0;
        break;
      }
      case 'go': ease({ x: e.wx, y: fy - 0.9 }, 5); if (e.st > 0.55 * fast) { e.state = 'write'; e.st = 0; this.ev('write', { x: e.x, y: fy }); } break;
      case 'write':
        e.x = e.wx + Math.sin(e.st * 14) * 0.6; e.y = fy - 0.7 + Math.abs(Math.sin(e.st * 9)) * 0.15;
        if (e.st > 1.0 * fast) {
          this.bossMsg = { x: e.wx, y: fy, author: e.author, text: e.text, appr: apprFor({ author: e.author }), boss: true, born: this.t };
          this.ev('written', { m: this.bossMsg });
          e.state = 'rise'; e.st = 0;
        }
        break;
      case 'rise': ease({ x: e.x, y: 30.5 }, 4); if (e.st > 1.05 * fast) { e.state = 'tele'; e.st = 0; this.prepAttack(e); } break;
      case 'tele':
        if (e.atk === 'sweep') { e.x = e.sweepFrom < 0 ? e.ax0 - 2 : e.ax1 + 2; e.y = fy - 0.6; }
        else ease({ x: e.zx, y: 31 }, 6);
        if (e.st > (e.atk === 'sweep' ? 0.5 : 0.36) * fast) { e.state = e.atk === 'sweep' ? 'sweep' : 'slam'; e.st = 0; this.ev(e.atk === 'sweep' ? 'sweep' : 'fall', { x: e.x, y: fy }); }
        break;
      case 'slam':
        e.y += 60 * dt;
        if (e.y >= fy - 0.6) {
          e.y = fy - 0.6;
          this.enemyStrike(e, { x0: e.z0, x1: e.z1, y0: fy - 2.6, y1: fy }, 65, 'slam');
          this.ev('slam', { x: e.x, y: fy, z0: e.z0, z1: e.z1 }); this.ev('shake', { a: 1 });
          e.state = 'stunned'; e.st = 0; this.bossMsg = null;
        }
        break;
      case 'stunned': if (e.st > 1.5 * (hp < 0.5 ? 0.85 : 1)) { e.state = 'pick'; e.st = 0; } break;
      case 'sweep': {
        const dir = -e.sweepFrom;
        e.x += dir * 15 * dt; e.y = fy - 0.55;
        this.enemyStrike(e, { x0: e.x - 1.5, x1: e.x + 1.5, y0: fy - 1.1, y1: fy }, 35, 'hit');
        if ((dir > 0 && e.x > e.ax1 - 2) || (dir < 0 && e.x < e.ax0 + 2)) { e.state = 'rest'; e.st = 0; this.bossMsg = null; }
        break;
      }
      case 'rest': if (e.st > 1.1 * fast) { e.state = 'pick'; e.st = 0; } break;
    }
  }
  prepAttack(e) {
    const mid = (e.ax0 + e.ax1) / 2;
    if (e.atk === 'slamL') { e.z0 = e.ax0; e.z1 = mid + 1.5; e.zx = (e.z0 + e.z1) / 2; }
    if (e.atk === 'slamR') { e.z0 = mid - 1.5; e.z1 = e.ax1; e.zx = (e.z0 + e.z1) / 2; }
    this.ev('tele', { e });
  }
}

export function apprFor(m) {
  const a = AUTHORS[m.author]?.appr || [0, 0];
  const h = [...(m.text || '') + m.author + (m.id || '')].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
  return a[0] + (h % (a[1] - a[0] + 1));
}
