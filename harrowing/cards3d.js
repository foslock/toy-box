// Cards as real slabs in their own scene, laid out in screen pixels: the hand fanned at the bottom, the shared deck
// and the discard pile between you and the demons, the cards the demons hold over their heads (upside down), and
// cards in flight between them. Every card springs toward where it should be and leans as it moves.
import * as THREE from 'three';
import { paintFace, paintBack, paintMask, CW, CH } from './face.js';
import { def } from './cards.js';
import { canvas, rad } from './paint.js';

export const RATIO = CH / CW;
const W1 = 1, H1 = RATIO, T1 = .014, R1 = .065;

function roundRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}
let GEO = null;
function cardGeometry() {
  if (GEO) return GEO;
  const shape = roundRect(W1, H1, R1);
  const face = new THREE.ShapeGeometry(shape, 8).toNonIndexed();
  const pos = face.attributes.position, uv = face.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / W1 + .5, pos.getY(i) / H1 + .5);
  const front = face.clone(); front.translate(0, 0, T1 / 2);
  const back = face.clone(); back.rotateY(Math.PI); back.translate(0, 0, -T1 / 2);
  const outline = shape.extractPoints(8).shape, P = [], N = [], U = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
    if (l < 1e-6) continue;
    const nx = dy / l, ny = -dx / l;
    P.push(a.x, a.y, T1 / 2, a.x, a.y, -T1 / 2, b.x, b.y, -T1 / 2, a.x, a.y, T1 / 2, b.x, b.y, -T1 / 2, b.x, b.y, T1 / 2);
    for (let k = 0; k < 6; k++) { N.push(nx, ny, 0); U.push(0, 0); }
  }
  const parts = [[front.attributes.position.array, front.attributes.normal.array, front.attributes.uv.array], [back.attributes.position.array, back.attributes.normal.array, back.attributes.uv.array], [new Float32Array(P), new Float32Array(N), new Float32Array(U)]];
  const cat = k => { const n = parts.reduce((s, p) => s + p[k].length, 0), out = new Float32Array(n); let o = 0; for (const p of parts) { out.set(p[k], o); o += p[k].length; } return out; };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cat(0), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(cat(1), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(cat(2), 2));
  let start = 0; parts.forEach((p, i) => { const n = p[0].length / 3; geo.addGroup(start, n, i); start += n; });
  geo.computeBoundingSphere();
  return (GEO = geo);
}

// The face shader: the printed card, a glossy sheen that slides as it tilts, a holo rainbow on rare art.
const VERT = `
  varying vec2 vUv; varying vec3 vV;
  void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.); vV = (cameraPosition - wp.xyz) * mat3(modelMatrix);
    gl_Position = projectionMatrix * viewMatrix * wp; }`;
const FRAG = `
  uniform sampler2D map, maskMap; uniform float uTime, uHolo, uDim, uFlash, uSide, uBurn, uAlpha; uniform vec3 uTint;
  varying vec2 vUv; varying vec3 vV;
  vec3 spectrum(float t) { return .5 + .5 * cos(6.28318 * (t + vec3(0., .33, .67))); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec2 uv = vUv; if (uSide < 0.) uv.x = 1. - uv.x;
    vec3 V = normalize(vV); V.z *= uSide; V.x *= uSide;
    vec3 base = texture2D(map, uv).rgb;
    vec3 m = texture2D(maskMap, uv).rgb;
    vec2 tilt = V.xy / max(V.z, .25);
    vec3 col = base;
    // rare cards are gilded: a glint of gold leaf runs across them as they tilt
    if (uHolo > .5 && m.r > .01) {
      float ph = (uv.x * .8 + uv.y * 1.3) + tilt.x * 2. - tilt.y * 1.6 + uTime * .03;
      float band = pow(.5 + .5 * sin(ph * 7.), 6.);
      float fleck = step(.86, vnoise(uv * 140.)) * .5;
      col = mix(col, col * vec3(1.08, 1.0, .82) + vec3(1., .82, .45) * (band * .32 + fleck * band), m.r * (.5 + .5 * smoothstep(.0, .4, length(tilt))));
    }
    // a soft sheen sweeping over the frame as it turns
    float sweep = pow(max(0., 1. - abs((uv.x + uv.y) * .7 - .9 - tilt.x * 1.4 + tilt.y)), 6.);
    col += vec3(1., .95, .85) * sweep * (.08 + m.g * .14);
    col *= uTint * uDim;
    col = mix(col, vec3(1., .96, .85), uFlash);
    float a = uAlpha;
    if (uBurn > 0.) {
      float n = vnoise(uv * 7.) * .7 + vnoise(uv * 19.) * .3;
      float t = uBurn * 1.3 - .1;
      if (n < t) discard;
      col = mix(col, vec3(1., .5, .15) * 2., smoothstep(t + .07, t, n));
    }
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }`;
const UTIME = { value: 0 };
const TEX = new Map();   // canvas → texture, shared by every card showing the same face
function texFor(c) {
  let t = TEX.get(c);
  if (!t) {
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    TEX.set(c, t);
    if (TEX.size > 80) { const [k, v] = TEX.entries().next().value; v.dispose(); TEX.delete(k); }
  }
  return t;
}
const MASKS = new Map();
function maskFor(card) {
  const d = def(card), key = d.rarity === 'rare' ? 'rare:' + d.type : 'plain';
  let t = MASKS.get(key);
  if (!t) { t = new THREE.CanvasTexture(paintMask(card)); MASKS.set(key, t); }
  return t;
}
function faceMaterial(side) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: { map: { value: null }, maskMap: { value: null }, uTime: UTIME, uHolo: { value: 0 }, uDim: { value: 1 }, uFlash: { value: 0 }, uSide: { value: side }, uBurn: { value: 0 }, uAlpha: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) } },
    // cards are drawn strictly in order (see CardView.order), never by depth, so they can't cut through each other
    transparent: true, depthTest: false, depthWrite: false,
  });
}
let BACK_MAT = null, EDGE_MAT = null, GLOW_TEX = null;
function initShared() {
  if (BACK_MAT) return;
  BACK_MAT = faceMaterial(-1); BACK_MAT.uniforms.map.value = texFor(paintBack()); BACK_MAT.uniforms.maskMap.value = maskFor({ id: 'smite' });
  EDGE_MAT = new THREE.MeshBasicMaterial({ color: 0xd8c9a8, transparent: true, depthTest: false, depthWrite: false });
}
// a soft glow in the card's own outline (same proportions and corners), a little larger than the card
const GM = .085;
function glowTex() {
  if (GLOW_TEX) return GLOW_TEX;
  const k = 220, c = canvas(Math.round(k * (1 + GM * 2)), Math.round(k * (RATIO + GM * 2))), g = c.getContext('2d');
  g.filter = `blur(${k * .035}px)`; g.fillStyle = '#ffffff';
  g.beginPath(); g.roundRect(k * GM * .55, k * GM * .55, k * (1 + GM * .9), k * (RATIO + GM * .9), k * (R1 + GM * .45)); g.fill();
  GLOW_TEX = new THREE.CanvasTexture(c);
  return GLOW_TEX;
}

/* ---------- one card ---------- */
const tmpV = new THREE.Vector3();
export class CardView {
  constructor(layer, card) {
    this.layer = layer; this.card = card;
    initShared();
    this.front = faceMaterial(1);
    this.front.uniforms.maskMap.value = maskFor(card);
    this.front.uniforms.uHolo.value = def(card).rarity === 'rare' ? 1 : 0;
    this.back = BACK_MAT;
    this.mesh = new THREE.Mesh(cardGeometry(), [this.front, this.back, EDGE_MAT]);
    this.mesh.userData.view = this;
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1 + GM * 2, RATIO + GM * 2), new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, color: 0xffd36a, opacity: 0 }));
    this.glow.position.z = -.02;
    this.order = 0;
    this.obj = new THREE.Group(); this.obj.add(this.glow, this.mesh);
    layer.scene.add(this.obj);
    // pose: position (px), rotation (radians), scale (px wide)
    this.p = new THREE.Vector3(); this.r = new THREE.Vector3(); this.s = 100;
    this.tp = new THREE.Vector3(); this.tr = new THREE.Vector3(); this.ts = 100;
    this.v = new THREE.Vector3(); this.lean = new THREE.Vector2();
    this.glowTarget = 0; this.glowColor = new THREE.Color(0xffd36a); this.glowNow = 0;
    this.faceKey = null;
    this.flight = null; this.stiff = 16;
    this.hoverTilt = new THREE.Vector2();
    this.dead = false;
  }
  // paint the face: upright numbers as the angel would deal them, reversed ones as the holder would
  setFace(o = {}) {
    const c = paintFace(this.card, o);
    if (c !== this.faceCanvas) { this.faceCanvas = c; this.front.uniforms.map.value = texFor(c); }
  }
  place(p, r, s) { this.p.copy(p); this.tp.copy(p); if (r) { this.r.copy(r); this.tr.copy(r); } if (s) { this.s = this.ts = s; } this.v.set(0, 0, 0); return this; }
  target(p, r, s) { this.tp.copy(p); if (r) this.tr.copy(r); if (s != null) this.ts = s; return this; }
  // a scripted flight along an arc; resolves when it lands
  fly(p, r, s, o = {}) {
    const from = { p: this.p.clone(), r: this.r.clone(), s: this.s };
    const to = { p: p.clone(), r: (r ?? this.tr).clone(), s: s ?? this.ts };
    // spin the short way round on z, unless asked to spin more
    while (to.r.z - from.r.z > Math.PI) to.r.z -= Math.PI * 2;
    while (to.r.z - from.r.z < -Math.PI) to.r.z += Math.PI * 2;
    if (o.spin) to.r.z += o.spin;
    const ctrl = from.p.clone().lerp(to.p, .5); ctrl.y += o.arc ?? 80; ctrl.z += o.lift ?? 120;
    this.target(to.p, to.r, to.s);
    return new Promise(res => { this.flight = { from, to, ctrl, t: 0, dur: o.dur ?? .45, ease: o.ease ?? 'inOut', res, flipAt: o.flipAt }; });
  }
  update(dt, t) {
    const f = this.flight;
    if (f) {
      f.t += dt;
      let u = Math.min(1, f.t / f.dur);
      const e = f.ease === 'out' ? 1 - Math.pow(1 - u, 3) : f.ease === 'in' ? u * u * u : u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      const a = 1 - e;
      const prev = this.p.clone();
      this.p.set(a * a * f.from.p.x + 2 * a * e * f.ctrl.x + e * e * f.to.p.x, a * a * f.from.p.y + 2 * a * e * f.ctrl.y + e * e * f.to.p.y, a * a * f.from.p.z + 2 * a * e * f.ctrl.z + e * e * f.to.p.z);
      this.r.lerpVectors(f.from.r, f.to.r, e);
      this.s = f.from.s + (f.to.s - f.from.s) * e;
      if (dt > 0) this.v.copy(this.p).sub(prev).divideScalar(dt);
      if (u >= 1) { this.flight = null; this.p.copy(f.to.p); this.r.copy(f.to.r); this.s = f.to.s; this.tp.copy(f.to.p); this.tr.copy(f.to.r); this.ts = f.to.s; f.res(); }
    } else {
      const k = 1 - Math.exp(-dt * this.stiff);
      const prev = this.p.clone();
      this.p.lerp(this.tp, k);
      this.r.lerp(this.tr, k);
      this.s += (this.ts - this.s) * k;
      if (dt > 0) this.v.lerp(tmpV.copy(this.p).sub(prev).divideScalar(dt), .5);
    }
    // lean into the motion, like a card flicked across a table
    const lx = THREE.MathUtils.clamp(-this.v.y * .0009, -.5, .5), ly = THREE.MathUtils.clamp(this.v.x * .0011, -.6, .6);
    this.lean.x += (lx - this.lean.x) * Math.min(1, dt * 12); this.lean.y += (ly - this.lean.y) * Math.min(1, dt * 12);
    // draw order: whatever the layout asked for; a card in flight passes over the others
    const ord = this.flight ? Math.max(this.order, 140) : this.order;
    this.mesh.renderOrder = ord; this.glow.renderOrder = ord - .5;
    this.obj.position.copy(this.p);
    this.obj.rotation.set(this.r.x + this.lean.x + this.hoverTilt.x, this.r.y + this.lean.y + this.hoverTilt.y, this.r.z, 'ZXY');
    this.obj.scale.setScalar(this.s);
    this.glowNow += (this.glowTarget - this.glowNow) * Math.min(1, dt * 10);
    this.glow.material.opacity = this.glowNow * (.75 + .25 * Math.sin(t * 4 + this.card.uid));
    this.glow.material.color.copy(this.glowColor);
    this.glow.visible = this.glowNow > .01;
  }
  set dim(v) { this.front.uniforms.uDim.value = v; }
  set flash(v) { this.front.uniforms.uFlash.value = v; }
  set burn(v) { this.front.uniforms.uBurn.value = v; }
  get faceUp() { const ry = ((this.r.y % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return ry < Math.PI / 2 || ry > Math.PI * 1.5; }
  dispose() { this.dead = true; this.obj.removeFromParent(); this.front.dispose(); this.glow.geometry.dispose(); this.glow.material.dispose(); }
}

/* ---------- a pile: a stack of cards lying back on the ground, as thick as the pile is big ---------- */
// Lying back at an angle the piles take little height, and you can see at a glance which is the bigger.
export const TILT = -1.02;                  // how far a lying card leans back
const THICK = .0125;                        // one card's thickness, as a share of its width
const tiltE = new THREE.Euler(TILT, 0, 0);
class Pile {
  constructor(layer, faceUp) {
    this.layer = layer; this.group = new THREE.Group(); layer.scene.add(this.group);
    this.stack = new THREE.Group(); this.stack.rotation.x = TILT; this.group.add(this.stack);
    this.slabs = [];
    this.faceUp = faceUp;
    this.n = 0; this.size = 80; this.at = new THREE.Vector3();
    // a pool of light under it
    const c = canvas(128, 128), g = c.getContext('2d');
    g.fillStyle = rad(g, 64, 64, 4, 64, [[0, 'rgba(255,214,140,.5)'], [.5, 'rgba(255,150,80,.16)'], [1, 'rgba(255,120,60,0)']]); g.fillRect(0, 0, 128, 128);
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: faceUp ? .3 : .6 }));
    this.pool.renderOrder = -60; this.pool.rotation.x = TILT; this.group.add(this.pool);
  }
  set(n, at, size) {
    this.n = n; this.at.copy(at); this.size = size;
    const show = Math.min(n, 48);
    initShared();
    while (this.slabs.length < show) {
      const m = new THREE.Mesh(cardGeometry(), [BACK_MAT, BACK_MAT, EDGE_MAT]);
      m.rotation.y = Math.PI; this.stack.add(m); this.slabs.push(m);
    }
    this.slabs.forEach((m, i) => {
      m.visible = i < show;
      m.position.set(Math.sin(i * 2.1) * .012 * size, Math.cos(i * 1.7) * .01 * size, (i + .5) * THICK * size);
      m.rotation.z = Math.sin(i * 3.3) * .025;
      m.scale.setScalar(size);
      m.renderOrder = -50 + i * .01;
    });
    this.group.position.copy(at);
    this.pool.scale.set(size * 2.2, size * 2.2 * 1.4, 1);
  }
  // where the next card leaves from / lands on: just above the top of the stack
  topPos(v = new THREE.Vector3(), extra = 0) {
    return v.set(0, 0, (Math.min(this.n, 48) + 1 + extra) * THICK * this.size + 1).applyEuler(tiltE).add(this.at);
  }
}

/* ---------- the layer ---------- */
export class CardLayer {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 10, 10000);
    this.views = new Set();
    this.ray = new THREE.Raycaster();
    this.w = 1; this.h = 1;
    this.deck = new Pile(this, false);
    this.disc = new Pile(this, true);
    this.time = 0;
  }
  resize(w, h) {
    this.w = w; this.h = h;
    const dist = h / 2 / Math.tan(this.camera.fov * Math.PI / 360);
    this.camera.aspect = w / h; this.camera.position.set(0, 0, dist); this.camera.near = dist * .05; this.camera.far = dist * 3;
    this.camera.updateProjectionMatrix();
  }
  // screen px (top-left origin) → layer coordinates (centre origin, y up)
  at(x, y, z = 0) { return new THREE.Vector3(x - this.w / 2, this.h / 2 - y, z); }
  toScreen(v) { return { x: v.x + this.w / 2, y: this.h / 2 - v.y }; }
  add(card) { const v = new CardView(this, card); this.views.add(v); return v; }
  remove(v) { this.views.delete(v); v.dispose(); }
  update(dt) {
    this.time += dt; UTIME.value = this.time;
    for (const v of this.views) v.update(dt, this.time);
  }
  // the topmost card under a screen point
  pick(x, y, filter) {
    const ndc = new THREE.Vector2(x / this.w * 2 - 1, -(y / this.h) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const meshes = [...this.views].filter(v => !v.dead && v.obj.visible && (!filter || filter(v))).map(v => v.mesh);
    const hit = this.ray.intersectObjects(meshes, false)[0];
    return hit?.object.userData.view ?? null;
  }
}
