// The way out: real light. The last stretch of tunnel gets daylight from the mouth (rock with strata, damp and mossy
// toward the light), and outside is a wood in the morning sun: oaks, pines and birches, ferns, long grass and
// wildflowers, a few butterflies and drifting motes. All of it is drawn into its own target and added to the echo
// image, so the walk out can fade from one to the other.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TREES, CLEARING, CLIFF_X, MOUTH, groundY } from './world.js';

const SUN = new THREE.Vector3(.8, .36, .48).normalize();
const SUN_COL = new THREE.Color(1, .9, .74);
const SKY_COL = new THREE.Color(.55, .7, .95);

const NOISE = /* glsl */`
float hash13(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm3(vec3 p) { return .5 * vnoise(p) + .28 * vnoise(p * 2.07 + 7.1) + .14 * vnoise(p * 4.31 + 3.3) + .08 * vnoise(p * 8.9 + 1.7); }
`;

// Rock in daylight: strata, grit and moss, lit by the sky through the mouth inside and by the sun outside.
function litRockMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uMouth: { value: new THREE.Vector3(MOUTH.x + 2.5, MOUTH.y + .6, MOUTH.z) }, uSun: { value: SUN }, uSunCol: { value: SUN_COL }, uSky: { value: SKY_COL }, uCliff: { value: CLIFF_X } },
    vertexShader: /* glsl */`
      attribute float aAO; varying vec3 vW; varying vec3 vN; varying float vAO;
      void main() { vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vAO = aAO; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uMouth, uSun, uSunCol, uSky; uniform float uCliff;
      varying vec3 vW; varying vec3 vN; varying float vAO;
      ${NOISE}
      vec3 gradOf(vec3 q, float e) { float f0 = fbm3(q); return vec3(fbm3(q + vec3(e, 0, 0)) - f0, fbm3(q + vec3(0, e, 0)) - f0, fbm3(q + vec3(0, 0, e)) - f0) / e; }
      void main() {
        vec3 n = normalize(vN), p = vW;
        // the shape of the stone: broad lumps and fine pitting
        vec3 g1 = gradOf(p * 1.5, .08), g2 = gradOf(p * 5.5, .05);
        vec3 nb = normalize(n - .42 * (g1 - n * dot(g1, n)) - .16 * (g2 - n * dot(g2, n)));
        float lump = fbm3(p * 1.5), big = fbm3(p * .22 + 3.), grain = vnoise(p * 17.) * .55 + vnoise(p * 41.) * .45;
        vec3 rock = mix(vec3(.2, .19, .19), mix(vec3(.36, .34, .31), vec3(.47, .42, .36), smoothstep(.3, .7, big)), smoothstep(.22, .62, lump));
        rock *= .82 + .34 * grain;
        rock *= .9 + .1 * sin(p.y * 6.5 + big * 9. + lump * 2.);                                         // bedding
        rock = mix(rock, vec3(.43, .33, .22), smoothstep(.62, .78, fbm3(p * .6 + 11.)) * .45);           // iron stain
        // moss: carpets on ledges and floors near the light, creeping up the walls
        float lightish = smoothstep(uCliff - 18., uCliff + 1., p.x);
        float up = smoothstep(-.25, .55, nb.y);
        float patchy = smoothstep(.3, .62, fbm3(p * .7 + 5.) + .35 * lightish + .15 * nb.y);
        float mossy = up * patchy * lightish * smoothstep(.2, .45, lump + .15);
        vec3 moss = mix(vec3(.08, .17, .04), vec3(.27, .41, .1), smoothstep(.2, .8, grain)) * (.8 + .4 * big);
        vec3 alb = mix(rock, moss, mossy);
        // light: the sky through the mouth inside; sun and sky outside
        float inside = 1. - smoothstep(uCliff - .5, uCliff + 1.5, p.x);
        vec3 toM = uMouth - p; float dM = length(toM);
        float reach = smoothstep(181., 195., p.x);
        float sky = (max(dot(nb, toM / dM), 0.) * .85 + .15) * (exp(-dM / 3.2) * 3. + exp(-dM / 12.) * .08) * reach;
        float sun = max(dot(nb, uSun), 0.);
        vec3 hemi = mix(vec3(.16, .15, .1), uSky, nb.y * .5 + .5);
        vec3 light = mix(uSky, vec3(1., .97, .92), .6) * sky * inside * 1.2 + (uSunCol * sun * 2.6 + hemi * .9) * (1. - inside);
        float ao = mix(.3, 1., vAO) * (.75 + .25 * smoothstep(.2, .6, lump));
        gl_FragColor = vec4(alb * light * ao, 1.);
      }`,
  });
}

// A canvas texture for fern fronds: a stem with paired leaflets, alpha-cut.
function fernTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.strokeStyle = '#3d6b1f'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 256); g.lineTo(32, 4); g.stroke();
  for (let y = 250; y > 8; y -= 9) {
    const k = y / 256, len = 28 * Math.sin(k * Math.PI) ** .7 + 2;
    for (const s of [-1, 1]) {
      g.fillStyle = `hsl(${92 + Math.random() * 18}, ${45 + Math.random() * 15}%, ${26 + Math.random() * 14}%)`;
      g.beginPath(); g.moveTo(32, y); g.quadraticCurveTo(32 + s * len * .6, y - 9, 32 + s * len, y - 6); g.quadraticCurveTo(32 + s * len * .5, y - 1, 32, y + 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// Leafy cards to fuzz the edges of the tree crowns.
function leafTexture(hue) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 46; i++) {
    const x = 14 + Math.random() * 100, y = 14 + Math.random() * 100, a = Math.random() * Math.PI * 2, s = 7 + Math.random() * 9;
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = `hsl(${hue + Math.random() * 26 - 13}, ${50 + Math.random() * 25}%, ${26 + Math.random() * 28}%)`;
    g.beginPath(); g.ellipse(0, 0, s, s * .45, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// The forest floor up close: grass, clover, leaf litter and the odd bare patch. Tiled under the vertex colours.
function groundTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#7f9a55'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, l = 2 + Math.random() * 9, a = -Math.PI / 2 + (Math.random() - .5) * 1.4;
    g.strokeStyle = `hsl(${70 + Math.random() * 40}, ${35 + Math.random() * 30}%, ${22 + Math.random() * 34}%)`;
    g.lineWidth = .8 + Math.random() * 1.4;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 2 + Math.random() * 4;
    g.fillStyle = Math.random() < .5 ? `hsla(${28 + Math.random() * 20}, 45%, ${25 + Math.random() * 20}%, .8)` : `hsla(${95 + Math.random() * 25}, 50%, ${30 + Math.random() * 15}%, .9)`;
    g.beginPath(); g.ellipse(x, y, r, r * .6, Math.random() * 3, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
// Sprigs of needles to fuzz the pines' tiers.
function needleTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = '#3b2a1c'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 128); g.lineTo(32, 6); g.stroke();
  for (let y = 124; y > 6; y -= 3) {
    const len = 26 * Math.sin((y / 128) * Math.PI) ** .5;
    for (const sd of [-1, 1]) {
      g.strokeStyle = `hsl(${120 + Math.random() * 35}, ${35 + Math.random() * 25}%, ${16 + Math.random() * 22}%)`;
      g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(32, y); g.lineTo(32 + sd * len, y - 7 - Math.random() * 5); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function windy(mat, amount) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = Daylight.time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', /* glsl */`
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 wp = (instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
      #else
        vec3 wp = (modelMatrix * vec4(position, 1.)).xyz;
      #endif
      float sway = ${amount.toFixed(3)} * pow(max(position.y, 0.), 1.6);
      transformed.x += sway * (sin(uTime * 1.7 + wp.x * .4 + wp.z * .3) + .5 * sin(uTime * 3.1 + wp.z * .9));
      transformed.z += sway * .7 * sin(uTime * 1.3 + wp.x * .5 - wp.z * .2);`);
  };
  return mat;
}

let seed = 7;
const R = () => ((seed = Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5 | 0) >>> 0) / 4294967296;
const rr = (a, b) => a + R() * (b - a);

export class Daylight {
  static time = { value: 0 };
  constructor(view, { low }) {
    this.view = view; this.low = low; this.ready = false; this.built = false;
    this.rockMat = litRockMaterial();
    this.pending = [];
  }
  addRock(g) {
    const m = new THREE.Mesh(g, this.rockMat); m.matrixAutoUpdate = false;
    this.view.lit.add(m);
  }
  build() {
    if (this.built) return;
    this.built = true;
    const S = this.view.lit, low = this.low;
    S.fog = new THREE.Fog(0xb8cbc4, 45, 190);
    const sky = new Sky(); sky.scale.setScalar(1500);
    const u = sky.material.uniforms;
    u.turbidity.value = 2.2; u.rayleigh.value = 1.9; u.mieCoefficient.value = .004; u.mieDirectionalG.value = .86; u.sunPosition.value.copy(SUN);
    u.uBoost = { value: 1 };
    sky.material.fragmentShader = 'uniform float uBoost;\n' + sky.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * uBoost, 1.0 );');
    S.add(sky);
    const sun = new THREE.DirectionalLight(SUN_COL, 3.2);
    sun.position.copy(SUN).multiplyScalar(80).add(new THREE.Vector3(CLEARING.x, 0, CLEARING.z));
    sun.target.position.set(CLEARING.x, 0, CLEARING.z);
    if (!low) {
      this.view.renderer.shadowMap.enabled = true; this.view.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 10, far: 200 });
      sun.shadow.bias = -.0004; sun.shadow.normalBias = .04;
    }
    S.add(sun, sun.target);
    const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a4a22, 1.15);
    S.add(hemi);
    this.lights = { sun, hemi, sky };

    // the ground, rising into hills past the edge of the clearing
    const W = 120, H = 120, gx = 110, gz = 110;
    const gg = new THREE.PlaneGeometry(W, H, gx, gz); gg.rotateX(-Math.PI / 2);
    const gp = gg.attributes.position, col = [];
    const cx = CLIFF_X + W / 2 + .6, cz = MOUTH.z;
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i) + cx, z = gp.getZ(i) + cz, r = Math.hypot(x - CLEARING.x, z - CLEARING.z);
      const y = groundY(x, z) + smoothstep(29, 52, r) * 6 + smoothstep(46, 60, r) * 8;
      gp.setXYZ(i, x, y, z);
      const path = Math.exp(-((z - MOUTH.z - (x - CLIFF_X) * .12) ** 2) / 2.2) * smoothstep(CLIFF_X + 34, CLIFF_X + 4, x);
      const v = R();
      const c = new THREE.Color().setHSL(.22 + v * .07, .55 + v * .2, .42 + v * .14);
      c.lerp(new THREE.Color(.62, .5, .36), path * .85);
      col.push(c.r, c.g, c.b);
    }
    gg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    gg.computeVertexNormals();
    const gt = groundTexture(); gt.repeat.set(36, 36);
    const ground = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ vertexColors: true, map: gt, roughness: 1 }));
    ground.receiveShadow = true;
    S.add(ground);
    this.hAt = (x, z) => { const r = Math.hypot(x - CLEARING.x, z - CLEARING.z); return groundY(x, z) + smoothstep(29, 52, r) * 6 + smoothstep(46, 60, r) * 8; };
    this.onPath = (x, z) => Math.abs(z - MOUTH.z - (x - CLIFF_X) * .12) < 1.3 && x < CLIFF_X + 36;

    // the hillside around the mouth, beyond the part the cave mesher drew
    {
      const bg = new THREE.PlaneGeometry(150, 46, 150, 46); bg.rotateY(Math.PI / 2);
      const p = bg.attributes.position, keep = [];
      for (let i = 0; i < p.count; i++) {
        const z = p.getZ(i) + MOUTH.z, y = p.getY(i) + 19;
        const lean = Math.max(0, y - 16) * .9;
        const n = Math.sin(z * .37 + y * .21) * .5 + Math.sin(z * 1.1 - y * .7) * .25 + Math.sin(y * 1.9 + z * .3) * .15;
        p.setXYZ(i, CLIFF_X - 1.4 - lean + n, y, z);
      }
      const idx = bg.index.array, out = [];
      for (let t = 0; t < idx.length; t += 3) {
        let hole = false;
        for (let k = 0; k < 3; k++) { const v = idx[t + k]; if (Math.abs(p.getZ(v) - MOUTH.z) < 6 && p.getY(v) < 7.5) hole = true; }
        if (!hole) out.push(idx[t], idx[t + 1], idx[t + 2]);
      }
      bg.setIndex(out);
      bg.computeVertexNormals();
      bg.setAttribute('aAO', new THREE.Float32BufferAttribute(new Float32Array(p.count).fill(1), 1));
      S.add(new THREE.Mesh(bg, this.rockMat));
    }

    // trees: the ones you walk round, and a wall of them beyond the clearing
    const all = TREES.map(t => ({ ...t, y: this.hAt(t.x, t.z) }));
    for (let i = 0; i < (low ? 50 : 95); i++) {
      const a = R() * Math.PI * 2, d = rr(31, 56);
      const x = CLEARING.x + Math.cos(a) * d, z = CLEARING.z + Math.sin(a) * d;
      if (x < CLIFF_X + 2) continue;
      const kind = R() < .4 ? 'pine' : R() < .4 ? 'birch' : 'oak';
      all.push({ x, z, y: this.hAt(x, z), kind, r: kind === 'oak' ? rr(.35, .6) : kind === 'pine' ? rr(.25, .4) : rr(.15, .2), h: kind === 'pine' ? rr(13, 20) : kind === 'birch' ? rr(9, 13) : rr(8, 12), seed: R() * 1000 });
    }
    for (let i = 0; i < (low ? 26 : 50); i++) {                       // bushes round the edges and along the foot of the cliff
      const a = R() * Math.PI * 2, d = rr(13, 31);
      let x = CLEARING.x + Math.cos(a) * d, z = CLEARING.z + Math.sin(a) * d;
      if (i % 4 === 0) { x = CLIFF_X + rr(2, 5); z = MOUTH.z + (R() < .5 ? -1 : 1) * rr(5, 18); }
      if (x < CLIFF_X + 1.5 || this.onPath(x, z) || Math.hypot(x - MOUTH.x, z - MOUTH.z) < 5) continue;
      all.push({ x, z, y: this.hAt(x, z), kind: 'shrub', r: .1, h: 1.4, seed: R() * 1000 });
    }
    this.trees(all);
    this.undergrowth(all);
    this.critters();
    this.ready = true;
  }

  trees(list) {
    const S = this.view.lit;
    const bark = [], crowns = [], needles = [], cards = { oak: [], birch: [], pine: [] };
    const tmp = new THREE.Color();
    const paint = (g, fn) => { const p = g.attributes.position, c = []; for (let i = 0; i < p.count; i++) { fn(tmp, p.getX(i), p.getY(i), p.getZ(i)); c.push(tmp.r, tmp.g, tmp.b); } g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g; };
    const bump = (g, s, amt) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + amt * (Math.sin(x * 2.1 + s) * Math.sin(y * 1.7 + s * 2) * Math.sin(z * 2.3 + s * 3)); p.setXYZ(i, x * k, y * k, z * k); } return g; };
    for (const t of list) {
      seed = Math.floor(t.seed * 1000) + 3;
      const lean = [rr(-.06, .06), rr(-.06, .06)];
      const trunkH = t.kind === 'pine' ? t.h * .92 : t.h * .62;
      const tg = new THREE.CylinderGeometry(t.r * (t.kind === 'pine' ? .35 : .55), t.r, trunkH, t.kind === 'birch' ? 8 : 9, 6);
      tg.translate(0, trunkH / 2 - .3, 0);
      const tp = tg.attributes.position;
      for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) + lean[0] * y + Math.sin(y * .7 + t.seed) * .08); tp.setZ(i, tp.getZ(i) + lean[1] * y); }
      paint(tg, (c, x, y, z) => {
        if (t.kind === 'birch') { const band = Math.sin(y * 7 + Math.sin(Math.atan2(z, x) * 3) * 2) > .82; c.setRGB(.86, .85, .8).multiplyScalar(band ? .25 : .95); }
        else if (t.kind === 'pine') c.setRGB(.36, .22, .14).multiplyScalar(.8 + .3 * Math.sin(y * 9 + x * 20));
        else c.setRGB(.3, .24, .18).multiplyScalar(.75 + .35 * Math.sin(Math.atan2(z, x) * 7 + y * 2));
      });
      tg.translate(t.x, t.y, t.z);
      if (t.kind !== 'shrub') bark.push(tg);
      // branches for the broadleaves
      if (t.kind === 'oak' || t.kind === 'birch') for (let b = 0; b < 4; b++) {
        const a = R() * Math.PI * 2, len = t.h * rr(.2, .3), y0 = trunkH * rr(.55, .9);
        const bg = new THREE.CylinderGeometry(t.r * .12, t.r * .3, len, 5, 1); bg.translate(0, len / 2, 0);
        bg.rotateZ(rr(.7, 1.1)); bg.rotateY(a);
        paint(bg, c => c.setRGB(t.kind === 'birch' ? .8 : .3, t.kind === 'birch' ? .78 : .24, t.kind === 'birch' ? .74 : .18));
        bg.translate(t.x + lean[0] * y0, t.y + y0, t.z + lean[1] * y0);
        bark.push(bg);
      }
      if (t.kind === 'pine') {
        const tiers = 6 + Math.floor(R() * 3);
        for (let k = 0; k < tiers; k++) {
          const f = k / tiers, rad = ((1 - f) * t.h * .23 + .5) * rr(.85, 1.15), y = t.h * (.25 + f * .7) + rr(-.2, .2), th = t.h * .24;
          const cg = new THREE.ConeGeometry(rad, th, 11, 2);
          cg.rotateY(R() * 6);
          const p = cg.attributes.position;
          for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), yy = p.getY(i); const j = 1 + .16 * Math.sin(Math.atan2(z, x) * 11 + k * 2); if (yy < 0) { p.setX(i, x * j); p.setZ(i, z * j); p.setY(i, yy - .3 * Math.abs(Math.sin(Math.atan2(z, x) * 11))); } }
          paint(cg, (c, x, yy) => c.setHSL(.34 + R() * .05, .38 + R() * .14, .1 + .11 * (yy / th + .5) + R() * .04));
          const cx = t.x + lean[0] * y, cz = t.z + lean[1] * y;
          cg.translate(cx, t.y + y, cz);
          needles.push(cg);
          // drooping sprigs round the tier's edge, so the silhouette is feathery, not a cone
          const sprigs = this.low ? 9 : 22;
          for (let j = 0; j < sprigs; j++) {
            const phi = j / sprigs * Math.PI * 2 + R() * .5, up = R();
            cards.pine.push([cx + Math.cos(phi) * rad * (.15 + .35 * up), t.y + y - th * (.42 - .55 * up), cz + Math.sin(phi) * rad * (.15 + .35 * up), rad * rr(.9, 1.25) * (1 - .4 * up), Math.atan2(Math.cos(phi), Math.sin(phi)), rr(.2, .55) - up * .3, R() * 3]);
          }
        }
      } else {
        const shrub = t.kind === 'shrub';
        const blobs = t.kind === 'oak' ? 6 + Math.floor(R() * 3) : shrub ? 3 : 4;
        const cy = shrub ? .45 : t.h * (t.kind === 'oak' ? .66 : .72), spread = shrub ? .55 : t.kind === 'oak' ? t.h * .2 : t.h * .12;
        const hue = t.kind === 'oak' ? .27 : shrub ? .25 : .22;
        for (let k = 0; k < blobs; k++) {
          const a = k / blobs * Math.PI * 2 + R(), d = k === 0 ? 0 : spread * rr(.5, 1.1);
          const rad = shrub ? rr(.55, .85) : (t.kind === 'oak' ? t.h * .17 : t.h * .12) * rr(.75, 1.15);
          const ox = Math.cos(a) * d, oz = Math.sin(a) * d, oy = cy + (k === 0 ? spread * .6 : rr(-.4, .9) * spread);
          const bg = bump(new THREE.IcosahedronGeometry(rad, 2), t.seed + k, .16);
          bg.scale(1, .82, 1);
          paint(bg, (c, x, y) => c.setHSL(hue + R() * .04, .55 + R() * .15, (.16 + .16 * (y / rad * .5 + .5)) * (t.kind === 'birch' ? 1.25 : 1)));
          bg.translate(t.x + ox + lean[0] * oy, t.y + oy, t.z + oz + lean[1] * oy);
          crowns.push(bg);
          // leafy cards over the crown's surface
          const nCards = this.low ? 14 : 40;
          for (let j = 0; j < nCards; j++) {
            const u = R() * 2 - 1, th = R() * Math.PI * 2, s = Math.sqrt(1 - u * u);
            const px = s * Math.cos(th), py = u * .82, pz = s * Math.sin(th);
            cards[shrub ? 'oak' : t.kind].push([t.x + ox + lean[0] * oy + px * rad * 1.02, t.y + oy + py * rad * 1.02, t.z + oz + lean[1] * oy + pz * rad * 1.02, rad * rr(.5, .78), R() * Math.PI * 2, R() * Math.PI]);
          }
        }
      }
    }
    const mk = (geos, mat, cast = true) => { const g = mergeGeometries(geos.map(g => { g.deleteAttribute('uv'); return g; })); const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true; S.add(m); return m; };
    mk(bark, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 }));
    mk(crowns, windy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 }), .004));
    mk(needles, windy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 }), .003));
    for (const [kind, hue] of [['oak', 95], ['birch', 80]]) {
      const list = cards[kind];
      const geo = new THREE.PlaneGeometry(1, 1);
      const mat = windy(new THREE.MeshStandardMaterial({ map: leafTexture(hue), alphaTest: .5, side: THREE.DoubleSide, roughness: .75 }), .02);
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      list.forEach(([x, y, z, s, a, b], i) => { q.setFromEuler(e.set(b, a, 0)); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s * 2.2, s * 2.2, s * 2.2)); im.setMatrixAt(i, m4); });
      im.castShadow = true; im.receiveShadow = true;
      S.add(im);
    }
    {
      const list = cards.pine, geo = new THREE.PlaneGeometry(.5, 1); geo.translate(0, .5, 0);
      const mat = windy(new THREE.MeshStandardMaterial({ map: needleTexture(), alphaTest: .45, side: THREE.DoubleSide, roughness: .85 }), .01);
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      const m4 = new THREE.Matrix4(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
      list.forEach(([x, y, z, s, yaw, droop, roll], i) => {
        qa.setFromAxisAngle(Y, yaw).multiply(qb.setFromAxisAngle(X, Math.PI / 2 + droop)).multiply(qc.setFromAxisAngle(Y, roll));
        m4.compose(new THREE.Vector3(x, y, z), qa, new THREE.Vector3(s, s, s)); im.setMatrixAt(i, m4);
      });
      im.castShadow = true; im.receiveShadow = true;
      S.add(im);
    }
  }

  undergrowth(trees) {
    const S = this.view.lit, low = this.low;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const inClearing = (x, z) => x > CLIFF_X + 1.2 && Math.hypot(x - CLEARING.x, z - CLEARING.z) < 50;
    // long grass
    {
      // a tuft of blades, bent different ways, so each instance is a little clump
      const n = low ? 5000 : 15000, blades = [];
      for (let b = 0; b < 6; b++) {
        const h = rr(.55, 1), bg = new THREE.PlaneGeometry(.045, h, 1, 4); bg.translate(0, h / 2, 0);
        const p = bg.attributes.position, lean = rr(.08, .3), a = b / 6 * Math.PI * 2 + rr(-.4, .4);
        for (let i = 0; i < p.count; i++) { const y = p.getY(i) / h; p.setX(i, p.getX(i) * (1 - y * .9)); p.setZ(i, y * y * lean * h); }
        bg.rotateY(a); bg.translate(Math.cos(a) * .05, 0, Math.sin(a) * .05);
        bg.deleteAttribute('uv'); blades.push(bg);
      }
      const g = mergeGeometries(blades);
      const mat = windy(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .85 }), .16);
      mat.onBeforeCompile = ((prev) => sh => { prev(sh); sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb *= .38 + .85 * clamp(position.y, 0., 1.);'); })(mat.onBeforeCompile);
      const im = new THREE.InstancedMesh(g, mat, n);
      const c = new THREE.Color();
      let k = 0;
      for (let tries = 0; k < n && tries < n * 3; tries++) {
        const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 46;
        const x = CLEARING.x - 4 + Math.cos(a) * d, z = CLEARING.z + Math.sin(a) * d;
        if (!inClearing(x, z)) continue;
        const pathy = this.onPath(x, z);
        if (pathy && R() < .93) continue;
        const lush = .55 + .45 * Math.sin(x * .31) * Math.cos(z * .27);
        const h = rr(.3, .65) * (pathy ? .45 : 1) * (.55 + .7 * lush);
        q.setFromEuler(e.set(rr(-.12, .12), R() * Math.PI * 2, rr(-.12, .12)));
        m4.compose(v.set(x, this.hAt(x, z) - .02, z), q, sc.set(rr(.8, 1.5), h, rr(.8, 1.5)));
        im.setMatrixAt(k, m4);
        im.setColorAt(k, c.setHSL(.19 + R() * .08 - lush * .02, .5 + R() * .25, .3 + R() * .16));
        k++;
      }
      im.count = k; im.receiveShadow = true;
      S.add(im);
    }
    // wildflowers, in clumps
    {
      const n = low ? 700 : 1800;
      const stem = new THREE.CylinderGeometry(.008, .012, .4, 4); stem.translate(0, .2, 0);
      const head = new THREE.IcosahedronGeometry(.055, 1); head.scale(1, .6, 1); head.translate(0, .41, 0);
      const stems = new THREE.InstancedMesh(stem, windy(new THREE.MeshStandardMaterial({ color: 0x3f6a22, roughness: .9 }), .2), n);
      const heads = new THREE.InstancedMesh(head, windy(new THREE.MeshStandardMaterial({ roughness: .55, emissive: 0x111111 }), .2), n);
      const palette = [[.78, .7, .62], [.14, .9, .58], [0, 0, .95], [.95, .75, .62], [.6, .55, .7], [.08, .85, .6], [.55, .6, .72]];
      const c = new THREE.Color();
      let k = 0;
      while (k < n) {
        const a = R() * Math.PI * 2, d = 5 + Math.sqrt(R()) * 34, x0 = CLEARING.x - 6 + Math.cos(a) * d, z0 = CLEARING.z + Math.sin(a) * d;
        if (!inClearing(x0, z0) || this.onPath(x0, z0)) continue;
        const [h, s, l] = palette[Math.floor(R() * palette.length)];
        const m = 6 + Math.floor(R() * 18);
        for (let j = 0; j < m && k < n; j++) {
          const x = x0 + rr(-1.6, 1.6), z = z0 + rr(-1.6, 1.6);
          if (!inClearing(x, z) || this.onPath(x, z)) continue;
          const s2 = rr(.7, 1.6);
          m4.compose(v.set(x, this.hAt(x, z) - .02, z), q.setFromEuler(e.set(rr(-.2, .2), R() * 6, rr(-.2, .2))), sc.set(s2, s2 * rr(.8, 1.4), s2));
          stems.setMatrixAt(k, m4); heads.setMatrixAt(k, m4);
          heads.setColorAt(k, c.setHSL(h + rr(-.02, .02), s, l * rr(.85, 1.05) * .7));
          k++;
        }
      }
      S.add(stems, heads);
    }
    // ferns round the tree feet and along the foot of the cliff
    {
      const tex = fernTexture();
      const g = new THREE.PlaneGeometry(.32, 1.15, 1, 6); g.translate(0, .575, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, -(y * y) * .45); p.setY(i, y * .85); }
      g.rotateX(-.5);
      const mat = windy(new THREE.MeshStandardMaterial({ map: tex, alphaTest: .45, side: THREE.DoubleSide, roughness: .85 }), .08);
      const spots = [];
      for (const t of trees) if (Math.hypot(t.x - CLEARING.x, t.z - CLEARING.z) < 40 && R() < .8) spots.push([t.x + rr(-1.5, 1.5), t.z + rr(-1.5, 1.5)]);
      for (let i = 0; i < 40; i++) spots.push([CLIFF_X + rr(1.5, 4), MOUTH.z + (R() < .5 ? -1 : 1) * rr(3.5, 20)]);
      for (let i = 0; i < 70; i++) { const a = R() * Math.PI * 2, d = rr(8, 30); spots.push([CLEARING.x + Math.cos(a) * d, CLEARING.z + Math.sin(a) * d]); }
      const fr = 7, im = new THREE.InstancedMesh(g, mat, spots.length * fr);
      let k = 0;
      for (const [x, z] of spots) {
        if (!inClearing(x, z) || this.onPath(x, z)) continue;
        const s = rr(.8, 1.5), y = this.hAt(x, z) - .05;
        for (let j = 0; j < fr; j++) {
          m4.compose(v.set(x, y, z), q.setFromEuler(e.set(0, j / fr * Math.PI * 2 + rr(-.2, .2), 0, 'YXZ')), sc.set(s, s * rr(.8, 1.2), s));
          im.setMatrixAt(k++, m4);
        }
      }
      im.count = k; im.castShadow = !low; im.receiveShadow = true;
      S.add(im);
    }
    // a few mossy boulders
    {
      const geos = [];
      for (let i = 0; i < 14; i++) {
        const a = R() * Math.PI * 2, d = rr(6, 27), x = CLEARING.x + Math.cos(a) * d, z = CLEARING.z + Math.sin(a) * d;
        if (!inClearing(x, z) || this.onPath(x, z)) continue;
        const r = rr(.4, 1.2), g = new THREE.IcosahedronGeometry(r, 2), p = g.attributes.position, col = [];
        for (let j = 0; j < p.count; j++) {
          const X = p.getX(j), Y = p.getY(j), Z = p.getZ(j), k = 1 + .18 * Math.sin(X * 4 + i) * Math.sin(Y * 3 + i) * Math.sin(Z * 5);
          p.setXYZ(j, X * k, Y * k * .7, Z * k);
          const moss = Y / r > .1 + .2 * Math.sin(X * 6 + Z * 4);
          const c = moss ? new THREE.Color().setHSL(.23 + R() * .04, .5, .2 + R() * .06) : new THREE.Color().setHSL(.08, .06, .3 + R() * .08);
          col.push(c.r, c.g, c.b);
        }
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.computeVertexNormals(); g.deleteAttribute('uv');
        g.translate(x, this.hAt(x, z) + r * .2, z);
        geos.push(g);
      }
      const m = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 }));
      m.castShadow = m.receiveShadow = true;
      S.add(m);
    }
  }

  critters() {
    const S = this.view.lit;
    // butterflies: two wings each, flapping along lazy loops
    this.flies = [];
    const wing = new THREE.PlaneGeometry(.14, .1); wing.translate(.07, 0, 0); wing.rotateX(-Math.PI / 2);
    const cols = [0xffb02e, 0xffffff, 0x8ec5ff, 0xffe25a, 0xff7a3d];
    for (let i = 0; i < 9; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, roughness: .6, emissive: cols[i % cols.length], emissiveIntensity: .15 });
      const g = new THREE.Group(), l = new THREE.Mesh(wing, mat), r = new THREE.Mesh(wing, mat);
      r.scale.x = -1; g.add(l, r); S.add(g);
      this.flies.push({ g, l, r, c: [CLEARING.x - 10 + rr(-8, 14), CLEARING.z + rr(-14, 14)], a: R() * 6, s: rr(.25, .5), rad: rr(1.5, 4), ph: R() * 6 });
    }
    // motes in the sun
    const n = 260, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = CLIFF_X + rr(-6, 26); pos[i * 3 + 1] = rr(0, 7); pos[i * 3 + 2] = MOUTH.z + rr(-12, 12); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xfff3d0, size: .045, transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending }));
    S.add(this.motes);
    this.moteBase = pos.slice();
  }

  // `glare` 1: eyes still used to the dark, so everything outside is overdriven to white; 0: daylight as it is.
  update(t, dt, glare = 0) {
    Daylight.time.value = t;
    if (!this.built) return;
    const k = 1 + 5 * glare;
    this.lights.sun.intensity = 3.2 * k; this.lights.hemi.intensity = 1.15 * k; this.lights.sky.material.uniforms.uBoost.value = k;
    for (const f of this.flies) {
      f.a += dt * f.s;
      const x = f.c[0] + Math.cos(f.a) * f.rad + Math.sin(f.a * 2.3) * .6, z = f.c[1] + Math.sin(f.a * 1.3) * f.rad;
      f.g.position.set(x, this.hAt(x, z) + .7 + Math.sin(f.a * 3.1 + f.ph) * .35, z);
      f.g.rotation.y = -f.a + Math.PI / 2;
      const flap = Math.sin(t * 18 + f.ph) * .9;
      f.l.rotation.z = flap; f.r.rotation.z = -flap;
    }
    const p = this.motes.geometry.attributes.position, b = this.moteBase;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(i, b[i * 3] + Math.sin(t * .21 + i) * .6, b[i * 3 + 1] + Math.sin(t * .13 + i * 1.7) * .5, b[i * 3 + 2] + Math.cos(t * .17 + i * .7) * .6);
    }
    p.needsUpdate = true;
  }
}
function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
