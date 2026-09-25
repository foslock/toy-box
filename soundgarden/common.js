// Things every part of the garden shares: a few maths helpers, the wind, the sun, and how hard the GPU may work.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

const params = new URLSearchParams(location.search);
export const Q = params;
export const TOUCH = matchMedia('(pointer: coarse)').matches;
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Phones and small tablets get fewer leaves and blades; ?q=low or ?q=high overrides the guess.
export const LOW = params.get('q') === 'low' || (params.get('q') !== 'high' && (TOUCH || Math.min(screen.width, screen.height) < 600));
export const DETAIL = LOW ? .45 : 1;

// Late afternoon, early summer: the sun is low in the west-south-west, behind the chair.
export const SUN = new THREE.Vector3(-.75, .42, .35).normalize();
export const SUN_COLOR = new THREE.Color(1, .86, .68);

// The breeze: a slow swell that everything listens to. The grass and flowers lean with it, the chimes ring with it
// and the leaves rustle with it. 0 is still air, 1 is a proper gust.
export function gust(t) {
  const s = .5 + .5 * Math.sin(t * .071 + 1.3) * Math.sin(t * .043 + .2);
  const puff = Math.max(0, Math.sin(t * .23 + Math.sin(t * .061) * 2.5)) ** 3;
  return clamp(.12 + .5 * s * s + .45 * puff * s, 0, 1);
}

export const U = {
  uTime: { value: 0 },
  uGust: { value: .3 },
  uWindDir: { value: new THREE.Vector2(.93, -.36).normalize() },   // blowing from the west-south-west
  uSunDir: { value: SUN.clone() },
  uSunCol: { value: SUN_COLOR.clone() },
};

// Gusts roll across the garden downwind; on top of that, everything flutters on its own. `sway` is how far a vertex
// may move (0 at the roots), `stiff` makes the flutter quicker for small springy things.
export const WIND_GLSL = /* glsl */`
uniform float uTime, uGust;
uniform vec2 uWindDir;
vec3 windAt(vec3 wp, float sway, float stiff) {
  float along = dot(wp.xz, uWindDir);
  float roll = sin(along * .23 - uTime * 1.05) * .5 + .5;
  float roll2 = sin(along * .61 - uTime * 2.3 + wp.x * .2) * .5 + .5;
  float s = .16 + uGust * (.6 * roll * roll + .3 * roll2);
  float flick = sin(uTime * (2.6 + stiff * 3.0) + wp.x * 1.7 + wp.z * 2.3 + wp.y * 1.3) * .32 + sin(uTime * (4.7 + stiff * 4.0) + wp.z * 3.1 - wp.x * .9) * .16;
  vec2 d = uWindDir * s * (1.0 + flick) + vec2(-uWindDir.y, uWindDir.x) * flick * .35 * s;
  return vec3(d.x, -dot(d, d) * .35, d.y) * sway;
}
`;

// Adds wind to a standard material. Geometry carries an `aSway` attribute: how far each vertex moves in a full gust.
// Works for plain meshes, merged meshes and InstancedMeshes, and for their shadows via the depth material it returns.
export function windy(material, { stiff = 0, translucent = 0, key = '' } = {}) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.call(material, shader, r);
    shader.uniforms.uTime = U.uTime; shader.uniforms.uGust = U.uGust; shader.uniforms.uWindDir = U.uWindDir;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float aSway;\n${WIND_GLSL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          mat4 wm = modelMatrix;
          #ifdef USE_INSTANCING
            wm = wm * instanceMatrix;
          #endif
          vec3 wp = (wm * vec4(transformed, 1.0)).xyz;
          transformed += inverse(mat3(wm)) * windAt(wp, aSway, ${stiff.toFixed(2)});
        }`);
    if (translucent && shader.fragmentShader.includes('#include <opaque_fragment>')) {
      shader.uniforms.uSunDir = U.uSunDir; shader.uniforms.uSunCol = U.uSunCol;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSunDir, uSunCol;')
        .replace('#include <opaque_fragment>', `{
            vec3 sv = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
            float back = pow(max(dot(-normalize(vViewPosition), sv), 0.0), 3.0);
            outgoingLight += diffuseColor.rgb * uSunCol * back * ${translucent.toFixed(2)};
          }
          #include <opaque_fragment>`);
    }
  };
  material.customProgramCacheKey = () => `windy${stiff}${translucent}${key}`;
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: material.alphaTest, map: material.alphaTest ? material.map : null, side: material.side });
  depth.onBeforeCompile = shader => {
    shader.uniforms.uTime = U.uTime; shader.uniforms.uGust = U.uGust; shader.uniforms.uWindDir = U.uWindDir;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float aSway;\n${WIND_GLSL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          mat4 wm = modelMatrix;
          #ifdef USE_INSTANCING
            wm = wm * instanceMatrix;
          #endif
          vec3 wp = (wm * vec4(transformed, 1.0)).xyz;
          transformed += inverse(mat3(wm)) * windAt(wp, aSway, ${stiff.toFixed(2)});
        }`);
  };
  depth.customProgramCacheKey = () => `windydepth${stiff}${key}`;
  return depth;
}

// Attach a windy material to a mesh, shadows included.
export function sway(mesh, opts) {
  mesh.customDepthMaterial = windy(mesh.material, opts);
  return mesh;
}
