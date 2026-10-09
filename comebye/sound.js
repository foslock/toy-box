// All synthesised: the handler's whistle, bleats, wind, the beck, skylarks and polite applause.

export class Sound {
  constructor() { this.on = true; this.ctx = null; }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.init(new AC());
  }

  init(ctx) {
    this.ctx = ctx;
    this.out = ctx.createGain(); this.out.gain.value = this.on ? 0.9 : 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.out.connect(comp); comp.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = b * 3.5; }
    this.brown = buf;
    const wb = ctx.createBuffer(1, len, ctx.sampleRate), wd = wb.getChannelData(0);
    for (let i = 0; i < len; i++) wd[i] = Math.random() * 2 - 1;
    this.white = wb;
    // wind bed
    this.wind = this.loop(this.brown, 'lowpass', 500, 0);
    this.beck = this.loop(this.white, 'bandpass', 1700, 0);
    this.lark = 3;
  }

  loop(buf, type, f, gain) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = type === 'bandpass' ? 0.6 : 0.7;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(fl); fl.connect(g); g.connect(this.out); src.start();
    return { g, fl };
  }

  setOn(on) {
    this.on = on;
    if (this.out) this.out.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  // weather and water, called every frame
  ambience(dt, { wind = 0.15, beck = 0, birds = 1 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.wind.g.gain.setTargetAtTime(0.03 + wind * 0.2, t, 0.4);
    this.wind.fl.frequency.setTargetAtTime(300 + wind * 700, t, 0.4);
    this.beck.g.gain.setTargetAtTime(beck * 0.05, t, 0.3);
    this.lark -= dt;
    if (this.lark < 0) { this.lark = 2 + Math.random() * 7; if (birds > 0) this.skylark(birds); }
  }

  skylark(v) {
    const ctx = this.ctx, t0 = ctx.currentTime, n = 5 + (Math.random() * 10 | 0);
    const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8; pan.connect(this.out);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.06 + Math.random() * 0.05), o = ctx.createOscillator(), g = ctx.createGain();
      const f = 3200 + Math.random() * 2200;
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (0.8 + Math.random() * 0.5), t + 0.05);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03 * v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      o.connect(g); g.connect(pan); o.start(t); o.stop(t + 0.08);
    }
  }

  // the handler's whistle. Each command has its own shape, as on a real trial field.
  whistle(cmd) {
    if (!this.ctx || !this.on) return;
    const P = {
      bye:   [[1500, 0], [2350, 0.22], [2350, 0.3], [1900, 0.46]],
      away:  [[2350, 0], [1550, 0.24], [1550, 0.3], [1950, 0.44]],
      lie:   [[2150, 0], [2150, 0.4], [1950, 0.5]],
      walk:  [[1800, 0], [2150, 0.08], null, [1800, 0.16], [2150, 0.24]],
      go:    [[1350, 0], [2450, 0.5], [2300, 0.6]],
      done:  [[2500, 0], [1300, 0.75]],
    }[cmd];
    if (!P) return;
    const ctx = this.ctx, t0 = ctx.currentTime + 0.01;
    let seg = [];
    const segs = [];
    for (const p of P) { if (p) seg.push(p); else { segs.push(seg); seg = []; } }
    segs.push(seg);
    for (const s of segs) {
      const o = ctx.createOscillator(), g = ctx.createGain(), start = t0 + s[0][1], end = t0 + s.at(-1)[1];
      o.type = 'sine';
      o.frequency.setValueAtTime(s[0][0], start);
      for (const [f, t] of s.slice(1)) o.frequency.linearRampToValueAtTime(f, t0 + t);
      g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(0.11, start + 0.03);
      g.gain.setValueAtTime(0.11, end - 0.03); g.gain.linearRampToValueAtTime(0, end + 0.02);
      // a little breath in it
      const n = ctx.createBufferSource(); n.buffer = this.white;
      const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = s[0][0]; nf.Q.value = 4;
      const ng = ctx.createGain(); ng.gain.value = 0.25;
      n.connect(nf); nf.connect(ng); ng.connect(g);
      o.connect(g); g.connect(this.out);
      o.start(start); o.stop(end + 0.05); n.start(start, Math.random()); n.stop(end + 0.05);
    }
  }

  // a sheep: a buzzy voice through two formants, with the wobble that makes it a baa
  bleat(pitch, pan, vol) {
    if (!this.ctx || !this.on || vol < 0.03) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.01, dur = 0.45 + Math.random() * 0.35;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f0 = 230 * pitch * (0.95 + Math.random() * 0.1);
    o.frequency.setValueAtTime(f0 * 1.05, t); o.frequency.linearRampToValueAtTime(f0, t + 0.1); o.frequency.linearRampToValueAtTime(f0 * 0.9, t + dur);
    const trem = ctx.createOscillator(); trem.frequency.value = 17 + Math.random() * 6;
    const tg = ctx.createGain(); tg.gain.value = 0.45;
    const amp = ctx.createGain(); amp.gain.value = 0.55;
    trem.connect(tg); tg.connect(amp.gain);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 720 * Math.pow(pitch, 0.4); f1.Q.value = 5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1500 * Math.pow(pitch, 0.4); f2.Q.value = 7;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.5 * vol, t + 0.05); env.gain.setValueAtTime(0.5 * vol, t + dur - 0.15); env.gain.linearRampToValueAtTime(0, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    o.connect(amp); amp.connect(f1); amp.connect(f2); f1.connect(env); f2.connect(env); env.connect(p); p.connect(this.out);
    o.start(t); trem.start(t); o.stop(t + dur + 0.05); trem.stop(t + dur + 0.05);
  }

  // a wooden knock as the flock clears a gate
  tock() {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(260, t + 0.08);
    g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 0.2);
  }

  // a few people along the wall clapping
  applause(amount = 1) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t0 = ctx.currentTime, n = Math.round(14 + amount * 50), len = 1.2 + amount * 1.6;
    for (let i = 0; i < n; i++) {
      const t = t0 + Math.random() * len, src = ctx.createBufferSource(); src.buffer = this.white;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200 + Math.random() * 1600; f.Q.value = 1.4;
      const g = ctx.createGain(), fade = 1 - (t - t0) / len;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3 * fade, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 1.6 - 0.8;
      src.connect(f); f.connect(g); g.connect(p); p.connect(this.out); src.start(t, Math.random() * 1.5); src.stop(t + 0.07);
    }
  }
}
