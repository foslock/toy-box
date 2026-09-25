// Clipped hedges. Each is a rounded, slightly lumpy box painted with a leafy texture. The laurel wall is also
// covered in real leaves: tens of thousands of instanced, glossy, folded laurel leaves, so the light catches them
// one by one. Yew and box get a fuzz of little sprigs so their outlines aren't ruler-straight.
import * as THREE from 'three';
import * as L from './layout.js';
import { DETAIL, U } from './common.js';
import * as T from './textures.js';

// Smooth 3D value noise for the hedges' lumps.
const hh = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hh(xi, yi, zi), hh(xi + 1, yi, zi), u), l(hh(xi, yi + 1, zi), hh(xi + 1, yi + 1, zi), u), v),
           l(l(hh(xi, yi, zi + 1), hh(xi + 1, yi, zi + 1), u), l(hh(xi, yi + 1, zi + 1), hh(xi + 1, yi + 1, zi + 1), u), v), w);
}
const lumps = (x, y, z) => (vnoise(x * .7, y * .9, z * .7) - .5) * .16 + (vnoise(x * 2.3, y * 2.3, z * 2.3) - .5) * .06;

const TUNE = {
  laurel: { round: .38, uv: 1.4, color: 0xffffff, rough: .5, inset: .1 },
  yew: { round: .22, uv: .9, color: 0xe8f0e0, rough: .8, inset: .04 },
  box: { round: .2, uv: .7, color: 0xffffff, rough: .6, inset: .03 },
};

// A hedge's surface point: takes a point on the box (local coords, half extents hx, hy, hz) and rounds its top
// edges and vertical corners, then pushes it in or out along the normal by the lumps.
function shape(p, n, hx, hy, hz, r, world) {
  const cx = Math.max(-(hx - r), Math.min(hx - r, p.x)), cy = Math.min(hy - r, p.y), cz = Math.max(-(hz - r), Math.min(hz - r, p.z));
  const d = new THREE.Vector3(p.x - cx, p.y - cy, p.z - cz), l = d.length();
  if (l > 1e-6) { n.copy(d).divideScalar(l); p.set(cx, cy, cz).addScaledVector(n, r); }
  const k = lumps(world.x + p.x, world.y + p.y, world.z + p.z) * (p.y > -hy + .05 ? 1 : .3);
  p.addScaledVector(n, k);
  return p;
}

function shell(h, tune) {
  const w = h.x1 - h.x0, d = h.z1 - h.z0, ht = h.h - h.y0, r = Math.min(tune.round, w / 2 - .01, d / 2 - .01);
  const g = new THREE.BoxGeometry(w - tune.inset * 2, ht, d - tune.inset * 2, Math.max(2, Math.round(w / .32)), Math.max(2, Math.round(ht / .32)), Math.max(2, Math.round(d / .32)));
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  const world = new THREE.Vector3((h.x0 + h.x1) / 2, h.y0 + ht / 2, (h.z0 + h.z1) / 2);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  const hx = w / 2 - tune.inset, hy = ht / 2, hz = d / 2 - tune.inset;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
    const face = n.clone();
    shape(p, n, hx, hy, hz, r, world);
    pos.setXYZ(i, p.x, p.y, p.z); nor.setXYZ(i, n.x, n.y, n.z);
    // texture coordinates in metres, projected along the face's axis
    const wx = world.x + p.x, wy = world.y + p.y, wz = world.z + p.z;
    if (Math.abs(face.x) > .5) uv.setXY(i, wz / tune.uv, wy / tune.uv);
    else if (Math.abs(face.z) > .5) uv.setXY(i, wx / tune.uv, wy / tune.uv);
    else uv.setXY(i, wx / tune.uv, wz / tune.uv);
  }
  g.translate(world.x, world.y, world.z);
  return g;
}

// One laurel leaf: 16 cm of glossy oblong blade, folded up a little along the midrib and arched along its length.
// Its length runs along +z, its upper face looks along +y.
function laurelLeaf() {
  const rows = 3, pos = [], idx = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows, w = .36 * Math.pow(Math.sin(Math.PI * Math.min(1, t * .92 + .05)), .8) * (1 - .25 * t), arch = -.18 * (t - .45) ** 2 + .03;
    pos.push(-w / 2, arch + w * .18, t, 0, arch, t, w / 2, arch + w * .18, t);
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < 2; j++) { const a = i * 3 + j; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// A little sprig for yew and box: a few needles or leaves on a twig, as a crossed pair of cards drawn in geometry.
function sprig(kind) {
  const g = [], R = L.mulberry(kind === 'yew' ? 5 : 9);
  const n = kind === 'yew' ? 9 : 6;
  for (let i = 0; i < n; i++) {
    const t = .15 + i / n * .8, side = i % 2 ? 1 : -1, l = kind === 'yew' ? .22 : .2, w = kind === 'yew' ? .045 : .11;
    const leaf = new THREE.PlaneGeometry(w, l * .5).translate(0, l * .25, 0).rotateX(-Math.PI / 2 + .3).rotateY(side * (1.1 + R() * .3)).translate(0, 0, t * .3);
    g.push(leaf);
  }
  const m = new THREE.BufferGeometry(), pos = [], idx = [];
  let o = 0;
  for (const p of g) { pos.push(...p.attributes.position.array); idx.push(...p.index.array.map(i => i + o)); o += p.attributes.position.count; }
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setIndex(idx); m.computeVertexNormals();
  return m;
}

function leafMaterial(kind) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: kind === 'laurel' ? .32 : .6, metalness: 0, side: THREE.DoubleSide, envMapIntensity: kind === 'laurel' ? 1.35 : .8 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uGust = U.uGust;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uGust;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {   // leaves stir a little at their tips in the breeze
          vec3 ip = instanceMatrix[3].xyz;
          float ph = ip.x * 1.3 + ip.z * 1.7 + ip.y * 2.1;
          float amt = (.06 + .22 * uGust) * position.z * position.z;
          transformed.y += sin(uTime * 3.1 + ph) * amt;
          transformed.x += sin(uTime * 2.3 + ph * 1.3) * amt * .5;
        }`);
    // the underside of a laurel leaf is paler and duller
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        if (!gl_FrontFacing) diffuseColor.rgb *= vec3(1.35, 1.45, 1.05);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        if (!gl_FrontFacing) roughnessFactor = .75;`);
  };
  m.customProgramCacheKey = () => 'hedgeleaf' + kind;
  return m;
}

export function buildHedges(scene) {
  const maps = { laurel: T.laurelMass(), yew: T.yewMass(), box: T.boxMass() };
  const groups = { laurel: [], yew: [], box: [] };
  for (const h of L.HEDGES) groups[h.kind].push(h);
  const out = new THREE.Group();
  for (const kind of ['laurel', 'yew', 'box']) {
    const tune = TUNE[kind];
    const geos = groups[kind].map(h => shell(h, tune));
    const merged = mergeAll(geos);
    const mat = new THREE.MeshStandardMaterial({ color: tune.color, map: maps[kind].map, normalMap: maps[kind].normal, normalScale: new THREE.Vector2(1.2, 1.2), roughness: tune.rough, envMapIntensity: .7 });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    out.add(mesh);
    // Yew and box are clipped tight: a few see-through shells just outside the surface give them depth and a
    // soft, fine-grained outline instead of a painted box.
    if (kind !== 'laurel') for (let k = 1; k <= 3; k++) {
      const layer = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: new THREE.Color(tune.color).multiplyScalar(1 + k * .06), map: maps[kind].map, normalMap: maps[kind].normal,
        alphaMap: maps[kind].height, alphaTest: .42 + k * .12, roughness: tune.rough, envMapIntensity: .7 }));
      layer.material.onBeforeCompile = sh => {
        sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normal * ${(k * .022).toFixed(3)};`);
      };
      layer.material.customProgramCacheKey = () => 'shell' + k;
      layer.receiveShadow = true;
      out.add(layer);
    }
  }

  // Leaves and sprigs, scattered over the hedges' faces.
  const R = L.mulberry(77);
  // one batch of leaves per hedge, so the walls behind you aren't drawn
  const place = (kind, density, geo, mat, scale, colorFn) => {
    for (const h of groups[kind]) placeOn([h], kind, density, geo, mat, scale, colorFn);
  };
  const placeOn = (hs, kind, density, geo, mat, scale, colorFn) => {
    const items = [];
    for (const h of hs) {
      const w = h.x1 - h.x0, d = h.z1 - h.z0, ht = h.h - h.y0, tune = TUNE[kind], r = Math.min(tune.round, w / 2 - .01, d / 2 - .01);
      const world = new THREE.Vector3((h.x0 + h.x1) / 2, h.y0 + ht / 2, (h.z0 + h.z1) / 2);
      const hx = w / 2 - tune.inset, hy = ht / 2, hz = d / 2 - tune.inset;
      const faces = [[w * ht, 'z', 1], [w * ht, 'z', -1], [d * ht, 'x', 1], [d * ht, 'x', -1], [w * d, 'y', 1]];
      for (const [area, ax, sg] of faces) {
        // the outside of the garden wall is barely seen: fewer leaves there
        const outside = kind === 'laurel' && ((ax === 'x' && Math.sign(world.x) === sg && Math.abs(world.x) > 20) || (ax === 'z' && Math.sign(world.z) === sg && Math.abs(world.z) > 20));
        const n = Math.round(area * density * (outside ? .35 : 1) * DETAIL);
        for (let i = 0; i < n; i++) {
          const p = new THREE.Vector3(), nn = new THREE.Vector3();
          const u = R() * 2 - 1, v = R() * 2 - 1;
          if (ax === 'z') p.set(u * hx, v * hy, sg * hz); else if (ax === 'x') p.set(sg * hx, v * hy, u * hz); else p.set(u * hx, hy, v * hz);
          if (h.y0 > 0 && p.y < -hy + .05) continue;
          shape(p, nn, hx, hy, hz, r, world);
          p.addScaledVector(nn, (R() - .3) * .07);
          items.push({ p: p.add(world), n: nn, top: (p.y - h.y0) / (h.h - h.y0) });
        }
      }
    }
    const mesh = new THREE.InstancedMesh(geo, mat, items.length), m = new THREE.Matrix4(), c = new THREE.Color();
    const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    items.forEach((it, i) => {
      // leaf faces out from the hedge, tipped at random; its length points outwards-and-up-ish
      Y.copy(it.n).add(new THREE.Vector3(R() - .5, R() - .3, R() - .5).multiplyScalar(1.3)).normalize();
      Z.copy(it.n).multiplyScalar(.55).add(up.clone().multiplyScalar(R() - .35)).add(new THREE.Vector3(R() - .5, 0, R() - .5).multiplyScalar(1.4));
      Z.addScaledVector(Y, -Z.dot(Y)).normalize();
      X.crossVectors(Y, Z);
      const s = scale[0] + R() * (scale[1] - scale[0]);
      m.makeBasis(X.multiplyScalar(s), Y.multiplyScalar(s), Z.multiplyScalar(s)).setPosition(it.p);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, colorFn(c, it, R));
    });
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    if (items.length) out.add(mesh);
    return mesh;
  };
  const lg = [new THREE.Color('#2c5a1c'), new THREE.Color('#3a6b22'), new THREE.Color('#467a28'), new THREE.Color('#2a4d18'), new THREE.Color('#517f2c')];
  place('laurel', 30, laurelLeaf(), leafMaterial('laurel'), [.15, .22], (c, it, R) => {
    c.copy(lg[R() * lg.length | 0]).multiplyScalar(.8 + R() * .35);
    if (it.top > .9 && R() < .45) c.lerp(new THREE.Color('#9fb04a'), .35 + R() * .3);    // this year's growth, paler
    return c;
  });
  scene.add(out);
  return out;
}

function mergeAll(geos) {
  let n = 0, ni = 0;
  for (const g of geos) { n += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = new Uint32Array(ni);
  let o = 0, oi = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2);
    const gi = g.index.array; for (let i = 0; i < gi.length; i++) idx[oi + i] = gi[i] + o;
    o += g.attributes.position.count; oi += gi.length;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  m.setIndex(new THREE.BufferAttribute(idx, 1));
  return m;
}
