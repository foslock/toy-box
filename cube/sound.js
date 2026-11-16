// Twenty-Seven Rooms: stone sounds, all synthesized. A low room tone, soft
// footfalls, a long grinding rumble when a layer turns, and a bright little
// chime for keys and the gold.

export class Sound {
  constructor() { this.ctx = null; this.on = true; }
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.7 : 0; this.master.connect(c.destination);
    const len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.03 * (Math.random() * 2 - 1)) / 1.03; d[i] = last * 3; }
    this.brown = buf;
    const wn = c.createBuffer(1, c.sampleRate, c.sampleRate), w = wn.getChannelData(0);
    for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;
    this.white = wn;
    // room tone: brown noise, very low
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    const g = c.createGain(); g.gain.value = 0.12;
    src.connect(lp); lp.connect(g); g.connect(this.master); src.start();
    // a drone, two soft sines a fifth apart
    for (const f of [55, 82.5]) {
      const o = c.createOscillator(), og = c.createGain(); o.frequency.value = f; og.gain.value = 0.018;
      o.connect(og); og.connect(this.master); o.start();
    }
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setOn(on) { this.on = on; if (this.master) this.master.gain.setTargetAtTime(on ? 0.7 : 0, this.ctx.currentTime, 0.05); }

  tone(freq, t0, dur, vol, type = 'sine', glide = 0) {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  noise(t0, dur, vol, f0, f1, q = 1, buf) {
    const c = this.ctx; if (!c) return;
    const s = c.createBufferSource(); s.buffer = buf || this.white; s.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t0); bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.08, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(bp); bp.connect(g); g.connect(this.master); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }
  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  step() { this.noise(this.t, 0.06, 0.05, 900 + Math.random() * 300, 500, 2); }
  bump() { this.tone(90, this.t, 0.12, 0.2, 'sine', 0.6); this.noise(this.t, 0.08, 0.06, 400, 200, 1); }
  door() { this.noise(this.t, 0.18, 0.08, 600, 250, 1.5); }
  grind(dur) {
    const t = this.t;
    this.noise(t, dur, 0.5, 120, 70, 0.8, this.brown);
    this.noise(t, dur, 0.12, 300, 180, 3);
    for (let k = 0; k < 6; k++) this.noise(t + k * dur / 6 + Math.random() * 0.05, 0.07, 0.07, 1400, 900, 4);
    this.tone(48, t, dur, 0.18, 'triangle', 0.85);
    this.tone(70, t + dur - 0.1, 0.35, 0.3, 'sine', 0.5);  // the thud as it seats
  }
  climb() { const t = this.t; for (let k = 0; k < 4; k++) this.noise(t + k * 0.09, 0.05, 0.06, 1200, 700, 3); }
  key() { const t = this.t; [1318, 1760, 2093].forEach((f, i) => this.tone(f, t + i * 0.06, 0.4, 0.08, 'triangle')); }
  unlock() { const t = this.t; this.noise(t, 0.08, 0.1, 2000, 1200, 5); this.tone(220, t + 0.08, 0.25, 0.15, 'square', 0.5); this.noise(t + 0.1, 0.3, 0.08, 500, 200, 1); }
  gold() { const t = this.t; [523, 659, 784, 1047, 1319].forEach((f, i) => { this.tone(f, t + i * 0.09, 0.9, 0.08, 'triangle'); this.tone(f * 2, t + i * 0.09, 0.5, 0.02, 'sine'); }); }
  swish() { this.noise(this.t, 0.12, 0.08, 2500, 900, 2); }
  crunch() { const t = this.t; this.noise(t, 0.1, 0.18, 1800, 500, 1); this.tone(140, t, 0.1, 0.1, 'square', 0.5); }
  nip() { const t = this.t; this.tone(880, t, 0.08, 0.1, 'square', 1.4); this.tone(660, t + 0.07, 0.14, 0.08, 'square', 0.7); }
  undo() { const t = this.t; this.noise(t, 0.3, 0.2, 200, 500, 1, this.brown); }
  win() { const t = this.t; [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.12, 0.8, 0.09, 'triangle')); }
}
