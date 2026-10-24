// Everything synthesized: a sneaky little harpsichord tune, and a noise for every trick.
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.music = true; this.nextNote = 0; this.step = 0; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.out = c.createGain(); this.out.gain.value = this.on ? 0.85 : 0; this.out.connect(c.destination);
    this.mus = c.createGain(); this.mus.gain.value = 0.16; this.mus.connect(this.out);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.nextNote = c.currentTime + 0.1;
  }
  setOn(v) { this.on = v; if (this.out) this.out.gain.setTargetAtTime(v ? 0.85 : 0, this.ctx.currentTime, 0.05); }

  tone(type, f0, f1, dur, vol, at = 0, dest = this.out) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.03);
  }
  hiss(dur, f, q, vol, at = 0, type = 'bandpass', f1) {
    const c = this.ctx, t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl).connect(g).connect(this.out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  // a plucked harpsichord-ish string: two detuned saws through a closing low-pass
  pluck(f, at, vol = 0.5, dest = this.mus, dur = 0.5) {
    const c = this.ctx, t = c.currentTime + at;
    const g = c.createGain(), fl = c.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 9, t); fl.frequency.exponentialRampToValueAtTime(f * 1.4, t + dur * 0.7); fl.Q.value = 2;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    for (const det of [-5, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(fl); o.start(t); o.stop(t + dur + 0.05); }
    fl.connect(g).connect(dest);
  }
  creak(dur, f = 140, vol = 0.18, at = 0) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 1.6, t + dur);
    lfo.frequency.value = 38; lg.gain.value = f * 0.25; lfo.connect(lg).connect(o.frequency);
    fl.type = 'bandpass'; fl.frequency.value = 900; fl.Q.value = 3;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.05); g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(fl).connect(g).connect(this.out); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------- the score
  // D minor, tiptoeing: a bass on the beat and a sly melody that skips around it
  tickMusic(tension = 0) {
    if (!this.ctx || !this.music) return;
    const c = this.ctx;
    const bpm = 96 + tension * 24, beat = 60 / bpm / 2;
    const N = (n) => 293.66 * Math.pow(2, n / 12);
    const bass = [-12, -12, -17, -17, -14, -14, -19, -17];
    const mel = [0, 3, 7, 3, 8, 7, 3, 1, 0, null, 5, 3, 2, 3, -2, null, 0, 3, 7, 10, 8, 7, 5, 3, 2, 3, 5, 2, -2, 0, null, null];
    while (this.nextNote < c.currentTime + 0.25) {
      const at = this.nextNote - c.currentTime, s = this.step;
      if (s % 2 === 0) this.pluck(N(bass[(s >> 2) % 8]), at, 0.36, this.mus, 0.4);
      const m = mel[s % mel.length];
      if (m != null && (s % 4 !== 3 || tension > 0.4)) this.pluck(N(m + 12), at, 0.26, this.mus, 0.34);
      this.nextNote += beat; this.step++;
    }
  }

  // ------------------------------------------------------------- tricks
  trick(kind) {
    if (!this.ctx) return;
    switch (kind) {
      case 'kettle': this.tone('sine', 1300, 2400, 1.3, 0.12); this.tone('sine', 1320, 2440, 1.3, 0.08); this.hiss(1.2, 3000, 2, 0.08); break;
      case 'cupboard': this.creak(0.35, 120, 0.15); this.hiss(0.15, 300, 1, 0.5, 0.35, 'lowpass'); this.tone('triangle', 90, 40, 0.25, 0.4, 0.35); break;
      case 'cups': for (let i = 0; i < 9; i++) this.tone('sine', 2600 + Math.random() * 900, 2400, 0.08, 0.08, i * 0.06 + Math.random() * 0.02); break;
      case 'clock': for (let i = 0; i < 3; i++) { this.tone('sine', 392, 390, 1.6, 0.22, i * 0.55); this.tone('sine', 392 * 2.76, 1080, 0.8, 0.06, i * 0.55); } break;
      case 'lamp': for (let i = 0; i < 6; i++) this.tone('square', 120, 118, 0.05, 0.07, i * 0.12 + Math.random() * 0.05); this.hiss(0.3, 4000, 1, 0.05); break;
      case 'portrait': this.tone('sine', 110, 90, 1.4, 0.2); this.tone('sine', 116, 94, 1.4, 0.14); break;
      case 'radio': this.hiss(1.3, 1800, 0.6, 0.18); this.tone('sine', 900, 300, 1.2, 0.06); this.tone('sine', 440, 1200, 0.9, 0.05, 0.3); break;
      case 'wardrobe': this.creak(1.1, 90, 0.18); break;
      case 'curtain': this.hiss(1.2, 600, 0.8, 0.16, 0, 'bandpass', 1800); break;
      case 'taps': this.hiss(1.3, 2400, 0.5, 0.12, 0, 'highpass'); this.tone('sine', 300, 280, 0.6, 0.05); break;
      case 'duck': for (let i = 0; i < 2; i++) this.tone('square', 1500, 900, 0.16, 0.08, i * 0.24); break;
      case 'mirror': this.hiss(1.2, 900, 1.2, 0.14, 0, 'bandpass', 500); this.tone('sine', 1760, 1700, 1, 0.025, 0.3); break;
      case 'rocker': for (let i = 0; i < 4; i++) this.creak(0.32, 150 + (i % 2) * 30, 0.12, i * 0.4); break;
      case 'musicbox': { const m = [17, 15, 14, 10, 14, 12, 10]; m.forEach((n, i) => this.tone('sine', 587 * Math.pow(2, n / 12), 587 * Math.pow(2, n / 12), 0.5, 0.09, i * 0.2)); break; }
      case 'dummy': this.creak(0.7, 70, 0.2); this.tone('sine', 220, 200, 1, 0.05, 0.6); break;
      case 'record': this.hiss(1.4, 5000, 0.4, 0.04, 0, 'highpass'); { const m = [0, -2, -5, -7, -9]; m.forEach((n, i) => this.tone('sawtooth', 220 * Math.pow(2, n / 12), 160 * Math.pow(2, n / 12), 0.28, 0.05, i * 0.24)); } break;
      case 'shutters': for (let i = 0; i < 3; i++) { this.tone('triangle', 120, 50, 0.18, 0.4, i * 0.26); this.hiss(0.12, 500, 1, 0.3, i * 0.26, 'lowpass'); } break;
    }
  }
  spotted() { if (!this.ctx) return; this.tone('triangle', 300, 200, 0.2, 0.12); this.tone('triangle', 240, 160, 0.3, 0.12, 0.14); }
  denied() { if (!this.ctx) return; this.tone('square', 160, 150, 0.08, 0.05); }
  bark() { if (!this.ctx) return; for (let i = 0; i < 2; i++) { this.tone('sawtooth', 420, 180, 0.12, 0.18, i * 0.2); this.hiss(0.1, 900, 2, 0.2, i * 0.2); } }
  giggle() { if (!this.ctx) return; for (let i = 0; i < 4; i++) this.tone('sine', 900 + i * 40, 1100, 0.09, 0.07, i * 0.1); }
  // a yelp: a quick vowel-ish rise and fall, pitched by who it is
  yelp(pitch = 1, big = false) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth';
    const f = 220 * pitch, d = big ? 0.6 : 0.3;
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (big ? 2.2 : 1.7), t + d * 0.3); o.frequency.exponentialRampToValueAtTime(f * 1.1, t + d);
    f1.type = 'bandpass'; f1.frequency.value = 800; f1.Q.value = 5; f2.type = 'bandpass'; f2.frequency.value = 1200; f2.Q.value = 6;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(f1).connect(g); o.connect(f2).connect(g); g.connect(this.out); o.start(t); o.stop(t + d + 0.05);
  }
  door() { if (!this.ctx) return; this.tone('triangle', 90, 40, 0.4, 0.5); this.hiss(0.2, 400, 1, 0.4, 0, 'lowpass'); }
  win() { if (!this.ctx) return; [0, 3, 7, 12, 15].forEach((n, i) => this.pluck(293.66 * Math.pow(2, n / 12), i * 0.12, 0.5, this.out, 0.8)); }
  lose() { if (!this.ctx) return; [7, 5, 3, 2, 0, -5].forEach((n, i) => this.pluck(293.66 * Math.pow(2, n / 12), i * 0.18, 0.4, this.out, 0.7)); }
  tick() { if (!this.ctx) return; this.tone('sine', 1400, 1400, 0.05, 0.05); }
  combo(n) { if (!this.ctx) return; this.pluck(293.66 * Math.pow(2, [0, 0, 7, 12, 15, 19][Math.min(5, n)] / 12), 0, 0.5, this.out, 0.5); }
}
