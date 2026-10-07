// Horde: sound, all made in Web Audio. A slow organ ostinato in D minor with a harpsichord over it, a church bell for
// each minute gone, and the hits, pops and gem chimes the genre runs on, throttled so a thousand-strong fight doesn't
// turn into a wall of noise. The hero's gems ring a step higher each time it scoops one up quickly.

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
// D minor: i, VI, III, VII, then iv, i, V
const BASS = [38, 38, 34, 34, 41, 41, 36, 36, 31, 31, 38, 38, 33, 33, 33, 33];
const ARP = [[62, 65, 69, 74], [62, 65, 69, 74], [58, 62, 65, 70], [58, 62, 65, 70], [57, 60, 65, 69], [57, 60, 65, 69], [60, 64, 67, 72], [60, 64, 67, 72],
  [55, 58, 62, 67], [55, 58, 62, 67], [57, 62, 65, 69], [57, 62, 65, 69], [57, 61, 64, 69], [57, 61, 64, 69], [57, 61, 64, 67], [57, 61, 64, 67]];
const GEM = [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19, 21, 22, 24];

export class Sound {
  constructor() { this.on = true; this.ac = null; this.last = {}; this.gemN = 0; this.gemT = 0; this.musicOn = false; this.minute = 0; }
  init(ctx) {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC && !ctx) return;
    const ac = this.ac = ctx || new AC();
    // a gentle bus compressor, then a hard limiter so a thousand-strong fight never clips
    const lim = ac.createDynamicsCompressor(); lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
    const trim = ac.createGain(); trim.gain.value = 0.7; trim.connect(lim); lim.connect(ac.destination);
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25; comp.connect(trim);
    this.master = ac.createGain(); this.master.gain.value = this.on ? 0.8 : 0; this.master.connect(comp);
    const ir = ac.createBuffer(2, ac.sampleRate * 2.2, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.6); }
    this.verb = ac.createConvolver(); this.verb.buffer = ir;
    const wet = ac.createGain(); wet.gain.value = 0.3; this.verb.connect(wet); wet.connect(this.master);
    this.sfx = ac.createGain(); this.sfx.gain.value = 4.5; this.sfx.connect(this.master);
    this.sfxVerb = ac.createGain(); this.sfxVerb.gain.value = 0.06; this.sfx.connect(this.sfxVerb); this.sfxVerb.connect(this.verb);
    this.mus = ac.createGain(); this.mus.gain.value = 0; this.mus.connect(this.master);
    const ml = ac.createBiquadFilter(); ml.type = 'lowpass'; ml.frequency.value = 2400; ml.connect(this.mus);
    const mv = ac.createGain(); mv.gain.value = 0.5; ml.connect(mv); mv.connect(this.verb);
    this.musIn = ml;
    const len = ac.sampleRate, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // a low wind across the field, always there
    const wn = ac.createBufferSource(); wn.buffer = buf; wn.loop = true;
    const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 380; wf.Q.value = 0.6;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.07; const lg = ac.createGain(); lg.gain.value = 160; lfo.connect(lg); lg.connect(wf.frequency); lfo.start();
    this.windG = ac.createGain(); this.windG.gain.value = 0.05; wn.connect(wf); wf.connect(this.windG); this.windG.connect(this.master); wn.start();
    this.next = ac.currentTime + 0.2; this.beat = 0;
  }
  setOn(on) { this.on = on; if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ac.currentTime, 0.05); }
  music(on, night = 1) {
    this.musicOn = on; this.night = night;
    if (!this.ac) return;
    this.mus.gain.setTargetAtTime(on ? 0.85 : 0, this.ac.currentTime, on ? 0.8 : 0.4);
    if (on) this.next = Math.max(this.next, this.ac.currentTime + 0.05);
  }
  ok(k, gap) { const t = this.ac.currentTime; if (t - (this.last[k] ?? -9) < gap) return false; this.last[k] = t; return true; }

  /* ------------------------------------------------------------------------------------------- voices */
  tone(f, dur, { type = 'square', vol = 0.1, at = 0, slide = 0, out = this.sfx, attack = 0.004, q = 0, lp = 0 } = {}) {
    const ac = this.ac, t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    let node = o;
    if (lp) { const f2 = ac.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; f2.Q.value = q; o.connect(f2); node = f2; }
    node.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  hiss(dur, { f = 1000, q = 1, type = 'bandpass', vol = 0.1, at = 0, sweep = 0, out = this.sfx } = {}) {
    const ac = this.ac, t = ac.currentTime + at, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = this.noise; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (sweep) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f * sweep), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  bell(m, vol = 0.12, at = 0, out = this.sfx) {
    const f = mtof(m);
    for (const [r, v, d] of [[1, 1, 3.2], [2.76, 0.4, 1.6], [5.4, 0.2, 0.8], [0.5, 0.5, 4]]) this.tone(f * r, d, { type: 'sine', vol: vol * v, at, out, attack: 0.002 });
  }

  /* ------------------------------------------------------------------------------------------- the night's events */
  events(evs, g, live) {
    if (!this.ac || !this.on || !live) return;
    const R = Math.random;
    for (const e of evs) {
      switch (e.k) {
        case 'spawn': if (this.ok('spawn', 0.07)) { this.hiss(0.35, { f: 600, sweep: 0.25, vol: 0.07, q: 2 }); this.tone(120, 0.32, { type: 'sawtooth', vol: 0.05, slide: 0.45, lp: 500 }); } break;
        case 'die':
          if (e.type === 'imp' && this.ok('dimp', 0.04)) this.tone(500 + R() * 400, 0.06, { vol: 0.02, slide: 0.5 });
          else if (e.type === 'bat' && this.ok('dbat', 0.04)) this.tone(2200 + R() * 600, 0.05, { type: 'sine', vol: 0.04, slide: 1.4 });
          else if (e.type === 'brute' && this.ok('dbrute', 0.08)) { this.tone(90, 0.4, { type: 'sine', vol: 0.18, slide: 0.4 }); this.hiss(0.3, { f: 300, vol: 0.08 }); }
          else if (e.type === 'shield' && this.ok('dsh', 0.06)) { this.hiss(0.05, { f: 3000, vol: 0.06, q: 4 }); this.hiss(0.05, { f: 2400, vol: 0.05, q: 4, at: 0.06 }); }
          else if (e.type === 'hag' && this.ok('dhag', 0.1)) this.tone(700, 0.45, { type: 'triangle', vol: 0.07, slide: 0.45 });
          break;
        case 'dmg': if (this.ok('dmg', 0.05)) this.tone(160 + R() * 60, 0.03, { vol: 0.014, type: 'square' }); break;
        case 'hurt': if (this.ok('hurt', 0.05)) { this.hiss(0.12, { f: 900, vol: e.big ? 0.16 : 0.09, q: 1.5 }); this.tone(e.big ? 110 : 150, 0.14, { vol: e.big ? 0.12 : 0.07, slide: 0.6 }); } break;
        case 'clang': if (this.ok('clang', 0.08)) { this.tone(1900, 0.12, { type: 'sine', vol: 0.05 }); this.tone(2850, 0.08, { type: 'sine', vol: 0.03 }); } break;
        case 'boom': if (this.ok('boom', 0.05)) { this.hiss(0.6, { f: 400, type: 'lowpass', vol: 0.22, sweep: 0.3 }); this.tone(70, 0.5, { type: 'sine', vol: 0.25, slide: 0.5 }); } break;
        case 'whip': if (this.ok('whip', 0.08)) this.hiss(0.09, { f: 2800, sweep: 2, vol: 0.06, q: 0.8, type: 'highpass' }); break;
        case 'bolt': if (this.ok('bolt', 0.06)) { this.hiss(0.08, { f: 4000, vol: 0.2, type: 'highpass' }); this.hiss(0.9, { f: 200, type: 'lowpass', vol: 0.18, sweep: 0.5, at: 0.03 }); } break;
        case 'throw':
          if (e.w === 'knife' && this.ok('knife', 0.05)) this.hiss(0.05, { f: 3500, vol: 0.04, q: 3 });
          else if (e.w === 'fire' && this.ok('fire', 0.08)) this.hiss(0.3, { f: 700, sweep: 2.2, vol: 0.07 });
          else if (e.w === 'axe' && this.ok('axe', 0.08)) this.hiss(0.25, { f: 1200, vol: 0.05, q: 5 });
          else if (e.w === 'water' && this.ok('water', 0.1)) this.tone(1800, 0.08, { type: 'sine', vol: 0.04 });
          break;
        case 'splash': if (this.ok('splash', 0.1)) this.hiss(0.35, { f: 1800, vol: 0.06, q: 0.6 }); break;
        case 'fireburst': if (this.ok('fburst', 0.06)) this.hiss(0.25, { f: 500, type: 'lowpass', vol: 0.1 }); break;
        case 'books': this.hiss(0.2, { f: 2600, vol: 0.04, q: 2 }); break;
        case 'gem': {
          const t = this.ac.currentTime;
          if (t - this.gemT > 0.6) this.gemN = 0; this.gemT = t;
          if (this.ok('gem', 0.045)) { const n = GEM[Math.min(GEM.length - 1, this.gemN++)]; this.tone(mtof(84 + n), 0.18, { type: 'sine', vol: 0.045 }); this.tone(mtof(96 + n), 0.08, { type: 'sine', vol: 0.015 }); }
          break;
        }
        case 'sink': if (this.ok('sink', 0.2)) this.tone(400, 0.25, { type: 'sine', vol: 0.03, slide: 0.5 }); break;
        case 'level': { [0, 4, 7, 12].forEach((s, i) => this.tone(mtof(72 + s), 0.25, { vol: 0.06, at: i * 0.07, lp: 3000 })); this.bell(84, 0.05, 0.28); break; }
        case 'mend': if (this.ok('mend', 0.25)) this.tone(mtof(81), 0.3, { type: 'triangle', vol: 0.035, slide: 1.06 }); break;
        case 'block': if (this.ok('block', 0.05)) { this.tone(2400, 0.07, { type: 'sine', vol: 0.06 }); this.tone(3300, 0.05, { type: 'sine', vol: 0.04 }); } break;
        case 'miss': if (this.ok('miss', 0.1)) this.hiss(0.07, { f: 5000, vol: 0.03, type: 'highpass' }); break;
        case 'win': this.bell(38, 0.07); this.bell(45, 0.04, 1.4); this.bell(41, 0.045, 2.6); break;
        case 'lose': if (e.why === 'dawn') { [62, 66, 69, 74].forEach((m, i) => this.tone(mtof(m), 2.4, { type: 'triangle', vol: 0.06, at: i * 0.18, attack: 0.3 })); } else { [60, 64, 67, 72, 76].forEach((m, i) => this.tone(mtof(m), 2.2, { type: 'sawtooth', vol: 0.04, at: i * 0.1, attack: 0.05, lp: 2500 })); } break;
      }
    }
  }
  ui(k) {
    if (!this.ac || !this.on) return;
    if (k === 'select') this.tone(900, 0.04, { vol: 0.03 });
    else if (k === 'flag') { this.tone(110, 0.2, { type: 'sine', vol: 0.14, slide: 0.6 }); this.hiss(0.08, { f: 500, vol: 0.05 }); }
    else if (k === 'hunt') { const f = mtof(45); this.tone(f, 0.7, { type: 'sawtooth', vol: 0.07, attack: 0.08, lp: 900, q: 3 }); this.tone(f * 1.5, 0.6, { type: 'sawtooth', vol: 0.04, attack: 0.1, at: 0.05, lp: 900 }); }
    else if (k === 'no') this.tone(90, 0.12, { vol: 0.06, type: 'square', lp: 600 });
    else if (k === 'pick') this.hiss(0.05, { f: 2000, vol: 0.05, q: 2 });
  }

  /* ------------------------------------------------------------------------------------------- every frame */
  update(g, dt, mode) {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    if (mode === 'play' && g) {
      const m = Math.floor(g.t / 60);
      if (m > this.minute && m < 5) this.bell(38 + 12, 0.03);
      this.minute = m;
    } else this.minute = 0;
    if (!this.musicOn) return;
    // the score: a sixteenth-note scheduler, a little faster each night and in the last minute
    const late = g && g.t > 260 ? 1.12 : 1;
    const spb = 60 / ((84 + (this.night - 1) * 3) * late) / 4;
    while (this.next < t + 0.15) {
      const b = this.beat++, bar = Math.floor(b / 16) % 16, s = b % 16, at = this.next - t;
      if (s % 8 === 0) this.organ(BASS[bar], spb * 8, at);
      const arp = ARP[bar];
      if (s % 2 === 0) this.harp(arp[(s / 2) % 4] + (s >= 8 ? 12 : 0), at, s % 4 === 0 ? 0.05 : 0.032);
      this.next += spb;
    }
  }
  organ(m, dur, at) {
    for (const [r, v, ty] of [[1, 0.09, 'square'], [2, 0.05, 'triangle'], [1.5, 0.025, 'square']]) this.tone(mtof(m) * r, dur * 0.98, { type: ty, vol: v, at, attack: 0.06, out: this.musIn, lp: 800 });
  }
  harp(m, at, vol) { this.tone(mtof(m), 0.32, { type: 'sawtooth', vol, at, attack: 0.002, out: this.musIn, lp: 1900, q: 2 }); }
}
