// The light of each mountain, and the sky: a gradient dome with the sun (or moon) and stars, and two rings of far-off
// peaks that keep their distance as you roll.
import * as THREE from 'three';
import { NOISE } from './shaders.js';

// sun: direction towards the sun in the camera's usual frame (x right, y up, z back up the slope)
export const LOOKS = {
  morning: { top: '#3f8fe6', horizon: '#cfe7fb', sunCol: '#fff1db', sunI: 2.5, sun: [0.82, 0.42, -0.1], hemiSky: '#a6c6f4', hemiGround: '#eef2f8', hemiI: 1.05,
    snow: '#f5f8ff', shade: '#7f9fd6', glow: 0.25, far: ['#8eaed3', '#b9cfe7'], fog: 1, stars: 0, flake: 0.95 },
  overcast: { top: '#8d9db2', horizon: '#dde3ea', sunCol: '#f2f2f0', sunI: 1.1, sun: [0.5, 0.8, 0.1], hemiSky: '#cbd6e4', hemiGround: '#e8ebf0', hemiI: 1.7,
    snow: '#f2f5fa', shade: '#9aa9c0', glow: 0.35, far: ['#a7b3c3', '#c9d1db'], fog: 1.7, stars: 0, flake: 0.95 },
  noon: { top: '#2b7fe6', horizon: '#bfe1ff', sunCol: '#ffffff', sunI: 2.8, sun: [-0.5, 0.75, 0.05], hemiSky: '#9cc0f6', hemiGround: '#f2f4f8', hemiI: 1.0,
    snow: '#f7f9ff', shade: '#7c9ddb', glow: 0.2, far: ['#7fa6d6', '#b0cbea'], fog: 0.8, stars: 0, flake: 1 },
  sunset: { top: '#3e4594', horizon: '#ffb28a', sunCol: '#ffb27a', sunI: 2.4, sun: [-0.6, 0.28, -0.75], hemiSky: '#a49ae0', hemiGround: '#ffd7c2', hemiI: 1.1,
    snow: '#fff1ec', shade: '#8b7fcf', glow: 0.6, far: ['#7d6fb0', '#c792a8'], fog: 1.1, stars: 0.15, flake: 1 },
  night: { top: '#081230', horizon: '#2a3f72', sunCol: '#b9ccff', sunI: 0.9, sun: [-0.4, 0.55, -0.7], hemiSky: '#4d64a8', hemiGround: '#2a3150', hemiI: 0.95,
    snow: '#e6eeff', shade: '#3c4f8c', glow: 1.25, far: ['#1d2b55', '#2c3f6e'], fog: 1.2, stars: 1, flake: 0.9 },
  golden: { top: '#477fcc', horizon: '#ffd9a2', sunCol: '#ffc785', sunI: 2.6, sun: [0.7, 0.35, -0.6], hemiSky: '#a9bde6', hemiGround: '#ffe6c8', hemiI: 1.0,
    snow: '#fff8ee', shade: '#8a96cf', glow: 0.45, far: ['#8a8fbf', '#d5b39a'], fog: 1, stars: 0, flake: 1 },
};

const SKY_VS = `
varying vec3 vDir;
void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const SKY_FS = `
${NOISE}
uniform vec3 uTop, uHorizon, uSunCol, uSunDir;
uniform float uStars, uTime;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
  col = mix(col, uHorizon * 1.04, smoothstep(0.0, -0.2, d.y));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunCol * (pow(sd, 900.0) * 3.0 + pow(sd, 40.0) * 0.25 + pow(sd, 6.0) * 0.12);
  if (uStars > 0.0) {
    vec3 c = floor(d * 260.0);
    float s = hash13(c);
    float tw = 0.6 + 0.4 * sin(uTime * (2.0 + s * 5.0) + s * 40.0);
    col += step(0.9965, s) * tw * uStars * smoothstep(0.02, 0.3, d.y) * vec3(0.9, 0.95, 1.0);
  }
  // soft streaky clouds near the horizon
  float cl = vnoise2(vec2(atan(d.z, d.x) * 6.0, d.y * 22.0)) * vnoise2(vec2(atan(d.z, d.x) * 17.0, d.y * 40.0 + 3.0));
  col = mix(col, mix(uHorizon, vec3(1.0), 0.6), smoothstep(0.25, 0.6, cl) * smoothstep(0.32, 0.06, d.y) * smoothstep(-0.02, 0.05, d.y) * 0.45 * (1.0 - uStars));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Sky {
  constructor() {
    // drawn first, in a scene of its own with a camera that sees far enough, then the depth is cleared for the world
    const scene = this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(60, 1, 1, 12000);
    this.u = {
      uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uStars: { value: 0 }, uTime: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.u, side: THREE.BackSide, depthWrite: false, fog: false });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);
    this.rings = [this.ring(3800, 520, 1.0, 11), this.ring(2600, 330, 0.85, 23)];
    for (const r of this.rings) scene.add(r);
  }

  // a ring of jagged peaks, snow on their shoulders and tops, fading into the haze at the foot
  ring(radius, height, sharp, seed) {
    const n = 240, pos = [], col = [], idx = [];
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const peaks = [];
    for (let i = 0; i < 26; i++) peaks.push([rnd() * Math.PI * 2, 0.35 + rnd() * 0.65, 0.05 + rnd() * 0.12]);
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      let h = 0.12;
      for (const [pa, ph, pw] of peaks) {
        let da = Math.abs(a - pa); da = Math.min(da, Math.PI * 2 - da);
        h = Math.max(h, ph * Math.max(0, 1 - da / pw) ** (0.9 + sharp * 0.4));
      }
      h += (rnd() - 0.5) * 0.04;
      const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
      pos.push(x, -height * 0.9, z, x, h * height, z);
      // snowline: white above, shaded blue-grey below
      col.push(0, 0, h, 1);
      if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aPeak', new THREE.Float32BufferAttribute(col, 2));
    g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color() }, uSnow: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() }, uH: { value: height } },
      vertexShader: `attribute vec2 aPeak; varying float vY; varying float vTop; uniform float uH;
        void main() { vY = position.y / uH; vTop = aPeak.y; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p; }`,
      fragmentShader: `uniform vec3 uCol, uSnow, uHaze; varying float vY; varying float vTop;
        void main() {
          float snow = smoothstep(vTop * 0.55, vTop * 0.75, vY);
          vec3 c = mix(uCol, uSnow, snow);
          c = mix(uHaze, c, smoothstep(-0.6, 0.35, vY) * 0.85);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
      depthWrite: false, fog: false,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = -9;
    return mesh;
  }

  setLook(L, sunDir) {
    this.u.uTop.value.set(L.top); this.u.uHorizon.value.set(L.horizon); this.u.uSunCol.value.set(L.sunCol);
    this.u.uSunDir.value.copy(sunDir);
    this.u.uStars.value = L.stars;
    const [near, far] = this.rings;
    far.material.uniforms.uCol.value.set(L.far[1]); far.material.uniforms.uSnow.value.set(L.horizon).lerp(new THREE.Color('#ffffff'), 0.5); far.material.uniforms.uHaze.value.set(L.horizon);
    near.material.uniforms.uCol.value.set(L.far[0]); near.material.uniforms.uSnow.value.set(L.snow).lerp(new THREE.Color(L.horizon), 0.25); near.material.uniforms.uHaze.value.set(L.horizon);
  }

  update(cam, t) {
    this.cam.quaternion.copy(cam.quaternion);
    this.cam.fov = cam.fov; this.cam.aspect = cam.aspect;
    this.cam.updateProjectionMatrix();
    this.dome.scale.setScalar(9000);
    this.u.uTime.value = t;
    for (const r of this.rings) r.position.set(0, -140, 0);
  }

  render(renderer) { renderer.render(this.scene, this.cam); }
}
