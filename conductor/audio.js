// The whole Society is synthesised: one harmonic table per instrument, a shared theatre reverb, and a bus per section
// whose gain and brightness follow the size of your beat.
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const TABLES = {
  str:   [1, .62, .46, .33, .26, .2, .15, .12, .09, .07, .05, .04],
  pizz:  [1, .5, .3, .16, .08, .04],
  wood:  [1, .28, .46, .09, .2, .05, .08],
  brass: [1, .8, .74, .62, .5, .4, .3, .22, .15, .1, .07],
  tuba:  [1, .75, .46, .26, .14, .07],
  voice: [1, .7, .55, .4, .34, .3, .24, .2, .16, .12, .1, .08],
};
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.bus = {}; this.held = []; }
  init(ctx) {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!ctx && !AC) return;
    const c = this.ctx = ctx || new AC({ latencyHint: 'interactive' });
    this.master = c.createGain(); this.master.gain.value = this.on ? .72 : 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = .006; comp.release.value = .16;
    this.master.connect(comp); comp.connect(c.destination);
    // a small, plushy theatre
    const rev = c.createConvolver(), len = Math.floor(c.sampleRate * 1.5), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const e = Math.pow(1 - i / len, 3.2); lp += (Math.random() * 2 - 1 - lp) * .32; d[i] = lp * e * (i < 400 ? i / 400 : 1); } }
    rev.buffer = ir; const rg = c.createGain(); rg.gain.value = .55; rev.connect(rg); rg.connect(this.master); this.rev = rev;
    this.tab = {}; for (const [k, h] of Object.entries(TABLES)) { const re = new Float32Array(h.length + 1), im = new Float32Array(h.length + 1); h.forEach((v, i) => im[i + 1] = v); this.tab[k] = c.createPeriodicWave(re, im); }
    const nl = c.sampleRate * 2, nb = this.noise = c.createBuffer(1, nl, c.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
    // one shared vibrato for the bowed and sung lines
    this.vib = c.createOscillator(); this.vib.frequency.value = 5.3; this.vibS = c.createGain(); this.vibS.gain.value = 7; this.vib.connect(this.vibS); this.vib.start();
    this.vibV = c.createGain(); this.vibV.gain.value = 22; this.vib.connect(this.vibV);
    const pans = { str: -.42, wood: -.14, brass: .26, tuba: .06, drum: .42, tri: .6, solo: 0 };
    for (const [id, p] of Object.entries(pans)) {
      const g = c.createGain(); g.gain.value = .6; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200; f.Q.value = .4;
      const pan = c.createStereoPanner ? c.createStereoPanner() : c.createGain(); if (pan.pan) pan.pan.value = p;
      g.connect(f); f.connect(pan); pan.connect(this.master); const send = c.createGain(); send.gain.value = id === 'drum' ? .1 : .24; pan.connect(send); send.connect(rev);
      this.bus[id] = { g, f };
    }
    // Madame's vowels: three formants on her bus
    const fIn = this.solo = c.createGain(); const fOut = this.bus.solo.g;
    for (const [fr, q, a] of [[800, 8, 1], [1200, 9, .6], [2900, 11, .32]]) { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fr; b.Q.value = q; const g = c.createGain(); g.gain.value = a * 2.4; fIn.connect(b); b.connect(g); g.connect(fOut); }
    // applause loop
    const al = c.sampleRate * 3, ab = this.clapBuf = c.createBuffer(2, al, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ab.getChannelData(ch); for (let n = 0; n < 900; n++) { const at = Math.floor(Math.random() * (al - 900)), a = .25 + Math.random() * .75; for (let i = 0; i < 700; i++) d[at + i] += (Math.random() * 2 - 1) * a * Math.exp(-i / 90); } }
    this.clap = c.createGain(); this.clap.gain.value = 0; const cf = c.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 2300; cf.Q.value = .5;
    const src = c.createBufferSource(); src.buffer = ab; src.loop = true; src.connect(cf); cf.connect(this.clap); this.clap.connect(this.master); this.clap.connect(rev); src.start();
    this.claps = src;
  }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? .72 : 0, this.now, .04); }
  // level 0..1 is how big you're beating
  setLevel(level) {
    if (!this.ctx) return; const t = this.now;
    const g = .17 + .9 * Math.pow(level, 1.5), bright = 900 + 4600 * level * level;
    for (const [id, b] of Object.entries(this.bus)) { b.g.gain.setTargetAtTime(id === 'solo' ? Math.max(.42, g) : g, t, .09); b.f.frequency.setTargetAtTime(id === 'drum' || id === 'tri' ? 7000 : bright, t, .12); }
  }
  osc(table, m, t, cents = 0) { const o = this.ctx.createOscillator(); o.setPeriodicWave(this.tab[table]); o.frequency.value = hz(m); o.detune.value = cents; return o; }
  env(t, a, peak, hold, rel) { const g = this.ctx.createGain(), p = g.gain; p.setValueAtTime(.0001, t); p.linearRampToValueAtTime(peak, t + a); p.setValueAtTime(peak, t + a + Math.max(0, hold)); p.setTargetAtTime(.0001, t + a + Math.max(0, hold), rel); return g; }
  // Things that can be cut off at a fermata's end register here.
  keep(g, end) { this.held.push({ g, end }); if (this.held.length > 40) this.held.shift(); }
  cutHeld() { const t = this.now; for (const h of this.held) if (h.end > t + .05) { try { h.g.gain.cancelScheduledValues(t); h.g.gain.setTargetAtTime(.0001, t, .05); } catch {} } this.held = []; }
  note(ev, delay, vel, dur, sloppy = 0) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + .005 + delay, b = this.bus[ev.sec]; if (!b) return;
    const wrong = sloppy ? (Math.random() - .5) * 46 * sloppy : 0, k = ev.k, m = ev.m, d = Math.max(.06, dur);
    const kill = (o, end) => { o.start(t); o.stop(end); };
    if (k === 'bd') { const o = c.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(46, t + .09); const g = this.env(t, .003, .95 * vel, 0, .1); o.connect(g); g.connect(b.g); kill(o, t + .7); return; }
    if (k === 'sn') { const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2100; f.Q.value = .7; const g = this.env(t, .002, .55 * vel, 0, .05); s.connect(f); f.connect(g); g.connect(b.g); s.start(t, Math.random()); s.stop(t + .3); return; }
    if (k === 'cy') { const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5200; const g = this.env(t, .002, .5 * vel, 0, .6); s.connect(f); f.connect(g); g.connect(b.g); s.start(t, Math.random()); s.stop(t + 3); return; }
    if (k === 'ting') { for (const [r, a] of [[1, .34], [2.76, .24], [5.4, .17], [8.9, .08]]) { const o = c.createOscillator(); o.frequency.value = 1740 * r; const g = this.env(t, .001, a, 0, .5 + .3 / r); o.connect(g); g.connect(this.master); g.connect(this.rev); kill(o, t + 3); } return; }
    const fine = wrong;
    if (ev.sec === 'str') {
      if (k === 'pizz') { const o = this.osc('pizz', m, t, fine), g = this.env(t, .002, .34 * vel, 0, .14); o.connect(g); g.connect(b.g); kill(o, t + .9); return; }
      const stab = k === 'stab', a = stab ? .012 : .045, g = this.env(t, a, (stab ? .17 : .19) * vel, d - a - .03, stab ? .05 : .1);
      for (const det of [-7, 6]) { const o = this.osc('str', m, t, fine + det); if (!stab) this.vibS.connect(o.detune); o.connect(g); kill(o, t + d + .7); }
      g.connect(b.g); this.keep(g, t + d); return;
    }
    if (ev.sec === 'wood') {
      const stab = k === 'stab', g = this.env(t, stab ? .012 : .03, .27 * vel, d - .05, .05), o = this.osc('wood', m, t, fine); o.connect(g); g.connect(b.g); kill(o, t + d + .5); this.keep(g, t + d); return;
    }
    if (ev.sec === 'brass') {
      const stab = k === 'stab', g = this.env(t, stab ? .01 : .025, .2 * vel, d - .05, .05), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(420, t); f.frequency.exponentialRampToValueAtTime(3400, t + .07); f.Q.value = .8;
      const o = this.osc('brass', m, t, fine); o.connect(f); f.connect(g); g.connect(b.g); kill(o, t + d + .5); this.keep(g, t + d); return;
    }
    if (ev.sec === 'tuba') {
      const stab = k === 'long', g = this.env(t, stab ? .1 : .018, .5 * vel, d * (k === 'bass' ? .42 : .8), k === 'bass' ? .07 : .1), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
      const o = this.osc('tuba', m, t, fine); o.frequency.setValueAtTime(hz(m) * .96, t); o.frequency.exponentialRampToValueAtTime(hz(m), t + .05); o.connect(f); f.connect(g); g.connect(b.g); kill(o, t + d + .6); this.keep(g, t + d); return;
    }
    if (ev.sec === 'solo') {
      const g = this.env(t, .03, .44 * vel, d - .05, .07), o = this.osc('voice', m, t, fine); this.vibV.connect(o.detune); o.connect(g); g.connect(this.solo); kill(o, t + d + .6); this.keep(g, t + d); return;
    }
  }
  cadenza(run, sec, delay = 0) {
    if (!this.ctx) return; const n = run.length, s = this.now + delay; let t = s;
    const midi = (x) => { const i = 'C C#D D#E F F#G G#A A#B '.indexOf(x.slice(0, -1).padEnd(2, ' ')) / 2; return i + (+x.slice(-1) + 1) * 12; };
    run.forEach((x, i) => {
      const w = i === n - 1 ? sec * .3 : sec * .7 / (n - 1) * (.7 + .6 * Math.sin(i * 1.7) ** 2);
      const g = this.env(t, .02, .46, w - .02, .05), o = this.osc('voice', midi(x), t, 0); this.vibV.connect(o.detune); o.connect(g); g.connect(this.solo); o.start(t); o.stop(t + w + .6); t += w;
    });
  }
  // a stick on the stand
  tap(a = .4) { if (!this.ctx) return; const c = this.ctx, t = this.now, s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2900; f.Q.value = 3; const g = this.env(t, .001, a, 0, .012); s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + .1); }
  // the band finding its A while the curtain goes up
  tuning(sec = 2.6) {
    if (!this.ctx) return; const c = this.ctx, t = this.now, g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.09, t + .5); g.gain.setValueAtTime(.09, t + sec - .6); g.gain.linearRampToValueAtTime(.0001, t + sec); g.connect(this.master); g.connect(this.rev);
    const set = [['str', 69], ['str', 69], ['str', 57], ['wood', 81], ['wood', 69], ['brass', 69], ['tuba', 45]];
    set.forEach(([tb, m], i) => { const o = this.osc(tb === 'tuba' ? 'tuba' : tb, m, t, (i % 2 ? 1 : -1) * (30 + i * 14)); o.detune.setTargetAtTime(0, t + .4 + i * .08, .5); if (tb === 'str') this.vibS.connect(o.detune); const a = c.createGain(); a.gain.value = .5; o.connect(a); a.connect(g); o.start(t + i * .12); o.stop(t + sec + .1); });
  }
  snore() { if (!this.ctx) return; const c = this.ctx, t = this.now, o = this.osc('tuba', 34, t), f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 240; f.Q.value = 2; const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.2, t + .4); g.gain.linearRampToValueAtTime(.0001, t + 1.1); const l = c.createOscillator(); l.frequency.value = 26; const lg = c.createGain(); lg.gain.value = 100; l.connect(lg); lg.connect(f.frequency); l.start(t); o.connect(f); f.connect(g); g.connect(this.master); o.start(t); o.stop(t + 1.2); l.stop(t + 1.2); }
  blat() { if (!this.ctx) return; const c = this.ctx, t = this.now, o = this.osc('brass', 34, t), g = this.env(t, .01, .5, .18, .06); o.frequency.setValueAtTime(hz(30), t); o.frequency.exponentialRampToValueAtTime(hz(38), t + .2); o.connect(g); g.connect(this.master); g.connect(this.rev); o.start(t); o.stop(t + .6); }
  cough() { if (!this.ctx) return; const c = this.ctx, t = this.now; for (let i = 0; i < 1 + (Math.random() * 2 | 0); i++) { const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 650 + Math.random() * 500; f.Q.value = 1.6; const g = this.env(t + i * .2, .012, .1, .02, .05); s.connect(f); f.connect(g); g.connect(this.master); g.connect(this.rev); s.start(t + i * .2, Math.random()); s.stop(t + i * .2 + .3); } }
  applause(amount, sec = 5) { if (!this.ctx) return; const t = this.now, p = this.clap.gain; p.cancelScheduledValues(t); p.setValueAtTime(Math.max(.0001, p.value), t); p.linearRampToValueAtTime(amount * .7, t + .7); p.setTargetAtTime(amount * .4, t + 1.6, 1); p.setTargetAtTime(.0001, t + sec, .8); }
  quietClaps() { if (!this.ctx) return; const t = this.now, p = this.clap.gain; p.cancelScheduledValues(t); p.setTargetAtTime(.0001, t, .2); }
  programmeRustle() { }
}
