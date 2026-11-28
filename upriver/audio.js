// All sound is synthesised: river and creature ambience, the kit, the camera
// motor, and a small strings-and-harp score for the screening.
let ac = null, master, sfxBus, musBus, ambBus, noiseBuf, echo;
let muted = false;
export const audio = { on: false };

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
  sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
  musBus = ac.createGain(); musBus.gain.value = 0.0; musBus.connect(master);
  ambBus = ac.createGain(); ambBus.gain.value = 0.0; ambBus.connect(master);
  // a little room for everything
  echo = ac.createDelay(1); echo.delayTime.value = 0.23;
  const fb = ac.createGain(); fb.gain.value = 0.28; const ef = ac.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 2200;
  echo.connect(ef); ef.connect(fb); fb.connect(echo); ef.connect(master);
  const len = ac.sampleRate * 2; noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); let last = 0;
  for (let i = 0; i < len; i++) { const wn = Math.random() * 2 - 1; last = (last + 0.02 * wn) / 1.02; d[i] = i % 2 ? wn : last * 3.5; }
  audio.on = true;
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05); }
export const isMuted = () => muted;
const now = () => ac.currentTime;

function env(g, t, a, peak, dec, sus = 0) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus), t + a + dec);
}
function out(pan = 0, wet = 0.2, bus = sfxBus) {
  const g = ac.createGain(); let n = g;
  if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); n = p; }
  n.connect(bus);
  if (wet > 0) { const s = ac.createGain(); s.gain.value = wet; n.connect(s); s.connect(echo); }
  return g;
}
function tone(type, f0, f1, t, dur, vol, pan, wet, a = 0.01) {
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = out(pan, wet); env(g, t, a, vol, dur);
  o.connect(g); o.start(t); o.stop(t + dur + a + 0.05);
  return o;
}
function noise(t, dur, vol, type, freq, q = 1, pan = 0, wet = 0.15, f1) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = out(pan, wet); env(g, t, 0.01, vol, dur);
  s.connect(f); f.connect(g); s.start(t, Math.random()); s.stop(t + dur + 0.1);
}

const SFX = {
  whistle(p) { const t = now(); for (const [f, d, at] of [[1180, 0.22, 0], [880, 0.34, 0.26]]) { const o = tone('sine', f, f * 0.98, t + at, d, 0.14, p, 0.35, 0.03); const l = ac.createOscillator(); const lg = ac.createGain(); l.frequency.value = 6; lg.gain.value = 14; l.connect(lg); lg.connect(o.frequency); l.start(t + at); l.stop(t + at + d + 0.1); } },
  throw(p) { noise(now(), 0.35, 0.12, 'bandpass', 900, 1.5, p, 0.05, 2600); },
  thud(p) { const t = now(); tone('sine', 140, 60, t, 0.18, 0.3, p, 0.1); noise(t, 0.08, 0.1, 'lowpass', 600, 1, p, 0); },
  plop(p) { const t = now(); tone('sine', 520, 160, t, 0.16, 0.22, p, 0.25); noise(t + 0.03, 0.2, 0.06, 'highpass', 2500, 1, p, 0.2); },
  splash(p) { noise(now(), 0.4, 0.12, 'bandpass', 1800, 0.8, p, 0.2, 700); },
  bubbles(p) { const t = now(); for (let i = 0; i < 7; i++) tone('sine', 500 + Math.random() * 500, 900 + Math.random() * 600, t + i * 0.13, 0.07, 0.08, p + (Math.random() - 0.5) * 0.4, 0.3); },
  chirp(p) { const t = now(); const b = 2400 + Math.random() * 600; for (let i = 0; i < 4; i++) tone('sine', b + (i % 2) * 500, b - 300 + (i % 2) * 700, t + i * 0.12, 0.08, 0.06, p, 0.4); },
  yawn(p) { const t = now(); const o = tone('sawtooth', 220, 110, t, 1.1, 0.06, p, 0.2, 0.2); },
  rustle(p) { noise(now(), 0.5, 0.07, 'highpass', 3000, 0.7, p, 0.1); },
  bonk(p) { const t = now(); tone('triangle', 420, 300, t, 0.1, 0.2, p, 0.3); tone('triangle', 400, 280, t + 0.5, 0.1, 0.18, p, 0.3); },
  gulp(p) { const t = now(); tone('sine', 300, 90, t, 0.25, 0.2, p, 0.1); },
  honk(p) { const t = now(); for (let i = 0; i < 3; i++) tone('sawtooth', 330, 300, t + i * 0.3, 0.16, 0.05, p, 0.3); },
  squeak(p) { const t = now(); tone('sine', 1500, 2200, t, 0.1, 0.08, p, 0.3); tone('sine', 1700, 2500, t + 0.14, 0.1, 0.07, p, 0.3); },
  boom(p) { const t = now(); tone('sine', 82, 48, t, 0.7, 0.5, p, 0.3, 0.04); tone('triangle', 164, 96, t, 0.5, 0.12, p, 0.2, 0.04); },
  bloop(p) { const t = now(); tone('sine', 300, 900, t, 0.4, 0.15, p, 0.4); },
  chime(p) { const t = now(); const b = [660, 880, 990, 1320][Math.random() * 4 | 0]; tone('sine', b, b, t, 1.4, 0.07, p, 0.6, 0.01); tone('sine', b * 2.76, b * 2.76, t, 0.6, 0.02, p, 0.6); },
  dim(p) { const t = now(); [880, 660, 440].forEach((f, i) => tone('sine', f, f, t + i * 0.25, 0.8, 0.05, p, 0.6)); },
  snip(p) { noise(now(), 0.03, 0.08, 'highpass', 4000, 1, p, 0.2); },
  tuck(p) { const t = now(); tone('triangle', 600, 200, t, 0.12, 0.1, p, 0.3); },
  flutter(p) { const t = now(); for (let i = 0; i < 8; i++) noise(t + i * 0.06, 0.04, 0.05, 'bandpass', 1200, 2, p, 0.3); },
  snap(p) { const t = now(); noise(t, 0.05, 0.12, 'bandpass', 2000, 2, p, 0.3); tone('sine', 900, 1400, t, 0.05, 0.05, p, 0.3); },
  whoosh(p) { noise(now(), 0.3, 0.06, 'bandpass', 600, 1, p, 0.3, 1600); },
  howl(p) { const t = now(); const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(330, t + 0.8); o.frequency.setValueAtTime(330, t + 2.2); o.frequency.exponentialRampToValueAtTime(220, t + 3);
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 4; const g = out(p, 0.6); env(g, t, 0.4, 0.12, 2.6);
    const l = ac.createOscillator(); const lg = ac.createGain(); l.frequency.value = 5; lg.gain.value = 6; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 3.2);
    o.connect(f); f.connect(g); o.start(t); o.stop(t + 3.2); },
  huff(p) { noise(now(), 0.25, 0.08, 'lowpass', 500, 1, p, 0.1); },
  sparkle(p) { const t = now(); [1320, 1760, 1980, 2640, 1980, 2640, 3520].forEach((f, i) => tone('sine', f, f, t + i * 0.09, 0.5, 0.04, p, 0.6)); },
  rec() { const t = now(); noise(t, 0.04, 0.2, 'bandpass', 2500, 3, 0, 0); tone('square', 80, 80, t, 0.03, 0.04, 0, 0); },
  stop() { const t = now(); noise(t, 0.05, 0.15, 'bandpass', 1800, 3, 0, 0); },
  out() { const t = now(); tone('sine', 300, 200, t, 0.3, 0.05, 0, 0.2); },
  tap() { noise(now(), 0.025, 0.1, 'bandpass', 3000, 2, 0, 0); },
  page() { noise(now(), 0.18, 0.06, 'bandpass', 2200, 0.7, 0, 0.1, 900); },
  ding() { const t = now(); tone('sine', 1320, 1320, t, 1.2, 0.08, 0, 0.5); tone('sine', 1980, 1980, t + 0.1, 1, 0.05, 0, 0.5); },
};
export function sfx(name, pan = 0, vol = 1) {
  if (!ac || !audio.on || !SFX[name]) return;
  try { SFX[name](pan * 0.7); } catch (e) { /* ignore */ }
}

// ---- the camera motor while rolling
let motor = null;
export function setMotor(on) {
  if (!ac) return;
  if (on && !motor) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 340; f.Q.value = 6;
    const g = ac.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.09, now(), 0.05);
    const lfo = ac.createOscillator(); lfo.frequency.value = 24; const lg = ac.createGain(); lg.gain.value = 0.03; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start();
    motor = { s, g, lfo };
  } else if (!on && motor) {
    const m = motor; motor = null; m.g.gain.setTargetAtTime(0, now(), 0.04); setTimeout(() => { try { m.s.stop(); m.lfo.stop(); } catch (e) {} }, 300);
  }
}

// ---- ambience per reel
let amb = null;
export function setAmbience(key) {
  if (!ac) return;
  if (amb) { const a = amb; amb = null; a.g.gain.setTargetAtTime(0, now(), 0.4); clearInterval(a.iv); setTimeout(() => a.nodes.forEach((n) => { try { n.stop(); } catch (e) {} }), 2000); }
  if (!key) { ambBus.gain.setTargetAtTime(0, now(), 0.3); return; }
  ambBus.gain.setTargetAtTime(1, now(), 0.5);
  const g = ac.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(1, now(), 0.8); g.connect(ambBus);
  const nodes = [];
  const river = ac.createBufferSource(); river.buffer = noiseBuf; river.loop = true;
  const rf = ac.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = key === 'caves' ? 380 : 620;
  const rg = ac.createGain(); rg.gain.value = key === 'caves' ? 0.07 : 0.05;
  river.connect(rf); rf.connect(rg); rg.connect(g); river.start(); nodes.push(river);
  if (key === 'marsh' || key === 'night') {
    const bz = ac.createBufferSource(); bz.buffer = noiseBuf; bz.loop = true;
    const bf = ac.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = key === 'night' ? 4600 : 3200; bf.Q.value = 12;
    const bg = ac.createGain(); bg.gain.value = 0.0;
    const l = ac.createOscillator(); l.frequency.value = key === 'night' ? 14 : 0.3; const lg = ac.createGain(); lg.gain.value = key === 'night' ? 0.05 : 0.03; l.connect(lg); lg.connect(bg.gain); l.start(); nodes.push(l);
    bz.connect(bf); bf.connect(bg); bg.connect(g); bz.start(); nodes.push(bz);
  }
  const iv = setInterval(() => {
    if (!amb || Math.random() < 0.5) return;
    const p = Math.random() * 1.6 - 0.8, t = now();
    const o = (type, f0, f1, at, d, v) => { const os = ac.createOscillator(); os.type = type; os.frequency.setValueAtTime(f0, t + at); os.frequency.exponentialRampToValueAtTime(f1, t + at + d); const gg = ac.createGain(); env(gg, t + at, 0.01, v, d); let n = gg; if (ac.createStereoPanner) { const pp = ac.createStereoPanner(); pp.pan.value = p; gg.connect(pp); n = pp; } n.connect(g); const s = ac.createGain(); s.gain.value = 0.4; n.connect(s); s.connect(echo); os.connect(gg); os.start(t + at); os.stop(t + at + d + 0.05); };
    if (key === 'wood') { const b = 2000 + Math.random() * 1500; for (let i = 0; i < 3; i++) o('sine', b, b * 1.2, i * 0.15, 0.1, 0.02); }
    else if (key === 'marsh') { if (Math.random() < 0.5) o('sine', 1400, 900, 0, 0.3, 0.015); }
    else if (key === 'caves') { const b = 900 + Math.random() * 1400; o('sine', b, b * 0.6, 0, 0.12, 0.03); }
    else if (key === 'night') { o('sine', 600, 560, 0, 0.5, 0.012); o('sine', 600, 560, 0.7, 0.5, 0.01); }
  }, 1100);
  amb = { g, nodes, iv };
}

// ---- the score: a slow string pad with a harp arpeggio over it
let mus = null;
const KEYS = [
  [[62, 66, 69, 74], [59, 62, 66, 71], [55, 59, 62, 67], [57, 61, 64, 69]],
  [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]],
  [[57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67], [52, 55, 59, 64]],
  [[58, 62, 65, 70], [55, 58, 62, 67], [51, 55, 58, 63], [53, 57, 60, 65]],
];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
export function startMusic(ri = 0, level = 0.55) {
  if (!ac) return;
  stopMusic();
  musBus.gain.cancelScheduledValues(now()); musBus.gain.setTargetAtTime(level, now(), 0.8);
  const prog = KEYS[ri % KEYS.length];
  const bar = 4.2; let next = now() + 0.1, i = 0;
  const pad = ac.createBiquadFilter(); pad.type = 'lowpass'; pad.frequency.value = 900; pad.connect(musBus);
  const ps = ac.createGain(); ps.gain.value = 0.35; pad.connect(ps); ps.connect(echo);
  const tick = () => {
    while (next < now() + 1.5) {
      const ch = prog[i % prog.length];
      for (const m of [ch[0] - 12, ...ch.slice(1)]) {
        for (const dt of [-6, 5]) {
          const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = dt;
          const g = ac.createGain(); g.gain.setValueAtTime(0.0001, next); g.gain.exponentialRampToValueAtTime(0.018, next + 1.4); g.gain.setValueAtTime(0.018, next + bar - 0.6); g.gain.exponentialRampToValueAtTime(0.0001, next + bar + 0.8);
          o.connect(g); g.connect(pad); o.start(next); o.stop(next + bar + 1);
        }
      }
      const arp = [ch[0], ch[1], ch[2], ch[3], ch[2] + 12, ch[3], ch[1] + 12, ch[2]];
      arp.forEach((m, k) => {
        const t = next + k * (bar / 8);
        const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(m + 12);
        const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        const pn = ac.createStereoPanner ? ac.createStereoPanner() : null;
        o.connect(g); if (pn) { pn.pan.value = (k / 7) * 1.2 - 0.6; g.connect(pn); pn.connect(musBus); } else g.connect(musBus);
        const s = ac.createGain(); s.gain.value = 0.3; g.connect(s); s.connect(echo);
        o.start(t); o.stop(t + 1.3);
      });
      next += bar; i++;
    }
  };
  tick(); const iv = setInterval(tick, 400);
  mus = { iv };
}
export function stopMusic() {
  if (!ac) return;
  if (mus) { clearInterval(mus.iv); mus = null; }
  musBus.gain.cancelScheduledValues(now()); musBus.gain.setTargetAtTime(0, now(), 0.6);
}

// ---- projector clatter under the screening
let proj = null;
export function setProjector(on) {
  if (!ac) return;
  if (on && !proj) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 2;
    const g = ac.createGain(); g.gain.value = 0.0;
    const l = ac.createOscillator(); l.type = 'square'; l.frequency.value = 18; const lg = ac.createGain(); lg.gain.value = 0.012; l.connect(lg); lg.connect(g.gain); l.start();
    s.connect(f); f.connect(g); g.connect(master); s.start();
    proj = { s, l };
  } else if (!on && proj) { try { proj.s.stop(); proj.l.stop(); } catch (e) {} proj = null; }
}

// ---- the narrator's voice (the browser's own speech, if it has any)
let voice = null;
function pickVoice() {
  if (!window.speechSynthesis) return null;
  const vs = speechSynthesis.getVoices(); if (!vs.length) return null;
  const pref = [/Daniel/i, /Arthur/i, /Google UK English Male/i, /en-GB/i, /^en/i];
  for (const re of pref) { const v = vs.find((v) => re.test(v.name) || re.test(v.lang)); if (v) return v; }
  return vs[0];
}
export const canSpeak = () => typeof window !== 'undefined' && !!window.speechSynthesis;
export function speak(text, onend, silent) {
  if (!canSpeak()) { onend && onend(); return; }
  try {
    speechSynthesis.cancel();
    if (!voice) voice = pickVoice();
    const u = new SpeechSynthesisUtterance(text.replace(/BOOM/g, 'Boom'));
    if (voice) u.voice = voice; u.rate = 0.9; u.pitch = 0.92; u.volume = silent ? 0 : 1;
    let done = false; const fin = () => { if (!done) { done = true; onend && onend(); } };
    u.onend = fin; u.onerror = fin;
    speechSynthesis.speak(u);
    return fin;
  } catch (e) { onend && onend(); }
}
export function hush() { if (canSpeak()) try { speechSynthesis.cancel(); } catch (e) {} }
if (typeof window !== 'undefined' && window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };
