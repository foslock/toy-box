// Little synthesized seaside: surf, plops, caws and a beep or two.
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.last = {}; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.out = c.createGain(); this.out.gain.value = this.on ? 0.8 : 0; this.out.connect(c.destination);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 2.5; }
    // the surf: looping noise through a low-pass, swelling with the waves
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
    this.surfF = c.createBiquadFilter(); this.surfF.type = 'lowpass'; this.surfF.frequency.value = 500;
    this.surfG = c.createGain(); this.surfG.gain.value = 0;
    src.connect(this.surfF).connect(this.surfG).connect(this.out); src.start();
  }
  setOn(v) { this.on = v; if (this.out) this.out.gain.setTargetAtTime(v ? 0.8 : 0, this.ctx.currentTime, 0.05); }

  surf(level) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.surfG.gain.setTargetAtTime(0.05 + level * 0.16, t, 0.25);
    this.surfF.frequency.setTargetAtTime(380 + level * 1300, t, 0.25);
  }

  tone(type, f0, f1, dur, vol, at = 0) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.02);
  }
  hiss(dur, f, q, vol, at = 0, type = 'bandpass') {
    const c = this.ctx, t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 1;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl).connect(g).connect(this.out); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }

  play(name, v = 1) {
    if (!this.ctx || !this.on) return;
    const now = this.ctx.currentTime;
    const gap = { pinch: 0.06, dig: 0.05, scoop: 0.05, peck: 0.05, thud: 0.04, shell: 0.03, splash: 0.05, beep: 0.1, scrape: 0.07 }[name] ?? 0.02;
    if (now - (this.last[name] || 0) < gap) return;
    this.last[name] = now;
    const r = Math.random();
    switch (name) {
      case 'grab': this.tone('square', 520, 780, 0.07, 0.05); break;
      case 'whoosh': this.hiss(0.25, 900 + v * 900, 1.2, 0.12 * v + 0.04); break;
      case 'plop': this.tone('sine', 900, 160, 0.16, 0.22); this.hiss(0.3, 1400, 0.8, 0.08, 0.03); break;
      case 'splash': this.hiss(0.35, 1800, 0.6, 0.06 + v * 0.14); this.tone('sine', 600, 200, 0.1, 0.06); break;
      case 'thud': this.tone('triangle', 140, 50, 0.16, 0.2 * v + 0.05); this.hiss(0.1, 500, 1, 0.08 * v); break;
      case 'pinch': this.tone('square', 1500 + r * 300, 1200, 0.03, 0.035 * v); this.tone('square', 1700, 1300, 0.03, 0.03 * v, 0.05); break;
      case 'peck': this.tone('square', 1100 + r * 200, 900, 0.025, 0.03 * v); break;
      case 'dig': this.hiss(0.08, 2600, 1.5, 0.05 * v); break;
      case 'scoop': this.hiss(0.12, 1800, 2, 0.06 * v); break;
      case 'scrape': this.hiss(0.09, 2200 + r * 800, 2, 0.05 * v); break;
      case 'pat': this.tone('triangle', 220 + r * 40, 120, 0.05, 0.08 * v); break;
      case 'caw': this.tone('sawtooth', 1300, 850, 0.12, 0.05); this.tone('sawtooth', 1250, 800, 0.14, 0.045, 0.16); break;
      case 'bark': this.tone('sawtooth', 420, 260, 0.08, 0.08); this.tone('sawtooth', 460, 280, 0.08, 0.07, 0.13); break;
      case 'shell': this.tone('sine', 1760, 1760, 0.12, 0.08); this.tone('sine', 2640, 2640, 0.18, 0.06, 0.06); break;
      case 'buy': this.tone('square', 660, 660, 0.06, 0.05); this.tone('square', 990, 990, 0.1, 0.05, 0.07); break;
      case 'stamp': this.tone('triangle', 180, 70, 0.2, 0.22); this.hiss(0.15, 900, 1, 0.08); break;
      case 'knock': this.tone('square', 300, 200, 0.05, 0.08); this.tone('square', 300, 200, 0.05, 0.08, 0.11); break;
      case 'beep': this.tone('square', 1900, 1900, 0.05, 0.035); break;
      case 'whistle': this.tone('sine', 2300, 2500, 0.25, 0.08); this.tone('sine', 2500, 2300, 0.2, 0.08, 0.27); break;
      case 'wah': this.tone('triangle', 600, 420, 0.35, 0.09); this.tone('triangle', 650, 380, 0.4, 0.08, 0.4); break;
      case 'giggle': for (let i = 0; i < 3; i++) this.tone('triangle', 900 + i * 60, 760, 0.06, 0.05, i * 0.08); break;
      case 'flagdown': this.tone('triangle', 520, 130, 0.9, 0.14); break;
      case 'bell': [523, 659, 784].forEach((f, i) => this.tone('triangle', f, f, 0.5, 0.08, i * 0.12)); break;
      case 'fanfare': [523, 659, 784, 1046].forEach((f, i) => this.tone('square', f, f, 0.3 + (i === 3 ? 0.5 : 0), 0.05, i * 0.14)); break;
      case 'tick': this.tone('square', 1200, 1200, 0.02, 0.03); break;
    }
  }
}
