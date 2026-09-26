// Every sound is made on the spot with Web Audio: foil crinkles and rips, card swishes, sparkles and a till.
export class Sound {
  constructor() { this.ctx = null; this.enabled = true; this.lastTear = 0; }
  ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const c = this.ctx = new AC();
      this.out = c.createDynamicsCompressor(); this.out.threshold.value = -16; this.out.ratio.value = 4;
      this.master = c.createGain(); this.master.gain.value = .6;
      this.master.connect(this.out); this.out.connect(c.destination);
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  set(on) { this.enabled = on; if (!on && this.ctx) this.ctx.suspend(); else this.ensure(); }
  noise(o = {}) {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime + (o.at ?? 0), src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf; src.playbackRate.value = o.rate ?? 1;
    f.type = o.type ?? 'bandpass'; f.frequency.setValueAtTime(o.f ?? 2000, t); f.Q.value = o.q ?? 1;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + (o.dur ?? .2));
    const a = o.attack ?? .005, dur = o.dur ?? .2;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.gain ?? .3, t + a); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
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
    osc.connect(g); g.connect(this.master); osc.start(t); osc.stop(t + dur + .05);
  }
  bell(freq, o = {}) {   // a bright struck bell: a few inharmonic partials
    for (const [m, gm] of [[1, 1], [2.76, .45], [5.4, .22], [8.9, .1]]) if (freq * m < 18000) this.tone(freq * m, { ...o, gain: (o.gain ?? .12) * gm, dur: (o.dur ?? 1.2) / Math.sqrt(m) });
  }
  crinkle(amount = 1) {
    for (let i = 0; i < 2 + amount * 4; i++) this.noise({ at: Math.random() * .12, f: 3000 + Math.random() * 5000, q: 2, dur: .02 + Math.random() * .04, gain: .05 + Math.random() * .08 * amount });
  }
  // Called every frame the tear moves: little grains of ripping foil, denser the faster it goes.
  tear(speed) {
    const c = this.ensure(); if (!c) return;
    const n = Math.min(6, Math.floor(speed * 10 + Math.random()));
    for (let i = 0; i < n; i++) this.noise({ at: Math.random() * .03, f: 1400 + Math.random() * 4200, q: 1.4 + Math.random() * 3, dur: .015 + Math.random() * .045, gain: .08 + Math.random() * .12 });
    if (Math.random() < speed * 2) this.noise({ f: 700 + Math.random() * 600, q: 3, dur: .05, gain: .06 });
  }
  rip() { this.noise({ f: 2500, to: 5000, q: .8, dur: .28, gain: .35 }); this.noise({ at: .03, f: 900, to: 300, q: 1, dur: .3, gain: .2 }); this.whoosh(.6); }
  whoosh(g = 1) { this.noise({ type: 'lowpass', f: 300, to: 2200, q: .7, dur: .32, gain: .22 * g, attack: .08 }); }
  swish(g = 1) { this.noise({ f: 1800, to: 700, q: 1.2, dur: .16, gain: .16 * g, attack: .02 }); }
  slide() { this.noise({ type: 'lowpass', f: 900, to: 2400, q: .6, dur: .45, gain: .14, attack: .15 }); }
  flip() { this.noise({ f: 2400, to: 900, q: 1, dur: .2, gain: .18, attack: .03 }); this.tone(900, { at: .05, dur: .06, gain: .05, type: 'triangle' }); }
  pop() { this.tone(520, { to: 980, glide: .06, dur: .14, gain: .12, type: 'triangle' }); }
  click() { this.tone(1800, { dur: .03, gain: .05, type: 'square' }); }
  thump() { this.tone(110, { to: 45, glide: .2, dur: .35, gain: .45 }); this.noise({ type: 'lowpass', f: 400, dur: .12, gain: .2 }); }
  page() { this.noise({ type: 'lowpass', f: 600, to: 3000, q: .5, dur: .3, gain: .2, attack: .06 }); this.noise({ at: .22, f: 2500, q: 2, dur: .05, gain: .08 }); }
  sparkle(level = 1) {
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const n = 3 + level * 2;
    for (let i = 0; i < n; i++) this.bell(880 * Math.pow(2, scale[(i * 3 + (Math.random() * 3 | 0)) % scale.length] / 12), { at: i * .055 + Math.random() * .02, gain: .05, dur: .9 });
  }
  reveal(kind) {   // 'rare' | 'holo' | 'full' | 'both'
    if (kind === 'rare') { this.tone(55, { to: 40, dur: .6, gain: .3 }); [523, 659, 784, 1047].forEach((f, i) => this.bell(f, { at: .05 + i * .07, gain: .09, dur: 1.6 })); }
    else if (kind === 'holo') { for (let i = 0; i < 12; i++) this.bell(660 * Math.pow(2, i / 7), { at: i * .04, gain: .045, dur: 1 }); this.tone(70, { to: 50, dur: .5, gain: .25 }); }
    else if (kind === 'full') { [392, 494, 587, 784].forEach((f, i) => this.bell(f, { at: i * .09, gain: .08, dur: 1.4 })); }
    else { this.tone(50, { to: 35, dur: 1, gain: .4 }); for (let i = 0; i < 18; i++) this.bell(523 * Math.pow(2, i / 6), { at: i * .045, gain: .05, dur: 1.4 }); [262, 330, 392, 523].forEach(f => this.tone(f, { at: .8, dur: 2.2, gain: .06, type: 'triangle', attack: .3 })); }
  }
  cash() {   // ka-ching
    this.noise({ f: 5000, q: 3, dur: .05, gain: .18 });
    this.bell(1568, { at: .06, gain: .11, dur: .9 }); this.bell(2093, { at: .12, gain: .09, dur: 1.1 });
    for (let i = 0; i < 6; i++) this.noise({ at: .1 + i * .035 + Math.random() * .02, f: 6000 + Math.random() * 3000, q: 8, dur: .05, gain: .05 });
  }
  coin(i = 0) { this.bell(1760 + (i % 5) * 180, { gain: .04, dur: .35 }); }
  buy() { this.noise({ type: 'highpass', f: 3000, dur: .08, gain: .1 }); this.bell(988, { at: .02, gain: .08, dur: .6 }); this.bell(1319, { at: .1, gain: .08, dur: .8 }); }
  denied() { this.tone(180, { dur: .12, gain: .12, type: 'square' }); this.tone(150, { at: .13, dur: .16, gain: .12, type: 'square' }); }
}
