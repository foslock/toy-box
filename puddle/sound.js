// Puddle: rain on the street, all synthesized. A bed of rain that thickens and thins with the weather,
// plops and splashes, a ratchet on the reel, a temple bell on the hour, and a few plucked notes
// now and then, like someone practising the koto in a flat upstairs.

const PENTA = [0, 2, 5, 7, 9, 12, 14, 17]; // a soft in-scale run (no semitones)

export class Sound {
  constructor() { this.ctx = null; this.on = true; this.master = null; this.rainLevel = 0.5; this.nextNote = 4; }

  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.85 : 0;
    this.master.connect(c.destination);
    // echo send, for plucks and the bell
    this.echo = c.createDelay(1); this.echo.delayTime.value = 0.34;
    const fb = c.createGain(); fb.gain.value = 0.32; const eg = c.createGain(); eg.gain.value = 0.5;
    const elp = c.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 2200;
    this.echo.connect(elp); elp.connect(fb); fb.connect(this.echo); elp.connect(eg); eg.connect(this.master);
    // rain: white noise, high-passed, in two layers (hiss and patter)
    const len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    this.rain = c.createGain(); this.rain.gain.value = 0;
    src.connect(hp); hp.connect(lp); lp.connect(this.rain); this.rain.connect(this.master); src.start();
    const src2 = c.createBufferSource(); src2.buffer = buf; src2.loop = true; src2.playbackRate.value = 0.5;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
    this.rumble = c.createGain(); this.rumble.gain.value = 0;
    src2.connect(bp); bp.connect(this.rumble); this.rumble.connect(this.master); src2.start();
    this.setWeather(this.weather ?? 0);
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setOn(on) { this.on = on; if (this.master) this.master.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.05); }

  setWeather(w) {
    this.weather = w;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const [hiss, rum] = w === 1 ? [0.11, 0.2] : w === 0 ? [0.045, 0.06] : [0.008, 0.012];
    this.rain.gain.setTargetAtTime(hiss, t, 1.2);
    this.rumble.gain.setTargetAtTime(rum, t, 1.2);
  }

  tone(freq, t0, dur, vol, type = 'sine', glide = 0, send = 0) {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    if (send) { const s = c.createGain(); s.gain.value = send; g.connect(s); s.connect(this.echo); }
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  burst(t0, dur, vol, f, q = 1, type = 'bandpass') {
    const c = this.ctx; if (!c) return;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const bp = c.createBiquadFilter(); bp.type = type; bp.frequency.value = f; bp.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(bp); bp.connect(g); g.connect(this.master); s.start(t0, Math.random() * 2, dur + 0.05);
  }
  // a plucked string: a bright triangle with a quick fall and a faint octave
  pluck(freq, t0, vol = 0.12) {
    this.tone(freq, t0, 1.4, vol, 'triangle', 0, 0.5);
    this.tone(freq * 2, t0, 0.5, vol * 0.3, 'sine', 0, 0.3);
    this.tone(freq * 1.003, t0, 0.08, vol * 0.6, 'square', 0.98);
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  whoosh() { if (!this.ctx) return; this.burst(this.now, 0.3, 0.08, 1800, 0.7); }
  plop() { if (!this.ctx) return; const t = this.now; this.tone(420, t, 0.16, 0.25, 'sine', 0.45); this.burst(t, 0.18, 0.12, 2400, 1.2); }
  nibble() { if (!this.ctx) return; const t = this.now; this.tone(900, t, 0.05, 0.1, 'sine', 0.7); this.tone(1200, t + 0.06, 0.04, 0.06, 'sine', 0.7); }
  bite() { if (!this.ctx) return; const t = this.now; this.tone(160, t, 0.3, 0.4, 'sine', 0.5); this.burst(t, 0.45, 0.3, 1500, 0.6); this.tone(1320, t + 0.02, 0.18, 0.08, 'triangle', 1, 0.4); }
  hook() { if (!this.ctx) return; const t = this.now; this.burst(t, 0.2, 0.2, 900, 1); this.tone(220, t, 0.2, 0.2, 'triangle', 1.5); }
  click(T) { if (!this.ctx) return; this.burst(this.now, 0.025, 0.06 + T * 0.08, 3000 + T * 2000, 6); }
  strain() { if (!this.ctx) return; this.tone(1800 + Math.random() * 200, this.now, 0.06, 0.03, 'sawtooth', 1.1); }
  snap() { if (!this.ctx) return; const t = this.now; this.tone(1400, t, 0.35, 0.2, 'sawtooth', 0.25); this.burst(t, 0.1, 0.3, 4000, 2); }
  slip() { if (!this.ctx) return; const t = this.now; this.burst(t, 0.5, 0.12, 700, 0.6); this.tone(330, t, 0.4, 0.08, 'sine', 0.6); }
  spook() { if (!this.ctx) return; const t = this.now; this.burst(t, 0.25, 0.14, 1200, 0.8); this.tone(600, t, 0.2, 0.06, 'sine', 0.5); }
  step() { if (!this.ctx) return; const t = this.now; for (let i = 0; i < 3; i++) this.burst(t + i * 0.22, 0.12, 0.08, 900 + i * 80, 1.5); }
  catchTune(isNew, rare) {
    if (!this.ctx) return;
    const t = this.now + 0.05, base = 392;
    const run = isNew ? [0, 2, 4, 5, 7] : [0, 4];
    run.forEach((k, i) => this.pluck(base * Math.pow(2, PENTA[k] / 12), t + i * 0.11, 0.13));
    if (rare) this.bell(base * 2, t + 0.6);
  }
  bell(f = 196, t0 = this.now) {
    if (!this.ctx) return;
    [[1, 0.16, 4], [2.76, 0.06, 2.4], [5.4, 0.03, 1.4], [0.5, 0.08, 5]].forEach(([m, v, d]) => this.tone(f * m, t0, d, v, 'sine', 0, 0.35));
  }
  ui() { if (!this.ctx) return; this.tone(660, this.now, 0.08, 0.06, 'triangle'); }

  // now and then, a note or two from upstairs
  tick(dt) {
    if (!this.ctx || !this.on) return;
    this.nextNote -= dt;
    if (this.nextNote > 0) return;
    this.nextNote = 3.5 + Math.random() * 6;
    const t = this.now, base = 196, n = Math.random() < 0.4 ? 2 : 1;
    for (let i = 0; i < n; i++) this.pluck(base * Math.pow(2, PENTA[Math.floor(Math.random() * PENTA.length)] / 12), t + i * 0.32, 0.05);
  }
}
