// Everything is synthesized: a cracked bronze bell, wind over the stones, steel, and a heartbeat that
// quickens as the host's eye fills.
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.beatT = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.8 : 0; this.master.connect(c.destination);
    // a short noise buffer reused by everything breathy
    const n = c.sampleRate * 2, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // wind
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 0.7;
    const g = c.createGain(); g.gain.value = 0.05;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 220;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  }
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? 0.8 : 0, this.ctx.currentTime, 0.05); }
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  tone(freq, type, peak, dec, t0 = 0, a = 0.005) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + t0, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq; this.env(g, t, a, peak, dec);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + a + dec + 0.05);
    return o;
  }
  hiss(freq, q, peak, dec, t0 = 0, type = 'bandpass', sweep) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + t0, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dec);
    this.env(g, t, 0.004, peak, dec);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dec + 0.1);
  }
  toll() {
    // inharmonic partials of a big bell, the hum and the strike
    const base = 98;
    [[0.5, 0.16, 6], [1, 0.22, 5], [1.19, 0.12, 4], [1.5, 0.1, 3.5], [2, 0.09, 3], [2.51, 0.06, 2.2], [3.01, 0.04, 1.6], [4.17, 0.03, 1]].forEach(([m, p, d]) => this.tone(base * m, 'sine', p, d, 0, 0.004));
    this.hiss(1800, 2, 0.08, 0.15);
  }
  warn() { [0, 0.18].forEach(t => this.tone(1180, 'sine', 0.05, 0.6, t)); }
  windup() { this.hiss(900, 3, 0.05, 0.4, 0, 'bandpass', 2400); }
  slash() { this.hiss(2600, 1.2, 0.25, 0.18, 0, 'bandpass', 700); }
  kill() { this.tone(70, 'sine', 0.3, 0.3); this.hiss(400, 1, 0.12, 0.25, 0.02, 'lowpass'); }
  stab() {
    this.hiss(3000, 0.8, 0.3, 0.12); this.tone(55, 'sine', 0.5, 0.6, 0.03);
    this.tone(196, 'triangle', 0.08, 2.5, 0.5, 0.3); this.tone(294, 'triangle', 0.06, 2.5, 0.5, 0.3); this.tone(392, 'triangle', 0.05, 2.5, 0.5, 0.3);
  }
  found() { [[110, 0], [116.5, 0], [55, 0.02]].forEach(([f, t]) => { const o = this.tone(f, 'sawtooth', 0.09, 1.4, t, 0.02); }); this.hiss(500, 0.7, 0.15, 0.6, 0, 'lowpass'); }
  roll() { this.hiss(600, 0.8, 0.1, 0.18, 0, 'lowpass'); }
  parry() { this.tone(1450, 'square', 0.06, 0.12); this.tone(2300, 'sine', 0.06, 0.4); }
  hit() { this.hiss(1800, 1, 0.22, 0.1); this.tone(90, 'sine', 0.3, 0.2); }
  cut() { this.hiss(2000, 1, 0.3, 0.2); this.tone(48, 'sine', 0.4, 1.4); }
  tell() { this.hiss(300, 2, 0.06, 0.3, 0, 'bandpass', 180); }
  // heartbeat, called every frame with the host's suspicion
  heart(dt, sus) {
    if (!this.ctx || sus < 30) { this.beatT = 0; return; }
    this.beatT -= dt;
    if (this.beatT <= 0) {
      const k = (sus - 30) / 70;
      this.beatT = 1.1 - k * 0.65;
      this.tone(52, 'sine', 0.12 + k * 0.2, 0.16); this.tone(48, 'sine', 0.09 + k * 0.15, 0.16, 0.16);
    }
  }
}
