// Horde: the night itself, with no drawing in it, so the page, ?demo, and the balance runs in Node all play the same
// game. A hero with a lantern in a field, the monsters you raise at the edges, the flag they follow, the hero's
// weapons and the gems it walks over to collect. Everything runs on a fixed 60 Hz step from one seeded random stream.
import { NIGHT_LEN, MAX_LEVEL, xpNeed, ESSENCE, MOB_CAP, deep, MOBS, WEAPONS, PASSIVES, BREAD, SLOTS, BODY, HEROES, roster } from './data.js';

export const STEP = 1 / 60;
export const SURGE_LEN = 3, SURGE_EVERY = 8, SURGE_SPD = 1.45, SEE = 1.3;
const TAU = Math.PI * 2;
const WIDS = Object.keys(WEAPONS);
const WIX = Object.fromEntries(WIDS.map((k, i) => [k, i]));
const CELL = 16;
const DIRS = Array.from({ length: 16 }, (_, i) => [Math.cos(i / 16 * TAU), Math.sin(i / 16 * TAU)]);

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// where a tap at (x, y) comes up out of the ground: the nearest point on the arena's rim, a little way in
export function edgePoint(W, H, x, y, inset = 4) {
  const dl = x, dr = W - x, dt = y, db = H - y, m = Math.min(dl, dr, dt, db);
  const cx = Math.max(inset, Math.min(W - inset, x)), cy = Math.max(inset, Math.min(H - inset, y));
  if (m === dl) return { x: inset, y: cy, side: 'l' };
  if (m === dr) return { x: W - inset, y: cy, side: 'r' };
  if (m === dt) return { x: cx, y: inset, side: 't' };
  return { x: cx, y: H - inset, side: 'b' };
}

export function weaponStats(id, lv) {
  const W = WEAPONS[id], s = { ...W.base };
  for (let i = 0; i < lv - 1 && i < W.up.length; i++) for (const [k, v] of Object.entries(W.up[i])) s[k] = (s[k] || 0) + v;
  return s;
}

export class Game {
  constructor({ night = 1, W = 400, H = 280, seed = 1 } = {}) {
    this.night = night; this.H0 = HEROES[night - 1]; this.seed = seed; this.rand = mulberry(seed);
    this.W = W; this.H = H; this.t = 0; this.tick_ = 0;
    this.state = 'play'; this.why = ''; this.endT = 0;
    this.roster = roster(night);
    this.ess = ESSENCE.start;
    this.mobs = []; this.shots = []; this.gems = []; this.puddles = []; this.flasks = []; this.ev = [];
    this.nextId = 1;
    this.flag = { x: W / 2, y: H / 2, hunt: true };
    this.surge = 0; this.surgeAt = -99;
    this.stats = { raised: 0, spent: 0, killed: 0, blood: 0, fed: 0, sunk: 0, peak: 0, picks: [], contact: 0, surges: 0, by: {}, kw: {} };
    const h = this.H0;
    this.hero = {
      x: W / 2, y: H / 2, vx: 0, vy: 0, dx: 1, dy: 0, face: 1, r: 5, mass: BODY.hero,
      hp: h.hp, lv: 1, xp: 0, weapons: [], passives: {}, plist: [], ws: {}, wt: {}, hurtT: 0, wander: null, think: 0,
      gem: null, books: 0, booksOn: 0, booksT: 0, garlicT: 0, lean: 0,
    };
    // a start is a weapon id, or [id, level]; startP are charms it already has
    for (const w of h.start) { const [id, lv] = Array.isArray(w) ? w : [w, 1]; this.hero.weapons.push({ id, lv }); }
    for (const [id, lv] of Object.entries(h.startP || {})) { this.hero.passives[id] = lv; this.hero.plist.push(id); }
    this.recompute(); this.hero.hp = this.hero.maxhp;
    for (const w of this.hero.weapons) this.hero.wt[w.id] = 0.6 + this.rand() * 0.6;
    this.gridAlloc();
  }
  get pending() { return this.ev; }
  drain() { const e = this.ev; this.ev = []; return e; }
  emit(k, o) { this.ev.push({ k, ...o }); }

  resize(W, H) {
    const sx = W / this.W, sy = H / this.H;
    const fit = o => { o.x = Math.max(3, Math.min(W - 3, o.x * sx)); o.y = Math.max(3, Math.min(H - 3, o.y * sy)); };
    this.W = W; this.H = H;
    fit(this.hero); fit(this.flag); for (const m of this.mobs) fit(m); for (const g of this.gems) fit(g); for (const p of this.puddles) fit(p);
    this.gridAlloc();
  }
  gridAlloc() {
    this.gc = Math.ceil(this.W / CELL) + 1; this.gr = Math.ceil(this.H / CELL) + 1;
    this.head = new Int32Array(this.gc * this.gr).fill(-1); this.next = new Int32Array(Math.max(4096, this.mobs.length * 2));
    this.gridN = 0;
  }

  /* ------------------------------------------------------------------------------------------- the hero's numbers */
  recompute() {
    const h = this.hero, b = this.H0, p = k => h.passives[k] || 0;
    const oldMax = h.maxhp || b.hp;
    h.maxhp = b.hp * (1 + 0.2 * p('heart'));
    if (h.maxhp > oldMax) h.hp += h.maxhp - oldMax;
    h.armor = b.armor + p('armor'); h.regen = b.regen + 0.35 * p('regen');
    h.spd = b.spd * (1 + 0.1 * p('wings')); h.might = 1 + 0.1 * p('might'); h.cdMul = 1 - 0.08 * p('tome');
    h.magnet = 20 * (1 + 0.35 * p('magnet')); h.area = 1 + 0.1 * p('candle'); h.amount = p('amount');
    h.light = b.light * (1 + 0.08 * p('candle'));
    // it's dark out: the hero only knows about what's near enough its lantern to see
    h.see = h.light * SEE;
    for (const w of h.weapons) h.ws[w.id] = weaponStats(w.id, w.lv);
  }
  lightR() { return this.hero.light; }

  /* ------------------------------------------------------------------------------------------- your verbs */
  // why a summons can't happen here, or '' if it can
  blocked(type, x, y) {
    const M = MOBS[type];
    if (!M || !this.roster.includes(type)) return 'locked';
    if (this.state !== 'play') return 'over';
    if (this.ess < M.cost) return 'essence';
    if (this.mobs.length + M.n > MOB_CAP) return 'full';
    const h = this.hero;
    if (Math.hypot(x - h.x, y - h.y) < this.lightR() + 6) return 'light';
    return '';
  }
  spawn(type, tapX, tapY) {
    const e = edgePoint(this.W, this.H, tapX, tapY);
    if (this.blocked(type, e.x, e.y)) return null;
    const M = MOBS[type];
    this.ess -= M.cost; this.stats.spent += M.cost;
    const along = e.side === 'l' || e.side === 'r' ? [0, 1] : [1, 0], inward = { l: [1, 0], r: [-1, 0], t: [0, 1], b: [0, -1] }[e.side];
    for (let i = 0; i < M.n; i++) {
      const off = (i - (M.n - 1) / 2) * 5 + (this.rand() - 0.5) * 3, inn = this.rand() * 5;
      const x = Math.max(3, Math.min(this.W - 3, e.x + along[0] * off + inward[0] * inn)), y = Math.max(3, Math.min(this.H - 3, e.y + along[1] * off + inward[1] * inn));
      this.addMob(type, x, y, 0.45 + i * 0.025);
    }
    this.stats.raised += M.n;
    this.emit('spawn', { type, x: e.x, y: e.y, side: e.side, n: M.n });
    return e;
  }
  addMob(type, x, y, rise = 0.45) {
    const M = MOBS[type], D = deep(this.t);
    const m = { id: this.nextId++, type, M, x, y, vx: 0, vy: 0, kx: 0, ky: 0, hp: M.hp * D.hp, max: M.hp * D.hp, dmg: M.dmg * D.dmg, r: M.r, rise, rise0: rise, cd: 0.3, flash: 0,
      ph: this.rand() * TAU, tone: 0.8 + this.rand() * 0.2, face: 1, im: new Float32Array(WIDS.length), dead: false, engaged: false, healT: this.rand() * 0.8, ax: 1, ay: 0 };
    this.mobs.push(m);
    return m;
  }
  setFlag(x, y) {
    const h = this.hero;
    if (Math.hypot(x - h.x, y - h.y) < 18) return this.hunt();
    this.flag.x = Math.max(4, Math.min(this.W - 4, x)); this.flag.y = Math.max(4, Math.min(this.H - 4, y)); this.flag.hunt = false;
    this.emit('flag', { x: this.flag.x, y: this.flag.y });
  }
  // calling the hunt from a planted flag is a charge: for a few seconds the whole horde runs faster than it can
  hunt() {
    const surge = !this.flag.hunt && this.t - this.surgeAt > SURGE_EVERY;
    const fx = this.flag.x, fy = this.flag.y;
    this.flag.hunt = true;
    if (surge) { this.surge = SURGE_LEN; this.surgeAt = this.t; this.stats.surges++; }
    this.emit('hunt', { surge, x: fx, y: fy });
  }

  /* ------------------------------------------------------------------------------------------- the step */
  tick() {
    const dt = STEP;
    this.tick_++;
    if (this.state !== 'play') { this.endT += dt; this.idle(dt); return; }
    this.t += dt;
    this.surge = Math.max(0, this.surge - dt);
    this.ess = Math.min(ESSENCE.cap, this.ess + ESSENCE.rate(this.t) * dt);
    // the dead from last step leave now, so every index below is stable
    this.sweep();
    this.buildGrid();
    this.heroThink(dt);
    this.moveHero(dt);
    this.moveMobs(dt);
    this.buildGrid();
    this.separate();
    this.contact(dt);
    this.weapons(dt);
    this.moveShots(dt);
    this.hags(dt);
    this.updateGems(dt);
    const h = this.hero;
    if (h.regen > 0 && h.hp > 0) h.hp = Math.min(h.maxhp, h.hp + h.regen * dt);
    h.hurtT = Math.max(0, h.hurtT - dt);
    let alive = 0; for (const m of this.mobs) if (!m.dead) alive++;
    if (alive > this.stats.peak) this.stats.peak = alive;
    if (h.hp <= 0) this.end('won', 'slain');
    else if (this.t >= NIGHT_LEN) this.end('lost', 'dawn');
  }
  end(state, why) {
    if (this.state !== 'play') return;
    this.state = state; this.why = why; this.endT = 0;
    if (state === 'won') this.hero.hp = 0;
    this.emit(state === 'won' ? 'win' : 'lose', { why });
  }
  // after the end: the horde mills about, or burns away in the dawn
  idle(dt) {
    for (const m of this.mobs) {
      if (m.dead) continue;
      m.flash = Math.max(0, m.flash - dt); m.rise = Math.max(0, m.rise - dt);
      // dawn: the sun finds them one by one and they crumble
      if (this.state === 'lost' && this.why === 'dawn') { if (this.endT > 0.5 && this.rand() < dt * 1.4) { m.dead = true; this.emit('ash', { x: m.x, y: m.y, type: m.type }); } continue; }
      const h = this.hero, dx = h.x - m.x, dy = h.y - m.y, d = Math.hypot(dx, dy) || 1;
      if (this.state === 'won') { // they close in on the fallen lantern
        const want = d > 16 + m.r * 2 ? 0.5 : 0;
        m.vx += (dx / d * m.M.spd * want - m.vx) * 0.1; m.vy += (dy / d * m.M.spd * want - m.vy) * 0.1;
        if (Math.abs(m.vx) > 1) m.face = Math.sign(m.vx);
      } else { m.vx += (-dx / d * m.M.spd - m.vx) * 0.1; m.vy += (-dy / d * m.M.spd - m.vy) * 0.1; }
      m.x += m.vx * dt; m.y += m.vy * dt;
    }
    this.buildGrid(); this.separate();
    for (const g of this.gems) g.t += dt;
  }

  sweep() {
    let j = 0; const a = this.mobs;
    for (let i = 0; i < a.length; i++) if (!a[i].dead) a[j++] = a[i];
    a.length = j;
    if (this.next.length < a.length) this.next = new Int32Array(a.length * 2);
  }
  buildGrid() {
    const head = this.head, next = this.next, gc = this.gc, gr = this.gr;
    head.fill(-1);
    const a = this.mobs;
    for (let i = 0; i < a.length; i++) {
      const m = a[i]; if (m.dead) continue;
      const cx = Math.max(0, Math.min(gc - 1, (m.x / CELL) | 0)), cy = Math.max(0, Math.min(gr - 1, (m.y / CELL) | 0)), c = cy * gc + cx;
      next[i] = head[c]; head[c] = i;
    }
  }
  // calls fn(mob, dx, dy, d²) for live mobs within r of (x, y)
  near(x, y, r, fn) {
    const gc = this.gc, gr = this.gr, a = this.mobs, head = this.head, next = this.next, r2 = r * r;
    const x0 = Math.max(0, ((x - r) / CELL) | 0), x1 = Math.min(gc - 1, ((x + r) / CELL) | 0);
    const y0 = Math.max(0, ((y - r) / CELL) | 0), y1 = Math.min(gr - 1, ((y + r) / CELL) | 0);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      for (let i = head[cy * gc + cx]; i !== -1; i = next[i]) {
        const m = a[i]; if (!m || m.dead) continue;
        const dx = m.x - x, dy = m.y - y, d2 = dx * dx + dy * dy;
        if (d2 <= r2 && fn(m, dx, dy, d2) === false) return;
      }
    }
  }

  /* ------------------------------------------------------------------------------------------- the hero's head */
  // context steering: score sixteen headings for danger (monsters, walls) and interest (gems, the open middle)
  heroThink(dt) {
    const h = this.hero, B = this.H0;
    if (--h.think > 0) return;
    h.think = 2;
    const dang = new Float32Array(16), want = new Float32Array(16);
    const R = Math.min(110, h.see), keep = B.keep;
    let close = 0, any = 0;
    this.near(h.x, h.y, R, (m, dx, dy, d2) => {
      const d = Math.sqrt(d2) || 0.01;
      let w = m.M.threat * (1 - d / R) ** 2 * (m.rise > 0.2 ? 0.4 : 1);
      if (d < keep) w *= 1 + 2.5 * (1 - d / keep);
      const ux = dx / d, uy = dy / d;
      for (let i = 0; i < 16; i++) { const c = DIRS[i][0] * ux + DIRS[i][1] * uy; if (c > 0.2) dang[i] += w * (c - 0.2) * 1.25; }
      if (d < 52) close += m.M.threat * (1 - d / 52);
      any++;
    });
    const W = this.W, H = this.H, mg = 16;
    for (let i = 0; i < 16; i++) {
      for (const [L, k] of [[22, 0.35], [50, 0.12]]) {
        const px = h.x + DIRS[i][0] * L, py = h.y + DIRS[i][1] * L;
        const out = Math.max(0, mg - px) + Math.max(0, px - (W - mg)) + Math.max(0, mg - py) + Math.max(0, py - (H - mg));
        dang[i] += out * k;
      }
    }
    // gems: the best one nearby, if it's safe enough to fetch
    const safe = 1 / (1 + close * 1.4);
    let best = null, bs = 0;
    for (const g of this.gems) {
      const d = Math.hypot(g.x - h.x, g.y - h.y);
      if (d > 170) continue;
      const s = g.v / (d + 24);
      if (s > bs) { bs = s; best = g; }
    }
    h.gem = best;
    if (best) {
      const dx = best.x - h.x, dy = best.y - h.y, d = Math.hypot(dx, dy) || 1, k = B.greed * safe * 1.1;
      for (let i = 0; i < 16; i++) want[i] += k * (DIRS[i][0] * dx + DIRS[i][1] * dy) / d;
    }
    // drift back toward the open middle, and keep going the way it's going
    const cx = W / 2 - h.x, cy = H / 2 - h.y, cd = Math.hypot(cx, cy) || 1, ck = 0.25 * Math.min(1, cd / (Math.min(W, H) * 0.4));
    for (let i = 0; i < 16; i++) want[i] += ck * (DIRS[i][0] * cx + DIRS[i][1] * cy) / cd + 0.12 * (DIRS[i][0] * h.dx + DIRS[i][1] * h.dy);
    let bi = 0, bv = -1e9;
    for (let i = 0; i < 16; i++) { const v = want[i] - dang[i] + (this.rand() - 0.5) * 0.02; if (v > bv) { bv = v; bi = i; } }
    const calm = !best && close < 0.05;
    if (calm) {
      // nothing to do: amble about the middle
      if (!h.wander || Math.hypot(h.wander.x - h.x, h.wander.y - h.y) < 8 || this.rand() < 0.004) h.wander = { x: W * (0.3 + this.rand() * 0.4), y: H * (0.3 + this.rand() * 0.4) };
      const wx = h.wander.x - h.x, wy = h.wander.y - h.y, wd = Math.hypot(wx, wy) || 1;
      h.tx = wx / wd; h.ty = wy / wd; h.pace = any ? 0.75 : 0.45;
    } else { h.tx = DIRS[bi][0]; h.ty = DIRS[bi][1]; h.pace = 1; }
  }
  moveHero(dt) {
    const h = this.hero;
    const k = Math.min(1, dt * 9);
    h.dx += (h.tx - h.dx) * k; h.dy += (h.ty - h.dy) * k;
    const n = Math.hypot(h.dx, h.dy) || 1; h.dx /= n; h.dy /= n;
    const sp = h.spd * (h.pace ?? 1);
    h.vx = h.dx * sp; h.vy = h.dy * sp;
    h.x += h.vx * dt; h.y += h.vy * dt;
    h.x = Math.max(6, Math.min(this.W - 6, h.x)); h.y = Math.max(8, Math.min(this.H - 5, h.y));
    h.faceT = Math.max(0, (h.faceT || 0) - dt);
    if (Math.abs(h.vx) > 4 && !h.faceT) h.face = Math.sign(h.vx);
    if (this.flag.hunt) { this.flag.x = h.x; this.flag.y = h.y; }
  }

  /* ------------------------------------------------------------------------------------------- the horde */
  moveMobs(dt) {
    const h = this.hero, F = this.flag, W = this.W, H = this.H, t = this.t;
    for (const m of this.mobs) {
      if (m.dead) continue;
      m.flash = Math.max(0, m.flash - dt); m.cd = Math.max(0, m.cd - dt);
      if (m.rise > 0) { m.rise -= dt; continue; }
      const M = m.M;
      const hx = h.x - m.x, hy = h.y - m.y, hd = Math.hypot(hx, hy) || 0.01;
      // engaged: close enough to the hero to forget the flag (and only let go once it's well away)
      if (F.hunt) m.engaged = true;
      else m.engaged = m.engaged ? hd < 72 : hd < 44;
      let tx, ty, arrive = 0;
      if (m.engaged) { tx = h.x; ty = h.y; } else { tx = F.x; ty = F.y; arrive = 14; }
      let dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy) || 0.01;
      let sp = M.spd * (this.surge > 0 ? 1 + (SURGE_SPD - 1) * Math.min(1, this.surge / 1.2) : 1);
      if (m.type === 'hag' && m.engaged) {
        // she keeps her distance, circling
        if (hd < M.keep) { dx = -hx; dy = -hy; d = hd; sp *= 0.8; }
        else if (hd < M.keep + 10) { dx = -hy; dy = hx; d = hd; sp *= 0.35; }
      }
      if (arrive && d < arrive) sp *= d / arrive;
      let ux = dx / d, uy = dy / d;
      if (m.type === 'bat') {
        const wob = Math.sin(t * 7 + m.ph) * 0.8;
        ux += -uy * wob; uy += ux * wob;
        const n = Math.hypot(ux, uy) || 1; ux /= n; uy /= n;
      }
      const k = Math.min(1, dt * (m.type === 'bat' ? 10 : 7));
      m.vx += (ux * sp - m.vx) * k; m.vy += (uy * sp - m.vy) * k;
      m.x += (m.vx + m.kx) * dt; m.y += (m.vy + m.ky) * dt;
      m.kx *= 0.86; m.ky *= 0.86;
      if (Math.abs(m.vx) > 2) m.face = Math.sign(m.vx);
      if (m.type === 'shield') { m.ax = hx / hd; m.ay = hy / hd; m.face = hx >= 0 ? 1 : -1; }
      m.x = Math.max(2, Math.min(W - 2, m.x)); m.y = Math.max(2, Math.min(H - 2, m.y));
    }
  }
  // bodies push apart: each cell against itself and four of its neighbours, so every pair is seen once. This is the
  // hot loop when thousands are out, so it walks the grid by hand
  separate() {
    const a = this.mobs, head = this.head, next = this.next, gc = this.gc, gr = this.gr;
    for (let cy = 0; cy < gr; cy++) for (let cx = 0; cx < gc; cx++) {
      for (let i = head[cy * gc + cx]; i !== -1; i = next[i]) {
        const m = a[i];
        this.pushOff(m, next[i]);
        if (cx + 1 < gc) this.pushOff(m, head[cy * gc + cx + 1]);
        if (cy + 1 < gr) {
          const r = (cy + 1) * gc;
          if (cx > 0) this.pushOff(m, head[r + cx - 1]);
          this.pushOff(m, head[r + cx]);
          if (cx + 1 < gc) this.pushOff(m, head[r + cx + 1]);
        }
      }
    }
  }
  pushOff(m, j) {
    const a = this.next, mobs = this.mobs;
    for (; j !== -1; j = a[j]) {
      const o = mobs[j], dx = o.x - m.x, dy = o.y - m.y, rr = m.r + o.r, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 0.01, over = (rr - d) * 0.5, ux = d2 ? dx / d : 1, uy = d2 ? dy / d : 0;
      // rising monsters are still half in the ground: nothing shoves them
      const mm = m.rise > 0 ? 1e3 : m.M.mass, om = o.rise > 0 ? 1e3 : o.M.mass, s = mm + om;
      m.x -= ux * over * om / s; m.y -= uy * over * om / s;
      o.x += ux * over * mm / s; o.y += uy * over * mm / s;
    }
  }
  contact(dt) {
    const h = this.hero;
    let touching = 0;
    this.near(h.x, h.y, h.r + 9, (m, dx, dy, d2) => {
      if (m.rise > 0) return;
      const rr = m.r + h.r, d = Math.sqrt(d2) || 0.01;
      if (d >= rr + 0.5) return;
      touching++;
      // bodies: the hero shoves the small ones aside, the big ones hold it
      const over = rr - d, ux = dx / d, uy = dy / d, s = m.M.mass + h.mass;
      if (over > 0) { m.x += ux * over * h.mass / s; m.y += uy * over * h.mass / s; h.x -= ux * over * m.M.mass / s; h.y -= uy * over * m.M.mass / s; }
      if (m.type === 'bloat') { this.kill(m, false); return; }
      if (m.cd <= 0 && m.dmg > 0) { m.cd = BODY.cd; this.hurtHero(m.dmg, m); }
    });
    if (touching) this.stats.contact += dt;
    h.x = Math.max(6, Math.min(this.W - 6, h.x)); h.y = Math.max(8, Math.min(this.H - 5, h.y));
  }
  hurtHero(n, src, raw = false) {
    const h = this.hero;
    // armour takes a share off every hit, each point a little less than the one before
    const dmg = raw ? n : n * 4 / (4 + h.armor);
    if (dmg < n && this.rand() < 0.3) this.emit('clang', { x: h.x, y: h.y - 8 });
    h.hp -= dmg; h.hurtT = 0.22;
    const k = src?.type || '?'; this.stats.by[k] = (this.stats.by[k] || 0) + dmg;
    this.stats.blood += dmg;
    this.ess = Math.min(ESSENCE.cap, this.ess + dmg * ESSENCE.bounty);
    this.emit('hurt', { n: dmg, x: h.x, y: h.y - 10, big: dmg >= 8, type: src?.type });
  }
  boom(x, y, M) {
    const h = this.hero, r = M.boomR;
    this.emit('boom', { x, y, r });
    if (Math.hypot(h.x - x, h.y - y) < r + h.r) this.hurtHero(M.boom * deep(this.t).dmg, { type: 'bloat' }, true);
    this.near(x, y, r, (o, dx, dy, d2) => { const d = Math.sqrt(d2) || 1, f = 90 * (1 - d / r) / (0.6 + o.M.mass * 0.4); o.kx += dx / d * f; o.ky += dy / d * f; });
  }
  kill(m, byHero = true) {
    if (m.dead) return;
    m.dead = true; m.hp = 0;
    this.emit('die', { type: m.type, x: m.x, y: m.y, by: byHero, face: m.face });
    if (byHero) { this.stats.killed++; this.dropGem(m.x, m.y, m.M.xp); }
    if (m.type === 'bloat') this.boom(m.x, m.y, m.M);
  }
  // a weapon lands on m: returns false if it slipped by
  hit(m, dmg, kx, ky, wid, proj = false) {
    if (m.dead || m.rise > 0) return false;
    if (proj && m.M.evade && this.rand() < m.M.evade) { this.emit('miss', { x: m.x, y: m.y - 5 }); return false; }
    const h = this.hero, n = Math.max(1, Math.round(dmg * h.might));
    m.hp -= n; m.flash = 0.09;
    const f = 1 / (0.6 + m.M.mass * 0.4);
    m.kx += kx * f; m.ky += ky * f;
    this.emit('dmg', { x: m.x, y: m.y - m.r - 2, n, w: wid });
    if (m.hp <= 0) { this.stats.kw[wid] = (this.stats.kw[wid] || 0) + 1; this.kill(m, true); }
    return true;
  }
  hags(dt) {
    for (const m of this.mobs) {
      if (m.dead || m.type !== 'hag' || m.rise > 0) continue;
      m.healT -= dt;
      if (m.healT > 0) continue;
      m.healT = m.M.healEvery;
      let any = false;
      this.near(m.x, m.y, m.M.healR, o => { if (o !== m && o.hp < o.max && o.rise <= 0) { o.hp = Math.min(o.max, o.hp + m.M.heal); any = true; } });
      if (any) this.emit('mend', { x: m.x, y: m.y, r: m.M.healR });
    }
  }

  /* ------------------------------------------------------------------------------------------- the hero's kit */
  weapons(dt) {
    const h = this.hero;
    for (const w of h.weapons) {
      const s = h.ws[w.id];
      if (w.id === 'books') { this.books(dt, s); continue; }
      if (w.id === 'garlic') { this.garlic(dt, s); continue; }
      h.wt[w.id] = (h.wt[w.id] ?? 0) - dt;
      if (h.wt[w.id] > 0) continue;
      h.wt[w.id] = s.cd * h.cdMul;
      this['fire_' + w.id](s);
    }
  }
  targets(range) { const h = this.hero, out = []; this.near(h.x, h.y, Math.min(range, h.see), m => { if (m.rise <= 0) out.push(m); }); return out; }
  nearest(range) {
    range = Math.min(range, this.hero.see);
    const h = this.hero; let best = null, bd = 1e9;
    this.near(h.x, h.y, range, (m, dx, dy, d2) => { if (m.rise <= 0 && d2 < bd) { bd = d2; best = m; } });
    return best;
  }
  fire_whip(s) {
    const h = this.hero, a = h.area, len = s.len * a, hh = s.h * a;
    // it turns to lash at whatever's closest, even mid-retreat
    const near = this.nearest(len + 12);
    if (near && Math.abs(near.x - h.x) > 1) { h.face = Math.sign(near.x - h.x); h.faceT = 0.35; }
    const sides = s.both ? [h.face, -h.face] : [h.face];
    for (const side of sides) {
      const x0 = side > 0 ? h.x : h.x - len, x1 = side > 0 ? h.x + len : h.x, y0 = h.y - 3 - hh / 2, y1 = h.y - 3 + hh / 2;
      this.near((x0 + x1) / 2, (y0 + y1) / 2, len / 2 + hh, m => {
        if (m.x + m.r < x0 || m.x - m.r > x1 || m.y + m.r < y0 || m.y - m.r > y1) return;
        this.hit(m, s.dmg, side * s.kb, 0, 'whip');
      });
      this.emit('whip', { x: h.x, y: h.y - 3, side, len, h: hh });
    }
  }
  books(dt, s) {
    const h = this.hero;
    h.booksT -= dt;
    if (h.booksT <= 0) {
      h.booksOn = !h.booksOn;
      h.booksT = h.booksOn ? s.on : s.off * h.cdMul;
      if (h.booksOn) this.emit('books', {});
    }
    h.books = (h.books + s.spin * dt) % TAU;
    if (!h.booksOn) return;
    const n = s.n + h.amount, R = s.rad * h.area, t = this.t, wi = WIX.books;
    for (let k = 0; k < n; k++) {
      const a = h.books + k / n * TAU, bx = h.x + Math.cos(a) * R, by = h.y - 3 + Math.sin(a) * R * 0.8;
      this.near(bx, by, 12, (m, dx, dy, d2) => {
        if (m.im[wi] > t || d2 > (m.r + 4) ** 2) return;
        m.im[wi] = t + s.rehit;
        const ox = m.x - h.x, oy = m.y - h.y, od = Math.hypot(ox, oy) || 1;
        this.hit(m, s.dmg, ox / od * s.kb, oy / od * s.kb, 'books');
      });
    }
  }
  garlic(dt, s) {
    const h = this.hero;
    h.garlicT -= dt;
    if (h.garlicT > 0) return;
    h.garlicT = s.tick;
    const R = s.r * h.area;
    this.near(h.x, h.y, R + 8, (m, dx, dy, d2) => {
      const d = Math.sqrt(d2) || 1;
      if (d > R + m.r) return;
      this.hit(m, s.dmg, dx / d * s.kb, dy / d * s.kb, 'garlic');
    });
    this.emit('garlic', { r: R });
  }
  fire_knife(s) {
    const h = this.hero, tgt = this.nearest(s.range);
    let ax = h.face, ay = 0;
    if (tgt) { const dx = tgt.x - h.x, dy = tgt.y - h.y, d = Math.hypot(dx, dy) || 1; ax = dx / d; ay = dy / d; }
    const n = s.n + h.amount, base = Math.atan2(ay, ax);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.16;
      this.shots.push({ k: 'knife', x: h.x, y: h.y - 4, vx: Math.cos(a) * s.spd, vy: Math.sin(a) * s.spd, r: 2, dmg: s.dmg, pierce: s.pierce, kb: s.kb, life: s.range / s.spd, hits: [] });
    }
    this.emit('throw', { w: 'knife' });
  }
  fire_fire(s) {
    const h = this.hero, all = this.targets(s.range);
    if (!all.length) { h.wt.fire = 0.3; return; }
    const n = s.n + h.amount;
    for (let i = 0; i < n; i++) {
      const m = all[(this.rand() * all.length) | 0], dx = m.x - h.x, dy = m.y - h.y, d = Math.hypot(dx, dy) || 1;
      this.shots.push({ k: 'fire', x: h.x, y: h.y - 5, vx: dx / d * s.spd, vy: dy / d * s.spd, r: 3, dmg: s.dmg, aoe: s.aoe * h.area, aoeDmg: s.aoeDmg, pierce: 1, kb: 25, life: 2.2, hits: [] });
    }
    this.emit('throw', { w: 'fire' });
  }
  fire_axe(s) {
    const h = this.hero, n = s.n + h.amount;
    for (let i = 0; i < n; i++) {
      const vx = (this.rand() * 2 - 1) * 55 + (n > 1 ? (i - (n - 1) / 2) * 30 : 0);
      this.shots.push({ k: 'axe', x: h.x, y: h.y - 6, vx, vy: -165 - this.rand() * 25, g: 290, r: 4, dmg: s.dmg, pierce: s.pierce, kb: s.kb, life: 3, hits: [], spin: 0 });
    }
    this.emit('throw', { w: 'axe' });
  }
  fire_water(s) {
    const h = this.hero, all = this.targets(s.range * h.area + 20);
    const n = s.n + h.amount;
    for (let i = 0; i < n; i++) {
      let x, y;
      if (all.length) { const m = all[(this.rand() * all.length) | 0]; x = m.x; y = m.y; }
      else { const a = this.rand() * TAU; x = h.x + Math.cos(a) * 40; y = h.y + Math.sin(a) * 30; }
      this.flasks.push({ x0: h.x, y0: h.y - 6, x, y, t: 0, T: 0.42, s, r: s.r * h.area });
    }
    this.emit('throw', { w: 'water' });
  }
  fire_bolt(s) {
    const h = this.hero, all = this.targets(s.range);
    if (!all.length) { h.wt.bolt = 0.4; return; }
    const n = s.n + h.amount, aoe = s.aoe * h.area;
    for (let i = 0; i < n && all.length; i++) {
      // it prefers a crowd: of a few picked at random, the one with most company
      let best = null, bc = -1;
      for (let k = 0; k < 3; k++) {
        const m = all[(this.rand() * all.length) | 0]; let c = 0;
        this.near(m.x, m.y, aoe + 6, () => { c++; });
        if (c > bc) { bc = c; best = m; }
      }
      const x = best.x, y = best.y;
      this.near(x, y, aoe + 8, (m, dx, dy, d2) => { if (d2 <= (aoe + m.r) ** 2) { const d = Math.sqrt(d2) || 1; this.hit(m, s.dmg, dx / d * 40, dy / d * 40, 'bolt'); } });
      this.emit('bolt', { x, y, r: aoe });
    }
  }
  moveShots(dt) {
    const W = this.W, H = this.H, h = this.hero;
    for (const f of this.flasks) {
      f.t += dt;
      if (f.t >= f.T) {
        f.done = true;
        this.puddles.push({ x: f.x, y: f.y, r: f.r, t: 0, dur: f.s.dur, tick: 0, s: f.s });
        this.emit('splash', { x: f.x, y: f.y, r: f.r });
      }
    }
    this.flasks = this.flasks.filter(f => !f.done);
    for (const p of this.puddles) {
      p.t += dt; p.tick -= dt;
      if (p.tick <= 0) {
        p.tick = p.s.tick;
        this.near(p.x, p.y, p.r + 8, (m, dx, dy, d2) => { if (d2 < (p.r + m.r * 0.5) ** 2) this.hit(m, p.s.dmg, 0, 0, 'water'); });
      }
    }
    this.puddles = this.puddles.filter(p => p.t < p.dur);
    for (const s of this.shots) {
      s.life -= dt;
      if (s.g) s.vy += s.g * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.k === 'axe') s.spin += dt * 14;
      if (s.life <= 0 || s.x < -10 || s.x > W + 10 || s.y < -60 || s.y > H + 10) { s.dead = true; continue; }
      this.near(s.x, s.y, s.r + 13, (m, dx, dy, d2) => {
        if (s.dead || s.hits.includes(m.id) || m.rise > 0) return;
        // a shieldbearer stops anything thrown at it from the hero's side, and covers whoever's behind it
        if (m.type === 'shield') {
          const reach = m.r + 6;
          if (d2 < reach * reach && (-dx) * m.ax + (-dy) * m.ay > -1) {
            s.hits.push(m.id);
            this.emit('block', { x: m.x + m.ax * m.r, y: m.y + m.ay * m.r - 3 });
            if (s.k === 'fire') this.burst(s);
            s.dead = true; return false;
          }
        }
        if (d2 > (m.r + s.r) ** 2) return;
        s.hits.push(m.id);
        const sp = Math.hypot(s.vx, s.vy) || 1;
        const landed = this.hit(m, s.dmg, s.vx / sp * s.kb, s.vy / sp * s.kb, s.k, true);
        if (!landed) return;
        if (s.k === 'fire') { this.burst(s); s.dead = true; return false; }
        if (--s.pierce <= 0) { s.dead = true; return false; }
      });
    }
    this.shots = this.shots.filter(s => !s.dead);
  }
  burst(s) {
    this.emit('fireburst', { x: s.x, y: s.y, r: s.aoe });
    this.near(s.x, s.y, s.aoe + 8, (m, dx, dy, d2) => { if (d2 <= (s.aoe + m.r) ** 2) { const d = Math.sqrt(d2) || 1; this.hit(m, s.aoeDmg, dx / d * 30, dy / d * 30, 'fire'); } });
  }

  /* ------------------------------------------------------------------------------------------- gems and levels */
  dropGem(x, y, v) {
    for (const g of this.gems) if (!g.pull && Math.abs(g.x - x) < 6 && Math.abs(g.y - y) < 6) { g.v += v; return; }
    if (this.gems.length > 260) { let best = this.gems[0], bd = 1e9; for (const g of this.gems) { const d = (g.x - x) ** 2 + (g.y - y) ** 2; if (d < bd && !g.pull) { bd = d; best = g; } } best.v += v; return; }
    this.gems.push({ x, y, v, t: 0, pull: false, sp: 0 });
  }
  updateGems(dt) {
    const h = this.hero;
    for (const g of this.gems) {
      g.t += dt;
      const dx = h.x - g.x, dy = (h.y - 3) - g.y, d = Math.hypot(dx, dy) || 0.01;
      if (!g.pull && d < h.magnet) g.pull = true;
      if (g.pull) {
        g.sp = Math.min(260, g.sp + 600 * dt);
        g.x += dx / d * g.sp * dt; g.y += dy / d * g.sp * dt;
        if (d < 5) { g.done = true; this.gain(g.v); this.emit('gem', { x: g.x, y: g.y, v: g.v }); }
      } else if (g.t > 18) { g.done = true; this.stats.sunk += g.v; this.emit('sink', { x: g.x, y: g.y, v: g.v }); }
    }
    this.gems = this.gems.filter(g => !g.done);
  }
  gain(v) {
    const h = this.hero;
    h.xp += v; this.stats.fed += v;
    while (h.xp >= xpNeed(h.lv) && this.state === 'play') {
      h.xp -= xpNeed(h.lv); h.lv++;
      if (h.lv >= MAX_LEVEL) { h.xp = 0; this.emit('level', { lv: h.lv, opts: [], pick: null }); this.end('lost', 'ascend'); return; }
      this.levelUp();
    }
  }
  // the familiar three cards, and the hero picks: its taste, a little chance, and what it needs right now
  levelUp() {
    const h = this.hero, B = this.H0, R = this.rand;
    const own = new Set(h.weapons.map(w => w.id));
    const cands = [];
    for (const w of h.weapons) if (w.lv < 5) cands.push({ kind: 'w', id: w.id, lv: w.lv + 1, wt: 1.6 });
    for (const [id, lv] of Object.entries(h.passives)) if (lv < PASSIVES[id].max) cands.push({ kind: 'p', id, lv: lv + 1, wt: 1.4 });
    if (h.weapons.length < SLOTS) for (const id of Object.keys(WEAPONS)) if (!own.has(id)) cands.push({ kind: 'w', id, lv: 1, wt: 0.8 });
    if (h.plist.length < SLOTS) for (const id of Object.keys(PASSIVES)) if (!(id in h.passives)) cands.push({ kind: 'p', id, lv: 1, wt: 0.8 });
    const opts = [];
    while (opts.length < 3 && cands.length) {
      let sum = 0; for (const c of cands) sum += c.wt;
      let r = R() * sum, i = 0;
      for (; i < cands.length - 1; i++) { r -= cands[i].wt; if (r <= 0) break; }
      opts.push(cands.splice(i, 1)[0]);
    }
    if (!opts.length) opts.push({ kind: 'b', id: 'bread', lv: 1 });
    const hurt = h.hp / h.maxhp < 0.5;
    let pick = opts[0], pv = -1e9;
    for (const o of opts) {
      let v = (B.prefs[o.id] ?? 0.5) + R() * 1.2 + (o.lv > 1 ? 0.4 : 0);
      if (hurt && (o.id === 'armor' || o.id === 'heart' || o.id === 'regen' || o.id === 'bread')) v += 1.5;
      if (v > pv) { pv = v; pick = o; }
    }
    if (pick.kind === 'w') { const w = h.weapons.find(w => w.id === pick.id); if (w) w.lv++; else { h.weapons.push({ id: pick.id, lv: 1 }); h.wt[pick.id] = 0.4; } }
    else if (pick.kind === 'p') { if (!(pick.id in h.passives)) h.plist.push(pick.id); h.passives[pick.id] = pick.lv; }
    else h.hp = Math.min(h.maxhp, h.hp + 30);
    this.recompute();
    this.stats.picks.push({ lv: h.lv, id: pick.id, plv: pick.lv, t: this.t });
    this.emit('level', { lv: h.lv, opts: opts.map(o => ({ kind: o.kind, id: o.id, lv: o.lv })), pick: { kind: pick.kind, id: pick.id, lv: pick.lv } });
    // the light of a level-up shoves the nearest of the horde back a step
    this.near(h.x, h.y, 34, (m, dx, dy, d2) => { const d = Math.sqrt(d2) || 1; m.kx += dx / d * 80 / (0.6 + m.M.mass * 0.4); m.ky += dy / d * 80 / (0.6 + m.M.mass * 0.4); });
  }

  // a run of `sec` seconds with nobody at the controls (for warming up the demo)
  ff(sec, fn) { const n = Math.round(sec / STEP); for (let i = 0; i < n && this.state === 'play'; i++) { fn?.(this); this.tick(); this.drain(); } }
  alive() { let n = 0; for (const m of this.mobs) if (!m.dead) n++; return n; }
}

export { WIDS, BREAD, MAX_LEVEL };
