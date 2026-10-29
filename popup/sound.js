// MIDI-ish bleeps from WebAudio: square and triangle voices, a little noise, and a
// one-bar backing loop whose tempo follows the game speed.

let ctx = null, master = null, muted = false, loopOn = false, tempo = 1, nextBar = 0, bar = 0, timer = null;
try { muted = localStorage.getItem('popup.mute') === '1'; } catch {}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('popup.mute', m ? '1' : '0'); } catch {}
  if (master) master.gain.value = m ? 0 : .5;
}

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : .5;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  if (loopOn && !timer) loop(true);
}
export function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }

const N = n => 440 * Math.pow(2, (n - 69) / 12);

function tone(f, t, dur, type = 'square', vol = .12, o = {}) {
  if (!ctx) return;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(f, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
  if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = f * .03; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + .05); }
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006);
  g.gain.setValueAtTime(vol, t + Math.max(.01, dur - .04)); g.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(g); g.connect(o.dest || master); osc.start(t); osc.stop(t + dur + .02);
}
function noise(t, dur, vol = .1, hp = 2000, lp = 12000) {
  if (!ctx) return;
  const len = Math.ceil(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = buf;
  const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
  const l = ctx.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(h); h.connect(l); l.connect(g); g.connect(master); s.start(t);
}
const now = () => ctx ? ctx.currentTime + .01 : 0;
const seq = (notes, step, type = 'square', vol = .1, t0 = now()) => notes.forEach((n, i) => n != null && tone(N(n), t0 + i * step, step * .9, type, vol));

const SFX = {
  click: () => { tone(1800, now(), .025, 'square', .05); },
  close: () => { const t = now(); tone(900, t, .05, 'square', .08); tone(600, t + .05, .06, 'square', .07); },
  pop: () => { tone(300, now(), .09, 'square', .1, { slide: 1200 }); },
  hit: () => { const t = now(); noise(t, .12, .3, 300, 3000); tone(160, t, .12, 'triangle', .25, { slide: 60 }); },
  crunch: () => { const t = now(); noise(t, .08, .22, 1200, 9000); noise(t + .05, .07, .15, 2000, 8000); },
  swoosh: () => { noise(now(), .18, .12, 600, 4000); },
  tick: () => { tone(2400, now(), .02, 'square', .05); },
  bad: () => { const t = now(); tone(N(64), t, .14, 'square', .12); tone(N(57), t + .13, .3, 'square', .12); },
  ding: () => { const t = now(); tone(N(84), t, .5, 'triangle', .14); tone(N(91), t, .5, 'sine', .05); },
  good: () => seq([72, 76, 79, 84], .065, 'square', .09),
  win: () => { const t = now(); seq([67, 72, 76, 79, null, 76, 79], .075, 'square', .09, t); seq([55, 60, 64, 67], .15, 'triangle', .14, t); },
  lose: () => { const t = now(); seq([67, 63, 60, 55], .11, 'square', .1, t); tone(N(43), t, .45, 'triangle', .16); },
  speed: () => seq([60, 64, 67, 72, 76, 79, 84], .045, 'square', .08),
  boss: () => { const t = now(); for (let i = 0; i < 4; i++) { tone(N(52 + (i % 2) * 6), t + i * .16, .14, 'sawtooth', .07); } },
  startup: () => { const t = now(); seq([64, 71, 76, 79, 83], .14, 'triangle', .14, t); seq([52, 59, 64], .28, 'sine', .12, t); tone(N(88), t + .7, .9, 'sine', .06); },
  over: () => { const t = now(); seq([76, 72, 69, 64, 60], .16, 'triangle', .13, t); tone(N(40), t + .1, 1, 'sawtooth', .05); },
  print: () => { const t = now(); tone(140 + Math.random() * 30, t, .06, 'sawtooth', .06); noise(t, .05, .06, 3000, 9000); },
  type: () => { noise(now(), .02, .05, 3000, 10000); },
  jingle: () => seq([84, 88, 91, 88, 84, 88, 91, 96], .09, 'square', .13),
  save: () => { const t = now(); for (let i = 0; i < 5; i++) noise(t + i * .05, .04, .1, 800, 3000); tone(N(84), t + .28, .12, 'square', .07); },
  bsod: () => { const t = now(); tone(80, t, .5, 'sawtooth', .12); noise(t, .4, .1, 200, 2000); },
  connect: () => { const t = now(); seq([79, 84, 88], .06, 'square', .08, t); },
  busy: () => { const t = now(); tone(480, t, .25, 'square', .07); tone(620, t, .25, 'square', .05); tone(480, t + .4, .25, 'square', .07); tone(620, t + .4, .25, 'square', .05); },
};
export function sfx(name) { if (SFX[name]) SFX[name](); }

// a modem squeal for the DIAL IN game: kind is the waveform name the player sees
export function squeal(kind, f) {
  if (!ctx) return;
  const t = now();
  if (kind === 'noise') { noise(t, .5, .12, f * .8, f * 3); return; }
  const type = kind === 'pulse' ? 'square' : kind === 'saw' ? 'sawtooth' : kind;
  tone(f, t, .5, type, .07, { vib: kind === 'sine' ? 0 : 9 });
}

// ---- the backing loop: a bouncy bassline and hats, scheduled a bar ahead
const BASS = [[48, 0], [55, 2], [52, 3], [48, 4], [55, 6], [57, 7]];
const BASS2 = [[45, 0], [52, 2], [50, 3], [45, 4], [52, 6], [53, 7]];
export function setTempo(s) { tempo = s; }
export function loop(on) {
  loopOn = on;
  if (on && ctx && !timer) { nextBar = ctx.currentTime + .05; bar = 0; timer = setInterval(sched, 60); sched(); }
  if (!on && timer) { clearInterval(timer); timer = null; }
}
function sched() {
  if (!ctx || !loopOn) return;
  while (nextBar < ctx.currentTime + .25) {
    const step = 60 / (132 * tempo) / 2;
    const pat = (bar >> 1) % 2 ? BASS2 : BASS;
    for (const [n, i] of pat) tone(N(n - 12), nextBar + i * step, step * .8, 'triangle', .16);
    for (let i = 0; i < 8; i++) noise(nextBar + i * step, i % 2 ? .02 : .035, i % 2 ? .03 : .05, 6000, 14000);
    tone(N(36), nextBar, .08, 'sine', .25, { slide: 40 }); tone(N(36), nextBar + 4 * step, .08, 'sine', .25, { slide: 40 });
    nextBar += step * 8; bar++;
  }
}
