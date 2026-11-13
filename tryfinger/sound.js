// Everything is synthesized: wind, stone, steel, bells.
let ac = null, master = null, amb = null, muted = false;
try { muted = localStorage.getItem('tryfinger.mute') === '1'; } catch {}

export function unlock() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ac.destination);
    startAmbience();
  }
  if (ac.state === 'suspended') ac.resume();
}
export function setMuted(m) { muted = m; try { localStorage.setItem('tryfinger.mute', m ? '1' : '0'); } catch {} if (master) master.gain.value = m ? 0 : 0.7; }
export const isMuted = () => muted;

let noiseBuf = null;
function noise() {
  if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ac.createBufferSource(); s.buffer = noiseBuf; return s;
}
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function nz(freq, q, peak, a, d, type = 'bandpass', sweep) {
  if (!ac) return; const t = ac.currentTime, s = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + a + d); f.Q.value = q;
  s.connect(f); f.connect(g); g.connect(master); env(g, t, a, peak, d); s.start(t, Math.random()); s.stop(t + a + d + 0.05);
}
function tone(freq, type, peak, a, d, to, delay = 0) {
  if (!ac) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
  o.connect(g); g.connect(master); env(g, t, a, peak, d); o.start(t); o.stop(t + a + d + 0.05);
}
function bell(f, peak = 0.12, d = 2.5, delay = 0) { [1, 2.76, 5.4, 0.5].forEach((m, i) => tone(f * m, 'sine', peak / (i + 1), 0.005, d / (i * 0.6 + 1), null, delay)); }

function startAmbience() {
  const s = noise(); s.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
  const g = ac.createGain(); g.gain.value = 0.05;
  const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 180; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
  s.connect(f); f.connect(g); g.connect(master); s.start();
  const d1 = ac.createOscillator(), d2 = ac.createOscillator(), dg = ac.createGain();
  d1.frequency.value = 55; d2.frequency.value = 82.6; d1.type = d2.type = 'sine'; dg.gain.value = 0.025;
  d1.connect(dg); d2.connect(dg); dg.connect(master); d1.start(); d2.start();
  amb = { g, dg };
}
export function setDepth(k, fight) {
  if (!amb) return; const t = ac.currentTime;
  amb.g.gain.setTargetAtTime(0.05 * (1 - k * 0.5), t, 1);
  amb.dg.gain.setTargetAtTime(fight ? 0.07 : 0.02 + k * 0.03, t, 1);
}

export const sfx = {
  swing() { nz(1800, 1.2, 0.18, 0.01, 0.14, 'bandpass', 600); },
  eswing() { nz(900, 1, 0.14, 0.01, 0.18, 'bandpass', 300); },
  hit(boss) { nz(400, 0.8, 0.35, 0.002, 0.12, 'lowpass', 120); tone(boss ? 90 : 140, 'triangle', 0.25, 0.002, 0.12, 50); },
  hurt() { nz(300, 0.7, 0.4, 0.002, 0.25, 'lowpass', 80); tone(110, 'sawtooth', 0.12, 0.005, 0.2, 55); },
  clink() { tone(1900, 'triangle', 0.08, 0.001, 0.12); tone(2700, 'sine', 0.05, 0.001, 0.08); },
  jump() { nz(500, 1, 0.06, 0.01, 0.08); },
  land(hard) { nz(220, 0.7, hard ? 0.22 : 0.1, 0.003, 0.12, 'lowpass'); },
  roll() { nz(350, 0.8, 0.14, 0.02, 0.25, 'lowpass', 150); },
  drink() { tone(300, 'sine', 0.06, 0.02, 0.2, 420); tone(420, 'sine', 0.05, 0.02, 0.2, 520, 0.2); },
  healed() { bell(880, 0.06, 1.2); },
  empty() { tone(160, 'square', 0.04, 0.005, 0.08); },
  read() { bell(1320, 0.035, 1.0); },
  verdict(lie) { if (lie) { tone(196, 'triangle', 0.12, 0.005, 0.5); tone(185, 'triangle', 0.1, 0.005, 0.6, null, 0.08); } else { bell(660, 0.08, 1.4); bell(990, 0.05, 1.4, 0.08); } nz(600, 0.5, 0.12, 0.002, 0.08, 'lowpass'); },
  rest() { bell(392, 0.08, 3); bell(587, 0.06, 3, 0.25); bell(784, 0.05, 3, 0.5); },
  died() { tone(98, 'sawtooth', 0.12, 0.05, 2.2, 49); bell(147, 0.1, 3); },
  chest() { tone(220, 'square', 0.04, 0.01, 0.1, 180); bell(1047, 0.07, 1.5, 0.15); bell(1319, 0.05, 1.5, 0.25); },
  mimic() { nz(250, 2, 0.3, 0.01, 0.3, 'bandpass', 900); tone(80, 'sawtooth', 0.15, 0.01, 0.4, 40); },
  bite() { nz(1200, 1, 0.25, 0.002, 0.08); },
  wall() { nz(200, 0.5, 0.3, 0.05, 1.0, 'lowpass', 2000); bell(523, 0.05, 2); },
  crack() { nz(900, 2, 0.2, 0.002, 0.15); nz(500, 2, 0.2, 0.002, 0.15); },
  collapse() { nz(150, 0.5, 0.5, 0.01, 1.2, 'lowpass', 60); },
  bridge() { bell(1568, 0.04, 1.5); },
  caw() { tone(700, 'sawtooth', 0.06, 0.01, 0.15, 450); tone(650, 'sawtooth', 0.05, 0.01, 0.15, 400, 0.18); },
  growl() { tone(90, 'sawtooth', 0.05, 0.05, 0.4, 70); },
  windup() { tone(520, 'triangle', 0.04, 0.01, 0.15, 900); },
  ghost() { tone(330, 'sine', 0.05, 0.3, 1.5, 300); tone(440, 'sine', 0.03, 0.3, 1.5, 415); },
  fight() { bell(110, 0.18, 4); bell(116, 0.12, 4, 0.02); },
  wwindup() { tone(70, 'sawtooth', 0.1, 0.1, 0.5, 60); },
  slam() { nz(120, 0.5, 0.6, 0.005, 0.6, 'lowpass', 40); tone(55, 'sine', 0.4, 0.005, 0.5, 30); },
  bellToll() { bell(98, 0.2, 3.5); },
  write() { nz(3000, 3, 0.04, 0.05, 0.9, 'bandpass', 2000); },
  sweep() { nz(400, 0.6, 0.3, 0.2, 0.6, 'bandpass', 1500); },
  bossDie() { bell(196, 0.2, 5); bell(294, 0.15, 5, 0.3); bell(392, 0.12, 5, 0.6); },
  win() { [392, 494, 587, 784].forEach((f, i) => bell(f, 0.08, 4, i * 0.3)); },
  wrote() { nz(2500, 2, 0.06, 0.02, 0.5, 'bandpass', 1500); bell(1175, 0.04, 1.2, 0.3); },
  ui() { tone(880, 'triangle', 0.03, 0.002, 0.05); },
  dodge() { tone(1500, 'sine', 0.03, 0.002, 0.15, 2200); },
};
