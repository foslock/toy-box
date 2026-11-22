// One go at one show-ring event: the horse, the course, the clock, wipeouts and replays,
// the band (parade), the judge's letters (dressage), the rival horses (derby) and the paddock lesson.
// No DOM: main.js feeds it input and draws what it says; the balance sims run it in Node.
import { Walker, W } from './walker.js';
import { Ragdoll } from './ragdoll.js';
import { Course } from './course.js';
import { Bot } from './bot.js';

const STEP = 1 / 120;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function clonePose(p) {
  return { F: { ...p.F }, B: { ...p.B }, legs: p.legs.map((l) => l.slice()), crouch: p.crouch.slice(), air: p.air.slice(), wob: p.wob.slice(), torn: p.torn, stretch: p.stretch, tear: p.tear, patches: p.patches, ragdoll: p.ragdoll };
}

export const LESSON = [
  { id: 'back', say: 'This is the back end. He’s bent double and can’t see a thing. Tap {back} and he takes a step.' },
  { id: 'front', say: 'And this is the front end. Tap {front} to walk her.' },
  { id: 'walk', say: 'Now both, one after the other: back, front, back, front. Walk to the red flag.' },
  { id: 'together', say: 'Keep the two ends together. Leave one behind and the costume stretches, then rips. Bunch up and he headbutts her.' },
  { id: 'hopF', say: 'A log! Hold {front} to crouch, let go to hop. Go just before the log.' },
  { id: 'hopB', say: 'Now the back end has to hop it too, and he can’t see it. Hold {back} when the front end says “Ready”, and let go on “Hup!”' },
  { id: 'bale', say: 'A hay bale is taller. Same again: front end hops, then the back end on “Hup!”' },
  { id: 'done', say: 'That’s the knack. Trot through the gate and they’ll let you into the ring.' },
];

export class Run {
  constructor(def, opts = {}) {
    this.def = def;
    this.course = new Course(def);
    this.kind = def.kind;
    this.seed = opts.seed ?? 1;
    this.state = 'ready';
    this.readyT = opts.quick ? 0.2 : 2.6;
    this.t = 0;            // time on the clock
    this.simT = 0;         // all time, including replays
    this.flag = 0;
    this.wipeouts = 0;
    this.patches = 0;
    this.penalty = 0;
    this.out = [];         // events for sound, commentary and the HUD
    this.history = [];     // recent poses for the action replay
    this.histT = 0;
    this.best = null;      // most spectacular wipeout this run
    this.acc = 0;
    this.spawn(0.5);
    this.hup = null;
    // event extras
    if (def.band) this.band = { x: def.band.start + 0.5, speed: def.band.speed, wait: def.band.wait, inStep: 0, total: 0, done: false, bumps: 0, stumble: 0 };
    if (def.marks) this.marks = def.marks.map((m) => ({ ...m, state: 'todo', hold: 0 }));
    if (def.rivals) this.rivals = def.rivals.map((r, i) => this.makeRival(r, i));
    if (this.kind === 'tutorial') this.lesson = { i: 0, t: 0, flags: {} };
    this.autoplay = opts.autoplay ? new Bot(this.walker, { rate: 4, skill: 0.97, seed: this.seed, ...this.botOpts() }) : null;
    this.finishT = null;
    this.result = null;
  }

  botOpts() {
    const o = {};
    if (this.marks) o.stopAt = () => { const m = this.marks.find((mm) => mm.state === 'todo'); return m ? m.x : null; };
    if (this.band) o.paceX = () => this.band.x - 0.6;
    return o;
  }

  makeRival(r, i) {
    const w = new Walker(this.course, 0.5, {});
    return { ...r, lane: i, w, bot: new Bot(w, { rate: r.rate, skill: r.skill, seed: this.seed * 13 + i * 7 }), down: 0, done: null, flag: 0 };
  }

  spawn(x) {
    this.walker = new Walker(this.course, x, { patches: this.patches, tune: this.kind === 'tutorial' ? { tearRate: 0.6 } : undefined });
    if (this.autoplay) this.autoplay = new Bot(this.walker, { rate: 4, skill: 0.97, seed: this.seed + this.wipeouts, ...this.botOpts() });
    this.rag = null;
    this.safe = false;
  }

  emit(type, extra) { this.out.push({ type, ...extra }); }

  press(name) { if (this.state === 'go' && !this.autoplay) this.walker.press(name); this.held = this.held || {}; this.held[name] = true; }
  release(name) { if (this.state === 'go' && !this.autoplay) this.walker.release(name); if (this.held) this.held[name] = false; }

  update(dt) {
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= STEP) { this.acc -= STEP; this.tick(STEP); }
  }

  tick(dt) {
    this.simT += dt;
    if (this.state === 'ready') {
      this.readyT -= dt;
      if (this.readyT <= 0) { this.state = 'go'; this.emit('go'); }
      this.walker.events.length = 0;
      return;
    }
    if (this.state === 'replay') {
      this.replay.t += dt * 0.55;
      if (this.replay.t >= this.replay.end) this.endReplay();
      return;
    }
    if (this.state === 'done') {
      this.walker.update(dt);
      this.walker.events.length = 0;
      this.tickExtras(dt);
      return;
    }
    this.t += dt;

    if (this.state === 'go') {
      if (this.autoplay) this.autoplay.tick(this.walker.t);
      if (this.lesson) this.lessonTick(dt);
      this.walker.update(dt);
      this.drainWalker();
      this.record(dt);
      const w = this.walker;
      for (const f of this.course.flags) if (f > this.flag && w.back.x > f) { this.flag = f; this.emit('flag', { x: f }); }
      this.hupCheck();
      if (w.fallen) this.wipe(w.fallen);
      else if (w.back.x > this.course.length && this.finishT == null && this.kind !== 'parade') this.finish();
    } else if (this.state === 'wipe') {
      this.rag.step(dt);
      this.record(dt);
      if (this.rag.settled()) this.afterWipe();
    }
    this.tickExtras(dt);
  }

  // ---- the horse's own events: pass them on, and keep score of what went wrong
  drainWalker() {
    for (const e of this.walker.events) {
      if (this.safe && (e.type === 'bump' || e.type === 'trip' || e.type === 'stumble')) {
        // during the first lesson steps a groom is holding the horse steady
        this.walker.front.om *= 0.3; this.walker.back.om *= 0.3;
      }
      this.emit(e.type, e);
    }
    this.walker.events.length = 0;
    const w = this.walker;
    if (this.safe) { w.tear = 0; for (const h of w.halves) { h.th *= 0.9; h.om *= 0.9; } }
  }

  // "Ready… Hup!" from the front end when the back end should hop
  hupCheck() {
    const w = this.walker, B = w.back;
    const o = this.course.nextObstacle(B.x - 0.1);
    if (!o || o.type === 'ditch' && this.kind === 'parade') { this.hup = null; return; }
    if (B.air || o.x0 < B.x - 0.05) { if (this.hup && this.hup.ob === o) this.hup.gone = true; return; }
    if (o.kind === 'kerb') return;
    const vx = Math.max(B.vx, 0.6), hv = Math.min(2.7, Math.max(B.vx, 1.2) + W.hopVx);
    const D = hv * 0.6;
    const take = o.type === 'ditch' ? Math.min(o.x0 - 0.3, o.x1 + 0.2 - D) : Math.min(o.x0 - 0.24, o.x1 + 0.2 - D);
    const lead = vx * (W.crouchAfter + 0.14);
    const st = B.x >= take ? 'hup' : B.x >= take - lead ? 'ready' : null;
    if (st && (!this.hup || this.hup.ob !== o || this.hup.st !== st)) {
      if (!this.hup || this.hup.ob !== o || this.hup.st !== st) this.emit('hup', { st });
      this.hup = { ob: o, st, t: this.simT };
    }
  }

  record(dt) {
    this.histT += dt;
    if (this.histT < 1 / 30) return;
    this.histT = 0;
    this.history.push({ t: this.simT, pose: clonePose(this.pose()) });
    while (this.history.length && this.history[0].t < this.simT - 6) this.history.shift();
  }

  wipe(f) {
    const w = this.walker;
    this.wipeouts++;
    this.state = 'wipe';
    this.wipeT = this.simT;
    const torn = f.why === 'tear';
    if (torn) this.patches++;
    const p = w.pose();
    const spin = (h) => -h.om * 0.9;
    this.rag = new Ragdoll(this.course, p, { front: { vx: w.front.vx, vy: w.front.vy, spin: spin(w.front) }, back: { vx: w.back.vx, vy: w.back.vy, spin: spin(w.back) } }, { torn });
    this.emit('wipe', { why: f.why, half: f.half, torn, n: this.wipeouts, x: w.x() });
    for (const n of ['front', 'back']) if (this.held) this.held[n] = false;
  }

  afterWipe() {
    const score = this.rag.spectacle();
    const frames = this.history.filter((h) => h.t >= this.wipeT - 1.6);
    const show = this.wipeouts === 1 || score > 9 || this.rag.torn;
    if (!this.best || score > this.best.score) this.best = { score, frames, torn: this.rag.torn };
    if (show && !this.noReplay) {
      this.state = 'replay';
      const t0 = frames.length ? frames[0].t : this.simT;
      this.replay = { frames, t: t0, start: t0, end: this.simT, score };
      this.emit('replay', { score });
    } else this.respawn();
  }

  skipReplay() { if (this.state === 'replay') this.endReplay(); }
  endReplay() {
    this.replay = null;
    if (this.state === 'replay') this.respawn();
  }

  respawn() {
    const x = this.lastSafe();
    this.spawn(x);
    this.state = 'go';
    this.emit('respawn', { x });
    this.history.length = 0;
    this.hup = null;
    if (this.held) for (const n of ['front', 'back']) if (this.held[n]) { /* make them press again */ this.held[n] = false; }
  }

  lastSafe() {
    // the last flag the back end passed, but never in front of an obstacle you couldn't see coming
    return this.flag + 0.5;
  }

  finish() {
    this.finishT = this.t;
    this.state = 'done';
    const r = { t: this.t + this.penalty, raw: this.t, penalty: this.penalty, wipeouts: this.wipeouts, patches: this.patches };
    const m = this.def.medals;
    if (this.kind === 'time' || this.kind === 'dressage') r.place = r.t <= m.gold ? 1 : r.t <= m.silver ? 2 : r.t <= m.bronze ? 3 : 4;
    if (this.kind === 'race') {
      const ahead = this.rivals.filter((rv) => rv.done != null).length;
      r.place = ahead + 1;
      r.field = this.rivals.map((rv) => ({ name: rv.name, t: rv.done }));
    }
    if (this.kind === 'parade') {
      const share = this.band.total > 0 ? this.band.inStep / this.band.total : 0;
      r.share = share;
      r.bumps = this.band.bumps;
      r.place = share >= m.gold ? 1 : share >= m.silver ? 2 : share >= m.bronze ? 3 : 4;
    }
    if (this.kind === 'tutorial') r.place = 0;
    this.result = r;
    this.emit('finish', r);
  }

  tickExtras(dt) {
    const w = this.walker;
    if (this.band) {
      const b = this.band;
      const going = this.state === 'go' || this.state === 'wipe' || this.state === 'done';
      if (going && this.t > b.wait && !b.done) {
        b.x += b.speed * dt;
        b.stumble = Math.max(0, b.stumble - dt);
        b.total += dt;
        const gap = b.x - (this.state === 'go' ? w.nose() : -99);
        const inStep = this.state === "go" && gap > 0.25 && gap < 2.4;
        if (inStep) b.inStep += dt;
        b.status = this.state !== "go" ? "down" : gap <= 0.25 ? "close" : gap < 2.4 ? "ok" : "far";
        if (this.state === 'go' && gap < 0.12 && b.stumble <= 0) {
          b.bumps++; b.stumble = 1.4;
          w.front.om += 1.4; w.front.vx *= 0.3;
          this.emit('tuba', { n: b.bumps });
        }
        if (b.x >= this.course.length - 1.5) { b.done = true; b.x = this.course.length - 1.5; if (this.state !== 'done') this.finish(); }
      }
    }
    if (this.marks && this.state === 'go') {
      const m = this.marks.find((mm) => mm.state === 'todo');
      if (m) {
        const fx = w.front.x;
        const on = Math.abs(fx - m.x) < 0.45;
        if (on && w.still()) {
          m.hold += dt;
          if (m.hold > 1.5) { m.state = 'done'; this.emit('halt', { letter: m.letter }); }
        } else m.hold = Math.max(0, m.hold - dt * 2);
        m.on = on;
        if (fx > m.x + 0.75) { m.state = 'missed'; this.penalty += 8; this.emit('missed', { letter: m.letter }); }
      }
    }
    if (this.rivals) {
      const live = this.state === 'go' || this.state === 'wipe' || this.state === 'done';
      for (const r of this.rivals) {
        if (!live || r.done != null) { if (r.done != null && r.w.back.x < this.course.length + 6) { r.bot.tick(r.w.t); r.w.update(dt); r.w.events.length = 0; } continue; }
        if (r.down > 0) {
          r.down -= dt;
          if (r.down <= 0) { r.w = new Walker(this.course, r.flag + 0.5, {}); r.bot = new Bot(r.w, { rate: r.rate, skill: r.skill, seed: Math.floor(this.simT * 100) + r.lane }); }
          continue;
        }
        r.bot.tick(r.w.t); r.w.update(dt); r.w.events.length = 0;
        for (const f of this.course.flags) if (f > r.flag && r.w.back.x > f) r.flag = f;
        if (r.w.fallen) { r.down = 2.4; r.heap = { x: r.w.x(), why: r.w.fallen.why }; this.emit('rivalDown', { name: r.name }); }
        else if (r.w.back.x > this.course.length) { r.done = this.t; this.emit('rivalHome', { name: r.name, place: this.rivals.filter((q) => q.done != null).length }); }
      }
    }
  }

  // ---- the paddock lesson
  lessonTick(dt) {
    const L = this.lesson, w = this.walker, step = LESSON[L.i];
    L.t += dt;
    this.safe = L.i < 2;
    const adv = () => { L.i++; L.t = 0; L.base = null; this.emit('lesson', { i: L.i }); };
    if (!L.base) L.base = { b: w.back.steps, f: w.front.steps, fh: w.front.hops || 0 };
    const log = this.course.obstacles.find((o) => o.type === 'log');
    const bale = this.course.obstacles.find((o) => o.type === 'bale');
    switch (step.id) {
      case 'back': if (w.back.steps - L.base.b >= 4) adv(); break;
      case 'front': if (w.front.steps - L.base.f >= 4) adv(); break;
      case 'walk': if (w.back.x > this.course.flags[1]) adv(); break;
      case 'together': if (w.back.x > this.course.flags[2] - 1) adv(); break;
      case 'hopF': if (w.front.x > log.x1 + 0.25 && !w.front.air) adv(); break;
      case 'hopB': if (w.back.x > log.x1 + 0.25 && !w.back.air) adv(); break;
      case 'bale': if (w.back.x > bale.x1 + 0.25 && !w.back.air) adv(); break;
    }
  }

  // what the renderer draws this frame
  pose() {
    if (this.state === 'replay' && this.replay) {
      const fr = this.replay.frames;
      let i = 0;
      while (i < fr.length - 1 && fr[i + 1].t <= this.replay.t) i++;
      return fr[i] ? fr[i].pose : this.walker.pose();
    }
    if (this.rag) { const p = this.rag.pose(); p.patches = this.patches; return p; }
    return this.walker.pose();
  }

  focusX() {
    if (this.state === 'replay' && this.replay) { const p = this.pose(); return (p.F.x + p.B.x) / 2; }
    if (this.rag) return this.rag.x();
    return this.walker.x();
  }

  progress() { return clamp(this.focusX() / this.course.length, 0, 1); }
}
