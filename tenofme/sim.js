// Ten of Me: the rules, with no DOM, so check.mjs can play every floor headless.
// A floor is a grid of 16px tiles. A run lasts 30 seconds and every earlier run replays its tape alongside you.
// A copy replays where it was, not which keys it pressed: if the world won't let it take its next step (a door is
// shut in its face, the thing it reached for has gone), it flickers and freezes where it stands, for the rest of the run.

export const T = 16, HZ = 60, DT = 1 / HZ, RUN_SECS = 30, RUN_TICKS = RUN_SECS * HZ, MAX_RUNS = 10;
export const BW = 10, BH = 22, GW = 12, GH = 24;
export const IN = { L: 1, R: 2, U: 4, D: 8, A: 16 };
export const SPEED = { walk: 64, climb: 50, gwalk: 30, gchase: 104, gback: 40 };
export const SEE = 8 * T;          // how far a guard's torch reaches
export const CUFF = 3.5, SEARCH = 1.6, LOSE = 0.5;
const GRAV = 1400, FALL = 380, REACH = 13;
export const EMPTY = 0, WALL = 1, LADDER = 2;

/* -------------------------------------------------------------------------------------------------------- floors */
// '#' wall  'H' ladder  '@' start  '$' jewel  'k' key  'X' the loading dock  'A'-'F' a door held open by plates 'a'-'f'
// '%' a locked door (the key opens it for good)  '!' laser  'V' camera (on the ceiling)  'G' guard
export function parseLevel(def) {
  const rows = def.map, H = rows.length, W = Math.max(...rows.map(r => r.length));
  const at = (x, y) => (y < 0 || y >= H || x < 0 || x >= W) ? '#' : (rows[y][x] ?? '#');
  const L = { def, W, H, grid: new Uint8Array(W * H), doorAt: new Int16Array(W * H).fill(-1), doors: [], plates: [], lasers: [], cams: [], guards: [], items: [], start: null, exit: [] };
  const taken = new Set();
  let li = 0, ci = 0, gi = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = at(x, y), k = y * W + x;
    if (c === '#') L.grid[k] = WALL;
    else if (c === 'H') L.grid[k] = LADDER;
    else if ((/[A-F%]/.test(c)) && !taken.has(k)) {
      let y1 = y; while (at(x, y1 + 1) === c) y1++;
      const d = { i: L.doors.length, x, y0: y, y1, letter: c === '%' ? null : c.toLowerCase(), lock: c === '%', open: false, unlocked: false };
      for (let yy = y; yy <= y1; yy++) { taken.add(yy * W + x); L.doorAt[yy * W + x] = d.i; }
      L.doors.push(d);
    } else if (c === '!' && !taken.has(k)) {
      let y1 = y; while (at(x, y1 + 1) === '!') y1++;
      for (let yy = y; yy <= y1; yy++) taken.add(yy * W + x);
      L.lasers.push({ i: L.lasers.length, x, y0: y, y1, ...(def.lasers?.[li++] || {}) });
    } else if (/[a-f]/.test(c)) L.plates.push({ i: L.plates.length, letter: c, x, y });
    else if (c === '@') L.start = { x: x * T + (T - BW) / 2, y: (y + 1) * T - BH };
    else if (c === '$') L.items.push({ id: 'jewel', x: x * T + T / 2, y: (y + 1) * T });
    else if (c === 'k') L.items.push({ id: 'key', x: x * T + T / 2, y: (y + 1) * T });
    else if (c === 'X') L.exit.push({ x, y });
    else if (c === 'V') L.cams.push({ i: L.cams.length, tx: x, ty: y, x: x * T + T / 2, y: y * T + 3, fov: 15, len: 7, ...(def.cams?.[ci++] || {}) });
    else if (c === 'G') { const m = def.guards?.[gi++] || {}; L.guards.push({ i: L.guards.length, x0: x * T + (T - GW) / 2, y0: (y + 1) * T - GH, face: m.face ?? -1, ...m }); }
  }
  for (const l of L.lasers) if (l.off && !L.plates.some(p => p.letter === l.off)) throw new Error(def.name + ': laser switched by missing plate ' + l.off);
  for (const d of L.doors) if (d.letter && !L.plates.some(p => p.letter === d.letter)) throw new Error(def.name + ': door ' + d.letter + ' has no plate');
  if (!L.start) throw new Error(def.name + ': no start');
  return L;
}

/* -------------------------------------------------------------------------------------------------------- the game */
const newCopy = (L, n, tape) => ({ n, tape, live: !tape, x: L.start.x, y: L.start.y, vy: 0, face: 1, climb: false, ground: true, carry: null, state: tape ? 'play' : 'live', at: -1, why: '' });
const newGuard = g => ({ g, x: g.x0, y: g.y0, face: g.face, state: g.beat ? 'patrol' : 'post', timer: 0, target: null, lastX: 0, lost: 0, lookT: 0 });

export class Game {
  constructor(def) { this.def = def; this.L = parseLevel(def); this.tapes = []; this.ev = []; this.newRun(); }
  emit(type, data) { this.ev.push({ type, data }); }
  drain() { const e = this.ev; this.ev = []; return e; }
  get run() { return this.tapes.length; }           // 0-based number of the run being played
  newRun() {
    const L = this.L;
    this.tick = 0; this.t = 0; this.recorded = 0; this.started = false; this.ended = null; this.pending = null; this.prevIn = 0;
    for (const d of L.doors) { d.open = false; d.unlocked = false; }
    this.plateOn = new Uint8Array(L.plates.length);
    this.items = L.items.map(it => ({ id: it.id, x: it.x, y: it.y, holder: null, home: true, hx: it.x, hy: it.y }));
    this.guards = L.guards.map(newGuard);
    this.copies = this.tapes.map((tape, n) => newCopy(L, n, tape));
    this.you = newCopy(L, this.tapes.length, null); this.copies.push(this.you);
    this.frames = new Float32Array(RUN_TICKS * 3); this.acts = [];
    this.emit('run', this.tapes.length);
  }
  start() { if (!this.started && !this.ended) { this.started = true; this.emit('start'); } }
  // Keep the run just played as a tape and start the next; or throw it away and play this run again; or go back further.
  next() { if (this.pending) this.tapes.push(this.pending); this.newRun(); }
  redo() { this.newRun(); }
  eraseFrom(n) { this.tapes.length = Math.min(this.tapes.length, n); this.newRun(); }
  restart() { this.tapes.length = 0; this.newRun(); }
  stop() { if (this.started && !this.ended) this.end('stop'); }
  canNext() { return !!this.pending && this.tapes.length + 1 < MAX_RUNS; }

  /* ---------------------------------------------------------------------------------------------------- one tick */
  step(inp) {
    if (this.ended) return;
    if (!this.started) { if (!inp) return; this.start(); }
    const i = this.tick, press = (inp & IN.A) && !(this.prevIn & IN.A); this.prevIn = inp;
    for (const c of this.copies) if (!c.live) this.stepGhost(c, i);
    const me = this.you;
    if (me.state === 'live') {
      this.physics(me, inp);
      if (press) this.act(me, i);
      const f = i * 3; this.frames[f] = me.x; this.frames[f + 1] = me.y; this.frames[f + 2] = (me.face > 0 ? 1 : 0) | (me.climb ? 2 : 0) | (me.ground ? 4 : 0);
      this.recorded = i + 1;
    }
    this.updatePlates(); this.updateDoors();
    for (const g of this.guards) this.updateGuard(g);
    if (!this.ended) this.checkSensors();
    if (!this.ended) this.checkWin();
    this.tick++; this.t = this.tick / HZ;
    if (!this.ended && this.tick >= RUN_TICKS) this.end('time');
  }
  end(type, info = {}) {
    if (this.ended) return;
    this.ended = { type, tick: this.tick, ...info };
    if (type !== 'alarm') this.pending = { frames: this.frames.slice(0, this.recorded * 3), acts: this.acts, end: this.recorded, how: type, actsAt: indexActs(this.acts) };
    this.emit('end', this.ended);
  }

  /* ---------------------------------------------------------------------------------------------------- earlier runs */
  stepGhost(c, i) {
    if (c.state === 'caught') return;
    if (c.state === 'play') {
      const tp = c.tape;
      if (i >= tp.end) { c.state = 'park'; c.at = i; }
      else {
        const f = i * 3, nx = tp.frames[f], ny = tp.frames[f + 1], fl = tp.frames[f + 2];
        if (this.blocked(c, nx, ny)) this.freeze(c, i, 'door');
        else {
          c.x = nx; c.y = ny; c.face = fl & 1 ? 1 : -1; c.climb = !!(fl & 2); c.ground = !!(fl & 4); c.vy = 0;
          for (const a of tp.actsAt.get(i) || []) {
            if (a.type === 'pick') { if (!this.pick(c, a.item)) { this.freeze(c, i, a.item); break; } }
            else if (a.type === 'drop') this.drop(c);
          }
        }
      }
    }
    if (c.state === 'frozen' || c.state === 'park') this.physics(c, 0);
  }
  freeze(c, i, why) { c.state = 'frozen'; c.at = i; c.why = why; this.emit('freeze', c); }
  // would this copy's next step walk into a shut door? A copy carrying the key opens locked doors as it reaches them.
  blocked(c, nx, ny) {
    const L = this.L, x0 = Math.floor(nx / T), x1 = Math.floor((nx + BW - 0.01) / T), y0 = Math.floor(ny / T), y1 = Math.floor((ny + BH - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const di = (tx >= 0 && tx < L.W && ty >= 0 && ty < L.H) ? L.doorAt[ty * L.W + tx] : -1; if (di < 0) continue;
      const d = L.doors[di]; if (d.open) continue;
      if (d.lock && c.carry?.id === 'key') { this.unlock(d, c); continue; }
      return true;
    }
    return false;
  }
  unlock(d, c) { d.unlocked = true; d.open = true; this.emit('unlock', { d, c }); }

  /* ---------------------------------------------------------------------------------------------------- picking things up */
  // one button: pick up what's here (putting down what you hold), or put down what you hold
  act(c, i) {
    const near = this.reachable(c);
    if (c.carry) { this.drop(c); this.acts.push({ i, type: 'drop' }); }
    if (near) { const it = this.pick(c, near.id); if (it) this.acts.push({ i, type: 'pick', item: it.id }); }
  }
  reachable(c) {
    const cx = c.x + BW / 2, fy = c.y + BH; let best = null, bd = REACH;
    for (const it of this.items) {
      if (it.holder) continue;
      const d = Math.abs(it.x - cx);
      if (d <= bd && Math.abs(it.y - fy) < 10) { bd = d; best = it; }
    }
    return best;
  }
  // only something lying on the floor: whatever a copy is holding stays with it, even if it has stopped
  pick(c, want) {
    const cx = c.x + BW / 2, fy = c.y + BH; let best = null, bd = REACH;
    for (const it of this.items) {
      if (it.holder || (want && it.id !== want)) continue;
      const d = Math.abs(it.x - cx);
      if (d <= bd && Math.abs(it.y - fy) < 10) { bd = d; best = it; }
    }
    if (!best) return null;
    best.holder = c; best.home = false; c.carry = best; this.emit('pick', { c, it: best });
    return best;
  }
  drop(c) {
    const it = c.carry; if (!it) return; c.carry = null; it.holder = null;
    it.x = c.x + BW / 2; it.y = this.floorBelow(it.x, c.y + BH - 1); this.emit('drop', { c, it });
  }
  floorBelow(x, y) {
    const tx = Math.floor(x / T);
    for (let ty = Math.floor(y / T) + (y % T === 0 ? 0 : 1); ty < this.L.H; ty++) if (this.support(tx, ty)) return ty * T;
    return this.L.H * T;
  }

  /* ---------------------------------------------------------------------------------------------------- tiles */
  tile(tx, ty) { const L = this.L; return (tx < 0 || ty < 0 || tx >= L.W || ty >= L.H) ? WALL : L.grid[ty * L.W + tx]; }
  doorAt(tx, ty) { const L = this.L; if (tx < 0 || ty < 0 || tx >= L.W || ty >= L.H) return null; const i = L.doorAt[ty * L.W + tx]; return i < 0 ? null : L.doors[i]; }
  opaque(tx, ty) { if (this.tile(tx, ty) === WALL) return true; const d = this.doorAt(tx, ty); return !!d && !d.open; }
  support(tx, ty) { const t = this.tile(tx, ty); return t === WALL || (t === LADDER && this.tile(tx, ty - 1) !== LADDER) || this.opaque(tx, ty); }
  blockAt(c, tx, ty) {
    if (this.tile(tx, ty) === WALL) return true;
    const d = this.doorAt(tx, ty); if (!d || d.open) return false;
    if (d.lock && c && c.carry?.id === 'key') { this.unlock(d, c); return false; }
    return true;
  }
  ladderSpan(tx, y0, y1) { for (let ty = Math.floor(y0 / T); ty <= Math.floor(y1 / T); ty++) if (this.tile(tx, ty) === LADDER) return true; return false; }
  standing(c) { const r = c.y + BH; if (Math.abs(r / T - Math.round(r / T)) > 0.01) return false; const ty = Math.round(r / T); for (let tx = Math.floor(c.x / T); tx <= Math.floor((c.x + BW - 0.01) / T); tx++) if (this.support(tx, ty)) return true; return false; }

  /* ---------------------------------------------------------------------------------------------------- moving a body */
  physics(c, inp) {
    const left = inp & IN.L, right = inp & IN.R, up = inp & IN.U, down = inp & IN.D;
    const tx = Math.floor((c.x + BW / 2) / T);
    if (!c.climb) {
      if (up && this.ladderSpan(tx, c.y + 2, c.y + BH - 1)) c.climb = true;
      else if (down && c.ground && this.tile(tx, Math.round((c.y + BH) / T)) === LADDER) { c.climb = true; c.y += 1; }
      if (c.climb) { c.x = tx * T + (T - BW) / 2; c.vy = 0; c.ground = false; }
    }
    if (c.climb) {
      if ((left || right) && !up && !down && this.standing(c)) c.climb = false;     // step off onto a floor
      else {
        const dy = ((down ? 1 : 0) - (up ? 1 : 0)) * SPEED.climb * DT;
        c.y += dy;
        if (dy < 0) {
          const feetT = Math.floor((c.y + BH - 0.01) / T);
          if (this.tile(tx, feetT) !== LADDER) { c.y = (feetT + 1) * T - BH; c.climb = false; c.ground = true; return; }
          const head = Math.floor(c.y / T); if (this.tile(tx, head) === WALL) c.y = (head + 1) * T;
        } else if (dy > 0) {
          const feetT = Math.floor((c.y + BH) / T), ft = this.tile(tx, feetT);
          if (ft === WALL || this.opaque(tx, feetT)) { c.y = feetT * T - BH; c.climb = false; c.ground = true; return; }
          if (ft === EMPTY && this.tile(tx, Math.floor((c.y + BH - 1) / T)) !== LADDER) c.climb = false;
        }
        if (c.climb) { c.ground = false; return; }
      }
    }
    const vx = ((right ? 1 : 0) - (left ? 1 : 0)) * SPEED.walk;
    if (vx) { c.face = vx > 0 ? 1 : -1; this.moveX(c, vx * DT, BW, BH); }
    c.vy = Math.min(FALL, c.vy + GRAV * DT);
    this.moveY(c, c.vy * DT, BW, BH);
  }
  moveX(c, dx, w, h) {
    let nx = c.x + dx; const y0 = Math.floor(c.y / T), y1 = Math.floor((c.y + h - 0.01) / T);
    if (dx > 0) { const col = Math.floor((nx + w - 0.01) / T); for (let ty = y0; ty <= y1; ty++) if (this.blockAt(c, col, ty)) { nx = col * T - w; break; } }
    else { const col = Math.floor(nx / T); for (let ty = y0; ty <= y1; ty++) if (this.blockAt(c, col, ty)) { nx = (col + 1) * T; break; } }
    const moved = nx !== c.x; c.x = nx; return moved;
  }
  moveY(c, dy, w, h) {
    const prev = c.y + h, feet = prev + dy, row = Math.floor(feet / T);
    c.ground = false;
    if (row * T >= prev - 0.001 && row * T <= feet) {
      for (let tx = Math.floor((c.x + 0.01) / T); tx <= Math.floor((c.x + w - 0.01) / T); tx++) if (this.support(tx, row)) { c.y = row * T - h; c.vy = 0; c.ground = true; return; }
    }
    c.y += dy;
  }

  /* ---------------------------------------------------------------------------------------------------- plates and doors */
  updatePlates() {
    const P = this.L.plates;
    for (let k = 0; k < P.length; k++) {
      const p = P[k], top = (p.y + 1) * T, x0 = p.x * T + 2, x1 = p.x * T + T - 2;
      const on = this.copies.some(c => c.state !== 'caught' && !c.climb && Math.abs(c.y + BH - top) < 1.5 && c.x < x1 && c.x + BW > x0) ? 1 : 0;
      if (on !== this.plateOn[k]) { this.plateOn[k] = on; this.emit('plate', { p, on }); }
    }
  }
  held(letter) { let any = false; for (let k = 0; k < this.L.plates.length; k++) if (this.L.plates[k].letter === letter) { if (!this.plateOn[k]) return false; any = true; } return any; }
  updateDoors() {
    for (const d of this.L.doors) {
      let want = d.lock ? d.unlocked : this.held(d.letter);
      if (!want && d.open && this.inDoor(d)) want = true;      // a door won't shut on anyone standing in it
      if (want !== d.open) { d.open = want; this.emit('door', d); }
    }
  }
  inDoor(d) {
    const x0 = d.x * T, x1 = x0 + T, y0 = d.y0 * T, y1 = (d.y1 + 1) * T;
    for (const c of this.copies) if (c.state !== 'caught' && c.x < x1 && c.x + BW > x0 && c.y < y1 && c.y + BH > y0) return true;
    for (const g of this.guards) if (g.x < x1 && g.x + GW > x0 && g.y < y1 && g.y + GH > y0) return true;
    return false;
  }

  /* ---------------------------------------------------------------------------------------------------- lasers and cameras */
  laserOn(l) {
    if (l.off && this.held(l.off)) return false;
    if (l.cycle) { const [on, off, ph = 0] = l.cycle; return ((this.t + ph) % (on + off)) < on; }
    return true;
  }
  camOn(c) { return !(c.off && this.held(c.off)); }
  // a camera that turns from side to side sees nothing while it's turning
  camLive(c) {
    if (!this.camOn(c)) return false;
    if (c.hold == null) return true;
    const P = 2 * (c.hold + c.swing), p = (((this.t + (c.phase || 0)) % P) + P) % P;
    return !((p >= c.hold && p < c.hold + c.swing) || p >= 2 * c.hold + c.swing);
  }
  // a camera looks one way for `hold` seconds, swings across in `swing` seconds, looks the other way, swings back
  camAngle(c, t = this.t) {
    if (c.hold != null) {
      const P = 2 * (c.hold + c.swing), p = (((t + (c.phase || 0)) % P) + P) % P, e = k => (1 - Math.cos(Math.PI * k)) / 2;
      if (p < c.hold) return c.from;
      if (p < c.hold + c.swing) return c.from + (c.to - c.from) * e((p - c.hold) / c.swing);
      if (p < 2 * c.hold + c.swing) return c.to;
      return c.to + (c.from - c.to) * e((p - 2 * c.hold - c.swing) / c.swing);
    }
    if (!c.period) return c.from ?? 90;
    const p = (((t + (c.phase || 0)) % c.period) + c.period) % c.period / c.period, tri = p < .5 ? p * 2 : 2 - p * 2, e = (1 - Math.cos(Math.PI * tri)) / 2;
    return c.from + (c.to - c.from) * e;
  }
  camSees(cam, c) {
    const a = this.camAngle(cam), cx = c.x + BW / 2;
    for (const py of [c.y + 3, c.y + BH / 2, c.y + BH - 2]) {
      const dx = cx - cam.x, dy = py - cam.y, dist = Math.hypot(dx, dy); if (dist > cam.len * T) continue;
      let d = Math.atan2(dy, dx) * 180 / Math.PI - a; d = ((d + 540) % 360) - 180; if (Math.abs(d) > cam.fov) continue;
      if (this.clearLine(cam.x, cam.y + 2, cx, py)) return true;
    }
    return false;
  }
  clearLine(x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4);
    for (let k = 1; k < n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; if (this.opaque(Math.floor(x / T), Math.floor(y / T))) return false; }
    return true;
  }
  checkSensors() {
    const t = this.t;
    for (const l of this.L.lasers) {
      if (!this.laserOn(l)) continue;
      const bx = l.x * T + T / 2, y0 = l.y0 * T, y1 = (l.y1 + 1) * T;
      for (const c of this.copies) if (c.state !== 'caught' && c.x < bx && c.x + BW > bx && c.y < y1 && c.y + BH > y0) return this.end('alarm', { by: c, what: 'laser', laser: l });
    }
    for (const cam of this.L.cams) {
      if (!this.camLive(cam)) continue;
      for (const c of this.copies) if (c.state !== 'caught' && this.camSees(cam, c)) return this.end('alarm', { by: c, what: 'camera', cam });
    }
  }
  checkWin() {
    const j = this.items.find(i => i.id === 'jewel'), c = j?.holder; if (!c || c.state === 'caught') return;
    for (const e of this.L.exit) if (c.x < (e.x + 1) * T && c.x + BW > e.x * T && c.y < (e.y + 1) * T && c.y + BH > e.y * T) return this.end('win', { by: c });
  }

  /* ---------------------------------------------------------------------------------------------------- guards */
  // A guard sees along his torch: ahead of him, on his own floor, until a wall or a shut door. He chases the first of
  // you he sees, whoever that is, and takes away anyone he touches.
  canSee(g, c, chasing) {
    if (c.state === 'caught') return false;
    const gx = g.x + GW / 2, cx = c.x + BW / 2, dx = cx - gx;
    if (!chasing && dx * g.face <= 0) return false;
    if (Math.abs(dx) > (chasing ? SEE * 1.5 : SEE)) return false;
    if (c.y > g.y + GH - 6 || c.y + BH < g.y + 6) return false;
    const row = Math.floor((g.y + 8) / T), step = Math.sign(dx) * 4;
    for (let x = gx; Math.abs(x - gx) < Math.abs(dx); x += step) if (this.opaque(Math.floor(x / T), row)) return false;
    return true;
  }
  spot(g) {
    let best = null, bd = 1e9;
    for (const c of this.copies) if (this.canSee(g, c, false)) { const d = Math.abs(c.x - g.x); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  // walk, stopping at walls, shut doors and the edge of the floor
  guardWalk(g, dx) {
    if (!dx) return true;
    const ox = g.x; this.moveX(g, dx, GW, GH);
    const lead = dx > 0 ? g.x + GW - 1 : g.x + 1, below = Math.floor((g.y + GH + 1) / T);
    if (!this.support(Math.floor(lead / T), below)) g.x = ox;
    return Math.abs(g.x - ox) > 1e-6;
  }
  home(g) { const m = g.g; if (m.beat) { const lo = m.beat[0] * T + (T - GW) / 2, hi = m.beat[1] * T + (T - GW) / 2; return Math.max(lo, Math.min(hi, g.x)); } return m.x0; }
  updateGuard(g) {
    const m = g.g, gx = g.x + GW / 2;
    switch (g.state) {
      case 'patrol': {
        if (g.timer > 0) { g.timer -= DT; if (g.timer <= 0) g.face = -g.face; break; }
        const lo = m.beat[0] * T + (T - GW) / 2, hi = m.beat[1] * T + (T - GW) / 2;
        const ok = this.guardWalk(g, g.face * SPEED.gwalk * DT);
        if (g.face > 0 && g.x >= hi) { g.x = hi; g.timer = m.pause ?? 1; }
        else if (g.face < 0 && g.x <= lo) { g.x = lo; g.timer = m.pause ?? 1; }
        else if (!ok) g.timer = m.pause ?? 1;
        break;
      }
      case 'post':
        if (m.look) { g.lookT += DT; if (g.lookT >= m.look) { g.lookT = 0; g.face = -g.face; } }
        break;
      case 'chase': {
        const c = g.target;
        if (!c || c.state === 'caught') { g.state = 'return'; break; }
        if (this.canSee(g, c, true)) { g.lastX = c.x + BW / 2; g.lost = 0; } else g.lost += DT;
        if (g.lost > LOSE) { g.state = 'hunt'; break; }
        const d = g.lastX - gx; if (Math.abs(d) > 0.5) g.face = Math.sign(d);
        if (!this.guardWalk(g, Math.sign(d) * Math.min(SPEED.gchase * DT, Math.abs(d))) && Math.abs(d) > 2 && !this.canSee(g, c, true)) g.state = 'hunt';
        break;
      }
      case 'hunt': {
        const d = g.lastX - gx; if (Math.abs(d) > 0.5) g.face = Math.sign(d);
        if (Math.abs(d) < 2 || !this.guardWalk(g, Math.sign(d) * Math.min(SPEED.gchase * DT, Math.abs(d)))) { g.state = 'search'; g.timer = SEARCH; }
        break;
      }
      case 'search': g.timer -= DT; if (g.timer < SEARCH / 2 && g.timer + DT >= SEARCH / 2) g.face = -g.face; if (g.timer <= 0) g.state = 'return'; break;
      case 'cuff': g.timer -= DT; if (g.timer <= 0) g.state = 'return'; break;
      case 'return': {
        const hx = this.home(g), d = hx - g.x;
        if (Math.abs(d) < 0.6) { g.x = hx; g.state = m.beat ? 'patrol' : 'post'; g.timer = 0; g.lookT = 0; if (!m.beat) g.face = m.face; break; }
        g.face = Math.sign(d);
        if (!this.guardWalk(g, Math.sign(d) * Math.min(SPEED.gback * DT, Math.abs(d)))) { g.state = m.beat ? 'patrol' : 'post'; g.timer = 0; }
        break;
      }
    }
    if (g.state !== 'chase' && g.state !== 'cuff') {
      const c = this.spot(g);
      if (c) { g.state = 'chase'; g.target = c; g.lastX = c.x + BW / 2; g.lost = 0; this.emit('spot', { g, c }); }
    }
    for (const c of this.copies) {
      if (c.state === 'caught') continue;
      if (c.x < g.x + GW + 1 && c.x + BW > g.x - 1 && c.y < g.y + GH - 2 && c.y + BH > g.y + 4) { this.caught(g, c); if (this.ended) return; }
    }
  }
  caught(g, c) {
    if (c.carry) this.drop(c);
    c.state = 'caught'; c.at = this.tick; g.state = 'cuff'; g.timer = CUFF; g.target = null;
    this.emit('caught', { g, c });
    if (c.live) this.end('caught', { by: c });
  }
}

function indexActs(acts) { const m = new Map(); for (const a of acts) { if (!m.has(a.i)) m.set(a.i, []); m.get(a.i).push(a); } return m; }
