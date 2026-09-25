// The pond: a murky bowl under a rippling surface that mirrors the sky, ringed with flat stones, with lily pads and
// flowers on it and koi turning slowly underneath. Now and then a fish comes up and leaves rings on the water.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as L from './layout.js';
import * as T from './textures.js';
import { TAU, U, clamp, lerp } from './common.js';

const P = L.POND;
const RIPPLES = 6;

function koiTexture(seed) {                              // white, orange and black patches, like a real koi
  const [c, g] = T.canvas(256, 128), R = L.mulberry(seed);
  const base = ['#f4efe6', '#f2eee4', '#e8632a'][seed % 3];
  g.fillStyle = base; g.fillRect(0, 0, 256, 128);
  const blot = (col, n, r0, r1) => { for (let i = 0; i < n; i++) { g.fillStyle = col; g.beginPath(); const x = 30 + R() * 200, y = R() * 128; g.ellipse(x, y, r0 + R() * (r1 - r0), (r0 + R() * (r1 - r0)) * .7, R() * 3, 0, TAU); g.fill(); } };
  if (seed % 3 !== 2) blot('#e2541e', 5 + (seed % 2) * 3, 14, 34);
  if (seed % 2) blot('#1c1a1a', 3, 6, 14);
  g.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 400; i++) g.fillRect(R() * 256, R() * 128, 2, 1.2);   // scales
  return T.tex(c, { repeat: false });
}

export function buildWater(scene) {
  const group = new THREE.Group(); scene.add(group);
  const outline = n => Array.from({ length: n }, (_, i) => L.pondEdge(i / n * TAU));
  const R = L.mulberry(55);

  /* the bowl: from the ground's edge down into the murk */
  {
    const rings = 12, n = 96, pos = [], idx = [], uv = [];
    for (let r = 0; r <= rings; r++) {
      const t = r / rings, k = 1 - t * t * .98, y = t < .18 ? -t / .18 * .22 : -.22 - (P.depth - .22) * Math.sin((t - .18) / .82 * Math.PI / 2);
      for (let i = 0; i <= n; i++) { const [x, z] = L.pondEdge(i / n * TAU, .05); pos.push(P.x + (x - P.x) * k, y, P.z + (z - P.z) * k); uv.push(x / 1.4, z / 1.4); }
    }
    for (let r = 0; r < rings; r++) for (let i = 0; i < n; i++) { const a = r * (n + 1) + i, b = a + n + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const mud = new THREE.MeshStandardMaterial({ map: T.soil(), color: 0x6b6a52, roughness: 1 });
    mud.onBeforeCompile = sh => {                        // deeper is darker and greener, like looking through water
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vDepth;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDepth = -position.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDepth;').replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(.03, .06, .04), smoothstep(.1, .7, vDepth));');
    };
    const bowl = new THREE.Mesh(g, mud); bowl.receiveShadow = true; group.add(bowl);
    // a few stones on the bottom
    const stones = [];
    for (let i = 0; i < 14; i++) {
      const a = R() * TAU, k = R() * .8, [x, z] = L.pondEdge(a), s = .08 + R() * .16;
      stones.push(new THREE.IcosahedronGeometry(s, 1).scale(1, .5, 1).translate(P.x + (x - P.x) * k, -.2 - (P.depth - .2) * (1 - k * k) * .9, P.z + (z - P.z) * k));
    }
    group.add(new THREE.Mesh(mergeGeometries(stones), new THREE.MeshStandardMaterial({ color: 0x5b5a4c, roughness: .9, flatShading: true })));
  }

  /* the rim: flat stones round the edge, some overhanging the water */
  {
    const stone = T.stone(31, '#a8a293'), mat = new THREE.MeshStandardMaterial({ map: stone.map, normalMap: stone.normal, roughness: .85 });
    const geos = [];
    for (let i = 0; i < 46; i++) {
      const a = i / 46 * TAU + (R() - .5) * .06, [x, z] = L.pondEdge(a, .12 + R() * .15), s = .22 + R() * .16, sh = new THREE.Shape();
      for (let k = 0; k < 9; k++) { const t = k / 9 * TAU, r = s * (.8 + R() * .3) * (1 + .15 * Math.cos(t * 2)); k ? sh.lineTo(Math.cos(t) * r, Math.sin(t) * r * .75) : sh.moveTo(Math.cos(t) * r, Math.sin(t) * r * .75); }
      const g = new THREE.ExtrudeGeometry(sh, { depth: .08, bevelEnabled: true, bevelThickness: .02, bevelSize: .025, bevelSegments: 2, curveSegments: 3 });
      g.rotateX(-Math.PI / 2); g.rotateY(-a + R() * .4); g.translate(x, -.07 + R() * .03, z);
      geos.push(g);
    }
    const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = m.receiveShadow = true; group.add(m);
  }

  /* the water */
  const ripples = Array.from({ length: RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0));
  const water = new THREE.MeshStandardMaterial({ color: 0x1d2e24, roughness: .06, metalness: 0, transparent: true, depthWrite: false, envMapIntensity: 1.25 });
  water.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uGust = U.uGust; sh.uniforms.uRip = { value: ripples };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vW; uniform float uTime, uGust; uniform vec4 uRip[${RIPPLES}];
      // height of the water at p: breeze ruffles running downwind, and rings spreading from where fish rose
      float wh(vec2 p) {
        float h = sin(dot(p, vec2(.93, -.36)) * 5.1 - uTime * 1.6) * .012 + sin(dot(p, vec2(.6, .8)) * 7.3 - uTime * 1.9) * .007;
        h += sin(dot(p, vec2(-.4, .92)) * 11.0 - uTime * 2.7) * .004 + sin(dot(p, vec2(.98, .2)) * 17.0 - uTime * 3.4) * .0025;
        h *= .35 + uGust * 1.3;
        for (int i = 0; i < ${RIPPLES}; i++) {
          float age = uTime - uRip[i].z; if (age < 0.0 || age > 4.0) continue;
          float d = length(p - uRip[i].xy), front = age * .45;
          h += sin((d - front) * 38.0) * exp(-abs(d - front) * 9.0) * exp(-age * .9) * .006 * uRip[i].w;
        }
        return h;
      }`)
      .replace('#include <normal_fragment_maps>', `{
          vec2 p = vW.xz; float e = .02;
          vec3 wn = normalize(vec3(-(wh(p + vec2(e, 0.0)) - wh(p - vec2(e, 0.0))) / (2.0 * e), 1.0, -(wh(p + vec2(0.0, e)) - wh(p - vec2(0.0, e))) / (2.0 * e)));
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
        }`)
      .replace('#include <opaque_fragment>', `
        float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 4.0);
        diffuseColor.a = mix(.62, .97, fres);
        #include <opaque_fragment>`);
  };
  const surf = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(outline(96).map(([x, z]) => new THREE.Vector2(x, -z))), 1).rotateX(-Math.PI / 2), water);
  surf.position.y = P.level; surf.receiveShadow = true; surf.renderOrder = 2;
  group.add(surf);

  /* lily pads and flowers */
  {
    const pads = [], padMat = new THREE.MeshStandardMaterial({ color: 0x4d7a2e, roughness: .45, side: THREE.DoubleSide, vertexColors: true });
    const clusters = [[-1.8, -18.4], [2.4, -20.8], [-.6, -21.4], [3.2, -18.2]];
    for (const [cx, cz] of clusters) for (let i = 0; i < 7; i++) {
      const x = cx + (R() - .5) * 1.4, z = cz + (R() - .5) * 1.1;
      if (!L.inPond(x, z, -.35)) continue;
      const r = .1 + R() * .12, g = new THREE.CircleGeometry(r, 20, .15, TAU - .3);
      g.rotateX(-Math.PI / 2); g.rotateY(R() * TAU);
      const col = new THREE.Color(0x4d7a2e).lerp(new THREE.Color(R() < .3 ? 0x8a6a3a : 0x6a9a3a), R() * .5), n = g.attributes.position.count;
      g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [col.r, col.g, col.b]).flat(), 3));
      g.translate(x, P.level + .004, z);
      pads.push({ g, x, z, r });
    }
    const pm = new THREE.Mesh(mergeGeometries(pads.map(p => p.g)), padMat); pm.receiveShadow = true; group.add(pm);
    // water lilies: rings of pointed petals round a golden centre, white or pink, merged into one mesh
    const lilies = [], hearts = [], white = new THREE.Color(0xf6eef0), pink = new THREE.Color(0xf2b6c8), o = new THREE.Object3D();
    for (const p of pads.filter((_, i) => i % 4 === 1)) {
      const col = R() < .5 ? white : pink, cx = p.x + p.r * .3, cy = P.level + .01;
      for (const [ring, n, len, tilt] of [[0, 10, .075, 1.1], [1, 8, .06, .7], [2, 6, .045, .35]]) for (let k = 0; k < n; k++) {
        const pg = new THREE.PlaneGeometry(.028, len).translate(0, len / 2, 0), pos = pg.attributes.position;
        for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setX(i, pos.getX(i) * Math.sin(Math.PI * Math.min(1, y / len * .95 + .05)) * 1.3); }
        o.rotation.set(0, k / n * TAU + ring * .3, 0, 'YXZ'); o.rotateX(-tilt); o.position.set(cx, cy, p.z); o.updateMatrix();
        pg.applyMatrix4(o.matrix);
        const c = col.clone().multiplyScalar(1 - ring * .06);
        pg.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: pos.count }, () => [c.r, c.g, c.b]).flat(), 3));
        lilies.push(pg);
      }
      hearts.push(new THREE.SphereGeometry(.018, 10, 6).scale(1, .6, 1).translate(cx, cy + .012, p.z));
    }
    if (lilies.length) {
      group.add(new THREE.Mesh(mergeGeometries(lilies), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, side: THREE.DoubleSide })));
      group.add(new THREE.Mesh(mergeGeometries(hearts), new THREE.MeshStandardMaterial({ color: 0xf0c030, roughness: .6 })));
    }
  }

  /* koi */
  const fish = [];
  {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const len = .32 + R() * .16, g = new THREE.SphereGeometry(1, 20, 10);
      const pos = g.attributes.position;
      for (let k = 0; k < pos.count; k++) {                 // a fish from a sphere: long, tapering to the tail, a little flat
        const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k), t = (z + 1) / 2;       // t: 0 tail … 1 nose
        const girth = Math.pow(Math.sin(Math.PI * Math.min(1, t * .88 + .1)), .75) * (t < .2 ? .35 + t * 3.2 : 1);
        pos.setXYZ(k, x * .11 * girth, y * .085 * girth, z * .5);
      }
      g.computeVertexNormals();
      const tail = new THREE.PlaneGeometry(.16, .12).rotateY(Math.PI / 2).translate(0, 0, -.56);
      const fins = [new THREE.PlaneGeometry(.08, .05).rotateX(-Math.PI / 2).rotateZ(.4).translate(.07, -.03, .18), new THREE.PlaneGeometry(.08, .05).rotateX(-Math.PI / 2).rotateZ(-.4).translate(-.07, -.03, .18), new THREE.PlaneGeometry(.1, .05).rotateY(Math.PI / 2).translate(0, .075, 0)];
        const all = mergeGeometries([g.toNonIndexed(), tail.toNonIndexed(), ...fins.map(f => f.toNonIndexed())].map(q => { q.deleteAttribute('uv'); return q; }));
      // texture coordinates from the body's length and girth
      const p2 = all.attributes.position, uv = new Float32Array(p2.count * 2);
      for (let k = 0; k < p2.count; k++) { uv[k * 2] = clamp(.5 - p2.getZ(k) * .9, 0, 1); uv[k * 2 + 1] = clamp(.5 + Math.atan2(p2.getY(k), p2.getX(k)) / Math.PI * .5, 0, 1); }
      all.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      all.scale(len, len, len);
      const mat = new THREE.MeshStandardMaterial({ map: koiTexture(i + 3), roughness: .35, side: THREE.DoubleSide });
      const uWag = { value: 0 };
      mat.onBeforeCompile = sh => {                         // the body swings from side to side, more towards the tail
        sh.uniforms.uWag = uWag;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWag;').replace('#include <begin_vertex>', `#include <begin_vertex>
          float back = clamp(.5 - position.z / ${len.toFixed(3)} , 0.0, 1.2);
          transformed.x += sin(uWag - back * 3.5) * back * back * ${(len * .22).toFixed(3)};`);
      };
      const m = new THREE.Mesh(all, mat); m.castShadow = false;
      group.add(m);
      fish.push({ m, uWag, a: R() * TAU, speed: .12 + R() * .1, r: .45 + R() * .45, depth: .25 + R() * .25, wag: 0, turn: (R() - .5) * .4, next: 3 + R() * 20, rise: 0, seed: R() * 100 });
    }
  }
  let ripI = 0;

  function update(t, dt) {
    for (const f of fish) {
      // each fish wanders a loop of its own inside the pond, now and then rising to the surface
      f.a += f.speed * dt / (f.r * 2.6);
      const wob = Math.sin(t * .13 + f.seed) * .25;
      const ex = Math.cos(f.a + wob) * f.r, ez = Math.sin(f.a * (1 + f.turn * .2) + wob) * f.r;
      const x = P.x + ex * (P.rx - .6), z = P.z + ez * (P.rz - .5);
      f.next -= dt;
      if (f.next < 0 && f.rise <= 0) { f.rise = 3.2; f.next = 12 + Math.random() * 25; }
      if (f.rise > 0) {
        f.rise -= dt;
        if (f.rise < 1.7 && f.rise + dt >= 1.7) { ripples[ripI].set(x, z, t, 1); ripI = (ripI + 1) % RIPPLES; }
      }
      const up = f.rise > 0 ? Math.sin(Math.PI * clamp(f.rise / 3.2, 0, 1)) : 0;
      const y = P.level - lerp(f.depth, .06, up);
      const dx = x - f.m.position.x, dz = z - f.m.position.z;
      if (Math.hypot(dx, dz) > 1e-5) f.m.rotation.y = Math.atan2(dx, dz);
      f.m.position.set(x, y, z);
      f.wag += dt * (5 + f.speed * 18); f.uWag.value = f.wag;
    }
  }
  return { update, ripples, surf };
}
