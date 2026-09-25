// The sound system. Each speaker's part comes out of that speaker: a mono point source, placed with the browser's
// HRTF panner so headphones can tell you where it is, getting quieter and duller with distance, muffled a little by
// any hedge in the way, and louder in front of the speaker than behind it. The levels are set so that every part
// arrives in balance at the chair in the middle. Around them: a shared reverb, the breeze, birds, trickling water,
// and your own footsteps.
import * as L from './layout.js';
import { Music, PARTS } from './music.js';
import { gust, clamp, lerp, smooth } from './common.js';

const R0 = 2.5;                                        // within this distance a speaker is at full level
const direct = d => (R0 / Math.max(R0, d)) ** .75;     // a little gentler than the inverse-distance law
const diffuse = d => (R0 / Math.max(R0, d)) ** .33;    // reverb falls off more slowly: far things sound further away
const WET = { pad: .5, bowls: .5, shimmer: .62, handpan: .36, flute: .5, bass: .1, chimes: .5, piano: .42 };
export const SEAT_EAR = 1.42;                          // ear height sitting in the chair on the dais

// A long, soft reverb: decorrelated noise that darkens as it decays, like a big room with soft walls.
function impulse(ctx, secs = 4.4) {
  const sr = ctx.sampleRate, pre = .018, n = (secs + pre) * sr | 0, b = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0, seed = 1234 + c * 999;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
    for (let i = pre * sr | 0; i < n; i++) {
      const t = i / sr - pre, a = 1 - Math.exp(-6.2832 * (900 + 10500 * Math.exp(-t * 1.25)) / sr);
      lp += a * (rand() - lp);
      d[i] = lp * Math.exp(-t * 6.9 / secs) * (1 - Math.exp(-t / .045));
    }
    for (let k = 0; k < 9; k++) {                        // a few early reflections
      const t = pre + .006 + (k * .0071 + (rand() * .5 + .5) * .012), i = t * sr | 0;
      d[i] += rand() * .5 * Math.exp(-t * 14);
    }
  }
  return b;
}

export class GardenAudio {
  constructor() {
    this.ctx = null; this.muted = false; this.bank = null; this.pending = null; this.levels = {};
    for (const p of PARTS) this.levels[p.id] = 0;
    // Start rendering the instruments straight away, before anyone presses anything.
    this.sr = 48000;
    try {
      const w = new Worker(new URL('./samples.js', import.meta.url), { type: 'module' });
      this.pending = new Promise(ok => { w.onmessage = e => { ok(e.data); w.terminate(); }; w.onerror = () => ok(null); });
      w.postMessage({ sr: this.sr });
    } catch { this.pending = Promise.resolve(null); }
  }
  get running() { return this.ctx?.state === 'running'; }

  // Called from a click: browsers only let sound start after a gesture.
  start(visualNow) {
    if (this.ctx) { if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC({ latencyHint: 'balanced' });
    ctx.resume?.();
    this.gustOffset = visualNow - ctx.currentTime;
    const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
    this.gain = gain;

    // master: a gentle glue compressor, then a limiter for when you stand right next to something
    this.master = gain(this.muted ? 0 : 1);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 24; hp.Q.value = .6;
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20; glue.knee.value = 12; glue.ratio.value = 2.2; glue.attack.value = .03; glue.release.value = .35;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .15;
    this.master.connect(hp); hp.connect(glue); glue.connect(lim); lim.connect(ctx.destination);
    this.dry = gain(.8); this.dry.connect(this.master);
    this.verb = ctx.createConvolver(); this.verb.buffer = impulse(ctx);
    this.verbIn = gain(1); this.verbOut = gain(1);
    this.verbIn.connect(this.verb); this.verb.connect(this.verbOut); this.verbOut.connect(this.master);
    this.amb = gain(1); this.amb.connect(this.master);

    this.music = new Music(ctx, t => gust(t + this.gustOffset));
    this.speakers = L.SPEAKERS.map(sp => this.speakerChain(sp));
    this.calibrate();
    this.breeze();

    this.pending.then(res => { if (res) this.useBank(res); });
    this.timer = setInterval(() => this.tick(), 60);
  }

  panner(x, y, z) {
    const p = new PannerNode(this.ctx, { panningModel: 'HRTF', distanceModel: 'linear', rolloffFactor: 0, refDistance: 1, maxDistance: 1e4 });
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
    return p;
  }
  speakerChain(sp) {
    const ctx = this.ctx, part = this.music.parts[sp.part];
    const trim = this.gain(1), pre = this.gain(0), lp = ctx.createBiquadFilter(), pan = this.panner(sp.x, sp.y, sp.z), send = this.gain(0);
    lp.type = 'lowpass'; lp.frequency.value = 18000; lp.Q.value = .5;
    const an = ctx.createAnalyser(); an.fftSize = 512;
    part.out.connect(trim); part.out.connect(an);
    trim.connect(pre); pre.connect(lp); lp.connect(pan); pan.connect(this.dry);
    trim.connect(send); send.connect(this.verbIn);
    return { sp, part, trim, pre, lp, pan, send, an, buf: new Float32Array(512), occ: 0, fx: Math.sin(sp.yaw), fz: Math.cos(sp.yaw), cal: 1, calD: 1 };
  }
  // How the garden treats a sound from speaker s heard at (x, y, z): distance, which way the speaker faces, hedges.
  shape(s, x, y, z, occ) {
    const dx = x - s.sp.x, dy = y - s.sp.y, dz = z - s.sp.z, d = Math.hypot(dx, dy, dz);
    const facing = (dx * s.fx + dz * s.fz) / Math.max(.01, Math.hypot(dx, dz));
    const cone = lerp(.5, 1, smooth(-.4, .55, facing));
    return { d, gain: direct(d) * cone * lerp(1, .5, clamp(occ, 0, 1)), cone };
  }
  // Balance the parts for the chair: each speaker's trim makes its part arrive there at its own mix level.
  calibrate() {
    for (const s of this.speakers) {
      const occ = L.occlusion(L.CHAIR.x, SEAT_EAR, L.CHAIR.z, s.sp.x, s.sp.y, s.sp.z);
      const { d, gain } = this.shape(s, L.CHAIR.x, SEAT_EAR, L.CHAIR.z, occ);
      s.cal = 1 / gain; s.calD = d;
      s.trim.gain.value = s.cal;
    }
  }
  useBank({ sr, sounds }) {
    const bank = {};
    for (const [g, set] of Object.entries(sounds)) {
      bank[g] = {};
      for (const [k, arr] of Object.entries(set)) { const b = new AudioBuffer({ length: arr.length, sampleRate: sr, numberOfChannels: 1 }); b.copyToChannel(arr, 0); bank[g][k] = b; }
    }
    this.bank = bank;
    this.music.setBank(bank);
    this.water();
    this.nextBird = this.ctx.currentTime + 3;
  }

  /* ---------- the garden ---------- */
  breeze() {
    const ctx = this.ctx, len = ctx.sampleRate * 4;
    this.breezeGain = this.gain(0); this.rustleGain = this.gain(0);
    const merge = ctx.createChannelMerger(2);
    for (let c = 0; c < 2; c++) {
      const b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      let p = 0; for (let i = 0; i < len; i++) { p = p * .985 + (Math.random() * 2 - 1) * .12; d[i] = p; }   // brown-ish noise
      const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = c ? 640 : 520; bp.Q.value = .5;
      src.connect(bp); bp.connect(merge, 0, c);
      const w = ctx.createBuffer(1, len, ctx.sampleRate), wd = w.getChannelData(0);
      for (let i = 0; i < len; i++) wd[i] = Math.random() * 2 - 1;
      const ws = ctx.createBufferSource(); ws.buffer = w; ws.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = c ? 4200 : 3600; hp.Q.value = .7;
      const flutter = this.gain(.5), lfo = ctx.createOscillator(), lg = this.gain(.5);
      lfo.frequency.value = 5 + c * 2.3; lfo.connect(lg); lg.connect(flutter.gain);
      ws.connect(hp); hp.connect(flutter); flutter.connect(this.rustleGain);
      src.start(0, Math.random() * 3); ws.start(0, Math.random() * 3); lfo.start();
    }
    merge.connect(this.breezeGain); this.breezeGain.connect(this.amb);
    this.rustleGain.connect(this.amb);
  }
  water() {
    const at = [...L.PROPS.filter(p => p.kind === 'basin' || p.kind === 'birdbath')];
    this.fountains = at.map(p => {
      const src = this.ctx.createBufferSource(); src.buffer = this.bank.water.trickle; src.loop = true;
      const g = this.gain(0), pan = this.panner(p.x, .5, p.z);
      src.playbackRate.value = p.kind === 'basin' ? 1 : 1.18;
      src.connect(g); g.connect(pan); pan.connect(this.amb);
      src.start(0, Math.random() * 5);
      return { p, g, level: p.kind === 'basin' ? .5 : .32 };
    });
  }
  bird() {
    const kinds = Object.keys(this.bank.bird), k = kinds[Math.random() * kinds.length | 0];
    const trees = L.TREES.filter(t => !k.startsWith('pigeon') || t.kind === 'birch' || t.kind === 'cherry' || t.kind === 'willow');
    const t = trees[Math.random() * trees.length | 0], y = k.startsWith('robin') ? 1.6 + Math.random() * 1.5 : 3.5 + Math.random() * 3;
    // birds also sit on the garden wall
    const onWall = Math.random() < .35, a = Math.random() * Math.PI * 2;
    const x = onWall ? clamp(Math.cos(a) * 40, -26, 26) : t.x, z = onWall ? clamp(Math.sin(a) * 40, -26, 26) : t.z;
    const src = this.ctx.createBufferSource(); src.buffer = this.bank.bird[k]; src.playbackRate.value = .94 + Math.random() * .12;
    const g = this.gain(0), pan = this.panner(x, onWall ? 4.4 : y, z);
    const d = this.ear ? Math.hypot(this.ear[0] - x, this.ear[2] - z) : 20;
    g.gain.value = (k.startsWith('pigeon') ? .34 : .26) * (R0 / Math.max(R0, d)) ** .8 * 3;
    src.connect(g); g.connect(pan); pan.connect(this.amb);
    const send = this.gain(.25 * g.gain.value); g.connect(send); send.connect(this.verbIn);
    src.start();
    // a pigeon calls two or three times over
    if (k.startsWith('pigeon') && Math.random() < .7) { const s2 = this.ctx.createBufferSource(); s2.buffer = src.buffer; s2.playbackRate.value = src.playbackRate.value; s2.connect(g); s2.start(this.ctx.currentTime + src.buffer.duration + .5); }
  }

  /* ---------- per frame ---------- */
  tick() {
    if (!this.running) return;
    const now = this.ctx.currentTime;
    this.music.schedule(now + 3.2);
    if (this.bank && now > this.nextBird) { this.bird(); this.nextBird = now + 5 + Math.random() * 11; }
  }
  // ear: [x, y, z]; fwd and up: unit vectors from the camera.
  update(ear, fwd, up, dt, visualNow) {
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime, li = ctx.listener, k = .04;
    if (visualNow !== undefined && this.running) this.gustOffset += (visualNow - now - this.gustOffset) * .05;   // keep the chimes on the same breeze as the leaves
    this.ear = ear;
    if (li.positionX) {
      li.positionX.setTargetAtTime(ear[0], now, k); li.positionY.setTargetAtTime(ear[1], now, k); li.positionZ.setTargetAtTime(ear[2], now, k);
      li.forwardX.setTargetAtTime(fwd.x, now, k); li.forwardY.setTargetAtTime(fwd.y, now, k); li.forwardZ.setTargetAtTime(fwd.z, now, k);
      li.upX.setTargetAtTime(up.x, now, k); li.upY.setTargetAtTime(up.y, now, k); li.upZ.setTargetAtTime(up.z, now, k);
    } else { li.setPosition(...ear); li.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
    for (const s of this.speakers) {
      const occ = L.occlusion(ear[0], ear[1], ear[2], s.sp.x, s.sp.y, s.sp.z);
      s.occ += (occ - s.occ) * Math.min(1, dt * 4);
      const { d, gain } = this.shape(s, ear[0], ear[1], ear[2], s.occ);
      s.pre.gain.setTargetAtTime(gain, now, .06);
      const cut = Math.max(650, 19000 * Math.exp(-d / 42) * lerp(1, .13, clamp(s.occ, 0, 1)));
      s.lp.frequency.setTargetAtTime(cut, now, .08);
      s.send.gain.setTargetAtTime(WET[s.sp.part] * direct(s.calD) * diffuse(d) / diffuse(s.calD), now, .1);
      // how loud the part is right now, for the speaker's light and cone
      s.an.getFloatTimeDomainData(s.buf);
      let e = 0; for (let i = 0; i < s.buf.length; i += 2) e += s.buf[i] * s.buf[i];
      this.levels[s.sp.part] = Math.sqrt(e / (s.buf.length / 2));
    }
    const g = gust(now + this.gustOffset);
    this.breezeGain.gain.setTargetAtTime(.012 + .05 * g * g, now, .3);
    this.rustleGain.gain.setTargetAtTime(.0015 + .012 * g * g * g, now, .2);
    if (this.fountains) for (const f of this.fountains) f.g.gain.setTargetAtTime(f.level * direct(Math.hypot(ear[0] - f.p.x, ear[1] - .5, ear[2] - f.p.z)) ** 1.15, now, .1);
  }

  /* ---------- you ---------- */
  set(part, on) { this.music?.set(part, on); }
  step(surface, side, strength = 1) {
    if (!this.bank || !this.running) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.bank.step[surface + (Math.random() * 4 | 0)] || this.bank.step.grass0;
    src.playbackRate.value = .9 + Math.random() * .2;
    const g = this.gain(.2 * strength * (surface === 'grass' ? .7 : 1)), p = this.ctx.createStereoPanner(); p.pan.value = side * .18;
    src.connect(g); g.connect(p); p.connect(this.master);
    src.start();
  }
  click(sp, on) {
    if (!this.bank || !this.running) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.bank.ui[on ? 'on' : 'off'];
    const g = this.gain(.8), pan = this.panner(sp.x, sp.y, sp.z);
    src.connect(g); g.connect(pan); pan.connect(this.master); src.start();
  }
  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, .08);
  }
  suspend(yes) { if (!this.ctx) return; if (yes) this.ctx.suspend(); else this.ctx.resume(); }
}
