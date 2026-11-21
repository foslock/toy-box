// Clockwork sounds, all synthesized: ticks, tinny jabs, springs, and a music box.
let ac = null, master = null, music = null, muted = false, tickT = 0, songT = 0, songOn = true;
try { muted = localStorage.getItem('dollhouse.mute') === '1'; } catch {}

export function unlock() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : 0.75; master.connect(ac.destination);
    music = ac.createGain(); music.gain.value = 0.5; music.connect(master);
  }
  if (ac.state === 'suspended') ac.resume();
}
export function setMuted(m) { muted = m; try { localStorage.setItem('dollhouse.mute', m ? '1' : '0'); } catch {} if (master) master.gain.value = m ? 0 : 0.75; }
export const isMuted = () => muted;

let noiseBuf = null;
function noise() {
  if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ac.createBufferSource(); s.buffer = noiseBuf; return s;
}
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function nz(freq, q, peak, a, d, type = 'bandpass', sweep, delay = 0) {
  if (!ac) return; const t = ac.currentTime + delay, s = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + a + d); f.Q.value = q;
  s.connect(f); f.connect(g); g.connect(master); env(g, t, a, peak, d); s.start(t, Math.random() * 0.5); s.stop(t + a + d + 0.05);
}
function tone(freq, type, peak, a, d, to, delay = 0, out) {
  if (!ac) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
  o.connect(g); g.connect(out || master); env(g, t, a, peak, d); o.start(t); o.stop(t + a + d + 0.05);
}
// a music box tine: bright fundamental, a quick inharmonic ping on top
function tine(f, peak = 0.08, delay = 0, out) { tone(f, 'sine', peak, 0.003, 1.6, null, delay, out); tone(f * 4.2, 'sine', peak * 0.25, 0.002, 0.15, null, delay, out); tone(f * 2, 'triangle', peak * 0.15, 0.003, 0.5, null, delay, out); }
const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
const SONG = [72, 76, 79, 76, 74, 77, 81, 77, 76, 79, 84, 79, 77, 74, 71, 74, 72, 76, 79, 84, 83, 79, 77, 74, 72, 0, 67, 0, 72, 0, 0, 0];
let songI = 0;

// called every frame with the real time step
export function update(dt, opts = {}) {
  if (!ac || muted) return;
  tickT -= dt;
  if (tickT <= 0) { tickT += 0.5; nz(opts.fast ? 5200 : 4200, 6, 0.018, 0.001, 0.03, 'bandpass'); }
  songT -= dt;
  if (songOn && songT <= 0) {
    songT += opts.boss ? 0.2 : 0.36;
    const n = SONG[songI++ % SONG.length];
    if (n) tine(N(n - (opts.boss ? 12 : 0)), opts.boss ? 0.05 : 0.035, 0, music);
    if (opts.boss && songI % 2 === 0) tone(N(36 + (songI % 8 < 4 ? 0 : 5)), 'triangle', 0.06, 0.005, 0.18, null, 0, music);
  }
}
export function setSong(on) { songOn = on; }

export const sfx = {
  jab() { nz(3000, 2, 0.12, 0.003, 0.08, 'bandpass', 1200); tone(1300, 'square', 0.025, 0.002, 0.05, 900); },
  hit() { tone(1800, 'triangle', 0.12, 0.001, 0.12, 1200); nz(1600, 3, 0.12, 0.001, 0.06); },
  pop() { tone(500, 'sine', 0.12, 0.004, 0.18, 120); nz(800, 1, 0.08, 0.005, 0.2, 'lowpass', 200); },
  clang() { tone(240, 'square', 0.06, 0.002, 0.3, 230); tone(613, 'triangle', 0.05, 0.002, 0.5); },
  jump() { tone(300, 'triangle', 0.08, 0.004, 0.14, 620); },
  land(v) { nz(300, 0.8, Math.min(0.18, 0.04 + v * 0.008), 0.003, 0.09, 'lowpass'); tone(2200, 'triangle', 0.02, 0.001, 0.04); },
  dash() { nz(900, 1, 0.16, 0.01, 0.22, 'bandpass', 3000); for (let i = 0; i < 4; i++) nz(4500, 8, 0.03, 0.001, 0.02, 'bandpass', null, i * 0.03); },
  umbrella() { nz(1800, 1, 0.08, 0.02, 0.12, 'highpass'); },
  clank() { tone(180, 'square', 0.05, 0.002, 0.12, 140); tone(900, 'triangle', 0.04, 0.001, 0.08); },
  kick() { tone(400, 'triangle', 0.06, 0.003, 0.1, 700); },
  shrink() { tone(900, 'sine', 0.08, 0.005, 0.3, 1800); },
  grow() { tone(1200, 'sine', 0.08, 0.005, 0.3, 500); },
  noroom() { tone(200, 'square', 0.04, 0.003, 0.12); },
  hurt() { tone(700, 'square', 0.07, 0.002, 0.25, 200); nz(500, 1, 0.12, 0.002, 0.2, 'lowpass', 100); },
  die() { for (let i = 0; i < 8; i++) tone(900 - i * 80, 'triangle', 0.05, 0.003, 0.12, null, i * 0.11); },
  medal() { [76, 79, 84, 88].forEach((n, i) => tine(N(n), 0.08, i * 0.07)); },
  spring() { tone(200, 'sine', 0.1, 0.005, 0.6, 1600); [72, 76, 79, 84].forEach((n, i) => tine(N(n), 0.06, 0.15 + i * 0.09)); },
  ability() { [72, 76, 79, 84, 79, 84, 88].forEach((n, i) => tine(N(n), 0.09, i * 0.11)); },
  rest() { for (let i = 0; i < 10; i++) nz(4800, 8, 0.05, 0.001, 0.02, 'bandpass', null, i * 0.07); [67, 72, 76].forEach((n, i) => tine(N(n), 0.05, 0.75 + i * 0.12)); },
  wake() { [72, 74, 76, 79, 81, 84, 86, 88].forEach((n, i) => tine(N(n), 0.07, i * 0.15)); },
  door() { nz(300, 1, 0.12, 0.05, 0.7, 'lowpass', 120); tone(160, 'sawtooth', 0.03, 0.2, 0.5, 120); },
  boing() { tone(220, 'sine', 0.14, 0.005, 0.35, 660); tone(180, 'triangle', 0.05, 0.005, 0.3, 500); },
  whoosh() { nz(600, 1, 0.12, 0.05, 0.18, 'bandpass', 2500); },
  thud() { tone(90, 'sine', 0.22, 0.003, 0.25, 45); nz(200, 0.8, 0.18, 0.003, 0.15, 'lowpass'); },
  bosshit() { tone(1500, 'triangle', 0.12, 0.001, 0.15, 900); tone(300, 'square', 0.05, 0.002, 0.1, 150); },
  bossdie() { for (let i = 0; i < 12; i++) tone(600 + Math.random() * 600, 'triangle', 0.04, 0.003, 0.1, null, i * 0.08); },
  mew() { tone(700, 'sawtooth', 0.025, 0.08, 0.35, 450); },
  hiss() { nz(5000, 0.7, 0.12, 0.02, 0.4, 'highpass'); },
  yowl() { tone(600, 'sawtooth', 0.05, 0.1, 0.9, 300); tone(900, 'sawtooth', 0.03, 0.1, 0.8, 380); },
  swish() { nz(700, 1, 0.12, 0.15, 0.4, 'bandpass', 1800); },
  roar() { tone(70, 'sawtooth', 0.08, 0.1, 0.8, 110); nz(400, 1, 0.12, 0.1, 0.8, 'lowpass', 1200); },
  crash() { nz(200, 0.7, 0.3, 0.003, 0.4, 'lowpass'); tone(80, 'square', 0.08, 0.003, 0.3, 40); },
  spit() { tone(300, 'square', 0.05, 0.003, 0.1, 100); nz(1000, 1, 0.08, 0.003, 0.1); },
  page() { nz(2600, 1, 0.04, 0.01, 0.08, 'highpass'); },
  room() { tine(N(84), 0.03); tine(N(91), 0.02, 0.1); },
  ending() { [72, 76, 79, 84, 83, 79, 76, 72, 74, 77, 81, 86, 84].forEach((n, i) => tine(N(n), 0.08, i * 0.25)); },
};
