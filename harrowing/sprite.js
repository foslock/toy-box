// The material every puppet and prop is cut from. Hell is a shadow theatre: the demons are black paper held up
// in front of the fire, so the light catches their cut edges (brightest on the side facing up, toward the glow
// behind them) and leaks through thin places like wing membranes. The angel is ivory paper lit from the front,
// with a fine ink line just inside its edge. Hits flash, hovered demons get a gold edge, and the dead burn away.
import * as THREE from 'three';

export const LIGHT = {
  uAmb: { value: new THREE.Color(.7, .7, .75) },    // the ambient colour paper takes on
  uGlow: { value: new THREE.Color(1, .4, .15) },    // the fire below
  uKey: { value: new THREE.Color(1, .85, .6) },     // the light behind, which rims every cut edge
  uTime: { value: 0 },
};

const VERT = /* glsl */`
  varying vec2 vUv; varying float vY;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vY = wp.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const FRAG = /* glsl */`
  uniform sampler2D map; uniform vec2 uTexel; uniform vec2 uKeyDir;
  uniform vec3 uAmb, uGlow, uKey, uTint, uLine;
  uniform float uFlash, uDissolve, uAlpha, uHi, uTime, uLit, uFloor, uInk, uRim;
  varying vec2 vUv; varying float vY;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  float A(vec2 o) { return texture2D(map, vUv + o * uTexel).a; }
  void main() {
    vec4 c = texture2D(map, vUv);
    if (c.a < .03) discard;
    // how close the paper's edge is: the least paper found a few texels away in eight directions
    float r = 2.2, d = r * .72;
    float nearMin = min(min(min(A(vec2(r, 0.)), A(vec2(-r, 0.))), min(A(vec2(0., r)), A(vec2(0., -r)))),
                        min(min(A(vec2(d, d)), A(vec2(-d, d))), min(A(vec2(d, -d)), A(vec2(-d, -d)))));
    float edge = clamp(c.a - nearMin, 0., 1.);
    float rimKey = clamp(c.a - A(uKeyDir * 6.), 0., 1.);
    float rimDown = clamp(c.a - A(vec2(0., -8.)), 0., 1.);
    float nearGround = smoothstep(2.6, -.2, vY - uFloor);
    // the paper itself, with a little grain
    float grain = vnoise(vUv * vec2(170., 230.)) * .5 + vnoise(vUv * vec2(40., 60.)) * .5;
    vec3 paper = c.rgb * (1. - grain * .07) * uTint;
    vec3 col = mix(paper, paper * uAmb * 1.25, uLit);
    // an ink line just inside the edge (the angel), or light catching the cut edge (everyone else)
    col = mix(col, uLine, smoothstep(.15, .7, edge) * uInk);
    col += uKey * (smoothstep(.1, .8, edge) * .42 + rimKey * .5) * uRim;
    col += uGlow * rimDown * (.12 + nearGround * .5) * uRim;
    // hover: a pulsing gold edge
    col += uHi * vec3(1., .8, .38) * (smoothstep(.05, .5, edge) * 1.6 + rimKey) * (1. + .35 * sin(uTime * 6.));
    col = mix(col, vec3(1., .96, .86), uFlash);
    float a = c.a * uAlpha;
    // burning away: an ember edge eats through the paper from the bottom up
    if (uDissolve > 0.) {
      float n = vnoise(vUv * 9.) * .65 + vnoise(vUv * 23.) * .35 + (1. - vUv.y) * .25;
      float t = uDissolve * 1.35 - .1;
      if (n < t) discard;
      float burn = smoothstep(t + .08, t, n);
      col = mix(col, vec3(1., .55, .15) * 2.2, burn);
    }
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }`;

// o.paper: lit from the front like the angel (an ink line inside the edge, a softer rim); otherwise black paper
export function spriteMaterial(tex, o = {}) {
  const img = tex.image;
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    uniforms: {
      map: { value: tex }, uTexel: { value: new THREE.Vector2(1 / img.width, 1 / img.height) }, uKeyDir: { value: new THREE.Vector2((o.keyDir ?? -1) * .35, 1).normalize() },
      uAmb: LIGHT.uAmb, uGlow: LIGHT.uGlow, uKey: LIGHT.uKey, uTime: LIGHT.uTime, uTint: { value: new THREE.Color(1, 1, 1) },
      uLine: { value: new THREE.Color(o.line ?? '#5a3a14') },
      uFlash: { value: 0 }, uDissolve: { value: 0 }, uAlpha: { value: 1 }, uHi: { value: 0 }, uFloor: { value: 0 },
      uLit: { value: o.lit ?? (o.paper ? .25 : 1) }, uInk: { value: o.ink ?? (o.paper ? .85 : 0) }, uRim: { value: o.rim ?? (o.paper ? .3 : 1) },
    },
  });
}
// Glowing bits (eyes, halos, flames) are drawn on their own, added on top.
export function glowMaterial(tex) {
  return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1 });
}
export function texOf(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
