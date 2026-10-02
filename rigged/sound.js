// Rigged Racer: every sound, made on the spot with Web Audio: the engines (a growl that rises with the pack's speed),
// desert wind, tyres squealing on oil, crashes, explosions, rockets, a vulture's screech, the sandworm's gulp, the
// countdown and a twangy fanfare.
const note = n => 440 * 2 ** ((n - 69) / 12);

export class Sound {
  constructor() { this.ac = null; this.enabled = true; this.engineOn = false; this.last = {}; }
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = this.ac = new AC();
    this.out = ac.createGain(); this.out.gain.value = this.enabled ? .65 : 0;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    this.out.connect(comp).connect(ac.destination);
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.2; }
    this.brown = buf;
    const wb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), wd = wb.getChannelData(0);
    for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    this.white = wb;
    // wind: brown noise, gusting
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = .6;
    this.windG = ac.createGain(); this.windG.gain.value = .05;
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .09; lg.gain.value = 260;
    lfo.connect(lg).connect(wf.frequency); lfo.start();
    src.connect(wf).connect(this.windG).connect(this.out); src.start();
    // the engines: two detuned saws through a growling low-pass, and a rumble
    this.engG = ac.createGain(); this.engG.gain.value = 0;
    this.engF = ac.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 400; this.engF.Q.value = 4;
    this.engOsc = [0, 1, 2].map(i => { const o = ac.createOscillator(); o.type = i === 2 ? 'square' : 'sawtooth'; o.frequency.value = 50 + i * 3; o.detune.value = i * 9; o.connect(this.engF); o.start(); return o; });
    const am = ac.createOscillator(), amg = ac.createGain(); am.frequency.value = 23; amg.gain.value = .35;
    const eg2 = ac.createGain(); eg2.gain.value = .65;
    am.connect(amg).connect(eg2.gain); am.start();
    this.engF.connect(eg2).connect(this.engG).connect(this.out);
  }
  setEnabled(on) { this.enabled = on; if (this.ac) this.out.gain.setTargetAtTime(on ? .65 : 0, this.ac.currentTime, .05); }
  get ok() { return this.ac && this.enabled && this.ac.state === 'running'; }
  // speed: the pack's average (0 when stopped); near: how close the camera is (0 far .. 1 close)
  engine(speed, near = .5) {
    if (!this.ac) return;
    const t = this.ac.currentTime, on = speed > .1;
    this.engG.gain.setTargetAtTime(on ? .05 + .06 * near : 0, t, .25);
    this.engOsc.forEach((o, i) => o.frequency.setTargetAtTime(42 + speed * 7.5 + i * 2.5, t, .2));
    this.engF.frequency.setTargetAtTime(260 + speed * 55, t, .2);
  }
  env(g, t, a, peak, d) { g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
  tone(f, dur, vol, type = 'sine', at = 0, slide = 0) {
    if (!this.ok) return;
    const ac = this.ac, t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    this.env(g, t, .006, vol, dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + .05);
  }
  noise(dur, vol, type = 'lowpass', f0 = 800, f1 = f0, at = 0, q = .8, brown = false) {
    if (!this.ok) return;
    const ac = this.ac, t = ac.currentTime + at, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = brown ? this.brown : this.white; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    this.env(g, t, .01, vol, dur);
    s.connect(f).connect(g).connect(this.out); s.start(t, Math.random() * .5); s.stop(t + dur + .1);
  }
  // the same sound many times in one frame (a pile-up) only plays once
  once(name, gap = .06) { const t = performance.now() / 1000; if (t - (this.last[name] || 0) < gap) return false; this.last[name] = t; return true; }

  play(name, arg) {
    if (!this.ok || !this.once(name + (arg || ''))) return;
    switch (name) {
      case 'tap': this.tone(700, .05, .1, 'triangle'); this.tone(1050, .04, .04, 'sine', .005); break;
      case 'place': this.tone(150, .12, .22, 'triangle', 0, .6); this.noise(.08, .12, 'lowpass', 1600, 300); break;
      case 'unplace': this.tone(420, .07, .1, 'triangle', 0, 1.5); break;
      case 'nope': this.tone(220, .12, .12, 'square', 0, .8); this.tone(180, .16, .1, 'square', .1, .8); break;
      case 'pick': this.tone(520, .05, .07, 'sine', 0, 1.6); break;
      case 'arm': this.tone(300, .3, .08, 'sawtooth', 0, 3); this.tone(1200, .08, .06, 'square', .28); break;
      case 'disarm': this.tone(900, .2, .06, 'sawtooth', 0, .3); break;
      case 'gate': this.tone(180, .2, .14, 'square', 0, .7); this.noise(.2, .08, 'bandpass', 2000, 800, 0, 3); break;
      case 'beep': this.tone(note(arg ? 81 : 69), arg ? .5 : .22, .16, 'square'); break;
      case 'lap': [0, .1, .2].forEach((a, i) => this.tone(note(76 + i * 5), .25, .1, 'triangle', a)); break;
      case 'spin': this.noise(.7, .14, 'bandpass', 2600, 1400, 0, 9); this.tone(1400, .5, .03, 'sine', 0, .7); break;
      case 'flat': this.noise(.12, .25, 'highpass', 900, 3000, 0, 1); for (let i = 0; i < 6; i++) this.tone(90, .05, .08, 'square', .1 + i * .07); break;
      case 'crash': this.noise(.4, .3, 'bandpass', 1200, 300, 0, 1.2); this.tone(120, .25, .25, 'triangle', 0, .5); for (let i = 0; i < 4; i++) this.tone(300 + Math.random() * 600, .07, .07, 'square', i * .035, .6); break;
      case 'boom': this.tone(70, .7, .5, 'sine', 0, .35); this.noise(.9, .5, 'lowpass', 1800, 90, 0, .7, true); break;
      case 'pop': this.noise(.25, .25, 'bandpass', 900, 400, 0, 1.4); this.tone(200, .1, .1, 'square', 0, .5); break;
      case 'boost': this.noise(.5, .16, 'bandpass', 500, 3200, 0, 2.5); this.tone(220, .4, .06, 'sawtooth', 0, 2.2); break;
      case 'jump': this.tone(180, .3, .14, 'triangle', 0, 2.6); break;
      case 'item': [0, .06, .12].forEach((a, i) => this.tone(note(84 + i * 4), .12, .06, 'square', a)); break;
      case 'crate': this.noise(.15, .14, 'bandpass', 1400, 600, 0, 2); break;
      case 'chrome': for (let i = 0; i < 6; i++) this.tone(note(88 + (i % 3) * 4), .2, .05, 'sine', i * .05); break;
      case 'rocket': this.noise(.6, .14, 'bandpass', 3000, 900, 0, 1.5); break;
      case 'vulture': this.tone(1500, .35, .07, 'sawtooth', 0, .55); this.tone(1700, .3, .05, 'sawtooth', .18, .5); break;
      case 'clang': this.tone(1800, .4, .1, 'triangle', 0, .98); this.tone(2700, .3, .06, 'sine', 0); break;
      case 'shove': this.tone(100, .15, .2, 'triangle', 0, .7); this.noise(.1, .1, 'lowpass', 1200, 400); break;
      case 'worm': this.noise(1.2, .35, 'lowpass', 500, 60, 0, 1, true); this.tone(60, 1, .3, 'sawtooth', 0, .7); this.tone(140, .25, .22, 'square', .35, .3); break;
      case 'spit': this.tone(90, .3, .25, 'square', 0, 2.2); this.noise(.3, .2, 'lowpass', 800, 2000, 0, 1); break;
      case 'magnet': this.tone(60, 1.2, .1, 'sawtooth', 0, 1.02); this.tone(120, 1.2, .05, 'square', 0, 1.01); this.tone(800, .1, .15, 'square', .25, .4); break;
      case 'drop': this.tone(110, .2, .25, 'triangle', 0, .5); this.noise(.25, .2, 'lowpass', 900, 200); break;
      case 'boulder': this.noise(1.2, .35, 'lowpass', 300, 60, 0, 1, true); for (let i = 0; i < 5; i++) this.tone(55 + i * 4, .2, .15, 'triangle', i * .2, .7); break;
      case 'flare': this.noise(.8, .4, 'lowpass', 3000, 300, 0, .5, true); this.noise(.8, .15, 'highpass', 2000, 4000, 0, .5); break;
      case 'finish': this.noise(1, .07, 'bandpass', 1500, 2200, 0, .6); [0, 4, 7].forEach((s, i) => this.tone(note(79 + s), .2, .06, 'triangle', i * .07)); break;
      case 'win': [[67, 0], [71, .12], [74, .24], [79, .36], [74, .6], [79, .72], [83, .9]].forEach(([n, a]) => { this.tone(note(n), .3, .1, 'sawtooth', a, 1.005); this.tone(note(n - 12), .3, .06, 'triangle', a); }); this.noise(1.6, .06, 'bandpass', 1400, 2400, .3, .5); break;
      case 'lose': [[62, 0], [61, .3], [60, .6], [59, .9]].forEach(([n, a], i) => this.tone(note(n), i === 3 ? .8 : .3, .1, 'sawtooth', a, i === 3 ? .94 : 1)); break;
      case 'meh': this.tone(440, .15, .07, 'triangle'); this.tone(370, .25, .07, 'triangle', .14); break;
      case 'talk': [0, .06, .12].forEach((a, i) => this.tone([520, 640, 580][i], .05, .05, 'triangle', a)); break;
    }
  }
}
