// Sound Garden: walk a walled garden in first person, switch on the eight speakers hidden in it, then sit in the
// chair in the middle and listen to them all at once.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { U, SUN, SUN_COLOR, Q, LOW, TOUCH, REDUCED, clamp, lerp, damp, smooth, gust } from './common.js';
import * as L from './layout.js';
import { buildGround } from './ground.js';
import { buildHedges } from './hedges.js';
import { buildSpeakers } from './speakers.js';
import { buildFeatures } from './features.js';
import { buildPlants } from './plants.js';
import { buildWater } from './water.js';
import { buildCritters } from './critters.js';
import { GardenAudio, SEAT_EAR } from './audio.js';
import { PARTS } from './music.js';

const $ = id => document.getElementById(id);
const DEMO = Q.has('demo');            // ?demo: a still view over the garden with every speaker lit (for the preview image)
const EYE = 1.64;                      // eye height standing
const REACH = 2.5;                     // how far you can reach a button from your eyes
const store = {
  get: k => { try { return localStorage.getItem('soundgarden.' + k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem('soundgarden.' + k, v); } catch {} },
};
if (TOUCH) document.body.classList.add('touchy');

/* ---------- renderer, sky and light ---------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const MAX_PR = Math.min(devicePixelRatio, LOW ? 1.5 : 2);
let pixelRatio = Math.min(MAX_PR, 1.5);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .86;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, .04, 1200);
camera.rotation.order = 'YXZ';

const sky = new Sky();
sky.scale.setScalar(2000);
const su = sky.material.uniforms;
su.turbidity.value = 2.6; su.rayleigh.value = 1.15; su.mieCoefficient.value = .0036; su.mieDirectionalG.value = .84;
su.sunPosition.value.copy(SUN);
sky.material.fragmentShader = sky.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * .72, 1.0 );');
scene.add(sky);
// Fair-weather cumulus drifting over, lit warm from the low sun.
const clouds = new THREE.Mesh(new THREE.SphereGeometry(1500, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({
  uniforms: { uTime: U.uTime, uSun: { value: SUN }, uSunCol: { value: SUN_COLOR } },
  transparent: true, depthWrite: false, side: THREE.BackSide,
  vertexShader: `varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
  fragmentShader: `
    uniform float uTime; uniform vec3 uSun, uSunCol; varying vec3 vDir;
    float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 6; i++) { s += a * n(p); p = p * 2.03 + 1.7; a *= .5; } return s; }
    void main() {
      vec3 d = normalize(vDir);
      if (d.y < .01) discard;
      vec2 p = d.xz / (d.y + .1) * 1.2 + vec2(uTime * .0035, uTime * .0012);
      float c = fbm(p * 1.25 + fbm(p * .4) * .6) - .1 * smoothstep(.2, .9, d.y), cov = smoothstep(.56, .8, c);
      float thick = smoothstep(.56, .92, c), sunward = pow(max(dot(d, uSun), 0.), 2.5);
      float edge = cov * (1. - thick);                                   // thin edges catch the light
      vec3 col = mix(vec3(1., .985, .96), vec3(.58, .62, .7), thick * .75) * (.95 + .45 * sunward) + uSunCol * edge * (.35 + .8 * sunward);
      col *= mix(vec3(1.), uSunCol * 1.15, .3);
      float a = cov * smoothstep(.01, .16, d.y) * .92;
      gl_FragColor = vec4(col * 1.35, a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
clouds.frustumCulled = false;
scene.add(clouds);
{ // reflections and ambient light come from the same sky, over a grassy ground
  const pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene(), s2 = new Sky();
  s2.scale.setScalar(50);
  for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) s2.material.uniforms[k].value = su[k].value;
  s2.material.uniforms.sunPosition.value.copy(SUN);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({ color: 0x3b4a26 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1;
  env.add(s2, floor);
  scene.environment = pm.fromScene(env, .02, .1, 200).texture;
  scene.environmentIntensity = .7;
}
const sun = new THREE.DirectionalLight(SUN_COLOR, 3.1);
sun.castShadow = true;
sun.shadow.mapSize.set(LOW ? 2048 : 4096, LOW ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 34, bottom: -34, near: 1, far: 170 });
sun.shadow.bias = -.00025; sun.shadow.normalBias = .035;
sun.position.copy(SUN).multiplyScalar(85); sun.target.position.set(0, 0, 0);
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xc4d8f0, 0x4d5a30, 1.05));
scene.fog = new THREE.Fog(0xc6d3dc, 80, 560);

/* ---------- the garden ---------- */
const ground = buildGround(scene);
buildHedges(scene);
const features = buildFeatures(scene);
const plants = buildPlants(scene);
const water = buildWater(scene);
const speakers = buildSpeakers(scene);
const critters = buildCritters(scene, plants.flowers);
const audio = new GardenAudio();
const PART = Object.fromEntries(PARTS.map(p => [p.id, p]));

/* ---------- you ---------- */
// Camera yaw looks along (-sin yaw, -cos yaw); objects in the plan face (sin yaw, cos yaw), hence the + π.
const me = { x: L.START.x, z: L.START.z, y: 0, yaw: L.START.yaw + Math.PI, pitch: -.04, vx: 0, vz: 0, speed: 0, bob: 0 };
const SEAT = { x: L.CHAIR.x - Math.sin(L.CHAIR.yaw) * .1, y: SEAT_EAR, z: L.CHAIR.z - Math.cos(L.CHAIR.yaw) * .1, yaw: L.CHAIR.yaw + Math.PI };
let mode = 'intro';                   // intro → flying → walk ⇄ sitting → seated → standing → walk
let modeT = 0;
const found = new Set(JSON.parse(store.get('found') || '[]'));
const on = new Set();
let allDone = false;

/* ---------- looking: pointer lock with a crosshair, or dragging ---------- */
const keys = new Set();
const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', KeyD: 'r', ArrowLeft: 'tl', ArrowRight: 'tr', ShiftLeft: 'run', ShiftRight: 'run' };
const locked = () => document.pointerLockElement === canvas;
function lock() {
  if (TOUCH || locked() || !canvas.requestPointerLock) return;
  const plain = () => { try { canvas.requestPointerLock()?.catch?.(() => {}); } catch {} };
  try { const p = canvas.requestPointerLock({ unadjustedMovement: true }); p?.catch?.(plain); } catch { plain(); }
}
document.addEventListener('pointerlockchange', () => { document.body.classList.toggle('locked', locked()); });
function turn(dx, dy, k) {
  me.yaw -= dx * k;
  me.pitch = clamp(me.pitch - dy * k, -1.45, 1.4);
}
addEventListener('mousemove', e => { if (locked()) turn(e.movementX, e.movementY, .0021); });

addEventListener('keydown', e => {
  if (mode === 'intro') { if ((e.key === 'Enter' || e.key === ' ') && e.target.tagName !== 'BUTTON') { e.preventDefault(); enter(); } return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
  const k = KEYMAP[e.code];
  if (k) { keys.add(k); e.preventDefault(); if (mode === 'seated' && (k === 'f' || k === 'b' || k === 'l' || k === 'r')) stand(); }
  if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) act(); }
  if (e.code === 'KeyM') $('sound').click();
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys.delete(k); });
addEventListener('blur', () => keys.clear());

const drag = { id: null, x: 0, y: 0, t: 0, moved: 0 };
canvas.addEventListener('pointerdown', e => {
  if (mode === 'intro' || mode === 'flying' || mode === 'demo') return;
  if (locked()) { if (e.button === 0) act(); return; }                    // with the crosshair, a click presses what you look at
  if (drag.id !== null) return;
  Object.assign(drag, { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 });
  canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (drag.id === e.pointerId) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    turn(dx, dy, TOUCH ? .0055 : .0036);
    canvas.classList.toggle('dragging', drag.moved > 4);
  } else if (e.pointerType === 'mouse' && !locked() && mode !== 'intro') {
    const t = aimAt(e.clientX, e.clientY);
    canvas.classList.toggle('pointing', !!t);
  }
});
const endDrag = e => {
  if (drag.id !== e.pointerId) return;
  drag.id = null; canvas.classList.remove('dragging');
  if (drag.moved < (TOUCH ? 14 : 6) && performance.now() - drag.t < 600) {
    const t = aimAt(e.clientX, e.clientY);
    if (t) act(t);
    else if (!TOUCH && mode !== 'demo') lock();                          // a plain click on the garden takes the mouse for looking
  }
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', e => { if (drag.id === e.pointerId) { drag.id = null; canvas.classList.remove('dragging'); } });
canvas.addEventListener('contextmenu', e => e.preventDefault());

// the touch pad: drag from its middle to walk
const stick = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
const moveStick = e => {
  if (stick.id !== e.pointerId) return;
  let dx = e.clientX - stick.cx, dy = e.clientY - stick.cy; const l = Math.hypot(dx, dy), R = 44;
  if (l > R) { dx *= R / l; dy *= R / l; }
  stick.x = dx / R; stick.y = dy / R;
  $('stick').style.setProperty('--sx', dx + 'px'); $('stick').style.setProperty('--sy', dy + 'px');
};
$('stick').addEventListener('pointerdown', e => {
  const r = $('stick').getBoundingClientRect();
  Object.assign(stick, { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2, x: 0, y: 0 });
  $('stick').setPointerCapture(e.pointerId); moveStick(e);
  if (mode === 'seated') stand();
});
$('stick').addEventListener('pointermove', moveStick);
const endStick = e => { if (stick.id !== e.pointerId) return; stick.id = null; stick.x = stick.y = 0; $('stick').style.setProperty('--sx', '0px'); $('stick').style.setProperty('--sy', '0px'); };
$('stick').addEventListener('pointerup', endStick); $('stick').addEventListener('pointercancel', endStick);
$('act').addEventListener('click', () => act());

/* ---------- what you're looking at ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), _v = new THREE.Vector3(), _f = new THREE.Vector3();
const hits = speakers.map(s => s.hit);
function reach(s) { return camera.position.distanceTo(s.where); }
const nearChair = () => Math.hypot(camera.position.x - L.CHAIR.x, camera.position.z - L.CHAIR.z) < 2.4;
// The thing under the screen point (cx, cy), or under the crosshair when cx is undefined.
function aimAt(cx, cy) {
  if (mode !== 'walk' && mode !== 'seated') return null;
  if (cx === undefined) ndc.set(0, 0);
  else { const r = canvas.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1); }
  ray.setFromCamera(ndc, camera);
  if (mode === 'seated') return null;
  const h = ray.intersectObjects([...hits, features.chairHit], false)[0];
  if (!h) return null;
  if (h.object === features.chairHit) return nearChair() ? 'chair' : null;
  const s = speakers.find(s => s.hit === h.object);
  return s && reach(s) < REACH ? s : null;
}
// Pressing E: whatever the crosshair is on, or failing that the button nearest the middle of your view within reach.
function target() {
  if (mode === 'seated') return 'stand';
  if (mode !== 'walk') return null;
  const direct = aimAt();
  if (direct) return direct;
  camera.getWorldDirection(_f);
  let best = null, bestA = .62;
  for (const s of speakers) {
    if (reach(s) > REACH) continue;
    const a = _v.subVectors(s.where, camera.position).normalize().angleTo(_f);
    if (a < bestA) { bestA = a; best = s; }
  }
  if (!best && nearChair()) {
    const a = _v.set(L.CHAIR.x - camera.position.x, .5 - camera.position.y, L.CHAIR.z - camera.position.z).normalize().angleTo(_f);
    if (a < .9) best = 'chair';
  }
  return best;
}
function act(t = target()) {
  if (!t) return;
  if (t === 'stand') return stand();
  if (t === 'chair') return sit();
  toggle(t);
}
function toggle(s) {
  const now = !s.on;
  s.on = now; s.press();
  audio.click(s.sp, now);
  audio.set(s.sp.part, now);
  if (now) on.add(s.sp.part); else on.delete(s.sp.part);
  if (now) { found.add(s.sp.part); store.set('found', JSON.stringify([...found])); }
  const n = on.size, name = PART[s.sp.part].name;
  if (now && n === PARTS.length && !allDone) { allDone = true; toast('All eight are playing', 'Take the chair in the middle, where they meet', 6); }
  else toast(now ? name : name + ' off', `${n} of ${PARTS.length} playing`);
  say(`${name} ${now ? 'on' : 'off'}. ${n} of ${PARTS.length} playing.`);
  drawParts();
}
const sitFrom = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
function sit() {
  if (mode !== 'walk') return;
  mode = 'sitting'; modeT = 0;
  Object.assign(sitFrom, { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw: me.yaw, pitch: me.pitch });
  document.body.classList.add('seated');
  say('Sitting in the chair, where every part arrives together. Look around; press E to stand up.');
}
function stand() {
  if (mode !== 'seated') return;
  mode = 'standing'; modeT = 0;
  Object.assign(sitFrom, { x: camera.position.x, y: camera.position.y, z: camera.position.z });
  document.body.classList.remove('seated');
}

/* ---------- words on screen ---------- */
function say(t) { $('live').textContent = t; }
let toastTimer = 0;
function toast(name, note, secs = 3.2) {
  $('toastName').textContent = name; $('toastNote').textContent = note;
  $('toast').classList.add('show'); toastTimer = secs;
}
let idleHint = 18;
const kb = t => `<kbd>${t}</kbd>`;
function hintFor(t) {
  if (mode === 'seated') return TOUCH ? 'Drag to look around · tap <b>Stand</b> to get up' : `${locked() ? 'Move the mouse' : 'Drag'} to look around · ${kb('E')} or ${kb('W')} to stand up`;
  if (mode !== 'walk') return '';
  const press = TOUCH ? 'Tap' : locked() ? `${kb('E')} or click` : `${kb('E')} or click the button`;
  if (t === 'chair') return TOUCH ? 'Tap <b>Sit</b> to take the chair' : `${kb('E')} to sit in the chair`;
  if (t) return `${press} to switch ${t.on ? 'off' : 'on'} the <b>${PART[t.sp.part].name.toLowerCase()}</b>`;
  if (idleHint > 0) return TOUCH ? 'Drag the pad to walk · drag anywhere to look' : locked()
    ? `${kb('W')} ${kb('A')} ${kb('S')} ${kb('D')} to walk · move the mouse to look · ${kb('Shift')} to hurry`
    : `${kb('W')} ${kb('A')} ${kb('S')} ${kb('D')} to walk · drag to look, or click to look with the mouse`;
  return '';
}
let shownHint = null;
function drawHint(t) {
  const h = hintFor(t);
  if (h !== shownHint) { shownHint = h; if (h) $('hint').innerHTML = h; $('hint').classList.toggle('quiet', !h); }
  const label = t === 'chair' ? 'Sit' : t === 'stand' ? 'Stand' : t ? (t.on ? 'Switch off' : 'Switch on') : '';
  if ($('act').textContent !== label) $('act').textContent = label;
  $('act').hidden = !label;
  document.body.classList.toggle('aiming', !!t && t !== 'stand');
}
function drawParts() {
  const ol = $('parts');
  if (!ol.children.length) for (const p of PARTS) {
    const li = document.createElement('li'); li.style.setProperty('--c', p.color);
    li.innerHTML = `<i></i><span>${p.name}</span>`; li.title = p.name; ol.append(li);
  }
  PARTS.forEach((p, i) => { const li = ol.children[i]; li.classList.toggle('on', on.has(p.id)); li.classList.toggle('found', found.has(p.id)); });
  $('count').textContent = `${on.size} of ${PARTS.length} playing`;
}

/* ---------- moving ---------- */
function walk(dt) {
  let fx = 0, fz = 0;
  if (keys.has('f')) fz -= 1; if (keys.has('b')) fz += 1; if (keys.has('l')) fx -= 1; if (keys.has('r')) fx += 1;
  if (stick.id !== null) { fx += stick.x; fz += stick.y; }
  const tn = (keys.has('tl') ? 1 : 0) - (keys.has('tr') ? 1 : 0);
  if (tn) me.yaw += tn * 1.8 * dt;
  const l = Math.hypot(fx, fz);
  if (l > 1) { fx /= l; fz /= l; }
  const top = keys.has('run') ? 4.2 : 2.3, sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
  const tvx = (fx * cy + fz * sy) * top, tvz = (-fx * sy + fz * cy) * top;
  me.vx = damp(me.vx, tvx, 7, dt); me.vz = damp(me.vz, tvz, 7, dt);
  const [cx, cz] = L.collide(me.x + me.vx * dt, me.z + me.vz * dt, .3);
  const moved = Math.hypot(cx - me.x, cz - me.z);
  me.speed = damp(me.speed, moved / Math.max(dt, 1e-4), 10, dt);
  me.x = cx; me.z = cz;
  me.y = damp(me.y, L.groundY(me.x, me.z), 12, dt);
  if (l > .1 || tn) idleHint = Math.min(idleHint, 5);
}
// A walker's head rises and falls a little with each step; each footfall makes a sound.
let stepSide = 1;
function footsteps(dt) {
  const w = smooth(.2, 1.4, me.speed), stride = lerp(1.25, 1.7, clamp((me.speed - 2) / 2, 0, 1));
  const prev = me.bob;
  me.bob += me.speed / stride * Math.PI * 2 * dt;
  if (w > .2 && Math.floor(prev / Math.PI) !== Math.floor(me.bob / Math.PI)) {
    stepSide = -stepSide;
    audio.step(surfaceAt(me.x, me.z), stepSide, clamp(me.speed / 3, .45, 1.2));
  }
  if (REDUCED) return [0, 0];
  return [(-Math.abs(Math.cos(me.bob)) * .045 + .02) * w, Math.sin(me.bob) * .018 * w];
}
const surfaceAt = (x, z) => Math.hypot(x - L.CHAIR.x, z - L.CHAIR.z) < L.PLATFORM.step ? 'stone' : features.surfaceAt?.(x, z) || ground.surface(x, z);

/* ---------- the loop ---------- */
function resize() {
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const _fwd = new THREE.Vector3(), _up = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _focus = new THREE.Vector3(), _feet = new THREE.Vector3();
const fly = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
function introCamera(t) {                                   // a slow drift over the garden while you read the card
  const a = .6 + t * .018, r = 33, h = 27 + Math.sin(t * .05) * 2.5;
  camera.position.set(Math.sin(a) * r, h, Math.cos(a) * r);
  camera.lookAt(0, -3, 0);
}
let last = performance.now(), clock = 0, frameAvg = 16, perfT = 0;
function frame(now) { tick(now); requestAnimationFrame(frame); }
function tick(now) {
  const raw = Math.max(0, now - last) / 1000, dt = Math.min(.05, raw); last = now; clock += dt;
  U.uTime.value = clock; U.uGust.value = gust(clock);
  modeT += dt;

  if (mode === 'intro') introCamera(clock);
  else if (mode === 'flying') {                             // down from the sky to your own eyes, inside the gate
    const k = smooth(0, 1, modeT / 3);
    camera.position.lerpVectors(fly.p, _v.set(me.x, L.groundY(me.x, me.z) + EYE, me.z), k);
    camera.quaternion.slerpQuaternions(fly.q, _q1.setFromEuler(_e.set(me.pitch, me.yaw, 0)), smooth(.15, 1, modeT / 3));
    if (modeT >= 3) { mode = 'walk'; camera.rotation.set(me.pitch, me.yaw, 0); }
  } else if (mode === 'walk') {
    walk(dt);
    const [bob, sway] = footsteps(dt);
    const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
    camera.position.set(me.x + cy * sway, me.y + EYE + bob, me.z - sy * sway);
    camera.rotation.set(me.pitch, me.yaw, 0);
  } else if (mode === 'sitting') {                          // lower yourself into the chair, turning to face the way it faces
    const k = smooth(0, 1, modeT / 1.6);
    camera.position.set(lerp(sitFrom.x, SEAT.x, k), lerp(sitFrom.y, SEAT.y, k) + Math.sin(Math.PI * k) * .08, lerp(sitFrom.z, SEAT.z, k));
    let d = SEAT.yaw - sitFrom.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    me.yaw = sitFrom.yaw + d * k; me.pitch = lerp(sitFrom.pitch, -.03, k);
    camera.rotation.set(me.pitch, me.yaw, 0);
    if (modeT >= 1.6) mode = 'seated';
  } else if (mode === 'seated') {
    const breathe = REDUCED ? 0 : Math.sin(clock * 1.3) * .005;
    camera.position.set(SEAT.x, SEAT.y + breathe, SEAT.z);
    camera.rotation.set(me.pitch, me.yaw, 0);
  } else if (mode === 'standing') {                         // up, and a step forward off the chair
    const k = smooth(0, 1, modeT / 1.1), sy = Math.sin(L.CHAIR.yaw), cy = Math.cos(L.CHAIR.yaw);
    me.x = SEAT.x + sy * .95 * k; me.z = SEAT.z + cy * .95 * k; me.y = L.groundY(me.x, me.z);
    camera.position.set(lerp(sitFrom.x, me.x, k), lerp(sitFrom.y, me.y + EYE, k), lerp(sitFrom.z, me.z, k));
    camera.rotation.set(me.pitch, me.yaw, 0);
    if (modeT >= 1.1) { mode = 'walk'; me.vx = me.vz = 0; }
  }

  clouds.position.copy(camera.position);

  // your ears are where your eyes are
  camera.updateMatrixWorld();
  camera.getWorldDirection(_fwd); _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const p = camera.position;
  audio.update([p.x, p.y, p.z], _fwd, _up, dt, clock);

  // the garden
  const fl = _v.copy(_fwd).setY(0).normalize();
  ground.update(_focus.set(p.x + fl.x * 4, 0, p.z + fl.z * 4), _feet.set(me.x, mode === 'walk' ? 0 : -99, me.z));
  for (const s of speakers) s.update(clock, audio.levels[s.sp.part] || 0, dt);
  features.update?.(clock, dt);
  plants.update?.(clock, dt, camera);
  water.update?.(clock, dt);
  critters.update?.(clock, dt, camera);

  // words
  const t = target();
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) $('toast').classList.remove('show');
  if (mode === 'walk' && idleHint > 0) idleHint -= dt;
  drawHint(t);

  renderer.render(scene, camera);

  // keep the frame rate up: trade resolution for smoothness
  if (raw < .1) { frameAvg = lerp(frameAvg, raw * 1000, .05); perfT += dt; }     // a hidden tab's long gaps aren't slow frames
  if (perfT > 2 && !DEMO) {
    perfT = 0;
    if (frameAvg > 24 && pixelRatio > .7) { pixelRatio = Math.max(.7, pixelRatio - .15); resize(); }
    else if (frameAvg < 13 && pixelRatio < MAX_PR) { pixelRatio = Math.min(MAX_PR, pixelRatio + .1); resize(); }
  }
}

/* ---------- starting ---------- */
function enter() {
  if (mode !== 'intro') return;
  document.body.classList.add('playing');
  audio.start(clock);
  lock();
  $('card').classList.add('leaving');
  setTimeout(() => { $('card').hidden = true; }, 900);
  fly.p.copy(camera.position); fly.q.copy(camera.quaternion);
  mode = 'flying'; modeT = 0;
  canvas.focus({ preventScroll: true });
  if (Q.has('all')) for (const s of speakers) toggle(s);
  if (Q.has('seat')) setTimeout(() => { me.x = L.CHAIR.x + 1.4; me.z = L.CHAIR.z; me.y = 0; mode = 'walk'; sit(); }, 3100);
}
$('go').addEventListener('click', enter);
$('keys').innerHTML = TOUCH
  ? `<dt>Walk</dt><dd>the pad, bottom left</dd><dt>Look</dt><dd>drag anywhere</dd><dt>Press</dt><dd>tap a speaker’s button</dd><dt>Sit</dt><dd>tap the chair in the middle</dd>`
  : `<dt>Walk</dt><dd>${kb('W')} ${kb('A')} ${kb('S')} ${kb('D')} or the arrows, ${kb('Shift')} to hurry</dd><dt>Look</dt><dd>move the mouse (${kb('Esc')} lets it go), or drag</dd><dt>Press</dt><dd>look at a speaker’s button and click, or ${kb('E')}</dd><dt>Sit</dt><dd>${kb('E')} at the chair in the middle</dd>`;

function applyMute(m) {
  audio.setMuted(m);
  $('sound').setAttribute('aria-pressed', String(m)); $('sound').setAttribute('aria-label', m ? 'Unmute' : 'Mute');
  $('waves').style.display = m ? 'none' : ''; $('cross').style.display = m ? '' : 'none';
}
applyMute(store.get('muted') === '1');
$('sound').onclick = () => { const m = !audio.muted; applyMute(m); store.set('muted', m ? '1' : '0'); };
document.addEventListener('visibilitychange', () => audio.suspend(document.hidden));
drawParts();

if (DEMO) {
  $('card').hidden = true; mode = 'demo';
  for (const s of speakers) s.on = true;
  PARTS.forEach(p => on.add(p.id)); drawParts();
  if (Q.has('view')) { const v = Q.get('view').split(',').map(Number); camera.position.set(v[0], v[1], v[2]); camera.rotation.set(v[3], v[4], 0); }
  else {                                                     // the card's picture: over the gate, down the lavender walk to the chair
    const v = (Q.get('from') || '-4,12.5,36').split(',').map(Number), l = (Q.get('look') || '1.5,-1,-2').split(',').map(Number);
    camera.position.set(...v); camera.lookAt(...l);
  }
  $('hint').classList.add('quiet');
}
if (Q.has('debug')) window.sg = { me, camera, audio, speakers, keys, get mode() { return mode; }, set mode(m) { mode = m; }, toggle, sit, stand, act, target, scene, renderer, enter,
  step(n = 1, ms = 16.7) { for (let i = 0; i < n; i++) tick(last + ms); } };
requestAnimationFrame(frame);
window.toyboxReady?.();                                      // clears the Toy Box loading bar once that first frame is up
