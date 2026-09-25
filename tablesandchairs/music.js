// Everything you hear, synthesized with Web Audio: no samples.
//
// The score follows one number, heat (0–1), which the game raises as the tower gets taller.
//   0      spa: slow warm pads in E major, wind chimes, a singing bowl, the sea, about 62 bpm
//   ~.15   a kalimba starts picking out the chords
//   ~.25   a shaker and a round sub bass; the tempo starts to creep up
//   ~.4    a real groove: kick, snare, hats, a bass line that moves
//   ~.5    the key darkens to E minor, the pads fade, overdriven power chords come in
//   ~.7    palm-muted chugging, driving kick, crashes, past 140 bpm
//   ~.8    E phrygian metal: gallop riffs, double kick, blast beats, a screaming lead, up to 180 bpm
// Heat glides towards its target a little on every sixteenth note, so each placement nudges the
// music along instead of switching tracks.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const rnd = Math.random;

// Chords as a root (semitones above E) and the tones stacked on it.
const SPA = [{ root: 0, tones: [0, 7, 11, 14, 16] },    // Emaj9
  { root: 9, tones: [0, 7, 10, 14, 15] },                // C#m9
  { root: 5, tones: [0, 7, 11, 14, 16] },                // Amaj9
  { root: 7, tones: [0, 5, 7, 10, 14] }];                // Bsus
const ROCK = [{ root: 0, tones: [0, 7, 12, 15, 19] },   // Em
  { root: 8, tones: [0, 7, 12, 16, 19] },                // C
  { root: 10, tones: [0, 7, 12, 16, 19] },               // D
  { root: 7, tones: [0, 7, 12, 16, 19] }];               // B
// Metal riffs, one sixteenth per entry: 0 is a palm-muted low E chug, anything else rings out as a power chord
// that many semitones up.
const RIFFS = [
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 3, 0, 1, 0],
  [0, 0, 0, 0, 0, 0, 6, 0, 5, 0, 3, 0, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 3, 0, 0, 1, 0],
  [0, 0, 0, 0, 7, 0, 6, 0, 5, 0, 3, 0, 1, 0, 1, 0],
];
const PENTA = [0, 2, 4, 7, 9];                 // E major pentatonic, for the chimes
const PHRYG = [0, 1, 4, 5, 7, 8, 10];          // E phrygian dominant, for the lead

function noiseBuffer(ctx, secs) {
  const b = ctx.createBuffer(1, secs * ctx.sampleRate | 0, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
  return b;
}
function impulse(ctx, secs, decay) {
  const len = secs * ctx.sampleRate | 0, b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, decay) * Math.min(1, i / 300);
  }
  return b;
}
function driveCurve(k) {
  const n = 2048, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); }
  return c;
}

export class Music {
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.heat = 0; this.target = 0;
    this.stepN = 0; this.next = 0; this.quietUntil = 0;
    this.chord = SPA[0]; this.riff = RIFFS[0]; this.phrase = 'rest';
    this.out = this.gain(.72); this.out.connect(dest);
    this.verb = ctx.createConvolver(); this.verb.buffer = impulse(ctx, 3.6, 2.4);
    this.verbIn = this.gain(1); this.verbIn.connect(this.verb); this.verb.connect(this.out);
    this.noise = noiseBuffer(ctx, 2);
    this.bus = {};
    for (const [name, send] of [['pad', .75], ['chime', .9], ['bowl', .7], ['sea', .35], ['kal', .5], ['bass', 0], ['drum', .1], ['gtr', .08], ['lead', .3], ['fx', .6]]) {
      const g = this.gain(name === 'fx' ? 1 : 0); g.connect(this.out);
      if (send) { const s = this.gain(send); g.connect(s); s.connect(this.verbIn); }
      this.bus[name] = g;
    }
    // bass through a gentle saturator
    this.bassIn = this.gain(1);
    const bs = ctx.createWaveShaper(); bs.curve = driveCurve(1.6);
    this.bassDrive = this.gain(1);
    this.bassIn.connect(this.bassDrive); this.bassDrive.connect(bs); bs.connect(this.bus.bass);
    this.amp = this.guitarAmp(this.bus.gtr);
    this.leadAmp = this.leadChain(this.bus.lead);
    this.sea();
  }
  gain(v) { const g = this.ctx.createGain(); g.gain.value = v; return g; }
  osc(type, f, t, stop, dest, det = 0) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
    o.connect(dest); o.start(t); o.stop(stop);
    return o;
  }
  filter(type, f, q = .7) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  // A gain node with an attack/decay envelope that ends silent at t + dur.
  env(t, a, v, dur, dest, exp = true) {
    const g = this.gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a);
    if (exp) g.gain.exponentialRampToValueAtTime(.0001, t + dur); else g.gain.linearRampToValueAtTime(0, t + dur);
    g.connect(dest);
    return g;
  }

  bpm() { return 62 + 118 * Math.pow(this.heat, 1.15); }
  levels(h) {
    return {
      pad: (1 - sm(.42, .62, h)) * .27,
      chime: (1 - sm(.25, .5, h)) * .8,
      bowl: (1 - sm(.1, .3, h)) * .8,
      sea: (1 - sm(.12, .42, h)) * .3,
      kal: sm(.1, .22, h) * (1 - sm(.5, .66, h)) * 1,
      bass: sm(.2, .34, h) * .26,
      drum: sm(.22, .36, h) * .75,
      gtr: sm(.46, .6, h) * 1.2,
      lead: sm(.8, .9, h) * .7,
    };
  }

  begin(t = this.ctx.currentTime + .08) { this.next = t; this.stepN = 0; }
  reset() { this.heat = this.target = 0; }
  scheduleUntil(until) {
    while (this.next < until) {
      if (this.next < this.quietUntil) { this.next = this.quietUntil; this.stepN = 0; this.heat = this.target = 0; continue; }
      const d = 15 / this.bpm();
      this.heat += clamp(this.target - this.heat, -d * .15, d * .06);
      this.play(this.stepN, this.next, d);
      this.next += d; this.stepN++;
    }
  }

  play(n, t, d) {
    const s = n & 15, bar = n >> 4, h = this.heat, L = this.levels(h);
    for (const k in L) this.bus[k].gain.setTargetAtTime(L[k], t, .35);
    this.amp.drive.gain.setTargetAtTime(1.5 + 13 * sm(.5, .95, h), t, .3);
    this.bassDrive.gain.setTargetAtTime(1 + 1.2 * sm(.6, 1, h), t, .3);
    if (s === 0) this.newBar(bar, t, d, h, L);
    const ch = this.chord;
    if (L.chime > .01 && s % 2 === 0 && rnd() < .2) {
      const m = 76 + PENTA[rnd() * 5 | 0] + 12 * (rnd() * 2 | 0);
      this.bell(t + rnd() * d * .5, m, .5 + rnd() * .5);
    }
    if (L.kal > .01 && s % 2 === 0) {
      const i = s >> 1, pat = [0, 2, 1, 3, 2, 4, 3, 1];
      if (!(h < .3 && i % 2 && rnd() < .5)) this.kalimba(t, 64 + ch.root - (ch.root > 5 ? 12 : 0) + ch.tones[pat[i] % ch.tones.length], i === 0 ? 1 : .6);
    }
    this.drums(s, bar, t, d, h);
    this.bassLine(s, t, d, h);
    this.guitar(s, t, d, h);
    this.leadLine(s, bar, t, d);
  }

  newBar(bar, t, d, h, L) {
    this.section = h < .5 ? 'spa' : h < .8 ? 'rock' : 'metal';
    this.chord = this.section === 'metal' ? { root: 0, tones: [0, 7, 12] } : (this.section === 'spa' ? SPA : ROCK)[bar % 4];
    this.riff = RIFFS[bar % 4];
    if (L.pad > .01) this.pad(t, this.chord, d * 16);
    if (L.bowl > .01 && bar % 4 === 0) this.bowl(t, bar % 8 ? 47 : 40, .8, this.bus.bowl);
    this.phrase = bar % 2 ? ['run', 'hold', 'trill', 'climb'][rnd() * 4 | 0] : (rnd() < .5 ? 'rest' : 'hold');
  }

  /* ---------- spa ---------- */
  pad(t, ch, dur) {
    let root = 52 + ch.root; if (root > 57) root -= 12;
    const end = t + dur, rel = 2.8, att = Math.min(1.6, dur * .45);
    for (const iv of ch.tones) {
      const f = hz(root + iv), g = this.gain(0), lp = this.filter('lowpass', 1100, .4);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.14, t + att); g.gain.setValueAtTime(.14, end); g.gain.linearRampToValueAtTime(0, end + rel);
      lp.connect(g); g.connect(this.bus.pad);
      for (const [type, det, v] of [['triangle', -6, 1], ['sine', 7, .8], ['sine', 1203, .1]]) {
        const og = this.gain(v); og.connect(lp);
        this.osc(type, f, t, end + rel + .05, og, det);
      }
    }
  }
  bell(t, m, v, dest = this.bus.chime) {
    const f = hz(m), pan = this.ctx.createStereoPanner(); pan.pan.value = rnd() * 1.4 - .7; pan.connect(dest);
    for (const [r, a, dec] of [[1, 1, 3.2], [2.76, .35, 1.6], [5.4, .16, .8], [8.93, .08, .4]]) {
      this.osc('sine', f * r, t, t + dec + .05, this.env(t, .004, a * v * .3, dec, pan));
    }
  }
  bowl(t, m, v, dest) {
    const f = hz(m);
    for (const [r, a, dec, beat] of [[1, .5, 9, .7], [2.71, .2, 6, 1.3], [5.12, .07, 3, 2.1]]) {
      for (const sgn of [-1, 1]) this.osc('sine', f * r + sgn * beat / 2, t, t + dec + .05, this.env(t, .03, a * v * .5, dec, dest));
    }
  }
  sea() {
    const src = this.ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const lp = this.filter('lowpass', 520, .3), swell = this.gain(.5), lfoG = this.gain(.45);
    src.connect(lp); lp.connect(swell); swell.connect(this.bus.sea);
    this.osc('sine', .075, this.ctx.currentTime, 1e9, lfoG); lfoG.connect(swell.gain);
    const lfo2 = this.gain(180); lfo2.connect(lp.frequency); this.osc('sine', .031, this.ctx.currentTime, 1e9, lfo2);
    src.start();
  }
  kalimba(t, m, v) {
    const f = hz(m), pan = this.ctx.createStereoPanner(); pan.pan.value = clamp((m - 76) / 14, -.6, .6); pan.connect(this.bus.kal);
    this.osc('sine', f, t, t + 1.5, this.env(t, .003, v * .5, 1.4, pan));
    this.osc('sine', f * 4.07, t, t + .2, this.env(t, .001, v * .12, .12, pan));
    this.osc('triangle', f * 2, t, t + .5, this.env(t, .002, v * .06, .4, pan));
  }

  /* ---------- drums ---------- */
  hit(t, dur, type, f, q, v, att = .001, dest = this.bus.drum) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noise;
    const b = this.filter(type, f, q); src.connect(b); b.connect(this.env(t, att, v, dur, dest));
    src.start(t, rnd() * 1.5, dur + .05);
  }
  kick(t, v, tight, dest = this.bus.drum) {
    const o = this.osc('sine', tight ? 170 : 130, t, t + .5, this.env(t, .002, v, tight ? .2 : .42, dest));
    o.frequency.setValueAtTime(tight ? 170 : 130, t); o.frequency.exponentialRampToValueAtTime(tight ? 52 : 44, t + (tight ? .06 : .11));
    this.hit(t, .008, 'highpass', 2500, .5, v * (tight ? .5 : .18), .001, dest);
  }
  snare(t, v, dest = this.bus.drum) {
    this.hit(t, .19, 'bandpass', 2400, .7, v * .9, .001, dest);
    this.hit(t, .12, 'highpass', 5000, .5, v * .45, .001, dest);
    const o = this.osc('triangle', 200, t, t + .15, this.env(t, .001, v * .55, .09, dest));
    o.frequency.exponentialRampToValueAtTime(150, t + .05);
  }
  rim(t, v) { this.hit(t, .035, 'bandpass', 1800, 4, v * 2.5); this.osc('sine', 1700, t, t + .05, this.env(t, .001, v * .15, .03, this.bus.drum)); }
  hat(t, v, open) { this.hit(t, open ? .32 : .045, 'highpass', 7800, .6, v * .5); }
  shaker(t, v) { this.hit(t, .07, 'bandpass', 6200, 1.2, v * 2.4, .018); }
  crash(t, v, dest = this.bus.drum) { this.hit(t, 1.9, 'highpass', 3800, .4, v * .45, .001, dest); this.hit(t, 1.1, 'bandpass', 7200, .9, v * .3, .001, dest); }
  ride(t, v) { this.hit(t, .45, 'bandpass', 6800, 2.5, v * .3); this.osc('sine', 3400, t, t + .3, this.env(t, .001, v * .04, .25, this.bus.drum)); }
  tom(t, m, v, dest = this.bus.drum) {
    const f = hz(m), o = this.osc('sine', f, t, t + .4, this.env(t, .002, v * .8, .34, dest));
    o.frequency.exponentialRampToValueAtTime(f * .7, t + .22);
    this.hit(t, .05, 'lowpass', 900, .5, v * .3, .001, dest);
  }

  drums(s, bar, t, d, h) {
    if (h < .2) return;
    const fillBar = bar % 4 === 3;
    if (h < .36) {                                                    // shaker and a soft pulse
      if (s % 2 === 0) this.shaker(t, s % 4 === 2 ? .6 : .35);
      if (s === 0) this.kick(t, .7, false);
      if (s === 8) this.rim(t, .45);
      return;
    }
    if (h < .52) {                                                    // groove
      if (s === 0 || s === 8 || s === 10) this.kick(t, .75, false);
      if (s === 4 || s === 12) this.snare(t, .5);
      if (s % 2 === 0) this.hat(t, s % 4 === 0 ? .5 : .32, s === 14 && fillBar);
      if (s % 2 === 1 && rnd() < .3) this.shaker(t, .25);
      return;
    }
    if (h < .7) {                                                     // rock
      if (s === 0 || s === 6 || s === 8 || s === 10) this.kick(t, .85, false);
      if (s === 4 || s === 12) this.snare(t, .8);
      if (s % 2 === 0 && !(fillBar && s >= 12)) this.hat(t, s % 4 === 0 ? .6 : .4, s === 14);
      if (s === 0 && bar % 4 === 0) this.crash(t, .7);
      if (fillBar && s >= 12) this.tom(t, [50, 47, 43, 40][s - 12], .8);
      return;
    }
    if (h < .86) {                                                    // hard rock, driving
      if (s % 2 === 0 || s === 7 || s === 15) this.kick(t, .85, true);
      if (s === 4 || s === 12) this.snare(t, .9);
      if (s % 2 === 0 && !(fillBar && s >= 8)) this.ride(t, s % 4 === 0 ? .8 : .5);
      if (s === 0 && bar % 2 === 0) this.crash(t, .8);
      if (fillBar && s >= 8) this.tom(t, [52, 52, 50, 50, 47, 47, 43, 40][s - 8], .75);
      return;
    }
    this.kick(t, .62, true);                                          // metal: double kick on every sixteenth
    if (bar % 4 === 3) { if (s % 2 === 1) this.snare(t, .7); }        // a bar of blast beat
    else if (s === 4 || s === 12) this.snare(t, .9);
    if (s % 4 === 0) this.crash(t, s === 0 ? .7 : .35);
  }

  /* ---------- bass ---------- */
  bassNote(t, m, dur, v, bright) {
    const f = hz(m), g = this.gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .006); g.gain.linearRampToValueAtTime(v * .7, t + dur * .6); g.gain.linearRampToValueAtTime(0, t + dur + .03);
    g.connect(this.bassIn);
    if (bright < .15) { this.osc('sine', f, t, t + dur + .06, g); const h2 = this.gain(.15); h2.connect(g); this.osc('sine', f * 2, t, t + dur + .06, h2); return; }
    const lp = this.filter('lowpass', 160 + 2200 * bright, 1.6); lp.connect(g);
    this.osc('sawtooth', f, t, t + dur + .06, lp);
    const sub = this.gain(.5); sub.connect(g); this.osc('sine', f, t, t + dur + .06, sub);
  }
  bassLine(s, t, d, h) {
    if (h < .2) return;
    const root = this.section === 'metal' ? this.riff[s] : this.chord.root;
    let m = 40 + root; if (m > 45) m -= 12;
    if (h < .36) { if (s === 0) this.bassNote(t, m, d * 15, .55, 0); return; }
    if (h < .52) { if (s === 0 || s === 6 || s === 8 || s === 14) this.bassNote(t, s === 14 ? m + 7 : m, d * 1.8, .6, .12 + h * .2); return; }
    if (h < .7) { if (s % 2 === 0) this.bassNote(t, m, d * 1.7, .6, .45); return; }
    if (this.section !== 'metal') { this.bassNote(t, m, d * .9, .55, .65); return; }
    this.bassNote(t, m, d * .9, .55, .8);
  }

  /* ---------- guitars ---------- */
  guitarAmp(dest) {
    const c = this.ctx, input = this.gain(1), drive = this.gain(2), shaper = c.createWaveShaper();
    shaper.curve = driveCurve(3); shaper.oversample = '4x';
    const tight = this.filter('highpass', 110, .7), scoop = this.filter('peaking', 420, 1), bite = this.filter('peaking', 1900, 1.2), cab = this.filter('lowpass', 4800, .7);
    scoop.gain.value = -5; bite.gain.value = 4;
    const out = this.gain(.3), l = c.createStereoPanner(), r = c.createStereoPanner(), dl = c.createDelay(.05);
    l.pan.value = -.7; r.pan.value = .7; dl.delayTime.value = .014;
    input.connect(tight); tight.connect(drive); drive.connect(shaper); shaper.connect(scoop); scoop.connect(bite); bite.connect(cab); cab.connect(out);
    out.connect(l); l.connect(dest); out.connect(dl); dl.connect(r); r.connect(dest);
    return { input, drive };
  }
  power(t, m, dur, v, mute) {
    const g = this.gain(0);
    g.gain.setValueAtTime(0, t);
    if (mute) { g.gain.linearRampToValueAtTime(v, t + .002); g.gain.exponentialRampToValueAtTime(.001, t + Math.min(dur, .13)); dur = Math.min(dur, .14); }
    else { g.gain.linearRampToValueAtTime(v, t + .003); g.gain.linearRampToValueAtTime(v * .7, t + dur * .8); g.gain.linearRampToValueAtTime(0, t + dur + .05); }
    let into = g;
    if (mute) { const lp = this.filter('lowpass', 850, .8); g.connect(lp); lp.connect(this.amp.input); } else g.connect(this.amp.input);
    for (const iv of [0, 7, 12]) for (const det of [-7, 6]) this.osc('sawtooth', hz(m + iv), t, t + dur + .1, into, det);
  }
  guitar(s, t, d, h) {
    if (h < .46) return;
    if (this.section === 'metal') {
      const n = this.riff[s];
      if (n > 0) this.power(t, 40 + n, d * 1.9, .24, false); else this.power(t, 40, d, .2, true);
      return;
    }
    const m = 40 + this.chord.root;
    if (h < .66) {                                                    // big let-ring chords
      if (s === 0) this.power(t, m, d * 5.6, .22, false);
      else if (s === 6) this.power(t, m, d * 9.6, .22, false);
      return;
    }
    if (s === 0 || s === 6 || s === 12) this.power(t, m, d * (s === 12 ? 3.8 : 1.9), .24, false);   // chug with accents
    else if (s % 2 === 0 || h > .76) this.power(t, m, d, .2, true);
  }
  leadChain(dest) {
    const c = this.ctx, input = this.gain(1), drive = this.gain(9), shaper = c.createWaveShaper();
    shaper.curve = driveCurve(3); shaper.oversample = '4x';
    const lp = this.filter('lowpass', 3800, .7), mid = this.filter('peaking', 1500, 1); mid.gain.value = 5;
    const out = this.gain(.2), dl = c.createDelay(1), fb = this.gain(.32), wet = this.gain(.35);
    dl.delayTime.value = .28;
    input.connect(drive); drive.connect(shaper); shaper.connect(mid); mid.connect(lp); lp.connect(out); out.connect(dest);
    out.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(dest);
    return input;
  }
  leadNote(t, m, dur, v, bend, vib) {
    const f = hz(m), g = this.gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .005); g.gain.setValueAtTime(v * .85, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + .04);
    g.connect(this.leadAmp);
    const sq = this.gain(.4); sq.connect(g);
    for (const o of [this.osc('sawtooth', f, t, t + dur + .06, g), this.osc('square', f, t, t + dur + .06, sq, 8)]) {
      if (bend) { o.frequency.setValueAtTime(hz(m - 2), t); o.frequency.linearRampToValueAtTime(f, t + .09); }
      if (vib) {
        const depth = this.gain(0); depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(f * .014, t + Math.min(.35, dur));
        depth.connect(o.frequency); this.osc('sine', 5.8, t, t + dur + .06, depth);
      }
    }
  }
  leadLine(s, bar, t, d) {
    if (this.section !== 'metal' || this.phrase === 'rest') return;
    const note = i => { const o = Math.floor(i / 7); return 64 + PHRYG[((i % 7) + 7) % 7] + 12 * o; };
    switch (this.phrase) {
      case 'run': this.leadNote(t, note(14 - s - (s % 4 === 3 ? -2 : 0)), d * .9, .5, false, false); break;
      case 'climb': this.leadNote(t, note(4 + s), d * .9, .5, false, false); break;
      case 'trill': if (s < 10) this.leadNote(t, s % 2 ? 77 : 76, d * .9, .5, false, false); else if (s % 2 === 0) this.leadNote(t, note(9 + (s - 10) / 2), d * 1.8, .5, false, false); break;
      case 'hold':
        if (s === 0) this.leadNote(t, 76, d * 7.5, .55, true, true);
        else if (s === 8) this.leadNote(t, 83, d * 3.8, .55, true, true);
        else if (s >= 12) this.leadNote(t, note(11 - (s - 12)), d * .9, .5, false, false);
        break;
    }
  }

  /* ---------- the tower comes down ---------- */
  fall() {
    const t = this.ctx.currentTime + .02, h = this.heat, fx = this.bus.fx;
    this.quietUntil = t + 3.4;
    for (const k in this.bus) if (k !== 'fx') { const g = this.bus[k].gain; g.cancelScheduledValues(t); g.setTargetAtTime(0, t + (h > .45 ? 1.2 : .1), h > .45 ? .5 : .15); }
    if (h > .45) {
      this.crash(t, 1, fx); this.crash(t + .01, .8, fx); this.kick(t, 1, false, fx);
      this.power(t, 40, 2.6, .26, false);
      this.leadNote(t + .3, 88, 2.2, .35, true, true);
      for (let i = 0; i < 6; i++) this.tom(t + .45 + i * .09, 52 - i * 2, .7, fx);
    } else {
      this.bowl(t, 33, 1, fx);
      for (let i = 0; i < 8; i++) this.bell(t + .05 + i * .07, 100 - [0, 3, 5, 8, 10, 12, 15, 17][i], .7, fx);
    }
  }
}

// Knocks and clunks from the physics, and a little note for each piece that stays put.
export class Sfx {
  constructor(ctx, dest, noise) {
    this.ctx = ctx; this.noise = noise;
    this.out = ctx.createGain(); this.out.gain.value = .9; this.out.connect(dest);
  }
  // Wood on wood: a short resonant tock, lower for bigger pieces. size 0 (tiny) to 1 (the bottom table).
  knock(v, size) {
    const c = this.ctx, t = c.currentTime + .005, f = 140 + 760 * (1 - size) * (.9 + Math.random() * .2);
    const pan = c.createStereoPanner(); pan.pan.value = Math.random() * .6 - .3; pan.connect(this.out);
    for (const [r, a, dec] of [[1, .5, .13], [2.32, .22, .06], [4.1, .08, .03]]) {
      const g = c.createGain(); g.gain.setValueAtTime(a * v, t); g.gain.exponentialRampToValueAtTime(.0001, t + dec); g.connect(pan);
      const o = c.createOscillator(); o.frequency.value = f * r; o.connect(g); o.start(t); o.stop(t + dec + .02);
    }
    const src = c.createBufferSource(); src.buffer = this.noise;
    const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f * 3; b.Q.value = 1.4;
    const g = c.createGain(); g.gain.setValueAtTime(v * .4, t); g.gain.exponentialRampToValueAtTime(.0001, t + .035);
    src.connect(b); b.connect(g); g.connect(pan); src.start(t, Math.random(), .05);
  }
  // A soft marimba note that climbs the E major pentatonic as the stack grows.
  placed(n) {
    const c = this.ctx, t = c.currentTime + .01, m = 64 + PENTA[n % 5] + 12 * Math.min(2, Math.floor(n / 5) % 3), f = hz(m);
    for (const [r, a, dec] of [[1, .12, .7], [4, .03, .08]]) {
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + dec); g.connect(this.out);
      const o = c.createOscillator(); o.frequency.value = f * r; o.connect(g); o.start(t); o.stop(t + dec + .02);
    }
  }
}

// The audio graph: created on the first click (browsers need a gesture), then kept.
export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.music = null; this.sfx = null; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 1;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.music = new Music(ctx, this.master);
    this.sfx = new Sfx(ctx, this.master, this.music.noise);
    this.music.begin();
    this.timer = setInterval(() => { if (ctx.state === 'running') this.music.scheduleUntil(ctx.currentTime + .15); }, 25);
  }
  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, .05);
  }
  suspend(yes) { if (this.ctx) yes ? this.ctx.suspend() : this.ctx.resume(); }
}
