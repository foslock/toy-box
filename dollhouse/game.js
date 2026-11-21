// Simulation for the tin soldier and the house. No DOM; main.js and art.js read this.
import * as L from './level.js';

const G = 38, JUMP_V = 16, RUN = 7, MAXFALL = 20;
const SMALL_JUMP_V = 11.2, SMALL_RUN = 5;
const DASH_V = 24, DASH_T = 0.2;
const CLIMB_V = 5.5, FLOAT_FALL = 2.6, DRAFT_V = -8.5;
const BIG = { w: 0.66, h: 1.5 }, SMALL = { w: 0.42, h: 0.7 };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();

export const UPDRAFTS = [{ x0: 67, x1: 69, y0: 1.5, y1: 34 }];

export class Game {
  constructor(save) {
    const s = save || {};
    this.base = L.buildMap();
    this.has = new Set(s.has || []);
    this.medals = new Set(s.medals || []);
    this.springs = new Set(s.springs || []);
    this.flags = Object.assign({}, s.flags || {});
    this.awake = new Set(s.awake || []);
    this.visited = new Set(s.visited || []);
    this.bench = s.bench || null;
    this.time = s.time || 0;
    this.deaths = s.deaths || 0;
    this.rebuildMap();
    this.ev = [];
    this.parts = [];
    this.p = this.newPlayer();
    const st = this.bench && L.STANDS.find(b => b.id === this.bench);
    const at = st ? { x: st.x + 0.5, y: st.y + 1 } : { x: L.START.x + 0.5, y: L.START.y + 1 };
    this.p.x = at.x; this.p.y = at.y;
    this.safe = { x: at.x, y: at.y };
    this.resetEnemies();
    this.boss = null;
    this.room = null;
    this.near = { note: null, toy: null, stand: null };
    this.restLock = st ? st.id : null;
    this.shake = 0; this.hitstop = 0;
    this.tutor = {};    // counts of things the player has done, for the coach
    this.parade = [];   // toys walking to the parlour door
    this.doorToys = L.TOYS.filter(t => t.door && this.awake.has(t.id)).map(t => t.id);
  }
  newPlayer() {
    return { x: 0, y: 0, vx: 0, vy: 0, w: BIG.w, h: BIG.h, face: 1, grounded: false, coyote: 0, jbuf: 0, jHeld: 0, jCut: false,
      dashT: 0, dashCool: 0, airDash: true, climb: 0, kickT: 0, small: false, hp: this.maxHp(), inv: 0, hurtT: 0,
      jabT: 0, jabHit: null, jabCool: 0, umb: false, dead: 0, fade: 0, land: 0, stepVis: 0, pushX: 0, walkT: 0, wind: 0 };
  }
  maxHp() { return 3 + this.springs.size; }
  save() {
    return { has: [...this.has], medals: [...this.medals], springs: [...this.springs], flags: this.flags, awake: [...this.awake],
      visited: [...this.visited], bench: this.bench, time: this.time, deaths: this.deaths };
  }

  // ---------- map
  rebuildMap() {
    this.map = this.base.map(r => r.slice());
    for (const [f, list] of Object.entries(L.MODS)) if (this.flags[f]) this.applyMod(list);
    if (this.boss && this.boss.lock) for (const [x0, y0, x1, y1] of this.boss.lock) this.fill(x0, y0, x1, y1, 'D');
    this.mapVer = (this.mapVer || 0) + 1;
  }
  applyMod(list) { for (const [x0, y0, x1, y1, c] of list) this.fill(x0, y0, x1, y1, c); }
  fill(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.map[y][x] = c; }
  setFlag(f) { if (this.flags[f]) return; this.flags[f] = true; this.rebuildMap(); this.ev.push({ t: 'flag', f }); }
  tile(tx, ty) { if (tx < 0 || tx >= L.W || ty >= L.H) return '#'; if (ty < 0) return '.'; return this.map[ty][tx]; }
  solid(tx, ty) { return L.SOLID.has(this.tile(tx, ty)); }
  anyTile(x0, y0, x1, y1, pred) {
    for (let ty = Math.floor(y0); ty <= Math.floor(y1 - 1e-6); ty++) for (let tx = Math.floor(x0); tx <= Math.floor(x1 - 1e-6); tx++) if (pred(this.tile(tx, ty), tx, ty)) return { tx, ty };
    return null;
  }
  boxSolid(x0, y0, x1, y1) { return this.anyTile(x0, y0, x1, y1, c => L.SOLID.has(c)); }
  inDraft(x, y) { return UPDRAFTS.some(u => x >= u.x0 && x <= u.x1 && y >= u.y0 && y <= u.y1); }

  roomAt(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    for (const r of L.ROOMS) {
      if (tx < r.x0 || tx > r.x1 || ty < r.y0 || ty > r.y1) continue;
      if (r.attic && ty < L.roofY(tx) + 1) continue;
      if (r.roof && ty >= L.roofY(tx) + 1 && tx > 0 && tx < 72) continue;
      return r;
    }
    return null;
  }

  // ---------- enemies
  resetEnemies() {
    this.enemies = L.ENEMIES.map((e, i) => {
      const o = { id: i, k: e.k, hx: e.x + 0.5, hy: e.y + 1, x: e.x + 0.5, y: e.y + 1, hp: e.k === 'bunny' || e.k === 'mouse' ? 2 : 1, dir: i % 2 ? 1 : -1, t: i * 1.7, flash: 0, vx: 0, vy: 0 };
      if (e.k === 'moth') { o.y = e.y + 0.5; o.hy = o.y; }
      if (e.k === 'spider') { o.ay = e.y; o.len = 0.6; o.max = 1; for (let d = 1; d < 9; d++) { if (this.solid(e.x, e.y + d)) break; o.max = d - 0.6; } o.y = o.ay + o.len; }
      return o;
    });
  }
  enemyBox(e) {
    if (e.k === 'moth') return [e.x - 0.35, e.y - 0.3, e.x + 0.35, e.y + 0.3];
    if (e.k === 'spider') return [e.x - 0.32, e.y - 0.3, e.x + 0.32, e.y + 0.3];
    if (e.k === 'mouse') return [e.x - 0.45, e.y - 0.5, e.x + 0.45, e.y];
    return [e.x - 0.4, e.y - 0.62, e.x + 0.4, e.y];
  }
  updateEnemies(dt) {
    const p = this.p;
    for (const e of this.enemies) {
      if (e.dead) { e.dead += dt; continue; }
      e.t += dt; e.flash = Math.max(0, e.flash - dt);
      if (Math.abs(e.x - p.x) > 22 || Math.abs(e.y - p.y) > 16) continue; // asleep off screen
      if (e.kb) { e.x += e.kb * dt; e.kb *= Math.pow(0.02, dt); if (Math.abs(e.kb) < 0.2) e.kb = 0; if (e.k !== 'moth' && e.k !== 'spider') this.walkerClamp(e); }
      if (e.k === 'moth') {
        const dx = p.x - e.x, dy = (p.y - p.h * 0.6) - e.y, d = Math.hypot(dx, dy);
        let tx = e.hx + Math.sin(e.t * 0.9) * 1.4, ty = e.hy + Math.sin(e.t * 1.7) * 0.6;
        if (d < 6 && this.roomAt(p.x, p.y - 0.5) === this.roomAt(e.hx, e.hy)) { tx = p.x; ty = p.y - p.h * 0.6; }
        const ax = clamp(tx, e.hx - 5, e.hx + 5) - e.x, ay = clamp(ty, e.hy - 3, e.hy + 3) - e.y, ad = Math.hypot(ax, ay) || 1;
        const sp = d < 6 ? 1.7 : 1.1;
        const nx = e.x + ax / ad * Math.min(sp * dt, ad), ny = e.y + ay / ad * Math.min(sp * dt, ad) + Math.sin(e.t * 9) * 0.01;
        if (!this.solid(Math.floor(nx), Math.floor(ny))) { e.x = nx; e.y = ny; }
        e.dir = ax > 0 ? 1 : -1;
      } else if (e.k === 'spider') {
        const below = Math.abs(p.x - e.x) < 2.2 && p.y > e.ay && p.y - e.ay < 11;
        const want = below ? e.max : 0.6;
        e.len += clamp(want - e.len, -2.5 * dt, (below ? 6 : 2.5) * dt);
        e.y = e.ay + e.len;
      } else {
        const sp = e.k === 'mouse' ? 3.6 : 1.25;
        if (!e.kb) {
          const nx = e.x + e.dir * sp * dt;
          const fx = Math.floor(nx + e.dir * 0.45), fy = Math.floor(e.y - 0.3);
          const ground = L.SOLID.has(this.tile(fx, Math.floor(e.y + 0.1))) || L.ONEWAY.has(this.tile(fx, Math.floor(e.y + 0.1)));
          const hazard = this.tile(fx, Math.floor(e.y - 0.1)) === '^';
          if (this.solid(fx, fy) || !ground || hazard) e.dir *= -1; else e.x = nx;
        }
      }
    }
  }
  walkerClamp(e) {
    const fx = Math.floor(e.x + Math.sign(e.kb) * 0.45);
    const ground = L.SOLID.has(this.tile(fx, Math.floor(e.y + 0.1))) || L.ONEWAY.has(this.tile(fx, Math.floor(e.y + 0.1)));
    if (this.solid(fx, Math.floor(e.y - 0.3)) || !ground) { e.x -= e.kb * 0.02; e.kb = 0; }
  }

  // ---------- main tick
  tick(dt, inp) {
    if (this.hitstop > 0) { this.hitstop -= dt; dt *= 0.08; }
    this.time += dt;
    const p = this.p;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.updateParts(dt);
    this.updateParade(dt);
    if (p.dead) { this.updateDeath(dt); return; }
    if (p.fade) { p.fade -= dt; if (p.fade <= 0) { p.fade = 0; p.x = this.safe.x; p.y = this.safe.y; p.vx = p.vy = 0; p.inv = 1; this.ev.push({ t: 'respawn' }); } return; }
    this.updatePlayer(dt, inp);
    this.updateEnemies(dt);
    if (this.boss) this.boss.update(this, dt);
    this.checkBossStart();
    this.contacts(dt);
    this.pickups(inp);
    // room tracking
    const r = this.roomAt(p.x, p.y - p.h / 2);
    if (r && r !== this.room) {
      this.room = r;
      if (!this.visited.has(r.id)) { this.visited.add(r.id); this.ev.push({ t: 'room', id: r.id, first: true }); }
      else this.ev.push({ t: 'room', id: r.id });
    }
    // walk out on a boss (the kitchen window, mid cat fight) and it stands down; it starts afresh when you come back
    if (this.boss && this.boss.state !== 'dying' && this.room && this.room.id !== L.BOSSES[this.boss.kind].room) {
      this.bossAway = (this.bossAway || 0) + dt;
      if (this.bossAway > 1.2) { this.boss = null; this.bossAway = 0; this.rebuildMap(); this.ev.push({ t: 'bossleft' }); }
    } else this.bossAway = 0;
  }

  updatePlayer(dt, inp) {
    const p = this.p;
    p.inv = Math.max(0, p.inv - dt); p.hurtT = Math.max(0, p.hurtT - dt); p.dashCool = Math.max(0, p.dashCool - dt);
    p.jabCool = Math.max(0, p.jabCool - dt); p.land = Math.max(0, p.land - dt * 4); p.stepVis *= Math.pow(0.0005, dt);
    p.kickT = Math.max(0, p.kickT - dt); p.wind += dt * (p.dashT > 0 ? 30 : 4);
    let dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (p.hurtT > 0) dir = 0;
    if (p.kickT > 0) dir = 0;
    if (inp.jumpPressed) p.jbuf = 0.13; else p.jbuf = Math.max(0, p.jbuf - dt);
    const run = p.small ? SMALL_RUN : RUN;

    // shrink / grow
    if (inp.shrink && this.has.has('thimble')) {
      if (!p.small) { this.setSize(true); this.ev.push({ t: 'shrink' }); this.tutor.shrink = (this.tutor.shrink || 0) + 1; }
      else {
        // a small soldier can stand closer to a wall than a big one fits: shuffle sideways to make room
        const fit = [0, 0.13, -0.13].find(o => !this.boxSolid(p.x + o - BIG.w / 2, p.y - BIG.h, p.x + o + BIG.w / 2, p.y));
        if (fit !== undefined) { p.x += fit; this.setSize(false); this.ev.push({ t: 'grow' }); }
        else this.ev.push({ t: 'noroom' });
      }
    }
    // dash
    if (inp.dash && this.has.has('key') && p.dashCool <= 0 && p.dashT <= 0 && (p.grounded || p.airDash || p.climb)) {
      p.dashT = DASH_T; p.dashCool = 0.42; if (!p.grounded) p.airDash = false;
      const d = dir || p.face; if (p.climb) { p.face = -p.climb; } else p.face = d;
      p.climb = 0; p.vy = 0; p.umb = false;
      this.ev.push({ t: 'dash' }); this.tutor.dash = (this.tutor.dash || 0) + 1;
    }
    // jab
    if (inp.jab && p.jabCool <= 0 && p.hurtT <= 0) { p.jabT = 0.24; p.jabCool = 0.3; p.jabHit = new Set(); this.ev.push({ t: 'jab' }); this.tutor.jab = (this.tutor.jab || 0) + 1; }
    if (p.jabT > 0) { p.jabT -= dt; if (p.jabT < 0.21 && p.jabT > 0.06) this.jabHits(); }

    if (p.dashT > 0) {
      p.dashT -= dt; p.vx = p.face * DASH_V; p.vy = 0;
      if (Math.random() < 0.6) this.part('puff', p.x - p.face * 0.3, p.y - p.h * 0.4, { vx: -p.face * 2 });
    } else if (p.climb) {
      // magnet boots: walking into iron walks you up it
      const into = dir === p.climb;
      if (inp.jumpPressed || p.jbuf > 0.12) {
        p.climb = 0; p.vx = -p.face * 7.5; p.face = -p.face; p.vy = -13.5; p.kickT = 0.14; p.jbuf = 0; p.jHeld = 0; p.jCut = false;
        this.ev.push({ t: 'kick' });
      } else if (dir === -p.climb) { p.climb = 0; p.vx = dir * 3; p.face = dir; }
      else {
        p.vx = 0; p.vy = into ? -CLIMB_V : 0;
        if (into) p.walkT += dt * 1.4;
        if (!this.ironBeside(p.climb)) { // over the top: pop up onto it
          p.vy = into ? -10.5 : 0; p.vx = p.climb * 3.2; const side = p.climb; p.climb = 0; p.face = side;
          if (!into) p.vy = 2;
        }
      }
    } else {
      // walking: snappy on the ground, a little floaty in the air
      const target = dir * run;
      const acc = p.grounded ? 70 : 38;
      if (p.kickT > 0) { /* keep kick velocity */ } else p.vx += clamp(target - p.vx, -acc * dt, acc * dt);
      if (dir) p.face = dir;
      // gravity, umbrella and warm air
      const draft = this.inDraft(p.x, p.y - p.h * 0.5);
      const wantUmb = this.has.has('umbrella') && !p.grounded && inp.jumpHeld && (p.vy > -1.5 || (draft && p.umb));
      if (wantUmb && !p.umb) { this.ev.push({ t: 'umbrella' }); this.tutor.float = (this.tutor.float || 0) + 1; }
      p.umb = wantUmb || (p.umb && inp.jumpHeld && !p.grounded);
      if (p.umb && draft) { p.vy += (DRAFT_V - p.vy) * Math.min(1, dt * 3.5); this.tutor.draft = (this.tutor.draft || 0) + dt; }
      else {
        p.vy += G * dt * (p.vy < 0 && !inp.jumpHeld && p.jHeld > 0.14 ? 1.9 : 1);
        if (p.umb) p.vy = Math.min(p.vy, FLOAT_FALL);
      }
      p.vy = Math.min(p.vy, MAXFALL);
      // jump
      if (p.jbuf > 0 && (p.grounded || p.coyote > 0)) {
        p.vy = -(p.small ? SMALL_JUMP_V : JUMP_V); p.grounded = false; p.coyote = 0; p.jbuf = 0; p.jHeld = 0.0001; p.jCut = false;
        this.ev.push({ t: 'jump' }); this.tutor.jump = (this.tutor.jump || 0) + 1;
      }
      if (p.jHeld > 0) {
        p.jHeld += dt;
        if (!inp.jumpHeld && !p.jCut && p.jHeld > 0.14 && p.vy < 0) { p.vy *= 0.45; p.jCut = true; }
        if (p.vy >= 0) p.jHeld = 0;
      }
    }
    // move
    const wasGround = p.grounded;
    const dx = (p.vx + p.pushX) * dt, dy = p.vy * dt;
    p.pushX = 0;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.3));
    let hitX = false, landed = false;
    for (let i = 0; i < n; i++) { if (this.moveX(dx / n, dir)) hitX = true; const r = this.moveY(dy / n); if (r === 'land') landed = true; }
    if (hitX && p.dashT > 0) p.dashT = 0;
    // grounded probe
    p.grounded = p.vy >= 0 && this.standing();
    if (p.grounded) {
      if (!wasGround) { p.land = 1; this.ev.push({ t: 'land', v: p.vy }); this.part('dust', p.x, p.y); }
      p.coyote = 0.1; p.airDash = true; p.vy = 0; p.umb = false; p.jHeld = 0;
      if (dir) p.walkT += dt * (p.small ? 1.5 : 1);
      this.trackSafe(dt);
    } else p.coyote = Math.max(0, p.coyote - dt);
    if (p.climb) { p.airDash = true; }
    // start climbing iron
    if (!p.climb && p.dashT <= 0 && this.has.has('boots') && dir && p.kickT <= 0 && this.ironBeside(dir)) {
      p.climb = dir; p.face = dir; p.vx = 0; p.umb = false; if (p.vy > 0) p.vy = 0;
      this.ev.push({ t: 'clank' }); this.tutor.climb = (this.tutor.climb || 0) + 1;
    }
    // hazards
    const hz = this.anyTile(p.x - p.w / 2 + 0.12, p.y - p.h + 0.2, p.x + p.w / 2 - 0.12, p.y - 0.05, c => c === '^');
    if (hz && p.inv <= 0.4) this.hurt(1, 0, true);
    // fell out of the world
    if (p.y > L.H + 2) this.hurt(1, 0, true);
  }
  setSize(small) {
    const p = this.p; p.small = small; const s = small ? SMALL : BIG; p.w = s.w; p.h = s.h;
    if (small) for (let i = 0; i < 6; i++) this.part('spark', p.x, p.y - 0.4);
  }
  ironBeside(dir) {
    const p = this.p;
    const x = dir > 0 ? p.x + p.w / 2 + 0.06 : p.x - p.w / 2 - 0.06;
    const tx = Math.floor(x);
    const y0 = p.y - p.h + 0.1, y1 = p.y - 0.2;
    for (let ty = Math.floor(y0); ty <= Math.floor(y1); ty++) if (L.IRON.has(this.tile(tx, ty))) return true;
    return false;
  }
  moveX(dx, dir) {
    const p = this.p; if (!dx) return false;
    const nx = p.x + dx;
    const x0 = nx - p.w / 2, x1 = nx + p.w / 2, y0 = p.y - p.h, y1 = p.y;
    const hit = this.boxSolid(x0, y0 + 0.001, x1, y1 - 0.001);
    if (!hit) { p.x = nx; return false; }
    // stair step: a one-tile rise you are walking into
    if (p.grounded && !p.small && !p.climb && hit.ty === Math.floor(y1 - 0.01) && !this.boxSolid(x0, y0 - 1, x1, y1 - 1 - 0.001) && !(this.has.has('boots') && this.ironBeside(Math.sign(dx)))) {
      const ny = hit.ty; // new feet
      if (!this.boxSolid(x0, ny - p.h, x1, ny - 0.001)) { p.stepVis += p.y - ny; p.y = ny; p.x = nx; return false; }
    }
    if (dx > 0) p.x = Math.floor(x1 - 1e-6) - p.w / 2 - 0.0001; else p.x = Math.floor(x0) + 1 + p.w / 2 + 0.0001;
    if (!p.dashT) p.vx = 0;
    return true;
  }
  moveY(dy) {
    const p = this.p; if (!dy) return null;
    const ny = p.y + dy, x0 = p.x - p.w / 2 + 0.001, x1 = p.x + p.w / 2 - 0.001;
    if (dy > 0) {
      // solid tops and one-way shelves whose tops the feet cross this step
      for (let ty = Math.ceil(p.y - 0.001); ty <= Math.floor(ny); ty++) {
        for (let tx = Math.floor(x0); tx <= Math.floor(x1); tx++) {
          const c = this.tile(tx, ty);
          if (L.SOLID.has(c) || L.ONEWAY.has(c)) { p.y = ty; p.vy = 0; return 'land'; }
        }
      }
      const hit = this.boxSolid(x0, ny - p.h, x1, ny);
      if (hit) { p.y = hit.ty; p.vy = 0; return 'land'; }
      p.y = ny; return null;
    } else {
      const hit = this.boxSolid(x0, ny - p.h, x1, p.y - 0.01);
      if (hit) { p.y = hit.ty + 1 + p.h + 0.0001; if (p.vy < 0) p.vy = 0; if (p.climb) p.vy = 0; return 'bonk'; }
      p.y = ny; return null;
    }
  }
  standing() {
    const p = this.p; const ty = Math.floor(p.y + 0.02);
    if (Math.abs(p.y - ty) > 0.03) return false;
    for (let tx = Math.floor(p.x - p.w / 2 + 0.001); tx <= Math.floor(p.x + p.w / 2 - 0.001); tx++) {
      const c = this.tile(tx, ty); if (L.SOLID.has(c) || L.ONEWAY.has(c)) { p.y = ty; return true; }
    }
    return false;
  }
  trackSafe(dt) {
    const p = this.p;
    if (this.boss || p.climb) return;
    const ty = Math.floor(p.y + 0.02);
    for (let tx = Math.floor(p.x - 1.4); tx <= Math.floor(p.x + 1.4); tx++) {
      if (this.tile(tx, ty - 1) === '^') return;
      const below = this.tile(tx, ty);
      if (!L.SOLID.has(below) && !L.ONEWAY.has(below)) return; // near an edge: not safe
    }
    this.safe = { x: p.x, y: p.y };
  }

  // ---------- combat
  jabBox() {
    const p = this.p, s = p.small ? 0.55 : 1;
    const a = p.x + p.face * p.w * 0.4, b = p.x + p.face * (p.w / 2 + 1.15 * s);
    return [Math.min(a, b), p.y - p.h * 0.88, Math.max(a, b), p.y - p.h * 0.28];
  }
  jabHits() {
    const p = this.p, jb = this.jabBox();
    for (const e of this.enemies) {
      if (e.dead || p.jabHit.has(e)) continue;
      if (overlap(jb, this.enemyBox(e))) {
        p.jabHit.add(e); e.hp -= 1; e.flash = 0.15; e.kb = p.face * 7;
        this.hitstop = 0.05; this.ev.push({ t: 'hit', x: e.x, y: e.y });
        for (let i = 0; i < 5; i++) this.part('spark', (jb[0] + jb[2]) / 2, (jb[1] + jb[3]) / 2);
        if (e.hp <= 0) { e.dead = 0.001; this.ev.push({ t: 'pop', x: e.x, y: e.y, k: e.k }); for (let i = 0; i < 10; i++) this.part('fluff', e.x, e.y - 0.2, { k2: e.k }); }
        if (!p.grounded) { p.vy = Math.min(p.vy, -4); }
      }
    }
    if (this.boss && !p.jabHit.has(this.boss)) {
      const r = this.boss.hitTest(jb, this);
      if (r) { p.jabHit.add(this.boss); this.hitstop = 0.07; for (let i = 0; i < 7; i++) this.part('spark', (jb[0] + jb[2]) / 2, (jb[1] + jb[3]) / 2); if (!p.grounded) p.vy = Math.min(p.vy, -5); }
    }
    // the back door bolt, from the garden side
    if (!this.flags.backDoor && p.x > 72.6 && !(this.boss && this.boss.kind === 'cat') && overlap(jb, [72, 33, 73, 36])) {
      this.setFlag('backDoor'); this.ev.push({ t: 'door', id: 'backDoor' });
    }
  }
  contacts() {
    const p = this.p; if (p.inv > 0 || p.dead || p.fade) return;
    const pb = [p.x - p.w / 2 + 0.08, p.y - p.h + 0.1, p.x + p.w / 2 - 0.08, p.y];
    for (const e of this.enemies) if (!e.dead && overlap(pb, this.enemyBox(e))) { this.hurt(1, Math.sign(p.x - e.x) || 1); return; }
    if (this.boss) { const h = this.boss.hurts(pb, this); if (h) this.hurt(1, h); }
  }
  hurt(n, dir, hazard) {
    const p = this.p; if (p.inv > 0 && !hazard) return; if (p.dead || p.fade) return;
    p.hp -= n; p.inv = 1.1; this.shake = 0.5; this.hitstop = 0.08; this.ev.push({ t: 'hurt' });
    p.climb = 0; p.dashT = 0; p.umb = false;
    for (let i = 0; i < 8; i++) this.part('spark', p.x, p.y - p.h * 0.6, { red: 1 });
    if (p.hp <= 0) { p.dead = 0.001; p.vy = -6; p.vx = -p.face * 2; this.deaths++; this.ev.push({ t: 'die' }); return; }
    if (hazard) { p.fade = 0.55; p.vx = 0; p.vy = 0; this.ev.push({ t: 'ouch' }); return; }
    p.hurtT = 0.28; p.vx = (dir || -p.face) * 7; p.vy = -7.5; p.kickT = 0;
  }
  updateDeath(dt) {
    const p = this.p; p.dead += dt;
    if (p.dead < 0.9) { p.vy += G * dt; this.moveY(p.vy * dt); this.moveX(p.vx * dt, 0); if (this.standing()) { p.vx *= 0.8; } }
    if (p.dead > 2.2) this.respawn();
  }
  respawn() {
    const p = this.p;
    const st = this.bench && L.STANDS.find(b => b.id === this.bench);
    const at = st ? { x: st.x + 0.5, y: st.y + 1 } : { x: L.START.x + 0.5, y: L.START.y + 1 };
    if (this.boss) { this.boss = null; this.rebuildMap(); }
    const small = false;
    Object.assign(p, this.newPlayer(), { x: at.x, y: at.y, inv: 1.2 });
    if (small) this.setSize(true);
    this.safe = { x: at.x, y: at.y }; this.restLock = st ? st.id : null;
    this.resetEnemies();
    this.ev.push({ t: 'respawn', dead: true });
  }

  // ---------- pickups and things you stand beside
  pickups(inp) {
    const p = this.p, cx = p.x, cy = p.y - p.h / 2;
    const near = (x, y, r) => Math.abs(x + 0.5 - cx) < r + p.w / 2 && Math.abs(y + 0.5 - cy) < r + p.h / 2;
    for (const it of L.ITEMS) {
      if (this.has.has(it.id) || (it.boss && !this.flags[it.boss])) continue;
      if (near(it.x, it.y, 0.4)) { this.has.add(it.id); this.ev.push({ t: 'ability', id: it.id }); for (let i = 0; i < 16; i++) this.part('spark', it.x + 0.5, it.y + 0.5, { gold: 1 }); }
    }
    for (const m of L.MEDALS) if (!this.medals.has(m.id) && near(m.x, m.y, 0.45)) { this.medals.add(m.id); this.ev.push({ t: 'medal', id: m.id }); for (let i = 0; i < 12; i++) this.part('spark', m.x + 0.5, m.y + 0.5, { gold: 1 }); }
    for (const s of L.SPRINGS) if (!this.springs.has(s.id) && near(s.x, s.y, 0.3)) { this.springs.add(s.id); p.hp = this.maxHp(); this.ev.push({ t: 'spring', id: s.id }); }
    // winding stands
    this.near.stand = null;
    for (const s of L.STANDS) {
      const close = Math.abs(s.x + 0.5 - p.x) < 0.9 && Math.abs(s.y + 1 - p.y) < 0.6;
      if (close) this.near.stand = s;
      if (close && p.grounded && this.restLock !== s.id && !this.boss) {
        this.restLock = s.id; this.bench = s.id; p.hp = this.maxHp(); this.resetEnemies(); this.ev.push({ t: 'rest', id: s.id });
      }
      if (this.restLock === s.id && Math.abs(s.x + 0.5 - p.x) > 3) this.restLock = null;
    }
    // notes
    this.near.note = L.NOTES.find(n => Math.abs(n.x + 0.5 - p.x) < 1.3 && Math.abs(n.y + 1 - p.y) < 1.2) || null;
    // toys
    this.near.toy = null;
    for (const t of L.TOYS) {
      if (this.awake.has(t.id)) continue;
      if (Math.abs(t.x + 0.5 - p.x) < 1.8 && Math.abs(t.y + 1 - p.y) < 2.2) this.near.toy = t;
    }
    if (inp.use && this.near.toy && this.has.has('musicbox')) this.wake(this.near.toy);
  }
  wake(t) {
    this.awake.add(t.id); this.ev.push({ t: 'wake', id: t.id });
    for (let i = 0; i < 14; i++) this.part('note', t.x + 0.5, t.y + 0.3);
    if (t.id === 'blocks') { this.setFlag('blocks'); return; }
    this.parade.push({ id: t.id, x: t.x + 0.5, y: t.y + 1, t: 0 });
  }
  updateParade(dt) {
    for (const a of this.parade) {
      a.t += dt;
      if (a.t > 2.4 && !a.done) {
        a.done = true; this.doorToys.push(a.id); this.ev.push({ t: 'atdoor', id: a.id });
        if (L.TOYS.filter(t => t.door).every(t => this.doorToys.includes(t.id))) { this.setFlag('parlourDoor'); this.ev.push({ t: 'door', id: 'parlourDoor' }); }
      }
    }
    this.parade = this.parade.filter(a => !a.done);
  }

  // ---------- bosses
  checkBossStart() {
    const p = this.p; if (this.boss || p.dead || p.fade) return;
    const r = this.room && this.room.id;
    if (!this.flags.jack && r === 'nursery' && p.grounded && p.x < 65.5) this.boss = new Jack(this);
    else if (!this.flags.cat && r === 'garden' && p.x > 75.5 && p.grounded) this.boss = new Cat(this);
    else if (!this.flags.vacuum && r === 'parlour' && p.x < 20.5 && p.grounded) this.boss = new Vacuum(this);
    if (this.boss) { this.rebuildMap(); this.ev.push({ t: 'boss', id: this.boss.kind, name: L.BOSSES[this.boss.kind].name }); }
  }
  bossDown(kind) {
    this.ev.push({ t: 'bossdown', id: kind });
    this.flags[kind] = true;
    const b = this.boss; this.boss = null;
    if (kind === 'jack') { this.flags.nurseryDoor = true; }
    if (kind === 'vacuum') { this.flags.parlourDoor = true; this.ev.push({ t: 'ending' }); }
    this.rebuildMap();
    this.p.hp = this.maxHp();
  }

  // ---------- particles (kept here so a sim can count them, drawn by art.js)
  part(k, x, y, o = {}) {
    if (this.parts.length > 400) return;
    const a = rnd() * Math.PI * 2, s = 1 + rnd() * 4;
    this.parts.push(Object.assign({ k, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, t: 0, life: k === 'note' ? 1.8 : k === 'dust' ? 0.45 : 0.6 + rnd() * 0.4, r: rnd() }, o,
      o.vx !== undefined ? { vx: o.vx + (rnd() - 0.5) } : {}));
  }
  updateParts(dt) {
    for (const q of this.parts) {
      q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.k === 'note') { q.vy = -1.2; q.vx = Math.sin(q.t * 4 + q.r * 6) * 1.2; }
      else if (q.k === 'puff' || q.k === 'dust') { q.vx *= 0.9; q.vy = -0.4; }
      else q.vy += 12 * dt;
    }
    this.parts = this.parts.filter(q => q.t < q.life);
  }
}

export function overlap(a, b) { return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]; }

// ================= BOSSES
class Jack {
  constructor(g) {
    this.kind = 'jack'; this.hp = 6; this.max = 6; this.x = 54; this.y = 25; this.state = 'intro'; this.t = 0;
    this.hx = this.x; this.hy = this.y - 1.2; this.out = 0; this.flash = 0; this.aims = 0; this.waves = []; this.lid = 0;
    this.lock = null; this.hop = null;
  }
  get headRest() { return [this.x, this.y - 3.6]; }
  update(g, dt) {
    this.t += dt; this.flash = Math.max(0, this.flash - dt);
    const p = g.p;
    for (const w of this.waves) { w.x += w.v * dt; w.t += dt; }
    this.waves = this.waves.filter(w => w.x > 49 && w.x < 66);
    const [rx, ry] = this.headRest;
    const go = (s) => { this.state = s; this.t = 0; };
    switch (this.state) {
      case 'intro': this.lid = 0; this.hx = this.x; this.hy = this.y - 1.2; if (this.t > 1.4) go('pop'); break;
      case 'closed': this.lid = 0; this.hx = this.x; this.hy = this.y - 1.2; if (this.t > (this.hp <= 3 ? 0.6 : 1.0)) go(this.hp <= 3 && this.hopNext ? 'hop' : 'pop'); break;
      case 'pop': this.lid = Math.min(1, this.t * 6); this.hx = rx; this.hy = (this.y - 1.2) + (ry - (this.y - 1.2)) * Math.min(1, this.t / 0.25);
        if (this.t > 0.35) { g.ev.push({ t: 'boing' }); go('aim'); } break;
      case 'aim': {
        this.hx = rx + Math.sin(this.t * 14) * 0.08; this.hy = ry + Math.sin(this.t * 9) * 0.1;
        const tx = p.x, ty = p.y - p.h * 0.55; const dx = tx - rx, dy = ty - ry, d = Math.hypot(dx, dy) || 1, m = Math.min(d, 7.5);
        this.tx = rx + dx / d * m; this.ty = Math.min(ry + dy / d * m, this.y - 0.5);
        if (this.t > (this.hp <= 3 ? 0.55 : 0.75)) { go('lunge'); this.sx = this.hx; this.sy = this.hy; g.ev.push({ t: 'whoosh' }); }
        break;
      }
      case 'lunge': { const k = Math.min(1, this.t / 0.22), e = 1 - Math.pow(1 - k, 3); this.hx = this.sx + (this.tx - this.sx) * e; this.hy = this.sy + (this.ty - this.sy) * e; if (k >= 1) { go('stuck'); g.shake = 0.25; g.ev.push({ t: 'thud' }); } break; }
      case 'stuck': this.hx = this.tx + Math.sin(this.t * 22) * 0.12 * Math.max(0, 1 - this.t); this.hy = this.ty; if (this.t > 1.25) go('retract'); break;
      case 'retract': { const k = Math.min(1, this.t / 0.4); this.hx = this.tx + (rx - this.tx) * k; this.hy = this.ty + (ry - this.ty) * k;
        if (k >= 1) { this.aims++; if (this.aims >= (this.hp <= 3 ? 2 : 2)) { this.aims = 0; this.hopNext = this.hp <= 3; go('shut'); } else go('aim'); } break; }
      case 'shut': { const k = Math.min(1, this.t / 0.25); this.hy = ry + ((this.y - 1.2) - ry) * k; this.hx = rx; this.lid = 1 - k; if (k >= 1) go('closed'); break; }
      case 'hop': {
        if (!this.hop) { let nx; do { nx = 50.5 + rnd() * 14; } while (Math.abs(nx - p.x) < 4 || Math.abs(nx - this.x) < 3); this.hop = { x0: this.x, x1: nx }; g.ev.push({ t: 'boing' }); }
        const k = Math.min(1, this.t / 0.7); this.x = this.hop.x0 + (this.hop.x1 - this.hop.x0) * k; this.y = 25 - Math.sin(k * Math.PI) * 4;
        this.hx = this.x; this.hy = this.y - 1.2;
        if (k >= 1) { this.y = 25; this.hop = null; this.hopNext = false; g.shake = 0.45; g.ev.push({ t: 'thud' });
          this.waves.push({ x: this.x - 0.9, v: -8, t: 0 }, { x: this.x + 0.9, v: 8, t: 0 }); go('pop'); }
        break;
      }
      case 'dying': this.hx = rx + Math.sin(this.t * 3) * 1.2 * Math.max(0, 1 - this.t / 2); this.hy = ry + this.t * 0.6;
        if (Math.random() < 0.4) g.part('confetti', this.hx, this.hy);
        if (this.t > 2.2) { g.bossDown('jack'); g.ev.push({ t: 'door', id: 'nurseryDoor' }); } break;
    }
  }
  hitTest(jb, g) {
    if (this.state === 'dying' || this.state === 'intro' || this.state === 'closed' || this.state === 'hop') return false;
    const r = 0.75;
    if (!overlap(jb, [this.hx - r, this.hy - r, this.hx + r, this.hy + r])) return false;
    this.hp--; this.flash = 0.2; g.ev.push({ t: 'bosshit' }); g.shake = 0.3;
    if (this.hp <= 0) { this.state = 'dying'; this.t = 0; this.waves = []; g.ev.push({ t: 'bossdie' }); }
    else if (this.state === 'stuck' || this.state === 'aim') { this.state = 'retract'; this.t = 0; this.tx = this.hx; this.ty = this.hy; }
    return true;
  }
  hurts(pb) {
    for (const w of this.waves) if (overlap(pb, [w.x - 0.35, 24.35, w.x + 0.35, 25])) return Math.sign(w.v);
    if (this.state === 'lunge' || (this.state === 'stuck' && this.t < 0.1)) {
      const r = 0.6; if (overlap(pb, [this.hx - r, this.hy - r, this.hx + r, this.hy + r])) return Math.sign(((pb[0] + pb[2]) / 2) - this.hx) || 1;
    }
    return 0;
  }
}

class Cat {
  constructor(g) {
    this.kind = 'cat'; this.hp = 7; this.max = 7; this.state = 'intro'; this.t = 0; this.flash = 0;
    this.paws = []; this.tail = null; this.cycle = 0; this.peek = 0; this.lock = null; this.eye = 0;
  }
  update(g, dt) {
    this.t += dt; this.flash = Math.max(0, this.flash - dt);
    const p = g.p; const go = (s) => { this.state = s; this.t = 0; };
    this.peek += ((this.state === 'dying' ? 0 : 1) - this.peek) * Math.min(1, dt * 2);
    this.eye = p.x;
    for (const w of this.paws) {
      w.t += dt;
      if (w.s === 'aim') { if (w.t < w.lockAt) w.x = clamp(p.x, 74.5, 93.5); if (w.t > w.lockAt + 0.4) { w.s = 'slam'; w.t = 0; } }
      else if (w.s === 'slam') { w.y = 22 + 14 * Math.min(1, w.t / 0.12); if (w.t >= 0.12) { w.s = 'down'; w.t = 0; g.shake = 0.45; g.ev.push({ t: 'thud' }); for (let i = 0; i < 8; i++) g.part('dust', w.x + (rnd() - 0.5) * 2, 36); } }
      else if (w.s === 'down') { w.y = 36; if (w.t > (this.hp <= 4 ? 0.9 : 1.2)) { w.s = 'lift'; w.t = 0; } }
      else if (w.s === 'lift') { w.y = 36 - 14 * Math.min(1, w.t / 0.35); if (w.t > 0.35) w.gone = true; }
    }
    this.paws = this.paws.filter(w => !w.gone);
    if (this.tail) { this.tail.x -= 10.5 * dt; if (this.tail.x < 70) this.tail = null; }
    switch (this.state) {
      case 'intro': if (this.t > 1.8) go('idle'); break;
      case 'idle':
        if (this.t > (this.hp <= 4 ? 0.5 : 0.9) && !this.paws.length && !this.tail) {
          this.cycle++;
          if (this.hp <= 5 && this.cycle % 3 === 0) { this.tail = { x: 97 }; g.ev.push({ t: 'swish' }); }
          else {
            this.paws.push({ x: clamp(p.x, 74.5, 93.5), y: 22, s: 'aim', t: 0, lockAt: 0.55 });
            if (this.hp <= 4) this.paws.push({ x: clamp(p.x, 74.5, 93.5), y: 22, s: 'aim', t: -0.8, lockAt: 0.5 });
            g.ev.push({ t: 'mew' });
          }
          go('idle');
        }
        break;
      case 'dying': if (this.t > 2.4) { g.bossDown('cat'); } break;
    }
  }
  pawBox(w) { return [w.x - 1.15, w.y - 1.3, w.x + 1.15, w.y]; }
  hitTest(jb, g) {
    if (this.state === 'dying') return false;
    for (const w of this.paws) if ((w.s === 'down' || w.s === 'lift') && overlap(jb, this.pawBox(w))) {
      this.hp--; this.flash = 0.2; g.ev.push({ t: 'bosshit' }); g.shake = 0.3;
      if (this.hp <= 0) { this.state = 'dying'; this.t = 0; this.paws.forEach(q => { q.s = 'lift'; q.t = 0; }); this.tail = null; g.ev.push({ t: 'yowl' }); }
      else if (w.s === 'down') { w.s = 'lift'; w.t = 0; g.ev.push({ t: 'hiss' }); }
      return true;
    }
    return false;
  }
  hurts(pb) {
    for (const w of this.paws) if (w.s === 'slam' && overlap(pb, this.pawBox(w))) return Math.sign((pb[0] + pb[2]) / 2 - w.x) || 1;
    if (this.tail && overlap(pb, [this.tail.x + 0.3, 35.15, this.tail.x + 3.9, 36])) return -1;
    return 0;
  }
}

class Vacuum {
  constructor(g) {
    this.kind = 'vacuum'; this.hp = 9; this.max = 9; this.x = 10; this.y = 36; this.dir = 1; this.state = 'intro'; this.t = 0; this.flash = 0;
    this.turnT = 0; this.hits = 0; this.spit = 3; this.lock = [[22, 30, 22, 35]]; this.wob = 0;
  }
  get box() { return [this.x - 1.1, this.y - 2.4, this.x + 1.1, this.y]; }
  update(g, dt) {
    this.t += dt; this.flash = Math.max(0, this.flash - dt); this.wob += dt;
    const p = g.p; const go = (s) => { this.state = s; this.t = 0; };
    const sp = this.hp <= 5 ? 3.1 : 2.3;
    const suck = (k) => {
      const dx = p.x - this.x;
      if (Math.sign(dx) === this.dir && Math.abs(dx) < 9 && p.y > 32 && !p.dead) p.pushX += -this.dir * k * (1 - Math.abs(dx) / 11);
    };
    switch (this.state) {
      case 'intro': if (this.t > 1.6) go('roam'); break;
      case 'roam': {
        const want = Math.sign(p.x - this.x) || 1;
        if (want !== this.dir) { this.turnT += dt; if (this.turnT > 1.0) { this.dir = want; this.turnT = 0; } } else this.turnT = 0;
        this.x = clamp(this.x + this.dir * sp * dt, 2.3, 20.7);
        suck(this.hp <= 5 ? 6.5 : 5);
        if (this.hp <= 5) { this.spit -= dt; if (this.spit <= 0 && !g.solid(Math.floor(this.x + this.dir * 1.4), 35) && g.enemies.filter(e => e.k === 'bunny' && e.spat && !e.dead).length < 3) {
          this.spit = 4.5; g.enemies.push({ id: 900 + g.enemies.length, k: 'bunny', spat: true, x: this.x + this.dir * 1.4, y: 36, hx: this.x, hy: 36, hp: 1, dir: this.dir, t: 0, flash: 0, kb: this.dir * 5 }); g.ev.push({ t: 'spit' }); } }
        break;
      }
      case 'rev': this.x += Math.sin(this.t * 60) * 0.03; if (this.t > 0.8) { go('charge'); g.ev.push({ t: 'roar' }); } break;
      case 'charge': {
        this.x += this.dir * 12 * dt; suck(3);
        if (this.x < 2.3 || this.x > 20.7) { this.x = clamp(this.x, 2.3, 20.7); go('stun'); g.shake = 0.7; g.ev.push({ t: 'crash' }); this.dir *= -1; }
        break;
      }
      case 'stun': if (this.t > 1.6) go('roam'); break;
      case 'dying': this.x += Math.sin(this.t * 40) * 0.02; if (Math.random() < 0.5) g.part('puff', this.x, this.y - 2.4); if (this.t > 2.6) { g.bossDown('vacuum'); } break;
      case 'gone': break;
    }
  }
  hitTest(jb, g) {
    if (this.state === 'dying' || this.state === 'intro' || this.state === 'gone') return false;
    const [x0, y0, x1] = this.box;
    if (overlap(jb, [x0, y0 - 0.2, x1, y0 + 1.0])) {
      this.hp--; this.flash = 0.2; this.hits++; g.ev.push({ t: 'bosshit' }); g.shake = 0.3;
      if (this.hp <= 0) { this.state = 'dying'; this.t = 0; g.ev.push({ t: 'bossdie' }); g.enemies.forEach(e => { if (e.spat) e.dead = 0.001; }); return true; }
      if (this.hits % 3 === 0 && this.state !== 'stun') { this.state = 'rev'; this.t = 0; this.dir = Math.sign(g.p.x - this.x) || this.dir; }
      return true;
    }
    if (overlap(jb, this.box)) { g.ev.push({ t: 'clang' }); return true; }
    return false;
  }
  hurts(pb) {
    if (this.state === 'dying' || this.state === 'intro' || this.state === 'gone') return 0;
    const b = this.box; if (this.state === 'stun') return 0;
    const away = Math.sign((pb[0] + pb[2]) / 2 - this.x) || 1;
    if (this.state === 'charge') { if (overlap(pb, [b[0] + 0.15, b[1] + 0.4, b[2] - 0.15, b[3]])) return away; return 0; }
    // the nozzle at the front is what bites
    const nz = this.dir > 0 ? [this.x + 0.2, this.y - 0.75, this.x + 1.45, this.y] : [this.x - 1.45, this.y - 0.75, this.x - 0.2, this.y];
    if (overlap(pb, nz)) return this.dir;
    return 0;
  }
}
