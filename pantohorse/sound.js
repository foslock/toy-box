// Coconut-shell hooves, a crowd, a tannoy and the Bramble Silver Band, all synthesised in WebAudio.
export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.bandOn = false; }

  init(ctx) {
    if (this.ctx) return;
    try { this.ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const c = this.ctx;
    this.out = c.createGain(); this.out.gain.value = this.muted ? 0 : 0.8; this.out.connect(c.destination);
    const n = c.sampleRate * 2;
    this.noise = c.createBuffer(1, n, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // the crowd: brown-ish noise through a few vowel filters, always murmuring
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 520; lp.Q.value = 0.7;
    this.crowdG = c.createGain(); this.crowdG.gain.value = 0.05;
    src.connect(lp); lp.connect(this.crowdG); this.crowdG.connect(this.out); src.start();
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setMuted(m) { this.muted = m; if (this.out) this.out.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05); }

  env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  burst(freq, q, peak, dec, type = 'bandpass', when = 0, rate = 1) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = rate;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); this.env(g, t, 0.003, peak, dec);
    s.connect(f); f.connect(g); g.connect(this.out);
    s.start(t, Math.random() * 1.5); s.stop(t + dec + 0.05);
    return f;
  }
  tone(freq, type, peak, dec, when = 0, glide = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * glide), t + dec);
    const g = c.createGain(); this.env(g, t, 0.006, peak, dec);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dec + 0.05);
  }

  // two halves of a coconut on the boards
  clop(half, water) {
    if (!this.ctx) return;
    if (water) { this.burst(900, 0.6, 0.18, 0.16, 'lowpass', 0, 0.6); return; }
    const base = half === 'front' ? 1500 : 1150;
    const f = base * (0.92 + Math.random() * 0.16);
    this.burst(f, 9, 1.5, 0.05);
    this.tone(f * 0.5, 'triangle', 0.12, 0.04);
  }
  hop() { this.tone(220, 'square', 0.04, 0.18, 0, 2.2); this.burst(2500, 1, 0.05, 0.12, 'highpass'); }
  thump(hard) { this.tone(90, 'sine', 0.3 + hard * 0.2, 0.18, 0, 0.5); this.burst(400, 1, 0.2, 0.1, 'lowpass'); }
  trip() { this.burst(700, 2, 1.2, 0.09); this.oof(); }
  oof() {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.22);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 4;
    const g = c.createGain(); this.env(g, t, 0.01, 0.3, 0.22);
    o.connect(f); f.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.3);
  }
  rip() {
    const c = this.ctx; if (!c) return;
    for (let k = 0; k < 9; k++) this.burst(1800 + Math.random() * 2500, 3, 0.22, 0.035, 'bandpass', k * 0.03 + Math.random() * 0.01, 1.4);
    this.burst(1200, 0.8, 0.25, 0.4, 'highpass', 0.02);
  }
  splash() { this.burst(1200, 0.5, 0.3, 0.4, 'lowpass', 0, 0.7); this.burst(3000, 1, 0.12, 0.25, 'highpass', 0.05); }
  bump() { this.tone(140, 'sine', 0.25, 0.12, 0, 0.7); this.burst(300, 2, 0.15, 0.08); }
  parp() { this.tone(98, 'sawtooth', 0.22, 0.35, 0, 0.9); this.tone(73, 'square', 0.12, 0.35, 0.05, 1.2); }
  bell() { for (const [f, a] of [[1320, 0.14], [2640, 0.05], [3960, 0.03]]) this.tone(f, 'sine', a, 1.4); }
  pistol() { this.burst(2000, 0.3, 0.45, 0.25, 'highpass'); this.tone(60, 'sine', 0.3, 0.2); }
  flag() { this.tone(660, 'triangle', 0.08, 0.15); this.tone(880, 'triangle', 0.08, 0.2, 0.08); }
  hupCall(loud) { this.tone(loud ? 520 : 380, 'triangle', loud ? 0.12 : 0.06, loud ? 0.14 : 0.1, 0, loud ? 1.3 : 0.9); }

  crowd(kind) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    if (kind === 'ooh') {
      // a few hundred people going "ooooh" at once: noise swept through a vowel
      const f = this.burst(700, 3, 1.3, 1.6, 'bandpass', 0, 0.8);
      if (f) { f.frequency.setValueAtTime(800, t); f.frequency.exponentialRampToValueAtTime(380, t + 1.4); }
      this.burst(1100, 5, 0.45, 1.2, 'bandpass', 0.05, 0.9);
    } else if (kind === 'cheer') {
      for (let k = 0; k < 40; k++) this.burst(1500 + Math.random() * 3000, 4, 0.25 + Math.random() * 0.2, 0.03, 'bandpass', Math.random() * 2.2, 1.3);
      this.burst(900, 1.5, 0.6, 2.4, 'bandpass');
    } else if (kind === 'laugh') {
      for (let k = 0; k < 7; k++) this.burst(650 + Math.random() * 200, 6, 1.2, 0.09, 'bandpass', k * 0.13, 0.9);
    }
    this.crowdG.gain.setTargetAtTime(kind === 'cheer' ? 0.16 : 0.09, t, 0.05);
    this.crowdG.gain.setTargetAtTime(0.05, t + 1.2, 0.8);
  }

  // the band: an oom-pah tune on tuba and cornet, scheduled a beat ahead
  band(on) {
    if (!this.ctx) return;
    if (on && !this.bandOn) { this.bandOn = true; this.beat = 0; this.nextBeat = this.ctx.currentTime + 0.1; this.bandTick(); }
    if (!on) { this.bandOn = false; clearTimeout(this.bandTimer); }
  }
  bandTick() {
    if (!this.bandOn || !this.ctx) return;
    const c = this.ctx, spb = 60 / 112 / 2;
    const bass = [98, 147, 110, 147, 131, 196, 98, 147];
    const tune = [392, 0, 440, 494, 523, 0, 494, 440, 392, 0, 330, 0, 349, 392, 440, 0, 392, 0, 440, 494, 523, 587, 659, 0, 587, 523, 494, 440, 392, 0, 0, 0];
    while (this.nextBeat < c.currentTime + 0.25) {
      const b = this.beat, when = this.nextBeat - c.currentTime;
      if (b % 2 === 0) this.tone(bass[(b / 2) % bass.length], 'triangle', 0.16, spb * 1.5, when);
      else { this.burst(5000, 1, 0.04, 0.05, 'highpass', when); this.tone(bass[((b - 1) / 2) % bass.length] * 2, 'square', 0.025, spb * 0.8, when); }
      const n = tune[b % tune.length];
      if (n) { this.tone(n, 'square', 0.035, spb * 1.6, when); this.tone(n * 1.005, 'sawtooth', 0.02, spb * 1.6, when); }
      if (b % 8 === 0) this.burst(120, 1, 0.25, 0.15, 'lowpass', when, 0.5);
      this.beat++; this.nextBeat += spb;
    }
    this.bandTimer = setTimeout(() => this.bandTick(), 80);
  }
}
