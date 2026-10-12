// Crossfire: the simulation. No DOM, so the same code runs in the page and in Node for balance sims.
// Both teams plan a move and a shot in secret, then everything plays out at once.

export const W = 1400, H = 800, CELL = 2, GW = W / CELL, GH = H / CELL;
export const GRAV = 420, VMAX = 740, DT = 1 / 60;
export const MOVE_RANGE = 80, WALK_SPEED = 70, HP = 80;
export const BODY_R = 11, HEAD_Y = 12;          // hit circle centre sits HEAD_Y above the feet
export const SHIELD_R = 27;
export const SUDDEN_DEATH = 10;                 // from this round on the tide comes in

export const WEAPONS = {
  shell:   { key: 'shell',   name: 'Shell',   ammo: Infinity, r: 36, dmg: 56, wind: 1,   aim: true,
             note: 'Bursts on contact. The wind pushes it.' },
  grenade: { key: 'grenade', name: 'Grenade', ammo: 3,        r: 32, dmg: 52, wind: .3,  aim: true, fuse: 2.6, bounce: .42,
             note: 'Bounces, then goes off. Barely feels the wind.' },
  mortar:  { key: 'mortar',  name: 'Mortar',  ammo: 2,        r: 46, dmg: 66, wind: 0,   aim: false,
             note: 'Lands next round on the X. Everyone can see it coming.' },
  shield:  { key: 'shield',  name: 'Shield',  ammo: 2,        aim: false,
             note: 'A bubble that stops one blast. You don\'t fire this round.' },
};
export const WEAPON_KEYS = ['shell', 'grenade', 'mortar', 'shield'];

export const TEAM_NAMES = [
  ['Pvt. Pickles', 'Cpl. Dunk', 'Sgt. Mabel'],
  ['Pvt. Mugsy', 'Cpl. Fitch', 'Sgt. Biscuit'],
];
const SFX = ['WHAM!', 'BOOM!', 'KRAK!', 'BLAM!', 'KA-POW!', 'THOOM!'];

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- terrain
export const SHAPES = ['hills', 'valley', 'islands', 'mesa'];

export function makeTerrain(seed, shape) {
  const r = rng(seed * 7 + 3);
  const grid = new Uint8Array(GW * GH);
  shape = shape || SHAPES[(r() * SHAPES.length) | 0];
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28];
  const height = x => {
    const u = x / W;
    let h = 470;
    h += Math.sin(u * 6.28 * 1.1 + ph[0]) * 40 + Math.sin(u * 6.28 * 2.7 + ph[1]) * 26 + Math.sin(u * 6.28 * 6.3 + ph[2]) * 9;
    if (shape === 'valley') h += -Math.cos(u * 6.28) * 120 - 40;
    if (shape === 'hills') h += Math.cos(u * 6.28) * 90;                 // a big hill in the middle
    if (shape === 'mesa') h += (Math.abs(u - .5) < .12 ? -140 : 0) * Math.min(1, (0.12 - Math.abs(u - .5)) * 40);
    if (shape === 'islands') { const d = Math.abs(u - .5); if (d < .09) h += (0.09 - d) * 3000; }
    // the land slopes off into the sea at both edges
    const edge = Math.min(u, 1 - u);
    if (edge < .05) h += (0.05 - edge) * 3200;
    return h;
  };
  const heights = [];
  for (let gx = 0; gx < GW; gx++) {
    const top = height(gx * CELL + 1) / CELL;
    heights.push(top * CELL);
    for (let gy = Math.max(0, Math.floor(top)); gy < GH; gy++) grid[gy * GW + gx] = 1;
  }
  // a few caves and overhangs so it isn't just a line
  const n = 3 + ((r() * 3) | 0), holes = [];
  for (let i = 0; i < n; i++) {
    const x = 180 + r() * (W - 360), y = height(x) + 50 + r() * 90, rad = 22 + r() * 26;
    carveGrid(grid, x, y, rad);
    holes.push({ x, y, r: rad });
  }
  return { grid, shape, heights, holes };
}

function carveGrid(grid, x, y, r) {
  const gx0 = Math.max(0, Math.floor((x - r) / CELL)), gx1 = Math.min(GW - 1, Math.ceil((x + r) / CELL));
  const gy0 = Math.max(0, Math.floor((y - r) / CELL)), gy1 = Math.min(GH - 1, Math.ceil((y + r) / CELL));
  const r2 = r * r;
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
    const dx = gx * CELL + 1 - x, dy = gy * CELL + 1 - y;
    if (dx * dx + dy * dy <= r2) grid[gy * GW + gx] = 0;
  }
}

export class Game {
  constructor({ seed = 1, shape = null, names = TEAM_NAMES, teamSize = 3, layout = null } = {}) {
    this.seed = seed;
    this.r = rng(seed);
    const t = makeTerrain(seed, shape);
    this.grid = t.grid; this.shape = t.shape; this.heights = t.heights;
    this.craters = t.holes.slice();   // every hole ever cut, in order, so the page can redraw the ground
    this.terrainVersion = 0;
    this.water = H - 46;
    this.round = 1;
    this.soldiers = [];
    this.teams = [0, 1].map(i => ({ i, turn: 0, ammo: { shell: Infinity, grenade: 3, mortar: 2, shield: 2 } }));
    const xs = layout || this.spawnXs(teamSize);
    xs.forEach((list, team) => list.forEach((x, k) => {
      this.soldiers.push({ id: this.soldiers.length, team, name: names[team][k], x, y: this.surface(x), vx: 0, vy: 0,
        hp: HP, home: x, alive: true, grounded: true, shield: false, face: team ? -1 : 1, hurtT: 0, walkT: 0, drowned: false });
    }));
    this.mortars = [];        // { x, team, by, due } land on round `due`
    this.plans = [null, null];
    this.phase = 'plan';      // plan → resolve → plan … → over
    this.events = [];         // drained by the page for drawing and sound
    this.projectiles = [];
    this.wind = 0; this.rollWind();
    this.winner = null;       // 0, 1 or 'draw'
    this.t = 0;
    this.stats = { shots: [0, 0], hits: [0, 0], midair: 0 };
  }

  spawnXs(n) {
    const out = [[], []];
    for (let team = 0; team < 2; team++) {
      const lo = team ? 870 : 130, hi = team ? 1270 : 530;
      let tries = 0;
      while (out[team].length < n && tries++ < 400) {
        const x = lo + this.r() * (hi - lo);
        if (out[team].every(o => Math.abs(o - x) > 95) && this.surface(x) < this.water - 30) out[team].push(Math.round(x));
      }
      while (out[team].length < n) out[team].push(lo + out[team].length * 120);
      out[team].sort((a, b) => team ? b - a : a - b);
    }
    return out;
  }

  rollWind() {
    const r = this.r();
    // mostly gentle, now and then a gale
    this.wind = Math.round((r < .2 ? 0 : (this.r() * 2 - 1) * (r > .85 ? 110 : 60)));
  }

  solid(x, y) {
    if (x < 0 || x >= W || y < 0) return false;
    if (y >= H) return true;
    return this.grid[((y / CELL) | 0) * GW + ((x / CELL) | 0)] === 1;
  }
  surface(x, fromY = 0) {
    for (let y = fromY; y < H; y += 1) if (this.solid(x, y)) return y;
    return H;
  }
  carve(x, y, r) { carveGrid(this.grid, x, y, r); this.craters.push({ x, y, r }); this.terrainVersion++; }

  alive(team) { return this.soldiers.filter(s => s.alive && (team == null || s.team === team)); }
  active(team) {
    const list = this.soldiers.filter(s => s.team === team);
    for (let k = 0; k < list.length; k++) {
      const s = list[(this.teams[team].turn + k) % list.length];
      if (s.alive) return s;
    }
    return null;
  }

  // Where a soldier would end up walking toward tx (same rules as the real walk).
  walkPreview(s, tx) {
    const ghost = { ...s, vx: 0, vy: 0, ghost: true };
    tx = clamp(tx, s.x - MOVE_RANGE, s.x + MOVE_RANGE);
    for (let i = 0; i < 240; i++) {
      if (!this.walkStep(ghost, tx) || !ghost.alive) break;
    }
    return { x: ghost.x, y: ghost.y, fell: ghost.y > s.y + 40 || !ghost.alive };
  }
  // one frame of walking; returns false once it has arrived or is stuck
  walkStep(s, tx) {
    if (!s.grounded) { this.fallStep(s); return true; }
    const d = tx - s.x;
    if (Math.abs(d) < .5) return false;
    const step = Math.sign(d) * Math.min(Math.abs(d), WALK_SPEED * DT);
    const nx = s.x + step;
    let ny = s.y, climb = 0;
    while (this.solid(nx, ny - 1) && climb < 7) { ny--; climb++; }
    if (this.solid(nx, ny - 1) || this.solid(nx, ny - 14)) return false;   // a wall
    s.x = nx; s.y = ny; s.face = Math.sign(d) || s.face;
    if (!this.solid(s.x, s.y + 1)) {
      // step down small drops; walk off bigger ones
      let drop = 0;
      while (!this.solid(s.x, s.y + 1) && drop < 6) { s.y++; drop++; }
      if (!this.solid(s.x, s.y + 1)) { s.grounded = false; s.vx = step / DT * .6; s.vy = 0; }
    }
    return true;
  }
  fallStep(s) {
    s.vy += GRAV * DT;
    s.vx *= .995;
    const n = Math.max(1, Math.ceil(Math.hypot(s.vx, s.vy) * DT / 2));
    for (let i = 0; i < n; i++) {
      const nx = s.x + s.vx * DT / n, ny = s.y + s.vy * DT / n;
      if (this.solid(nx, ny - 8)) { s.vx = -s.vx * .2; continue; }                // bumped a wall
      if (s.vy > 0 && this.solid(nx, ny)) {
        s.x = nx; s.y = ny;
        while (this.solid(s.x, s.y - 1) && s.y > 0) s.y--;
        const v = s.vy; s.vy = 0; s.vx = 0; s.grounded = true;
        if (v > 430) this.hurt(s, Math.round((v - 430) * .07), 'fall');
        return;
      }
      if (s.vy < 0 && this.solid(nx, ny - 20)) { s.vy = 0; }
      s.x = nx; s.y = ny;
    }
    if (s.x < -40 || s.x > W + 40 || s.y > this.water + 4) this.drown(s);
  }
  settle(s) {
    if (!s.alive) return;
    if (s.grounded && !this.solid(s.x, s.y + 1)) {
      let drop = 0;
      while (!this.solid(s.x, s.y + 1) && drop < 3) { s.y++; drop++; }
      if (!this.solid(s.x, s.y + 1)) { s.grounded = false; s.vy = 0; }
    }
    if (s.grounded && this.solid(s.x, s.y - 1)) { while (this.solid(s.x, s.y - 1) && s.y > 0) s.y--; }
    if (!s.grounded) this.fallStep(s);
    if (s.y > this.water + 4) this.drown(s);
  }
  drown(s) {
    if (!s.alive) return;
    if (s.ghost) { s.alive = false; return; }
    if (this.immortal) {   // the lesson fishes you out and puts you back
      this.events.push({ type: 'splash', x: s.x, y: this.water, who: s.id });
      s.x = s.home; s.y = this.surface(s.x); s.vx = s.vy = 0; s.grounded = true;
      return;
    }
    s.alive = false; s.drowned = true; s.hp = 0;
    this.events.push({ type: 'splash', x: s.x, y: this.water, who: s.id });
    this.events.push({ type: 'die', who: s.id, how: 'drown' });
  }
  hurt(s, dmg, how) {
    if (!s.alive || dmg <= 0 || s.ghost) return;
    s.hp = Math.max(this.immortal ? 1 : 0, s.hp - dmg); s.hurtT = .6;
    this.events.push({ type: 'hurt', who: s.id, dmg, how });
    if (s.hp <= 0) { s.alive = false; this.events.push({ type: 'die', who: s.id, how }); }
  }

  launchVel(angle, power) { return { vx: Math.cos(angle) * power * VMAX, vy: -Math.sin(angle) * power * VMAX }; }
  muzzle(x, y, angle) { return { x: x + Math.cos(angle) * 14, y: y - HEAD_Y - Math.sin(angle) * 14 }; }

  // ---------- plans
  // plan: { moveX, weapon, angle, power, targetX }
  setPlan(team, plan) {
    const s = this.active(team);
    if (!s) { this.plans[team] = { skip: true }; return; }
    const p = { ...plan };
    if (p.weapon !== 'wait' && (!WEAPONS[p.weapon] || !(this.teams[team].ammo[p.weapon] > 0))) p.weapon = 'shell';
    if (p.moveX == null) p.moveX = s.x;
    p.moveX = clamp(p.moveX, s.x - MOVE_RANGE, s.x + MOVE_RANGE);
    p.power = clamp(p.power ?? .6, .08, 1);
    if (p.weapon === 'mortar') p.targetX = clamp(p.targetX ?? W / 2, 10, W - 10);
    this.plans[team] = p;
  }
  ready() { return this.plans[0] && this.plans[1]; }

  // ---------- resolve
  beginResolve() {
    this.phase = 'resolve';
    this.rt = 0; this.stage = 'walk'; this.quietT = 0;
    this.walkers = [];
    for (let team = 0; team < 2; team++) {
      const p = this.plans[team], s = this.active(team);
      if (!p || p.skip || !s) continue;
      p.shooter = s.id;
      if (Math.abs(p.moveX - s.x) > .5) this.walkers.push({ s, tx: p.moveX });
      if (p.weapon === 'shield') { s.shield = true; this.events.push({ type: 'shieldUp', who: s.id }); }
    }
    this.events.push({ type: 'resolve' });
  }

  fire() {
    this.stage = 'fly'; this.rt = 0;
    for (let team = 0; team < 2; team++) {
      const p = this.plans[team];
      if (!p || p.skip || p.weapon === 'wait') continue;
      const s = this.soldiers[p.shooter];
      if (!s.alive) continue;
      const w = WEAPONS[p.weapon];
      this.teams[team].ammo[p.weapon]--;
      if (p.weapon === 'shield') continue;
      this.stats.shots[team]++;
      if (p.weapon === 'mortar') {
        this.mortars.push({ x: p.targetX, team, by: s.id, due: this.round + 1 });
        this.projectiles.push({ kind: 'mortarUp', team, by: s.id, x: s.x, y: s.y - HEAD_Y, vx: 0, vy: -900, t: 0, alive: true, ghost: true });
        this.events.push({ type: 'fire', who: s.id, weapon: 'mortar' });
        continue;
      }
      const m = this.muzzle(s.x, s.y, p.angle);
      const v = this.launchVel(p.angle, p.power);
      s.face = v.vx >= 0 ? 1 : -1;
      this.projectiles.push({ kind: p.weapon, team, by: s.id, x: m.x, y: m.y, vx: v.vx, vy: v.vy, t: 0, alive: true, fuse: w.fuse, rest: false });
      this.events.push({ type: 'fire', who: s.id, weapon: p.weapon });
    }
    // mortars fired last round come down now
    for (const mo of this.mortars.filter(m => m.due === this.round)) {
      this.projectiles.push({ kind: 'mortar', team: mo.team, by: mo.by, x: mo.x, y: -60, vx: 0, vy: 260, t: 0, alive: true });
      this.events.push({ type: 'incoming', x: mo.x });
    }
    this.mortars = this.mortars.filter(m => m.due !== this.round);
  }

  step() {
    this.t += DT;
    if (this.phase !== 'resolve') return;
    this.rt += DT;
    for (const s of this.soldiers) if (s.hurtT > 0) s.hurtT -= DT;
    if (this.stage === 'walk') {
      let moving = false;
      for (const w of this.walkers) {
        if (!w.s.alive) continue;
        if (this.walkStep(w.s, w.tx)) { moving = true; w.s.walkT += DT; }
      }
      for (const s of this.soldiers) if (s.alive && !s.grounded) { this.fallStep(s); moving = true; }
      if (!moving || this.rt > 2.4) { this.walkers = []; this.fire(); }
      return;
    }
    // fly
    for (const p of this.projectiles) if (p.alive) this.stepProjectile(p);
    // shells meeting in the air
    const live = this.projectiles.filter(p => p.alive && !p.ghost);
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (!a.alive || !b.alive) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) < 15) {
        a.alive = b.alive = false;
        this.stats.midair++;
        this.explode((a.x + b.x) / 2, (a.y + b.y) / 2, 40, 30, { midair: true, team: -1 });
      }
    }
    this.projectiles = this.projectiles.filter(p => p.alive);
    let moving = this.projectiles.length > 0;
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      this.settle(s);
      if (!s.grounded) moving = true;
    }
    if (moving) this.quietT = 0; else this.quietT += DT;
    if ((this.quietT > .7 && this.rt > .5) || this.rt > 14) this.endRound();
  }

  stepProjectile(p) {
    p.t += DT;
    if (p.kind === 'mortarUp') { p.y += p.vy * DT; if (p.y < -120) p.alive = false; return; }
    const w = WEAPONS[p.kind];
    if (p.kind === 'grenade') {
      p.fuse -= DT;
      if (p.fuse <= 0) { p.alive = false; this.explode(p.x, p.y, w.r, w.dmg, { team: p.team, by: p.by }); return; }
      if (p.rest) { if (!this.solid(p.x, p.y + 4)) p.rest = false; else return; }
    }
    p.vx += this.wind * w.wind * DT;
    p.vy += (p.kind === 'mortar' ? GRAV * .5 : GRAV) * DT;
    const n = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy) * DT / 3));
    for (let i = 0; i < n; i++) {
      const ox = p.x, oy = p.y;
      p.x += p.vx * DT / n; p.y += p.vy * DT / n;
      if (p.y > this.water) { p.alive = false; this.events.push({ type: 'plop', x: p.x, y: this.water }); return; }
      if (p.x < -300 || p.x > W + 300 || p.y > H + 50) { p.alive = false; return; }
      // shield bubbles
      for (const s of this.soldiers) {
        if (!s.alive || !s.shield) continue;
        if (Math.hypot(p.x - s.x, p.y - (s.y - HEAD_Y)) < SHIELD_R && !(p.by === s.id && p.t < .4)) {
          p.alive = false; this.explode(p.x, p.y, w.r * .8, w.dmg, { team: p.team, by: p.by }); return;
        }
      }
      // soldiers
      for (const s of this.soldiers) {
        if (!s.alive || (s.id === p.by && p.t < .35)) continue;
        if (Math.hypot(p.x - s.x, p.y - (s.y - HEAD_Y)) < BODY_R + 3) {
          if (p.kind === 'grenade') { p.vx *= -.3; p.vy *= -.3; p.x = ox; p.y = oy; break; }
          p.alive = false; this.explode(p.x, p.y, w.r, w.dmg, { team: p.team, by: p.by, direct: s.id }); return;
        }
      }
      if (this.solid(p.x, p.y)) {
        if (p.kind === 'grenade') { this.bounce(p, ox, oy, w.bounce); break; }
        p.alive = false; this.explode(p.x, p.y, w.r, w.dmg, { team: p.team, by: p.by }); return;
      }
    }
  }
  bounce(p, ox, oy, e, quiet = false) {
    p.x = ox; p.y = oy;
    let nx = 0, ny = 0;
    for (let a = 0; a < 16; a++) {
      const c = Math.cos(a / 16 * 6.283), s = Math.sin(a / 16 * 6.283);
      if (this.solid(p.x + c * 6, p.y + s * 6)) { nx -= c; ny -= s; }
    }
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    if (!nx && !ny) ny = -1;
    const vn = p.vx * nx + p.vy * ny;
    if (vn < 0) { p.vx -= (1 + e) * vn * nx; p.vy -= (1 + e) * vn * ny; }
    p.vx *= .8; p.vy *= .8;
    if (Math.abs(vn) > 60 && !quiet) this.events.push({ type: 'bounce', x: p.x, y: p.y });
    if (Math.hypot(p.vx, p.vy) < 30) { p.vx = p.vy = 0; p.rest = true; }
  }

  explode(x, y, r, dmg, info = {}) {
    this.carve(x, y, r);
    const word = info.midair ? 'KA-BLAM!' : SFX[(this.r() * SFX.length) | 0];
    this.events.push({ type: 'boom', x, y, r, word, midair: !!info.midair, team: info.team });
    let hitEnemy = false;
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const cx = s.x, cy = s.y - HEAD_Y;
      const d = Math.hypot(cx - x, cy - y), reach = r * 1.5;
      if (d >= reach) continue;
      if (s.shield) { s.shield = false; this.events.push({ type: 'shieldPop', who: s.id }); continue; }
      const k = 1 - d / reach;
      const amount = Math.round(dmg * (info.direct === s.id ? 1 : Math.min(1, k * 1.15)));
      const nx = (cx - x) / (d || 1), ny = (cy - y) / (d || 1);
      const push = 50 + k * 230;
      s.vx += nx * push; s.vy += ny * push - 140 * k; s.grounded = false;
      if (s.vy > -60) s.vy = -60;
      this.hurt(s, amount, 'blast');
      if (info.team != null && info.team >= 0 && s.team !== info.team && amount > 0) hitEnemy = true;
    }
    if (hitEnemy) this.stats.hits[info.team]++;
  }

  endRound() {
    for (const s of this.soldiers) { s.shield = false; if (s.alive && s.hp <= 0) s.alive = false; }
    const a = this.alive(0).length, b = this.alive(1).length;
    this.events.push({ type: 'roundEnd' });
    if (!a || !b) {
      this.phase = 'over';
      this.winner = !a && !b ? 'draw' : a ? 0 : 1;
      this.events.push({ type: 'over', winner: this.winner });
      return;
    }
    for (const t of this.teams) t.turn++;
    this.round++;
    this.plans = [null, null];
    this.rollWind();
    if (this.round >= SUDDEN_DEATH && !this.immortal) {
      this.water -= 26;
      this.events.push({ type: 'tide', water: this.water });
      for (const s of this.soldiers) if (s.alive && s.y > this.water) this.drown(s);
      // drowning can end it too
      const a2 = this.alive(0).length, b2 = this.alive(1).length;
      if (!a2 || !b2) {
        this.phase = 'over'; this.winner = !a2 && !b2 ? 'draw' : a2 ? 0 : 1;
        this.events.push({ type: 'over', winner: this.winner });
        return;
      }
    }
    this.phase = 'plan';
  }

  // Path of a shot through the current terrain and nobody else's, for the aiming line and the CPU.
  trace(kind, x, y, angle, power, maxT = 6, every = 1) {
    const w = WEAPONS[kind];
    const m = this.muzzle(x, y, angle), v = this.launchVel(angle, power);
    const p = { x: m.x, y: m.y, vx: v.vx, vy: v.vy, fuse: w.fuse, rest: false };
    const pts = [];
    let end = null;
    for (let t = 0, i = 0; t < maxT; t += DT, i++) {
      if (kind === 'grenade') { p.fuse -= DT; if (p.fuse <= 0) { end = { x: p.x, y: p.y }; break; } if (p.rest) continue; }
      p.vx += this.wind * w.wind * DT; p.vy += GRAV * DT;
      const n = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy) * DT / 3));
      let hit = false;
      for (let k = 0; k < n; k++) {
        const ox = p.x, oy = p.y;
        p.x += p.vx * DT / n; p.y += p.vy * DT / n;
        if (p.y > this.water || p.x < -300 || p.x > W + 300) { end = { x: p.x, y: p.y, wet: true }; hit = true; break; }
        if (this.solid(p.x, p.y)) {
          if (kind === 'grenade') { this.bounce(p, ox, oy, w.bounce, true); break; }
          end = { x: p.x, y: p.y }; hit = true; break;
        }
      }
      if (i % every === 0) pts.push({ x: p.x, y: p.y, t });
      if (hit) break;
    }
    return { pts, end };
  }
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
