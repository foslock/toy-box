// The song, built live in WebAudio. Every part is a layer that plays only while
// you carry its instrument, or while something on the floor dances to it.
// The clock everything runs on is the time the beat is *heard*.

let ctx = null, master = null, bus = null, verb = null, echo = null, muted = false;
let ctxOff = 0, song = null, timer = null, noiseBuf = null, pausedAt = 0, perfPause = 0, perfOff = 0;
try { muted = localStorage.getItem('encore.mute') === '1'; } catch {}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('encore.mute', m ? '1' : '0'); } catch {}
  if (master) master.gain.setTargetAtTime(m ? 0 : .8, ctx.currentTime, .02);
}
export const hasAudio = () => !!ctx;

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
    master = ctx.createGain(); master.gain.value = muted ? 0 : .8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = .004; comp.release.value = .15;
    bus = ctx.createGain(); bus.gain.value = 1;
    bus.connect(comp); comp.connect(master); master.connect(ctx.destination);
    // a short plate for the choir and lead, and a dotted-eighth echo
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    verb.buffer = ir;
    const vg = ctx.createGain(); vg.gain.value = .35; verb.connect(vg); vg.connect(bus);
    echo = ctx.createDelay(1); const fb = ctx.createGain(); fb.gain.value = .32; const eg = ctx.createGain(); eg.gain.value = .3;
    const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 2600;
    echo.connect(ef); ef.connect(fb); fb.connect(echo); ef.connect(eg); eg.connect(bus);
    // keep the clock continuous with the page clock it may be taking over from
    ctxOff = ((perfPause || performance.now()) / 1000 - perfOff) - ctx.currentTime;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended' && !pausedAt) ctx.resume();
  if (song && !timer) { // a song already running on the page clock picks up its parts
    song.ct0 = song.t0 - ctxOff + lat();
    song.step = Math.max(0, Math.ceil((ctx.currentTime - song.ct0) / (song.L / 4)));
    timer = setInterval(pump, 25);
  }
}

// If the context never starts (no gesture it accepts), carry on silently on the
// page clock rather than freezing the song.
let stuckSince = 0;
export function watchdog() {
  if (!ctx || pausedAt) { stuckSince = 0; return; }
  if (ctx.state === 'running') { stuckSince = 0; return; }
  const t = performance.now();
  if (!stuckSince) { stuckSince = t; return; }
  if (t - stuckSince > 1500) {
    const base = now();
    try { ctx.close(); } catch {}
    ctx = null; stuckSince = 0;
    perfOff = performance.now() / 1000 - base;
    if (timer) { clearInterval(timer); timer = null; }
  }
}

const lat = () => ctx ? (ctx.outputLatency || ctx.baseLatency || 0) : 0;
// heard time in seconds
export function now() {
  if (ctx) return ctx.currentTime - lat() + ctxOff;
  return (perfPause || performance.now()) / 1000 - perfOff;
}
// convert a DOM event timestamp to heard time
export function evTime(e) {
  const ago = Math.max(0, Math.min(.25, (performance.now() - (e?.timeStamp || performance.now())) / 1000));
  return now() - ago;
}
export function pause() {
  if (ctx) { pausedAt = 1; if (ctx.state === 'running') ctx.suspend(); }
  else if (!perfPause) perfPause = performance.now();
}
export function resume() {
  if (ctx) { pausedAt = 0; if (ctx.state === 'suspended') ctx.resume(); }
  if (perfPause) { perfOff += (performance.now() - perfPause) / 1000; perfPause = 0; }
}

// ------------------------------------------------------------ voices
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
function env(g, t, a, peak, d, end = .0001) {
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + d);
}
function osc(type, f, t, dur, vol, dest, o = {}) {
  const s = ctx.createOscillator(), g = ctx.createGain();
  s.type = type; s.frequency.setValueAtTime(f, t);
  if (o.to) s.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
  if (o.detune) s.detune.value = o.detune;
  env(g, t, o.a || .004, vol, dur);
  s.connect(g); g.connect(dest || bus); s.start(t); s.stop(t + dur + (o.a || .004) + .05);
  return g;
}
function noise(t, dur, vol, type, freq, q = 1, dest) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); env(g, t, .002, vol, dur);
  s.connect(f); f.connect(g); g.connect(dest || bus);
  s.start(t, Math.random() * .5); s.stop(t + dur + .05);
}
function filtered(type, f, t, dur, vol, cut, o = {}) {
  const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = o.q || 4;
  fl.frequency.setValueAtTime(cut * (o.open || 3), t); fl.frequency.exponentialRampToValueAtTime(cut, t + Math.min(dur, .18));
  fl.connect(o.dest || bus);
  if (o.send) { const sg = ctx.createGain(); sg.gain.value = o.send; fl.connect(sg); sg.connect(o.send2 || echo); }
  osc(type, f, t, dur, vol, fl, o);
  if (o.det) osc(type, f, t, dur, vol * .8, fl, { ...o, detune: o.det });
}

// A minor disco: Am, F, C, G, two bars each
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const ROOTS = [33, 29, 36, 31];

const PART = {
  kick(t, s, b, L) {
    if (s) return;
    osc('sine', 150, t, .32, .95, bus, { to: 44, glide: .11 });
    osc('triangle', 900, t, .012, .22, bus, { to: 200 });
  },
  bass(t, s, b, L, c) {
    // octave disco bass, leaning on the downbeat of each bar
    if (s % 2) return;
    const ph = b % 8, r = ROOTS[c], up = (s === 2);
    const down = (ph === 0 || ph === 4) && s === 0;
    filtered('square', mtof(r + (up ? 12 : 0)), t, down ? L * .45 : L * .2, down ? .34 : .2, down ? 500 : 340, { q: 6, open: down ? 5 : 2.5 });
    if (down) osc('sine', mtof(r - 12), t, L * .5, .28);
  },
  hats(t, s, b) {
    const ph = b % 8;
    if (s === 0 && ph % 2) noise(t, .22, .17, 'highpass', 7000, .7);
    else noise(t, .03, s === 2 ? .07 : .035, 'highpass', 8500, .7);
  },
  lead(t, s, b, L, c) {
    const ph = b % 8;
    if (ph !== 2 && ph !== 6) return;
    const ch = CHORDS[c], seq = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 24];
    const n = ph === 2 ? seq[s] : [ch[2] + 12, ch[1] + 12, ch[0] + 12, ch[0] + 24][s];
    filtered('sawtooth', mtof(n), t, L * (s === 3 ? .5 : .2), s === 0 ? .14 : .09, 1600, { det: 9, q: 3, open: 2.2, send: .5 });
  },
  choir(t, s, b, L, c) {
    if (s || b % 8) return;
    const len = L * 8;
    for (const n of CHORDS[c]) for (const [f1, f2] of [[750, 1150]]) {
      const v = ctx.createGain(); v.gain.value = 1;
      const b1 = ctx.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = f1; b1.Q.value = 6;
      const b2 = ctx.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = f2; b2.Q.value = 8;
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.32, t + L * 1.2);
      g.gain.setValueAtTime(.32, t + len - L); g.gain.exponentialRampToValueAtTime(.0001, t + len);
      const sv = ctx.createGain(); sv.gain.value = .6;
      b1.connect(g); b2.connect(g); g.connect(bus); g.connect(sv); sv.connect(verb);
      for (const det of [-8, 7]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n + 12); o.detune.value = det;
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5 + Math.random(); lg.gain.value = 6;
        lfo.connect(lg); lg.connect(o.detune);
        o.connect(b1); o.connect(b2); o.start(t); o.stop(t + len + .1); lfo.start(t); lfo.stop(t + len + .1);
      }
    }
  },
  // ---- the floor's parts
  snare(t, s, b) {
    if (s || !(b % 2)) return;
    noise(t, .14, .2, 'bandpass', 1900, .8);
    osc('triangle', 210, t, .07, .14, bus, { to: 150 });
  },
  shaker(t, s) { noise(t, .04, s % 2 ? .05 : .025, 'bandpass', 6500, 2); },
  tom(t, s, b) {
    if (s || b % 2) return;
    osc('sine', b % 4 ? 98 : 130, t, .26, .32, bus, { to: 70, glide: .25 });
  },
  horn(t, s, b, L, c) {
    const ph = b % 8;
    if (s) return;
    if (ph === 5) for (const n of CHORDS[c]) filtered('sawtooth', mtof(n), t, L * 1.6, .06, 500, { a: L * 1.2, open: 1, q: 2 });
    if (ph === 7) for (const n of CHORDS[c]) filtered('sawtooth', mtof(n), t, L * .4, .11, 1300, { open: 2.5, q: 2, det: 6 });
  },
  drummer(t, s, b) {
    if (s % 2 && b % 8 === 7) noise(t, .1, .18, 'bandpass', 1600, .8);
    if (!s && b % 2) { noise(t, .18, .25, 'bandpass', 2000, .7); osc('triangle', 190, t, .08, .16, bus, { to: 140 }); }
    if (s === 2) noise(t, .05, .06, 'highpass', 6000);
  },
  bassist(t, s, b, L, c) {
    if (s === 3 || s === 1) return;
    filtered('sawtooth', mtof(ROOTS[c] + (s === 2 ? 7 : 0)), t, L * .22, .16, 700, { q: 8, det: 15, open: 4 });
  },
  guitar(t, s, b, L, c) {
    const ph = b % 8;
    if (s || !(ph === 3 || ph === 7 || ph === 1 || ph === 5)) return;
    const loud = ph === 3 || ph === 7, r = ROOTS[c] + 24;
    for (const n of [r, r + 7, r + 12]) filtered('square', mtof(n), t, L * (loud ? .5 : .15), loud ? .07 : .03, loud ? 2400 : 900, { det: 12, q: 1.5 });
  },
  singer(t, s, b, L, c) {
    const ph = b % 8;
    if (s || !(ph === 0 || ph === 2 || ph === 6)) return;
    const n = CHORDS[c][ph === 0 ? 2 : ph === 2 ? 1 : 0] + 12;
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 900; fl.Q.value = 3;
    const sv = ctx.createGain(); sv.gain.value = .5; fl.connect(bus); fl.connect(sv); sv.connect(verb);
    osc('sawtooth', mtof(n), t, L * 1.6, .2, fl, { a: .05 });
  },
};

// ------------------------------------------------------------ the song
// start(bpm, layersFn): count-in of 4 sticks, then beat 0. Returns heard time of beat 0.
export function start(bpm, layers) {
  stop();
  const L = 60 / bpm, t0 = now() + .25 + 4 * L;
  song = { bpm, L, t0, layers, step: -16, chordAt: 0 };
  if (ctx) {
    const ct = t0 - ctxOff + lat();
    for (let i = 4; i >= 1; i--) osc('square', i === 4 ? 1500 : 1100, ct - i * L, .03, .12);
    song.step = 0; song.ct0 = ct;
    timer = setInterval(pump, 25); pump();
  }
  return t0;
}
export function stop() { if (timer) clearInterval(timer); timer = null; song = null; }
export const playing = () => !!song;

function pump() {
  if (!song || !ctx || ctx.state !== 'running') return;
  const ahead = ctx.currentTime + .12, sixteenth = song.L / 4;
  while (song.ct0 + song.step * sixteenth < ahead) {
    const i = song.step, t = song.ct0 + i * sixteenth, b = Math.floor(i / 4), s = i % 4, c = Math.floor(b / 8) % 4;
    if (t > ctx.currentTime - .02) {
      const on = song.layers(b);
      for (const p of on) PART[p]?.(t, s, b, song.L, c);
    }
    song.step++;
  }
}

// ------------------------------------------------------------ effects
const at = () => ctx ? ctx.currentTime + .005 : 0;
export function sfx(n, o = {}) {
  if (!ctx || ctx.state !== 'running') return;
  const t = at();
  switch (n) {
    case 'hit': noise(t, .07, .3, 'bandpass', 1200, 1); osc('square', 300, t, .06, .12, bus, { to: 120 }); break;
    case 'kill': osc('square', 520, t, .08, .12); osc('square', 780, t + .06, .1, .1); noise(t, .12, .2, 'highpass', 3000); break;
    case 'boss': for (let i = 0; i < 5; i++) osc('square', 300 + i * 120, t + i * .05, .1, .12); noise(t, .5, .25, 'bandpass', 900, .5); break;
    case 'bump': osc('triangle', 110, t, .08, .2, bus, { to: 70 }); break;
    case 'miss': osc('sawtooth', 160, t, .16, .12, bus, { to: 90 }); noise(t, .1, .1, 'lowpass', 600); break;
    case 'hurt': osc('sawtooth', 420, t, .35, .2, bus, { to: 80 }); noise(t, .3, .3, 'lowpass', 1400); break;
    case 'halo': osc('sine', 1400, t, .3, .15, bus, { to: 700 }); break;
    case 'pickup': [0, 4, 7, 12].forEach((d, i) => osc('square', mtof(72 + d), t + i * .055, .09, .09)); break;
    case 'relic': [0, 4, 7, 12, 16, 19].forEach((d, i) => filtered('sawtooth', mtof(69 + d), t + i * .06, .25, .08, 2200, { send: .4 })); break;
    case 'lose': [12, 7, 3, 0].forEach((d, i) => osc('triangle', mtof(64 + d), t + i * .07, .12, .14)); break;
    case 'zap': osc('sawtooth', 1800, t, .14, .07, bus, { to: 400 }); break;
    case 'shove': osc('sine', 90, t, .2, .4, bus, { to: 50 }); noise(t, .15, .18, 'lowpass', 500); break;
    case 'dash': noise(t, .1, .1, 'bandpass', 3000, 2); break;
    case 'blast': for (const n of [45, 52, 57]) filtered('sawtooth', mtof(n), t, .3, .1, 1800, { det: 10 }); break;
    case 'stairs': [0, -3, -7, -12].forEach((d, i) => osc('square', mtof(76 + d), t + i * .08, .12, .09)); break;
    case 'click': osc('square', 1800, t, .02, .06); break;
    case 'dead': osc('sawtooth', 220, t, 1.2, .2, bus, { to: 30, glide: 1.2 }); break;
    case 'cheer':
      for (let i = 0; i < 26; i++) noise(t + Math.random() * 1.2, .2 + Math.random() * .5, .05 + Math.random() * .05, 'bandpass', 900 + Math.random() * 2500, 1.5);
      for (let i = 0; i < 6; i++) osc('sine', 1400 + Math.random() * 900, t + .3 + Math.random(), .25, .04, bus, { to: 2200 });
      break;
  }
}
