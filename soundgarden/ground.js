// The ground: one big plane whose shader mixes lawn, gravel, bed soil, woodchip, leaf litter and raked gravel by
// reading two mask textures painted from the plan. Grass blades grow on top wherever the mask says lawn.
import * as THREE from 'three';
import * as L from './layout.js';
import { U, DETAIL, WIND_GLSL, TAU } from './common.js';
import * as T from './textures.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const EXTENT = 28.5;                  // the masks cover [-EXTENT, EXTENT]² in x and z
const MS = 1024, PX = MS / (2 * EXTENT);     // mask size, pixels per metre

// Stepping stones: where each stone of a 'stones' path goes. Shared with the builders so the grass keeps clear of them.
export function stepStones(p) {
  const out = [], R = L.mulberry(Math.round(p.pts[0][0] * 100 + p.pts[0][1] * 7));
  let carry = .35;
  for (let i = 1; i < p.pts.length; i++) {
    const [ax, az] = p.pts[i - 1], [bx, bz] = p.pts[i], len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
    for (let s = carry; s < len; s += .62 + R() * .1) {
      const side = (R() - .5) * .16;
      out.push({ x: ax + dx * s - dz * side, z: az + dz * s + dx * side, r: p.w * (.42 + R() * .1), rot: R() * TAU, seed: out.length + 1 + i * 17 });
      carry = s + .68 - len;
    }
    carry = Math.max(0, carry);
  }
  return out;
}

/* ---------- masks ---------- */
// A: gravel, bed soil, leaf litter, woodchip · B: covered (no grass), meadow, raked gravel, spare
function paintMasks() {
  const [c, g] = T.canvas(MS), A = new Uint8Array(MS * MS * 4), B = new Uint8Array(MS * MS * 4);
  const tx = x => (x + EXTENT) * PX;
  const poly = pts => { g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(tx(x), tx(z)) : g.moveTo(tx(x), tx(z))); g.closePath(); g.fill(); };
  const line = (pts, w) => { g.lineWidth = w * PX; g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(tx(x), tx(z)) : g.moveTo(tx(x), tx(z))); g.stroke(); };
  const disc = (x, z, r) => { g.beginPath(); g.arc(tx(x), tx(z), r * PX, 0, TAU); g.fill(); };
  const rectm = (x0, z0, x1, z1) => g.fillRect(tx(x0), tx(z0), (x1 - x0) * PX, (z1 - z0) * PX);
  const channel = (paint, into, k, blur = 1.6) => {
    g.filter = 'none'; g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000'; g.fillRect(0, 0, MS, MS);
    g.fillStyle = g.strokeStyle = '#fff'; g.lineCap = g.lineJoin = 'round';
    paint();
    if (blur) { g.filter = `blur(${blur}px)`; g.drawImage(c, 0, 0); g.filter = 'none'; }
    const d = g.getImageData(0, 0, MS, MS).data;
    for (let i = 0; i < MS * MS; i++) into[i * 4 + k] = d[i * 4];
  };
  const hedgeFoot = h => h.y0 < 1 && rectm(h.x0 - .2, h.z0 - .2, h.x1 + .2, h.z1 + .2);
  channel(() => { for (const p of L.PATHS) if (p.kind === 'gravel') line(p.pts, p.w); }, A, 0, 1.2);
  channel(() => {
    for (const b of L.BEDS) if (b.kind === 'soil') poly(b.pts);
    for (const h of L.HEDGES) hedgeFoot(h);
    for (const t of L.TREES) if (t.kind !== 'olive' && t.kind !== 'lemon') disc(t.x, t.z, t.kind === 'willow' ? 1.1 : .6);
  }, A, 1, 2.2);
  channel(() => { for (const b of L.BEDS) if (b.kind === 'litter') poly(b.pts); }, A, 2, 6);
  channel(() => { for (const p of L.PATHS) if (p.kind === 'bark') line(p.pts, p.w); }, A, 3, 1.6);
  channel(() => {
    for (const h of L.HEDGES) hedgeFoot(h);
    disc(L.CHAIR.x, L.CHAIR.z, L.PLATFORM.step + .05);
    g.beginPath(); for (let i = 0; i <= 64; i++) { const [x, z] = L.pondEdge(i / 64 * TAU, .5); i ? g.lineTo(tx(x), tx(z)) : g.moveTo(tx(x), tx(z)); } g.fill();
    for (const p of L.PATHS) if (p.kind === 'brick') line(p.pts, p.w + .1);
    for (const p of L.PATHS) if (p.kind === 'stones') for (const s of stepStones(p)) disc(s.x, s.z, s.r + .06);
    for (const p of L.PROPS) {
      if (p.kind === 'terrace') rectm(p.x0 - .05, p.z0 - .05, p.x1 + .05, p.z1 + .05);
      if (p.kind === 'rock') disc(p.x, p.z, p.r * 1.05);
      if (p.kind === 'basin') disc(p.x, p.z, .75);
      if (p.kind === 'sundial') disc(p.x, p.z, 1.7);
      if (p.kind === 'hive' || p.kind === 'pot' || p.kind === 'birdbath') disc(p.x, p.z, .45);
    }
    for (const b of L.BEDS) if (b.raised) poly(b.pts);
    for (const s of L.SPEAKERS) if (s.kind === 'stump' || s.kind === 'rock' || s.kind === 'lantern') disc(s.x, s.z, .55);
    rectm(-1.2, L.HALF - 1, 1.2, L.HALF + 1);                        // the gate's threshold
  }, B, 0, 1.2);
  channel(() => {
    for (const b of L.BEDS) if (b.kind === 'meadow') poly(b.pts);
    g.fillStyle = g.strokeStyle = '#000';
    for (const p of L.PATHS) if (p.kind === 'mown') line(p.pts, p.w);
    for (const t of L.TREES) if (t.kind === 'cherry') disc(t.x, t.z, .7);
    for (const p of L.PROPS) if (p.kind === 'hive') disc(p.x, p.z, .9);
  }, B, 1, 3);
  channel(() => { for (const b of L.BEDS) if (b.kind === 'zen') poly(b.pts); }, B, 2, 1);
  const mk = data => { const t = new THREE.DataTexture(data, MS, MS, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t; };
  return { A: mk(A), B: mk(B), dataA: A, dataB: B };
}

/* ---------- ground plane ---------- */
const MASK_GLSL = /* glsl */`
uniform sampler2D uMaskA, uMaskB;
vec4 maskA(vec2 xz) { vec2 uv = (xz + ${EXTENT.toFixed(1)}) / ${(2 * EXTENT).toFixed(1)}; return (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? vec4(0.0) : texture2D(uMaskA, uv); }
vec4 maskB(vec2 xz) { vec2 uv = (xz + ${EXTENT.toFixed(1)}) / ${(2 * EXTENT).toFixed(1)}; return (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? vec4(0.0) : texture2D(uMaskB, uv); }
float inGarden(vec2 xz) { return step(max(abs(xz.x), abs(xz.y)), ${(L.HALF + .9).toFixed(1)}); }
`;
const NOISE_GLSL = /* glsl */`
float gh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }
float gfbm(vec2 p) { return gn(p) * .5 + gn(p * 2.07 + 3.1) * .25 + gn(p * 4.13 + 7.7) * .125 + gn(p * 8.3 + 1.3) * .0625; }
`;
function groundMaterial(masks) {
  const lawn = T.lawn(), gr = T.gravel(), soil = T.soil(), ch = T.chips(), lit = T.litter(), zen = gr;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, metalness: 0 });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uMaskA: { value: masks.A }, uMaskB: { value: masks.B }, uLawn: { value: lawn }, uGravel: { value: gr.map }, uGravelN: { value: gr.normal }, uGravelH: { value: gr.height },
      uSoil: { value: soil }, uChips: { value: ch.map }, uChipsN: { value: ch.normal }, uLitter: { value: lit }, uZen: { value: zen.map }, uZenN: { value: zen.normal } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vW;
      uniform sampler2D uLawn, uGravel, uGravelN, uGravelH, uSoil, uChips, uChipsN, uLitter, uZen, uZenN;
      ${MASK_GLSL}${NOISE_GLSL}
      vec3 gN; float gRough;
      // raked gravel: rings round each rock, straight lines elsewhere
      float rake(vec2 p) {
        float d = 99.0;
        ${L.PROPS.filter(p => p.kind === 'rock').map(p => `d = min(d, length(p - vec2(${p.x.toFixed(2)}, ${p.z.toFixed(2)})) - ${(p.r * 1.25).toFixed(2)});`).join('\n')}
        float rings = sin(max(d, 0.0) * 52.0), lines = sin(p.y * 52.0 + gn(p * .4) * 1.5);
        return mix(rings, lines, smoothstep(1.4, 2.0, d));
      }`)
      .replace('#include <map_fragment>', `
        vec2 xz = vW.xz;
        vec4 ma = maskA(xz), mb = maskB(xz);
        float edge = (gfbm(xz * 3.1) - .5) * .5;                 // ragged edges where lawn meets path
        float wGr = smoothstep(.3, .7, ma.r + edge), wSo = smoothstep(.25, .75, ma.g + edge * .8), wLi = smoothstep(.2, .8, ma.b + edge);
        float wCh = smoothstep(.3, .7, ma.a + edge), wCo = mb.r, wZe = smoothstep(.4, .6, mb.b);
        float big = gfbm(xz * .09), mid = gfbm(xz * .5 + 11.0);
        // lawn: mottled, with mowing stripes inside the garden
        vec3 lawnC = texture2D(uLawn, xz / 2.3).rgb * (.8 + .32 * big) * mix(vec3(1.0), vec3(1.07, 1.02, .9), smoothstep(.55, .8, mid));
        float stripe = smoothstep(.35, .65, abs(fract(xz.x / 3.4) * 2.0 - 1.0));
        lawnC *= mix(1.0, .9 + .16 * stripe, inGarden(xz) * (1.0 - mb.g));
        lawnC = mix(lawnC, lawnC * vec3(1.12, 1.06, .8), mb.g * .6);   // the meadow floor is drier
        vec3 outside = texture2D(uLawn, xz / 3.1).rgb * (.72 + .45 * big) * vec3(1.02, 1.0, .86);
        vec3 c = mix(outside, lawnC, inGarden(xz));
        vec3 gN0 = vec3(0.0, 0.0, 1.0);
        // parallax: the stones stand a centimetre proud of the grit, so the texture slides with your viewpoint
        vec3 eyeV = normalize(cameraPosition - vW);
        vec2 par = -eyeV.xz / max(eyeV.y, .3) * .016;
        vec2 grUV = (xz + par * (texture2D(uGravelH, xz / 1.15).r - .45)) / 1.15;
        vec2 zeUV = (xz + par * .5 * (texture2D(uGravelH, xz / .45).r - .45)) / .45;
        vec3 grC = texture2D(uGravel, grUV).rgb * vec3(.92, .88, .8) * (.9 + .12 * mid);
        vec3 soC = texture2D(uSoil, xz / 1.1).rgb * (.85 + .3 * mid);
        vec3 liC = texture2D(uLitter, xz / 2.2).rgb;
        vec3 chC = texture2D(uChips, xz / 1.25).rgb;
        vec3 zeC = mix(texture2D(uZen, zeUV).rgb, vec3(.62), .45) * vec3(.97, .97, .99) * 1.18;
        float rk = 0.0; vec2 rg = vec2(0.0);
        if (wZe > .01) {                                          // raked ridges, lit on one side and shaded on the other
          rk = rake(xz);
          rg = vec2(rake(xz + vec2(.008, 0.0)) - rk, rake(xz + vec2(0.0, .008)) - rk) / .008 * .012;
          zeC *= .84 + .2 * (rk * .5 + .5);
        }
        c = mix(c, liC, wLi); c = mix(c, soC, max(wSo, wCo * .8)); c = mix(c, grC, wGr); c = mix(c, chC, wCh); c = mix(c, zeC, wZe);
        gRough = mix(mix(.96, .88, wGr), .92, wZe);
        vec3 nG = texture2D(uGravelN, grUV).xyz * 2.0 - 1.0, nC = texture2D(uChipsN, xz / 1.25).xyz * 2.0 - 1.0, nZ = texture2D(uZenN, zeUV).xyz * 2.0 - 1.0;
        nZ = normalize(vec3(nZ.xy * .35 - vec2(rg.x, -rg.y) * 1.6, 1.0));
        gN = normalize(mix(mix(mix(gN0, nG, wGr), nC, wCh), normalize(nZ), wZe));
        diffuseColor.rgb *= c;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRough;')
      .replace('#include <normal_fragment_maps>', `{
          vec3 wn = normalize(vec3(gN.x, gN.z, -gN.y));
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
        }`);
  };
  return mat;
}

/* ---------- grass ---------- */
// A patch of blades that follows the walker around: each blade is drawn at the copy of its spot nearest the camera,
// so the patch never runs out. The mask decides whether a blade is on lawn; the wind and your feet bend it.
function bladeGeometry(fine) {
  const pos = [], idx = [], uv = [];
  const rows = fine ? [[0, 1], [.3, .9], [.6, .68], [.84, .38], [1, 0]] : [[0, 1], [.5, .72], [1, 0]];
  rows.forEach(([y, w], i) => {
    if (w > 0) { pos.push(-w / 2, y, 0, w / 2, y, 0); uv.push(0, y, 1, y); }
    else { pos.push(0, y, 0); uv.push(.5, y); }
  });
  const quads = rows.length - 2;
  for (let i = 0; i < quads; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  idx.push(quads * 2, quads * 2 + 1, quads * 2 + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => i % 3 === 2 ? 1 : 0), 3));
  g.setIndex(idx);
  return g;
}
function grassLayer(masks, { count, tile, radius, h, w, bend, meadow = false, seed, dark = 1, fine = false }) {
  const base = bladeGeometry(fine), g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv; g.attributes.normal = base.attributes.normal;
  const R = L.mulberry(seed), off = new Float32Array(count * 4), par = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    off[i * 4] = R() * tile; off[i * 4 + 1] = R() * tile; off[i * 4 + 2] = R() * TAU; off[i * 4 + 3] = R();
    par[i * 4] = h[0] + (h[1] - h[0]) * R() ** 1.3; par[i * 4 + 1] = w[0] + (w[1] - w[0]) * R(); par[i * 4 + 2] = bend * (.4 + R() * .9); par[i * 4 + 3] = R();
  }
  g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4)); g.setAttribute('aPar', new THREE.InstancedBufferAttribute(par, 4));
  g.instanceCount = count;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const uFocus = { value: new THREE.Vector3() }, uFeet = { value: new THREE.Vector3(0, -99, 0) };
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uMaskA: { value: masks.A }, uMaskB: { value: masks.B }, uFocus, uFeet, uTime: U.uTime, uGust: U.uGust, uWindDir: U.uWindDir, uSunDir: U.uSunDir, uSunCol: U.uSunCol });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        attribute vec4 aOff, aPar;
        uniform vec3 uFocus, uFeet;
        varying vec3 vGrass; varying float vTip;
        ${MASK_GLSL}${NOISE_GLSL}${WIND_GLSL}`)
      .replace('#include <beginnormal_vertex>', `
        vec2 home = aOff.xy + ${tile.toFixed(2)} * floor((uFocus.xz - aOff.xy) / ${tile.toFixed(2)} + .5);
        vec4 ma = maskA(home), mb = maskB(home);
        float here = ${meadow ? 'smoothstep(.35, .7, mb.g)' : '(1.0 - smoothstep(.42, .62, max(max(ma.r, ma.g), max(ma.a, max(mb.r, mb.b))) + ma.b * .5)) * mix(1.0, .8, mb.g)'};
        here *= 1.0 - smoothstep(${(radius * .72).toFixed(2)}, ${radius.toFixed(2)}, distance(home, uFocus.xz));
        float patchy = gfbm(home * .7 + 3.0);
        float hgt = aPar.x * (.7 + .6 * patchy) * here * ${meadow ? '1.0' : 'mix(1.0, 1.8, step(1.0, max(abs(home.x), abs(home.y)) / ' + (L.HALF + 1) + '.0))'};
        vec3 objectNormal = normalize(vec3(0.0, 1.0, 0.0) + vec3(sin(aOff.z), 0.0, cos(aOff.z)) * .35);`)
      .replace('#include <begin_vertex>', `
        float t = position.y;
        vec3 transformed = vec3(position.x * aPar.y * step(.001, here), 0.0, 0.0);
        float c = cos(aOff.z), s = sin(aOff.z);
        vec2 lean = vec2(s, c) * aPar.z * t * t;                  // blades arch over as they grow
        transformed.xz = mat2(c, -s, s, c) * transformed.xz;
        transformed.y = t * hgt;
        transformed.xz += lean * hgt;
        vec3 wp = vec3(home.x, 0.0, home.y) + transformed;
        wp += windAt(wp, t * t * hgt * ${meadow ? '1.6' : '.38'}, 1.0);
        vec2 away = wp.xz - uFeet.xz; float fd = length(away);     // parted by passing feet
        wp.xz += away / max(fd, 1e-3) * smoothstep(.55, .0, fd) * t * hgt * .9 * step(uFeet.y, 5.0);
        transformed = wp;
        float tone = gh(home * 3.1 + aOff.w) * .3 + patchy * .2;
        vec3 root = vec3(.035, .06, .012) * ${dark.toFixed(2)}, tip = mix(vec3(.13, .21, .04), vec3(.2, .24, .06), tone + mb.g * .6) * (.85 + aPar.w * .3);
        ${meadow ? 'tip = mix(tip, vec3(.3, .26, .09), smoothstep(.6, 1.0, aPar.w) * .8);' : 'tip *= mix(1.0, .9 + .16 * smoothstep(.35, .65, abs(fract(home.x / 3.4) * 2.0 - 1.0)), step(max(abs(home.x), abs(home.y)), ' + (L.HALF + .9).toFixed(1) + '));'}
        vGrass = mix(root, tip, smoothstep(0.0, .85, t)); vTip = t;`)
      .replace('#include <project_vertex>', 'vec4 mvPosition = viewMatrix * vec4(transformed, 1.0); gl_Position = projectionMatrix * mvPosition;')
      .replace('#include <worldpos_vertex>', 'vec4 worldPosition = vec4(transformed, 1.0);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGrass; varying float vTip;\nuniform vec3 uSunDir, uSunCol;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= vGrass;')
      .replace('#include <normal_fragment_begin>', 'vec3 normal = normalize(vNormal); vec3 nonPerturbedNormal = normal; float faceDirection = 1.0;')
      .replace('#include <opaque_fragment>', `{
          vec3 sv = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
          float back = pow(max(dot(-normalize(vViewPosition), sv), 0.0), 4.0);
          outgoingLight += vGrass * uSunCol * back * vTip * 1.1;
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `grass${meadow}${tile}`;
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.receiveShadow = true;
  mesh.userData = { uFocus, uFeet };
  return mesh;
}

/* ---------- pebbles ---------- */
// The biggest stones on the gravel paths, in 3D, in a patch round the walker: they catch the low sun and give the
// paths depth underfoot. Placed like the grass, but only where the mask says gravel.
function pebbleLayer(masks, { count, tile, radius, seed }) {
  const base = mergeVertices(new THREE.IcosahedronGeometry(1, 0).deleteAttribute('normal').deleteAttribute('uv'));
  base.computeVertexNormals();
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.normal = base.attributes.normal;
  const R = L.mulberry(seed), off = new Float32Array(count * 4), par = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    off.set([R() * tile, R() * tile, R() * TAU, R()], i * 4);
    par.set([.008 + R() ** 2.4 * .017, .42 + R() * .28, R(), .7 + R() * .6], i * 4);
  }
  g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4)); g.setAttribute('aPar', new THREE.InstancedBufferAttribute(par, 4));
  g.instanceCount = count;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const uFocus = { value: new THREE.Vector3() };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .82 });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uMaskA: { value: masks.A }, uMaskB: { value: masks.B }, uFocus });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        attribute vec4 aOff, aPar;
        uniform vec3 uFocus;
        varying vec3 vPeb;
        ${MASK_GLSL}`)
      .replace('#include <beginnormal_vertex>', `
        vec2 home = aOff.xy + ${tile.toFixed(2)} * floor((uFocus.xz - aOff.xy) / ${tile.toFixed(2)} + .5);
        float here = smoothstep(.62, .85, maskA(home).r) * (1.0 - smoothstep(${(radius * .6).toFixed(2)}, ${radius.toFixed(2)}, distance(home, uFocus.xz)));
        float c = cos(aOff.z), s = sin(aOff.z);
        vec3 objectNormal = normal; objectNormal.xz = mat2(c, -s, s, c) * objectNormal.xz;`)
      .replace('#include <begin_vertex>', `
        float sz = aPar.x * here;
        vec3 transformed = position * vec3(sz * aPar.w, sz * aPar.y, sz);
        transformed.xz = mat2(c, -s, s, c) * transformed.xz;
        transformed += vec3(home.x, sz * aPar.y * .25, home.y);
        vPeb = mix(mix(vec3(.2, .165, .115), vec3(.27, .23, .17), aPar.z), vec3(.2, .185, .16), step(.8, aOff.w));`)
      .replace('#include <project_vertex>', 'vec4 mvPosition = viewMatrix * vec4(transformed, 1.0); gl_Position = projectionMatrix * mvPosition;')
      .replace('#include <worldpos_vertex>', 'vec4 worldPosition = vec4(transformed, 1.0);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPeb;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= vPeb;');
  };
  mat.customProgramCacheKey = () => 'pebbles';
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.receiveShadow = true;
  mesh.userData = { uFocus };
  return mesh;
}

/* ---------- build ---------- */
export function buildGround(scene) {
  const masks = paintMasks();
  // The ground, with the pond cut out of it.
  const outer = new THREE.Shape([[-240, -240], [240, -240], [240, 240], [-240, 240]].map(([x, z]) => new THREE.Vector2(x, -z)));
  outer.holes.push(new THREE.Path(Array.from({ length: 96 }, (_, i) => { const [x, z] = L.pondEdge(-i / 96 * TAU, .05); return new THREE.Vector2(x, -z); })));
  const geo = new THREE.ShapeGeometry(outer, 1);
  geo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(geo, groundMaterial(masks));
  ground.receiveShadow = true;
  scene.add(ground);

  // The country beyond: low hills of fields and woods fading into the haze. Only seen from above, or between trees.
  {
    const na = 160, nr = 26, pos = [], col = [], idx = [], n = T.noise2(12);
    const field = [new THREE.Color('#7c9a4a'), new THREE.Color('#9aab5a'), new THREE.Color('#6d8a3e'), new THREE.Color('#a8a860')], wood = new THREE.Color('#2f4a24');
    for (let j = 0; j <= nr; j++) for (let i = 0; i <= na; i++) {
      const a = i / na * TAU, r = 85 + 560 * (j / nr) ** 1.35, u = i / na, v = j / nr;
      const hill = (.5 + .5 * Math.sin(a * 3 + 1.3)) * (.6 + .4 * Math.sin(a * 7 + .4)) * 38 + n.fbm(u, v * .5, 8, 4) * 30;
      const y = hill * THREE.MathUtils.smoothstep(r, 95, 330) - 1.5;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      const w = n.fbm(u + .31, v + .17, 16, 3), c = field[(Math.floor(u * 40) + Math.floor(v * 9) * 7) % 4].clone();
      c.lerp(wood, THREE.MathUtils.smoothstep(w, .52, .6));
      col.push(c.r, c.g, c.b);
    }
    for (let j = 0; j < nr; j++) for (let i = 0; i < na; i++) { const a = j * (na + 1) + i, b = a + na + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); hg.setIndex(idx); hg.computeVertexNormals();
    const hills = new THREE.Mesh(hg, new THREE.MeshLambertMaterial({ vertexColors: true }));
    hills.receiveShadow = false; scene.add(hills);
  }

  const layers = [
    grassLayer(masks, { count: Math.round(64000 * DETAIL), tile: 15, radius: 7.5, h: [.05, .11], w: [.012, .02], bend: .25, seed: 1, fine: true }),
    grassLayer(masks, { count: Math.round(72000 * DETAIL), tile: 44, radius: 22, h: [.06, .12], w: [.024, .036], bend: .2, seed: 2 }),
    grassLayer(masks, { count: Math.round(52000 * DETAIL), tile: 26, radius: 13, h: [.32, .78], w: [.012, .022], bend: .35, meadow: true, seed: 3, dark: .9 }),
  ];
  const pebbles = pebbleLayer(masks, { count: Math.round(10000 * DETAIL), tile: 12, radius: 6, seed: 4 });
  layers.push(pebbles);
  for (const m of layers) scene.add(m);

  // What's underfoot at (x, z), for footsteps.
  function surface(x, z) {
    const u = Math.round((x + EXTENT) * PX), v = Math.round((z + EXTENT) * PX);
    if (u < 0 || v < 0 || u >= MS || v >= MS) return 'grass';
    const i = (v * MS + u) * 4, A = masks.dataA, B = masks.dataB;
    if (A[i] > 120) return 'gravel';
    if (A[i + 3] > 120) return 'bark';
    if (B[i + 2] > 120) return 'gravel';
    if (A[i + 2] > 120) return 'leaves';
    return 'grass';
  }
  return {
    masks, surface,
    update(focus, feet) { for (const m of layers) { m.userData.uFocus.value.copy(focus); m.userData.uFeet?.value.copy(feet); } },
  };
}
