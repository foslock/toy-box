// Small synthesised sounds, all bright and friendly whatever is happening. Nothing plays until the first tap.
export function makeSound() {
  let ac = null, out = null;
  const api = { on: true };
  api.unlock = () => {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      out = ac.createGain(); out.gain.value = .5; out.connect(ac.destination);
    } catch { ac = null; }
  };
  function tone(f, at, dur, { type = 'sine', vol = .2, to = null, attack = .005 } = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, at);
    if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + attack); g.gain.exponentialRampToValueAtTime(.0001, at + dur);
    o.connect(g); g.connect(out); o.start(at); o.stop(at + dur + .02);
  }
  let last = {};
  api.play = name => {
    if (!api.on || !ac || ac.state !== 'running') return;
    const now = ac.currentTime;
    if (last[name] && now - last[name] < .06) return;
    last[name] = now;
    switch (name) {
      case 'pop': tone(880, now, .12, { to: 1320, vol: .16 }); tone(1760, now + .03, .1, { vol: .06 }); break;
      case 'buy': [523, 659, 784].forEach((f, i) => tone(f, now + i * .06, .35, { type: 'triangle', vol: .12 })); break;
      case 'seed': tone(660, now, .25, { type: 'triangle', vol: .08 }); tone(990, now + .05, .3, { vol: .05 }); break;
      case 'hush': tone(520, now, .18, { to: 390, type: 'triangle', vol: .12 }); break;
      case 'leak': tone(300, now, .4, { to: 180, type: 'sawtooth', vol: .05 }); break;
      case 'policy': tone(220, now, .25, { type: 'triangle', vol: .08 }); break;
      case 'era': [392, 494, 587, 740].forEach((f, i) => tone(f, now + i * .03, 1.6, { type: 'sine', vol: .07, attack: .2 })); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, now + i * .12, .9, { type: 'triangle', vol: .12 })); break;
      case 'lose': [392, 349, 311, 262].forEach((f, i) => tone(f, now + i * .22, .8, { type: 'triangle', vol: .1 })); break;
    }
  };
  return api;
}
