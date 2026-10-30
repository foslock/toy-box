// Small WebAudio synth: a few blips for movement and the unlock chime.

let ctx = null, master = null, muted = false;
try { muted = localStorage.getItem('unlocked.mute') === '1'; } catch {}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('unlocked.mute', m ? '1' : '0'); } catch {}
  if (master) master.gain.value = m ? 0 : .55;
}

export function wake() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : .55;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

const N = n => 440 * Math.pow(2, (n - 69) / 12);
const now = () => ctx.currentTime + .01;

function tone(f, t, dur, type = 'square', vol = .1, slide) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .005);
  g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
}
function noise(t, dur, vol = .1, freq = 2000) {
  const len = Math.ceil(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = .8;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}

const SFX = {
  jump: () => tone(330, now(), .12, 'square', .05, 660),
  double: () => tone(520, now(), .12, 'square', .05, 1040),
  land: () => noise(now(), .05, .08, 900),
  bump: () => { const t = now(); tone(140, t, .12, 'triangle', .2, 70); noise(t, .06, .1, 500); },
  spring: () => { const t = now(); tone(180, t, .35, 'triangle', .18, 900); tone(360, t, .25, 'square', .04, 1400); },
  flip: () => { const t = now(); tone(900, t, .25, 'sine', .14, 200); tone(1200, t + .05, .2, 'sine', .08, 300); },
  pickup: () => { const t = now(); tone(N(84), t, .08, 'square', .06); tone(N(91), t + .06, .12, 'square', .06); },
  die: () => { const t = now(); noise(t, .25, .25, 1400); tone(400, t, .3, 'square', .08, 60); },
  cord: () => { const t = now(); tone(2600, t, .03, 'square', .05); noise(t, .04, .1, 4000); },
  door: () => { const t = now(); tone(220, t, .2, 'triangle', .15, 330); },
  tap: () => tone(1500, now(), .03, 'square', .04),
  bird: () => { const t = now(); [0, .07, .14].forEach((d, i) => tone(2200 + i * 300, t + d, .06, 'sine', .06, 3000 + i * 200)); },
  // the unlock chime: a quick rising arpeggio, a bright top note and a soft thump under it
  unlock: (k = 0) => {
    const t = now(), base = 72 + [0, 2, 4, 5, 7][k % 5];
    tone(N(base - 24), t, .25, 'triangle', .22);
    [0, 4, 7, 12].forEach((s, i) => tone(N(base + s), t + i * .055, .16, 'square', .06));
    tone(N(base + 19), t + .24, .5, 'triangle', .1);
    tone(N(base + 24), t + .24, .5, 'sine', .07);
  },
  fanfare: () => {
    const t = now();
    [60, 64, 67, 72, 67, 72, 76, 79, 84].forEach((n, i) => tone(N(n), t + i * .09, .3, 'square', .06));
    [48, 55, 60].forEach((n, i) => tone(N(n), t + i * .27, .5, 'triangle', .2));
  },
};

export function sfx(name, arg) {
  if (!ctx || muted) return;
  try { SFX[name]?.(arg); } catch {}
}
