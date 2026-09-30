// Sail: every sound, made on the spot with Web Audio (no recordings): the sea washing, wooden clicks as orders go on
// the scroll, a creak for each order the crew carry out, the cannon's boom, splashes, the buoy's bell, a whirlpool's
// gurgle, and a little fanfare in the harbour.
const note = n => 440 * 2 ** ((n - 69) / 12);

export class Sound {
  constructor() { this.ac = null; this.enabled = true; this.seaOn = false; }
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = this.ac = new AC();
    this.out = ac.createGain(); this.out.gain.value = this.enabled ? .7 : 0;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.out.connect(comp).connect(ac.destination);
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.2; }
    this.brown = buf;
    const wb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), wd = wb.getChannelData(0);
    for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    this.white = wb;
    // the sea: brown noise, swelling slowly
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    this.seaF = ac.createBiquadFilter(); this.seaF.type = 'lowpass'; this.seaF.frequency.value = 420;
    this.seaG = ac.createGain(); this.seaG.gain.value = 0;
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .13; lg.gain.value = 180;
    lfo.connect(lg).connect(this.seaF.frequency); lfo.start();
    src.connect(this.seaF).connect(this.seaG).connect(this.out); src.start();
    this.sea(this.seaOn);
  }
  setEnabled(on) { this.enabled = on; if (this.ac) this.out.gain.setTargetAtTime(on ? .7 : 0, this.ac.currentTime, .05); }
  get ok() { return this.ac && this.enabled && this.ac.state === 'running'; }
  sea(on) { this.seaOn = on; if (this.ac) this.seaG.gain.setTargetAtTime(on ? .09 : .03, this.ac.currentTime, .8); }

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
  creak(at = 0, f = 180) { this.tone(f, .16, .05, 'sawtooth', at, 1.35); this.noise(.12, .05, 'bandpass', 900, 600, at, 4); }

  play(name, arg) {
    if (!this.ok) return;
    switch (name) {
      case 'tap': this.tone(760, .05, .12, 'triangle'); this.tone(1140, .04, .05, 'sine', .005); break;
      case 'untap': this.tone(420, .06, .1, 'triangle'); break;
      case 'pick': this.tone(600, .05, .08, 'sine', 0, 1.6); break;
      case 'talk': [0, .06, .12].forEach((a, i) => this.tone([520, 620, 580][i], .05, .05, 'triangle', a)); break;
      case 'hint': [0, .07, .14].forEach((a, i) => this.tone(note(84 + i * 4), .2, .06, 'sine', a)); break;
      case 'order':
        if (arg === 'hoist') { this.creak(0, 160); this.creak(.14, 200); this.noise(.3, .06, 'highpass', 1500, 3000, .1); }
        else if (arg === 'strike') { this.creak(0, 220); this.noise(.35, .07, 'lowpass', 1800, 400, .05); }
        else if (arg === 'steady') this.tone(note(76), .25, .05, 'sine');
        else if (arg === 'port' || arg === 'starboard') { this.creak(0, arg === 'port' ? 150 : 175); this.creak(.12, arg === 'port' ? 135 : 195); }
        else if (arg === 'anchor') for (let i = 0; i < 7; i++) this.noise(.05, .06, 'bandpass', 3000 + Math.random() * 1500, 2500, i * .045, 8);
        break;
      case 'boom': this.tone(90, .5, .45, 'sine', 0, .4); this.noise(.6, .4, 'lowpass', 1400, 120, 0, .7, true); break;
      case 'crash': this.noise(.35, .3, 'bandpass', 900, 300, 0, 1.2); for (let i = 0; i < 5; i++) this.tone(200 + Math.random() * 300, .08, .08, 'square', i * .04, .6); break;
      case 'whoosh': this.noise(.35, .12, 'bandpass', 400, 2400, 0, 2); break;
      case 'clunk': this.tone(160, .12, .2, 'triangle', 0, .7); this.noise(.08, .1, 'lowpass', 900, 300); break;
      case 'splash': this.noise(.5, .16, 'lowpass', 2500, 300, 0, .7); break;
      case 'drain': this.noise(1.2, .2, 'lowpass', 1200, 90, 0, 3, true); this.tone(420, 1.1, .08, 'sine', 0, .2); break;
      case 'bell': [1, 2.76, 5.4].forEach((k, i) => this.tone(note(81) * k, 1.2 - i * .3, .12 / (i + 1), 'sine')); break;
      case 'cheer': [0, 4, 7, 12].forEach((s, i) => this.tone(note(72 + s), .3, .1, 'triangle', i * .09)); this.noise(.8, .06, 'bandpass', 1500, 2000, .1, .6); break;
      case 'fanfare': [[67, 0], [72, .14], [76, .28], [79, .42], [76, .62], [79, .76]].forEach(([n, a]) => { this.tone(note(n), .28, .1, 'triangle', a); this.tone(note(n - 12), .28, .05, 'sine', a); }); break;
      case 'pop': this.noise(.5, .16, 'lowpass', 3000, 200, 0, .6, true); for (let i = 0; i < 6; i++) this.noise(.05, .04, 'highpass', 4000, 6000, .15 + i * .07 * Math.random(), 1); break;
      case 'fail': this.tone(330, .25, .12, 'triangle', 0, .7); this.tone(247, .4, .12, 'triangle', .22, .6); break;
      case 'meh': this.tone(440, .15, .08, 'triangle'); this.tone(370, .25, .08, 'triangle', .14); break;
    }
  }
}
