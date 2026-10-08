// Every sound in the room, made with WebAudio: card snaps, chip ticks, the adding machine, the till, a match, and a
// quiet lounge trio (walking bass, brushes, a few piano chords) that plays while you think.
let ac = null, out = null, sfx = null, music = null, noise = null, loopTimer = 0, looping = false;
let mode = 2;   // 2 everything, 1 sound but no music, 0 silent
try { const m = localStorage.getItem('fivebyfive.sound'); if (m !== null) mode = +m; } catch {}

function boot() {
  if (ac) return ac.state === 'suspended' ? ac.resume() : null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  out = ac.createDynamicsCompressor(); out.threshold.value = -14; out.ratio.value = 4; out.connect(ac.destination);
  sfx = ac.createGain(); sfx.gain.value = mode ? .9 : 0; sfx.connect(out);
  music = ac.createGain(); music.gain.value = mode === 2 ? .32 : 0; music.connect(out);
  const len = ac.sampleRate, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noise = buf;
}
const now = () => ac.currentTime;
function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dec); }
function tone(type, f, t, a, peak, dec, dest = sfx, glide) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + a + dec);
  env(g, t, a, peak, dec); o.connect(g).connect(dest); o.start(t); o.stop(t + a + dec + .05);
  return o;
}
function hiss(t, dur, peak, type, f, q = 1, dest = sfx, f2) {
  const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noise; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, .003, peak, dur); s.connect(fl).connect(g).connect(dest); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
}

export const Sound = {
  get mode() { return mode; },
  cycle() {
    mode = (mode + 2) % 3;
    try { localStorage.setItem('fivebyfive.sound', mode); } catch {}
    if (ac) { sfx.gain.value = mode ? .9 : 0; music.gain.value = mode === 2 ? .32 : 0; }
    if (mode === 2) this.lounge(true); else this.lounge(false);
    return mode;
  },
  wake() { boot(); if (mode === 2) this.lounge(true); },
  play(name, v = 0) {
    if (!ac || !mode) return;
    const t = now() + .005;
    switch (name) {
      case 'deal': hiss(t, .09, .25, 'highpass', 2500, .7, sfx, 6000); break;
      case 'snap': hiss(t, .05, .7, 'bandpass', 1800, 1.4); tone('sine', 150, t, .002, .5, .08); break;
      case 'tick': tone('square', 700 + v * 45, t, .001, .07, .05); tone('sine', 1400 + v * 90, t, .001, .1, .04); break;
      case 'mult': tone('sawtooth', 220, t, .004, .12, .16); tone('sawtooth', 277, t, .004, .1, .16); tone('sawtooth', 330, t, .004, .1, .16); hiss(t, .06, .2, 'bandpass', 900, 2); break;
      case 'xmult': [196, 247, 294, 392].forEach((f, i) => tone('sawtooth', f, t + i * .012, .004, .1, .32)); tone('sine', 1568, t + .05, .002, .18, .5); break;
      case 'chunk': hiss(t, .04, .8, 'lowpass', 1200); tone('square', 90, t, .002, .25, .06); hiss(t + .07, .03, .5, 'bandpass', 3000, 3); break;
      case 'ding': tone('sine', 1568, t, .002, .35, 1.1); tone('sine', 2093, t, .002, .22, .9); tone('sine', 3136, t, .002, .08, .5); break;
      case 'slam': tone('sine', 70, t, .003, .9, .35, sfx, 40); hiss(t, .12, .5, 'lowpass', 500); break;
      case 'burn': hiss(t, .25, .5, 'bandpass', 1200, 3, sfx, 5000); hiss(t + .2, .5, .18, 'lowpass', 900); break;
      case 'coin': [2637, 3520].forEach((f, i) => tone('sine', f, t + i * .06, .001, .2, .25)); break;
      case 'buzz': tone('square', 110, t, .005, .15, .25); tone('square', 104, t, .005, .15, .25); break;
      case 'boss': [65.4, 98, 130.8].forEach(f => { tone('sawtooth', f, t, .02, .22, .9); tone('sawtooth', f * 1.01, t, .02, .18, .9); }); hiss(t, .5, .15, 'lowpass', 300); break;
      case 'lose': [[392, 0], [370, .3], [349, .6], [330, .9]].forEach(([f, d], i) => tone('sawtooth', f / 2, t + d, .02, .2, i === 3 ? .9 : .26, sfx, i === 3 ? f / 2.6 : undefined)); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, t + i * .085, .004, .3, .3)); break;
      case 'tap': tone('sine', 900, t, .001, .08, .03); break;
      case 'tick-clock': tone('square', 1800, t, .001, .05, .02); break;
    }
  },
  // The lounge: a ii-V-I loop in F, swung, at a tempo for thinking.
  lounge(on) {
    if (!ac || (on && looping && mode === 2)) return;
    clearTimeout(loopTimer);
    looping = false;
    if (!on || mode !== 2) return;
    looping = true;
    const beat = 60 / 92, bars = [[55, 'Gm7', [67, 70, 74, 77]], [48, 'C7', [64, 67, 70, 74]], [53, 'Fmaj7', [65, 69, 72, 76]], [50, 'D7', [66, 69, 72, 74]]];
    const walk = { 55: [55, 58, 62, 61], 48: [48, 52, 55, 54], 53: [53, 57, 60, 58], 50: [50, 54, 57, 56] };
    const m2f = m => 440 * 2 ** ((m - 69) / 12);
    let t0 = now() + .1, bar = 0;
    const schedule = () => {
      if (mode !== 2) { looping = false; return; }
      for (let k = 0; k < 2; k++) {
        const [root, , chord] = bars[bar % 4], t = t0;
        walk[root].forEach((m, i) => tone('triangle', m2f(m - 12), t + i * beat, .01, .32, beat * .8, music));
        for (let i = 0; i < 4; i++) {
          hiss(t + i * beat, .09, i % 2 ? .07 : .04, 'highpass', 7000, .5, music);
          hiss(t + i * beat + beat * .66, .04, .03, 'highpass', 8000, .5, music);
        }
        if (bar % 2 === 0 || Math.random() < .5) chord.forEach(m => tone('sine', m2f(m), t + beat * 1.66, .01, .05, beat * 1.4, music));
        t0 += beat * 4; bar++;
      }
      loopTimer = setTimeout(schedule, Math.max(50, (t0 - now() - beat * 4) * 1000));
    };
    schedule();
  },
};
