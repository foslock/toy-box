// Small WebAudio sounds: water rushing in, a splash, fire, wooden gates, a spade, rain, ice, and a pipe tune.
export class Sound {
  constructor() { this.ctx = null; this.on = true; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.out = ctx.createGain(); this.out.gain.value = this.on ? .8 : 0; this.out.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // a faint river under everything
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
    const g = ctx.createGain(); g.gain.value = .035;
    src.connect(f); f.connect(g); g.connect(this.out); src.start();
  }
  setOn(v) { this.on = v; if (this.out) this.out.gain.setTargetAtTime(v ? .8 : 0, this.ctx.currentTime, .05); }

  tone(freq, t0, dur, vol, type = 'sine', bend = 1) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0); if (bend !== 1) o.frequency.exponentialRampToValueAtTime(freq * bend, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g); g.connect(this.out); o.start(t0); o.stop(t0 + dur + .05);
  }
  hiss(t0, dur, vol, from, to, type = 'bandpass', q = 1, attack = .02) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t0, Math.random()); s.stop(t0 + dur + .05);
  }
  get t() { return this.ctx.currentTime; }

  flood(n) { if (!this.ctx || !n) return; const t = this.t, dur = Math.min(2.2, .5 + n * .07); this.hiss(t, dur, Math.min(.32, .1 + n * .015), 300, 1400, 'lowpass', .5, dur * .3); this.hiss(t + .05, dur * .8, .08, 2500, 900, 'bandpass', .8, .1); }
  drain() { if (!this.ctx) return; const t = this.t; this.hiss(t, .8, .1, 900, 200, 'lowpass', .7, .05); }
  splash() { if (!this.ctx) return; const t = this.t; this.hiss(t, .45, .22, 3000, 500, 'bandpass', .6, .005); this.tone(110, t, .25, .15, 'sine', .5); }
  burn() {
    if (!this.ctx) return; const t = this.t;
    this.hiss(t, 1.2, .16, 700, 300, 'lowpass', .5, .1);
    for (let k = 0; k < 9; k++) this.hiss(t + k * .09 + Math.random() * .05, .05, .2, 2500 + Math.random() * 2000, 1500, 'bandpass', 2, .002);
  }
  step() { if (!this.ctx) return; const t = this.t; this.tone(90 + Math.random() * 30, t, .08, .07, 'triangle', .6); this.hiss(t, .06, .04, 800, 400); }
  gate(open) { if (!this.ctx) return; const t = this.t; this.tone(open ? 196 : 147, t, .18, .14, 'triangle', .8); this.tone(open ? 262 : 110, t + .08, .2, .1, 'triangle', .8); this.hiss(t, .12, .06, 1500, 600); }
  dig() { if (!this.ctx) return; const t = this.t; this.hiss(t, .25, .14, 600, 2400, 'bandpass', 1.5, .01); this.hiss(t + .22, .2, .1, 400, 200, 'lowpass', 1, .01); }
  rain() { if (!this.ctx) return; const t = this.t; this.hiss(t, 1.4, .1, 5000, 3000, 'highpass', .5, .3); for (let k = 0; k < 14; k++) this.hiss(t + Math.random() * 1.2, .03, .07, 3000 + Math.random() * 3000, 2000, 'bandpass', 3, .002); }
  freeze() { if (!this.ctx) return; const t = this.t; [2093, 2637, 3136, 2349].forEach((f, k) => this.tone(f, t + k * .06, .5, .03)); this.hiss(t, .3, .05, 6000, 3000, 'highpass'); }
  thaw() { if (!this.ctx) return; const t = this.t; this.hiss(t, .15, .2, 1800, 600, 'bandpass', 1, .002); this.tone(330, t, .2, .06, 'triangle', .5); }
  arrive() { if (!this.ctx) return; const t = this.t; this.tone(147, t, .5, .07, 'sawtooth', 1.02); this.tone(220, t + .25, .6, .06, 'sawtooth', 1.01); }
  bad() { if (!this.ctx) return; const t = this.t; this.tone(160, t, .12, .06, 'square', .9); }
  tap() { if (!this.ctx) return; const t = this.t; this.tone(880, t, .06, .03, 'triangle'); }
  undo() { if (!this.ctx) return; const t = this.t; this.tone(660, t, .08, .04, 'triangle', .7); }
  dawn() { if (!this.ctx) return; const t = this.t; [0, 7, 12].forEach((s, k) => this.tone(392 * 2 ** (s / 12), t + k * .08, .5, .035, 'triangle')); }
  // a little pipe air: G A B D B A G when the month is kept; a falling one when it's lost
  win() { if (!this.ctx) return; const t = this.t; [0, 2, 4, 7, 4, 2, 0, 12].forEach((s, k) => { this.tone(587 * 2 ** (s / 12), t + k * .17, .4, .06, 'triangle'); this.tone(587 * 2 ** (s / 12) * 2, t + k * .17, .2, .012); }); }
  lose() { if (!this.ctx) return; const t = this.t; [7, 5, 3, 0, -5].forEach((s, k) => this.tone(330 * 2 ** (s / 12), t + k * .25, .9, .06, 'triangle')); }
}
