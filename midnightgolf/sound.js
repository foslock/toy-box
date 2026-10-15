// Small WebAudio sounds, all synthesised: putts, knocks, creaks, a ticking clock.
export class Sound {
  constructor() { this.on = true; this.ctx = null; this.rollG = null; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.8 : 0; this.master.connect(c.destination);
    const len = c.sampleRate * 1.5, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    // a looping hush for the rolling ball
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.8;
    this.rollG = c.createGain(); this.rollG.gain.value = 0;
    src.connect(f); f.connect(this.rollG); this.rollG.connect(this.master); src.start();
    this.rollF = f;
    this.nextTick = c.currentTime + 0.5;
  }

  setOn(v) { this.on = v; if (this.master) this.master.gain.value = v ? 0.8 : 0; }

  tone(type, f0, f1, dur, vol, at = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  burst(freq, q, dur, vol, at = 0, type = 'bandpass') {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }

  play(kind, L) {
    if (!this.ctx || !this.on) return;
    const v = Math.min(1, 0.12 + L / 45);
    switch (kind) {
      case 'putt': this.tone('sine', 520, 300, 0.08, 0.25 * v); this.burst(2600, 2, 0.04, 0.3 * v); break;
      case 'hard': this.tone('triangle', 240, 170, 0.12, 0.35 * v); this.burst(1400, 3, 0.05, 0.25 * v); break;
      case 'metal': this.tone('triangle', 1250, 1180, 0.4, 0.18 * v); this.tone('sine', 1890, 1850, 0.3, 0.08 * v); this.burst(3000, 4, 0.04, 0.2 * v); break;
      case 'soft': this.burst(260, 1, 0.08, 0.2 * v, 0, 'lowpass'); break;
      case 'creak': {
        const c = this.ctx, t = c.currentTime, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(150, t); o.frequency.linearRampToValueAtTime(95, t + 0.55);
        f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 6;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        o.connect(f); f.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.65);
        break;
      }
      case 'lego': for (let i = 0; i < 4; i++) this.burst(3500 + Math.random() * 2000, 5, 0.025, 0.25, i * 0.018); break;
      case 'squeak': this.tone('sine', 900, 1500, 0.18, 0.2); this.tone('sine', 1500, 1100, 0.12, 0.15, 0.17); break;
      case 'flap': this.tone('square', 300, 200, 0.05, 0.08); this.tone('square', 260, 180, 0.05, 0.06, 0.12); break;
      case 'stairs': for (let i = 0; i < 6; i++) { this.tone('sine', 110 - i * 6, 70, 0.14, 0.4 - i * 0.04, i * 0.17); this.burst(400, 1, 0.08, 0.2, i * 0.17); } break;
      case 'cat': this.tone('sine', 520, 760, 0.12, 0.08); this.tone('sine', 760, 600, 0.14, 0.08, 0.11); break;
      case 'train': this.tone('square', 180, 160, 0.05, 0.08); break;
      case 'sink': {
        this.tone('sine', 1320, 1320, 0.35, 0.18); this.tone('sine', 1980, 1980, 0.3, 0.08, 0.02);
        break;
      }
      default: break;
    }
  }

  roll(speed, loud) {
    if (!this.rollG) return;
    const g = Math.min(0.25, speed * loud * 0.012 + speed * 0.00008);
    this.rollG.gain.setTargetAtTime(this.on ? g : 0, this.ctx.currentTime, 0.04);
    this.rollF.frequency.setTargetAtTime(500 + speed * 2, this.ctx.currentTime, 0.05);
  }

  // the house at night: a slow clock, and the occasional snore
  ambient(snoring) {
    const c = this.ctx; if (!c || !this.on) return;
    while (this.nextTick < c.currentTime + 0.1) {
      const t = this.nextTick - c.currentTime;
      this.tone('sine', 2400, 2200, 0.03, 0.025, Math.max(0, t));
      if (snoring && Math.random() < 0.18) this.burst(180, 0.7, 1.1, 0.05, Math.max(0, t) + 0.3, 'lowpass');
      this.nextTick += 1;
    }
  }

  wake() {
    if (!this.ctx || !this.on) return;
    this.tone('square', 1800, 1700, 0.02, 0.12);        // the light switch
    this.tone('triangle', 330, 220, 0.5, 0.12, 0.12);
  }
  chime(n = 3) {
    if (!this.ctx || !this.on) return;
    const notes = [784, 988, 1175, 1568];
    for (let i = 0; i < n; i++) this.tone('sine', notes[i], notes[i], 0.9, 0.12, i * 0.13);
  }
}
