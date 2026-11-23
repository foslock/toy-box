// Small synthesized sounds: footsteps, a pin going in, a rubber stamp, a page.
let ac = null, master = null, muted = false;
try { muted = localStorage.getItem('plonk-muted') === '1'; } catch {}

export function unlock() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
    } catch { ac = null; }
  }
  if (ac && ac.state === 'suspended') ac.resume();
}
export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('plonk-muted', m ? '1' : '0'); } catch {}
  if (master) master.gain.value = m ? 0 : 0.5;
}

function noise(dur, filt, freq, gain, q = 1) {
  if (!ac) return;
  const n = Math.ceil(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const s = ac.createBufferSource(); s.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = filt; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(master); s.start();
}
function tone(freq, dur, gain, type = 'sine', when = 0, slide = 0) {
  if (!ac) return;
  const t = ac.currentTime + when;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  step() { noise(0.09, 'lowpass', 700 + Math.random() * 300, 0.5); },
  pin() { tone(420, 0.12, 0.35, 'triangle', 0, 0.6); noise(0.04, 'highpass', 2500, 0.15); },
  page() { noise(0.22, 'bandpass', 2200, 0.25, 0.6); },
  stamp() { tone(90, 0.18, 0.6, 'sine', 0, 0.5); noise(0.08, 'lowpass', 400, 0.6); },
  good() { tone(660, 0.35, 0.18, 'triangle'); tone(990, 0.5, 0.14, 'triangle', 0.12); },
  okay() { tone(520, 0.3, 0.15, 'triangle'); },
  click() { noise(0.03, 'highpass', 3000, 0.2); },
};
