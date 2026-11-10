// Small WebAudio kit: swishes, clanks, thuds, a choir for the dead.
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.noiseBuf = null; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = .55; this.master.connect(this.ctx.destination);
    const n = this.ctx.sampleRate * 1.5, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = b;
  }
  get t() { return this.ctx.currentTime; }
  ok() { return this.ctx && this.on; }
  noise(dur, f0, f1, q, vol, type = 'bandpass', at = 0) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = this.t + at;
    s.buffer = this.noiseBuf; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * .2); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + .05);
  }
  tone(freq, dur, vol, type = 'sine', at = 0, slide = 0) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t = this.t + at;
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .05);
  }
  swing(heavy) { if (!this.ok()) return; this.noise(heavy ? .32 : .18, heavy ? 500 : 900, heavy ? 2400 : 3800, 1.2, heavy ? .35 : .22); }
  clank(heavy) { // on the knight: glass and steel
    if (!this.ok()) return;
    const base = heavy ? 620 : 880;
    for (const [m, v] of [[1, .16], [2.76, .09], [5.4, .05], [8.9, .03]]) this.tone(base * m * (1 + Math.random() * .01), heavy ? .7 : .45, v, 'sine');
    this.noise(.06, 4000, 2000, .8, .3, 'highpass');
  }
  thud() { // on you
    if (!this.ok()) return;
    this.tone(110, .25, .5, 'sine', 0, .5); this.noise(.12, 600, 200, 1, .4, 'lowpass');
  }
  roll() { if (!this.ok()) return; this.noise(.3, 300, 120, .7, .2, 'lowpass'); }
  evade() { if (!this.ok()) return; this.tone(1400, .15, .05, 'triangle', 0, 1.5); }
  glint(big) { if (!this.ok()) return; this.tone(big ? 2200 : 3000, .25, big ? .09 : .04, 'sine'); this.tone(big ? 3300 : 4500, .18, big ? .05 : .02, 'sine', .02); }
  drink() { if (!this.ok()) return; for (let i = 0; i < 3; i++) this.tone(300 + Math.random() * 120, .08, .12, 'sine', i * .16, 1.6); }
  heal() { if (!this.ok()) return; this.tone(523, .5, .08, 'triangle'); this.tone(784, .6, .06, 'triangle', .08); }
  shot(kind) { if (!this.ok()) return; if (kind === 'seal') { this.tone(700, .3, .08, 'sine', 0, 2); } else this.noise(.12, 2400, 900, 3, .2); }
  zone() { if (!this.ok()) return; this.tone(80, .6, .45, 'sine', 0, .5); this.noise(.4, 900, 100, .6, .35, 'lowpass'); }
  phase() {
    if (!this.ok()) return;
    this.noise(1.2, 3000, 200, .6, .3, 'bandpass');
    for (const f of [55, 82.4, 110]) this.tone(f, 1.8, .18, 'sawtooth', 0, .98);
  }
  break_() { if (!this.ok()) return; this.clank(true); this.tone(200, .4, .2, 'square', 0, .5); }
  died() {
    if (!this.ok()) return;
    const c = this.ctx, t = this.t, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = 900; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.22, t + .6); g.gain.exponentialRampToValueAtTime(.001, t + 4.5);
    f.connect(g); g.connect(this.master);
    for (const fr of [110, 130.8, 164.8, 220]) for (const det of [-6, 6]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det; o.connect(f); o.start(t); o.stop(t + 4.6);
    }
    this.tone(55, 3, .4, 'sine', 0, .8);
  }
  won() {
    if (!this.ok()) return;
    this.noise(2, 6000, 1500, .5, .3, 'highpass');
    [523, 659, 784, 1047].forEach((f, i) => { this.tone(f, 2.4, .08, 'triangle', .3 + i * .18); this.tone(f * 2.01, 1.6, .03, 'sine', .3 + i * .18); });
  }
  tick() { if (!this.ok()) return; this.tone(1200, .05, .05, 'square'); }
  empty() { if (!this.ok()) return; this.tone(160, .12, .12, 'square', 0, .8); }
}
