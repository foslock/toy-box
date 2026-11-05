// The shift: stools, slips, stations, money. No drawing and no DOM, so a bot can play it in Node.
import { priceOf, rayEndLines, STRANGER_LINES } from './story.js';

export const STOOLS = 5;
export const POUR_RATE = 1 / 1.25;      // a full cup in 1.25 s
export const LINE = 0.86, LINE_LO = 0.76, LINE_HI = 0.95;
export const HUSH = 9;                  // seconds a regular waits to see if you remember
const COOK = { eggs: { a: 4.2, b: 0, burn: 7 }, burger: { a: 4.4, b: 3.6, burn: 7 } };
const TOAST = 3.4, PIE_SLICES = 6, PIE_BAKE = 5;

export const mulberry = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

export class Shift {
  constructor(def, { seed = def.year * 7 + 1, easy = false, flags = {} } = {}) {
    this.def = def; this.year = def.year; this.r = mulberry(seed); this.easy = easy; this.flags = flags;
    this.t = 0; this.done = false; this.closed = false; this.hold = false; this.noPatience = false;
    this.stools = Array.from({ length: STOOLS }, () => ({ party: null, dirty: null, ghostCup: false }));
    this.parties = []; this.door = []; this.nid = 1;
    this.urn = { glass: null, pouring: null }; this.fount = { glass: null, pouring: null };
    this.griddle = [null, null, null]; this.toaster = [null, null];
    this.pie = { apple: { n: PIE_SLICES, bake: 0 }, cherry: { n: PIE_SLICES, bake: 0 } };
    this.pass = [null, null, null];
    this.ev = []; this.captions = []; this.cap = null; this.capT = 0; this.overheard = [];
    this.stats = { takings: 0, tips: 0, served: 0, walked: 0, usuals: 0, usualChances: 0, pours: 0, perfect: 0, cups: 0, burnt: 0 };
    this.plan = [...def.parties.map(p => ({ ...p, kind: 'reg', at: p.at }))];
    this.reserved = new Map();
    this.buildStrangers();
    this.plan.sort((a, b) => a.at - b.at);
    if (def.ghost) { this.stools[2].ghost = true; }
  }

  buildStrangers() {
    const { dur, burst, mix, sizes, moon } = this.def; const r = this.r;
    const n = Math.round(this.def.n * (1 + Math.max(0, this.year - 1953) * .075));
    for (let i = 0; i < n; i++) {
      let at = 5 + (i + .25 + r() * .5) / n * (dur - 18);
      if (burst && i >= n - burst[2]) at = burst[0] + r() * (burst[1] - burst[0]);
      if (moon && at > moon[0] - 4 && at < moon[1]) at = moon[1] + r() * (dur - moon[1] - 8);
      const size = sizes[Math.floor(r() * sizes.length)];
      const order = []; for (let k = 0; k < size + (this.year >= 1962 && r() < .3 ? 1 : 0); k++) { const m = mix[Math.floor(r() * mix.length)]; if (!order.includes(m) || k > 1) order.push(m); }
      const bits = [8, 20, 33, 47]; // stranger looks are picked by the renderer from this seed
      this.plan.push({ kind: 'stranger', at, order, who: [], seed: Math.floor(r() * 1e6), pair: r() < .12 && order.length > 1, bits });
    }
  }

  emit(type, data = {}) { this.ev.push({ type, ...data }); }

  // ——— talk ———
  say(line) {
    if (!line) return;
    const i = line.indexOf('|'); const who = line.slice(0, i), text = line.slice(i + 1);
    this.captions.push({ who, text }); this.overheard.push({ who, text, year: this.year });
  }
  captionLen(c) { return Math.max(2.4, 1.3 + c.text.length * .048); }
  skipCaption() { if (this.cap) this.capT = 99; }

  // ——— tick ———
  tick(dt) {
    if (this.hold) { this.tickCaptions(dt); return; }
    if (!this.noClock) this.t += dt; const { def } = this;
    const frozen = def.moon && this.t >= def.moon[0] && this.t < def.moon[1];
    if (def.moon && !this.moonSaid && this.t >= def.moon[0]) { this.moonSaid = 1; this.say('|Everyone stops. The whole counter turns to the television. “That’s one small step...”'); this.emit('moon'); }
    if (this.t >= def.dur && !this.closed) { this.closed = true; this.emit('closed'); }
    // arrivals
    while (this.plan.length && !this.closed && this.plan[0].at <= this.t && !frozen) { this.door.push(this.plan.shift()); }
    this.seatDoor();
    this.tickStations(dt);
    this.tickParties(dt, frozen);
    this.tickCaptions(dt);
    if (this.closed) {
      const anyone = this.stools.some(s => s.party) || this.door.length;
      if (!anyone) { for (let i = 0; i < STOOLS; i++) if (this.stools[i].dirty) { this.closeT = (this.closeT || 0) + dt; } }
      if (!anyone && (this.closeT > 3 || !this.stools.some(s => s.dirty))) for (let i = 0; i < STOOLS; i++) this.clear(i);
      if (!anyone && !this.stools.some(s => s.dirty) && !this.cap && !this.captions.length) this.done = true;
    }
  }

  tickCaptions(dt) {
    if (this.cap) { this.capT += dt; if (this.capT >= this.captionLen(this.cap)) { this.cap = null; } }
    if (!this.cap && this.captions.length) { this.cap = this.captions.shift(); this.capT = 0; this.emit('line', { who: this.cap.who }); }
  }

  freeRun(n, from) { // n adjacent free stools at or nearest `from`
    const ok = i => { for (let k = 0; k < n; k++) { const s = this.stools[i + k]; if (!s || s.party || s.dirty || s.ghost) return false; } return true; };
    if (from != null && ok(from)) return from;
    const opts = []; for (let i = 0; i + n <= STOOLS; i++) if (ok(i)) opts.push(i);
    if (!opts.length) return -1;
    if (from != null) opts.sort((a, b) => Math.abs(a - from) - Math.abs(b - from));
    else return opts[Math.floor(this.r() * opts.length)];
    return opts[0];
  }

  seatDoor() {
    // regulars first; they will wait at the door. Strangers give up after a few seconds.
    this.door.sort((a, b) => (a.kind === 'reg' ? 0 : 1) - (b.kind === 'reg' ? 0 : 1));
    for (let i = 0; i < this.door.length; i++) {
      const p = this.door[i]; const n = p.kind === 'reg' ? p.who.length : (p.pair ? 2 : 1);
      if (p.kind === 'stranger') { // leave room for a regular who is due
        const soon = this.plan.find(q => q.kind === 'reg' && q.at - this.t < 7);
        p.waited = (p.waited || 0) + 1 / 60;
        if (soon && this.stools.filter(s => !s.party && !s.dirty && !s.ghost).length <= soon.who.length) continue;
      }
      const seat = this.freeRun(n, p.seat);
      if (seat < 0) continue;
      this.door.splice(i--, 1); this.sit(p, seat, n);
    }
    for (const p of this.door) if (p.kind === 'stranger') p.gone = (p.gone || 0) + 1 / 60;
    this.door = this.door.filter(p => !(p.kind === 'stranger' && p.gone > 9));
  }

  sit(def, seat, n) {
    const reg = def.kind === 'reg';
    const p = { ...def, id: this.nid++, seat, n, reg, got: [], need: [...def.order], state: def.hush || def.silent ? 'hush' : 'wait',
      hushT: def.hushFor || HUSH, pmax: (reg ? 80 : Math.max(21, 31 - (this.year - 1953) * .62)) * (this.easy ? 1.6 : 1), sat: this.t, mood: 'idle', q: 1, sloppy: 0, remembered: false };
    p.pat = p.pmax; this.parties.push(p);
    for (let k = 0; k < n; k++) this.stools[seat + k].party = p;
    if (p.state === 'hush' && !def.silent) this.stats.usualChances++;
    if (def.silent) this.stats.usualChances++;
    for (const l of def.say || []) this.say(l);
    if (!reg) { const yrs = Object.keys(STRANGER_LINES).map(Number).filter(y => y <= this.year).pop();
      if (this.r() < .16 && yrs && !this.captions.length) { const L = STRANGER_LINES[yrs]; this.say('stranger|' + L[Math.floor(this.r() * L.length)]); } }
    this.emit('sit', { seat, reg });
  }

  tickParties(dt, frozen) {
    for (const p of [...this.parties]) {
      if (p.state === 'hush') {
        p.hushT -= dt;
        if (p.hushT <= 0) {
          if (p.silent) { p.silent = false; p.order = [p.fallback]; p.need = [p.fallback]; p.state = 'wait'; p.pat = p.pmax; p.eat = p.missed; this.emit('reveal', { seat: p.seat }); }
          else { p.state = 'wait'; this.emit('reveal', { seat: p.seat }); }
        }
      } else if (p.state === 'wait') {
        if (!frozen && !this.noPatience) {
          const was = p.pat / p.pmax;
          p.pat -= dt; const f = p.pat / p.pmax; p.mood = f < .3 ? 'cross' : 'idle';
          if (was >= .3 && f < .3) this.emit('tick', { seat: p.seat });
          if (p.pat <= 0) { if (p.reg) { p.pat = 0; } else this.walkOut(p); }
        }
      } else if (p.state === 'eat') {
        p.eatT -= dt;
        if (p.eatT <= 0 && !(p.talks && (this.captions.length || this.cap))) this.finish(p);
      }
    }
  }

  walkOut(p) {
    p.state = 'gone'; this.parties.splice(this.parties.indexOf(p), 1);
    for (let k = 0; k < p.n; k++) this.stools[p.seat + k].party = null;
    this.stats.walked++; this.emit('walk', { seat: p.seat, party: p });
  }

  finish(p) {
    p.state = 'gone'; this.parties.splice(this.parties.indexOf(p), 1);
    const plates = p.order.map(k => k);
    const base = p.order.reduce((a, k) => a + priceOf(k, this.year), 0);
    const f = Math.max(0, p.patAtServe ?? p.pat / p.pmax);
    const tip = Math.round((base * (.05 + .3 * f) * p.q + (p.remembered ? 10 + Math.floor((this.year - 1952) / 4) * 5 : 0)) / 5) * 5;
    for (let k = 0; k < p.n; k++) this.stools[p.seat + k].party = null;
    this.stools[p.seat].dirty = { base, tip, plates, n: p.n, reg: p.reg, choice: p.choice };
    for (let k = 1; k < p.n; k++) this.stools[p.seat + k].dirty = { base: 0, tip: 0, plates: [], n: 0, follower: true };
    if (p.bye) this.say(p.bye);
    this.emit('leave', { seat: p.seat, party: p });
  }

  clear(i) {
    const s = this.stools[i]; if (!s || !s.dirty) return false;
    const d = s.dirty; s.dirty = null; this.closeT = 0;
    if (d.follower) { for (let k = i - 1; k >= 0; k--) if (this.stools[k].dirty && !this.stools[k].dirty.follower) return this.clear(k); return true; }
    for (let k = 1; k < d.n; k++) if (this.stools[i + k]) this.stools[i + k].dirty = null;
    const amt = d.onHouse ? 0 : d.base + d.tip;
    this.stats.takings += amt; this.stats.tips += d.onHouse ? 0 : d.tip;
    this.emit('clear', { seat: i, amt, reg: d.reg, n: d.n });
    return true;
  }

  // ——— stations ———
  tickStations(dt) {
    for (const key of ['urn', 'fount']) {
      const s = this[key];
      if (s.pouring && s.glass && !s.glass.ready) {
        s.glass.fill += POUR_RATE * dt;
        if (s.glass.fill >= 1.04) { s.glass.fill = 1.04; s.glass.spilled = true; this.pourStop(key); this.emit('spill', { st: key }); }
      }
    }
    for (let i = 0; i < 3; i++) {
      const g = this.griddle[i]; if (!g) continue;
      g.t += dt;
      const c = COOK[g.kind];
      if (g.state === 'a' && g.t >= c.a) { g.state = c.b ? 'flip' : 'done'; g.t = 0; this.emit('ding', { i }); }
      else if (g.state === 'flip' && this.def.helper) { this.griddleTap(i, true); }
      else if (g.state === 'flip' && g.t >= c.burn) { g.state = 'burnt'; g.t = 0; this.stats.burnt++; this.emit('burn', { i }); }
      else if (g.state === 'b' && g.t >= c.b) { g.state = 'done'; g.t = 0; this.emit('ding', { i }); }
      else if (g.state === 'done' && g.t >= c.burn) { g.state = 'burnt'; g.t = 0; this.stats.burnt++; this.emit('burn', { i }); }
    }
    for (let i = 0; i < 2; i++) { const b = this.toaster[i]; if (b && !b.ready) { b.t += dt; if (b.t >= TOAST) { b.ready = true; this.emit('pop', { i }); } } }
    for (const k of ['apple', 'cherry']) { const p = this.pie[k]; if (p.bake > 0) { p.bake -= dt; if (p.bake <= 0) { p.n = PIE_SLICES; this.emit('pieout', { k }); } } }
  }

  pourStart(st, kind) {
    const s = this[st];
    if (s.glass && s.glass.ready) return false;
    if (s.glass && s.glass.kind !== kind) { if (s.glass.fill > .05) return false; s.glass = null; }
    if (!s.glass) s.glass = { kind, fill: 0, ready: false };
    s.pouring = kind; this.emit('pour', { st, kind }); return true;
  }
  pourStop(st) {
    const s = this[st]; if (!s.pouring) return; s.pouring = null; this.emit('pourstop', { st });
    const g = s.glass; if (!g) return;
    if (g.fill >= .5) {
      g.ready = true; this.stats.pours++;
      const good = g.fill >= LINE_LO && g.fill <= LINE_HI;
      if (good) { this.stats.perfect++; g.perfect = true; this.emit('perfect', { st }); }
      g.q = good ? 1 : g.spilled ? .45 : .7;
    }
  }

  griddleAdd(kind) {
    const i = this.griddle.indexOf(null); if (i < 0) return false;
    this.griddle[i] = { kind, state: 'a', t: 0 }; this.emit('sizzle', { i }); return i;
  }
  // returns true if something happened
  griddleTap(i, auto = false) {
    const g = this.griddle[i]; if (!g) return false;
    if (g.state === 'flip') { g.state = 'b'; g.t = 0; this.emit('flip', { i }); return true; }
    if (g.state === 'burnt') { this.griddle[i] = null; this.emit('scrape', { i }); return true; }
    return false;
  }
  toast() {
    const i = this.toaster.indexOf(null); if (i < 0) return false;
    this.toaster[i] = { t: 0, ready: false }; this.emit('lever', { i }); return i;
  }

  // ref: {at:'urn'|'fount'|'griddle'|'toaster'|'pie'|'pass', i?, kind?}
  peek(ref) {
    if (ref.at === 'urn' || ref.at === 'fount') { const g = this[ref.at].glass; return g && g.ready ? { kind: g.kind, q: g.q ?? 1 } : null; }
    if (ref.at === 'griddle') { const g = this.griddle[ref.i]; return g && g.state === 'done' ? { kind: g.kind, q: g.t < 4 ? 1 : .75 } : null; }
    if (ref.at === 'toaster') { const b = this.toaster[ref.i]; return b && b.ready ? { kind: 'toast', q: 1 } : null; }
    if (ref.at === 'pie') { const p = this.pie[ref.kind]; return p && p.n > 0 ? { kind: ref.kind, q: 1 } : null; }
    if (ref.at === 'pass') return this.pass[ref.i];
    return null;
  }
  consume(ref) {
    if (ref.at === 'urn' || ref.at === 'fount') this[ref.at].glass = null;
    else if (ref.at === 'griddle') this.griddle[ref.i] = null;
    else if (ref.at === 'toaster') this.toaster[ref.i] = null;
    else if (ref.at === 'pass') this.pass[ref.i] = null;
    else if (ref.at === 'pie') { const p = this.pie[ref.kind]; p.n--; if (p.n === 0) { p.bake = PIE_BAKE; this.emit('pieempty', { k: ref.kind }); } }
  }

  // Who would an item go to if you just tapped it?
  target(kind) {
    let best = null, bf = 9;
    for (const p of this.parties) if (p.state === 'wait' && p.need.includes(kind)) { const f = p.pat / p.pmax; if (f < bf) { bf = f; best = p; } }
    return best;
  }

  // tap: send it to whoever's waited longest, or put it up on the pass
  autoServe(ref) {
    const it = this.peek(ref); if (!it) return 'none';
    const p = this.target(it.kind);
    if (p) return this.deliver(ref, it, p) ? 'served' : 'none';
    if (ref.at === 'pass') return 'stay';
    const i = this.pass.indexOf(null);
    if (i < 0) return 'full';
    this.consume(ref); this.pass[i] = it; this.emit('pass', { i, kind: it.kind }); return 'pass';
  }

  bin(ref) { const it = this.peek(ref); if (it) { this.consume(ref); this.emit('scrape'); return true; } return false; }

  // drag or tap-tap: to one stool
  serveTo(ref, seat) {
    const it = this.peek(ref); if (!it) return 'none';
    const st = this.stools[seat]; const p = st.party;
    if (!p) {
      if (st.ghost && it.kind === 'coffee' && !st.ghostCup) { this.consume(ref); st.ghostCup = true; this.flags.gusCup = true; this.say('|You set it down at the third stool, and leave it there. Nobody asks who it\u2019s for.'); this.say('|You don’t answer. Ray nods, and leaves a dime beside it.'); this.emit('serve', { seat, kind: it.kind }); return 'served'; }
      return 'none';
    }
    if (p.state === 'hush') {
      if (p.need.includes(it.kind)) {
        p.remembered = true; this.stats.usuals++; p.state = 'wait'; p.pat = p.pmax; p.mood = 'happy';
        if (p.silent) { p.eat = p.usual; p.silent = false; this.flags.dannyMilk = true; }
        this.emit('usual', { seat: p.seat, party: p });
        this.deliver(ref, it, p); return 'usual';
      }
      if (p.silent) { this.emit('nope', { seat: p.seat }); this.say('|He doesn’t look at it. You take it back.'); return 'nope'; }
      p.state = 'wait'; p.mood = 'idle'; this.emit('nope', { seat: p.seat });
      if (p.wrong) this.say(p.wrong); return 'nope';
    }
    if (p.state === 'wait' && p.need.includes(it.kind)) { this.deliver(ref, it, p); return 'served'; }
    this.emit('nope', { seat: p.seat }); return 'nope';
  }

  deliver(ref, it, p) {
    this.consume(ref);
    p.need.splice(p.need.indexOf(it.kind), 1); p.got.push(it.kind);
    p.q = Math.min(p.q, .4 + .6 * (it.q ?? 1)) * .5 + (it.q ?? 1) * .5;
    p.pat = Math.min(p.pmax, p.pat + p.pmax * .22);
    this.stats.served++; if (it.kind === 'coffee') this.stats.cups++;
    this.emit('serve', { seat: p.seat, kind: it.kind, party: p, from: ref });
    if (!p.need.length) {
      p.state = 'eat'; p.mood = p.mood === 'cross' ? 'idle' : 'happy'; p.patAtServe = p.pat / p.pmax;
      const L = p.rayEnd ? rayEndLines(this.flags) : p.eat || []; p.talks = L.length > 0;
      p.eatT = 3 + p.order.length * .8 + this.r() * 2;
      for (const l of L) this.say(l);
      this.emit('done', { seat: p.seat });
    }
    return true;
  }

  // next thing a keyboard player's Space should do
  nextReady() {
    const refs = [];
    for (let i = 0; i < 3; i++) if (this.griddle[i]) { const g = this.griddle[i]; if (g.state === 'flip' || g.state === 'burnt') return { griddle: i }; if (g.state === 'done') refs.push({ at: 'griddle', i }); }
    for (let i = 0; i < 2; i++) if (this.toaster[i]?.ready) refs.push({ at: 'toaster', i });
    if (this.urn.glass?.ready) refs.push({ at: 'urn' });
    if (this.fount.glass?.ready) refs.push({ at: 'fount' });
    for (let i = 0; i < 3; i++) if (this.pass[i]) refs.push({ at: 'pass', i });
    const hit = refs.find(r => this.target(this.peek(r).kind));
    return hit || refs[0] || null;
  }
}
