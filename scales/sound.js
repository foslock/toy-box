// Scales: sound, all made in Web Audio. A busker's waltz on a plucked guitar (Karplus-Strong, rendered note by note),
// the market murmuring, birds. Produce knocks on wood or thumps on produce, and every merge rings a marimba note a step
// higher up the scale than the size before. The bale creaks when the plank swings, gusts rush through, the crow caws,
// the saw rasps, and the till rings for anything sold off the end.

const PENTA = [0, 2, 4, 7, 9];                  // D major pentatonic
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = { D: [50, 57, 62, 66, 69], G: [43, 55, 59, 62, 67], A: [45, 57, 61, 64, 69], Bm: [47, 54, 59, 62, 66], Em: [40, 55, 59, 64, 67] };
const SONG = ['D', 'D', 'G', 'A', 'Bm', 'G', 'A', 'D', 'G', 'D', 'Em', 'A', 'D', 'Bm', 'A', 'D'];

export class Sound {
  constructor() { this.on = true; this.ac = null; this.pluckCache = new Map(); this.knocks = 0; }
  init(ctx) {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC && !ctx) return;
    const ac = this.ac = ctx || new AC();   // ctx: an offline context, for checking the mix
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ac.destination);
    this.master = ac.createGain(); this.master.gain.value = this.on ? 0.9 : 0; this.master.connect(comp);
    this.sfx = ac.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);
    // a little room: a convolver fed with decaying noise
    const ir = ac.createBuffer(2, ac.sampleRate * 1.4, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
    this.verb = ac.createConvolver(); this.verb.buffer = ir;
    const wet = ac.createGain(); wet.gain.value = 0.22; this.verb.connect(wet); wet.connect(this.master);
    this.music = ac.createGain(); this.music.gain.value = 0.0; this.music.connect(this.master); this.music.connect(this.verb);
    const body = ac.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 220; body.gain.value = 4; body.Q.value = 1.2;
    this.musicIn = body; body.connect(this.music);
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // the market behind you: a murmur of voices, and the breeze, which a gust turns up
    const mur = this.loop(), mf = ac.createBiquadFilter(); mf.type = 'bandpass'; mf.frequency.value = 520; mf.Q.value = 0.9;
    this.murG = ac.createGain(); this.murG.gain.value = 0.012; mur.connect(mf); mf.connect(this.murG); this.murG.connect(this.master);
    const wind = this.loop(), wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = 0.7; this.windF = wf;
    this.windG = ac.createGain(); this.windG.gain.value = 0.008; wind.connect(wf); wf.connect(this.windG); this.windG.connect(this.master);
    const wh = this.loop(), whf = ac.createBiquadFilter(); whf.type = 'bandpass'; whf.frequency.value = 1700; whf.Q.value = 14; this.whF = whf;
    this.whG = ac.createGain(); this.whG.gain.value = 0; wh.connect(whf); whf.connect(this.whG); this.whG.connect(this.master);
    // the bale's creak: a buzz through a narrow band that wanders
    const co = ac.createOscillator(); co.type = 'sawtooth'; co.frequency.value = 85;
    const cfm = ac.createOscillator(); cfm.frequency.value = 6; const cfg = ac.createGain(); cfg.gain.value = 22; cfm.connect(cfg); cfg.connect(co.frequency); cfm.start();
    const cb = ac.createBiquadFilter(); cb.type = 'bandpass'; cb.frequency.value = 700; cb.Q.value = 8; this.creakF = cb;
    this.creakG = ac.createGain(); this.creakG.gain.value = 0; co.connect(cb); cb.connect(this.creakG); this.creakG.connect(this.sfx); co.start();
    this.next = ac.currentTime + 0.3; this.beat = 0; this.birdAt = ac.currentTime + 4; this.mood = 1; this.musicOn = false;
  }
  loop() { const s = this.ac.createBufferSource(); s.buffer = this.noise; s.loop = true; s.loopStart = Math.random(); s.start(0, Math.random() * 1.5); return s; }
  setOn(on) { this.on = on; if (this.master) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ac.currentTime, 0.05); }
  setMusic(on) {
    this.musicOn = on;
    if (!this.ac) return;
    this.music.gain.setTargetAtTime(on ? 0.28 : 0, this.ac.currentTime, on ? 0.6 : 0.3);
    if (on) { this.next = Math.max(this.next, this.ac.currentTime + 0.1); }
  }

  /* ------------------------------------------------------------------------------------------- every frame */
  // swing: how fast the plank is turning; strain: how far over it is (0..1); wind: the gust, 0..1; saw: sawing?
  update(dt, { swing = 0, strain = 0, wind = 0, saw = false } = {}) {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    const cr = Math.min(1, Math.abs(swing) * 2.2) * (0.4 + strain * 0.8) + Math.max(0, strain - 0.75) * 0.8;
    this.creakG.gain.setTargetAtTime(Math.min(0.07, cr * 0.06), t, 0.05);
    this.creakF.frequency.setTargetAtTime(600 + strain * 500 + Math.sin(t * 7) * 120, t, 0.05);
    this.windG.gain.setTargetAtTime(0.008 + wind * 0.09, t, 0.25);
    this.windF.frequency.setTargetAtTime(450 + wind * 500, t, 0.3);
    this.whG.gain.setTargetAtTime(wind * 0.012, t, 0.3); this.whF.frequency.setTargetAtTime(1500 + wind * 700 + Math.sin(t * 3) * 200, t, 0.2);
    this.murG.gain.setTargetAtTime(0.011 + 0.004 * Math.sin(t * 0.3), t, 0.5);
    if (t > this.birdAt) { this.birdAt = t + 5 + Math.random() * 12; this.bird(); }
    if (saw) { if (!this.sawAt || t > this.sawAt) { this.sawAt = t + 0.21; this.rasp(); } } else this.sawAt = 0;
    if (this.musicOn) this.schedule();
  }

  /* ------------------------------------------------------------------------------------------- the busker */
  pluck(midi, bright = 0.5, dur = 2.2) {
    const key = midi * 10 + Math.round(bright * 9);
    let buf = this.pluckCache.get(key);
    if (!buf) {
      const ac = this.ac, sr = ac.sampleRate, f = mtof(midi), N = Math.max(2, Math.round(sr / f)), len = Math.floor(sr * dur);
      buf = ac.createBuffer(1, len, sr); const d = buf.getChannelData(0), ring = new Float32Array(N);
      let lp = 0; for (let i = 0; i < N; i++) { lp += (Math.random() * 2 - 1 - lp) * (0.25 + bright * 0.6); ring[i] = lp; }
      const decay = 0.9965 + Math.min(0.003, (60 - Math.min(60, midi - 30)) * 0.00004);
      let p = 0, peak = 0;
      for (let i = 0; i < len; i++) { const a = ring[p], b = ring[(p + 1) % N]; ring[p] = decay * (a * 0.5 + b * 0.5); d[i] = a; p = (p + 1) % N; peak = Math.max(peak, Math.abs(a)); }
      const g = peak ? 0.9 / peak : 1; for (let i = 0; i < len; i++) d[i] *= g * Math.min(1, (len - i) / (sr * 0.2));
      this.pluckCache.set(key, buf);
    }
    return buf;
  }
  play(buf, at, gain, out = this.musicIn) {
    const s = this.ac.createBufferSource(), g = this.ac.createGain();
    s.buffer = buf; g.gain.value = gain; s.connect(g); g.connect(out); s.start(at);
  }
  schedule() {
    const ac = this.ac, BEAT = 60 / 100;
    while (this.next < ac.currentTime + 0.3) {
      const at = this.next, b = this.beat, bar = Math.floor(b / 3), inBar = b % 3;
      const ch = CHORDS[SONG[bar % SONG.length]];
      if (inBar === 0) this.play(this.pluck(ch[0] - (ch[0] > 46 ? 12 : 0), 0.35), at, 0.55);
      else { ch.slice(2, 5).forEach((m, i) => this.play(this.pluck(m, 0.45), at + i * 0.014 + Math.random() * 0.006, 0.2)); }
      // a tune over the top, now and then, made of chord tones and the pentatonic between them
      const phrase = bar % 4;
      if (this.mood > 0.4 && (phrase < 3 || inBar === 0) && Math.random() < (inBar === 0 ? 0.75 : 0.45)) {
        const pool = ch.slice(1).map(m => m + 12).concat(PENTA.map(p => 74 + p));
        this.mel = this.mel ?? 74;
        const cands = pool.filter(m => Math.abs(m - this.mel) <= 5 && m >= 69 && m <= 86);
        const m = cands.length ? cands[(Math.random() * cands.length) | 0] : 74;
        this.mel = m;
        this.play(this.pluck(m, 0.75, 1.4), at + (Math.random() < 0.25 && inBar ? BEAT / 2 : 0), 0.16);
      }
      this.beat++; this.next += BEAT * (inBar === 0 ? 1.04 : 0.98);   // a lilt: the first beat a hair long
    }
  }

  /* ------------------------------------------------------------------------------------------- one-shots */
  tone(f0, dur, gain, type = 'sine', drop = 1, at = 0, out = this.sfx) {
    const ac = this.ac, t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (drop !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f0 * drop), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  burst(freq, q, dur, gain, at = 0, type = 'bandpass', out = this.sfx, sweep = 1) {
    const ac = this.ac, t = ac.currentTime + at, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = this.noise; s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep !== 1) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur); f.Q.value = q;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  // something landing: wood knocks, produce thumps, the ground thuds. tier sets the pitch, v the force
  knock(kind, v, tier) {
    if (!this.ac || this.knocks > 6) return;
    this.knocks++; setTimeout(() => this.knocks--, 60);
    const k = Math.min(1, (v - 80) / 450), sz = 1 - tier / 10;
    if (k <= 0.02) return;
    if (kind === 1) {   // the plank
      this.tone(150 + sz * 110 + Math.random() * 15, 0.16, 0.22 * k, 'triangle', 0.75);
      this.tone(420 + sz * 200, 0.07, 0.07 * k, 'sine', 0.9);
      this.burst(1400 + sz * 800, 2.5, 0.05, 0.12 * k);
    } else if (kind === 2) {   // the ground
      this.tone(70 + sz * 40, 0.3, 0.3 * k, 'sine', 0.5); this.burst(380, 0.8, 0.2, 0.22 * k, 0, 'lowpass');
    } else {   // another piece of produce
      this.tone(170 + sz * 260 + Math.random() * 20, 0.09, 0.16 * k, 'sine', 0.6);
      this.burst(700 + sz * 900, 1.2, 0.06, 0.08 * k, 0, 'lowpass');
    }
  }
  merge(tier, chain) {
    if (!this.ac) return;
    const step = tier - 1 + (chain - 1) * 2, m = 62 + 12 * Math.floor(step / 5) + PENTA[((step % 5) + 5) % 5];
    const f = mtof(Math.min(98, m)), out = this.sfx;
    // a soft plop, then the marimba bar
    this.burst(1600 - tier * 90, 3, 0.09, 0.18, 0, 'bandpass', out, 0.35);
    this.tone(f, 0.55, 0.22, 'sine', 1, 0.01); this.tone(f * 4, 0.12, 0.05, 'sine', 1, 0.01); this.tone(f * 10, 0.03, 0.02, 'sine', 1, 0.01);
    this.tone(f, 0.55, 0.06, 'sine', 1, 0.01, this.verb);
    if (tier >= 6) this.tone(f / 2, 0.8, 0.12, 'triangle', 1, 0.02);
  }
  ribbon() {
    if (!this.ac) return;
    [62, 66, 69, 74, 78, 81, 86].forEach((m, i) => this.play(this.pluck(m, 0.8, 1.8), this.ac.currentTime + i * 0.09, 0.35, this.sfx));
    this.applause(2.6);
  }
  applause(dur) { for (let i = 0; i < dur * 40; i++) this.burst(1800 + Math.random() * 2400, 1.6, 0.03, 0.05 * Math.sin(Math.PI * i / (dur * 40)) + 0.01, i / 40 + Math.random() * 0.02); }
  ready(tier) { if (!this.ac) return; this.tone(1900 - tier * 120, 0.12, 0.05, 'triangle', 0.98); this.tone(2900 - tier * 150, 0.06, 0.025, 'sine'); }
  drop() { if (!this.ac) return; this.tone(1300, 0.09, 0.05, 'triangle', 0.9); this.burst(900, 1, 0.18, 0.04, 0.02, 'bandpass', this.sfx, 0.5); }
  bump(v) { if (!this.ac) return; const k = Math.min(1, v / 1.2); this.tone(95, 0.35, 0.35 * k + 0.08, 'sine', 0.55); this.burst(500, 1, 0.18, 0.25 * k + 0.05, 0, 'lowpass'); this.tone(240, 0.12, 0.12 * k, 'triangle', 0.7); }
  creak() { if (!this.ac) return; this.tone(110 + Math.random() * 40, 0.4, 0.05, 'sawtooth', 1.25); }
  gust() { if (!this.ac) return; this.burst(600, 0.6, 2.4, 0.06, 0, 'bandpass', this.sfx, 1.8); }
  caw(n = 2, loud = false) {
    if (!this.ac) return;
    const ac = this.ac;
    for (let i = 0; i < n; i++) {
      const t = ac.currentTime + i * 0.36 + Math.random() * 0.05, o = ac.createOscillator(), g = ac.createGain(), am = ac.createOscillator(), amg = ac.createGain();
      const f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(), hp = ac.createBiquadFilter();
      o.type = 'sawtooth'; const p = 560 + Math.random() * 60; o.frequency.setValueAtTime(p * 1.08, t); o.frequency.linearRampToValueAtTime(p, t + 0.06); o.frequency.exponentialRampToValueAtTime(p * 0.78, t + 0.28);
      am.frequency.value = 55 + Math.random() * 15; amg.gain.value = 0.5; am.connect(amg);
      f1.type = 'bandpass'; f1.frequency.value = 1150; f1.Q.value = 3; f2.type = 'bandpass'; f2.frequency.value = 1800; f2.Q.value = 4; hp.type = 'highpass'; hp.frequency.value = 500;
      const vol = loud ? 0.11 : 0.065;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.setValueAtTime(vol, t + 0.16); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      amg.connect(g.gain);
      o.connect(hp); hp.connect(f1); hp.connect(f2); f1.connect(g); f2.connect(g); g.connect(this.sfx); g.connect(this.verb);
      o.start(t); am.start(t); o.stop(t + 0.35); am.stop(t + 0.35);
    }
  }
  flap() { if (!this.ac) return; for (let i = 0; i < 4; i++) this.burst(700, 1, 0.07, 0.05, i * 0.09, 'lowpass'); }
  peck() { if (!this.ac) return; this.tone(1700, 0.03, 0.04, 'triangle', 0.8); this.burst(3000, 3, 0.02, 0.03); }
  rasp() { this.burst(2600 + Math.random() * 600, 1.4, 0.18, 0.05, 0, 'bandpass', this.sfx, 0.8); }
  trim() { if (!this.ac) return; this.tone(180, 0.2, 0.2, 'triangle', 0.6); this.burst(1200, 2, 0.1, 0.15); for (let i = 1; i < 4; i++) this.tone(220 + Math.random() * 60, 0.1, 0.12 / i, 'triangle', 0.7, 0.35 + i * 0.12); }
  clatter(v) { if (!this.ac || v < 60) return; this.tone(260 + Math.random() * 80, 0.08, Math.min(0.12, v / 1200), 'triangle', 0.7); }
  sold() {
    if (!this.ac) return;
    this.burst(2500, 2, 0.04, 0.08); this.tone(180, 0.05, 0.06, 'square', 0.8);
    for (const [f, a] of [[2637, 0.07], [3520, 0.05], [5274, 0.02]]) { this.tone(f, 0.7, a, 'sine', 1, 0.06); this.tone(f, 0.7, a * 0.4, 'sine', 1, 0.06, this.verb); }
  }
  warn() { if (!this.ac) return; this.tone(880, 0.14, 0.06, 'triangle'); this.tone(660, 0.18, 0.06, 'triangle', 1, 0.16); }
  fell() {
    if (!this.ac) return;
    this.setMusic(false);
    const t = this.ac.currentTime;
    [62, 57, 54, 50].forEach((m, i) => this.play(this.pluck(m, 0.4, 2.2), t + 0.5 + i * 0.34, 0.4, this.sfx));
    // an "aww" from the crowd
    for (let v = 0; v < 6; v++) {
      const o = this.ac.createOscillator(), f = this.ac.createBiquadFilter(), g = this.ac.createGain(), at = t + 0.15 + Math.random() * 0.1, p = 190 + Math.random() * 120;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(p * 1.1, at); o.frequency.exponentialRampToValueAtTime(p * 0.8, at + 1.1);
      f.type = 'bandpass'; f.Q.value = 5; f.frequency.setValueAtTime(950, at); f.frequency.exponentialRampToValueAtTime(600, at + 1.1);
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.017, at + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, at + 1.2);
      o.connect(f); f.connect(g); g.connect(this.sfx); o.start(at); o.stop(at + 1.3);
    }
  }
  bird() {
    if (!this.ac) return;
    const n = 2 + (Math.random() * 3 | 0), base = 2800 + Math.random() * 1200;
    for (let i = 0; i < n; i++) this.tone(base * (1 + Math.random() * 0.2), 0.07, 0.012, 'sine', 1.35, i * 0.11);
  }
  click() { if (!this.ac) return; this.tone(1100, 0.04, 0.04, 'triangle', 0.8); }
}
