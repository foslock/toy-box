// Rigged Racer: the race, drawn with three.js in hard-banded cel shading with ink outlines and real (hard) shadows.
// The ground and the road are each one shader: sand with dune ripples and cracked mud, the road with its ruts, lane
// paint, kerbs and start line, and a rope bridge where the canyon drops away. The scenery comes from decor.js. Every
// frame the page hands over the race's state and its events, and this shows them: karts spinning out, flying, being
// swallowed; things on the road; rockets and vultures; the traps going off.
import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { point, sampleAt } from './track.js';
import { NEAR } from './sim.js';
import { RACERS } from './data.js';
import { toon, flat, part, G, makeKart, setChrome, CHROME, makeThing, makeRocket, makeVulture, makeWorm, makeMound, makeCrane, makeBoulderLedge, makeFlareStack, makeGate, makeFlame, INK } from './models.js';
import { buildDecor, LOOKS } from './decor.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - (1 - t) ** 3;
const wrapAng = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const headingOf = (tx, tz) => Math.atan2(-tx, -tz);

const NOISE = `
float h21(vec2 p) { p = fract(p * vec2(.1031, .1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
float cells(vec2 p) { vec2 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 o = vec2(h21(i + g), h21(i + g + 17.3));
    float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return d2 - d1; }`;

// Swaps a toon material's flat colour for one worked out in a shader, keeping its light, shadows and fog.
function shaded(uniforms, vertDecl, vertBody, fragDecl, fragColor) {
  const m = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: makeRamp() });
  m.userData.outlineParameters = { visible: false };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;\n' + vertDecl)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(position, 1.)).xyz;\n' + vertBody);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;\n' + NOISE + fragDecl)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4(1.);\n{ ${fragColor} }`);
  };
  // each shader its own program (three would otherwise share one between every material made here)
  const key = vertDecl + fragColor;
  m.customProgramCacheKey = () => key;
  return m;
}
function makeRamp() {
  const d = new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}

// A small particle: a mesh that flies, grows, fades and goes.
class Bit { constructor(obj, o) { Object.assign(this, { obj, v: new THREE.Vector3(), g: 0, life: 1, age: 0, s0: 1, s1: 1, a0: 1, a1: 0, spin: 0, drag: 0 }, o); } }

export class World {
  constructor(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.overlay = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, .5, 900);
    this.outline = new OutlineEffect(r, { defaultThickness: .005, defaultColor: INK });
    this.hemi = new THREE.HemisphereLight('#ffd9a0', '#7a4a2e', 1);
    this.sun = new THREE.DirectionalLight('#fff1d6', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -.0006; this.sun.shadow.normalBias = .03;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog('#efc78a', 80, 300);
    this.bits = []; this.anim = []; this.t = 0;
    this.cam = { x: 0, z: 0, d: 60, pitch: .98, yaw: 0 };
    this.rect = { x: 0, y: 0, w: 1, h: 1 };
    this.follow = -1;
    this.karts = []; this.things = new Map(); this.shotMeshes = new Map(); this.fixtures = []; this.override = {};
    this.raycaster = new THREE.Raycaster();
  }

  /* ---------- size and the camera ---------- */
  resize(rect) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.rect = rect || { x: 0, y: 0, w, h };
    this.applyCam();
  }
  // the camera looks down at (x, z) from d away, tilted toward the bottom of the screen; the view is framed on rect
  applyCam() {
    const cam = this.camera, c = this.cam, { x, y, w, h } = this.rect, cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
    if (w < 10 || h < 10) return;
    cam.aspect = w / h;
    // yaw 0 looks north, from the south; a tall, narrow frame turns it a quarter so a wide track runs up the screen
    const back = Math.cos(c.pitch) * c.d;
    cam.position.set(c.x + Math.sin(c.yaw) * back, Math.sin(c.pitch) * c.d, c.z + Math.cos(c.yaw) * back);
    cam.lookAt(c.x, 0, c.z);
    cam.near = Math.max(.5, c.d * .2); cam.far = c.d * 6 + 100;
    cam.setViewOffset(w, h, -x, -y, cw, ch);
    cam.updateProjectionMatrix();
    this.scene.fog.near = c.d * 1.5; this.scene.fog.far = c.d * 4.5 + 40;
  }
  // how far back the camera must be to show the whole track in the frame
  fitDistance() {
    const T = this.T; if (!T) return 60;
    const { x0, x1, z0, z1 } = T.box, saved = { ...this.cam };
    this.cam.x = (x0 + x1) / 2; this.cam.z = (z0 + z1) / 2;
    const pts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    let lo = 5, hi = 400;
    for (let i = 0; i < 26; i++) {
      const d = (lo + hi) / 2; this.cam.d = d; this.applyCam(); this.camera.clearViewOffset(); this.camera.updateProjectionMatrix();
      let ok = true;
      for (const p of pts) { const q = p.clone().project(this.camera); if (Math.abs(q.x) > .96 || Math.abs(q.y) > .94) { ok = false; break; } }
      if (ok) hi = d; else lo = d;
    }
    const d = hi; Object.assign(this.cam, saved); this.applyCam();
    return d;
  }
  fit(instant = true) {
    const T = this.T; if (!T) return;
    const { x0, x1, z0, z1 } = T.box;
    this.cam.yaw = this.rect.w / this.rect.h < .85 && (x1 - x0) > (z1 - z0) ? Math.PI / 2 : 0;
    const to = { x: (x0 + x1) / 2 + Math.sin(this.cam.yaw), z: (z0 + z1) / 2 + Math.cos(this.cam.yaw), d: this.fitDistance() };
    this.fitD = to.d;
    if (instant) { Object.assign(this.cam, to); this.applyCam(); } else this.glide = to;
    this.follow = -1; this.moved = false;
  }
  // the point on the ground under a point on the screen (client pixels)
  ground(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector2((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(v, this.camera);
    const ray = this.raycaster.ray, t = -ray.origin.y / ray.direction.y;
    if (!(t > 0)) return null;
    return { x: ray.origin.x + ray.direction.x * t, z: ray.origin.z + ray.direction.z * t };
  }
  panBy(dx, dz) { this.cam.x += dx; this.cam.z += dz; this.clampCam(); this.applyCam(); this.glide = null; this.moved = true; }
  zoomBy(f, cx, cy) {
    const before = cx != null ? this.ground(cx, cy) : null;
    this.cam.d = clamp(this.cam.d * f, 9, (this.fitD || 80) * 1.25);
    this.applyCam();
    if (before) { const after = this.ground(cx, cy); if (after) { this.cam.x += before.x - after.x; this.cam.z += before.z - after.z; } }
    this.clampCam(); this.applyCam(); this.glide = null; this.moved = true;
  }
  clampCam() { const b = this.T?.box; if (!b) return; this.cam.x = clamp(this.cam.x, b.x0 - 4, b.x1 + 4); this.cam.z = clamp(this.cam.z, b.z0 - 4, b.z1 + 8); }
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera), r = this.canvas.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, behind: v.z > 1 };
  }

  /* ---------- building a track ---------- */
  load(T) {
    this.clear();
    this.T = T;
    const L = this.look = LOOKS[T.def.theme];
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.bounce); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sun); this.sun.intensity = L.sunI;
    this.renderer.setClearColor(L.haze); this.scene.fog.color.set(L.haze);
    // the sun, and its shadow box round the track
    const { x0, x1, z0, z1 } = T.box, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const dir = new THREE.Vector3(...L.sunDir).normalize();
    this.sun.position.set(cx + dir.x * 80, dir.y * 80, cz + dir.z * 80); this.sun.target.position.set(cx, 0, cz);
    const sc = this.sun.shadow.camera, half = Math.max(x1 - x0, z1 - z0) * .62 + 8;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 10; sc.far = 200; sc.updateProjectionMatrix();
    this.field = distanceField(T);
    this.buildGround(T, L);
    for (const p of T.paths) this.buildRoad(T, p, L);
    const decor = buildDecor(this, T, L);
    for (const m of decor.meshes) this.root.add(m);
    this.anim.push(...decor.anim);
    this.buildFixtures(T);
    this.buildGrid(T);
    this.fit();
  }
  clear() {
    if (this.root) {
      this.scene.remove(this.root);
      this.root.traverse(o => { if (o.geometry && !Object.values(G).includes(o.geometry)) o.geometry.dispose(); });
    }
    for (const b of this.bits) this.scene.remove(b.obj);
    this.bits = []; this.anim = []; this.karts = []; this.things.clear(); this.shotMeshes.clear(); this.fixtures = []; this.override = {};
    while (this.overlay.children.length) this.overlay.remove(this.overlay.children[0]);
    this.root = null;
  }

  buildGround(T, L) {
    const F = this.field;
    const u = {
      uField: { value: F.tex }, uBox: { value: new THREE.Vector4(F.x0, F.z0, F.w / F.res, F.h / F.res) },
      uSand: { value: new THREE.Color(L.sand) }, uSand2: { value: new THREE.Color(L.sand2) }, uLine: { value: new THREE.Color(L.ripple) },
      uCrack: { value: new THREE.Color(L.crack) }, uShoulder: { value: new THREE.Color(L.shoulder) }, uAbyss: { value: new THREE.Color(L.abyss || '#2a1410') },
      uCliff: { value: new THREE.Color(L.cliff || '#8f4a2e') }, uCracks: { value: L.cracks ?? .6 }, uRip: { value: L.ripples ?? 1 },
    };
    const mat = shaded(u, '', '', `uniform sampler2D uField; uniform vec4 uBox; uniform vec3 uSand, uSand2, uLine, uCrack, uShoulder, uAbyss, uCliff; uniform float uCracks, uRip;`, `
      vec2 p = vW.xz;
      vec4 f = texture2D(uField, (p - uBox.xy) / uBox.zw);
      float d = f.r * 24.;
      float n1 = vnoise(p * .07), n2 = vnoise(p * .21 + 7.), n3 = vnoise(p * 2.3);
      vec3 col = n1 + n2 * .4 > .82 ? uSand2 : uSand;
      float rip = sin(dot(p, vec2(.55, .83)) * 2.2 + n1 * 9. + n2 * 4.);
      col = mix(col, uLine, step(.94, rip) * smoothstep(1.5, 4., d) * uRip);
      float pm = vnoise(p * .045 + 31.);
      if (pm > uCracks) { float c = cells(p * 1.15); col = mix(col, uCrack, (1. - smoothstep(.025, .06, c)) * smoothstep(uCracks, uCracks + .06, pm) * .75); }
      col = mix(col, uLine, step(.88, n3) * .4);
      col = mix(col, uShoulder, 1. - smoothstep(.5, 1.7, d + n2 * .7));
      float ch = f.g * 12.;
      if (ch < 3.2) {
        float k = ch / 3.2;
        vec3 wall = mix(uCliff, uAbyss, step(.5, fract(k * 3. + n2 * .4)) * .35);
        col = k > .86 ? uCliff * 1.15 : mix(uAbyss, wall, smoothstep(.25, .85, k));
      }
      diffuseColor.rgb = col;`);
    const g = new THREE.PlaneGeometry(F.w / F.res + 400, F.h / F.res + 400, 1, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat); m.position.set(F.x0 + F.w / F.res / 2, 0, F.z0 + F.h / F.res / 2); m.receiveShadow = true;
    this.root.add(m);
  }

  buildRoad(T, p, L) {
    const rows = p.closed ? p.count + 1 : p.count, def = T.def;
    const pos = [], lat = [], sd = [], lane = [], edge = [], junc = [], idx = [];
    const bridge = p.id === 0 && def.bridge ? [def.bridge[0] * p.L, def.bridge[1] * p.L] : null;
    // where a shortcut leaves or joins, no kerb is painted on that side (of the loop, and of the shortcut)
    const open = s => {
      let l = 0, r = 0;
      const near = (a, b) => p.closed ? Math.abs(((a - b) % p.L + p.L * 1.5) % p.L - p.L / 2) : Math.abs(a - b);
      for (const b of T.paths.slice(1)) {
        if (p.id === 0) { if ((near(s, b.from + 3) < 4.5) || near(s, b.to - 3) < 4.5) b.side < 0 ? l = 1 : r = 1; }
        else if (p.id === b.id && (s < 7.5 || s > p.L - 7.5)) b.side < 0 ? r = 1 : l = 1;
      }
      return [l, r];
    };
    for (let r = 0; r < rows; r++) {
      const i = r % p.count, s = r * p.step, jn = open(s);
      for (const x of [p.lo[i], p.hi[i]]) {
        const q = point(p, i * p.step, x);
        pos.push(q.x, p.id ? .012 : .02, q.z);
        lat.push(x); sd.push(s); lane.push(p.n[i], p.c[i]); edge.push(p.lo[i], p.hi[i], bridge && s > bridge[0] && s < bridge[1] ? 1 : 0, p.id); junc.push(...jn);
      }
      if (r < rows - 1) { const a = r * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, k) => k % 3 === 1 ? 1 : 0), 3));
    geo.setAttribute('lat', new THREE.Float32BufferAttribute(lat, 1));
    geo.setAttribute('sd', new THREE.Float32BufferAttribute(sd, 1));
    geo.setAttribute('lane', new THREE.Float32BufferAttribute(lane, 2));
    geo.setAttribute('edge', new THREE.Float32BufferAttribute(edge, 4));
    geo.setAttribute('junc', new THREE.Float32BufferAttribute(junc, 2));
    geo.setIndex(idx);
    const u = {
      uRoad: { value: new THREE.Color(L.road) }, uRoad2: { value: new THREE.Color(L.road2) }, uPaint: { value: new THREE.Color(L.paint) },
      uCurbA: { value: new THREE.Color(L.curbA) }, uCurbB: { value: new THREE.Color(L.curbB) }, uWood: { value: new THREE.Color('#a8703e') }, uWood2: { value: new THREE.Color('#8a5630') },
      uL: { value: p.L },
    };
    const mat = shaded(u, 'attribute float lat, sd; attribute vec2 lane, junc; attribute vec4 edge; varying float vLat, vS; varying vec2 vLane, vJunc; varying vec4 vEdge;',
      'vLat = lat; vS = sd; vLane = lane; vEdge = edge; vJunc = junc;',
      'uniform vec3 uRoad, uRoad2, uPaint, uCurbA, uCurbB, uWood, uWood2; uniform float uL; varying float vLat, vS; varying vec2 vLane, vJunc; varying vec4 vEdge;', `
      float n = vLane.x, c = vLane.y, lo = vEdge.x, hi = vEdge.y;
      float lf = vLat - (c - n * .5);            // lanes from the left
      float il = fract(lf);
      vec2 p = vW.xz;
      float m1 = vnoise(p * .9), m2 = vnoise(p * 3.1 + 3.);
      vec3 col = m1 + m2 * .3 > .78 ? uRoad2 : uRoad;
      float rut = max(smoothstep(.09, .02, abs(il - .27)), smoothstep(.09, .02, abs(il - .73)));
      col = mix(col, uRoad2 * .92, rut * .65 * step(.35, m2 + .2));
      float de = min(vLat - lo, hi - vLat);
      if (vEdge.z > .5) {
        // the rope bridge: planks across, with gaps, and the ropes along its sides
        float pl = fract(vS * 2.6);
        col = pl < .12 ? uWood2 * .45 : (fract(vS * .93 + m1 * .2) > .5 ? uWood : uWood2);
        col = mix(col, uWood2 * .7, smoothstep(.2, .0, de));
      } else {
        float div = (1. - smoothstep(.035, .06, min(il, 1. - il))) * step(.5, lf) * step(lf, n - .5) * step(.45, fract(vS * .55));
        col = mix(col, uPaint, div * .85 * step(.25, m2 + .3));
        float curb = (1. - smoothstep(.13, .15, de)) * (1. - (vLat - lo < hi - vLat ? vJunc.x : vJunc.y));
        col = mix(col, mod(floor(vS * 1.4), 2.) < 1. ? uCurbA : uCurbB, curb);
        if (vEdge.w < .5 && (vS < .55 || vS > uL - .02)) {
          float ck = mod(floor(vLat * 4.) + floor(vS * 4.), 2.);
          col = mix(uPaint, vec3(.08, .06, .05), ck);
        }
      }
      diffuseColor.rgb = col;`);
    mat.polygonOffset = true; mat.polygonOffsetFactor = -1 - p.id; mat.polygonOffsetUnits = -2;
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true;
    this.root.add(m);
  }

  // faint marks across the road at the squares' ends, shown while something's being put down
  buildGrid(T) {
    this.grids = [];
    for (const p of T.paths) {
      const pos = [];
      for (let i = 0; i < p.cells; i++) {
        const s = i * p.cellLen, [k] = sampleAt(p, s), a = point(p, s, p.lo[k] + .1), b = point(p, s, p.hi[k] - .1);
        const nx = a.tx * .05, nz = a.tz * .05;
        pos.push(a.x - nx, .05, a.z - nz, b.x - nx, .05, b.z - nz, a.x + nx, .05, a.z + nz, b.x - nx, .05, b.z - nz, b.x + nx, .05, b.z + nz, a.x + nx, .05, a.z + nz);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const m = new THREE.Mesh(g, flat('#fff6e0', { opacity: .55, side: THREE.DoubleSide })); m.visible = false; m.renderOrder = 3;
      this.overlay.add(m); this.grids.push(m);
    }
    // the square under the pointer, the squares too near the karts, and where the karts are headed
    this.cellMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flat('#7dff8a', { opacity: .55, side: THREE.DoubleSide }));
    this.cellMesh.visible = false; this.cellMesh.renderOrder = 4; this.overlay.add(this.cellMesh);
    this.nearGroup = new THREE.Group(); this.overlay.add(this.nearGroup);
    this.nearPool = [];
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 3000), 3));
    fg.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(3 * 3000), 3));
    this.trails = new THREE.Points(fg, new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: .95, depthTest: false }));
    this.trails.renderOrder = 6; this.trails.frustumCulled = false; this.trails.visible = false;
    this.overlay.add(this.trails);
  }
  showGrid(on) { for (const g of this.grids || []) g.visible = on; }
  // a square, green where it can go and red where it can't
  showCell(cell, ok) {
    const m = this.cellMesh;
    if (!cell) { m.visible = false; return; }
    const p = this.T.paths[cell.path], q = point(p, cell.s, cell.x);
    m.visible = true;
    m.position.set(q.x, .06, q.z);
    m.rotation.set(-Math.PI / 2, 0, headingOf(q.tx, q.tz));
    m.scale.set(.92, p.cellLen * .94, 1);
    m.material.color.set(ok ? '#7dff8a' : '#ff5a4a');
  }
  // the stretch in front of each kart where nothing can be put down
  showNear(S, on) {
    const T = this.T;
    for (const m of this.nearPool) m.visible = false;
    if (!on || !S) return;
    let n = 0;
    for (const k of S.karts) {
      if (k.fin) continue;
      const p = T.paths[k.path];
      for (let d = -.5; d < NEAR; d += .5) {
        let path = k.path, s = k.s + d;
        if (!p.closed && s > p.L) { path = 0; s = p.to + (s - p.L); }
        const pp = T.paths[path], [i] = sampleAt(pp, s), q = point(pp, s, (pp.lo[i] + pp.hi[i]) / 2);
        let m = this.nearPool[n];
        if (!m) { m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flat('#ff3a2a', { opacity: .2, side: THREE.DoubleSide })); m.renderOrder = 2; this.nearGroup.add(m); this.nearPool.push(m); }
        m.visible = true; n++;
        m.position.set(q.x, .045, q.z); m.rotation.set(-Math.PI / 2, 0, headingOf(q.tx, q.tz)); m.scale.set(pp.hi[i] - pp.lo[i], .52, 1);
      }
    }
  }
  // dotted lines: where each kart will be over the next few seconds, if nothing changes
  showTrails(list) {
    const t = this.trails;
    if (!list) { t.visible = false; return; }
    const pa = t.geometry.attributes.position, ca = t.geometry.attributes.color, c = new THREE.Color();
    let n = 0;
    for (const tr of list) {
      c.set(tr.color);
      for (const [x, z, a] of tr.pts) {
        if (n >= 3000) break;
        pa.setXYZ(n, x, .12, z);
        const f = .45 + .55 * a; ca.setXYZ(n, c.r * f + (1 - f), c.g * f + (1 - f), c.b * f + (1 - f));
        n++;
      }
    }
    t.geometry.setDrawRange(0, n);
    pa.needsUpdate = true; ca.needsUpdate = true;
    t.visible = true;
  }

  /* ---------- the track's traps ---------- */
  buildFixtures(T) {
    this.fixtures = [];
    for (const f of T.def.fixtures || []) {
      const p = T.paths[f.path || 0], s0 = f.at * p.L, len = f.len || 2.5, mid = s0 + len / 2, [i] = sampleAt(p, mid);
      const side = f.side || 1, edge = side > 0 ? p.hi[i] : p.lo[i];
      const fx = { def: f, kind: f.kind, s0, len, path: p.id, side };
      const base = point(p, mid, edge + side * (f.kind === 'magnet' ? 2.4 : f.kind === 'flare' ? 1.4 : f.kind === 'boulder' ? 2.2 : 1.6));
      fx.base = base; fx.yaw = headingOf(base.tx, base.tz);
      if (f.kind === 'worm') {
        const mound = makeMound(); mound.position.set(base.x, 0, base.z); this.root.add(mound);
        const worm = makeWorm(); worm.visible = false; this.root.add(worm);
        Object.assign(fx, { mound, worm, model: mound });
      } else if (f.kind === 'magnet') {
        const crane = makeCrane(); crane.position.set(base.x, 0, base.z); this.root.add(crane);
        // the boom points across the road
        const mp = point(p, mid, 0), ang = Math.atan2(-(mp.z - base.z), mp.x - base.x);
        crane.userData.top.rotation.y = ang + Math.PI; fx.restYaw = ang + Math.PI;
        Object.assign(fx, { crane, model: crane });
      } else if (f.kind === 'boulder') {
        const ledge = makeBoulderLedge(); ledge.position.set(base.x, 0, base.z); ledge.rotation.y = fx.yaw + (side > 0 ? Math.PI / 2 : -Math.PI / 2); this.root.add(ledge);
        const rock = new THREE.Group(); rock.add(part(G.stone, toon('#c87a48'), [0, 0, 0], [.66]));
        for (let k = 0; k < 6; k++) rock.add(part(G.stone, toon('#a85e36'), [Math.cos(k * 1.1) * .5, Math.sin(k * 2.3) * .4, Math.sin(k * 1.1) * .5], [.18, .14, .18], [k, k * 2, 0]));
        rock.visible = false; this.root.add(rock);
        Object.assign(fx, { ledge, rock, model: ledge });
      } else if (f.kind === 'flare') {
        const stack = makeFlareStack(); stack.position.set(base.x, 0, base.z);
        const mp = point(p, mid, 0); stack.rotation.y = Math.atan2(-(mp.z - base.z), mp.x - base.x) + Math.PI;
        this.root.add(stack);
        const pilot = makeFlame(1.4); stack.userData.pilot.add(pilot);
        const jets = [];
        for (let k = 0; k < 3; k++) { const j = makeFlame(4.2 - k * .8); j.rotation.x = Math.PI; j.visible = false; stack.userData.fire.add(j); jets.push(j); }
        Object.assign(fx, { stack, pilot, jets, model: stack });
      }
      this.fixtures.push(fx);
    }
    // the shortcut gates, where each shortcut leaves the loop
    this.gates = [];
    for (const b of T.paths.slice(1)) {
      if (!b.gate) continue;
      // a little way up the shortcut, where it's left the loop, with its arm swinging down across it
      const q = point(b, 8, .85), gm = makeGate();
      gm.position.set(q.x, 0, q.z); gm.rotation.y = headingOf(q.tx, q.tz);
      this.root.add(gm);
      this.gates.push({ id: b.gate, model: gm, path: b.id, open: 1 });
    }
  }
  // where a trap's button goes on screen
  fixtureAnchor(id) {
    const fx = this.fixtures.find(f => f.def.id === id);
    if (fx) return { x: fx.base.x, y: fx.kind === 'magnet' ? 3.6 : fx.kind === 'flare' ? 3.9 : 1.6, z: fx.base.z };
    const g = this.gates.find(g => g.id === id);
    if (g) { const b = this.T.paths[g.path], q = point(b, 3.6, b.side * 2.4); return { x: q.x, y: .8, z: q.z }; }
    return null;
  }

  /* ---------- a race ---------- */
  setRace(S) {
    for (const k of this.karts) this.root.remove(k.model);
    for (const m of this.things.values()) this.root.remove(m);
    for (const m of this.shotMeshes.values()) this.root.remove(m);
    this.things.clear(); this.shotMeshes.clear(); this.override = {};
    for (const b of this.bits) this.scene.remove(b.obj);
    this.bits = [];
    for (const m of this.skids || []) this.root.remove(m);
    this.skids = [];
    for (const g of this.ghosts || []) this.root.remove(g.m);
    this.ghosts = [];
    this.karts = S.karts.map(k => {
      const model = makeKart(k.who, RACERS[k.who].color);
      model.scale.setScalar(1.22);
      this.root.add(model);
      const flames = model.userData.flames.map(([x, y, z, dx, dy, dz]) => {
        const f = makeFlame(.9); f.position.set(x, y, z);
        f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
        f.visible = false; model.userData.body.add(f); return f;
      });
      return { model, flames, yaw: 0, px: null, pz: null, roll: 0, dust: 0, spinA: 0, last: null };
    });
    this.sync(S, 0, true);
  }

  // Shows the race as it stands. dir is -1 while it's being rewound: the karts then move backwards, so they're
  // turned by where they came from, wheels turn back, and nothing new is thrown up behind them.
  sync(S, dt, snap = false, dir = 1) {
    const T = this.T, back = dir < 0, adt = Math.abs(dt);
    this.S = S;
    // the traps first: they say where the karts they've got hold of are (in the worm's mouth, under the magnet)
    this.override = {};
    for (const fx of this.fixtures) this.fixture(fx, S, dt, back);
    // karts
    S.karts.forEach((k, i) => {
      const v = this.karts[i]; if (!v) return;
      const m = v.model, body = m.userData.body, p = T.paths[k.path], q = point(p, k.s, k.x);
      const o = this.override[i];
      // heading: along the road, turned toward where it's steering
      let yaw = headingOf(q.tx, q.tz);
      if (v.px != null && !snap) {
        const dx = (q.x - v.px) * dir, dz = (q.z - v.pz) * dir;
        if (dx * dx + dz * dz > 1e-6 && k.spin <= 0 && dx * q.tx + dz * q.tz > 0) yaw = headingOf(dx, dz);
      }
      v.yaw = snap ? yaw : v.yaw + wrapAng(yaw - v.yaw) * Math.min(1, adt * (back ? 30 : 14));
      const moved = v.px == null ? 0 : Math.hypot(q.x - v.px, q.z - v.pz);
      v.px = q.x; v.pz = q.z;
      m.position.set(q.x, 0, q.z);
      m.rotation.y = v.yaw;
      // what's happening to it
      let y = 0, rx = 0, rz = 0, ry = 0, sy = 1, sxz = 1;
      if (k.spin > 0) { const t = 1 - k.spin / k.spinMax; ry = easeOut(t) * Math.PI * 4; }
      if (k.air > 0) { const t = 1 - k.air / k.airMax; y = Math.sin(t * Math.PI) * 1.5; rx = t * Math.PI * 2; }
      if (k.jump > 0) { const t = 1 - k.jump / k.jumpMax; y = Math.sin(t * Math.PI) * .75; rx = -Math.cos(t * Math.PI) * .25; }
      if (k.squash > 0) { const t = k.squash; sy = t > .3 ? .22 : lerp(1, .22, t / .3); sxz = lerp(1, 1.35, (1 - sy) / .78); }
      if (k.stun > 0) { rz = Math.sin(this.t * 40) * .06 * (k.stun / .75); }
      if (k.flat > 0) { rz += .1 + Math.sin(this.t * 22) * .03; }
      if (k.lift > 0) { const t = 2.2 - k.lift; y = t < .35 ? easeOut(t / .35) * 1.3 : 1.3 + Math.sin(this.t * 3) * .05; rz = Math.sin(this.t * 2.6) * .15; }
      if (k.lift <= 0 && v.wasLift && !back) { v.drop = .35; }
      v.wasLift = k.lift > 0;
      if (v.drop > 0) { v.drop -= adt; y = Math.max(0, v.drop / .35) ** 2 * 1.3; }
      // leaning into lane changes, and bobbing along
      const lean = clamp((k.tx - k.x) * .25, -.18, .18);
      v.roll = lerp(v.roll, lean, Math.min(1, adt * 8));
      body.position.y = y + (k.v > .5 ? Math.abs(Math.sin(this.t * 17 + i)) * .015 : 0);
      body.rotation.set(rx, ry, rz - v.roll);
      body.scale.set(sxz, sy, sxz);
      m.visible = k.gone <= 0;
      if (o) { if (o.visible != null) m.visible = o.visible; if (o.y != null) body.position.y = o.y; if (o.x != null) { m.position.x = o.x; m.position.z = o.z; } }
      m.userData.blob.visible = body.position.y < .6;
      for (const w of m.userData.wheels) w.rotation.x -= moved / .1 * dir;
      for (const e of m.userData.parts) e.rotation.x = Math.sin(this.t * 14 + i) * .4;
      setChrome(m, k.chrome > 0);
      if (k.chrome > 0 && !snap && !back && m.visible && Math.random() < adt * 9) this.sparkle(q.x + (Math.random() - .5) * .6, .5 + Math.random() * .4, q.z + (Math.random() - .5) * .6, '#ffffff', 2);
      const fire = k.boost > 0 || k.chrome > 0;
      for (const f of v.flames) { f.visible = fire; if (fire) { const s = .8 + Math.random() * .5; f.scale.set(s, s * (k.boost > 0 ? 1.4 : 1), s); } }
      // dust behind it, and marks where it spins
      if (!snap && !back && k.v > 3 && body.position.y < .1 && m.visible) {
        v.dust += dt * k.v;
        if (v.dust > 1.6) { v.dust = 0; this.dust(q.x - q.tx * .45, q.z - q.tz * .45, this.look.dust, .7); }
      }
      if (!snap && !back && k.spin > 0 && m.visible) { v.skid = (v.skid || 0) + dt; if (v.skid > .05) { v.skid = 0; this.skid(q.x, q.z, v.yaw + ry); } }
      if (!snap && !back && k.scrape > 0 && Math.random() < .5) this.sparks(q.x, .1, q.z, 2);
      // rewinding: an after-image in the driver's colour wherever it's just been
      if (back && moved > .25 && m.visible) this.ghost(q.x, q.z, RACERS[k.who].color, v.yaw);
    });
    // what's on the road
    const seen = new Set();
    for (const o of S.objs) {
      seen.add(o.id);
      let m = this.things.get(o.id);
      if (!m) {
        m = makeThing(o.kind, o.id * 7 + 3);
        const p = T.paths[o.path], q = point(p, o.s, o.x);
        m.position.set(q.x, 0, q.z); m.rotation.y = headingOf(q.tx, q.tz);
        this.root.add(m); this.things.set(o.id, m);
        if (!snap && !back && o.by === 'you') { m.userData.pop = 0; }
      }
      m.visible = !(o.off > S.t);
      if (m.userData.pop != null) { m.userData.pop += adt; const t = clamp(m.userData.pop / .25, 0, 1); m.scale.setScalar(.4 + .6 * easeOut(t) + Math.sin(t * Math.PI) * .15); if (t >= 1) { m.userData.pop = null; m.scale.setScalar(1); } }
      if (o.kind === 'oil' && o.hp === 1 && o.by === 'you') m.scale.setScalar(.75);
    }
    for (const [id, m] of this.things) if (!seen.has(id)) { this.root.remove(m); this.things.delete(id); }
    // rockets and vultures
    const live = new Set();
    for (const sh of S.shots) {
      live.add(sh.id);
      let m = this.shotMeshes.get(sh.id);
      if (!m) {
        m = sh.kind === 'vulture' ? makeVulture() : makeRocket(sh.kind === 'homing');
        if (sh.kind === 'vulture') { const from = this.karts[sh.by]?.model.position; m.userData.from = from ? from.clone() : new THREE.Vector3(); m.userData.from.y = 1; }
        this.root.add(m); this.shotMeshes.set(sh.id, m);
      }
      if (sh.kind === 'vulture') {
        const tg = this.karts[sh.target]?.model.position, f = m.userData.from, t = clamp(sh.t / sh.dur, 0, 1);
        if (tg) {
          m.position.set(lerp(f.x, tg.x, t), 1 + Math.sin(t * Math.PI) * 4 + (1 - t) * 1.5 + t * 1.2, lerp(f.z, tg.z, t));
          m.rotation.y = Math.atan2(-(tg.x - f.x), -(tg.z - f.z));
        }
        for (const [k, w] of m.userData.wings.entries()) w.rotation.z = Math.sin(this.t * 14) * .6 * (k ? -1 : 1);
        m.userData.bomb.visible = t < .97;
      } else {
        const p = T.paths[sh.path], q = point(p, sh.s, sh.x);
        m.position.set(q.x, .38, q.z); m.rotation.y = headingOf(q.tx, q.tz);
        if (!snap && !back && Math.random() < .7) this.dust(q.x - q.tx * .3, q.z - q.tz * .3, '#d8d0c8', .45, .35);
      }
    }
    for (const [id, m] of this.shotMeshes) if (!live.has(id)) { this.root.remove(m); this.shotMeshes.delete(id); }
    // the gates
    for (const g of this.gates || []) {
      const open = S.gates[g.id] !== false;
      g.open = lerp(g.open, open ? 1 : 0, Math.min(1, adt * (back ? 20 : 6)));
      if (snap) g.open = open ? 1 : 0;
      g.model.userData.arm.rotation.z = -g.open * 1.35;
    }
  }

  fixture(fx, S, dt, back) {
    const f = S.fx.find(f => f.id === fx.def.id); if (!f) return;
    const t = S.t - f.at, k = f.victim >= 0 ? S.karts[f.victim] : null, kv = k ? this.karts[k.i] : null;
    const T = this.T;
    fx.armedLook = f.armed;
    if (fx.kind === 'worm') {
      const w = fx.worm, segs = w.userData.segs;
      fx.mound.userData.flag.rotation.y = Math.sin(this.t * 3) * .4;
      fx.mound.position.y = f.armed ? Math.sin(this.t * 30) * .03 : 0;
      if (f.armed && !back && Math.random() < .1) this.dust(fx.base.x + (Math.random() - .5), fx.base.z + (Math.random() - .5), this.look.dust, .8);
      const showing = k && t >= 0 && (t < .9 || (t > 2.0 && t < 2.9));
      w.visible = !!showing;
      if (showing) {
        const q = point(T.paths[k.path], k.s, k.x);
        const phase = t < 1 ? t / .9 : (t - 2) / .9;
        const h = Math.sin(clamp(phase, 0, 1) * Math.PI) * 2.6;
        w.position.set(q.x, 0, q.z);
        segs.forEach((sg, j) => { const y = h - j * .42; sg.position.set(Math.sin(this.t * 6 + j * .7) * .08 * j, y, Math.sin(this.t * 4 + j) * .05 * j); sg.visible = y > -.4; sg.rotation.x = Math.PI / 2; });
        // up it comes with the kart in its mouth, and down it goes; later it comes back up and spits it out
        if (t < .9) this.override[k.i] = { visible: t < .3, y: Math.max(0, h - .3) };
        else this.override[k.i] = { visible: t > 2.35, y: t > 2.35 ? Math.max(0, h + .3) : 0 };
        if (!back && fx.burst !== f.at + (t < 1 ? 0 : 2)) { fx.burst = f.at + (t < 1 ? 0 : 2); this.ring(q.x, q.z, this.look.dust, 1.6); this.debris(q.x, q.z, this.look.shoulder, 14); }
      }
    } else if (fx.kind === 'magnet') {
      const cr = fx.crane.userData;
      const busy = k && t >= 0 && t < 2.8;
      let yaw = fx.restYaw + Math.sin(this.t * .5) * .05, reach = cr.reach, drop = 0;
      cr.glow.material.opacity = f.armed ? .3 + .3 * Math.sin(this.t * 12) : 0;
      if (busy) {
        const kp = this.karts[k.i].model.position, dx = kp.x - fx.base.x, dz = kp.z - fx.base.z;
        yaw = Math.atan2(-dz, dx) + Math.PI; reach = Math.hypot(dx, dz);
        drop = t < .3 ? t / .3 : t < 2.2 ? 1 : 1 - (t - 2.2) / .6;
        cr.glow.material.opacity = t < 2.2 ? .7 : 0;
        if (t > .3 && t < 2.2) this.override[k.i] = { y: 1.25 - .15 * Math.cos(this.t * 3) };
      }
      cr.top.rotation.y = lerp(cr.top.rotation.y, yaw, busy ? .35 : .08);
      const rr = clamp(reach, 1.5, 6);
      cr.mag.position.x = -rr; cr.cable.position.x = -rr;
      const hang = 1.35 + drop * (cr.hang - 1.5);
      cr.mag.position.y = -hang; cr.cable.scale.y = hang + .1; cr.cable.position.y = -hang / 2;
    } else if (fx.kind === 'boulder') {
      const ball = fx.ledge.userData.ball, rock = fx.rock;
      ball.visible = !(k && t >= 0 && t < 6);
      fx.ledge.userData.log.rotation.x = f.armed ? Math.sin(this.t * 25) * .08 : 0;
      if (f.armed && !back && Math.random() < .05) this.debris(fx.base.x, fx.base.z, '#b0603a', 2);
      if (k && t >= 0 && t < 1.4) {
        const p = T.paths[f.path], q0 = point(p, f.s0 + .3, (fx.side > 0 ? p.hi[sampleAt(p, f.s0)[0]] + 1 : p.lo[sampleAt(p, f.s0)[0]] - 1));
        const q1 = point(p, f.s0 + .3, (fx.side > 0 ? p.lo[sampleAt(p, f.s0)[0]] - 6 : p.hi[sampleAt(p, f.s0)[0]] + 6));
        const u = t / 1.4;
        rock.visible = true;
        rock.position.set(lerp(q0.x, q1.x, u), .62 + Math.abs(Math.sin(u * 9)) * .15 * (1 - u), lerp(q0.z, q1.z, u));
        rock.rotation.z -= dt * 9; rock.rotation.y = Math.atan2(q1.x - q0.x, q1.z - q0.z);
        if (!back && Math.random() < .5) this.dust(rock.position.x, rock.position.z, this.look.dust, 1);
      } else rock.visible = false;
    } else if (fx.kind === 'flare') {
      const lit = k && t >= 0 && t < .7;
      for (const [j, jet] of fx.jets.entries()) { jet.visible = lit; if (lit) { const s = 1 + Math.random() * .3; jet.scale.set(s, s * (1 + j * .1), s); } }
      const ps = f.armed ? 1.6 + Math.random() * .6 : .9 + Math.random() * .2;
      fx.pilot.scale.set(ps, ps, ps);
      if (lit && !back && Math.random() < .8) { const p = T.paths[f.path], q = point(p, f.s0 + Math.random() * fx.len, (Math.random() - .5) * 3); this.puff(q.x, .3, q.z, { color: Math.random() < .5 ? '#ff8a1a' : '#ffd23a', n: 1, up: 1.5, life: .4, s0: 1.5, s1: .4 }); }
    }
  }

  /* ---------- what happened: bangs, puffs and sparks ---------- */
  event(e, S) {
    const T = this.T, kart = e.k != null ? S.karts[e.k] : null;
    const where = () => { if (kart) { const p = T.paths[kart.path], q = point(p, kart.s, kart.x); return q; } if (e.path != null) return point(T.paths[e.path], e.s, e.x); return null; };
    const q = where();
    switch (e.type) {
      case 'spin': if (q) this.splat(q.x, q.z, '#231d2c'); break;
      case 'flat': if (q) { this.sparks(q.x, .15, q.z, 14); this.puff(q.x, .2, q.z, { color: '#ffffff', n: 5 }); } break;
      case 'crash': if (q) { this.sparks(q.x, .25, q.z, 10); this.staves(q.x, q.z, e.kind === 'rubble' ? '#b0603a' : '#d24a2e', 12); this.stars(e.k); } break;
      case 'smash': if (q) this.staves(q.x, q.z, '#d24a2e', 10); break;
      case 'boom': case 'blast': case 'bomb': if (q) this.boom(q.x, q.z, e.type === 'bomb' ? 1.3 : 1); break;
      case 'pop': if (q) { this.staves(q.x, q.z, e.kind === 'barrel' ? '#d24a2e' : e.kind === 'crate' ? '#b07a3e' : '#8b8f98', 10); this.puff(q.x, .3, q.z, { color: '#e8e0d8', n: 6 }); } break;
      case 'boost': case 'jump': if (q) this.dust(q.x, q.z, '#ffd23a', 1.2, .6); break;
      case 'item': case 'crate': if (q) { this.staves(q.x, q.z, '#b07a3e', 8); this.sparkle(q.x, .6, q.z, '#ffe066', 8); } break;
      case 'chrome': if (q) this.sparkle(q.x, .6, q.z, '#ffffff', 16); break;
      case 'clang': if (q) this.sparkle(q.x, .6, q.z, '#ffffff', 10); break;
      case 'shove': if (q) this.sparks(q.x, .25, q.z, 8); break;
      case 'finish': if (q) this.confetti(q.x, q.z, 30); break;
      case 'trap': if (e.kind === 'flare' || e.kind === 'boulder') { const fx = this.fixtures.find(f => f.def.id === e.id); if (fx) this.dust(fx.base.x, fx.base.z, this.look.dust, 2); } break;
      case 'drop': if (q) { this.dust(q.x, q.z, this.look.dust, 1.4); this.puff(q.x, .1, q.z, { color: this.look.dust, n: 8, speed: 2 }); } break;
      case 'spit': if (q) this.puff(q.x, .4, q.z, { color: '#c98a5a', n: 10, speed: 2.2, up: 2 }); break;
      case 'place': break;
    }
  }
  bit(obj, o) { this.scene.add(obj); const b = new Bit(obj, o); b.base = obj.scale.x; this.bits.push(b); return b; }
  puff(x, y, z, o = {}) {
    const n = o.n ?? 6;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(this.puffGeo ||= new THREE.IcosahedronGeometry(.12, 1), flat(o.color || '#ffffff', { opacity: 1 }));
      const a = Math.random() * Math.PI * 2, sp = (o.speed ?? 1) * (.3 + Math.random() * .7);
      s.position.set(x + Math.cos(a) * .1, y, z + Math.sin(a) * .1);
      this.bit(s, { v: new THREE.Vector3(Math.cos(a) * sp, (o.up ?? .6) * (.5 + Math.random()), Math.sin(a) * sp), g: o.g ?? 0, life: (o.life ?? .7) * (.7 + Math.random() * .5), s0: o.s0 ?? .7, s1: o.s1 ?? 2, a0: o.a ?? .85, a1: 0, drag: o.drag ?? 2.5 });
    }
  }
  dust(x, z, color, size = 1, life = .6) { this.puff(x, .08, z, { color, n: 1, speed: .3, up: .35, life, s0: .5 * size, s1: 1.8 * size, a: .55 }); }
  ring(x, z, color, size = 1) {
    const m = new THREE.Mesh(new THREE.RingGeometry(.5, .8, 32), flat(color, { opacity: .8, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, .08, z);
    this.bit(m, { life: .6, s0: .6 * size, s1: 2.6 * size, a0: .8, a1: 0 });
  }
  sparks(x, y, z, n = 8) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(this.sparkGeo ||= new THREE.BoxGeometry(.03, .03, .12), flat(Math.random() < .5 ? '#ffe24a' : '#ff9a2a', { opacity: 1 }));
      const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 2.5;
      s.position.set(x, y, z); s.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      this.bit(s, { v: new THREE.Vector3(Math.cos(a) * sp, 1 + Math.random() * 2.5, Math.sin(a) * sp), g: 9, life: .35 + Math.random() * .25, s0: 1, s1: .3, a0: 1, a1: .6, drag: 1, spin: 10 });
    }
  }
  staves(x, z, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(this.staveGeo ||= new THREE.BoxGeometry(.06, .03, .2), toon(color));
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
      s.position.set(x, .25, z); s.rotation.set(Math.random() * 6, Math.random() * 6, 0); s.castShadow = true;
      this.bit(s, { v: new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random() * 2.5, Math.sin(a) * sp), g: 10, life: .9 + Math.random() * .4, s0: 1, s1: .7, a0: 1, a1: 1, drag: .5, spin: 9, sink: true, keepMat: true });
    }
  }
  debris(x, z, color, n = 8) { this.staves(x, z, color, n); }
  boom(x, z, size = 1) {
    // a cartoon fireball: a white flash, an orange ball, then black smoke rolling up
    const flash = new THREE.Mesh(this.puffGeo ||= new THREE.IcosahedronGeometry(.12, 1), flat('#fff6c8', { opacity: 1 }));
    flash.position.set(x, .5, z); this.bit(flash, { life: .18, s0: 4 * size, s1: 9 * size, a0: 1, a1: 0 });
    this.puff(x, .5, z, { color: '#ff9a1a', n: 8, speed: 2.4 * size, up: 2, life: .5, s0: 2.2 * size, s1: 1, drag: 4 });
    this.puff(x, .6, z, { color: '#ffd23a', n: 5, speed: 1.6 * size, up: 2.5, life: .4, s0: 1.6 * size, s1: .6, drag: 4 });
    this.puff(x, .8, z, { color: '#3a3030', n: 7, speed: 1 * size, up: 2.2, life: 1.1, s0: 1.4 * size, s1: 3.2 * size, drag: 2, a: .8 });
    this.ring(x, z, '#ffd9a0', 1.2 * size);
    this.sparks(x, .4, z, 10);
  }
  splat(x, z, color) {
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(this.puffGeo ||= new THREE.IcosahedronGeometry(.12, 1), flat(color, { opacity: 1 }));
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random();
      s.position.set(x, .15, z);
      this.bit(s, { v: new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random(), Math.sin(a) * sp), g: 10, life: .5, s0: .6, s1: .3, a0: 1, a1: .8, drag: .5 });
    }
  }
  sparkle(x, y, z, color = '#fff27a', n = 12) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(this.starGeo ||= starGeo(), flat(color, { opacity: 1, side: THREE.DoubleSide }));
      const a = Math.random() * Math.PI * 2, sp = .8 + Math.random() * 1.2;
      s.position.set(x, y, z); s.lookAt(this.camera.position);
      this.bit(s, { v: new THREE.Vector3(Math.cos(a) * sp, 1.4 + Math.random() * 1.6, Math.sin(a) * sp), g: 3.5, life: .8 + Math.random() * .4, s0: 1, s1: .3, a0: 1, a1: 0, drag: 1.2, spin: 6 });
    }
  }
  confetti(x, z, n = 40) {
    const cols = ['#d23a2c', '#f2c230', '#4f9e3c', '#3d72b8', '#9a5cc8', '#ffffff', '#f27a22'];
    for (let i = 0; i < n; i++) {
      const p = new THREE.Mesh(this.confGeo ||= new THREE.PlaneGeometry(.1, .06), flat(cols[i % cols.length], { opacity: 1, side: THREE.DoubleSide }));
      const a = Math.random() * Math.PI * 2, sp = .6 + Math.random() * 1.6;
      p.position.set(x, .8, z); p.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      this.bit(p, { v: new THREE.Vector3(Math.cos(a) * sp, 3 + Math.random() * 3, Math.sin(a) * sp), g: 4.2, life: 2 + Math.random(), s0: 1, s1: 1, a0: 1, a1: .6, drag: 1.4, spin: 9 });
    }
  }
  // dizzy stars round a crashed driver's head
  stars(i) {
    const v = this.karts[i]; if (!v) return;
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(this.starGeo ||= starGeo(), flat('#ffe24a', { opacity: 1, side: THREE.DoubleSide })); s.position.set(Math.cos(k * 2.1) * .25, 0, Math.sin(k * 2.1) * .25); s.rotation.x = -Math.PI / 2; g.add(s); }
    g.position.y = .8; v.model.add(g);
    const b = { t: 0 };
    this.anim.push(dt => { b.t += Math.abs(dt); g.rotation.y += dt * 6; if (b.t > 1.1) { v.model.remove(g); return false; } });
  }
  // a flat after-image of a kart, fading on real time (it's not run backwards with the rest while rewinding)
  ghost(x, z, color, yaw) {
    const m = new THREE.Mesh(this.ghostGeo ||= new THREE.PlaneGeometry(.62, 1.05), flat(color, { opacity: .55 }));
    m.rotation.set(-Math.PI / 2, 0, yaw); m.position.set(x, .06, z); m.renderOrder = 2;
    this.root.add(m);
    (this.ghosts ||= []).push({ m, age: 0, life: .45 });
  }
  skid(x, z, yaw) {
    const m = new THREE.Mesh(this.skidGeo ||= new THREE.PlaneGeometry(.5, .12), flat('#2a1a10', { opacity: .4 }));
    m.rotation.set(-Math.PI / 2, 0, yaw); m.position.set(x, .03, z); m.renderOrder = 1;
    this.root.add(m); this.skids.push(m);
    if (this.skids.length > 160) this.root.remove(this.skids.shift());
  }

  /* ---------- every frame ---------- */
  frame(dt) {
    this.t = Math.max(0, this.t + dt);
    const adt = Math.abs(dt);
    if (this.glide) {
      const g = this.glide, k = Math.min(1, adt * 4);
      if (this.follow < 0) { this.cam.x = lerp(this.cam.x, g.x, k); this.cam.z = lerp(this.cam.z, g.z, k); } else g.x = this.cam.x;
      this.cam.d = lerp(this.cam.d, g.d, k);
      if (Math.abs(this.cam.d - g.d) < .05 && Math.abs(this.cam.x - g.x) < .02) this.glide = null;
      this.applyCam();
    }
    if (this.follow >= 0 && this.karts[this.follow]) {
      const p = this.karts[this.follow].model.position, k = Math.min(1, adt * 3);
      this.cam.x = lerp(this.cam.x, p.x + Math.sin(this.cam.yaw), k); this.cam.z = lerp(this.cam.z, p.z + Math.cos(this.cam.yaw), k);
      this.applyCam();
    }
    // particles: run backwards too, while rewinding, back into whatever threw them (and gone when they get there)
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i], o = b.obj;
      b.age += dt;
      const k = b.age / b.life;
      if (k >= 1 || b.age < 0) { this.scene.remove(o); if (!b.keepMat) o.material.dispose(); this.bits.splice(i, 1); continue; }
      if (dt >= 0) { b.v.y -= b.g * dt; b.v.multiplyScalar(Math.max(0, 1 - b.drag * dt)); }
      else { b.v.multiplyScalar(1 / Math.max(.2, 1 + b.drag * dt)); b.v.y -= b.g * dt; }
      o.position.addScaledVector(b.v, dt);
      if (b.sink && o.position.y < .03) { o.position.y = .03; b.v.set(0, 0, 0); b.spin = 0; }
      o.scale.setScalar(b.base * lerp(b.s0, b.s1, k));
      if (!b.keepMat) o.material.opacity = lerp(b.a0, b.a1, k);
      if (b.spin) { o.rotation.x += b.spin * dt; o.rotation.y += b.spin * .7 * dt; }
    }
    this.anim = this.anim.filter(f => f(dt, this.t) !== false);
    // chrome glints: the whole shared material flashes from steel blue to near white
    const glint = .5 + .5 * Math.sin(this.t * 13);
    CHROME.emissive.setRGB(.08 + .42 * glint ** 4, .12 + .45 * glint ** 4, .2 + .5 * glint ** 4);
    if (this.ghosts) this.ghosts = this.ghosts.filter(g => {
      g.age += adt;
      const k = g.age / g.life;
      if (k >= 1) { this.root?.remove(g.m); g.m.material.dispose(); return false; }
      g.m.material.opacity = .55 * (1 - k); g.m.scale.setScalar(1 + k * .4);
      return true;
    });
    for (const m of this.things.values()) {
      const u = m.userData;
      if (u.kind === 'mine') u.led.visible = Math.sin(this.t * 8) > 0;
      if (u.kind === 'boost') u.tex.offset.y = -this.t * 1.6;
      if (u.box) { if (u.kind === 'skull') u.box.rotation.y = Math.sin(this.t * 2.2 + m.id) * .6; else u.box.rotation.y += dt * .8; u.box.position.y = (u.kind === 'skull' ? .36 : .25) + Math.sin(this.t * 3 + m.id) * .04; }
      if (u.sheen) u.sheen.rotation.z += dt * .4;
    }
    this.outline.render(this.scene, this.camera);
    const r = this.renderer, ac = r.autoClear;
    r.autoClear = false; r.clearDepth(); r.render(this.overlay, this.camera); r.autoClear = ac;
  }
}

function starGeo() { const sh = new THREE.Shape(); for (let k = 0; k < 10; k++) { const r = k % 2 ? .04 : .1, a = k / 10 * Math.PI * 2; k ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ShapeGeometry(sh); }

// How far each point round the track is from the nearest road (and, in the G channel, from the canyon's chasm), as a
// texture for the ground shader and a lookup for putting the scenery down.
function distanceField(T, res = 2, margin = 34) {
  const { x0, x1, z0, z1 } = T.box;
  const X0 = x0 - margin, Z0 = z0 - margin, W = Math.ceil((x1 - x0 + 2 * margin) * res), H = Math.ceil((z1 - z0 + 2 * margin) * res);
  const d = new Float32Array(W * H).fill(99), ch = new Float32Array(W * H).fill(99);
  const stamp = (arr, cx, cz, rad, reach) => {
    const gx = (cx - X0) * res, gz = (cz - Z0) * res, R = Math.ceil((rad + reach) * res);
    for (let y = Math.max(0, Math.floor(gz - R)); y <= Math.min(H - 1, Math.ceil(gz + R)); y++)
      for (let x = Math.max(0, Math.floor(gx - R)); x <= Math.min(W - 1, Math.ceil(gx + R)); x++) {
        const dd = Math.hypot((x + .5) / res + X0 - cx, (y + .5) / res + Z0 - cz) - rad, i = y * W + x;
        if (dd < arr[i]) arr[i] = dd;
      }
  };
  for (const p of T.paths) for (let i = 0; i < p.count; i += 1) {
    const mid = (p.lo[i] + p.hi[i]) / 2, half = (p.hi[i] - p.lo[i]) / 2, q = point(p, i * p.step, mid);
    stamp(d, q.x, q.z, half, 3.5);
  }
  // the chasm: a band across the road where the bridge is
  const def = T.def;
  if (def.bridge) {
    // across the road under the bridge, reaching further out (right, the outside of the loop) than in
    const p = T.main, a = def.bridge[0] * p.L, b = def.bridge[1] * p.L, [w0, w1] = def.chasm || [-7, 7];
    for (let s = a + .9; s <= b - .9; s += .25) for (let x = w0; x <= w1; x += .5) {
      // wandering a little along the road the further out it goes, so it's a crack, not a box
      const wob = Math.abs(x) > 3 ? Math.sin(x * .45) * 1.2 + Math.sin(x * 1.3) * .4 : 0, q = point(p, s + wob, x);
      stamp(ch, q.x, q.z, 0, 3.4);
    }
  }
  // carry the distance on outward (two chamfer passes)
  const pass = arr => {
    const a = 1 / res, b = Math.SQRT2 / res;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; let v = arr[i];
      if (x > 0) v = Math.min(v, arr[i - 1] + a); if (y > 0) v = Math.min(v, arr[i - W] + a);
      if (x > 0 && y > 0) v = Math.min(v, arr[i - W - 1] + b); if (x < W - 1 && y > 0) v = Math.min(v, arr[i - W + 1] + b);
      arr[i] = v;
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x; let v = arr[i];
      if (x < W - 1) v = Math.min(v, arr[i + 1] + a); if (y < H - 1) v = Math.min(v, arr[i + W] + a);
      if (x < W - 1 && y < H - 1) v = Math.min(v, arr[i + W + 1] + b); if (x > 0 && y < H - 1) v = Math.min(v, arr[i + W - 1] + b);
      arr[i] = v;
    }
  };
  pass(d); pass(ch);
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { data[i * 4] = clamp(d[i] / 24, 0, 1) * 255; data[i * 4 + 1] = clamp(ch[i] / 12, 0, 1) * 255; data[i * 4 + 3] = 255; }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  const at = (x, z) => { const gx = clamp(Math.floor((x - X0) * res), 0, W - 1), gz = clamp(Math.floor((z - Z0) * res), 0, H - 1); return d[gz * W + gx]; };
  const chasmAt = (x, z) => { const gx = clamp(Math.floor((x - X0) * res), 0, W - 1), gz = clamp(Math.floor((z - Z0) * res), 0, H - 1); return ch[gz * W + gx]; };
  return { tex, x0: X0, z0: Z0, w: W, h: H, res, at, chasmAt };
}
