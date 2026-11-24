// The rules: one craft, one lake, one listener. No DOM in here.
import { HOME, FALSE_HOME, MARKS, VENTS, markById, sdf, grad, castRay, clear, flow, EMPTY_SPOTS, SIZE } from './world.js';

export const THR = [
  { name: 'ASTERN', v: -2.2, r: 45 }, { name: 'STOP', v: 0, r: 0 }, { name: 'CREEP', v: 3, r: 34 }, { name: 'HALF', v: 6, r: 95 }, { name: 'FULL', v: 9.5, r: 190 },
];
export const STOP = 1, PING_R = 250, RANGE = 170, AIR = 900;
export const brg = (dx, dy) => (Math.atan2(dx, dy) + Math.PI * 2) % (Math.PI * 2);
export const wrap = a => { a = (a + Math.PI) % (Math.PI * 2); return (a < 0 ? a + Math.PI * 2 : a) - Math.PI; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Game {
  constructor(save, seed) {
    let s = seed || (Math.random() * 1e9) | 0;
    this.rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    this.events = [];
    this.no = 7; this.delivered = []; this.shot = []; this.wrecks = []; this.echo = new Map(); this.fixes = []; this.losses = 0; this.T = 0; this.prints = []; this.ended = false; this.oddSeen = false;
    if (save) for (const k of ['no', 'delivered', 'wrecks', 'losses', 'T', 'ended', 'oddSeen']) if (save[k] !== undefined) this[k] = save[k];
    if (save && save.echo) for (const k of save.echo) this.echo.set(k, 1);
    this.lower();
  }
  save() { const { no, delivered, wrecks, losses, T, ended, oddSeen } = this; return { no, delivered, wrecks, losses, T, ended, oddSeen, echo: [...this.echo.keys()] }; }
  ev(type, d) { this.events.push({ type, ...d }); }
  get level() { return this.delivered.length + this.shot.length; }
  get finale() { return ['A', 'B', 'C', 'D', 'E', 'F'].every(m => this.delivered.includes(m)); }
  get open() { return this.delivered.includes('A'); }     // the rest of the chart
  marks() { return MARKS.filter(m => m.id === 'A' || (m.id === 'G' ? this.finale : this.open)); }

  lower() { // begin a dive at the shaft
    this.x = HOME.x; this.y = HOME.y; this.h = .12; this.v = 0; this.course = .12; this.thr = STOP;
    this.air = AIR; this.hull = 100; this.decoys = 3; this.shot = []; this.live = true; this.cam = 0; this.pingT = 0; this.sinceNoise = 99; this.heardR = 0; this.grind = 0; this.decoy = null; this.fixes = [];
    this.aged = 0; this.callT = 0; this.calls = 0; this.mimicT = 40; this.warn = 0; this.feelT = 0; this.hullHit = 0; this.lostWhy = '';
    this.fix();
    const far = EMPTY_SPOTS.filter(p => Math.hypot(p.x - HOME.x, p.y - HOME.y) > 220);
    const p = far[(this.rnd() * far.length) | 0];
    this.c = { on: this.open, x: p.x, y: p.y, h: 0, st: 'roam', t: 0, tx: p.x, ty: p.y, f: null, v: 0, rest: 6 };
  }
  fix() { this.fixes.push([this.x, this.y]); if (this.fixes.length > 60) this.fixes.shift(); }

  // --- controls
  order(a) { if (this.live) this.course = (a + Math.PI * 2) % (Math.PI * 2); }
  throttle(n) { n = clamp(n, 0, 4); if (!this.live || n === this.thr) return; this.thr = n; this.ev('throttle', { n }); }
  ping() {
    if (!this.live || this.pingT > 0) return false;
    this.pingT = 2.6;
    const hits = [];
    for (let i = 0; i < 200; i++) {
      const a = i / 200 * Math.PI * 2, d = castRay(this.x, this.y, a, RANGE);
      if (d < RANGE) { const X = this.x + Math.sin(a) * d, Y = this.y + Math.cos(a) * d; hits.push({ x: X, y: Y, d, k: 'wall' }); this.echo.set(((X / 4) | 0) + ((Y / 4) | 0) * 256, 1); }
    }
    for (const m of this.marks()) this.solidHit(hits, m, 'mark');
    for (const w of this.wrecks) if (!w.done) this.solidHit(hits, w, 'wreck');
    this.solidHit(hits, HOME, 'home');
    if (this.c.on) { const d = Math.hypot(this.c.x - this.x, this.c.y - this.y); if (d < RANGE && clear(this.x, this.y, this.c.x, this.c.y)) hits.push({ x: this.c.x, y: this.c.y, d, k: 'it' }); }
    this.fix();
    this.ev('ping', { x: this.x, y: this.y, hits });
    this.noise(PING_R, 'ping');
    return true;
  }
  solidHit(hits, m, k) { const d = Math.hypot(m.x - this.x, m.y - this.y); if (d < RANGE && clear(this.x, this.y, m.x, m.y)) hits.push({ x: m.x, y: m.y, d, k }); }
  shoot() {
    if (!this.live || this.cam > 0) return false;
    this.cam = 9;
    let best = null, why = '';
    for (const m of this.marks()) {
      const d = Math.hypot(m.x - this.x, m.y - this.y), off = Math.abs(wrap(brg(m.x - this.x, m.y - this.y) - this.h));
      if (d > 90 || !clear(this.x, this.y, m.x, m.y)) continue;
      if (d <= 34 && off < .42) best = m; else if (d <= 34) why = 'turn'; else if (off < .5) why = 'far'; else if (!why) why = 'seek';
    }
    const c = this.c, cd = Math.hypot(c.x - this.x, c.y - this.y), coff = Math.abs(wrap(brg(c.x - this.x, c.y - this.y) - this.h));
    const it = c.on && cd < 42 && coff < .55 && clear(this.x, this.y, c.x, c.y);
    let wreck = null; for (const w of this.wrecks) if (Math.hypot(w.x - this.x, w.y - this.y) < 45) wreck = w;
    const fresh = best && !this.delivered.includes(best.id) && !this.shot.includes(best.id);
    if (fresh) { this.shot.push(best.id); if (best.id === 'G') { this.callT = 14; c.st = 'roam'; c.rest = 30; } }
    this.ev('shot', { x: this.x, y: this.y, h: this.h, mark: best && best.id, fresh, why, it, wreck, cx: c.x, cy: c.y, ch: c.h, con: c.on });
    this.noise(70, 'shutter');
    return true;
  }
  drop() {
    if (!this.live || this.decoys < 1 || this.decoy) return false;
    this.decoys--; this.decoy = { x: this.x, y: this.y, t: 22, arm: 4 }; this.ev('drop'); return true;
  }
  get atHome() { return Math.hypot(this.x - HOME.x, this.y - HOME.y) < 26; }
  winch() {
    if (!this.live || !this.atHome || Math.abs(this.v) > 2) return false;
    const brought = this.shot.slice(); this.delivered.push(...brought); this.shot = []; this.live = false;
    if (brought.includes('G')) this.ended = true;
    this.ev('winch', { brought }); return true;
  }
  lose(why) {
    if (!this.live) return;
    this.live = false; this.losses++; this.lostWhy = why;
    if (this.shot.length) this.wrecks.push({ x: this.x, y: this.y, no: this.no, film: this.shot.slice() });
    else this.wrecks.push({ x: this.x, y: this.y, no: this.no, film: [] });
    while (this.wrecks.length > 4) { const i = this.wrecks.findIndex(w => !w.film.length); this.wrecks.splice(Math.max(0, i), 1); }
    this.ev('lost', { why, no: this.no }); this.no++;
  }

  // --- sound in the water
  ventAt(x, y) { for (const v of VENTS) if (Math.hypot(x - v.x, y - v.y) < v.r) return true; return false; }
  noise(r, why) {
    if (this.ventAt(this.x, this.y) && why !== 'ping') r *= .35;
    this.heardR = Math.max(this.heardR, r); this.sinceNoise = 0;
    const c = this.c; if (!c.on) return;
    if (c.st === 'feel') return; // handled by the hull
    const d = Math.hypot(c.x - this.x, c.y - this.y), reach = r * (.85 + .05 * this.level);
    if (d < reach) this.hear(this.x, this.y, d, why);
  }
  hear(x, y, d, why) {
    const c = this.c; if (c.st === 'flee' || (c.rest > 18 && why !== 'decoy')) return; // it has just been, and has lost interest
    c.heard = 0; c.hx = x; c.hy = y;
    const err = why === 'decoy' ? 0 : clamp((d - 30) * .12, 0, 22), a = this.rnd() * 6.28;
    this.goto(x + Math.cos(a) * err, y + Math.sin(a) * err);
    if (d < 150 && why !== 'decoy' && c.rest <= 0) { if (c.st !== 'hunt') this.ev('hunt', { d }); c.st = 'hunt'; } else if (c.st !== 'hunt' || why === 'decoy') { if (c.st === 'roam') this.ev('stir', { d }); c.st = 'seek'; }
    c.t = 0;
  }
  goto(x, y) {
    const c = this.c; if (sdf(x, y) < 6) { const g = grad(x, y), k = 8 - sdf(x, y); x += g[0] * k; y += g[1] * k; }
    if (c.f && Math.hypot(c.f.tx - x, c.f.ty - y) < 10) { c.tx = x; c.ty = y; return; }
    c.tx = clamp(x, 20, SIZE - 20); c.ty = clamp(y, 20, SIZE - 20); c.f = flow(c.tx, c.ty, 4);
  }

  tick(dt) {
    this.T += dt;
    if (!this.live) return;
    this.aged += dt; this.pingT = Math.max(0, this.pingT - dt); this.cam = Math.max(0, this.cam - dt); this.hullHit = Math.max(0, this.hullHit - dt);
    this.sinceNoise += dt; this.heardR *= Math.exp(-dt * 1.6);
    // helm
    const turn = wrap(this.course - this.h), rate = clamp(turn * 2, -.5, .5); this.h = (this.h + rate * dt + Math.PI * 2) % (Math.PI * 2);
    const want = THR[this.thr].v; this.v += clamp(want - this.v, -(want === 0 ? 2.6 : 2.2) * dt, 2.2 * dt);
    this.x += Math.sin(this.h) * this.v * dt; this.y += Math.cos(this.h) * this.v * dt;
    this.walls(dt);
    // engine noise, checked a few times a second
    this.engT = (this.engT || 0) - dt;
    const r = THR[this.thr].r;
    if (r && this.engT <= 0) { this.engT = .5; this.noise(r, 'engine'); }
    // decoy
    if (this.decoy) { const k = this.decoy; k.arm -= dt; k.t -= dt; if (k.arm <= 0) { k.beat = (k.beat || 0) - dt; if (k.beat <= 0) { k.beat = 1.2; this.ev('decoy', { x: k.x, y: k.y }); const c = this.c; if (c.on && c.st !== 'feel') { const d = Math.hypot(c.x - k.x, c.y - k.y); if (d < 320) this.hear(k.x, k.y, d, 'decoy'); } } } if (k.t <= 0) this.decoy = null; }
    // air
    this.air -= dt; const pc = this.air / AIR;
    for (const [i, f] of [[1, .4], [2, .2], [3, .08]]) if (pc < f && this.warn < i) { this.warn = i; this.ev('air', { f }); }
    if (this.air <= 0) return this.lose('air');
    // wreck film
    for (const w of this.wrecks) if (!w.done && Math.hypot(w.x - this.x, w.y - this.y) < 20 && Math.abs(this.v) < 3.4) {
      w.done = true; const got = w.film.filter(m => !this.delivered.includes(m) && !this.shot.includes(m)); this.shot.push(...got); this.ev('salvage', { no: w.no, got });
      if (got.includes('G')) this.callT = 14;
    }
    this.thing(dt);
    if (this.live && this.shot.includes('G')) this.falseCalls(dt);
  }
  walls() {
    let hit = 0;
    const R = 5, d = sdf(this.x, this.y);
    if (d < R) { const g = grad(this.x, this.y); this.x += g[0] * (R - d); this.y += g[1] * (R - d); const dir = this.v < 0 ? -1 : 1; hit = Math.max(0, -(g[0] * Math.sin(this.h) + g[1] * Math.cos(this.h)) * dir) * Math.abs(this.v); }
    for (const m of [...this.marks()]) { const r = m.near + 4.5, dx = this.x - m.x, dy = this.y - m.y, l = Math.hypot(dx, dy); if (l < r && l > .01) { this.x = m.x + dx / l * r; this.y = m.y + dy / l * r; const dir = this.v < 0 ? -1 : 1; hit = Math.max(hit, -(dx / l * Math.sin(this.h) + dy / l * Math.cos(this.h)) * dir * Math.abs(this.v)); } }
    this.grind = Math.max(0, this.grind - .02);
    if (hit > .6) {
      this.grind = 1;
      if (this.hullHit <= 0) { this.hullHit = 1.1; const dmg = hit > 7 ? 14 : hit > 4 ? 6 : 0; this.hull -= dmg; this.ev('bump', { hit, dmg }); this.noise(50 + hit * 14, 'bump'); if (this.hull <= 0) this.lose('wall'); }
      this.v *= .55;
    }
  }
  feelers() { // port, ahead, starboard: metres to the wall, or Infinity past 18 m
    return [-.8, 0, .8].map(a => { let d = castRay(this.x, this.y, this.h + a, 19); for (const m of this.marks()) { const dx = m.x - this.x, dy = m.y - this.y, l = Math.hypot(dx, dy) - m.near; if (l < 19 && Math.abs(wrap(brg(dx, dy) - this.h - a)) < .45) d = Math.min(d, l); } return d; });
  }
  thing(dt) {
    const c = this.c; if (!c.on) return;
    c.t += dt; c.rest = Math.max(0, c.rest - dt); c.heard = (c.heard ?? 99) + dt;
    const d = Math.hypot(c.x - this.x, c.y - this.y), lvl = this.level, engine = THR[this.thr].r > 0;
    if (c.st === 'feel') {
      this.feelT += dt; c.v = 0;
      const a = c.ang + Math.sin(this.feelT * .8) * .5; c.x = this.x + Math.sin(a) * 9; c.y = this.y + Math.cos(a) * 9; c.h = a + Math.PI;
      if (this.feelT > 1.8 && (engine || this.sinceNoise < .15 && this.feelT > 1.8)) return this.strike();
      if (this.feelT > 8) { this.ev('leaves'); c.st = 'roam'; c.rest = 70; c.t = 0; this.away(); }
      return;
    }
    const sp = { roam: 5.5, seek: 7, hunt: 10 + lvl * .2, search: 4, flee: 12 }[c.st] + (c.st === 'roam' && c.rest > 18 ? 2.5 : 0);
    c.v += (sp - c.v) * Math.min(1, dt * 1.5);
    if (!c.f) this.away();
    let dir; const td = Math.hypot(c.tx - c.x, c.ty - c.y);
    if (td < 26 && clear(c.x, c.y, c.tx, c.ty)) dir = [(c.tx - c.x) / (td || 1), (c.ty - c.y) / (td || 1)]; else dir = c.f.dir(c.x, c.y);
    c.h += clamp(wrap(brg(dir[0], dir[1]) - c.h), -1.6 * dt, 1.6 * dt) * 1.4;
    const step = Math.min(c.v * dt, td);
    c.x += dir[0] * step; c.y += dir[1] * step;
    const s = sdf(c.x, c.y); if (s < 3) { const g = grad(c.x, c.y); c.x += g[0] * (3 - s); c.y += g[1] * (3 - s); }
    if (c.st === 'hunt' && d < 11 && c.heard < 1.3) return this.strike();
    if (c.st === 'hunt' && c.heard > 9) c.st = 'seek';
    if (td < 5) {
      if (c.st === 'seek' || c.st === 'hunt') { c.st = 'search'; c.t = 0; c.n = 0; c.pass = this.rnd() < .5; // half the time it noses past without finding you
        this.pokeAround(); }
      else if (c.st === 'search') { if (++c.n > 3 + lvl * .4) { c.st = 'roam'; this.away(); this.ev('loses'); } else this.pokeAround(); }
      else if (c.st === 'flee') { c.st = 'roam'; c.rest = 2; this.away(); }
      else this.away();
    }
    if ((c.st === 'search' || c.st === 'seek' || c.st === 'hunt') && d < 10 && c.rest <= 0) {
      if (engine && c.heard < 1.3) return this.strike();
      if (c.st === 'search' && c.pass) return;
      c.st = 'feel'; this.feelT = 0; c.ang = brg(c.x - this.x, c.y - this.y); this.ev('feel'); return;
    }
    // after the third photograph it has learned your ping
    if (lvl >= 3 && (c.st === 'roam' || c.st === 'search') && d > 40 && d < 230) { this.mimicT -= dt; if (this.mimicT <= 0) { this.mimicT = 34 + this.rnd() * 30; this.ev('mimic', { x: c.x, y: c.y, d, b: brg(c.x - this.x, c.y - this.y) }); } }
  }
  pokeAround() { const c = this.c, a = this.rnd() * 6.28, r = 10 + this.rnd() * 16; this.goto((c.hx ?? c.x) + Math.cos(a) * r, (c.hy ?? c.y) + Math.sin(a) * r); }
  away() { // wander, drifting toward the player's side of the lake as more film is taken
    const c = this.c, s = EMPTY_SPOTS.map(p => ({ p, w: this.rnd() * 500 + Math.hypot(p.x - this.x, p.y - this.y) * (c.rest > 5 ? -1 : .25 + this.level * .08) })).filter(o => Math.hypot(o.p.x - c.x, o.p.y - c.y) > 60).sort((a, b) => a.w - b.w);
    this.goto(s[0].p.x, s[0].p.y);
  }
  strike() {
    const c = this.c, dmg = 40; this.hull -= dmg; this.ev('strike', { dmg });
    const a = brg(this.x - c.x, this.y - c.y); this.h += .5; this.v = -2; this.x += Math.sin(a) * 4; this.y += Math.cos(a) * 4;
    c.st = 'flee'; c.rest = 4; c.t = 0;
    const s = EMPTY_SPOTS.slice().sort((p, q) => Math.hypot(q.x - this.x, q.y - this.y) - Math.hypot(p.x - this.x, p.y - this.y)); { const m = s[s.length - 4]; this.goto(m.x, m.y); }
    if (this.hull <= 0) this.lose('it');
  }
  falseCalls(dt) {
    if (Math.hypot(this.x - HOME.x, this.y - HOME.y) > 110) { this.callT -= dt; if (this.callT <= 0 && this.calls < 6) { this.callT = 24; this.ev('falsecall', { n: this.calls++ }); } }
    if (Math.hypot(this.x - FALSE_HOME.x, this.y - FALSE_HOME.y) < 26) this.lose('false');
  }
  // what the hydrophone gives you with the engine stopped
  listen() {
    const c = this.c; if (!c.on || !this.live) return null;
    const d = Math.hypot(c.x - this.x, c.y - this.y), quiet = this.thr === STOP && Math.abs(this.v) < 1.2;
    if (d > (quiet ? 300 : 50)) return null;
    return { b: brg(c.x - this.x, c.y - this.y), d, s: clamp(1 - d / 300, .05, 1) };
  }
}
