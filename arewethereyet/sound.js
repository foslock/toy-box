// Are We There Yet: a car stereo, an engine, and the noises a family makes. All WebAudio, nothing loaded.
let ac = null, master, music, sfx, engineGain, engineOsc, engineNoise, speakerLP;
let muted = false;
try { muted = localStorage.getItem('awty-muted') === '1'; } catch {}

export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m; try { localStorage.setItem('awty-muted', m ? '1' : '0'); } catch {}
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05);
}

export function unlock() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
  sfx = ac.createGain(); sfx.gain.value = 0.55; sfx.connect(master);
  // music goes through a cheap car speaker
  speakerLP = ac.createBiquadFilter(); speakerLP.type = 'lowpass'; speakerLP.frequency.value = 2600; speakerLP.Q.value = 0.7;
  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 140;
  music = ac.createGain(); music.gain.value = 0.0; music.connect(hp); hp.connect(speakerLP); speakerLP.connect(master);
  // engine: a low triangle and some brown-ish noise
  engineGain = ac.createGain(); engineGain.gain.value = 0; engineGain.connect(master);
  engineOsc = ac.createOscillator(); engineOsc.type = 'triangle'; engineOsc.frequency.value = 46;
  const eLP = ac.createBiquadFilter(); eLP.type = 'lowpass'; eLP.frequency.value = 220;
  engineOsc.connect(eLP); eLP.connect(engineGain); engineOsc.start();
  const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = nb.getChannelData(0);
  let last = 0; for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  engineNoise = ac.createBufferSource(); engineNoise.buffer = nb; engineNoise.loop = true;
  const nG = ac.createGain(); nG.gain.value = 0.5; engineNoise.connect(nG); nG.connect(engineGain); engineNoise.start();
  setInterval(schedule, 60);
}

export function engine(level, speed = 1) {
  if (!ac) return;
  engineGain.gain.setTargetAtTime(level * 0.16, ac.currentTime, 0.4);
  engineOsc.frequency.setTargetAtTime(38 + speed * 14, ac.currentTime, 0.5);
}

// ---------------------------------------------------------------- one-shots
function tone(f, dur, type = 'square', vol = 0.3, when = 0, slide = 0, dest = sfx) {
  if (!ac) return;
  const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, freq = 2000, vol = 0.3, when = 0, q = 1, type = 'bandpass', dest = sfx) {
  if (!ac) return;
  const t = ac.currentTime + when, len = Math.ceil(ac.sampleRate * dur), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(); s.buffer = b;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t);
}

export function play(name) {
  if (!ac || muted) return;
  switch (name) {
    case 'seat': tone(180, 0.08, 'triangle', 0.25); noise(0.08, 900, 0.15); break;
    case 'snack': noise(0.06, 5000, 0.25); noise(0.06, 4200, 0.2, 0.07); noise(0.05, 6000, 0.18, 0.14); tone(660, 0.08, 'triangle', 0.12, 0.12); break;
    case 'tape': noise(0.05, 1500, 0.35, 0, 3); tone(90, 0.06, 'square', 0.2, 0.02); noise(0.12, 300, 0.25, 0.08, 1, 'lowpass'); break;
    case 'nope': tone(220, 0.12, 'square', 0.12); tone(180, 0.16, 'square', 0.12, 0.1); break;
    case 'brake': noise(0.5, 2600, 0.12, 0, 8); tone(1200, 0.4, 'sine', 0.04, 0, -300); noise(0.3, 400, 0.3, 0.1, 0.7, 'lowpass'); break;
    case 'start': tone(60, 0.4, 'sawtooth', 0.12, 0, 40); noise(0.5, 300, 0.3, 0, 0.7, 'lowpass'); break;
    case 'bad': tone(140, 0.35, 'sawtooth', 0.15, 0, -50); break;
    case 'fight': tone(520, 0.08, 'square', 0.12); tone(620, 0.1, 'square', 0.12, 0.09); tone(480, 0.14, 'square', 0.12, 0.2); break;
    case 'calm': tone(523, 0.12, 'triangle', 0.15); tone(659, 0.18, 'triangle', 0.15, 0.09); break;
    case 'swerve': noise(0.6, 180, 0.6, 0, 0.6, 'lowpass'); tone(330, 0.3, 'square', 0.15); tone(415, 0.5, 'square', 0.13, 0.05); break;
    case 'breakdown': tone(110, 0.2, 'sawtooth', 0.2); noise(1.4, 3000, 0.25, 0.15, 0.4, 'highpass'); break;
    case 'fixed': tone(784, 0.1, 'triangle', 0.25); tone(1047, 0.2, 'triangle', 0.25, 0.09); noise(0.05, 3000, 0.2); break;
    case 'arrive': tone(880, 0.25, 'sine', 0.2); tone(698, 0.4, 'sine', 0.2, 0.2); break;
    case 'choose': tone(440, 0.07, 'triangle', 0.2); tone(660, 0.1, 'triangle', 0.18, 0.06); break;
    case 'pump': for (let i = 0; i < 6; i++) tone(1400, 0.03, 'square', 0.06, i * 0.09); noise(0.6, 600, 0.12, 0, 1); break;
    case 'camera': noise(0.03, 4000, 0.4); noise(0.08, 1200, 0.3, 0.05); tone(2400, 0.4, 'sine', 0.04, 0.1, 1200); break;
    case 'night': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.6, 'sine', 0.1, i * 0.18)); break;
    case 'horn': tone(392, 0.35, 'square', 0.12); tone(494, 0.35, 'square', 0.1); break;
    case 'win': [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.2, i * 0.13)); break;
    case 'tick': tone(1800, 0.02, 'square', 0.05); break;
    case 'page': noise(0.2, 2500, 0.18, 0, 0.6); break;
  }
}

// ---------------------------------------------------------------- the tapes
// Four little original loops, one per genre. 16 steps a bar, 4 bars.
const N = n => 440 * Math.pow(2, (n - 69) / 12);
const SONGS = {
  country: { bpm: 104, chords: [[55, 59, 62], [60, 64, 67], [62, 66, 69], [55, 59, 62]], // G C D G
    bass: (b, s) => s % 8 === 0 ? b[0] - 12 : s % 8 === 4 ? b[2] - 24 : null, stab: s => s % 8 === 4,
    lead: [67, null, 69, 71, null, 71, 69, null, 67, null, 64, null, 62, null, null, null, 64, null, 67, 69, null, 72, 71, null, 69, null, 67, null, 69, null, null, null,
      66, null, 69, 71, null, 74, 72, null, 71, null, 69, null, 67, null, 66, null, 67, null, null, null, 71, null, 69, null, 67, null, null, null, null, null, null, null], leadType: 'square', leadVol: 0.05 },
  softrock: { bpm: 76, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], // Cmaj7 Am7 Fmaj7 G7
    bass: (b, s) => s === 0 ? b[0] - 24 : s === 10 ? b[0] - 12 : null, pad: true,
    lead: [76, null, null, null, 74, null, 72, null, null, null, 71, null, 72, null, null, null, 72, null, null, null, 71, null, 69, null, null, null, 67, null, 64, null, null, null,
      69, null, null, null, 67, null, 65, null, null, null, 64, null, 65, null, null, null, 67, null, null, null, 71, null, 74, null, null, null, null, null, null, null, null, null], leadType: 'sine', leadVol: 0.07 },
  newwave: { bpm: 126, chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], // Am F C G
    bass: (b, s) => s % 2 === 0 ? b[0] - 24 + (s % 4 === 2 ? 12 : 0) : null, arp: true, snare: true,
    lead: [76, null, null, 76, null, null, 74, null, 72, null, null, null, 69, null, null, null, 72, null, null, 72, null, null, 74, null, 76, null, null, null, 79, null, null, null,
      79, null, null, 77, null, null, 76, null, 74, null, null, null, 72, null, null, null, 74, null, null, 74, null, null, 76, null, 74, null, 72, null, 71, null, null, null], leadType: 'sawtooth', leadVol: 0.035 },
  silly: { bpm: 138, chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], // C F G C
    bass: (b, s) => s % 4 === 0 ? (s % 8 === 0 ? b[0] - 24 : b[2] - 24) : null, stab: s => s % 4 === 2,
    lead: [72, null, 72, null, 79, null, 79, null, 81, null, 81, null, 79, null, null, null, 77, null, 77, null, 76, null, 76, null, 74, null, 74, null, 72, null, null, null,
      79, null, 79, null, 77, null, 77, null, 76, null, 76, null, 74, null, null, null, 72, null, 74, null, 76, null, 77, null, 79, null, 76, null, 72, null, null, null], leadType: 'triangle', leadVol: 0.09, glock: true },
};

let song = null, step = 0, nextT = 0;
export function setTape(id) {
  song = id ? SONGS[id] : null;
  if (!ac) return;
  music.gain.setTargetAtTime(song ? 0.8 : 0, ac.currentTime, 0.08);
  step = 0; nextT = ac.currentTime + 0.12;
}
export function musicLevel(v) { if (ac) music.gain.setTargetAtTime(song ? v : 0, ac.currentTime, 0.3); }

function schedule() {
  if (!ac || !song || muted) return;
  const spb = 60 / song.bpm / 4;
  while (nextT < ac.currentTime + 0.25) {
    const bar = Math.floor(step / 16) % 4, s = step % 16, ch = song.chords[bar], t = nextT - ac.currentTime;
    const b = song.bass(ch, s); if (b) tone(N(b), spb * 1.8, 'triangle', 0.22, t, 0, music);
    if (song.stab && song.stab(s)) for (const n of ch) tone(N(n), spb * 1.2, 'square', 0.025, t, 0, music);
    if (song.pad && s === 0) for (const n of ch) { tone(N(n), spb * 15, 'sine', 0.04, t, 0, music); tone(N(n) * 1.003, spb * 15, 'triangle', 0.02, t, 0, music); }
    if (song.arp) tone(N(ch[s % 3] + 12), spb * 0.9, 'square', 0.03, t, 0, music);
    if (song.snare && s % 8 === 4) noise(0.12, 1800, 0.12, t, 0.8, 'bandpass', music);
    if (s % 4 === 0 && song.snare) noise(0.05, 80, 0.4, t, 1, 'lowpass', music);
    const ln = song.lead[step % 64];
    if (ln) { tone(N(ln), spb * (song.glock ? 3 : 1.8), song.leadType, song.leadVol, t, 0, music); if (song.glock) tone(N(ln) * 4, spb * 2, 'sine', 0.02, t, 0, music); }
    step++; nextT += spb;
  }
}
