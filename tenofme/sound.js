// Everything you hear is made here with Web Audio: soft steps, plates, doors, the alarm, the rewind, a brushed
// clock that hurries in the last seconds, and a slow walking bass under it all.
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.nextBeat = 0; this.beat = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.7 : 0;
    const comp = c.createDynamicsCompressor(); this.master.connect(comp); comp.connect(c.destination);
    const buf = c.createBuffer(1, c.sampleRate, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = buf;
    // rain on the skylights, very quietly
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const g = c.createGain(); g.gain.value = 0.012; src.connect(f); f.connect(g); g.connect(this.master); src.start();
  }
  setOn(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? 0.7 : 0, this.ctx.currentTime, 0.05); }
  ok() { return this.ctx && this.on && this.ctx.state === 'running'; }
  tone(freq, dur, type = 'sine', vol = 0.1, when = 0, to = null) {
    if (!this.ok()) return; const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, vol, freq = 800, type = 'lowpass', when = 0) {
    if (!this.ok()) return; const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.01, dur * .2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.05);
  }
  step() { this.noise(0.04, 0.03, 900, 'bandpass'); }
  plate(on) { this.tone(on ? 330 : 247, 0.08, 'triangle', 0.06); }
  door(open) { this.noise(0.25, 0.05, open ? 500 : 300, 'lowpass'); this.tone(open ? 110 : 90, 0.22, 'sawtooth', 0.025, 0, open ? 140 : 70); }
  pick(jewel) { if (jewel) [988, 1319, 1760, 2349].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.05, i * 0.05)); else { this.tone(1400, 0.06, 'square', 0.03); this.tone(1800, 0.08, 'square', 0.025, 0.05); } }
  drop() { this.tone(300, 0.06, 'triangle', 0.05); }
  unlock() { this.noise(0.05, 0.06, 2000, 'bandpass'); this.tone(600, 0.05, 'square', 0.04, 0.06); this.tone(400, 0.12, 'triangle', 0.06, 0.1); }
  spot() { this.tone(880, 0.1, 'square', 0.05); this.tone(1175, 0.18, 'square', 0.05, 0.09); }
  caught() { this.tone(220, 0.25, 'sawtooth', 0.05, 0, 110); this.noise(0.08, 0.06, 1200, 'bandpass', 0.05); }
  freeze() { for (let i = 0; i < 4; i++) this.tone(200 + Math.random() * 900, 0.03, 'square', 0.03, i * 0.035); }
  alarm() { for (let i = 0; i < 6; i++) { this.tone(960, 0.18, 'square', 0.06, i * 0.36); this.tone(720, 0.18, 'square', 0.06, i * 0.36 + 0.18); } }
  rewind() { this.tone(1500, 0.8, 'sine', 0.05, 0, 120); for (let i = 0; i < 8; i++) this.noise(0.04, 0.05, 3000 - i * 250, 'bandpass', i * 0.09); }
  start() { this.tone(523, 0.08, 'triangle', 0.05); this.tone(784, 0.12, 'triangle', 0.05, 0.07); }
  win() { [262, 330, 392, 494, 587].forEach((f, i) => this.tone(f, 1.6, 'triangle', 0.05, i * 0.09)); this.tone(131, 2, 'sine', 0.1, 0); }
  // the clock, ticking louder in the last five seconds; a walking bass while a run is on
  update(g, running) {
    if (!this.ok()) return;
    const c = this.ctx;
    if (!running) { this.nextBeat = 0; return; }
    if (!this.nextBeat || this.nextBeat < c.currentTime - 0.2) this.nextBeat = c.currentTime + 0.05;
    while (this.nextBeat < c.currentTime + 0.1) {
      const when = this.nextBeat - c.currentTime, k = this.beat++, left = 30 - g.t;
      const BASS = [55, 65.4, 73.4, 77.8, 82.4, 77.8, 73.4, 65.4, 49, 58.3, 65.4, 73.4, 77.8, 73.4, 65.4, 58.3];
      this.tone(BASS[k % 16], 0.42, 'triangle', 0.09, when);
      if (k % 2 === 1) this.noise(0.09, 0.012, 6000, 'highpass', when);
      if (left < 5.5) this.tone(k % 2 ? 1600 : 2000, 0.03, 'square', 0.03, when);
      this.nextBeat += left < 5.5 ? 0.25 : 0.4;
    }
  }
}
