// Snow in the air and on the ground: powder spray and puffs (soft billboards that stretch into streaks the faster they
// move past the camera), falling flakes around the camera, clumps that tumble and bounce, the groove the ball carves,
// and speed lines at the edge of the screen.
import * as THREE from 'three';
import { NOISE } from './shaders.js';

const PUFF_VS = /* glsl */`
attribute vec2 corner;
attribute vec3 iPos;
attribute vec3 iVel;
attribute vec2 iSA;       // size, alpha
uniform vec3 uCamVel;
uniform float uShutter;
varying vec2 vC;
varying float vA;
varying float vUp;
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(iPos, 1.0);
  vec3 vv = (viewMatrix * vec4(iVel - uCamVel, 0.0)).xyz;
  // how far it moves across the screen while the shutter's open, in the sprite's own units
  vec2 dir = vv.xy - vv.z * mvPosition.xy / min(mvPosition.z, -0.05);
  float sp = length(dir);
  vec2 ax = sp > 1e-4 ? dir / sp : vec2(0.0, 1.0);
  vec2 ay = vec2(-ax.y, ax.x);
  float stretch = 1.0 + sp * uShutter / max(iSA.x, 1e-3);
  stretch = min(stretch, 40.0);
  mvPosition.xy += (corner.x * ay + corner.y * ax * stretch) * iSA.x;
  vC = corner;
  vA = iSA.y / sqrt(stretch);
  vUp = dot(corner.x * ay + corner.y * ax, vec2(0.0, 1.0));
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const PUFF_FS = /* glsl */`
uniform vec3 uColor, uShade;
uniform float uSoft;
varying vec2 vC;
varying float vA;
varying float vUp;
#include <fog_pars_fragment>
void main() {
  float r = length(vC);
  if (r > 1.0) discard;
  float a = pow(1.0 - r, uSoft) * vA;
  vec3 c = mix(uShade, uColor, clamp(0.55 + vUp * 0.45, 0.0, 1.0));
  gl_FragColor = vec4(c, a);
  #include <fog_fragment>
}`;

class Billboards {
  constructor(cap, soft) {
    this.cap = cap;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
    g.setAttribute('corner', new THREE.Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.pos = new Float32Array(cap * 3); this.vel = new Float32Array(cap * 3); this.sa = new Float32Array(cap * 2);
    this.aPos = new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aVel = new THREE.InstancedBufferAttribute(this.vel, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSA = new THREE.InstancedBufferAttribute(this.sa, 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iVel', this.aVel); g.setAttribute('iSA', this.aSA);
    g.instanceCount = 0;
    this.u = {
      uColor: { value: new THREE.Color('#ffffff') }, uShade: { value: new THREE.Color('#9fb6dd') },
      uCamVel: { value: new THREE.Vector3() }, uShutter: { value: 0.03 }, uSoft: { value: soft },
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    };
    this.mat = new THREE.ShaderMaterial({ vertexShader: PUFF_VS, fragmentShader: PUFF_FS, uniforms: this.u, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.g = g;
  }
  flush(n) {
    this.g.instanceCount = n;
    this.aPos.needsUpdate = this.aVel.needsUpdate = this.aSA.needsUpdate = true;
    this.aPos.addUpdateRange?.(0, n * 3); this.aVel.addUpdateRange?.(0, n * 3); this.aSA.addUpdateRange?.(0, n * 2);
  }
}

// spray and puffs: short-lived, physical
class Puffs extends Billboards {
  constructor(cap) {
    super(cap, 1.6);
    this.n = 0;
    this.p = new Float32Array(cap * 12);   // x y z vx vy vz size grow age life drag grav
    this.mesh.renderOrder = 2;
  }
  spawn(x, y, z, vx, vy, vz, size, life, grow = 1, drag = 1.5, grav = 3) {
    if (this.n >= this.cap) { // replace an old one
      const k = Math.floor(Math.random() * this.cap) * 12;
      this.set(k, x, y, z, vx, vy, vz, size, life, grow, drag, grav);
      return;
    }
    this.set(this.n++ * 12, x, y, z, vx, vy, vz, size, life, grow, drag, grav);
  }
  set(k, x, y, z, vx, vy, vz, size, life, grow, drag, grav) {
    const p = this.p;
    p[k] = x; p[k + 1] = y; p[k + 2] = z; p[k + 3] = vx; p[k + 4] = vy; p[k + 5] = vz;
    p[k + 6] = size; p[k + 7] = grow; p[k + 8] = 0; p[k + 9] = life; p[k + 10] = drag; p[k + 11] = grav;
  }
  update(dt) {
    const p = this.p;
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      const k = i * 12;
      p[k + 8] += dt;
      if (p[k + 8] >= p[k + 9]) continue;
      const dr = Math.max(0, 1 - p[k + 10] * dt);
      p[k + 3] *= dr; p[k + 4] = p[k + 4] * dr - p[k + 11] * dt; p[k + 5] *= dr;
      p[k] += p[k + 3] * dt; p[k + 1] += p[k + 4] * dt; p[k + 2] += p[k + 5] * dt;
      p[k + 6] *= 1 + p[k + 7] * dt;
      if (w !== i) p.copyWithin(w * 12, k, k + 12);
      const o = w * 12, t = p[o + 8] / p[o + 9];
      this.pos[w * 3] = p[o]; this.pos[w * 3 + 1] = p[o + 1]; this.pos[w * 3 + 2] = p[o + 2];
      this.vel[w * 3] = p[o + 3]; this.vel[w * 3 + 1] = p[o + 4]; this.vel[w * 3 + 2] = p[o + 5];
      this.sa[w * 2] = p[o + 6];
      this.sa[w * 2 + 1] = Math.min(1, t * 8) * (1 - t) ** 1.4 * 0.7;
      w++;
    }
    this.n = w;
    this.flush(w);
  }
}

// falling snow in a box around the camera, wrapped as the camera moves
class Flakes extends Billboards {
  constructor(cap) {
    super(cap, 1.2);
    this.mesh.renderOrder = 3;
    this.seed = new Float32Array(cap * 4);
    for (let i = 0; i < cap; i++) {
      this.seed[i * 4] = Math.random(); this.seed[i * 4 + 1] = Math.random() * 6.28; this.seed[i * 4 + 2] = 0.6 + Math.random() * 0.8; this.seed[i * 4 + 3] = Math.random();
    }
    this.box = 0;
    this.u.uShutter.value = 0.045;
  }
  update(dt, t, cam, B, density, wind) {
    const n = Math.floor(this.cap * density), P = this.pos, c = cam.position;
    // first time, or the box has grown with the ball: spread them through the new box
    const scale = this.box ? B / this.box : 0;
    if (!this.box || scale > 1.15 || scale < 0.87) {
      for (let i = 0; i < this.cap; i++) {
        const k = i * 3;
        if (!this.box) { P[k] = c.x + (Math.random() - 0.5) * B; P[k + 1] = c.y + (Math.random() - 0.5) * B; P[k + 2] = c.z + (Math.random() - 0.5) * B; }
        else { P[k] = c.x + (P[k] - c.x) * scale; P[k + 1] = c.y + (P[k + 1] - c.y) * scale; P[k + 2] = c.z + (P[k + 2] - c.z) * scale; }
      }
      this.box = B;
    }
    const Bb = this.box;
    for (let i = 0; i < n; i++) {
      const s = this.seed, k = i * 3, j = i * 4;
      const fall = 1.1 * s[j + 2] * Math.sqrt(Bb / 20);
      const vx = wind[0] + Math.sin(t * 1.3 + s[j + 1]) * 0.4, vy = -fall, vz = wind[1] + Math.cos(t * 1.1 + s[j + 1]) * 0.3;
      let rx = P[k] + vx * dt - c.x, ry = P[k + 1] + vy * dt - c.y, rz = P[k + 2] + vz * dt - c.z;
      rx -= Bb * Math.round(rx / Bb); ry -= Bb * Math.round(ry / Bb); rz -= Bb * Math.round(rz / Bb);
      P[k] = c.x + rx; P[k + 1] = c.y + ry; P[k + 2] = c.z + rz;
      this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
      this.sa[i * 2] = Bb * 0.0016 * (0.6 + s[j + 3]);
      // thin out right in front of the lens
      const near = Math.hypot(rx, ry, rz);
      this.sa[i * 2 + 1] = 0.85 * Math.min(1, near / (Bb * 0.06));
    }
    this.flush(n);
  }
}

// clumps of snow that fly off, bounce once or twice and melt away
class Clumps {
  constructor(cap) {
    this.cap = cap;
    const g = new THREE.IcosahedronGeometry(1, 0);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.p = [];
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
  }
  spawn(x, y, z, vx, vy, vz, size) {
    if (this.p.length >= this.cap) this.p.shift();
    this.p.push({ x, y, z, vx, vy, vz, size, age: 0, life: 1.6 + Math.random(), rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 12, b: 0 });
  }
  update(dt, ground) {
    let n = 0;
    this.p = this.p.filter(c => (c.age += dt) < c.life);
    for (const c of this.p) {
      c.vy -= 14 * dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      const gy = ground(c.x, c.z) + c.size * 0.5;
      if (c.y < gy) { c.y = gy; if (c.vy < -1 && c.b < 2) { c.vy *= -0.35; c.vx *= 0.6; c.vz *= 0.6; c.b++; } else { c.vy = 0; c.vx *= 0.9; c.vz *= 0.9; } }
      c.rx += c.spin * dt; c.ry += c.spin * 0.7 * dt;
      const t = c.age / c.life, sz = c.size * (t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3);
      this.m.compose(this.v.set(c.x, c.y, c.z), this.q.setFromEuler(this.e.set(c.rx, c.ry, 0)), this.s.setScalar(sz));
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// the groove the snowball leaves: a ribbon laid along the ground, darker in the middle where the snow's packed down
const TRAIL_VS = /* glsl */`
attribute vec2 aT;   // across (-1..1), alpha
varying vec2 vT;
#include <fog_pars_vertex>
void main() { vT = aT; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const TRAIL_FS = /* glsl */`
uniform vec3 uGroove, uRim;
varying vec2 vT;
#include <fog_pars_fragment>
void main() {
  float a = abs(vT.x);
  vec3 c = mix(uGroove, uRim, smoothstep(0.55, 0.95, a));
  float alpha = vT.y * (1.0 - smoothstep(0.9, 1.0, a)) * mix(0.75, 1.0, smoothstep(0.5, 0.9, a));
  gl_FragColor = vec4(c, alpha);
  #include <fog_fragment>
}`;
class Trail {
  constructor(cap) {
    this.cap = cap;
    this.pts = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(cap * 2 * 3); this.t = new Float32Array(cap * 2 * 2);
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aT = new THREE.BufferAttribute(this.t, 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aT', this.aT);
    const idx = [];
    for (let i = 0; i < cap - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    this.u = { uGroove: { value: new THREE.Color('#b9c9e6') }, uRim: { value: new THREE.Color('#ffffff') }, ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) };
    this.mat = new THREE.ShaderMaterial({ vertexShader: TRAIL_VS, fragmentShader: TRAIL_FS, uniforms: this.u, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.g = g;
  }
  clear() { this.pts.length = 0; this.g.setDrawRange(0, 0); }
  // the ball left the ground: the next groove starts afresh rather than joining up through the air
  lift() { this.broken = true; }
  add(x, y, z, nx, ny, nz, dx, dz, w, a) {
    let last = this.pts[this.pts.length - 1];
    if (this.broken && last) {
      this.broken = false;
      last.a = 0;
      if (this.pts.length >= this.cap) this.pts.shift();
      this.pts.push({ x, y, z, nx, ny, nz, dx, dz, w, a: 0 });
      return;
    }
    if (last && Math.hypot(x - last.x, z - last.z) < Math.max(0.12, w * 0.35)) { last.a = Math.max(last.a, a); return; }
    if (this.pts.length >= this.cap) this.pts.shift();
    this.pts.push({ x, y, z, nx, ny, nz, dx, dz, w, a });
  }
  update() {
    const n = this.pts.length;
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      // across the direction of travel, in the plane of the ground
      let sx = p.dz * p.ny, sy = -(p.dz * p.nx - p.dx * p.nz), sz = -p.dx * p.ny;
      const l = Math.hypot(sx, sy, sz) || 1; sx /= l; sy /= l; sz /= l;
      const k = i * 6;
      this.pos[k] = p.x - sx * p.w; this.pos[k + 1] = p.y - sy * p.w; this.pos[k + 2] = p.z - sz * p.w;
      this.pos[k + 3] = p.x + sx * p.w; this.pos[k + 4] = p.y + sy * p.w; this.pos[k + 5] = p.z + sz * p.w;
      const fade = Math.min(1, i / 40) * p.a;
      this.t[i * 4] = -1; this.t[i * 4 + 1] = fade; this.t[i * 4 + 2] = 1; this.t[i * 4 + 3] = fade;
    }
    this.aPos.needsUpdate = true; this.aT.needsUpdate = true;
    this.g.setDrawRange(0, Math.max(0, n - 1) * 6);
  }
}

// manga speed lines round the edge of the screen
const LINES_FS = /* glsl */`
${NOISE}
uniform float uAmt, uTime, uAspect;
uniform vec3 uCol;
varying vec2 vUv;
void main() {
  vec2 p = (vUv * 2.0 - 1.0) * vec2(uAspect, 1.0);
  float r = length(p) / length(vec2(uAspect, 1.0));
  float a = atan(p.y, p.x);
  float n = hash12(vec2(floor(a * 70.0), floor(uTime * 14.0)));
  float line = step(0.82, n) * smoothstep(0.55 - uAmt * 0.15, 1.0, r);
  float w = fract(a * 70.0); line *= smoothstep(0.0, 0.25, w) * smoothstep(1.0, 0.75, w);
  gl_FragColor = vec4(uCol, line * uAmt * 0.55);
}`;
class SpeedLines {
  constructor() {
    this.u = { uAmt: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 }, uCol: { value: new THREE.Color('#ffffff') } };
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: LINES_FS, uniforms: this.u, transparent: true, depthTest: false, depthWrite: false,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 100;
  }
}

export class FX {
  constructor(scene, mobile) {
    this.puffs = new Puffs(mobile ? 700 : 1400);
    this.flakes = new Flakes(mobile ? 900 : 1800);
    this.clumps = new Clumps(160);
    this.trail = new Trail(700);
    this.lines = new SpeedLines();
    scene.add(this.trail.mesh, this.puffs.mesh, this.flakes.mesh, this.clumps.mesh, this.lines.mesh);
  }
  setLook(L) {
    const snow = new THREE.Color(L.snow), shade = new THREE.Color(L.shade);
    this.puffs.u.uColor.value.copy(snow); this.puffs.u.uShade.value.copy(shade).lerp(snow, 0.45);
    this.flakes.u.uColor.value.copy(snow).multiplyScalar(L.flake); this.flakes.u.uShade.value.copy(shade).lerp(snow, 0.6);
    this.trail.u.uGroove.value.copy(shade).lerp(snow, 0.45); this.trail.u.uRim.value.copy(snow).multiplyScalar(1.02);
    this.lines.u.uCol.value.copy(snow);
  }
}
