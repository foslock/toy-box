// The whole game, no DOM: the crowd, the bell, the host's eye, and the duel if it comes to that.
import { rng, pathAt, segDist } from './levels.js';

const TAU = Math.PI * 2;
const wrap = a => { a = (a + Math.PI) % TAU; return (a < 0 ? a + TAU : a) - Math.PI; };
const turn = (from, to, max) => { const d = wrap(to - from); return from + Math.max(-max, Math.min(max, d)); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const PLAYER_SPEED = 38;
export const BODY_R = 9;
export const STAB_RANGE = 40;

export class Game {
  constructor(level, opts = {}) {
    this.L = level;
    this.R = rng(opts.seed ?? 1);
    this.tutorial = !!opts.tutorial;
    this.t = 0;
    this.events = [];
    this.outcome = null;
    this.mode = 'sneak';
    this.input = { mx: 0, my: 0, gesture: false, stab: false };
    this.susMult = opts.susMult ?? 1;
    this.bellsOn = !this.tutorial;
    this.hostOn = !this.tutorial;
    this.reasons = [];
    this.peakSus = 0;

    const L = level, R = this.R;
    this.player = { x: L.start.x, y: L.start.y, face: 0, moving: false, still: 0, gest: false, gestT: 0, walk: 0, dist: 0,
      onPathT: 0, roll: 0, rollCd: 0, rx: 0, ry: 0, lunge: 0, hit: 0 };

    // spread the crowd over the paths by weight
    this.npcs = [];
    const w = L.paths.map(p => p.L * p.crowd), tot = w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < L.crowd; i++) {
      let r = R() * tot, k = 0;
      while (r > w[k] && k < w.length - 1) r -= w[k++];
      const p = L.paths[k];
      let s = R() * p.L;
      const at = pathAt(p, s);
      if (Math.hypot(at.x - L.start.x, at.y - L.start.y) < 26) s = (s + 40) % p.L;
      const n = { path: p, s, dir: R() < 0.5 ? 1 : -1, lane: 5 + R() * 8, speed: 27 + R() * 6, state: 'walk', timer: 0,
        x: 0, y: 0, face: 0, walk: R() * 10, kneelAt: 0, idleFace: 0, look: R() * 10, dead: 0, gest: 0 };
      this.placeNpc(n, 1);
      if (R() < 0.25) { n.state = 'idle'; n.timer = 1 + R() * 4; n.idleFace = n.face + (R() < 0.5 ? 1.57 : -1.57); }
      this.npcs.push(n);
    }

    const H = L.host;
    this.host = { x: L.hostStart.x, y: L.hostStart.y, face: -Math.PI / 2, tface: -Math.PI / 2, wp: 0, state: 'walk', timer: 0,
      sus: 0, victims: 0, killCd: 8, rev: 0, back: false, target: null, glanceCd: 9 + R() * 4, lookC: 0, prev: 'walk', speed: H.speed,
      half: H.half, range: H.range, hp: 3, swing: 0, walk: 0, dying: 0, entered: false, curious: 0 };
    this.bell = { state: 'wait', t: L.bell.first, ring: 0, after: 9 };
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  placeNpc(n, snap) {
    const at = pathAt(n.path, n.s);
    const tx = at.dx * n.dir, ty = at.dy * n.dir;
    const x = at.x - ty * n.lane, y = at.y + tx * n.lane;
    if (snap) { n.x = x; n.y = y; }
    else { n.x += (x - n.x) * 0.12; n.y += (y - n.y) * 0.12; }
    n.tf = Math.atan2(ty, tx);
    if (snap) n.face = n.tf;
  }

  // ---- geometry
  blocked(x, y, r) {
    const L = this.L;
    if (x < r || y < r || x > L.W - r || y > L.H - r) return true;
    for (const w of L.walls) if (x > w.x - r && x < w.x + w.w + r && y > w.y - r && y < w.y + w.h + r) return true;
    for (const c of L.circles) if (Math.hypot(x - c.x, y - c.y) < c.r + r) return true;
    for (const s of L.smalls) if (Math.abs(x - s.x) < s.w / 2 + r - 2 && Math.abs(y - s.y) < s.h / 2 + r - 2) return true;
    return false;
  }
  moveBody(b, dx, dy, r) {
    if (!this.blocked(b.x + dx, b.y + dy, r)) { b.x += dx; b.y += dy; return true; }
    let moved = false;
    if (!this.blocked(b.x + dx, b.y, r)) { b.x += dx; moved = true; }
    if (!this.blocked(b.x, b.y + dy, r)) { b.y += dy; moved = true; }
    return moved;
  }
  los(ax, ay, bx, by) {
    const L = this.L;
    for (const w of L.walls) {
      if (!w.sight) continue;
      let t0 = 0, t1 = 1;
      const dx = bx - ax, dy = by - ay;
      const clip = (p, q) => { if (p === 0) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
      if (clip(-dx, ax - w.x) && clip(dx, w.x + w.w - ax) && clip(-dy, ay - w.y) && clip(dy, w.y + w.h - ay) && t0 < t1) return false;
    }
    for (const c of L.circles) if (c.sight && segDist(c.x, c.y, ax, ay, bx, by) < c.r - 2) return false;
    return true;
  }
  pathDist(x, y) {
    let d = 1e9;
    for (const s of this.L.segs) d = Math.min(d, segDist(x, y, s[0], s[1], s[2], s[3]));
    return d;
  }
  // 1 = squarely seen, 0.5 = sensed close by, 0 = not seen
  sees(x, y) {
    const h = this.host;
    if (!this.hostOn || !h.entered) return 0;
    const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy);
    if (d < 50) return this.los(h.x, h.y, x, y) ? (Math.abs(wrap(Math.atan2(dy, dx) - h.face)) < h.half ? 1 : 0.5) : 0;
    if (d > h.range) return 0;
    if (Math.abs(wrap(Math.atan2(dy, dx) - h.face)) > h.half) return 0;
    return this.los(h.x, h.y, x, y) ? 1 : 0;
  }
  canStab() {
    const p = this.player, h = this.host;
    if (!this.hostOn || !h.entered || this.outcome || p.roll > 0) return false;
    const dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy);
    if (this.mode === 'duel') return d < STAB_RANGE + 6;
    if (d > STAB_RANGE) return false;
    return Math.abs(wrap(Math.atan2(dy, dx) - h.face)) > 2.0;
  }
  bellPhase() { return this.bell.state; }

  ringBell(soon = 2.2) { this.bell.state = 'wait'; this.bell.t = soon; }

  // ---- step
  step(dt) {
    if (this.outcome && this.mode !== 'over') { this.mode = 'over'; }
    this.t += dt;
    this.stepBell(dt);
    this.stepCrowd(dt);
    if (this.mode === 'duel') this.stepDuel(dt);
    else if (this.mode === 'sneak') { this.stepPlayer(dt); this.stepHost(dt); this.judge(dt); }
    else this.stepAfter(dt);
    this.input.stab = false;
  }

  stepBell(dt) {
    const b = this.bell, L = this.L;
    b.after += dt;
    if (!this.bellsOn) return;
    b.t -= dt;
    if (b.state === 'wait' && b.t <= 2.2 && !b.warned) { b.warned = true; this.emit('warn'); }
    if (b.state === 'wait' && b.t <= 0) {
      b.state = 'ring'; b.ring = 0; b.t = L.bell.dur; b.warned = false;
      this.emit('toll');
      for (const n of this.npcs) n.kneelAt = 0.15 + this.R() * 0.55;
    } else if (b.state === 'ring') {
      b.ring += dt;
      if (b.t <= 0) {
        b.state = 'wait'; b.after = 0;
        b.t = L.bell.every[0] + this.R() * (L.bell.every[1] - L.bell.every[0]);
        for (const n of this.npcs) n.kneelAt = this.R() * 0.5;
      }
    }
  }

  stepCrowd(dt) {
    const ring = this.bell.state === 'ring';
    for (const n of this.npcs) {
      if (n.state === 'dead') { n.dead += dt; continue; }
      if (n.state === 'doomed') { n.gest = Math.max(0, n.gest - dt * 3); continue; }
      n.look += dt;
      if (ring) {
        n.kneelAt -= dt;
        if (n.kneelAt <= 0) n.gest = Math.min(1, n.gest + dt * 4);
        continue;
      }
      if (n.gest > 0) { n.kneelAt -= dt; if (n.kneelAt <= 0) n.gest = Math.max(0, n.gest - dt * 3); continue; }
      if (n.state === 'idle') {
        n.timer -= dt;
        n.face = turn(n.face, n.idleFace + Math.sin(n.look * 0.7) * 0.5, dt * 2);
        if (n.timer <= 0) n.state = 'walk';
        continue;
      }
      const p = n.path, s0 = n.s;
      n.s += n.speed * n.dir * dt;
      n.walk += dt * n.speed / 9;
      if (!p.closed && (n.s <= 0 || n.s >= p.L)) { n.s = clamp(n.s, 0, p.L); n.dir *= -1; }
      // pause at a post now and then
      for (const ps of p.posts) {
        const a = Math.min(s0, n.s), b = Math.max(s0, n.s);
        let crossed = ps > a && ps <= b;
        if (p.closed) { const sa = ((s0 % p.L) + p.L) % p.L, sb = ((n.s % p.L) + p.L) % p.L; crossed = Math.abs(sb - sa) < 50 && ps > Math.min(sa, sb) && ps <= Math.max(sa, sb); }
        if (crossed && this.R() < p.postChance) {
          n.state = 'idle'; n.timer = p.postDur[0] + this.R() * (p.postDur[1] - p.postDur[0]);
          n.idleFace = n.face + (this.R() < 0.5 ? 1.57 : -1.57);
          break;
        }
      }
      if (this.R() < dt * 0.02) n.dir *= -1; // somebody forgot something
      this.placeNpc(n, 0);
      n.face = turn(n.face, n.tf, dt * 5);
    }
  }

  stepPlayer(dt) {
    const p = this.player, I = this.input;
    p.gest = !!I.gesture;
    p.gestT = p.gest ? p.gestT + dt : 0;
    let mx = I.mx, my = I.my;
    const m = Math.hypot(mx, my);
    if (p.gest || m < 0.1) { mx = 0; my = 0; }
    else if (m > 1) { mx /= m; my /= m; }
    const sp = PLAYER_SPEED;
    let moved = false;
    if (mx || my) {
      const ox = p.x, oy = p.y;
      moved = this.moveBody(p, mx * sp * dt, my * sp * dt, BODY_R);
      const d = Math.hypot(p.x - ox, p.y - oy);
      p.dist += d; p.walk += d / 9;
      if (d > 0.01) p.face = turn(p.face, Math.atan2(p.y - oy, p.x - ox), dt * 9);
      moved = d > sp * dt * 0.3;
    }
    p.moving = moved;
    p.still = moved ? 0 : p.still + dt;
    if (moved && this.pathDist(p.x, p.y) < 24) p.onPathT += dt;
    if (I.stab && this.canStab()) this.backstab();
  }

  backstab() {
    const p = this.player, h = this.host;
    p.lunge = 0.35;
    h.state = 'dying'; h.dying = 0;
    this.outcome = 'win';
    this.emit('stab');
  }

  stepHost(dt) {
    const h = this.host, L = this.L, p = this.player;
    if (!this.hostOn) return;
    const ring = this.bell.state === 'ring';
    h.walk += 0;
    const habit = L.habit;
    if (!h.entered && h.y < L.H - 30) h.entered = true;
    if (!h.entered) h.entered = h.y < L.H - 20;

    // devout: stop and watch the crowd through every bell
    const devoutWatch = habit === 'devout' && ring;
    h.half = devoutWatch ? 1.3 : L.host.half;
    h.range = devoutWatch ? L.host.range + 50 : L.host.range;

    // a curious host stops what they're doing and looks at you
    if (h.state !== 'windup' && h.state !== 'dying') {
      if (h.sus > 55 && h.state !== 'curious') { h.prev = h.state === 'curious' ? 'walk' : 'walk'; h.state = 'curious'; this.emit('curious'); }
      else if (h.state === 'curious' && h.sus < 28) { h.state = 'walk'; this.emit('calm'); }
    }

    let tr = 2.6;
    switch (h.state) {
      case 'walk': {
        if (devoutWatch) { h.state = 'watch'; h.timer = 0; h.lookC = h.face; break; }
        if (h.rev > 0) { h.rev -= dt; if (h.rev <= 0) { h.wp = h.wp + 1 >= L.route.length ? L.loop : h.wp + 1; } }
        const w = L.route[h.wp];
        const dx = w[0] - h.x, dy = w[1] - h.y, d = Math.hypot(dx, dy);
        const sp = h.speed * dt;
        if (d < sp + 1) {
          h.x = w[0]; h.y = w[1];
          if (h.rev > 0) h.wp = h.wp - 1 < L.loop ? L.route.length - 1 : h.wp - 1;
          else h.wp = h.wp + 1 >= L.route.length ? L.loop : h.wp + 1;
          if (w[2] && !(h.rev > 0)) { h.state = 'look'; h.timer = w[2]; h.lookC = h.face; h.lookT = 0; }
        } else {
          h.x += dx / d * sp; h.y += dy / d * sp; h.walk += sp / 10;
          h.tface = Math.atan2(dy, dx);
        }
        h.killCd -= dt;
        if (h.killCd <= 0 && h.entered) this.pickVictim();
        if (habit === 'impatient' && h.entered && h.state === 'walk') {
          h.glanceCd -= dt;
          if (h.glanceCd <= 0) { h.state = 'tell'; h.timer = 0.6; h.back = true; this.emit('tell'); }
        }
        if (habit === 'devout' && h.entered && h.state === 'walk') {
          h.glanceCd -= dt;
          if (h.glanceCd <= 0) { h.state = 'tell'; h.timer = 1; h.bless = true; this.emit('tell'); }
        }
        if (habit === 'glance' && h.entered && h.state === 'walk') {
          h.glanceCd -= dt;
          if (h.glanceCd <= 0) { h.state = 'tell'; h.timer = 0.7; this.emit('tell'); }
        }
        break;
      }
      case 'look':
        h.timer -= dt; h.lookT += dt;
        h.tface = h.lookC + Math.sin(h.lookT * 1.8) * 2.1;
        if (h.timer <= 0) h.state = 'walk';
        break;
      case 'watch':
        h.timer += dt;
        h.tface = h.lookC + Math.sin(h.timer * 1.1) * 1.4;
        if (!ring) h.state = 'walk';
        break;
      case 'tell':
        h.timer -= dt;
        if (h.timer <= 0 && h.back) {
          // turn round and walk back the way they came for a while
          h.back = false; h.state = 'walk'; h.rev = 5 + this.R() * 4; h.glanceCd = 14 + this.R() * 8;
          h.wp = h.wp - 1 < L.loop ? L.route.length - 1 : h.wp - 1;
        } else if (h.timer <= 0 && h.bless) {
          h.bless = false; h.state = 'bless'; h.timer = 3.2; h.lookC = h.face;
        } else if (h.timer <= 0) { h.state = 'glance'; h.timer = 1.5; h.lookC = h.face + Math.PI; }
        break;
      case 'glance':
        h.timer -= dt; h.tface = h.lookC; tr = 4;
        if (h.timer <= 0) { h.state = 'walk'; h.glanceCd = 8 + this.R() * 5; }
        break;
      case 'bless': {
        // turn round and sweep a blessing over everyone behind
        h.timer -= dt;
        const u = 1 - h.timer / 3.2;
        h.tface = h.lookC + Math.PI + Math.sin(u * Math.PI * 2) * 1.1; tr = 3;
        if (h.timer <= 0) { h.state = 'walk'; h.glanceCd = 11 + this.R() * 6; }
        break;
      }
      case 'curious':
        h.tface = Math.atan2(p.y - h.y, p.x - h.x); tr = 1.8;
        break;
      case 'windup': {
        h.timer -= dt;
        const tg = h.target;
        const tx = tg === 'player' ? p.x : tg.x, ty = tg === 'player' ? p.y : tg.y;
        h.tface = Math.atan2(ty - h.y, tx - h.x); tr = 5;
        if (h.timer <= 0) {
          h.swing = 0.3;
          this.emit('slash', { x: tx, y: ty });
          if (tg === 'player') {
            const d = Math.hypot(p.x - h.x, p.y - h.y);
            if (d < 62 && Math.abs(wrap(Math.atan2(p.y - h.y, p.x - h.x) - h.face)) < 1) {
              this.foundOut('You raised your guard when they swung. Hollow soldiers don’t.');
              return;
            }
            h.sus = Math.min(99, h.sus + 40); // a hollow that dodges is no hollow
          } else {
            tg.state = 'dead'; tg.dead = 0; tg.gest = 0; h.victims++;
            this.emit('kill', { x: tg.x, y: tg.y });
          }
          h.target = null; h.state = 'walk';
          h.killCd = (habit === 'impatient' ? 4 : 6) + this.R() * 4;
        }
        break;
      }
      case 'dying':
        h.dying += dt;
        return;
    }
    h.swing = Math.max(0, h.swing - dt);
    h.face = turn(h.face, h.tface, tr * dt);
  }

  pickVictim() {
    const h = this.host, p = this.player;
    let best = null, bd = 76;
    const consider = (o, x, y) => {
      const d = Math.hypot(x - h.x, y - h.y);
      if (d < bd && Math.abs(wrap(Math.atan2(y - h.y, x - h.x) - h.face)) < 0.7 && this.los(h.x, h.y, x, y)) { bd = d; best = o; }
    };
    for (const n of this.npcs) if (n.state !== 'dead' && n.state !== 'doomed') consider(n, n.x, n.y);
    consider('player', p.x, p.y);
    if (!best) { this.host.killCd = 0.4; return; }
    h.state = 'windup'; h.timer = best === 'player' ? 0.9 : 0.6; h.target = best;
    if (best !== 'player') { best.state = 'doomed'; best.gest = 0; }
    this.emit('windup', { player: best === 'player' });
  }

  // what the host would object to, if they saw it
  judge(dt) {
    const p = this.player, h = this.host, L = this.L, b = this.bell, G = L.gesture;
    const seen = this.sees(p.x, p.y);
    const out = [];
    const ring = b.state === 'ring';
    const graceRing = ring && b.ring > 0.9 && b.t > 0.35;
    if (graceRing && !p.gest) out.push([G.not, 70]);
    if (p.gest && p.gestT > 0.25 && !ring && b.after > 0.9) out.push([G.alone, 55]);
    if (!p.gest && !ring && seen === 1) {
      const pd = this.pathDist(p.x, p.y);
      if (pd > 26) out.push(['OFF THE PATH', 20 + Math.min(25, (pd - 26) * 0.5)]);
      if (p.still > 1.2 && !this.nearIdle(p.x, p.y)) out.push(['STANDING ALONE', L.habit === 'impatient' ? 40 : 20]);
      if (p.moving && h.entered) {
        const dx = h.x - p.x, dy = h.y - p.y, d = Math.hypot(dx, dy);
        if (d < 210 && Math.abs(wrap(Math.atan2(dy, dx) - p.face)) < 0.45) out.push(['WALKING AT THEM', 10 + 34 * (1 - d / 210)]);
      }
    }
    this.reasons = seen ? out : [];
    this.wouldBe = seen === 1 ? out : this.whatIf();
    this.seen = seen;
    let gain = 0;
    for (const r of this.reasons) gain += r[1];
    // a host who has stopped to look round is looking for something
    const wary = h.state === 'glance' || h.state === 'bless' || h.state === 'look' || h.state === 'watch' || h.state === 'curious';
    gain *= seen * this.susMult * (wary ? 1.5 : 1);
    if (gain > 0) h.sus += gain * dt;
    else h.sus -= (seen ? 7 : 11) * dt;
    h.sus = clamp(h.sus, 0, 100);
    this.peakSus = Math.max(this.peakSus, h.sus);
    if (h.sus >= 100) this.foundOut(`${L.host.name} saw you ${this.reasons.map(r => r[0].toLowerCase()).join(', ').replace(/^not /, 'not ')}.`);
  }
  // the same checks with nobody watching, so the tutorial can point at what would give you away
  whatIf() {
    const p = this.player, L = this.L, b = this.bell, G = L.gesture, out = [];
    const ring = b.state === 'ring';
    if (ring && b.ring > 0.9 && b.t > 0.35 && !p.gest) out.push([G.not, 70]);
    if (p.gest && p.gestT > 0.25 && !ring && b.after > 0.9) out.push([G.alone, 55]);
    if (!p.gest && !ring) {
      if (this.pathDist(p.x, p.y) > 26) out.push(['OFF THE PATH', 14]);
      if (p.still > 1.4 && !this.nearIdle(p.x, p.y)) out.push(['STANDING ALONE', 16]);
    }
    return out;
  }
  nearIdle(x, y) {
    for (const n of this.npcs) {
      if (n.state !== 'idle' && n.gest < 0.5) continue;
      if (Math.hypot(n.x - x, n.y - y) < 46) return true;
    }
    return false;
  }

  foundOut(why) {
    const h = this.host, p = this.player;
    this.mode = 'duel';
    this.why = why;
    h.sus = 100; h.state = 'chase'; h.timer = 0.9; h.hp = 3; h.target = null;
    p.gest = false;
    this.emit('found');
  }

  // ---- the duel: they swing, you roll, you hit them while they recover
  stepDuel(dt) {
    const p = this.player, h = this.host, I = this.input;
    p.rollCd -= dt; p.hit = Math.max(0, p.hit - dt); p.lunge = Math.max(0, p.lunge - dt);
    if (I.gesture && !p.prevG && p.rollCd <= 0 && p.roll <= 0) {
      let mx = I.mx, my = I.my, m = Math.hypot(mx, my);
      if (m < 0.1) { mx = Math.cos(p.face); my = Math.sin(p.face); m = 1; }
      p.rx = mx / m; p.ry = my / m; p.roll = 0.32; p.rollCd = 0.55;
      this.emit('roll');
    }
    p.prevG = I.gesture;
    if (p.roll > 0) {
      p.roll -= dt;
      this.moveBody(p, p.rx * 330 * dt, p.ry * 330 * dt, BODY_R);
      p.face = Math.atan2(p.ry, p.rx); p.walk += dt * 20;
    } else {
      let mx = I.mx, my = I.my;
      const m = Math.hypot(mx, my);
      if (m > 1) { mx /= m; my /= m; }
      if (m > 0.1) {
        const ox = p.x, oy = p.y;
        this.moveBody(p, mx * 70 * dt, my * 70 * dt, BODY_R);
        p.walk += Math.hypot(p.x - ox, p.y - oy) / 9;
        p.face = turn(p.face, Math.atan2(my, mx), dt * 12);
      }
    }
    if (I.stab) {
      p.lunge = 0.2;
      const d = Math.hypot(p.x - h.x, p.y - h.y);
      const behind = Math.abs(wrap(Math.atan2(p.y - h.y, p.x - h.x) - h.face)) > 2.0;
      if (d < STAB_RANGE + 6 && (h.state === 'recover' || h.state === 'stagger' || behind)) {
        h.hp--; this.emit('hit', { x: h.x, y: h.y });
        if (h.hp <= 0) { h.state = 'dying'; h.dying = 0; this.outcome = 'win'; this.emit('stab'); return; }
        h.state = 'stagger'; h.timer = 0.55;
        const k = 30 / (d || 1); this.moveBody(h, (h.x - p.x) * k, (h.y - p.y) * k, BODY_R + 2);
      } else if (d < STAB_RANGE + 20) {
        // parried, and they answer at once
        this.emit('parry');
        h.state = 'windup'; h.timer = 0.28;
      }
    }
    const dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy), toP = Math.atan2(dy, dx);
    let tr = 5;
    switch (h.state) {
      case 'chase':
        h.timer -= dt;
        h.tface = toP;
        if (d > 46) { this.moveBody(h, dx / d * 74 * dt, dy / d * 74 * dt, BODY_R + 2); h.walk += 74 * dt / 10; }
        if (d < 60 && h.timer <= 0) { h.state = 'windup'; h.timer = 0.38 + this.R() * 0.3; this.emit('windup', { player: true }); }
        break;
      case 'windup':
        h.timer -= dt; h.tface = toP; tr = 3;
        if (h.timer <= 0) {
          h.state = 'recover'; h.timer = h.combo ? 0.6 : 0.42; h.swing = 0.3;
          this.emit('slash', { x: p.x, y: p.y });
          if (d < 66 && Math.abs(wrap(toP - h.face)) < 1.0 && p.roll <= 0) {
            p.hit = 1; this.outcome = 'lose'; this.emit('cut');
          }
        }
        break;
      case 'recover':
        h.timer -= dt; tr = 0.8;
        if (h.timer <= 0) {
          // sometimes a second swing straight after the first
          if (!h.combo && d < 70 && this.R() < 0.45) { h.combo = true; h.state = 'windup'; h.timer = 0.32; this.emit('windup', { player: true }); }
          else { h.combo = false; h.state = 'chase'; h.timer = 0.2; }
        }
        break;
      case 'stagger': h.timer -= dt; tr = 0; if (h.timer <= 0) { h.state = 'chase'; h.timer = 0.1; } break;
    }
    h.swing = Math.max(0, h.swing - dt);
    h.face = turn(h.face, h.tface, tr * dt);
  }

  stepAfter(dt) {
    const h = this.host, p = this.player;
    p.lunge = Math.max(0, p.lunge - dt);
    if (h.state === 'dying') h.dying += dt;
    h.swing = Math.max(0, h.swing - dt);
  }
}
