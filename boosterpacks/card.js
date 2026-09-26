// A trading card in 3D: a thin rounded slab 6.3 × 8.8 units, printed front and back, with a shader for the foils.
// The holo rainbow, glitter and glare all depend on the angle you see the card from, so tilting a card makes it shine.
import * as THREE from 'three';

export const CARD_W = 6.3, CARD_H = 8.8, CARD_T = .035, CARD_R = .32;

function roundRectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

// One geometry for every card: groups 0 front, 1 back, 2 edge.
function cardGeometry() {
  const shape = roundRectShape(CARD_W, CARD_H, CARD_R);
  const face = new THREE.ShapeGeometry(shape, 10).toNonIndexed();
  const pos = face.attributes.position, uv = face.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / CARD_W + .5, pos.getY(i) / CARD_H + .5);
  const front = face.clone(); front.translate(0, 0, CARD_T / 2);
  const back = face.clone(); back.rotateY(Math.PI); back.translate(0, 0, -CARD_T / 2);   // turned over, so it reads right from behind
  // the edge: a strip around the outline
  const outline = shape.extractPoints(10).shape, P = [], N = [], U = [];
  const zf = CARD_T / 2, zb = -CARD_T / 2;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
    if (l < 1e-6) continue;
    const nx = dy / l, ny = -dx / l;
    P.push(a.x, a.y, zf, a.x, a.y, zb, b.x, b.y, zb, a.x, a.y, zf, b.x, b.y, zb, b.x, b.y, zf);
    for (let k = 0; k < 6; k++) { N.push(nx, ny, 0); U.push(0, 0); }
  }
  const parts = [
    [front.attributes.position.array, front.attributes.normal.array, front.attributes.uv.array],
    [back.attributes.position.array, back.attributes.normal.array, back.attributes.uv.array],
    [new Float32Array(P), new Float32Array(N), new Float32Array(U)],
  ];
  const cat = k => { const n = parts.reduce((s, p) => s + p[k].length, 0), out = new Float32Array(n); let o = 0; for (const p of parts) { out.set(p[k], o); o += p[k].length; } return out; };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cat(0), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(cat(1), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(cat(2), 2));
  let start = 0;
  parts.forEach((p, i) => { const n = p[0].length / 3; geo.addGroup(start, n, i); start += n; });
  geo.computeBoundingSphere();
  return geo;
}

const VERT = /* glsl */`
  varying vec2 vUv; varying vec3 vV; varying vec3 vL;
  uniform vec3 uLight;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    mat3 R = mat3(modelMatrix);
    vV = (cameraPosition - wp.xyz) * R;       // view direction in the card's own space
    vL = uLight * R;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const FRAG = /* glsl */`
  uniform sampler2D map, maskMap, sashMap;
  uniform vec4 uFoil;          // holo, metal, etch, glitter
  uniform float uTime, uSide, uDim, uFlash, uSold, uSash, uAlpha, uReady;
  uniform vec3 uTint;
  varying vec2 vUv; varying vec3 vV; varying vec3 vL;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec3 spectrum(float t) { return .5 + .5 * cos(6.28318 * (t + vec3(0., .33, .67))); }
  void main() {
    vec3 V = normalize(vV), L = normalize(vL);
    V.z *= uSide; L.z *= uSide; V.x *= uSide; L.x *= uSide;
    vec3 base = texture2D(map, vUv).rgb;
    base = mix(vec3(.82, .84, .88), base, uReady);
    vec3 m = texture2D(maskMap, vUv).rgb;
    vec2 tilt = V.xy / max(V.z, .2);
    float tl = length(tilt);
    vec3 H = normalize(L + V);
    float nh = max(H.z, 0.);
    float gloss = pow(nh, 140.) * .7 + pow(nh, 16.) * .06;
    vec3 col = base;
    // holo rainbow: bands that slide across as the card tilts, over a fine diagonal grain, with glitter
    float holo = m.r * uFoil.x;
    if (holo > .001) {
      float phase = (vUv.x * .8 + vUv.y * 1.3) * 1.1 + tilt.x * 1.7 - tilt.y * 1.3 + uTime * .015;
      vec3 rb = spectrum(phase);
      float grain = .5 + .5 * sin((vUv.x * 1.3 - vUv.y) * 340. + tilt.x * 24.);
      float s = holo * (.35 + .65 * smoothstep(.03, .42, tl));
      // the art stays, tinted through a rainbow film, with brighter bands where the light catches it
      float band = pow(.5 + .5 * sin(phase * 9.42), 4.);
      vec3 foil = base * mix(vec3(1.), rb * 1.35 + .1, .6) * (.85 + .25 * grain) + rb * band * .38;
      col = mix(col, foil, clamp(s, 0., 1.));
      vec2 cell = floor(vUv * vec2(170., 237.));
      float h = hash(cell), h2 = hash(cell + 7.1);
      float tw = pow(max(0., sin(h * 80. + tilt.x * 26. + tilt.y * 19. + uTime * .6 * h2)), 36.) * step(.62, h2);
      col += tw * s * uFoil.w * 1.8 * spectrum(h + phase);
    }
    // metallic foil: gold or silver lines and letters that catch the light
    float metal = m.g * uFoil.y;
    if (metal > .001) {
      float sweep = .5 + .5 * sin((vUv.x + vUv.y) * 7. + tilt.x * 7. - tilt.y * 5.);
      col = mix(col, col * (.82 + .5 * sweep) + vec3(1., .9, .62) * pow(nh, 24.) * 1.1, metal);
    }
    // etched texture on full-art cards: fine wavy lines that show when the card turns
    float etch = m.b * uFoil.z;
    if (etch > .001) {
      float w = sin((vUv.y * 2.4 + sin(vUv.x * 11. + vUv.y * 5.) * .06) * 360.);
      float show = .25 + 1.5 * smoothstep(.04, .5, tl);
      col *= 1. + w * etch * .07 * show;
      col += pow(nh, 30.) * etch * .5;
    }
    col = mix(col, col * uTint, uSold);
    // the SOLD sash, stamped on: it lands from a little bigger
    if (uSash > .001) {
      vec4 s = texture2D(sashMap, (vUv - .5) / mix(1.3, 1., uSash) + .5);
      col = col * (1. - s.a * uSash) + s.rgb * uSash;
    }
    col += gloss * (1. + holo * .8);
    col += uFlash * vec3(1., .96, .88);
    col *= uDim;
    gl_FragColor = vec4(col, uAlpha);
    #include <colorspace_fragment>
  }`;

const LIGHT = new THREE.Vector3(-.42, .62, 1).normalize();
let GEO = null, EDGE = null, NO_EDGE = null, BACK = null;
export const cardTime = { value: 0 };

export function cardMaterial(side, entry) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      map: { value: entry?.tex ?? null }, maskMap: { value: entry?.mask ?? null },
      uFoil: { value: new THREE.Vector4(...(entry?.foil ?? [0, 0, 0, 0])) },
      uTime: cardTime, uSide: { value: side }, uDim: { value: 1 }, uFlash: { value: 0 }, uSold: { value: 0 }, sashMap: { value: null }, uSash: { value: 0 }, uAlpha: { value: 1 },
      uReady: { value: entry?.ready ? 1 : 0 }, uTint: { value: new THREE.Color(1, .45, .45) }, uLight: { value: LIGHT },
    },
  });
}

// A card mesh. set(entry) points its front at a face from the FaceCache (it fills in when the face is ready).
export class Card {
  constructor(faces) {
    this.faces = faces;
    if (!GEO) {
      GEO = cardGeometry();
      EDGE = new THREE.MeshBasicMaterial({ color: 0xe9e6df });
      NO_EDGE = new THREE.MeshBasicMaterial({ visible: false });
      BACK = cardMaterial(-1, faces.back);
    }
    this.front = cardMaterial(1, null);
    this.front.uniforms.maskMap.value = faces.blankMask;
    this.back = BACK;
    this.mesh = new THREE.Mesh(GEO, [this.front, this.back, EDGE]);
    this.mesh.userData.card = this;
    this.entry = null;
  }
  set(entry) {
    if (this.entry === entry) return this;
    if (this.entry) this.faces.release(this.entry);
    this.entry = entry;
    const u = this.front.uniforms;
    u.uReady.value = 0;
    if (!entry) return this;
    this.faces.when(entry, e => {
      if (this.entry !== e) return;
      u.map.value = e.tex; u.maskMap.value = e.mask; u.uFoil.value.set(...e.foil); u.uReady.value = 1;
    });
    return this;
  }
  get ready() { return !!this.entry?.ready; }
  set dim(v) { this.front.uniforms.uDim.value = v; }
  set flash(v) { this.front.uniforms.uFlash.value = v; }
  set sold(v) { this.front.uniforms.uSold.value = v; }
  set sash(v) { const u = this.front.uniforms; if (v > .001 && !u.sashMap.value) u.sashMap.value = this.faces.sash; u.uSash.value = v; }
  // 1 is solid; below that the face draws see-through (its thin edge hides meanwhile), for fading a card out
  set fade(v) {
    const f = this.front, see = v < .999;
    f.uniforms.uAlpha.value = v;
    if (f.transparent !== see) { f.transparent = see; f.depthWrite = !see; this.mesh.material[2] = see ? NO_EDGE : EDGE; }
  }
  dispose() { if (this.entry) this.faces.release(this.entry); this.entry = null; this.front.dispose(); this.mesh.removeFromParent(); }
}
