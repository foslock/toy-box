// Background, sparkles, coins and glows.
import * as THREE from 'three';

/* ---------- the backdrop: a deep gradient with slow light blobs and drifting dust ---------- */
export function makeBackdrop() {
  const uniforms = { uTime: { value: 0 }, uTint: { value: new THREE.Color('#6a3fd6') }, uTint2: { value: new THREE.Color('#1c9fd6') }, uGlow: { value: 0 }, uGlowColor: { value: new THREE.Color('#ffd76a') }, uAspect: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, depthWrite: false, depthTest: false,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, .999, 1.); }`,
    fragmentShader: `
      uniform float uTime, uGlow, uAspect; uniform vec3 uTint, uTint2, uGlowColor; varying vec2 vUv;
      float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec2 p = (vUv - .5) * vec2(uAspect, 1.);
        vec3 c = mix(vec3(.025, .02, .055), vec3(.07, .045, .13), smoothstep(-.6, .5, p.y));
        float t = uTime * .05;
        vec2 a = vec2(sin(t * 1.3) * .35, cos(t * .9) * .2 + .1), b = vec2(cos(t * .7) * .45, sin(t * 1.1) * .25 - .15);
        c += uTint * .13 * smoothstep(.75, 0., length(p - a));
        c += uTint2 * .09 * smoothstep(.7, 0., length(p - b));
        c += vec3(.03, .025, .06) * n(p * 3. + t);
        c += uGlowColor * uGlow * smoothstep(.9, 0., length(p * vec2(.8, 1.)));
        // soft light rays from the middle
        float ang = atan(p.y, p.x), rays = pow(.5 + .5 * sin(ang * 9. + uTime * .08), 6.);
        c += uTint * rays * .035 * smoothstep(1., .1, length(p)) * (.5 + uGlow);
        c *= 1. - .35 * smoothstep(.45, 1.1, length(p));
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  return { mesh, uniforms };
}

/* ---------- particles: sparkles, dust, confetti, coins, all as camera-facing points ---------- */
const PVERT = `
  attribute vec4 aColor; attribute float aSize; attribute float aKind; attribute float aSpin;
  varying vec4 vColor; varying float vKind; varying float vSpin;
  uniform float uScale;
  void main() {
    vColor = aColor; vKind = aKind; vSpin = aSpin;
    vec4 mv = modelViewMatrix * vec4(position, 1.);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const PFRAG = `
  varying vec4 vColor; varying float vKind; varying float vSpin;
  void main() {
    vec2 p = gl_PointCoord * 2. - 1.;
    float c = cos(vSpin), s = sin(vSpin); p = mat2(c, -s, s, c) * p;
    float a;
    if (vKind < .5) {            // four-point star with a glow
      float star = max(0., 1. - abs(p.x * p.y) * 18. - length(p) * .9);
      a = pow(star, 1.6) + .35 * exp(-dot(p, p) * 6.);
    } else if (vKind < 1.5) {    // soft dot
      a = exp(-dot(p, p) * 3.5);
    } else if (vKind < 2.5) {    // confetti square
      a = step(abs(p.x), .55) * step(abs(p.y), .32);
    } else {                     // a coin seen edge-on as it spins
      float w = abs(cos(vSpin * 1.7)) * .9 + .1;
      vec2 q = vec2(p.x / w, p.y);
      float d = length(q);
      a = smoothstep(1., .9, d);
      float rim = smoothstep(.62, .72, d);
      gl_FragColor = vec4(mix(vec3(1., .86, .38), vec3(.86, .6, .12), rim) * (1. + .5 * (1. - d)), a * vColor.a);
      if (gl_FragColor.a < .01) discard;
      return;
    }
    gl_FragColor = vec4(vColor.rgb * a, a * vColor.a);
    if (a * vColor.a < .003) discard;
  }`;

export class Particles {
  constructor(max = 1600) {
    this.max = max; this.n = 0;
    const g = this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max); this.kind = new Float32Array(max); this.spin = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aKind', new THREE.BufferAttribute(this.kind, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSpin', new THREE.BufferAttribute(this.spin, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uScale: { value: 400 } };
    this.additive = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.additive.frustumCulled = false; this.additive.renderOrder = 20;
    this.list = [];
  }
  get object() { return this.additive; }
  // o: { p: Vector3, v: Vector3, life, size, color, alpha, kind: 0 star 1 dot 2 confetti 3 coin, gravity, drag, spin, grow, target(fn) }
  spawn(o) {
    if (this.list.length >= this.max) this.list.shift();
    const c = new THREE.Color(o.color ?? '#ffffff');
    this.list.push({ p: o.p.clone(), v: o.v ? o.v.clone() : new THREE.Vector3(), age: 0, life: o.life ?? 1, size: o.size ?? 1, c, a: o.alpha ?? 1, kind: o.kind ?? 0,
      g: o.gravity ?? 0, drag: o.drag ?? 1.5, spin: o.spin ?? 0, vs: o.vs ?? (Math.random() - .5) * 6, grow: o.grow ?? 0, home: o.home ?? null, fade: o.fade ?? true, onDone: o.onDone });
  }
  burst(p, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - .5) * (o.flat ? .6 : 2.4), sp = (o.speed ?? 8) * (.3 + Math.random() * .9);
      const v = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e) + (o.up ?? 0), Math.sin(e) * .4).multiplyScalar(sp);
      const color = Array.isArray(o.colors) ? o.colors[i % o.colors.length] : o.color;
      this.spawn({ p: p.clone().add(new THREE.Vector3((Math.random() - .5) * (o.spread ?? 0), (Math.random() - .5) * (o.spread ?? 0), 0)), v, life: (o.life ?? .9) * (.6 + Math.random() * .7),
        size: (o.size ?? 1) * (.5 + Math.random()), color, kind: o.kind ?? 0, gravity: o.gravity ?? -4, drag: o.drag ?? 2.2, spin: Math.random() * 6 });
    }
  }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const q = L[i];
      q.age += dt;
      if (q.home) {
        // fly home (a function returning a world position): speed up as it goes
        const target = q.home(), k = Math.min(1, q.age / q.life);
        const e = k * k * (3 - 2 * k);
        q.p.lerpVectors(q.start ?? (q.start = q.p.clone()), target, e);
        q.p.y += Math.sin(k * Math.PI) * (q.arc ?? (q.arc = 1.5 + Math.random() * 2));
        q.p.x += Math.sin(k * Math.PI) * (q.side ?? (q.side = (Math.random() - .5) * 3));
      } else {
        q.v.y += q.g * dt;
        q.v.multiplyScalar(Math.exp(-q.drag * dt));
        q.p.addScaledVector(q.v, dt);
      }
      q.spin += q.vs * dt;
      if (q.age >= q.life) { L.splice(i, 1); q.onDone?.(); }
    }
    const n = this.n = Math.min(L.length, this.max);
    for (let i = 0; i < n; i++) {
      const q = L[i], k = q.age / q.life;
      this.pos[i * 3] = q.p.x; this.pos[i * 3 + 1] = q.p.y; this.pos[i * 3 + 2] = q.p.z;
      const a = q.fade ? q.a * (k < .15 ? k / .15 : 1 - Math.pow((k - .15) / .85, 2)) : q.a;
      this.col[i * 4] = q.c.r; this.col[i * 4 + 1] = q.c.g; this.col[i * 4 + 2] = q.c.b; this.col[i * 4 + 3] = Math.max(0, a);
      this.size[i] = q.size * (1 + q.grow * k); this.kind[i] = q.kind; this.spin[i] = q.spin;
    }
    this.geo.setDrawRange(0, n);
    for (const name of ['position', 'aColor', 'aSize', 'aKind', 'aSpin']) this.geo.attributes[name].needsUpdate = true;
  }
}

/* ---------- glows: additive halos behind special cards ---------- */
let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.22, 'rgba(255,255,255,.55)'); gr.addColorStop(.55, 'rgba(255,255,255,.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return (glowTex = new THREE.CanvasTexture(c));
}
export function makeGlow(color = '#ffd76a', size = 10) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, toneMapped: false }));
  m.scale.set(size, size, 1); m.renderOrder = -1;
  return m;
}
// A card-shaped rim of light (for the aura around a face-down special card).
let rimTex = null;
export function makeRim(color = '#ffd76a') {
  if (!rimTex) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 340;
    const g = c.getContext('2d');
    for (let i = 14; i >= 1; i--) { g.strokeStyle = `rgba(255,255,255,${.05 + (14 - i) * .012})`; g.lineWidth = i * 4; g.beginPath(); g.roundRect(48, 48, 160, 244, 14); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 3; g.beginPath(); g.roundRect(48, 48, 160, 244, 14); g.stroke();
    rimTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rimTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, toneMapped: false }));
  m.scale.set(6.3 * 256 / 160, 8.8 * 340 / 244, 1);
  return m;
}
