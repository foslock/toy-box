// A small palm-court band: clarinet line, plucked bass and celesta, plus paper and shutter noises.
let ctx, out, musicG, on = true, timer = null, bar = 0;
export function setOn(v) { on = v; if (out) out.gain.setTargetAtTime(v ? 0.8 : 0, ctx.currentTime, 0.05); }
export function wake() {
  if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return; ctx = new A(); out = ctx.createGain(); out.gain.value = on ? 0.8 : 0; out.connect(ctx.destination); musicG = ctx.createGain(); musicG.gain.value = 0.5; musicG.connect(out); }
  if (ctx.state !== 'running') ctx.resume();
}
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
function tone(t, f, d, g, type = 'sine', dest = out, a = 0.005) {
  const o = ctx.createOscillator(), e = ctx.createGain(); o.type = type; o.frequency.value = f;
  e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + a); e.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(e).connect(dest); o.start(t); o.stop(t + d + 0.02); return o;
}
function noise(t, d, f, g, q = 1, type = 'bandpass') {
  const n = Math.ceil(ctx.sampleRate * d), b = ctx.createBuffer(1, n, ctx.sampleRate), x = b.getChannelData(0);
  for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 1.5;
  const s = ctx.createBufferSource(); s.buffer = b; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const e = ctx.createGain(); e.gain.value = g;
  s.connect(fl).connect(e).connect(out); s.start(t);
}
export const sfx = {
  open() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.14, 2600, 0.22, 0.7); noise(t + 0.06, 0.1, 4200, 0.12, 0.7); },
  close() { if (!ctx) return; noise(ctx.currentTime, 0.12, 1800, 0.16, 0.7); },
  word() { if (!ctx) return; const t = ctx.currentTime; tone(t, hz(84), 0.5, 0.12); tone(t, hz(91), 0.35, 0.05); },
  place() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.04, 900, 0.3, 1.5); tone(t, hz(60), 0.12, 0.12, 'triangle'); },
  wrong() { if (!ctx) return; const t = ctx.currentTime; [[0, 63], [0.22, 62], [0.44, 61]].forEach(([d, m]) => tone(t + d, hz(m), 0.26, 0.1, 'triangle', out, 0.03)); },
  stamp() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.12, 180, 0.9, 0.8, 'lowpass'); [72, 76, 79, 84].forEach((m, i) => tone(t + 0.14 + i * 0.07, hz(m), 0.9, 0.09)); },
  shutter() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.03, 3200, 0.5, 2); noise(t + 0.09, 0.05, 1400, 0.5, 2); noise(t, 0.7, 5200, 0.16, 0.4, 'highpass'); },
};
// “Lake of Stars”, a waltz in F. [chord root, third, fifth, seventh] and a melody of [beat, midi, length].
const CH = { F: [41, 57, 60, 64], Dm: [38, 57, 60, 65], Gm: [43, 58, 62, 65], C: [36, 58, 64, 67], Am: [45, 60, 64, 67], Bb: [46, 58, 62, 65], A: [45, 61, 64, 67] };
const TUNE = [
  ['F', [[0, 72, 2], [2, 69, 1]]], ['Dm', [[0, 65, 3]]], ['Gm', [[0, 70, 2], [2, 67, 1]]], ['C', [[0, 64, 3]]],
  ['F', [[0, 69, 1], [1, 72, 1], [2, 76, 1]]], ['A', [[0, 77, 2], [2, 73, 1]]], ['Dm', [[0, 74, 3]]], ['Dm', []],
  ['Bb', [[0, 74, 2], [2, 70, 1]]], ['F', [[0, 72, 2], [2, 69, 1]]], ['Gm', [[0, 70, 1], [1, 69, 1], [2, 67, 1]]], ['Am', [[0, 72, 3]]],
  ['Bb', [[0, 70, 1], [1, 74, 1], [2, 77, 1]]], ['C', [[0, 76, 1.5], [1.5, 74, 1.5]]], ['F', [[0, 72, 3]]], ['C', [[2, 67, 1]]],
];
function playBar() {
  const beat = 0.52, t = ctx.currentTime + 0.06, [c, mel] = TUNE[bar % TUNE.length], k = CH[c], rest = Math.floor(bar / TUNE.length) % 2 === 1;
  tone(t, hz(k[0]), 1.1, 0.16, 'triangle', musicG);
  for (const b of [1, 2]) k.slice(1).forEach((m) => tone(t + b * beat, hz(m), 0.5, 0.028, 'triangle', musicG, 0.01));
  if (rest) { const m = k[1 + (bar % 3)] + 12; tone(t + beat, hz(m), 1.2, 0.03, 'sine', musicG); }
  else for (const [b, m, l] of mel) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), e = ctx.createGain(), s = t + b * beat, d = l * beat; o.type = 'square'; o.frequency.value = hz(m); f.type = 'lowpass'; f.frequency.value = 1100;
    const v = ctx.createOscillator(), vg = ctx.createGain(); v.frequency.value = 5; vg.gain.value = 3; v.connect(vg).connect(o.frequency); v.start(s + 0.25); v.stop(s + d + 0.2);
    e.gain.setValueAtTime(0.0001, s); e.gain.linearRampToValueAtTime(0.06, s + 0.07); e.gain.setValueAtTime(0.05, s + Math.max(0.1, d - 0.1)); e.gain.linearRampToValueAtTime(0.0001, s + d + 0.06);
    o.connect(f).connect(e).connect(musicG); o.start(s); o.stop(s + d + 0.2);
  }
  bar++;
}
export function music(v) {
  if (!ctx || (v && timer)) return;
  clearInterval(timer); timer = null;
  if (v) { playBar(); timer = setInterval(() => { if (!document.hidden) playBar(); }, 1560); }
}
