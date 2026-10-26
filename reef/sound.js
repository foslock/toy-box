// Reef: soft underwater sounds, all synthesized. A low hum of moving water,
// muffled plops for planting, a glassy chime for points and a little rising
// phrase when something moves in.

export class Sound {
  constructor() { this.ctx = null; this.on = true; this.master = null; }

  init(ctx) {
    if (this.ctx) return;
    try { this.ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.8 : 0;
    this.master.connect(c.destination);
    // the sea: brown noise through a low-pass that breathes
    const len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 340;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 140;
    lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    const g = c.createGain(); g.gain.value = 0.16;
    src.connect(lp); lp.connect(g); g.connect(this.master); src.start();
    this.noise = buf;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setOn(on) {
    this.on = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }

  tone(freq, t0, dur, vol, type = 'sine', glide = 0) {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  plop(heavy = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    this.tone(180 - heavy * 60, t, 0.22, 0.32, 'sine', 0.45);
    // a puff of sand
    const s = c.createBufferSource(); s.buffer = this.noise;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.8;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    s.connect(bp); bp.connect(g); g.connect(this.master); s.start(t, Math.random() * 3, 0.4);
    // and a few bubbles
    for (let i = 0; i < 3; i++) this.tone(500 + Math.random() * 500, t + 0.06 + i * 0.07 + Math.random() * 0.04, 0.07, 0.05, 'sine', 1.8);
  }

  points(n) {
    const c = this.ctx; if (!c || n === 0) return;
    const t = c.currentTime + 0.05;
    if (n < 0) { this.tone(220, t, 0.4, 0.12, 'triangle', 0.8); return; }
    const scale = [523, 587, 659, 784, 880, 1047, 1175, 1319];
    const k = Math.min(scale.length, Math.max(1, Math.ceil(n / 2)));
    for (let i = 0; i < k; i++) this.tone(scale[i], t + i * 0.055, 0.5, 0.07, 'sine');
  }

  arrive() {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + 0.2;
    [392, 494, 587, 784, 988].forEach((f, i) => { this.tone(f, t + i * 0.11, 1.4, 0.07, 'triangle'); this.tone(f * 2, t + i * 0.11, 0.8, 0.02, 'sine'); });
  }

  pack() {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + 0.05;
    [523, 659, 784].forEach(f => this.tone(f, t, 1.6, 0.06, 'triangle'));
  }

  warn() {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    this.tone(110, t, 1.6, 0.14, 'sawtooth', 0.97);
    this.tone(116, t, 1.6, 0.08, 'sine', 1.0);
  }

  bleach() {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    [330, 311, 262, 196].forEach((f, i) => this.tone(f, t + i * 0.18, 0.9, 0.08, 'triangle', 0.98));
  }

  tick() { const c = this.ctx; if (c) this.tone(1400, c.currentTime, 0.04, 0.03, 'sine'); }
}
