// Every sound in Echo is made here with Web Audio: the snap, clap and whistle (with real early reflections off the
// walls around you, delayed by how far away they are), steps, drips placed in 3D, water, the grinding of a loose rock,
// your heartbeat when you're short of air, and the wind and birds at the way out.
let SR = 44100;                       // set to the context's own rate when it starts
const rnd = (a, b) => a + Math.random() * (b - a);

export class CaveAudio {
  constructor() { this.ctx = null; this.muted = false; this.under = 0; }
  start() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
    SR = ctx.sampleRate;
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 1;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 18000; this.lp.Q.value = .5;
    this.comp = ctx.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.lp.connect(this.comp).connect(this.master).connect(ctx.destination);
    this.dry = ctx.createGain(); this.dry.connect(this.lp);
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(2.6);
    this.wet = ctx.createGain(); this.wet.gain.value = .3;
    this.wet.connect(this.verb).connect(this.lp);
    this.bufs = {
      snap: [0, 1, 2].map(() => this.snapBuf()), clap: [0, 1, 2].map(() => this.clapBuf()), whistle: [0, 1].map(i => this.whistleBuf(i)),
      step: [0, 1, 2, 3].map(() => this.stepBuf()), splash: [0, 1, 2].map(() => this.splashBuf()), drip: [0, 1, 2].map(i => this.dripBuf(i)),
      noise: this.noiseBuf(2.5), brown: this.brownBuf(4),
    };
    // a low, constant room tone, so silence still sounds like a cave
    const hum = this.loop(this.bufs.brown, 'lowpass', 140, .9);
    hum.gain.gain.value = .05;
    // the loose-rock grind, the breeze from the way out, and the wood
    this.grindLoop = this.loop(this.bufs.noise, 'bandpass', 260, 1.4); this.grindLoop.gain.gain.value = 0;
    this.windLoop = this.loop(this.bufs.noise, 'bandpass', 520, .6); this.windLoop.gain.gain.value = 0;
    this.leafLoop = this.loop(this.bufs.noise, 'highpass', 2600, .4); this.leafLoop.gain.gain.value = 0;
    this.water = this.loop(this.bufs.brown, 'lowpass', 380, .7); this.water.gain.gain.value = 0;
    this.birdT = 0; this.outside = 0;
  }
  get t() { return this.ctx?.currentTime || 0; }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.t, .05); }
  suspend(s) { if (!this.ctx) return; if (s) this.ctx.suspend?.(); else this.ctx.resume?.(); }

  /* ----- buffers ----- */
  buf(sec, fill, ch = 1) {
    const b = this.ctx.createBuffer(ch, Math.max(1, Math.round(sec * SR)), SR);
    for (let c = 0; c < ch; c++) fill(b.getChannelData(c), c);
    return b;
  }
  impulse(sec) {
    return this.buf(sec, (d, c) => {
      let lp = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        lp += (Math.random() * 2 - 1 - lp) * (.5 - .4 * Math.min(1, t / sec));     // darker as it dies
        d[i] = lp * Math.exp(-t * 3.2) * (t < .012 ? t / .012 : 1) * .9;
      }
    }, 2);
  }
  noiseBuf(sec) { return this.buf(sec, d => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }); }
  brownBuf(sec) { return this.buf(sec, d => { let b = 0; for (let i = 0; i < d.length; i++) { b = (b + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; } }); }
  snapBuf() {
    const f = rnd(1700, 2300);
    return this.buf(.14, d => {
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        const crack = (Math.random() * 2 - 1) * Math.exp(-t / .004);
        const skin = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / .012) * .5;
        const body = Math.sin(2 * Math.PI * 420 * t) * Math.exp(-t / .02) * .25;
        d[i] = (crack + skin + body) * (t < .0004 ? t / .0004 : 1);
      }
    });
  }
  clapBuf() {
    const taps = [0, rnd(.004, .007), rnd(.009, .014), rnd(.016, .021)];
    return this.buf(.3, d => {
      let lp = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        let e = 0; for (const k of taps) if (t >= k) e += Math.exp(-(t - k) / .0035) * (k ? .7 : 1);
        e += Math.exp(-t / .045) * .35;
        lp += ((Math.random() * 2 - 1) - lp) * .55;
        d[i] = lp * e * .9;
      }
    });
  }
  whistleBuf(v) {
    const f0 = v ? 1500 : 1650, f1 = v ? 2250 : 2100, len = .75;
    return this.buf(len, d => {
      let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        const glide = t < .16 ? f0 + (f1 - f0) * (t / .16) ** .6 : f1 - 120 * Math.max(0, (t - .45) / .3);
        const f = glide + Math.sin(t * 2 * Math.PI * 5.5) * 22 * Math.min(1, t / .25);
        ph += 2 * Math.PI * f / SR;
        const env = Math.min(1, t / .05) * Math.min(1, (len - t) / .12);
        d[i] = (Math.sin(ph) * .55 + Math.sin(ph * 2) * .04 + (Math.random() * 2 - 1) * .035) * env;
      }
    });
  }
  stepBuf() {
    return this.buf(.16, d => {
      let lp = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        lp += ((Math.random() * 2 - 1) - lp) * .3;
        const grit = Math.random() < .004 ? (Math.random() * 2 - 1) * 2 : 0;
        d[i] = (lp * Math.exp(-t / .03) + Math.sin(2 * Math.PI * 85 * t) * Math.exp(-t / .03) * .6 + grit * Math.exp(-t / .05)) * .7;
      }
    });
  }
  splashBuf() {
    return this.buf(.45, d => {
      let lp = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        lp += ((Math.random() * 2 - 1) - lp) * .45;
        const bub = Math.sin(2 * Math.PI * (500 + 900 * t) * t) * Math.exp(-((t - .08) ** 2) / .0012) * .3;
        d[i] = (lp * (Math.exp(-t / .07) * .8 + Math.exp(-t / .2) * .2) + bub) * .6;
      }
    });
  }
  dripBuf(v) {
    const f0 = [1500, 1250, 1800][v], f1 = f0 * .5;
    return this.buf(.35, d => {
      let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        const f = f1 + (f0 - f1) * Math.exp(-t / .018);
        ph += 2 * Math.PI * f / SR;
        d[i] = Math.sin(ph) * Math.exp(-t / .06) * Math.min(1, t / .001) * .6;
      }
    });
  }

  /* ----- playing ----- */
  loop(buffer, type, freq, q) {
    const s = this.ctx.createBufferSource(); s.buffer = buffer; s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    s.connect(f).connect(g).connect(this.dry); g.connect(this.wet);
    s.start(this.t + Math.random() * .1, Math.random() * buffer.duration);
    return { src: s, filter: f, gain: g };
  }
  play(buffer, { at = 0, gain = 1, pan = 0, rate = 1, filter = null, freq = 1000, q = 1, wet = 1, pos = null } = {}) {
    if (!this.ctx || !buffer) return;
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = buffer; s.playbackRate.value = rate;
    let node = s;
    if (filter) { const f = ctx.createBiquadFilter(); f.type = filter; f.frequency.value = freq; f.Q.value = q; node.connect(f); node = f; }
    const g = ctx.createGain(); g.gain.value = gain; node.connect(g); node = g;
    if (pos) {
      const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.rolloffFactor = 1.3; p.maxDistance = 60;
      p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2];
      node.connect(p); node = p;
    } else if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
    node.connect(this.dry);
    if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; node.connect(w).connect(this.wet); }
    s.start(this.t + at);
  }
  // A snap, clap or whistle, then its reflections: `taps` are [distance, pan, hardness] for the walls around you.
  sound(kind, taps = [], under = false) {
    if (!this.ctx) return;
    const B = this.bufs[kind], b = B[Math.floor(Math.random() * B.length)];
    const base = { snap: { gain: .8, filter: 'bandpass', freq: 3000, q: .7 }, clap: { gain: 1, filter: 'bandpass', freq: 1200, q: .55 }, whistle: { gain: .42, filter: 'highpass', freq: 600, q: .5 } }[kind];
    const muff = under ? { filter: 'lowpass', freq: 600, q: .7 } : {};
    this.play(b, { ...base, ...muff, gain: base.gain * (under ? .7 : 1), rate: rnd(.97, 1.03), wet: 1 });
    let room = 0;
    for (const [d, pan, hard] of taps) {
      room += d;
      if (d > 60) continue;
      const delay = 2 * d / 343;
      this.play(b, { at: delay, gain: base.gain * .55 * hard / (1 + d * .22), pan: pan * .8, filter: 'lowpass', freq: under ? 500 : Math.max(900, 7000 - d * 160), q: .5, wet: .2 });
    }
    // bigger spaces ring longer and louder
    const avg = taps.length ? room / taps.length : 6;
    this.wet.gain.setTargetAtTime(Math.min(.75, .12 + avg * .025), this.t, .05);
  }
  step(water, under) {
    if (water) this.play(this.bufs.splash[Math.floor(Math.random() * 3)], { gain: under ? .25 : .32, rate: rnd(.85, 1.2), filter: 'lowpass', freq: under ? 700 : 3800, wet: .4 });
    else this.play(this.bufs.step[Math.floor(Math.random() * 4)], { gain: .45, rate: rnd(.85, 1.15), filter: 'bandpass', freq: rnd(700, 1300), q: .6, wet: .5 });
  }
  bump() { this.play(this.bufs.step[0], { gain: .35, rate: .6, filter: 'lowpass', freq: 600, wet: .3 }); }
  drip(x, y, z, under) { this.play(this.bufs.drip[Math.floor(Math.random() * 3)], { gain: under ? .1 : .32, rate: rnd(.9, 1.1), pos: [x, y, z], wet: 1.3, filter: under ? 'lowpass' : null, freq: 600 }); }
  thud() {
    this.play(this.bufs.step[1], { gain: 1.2, rate: .35, filter: 'lowpass', freq: 500, wet: .8 });
    this.play(this.bufs.brown, { gain: .6, rate: 1, filter: 'lowpass', freq: 200, wet: .6 });
  }
  dive() { this.play(this.bufs.splash[0], { gain: .5, rate: .7, filter: 'lowpass', freq: 1500, wet: .5 }); this.bubbles(6); }
  surface(gasp) {
    this.play(this.bufs.splash[1], { gain: .4, rate: 1, filter: 'lowpass', freq: 3000, wet: .4 });
    if (gasp) this.play(this.bufs.noise, { gain: .22 * gasp, rate: .5, filter: 'bandpass', freq: 1100, q: .8, wet: .4 });
  }
  bubbles(n = 3) {
    if (!this.ctx) return;
    for (let i = 0; i < n; i++) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.t + i * rnd(.04, .12);
      o.frequency.setValueAtTime(rnd(250, 500), t); o.frequency.exponentialRampToValueAtTime(rnd(700, 1300), t + .06);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + .08);
      o.connect(g).connect(this.dry); o.start(t); o.stop(t + .1);
    }
  }
  heartbeat(k) {
    if (!this.ctx) return;
    for (const [dt, a] of [[0, 1], [.16, .7]]) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.t + dt;
      o.frequency.setValueAtTime(62, t); o.frequency.exponentialRampToValueAtTime(40, t + .12);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.5 * a * k, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .2);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + .25);
    }
  }
  // Called every frame with where your ears are.
  update(pos, fwd, up, s) {
    if (!this.ctx) return;
    const L = this.ctx.listener, t = this.t;
    if (L.positionX) {
      L.positionX.setTargetAtTime(pos[0], t, .02); L.positionY.setTargetAtTime(pos[1], t, .02); L.positionZ.setTargetAtTime(pos[2], t, .02);
      L.forwardX.setTargetAtTime(fwd[0], t, .02); L.forwardY.setTargetAtTime(fwd[1], t, .02); L.forwardZ.setTargetAtTime(fwd[2], t, .02);
      L.upX.setTargetAtTime(up[0], t, .02); L.upY.setTargetAtTime(up[1], t, .02); L.upZ.setTargetAtTime(up[2], t, .02);
    } else { L.setPosition?.(...pos); L.setOrientation?.(...fwd, ...up); }
    const u = s.under ? 1 : 0;
    if (u !== this.under) { this.under = u; this.lp.frequency.setTargetAtTime(u ? 520 : 18000, t, .06); }
    this.grindLoop.gain.gain.setTargetAtTime(Math.min(1, s.grind) * .5, t, .05);
    this.grindLoop.filter.frequency.setTargetAtTime(200 + 120 * Math.sin(t * 7) + 80 * Math.random(), t, .03);
    this.windLoop.gain.gain.setTargetAtTime(s.wind * .22, t, .3);
    this.windLoop.filter.frequency.setTargetAtTime(420 + 260 * Math.sin(t * .37) + 140 * Math.sin(t * 1.3), t, .2);
    this.leafLoop.gain.gain.setTargetAtTime(s.outside * (.05 + .04 * Math.sin(t * .5)), t, .4);
    this.water.gain.gain.setTargetAtTime(s.water * .16, t, .3);
    this.outside = s.outside;
    if (s.outside > .2 && t > this.birdT) { this.birdT = t + rnd(.6, 3.2) / s.outside; this.bird(); }
  }
  bird() {
    const ctx = this.ctx, t0 = this.t, kind = Math.floor(Math.random() * 3), n = kind === 0 ? 2 + Math.floor(Math.random() * 4) : kind === 1 ? 1 : 5 + Math.floor(Math.random() * 5);
    const pan = rnd(-.9, .9), base = rnd(2200, 4200), gain = rnd(.03, .09) * this.outside;
    const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(this.dry);
    const w = ctx.createGain(); w.gain.value = .25; p.connect(w).connect(this.wet);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (kind === 2 ? .07 : rnd(.12, .22)), len = kind === 1 ? .5 : kind === 2 ? .05 : rnd(.07, .13);
      const o = ctx.createOscillator(), g = ctx.createGain();
      const f = base * (kind === 2 ? 1 + i * .02 : rnd(.9, 1.1));
      o.frequency.setValueAtTime(f * (kind === 1 ? .8 : 1.15), t);
      o.frequency.exponentialRampToValueAtTime(f * (kind === 1 ? 1.25 : .75), t + len);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + len);
      o.connect(g).connect(p); o.start(t); o.stop(t + len + .02);
    }
  }
  // Light, and the end: a slow chord swells as you walk out.
  dawn() {
    if (!this.ctx || this.dawned) return;
    this.dawned = true;
    const ctx = this.ctx, t = this.t;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.08, t + 4); g.gain.linearRampToValueAtTime(.05, t + 12); g.gain.linearRampToValueAtTime(0, t + 26);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(2400, t + 6);
    g.connect(f).connect(this.dry); f.connect(this.wet);
    for (const hz of [196, 246.9, 293.7, 392, 493.9, 587.3]) for (const det of [-4, 4]) {
      const o = ctx.createOscillator(); o.type = hz < 300 ? 'triangle' : 'sine'; o.frequency.value = hz; o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = hz < 300 ? .5 : .32;
      o.connect(og).connect(g); o.start(t); o.stop(t + 27);
    }
  }
}
