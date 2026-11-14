// All sound is synthesized: wind and a clock at night, a fire at dinner, a howl, knocks for votes.
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.amb = null; this.mode = null; }
  init(ctx) {
    if (this.ctx) return;
    try { this.ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.on ? .8 : 0; this.master.connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    if (this.mode) this.ambience(this.mode, true);
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? .8 : 0, this.ctx.currentTime, .05); }
  t() { return this.ctx.currentTime; }
  src(loop = false) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = loop; return s; }

  ambience(mode, force) {
    if (this.mode === mode && !force) return;
    this.mode = mode;
    if (!this.ctx) return;
    const c = this.ctx, now = this.t();
    if (this.amb) { const a = this.amb; a.g.gain.setTargetAtTime(0, now, .6); setTimeout(() => a.stop(), 3000); this.amb = null; }
    if (!mode) return;
    const g = c.createGain(); g.gain.value = 0; g.connect(this.master);
    const nodes = [];
    if (mode === 'night') {
      const n = this.src(true), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 1.5;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .09; lg.gain.value = 220; lfo.connect(lg); lg.connect(f.frequency);
      n.connect(f); f.connect(g); n.start(); lfo.start(); nodes.push(n, lfo);
      const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = 55; og.gain.value = .25; o.connect(og); og.connect(g); o.start(); nodes.push(o);
      g.gain.setTargetAtTime(.32, now, 1.2);
      this.tick = setInterval(() => this.clock(), 1000);
    } else {
      const n = this.src(true), f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = .4;
      n.connect(f); f.connect(g); n.start(); nodes.push(n);
      const o = c.createOscillator(), og = c.createGain(); o.type = 'triangle'; o.frequency.value = 73.4; og.gain.value = .18; o.connect(og); og.connect(g); o.start(); nodes.push(o);
      g.gain.setTargetAtTime(.06, now, 1.2);
      this.tick = setInterval(() => this.crackle(), 260);
    }
    const tick = this.tick;
    this.amb = { g, stop: () => { clearInterval(tick); for (const x of nodes) try { x.stop(); } catch {} } };
  }
  clock() {
    if (!this.ctx || !this.on) return;
    const c = this.ctx, t = this.t();
    const s = this.src(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.frequency.value = this._tk ? 2400 : 1900; f.Q.value = 9; this._tk = !this._tk;
    g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.001, t + .05);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + .06);
  }
  crackle() {
    if (!this.ctx || !this.on || Math.random() > .55) return;
    const c = this.ctx, t = this.t() + Math.random() * .2;
    const s = this.src(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'highpass'; f.frequency.value = 1500 + Math.random() * 3000;
    g.gain.setValueAtTime(.05 + Math.random() * .12, t); g.gain.exponentialRampToValueAtTime(.001, t + .03);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + .04);
  }
  howl() {
    if (!this.ctx) return;
    const c = this.ctx, t = this.t() + .05, D = 2.6;
    const o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o2.type = 'sawtooth'; o2.detune.value = 9;
    for (const x of [o, o2]) {
      x.frequency.setValueAtTime(260, t); x.frequency.linearRampToValueAtTime(480, t + .5);
      x.frequency.linearRampToValueAtTime(520, t + 1.6); x.frequency.exponentialRampToValueAtTime(300, t + D);
    }
    const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 5.5; vg.gain.value = 9; vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    f.type = 'bandpass'; f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1100, t + 1.2); f.frequency.linearRampToValueAtTime(600, t + D); f.Q.value = 6;
    f2.type = 'lowpass'; f2.frequency.value = 2400;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.32, t + .4); g.gain.setValueAtTime(.32, t + 1.7); g.gain.exponentialRampToValueAtTime(.001, t + D);
    o.connect(f); o2.connect(f); f.connect(f2); f2.connect(g); g.connect(this.master);
    const dl = c.createDelay(), fb = c.createGain(); dl.delayTime.value = .32; fb.gain.value = .35; g.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(this.master);
    for (const x of [o, o2, vib]) { x.start(t); x.stop(t + D + .1); }
  }
  bell() {   // a low toll at dawn
    if (!this.ctx) return;
    const c = this.ctx, t = this.t() + .02;
    for (const [m, a] of [[1, .25], [2.4, .12], [3.0, .08], [4.5, .05]]) {
      const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 110 * m;
      g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(.001, t + 3.2 / m + .6);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 4);
    }
  }
  knock(n = 1) {
    if (!this.ctx) return;
    const c = this.ctx;
    for (let i = 0; i < n; i++) {
      const t = this.t() + i * .16 + .01;
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(70, t + .1);
      g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .14);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .16);
    }
  }
  sting() {  // a lie caught
    if (!this.ctx) return;
    const c = this.ctx, t = this.t() + .01;
    for (const f of [92.5, 98, 138.6, 185]) {
      const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f;
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(300, t + 1.4);
      g.gain.setValueAtTime(.07, t); g.gain.exponentialRampToValueAtTime(.001, t + 1.6);
      o.connect(lp); lp.connect(g); g.connect(this.master); o.start(t); o.stop(t + 1.7);
    }
  }
  quill() {
    if (!this.ctx) return;
    const c = this.ctx;
    for (let i = 0; i < 3; i++) {
      const t = this.t() + i * .07 + Math.random() * .02;
      const s = this.src(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.frequency.value = 3200 + Math.random() * 1500; f.Q.value = 2;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.07, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + .07);
      s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + .08);
    }
  }
  tap() {
    if (!this.ctx) return;
    const c = this.ctx, t = this.t() + .005, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = 660; g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.001, t + .08);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .1);
  }
  slam() {   // the ice house door
    if (!this.ctx) return;
    const c = this.ctx, t = this.t() + .01;
    const s = this.src(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = 260; g.gain.setValueAtTime(.9, t); g.gain.exponentialRampToValueAtTime(.001, t + .7);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + .8);
    this.knock(1);
  }
}
