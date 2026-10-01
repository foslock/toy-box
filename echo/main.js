// Echo: a spelunker whose headlamp has died finds the way out of a cave by snapping, clapping and whistling, and
// seeing only what each sound's echo touches. main.js wires the pieces together: input, sounds, the tutorial voice,
// checkpoints, drowning, and the light at the end.
//
//   ?demo            a still for the toy box card (view=x,y,z,pitch,yaw and ago=whistle,clap,snap seconds tune it)
//   ?autoplay        the guide from route.js plays the whole cave        ?cp=N   start at section N (0-9)
//   ?see             the lights on, for looking at the cave itself        ?q=low|high   force phone or desktop detail
//   ?debug           window.echo for poking at it (echo.hold = true stops the clock; echo.step(n) moves it on)
import * as THREE from 'three';
import { View, KINDS, MINI } from './render.js';
import { Mesher } from './mesh.js';
import { Sim, DT, EYE } from './sim.js';
import { SECTIONS, ZONES, DRIPS, MOUTH, CLIFF_X, FINALE, march, clamp, lerp, smooth, waterLevel } from './world.js';
import { CaveAudio } from './audio.js';
import { Bot } from './route.js';
import { Daylight } from './forest.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), AUTO = Q.has('autoplay'), SEE = Q.has('see');
const TOUCH = matchMedia('(pointer: coarse)').matches;
const LOW = Q.get('q') === 'low' || (Q.get('q') !== 'high' && (TOUCH || Math.min(screen.width, screen.height) < 600));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (TOUCH) document.body.classList.add('touchy');

/* ---------- what's kept between visits ---------- */
const KEY = 'echo.v1';
const fresh = () => ({ cp: 0, seen: [], stats: { time: 0, snap: 0, clap: 0, whistle: 0 }, out: false });
let save = fresh();
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s.cp === 'number') save = { ...fresh(), ...s, stats: { ...fresh().stats, ...s.stats } }; } catch { /* storage off */ }
const keep = () => { if (DEMO || AUTO) return; try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* storage off */ } };
const seen = new Set(save.seen);
const START = Q.has('cp') ? clamp(+Q.get('cp') | 0, 0, SECTIONS.length - 1) : DEMO || AUTO ? 0 : save.out ? 0 : save.cp;

/* ---------- the pieces ---------- */
const canvas = $('c');
const view = new View(canvas, { low: LOW, see: SEE });
const mesher = new Mesher(LOW ? .4 : .35);
const sim = new Sim(START);
const audio = new CaveAudio();
const day = new Daylight(view, { low: LOW });
view.onMouthChunk = (g) => day.addRock(g);
const camera = view.camera;

let mode = 'title';            // title → play ⇄ dead → out
let clock = 0, last = performance.now(), acc = 0;
let look = { yaw: sim.p.yaw, pitch: -.05 };
const stats = save.stats;
let bot = null;

/* ---------- words ---------- */
const kb = t => `<kbd>${t}</kbd>`;
const K = {
  snap: TOUCH ? 'the <i style="--c:var(--snap)">snap</i> button' : `${kb('click')} or ${kb('Q')}`,
  clap: TOUCH ? 'the <i style="--c:var(--clap)">clap</i> button' : `${kb('right-click')} or ${kb('E')}`,
  whistle: TOUCH ? 'the <i style="--c:var(--whistle)">whistle</i> button' : `${kb('space')} or ${kb('F')}`,
  walk: TOUCH ? 'Drag on the left side to walk' : `${kb('W')} ${kb('A')} ${kb('S')} ${kb('D')} to walk`,
  look: TOUCH ? 'Drag on the right side to look around' : 'Move the mouse to look around',
  back: TOUCH ? 'tap ↺ at the top' : `hold ${kb('R')}`,
};
let line = null;               // what's on screen: { html, until, hold }
function say(html, secs = 4, hold = null) {
  line = { html, until: clock + secs, hold };
  $('say').innerHTML = html; $('say').classList.add('show');
  $('live').textContent = $('say').textContent;
}
// Say something once ever.
function once(id, html, secs, hold) { if (seen.has(id)) return false; seen.add(id); save.seen = [...seen]; keep(); say(html, secs, hold); return true; }
function drawLine() {
  if (!line) return;
  if (line.hold ? line.hold() : clock > line.until) { $('say').classList.remove('show'); line = null; }
}
let placeT = 0;
function place(name) { $('place').textContent = name; $('place').classList.add('show'); placeT = 4; }

/* ---------- sounds ---------- */
const cool = { snap: 0, clap: 0, whistle: 0 };
const used = { snap: 0, clap: 0, whistle: 0 };
const firstAt = { snap: -1, clap: -1, whistle: -1 };
const _f = new THREE.Vector3();
function eye() { return sim.eye(); }
function makeSound(kind) {
  if (mode !== 'play' && mode !== 'out') return;
  if (clock < cool[kind]) return;
  cool[kind] = clock + KINDS[kind].cool;
  const btn = { snap: 'bSnap', clap: 'bClap', whistle: 'bWhistle' }[kind];
  $(btn).classList.remove('new'); $(btn).classList.add('hit'); setTimeout(() => $(btn).classList.remove('hit'), 120);
  const p = sim.p;
  if (kind === 'whistle' && p.under) { audio.bubbles(6); view.mini(MINI.bubble, p.x, p.y + EYE, p.z, clock, { range: 1.2, speed: 3, gain: .9 }); once('nowhistle', 'You can’t whistle under water.', 3); return; }
  const [x, y, z] = eye();
  view.emit(kind, x, y, z, clock, p.under ? { scale: .6, speedK: 1.25 } : {});
  // where the walls are, for the echoes you hear
  const taps = [], range = KINDS[kind].range * (p.under ? .6 : 1), rx = Math.cos(look.yaw), rz = -Math.sin(look.yaw);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    const d = march(x, y, z, dx, 0, dz, range);
    if (d < range) taps.push([d, dx * rx + dz * rz, 1]);
  }
  const up = march(x, y, z, 0, 1, 0, range); if (up < range) taps.push([up, 0, .7]);
  audio.sound(kind, taps, p.under);
  used[kind]++; stats[kind]++;
  if (firstAt[kind] < 0) firstAt[kind] = clock;
  idle = 0;
}

/* ---------- input ---------- */
const keys = new Set();
const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', KeyD: 'r', ArrowLeft: 'tl', ArrowRight: 'tr', ShiftLeft: 'run', ShiftRight: 'run' };
const SOUNDKEY = { KeyQ: 'snap', Digit1: 'snap', KeyE: 'clap', Digit2: 'clap', Space: 'whistle', KeyF: 'whistle', Digit3: 'whistle' };
const locked = () => document.pointerLockElement === canvas;
function lock() {
  if (TOUCH || locked() || !canvas.requestPointerLock || DEMO) return;
  const plain = () => { try { canvas.requestPointerLock()?.catch?.(() => {}); } catch { /* not allowed */ } };
  try { const pr = canvas.requestPointerLock({ unadjustedMovement: true }); pr?.catch?.(plain); } catch { plain(); }
}
document.addEventListener('pointerlockchange', () => document.body.classList.toggle('locked', locked()));
function turn(dx, dy, k) { look.yaw -= dx * k; look.pitch = clamp(look.pitch - dy * k, -1.5, 1.5); turned += Math.abs(dx * k) + Math.abs(dy * k); }
let turned = 0, walked = 0, idle = 0;
addEventListener('mousemove', e => { if (locked()) turn(e.movementX, e.movementY, .0022); });
let rHeld = -1;
addEventListener('keydown', e => {
  if (mode === 'title') { if ((e.key === 'Enter' || e.key === ' ') && e.target.tagName !== 'BUTTON') { e.preventDefault(); begin(); } return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
  const k = KEYMAP[e.code];
  if (k) { keys.add(k); e.preventDefault(); }
  const s = SOUNDKEY[e.code];
  if (s) { e.preventDefault(); if (!e.repeat) makeSound(s); }
  if (e.code === 'KeyR' && !e.repeat && mode === 'play') rHeld = clock;
  if (e.code === 'KeyM') $('sound').click();
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys.delete(k); if (e.code === 'KeyR') rHeld = -1; });
addEventListener('blur', () => { keys.clear(); rHeld = -1; });

// mouse: a click takes the mouse for looking; once it's yours, left snaps, right claps, middle whistles
const drag = { id: null, x: 0, y: 0, moved: 0 };
canvas.addEventListener('pointerdown', e => {
  if (mode === 'title' || DEMO) return;
  if (e.pointerType === 'mouse') {
    if (locked()) { e.preventDefault(); makeSound(e.button === 0 ? 'snap' : e.button === 2 ? 'clap' : 'whistle'); return; }
    Object.assign(drag, { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 });
    canvas.setPointerCapture?.(e.pointerId);
    return;
  }
  // touch: left half walks, right half looks
  if (e.clientX < innerWidth * .45 && stick.id === null) {
    Object.assign(stick, { id: e.pointerId, cx: e.clientX, cy: e.clientY, x: 0, y: 0 });
    $('stick').style.left = e.clientX + 'px'; $('stick').style.top = e.clientY + 'px'; $('stick').classList.add('on');
  } else if (drag.id === null) Object.assign(drag, { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 });
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId === stick.id) {
    let dx = e.clientX - stick.cx, dy = e.clientY - stick.cy; const l = Math.hypot(dx, dy), R = 46;
    if (l > R) { dx *= R / l; dy *= R / l; }
    stick.x = dx / R; stick.y = dy / R;
    $('stick').style.setProperty('--sx', dx + 'px'); $('stick').style.setProperty('--sy', dy + 'px');
  } else if (e.pointerId === drag.id) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    turn(dx, dy, e.pointerType === 'mouse' ? .004 : .0062);
  }
});
const endPointer = e => {
  if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; $('stick').classList.remove('on'); $('stick').style.setProperty('--sx', '0px'); $('stick').style.setProperty('--sy', '0px'); }
  if (e.pointerId === drag.id) { if (e.pointerType === 'mouse' && drag.moved < 6 && mode === 'play') lock(); drag.id = null; }
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('contextmenu', e => { if (locked()) e.preventDefault(); });
const stick = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
for (const [id, kind] of [['bSnap', 'snap'], ['bClap', 'clap'], ['bWhistle', 'whistle']]) {
  $(id).addEventListener('pointerdown', e => { e.preventDefault(); makeSound(kind); });
  $(id).addEventListener('click', e => { if (e.detail === 0) makeSound(kind); });     // keyboard / switch access
}
// back to the start of this stretch: tap twice, or hold R
let armedT = 0;
$('back').addEventListener('click', () => {
  if (mode !== 'play') return;
  if (clock < armedT) { armedT = 0; $('back').classList.remove('armed'); goBack(); }
  else { armedT = clock + 3; $('back').classList.add('armed'); say(`Back to the start of this stretch? ${TOUCH ? 'Tap ↺ again.' : 'Click again.'}`, 3); }
});

/* ---------- moving and seeing ---------- */
function inputs() {
  let fx = 0, fz = 0;
  if (keys.has('f')) fz -= 1; if (keys.has('b')) fz += 1; if (keys.has('l')) fx -= 1; if (keys.has('r')) fx += 1;
  if (stick.id !== null) { fx += stick.x; fz += stick.y; }
  return { fx, fz, run: keys.has('run'), yaw: look.yaw, pitch: look.pitch };
}
let bob = 0;
function placeCamera(dt) {
  const p = sim.p;
  const sp = Math.hypot(p.vx, p.vz);
  if (p.ground && !p.swim) bob += sp * dt * 2.3; else bob += dt * (p.swim ? 1.2 : 0);
  const amp = REDUCED ? 0 : p.swim ? .03 : Math.min(1, sp / 2.6) * .035;
  camera.position.set(p.x, p.y + EYE + Math.sin(bob * 2) * amp * .8 - (p.swim ? 0 : amp * .5), p.z);
  camera.rotation.set(look.pitch, look.yaw, p.swim ? Math.sin(bob) * .02 : Math.sin(bob) * amp * .25);
}

/* ---------- the tutorial, and other things that happen ---------- */
const sec = () => sim.cp;
let secT = 0;
const hasSound = k => used[k] > 0 || seen.has('used-' + k);
function showButtons() {
  const n = Math.max(sim.cp, save.cp);
  $('bSnap').hidden = false;
  $('bClap').hidden = !(n >= 1 && (seen.has('clap') || n >= 2));
  $('bWhistle').hidden = !(n >= 3 && (seen.has('whistle') || n >= 4));
}
function teach(dt) {
  const p = sim.p;
  secT += dt; idle += dt;
  // the very start: dark, then the snap
  if (sec() === 0 && !hasSound('snap')) {
    if (secT > 1.2 && secT < 1.3 && !line) say('Your headlamp is dead. It’s completely dark.', 3.6);
    if (secT > 5 && !line) { say(`Snap your fingers<span class="k">${K.snap}</span>`, 99, () => used.snap > 0); $('bSnap').classList.add('new'); }
  }
  if (used.snap > 0 && !seen.has('used-snap')) { seen.add('used-snap'); save.seen = [...seen]; keep(); }
  if (firstAt.snap >= 0 && clock - firstAt.snap > 2.2 && walked < 1.5) once('walk', K.walk, 99, () => walked > 2.5);
  if (walked > 6 && turned < .6) once('look', K.look, 6, () => turned > 1.2);
  if (sec() === 0 && walked > 14 && idle > 7) once('again', `Snap as you go. The ripple only shows what it reaches.<span class="k">${K.snap}</span>`, 5);
  // the hall: too big for a snap
  const Z = ZONES;
  const inHall = sec() >= 1 && ((p.x - Z.hall.x) / Z.hall.rx) ** 2 + ((p.z - Z.hall.z) / Z.hall.rz) ** 2 < 1 && p.x > 41;
  if (inHall && !hasSound('clap')) {
    if (once('clap', `A big room: a snap fades before it finds the far walls. Clap<span class="k">${K.clap}</span>`, 99, () => used.clap > 0)) { $('bClap').hidden = false; $('bClap').classList.add('new'); }
  }
  if (used.clap > 0 && !seen.has('used-clap')) { seen.add('used-clap'); save.seen = [...seen]; keep(); }
  if (firstAt.clap >= 0 && clock - firstAt.clap > 2.4 && sec() <= 2) once('echo', 'Walls send the ripple back to you. Openings don’t.', 5);
  // the gallery: too big for a clap
  const G = Z.gallery;
  if (sec() >= 3 && p.x > G.x0 && p.x < G.x1 && p.z > G.z0 && p.z < G.z1 && !hasSound('whistle')) {
    if (once('whistle', `Even a clap won’t carry this far. Whistle<span class="k">${K.whistle}</span>`, 99, () => used.whistle > 0)) { $('bWhistle').hidden = false; $('bWhistle').classList.add('new'); }
  }
  if (used.whistle > 0 && !seen.has('used-whistle')) { seen.add('used-whistle'); save.seen = [...seen]; keep(); }
  if (firstAt.whistle >= 0 && clock - firstAt.whistle > 2.5 && sec() === 3) once('fidelity', 'The farther a sound carries, the less it shows you.', 5);
  // water
  if (sec() === 4 && Math.hypot(p.x - Z.shore.x, p.z - Z.shore.z) < Z.shore.r) once('water', 'The passage carries on under the water.', 5);
  if (p.under) once('breath', `Hold your breath, and swim the way you look.<span class="k">Snap and clap still work down here, muffled.</span>`, 5);
  if (sec() === 7 && Math.hypot(p.x - Z.shore2.x, p.z - Z.shore2.z) < Z.shore2.r) once('swim2', 'A long way under this time. Listen for air on the way.', 5);
  // loose rock
  if (sec() >= 5 && sec() <= 8) for (const r of sim.rocks) {
    const d = Math.hypot(r.x - p.x, r.z - p.z);
    if (d < 4.5 && lastLit(r)) once('push', 'Striped rock is loose. Walk into it to push it.', 6);
  }
  if (Math.hypot(p.x - Z.rim.x, p.z - Z.rim.z) < Z.rim.r) { rimT += dt; if (rimT > 1.2) once('gap', 'Too wide to step across.', 4); } else rimT = 0;
  if (p.stuckT > 1.5) once('stuck', `No way out of here. To go back to the start of this stretch, ${K.back}.`, 7, () => p.stuckT === 0);
  if (secT > 170 && sec() > 0 && sec() < 9) once('lost' + sec(), `Lost? To go back to the start of this stretch, ${K.back}.`, 6);
}
let rimT = 0;
function lastLit(r) {         // a loose rock is "seen" if a pulse front has crossed it in the last moment
  for (let i = 0; i < view.cubes.length; i++) {
    const c = view.cubes[i], P = view.U.uP.value[i], k = view.U.uK.value[i];
    if (k.w < 0 || clock - c.t0 > c.life) continue;
    const R = (clock - P.w) * k.x, d = Math.hypot(r.x - P.x, r.y - P.y, r.z - P.z);
    if (d < k.y && Math.abs(R - d) < 1) return true;
  }
  return false;
}

function events() {
  for (const e of sim.drain()) {
    if (e.type === 'step') {
      const water = e.water;
      view.mini(water ? MINI.splash : MINI.step, e.x, e.y + .03, e.z, clock, { range: water ? 2.2 : 2.1, speed: water ? 3.6 : 4.4, gain: water ? 1.1 : 1.25 });
      audio.step(water, e.under); walked += .78;
    } else if (e.type === 'stroke') {
      view.mini(MINI.bubble, e.x, e.y + EYE - .2, e.z, clock, { range: 1.5, speed: 3.2, gain: .7 });
      audio.bubbles(2);
    } else if (e.type === 'bump') {
      // a small ring on whatever stopped you, from just in front of it so the surface faces it
      const [x, y, z] = e.at, [nx, ny, nz] = e.n;
      view.mini(MINI.bump, x + nx * .3, y + ny * .3, z + nz * .3, clock, { range: .85, speed: 2.4, gain: e.rock ? .45 : .3 }); audio.bump();
      if (e.rock) { const L = view.loose[sim.rocks.indexOf(e.rock)]; if (L) L.glow = Math.max(L.glow, .5); }   // and a stuck rock's outline flickers
    } else if (e.type === 'thud') {
      view.mini(MINI.grind, e.rock.x, e.rock.y - .45, e.rock.z, clock, { range: 3.2, speed: 4, gain: 1 }); audio.thud();
    } else if (e.type === 'dive') audio.dive();
    else if (e.type === 'surface') audio.surface(e.breath < .6 ? 1 - e.breath : 0);
    else if (e.type === 'cp') {
      save.cp = Math.max(save.cp, e.cp); keep(); secT = 0; place(SECTIONS[e.cp].name); showButtons();
    } else if (e.type === 'drown') drown();
    else if (e.type === 'land') audio.bump();
  }
}
const drowned = {};
function drown() {
  if (mode !== 'play') return;
  mode = 'dead'; deadT = 0;
  say('Out of air…', 2.2);
  drowned[sim.cp] = (drowned[sim.cp] || 0) + 1;
}
let deadT = 0;
function goBack(note = 'Back at the start of this stretch.') {
  sim.spawn(sim.cp);
  look.yaw = sim.p.yaw; look.pitch = -.05;
  bob = 0; secT = 0;
  place(SECTIONS[sim.cp].name);
  say(note, note.length > 60 ? 6 : 3.5);
  if (bot) bot.restartSection(sim.cp);
}

/* ---------- drips: little ripples that say "here" ---------- */
const drips = DRIPS.map(d => ({ ...d, next: Math.random() * 3 }));
function drip(dt) {
  const [x, y, z] = eye();
  for (const d of drips) {
    if ((d.next -= dt) > 0) continue;
    d.next = 2.4 + Math.random() * 3;
    const dist = Math.hypot(d.x - x, d.y - y, d.z - z);
    if (dist > 30) continue;
    const wet = waterLevel(d.x, d.z) !== null && Math.abs(waterLevel(d.x, d.z) - d.y) < .1;
    view.mini(MINI.drip, d.x, d.y + .02, d.z, clock, { range: wet ? 2.4 : 2, speed: 2.6, gain: 1 });
    audio.drip(d.x, d.y, d.z, sim.p.under);
  }
}

/* ---------- the light at the end ---------- */
const fin = { on: false, adapt: 0, trig: false, outT: 0, ended: false };
function finale(dt) {
  const p = sim.p, look_ = { exposure: 1, white: 0, echo: 1 };
  const dm = Math.hypot(p.x - MOUTH.x, p.y + EYE - MOUTH.y, p.z - MOUTH.z);
  if (!fin.on && (sim.cp >= 9 && p.x > FINALE.start[0] - 8 || p.x > CLIFF_X - 40)) { fin.on = true; day.build(); view.litOn = true; }
  if (!fin.on) return look_;
  if (!fin.trig && (dm < 4.2 || p.x > CLIFF_X - 2)) { fin.trig = true; audio.dawn(); }
  if (fin.trig) fin.adapt = Math.min(1, fin.adapt + dt / 4.8);
  const a = smooth(0, 1, fin.adapt);
  const glare = smooth(10, 4.2, dm);
  look_.exposure = lerp(fin.trig ? 2.2 : lerp(1, 2.2, smooth(24, 4.2, dm)), 1.05, a);
  look_.white = fin.trig ? Math.max(0, 1 - smooth(.08, .7, fin.adapt)) : glare * glare * .95;
  look_.echo = 1 - smooth(0, .5, fin.adapt);
  look_.blow = 1 - smooth(.1, .75, fin.adapt);
  look_.glare = fin.trig ? .9 * (1 - smooth(0, .8, fin.adapt)) : .25 + .65 * smooth(30, 4, dm);
  if (p.x > CLIFF_X + 6) {
    if (mode === 'play') { mode = 'out'; save.out = true; save.cp = 0; keep(); }
    fin.outT += dt;
    if (fin.outT > 6 && !fin.ended) { fin.ended = true; showEnd(); }
  }
  return look_;
}
function showEnd() {
  const s = stats, m = Math.floor(s.time / 60), ss = Math.floor(s.time % 60);
  $('sTime').textContent = `${m}:${String(ss).padStart(2, '0')}`;
  $('sSnaps').textContent = s.snap; $('sClaps').textContent = s.clap; $('sWhistles').textContent = s.whistle;
  if (locked()) document.exitPointerLock?.();
  $('end').hidden = false;
}
$('stay').addEventListener('click', () => { $('end').hidden = true; if (!TOUCH) lock(); });
$('again').addEventListener('click', () => { save = fresh(); save.seen = [...seen]; keep(); location.href = location.pathname; });

/* ---------- starting ---------- */
function begin(fromTop = false) {
  if (mode !== 'title') return;
  if (fromTop || save.out) {                            // a new descent: progress and counts start again
    save.cp = 0; save.out = false; Object.assign(stats, fresh().stats); save.stats = stats; keep();
    if (sim.cp !== 0) { sim.spawn(0); look.yaw = sim.p.yaw; }
  }
  mode = 'play';
  try { audio.start(); } catch (e) { console.warn('no sound:', e); }
  lock();
  document.body.classList.add('playing');
  $('card').classList.add('leaving');
  setTimeout(() => { $('card').hidden = true; }, 1200);
  canvas.focus({ preventScroll: true });
  secT = 0; showButtons();
  if (sim.cp > 0) { place(SECTIONS[sim.cp].name); say('You pick up where you left off.', 3); }
  if (AUTO) bot = new Bot(sim, sim.cp);
}
$('go').addEventListener('click', () => begin());
$('restart').addEventListener('click', () => begin(true));
if (START > 0 && !Q.has('cp')) { $('go').textContent = 'Carry on'; $('restart').hidden = false; $('fine').textContent = `From ${SECTIONS[START].name}. Best with headphones.`; }
function applyMute(m) {
  audio.setMuted(m);
  $('sound').setAttribute('aria-pressed', String(m)); $('sound').setAttribute('aria-label', m ? 'Unmute' : 'Mute');
  $('waves').style.display = m ? 'none' : ''; $('cross').style.display = m ? '' : 'none';
}
applyMute((() => { try { return localStorage.getItem('echo.muted') === '1'; } catch { return false; } })());
$('sound').onclick = () => { const m = !audio.muted; applyMute(m); try { localStorage.setItem('echo.muted', m ? '1' : '0'); } catch { /* storage off */ } };
document.addEventListener('visibilitychange', () => { audio.suspend(document.hidden); if (document.hidden && mode === 'play') keep(); });

/* ---------- the loop ---------- */
addEventListener('resize', () => view.resize());
let frameAvg = 16, perfT = 0;
let held = false;                       // ?debug: echo.hold = true stops the clock so tests can step it by hand
function frame(now) { if (!held) tick(now); requestAnimationFrame(frame); }
function tick(now) {
  const raw = Math.max(0, now - last) / 1000, dt = Math.min(.1, raw); last = now;
  clock += dt;
  // build the cave around you, a slice at a time
  if (mesher.left) {
    const [x, y, z] = eye();
    view.addChunks(mesher.step(mode === 'title' ? 24 : 7, x, y, z));
  } else if (!day.built && (sim.cp >= 8 || DEMO)) { day.build(); view.renderer.compile(view.lit, camera); }   // ready before the bend

  if (mode === 'play' || mode === 'out') {
    if (bot?.done) bot = null;                           // the guide is done: hands back to you
    if (bot) { const b = bot.input(DT); look.yaw = b.yaw; look.pitch = b.pitch; if (b.say) makeSound(b.say); botIn = b; }
    acc += dt;
    while (acc >= DT) { sim.step(bot ? botIn : inputs()); acc -= DT; if (bot && acc >= DT) { const b = bot.input(DT); look.yaw = b.yaw; look.pitch = b.pitch; botIn = b; } }
    if (mode === 'play') stats.time += dt;
    events();
    if (mode === 'play') teach(dt);
    drip(dt);
    // hold R to go back
    if (rHeld >= 0) {
      const k = (clock - rHeld) / .8;
      $('resetHold').classList.add('show'); $('resetFg').setAttribute('stroke-dashoffset', String(176 * (1 - Math.min(1, k))));
      if (k >= 1) { rHeld = -1; goBack(); }
    } else $('resetHold').classList.remove('show');
    if (armedT && clock > armedT) { armedT = 0; $('back').classList.remove('armed'); }
    const tl = (keys.has('tl') ? 1 : 0) - (keys.has('tr') ? 1 : 0);
    if (tl) { look.yaw += tl * 1.9 * dt; turned += Math.abs(tl * 1.9 * dt); }
  } else if (mode === 'dead') {
    deadT += dt;
    if (deadT > 2.2) {
      mode = 'play';
      goBack(drowned[sim.cp] >= 2 ? 'Back at the start, coughing. Snap under water to see the way on; the water’s surface means air.' : 'You come to at the start of the stretch, coughing.');
    }
  }
  placeCamera(dt);
  const p = sim.p;
  // the breath ring
  const showBreath = (mode === 'play' || mode === 'dead') && (p.under || p.breath < .999);
  $('breath').classList.toggle('show', showBreath);
  $('breathFg').setAttribute('stroke-dashoffset', String(119.4 * (1 - p.breath)));
  $('breath').classList.toggle('low', p.breath < .3);
  if (p.under && p.breath < .35 && mode === 'play') { hbT -= dt; if (hbT <= 0) { hbT = .5 + p.breath * 1.6; audio.heartbeat(1 - p.breath / .35); } }
  if (placeT > 0 && (placeT -= dt) <= 0) $('place').classList.remove('show');
  drawLine();
  for (const [id, k] of [['bSnap', 'snap'], ['bClap', 'clap'], ['bWhistle', 'whistle']]) $(id).classList.toggle('cool', clock < cool[k]);

  // loose rocks and their outlines
  sim.rocks.forEach((r, i) => view.placeLoose(i, r.x, r.y, r.z, r.speed > .1 || !r.grounded, dt, clock));
  const grind = Math.max(0, ...sim.rocks.map(r => r.speed));
  for (const r of sim.rocks) if (r.speed > .3 && (r.gT = (r.gT || 0) - dt) <= 0) { r.gT = .38; view.mini(MINI.grind, r.x, r.y - .45, r.z, clock, { range: 1.9, speed: 4, gain: .75 }); }

  const look_ = finale(dt);
  if (mode === 'dead') { look_.vig = smooth(0, 1.5, deadT); look_.echo = 1 - smooth(.5, 2, deadT); }
  else look_.vig = p.under ? smooth(.35, 0, p.breath) * .8 : 0;
  look_.under = p.under ? 1 : 0;
  day.update(clock, dt, fin.on ? 1 - smooth(.1, .8, fin.adapt) : 0);
  camera.updateMatrixWorld();
  camera.getWorldDirection(_f);
  const lvl = waterLevel(p.x, p.z);
  audio.update([camera.position.x, camera.position.y, camera.position.z], [_f.x, _f.y, _f.z], [0, 1, 0], {
    under: p.under, grind: grind / 1.25, wind: fin.on ? smooth(70, 6, Math.hypot(p.x - MOUTH.x, p.z - MOUTH.z)) * (1 - fin.adapt * .6) : 0,
    outside: smooth(.2, 1, fin.adapt) * (p.x > CLIFF_X - 6 ? 1 : .5), water: lvl !== null && !p.under ? smooth(14, 3, Math.abs(lvl - p.y)) * .6 : 0,
  });
  view.frame(clock, look_);

  // keep the frame rate up by trading resolution
  if (raw < .1) { frameAvg = lerp(frameAvg, raw * 1000, .05); perfT += dt; }
  if (perfT > 2.5 && !DEMO) {
    perfT = 0;
    if (frameAvg > 24 && view.pr > .6) { view.pr = Math.max(.6, view.pr - .15); view.resize(); }
    else if (frameAvg < 14 && view.pr < view.maxPR) { view.pr = Math.min(view.maxPR, view.pr + .1); view.resize(); }
  }
}
let botIn = null, hbT = 0;

/* ---------- ?demo: a still for the toy box card ---------- */
if (DEMO) {
  $('card').hidden = true; mode = 'demo';
  while (mesher.left) view.addChunks(mesher.step(1000, 74, -10, -164));
  // view=x,y,z,pitch,yaw (eye position); the three numbers in `ago` are how long ago the whistle, clap and snap went off
  const v = (Q.get('view') || '83,-6.3,-63,-.12,.25').split(',').map(Number);
  sim.p.x = v[0]; sim.p.y = v[1] - EYE; sim.p.z = v[2]; look = { yaw: v[4], pitch: v[3] };
  const [tw, tc, ts] = (Q.get('ago') || '1.25,.85,.45').split(',').map(Number);
  clock = 100;
  if (tw > 0) view.emit('whistle', v[0], v[1], v[2], clock - tw);
  if (tc > 0) view.emit('clap', v[0], v[1], v[2], clock - tc);
  if (ts > 0) view.emit('snap', v[0], v[1], v[2], clock - ts);
  sim.rocks.forEach((r, i) => view.placeLoose(i, r.x, r.y, r.z, false, 0, clock));
  const freeze = () => { placeCamera(0); camera.updateMatrixWorld(); view.frame(clock, { exposure: 1 }); requestAnimationFrame(freeze); };
  requestAnimationFrame(freeze);
} else {
  if (SEE) { while (mesher.left) view.addChunks(mesher.step(1000, ...eye())); }
  requestAnimationFrame(frame);
}
window.toyboxReady?.();
if (Q.has('debug') || AUTO) window.echo = { sim, view, mesher, audio, look, makeSound, get mode() { return mode; }, set mode(m) { mode = m; }, begin, goBack, fin, day, get clock() { return clock; },
  step(n = 1, ms = 16.7) { for (let i = 0; i < n; i++) tick(last + ms); }, get bot() { return bot; }, set hold(h) { held = h; last = performance.now(); } };
