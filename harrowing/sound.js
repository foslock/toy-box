// Every sound is made on the spot with Web Audio: card slides and flicks, bells for heaven, growls and rumbles for
// hell, and a low drone under each circle that shifts as you go deeper.
export class Sound {
  constructor() { this.ctx = null; this.enabled = true; this.musicOn = true; this.droneNode = null; this.last = {}; }
  // the page may only start sound after a tap or key press
  unlock() { if (this.unlocked) return; this.unlocked = true; this.ensure(); if (this.wantDrone != null) this.setDrone(this.wantDrone); }
  ensure() {
    if (!this.enabled || !this.unlocked) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const c = this.ctx = new AC();
      this.out = c.createDynamicsCompressor(); this.out.threshold.value = -18; this.out.ratio.value = 4;
      this.master = c.createGain(); this.master.gain.value = .55;
      this.master.connect(this.out); this.out.connect(c.destination);
      this.dest = this.master;
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      // a little room
      this.verb = c.createConvolver();
      const vl = c.sampleRate * 2.2, vb = c.createBuffer(2, vl, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const x = vb.getChannelData(ch); for (let i = 0; i < vl; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / vl, 3); }
      this.verb.buffer = vb; this.verbGain = c.createGain(); this.verbGain.gain.value = .25;
      this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  set(on) { this.enabled = on; if (!on && this.ctx) this.ctx.suspend(); else this.ensure(); }
  // don't stack the same sound many times in one instant
  gate(name, ms = 40) { const t = performance.now(); if (t - (this.last[name] ?? 0) < ms) return false; this.last[name] = t; return true; }
  noise(o = {}) {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime + (o.at ?? 0), src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf; src.playbackRate.value = o.rate ?? 1;
    f.type = o.type ?? 'bandpass'; f.frequency.setValueAtTime(o.f ?? 2000, t); f.Q.value = o.q ?? 1;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + (o.dur ?? .2));
    const a = o.attack ?? .005, dur = o.dur ?? .2;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.gain ?? .3, t + a); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    src.connect(f); f.connect(g); g.connect(this.dest);
    if (o.verb) g.connect(this.verb);
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
    let node = osc;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(g); g.connect(this.dest);
    if (o.verb) g.connect(this.verb);
    osc.start(t); osc.stop(t + dur + .05);
  }
  bell(freq, o = {}) { for (const [m, gm] of [[1, 1], [2.76, .4], [5.4, .18], [8.9, .08]]) if (freq * m < 16000) this.tone(freq * m, { ...o, gain: (o.gain ?? .1) * gm, dur: (o.dur ?? 1.4) / Math.sqrt(m), verb: true }); }
  choir(freqs, o = {}) { for (const f of freqs) for (const dt of [-7, 0, 7]) this.tone(f, { type: 'sawtooth', lp: 1400, attack: o.attack ?? .25, dur: o.dur ?? 1.6, gain: (o.gain ?? .02), detune: dt, at: o.at, verb: true }); }

  tick() { if (this.gate('tick', 60)) this.tone(2400, { dur: .025, gain: .025, type: 'triangle' }); }
  click() { this.tone(1600, { dur: .04, gain: .05, type: 'square', lp: 4000 }); }
  nope() { this.tone(180, { dur: .12, gain: .12, type: 'square', lp: 900 }); }
  flip() { this.noise({ f: 2400, to: 900, q: 1, dur: .18, gain: .14, attack: .02 }); this.tone(900, { at: .04, dur: .06, gain: .04, type: 'triangle' }); }
  pick() { this.noise({ f: 3200, q: 1.4, dur: .08, gain: .12 }); this.tone(880, { dur: .06, gain: .03, type: 'triangle' }); }
  draw() { if (this.gate('draw', 50)) this.noise({ f: 1800, to: 3800, q: 1, dur: .16, gain: .13, attack: .02 }); }
  turn() { this.tone(110, { to: 70, dur: .35, gain: .14, type: 'triangle' }); this.noise({ f: 600, to: 200, q: 2, dur: .3, gain: .08 }); }
  play() { this.noise({ type: 'lowpass', f: 400, to: 3000, q: .7, dur: .26, gain: .2, attack: .05 }); this.bell(1320, { gain: .04, dur: .6 }); }
  demonPlay() { this.noise({ type: 'lowpass', f: 300, to: 1600, q: .8, dur: .3, gain: .2, attack: .06 }); this.tone(90, { to: 55, dur: .4, gain: .16, type: 'sawtooth', lp: 400 }); }
  whoosh() { this.noise({ type: 'lowpass', f: 300, to: 2400, q: .7, dur: .32, gain: .16, attack: .08 }); }
  slash() { if (!this.gate('slash', 60)) return; this.noise({ f: 6000, to: 1200, q: 1.2, dur: .16, gain: .22 }); this.tone(2200, { to: 1400, dur: .2, gain: .05, type: 'triangle' }); }
  claw() { if (!this.gate('claw', 60)) return; this.noise({ f: 2400, to: 500, q: 2, dur: .2, gain: .22 }); this.noise({ at: .05, f: 1800, to: 400, q: 2, dur: .18, gain: .16 }); }
  hit(n = 5) { if (!this.gate('hit', 50)) return; const k = Math.min(1, n / 20); this.tone(120 - k * 40, { to: 40, glide: .25, dur: .35, gain: .25 + k * .25 }); this.noise({ type: 'lowpass', f: 600, dur: .12, gain: .18 + k * .15 }); }
  block() { this.tone(620, { dur: .25, gain: .1, type: 'triangle' }); this.tone(930, { dur: .2, gain: .05, type: 'triangle', at: .01 }); }
  ward() { if (!this.gate('ward', 80)) return; for (let i = 0; i < 4; i++) this.tone(520 * Math.pow(1.26, i), { at: i * .04, dur: .3, gain: .04, verb: true }); }
  holy() { this.bell(784, { gain: .08 }); this.bell(988, { gain: .06, at: .06 }); this.choir([392, 494, 587], { dur: 1.2, gain: .016 }); }
  burn() { if (!this.gate('burn', 80)) return; for (let i = 0; i < 6; i++) this.noise({ at: Math.random() * .2, f: 2500 + Math.random() * 3000, q: 4, dur: .03, gain: .06 }); this.noise({ type: 'lowpass', f: 500, dur: .3, gain: .1 }); }
  heal() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, { at: i * .06, dur: .5, gain: .05, verb: true })); }
  buff() { this.tone(110, { to: 220, dur: .4, gain: .12, type: 'sawtooth', lp: 700 }); }
  death() { this.tone(160, { to: 30, glide: .9, dur: 1, gain: .22, type: 'sawtooth', lp: 600 }); this.noise({ type: 'lowpass', f: 800, to: 100, dur: 1, gain: .2, attack: .02 }); }
  angelDies() { this.choir([392, 466, 587], { dur: 2.8, gain: .03, attack: .1 }); this.tone(196, { to: 98, glide: 2.5, dur: 2.8, gain: .1 }); }
  summon() { this.noise({ type: 'lowpass', f: 200, to: 1200, dur: .6, gain: .22, attack: .2 }); this.tone(70, { dur: .8, gain: .2, type: 'sawtooth', lp: 300 }); }
  discard() { if (this.gate('discard', 70)) this.noise({ f: 1400, to: 700, q: 1, dur: .14, gain: .09 }); }
  shuffle() { for (let i = 0; i < 12; i++) this.noise({ at: i * .03, f: 2500 + Math.random() * 1500, q: 2, dur: .03, gain: .08 }); }
  offer() { this.bell(988, { gain: .07 }); this.tone(494, { to: 988, dur: .4, gain: .05, verb: true }); }
  reveal() { for (let i = 0; i < 5; i++) this.tone(1200 + i * 240, { at: i * .05, dur: .25, gain: .025, verb: true }); }
  disarm() { this.tone(300, { dur: .1, gain: .15, type: 'square', lp: 2000 }); this.noise({ f: 4000, q: 3, dur: .15, gain: .15 }); this.tone(1800, { at: .05, dur: .4, gain: .05, type: 'triangle' }); }
  redeem() { [659, 784, 988, 1319].forEach((f, i) => this.bell(f, { at: i * .07, gain: .05 })); }
  swap() { this.whoosh(); setTimeout(() => this.whoosh(), 120); }
  chomp() { this.noise({ type: 'lowpass', f: 900, dur: .1, gain: .3 }); this.noise({ at: .08, type: 'lowpass', f: 700, dur: .12, gain: .25 }); }
  coin() { this.tone(1975, { dur: .2, gain: .06, type: 'triangle' }); this.tone(2637, { at: .05, dur: .3, gain: .05, type: 'triangle' }); }
  curse() { this.tone(110, { dur: .7, gain: .1, type: 'sawtooth', lp: 500 }); this.tone(117, { dur: .7, gain: .1, type: 'sawtooth', lp: 500 }); }
  power() { this.choir([262, 330, 392, 523], { dur: 1.8, gain: .022 }); this.bell(1047, { gain: .06, at: .2 }); }
  ice() { this.noise({ f: 5000, q: 1, dur: .4, gain: .3 }); this.tone(60, { dur: .9, gain: .3 }); for (let i = 0; i < 8; i++) this.tone(2000 + Math.random() * 3000, { at: .1 + Math.random() * .4, dur: .15, gain: .03, type: 'triangle' }); }
  drone() { this.tone(55, { dur: 1.1, gain: .12, type: 'sawtooth', lp: 220, attack: .1 }); }
  chime() { this.bell(1175, { gain: .06, dur: 1.2 }); }
  rumble() { this.noise({ type: 'lowpass', f: 120, to: 300, dur: 1.2, gain: .3, attack: .3 }); }
  gold() { for (let i = 0; i < 6; i++) this.tone(1500 + Math.random() * 1500, { at: i * .05, dur: .2, gain: .04, type: 'triangle' }); }
  victory() { [523, 659, 784, 1047].forEach((f, i) => this.bell(f, { at: i * .12, gain: .08, dur: 2 })); this.choir([262, 330, 392], { dur: 2.5, gain: .02, at: .3 }); }
  page() { this.noise({ type: 'lowpass', f: 600, to: 3000, q: .5, dur: .3, gain: .15, attack: .06 }); }
  step() { this.noise({ type: 'lowpass', f: 300, dur: .1, gain: .15 }); }
  // a low drone for each circle: deeper and rougher as you go down
  setDrone(ci) {
    this.wantDrone = ci;
    const c = this.ensure(); if (!c || !this.musicOn) return;
    if (this.droneNode?.ci === ci) return;
    this.stopDrone();
    const base = [55, 52, 49, 46.25, 43.65, 41.2, 38.9, 36.7, 34.65][ci] ?? 41;
    const g = c.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(.06, c.currentTime + 3);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180 + ci * 10;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .07; lg.gain.value = 60; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    const oscs = [1, 1.5, 2.01, ci > 4 ? 1.059 : 1.25].map((m, i) => { const o = c.createOscillator(); o.type = i % 2 ? 'triangle' : 'sawtooth'; o.frequency.value = base * m; o.detune.value = (i - 1.5) * 6; o.connect(f); o.start(); return o; });
    f.connect(g); g.connect(this.master);
    this.droneNode = { ci, g, oscs, lfo };
  }
  stopDrone() {
    const d = this.droneNode; if (!d || !this.ctx) return;
    const t = this.ctx.currentTime;
    d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(d.g.gain.value, t); d.g.gain.linearRampToValueAtTime(0, t + 1.5);
    setTimeout(() => { for (const o of d.oscs) o.stop(); d.lfo.stop(); }, 1700);
    this.droneNode = null;
  }
}
