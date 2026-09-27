// The farm in three.js: a glass case in a green plastic frame, the dirt as a slab of pixels, and the ants, food and
// brood as little voxel models. It only ever reads the farm.
//
// The dirt's front and back faces are one texture with a texel per cell (nearest-neighbour, so every cell is a crisp
// square). Where dirt meets a tunnel the slab gets walls, built in 16×16-cell chunks that are rebuilt as the ants dig,
// so turned sideways it reads as a voxel diorama. Nothing is lit: every face has its shade baked in (tops brightest,
// undersides darkest), and a tiny shader adds a per-voxel speckle.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { W, H, DEPTH, SURFACE, AIR, SPOIL, ROCK, THING, ROOT } from './rules.js';
import { RAMPS, THING_COLORS, hexToRgb } from './art.js';
import { X, Y } from './sim.js';

const D = DEPTH;
export const wx = x => x - W / 2 + .5, wy = y => H / 2 - y - .5;     // a cell's centre in world units
const FRAME = 5, LID = 4, BASE = 6;                                    // plastic around the glass, in cells
const GLASS_Z = D / 2 + .35;
const hash3 = (x, y, z) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1440670441) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
const rgb = h => hexToRgb(h).map(v => v / 255);
const RAMP = {};
for (const m in RAMPS) RAMP[m] = RAMPS[m].map(rgb);
const THING_RGB = THING_COLORS.map(rgb);
const DRY = ['#8a6a48', '#977554', '#a2805e', '#ad8b68', '#b89672'].map(rgb);

// Per-voxel speckle: darken or lighten each whole cell a touch, by where it sits.
function speckle(mat, amp) {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCellP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCellP = position - normal * 0.5;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCellP;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        { vec3 q = floor(vCellP + 0.001); float h = fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          diffuseColor.rgb *= ${(1 - amp / 2).toFixed(3)} + ${amp.toFixed(3)} * h; }`);
  };
  return mat;
}

/* ---------- boxes with their shading baked in ---------- */
const SHADE = [.82, .7, 1, .52, .92, .74];        // faces pointing +x, −x, +y, −y, +z, −z
// Push a box (as triangles) into position/normal/colour arrays.
function pushBox(o, x0, y0, z0, x1, y1, z1, c, shade = SHADE) {
  if (x0 > x1) [x0, x1] = [x1, x0];
  if (y0 > y1) [y0, y1] = [y1, y0];
  if (z0 > z1) [z0, z1] = [z1, z0];
  const quad = (a, b, cc, d, n, s) => {
    for (const v of [a, b, cc, a, cc, d]) { o.p.push(v[0], v[1], v[2]); o.n.push(n[0], n[1], n[2]); o.c.push(c[0] * s, c[1] * s, c[2] * s); }
  };
  quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], shade[0]);
  quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], shade[1]);
  quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], shade[2]);
  quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], shade[3]);
  quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], shade[4]);
  quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], shade[5]);
}
function toGeometry(o) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(o.n, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(o.c, 3));
  return g;
}
const newBuf = () => ({ p: [], n: [], c: [] });
function boxes(list, scale = 1) {
  const o = newBuf();
  for (const [x0, y0, z0, x1, y1, z1, c] of list) pushBox(o, x0 * scale, y0 * scale, z0 * scale, x1 * scale, y1 * scale, z1 * scale, typeof c === 'string' ? rgb(c) : c);
  return toGeometry(o);
}

/* ---------- the ants ---------- */
// Each ant is modelled in half-cell units with +x forward (the head), +y up (its back) and z across, feet at y = 0.
// Two walking frames swap which tripod of legs is forward.
const LOOKS = {
  worker: { body: '#7c2f18', hi: '#a4482a', dark: '#3b150b', leg: '#4f1e10', eye: '#120604', scale: 1 },
  digger: { body: '#4a2315', hi: '#6a3a24', dark: '#1f0d07', leg: '#2e140b', eye: '#0a0403', scale: 1.08, head: 1.3 },
  scout: { body: '#b0661f', hi: '#d68a38', dark: '#5a2f0c', leg: '#6e3a12', eye: '#1a0d04', scale: .98, legs: 1.3 },
  nurse: { body: '#c99a64', hi: '#e8bf8a', dark: '#7a5230', leg: '#8e633c', eye: '#2a1a0c', scale: .88 },
  officer: { body: '#2b201d', hi: '#4a3a34', dark: '#120c0a', leg: '#1d1512', eye: '#000', band: '#e3ac3c', scale: 1.08 },
  queen: { body: '#6a2814', hi: '#94432a', dark: '#2c0f07', leg: '#431a0d', eye: '#120604', crown: '#ffd24a', scale: 1.35, gaster: 1.7 },
};
function antBoxes(type, frame) {
  const L = LOOKS[type], P = [];
  const lift = type === 'scout' ? .4 : 0, gl = L.gaster || 1, hs = L.head || 1;
  const g0 = -1.6 - 2.8 * gl;
  // gaster (abdomen), rounded off with a tip and a highlight along the top
  P.push([g0, 1 + lift, -1.1 * Math.min(gl, 1.25), -1.6, 3 + lift + (gl - 1) * .6, 1.1 * Math.min(gl, 1.25), L.body]);
  P.push([g0 - .5, 1.5 + lift, -.75, g0, 2.6 + lift, .75, L.body]);
  P.push([g0 + .4, 3 + lift + (gl - 1) * .6, -.7, -2.1, 3.35 + lift + (gl - 1) * .6, .7, L.hi]);
  if (type === 'queen') for (let k = 0; k < 3; k++) P.push([g0 + .8 + k * 1.4, 1 + lift, -1.4, g0 + 1.2 + k * 1.4, 3.6, 1.4, L.dark]);  // stripes
  P.push([-1.6, 1.5 + lift, -.4, -1, 2.2 + lift, .4, L.dark]);                                  // waist
  P.push([-1, 1.4 + lift, -.7, 1.1, 2.5 + lift, .7, L.body]);                                   // thorax
  P.push([-.6, 2.5 + lift, -.5, .8, 2.9 + lift, .5, L.band || L.hi]);
  const h0 = 1.1, h1 = 1.1 + 2 * hs, hy0 = 1.5 + lift - (hs - 1) * .4, hy1 = 3.3 + lift + (hs - 1) * .4, hz = .95 * hs;
  P.push([h0, hy0, -hz, h1, hy1, hz, L.body]);                                                   // head
  P.push([h0 + .3, hy1, -hz + .3, h1 - .4, hy1 + .25, hz - .3, L.hi]);
  P.push([h1 - .8, hy1 - .9, -hz - .05, h1 - .3, hy1 - .4, -hz, L.eye]);                         // eyes
  P.push([h1 - .8, hy1 - .9, hz, h1 - .3, hy1 - .4, hz + .05, L.eye]);
  const mj = type === 'digger' ? 1.1 : .7;                                                      // mandibles
  P.push([h1, hy0, -.8, h1 + mj, hy0 + .45, -.3, L.dark]);
  P.push([h1, hy0, .3, h1 + mj, hy0 + .45, .8, L.dark]);
  for (const s of [-1, 1]) {                                                                     // elbowed antennae
    P.push([h1 - .6, hy1, s * .45 - .15, h1 - .3, hy1 + 1.2, s * .45 + .15, L.dark]);
    P.push([h1 - .3, hy1 + .9, s * .6 - .15, h1 + 1.3, hy1 + 1.2, s * .6 + .15, L.dark]);
  }
  if (L.crown) for (const [x, z] of [[h0 + .5, 0], [h0 + 1.2, -.5], [h0 + 1.2, .5]]) P.push([x - .2, hy1, z - .2, x + .2, hy1 + .7, z + .2, L.crown]);
  // legs: a thigh out from the thorax, then a shin down to the ground, front legs reaching forward
  const legX = [-.7, .1, .9], ll = L.legs || 1;
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
    const tripod = (k % 2 === 0) === (s > 0) ? 1 : -1, swing = (frame ? tripod : -tripod) * .45, x = legX[k], foot = x + (k - 1) * .9 + swing;
    const top = 1.9 + lift;
    P.push([x - .15, top - .3, s * .55, x + .15, top, s * 1.55 * ll, L.leg]);
    P.push([Math.min(x, foot) - .15, top - .3, s * 1.45 * ll - .15, Math.max(x, foot) + .15, top, s * 1.45 * ll + .15, L.leg]);
    P.push([foot - .15, 0, s * 1.45 * ll - .15, foot + .15, top, s * 1.45 * ll + .15, L.leg]);
  }
  return P;
}
// Where an ant carries things, in cells from its origin (forward, up).
const JAWS = type => { const L = LOOKS[type]; return [(1.1 + 2 * (L.head || 1) + .6) * .5 * L.scale, 1.4 * .5 * L.scale]; };

/* ---------- little things: food, brood, the dead ---------- */
const ITEM_COL = {
  seed: ['#d8c08a', '#bba36a', '#3a3530'], meat: ['#5a3b2a', '#6e4b2f', '#3c4a2a'], berry: ['#c2303e', '#e0505a', '#9a1f2c'],
  sugar: ['#f4f1ea', '#e6e2d8', '#fffdf8'], crumb: ['#d9a55c', '#c48a42', '#e8bd78'], drop: ['#f0b43c', '#e89c24', '#ffd06a'],
  honeydew: ['#e8c050', '#d6a830', '#f5d878'], egg: ['#f6f2e6'], larva: ['#efe6cf'], pupa: ['#e8d6a8'], aphid: ['#8fce4a', '#76b83a'],
};
const PANTRY_LOOKS = ['seed', 'honeydew', 'crumb', 'drop', 'seed', 'berry', 'sugar', 'meat'];

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    // Colours go out exactly as they're written, as pixel art should: no conversion to or from linear light.
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 1, 4000);
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: .09, rotateSpeed: .55, zoomSpeed: .9, panSpeed: .8, screenSpacePanning: true, zoomToCursor: true,
      minDistance: 40, maxDistance: 900, minPolarAngle: .05, maxPolarAngle: Math.PI - .05 });
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.inset = { top: 70, bottom: 120, side: 16 };
    this.walls = new THREE.Group(); this.scene.add(this.walls);
    this.chunks = []; this.dirtyChunks = new Set();
    this.wallMat = speckle(new THREE.MeshBasicMaterial({ vertexColors: true }), .16);
    this.frameMat = speckle(new THREE.MeshBasicMaterial({ vertexColors: true }), .07);
    this.flatMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.fx = [];                                       // flying dirt and falling drops
    this.antState = new Map();                          // per ant: smoothed position and turn
    this.decor = new THREE.Group(); this.scene.add(this.decor);
    this.buildCase();
    this.buildInstances();
    this.tmp = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color(), f: new THREE.Vector3(), u: new THREE.Vector3(), w: new THREE.Vector3() };
    this.raycaster = new THREE.Raycaster();
  }

  /* ---------- the case ---------- */
  buildCase() {
    const green = rgb('#2f8a3e'), greenDark = rgb('#226b30'), cork = rgb('#b98b5a');
    const o = newBuf();
    const zo = D / 2 + 1.6;                         // the frame is a bit deeper than the glass
    const x0 = -W / 2, x1 = W / 2, y0 = -H / 2, y1 = H / 2;
    pushBox(o, x0 - FRAME, y0 - BASE, -zo, x0, y1 + LID, zo, green);                         // left and right sides
    pushBox(o, x1, y0 - BASE, -zo, x1 + FRAME, y1 + LID, zo, green);
    pushBox(o, x0, y0 - BASE, -zo, x1, y0, zo, green);                                        // bottom rail
    pushBox(o, x0, y1, -zo, x1, y1 + LID, zo, green);                                         // lid
    pushBox(o, x0 - FRAME - 1, y1 + LID, -zo - 1, x1 + FRAME + 1, y1 + LID + 1, zo + 1, greenDark);   // lid rim
    // feet: two wide stands so it doesn't tip over
    for (const fx of [x0 + 12, x1 - 22]) pushBox(o, fx, y0 - BASE - 4, -zo - 9, fx + 10, y0 - BASE, zo + 9, greenDark);
    this.caseMesh = new THREE.Mesh(toGeometry(o), this.frameMat);
    this.scene.add(this.caseMesh);
    // air holes along the lid, and a corked feeding hole
    const h = newBuf();
    for (let x = x0 + 8; x < x1 - 6; x += 7) pushBox(h, x, y1 + LID + .9, -1, x + 1, y1 + LID + 1.15, 1, rgb('#173a1d'), [1, 1, 1, 1, 1, 1]);
    pushBox(h, x0 + 20, y1 + LID + 1, -2, x0 + 24, y1 + LID + 2.5, 2, cork);
    this.decor.add(new THREE.Mesh(toGeometry(h), this.flatMat));
    // glass: faint, with a couple of pixel-y glints
    const gc = document.createElement('canvas'); gc.width = 96; gc.height = 64;
    const g = gc.getContext('2d');
    g.fillStyle = 'rgba(210, 235, 255, 0.045)'; g.fillRect(0, 0, 96, 64);
    g.fillStyle = 'rgba(255, 255, 255, 0.1)'; g.fillRect(0, 0, 96, 1);          // a glint along the top edge
    const tex = new THREE.CanvasTexture(gc); tex.magFilter = tex.minFilter = THREE.NearestFilter;
    const glassMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const backMat = new THREE.MeshBasicMaterial({ color: 0xd2ebff, transparent: true, opacity: .04, depthWrite: false, side: THREE.DoubleSide });
    for (const z of [GLASS_Z, -GLASS_Z]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), z > 0 ? glassMat : backMat);
      pane.position.z = z; pane.renderOrder = 2;
      if (z < 0) pane.rotation.y = Math.PI;
      this.scene.add(pane);
    }
    // a soft shadow under the stand
    const sc = document.createElement('canvas'); sc.width = sc.height = 64;
    const sg = sc.getContext('2d'), grad = sg.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.45)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = grad; sg.fillRect(0, 0, 64, 64);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.35, 60), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = y0 - BASE - 4.2;
    this.scene.add(shadow);
  }

  /* ---------- a farm ---------- */
  setFarm(farm) {
    this.farm = farm;
    this.antState.clear(); this.fx.length = 0;
    if (!this.tex) {
      this.pix = new Uint8Array(W * H * 4);
      this.tex = new THREE.DataTexture(this.pix, W, H, THREE.RGBAFormat);
      this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter;
      const faceMat = new THREE.MeshBasicMaterial({ map: this.tex, alphaTest: .5 });
      const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H), faceMat);
      front.position.z = D / 2;
      const backGeo = new THREE.PlaneGeometry(W, H), uv = backGeo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setX(k, 1 - uv.getX(k));        // mirrored so each cell lines up from behind
      const back = new THREE.Mesh(backGeo, faceMat);
      back.rotation.y = Math.PI; back.position.z = -D / 2;
      this.scene.add(front, back);
    }
    this.paint(0, 0, W - 1, H - 1);
    for (const m of this.chunks) if (m) { m.geometry.dispose(); this.walls.remove(m); }
    this.chunks = [];
    for (let cy = 0; cy < Math.ceil(H / 16); cy++) for (let cx = 0; cx < Math.ceil(W / 16); cx++) this.dirtyChunks.add(cy * 100 + cx);
    this.buildDecor();
    farm.changed.length = 0;
  }
  // The colour of a solid cell, before any shading for tunnels.
  cellColor(i) {
    const f = this.farm, m = f.mat[i], a = f.aux[i];
    if (m === THING) return THING_RGB[a] || [1, 0, 1];
    if (m === SPOIL) {           // dug-out dirt dries to much the same pale brown, whatever layer it came from
      const r = RAMP[a >> 3] || RAMP[2], c = r[Math.min(r.length - 1, a & 7)], d = DRY[a & 7] || DRY[2];
      return [c[0] * .35 + d[0] * .65, c[1] * .35 + d[1] * .65, c[2] * .35 + d[2] * .65];
    }
    const r = RAMP[m];
    return r ? r[Math.min(r.length - 1, a)] : [1, 0, 1];
  }
  isTunnel(x, y) { return x >= 0 && y >= 0 && x < W && y < H && this.farm.mat[y * W + x] === AIR && y >= this.farm.surf[x]; }
  // Repaint the dirt texture over a rectangle of cells: the walls of tunnels darker and damp, the top crust dry and
  // light, and everything a little darker the deeper it is.
  paint(x0, y0, x1, y1) {
    const f = this.farm, pix = this.pix;
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W - 1, x1); y1 = Math.min(H - 1, y1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x, o = ((H - 1 - y) * W + x) * 4;
      if (f.mat[i] === AIR) { pix[o + 3] = 0; continue; }
      const c = this.cellColor(i);
      let k = 1 - .14 * Math.max(0, (y - SURFACE) / (H - SURFACE));
      let near = 0;
      for (let dy = -2; dy <= 2 && near < 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (this.isTunnel(x + dx, y + dy)) { near = Math.max(near, Math.abs(dx) <= 1 && Math.abs(dy) <= 1 ? 2 : 1); if (near === 2) break; }
      }
      if (f.mat[i] !== THING && f.mat[i] !== ROCK) k *= near === 2 ? .74 : near === 1 ? .88 : 1;
      if (y === f.surf[x] || (y > 0 && f.mat[i - W] === AIR && y - 1 < f.surf[x])) k *= 1.1;
      pix[o] = Math.min(255, c[0] * k * 255); pix[o + 1] = Math.min(255, c[1] * k * 255); pix[o + 2] = Math.min(255, c[2] * k * 255); pix[o + 3] = 255;
    }
    this.tex.needsUpdate = true;
  }
  buildChunk(cx, cy) {
    const f = this.farm, o = newBuf();
    const z0 = -D / 2, z1 = D / 2;
    for (let y = cy * 16; y < Math.min(H, cy * 16 + 16); y++) for (let x = cx * 16; x < Math.min(W, cx * 16 + 16); x++) {
      const i = y * W + x;
      if (f.mat[i] === AIR) continue;
      const base = this.cellColor(i), damp = f.mat[i] === THING || f.mat[i] === ROCK ? .9 : .66;
      const c = [base[0] * damp, base[1] * damp, base[2] * damp];
      const X0 = x - W / 2, X1 = X0 + 1, Y1 = H / 2 - y, Y0 = Y1 - 1;
      const quad = (a, b, cc, d, n, s) => { for (const v of [a, b, cc, a, cc, d]) { o.p.push(v[0], v[1], v[2]); o.n.push(n[0], n[1], n[2]); o.c.push(c[0] * s, c[1] * s, c[2] * s); } };
      const sky = y - 1 < f.surf[x];
      if (y > 0 && f.mat[i - W] === AIR) quad([X0, Y1, z1], [X1, Y1, z1], [X1, Y1, z0], [X0, Y1, z0], [0, 1, 0], sky ? 1.4 : .78);
      if (y < H - 1 && f.mat[i + W] === AIR) quad([X0, Y0, z0], [X1, Y0, z0], [X1, Y0, z1], [X0, Y0, z1], [0, -1, 0], .34);
      if (x > 0 && f.mat[i - 1] === AIR) quad([X0, Y0, z0], [X0, Y0, z1], [X0, Y1, z1], [X0, Y1, z0], [-1, 0, 0], sky ? 1 : .5);
      if (x < W - 1 && f.mat[i + 1] === AIR) quad([X1, Y0, z1], [X1, Y0, z0], [X1, Y1, z0], [X1, Y1, z1], [1, 0, 0], sky ? 1.15 : .6);
    }
    const key = cy * 100 + cx, old = this.chunks[key];
    if (old) { old.geometry.dispose(); this.walls.remove(old); this.chunks[key] = null; }
    if (!o.p.length) return;
    const m = new THREE.Mesh(toGeometry(o), this.wallMat);
    m.matrixAutoUpdate = false;
    this.walls.add(m);
    this.chunks[key] = m;
  }
  // Plants and grass on top, and the sugar drip's bottle up on the lid.
  buildDecor() {
    for (const c of [...this.decor.children]) if (c.userData.farm) { c.geometry.dispose(); this.decor.remove(c); }
    const f = this.farm, o = newBuf();
    const leaf = rgb('#5fa83c'), leaf2 = rgb('#7cc24e'), stem = rgb('#3f7a2a'), grass = rgb('#6aa844'), grass2 = rgb('#4f8a33');
    this.plantGeo = [];
    for (const p of f.plants) {
      const x = wx(p.x), baseY = 0, hgt = p.kind === 'grass' ? 7 : 6, P = [];
      if (p.kind === 'grass') {
        for (let k = -2; k <= 2; k++) { const hh = hgt - Math.abs(k) * 1.2 + (k & 1); P.push([k * .9 - .25, baseY, -.3, k * .9 + .25, baseY + hh, .3, k & 1 ? grass : grass2]); }
      } else {
        P.push([-.3, baseY, -.3, .3, baseY + hgt, .3, stem]);
        if (p.kind === 'sprout') { P.push([.3, hgt - 1.5, -.8, 2.6, hgt - .6, .8, leaf]); P.push([-2.6, hgt - 2.8, -.8, -.3, hgt - 1.9, .8, leaf2]); }
        else for (const [dx, dz] of [[-1.2, 0], [1.2, 0], [0, 1.2]]) P.push([dx - 1, hgt - .4, dz - 1, dx + 1, hgt + .4, dz + 1, leaf]);
      }
      const g = boxes(P);
      const mesh = new THREE.Mesh(g, this.flatMat);
      mesh.userData = { farm: true, plant: p.x };
      this.decor.add(mesh);
    }
    for (const t of f.tufts) {
      const P = [];
      for (let k = 0; k < 3; k++) { const z = (hash3(t.x, k, 5) - .5) * (D - 1.5), xo = (hash3(t.x, k, 6) - .5) * .8; P.push([xo - .2, 0, z - .2, xo + .2, t.h * (.6 + hash3(t.x, k, 7) * .6), z + .2, k & 1 ? grass : grass2]); }
      const mesh = new THREE.Mesh(boxes(P), this.flatMat);
      mesh.userData = { farm: true, plant: t.x };
      this.decor.add(mesh);
    }
    // the drip: an upside-down bottle through the lid, with a nozzle
    const bx = wx(f.dripX), top = H / 2 + LID + 1;
    const B = [[bx - 2.5, top + 1.5, -2.5, bx + 2.5, top + 9, 2.5, rgb('#9fd3e8')], [bx - 2, top + 9, -2, bx + 2, top + 10, 2, rgb('#d8eef6')],
      [bx - 1.5, top, -1.5, bx + 1.5, top + 1.5, 1.5, rgb('#e24c4c')], [bx - .4, H / 2 - 1.2, -.4, bx + .4, top, .4, rgb('#cfd8dc')],
      [bx - 1.2, top + 3, -2.55, bx + 1.2, top + 7.5, -2.5, rgb('#f0b43c')], [bx - 1.2, top + 3, 2.5, bx + 1.2, top + 7.5, 2.55, rgb('#f0b43c')]];
    const bottle = new THREE.Mesh(boxes(B), this.flatMat);
    bottle.userData = { farm: true };
    this.decor.add(bottle);
    this.placeDecor();
  }
  // Plants ride up with the ground as dirt piles up around them.
  placeDecor() {
    const f = this.farm;
    for (const c of this.decor.children) if (c.userData.plant !== undefined) c.position.set(wx(c.userData.plant), wy(f.surf[c.userData.plant] - 1) - .5, 0);
  }

  /* ---------- ants, items, flying bits ---------- */
  buildInstances() {
    this.antMesh = {};
    const types = Object.keys(LOOKS);
    for (const t of types) {
      const L = LOOKS[t];
      this.antMesh[t] = [0, 1].map(fr => {
        const g = boxes(antBoxes(t, fr), .5 * L.scale);
        const m = new THREE.InstancedMesh(g, this.flatMat, 180);
        m.count = 0; m.frustumCulled = false;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.setColorAt(0, new THREE.Color(1, 1, 1));
        this.scene.add(m);
        return m;
      });
    }
    const cube = boxes([[-.5, -.5, -.5, .5, .5, .5, [1, 1, 1]]]);
    this.items = new THREE.InstancedMesh(cube, this.flatMat, 2600);
    this.items.count = 0; this.items.frustumCulled = false;
    this.items.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.items.setColorAt(0, new THREE.Color(1, 1, 1));
    this.scene.add(this.items);
    // selection marker: a pixel ring that always faces the camera
    const rc = document.createElement('canvas'); rc.width = rc.height = 16;
    const rg = rc.getContext('2d'); rg.fillStyle = '#ffe27a';
    for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; rg.fillRect(Math.round(7.5 + Math.cos(t) * 6.5), Math.round(7.5 + Math.sin(t) * 6.5), 1, 1); }
    const rt = new THREE.CanvasTexture(rc); rt.magFilter = rt.minFilter = THREE.NearestFilter;
    this.ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: rt, depthTest: false, transparent: true }));
    this.ring.renderOrder = 5; this.ring.visible = false;
    this.scene.add(this.ring);
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: rt, depthTest: false, transparent: true, opacity: .35 }));
    this.aura.renderOrder = 5; this.aura.visible = false;
    this.scene.add(this.aura);
    // placement ghost: a pixel reticle (corner brackets and a dot) over the cell under the pointer
    const gc = document.createElement('canvas'); gc.width = gc.height = 16;
    const gg = gc.getContext('2d'); gg.fillStyle = '#fff';
    for (const [x, y, w, h] of [[0, 0, 5, 1], [0, 0, 1, 5], [11, 0, 5, 1], [15, 0, 1, 5], [0, 15, 5, 1], [0, 11, 1, 5], [11, 15, 5, 1], [15, 11, 1, 5], [7, 7, 2, 2]]) gg.fillRect(x, y, w, h);
    const gt = new THREE.CanvasTexture(gc); gt.magFilter = gt.minFilter = THREE.NearestFilter;
    const gm = new THREE.MeshBasicMaterial({ map: gt, color: 0xffffff, transparent: true, opacity: .9, depthTest: false });
    this.ghost = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), gm);
    this.ghost.renderOrder = 6; this.ghost.visible = false;
    this.scene.add(this.ghost);
  }

  // One frame: catch up with the dirt, move everything, draw.
  frame(dt, sel = null, now = performance.now() / 1000) {
    const f = this.farm;
    if (!f) return;
    if (f.changed.length) {
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (const i of f.changed) {
        const x = X(i), y = Y(i);
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const cx = (x + dx) >> 4, cy = (y + dy) >> 4;
          if (x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H) this.dirtyChunks.add(cy * 100 + cx);
        }
      }
      if (f.changed.length > 400) this.paint(0, 0, W - 1, H - 1); else for (const i of f.changed) this.paint(X(i) - 2, Y(i) - 2, X(i) + 2, Y(i) + 2);
      if (f.changed.some(i => Y(i) <= f.surf[X(i)] + 1)) this.placeDecor();
      f.changed.length = 0;
    }
    let budget = this.chunks.length ? 10 : 200;
    for (const k of this.dirtyChunks) { this.buildChunk(k % 100, Math.floor(k / 100)); this.dirtyChunks.delete(k); if (--budget <= 0) break; }
    for (const e of f.fx.splice(0)) this.spawnFx(e);
    this.drawAnts(dt, sel, now);
    this.drawItems(dt, now);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // Which way an ant stands: away from whatever it's walking on (averaged over the cells around it).
  support(c) {
    const f = this.farm, x = X(c), y = Y(c);
    let sx = 0, sy = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      if (f.solid(x + dx, y + dy)) { const w = dx && dy ? .6 : 1; sx += dx * w; sy += dy * w; }
    }
    const l = Math.hypot(sx, sy);
    return l < .5 ? [0, 1] : [-sx / l, sy / l];          // in world axes (grid y points down)
  }
  drawAnts(dt, sel, now) {
    const f = this.farm, T = this.tmp, counts = {};
    for (const t in this.antMesh) counts[t] = [0, 0];
    const seen = new Set();
    const put = (type, frame, m, tint) => {
      const mesh = this.antMesh[type][frame], k = counts[type][frame]++;
      if (k >= 180) return;
      mesh.setMatrixAt(k, m);
      mesh.setColorAt(k, T.c.setRGB(tint, tint, tint));
    };
    const ease = 1 - Math.exp(-dt * 12);
    for (const a of f.ants) {
      seen.add(a.id);
      let st = this.antState.get(a.id);
      const cx = wx(X(a.c)), cy = wy(Y(a.c));
      let px = cx, py = cy, fx = a.dir, fy = 0;
      if (a.n >= 0) {
        const nx = wx(X(a.n)), ny = wy(Y(a.n));
        px = cx + (nx - cx) * a.t; py = cy + (ny - cy) * a.t;
        const l = Math.hypot(nx - cx, ny - cy) || 1; fx = (nx - cx) / l; fy = (ny - cy) / l;
      } else if (a.at >= 0 && a.act) {
        const ax = wx(X(a.at)) - cx, ay = wy(Y(a.at)) - cy, l = Math.hypot(ax, ay);
        if (l > .1) { fx = ax / l; fy = ay / l; }
      }
      const [ux, uy] = this.support(a.n >= 0 && a.t > .5 ? a.n : a.c);
      // up: the support direction made square to the heading
      let dot = ux * fx + uy * fy, upx = ux - dot * fx, upy = uy - dot * fy, ul = Math.hypot(upx, upy);
      if (!st) { st = { x: px, y: py, z: a.z, q: new THREE.Quaternion(), up: [0, 1], init: false }; this.antState.set(a.id, st); }
      if (ul > .3) st.up = [upx / ul, upy / ul];
      else if (st.up[0] * fx + st.up[1] * fy > .5 || st.up[0] * fx + st.up[1] * fy < -.5) st.up = [-fy, fx];   // heading into the wall: keep the old up, if it still fits
      T.f.set(fx, fy, 0); T.u.set(st.up[0], st.up[1], 0);
      T.w.crossVectors(T.f, T.u);
      if (T.w.lengthSq() < .01) { T.u.set(-fy, fx, 0); T.w.crossVectors(T.f, T.u); }
      T.m.makeBasis(T.f, T.u, T.w);
      T.q.setFromRotationMatrix(T.m);
      if (!st.init) { st.q.copy(T.q); st.x = px; st.y = py; st.init = true; }
      st.q.slerp(T.q, 1 - Math.exp(-dt * 14));
      st.x += (px - st.x) * Math.min(1, ease * 2.5); st.y += (py - st.y) * Math.min(1, ease * 2.5);
      if (Math.hypot(px - st.x, py - st.y) > 3) { st.x = px; st.y = py; }
      st.z += (a.z - st.z) * ease * .3;
      // feet on the ground: half a cell toward whatever it's standing on
      const ox = -st.up[0] * .5, oy = -st.up[1] * .5;
      let bob = 0;
      if (a.act === 'dig') bob = Math.sin(now * 22 + a.id) * .12;
      T.v.set(st.x + ox + fx * bob, st.y + oy + fy * bob, st.z);
      T.s.set(1, 1, 1);
      T.m.compose(T.v, st.q, T.s);
      const moving = a.n >= 0, frame = moving ? Math.floor(a.walked * 2.6) & 1 : a.act === 'dig' ? Math.floor(now * 8 + a.id) & 1 : 0;
      put(a.type, frame, T.m, a.energy <= 0 ? .7 : 1);
      st.m = st.m || new THREE.Matrix4(); st.m.copy(T.m);
      st.pos = [T.v.x, T.v.y, T.v.z];
      // what it carries, held out in front of its jaws
      if (a.carry || a.spoil > 0) {
        const [fwd, upj] = JAWS(a.type);
        const kind = a.carry?.kind === 'food' ? a.carry.look : a.carry?.kind === 'corpse' ? 'corpse' : 'spoil';
        this.pending = this.pending || [];
        this.pending.push({ kind, m: a.carry?.m ?? a.spoilMat, x: T.v.x + (T.f.x * fwd + T.u.x * upj) * 1, y: T.v.y + (T.f.y * fwd + T.u.y * upj), z: T.v.z, q: st.q, type: a.carry?.type });
      }
    }
    for (const id of this.antState.keys()) if (!seen.has(id)) this.antState.delete(id);
    // the dead lie legs-up, greyed out
    for (const it of f.items) if (it.kind === 'corpse') {
      const x = wx(X(it.c)), y = wy(Y(it.c)) - .5 + 1.55 * (LOOKS[it.type]?.scale || 1), z = ((it.id * 7919) % 50) / 50 * 5 - 2.5;
      T.q.setFromAxisAngle(T.v.set(1, 0, 0), Math.PI).multiply(new THREE.Quaternion().setFromAxisAngle(T.v.set(0, 1, 0), (it.id % 7) * .9));
      T.m.compose(T.v.set(x, y, z), T.q, T.s.set(1, 1, 1));
      put(it.type in LOOKS ? it.type : 'worker', 0, T.m, .5);
    }
    for (const t in this.antMesh) for (const fr of [0, 1]) {
      const m = this.antMesh[t][fr];
      m.count = Math.min(180, counts[t][fr]);
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    // the ring round whoever's picked
    const s = sel && this.antState.get(sel.id);
    this.ring.visible = !!s && !!s.pos;
    if (this.ring.visible) { this.ring.position.set(s.pos[0], s.pos[1] + .9, s.pos[2]); this.ring.scale.setScalar(sel.type === 'queen' ? 8 : 6); }
    this.aura.visible = this.ring.visible && sel.type === 'officer';
    if (this.aura.visible) { this.aura.position.copy(this.ring.position); this.aura.scale.setScalar(32 * 1.05); }
  }
  drawItems(dt, now) {
    const f = this.farm, T = this.tmp, M = this.items;
    let n = 0;
    const add = (x, y, z, sx, sy, sz, color, rot = 0) => {
      if (n >= 2600) return;
      T.q.setFromAxisAngle(T.v.set(0, 0, 1), rot);
      T.m.compose(T.v.set(x, y, z), T.q, T.s.set(sx, sy, sz));
      M.setMatrixAt(n, T.m); M.setColorAt(n, T.c.setRGB(color[0], color[1], color[2])); n++;
    };
    const look = (kind, k) => { const cs = ITEM_COL[kind] || ITEM_COL.crumb; return rgb(cs[k % cs.length]); };
    const lookCache = this.lookCache || (this.lookCache = {});
    const col = (kind, k) => { const key = kind + k % 3; return lookCache[key] || (lookCache[key] = look(kind, k)); };
    // A pile on the floor of some cells: fills the lowest cells first, a few deep, spread across the glass.
    const pile = (cells, count, kindOf, size = .55) => {
      const floor = cells.filter(i => f.mat[i] === AIR && i + W < W * H && f.mat[i + W] !== AIR);
      if (!floor.length) return;
      const perLayer = floor.length * 5;
      for (let k = 0; k < count; k++) {
        const c = floor[(k * 7) % floor.length], layer = Math.floor(k / perLayer), h = hash3(c, k, 3);
        const x = wx(X(c)) + (hash3(c, k, 1) - .5) * .7, y = wy(Y(c)) - .5 + size / 2 + layer * size * .9 + (h > .7 ? size * .5 : 0);
        const z = (hash3(c, k, 2) - .5) * (D - 1.2), kind = kindOf(k);
        const long = kind === 'seed';
        add(x, y, z, long ? size * 1.4 : size, size * .8, long ? size * .8 : size, col(kind, k), long ? (h - .5) * .8 : 0);
      }
    };
    // the pantry
    const rooms = f.homeRooms(), cells = [];
    for (const r of rooms) for (const i of r.cells) cells.push(i);
    cells.sort((a, b) => Y(b) - Y(a));
    pile(cells, Math.min(600, Math.floor(f.food)), k => PANTRY_LOOKS[(k * 5 + (k >> 3)) % PANTRY_LOOKS.length]);
    // food where it's found
    for (const s of f.sources) {
      if (s.gone) continue;
      const kind = { drip: 'drop', aphids: 'honeydew', seeds: 'seed', beetle: 'meat', berry: 'berry', sugar: 'sugar', crumbs: 'crumb' }[s.kind];
      if (s.surface) {
        for (let k = 0; k < Math.min(40, s.stock); k++) {
          const x = wx(s.x) + (hash3(s.id, k, 1) - .5) * 2.4, z = (hash3(s.id, k, 2) - .5) * (D - 1.5), sz = .6;
          add(x, wy(f.surf[Math.round(s.x)]) + .5 + sz / 2 + (k > 12 ? .5 : 0), z, sz, sz * .7, sz, col(kind, k));
        }
      } else pile(s.cells, Math.min(90, Math.ceil(s.stock)), () => kind, kind === 'meat' ? .75 : .6);
      if (s.kind === 'aphids' && s.root) {           // aphids on their root, gently nodding
        const rx = wx(s.root[0]), ry = wy(s.root[1]);
        for (let k = 0; k < 6; k++) {
          const dy = (k - 2.5) * 1.1, side = s.x >= s.root[0] ? 1 : -1, z = (hash3(s.id, k, 9) - .5) * (D - 2);
          add(rx + side * .75, ry + dy + Math.sin(now * 2 + k) * .06, z, .7, .55, .6, col('aphid', k));
        }
      }
    }
    // brood in the nursery
    for (const b of f.brood) {
      const x = wx(X(b.c)) + (hash3(b.id, 1, 1) - .5) * .6, z = (hash3(b.id, 2, 1) - .5) * (D - 2), y0 = wy(Y(b.c)) - .5;
      if (b.stage === 0) add(x, y0 + .2, z, .38, .5, .38, col('egg', 0));
      else if (b.stage === 1) add(x, y0 + .25, z, .8 + b.t / 90, .5, .5, col('larva', 0), Math.sin(now * 1.5 + b.id) * .15);
      else add(x, y0 + .3, z, 1.1, .6, .6, col('pupa', 0));
    }
    // things in jaws
    for (const p of this.pending || []) {
      if (p.kind === 'spoil') { const r = RAMP[p.m] || RAMP[2]; add(p.x, p.y, p.z, .6, .6, .6, r[2]); }
      else if (p.kind === 'corpse') add(p.x, p.y, p.z, .9, .4, .5, rgb('#3a2418'));
      else add(p.x, p.y, p.z, .55, .5, .5, col(p.kind, 1));
    }
    this.pending = [];
    // flying dirt, falling drops
    for (let k = this.fx.length - 1; k >= 0; k--) {
      const e = this.fx[k];
      e.t += dt;
      if (e.t > e.life) { this.fx.splice(k, 1); continue; }
      e.vy -= e.g * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
      if (e.floor !== undefined && e.y < e.floor) { e.y = e.floor; if (e.drop) { this.fx.splice(k, 1); continue; } e.vy = 0; e.vx *= .5; }
      add(e.x, e.y, e.z, e.s, e.s, e.s, e.c);
    }
    M.count = n;
    M.instanceMatrix.needsUpdate = true;
    if (M.instanceColor) M.instanceColor.needsUpdate = true;
  }
  spawnFx(e) {
    const f = this.farm;
    if (e.kind === 'dig') {
      const r = RAMP[e.m] || RAMP[2];
      for (let k = 0; k < 4; k++) this.fx.push({ x: wx(X(e.c)) + (Math.random() - .5) * .6, y: wy(Y(e.c)), z: (Math.random() - .5) * (D - 1), vx: (Math.random() - .5) * 3, vy: 1 + Math.random() * 3,
        vz: (Math.random() - .5) * 2, g: 14, t: 0, life: .45 + Math.random() * .3, s: .22 + Math.random() * .15, c: r[Math.floor(Math.random() * r.length)] });
    } else if (e.kind === 'drip') {
      this.fx.push({ x: wx(e.x), y: H / 2 - 1.2, z: 0, vx: 0, vy: 0, vz: 0, g: 40, t: 0, life: 3, s: .6, c: rgb('#f0b43c'), floor: wy(f.surf[e.x] - 1) - .2, drop: true });
    } else if (e.kind === 'crumbs') {
      for (let k = 0; k < 8; k++) this.fx.push({ x: wx(e.x) + (Math.random() - .5) * 2, y: H / 2 - 1 - Math.random() * 3, z: (Math.random() - .5) * (D - 2), vx: (Math.random() - .5) * 2, vy: 0, vz: 0, g: 36, t: 0, life: 2.5,
        s: .55, c: rgb(ITEM_COL.crumb[k % 3]), floor: wy(f.surf[e.x] - 1) - .2, drop: true });
    }
  }

  /* ---------- camera and picking ---------- */
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  // Frame the whole case between the top bar and the tray at the bottom.
  home(yaw = 0, pitch = 0) {
    const w = this.canvas.clientWidth || innerWidth || 1, h = this.canvas.clientHeight || innerHeight || 1, I = this.inset;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const boxW = W + FRAME * 2 + 4, boxH = H + LID + BASE + 16;
    const vf = THREE.MathUtils.degToRad(this.camera.fov), usableH = Math.max(80, h - I.top - I.bottom) / h, usableW = Math.max(80, w - I.side * 2) / w;
    const dH = boxH / 2 / Math.tan(vf / 2) / usableH, dW = boxW / 2 / Math.tan(vf / 2) / this.camera.aspect / usableW;
    const d = Math.max(dH, dW) * 1.02;
    // shift the view so the case sits in the space left between the bars
    const shift = (I.bottom - I.top) / 2 / h * 2 * d * Math.tan(vf / 2);
    const target = new THREE.Vector3(0, -shift + (LID - BASE) / 2 + 2, 0);
    const pos = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d).add(target);
    return { target, pos };
  }
  setView(v) { this.controls.target.copy(v.target); this.camera.position.copy(v.pos); this.controls.update(); }
  // The cell under a point on screen, on whichever face of the dirt is toward the camera.
  pickCell(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const zFace = this.camera.position.z >= 0 ? D / 2 : -D / 2;
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -zFace), hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, hit)) return null;
    const x = Math.floor(hit.x + W / 2), y = Math.floor(H / 2 - hit.y);
    return { x, y, inside: x >= 0 && y >= 0 && x < W && y < H, fx: hit.x + W / 2, fy: H / 2 - hit.y };
  }
  // Screen position of a world point (null if behind the camera).
  project(x, y, z = 0) {
    const v = this.tmp.v.set(x, y, z).project(this.camera);
    if (v.z > 1) return null;
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }
  // The ant nearest a point on screen, within reach.
  pickAnt(clientX, clientY, maxPx = 18) {
    let best = null, bd = maxPx * maxPx;
    for (const a of this.farm.ants) {
      const s = this.antState.get(a.id);
      if (!s?.pos) continue;
      const p = this.project(s.pos[0], s.pos[1] + .6, s.pos[2]);
      if (!p) continue;
      const d = (p.x - clientX) ** 2 + (p.y - clientY) ** 2;
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }
  showGhost(cell, ok, size = 7) {
    this.ghost.visible = !!cell;
    if (!cell) return;
    const z = this.camera.position.z >= 0 ? D / 2 + .05 : -D / 2 - .05;
    this.ghost.position.set(wx(cell.x), wy(cell.y), z);
    this.ghost.rotation.y = z < 0 ? Math.PI : 0;
    this.ghost.scale.setScalar(size * (1 + Math.sin(performance.now() / 180) * .06));
    this.ghost.material.color.set(ok ? 0xffe27a : 0xff6a5a);
  }
}
