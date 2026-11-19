// Jolly Cooperator: every sound is synthesized. A small gamelan-ish band behind the screen, leather slaps, wooden rod clacks.
let ac = null, master = null, music = null, muted = false, mood = 'calm', beatT = 0, step = 0, timer = null;
try { muted = localStorage.getItem('jolly.mute') === '1'; } catch {}

export function unlock() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ac.destination);
    music = ac.createGain(); music.gain.value = 0.32; music.connect(master);
    const verb = ac.createConvolver(); verb.buffer = impulse(1.8); const vg = ac.createGain(); vg.gain.value = 0.35; music.connect(verb); verb.connect(vg); vg.connect(master);
    beatT = ac.currentTime + 0.1;
    timer = setInterval(schedule, 60);
  }
  if (ac.state === 'suspended') ac.resume();
}
export function setMuted(m) { muted = m; try { localStorage.setItem('jolly.mute', m ? '1' : '0'); } catch {} if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ac.currentTime, 0.05); }
export const isMuted = () => muted;
export function setMood(m) { mood = m; }

function impulse(sec) {
  const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
  return b;
}
let nb = null;
function noise() {
  if (!nb) { nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ac.createBufferSource(); s.buffer = nb; return s;
}
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function nz(freq, q, peak, a, d, type = 'bandpass', sweep, at = 0, out = master) {
  if (!ac) return; const t = (at || ac.currentTime), s = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + a + d); f.Q.value = q;
  s.connect(f); f.connect(g); g.connect(out); env(g, t, a, peak, d); s.start(t, Math.random() * 0.5); s.stop(t + a + d + 0.05);
}
function tone(freq, type, peak, a, d, to, at = 0, out = master) {
  if (!ac) return; const t = (at || ac.currentTime), o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
  o.connect(g); g.connect(out); env(g, t, a, peak, d); o.start(t); o.stop(t + a + d + 0.05);
}
// a bronze key: inharmonic partials, fast attack, long ring
function bronze(f, peak, d, at, out = music) { [[1, 1], [2.76, 0.35], [5.4, 0.12], [1.006, 0.5]].forEach(([m, a]) => tone(f * m, 'sine', peak * a, 0.003, d / (m > 2 ? 3 : 1), null, at, out)); }
function gong(f, peak, at, out = music) { [[1, 1], [1.48, 0.4], [2.1, 0.25], [0.5, 0.6]].forEach(([m, a]) => tone(f * m, 'sine', peak * a, 0.02, 3.5, f * m * 0.995, at, out)); }

// pelog-flavoured scale (roughly), in Hz
const SCALE = [293.7, 311.1, 349.2, 415.3, 440.0, 523.3, 554.4];
const PATTERNS = {
  calm: [0, -1, 2, -1, 4, 3, 2, -1, 0, -1, 4, -1, 5, 4, 2, 0],
  fight: [0, 2, 4, 2, 5, 4, 2, 4, 0, 2, 4, 5, 6, 5, 4, 2],
  boss: [0, 0, 3, 0, 5, 3, 0, 3, 1, 1, 4, 1, 6, 4, 1, 4],
  hush: [0, -1, -1, -1, 4, -1, -1, -1, 2, -1, -1, -1, 3, -1, -1, -1],
};
function schedule() {
  if (!ac || muted) { if (ac) beatT = ac.currentTime + 0.1; return; }
  const spb = mood === 'boss' ? 0.17 : mood === 'fight' ? 0.2 : 0.27;
  while (beatT < ac.currentTime + 0.25) {
    const pat = PATTERNS[mood] || PATTERNS.calm;
    const n = pat[step % 16];
    if (n >= 0) bronze(SCALE[n] * (step % 32 >= 16 && mood !== 'hush' ? 1 : 1), mood === 'hush' ? 0.06 : 0.08, 1.2, beatT);
    // a lower keyboard every other beat
    if (step % 2 === 0 && mood !== 'hush') bronze(SCALE[(n >= 0 ? n : 0) % 5] / 2, 0.05, 1.6, beatT);
    // the gong closes each phrase, kempul on the halves
    if (step % 16 === 0) gong(73.4, mood === 'hush' ? 0.12 : 0.2, beatT);
    if (step % 16 === 8 && mood !== 'hush') gong(110, 0.08, beatT);
    // kendang-ish drum in fights
    if ((mood === 'fight' || mood === 'boss') && [0, 3, 6, 10, 12].includes(step % 16)) { tone(mood === 'boss' ? 95 : 120, 'sine', 0.14, 0.004, 0.16, 60, beatT, music); nz(900, 2, 0.05, 0.002, 0.05, 'bandpass', null, beatT, music); }
    beatT += spb; step++;
  }
}

export const sfx = {
  swing(heavy) { nz(heavy ? 900 : 1500, 0.8, heavy ? 0.16 : 0.12, 0.01, heavy ? 0.16 : 0.11, 'bandpass', heavy ? 300 : 500); },
  hit(big) { nz(420, 1.2, big ? 0.5 : 0.34, 0.002, big ? 0.16 : 0.09, 'lowpass'); tone(big ? 110 : 160, 'triangle', big ? 0.28 : 0.18, 0.002, 0.1, 60); nz(2600, 3, 0.08, 0.001, 0.03); },
  hurt() { nz(300, 1, 0.45, 0.002, 0.2, 'lowpass'); tone(130, 'sawtooth', 0.12, 0.003, 0.18, 70); },
  clack() { nz(2200, 6, 0.16, 0.001, 0.04); tone(820, 'triangle', 0.06, 0.001, 0.05); },
  roll() { nz(700, 0.7, 0.12, 0.03, 0.2, 'bandpass', 250); },
  dodge() { tone(1400, 'sine', 0.07, 0.002, 0.15, 2100); },
  block() { nz(3000, 4, 0.18, 0.001, 0.06); tone(520, 'square', 0.05, 0.002, 0.08, 400); },
  gesture() { if (!ac) return; const t = ac.currentTime; bronze(SCALE[4] * 2, 0.12, 0.6, t, master); bronze(SCALE[6] * 2, 0.08, 0.6, t + 0.08, master); },
  heed() { if (!ac) return; const t = ac.currentTime; bronze(SCALE[2] * 2, 0.1, 0.5, t, master); bronze(SCALE[4] * 2, 0.1, 0.7, t + 0.09, master); },
  ignore() { if (!ac) return; const t = ac.currentTime; bronze(SCALE[3] * 2, 0.09, 0.4, t, master); bronze(SCALE[1] * 2, 0.08, 0.5, t + 0.1, master); },
  babble(n = 5, pitch = 1) { if (!ac) return; const t = ac.currentTime; for (let i = 0; i < n; i++) tone((260 + Math.random() * 120) * pitch, 'triangle', 0.05, 0.005, 0.05, null, t + i * 0.065); },
  kill() { nz(160, 1, 0.3, 0.004, 0.3, 'lowpass'); tone(90, 'sine', 0.2, 0.004, 0.3, 45); },
  downed() { if (!ac) return; const t = ac.currentTime; gong(98, 0.35, t, master); tone(220, 'sine', 0.12, 0.01, 1.2, 110, t); },
  raise() { if (!ac) return; const t = ac.currentTime; [0, 2, 4, 5].forEach((n, i) => bronze(SCALE[n] * 2, 0.11, 0.8, t + i * 0.07, master)); },
  fall() { tone(500, 'sine', 0.15, 0.01, 0.8, 80); nz(400, 1, 0.12, 0.02, 0.6, 'lowpass', 100); },
  drink() { if (!ac) return; const t = ac.currentTime; for (let i = 0; i < 3; i++) tone(300 + i * 60, 'sine', 0.08, 0.01, 0.08, 200, t + i * 0.12); },
  loot() { if (!ac) return; const t = ac.currentTime; [4, 5, 6].forEach((n, i) => bronze(SCALE[n] * 2, 0.08, 0.6, t + i * 0.06, master)); },
  wind() { nz(5000, 8, 0.04, 0.01, 0.12, 'bandpass', 7000); },
  bossWind(kind) { if (!ac) return; if (kind === 'aoe') gong(55, 0.4, ac.currentTime, master); else nz(200, 1, 0.2, 0.2, 0.3, 'lowpass', 600); },
  boom() { tone(60, 'sine', 0.5, 0.004, 0.6, 30); nz(250, 0.8, 0.4, 0.004, 0.5, 'lowpass', 60); },
  bell() { if (!ac) return; const t = ac.currentTime; [1, 2.4, 3.1, 4.6].forEach((m, i) => tone(110 * m, 'sine', 0.3 / (i + 1), 0.003, 2.5, null, t, master)); },
  howl() { tone(240, 'sawtooth', 0.12, 0.2, 1.0, 500); tone(243, 'sawtooth', 0.1, 0.2, 1.0, 470); },
  shoot() { nz(3200, 3, 0.1, 0.002, 0.08, 'bandpass', 1500); },
  wave() { if (!ac) return; gong(82, 0.3, ac.currentTime, master); },
  clear() { if (!ac) return; const t = ac.currentTime; [0, 2, 4].forEach((n, i) => bronze(SCALE[n] * 2, 0.1, 1, t + i * 0.1, master)); },
  applause(sec = 2.5) {
    if (!ac) return; const t = ac.currentTime;
    for (let i = 0; i < sec * 40; i++) nz(1200 + Math.random() * 2400, 2, 0.04 + Math.random() * 0.05, 0.002, 0.03, 'bandpass', null, t + Math.random() * sec * (Math.random() < 0.7 ? 0.6 : 1));
  },
  dismiss() { if (!ac) return; const t = ac.currentTime; gong(65, 0.5, t, master); [4, 3, 1, 0].forEach((n, i) => bronze(SCALE[n], 0.12, 1.4, t + 0.2 + i * 0.25, master)); },
  curtain() { nz(400, 0.5, 0.15, 0.3, 0.8, 'lowpass', 180); },
  tick() { tone(1200, 'square', 0.03, 0.001, 0.02); },
};
