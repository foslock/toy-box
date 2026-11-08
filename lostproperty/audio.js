// Small synthesized sounds: key clicks, the CRT hum, the relay that prints results, paper.
export class Sound {
  constructor() { this.on = true; this.ctx = null; this.hum = null; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const c = this.ctx;
    this.out = c.createGain(); this.out.gain.value = this.on ? 1 : 0; this.out.connect(c.destination);
    const n = c.sampleRate, buf = c.createBuffer(1, n, n), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // hum: a low mains buzz and a faint flyback whine
    const g = c.createGain(); g.gain.value = .018; g.connect(this.out);
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 50;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    o.connect(lp).connect(g); o.start();
    const w = c.createOscillator(); w.frequency.value = 7800; const wg = c.createGain(); wg.gain.value = .0016;
    w.connect(wg).connect(this.out); w.start();
    this.hum = g;
  }
  set(on) { this.on = on; if (this.out) this.out.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, .05); }
  burst(t, dur, freq, q, vol, type = 'bandpass') {
    const c = this.ctx; if (!c) return;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = .7 + Math.random() * .6;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f).connect(g).connect(this.out); s.start(t, Math.random() * .5, dur + .02);
  }
  tone(t, freq, dur, vol, type = 'square') {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + .02);
  }
  key() { if (!this.ctx) return; const t = this.ctx.currentTime; this.burst(t, .035, 2400 + Math.random() * 900, 1.4, .22); this.burst(t + .012, .05, 420, 2, .12); }
  enter() { if (!this.ctx) return; const t = this.ctx.currentTime; this.burst(t, .07, 300, 1.2, .4); this.burst(t + .02, .05, 1800, 2, .15); }
  print(lines) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    for (let i = 0; i < lines; i++) this.burst(t + .05 + i * .042, .02, 3200, 3, .07);
    this.tone(t + .05 + lines * .042, 1180, .07, .025);
  }
  open() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(t, 880, .05, .02); this.tone(t + .05, 1320, .06, .018); }
  none() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(t, 220, .16, .03); }
  paper() { if (!this.ctx) return; const t = this.ctx.currentTime; this.burst(t, .16, 5200, .6, .1, 'highpass'); this.burst(t + .06, .1, 2600, .8, .06); }
  bell() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(t + i * .5, f, 2.4, .035, 'sine'));
  }
}
