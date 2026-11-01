// Customs of the Dead: a few synthesized sounds. Nothing plays until the first tap.
let ac = null, master = null, muted = false;
try { muted = localStorage.getItem('customs.mute') === '1'; } catch {}

export function unlock() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : .7; master.connect(ac.destination);
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : .7; try { localStorage.setItem('customs.mute', m ? '1' : '0'); } catch {} }
export const isMuted = () => muted;

function noise(dur) {
  const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const n = ac.createBufferSource(); n.buffer = b; return n;
}
function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0005, t + a + dec); }
function tone(type, f, t, dur, peak, f2) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, .005, peak, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
}
function hiss(t, dur, peak, freq, q = 1, type = 'bandpass') {
  const n = noise(dur + .05), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  env(g, t, .004, peak, dur); n.connect(f); f.connect(g); g.connect(master); n.start(t);
}

export const sfx = {
  stamp() { if (!ac) return; const t = ac.currentTime; tone('sine', 140, t, .22, .9, 45); hiss(t, .09, .7, 900, .7); hiss(t + .01, .05, .4, 3000, 1); },
  paper() { if (!ac) return; const t = ac.currentTime; hiss(t, .16, .22, 2400, .6); hiss(t + .05, .12, .12, 5200, .8); },
  bell() { if (!ac) return; const t = ac.currentTime; tone('sine', 1320, t, .9, .18); tone('sine', 1980, t, .5, .06); tone('triangle', 660, t, .7, .08); },
  pick() { if (!ac) return; const t = ac.currentTime; tone('square', 880, t, .05, .05); },
  good() { if (!ac) return; const t = ac.currentTime; tone('triangle', 523, t, .15, .12); tone('triangle', 784, t + .08, .25, .12); },
  bad() { if (!ac) return; const t = ac.currentTime; tone('sawtooth', 130, t, .35, .12, 110); tone('sawtooth', 138, t, .35, .1, 104); },
  found() { if (!ac) return; const t = ac.currentTime; tone('square', 392, t, .1, .07); tone('square', 311, t + .1, .2, .07); },
  coin() { if (!ac) return; const t = ac.currentTime; tone('square', 1568, t, .06, .05); tone('square', 2093, t + .06, .18, .05); },
  print() { if (!ac) return; const t = ac.currentTime; for (let i = 0; i < 6; i++) hiss(t + i * .07, .05, .2, 1800, 2); },
  toll() { if (!ac) return; const t = ac.currentTime; tone('sine', 196, t, 2.4, .35); tone('sine', 294, t, 1.6, .12); tone('sine', 392.5, t, 1.2, .07); },
  arm() { if (!ac) return; const t = ac.currentTime; hiss(t, .06, .25, 600, 1); },
  // Ignacio's accordion: a little waltz on two detuned reeds.
  accordion() {
    if (!ac) return; const t = ac.currentTime;
    const notes = [[392, 0, .4], [440, .4, .2], [392, .6, .2], [330, .8, .6], [349, 1.4, .4], [392, 1.8, .2], [440, 2.0, .2], [523, 2.2, .9]];
    for (const [f, d, l] of notes) { tone('sawtooth', f, t + d, l, .045); tone('sawtooth', f * 1.006, t + d, l, .04); tone('square', f / 2, t + d, l, .02); }
  },
};
