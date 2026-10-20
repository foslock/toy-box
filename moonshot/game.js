// One match: two squads of astronauts taking turns on a handful of planetoids.
import { World, generate, rng, makeProj, stepProj, WEAPONS, WELL_MASS, TROOP_R, CELL } from './world.js';

export const HP = 60;
export const WALK = 80;              // units of walking per turn
const WALK_SPEED = 42;
const FALL_SAFE = 230;
const DT = 1 / 120;

export const TEAMS = [
  { name: 'Tangerine', color: '#ff7b2e', dark: '#9c3510' },
  { name: 'Blueberry', color: '#46b8ff', dark: '#1c4f99' },
];
const NAMES = [
  ['Cpl. Biscuit', 'Lt. Wobble', 'Sgt. Pickles', 'Dr. Spudnik', 'Ens. Marmalade', 'Capt. Kazoo', 'Pvt. Gravy', 'Maj. Noodle'],
  ['Cdr. Fizz', 'Lt. Zeppo', 'Sgt. Dumpling', 'Dr. Bloop', 'Ens. Tuba', 'Capt. Waffles', 'Pvt. Sprocket', 'Maj. Custard'],
];
export const AMMO = { shell: Infinity, grenade: Infinity, drill: 2, mine: 1, jet: 2 };

export class Game {
  constructor(opt) {
    this.mode = opt.mode;                       // 'cpu' | 'pvp' | 'demo' | 'tutorial'
    this.seed = opt.seed ?? (Math.random() * 1e9) | 0;
    this.rand = rng(this.seed ^ 0x5bd1e995);
    this.world = opt.world || generate(opt.W, opt.H, this.seed);
    this.troops = [];
    this.proj = [];                             // includes strays parked in orbit
    this.graves = [];
    this.fx = [];                               // events for the view and sound: drained each frame
    this.phase = 'aim';
    this.turnNo = 0;
    this.teamTurn = 1;
    this.next = [0, 0];
    this.cur = null;
    this.weapon = 'shell';
    this.aim = { ang: -Math.PI / 4, pow: 0.6 };
    this.walkMax = opt.walkMax || WALK;
    this.walkLeft = this.walkMax;
    this.jetUsed = false;
    this.flyT = 0; this.settleT = 0;
    this.acc = 0;
    this.winner = null;
    this.teams = TEAMS.map((t, i) => ({ ...t, i, cpu: false, ammo: { ...AMMO } }));
    if (this.mode === 'cpu') this.teams[1].cpu = true;
    if (this.mode === 'demo') this.teams[0].cpu = this.teams[1].cpu = true;
    if (!opt.empty) this.spawnTeams(opt.perTeam || 4);
  }

  addTroop(team, name, x, y, hp = HP) {
    const t = { team, name, x, y, vx: 0, vy: 0, hp, dead: false, air: false, flying: false, facing: team ? -1 : 1, airT: 0, dmgShown: 0, id: this.troops.length };
    this.troops.push(t);
    return t;
  }

  // Put a troop on the surface of planet p at angle a.
  placeOn(p, a) {
    const w = this.world, dx = Math.cos(a), dy = Math.sin(a);
    let d = p.r * 1.25 + 20;
    while (d > 0 && !overlap(w, p.x + dx * d, p.y + dy * d)) d -= 1;
    d += 1;
    while (overlap(w, p.x + dx * d, p.y + dy * d)) d += 1;
    return { x: p.x + dx * d, y: p.y + dy * d };
  }

  spawnTeams(n) {
    const ps = this.world.planets, k = ps.length, names = NAMES.map(l => l.slice().sort(() => this.rand() - 0.5));
    const m = Math.max(1, Math.floor(k / 2)), sides = [ps.slice(0, m), ps.slice(k - m)];
    for (let team = 0; team < 2; team++) {
      const used = [];
      for (let i = 0; i < n; i++) {
        const p = sides[team][i % sides[team].length];
        let pos = null;
        for (let tries = 0; tries < 40; tries++) {
          const a = this.rand() * Math.PI * 2;
          const q = this.placeOn(p, a);
          if (q.x < 20 || q.y < 20 || q.x > this.world.W - 20 || q.y > this.world.H - 20) continue;
          if (used.every(u => Math.hypot(u.x - q.x, u.y - q.y) > 34)) { pos = q; break; }
        }
        if (!pos) pos = this.placeOn(p, this.rand() * 6.28);
        used.push(pos);
        this.addTroop(team, names[team][i], pos.x, pos.y);
      }
    }
  }

  alive(team) { return this.troops.filter(t => !t.dead && t.team === team); }
  get busy() { return this.phase !== 'aim'; }
  get cpuTurn() { return this.cur && this.teams[this.cur.team]?.cpu; }
  ammoOf(kind) { return this.mode === 'tutorial' ? Infinity : this.teams[this.cur.team].ammo[kind]; }

  start() { this.nextTurn(); }

  nextTurn() {
    if (this.checkOver()) return;
    if (this.mode !== 'tutorial') {
      this.teamTurn = 1 - this.teamTurn;
      const list = this.troops.filter(t => t.team === this.teamTurn);
      for (let k = 0; k < list.length; k++) {
        const t = list[(this.next[this.teamTurn] + k) % list.length];
        if (!t.dead) { this.cur = t; this.next[this.teamTurn] = (list.indexOf(t) + 1) % list.length; break; }
      }
    }
    this.turnNo++;
    this.phase = 'aim';
    this.walkLeft = this.walkMax;
    this.jetUsed = false;
    if (this.ammoOf(this.weapon) <= 0) this.weapon = 'shell';
    this.aim = { ang: this.cur.facing > 0 ? -Math.PI / 4 : -3 * Math.PI / 4, pow: 0.6 };
    { const u = this.world.up(this.cur.x, this.cur.y), ua = Math.atan2(u.y, u.x); this.aim.ang = ua + (this.cur.facing > 0 ? 0.7 : -0.7); }
    this.fx.push({ type: 'turn', troop: this.cur });
  }

  checkOver() {
    if (this.mode === 'tutorial') return false;
    const a = this.alive(0).length, b = this.alive(1).length;
    if (a && b) return false;
    this.phase = 'over';
    this.winner = a ? 0 : b ? 1 : -1;
    this.fx.push({ type: 'over', winner: this.winner });
    return true;
  }

  launchVel(kind, ang, pow) {
    const v = this.world.vmax * WEAPONS[kind].speed * (0.12 + 0.88 * pow);
    return { vx: Math.cos(ang) * v, vy: Math.sin(ang) * v };
  }
  muzzle(t, ang) { return { x: t.x + Math.cos(ang) * (TROOP_R + 4), y: t.y + Math.sin(ang) * (TROOP_R + 4) }; }

  canFire(kind = this.weapon) {
    if (this.phase !== 'aim') return false;
    if (kind === 'jet' && this.jetUsed) return false;
    return this.ammoOf(kind) > 0;
  }

  fire(kind = this.weapon, ang = this.aim.ang, pow = this.aim.pow) {
    if (!this.canFire(kind)) return false;
    const t = this.cur, v = this.launchVel(kind, ang, pow);
    if (this.mode !== 'tutorial') this.teams[t.team].ammo[kind]--;
    t.facing = Math.cos(ang) >= 0 ? 1 : -1;
    if (kind === 'jet') {
      const p = makeProj('jet', t.x, t.y, v.vx, v.vy, t);
      p.troop = t; t.flying = true; this.jetUsed = true;
      this.proj.push(p);
    } else {
      const m = this.muzzle(t, ang);
      this.proj.push(makeProj(kind, m.x, m.y, v.vx, v.vy, t));
    }
    this.lastShot = { kind, ang, pow, team: t.team };
    this.phase = 'fly'; this.flyT = 0;
    this.fx.push({ type: 'fire', kind, x: t.x, y: t.y });
    return true;
  }

  walk(dir, dt) {
    if (this.phase !== 'aim' || this.walkLeft <= 0) return false;
    const t = this.cur;
    if (t.air) return false;
    t.facing = dir;
    const step = Math.min(WALK_SPEED * dt, this.walkLeft);
    const moved = walkStep(this.world, t, dir * step);
    if (moved) this.walkLeft -= step;
    return moved;
  }

  // ---- simulation ---------------------------------------------------------------------------------
  update(dt) {
    this.acc = Math.min(this.acc + dt, 0.1);
    while (this.acc >= DT) { this.acc -= DT; this.tick(DT); }
  }

  tick(dt) {
    const w = this.world;
    if (this.phase === 'fly') {
      this.flyT += dt;
      for (const p of this.proj.slice()) {
        const e = stepProj(w, p, dt, this.troops, true);
        if (e) this.onProj(p, e);
      }
      const active = this.proj.some(p => !p.stray);
      if (!active && (this.flyT > 1.6 || !this.proj.length)) { this.phase = 'settle'; this.settleT = 0; }
    }
    for (const t of this.troops) if (!t.dead && !t.flying) this.troopPhysics(t, dt);
    // mines go off when someone walks onto them
    for (const wl of w.wells.slice()) for (const t of this.troops) {
      if (!t.dead && !t.flying && Math.hypot(t.x - wl.x, t.y - wl.y) < 13) { this.detonateWell(wl); break; }
    }
    if (this.phase === 'settle') {
      this.settleT += dt;
      const still = this.troops.every(t => t.dead || !t.air);
      if (still && this.settleT > 0.7) this.endTurn();
    }
  }

  onProj(p, e) {
    const rm = () => { const i = this.proj.indexOf(p); if (i >= 0) this.proj.splice(i, 1); };
    switch (e.ev) {
      case 'boom':
        rm();
        if (e.well) this.detonateWell(e.well);
        if (p.kind === 'mine') this.explode(e.x, e.y, WEAPONS.mine, p);
        else this.explode(e.x, e.y, WEAPONS[p.kind], p);
        break;
      case 'bounce': if (e.speed > 30) this.fx.push({ type: 'bounce', x: e.x, y: e.y, v: e.speed }); break;
      case 'stick': {
        rm();
        const wl = { x: e.x, y: e.y, mass: WELL_MASS, turns: WEAPONS.mine.turns, team: p.owner?.team ?? -1, born: this.turnNo };
        p.well = wl; this.world.wells.push(wl);
        this.fx.push({ type: 'stick', x: e.x, y: e.y });
        break;
      }
      case 'land': {
        rm();
        const t = p.troop; t.flying = false; t.x = e.x; t.y = e.y; t.vx = t.vy = 0;
        unstick(this.world, t);
        t.air = false;
        if (e.speed > FALL_SAFE + 60) this.hurt(t, Math.round((e.speed - FALL_SAFE - 60) * 0.2));
        this.fx.push({ type: 'land', x: t.x, y: t.y });
        if (!t.dead) { this.phase = 'aim'; this.weapon = this.ammoOf('shell') ? 'shell' : this.weapon; this.fx.push({ type: 'landed', troop: t }); }
        else { this.phase = 'settle'; this.settleT = 0; }
        break;
      }
      case 'lost':
        rm();
        if (p.kind === 'jet') { this.kill(p.troop, 'void'); this.phase = 'settle'; this.settleT = 0; }
        else this.fx.push({ type: 'lost', kind: p.kind });
        break;
      case 'stray':
        p.stray = true; p.strayTurns = 3;
        this.fx.push({ type: 'stray', x: p.x, y: p.y });
        break;
    }
  }

  detonateWell(wl) {
    const i = this.world.wells.indexOf(wl);
    if (i < 0) return;
    this.world.wells.splice(i, 1);
    this.explode(wl.x, wl.y, WEAPONS.mine, null);
  }

  explode(x, y, W, p) {
    const w = this.world;
    w.carve(x, y, W.R, true);
    this.fx.push({ type: 'boom', x, y, R: W.R, planet: w.planets.reduce((b, q) => Math.hypot(q.x - x, q.y - y) - q.r < Math.hypot(b.x - x, b.y - y) - b.r ? q : b, w.planets[0]) });
    const reach = W.R * 1.7;
    for (const t of this.troops) {
      if (t.dead || t.flying) continue;
      const dx = t.x - x, dy = t.y - y, d = Math.max(0, Math.hypot(dx, dy) - TROOP_R);
      if (d > reach) continue;
      const f = 1 - d / reach;
      if (this.mode === 'tutorial' && t.team === 0) { t.air = true; t.vx += (dx / (d + 1)) * 40 * f; t.vy += (dy / (d + 1)) * 40 * f; continue; }
      const dmg = Math.round(W.dmg * (0.25 + 0.75 * f));
      const m = Math.hypot(dx, dy) || 1, u = w.up(t.x, t.y), kb = W.kb * f;
      t.vx += (dx / m * 0.75 + u.x * 0.45) * kb; t.vy += (dy / m * 0.75 + u.y * 0.45) * kb;
      t.air = true; t.airT = 0;
      t.x += u.x; t.y += u.y;
      this.hurt(t, dmg);
    }
    // other mines in the blast go off too
    for (const wl of w.wells.slice()) if (Math.hypot(wl.x - x, wl.y - y) < W.R + 6) this.detonateWell(wl);
    // so do grenades sitting in it
    for (const q of this.proj.slice()) if (q !== p && q.kind === 'grenade' && Math.hypot(q.x - x, q.y - y) < W.R) { q.t = q.fuse; }
  }

  hurt(t, dmg) {
    if (dmg <= 0 || t.dead) return;
    t.hp -= dmg;
    this.fx.push({ type: 'dmg', troop: t, dmg, x: t.x, y: t.y });
    if (t.hp <= 0) { t.hp = 0; this.kill(t, 'hp'); }
  }

  kill(t, why) {
    if (t.dead) return;
    if (this.mode === 'tutorial' && t.team === 0) {     // Flight School fishes its cadets back out
      t.x = t.home.x; t.y = t.home.y; t.vx = t.vy = 0; t.air = false; t.flying = false; t.hp = HP;
      this.fx.push({ type: 'rescued', troop: t });
      return;
    }
    t.dead = true; t.flying = false; t.hp = 0;
    if (why !== 'void') { const u = this.world.up(t.x, t.y); this.graves.push({ x: t.x, y: t.y, ang: Math.atan2(u.y, u.x), team: t.team, air: t.air, vx: t.vx * 0.3, vy: t.vy * 0.3 }); }
    this.fx.push({ type: 'die', troop: t, why });
  }

  troopPhysics(t, dt) {
    const w = this.world;
    if (!t.air) {
      if (!supported(w, t)) { t.air = true; t.vx = t.vy = 0; t.airT = 0; }
      else return;
    }
    if (t.team === 2) { t.air = false; return; }      // tutorial targets are bolted down
    t.airT += dt;
    const g = w.gravity(t.x, t.y, true);
    t.vx += g.x * dt; t.vy += g.y * dt;
    const sp = Math.hypot(t.vx, t.vy), n = Math.max(1, Math.ceil(sp * dt / 1.5));
    for (let k = 0; k < n; k++) {
      const nx = t.x + t.vx * dt / n, ny = t.y + t.vy * dt / n;
      if (overlap(w, nx, ny)) {
        const nm = w.normalAt(nx, ny), u = w.up(t.x, t.y), vn = t.vx * nm.x + t.vy * nm.y;
        if (nm.x * u.x + nm.y * u.y > 0.25 || Math.hypot(t.vx, t.vy) < 30) {
          const impact = Math.abs(vn);
          t.vx = t.vy = 0; t.air = false;
          unstick(w, t);
          if (impact > FALL_SAFE) this.hurt(t, Math.round((impact - FALL_SAFE) * 0.2));
          if (impact > 80) this.fx.push({ type: 'thud', x: t.x, y: t.y, v: impact });
          return;
        }
        // glancing blow off an overhang: lose the into-wall speed and slide
        t.vx -= vn * nm.x * 1.3; t.vy -= vn * nm.y * 1.3; t.vx *= 0.7; t.vy *= 0.7;
        return;
      }
      t.x = nx; t.y = ny;
    }
    const M = 300;
    if (t.x < -M || t.y < -M || t.x > w.W + M || t.y > w.H + M || t.airT > 12) this.kill(t, 'void');
  }

  endTurn() {
    if (this.mode !== 'tutorial') {
      for (const p of this.proj.slice()) if (p.stray && --p.strayTurns <= 0) { this.proj.splice(this.proj.indexOf(p), 1); this.fx.push({ type: 'burnup', x: p.x, y: p.y }); }
      for (const wl of this.world.wells.slice()) if (this.turnNo > wl.born && --wl.turns <= 0) {
        this.detonateWell(wl);
        this.phase = 'settle'; this.settleT = 0;
        return;
      }
    }
    if (this.mode === 'tutorial') {
      if (this.cur.dead) return;
      this.phase = 'aim'; this.walkLeft = this.walkMax; this.jetUsed = false; this.turnNo++;
      this.fx.push({ type: 'again' });
      return;
    }
    this.nextTurn();
  }
}

// ---- standing on lumpy ground ------------------------------------------------------------------------
export function overlap(w, x, y, R = TROOP_R) {
  if (w.solidAt(x, y)) return true;
  for (let k = 0; k < 10; k++) {
    const a = k * Math.PI / 5;
    if (w.solidAt(x + Math.cos(a) * (R - 0.5), y + Math.sin(a) * (R - 0.5))) return true;
  }
  return false;
}

function supported(w, t) {
  const u = w.up(t.x, t.y), d = TROOP_R + 1.6, tx = -u.y, ty = u.x;
  for (const o of [0, -3.5, 3.5]) if (w.solidAt(t.x - u.x * d + tx * o, t.y - u.y * d + ty * o)) return true;
  return false;
}

function unstick(w, t) {
  const u = w.up(t.x, t.y);
  for (let k = 0; k < 30 && overlap(w, t.x, t.y); k++) { t.x += u.x * 0.5; t.y += u.y * 0.5; }
}

// Walk along the ground by s units (negative = left). Steps up small ledges, follows the curve down.
function walkStep(w, t, s) {
  const u = w.up(t.x, t.y), tx = -u.y, ty = u.x;
  let x = t.x + tx * s, y = t.y + ty * s, climbed = 0;
  while (overlap(w, x, y) && climbed < 5) { x += u.x * 0.5; y += u.y * 0.5; climbed += 0.5; }
  if (overlap(w, x, y)) return false;
  const u2 = w.up(x, y);
  for (let k = 0; k < 10; k++) {
    const sx = x - u2.x * 0.5, sy = y - u2.y * 0.5;
    if (overlap(w, sx, sy)) break;
    x = sx; y = sy;
  }
  t.x = x; t.y = y;
  if (!supported(w, t)) { t.air = true; t.vx = tx * s * 20; t.vy = ty * s * 20; t.airT = 0; }
  return true;
}
