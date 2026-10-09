// Snowball, drawn with three.js: the snow (a heightfield in chunks with its own shader), everything on the mountain as
// instanced meshes from models.glb, the snowball itself (a lumpy sphere with things stuck in it), the effects, and a
// chase camera that leans into turns, kicks its field of view out with speed and shakes on impacts.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ITEMS } from './items.js';
import { SURF } from './course.js';
import { NOISE, itemShader } from './shaders.js';
import { Sky, LOOKS } from './sky.js';
import { FX } from './fx.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

// ------------------------------------------------------------------------------------------------- the snow itself
const TERRAIN_U = () => ({
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSnow: { value: new THREE.Color() }, uShade: { value: new THREE.Color() },
  uSky: { value: new THREE.Color() }, uSunI: { value: 2 }, uSpark: { value: 1 }, uDetail: { value: 1 }, uTime: { value: 0 },
});
function terrainMaterial(U) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aSurf;
attribute float aAO;
varying vec4 vSurf;
varying float vAO;
varying vec3 vWPos;
varying vec3 vWNrm;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  vSurf = aSurf; vAO = aAO;
  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vWNrm = normalize(mat3(modelMatrix) * normal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
${NOISE}
uniform vec3 uSunDir, uSnow, uShade, uSky;
uniform float uSunI, uSpark, uDetail, uTime;
varying vec4 vSurf;
varying float vAO;
varying vec3 vWPos;
varying vec3 vWNrm;
float bumpH(vec2 q, float powder, float piste, float near) {
  float h = vnoise2(q * 0.21) * 0.5 + vnoise2(q * 0.83) * 0.18 + vnoise2(q * 3.1) * 0.05 * near;
  // wind ripples on the powder, corduroy on the groomed piste
  h += powder * 0.07 * near * sin(q.x * 2.3 + q.y * 0.6 + vnoise2(q * 0.15) * 7.0);
  h += piste * 0.018 * near * sin(q.x * 21.0);
  return h;
}
// the lines skiers have carved down the piste: wavy pairs, some deeper than others
float tracks(vec2 q) {
  float t = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float lane = 7.0 + fk * 3.3;
    float x = q.x + sin(q.y * (0.045 + fk * 0.013) + fk * 2.0) * (3.0 + fk);
    float c = floor(x / lane);
    float on = step(0.45, hash12(vec2(c, fk)));
    float f = abs(fract(x / lane) - 0.5) * lane;
    t += on * smoothstep(0.08, 0.0, abs(f - 0.11));   // two lines, 22 cm apart
  }
  return min(t, 1.0);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  float dist = length(vWPos - cameraPosition);
  float near = 1.0 - smoothstep(25.0 * uDetail, 90.0 * uDetail, dist);
  float powder = vSurf.x + vSurf.w, piste = vSurf.y, ice = vSurf.z;
  vec3 snow = uSnow;
  snow *= 1.0 - piste * 0.03;
  // snow isn't one white: drifts of slightly bluer and slightly warmer, and carved tracks on the piste
  float var1 = vnoise2(vWPos.xz * 0.05), var2 = vnoise2(vWPos.xz * 0.6 + 3.0);
  snow *= mix(vec3(0.94, 0.96, 1.0), vec3(1.0, 1.0, 0.985), var1) * (0.97 + 0.03 * var2);
  snow *= 1.0 - near * 0.045 * vnoise2(vWPos.xz * 17.0);   // a soft grain close up
  snow = mix(snow, snow * vec3(0.8, 0.86, 0.96), tracks(vWPos.xz) * piste * near * 0.8);
  // ice: blue-green and see-through looking, with darker cracks
  float ic = vnoise2(vWPos.xz * 0.08);
  vec3 iceCol = mix(vec3(0.42, 0.66, 0.84), vec3(0.72, 0.88, 0.98), ic);
  float crack = smoothstep(0.035, 0.0, abs(vnoise2(vWPos.xz * 0.35) - 0.5)) + smoothstep(0.02, 0.0, abs(vnoise2(vWPos.xz * 1.1 + 4.0) - 0.5)) * 0.6;
  iceCol = mix(iceCol, vec3(0.22, 0.42, 0.6), crack * 0.6);
  vec3 col = mix(snow, iceCol, ice);
  // rock shows on faces too steep to hold snow
  float steep = smoothstep(0.66, 0.5, vWNrm.y + (vnoise2(vWPos.xz * 0.12) - 0.5) * 0.25);
  vec3 rock = mix(vec3(0.33, 0.35, 0.4), vec3(0.5, 0.5, 0.55), vnoise2(vWPos.xz * 0.4 + vWPos.y * 0.3));
  col = mix(col, rock, steep * 0.85);
  col *= mix(0.66, 1.0, vAO);
  diffuseColor.rgb = col;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    float e = 0.12;
    vec2 q = vWPos.xz;
    float h0 = bumpH(q, powder, piste, near), hx = bumpH(q + vec2(e, 0.0), powder, piste, near), hz = bumpH(q + vec2(0.0, e), powder, piste, near);
    vec3 b = vec3(-(hx - h0) / e, 0.0, -(hz - h0) / e) * (0.35 + 0.65 * near) * (1.0 - ice * 0.8);
    vec3 nw = normalize(vWNrm + b);
    normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
  }`)
      .replace('#include <envmap_fragment>', `#include <envmap_fragment>
  {
    vec3 V = normalize(cameraPosition - vWPos);
    vec3 nw = normalize(vWNrm);
    float lit = clamp(length(reflectedLight.directDiffuse) / (length(diffuseColor.rgb) * uSunI * 0.6 + 1e-3), 0.0, 1.0);
    float sc = 0.03 + dist * 0.0022;
    float g = glitter(vWPos, V, nw, uSunDir, sc) + glitter(vWPos + 17.0, V, nw, uSunDir, sc * 2.3) * 0.6;
    // glints of colour, like light through ice crystals: they show best against the blue of the shade
    vec3 prism = 0.75 + 0.25 * cos(6.2831 * (hash13(floor(vWPos / sc)) + vec3(0.0, 0.33, 0.67)));
    outgoingLight += prism * g * uSpark * (0.7 + 0.5 * lit) * (1.0 - steep) * (1.0 - ice * 0.5);
    // the ice is glossy: a sun glint and the sky in it at grazing angles
    vec3 R = reflect(-uSunDir, nw);
    float spec = pow(max(dot(R, V), 0.0), 90.0) * 3.0 + pow(max(dot(R, V), 0.0), 12.0) * 0.25;
    float fres = pow(1.0 - max(dot(nw, V), 0.0), 4.0);
    outgoingLight = mix(outgoingLight, uSky * 1.05, fres * ice * 0.55);
    outgoingLight += vec3(spec) * ice * (0.2 + lit);
    // fresh snow has a soft sheen where it faces the sun
    vec3 H = normalize(uSunDir + V);
    outgoingLight += uSnow * pow(max(dot(normalize(nw + vec3(0.0, 0.3, 0.0)), H), 0.0), 10.0) * 0.12 * lit * (1.0 - ice);
    // a cold blue creeping into the shade, the way snow goes in shadow
    outgoingLight = mix(outgoingLight, outgoingLight * normalize(uShade + 0.05) * 1.55, (1.0 - lit) * 0.22);
  }`);
  };
  m.customProgramCacheKey = () => 'snowball-terrain';
  return m;
}

// ------------------------------------------------------------------------------------------------- the snowball
const BALL_U = () => ({ uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSpark: { value: 1 }, uSky: { value: new THREE.Color() }, uSunI: { value: 2 }, uR: { value: 1 } });
function ballMaterial(U) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vOPos;
varying vec3 vWPos2;
varying vec3 vWN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  vOPos = position;
  vWPos2 = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vWN = normalize(mat3(modelMatrix) * normal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
${NOISE}
uniform vec3 uSunDir, uSky;
uniform float uSpark, uSunI, uR;
varying vec3 vOPos;
varying vec3 vWPos2;
varying vec3 vWN;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  // packed-snow layers swirl round the ball, so you can see it turn; the odd pine needle and bit of grit rolled in
  vec3 p = normalize(vOPos);
  float layers = vnoise3(p * 4.0 + vnoise3(p * 2.0) * 2.0);
  vec3 col = vec3(0.97, 0.98, 1.0) * mix(0.86, 1.0, smoothstep(0.25, 0.7, layers));
  float speck = hash13(floor(p * 70.0));
  col = mix(col, vec3(0.42, 0.33, 0.25), step(0.992, speck) * 0.8);
  col = mix(col, vec3(0.3, 0.45, 0.3), step(0.996, hash13(floor(p * 55.0) + 7.0)) * 0.8);
  diffuseColor.rgb = col;`)
      .replace('#include <envmap_fragment>', `#include <envmap_fragment>
  {
    vec3 V = normalize(cameraPosition - vWPos2);
    vec3 nw = normalize(vWN);
    float lit = clamp(length(reflectedLight.directDiffuse) / (uSunI * 0.6 + 1e-3), 0.0, 1.0);
    float g = glitter(vOPos * uR, V, nw, uSunDir, 0.03 + uR * 0.01);
    outgoingLight += vec3(g) * uSpark * (0.3 + lit);
    // light glowing through the edge of the snow
    float rim = pow(1.0 - max(dot(nw, V), 0.0), 3.0);
    outgoingLight += uSky * rim * 0.35;
  }`);
  };
  m.customProgramCacheKey = () => 'snowball-ball';
  return m;
}

class BallView {
  constructor(view) {
    this.view = view;
    this.root = new THREE.Group();
    this.squash = new THREE.Group();
    this.spin = new THREE.Group();
    this.root.add(this.squash); this.squash.add(this.spin);
    const ico = new THREE.IcosahedronGeometry(1, view.mobile ? 12 : 18);
    ico.deleteAttribute('uv'); ico.deleteAttribute('normal');
    this.geo = mergeVertices(ico);
    const P = this.geo.attributes.position;
    this.base = new Float32Array(P.count * 3);
    this.noise = new Float32Array(P.count);
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).normalize();
      this.base.set([_v.x, _v.y, _v.z], i * 3);
      this.noise[i] = (Math.sin(_v.x * 5.1 + _v.y * 2.3) * Math.sin(_v.y * 4.7 - _v.z * 3.1) * Math.sin(_v.z * 3.9 + _v.x * 1.7)) * 0.045
        + Math.sin(_v.x * 13.0 + 1.0) * Math.sin(_v.y * 11.0 + 2.0) * Math.sin(_v.z * 12.0) * 0.012;
    }
    this.U = BALL_U();
    this.mesh = new THREE.Mesh(this.geo, ballMaterial(this.U));
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.spin.add(this.mesh);
    this.lumps = [];
    this.stuck = new Map();   // key -> { mesh, recs: [] }
    this.recs = [];
    this.sq = 0; this.sqV = 0;
    this.rollPhase = 0;
    this.r = 1;
    this.shapeDirty = true;
    this.reshape();
  }

  reset(r) {
    for (const s of this.stuck.values()) { this.spin.remove(s.mesh); s.mesh.dispose(); }
    this.stuck.clear(); this.recs = []; this.lumps = [];
    this.spin.quaternion.identity();
    this.r = r; this.shapeDirty = true;
  }

  // a dent of extra snow where something went in
  addLump(dir, amp) {
    // a lump near an old one builds that one up a little, rather than stacking another on top
    for (const l of this.lumps) if (l.x * dir.x + l.y * dir.y + l.z * dir.z > 0.9) { l.a = Math.min(0.14, Math.max(l.a, amp) + amp * 0.25); this.shapeDirty = true; return; }
    this.lumps.push({ x: dir.x, y: dir.y, z: dir.z, a: amp });
    if (this.lumps.length > 36) { this.lumps.sort((a, b) => b.a - a.a); this.lumps.length = 30; }
    this.shapeDirty = true;
  }

  reshape() {
    const P = this.geo.attributes.position, B = this.base, L = this.lumps;
    for (let i = 0; i < P.count; i++) {
      const x = B[i * 3], y = B[i * 3 + 1], z = B[i * 3 + 2];
      let R = 1 + this.noise[i];
      for (const l of L) {
        const d = 1 - (x * l.x + y * l.y + z * l.z);
        if (d < 0.5) R += l.a * Math.exp(-d * 9);
      }
      P.setXYZ(i, x * R, y * R, z * R);
    }
    P.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    this.shapeDirty = false;
  }

  attach(it, dirW, t, dur = 0.26, lump = true) {
    const key = it.key, info = ITEMS[key];
    let s = this.stuck.get(key);
    if (!s) {
      const mesh = this.view.makeInstanced(key, 96);
      mesh.castShadow = true;
      this.spin.add(mesh);
      s = { mesh, recs: [] };
      this.stuck.set(key, s);
    }
    if (s.recs.length >= 96) this.drop(s.recs[0]);
    // where it hit, in the ball's own frame
    this.spin.updateWorldMatrix(true, false);
    const inv = _q.copy(this.spin.getWorldQuaternion(_q2)).invert();
    const dir = new THREE.Vector3(dirW[0], dirW[1], -dirW[2]).normalize().applyQuaternion(inv);
    const h = it.h, sc = it.scale;
    const embed = Math.min(h * 0.32, this.r * 0.35);
    const dist = this.r * 0.97 - embed;
    // stuck in head-out (or feet-out) along the radius, with a random twist and a bit of its old lean kept
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    q.multiply(_q2.setFromAxisAngle(UP, Math.random() * Math.PI * 2));
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6));
    q.multiply(tilt);
    const local = new THREE.Matrix4().compose(dir.clone().multiplyScalar(dist), q, _s.setScalar(sc));
    const from = { p: new THREE.Vector3(it.x, it.y, -it.d), q: new THREE.Quaternion().setFromAxisAngle(UP, Math.PI - it.yaw), s: sc };
    const rec = { it, key, local, from, t0: t, dur, dist, h: h, tint: it.tint, anim: [info.stuck[0] * sc, info.stuck[1] * (0.85 + Math.random() * 0.3), Math.random() * 50] };
    s.recs.push(rec);
    this.recs.push(rec);
    if (lump) this.addLump(dir, clamp(0.1 * (it.need / (this.r * 2)), 0.01, 0.12));
    return rec;
  }

  drop(rec) {
    const s = this.stuck.get(rec.key);
    if (s) { const i = s.recs.indexOf(rec); if (i >= 0) s.recs.splice(i, 1); }
    const j = this.recs.indexOf(rec); if (j >= 0) this.recs.splice(j, 1);
  }

  dropItem(it) { const rec = this.recs.find(r => r.it === it); if (rec) this.drop(rec); }

  setRadius(r) {
    if (r !== this.r) {
      // old lumps flatten into the ball as it grows
      const k = this.r / r;
      if (k < 0.999) for (const l of this.lumps) l.a *= k ** 1.5;
      this.r = r; this.shapeDirty = true;
    }
  }

  update(dt, t, b, real) {
    if (this.shapeDirty && (this.reshapeT = (this.reshapeT || 0) - dt) <= 0) { this.reshape(); this.reshapeT = 0.08; }
    this.mesh.scale.setScalar(this.r);
    this.U.uR.value = this.r;
    // roll: about the axis across the direction of travel, in the plane of the ground
    const v = _v.set(b.vx, b.vy, -b.vd), n = _v2.set(b.n.nx, b.n.ny, -b.n.nd);
    const sp = v.length();
    if (sp > 0.01) {
      const axis = n.clone().cross(v).normalize();
      const w = sp / Math.max(this.r, 0.05) * dt;
      if (axis.lengthSq() > 0.5) { this.spin.quaternion.premultiply(_q.setFromAxisAngle(axis, w)); this.rollPhase += w; }
    }
    // squash on landing, stretch in the air, springing back
    this.sqV += (-this.sq * 160 - this.sqV * 11) * dt;
    this.sq += this.sqV * dt;
    const air = b.ground ? 0 : clamp(b.air * 0.4, 0, 0.12);
    const sy = 1 - this.sq + air, sxz = 1 + this.sq * 0.6 - air * 0.4;
    this.squash.scale.set(sxz, sy, sxz);
    // lumpy things sticking out make it bob as it rolls
    let lump = 0;
    for (const r of this.recs) if (r.out > 0) lump = Math.max(lump, r.out);
    const bob = Math.min(lump * 0.12, this.r * 0.18) * (0.5 - 0.5 * Math.cos(this.rollPhase * 2));
    this.root.position.set(b.x, b.y - this.r * this.sq * 0.6 + bob, -b.d);
    // the things stuck on: fly in, then ride along, and slowly get buried as the ball grows
    this.spin.updateWorldMatrix(true, false);
    const spinW = this.spin.matrixWorld, spinInv = _m2.copy(spinW).invert();
    for (const [key, s] of this.stuck) {
      let k = 0;
      const mesh = s.mesh, an = mesh.geometry.attributes.iAnim;
      for (let i = 0; i < s.recs.length; i++) {
        const r = s.recs[i];
        r.out = r.dist + r.h - this.r;   // how far it sticks out
        if (r.dist + r.h * 0.55 < this.r * 0.98 && t - r.t0 > r.dur + 1) { s.recs.splice(i, 1); i--; const j = this.recs.indexOf(r); if (j >= 0) this.recs.splice(j, 1); continue; }
        const a = (t - r.t0) / r.dur;
        if (a <= 0) {   // still waiting its turn (the finale), sitting where it was
          _m.compose(r.from.p, r.from.q, _s.setScalar(r.from.s)).premultiply(spinInv);
          mesh.setMatrixAt(k, _m);
        } else if (a < 1) {
          const e = 1 - (1 - a) ** 3 * (1 - 2.2 * a);   // overshoots, then settles
          _m.copy(spinW).multiply(r.local);
          _m.decompose(_v, _q, _s);
          _v.lerpVectors(r.from.p, _v, clamp(e, 0, 1.15));
          if (r.dur > 0.4) _v.y += Math.sin(a * Math.PI) * r.dur * 9;   // long flights arc up and over
          _q.slerpQuaternions(r.from.q, _q, clamp(a * 1.4, 0, 1));
          _s.setScalar(r.from.s * (1 + Math.sin(a * Math.PI) * 0.35));
          _m.compose(_v, _q, _s).premultiply(spinInv);
          mesh.setMatrixAt(k, _m);
        } else mesh.setMatrixAt(k, r.local);
        an.setXYZ(k, r.anim[0], r.anim[1], r.anim[2]);
        if (mesh.instanceColor && r.tint) mesh.setColorAt(k, _c.set(r.tint));
        k++;
      }
      mesh.count = k;
      mesh.instanceMatrix.needsUpdate = true; an.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  kick(amount) { this.sqV += amount; }
}

// ------------------------------------------------------------------------------------------------- the view
export class View {
  constructor(canvas, opts = {}) {
    this.mobile = !!opts.mobile;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.mobile, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, this.mobile ? 1.6 : 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = this.mobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.autoClear = false;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xffffff, 50, 400);
    this.cam = new THREE.PerspectiveCamera(60, 1, 0.05, 2000);
    this.sky = new Sky();
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    const sm = this.mobile ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.tU = TERRAIN_U();
    this.terrainMat = terrainMaterial(this.tU);
    this.itemU = { uTime: { value: 0 }, uGlow: { value: 0.3 } };
    this.itemMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    itemShader(this.itemMat, this.itemU);
    this.fx = new FX(this.scene, this.mobile);
    this.ball = new BallView(this);
    this.scene.add(this.ball.root);
    this.chunks = [];
    this.layers = new Map();
    this.camState = { pos: new THREE.Vector3(0, 5, 5), look: new THREE.Vector3(), fov: 60, shake: 0, roll: 0, steer: 0, dist: 3 };
    this.sunDir = new THREE.Vector3(0.5, 0.7, 0.5).normalize();
    this.resize();
  }

  async load(url) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(url);
    this.geoms = {};
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      const g = o.geometry;
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', g.attributes.position);
      out.setAttribute('normal', g.attributes.normal);
      // colours as plain rgb
      const c = g.attributes.color, rgb = new Float32Array(c.count * 3);
      for (let i = 0; i < c.count; i++) { rgb[i * 3] = c.getX(i); rgb[i * 3 + 1] = c.getY(i); rgb[i * 3 + 2] = c.getZ(i); }
      out.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
      out.setAttribute('aWig', g.attributes.uv);
      out.setIndex(g.index);
      out.computeBoundingSphere();
      this.geoms[o.name] = out;
    });
  }

  makeInstanced(key, cap) {
    const base = this.geoms[key];
    const g = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'color', 'aWig']) g.setAttribute(k, base.attributes[k]);
    g.setIndex(base.index);
    g.setAttribute('iAnim', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const mesh = new THREE.InstancedMesh(g, this.itemMat, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (ITEMS[key].tint) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    return mesh;
  }

  // drop the pixel density if frames are slow (and creep back up if there's room), checked every couple of seconds
  adapt(dt) {
    const A = this.adaptive || (this.adaptive = { t: 0, n: 0, sum: 0, max: Math.min(devicePixelRatio || 1, this.mobile ? 1.6 : 2), pr: Math.min(devicePixelRatio || 1, this.mobile ? 1.6 : 2) });
    A.t += dt; A.n++; A.sum += dt;
    if (A.t < 2) return;
    const avg = A.sum / A.n;
    let pr = A.pr;
    if (avg > 1 / 40 && pr > 0.75) pr = Math.max(0.75, pr - 0.25);
    else if (avg < 1 / 58 && pr < A.max) pr = Math.min(A.max, pr + 0.25);
    if (pr !== A.pr) { A.pr = pr; this.renderer.setPixelRatio(pr); this.resize(); }
    A.t = 0; A.n = 0; A.sum = 0;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
    this.fx.lines.u.uAspect.value = w / h;
  }

  // ----------------------------------------------------------------------------------------------- a mountain
  setCourse(C) {
    this.C = C;
    for (const c of this.chunks) { this.scene.remove(c); c.geometry.dispose(); }
    this.chunks = [];
    for (const l of this.layers.values()) this.scene.remove(l.mesh);   // (their geometry shares the models' buffers: not disposed)
    this.layers.clear();
    this.buildTerrain(C);
    // instance layers: one per kind of thing, sized to how many there are
    const n = {};
    for (const it of C.items) n[it.key] = (n[it.key] || 0) + 1;
    for (const key in n) {
      const mesh = this.makeInstanced(key, Math.min(n[key], 3000));
      mesh.castShadow = ITEMS[key].need > 0.3;
      this.scene.add(mesh);
      this.layers.set(key, { mesh, n: 0, cap: Math.min(n[key], 3000) });
    }
    for (const it of C.items) this.itemMatrix(it);
    const L = this.look = LOOKS[C.def.look];
    const sd = this.sunDir.set(...L.sun).normalize();
    this.sky.setLook(L, sd);
    this.fx.setLook(L);
    // (three's lights are in physical units: the looks are written as if they weren't, hence the factors)
    this.hemi.color.set(L.hemiSky); this.hemi.groundColor.set(L.hemiGround); this.hemi.intensity = L.hemiI * 1.95;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI * 1.6;
    this.scene.fog.color.set(L.horizon);
    this.tU.uSunDir.value.copy(sd); this.tU.uSnow.value.set(L.snow); this.tU.uShade.value.set(L.shade); this.tU.uSky.value.set(L.horizon).lerp(new THREE.Color(L.top), 0.4);
    this.tU.uSunI.value = L.sunI * 1.6 / Math.PI; this.tU.uSpark.value = L.stars ? 1.6 : 1.1;
    this.ball.U.uSunDir.value.copy(sd); this.ball.U.uSky.value.set(L.hemiSky); this.ball.U.uSunI.value = L.sunI * 1.6 / Math.PI; this.ball.U.uSpark.value = L.stars ? 1.4 : 1;
    this.itemU.uGlow.value = L.glow;
    this.fx.trail.clear();
  }

  buildTerrain(C) {
    const { nx, nd, h, surf, x0, d0, cell } = C;
    const rows = 32;
    for (let j0 = 0; j0 < nd - 1; j0 += rows) {
      const j1 = Math.min(nd - 1, j0 + rows), nr = j1 - j0 + 1;
      const pos = new Float32Array(nx * nr * 3), nrm = new Float32Array(nx * nr * 3), sf = new Float32Array(nx * nr * 4), ao = new Float32Array(nx * nr);
      const H = (i, j) => h[clamp(j, 0, nd - 1) * nx + clamp(i, 0, nx - 1)];
      for (let j = j0; j <= j1; j++) {
        for (let i = 0; i < nx; i++) {
          const k = (j - j0) * nx + i, y = H(i, j);
          pos[k * 3] = x0 + i * cell; pos[k * 3 + 1] = y; pos[k * 3 + 2] = -(d0 + j * cell);
          const gx = (H(i + 1, j) - H(i - 1, j)) / (2 * cell), gd = (H(i, j + 1) - H(i, j - 1)) / (2 * cell);
          const l = Math.hypot(gx, 1, gd);
          nrm[k * 3] = -gx / l; nrm[k * 3 + 1] = 1 / l; nrm[k * 3 + 2] = gd / l;
          // surface mix from the 3x3 around, so edges blend
          let w0 = 0, w1 = 0, w2 = 0, w3 = 0;
          for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
            const s = surf[clamp(j + b, 0, nd - 1) * nx + clamp(i + a, 0, nx - 1)];
            if (s === SURF.powder) w0++; else if (s === SURF.piste) w1++; else if (s === SURF.ice) w2++; else w3++;
          }
          sf[k * 4] = w0 / 9; sf[k * 4 + 1] = w1 / 9; sf[k * 4 + 2] = w2 / 9; sf[k * 4 + 3] = w3 / 9;
          // hollows are darker
          let avg = 0;
          for (let b = -3; b <= 3; b += 3) for (let a = -3; a <= 3; a += 3) avg += H(i + a, j + b);
          avg /= 9;
          ao[k] = clamp(1 - (avg - y) * 0.09, 0.45, 1);
        }
      }
      const idx = [];
      for (let j = 0; j < nr - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        idx.push(a, a + 1, a + nx, a + 1, a + nx + 1, a + nx);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      g.setAttribute('aSurf', new THREE.BufferAttribute(sf, 4));
      g.setAttribute('aAO', new THREE.BufferAttribute(ao, 1));
      g.setIndex(idx);
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, this.terrainMat);
      mesh.receiveShadow = true;
      mesh.userData.d0 = d0 + j0 * cell; mesh.userData.d1 = d0 + j1 * cell;
      this.scene.add(mesh);
      this.chunks.push(mesh);
    }
  }

  itemMatrix(it) {
    _q.setFromAxisAngle(UP, Math.PI - it.yaw);
    if (it.spin) _q.multiply(_q2.setFromEuler(new THREE.Euler(it.spin, it.spin * 0.7, 0)));
    _m.compose(_v.set(it.x, it.y, -it.d), _q, _s.setScalar(it.scale));
    if (!it.mat) it.mat = new Float32Array(16);
    _m.toArray(it.mat);
    if (it.tint && !it.tc) { _c.set(it.tint); it.tc = [_c.r, _c.g, _c.b]; }
    it.dirty = false;
  }

  // ----------------------------------------------------------------------------------------------- each frame
  // what's near enough to draw, packed into each kind's instances
  drawItems(run, ahead, behind) {
    const b = run.ball, arr = run.statics;
    for (const l of this.layers.values()) l.n = 0;
    const lo = b.d - behind, hi = b.d + ahead;
    let a = 0, z = arr.length;
    while (a < z) { const m = (a + z) >> 1; if (arr[m].d < lo) a = m + 1; else z = m; }
    const put = it => {
      const l = this.layers.get(it.key);
      if (l.n >= l.cap) return;
      if (it.d - b.d > 30 + it.h * 110 + b.r * 10) return;
      if (it.dirty || !it.mat) this.itemMatrix(it);
      const mesh = l.mesh, k = l.n++;
      mesh.instanceMatrix.array.set(it.mat, k * 16);
      const info = ITEMS[it.key];
      const an = mesh.geometry.attributes.iAnim.array;
      const panic = it.panic || 0;
      an[k * 3] = lerp(info.idle[0], info.stuck[0] * 0.8, panic) * it.scale * (it.shake ? 1 + it.shake * 6 : 1);
      an[k * 3 + 1] = lerp(info.idle[1], info.stuck[1], panic);
      an[k * 3 + 2] = it.phase;
      if (mesh.instanceColor && it.tc) mesh.instanceColor.array.set(it.tc, k * 3);
    };
    for (let i = a; i < arr.length && arr[i].d <= hi; i++) if (!arr[i].eaten) put(arr[i]);
    for (const it of run.movers) if (!it.eaten && it.d > lo && it.d < hi) put(it);
    for (const l of this.layers.values()) {
      const mesh = l.mesh;
      mesh.count = l.n;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceMatrix.clearUpdateRanges?.(); mesh.instanceMatrix.addUpdateRange?.(0, l.n * 16);
      mesh.geometry.attributes.iAnim.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  heightAt(x, z) { return this.C.heightAt(x, -z); }

  // a little portrait of one kind of thing, for Lost & Found and Ski School
  thumb(key, size = 160, yaw = -0.6) {
    if (!this.thumbRig) {
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight('#cfe3ff', '#ffffff', 1.4));
      const d = new THREE.DirectionalLight('#fff4e0', 2.2); d.position.set(3, 5, 4); sc.add(d);
      const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
      rt.texture.colorSpace = THREE.SRGBColorSpace;
      this.thumbRig = { sc, cam: new THREE.PerspectiveCamera(30, 1, 0.01, 1000), rt, buf: new Uint8Array(size * size * 4), size };
    }
    if (this.thumbRig.size !== size) {
      this.thumbRig.rt.setSize(size, size);
      this.thumbRig.buf = new Uint8Array(size * size * 4);
      this.thumbRig.size = size;
    }
    const T = this.thumbRig, info = ITEMS[key];
    const mesh = this.makeInstanced(key, 1);
    mesh.count = 1;
    mesh.setMatrixAt(0, _m.makeRotationY(yaw));
    if (mesh.instanceColor) mesh.setColorAt(0, _c.set('#e8412f'));
    T.sc.add(mesh);
    const ext = Math.max(info.w, info.h, info.dp);
    const cy = info.h * 0.45;
    T.cam.position.set(0, cy + ext * 0.6, ext * 2.75);
    T.cam.lookAt(0, cy, 0);
    T.cam.near = ext * 0.05; T.cam.far = ext * 10; T.cam.updateProjectionMatrix();
    const R = this.renderer;
    R.setRenderTarget(T.rt);
    R.setClearColor(0x000000, 0); R.clear();
    R.render(T.sc, T.cam);
    R.readRenderTargetPixels(T.rt, 0, 0, T.size, T.size, T.buf);
    R.setRenderTarget(null);
    R.setClearColor(0xffffff, 1);
    T.sc.remove(mesh);
    const cv = document.createElement('canvas'); cv.width = cv.height = T.size;
    const g = cv.getContext('2d'), img = g.createImageData(T.size, T.size);
    for (let y = 0; y < T.size; y++) img.data.set(T.buf.subarray((T.size - 1 - y) * T.size * 4, (T.size - y) * T.size * 4), y * T.size * 4);
    g.putImageData(img, 0, 0);
    return cv;
  }

  // the chase camera
  updateCamera(dt, run, mode) {
    const b = run.ball, S = this.camState, r = b.r;
    const speed = b.speed;
    const hx = b.hx, hd = b.hd;
    if (mode === 'orbit') {
      // the title screen: a slow turn round the little ball at the top
      const a = performance.now() / 9000;
      S.pos.set(b.x + Math.sin(a) * (2.4 + r * 6), b.y + 0.8 + r * 2.5, -b.d + Math.cos(a) * (2.4 + r * 6));
      S.look.set(b.x, b.y + r * 0.6, -b.d - 1.5);
      S.fov = 55;
    } else if (mode === 'finale') {
      // swing round to look back up at the ball, with the town around it
      S.orbit = (S.orbit ?? Math.atan2(-hx, hd)) + dt * 0.18;
      const dist = 5 + r * 4.2;
      _v.set(b.x + Math.sin(S.orbit) * dist, b.y + r * 1.1 + 2.2, -b.d + Math.cos(S.orbit) * dist);
      const gy = this.C.heightAt(_v.x, -_v.z) + 1 + r * 0.5;
      if (_v.y < gy) _v.y = gy;
      S.pos.lerp(_v, 1 - Math.exp(-dt * 2.2));
      S.look.lerp(_v.set(b.x, b.y + r * 0.5, -b.d), 1 - Math.exp(-dt * 5));
      S.fov = lerp(S.fov, 62, 1 - Math.exp(-dt * 2));
      S.steer = lerp(S.steer, 0, 1 - Math.exp(-dt * 3));
    } else {
      S.orbit = undefined;
      const tall = Math.max(0, 1 - this.cam.aspect);   // a phone held upright: look down the slope more, less sky
      // the faster you go, the higher the camera rides and the further down the slope it looks, so the ball sits low
      // in the picture and what's coming is in view rather than behind it
      const quick = clamp(speed / (18 + r * 3), 0, 1);
      S.quick = lerp(S.quick ?? quick, quick, 1 - Math.exp(-dt * 3));
      const dist = 1.35 + r * 4.6 + Math.min(speed, 40) * 0.04 * (1 + r * 0.15);
      const height = (0.5 + r * 2.0) * (1 + tall * 0.5) + S.quick * (1.4 + r * 1.8);
      S.dist = lerp(S.dist, dist, 1 - Math.exp(-dt * 3));
      _v.set(b.x - hx * S.dist, b.y + height, -(b.d - hd * S.dist));
      // keep the camera out of the snow
      const gy = this.C.heightAt(_v.x, -_v.z) + 0.35 + r * 0.4;
      if (_v.y < gy) _v.y = gy;
      // don't put the camera inside a tree or a house: pull it in towards the ball until it's clear
      this.clearView(run, _v, b);
      const follow = 1 - Math.exp(-dt * (5 + speed * 0.08));
      S.pos.lerp(_v, follow);
      // never let the ball get away from the camera at speed
      const far = S.pos.distanceTo(_v2.set(b.x, b.y, -b.d));
      if (far > S.dist * 1.8 + height) S.pos.lerp(_v, 0.5);
      // aim at where the ball will be in a moment, down at the snow there rather than level with the ball
      const lead = r * 2.5 + 2 + Math.min(speed, 45) * 0.45 * (1 + r * 0.1);
      const ax = b.x + hx * lead, ad = b.d + hd * lead;
      const ay = lerp(b.y + r * 0.35, this.C.heightAt(ax, ad) + r * 0.6, 0.4 + 0.55 * S.quick) - tall * (r * 0.9 + 0.5);
      _v2.set(ax, ay, -ad);
      S.look.lerp(_v2, 1 - Math.exp(-dt * 8));
      const fast = clamp((speed - 4) / (26 + r * 4), 0, 1);
      // a tall phone screen sees very little across at the usual field of view, so widen it
      const base = 58 + Math.max(0, 1 - this.cam.aspect) * 30;
      S.fov = lerp(S.fov, base + fast * 16 + (run.input.tuck ? 6 : 0), 1 - Math.exp(-dt * 3));
      S.steer = lerp(S.steer, run.input.steer, 1 - Math.exp(-dt * 5));
    }
    S.shake = Math.max(0, S.shake - dt * 1.6);
    const sh = S.shake * S.shake * (0.08 + r * 0.25), t = performance.now() / 1000;
    this.cam.position.copy(S.pos).add(_v.set(Math.sin(t * 47) * sh, Math.sin(t * 59 + 1) * sh, Math.sin(t * 41 + 2) * sh));
    this.cam.up.copy(UP);
    this.cam.lookAt(S.look);
    this.cam.rotateZ(-S.steer * 0.09);
    S.punch = (S.punch || 0) * Math.exp(-dt * 7);
    this.cam.fov = S.fov + S.punch;
    // as far out as the near plane can go without clipping the ball: more depth precision for everything far away
    this.cam.near = Math.max(0.05, r * 0.15);
    this.cam.far = 260 + r * 90;
    this.cam.updateProjectionMatrix();
  }

  clearView(run, p, b) {
    const arr = run.statics, cd = -p.z;
    let a = 0, z = arr.length;
    while (a < z) { const m = (a + z) >> 1; if (arr[m].d < cd - 30) a = m + 1; else z = m; }
    for (let k = 0; k < 6; k++) {
      let hit = false;
      for (let i = a; i < arr.length && arr[i].d < cd + 30; i++) {
        const it = arr[i];
        if (it.eaten || it.h < 1.5 || p.y > it.y + it.h) continue;
        const info = ITEMS[it.key], rr = Math.max(info.w, info.dp) * it.scale * 0.42;
        if ((it.x - p.x) ** 2 + (it.d + p.z) ** 2 < rr * rr) { hit = true; break; }
      }
      if (!hit) return;
      p.x = lerp(p.x, b.x, 0.3); p.z = lerp(p.z, -b.d, 0.3); p.y = lerp(p.y, b.y + b.r, 0.2);
    }
  }

  punch(a) { this.camState.punch = (this.camState.punch || 0) + a; }

  shake(a) { this.camState.shake = Math.min(1.2, Math.max(this.camState.shake, a)); }

  // dt is world time (slowed in slow motion); the camera moves in real time
  frame(dt, t, run, mode = 'play', realDt = dt) {
    const b = run.ball, r = b.r, C = this.C;
    this.ball.setRadius(r);
    this.ball.update(dt, t, b);
    this.updateCamera(realDt, run, mode);
    const ahead = 140 + r * 70, behind = 25 + r * 12;
    this.drawItems(run, ahead, behind);
    for (const c of this.chunks) c.visible = c.userData.d1 > b.d - behind - 40 && c.userData.d0 < b.d + ahead + 60;
    // fog grows with the ball, so the far end of the run is a hazy promise
    const L = this.look;
    this.scene.fog.near = (30 + r * 20) / L.fog;
    this.scene.fog.far = (220 + r * 80) / Math.sqrt(L.fog);
    this.tU.uDetail.value = 0.6 + r * 0.6;
    // the sun follows the ball, so its shadows are crisp wherever it is
    const span = 10 + r * 9;
    this.sun.position.set(b.x + this.sunDir.x * span * 3, b.y + this.sunDir.y * span * 3, -b.d + this.sunDir.z * span * 3);
    this.sun.target.position.set(b.x, b.y, -b.d);
    const sc = this.sun.shadow.camera;
    if (sc.right !== span) { sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 0.5; sc.far = span * 7; sc.updateProjectionMatrix(); }
    this.sun.shadow.normalBias = 0.02 + r * 0.01;
    this.itemU.uTime.value = t;
    this.tU.uTime.value = t;
    this.sky.update(this.cam, t);
    // effects
    const fx = this.fx;
    const camVel = this._camVel || (this._camVel = new THREE.Vector3());
    if (this._lastCam) camVel.copy(this.cam.position).sub(this._lastCam).divideScalar(Math.max(dt, 1e-3)); else this._lastCam = new THREE.Vector3();
    this._lastCam.copy(this.cam.position);
    fx.puffs.u.uCamVel.value.copy(camVel);
    fx.flakes.u.uCamVel.value.copy(camVel);
    fx.puffs.update(dt);
    fx.clumps.update(dt, (x, z) => C.heightAt(x, -z));
    const snowAmt = C.def.snow;
    fx.flakes.update(dt, t, this.cam, 14 + r * 9, mode === 'play' || mode === 'finale' ? 0.25 + snowAmt * 0.75 : 0.5, [0.6 + snowAmt * 1.5, 0.3]);
    fx.trail.update();
    fx.lines.u.uTime.value = t;
    const fast = mode === 'play' ? clamp((b.speed - 10 - r * 1.5) / (22 + r * 3), 0, 1) : 0;
    fx.lines.u.uAmt.value = lerp(fx.lines.u.uAmt.value, fast, 1 - Math.exp(-dt * 4));
    // draw
    const R = this.renderer;
    R.clear();
    this.sky.render(R);
    R.clearDepth();
    R.render(this.scene, this.cam);
  }

  project(x, y, d) {
    _v.set(x, y, -d).project(this.cam);
    return { x: (_v.x * 0.5 + 0.5) * innerWidth, y: (-_v.y * 0.5 + 0.5) * innerHeight, on: _v.z < 1 && Math.abs(_v.x) < 1.2 && Math.abs(_v.y) < 1.2 };
  }
}
