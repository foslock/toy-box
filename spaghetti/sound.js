// Synthesized sounds: crunches, glue pops, a bell for each judge, applause.
export class Sound {
  constructor() { this.ctx = null; this.on = true; try { this.on = localStorage.getItem('spaghetti.mute') !== '1'; } catch {} }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.out = this.ctx.createGain(); this.out.gain.value = 0.7; this.out.connect(this.ctx.destination);
      const n = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, n, n);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ctx = null; }
  }
  toggle() { this.on = !this.on; try { localStorage.setItem('spaghetti.mute', this.on ? '0' : '1'); } catch {} return this.on; }
  ok() { return this.on && this.ctx && this.ctx.state === 'running'; }

  tone(f, dur, type = 'sine', vol = 0.2, when = 0, f2 = null) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.02);
  }
  burst(dur, freq, q, vol, when = 0, type = 'bandpass') {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  place(mat) {
    const f = mat === 'spaghetti' ? 880 : mat === 'rigatoni' ? 520 : 360;
    this.tone(f, 0.09, 'triangle', 0.18, 0, f * 1.5);
    this.burst(0.05, 2400, 1.5, 0.08);
  }
  erase() { this.burst(0.16, 1400, 0.7, 0.12); }
  nope() { this.tone(220, 0.12, 'square', 0.05, 0, 180); }
  click() { this.tone(660, 0.05, 'triangle', 0.1); }
  snap(mat) {
    // a sharp crack followed by crumbly bits
    const f = mat === 'spaghetti' ? 3800 : mat === 'rigatoni' ? 2200 : 1500;
    this.burst(0.05, f, 2, 0.5);
    this.tone(f / 3, 0.04, 'square', 0.12, 0, f / 6);
    for (let i = 0; i < 5; i++) this.burst(0.03, f * (0.6 + Math.random() * 0.8), 3, 0.12, 0.03 + i * 0.025 + Math.random() * 0.02);
  }
  creak(k) { this.tone(70 + k * 50, 0.25, 'sawtooth', 0.025 * k, 0, 55 + k * 30); }
  bell(i) {
    const base = [784, 880, 988, 1047][i % 4];
    this.tone(base, 0.9, 'sine', 0.16); this.tone(base * 2.01, 0.5, 'sine', 0.05);
  }
  through() { this.tone(660, 0.12, 'triangle', 0.12); this.tone(990, 0.2, 'triangle', 0.12, 0.08); }
  applause() {
    if (!this.ok()) return;
    for (let i = 0; i < 70; i++) this.burst(0.03 + Math.random() * 0.03, 1500 + Math.random() * 2500, 1.2, 0.05 + Math.random() * 0.06, Math.random() * 1.8 * Math.sqrt(Math.random()));
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.1, 0.05 + i * 0.09));
  }
  fail() {
    this.tone(392, 0.35, 'triangle', 0.14, 0, 370);
    this.tone(349, 0.35, 'triangle', 0.14, 0.33, 330);
    this.tone(311, 0.8, 'triangle', 0.14, 0.66, 260);
  }
  ribbon() { [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.08, i * 0.07)); }
}
