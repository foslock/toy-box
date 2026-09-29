// Every sound in Burrow, made on the spot with Web Audio (no recordings): the worm's low rumble as it shakes through
// the ground, deeper in harder rock and louder the faster it goes; wind in the open, bubbles in water; crunches and
// chimes as it swallows things, climbing a scale while it keeps eating; coins at the trading post, the Resonator's
// ring, thuds, splashes, blasts, and a burp when the belly's full.
const PENTA = [0, 2, 4, 7, 9];
const note = n => 440 * 2 ** ((n - 69) / 12);

export class Sound {
  constructor() { this.ac = null; this.enabled = true; this.oreT = 0; this.lastEat = 0; }
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = this.ac = new AC();
    this.out = ac.createGain(); this.out.gain.value = this.enabled ? .8 : 0;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    this.out.connect(comp).connect(ac.destination);
    // a second of brown noise, looped, for rumbles, wind and water
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.2; }
    this.brown = buf;
    const wbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), wd = wbuf.getChannelData(0);
    for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    this.white = wbuf;
    // the rumble: noise through a low filter, and the worm's hum under it
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    this.rumbleF = ac.createBiquadFilter(); this.rumbleF.type = 'lowpass'; this.rumbleF.frequency.value = 200; this.rumbleF.Q.value = 1.2;
    this.rumbleG = ac.createGain(); this.rumbleG.gain.value = 0;
    src.connect(this.rumbleF).connect(this.rumbleG).connect(this.out); src.start();
    this.hum = ac.createOscillator(); this.hum.type = 'triangle'; this.hum.frequency.value = 48;
    this.humLfo = ac.createOscillator(); this.humLfo.frequency.value = 7;
    const lfoG = ac.createGain(); lfoG.gain.value = 6; this.humLfo.connect(lfoG).connect(this.hum.frequency);
    this.humG = ac.createGain(); this.humG.gain.value = 0;
    this.hum.connect(this.humG).connect(this.out); this.hum.start(); this.humLfo.start();
    // wind in the open
    const ws = ac.createBufferSource(); ws.buffer = wbuf; ws.loop = true;
    this.windF = ac.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 600; this.windF.Q.value = .7;
    this.windG = ac.createGain(); this.windG.gain.value = 0;
    ws.connect(this.windF).connect(this.windG).connect(this.out); ws.start();
    // water all around
    const bs = ac.createBufferSource(); bs.buffer = buf; bs.loop = true;
    this.waterF = ac.createBiquadFilter(); this.waterF.type = 'lowpass'; this.waterF.frequency.value = 500;
    this.waterG = ac.createGain(); this.waterG.gain.value = 0;
    bs.connect(this.waterF).connect(this.waterG).connect(this.out); bs.start();
  }
  setEnabled(on) { this.enabled = on; if (this.ac) this.out.gain.setTargetAtTime(on ? .8 : 0, this.ac.currentTime, .05); }
  get ok() { return this.ac && this.enabled && this.ac.state === 'running'; }

  // Called every frame: the steady sounds follow what the worm is doing.
  update(game, dt, playing) {
    if (!this.ac) return;
    const t = this.ac.currentTime, w = game.worm, on = playing && this.enabled;
    const sp = Math.min(1, w.speed / 140), dig = on && w.mode === 'dig', air = on && w.mode === 'air', wet = on && (w.mode === 'water' || w.mode === 'lava');
    const hard = Math.max(0, Math.min(1, (game.cell(w.x, w.y) >= 10 ? .6 : .2) + game.up.vib * .05));
    this.rumbleG.gain.setTargetAtTime(dig ? .05 + sp * .32 : 0, t, .08);
    this.rumbleF.frequency.setTargetAtTime(120 + sp * 220 + hard * 160 + (w.trail ? -40 : 0), t, .1);
    this.humG.gain.setTargetAtTime(dig ? .02 + sp * .07 : 0, t, .1);
    this.hum.frequency.setTargetAtTime(38 + game.up.vib * 4 + sp * 14, t, .2);
    this.humLfo.frequency.setTargetAtTime(5 + sp * 9, t, .2);
    this.windG.gain.setTargetAtTime(air ? Math.min(.18, w.speed / 1600) : 0, t, .1);
    this.windF.frequency.setTargetAtTime(400 + w.speed * 3, t, .1);
    this.waterG.gain.setTargetAtTime(wet ? .12 + sp * .15 : 0, t, .15);
    this.waterF.frequency.setTargetAtTime(w.mode === 'lava' ? 260 : 700, t, .2);
    if (wet && Math.random() < dt * (4 + sp * 12)) this.blip(w.mode === 'lava' ? 90 + Math.random() * 60 : 500 + Math.random() * 700, .04, .05, 'sine', 1.8);
  }

  /* ---------- little builders ---------- */
  env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  tone(freq, dur, vol, type = 'sine', at = 0, slide = 0) {
    if (!this.ok) return;
    const ac = this.ac, t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    this.env(g, t, .006, vol, dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + .05);
  }
  blip(freq, dur, vol, type, slide) { this.tone(freq, dur, vol, type, 0, slide); }
  noise(dur, vol, type = 'lowpass', f0 = 800, f1 = f0, at = 0, q = .8, brown = false) {
    if (!this.ok) return;
    const ac = this.ac, t = ac.currentTime + at, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = brown ? this.brown : this.white;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    this.env(g, t, .005, vol, dur);
    s.connect(f).connect(g).connect(this.out); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
  }

  /* ---------- things happening ---------- */
  eat(combo, st) {
    const k = Math.min(combo - 1, 14), n = 72 + Math.floor(k / 5) * 12 + PENTA[k % 5] - Math.min(st, 3) * 0;
    this.tone(note(n), .28, .16, 'triangle');
    this.tone(note(n + 12), .18, .06, 'sine', .02);
    this.tone(150, .1, .22, 'sine', 0, .5);                 // the gulp
    this.noise(.06, .12, 'bandpass', 1800, 900, 0, 1.5);   // the crunch
  }
  step() {}
  set() { [0, 4, 7, 12, 16].forEach((d, k) => this.tone(note(76 + d), .35, .12, 'triangle', k * .07)); }
  ore(m) {
    if (!this.ok) return;
    const now = this.ac.currentTime;
    if (now - this.oreT < .06) return;
    this.oreT = now;
    this.noise(.035, .09, 'bandpass', 2600 + Math.random() * 1600, 1800, 0, 3);
    this.tone(1200 + (m % 8) * 140 + Math.random() * 90, .05, .03, 'square');
  }
  full() { this.tone(118, .32, .22, 'sawtooth', 0, .72); this.tone(92, .26, .14, 'triangle', .08, .8); this.noise(.3, .08, 'lowpass', 500, 200, 0, 1, true); }
  hard() { this.tone(170, .12, .22, 'square', 0, .45); this.noise(.05, .16, 'highpass', 2500, 1800); }
  breach(v) { const k = Math.min(1, v / 200); this.noise(.28 + k * .2, .1 + k * .2, 'bandpass', 300, 1500 + k * 1500, 0, .9); this.noise(.2, .12, 'lowpass', 900, 200, 0, 1, true); }
  plunge(v) { const k = Math.min(1, v / 250); this.tone(90, .16, .18 + k * .15, 'sine', 0, .55); this.noise(.18, .14 + k * .12, 'lowpass', 1400, 250, 0, 1, true); }
  splash(v) { this.noise(.35, .2, 'highpass', 900, 3000, 0, .8); for (let k = 0; k < 5; k++) this.tone(500 + Math.random() * 800, .05, .05, 'sine', .05 + k * .04, 1.8); }
  land(v) { const k = Math.min(1, v / 300); this.tone(70, .22, .2 + k * .2, 'sine', 0, .5); this.noise(.22, .12 + k * .1, 'lowpass', 600, 150, 0, 1, true); }
  lunge() { this.noise(.18, .1, 'bandpass', 400, 1400, 0, 1.2); }
  thud(v) { this.tone(110, .12, Math.min(.18, v / 1200), 'sine', 0, .5); }
  camp() { this.tone(note(79), .16, .07, 'triangle'); this.tone(note(84), .22, .07, 'triangle', .1); }
  sell(total) {
    const n = Math.min(12, 3 + Math.floor(Math.log10(Math.max(10, total)) * 2));
    for (let k = 0; k < n; k++) this.tone(1800 + Math.random() * 900, .08, .06, 'square', k * .055);
    this.tone(note(88), .35, .1, 'triangle', n * .055); this.tone(note(95), .5, .1, 'triangle', n * .055 + .09);
  }
  upgrade(level) {
    [0, 7, 12, 19].forEach((d, k) => this.tone(note(60 + d + level), .4, .1, 'triangle', k * .08));
    // the tuning fork rings on, a little out of tune with itself
    this.tone(note(81 + level), 2.2, .07, 'sine', .3); this.tone(note(81 + level) * 1.004, 2.2, .06, 'sine', .3);
  }
  no() { this.tone(180, .12, .12, 'square', 0, .7); }
  hurt(cause) {
    if (!this.ok) return;
    const now = this.ac.currentTime;
    if (now - (this.hurtT || 0) < .25) return;
    this.hurtT = now;
    if (cause === 'lava') { this.noise(.25, .14, 'bandpass', 3000, 5000, 0, 2); return; }
    this.tone(95, .25, .2, 'sawtooth', 0, .6);
  }
  faint() { [0, -3, -7, -12].forEach((d, k) => this.tone(note(67 + d), .5, .12, 'triangle', k * .18)); }
  blast(r) { const k = Math.min(1, r / 16); this.noise(1.2, .5 * (.5 + k), 'lowpass', 1600, 60, 0, .7, true); this.tone(60, .9, .4, 'sine', 0, .4); this.noise(.3, .25, 'highpass', 2000, 800); }
  vault() { [0, 3, 7, 10, 14].forEach((d, k) => this.tone(note(57 + d), 2.4, .06, 'sine', k * .15)); this.noise(1.5, .05, 'bandpass', 200, 2000, 0, 4); }
  layer(k) { this.tone(note(45 - k), 2, .12, 'sine'); this.tone(note(45 - k) * 2.76, 1.4, .04, 'sine'); this.tone(note(45 - k) * 5.4, .8, .02, 'sine'); }
  creak() { this.noise(.4, .08, 'bandpass', 300, 180, 0, 6); this.tone(90, .3, .05, 'square', 0, .8); }
  shatter(kind) { for (let k = 0; k < 6; k++) this.tone(kind === 'spike' ? 1800 + Math.random() * 1500 : 600 + Math.random() * 500, .12, .05, kind === 'spike' ? 'triangle' : 'square', k * .025, .6); this.noise(.25, .18, 'highpass', 1500, 600); }
  zap() { this.tone(70, .2, .12, 'sawtooth'); this.noise(.18, .12, 'bandpass', 3000, 5000, 0, 3); }
  win() {
    [0, 4, 7, 12, 16, 19, 24].forEach((d, k) => this.tone(note(60 + d), 3, .09, 'triangle', k * .12));
    [0, 7, 12].forEach(d => this.tone(note(36 + d), 4, .12, 'sine', .9));
  }
}
