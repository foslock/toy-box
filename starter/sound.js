// Small synthesised sounds with Web Audio: a bubble pop for every tap, a glug when you're fed, a chime for each thing
// bought (its timbre changes with the phase), a swell between phases and a sigh when you collapse. Nothing loads.
export function makeSound() {
  let ac = null, out = null, on = true, last = {};
  function ctx() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    out = ac.createGain(); out.gain.value = .55; out.connect(ac.destination);
    return ac;
  }
  const now = () => ac.currentTime;
  function tone(freq, { type = 'sine', at = 0, dur = .15, vol = .2, to = null, attack = .005 } = {}) {
    const t = now() + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .05);
  }
  function noise({ at = 0, dur = .3, vol = .15, f0 = 800, f1 = 300, q = 1 } = {}) {
    const t = now() + at, n = Math.ceil(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = b; f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + dur + .05);
  }
  const PLAY = {
    bubble() { const f = 380 + Math.random() * 420; tone(f, { dur: .07, vol: .16, to: f * 2.2 }); },
    feed() { tone(180, { dur: .22, vol: .18, to: 90 }); tone(150, { at: .16, dur: .2, vol: .14, to: 80 }); noise({ at: .05, dur: .35, vol: .05, f0: 1200, f1: 400 }); },
    buy(phase) {
      if (phase === 0) { tone(880, { type: 'triangle', dur: .12, vol: .14 }); tone(1320, { type: 'triangle', at: .07, dur: .25, vol: .1 }); }
      else if (phase === 1) { noise({ dur: .05, vol: .2, f0: 3000, f1: 2000, q: 3 }); tone(1975, { at: .05, dur: .6, vol: .08 }); }
      else if (phase === 2) { tone(1046, { type: 'triangle', dur: .15, vol: .1 }); tone(1568, { type: 'triangle', at: .09, dur: .5, vol: .1 }); tone(2093, { at: .12, dur: .7, vol: .05 }); }
      else { for (const [f, a] of [[784, 0], [1175, .06], [1568, .12], [2349, .2]]) tone(f, { at: a, dur: 1.4, vol: .06, attack: .02 }); }
    },
    make(phase) { tone(phase === 3 ? 1568 : 660 + phase * 110, { type: 'triangle', dur: .08, vol: .08 }); },
    give() { tone(320, { dur: .06, vol: .12 }); tone(300, { at: .14, dur: .06, vol: .12 }); },
    phase() { for (const [f, a] of [[262, 0], [330, .15], [392, .3], [523, .45]]) tone(f, { at: a, dur: 2.4, vol: .07, attack: .3 }); },
    collapse() { noise({ dur: 1.8, vol: .12, f0: 900, f1: 120, q: .7 }); tone(220, { dur: 1.6, vol: .08, to: 70, attack: .1 }); },
    end() { for (const [f, a] of [[196, 0], [247, .4], [294, .8], [392, 1.2], [494, 1.6]]) tone(f, { at: a, dur: 4, vol: .06, attack: .6 }); },
  };
  return {
    get on() { return on; },
    set on(v) { on = !!v; },
    unlock() { const c = ctx(); if (c && c.state === 'suspended') c.resume(); },
    play(name, arg) {
      if (!on || !PLAY[name]) return;
      const c = ctx(); if (!c || c.state !== 'running') { c && c.resume(); return; }
      const tm = performance.now();
      if (name === 'bubble' && tm - (last.bubble || 0) < 35) return;     // a fast drum roll shouldn't turn into a buzz
      last[name] = tm;
      try { PLAY[name](arg); } catch {}
    },
  };
}
