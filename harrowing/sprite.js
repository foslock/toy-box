// The material every painted figure part uses: lit by the circle's ambient light, a glow from the fire below
// (stronger near the ground and on edges that face down), a rim from the key light, plus hit flashes, a hover
// highlight and a burn-away dissolve for deaths.
import * as THREE from 'three';

export const LIGHT = {
  uAmb: { value: new THREE.Color(.7, .7, .75) },
  uGlow: { value: new THREE.Color(1, .4, .15) },
  uKey: { value: new THREE.Color(1, .85, .6) },
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
  uniform vec3 uAmb, uGlow, uKey, uTint;
  uniform float uFlash, uDissolve, uAlpha, uHi, uTime, uLit, uFloor, uInk;
  varying vec2 vUv; varying float vY;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec4 c = texture2D(map, vUv);
    if (c.a < .03) discard;
    float down = texture2D(map, vUv - vec2(0., uTexel.y * 7.)).a;
    float key = texture2D(map, vUv + uKeyDir * uTexel * 7.).a;
    float side = texture2D(map, vUv - uKeyDir * uTexel * 5.).a;
    float rimDown = clamp(c.a - down, 0., 1.), rimKey = clamp(c.a - key, 0., 1.), rimOther = clamp(c.a - side, 0., 1.);
    float nearGround = smoothstep(2.6, -.2, vY - uFloor);
    vec3 lit = c.rgb * (uAmb + uGlow * nearGround * .55) * uTint;
    lit += uGlow * rimDown * (.55 + nearGround * .6) + uKey * rimKey * .75 + uGlow * rimOther * .25;
    vec3 col = mix(c.rgb * uTint, lit, uLit);
    // an ink line just inside the silhouette, like a painted card illustration
    vec2 o = uTexel * 2.6;
    float mn = min(min(texture2D(map, vUv + vec2(o.x, 0.)).a, texture2D(map, vUv - vec2(o.x, 0.)).a), min(texture2D(map, vUv + vec2(0., o.y)).a, texture2D(map, vUv - vec2(0., o.y)).a));
    col = mix(col, vec3(.05, .02, .03), smoothstep(.55, .05, mn) * .8 * uInk);
    // hover: a pulsing gold edge and a lift
    float edge = max(max(rimDown, rimKey), rimOther);
    col += uHi * (vec3(1., .82, .4) * edge * (1.2 + .4 * sin(uTime * 6.)) + vec3(.08, .06, .02));
    col = mix(col, vec3(1., .97, .9), uFlash);
    float a = c.a * uAlpha;
    // burning away: an ember edge eats through the figure
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

export function spriteMaterial(tex, o = {}) {
  const img = tex.image;
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    uniforms: {
      map: { value: tex }, uTexel: { value: new THREE.Vector2(1 / img.width, 1 / img.height) }, uKeyDir: { value: new THREE.Vector2(o.keyDir ?? -1, .6).normalize() },
      uAmb: LIGHT.uAmb, uGlow: LIGHT.uGlow, uKey: LIGHT.uKey, uTime: LIGHT.uTime, uTint: { value: new THREE.Color(1, 1, 1) },
      uFlash: { value: 0 }, uDissolve: { value: 0 }, uAlpha: { value: 1 }, uHi: { value: 0 }, uLit: { value: o.lit ?? 1 }, uFloor: { value: 0 }, uInk: { value: o.ink ?? 1 },
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
