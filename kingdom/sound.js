// Every sound is made on the spot with Web Audio: footsteps, coins, dice, sword on sword, a curse settling, a bell for
// the dead, a herald's call, and the brass and drums of a coronation, with a crowd cheering. Under it all, if you
// like, a lute picking its way through an old mode over a quiet drone.
const HZ = n => 440 * 2 ** ((n - 69) / 12);        // MIDI note → frequency
export class Sound {
  constructor() { this.ctx = null; this.enabled = true; this.musicOn = false; this.musicT = 0; }
  ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const c = this.ctx = new AC();
      this.out = c.createDynamicsCompressor(); this.out.threshold.value = -14; this.out.ratio.value = 4;
      this.master = c.createGain(); this.master.gain.value = .55;
      this.master.connect(this.out); this.out.connect(c.destination);
      this.musicBus = c.createGain(); this.musicBus.gain.value = .0; this.musicBus.connect(this.master);
      this.dest = this.master;
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      // a little room for everything to ring in
      const conv = c.createConvolver(), rl = c.sampleRate * 1.6, rb = c.createBuffer(2, rl, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const dd = rb.getChannelData(ch); for (let i = 0; i < rl; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / rl) ** 3; }
      conv.buffer = rb; this.verb = c.createGain(); this.verb.gain.value = .22; conv.connect(this.verb); this.verb.connect(this.master); this.room = conv;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  set(on) { this.enabled = on; if (!on && this.ctx) this.ctx.suspend(); else this.ensure(); }
  send(node, wet = 0) { node.connect(this.dest); if (wet && this.room) { const g = this.ctx.createGain(); g.gain.value = wet; node.connect(g); g.connect(this.room); } }

  noise(o = {}) {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime + (o.at ?? 0), src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf; src.playbackRate.value = o.rate ?? 1;
    f.type = o.type ?? 'bandpass'; f.frequency.setValueAtTime(o.f ?? 2000, t); f.Q.value = o.q ?? 1;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + (o.dur ?? .2));
    const a = o.attack ?? .005, dur = o.dur ?? .2;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.gain ?? .3, t + a); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    src.connect(f); f.connect(g); this.send(g, o.wet);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + .05);
  }
  tone(freq, o = {}) {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime + (o.at ?? 0), osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type ?? 'sine'; osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide ?? o.dur ?? .3));
    if (o.detune) osc.detune.value = o.detune;
    const a = o.attack ?? .004, dur = o.dur ?? .4;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.gain ?? .2, t + a); g.gain.exponentialRampToValueAtTime(.0004, t + dur);
    let node = g;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); node = f; }
    osc.connect(g); this.send(node, o.wet); osc.start(t); osc.stop(t + dur + .05);
  }
  bell(freq, o = {}) { for (const [m, gm] of [[1, 1], [2.76, .45], [5.4, .22], [8.9, .1]]) if (freq * m < 16000) this.tone(freq * m, { ...o, gain: (o.gain ?? .12) * gm, dur: (o.dur ?? 1.2) / Math.sqrt(m), wet: o.wet ?? .5 }); }
  // A brass note: sawtooth through a filter that opens as the note speaks, with a little vibrato.
  brass(freq, at, dur, gain = .12) {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime + at;
    for (const det of [-6, 5]) {
      const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det;
      lfo.frequency.value = 5.2; lg.gain.value = freq * .006; lfo.connect(lg); lg.connect(o.frequency);
      f.type = 'lowpass'; f.Q.value = 2; f.frequency.setValueAtTime(freq * 1.2, t); f.frequency.linearRampToValueAtTime(freq * 5, t + .06); f.frequency.exponentialRampToValueAtTime(freq * 2.5, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .04); g.gain.setValueAtTime(gain * .85, t + dur * .7); g.gain.exponentialRampToValueAtTime(.0005, t + dur + .15);
      o.connect(f); f.connect(g); this.send(g, .35);
      o.start(t); lfo.start(t); o.stop(t + dur + .2); lfo.stop(t + dur + .2);
    }
  }
  drum(at, gain = .5, f = 90) { this.tone(f, { at, to: f * .55, glide: .25, dur: .45, gain, type: 'sine' }); this.noise({ at, type: 'lowpass', f: 400, dur: .15, gain: gain * .35 }); }
  pluck(freq, at = 0, gain = .09) {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime + at, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.setValueAtTime(freq * 6, t); f.frequency.exponentialRampToValueAtTime(freq * 1.2, t + .5);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .004); g.gain.exponentialRampToValueAtTime(.0005, t + 1.4);
    o.connect(f); f.connect(g); g.connect(this.musicBus); if (this.room) { const w = c.createGain(); w.gain.value = .5; g.connect(w); w.connect(this.room); }
    o.start(t); o.stop(t + 1.5);
  }

  /* ---------- the game's sounds ---------- */
  pick() { this.tone(660, { dur: .07, gain: .08, type: 'square', lp: 2400 }); this.tone(990, { at: .04, dur: .08, gain: .05, type: 'square', lp: 2400 }); }
  step() { this.noise({ type: 'lowpass', f: 380, dur: .09, gain: .22 }); this.noise({ at: .28, type: 'lowpass', f: 330, dur: .09, gain: .18 }); }
  rise() { this.noise({ type: 'bandpass', f: 500, to: 1800, q: .6, dur: .6, gain: .1, attack: .2, wet: .6 }); this.tone(880, { at: .25, dur: .5, gain: .03, wet: .8 }); this.tone(1320, { at: .32, dur: .5, gain: .025, wet: .8 }); }
  coin(n = 3) { for (let i = 0; i < Math.min(6, n); i++) { const f = 2400 + Math.random() * 1400; this.tone(f, { at: i * .07, dur: .18, gain: .06, type: 'triangle' }); this.tone(f * 1.5, { at: i * .07 + .01, dur: .12, gain: .03 }); } }
  spend() { this.coin(2); this.noise({ at: .05, f: 3000, q: 2, dur: .08, gain: .08 }); }
  hurt() { this.tone(110, { to: 60, dur: .3, gain: .35 }); this.noise({ type: 'lowpass', f: 900, dur: .2, gain: .25 }); }
  heal() { [0, 4, 7, 12].forEach((s, i) => this.tone(HZ(72 + s), { at: i * .07, dur: .5, gain: .05, wet: .6 })); }
  food() { for (let i = 0; i < 3; i++) this.noise({ at: i * .11, f: 1400 + Math.random() * 800, q: 3, dur: .06, gain: .12 }); }
  dice(dur = 1) { for (let t = 0; t < dur; t += .05 + Math.random() * .05) this.noise({ at: t, f: 2500 + Math.random() * 2500, q: 6, dur: .03, gain: .12 * (1 - t / dur * .5) }); this.noise({ at: dur, f: 1800, q: 4, dur: .06, gain: .2 }); }
  clash() { this.noise({ f: 4200, q: 3, dur: .35, gain: .4, wet: .4 }); this.tone(1870, { dur: .6, gain: .07, wet: .5 }); this.tone(2630, { dur: .5, gain: .05, wet: .5 }); this.noise({ type: 'lowpass', f: 500, dur: .15, gain: .3 }); }
  // a sum adding up in a fight: a blip a step higher for every term (lower for the foe's)
  tally(i = 0, foe = false) { this.tone(HZ((foe ? 55 : 67) + [0, 2, 4, 5, 7, 9, 11, 12][Math.min(7, i)]), { dur: .07, gain: .06, type: 'square', lp: 2200 }); }
  win() { [[60, 0], [64, .12], [67, .24], [72, .36]].forEach(([n, a]) => this.brass(HZ(n), a, n === 72 ? .6 : .14, .07)); }
  lose() { [[57, 0], [55, .22], [52, .44]].forEach(([n, a]) => this.tone(HZ(n), { at: a, dur: .5, gain: .1, type: 'triangle', lp: 1200, wet: .4 })); }
  relic() { [76, 79, 83, 88, 91].forEach((n, i) => this.bell(HZ(n), { at: i * .08, gain: .05, dur: 1.4 })); }
  bless() { [0, 4, 7, 11, 14].forEach(s => this.tone(HZ(67 + s), { attack: .3, dur: 1.6, gain: .035, wet: .8 })); this.relic(); }
  curse() {
    this.tone(HZ(38), { attack: .3, dur: 1.8, gain: .16, type: 'sawtooth', lp: 500, wet: .5 }); this.tone(HZ(39), { attack: .3, dur: 1.8, gain: .12, type: 'sawtooth', lp: 500, wet: .5 });
    this.noise({ type: 'bandpass', f: 300, to: 90, q: 2, dur: 1.6, gain: .12, attack: .4, wet: .6 });
  }
  toll() { for (let i = 0; i < 3; i++) this.bell(HZ(45), { at: i * 1.4, gain: .18, dur: 3.5 }); }
  page() { this.noise({ type: 'highpass', f: 1800, to: 5200, dur: .28, gain: .12, attack: .06 }); }
  summons() { [[67, 0, .18], [67, .2, .18], [72, .4, .5], [67, .95, .2], [72, 1.17, .2], [76, 1.38, .9]].forEach(([n, a, d]) => this.brass(HZ(n), a, d, .09)); this.drum(0, .3); this.drum(.4, .3); this.drum(1.38, .45); }
  cheer(dur = 3) {
    for (let i = 0; i < 18; i++) this.noise({ at: Math.random() * dur * .6, type: 'bandpass', f: 600 + Math.random() * 1600, q: 1.5, dur: .4 + Math.random() * .8, gain: .05, attack: .08, wet: .5 });
    this.noise({ type: 'bandpass', f: 900, q: .6, dur, gain: .12, attack: .4, wet: .6 });
  }
  whoosh(at = 0, dur = 2) { this.noise({ at, type: 'bandpass', f: 250, to: 1400, q: .5, dur, gain: .16, attack: dur * .4, wet: .6 }); }
  // The coronation: a drum roll, the trumpets, and the crowd.
  fanfare() {
    const n = HZ;
    for (let t = 0; t < 1.6; t += .06) this.drum(t, .08 + t * .08, 110);
    const at = 1.6;
    const line = [[67, 0, .22], [72, .25, .22], [76, .5, .22], [79, .75, .7], [76, 1.5, .22], [79, 1.75, .22], [84, 2.0, 1.4]];
    const low = [[55, 0, .7], [60, .75, .7], [64, 1.5, .45], [67, 2.0, 1.4]];
    for (const [m, a, d] of line) this.brass(n(m), at + a, d, .09);
    for (const [m, a, d] of low) this.brass(n(m), at + a, d, .07);
    for (const [m, a, d] of low) this.brass(n(m - 12), at + a, d, .05);
    for (const a of [0, .75, 1.5, 2.0]) this.drum(at + a, .5);
    this.noise({ at: at + 2.0, type: 'highpass', f: 3000, dur: 2.4, gain: .22, wet: .7 });
    this.cheer(5);
  }
  // Under the intro: a low string drone that swells in, and a single bell. Returns a way to let it fade.
  introTheme() {
    const c = this.ensure(); if (!c) return { title() {}, stop() {} };
    const t = c.currentTime, g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = .7;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.07, t + 4);
    const oscs = [HZ(38), HZ(45), HZ(50), HZ(57)].map((fr, i) => { const o = c.createOscillator(); o.type = i % 2 ? 'triangle' : 'sawtooth'; o.frequency.value = fr; o.detune.value = (i - 1.5) * 4; o.connect(f); o.start(t); return o; });
    f.connect(g); this.send(g, .6);
    this.bell(HZ(57), { gain: .16, dur: 4 });
    return {
      // when the title lands: the minor third an octave above the drone's D (an F), rising softly out of it, so the
      // open fifth becomes a minor chord; it fades out with the drone
      title: (rise = 2.5) => {
        const n = c.currentTime, tg = c.createGain();
        tg.gain.setValueAtTime(0, n); tg.gain.linearRampToValueAtTime(.5, n + rise);   // the pair together about as loud as one voice of the drone
        for (const d of [-3, 3]) { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = HZ(65); o.detune.value = d; o.connect(tg); o.start(n); oscs.push(o); }
        tg.connect(f);
      },
      stop: (after = 1.5) => { const n = c.currentTime; g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.linearRampToValueAtTime(0, n + after); for (const o of oscs) o.stop(n + after + .1); },
    };
  }
  // A quiet lute over a drone, in D dorian, wandering.
  music(on) {
    this.musicOn = on;
    const c = this.ensure(); if (!c) return;
    this.musicBus.gain.cancelScheduledValues(c.currentTime);
    this.musicBus.gain.linearRampToValueAtTime(on ? .9 : 0, c.currentTime + 1.5);
  }
  tick(dt) {
    if (!this.musicOn || !this.ctx || this.ctx.state !== 'running') return;
    this.musicT -= dt;
    if (this.musicT > 0) return;
    const scale = [50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69];
    this.idx = Math.max(0, Math.min(scale.length - 1, (this.idx ?? 5) + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
    const phrase = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < phrase; i++) this.pluck(HZ(scale[Math.max(0, Math.min(scale.length - 1, this.idx + (i % 2 ? -2 : 0)))]), i * .42, .07);
    if (Math.random() < .35) { this.pluck(HZ(38), 0, .06); this.pluck(HZ(45), .01, .05); }
    this.musicT = phrase * .42 + .8 + Math.random() * 1.6;
  }
}
