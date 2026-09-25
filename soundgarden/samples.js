// A worker that renders the garden's struck, plucked and natural sounds once, at startup, so the page stays smooth
// while it works: a felt piano, a handpan, singing bowls, wind chimes, birdsong, trickling water, footsteps and the
// click of a speaker's button. Nothing is recorded. Each sound is built from the physics of the thing: decaying
// partials at the right ratios, pairs of them beating against each other, the thump of a hand or a felt hammer.
// The main thread turns the arrays into AudioBuffers.

const TAU = Math.PI * 2;
const hz = m => 440 * 2 ** ((m - 69) / 12);
let SR = 44100;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// A sinusoid whose envelope is a sum of decaying exponentials (weights w, time constants taus), with a soft attack.
// Uses a recursive oscillator, which is exact and much cheaper than calling sin() every sample.
function mode(buf, f, amp, taus, w, att = .004, phase = 0, start = 0) {
  if (f >= SR * .45 || f <= 0) return;
  const om = TAU * f / SR, c = 2 * Math.cos(om);
  let y1 = Math.sin(phase - om), y2 = Math.sin(phase - 2 * om);
  const k = taus.length, ds = taus.map(t => Math.exp(-1 / (t * SR))), es = Float64Array.from(w);
  const attN = Math.max(1, att * SR | 0), n0 = start * SR | 0, N = buf.length;
  for (let n = n0, i = 0; n < N; n++, i++) {
    const y = c * y1 - y2; y2 = y1; y1 = y;
    let e = 0;
    for (let j = 0; j < k; j++) { e += es[j]; es[j] *= ds[j]; }
    const a = i < attN ? .5 - .5 * Math.cos(Math.PI * i / attN) : 1;
    buf[n] += amp * e * a * y;
    if (e < 2e-6 && i > attN) break;
  }
}
// Decaying noise, optionally through one-pole low- and high-pass filters.
function noise(buf, amp, tau, { lp = 0, hp = 0, start = 0, att = .0008, seed = 1, len = 0 } = {}) {
  const R = rng(seed), d = Math.exp(-1 / (tau * SR));
  const al = lp ? 1 - Math.exp(-TAU * lp / SR) : 1, ah = hp ? Math.exp(-TAU * hp / SR) : 0;
  let e = amp, l = 0, h = 0, prev = 0;
  const n0 = start * SR | 0, attN = Math.max(1, att * SR | 0), end = len ? Math.min(buf.length, n0 + len * SR) : buf.length;
  for (let n = n0, i = 0; n < end; n++, i++) {
    let x = R() * 2 - 1;
    l += al * (x - l); x = l;
    if (hp) { h = ah * (h + x - prev); prev = x; x = h; }
    buf[n] += x * e * (i < attN ? i / attN : 1);
    e *= d;
    if (e < 1e-6) break;
  }
}
// Noise through a two-pole resonator: breath, friction, rushing air.
function resonant(buf, f, q, envFn, amp, seed) {
  const R = rng(seed), r = Math.exp(-Math.PI * f / q / SR), c = 2 * r * Math.cos(TAU * f / SR), g = (1 - r * r) * .5;
  let y1 = 0, y2 = 0;
  for (let n = 0; n < buf.length; n++) {
    const y = g * (R() * 2 - 1) + c * y1 - r * r * y2; y2 = y1; y1 = y;
    buf[n] += y * amp * envFn(n / SR);
  }
}
function fade(buf, ins = .002, outs = .04) {
  const a = ins * SR | 0, b = outs * SR | 0, N = buf.length;
  for (let i = 0; i < a && i < N; i++) buf[i] *= i / a;
  for (let i = 0; i < b && i < N; i++) buf[N - 1 - i] *= i / b;
  return buf;
}
// Scale so the loudest part of the first `win` seconds has this RMS.
function level(buf, rms, win = .4) {
  const n = Math.min(buf.length, win * SR | 0);
  let s = 0; for (let i = 0; i < n; i++) s += buf[i] * buf[i];
  const k = rms / Math.max(1e-9, Math.sqrt(s / n));
  for (let i = 0; i < buf.length; i++) buf[i] *= k;
  return buf;
}
const make = secs => new Float32Array(Math.max(1, secs * SR | 0));

/* ---------- a felt piano ---------- */
// A piano with a strip of felt between the hammers and the strings: soft attacks, a dark warm tone, the thump of the
// action. Each note has up to eighteen partials, slightly stretched (stiff strings run sharp), two detuned strings
// each so they beat, and the piano's two-stage decay: a quick fall, then a long ringing tail.
function piano(m, seed) {
  const f0 = hz(m), R = rng(seed);
  const tau0 = Math.min(4.6, Math.max(1.2, 4.6 * 2 ** (-(m - 52) / 15)));
  const buf = make(Math.min(7, tau0 * 1.45 + 1.1));
  const B = .00014 * 2 ** ((m - 60) / 14);
  const fc = 1000 + 22 * (m - 40);
  for (let n = 1; n <= 18; n++) {
    const fn = n * f0 * Math.sqrt(1 + B * n * n);
    if (fn > 6000) break;
    const a = 1 / n ** .8 / (1 + (fn / fc) ** 2.6) * (.3 + .7 * Math.abs(Math.sin(Math.PI * n * .137))) * (.85 + .3 * R());
    const tn = tau0 / (1 + .2 * (n - 1) + fn / 3800);
    for (let s = 0; s < 2; s++) {
      const det = (s ? 1 : -1) * (.12 + .22 * R()) * (1 + n * .03);
      mode(buf, fn + det, a * .5, [tn * .14, tn], [.5, .5], .006 + .004 * R(), R() * TAU);
    }
  }
  noise(buf, .05, .014, { lp: 900, seed: seed + 7 });                 // felt on string
  mode(buf, 90 + R() * 30, .045, [.035], [1], .002, 0);                 // the key hitting its bed
  noise(buf, .012, .03, { lp: 2400, hp: 400, seed: seed + 9, start: .01 });
  return fade(level(buf, .16, .35), .001, Math.min(1.6, buf.length / SR * .3));
}

/* ---------- a handpan ---------- */
// A steel shell hammered into tuned domes. Each dome rings at its note, the octave above and a twelfth above,
// which bloom a moment after the strike; each is really a pair of modes a fraction of a hertz apart, which is where
// the shimmer comes from. The hand adds a soft low thump.
function handpan(m, seed) {
  const f = hz(m), R = rng(seed), buf = make(5.6);
  const modes = [[1, 1, 3.3, .003], [2, .62, 2.3, .03], [3, .24, 1.5, .012], [2.43, .025, .22, .002], [4.02, .035, .42, .003], [5.07, .02, .28, .002], [6.3, .012, .17, .002]];
  for (const [r, a, t, att] of modes) {
    const split = .25 + .3 * R(), fr = f * r * (1 + (R() - .5) * .0015);
    mode(buf, fr - split / 2, a * .55, [t], [1], att, R() * TAU);
    mode(buf, fr + split / 2, a * .45, [t * .88], [1], att, R() * TAU);
  }
  noise(buf, .2, .016, { lp: 280, seed });
  noise(buf, .035, .004, { lp: 2600, seed: seed + 1 });
  return fade(level(buf, .2, .3), .001, 1.4);
}
function tak(seed) {                                          // a fingertip slap on the rim
  const R = rng(seed), buf = make(.35);
  noise(buf, .5, .006, { lp: 5000, hp: 1400, seed });
  for (const [f, a, t] of [[1170, .2, .05], [1790, .14, .035], [2630, .08, .025], [3420, .05, .02]]) mode(buf, f * (1 + (R() - .5) * .04), a, [t], [1], .0008, R() * TAU);
  return fade(level(buf, .12, .08), .0005, .05);
}

/* ---------- singing bowls ---------- */
// Struck with a padded mallet: a hum that lasts and lasts, over partials at the bowl's odd ratios. Each partial is
// a pair of close modes, so the tone throbs slowly.
function bowl(m, seed) {
  const f = hz(m), R = rng(seed), buf = make(15);
  const k = (hz(50) / f) ** .35;
  const modes = [[1, 1, 11], [2.72, .48, 6.2], [5.17, .24, 3.1], [8.46, .085, 1.7], [12.4, .03, .85]];
  modes.forEach(([r, a, t], i) => {
    const fr = f * r * (1 + (R() - .5) * .006), b = [.85, 1.8, 3.1, 4.4, 5.9][i] * (.8 + .4 * R());
    mode(buf, fr - b / 2, a * .5, [t * k], [1], .007, R() * TAU);
    mode(buf, fr + b / 2, a * .5, [t * k * .93], [1], .007, R() * TAU);
  });
  noise(buf, .04, .006, { lp: 3200, hp: 700, seed });
  return fade(level(buf, .16, 1), .001, 3.5);
}
// Sung: a mallet run round the rim. The tone swells up out of nothing, wah-wahs as the mallet circles, and fades.
function sungBowl(m, seed) {
  const f = hz(m), R = rng(seed), buf = make(14);
  const env = t => t < 5 ? .5 - .5 * Math.cos(Math.PI * t / 5) : t < 8.5 ? 1 : t < 13.5 ? .5 + .5 * Math.cos(Math.PI * (t - 8.5) / 5) : 0;
  const rot = 1.05 + R() * .2, p1 = R() * TAU, p2 = R() * TAU;
  for (let n = 0; n < buf.length; n++) {
    const t = n / SR, e = env(t), w = Math.sin(TAU * rot * t);
    buf[n] += e * (1 + .42 * w) * Math.sin(TAU * f * t + p1) * .8 + e * e * (1 + .5 * Math.sin(TAU * rot * t + 1.3)) * Math.sin(TAU * f * 2.72 * t + p2) * .22;
  }
  resonant(buf, f * 2.72, 60, t => env(t) * env(t), .5, seed + 3);
  return fade(level(buf, .15, 9), .01, .5);
}

/* ---------- wind chimes ---------- */
// Aluminium tubes, free at both ends, so the partials sit at 1 : 2.76 : 5.40 : 8.93, which is what makes a chime
// sound like a chime and not a bell. A wooden clapper knocks them.
function chime(m, seed) {
  const f = hz(m), R = rng(seed), buf = make(6.5);
  const k = (hz(86) / f) ** .4;
  [[1, 1, 4.2], [2.757, .45, 2.1], [5.404, .2, .9], [8.933, .07, .45]].forEach(([r, a, t], i) => {
    const b = [.5, 1.2, 2, 2.8][i];
    mode(buf, f * r - b / 2, a * .5, [t * k], [1], .0012, R() * TAU);
    mode(buf, f * r + b / 2, a * .5, [t * k * .95], [1], .0012, R() * TAU);
  });
  noise(buf, .07, .0025, { hp: 2400, seed });
  return fade(level(buf, .1, 2), .0005, 1.8);
}

/* ---------- birds ---------- */
// A whistle that glides from f0 to f1 with a little warble, like a note of birdsong.
function whistle(buf, t0, dur, f0, f1, amp, warble = 0, harm = .12, shape = .5) {
  const n0 = t0 * SR | 0, N = dur * SR | 0;
  let ph = 0;
  for (let i = 0; i < N && n0 + i < buf.length; i++) {
    const u = i / N, s = u < shape ? (u / shape) * (u / shape) * (3 - 2 * (u / shape)) : 1;
    const f = (f0 + (f1 - f0) * (u * u * (3 - 2 * u))) * (1 + .025 * Math.sin(TAU * warble * i / SR));
    ph += TAU * f / SR;
    const e = Math.min(1, u / .08) * Math.pow(1 - u, 1.4) * (.6 + .4 * s);
    buf[n0 + i] += amp * e * (Math.sin(ph) + harm * Math.sin(2 * ph));
  }
}
function blackbird(seed) {                                      // a fluting phrase, then a twitter
  const R = rng(seed), buf = make(3.2);
  let t = .05;
  const base = 1450 + R() * 650, notes = 4 + (R() * 4 | 0);
  for (let i = 0; i < notes; i++) {
    const d = .09 + R() * .2, f0 = base * (.8 + R() * .6), f1 = f0 * (.72 + R() * .6);
    whistle(buf, t, d, f0, f1, .5 + R() * .5, 20 + R() * 40);
    t += d + .025 + R() * .08;
  }
  const tw = 3 + (R() * 5 | 0);
  for (let i = 0; i < tw && t < 3; i++) { whistle(buf, t, .022 + R() * .02, 4100 + R() * 1900, 3700 + R() * 2100, .22, 0, .05); t += .042 + R() * .02; }
  return fade(level(buf, .09, 2.5), .001, .05);
}
function robin(seed) {                                          // thin, high, quick
  const R = rng(seed), buf = make(2.4);
  let t = .04;
  while (t < 2.1) {
    const d = .03 + R() * .09, f0 = 3000 + R() * 3600;
    whistle(buf, t, d, f0, f0 * (.8 + R() * .5), .4 + R() * .5, 60 + R() * 40, .06);
    t += d + .012 + R() * .05;
    if (R() < .12) t += .15;
  }
  return fade(level(buf, .07, 2), .001, .05);
}
function pigeon(seed) {                                         // a wood pigeon: coo-COO-coo, coo-coo
  const R = rng(seed), buf = make(2.6), f = 390 + R() * 40;
  for (const [t, d, a, bend] of [[0, .3, .65, 1.08], [.4, .52, 1, 1.12], [1.02, .3, .7, 1.05], [1.52, .27, .7, 1.06], [1.9, .32, .62, 1.04]]) {
    const n0 = t * SR | 0, N = d * SR | 0;
    let ph = 0;
    for (let i = 0; i < N; i++) {
      const u = i / N, fr = f * (1 + (bend - 1) * Math.sin(Math.PI * Math.min(1, u * 1.6))) * (1 - .04 * u);
      ph += TAU * fr / SR;
      const e = a * Math.min(1, u / .14) * Math.min(1, (1 - u) / .3);
      buf[n0 + i] += e * (Math.sin(ph) + .32 * Math.sin(2 * ph) + .08 * Math.sin(3 * ph));
    }
  }
  resonant(buf, f * 1.02, 6, t => t < 2.3 ? .18 : 0, .5, seed);
  const lp = 1 - Math.exp(-TAU * 1400 / SR); let l = 0;
  for (let i = 0; i < buf.length; i++) { l += lp * (buf[i] - l); buf[i] = l; }
  return fade(level(buf, .1, 2.4), .01, .1);
}

/* ---------- water ---------- */
// A trickle: hundreds of little bubbles, each a tiny rising chirp, over a soft hiss. Loops seamlessly.
function water(seed, secs = 7) {
  const R = rng(seed), buf = make(secs + .5);
  const nb = secs * 46 | 0;
  for (let k = 0; k < nb; k++) {
    const t0 = R() * secs, f0 = 320 + R() ** 2.2 * 1500, tau = .008 + R() * .026, a = (.08 + R() * .35) * (f0 < 700 ? 1.3 : 1);
    const n0 = t0 * SR | 0, N = Math.min(buf.length - n0, tau * 6 * SR | 0);
    let ph = 0;
    for (let i = 0; i < N; i++) {
      const tt = i / SR, e = Math.exp(-tt / tau) * Math.min(1, i / (SR * .0015));
      ph += TAU * f0 * (1 + 1.8 * tt / tau * .25) / SR;
      buf[n0 + i] += a * e * Math.sin(ph);
    }
  }
  noise(buf, .05, 1e9, { lp: 1600, hp: 250, seed: seed + 5 });
  // wrap the overhang onto the start so it loops
  const L = secs * SR | 0, out = new Float32Array(L);
  for (let i = 0; i < buf.length; i++) out[i % L] += buf[i];
  return level(out, .1, secs);
}

/* ---------- footsteps and the button ---------- */
function step(kind, seed) {
  const R = rng(seed), buf = make(.32);
  const grains = (n, lo, hi, span, amp) => {
    for (let i = 0; i < n; i++) {
      const t = .004 + R() ** 1.7 * span, f = lo + R() * (hi - lo);
      mode(buf, f, amp * (.3 + R()), [.0015 + R() * .004], [1], .0003, R() * TAU, t);
      noise(buf, amp * .5 * R(), .0012 + R() * .002, { hp: f * .5, lp: f * 1.5, start: t, seed: seed * 31 + i });
    }
  };
  if (kind === 'gravel') { grains(55, 1800, 6500, .13, .12); noise(buf, .25, .025, { lp: 220, seed }); }
  else if (kind === 'bark') { grains(22, 700, 2600, .1, .1); noise(buf, .3, .03, { lp: 180, seed }); noise(buf, .06, .05, { lp: 1500, hp: 300, seed: seed + 2 }); }
  else if (kind === 'leaves') { grains(28, 1200, 4500, .14, .1); noise(buf, .1, .06, { lp: 2800, hp: 500, seed: seed + 3 }); noise(buf, .2, .03, { lp: 200, seed }); }
  else if (kind === 'stone') { noise(buf, .5, .018, { lp: 260, seed }); noise(buf, .1, .003, { hp: 2000, lp: 7000, seed: seed + 4 }); mode(buf, 180 + R() * 60, .08, [.02], [1], .001, 0); }
  else { noise(buf, .14, .07, { lp: 2400, hp: 400, att: .02, seed }); grains(8, 1500, 4000, .08, .03); noise(buf, .2, .025, { lp: 160, seed: seed + 1 }); }
  return fade(level(buf, .07, .15), .001, .06);
}
function click(on, seed) {
  const R = rng(seed), buf = make(.25);
  const tick = (t, a) => {
    noise(buf, a, .0014, { hp: 2800, start: t, seed: seed + t * 1000 | 0 });
    mode(buf, 2150 + R() * 200, a * .3, [.012], [1], .0003, 0, t);
    mode(buf, 3500 + R() * 300, a * .15, [.007], [1], .0003, 0, t);
  };
  tick(0, .9); tick(on ? .07 : .05, .45);
  return fade(level(buf, .055, .1), .0003, .03);
}

/* ---------- the list ---------- */
const PIANO = [43, 45, 47, 50, 52, 54, 55, 57, 59, 61, 62, 64, 66, 67, 69, 71, 73, 74, 76, 78, 79, 81, 83, 85, 86];
const HANDPAN = [50, 57, 59, 61, 62, 64, 66, 67, 69];
const BOWLS = [50, 57, 62, 64];
const CHIMES = [86, 88, 90, 93, 95, 98];

self.onmessage = e => {
  SR = e.data.sr;
  const out = {}, transfer = [];
  const put = (group, key, arr) => { (out[group] ||= {})[key] = arr; transfer.push(arr.buffer); };
  // The instruments first, in the order the speakers are likeliest to be found; then the garden.
  for (const m of PIANO) put('piano', m, piano(m, m * 13 + 1));
  for (const m of HANDPAN) put('handpan', m, handpan(m, m * 7 + 3));
  put('handpan', 'tak', tak(5)); put('handpan', 'tak2', tak(9));
  for (const m of BOWLS) put('bowl', m, bowl(m, m * 11 + 2));
  put('sung', 50, sungBowl(50, 4)); put('sung', 57, sungBowl(57, 8));
  for (const m of CHIMES) put('chime', m, chime(m, m * 5 + 1));
  for (let i = 0; i < 4; i++) put('bird', 'blackbird' + i, blackbird(100 + i));
  for (let i = 0; i < 2; i++) put('bird', 'robin' + i, robin(200 + i));
  for (let i = 0; i < 2; i++) put('bird', 'pigeon' + i, pigeon(300 + i));
  put('water', 'trickle', water(7));
  for (const k of ['gravel', 'grass', 'bark', 'leaves', 'stone']) for (let i = 0; i < 4; i++) put('step', k + i, step(k, 400 + i * 17 + k.length * 101));
  put('ui', 'on', click(true, 3)); put('ui', 'off', click(false, 4));
  self.postMessage({ sr: SR, sounds: out }, transfer);
};
