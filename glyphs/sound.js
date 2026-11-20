// Small WebAudio kit: plucked strings for the music, a babble voice per speaker, wind and surf.
let ac = null, master = null, amb = null, ambGain = null, muted = false, musicT = 0;
const VOICE = { fisher: 0.9, child: 1.7, baker: 1.0, customer: 1.15, neighbor: 1.25, priest: 0.75, guard: 0.68, you: 1.1 };
const SCALE = [0, 2, 3, 7, 8, 12, 14, 15, 19]; // a hijaz-ish colour without leaning on it

export function audioOn() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ac.destination);
    startAmbience();
  }
  if (ac.state === 'suspended') ac.resume();
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ac.currentTime, 0.05); }
export function isMuted() { return muted; }

function noiseBuf(sec = 2) {
  const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function startAmbience() {
  const src = ac.createBufferSource(); src.buffer = noiseBuf(3); src.loop = true;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  ambGain = ac.createGain(); ambGain.gain.value = 0.05;
  const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.11; lg.gain.value = 0.03;
  lfo.connect(lg); lg.connect(ambGain.gain); lfo.start();
  src.connect(lp); lp.connect(ambGain); ambGain.connect(master); src.start();
  amb = { lp, lfo };
}
export function setPlace(place) {
  if (!ac || !amb) return;
  const sea = place === 'harbour';
  amb.lp.frequency.setTargetAtTime(sea ? 700 : 360, ac.currentTime, 0.6);
  amb.lfo.frequency.setTargetAtTime(sea ? 0.16 : 0.07, ac.currentTime, 0.6);
  ambGain.gain.setTargetAtTime(sea ? 0.07 : 0.04, ac.currentTime, 0.6);
}

// a plucked string: a short noise burst through a feedback comb (Karplus-Strong, done with a delay node)
function pluck(freq, t, vol = 0.16, dur = 1.6) {
  const d = ac.createDelay(); d.delayTime.value = 1 / freq;
  const fb = ac.createGain(); fb.gain.value = 0.965;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = freq * 5;
  const exc = ac.createBufferSource(); exc.buffer = noiseBuf(0.03);
  const eg = ac.createGain(); eg.gain.value = vol;
  const out = ac.createGain(); out.gain.setValueAtTime(1, t); out.gain.exponentialRampToValueAtTime(0.001, t + dur);
  exc.connect(eg); eg.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(out); out.connect(master);
  exc.start(t); exc.stop(t + 0.03);
  setTimeout(() => { try { out.disconnect(); d.disconnect(); fb.disconnect(); } catch {} }, (dur + 0.4) * 1000 + (t - ac.currentTime) * 1000);
}
const hz = (semi, base = 196) => base * Math.pow(2, semi / 12);

// a slow, sparse tune; call every frame with dt
export function music(dt) {
  if (!ac || muted) return;
  musicT -= dt;
  if (musicT > 0) return;
  musicT = 2.8 + Math.random() * 3.5;
  const t = ac.currentTime + 0.05;
  const n = 1 + Math.floor(Math.random() * 3);
  let i = Math.floor(Math.random() * 5);
  for (let k = 0; k < n; k++) {
    pluck(hz(SCALE[i]), t + k * 0.32, 0.09, 2.2);
    i = Math.max(0, Math.min(SCALE.length - 1, i + (Math.random() < 0.5 ? -1 : 1)));
  }
  if (Math.random() < 0.4) pluck(hz(SCALE[0], 98), t, 0.07, 3);
}

// each glyph has its own syllable; each speaker their own pitch
export function speak(who, words) {
  if (!ac || muted) return;
  const p = VOICE[who] || 1;
  let t = ac.currentTime + 0.02;
  for (const w of words) {
    let h = 0; for (const c of w) h = (h * 31 + c.charCodeAt(0)) % 997;
    const f = 150 * p * (1 + (h % 7) / 12);
    const o = ac.createOscillator(), g = ac.createGain(), bp = ac.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * (h % 2 ? 1.12 : 0.9), t + 0.13);
    bp.type = 'bandpass'; bp.frequency.value = 700 + (h % 5) * 260; bp.Q.value = 3;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(bp); bp.connect(g); g.connect(master); o.start(t); o.stop(t + 0.18);
    t += 0.17;
  }
}

export function sfx(name) {
  if (!ac || muted) return;
  const t = ac.currentTime + 0.01;
  if (name === 'tap') pluck(hz(12), t, 0.05, 0.4);
  else if (name === 'page') { const s = ac.createBufferSource(); s.buffer = noiseBuf(0.25); const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800; const g = ac.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22); s.connect(f); f.connect(g); g.connect(master); s.start(t); }
  else if (name === 'stamp') { [0, 3, 7, 12].forEach((s, i) => pluck(hz(s + 12), t + i * 0.09, 0.14, 1.8)); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.15); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.22); }
  else if (name === 'wrong') { pluck(hz(1, 110), t, 0.14, 0.8); pluck(hz(0, 110), t + 0.16, 0.14, 0.9); }
  else if (name === 'coin') { [0, 0.07].forEach((d) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 2400 + d * 6000; g.gain.setValueAtTime(0.08, t + d); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.3); o.connect(g); g.connect(master); o.start(t + d); o.stop(t + d + 0.32); }); }
  else if (name === 'water') { for (let i = 0; i < 6; i++) { const o = ac.createOscillator(), g = ac.createGain(), tt = t + i * 0.06 + Math.random() * 0.03; o.frequency.setValueAtTime(500 + Math.random() * 500, tt); o.frequency.exponentialRampToValueAtTime(1400, tt + 0.05); g.gain.setValueAtTime(0.05, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + 0.07); o.connect(g); g.connect(master); o.start(tt); o.stop(tt + 0.08); } }
  else if (name === 'gate') { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(52, t + 1.6); const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.2); g.gain.linearRampToValueAtTime(0, t + 1.7); o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + 1.8); [0, 4, 7, 12, 16].forEach((s, i) => pluck(hz(s), t + 1.2 + i * 0.2, 0.13, 2.4)); }
  else if (name === 'step') { const s = ac.createBufferSource(); s.buffer = noiseBuf(0.1); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; const g = ac.createGain(); g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09); s.connect(f); f.connect(g); g.connect(master); s.start(t); }
}
