// Little synthesized sounds and a bouncy loop. Nothing loaded from files.
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.musicOn = true; this.master = null; this.music = null; this.nextBar = 0; this.bar = 0; this.last = {}; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.on ? 0.55 : 0; this.master.connect(this.ctx.destination);
    this.music = this.ctx.createGain(); this.music.gain.value = 0.22; this.music.connect(this.master);
    this.sfx = this.ctx.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);
    const len = this.ctx.sampleRate * 0.5; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  setOn(on) { this.on = on; if (this.master) this.master.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.02); }

  tone(type, f0, f1, dur, vol, at = 0, out = this.sfx) {
    const c = this.ctx, t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, f0, f1, at = 0, q = 1, out = this.sfx, type = 'bandpass') {
    const c = this.ctx, t = c.currentTime + at, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.02);
  }
  play(k, opt = {}) {
    if (!this.ctx || !this.on) return;
    const now = this.ctx.currentTime;
    if (this.last[k] && now - this.last[k] < 0.04) return;
    this.last[k] = now;
    const r = 1 + (Math.random() - 0.5) * 0.12;
    switch (k) {
      case 'swing': this.noise(0.12, 0.35, 900 * r, 3200 * r, 0, 1.2); break;
      case 'hit': this.tone('square', 220 * r, 90, 0.08, 0.22); this.noise(0.06, 0.4, 2000, 600, 0, 0.8); break;
      case 'kill': this.tone('square', 330 * r, 120, 0.12, 0.25); this.tone('triangle', 660 * r, 990 * r, 0.12, 0.18, 0.05); this.noise(0.15, 0.35, 1400, 300, 0, 0.7); break;
      case 'hurt': this.tone('sawtooth', 180, 60, 0.28, 0.3); this.noise(0.2, 0.3, 600, 200, 0, 1); break;
      case 'block': this.tone('triangle', 880, 1320, 0.15, 0.25); break;
      case 'dash': this.noise(0.16, 0.25, 500, 2200, 0, 0.8); break;
      case 'summon': this.tone('triangle', 300, 600, 0.3, 0.12); this.tone('triangle', 450, 900, 0.3, 0.08, 0.05); break;
      case 'appear': this.noise(0.12, 0.3, 3000, 800, 0, 1); this.tone('square', 520, 260, 0.08, 0.1); break;
      case 'chat': this.tone('sine', 1250 * r, 1250 * r, 0.05, 0.08); break;
      case 'bounce': this.tone('sine', 300, 250, 0.06, 0.05); break;
      case 'vote': this.tone('triangle', 784, 784, 0.07, 0.12); this.tone('triangle', 1046, 1046, 0.1, 0.12, 0.07); break;
      case 'voted': [523, 659, 784, 1046].forEach((f, i) => this.tone('square', f, f, 0.1, 0.1, i * 0.06)); break;
      case 'unlock': this.tone('square', 392, 392, 0.06, 0.12); this.tone('square', 587, 587, 0.12, 0.12, 0.07); break;
      case 'trap': this.tone('square', 1400, 1400, 0.04, 0.08); this.tone('square', 1400, 1400, 0.04, 0.08, 0.12); break;
      case 'spike': this.noise(0.1, 0.5, 4000, 1500, 0, 2, this.sfx, 'highpass'); this.tone('square', 160, 80, 0.08, 0.15); break;
      case 'curse': this.tone('sawtooth', 500, 120, 0.5, 0.14); this.tone('sawtooth', 507, 125, 0.5, 0.12); break;
      case 'bless': [660, 880, 1175, 1568].forEach((f, i) => this.tone('sine', f, f, 0.18, 0.12, i * 0.05)); break;
      case 'relic': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone('square', f, f, 0.14, 0.09, i * 0.07)); break;
      case 'heart': this.tone('sine', 660, 990, 0.15, 0.18); break;
      case 'chest': this.noise(0.2, 0.3, 500, 1500, 0, 1); this.tone('triangle', 400, 800, 0.2, 0.15); break;
      case 'slam': this.tone('sine', 120, 35, 0.5, 0.6); this.noise(0.4, 0.5, 800, 80, 0, 0.7, this.sfx, 'lowpass'); break;
      case 'thud': this.tone('sine', 90, 40, 0.35, 0.5); this.noise(0.25, 0.4, 500, 100, 0, 0.7, this.sfx, 'lowpass'); break;
      case 'roar': this.tone('sawtooth', 110, 70, 0.9, 0.25); this.tone('sawtooth', 116, 66, 0.9, 0.2); this.noise(0.8, 0.25, 400, 200, 0, 0.6); break;
      case 'shoot': this.tone('triangle', 900, 300, 0.1, 0.12); break;
      case 'wind': this.tone('square', 200, 260, 0.14, 0.06); break;
      case 'die': [392, 330, 262, 196].forEach((f, i) => this.tone('square', f, f * 0.97, 0.2, 0.14, i * 0.16)); break;
      case 'win': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone('square', f, f, 0.16, 0.12, i * 0.1)); break;
      case 'click': this.tone('square', 660, 660, 0.03, 0.08); break;
    }
  }

  // a 4-bar bouncy loop: kick, snare, hat, a bass line and a little lead; called every frame
  tickMusic(intensity = 0) {
    if (!this.ctx || !this.on || !this.musicOn) return;
    const c = this.ctx, spb = 60 / 132 / 2; // eighth notes
    if (this.nextBar < c.currentTime) this.nextBar = c.currentTime + 0.05;
    while (this.nextBar < c.currentTime + 0.3) {
      const at = this.nextBar - c.currentTime, step = this.bar % 32, bar = (this.bar / 8 | 0) % 4;
      const roots = [110, 87.3, 130.8, 98];
      if (step % 4 === 0) this.tone('sine', 140, 45, 0.18, 0.7, at, this.music);
      if (step % 8 === 4) this.noise(0.12, 0.5, 2500, 1200, at, 0.6, this.music);
      if (step % 2 === 1) this.noise(0.03, 0.18, 8000, 7000, at, 1, this.music, 'highpass');
      const bn = [0, 0, 12, 0, 7, 0, 12, 10][step % 8];
      this.tone('square', roots[bar] * Math.pow(2, bn / 12) / 2, roots[bar] * Math.pow(2, bn / 12) / 2, spb * 0.8, 0.14, at, this.music);
      if (intensity > 0) {
        const lead = [0, null, 3, null, 7, 5, null, 3][step % 8];
        if (lead != null && (step >> 3) % 2 === 1) { const f = roots[bar] * 4 * Math.pow(2, lead / 12); this.tone('triangle', f, f, spb * 0.9, 0.06 * intensity, at, this.music); }
      }
      this.nextBar += spb; this.bar++;
    }
  }
}
