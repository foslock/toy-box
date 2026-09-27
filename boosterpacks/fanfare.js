// The big moments: pulling a mythic rare or a legend. A mythic gets fire: speed lines closing in while a drum roll
// builds and the card shivers, then a burst of flame-coloured light, MYTHIC! across the screen and a brass flourish. A
// legend stops the show the way the intro does: letterbox bars, the lights down and the top bar gone, a heartbeat in the
// dark, the card shaking with menace as the speed lines close in, an impact frame as it turns over, LEGENDARY!!, and its
// name slammed in on a plate with its price counting up, to a score of its own. It borrows the intro's overlay, speed
// lines, shouted words and name plates.
import * as THREE from 'three';
import { speedLines, negative, shout, hush, namePlate, dropPlate } from './intro.js';
import { itemOf, valueOf, money } from './store.js';
import { SET_BY_ID } from './sets/index.js';

const $ = id => document.getElementById(id);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const FIRE = ['#fff3b0', '#ffb347', '#ff7a2e', '#ff4d1f', '#ffd76a'];
const RAINBOW = ['#ff8ad8', '#ffe38a', '#8affc8', '#8ad8ff', '#c79bff', '#ffffff'];
const HZ = { B1: 61.74, C2: 65.41, D2: 73.42, E2: 82.41, C3: 130.81, D3: 146.83, E3: 164.81, Fs3: 185, G3: 196, Gs3: 207.65, A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, Gs4: 415.3, B4: 493.88 };
const CHORD = { C: [HZ.C3, HZ.E3, HZ.G3, HZ.C4], D: [HZ.D3, HZ.Fs3, HZ.A3, HZ.D4], E: [HZ.E3, HZ.Gs3, HZ.B3, HZ.E4, HZ.Gs4, HZ.B4] };
const ROOT = { C: HZ.C2, D: HZ.D2, E: HZ.E2 };

export class Fanfare {
  // ctx: scene, cam, shake(v), tickers, sound, particles, backdrop, flashBackdrop, makeRays, makeRing, anim, sleep, ease,
  // view, VIEW_H, toScreen, REDUCED, live
  constructor(ctx) {
    Object.assign(this, ctx);
    this.lines = speedLines(); this.neg = negative();
    this.want = { opacity: 0, inner: .6, cx: 0, cy: 0, color: new THREE.Color('#ffffff'), rainbow: false };
    this.camWant = { zoom: 0, roll: 0 }; this.kick = 0; this.on = false; this.fx = [];
  }

  /* ---------- the show ---------- */
  // Before the card turns over (it's face down in front of you). Resolves when it's time to flip it.
  async windUp(card, rarity) {
    const legend = rarity === 'L', s = this.sound;
    this.start(card, legend);
    if (legend) {
      // a heartbeat in the dark, then another, then a drum roll; menace rises around the card as it shakes
      this.want.opacity = .1; this.want.inner = .7; this.want.color.set('#ffffff');
      s.heartbeat(0, .9); s.heartbeat(.8, 1.15); s.drumroll(1.2, 1.6); s.swell(1.2, 1.4, 1.6); s.rumble(2.6, 1, 0);
      this.sleep(0).then(() => { this.kick = .4; });
      this.sleep(.8).then(() => { if (this.on) this.kick = .55; });
      const spots = [[16, 34], [84, 40], [12, 62], [88, 66], [22, 48], [78, 24], [50, 12]];
      spots.forEach(([x, y], i) => this.sleep(.45 + i * .3).then(() => {
        if (this.on) shout(this.stage, 'ゴ', { x, y, r: rand(-16, 16), size: `clamp(${30 + i * 4}px, ${8 + i * 1.2}vw, ${70 + i * 10}px)`, c: '#c9a8ff', sh: '#170d26', cls: 'rise', life: 1.7 });
      }));
      await this.anim(2.8, (x, t) => {
        const a = this.REDUCED ? 0 : t * t * .16;
        card.mesh.position.set(rand(-a, a), rand(-a, a), 0); card.mesh.rotation.z = rand(-a, a) * .3;
        this.want.opacity = .1 + t * .75; this.want.inner = .7 - t * .3;
        this.camWant.zoom = t * 4; this.camWant.roll = -t * .06;
      }, this.ease.linear);
    } else {
      // a drum roll with a rumble under it, the card shivering, fire gathering at the edges of the screen
      this.want.opacity = 0; this.want.inner = .75; this.want.color.set('#ff9a3d');
      s.drumroll(1.15, 0); s.swell(1.15, 1.2, 0); s.rumble(1.2, .7, 0);
      shout(this.stage, '!?', { x: 76, y: 22, r: 12, size: 'clamp(40px, 11vw, 96px)', c: '#ffffff', sh: '#ff5a1f', life: 1.1 });
      await this.anim(1.2, (x, t) => {
        const a = this.REDUCED ? 0 : t * .09;
        card.mesh.position.set(rand(-a, a), rand(-a, a), 0);
        this.want.opacity = t * .6; this.want.inner = .75 - t * .15; this.camWant.zoom = t * 2;
      }, this.ease.linear);
    }
    card.mesh.position.set(0, 0, 0); card.mesh.rotation.z = 0;
  }
  // The instant its face comes round (at: where it is, in the world).
  hit(card, rarity, at) {
    const legend = rarity === 'L', s = this.sound, P = this.particles;
    this.white(legend ? .9 : .55);
    if (!this.REDUCED) { if (legend) this.negUntil = performance.now() + 85; this.shake(legend ? 1.1 : .55); }
    this.kick = .55; this.camWant.zoom = legend ? 2.6 : 1.2; this.camWant.roll = legend ? .035 : 0;
    this.want.opacity = legend ? .95 : .8; this.want.inner = .45; this.want.rainbow = legend;
    this.focusOn(at);
    this.flashBackdrop(legend ? 1.2 : .9, legend ? '#ffe9fb' : '#ffb347');
    s.crash(legend ? 1.2 : .9); s.boom(legend ? 1.3 : .9);
    if (legend) this.score(); else this.flourish();
    // light and sparks on top of the usual celebration
    const colors = legend ? RAINBOW : FIRE;
    P.burst(at, legend ? 200 : 130, { colors, speed: legend ? 21 : 16, size: .55, life: 1.5, gravity: -4, spread: 2 });
    P.burst(at, legend ? 110 : 70, { colors, speed: 10, size: .38, life: 2, kind: 2, gravity: -7, spread: 3 });
    for (let i = 0; i < (legend ? 3 : 2); i++) this.ring(at, colors[i * 2 % colors.length], 34 + i * 7, i * .18);
    if (!legend) this.rays(at, '#ff9a3d', 34, .55);
    else {
      P.rain(this.view.W * 1.1, this.VIEW_H * .6, 3.5, { colors: RAINBOW, rate: 120, speed: 5, size: .42 });
      for (let i = 0; i < 5; i++) this.sleep(.25 + i * .33).then(() => {
        if (!this.on) return;
        P.burst(new THREE.Vector3(rand(-.4, .4) * this.view.W, rand(.1, .45) * this.VIEW_H, 2), 70, { colors: [RAINBOW[i % 5], '#ffffff'], speed: 13, size: .45, life: 1.5, gravity: -5, spread: .5 });
      });
    }
    // and the word
    const fs = Math.min(legend ? 140 : 120, Math.max(48, innerWidth * (legend ? .15 : .13)));
    shout(this.stage, legend ? 'LEGENDARY!!' : 'MYTHIC!', { x: 50, y: legend ? 17 : 16, r: -8, size: fs + 'px', fill: legend ? 'rainbow' : 'fire', sh: legend ? '#7a2bd6' : '#8a1d06', life: legend ? 3.4 : 1.9 });
    if (legend) shout(this.stage, 'ドン!!', { x: 20, y: 74, r: -14, size: 'clamp(36px, 10vw, 96px)', c: '#ffd76a', sh: '#e8455a', life: 2.2 });
    this.live(`${legend ? 'A legend' : 'A mythic rare'}! ${itemOf(card.data).name}, worth ${money(valueOf(card.data))}.`);
  }
  // After it has turned over. Resolves when the show is over and everything is back as it was.
  async finish(card, rarity) {
    const legend = rarity === 'L';
    if (legend) {
      // its name on a plate, and what it's worth counting up
      const c = card.data, item = itemOf(c), set = SET_BY_ID[c.set], val = valueOf(c);
      const plate = namePlate(this.stage, item, c.v, set.name, '#ffd76a', { mid: true, bottom: Math.round(innerHeight * .07) + 18, rarity: 'Legend', size: 'clamp(24px, min(6vw, 6vh), 52px)' });
      const price = document.createElement('b'); price.className = 'ol val'; plate.append(price);
      const t0 = performance.now();
      const count = () => {
        if (!price.isConnected) return;
        const k = Math.min(1, (performance.now() - t0) / 1600), e = 1 - Math.pow(1 - k, 3), text = money(Math.round(val * e));
        price.textContent = text; price.dataset.t = text;
        if (k < 1) requestAnimationFrame(count);
      };
      count();
      await this.sleep(2.8);
      dropPlate(plate);
    } else await this.sleep(1.1);
    await this.end();
  }
  // In a booster box the card is already face up: straight to the hit, from front and centre.
  async present(card, rarity, at) {
    this.start(card, rarity === 'L');
    this.hit(card, rarity, at);
    await this.sleep(rarity === 'L' ? .6 : .3);
    await this.finish(card, rarity);
  }

  /* ---------- the machinery ---------- */
  start(card, legend) {
    this.end(true);
    this.on = true; this.legend = legend;
    this.scene.add(this.lines.mesh, this.neg);
    this.lines.u.uOpacity.value = 0; this.want.rainbow = false; this.kick = 0; this.camWant.zoom = this.camWant.roll = 0;
    card.holder.updateWorldMatrix(true, false);
    this.focusOn(new THREE.Vector3().applyMatrix4(card.holder.matrixWorld));
    // the intro's overlay, just for its words (and, for a legend, its letterbox bars and the lights down)
    const el = this.el = $('intro');
    this.stage = $('iStage'); this.stage.textContent = '';
    $('iStart').classList.add('gone'); $('iTitle').hidden = true; $('iCta').hidden = true; $('iSkip').hidden = true;
    el.hidden = false; el.classList.remove('out', 'bars'); el.classList.add('fanfare');
    if (legend) {
      void el.offsetWidth; el.classList.add('bars');
      document.body.classList.add('intro-on');
      const u = this.backdrop.uniforms;
      this.tints = [u.uTint.value.clone(), u.uTint2.value.clone()];
      u.uTint.value.set('#000000'); u.uTint2.value.set('#000000');
    }
    this.tickers.add(dt => this.tick(dt));
  }
  // Everything back as it was (now: at once, for starting another show over this one).
  async end(now = false) {
    if (!this.on) return;
    this.want.opacity = 0; this.want.rainbow = false; this.camWant.zoom = this.camWant.roll = 0;
    for (const w of this.stage?.querySelectorAll('.i-word') ?? []) hush(w);
    this.el?.classList.remove('bars');
    document.body.classList.remove('intro-on');
    if (this.tints) { this.backdrop.uniforms.uTint.value.copy(this.tints[0]); this.backdrop.uniforms.uTint2.value.copy(this.tints[1]); this.tints = null; }
    if (!now) { this.el?.classList.add('out'); await this.sleep(.5); }
    this.on = false;
    this.scene.remove(this.lines.mesh, this.neg);
    this.cam.zoom = 0; this.cam.roll = 0; this.neg.visible = false;
    for (const m of this.fx.splice(0)) { m.removeFromParent(); m.geometry.dispose(); m.material.dispose(); }
    this.spin = [];
    if (this.el) { this.el.hidden = true; this.el.classList.remove('out', 'fanfare', 'bars'); this.stage.textContent = ''; }
  }
  tick(dt) {
    if (!this.on) return false;
    const u = this.lines.u, W = this.want;
    u.uTime.value += dt; u.uAspect.value = this.view.aspect; u.uFlick.value = this.REDUCED ? 0 : 12; u.uMode.value = 0;
    u.uOpacity.value = damp(u.uOpacity.value, Math.min(1, W.opacity + this.kick), 12, dt);
    u.uInner.value = damp(u.uInner.value, W.inner, 8, dt);
    u.uCenter.value.set(damp(u.uCenter.value.x, W.cx, 10, dt), damp(u.uCenter.value.y, W.cy, 10, dt));
    if (W.rainbow) W.color.setHSL((u.uTime.value * .35) % 1, .85, .72);
    u.uColor.value.lerp(W.color, 1 - Math.exp(-10 * dt));
    this.kick = damp(this.kick, 0, 4, dt);
    this.cam.zoom = damp(this.cam.zoom, this.camWant.zoom, 5, dt);
    this.cam.roll = damp(this.cam.roll, this.REDUCED ? 0 : this.camWant.roll, 4, dt);
    this.neg.visible = performance.now() < (this.negUntil ?? 0);
    for (const r of this.spin ?? []) r(dt);
  }
  // speed lines centred on a point in the world (their coordinates are half screen heights from the middle)
  focusOn(at) {
    const p = this.toScreen(at);
    this.want.cx = (p.x / innerWidth * 2 - 1) * this.view.aspect; this.want.cy = -(p.y / innerHeight * 2 - 1);
  }
  white(a) {
    const el = $('iWhite');
    el.style.transition = 'none'; el.style.opacity = this.REDUCED ? a * .35 : a;
    void el.offsetWidth; el.style.transition = 'opacity .45s ease-out'; el.style.opacity = 0;
  }
  ring(at, color, size, delay) {
    const m = this.makeRing(color); m.position.set(at.x, at.y, at.z - 1.5); m.scale.setScalar(.01); this.scene.add(m); this.fx.push(m);
    this.sleep(delay).then(() => this.anim(.7, x => { m.scale.setScalar(4 + x * size); m.material.opacity = .85 * (1 - x); }, this.ease.out));
  }
  rays(at, color, size, peak) {
    const m = this.makeRays(color); m.position.set(at.x, at.y, at.z - 2); m.scale.setScalar(size); this.scene.add(m); this.fx.push(m);
    let on = 0;
    (this.spin ??= []).push(dt => { on = damp(on, this.want.opacity > .05 ? 1 : 0, 5, dt); m.material.opacity = on * peak; m.rotation.z += dt * .4; });
  }

  /* ---------- music ---------- */
  // A mythic: three quick brass stabs and a held chord over the crash.
  flourish() {
    const s = this.sound;
    [0, .13, .26].forEach(t => s.brass([HZ.G3, HZ.C4], { at: t, dur: .11, gain: .055 }));
    s.brass([...CHORD.C, HZ.E4], { at: .4, dur: 1.3, gain: .065 });
    s.sparkle(3);
    [0, 4, 7, 12, 16].forEach((n, i) => s.bell(1046.5 * Math.pow(2, n / 12), { at: .45 + i * .06, gain: .035, dur: 1 }));
  }
  // A legend: the band comes in on the hit, C then D, and lands home on a big E major, the way the intro's title does.
  score() {
    const s = this.sound;
    if (!s.ensure()) return;
    const B = .4, bus = s.bus();
    s.into(bus, () => {
      const groove = (b0, chords) => chords.forEach((ch, beat) => {
        for (let e = 0; e < 2; e++) {
          const b = b0 + beat + e / 2, i = beat * 2 + e;
          s.hat(b * B, e ? .6 : 1);
          if (i % 8 === 0 || i % 8 === 3 || i % 8 === 4) s.kick(b * B);
          if (i % 4 === 2) s.snare(b * B);
          s.bass(ROOT[ch] * (e ? 2 : 1), b * B, B * .46);
        }
      });
      s.brass(CHORD.C, { at: 0, dur: .75, gain: .08 }); s.brass(CHORD.D, { at: 2 * B, dur: .75, gain: .08 });
      groove(0, ['C', 'C', 'D', 'D']);
      for (let i = 0; i < 16; i++) s.bell(1318 * Math.pow(2, [0, 4, 7, 12][i % 4] / 12), { at: .05 + i * .07, gain: .03, dur: .8 });
      s.crash(1.2, 4 * B); s.boom(1.2, 4 * B); s.kick(4 * B);
      s.brass(CHORD.E, { at: 4 * B, dur: 2.8, gain: .08 }); s.bass(ROOT.E, 4 * B, 2.8, 1.1);
      CHORD.E.forEach((f, i) => s.tone(f * 2, { at: 4 * B + .5 + i * .09, dur: 2.2, gain: .025, type: 'triangle', attack: .05 }));
      s.applause(3.5, .8);
    });
    setTimeout(() => bus?.disconnect(), 9000);
  }
}
