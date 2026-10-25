// Wind, snow, thuds, boings and a little oom-pah band, all synthesized.
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.musicOn = true; this.last = {}; this.beat = 0; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.out = c.createGain(); this.out.gain.value = this.on ? 0.8 : 0; this.out.connect(c.destination);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // wind: a looping noise through a band-pass that opens with speed
    const loop = (type, f) => {
      const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = 0.7;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(fl).connect(g).connect(this.out); src.start();
      return { fl, g };
    };
    this.wind = loop('bandpass', 400);
    this.scrape = loop('lowpass', 900);
    this.burn = loop('highpass', 1200);
    this.music = c.createGain(); this.music.gain.value = 0.0; this.music.connect(this.out);
    this.nextNote = c.currentTime + 0.1;
  }
  setOn(v) { this.on = v; if (this.out) this.out.gain.setTargetAtTime(v ? 0.8 : 0, this.ctx.currentTime, 0.05); }

  // called every frame with the flight's state
  update(st) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const v = st ? st.speed : 0;
    this.wind.g.gain.setTargetAtTime(st && !st.ground ? Math.min(0.22, 0.02 + v / 600) : 0.015, t, 0.15);
    this.wind.fl.frequency.setTargetAtTime(250 + Math.min(1800, v * 12), t, 0.2);
    this.scrape.g.gain.setTargetAtTime(st && st.ground && v > 1 ? Math.min(0.25, 0.04 + v / 150) : 0, t, 0.05);
    this.scrape.fl.frequency.setTargetAtTime(500 + Math.min(2500, v * 40) * (st && st.ice ? 2 : 1), t, 0.1);
    this.burn.g.gain.setTargetAtTime(st && st.boost ? 0.22 : 0, t, 0.04);
    this.music.gain.setTargetAtTime(this.musicOn && st && st.calm ? 0.13 : (this.musicOn ? 0.05 : 0), t, 0.6);
    this.band();
  }

  tone(type, f0, f1, dur, vol, at = 0, dest = this.out) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }
  hiss(dur, f, q, vol, at = 0, type = 'bandpass') {
    const c = this.ctx, t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl).connect(g).connect(this.out); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  gate(k, ms) { const n = performance.now(); if (n - (this.last[k] || 0) < ms) return false; this.last[k] = n; return true; }

  play(name, v = 1) {
    if (!this.ctx || !this.on) return;
    switch (name) {
      case 'go': this.tone('triangle', 330, 660, 0.18, 0.15); this.hiss(0.5, 1500, 0.5, 0.08); break;
      case 'lip': this.hiss(0.35, 2400, 0.6, 0.12); this.tone('sine', 200, 120, 0.15, 0.15); break;
      case 'land': if (!this.gate('land', 90)) return;
        this.tone('sine', 120 + v * 3, 45, 0.25, Math.min(0.5, 0.15 + v / 30)); this.hiss(0.3, 700, 0.8, Math.min(0.3, 0.06 + v / 40)); break;
      case 'boing': if (!this.gate('boing', 80)) return;
        { const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
          o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.28);
          lfo.frequency.value = 18; lg.gain.value = 30; lfo.connect(lg).connect(o.frequency);
          g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
          o.connect(g).connect(this.out); o.start(t); lfo.start(t); o.stop(t + 0.5); lfo.stop(t + 0.5); }
        break;
      case 'honk': this.tone('sawtooth', 420, 300, 0.12, 0.08); this.tone('sawtooth', 380, 260, 0.14, 0.07, 0.13); break;
      case 'snap': this.hiss(0.12, 3000, 2, 0.25); this.tone('square', 900, 200, 0.08, 0.06); this.hiss(0.25, 400, 1, 0.12, 0.05); break;
      case 'thud': this.tone('sine', 90, 40, 0.3, 0.25); break;
      case 'burnout': this.tone('square', 500, 120, 0.25, 0.05); this.hiss(0.4, 900, 0.7, 0.08); break;
      case 'splash': this.hiss(1.4, 900, 0.4, 0.4); this.tone('sine', 300, 80, 0.5, 0.2); for (let i = 0; i < 6; i++) this.tone('sine', 700 + Math.random() * 900, 400, 0.08, 0.06, 0.2 + i * 0.09); break;
      case 'crack': this.tone('sine', 300, 60, 0.9, 0.2); this.hiss(0.8, 500, 0.6, 0.1, 0.4); break;
      case 'fish': if (!this.gate('fish', 40)) return; this.tone('triangle', 1200 + v * 80, 1500 + v * 80, 0.07, 0.08); break;
      case 'buy': this.tone('triangle', 523, 523, 0.1, 0.15); this.tone('triangle', 659, 659, 0.1, 0.15, 0.09); this.tone('triangle', 784, 784, 0.18, 0.15, 0.18); break;
      case 'click': this.tone('square', 700, 650, 0.04, 0.05); break;
      case 'record': [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.2, 0.13, i * 0.1)); break;
    }
  }

  // a little brass band in C: tuba on the beat, accordion chords off it, a tune on top
  band() {
    const c = this.ctx;
    if (!this.musicOn) { this.nextNote = c.currentTime + 0.1; return; }
    const spb = 0.27;
    const tune = [67, 0, 72, 71, 72, 74, 76, 0, 74, 72, 71, 72, 74, 0, 67, 0, 69, 0, 71, 72, 74, 72, 71, 69, 67, 0, 65, 64, 62, 0, 0, 0,
      67, 0, 72, 71, 72, 74, 76, 0, 77, 76, 74, 72, 74, 0, 79, 0, 77, 76, 74, 72, 71, 72, 74, 71, 72, 0, 67, 0, 60, 0, 0, 0];
    const roots = [48, 48, 43, 43, 48, 48, 43, 48, 48, 48, 41, 41, 43, 43, 43, 48];
    while (this.nextNote < c.currentTime + 0.25) {
      const b = this.beat, t = this.nextNote - c.currentTime;
      const bar = Math.floor(b / 4) % roots.length, r = roots[bar];
      const hz = (m) => 440 * 2 ** ((m - 69) / 12);
      if (b % 2 === 0) this.tone('triangle', hz(b % 4 === 0 ? r : r + 7), hz(b % 4 === 0 ? r : r + 7) * 0.98, 0.22, 0.5, t, this.music);
      else { const third = r === 43 ? 4 : r === 41 ? 4 : 4; [12, 12 + third, 19].forEach((iv) => this.tone('square', hz(r + iv), hz(r + iv), 0.09, 0.07, t, this.music)); }
      const m = tune[(b * 1) % tune.length];
      if (m) this.tone('square', hz(m), hz(m), spb * 0.8, 0.12, t, this.music);
      this.beat++; this.nextNote += spb;
    }
  }
}
