// The song and the sound effects, synthesized as they're needed. The game's sixteenth-note clock drives the
// music: each instrument only plays when a tower of its part is on the turntable, so the groove fills in as
// you build. Chords and the vinyl crackle are always there underneath.
const LAT = 0.06;   // a frame or so of lookahead, so sixteenths land evenly instead of on frame boundaries
const mtof = m => 440 * 2 ** ((m - 69) / 12);

export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.song = null; this.pop = 0; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.15;
    comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(comp);
    // a warm lowpass over everything, like it's coming out of one old speaker
    this.tone = ctx.createBiquadFilter(); this.tone.type = 'lowpass'; this.tone.frequency.value = 9000; this.tone.Q.value = 0.4;
    this.tone.connect(this.master);
    const len = ctx.sampleRate, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // crackle: sparse clicks and a little hiss, looped
    const cl = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), c = cl.getChannelData(0);
    for (let i = 0; i < c.length; i++) {
      c[i] = (Math.random() * 2 - 1) * 0.03;
      if (Math.random() < 0.0006) { const a = (Math.random() * 0.8 + 0.2) * (Math.random() < 0.5 ? -1 : 1); for (let j = 0; j < 30 && i + j < c.length; j++) c[i + j] += a * Math.exp(-j / 5); }
    }
    const src = ctx.createBufferSource(); src.buffer = cl; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.5;
    this.crackle = ctx.createGain(); this.crackle.gain.value = 0;
    src.connect(f); f.connect(this.crackle); this.crackle.connect(this.master); src.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }
  playing(on) {
    if (!this.ctx) return;
    this.crackle.gain.setTargetAtTime(on ? 0.5 : 0.12, this.ctx.currentTime, 0.2);
  }
  silence() { this.playing(false); }

  // seconds from now → audio clock
  at(t) { return this.ctx ? Math.max(this.ctx.currentTime, this.ctx.currentTime + t) : 0; }

  // ---------- one sixteenth of the song
  step(song, s, levels, when) {
    if (!this.ctx) return;
    const t = this.at(when);
    const hit = (part) => levels[part] && (levels[part] >= 3 ? song[part + 'X'] : song[part])[s] === 'x';
    if (hit('kick')) this.kick(t);
    if (hit('snare')) this.snare(t);
    if (hit('hat')) this.hat(t, s % 4 === 2);
    if (levels.bass) { const n = (levels.bass >= 3 ? song.bassX : song.bass)[s]; if (n) this.bass(t, n, song); }
    if (song.stab[s] === 'x') this.chord(t, song.chords[Math.floor(s / 16) % song.chords.length], song);
  }

  kick(t) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.7, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    o.connect(g); g.connect(this.tone); o.start(t); o.stop(t + 0.4);
    this.burst(t, 'lowpass', 1800, 0.012, 0.25);
  }
  snare(t) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(this.tone); o.start(t); o.stop(t + 0.12);
    this.burst(t, 'bandpass', 2200, 0.17, 0.5, 0.8);
  }
  hat(t, open) { this.burst(t, 'highpass', 7500, open ? 0.12 : 0.04, open ? 0.16 : 0.2); }
  bass(t, n, song) {
    const ctx = this.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    const fr = mtof(n), len = song.bpm > 125 ? 0.22 : 0.32;
    o.type = 'sawtooth'; o.frequency.value = fr; o2.type = 'sine'; o2.frequency.value = fr;
    f.type = 'lowpass'; f.Q.value = 6; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(160, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.26, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + len + 0.08);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.tone);
    o.start(t); o2.start(t); o.stop(t + len + 0.1); o2.stop(t + len + 0.1);
  }
  chord(t, notes, song) {
    const dur = song.pad ? 2.2 : 0.6, vol = song.pad ? 0.09 : 0.12;
    for (const n of notes) {
      const ctx = this.ctx, o = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
      o.type = song.pad ? 'triangle' : 'sine'; o.frequency.value = mtof(n) * (1 + (Math.random() - 0.5) * 0.004);
      // a touch of FM for an electric-piano bell
      m.frequency.value = mtof(n) * 2; mg.gain.setValueAtTime(mtof(n) * 0.9, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.4);
      m.connect(mg); mg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (song.pad ? 0.25 : 0.006)); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g); g.connect(this.tone); o.start(t); m.start(t); o.stop(t + dur + 0.05); m.stop(t + dur + 0.05);
    }
  }

  burst(t, type, freq, dur, vol, q = 0.7) {
    const ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise; src.playbackRate.value = 0.9 + Math.random() * 0.2;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.tone); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  note(f, when = 0, dur = 0.3, vol = 0.12, type = 'triangle') {
    if (!this.ctx) return;
    const ctx = this.ctx, t = this.at(when), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.tone); o.start(t); o.stop(t + dur + 0.05);
  }

  // ---------- effects
  popKill(song, when) {
    // a little bell in the song's key, stepping up the scale with each pop in a row
    if (!this.ctx) return;
    this.pop = (this.pop + 1 + (Math.random() < 0.3 ? 1 : 0)) % song.scale.length;
    this.note(mtof(song.scale[this.pop] + 12), when + LAT, 0.25, 0.1, 'sine');
  }
  leak() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise; src.playbackRate.setValueAtTime(1.6, t); src.playbackRate.linearRampToValueAtTime(0.4, t + 0.28);
    f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.28);
    g.gain.setValueAtTime(2.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    src.connect(f); f.connect(g); g.connect(this.master);
    this.note(110, 0, 0.25, 0.25, 'sawtooth'); src.start(t); src.stop(t + 0.35);
    // and the song ducks for a moment, like the needle jumped
    this.tone.frequency.cancelScheduledValues(t);
    this.tone.frequency.setValueAtTime(700, t); this.tone.frequency.exponentialRampToValueAtTime(9000, t + 0.6);
  }
  place() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(t, 'lowpass', 600, 0.1, 1.4);
    this.note(1318, 0.03, 0.18, 0.09, 'square');
  }
  upgrade() { this.note(988, 0, 0.2, 0.08, 'square'); this.note(1480, 0.08, 0.3, 0.08, 'square'); }
  sell() { this.note(1175, 0, 0.12, 0.07, 'square'); this.note(880, 0.07, 0.2, 0.06, 'square'); }
  nope() { this.note(196, 0, 0.18, 0.1, 'sawtooth'); }
  tick() { if (this.ctx) this.burst(this.ctx.currentTime, 'highpass', 3000, 0.02, 0.15); }
  drop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(t, 'lowpass', 300, 0.25, 0.9);
    this.burst(t + 0.02, 'bandpass', 2600, 0.12, 0.3);
  }
  cleared() { [0, 4, 7, 12].forEach((n, i) => this.note(mtof(72 + n), i * 0.09, 0.4, 0.07, 'sine')); }
  won() { [0, 4, 7, 11, 14].forEach((n, i) => this.note(mtof(60 + n), i * 0.12, 1.6, 0.07, 'triangle')); }
  lost() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.4);
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    o.connect(g); g.connect(this.tone); o.start(t); o.stop(t + 1.6);
  }
}
export { LAT };
