// Paper sounds, all made on the fly: the pencil scratching, the sled hissing along a line, the wind when you're
// in the air, a two-note chime for a gate, a crumple for a tumble.
export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.drawAmt = 0; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const loop = (type, f, q) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      src.playbackRate.value = 0.7 + Math.random() * 0.6;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(fl); fl.connect(g); g.connect(this.master); src.start();
      return { fl, g };
    };
    this.scratch = loop('bandpass', 3400, 1.4);
    this.hiss = loop('bandpass', 900, 0.8);
    this.air = loop('lowpass', 500, 0.5);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  // called every frame with how fast the pencil moved (screen px/s) and the sled's state
  update(drawSpeed, rider, riding) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const sp = Math.hypot(rider.vx, rider.vy);
    const want = Math.min(1, drawSpeed / 900);
    this.drawAmt += (want - this.drawAmt) * 0.35;
    this.scratch.g.gain.setTargetAtTime(this.drawAmt * 0.32 * (0.75 + Math.random() * 0.5), t, 0.02);
    this.scratch.fl.frequency.setTargetAtTime(2600 + this.drawAmt * 2200 + Math.random() * 600, t, 0.03);
    const on = riding && rider.ground;
    this.hiss.g.gain.setTargetAtTime(on ? Math.min(0.2, sp / 3500) : 0, t, 0.05);
    this.hiss.fl.frequency.setTargetAtTime(500 + sp * 1.4, t, 0.1);
    this.air.g.gain.setTargetAtTime(riding && !rider.ground ? Math.min(0.22, sp / 3000) : 0, t, 0.12);
    this.air.fl.frequency.setTargetAtTime(300 + sp * 0.8, t, 0.1);
  }

  silence() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const l of [this.scratch, this.hiss, this.air]) l.g.gain.setTargetAtTime(0, t, 0.05);
  }

  note(f, when = 0, dur = 0.5, vol = 0.2, type = 'triangle') {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }

  burst(dur, f, vol, type = 'bandpass', when = 0, q = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  gate() { this.note(784, 0, 0.45, 0.16); this.note(1175, 0.09, 0.6, 0.15); }
  miss() { this.note(330, 0, 0.25, 0.08, 'square'); }
  style(kind) {
    if (kind === 'loops') [523, 659, 784, 1047].forEach((f, i) => this.note(f, i * 0.07, 0.4, 0.13));
    else if (kind === 'air') [587, 880].forEach((f, i) => this.note(f, i * 0.06, 0.3, 0.1));
    else if (kind === 'close') this.note(988, 0, 0.18, 0.08, 'sine');
  }
  land(impact) { const v = Math.min(0.5, impact / 1600); if (v > 0.06) { this.burst(0.12, 220, v, 'lowpass'); this.note(90, 0, 0.15, v * 0.6, 'sine'); } }
  crash() {
    // crumpled paper: a run of short crackles
    for (let i = 0; i < 14; i++) this.burst(0.05 + Math.random() * 0.08, 1200 + Math.random() * 3000, 0.25 + Math.random() * 0.25, 'bandpass', i * 0.035 + Math.random() * 0.02, 2);
    this.burst(0.4, 400, 0.25, 'lowpass');
  }
  dry() { this.burst(0.04, 5000, 0.08, 'highpass'); }
  go() { this.burst(0.25, 1800, 0.12, 'bandpass'); }
  page() { this.burst(0.35, 2400, 0.12, 'bandpass', 0, 0.7); }
}
