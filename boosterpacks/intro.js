// A new player's first look at the game: fifteen seconds in the style of an anime opening. A heartbeat in the dark,
// then three cards slam in one after another, one from each set (a holo from around the house, a full art from the
// backyard, a holo from outer space). A pack falls out of the sky and shakes with menace until it rips open in a
// blast of light, and a jackpot rises out of it and flips. Then the title, and the player's own first pack, free.
// It plays to a little score made on the spot, so it waits for a first tap (a page can't make a sound before one).
// Everything it shows is drawn before it starts. Skip leaves at any point.
import * as THREE from 'three';
import { CARD_W, CARD_H } from './card.js';
import { HI } from './faces.js';
import { itemOf, valueOf, money, VARIANT_NAME } from './store.js';

const BEAT = .4;                   // 150 beats a minute: everything below is timed in beats
const SKIP = Symbol('skip');
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const RAINBOW = ['#ff8ad8', '#ffe38a', '#8affc8', '#8ad8ff', '#c79bff', '#ffffff'];
// The three cards that slam in, one from each set, and the one that comes out of the pack.
const SHOWCASE = [
  { card: { set: 'house', id: 'duck', v: 1 }, tag: 'Around the house', word: 'HOLO!', jp: 'キラッ', color: '#ff8ad8', tints: ['#ff5fbf', '#ffc93f'], colors: RAINBOW },
  { card: { set: 'backyard', id: 'goodboy', v: 2 }, tag: 'In the backyard', word: 'FULL ART!', jp: 'ドン', color: '#bfe3ff', tints: ['#3f9dff', '#8fe36a'], colors: ['#ffffff', '#dff1ff', '#b8d8ff', '#ffe9a6'] },
  { card: { set: 'space', id: 'blackhole', v: 1 }, tag: 'In outer space', word: 'HOLO!', jp: 'ゴゴゴ', color: '#b39bff', tints: ['#7a4dff', '#2a2aa8'], colors: ['#c79bff', '#8ad8ff', '#ff8ad8', '#ffffff'] },
];
const JACKPOT = { card: { set: 'house', id: 'piano', v: 3 }, tag: 'Around the house', tints: ['#ff6fc8', '#5fc8ff'] };
// The score: chords for the brass stabs and the bass under them.
const HZ = { B1: 61.74, C2: 65.41, D2: 73.42, E2: 82.41, B2: 123.47, C3: 130.81, D3: 146.83, Ds3: 155.56, E3: 164.81, Fs3: 185, G3: 196, Gs3: 207.65, A3: 220, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, Gs4: 415.3, B4: 493.88, E5: 659.26 };
const CHORD = { Em: [HZ.E3, HZ.G3, HZ.B3, HZ.E4], C: [HZ.C3, HZ.E3, HZ.G3, HZ.C4], D: [HZ.D3, HZ.Fs3, HZ.A3, HZ.D4], B: [HZ.B2, HZ.Ds3, HZ.Fs3, HZ.B3], E: [HZ.E3, HZ.Gs3, HZ.B3, HZ.E4, HZ.Gs4, HZ.B4] };
const ROOT = { Em: HZ.E2, C: HZ.C2, D: HZ.D2, B: HZ.B1, E: HZ.E2 };

/* ---------- speed lines: the focus lines of a manga panel, and streaks for things racing past ---------- */
function speedLines() {
  const u = { uTime: { value: 0 }, uOpacity: { value: 0 }, uInner: { value: .6 }, uMode: { value: 0 }, uAspect: { value: 1 }, uFlick: { value: 12 },
    uCenter: { value: new THREE.Vector2() }, uColor: { value: new THREE.Color('#ffffff') } };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: u, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, .998, 1.); }',
    fragmentShader: `
      uniform float uTime, uOpacity, uInner, uMode, uAspect, uFlick; uniform vec2 uCenter; uniform vec3 uColor; varying vec2 vUv;
      float h1(float x) { return fract(sin(x * 91.345 + 11.3) * 47453.5453); }
      void main() {
        vec2 p = (vUv - .5) * vec2(uAspect, 1.) * 2. - uCenter;
        float frame = floor(uTime * uFlick);   // redrawn a dozen times a second, like hand-drawn frames
        // focus lines: thin wedges pointing in at the middle, starting at different distances from it
        float ang = atan(p.y, p.x) * .159155 + .5, n = 200.;
        float cell = floor(ang * n), f = fract(ang * n);
        float r1 = h1(cell + frame * 17.), r2 = h1(cell * 1.7 + frame * 5.3 + 3.);
        float d = length(p), start = uInner * (.75 + .9 * r2);
        float w = (.1 + .55 * r1) * clamp((d - start) / 1.2, 0., 1.);
        float focus = step(.42, r1) * smoothstep(w, w * .45, abs(f - .5) * 2.);
        // streaks: long lines racing sideways
        float ry = (p.y + 2.) * 60., row = floor(ry);
        float s1 = h1(row * 3.1 + floor(frame * .5) * 7.), s2 = h1(row + 9.);
        float seg = fract(p.x * (.12 + .2 * s2) - uTime * (2.5 + 3. * s2) + s1);
        float streak = step(.62, s1) * smoothstep(.5, .15, abs(fract(ry) - .5)) * smoothstep(0., .08, seg) * smoothstep(.7, .35, seg);
        gl_FragColor = vec4(uColor, mix(focus, streak, uMode) * uOpacity);
      }` }));
  mesh.frustumCulled = false; mesh.renderOrder = -9;   // over the backdrop, under everything else
  return { mesh, u };
}
// An impact frame: the whole picture turned negative for a moment.
function negative() {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneMinusDstColorFactor, blendDst: THREE.ZeroFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: 'void main() { gl_FragColor = vec4(1.); }' }));
  mesh.frustumCulled = false; mesh.renderOrder = 1000; mesh.visible = false;
  return mesh;
}

export class Intro {
  constructor(ctx) {
    Object.assign(this, ctx);
    const $ = id => document.getElementById(id);
    this.el = $('intro'); this.$stage = $('iStage'); this.$white = $('iWhite'); this.$start = $('iStart'); this.$press = $('iPress');
    this.$title = $('iTitle'); this.$cta = $('iCta'); this.$skip = $('iSkip');
    this.lines = speedLines(); this.neg = negative();
    this.want = { opacity: 0, inner: .6, mode: 0, cx: 0, cy: 0, color: new THREE.Color('#ffffff'), rainbow: false, flick: 12 };
    this.kick = { lines: 0, zoom: 0 };
    this.camWant = { zoom: 0, roll: 0 };
    this.waits = []; this.fx = []; this.flying = []; this.spin = [];
    this.skipping = false; this.gone = false; this.p0 = 0; this.pausedMs = 0; this.hiddenAt = 0;
  }

  // Draw what it shows before it starts: the five cards' faces (one at a time, so the page keeps breathing between
  // them) and the display font. Safe to call more than once.
  prepare() {
    return this.ready ??= (async () => {
      this.show = SHOWCASE.filter(s => itemOf(s.card));
      this.jack = itemOf(JACKPOT.card) ? JACKPOT : null;
      this.entries = [];
      for (const c of [...this.show.map(s => s.card), ...(this.jack ? [this.jack.card] : [])]) {
        await new Promise(r => setTimeout(r, 16));
        if (this.gone) return;
        this.entries.push(this.faces.get(c, HI, true));
      }
      await Promise.race([document.fonts.load('400 80px "Dela Gothic One"', 'ODDS&ENHLFUTRIJCKP!?ゴドンビリッキラオッズ＆エンズ'), new Promise(r => setTimeout(r, 3000))]).catch(() => {});
    })();
  }

  // Plays it. o.tapped: it was started by a tap already, so there's no "tap to start". Resolves with what the player
  // chose at the end: 'tour' (open the free pack with the walkthrough), 'play' (without it) or 'skip'.
  async play(o = {}) {
    this.mount();
    const choice = await new Promise(res => {
      this.choose = v => { if (!this.chosen) { this.chosen = v; res(v); } };
      this.run(o).catch(e => { if (e !== SKIP) { console.error(e); this.choose('skip'); } });
    });
    this.skipping = true;
    await this.leave(choice);
    return choice;
  }

  mount() {
    this.root = new THREE.Group(); this.stage.add(this.root);
    this.scene.add(this.lines.mesh, this.neg);
    this.tints0 = [this.backdrop.uniforms.uTint.value.clone(), this.backdrop.uniforms.uTint2.value.clone()];
    this.el.hidden = false; this.el.classList.remove('out', 'bars');
    this.$stage.textContent = ''; this.$title.hidden = true; this.$cta.hidden = true; this.$skip.hidden = false;
    this.$skip.onclick = () => { this.sound.click(); this.choose('skip'); };
    document.body.classList.add('intro-on');
    this.onVis = () => {   // a hidden tab pauses it (and its music) rather than letting the two drift apart
      if (document.hidden) { if (!this.hiddenAt) { this.hiddenAt = performance.now(); this.sound.ctx?.suspend(); } }
      else if (this.hiddenAt) { this.pausedMs += performance.now() - this.hiddenAt; this.hiddenAt = 0; if (this.sound.enabled) this.sound.ctx?.resume(); }
    };
    document.addEventListener('visibilitychange', this.onVis);
    this.setHandler({ key: e => { if (e.key === 'Escape') { this.choose('skip'); return true; } } });
    this.tickers.add(dt => this.tick(dt));
  }

  async run(o) {
    const ready = this.prepare();   // (it draws while the splash waits for a tap)
    if (!o.tapped) await this.splash();
    this.$start.classList.add('gone');
    if (this.splashCard) {   // the card turning in the dark flies into the camera
      const h = this.splashCard.holder; this.spin.length = 0;
      this.moveTo(h, { p: [0, h.position.y, 30], r: [0, h.rotation.y + 2, .4] }, .3, this.ease.in).then(() => { h.visible = false; });
      this.sound.whoosh(1);
    }
    let waited = false;
    const late = setTimeout(() => { waited = true; this.$start.classList.remove('gone'); this.$press.textContent = 'Loading…'; }, 250);
    await ready;
    clearTimeout(late);
    if (waited) this.$start.classList.add('gone');
    if (this.chosen) throw SKIP;
    this.makeCards();
    this.begin();
    await this.coldOpen();
    for (let k = 0; k < this.show.length; k++) await this.cutIn(k, 8 + k * 4);
    await this.packScene();
    await this.finale();
    await this.title();
  }

  /* ---------- the clock: the pictures follow the music's beat ---------- */
  now() { return (performance.now() - this.p0 - this.pausedMs - (this.hiddenAt ? performance.now() - this.hiddenAt : 0)) / 1000; }
  at(beat) {
    if (this.skipping || this.chosen) return Promise.reject(SKIP);
    return new Promise((res, rej) => this.waits.push({ t: beat * BEAT, res, rej }));
  }
  begin() {
    const lead = .12;   // the first beat falls a moment from now, once the music is queued
    this.p0 = performance.now() + lead * 1000;
    if (this.sound.ensure()) { this.bus = this.sound.bus(); this.sound.into(this.bus, () => this.score(lead)); }
  }

  /* ---------- per frame ---------- */
  tick(dt) {
    if (this.gone) return false;
    const t = this.now();
    for (const w of this.waits.slice()) {
      if (this.skipping || this.chosen) { this.waits.splice(this.waits.indexOf(w), 1); w.rej(SKIP); }
      else if (t >= w.t) { this.waits.splice(this.waits.indexOf(w), 1); w.res(); }
    }
    const u = this.lines.u, W = this.want;
    u.uTime.value += dt; u.uAspect.value = this.view.aspect; u.uFlick.value = this.REDUCED ? 0 : W.flick;
    u.uOpacity.value = damp(u.uOpacity.value, Math.min(1, W.opacity + this.kick.lines), 12, dt);
    u.uInner.value = damp(u.uInner.value, W.inner, 8, dt);
    u.uMode.value = damp(u.uMode.value, W.mode, 16, dt);
    u.uCenter.value.set(damp(u.uCenter.value.x, W.cx, 10, dt), damp(u.uCenter.value.y, W.cy, 10, dt));
    if (W.rainbow) W.color.setHSL((u.uTime.value * .35) % 1, .85, .72);
    u.uColor.value.lerp(W.color, 1 - Math.exp(-10 * dt));
    this.kick.lines = damp(this.kick.lines, 0, 4, dt); this.kick.zoom = damp(this.kick.zoom, 0, 7, dt);
    this.cam.zoom = damp(this.cam.zoom, this.camWant.zoom + this.kick.zoom, 5, dt);
    this.cam.roll = damp(this.cam.roll, this.REDUCED ? 0 : this.camWant.roll, 4, dt);
    this.neg.visible = performance.now() < (this.negUntil ?? 0);
    this.pack?.update(dt);
    for (const f of this.flying) {
      if (f.gone) continue;
      f.v.y -= 22 * dt; f.card.holder.position.addScaledVector(f.v, dt);
      f.card.holder.rotation.x += f.spin.x * dt; f.card.holder.rotation.y += f.spin.y * dt; f.card.holder.rotation.z += f.spin.z * dt;
      if ((f.life -= dt) <= 0) { f.gone = true; this.disposeCard(f.card); }
    }
    for (const s of this.spin) s(dt, u.uTime.value);
  }

  /* ---------- the pieces ---------- */
  layout() {   // where a card that's on show goes: beside its name on a wide screen, above it on a tall one
    const v = this.view, H = this.VIEW_H, wide = v.aspect > 1.1;
    const s = wide ? Math.min(H * .62 / CARD_H, v.W * .36 / CARD_W) : Math.min(H * .46 / CARD_H, v.W * .64 / CARD_W);
    return { wide, s, cx: wide ? -v.W * .17 : 0, cy: wide ? 0 : H * .1, inner: Math.hypot(CARD_W, CARD_H) / 2 * s / (H / 2) * .85 };
  }
  makeCards() {
    for (const [i, s] of this.show.entries()) { s.c3 = this.makeCard(s.card, this.entries[i]); s.c3.holder.visible = false; this.root.add(s.c3.holder); }
    if (this.jack) { this.jack.c3 = this.makeCard(this.jack.card, this.entries[this.show.length]); this.jack.c3.holder.visible = false; this.root.add(this.jack.c3.holder); }
    this.entries = null;   // the cards hold them now
    const set = this.set;
    this.pack = new this.Pack(set, set.wrappers[0], this.wrapperPrints(set, 0));
    this.pack.holder = new THREE.Group(); this.pack.holder.add(this.pack.group); this.pack.holder.visible = false; this.root.add(this.pack.holder);
  }
  // A world point on the z = 0 plane, as speed-line coordinates (half screen heights from the middle).
  focus(x, y) { this.want.cx = x / (this.VIEW_H / 2); this.want.cy = y / (this.VIEW_H / 2); }
  linesTo(o) { Object.assign(this.want, o, { color: o.color ? new THREE.Color(o.color) : this.want.color }); }
  tint(a, b) { this.backdrop.uniforms.uTint.value.set(a); this.backdrop.uniforms.uTint2.value.set(b); }
  white(a, fade = .35) {
    const el = this.$white;
    el.style.transition = 'none'; el.style.opacity = this.REDUCED ? a * .35 : a;
    void el.offsetWidth; el.style.transition = `opacity ${fade}s ease-out`; el.style.opacity = 0;
  }
  // A hit on the beat: a flash, a jolt, the lines leap. invert: an impact frame (only a few in the whole thing).
  impact({ flash = .5, shake = .5, invert = false } = {}) {
    this.white(flash);
    if (this.REDUCED) return;
    if (invert) this.negUntil = performance.now() + 75;
    this.shake(shake);
    this.kick.lines = .35; this.kick.zoom = shake * 1.6;
    this.$stage.classList.remove('shake'); void this.$stage.offsetWidth; this.$stage.classList.add('shake');
  }
  word(text, o = {}) {
    const el = document.createElement('div');
    el.className = 'i-word' + (o.cls ? ' ' + o.cls : '');
    el.style.left = (o.x ?? 50) + '%'; el.style.top = (o.y ?? 50) + '%';
    el.style.setProperty('--r', (o.r ?? -8) + 'deg'); el.style.setProperty('--s', o.size ?? 'clamp(56px, 16vw, 150px)');
    const span = document.createElement('span');
    span.className = 'ol' + (o.fill ? ' ' + o.fill : ''); span.dataset.t = text; span.textContent = text;
    if (o.c) span.style.setProperty('--c', o.c);
    if (o.sh) span.style.setProperty('--sh', o.sh);
    el.append(span); this.$stage.append(el);
    // keep it on the screen: smaller if it's wider than the screen, then nudged in from the edges
    let b = el.getBoundingClientRect();
    const room = innerWidth - 16;
    if (b.width > room) { el.style.setProperty('--s', parseFloat(getComputedStyle(el).fontSize) * room / b.width + 'px'); b = el.getBoundingClientRect(); }
    const shift = b.left < 8 ? 8 - b.left : b.right > innerWidth - 8 ? innerWidth - 8 - b.right : 0;
    if (shift) el.style.left = (o.x ?? 50) / 100 * innerWidth + shift + 'px';
    if (o.life) setTimeout(() => this.unword(el), o.life * 1000);
    return el;
  }
  unword(el) { if (!el?.isConnected) return; el.classList.add('out'); setTimeout(() => el.remove(), 260); }
  caption(html) {
    this.$cap?.classList.add('out');
    const old = this.$cap; setTimeout(() => old?.remove(), 220);
    this.$cap = null;
    if (!html) return;
    const el = this.$cap = document.createElement('p');
    el.className = 'i-cap'; el.innerHTML = `<span>${html}</span>`;
    this.$stage.append(el);
    this.live(el.textContent);
  }
  // A card's name plate: its set on a colored tag, its name, and its finish (and a price counting up, for the jackpot).
  plate(item, v, tag, color, where) {
    const el = document.createElement('div'), fin = (v & 3) === 3 ? 'both' : v & 1 ? 'holo' : v & 2 ? 'full' : '';
    el.className = 'i-plate' + (where.mid ? ' mid' : '');
    el.style.setProperty('--c', color);
    const part = (tagName, cls, text) => { const e = document.createElement(tagName); e.className = cls; e.textContent = text; el.append(e); return e; };
    if (tag) part('span', 'i-set', tag);
    const nm = part('b', 'ol nm', item.name.toUpperCase());
    nm.dataset.t = item.name.toUpperCase(); nm.style.setProperty('--sh', color);
    if (fin) part('span', 'fin ' + fin, `${VARIANT_NAME[v & 3].toUpperCase()} · ${[1, 5, 2, 50][v & 3]}×`);
    el.style.fontSize = where.size ?? 'clamp(28px, 7.4vw, 64px)';
    if (where.mid) { el.style.left = '50%'; el.style.transform = 'translateX(-50%) skewX(-9deg)'; }
    else el.style.left = where.x + 'px';
    if (where.bottom != null) el.style.bottom = where.bottom + 'px';
    else { el.style.top = where.y + 'px'; if (where.center) el.style.transform = 'translateY(-50%) skewX(-9deg)'; }
    this.$stage.append(el);
    const room = where.mid ? innerWidth - 32 : innerWidth - where.x - 20, w = nm.getBoundingClientRect().width;
    if (w > room) el.style.fontSize = parseFloat(getComputedStyle(el).fontSize) * room / w + 'px';
    return el;
  }
  unplate(el) { if (!el?.isConnected) return; el.classList.add('out'); setTimeout(() => el.remove(), 240); }
  add(mesh) { this.root.add(mesh); this.fx.push(mesh); return mesh; }
  drop(mesh) { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose(); this.fx.splice(this.fx.indexOf(mesh), 1); }
  ring(at, color, size = 30, delay = 0) {
    const m = this.add(this.makeRing(color)); m.position.copy(at); m.scale.setScalar(.01);
    this.sleep(delay).then(() => this.anim(.7, x => { m.scale.setScalar(4 + x * size); m.material.opacity = .85 * (1 - x); }, this.ease.out)).then(() => this.drop(m));
  }
  // light rays behind something, turning; fade() them out later
  rays(at, color, size, peak) {
    const m = this.add(this.makeRays(color)); m.position.copy(at); m.scale.setScalar(size);
    const r = { m, peak, on: 0, want: 1 };
    this.spin.push((dt, T) => { r.on = damp(r.on, r.want, 5, dt); m.material.opacity = r.on * r.peak; m.rotation.z += dt * .35; m.scale.setScalar(size * (1 + .04 * Math.sin(T * 3))); });
    return r;
  }
  // screen rectangle of a card (in its resting pose at x, y, scale s on the z = 0 plane)
  cardRect(x, y, s) {
    const a = this.toScreen(V(x - CARD_W / 2 * s, y + CARD_H / 2 * s, 0)), b = this.toScreen(V(x + CARD_W / 2 * s, y - CARD_H / 2 * s, 0));
    return { left: a.x, top: a.y, right: b.x, bottom: b.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  /* ---------- tap to start ---------- */
  splash() {
    this.tint('#1a0f33', '#0d1f3a');
    this.linesTo({ opacity: .14, inner: .9, mode: 0, color: '#ffffff', flick: 6 }); this.focus(0, 0);
    // a card back turning slowly in the dark
    const card = this.splashCard = this.makeCard(this.set ? { set: this.set.id, id: this.set.items[0].id, v: 0 } : null, this.faces.back);
    const L = this.layout(), h = card.holder;
    h.scale.setScalar(L.s * .82); h.position.set(0, this.view.aspect > 1.1 ? .8 : 1.6, 0);
    this.root.add(h);
    this.spin.push((dt, T) => { h.rotation.y += dt * 1.1; h.rotation.x = Math.sin(T * .8) * .08; h.position.y += Math.sin(T * 1.6) * .004; });
    this.$press.textContent = this.TOUCH ? 'Tap to start' : 'Click to start';
    this.$start.classList.remove('gone'); this.$start.hidden = false;
    return new Promise(res => {
      const go = () => { this.$start.onclick = null; this.setHandler({ key: e => { if (e.key === 'Escape') { this.choose('skip'); return true; } } }); this.sound.ensure(); res(); };
      this.$start.onclick = go;
      this.setHandler({ key: e => { if (e.key === 'Escape') { this.choose('skip'); return true; } if (e.key === 'Enter' || e.key === ' ') { go(); return true; } } });
    });
  }

  /* ---------- the score ---------- */
  score(t0) {
    const s = this.sound, at = b => t0 + b * BEAT;
    const groove = (b0, chords) => {   // drums and a bouncing bass, one chord a beat
      chords.forEach((ch, beat) => {
        for (let e = 0; e < 2; e++) {
          const b = b0 + beat + e / 2, i = beat * 2 + e;
          s.hat(at(b), e ? .6 : 1);
          if (i % 8 === 0 || i % 8 === 3 || i % 8 === 4) s.kick(at(b));
          if (i % 4 === 2) s.snare(at(b));
          s.bass(ROOT[ch] * (e ? 2 : 1), at(b), BEAT * .46);
        }
      });
    };
    const stab = (ch, b, dur = .5, g = .07) => s.brass(CHORD[ch], { at: at(b), dur, gain: g });
    // a heartbeat in the dark, then a drum roll up to the first card
    for (const b of [0, 2, 4, 6]) s.heartbeat(at(b), b === 6 ? 1.15 : .85);
    s.drumroll(2 * BEAT, at(6)); s.swell(2 * BEAT, 1.2, at(6));
    // three cards, three chords: the band comes in
    [['Em', 8], ['C', 12], ['D', 16]].forEach(([ch, b]) => {
      s.boom(.8, at(b)); s.crash(.6, at(b)); s.shing(at(b) + .02);
      stab(ch, b, .55); stab(ch, b + 1.5, .18, .05); stab(ch, b + 2.5, .3, .055);
      groove(b, [ch, ch, ch, ch]);
      s.whoosh(.7, at(b + 3.4));
    });
    // the pack lands: half time, a low rumble, then a roll up to the rip
    s.boom(1, at(20)); s.kick(at(20)); s.kick(at(22));
    s.bass(ROOT.B, at(20), 4 * BEAT, 1.2); s.rumble(3.8 * BEAT, 1.2, at(20));
    s.brass(CHORD.B, { at: at(20), dur: 1.3, gain: .045 });
    s.drumroll(2 * BEAT, at(22)); s.swell(2 * BEAT, 1.4, at(22));
    // the rip; two beats of the band; then everything drops out as the jackpot rises
    s.crash(1, at(24)); s.boom(1.1, at(24)); stab('Em', 24, .6, .08);
    groove(24, ['Em', 'Em']);
    s.swell(2 * BEAT, .9, at(26));
    [0, 3, 7, 10, 12, 15].forEach((n, i) => s.bell(HZ.E5 * Math.pow(2, n / 12) / 2, { at: at(26 + i * .3), gain: .035, dur: .9 }));
    // the flip: C, D, and home to a bright E major for the title
    s.crash(1.2, at(28)); s.boom(1.2, at(28)); stab('C', 28, .8, .08); stab('D', 30, .8, .08);
    groove(28, ['C', 'C', 'D', 'D']);
    for (let i = 0; i < 16; i++) s.bell(1318 * Math.pow(2, [0, 4, 7, 12][i % 4] / 12), { at: at(28) + .05 + i * .07, gain: .03, dur: .8 });
    s.crash(1.3, at(32)); s.boom(1.3, at(32)); s.kick(at(32));
    s.brass(CHORD.E, { at: at(32), dur: 3, gain: .075 });
    s.bass(ROOT.E, at(32), 3, 1.1);
    CHORD.E.forEach((f, i) => s.tone(f * 2, { at: at(32.5) + i * .09, dur: 2.4, gain: .025, type: 'triangle', attack: .05 }));
  }

  /* ---------- the scenes ---------- */
  async coldOpen() {
    this.el.classList.add('bars');
    this.tint('#000000', '#000000');
    this.linesTo({ opacity: .05, inner: .75, mode: 0, color: '#ffffff', flick: 12 }); this.focus(0, 0);
    const lines = [[0, 'Nine cards.'], [2, 'One rare.'], [4, 'Could be a paper clip…'], [6, '…could be a <em>LEGEND.</em>']];
    for (const [b, text] of lines) {
      await this.at(b);
      this.kick.lines = b === 6 ? .5 : .32; this.kick.zoom = b === 6 ? 2.2 : 1.3;
      this.caption(text);
      if (b === 6) { this.linesTo({ opacity: .35, inner: .5 }); this.camWant.roll = .05; }
    }
    await this.at(7.7);
    this.caption(null);
  }

  async cutIn(k, b0) {
    const s = this.show[k], h = s.c3.holder, L = this.layout(), dir = k % 2 ? 1 : -1, item = itemOf(s.card);
    await this.at(b0 - .55);
    h.visible = true; h.scale.setScalar(L.s);
    h.position.set(L.cx - dir * 5, L.cy + 3, -90); h.rotation.set(.5, dir * Math.PI * 4, dir * .7);
    this.moveTo(h, { p: [L.cx, L.cy, 0], r: [0, 0, -dir * .05] }, .55 * BEAT, this.ease.out);
    this.linesTo({ mode: 1, opacity: .55, color: '#ffffff' });
    this.camWant.roll = 0;
    await this.at(b0);
    // bang
    this.impact({ flash: .55, shake: .5, invert: k === 0 });
    this.tint(...s.tints); this.flashBackdrop(.9, s.color);
    const at = V(L.cx, L.cy, 0);
    this.ring(V(L.cx, L.cy, -1.5), s.color, 34);
    this.particles.burst(at, 90, { colors: s.colors, speed: 15, size: .55, life: 1.2, gravity: -3, spread: 3 });
    this.linesTo({ mode: 0, opacity: .85, inner: L.inner, color: s.color, rainbow: false }); this.focus(L.cx, L.cy);
    this.camWant.roll = dir * .035;
    // the name, and the finish shouted
    const r = this.cardRect(L.cx, L.cy, L.s);
    const where = L.wide ? { x: r.right + innerWidth * .035, y: innerHeight / 2, center: true } : { mid: true, y: r.bottom + 14 };
    const plate = this.plate(item, s.card.v, s.tag, s.color, where);
    const wordAt = L.wide ? { x: (r.left / innerWidth) * 100 + 4, y: (r.top / innerHeight) * 100 + 8 } : { x: 24, y: (r.top / innerHeight) * 100 + 6 };
    this.word(s.word, { ...wordAt, r: -12, size: 'clamp(40px, 12vw, 110px)', fill: s.card.v & 1 ? 'rainbow' : '', sh: s.card.v & 1 ? '#7a2bd6' : '#2a6bd6', life: 2.6 * BEAT });
    this.word(s.jp, { x: L.wide ? (r.right / innerWidth) * 100 - 2 : 82, y: (r.bottom / innerHeight) * 100 - (L.wide ? 10 : 18), r: 10, size: 'clamp(24px, 7vw, 56px)', c: s.color, sh: '#170d26', cls: 'jit', life: 2.2 * BEAT });
    // it turns slowly so the foil catches the light, and drifts closer
    this.anim(3.3 * BEAT, (x, t) => { h.rotation.y = Math.sin(t * Math.PI * 1.6) * .34; h.rotation.x = -Math.sin(t * Math.PI) * .08; h.position.z = x * 1.5; }, this.ease.linear);
    await this.at(b0 + 3.4);
    // and it's gone
    this.unplate(plate);
    this.linesTo({ mode: 1, opacity: .6, color: '#ffffff' });
    this.moveTo(h, { p: [L.cx - dir * (this.view.W * .7 + CARD_W * L.s), L.cy - 1.5, 3], r: [.2, -dir * 1.4, -dir * .5] }, .55 * BEAT, this.ease.in).then(() => { h.visible = false; });
  }

  packLayout() {
    const v = this.view, H = this.VIEW_H;
    return { s: Math.min(H * .64 / this.PH, v.W * .7 / this.PW), y: v.aspect > 1.1 ? -.3 : .4 };
  }
  async packScene() {
    const P = this.pack, ph = P.holder, L = this.packLayout(), H = this.VIEW_H;
    await this.at(19.5);
    ph.visible = true; ph.scale.setScalar(L.s); ph.position.set(0, H * 1.15, 2); ph.rotation.set(.4, .3, .25);
    this.moveTo(ph, { p: [0, L.y, 0], r: [0, 0, 0] }, .5 * BEAT, this.ease.in);
    this.linesTo({ mode: 1, opacity: .5, color: '#ffffff' });
    await this.at(20);
    // it lands like a meteor
    const w = this.set.wrappers[0].colors;
    this.impact({ flash: .45, shake: .8 });
    this.tint(w[1], w[2]); this.flashBackdrop(.7, '#ffd76a');
    const foot = V(0, L.y - this.PH / 2 * L.s, 1);
    this.particles.burst(foot, 70, { colors: ['#cdbfe6', '#ffffff', '#9d8cc0'], speed: 13, size: 1.1, life: .9, kind: 1, gravity: -1, flat: true, spread: this.PW * L.s });
    this.ring(V(0, L.y, -2), '#ffd76a', 40);
    this.linesTo({ mode: 0, opacity: .75, inner: this.PH / 2 * L.s / (H / 2) * .95, color: '#ffd76a' }); this.focus(0, L.y);
    this.word('ドン!!', { x: 22, y: 76, r: -14, size: 'clamp(44px, 13vw, 120px)', c: '#ffd76a', sh: '#e8455a', life: 2.2 * BEAT });
    // it shakes with menace, harder and harder, as light gathers behind it
    const glow = this.add(this.makeGlow('#ffd76a', 40)); glow.position.set(0, L.y, -2.5);
    const rays = this.rays(V(0, L.y, -3), '#fff2c0', 46, .5); rays.want = 0;
    const g = P.group;
    this.anim(4 * BEAT, (x, t) => {
      const a = this.REDUCED ? 0 : t * t * .28;
      g.position.set(rand(-a, a), rand(-a, a) * .6, 0); g.rotation.z = rand(-a, a) * .08;
      glow.material.opacity = t * .75; rays.want = t;
      this.camWant.zoom = t * 5; this.camWant.roll = -t * .07;
    }, this.ease.linear).then(() => g.position.set(0, 0, 0));
    const side = [[16, 30], [84, 38], [12, 58], [86, 64], [20, 44], [80, 22], [50, 14]];
    for (let i = 0; i < side.length; i++) {
      await this.at(20.6 + i * .45);
      this.word('ゴ', { x: side[i][0], y: side[i][1], r: rand(-16, 16), size: `clamp(${30 + i * 4}px, ${8 + i * 1.2}vw, ${70 + i * 10}px)`, c: '#c9a8ff', sh: '#170d26', cls: 'rise', life: 1.7 });
      if (i === 3) this.linesTo({ inner: this.want.inner * .8, opacity: .9 });
    }
    await this.at(24);
    // RIIIP
    P.startTear(1);
    this.anim(.16, x => P.tearToward(-this.PW / 2 + x * (this.PW + 1.6)), this.ease.in);
    this.impact({ flash: .9, shake: 1.2, invert: true });
    this.sound.rip();
    this.camWant.zoom = 0; this.camWant.roll = .03;
    const mouth = P.group.localToWorld(V(0, this.TEAR_Y - .3, .4));
    this.word('RIIIP!!', { x: 50, y: this.view.aspect > 1.1 ? 20 : 17, r: -9, size: 'clamp(58px, 18vw, 170px)', c: '#ffffff', sh: '#e8455a', life: 2.6 * BEAT });
    this.word('ビリッ', { x: 78, y: 34, r: 12, size: 'clamp(26px, 8vw, 64px)', c: '#ffd76a', sh: '#170d26', life: 2 * BEAT });
    // light blasts out of it
    const blast = this.add(this.makeGlow('#fff6d0', 34)); blast.position.copy(mouth);
    const beam = this.add(this.makeGlow('#fff2c0', 1)); beam.scale.set(6 * L.s, 40, 1); beam.position.set(mouth.x, mouth.y + 14, mouth.z - .5);
    this.anim(1.4, x => { blast.material.opacity = 1 - x * .7; beam.material.opacity = .9 * (1 - x); }, this.ease.out);
    rays.peak = .8; rays.m.position.copy(mouth).setZ(-3);
    this.particles.burst(mouth, 150, { colors: ['#fff6d0', '#ffd76a', '#ffffff', '#ffb347'], speed: 18, size: .55, life: 1.3, gravity: -7, up: .9, spread: 2 });
    this.linesTo({ opacity: 1, inner: .35, color: '#ffffff' }); this.focus(mouth.x, mouth.y);
    // and the cards come flying out
    for (let i = 0; i < 8; i++) {
      const card = this.makeCard(this.jack?.card ?? this.show[0].card, this.faces.back), h = card.holder, side2 = i / 7 * 2 - 1;
      h.position.copy(mouth); h.scale.setScalar(L.s * .85); h.rotation.set(rand(-.3, .3), rand(0, 6), rand(-.5, .5));
      this.root.add(h);
      this.flying.push({ card, v: V(side2 * rand(9, 14), rand(12, 20), rand(3, 8)), spin: V(rand(-4, 4), rand(-9, 9), -side2 * rand(3, 7)), life: 1.5 });
      this.sound.swish(.5, i * .04);
    }
    await this.at(26);
    // …and then something rises out of it, slowly, glowing
    this.jackRise = { glow, rays };
  }

  async finale() {
    const J = this.jack, P = this.pack, L = this.packLayout(), H = this.VIEW_H, v = this.view;
    const { glow, rays } = this.jackRise;
    this.linesTo({ opacity: .22, inner: .9, color: '#ffffff' });
    this.camWant.roll = 0;
    this.moveTo(P.holder, { p: [0, -H * 1.2, -4], r: [.4, .3, -.3] }, 1.4 * BEAT, this.ease.in);
    this.anim(.8, x => { glow.material.opacity = .75 * (1 - x); }, this.ease.out);
    rays.want = 0;
    if (!J) { await this.at(28); return; }
    const h = J.c3.holder, s = Math.min(H * .43 / CARD_H, v.W * .6 / CARD_W), y = 1.5;
    const mouth = P.group.localToWorld(V(0, this.TEAR_Y - 2, .2));
    h.visible = true; h.position.copy(mouth); h.scale.setScalar(L.s * .8); h.rotation.set(0, Math.PI, 0);
    // a holo aura: a glow and a rim of light that cycle through the rainbow
    const halo = this.add(this.makeGlow('#ff8ad8', 1)), rim = this.add(this.makeRim('#ffffff'));
    halo.renderOrder = rim.renderOrder = -1;
    const aura = (dt, T) => {
      h.updateWorldMatrix(true, false);
      const p = V(0, 0, -.6).applyMatrix4(h.matrixWorld), c = new THREE.Color().setHSL((T * .3) % 1, .9, .7);
      halo.position.copy(p); halo.scale.setScalar(h.scale.x * 26); halo.material.color.copy(c); halo.material.opacity = Math.min(.95, halo.material.opacity + dt * 1.2);
      rim.position.copy(p); rim.scale.set(h.scale.x * 6.3 * 256 / 160 * 1.06, h.scale.x * 8.8 * 340 / 244 * 1.06, 1); rim.material.color.copy(c);
      rim.material.opacity = this.rimOn ?? 1;
      if (!this.flipped && !this.REDUCED) J.c3.mesh.position.set(rand(-1, 1) * .06, rand(-1, 1) * .06, 0);
    };
    this.spin.push(aura);
    this.moveTo(h, { p: [0, y, 3], s }, 1.7 * BEAT, this.ease.out);
    this.word('!?', { x: v.aspect > 1.1 ? 66 : 76, y: 24, r: 12, size: 'clamp(50px, 15vw, 130px)', c: '#ffffff', sh: '#e8455a', life: 1.8 * BEAT });
    this.caption(null);
    await this.at(28);
    // it flips
    this.flipped = true; J.c3.mesh.position.set(0, 0, 0); this.rimOn = 0;
    const turn = Math.PI * 3;
    let shown = false;
    this.anim(.62, (x, t) => {
      h.rotation.y = Math.PI - x * turn; h.position.z = 3 + Math.sin(t * Math.PI) * 3; h.scale.setScalar(s * (1 + Math.sin(t * Math.PI) * .18));
      if (!shown && x > 1 - (Math.PI / 2) / turn) { shown = true; J.c3.flash = .8; this.anim(.5, k => { J.c3.flash = .8 * (1 - k); }, this.ease.out); }
    }, this.ease.inOut).then(() => { h.rotation.y = 0; });
    this.impact({ flash: .7, shake: .6 });
    const at = V(0, y, 1);
    this.tint(...J.tints); this.flashBackdrop(1, '#ffd9f4');
    this.rays(V(0, y, -2), '#ffffff', 44, .6).m.material.color.set('#ffe9fb');
    for (let i = 0; i < 3; i++) this.ring(V(0, y, -1.5), RAINBOW[i * 2], 38 + i * 6, i * .2);
    this.particles.burst(at, 240, { colors: RAINBOW, speed: 20, size: .55, life: 1.6, gravity: -5, spread: 2 });
    this.particles.burst(at, 120, { colors: RAINBOW, speed: 11, size: .38, life: 2, kind: 2, gravity: -7, spread: 3 });
    this.particles.rain(v.W * 1.1, H * .6, 3.5, { colors: RAINBOW, rate: 110, speed: 5, size: .42 });
    this.particles.rain(v.W, H * .6, 2.5, { kind: 3, colors: ['#ffd76a'], rate: 20, speed: 7, size: .55 });
    for (let i = 0; i < 5; i++) setTimeout(() => {
      if (this.chosen) return;
      this.particles.burst(V(rand(-.4, .4) * v.W, rand(.1, .45) * H, 2), 70, { colors: [RAINBOW[i % 5], '#ffffff'], speed: 13, size: .45, life: 1.5, gravity: -5, spread: .5 });
      this.sound.firework();
    }, 250 + i * 330);
    this.linesTo({ opacity: .9, inner: CARD_H / 2 * s / (H / 2) * 1.05, rainbow: true, flick: 14 }); this.focus(0, y);
    // JACKPOT, and what it's worth
    const item = itemOf(J.card), r = this.cardRect(0, y, s), val = valueOf(J.card);
    const fs = Math.min(132, Math.max(46, innerWidth * .14, innerHeight * .1)) * Math.min(1, (innerWidth - 16) / (innerWidth * .14 * 7.2)), wy = Math.max(innerHeight * .07 + fs * .55, r.top - fs * .45);   // just above the card
    this.word('JACKPOT!!', { x: 50, y: wy / innerHeight * 100, r: -7, size: fs + 'px', fill: 'rainbow', sh: '#7a2bd6', life: 3.6 * BEAT });
    const plate = this.plate(item, J.card.v, null, '#ffd76a', { mid: true, y: r.bottom + 8, size: 'clamp(24px, min(6vw, 6vh), 50px)' });
    const price = document.createElement('b'); price.className = 'ol val'; plate.append(price);
    const t0 = performance.now();
    const count = () => {
      if (!price.isConnected) return;
      const k = Math.min(1, (performance.now() - t0) / 1400), e = 1 - Math.pow(1 - k, 3), text = money(Math.round(val * e));
      price.textContent = text; price.dataset.t = text;
      if (k < 1) requestAnimationFrame(count);
    };
    count();
    this.anim(3.4 * BEAT, (x, t) => { if (t > .2) h.rotation.y = Math.sin((t - .2) * Math.PI * 1.5) * .3; }, this.ease.linear);
    this.camWant.zoom = 2.5;
    await this.at(31.75);
    this.unplate(plate);
  }

  // The title, the four cards fanned out under it, and the way in.
  async title() {
    await this.at(32);
    this.impact({ flash: 1, shake: .8, invert: true });
    for (const el of this.$stage.querySelectorAll('.i-word')) this.unword(el);
    this.caption(null);
    this.el.classList.remove('bars');
    this.camWant.zoom = 0; this.camWant.roll = 0;
    this.tint('#6a3fd6', '#1c9fd6'); this.flashBackdrop(1, '#ffd76a');
    this.$title.hidden = false;
    this.$cta.style.visibility = 'hidden'; this.$cta.hidden = false;
    const go = document.getElementById('iGo'), none = document.getElementById('iNoTour');
    const F = this.fanLayout(), hand = [this.show[0], this.jack, this.show[1], this.show[2]].filter(Boolean);
    hand.forEach((s, i) => {
      const k = i - (hand.length - 1) / 2, h = s.c3.holder;
      if (!h.visible) { h.visible = true; h.position.set(k * 6, -this.VIEW_H, 2); h.rotation.set(0, 0, 0); }
      this.moveTo(h, { p: [k * CARD_W * .5 * F.s, F.y - Math.abs(k) * .5 * F.s, -Math.abs(k) * .3], r: [0, 0, -k * .13], s: F.s }, .55, this.ease.back);
      s.fan = { k, T0: i };
    });
    this.spin.push((dt, T) => { for (const s of hand) if (!s.leaving) { s.c3.mesh.rotation.y = Math.sin(T * .9 + s.fan.T0) * .12; s.c3.mesh.rotation.x = Math.sin(T * .7 + s.fan.T0 * 2) * .04; } });
    this.linesTo({ opacity: .3, inner: 1.2, rainbow: false, color: '#ffd76a', flick: 5 }); this.focus(0, F.y);
    this.particles.rain(this.view.W * 1.1, this.VIEW_H * .6, 6, { colors: ['#ffd76a', '#fff3c4', '#ffffff'], rate: 14, speed: 2.5, size: .35, kind: 0 });
    this.fanHand = hand;
    await this.at(34);
    this.$cta.style.visibility = ''; this.$cta.hidden = false; this.$cta.style.animation = 'none'; void this.$cta.offsetWidth; this.$cta.style.animation = '';
    this.$skip.hidden = true;
    go.focus({ preventScroll: true });
    go.onclick = () => { this.sound.click(); this.choose('tour'); };
    none.onclick = () => { this.sound.click(); this.choose('play'); };
    this.setHandler({ key: e => { if (e.key === 'Escape') { this.choose('play'); return true; } } });
  }
  fanLayout() {
    const top = this.$title.getBoundingClientRect().bottom + 14, cta = this.$cta.getBoundingClientRect(), bottom = (cta.height ? cta.top : innerHeight * .78) - 14;
    const band = Math.max(80, bottom - top) / innerHeight * this.VIEW_H, y = (innerHeight / 2 - (top + bottom) / 2) / innerHeight * this.VIEW_H;
    return { s: Math.min(band / (CARD_H * 1.12), this.view.W * .92 / (CARD_W * 2.6)), y };
  }

  /* ---------- the way out ---------- */
  async leave(choice) {
    document.removeEventListener('visibilitychange', this.onVis);
    if (this.hiddenAt) this.onVis();
    this.setHandler(null);
    if (this.bus) {
      const b = this.bus, c = this.sound.ctx;
      b.gain.setTargetAtTime(0, c.currentTime, choice === 'skip' ? .06 : .5);
      setTimeout(() => b.disconnect(), 3000);
    }
    this.$skip.hidden = true;
    this.linesTo({ opacity: 0 });
    for (const s of this.fanHand ?? []) { s.leaving = true; this.moveTo(s.c3.holder, { p: [s.c3.holder.position.x, -this.VIEW_H * 1.2, -2], r: [.4, 0, -s.fan.k * .3] }, .45, this.ease.in); }
    this.el.classList.add('out');
    await this.sleep(choice === 'skip' ? .3 : .45);
    this.dispose();
  }
  dispose() {
    if (this.gone) return;
    this.gone = true;
    for (const w of this.waits.splice(0)) w.rej(SKIP);
    for (const s of [...(this.show ?? []), this.jack]) if (s?.c3) { this.disposeCard(s.c3); s.c3 = null; }
    this.entries?.forEach(e => this.faces.release(e)); this.entries = null;   // (drawn, but never handed to a card)
    for (const f of this.flying) if (!f.gone) this.disposeCard(f.card);
    if (this.splashCard) this.disposeCard(this.splashCard);
    this.pack?.dispose(); this.pack = null;
    for (const m of this.fx.slice()) this.drop(m);
    this.root?.removeFromParent();
    this.scene.remove(this.lines.mesh, this.neg);
    this.lines.mesh.geometry.dispose(); this.lines.mesh.material.dispose(); this.neg.geometry.dispose(); this.neg.material.dispose();
    this.cam.zoom = 0; this.cam.roll = 0;
    if (this.tints0) { this.backdrop.uniforms.uTint.value.copy(this.tints0[0]); this.backdrop.uniforms.uTint2.value.copy(this.tints0[1]); }
    this.el.hidden = true; this.el.classList.remove('out', 'bars');
    this.$stage.textContent = ''; this.$title.hidden = true; this.$cta.hidden = true; this.$white.style.opacity = 0;
    document.body.classList.remove('intro-on');
  }
}
