// The rules of the podium. No drawing and no sound in here, so a bot can conduct it from Node.
import { SECTIONS, compile } from './score.js';

// Beat patterns, on a card spanning -.5….5. Node i is where beat i+1 lands.
export const PATTERNS = {
  2: [[-.06, .5], [.06, -.5]],
  3: [[-.08, .5], [.5, .06], [-.08, -.5]],
  4: [[0, .5], [-.5, .08], [.5, .08], [0, -.5]],
};
export function edge(meter, i) { const n = PATTERNS[meter], a = n[(i - 1 + meter) % meter], b = n[i % meter]; return [b[0] - a[0], b[1] - a[1]]; }
const edgeLen = (m, i) => Math.hypot(...edge(m, i));
export const cardScale = (level) => .22 + .6 * level; // size of the card, as a share of the pad
const scaleToLevel = (s) => Math.max(0, Math.min(1, (s - .22) / .6));

// Finds the corners in a moving pointer. Two tests: a reversal (we've come back towards where the stroke began)
// and a bend (the path has left the straight line from the stroke's start). Either way the beat is the corner.
export class Turns {
  constructor(size) { this.back = Math.max(7, size * .03); this.dev = Math.max(7, size * .028); this.min = Math.max(16, size * .055); this.reset(); }
  reset() { this.a = null; this.path = []; this.ext = null; }
  push(x, y, t) {
    if (!this.a) { this.a = { x, y, t }; this.ext = { x, y, t, d: 0 }; this.path = [{ x, y, t }]; return null; }
    const a = this.a, d = Math.hypot(x - a.x, y - a.y); const p = { x, y, t };
    this.path.push(p); if (this.path.length > 240) this.path.shift();
    let corner = null;
    if (d > this.ext.d) this.ext = { x, y, t, d };
    else {
      const e = this.ext, back = Math.hypot(x - e.x, y - e.y);
      if (e.d >= this.min && back >= this.back && this.angle(a, e, p) > .9) corner = e;
    }
    if (!corner && d >= this.min) { // the bend
      const ux = (x - a.x) / d, uy = (y - a.y) / d; let best = 0, k = null;
      for (const q of this.path) { const dv = Math.abs((q.x - a.x) * uy - (q.y - a.y) * ux); if (dv > best) { best = dv; k = q; } }
      if (k && best >= this.dev) { const kd = Math.hypot(k.x - a.x, k.y - a.y); if (kd >= this.min && Math.hypot(x - k.x, y - k.y) >= this.dev && this.angle(a, k, p) > .9) corner = k; }
    }
    if (!corner) {
      return null;
    }
    const out = { t, tc: corner.t, dx: corner.x - a.x, dy: corner.y - a.y, len: Math.hypot(corner.x - a.x, corner.y - a.y), x: corner.x, y: corner.y };
    this.a = { x: corner.x, y: corner.y, t: corner.t };
    const i = this.path.indexOf(corner); this.path = i >= 0 ? this.path.slice(i) : [this.a, p];
    this.ext = { x, y, t, d: Math.hypot(x - corner.x, y - corner.y) };
    return out;
  }
  // A hand that stops dead on the beat sends no more moves, so the frame loop asks about it.
  idle(t) {
    const e = this.ext, l = this.path[this.path.length - 1];
    if (!this.a || !e || !l || e.d < this.min || t - l.t < .07) return null;
    const a = this.a, out = { t, tc: e.t, dx: e.x - a.x, dy: e.y - a.y, len: e.d, x: e.x, y: e.y };
    this.a = { x: l.x, y: l.y, t }; this.ext = { x: l.x, y: l.y, t, d: 0 }; this.path = [{ x: l.x, y: l.y, t }];
    return out;
  }
  angle(a, b, c) {
    const ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y, ul = Math.hypot(ux, uy), vl = Math.hypot(vx, vy);
    if (!ul || !vl) return 0; return Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (ul * vl))));
  }
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export class Perf {
  constructor(piece, hooks = {}) {
    this.c = compile(piece); this.piece = piece; this.hooks = hooks; this.meter = this.c.meter; this.loop = !!piece.loop;
    this.pos = -1; this.beat = -1; this.started = false; this.finished = false; this.now = 0;
    this.period = 60 / this.c.marks[0].bpm; this.lastIctus = 0; this.level = this.c.marks[0].dyn; this.mood = .62; this.hold = null; this.stalled = false; this.waited = 0;
    this.lastNote = this.c.events.reduce((a, e) => Math.max(a, e.b), 0);
    this.secs = {};
    for (const s of SECTIONS) this.secs[s.id] = { ...s, offset: 0, list: this.c.events.filter(e => e.sec === s.id), cur: 0, trouble: null, asleep: false, last: -9, lastBig: -9, entered: -9, slop: 0 };
    this.st = { nT: 0, sT: 0, nD: 0, sD: 0, nS: 0, sS: 0, cue: 0, cueMax: this.c.cues.length, fix: 0, fixMax: this.c.troubles.length, stalls: 0, overran: 0, missed: [], sleepBeats: 0, unfixed: [], fast: 0, slow: 0, loud: 0, soft: 0, stray: 0 };
    this.cueFlash = []; this.trail = [];
  }
  markAt(b) { const m = this.c.marks; return m[Math.max(0, Math.min(m.length - 1, b))]; }
  get markedPeriod() { return 60 / this.markAt(this.beat + 1).bpm; }
  get bar() { return Math.floor(Math.max(0, this.beat) / this.meter) + 1; }
  // Where the little bead is: 0 just left the last beat, 1 waiting at the next one.
  beadPhase(t = this.now) {
    if (!this.started) return 0;
    const hold = this.hold ? this.hold.f.sec : 0;
    return clamp01((t - this.lastIctus - hold) / this.markedPeriod);
  }
  requests() {
    const out = [...(this.extra || [])], p = this.pos;
    for (const c of this.c.cues) if (!c.done && !c.gone && p >= c.beat - this.meter - 1 && p < c.end) out.push({ sec: c.sec, kind: 'cue', ref: c, late: p > c.beat + 1 });
    for (const t of this.c.troubles) if (t.on && !t.fixed && !t.over) out.push({ sec: t.sec, kind: t.kind, ref: t });
    return out;
  }
  // Point at someone. Returns what happened, for the show.
  point(sec, t = this.now) {
    const req = this.requests().filter(r => r.sec === sec); if (!req.length) return null;
    let res = null;
    for (const r of req) {
      if (r.ref.tut) { r.ref.done = true; this.extra = []; const s = this.secs[sec]; s.trouble = null; if (s.asleep) { s.asleep = false; this.hooks.onWake?.(sec); } res = { kind: r.kind, q: 1 }; continue; }
      if (r.kind === 'cue') {
        const c = r.ref, l = this.pos - c.beat; c.done = true;
        const q = l <= .75 ? 1 : l <= this.meter ? .65 : .3; this.st.cue += q; c.q = q; this.mood = clamp01(this.mood + .04 * q);
        this.secs[sec].entered = t; res = { kind: 'cue', q };
        this.hooks.onCue?.(c, q);
      } else {
        const tr = r.ref; tr.fixed = true; const s = this.secs[sec]; s.trouble = null;
        const q = Math.max(.35, 1 - (this.pos - tr.beat) / (this.meter * 4)); this.st.fix += q; this.mood = clamp01(this.mood + .04);
        if (tr.kind === 'sleep') { s.asleep = false; this.hooks.onWake?.(sec); }
        res = { kind: tr.kind, q }; this.hooks.onFix?.(tr, q);
      }
    }
    return res;
  }
  ictus(now, stroke = {}) {
    if (this.finished) return false;
    const t = stroke.tc ?? now; // time it from the corner itself, not from when we noticed it
    if (!this.started) {
      this.started = true; this.beat = 0; this.pos = 0; this.lastIctus = t; this.now = t; this.score1(null, stroke, t); this.hooks.onBeat?.(0, stroke); return true;
    }
    const gap = t - this.lastIctus, inHold = this.hold;
    if (gap < .42 * Math.min(this.period, this.markedPeriod)) return false; // a wobble, not a beat
    const ended = this.beat + 1 >= this.c.total;
    if (ended && !this.loop) return false;
    this.hooks.onBeatEnd?.();
    let measured = gap;
    if (inHold) {
      measured = gap - inHold.f.sec;
      if (t < inHold.until - .5) { this.st.overran++; this.mood = clamp01(this.mood - .12); this.hooks.onOverrun?.(inHold.f); }
      this.hold = null; this.hooks.onHoldEnd?.(inHold.f);
    }
    const stalledBeat = this.stalled || (!inHold && gap > 2 * this.period);
    if (!stalledBeat && !inHold) { this.period += (Math.max(.45 * this.markedPeriod, Math.min(1.9 * this.markedPeriod, measured)) - this.period) * .62; }
    if (this.stalled) { this.stalled = false; this.hooks.onResume?.(); }
    const prev = this.markedPeriod;
    if (ended) { this.beat = -1; for (const s of Object.values(this.secs)) s.cur = 0; }
    this.beat++; this.pos = this.beat; this.lastIctus = t; this.waited = 0;
    this.score1(inHold || stalledBeat ? null : { gap: measured, prev }, stroke, t);
    const f = this.c.ferm.find(x => x.beat === this.beat);
    if (f) { this.hold = { f, until: t + f.sec }; this.hooks.onHold?.(f, this.period); }
    this.hooks.onBeat?.(this.beat, stroke);
    return true;
  }
  score1(tm, stroke, t) {
    const st = this.st, mark = this.markAt(this.beat); let lv = this.level, shape = .5, d = .6;
    if (stroke.len) {
      const size = stroke.len / (stroke.size || 300), s = size / edgeLen(this.meter, this.beat % this.meter);
      lv = scaleToLevel(s); this.level += (lv - this.level) * .5;
      d = clamp01(1 - Math.abs(this.level - mark.dyn) / .36);
      const e = edge(this.meter, this.beat % this.meter), a = Math.atan2(stroke.dy, stroke.dx) - Math.atan2(e[1], e[0]);
      const da = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); shape = da < .95 ? 1 : da < 1.5 ? .5 : 0;
      this.lastShape = shape; if (this.level > mark.dyn + .22) st.loud++; else if (this.level < mark.dyn - .22) st.soft++;
    } else this.level += (mark.dyn - this.level) * .4;
    st.nD++; st.sD += d; st.nS++; st.sS += shape;
    let q = d;
    if (tm) {
      const dev = Math.log(tm.gap / tm.prev), tq = clamp01(1 - Math.abs(dev) / .22);
      st.nT++; st.sT += tq; q = .65 * tq + .35 * d; this.lastTq = tq; if (dev < -.14) st.fast++; else if (dev > .14) st.slow++;
    }
    this.mood += (q - this.mood) * .1;
  }
  update(t) {
    const dt = Math.min(.1, Math.max(0, t - this.now)); this.now = t;
    if (!this.started) return;
    if (this.finished) return;
    const limit = this.beat + 1 - 1e-4; const eighty = this.period;
    if (this.beat + 1 >= this.c.total && !this.loop) this.pos = Math.min(this.c.total, this.pos + dt / eighty);
    else if (!this.hold) this.pos = Math.min(limit, this.pos + dt / eighty);
    else this.pos = this.beat;
    // gone quiet: they stop and look up
    if (this.pos >= limit - 1e-3 || this.hold) {
      this.waited += dt;
      const late = this.hold ? this.waited > this.hold.f.sec + 2.5 : this.waited > Math.max(.9, this.period * 1.1);
      if (late && !this.stalled && !this.loopFree) { this.stalled = true; this.st.stalls++; this.mood = clamp01(this.mood - .08); this.hooks.onStall?.(); }
    }
    // troubles start and wear off
    for (const tr of this.c.troubles) {
      if (!tr.on && !tr.over && this.pos >= tr.beat) { tr.on = true; const s = this.secs[tr.sec]; s.trouble = tr; if (tr.kind === 'sleep') { s.asleep = true; this.hooks.onSleep?.(tr.sec); } this.hooks.onTrouble?.(tr); }
      if (tr.on && !tr.fixed && !tr.over && this.pos >= tr.end) { tr.over = true; const s = this.secs[tr.sec]; s.trouble = null; if (tr.kind === 'sleep') { s.asleep = false; this.hooks.onWake?.(tr.sec, true); } this.st.unfixed.push(tr.kind); this.mood = clamp01(this.mood - .05); }
    }
    for (const c of this.c.cues) if (!c.done && !c.gone) {
      const lastCall = c.ting ? c.beat + 1 : c.end - .01;
      if (!c.flagged && this.pos > c.beat + 1) { c.flagged = true; this.mood = clamp01(this.mood - .06); this.hooks.onCueMiss?.(c); }
      if (this.pos >= lastCall) { c.gone = true; this.st.missed.push(c.sec); }
    }
    for (const s of Object.values(this.secs)) {
      const tr = s.trouble; let goal = 0;
      if (tr) { if (tr.kind === 'drag') goal = -.34; else if (tr.kind === 'rush') goal = .3; else if (tr.kind === 'rogue') goal = .24 * Math.sin(this.pos * 1.9); }
      s.offset += (goal - s.offset) * Math.min(1, dt * (tr ? .9 : 7));
      s.slop = tr ? Math.min(1, s.slop + dt * .5) : Math.max(0, s.slop - dt * 2);
      if (s.asleep) this.st.sleepBeats += dt / this.period;
      this.fire(s, t);
    }
    if (this.beat >= Math.floor(this.lastNote) && !this.loop && t - this.lastIctus > Math.max(.9, this.period * 1.2)) this.finish();
  }
  muted(s, ev) {
    if (s.asleep) return true;
    for (const c of this.c.cues) if (c.sec === s.id && !c.done && ev.b >= c.beat && ev.b < Math.max(c.end, c.beat + .01)) return true;
    return false;
  }
  fire(s, t) {
    const look = .03 / this.period, lp = this.pos + s.offset;
    const wall = this.hold ? this.beat + .001 : this.beat + 1 - 2e-4 + Math.max(0, s.offset);
    const lim = Math.min(lp + look, wall);
    while (s.cur < s.list.length) {
      const ev = s.list[s.cur]; if (ev.b > lim) break; s.cur++;
      if (lp - ev.b > .14) continue;  // we've been hurried past it
      if (this.muted(s, ev)) continue;
      const when = Math.max(0, (ev.b - lp) * this.period);
      const f = this.hold && ev.b >= this.beat ? this.hold.f.sec : 0;
      const v = ev.v * (s.trouble?.kind === 'rush' ? 1.1 : 1);
      this.hooks.onNote?.(ev, when, v, ev.d * this.period + f, s, this.level);
      s.last = t + when; if (ev.k === 'mel' || ev.b % 1 === 0) s.lastBig = t + when;
    }
  }
  finish() { this.finished = true; this.hooks.onFinish?.(this.result()); }
  result() {
    const s = this.st, avg = (a, n) => n ? a / n : .5;
    const time = avg(s.sT, s.nT), dyn = avg(s.sD, s.nD), shape = avg(s.sS, s.nS);
    const cue = s.cueMax ? s.cue / s.cueMax : 1, fix = s.fixMax ? s.fix / s.fixMax : 1;
    const raw = .4 * time + .15 * dyn + .05 * shape + .25 * cue + .15 * fix - .03 * s.stalls - .04 * s.overran;
    const total = clamp01(raw);
    return { time, dyn, shape, cue, fix, total, bouquets: total >= .86 ? 3 : total >= .72 ? 2 : total >= .55 ? 1 : 0, st: s };
  }
}
