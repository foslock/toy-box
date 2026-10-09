// GLSL shared by the snow, the snowball and the things on the mountain. They all start from three's Lambert material
// and have bits swapped in, so they keep three's lights, shadows and fog.

export const NOISE = /* glsl */`
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise2(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float vnoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), u.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), u.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
// Glitter: a sparse grid of tiny flakes, each of which only catches the light from some angles, so they twinkle as
// the camera moves. scale is the flake spacing (it grows with distance, so far snow doesn't shimmer into grey).
float glitter(vec3 wp, vec3 view, vec3 nrm, vec3 sunDir, float scale) {
  vec3 c = floor(wp / scale);
  float h = hash13(c);
  if (h < 0.86) return 0.0;
  vec3 facet = normalize(vec3(hash13(c + 11.3), hash13(c + 23.7), hash13(c + 37.1)) - 0.5 + nrm * 0.7);
  vec3 hv = normalize(sunDir + view);
  float s = pow(max(dot(facet, hv), 0.0), 28.0);
  // only the middle of each cell sparkles, as a point
  vec3 f = fract(wp / scale) - 0.5;
  float pt = smoothstep(0.4, 0.0, length(f));
  return s * pt * (0.4 + (h - 0.86) * 10.0) * 2.2;
}
`;

// The things on the mountain: each vertex carries aWig (x: how much it wobbles, y: paint code). Instances carry
// iAnim (wobble amplitude in metres, speed, phase) and, for tinted models, an instance colour.
export function itemShader(mat, uniforms) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aWig;
attribute vec3 iAnim;
uniform float uTime;
varying float vGlow;`)
      .replace('#include <color_vertex>', `
  vColor = vec3(1.0);
  vColor *= color.rgb;
  float code = aWig.y;
  vGlow = code > 1.75 ? code - 2.0 : 0.0;
#ifdef USE_INSTANCING_COLOR
  if (code > 0.75 && code < 1.25) vColor *= instanceColor.rgb;
  else if (code > 0.25 && code < 0.75) vColor *= mix(instanceColor.brg, vec3(1.0), 0.15);
#endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  float w = aWig.x * iAnim.x;
  if (w > 0.0) {
    float t = uTime * iAnim.y + iAnim.z;
    float side = sign(position.x + 0.0001);
    transformed += w * vec3(sin(t + position.y * 2.1) * side, sin(t * 1.31 + 1.7 + position.x * 3.0) * 0.6, cos(t * 0.87 + position.y * 1.3));
  }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uGlow;
varying float vGlow;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += diffuseColor.rgb * vGlow * uGlow;`);
  };
  mat.customProgramCacheKey = () => 'snowball-item';
}
