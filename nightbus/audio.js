// The bus, in WebAudio: a diesel drone, rain, the bell, the doors. Everything is synthesized.
export class Sound {
  constructor() { this.on = true; this.ctx = null; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const x = this.ctx = new AC();
    this.master = x.createGain(); this.master.gain.value = this.on ? .9 : 0; this.master.connect(x.destination);
    // noise buffer
    const nb = x.createBuffer(1, x.sampleRate * 2, x.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = nb;
    // engine: two detuned saws through a low filter, plus rumble
    this.eng = x.createGain(); this.eng.gain.value = .0;
    this.lp = x.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 140; this.lp.Q.value = 3;
    this.o1 = x.createOscillator(); this.o1.type = 'sawtooth'; this.o1.frequency.value = 38;
    this.o2 = x.createOscillator(); this.o2.type = 'sawtooth'; this.o2.frequency.value = 57.4;
    this.o1.connect(this.lp); this.o2.connect(this.lp); this.lp.connect(this.eng); this.eng.connect(this.master);
    this.o1.start(); this.o2.start();
    const rum = x.createBufferSource(); rum.buffer = nb; rum.loop = true;
    const rlp = x.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 90;
    this.rumG = x.createGain(); this.rumG.gain.value = 0; rum.connect(rlp); rlp.connect(this.rumG); this.rumG.connect(this.master); rum.start();
    // rain on the roof
    const rain = x.createBufferSource(); rain.buffer = nb; rain.loop = true; rain.playbackRate.value = .7;
    const bp = x.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = .5;
    this.rainG = x.createGain(); this.rainG.gain.value = 0; rain.connect(bp); bp.connect(this.rainG); this.rainG.connect(this.master); rain.start();
    // fluorescent buzz, used by the flickering lights
    this.bz = x.createOscillator(); this.bz.type = 'square'; this.bz.frequency.value = 100;
    const bzf = x.createBiquadFilter(); bzf.type = 'bandpass'; bzf.frequency.value = 300;
    this.bzG = x.createGain(); this.bzG.gain.value = 0; this.bz.connect(bzf); bzf.connect(this.bzG); this.bzG.connect(this.master); this.bz.start();
  }
  set(on) { this.on = on; if (this.master) this.master.gain.setTargetAtTime(on ? .9 : 0, this.ctx.currentTime, .05); }
  // v: road speed 0..1; quiet: dozing or a menu up; buzz: flicker amount
  update(v, quiet, buzz, riding) {
    if (!this.ctx) return; const t = this.ctx.currentTime, q = quiet ? .35 : 1, r = riding ? 1 : 0;
    this.eng.gain.setTargetAtTime((.05 + .07 * v) * q * r, t, .2);
    this.lp.frequency.setTargetAtTime(110 + 260 * v, t, .3);
    this.o1.frequency.setTargetAtTime(34 + 26 * v, t, .4); this.o2.frequency.setTargetAtTime(51.3 + 39 * v, t, .4);
    this.rumG.gain.setTargetAtTime((.12 + .3 * v) * q * r, t, .3);
    this.rainG.gain.setTargetAtTime(.045 * q * (r * .7 + .3), t, .4);
    this.bzG.gain.setTargetAtTime(buzz * .05 * r, t, .02);
  }
  ding() { // the two-tone bell
    if (!this.ctx) return; const x = this.ctx, t = x.currentTime;
    for (const [f, dt] of [[1568, 0], [1245, .18]]) for (const h of [1, 2.76]) {
      const o = x.createOscillator(), g = x.createGain(); o.type = 'sine'; o.frequency.value = f * h;
      g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(h === 1 ? .2 : .05, t + dt + .005); g.gain.exponentialRampToValueAtTime(.0001, t + dt + (h === 1 ? 1.3 : .4));
      o.connect(g); g.connect(this.master); o.start(t + dt); o.stop(t + dt + 1.4);
    }
  }
  hiss(len = .9) { // doors
    if (!this.ctx) return; const x = this.ctx, t = x.currentTime;
    const s = x.createBufferSource(); s.buffer = this.noise; const f = x.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2200;
    const g = x.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, t + .05); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + len + .1);
    const o = x.createOscillator(), og = x.createGain(); o.frequency.value = 70; o.type = 'triangle';
    og.gain.setValueAtTime(.12, t + len * .8); og.gain.exponentialRampToValueAtTime(.0001, t + len + .25); o.connect(og); og.connect(this.master); o.start(t + len * .8); o.stop(t + len + .3);
  }
  sting(bad) { // the result: a low swell for a mistake, a soft chime for right
    if (!this.ctx) return; const x = this.ctx, t = x.currentTime;
    const notes = bad ? [55, 58.3, 82.4] : [523.3, 784];
    notes.forEach((f, i) => { const o = x.createOscillator(), g = x.createGain(); o.type = bad ? 'sawtooth' : 'triangle'; o.frequency.value = f;
      const lp = x.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = bad ? 400 : 3000;
      const st = t + (bad ? 0 : i * .12), len = bad ? 2.6 : 1.2;
      g.gain.setValueAtTime(.0001, st); g.gain.exponentialRampToValueAtTime(bad ? .09 : .07, st + (bad ? .8 : .02)); g.gain.exponentialRampToValueAtTime(.0001, st + len);
      o.connect(lp); lp.connect(g); g.connect(this.master); o.start(st); o.stop(st + len + .1); });
  }
  tick() { if (!this.ctx) return; const x = this.ctx, t = x.currentTime, o = x.createOscillator(), g = x.createGain(); o.frequency.value = 2400; o.type = 'square';
    g.gain.setValueAtTime(.02, t); g.gain.exponentialRampToValueAtTime(.0001, t + .03); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + .05); }
}
