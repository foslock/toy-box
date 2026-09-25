// The piece: one slow track in D major, split into eight parts, one per speaker. Every part keeps the same clock and
// makes the same seeded choices bar by bar, so whichever speakers are on, they're playing the same song, like the
// stems of one recording. Switch a speaker on and its part joins where the others are.
//
// 64 bpm, four bars (15 s) to a chord, eight chords to a round (two minutes):
//   A  Dmaj9 · Gmaj9/D · Bm11/D · Asus4 → A/D      all over a low D pedal
//   B  Bm9 · Gmaj7♯11 · Em9 · A7sus4 → A7            the bass walks down and back home
// The flute sings mostly in A, the piano opens out in B, and the chimes ring whenever the breeze picks up.

export const BPM = 64, BEAT = 60 / BPM, BAR = BEAT * 4;
const hz = m => 440 * 2 ** ((m - 69) / 12);

export const PARTS = [
  { id: 'pad', name: 'Warm pad', color: '#e8a468' },
  { id: 'bowls', name: 'Singing bowls', color: '#d9c25e' },
  { id: 'shimmer', name: 'Shimmer', color: '#8fcbef' },
  { id: 'handpan', name: 'Handpan', color: '#8fcf9c' },
  { id: 'flute', name: 'Bamboo flute', color: '#efd98f' },
  { id: 'bass', name: 'Pedal bass', color: '#98a3ee' },
  { id: 'chimes', name: 'Wind chimes', color: '#c7aff0' },
  { id: 'piano', name: 'Felt piano', color: '#eeaabd' },
];
// How loud each part is, before the speakers are balanced for the chair.
const LEVEL = { pad: .4, bowls: .62, shimmer: .5, handpan: .4, flute: .28, bass: .112, chimes: .76, piano: .84 };

// Pad and air notes can be [midi, fromBar, toBar] to move within the chord (the suspensions resolving).
const CHORDS = [
  { bass: 38, pad: [54, 57, 61, 64], air: [69, 73, 76, 78, 81], arp: [50, 57, 64, 66, 69, 73, 76], pan: [57, 61, 62, 64, 66, 69], bowl: 50 },
  { bass: 38, pad: [55, 59, 62, 66], air: [71, 74, 78, 81], arp: [50, 55, 62, 66, 69, 71, 74], pan: [59, 62, 64, 66, 67, 69], bowl: 57 },
  { bass: 38, pad: [54, 57, 59, 64], air: [71, 74, 76, 78, 81], arp: [50, 59, 64, 66, 69, 71, 74], pan: [57, 59, 62, 64, 66, 69], bowl: 50 },
  { bass: 38, pad: [57, [62, 0, 2], [61, 2, 4], 64, 69], air: [69, [74, 0, 2], [73, 2, 4], 76, 81],
    arp: [50, 57, 62, 64, 69, 74, 76], arp2: [50, 57, 61, 64, 69, 73, 76], pan: [57, 62, 64, 69], pan2: [57, 61, 64, 69], bowl: 57 },
  { bass: 35, pad: [54, 57, 61, 62], air: [71, 73, 74, 78], arp: [47, 54, 61, 62, 66, 69, 73], pan: [57, 59, 61, 62, 66, 69], bowl: 50 },
  { bass: 31, pad: [54, 59, 61, 62], air: [71, 73, 74, 78, 79], arp: [43, 50, 54, 59, 61, 66, 71], pan: [59, 61, 62, 66, 67, 69], bowl: 50 },
  { bass: 40, pad: [55, 59, 62, 66], air: [71, 74, 78, 79], arp: [52, 59, 62, 66, 67, 71, 74], pan: [59, 62, 64, 66, 67], bowl: 64 },
  { bass: 33, pad: [55, 57, [62, 0, 2], [61, 2, 4], 64], air: [69, [74, 0, 2], [73, 2, 4], 76, 79],
    arp: [45, 52, 55, 62, 64, 69, 74], arp2: [45, 52, 55, 61, 64, 69, 73], pan: [57, 62, 64, 67, 69], pan2: [57, 61, 64, 67, 69], bowl: 57 },
];
// The bass holds a note for as long as successive chords share it: one unbroken D under the whole of A.
const RUNS = CHORDS.map((c, i) => { let s = i; while (s > 0 && CHORDS[s - 1].bass === c.bass) s--; let e = i; while (e < 7 && CHORDS[e + 1].bass === c.bass) e++; return { start: s, len: e - s + 1 }; });

// Flute phrases as [beats, scale degree], degree 0 = D4 in D major, -1 a breath. All pentatonic, so they sit over
// every chord in the round.
const PHRASES = [
  [[1, 4], [.5, 5], [2.5, 7], [1, -1], [.5, 8], [.5, 9], [1, 8], [4, 7]],
  [[2, 9], [1, 8], [1, 7], [2, 5], [4, 4]],
  [[.5, 7], [.5, 8], [3, 9], [1, 11], [1, 9], [4, 8]],
  [[3, 11], [1, 9], [1.5, 8], [.5, 7], [4, 8]],
  [[1, 5], [1, 7], [2, 8], [1, 7], [1, 5], [4, 4]],
  [[1.5, 9], [.5, 11], [2, 12], [2, 11], [1, 9], [1, 8], [4, 9]],
  [[2, 7], [1, 5], [1, 4], [2, 2], [4, 4]],
  [[.5, 8], [.5, 9], [1, 11], [2, 12], [1, 11], [.5, 9], [.5, 11], [4, 9]],
  [[4, 9], [2, 8], [2, 7], [4, 5]],
  [[1, 11], [1, 12], [3, 14], [1, 12], [2, 11], [4, 9]],
  [[1, 7], [.5, 8], [.5, 7], [2, 5], [1, -1], [1, 4], [1, 5], [4, 7]],
];
const MAJ = [0, 2, 4, 5, 7, 9, 11], PENT = [0, 1, 2, 4, 5];
const degToMidi = d => 62 + MAJ[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
function shiftPent(d, k) {                     // move a pentatonic degree k steps along the pentatonic scale
  const o = Math.floor(d / 7), i = PENT.indexOf(((d % 7) + 7) % 7), j = i + k;
  return (o + Math.floor(j / 5)) * 7 + PENT[((j % 5) + 5) % 5];
}
// Piano figures: [beat, which arpeggio note, velocity].
const PIANO = [
  [[0, 0, .62], [.5, 1, .36], [1, 2, .42], [1.5, 3, .36], [2, 4, .45], [2.5, 3, .32], [3, 5, .4], [3.5, 4, .3]],
  [[0, 0, .6], [1, 2, .38], [2, 4, .44], [3, 3, .34]],
  [[0, 0, .58], [0, 3, .36], [1.5, 5, .4], [2.5, 4, .36], [3.5, 6, .32]],
  [[0, 0, .55], [2, 3, .38], [2.5, 5, .34]],
  [[1.5, 6, .3], [3, 5, .26]],
  [[0, 6, .42], [.75, 5, .34], [1.5, 4, .34], [2.5, 2, .38], [3.25, 1, .3]],
];
// Handpan grooves in eighth notes: 'd' the low centre note, 't' a slap on the rim, a number a note of the chord.
const PAN = [
  [[0, 'd', .8], [2, 1, .5], [3, 2, .44], [5, 3, .5], [7, 1, .34]],
  [[0, 'd', .74], [3, 2, .5], [5, 1, .44]],
  [[0, 'd', .8], [1, 't', .28], [2, 3, .5], [4, 2, .54], [6, 4, .44], [7, 3, .34]],
  [[0, 'd', .7], [2, 't', .24], [4, 'd', .52], [5, 2, .44], [6, 't', .2], [7, 1, .38]],
  [[0, 'd', .74], [2, 2, .44], [2.5, 3, .3], [3, 4, .5], [6, 2, .4]],
];
const CHIMES = [86, 88, 90, 93, 95, 98];

// Seeded choices: the same bar always makes the same decision.
function rnd(bar, salt) {
  let t = (bar * 2654435761 ^ Math.imul(salt * 1000 | 0, 40503)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const chordOf = b => Math.floor(((b % 32) + 32) % 32 / 4);

export class Music {
  constructor(ctx, gustAt) {
    this.ctx = ctx; this.gustAt = gustAt; this.bank = {}; this.t0 = ctx.currentTime + .2;
    this.parts = {};
    for (const p of PARTS) {
      const out = this.gain(LEVEL[p.id]);
      out.channelCount = 1; out.channelCountMode = 'explicit';     // each speaker is one mono source
      this.parts[p.id] = { ...p, out, on: false, session: null, next: 0 };
    }
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = nb;
    this.fluteWave = ctx.createPeriodicWave(new Float32Array(8), Float32Array.from([0, 1, .24, .1, .045, .02, .01, .004]));
    // slow shared wobbles: the pad's filter breathes, every oscillator drifts a few cents, the shimmer trembles
    this.lfoFilter = this.lfo(.047, 240); this.lfoDetune = this.lfo(.13, 4.5); this.lfoVib = this.lfo(4.7, 6);
  }
  gain(v = 1) { const g = this.ctx.createGain(); g.gain.value = v; return g; }
  lfo(f, depth) { const o = this.ctx.createOscillator(), g = this.gain(depth); o.frequency.value = f; o.connect(g); o.start(); return g; }
  osc(type, f, t, stop, dest, det = 0) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
    o.connect(dest); o.start(t); o.stop(stop);
    return o;
  }
  filter(type, f, q = .7) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  timeOf(bar, beat = 0) { return this.t0 + (bar * 4 + beat) * BEAT; }
  barAt(t) { return Math.floor((t - this.t0) / BAR); }
  setBank(bank) { this.bank = bank; }

  /* ---------- switching parts on and off ---------- */
  set(id, on) {
    const p = this.parts[id], now = this.ctx.currentTime;
    if (!p || p.on === on) return;
    p.on = on;
    if (on) {
      const s = p.session = { out: this.gain(0), nodes: [] };
      s.out.connect(p.out);
      s.out.gain.setValueAtTime(0, now); s.out.gain.linearRampToValueAtTime(1, now + 2.2);
      const from = now + .05, b = Math.max(0, this.barAt(from));
      this.enter(p.id, s, from, b);
      this.bar(p.id, s, b, this.timeOf(b), from);
      p.next = b + 1;
    } else {
      const s = p.session; p.session = null;
      s.out.gain.cancelScheduledValues(now); s.out.gain.setValueAtTime(s.out.gain.value, now); s.out.gain.linearRampToValueAtTime(0, now + 1.8);
      for (const n of s.nodes) try { n.node.stop(now + 1.9); } catch {}
      setTimeout(() => s.out.disconnect(), 2500);
    }
  }
  schedule(until) {
    const now = this.ctx.currentTime;
    for (const p of Object.values(this.parts)) {
      if (!p.on) continue;
      while (this.timeOf(p.next) < until) { this.bar(p.id, p.session, p.next, this.timeOf(p.next), 0); p.next++; }
      const s = p.session;
      if (s.nodes.length > 60) s.nodes = s.nodes.filter(n => n.end > now);
    }
  }
  track(s, node, end) { s.nodes.push({ node, end }); return node; }

  // A part that's switched on mid-chord picks up the chord's held sounds straight away.
  enter(id, s, from, b) {
    const cb = b - b % 4, ci = chordOf(b), cs = this.timeOf(cb), ce = this.timeOf(cb + 4);
    if (id === 'pad' && from > cs) this.padChord(s, ci, cs, from, ce);
    if (id === 'shimmer' && from > cs) this.airChord(s, ci, cb, from);
    if (id === 'bass') {
      const run = RUNS[ci], rs = cb - (ci - run.start) * 4;
      if (from > this.timeOf(rs)) this.bassNote(s, CHORDS[ci].bass, from, this.timeOf(rs + run.len * 4));
    }
  }
  bar(id, s, b, t, from) {
    if (b < 0) return;
    const ci = chordOf(b), bi = b % 4, ch = CHORDS[ci];
    switch (id) {
      case 'pad': if (bi === 0 && t >= from) this.padChord(s, ci, t, t, t + 4 * BAR); break;
      case 'shimmer': if (bi === 0 && t >= from) this.airChord(s, ci, b, t); break;
      case 'bass': {
        const run = RUNS[ci];
        if (bi === 0 && ci === run.start && t >= from) this.bassNote(s, ch.bass, t, t + run.len * 4 * BAR);
        break;
      }
      case 'piano': this.pianoBar(s, b, t, from); break;
      case 'handpan': this.handpanBar(s, b, t, from); break;
      case 'flute': this.fluteBar(s, b, t, from); break;
      case 'bowls': this.bowlsBar(s, b, t, from); break;
      case 'chimes': this.chimesBar(s, b, t, from); break;
    }
  }

  /* ---------- sustained parts ---------- */
  // Pedal bass: a deep sine with a slow beat against its twin, a touch of its octave and twelfth so it can be heard
  // (and placed) on small speakers, and a sub-octave for headphones.
  bassNote(s, m, t, end) {
    const f = hz(m), g = this.gain(0), att = t > this.ctx.currentTime + .2 ? 1.4 : .8;
    g.gain.setValueAtTime(0, t); g.gain.setTargetAtTime(1, t, att); g.gain.setTargetAtTime(0, end, 1.7);
    g.connect(s.out);
    const stop = end + 9;
    const partials = [[f, .78], [f + .13, .42], [f * 2, .3], [f * 3, .085], [f * 4, .03]];
    if (f / 2 > 34) partials.push([f / 2, .22]);
    for (const [fr, a] of partials) { const og = this.gain(a); og.connect(g); this.track(s, this.osc('sine', fr, t, stop, og), stop); }
    const lp = this.filter('lowpass', 240, .5), tg = this.gain(.28); lp.connect(tg); tg.connect(g);
    this.track(s, this.osc('triangle', f, t, stop, lp), stop);
  }
  // Warm pad: each chord note is two slightly detuned saws and a triangle, all through a soft, slowly breathing filter.
  padChord(s, ci, cs, from, end) {
    const ch = CHORDS[ci], f1 = this.filter('lowpass', 1050, .55), f2 = this.filter('lowpass', 1600, .4), hp = this.filter('highpass', 135, .5);
    this.lfoFilter.connect(f1.frequency);
    f1.connect(f2); f2.connect(hp); hp.connect(s.out);
    const late = from > cs + .05;
    for (const n of ch.pad) {
      const [m, a, b] = Array.isArray(n) ? n : [n, 0, 4];
      const ns = Math.max(from, cs + a * BAR), ne = b >= 4 ? end : cs + b * BAR;
      if (ne - ns < .8) continue;
      const g = this.gain(0), soft = a > 0 || late;
      g.gain.setValueAtTime(0, ns); g.gain.setTargetAtTime(.2, ns, soft ? .55 : 1.25); g.gain.setTargetAtTime(0, ne, b < 4 ? .6 : 1.7);
      g.connect(f1);
      const stop = ne + (b < 4 ? 4 : 9), f = hz(m);
      for (const [type, det, v] of [['sawtooth', -7, .42], ['sawtooth', 8, .42], ['triangle', 0, .75]]) {
        const og = this.gain(v); og.connect(g);
        this.track(s, this.drift(this.osc(type, f, ns, stop, og, det), this.lfoDetune), stop);
      }
    }
    setTimeout(() => { try { this.lfoFilter.disconnect(f1.frequency); } catch {} }, (end - this.ctx.currentTime + 12) * 1000);
  }
  // Tie an oscillator's detune to a shared wobble, and untie it when the oscillator stops, so nothing leaks.
  drift(o, lfo) { lfo.connect(o.detune); o.onended = () => { try { lfo.disconnect(o.detune); } catch {} }; return o; }
  // Shimmer: glassy high notes from the chord that swell in and out on their own, overlapping.
  airChord(s, ci, cb, from) {
    const ch = CHORDS[ci], cs = this.timeOf(cb), n = 7;
    for (let i = 0; i < n; i++) {
      const t = cs + (i + rnd(cb, 100 + i) * .8) * (4 * BAR) / n, bar = Math.floor((t - cs) / BAR);
      if (t < from) continue;
      const pool = ch.air.filter(x => !Array.isArray(x) || (bar >= x[1] && bar < x[2])).map(x => Array.isArray(x) ? x[0] : x);
      const m = pool[Math.floor(rnd(cb, 120 + i) * pool.length)];
      const att = 1.6 + rnd(cb, 140 + i) * 2, hold = .6 + rnd(cb, 160 + i) * 1.6, rel = 2.6 + rnd(cb, 180 + i) * 2.4;
      this.glint(s, m, t, att, hold, rel, .07 + rnd(cb, 200 + i) * .05);
    }
  }
  glint(s, m, t, att, hold, rel, amp) {
    const f = hz(m), g = this.gain(0), end = t + att + hold + rel;
    g.gain.setValueCurveAtTime(swell(amp, false), t, att); g.gain.setValueAtTime(amp, t + att + hold); g.gain.setValueCurveAtTime(swell(amp, true), t + att + hold, rel);
    g.connect(s.out);
    for (const [type, r, v] of [['sine', 1, 1], ['triangle', 2, .09], ['sine', 3, .025]]) {
      const og = this.gain(v); og.connect(g);
      this.track(s, this.drift(this.osc(type, f * r, t, end + .05, og), this.lfoVib), end);
    }
  }

  /* ---------- sampled parts ---------- */
  play(s, group, key, t, v, bright = 0) {
    const buf = this.bank[group]?.[key];
    if (!buf || t < this.ctx.currentTime) return;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.gain(v);
    if (bright) { const lp = this.filter('lowpass', bright, .5); src.connect(lp); lp.connect(g); } else src.connect(g);
    g.connect(s.out);
    src.start(t);
    this.track(s, src, t + buf.duration);
  }
  fluteBusy(b) {
    const cb = b - b % 4, plan = this.flutePlan(cb);
    if (!plan) return false;
    const len = plan.ph.reduce((a, [d]) => a + d, 0) + plan.beat;
    return b >= plan.bar && (b - plan.bar) * 4 < len;
  }
  pianoBar(s, b, t, from) {
    const ci = chordOf(b), ch = CHORDS[ci], bi = b % 4, r = rnd(b, 11), inB = ci >= 4;
    const arp = ch.arp2 && bi >= 2 ? ch.arp2 : ch.arp, busy = this.fluteBusy(b);
    let pat;
    if (busy) pat = PIANO[bi === 0 ? 3 : r < .6 ? 4 : 3];
    else if (bi === 0) pat = PIANO[r < .5 ? 1 : 2];
    else if (bi === 1) pat = PIANO[r < .5 ? 3 : 5];
    else if (bi === 2) pat = PIANO[inB && r < .55 ? 0 : 1];
    else pat = PIANO[r < .5 ? 4 : 5];
    for (const [beat, i, v] of pat) {
      const nt = t + (beat + (beat % 1 === .5 ? .06 : 0)) * BEAT + (beat ? .015 : 0) + (rnd(b, beat * 10 + i) - .5) * .035;
      if (nt < from) continue;
      const vel = v * (.85 + rnd(b, 50 + beat * 3 + i) * .3);
      this.play(s, 'piano', arp[Math.min(i, arp.length - 1)], nt, vel * 1.35, 700 + 6500 * vel * vel);
    }
  }
  handpanBar(s, b, t, from) {
    const ci = chordOf(b), ch = CHORDS[ci], bi = b % 4;
    if (b % 32 < 2) return;                                              // a breath at the top of every round
    if (rnd(b, 21) < (ci < 4 ? (bi % 2 ? .45 : .2) : .15)) return;       // and plenty of rests in the calm half
    const notes = ch.pan2 && bi >= 2 ? ch.pan2 : ch.pan, pat = PAN[Math.floor(rnd(b, 22) * PAN.length)], shift = Math.floor(rnd(b, 23) * notes.length);
    for (const [step, sel, v] of pat) {
      const nt = t + (step + (step % 1 ? 0 : step % 2) * .12) * BEAT / 2 + (rnd(b, 30 + step) - .5) * .03;   // a lilt: off-beats land a touch late
      if (nt < from) continue;
      const vel = v * (.85 + rnd(b, 40 + step) * .3);
      if (sel === 'd') this.play(s, 'handpan', 50, nt, vel);
      else if (sel === 't') this.play(s, 'handpan', rnd(b, step) < .5 ? 'tak' : 'tak2', nt, vel);
      else this.play(s, 'handpan', notes[(sel + shift) % notes.length], nt, vel);
    }
  }
  bowlsBar(s, b, t, from) {
    const ci = chordOf(b), ch = CHORDS[ci], bi = b % 4;
    if (bi === 0) {
      if (ci === 0 && rnd(b, 41) < .5) { if (t - 2.5 >= from) this.play(s, 'sung', 50, t - 2.5, .95); }
      else if (t >= from) this.play(s, 'bowl', ch.bowl, t + (rnd(b, 42) - .5) * .04, .72 + rnd(b, 43) * .2);
    }
    if (bi === 2 && rnd(b, 44) < .4) {
      const others = [50, 57, 62, 64].filter(x => x !== ch.bowl), nt = t + BEAT * (rnd(b, 45) < .5 ? 0 : 2);
      if (nt >= from) this.play(s, 'bowl', others[Math.floor(rnd(b, 46) * others.length)], nt, .38 + rnd(b, 47) * .2);
    }
    if (ci === 4 && bi === 0 && rnd(b, 48) < .6 && t + 3 >= from) this.play(s, 'sung', 57, t + 3, .7);
  }
  chimesBar(s, b, t, from) {
    const step = .25;
    for (let k = 0; k < BAR / step; k++) {
      const tt = t + k * step;
      if (tt < from) continue;
      const g = this.gustAt(tt), rate = .08 + 2.6 * g * g * g;
      if (rnd(b, 300 + k) >= rate * step) continue;
      const n = 1 + Math.floor(rnd(b, 400 + k) * (1 + g * 3.5));
      for (let j = 0; j < n; j++) {
        const jt = tt + j * (.07 + rnd(b, 500 + k * 7 + j) * .16);
        this.play(s, 'chime', CHIMES[Math.floor(rnd(b, 600 + k * 7 + j) * CHIMES.length)], jt, (.25 + .6 * rnd(b, 700 + k * 7 + j)) * (.45 + .7 * g));
      }
    }
  }

  /* ---------- the flute ---------- */
  flutePlan(cb) {
    const ci = chordOf(cb), r = rnd(cb, 31);
    if (r > (ci < 4 ? .8 : .42)) return null;
    return { bar: cb + (rnd(cb, 32) < .62 ? 0 : 1), beat: rnd(cb, 33) < .5 ? .5 : 1, ph: PHRASES[Math.floor(rnd(cb, 34) * PHRASES.length)], shift: [0, 0, 0, 1, -1][Math.floor(rnd(cb, 35) * 5)] };
  }
  fluteBar(s, b, t, from) {
    const plan = this.flutePlan(b - b % 4);
    if (!plan || plan.bar !== b) return;
    const t0 = t + plan.beat * BEAT;
    if (t0 < from) return;                                               // never come in mid-phrase
    this.flutePhrase(s, plan, t0, b);
  }
  // A breathy bamboo flute: a soft, nearly pure tone with a little breath noise, notes slurred with small pitch
  // glides, vibrato that blooms late in long notes, swells, and a sag in pitch as each breath runs out.
  flutePhrase(s, plan, t0, b) {
    const ctx = this.ctx, notes = [];
    let t = t0;
    for (const [d, dg] of plan.ph) { notes.push({ t, dur: d * BEAT, m: dg < 0 ? null : degToMidi(shiftPent(dg, plan.shift)) }); t += d * BEAT; }
    const end = t + 1.5;
    const o = ctx.createOscillator(); o.setPeriodicWave(this.fluteWave);
    const amp = this.gain(0), tone = this.filter('lowpass', 3600, .5);
    o.connect(tone); tone.connect(amp); amp.connect(s.out);
    const vib = ctx.createOscillator(), vibG = this.gain(0); vib.frequency.value = 4.8 + rnd(b, 80) * .7; vib.connect(vibG); vibG.connect(o.frequency);
    const nz = ctx.createBufferSource(); nz.buffer = this.noise; nz.loop = true;
    const bp = this.filter('bandpass', 600, 3.5), breath = this.gain(.075), hp = this.filter('highpass', 3800, .5), air = this.gain(.018);
    nz.connect(bp); bp.connect(breath); breath.connect(amp); nz.connect(hp); hp.connect(air); air.connect(amp);
    const chiff = this.gain(0), cbp = this.filter('bandpass', 2000, 1.2); nz.connect(cbp); cbp.connect(chiff); chiff.connect(s.out);
    const f0 = hz(notes.find(n => n.m).m);
    o.frequency.setValueAtTime(f0, t0 - .05); bp.frequency.setValueAtTime(f0, t0 - .05);
    let fresh = true;
    notes.forEach((n, i) => {
      if (!n.m) { fresh = true; return; }
      const f = hz(n.m), next = notes[i + 1], last = !next || !next.m;
      const v = (.38 + .12 * Math.sin(Math.PI * (i + .5) / notes.length) + (rnd(b, 90 + i) - .5) * .06) * (n.m > 80 ? .85 : 1);
      const jit = (rnd(b, 110 + i) - .5) * .03, nt = n.t + jit;
      if (fresh) {                                                      // a new breath: scoop up into the note, with a puff
        o.frequency.setValueAtTime(f * .983, nt); o.frequency.setTargetAtTime(f, nt, .035);
        bp.frequency.setValueAtTime(f, nt);
        amp.gain.setTargetAtTime(v, nt, .05);
        chiff.gain.setTargetAtTime(v * .16, nt, .006); chiff.gain.setTargetAtTime(0, nt + .05, .04);
      } else {                                                          // slurred: glide, with a tiny dip in the breath
        o.frequency.setTargetAtTime(f, nt, .024); bp.frequency.setTargetAtTime(f, nt, .02);
        amp.gain.setTargetAtTime(v * .84, nt - .035, .014); amp.gain.setTargetAtTime(v, nt + .03, .05);
      }
      tone.frequency.setTargetAtTime(2300 + 5200 * v * v, nt, .08);        // blown harder, the tone brightens
      vibG.gain.setTargetAtTime(0, nt, .04);
      if (n.dur > .9) vibG.gain.setTargetAtTime(f * (.0045 + rnd(b, 130 + i) * .002), nt + .32, .28);
      if (n.dur > 1.4) amp.gain.setTargetAtTime(v * 1.12, nt + .35, n.dur * .3);
      if (last) {
        const e = n.t + n.dur * (next ? .9 : 1);
        amp.gain.setTargetAtTime(0, e - .2, .11);
        o.frequency.setTargetAtTime(f * .99, e - .25, .15);
      }
      fresh = last;
    });
    for (const node of [o, vib, nz]) { node.start(t0 - .05); node.stop(end); this.track(s, node, end); }
  }
}

// An equal-power swell, for setValueCurveAtTime.
const CURVES = new Map();
function swell(amp, down) {
  const key = amp.toFixed(3) + down;
  if (!CURVES.has(key)) CURVES.set(key, Float32Array.from({ length: 32 }, (_, i) => { const u = i / 31; return amp * Math.sin((down ? 1 - u : u) * Math.PI / 2) ** 2; }));
  return CURVES.get(key);
}
