// Booster Packs: tear open packs of trading cards, flip through them, sell what you don't want and keep the rest in
// a binder. Cards are household things priced like the real thing; holos and full arts are worth more.
import * as THREE from 'three';
import { SETS, SET_BY_ID, READY } from './sets/index.js';
import * as store from './store.js';
import { S, money, RARITY, VARIANT_NAME, HOLO, FULL, MULT, itemOf, valueOf, cardKey } from './store.js';
import { Studio } from './studio.js';
import { FaceCache, HI, LO, artSize } from './faces.js';
import { Card, CARD_W, CARD_H, cardTime } from './card.js';
import { Pack, makeWrapper, foilEnvironment, PW, PH, TEAR_Y } from './pack.js';
import { makeBackdrop, Particles, makeGlow, makeRim, makeRays, makeRing } from './fx.js';
import { Sound } from './sound.js';
import { Binder } from './binder.js';
import { BoxOpening } from './box.js';
import { PhoneTilt } from './motion.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(pointer: coarse)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const ease = {
  linear: x => x,
  out: x => 1 - Math.pow(1 - x, 3),
  in: x => x * x * x,
  inOut: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  back: x => { const c = 1.5; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
};
const isSpecial = c => (c.v & 3) !== 0 || itemOf(c)?.rarity === 'R';
const specialKind = c => ((c.v & 3) === 3 ? 'both' : c.v & HOLO ? 'holo' : c.v & FULL ? 'full' : 'rare');
const AURA = { rare: '#ffcf5a', holo: '#ff8ae0', full: '#dff1ff', both: '#ffffff' };

if (Q.has('fresh') || DEMO) store.setNoSave(true); else store.load();   // ?fresh: a new game that isn't saved

/* ---------- renderer, camera, scene ---------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const VIEW_H = 20, FOV = 30;
const CAM_Z = VIEW_H / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const camera = new THREE.PerspectiveCamera(FOV, 1, .5, 400);
camera.position.set(0, 0, CAM_Z);
scene.environment = foilEnvironment(renderer);
const keyLight = new THREE.DirectionalLight(0xffffff, 1.3); keyLight.position.set(-6, 9, 14);
scene.add(keyLight, new THREE.AmbientLight(0xffffff, .3));
const backdrop = makeBackdrop(); scene.add(backdrop.mesh);
const particles = new Particles(); scene.add(particles.object);
const stage = new THREE.Group(); scene.add(stage);
const studio = new Studio();
const faces = new FaceCache(renderer, studio);
const sound = new Sound();
sound.enabled = S.settings.sound && !DEMO;
const view = { W: VIEW_H, H: VIEW_H, aspect: 1, px: 1, portrait: false };

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  view.aspect = w / h; view.W = VIEW_H * view.aspect; view.px = VIEW_H / h; view.portrait = w < h;
  particles.uniforms.uScale.value = h * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
  backdrop.uniforms.uAspect.value = view.aspect;
  layoutChanged?.();
}
let layoutChanged = null;
addEventListener('resize', resize);

/* ---------- little animation system: promises that resolve when a tween ends ---------- */
const anims = [];
let timeScale = 1;
function anim(dur, fn, e = ease.inOut) {
  return new Promise(res => {
    if (dur <= 0 || REDUCED && dur < .2) { fn(1, 1); res(); return; }
    anims.push({ t: 0, dur, fn, e, res });
  });
}
const sleep = s => anim(s, () => {}, ease.linear);
function tickAnims(dt) {
  for (let i = 0; i < anims.length; i++) {
    const a = anims[i];
    a.t += dt * timeScale;
    const k = Math.min(1, a.t / a.dur);
    a.fn(a.e(k), k);
    if (k >= 1) { anims.splice(i--, 1); a.res(); }
  }
}
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function moveTo(obj, to, dur, e = ease.inOut) {
  const p0 = obj.position.clone(), s0 = obj.scale.clone(), r0 = obj.rotation.clone();
  const p1 = to.p ? V(...to.p) : p0, s1 = to.s == null ? s0 : typeof to.s === 'number' ? V(to.s, to.s, to.s) : V(...to.s);
  const r1 = to.r ? new THREE.Euler(...to.r) : r0;
  const token = {}; obj.userData.move = token;
  return anim(dur, (x, k) => {
    if (obj.userData.move !== token) return;
    obj.position.lerpVectors(p0, p1, x);
    if (to.arc) obj.position.z += Math.sin(k * Math.PI) * to.arc;
    if (to.lift) obj.position.y += Math.sin(k * Math.PI) * to.lift;
    obj.scale.lerpVectors(s0, s1, x);
    obj.rotation.set(lerp(r0.x, r1.x, x), lerp(r0.y, r1.y, x), lerp(r0.z, r1.z, x));
  }, e);
}

/* ---------- pointer input ---------- */
const pointer = { ndc: new THREE.Vector2(), x: 0, y: 0, down: false, sx: 0, sy: 0, t0: 0, moved: 0, vx: 0, vy: 0, lt: 0, over: false };
let handler = null;
const raycaster = new THREE.Raycaster();
function setNdc(e) { pointer.x = e.clientX; pointer.y = e.clientY; pointer.ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); }
// Where the pointer ray crosses the plane z = const (world).
function worldAt(z = 0, ndc = pointer.ndc) {
  raycaster.setFromCamera(ndc, camera);
  const r = raycaster.ray, t = (z - r.origin.z) / r.direction.z;
  return r.origin.clone().addScaledVector(r.direction, t);
}
// Where the pointer ray crosses an object's own z = 0 plane, in its local space.
function localAt(obj, ndc = pointer.ndc) {
  raycaster.setFromCamera(ndc, camera);
  obj.updateWorldMatrix(true, false);
  const inv = obj.matrixWorld.clone().invert(), o = raycaster.ray.origin.clone().applyMatrix4(inv), d = raycaster.ray.direction.clone().transformDirection(inv);
  if (Math.abs(d.z) < 1e-5) return null;
  return o.addScaledVector(d, -o.z / d.z);
}
function toScreen(v) { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; }
canvas.addEventListener('pointerdown', e => {
  if (pointer.down) return;
  sound.ensure();
  setNdc(e); pointer.down = true; pointer.id = e.pointerId; pointer.sx = e.clientX; pointer.sy = e.clientY; pointer.t0 = performance.now(); pointer.moved = 0; pointer.vx = pointer.vy = 0; pointer.lt = pointer.t0;
  canvas.setPointerCapture?.(e.pointerId);
  handler?.down?.(e);
  updateCursor();
});
canvas.addEventListener('pointermove', e => {
  const now = performance.now(), px = pointer.x, py = pointer.y;
  setNdc(e);
  if (pointer.down && e.pointerId === pointer.id) {
    const dt = Math.max(1, now - pointer.lt) / 1000;
    pointer.vx = lerp(pointer.vx, (e.clientX - px) / dt, .5); pointer.vy = lerp(pointer.vy, (e.clientY - py) / dt, .5); pointer.lt = now;
    pointer.moved = Math.max(pointer.moved, Math.hypot(e.clientX - pointer.sx, e.clientY - pointer.sy));
    handler?.move?.(e);
  } else handler?.hover?.(e);
  pointer.over = true;
  updateCursor();
});
const endPointer = e => {
  if (!pointer.down || e.pointerId !== pointer.id) return;
  setNdc(e); pointer.down = false;
  const tap = pointer.moved < 8 && performance.now() - pointer.t0 < 450;
  handler?.up?.(e, tap);
  updateCursor();
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { pointer.over = false; });
function updateCursor() { const c = handler?.cursor?.() || ''; canvas.className = c; }
// Tilting the phone turns a zoomed card. An iPhone asks first, and only from a tap: the tap that opens the card.
const phoneTilt = new PhoneTilt(), TILT = TOUCH && phoneTilt.supported;
phoneTilt.onDenied = () => { S.settings.tilt = false; store.save(); $('tiltSwitch').setAttribute('aria-checked', false); };
addEventListener('click', () => { if (phoneTilt.on) phoneTilt.ask(); }, true);
addEventListener('keydown', e => {
  if (e.target.closest?.('textarea, input, select')) return;
  if ($('menu').classList.contains('open')) { if (e.key === 'Escape') closeMenu(); return; }
  if (!$('confirm').hidden) return;
  if (handler?.key?.(e) === true) { e.preventDefault(); return; }
  if ((e.key === 'b' || e.key === 'B') && !$('binderBtn').disabled && mode === 'shop') { openBinder(); }
});

/* ---------- DOM helpers ---------- */
const live = t => { $('live').textContent = ''; setTimeout(() => { $('live').textContent = t; }, 30); };
let hintTimer = 0;
function hint(html, delay = 0) {
  clearTimeout(hintTimer);
  const el = $('hint');
  if (!html) { el.classList.add('off'); return; }
  hintTimer = setTimeout(() => { el.innerHTML = html; el.classList.remove('off'); }, delay);
}
let toastTimer = 0;
function toast(msg, ms = 2600) { const t = $('toast'); t.innerHTML = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms); live(t.textContent); }
function setActions(list = []) {
  const box = $('actions'); box.textContent = '';
  for (const a of list) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn ' + (a.cls || 'ghost glass'); if (a.id) b.id = a.id;
    b.innerHTML = a.label + (a.sub ? ` <small>${a.sub}</small>` : '');
    b.disabled = !!a.disabled;
    b.addEventListener('click', () => { sound.ensure(); sound.click(); a.onClick?.(); });
    box.append(b);
  }
}
function floaty(text, x, y, neg = false) {
  const f = document.createElement('div'); f.className = 'floaty' + (neg ? ' neg' : ''); f.textContent = text;
  f.style.left = x + 'px'; f.style.top = y + 'px'; document.body.append(f); setTimeout(() => f.remove(), 1400);
}
function confirmBox(title, text, yes = 'OK') {
  return new Promise(res => {
    $('confirmTitle').textContent = title; $('confirmText').textContent = text; $('confirmYes').textContent = yes;
    $('confirm').hidden = false; $('confirmYes').focus();
    const done = v => { $('confirm').hidden = true; $('confirmYes').onclick = $('confirmNo').onclick = null; res(v); };
    $('confirmYes').onclick = () => done(true); $('confirmNo').onclick = () => done(false);
  });
}
// The wallet counts up and down to the real balance.
let shownMoney = S.money, walletFlash = 0;
function tickWallet(dt) {
  if (shownMoney === S.money) return;
  const diff = S.money - shownMoney;
  shownMoney = Math.abs(diff) < 1 ? S.money : shownMoney + diff * Math.min(1, dt * 7) + Math.sign(diff) * Math.min(Math.abs(diff), 1);
  $('money').textContent = money(Math.round(shownMoney));
  const w = $('wallet');
  w.classList.toggle('down', diff < 0);
  if (diff > 0 && performance.now() - walletFlash > 500) { walletFlash = performance.now(); w.classList.remove('up'); void w.offsetWidth; w.classList.add('up'); }
  if (shownMoney === S.money) setTimeout(() => w.classList.remove('up', 'down'), 500);
}
function walletWorld(z = 4) {
  const r = $('wallet').getBoundingClientRect();
  return worldAt(z, new THREE.Vector2((r.left + 18) / innerWidth * 2 - 1, -((r.top + r.height / 2) / innerHeight) * 2 + 1));
}
function binderWorld(z = 4) {
  const r = $('binderBtn').getBoundingClientRect();
  return worldAt(z, new THREE.Vector2((r.left + r.width / 2) / innerWidth * 2 - 1, -((r.top + r.height / 2) / innerHeight) * 2 + 1));
}
function updateCount(bump = false) {
  let n = 0; for (const k of S.cards) if (store.knownCard(store.parseKey(k))) n++;   // cards from a set that's gone don't show
  $('count').textContent = n.toLocaleString('en-US');
  if (bump) { const b = $('binderBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
}
// Coins fly from a point in the world to the wallet; money is added as they land.
function payout(from, cents, delay = 0) {
  const n = clamp(Math.round(2 + Math.log10(Math.max(1, cents)) * 2.2), 3, 16);
  setTimeout(() => {
    sound.cash();
    for (let i = 0; i < n; i++) particles.spawn({ p: from.clone().add(V((Math.random() - .5) * 1.5, (Math.random() - .5) * 1.5, 0)), kind: 3, size: .55 + Math.random() * .25, life: .7 + i * .045, home: () => walletWorld(), fade: false, color: '#ffd76a', onDone: () => i % 3 === 0 && sound.coin(i) });
    const r = $('wallet').getBoundingClientRect();
    setTimeout(() => floaty('+' + money(cents), r.left + r.width / 2, r.bottom + 4), 650);
  }, delay);
}

/* ---------- cards in the scene ---------- */
// A card sits in a holder (for our moves) inside whatever group it belongs to.
function makeCard(c, entry) {
  const card = new Card(faces);
  card.set(entry ?? faces.get(c, HI));
  card.data = c;
  card.holder = new THREE.Group(); card.holder.add(card.mesh);
  return card;
}
function disposeCard(card) { card.dispose(); card.holder.removeFromParent(); card.aura?.removeFromParent(); }

// Glow and a lit rim behind a face-down special card, bigger and busier the more the card is worth. It sits behind
// the whole stack (not on the card), so the card can lift and turn over without ever passing through it.
function addAura(card, kind, tier) {
  const g = new THREE.Group(), size = 17 + tier * 3.5, glow = makeGlow(AURA[kind], size), rim = makeRim(AURA[kind]);
  rim.scale.multiplyScalar(1.06);
  g.add(glow, rim);
  g.userData = { glow, rim, kind, tier, card, size, on: 0, rimOn: 0, flare: 0, spark: 0 };
  card.holder.parent.add(g); card.aura = g;
  if (tier >= 4) sound.rumble(1.8, tier >= 5 ? 1.3 : .7);
  return g;
}
function tickAura(a, dt, t) {
  const u = a.userData, h = u.card.holder;
  u.on = damp(u.on, u.target ?? 1, 5, dt); u.rimOn = damp(u.rimOn, u.rimTarget ?? 1, 10, dt); u.flare = damp(u.flare, u.flareTarget ?? 0, 6, dt);
  a.position.set(h.position.x, h.position.y, -.6);
  a.scale.setScalar(h.scale.x); a.rotation.z = h.rotation.z;
  const pulse = .72 + .28 * Math.sin(t * (4 + u.tier * 1.3));
  if (u.kind === 'holo' || u.kind === 'both') { const c = new THREE.Color().setHSL((t * (.25 + u.tier * .05)) % 1, .9, .7); u.glow.material.color.copy(c); u.rim.material.color.copy(c); }
  u.glow.material.opacity = Math.min(.95, u.on * pulse * (.5 + u.tier * .07) + u.flare * .45);
  u.rim.material.opacity = u.rimOn * u.on * (.6 + .4 * pulse);
  u.glow.scale.setScalar(u.size * (1 + .05 * Math.sin(t * 2.3) + u.flare * .9));
  if (u.target === 0) return;
  // sparks fly off the edge of a card worth $50 or more
  if (u.tier >= 3) {
    u.spark += dt * (u.tier - 2) * 9;
    h.updateWorldMatrix(true, false);
    while (u.spark >= 1) {
      u.spark--;
      const side = Math.random() * 4 | 0, f = Math.random() - .5;
      const lp = side < 2 ? V(f * CARD_W, (side ? .5 : -.5) * CARD_H, 0) : V((side === 2 ? .5 : -.5) * CARD_W, f * CARD_H, 0);
      const wp = lp.applyMatrix4(h.matrixWorld), out = lp.clone().normalize().multiplyScalar(1.5 + u.tier * .5);
      const colors = PALETTE[u.kind];
      particles.spawn({ p: wp, v: V(out.x, out.y + 1, 1), life: .7 + Math.random() * .5, size: .25 + u.tier * .05, color: colors[Math.random() * colors.length | 0], gravity: 0, drag: 1.5 });
    }
  }
  // …and one worth $250 or more trembles while it waits
  if (u.tier >= 4 && !u.card.flipping) { const j = (u.tier - 3) * .03; u.card.mesh.position.set((Math.random() - .5) * j, (Math.random() - .5) * j, 0); }
}

/* ---------- fanfare: the more a card is worth, the bigger the show ---------- */
const TIER_AT = [100, 1000, 5000, 25000, 100000];   // cents: $1, $10, $50, $250, $1,000
const tierOf = c => TIER_AT.reduce((t, e) => t + (valueOf(c) >= e ? 1 : 0), 0);
const finishOf = c => (c.v & 3) === 3 ? 'both' : c.v & HOLO ? 'holo' : c.v & FULL ? 'full' : itemOf(c)?.rarity === 'R' ? 'rare' : 'plain';
const PALETTE = {
  plain: ['#ffffff', '#fff3c4', '#ffe08a'],
  rare: ['#ffd76a', '#fff3c4', '#ffb347'],
  holo: ['#ff8ad8', '#ffe38a', '#8affc8', '#8ad8ff', '#c79bff'],
  full: ['#ffffff', '#dff1ff', '#b8d8ff', '#e8dcff'],
  both: ['#ff8ad8', '#ffe38a', '#8affc8', '#8ad8ff', '#c79bff', '#ffffff', '#ffd76a'],
};
const FINISH_NAME = { plain: '', rare: 'Rare', holo: 'Holo', full: 'Full Art', both: 'Holo Full Art' };
const HEADLINE = ['', '', 'Nice pull!', 'Great pull!', 'Huge pull!', 'JACKPOT!'];
let shake = 0;
const fxLive = new Set();
function fxAdd(mesh, step) { scene.add(mesh); const f = { mesh, t: 0, step }; fxLive.add(f); return f; }
function tickFx(dt) {
  for (const f of fxLive) {
    f.t += dt;
    if (f.step(f, dt) === false) { scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose(); fxLive.delete(f); }
  }
}
// Celebrate a card at a world position. o.mini: a smaller show (a booster box deals ten at once); o.quiet: no sound;
// o.linger: the rays and banner stay until release() is called. Returns { tier, release }.
function celebrate(c, at, o = {}) {
  const full = tierOf(c), tier = o.mini ? Math.min(2, full) : full, kind = finishOf(c), colors = PALETTE[kind];
  const k = o.mini ? .5 : 1;
  if (!o.quiet) sound.fanfare(kind === 'plain' ? 'rare' : kind, tier);
  particles.burst(at, Math.round([24, 40, 70, 110, 170, 260][tier] * k), { colors, speed: [7, 9, 11, 13, 16, 20][tier], size: .5 + tier * .03, life: 1.1 + tier * .12, gravity: -3, spread: 2 });
  if (kind === 'holo' || kind === 'both' || tier >= 3) particles.burst(at, Math.round([12, 20, 30, 55, 90, 160][tier] * k), { colors, speed: 8 + tier, size: .35, life: 1.8, kind: 2, gravity: -7, spread: 3 });
  flashBackdrop([.3, .35, .5, .7, 1, 1.4][tier] * (o.mini ? .6 : 1), colors[0]);
  let rays = null, banner = false, released = false;
  if (tier >= 2) {
    const m = makeRays(colors[0]), size = [0, 0, 13, 18, 26, 38][tier] * (o.mini ? .6 : 1), peak = [0, 0, .22, .3, .42, .6][tier];
    m.position.set(at.x, at.y, o.backZ ?? at.z - 1.5); m.scale.set(1, 1, 1);   // behind the card (and whatever it's resting on)
    rays = fxAdd(m, (f, dt) => {
      const inT = Math.min(1, f.t / .35), life = o.linger ? Infinity : 1.2 + tier * .3;
      f.out = released || f.t > life ? (f.out ?? 0) + dt / .6 : 0;
      m.material.opacity = peak * inT * Math.max(0, 1 - (f.out || 0));
      m.scale.setScalar(size * (.6 + .4 * inT) * (1 + .04 * Math.sin(f.t * 3)));
      m.rotation.z += dt * (.18 + tier * .04);
      if (kind === 'holo' || kind === 'both') m.material.color.setHSL((f.t * .15) % 1, .8, .75);
      return (f.out ?? 0) < 1;
    });
  }
  if (tier >= 3 && !o.mini) {
    for (let i = 0; i < (tier >= 5 ? 3 : 1); i++) {
      const m = makeRing(colors[i % colors.length]);
      m.position.set(at.x, at.y, o.backZ ?? at.z - 1.5);
      fxAdd(m, f => { const q = (f.t - i * .22) / .8; if (q < 0) return true; m.scale.setScalar(6 + q * (24 + tier * 4)); m.material.opacity = Math.max(0, .75 * (1 - q)); return q < 1; });
    }
  }
  if (!o.mini) {
    if (tier >= 4) shake = Math.max(shake, tier >= 5 ? .55 : .22);
    if (tier >= 4) particles.rain(view.W * 1.1, VIEW_H * .6, tier >= 5 ? 5 : 2, { colors, rate: tier >= 5 ? 120 : 55, speed: 5, size: .42 });
    if (tier >= 5) {
      particles.rain(view.W, VIEW_H * .6, 3.5, { kind: 3, colors: ['#ffd76a'], rate: 22, speed: 7, size: .55 });
      for (let i = 0; i < 8; i++) setTimeout(() => {
        const p = V((Math.random() - .5) * view.W * .8, (Math.random() * .6 - .1) * VIEW_H * .5, 2);
        particles.burst(p, 70, { colors: [colors[i % colors.length], '#ffffff'], speed: 13, size: .45, life: 1.5, gravity: -5, spread: .5 });
        sound.firework();
      }, 350 + i * 420);
    }
    if (tier >= 3) { showBanner(c, tier, kind); banner = true; }
  }
  const release = () => { released = true; if (banner) { banner = false; hideBanner(); } };
  if (!o.linger) setTimeout(release, 1600 + tier * 500);
  else if (banner) setTimeout(() => { if (banner) { banner = false; hideBanner(); } }, tier >= 5 ? 4800 : 3000);
  return { tier, release };
}
let bannerTimer = 0;
function showBanner(c, tier, kind) {
  const el = $('banner'), v = valueOf(c);
  clearInterval(bannerTimer);
  el.className = `banner t${tier} ${kind}`; el.hidden = false;
  $('bannerTitle').textContent = HEADLINE[tier];
  $('bannerSub').textContent = [FINISH_NAME[kind], itemOf(c).name].filter(Boolean).join(' · ');
  const t0 = performance.now(), dur = tier >= 5 ? 1800 : 900;
  const tick = () => { const k = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - k, 3); $('bannerValue').textContent = money(Math.round(v * e)); if (k >= 1) clearInterval(bannerTimer); };
  tick(); bannerTimer = setInterval(tick, 33);
  $('tally').style.visibility = 'hidden';
  live(`${HEADLINE[tier]} ${itemOf(c).name}, worth ${money(v)}.`);
}
function hideBanner() { $('banner').classList.add('out'); setTimeout(() => { if ($('banner').classList.contains('out')) $('banner').hidden = true; }, 400); $('tally').style.visibility = ''; }

/* ---------- pack wrappers ---------- */
const printCache = new Map();
function wrapperPrints(set, i) {
  const key = set.id + ':' + i;
  if (!printCache.has(key)) {
    const w = set.wrappers[i], item = set.itemById[w.hero];
    const hero = item && set.models[item.id] ? studio.art(set, item, 'hero', 640, 800) : null;
    printCache.set(key, makeWrapper(set, w, hero));
  }
  return printCache.get(key);
}

/* ---------- the shop ---------- */
let mode = 'boot', current = null, selectedSet = SETS[0];
const DONORS = ['Grandma mailed you a pack. She says eat something.', 'You found a pack under the couch cushions.', 'A neighbor left a pack on your doorstep.',
  'The shop owner slipped you a pack. “Don’t tell anyone.”', 'A pack fell out of a cereal box.', 'Your cousin had a spare pack.', 'A pack blew in through the window. Lucky!'];

function packSetToOpen() {
  if (S.packs[selectedSet.id] > 0) return selectedSet;
  return SETS.find(s => S.packs[s.id] > 0) || null;
}
function refreshShop() {
  if (mode !== 'shop') return;
  checkUnlock();
  const set = selectedSet, P = store.packPrice(set), B = store.boxPrice(set);
  const acts = [];
  if (store.needsDonation()) acts.push({ label: 'Ask for a free pack', cls: 'gold', onClick: donate });
  else acts.push({ label: 'Buy a pack', sub: money(P, { short: true }), cls: current ? 'ghost glass' : 'gold', disabled: S.money < P, onClick: buyPack });
  if (S.boxUnlocked[set.id]) acts.push({ label: 'Buy a booster box', sub: `10 packs · ${money(B, { short: true })}`, cls: 'gold', disabled: S.money < B, onClick: buyBox, id: 'boxBtn' });
  setActions(acts);
  const sets = $('sets');
  sets.hidden = SETS.length < 2;
  if (!sets.hidden) {
    sets.textContent = '';
    for (const s of SETS) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = s.name + (S.packs[s.id] ? ` · ${S.packs[s.id]}` : '');
      b.setAttribute('aria-pressed', s === selectedSet); b.onclick = () => { selectedSet = s; if (current && current.set !== s && S.packs[s.id]) { dropCurrent(); presentPack(); } refreshShop(); };
      sets.append(b);
    }
  }
  $('binderBtn').disabled = false;
  updatePackCount();
}
const busy = () => mode !== 'shop' && mode !== 'binder';
function updatePackCount() {
  const n = store.packsInHand();
  if (current && n > 1) hint(`<b>${n} packs</b> to open · swipe across the dotted line to tear this one`, 0);
}
function checkUnlock() {
  for (const set of SETS) if (store.checkBoxUnlock(set)) { toast(`🎉 <b>Booster boxes unlocked!</b> Ten ${set.name} packs at once.`, 4200); sound.sparkle(2); setTimeout(() => $('boxBtn')?.classList.add('new'), 60); }
}
function buyPack() {
  const set = selectedSet;
  if (!store.buyPack(set)) { sound.denied(); toast('Not enough money. Sell some cards from your binder.'); return; }
  sound.buy(); live(`Bought a pack for ${money(store.packPrice(set))}.`);
  if (current && current.set !== set && current.state === 'idle' && !current.dir) dropCurrent();
  if (!current) presentPack(); else { toast(`${store.packsInHand()} packs waiting`); bumpPack(); }
  refreshShop();
}
function donate() {
  const set = selectedSet;
  store.donate(set);
  toast(DONORS[S.stats.donated % DONORS.length], 3400);
  sound.sparkle(1);
  if (!current) presentPack();
  refreshShop();
}
function bumpPack() { if (current) anim(.35, (x, k) => { current.holder.scale.setScalar(current.baseScale * (1 + Math.sin(k * Math.PI) * .06)); }, ease.linear); }
function dropCurrent() {
  if (!current) return;
  const pack = current; current = null; handler = null;
  pack.entries?.forEach(e => faces.release(e)); pack.entries = null; pack.state = 'gone';
  moveTo(pack.holder, { p: [0, -VIEW_H * 1.2, -4], r: [.3, .2, .4] }, .45, ease.in).then(() => pack.dispose());
}

async function home() {
  mode = 'shop';
  layoutChanged = relayoutPack;
  $('tally').hidden = true;
  timeScale = 1;
  refreshShop();
  showGhost(!current && !packSetToOpen());
  if (!current && packSetToOpen()) await presentPack();
  else if (!current) { handler = null; hint(store.needsDonation() ? 'Out of money and packs? Ask for a free one.' : 'Buy a pack to open it.'); }
}
// A dashed outline where the pack goes, when there isn't one.
function showGhost(on) {
  const g = $('nopack');
  g.hidden = !on;
  if (!on) return;
  const B = band(), hPx = Math.min(B.h * .94, PH * 1.1) / VIEW_H * innerHeight;
  g.style.height = hPx + 'px'; g.style.top = (innerHeight / 2 - B.y / VIEW_H * innerHeight) + 'px';
}

/* ---------- presenting a pack ---------- */
// The free band of screen between the top bar and whatever is at the bottom, in world units at z = 0.
function band(extraBottom = 0, extraTop = 0) {
  const top = document.querySelector('.hud').getBoundingClientRect().bottom + 12 + extraTop;
  const b = $('bottom').getBoundingClientRect();
  const bottom = Math.min(innerHeight - 12, b.height > 4 ? b.top - 8 : innerHeight - 12) - extraBottom;
  const cy = (top + bottom) / 2;
  return { y: (innerHeight / 2 - cy) / innerHeight * VIEW_H, h: Math.max(4, (bottom - top) / innerHeight * VIEW_H) };
}
function packLayout() {
  const B = band();
  return { s: Math.min(1.1, .94 * B.h / PH, .78 * view.W / PW), y: B.y };
}
function relayoutPack() {
  const pack = current, L = packLayout();
  showGhost(!pack && mode === 'shop' && !packSetToOpen());
  if (pack && pack.state === 'idle') { pack.baseScale = L.s; pack.holder.scale.setScalar(L.s); pack.holder.position.y = L.y; }
}
async function presentPack() {
  const set = packSetToOpen();
  if (!set) return;
  showGhost(false);
  const wi = Math.floor(Math.random() * set.wrappers.length);
  const pack = current = new Pack(set, set.wrappers[wi], wrapperPrints(set, wi));
  pack.holder = new THREE.Group(); pack.holder.add(pack.group); stage.add(pack.holder);
  const L = packLayout();
  pack.baseScale = L.s; pack.holder.scale.setScalar(L.s); pack.holder.position.set(0, VIEW_H, 0);
  pack.state = 'arrive'; pack.tilt = V(); pack.hover = 0;
  backdrop.uniforms.uTint.value.set(set.wrappers[wi].colors[1]);
  pack.contents = store.rollPack(set);
  pack.torn = new Promise(res => { pack.onTorn = res; });
  sound.whoosh(.7);
  refreshShop();
  await moveTo(pack.holder, { p: [0, L.y, 0], r: [0, 0, 0] }, .7, ease.back);
  if (current !== pack) return;
  // start making its faces now, while it floats
  pack.entries = pack.contents.map(c => faces.get(c, HI));
  if (mode === 'shop') {
    pack.state = 'idle';
    handler = tearHandler(pack);
    hint(TOUCH ? 'Swipe across the dotted line to tear it open' : 'Drag across the dotted line to tear it open', 500);
    updatePackCount();
  }
  if (mode === 'shop') layoutChanged = relayoutPack;
  openFlow(pack);
}

function tearHandler(pack) {
  let start = null, what = null;
  const onPack = l => l && Math.abs(l.x) < PW / 2 + .8 && Math.abs(l.y) < PH / 2 + .8;
  const inTearZone = l => l.y > TEAR_Y - 1.7;
  return {
    cursor: () => { if (pointer.down) return what === 'tear' ? 'tear' : 'grabbing'; const l = localAt(pack.group); return onPack(l) ? (inTearZone(l) ? 'tear' : 'grab') : ''; },
    hover() { const l = localAt(pack.group); pack.hover = onPack(l) && inTearZone(l) ? 1 : 0; },
    down() {
      const l = localAt(pack.group);
      if (!onPack(l)) { start = null; return; }
      start = l; what = inTearZone(l) ? 'tear' : 'tilt';
      pack.grabTilt = pack.tilt.clone();
      sound.crinkle(.8);
    },
    move() {
      if (!start) return;
      const l = localAt(pack.group);
      if (!l) return;
      if (what === 'tear') {
        const dx = l.x - start.x;
        if (!pack.dir && Math.abs(dx) > .3) { pack.startTear(Math.sign(dx)); hint(''); }
        if (pack.dir) pack.tearToward(l.x + pack.dir * .25);
      } else {
        pack.dragTilt = V(clamp(-(pointer.y - pointer.sy) * .004, -.5, .5), clamp((pointer.x - pointer.sx) * .006, -.8, .8), 0);
        if (Math.random() < .08) sound.crinkle(.4);
      }
    },
    up(e, tap) {
      if (start && tap && what === 'tear' && !pack.dir) autoTear(pack);
      else if (start && tap) { pack.wiggle = 1; sound.crinkle(1); hint('Swipe across the <b>dotted line</b> near the top to tear it open'); }
      pack.dragTilt = null; start = null;
    },
    key(e) { if (e.key === ' ' || e.key === 'Enter') { if (!pack.dir) autoTear(pack); return true; } },
  };
}
function autoTear(pack) {
  if (pack.dir) return;
  pack.startTear(1); hint('');
  anim(.55, x => pack.tearToward(-PW / 2 + x * (PW + 1)), ease.inOut);
}

/* ---------- the opening ---------- */
async function openFlow(pack) {
  await pack.torn;
  if (current !== pack) return;
  const set = pack.set;
  sound.rip();
  particles.burst(pack.frontWorld(), 26, { colors: ['#fff6d0', '#ffd76a', '#ffffff'], speed: 9, size: .5, life: .8, gravity: -6 });
  flashBackdrop(.35);
  // the cards are yours now
  store.takePack(set.id);
  const results = store.collect(pack.contents);
  S.opened++; store.save();
  updateCount(); checkUnlock();
  mode = 'opening';
  handler = null; setActions([]); $('sets').hidden = true; $('binderBtn').disabled = true;
  const ritual = S.opened <= 3 && !REDUCED;
  // the stack, inside the pack
  const stack = new THREE.Group();
  pack.slot.add(stack);
  const cards = pack.contents.map((c, i) => {
    const card = makeCard(c, pack.entries?.[i]);
    card.index = i; card.result = results[i];
    card.faceDown = isSpecial(c);
    card.holder.rotation.set(0, card.faceDown ? Math.PI : 0, (Math.random() - .5) * .03);
    card.holder.position.set((Math.random() - .5) * .06, (Math.random() - .5) * .06, (4 - i) * .034);
    stack.add(card.holder);
    return card;
  });
  pack.entries = null;
  const inside = -.25;
  stack.position.y = inside;
  pack.state = 'open';
  await sleep(.12);
  sound.slide();
  await anim(.4, x => { stack.position.y = inside + x * 1.05; }, ease.out);
  if (ritual) {
    hint('Now pull the cards out ↑');
    await pullHandler(pack, stack, inside + 1.05);
  } else await sleep(.18);
  // out they come, and the wrapper falls away
  sound.slide();
  const y0 = stack.position.y, y1 = PH / 2 + CARD_H / 2 + .6;
  await anim(.42, x => { stack.position.y = lerp(y0, y1, x); }, ease.out);
  stage.attach(stack);
  pack.state = 'gone';
  const ph = pack.holder;
  moveTo(ph, { p: [ph.position.x, ph.position.y - VIEW_H * 1.2, -2], r: [.4, .3, .5] }, .8, ease.in).then(() => { if (current === pack) current = null; pack.dispose(); });
  current = null;
  await reveal(cards, stack, set);
  await summary(cards, stack, set);
  stack.removeFromParent();
  home();
}

function pullHandler(pack, stack, base) {
  return new Promise(resolve => {
    let start = null, offset = 0;
    const finish = () => { handler = null; hint(''); resolve(); };
    handler = {
      cursor: () => pointer.down ? 'grabbing' : 'grab',
      down() { start = worldAt(0); },
      move() {
        if (!start) return;
        const dy = (worldAt(0).y - start.y) / pack.baseScale;
        offset = clamp(dy, 0, 9);
        stack.position.y = base + offset;
        pack.body.position.y = -offset * .08;
        if (offset > 4.2) { start = null; finish(); }
      },
      up(e, tap) {
        if (tap) { finish(); return; }
        if (!start) return;
        start = null;
        if (offset > 2.4) { finish(); return; }
        const o0 = offset;
        anim(.25, x => { stack.position.y = base + o0 * (1 - x); pack.body.position.y = -o0 * .08 * (1 - x); }, ease.out);
      },
      key(e) { if (e.key === ' ' || e.key === 'Enter') { finish(); return true; } },
    };
  });
}

/* ---------- revealing the cards one by one ---------- */
function revealLayout() {
  const B = band(96, 40);   // leave room for the price tag under the card and the tally over it
  const near = (CAM_Z - 3.6) / CAM_Z;   // the top card rides 3.6 units nearer the camera, so it looks bigger
  return { s: Math.min(1.45, .96 * B.h / CARD_H, .84 * view.W / CARD_W) * near, y: B.y * near };
}
let tagEl = null, tagFor = null;
function showTag(card, stackGroup) {
  const c = card.data, item = itemOf(c), r = RARITY[item.rarity], set = SET_BY_ID[c.set];
  const v = valueOf(c), mult = MULT[c.v & 3];
  const badges = [card.result.isNew ? '<span class="badge new">NEW</span>' : '', c.v & HOLO ? '<span class="badge holo">HOLO</span>' : '', c.v & FULL ? '<span class="badge full">FULL ART</span>' : '', !card.result.isNew ? '<span class="badge dupe">DUPLICATE</span>' : ''].join('');
  if (!tagEl) { tagEl = document.createElement('div'); $('tags').append(tagEl); }
  tagEl.className = `tag glass t${tierOf(c)} ${finishOf(c)}`;
  tagEl.innerHTML = `<span class="rar">${r.symbol} ${r.name} · ${set.types[item.type].name}</span><span class="nm">${item.name}${badges}</span><span class="val">${mult > 1 ? `<s>${money(item.price, { short: true })}</s>` : ''}${money(v, { short: true })}${mult > 1 ? ` <small>${mult}×</small>` : ''}</span>`;
  tagEl.style.opacity = 1;
  tagFor = { card, stackGroup };
  live(`${r.name}${c.v & 3 ? ' ' + VARIANT_NAME[c.v & 3] : ''}: ${item.name}, worth ${money(v)}${card.result.isNew ? '. New!' : ''}`);
}
function hideTag() { if (tagEl) tagEl.style.opacity = 0; tagFor = null; }
function placeTag() {
  if (!tagFor || !tagEl) return;
  const { card } = tagFor;
  card.holder.updateWorldMatrix(true, false);
  const p = toScreen(V(0, -CARD_H / 2, 0).applyMatrix4(card.holder.matrixWorld));
  tagEl.style.left = p.x + 'px'; tagEl.style.top = Math.min(innerHeight - 150, p.y + 12) + 'px';
}
let packTotal = 0, revealed = 0;
function tally() {
  const dots = Array.from({ length: 9 }, (_, i) => `<i class="${i < revealed ? 'on' : ''} ${i === 8 ? 'R' : ''}"></i>`).join('');
  $('tally').innerHTML = `Pack value <b>${money(packTotal)}</b><span class="dots">${dots}</span>`;
  $('tally').hidden = false;
}

async function reveal(cards, stack, set) {
  mode = 'reveal';
  let skipping = false;
  const skip = () => { skipping = true; timeScale = 6; setActions([]); hint(''); waiting?.(-1); };
  if (S.opened > 1) setActions([{ label: 'Skip to the end', cls: 'ghost glass', onClick: skip }]);
  const L = revealLayout();
  packTotal = 0; revealed = 0; tally();
  await moveTo(stack, { p: [0, L.y, 2], s: L.s, r: [0, 0, 0] }, .55, ease.inOut);
  layoutChanged = () => { const L2 = revealLayout(); stack.scale.setScalar(L2.s); stack.position.y = L2.y; };
  const order = cards.slice();
  for (let i = 0; i < order.length; i++) {
    const card = order[i], last = i === order.length - 1;
    // the rest of the stack shuffles forward; the card on top lifts clear of it so it can turn without clipping
    const lifts = order.slice(i).map((c, k) => { const z0 = c.holder.position.z, z1 = k === 0 ? 1.6 : (4 - k) * .034; return anim(.22, x => { c.holder.position.z = lerp(z0, z1, x); }, ease.out); });
    await lifts[0];
    const tier = tierOf(card.data);
    if (card.faceDown) {
      const kind = specialKind(card.data);
      const aura = addAura(card, kind, tier);
      sound.sparkle(kind === 'rare' ? 0 : 1);
      hint(tier >= 5 ? 'Whoa. Tap to flip it' : tier >= 4 ? 'This one feels heavy… tap to flip it' : kind === 'rare' ? 'Your rare! Tap to flip it' : 'Something shiny… tap to flip it');
      if (!skipping) await waitTap(card, stack);
      hint('');
      const was = timeScale;
      if (tier >= 5) timeScale = 1;   // a jackpot plays out in full, even when skipping
      await flipUp(card, stack, kind, tier);
      setTimeout(() => aura.removeFromParent(), 900);
      if (tier >= 5 && skipping) { await sleep(3); card.fx?.release(); }
      timeScale = was;
    } else {
      if (i === 0) sound.pop();
      if (tier >= 2) { card.holder.updateWorldMatrix(true, false); stack.updateWorldMatrix(true, false); card.fx = celebrate(card.data, V().applyMatrix4(card.holder.matrixWorld), { mini: true, backZ: V().applyMatrix4(stack.matrixWorld).z - .8 }); }
    }
    revealed = i + 1; packTotal += valueOf(card.data); tally();
    showTag(card, stack);
    // sway a little so the foil catches the light
    let swaying = true;
    tickers.add(dt => { const m = card.mesh; if (!swaying) { m.rotation.set(0, 0, 0); return false; } m.rotation.y = damp(m.rotation.y, Math.sin(T * .8) * .08, 4, dt); m.rotation.x = damp(m.rotation.x, Math.sin(T * .6) * .04, 4, dt); });
    if (last) {
      hint('Tap for a look at all nine', 900);
      if (!skipping) await waitSwipe(card, stack, true);
      swaying = false;
      card.fx?.release();
      hideTag(); hint('');
      break;
    }
    if (!skipping) { hint(i === 0 ? (TOUCH ? 'Swipe the card away for the next one' : 'Swipe or click for the next card') : '', i === 0 ? 700 : 0); }
    const dir = skipping ? -1 : await waitSwipe(card, stack);
    swaying = false;
    card.fx?.release();
    hideTag(); hint('');
    await flingAway(card, stack, dir);
    if (S.settings.autoSell && card.result.dupe) autoSell(card);
  }
  timeScale = 1;
  setActions([]);
  const lastCard = order[order.length - 1];
  if (S.settings.autoSell && lastCard.result.dupe && !lastCard.soldAuto) autoSell(lastCard);
}
let waiting = null;   // resolves whatever the reveal is waiting on (for Skip)
function waitTap(card, stack) {
  return new Promise(resolve => {
    const done = () => { handler = null; waiting = null; resolve(); };
    waiting = done;
    handler = {
      cursor: () => 'point',
      up(e, tap) { if (tap || pointer.moved > 30) done(); },
      key(e) { if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { done(); return true; } },
    };
  });
}
// Drag the top card: let go to one side (or tap) and it's swiped away. Resolves with the direction.
function waitSwipe(card, stack, tapOnly = false) {
  return new Promise(resolve => {
    const h = card.holder, base = h.position.clone(), baseR = h.rotation.clone();
    let start = null;
    const done = dir => { handler = null; waiting = null; resolve(dir); };
    waiting = done;
    handler = {
      cursor: () => pointer.down ? 'grabbing' : 'grab',
      down() { start = localAt(stack); },
      move() {
        if (!start) return;
        const l = localAt(stack), dx = l.x - start.x, dy = l.y - start.y;
        h.position.set(base.x + dx, base.y + dy * .6, base.z + Math.min(1, Math.hypot(dx, dy) * .2));
        h.rotation.set(baseR.x - dy * .02, baseR.y + dx * .03, baseR.z - dx * .045);
      },
      up(e, tap) {
        if (!start) return;
        const l = localAt(stack), dx = l.x - start.x;
        start = null;
        const flick = Math.abs(pointer.vx) * view.px / stack.scale.x;
        if (tap) { h.position.copy(base); h.rotation.copy(baseR); done(-1); return; }
        if (!tapOnly && (Math.abs(dx) > 1.6 || flick > 14)) { done(Math.sign(dx || pointer.vx) || -1); return; }
        if (tapOnly && Math.abs(dx) > 1.6) { done(-1); return; }
        const p0 = h.position.clone(), r0 = h.rotation.clone();
        anim(.3, x => { h.position.lerpVectors(p0, base, x); h.rotation.set(lerp(r0.x, baseR.x, x), lerp(r0.y, baseR.y, x), lerp(r0.z, baseR.z, x)); }, ease.back);
      },
      key(e) { if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { done(-1); return true; } if (e.key === 'ArrowLeft') { done(1); return true; } },
    };
  });
}
async function flingAway(card, stack, dir) {
  sound.swish();
  const h = card.holder, off = view.W / 2 / stack.scale.x + CARD_W;
  await moveTo(h, { p: [dir * off, h.position.y + 1.5, h.position.z + .5], r: [0, dir * .5, -dir * .5] }, .26, ease.in);
  h.visible = false;
  card.gone = dir;
}
async function flipUp(card, stack, kind, tier) {
  const h = card.holder, big = tier >= 4, jackpot = tier >= 5;
  card.flipping = true; card.mesh.position.set(0, 0, 0);
  const aura = card.aura?.userData;
  if (aura) { aura.rimTarget = 0; aura.flareTarget = .2 + tier * .06; }
  if (big) {   // the wind-up: it shivers and pulls back, with a drum roll for a jackpot
    if (jackpot) sound.drumroll(1.35); else sound.swell(.7);
    const z1 = h.position.z;
    await anim(jackpot ? 1.3 : .6, (x, k) => {
      h.position.z = z1 + x * (jackpot ? 1.2 : .6);
      card.mesh.position.x = Math.sin(k * 90) * .07 * k; card.mesh.rotation.z = Math.sin(k * 70) * .035 * k;
    }, ease.in);
    card.mesh.position.set(0, 0, 0); card.mesh.rotation.set(0, 0, 0);
  }
  sound.flip();
  stack.updateWorldMatrix(true, false);
  const backZ = V().applyMatrix4(stack.matrixWorld).z - .8;   // light goes behind the whole stack, never over the card
  const z0 = h.position.z, turns = jackpot ? 1 : 0, sweep = Math.PI + turns * Math.PI * 2;
  const reveal = 1 - (Math.PI / 2) / sweep;   // the point in the turn where the face comes round for good
  let fx = null;
  await anim([.62, .62, .7, .8, 1, 1.5][tier], (x, k) => {
    h.rotation.y = Math.PI - x * sweep;
    h.position.z = z0 + Math.sin(k * Math.PI) * (3 + tier * .45);
    h.scale.setScalar(1 + Math.sin(k * Math.PI) * (.1 + tier * .03));
    if (!fx && x > reveal) {
      card.faceDown = false;
      h.updateWorldMatrix(true, false);
      fx = celebrate(card.data, V().applyMatrix4(h.matrixWorld), { linger: tier >= 4, backZ });
      card.flash = .25 + tier * .05;
    }
  }, ease.inOut);
  h.rotation.y = 0;
  card.flipping = false; card.fx = fx;
  anim(.45, x => { card.flash = (.25 + tier * .05) * (1 - x); }, ease.out);
  if (aura) { aura.target = 0; aura.flareTarget = 0; }
  if (kind !== 'rare' || tier >= 3) {   // tilt it about so the foil shows off
    await anim(1.2 + tier * .15, (x, k) => { h.rotation.y = Math.sin(k * Math.PI * 2) * .38 * (1 - k * .6); h.rotation.x = Math.sin(k * Math.PI * 3) * .12 * (1 - k); }, ease.linear);
  }
  h.rotation.set(0, 0, h.rotation.z);
}
let flash = 0;
function flashBackdrop(amount, color = '#ffd76a') { flash = Math.max(flash, amount); backdrop.uniforms.uGlowColor.value.set(color); }
function autoSell(card) {
  const v = store.sell(card.result.key);
  if (!v) return;
  card.soldAuto = true;
  const at = card.gone ? V(card.gone * view.W * .45, 2, 3) : V();
  payout(at, v);
  updateCount(); checkUnlock();
}

/* ---------- the summary: all nine, sell or keep ---------- */
function gridLayout(n) {
  const B = band(26), gap = .55, availW = view.W * .94, availH = B.h * .97;
  let best = null;
  for (const cols of [3, 4, 5, 9]) {
    const rows = Math.ceil(n / cols), w = cols * CARD_W + (cols - 1) * gap, h = rows * CARD_H + (rows - 1) * gap * 2.2;
    const s = Math.min(availW / w, availH / h);
    if (!best || s > best.s) best = { cols, rows, s, w, h };
  }
  best.y = B.y + .2;
  return best;
}
async function summary(cards, stack, set) {
  mode = 'summary';
  setActions([{ label: '…', cls: 'gold' }]);   // hold the space the buttons will take while measuring
  const G = gridLayout(cards.length);
  moveTo(stack, { p: [0, G.y, 0], s: G.s }, .5, ease.out);
  let active = true;
  const pos = i => { const r = Math.floor(i / G.cols), c = i % G.cols, inRow = Math.min(G.cols, cards.length - r * G.cols);
    return [(c - (inRow - 1) / 2) * (CARD_W + .55), ((G.rows - 1) / 2 - r) * (CARD_H + .55 * 2.2), 0]; };
  cards.forEach((card, i) => {
    const h = card.holder;
    h.visible = true; h.scale.setScalar(1);
    if (card.gone) { h.position.set(card.gone * (view.W / 2 / G.s + CARD_W), pos(i)[1], 0); h.rotation.set(0, 0, -card.gone * .4); }
    card.mark = card.soldAuto ? 'sold' : null;
    card.sold = card.soldAuto ? .85 : 0;
  });
  sound.slide();
  await Promise.all(cards.map((card, i) => sleep(i * .045).then(() => moveTo(card.holder, { p: pos(i), r: [0, 0, 0], s: 1 }, .5, ease.out))));
  $('tally').hidden = true;
  // chips under each card
  const chips = cards.map(card => {
    const el = document.createElement('div'); el.className = 'chip glass';
    card.chip = el; $('tags').append(el);
    return el;
  });
  const render = () => {
    let sell = 0, n = 0;
    cards.forEach(card => {
      const v = valueOf(card.data), el = card.chip;
      el.className = 'chip glass' + (card.mark === 'sell' ? ' marked' : '') + (card.mark === 'sold' ? ' sold' : '');
      el.innerHTML = card.mark === 'sold' ? `Sold +${money(v, { short: true })}` : `${money(v, { short: true })}<button type="button">${card.mark === 'sell' ? 'Selling' : 'Sell'}</button>${card.result.isNew ? '<span class="newdot">NEW</span>' : ''}`;
      el.querySelector('button')?.addEventListener('click', () => { card.mark = card.mark === 'sell' ? null : 'sell'; sound.click(); render(); });
      card.sold = card.mark === 'sell' ? .7 : card.mark === 'sold' ? .85 : 0;
      if (card.mark === 'sell') { sell += v; n++; }
    });
    const dupes = cards.filter(c => c.result.dupe && !c.mark);
    const keep = cards.filter(c => !c.mark).length;
    if (cards.every(c => c.mark === 'sold')) { setActions([{ label: 'Next', cls: 'gold', onClick: () => finish() }]); return; }
    setActions([
      dupes.length ? { label: `Sell duplicates`, sub: `${dupes.length}`, onClick: () => { dupes.forEach(c => { c.mark = 'sell'; }); render(); } } : null,
      { label: n ? 'Keep all' : 'Sell all', onClick: () => { const any = cards.some(c => c.mark === 'sell'); cards.forEach(c => { if (c.mark !== 'sold') c.mark = any ? null : 'sell'; }); render(); } },
      { label: n ? `Sell ${n} for ${money(sell, { short: true })}${keep ? ` · keep ${keep}` : ''}` : `Put ${keep === 9 ? 'all 9' : keep} in the binder`, cls: 'gold', onClick: () => finish() },
    ].filter(Boolean));
  };
  let finish;
  const done = new Promise(res => { finish = res; });
  render();
  const total = cards.reduce((s, c) => s + valueOf(c.data), 0);
  hint(`This pack is worth <b>${money(total)}</b> · tap a card for a closer look`);
  if (!S.settings.autoSell && !S.stats.tipAutoSell && cards.some(c => c.result.dupe)) {
    S.stats.tipAutoSell = 1; store.save();
    setTimeout(() => toast('Tip: turn on <b>Auto-sell duplicates</b> in the ⋯ menu and cards you already own sell themselves.', 5200), 900);
  }
  // hovering tilts a card toward you; clicking looks closer
  let hover = null;
  handler = {
    cursor: () => hover ? 'point' : '',
    hover() { hover = pickCard(cards); },
    up(e, tap) { if (!tap) return; const c = pickCard(cards); if (c) inspect(c, { from: 'summary', onSell: () => { c.mark = c.mark === 'sell' ? null : 'sell'; render(); } }).then(() => { render(); hint(`This pack is worth <b>${money(total)}</b> · tap a card for a closer look`); }); },
    key(e) { if (e.key === 'Enter') { finish(); return true; } },
  };
  tickers.add(dt => {
    for (const c of cards) {
      c.stamp = damp(c.stamp ?? 0, c.mark === 'sold' ? 1 : 0, 9, dt);
      c.sash = c.stamp;
      const on = c === hover && !c.inspecting ? 1 : 0;
      c.hov = damp(c.hov ?? 0, on, 10, dt);
      c.mesh.position.z = c.hov * .8;
      if (c.inspecting) continue;
      const l = on ? localAt(c.holder) : null;
      c.holder.rotation.x = damp(c.holder.rotation.x, on && l ? -l.y * .05 : 0, 8, dt);
      c.holder.rotation.y = damp(c.holder.rotation.y, on && l ? l.x * .08 : 0, 8, dt);
    }
    return active;
  });
  layoutChanged = () => { const G2 = gridLayout(cards.length); stack.scale.setScalar(G2.s); stack.position.y = G2.y; };
  await done;
  active = false;
  handler = null; hint('');
  setActions([]);
  chips.forEach(el => el.remove());
  cards.forEach(c => { c.chip = null; c.mesh.position.z = 0; });
  // sell the marked ones, the rest go in the binder
  const away = [];
  let delay = 0;
  const sells = cards.filter(c => c.mark === 'sell');
  for (const c of sells) {
    const v = store.sell(c.result.key);
    c.holder.updateWorldMatrix(true, false);
    const at = V().applyMatrix4(c.holder.matrixWorld);
    payout(at, v, delay);
    const h = c.holder;
    away.push(sleep(delay / 1000).then(() => moveTo(h, { s: .01, r: [0, Math.PI * 2, 0] }, .35, ease.in)));
    delay += 90;
  }
  if (sells.length) { updateCount(); live(`Sold ${sells.length} ${sells.length === 1 ? 'card' : 'cards'}.`); }
  // the ones sold already just fold away
  cards.filter(c => c.mark === 'sold').forEach((c, i) => away.push(sleep(i * .04).then(() => moveTo(c.holder, { s: .01, r: [0, 0, .6] }, .3, ease.in))));
  const keep = cards.filter(c => c.mark !== 'sell' && c.mark !== 'sold');
  await sleep(sells.length ? .3 : 0);
  if (keep.length) sound.slide();
  away.push(...keep.map((c, i) => sleep(i * .06).then(async () => {
    const h = c.holder; stage.attach(h);
    const target = binderWorld(4);
    await moveTo(h, { p: [target.x, target.y, target.z], s: .06, r: [0, 0, (Math.random() - .5)] }, .55, ease.in);
    h.visible = false;
  })));
  await Promise.all(away);
  if (keep.length) { updateCount(true); sound.pop(); }
  cards.forEach(disposeCard);
  checkUnlock();
  await sleep(.25);
}
function pickCard(cards) {
  raycaster.setFromCamera(pointer.ndc, camera);
  const hits = raycaster.intersectObjects(cards.filter(c => c.holder.visible && !c.inspecting).map(c => c.mesh), false);
  return hits.length ? hits[0].object.userData.card : null;
}

/* ---------- looking closely at one card ---------- */
let inspecting = null;
async function inspect(card, o = {}) {
  if (inspecting) return 'busy';
  inspecting = card;
  const prevHandler = handler, prevMode = mode;
  handler = null;   // a second tap while it flies up mustn't pick another card
  mode = 'inspect'; card.inspecting = true;
  if (TILT && S.settings.tilt) phoneTilt.start();
  const h = card.holder, parent = h.parent;
  const saved = { p: h.position.clone(), r: h.rotation.clone(), s: h.scale.clone() };
  // swap in the sharp face while it's big
  const hiEntry = card.entry?.width === HI ? null : faces.get(card.data, HI, true);
  const loEntry = hiEntry ? card.entry : null;
  if (hiEntry) { faces.get(card.data, card.entry.width); card.set(hiEntry); }
  // out of the binder, it slides up out of its sleeve first, the way you'd pull a card out of a pocket
  const fromSleeve = o.from === 'binder', slid = fromSleeve ? [saved.p.x, saved.p.y + CARD_H * .72, saved.p.z + .14] : null;
  $('tags').style.visibility = 'hidden';
  if (fromSleeve) {
    sound.sleeve();
    await moveTo(h, { p: slid, r: [saved.r.x - .05, saved.r.y, saved.r.z] }, .34, ease.out);
  }
  scene.attach(h);
  const c = card.data, item = itemOf(c), r = RARITY[item.rarity], set = SET_BY_ID[c.set];
  $('inName').innerHTML = `${item.name}${c.v & HOLO ? '<span class="badge holo">HOLO</span>' : ''}${c.v & FULL ? '<span class="badge full">FULL ART</span>' : ''}`;
  const copies = store.copies(cardKey(c));
  $('inSub').textContent = `${r.symbol} ${r.name} · ${set.types[item.type].name} · No. ${String(item.no).padStart(3, '0')} · ${set.name}${copies > 1 ? ` · you have ${copies}` : ''}`;
  $('inVal').textContent = money(valueOf(c));
  const selling = o.from === 'summary';
  $('inSell').textContent = selling ? (card.mark === 'sell' ? 'Don’t sell' : `Sell for ${money(valueOf(c), { short: true })}`) : `Sell for ${money(valueOf(c), { short: true })}`;
  $('inSell').hidden = card.mark === 'sold';
  const panel = $('inspect');
  panel.style.visibility = 'hidden'; panel.hidden = false;
  const panelTop = panel.getBoundingClientRect().top;
  // fit the card between the top bar and the panel at the bottom (it sits 8 units closer, so it looks bigger)
  const Z = 8, k = (CAM_Z - Z) / CAM_Z, top = 64, bottom = innerHeight - panelTop + 10;
  const room = (innerHeight - top - bottom) / innerHeight * VIEW_H * k;
  const s = Math.min(room / CARD_H, .9 * view.W * k / CARD_W);
  const y = ((innerHeight / 2 - (top + (innerHeight - top - bottom) / 2)) / innerHeight) * VIEW_H * k;
  sound.whoosh(.6);
  $('actions').style.visibility = 'hidden';
  for (const id of ['binderbar', 'pager']) $(id).style.visibility = 'hidden';
  if (prevMode === 'binder') binder.dim(true);
  await moveTo(h, { p: [0, y, Z], r: [0, 0, 0], s }, .45, ease.out);
  panel.style.visibility = '';
  hint('');
  let resolveBack;
  const back = new Promise(res => { resolveBack = res; });
  let result = 'back';
  $('inBack').onclick = () => { sound.click(); resolveBack(); };
  $('inSell').onclick = () => { result = 'sell'; resolveBack(); };
  let tilt = V(), target = V(), dragging = false, t = 0;
  handler = {
    cursor: () => dragging ? 'grabbing' : 'grab',
    down() { dragging = true; },
    move() { if (dragging) target.set(clamp((pointer.y - pointer.sy) * .006, -.7, .7), clamp((pointer.x - pointer.sx) * .008, -.9, .9), 0); },
    hover() { if (!TOUCH) target.set(-pointer.ndc.y * .35, pointer.ndc.x * .5, 0); },
    up(e, tap) {
      dragging = false;
      if (TOUCH) target.set(0, 0, 0);
      // a click or tap anywhere off the card puts it back
      if (tap) { raycaster.setFromCamera(pointer.ndc, camera); if (!raycaster.intersectObject(card.mesh, false).length) resolveBack(); }
    },
    key(e) { if (e.key === 'Escape' || e.key === 'Backspace') { resolveBack(); return true; } },
  };
  tickers.add(dt => {
    t += dt;
    // on a phone, tilting it turns the card (a finger dragging it wins), and the idle sway stays small
    phoneTilt.update(dt);
    const gyro = phoneTilt.live && !dragging, sway = phoneTilt.live ? .3 : 1;
    const tx = gyro ? clamp(phoneTilt.x, -.55, .55) : target.x, ty = gyro ? clamp(phoneTilt.y, -.65, .65) : target.y;
    tilt.x = damp(tilt.x, tx + Math.sin(t * .9) * .05 * sway, gyro ? 14 : 7, dt);
    tilt.y = damp(tilt.y, ty + Math.sin(t * .7) * .08 * sway, gyro ? 14 : 7, dt);
    h.rotation.set(tilt.x, tilt.y, 0);
    return mode === 'inspect' && card.inspecting;
  });
  await back;
  $('inspect').hidden = true; hint('');
  card.inspecting = false;
  phoneTilt.stop();
  if (result === 'sell' && selling) { o.onSell?.(); result = 'back'; }
  if (result === 'sell') {
    handler = null;
    const v = store.sell(cardKey(c), o.at ?? -1);
    payout(V(0, y, Z), v);
    await moveTo(h, { s: .01, r: [0, Math.PI * 3, 0] }, .4, ease.in);
    updateCount(); checkUnlock();
    live(`Sold ${item.name} for ${money(v)}.`);
  } else {
    sound.whoosh(.4);
    parent.attach(h);
    if (fromSleeve) {   // back over its pocket, then down into the sleeve
      await moveTo(h, { p: slid, r: [saved.r.x - .05, saved.r.y, saved.r.z], s: saved.s.toArray() }, .38, ease.inOut);
      sound.sleeve();
      await moveTo(h, { p: saved.p.toArray(), r: saved.r.toArray() }, .3, ease.in);
    } else await moveTo(h, { p: saved.p.toArray(), r: saved.r.toArray(), s: saved.s.toArray() }, .35, ease.inOut);
  }
  if (hiEntry) card.set(loEntry);
  $('tags').style.visibility = '';
  $('actions').style.visibility = '';
  for (const id of ['binderbar', 'pager']) $(id).style.visibility = '';
  if (prevMode === 'binder') binder.dim(false);
  mode = prevMode; handler = prevHandler; inspecting = null;
  return result;
}

/* ---------- booster boxes ---------- */
async function buyBox() {
  const set = selectedSet, price = store.boxPrice(set);
  if (!store.spend(price)) { sound.denied(); return; }
  sound.buy();
  showGhost(false);
  dropCurrent();
  mode = 'box'; handler = null; setActions([]); hint(''); $('sets').hidden = true; $('binderBtn').disabled = true;
  const packs = Array.from({ length: store.BOX_PACKS }, () => store.rollPack(set));
  const all = packs.flat();
  const results = store.collect(all);
  S.opened += packs.length; S.boxesOpened++; store.save();
  updateCount();
  const box = new BoxOpening({ THREE, set, packs, results, stage, faces, makeCard, disposeCard, anim, sleep, moveTo, ease, sound, particles, view, VIEW_H, wrapperPrints, Pack, PW, PH,
    celebrate, tierOf, tapOnce, payout, binderWorld, flashBackdrop, setActions, hint, tally: html => { $('tally').innerHTML = html; $('tally').hidden = !html; },
    autoSell: S.settings.autoSell, sell: key => { const v = store.sell(key); updateCount(); return v; }, updateCount, setTimeScale: s => { timeScale = s; }, V });
  tickers.add(dt => { box.update(dt); return mode === 'box'; });
  const summary = await box.run();
  timeScale = 1;
  checkUnlock();
  await showResult(summary);
  box.dispose();
  home();
}
// Resolves on the next tap or key press (anywhere), or after ms.
function tapOnce(ms = Infinity) {
  return new Promise(res => {
    const before = handler; let timer = 0;
    const done = () => { clearTimeout(timer); if (handler === h) handler = before; res(); };
    const h = { cursor: () => 'point', up: (e, tap) => { if (tap) done(); }, key: e => { if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') { done(); return true; } } };
    handler = h;
    if (ms < Infinity) timer = setTimeout(done, ms);
  });
}
function showResult(r) {
  $('resultTitle').textContent = r.title;
  $('resultSub').textContent = r.sub;
  $('resultStats').innerHTML = r.stats.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  $('result').classList.toggle('low', !!r.best?.length);
  $('result').hidden = false; $('resultDone').focus();
  // the best pulls, fanned out in the space above the panel
  const shelf = new THREE.Group(), shown = [];
  if (r.best?.length) {
    const top = document.querySelector('.hud').getBoundingClientRect().bottom + 12, bottom = $('result').getBoundingClientRect().top - 14;
    const hPx = Math.max(60, bottom - top), n = r.best.length;
    const s = Math.min(hPx / innerHeight * VIEW_H / CARD_H, view.W * .9 / (n * CARD_W * 1.1));
    shelf.position.set(0, (innerHeight / 2 - (top + bottom) / 2) / innerHeight * VIEW_H, 3);
    shelf.scale.setScalar(s);
    stage.add(shelf);
    r.best.forEach((c, i) => {
      const card = makeCard(c, faces.get(c, HI));
      const k = i - (n - 1) / 2;
      card.holder.position.set(k * CARD_W * 1.08, -VIEW_H / s, -Math.abs(k) * .3);
      card.holder.rotation.set(0, Math.PI, -k * .05);
      shelf.add(card.holder); shown.push(card);
      sleep(.15 + i * .12).then(() => moveTo(card.holder, { p: [k * CARD_W * 1.08, -Math.abs(k) * .25, -Math.abs(k) * .3], r: [0, 0, -k * .05] }, .7, ease.out)).then(() => { if (c.v & 3) sound.sparkle(1); });
    });
    tickers.add(() => { shown.forEach((c, i) => { c.mesh.rotation.y = Math.sin(T * .9 + i) * .12; c.mesh.rotation.x = Math.sin(T * .7 + i * 2) * .05; }); return !!shelf.parent; });
  }
  return new Promise(res => {
    const close = v => { $('result').hidden = true; $('result').classList.remove('low'); shown.forEach(disposeCard); shelf.removeFromParent(); res(v); };
    $('resultDone').onclick = () => close('done');
    $('resultBinder').onclick = () => { close('binder'); setTimeout(openBinder, 50); };
  });
}

/* ---------- the binder ---------- */
const binder = new Binder({ THREE, scene, camera, faces, makeCard, disposeCard, anim, sleep, moveTo, ease, sound, view, VIEW_H, V, localAt, pointer, raycaster, store, S: () => S });
async function openBinder() {
  if (mode !== 'shop') return;
  showGhost(false);
  sound.page();
  mode = 'binder';
  const pack = current;
  if (pack) { pack.state = 'hidden'; moveTo(pack.holder, { p: [0, -VIEW_H * 1.1, -3] }, .4, ease.in); }
  handler = null; setActions([]); hint(''); $('sets').hidden = true;
  $('binderBtn').disabled = true;
  $('binderbar').hidden = false; $('pager').hidden = false;
  $('sort').value = S.settings.sort;
  const sf = $('setFilter');
  sf.hidden = SETS.length < 2;
  if (!sf.hidden && !sf.options.length) { sf.innerHTML = `<option value="">All sets</option>` + SETS.map(s => `<option value="${s.id}">${s.name}</option>`).join(''); }
  refreshBinderUI();
  binder.area = binderArea();
  await binder.open();
  refreshBinderUI();
  handler = binder.handler({ onPick: pickBinderCard, onPage: refreshBinderUI });
  layoutChanged = () => { binder.area = binderArea(); binder.layout(); };
}
async function closeBinder() {
  if (mode !== 'binder') return;
  handler = null;
  sound.page();
  $('binderbar').hidden = true; $('pager').hidden = true;
  await binder.close();
  $('binderBtn').disabled = false;
  mode = 'shop';
  home();
  if (current) {
    const pack = current, L = packLayout();
    await moveTo(pack.holder, { p: [0, L.y, 0], s: L.s }, .45, ease.out);
    if (current !== pack || mode !== 'shop') return;
    pack.state = 'idle'; handler = tearHandler(pack); layoutChanged = relayoutPack;
    hint(TOUCH ? 'Swipe across the dotted line to tear it open' : 'Drag across the dotted line to tear it open');
  }
}
// The band between the binder's toolbar and its pager, in world units at z = 0.
function binderArea() {
  const top = $('binderbar').getBoundingClientRect().bottom + 10, bottom = $('pager').getBoundingClientRect().top - 10;
  return { y: (innerHeight / 2 - (top + bottom) / 2) / innerHeight * VIEW_H, h: Math.max(4, (bottom - top) / innerHeight * VIEW_H) };
}
function refreshBinderUI() {
  const st = store.collectionStats();
  const found = st.perSet.reduce((a, s) => a + s.found, 0), total = st.perSet.reduce((a, s) => a + s.total, 0);
  $('binderTitle').innerHTML = `${st.count.toLocaleString('en-US')} ${st.count === 1 ? 'card' : 'cards'}<small>${found}/${total} found · worth ${money(st.value, { short: true })}</small>`;
  const d = store.duplicates();
  $('sellDupes').hidden = !d.length;
  $('sellDupes').textContent = `Sell ${d.length} duplicate${d.length === 1 ? '' : 's'}`;
  $('pageLabel').textContent = binder.pageLabel();
  $('prevPage').disabled = !binder.canPrev(); $('nextPage').disabled = !binder.canNext();
}
async function pickBinderCard(card, at) {
  const handlerBefore = handler;
  const result = await inspect(card, { from: 'binder', at });
  if (result === 'sell') { await binder.refresh(); refreshBinderUI(); }
  handler = handlerBefore;
}
$('binderBtn').addEventListener('click', () => { sound.ensure(); if (mode === 'shop') openBinder(); });
$('closeBinder').addEventListener('click', () => closeBinder());
$('prevPage').addEventListener('click', async () => { await binder.turn(-1); refreshBinderUI(); });
$('nextPage').addEventListener('click', async () => { await binder.turn(1); refreshBinderUI(); });
$('setFilter').addEventListener('change', async () => { binder.filter = $('setFilter').value; await binder.refresh(true); refreshBinderUI(); });
$('sort').addEventListener('change', async () => { S.settings.sort = $('sort').value; store.save(); await binder.refresh(true); refreshBinderUI(); });
$('sellDupes').addEventListener('click', async () => {
  const d = store.duplicates();
  if (!d.length) return;
  const total = d.reduce((s, x) => s + valueOf(store.parseKey(x.key)), 0);
  if (!await confirmBox('Sell duplicates?', `Sell ${d.length} extra ${d.length === 1 ? 'copy' : 'copies'} for ${money(total)}? You keep one of every card.`, `Sell for ${money(total, { short: true })}`)) return;
  const got = store.sellMany(d);
  payout(V(0, 0, 4), got);
  updateCount(); checkUnlock();
  await binder.refresh(); refreshBinderUI();
});

/* ---------- menu ---------- */
function openMenu() {
  $('menu').classList.add('open'); $('menuBtn').setAttribute('aria-expanded', 'true');
  $('autoSell').setAttribute('aria-checked', S.settings.autoSell); $('soundSwitch').setAttribute('aria-checked', S.settings.sound);
  $('tiltSetting').hidden = !TILT; $('tiltSwitch').setAttribute('aria-checked', S.settings.tilt);
  const st = store.collectionStats(), best = S.stats.best ? store.parseKey(S.stats.best) : null, bi = best && itemOf(best);
  $('stats').innerHTML = [
    ['Packs opened', S.opened.toLocaleString('en-US')], ['Booster boxes', S.boxesOpened.toLocaleString('en-US')],
    ['Cards in binder', st.count.toLocaleString('en-US')], ...st.perSet.map(p => [`${p.set.name} found`, `${p.found} / ${p.total}`]),
    ['Binder is worth', money(st.value)], ['Cards sold', S.stats.sold.toLocaleString('en-US')], ['Earned from sales', money(S.stats.earned)],
    ['Free packs', String(S.stats.donated)], ['Best pull', bi ? `${bi.name}${best.v & 3 ? ' (' + VARIANT_NAME[best.v & 3] + ')' : ''} · ${money(S.stats.bestValue, { short: true })}` : '—'],
  ].map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  $('closeMenu').focus();
}
function closeMenu() { $('menu').classList.remove('open'); $('menuBtn').setAttribute('aria-expanded', 'false'); }
$('menuBtn').addEventListener('click', () => { sound.ensure(); $('menu').classList.contains('open') ? closeMenu() : openMenu(); });
$('closeMenu').addEventListener('click', closeMenu);
$('autoSell').addEventListener('click', () => { S.settings.autoSell = !S.settings.autoSell; store.save(); $('autoSell').setAttribute('aria-checked', S.settings.autoSell); });
$('soundSwitch').addEventListener('click', () => { S.settings.sound = !S.settings.sound; store.save(); sound.set(S.settings.sound); $('soundSwitch').setAttribute('aria-checked', S.settings.sound); });
$('tiltSwitch').addEventListener('click', () => {
  S.settings.tilt = !S.settings.tilt; store.save(); $('tiltSwitch').setAttribute('aria-checked', S.settings.tilt);
  if (S.settings.tilt) phoneTilt.ask(true).then(ok => { if (!ok && phoneTilt.state === 'no') toast('Motion is turned off for this site. Allow “Motion & Orientation Access” in your browser settings, then try again.', 4200); });
});
$('exportFile').addEventListener('click', () => {
  const blob = new Blob([store.exportJSON()], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `booster-packs-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  $('exportMsg').textContent = 'Saved a file to your downloads.';
});
$('exportCode').addEventListener('click', async () => {
  const code = await store.exportCode();
  try { await navigator.clipboard.writeText(code); $('exportMsg').textContent = `Copied a ${code.length.toLocaleString('en-US')}-character code. Paste it into Load a save on another browser.`; }
  catch { $('importText').value = code; $('importText').select(); $('exportMsg').textContent = 'Couldn’t reach the clipboard, so the code is in the box below. Copy it from there.'; }
});
async function importFrom(text) {
  const msg = $('importMsg'); msg.className = 'msg';
  if (busy()) { msg.className = 'msg err'; msg.textContent = 'Finish opening first, then load the save.'; return; }
  try {
    const next = await store.parseImport(text);
    const n = next.cards.length;
    if (!await confirmBox('Load this save?', `It has ${n.toLocaleString('en-US')} ${n === 1 ? 'card' : 'cards'} and ${money(next.money)}. It replaces everything you have here.`, 'Load it')) return;
    if (mode === 'binder') await closeBinder();
    store.replaceWith(next);
    shownMoney = S.money; $('money').textContent = money(S.money);
    sound.set(S.settings.sound);
    updateCount(); closeMenu(); $('importText').value = '';
    if (current) dropCurrent();
    toast('Save loaded.');
    home();
  } catch (e) { msg.className = 'msg err'; msg.textContent = e.message || 'That save couldn’t be read.'; }
}
$('importBtn').addEventListener('click', () => importFrom($('importText').value));
$('importFileBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFrom((await f.text()).slice(0, 5e6)); });
$('resetBtn').addEventListener('click', async () => {
  if (busy()) { toast('Finish opening first.'); return; }
  if (mode === 'binder') await closeBinder();
  if (!await confirmBox('Erase everything?', 'Your money, binder and packs will be gone for good. You start again with one free pack.', 'Erase')) return;
  store.reset(); shownMoney = 0; $('money').textContent = money(0);
  updateCount(); closeMenu();
  if (current) dropCurrent();
  home();
});

/* ---------- the frame loop ---------- */
const tickers = new Set();
let last = performance.now(), T = 0, first = true;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
  tickAnims(dt);
  for (const fn of tickers) if (fn(dt) === false) tickers.delete(fn);
  cardTime.value = T;
  backdrop.uniforms.uTime.value = T;
  tickFx(dt);
  shake = damp(shake, 0, 3.5, dt);
  camera.position.set((Math.random() - .5) * shake, (Math.random() - .5) * shake, CAM_Z);
  flash = damp(flash, 0, 2.2, dt); backdrop.uniforms.uGlow.value = flash;
  // the floating pack
  const pack = current;
  if (pack && (pack.state === 'idle' || pack.state === 'open')) {
    const moved = pack.update(dt);
    if (moved > .001) {
      sound.tear(moved * 3);
      const p = pack.frontWorld();
      for (let i = 0; i < Math.min(4, moved * 30); i++) particles.spawn({ p, v: V((Math.random() - .5) * 4, 2 + Math.random() * 4, 2 + Math.random() * 2), life: .5 + Math.random() * .4, size: .3 + Math.random() * .3, color: Math.random() < .5 ? '#fff6d0' : '#ffd76a', gravity: -8 });
    }
    if (pack.detached && !pack.tornFired) { pack.tornFired = true; pack.onTorn(); }
    const hoverTilt = !TOUCH && pointer.over && pack.state === 'idle' ? V(-pointer.ndc.y * .22, pointer.ndc.x * .3, 0) : V();
    const want = pack.dragTilt ?? hoverTilt;
    pack.tilt.x = damp(pack.tilt.x, want.x, 6, dt); pack.tilt.y = damp(pack.tilt.y, want.y, 6, dt);
    pack.wiggle = damp(pack.wiggle ?? 0, 0, 3, dt);
    const g = pack.group;
    g.position.y = Math.sin(T * 1.3) * .14;
    g.rotation.set(pack.tilt.x + Math.sin(T * .8) * .03, pack.tilt.y + Math.sin(T * .55) * .1 + Math.sin(T * 30) * pack.wiggle * .06, Math.sin(T * .7) * .015);
    pack.guideU.uTime.value = T;
    pack.guideU.uOpacity.value = damp(pack.guideU.uOpacity.value, pack.dir ? 0 : .8 + pack.hover * .5, 6, dt);
  } else if (pack?.state === 'gone' || pack?.state === 'arrive') pack.update?.(dt);
  // specials glow, the tag follows its card
  stage.traverse(o => { if (o.userData?.glow && o.userData.rim) tickAura(o, dt, T); });
  placeTag();
  for (const c of summaryChips()) positionChip(c);
  particles.update(dt);
  binder.update(dt, T);
  tickWallet(dt);
  faces.pump(mode === 'box' ? 10 : 7);
  frameAvg = lerp(frameAvg, dt * 1000, .1);
  if (T > 2.5) warmOne();
  renderer.render(scene, camera);
  if (first) { first = false; window.toyboxReady?.(); if (DEMO) setTimeout(() => { window.__done = true; }, 400); }
  requestAnimationFrame(frame);
}
function* summaryChips() { for (const o of stage.children) for (const h of o.children ?? []) { const card = h.children?.[0]?.userData?.card; if (card?.chip) yield card; } }
function positionChip(card) {
  if (card.inspecting || !card.holder.visible) { card.chip.style.opacity = 0; return; }
  card.holder.updateWorldMatrix(true, false);
  const p = toScreen(V(0, -CARD_H / 2 - .05, card.mesh.position.z).applyMatrix4(card.holder.matrixWorld));
  card.chip.style.opacity = 1; card.chip.style.left = p.x + 'px'; card.chip.style.top = p.y + 'px';
}

/* ---------- warming up: draw item pictures ahead of time, one a frame, while nothing else is going on ---------- */
const warmQueue = [];
let frameAvg = 16;
function warmArt() {
  const owned = new Set(S.cards.map(k => k.split(':').slice(0, 2).join(':')));
  for (const set of SETS) for (const item of set.items) (owned.has(set.id + ':' + item.id) ? warmQueue.unshift([set, item]) : warmQueue.push([set, item]));
}
function warmOne() {
  if (!warmQueue.length || faces.pending() || frameAvg > 22) return;
  if (!(mode === 'shop' || mode === 'summary' || mode === 'binder')) return;
  const [set, item] = warmQueue.shift(), [w, h] = artSize(LO, false);
  if (!studio.has(set, item, 'art', w, h)) studio.art(set, item, 'art', w, h);
}

/* ---------- start ---------- */
// Before anything moves: print the first set's pack wrappers and compile every shader the first pack will use,
// so the pack's entrance and the first cards don't stutter. The loading bar covers this.
async function warmUp() {
  const set = packSetToOpen() || selectedSet;
  set.wrappers.forEach((_, i) => wrapperPrints(set, i));
  const tmp = new THREE.Group(), pack = new Pack(set, set.wrappers[0], wrapperPrints(set, 0));
  const card = new Card(faces), back = makeGlow('#ffffff', 1), rim = makeRim('#ffffff');
  pack.group.position.set(0, 0, -5); tmp.add(pack.group, card.mesh, back, rim);
  scene.add(tmp);
  try { await Promise.race([renderer.compileAsync ? renderer.compileAsync(scene, camera) : renderer.compile(scene, camera), new Promise(r => setTimeout(r, 2000))]); } catch {}
  scene.remove(tmp);
  // upload the big wrapper prints now rather than on the first frame that shows them
  set.wrappers.forEach((w, i) => { const P = wrapperPrints(set, i); if (!P.materials) new Pack(set, w, P).dispose(); for (const m of Object.values(P.materials)) for (const t of [m.map, m.roughnessMap]) t && renderer.initTexture(t); });
  pack.dispose(); card.dispose();
}

async function start() {
  resize();
  $('money').textContent = money(S.money);
  updateCount();
  try { await Promise.race([Promise.all(['700 40px Fredoka', '600 20px Nunito', 'italic 400 20px Nunito', '800 20px Nunito'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 2500))]); } catch {}
  await READY;
  if (DEMO) return demo();
  await warmUp();
  requestAnimationFrame(frame);
  if (S.opened === 0 && store.packsInHand() > 0 && !S.cards.length) setTimeout(() => toast('Your first pack is on the house. 🎁', 3200), 900);
  home();
  warmArt();
}
// ?demo: a still for the preview image — a fanned hand of good pulls in front of an open pack.
function demo() {
  const set = SETS[0];
  const hand = [['teddy', 0], ['duck', 1], ['piano', 3], ['robovac', 2], ['toaster', 0]].filter(([id]) => set.itemById[id]);
  S.money = 14275; for (let i = 0; i < 86; i++) S.cards.push(`${set.id}:${set.items[i % set.items.length].id}:0`);
  shownMoney = S.money; $('money').textContent = money(S.money); updateCount();
  $('hint').classList.add('off'); $('actions').textContent = '';
  const pack = new Pack(set, set.wrappers[0], wrapperPrints(set, 0));
  pack.holder = new THREE.Group(); pack.holder.add(pack.group); stage.add(pack.holder);
  const ps = Math.min(.78 * VIEW_H / PH, .34 * view.W / PW);
  pack.holder.scale.setScalar(ps); pack.holder.position.set(view.W * .27, -.3, -3); pack.holder.rotation.set(.04, -.42, .09);
  const fan = new THREE.Group(); stage.add(fan);
  const s = Math.min(.5 * VIEW_H / CARD_H, .15 * view.W / CARD_W);
  hand.forEach(([id, v], i) => {
    const c = { set: set.id, id, v };
    const card = makeCard(c, faces.get(c, HI, true));
    const k = i - (hand.length - 1) / 2, mid = k === 0;
    card.holder.position.set(k * CARD_W * .8, -Math.abs(k) * 1.5 + (mid ? .9 : 0), mid ? 1.4 : -Math.abs(k) * .25);
    card.holder.rotation.set(-.04, k * .2, -k * .16);
    if (mid) card.holder.scale.setScalar(1.14);
    fan.add(card.holder);
  });
  fan.scale.setScalar(s); fan.position.set(-view.W * .14, -.2, 1.5);
  particles.burst(V(-view.W * .14, 1.5, 3), 90, { colors: ['#ff8ad8', '#ffe38a', '#8affc8', '#8ad8ff', '#fff'], speed: 16, size: .42, life: 30, gravity: 0, drag: 5, spread: 9 });
  flash = .5;
  requestAnimationFrame(frame);
}
if (Q.has('debug')) window.__bp = { binder, scene, camera, stage, store, faces, phoneTilt, get S() { return S; }, get current() { return current; }, get mode() { return mode; } };
start();
