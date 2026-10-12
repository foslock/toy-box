// Crossfire: sound, all synthesized. Thumps, whistles, booms and a tinny bugle.
export class Sound {
  constructor() { this.ctx = null; this.muted = false; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.out = this.ctx.createGain(); this.out.gain.value = .7;
    const comp = this.ctx.createDynamicsCompressor();
    this.out.connect(comp); comp.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  get ok() { return this.ctx && !this.muted; }
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  burst(freq, q, peak, dec, type = 'lowpass', at = 0) {
    const c = this.ctx, t = c.currentTime + at;
    const n = c.createBufferSource(); n.buffer = this.noise; n.playbackRate.value = .6 + Math.random() * .4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); this.env(g, t, .005, peak, dec);
    n.connect(f); f.connect(g); g.connect(this.out); n.start(t); n.stop(t + dec + .1);
    return f;
  }
  tone(freq, to, peak, dec, type = 'sine', at = 0) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dec);
    const g = c.createGain(); this.env(g, t, .006, peak, dec);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dec + .1);
  }
  fire(weapon) {
    if (!this.ok) return;
    if (weapon === 'mortar') { this.tone(90, 40, .9, .4); this.burst(900, 1, .5, .25); this.tone(500, 1400, .08, .7, 'triangle', .1); return; }
    this.tone(140, 45, .8, .25); this.burst(1600, .8, .45, .18);
    if (weapon === 'grenade') this.tone(900, 700, .06, .08, 'square', .05);
  }
  whistle(dur = 1.4) { if (this.ok) this.tone(1500, 500, .05, dur, 'sine'); }
  boom(big) {
    if (!this.ok) return;
    this.tone(70, 28, big ? 1 : .85, big ? .9 : .6);
    const f = this.burst(big ? 1400 : 900, .7, big ? .9 : .75, big ? 1.1 : .75);
    f.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + (big ? 1 : .7));
    if (big) { this.burst(3000, 1, .5, .3, 'bandpass', .05); this.tone(400, 90, .2, .4, 'sawtooth'); }
  }
  bounce() { if (this.ok) { this.tone(420 + Math.random() * 120, 260, .18, .08, 'triangle'); } }
  splash() { if (this.ok) { const f = this.burst(2400, 1, .5, .6, 'bandpass'); f.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + .5); } }
  plop() { if (this.ok) this.tone(600, 150, .25, .15, 'sine'); }
  ouch() { if (this.ok) this.tone(520 + Math.random() * 160, 300, .12, .18, 'square'); }
  pop() { if (this.ok) { this.tone(900, 1800, .2, .06, 'triangle'); this.burst(4000, 1, .2, .08, 'highpass'); } }
  shield() { if (this.ok) this.tone(300, 900, .12, .3, 'sine'); }
  tick() { if (this.ok) this.tone(1800, 1200, .05, .03, 'square'); }
  stamp() { if (this.ok) { this.tone(110, 60, .7, .15); this.burst(700, 1, .4, .1); } }
  walk() { if (this.ok) this.burst(1200, 2, .05, .05, 'bandpass'); }
  incoming() { if (this.ok) this.tone(1800, 300, .1, 1.3, 'sine'); }
  bugle(win) {
    if (!this.ok) return;
    const notes = win ? [392, 523, 659, 784, 659, 784] : [392, 370, 349, 262];
    const lens = win ? [.12, .12, .12, .3, .12, .5] : [.3, .3, .3, .8];
    let t = 0;
    notes.forEach((n, i) => { this.tone(n, null, .16, lens[i] + .05, 'square', t); this.tone(n * 2, null, .04, lens[i], 'sawtooth', t); t += lens[i]; });
  }
}
