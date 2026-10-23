// The day at the beach: waves of visitors, the tide, the tools and the fling.
// No DOM in here, so a bot can play it in Node.
import { Beach, W, H, E, SAND, WET, PACK, WATER, SOLID, CASTLE_X, rng } from './sim.js';

export const KINDS = {
  crab: { w: 7, h: 4, speed: 6.5, climb: 2, follow: 34, throw: 1, shells: 1 },
  gull: { w: 7, h: 6, speed: 20, climb: 0, follow: 30, throw: 1, shells: 2 },
  dog: { w: 11, h: 5, speed: 17, climb: 3, follow: 16, throw: 0.9, shells: 2 },
  kid: { w: 5, h: 8, speed: 6, climb: 3, follow: 20, throw: 0.9, shells: 2 },
  man: { w: 7, h: 14, speed: 4, climb: 3, follow: 4.5, throw: 0.35, shells: 4 },
};

export const WAVES = [
  { time: '9 AM', sea: 75, swell: 1.6, spawn: { crab: 3 } },
  { time: '10 AM', sea: 73, swell: 2, spawn: { crab: 4, kid: 1 } },
  { time: '11 AM', sea: 71.5, swell: 2.4, spawn: { crab: 4, gull: 2, kid: 1 } },
  { time: 'NOON', sea: 70, swell: 2.8, spawn: { crab: 5, dog: 1, gull: 2 } },
  { time: '2 PM', sea: 68.5, swell: 3.3, spawn: { crab: 6, kid: 2, dog: 1, gull: 2 } },
  { time: '3 PM', sea: 67, swell: 3.9, spawn: { man: 1, crab: 6, gull: 3, kid: 1 } },
  { time: '5 PM', sea: 65.5, swell: 4.6, spawn: { crab: 8, dog: 2, gull: 3, kid: 2, man: 1 } },
  { time: 'SUNSET', sea: 62.5, swell: 6.5, spawn: { crab: 5, gull: 2 } },
];
export const WAVE_LEN = 45, SUNSET_LEN = 50, BUILD_LEN = 30;
export const PAIL_MAX = 160;
export const PRICES = { tower: 8, post: 5, peb: 4 };
export const PEB_BAG = 40;
const G = 95;              // gravity, cells/s²
const GENTLE = 26;         // a kid let go slower than this was set down, not thrown

export class Game {
  constructor(seed = 1) {
    this.seed = seed;
    this.r = rng(seed * 7 + 3);
    this.beach = new Beach(seed);
    this.ents = [];
    this.parts = [];
    this.pops = [];
    this.sounds = [];
    this.listeners = [];
    this.shells = 6;
    this.pail = 0;
    this.pebStock = 0;
    this.wave = 0;          // index of the wave that is next / in progress
    this.phase = 'build';   // build | wave | end
    this.t = 0;             // time in the current phase
    this.spawnQ = [];
    this.ptr = null;
    this.held = null;
    this.over = null;
    this.paused = false;
    this.noWaves = false;   // the tutorial holds the day still
    this.stats = { flung: 0, kidsGentle: 0, kidsRough: 0, shellsEarned: 0 };
    const g = this.beach.topAt(CASTLE_X);
    this.flag = { x: CASTLE_X, y: g - 1, y0: g - 1, vy: 0, down: false };
    this.beach.swell = 1.2;
    for (let i = 0; i < 200; i++) this.beach.tick();   // let the dunes and the sea settle
    this.startPack = this.beach.count(PACK);
  }

  on(fn) { this.listeners.push(fn); }
  emit(type, data = {}) { for (const fn of this.listeners) fn(type, data); }
  sfx(name, x = 80, v = 1) { this.sounds.push({ name, x, v }); }
  pop(x, y, text, color = '#fff4dc') { this.pops.push({ x, y, text, color, t: 0 }); }
  pay(e, x, y) { if (e.paid) return; e.paid = true; this.earn(e.shells, x, y); }
  earn(n, x, y) {
    this.shells = Math.max(0, this.shells + n);
    if (n > 0) this.stats.shellsEarned += n;
    this.pop(x, y, (n > 0 ? '+' : '') + n, n > 0 ? '#fff4dc' : '#ff6b5a');
    if (n > 0) this.sfx('shell', x);
  }

  get tod() {
    const len = this.wave === WAVES.length - 1 ? SUNSET_LEN : WAVE_LEN;
    const p = this.phase === 'wave' ? Math.min(1, this.t / len) : this.phase === 'end' ? 1 : 0;
    return Math.min(1, (this.wave + p) / WAVES.length);
  }
  get castle() { return this.beach.packCount; }
  get active() { return this.ents.filter((e) => !e.gone && e.kind !== 'pickup' && e.st !== 'leave' && e.st !== 'flee').length; }

  // ---- phases
  startWave() {
    if (this.phase !== 'build') return;
    const w = WAVES[this.wave];
    this.phase = 'wave'; this.t = 0;
    this.fromSea = this.beach.sea;
    this.spawnQ = [];
    const spawnEnd = this.wave === WAVES.length - 1 ? 30 : 32;
    for (const [k, n] of Object.entries(w.spawn)) for (let i = 0; i < n; i++) this.spawnQ.push({ kind: k, at: 1 + this.r() * spawnEnd });
    this.spawnQ.sort((a, b) => a.at - b.at);
    this.nextPickup = 6;
    this.emit('wave', { wave: this.wave });
    this.sfx('whistle');
  }
  endWave() {
    for (const e of this.ents) if (!e.gone && e.kind !== 'pickup' && e.st !== 'grab') this.leave(e);
    this.wave++;
    if (this.wave >= WAVES.length) { this.finish('sunset'); return; }
    this.phase = 'build'; this.t = 0;
    this.beach.swell = 1.2;
    this.emit('build', { wave: this.wave });
  }
  finish(why) {
    if (this.phase === 'end') return;
    this.phase = 'end'; this.t = 0;
    this.over = why;
    if (this.held) this.release();
    this.emit('end', { why, score: this.score() });
  }
  score() { return this.beach.packCount; }

  // ---- the clock
  tick(dt = 1 / 60) {
    if (this.paused) return;
    this.clock = (this.clock || 0) + dt;
    this.t += dt;
    const b = this.beach;
    if (this.phase === 'wave' && !this.noWaves) {
      const w = WAVES[this.wave], len = this.wave === WAVES.length - 1 ? SUNSET_LEN : WAVE_LEN;
      const u = Math.min(1, this.t / (len * 0.6));
      b.sea = this.fromSea + (w.sea - this.fromSea) * u;
      b.swell = 1.2 + (w.swell - 1.2) * Math.min(1, this.t / 8);
      while (this.spawnQ.length && this.spawnQ[0].at <= this.t) this.spawn(this.spawnQ.shift().kind);
      if ((this.nextPickup -= dt) <= 0) { this.nextPickup = 6 + this.r() * 5; this.washUpShell(); }
      const last = this.wave === WAVES.length - 1;
      if (last ? this.t >= len : this.t >= len && (this.active === 0 || this.t >= len + 15)) this.endWave();
    }
    b.tick(dt);
    for (const e of this.ents) if (!e.gone) this.update(e, dt);
    this.ents = this.ents.filter((e) => !e.gone);
    this.particles(dt);
    this.flagTick(dt);
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 1.4);
  }

  flagTick(dt) {
    const f = this.flag, b = this.beach;
    if (f.down) return;
    const fy = Math.floor(f.y);
    const under = b.get(f.x, fy + 1);
    if (!SOLID[under]) { f.vy = Math.min(40, f.vy + G * dt); f.y += f.vy * dt; }
    else { f.vy = 0; f.y = fy; if (SOLID[b.get(f.x, fy)]) f.y = b.topAt(f.x, fy - 6) - 1; }
    if (b.get(f.x, Math.floor(f.y)) === WATER || f.y - f.y0 > 16 || f.y >= H - 2) {
      f.down = true;
      this.sfx('flagdown');
      this.emit('flag');
      if (this.phase === 'wave' || this.phase === 'build') this.finish('flag');
    }
  }

  // ---- visitors
  spawn(kind, opts = {}) {
    const K = KINDS[kind], b = this.beach;
    const e = { kind, ...K, x: 0, y: 0, vx: 0, vy: 0, st: 'walk', dir: 1, t: 0, act: 0, anim: 0, work: 0, bucket: 0, patience: 2, holes: 0, id: Math.random(), ...opts };
    if (kind === 'crab') { e.x = opts.x ?? W + 3; e.dir = -1; }
    else if (kind === 'gull') { e.x = opts.x ?? (this.r() < 0.5 ? -5 : W + 5); e.y = 6 + this.r() * 10; e.st = 'fly'; e.dir = e.x < 0 ? 1 : -1; }
    else { e.x = opts.x ?? 16; e.dir = 1; }   // over the dunes
    if (kind === 'man') e.spot = 40 + this.r() * 60;
    if (kind !== 'gull') e.y = this.standY(Math.max(0, Math.min(W - 1, Math.round(e.x))), 0, 99);
    this.ents.push(e);
    this.emit('spawn', { kind, e });
    if (kind === 'gull') this.sfx('caw', e.x);
    if (kind === 'dog') this.sfx('bark', e.x);
    return e;
  }

  standY(x, y, climb) {
    const xi = Math.max(0, Math.min(W - 1, Math.round(x)));
    return this.beach.topAt(xi, Math.floor(y) - climb) - 1;
  }

  // nearest packed grain within r of (x, y)
  findPack(x, y, r) {
    const b = this.beach;
    let best = null, bd = 1e9;
    for (let j = Math.floor(y - r); j <= y + r; j++) for (let i = Math.floor(x - r); i <= x + r; i++) {
      if (b.get(i, j) !== PACK || i < 0 || i >= W) continue;
      const d = (i - x) ** 2 + (j - y) ** 2;
      if (d < bd && d <= r * r) { bd = d; best = [i, j]; }
    }
    return best;
  }

  castleSpan() {
    const b = this.beach;
    let lo = W, hi = -1;
    for (let x = 0; x < W; x++) for (let y = 20; y < 90; y++) if (b.t[y * W + x] === PACK) { if (x < lo) lo = x; if (x > hi) hi = x; break; }
    return [lo, hi];
  }

  leave(e) {
    if (e.st === 'leave' || e.st === 'flee') return;
    if (e.kind === 'gull') { e.st = 'flee'; return; }
    e.st = 'leave';
    e.dir = e.kind === 'crab' ? 1 : -1;
  }

  update(e, dt) {
    e.t += dt; e.anim += dt;
    const b = this.beach;
    if (e.kind === 'pickup') {
      e.life -= dt;
      if (e.life <= 0) e.gone = true;
      if (!SOLID[b.get(Math.round(e.x), Math.floor(e.y) + 1)]) e.y = this.standY(e.x, e.y, 0);
      return;
    }
    if (e.st === 'grab') return this.followPtr(e, dt);
    if (e.st === 'fly' && e.kind === 'gull') return this.gullFly(e, dt);
    if (e.st === 'flee') {
      e.x += e.dir * 30 * dt; e.y -= 18 * dt;
      if (e.x < -10 || e.x > W + 10 || e.y < -10) e.gone = true;
      return;
    }
    if (e.st === 'air') return this.air(e, dt);
    if (e.st === 'stun') { if (e.t > e.stun) { e.st = 'walk'; e.t = 0; } return; }
    if (e.st === 'peck') return this.peck(e, dt);
    if (e.st === 'work') return this.work(e, dt);
    if (e.st === 'balk') { if (e.t > 1.2) { this.leave(e); this.emit('balk', { e }); } return; }

    // walking (towards the castle) or leaving (away from it)
    const leaving = e.st === 'leave';
    if (!leaving) {
      if (e.kind === 'man') e.dir = e.x < e.spot ? 1 : -1;
      else if ((e.retarget = (e.retarget || 0) - dt) <= 0) {
        e.retarget = 0.5;
        const [lo, hi] = this.castleSpan();
        if (hi < 0) this.leave(e);
        else if (e.kind === 'crab') e.dir = e.x > hi ? -1 : e.x < lo ? 1 : e.dir;
        else e.dir = e.x < lo ? 1 : e.x > hi ? -1 : e.dir;
      }
      if (e.kind === 'man' && Math.abs(e.x - e.spot) < 1) { e.st = 'work'; e.t = 0; e.work = 0; this.sfx('beep', e.x); return; }
      // close enough to the castle to get to work?
      if (e.kind !== 'man') {
        const fx = e.x + e.dir * (e.w / 2 + 1);
        const hit = this.findPack(fx, e.y - Math.min(3, e.h / 2), e.kind === 'dog' ? 3 : 2.5);
        if (hit) { e.st = 'work'; e.t = 0; e.act = 0; return; }
      }
    }
    const probe = Math.round(e.x + e.dir * (e.w / 2));
    if (probe >= 0 && probe < W) {
      const ny = this.standY(probe, e.y, e.climb);
      if (ny < Math.floor(e.y) - e.climb) {
        // too tall to step up
        if (e.kind === 'crab') { e.y = this.standY(probe, e.y, 30); }
        else if (e.kind === 'dog') { e.st = 'air'; e.vx = e.dir * 18; e.vy = -38; e.thrown = false; e.resume = leaving ? 'leave' : 'walk'; return; }
        else if (!leaving) { e.st = 'balk'; e.t = 0; return; }
        else { e.y = this.standY(probe, e.y, 30); }   // heading home: scramble over it rather than pace back and forth forever
      }
      if ((e.kind === 'kid' || e.kind === 'man') && !leaving) {
        const depth = b.depthAt(probe, ny);
        if (depth >= 2) { e.st = 'balk'; e.t = 0; this.pop(e.x, e.y - e.h - 2, e.kind === 'kid' ? 'too deep!' : 'hmm', '#cfefff'); return; }
      }
    }
    const inWater = b.get(Math.round(e.x), Math.floor(e.y)) === WATER;
    const sp = e.speed * (leaving ? 1.3 : 1) * (inWater && e.kind !== 'crab' ? 0.5 : 1);
    e.x += e.dir * sp * dt;
    const sy = this.standY(e.x, e.y, e.kind === 'crab' ? 30 : e.climb + 1);
    if (sy > e.y + 2) { e.st = 'air'; e.vx = e.dir * sp; e.vy = 0; e.thrown = false; e.resume = leaving ? 'leave' : 'walk'; }
    else e.y = sy;
    if (e.x < -8 || e.x > W + 8) e.gone = true;
  }

  work(e, dt) {
    const b = this.beach;
    e.act -= dt;
    if (e.kind === 'man') {
      // the detectorist: beep, then dig a hole wherever he's stood
      if (e.t < 1.6) { if (e.act <= 0) { e.act = 0.4; this.sfx('beep', e.x); } return; }
      if (e.act <= 0) {
        e.act = 0.07;
        const hx = e.x + e.dir * 5, hy = e.y + 1 + Math.min(5, e.work / 6);
        const got = this.takeCell(hx + (this.r() - 0.5) * 6, hy + (this.r() - 0.5) * 3);
        if (got) this.throwGrain(e.x + e.dir * 5, e.y - 1, -e.dir * (6 + this.r() * 14), -20 - this.r() * 20, got);
        e.work++;
      }
      if (e.t > 4.6) {
        e.holes++; e.st = e.holes >= 2 ? 'leave' : 'walk'; e.t = 0;
        e.dir = e.st === 'leave' ? -1 : e.dir;
        e.spot = Math.max(30, Math.min(120, e.x + (this.r() < 0.5 ? -1 : 1) * (14 + this.r() * 20)));
      }
      return;
    }
    const fx = e.x + e.dir * (e.w / 2 + 1), fy = e.y - Math.min(3, e.h / 2);
    if (e.act > 0) return;
    const hit = this.findPack(fx, fy, e.kind === 'dog' ? 3.5 : 3);
    if (!hit) { e.st = 'walk'; e.t = 0; return; }
    const [hx, hy] = hit;
    if (e.kind === 'crab') {
      e.act = 0.6;
      b.set(hx, hy, SAND);
      this.throwGrain(hx, hy, -e.dir * (4 + this.r() * 6), -8 - this.r() * 8, SAND, true);
      this.sfx('pinch', e.x, 0.6);
    } else if (e.kind === 'kid') {
      e.act = 0.45;
      b.set(hx, hy, E);
      e.bucket++;
      this.sfx('scoop', e.x, 0.6);
      if (e.bucket >= 14) { this.leave(e); this.pop(e.x, e.y - 10, 'mine now', '#fff4dc'); }
    } else if (e.kind === 'dog') {
      e.act = 0.08;
      b.set(hx, hy, E);
      this.throwGrain(e.x - e.dir * 3, e.y - 2, -e.dir * (18 + this.r() * 20), -14 - this.r() * 22, SAND);
      if (this.r() < 0.15) this.sfx('dig', e.x, 0.5);
      e.work++;
      if (e.work > 30 && this.r() < 0.02) { e.st = 'walk'; e.dir = -e.dir; e.work = 0; e.retarget = 1.2; this.sfx('bark', e.x); }
    }
  }

  gullFly(e, dt) {
    const b = this.beach;
    if (!e.target || e.retarget-- <= 0) {
      e.retarget = 40;
      const [lo, hi] = this.castleSpan();
      if (hi < 0) { e.st = 'flee'; return; }
      // the highest packed grain, give or take
      let best = null;
      for (let k = 0; k < 12; k++) {
        const x = Math.round(lo + this.r() * (hi - lo));
        const y = b.topAt(x);
        if (b.get(x, y) === PACK && (!best || y < best[1])) best = [x, y];
      }
      e.target = best;
    }
    if (!e.target) return;
    const [tx, ty] = e.target;
    const dx = tx - e.x, dy = ty - 1 - e.y, d = Math.hypot(dx, dy);
    if (d < 1) { e.st = 'peck'; e.t = 0; e.x = tx; e.y = this.standY(tx, ty, 2); e.pecks = 0; return; }
    const sp = Math.min(e.speed, d * 3 + 4);
    e.x += (dx / d) * sp * dt; e.y += (dy / d) * sp * dt + Math.sin(e.anim * 6) * 0.05;
    e.dir = dx > 0 ? 1 : -1;
  }

  peck(e, dt) {
    const b = this.beach;
    if (!SOLID[b.get(Math.round(e.x), Math.floor(e.y) + 1)]) { e.st = 'fly'; e.target = null; return; }
    e.act -= dt;
    if (e.act > 0) return;
    e.act = 0.55;
    const hit = this.findPack(e.x + e.dir * 3, e.y, 2.5) || this.findPack(e.x, e.y + 1, 2);
    if (!hit) { e.st = 'fly'; e.target = null; return; }
    b.set(hit[0], hit[1], SAND);
    this.sfx('peck', e.x, 0.5);
    if (++e.pecks >= 9) { e.st = 'flee'; e.dir = e.x < 80 ? -1 : 1; this.sfx('caw', e.x); }
  }

  takeCell(x, y) {
    const b = this.beach, xi = Math.round(x), yi = Math.round(y);
    const k = b.get(xi, yi);
    if (k === SAND || k === WET || k === PACK) { b.set(xi, yi, E); return k === PACK ? SAND : k; }
    return 0;
  }

  // ---- flinging
  pickAt(x, y, rad) {
    let best = null, bd = 1e9;
    for (const e of this.ents) {
      if (e.gone || e.st === 'grab') continue;
      const cx = e.x, cy = e.y - e.h / 2 + 0.5;
      const dx = Math.max(0, Math.abs(x - cx) - e.w / 2), dy = Math.max(0, Math.abs(y - cy) - e.h / 2);
      const d = Math.hypot(dx, dy);
      const r = e.kind === 'pickup' ? rad * 1.2 : rad;
      if (d <= r && d < bd) { bd = d; best = e; }
    }
    return best;
  }
  grab(x, y, rad = 4) {
    const e = this.pickAt(x, y, rad);
    this.ptr = { x, y, hist: [[x, y, this.now()]] };
    if (!e) return null;
    if (e.kind === 'pickup') { e.gone = true; this.earn(1, e.x, e.y - 3); this.emit('pickup'); this.ptr = null; return e; }
    if (e.st === 'leave' && e.kind !== 'kid') { /* fine, fling it anyway */ }
    e.prev = e.st === 'grab' ? 'walk' : e.st;
    e.st = 'grab'; e.t = 0;
    e.ox = e.x - x; e.oy = e.y - y;
    e.grabY = e.y;
    e.oy = Math.max(-1, Math.min(e.h, e.oy));
    this.held = e;
    if (e.kind === 'kid' && e.bucket) this.spillBucket(e);
    this.sfx('grab', e.x);
    this.emit('grab', { e });
    return e;
  }
  now() { return this.clock || 0; }
  move(x, y) {
    if (!this.ptr) return;
    this.ptr.x = x; this.ptr.y = y;
    this.ptr.hist.push([x, y, this.now()]);
    if (this.ptr.hist.length > 12) this.ptr.hist.shift();
  }
  ptrVel() {
    const h = this.ptr?.hist; if (!h || h.length < 2) return [0, 0];
    const t1 = h[h.length - 1][2];
    let j = h.length - 1;
    while (j > 0 && t1 - h[j - 1][2] < 0.09) j--;
    if (j === h.length - 1) j = Math.max(0, j - 1);
    const dt = Math.max(0.016, t1 - h[j][2]);
    return [(h[h.length - 1][0] - h[j][0]) / dt, (h[h.length - 1][1] - h[j][1]) / dt];
  }
  followPtr(e, dt) {
    if (!this.ptr) return;
    const k = 1 - Math.exp(-e.follow * dt);
    // keep the ptr's recent motion fresh even when the finger holds still
    const p = this.ptr;
    if (p.hist.length && this.now() - p.hist[p.hist.length - 1][2] > 0.05) { p.hist.push([p.x, p.y, this.now()]); if (p.hist.length > 12) p.hist.shift(); }
    const tx = p.x + e.ox * 0.5, ty = p.y + e.oy * 0.5 + e.h / 2;
    e.x += (tx - e.x) * k; e.y += (ty - e.y) * k;
    e.x = Math.max(-6, Math.min(W + 6, e.x)); e.y = Math.max(-4, Math.min(H - 6, e.y));
    // dragged things ride over the sand, not through it
    for (let n = 0; n < 24 && SOLID[this.beach.get(Math.round(e.x), Math.floor(e.y))]; n++) e.y -= 1;
    // the detectorist can be dragged off, but not thrown far
    if (e.kind === 'man' && (e.x < 0 || e.x > W)) { this.held = null; this.ptr = null; this.removed(e, 'dragged'); }
  }
  release() {
    const e = this.held;
    const [vx, vy] = this.ptrVel();
    this.ptr = null; this.held = null;
    if (!e || e.gone) return;
    const sp = Math.hypot(vx, vy);
    const cap = 150 / Math.max(1, sp / 150);
    e.vx = vx * e.throw * Math.min(1, cap / Math.max(1, sp)); e.vy = vy * e.throw * Math.min(1, cap / Math.max(1, sp));
    e.relSpeed = sp;
    e.st = 'air'; e.t = 0; e.thrown = true; e.peak = e.y;
    if (sp > 40) this.sfx('whoosh', e.x, Math.min(1, sp / 140));
    this.stats.flung++;
    if (e.kind === 'gull') {
      if (sp > 12) { e.st = 'flee'; e.dir = vx < 0 ? -1 : 1; this.pay(e, e.x, e.y - 4); this.sfx('caw', e.x); this.emit('removed', { e, how: 'shoo' }); }
      else { e.st = 'fly'; e.target = null; }
    }
    this.emit('release', { e, speed: sp });
  }

  air(e, dt) {
    const b = this.beach;
    const steps = Math.max(1, Math.ceil(Math.hypot(e.vx, e.vy) * dt / 0.5));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      const inW = b.get(Math.round(e.x), Math.floor(e.y)) === WATER;
      if (inW) { e.vx *= 0.96; e.vy = e.vy * 0.94 + 4 * h; if (!e.splashed && Math.abs(e.vy) + Math.abs(e.vx) > 15) { e.splashed = true; this.splash(e.x, e.y, Math.hypot(e.vx, e.vy)); } }
      else e.vy += G * h;
      const nx = e.x + e.vx * h, ny = e.y + e.vy * h;
      // walls
      const xi = Math.round(nx), yi = Math.floor(ny);
      if (xi >= 0 && xi < W && SOLID[b.get(xi, yi)] && !SOLID[b.get(Math.round(e.x), yi)]) {
        this.impact(e, xi, yi, Math.abs(e.vx));
        e.vx *= -0.25;
      } else e.x = nx;
      if (e.vy > 0 && SOLID[b.get(Math.round(e.x), Math.floor(ny) + 1)]) {
        this.impact(e, Math.round(e.x), Math.floor(ny) + 1, Math.hypot(e.vx, e.vy));
        e.y = Math.floor(ny); return this.land(e);
      }
      e.y = ny;
      if (e.y < e.peak) e.peak = e.y;
      if (e.x < -6 || e.x > W + 6 || e.y > H + 2) return this.removed(e, 'out');
    }
    // came to rest in water
    if (b.get(Math.round(e.x), Math.floor(e.y)) === WATER && Math.abs(e.vy) < 3 && e.vy >= 0 && SOLID[b.get(Math.round(e.x), Math.floor(e.y) + 1)]) this.land(e);
  }

  impact(e, x, y, sp) {
    if (sp < 38) return;
    const n = this.beach.crater(x, y, Math.min(3.5, 1 + (sp - 38) / 30 + (e.kind === 'man' || e.kind === 'dog' ? 0.8 : 0)));
    this.sfx('thud', x, Math.min(1, sp / 100));
    for (let i = 0; i < 6; i++) this.throwGrain(x, y - 1, (this.r() - 0.5) * 30, -10 - this.r() * 20, SAND, true);
    if (n > 0) this.emit('crater', { n, e });
  }

  land(e) {
    const b = this.beach;
    const xi = Math.round(e.x), yi = Math.floor(e.y);
    const depth = b.depthAt(xi, yi);
    const sea = depth > 0 && b.conn[yi * W + xi] === b.step;
    e.vx = e.vy = 0; e.t = 0;
    // stepped off a ledge: carry on with whatever it was doing (a visitor heading home stays heading home)
    if (!e.thrown) { e.st = e.resume || 'walk'; return; }
    e.thrown = false;
    const hard = e.relSpeed >= GENTLE || e.peak < e.grabY - 14 && e.y - e.peak > 12;
    if (e.kind === 'crab') {
      if (sea && depth >= 2) return this.removed(e, 'sea');
      e.st = 'stun'; e.stun = 1.4; return;
    }
    if (e.kind === 'kid') {
      if (sea && depth >= 2) { this.earn(-5, e.x, e.y - 10); this.pop(e.x, e.y - 16, 'WHISTLE!', '#ff6b5a'); this.sfx('whistle', e.x); this.stats.kidsRough++; this.emit('kid', { e, gentle: false, sea: true }); }
      else if (hard) { this.earn(-3, e.x, e.y - 10); this.pop(e.x, e.y - 16, 'MUM!', '#ff6b5a'); this.sfx('wah', e.x); this.stats.kidsRough++; this.emit('kid', { e, gentle: false }); }
      else { this.pay(e, e.x, e.y - 10); this.stats.kidsGentle++; this.sfx('giggle', e.x); this.emit('kid', { e, gentle: true }); }
      e.st = 'leave'; e.dir = -1; e.paid = true; return;
    }
    if (e.kind === 'dog') {
      if (--e.patience <= 0) { this.pay(e, e.x, e.y - 8); this.leave(e); this.sfx('bark', e.x); this.emit('removed', { e, how: 'bored' }); return; }
      e.st = 'stun'; e.stun = 0.5; this.sfx('bark', e.x); return;
    }
    if (e.kind === 'man') { e.st = 'stun'; e.stun = 1.8; this.pop(e.x, e.y - 16, 'oi!', '#fff4dc'); return; }
    e.st = 'walk';
  }

  removed(e, how) {
    if (e.gone) return;
    e.gone = true;
    if (e.kind === 'kid') {
      this.earn(-5, Math.max(4, Math.min(W - 4, e.x)), 30); this.pop(Math.max(8, Math.min(W - 8, e.x)), 24, 'WHISTLE!', '#ff6b5a'); this.sfx('whistle'); this.stats.kidsRough++;
      this.emit('kid', { e, gentle: false, out: true });
      return;
    }
    if (how === 'sea') this.sfx('plop', e.x);
    this.pay(e, Math.max(4, Math.min(W - 4, e.x)), Math.max(10, Math.min(H - 20, e.y - 4)));
    this.emit('removed', { e, how });
  }

  // ---- bits flying about
  throwGrain(x, y, vx, vy, k = SAND, small = false) {
    this.parts.push({ x, y, vx, vy, k, life: 3, grain: !small || this.r() < 0.5 });
  }
  splash(x, y, sp) {
    this.sfx('splash', x, Math.min(1, sp / 80));
    for (let i = 0; i < Math.min(18, 4 + sp / 4); i++) this.parts.push({ x, y: y - 1, vx: (this.r() - 0.5) * 40, vy: -15 - this.r() * 30, k: WATER, life: 1.2, grain: false });
  }
  spillBucket(e) {
    for (let i = 0; i < e.bucket; i++) this.throwGrain(e.x + 2, e.y - 3, (this.r() - 0.5) * 16, -6 - this.r() * 10, SAND);
    e.bucket = 0;
  }
  particles(dt) {
    const b = this.beach;
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += G * dt;
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
      const xi = Math.round(nx), yi = Math.round(ny);
      if (xi < 0 || xi >= W || yi >= H) { p.life = 0; continue; }
      if (yi >= 0 && (SOLID[b.get(xi, yi)] || (p.k === WATER && b.get(xi, yi) === WATER))) {
        if (p.grain && p.k !== WATER) {
          // settle on the first free cell at or above the hit
          let y = yi; while (y > 0 && b.get(xi, y) !== E && b.get(xi, y) !== WATER) y--;
          if (y > 0) b.set(xi, y, p.k === PACK ? SAND : p.k);
        }
        p.life = 0; continue;
      }
      p.x = nx; p.y = ny;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
  }

  washUpShell() {
    const b = this.beach;
    if (this.ents.filter((e) => e.kind === 'pickup').length >= 3) return;
    // the waterline: the leftmost surface water touching the sea
    let shore = W - 1;
    for (let x = 30; x < W; x++) { const y = b.topAt(x); const wy = b.waterTop(x); if (wy < H && b.conn[wy * W + x] === b.step) { shore = x; break; } }
    const x = Math.max(20, shore - 3 - Math.floor(this.r() * 10));
    const y = this.standY(x, 0, 0);
    this.ents.push({ kind: 'pickup', x, y, w: 3, h: 3, st: 'idle', life: 28, t: 0, anim: 0 });
  }

  // ---- building
  canBuild() { return this.phase === 'build'; }
  dig(x, y, rad = 2.6) {
    if (!this.canBuild()) return 0;
    const room = PAIL_MAX - this.pail;
    if (room <= 0) return 0;
    const n = this.beach.dig(x, y, rad, room);
    this.pail += n;
    return n;
  }
  packAt(x, y, rad = 2.6) {
    if (!this.canBuild()) return 0;
    const n = this.beach.pack(x, y, rad, this.pail);
    this.pail -= n;
    return n;
  }
  pebAt(x, y, rad = 2.2) {
    if (!this.canBuild()) return 0;
    if (this.pebStock <= 0) {
      if (this.shells < PRICES.peb) return -1;
      this.shells -= PRICES.peb; this.pebStock += PEB_BAG;
      this.sfx('buy');
    }
    const n = this.beach.pebbles(x, y, rad, this.pebStock);
    this.pebStock -= n;
    return n;
  }
  towerAt(x, y) {
    if (!this.canBuild() || this.shells < PRICES.tower) return false;
    this.shells -= PRICES.tower;
    this.beach.tower(Math.round(x), Math.round(y));
    this.sfx('stamp', x);
    return true;
  }
  postAt(x, y) {
    if (!this.canBuild() || this.shells < PRICES.post) return false;
    this.shells -= PRICES.post;
    this.beach.post(Math.round(x), Math.round(y));
    this.sfx('knock', x);
    return true;
  }
}
