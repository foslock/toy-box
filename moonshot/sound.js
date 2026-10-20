// Synth sound effects: a thump to fire, noise for blasts, a theremin wobble for the drama.
export class Sound {
  constructor() { this.ctx = null; this.on = true; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.out = this.ctx.createGain(); this.out.gain.value = 0.55; this.out.connect(this.ctx.destination);
      const n = this.ctx.sampleRate * 1.5, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
    } catch { this.ctx = null; }
  }
  get ok() { return this.on && this.ctx && this.ctx.state === 'running'; }

  tone(type, f0, f1, dur, vol, at = 0) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  hiss(dur, vol, f0, f1, q = 1, at = 0) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + at, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = 'lowpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.05);
  }

  fire(kind) {
    if (kind === 'jet') { this.hiss(0.7, 0.35, 3000, 400, 2); this.tone('sawtooth', 90, 60, 0.5, 0.08); return; }
    this.tone('sine', 160, 45, 0.25, 0.5);
    this.hiss(0.18, 0.25, 2400, 300);
    if (kind === 'mine') this.tone('triangle', 300, 900, 0.3, 0.1, 0.05);
  }
  boom(R) {
    const k = R / 30;
    this.tone('sine', 110 * (1.2 - k * 0.3), 30, 0.7, 0.7);
    this.hiss(1.0 * k, 0.6, 1800, 60, 0.7);
    this.hiss(0.25, 0.35, 6000, 800, 0.5);
  }
  bounce(v) { this.tone('triangle', 520 + Math.random() * 80, 300, 0.08, Math.min(0.25, v / 600)); }
  thud(v) { this.tone('sine', 120, 50, 0.15, Math.min(0.35, v / 700)); this.hiss(0.1, 0.12, 900, 200); }
  stick() { this.tone('square', 220, 110, 0.12, 0.08); this.theremin(660, 440, 0.6, 0.06); }
  step() { this.hiss(0.05, 0.05, 1400, 400, 2); }
  click() { this.tone('square', 900, 700, 0.04, 0.05); }
  turn() { this.tone('triangle', 660, 660, 0.09, 0.08); this.tone('triangle', 990, 990, 0.14, 0.07, 0.09); }
  stray() { this.theremin(700, 1100, 0.9, 0.08); }
  lost() { this.theremin(900, 200, 1.6, 0.1); }
  die() { this.theremin(520, 140, 1.2, 0.12); }
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.35, 0.12, i * 0.14)); this.theremin(1046, 1320, 1.4, 0.06, 0.6); }
  // the wobbly B-movie theremin
  theremin(f0, f1, dur, vol, at = 0) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + at, o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    lfo.frequency.value = 6.5; lg.gain.value = f0 * 0.025; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }
}
