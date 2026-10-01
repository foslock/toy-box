// How Echo draws: the cave is pitch black, and every sound you make is a shell of "seeing" that grows out from your
// head at a steady speed. A surface lights up only while the shell is passing over it, and only if the sound could
// reach it: each pulse renders a cube map of distances from where it started, so walls hide what's behind them.
// When the shell meets a wall it comes back toward you a little dimmer: the echo. Sharper sounds go slower, shorter
// and finer; the whistle goes far and fast but coarse. A second pass finds edges (from depth and normals) and draws
// them in the colour of whatever lit them.
import * as THREE from 'three';
import { WATER, D, ROPE, MOVABLES, march } from './world.js';

export const NP = 6, NM = 10;           // pulses with occlusion (your sounds), and small ones without (steps, drips)
const WN = 128;                         // directions round each sound for the echo's wall distances
export const KINDS = {
  //       speed  range linger  band  blocky rings  echo
  snap:    { i: 0, speed: 7, range: 11, linger: .55, band: .13, q: 0, rings: .32, echo: .6, cool: .32 },
  clap:    { i: 1, speed: 13, range: 24, linger: .32, band: .22, q: .17, rings: .95, echo: .55, cool: .55 },
  whistle: { i: 2, speed: 22, range: 48, linger: .22, band: .5, q: .5, rings: 0, echo: .5, cool: 1.1 },
};
export const MINI = { step: 0, drip: 1, bump: 2, splash: 3, grind: 4, bubble: 5 };
export const AMBER = '#ffb347';

const GLSL_COMMON = /* glsl */`
float hash13(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm3(vec3 p) { return .55 * vnoise(p) + .3 * vnoise(p * 2.13 + 7.1) + .15 * vnoise(p * 4.37 + 3.3); }
`;

/* ---------- the echo material: one shader for rock, water, loose rock and the rope ---------- */
function echoShaders(low) {
  const calls = Array.from({ length: NP }, (_, i) => `
    if (uK[${i}].w >= 0.) { vec4 r = pulseAt(${i}, uP[${i}], uK[${i}], uE[${i}], uCube${i}, p, n, nb, solid); col += r.rgb; if (r.a > wmax) { wmax = r.a; fid = FID[int(uK[${i}].w)]; } }`).join('');
  const vertex = /* glsl */`
    in float aAO;
    out vec3 vW; out vec3 vN; out vec3 vVN; out vec3 vL; out float vAO;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.);
      vW = w.xyz; vL = position; vAO = aAO;
      vN = normalize(mat3(modelMatrix) * normal);
      vVN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * viewMatrix * w;
    }`;
  const fragment = /* glsl */`
    precision highp float;
    precision highp samplerCube;
    layout(location = 0) out vec4 oColor;
    layout(location = 1) out vec4 oNorm;
    in vec3 vW; in vec3 vN; in vec3 vVN; in vec3 vL; in float vAO;
    uniform float uTime, uCubeRes, uDebug, uMat;
    uniform vec3 uCam;
    uniform vec4 uP[${NP}], uK[${NP}], uE[${NP}];
    uniform highp sampler2D uW;                       // per pulse (a row each): distance to the wall at head height, ${WN} directions round
    vec2 wallAt(int slot, vec3 h) {                   // the distance, and how sure it is (not at the edge of something)
      float a = (atan(h.z, h.x) / 6.28318 + .5) * ${WN}.;
      int i0 = int(floor(a)) % ${WN}, i1 = (i0 + 1) % ${WN};
      float w0 = texelFetch(uW, ivec2(i0, slot), 0).r, w1 = texelFetch(uW, ivec2(i1, slot), 0).r;
      float wm = texelFetch(uW, ivec2((i0 + ${WN - 1}) % ${WN}, slot), 0).r, wp = texelFetch(uW, ivec2((i1 + 1) % ${WN}, slot), 0).r;
      float W = mix(w0, w1, fract(a));
      float kink = max(abs(wm - 2. * w0 + w1), abs(w0 - 2. * w1 + wp)) / max(W, 1.);      // corners and doorways: no clean echo
      return vec2(W, smoothstep(2.5, .8, abs(w0 - w1)) * smoothstep(.32, .14, kink));
    }
    uniform vec4 uMP[${NM}], uMK[${NM}];
    ${Array.from({ length: NP }, (_, i) => `uniform samplerCube uCube${i};`).join(' ')}
    const vec3 COL[3] = vec3[3](vec3(.5, .89, 1.), vec3(.95, .5, 1.), vec3(.72, 1., .42));
    const float DETAIL[3] = float[3](1., .45, 0.);
    const float SHAPE[3] = float[3](1., .7, .3);
    const float FID[3] = float[3](1., .55, .18);
    const float GAIN[3] = float[3](1.05, 1., .9);
    const vec3 MCOL[6] = vec3[6](vec3(.78, .72, .62), vec3(.5, .82, .95), vec3(.72, .72, .74), vec3(.5, .78, .95), vec3(1., .7, .3), vec3(.55, .85, 1.));
    const float B4[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
    ${GLSL_COMMON}
    float bayer(vec2 p) { ivec2 q = ivec2(mod(p, 4.)); return (B4[q.x + q.y * 4] + .5) / 16.; }
    float unpackD(vec4 c) { return (c.r * 255. + c.g) * (64. / 255.); }

    vec4 pulseAt(int slot, vec4 P, vec4 K, vec4 E, samplerCube cube, vec3 p, vec3 n, vec3 nb, float solid) {
      int kind = int(K.w);
      float age = uTime - P.w, speed = K.x, range = K.y, linger = K.z;
      float R = age * speed;
      vec3 v = p - P.xyz;
      float d = length(v);
      if (d > range + 1. || d > R + 3. * E.x) return vec4(0.);
      vec3 dir = v / max(d, 1e-4);
      float facing = dot(n, -dir);
      if (facing < -.05) return vec4(0.);
      float stored = unpackD(texture(cube, dir));
      float bias = .25 + d * (1.6 / uCubeRes) * .7 / max(abs(facing), .07);
      if (d > stored + bias) return vec4(0.);
      float q = E.y;
      float dq = q > 0. ? length((floor(p / q) + .5) * q - P.xyz) : d;
      float x = R - dq, w = E.x;
      float front = exp(-x * x / (w * w));
      float trail = x > 0. ? exp(-x / (speed * linger)) : 0.;
      float rings = E.z > 0. ? pow(.5 + .5 * cos(6.2832 * x / E.z), 8.) * trail : 0.;
      vec3 nn = normalize(mix(n, nb, DETAIL[kind]));
      float shade = mix(1., .18 + .82 * max(dot(nn, -dir), 0.), SHAPE[kind]);
      float fade = 1. - smoothstep(range * .45, range, d);
      float I = (front + .13 * trail + .6 * rings) * shade * fade * GAIN[kind];
      // the echo: off the wall straight out from you in this direction, and back
      float e = 0.;
      vec3 h = vec3(v.x, 0., v.z); float dh = length(h);
      if (E.w > 0. && dh > .6) {
        vec2 Wc = wallAt(slot, h / dh);
        float W = Wc.x;
        if (W < range * .92 && dh < W - .3 && Wc.y > 0.) {
          float de = sqrt((2. * W - dh) * (2. * W - dh) + v.y * v.y), xe = R - de, we = w * 1.8;
          e = exp(-xe * xe / (we * we)) * E.w * Wc.y * (1. - smoothstep(range * .35, range * .92, W)) * smoothstep(.3, 1.5, W - dh) * mix(1., shade, .5);
        }
      }
      vec3 c = COL[kind];
      return vec4(c * I * solid + mix(c, vec3(1.), .5) * e, I + e);
    }
    vec3 miniAt(vec4 P, vec4 K, vec3 p, vec3 n) {
      float age = uTime - P.w, speed = K.x, range = K.y;
      float R = age * speed;
      vec3 v = p - P.xyz; float d = length(v);
      if (d > range || d > R + .4) return vec3(0.);
      float facing = dot(n, -v / max(d, 1e-3));
      if (facing < -.05) return vec3(0.);
      float x = R - d, w = .12;
      float I = (exp(-x * x / (w * w)) + (x > 0. ? .3 * exp(-x / (speed * .2)) : 0.)) * (1. - smoothstep(range * (K.w == 2. ? .55 : .3), range, d));
      return MCOL[int(K.w)] * I * K.z * (.35 + .65 * max(facing, 0.));
    }

    void main() {
      vec3 n = normalize(vN);
      if (!gl_FrontFacing) n = -n;
      vec3 p = vW;
      int mat = int(uMat + .5);
      if (uDebug > 0.) {                               // ?see: the lights on, for building the cave
        vec3 l = normalize(uCam - p);
        float s = .15 + .85 * max(dot(n, l), 0.);
        vec3 base = mat == 1 ? vec3(.2, .4, .8) : mat == 2 ? vec3(1., .7, .3) : mix(vec3(.55, .5, .45), vec3(.4, .45, .35), smoothstep(.5, .8, n.y));
        oColor = vec4(base * s * mix(.45, 1., vAO) * (1. - smoothstep(30., 80., length(uCam - p)) * .7), 1.);
        oNorm = vec4(normalize(vVN) * .5 + .5, 1.);
        return;
      }
      vec3 nb = n;
      ${low ? '' : `if (mat == 0) {
        vec3 q = p * 2.4; float e = .09, f0 = fbm3(q);
        vec3 g = vec3(fbm3(q + vec3(e, 0, 0)) - f0, fbm3(q + vec3(0, e, 0)) - f0, fbm3(q + vec3(0, 0, e)) - f0) / e;
        nb = normalize(n - .55 * (g - n * dot(g, n)));
      }`}
      float solid = mat == 1 ? .9 : 1.;
      vec3 col = vec3(0.); float wmax = 0., fid = 0.;
      ${calls}
      for (int i = 0; i < ${NM}; i++) if (uMK[i].w >= 0.) col += miniAt(uMP[i], uMK[i], p, n);
      float I = max(col.r, max(col.g, col.b));
      float cell = fid > .7 ? 1. : fid > .3 ? 2. : 3.;
      float th = bayer(floor(gl_FragCoord.xy / cell));
      if (mat == 0) {                                   // rock is solid; the floor's grit is a little dithered
        float grit = smoothstep(.55, .85, n.y) * .5;
        col = mix(col, I > 0. ? col / I * step(th, I * 1.15) * min(I * 1.6, 1.) : col, grit);
        col *= mix(.5, 1., vAO);
      } else if (mat == 1) {                            // water: a scatter of dots that shimmers
        float t2 = bayer(floor(gl_FragCoord.xy / cell) + floor(vec2(uTime * 9., uTime * 7.)));
        col = I > 0. ? col / I * step(t2, I * .5) * 1.1 : col;
      } else if (mat == 2) {                            // loose rock: amber, with stripes that move with it
        float s = step(.5, fract(dot(vL, vec3(1.4, 1.1, 1.4)) * 1.6));
        col = mix(col, vec3(1., .7, .28) * I, .78) * (.22 + .78 * s);
      } else {
        col = mix(col, I > 0. ? col / I * step(th, I * 1.3) : col, .35);
      }
      oColor = vec4(col, fid);
      oNorm = vec4(normalize(vVN) * .5 + .5, 1.);
    }`;
  return { vertex, fragment };
}

/* ---------- the distance material, for each pulse's cube map ---------- */
const distVertex = /* glsl */`varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const distFragment = /* glsl */`
  varying vec3 vW; uniform vec3 uSrc; uniform float uSolid;
  void main() { float d = clamp(length(vW - uSrc) / 64., 0., .9999); gl_FragColor = vec4(floor(d * 255.) / 255., fract(d * 255.), uSolid, 1.); }`;

/* ---------- the final pass: edges, glow, water, daylight ---------- */
const compVertex = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const compFragment = (low) => /* glsl */`
  varying vec2 vUv;
  uniform sampler2D tColor, tNorm, tDepth, tLit;
  uniform vec2 uTexel;
  uniform float uNear, uFar, uLitOn, uExposure, uWhite, uUnder, uEcho, uTime, uVig, uFlash, uBlow, uGlare;
  float lin(float d) { return uNear * uFar / (uFar - d * (uFar - uNear)); }
  vec3 aces(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
  void main() {
    vec2 uv = vUv;
    if (uUnder > 0.) uv += vec2(sin(uv.y * 24. + uTime * 2.1), cos(uv.x * 19. + uTime * 1.7)) * .0025 * uUnder;
    vec4 c0 = texture2D(tColor, uv);
    vec3 col = c0.rgb;
    float off = mix(2.3, 1., c0.a);
    vec2 ox = vec2(uTexel.x * off, 0.), oy = vec2(0., uTexel.y * off);
    vec3 cl = texture2D(tColor, uv - ox).rgb, cr = texture2D(tColor, uv + ox).rgb, cu = texture2D(tColor, uv + oy).rgb, cd = texture2D(tColor, uv - oy).rgb;
    vec3 cmax = max(max(col, cl), max(max(cr, cu), cd));
    if (max(cmax.r, max(cmax.g, cmax.b)) > .004) {
      float zc = lin(texture2D(tDepth, uv).r), zl = lin(texture2D(tDepth, uv - ox).r), zr = lin(texture2D(tDepth, uv + ox).r);
      float zu = lin(texture2D(tDepth, uv + oy).r), zd = lin(texture2D(tDepth, uv - oy).r);
      float ed = abs(4. * zc - zl - zr - zu - zd) / zc;
      vec3 nc = texture2D(tNorm, uv).xyz * 2. - 1.;
      float en = 4. - dot(nc, texture2D(tNorm, uv - ox).xyz * 2. - 1.) - dot(nc, texture2D(tNorm, uv + ox).xyz * 2. - 1.)
                    - dot(nc, texture2D(tNorm, uv + oy).xyz * 2. - 1.) - dot(nc, texture2D(tNorm, uv - oy).xyz * 2. - 1.);
      float edge = clamp(smoothstep(.03, .1, ed) + smoothstep(.35, 1.1, en), 0., 1.);
      col += edge * cmax * 1.5;
    }
    ${low ? '' : `
    vec3 glow = vec3(0.);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * .785 + .39;
      glow += texture2D(tColor, uv + vec2(cos(a), sin(a)) * uTexel * 5.).rgb + texture2D(tColor, uv + vec2(cos(a + .39), sin(a + .39)) * uTexel * 11.).rgb * .6;
    }
    col += glow * .045;`}
    col *= uEcho;
    if (uLitOn > 0.) {
      vec3 L = pow(aces(texture2D(tLit, vUv).rgb * uExposure), vec3(1. / 2.2));
      float lum = dot(L, vec3(.3, .59, .11));
      L = mix(L, vec3(1.), uBlow * smoothstep(.45, .85, lum));       // eyes used to the dark: daylight is just white
      if (uGlare > 0.) {                                             // and it bleeds round the edges
        vec3 halo = vec3(0.);
        for (int i = 0; i < 12; i++) {
          float a = float(i) * .5236;
          vec2 d = vec2(cos(a), sin(a) * uTexel.y / uTexel.x);
          halo += aces(texture2D(tLit, vUv + d * .03).rgb * uExposure) + aces(texture2D(tLit, vUv + d * .075).rgb * uExposure) * .7 + aces(texture2D(tLit, vUv + d * .14).rgb * uExposure) * .45;
        }
        L += halo / 12. * uGlare;
      }
      col += L;
    }
    if (uUnder > 0.) col = col * mix(vec3(1.), vec3(.62, .86, 1.08), uUnder) + vec3(0., .012, .03) * uUnder;
    col += uFlash;
    float r = length(vUv - .5) * 1.45;
    col *= 1. - uVig * smoothstep(.25, 1., r);
    col = mix(col, vec3(1.), uWhite);
    gl_FragColor = vec4(col, 1.);
  }`;

/* ---------- the view ---------- */
export class View {
  constructor(canvas, { low = false, see = false } = {}) {
    this.low = low; this.see = see;
    const renderer = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
    renderer.setClearColor(0x000000, 1);
    renderer.autoClear = true;
    this.maxPR = Math.min(devicePixelRatio, low ? 1.25 : 1.75);
    this.pr = Math.min(this.maxPR, low ? 1 : 1.5);
    this.camera = new THREE.PerspectiveCamera(72, 1, .05, 400);
    this.camera.rotation.order = 'YXZ';
    this.scene = new THREE.Scene();             // what the pulses light
    this.lit = new THREE.Scene();               // daylight, near the end
    this.overlay = new THREE.Scene();           // outlines of rocks on the move
    this.chunks = [];
    this.litOn = false;

    // pulse uniforms, shared by every echo material
    const v4 = n => Array.from({ length: n }, () => new THREE.Vector4(0, 0, 0, -1));
    this.U = {
      uTime: { value: 0 }, uCubeRes: { value: low ? 128 : 256 }, uDebug: { value: see ? 1 : 0 }, uCam: { value: new THREE.Vector3() },
      uP: { value: v4(NP) }, uK: { value: v4(NP) }, uE: { value: v4(NP) }, uMP: { value: v4(NM) }, uMK: { value: v4(NM) },
      uW: { value: (() => { const t = new THREE.DataTexture(new Float32Array(WN * NP), WN, NP, THREE.RedFormat, THREE.FloatType); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })() },
    };
    this.cubes = [];
    for (let i = 0; i < NP; i++) {
      const rt = new THREE.WebGLCubeRenderTarget(this.U.uCubeRes.value, { type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true });
      const cam = new THREE.CubeCamera(.05, 70, rt);
      this.cubes.push({ rt, cam, t0: -99, life: 0, kind: -1 });
      this.U['uCube' + i] = { value: rt.texture };
    }
    this.pulseSlot = 0; this.miniSlot = 0;
    const sh = echoShaders(low);
    this.echoMat = mat => new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: sh.vertex, fragmentShader: sh.fragment, uniforms: { ...this.U, uMat: { value: mat } }, side: mat === 1 ? THREE.DoubleSide : THREE.FrontSide });
    this.rockMat = this.echoMat(0);
    this.waterMat = this.echoMat(1);
    this.looseMat = this.echoMat(2);
    this.propMat = this.echoMat(3);
    this.uSrc = { value: new THREE.Vector3() };
    const dist = solid => new THREE.ShaderMaterial({ vertexShader: distVertex, fragmentShader: distFragment, uniforms: { uSrc: this.uSrc, uSolid: { value: solid } }, side: THREE.DoubleSide });
    this.distRock = dist(1); this.distWater = dist(.12); this.distLoose = dist(.85);

    // render targets
    this.rt = new THREE.WebGLRenderTarget(4, 4, { count: 2, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: new THREE.DepthTexture(4, 4) });
    const hdr = renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float');
    this.rtLit = new THREE.WebGLRenderTarget(4, 4, { type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType });   // daylight can be brighter than white
    this.comp = new THREE.ShaderMaterial({
      vertexShader: compVertex, fragmentShader: compFragment(low), depthTest: false, depthWrite: false,
      uniforms: {
        tColor: { value: this.rt.textures[0] }, tNorm: { value: this.rt.textures[1] }, tDepth: { value: this.rt.depthTexture }, tLit: { value: this.rtLit.texture },
        uTexel: { value: new THREE.Vector2() }, uNear: { value: this.camera.near }, uFar: { value: this.camera.far },
        uLitOn: { value: 0 }, uExposure: { value: 1 }, uWhite: { value: 0 }, uUnder: { value: 0 }, uEcho: { value: 1 }, uTime: this.U.uTime, uVig: { value: 0 }, uFlash: { value: 0 }, uBlow: { value: 0 }, uGlare: { value: 0 },
      },
    });
    this.fs = new THREE.Scene();
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const q = new THREE.Mesh(tri, this.comp); q.frustumCulled = false;
    this.fs.add(q);
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.buildWater();
    this.buildRope();
    this.buildLoose();
    this.resize();
  }

  /* ----- things in the cave ----- */
  add(mesh, dist) { mesh.userData.echo = mesh.material; mesh.userData.dist = dist; this.scene.add(mesh); return mesh; }
  addChunks(list) {
    for (const c of list) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(c.pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(c.nor, 3));
      g.setAttribute('aAO', new THREE.BufferAttribute(c.ao, 1));
      g.setIndex(new THREE.BufferAttribute(c.idx, 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(...c.center), c.radius);
      const m = this.add(new THREE.Mesh(g, this.rockMat), this.distRock);
      m.userData.chunk = c;
      m.matrixAutoUpdate = false;
      this.chunks.push(m);
      if (c.nearMouth) this.onMouthChunk?.(g, c);
    }
  }
  buildWater() {
    this.water = [];
    for (const w of WATER) {
      const s = .3, pos = [];
      for (let x = w.x0; x < w.x1; x += s) for (let z = w.z0; z < w.z1; z += s) {
        if (D(x + s / 2, w.y, z + s / 2) > .45) continue;
        pos.push(x, w.y, z, x, w.y, z + s, x + s, w.y, z + s, x, w.y, z, x + s, w.y, z + s, x + s, w.y, z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => i % 3 === 1 ? 1 : 0), 3));
      g.setAttribute('aAO', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3).fill(1), 1));
      g.computeBoundingSphere();
      const m = this.add(new THREE.Mesh(g, this.waterMat), this.distWater);
      m.userData.isWater = true;
      this.water.push(m);
    }
  }
  buildRope() {
    const g1 = new THREE.CylinderGeometry(.045, .045, ROPE.top - ROPE.end, 6, 20, true);
    g1.translate(ROPE.x, (ROPE.top + ROPE.end) / 2, ROPE.z);
    const p = g1.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * .7) * .06); }
    const g2 = new THREE.TorusGeometry(.32, .06, 6, 24); g2.rotateX(Math.PI / 2); g2.translate(ROPE.coil[0], ROPE.coil[1] + .06, ROPE.coil[2]);
    const g3 = new THREE.TorusGeometry(.26, .06, 6, 24); g3.rotateX(Math.PI / 2 + .15); g3.translate(ROPE.coil[0] + .05, ROPE.coil[1] + .17, ROPE.coil[2] - .03);
    for (const g of [g1, g2, g3]) {
      g.setAttribute('aAO', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(1), 1));
      this.add(new THREE.Mesh(g, this.propMat), this.distRock);
    }
  }
  // Loose rocks: lumpy boulders that fill a 1.3 × 1 × 1.3 box.
  buildLoose() {
    this.loose = [];
    for (const m of MOVABLES) {
      const g = new THREE.BoxGeometry(1.3, 1, 1.3, 7, 6, 7), p = g.attributes.position;
      let s = m.id.length * 7.3;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i) / .65, y = p.getY(i) / .5, z = p.getZ(i) / .65;
        const l = Math.max(Math.abs(x), Math.abs(y), Math.abs(z)), r = Math.hypot(x, y, z) || 1;
        const k = .55;                                            // part way from box to ball
        x = x * (1 - k) + x / r * l * k * 1.18; y = y * (1 - k) + y / r * l * k * 1.18; z = z * (1 - k) + z / r * l * k * 1.18;
        const n = .93 + .07 * Math.sin(x * 3.1 + s) * Math.cos(z * 2.7 + y * 1.9 + s);
        p.setXYZ(i, Math.max(-1, Math.min(1, x * n)) * .65, Math.max(-1, Math.min(1, y * n)) * .5, Math.max(-1, Math.min(1, z * n)) * .65);
      }
      g.deleteAttribute('uv');
      const mg = mergeVerts(g);
      mg.computeVertexNormals();
      mg.setAttribute('aAO', new THREE.Float32BufferAttribute(new Float32Array(mg.attributes.position.count).fill(1), 1));
      const mesh = this.add(new THREE.Mesh(mg, this.looseMat), this.distLoose);
      mesh.position.set(m.x, m.y, m.z);
      // while it moves you see it anyway: a glowing rim, and fainter copies where it just was
      const edges = new THREE.Mesh(mg, rimMaterial());
      const trail = [0, 1, 2].map(() => { const e = new THREE.Mesh(mg, rimMaterial()); this.overlay.add(e); return e; });
      this.overlay.add(edges);
      this.loose.push({ mesh, edges, trail, glow: 0, hist: [] });
    }
  }
  // Called each frame with each loose rock's position and whether it is moving.
  placeLoose(i, x, y, z, moving, dt, t) {
    const L = this.loose[i];
    L.mesh.position.set(x, y, z);
    L.glow = moving ? Math.min(1, L.glow + dt * 6) : Math.max(0, L.glow - dt * 1.3);
    L.hist.push([t, x, y, z]); while (L.hist.length && t - L.hist[0][0] > .7) L.hist.shift();
    L.edges.position.set(x, y, z); L.edges.material.uniforms.uO.value = L.glow * .6; L.edges.visible = L.glow > .01;
    L.trail.forEach((e, k) => {
      const want = t - .16 * (k + 1);
      const h = L.hist.find(h => h[0] >= want) || L.hist[0];
      e.position.set(h[1], h[2], h[3]); e.material.uniforms.uO.value = L.glow * .22 * (1 - k / 3); e.visible = L.glow > .01;
    });
  }

  /* ----- pulses ----- */
  // A sound: a shell growing out of (x, y, z) from now. Renders where it can reach into a cube map first.
  emit(kindName, x, y, z, t, { scale = 1, speedK = 1 } = {}) {
    const K = KINDS[kindName];
    let slot = -1, oldest = 0;
    for (let i = 0; i < NP; i++) {
      const c = this.cubes[(this.pulseSlot + i) % NP];
      if (t - c.t0 > c.life) { slot = (this.pulseSlot + i) % NP; break; }
    }
    if (slot < 0) { for (let i = 1; i < NP; i++) if (this.cubes[i].t0 < this.cubes[oldest].t0) oldest = i; slot = oldest; }
    this.pulseSlot = (slot + 1) % NP;
    const c = this.cubes[slot], range = K.range * scale, speed = K.speed * speedK;
    c.t0 = t; c.kind = K.i; c.life = 2 * range / speed + K.linger * 3 + .3;
    this.renderCube(c, x, y, z, range);
    const T = this.U.uW.value, W = T.image.data;     // the walls round you at head height, for the echo
    for (let i = 0; i < WN; i++) {
      const a = (i / WN - .5) * Math.PI * 2;
      W[slot * WN + i] = march(x, y, z, Math.cos(a), 0, Math.sin(a), range);
    }
    T.needsUpdate = true;
    this.U.uP.value[slot].set(x, y, z, t);
    this.U.uK.value[slot].set(speed, range, K.linger, K.i);
    this.U.uE.value[slot].set(K.band, K.q, K.rings, K.echo);
    return slot;
  }
  renderCube(c, x, y, z, range) {
    const r = this.renderer;
    this.uSrc.value.set(x, y, z);
    for (const o of this.scene.children) {
      o.userData.vis = o.visible;
      if (o.userData.chunk) o.visible = o.geometry.boundingSphere.center.distanceTo(this.uSrc.value) < range + o.geometry.boundingSphere.radius;
      o.material = o.userData.dist;
    }
    c.cam.position.set(x, y, z);
    c.cam.updateMatrixWorld();
    r.setClearColor(0xffff00, 1);
    c.cam.update(r, this.scene);
    r.setClearColor(0x000000, 1);
    for (const o of this.scene.children) { o.material = o.userData.echo; o.visible = o.userData.vis; }
  }
  mini(kind, x, y, z, t, { range = 1.6, speed = 5, gain = 1 } = {}) {
    const i = this.miniSlot; this.miniSlot = (i + 1) % NM;
    this.U.uMP.value[i].set(x, y, z, t);
    this.U.uMK.value[i].set(speed, range, gain, kind);
  }
  // How far the live pulses reach right now: only chunks they could touch get drawn.
  active(t) {
    const out = [];
    for (let i = 0; i < NP; i++) { const c = this.cubes[i]; if (t - c.t0 < c.life) { const P = this.U.uP.value[i], K = this.U.uK.value[i]; out.push([P.x, P.y, P.z, K.y]); } }
    for (let i = 0; i < NM; i++) {
      const P = this.U.uMP.value[i], K = this.U.uMK.value[i];
      if (K.w >= 0 && t - P.w > K.y / K.x + .8) K.w = -1;
      if (K.w >= 0) out.push([P.x, P.y, P.z, K.y]);
    }
    for (let i = 0; i < NP; i++) if (t - this.cubes[i].t0 >= this.cubes[i].life) this.U.uK.value[i].w = -1;
    return out;
  }

  /* ----- drawing ----- */
  resize() {
    const w = innerWidth, h = innerHeight, r = this.renderer;
    r.setPixelRatio(this.pr);
    r.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 72 + 26 * (1 - w / h) : 72;            // tall phones see a bit wider, not a slot
    this.camera.updateProjectionMatrix();
    const W = Math.round(w * this.pr), H = Math.round(h * this.pr);
    this.rt.setSize(W, H); this.rtLit.setSize(W, H);
    this.comp.uniforms.uTexel.value.set(1 / W, 1 / H);
  }
  frame(t, look) {
    const U = this.U, cam = this.camera;
    U.uTime.value = t; U.uCam.value.copy(cam.position);
    const live = this.see ? null : this.active(t);
    const _c = new THREE.Vector3();
    for (const m of this.chunks) {
      if (!live) { m.visible = true; continue; }
      const bs = m.geometry.boundingSphere;
      m.visible = live.some(([x, y, z, r]) => _c.set(x, y, z).distanceTo(bs.center) < r + bs.radius);
    }
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    if ((look.echo ?? 1) > .01) r.render(this.scene, cam); else r.clear();     // out in daylight the echoes are gone
    const C = this.comp.uniforms;
    C.uLitOn.value = this.litOn ? 1 : 0;
    if (this.litOn) { r.setRenderTarget(this.rtLit); r.render(this.lit, cam); }
    Object.assign(C.uExposure, { value: look.exposure ?? 1 });
    C.uWhite.value = look.white || 0; C.uUnder.value = look.under || 0; C.uEcho.value = look.echo ?? 1; C.uVig.value = look.vig || 0; C.uFlash.value = look.flash || 0; C.uBlow.value = look.blow || 0; C.uGlare.value = look.glare || 0;
    r.setRenderTarget(null);
    r.render(this.fs, this.fsCam);
    if (this.loose.some(l => l.glow > .01)) { r.autoClear = false; r.render(this.overlay, cam); r.autoClear = true; }
  }
}

// A glowing silhouette: bright at the rim, nearly clear face-on, seen through anything in front of it.
function rimMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uO: { value: 0 }, uC: { value: new THREE.Color(AMBER) } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main() { vec4 m = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = -m.xyz; gl_Position = projectionMatrix * m; }`,
    fragmentShader: `uniform float uO; uniform vec3 uC; varying vec3 vN; varying vec3 vV;
      void main() { float r = 1. - abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(uC * (pow(r, 2.2) * 1.3 + .06) * uO, 1.); }`,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

// BoxGeometry has split corners; weld them so the boulders shade smoothly.
function mergeVerts(g) {
  const p = g.attributes.position, map = new Map(), pos = [], idx = [];
  const remap = new Int32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    let j = map.get(k);
    if (j === undefined) { j = pos.length / 3; map.set(k, j); pos.push(p.getX(i), p.getY(i), p.getZ(i)); }
    remap[i] = j;
  }
  const src = g.index.array;
  for (let i = 0; i < src.length; i++) idx.push(remap[src[i]]);
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(idx);
  return out;
}
