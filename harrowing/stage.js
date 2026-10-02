// The battlefield: a ledge deep in hell, staged as a shadow theatre. Behind it the circle's sky glows, and its
// scenery stands in three cut-paper layers fading into the haze, with fog drifting between them; the angel stands
// on the left and the demons on the right. Everything is a flat layer at its own depth, so the camera's slow drift
// gives real parallax.
import * as THREE from 'three';
import { CIRCLE_LOOK, canvas, rad, TAU } from './paint.js';
import { lookFor, FW } from './figures.js';
import { spriteMaterial, glowMaterial, texOf, LIGHT } from './sprite.js';
import { SETS, propLook } from './props.js';
import { LAYERS, LW, BASE, HZ, LIP, paintSky, paintLayer, paintFloor, paintLip } from './scenery.js';

/* ================= particles: embers, ash, rain, snow ================= */
const PVERT = `
  attribute vec4 aColor; attribute float aSize; attribute float aAng; attribute float aStretch;
  varying vec4 vColor; varying float vAng; varying float vStretch;
  uniform float uScale;
  void main() { vColor = aColor; vAng = aAng; vStretch = aStretch;
    vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const PFRAG = `
  varying vec4 vColor; varying float vAng; varying float vStretch;
  void main() { vec2 p = gl_PointCoord * 2. - 1.; float c = cos(vAng), s = sin(vAng); p = mat2(c, -s, s, c) * p; p.y /= max(vStretch, 1.); p.x *= max(vStretch, 1.) * .6 + .4;
    float a = exp(-dot(p, p) * 3.2); gl_FragColor = vec4(vColor.rgb, vColor.a * a); }`;
class Particles {
  constructor(n, additive) {
    this.n = n; this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.col = new Float32Array(n * 4); this.size = new Float32Array(n); this.ang = new Float32Array(n); this.str = new Float32Array(n); this.kind = new Uint8Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAng', new THREE.BufferAttribute(this.ang, 1));
    geo.setAttribute('aStretch', new THREE.BufferAttribute(this.str, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: PVERT, fragmentShader: PFRAG, uniforms: { uScale: { value: 300 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false;
    this.geo = geo; this.next = 0;
  }
  spawn(o) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.p.set(o.p, i * 3); this.v.set(o.v ?? [0, 0, 0], i * 3);
    this.life[i] = this.max[i] = o.life ?? 2; this.size[i] = o.size ?? 10; this.str[i] = o.stretch ?? 1;
    const c = o.color; this.col[i * 4] = c.r; this.col[i * 4 + 1] = c.g; this.col[i * 4 + 2] = c.b; this.col[i * 4 + 3] = o.alpha ?? 1;
    this.kind[i] = o.kind ?? 0; this.ang[i] = o.ang ?? 0;
    this.alpha0 = this.alpha0 ?? new Float32Array(this.n); this.alpha0[i] = o.alpha ?? 1;
    this.drag = this.drag ?? new Float32Array(this.n); this.drag[i] = o.drag ?? 0;
    this.grav = this.grav ?? new Float32Array(this.n); this.grav[i] = o.grav ?? 0;
  }
  update(dt, t) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; continue; }
      this.life[i] -= dt;
      const k = i * 3;
      this.v[k + 1] -= (this.grav?.[i] ?? 0) * dt;
      const dr = Math.exp(-(this.drag?.[i] ?? 0) * dt);
      this.v[k] *= dr; this.v[k + 1] *= dr; this.v[k + 2] *= dr;
      if (this.kind[i] === 1) this.v[k] += Math.sin(t * 2 + i) * dt * .4;   // embers wander
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      const f = this.life[i] / this.max[i];
      this.col[i * 4 + 3] = (this.alpha0?.[i] ?? 1) * Math.min(1, f * 3) * Math.min(1, (1 - f) * 6 + .2);
      if (this.str[i] > 1) this.ang[i] = Math.atan2(this.v[k], this.v[k + 1]);
    }
    for (const a of ['position', 'aColor', 'aSize', 'aAng', 'aStretch']) this.geo.attributes[a].needsUpdate = true;
  }
}

/* ================= the figures ================= */
export class Figure {
  constructor(look, size, o = {}) {
    this.rig = lookFor(look);
    this.look = look;
    const feet = this.rig.feetY;
    this.k = size * 2.5 / 400;                  // world units per frame pixel
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.parts = [];
    this.mats = [];
    this.facing = o.facing ?? 1;
    const k = this.k;
    for (const p of this.rig.parts) {
      const pivot = new THREE.Group();
      pivot.position.set((p.pivot[0] - FW / 2) * k, (feet - p.pivot[1]) * k, p.z * .012);
      this.body.add(pivot);
      for (const [crop, glow] of [[p.base, false], [p.glow, true]]) {
        if (!crop) continue;
        const tex = texOf(crop.canvas);
        const mat = glow ? glowMaterial(tex) : spriteMaterial(tex, { keyDir: -this.facing, paper: p.paper, lit: p.paper ? o.lit : 1 });
        const geo = new THREE.PlaneGeometry(crop.canvas.width * k, crop.canvas.height * k);
        const m = new THREE.Mesh(geo, mat);
        const cx = crop.x + crop.canvas.width / 2, cy = crop.y + crop.canvas.height / 2;
        m.position.set((cx - p.pivot[0]) * k, -(cy - p.pivot[1]) * k, glow ? .004 : 0);
        m.renderOrder = 10;
        pivot.add(m);
        if (!glow) this.mats.push(mat); else (this.glows ??= []).push(mat);
      }
      this.parts.push({ name: p.name, pivot, anim: p.anim, base: pivot.position.clone() });
    }
    if (this.facing < 0) this.body.scale.x = -1;
    this.height = (feet - this.rig.topY) * k;
    this.width = 300 * k;
    this.hover = !!this.rig.hover;
    this.t = Math.random() * 10; this.speed = 1;
    // a shadow on the ground
    // a shadow on the ground, or for the angel, the only light down here, a pool of her own light
    const lit = look === 'angel';
    const sc = canvas(128, 64), sg = sc.getContext('2d');
    sg.scale(1, .5); sg.fillStyle = rad(sg, 64, 64, 2, 62, lit ? [[0, 'rgba(255,236,190,.55)'], [.5, 'rgba(255,220,160,.18)'], [1, 'rgba(255,220,160,0)']] : [[0, 'rgba(0,0,0,.7)'], [1, 'rgba(0,0,0,0)']]); sg.fillRect(0, 0, 128, 128);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(this.width * (lit ? 2.6 : 1.1), this.width * (lit ? .9 : .4)), new THREE.MeshBasicMaterial({ map: texOf(sc), transparent: true, depthWrite: false, blending: lit ? THREE.AdditiveBlending : THREE.NormalBlending }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = .02; this.shadow.renderOrder = 2;
    this.root.add(this.shadow);
    this.flash = 0; this.hi = 0; this.dissolve = 0; this.alpha = 1;
    this.off = new THREE.Vector3(); this.offV = new THREE.Vector3(); this.shake = 0;
    this.lunge = null;
  }
  setFloor(y) { for (const m of this.mats) m.uniforms.uFloor.value = y; }
  update(dt) {
    this.t += dt * this.speed;
    const t = this.t;
    for (const p of this.parts) {
      const a = p.anim; if (!a) continue;
      const ph = a.phase ?? 0, w = (a.speed ?? 1.5);
      if (a.rot) p.pivot.rotation.z = a.rot * Math.sin(t * w + ph) * (p.name.startsWith('wing') && this.flap ? 1.8 : 1);
      if (a.bob) p.pivot.position.y = p.base.y + a.bob * this.k * Math.sin(t * w + ph + 1);
      if (a.sway) p.pivot.position.x = p.base.x + a.sway * this.k * Math.sin(t * w * .7 + ph);
      if (a.breath) p.pivot.scale.y = 1 + a.breath * Math.sin(t * w + ph);
    }
    // body bob for hovering figures
    const hov = this.hover ? .18 + .1 * Math.sin(t * 1.3) : 0;
    // a scripted lunge or recoil
    if (this.lunge) {
      const L = this.lunge; L.t += dt;
      const u = Math.min(1, L.t / L.dur);
      const e = u < L.peak ? Math.sin(u / L.peak * Math.PI / 2) : Math.cos((u - L.peak) / (1 - L.peak) * Math.PI / 2);
      this.off.x = L.dx * e; this.off.y = (L.dy ?? 0) * e;
      this.body.rotation.z = (L.tilt ?? 0) * e;
      if (u >= 1) { this.lunge = null; this.off.set(0, 0, 0); this.body.rotation.z = 0; }
    }
    this.shake = Math.max(0, this.shake - dt * 3);
    this.body.position.set(this.off.x + (Math.random() - .5) * this.shake * .25, hov + this.off.y, 0);
    this.flash = Math.min(1, Math.max(0, this.flash - dt * 4));
    for (const m of this.mats) { const u = m.uniforms; u.uFlash.value = this.flash * .85; u.uHi.value = this.hi; u.uDissolve.value = this.dissolve; u.uAlpha.value = this.alpha; }
    for (const m of this.glows ?? []) m.opacity = this.alpha * (1 - this.dissolve);
    this.shadow.material.opacity = this.alpha * (1 - this.dissolve) * (this.hover ? .6 : 1);
  }
  // world point above the head (for cards and labels)
  top(v = new THREE.Vector3()) { return v.set(0, this.height + .15 + (this.hover ? .2 : 0), 0).applyMatrix4(this.root.matrixWorld); }
  feet(v = new THREE.Vector3()) { return v.set(0, 0, 0).applyMatrix4(this.root.matrixWorld); }
  center(v = new THREE.Vector3()) { return v.set(0, this.height * .55 + (this.hover ? .2 : 0), 0).applyMatrix4(this.root.matrixWorld); }
  doLunge(dx, o = {}) { this.lunge = { t: 0, dur: o.dur ?? .55, peak: o.peak ?? .3, dx, dy: o.dy ?? 0, tilt: o.tilt ?? 0 }; }
  hit(dir = 1) { this.flash = 1; this.shake = 1; this.doLunge(.35 * dir, { dur: .4, peak: .25, tilt: -.08 * dir }); }
  dispose() { this.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); o.material.uniforms?.map?.value?.dispose(); o.material.dispose(); } }); this.root.removeFromParent(); }
}

/* ================= the stage ================= */
const FOG_FRAG = `
  uniform float uTime, uAlpha; uniform vec3 uCol; varying vec2 vUv;
  float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  void main() { vec2 p = vUv * vec2(4., 1.5); float t = uTime * .03;
    float v = n(p + vec2(t, 0.)) * .5 + n(p * 2.1 - vec2(t * 1.6, t * .3)) * .3 + n(p * 4.3 + vec2(t * 2., 0.)) * .2;
    float edge = smoothstep(0., .25, vUv.y) * smoothstep(1., .55, vUv.y);
    gl_FragColor = vec4(uCol, smoothstep(.35, .85, v) * edge * uAlpha); }`;
const FOG_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

const LEDGE = -8.5, BACK_Z = -60;
const PAINTED = {};
const FIRE = new THREE.Color('#ffa040');   // each circle's paintings, made once   // the far edge of the ledge they fight on; beyond it, the abyss

export class Stage {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, .1, 200);
    this.layers = {};
    this.figures = [];
    this.angel = null;
    this.time = 0;
    this.drift = new THREE.Vector2();
    this.pointer = new THREE.Vector2();
    this.shakeAmt = 0;
    this.embers = new Particles(420, true);
    this.dust = new Particles(260, false);
    this.scene.add(this.embers.points, this.dust.points);
    this.circle = -1;
    this.view = { w: 1, h: 1, battleTop: 0, battleBottom: .62 };
    this.camBase = new THREE.Vector3(0, 3, 15); this.look = new THREE.Vector3(0, 2, 0);
    this.spawnAcc = 0;
  }
  // scene: which scenery to paint (the circle's own, or 'gate' for the title)
  setCircle(ci, scene) {
    const key = scene ?? CIRCLE_LOOK[ci].name;
    if (key === this.sceneKey) return;
    this.circle = ci; this.sceneKey = key;
    const L = this.look_ = CIRCLE_LOOK[ci];
    for (const k of Object.keys(this.layers)) { const m = this.layers[k]; m.removeFromParent(); m.traverse?.(o => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); o.material.uniforms?.map?.value?.dispose?.(); o.material.dispose(); } }); }
    this.layers = {};
    const P = PAINTED[key] ??= { sky: paintSky(L, key), scenery: LAYERS.map((_, i) => paintLayer(L, key, i)), floor: paintFloor(L, key), lip: paintLip(L, key) };
    const flat = (c, o = {}) => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texOf(c), transparent: o.transparent ?? true, depthWrite: false, fog: false }));
    const sky = flat(P.sky, { transparent: false }); sky.renderOrder = 0; this.scene.add(sky); this.layers.sky = sky;
    P.scenery.forEach((c, i) => { const m = flat(c); m.renderOrder = .1 + i * .2; m.userData.layer = i; this.scene.add(m); this.layers['scenery' + i] = m; });
    // fog drifting between the layers and along the ledge's edge
    [[-43, .34], [-27, .26], [-13, .22]].forEach(([z, a], i) => {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ vertexShader: FOG_VERT, fragmentShader: FOG_FRAG, transparent: true, depthWrite: false, uniforms: { uTime: LIGHT.uTime, uAlpha: { value: a }, uCol: { value: new THREE.Color(L.fog) } } }));
      f.renderOrder = .2 + i * .2; f.userData.fogZ = z; this.scene.add(f); this.layers['fog' + i] = f;
    });
    // the ledge
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 90), new THREE.MeshBasicMaterial({ map: texOf(P.floor) }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, LEDGE + 45); ground.renderOrder = 1; this.scene.add(ground); this.layers.ground = ground;
    // its broken far edge, standing a little proud of the floor
    const lt = texOf(P.lip); lt.wrapS = THREE.RepeatWrapping; lt.repeat.x = 240 / LIP.tile; lt.anisotropy = 8;
    const lip = new THREE.Mesh(new THREE.PlaneGeometry(240, LIP.height), new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false }));
    lip.position.set(0, LIP.height / 2 - 1.15, LEDGE); lip.renderOrder = 1.1; this.scene.add(lip); this.layers.lip = lip;
    // things standing about on the ledge
    this.fires = [];
    this.props = [];
    (SETS[key] ?? SETS[L.name]).forEach(([kind, anchor, dx, z, size], i) => {
      const look = propLook(kind, L, ci * 31 + i);
      const grp = new THREE.Group();
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), spriteMaterial(texOf(look.canvas), { keyDir: 1, paper: look.paper, lit: look.paper ? 1 : undefined }));
      m.position.y = size / 2; m.renderOrder = 5; grp.add(m);
      if (look.glow) { const gm = new THREE.Mesh(new THREE.PlaneGeometry(size, size), glowMaterial(texOf(look.glow))); gm.position.set(0, size / 2, .01); gm.renderOrder = 6; grp.add(gm); }
      grp.position.set(0, 0, z);
      this.scene.add(grp); this.layers['prop' + i] = grp;
      grp.geometry = { dispose() {} }; grp.material = { dispose() {} };
      const fire = look.fire ? new THREE.Vector3(0, size * look.fire, z) : null;
      if (fire) this.fires.push(fire);
      this.props.push({ grp, anchor, dx, z, fire });
    });
    // the light the puppets stand in
    LIGHT.uAmb.value.set(L.light).lerp(new THREE.Color(1, 1, 1), .5);
    LIGHT.uGlow.value.set(L.lava);
    LIGHT.uKey.value.set(L.rim);
    this.scene.background = new THREE.Color(L.sky[0]);
    this.weather = L.weather;
    this.emberCol = new THREE.Color(L.lava);
    this.layout();
  }
  // Place the figures: the angel on the left, the demons in a row (or a diagonal on tall screens).
  setFigures(angel, demons) {
    for (const f of this.figures) if (!angel || f !== angel) { if (!demons.includes(f)) f.root.removeFromParent(); }
    this.angel = angel; this.figures = [angel, ...demons].filter(Boolean);
    for (const f of this.figures) if (!f.root.parent) this.scene.add(f.root);
    this.layout();
  }
  layout() {
    const { w, h } = this.view, aspect = w / h, tall = aspect < .9;
    this.tall = tall;
    const ds = this.figures.filter(f => f !== this.angel && !f.leaving);
    // the demons' row
    let x = tall ? -.6 : .9;
    const gap = tall ? .1 : .55;
    const xs = [];
    for (const d of ds) { xs.push(x + d.width * .5); x += d.width + gap; }
    const rowW = x - gap - (tall ? -.6 : .9);
    const maxH = Math.max(2.5, this.angel ? this.angel.height * 1.1 : 0, ...ds.map(d => d.height));
    ds.forEach((d, i) => {
      const z = tall ? (ds.length > 1 ? (i % 2 ? -3.4 : -.9) : -1.2) - (d.height > 4 ? 1 : 0) : (i % 2 ? -.9 : 0) - (d.height > 4 ? 1.2 : 0);
      d.home = new THREE.Vector3(xs[i] + (tall ? 0 : 0), 0, z);
      if (!d.placed) { d.root.position.copy(d.home); d.placed = true; }
    });
    const solo = !ds.length;
    if (this.angel) { this.angel.home = solo ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(tall ? -2.4 - (ds.length > 2 ? .4 : 0) : -4.6 - Math.max(0, rowW - 9) * .3, 0, tall ? 1.4 : .6); if (!this.angel.placed) { this.angel.root.position.copy(this.angel.home); this.angel.placed = true; } }
    // frame them: the whole group plus room above for the held cards
    const left = solo ? -4 : (this.angel?.home.x ?? 0) - 2.8, right = solo ? 4 : Math.max(left + 6, ...ds.map(d => d.home.x + d.width * .55)) + .4;
    // room above the tallest head for the cards the demons hold, which are a fixed size on screen
    const fovR = this.camera.fov * Math.PI / 180, regionH = (this.view.battleBottom - this.view.battleTop) * h;
    const cardPx = (tall ? Math.min(64, Math.max(40, w * .115)) : Math.min(92, Math.max(56, h * .09))) * 1.4 + 70;
    let top = maxH + 1.6, bottom = -.3;
    for (let k = 0; k < 2; k++) {
      const span = top - bottom, D0 = Math.max((right - left) / 2 / (Math.tan(fovR / 2) * aspect * .94), span / 2 / (Math.tan(fovR / 2) * (regionH / h) * .94), 9);
      const pxPerUnit = h / (2 * D0 * Math.tan(fovR / 2));
      top = maxH + cardPx / pxPerUnit;
    }
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    for (const p of this.props ?? []) {
      const x = (p.anchor === 'L' ? left : p.anchor === 'R' ? right : cx) + p.dx;
      p.grp.position.set(x, 0, p.z);
      if (p.fire) p.fire.x = x;
    }
    const fov = this.camera.fov * Math.PI / 180, region = this.view.battleBottom - this.view.battleTop;
    const dW = (right - left) / 2 / (Math.tan(fov / 2) * aspect * .94), dH = (top - bottom) / 2 / (Math.tan(fov / 2) * region * .94);
    const D = Math.max(dW, dH, 9);
    this.camBase.set(cx, cy * .78, D + (tall ? -.6 : 0));
    this.look.set(cx, cy - .2, tall ? -1 : 0);
    // shift the picture so the battle sits in its band of the screen
    const centre = (this.view.battleTop + this.view.battleBottom) / 2;
    this.camera.setViewOffset(w, h, 0, (.5 - centre) * h, w, h);
    // the sky and the scenery stand behind the ledge: each layer's foot is hidden just behind its far edge, as
    // seen from here, and each is as wide as the view at its depth with room for the camera's drift
    const cz = this.camBase.z, cy2 = this.camBase.y;
    const edgeY = z => cy2 + (0 - cy2) * (cz - z) / (cz - LEDGE);
    const wideAt = z => 2 * (cz - z) * Math.tan(fov / 2) * Math.max(aspect, .8) * 1.3;
    const sky = this.layers.sky;
    if (sky) { const w = wideAt(BACK_Z) * 1.05; sky.scale.set(w, w, 1); sky.position.set(cx, edgeY(BACK_Z) + .4 + (HZ - .5) * w, BACK_Z); }
    for (const [k, m] of Object.entries(this.layers)) {
      if (m.userData.layer !== undefined) {
        const D = LAYERS[m.userData.layer], w = wideAt(D.z), hgt = w * D.h / LW;
        m.scale.set(w, hgt, 1);
        // the scenery's baseline (BASE px up from the canvas's foot) sits just at the ledge's edge
        m.position.set(cx, edgeY(D.z) - .006 * (cz - D.z) + hgt * (.5 - BASE / D.h), D.z);
      } else if (m.userData.fogZ !== undefined) {
        const z = m.userData.fogZ, w = wideAt(z);
        m.scale.set(w, w * .09, 1); m.position.set(cx, edgeY(z) + w * .02, z);
      }
    }
    if (this.layers.lip) this.layers.lip.position.x = cx;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.embers.mat.uniforms.uScale.value = h * .013;
    this.dust.mat.uniforms.uScale.value = h * .013;
  }
  resize(w, h, band) {
    this.view = { w, h, battleTop: band?.[0] ?? 0, battleBottom: band?.[1] ?? .64 };
    this.layout();
  }
  // world → CSS pixels
  project(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * .5 + .5) * this.view.w, y: (-p.y * .5 + .5) * this.view.h, z: p.z };
  }
  shake(a) { this.shakeAmt = Math.min(1.2, this.shakeAmt + a); }
  burst(pos, o = {}) {
    const n = o.n ?? 24, col = new THREE.Color(o.color ?? '#ffb060');
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = (o.speed ?? 3) * (.4 + Math.random() * .8);
      (o.dark ? this.dust : this.embers).spawn({ p: [pos.x, pos.y, pos.z + .3], v: [Math.cos(a) * s, Math.sin(a) * s * .8 + (o.up ?? 1), (Math.random() - .5) * s * .4], life: (o.life ?? .8) * (.6 + Math.random() * .6), size: (o.size ?? 26) * (.5 + Math.random()), color: col, alpha: o.alpha ?? 1, drag: 2, grav: o.grav ?? 2, kind: 0 });
    }
  }
  update(dt) {
    this.time += dt;
    LIGHT.uTime.value = this.time;
    const t = this.time;
    // the camera drifts a little, and leans toward the pointer
    this.drift.lerp(this.pointer, 1 - Math.exp(-dt * 2));
    const sh = this.shakeAmt * this.shakeAmt; this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.2);
    this.camera.position.set(this.camBase.x + Math.sin(t * .13) * .25 + this.drift.x * .5 + (Math.random() - .5) * sh * .3, this.camBase.y + Math.sin(t * .17) * .12 + this.drift.y * .25 + (Math.random() - .5) * sh * .3, this.camBase.z);
    this.camera.lookAt(this.look.x + this.drift.x * .2, this.look.y, this.look.z);
    // figures walk home if they've moved
    for (const f of this.figures) {
      if (f.home && !f.leaving) f.root.position.lerp(f.home, 1 - Math.exp(-dt * 4));
      f.update(dt);
      f.setFloor(f.root.position.y);
    }
    // weather
    this.spawnAcc += dt;
    const L = this.look_;
    while (this.spawnAcc > .03 && L) {
      this.spawnAcc -= .03;
      const x = this.look.x + (Math.random() - .5) * 34, z = -14 + Math.random() * 18;
      if (Math.random() < .5) this.embers.spawn({ p: [x, -.2, z], v: [(Math.random() - .5) * .3, .5 + Math.random() * .9, 0], life: 4 + Math.random() * 4, size: 9 + Math.random() * 14, color: this.emberCol, alpha: .55 + Math.random() * .45, kind: 1 });
      if (this.fires?.length && Math.random() < .5) { const f = this.fires[Math.floor(Math.random() * this.fires.length)]; this.embers.spawn({ p: [f.x + (Math.random() - .5) * .5, f.y, f.z + .1], v: [(Math.random() - .5) * .4, 1 + Math.random() * 1.4, 0], life: 1.2 + Math.random(), size: 10 + Math.random() * 10, color: FIRE, alpha: .9, kind: 1 }); }
      const wth = this.weather;
      if (wth === 'ash' || wth === 'embers') this.dust.spawn({ p: [x, 12, z], v: [(Math.random() - .5) * .3, -.5 - Math.random() * .4, 0], life: 10, size: 7 + Math.random() * 8, color: new THREE.Color(wth === 'ash' ? '#b8bcc8' : '#3a3030'), alpha: .5 });
      else if (wth === 'rain') for (let i = 0; i < 2; i++) this.dust.spawn({ p: [x + Math.random() * 3, 12, z], v: [-1.5, -14, 0], life: 1.2, size: 22, stretch: 6, color: new THREE.Color('#aab0a0'), alpha: .35 });
      else if (wth === 'snow') this.dust.spawn({ p: [x, 12, z], v: [.4 + Math.random() * .4, -.8 - Math.random() * .5, 0], life: 14, size: 10 + Math.random() * 10, color: new THREE.Color('#f4fbff'), alpha: .8 });
      else if (wth === 'wind') this.embers.spawn({ p: [this.look.x - 18, 1 + Math.random() * 9, z], v: [8 + Math.random() * 6, Math.sin(t) * .8, 0], life: 4, size: 26, stretch: 7, color: new THREE.Color('#ff7ab8'), alpha: .25, ang: Math.PI / 2 });
      else if (wth === 'gold') this.embers.spawn({ p: [x, 0, z], v: [0, .3 + Math.random() * .4, 0], life: 5, size: 8 + Math.random() * 8, color: new THREE.Color('#ffe08a'), alpha: .9, kind: 1 });
      else if (wth === 'spores') this.embers.spawn({ p: [x, Math.random() * 3, z], v: [(Math.random() - .5) * .3, .2 + Math.random() * .3, 0], life: 8, size: 10 + Math.random() * 10, color: new THREE.Color('#5affc8'), alpha: .6, kind: 1 });
      else if (wth === 'fire') this.embers.spawn({ p: [x, 12, z], v: [.5, -3 - Math.random() * 2, 0], life: 4, size: 18, stretch: 3, color: new THREE.Color('#ff7a2a'), alpha: .7 });
    }
    this.embers.update(dt, t); this.dust.update(dt, t);
  }
}
