// Everything you hear is made here with Web Audio: bells, the dam's groan, the siren, the water.
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.amb = null; this.chirpAt = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.8 : 0;
    const comp = c.createDynamicsCompressor(); this.master.connect(comp); comp.connect(c.destination);
    // a second of noise, looped, for water and wind
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = buf;
    // the river, always, very quietly
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6; this.riverG = c.createGain(); this.riverG.gain.value = 0.025; src.connect(f); f.connect(this.riverG); this.riverG.connect(this.master); src.start();
  }
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? 0.8 : 0, this.ctx.currentTime, 0.05); }
  ok() { return this.ctx && this.on; }
  tone(freq, dur, type = 'sine', vol = 0.1, when = 0, to = null) {
    if (!this.ok()) return; const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, vol, freq = 800, type = 'lowpass', when = 0, rampTo = null) {
    if (!this.ok()) return; const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); if (rampTo) f.frequency.exponentialRampToValueAtTime(rampTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.05);
  }
  bell(vol = 0.16, base = 330) { for (const [m, v, d] of [[1, 1, 3.2], [2.01, .6, 2.4], [2.76, .4, 1.8], [4.07, .25, 1.2], [5.4, .15, .8]]) this.tone(base * m, d, 'sine', vol * v * .5); }
  chime(n) { this.bell(0.12, 392); }
  blip(k = 0) { this.tone(520 + (k % 5) * 40, 0.045, 'square', 0.025); }
  step() { this.noise(0.05, 0.02, 500, 'bandpass'); }
  door() { this.tone(200, 0.08, 'triangle', 0.08); this.tone(150, 0.1, 'triangle', 0.06, 0.07); }
  learn() { [660, 880, 1320].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.06, i * 0.07)); }
  item() { this.tone(740, 0.1, 'triangle', 0.07); this.tone(990, 0.16, 'triangle', 0.06, 0.08); }
  groan(level) {
    if (!this.ok()) return; const c = this.ctx, t = c.currentTime, d = level === 3 ? 5.2 : level === 2 ? 4 : 3, v = level === 3 ? 0.5 : level === 2 ? 0.3 : 0.18;
    for (const [f0, f1, type, m] of [[46, 31, 'sawtooth', 1], [69, 44, 'sawtooth', .5], [92, 58, 'square', .25]]) {
      const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1 * (level === 3 ? .8 : 1), t + d); lp.type = 'lowpass'; lp.frequency.value = 220 + level * 90;
      lfo.frequency.value = 5 + level * 2; lg.gain.value = 3 + level * 2; lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * m, t + d * 0.35); g.gain.linearRampToValueAtTime(v * m * .85, t + d * .7); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(lp); lp.connect(g); g.connect(this.master); o.start(t); lfo.start(t); o.stop(t + d + .1); lfo.stop(t + d + .1);
    }
    this.noise(d, v * .5, 160, 'lowpass', 0, 60);
    if (level === 3) { this.noise(1.2, .3, 3000, 'highpass', 3.4); }
  }
  burst() { this.noise(2.5, 0.6, 4000, 'lowpass', 0, 200); this.tone(60, 1.6, 'sawtooth', .3, 0, 25); }
  flood() { this.noise(15, 0.55, 500, 'lowpass', 0.3, 1400); this.noise(15, .2, 120, 'lowpass', 0, 60); }
  siren() { for (let i = 0; i < 4; i++) { this.tone(440, 1.4, 'sawtooth', 0.07, i * 1.5, 760); this.tone(760, 1.4, 'sawtooth', 0.07, i * 1.5 + 1.4, 440); } }
  decree() { [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.5, 'triangle', .08, i * .09)); }
  rewind() { if (!this.ok()) return; this.tone(1200, 1.6, 'sine', .06, 0, 90); for (let i = 0; i < 6; i++) this.tone(900 - i * 90, .05, 'square', .03, i * .22); this.noise(1.5, .05, 3000, 'bandpass', 0, 400); }
  win() { [262, 330, 392, 523, 659].forEach((f, i) => this.tone(f, 2.6, 'sine', .07, i * .3)); this.bell(.2, 262); }
  chirp() { const f = 2200 + Math.random() * 1600; this.tone(f, .07, 'sine', .018); this.tone(f * 1.2, .06, 'sine', .015, .09); if (Math.random() < .5) this.tone(f * .9, .05, 'sine', .012, .18); }
  // ambient life, from the page's clock: bird calls while the day is calm, the river hushed when the dam begins to groan
  ambient(t, calm) {
    if (!this.ok()) return; const now = this.ctx.currentTime;
    if (this.riverG) this.riverG.gain.setTargetAtTime(calm ? 0.025 : 0.01, now, 0.5);
    if (calm && now > this.chirpAt) { this.chirp(); this.chirpAt = now + 1.5 + Math.random() * 4; }
  }
}
