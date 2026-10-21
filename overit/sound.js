// Synthesised cabinet noises: solenoids, pops, a buzzer, a little fanfare.
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.last = {}; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  ok(name, gap = 0.03) {
    if (!this.ctx || !this.on) return false;
    const t = this.ctx.currentTime;
    if (this.last[name] && t - this.last[name] < gap) return false;
    this.last[name] = t;
    return true;
  }
  tone(type, f0, f1, dur, vol, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  hiss(freq, q, dur, vol, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise;
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
  }
  flip(up) {
    if (!this.ok('flip' + up, 0.04)) return;
    if (up) { this.hiss(2400, 1.2, 0.05, 0.35); this.tone('sine', 120, 60, 0.07, 0.4); }
    else this.hiss(1500, 1.5, 0.035, 0.12);
  }
  bumper() {
    if (!this.ok('bumper', 0.05)) return;
    this.tone('square', 330, 990, 0.06, 0.12);
    this.hiss(3000, 2, 0.06, 0.25);
    this.tone('sine', 90, 50, 0.08, 0.35);
  }
  sling() { if (!this.ok('sling', 0.06)) return; this.hiss(1800, 1, 0.07, 0.35); this.tone('triangle', 260, 140, 0.08, 0.2); }
  wall(v) {
    if (!this.ok('wall', 0.04)) return;
    const k = Math.min(1, v / 1500);
    this.hiss(3500 + Math.random() * 1500, 4, 0.025, 0.05 + k * 0.2);
  }
  target() { if (!this.ok('target', 0.05)) return; this.hiss(1200, 2, 0.08, 0.35); this.tone('square', 880, 880, 0.1, 0.08, 0.02); }
  open() { if (!this.ok('open')) return; [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.12, 0.07, i * 0.06)); }
  up() {
    if (!this.ok('up')) return;
    [392, 523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.1, 0.08, i * 0.07));
    this.hiss(5000, 0.7, 0.6, 0.08);
  }
  down(n = 1) {
    if (!this.ok('down', 0.2)) return;
    this.tone('triangle', 700, 70, 0.7, 0.28);
    this.tone('square', 350, 40, 0.7, 0.05);
  }
  ground() { if (!this.ok('ground', 0.3)) return; this.tone('sine', 80, 40, 0.3, 0.45); this.hiss(400, 1, 0.25, 0.2); }
  nudge() { if (!this.ok('nudge', 0.1)) return; this.tone('sine', 70, 40, 0.15, 0.6); this.hiss(250, 1, 0.12, 0.3); }
  warn() { if (!this.ok('warn', 0.2)) return; this.tone('square', 220, 220, 0.12, 0.08); }
  tilt() { if (!this.ok('tilt', 0.5)) return; this.tone('sawtooth', 70, 68, 0.9, 0.22); this.tone('square', 73, 71, 0.9, 0.1); }
  ghost() { if (!this.ok('ghost', 0.25)) return; this.tone('sine', 500, 180, 0.4, 0.15); this.tone('sine', 520, 200, 0.45, 0.1, 0.05); }
  thunder() { if (!this.ok('thunder', 0.5)) return; this.hiss(180, 0.6, 1.2, 0.5); this.tone('sine', 55, 35, 1, 0.35); this.hiss(2500, 1, 0.08, 0.3); }
  gust() { if (!this.ok('gust', 0.5)) return; this.hiss(600, 0.5, 1.4, 0.25); }
  blip() { if (!this.ok('blip', 0.08)) return; this.tone('square', 1320, 1320, 0.035, 0.05); }
  win() {
    if (!this.ok('win', 1)) return;
    const seq = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
    seq.forEach((f, i) => { this.tone('square', f, f, 0.16, 0.08, i * 0.12); this.tone('triangle', f / 2, f / 2, 0.16, 0.12, i * 0.12); });
  }
}
