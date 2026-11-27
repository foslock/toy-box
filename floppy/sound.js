// Every sound is synthesized: fan hum, the drive's clunk and grind, PC-speaker beeps,
// and a soft sound-card voice for the late-90s games.
let ac = null, master = null, fan = null, muted = false;

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ac.destination);
  // fan: looping brown noise through a lowpass
  const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
  fan = ac.createGain(); fan.gain.value = 0.11;
  src.connect(lp); lp.connect(fan); fan.connect(master); src.start();
}

export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; }
export function isMuted() { return muted; }

function noiseBurst(t, dur, freq, q, gain) {
  const n = Math.max(1, Math.floor(ac.sampleRate * dur)), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(); s.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}

function tone(t, freq, dur, type = 'square', gain = 0.06, glide = 0) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + glide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.setValueAtTime(gain, t + Math.max(0.006, dur - 0.02)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  insert() { if (!ac) return; const t = ac.currentTime; noiseBurst(t, 0.05, 1800, 2, 0.5); noiseBurst(t + 0.09, 0.08, 500, 3, 0.7); tone(t + 0.09, 90, 0.06, 'triangle', 0.2); },
  eject() { if (!ac) return; const t = ac.currentTime; noiseBurst(t, 0.06, 900, 3, 0.6); noiseBurst(t + 0.07, 0.05, 2400, 2, 0.35); },
  // the drive reading: a stuttering, stepping grind
  seek(len = 1.1) {
    if (!ac) return; const t = ac.currentTime;
    for (let i = 0; i < len * 14; i++) {
      const tt = t + i / 14 + Math.random() * 0.02;
      noiseBurst(tt, 0.035, 300 + Math.random() * 500, 6, 0.35);
      if (i % 3 === 0) tone(tt, 70 + (i % 5) * 9, 0.03, 'square', 0.05);
    }
  },
  key() { if (!ac) return; noiseBurst(ac.currentTime, 0.025, 3000, 1.5, 0.18); },
  beep(f = 880, d = 0.08) { if (!ac) return; tone(ac.currentTime, f, d, 'square', 0.05); },
  bad() { if (!ac) return; const t = ac.currentTime; tone(t, 160, 0.18, 'square', 0.06); },
  tune(notes, step = 0.12, type = 'square', gain = 0.05) {
    if (!ac) return; let t = ac.currentTime;
    for (const n of notes) { if (n) tone(t, n, step * 0.9, type, gain); t += step; }
  },
  win() { this.tune([523, 659, 784, 1047, 0, 784, 1047]); },
  // later-era sound card: softer, warmer
  soft(f, d = 0.4, g = 0.05) { if (!ac) return; tone(ac.currentTime, f, d, 'triangle', g); },
  chord(fs, d = 1.6, g = 0.03) { if (!ac) return; for (const f of fs) tone(ac.currentTime, f, d, 'sine', g); },
  thud() { if (!ac) return; const t = ac.currentTime; tone(t, 120, 0.12, 'sine', 0.2, -60); },
  crash() { if (!ac) return; noiseBurst(ac.currentTime, 0.35, 400, 0.8, 0.5); },
  engine(v) { /* set per frame by the racing game */ if (!ac) return; ensureEngine(); eng.o.frequency.setTargetAtTime(60 + v * 160, ac.currentTime, 0.05); eng.g.gain.setTargetAtTime(v > 0 ? 0.025 : 0, ac.currentTime, 0.08); },
  engineOff() { if (eng) eng.g.gain.setTargetAtTime(0, ac.currentTime, 0.05); },
  wave() { if (!ac) return; noiseBurst(ac.currentTime, 1.6, 500, 0.5, 0.08); },
  horn() { if (!ac) return; const t = ac.currentTime; tone(t, 110, 0.7, 'sawtooth', 0.025); tone(t, 147, 0.7, 'sawtooth', 0.02); },
  fanLevel(v) { if (fan) fan.gain.setTargetAtTime(v, ac.currentTime, 0.3); },
};
let eng = null;
function ensureEngine() {
  if (eng) return;
  const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.value = 80; g.gain.value = 0;
  o.connect(g); g.connect(master); o.start(); eng = { o, g };
}
