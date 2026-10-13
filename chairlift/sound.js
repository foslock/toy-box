// Small WebAudio sounds: a soft mountain wind, a chime per happy skier (a note per colour), the clunk of
// a lift going in, the hiss of a run being cut, a bell when a ring is filling.

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];

export class Sound {
  constructor() { this.ctx = null; this.on = true; this.last = 0; this.n = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.out = ctx.createGain(); this.out.gain.value = this.on ? .8 : 0; this.out.connect(ctx.destination);
    // wind: filtered noise, slowly swelling
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = .7;
    const g = ctx.createGain(); g.gain.value = .045;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .07; lg.gain.value = .03; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    const lfo2 = ctx.createOscillator(), lg2 = ctx.createGain(); lfo2.frequency.value = .05; lg2.gain.value = 180; lfo2.connect(lg2); lg2.connect(f.frequency); lfo2.start();
    src.connect(f); f.connect(g); g.connect(this.out); src.start();
  }
  setOn(v) { this.on = v; if (this.out) this.out.gain.setTargetAtTime(v ? .8 : 0, this.ctx.currentTime, .05); }

  tone(freq, t0, dur, vol, type = 'sine') {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .008); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g); g.connect(this.out); o.start(t0); o.stop(t0 + dur + .05);
  }
  hiss(t0, dur, vol, from, to) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t0); f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t0, Math.random() * 2); s.stop(t0 + dur + .05);
  }

  served(lvl) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this.last < .07) return;
    this.last = t;
    const root = [523.25, 392, 293.66][lvl];
    const st = SCALE[(this.n++ * 3 + lvl) % SCALE.length];
    this.tone(root * Math.pow(2, st / 12), t, .9, .07);
    this.tone(root * Math.pow(2, st / 12) * 2, t, .35, .018, 'triangle');
  }
  built(kind) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    if (kind === 'lift') { this.tone(110, t, .25, .16, 'triangle'); this.tone(82, t + .09, .3, .14, 'triangle'); this.hiss(t, .15, .08, 2000, 900); }
    else this.hiss(t, .45, .14, 3500, 700);
  }
  removed() { if (!this.ctx) return; const t = this.ctx.currentTime; this.hiss(t, .25, .1, 600, 2400); this.tone(196, t, .2, .05, 'triangle'); }
  bad() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(150, t, .14, .07, 'square'); }
  warn() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(880, t, 1.2, .05); this.tone(1318, t + .01, 1.0, .025); }
  lodge() { if (!this.ctx) return; const t = this.ctx.currentTime; [0, 4, 7].forEach((s, i) => this.tone(392 * Math.pow(2, s / 12), t + i * .09, .6, .05, 'triangle')); }
  evening() { if (!this.ctx) return; const t = this.ctx.currentTime; [12, 7, 4, 0, -5].forEach((s, i) => this.tone(440 * Math.pow(2, s / 12), t + i * .16, 1.6, .05)); }
  closed() { if (!this.ctx) return; const t = this.ctx.currentTime; [0, -3, -7, -12].forEach((s, i) => this.tone(330 * Math.pow(2, s / 12), t + i * .22, 1.4, .07, 'triangle')); }
  tap() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(660, t, .08, .04, 'triangle'); }
}
