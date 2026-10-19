// Clacks, ratchets and dings, all synthesised.
export class Sound {
  constructor() { this.on = true; this.ctx = null; this.lastClack = 0; this.clacks = 0; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.8 : 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 5;
    this.master.connect(comp); comp.connect(c.destination);
    const len = c.sampleRate, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
  }

  setOn(v) { this.on = v; if (this.master) this.master.gain.value = v ? 0.8 : 0; }
  get ok() { return this.ctx && this.on; }

  tone(type, f0, f1, dur, vol, t = this.ctx.currentTime, attack = 0.004) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.03);
  }
  hiss(freq, q, dur, vol, t = this.ctx.currentTime, type = 'bandpass') {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }

  // gumball on gumball, or gumball on glass
  clack(dv, wall) {
    if (!this.ok) return;
    const now = this.ctx.currentTime;
    if (now - this.lastClack < 0.025) return;
    this.lastClack = now;
    const v = Math.min(1, dv / 900);
    if (wall) { this.tone('sine', 300 + Math.random() * 60, 180, 0.07, 0.12 * v + 0.01); this.hiss(2400, 3, 0.03, 0.06 * v); }
    else { const f = 1400 + Math.random() * 900; this.tone('triangle', f, f * 0.8, 0.045, 0.14 * v + 0.01); this.hiss(5000, 4, 0.02, 0.06 * v); }
  }

  play(kind, n = 0) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    switch (kind) {
      case 'ratchet':
        for (let i = 0; i < 9; i++) { const tt = t + i * 0.055; this.hiss(3800, 6, 0.025, 0.22, tt); this.tone('square', 900, 700, 0.015, 0.03, tt); }
        this.tone('sine', 140, 90, 0.5, 0.08, t + 0.45);
        break;
      case 'drop': this.tone('sine', 520, 260, 0.12, 0.08); this.hiss(1200, 2, 0.08, 0.06); break;
      case 'coin': { const f = 880 * Math.pow(2, Math.min(n, 18) / 12); this.tone('triangle', f, f, 0.18, 0.12); this.tone('sine', f * 2, f * 2, 0.1, 0.05, t + 0.03); break; }
      case 'total': [0, 4, 7, 12].forEach((s, i) => this.tone('triangle', 660 * Math.pow(2, s / 12), 660 * Math.pow(2, s / 12), 0.25, 0.12, t + i * 0.06)); this.hiss(8000, 1, 0.3, 0.05, t, 'highpass'); break;
      case 'boom': this.hiss(400, 0.7, 0.6, 0.6, t, 'lowpass'); this.tone('sine', 120, 35, 0.5, 0.5); break;
      case 'munch': for (let i = 0; i < 3; i++) { this.hiss(900, 2, 0.06, 0.3, t + i * 0.09); this.tone('square', 160, 120, 0.04, 0.05, t + i * 0.09); } break;
      case 'crack': this.hiss(3000, 2, 0.08, 0.35); this.tone('sine', 1200, 1800, 0.12, 0.08, t + 0.05); this.tone('sine', 1600, 2400, 0.1, 0.06, t + 0.12); break;
      case 'boing': this.tone('sine', 220 + n * 40, 700 + n * 60, 0.12, 0.08); break;
      case 'nudge': this.hiss(700, 1, 0.18, 0.3, t, 'lowpass'); this.tone('sine', 90, 60, 0.15, 0.25); break;
      case 'knock': [0, 0.16, 0.42].forEach((d) => { this.tone('sine', 110, 70, 0.12, 0.5, t + d); this.hiss(600, 1, 0.06, 0.25, t + d); }); break;
      case 'pick': this.tone('sine', 600, 1200, 0.1, 0.12); this.tone('triangle', 1200, 1200, 0.08, 0.06, t + 0.08); break;
      case 'tap': this.tone('triangle', 900, 900, 0.04, 0.06); break;
      case 'grow': [0, 5, 9, 14].forEach((s, i) => this.tone('sine', 520 * Math.pow(2, s / 12), 520 * Math.pow(2, s / 12), 0.2, 0.08, t + i * 0.08)); break;
      case 'pay': for (let i = 0; i < 6; i++) this.tone('triangle', 1500 - i * 120, 1400 - i * 120, 0.06, 0.08, t + i * 0.05); break;
      case 'evict': [0, -2, -4, -7].forEach((s, i) => this.tone('sawtooth', 220 * Math.pow(2, s / 12), 210 * Math.pow(2, s / 12), 0.35, 0.07, t + i * 0.32, 0.03)); break;
      case 'win': [0, 4, 7, 12, 7, 12, 16, 19].forEach((s, i) => this.tone('triangle', 523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), 0.22, 0.1, t + i * 0.1)); break;
      case 'toss': this.tone('sine', 700, 200, 0.25, 0.1); break;
    }
  }
}
