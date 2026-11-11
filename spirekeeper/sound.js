// Spire Keeper — small WebAudio kit: chalk taps, thumps, clanks, a crowd swell.
export class Sound {
  constructor() { this.on = true; this.ctx = null; }
  wake() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.out = this.ctx.createGain(); this.out.gain.value = 0.55; this.out.connect(this.ctx.destination);
      const n = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, n, n);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ctx = null; }
  }
  _ok() { return this.on && this.ctx && this.ctx.state === 'running'; }
  _noise(t, dur, { type = 'bandpass', f = 2000, q = 1, gain = 0.3, attack = 0.005, f2 } = {}) {
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(fl).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  _tone(t, f, dur, { type = 'sine', gain = 0.2, f2, attack = 0.005 } = {}) {
    const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  // chalk on slate: a dry tap and a short scratch
  chalk() { if (!this._ok()) return; const t = this.ctx.currentTime; this._noise(t, 0.05, { f: 3200 + Math.random() * 1500, q: 2, gain: 0.25 }); this._noise(t + 0.03, 0.12, { f: 5200, q: 3, gain: 0.08, attack: 0.03 }); }
  scribble() { if (!this._ok()) return; const t = this.ctx.currentTime; for (let i = 0; i < 4; i++) this._noise(t + i * 0.07, 0.07, { f: 3000 + i * 400, q: 2.5, gain: 0.12, attack: 0.02 }); }
  hit(big = false) {
    if (!this._ok()) return; const t = this.ctx.currentTime;
    this._tone(t, big ? 120 : 170, big ? 0.35 : 0.2, { f2: 50, gain: big ? 0.55 : 0.35 });
    this._noise(t, big ? 0.25 : 0.12, { type: 'lowpass', f: 1800, gain: big ? 0.4 : 0.25 });
  }
  hurt(big = false) {
    if (!this._ok()) return; const t = this.ctx.currentTime;
    this._tone(t, big ? 95 : 140, big ? 0.45 : 0.25, { f2: 40, gain: big ? 0.6 : 0.4, type: 'triangle' });
    this._noise(t, 0.2, { type: 'lowpass', f: 900, gain: 0.35 });
  }
  clank() { if (!this._ok()) return; const t = this.ctx.currentTime; this._tone(t, 620, 0.18, { type: 'triangle', gain: 0.12 }); this._tone(t, 930, 0.12, { type: 'triangle', gain: 0.07 }); this._noise(t, 0.08, { f: 4000, q: 4, gain: 0.12 }); }
  heal() { if (!this._ok()) return; const t = this.ctx.currentTime; [523, 659, 784].forEach((f, i) => this._tone(t + i * 0.07, f, 0.3, { type: 'sine', gain: 0.12 })); }
  buff() { if (!this._ok()) return; const t = this.ctx.currentTime; this._tone(t, 330, 0.25, { f2: 660, type: 'square', gain: 0.05 }); }
  debuff() { if (!this._ok()) return; const t = this.ctx.currentTime; this._tone(t, 440, 0.3, { f2: 180, type: 'sawtooth', gain: 0.05 }); }
  // the crowd: filtered noise that swells; size 0..1
  cheer(size = 0.5) {
    if (!this._ok()) return; const t = this.ctx.currentTime;
    this._noise(t, 1.2 + size, { f: 900, q: 0.6, gain: 0.12 + size * 0.22, attack: 0.25, f2: 1400 });
    this._noise(t + 0.1, 1 + size, { f: 2400, q: 0.8, gain: 0.05 + size * 0.1, attack: 0.3 });
  }
  groan() { if (!this._ok()) return; const t = this.ctx.currentTime; this._noise(t, 1.1, { f: 500, q: 1.2, gain: 0.25, attack: 0.15, f2: 260 }); }
  die() { if (!this._ok()) return; const t = this.ctx.currentTime; [392, 330, 262, 196].forEach((f, i) => this._tone(t + i * 0.16, f, 0.4, { type: 'triangle', gain: 0.14 })); }
  win() { if (!this._ok()) return; const t = this.ctx.currentTime; [392, 494, 587, 784].forEach((f, i) => this._tone(t + i * 0.09, f, 0.35, { type: 'triangle', gain: 0.12 })); }
  bell() { if (!this._ok()) return; const t = this.ctx.currentTime; [220, 440, 660].forEach((f, i) => this._tone(t, f * 1.003 ** i, 1.6, { type: 'sine', gain: 0.1 / (i + 1) })); }
}
