// Needle: the simulation, with no DOM, canvas or audio, so it runs the same in the page and in a Node sim.
//
// The record turns at a steady rate. Dust walks along the spiral groove (in the record's own frame) from the
// rim toward the label; the record carries it round past every tower, once a revolution. Towers sit still in
// the turntable's frame and fire when the song's sixteenth-note clock lands on a hit in their part.
import { SONGS, RECORDS, DUST, PARTS, PART_KEYS, R_OUT, R_IN, R_RING, FIDELITY } from './levels.js';

const TAU = Math.PI * 2;
export const PITCHES = [-10, 0, 10, 20];
// pitch speeds the platter and the song (so the towers fire faster) but not the dust, which walks at its own
// pace. So pitching up is easier, and the score pays for keeping it slow.
export const PITCH_SCORE = { '-10': 1.5, 0: 1, 10: 0.75, 20: 0.5 };
const KICK_FLIGHT = 0.22;
const LEAD_IN = -Math.PI / 2;   // where the groove starts, in the record's frame (the top, at angle 0)

export class Game {
  constructor({ record = 1, tutorial = false } = {}) {
    this.ri = record;
    this.rec = RECORDS[record];
    this.song = SONGS[this.rec.song];
    this.tutorial = tutorial;
    this.t = 0;                 // sim seconds
    this.angle = 0;             // record rotation, radians
    this.pitch = 0;             // percent
    this.k = 0;                 // next sixteenth to play
    this.nextStepT = 0;
    this.stepDur = 60 / this.song.bpm / 4;
    this.phiMax = TAU * this.rec.turns;
    this.slots = [
      ...this.rec.ring.map(p => ({ ...p, kind: 'ring' })),
      ...this.rec.bridges.flatMap((b, bi) => b.slots.map(p => ({ ...p, kind: 'bridge', bridge: bi }))),
    ];
    this.towers = [];           // { slot, part, lvl, x, y, spent, flash, aim, shots }
    this.dust = [];
    this.shells = [];
    this.events = [];
    this.nickels = this.rec.startNickels;
    this.fidelity = FIDELITY;
    this.track = -1;            // index of the track playing, or of the last one finished
    this.state = 'between';     // between | track | won | lost
    this.queue = [];
    this.trackT = 0;
    this.m = 0;                 // music seconds (runs at the pitch)
    this.score = 0;
    this.kills = 0; this.leaks = 0; this.earned = 0;
    this.uid = 1;
  }

  get tracks() { return this.rec.tracks.length; }
  get speed() { return 1 + this.pitch / 100; }
  get mult() { return PITCH_SCORE[this.pitch]; }
  rAt(phi) { return R_OUT - (R_OUT - R_IN) * Math.min(1, phi / this.phiMax); }
  // local angle (record frame) of a groove point
  localAt(phi) { return LEAD_IN - phi; }
  posOf(phi, angle = this.angle) {
    const r = this.rAt(phi), a = angle + this.localAt(phi);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }
  // where a speck of dust will be dt seconds from now, if nothing hits it
  predict(d, dt) {
    const v = this.dustSpeed(d);
    const phi = d.phi + v / this.rAt(d.phi) * dt;
    return this.posOf(phi, this.angle + TAU * dt * this.speed / this.rec.rev);
  }
  dustSpeed(d) {
    let v = DUST[d.kind].v;
    if (d.slowT > 0) v *= d.slowF;
    if (this.inWarp(d)) v *= 2.6;
    return v;
  }
  inWarp(d) {
    if (!this.rec.warps.length) return false;
    const l = ((this.localAt(d.phi) % TAU) + TAU) % TAU;
    return this.rec.warps.some(w => l > w.a1 && l < w.a2);
  }

  // ---------- building
  towerAt(slot) { return this.towers.find(t => t.slot === slot); }
  canAfford(n) { return this.nickels >= n; }
  place(slot, part) {
    if (this.state === 'won' || this.state === 'lost') return false;
    if (this.towerAt(slot)) return false;
    const c = PARTS[part].cost[0];
    if (this.nickels < c) return false;
    this.nickels -= c;
    const s = this.slots[slot];
    const tw = { slot, part, lvl: 1, x: s.x, y: s.y, spent: c, flash: 0, aim: Math.atan2(-s.y, -s.x), shots: 0, kills: 0 };
    this.towers.push(tw);
    this.events.push({ type: 'place', tower: tw });
    return tw;
  }
  upCost(tw) { return tw.lvl >= 3 ? null : PARTS[tw.part].cost[tw.lvl]; }
  upgrade(tw) {
    const c = this.upCost(tw);
    if (c == null || this.nickels < c) return false;
    this.nickels -= c; tw.spent += c; tw.lvl++;
    this.events.push({ type: 'upgrade', tower: tw });
    return true;
  }
  refund(tw) { return Math.floor(tw.spent * 0.7); }
  sell(tw) {
    const i = this.towers.indexOf(tw);
    if (i < 0) return false;
    this.towers.splice(i, 1);
    this.nickels += this.refund(tw);
    this.events.push({ type: 'sell', tower: tw });
    return true;
  }
  // the highest level of each part on the turntable; 0 if the part isn't there (so the song leaves it out)
  partLevels() {
    const o = { kick: 0, snare: 0, hat: 0, bass: 0 };
    for (const t of this.towers) o[t.part] = Math.max(o[t.part], t.lvl);
    return o;
  }
  setPitch(p) { if (PITCH_SCORE[p] != null) this.pitch = p; }

  // ---------- tracks
  startTrack() {
    if (this.state !== 'between' || this.track + 1 >= this.tracks) return false;
    this.track++;
    this.state = 'track';
    this.trackT = 0;
    const mul = this.rec.hpMul * (1 + 0.25 * this.track);
    this.queue = [];
    for (const [kind, n, gap, delay] of this.rec.tracks[this.track]) {
      for (let i = 0; i < n; i++) this.queue.push({ kind, at: delay + i * gap, hp: Math.round(DUST[kind].hp * mul * 10) / 10 });
    }
    this.queue.sort((a, b) => a.at - b.at);
    this.events.push({ type: 'track', n: this.track });
    return true;
  }
  spawn(kind, hp) {
    const d = { id: this.uid++, kind, hp, max: hp, phi: 0, slowT: 0, slowF: 1, hit: 0, skipT: 1.6 + Math.random() * 1.2, scratched: 0, x: 0, y: 0, born: this.t, wob: Math.random() * TAU };
    Object.assign(d, this.posOf(0));
    this.dust.push(d);
    return d;
  }

  // ---------- the clock
  stepTime(k) {
    const pair = Math.floor(k / 2) * 2 * this.stepDur;
    return k % 2 ? pair + this.stepDur * (1 + this.song.swing) : pair;
  }
  hits(part, s, lvl) {
    if (part === 'bass') return (lvl >= 3 ? this.song.bassX : this.song.bass)[s] > 0;
    return (lvl >= 3 ? this.song[part + 'X'] : this.song[part])[s] === 'x';
  }

  step(dtReal) {
    if (this.state === 'won' || this.state === 'lost') { this.angle += TAU * dtReal / this.rec.rev * 0.25; return; }
    const sp = this.speed, m0 = this.m, m1 = this.m + dtReal * sp;
    // sixteenths that land inside this step fire first, at their own moment, so the beat stays tight
    while (this.nextStepT <= m1) {
      const ms = this.nextStepT;
      this.advance((ms - this.m) / sp);
      this.m = ms;
      this.beat(this.k % 32, (ms - m0) / sp, dtReal);
      this.k++;
      this.nextStepT = this.stepTime(this.k);
    }
    this.advance((m1 - this.m) / sp);
    this.m = m1;
  }

  advance(dt) {
    if (dt <= 0) return;
    this.t += dt;
    this.angle += TAU * dt * this.speed / this.rec.rev;
    if (this.state === 'track') {
      this.trackT += dt;
      while (this.queue.length && this.queue[0].at <= this.trackT) { const q = this.queue.shift(); this.spawn(q.kind, q.hp); }
    }
    // dust walks the groove
    for (const d of this.dust) {
      if (d.dead) continue;
      const v = this.dustSpeed(d);
      const r = this.rAt(d.phi);
      let dphi = v / r * dt;
      // scratches: crossing one knocks dust into the next groove in (once per scratch)
      this.rec.scratches.forEach((s, si) => {
        if (d.scratched & (1 << si)) return;
        const c = ((LEAD_IN - s.a) % TAU + TAU) % TAU;
        if (Math.floor((d.phi + dphi - c) / TAU) > Math.floor((d.phi - c) / TAU) && r >= s.r1 && r <= s.r2) {
          d.scratched |= 1 << si;
          dphi += TAU;
          this.events.push({ type: 'scratch', dust: d, x: d.x, y: d.y });
        }
      });
      d.phi += dphi;
      if (DUST[d.kind].skips) {
        d.skipT -= dt;
        if (d.skipT <= 0) { d.skipT = 2.6; this.events.push({ type: 'skip', x: d.x, y: d.y }); d.phi += 1.1; }
      }
      if (d.slowT > 0) d.slowT -= dt;
      if (d.hit > 0) d.hit -= dt;
      Object.assign(d, this.posOf(d.phi));
      if (d.phi >= this.phiMax) {
        d.dead = true;
        const n = DUST[d.kind].leak;
        this.fidelity = Math.max(0, this.fidelity - n);
        this.leaks += n;
        this.events.push({ type: 'leak', dust: d, n });
      }
    }
    // kick shells land
    for (const s of this.shells) {
      s.t += dt;
      if (s.t >= s.T && !s.done) {
        s.done = true;
        for (const d of this.dust) if (!d.dead && Math.hypot(d.x - s.tx, d.y - s.ty) <= s.splash + DUST[d.kind].r) this.hurt(d, s.dmg, s.tower);
        this.events.push({ type: 'boom', x: s.tx, y: s.ty, r: s.splash });
      }
    }
    this.shells = this.shells.filter(s => !s.done);
    for (const t of this.towers) if (t.flash > 0) t.flash -= dt;
    this.dust = this.dust.filter(d => !d.dead);
    if (this.state === 'track' && !this.queue.length && !this.dust.length && !this.shells.length) {
      const bonus = 20 + 6 * this.track;
      this.nickels += bonus; this.earned += bonus;
      if (this.track + 1 >= this.tracks) this.score += this.fidelity * 100;
      this.state = this.track + 1 >= this.tracks ? 'won' : 'between';
      this.events.push({ type: 'cleared', n: this.track, bonus });
    }
    if (this.fidelity <= 0 && this.state !== 'lost') { this.state = 'lost'; this.events.push({ type: 'lost' }); }
  }

  hurt(d, dmg, tw) {
    if (d.dead) return;
    d.hp -= dmg; d.hit = 0.12;
    if (d.hp <= 0) {
      d.dead = true;
      const pay = DUST[d.kind].pay;
      this.nickels += pay; this.earned += pay; this.kills++;
      this.score += Math.round(pay * 10 * this.mult);
      if (tw) tw.kills++;
      this.events.push({ type: 'kill', dust: d, pay, x: d.x, y: d.y, part: tw?.part });
    }
  }

  // the target nearest the label (furthest along) that's in reach
  target(tw, range) {
    let best = null;
    for (const d of this.dust) {
      if (d.dead) continue;
      if ((d.x - tw.x) ** 2 + (d.y - tw.y) ** 2 > (range + DUST[d.kind].r) ** 2) continue;
      if (!best || d.phi > best.phi) best = d;
    }
    return best;
  }

  // at: real seconds into this frame's step that the sixteenth landed
  beat(s, at, dt) {
    this.events.push({ type: 'step', s, at, dt });
    for (const tw of this.towers) {
      if (!this.hits(tw.part, s, tw.lvl)) continue;
      const P = PARTS[tw.part], L = tw.lvl - 1, range = P.range[L];
      if (tw.part === 'bass') {
        let any = false;
        for (const d of this.dust) {
          if (d.dead || (d.x - tw.x) ** 2 + (d.y - tw.y) ** 2 > (range + DUST[d.kind].r) ** 2) continue;
          any = true;
          d.slowF = d.slowT > 0 ? Math.min(d.slowF, P.slow[L]) : P.slow[L];
          d.slowT = 1.3;
          this.hurt(d, P.dmg[L], tw);
        }
        tw.flash = 0.25; tw.shots++;
        this.events.push({ type: 'fire', tower: tw, wave: true, any });
        continue;
      }
      const d = this.target(tw, range);
      if (!d) continue;
      tw.flash = 0.18; tw.shots++;
      if (tw.part === 'kick') {
        const p = this.predict(d, KICK_FLIGHT);
        this.shells.push({ x0: tw.x, y0: tw.y, tx: p.x, ty: p.y, t: 0, T: KICK_FLIGHT, dmg: P.dmg[L], splash: P.splash[L], tower: tw });
        tw.aim = Math.atan2(p.y - tw.y, p.x - tw.x);
        this.events.push({ type: 'fire', tower: tw, x: p.x, y: p.y });
      } else {
        tw.aim = Math.atan2(d.y - tw.y, d.x - tw.x);
        this.events.push({ type: 'fire', tower: tw, x: d.x, y: d.y });
        this.hurt(d, P.dmg[L], tw);
      }
    }
  }

  stars() { return this.fidelity >= FIDELITY ? 3 : this.fidelity >= FIDELITY * 0.6 ? 2 : 1; }
}

export { TAU, PART_KEYS, PARTS, DUST, RECORDS, SONGS, R_RING };
