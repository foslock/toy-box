// Grip: sea, wind, rain and the small noises of hands on rock. All synthesized.

export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.ready = false; }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.out = ctx.createGain(); this.out.gain.value = this.muted ? 0 : 0.9; this.out.connect(ctx.destination);
    // two seconds of noise, reused by everything
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // brown noise for the surf
    const bb = ctx.createBuffer(1, len, ctx.sampleRate), bd = bb.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    this.brown = bb;
    this.sea = this.loop(bb, 'lowpass', 420, 0);
    this.wind = this.loop(buf, 'bandpass', 700, 0, 0.6);
    this.rain = this.loop(buf, 'highpass', 3200, 0);
    this.rush = this.loop(buf, 'bandpass', 900, 0, 1.2);
    this.ready = true;
  }
  loop(buf, type, f, g, q = 0.7) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const gn = ctx.createGain(); gn.gain.value = g;
    s.connect(fl); fl.connect(gn); gn.connect(this.out); s.start();
    return { f: fl, g: gn };
  }
  setMuted(m) { this.muted = m; if (this.out) this.out.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05); }

  // called every frame with the state of the world
  ambience({ height, wind, gust, storm, fallSpeed, t }) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const surf = Math.max(0, 1 - height / 1600) * (0.22 + 0.16 * Math.max(0, Math.sin(t * 0.55)) ** 3);
    this.sea.g.gain.setTargetAtTime(surf, now, 0.2);
    this.sea.f.frequency.setTargetAtTime(300 + 260 * Math.max(0, Math.sin(t * 0.55)), now, 0.3);
    const w = 0.015 + Math.min(1, height / 3000) * 0.05 + storm * (0.05 + gust * 0.22);
    this.wind.g.gain.setTargetAtTime(w, now, 0.25);
    this.wind.f.frequency.setTargetAtTime(500 + gust * 700 + Math.abs(wind) * 0.4, now, 0.3);
    this.rain.g.gain.setTargetAtTime(storm * 0.05, now, 0.5);
    this.rush.g.gain.setTargetAtTime(Math.min(0.35, Math.max(0, fallSpeed - 250) / 1600), now, 0.06);
    this.rush.f.frequency.setTargetAtTime(600 + fallSpeed * 0.8, now, 0.08);
  }

  burst({ f = 1500, q = 1, dur = 0.08, gain = 0.3, type = 'bandpass', at = 0 }) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime + at, s = ctx.createBufferSource(); s.buffer = this.noise;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  tone({ f = 200, f2 = f, dur = 0.2, gain = 0.3, type = 'sine', at = 0 }) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime + at, o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  }

  grab(kind) {
    const metal = kind === 'rung' || kind === 'mast' || kind === 'top';
    if (metal) { this.tone({ f: 1250 + Math.random() * 200, f2: 1100, dur: 0.18, gain: 0.05, type: 'triangle' }); this.burst({ f: 2600, q: 2, dur: 0.04, gain: 0.12 }); }
    else if (kind === 'rope') this.burst({ f: 500, q: 0.8, dur: 0.12, gain: 0.25 });
    else { this.burst({ f: kind === 'crimp' ? 2400 : 1500, q: 1.2, dur: 0.06, gain: 0.28 }); this.burst({ f: 5000, q: 0.5, dur: 0.18, gain: 0.04, type: 'highpass', at: 0.02 }); }
    this.tone({ f: 140, f2: 90, dur: 0.08, gain: 0.12 });
  }
  release() { this.burst({ f: 900, q: 0.6, dur: 0.1, gain: 0.08 }); }
  land(speed) {
    const g = Math.min(0.7, 0.08 + speed / 1400);
    this.tone({ f: 110, f2: 38, dur: 0.3 + g * 0.3, gain: g });
    this.burst({ f: 700, q: 0.5, dur: 0.18 + g * 0.2, gain: g * 0.5, type: 'lowpass' });
  }
  crumble() { for (let i = 0; i < 7; i++) this.burst({ f: 1200 + Math.random() * 2500, q: 2, dur: 0.05, gain: 0.18, at: i * 0.045 + Math.random() * 0.03 }); this.burst({ f: 400, q: 0.5, dur: 0.5, gain: 0.15, type: 'lowpass', at: 0.05 }); }
  slip() { this.burst({ f: 3000, q: 4, dur: 0.25, gain: 0.08 }); this.tone({ f: 600, f2: 300, dur: 0.25, gain: 0.04, type: 'triangle' }); }
  thunder(dist = 0.5) {
    if (!this.ready) return;
    const at = 0.3 + dist * 1.6;
    this.burst({ f: 180, q: 0.4, dur: 2.6, gain: 0.5 * (1 - dist * 0.6), type: 'lowpass', at });
    this.burst({ f: 90, q: 0.4, dur: 3.5, gain: 0.4 * (1 - dist * 0.5), type: 'lowpass', at: at + 0.2 });
  }
  summit() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone({ f, dur: 2.4, gain: 0.08, type: 'triangle', at: i * 0.16 })); }
  tick() { this.tone({ f: 880, dur: 0.12, gain: 0.05, type: 'triangle' }); }
}
