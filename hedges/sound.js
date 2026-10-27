// Soft wind, the odd bird, and small garden sounds, all synthesized.
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export class Sound {
  constructor() { this.ctx = null; this.on = true; try { this.on = localStorage.getItem('hedges.sound') !== 'off'; } catch {} }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = this.on ? 0.8 : 0;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.wind();
    this.birdLoop();
  }

  toggle() {
    this.on = !this.on;
    try { localStorage.setItem('hedges.sound', this.on ? 'on' : 'off'); } catch {}
    if (this.ctx) this.master.gain.setTargetAtTime(this.on ? 0.8 : 0, this.ctx.currentTime, 0.1);
    return this.on;
  }

  wind() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain(); g.gain.value = 0.05;
    src.connect(bp).connect(lp).connect(g).connect(this.master);
    src.start();
    const gust = () => {
      const t = ctx.currentTime;
      g.gain.setTargetAtTime(0.03 + Math.random() * 0.07, t, 1.5);
      bp.frequency.setTargetAtTime(300 + Math.random() * 400, t, 2);
      setTimeout(gust, 2500 + Math.random() * 4000);
    };
    gust();
  }

  birdLoop() {
    const go = () => {
      if (this.on && this.ctx.state === 'running') this.bird();
      setTimeout(go, 4000 + Math.random() * 9000);
    };
    setTimeout(go, 2500);
  }

  bird() {
    const ctx = this.ctx, t0 = ctx.currentTime + 0.05;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const out = ctx.createGain(); out.gain.value = 0.05 + Math.random() * 0.04;
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; out.connect(pan).connect(this.master); } else out.connect(this.master);
    const base = 2400 + Math.random() * 1400, notes = 2 + Math.floor(Math.random() * 5);
    const kind = Math.random();
    for (let i = 0; i < notes; i++) {
      const t = t0 + i * (0.09 + Math.random() * 0.07);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      const f = base * (kind < 0.5 ? 1 + (i % 2) * 0.18 : 1 + i * 0.05);
      o.frequency.setValueAtTime(f * 0.85, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.04);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.1);
    }
    setTimeout(() => out.disconnect(), 2000);
  }

  tone(freq, t, dur, vol, type = 'sine') {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  hiss(t, dur, vol, freq, q = 0.8, type = 'bandpass') {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  ready() { return this.ctx && this.on; }

  step(n) { // a soft tick that climbs as the line grows
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    const semi = PENTA[n % PENTA.length] + 12 * Math.floor(n / PENTA.length) * 0;
    this.tone(523.25 * 2 ** (semi / 12), t, 0.12, 0.05, 'triangle');
    this.hiss(t, 0.05, 0.05, 3500, 1.2);
  }
  back() { if (!this.ready()) return; const t = this.ctx.currentTime; this.hiss(t, 0.05, 0.04, 1800, 1.2); }

  solve(len) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    this.hiss(t, 0.9, 0.16, 2600, 0.5); // leaves
    this.hiss(t + 0.25, 1.1, 0.1, 1400, 0.5);
    [0, 4, 7, 12].forEach((s, i) => this.tone(392 * 2 ** (s / 12), t + 0.05 + i * 0.09, 1.6, 0.07));
    this.tone(196, t + 0.05, 1.8, 0.05);
  }

  fail() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(80, t + 0.25);
    g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.32);
    this.tone(311, t, 0.3, 0.04, 'triangle');
    this.tone(294, t + 0.12, 0.35, 0.04, 'triangle');
  }

  water() { // the fountain lifts a hedge
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    this.hiss(t, 1.4, 0.12, 900, 0.4, 'lowpass');
    for (let i = 0; i < 6; i++) {
      const tt = t + 0.1 + i * 0.13 + Math.random() * 0.05;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      const f = 500 + Math.random() * 500;
      o.frequency.setValueAtTime(f, tt); o.frequency.exponentialRampToValueAtTime(f * 1.9, tt + 0.06);
      g.gain.setValueAtTime(0.05, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + 0.08);
      o.connect(g).connect(this.master); o.start(tt); o.stop(tt + 0.1);
    }
  }

  gate() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    [0, 4, 7, 11, 14, 19].forEach((s, i) => this.tone(523.25 * 2 ** (s / 12), t + i * 0.12, 1.8, 0.06));
    this.hiss(t, 0.5, 0.05, 600, 2); // the iron creak
  }

  begin() { if (!this.ready()) return; this.tone(659, this.ctx.currentTime, 0.2, 0.05, 'triangle'); }
}
