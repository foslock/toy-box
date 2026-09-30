// Sail: the sea, drawn with three.js in flat cel-shaded colours with ink outlines. The water is one big shader
// (Wind Waker-ish foam squiggles, surf round the islands, chevrons running along the currents, whirlpools swirling,
// a faint grid so the squares can be counted); the islands are a heightfield raised from the chart; the boat, her crew,
// the creatures and the props come from models.js. The page tells it what happened in a step (the events from
// rules.js) and it plays them out, a promise at a time.
import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { DIRS, LAND, ROCK, BARREL, POST, beastSquare } from './rules.js';
import { toon, noLine, makeBoat, makeWhale, makeShark, makeBuoy, makeBarrels, makePost, makeRock, Flora, makeHut, makeLighthouse, makePier, labelTexture, rand } from './models.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const easeOut = t => 1 - (1 - t) ** 3;
const back = t => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const angOf = dir => -dir * Math.PI / 2;           // a heading as the boat's turn about y (north: none)
const wrapTo = (a, b) => { while (b - a > Math.PI) b -= Math.PI * 2; while (b - a < -Math.PI) b += Math.PI * 2; return b; };

// The light and colour of each stretch of the voyage home: bright noon in the Far Isles, a gold evening at home.
export const LOOKS = [
  { deep: '#1784c9', mid: '#28a8d8', shallow: '#62dde0', foam: '#ffffff', current: '#0f6fa8', wind: '#8fd8f0', sky: '#bfe9ff', sun: '#fff6e0', sunI: 2.1, hemi: 1.25, grass: '#72c850', grass2: '#4fa53a', sand: '#f4dc9c', rim: '#1b5f8f',
    leaf: '#3e9c3c', leaf2: '#63c34d', pine: '#2e7d4a', pine2: '#3a9456', bark: '#7a4f2c', palmBark: '#b07f48', nut: '#6b4a22', stone: '#9aa3ab', stone2: '#7e8891', whale: '#3d6fae',
    flowers: ['#ff7fa8', '#ffe066', '#ffffff'], mix: { palm: 5, puff: 3, bush: 2.5, rock: .4 } },
  { deep: '#157aa6', mid: '#2398b8', shallow: '#5cd4c6', foam: '#f4fffb', current: '#0d5f85', wind: '#86cfe0', sky: '#bfe4f0', sun: '#fff0cc', sunI: 2.0, hemi: 1.2, grass: '#63bb52', grass2: '#46963c', sand: '#efd699', rim: '#185878',
    leaf: '#37923f', leaf2: '#58b64f', pine: '#2c7648', pine2: '#378c52', bark: '#7a4f2c', palmBark: '#a97a45', nut: '#6b4a22', stone: '#98a1a8', stone2: '#7b858d', whale: '#3d6fae',
    flowers: ['#ffe066', '#ffffff'], mix: { palm: 3, puff: 4, bush: 2.5, pine: .6, rock: .4 } },
  { deep: '#2f6a8e', mid: '#3f84a4', shallow: '#78c5c4', foam: '#f2f6f8', current: '#24587a', wind: '#9ec8d8', sky: '#c8d6df', sun: '#f4f2ea', sunI: 1.8, hemi: 1.25, grass: '#6aa859', grass2: '#4c8a44', sand: '#e2d0a0', rim: '#244f6a',
    leaf: '#4b8a47', leaf2: '#67a95a', pine: '#356e48', pine2: '#437f53', bark: '#6f4a2e', palmBark: '#9c7549', nut: '#5e4226', stone: '#9aa0a4', stone2: '#7c8286', whale: '#3d6fae',
    flowers: ['#f2f2f2', '#ffd76a'], mix: { palm: 1.5, puff: 4, pine: 1.5, bush: 2.5, rock: .8 } },
  { deep: '#2b5a86', mid: '#3a6f9c', shallow: '#6fb3c0', foam: '#eef2ff', current: '#213f6e', wind: '#a4b8e8', sky: '#c8c4e8', sun: '#ffd8c0', sunI: 1.9, hemi: 1.15, grass: '#5aa060', grass2: '#3f7f4c', sand: '#e0c89c', rim: '#233a60',
    leaf: '#3c7f52', leaf2: '#5aa068', pine: '#2b5e4a', pine2: '#357058', bark: '#6a4630', palmBark: '#94704c', nut: '#5a3f28', stone: '#9a9aa8', stone2: '#7a7a8a', whale: '#a3aec0',
    flowers: ['#c9a2ff', '#ffffff'], mix: { puff: 3, pine: 4, bush: 2, lolly: .8, rock: .8 } },
  { deep: '#2d78a8', mid: '#4a90b0', shallow: '#8fd0c0', foam: '#fff8ec', current: '#205e88', wind: '#f0d8a8', sky: '#ffd9a8', sun: '#ffd08a', sunI: 2.2, hemi: 1.1, grass: '#7cbc4e', grass2: '#5a9a3c', sand: '#f4d494', rim: '#2a5070',
    leaf: '#5b9a3c', leaf2: '#80bb4b', pine: '#3d7842', pine2: '#4a8a4c', bark: '#7a4f2c', palmBark: '#b07f48', nut: '#6b4a22', stone: '#a6a39c', stone2: '#86837c', whale: '#3d6fae',
    autumn: '#e39a38', autumn2: '#d7702e', flowers: ['#ff7fa8', '#ffe066', '#ffffff', '#ff9a3a'], mix: { puff: 4, lolly: 2, pine: 2, bush: 3, rock: .3 } },
];

const WATER_VS = `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_FS = `
uniform float uTime;
uniform vec2 uSize, uShoreO, uShoreS;
uniform sampler2D uInfo, uShore;
uniform vec3 uDeep, uMid, uShallow, uFoam, uCurrent, uWind, uRim;
uniform vec4 uEyes[4];
uniform int uEyeN;
varying vec3 vW;
vec2 h2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
// cell borders (F2 - F1): the white squiggles Wind Waker's sea is covered in
float cells(vec2 p, float t) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8., d2 = 8.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)), o = h2(i + g);
    o = .5 + .42 * sin(t + 6.2831 * o);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1;
}
vec2 dirOf(float code) { float d = floor(code * 4. + .5) - 1.; return d < .5 ? vec2(0., -1.) : d < 1.5 ? vec2(1., 0.) : d < 2.5 ? vec2(0., 1.) : vec2(-1., 0.); }
void main() {
  vec2 p = vW.xz;
  bool inB = p.x > 0. && p.y > 0. && p.x < uSize.x && p.y < uSize.y;
  vec3 col = uDeep;
  float land = texture2D(uShore, (p - uShoreO) / uShoreS).r;
  if (inB) col = uMid;
  col = mix(col, uShallow, smoothstep(.06, .46, land));
  vec2 t = floor(p), f = fract(p) - .5;
  vec4 info = inB ? texture2D(uInfo, (t + .5) / uSize) : vec4(0.);
  bool cur = info.r > .05 && info.b < .5;
  if (cur) {
    // currents: deeper water, with chevrons down on the bottom running the way it flows. They're seen through the
    // water: pale rather than white, soft-edged, and bent a little by the ripples passing over them.
    vec2 d = dirOf(info.r), n = vec2(-d.y, d.x);
    col = mix(col, uCurrent, .6);
    vec2 wob = vec2(sin(p.y * 3.3 + uTime * 1.9 + sin(p.x * 2.1 - uTime * .9)) + .45 * sin(p.x * 7.3 + p.y * 2.1 + uTime * 3.1),
                    sin(p.x * 2.9 - uTime * 1.6 + sin(p.y * 2.4 + uTime * 1.1)) + .45 * sin(p.y * 6.7 - p.x * 1.7 - uTime * 2.7));
    vec2 pw = p + wob * .035;
    float s = dot(pw, d), q = dot(fract(pw) - .5, n);
    float ch = fract((s + abs(q) * .85) * 2. - uTime * 1.54);   // arms swept back, so each points the way it runs
    float band = smoothstep(.0, .06, ch) * smoothstep(.2, .11, ch) * smoothstep(.34, .22, abs(q));
    col = mix(col, mix(uShallow, uFoam, .35), band * .45);
  }
  // the squiggles on the surface come in drifting patches, not a net over everything; over a current they're fainter,
  // and over its arrows, which are below them
  float c = cells(p * 1.1 + vec2(uTime * .05, uTime * .03), uTime * .35);
  float blot = smoothstep(.1, .7, sin(p.x * .7 + uTime * .23 + sin(p.y * .5)) * sin(p.y * .6 - uTime * .17 + sin(p.x * .4)) + .35);
  col = mix(col, uFoam, smoothstep(.07, .02, c) * blot * (!inB ? .6 : cur ? .25 : .55));
  // wind lanes: pale water, raked with fine lines blowing along
  if (info.g > .05) {
    vec2 d = dirOf(info.g), n = vec2(-d.y, d.x);
    float s = dot(p, d), q = dot(p, n);
    col = mix(col, uWind, .4);
    float line = smoothstep(.93, .99, sin(q * 26. + sin(s * 2. - uTime * 3.) * .8)) * smoothstep(.2, .8, fract(s * .5 - uTime * 1.6));
    col = mix(col, uFoam, line * .55);
  }
  // surf round the islands and rocks, and a dark line where the land meets it
  float surf = smoothstep(.04, .0, abs(land - .3 - .045 * sin(uTime * 1.7 + p.x * 1.4 + p.y * 1.1)));
  col = mix(col, uFoam, surf * .95);
  col = mix(col, uRim, smoothstep(.035, .0, abs(land - .5)) * .9);
  if (inB) {
    vec2 g = abs(f);
    float gl = smoothstep(.465, .5, max(g.x, g.y)) * (1. - step(.42, land));
    col = mix(col, col * .72, gl);
  } else {
    col *= .86;
  }
  // whirlpools
  for (int k = 0; k < 4; k++) {
    if (k >= uEyeN) break;
    vec2 q = p - uEyes[k].xy; float r = length(q), cw = uEyes[k].z;
    if (r < 1.7) {
      float a = atan(q.y, q.x);
      float arms = sin(a * 3. - cw * uTime * 4.5 + log(r + .04) * 6.5 * cw);
      float k1 = smoothstep(.55, .95, arms) * smoothstep(1.65, .7, r);
      col = mix(col, uCurrent * .85, smoothstep(1.7, .9, r) * .5);
      col = mix(col, uFoam, k1 * .85);
      col = mix(col, vec3(.02, .08, .16), smoothstep(.5, .12, r));
      col = mix(col, uFoam, smoothstep(.06, .0, abs(r - .5 - .03 * sin(a * 5. + uTime * 6.))) * .8);
    }
  }
  // the edge of the chart: a dashed rope line
  if (!inB) {
    vec2 e = max(-p, p - uSize);
    float dEdge = max(e.x, e.y);
    float along = p.x + p.y;
    col = mix(col, uFoam, smoothstep(.06, .0, abs(dEdge - .12)) * step(.5, fract(along * 1.5)) * .8);
  }
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;

// The harbour's pier runs out of its square toward whichever side has land (or the chart's edge): the side, or -1.
// Its middle is PIER_AT from the square's centre, and it's PIER_LEN long.
const PIER_AT = .62, PIER_LEN = .95;
function pierSide(lv) {
  const W = lv.W, hm = lv.marks[lv.marks.length - 1], hx = hm % W, hy = Math.floor(hm / W);
  for (const d of [0, 3, 1, 2]) { const nx = hx + DIRS[d][0], ny = hy + DIRS[d][1]; if (nx < 0 || ny < 0 || nx >= W || ny >= lv.H || lv.kind[ny * W + nx] === LAND) return d; }
  return -1;
}

// A small particle: a mesh that flies, grows, fades and goes.
class Bit {
  constructor(obj, o) { Object.assign(this, { obj, v: new THREE.Vector3(), g: 0, life: 1, age: 0, s0: 1, s1: 1, a0: 1, a1: 0, spin: 0, drag: 0 }, o); }
}

export class Sea {
  constructor(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, .1, 500);
    this.outline = new OutlineEffect(r, { defaultThickness: .0042, defaultColor: [.12, .07, .04] });
    this.hemi = new THREE.HemisphereLight('#ffffff', '#6a8aa0', 1.2);
    this.sun = new THREE.DirectionalLight('#fff6e0', 2);
    this.sun.position.set(-4, 10, 6);
    this.scene.add(this.hemi, this.sun);
    this.waterU = {
      uTime: { value: 0 }, uSize: { value: new THREE.Vector2(1, 1) }, uShoreO: { value: new THREE.Vector2() }, uShoreS: { value: new THREE.Vector2(1, 1) },
      uInfo: { value: null }, uShore: { value: null }, uEyes: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) }, uEyeN: { value: 0 },
      uDeep: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() }, uFoam: { value: new THREE.Color() },
      uCurrent: { value: new THREE.Color() }, uWind: { value: new THREE.Color() }, uRim: { value: new THREE.Color() },
    };
    const wm = new THREE.ShaderMaterial({ uniforms: this.waterU, vertexShader: WATER_VS, fragmentShader: WATER_FS });
    wm.userData.outlineParameters = { visible: false };
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), wm);
    this.water.rotation.x = -Math.PI / 2;
    this.scene.add(this.water);
    this.board = null;
    this.tweens = [];
    this.bits = [];
    this.speed = 1;
    this.t = 0;
    this.rect = { x: 0, y: 0, w: 1, h: 1 };
    this.setLook(0);
  }

  /* ---------- looks, size and the camera ---------- */
  setLook(n) {
    const L = this.look = LOOKS[clamp(n, 0, LOOKS.length - 1)], u = this.waterU;
    u.uDeep.value.set(L.deep); u.uMid.value.set(L.mid); u.uShallow.value.set(L.shallow); u.uFoam.value.set(L.foam);
    u.uCurrent.value.set(L.current); u.uWind.value.set(L.wind); u.uRim.value.set(L.rim);
    this.sun.color.set(L.sun); this.sun.intensity = L.sunI; this.hemi.intensity = L.hemi; this.hemi.color.set(L.sky);
    this.renderer.setClearColor(L.deep);
    if (this.landMat) this.landMat.userData.set?.(L);
  }
  // Frames the chart inside rect (CSS pixels of the canvas): the rest of the canvas still shows the sea around it.
  resize(rect) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.rect = rect;
    this.fitCamera();
  }
  // Frames the chart's sea, not its land: the box round every square that isn't land (the water, and the rocks,
  // barrels, posts and whirlpools in it), with a strip of shore, and what stands on its far side. It's centred by where
  // it falls on screen, since in a tilted view the far side comes out smaller than the near.
  fitCamera() {
    const cam = this.camera, { x, y, w, h } = this.rect, cw = this.canvas.clientWidth, ch = this.canvas.clientHeight, lv = this.lv;
    if (!lv || w < 10 || h < 10) return;
    cam.aspect = w / h;
    cam.clearViewOffset();
    let x0 = lv.W, x1 = 0, y0 = lv.H, y1 = 0, sx = 0, sy = 0, n = 0;
    for (let i = 0; i < lv.W * lv.H; i++) {
      if (lv.kind[i] === LAND) continue;
      const tx = i % lv.W, ty = Math.floor(i / lv.W);
      x0 = Math.min(x0, tx); x1 = Math.max(x1, tx + 1); y0 = Math.min(y0, ty); y1 = Math.max(y1, ty + 1);
      sx += tx + .5; sy += ty + .5; n++;
    }
    const heart = new THREE.Vector3(sx / n, 0, sy / n);   // where the water mostly is: an L-shaped sea sits off its box's middle
    const m = .45, pitch = .98;   // shore round the sea; the camera's tilt, down from level
    x0 -= m; x1 += m; y0 -= m; y1 += m;
    const pts = [[x0, 0, y0], [x1, 0, y0], [x0, 0, y1], [x1, 0, y1], [x0, .8, y0], [x1, .8, y0]].map(p => new THREE.Vector3(...p));
    const dir = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch)), target = new THREE.Vector3((x0 + x1) / 2, 0, (y0 + y1) / 2);
    const aim = d => { cam.position.copy(target).addScaledVector(dir, d); cam.lookAt(target); cam.updateMatrixWorld(); cam.updateProjectionMatrix(); };
    const spread = () => {
      const e = { x0: 9, x1: -9, y0: 9, y1: -9 };
      for (const p of pts) { const q = p.clone().project(cam); e.x0 = Math.min(e.x0, q.x); e.x1 = Math.max(e.x1, q.x); e.y0 = Math.min(e.y0, q.y); e.y1 = Math.max(e.y1, q.y); }
      return e;
    };
    // the nearest the camera can be, aimed where it is, with it all in view
    const fit = () => {
      let lo = 1, hi = 300;
      for (let i = 0; i < 28; i++) { const d = (lo + hi) / 2; aim(d); const e = spread(); if (e.x0 > -.93 && e.x1 < .93 && e.y0 > -.93 && e.y1 < .93) hi = d; else lo = d; }
      aim(hi);
      return hi;
    };
    for (let pass = 0; pass < 4; pass++) {
      // slide the aim over so the middle of the frame is halfway between the box's middle and the water's heart
      const d = fit(), e = spread(), c = heart.clone().project(cam), half = Math.tan(cam.fov * Math.PI / 360) * d;
      target.x += ((e.x0 + e.x1) / 2 + c.x) / 2 * half * cam.aspect;
      target.z -= ((e.y0 + e.y1) / 2 + c.y) / 2 * half / Math.sin(pitch);
    }
    fit();
    cam.setViewOffset(w, h, -x, -y, cw, ch);
    cam.updateProjectionMatrix();
  }

  /* ---------- building a level ---------- */
  load(lv, crew, look) {
    this.clear();
    this.lv = lv;
    this.setLook(look);
    const B = this.board = new THREE.Group();
    this.scene.add(B);
    const W = lv.W, H = lv.H;
    // what lies on each square, for the water shader
    const info = new Uint8Array(W * H * 4), ring = new Set();
    for (const e of lv.eyes) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) ring.add((e.y + dy) * W + e.x + dx);
    for (let i = 0; i < W * H; i++) {
      info[i * 4] = lv.flow[i] >= 0 ? 64 * (lv.flow[i] + 1) - (lv.flow[i] === 3 ? 1 : 0) : 0;
      info[i * 4 + 1] = lv.wind[i] >= 0 ? 64 * (lv.wind[i] + 1) - (lv.wind[i] === 3 ? 1 : 0) : 0;
      info[i * 4 + 2] = ring.has(i) ? 255 : 0;
      info[i * 4 + 3] = 255;
    }
    this.waterU.uInfo.value?.dispose(); this.waterU.uShore.value?.dispose();
    const infoTex = new THREE.DataTexture(info, W, H, THREE.RGBAFormat);
    infoTex.minFilter = infoTex.magFilter = THREE.NearestFilter; infoTex.needsUpdate = true;
    this.waterU.uInfo.value = infoTex;
    this.waterU.uSize.value.set(W, H);
    const eyes = lv.eyes.slice(0, 4);
    eyes.forEach((e, k) => this.waterU.uEyes.value[k].set(e.x + .5, e.y + .5, e.cw ? 1 : -1, 0));
    this.waterU.uEyeN.value = eyes.length;
    this.windSqs = null;
    this.buildLand(lv);
    this.built = new Set();   // squares with a house on them, where nothing's planted
    this.buildProps(lv);
    this.plant(lv);
    // the boat and the creatures
    this.boat = makeBoat(crew, { brokenMast: lv.brokenMast });
    B.add(this.boat);
    this.beasts = lv.beasts.map(b => { const m = b.kind === 'shark' ? makeShark() : makeWhale(this.look.whale); B.add(m); return m; });
    // the ring round the mark being sailed for
    const ringMat = noLine(new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: .9, depthWrite: false }));
    this.markRing = new THREE.Mesh(new THREE.RingGeometry(.4, .5, 36), ringMat);
    this.markRing.rotation.x = -Math.PI / 2; this.markRing.position.y = .02;
    B.add(this.markRing);
    this.anchorRing = new THREE.Mesh(new THREE.RingGeometry(.34, .42, 28), noLine(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })));
    this.anchorRing.renderOrder = 2;
    this.anchorRing.rotation.x = -Math.PI / 2; this.anchorRing.position.y = .015;
    B.add(this.anchorRing);
    this.forecastGroup = new THREE.Group(); B.add(this.forecastGroup);
    const ancTex = labelTexture((c, w, h) => {
      c.fillStyle = '#2f6f7e'; c.strokeStyle = '#2a1a10'; c.lineWidth = 8;
      c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 6, 0, 7); c.fill(); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 9; c.lineCap = 'round';
      c.beginPath(); c.arc(w / 2, h * .3, 8, 0, 7); c.moveTo(w / 2, h * .36); c.lineTo(w / 2, h * .78); c.moveTo(w * .34, h * .46); c.lineTo(w * .66, h * .46);
      c.moveTo(w * .24, h * .58); c.quadraticCurveTo(w * .28, h * .8, w / 2, h * .8); c.quadraticCurveTo(w * .72, h * .8, w * .76, h * .58); c.stroke();
    }, 96, 96);
    this.ancSign = new THREE.Sprite(new THREE.SpriteMaterial({ map: ancTex, transparent: true, depthWrite: false, depthTest: false }));
    this.ancSign.userData.outlineParameters = { visible: false };
    this.ancSign.scale.setScalar(.34); this.ancSign.visible = false; this.ancSign.renderOrder = 5;
    B.add(this.ancSign);
    this.fitCamera();
  }
  clear() {
    if (!this.board) return;
    this.dropRope();
    // everything but the lights and the sea: the board, and whatever an animation left lying about (particles, a
    // cannonball, stars)
    for (const o of [...this.scene.children]) if (o !== this.hemi && o !== this.sun && o !== this.water) this.scene.remove(o);
    this.board.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.bits = []; this.tweens = [];
    this.board = null;
  }

  // The islands: the chart's land squares, blurred into round-shouldered blobs and raised; sand at the water,
  // grass above, in hard toon bands. Land at the chart's edge carries on past it, so the chart sits in a coastline,
  // and then out to a shore of its own a few squares off, wandering in and out, with a beach and surf like any other.
  buildLand(lv) {
    const W = lv.W, H = lv.H, M = 5, S = 7, GW = (W + 2 * M) * S, GH = (H + 2 * M) * S;
    const land = new Float32Array(GW * GH), shore = new Float32Array(GW * GH);
    const C = rand(lv.W * 13 + lv.H * 29 + 5), ph = [C(), C(), C(), C()].map(v => v * 6.283);
    // how far past the chart's edge the land runs, here: between about 2 and 3.9 squares (well inside the margin)
    const reach = (x, y) => 2.95 + .42 * Math.sin(x * .9 + ph[0]) * Math.cos(y * .8 + ph[1]) + .32 * Math.sin((x - y) * .41 + ph[2]) + .16 * Math.sin((x + y) * 1.35 + ph[3]);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const x = (gx + .5) / S - M, y = (gy + .5) / S - M;
      const tx = clamp(Math.floor(x), 0, W - 1), ty = clamp(Math.floor(y), 0, H - 1), k = lv.kind[ty * W + tx];
      const i = gy * GW + gx;
      const past = Math.hypot(Math.max(0, -x, x - W), Math.max(0, -y, y - H)), isLand = k === LAND && past < reach(x, y);
      land[i] = isLand ? 1 : 0;
      const inside = x >= 0 && y >= 0 && x < W && y < H;
      shore[i] = isLand ? 1 : (inside && k === ROCK && Math.hypot(x - tx - .5, y - ty - .5) < .34) ? 1 : 0;
    }
    // a box blur, twice over (so nearly a gaussian), with the edges carried on outward
    const blur = (a, r) => {
      const tmp = new Float32Array(a.length), n = 2 * r + 1;
      for (let pass = 0; pass < 2; pass++) {
        for (let y = 0; y < GH; y++) for (let x = 0, row = y * GW; x < GW; x++) {
          let acc = 0;
          for (let k = -r; k <= r; k++) acc += a[row + clamp(x + k, 0, GW - 1)];
          tmp[row + x] = acc / n;
        }
        for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
          let acc = 0;
          for (let k = -r; k <= r; k++) acc += tmp[clamp(y + k, 0, GH - 1) * GW + x];
          a[y * GW + x] = acc / n;
        }
      }
    };
    blur(land, Math.round(S * .42));
    blur(shore, Math.round(S * .42));
    this.landAt = (x, y) => { const gx = clamp(Math.round((x + M) * S - .5), 0, GW - 1), gy = clamp(Math.round((y + M) * S - .5), 0, GH - 1); return land[gy * GW + gx]; };
    const sd = new Uint8Array(GW * GH);
    for (let i = 0; i < sd.length; i++) sd[i] = clamp(shore[i] * 255, 0, 255);
    const shoreTex = new THREE.DataTexture(sd, GW, GH, THREE.RedFormat);
    shoreTex.minFilter = shoreTex.magFilter = THREE.LinearFilter; shoreTex.unpackAlignment = 1; shoreTex.needsUpdate = true;
    this.waterU.uShore.value = shoreTex;
    this.waterU.uShoreO.value.set(-M, -M); this.waterU.uShoreS.value.set(W + 2 * M, H + 2 * M);
    // the land itself: a grid over the whole area, raised where it's land
    const R = rand(lv.W * 31 + lv.H * 17 + lv.map.join('').length);
    const noise = new Float32Array(GW * GH).map(() => R());
    blur(noise, 6); blur(noise, 6);
    { let lo = 1, hi = 0; for (const v of noise) { lo = Math.min(lo, v); hi = Math.max(hi, v); } for (let i = 0; i < noise.length; i++) noise[i] = (noise[i] - lo) / (hi - lo || 1); }
    const pos = new Float32Array(GW * GH * 3), inl = new Float32Array(GW * GH), hts = new Float32Array(GW * GH);
    const hOf = (v, nz) => v < .5 ? (v - .5) * 1.6 : Math.min(.28, (v - .5) * 2.4) + Math.max(0, v - .62) * .5 + Math.max(0, nz - .45) * 2.6 * clamp((v - .78) * 5, 0, 1);
    // where the pier comes ashore, the bank is cut down to a sandy landing just under its deck, so it never sinks in
    const side = pierSide(lv), hm = lv.marks[lv.marks.length - 1], px = hm % W + .5, pz = Math.floor(hm / W) + .5;
    const [pdx, pdz] = side >= 0 ? DIRS[side] : [0, 0], a0 = PIER_AT - PIER_LEN / 2, a1 = PIER_AT + PIER_LEN / 2;
    const offPier = (x, y) => {   // how far x, y is from the ground under the pier, in squares
      if (side < 0) return 9;
      const rx = x - px, rz = y - pz, a = rx * pdx + rz * pdz, c = Math.abs(rx * pdz - rz * pdx);
      return Math.hypot(Math.max(a0 - a, a - a1, 0), Math.max(c - .2, 0));
    };
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const i = gy * GW + gx, v = land[i], x = (gx + .5) / S - M, y = (gy + .5) / S - M, d = offPier(x, y);
      hts[i] = Math.min(hOf(v, noise[i]), .1 + (d / .45) ** 2 * 1.5);
      pos[i * 3] = x; pos[i * 3 + 1] = hts[i]; pos[i * 3 + 2] = y;
      inl[i] = d < .06 ? Math.min(v, .6) : v;
    }
    this.heightAt = (x, y) => hts[clamp(Math.round((y + M) * S - .5), 0, GH - 1) * GW + clamp(Math.round((x + M) * S - .5), 0, GW - 1)];
    const idx = [];
    for (let gy = 0; gy < GH - 1; gy++) for (let gx = 0; gx < GW - 1; gx++) {
      const a = gy * GW + gx, b = a + 1, c = a + GW, d = c + 1;
      if (land[a] < .3 && land[b] < .3 && land[c] < .3 && land[d] < .3) continue;   // open sea: nothing to draw
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('inland', new THREE.BufferAttribute(inl, 1));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const L = this.look;
    const mat = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: toon('#fff').gradientMap });
    mat.userData.outlineParameters = { visible: false };
    const u = { uSand: { value: new THREE.Color(L.sand) }, uGrass: { value: new THREE.Color(L.grass) }, uGrass2: { value: new THREE.Color(L.grass2) }, uRim: { value: new THREE.Color('#2a1a10') } };
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float inland;\nvarying float vH, vIn;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = position.y; vIn = inland;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH, vIn;\nuniform vec3 uSand, uGrass, uGrass2, uRim;')
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4(vIn < .525 ? uRim : vIn < .63 ? uSand : vH < .62 ? uGrass : uGrass2, opacity);');
    };
    mat.userData.set = Lk => { u.uSand.value.set(Lk.sand); u.uGrass.value.set(Lk.grass); u.uGrass2.value.set(Lk.grass2); };
    this.landMat = mat;
    const m = new THREE.Mesh(geo, mat);
    this.board.add(m);
  }

  // What grows on the land in and just around the chart: a mix of trees, bushes and boulders that changes as the
  // voyage goes on (palms in the Far Isles, pines by the Drowned Docks, a few turning gold at home), clear of the
  // squares that have a house on them.
  plant(lv) {
    const L = this.look, F = new Flora(L), R = rand(lv.W * 7 + lv.H * 131 + lv.map.join('').length * 3);
    const kinds = Object.entries(L.mix), total = kinds.reduce((a, [, w]) => a + w, 0);
    const pick = () => { let r = R() * total; for (const [k, w] of kinds) if ((r -= w) <= 0) return k; return kinds[0][0]; };
    for (let y = -2; y < lv.H + 2; y++) for (let x = -2; x < lv.W + 2; x++) {
      if (this.landAt(x + .5, y + .5) < .8 || this.built.has(x + ',' + y) || R() > .55) continue;
      const kind = pick(), px = x + .25 + R() * .5, pz = y + .25 + R() * .5;
      F.plant(kind, px, this.heightAt(px, pz), pz, R);
      if (kind !== 'bush' && kind !== 'rock' && R() < .3) {
        const bx = x + .1 + R() * .8, bz = y + .1 + R() * .8;
        if (this.landAt(bx, bz) > .78) F.plant('bush', bx, this.heightAt(bx, bz), bz, R);
      }
    }
    const m = F.mesh();
    if (m) this.board.add(m);
  }

  buildProps(lv) {
    const B = this.board, W = lv.W;
    this.barrelMeshes = [];
    this.gulls = [];
    for (let i = 0; i < W * lv.H; i++) {
      const x = i % W, y = Math.floor(i / W), k = lv.kind[i];
      if (k === ROCK) { const r = makeRock(i * 7 + 1); r.position.set(x + .5, 0, y + .5); B.add(r); }
      if (k === BARREL) { const b = makeBarrels(i * 3 + 2); b.position.set(x + .5, 0, y + .5); B.add(b); this.barrelMeshes[lv.barrelBit[i]] = b; b.userData.phase = i; }
      if (k === POST) { const p = makePost(i * 5 + 4); p.position.set(x + .5, 0, y + .5); B.add(p); if (p.userData.gull) this.gulls.push(p.userData.gull); }
    }
    // the buoys, and the harbour's pier
    // buoys sit at the side of their square, so the boat can come alongside rather than on top of them
    this.buoys = lv.marks.slice(0, -1).map((m, k) => { const b = makeBuoy(k + 1); b.position.set(m % W + .8, 0, Math.floor(m / W) + .3); B.add(b); return b; });
    const hm = lv.marks[lv.marks.length - 1], hx = hm % W, hy = Math.floor(hm / W);
    // the pier runs out from whichever side has land, and nothing grows where it comes ashore
    const side = pierSide(lv);
    const pier = makePier(PIER_LEN);
    pier.position.set(hx + .5 + (side >= 0 ? DIRS[side][0] * PIER_AT : 0), 0, hy + .5 + (side >= 0 ? DIRS[side][1] * PIER_AT : 0));
    pier.rotation.y = side >= 0 ? angOf(side) : 0;
    B.add(pier);
    this.pier = pier;
    if (side >= 0) this.built.add((hx + DIRS[side][0]) + ',' + (hy + DIRS[side][1]));
    if (side >= 0) {
      const hut = makeHut(hx * 7 + hy, lv.home ? '#2d78c8' : '#d9463c');
      const bx = hx + DIRS[side][0] * 1.5 + .5 + (side % 2 ? 0 : .35), by = hy + DIRS[side][1] * 1.5 + .5 + (side % 2 ? .35 : 0);
      if (this.landAt(bx, by) > .7) { hut.position.set(bx, this.heightAt(bx, by), by); B.add(hut); this.built.add(Math.floor(bx) + ',' + Math.floor(by)); }
    }
    if (lv.home) {
      // home: the lighthouse, and the village's houses along the shore
      const R = rand(99);
      let placed = 0;
      for (let y = 0; y < lv.H && placed < 7; y++) for (let x = 0; x < W && placed < 7; x++) {
        if (lv.kind[y * W + x] !== LAND || this.landAt(x + .5, y + .5) < .8 || R() > .35) continue;
        const h = placed === 0 ? makeLighthouse() : makeHut(x * 3 + y, ['#2d78c8', '#e0524a', '#f5c542', '#3fae5a'][placed % 4]);
        h.position.set(x + .5, this.heightAt(x + .5, y + .5), y + .5); B.add(h);
        this.built.add(x + ',' + y);
        if (placed === 0) this.lighthouse = h;
        placed++;
      }
    }
    // wind lanes: little white wisps that blow along them
    this.wisps = [];
    const windSquares = [];
    for (let i = 0; i < W * lv.H; i++) if (lv.wind[i] >= 0) windSquares.push(i);
    if (windSquares.length) {
      const tex = labelTexture((g, w, h) => {
        g.strokeStyle = '#fff'; g.lineWidth = 7; g.lineCap = 'round';
        g.beginPath(); g.moveTo(8, h * .62); g.bezierCurveTo(w * .35, h * .62, w * .55, h * .62, w * .72, h * .5);
        g.bezierCurveTo(w * .86, h * .38, w * .8, h * .16, w * .68, h * .2); g.bezierCurveTo(w * .58, h * .24, w * .6, h * .42, w * .7, h * .42); g.stroke();
      }, 256, 64);
      const mat = noLine(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
      const n = Math.min(60, Math.ceil(windSquares.length * .8));
      const R = rand(windSquares.length);
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, .25), mat.clone());
        m.rotation.x = -Math.PI / 2;
        const sq = windSquares[k % windSquares.length];
        m.userData = { sq, t: R() * 3, life: 1.6 + R() * 1.2, off: (R() - .5) * .6, R };
        m.position.y = .32 + R() * .2;
        B.add(m); this.wisps.push(m);
      }
    }
  }

  /* ---------- showing a state ---------- */
  show(s, leg, done = []) {
    const lv = this.lv, b = this.boat;
    b.position.set(s.x + .5, 0, s.y + .5);
    b.rotation.set(0, angOf(s.dir), 0);
    b.userData.heading = angOf(s.dir);
    this.setSail(s.sail ? 1 : 0);
    this.setAnchor(!!s.anc, true);
    Object.assign(b.userData, { lean: 0, pitch: 0, moving: false, fill: .16 });
    b.userData.body.rotation.set(0, 0, 0);
    b.scale.setScalar(1); b.position.y = 0;
    b.visible = true;
    this.dropRope();
    lv.beasts.forEach((bt, j) => {
      const m = this.beasts[j], sq = beastSquare(lv, s, j), nx = lv.beasts[j].path.length > 1 ? this.beastNextSq(s, j) : sq;
      m.position.set(sq % lv.W + .5, 0, Math.floor(sq / lv.W) + .5);
      m.rotation.y = this.faceTo(sq, nx, m.rotation.y);
      m.visible = true;
      m.userData.body.rotation.set(0, 0, 0);
    });
    this.barrelMeshes.forEach((m, k) => { if (m) { m.visible = !(s.broken >> k & 1); m.scale.setScalar(1); } });
    this.setLeg(leg, done);
  }
  beastNextSq(s, j) {
    const bt = this.lv.beasts[j], n = bt.path.length, b = s.beasts[j];
    if (bt.loop) return bt.path[(b.i + b.d + n) % n];
    let d = b.d; if (b.i + d < 0 || b.i + d >= n) d = -d;
    return bt.path[b.i + d];
  }
  faceTo(a, b, cur) {
    if (a === b) return cur;
    const W = this.lv.W, dx = b % W - a % W, dy = Math.floor(b / W) - Math.floor(a / W);
    return Math.atan2(-dx, -dy);
  }
  setLeg(leg, done = []) {
    const lv = this.lv, W = lv.W, m = lv.marks[leg];
    this.leg = leg;
    if (m == null) { this.markRing.visible = false; return; }
    this.markRing.visible = true;
    this.markRing.position.set(m % W + .5, .02, Math.floor(m / W) + .5);
    this.buoys.forEach((b, k) => {
      const passed = k < leg;
      b.userData.flagMat.color.set(passed ? '#7fe08a' : '#ffffff');
      b.userData.body.scale.setScalar(k === leg ? 1.12 : 1);
    });
  }
  setSail(v) {
    const d = this.boat.userData;
    d.sailAmt = v;
    d.sailRig.scale.set(1, Math.max(.04, v), 1);
    d.sailRig.visible = v > .05;
    d.furl.visible = v < .5;
    d.furl.scale.set(1, 1, 1);
  }
  setAnchor(down, instant) {
    const d = this.boat.userData;
    d.anchorDown = down;
    if (instant) d.anchor.position.y = down ? -.35 : .26;
    this.anchorRing.material.opacity = down ? .8 : 0;
    this.ancSign.visible = down;
  }

  // Where each creature will be after each step of the scroll: small numbered markers in its colour.
  forecast(list) {
    const g = this.forecastGroup;
    while (g.children.length) { const c = g.children.pop(); c.material.map?.dispose(); c.material.dispose(); }
    if (!list) return;
    const W = this.lv.W, counts = new Map();
    for (const { sq, n, j } of list) {
      const key = sq, k = counts.get(key) || 0; counts.set(key, k + 1);
      const col = this.lv.beasts[j].kind === 'shark' ? '#7d8a99' : this.look.whale, pale = new THREE.Color(col).getHSL({}, THREE.SRGBColorSpace).l > .55;
      const tex = labelTexture((c, w, h) => {
        c.fillStyle = col; c.strokeStyle = '#2a1a10'; c.lineWidth = 7;
        c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 6, 0, 7); c.fill(); c.stroke();
        c.fillStyle = pale ? '#2a1a10' : '#fff'; c.font = '700 60px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), w / 2, h / 2 + 4);
      }, 96, 96);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: .92 }));
      s.userData.outlineParameters = { visible: false };
      s.scale.setScalar(.3);
      s.position.set(sq % W + .5 + (k % 3 - 1) * .24, .08 + Math.floor(k / 3) * .3, Math.floor(sq / W) + .5 + (k ? .18 : 0));
      g.add(s);
    }
  }

  /* ---------- tweens and particles ---------- */
  tween(dur, fn, ez = ease) {
    return new Promise(res => this.tweens.push({ t: 0, dur: Math.max(.001, dur / this.speed), fn, ez, res }));
  }
  wait(dur) { return this.tween(dur, () => {}); }
  bit(obj, o) { this.scene.add(obj); const b = new Bit(obj, o); b.base = obj.scale.x; this.bits.push(b); return b; }
  puff(x, y, z, o = {}) {
    const n = o.n ?? 8;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(this.puffGeo ||= new THREE.IcosahedronGeometry(.1, 1), noLine(new THREE.MeshBasicMaterial({ color: o.color || '#ffffff', transparent: true, depthWrite: false })));
      const a = Math.random() * Math.PI * 2, sp = (o.speed ?? 1) * (.4 + Math.random() * .6);
      s.position.set(x + Math.cos(a) * .08, y, z + Math.sin(a) * .08);
      this.bit(s, { v: new THREE.Vector3(Math.cos(a) * sp + (o.vx || 0), (o.up ?? .6) * (.5 + Math.random()), Math.sin(a) * sp + (o.vz || 0)), g: o.g ?? 0, life: (o.life ?? .7) * (.7 + Math.random() * .5), s0: o.s0 ?? .6, s1: o.s1 ?? 1.8, a0: o.a ?? .9, a1: 0, drag: o.drag ?? 2 });
    }
  }
  splash(x, z, big = 1) {
    this.puff(x, .05, z, { n: 10 * big, color: '#ffffff', speed: 1.1 * big, up: 2.4 * big, g: 7, life: .6, s0: .7, s1: .4, drag: .6 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(.2, .28, 28), noLine(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false })));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, .03, z);
    this.bit(ring, { life: .7, s0: 1, s1: 3 * big, a0: .9, a1: 0 });
  }
  makeStar() { const sh = new THREE.Shape(); for (let k = 0; k < 10; k++) { const r = k % 2 ? .04 : .1, a = k / 10 * Math.PI * 2; k ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ShapeGeometry(sh); }
  sparkle(x, y, z, color = '#fff27a', n = 14) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(this.starGeo ||= this.makeStar(),
        noLine(new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide })));
      const a = Math.random() * Math.PI * 2, sp = .8 + Math.random() * 1.2;
      s.position.set(x, y, z); s.lookAt(this.camera.position);
      this.bit(s, { v: new THREE.Vector3(Math.cos(a) * sp, 1.4 + Math.random() * 1.6, Math.sin(a) * sp), g: 3.5, life: .9 + Math.random() * .5, s0: 1, s1: .3, a0: 1, a1: 0, drag: 1.2, spin: 6 });
    }
  }
  confetti(x, z, n = 70) {
    const cols = ['#e0524a', '#f5c542', '#3fae5a', '#3f97d6', '#8a5cc2', '#ffffff', '#f07f2a'];
    for (let i = 0; i < n; i++) {
      const p = new THREE.Mesh(this.confGeo ||= new THREE.PlaneGeometry(.08, .05), noLine(new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, transparent: true })));
      const a = Math.random() * Math.PI * 2, sp = .6 + Math.random() * 1.6;
      p.position.set(x, .6, z); p.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      this.bit(p, { v: new THREE.Vector3(Math.cos(a) * sp, 3 + Math.random() * 3, Math.sin(a) * sp), g: 4.2, life: 2.2 + Math.random(), s0: 1, s1: 1, a0: 1, a1: .6, drag: 1.4, spin: 9 });
    }
  }
  splinters(x, z, color = '#a86f3a', n = 12) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(this.plankGeo ||= new THREE.BoxGeometry(.05, .03, .18), toon(color));
      const a = Math.random() * Math.PI * 2, sp = .8 + Math.random() * 1.4;
      s.position.set(x, .2, z); s.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      this.bit(s, { v: new THREE.Vector3(Math.cos(a) * sp, 1.8 + Math.random() * 1.6, Math.sin(a) * sp), g: 6, life: .9 + Math.random() * .4, s0: 1, s1: .6, a0: 1, a1: 1, drag: .4, spin: 8, sink: true });
    }
  }
  wake(x, z) {
    const s = new THREE.Mesh(this.wakeGeo ||= new THREE.CircleGeometry(.09, 10), noLine(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false })));
    s.rotation.x = -Math.PI / 2; s.position.set(x + (Math.random() - .5) * .1, .02, z + (Math.random() - .5) * .1);
    this.bit(s, { life: .9, s0: .8, s1: 2.2, a0: .75, a1: 0 });
  }

  /* ---------- every frame ---------- */
  frame(dt) {
    this.t += dt;
    this.waterU.uTime.value = this.t;
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = clamp(tw.t / tw.dur, 0, 1);
      tw.fn(tw.ez(k), k);
      if (k >= 1) { this.tweens.splice(i, 1); tw.res(); }
    }
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i], o = b.obj;
      b.age += dt;
      const k = b.age / b.life;
      if (k >= 1) { this.scene.remove(o); o.material.dispose(); this.bits.splice(i, 1); continue; }
      b.v.y -= b.g * dt; b.v.multiplyScalar(Math.max(0, 1 - b.drag * dt));
      o.position.addScaledVector(b.v, dt);
      if (b.sink && o.position.y < 0) { o.position.y = 0; b.v.set(0, 0, 0); }
      o.scale.setScalar(b.base * lerp(b.s0, b.s1, k));
      o.material.opacity = lerp(b.a0, b.a1, k);
      if (b.spin) { o.rotation.x += b.spin * dt; o.rotation.y += b.spin * .7 * dt; }
    }
    if (this.board) this.idle(dt);
    this.outline.render(this.scene, this.camera);
  }
  idle(dt) {
    const t = this.t, b = this.boat, d = b.userData;
    // the boat rocks a little and her sail fills
    d.body.position.y = Math.sin(t * 2.1) * .018;
    d.body.rotation.z = Math.sin(t * 1.6) * .035 + (d.lean || 0);
    d.body.rotation.x = Math.sin(t * 1.9 + 1) * .025 + (d.pitch || 0);
    const pa = d.sail.geometry.attributes.position, base = d.sail.userData.base, fill = (d.fill ?? .16) + Math.sin(t * 3) * .015;
    for (let i = 0; i < pa.count; i++) {
      const v = base[i * 3 + 1] / .86, u = base[i * 3 + 2] / Math.max(.001, (1 - v * .92) * .56);
      pa.setX(i, -Math.sin(Math.PI * clamp(u, 0, 1)) * fill * (1 - v * .6));
    }
    pa.needsUpdate = true;
    d.flag.rotation.y = Math.sin(t * 5) * .3;
    if (d.moving) { d.wakeT = (d.wakeT || 0) + dt; if (d.wakeT > .045) { d.wakeT = 0; const back = new THREE.Vector3(0, 0, .38).applyAxisAngle(new THREE.Vector3(0, 1, 0), b.rotation.y); this.wake(b.position.x + back.x, b.position.z + back.z); } }
    this.anchorRing.position.set(b.position.x, .015, b.position.z);
    if (d.anchorDown) { this.anchorRing.scale.setScalar(1.3 + Math.sin(t * 2) * .08); this.ancSign.position.set(b.position.x, 1.45 + Math.sin(t * 3) * .04, b.position.z); }
    // crew fidget
    for (const [who, f] of Object.entries(d.crew)) { if (f.userData.busy) continue; f.userData.head.rotation.y = Math.sin(t * .8 + who.length) * .3; }
    // creatures swim in place
    this.beasts?.forEach((m, j) => {
      const u = m.userData;
      u.body.position.y = (u.kind === 'whale' ? .02 : 0) + Math.sin(t * 1.7 + j) * .03 + (u.dive || 0);
      u.tail.rotation.y = Math.sin(t * (u.kind === 'shark' ? 6 : 2.5) + j) * .35;
      if (u.kind === 'whale') { u.tail.rotation.x = Math.sin(t * 2.5 + j) * .15; u.spoutT = (u.spoutT ?? Math.random() * 4) - dt; if (u.spoutT < 0 && m.visible) { u.spoutT = 3 + Math.random() * 3; this.spout(m); } }
    });
    // the active mark's ring breathes
    if (this.markRing.visible) { const k = (t * .8) % 1; this.markRing.scale.setScalar(.8 + k * .7); this.markRing.material.opacity = .9 * (1 - k); }
    this.buoys?.forEach((bu, k) => { bu.userData.body.position.y = Math.sin(t * 2.3 + k) * .03; bu.userData.body.rotation.z = Math.sin(t * 1.8 + k * 2) * .06; });
    this.barrelMeshes?.forEach(m => { if (m) { m.position.y = Math.sin(t * 2 + m.userData.phase) * .025; m.rotation.z = Math.sin(t * 1.5 + m.userData.phase) * .05; } });
    this.gulls?.forEach((gl, k) => { gl.rotation.y += Math.sin(t * .7 + k) * dt * .6; });
    if (this.pier) this.pier.userData.flag.rotation.y = Math.sin(t * 4) * .25;
    if (this.lighthouse) this.lighthouse.userData.lamp.material.emissiveIntensity = 1 + Math.sin(t * 3) * .4;
    // wisps blow along the wind lanes
    for (const w of this.wisps || []) {
      const u = w.userData; u.t += dt;
      if (u.t > u.life) {
        u.t = 0;
        const sqs = this.windSqs ||= [...this.lv.wind.keys()].filter(i => this.lv.wind[i] >= 0);
        u.sq = sqs[Math.floor(u.R() * sqs.length)]; u.off = (u.R() - .5) * .6;
      }
      const d0 = this.lv.wind[u.sq], [dx, dy] = DIRS[d0], k = u.t / u.life;
      const x = u.sq % this.lv.W + .5, y = Math.floor(u.sq / this.lv.W) + .5;
      w.position.x = x + dx * (k * 1.6 - .8) + (dy ? u.off : 0);
      w.position.z = y + dy * (k * 1.6 - .8) + (dx ? u.off : 0);
      w.rotation.z = Math.atan2(-dy, dx);
      w.material.opacity = Math.sin(Math.PI * k) * .85;
    }
  }
  spout(m) {
    const p = m.userData.spoutAt.clone().applyMatrix4(m.matrixWorld);
    this.puff(p.x, p.y, p.z, { n: 7, color: '#ffffff', speed: .25, up: 2.2, g: 3, life: .8, s0: .5, s1: 1.2, drag: .4 });
  }

  /* ---------- a step, played out ---------- */
  // Plays every event of one step in order; resolves when it's done.
  async play(step) {
    const d = this.boat.userData, b = this.boat;
    for (const e of step.ev) {
      if (e.t === 'hoist') await this.hoist(e.was);
      else if (e.t === 'strike') await this.strike(e.was);
      else if (e.t === 'steady') await this.steady();
      else if (e.t === 'turn') await this.turn(e.by, e.dir);
      else if (e.t === 'drop') await this.drop();
      else if (e.t === 'weigh') await this.weigh();
      else if (e.t === 'fire') await this.fire(e);
      else if (e.t === 'grapple') await this.grapple(e);
      else if (e.t === 'move') { const ok = await this.move(e); if (!ok) return; }
    }
    const beasts = step.ev.filter(e => e.t === 'beast');
    if (beasts.length) await Promise.all(beasts.map(e => this.swim(e)));
  }
  crewDo(who, dur, fn) {
    const f = this.boat.userData.crew[who];
    if (!f || !f.visible) return this.wait(dur);
    f.userData.busy = true;
    return this.tween(dur, (k, raw) => fn(f.userData, k, raw)).then(() => { f.userData.busy = false; f.userData.arms.forEach((a, i) => { a.rotation.x = 0; a.rotation.z = (i ? 1 : -1) * .35; }); });
  }
  async hoist(was) {
    const d = this.boat.userData;
    this.crewDo('bosun', .42, (u, k) => { u.arms.forEach(a => { a.rotation.x = -2.6 + Math.sin(k * Math.PI * 4) * .5; }); });
    if (was) return this.wait(.3);
    d.sailRig.visible = true;
    await this.tween(.42, k => { d.sailRig.scale.y = Math.max(.04, back(k)); d.furl.visible = k < .4; d.fill = .16 + (1 - k) * .1; });
    d.fill = .16;
  }
  async strike(was) {
    const d = this.boat.userData;
    this.crewDo('bosun', .4, (u, k) => { u.arms.forEach(a => { a.rotation.x = -1.4 - Math.sin(k * Math.PI * 3) * .6; }); });
    if (!was) return this.wait(.3);
    await this.tween(.4, k => { d.sailRig.scale.y = Math.max(.04, 1 - k); });
    d.sailRig.visible = false; d.furl.visible = true;
    await this.tween(.12, k => { d.furl.scale.set(1, 1 + Math.sin(k * Math.PI) * .3, 1); });
  }
  steady() {
    return this.crewDo('captain', .32, (u, k) => { u.head.rotation.x = Math.sin(k * Math.PI) * .4; u.arms[0].rotation.x = u.arms[1].rotation.x = -1.2; });
  }
  async turn(by, dir) {
    const b = this.boat, d = b.userData, from = b.rotation.y, to = wrapTo(from, angOf(dir));
    this.crewDo('captain', .45, (u, k) => { u.body.rotation.z = -by * Math.sin(k * Math.PI) * .5; u.arms.forEach(a => { a.rotation.x = -1.3; }); });
    await this.tween(.38, k => { b.rotation.y = lerp(from, to, k); d.lean = -by * Math.sin(k * Math.PI) * .22; });
    d.lean = 0;
  }
  async drop() {
    const d = this.boat.userData, a = d.anchor;
    this.crewDo('anchor', .5, (u, k) => { u.arms.forEach(ar => { ar.rotation.x = -1.6 + Math.sin(k * Math.PI * 5) * .4; }); });
    a.visible = true;
    await this.tween(.4, k => { a.position.y = .26 - k * .62; }, t => t * t);
    const p = new THREE.Vector3(.2, 0, -.24).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.boat.rotation.y).add(this.boat.position);
    this.splash(p.x, p.z, .7);
    this.setAnchor(true);
  }
  async weigh() {
    const d = this.boat.userData, a = d.anchor;
    this.crewDo('anchor', .5, (u, k) => { u.arms.forEach(ar => { ar.rotation.x = -2 + Math.sin(k * Math.PI * 6) * .6; }); });
    const p = new THREE.Vector3(.2, 0, -.24).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.boat.rotation.y).add(this.boat.position);
    this.puff(p.x, .05, p.z, { n: 5, speed: .3, up: 1.4, g: 4, life: .5, s0: .4, s1: .2 });
    await this.tween(.4, k => { a.position.y = -.36 + k * .62; });
    this.setAnchor(false);
  }
  async fire(e) {
    const b = this.boat, d = b.userData, [dx, dy] = DIRS[e.dir];
    this.crewDo('gunner', .5, (u, k) => { u.body.rotation.x = Math.sin(k * Math.PI) * .4; });
    await this.wait(.12);
    const muzzle = new THREE.Vector3(0, .32, -.48).applyAxisAngle(new THREE.Vector3(0, 1, 0), b.rotation.y).add(b.position);
    this.puff(muzzle.x, muzzle.y, muzzle.z, { n: 9, color: '#f4efe6', speed: .5, vx: dx * 1.2, vz: dy * 1.2, up: .5, life: .9, s0: .9, s1: 2.6 });
    this.puff(muzzle.x, muzzle.y, muzzle.z, { n: 5, color: '#ffd04a', speed: .8, vx: dx * 2, vz: dy * 2, up: .2, life: .18, s0: 1.2, s1: .3 });
    this.sfx?.('boom');
    // the cannonball flies to what it hits
    const ball = new THREE.Mesh(this.ballGeo ||= new THREE.SphereGeometry(.07, 10, 8), toon('#2a2d33'));
    this.scene.add(ball);
    const [tx, ty] = e.to, dest = new THREE.Vector3(tx + .5, e.hit === 'nothing' || e.hit === 'edge' ? 0 : .3, ty + .5);
    const dist = Math.hypot(dest.x - muzzle.x, dest.z - muzzle.z);
    // the kick, while the ball's in the air
    const kick = this.tween(.22, k => { d.pitch = -Math.sin(k * Math.PI) * .18; });
    await this.tween(.14 + dist * .07, k => { ball.position.lerpVectors(muzzle, dest, k); ball.position.y += Math.sin(k * Math.PI) * dist * .12; }, t => t);
    this.scene.remove(ball);
    await kick; d.pitch = 0;
    if (e.hit === 'barrel') {
      const bi = this.lv.barrelBit[ty * this.lv.W + tx], m = this.barrelMeshes[bi];
      this.splinters(tx + .5, ty + .5); this.puff(tx + .5, .25, ty + .5, { n: 10, color: '#f4efe6', speed: .9, up: 1, life: .8, s0: .8, s1: 2.4 });
      this.sfx?.('crash');
      if (m) await this.tween(.18, k => { m.scale.setScalar(1 + k * .4); }).then(() => { m.visible = false; });
    } else if (e.hit === 'beast') {
      const m = this.beasts[e.beast];
      this.puff(tx + .5, .3, ty + .5, { n: 6, color: '#ffffff', speed: .6, up: 1.2, life: .5 });
      this.startle(m);
    } else if (e.hit === 'nothing' || e.hit === 'edge') this.splash(dest.x, dest.z, .8);
    else this.puff(dest.x, .3, dest.z, { n: 7, color: '#d8d0c4', speed: .6, up: .8, life: .6 });
  }
  startle(m) {
    const bang = labelTexture((c, w, h) => { c.fillStyle = '#fff'; c.strokeStyle = '#2a1a10'; c.lineWidth = 8; c.font = '900 110px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.strokeText('!', w / 2, h / 2); c.fillText('!', w / 2, h / 2); }, 96, 128);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bang, transparent: true, depthWrite: false }));
    s.userData.outlineParameters = { visible: false };
    s.position.set(m.position.x, .9, m.position.z); s.scale.set(.3, .4, 1);
    this.bit(s, { v: new THREE.Vector3(0, .5, 0), life: .9, s0: .6, s1: 1.2, a0: 1, a1: 0 });
    return this.tween(.3, k => { m.userData.body.position.y = Math.sin(k * Math.PI) * .25; });
  }
  async grapple(e) {
    const b = this.boat, [dx, dy] = DIRS[e.dir];
    this.dropRope();   // a new throw takes in the last one's hook and rope, if they're still out
    this.crewDo('hook', .45, (u, k) => { u.arms[1].rotation.x = -2.8 + k * 2; });
    const from = new THREE.Vector3(0, .35, -.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), b.rotation.y).add(b.position);
    const [tx, ty] = e.to, to = new THREE.Vector3(tx + .5 - dx * (e.caught ? .12 : 0), e.caught ? .6 : 0, ty + .5 - dy * (e.caught ? .12 : 0));
    const hook = new THREE.Mesh(this.hookGeo ||= new THREE.TorusGeometry(.06, .016, 5, 10, Math.PI * 1.4), toon('#4b5560'));
    this.scene.add(hook);
    const rope = this.rope = this.makeRope();
    const dist = from.distanceTo(to);
    this.sfx?.('whoosh');
    await this.tween(.2 + dist * .05, k => { hook.position.lerpVectors(from, to, k); hook.position.y += Math.sin(k * Math.PI) * .5; hook.rotation.z += .5; rope.set(from, hook.position, (1 - k) * .1); }, t => t);
    if (!e.caught) {
      this.splash(to.x, to.z, .6);
      await this.tween(.3, k => { hook.position.lerpVectors(to, from, k); rope.set(from, hook.position, .05); });
      this.scene.remove(hook); rope.remove(); this.rope = null;
      return;
    }
    this.sfx?.('clunk');
    this.hookMesh = hook;
    this.ropeTo = to;
    rope.set(from, to, 0);
    await this.wait(.1);
  }
  makeRope() {
    const g = new THREE.BufferGeometry(), n = 12, pos = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#5a3a1e' }));
    this.scene.add(line);
    return {
      line,
      set: (a, b, sag) => { for (let i = 0; i < n; i++) { const k = i / (n - 1); pos[i * 3] = lerp(a.x, b.x, k); pos[i * 3 + 1] = lerp(a.y, b.y, k) - Math.sin(k * Math.PI) * sag; pos[i * 3 + 2] = lerp(a.z, b.z, k); } g.attributes.position.needsUpdate = true; g.computeBoundingSphere(); },
      remove: () => { this.scene.remove(line); g.dispose(); },
    };
  }
  // One move of the boat, by her sail, a current, the wind, the cannon's kick or the hook. Resolves false if she was
  // wrecked on it (after the crash).
  async move(e) {
    const b = this.boat, d = b.userData, [fx, fy] = e.from, [tx, ty] = e.to;
    const dur = { sail: .36, current: .32, wind: .3, recoil: .2, haul: .12 }[e.cause] || .32;
    d.moving = true;
    if (e.cause === 'wind') d.fill = .34;
    if (e.cause === 'current') d.lean = 0;
    if (e.wreck) {
      // run into it: halfway, then the crash
      await this.tween(dur * .55, k => { b.position.x = lerp(fx, tx, k * .5) + .5; b.position.z = lerp(fy, ty, k * .5) + .5; }, t => t * t);
      d.moving = false; d.fill = .16;
      return false;
    }
    const ez = e.cause === 'recoil' ? easeOut : e.cause === 'haul' ? (t => t) : ease;
    await this.tween(dur, k => {
      b.position.x = lerp(fx, tx, k) + .5; b.position.z = lerp(fy, ty, k) + .5;
      if (e.cause === 'current') d.lean = Math.sin(k * Math.PI) * .08;
      if (e.cause === 'haul' && this.rope) { const from = new THREE.Vector3(0, .35, -.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), b.rotation.y).add(b.position); this.rope.set(from, this.ropeTo, 0); }
    }, ez);
    d.moving = false; d.fill = .16; d.lean = 0;
    if (e.cause === 'haul' && this.rope && Math.abs(b.position.x - this.ropeTo.x) + Math.abs(b.position.z - this.ropeTo.z) < .75) this.dropRope();
    return true;
  }
  dropRope() { if (this.rope) { this.rope.remove(); this.rope = null; } if (this.hookMesh) { this.scene.remove(this.hookMesh); this.hookMesh = null; } }
  async swim(e) {
    const m = this.beasts[e.j], [fx, fy] = e.from, [tx, ty] = e.to;
    const from = m.rotation.y, to = (fx === tx && fy === ty) ? from : wrapTo(from, Math.atan2(-(tx - fx), -(ty - fy)));
    await this.tween(.36, k => {
      m.position.x = lerp(fx, tx, k) + .5; m.position.z = lerp(fy, ty, k) + .5;
      m.rotation.y = lerp(from, to, Math.min(1, k * 2.5));
    });
  }

  /* ---------- endings ---------- */
  async wreck(w) {
    const b = this.boat, d = b.userData;
    this.dropRope();
    this.sfx?.(w.why === 'whirlpool' ? 'drain' : 'crash');
    if (w.why === 'whirlpool') {
      const cx = w.x + .5, cz = w.y + .5, x0 = b.position.x, z0 = b.position.z;
      await this.tween(1.3, k => {
        const r = (1 - k) * Math.hypot(x0 - cx, z0 - cz) + .05, a = Math.atan2(z0 - cz, x0 - cx) + k * 9;
        b.position.set(cx + Math.cos(a) * r, -k * .7, cz + Math.sin(a) * r); b.rotation.y += .15; b.scale.setScalar(1 - k * .6);
      }, t => t);
      b.visible = false; b.scale.setScalar(1);
      this.splash(cx, cz, 1.2);
      return;
    }
    const x = b.position.x, z = b.position.z;
    this.splinters(x, z, '#d9463c', 8); this.splinters(x, z, '#a86f3a', 6);
    this.puff(x, .3, z, { n: 8, color: '#ffffff', speed: 1, up: 1, life: .6 });
    if (w.why === 'beast' || w.why === 'rammed') { const m = this.beasts[w.beast]; if (m) this.tween(.3, k => { m.userData.body.position.y = Math.sin(k * Math.PI) * .2; }); }
    // dizzy stars round the mast, and she lists
    const stars = [];
    for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(this.starGeo ||= this.makeStar(), noLine(new THREE.MeshBasicMaterial({ color: '#fff27a', side: THREE.DoubleSide }))); s.scale.setScalar(1.4); this.scene.add(s); stars.push(s); }
    await this.tween(1.2, (k, raw) => {
      d.lean = Math.sin(raw * Math.PI * 5) * .25 * (1 - raw) + raw * .35;
      stars.forEach((s, i) => { const a = raw * 9 + i * Math.PI / 2; s.position.set(x + Math.cos(a) * .35, 1.2 + Math.sin(raw * 12 + i) * .05, z + Math.sin(a) * .35); s.lookAt(this.camera.position); });
    }, t => t);
    stars.forEach(s => this.scene.remove(s));
  }
  // Rockets over the harbour: each climbs, bursts into a ring of coloured stars, and they fall and fade.
  fireworks(x, z, n = 9) {
    const cols = ['#ff5a4a', '#ffd84a', '#5ae07a', '#5ab4ff', '#d27aff', '#ffffff', '#ff9a3a'];
    for (let k = 0; k < n; k++) setTimeout(() => {
      const col = cols[k % cols.length], bx = x + (Math.random() - .5) * 4, bz = z + (Math.random() - .5) * 2.5, by = 2.8 + Math.random() * 1.5;
      const rocket = new THREE.Mesh(this.puffGeo ||= new THREE.IcosahedronGeometry(.1, 1), noLine(new THREE.MeshBasicMaterial({ color: '#fff4c0', transparent: true })));
      rocket.position.set(bx, .3, bz); rocket.scale.setScalar(.5);
      this.bit(rocket, { v: new THREE.Vector3(0, (by - .3) / .6, 0), life: .6, s0: 1, s1: .6, a0: 1, a1: .8 });
      setTimeout(() => {
        this.sfx?.('pop');
        for (let i = 0; i < 26; i++) {
          const a = i / 26 * Math.PI * 2, e = (Math.random() - .5) * 1.2, sp = 1.6 + Math.random() * .6;
          const st = new THREE.Mesh(this.starGeo || this.puffGeo, noLine(new THREE.MeshBasicMaterial({ color: col, transparent: true, depthWrite: false, side: THREE.DoubleSide })));
          st.position.set(bx, by, bz); st.lookAt(this.camera.position);
          this.bit(st, { v: new THREE.Vector3(Math.cos(a) * sp, Math.sin(a) * sp * .8 + e, Math.sin(e * 2) * sp * .5), g: 1.6, life: 1.4 + Math.random() * .5, s0: 1.2, s1: .4, a0: 1, a1: 0, drag: 1.1 });
        }
      }, 600 / this.speed);
    }, k * 420);
  }

  // She touched the mark: the buoy bounces and sparkles, or the harbour throws a party.
  async reached(leg, final) {
    const lv = this.lv, m = lv.marks[leg], x = m % lv.W + .5, z = Math.floor(m / lv.W) + .5;
    if (final) {
      this.sfx?.('cheer');
      this.confetti(x, z, 90);
      if (lv.home) { this.starGeo ||= this.makeStar(); this.fireworks(x, z - 1.5, 14); }
      this.sparkle(x, .8, z, '#fff27a', 20);
      const crew = Object.values(this.boat.userData.crew).filter(f => f.visible);
      await this.tween(1.6, (k, raw) => {
        crew.forEach((f, i) => { f.position.y = .215 + Math.abs(Math.sin(raw * Math.PI * 6 + i)) * .12; f.userData.arms.forEach(a => { a.rotation.x = -2.8; a.rotation.z = Math.sin(raw * 30 + i) * .4; }); });
      }, t => t);
      crew.forEach(f => { f.position.y = .215; });
      return;
    }
    const bu = this.buoys[leg];
    this.sfx?.('bell');
    this.sparkle(x, .7, z);
    await this.tween(.5, k => { bu.userData.body.scale.setScalar(1 + Math.sin(k * Math.PI) * .35); bu.userData.flag.rotation.y = k * Math.PI * 2; });
    bu.userData.flagMat.color.set('#7fe08a');
  }
}
