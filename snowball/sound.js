// Everything you hear, synthesised: the crunch of the snow under the ball and the wind past it, a soft "pomf" for each
// pickup (climbing a scale while you keep picking things up), the voices of what you pick up, bumps and landings, and
// an oom-pah polka that adds instruments and speeds up as the snowball grows.

const NOTE = n => 440 * 2 ** ((n - 69) / 12);
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export class Sound {
  constructor() { this.ctx = null; this.sfxOn = true; this.musicOn = true; this.voices = 0; this.lastSay = {}; }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.init(new AC());
  }

  init(ctx) {
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(comp);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxOn ? 1 : 0; this.sfx.connect(this.master);
    this.mus = ctx.createGain(); this.mus.gain.value = this.musicOn && this.sfxOn ? 0.5 : 0; this.mus.connect(this.master);
    const len = ctx.sampleRate * 2;
    const white = ctx.createBuffer(1, len, ctx.sampleRate), wd = white.getChannelData(0);
    const brown = ctx.createBuffer(1, len, ctx.sampleRate), bd = brown.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; wd[i] = w; b = (b + 0.02 * w) / 1.02; bd[i] = b * 3.5; }
    this.white = white; this.brown = brown;
    // the roll: low rumble plus a crunchy hiss, both following speed
    this.rumble = this.bed(brown, 'lowpass', 180, 0.8);
    this.crunch = this.bed(white, 'bandpass', 1400, 0.9);
    this.wind = this.bed(white, 'bandpass', 600, 0.6);
    this.crunchLfo = 0;
    this.music = new Music(this);
  }

  bed(buf, type, f, q) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(fl); fl.connect(g); g.connect(this.sfx); src.start();
    return { g, fl };
  }

  setMode(sfx, music) {
    this.sfxOn = sfx; this.musicOn = music;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfx.gain.setTargetAtTime(sfx ? 1 : 0, t, 0.05);
    this.mus.gain.setTargetAtTime(sfx && music ? 0.5 : 0, t, 0.1);
  }

  // every frame: how the rolling sounds
  roll(dt, { speed = 0, r = 0.1, ground = true, surf = 0, playing = true }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const on = playing && ground ? 1 : 0;
    const s = Math.min(1, speed / (12 + r * 4));
    const big = Math.min(1, Math.log2(1 + r) / 5);
    this.rumble.g.gain.setTargetAtTime(on * (0.05 + big * 0.5) * s, t, 0.08);
    this.rumble.fl.frequency.setTargetAtTime(90 + s * 160 - big * 50, t, 0.1);
    this.crunchLfo += dt * (6 + speed * 1.5);
    const grain = 0.6 + 0.4 * Math.sin(this.crunchLfo) * Math.sin(this.crunchLfo * 2.7);
    const ice = surf === 2;
    this.crunch.g.gain.setTargetAtTime(on * (ice ? 0.05 : 0.16 - big * 0.07) * s * grain, t, 0.03);
    this.crunch.fl.frequency.setTargetAtTime(ice ? 3200 : 900 + s * 900 - big * 400, t, 0.1);
    const w = playing ? Math.min(1, speed / 40) : 0.15;
    this.wind.g.gain.setTargetAtTime(0.02 + w * w * 0.22, t, 0.3);
    this.wind.fl.frequency.setTargetAtTime(300 + w * 1100, t, 0.3);
  }

  // little building blocks
  tone(type, f0, f1, at, dur, vol, out = this.sfx, opts = {}) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
    if (opts.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = opts.vib; lg.gain.value = f0 * (opts.vibAmt || 0.03); l.connect(lg); lg.connect(o.frequency); l.start(at); l.stop(at + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + (opts.atk || 0.008)); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let node = o;
    if (opts.filter) { const f = ctx.createBiquadFilter(); f.type = opts.filter; f.frequency.value = opts.ff || 1200; f.Q.value = opts.q || 1; o.connect(f); node = f; }
    node.connect(g); g.connect(out); o.start(at); o.stop(at + dur + 0.05);
    return o;
  }
  noise(at, dur, vol, type, f, q = 1, f1, buf) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = buf || this.white;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, at); fl.Q.value = q;
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(fl); fl.connect(g); g.connect(this.sfx); s.start(at, Math.random()); s.stop(at + dur + 0.05);
  }
  // a voice: a buzzy source through two formant filters (an "aah" by default)
  voice(at, f0, f1, dur, vol, formants = [800, 1200], vib = 6) {
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vib; lg.gain.value = f0 * 0.04; l.connect(lg); lg.connect(o.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.04); g.gain.setValueAtTime(vol, at + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    for (const f of formants) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 6; o.connect(bp); bp.connect(g); }
    g.connect(this.sfx); o.start(at); l.start(at); o.stop(at + dur + 0.05); l.stop(at + dur + 0.05);
  }

  // you picked something up
  pickup(frac, combo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.005;
    const big = Math.min(1, frac);
    this.noise(t, 0.12 + big * 0.2, 0.25 + big * 0.3, 'lowpass', 900 - big * 500, 0.7, 200, this.brown);
    const step = PENTA[Math.min(PENTA.length - 1, (combo - 1) % PENTA.length)] + 12 * Math.floor((combo - 1) / PENTA.length / 2);
    const f = NOTE(72 + step) * (1 - big * 0.4);
    this.tone('triangle', f, f * 1.01, t, 0.16, 0.12);
    this.tone('sine', f * 2, f * 2, t + 0.02, 0.1, 0.05);
  }

  // what the thing says as it goes in
  say(kind, near = 1) {
    if (!this.ctx || this.voices > 5) return;
    const now = this.ctx.currentTime;
    if (now - (this.lastSay[kind] || 0) < 0.12) return;
    this.lastSay[kind] = now;
    const t = now + 0.01, v = 0.35 * near, R = Math.random;
    this.voices++; setTimeout(() => this.voices--, 600);
    switch (kind) {
      case 'scream': { const p = 380 + R() * 260; this.voice(t, p * 1.4, p * 0.55, 0.55 + R() * 0.3, v * 0.5, R() < 0.5 ? [800, 1200] : [600, 1000], 7); break; }
      case 'kid': { const p = 650 + R() * 200; this.voice(t, p, p * 1.6, 0.4, v * 0.4, [1000, 1600], 9); break; }
      case 'roar': this.voice(t, 110, 70, 0.9, v * 0.7, [400, 700], 18); this.noise(t, 0.8, v * 0.3, 'lowpass', 500, 1); break;
      case 'moose': this.voice(t, 140, 95, 0.8, v * 0.7, [350, 900], 4); break;
      case 'trumpet': this.voice(t, 300, 520, 0.9, v * 0.6, [700, 1400], 5); break;
      case 'woof': for (let i = 0; i < 2; i++) this.voice(t + i * 0.2, 260, 160, 0.13, v * 0.6, [500, 1100], 1); break;
      case 'yip': this.voice(t, 900, 1300, 0.15, v * 0.5, [1200, 2000], 1); break;
      case 'bleat': this.voice(t, 330, 300, 0.5, v * 0.5, [700, 1500], 11); break;
      case 'tweet': for (let i = 0; i < 3; i++) this.tone('sine', 3200 + R() * 800, 4400, t + i * 0.07, 0.06, v * 0.2); break;
      case 'squeak': this.tone('sine', 1800, 2600, t, 0.12, v * 0.25); break;
      case 'honk': { for (const f of [392, 494]) this.tone('square', f, f, t, 0.32, v * 0.12, this.sfx, { filter: 'lowpass', ff: 1800 }); break; }
      case 'siren': this.tone('sine', 700, 1100, t, 0.5, v * 0.25, this.sfx, { vib: 3, vibAmt: 0.12 }); break;
      case 'bell': for (const [m, a] of [[1, 1], [2.76, 0.5], [5.4, 0.3], [8.9, 0.15]]) this.tone('sine', 220 * m, 220 * m, t, 2.2, v * 0.25 * a); break;
      case 'choo': this.tone('sawtooth', 590, 560, t, 0.7, v * 0.1, this.sfx, { filter: 'bandpass', ff: 1200, q: 4, vib: 5 }); this.tone('sawtooth', 740, 700, t, 0.7, v * 0.08, this.sfx, { filter: 'bandpass', ff: 1500, q: 4 }); break;
      case 'jingle': for (let i = 0; i < 6; i++) this.tone('sine', 2400 + R() * 1600, 2400, t + i * 0.035, 0.18, v * 0.12); break;
      case 'clink': this.tone('sine', 2200 + R() * 800, 2200, t, 0.25, v * 0.2); this.tone('sine', 3300, 3300, t, 0.18, v * 0.1); break;
      case 'clank': this.tone('square', 180, 120, t, 0.18, v * 0.15, this.sfx, { filter: 'bandpass', ff: 900, q: 3 }); this.tone('sine', 1250, 1240, t, 0.4, v * 0.12); break;
      case 'crunch': case 'crash': {
        const big = kind === 'crash';
        for (let i = 0; i < (big ? 6 : 3); i++) this.noise(t + i * 0.04, 0.12, v * (big ? 0.5 : 0.3), 'bandpass', 600 + R() * 1500, 1.5);
        if (big) { this.tone('sine', 90, 40, t, 0.6, v * 0.7); this.noise(t, 0.9, v * 0.4, 'lowpass', 400, 0.7, 100, this.brown); }
        break;
      }
      case 'splash': this.noise(t, 0.5, v * 0.4, 'bandpass', 2500, 1, 600); break;
      case 'squelch': this.noise(t, 0.2, v * 0.3, 'lowpass', 900, 8, 300); break;
      case 'rustle': this.noise(t, 0.45, v * 0.3, 'highpass', 2500, 0.7); break;
      case 'whoosh': this.noise(t, 0.6, v * 0.3, 'bandpass', 500, 1.2, 2000); break;
      case 'thud': case 'thunk': this.tone('sine', 140, 60, t, 0.2, v * 0.6); break;
      case 'pop': default: this.tone('sine', 900, 400, t, 0.08, v * 0.15); break;
    }
  }

  // bounced off something too big: a thud and a cartoon spring
  boing(impact) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.005, v = Math.min(0.6, 0.15 + impact * 0.04);
    this.tone('sine', 120, 45, t, 0.25, v);
    this.noise(t, 0.15, v * 0.5, 'lowpass', 700, 1, 200, this.brown);
    if (impact > 3) this.tone('sine', 300, 300, t + 0.02, 0.5, v * 0.25, this.sfx, { vib: 18, vibAmt: 0.25 });
  }
  land(impact) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.005, v = Math.min(0.8, 0.2 + impact * 0.05);
    this.noise(t, 0.4, v, 'lowpass', 500, 0.8, 120, this.brown);
    this.tone('sine', 90, 40, t, 0.35, v * 0.8);
  }
  air() { if (this.ctx) this.noise(this.ctx.currentTime, 0.7, 0.18, 'bandpass', 400, 1.4, 1600); }
  shed() { if (this.ctx) { const t = this.ctx.currentTime; for (let i = 0; i < 4; i++) this.tone('square', 600 - i * 90, 300 - i * 50, t + i * 0.05, 0.08, 0.05); } }
  fanfare(level) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.05, seq = level >= 3 ? [60, 64, 67, 72, 76, 79, 84] : level === 2 ? [60, 64, 67, 72, 76] : level === 1 ? [60, 64, 67, 72] : [67, 64, 60, 55];
    seq.forEach((n, i) => { this.tone('triangle', NOTE(n), NOTE(n), t + i * 0.11, 0.35, 0.16); this.tone('square', NOTE(n) / 2, NOTE(n) / 2, t + i * 0.11, 0.3, 0.04, this.sfx, { filter: 'lowpass', ff: 1200 }); });
  }
  stamp() { if (this.ctx) { const t = this.ctx.currentTime; this.tone('sine', 110, 50, t, 0.25, 0.7); this.noise(t, 0.08, 0.5, 'lowpass', 1500, 0.8); } }
  type() { if (this.ctx) this.noise(this.ctx.currentTime, 0.03, 0.12, 'bandpass', 3000 + Math.random() * 1500, 2); }
  radio() { if (this.ctx) { const t = this.ctx.currentTime; this.noise(t, 0.15, 0.12, 'bandpass', 2000, 2); this.tone('sine', 1300, 1300, t + 0.12, 0.06, 0.08); } }
  click() { if (this.ctx) this.tone('sine', 700, 500, this.ctx.currentTime, 0.05, 0.08); }
}

// An oom-pah polka: tuba on the beat, accordion chords on the off-beat, a whistled tune, and sleigh bells.
// Its key and tune are seeded by the mountain; it adds layers as the snowball grows and speeds up with it.
class Music {
  constructor(snd) {
    this.s = snd; this.on = false; this.next = 0; this.step = 0; this.level = 0; this.tempo = 116; this.root = 60;
    this.timer = null;
  }
  start(seed = 1, root = 60) {
    this.stop();
    this.seed = seed; this.root = root;
    this.tune = this.compose(seed);
    this.on = true; this.step = 0;
    this.next = this.s.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.pump(), 25);
  }
  stop() { this.on = false; clearInterval(this.timer); this.timer = null; }
  compose(seed) {
    let s = seed * 9973 + 7;
    const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    // eight bars: I V I IV | I V I-V I, two eighth-note steps per beat, two beats a bar
    const prog = [0, 7, 0, 5, 0, 7, 0, 0];
    const tones = { 0: [0, 4, 7, 12], 7: [7, 11, 14, 2], 5: [5, 9, 12, 0] };
    const mel = [];
    let last = 7;
    for (let bar = 0; bar < 8; bar++) {
      const ch = tones[prog[bar]];
      const rhythm = [[1, 1, 1, 1], [1, 0, 1, 1], [1, 1, 1, 0], [1, 0, 1, 0], [1, 1, 0, 1]][Math.floor(R() * 5)];
      for (let k = 0; k < 4; k++) {
        if (!rhythm[k]) { mel.push(null); continue; }
        let n = k % 2 === 0 ? ch[Math.floor(R() * ch.length)] : last + (R() < 0.5 ? 2 : -1);
        while (n - last > 7) n -= 12; while (last - n > 7) n += 12;
        n = Math.max(-1, Math.min(16, n));
        mel.push(n); last = n;
      }
    }
    // the second half answers the first, ending home
    for (let i = 16; i < 32; i++) if (i % 8 >= 4 && mel[i - 16] !== null && R() < 0.6) mel[i] = mel[i - 16];
    mel[31] = null; mel[28] = 12;
    return { prog, mel };
  }
  set(level, speed) { this.level = level; this.tempo = 112 + Math.min(60, level * 7 + speed * 0.4); }
  pump() {
    const ctx = this.s.ctx;
    if (!ctx || !this.on) return;
    while (this.next < ctx.currentTime + 0.12) { this.play(this.step, this.next); this.step++; this.next += 60 / this.tempo / 2; }
  }
  play(step, t) {
    const s = this.s, out = s.mus, L = this.level, root = this.root;
    const bar = Math.floor(step / 4) % 8, k = step % 4;
    const chord = this.tune.prog[bar];
    // tuba: root on 1, fifth on 3
    if (k === 0 || k === 2) {
      const n = root - 24 + chord + (k === 2 ? 7 : 0);
      s.tone('triangle', NOTE(n), NOTE(n), t, 0.22, 0.32, out);
      s.tone('sine', NOTE(n) * 2, NOTE(n) * 2, t, 0.12, 0.08, out);
    }
    // accordion: the chord on the off-beats
    if ((k === 1 || k === 3) && L >= 1) {
      const tri = chord === 7 ? [7, 11, 14] : chord === 5 ? [5, 9, 12] : [0, 4, 7];
      for (const iv of tri) s.tone('sawtooth', NOTE(root - 12 + iv), NOTE(root - 12 + iv), t, 0.14, 0.035, out, { filter: 'lowpass', ff: 1400, vib: 6, vibAmt: 0.004 });
    }
    // the tune
    if (L >= 2) {
      const n = this.tune.mel[(step % 32)];
      if (n !== null && n !== undefined) {
        s.tone('triangle', NOTE(root + 12 + n), NOTE(root + 12 + n), t, 0.2, 0.09, out, { vib: 5.5, vibAmt: 0.006 });
        if (L >= 4) s.tone('sine', NOTE(root + 24 + n), NOTE(root + 24 + n), t, 0.15, 0.04, out);
      }
    }
    // sleigh bells on every step, a brush on the off-beat
    if (L >= 3) s.noise(t, 0.05, k % 2 ? 0.05 : 0.08, 'highpass', 7000, 0.7);
    if (L >= 4 && k % 2) s.noise(t, 0.09, 0.06, 'bandpass', 2500, 0.8);
    // a cymbal swell at the top of the tune
    if (L >= 5 && step % 32 === 0) s.noise(t, 1.2, 0.07, 'highpass', 5000, 0.5);
  }
}
