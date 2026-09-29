// Burrow: the game itself, with no page. The ground as cells (what each is, whether the worm has shaken it loose,
// and its texture), built a band at a time from the plan as the worm gets near; loose ground and liquids falling
// and flowing; the finds, which fall when nothing holds them up; the worm, steered toward a point, swimming through
// whatever it can shake and falling through the open; its belly, the camp where it sells, its upgrades, and the
// dangers down deep. The page (main.js) draws it and steers it, and the balance runs (balance.mjs) drive it with a
// stand-in player (autoplay.js).
import {
  W, H, GROUND, BAND, BANDS, CORE_X, CORE_Y, CORE_R, MATS, NMAT, STRATA, ITEMS, SLOTS_BY_SIZE, ORE_PER_SLOT,
  UPGRADES, UPGRADE_BY_ID, WORM, TOUGH, HURT, CAMP, BEAM, OUTPOST,
  AIR, WATER, LAVA, GAS, SAND, CRYSTAL, OBSIDIAN, ALLOY, CORE,
} from './rules.js';
import { makePlan, buildBand, baseAt, layerAt, hash2, rng } from './world.js';

export const DIST = 1;                 // flags: shaken by the worm (it shows as its trail)
export const LOOSE = 2;                // …and not settled yet: it falls if nothing's under it, and settles once something is
const BS = 16, BW = W / BS, BH = Math.ceil(H / BS);   // the ground wakes and sleeps in 16×16 blocks
const CELL_DT = 1 / 60;               // loose ground and liquids move this often
export const SIZE_R = [0, 2.6, 4.4, 6.8, 10];          // a find's radius, by size
const PATH = 2048;                    // points of the head's path kept, for the body to follow

// Per-material lookups, for speed.
const SOLID = new Uint8Array(NMAT), TIER = new Int16Array(NMAT), GRAN = new Uint8Array(NMAT), LIQ = new Uint8Array(NMAT),
  SPEED = new Float32Array(NMAT), OREV = new Float32Array(NMAT);
for (const M of MATS) { SOLID[M.id] = M.solid ? 1 : 0; TIER[M.id] = M.tier; GRAN[M.id] = M.granular ? 1 : 0; LIQ[M.id] = M.liquid ? 1 : 0; SPEED[M.id] = M.speed; OREV[M.id] = M.ore; }
export { SOLID, TIER, LIQ, OREV };
const OPEN = m => m === AIR || m === GAS;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const approach = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);
const bandOf = y => clamp(Math.floor(y / BAND), 0, BANDS - 1);

export class Game {
  constructor(seed, save = null) {
    this.seed = (seed >>> 0) || 1;
    this.plan = makePlan(this.seed);
    const N = W * H;
    this.mat = new Uint8Array(N); this.flags = new Uint8Array(N); this.shade = new Uint8Array(N);
    this.built = new Uint8Array(BANDS); this.orig = new Array(BANDS); this.modified = new Uint8Array(BANDS);
    this.ver = new Uint32Array(BANDS);          // bumped whenever a band's cells change, so drawings of it can be redone
    this.pending = {};                          // saved changes to bands not built yet
    this.act = new Uint8Array(BW * BH); this.alive = [];
    this.tick = 0; this.acc = 0; this.t = 0;
    this.R = rng(this.seed ^ 0x51f15e);
    this.events = []; this.fx = []; this.parts = [];
    this.headless = false;
    this.steer = null;                          // where the player is holding, in cells, or null

    /* the finds */
    this.objs = this.plan.items.map(p => ({ id: p.id, kind: p.kind, x: p.x + .5, y: p.y + .5, r: SIZE_R[ITEMS[p.kind].size], st: p.st, set: p.set, n: p.n,
      gone: !!p.skip, rest: false, fresh: true, vy: 0, nagT: 0, hazard: ITEMS[p.kind].hazard || 0, fall: 0 }));
    this.objBand = Array.from({ length: BANDS }, () => []);
    for (const o of this.objs) this.objBand[bandOf(o.y)].push(o);
    this.setLeft = this.plan.sets.map(s => s.n);
    this.setWorth = this.plan.sets.map(() => 0);
    for (const o of this.objs) if (o.set >= 0) this.setWorth[o.set] += ITEMS[o.kind].value;

    /* money, belly, upgrades */
    this.money = 0; this.earned = 0;
    this.up = { vib: 0, belly: 0, muscle: 0, maw: 0, hide: 0 };
    this.hold = {}; this.ore = {}; this.belly = 0; this.holdValue = 0;
    this.found = {};
    this.stats = { trips: 0, faints: 0, eaten: 0, sold: 0, ore: 0, sets: 0, vaults: 0, deepest: 0, layer: 0, upAt: {}, layerAt: [0], bestHaul: 0 };
    this.won = false; this.wonAt = null;
    this.combo = { n: 0, t: -9 };
    this.atCamp = false;
    // the outposts (world.js places them): shut until bought; atPost is the one the worm's in, atShop whether it can
    // sell and buy where it is (the camp, or a bought outpost)
    this.posts = this.plan.outposts.map(o => ({ ...o, bought: false }));
    this.atPost = -1; this.atShop = false;
    this.hp = this.hpMax();

    /* the worm: its body trails back up to the grass along an easy curve, through ground it has just shaken */
    const x0 = W / 2, y0 = this.plan.surf[W / 2] + 18;
    this.worm = { x: x0, y: y0, vx: 0, vy: 0, a: Math.PI / 2, mode: 'dig', m: 0, mf: 1, want: 1, lungeT: 0, hurtT: 99, bonkT: 0, fullT: 0,
      px: new Float32Array(PATH), py: new Float32Array(PATH), pv: new Float32Array(PATH), ph: 0, pn: 0, chomp: 0, grounded: false, trail: false, speed: 0, inAir: 0,
      inGround: 0, jump: false, tuck: 0, tuckA: 0, stuckT: 0, out: 0 };
    this.segX = new Float32Array(256); this.segY = new Float32Array(256); this.segR = new Float32Array(256); this.segN = 0;
    this.ensureBands(0, bandOf(y0) + 3);
    for (let k = 0; k <= 80; k++) {
      const t = k / 80, x = x0 - 44 * (1 - t) ** 1.3, y = this.plan.surf[Math.round(x)] - 2 + (y0 - this.plan.surf[W / 2] + 2) * (1 - (1 - t) ** 2);
      this.pushPath(x, y);
      if (y > this.plan.surf[Math.round(x)] + 1) this.shake(x, y, true);
    }
    this.worm.x = x0; this.worm.y = y0;
    if (save) this.restore(save);
    this.body();
  }

  /* ---------- sizes and stats from the upgrades ---------- */
  level(id) { return this.up[id]; }
  value(id) { return UPGRADE_BY_ID[id].values[this.up[id]]; }
  cost(id) { const u = UPGRADE_BY_ID[id], l = this.up[id]; return l < u.costs.length ? u.costs[l] : null; }
  cap() { return this.value('belly'); }
  hpMax() { return this.value('hide'); }
  levels() { let n = 0; for (const u of UPGRADES) n += this.up[u.id]; return n; }
  girth() { return WORM.girth + WORM.girthPerLevel * this.levels(); }
  headR() { return this.girth() + .8 + this.up.maw * .5; }
  mouthR() { return this.headR() + WORM.maw[this.up.maw]; }
  segCount() { return Math.min(250, Math.round(WORM.segs + WORM.segsPerLevel * this.levels())); }
  topSpeed() { return WORM.speed * this.value('muscle'); }
  depth() { return Math.max(0, Math.round(this.worm.y - GROUND)); }

  /* ---------- the ground ---------- */
  ensureBands(b0, b1) { for (let b = Math.max(0, b0); b <= Math.min(BANDS - 1, b1); b++) if (!this.built[b]) this.build(b); }
  ensureRows(y0, y1) { this.ensureBands(bandOf(y0), bandOf(y1)); }
  build(b) {
    buildBand(this.plan, b, this.mat, this.shade);
    this.orig[b] = this.mat.slice(b * BAND * W, (b + 1) * BAND * W);
    this.built[b] = 1; this.ver[b]++;
    if (this.pending[b]) { this.applyBand(b, this.pending[b]); delete this.pending[b]; }
    // a find that ended up inside alloy or the core could never be reached: ease it up out of it
    for (const o of this.objBand[b]) {
      if (o.gone || o.hazard) continue;
      for (let k = 0; k < 40; k++) { const m = this.cell(o.x, o.y); if (m !== ALLOY && m !== CORE) break; o.y -= 1; }
    }
  }
  // Builds bands in order until `ms` is spent, so the whole world is ready long before the worm gets there.
  buildSome(ms = 6) {
    const t0 = performance.now();
    for (let b = 0; b < BANDS; b++) if (!this.built[b]) { this.build(b); if (performance.now() - t0 > ms) return false; }
    return true;
  }
  allBuilt() { for (let b = 0; b < BANDS; b++) if (!this.built[b]) return false; return true; }
  cell(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (y < 0) return AIR;
    if (x < 0 || x >= W || y >= H || !this.built[y >> 6]) return ALLOY;
    return this.mat[y * W + x];
  }
  solidAt(x, y) { return SOLID[this.cell(x, y)] === 1; }
  touch(i) { const b = (i / W / BAND) | 0; this.ver[b]++; this.modified[b] = 1; }
  wake(bx, by) {
    if (bx < 0 || bx >= BW || by < 0 || by >= BH) return;
    const b = by * BW + bx;
    if (this.act[b] === 0) this.alive.push(b);
    this.act[b] = 5;
  }
  wakeAt(x, y, r = 0) { for (let by = Math.floor((y - r) / BS); by <= Math.floor((y + r) / BS); by++) for (let bx = Math.floor((x - r) / BS); bx <= Math.floor((x + r) / BS); bx++) this.wake(bx, by); }
  airShade(i) { return Math.floor(hash2(i % W >> 1, (i / W | 0) >> 1, 99) * 24); }
  vacate(i) { this.mat[i] = AIR; this.flags[i] = 0; this.shade[i] = this.airShade(i); }
  move(i, j) {
    const { mat, flags, shade } = this;
    if (mat[j] === GAS) { mat[j] = mat[i]; flags[j] = flags[i]; shade[j] = shade[i]; mat[i] = GAS; flags[i] = 0; }
    else { mat[j] = mat[i]; flags[j] = flags[i]; shade[j] = shade[i]; this.vacate(i); }
  }
  swap(i, j) {
    const { mat, flags, shade } = this;
    const m = mat[i], f = flags[i], s = shade[i];
    mat[i] = mat[j]; flags[i] = flags[j]; shade[i] = shade[j]; mat[j] = m; flags[j] = f; shade[j] = s;
  }

  // Loose ground falls and slides, water falls and spreads, lava creeps; only in blocks that have been woken.
  tickCells() {
    this.tick++;
    const list = this.alive;
    this.alive = [];
    list.sort((a, b) => b - a);            // lowest blocks first, so a falling cell moves once a tick
    for (const b of list) {
      if (this.act[b] === 0) continue;
      const bx = b % BW, by = (b / BW) | 0;
      if (!this.built[(by * BS) >> 6]) { this.act[b] = 0; continue; }
      if (this.updateBlock(bx, by)) {
        this.act[b] = 5;
        this.wake(bx - 1, by); this.wake(bx + 1, by); this.wake(bx, by + 1); this.wake(bx, by - 1); this.wake(bx - 1, by + 1); this.wake(bx + 1, by + 1);
      } else this.act[b]--;
      if (this.act[b] > 0) this.alive.push(b);
    }
  }
  updateBlock(bx, by) {
    const { mat, flags } = this, R = this.R;
    let moved = false;
    const x0 = bx * BS, y0 = by * BS, ltr = (this.tick & 1) === 0;
    for (let y = Math.min(H - 2, y0 + BS - 1); y >= y0; y--) {
      for (let q = 0; q < BS; q++) {
        const x = ltr ? x0 + q : x0 + BS - 1 - q, i = y * W + x, m = mat[i];
        if (m === AIR || m === GAS) continue;
        const below = i + W, mb = mat[below];
        if (SOLID[m]) {
          if (!(flags[i] & LOOSE) && !GRAN[m]) continue;
          if (OPEN(mb)) { this.move(i, below); this.touch(i); this.touch(below); moved = true; continue; }
          if (LIQ[mb]) { if (R() < .45) { this.swap(i, below); this.touch(i); moved = true; } continue; }
          const slide = GRAN[m] ? (m === SAND ? .9 : .6) : .45;
          if (R() < slide) {
            const d = R() < .5 ? -1 : 1, nx = x + d;
            if (nx >= 0 && nx < W && OPEN(mat[i + d]) && OPEN(mat[below + d])) { this.move(i, below + d); this.touch(i); moved = true; continue; }
          }
          // come to rest: shaken ground stays where it settles
          if (flags[i] & LOOSE && !(OPEN(mat[i + (x > 0 ? -1 : 0)]) && OPEN(mat[below + (x > 0 ? -1 : 0)])) && !(OPEN(mat[i + (x < W - 1 ? 1 : 0)]) && OPEN(mat[below + (x < W - 1 ? 1 : 0)]))) flags[i] &= ~LOOSE;
          continue;
        }
        if (m === WATER || m === LAVA) {
          if (m === LAVA) {
            // lava meeting water turns to obsidian; meeting firedamp, it lights it
            for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
              if (j < 0 || j >= mat.length) continue;
              if (mat[j] === WATER) { mat[i] = OBSIDIAN; flags[i] = 0; this.vacate(j); this.touch(i); this.fxAt('steam', x, y); moved = true; break; }
              if (mat[j] === GAS) { this.ignite(j); moved = true; break; }
            }
            if (mat[i] !== LAVA) continue;
            if ((this.tick + x) % 3) continue;          // lava is slow
          }
          if (OPEN(mb)) { this.move(i, below); this.touch(i); moved = true; continue; }
          const d = R() < .5 ? -1 : 1;
          if (x + d >= 0 && x + d < W && OPEN(mat[below + d])) { this.move(i, below + d); this.touch(i); moved = true; continue; }
          // spread sideways, a few cells at a time
          let j = i, steps = m === WATER ? 3 : 1;
          for (let s = 1; s <= steps; s++) { const nx = x + d * s; if (nx < 0 || nx >= W || !OPEN(mat[y * W + nx])) break; j = y * W + nx; if (OPEN(mat[j + W])) break; }
          if (j !== i) { this.move(i, j); this.touch(i); moved = true; if (d > 0 === ltr) q += Math.abs(j - i); }
        }
      }
    }
    return moved;
  }

  /* ---------- the worm ---------- */
  pushPath(x, y) {
    const w = this.worm;
    if (w.pn) { const k = (w.ph - 1 + PATH) % PATH; if ((w.px[k] - x) ** 2 + (w.py[k] - y) ** 2 < .25) return; }
    w.px[w.ph] = x; w.py[w.ph] = y; w.pv[w.ph] = 0; w.ph = (w.ph + 1) % PATH; w.pn = Math.min(PATH, w.pn + 1);
  }
  resetPath(x, y, dx, dy) {
    const w = this.worm;
    w.pn = 0; w.ph = 0;
    for (let k = 400; k >= 0; k--) this.pushPath(x + dx * k * .5, y + dy * k * .5);
  }
  // The body out of the ground falls. Each point of the path it lies along that's in the open (not in the ground, or
  // in water or lava) drops until the body there rests on something, so a worm that's come up and stopped lies along
  // the ground, and one that's dropped into a cave hangs from the hole it came in by. Not while it's in the air on a
  // leap, nor while it's pulling itself back in after one (tuck): then the body keeps to the arc it flew along.
  // Counts the points out in the open, too (w.out), for the tuck. Points a way past the tail fall as well: when an
  // arc falls the path gets shorter, and the tail slides back along it onto them.
  sag(dt) {
    const w = this.worm, len = this.segCount() * WORM.spacing, r0 = this.girth() * .8, g = WORM.gravity;
    const holds = m => SOLID[m] || LIQ[m], free = !w.jump && !(w.tuck > 0);
    let k = (w.ph - 1 + PATH) % PATH, left = w.pn, s = 0, lx = w.x, ly = w.y, out = 0;
    for (; left > 0 && s < len + 80; left--, k = (k - 1 + PATH) % PATH) {
      const x = w.px[k], y = w.py[k];
      s += Math.hypot(x - lx, y - ly); lx = x; ly = y;
      if (holds(this.cell(x, y))) { w.pv[k] = 0; continue; }
      if (s < len) out++;
      if (!free || s < 3) continue;                     // (right behind the head, it's the head's to move)
      // how far down the body's underside is from the path here (a little into what it lies on), thinner to the tail
      const u = Math.min(1, s / len), under = r0 * (u < .6 ? 1 : 1 - (u - .6) / .4 * .62);
      if (holds(this.cell(x, y + under))) { w.pv[k] = 0; continue; }
      let v = Math.min(w.pv[k] + g * dt, WORM.maxFall), ny = y + v * dt;
      for (let c = Math.floor(y + under) + 1; c <= Math.floor(ny + under); c++) if (holds(this.cell(x, c))) { ny = c - under; v = 0; break; }
      w.py[k] = ny; w.pv[k] = v; ly = ny;
    }
    w.out = out;
  }
  // The body: segments spaced along the path the head has taken, fattest behind the head, tapering to the tail.
  body() {
    const w = this.worm, n = this.segCount(), sp = WORM.spacing, r0 = this.girth();
    let px = w.x, py = w.y, k = (w.ph - 1 + PATH) % PATH, left = w.pn, need = 0, seg = 0, lx = 0, ly = 1;
    this.segX[0] = px; this.segY[0] = py; seg = 1; need = sp;
    while (seg < n) {
      if (left <= 0) {   // ran out of path: carry on straight
        this.segX[seg] = this.segX[seg - 1] + lx * sp; this.segY[seg] = this.segY[seg - 1] + ly * sp; seg++; continue;
      }
      const qx = w.px[k], qy = w.py[k], d = Math.hypot(qx - px, qy - py);
      if (d >= need && d > 0) {
        const t = need / d;
        px += (qx - px) * t; py += (qy - py) * t;
        lx = (px - this.segX[seg - 1]) / sp; ly = (py - this.segY[seg - 1]) / sp;
        this.segX[seg] = px; this.segY[seg] = py; seg++; need = sp;
      } else { need -= d; px = qx; py = qy; k = (k - 1 + PATH) % PATH; left--; }
    }
    for (let s = 0; s < n; s++) {
      const u = s / (n - 1);
      this.segR[s] = r0 * (u < .08 ? 1.08 : u < .6 ? 1 : 1 - (u - .6) / .4 * .62);
    }
    this.segR[0] = this.headR();
    this.segN = n;
  }

  moveWorm(dt) {
    const w = this.worm, vib = this.up.vib, base = this.topSpeed(), r = this.headR(), x0 = w.x, y0 = w.y;
    w.lungeT -= dt; w.bonkT -= dt; w.hurtT += dt; w.chomp = Math.max(0, w.chomp - dt * 3);
    // where the player wants to go
    let wx = 0, wy = 0, has = false, far = 0;
    const s = this.steer;
    if (s) { const dx = s.x - w.x, dy = s.y - w.y, d = Math.hypot(dx, dy); if (d > 1.5) { wx = dx / d; wy = dy / d; has = true; far = d; w.want = clamp(d / 28, .28, 1); } }
    const i0 = Math.floor(w.y) * W + Math.floor(w.x), m0 = this.cell(w.x, w.y);
    w.m = m0;
    const mode = SOLID[m0] ? 'dig' : m0 === WATER ? 'water' : m0 === LAVA ? 'lava' : 'air';
    w.mode = mode;
    if (mode !== 'dig') w.tuck = 0;
    // pulling its body back in after diving back into the ground, with no one steering: on the way it dived in
    if (!has && w.tuck > 0) { wx = Math.cos(w.tuckA); wy = Math.sin(w.tuckA); has = true; far = 60; w.want = .7; }
    if (has && mode !== 'air') [wx, wy] = this.detour(wx, wy, far);
    w.grounded = false;
    if (mode === 'dig') {
      w.inAir = 0; w.inGround += dt; w.jump = false;
      const dist = (this.flags[i0] & DIST) !== 0;
      w.trail = dist;
      const mf = TIER[m0] > 90 ? .3 : SPEED[m0] * (dist ? WORM.trail : 1) * (1 + WORM.deepBonus * Math.max(0, vib - TIER[m0]));
      w.mf += (mf - w.mf) * Math.min(1, dt * 10);
      const vmax = base * w.mf;
      let sp = Math.hypot(w.vx, w.vy), a = sp > 2 ? Math.atan2(w.vy, w.vx) : w.a;
      if (sp > vmax * 1.25) sp = approach(sp, vmax, 10 * base * dt);     // a dive from the open soon slows in the ground
      sp = Math.min(sp, Math.max(vmax * 2.5, 340));                   // (and never runs away)
      if (has) {
        let da = Math.atan2(wy, wx) - a;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        // turns as tightly at any top speed: a circle about 13 cells across at full tilt, tighter when slower
        const turn = Math.max(5, vmax / 13) + 6 * (1 - clamp(sp / vmax, 0, 1));
        a += clamp(da, -turn * dt, turn * dt);
        const al = Math.cos(da), goal = vmax * w.want * (al > 0 ? .5 + .5 * al : .4);
        sp = approach(sp, goal, (goal > sp ? WORM.accel : WORM.brake) * base * dt);
      } else sp = approach(sp, 0, WORM.brake * base * dt);
      w.a = a; w.vx = Math.cos(a) * sp; w.vy = Math.sin(a) * sp;
    } else if (mode === 'water' || mode === 'lava') {
      w.inAir = 0; w.inGround = 0; w.jump = false;
      const vmax = base * (mode === 'water' ? WORM.water : WORM.lava);
      const tx = has ? wx * vmax * w.want : 0, ty = has ? wy * vmax * w.want : 26;
      const k = Math.min(1, dt * 3);
      w.vx += (tx - w.vx) * k; w.vy += (ty - w.vy) * k;
      if (mode === 'lava') this.hurt(HURT.lava * dt, 'lava');
    } else {
      w.inAir += dt; w.inGround = 0;
      w.vy = Math.min(w.vy + WORM.gravity * dt, WORM.maxFall);
      if (has) { w.vx += wx * WORM.airControl * dt; w.vy += wy * WORM.airControl * .5 * dt; }
      w.vx *= 1 - .2 * dt;
      w.grounded = w.vy >= -5 && (this.solidAt(w.x, w.y + r * .5 + 1.2) || this.solidAt(w.x - r * .5, w.y + r * .5 + 1) || this.solidAt(w.x + r * .5, w.y + r * .5 + 1));
      if (w.grounded) {
        w.jump = false;
        // on a floor in the open: slide along it toward the pointer, or leap at it
        if (has && wy < -.45 && w.lungeT <= 0) {
          // only as hard as the room that way calls for: a hop in a pocket, a big leap in a cave or at the sky
          const room = this.openAhead(w.x, w.y, wx, wy, 60), v = clamp(Math.sqrt(2 * WORM.gravity * (room + 4)) * 1.1, 70, Math.max(170, base * 1.7));
          w.vx = wx * v; w.vy = wy * v; w.lungeT = .7; w.jump = room > 20;
          this.event('lunge', { x: w.x, y: w.y });
        } else w.vx = approach(w.vx, has ? wx * base * WORM.crawl : 0, base * 5 * dt);
      }
    }
    // grown a little (an upgrade) against rock it can't shake: ease out of it
    const rc0 = this.collR();
    for (let k = 0; k < 4 && this.hardNear(w.x, w.y, rc0); k++) { const n = this.awayFromHard(w.x, w.y, rc0 + 1.2); w.x += n[0] * .3; w.y += n[1] * .3; }
    // move, a little at a time, digging in, bumping off rock too hard to shake, and breaking out into the open
    const speed = Math.hypot(w.vx, w.vy);
    w.speed = speed;
    const steps = Math.max(1, Math.ceil(speed * dt / .6));
    let ore = 0;
    for (let k = 0; k < steps; k++) {
      const vx = w.vx, vy = w.vy, sp = Math.hypot(vx, vy);
      if (sp < .01) break;
      const ux = vx / sp, uy = vy / sp;
      let nx = w.x + vx * dt / steps, ny = w.y + vy * dt / steps;
      const lo = this.girth() + .5;
      if (nx < lo) { nx = lo; w.vx = Math.abs(w.vx) * .2; }
      if (nx > W - lo) { nx = W - lo; w.vx = -Math.abs(w.vx) * .2; }
      if (ny < 3) { ny = 3; w.vy = Math.abs(w.vy) * .2; }
      // rock it can't shake: the head is a little circle that can't overlap any of it; it keeps the part of its speed
      // that runs along the rock, so it glides round boulders, and stops only when wedged
      const rc = this.collR();
      if (this.hardNear(nx, ny, rc) && !(this.hardNear(w.x, w.y, rc) && this.awayOK(nx, ny, rc))) {
        // try turning the move a little at a time, and slow by how far it turned: first toward where it's being
        // steered, if that's off to one side (else the side it's going round by, else the way the rock slopes)
        const n = this.awayFromHard(nx, ny, rc + 1.2);
        this.bonk(nx - n[0] * rc, ny - n[1] * rc, mode);
        const cr = has ? ux * wy - uy * wx : 0, step = sp * dt / steps, look = Math.max(step, .8);
        const first = Math.abs(cr) > .08 ? Math.sign(cr) : w.side || ((ux * n[1] - uy * n[0]) > 0 ? -1 : 1);
        let ok = false;
        for (let k = 1; k <= 3 && !ok; k++) for (const sg of [first, -first]) {
          const an = Math.atan2(uy, ux) + sg * k * .44, cx = Math.cos(an), cy = Math.sin(an);
          if (this.hardNear(w.x + cx * look, w.y + cy * look, rc)) continue;
          const tx = w.x + cx * step, ty = w.y + cy * step;
          const keep = Math.max(.35, Math.cos(k * .44));
          w.vx = cx * sp * keep; w.vy = cy * sp * keep;
          if (mode === 'dig') w.a = an;
          nx = tx; ny = ty; ok = true; break;
        }
        if (!ok) { w.vx *= .4; w.vy *= .4; continue; }
      }
      const probe = this.cell(nx + ux * r * .5, ny + uy * r * .5), here = this.cell(w.x, w.y), there = this.cell(nx, ny);
      // ground it could shake, met from the open: it lands on it, unless steering into it (or falling hard)
      const intent = has && ux * wx + uy * wy > .2;
      if (!SOLID[here] && SOLID[probe] && TIER[probe] <= vib && !intent && sp < 260) { this.land(nx + ux * r * .5, ny + uy * r * .5, mode); continue; }
      // leaving the ground for the open, or diving back in
      if (LIQ[there] && !LIQ[here]) this.intoLiquid(nx, ny, there, SOLID[here]);
      else if (SOLID[here] && !SOLID[there]) this.breach(nx, ny, there);
      else if (!SOLID[here] && SOLID[there]) this.plunge(nx, ny, here);
      w.x = nx; w.y = ny;
      this.pushPath(nx, ny);
      ore += this.shake(nx, ny);
    }
    if (ore) this.event('ore', { x: w.x, y: w.y, n: ore, m: this.lastOre });
    // pulling its body back in: done when it's all in, or if it's stuck
    if (w.tuck > 0) {
      w.tuck -= dt;
      w.stuckT = Math.hypot(w.x - x0, w.y - y0) < 4 * dt ? w.stuckT + dt : 0;
      if (w.out === 0 || w.stuckT > .35) w.tuck = 0;
    }
    // things in reach of the mouth
    this.eat();
    // the vibration shakes loose anything granular nearby
    if ((this.tick % 12) === 0) this.wakeAt(w.x, w.y, 10 + 4 * vib);
    if (w.hurtT > WORM.regenDelay && this.hp < this.hpMax()) this.hp = Math.min(this.hpMax(), this.hp + this.hpMax() * WORM.regen * dt);
  }
  // Feeling ahead: rock it can't shake close in front (a pebble, a boulder, the corner of a wall), and the way it
  // wants to go bends round it, by the smallest turn either side that gives a clear run (keeping to the side it
  // picked while the rock's still there), rather than nosing in and sticking. Straight on if nothing's clear within
  // 75°, so a wall still stops it, and when what it's steering at is in the rock itself.
  detour(wx, wy, far) {
    const w = this.worm, rc = this.collR(), sp = Math.hypot(w.vx, w.vy);
    const L = Math.min(far, clamp(4 + rc + sp * .12, 6, 14));
    const clear = (dx, dy) => { for (let t = 1; t <= L; t += .9) if (this.hardNear(w.x + dx * t, w.y + dy * t, rc)) return false; return true; };
    if (clear(wx, wy)) { w.side = 0; return [wx, wy]; }
    if (far < L + rc + 2 && this.hardNear(w.x + wx * far, w.y + wy * far, rc)) return [wx, wy];
    const a0 = Math.atan2(wy, wx);
    let side = w.side;
    if (!side) side = Math.sin(Math.atan2(w.vy, w.vx) - a0) < 0 ? -1 : 1;      // the way it's already heading
    for (let k = 1; k <= 5; k++) for (const sg of [side, -side]) {
      const a = a0 + sg * k * .2618, dx = Math.cos(a), dy = Math.sin(a);
      if (clear(dx, dy)) { w.side = sg; return [dx, dy]; }
    }
    w.side = 0;
    return [wx, wy];
  }
  // The head's radius for bumping into rock it can't shake.
  collR() { return Math.max(1.6, this.girth() * .5); }
  hardAt(x, y) { const m = this.cell(x, y); return SOLID[m] && TIER[m] > this.up.vib; }
  hardNear(x, y, r) {
    for (let cy = Math.floor(y - r); cy <= Math.floor(y + r); cy++) for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++) {
      const dx = Math.max(cx - x, 0, x - cx - 1), dy = Math.max(cy - y, 0, y - cy - 1);     // nearest point of the cell
      if (dx * dx + dy * dy < r * r && this.hardAt(cx + .5, cy + .5)) return true;
    }
    return false;
  }
  // Which way is away from the rock round a point: the sum of the pushes from each hard cell nearby.
  awayFromHard(x, y, r) {
    let ax = 0, ay = 0;
    for (let cy = Math.floor(y - r); cy <= Math.floor(y + r); cy++) for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++) {
      if (!this.hardAt(cx + .5, cy + .5)) continue;
      const dx = x - (cx + .5), dy = y - (cy + .5), d = Math.hypot(dx, dy) || .01;
      if (d > r + .8) continue;
      ax += dx / d * (r + 1 - d); ay += dy / d * (r + 1 - d);
    }
    const l = Math.hypot(ax, ay);
    if (l < 1e-6) { const w = this.worm, v = Math.hypot(w.vx, w.vy) || 1; return [-w.vx / v, -w.vy / v]; }
    return [ax / l, ay / l];
  }
  // Already overlapping rock (it can happen: lava meeting water makes obsidian): any move away from it is allowed.
  awayOK(nx, ny, rc) { const w = this.worm, n = this.awayFromHard(w.x, w.y, rc + 1.2); return (nx - w.x) * n[0] + (ny - w.y) * n[1] > 0; }
  bonk(x, y, mode) {
    const w = this.worm;
    if (w.bonkT > 0) return;
    // the rock it actually hit (the nearest hard cell to where it bumped)
    let m = this.cell(x, y), best = 9;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const q = this.cell(x + dx, y + dy), d = dx * dx + dy * dy; if (SOLID[q] && TIER[q] > this.up.vib && d < best) { best = d; m = q; } }
    w.bonkT = .7;
    this.event('hard', { x, y, m, need: TIER[m] });
    if (m === CRYSTAL) this.hurt(HURT.crystal, 'crystal');
  }
  // Came down on ground it could dig into, without meaning to: it lands, losing the speed going into it.
  land(cx, cy, mode) {
    const w = this.worm;
    let nx = 0, ny = 0;
    const ra = this.headR() * .5 + 1.5;
    for (let a = 0; a < 16; a++) { const dx = Math.cos(a * Math.PI / 8), dy = Math.sin(a * Math.PI / 8); if (this.solidAt(w.x + dx * ra, w.y + dy * ra)) { nx -= dx; ny -= dy; } }
    if (Math.hypot(nx, ny) < .01) { nx = -w.vx; ny = -w.vy; }
    const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
    const vn = w.vx * nx + w.vy * ny;
    if (-vn > 150) this.event('land', { x: w.x, y: w.y, v: -vn });
    if (vn < 0) { w.vx -= vn * nx; w.vy -= vn * ny; }
    w.vx *= .9;
  }
  // How far the open (air or gas) goes from x, y along ux, uy, up to max cells (0: ground in the very next cell).
  openAhead(x, y, ux, uy, max) {
    for (let d = 1; d <= max; d++) { const m = this.cell(x + ux * d, y + uy * d); if (SOLID[m] || LIQ[m]) return d - 1; }
    return max;
  }
  // Out of the ground into the open. Only out of the ground proper: not in and out of a pocket a moment after coming
  // in, and not through a crack, or a gap in broken ground with more ground just beyond (its own churned-up trail,
  // say): each would speed it up again, and spray out more pockets. Bursting out into real room at speed (the sky,
  // a big cave) is a leap, with a kick the more room there is.
  breach(x, y, into) {
    const w = this.worm, sp = Math.hypot(w.vx, w.vy);
    if (w.inGround < .12 || sp < 1) return;
    const room = this.openAhead(x, y, w.vx / sp, w.vy / sp, 48);
    if (room < 6) return;
    if (sp > this.topSpeed() * .55 && room >= 16) {
      const kick = 1 + .2 * clamp((room - 16) / 28, 0, 1);
      w.vx *= kick; w.vy *= kick; w.jump = true;
    }
    // a spray of the ground it came out of
    const n = Math.min(14, Math.round(sp / 11));
    const r = this.girth();
    let made = 0;
    for (let t = 0; t < 60 && made < n; t++) {
      const a = this.R() * Math.PI * 2, d = this.R() * r, cx = Math.floor(x - w.vx / sp * r * .6 + Math.cos(a) * d), cy = Math.floor(y - w.vy / sp * r * .6 + Math.sin(a) * d);
      if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;
      const i = cy * W + cx, m = this.mat[i];
      if (!SOLID[m] || TIER[m] > this.up.vib || OREV[m]) continue;
      this.parts.push({ x: cx + .5, y: cy + .5, vx: w.vx * (.3 + this.R() * .45) + (this.R() - .5) * 60, vy: w.vy * (.3 + this.R() * .45) + (this.R() - .5) * 60 - 20, m, s: this.shade[i], t: 0 });
      this.vacate(i); this.touch(i); made++;
    }
    this.wakeAt(x, y, r + 4);
    this.event('breach', { x, y, v: sp, into });
  }
  plunge(x, y, from) {
    const w = this.worm, sp = Math.hypot(w.vx, w.vy), r = this.girth();
    if (w.inAir < .12) return;                        // (just back in through a pocket, as for breach)
    const n = Math.min(9, Math.round(sp / 18));
    let made = 0;
    for (let t = 0; t < 40 && made < n; t++) {
      const a = this.R() * Math.PI * 2, d = this.R() * r * 1.2, cx = Math.floor(x + Math.cos(a) * d), cy = Math.floor(y + Math.sin(a) * d);
      if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;
      const i = cy * W + cx, m = this.mat[i];
      if (!SOLID[m] || TIER[m] > this.up.vib || OREV[m]) continue;
      if (OPEN(this.mat[i - W]) || OPEN(this.mat[i - 1]) || OPEN(this.mat[i + 1])) {
        this.parts.push({ x: cx + .5, y: cy - .5, vx: -w.vx * .2 + (this.R() - .5) * 70, vy: -Math.abs(w.vy) * .3 - 30 - this.R() * 50, m, s: this.shade[i], t: 0 });
        this.vacate(i); this.touch(i); made++;
      }
    }
    if (from === AIR || from === GAS) { w.vx *= .8; w.vy *= .8; }
    // back in the ground with some of its body still out: it keeps going till that's in too
    w.jump = false;
    if (w.out > 0) { w.tuck = 4; w.stuckT = 0; w.tuckA = Math.atan2(w.vy, w.vx); }
    this.wakeAt(x, y, r + 4);
    this.event('plunge', { x, y, v: sp });
  }
  // Into water or lava: a splash from the open, and either way it's soon down to swimming pace.
  intoLiquid(x, y, m, fromGround) {
    const w = this.worm, sp = Math.hypot(w.vx, w.vy), lim = this.topSpeed() * (m === WATER ? WORM.water : WORM.lava) * 1.5;
    w.jump = false;
    if (!fromGround || sp > 60) this.event('splash', { x, y, m, v: sp });
    if (sp > lim) { w.vx *= lim / sp; w.vy *= lim / sp; }
  }
  // Shake the ground the head is in: it stays, but loose, and shows as the trail. Ores in reach are eaten.
  shake(x, y, quiet = false) {
    const { mat, flags } = this, r = this.girth(), mr = this.mouthR(), vib = this.up.vib;
    let changed = false, ore = 0;
    const R2 = r * r, M2 = mr * mr;
    for (let cy = Math.floor(y - mr); cy <= Math.ceil(y + mr); cy++) {
      if (cy < 0 || cy >= H || !this.built[cy >> 6]) continue;
      for (let cx = Math.floor(x - mr); cx <= Math.ceil(x + mr); cx++) {
        if (cx < 0 || cx >= W) continue;
        const d2 = (cx + .5 - x) ** 2 + (cy + .5 - y) ** 2;
        if (d2 > M2) continue;
        const i = cy * W + cx, m = mat[i];
        if (!SOLID[m]) { if (m === GAS && d2 <= R2 && !quiet) this.ignite(i); continue; }
        if (TIER[m] > vib) continue;
        if (OREV[m] && !quiet) { if (this.eatOre(i, cx, cy, m)) { ore++; changed = true; } }
        if (d2 <= R2 && (flags[i] & (DIST | LOOSE)) !== (DIST | LOOSE)) { flags[i] |= DIST | LOOSE; changed = true; this.touch(i); }
      }
    }
    if (changed) this.wakeAt(x, y, r + 2);
    return ore;
  }
  eatOre(i, x, y, m) {
    const slot = 1 / ORE_PER_SLOT;
    if (this.belly + slot > this.cap() + 1e-6) { this.nagFull(x, y); return false; }
    this.belly += slot;
    this.ore[m] = (this.ore[m] || 0) + 1;
    this.holdValue += OREV[m];
    this.mat[i] = baseAt(this.plan, x, y); this.flags[i] |= DIST | LOOSE; this.touch(i);
    this.stats.ore++;
    this.lastOre = m;
    this.worm.chomp = Math.max(this.worm.chomp, .5);
    return true;
  }
  nagFull(x, y) { if (this.worm.fullT < this.t) { this.worm.fullT = this.t + 4; this.event('full', { x, y }); } }

  /* ---------- eating finds ---------- */
  eat() {
    const w = this.worm, mr = this.mouthR(), hb = bandOf(w.y), vib = this.up.vib;
    for (let b = Math.max(0, hb - 1); b <= Math.min(BANDS - 1, hb + 1); b++) {
      for (const o of this.objBand[b]) {
        if (o.gone || o.fresh || o.hazard) continue;
        const d = Math.hypot(o.x - w.x, o.y - w.y);
        if (d > mr + o.r * .6) continue;
        const c = this.cell(o.x, o.y);
        if (SOLID[c] && TIER[c] > vib) continue;           // still locked in rock too hard to shake
        if (o.kind === 'cache') { this.eatCache(o); continue; }
        const I = ITEMS[o.kind];
        if (I.size > this.up.maw + 1) {
          if (o.nagT < this.t) { o.nagT = this.t + 5; this.event('toobig', { x: o.x, y: o.y, kind: o.kind, need: I.size - 1 }); }
          continue;
        }
        const slots = SLOTS_BY_SIZE[I.size];
        if (this.belly + slots > this.cap() + 1e-6) { this.nagFull(o.x, o.y); continue; }
        this.swallow(o, slots);
      }
    }
  }
  swallow(o, slots) {
    const I = ITEMS[o.kind], w = this.worm;
    o.gone = true;
    this.belly += slots;
    this.hold[o.kind] = (this.hold[o.kind] || 0) + 1;
    this.holdValue += I.value;
    const first = !this.found[o.kind];
    this.found[o.kind] = (this.found[o.kind] || 0) + 1;
    this.stats.eaten++;
    this.combo = this.t - this.combo.t < 1.5 ? { n: this.combo.n + 1, t: this.t } : { n: 1, t: this.t };
    w.chomp = 1;
    const S = o.set >= 0 ? this.plan.sets[o.set] : null, left = S ? --this.setLeft[o.set] : 0;
    this.event('eat', { x: o.x, y: o.y, kind: o.kind, value: I.value, combo: this.combo.n, first, set: S ? [S.n - left, S.n] : null, sid: S ? o.set : -1 });
    if (S) {
      if (left === 0) {
        const bonus = S.vault === undefined ? Math.round(this.setWorth[o.set] * .25) : 0;
        this.holdValue += bonus;
        this.stats.sets++;
        this.event('set', { x: o.x, y: o.y, bonus, n: S.n, shape: S.shape, st: S.st, sid: o.set });
        if (S.vault !== undefined) this.openVault(S.vault);
      }
    }
  }
  eatCache(o) {
    const c = o.cache, room = this.cap() - this.belly;
    if (room < .05) { this.nagFull(o.x, o.y); return; }
    let took = 0;
    for (const k of Object.keys(c.hold)) {
      const slots = SLOTS_BY_SIZE[ITEMS[k].size];
      while (c.hold[k] > 0 && this.belly + slots <= this.cap() + 1e-6) {
        c.hold[k]--; this.belly += slots; this.hold[k] = (this.hold[k] || 0) + 1; this.holdValue += ITEMS[k].value; c.value -= ITEMS[k].value; took++;
      }
      if (!c.hold[k]) delete c.hold[k];
    }
    for (const m of Object.keys(c.ore)) {
      const fit = Math.min(c.ore[m], Math.floor((this.cap() - this.belly + 1e-6) * ORE_PER_SLOT));
      if (fit <= 0) continue;
      c.ore[m] -= fit; this.ore[m] = (this.ore[m] || 0) + fit; this.belly += fit / ORE_PER_SLOT; this.holdValue += fit * OREV[m]; c.value -= fit * OREV[m]; took++;
      if (!c.ore[m]) delete c.ore[m];
    }
    if (c.extra) { this.holdValue += c.extra; c.value -= c.extra; c.extra = 0; }
    if (!Object.keys(c.hold).length && !Object.keys(c.ore).length) o.gone = true;
    if (took) { this.worm.chomp = 1; this.event('cache', { x: o.x, y: o.y, all: o.gone }); }
    else this.nagFull(o.x, o.y);
  }
  openVault(v) {
    const V = this.plan.vaults[v], [x0, y0, x1, y1] = V.door;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; if (this.mat[i] === ALLOY) { this.vacate(i); this.touch(i); } }
    this.stats.vaults++;
    this.event('vault', { x: V.x, y: V.y });
  }

  /* ---------- firedamp ---------- */
  ignite(i0) {
    const { mat } = this, cells = [i0], seen = new Set([i0]);
    for (let q = 0; q < cells.length && cells.length < 1200; q++) {
      const i = cells[q];
      for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < mat.length && !seen.has(j) && mat[j] === GAS) { seen.add(j); cells.push(j); }
    }
    let sx = 0, sy = 0;
    for (const i of cells) { sx += i % W; sy += (i / W) | 0; this.vacate(i); this.touch(i); }
    const n = cells.length, cx = sx / n + .5, cy = sy / n + .5;
    for (let k = 0; k < Math.min(60, n); k++) { const i = cells[Math.floor(this.R() * n)]; this.fxAt('fire', i % W, (i / W) | 0); }
    this.blast(cx, cy, Math.min(22, 4 + Math.sqrt(n) * .9));
  }
  blast(cx, cy, r) {
    const { mat, flags } = this;
    let thrown = 0;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || x >= W || y < 0 || y >= H || !this.built[y >> 6]) continue;
      const d = Math.hypot(x + .5 - cx, y + .5 - cy);
      if (d > r) continue;
      const i = y * W + x, m = mat[i];
      if (!SOLID[m] || TIER[m] > 7 || OREV[m]) continue;
      if (d < r * .55) {
        if (thrown < 160 && this.R() < .7) {
          const k = (1 - d / r) * 260 + 60, ax = (x + .5 - cx) / (d || 1), ay = (y + .5 - cy) / (d || 1);
          this.parts.push({ x: x + .5, y: y + .5, vx: ax * k + (this.R() - .5) * 60, vy: ay * k - 40 + (this.R() - .5) * 60, m, s: this.shade[i], t: 0 });
          thrown++;
        }
        this.vacate(i);
      } else flags[i] |= DIST | LOOSE;
      this.touch(i);
    }
    this.wakeAt(cx, cy, r + 8);
    const w = this.worm, d = Math.hypot(w.x - cx, w.y - cy), reach = r * 1.7;
    if (d < reach) {
      const k = 1 - d / reach;
      this.hurt(HURT.blast * k, 'blast');
      const ax = (w.x - cx) / (d || 1), ay = (w.y - cy) / (d || 1);
      w.vx += ax * 280 * k; w.vy += ay * 280 * k - 60 * k;
    }
    for (let b = bandOf(cy - r); b <= bandOf(cy + r); b++) for (const o of this.objBand[b]) if (!o.gone && Math.hypot(o.x - cx, o.y - cy) < r + o.r) { o.rest = false; o.vy = -60; }
    this.event('blast', { x: cx, y: cy, r });
  }

  /* ---------- hurting, fainting ---------- */
  hurt(n, cause) {
    if (this.won || n <= 0) return;
    n *= TOUGH[this.up.hide];
    this.hp -= n;
    this.worm.hurtT = 0;
    // a steady burn (lava) is told once every so often; a knock, every time
    this.hurtAcc = (this.hurtAcc || 0) + n;
    if (n > 3 || this.t - (this.hurtAt || -9) > .35) { this.event('hurt', { n: this.hurtAcc, cause }); this.hurtAcc = 0; this.hurtAt = this.t; }
    if (this.hp <= 0) this.faint(false);
  }
  // Out cold (or wriggling home on purpose): whatever's in the belly stays where the worm was, to come back for, and
  // the worm wakes up at the camp.
  faint(voluntary) {
    const w = this.worm, dropped = this.belly > 0;
    if (dropped) {
      const o = { id: this.objs.length, kind: 'cache', x: w.x, y: w.y, r: SIZE_R[1] + 1, st: -1, set: -1, n: 0, gone: false, rest: false, fresh: false, vy: 0, nagT: 0,
        cache: { hold: { ...this.hold }, ore: { ...this.ore }, value: this.holdValue, extra: 0 } };
      // a set bonus already counted in the value, but not tied to any one find, comes back as extra
      let plain = 0;
      for (const k in this.hold) plain += ITEMS[k].value * this.hold[k];
      for (const m in this.ore) plain += OREV[m] * this.ore[m];
      o.cache.extra = Math.max(0, this.holdValue - plain);
      this.objs.push(o); this.objBand[bandOf(o.y)].push(o);
    }
    this.hold = {}; this.ore = {}; this.belly = 0; this.holdValue = 0;
    if (!voluntary) this.stats.faints++;
    const home = this.homeFor(w.y);
    if (home) {
      // on the floor of the outpost's hall, lying along it
      const x = home.x + (this.R() - .5) * 30;
      w.x = x; w.y = home.y1 - 4; w.vx = 0; w.vy = 0; w.a = 0; w.mode = 'air';
      this.resetPath(w.x, w.y, this.R() < .5 ? -1 : 1, 0);
    } else {
      const x = W / 2 + (this.R() - .5) * 60;
      w.x = x; w.y = this.plan.surf[Math.round(x)] - 46; w.vx = 0; w.vy = 40; w.a = Math.PI / 2; w.mode = 'air';
      this.resetPath(w.x, w.y, 0, -1);
    }
    w.jump = false; w.tuck = 0;
    this.hp = this.hpMax();
    this.event('faint', { voluntary, cache: dropped, post: home ? home.k : -1 });
  }
  wriggleHome() { if (!this.atShop) this.faint(true); }

  /* ---------- finds that fall ---------- */
  supported(o) {
    const r = o.r * .7, { mat } = this;
    for (let y = Math.floor(o.y - r); y <= Math.floor(o.y + r); y++) for (let x = Math.floor(o.x - r); x <= Math.floor(o.x + r); x++) {
      if ((x + .5 - o.x) ** 2 + (y + .5 - o.y) ** 2 > r * r + .3) continue;
      if (x < 0 || x >= W || y < 0) continue;
      if (y >= H) return true;
      if (SOLID[mat[y * W + x]]) return true;
    }
    const by = Math.floor(o.y + o.r) + 1;
    if (by >= H) return true;
    for (let x = Math.floor(o.x - o.r * .6); x <= Math.floor(o.x + o.r * .6); x++) if (x >= 0 && x < W && SOLID[mat[by * W + x]]) return true;
    for (const p of this.objBand[bandOf(o.y)]) if (p !== o && !p.gone && p.rest && p.y > o.y && Math.abs(p.x - o.x) < (p.r + o.r) * .7 && p.y - o.y < p.r + o.r + .5) return true;
    return false;
  }
  moveObjects(dt) {
    const hb = bandOf(this.worm.y);
    for (let b = Math.max(0, hb - 5); b <= Math.min(BANDS - 1, hb + 5); b++) {
      if (!this.built[b] || (b < BANDS - 1 && !this.built[b + 1])) continue;
      const list = this.objBand[b];
      for (let q = 0; q < list.length; q++) {
        const o = list[q];
        if (o.gone) continue;
        if (o.fresh && o.hazard) { o.fresh = false; o.rest = true; continue; }     // hanging from a roof
        if (o.fresh) {
          // the first look at a find: settle it where it would have come to rest long ago
          let ok = true;
          for (let s = 0; s < 400 && !this.supported(o); s++) {
            if (!this.built[bandOf(o.y + o.r + 2)]) { ok = false; break; }
            o.y += 1;
          }
          if (!ok) continue;
          o.fresh = false; o.rest = true;
          if (this.rebucket(o, b)) q--;
          continue;
        }
        if (o.rest && o.hazard) {
          // a stalactite or spike: the worm's shaking underneath works it loose, and after a moment it drops
          const w = this.worm;
          if (o.fall > 0) { o.fall -= dt; if (o.fall <= 0) { o.rest = false; o.vy = 0; } }
          else if (Math.abs(w.x - o.x) < 14 + this.headR() + this.up.vib && w.y > o.y && w.y - o.y < 100) { o.fall = .5; this.event('creak', { x: o.x, y: o.y, kind: o.kind }); }
          continue;
        }
        if (o.rest) { if ((this.tick + o.id) % 15 === 0 && !this.supported(o)) { o.rest = false; o.vy = 0; } continue; }
        const inLiquid = LIQ[this.cell(o.x, o.y)];
        o.vy = Math.min(o.vy + WORM.gravity * dt * (inLiquid ? .25 : 1), inLiquid ? 45 : 420);
        let dy = o.vy * dt;
        let landed = false;
        while (Math.abs(dy) > 0) {
          const st = Math.max(-1, Math.min(1, dy));
          o.y += st; dy -= st;
          if (st > 0 && this.supported(o)) { landed = true; break; }
          if (o.y > H - 2) { o.gone = true; break; }
        }
        const w = this.worm;
        if (o.hazard && !landed) {
          // hits the worm anywhere along its body
          for (let sq = 0; sq < this.segN; sq += 2) if (Math.hypot(o.x - this.segX[sq], o.y - this.segY[sq]) < o.r * .8 + this.segR[sq]) { this.hurt(o.hazard, 'rock'); landed = true; break; }
        } else if (!landed && o.vy > 110 && ITEMS[o.kind]?.size >= 2 && Math.hypot(o.x - w.x, o.y - w.y) < o.r + this.headR()) {
          this.hurt(HURT.rock * (ITEMS[o.kind].size - 1) * .5, 'rock'); o.vy *= .3;
        }
        if (landed && o.hazard) { o.gone = true; this.event('shatter', { x: o.x, y: o.y, kind: o.kind }); continue; }
        if (landed) {
          if (o.vy > 90) this.event('thud', { x: o.x, y: o.y, v: o.vy, kind: o.kind });
          o.vy = 0; o.rest = true;
        }
        if (this.rebucket(o, b)) q--;
      }
    }
  }
  rebucket(o, b) {
    const nb = bandOf(o.y);
    if (nb === b) return false;
    const list = this.objBand[b], k = list.indexOf(o);
    if (k >= 0) list.splice(k, 1);
    this.objBand[nb].push(o);
    return true;
  }

  /* ---------- flying dirt ---------- */
  moveParts(dt) {
    const g = WORM.gravity, { mat } = this;
    const keep = [];
    for (const p of this.parts) {
      p.t += dt;
      const liq = LIQ[this.cell(p.x, p.y)];
      p.vy += g * dt * (liq ? .3 : 1);
      if (liq) { p.vx *= 1 - 3 * dt; p.vy = Math.min(p.vy, 50); }
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy)) * dt));
      let done = false;
      for (let s = 0; s < n && !done; s++) {
        const px = p.x, py = p.y;
        p.x += p.vx * dt / n; p.y += p.vy * dt / n;
        if (p.x < .5) { p.x = .5; p.vx = Math.abs(p.vx) * .3; }
        if (p.x > W - .5) { p.x = W - .5; p.vx = -Math.abs(p.vx) * .3; }
        if (p.y < 0) continue;
        const c = this.cell(p.x, p.y);
        if (SOLID[c] || p.y >= H - 1) { this.deposit(p, px, py); done = true; }
      }
      if (!done && p.t > 8) { this.deposit(p, p.x, p.y); done = true; }
      if (!done) keep.push(p);
    }
    this.parts = keep;
  }
  deposit(p, x, y) {
    let cx = Math.floor(x), cy = Math.floor(y);
    const { mat, flags, shade } = this;
    for (let up = 0; up < 8 && cy > 0; up++, cy--) {
      if (cx < 0 || cx >= W || cy >= H || !this.built[cy >> 6]) return;
      const i = cy * W + cx, m = mat[i];
      if (OPEN(m)) { mat[i] = p.m; flags[i] = SOLID[p.m] ? DIST | LOOSE : 0; shade[i] = p.s; this.touch(i); this.wakeAt(cx, cy, 1); return; }
      if (LIQ[m] && SOLID[p.m]) {
        // sinks to the bottom of a pool: the water it pushes aside goes on top
        mat[i] = p.m; flags[i] = DIST | LOOSE; shade[i] = p.s; this.touch(i);
        for (let k = 1; k < 60 && cy - k > 0; k++) { const j = i - k * W; if (OPEN(mat[j])) { mat[j] = m; flags[j] = 0; this.touch(j); break; } }
        this.wakeAt(cx, cy, 2);
        return;
      }
    }
  }

  /* ---------- the camp ---------- */
  checkCamp() {
    const w = this.worm, xi = clamp(Math.floor(w.x), 0, W - 1), d = w.y - this.plan.surf[xi];
    const at = d <= CAMP.depth && w.x >= CAMP.x0 && w.x <= CAMP.x1;
    if (at && !this.atCamp) this.event('camp', {});
    this.atCamp = at;
    // in an outpost's hall (or in the rock just round it)
    const k = this.posts.findIndex(o => w.x >= o.x0 - 2 && w.x <= o.x1 + 2 && w.y >= o.y0 - 6 && w.y <= o.y1 + 5);
    if (k !== this.atPost) { this.atPost = k; if (k >= 0) this.event('outpost', { k, bought: this.posts[k].bought }); }
    this.atShop = at || (k >= 0 && this.posts[k].bought);
    if (this.atShop) {
      if (this.belly > 0) this.sell();
      this.hp = this.hpMax();
    }
  }
  // An outpost's hall keeps its floor clear: whatever falls in (the worm's own tunnel, pouring in after it through the
  // roof) is carted off a little at a time, from the top of each heap.
  sweep() {
    for (const o of this.posts) {
      if (!this.built[o.y0 >> 6] || !this.built[(o.y1 - 1) >> 6]) continue;
      for (let x = Math.ceil(o.x0); x <= Math.floor(o.x1); x++) {
        const u = (x + .5 - o.x) / ((o.x1 - o.x0) / 2);
        if (Math.abs(u) > 1) continue;
        for (let y = Math.ceil(o.y0 + (o.y1 - o.y0) * .45 * u * u) + 1; y < o.y1; y++) {
          const i = y * W + x, m = this.mat[i];
          if (m === AIR) continue;
          if (SOLID[m] && !OREV[m] && !(TIER[m] > 90)) { this.vacate(i); this.touch(i); this.wakeAt(x, y, 2); }
          break;
        }
      }
    }
  }
  // Where the shop the worm's at keeps its trading post and its Resonator (for the coins and the hum to go to).
  shopSpot(which) {
    const o = this.posts[this.atPost];
    if (this.atCamp || !o) { const x = which === 'post' ? CAMP.post : CAMP.resonator; return { x, y: this.plan.surf[x] }; }
    return { x: o.x + OUTPOST[which], y: o.y1 };
  }
  // The shop to go back to from depth y: the deepest bought outpost above it, or the camp (null).
  homeFor(y) {
    let best = null;
    for (const o of this.posts) if (o.bought && o.y < y && (!best || o.y > best.y)) best = o;
    return best;
  }
  // Buying the outpost the worm's in, there and then.
  buyPost() {
    const o = this.posts[this.atPost];
    if (!o || o.bought) return { ok: false, why: 'none' };
    if (this.money < o.price) return { ok: false, why: 'money' };
    this.money -= o.price;
    o.bought = true;
    this.stats.posts = (this.stats.posts || 0) + 1;
    (this.stats.postAt ||= [])[o.k] = this.t;
    this.event('outpostBought', { k: o.k, x: o.x, y: o.y });
    this.checkCamp();                                  // (a shop now: it takes what's carried)
    return { ok: true };
  }
  sell() {
    const list = [];
    for (const k in this.hold) list.push({ kind: k, n: this.hold[k], value: ITEMS[k].value * this.hold[k] });
    for (const m in this.ore) list.push({ ore: +m, n: this.ore[m], value: OREV[m] * this.ore[m] });
    list.sort((a, b) => b.value - a.value);
    const total = Math.round(this.holdValue);
    this.money += total; this.earned += total;
    this.stats.trips++; this.stats.sold += total; this.stats.bestHaul = Math.max(this.stats.bestHaul, total);
    this.hold = {}; this.ore = {}; this.belly = 0; this.holdValue = 0;
    this.event('sell', { total, list, at: this.shopSpot('post') });
  }
  buy(id) {
    if (!this.atShop) return { ok: false, why: 'camp' };
    const c = this.cost(id);
    if (c === null) return { ok: false, why: 'max' };
    if (this.money < c) return { ok: false, why: 'money' };
    this.money -= c;
    this.up[id]++;
    this.stats.upAt[id + this.up[id]] = this.t;
    this.hp = this.hpMax();
    this.event('upgrade', { id, level: this.up[id], at: this.shopSpot('resonator') });
    return { ok: true };
  }

  /* ---------- a step of play ---------- */
  step(dt) {
    if (!(dt > 0)) return;
    this.t += dt;
    const w = this.worm, hb = bandOf(w.y);
    this.ensureBands(hb - 2, hb + 4);
    this.moveWorm(dt);
    this.acc += dt;
    for (let k = 0; this.acc >= CELL_DT && k < 4; k++) { this.acc -= CELL_DT; this.tickCells(); }
    if (this.acc > CELL_DT) this.acc = 0;
    this.moveObjects(dt);
    this.moveParts(dt);
    this.checkCamp();
    if ((this.sweepT = (this.sweepT || 0) - dt) <= 0) { this.sweepT = .3; this.sweep(); }
    this.sag(dt);
    this.body();
    this.beams(dt);
    // how deep, and which layer
    const d = this.depth();
    if (d > this.stats.deepest) this.stats.deepest = d;
    if (w.y > this.plan.surf[clamp(Math.floor(w.x), 0, W - 1)]) {
      const k = layerAt(this.plan, clamp(Math.floor(w.x), 0, W - 1), Math.floor(w.y));
      if (k > this.stats.layer) { this.stats.layer = k; this.stats.layerAt[k] = this.t; this.event('layer', { k }); }
    }
    if (!this.won && Math.hypot(w.x - CORE_X, w.y - CORE_Y) < CORE_R + this.headR() + 2.5) {
      this.won = true; this.wonAt = this.t; this.event('win', {});
    }
  }

  /* ---------- the Old Ones' barriers ---------- */
  beamOn(b) { return ((this.t + b.phase) % BEAM.period) < BEAM.period * BEAM.duty; }
  beams(dt) {
    const w = this.worm, rc = this.collR() + 1.5;
    for (const b of this.plan.beams) {
      if (Math.abs(b.y0 - w.y) > 60 || !this.beamOn(b)) continue;
      // nearest point of the beam
      const vx = b.x1 - b.x0, vy = b.y1 - b.y0, L2 = vx * vx + vy * vy || 1;
      const k = Math.max(0, Math.min(1, ((w.x - b.x0) * vx + (w.y - b.y0) * vy) / L2)), px = b.x0 + vx * k, py = b.y0 + vy * k;
      const d = Math.hypot(w.x - px, w.y - py);
      if (d > rc) continue;
      this.hurt(HURT.zap * dt, 'zap');
      // pushed back the way it came
      if (vy === 0) w.vy = (w.y < py ? -1 : 1) * BEAM.push; else w.vx = (w.x < px ? -1 : 1) * BEAM.push;
      if (!(w.zapT > this.t)) { w.zapT = this.t + .5; this.event('zap', { x: px, y: py }); }
    }
  }

  event(type, data) { this.events.push({ type, t: this.t, ...data }); if (this.events.length > 400) this.events.splice(0, 100); }
  fxAt(type, x, y) { if (!this.headless) this.fx.push({ type, x, y }); }

  /* ---------- saving ---------- */
  toJSON() {
    const bands = {};
    for (let b = 0; b < BANDS; b++) if (this.modified[b] && this.built[b]) bands[b] = this.encodeBand(b);
    for (const b in this.pending) bands[b] = this.pending[b];
    const gone = [], moved = [], caches = [];
    for (const o of this.objs) {
      if (o.kind === 'cache') { if (!o.gone) caches.push({ x: o.x, y: o.y, cache: o.cache }); continue; }
      if (o.gone && !this.plan.items[o.id].skip) gone.push(o.id);
      else if (!o.fresh) { const p = this.plan.items[o.id]; if (Math.abs(o.y - (p.y + .5)) > .5) moved.push([o.id, Math.round(o.y * 10) / 10]); }
    }
    const w = this.worm;
    return { v: 1, seed: this.seed, t: Math.round(this.t * 10) / 10, money: this.money, earned: this.earned, up: this.up, hp: this.hp,
      hold: this.hold, ore: this.ore, belly: this.belly, holdValue: this.holdValue, found: this.found, stats: this.stats, won: this.won, wonAt: this.wonAt,
      worm: { x: w.x, y: w.y }, gone, moved, caches, bands, posts: this.posts.map(o => o.bought ? 1 : 0) };
  }
  restore(s) {
    Object.assign(this, { t: s.t || 0, money: s.money || 0, earned: s.earned || 0, hold: s.hold || {}, ore: s.ore || {}, belly: s.belly || 0,
      holdValue: s.holdValue || 0, found: s.found || {}, won: !!s.won, wonAt: s.wonAt ?? null });
    Object.assign(this.up, s.up || {});
    Object.assign(this.stats, s.stats || {});
    const gone = new Set(s.gone || []);
    for (const o of this.objs) if (gone.has(o.id) && !o.gone) { o.gone = true; if (o.set >= 0) this.setLeft[o.set]--; }
    (s.posts || []).forEach((b, k) => { if (this.posts[k]) this.posts[k].bought = !!b; });
    for (const [id, y] of s.moved || []) { const o = this.objs[id]; if (!o) continue; const b = bandOf(o.y); o.y = y; o.fresh = false; o.rest = true; this.rebucket(o, b); }
    for (const c of s.caches || []) {
      const o = { id: this.objs.length, kind: 'cache', x: c.x, y: c.y, r: SIZE_R[1] + 1, st: -1, set: -1, n: 0, gone: false, rest: false, fresh: false, vy: 0, nagT: 0, cache: c.cache };
      this.objs.push(o); this.objBand[bandOf(o.y)].push(o);
    }
    this.pending = { ...(s.bands || {}) };
    for (let b = 0; b < BANDS; b++) if (this.built[b] && this.pending[b]) { this.applyBand(b, this.pending[b]); delete this.pending[b]; }
    this.hp = Math.min(this.hpMax(), s.hp ?? this.hpMax());
    const w = this.worm;
    if (s.worm) {
      w.x = clamp(s.worm.x, 4, W - 4); w.y = clamp(s.worm.y, 4, H - 4);
      this.ensureBands(bandOf(w.y) - 2, bandOf(w.y) + 3);
      this.resetPath(w.x, w.y, 0, -1);
    }
  }
  // A band's changes since it was built: which cells are shaken loose (as runs), and which have become something
  // else (runs of changed cells, with what each is now).
  encodeBand(b) {
    const hit = this.enc?.[b];
    if (hit && hit.ver === this.ver[b]) return hit.str;
    const str = this.encodeBandNow(b);
    (this.enc ||= [])[b] = { ver: this.ver[b], str };
    return str;
  }
  encodeBandNow(b) {
    const o = b * BAND * W, n = BAND * W, { mat, flags } = this, orig = this.orig[b], out = [];
    const vint = v => { while (v > 127) { out.push((v & 127) | 128); v >>>= 7; } out.push(v); };
    let cur = 0, run = 0;
    for (let i = 0; i < n; i++) { const f = flags[o + i] & DIST ? 1 : 0; if (f === cur) run++; else { vint(run); cur = f; run = 1; } }
    vint(run);
    let i = 0;
    while (i < n) {
      let gap = 0;
      while (i < n && mat[o + i] === orig[i]) { i++; gap++; }
      if (i >= n) break;
      let len = 0;
      while (i + len < n && mat[o + i + len] !== orig[i + len]) len++;
      vint(gap); vint(len);
      for (let k = 0; k < len; k++) out.push(mat[o + i + k]);
      i += len;
    }
    return toB64(out);
  }
  applyBand(b, str) {
    const bytes = fromB64(str), o = b * BAND * W, n = BAND * W, { mat, flags, shade } = this;
    let p = 0;
    const vint = () => { let v = 0, s = 0, c; do { c = bytes[p++]; v |= (c & 127) << s; s += 7; } while (c & 128); return v >>> 0; };
    let i = 0, cur = 0;
    while (i < n) { const run = vint(); for (let k = 0; k < run && i < n; k++, i++) flags[o + i] = cur ? DIST : 0; cur ^= 1; }
    i = 0;
    while (p < bytes.length && i < n) {
      i += vint(); const len = vint();
      for (let k = 0; k < len && i < n; k++, i++) { const m = bytes[p++]; if (mat[o + i] !== m) { mat[o + i] = m; if (m === AIR) shade[o + i] = this.airShade(o + i); } }
    }
    this.modified[b] = 1; this.ver[b]++;
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0, n = (a << 16) | (b << 8) | c;
    s += B64[n >> 18 & 63] + B64[n >> 12 & 63] + (i + 1 < bytes.length ? B64[n >> 6 & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return s;
}
function fromB64(s) {
  const out = [];
  for (let i = 0; i < s.length; i += 4) {
    const n = (B64.indexOf(s[i]) << 18) | (B64.indexOf(s[i + 1]) << 12) | ((s[i + 2] === '=' ? 0 : B64.indexOf(s[i + 2])) << 6) | (s[i + 3] === '=' ? 0 : B64.indexOf(s[i + 3]));
    out.push(n >> 16 & 255);
    if (s[i + 2] !== '=') out.push(n >> 8 & 255);
    if (s[i + 3] !== '=') out.push(n & 255);
  }
  return out;
}
