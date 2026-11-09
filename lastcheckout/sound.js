// Last Checkout: every sound is made here with WebAudio. The scanner beep is the heartbeat.
let ac = null, master = null, hum = null, rumble = null, beltGain = null;
let muted = false;
try { muted = localStorage.getItem('lastcheckout.mute') === '1'; } catch (e) {}

export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('lastcheckout.mute', m ? '1' : '0'); } catch (e) {}
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ac.currentTime, 0.05);
}

export function unlock() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ac.destination);
  // fluorescent tube hum, always on, very quiet
  const o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 100;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 340;
  hum = ac.createGain(); hum.gain.value = 0.012;
  o1.connect(f); f.connect(hum); hum.connect(master); o1.start();
  // the low rumble that grows across the week
  const nb = noiseBuffer(2);
  const n = ac.createBufferSource(); n.buffer = nb; n.loop = true;
  const lf = ac.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 70;
  rumble = ac.createGain(); rumble.gain.value = 0;
  n.connect(lf); lf.connect(rumble); rumble.connect(master); n.start();
  // the belt motor
  const n2 = ac.createBufferSource(); n2.buffer = nb; n2.loop = true;
  const bf = ac.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 180; bf.Q.value = 2;
  beltGain = ac.createGain(); beltGain.gain.value = 0;
  n2.connect(bf); bf.connect(beltGain); beltGain.connect(master); n2.start();
}

function noiseBuffer(sec) {
  const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function tone(freq, dur, type = 'square', vol = 0.12, when = 0, slide = 0) {
  if (!ac) return;
  const t = ac.currentTime + when;
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.setValueAtTime(vol, t + dur - 0.012); g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq, type = 'bandpass', when = 0, q = 1) {
  if (!ac) return;
  const t = ac.currentTime + when;
  const s = ac.createBufferSource(); s.buffer = noiseBuffer(dur + 0.05);
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
}

export const sfx = {
  beep() { tone(2093, 0.085, 'square', 0.07); },
  noRead() { tone(220, 0.12, 'square', 0.05); tone(200, 0.12, 'square', 0.05, 0.14); },
  weigh() { tone(1320, 0.05, 'sine', 0.08); tone(1760, 0.06, 'sine', 0.08, 0.06); },
  key() { tone(900, 0.03, 'square', 0.04); noise(0.03, 0.08, 3000); },
  wrong() { tone(160, 0.25, 'sawtooth', 0.06); },
  thud(heavy = 1) { noise(0.12, 0.25 * heavy, 220, 'lowpass'); tone(90, 0.08, 'sine', 0.12 * heavy, 0, 0.6); },
  rustle() { noise(0.18, 0.12, 2500, 'bandpass', 0, 0.6); },
  crush() { noise(0.25, 0.45, 900, 'bandpass', 0, 0.8); noise(0.12, 0.3, 3000, 'highpass', 0.04); tone(120, 0.1, 'triangle', 0.1, 0, 0.5); },
  flip() { noise(0.08, 0.1, 1500, 'bandpass', 0, 1.2); },
  coin() { const f = 2400 + Math.random() * 800; tone(f, 0.06, 'sine', 0.06); tone(f * 1.5, 0.08, 'sine', 0.04, 0.02); },
  note() { noise(0.12, 0.16, 4000, 'highpass'); },
  drawer() { noise(0.18, 0.3, 500, 'lowpass'); tone(2637, 0.4, 'sine', 0.07, 0.12); tone(3520, 0.5, 'sine', 0.05, 0.14); },
  card() { tone(1568, 0.08, 'sine', 0.08); tone(2093, 0.14, 'sine', 0.08, 0.1); },
  print() { for (let i = 0; i < 10; i++) noise(0.03, 0.06, 2000 + i * 50, 'bandpass', i * 0.045, 3); },
  bag() { noise(0.35, 0.16, 1800, 'bandpass', 0, 0.5); },
  talk(pitch = 1) { if (!ac) return; tone((180 + Math.random() * 60) * pitch, 0.05, 'triangle', 0.03); },
  ding() { tone(1046, 0.5, 'sine', 0.06); tone(1318, 0.6, 'sine', 0.05, 0.12); },
};

export function setBelt(on) {
  if (!beltGain) return;
  beltGain.gain.setTargetAtTime(on ? 0.05 : 0, ac.currentTime, 0.08);
}
export function setRumble(day) {
  if (!rumble) return;
  rumble.gain.setTargetAtTime([0, 0.02, 0.05, 0.09, 0.15, 0.24, 0.36][day] || 0, ac.currentTime, 1.5);
}
