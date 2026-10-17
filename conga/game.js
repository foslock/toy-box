// Conga: the dance floor simulation. No DOM here, so the balance sim can run it in Node.
import { SPECIES } from './animals.js';

export const R = 0.5;          // dancer radius, in floor units ("steps")
export const SP = 1.06;        // spacing along the line
export const CAP = 10;         // most dancers behind the leader
const TRAIL_DS = 0.1;

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const TAU = Math.PI * 2;
const wrapA = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };

let nextId = 1;
// a dancer on the floor; `ref` points at the roster entry for your own troupe
export function mkDancer(sp, { lvl = 1, atk, hp, ref = null } = {}) {
  const S = SPECIES[sp];
  const a = atk ?? S.atk, h = hp ?? S.hp;
  return { id: nextId++, sp, lvl, atk: a, maxHp: h, hp: h, buf: 0, bufHp: 0, rolls: lvl, ref, x: 0, y: 0, slot: 0, hit: 0, join: 0, jx: 0, jy: 0, kick: 0 };
}

export class Line {
  constructor(team, x, y, heading, dancers, speed) {
    this.team = team; this.id = nextId++;
    this.dancers = dancers; this.speed = speed;
    this.h = heading; this.want = null; this.slow = 0; this.stun = 0;
    this.trail = [];
    const n = Math.ceil((dancers.length + 2) * SP / TRAIL_DS) + 4;
    for (let i = n; i >= 0; i--) this.trail.push({ x: x - Math.cos(heading) * i * TRAIL_DS, y: y - Math.sin(heading) * i * TRAIL_DS });
    dancers.forEach((d, i) => { d.slot = i * SP; });
    this.place(0);
    this.ai = { t: 0, goal: null, wob: 0 };
  }
  get head() { return this.dancers[0]; }
  place(dt) {
    const T = this.trail, ds = this.dancers;
    const k = Math.min(1, dt * 7);
    let ti = T.length - 1, acc = 0;
    let px = T[ti].x, py = T[ti].y;
    for (let i = 0; i < ds.length; i++) {
      const d = ds[i];
      d.slot += (i * SP - d.slot) * (dt ? k : 1);
      const want = d.slot;
      while (ti > 0) {
        const q = T[ti - 1], seg = Math.hypot(px - q.x, py - q.y);
        if (acc + seg >= want) { const f = seg ? (want - acc) / seg : 0; d.x = px + (q.x - px) * f; d.y = py + (q.y - py) * f; break; }
        acc += seg; px = q.x; py = q.y; ti--;
      }
      if (ti === 0) { d.x = px; d.y = py; }
    }
    // drop trail that no one is standing on any more
    const need = ds.length * SP + 3;
    let len = 0, cut = 0;
    for (let i = T.length - 1; i > 0; i--) { len += Math.hypot(T[i].x - T[i - 1].x, T[i].y - T[i - 1].y); if (len > need) { cut = i - 1; break; } }
    if (cut > 40) T.splice(0, cut);
  }
}

// how the abilities read a dancer's spot in its line
function abilityOf(line, i, depth = 0) {
  const d = line.dancers[i];
  if (d.sp !== 'parrot') return d.sp;
  if (i <= 1 || depth > 8) return null;          // copying the leader does nothing
  return abilityOf(line, i - 1, depth + 1);
}

export class Game {
  // cfg: { W, H, foes:[{ lead:{sp,atk,hp}, dancers:[{sp,lvl,atk,hp}], speed }], wild:[sp], wildEvery, maxWild, wildPool:[sp], coinEvery }
  // run: { leader:{atk,hp}, roster:[{sp,lvl,atk,hp,uid}] }
  constructor(cfg, run, { seed = 1, emit = () => {} } = {}) {
    this.cfg = cfg; this.run = run; this.emit = emit;
    this.rand = rng(seed);
    this.W = cfg.W; this.H = cfg.H;
    this.t = 0; this.beat = 0; this.bpm = 104;
    this.lines = []; this.wild = []; this.coins = []; this.fx = [];
    this.coinsGot = 0; this.joined = []; this.leadersOut = 0; this.trips = 0;
    this.over = null; this.overT = 0;
    this.cd = new Map();
    this.wildT = cfg.wildEvery || 6; this.coinT = 2;
    this.tripGrace = 0;

    // you start low and centre, heading up
    const lead = mkDancer('capy', { atk: run.leader.atk, hp: run.leader.hp });
    const ds = [lead, ...run.roster.map(e => mkDancer(e.sp, { lvl: e.lvl, atk: e.atk, hp: e.hp, ref: e }))];
    this.you = new Line('you', this.W / 2, this.H * 0.72, -Math.PI / 2, ds, 4.3);
    this.lines.push(this.you);

    (cfg.foes || []).forEach((f, i) => this.addFoe(f, i));
    for (const sp of cfg.wild || []) this.spawnWild(sp);
  }

  addFoe(f, i = 0) {
    const spots = [[0.25, 0.2, 0.4], [0.75, 0.2, 2.7], [0.5, 0.12, 1.57], [0.15, 0.45, 0], [0.85, 0.45, 3.14]];
    const s = spots[i % spots.length];
    const lead = mkDancer(f.lead.sp, { atk: f.lead.atk, hp: f.lead.hp });
    lead.boss = !!f.boss;
    const ds = [lead, ...f.dancers.map(e => mkDancer(e.sp, { lvl: e.lvl || 1, atk: e.atk, hp: e.hp }))];
    const L = new Line('foe', this.W * s[0], this.H * s[1], s[2], ds, f.speed || 3.5);
    L.boss = !!f.boss; L.ai.t = this.rand(); L.mode = f.mode || (i % 2 ? 'tail' : 'cut');
    this.lines.push(L);
    return L;
  }

  spawnWild(sp, x, y, opts = {}) {
    const r = this.rand;
    if (x === undefined) {
      for (let k = 0; k < 20; k++) {
        x = 1.5 + r() * (this.W - 3); y = 1.5 + r() * (this.H - 3);
        if (!this.lines.some(L => L.dancers.some(d => Math.hypot(d.x - x, d.y - y) < 2.5))) break;
      }
    }
    const d = opts.d || mkDancer(sp, { lvl: opts.lvl, atk: opts.atk, hp: opts.hp });
    const a = r() * TAU;
    const w = { d, x, y, vx: Math.cos(a) * 0.5, vy: Math.sin(a) * 0.5, mine: !!opts.mine, t: 0, pop: opts.pop || 0 };
    d.x = x; d.y = y;
    this.wild.push(w);
    this.emit('wild', w);
    return w;
  }

  get foes() { return this.lines.filter(L => L.team === 'foe'); }

  speedOf(L) {
    let v = L.speed;
    if (L.team === 'you' || L.team === 'foe') {
      let zip = 0;
      L.dancers.forEach((d, i) => { if (abilityOf(L, i) === 'humming') zip += 0.08 * d.lvl; });
      v *= 1 + Math.min(zip, 0.4);
    }
    if (L.slow > 0) v *= 0.5;
    return v;
  }

  tick(dt) {
    if (this.over && (this.overT += dt) > 99) return;
    this.t += dt;
    const nb = this.you ? Math.min(this.you.dancers.length - 1, 10) : 0;
    this.bpm = 104 + nb * 2.4;
    const b0 = Math.floor(this.beat);
    this.beat += dt * this.bpm / 60;
    if (Math.floor(this.beat) > b0) this.onBeat(Math.floor(this.beat));

    for (const L of this.lines) {
      if (L.team === 'foe') this.steerFoe(L, dt);
      this.move(L, dt);
    }
    for (const L of this.lines) for (const d of L.dancers) { if (d.hit > 0) d.hit -= dt; if (d.safe > 0) d.safe -= dt; if (d.join > 0) d.join = Math.max(0, d.join - dt * 2.8); if (d.kick > 0) d.kick -= dt; }
    this.moveWild(dt);
    this.pickups();
    this.clashes();
    this.tripCheck(dt);
    this.spawns(dt);
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < f.life);

    if (!this.over && !this.cfg.tutorial) {
      if (!this.you) this.end('lose');
      else if (!this.foes.length) this.end('win');
    }
  }

  end(kind) { this.over = kind; this.overT = 0; this.emit('end', kind); }

  onBeat(k) {
    const bar = k % 4 === 0;
    this.emit('beat', k);
    if (k % 4 === 3) for (const L of this.lines) for (const d of L.dancers) d.kick = 0.3;
    for (const L of this.lines) if (L.slow > 0) L.slow--;
    if (!bar) return;
    for (const L of this.lines) {
      const ds = L.dancers;
      for (let i = 0; i < ds.length; i++) {
        const ab = abilityOf(L, i), d = ds[i];
        if (ab === 'flamingo') {
          for (const j of [i - 1, i + 1]) {
            const o = ds[j];
            if (o && o.hp < o.maxHp + o.bufHp) { o.hp = Math.min(o.maxHp + o.bufHp, o.hp + d.lvl); this.fx.push({ k: 'heal', x: o.x, y: o.y, t: 0, life: 0.8 }); }
          }
        } else if (ab === 'llama') {
          let best = null, bd = 4;
          for (const M of this.lines) if (M.team !== L.team) for (const o of M.dancers) { const dd = Math.hypot(o.x - d.x, o.y - d.y); if (dd < bd) { bd = dd; best = [M, o]; } }
          if (best) {
            this.fx.push({ k: 'spit', x: d.x, y: d.y, x2: best[1].x, y2: best[1].y, t: 0, life: 0.35 });
            this.emit('spit');
            this.hurt(best[0], best[1], d.lvl, L);
          }
        }
      }
    }
    this.reap();
  }

  steer(L, dt, turn) {
    if (L.stun > 0) { L.stun -= dt; return; }
    if (L.want == null) return;
    const da = wrapA(L.want - L.h), m = turn * dt;
    L.h = wrapA(L.h + Math.max(-m, Math.min(m, da)));
  }

  move(L, dt) {
    this.steer(L, dt, L.team === 'you' ? 3.9 : (L.boss ? 1.6 : 2.5));
    const v = this.speedOf(L) * dt;
    const hd = L.head;
    let x = hd.x + Math.cos(L.h) * v, y = hd.y + Math.sin(L.h) * v;
    const m = R + 0.15;
    const blockedX = x < m || x > this.W - m, blockedY = y < m || y > this.H - m;
    x = Math.max(m, Math.min(this.W - m, x)); y = Math.max(m, Math.min(this.H - m, y));
    // slide along the wall and swing round to follow it
    if (blockedX || blockedY) {
      let tx, ty;
      if (blockedX && blockedY) { tx = x < this.W / 2 ? 1 : -1; ty = 0; }
      else if (blockedX) { tx = 0; ty = Math.abs(Math.sin(L.h)) > 0.2 ? Math.sign(Math.sin(L.h)) : (y < this.H / 2 ? 1 : -1); }
      else { ty = 0; tx = Math.abs(Math.cos(L.h)) > 0.2 ? Math.sign(Math.cos(L.h)) : (x < this.W / 2 ? 1 : -1); }
      const ta = Math.atan2(ty, tx), da = wrapA(ta - L.h), mm = 5 * dt;
      L.h = wrapA(L.h + Math.max(-mm, Math.min(mm, da)));
    }
    const T = L.trail, last = T[T.length - 1];
    if (Math.hypot(x - last.x, y - last.y) >= TRAIL_DS) T.push({ x, y }); else { last.x = x; last.y = y; }
    // the head itself always sits exactly at the front of the trail
    T[T.length - 1].x = x; T[T.length - 1].y = y;
    L.place(dt);
  }

  // ---- rival lines: chase free dancers, then go for your line's tail
  steerFoe(L, dt) {
    const ai = L.ai, hd = L.head, r = this.rand;
    ai.t -= dt;
    if (ai.t <= 0) {
      ai.t = 0.45 + r() * 0.3;
      ai.goal = null;
      let best = null, bd = L.boss ? 0 : 7;
      if (L.dancers.length < CAP + 1) for (const w of this.wild) if (!w.mine) { const dd = Math.hypot(w.x - hd.x, w.y - hd.y); if (dd < bd) { bd = dd; best = w; } }
      if (best) ai.goal = { x: best.x, y: best.y };
      else if (this.you) {
        const Y = this.you.dancers, yh = this.you.head;
        if (L.mode === 'cut') {
          // swing in across the path ahead of your capybara, so it runs into this line
          const ahead = 2.5 + Math.hypot(yh.x - hd.x, yh.y - hd.y) * 0.45;
          ai.goal = { x: yh.x + Math.cos(this.you.h) * ahead, y: yh.y + Math.sin(this.you.h) * ahead };
        } else {
          // go for the soft back half of your line, with a little lead
          const j = ai.pick ?? (ai.pick = Math.floor(Y.length * (0.4 + r() * 0.6)));
          const o = Y[Math.min(j, Y.length - 1)];
          ai.goal = { x: o.x + Math.cos(this.you.h) * 1.5, y: o.y + Math.sin(this.you.h) * 1.5 };
          if (r() < 0.15) ai.pick = null;
        }
      }
      ai.wob = (r() - 0.5) * 0.9;
    }
    let gx = this.W / 2, gy = this.H / 2;
    if (ai.goal) { gx = ai.goal.x; gy = ai.goal.y; }
    let want = Math.atan2(gy - hd.y, gx - hd.x) + ai.wob;
    // keep off the walls
    const m = 1.6;
    let ax = 0, ay = 0;
    if (hd.x < m) ax += 1; if (hd.x > this.W - m) ax -= 1; if (hd.y < m) ay += 1; if (hd.y > this.H - m) ay -= 1;
    // and off each other: rival lines spread out instead of piling into one mob
    for (const M of this.lines) if (M !== L && M.team === 'foe') for (const o of M.dancers) {
      const dx = hd.x - o.x, dy = hd.y - o.y, d = Math.hypot(dx, dy);
      if (d < 2.6 && d > 0.01) { const k = (2.6 - d) / 2.6 * 1.4; ax += dx / d * k; ay += dy / d * k; }
    }
    if (ax || ay) want = Math.atan2(Math.sin(want) + ay * 1.5, Math.cos(want) + ax * 1.5);
    L.want = want;
  }

  moveWild(dt) {
    const r = this.rand;
    for (const w of this.wild) {
      w.t += dt;
      if (w.pop > 0) w.pop -= dt;
      if (r() < dt * 0.4) { const a = r() * TAU; w.vx = Math.cos(a) * 0.5; w.vy = Math.sin(a) * 0.5; }
      const sp = w.pop > 0 ? 6 * w.pop : 1;
      w.x += w.vx * dt * sp; w.y += w.vy * dt * sp;
      if (w.x < 1 || w.x > this.W - 1) { w.vx = -w.vx; w.x = Math.max(1, Math.min(this.W - 1, w.x)); }
      if (w.y < 1 || w.y > this.H - 1) { w.vy = -w.vy; w.y = Math.max(1, Math.min(this.H - 1, w.y)); }
      w.d.x = w.x; w.d.y = w.y;
    }
  }

  pickups() {
    for (const L of this.lines) {
      const hd = L.head;
      for (let i = this.wild.length - 1; i >= 0; i--) {
        const w = this.wild[i];
        if (w.pop > 0.25) continue;
        if (w.mine && L.team !== 'you') continue;
        if (Math.hypot(w.x - hd.x, w.y - hd.y) > 1.15) continue;
        this.wild.splice(i, 1);
        this.join(L, w);
      }
      if (L.team === 'you') for (let i = this.coins.length - 1; i >= 0; i--) {
        const c = this.coins[i];
        if (Math.hypot(c.x - hd.x, c.y - hd.y) < 1.0) { this.coins.splice(i, 1); this.coinsGot++; this.emit('coin', c); this.fx.push({ k: 'coin', x: c.x, y: c.y, t: 0, life: 0.7 }); }
      }
    }
  }

  join(L, w) {
    const d = w.d;
    if (L.team === 'you') {
      const R0 = this.run.roster;
      if (L.dancers.length >= CAP + 1) { this.coinsGot += 2; this.emit('full', w); this.fx.push({ k: 'coin', x: w.x, y: w.y, t: 0, life: 0.7, n: 2 }); return; }
      if (!w.mine) {
        const e = { sp: d.sp, lvl: d.lvl, atk: d.atk, hp: d.maxHp, uid: d.id };
        if (R0.length < CAP) { R0.push(e); this.joined.push(e); d.ref = e; }
      }
    }
    d.join = 1; d.jx = w.x; d.jy = w.y;
    const last = L.dancers[L.dancers.length - 1];
    d.slot = last ? last.slot + SP : 0;
    d.x = last.x; d.y = last.y;
    d.hp = Math.max(d.hp, 1);
    L.dancers.push(d);
    // when the line grows, its trail has to reach back far enough
    const T = L.trail, first = T[0];
    for (let k = 0; k < 12; k++) T.unshift({ x: first.x, y: first.y });
    this.emit('join', { line: L, d, mine: w.mine });
  }

  // ---- contact between lines
  clashes() {
    const ls = this.lines;
    for (let a = 0; a < ls.length; a++) for (let b = a + 1; b < ls.length; b++) {
      const A = ls[a], B = ls[b];
      if (A.team === B.team) continue;
      for (let i = 0; i < A.dancers.length; i++) {
        const p = A.dancers[i];
        for (let j = 0; j < B.dancers.length; j++) {
          const q = B.dancers[j];
          if (p.hp <= 0) break;
          if (q.hp <= 0) continue;
          const dx = q.x - p.x, dy = q.y - p.y;
          if (dx * dx + dy * dy > 4 * R * R) continue;
          const key = p.id < q.id ? p.id + ':' + q.id : q.id + ':' + p.id;
          const last = this.cd.get(key);
          if (last !== undefined && this.t - last < 0.75) continue;
          this.cd.set(key, this.t);
          this.clash(A, i, B, j);
        }
      }
    }
    this.reap();
    if (this.cd.size > 400) for (const [k, v] of this.cd) if (this.t - v > 2) this.cd.delete(k);
  }

  atkOf(L, i) {
    const d = L.dancers[i];
    let a = d.atk + d.buf;
    if (abilityOf(L, i) === 'bee' && i >= 1 && i <= 3) a += 2 * d.lvl;
    return a;
  }

  clash(A, i, B, j) {
    const p = A.dancers[i], q = B.dancers[j];
    const ap = this.atkOf(A, i), aq = this.atkOf(B, j);
    this.hurt(B, q, ap, A);
    this.hurt(A, p, aq, B);
    this.fx.push({ k: 'clash', x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, t: 0, life: 0.45 });
    this.emit('clash', { A, B, p, q });
    for (const [L, k, M, o, m] of [[A, i, B, q, j], [B, j, A, p, i]]) {
      const ab = abilityOf(L, k), d = L.dancers[k];
      if (ab === 'frog' && L.dancers[k + 1]) { L.dancers[k + 1].buf += d.lvl; this.fx.push({ k: 'hype', x: L.dancers[k + 1].x, y: L.dancers[k + 1].y, t: 0, life: 0.7 }); }
      if (ab === 'bull' && M.dancers[m + 1]) this.hurt(M, M.dancers[m + 1], d.lvl, L);
      if (ab === 'sloth') { M.slow = Math.max(M.slow, 2 * d.lvl); this.fx.push({ k: 'hug', x: o.x, y: o.y, t: 0, life: 0.8 }); }
    }
    // heads bounce off what they hit
    for (const [L, k, o] of [[A, i, q], [B, j, p]]) {
      if (k !== 0) continue;
      const h = L.head, away = Math.atan2(h.y - o.y, h.x - o.x);
      L.h = wrapA(L.h + wrapA(away - L.h) * 0.75);
      L.stun = L.team === 'you' ? 0.12 : 0.35;
    }
  }

  hurt(L, d, n, by) {
    if (n <= 0 || d.hp <= 0) return;
    if (d.rolls > 0 && abilityOf(L, L.dancers.indexOf(d)) === 'armadillo') { d.rolls--; this.fx.push({ k: 'block', x: d.x, y: d.y, t: 0, life: 0.6 }); return; }
    const ds = L.dancers, tail = ds.length - 1;
    if (tail >= 1 && abilityOf(L, tail) === 'tortoise') n = Math.max(1, n - ds[tail].lvl);
    // your capybara gets a moment to recover after each hit
    if (L.team === 'you' && d === L.head) {
      if (d.safe > 0) return;
      d.safe = 0.6;
      if (this.cfg.tutorial) n = Math.min(n, d.hp - 1);
    }
    // a rival leader left dancing alone is flustered and takes double
    if (L.team === 'foe' && d === L.head && L.dancers.length === 1) n *= 2;
    d.hit = 0.25;
    if (n <= 0) return;
    d.hp -= n;
    this.fx.push({ k: 'dmg', x: d.x, y: d.y, n, t: 0, life: 0.8, team: L.team });
    void by;
  }

  // knocked-out dancers leave; a fallen rival leader breaks up its line
  reap() {
    let again = true, guard = 0;
    while (again && guard++ < 20) {
      again = false;
      for (const L of [...this.lines]) {
        const ds = L.dancers;
        for (let i = ds.length - 1; i >= 0; i--) {
          const d = ds[i];
          if (d.hp > 0) continue;
          ds.splice(i, 1);
          again = true;
          this.fx.push({ k: 'ko', x: d.x, y: d.y, t: 0, life: 1.1, team: L.team, sp: d.sp });
          this.emit('ko', { line: L, d, lead: i === 0 });
          const ab = d.sp === 'parrot' ? null : d.sp;
          if (ab === 'skunk') {
            this.fx.push({ k: 'stink', x: d.x, y: d.y, t: 0, life: 1.0 });
            for (const M of this.lines) if (M.team !== L.team) for (const o of M.dancers) if (Math.hypot(o.x - d.x, o.y - d.y) < 3) this.hurt(M, o, 2 * d.lvl, L);
          }
          ds.forEach((o, k) => { if (abilityOf(L, k) === 'monkey') { o.buf += 1; o.bufHp += o.lvl; o.hp += o.lvl; this.fx.push({ k: 'hype', x: o.x, y: o.y, t: 0, life: 0.7 }); } });
          if (i === 0) { this.leaderDown(L); break; }
        }
      }
    }
  }

  leaderDown(L) {
    this.lines = this.lines.filter(M => M !== L);
    if (L.team === 'you') { this.you = null; this.emit('youDown', L); return; }
    this.leadersOut++;
    for (const d of L.dancers) {
      d.hp = Math.max(1, d.hp); d.buf = 0;
      const w = this.spawnWild(d.sp, d.x, d.y, { d, pop: 0.5 });
      const a = this.rand() * TAU; w.vx = Math.cos(a); w.vy = Math.sin(a);
    }
    this.emit('scatter', L);
  }

  // running into your own line trips everyone from there back
  tripCheck(dt) {
    const L = this.you;
    if (!L) return;
    if (this.tripGrace > 0) { this.tripGrace -= dt; return; }
    const hd = L.head, ds = L.dancers;
    for (let i = 4; i < ds.length; i++) {
      const d = ds[i];
      if (Math.hypot(d.x - hd.x, d.y - hd.y) < 0.8) {
        const off = ds.splice(i);
        this.trips++;
        for (const o of off) { const w = this.spawnWild(o.sp, o.x, o.y, { d: o, mine: true, pop: 0.4 }); const a = this.rand() * TAU; w.vx = Math.cos(a); w.vy = Math.sin(a); }
        this.fx.push({ k: 'trip', x: d.x, y: d.y, t: 0, life: 1.2 });
        this.emit('trip', off.length);
        this.tripGrace = 0.8;
        return;
      }
    }
  }

  spawns(dt) {
    const c = this.cfg;
    if (c.wildEvery && (this.wildT -= dt) <= 0) {
      this.wildT = c.wildEvery;
      if (this.wild.filter(w => !w.mine).length < (c.maxWild || 3) && c.wildPool?.length) this.spawnWild(c.wildPool[Math.floor(this.rand() * c.wildPool.length)]);
    }
    if (c.coinEvery && (this.coinT -= dt) <= 0) {
      this.coinT = c.coinEvery;
      if (this.coins.length < 3) {
        const r = this.rand;
        this.coins.push({ x: 1.5 + r() * (this.W - 3), y: 1.5 + r() * (this.H - 3), t: this.t });
      }
    }
  }
}
