// Every sound is synthesised: dice in a leather cup, wood, a lamp chain, a low room hum.
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.master = null; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.on ? 0.8 : 0;
    this.master.connect(this.ctx.destination);
    // a noise buffer to share
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // room tone: brown-ish noise, very low
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    const g = this.ctx.createGain(); g.gain.value = 0.05;
    src.connect(lp).connect(g).connect(this.master); src.start();
  }
  setOn(on) {
    this.on = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }
  get t() { return this.ctx.currentTime; }
  burst(at, dur, freq, q, gain, type = 'bandpass') {
    const c = this.ctx, s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(at, Math.random() * 1.5); s.stop(at + dur + 0.05);
  }
  tone(at, freq, dur, gain, type = 'sine', to) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, at);
    if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.master); o.start(at); o.stop(at + dur + 0.05);
  }
  ok() { return this.ctx && this.on; }
  rattle(sec = 0.7) {
    if (!this.ok()) return;
    const t = this.t;
    for (let i = 0; i < sec * 26; i++) this.burst(t + Math.random() * sec, 0.025 + Math.random() * 0.03, 1800 + Math.random() * 2600, 6, 0.2 + Math.random() * 0.25);
    for (let i = 0; i < 6; i++) this.burst(t + (i / 6) * sec, 0.08, 400, 2, 0.12);
  }
  slam() {
    if (!this.ok()) return;
    const t = this.t;
    this.tone(t, 120, 0.22, 0.6, 'sine', 45);
    this.burst(t, 0.06, 900, 1.2, 0.5);
    for (let i = 0; i < 5; i++) this.burst(t + 0.01 + Math.random() * 0.08, 0.02, 3000, 8, 0.15);
  }
  tap() { if (!this.ok()) return; const t = this.t; this.tone(t, 760, 0.07, 0.18, 'triangle', 500); this.burst(t, 0.03, 2400, 3, 0.15); }
  bid() { if (!this.ok()) return; const t = this.t; this.burst(t, 0.09, 1200, 0.8, 0.18); this.tone(t, 220, 0.12, 0.2, 'triangle', 180); }
  tick(n = 0) { if (!this.ok()) return; const t = this.t; this.tone(t, 620 + n * 70, 0.12, 0.35, 'triangle'); this.burst(t, 0.02, 4000, 4, 0.2); }
  liar() {
    if (!this.ok()) return;
    const t = this.t;
    this.tone(t, 98, 0.5, 0.35, 'sawtooth', 70);
    this.tone(t, 147, 0.45, 0.2, 'sawtooth', 104);
    this.burst(t, 0.18, 300, 0.7, 0.6, 'lowpass');
  }
  lift() { if (!this.ok()) return; const t = this.t; this.burst(t, 0.18, 700, 1.5, 0.12); }
  lose() { if (!this.ok()) return; const t = this.t; this.tone(t, 330, 0.3, 0.25, 'triangle'); this.tone(t + 0.22, 247, 0.5, 0.25, 'triangle'); this.burst(t + 0.05, 0.04, 2600, 5, 0.25); }
  gain() { if (!this.ok()) return; const t = this.t; [392, 494, 587].forEach((f, i) => this.tone(t + i * 0.09, f, 0.35, 0.18, 'triangle')); }
  creak() {
    if (!this.ok()) return;
    const c = this.ctx, t = this.t, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(52, t + 0.7);
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 9;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.15); g.gain.linearRampToValueAtTime(0, t + 0.7);
    o.connect(f).connect(g).connect(this.master); o.start(t); o.stop(t + 0.8);
  }
  win() { if (!this.ok()) return; const t = this.t; [262, 330, 392, 523].forEach((f, i) => this.tone(t + i * 0.13, f, 0.6, 0.2, 'triangle')); }
  out() { if (!this.ok()) return; const t = this.t; [262, 233, 196, 147].forEach((f, i) => this.tone(t + i * 0.18, f, 0.7, 0.2, 'triangle')); }
}
