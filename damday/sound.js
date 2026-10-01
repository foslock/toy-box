// Everything you hear is made here with Web Audio: bells, the dam's groan, the siren, the water, and the music.
import { BREAK } from './util.js';
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.amb = null; this.chirpAt = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); this.build();
  }
  build() {
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.8 : 0;
    const comp = c.createDynamicsCompressor(); this.master.connect(comp); comp.connect(c.destination);
    // a second of noise, looped, for water and wind
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = buf;
    // the music's bus, with a soft echo behind it
    this.mbus = c.createGain(); this.mbus.gain.value = 0; this.mbus.connect(this.master);
    this.mdelay = c.createDelay(1); this.mdelay.delayTime.value = 0.375; const fb = c.createGain(), lp = c.createBiquadFilter(); fb.gain.value = 0.3; lp.type = 'lowpass'; lp.frequency.value = 2200;
    this.mdelay.connect(lp); lp.connect(fb); fb.connect(this.mdelay); lp.connect(this.mbus);
    // the river, always, very quietly
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6; this.riverG = c.createGain(); this.riverG.gain.value = 0.025; src.connect(f); f.connect(this.riverG); this.riverG.connect(this.master); src.start();
  }
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? 0.8 : 0, this.ctx.currentTime, 0.05); }
  ok() { return this.ctx && this.on; }
  tone(freq, dur, type = 'sine', vol = 0.1, when = 0, to = null) {
    if (!this.ok()) return; const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, vol, freq = 800, type = 'lowpass', when = 0, rampTo = null) {
    if (!this.ok()) return; const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); if (rampTo) f.frequency.exponentialRampToValueAtTime(rampTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.05);
  }
  bell(vol = 0.16, base = 330) { for (const [m, v, d] of [[1, 1, 3.2], [2.01, .6, 2.4], [2.76, .4, 1.8], [4.07, .25, 1.2], [5.4, .15, .8]]) this.tone(base * m, d, 'sine', vol * v * .5); }
  chime(n) { this.bell(0.12, 392); }
  blip(k = 0) { this.tone(520 + (k % 5) * 40, 0.045, 'square', 0.025); }
  step() { this.noise(0.05, 0.02, 500, 'bandpass'); }
  door() { this.tone(200, 0.08, 'triangle', 0.08); this.tone(150, 0.1, 'triangle', 0.06, 0.07); }
  learn() { [660, 880, 1320].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.06, i * 0.07)); }
  item() { this.tone(740, 0.1, 'triangle', 0.07); this.tone(990, 0.16, 'triangle', 0.06, 0.08); }
  groan(level) {
    if (!this.ok()) return; const c = this.ctx, t = c.currentTime, d = level === 3 ? 5.2 : level === 2 ? 4 : 3, v = level === 3 ? 0.5 : level === 2 ? 0.3 : 0.18;
    for (const [f0, f1, type, m] of [[46, 31, 'sawtooth', 1], [69, 44, 'sawtooth', .5], [92, 58, 'square', .25]]) {
      const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1 * (level === 3 ? .8 : 1), t + d); lp.type = 'lowpass'; lp.frequency.value = 220 + level * 90;
      lfo.frequency.value = 5 + level * 2; lg.gain.value = 3 + level * 2; lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * m, t + d * 0.35); g.gain.linearRampToValueAtTime(v * m * .85, t + d * .7); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(lp); lp.connect(g); g.connect(this.master); o.start(t); lfo.start(t); o.stop(t + d + .1); lfo.stop(t + d + .1);
    }
    this.noise(d, v * .5, 160, 'lowpass', 0, 60);
    if (level === 3) { this.noise(1.2, .3, 3000, 'highpass', 3.4); }
  }
  burst() { this.noise(2.5, 0.6, 4000, 'lowpass', 0, 200); this.tone(60, 1.6, 'sawtooth', .3, 0, 25); }
  flood() { this.noise(15, 0.55, 500, 'lowpass', 0.3, 1400); this.noise(15, .2, 120, 'lowpass', 0, 60); }
  siren() { for (let i = 0; i < 4; i++) { this.tone(440, 1.4, 'sawtooth', 0.07, i * 1.5, 760); this.tone(760, 1.4, 'sawtooth', 0.07, i * 1.5 + 1.4, 440); } }
  decree() { [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.5, 'triangle', .08, i * .09)); }
  rewind() { if (!this.ok()) return; this.tone(1200, 1.6, 'sine', .06, 0, 90); for (let i = 0; i < 6; i++) this.tone(900 - i * 90, .05, 'square', .03, i * .22); this.noise(1.5, .05, 3000, 'bandpass', 0, 400); }
  win() { [262, 330, 392, 523, 659].forEach((f, i) => this.tone(f, 2.6, 'sine', .07, i * .3)); this.bell(.2, 262); }
  chirp() { const f = 2200 + Math.random() * 1600; this.tone(f, .07, 'sine', .018); this.tone(f * 1.2, .06, 'sine', .015, .09); if (Math.random() < .5) this.tone(f * .9, .05, 'sine', .012, .18); }
  // ambient life, from the page's clock: bird calls while the day is calm, the river hushed when the dam begins to groan
  ambient(t, calm) {
    if (!this.ok()) return; const now = this.ctx.currentTime;
    if (this.riverG) this.riverG.gain.setTargetAtTime(calm ? 0.025 : 0.01, now, 0.5);
    if (calm && now > this.chirpAt) { this.chirp(); this.chirpAt = now + 1.5 + Math.random() * 4; }
  }

  /* ------------------------------------------------------------------------------------------------- the music
     Sparse and calm to begin with: a soft pad and now and then a note. Each minute adds a little (a bass, then a kalimba
     arpeggio and a shaker). For the last thirty seconds before the flood it turns into something fast and tense in a
     minor key: a kick on every beat, a driving bass, sixteenth-note arpeggios, a siren-like riser. It is all scheduled a
     moment ahead from the game clock, so it follows the loop. */
  mv(type, freq, when, dur, vol, a = 0.005, lp = 4000, send = 0.3) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = lp;
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(vol, when + a); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(f); f.connect(g); g.connect(this.mbus); if (send) { const sg = c.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(this.mdelay); }
    o.start(when); o.stop(when + dur + 0.05);
  }
  mpad(type, freq, when, dur, vol, lp = 900) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(), a = Math.min(1.2, dur * 0.3), r = Math.min(1.4, dur * 0.4);
    o.type = type; o.frequency.value = freq; o.detune.value = (freq % 7) - 3; f.type = 'lowpass'; f.frequency.value = lp;
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(vol, when + a); g.gain.setValueAtTime(vol, when + dur - r); g.gain.linearRampToValueAtTime(0.0001, when + dur);
    o.connect(f); f.connect(g); g.connect(this.mbus); o.start(when); o.stop(when + dur + 0.05);
  }
  mkick(when, vol) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(135, when); o.frequency.exponentialRampToValueAtTime(42, when + 0.13); g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.24); o.connect(g); g.connect(this.mbus); o.start(when); o.stop(when + 0.3); }
  mnoise(when, dur, vol, type, freq, q = 1) { const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noiseBuf; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.0001, when + dur); s.connect(f); f.connect(g); g.connect(this.mbus); s.start(when); s.stop(when + dur + 0.05); }
  riser(when, dur) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(), n = c.createBufferSource(), ng = c.createGain(), nf = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(110, when); o.frequency.exponentialRampToValueAtTime(660, when + dur); f.type = 'lowpass'; f.frequency.setValueAtTime(300, when); f.frequency.exponentialRampToValueAtTime(2600, when + dur);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.07, when + dur); g.gain.linearRampToValueAtTime(0.0001, when + dur + 0.1);
    o.connect(f); f.connect(g); g.connect(this.mbus); o.start(when); o.stop(when + dur + 0.2);
    n.buffer = this.noiseBuf; n.loop = true; nf.type = 'bandpass'; nf.Q.value = 0.8; nf.frequency.setValueAtTime(500, when); nf.frequency.exponentialRampToValueAtTime(6000, when + dur);
    ng.gain.setValueAtTime(0.0001, when); ng.gain.linearRampToValueAtTime(0.12, when + dur); ng.gain.linearRampToValueAtTime(0.0001, when + dur + 0.1); n.connect(nf); nf.connect(ng); ng.connect(this.mbus); n.start(when); n.stop(when + dur + 0.2);
  }
  musicUpdate(t, on) {
    if (!this.ok() || !this.mbus) return;
    const c = this.ctx, m = this.mu || (this.mu = { next: 0, step: 0, sec: -1, playing: false }), now = c.currentTime;
    const want = on && t < BREAK;
    if (!want) { if (m.playing) { m.playing = false; m.sec = -1; this.mbus.gain.cancelScheduledValues(now); this.mbus.gain.setValueAtTime(this.mbus.gain.value, now); this.mbus.gain.linearRampToValueAtTime(0.0001, now + (t >= BREAK ? 0.6 : 1.2)); } return; }
    if (!m.playing) { m.playing = true; m.next = now + 0.15; m.step = 0; m.sec = -1; this.mbus.gain.cancelScheduledValues(now); this.mbus.gain.setValueAtTime(0.0001, now); }
    if (m.next < now - 0.1) m.next = now + 0.05;
    let guard = 0;
    while (m.next < now + 0.35 && guard++ < 12) this.musicStep(m, t);
  }
  musicStep(m, t) {
    const sec = t < 60 ? 0 : t < 120 ? 1 : t < 195 ? 2 : 3;
    if (sec !== m.sec) {
      m.sec = sec; m.step = 0;
      this.mbus.gain.setTargetAtTime([1.1, 1.2, 1.3, 1.2][sec], this.ctx.currentTime, sec === 3 ? 0.6 : 1.1);
      if (sec === 3) this.riser(Math.max(m.next, this.ctx.currentTime), Math.max(2, BREAK - t));
    }
    const bpm = sec === 3 ? 132 + (t - 195) * 0.8 : [62, 69, 77][sec], d = 30 / bpm, w = m.next, st = m.step, bar = (st / 8) | 0, beat = st % 8;
    const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
    if (sec < 3) {
      // C major pentatonic over C - Am - F - G, the pad changing each bar
      const chords = [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]], roots = [36, 33, 29, 31], ch = chords[bar % 4], root = roots[bar % 4];
      if (beat === 0) for (const n of ch) this.mpad('triangle', mtof(n), w, d * 8.2, [0.028, 0.032, 0.036][sec]);
      const mel = [
        [[0, 76], [6, 79], [10, 74], [16, 72], [22, 76], [28, 79]],
        [[0, 76], [3, 79], [6, 81], [10, 79], [14, 74], [16, 72], [19, 76], [22, 74], [26, 72], [29, 79]],
        [[0, 76], [2, 79], [3, 81], [6, 84], [8, 81], [10, 79], [12, 76], [14, 74], [16, 72], [18, 76], [19, 79], [22, 81], [24, 79], [26, 76], [28, 74], [30, 72]],
      ][sec];
      const pos = st % 32; for (const [p, n] of mel) if (p === pos) { this.mv('triangle', mtof(n), w, 1.8, 0.06 + sec * 0.008, 0.004, 3200, 0.45); this.mv('sine', mtof(n) * 2, w, 0.9, 0.018, 0.004, 5000, 0.4); }
      if (sec >= 1 && (beat === 0 || (sec === 2 && beat === 4))) this.mv('sine', mtof(root), w, d * 3.4, 0.11, 0.02, 400, 0);
      if (sec === 2) {
        const tone = ch[(beat * 2 + (bar % 2)) % 3] + 12; if (beat % 2 === 1 || beat === 0) this.mv('sine', mtof(tone + 12), w, 0.5, 0.022, 0.003, 4000, 0.5);
        if (beat % 2 === 1) this.mnoise(w, 0.05, 0.01, 'highpass', 7500);
      }
    } else {
      // the last thirty seconds: A minor, A - A - F - E, harder and faster as the dam gets closer
      const k = Math.min(1, Math.max(0, (t - 195) / 30)), v = 0.7 + 0.3 * k;
      const roots = [45, 45, 41, 40], arps = [[57, 60, 64, 69], [57, 60, 64, 69], [53, 57, 60, 65], [52, 56, 59, 64]], r = roots[bar % 4], ar = arps[bar % 4];
      if (beat === 0) { this.mpad('sawtooth', mtof(r), w, d * 8.2, 0.034 * v, 420); this.mpad('sawtooth', mtof(r + 7), w, d * 8.2, 0.02 * v, 520); if (bar % 2 === 0) this.mv('sawtooth', mtof(r + 15 + 12), w, d * 3, 0.03 * v, 0.01, 1500, 0.2); }
      if (beat % 2 === 0) this.mkick(w, 0.5 * v);
      if (beat === 2 || beat === 6) { this.mnoise(w, 0.14, 0.09 * v, 'bandpass', 1900, 0.8); this.mv('triangle', 190, w, 0.1, 0.1 * v, 0.002, 900, 0); }
      this.mv('triangle', mtof(r - (beat % 4 === 3 ? 0 : 12)), w, d * 0.9, 0.09 * v, 0.004, 700, 0);
      for (let sub = 0; sub < 2; sub++) { const ww = w + sub * d / 2, n = ar[(beat * 2 + sub + (bar % 2) * 3) % 4] + (((beat * 2 + sub) % 8) > 5 ? 12 : 0); this.mv('square', mtof(n), ww, 0.2, 0.022 * v, 0.003, 2200, 0.25); this.mnoise(ww, 0.03, 0.012 * v, 'highpass', 8000); }
      const lead = [[0, 81], [1, 84], [2, 88], [4, 86], [5, 84], [6, 83], [8, 81], [9, 84], [10, 88], [12, 89], [13, 88], [14, 84]], pos = st % 16;
      for (const [p, n] of lead) if (p === pos) this.mv('sawtooth', mtof(n), w, d * 1.6, 0.04 * v, 0.004, 2800, 0.3);
    }
    m.step++; m.next += d;
  }
}
