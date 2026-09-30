// A little sound for the narrator, all made with Web Audio: a soft key tick as the narrator types, a chime for an ending, a thud for
// a page being put away. Nothing plays until the first touch, and the speaker button in the corner turns it off.
let ctx = null, on = true, last = 0;
const get = () => {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};
export const setOn = v => { on = !!v; };
export const unlock = () => { if (on) get(); };

function noise(c, dur) {
  const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(); s.buffer = buf; return s;
}
export function tick() {
  if (!on || !ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime; if (t - last < 0.035) return; last = t;
  const s = noise(ctx, 0.018), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'bandpass'; f.frequency.value = 1900 + Math.random() * 900; f.Q.value = 1.2;
  g.gain.value = 0.05; s.connect(f); f.connect(g); g.connect(ctx.destination); s.start(t);
}
export function chime(notes = [523.25, 659.25, 783.99]) {
  const c = on && get(); if (!c) return;
  notes.forEach((hz, i) => {
    const t = c.currentTime + i * 0.16, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = hz; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 1.7);
  });
}
export function thud() {
  const c = on && get(); if (!c) return;
  const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
  g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.25);
}
export function ping() {
  const c = on && get(); if (!c) return;
  const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(880, t); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.32);
}
