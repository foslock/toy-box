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
  // ---- fanfare, scaled to how much a card is worth (tier 0 = pennies … 5 = over $1,000) ----
  boom(g = 1) { this.tone(90, { to: 32, glide: .5, dur: .9, gain: .5 * g }); this.noise({ type: 'lowpass', f: 300, to: 80, dur: .5, gain: .25 * g }); }
  crash(g = 1, at = 0) {
    this.noise({ at, type: 'highpass', f: 4500, q: .5, dur: 2.2, gain: .22 * g, attack: .003 });
    this.noise({ at, f: 7000, to: 3500, q: .6, dur: 1.4, gain: .12 * g });
  }
  swell(dur = 1, g = 1) { this.noise({ type: 'highpass', f: 2000, to: 7000, q: .4, dur, gain: .12 * g, attack: dur * .9 }); }
  rumble(dur = 1.5, g = 1) { this.noise({ type: 'lowpass', f: 90, to: 160, q: .8, dur, gain: .35 * g, attack: dur * .6, rate: .5 }); this.tone(55, { dur, gain: .12 * g, attack: dur * .6 }); }
  drumroll(dur = 1.2) {
    let t = 0, gap = .09;
    while (t < dur) { this.noise({ at: t, f: 1800, q: .9, dur: .06, gain: .06 + .12 * (t / dur) }); t += gap; gap = Math.max(.028, gap * .93); }
    this.swell(dur, 1.2);
  }
  brass(freqs, o = {}) {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime + (o.at ?? 0), dur = o.dur ?? .6, peak = o.gain ?? .06;
    const f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.Q.value = 1.1;
    f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(3200, t + .07); f.frequency.exponentialRampToValueAtTime(1400, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + .035); g.gain.setValueAtTime(peak, t + dur * .75); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
    f.connect(g); g.connect(this.master);
    for (const fr of freqs) for (const d of [-8, 6]) { const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = fr; osc.detune.value = d; osc.connect(f); osc.start(t); osc.stop(t + dur + .05); }
  }
  applause(dur = 3, g = 1) {
    for (let i = 0; i < dur * 45; i++) {
      const at = Math.pow(Math.random(), 1.6) * dur;
      this.noise({ at, f: 1100 + Math.random() * 1800, q: 1.4, dur: .02 + Math.random() * .04, gain: (.03 + Math.random() * .05) * g * (1 - at / dur * .7) });
    }
  }
  firework(at = 0) {
    this.tone(700, { at, to: 2600, glide: .45, dur: .5, gain: .025 });
    this.noise({ at: at + .48, type: 'lowpass', f: 1400, to: 200, dur: .5, gain: .3 });
    for (let i = 0; i < 12; i++) this.noise({ at: at + .55 + Math.random() * .7, f: 3000 + Math.random() * 4000, q: 6, dur: .03, gain: .05 + Math.random() * .05 });
  }
  stamp(g = 1) {   // a rubber stamp coming down: a thump and the slap of the paper
    this.tone(150, { to: 55, glide: .09, dur: .18, gain: .38 * g });
    this.noise({ type: 'lowpass', f: 1500, dur: .07, gain: .3 * g, attack: .002 });
    this.noise({ at: .004, f: 3400, q: 1.4, dur: .035, gain: .09 * g });
  }
  sleeve() { this.noise({ f: 1400, to: 3200, q: 1.1, dur: .22, gain: .1, attack: .05 }); this.noise({ at: .05, type: 'highpass', f: 5000, dur: .12, gain: .04 }); }
  // What plays as a special card turns over. kind: 'rare' | 'holo' | 'full' | 'both'; tier 0–5 by value.
  fanfare(kind, tier) {
    this.reveal(kind);
    if (tier >= 2) this.sparkle(tier - 1);
    if (tier >= 3) this.boom(.6 + .1 * tier);
    if (tier >= 4) { this.crash(tier === 5 ? 1.2 : .8); [523, 659, 784, 1047, 1319].forEach((f, i) => this.bell(f, { at: .1 + i * .06, gain: .06, dur: 1.8 })); }
    if (tier >= 5) {
      const C = [262, 330, 392, 523], F = [349, 440, 523], G = [392, 494, 587], hi = [523, 659, 784];
      [0, .14, .28].forEach(at => this.brass([392, 523], { at, dur: .12, gain: .05 }));
      this.brass([...hi, 1047], { at: .42, dur: 1.1, gain: .06 });
      this.brass(F, { at: 1.55, dur: .3, gain: .055 }); this.brass(G, { at: 1.85, dur: .3, gain: .055 }); this.brass([...C, 784], { at: 2.15, dur: 1.9, gain: .065 });
      this.crash(1, 2.15); this.boom(1);
      this.applause(4, 1);
      for (let i = 0; i < 14; i++) this.bell(1760 + (i % 5) * 180, { at: 2.2 + i * .06 + Math.random() * .03, gain: .03, dur: .35 });
    }
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
