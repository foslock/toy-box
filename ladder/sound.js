// Ladder: sound, all made with Web Audio. Wind that rises with height, cicadas near the ground, the knock of each
// rung, a creak when the ladder strains, and thuds that sound like what you hit.

export class Sound {
  constructor() { this.on = true; this.ac = null; this.creakG = null; this.slideG = null; }
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ac = this.ac = new AC();
    this.master = ac.createGain(); this.master.gain.value = this.on ? 0.8 : 0; this.master.connect(ac.destination);
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // wind: two slow-swelling noise bands
    const wind = this.loop(); const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 420; wf.Q.value = 0.6;
    this.windG = ac.createGain(); this.windG.gain.value = 0.02; wind.connect(wf); wf.connect(this.windG); this.windG.connect(this.master); this.windF = wf;
    // cicadas: a buzzing high band, pulsed
    const cic = this.loop(); const cf = ac.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 5200; cf.Q.value = 6;
    const cAm = ac.createGain(); cAm.gain.value = 0; const lfo = ac.createOscillator(); lfo.frequency.value = 38; const lg = ac.createGain(); lg.gain.value = 0.5;
    lfo.connect(lg); lg.connect(cAm.gain); lfo.start();
    this.cicG = ac.createGain(); this.cicG.gain.value = 0.0; cic.connect(cf); cf.connect(cAm); cAm.connect(this.cicG); this.cicG.connect(this.master);
    // the creak: a buzzy tone through a narrow band that wanders
    const co = ac.createOscillator(); co.type = 'sawtooth'; co.frequency.value = 95;
    const cfm = ac.createOscillator(); cfm.frequency.value = 7; const cfg = ac.createGain(); cfg.gain.value = 30; cfm.connect(cfg); cfg.connect(co.frequency); cfm.start();
    const cb = ac.createBiquadFilter(); cb.type = 'bandpass'; cb.frequency.value = 900; cb.Q.value = 9; this.creakF = cb;
    this.creakG = ac.createGain(); this.creakG.gain.value = 0; co.connect(cb); cb.connect(this.creakG); this.creakG.connect(this.master); co.start();
    // the scrape of a foot sliding
    const sl = this.loop(); const sf = ac.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1800; sf.Q.value = 1.4;
    this.slideG = ac.createGain(); this.slideG.gain.value = 0; sl.connect(sf); sf.connect(this.slideG); this.slideG.connect(this.master);
    this.crowAt = ac.currentTime + 8;
  }
  loop() { const s = this.ac.createBufferSource(); s.buffer = this.noise; s.loop = true; s.loopStart = Math.random(); s.start(); return s; }
  setOn(on) { this.on = on; if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ac.currentTime, 0.05); }

  // every frame: height for wind and insects, strain for the creak, foot speed for the scrape
  update(height, strain, slide) {
    if (!this.ac) return;
    const t = this.ac.currentTime, h = Math.max(0, height);
    this.windG.gain.setTargetAtTime(0.012 + Math.min(0.06, h * 0.0011) * (0.7 + 0.3 * Math.sin(t * 0.21) * Math.sin(t * 0.13)), t, 0.4);
    this.windF.frequency.setTargetAtTime(300 + 200 * Math.sin(t * 0.17) + h * 3, t, 0.5);
    this.cicG.gain.setTargetAtTime(Math.max(0, 0.022 - h * 0.0006) * (0.6 + 0.4 * Math.sin(t * 0.4)), t, 0.6);
    const c = Math.max(0, Math.min(1, (strain - 0.8) / 0.2));
    this.creakG.gain.setTargetAtTime(c * 0.05, t, 0.04); this.creakF.frequency.setTargetAtTime(700 + c * 600 + Math.sin(t * 9) * 150, t, 0.05);
    this.slideG.gain.setTargetAtTime(Math.min(0.12, slide * 0.15), t, 0.03);
    if (t > this.crowAt) { this.crowAt = t + 14 + Math.random() * 20; this.crow(); }
  }

  hit(f0, dur, gain, type = 'sine', drop = 0.5, at = 0) {
    const ac = this.ac, t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f0 * drop), t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  burst(freq, q, dur, gain, at = 0, type = 'bandpass') {
    const ac = this.ac, t = ac.currentTime + at, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  // a knock on the material: metal rings, wood knocks, enamel clanks, cloth thumps
  knock(mat, v) {
    if (!this.ac) return;
    const k = Math.min(1, v / 6);
    switch (mat) {
      case 'metal': this.hit(180 + Math.random() * 40, 0.5, 0.12 * k, 'triangle', 0.95); this.hit(470 + Math.random() * 60, 0.35, 0.06 * k, 'sine', 0.98); this.burst(2400, 1, 0.08, 0.1 * k); break;
      case 'enamel': this.hit(620, 0.25, 0.09 * k, 'triangle', 0.97); this.hit(1350, 0.18, 0.04 * k); this.burst(3000, 2, 0.05, 0.08 * k); break;
      case 'gloss': this.hit(880, 0.4, 0.05 * k, 'sine', 1); this.hit(140, 0.25, 0.12 * k, 'sine', 0.6); break;
      case 'soft': this.burst(260, 1, 0.12, 0.25 * k, 0, 'lowpass'); break;
      case 'rubber': this.hit(110, 0.18, 0.18 * k, 'sine', 0.5); this.burst(500, 1, 0.06, 0.08 * k, 0, 'lowpass'); break;
      case 'wood': this.hit(240, 0.12, 0.14 * k, 'triangle', 0.7); this.burst(1200, 3, 0.05, 0.12 * k); break;
      default: this.burst(420, 0.8, 0.16, 0.25 * k, 0, 'lowpass'); this.hit(90, 0.2, 0.15 * k, 'sine', 0.5);
    }
  }
  rung(s, fast) { if (!this.ac) return; this.hit(300 + s * 40 + Math.random() * 20, 0.06, fast ? 0.1 : 0.07, 'triangle', 0.6); this.burst(1500 + s * 120, 4, 0.03, fast ? 0.09 : 0.05); }
  step(mat) { if (!this.ac) return; this.burst(mat === 'metal' ? 1600 : mat === 'enamel' ? 2200 : 700, 1.2, 0.05, mat === 'dirt' ? 0.08 : 0.05, 0, 'bandpass'); if (mat === 'metal' || mat === 'enamel') this.hit(mat === 'metal' ? 260 : 600, 0.08, 0.03, 'triangle', 0.95); }
  plant() { if (!this.ac) return; this.hit(210, 0.1, 0.16, 'triangle', 0.6); this.burst(1300, 3, 0.06, 0.1); this.burst(900, 2, 0.12, 0.05, 0.06); }
  lift() { if (!this.ac) return; this.burst(1100, 2, 0.12, 0.05); }
  haul() { if (!this.ac) return; for (let i = 0; i < 4; i++) { this.burst(1000 + i * 90, 2, 0.12, 0.06, i * 0.22); this.hit(250, 0.05, 0.05, 'triangle', 0.7, i * 0.22 + 0.1); } }
  oof() {
    if (!this.ac) return;
    const ac = this.ac, t = ac.currentTime, o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.22);
    f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(f); f.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.3);
  }
  sigh() {
    if (!this.ac) return;
    const ac = this.ac, t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = this.noise; f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(1300, t); f.frequency.exponentialRampToValueAtTime(500, t + 1.1);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + 1.3);
  }
  creakOnce() { if (!this.ac) return; this.hit(140, 0.25, 0.05, 'sawtooth', 1.3); }
  chime(up = true) { if (!this.ac) return; const n = up ? [659, 880] : [523, 440]; n.forEach((f, i) => { this.hit(f, 0.6, 0.06, 'sine', 1, i * 0.12); this.hit(f * 2, 0.3, 0.015, 'sine', 1, i * 0.12); }); }
  crow() { if (!this.ac) return; for (let i = 0; i < 2 + (Math.random() * 2 | 0); i++) { this.hit(700 + Math.random() * 80, 0.18, 0.012, 'sawtooth', 0.7, i * 0.32); this.burst(1200, 3, 0.16, 0.01, i * 0.32); } }
  win() { if (!this.ac) return; [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.hit(f, 0.9, 0.06, 'sine', 1, i * 0.18)); }
  scratch() { if (!this.ac) return; const ac = this.ac, t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = this.noise; s.playbackRate.setValueAtTime(0.3, t); s.playbackRate.linearRampToValueAtTime(2.2, t + 0.25); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1.5; g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + 0.4); }
}
