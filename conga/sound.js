// A little synthesised conga band, locked to the game's beat. More instruments join as the line
// grows: drums and shaker, then clave, bass, piano montuno and cowbell. Plus the sound effects.
const CHORDS = [[48, 52, 55], [53, 57, 60], [55, 59, 62], [53, 57, 60]]; // C F G F, a bar each, two bars per chord
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Sound {
  constructor() { this.on = true; this.ctx = null; this.next8 = -1; this.layers = 1; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.7 : 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    this.music = c.createGain(); this.music.gain.value = 0.55; this.music.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    const len = c.sampleRate, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
  }

  setOn(v) { this.on = v; if (this.master) this.master.gain.value = v ? 0.7 : 0; }
  reset() { this.next8 = -1; }

  tone(type, f0, f1, dur, vol, t, out = this.sfx, attack = 0.005) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.03);
  }
  hiss(freq, q, dur, vol, t, out = this.sfx, type = 'bandpass') {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }

  // called every frame with the game's beat clock; schedules the next eighth notes just ahead
  update(beat, bpm, layers, playing) {
    if (!this.ctx || !this.on || !playing) { this.next8 = -1; return; }
    this.layers = layers;
    const now = this.ctx.currentTime, spb = 60 / bpm;
    const cur8 = beat * 2;
    if (this.next8 < 0 || this.next8 < Math.floor(cur8) - 1 || this.next8 > cur8 + 4) this.next8 = Math.ceil(cur8);
    while (this.next8 < cur8 + 0.5) {
      const t = now + (this.next8 / 2 - beat) * spb;
      if (t >= now - 0.01) this.eighth(this.next8, Math.max(now, t), spb);
      this.next8++;
    }
  }

  eighth(e, t, spb) {
    const M = this.music, L = this.layers;
    const pos = ((e % 8) + 8) % 8, bar = Math.floor(e / 8), two = ((e % 16) + 16) % 16;
    const chord = CHORDS[Math.floor(((bar % 8) + 8) % 8 / 2)];
    // congas: tumbao — heel/toe, slap on 2, open tones on 4 and 4-and
    if (pos === 2) { this.tone('sine', 420, 300, 0.09, 0.32, t, M); this.hiss(3200, 1.5, 0.04, 0.3, t, M); }
    else if (pos === 6 || pos === 7) { this.tone('sine', pos === 6 ? 210 : 175, pos === 6 ? 190 : 160, 0.28, 0.5, t, M); }
    else if (pos === 0 || pos === 4) this.tone('sine', 150, 120, 0.12, 0.18, t, M);
    else this.hiss(1800, 2, 0.03, 0.06, t, M);
    // shaker on every eighth, leaning on the off-beats
    this.hiss(7000, 0.8, 0.05, pos % 2 ? 0.07 : 0.035, t, M, 'highpass');
    // a little "hey" kick on four
    if (pos === 6 && L >= 2) this.hiss(1100, 3, 0.09, 0.08, t, M);
    if (L >= 2 && [0, 3, 6, 10, 12].includes(two)) this.tone('triangle', 2350, 2300, 0.05, 0.18, t, M);
    if (L >= 3) {
      if (pos === 3) this.tone('triangle', mtof(chord[0] - 12), mtof(chord[0] - 12), spb * 0.9, 0.42, t, M, 0.01);
      if (pos === 6) this.tone('triangle', mtof(chord[2] - 24), mtof(chord[2] - 24), spb * 0.9, 0.4, t, M, 0.01);
    }
    if (L >= 4) {
      const pat = [0, 2, 1, 2, 0, 2, 1, 2];
      const n = chord[pat[pos]] + 12 + (pos === 1 || pos === 5 ? 12 : 0);
      if (pos !== 0) { this.tone('triangle', mtof(n), mtof(n), 0.22, 0.09, t, M); this.tone('sine', mtof(n + 12), mtof(n + 12), 0.12, 0.04, t, M); }
    }
    if (L >= 5 && pos % 2 === 0) { this.tone('square', 810, 800, 0.06, pos === 0 ? 0.06 : 0.035, t, M); this.tone('square', 540, 535, 0.06, 0.03, t, M); }
  }

  play(kind, n = 1) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    switch (kind) {
      case 'join': this.tone('triangle', 660, 660, 0.1, 0.25, t); this.tone('triangle', 990, 990, 0.14, 0.22, t + 0.07); break;
      case 'coin': this.tone('sine', 1320, 1320, 0.07, 0.18, t); this.tone('sine', 1760, 1760, 0.16, 0.16, t + 0.06); break;
      case 'clash': this.tone('sine', 180, 70, 0.14, 0.45, t); this.hiss(900, 0.9, 0.08, 0.35, t); break;
      case 'ko': this.hiss(2500, 0.6, 0.12, 0.4, t); this.tone('square', 700, 140, 0.25, 0.08, t); break;
      case 'scatter': for (let i = 0; i < 4; i++) this.tone('triangle', 520 * Math.pow(1.26, i), 520 * Math.pow(1.26, i), 0.12, 0.2, t + i * 0.06); this.hiss(5000, 0.5, 0.4, 0.15, t); break;
      case 'trip': this.tone('sine', 1100, 260, 0.5, 0.22, t, this.sfx, 0.02); break;
      case 'hurt': this.tone('sawtooth', 220, 110, 0.18, 0.12, t); break;
      case 'spit': this.hiss(1500, 2, 0.08, 0.2, t); break;
      case 'buy': this.tone('triangle', 880, 880, 0.06, 0.2, t); this.tone('triangle', 1320, 1320, 0.12, 0.2, t + 0.05); this.hiss(6000, 1, 0.1, 0.1, t + 0.05); break;
      case 'tap': this.tone('triangle', 1400, 1200, 0.04, 0.12, t); break;
      case 'no': this.tone('square', 180, 160, 0.12, 0.08, t); break;
      case 'win': [0, 4, 7, 12, 16].forEach((s, i) => this.tone('triangle', mtof(72 + s), mtof(72 + s), 0.25, 0.22, t + i * 0.09)); break;
      case 'lose': [0, -1, -2, -5].forEach((s, i) => this.tone('sawtooth', mtof(58 + s), mtof(57 + s), 0.32, 0.08, t + i * 0.22, this.sfx, 0.02)); break;
    }
  }
}
