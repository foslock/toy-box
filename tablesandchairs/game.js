// Tables & Chairs: stack each table and chair on the last, as high as it will go.
// The physics is 2D (planck.js), so the tower can only tip left or right; the furniture and the world are
// 3D (three.js). Only the bottom table may touch the ground. The music follows the height.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Vec2 } from 'planck';
import { BASE_F, basePiece, nextPiece, mulberry, posedParts } from './pieces.js';
import { G, STEP, createWorld, addBody, step, bodyPolys, placePolys, clearance, polysBounds } from './stack.js';
import { buildModel, disposeModel } from './models.js';
import { Sound } from './music.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const metres = u => (Math.max(0, u) / 10).toFixed(2);

const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');     // ?demo: a tower already stands, no title card or sound (for the preview image)
const AUTO = params.has('auto');     // ?auto: it stacks itself
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(pointer: coarse)').matches;
const store = {
  get: k => { try { return localStorage.getItem('tablesandchairs.' + k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem('tablesandchairs.' + k, v); } catch {} },
};

// How the tower's height turns into heat for the music and the sky: calm at the bottom, flat out by about 13 m.
const heatFor = top => clamp(Math.pow(Math.max(0, top - 7.5) / 125, .85), 0, 1);

/* ---------- renderer and scene ---------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .92;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
scene.environmentIntensity = .35;
scene.fog = new THREE.Fog(0xf7e4d0, 700, 3400);
const FOV = 32, PITCH = .1, YAW = .17;
const camera = new THREE.PerspectiveCamera(FOV, 1, .5, 8000);

const hemi = new THREE.HemisphereLight(0xd4e8ff, 0x8b9a62, 1.15);
const sun = new THREE.DirectionalLight(0xfff0d2, 2.7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -.0003;
scene.add(hemi, sun, sun.target);

// The sky follows the heat: a soft morning, then golden hour, then a red sunset, then a black-red night with stars.
const SKY = [
  { top: '#5d9be0', mid: '#f4e2d0', bot: '#dfe8cf', sun: '#fff0d2', sunI: 2.5, lightY: 1.1, hemiS: '#cfe4ff', hemiG: '#7d8f55', hemiI: 1, cloud: '#ffffff', grass: '#6d9c44', stars: 0 },
  { top: '#4a7fcf', mid: '#ffd296', bot: '#e3d3a4', sun: '#ffd49a', sunI: 2.5, lightY: .8, hemiS: '#ffe2c2', hemiG: '#7e7a4c', hemiI: .95, cloud: '#ffe7cf', grass: '#6f8f42', stars: 0 },
  { top: '#2c2865', mid: '#ff8658', bot: '#8c5a50', sun: '#ff9a62', sunI: 2.3, lightY: .55, hemiS: '#c4a2d0', hemiG: '#5e4c3c', hemiI: .95, cloud: '#eea99c', grass: '#687e44', stars: .35 },
  { top: '#07040d', mid: '#7a1222', bot: '#1c0d10', sun: '#ff4a30', sunI: 2.1, lightY: .42, hemiS: '#8a6a9a', hemiG: '#2c1c1c', hemiI: .85, cloud: '#6e3a46', grass: '#3b3b2a', stars: 1 },
].map(k => Object.fromEntries(Object.entries(k).map(([n, v]) => [n, typeof v === 'string' ? new THREE.Color(v) : v])));

const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uSun: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3() }, uStars: { value: 0 }, uFlash: { value: 0 } },
  vertexShader: `varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }`,
  fragmentShader: `
    uniform vec3 uTop, uMid, uBot, uSun, uSunDir; uniform float uStars, uFlash; varying vec3 vDir;
    float hash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    void main() {
      vec3 d = normalize(vDir); float h = d.y;
      vec3 c = h > 0. ? mix(uMid, uTop, pow(clamp(h, 0., 1.), .5)) : mix(uMid, uBot, clamp(-h * 5., 0., 1.));
      float s = max(dot(d, uSunDir), 0.);
      c += uSun * (smoothstep(.9986, .9994, s) * 3. + pow(s, 14.) * .35 + pow(s, 3.) * .12);
      c += vec3(step(.9972, hash(floor(d * 320.))) * smoothstep(.04, .35, h) * uStars * .9);
      c = mix(c, vec3(.92, .88, 1.), uFlash * .35);
      gl_FragColor = vec4(c, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }` }));
sky.renderOrder = -1;
scene.add(sky);

function canvasTexture(w, h, paint, repeat = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function speckle(g, w, h, n, R, colors, size) {
  for (let i = 0; i < n; i++) { g.fillStyle = colors[R() * colors.length | 0]; const s = size * (.5 + R()); g.fillRect(R() * w, R() * h, s, s * (1 + R() * 2)); }
}
const grassMat = new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 5000, mulberry(4), ['#bbbbbb', '#e8e8e8', '#c9c9c9', '#f4f4f4', '#aaaaaa'], 2);
}, 420) });
const lawn = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), grassMat);
lawn.rotation.x = -Math.PI / 2; lawn.position.y = -.02; lawn.receiveShadow = true;
scene.add(lawn);
// A raked gravel garden under the tower, ringed with stones.
const gravel = new THREE.Mesh(new THREE.CircleGeometry(34, 96), new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTexture(1024, 1024, (g, w) => {
  const R = mulberry(8), img = g.createImageData(w, w), d = img.data;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const r = Math.hypot(x - w / 2, y - w / 2) / (w / 2), rake = Math.sin(r * 34 * Math.PI) * .5 + .5;
    let v = 206 + rake * 30 - R() * 26;
    if (r > .93) v = 120 + R() * 50;
    const i = (y * w + x) * 4; d[i] = v; d[i + 1] = v * .97; d[i + 2] = v * .9; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}) }));
gravel.rotation.x = -Math.PI / 2; gravel.receiveShadow = true;
scene.add(gravel);

// Trees and far hills, for a sense of how high the tower has got.
{
  const R = mulberry(77), trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: .9 });
  const leaves = ['#5f8f45', '#4f7d3c', '#77a052', '#3f6b36', '#86a84a'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .9, flatShading: true }));
  const trunk = new THREE.CylinderGeometry(.5, .7, 1, 7).translate(0, .5, 0), ball = new THREE.IcosahedronGeometry(1, 1), cone = new THREE.ConeGeometry(1, 1, 8).translate(0, .5, 0);
  for (let i = 0; i < 70; i++) {
    const x = (R() - .5) * 1800, z = -150 - R() * 900;
    if (Math.abs(x) < 160 && z > -320) continue;
    const h = 30 + R() * 70, t = new THREE.Mesh(trunk, trunkMat);
    t.scale.set(h * .05, h * .5, h * .05); t.position.set(x, 0, z); scene.add(t);
    const f = new THREE.Mesh(R() < .4 ? cone : ball, leaves[R() * leaves.length | 0]);
    if (f.geometry === cone) { f.scale.set(h * .28, h * .85, h * .28); f.position.set(x, h * .18, z); }
    else { f.scale.set(h * .36, h * .4, h * .36); f.position.set(x, h * .62, z); f.rotation.y = R() * 6; }
    scene.add(f);
  }
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x6f9a5a, roughness: 1, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), hillMat);
    hill.scale.set(500 + R() * 900, 140 + R() * 260, 300 + R() * 300);
    hill.position.set((i - 4) * 700 + (R() - .5) * 300, -40, -1900 - R() * 900);
    scene.add(hill);
  }
}

// Clouds at every height, drifting.
const clouds = [];
{
  const R = mulberry(31), texes = [0, 1, 2].map(s => canvasTexture(256, 128, (g, w, h) => {
    const Q = mulberry(s * 13 + 5);
    for (let i = 0; i < 16; i++) {
      const x = 40 + Q() * 176, y = 58 + (Q() - .5) * 34 - (1 - Math.abs(x - 128) / 128) * 14, r = 18 + Q() * 30;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.6, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }));
  for (let i = 0; i < 70; i++) {
    const m = new THREE.SpriteMaterial({ map: texes[i % 3], transparent: true, depthWrite: false, opacity: .9 });
    const s = new THREE.Sprite(m), w = 90 + R() * 220;
    s.scale.set(w, w * .5, 1);
    s.position.set((R() - .5) * 2200, 30 + Math.pow(R(), .7) * 1600, -450 - R() * 1100);
    s.userData.v = 1 + R() * 3;
    clouds.push(s); scene.add(s);
  }
}

// Beams under the held piece's feet when one is hanging over a gap; red when it would reach the ground.
const beamMats = [new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .35, depthWrite: false }),
  new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: .55, depthWrite: false })];
const beams = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), beamMats[0]); m.visible = false; scene.add(m); return m; });

/* ---------- queue thumbnails: a second little renderer ---------- */
const TW = 264, TH = 198;
const thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
thumbR.setPixelRatio(1); thumbR.setSize(TW, TH, false);
thumbR.toneMapping = THREE.ACESFilmicToneMapping; thumbR.toneMappingExposure = 1.05;
const thumbScene = new THREE.Scene();
thumbScene.environment = new THREE.PMREMGenerator(thumbR).fromScene(new RoomEnvironment(), .04).texture;
thumbScene.environmentIntensity = .5;
thumbScene.add(new THREE.HemisphereLight(0xfff6e8, 0x9a8a74, 1.4));
{ const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-3, 5, 6); thumbScene.add(key); }
const thumbCam = new THREE.PerspectiveCamera(26, TW / TH, .1, 5000);
const slots = [0, 1, 2].map(() => {
  const li = document.createElement('li'), cv = document.createElement('canvas'), nm = document.createElement('span'), sz = document.createElement('span');
  cv.width = TW; cv.height = TH; nm.className = 'nm'; sz.className = 'sz';
  li.append(cv, nm, sz); $('queue').append(li);
  return { cv, nm, sz, piece: null };
});
const _box = new THREE.Box3(), _c = new THREE.Vector3(), _s = new THREE.Vector3();
function renderThumb(p, cv) {
  const g = p.model.group;
  g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.scale.set(1, 1, 1);
  thumbScene.add(g); g.updateMatrixWorld(true);
  _box.setFromObject(g); _box.getCenter(_c); _box.getSize(_s);
  const r = Math.max(_s.x * .62, _s.y * .75) + _s.z * .12, dist = r / Math.tan(13 * Math.PI / 180);
  thumbCam.position.set(_c.x + dist * .4, _c.y + dist * .24, _c.z + dist * .88);
  thumbCam.lookAt(_c); thumbCam.near = dist * .05; thumbCam.far = dist * 4; thumbCam.updateProjectionMatrix();
  thumbR.render(thumbScene, thumbCam);
  const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, TW, TH); ctx.drawImage(thumbR.domElement, 0, 0);
  thumbScene.remove(g);
}
function drawQueue() {
  slots.forEach((s, i) => {
    const p = queue[i];
    if (!p || s.piece === p) return;
    s.piece = p; renderThumb(p, s.cv);
    s.nm.textContent = p.name;
    s.sz.textContent = `${Math.round((p.maxX - p.minX) * 10)} cm wide`;
  });
}

/* ---------- the game ---------- */
const { world, ground } = createWorld();
let fell = null;
world.on('begin-contact', c => {
  const a = c.getFixtureA().getBody(), b = c.getFixtureB().getBody();
  const rec = (a === ground ? b : b === ground ? a : null)?.getUserData();
  if (rec && rec.p && !rec.isBase && !fell) fell = rec;
});

const sound = new Sound();
let R, pieces = [], queue = [], recent = [], lastSpec = null, held = null;
let state = 'intro', count = 0, runBest = 0, best = +store.get('best') || 0;
let heatTarget = 0, skyHeat = 0, dropT = 0, overT = 0, lastRun = null, zoom = 1, flash = 0, nextFlash = 8;
let polys = [], towerB = { x0: -8, x1: 8, y0: 0, y1: 8 };
const cam = { x: 0, y: 12, span: 30, fx: 0, ready: false };

function clearAll() {
  for (const r of pieces) { world.destroyBody(r.body); scene.remove(r.group); disposeModel(r.group); }
  for (const p of queue) disposeModel(p.model.group);
  if (held) { scene.remove(held.group); disposeModel(held.group); }
  pieces = []; queue = []; recent = []; held = null; fell = null;
  for (const s of slots) s.piece = null;
}
function newGame(seed) {
  clearAll();
  R = mulberry(seed ?? (Math.random() * 2 ** 31 | 0));
  const base = basePiece(R);
  base.model = buildModel(base);
  addPlaced(base, false, 0, 0, 0, true);
  recent.push(base); lastSpec = base;
  count = 0; runBest = 0; heatTarget = 0; dropT = 0;
  sound.music?.reset();
  refresh();
  refill(); takeNext();
  cam.ready = false;
}
function addPlaced(p, flip, turn, x, y, isBase = false) {
  const body = addBody(world, p, flip, turn, x, y);
  const rec = { p, body, group: p.model.group, color: p.model.color, flip, isBase, pv: null, kt: 0 };
  body.setUserData(rec);
  rec.group.scale.x = flip ? -1 : 1;
  pieces.push(rec); scene.add(rec.group);
  return rec;
}
function refill() {
  while (queue.length < 3) {
    const p = nextPiece(lastSpec, recent, R);
    p.model = buildModel(p);
    recent.push(p); queue.push(p); lastSpec = p;
  }
  drawQueue();
}
function takeNext() {
  const p = queue.shift();
  refill();
  held = { p, group: p.model.group, flip: false, turn: 0, cx: platformCentre(pieces.at(-1)), x: 0, y: null };
  setPose(held);
  held.group.position.set(held.cx, towerB.y1 + 20, 0);
  scene.add(held.group);
}
// cx is the middle of the piece's outline, so flipping or turning it keeps it where it was.
function setPose(h) {
  h.posed = posedParts(h.p, h.flip, h.turn);
  h.local = polysBounds(h.posed.map(q => q.v));
  h.group.scale.x = h.flip ? -1 : 1;
  h.group.rotation.z = h.turn * Math.PI / 2;
}
function platformCentre(rec) {
  const pl = rec.p.platform, m = rec.flip ? -1 : 1;
  return rec.body.getWorldPoint(Vec2((pl.x0 + pl.x1) / 2 * m, pl.y)).x;
}
function flip() { if (state === 'aim' && held) { held.flip = !held.flip; setPose(held); held.y = null; } }
function turn(d) { if (state === 'aim' && held) { held.turn = (held.turn + d + 4) % 4; setPose(held); held.y = null; } }

// This frame's outlines of everything standing, and their bounds.
function refresh() {
  polys = [];
  for (const r of pieces) { r.polys = bodyPolys(r.body); for (const q of r.polys) polys.push(q); }
  towerB = polysBounds(polys);
}

// Where the held piece hovers: lowered until it would just touch whatever is under it, then lifted a hair.
// It jumps up at once (so it never overlaps anything) and eases down.
function placeHeld(dt, snap = false) {
  const h = held, L = h.local, w = L.x1 - L.x0, ht = L.y1 - L.y0;
  h.cx = clamp(h.cx, towerB.x0 - w / 2 - 1.5, towerB.x1 + w / 2 + 1.5);
  const ox = h.cx - (L.x0 + L.x1) / 2;
  const { need } = clearance(placePolys(h.posed, ox, 0), polys);
  const last = pieces.at(-1).p;
  const reach = Math.max(ht * 1.6, last.H * 1.1, 4);
  const target = Math.max(need + Math.max(.2, ht * .035), towerB.y1 - reach - L.y0);
  h.y = h.y == null || snap || target > h.y ? target : damp(h.y, target, 14, dt);
  h.x = ox;
  h.group.position.set(ox, h.y, 0);
}

function drop() {
  if (state !== 'aim' || !held) return;
  const h = held; held = null;
  addPlaced(h.p, h.flip, h.turn, h.x, h.y);
  state = 'drop'; dropT = 0;
  for (const b of beams) b.visible = false;
  updateButtons();
}

function settled() {
  count++;
  runBest = Math.max(runBest, towerB.y1);
  heatTarget = heatFor(runBest);
  if (sound.music) sound.music.target = heatTarget;
  sound.sfx?.placed(count);
  const p = pieces.at(-1).p;
  say(`${p.name} placed. The tower is ${metres(towerB.y1)} metres tall.`);
  takeNext();
  state = 'aim';
  updateButtons();
  if (count >= 4) $('hint').hidden = true;
}

function topple() {
  const who = fell.p.name;
  state = 'over'; overT = 0;
  if (held) { scene.remove(held.group); disposeModel(held.group); held = null; }
  for (const b of beams) b.visible = false;
  sound.music?.fall();
  const isNew = runBest > best + .05;
  if (isNew) { best = runBest; store.set('best', best.toFixed(2)); }
  lastRun = { height: runBest, count, isNew, who };
  say(`The ${who.toLowerCase()} hit the ground. The tower reached ${metres(runBest)} metres with ${count} pieces.`);
  updateButtons();
}

// Picks where to drop the held piece so its feet sit in the middle of the last piece's top or seat.
function autoAim(h) {
  const last = pieces.at(-1), pl = last.p.platform, m = last.flip ? -1 : 1;
  const a = last.body.getWorldPoint(Vec2(pl.x0 * m, pl.y)), b = last.body.getWorldPoint(Vec2(pl.x1 * m, pl.y));
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), py = Math.max(a.y, b.y), mid = (x0 + x1) / 2;
  const L = h.local, foot = (h.p.fx0 + h.p.fx1) / 2 * (h.flip ? -1 : 1) - (L.x0 + L.x1) / 2;
  let bestX = null, bestD = Infinity;
  for (let k = 0; k <= 120; k++) {
    const cx = x0 - 2 + (x1 - x0 + 4) * k / 120;
    const { need } = clearance(placePolys(h.posed, cx - (L.x0 + L.x1) / 2, 0), polys);
    if (Math.abs(need + L.y0 - py) > .03 * (L.y1 - L.y0) + .08) continue;
    const d = Math.abs(cx + foot - mid);
    if (d < bestD) { bestD = d; bestX = cx; }
  }
  return bestX;
}

/* ---------- sound effects from the physics ---------- */
function knocks(dt) {
  if (!sound.sfx) return;
  const now = performance.now(), thr0 = 3 + G * dt;
  let budget = 3;
  for (const r of pieces) {
    const b = r.body, v = b.getLinearVelocity(), w = b.getAngularVelocity();
    if (r.pv && b.isAwake()) {
      const dv = Math.hypot(v.x - r.pv[0], v.y - r.pv[1]) + Math.abs(w - r.pv[2]) * r.p.F * .3;
      const size = clamp(r.p.F / BASE_F, 0, 1), thr = thr0 + size * 2;
      if (dv > thr && now - r.kt > 90 && budget > 0) { sound.sfx.knock(clamp((dv - thr) / 30, .06, 1), size); r.kt = now; budget--; }
    }
    r.pv = [v.x, v.y, w];
  }
}

/* ---------- camera ---------- */
function updateCamera(dt) {
  const aspect = innerWidth / innerHeight;
  let top, bottom, halfW, tx;
  if (state === 'over') {
    const near = polysBounds(polys.filter(p => Math.abs(p[0][0]) < 250));
    tx = (near.x0 + near.x1) / 2; top = Math.max(near.y1, 12) + 5; bottom = -3; halfW = (near.x1 - near.x0) / 2 + 8;
  } else {
    const L = held ? held.local : { x0: -5, x1: 5, y0: 0, y1: 8 }, size = Math.max(L.x1 - L.x0, L.y1 - L.y0);
    const heldTop = held && held.y != null ? held.y + L.y1 : 0;
    top = Math.max(heldTop, towerB.y1) + Math.max(3, size * .7);
    bottom = top - clamp(top + 3, 26, Math.max(26, size * 10));
    cam.fx = damp(cam.fx, pieces.length ? platformCentre(pieces.at(-1)) : 0, 2, dt);
    tx = cam.fx; halfW = Math.max(size * 2.3, 11);
  }
  let span = (top - bottom) * zoom;
  if (span * aspect < halfW * 2) span = halfW * 2 / aspect;
  let ty = Math.max(top - span / 2 - (zoom - 1) * span * .1, span / 2 - 3);
  if (state === 'over') ty = Math.max(bottom + span / 2, span / 2 - 3);
  if (!cam.ready) { cam.x = tx; cam.y = ty; cam.span = span; cam.ready = true; }
  const k = state === 'over' ? 1.4 : 3;
  cam.x = damp(cam.x, tx, k, dt); cam.y = damp(cam.y, ty, k, dt); cam.span = damp(cam.span, span, k, dt);
  const dist = cam.span / 2 / Math.tan(FOV * Math.PI / 360);
  camera.position.set(cam.x + Math.sin(YAW) * dist, cam.y + Math.sin(PITCH) * dist, Math.cos(YAW) * Math.cos(PITCH) * dist);
  camera.lookAt(cam.x, cam.y, 0);
  camera.near = dist * .05; camera.far = dist + 7000; camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
  // shadows cover what's on screen
  const S = cam.span * .72 * Math.max(1, aspect), sc = sun.shadow.camera;
  sun.target.position.set(cam.x, cam.y, 0);
  sun.position.copy(sun.target.position).addScaledVector(lightDir, 300 + S);
  sc.left = sc.bottom = -S; sc.right = sc.top = S; sc.near = 1; sc.far = 600 + S * 3; sc.updateProjectionMatrix();
  sun.shadow.normalBias = S * .0012;
}

/* ---------- sky and light ---------- */
const lightDir = new THREE.Vector3(), _col = new THREE.Color();
function mixKey(name, h, out) {
  const f = h * (SKY.length - 1), i = Math.min(SKY.length - 2, Math.floor(f)), t = f - i, a = SKY[i][name], b = SKY[i + 1][name];
  return out ? out.copy(a).lerp(b, t) : lerp(a, b, t);
}
function applySky(h) {
  const u = sky.material.uniforms;
  mixKey('top', h, u.uTop.value); mixKey('mid', h, u.uMid.value); mixKey('bot', h, u.uBot.value); mixKey('sun', h, u.uSun.value);
  u.uStars.value = mixKey('stars', h); u.uFlash.value = flash;
  const sy = lerp(.5, .05, h);
  u.uSunDir.value.set(-.45, sy, -1).normalize();
  scene.fog.color.copy(u.uMid.value);
  mixKey('hemiS', h, hemi.color); mixKey('hemiG', h, hemi.groundColor); hemi.intensity = mixKey('hemiI', h) + flash * 1.4;
  mixKey('sun', h, sun.color); sun.intensity = mixKey('sunI', h);
  lightDir.set(-.55, mixKey('lightY', h), .75).normalize();
  mixKey('grass', h, grassMat.color);
  mixKey('cloud', h, _col);
  for (const c of clouds) c.material.color.copy(_col);
  document.body.style.setProperty('--heat', h.toFixed(3));
}

/* ---------- the tower map ---------- */
const map = $('map'), mg = map.getContext('2d');
let mapMid = 0;
const hex = c => '#' + c.toString(16).padStart(6, '0');
function drawMap(dt) {
  const dpr = Math.min(devicePixelRatio, 2), w = map.clientWidth, h = map.clientHeight;
  if (!w || !h) return;
  if (map.width !== Math.round(w * dpr) || map.height !== Math.round(h * dpr)) { map.width = Math.round(w * dpr); map.height = Math.round(h * dpr); }
  mg.setTransform(dpr, 0, 0, dpr, 0, 0); mg.clearRect(0, 0, w, h);
  const heldTop = held && held.y != null ? held.y + held.local.y1 : 0;
  const top = Math.max(towerB.y1, heldTop, best, 30) * 1.08, pad = 8;
  mapMid = damp(mapMid, (towerB.x0 + towerB.x1) / 2, 2, dt);
  const s = Math.min((h - pad * 2) / top, (w - 8) / Math.max(24, (towerB.x1 - towerB.x0) * 1.2));
  const X = x => w / 2 + (x - mapMid) * s, Y = y => h - pad - y * s;
  const path = poly => { mg.beginPath(); poly.forEach(([x, y], i) => i ? mg.lineTo(X(x), Y(y)) : mg.moveTo(X(x), Y(y))); mg.closePath(); };
  if (best > 0) {
    mg.strokeStyle = 'rgba(200, 50, 44, .75)'; mg.setLineDash([3, 3]); mg.lineWidth = 1;
    mg.beginPath(); mg.moveTo(4, Y(best)); mg.lineTo(w - 4, Y(best)); mg.stroke(); mg.setLineDash([]);
  }
  mg.fillStyle = 'rgba(47, 38, 32, .3)'; mg.fillRect(4, Y(0), w - 8, 1.5);
  for (const r of pieces) { mg.fillStyle = hex(r.color); for (const q of r.polys || []) { path(q); mg.fill(); } }
  if (held && held.y != null) {
    mg.fillStyle = 'rgba(255, 255, 255, .85)';
    for (const q of placePolys(held.posed, held.x, held.y)) { path(q); mg.fill(); }
  }
  // the part of the tower on screen
  const y0 = cam.y - cam.span / 2, y1 = cam.y + cam.span / 2;
  mg.strokeStyle = 'rgba(47, 38, 32, .35)'; mg.lineWidth = 1;
  mg.strokeRect(3.5, Math.max(2, Y(y1)), w - 7, Math.min(h - 4, Y(y0)) - Math.max(2, Y(y1)));
}

/* ---------- beams under hanging feet ---------- */
function updateBeams() {
  let i = 0;
  if (held && state === 'aim' && held.y != null) {
    const placed = placePolys(held.posed, held.x, held.y);
    let minY = Infinity;
    for (const q of placed) for (const [, y] of q) minY = Math.min(minY, y);
    const tol = (held.local.y1 - held.local.y0) * .02 + .02;
    for (const q of placed) {
      let a = Infinity, b = -Infinity;
      for (const [x, y] of q) if (y < minY + tol) { a = Math.min(a, x); b = Math.max(b, x); }
      if (a > b || i >= beams.length) continue;
      const x = (a + b) / 2, w = Math.max(b - a, .12);
      let hitY = -1, onGround = true, first = 1;
      world.rayCast(Vec2(x, minY - .001), Vec2(x, -1), (f, pt, n, frac) => { if (frac < first) { first = frac; hitY = pt.y; onGround = f.getBody() === ground; } return frac; });
      const len = minY - hitY;
      if (len < .6 && !onGround) continue;
      const m = beams[i++];
      m.visible = true; m.material = beamMats[onGround ? 1 : 0];
      m.scale.set(w * .5, len, w * .5); m.position.set(x, (minY + hitY) / 2, 0);
    }
  }
  for (; i < beams.length; i++) beams[i].visible = false;
}

/* ---------- input ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), zPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), _hit = new THREE.Vector3();
function worldX(cx, cy) {
  const r = canvas.getBoundingClientRect();
  ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(zPlane, _hit) ? _hit.x : null;
}
const pointer = { x: 0, y: 0, mouse: false, down: null };
const keys = { left: 0, right: 0, fine: 0 };
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  if (e.pointerType === 'mouse') { pointer.mouse = true; return; }
  const d = pointer.down;
  if (d && d.id === e.pointerId && held && state === 'aim') {
    const a = worldX(d.lx, d.ly), b = worldX(e.clientX, e.clientY);
    if (a != null && b != null) held.cx += b - a;
  }
  if (d) { d.lx = e.clientX; d.ly = e.clientY; }
});
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') pointer.mouse = false; });
canvas.addEventListener('pointerdown', e => {
  pointer.down = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), button: e.button };
  if (e.pointerType !== 'mouse') pointer.mouse = false;
  canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointerup', e => {
  const d = pointer.down; pointer.down = null;
  if (!d || d.id !== e.pointerId || d.button !== 0) return;
  const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
  if (e.pointerType === 'mouse' ? moved < 14 : moved < 10 && performance.now() - d.t < 450) drop();
});
canvas.addEventListener('pointercancel', () => { pointer.down = null; });
canvas.addEventListener('contextmenu', e => { e.preventDefault(); flip(); });
canvas.addEventListener('wheel', e => { e.preventDefault(); zoom = clamp(zoom * Math.exp(e.deltaY * .0012), .75, 3); }, { passive: false });
addEventListener('keydown', e => {
  if (!$('card').hidden) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.tagName !== 'BUTTON') { e.preventDefault(); $('go').click(); }
    return;
  }
  if (e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  switch (e.key) {
    case 'ArrowLeft': case 'a': case 'A': keys.left = 1; pointer.mouse = false; e.preventDefault(); break;
    case 'ArrowRight': case 'd': case 'D': keys.right = 1; pointer.mouse = false; e.preventDefault(); break;
    case ' ': case 'Enter': case 'ArrowDown': case 's': case 'S': e.preventDefault(); if (!e.repeat) drop(); break;
    case 'f': case 'F': flip(); break;
    case 'r': case 'R': case 'e': case 'E': case 'ArrowUp': e.preventDefault(); turn(1); break;
    case 'q': case 'Q': turn(-1); break;
    case 'Shift': keys.fine = 1; break;
    case '+': case '=': zoom = clamp(zoom / 1.15, .75, 3); break;
    case '-': case '_': zoom = clamp(zoom * 1.15, .75, 3); break;
  }
});
addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = 0;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = 0;
  if (e.key === 'Shift') keys.fine = 0;
});
addEventListener('blur', () => { keys.left = keys.right = keys.fine = 0; });
$('flip').onclick = () => { flip(); };
$('turn').onclick = () => { turn(1); };
$('drop').onclick = () => { drop(); };
function updateButtons() {
  const on = state === 'aim' && !!held;
  $('flip').disabled = $('turn').disabled = $('drop').disabled = !on;
}

// Sound toggle
function applyMute(m) {
  sound.setMuted(m);
  $('sound').setAttribute('aria-pressed', String(m));
  $('sound').setAttribute('aria-label', m ? 'Unmute' : 'Mute');
  $('waves').style.display = m ? 'none' : ''; $('cross').style.display = m ? '' : 'none';
}
applyMute(store.get('muted') === '1');
$('sound').onclick = () => { const m = !sound.muted; applyMute(m); store.set('muted', m ? '1' : '0'); if (!m) sound.start(); };
document.addEventListener('visibilitychange', () => sound.suspend(document.hidden));

function say(t) { $('live').textContent = t; }

/* ---------- cards ---------- */
let cardKind = null;
function showCard(kind) {
  cardKind = kind;
  if (kind === 'intro') {
    $('cardTitle').textContent = 'Tables & Chairs';
    $('cardBody').innerHTML = `<p>Stack each table and chair on the tower. Every one is a little smaller than the last, and they obey gravity: load one side too much and it tips.</p>
      <p>Only the bottom table may touch the ground. If anything else lands on it, the tower's done.</p>
      <dl><dt>Aim</dt><dd>${TOUCH ? 'drag anywhere' : 'move the mouse, or ← →'}</dd>
      <dt>Drop</dt><dd>${TOUCH ? 'tap, or the Drop button' : 'click, or Space'}</dd>
      <dt>Flip</dt><dd>${TOUCH ? 'the Flip button' : 'right-click, or F'}</dd>
      <dt>Turn</dt><dd>${TOUCH ? 'the Turn button' : 'R'}</dd></dl>`;
    $('go').textContent = 'Start stacking';
    $('cardFine').textContent = 'Sound on. It starts as a spa. It doesn’t stay one.';
  } else {
    const r = lastRun;
    $('cardTitle').textContent = 'Timber!';
    $('cardBody').innerHTML = `<p class="big">The ${r.who.toLowerCase()} hit the ground. Your tower reached <b>${metres(r.height)} m</b>, with ${r.count} piece${r.count === 1 ? '' : 's'} stacked on the first table.</p>
      <p>Best: ${metres(best)} m${r.isNew ? '<span class="new">New best</span>' : ''}</p>`;
    $('go').textContent = 'Stack again';
    $('cardFine').textContent = 'Enter or Space to go again';
  }
  $('card').hidden = false;
  $('go').focus();
}
$('go').onclick = () => {
  $('card').hidden = true;
  sound.start();
  if (cardKind === 'over') newGame();
  else if (sound.music) sound.music.target = heatTarget;
  state = 'aim';
  updateButtons();
  canvas.focus({ preventScroll: true });
};

/* ---------- main loop ---------- */
let acc = 0, last = performance.now(), autoT = 0, autoX = null;
function frame(now) {
  tick(now);
  requestAnimationFrame(frame);
}
function tick(now) {
  const dt = clamp((now - last) / 1000, 0, .05); last = Math.max(last, now);

  acc = Math.min(acc + dt, STEP * 12);
  while (acc >= STEP) { step(world); acc -= STEP; }
  for (const r of pieces) { const p = r.body.getPosition(); r.group.position.set(p.x, p.y, 0); r.group.rotation.z = r.body.getAngle(); }
  refresh();
  knocks(dt);

  if (fell && (state === 'aim' || state === 'drop')) topple();
  if (state === 'drop') {
    dropT += dt;
    let moving = 0;
    for (const r of pieces) {
      if (!r.body.isAwake()) continue;
      const v = r.body.getLinearVelocity();
      moving = Math.max(moving, (Math.hypot(v.x, v.y) + Math.abs(r.body.getAngularVelocity()) * r.p.F * .5) / (r.p.F * .1 + .3));
    }
    if ((dropT > .45 && moving < .25) || dropT > 4) settled();
  }
  if (state === 'over') { overT += dt; if (overT > 2.3 && $('card').hidden) showCard('over'); }

  if (held) {
    if (state === 'aim') {
      if (pointer.mouse) { const x = worldX(pointer.x, pointer.y); if (x != null) held.cx = x; }
      const dir = keys.right - keys.left;
      if (dir) held.cx += dir * Math.max(1.5, (held.local.x1 - held.local.x0) * .7) * (keys.fine ? .25 : 1) * dt;
      if (AUTO) {
        autoT += dt;
        if (autoX == null && autoT > .5) { if (held.p.kind === 'chair' && Math.random() < .5) flip(); autoX = autoAim(held) ?? held.cx; }
        if (autoX != null) { held.cx = damp(held.cx, autoX, 6, dt); if (Math.abs(held.cx - autoX) < .02 && autoT > 1.2) { autoX = null; autoT = 0; drop(); } }
      }
    }
    if (held) placeHeld(dt);
  }
  updateBeams();

  skyHeat = damp(skyHeat, heatTarget, .6, dt);
  if (!REDUCED && skyHeat > .85 && state !== 'intro') {
    nextFlash -= dt;
    if (nextFlash < 0) { flash = 1; nextFlash = 5 + Math.random() * 9; }
  }
  flash = Math.max(0, flash - dt * 3.5);
  applySky(skyHeat);
  for (const c of clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 1200) c.position.x -= 2400; }

  updateCamera(dt);
  drawMap(dt);
  hud();
  renderer.render(scene, camera);
}
const shown = { h: '', c: '', b: '' };
function hud() {
  const h = metres(towerB.y1), c = String(count), b = best ? metres(best) : '–';
  if (h !== shown.h) $('height').textContent = shown.h = h;
  if (c !== shown.c) $('count').textContent = shown.c = c;
  if (b !== shown.b) $('best').textContent = shown.b = b;
}
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

$('hint').innerHTML = TOUCH
  ? 'Drag to aim · tap to drop'
  : 'Move to aim · <kbd>click</kbd> to drop · <kbd>right-click</kbd> flips · <kbd>R</kbd> turns · scroll to zoom';

// ?demo: stack a few pieces before the first frame, the way ?auto would.
function demoBuild(n) {
  for (let i = 0; i < n && held; i++) {
    if (held.p.kind === 'chair' && R() < .5) { held.flip = true; setPose(held); }
    const x = autoAim(held); if (x == null) break;
    held.cx = x; placeHeld(0, true); drop();
    for (let t = 0; t < 2.5; t += STEP) step(world);
    refresh();
    if (fell) break;
    settled();
  }
  refresh();
  if (held) { held.cx = autoAim(held) ?? held.cx; placeHeld(0, true); }
  skyHeat = heatTarget;
}

newGame(DEMO ? 20260925 : undefined);
if (DEMO) { state = 'aim'; demoBuild(+params.get('n') || 9); $('hint').hidden = true; }
else if (AUTO) { state = 'aim'; }
else showCard('intro');
updateButtons();
requestAnimationFrame(frame);
window.toyboxReady?.();                                // clears the Toy Box loading bar once that first frame is up
