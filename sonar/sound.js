// Hull, motor, hydrophone and the other voice, all made here.
export class Sound {
  constructor() { this.muted = false; }
  init() {
    if (this.ctx) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const c = this.ctx; this.out = c.createGain(); this.out.gain.value = this.muted ? 0 : .8; const cp = c.createDynamicsCompressor(); this.out.connect(cp); cp.connect(c.destination);
    const n = c.sampleRate * 2, b = this.nb = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // a long cold reverb
    const ir = c.createBuffer(2, c.sampleRate * 3.2, c.sampleRate); for (let k = 0; k < 2; k++) { const a = ir.getChannelData(k); let l = 0; for (let i = 0; i < a.length; i++) { l += ((Math.random() * 2 - 1) - l) * .25; a[i] = l * Math.pow(1 - i / a.length, 2.6); } }
    this.rev = c.createConvolver(); this.rev.buffer = ir; const rg = c.createGain(); rg.gain.value = .9; this.rev.connect(rg); rg.connect(this.out);
    const loop = (f, type, q, g) => { const s = c.createBufferSource(); s.buffer = b; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const gn = c.createGain(); gn.gain.value = g; s.connect(fl); fl.connect(gn); gn.connect(this.out); s.start(); return { fl, gn, s }; };
    loop(90, 'lowpass', .7, .22); this.hiss = loop(2400, 'bandpass', .6, 0);
    const pn = c.createStereoPanner(); this.br = loop(210, 'bandpass', 3, 0); this.br.gn.disconnect(); this.br.gn.connect(pn); pn.connect(this.out); this.brPan = pn;
    this.drone = c.createGain(); this.drone.gain.value = .03; this.drone.connect(this.out); for (const f of [41.2, 41.6, 61.7]) { const o = c.createOscillator(); o.frequency.value = f; o.connect(this.drone); o.start(); }
    const mo = this.mo = c.createOscillator(); mo.type = 'sawtooth'; mo.frequency.value = 30; this.mg = c.createGain(); this.mg.gain.value = 0; const ml = c.createBiquadFilter(); ml.type = 'lowpass'; ml.frequency.value = 240; mo.connect(ml); ml.connect(this.mg); this.mg.connect(this.out); mo.start();
  }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }
  pause() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  mute(m) { this.muted = m; if (this.out) this.out.gain.setTargetAtTime(m ? 0 : .8, this.ctx.currentTime, .05); }
  dest(pan, wet) { const c = this.ctx, p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan || 0)); p.connect(this.out); if (wet) { const g = c.createGain(); g.gain.value = wet; p.connect(g); g.connect(this.rev); } return p; }
  tone(f, dur, g, o = {}) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + (o.at || 0), s = c.createOscillator(), e = c.createGain(); s.type = o.type || 'sine'; s.frequency.setValueAtTime(f, t); if (o.to) s.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + (o.a || .006)); e.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(e); e.connect(this.dest(o.pan, o.wet)); s.start(t); s.stop(t + dur + .05);
  }
  nz(f, dur, g, o = {}) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + (o.at || 0), s = c.createBufferSource(), fl = c.createBiquadFilter(), e = c.createGain(); s.buffer = this.nb; s.loop = true; fl.type = o.type || 'bandpass'; fl.Q.value = o.q || 1; fl.frequency.setValueAtTime(f, t); if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + (o.a || .004)); e.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(fl); fl.connect(e); e.connect(this.dest(o.pan, o.wet)); s.start(t, Math.random()); s.stop(t + dur + .05);
  }
  frame(g, L, rel) {
    const c = this.ctx; if (!c) return; const t = c.currentTime, live = g && g.live, sp = live ? Math.abs(g.v) : 0, set = (p, v, k = .15) => p.setTargetAtTime(v, t, k);
    set(this.mg.gain, live ? (g.thr !== 1 ? .05 + sp * .012 : sp * .004) : 0); set(this.mo.frequency, 26 + sp * 7);
    set(this.hiss.gn.gain, live && g.ventAt(g.x, g.y) ? .05 : 0, .6);
    set(this.br.gn.gain, L ? L.s * L.s * (.5 + .5 * Math.sin(t * 1.1) * Math.sin(t * .37)) * 1.1 : 0, .3); if (L) { set(this.brPan.pan, Math.sin(rel)); set(this.br.fl.frequency, 160 + L.s * 160); }
  }
  ping(hits) { this.tone(1180, 1.5, .2, { wet: .8, to: 1160 }); const s = hits.filter((_, i) => i % 25 === 0).map(h => h.d).sort((a, b) => a - b); for (const d of s.slice(0, 5)) this.tone(1150, .5, .05 * (1 - d / 190), { at: .08 + d / 130, wet: .8 }); if (hits.some(h => h.k === 'it')) this.tone(390, 1.3, .12, { at: .3, wet: 1, to: 300 }); }
  mimic(pan, s) { this.tone(1090, 1.5, .05 + .12 * s, { wet: 1.3, pan, to: 1010, a: .05 }); this.tone(1097, 1.4, .05 * s + .02, { wet: 1, pan, to: 1042, a: .09 }); }
  call(pan, s) { this.tone(74, 3.2, .16 * s + .03, { pan, wet: 1, to: 47, a: .6, type: 'triangle' }); this.tone(222, 2.4, .03 * s, { pan, wet: 1.2, to: 118, a: .8, at: .4 }); }
  shutter() { this.nz(2600, .05, .4); this.nz(700, .12, .3, { at: .06 }); this.tone(60, .4, .5, { to: 34, wet: .4 }); this.nz(5200, .6, .06, { at: .1, to: 800 }); }
  slosh() { this.nz(620, .5, .05, { a: .2, to: 380, q: 2 }); this.nz(900, .4, .03, { at: .5, a: .15, to: 500, q: 2 }); }
  lamp() { this.nz(3200, .03, .3); }
  clunk(n = 1) { this.nz(380, .09, .4, { q: 3 }); this.tone(150, .1, .12, { type: 'square', to: 90 }); if (n > 1) this.nz(900, .05, .2, { at: .05 }); }
  key() { this.nz(1900, .025, .05, { q: 2 }); }
  bump(h) { this.tone(70, .5, Math.min(.6, .15 + h * .06), { to: 32, wet: .5 }); this.nz(240, .7, .2, { q: 2, to: 120, wet: .4 }); }
  creak() { const f = 180 + Math.random() * 160; this.tone(f, 1.1, .018, { type: 'sawtooth', to: f * (.6 + Math.random()), a: .3, wet: 1, pan: Math.random() * 2 - 1 }); this.nz(f * 3, .8, .018, { q: 18, a: .2, to: f * 2, wet: .8 }); }
  strike() { this.tone(55, 1.3, .9, { to: 24, wet: .6 }); this.nz(300, .9, .7, { to: 80, wet: .5 }); this.nz(2800, .8, .2, { at: .1, q: 9, to: 1200 }); this.alarm(); }
  alarm() { for (let i = 0; i < 3; i++) this.tone(620, .18, .07, { type: 'square', at: .5 + i * .3 }); }
  feel() { for (let i = 0; i < 16; i++) this.nz(700 + Math.random() * 1500, .16, .07 + Math.random() * .06, { q: 7, at: i * .46 + Math.random() * .3, pan: Math.random() * 2 - 1, wet: .3, to: 500 }); this.tone(48, 7, .25, { a: 1.5, to: 40 }); }
  ring() { for (const a of [0, .5]) for (let i = 0; i < 6; i++) this.tone(i % 2 ? 880 : 1010, .07, .05, { at: a + i * .06, type: 'triangle' }); }
  winch() { for (let i = 0; i < 9; i++) this.nz(520, .06, .14, { at: i * .17, q: 4 }); this.tone(90, 1.8, .1, { type: 'sawtooth', to: 130 }); }
  decoy(pan, s) { this.nz(1500, .12, .12 * s, { q: 5, pan }); this.nz(1100, .12, .1 * s, { q: 5, at: .16, pan }); }
  feeler(f) { this.tone(f, .04, .03, { type: 'square' }); }
  lost() { this.tone(52, 4, .6, { to: 20, a: .2, wet: 1 }); this.nz(160, 4, .35, { to: 60, a: .5, type: 'lowpass' }); }
}
