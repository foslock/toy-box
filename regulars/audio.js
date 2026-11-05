// All synthesised. A soft combo that changes with the decades, plus the noises of a counter.
const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
// ii V I vi, in the old-fashioned way, with a turnaround
const CHANGES = [[62, 65, 69, 72], [67, 71, 74, 77], [60, 64, 67, 71], [69, 72, 76, 79], [62, 65, 69, 72], [67, 71, 74, 77], [60, 64, 67, 71], [60, 64, 67, 70]];

export class Sound {
  constructor() { this.ctx = null; this.on = true; this.style = 'swing'; this.step = 0; this.next = 0; this.pourN = null; this.sizzle = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC(); this.master = c.createGain(); this.master.gain.value = this.on ? .9 : 0;
    const comp = c.createDynamicsCompressor(); this.master.connect(comp); comp.connect(c.destination);
    this.music = c.createGain(); this.music.gain.value = .3; this.music.connect(this.master);
    const len = c.sampleRate; const b = this.noise = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // a little room
    const dl = c.createDelay(); dl.delayTime.value = .13; const fb = c.createGain(); fb.gain.value = .22; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
    this.music.connect(dl); dl.connect(f); f.connect(fb); fb.connect(dl); f.connect(this.master);
    this.next = c.currentTime + .2; this.timer = setInterval(() => this.sched(), 60);
  }
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? .9 : 0, this.ctx.currentTime, .05); }
  setYear(y, def) {
    this.style = y < 1960 ? 'swing' : y < 1968 ? 'bossa' : 'rhodes';
    this.sparse = !!(def && (def.quiet || def.ghost || def.snow));
    this.bpm = this.style === 'swing' ? 112 : this.style === 'bossa' ? 124 : 84;
    this.key = (y - 1952) % 3 === 1 ? 5 : (y - 1952) % 3 === 2 ? -2 : 0;
    if (this.sparse) this.bpm *= .78;
  }
  stopMusic(fade = .4) { if (this.music) this.music.gain.setTargetAtTime(0, this.ctx.currentTime, fade); this.playing = false; }
  startMusic() { if (this.music) { this.music.gain.cancelScheduledValues(0); this.music.gain.setTargetAtTime(.3, this.ctx.currentTime, .3); } this.playing = true; }

  tone(type, f, t, dur, g, dest = this.master, a = .005) { const c = this.ctx; const o = c.createOscillator(), e = c.createGain(); o.type = type; o.frequency.value = f; e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + a); e.gain.exponentialRampToValueAtTime(.0005, t + dur); o.connect(e); e.connect(dest); o.start(t); o.stop(t + dur + .02); return o; }
  burst(t, dur, g, freq, type = 'highpass', dest = this.master, Q = .7) { const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; s.playbackRate.value = .8 + Math.random() * .4; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = Q; const e = c.createGain(); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(.0005, t + dur); s.connect(f); f.connect(e); e.connect(dest); s.start(t, Math.random()); s.stop(t + dur + .02); }

  sched() {
    const c = this.ctx; if (!this.playing || document.hidden) { this.next = c.currentTime + .1; return; }
    while (this.next < c.currentTime + .25) { this.beat(this.step, this.next); const eighth = 30 / (this.bpm || 110); const sw = this.style === 'swing' ? (this.step % 2 ? .68 : 1.32) : 1; this.next += eighth * sw; this.step++; }
  }

  beat(s, t) {
    const m = this.music, k = this.key || 0; const bar = Math.floor(s / 8) % CHANGES.length, b = s % 8; const ch = CHANGES[bar].map(n => n + k); const root = ch[0] - 24; const R = Math.random;
    const vib = (n, g, d = 1.1) => { this.tone('sine', NOTE(n), t, d, g, m); this.tone('sine', NOTE(n) * 4.01, t, d * .3, g * .16, m); };
    const ep = (n, g, d = 1.4) => { this.tone('triangle', NOTE(n), t, d, g, m, .012); this.tone('sine', NOTE(n) * 2.0, t, d * .4, g * .3, m); };
    const bass = (n, g = .34) => this.tone('triangle', NOTE(n), t, .34, g, m, .01);
    if (this.sparse) { if (b === 0) { for (const n of ch.slice(0, 3)) vib(n, .05, 2.2); } if (b === 4 && R() < .6) vib(ch[3] + 12, .05, 1.5); return; }
    if (this.style === 'swing') {
      if (b % 2 === 0) bass(root + [0, 7, 5, 4, 0, 3, 7, 9][(b / 2 + bar * 2) % 8]);
      if (b % 2 === 0) this.burst(t, .08, .05, 6000); if (b % 4 === 3 || (b % 2 === 1 && R() < .4)) this.burst(t, .05, .035, 7000);
      if (b === 3 || (b === 6 && bar % 2)) for (const n of ch) vib(n, .035, .5);
      if (s % 3 === 0 && R() < .5) vib(ch[Math.floor(R() * 4)] + 12, .06, .7);
    } else if (this.style === 'bossa') {
      if (b === 0) bass(root, .3); if (b === 3) bass(root + 7, .22); if (b === 4) bass(root + 7, .3); if (b === 7) bass(root, .2);
      if ([0, 3, 6].includes(b) || (bar % 2 && [2, 4].includes(b))) this.burst(t, .03, .05, 2200, 'bandpass', m, 6);
      this.burst(t, .05, b % 2 ? .012 : .028, 7000, 'highpass', m);
      if ([0, 3, 5].includes(b)) for (const n of ch) this.tone('triangle', NOTE(n), t + R() * .012, .5, .03, m);
      if (b % 2 === 0 && R() < .34) ep(ch[Math.floor(R() * 4)] + 12, .05, .7);
    } else {
      if (b === 0) bass(root, .32); if (b === 3 && R() < .6) bass(root, .2); if (b === 5) bass(root + 7, .26);
      if (b === 2 || b === 6) this.burst(t, .12, .05, 1800, 'bandpass', m, 1); if (b % 2 === 0) this.burst(t, .04, .018, 8000, 'highpass', m);
      if (b === 0 || b === 5) for (const n of ch) ep(n, .035, 1.6);
      if (R() < .1) ep(ch[Math.floor(R() * 4)] + 12, .05, .9);
    }
  }

  fx(name, d = {}) {
    const c = this.ctx; if (!c) return; const t = c.currentTime; const R = Math.random;
    switch (name) {
      case 'door': this.tone('sine', 1760, t, .5, .07); this.tone('sine', d.reg ? 1318 : 2217, t + .09, .6, .06); break;
      case 'plate': this.tone('sine', 2300 + R() * 500, t, .1, .06); this.burst(t, .05, .09, 3000); break;
      case 'ding': this.tone('sine', 1975, t, .35, .1); break;
      case 'pop': this.burst(t, .05, .25, 900, 'bandpass'); this.tone('square', 240, t, .06, .05); break;
      case 'lever': this.burst(t, .04, .12, 1400, 'bandpass'); break;
      case 'flip': this.burst(t, .12, .08, 1800); this.tone('triangle', 300, t, .08, .06); break;
      case 'sizzle': this.burst(t, 1.3, .045, 3500); break;
      case 'burn': this.tone('sawtooth', 120, t, .3, .05); this.burst(t, .4, .06, 900, 'lowpass'); break;
      case 'coin': for (let i = 0; i < 2; i++) this.tone('square', 2100 + i * 700, t + i * .05, .1, .026); break;
      case 'till': this.tone('sine', 2093, t, .45, .09); this.tone('sine', 2637, t + .08, .6, .09); this.burst(t, .05, .08, 2400); break;
      case 'usual': this.tone('triangle', 784, t, .3, .1); this.tone('triangle', 1175, t + .11, .5, .1); this.tone('sine', 1568, t + .22, .7, .07); break;
      case 'nope': this.tone('triangle', 196, t, .16, .12); break;
      case 'walk': this.tone('triangle', 330, t, .18, .08); this.tone('triangle', 247, t + .12, .26, .08); break;
      case 'perfect': this.tone('sine', 1320, t, .18, .06); break;
      case 'spill': this.burst(t, .3, .08, 700, 'lowpass'); break;
      case 'scrape': this.burst(t, .16, .1, 2600, 'bandpass'); break;
    }
  }
  pour(on) {
    const c = this.ctx; if (!c) return;
    if (on && !this.pourN) { const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 1.2; const g = c.createGain(); g.gain.value = .09; f.frequency.linearRampToValueAtTime(1900, c.currentTime + 1.2); s.connect(f); f.connect(g); g.connect(this.master); s.start(); this.pourN = s; }
    else if (!on && this.pourN) { this.pourN.stop(); this.pourN = null; }
  }
}
