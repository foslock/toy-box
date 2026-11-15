// Lantern: every sound is synthesized. Wind, steel, a cracked bell, the lamp's hiss.
let ac = null, master = null, muted = false, hiss = null;
try { muted = localStorage.getItem('lantern.mute') === '1'; } catch {}

export function unlock() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : 0.75; master.connect(ac.destination);
    ambience();
  }
  if (ac.state === 'suspended') ac.resume();
}
export function setMuted(m) { muted = m; try { localStorage.setItem('lantern.mute', m ? '1' : '0'); } catch {} if (master) master.gain.value = m ? 0 : 0.75; }
export const isMuted = () => muted;

let nb = null;
function noise() {
  if (!nb) { nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ac.createBufferSource(); s.buffer = nb; return s;
}
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function nz(freq, q, peak, a, d, type = 'bandpass', sweep, delay = 0) {
  if (!ac) return; const t = ac.currentTime + delay, s = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + a + d); f.Q.value = q;
  s.connect(f); f.connect(g); g.connect(master); env(g, t, a, peak, d); s.start(t, Math.random()); s.stop(t + a + d + 0.05);
}
function tone(freq, type, peak, a, d, to, delay = 0) {
  if (!ac) return; const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
  o.connect(g); g.connect(master); env(g, t, a, peak, d); o.start(t); o.stop(t + a + d + 0.05);
}
function bell(f, peak = 0.14, d = 3, delay = 0) { [1, 2.32, 2.76, 4.1, 0.5].forEach((m, i) => tone(f * m * (1 + (i === 2 ? 0.004 : 0)), 'sine', peak / (i + 1), 0.004, d / (i * 0.5 + 1), null, delay)); }

function ambience() {
  const s = noise(); s.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
  const g = ac.createGain(); g.gain.value = 0.045;
  const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.06; lg.gain.value = 220; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
  s.connect(f); f.connect(g); g.connect(master); s.start();
  // the lamp's soft hiss, louder with more oil
  const h = noise(); h.loop = true; const hf = ac.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 5000;
  hiss = ac.createGain(); hiss.gain.value = 0.006; h.connect(hf); hf.connect(hiss); hiss.connect(master); h.start();
  // a low drone that swells at night
  const d1 = ac.createOscillator(), d2 = ac.createOscillator(); drone = ac.createGain(); drone.gain.value = 0.0;
  d1.frequency.value = 55; d2.frequency.value = 55 * 1.498; d1.type = d2.type = 'triangle';
  d1.connect(drone); d2.connect(drone); drone.connect(master); d1.start(); d2.start();
}
let drone = null;
export function setMood(oil, night) {
  if (!ac) return; const t = ac.currentTime;
  hiss?.gain.setTargetAtTime(0.002 + 0.008 * Math.min(1, oil / 100), t, 0.3);
  drone?.gain.setTargetAtTime(night ? 0.05 : 0.0, t, 1.5);
}

export const sfx = {
  swing(heavy) { nz(heavy ? 700 : 1300, 1.2, heavy ? 0.22 : 0.14, 0.01, heavy ? 0.2 : 0.11, 'bandpass', heavy ? 250 : 500); },
  hit(heavy) { nz(heavy ? 300 : 500, 2, 0.35, 0.002, 0.12, 'lowpass', 120); tone(heavy ? 110 : 160, 'triangle', 0.22, 0.002, 0.12, 60); },
  ghost() { nz(2400, 3, 0.05, 0.01, 0.25, 'bandpass', 4000); },
  hurt() { nz(250, 1, 0.4, 0.002, 0.2, 'lowpass', 80); tone(90, 'sawtooth', 0.12, 0.002, 0.18, 50); },
  roll() { nz(500, 0.8, 0.12, 0.02, 0.22, 'lowpass', 200); },
  dodge() { tone(1400, 'sine', 0.06, 0.005, 0.25, 2200); },
  drink() { for (let i = 0; i < 3; i++) tone(320 + i * 40, 'sine', 0.07, 0.01, 0.08, 220, i * 0.12); },
  healed() { tone(523, 'sine', 0.08, 0.01, 0.4); tone(784, 'sine', 0.05, 0.01, 0.5, null, 0.06); },
  flare() { nz(200, 0.7, 0.5, 0.01, 0.6, 'lowpass', 2400); tone(70, 'sine', 0.3, 0.005, 0.5, 40); },
  kill() { nz(900, 2, 0.12, 0.005, 0.4, 'bandpass', 3000); },
  fswing() { nz(900, 1.5, 0.08, 0.01, 0.1, 'bandpass', 400); },
  lunge() { nz(400, 1, 0.1, 0.01, 0.2, 'lowpass', 900); },
  bolt() { tone(900, 'sine', 0.04, 0.01, 0.3, 300); },
  slam() { nz(140, 1, 0.5, 0.005, 0.5, 'lowpass', 40); tone(55, 'sine', 0.35, 0.005, 0.4, 30); },
  toll() { bell(98, 0.2, 2.5); },
  bell(last) { bell(last ? 73 : 98, 0.22, 4); bell(last ? 73 : 98, 0.14, 4, 1.4); if (last) bell(73, 0.12, 4, 2.8); },
  boss() { nz(90, 0.7, 0.4, 0.4, 1.6, 'lowpass', 40); tone(46, 'sawtooth', 0.12, 0.5, 1.5, 38); },
  bossdown() { bell(196, 0.16, 4); bell(294, 0.1, 4, 0.2); nz(300, 0.6, 0.3, 0.01, 1.2, 'lowpass', 60); },
  dawn() { [262, 330, 392, 523].forEach((f, i) => tone(f, 'sine', 0.06, 0.2, 1.8, null, i * 0.25)); },
  oil() { tone(660, 'sine', 0.07, 0.005, 0.18); tone(990, 'sine', 0.05, 0.005, 0.25, null, 0.07); },
  weapon() { bell(392, 0.1, 1.5); bell(523, 0.08, 1.5, 0.15); },
  grace() { bell(523, 0.07, 2); bell(659, 0.05, 2, 0.12); },
  level() { [392, 494, 587].forEach((f, i) => tone(f, 'triangle', 0.07, 0.01, 0.4, null, i * 0.08)); },
  cleared() { bell(330, 0.08, 1.8); },
  chill() { nz(3000, 4, 0.03, 0.01, 0.2, 'bandpass', 1500); },
  click() { tone(700, 'square', 0.03, 0.002, 0.04); },
  eclipse() { tone(200, 'sine', 0.15, 0.3, 1.5, 60); },
  died() { bell(65, 0.2, 5); },
  brood() { nz(3000, 1, 0.08, 0.05, 0.5, 'bandpass', 6000); },
  phase2() { nz(120, 0.6, 0.4, 0.2, 1.2, 'lowpass', 50); },
};
