// Everything that grows. Trees of eight kinds are grown branch by branch; the rest of the planting is built from a
// few hand-made shapes (blades, tubes, petals), repeated with variation. Everything sways in the same breeze.
import * as THREE from 'three';
import * as L from './layout.js';
import * as T from './textures.js';
import { TAU, DETAIL, windy, clamp, lerp } from './common.js';

const C = hex => new THREE.Color(hex);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

/* ---------- a bucket of triangles ---------- */
// Parts are added in local coordinates with a transform, a colour and a sway for every vertex.
class Bucket {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.s = []; this.i = []; }
  get count() { return this.p.length / 3; }
  add(part, m, color, sway, normals = null) {
    const base = this.count, nm = new THREE.Matrix3().getNormalMatrix(m), P = part.p, N = part.n;
    for (let k = 0; k < P.length / 3; k++) {
      _v.set(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]);
      const local = _v.clone();
      _v.applyMatrix4(m);
      this.p.push(_v.x, _v.y, _v.z);
      if (normals) { const nn = normals(_v, k); this.n.push(nn.x, nn.y, nn.z); }
      else { _w.set(N[k * 3], N[k * 3 + 1], N[k * 3 + 2]).applyMatrix3(nm).normalize(); this.n.push(_w.x, _w.y, _w.z); }
      const col = typeof color === 'function' ? color(local, k) : color;
      this.c.push(col.r, col.g, col.b);
      this.u.push(part.u ? part.u[k * 2] : 0, part.u ? part.u[k * 2 + 1] : 0);
      this.s.push(typeof sway === 'function' ? sway(_v, local, k) : sway);
    }
    for (const j of part.i) this.i.push(j + base);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.s, 1));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    // once the GPU has the vertices, the page doesn't need its own copy
    for (const a of [...Object.values(g.attributes), g.index]) a.onUpload(release);
    return g;
  }
}
function release() { this.array = null; }
const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, sy = s, sz = s) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(s, sy, sz));
// A frame at p whose +y points along dir.
function frame(p, dir, spin = 0, s = 1) {
  _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin);
  return new THREE.Matrix4().compose(p, _q.clone().multiply(q2), new THREE.Vector3(s, s, s));
}

/* ---------- shapes ---------- */
// A tube along points {x,y,z,r}, with parallel-transported rings.
function tube(pts, radial = 6, cap = true) {
  const p = [], n = [], u = [], i = [];
  let prevN = null;
  for (let k = 0; k < pts.length; k++) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
    const t = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
    let nn = prevN ? prevN.clone().sub(t.clone().multiplyScalar(prevN.dot(t))) : new THREE.Vector3(t.y, -t.x, 0).add(new THREE.Vector3(0, t.z, -t.y));
    if (nn.lengthSq() < 1e-6) nn.set(1, 0, 0).sub(t.clone().multiplyScalar(t.x));
    nn.normalize(); prevN = nn;
    const bn = new THREE.Vector3().crossVectors(t, nn);
    for (let j = 0; j <= radial; j++) {
      const ang = j / radial * TAU, c = Math.cos(ang), s = Math.sin(ang);
      const dx = nn.x * c + bn.x * s, dy = nn.y * c + bn.y * s, dz = nn.z * c + bn.z * s, r = pts[k].r;
      p.push(pts[k].x + dx * r, pts[k].y + dy * r, pts[k].z + dz * r); n.push(dx, dy, dz); u.push(j / radial, k / (pts.length - 1));
    }
  }
  for (let k = 0; k < pts.length - 1; k++) for (let j = 0; j < radial; j++) { const a = k * (radial + 1) + j, b = a + radial + 1; i.push(a, b, a + 1, a + 1, b, b + 1); }
  if (cap) { const last = pts[pts.length - 1], c = p.length / 3; p.push(last.x, last.y, last.z); n.push(0, 1, 0); u.push(.5, 1); for (let j = 0; j < radial; j++) { const a = (pts.length - 1) * (radial + 1) + j; i.push(a, c, a + 1); } }
  return { p, n, u, i };
}
// A leaf or petal: grows along +y, its face towards +z. shape(t) is the width at t; bend curls the tip towards +z,
// fold lifts the edges (a V along the midrib), cup curls it across.
function blade({ len = 1, w = .3, segs = 4, shape = t => Math.sin(Math.PI * Math.min(1, t * 1.05 + .02)) ** .7, bend = 0, fold = 0, cup = 0, cols = 2, twist = 0 }) {
  const p = [], n = [], u = [], i = [];
  for (let k = 0; k <= segs; k++) {
    const t = k / segs, hw = w * shape(t) / 2, ang = bend * t * t;
    // walk along an arc: bend accumulates, so the centre line curves towards +z
    let cy = 0, cz = 0;
    for (let q = 1; q <= k; q++) { const a = bend * ((q - .5) / segs) ** 1.4; cy += Math.cos(a) * len / segs; cz += Math.sin(a) * len / segs; }
    const tw = twist * t;
    for (let j = 0; j <= cols; j++) {
      const s = j / cols * 2 - 1, x = s * hw, lift = (Math.abs(s) * fold + s * s * cup) * hw;
      const xx = x * Math.cos(tw), zz = x * Math.sin(tw);
      const aK = bend * t ** 1.4;                            // the face turns as the blade curls
      p.push(xx, cy - Math.sin(ang) * lift * .2, cz + lift + zz); n.push(-s * fold * .5 - Math.sin(tw), -Math.sin(aK), Math.cos(aK)); u.push((s + 1) / 2, t);
    }
  }
  for (let k = 0; k < segs; k++) for (let j = 0; j < cols; j++) { const a = k * (cols + 1) + j, b = a + cols + 1; i.push(a, a + 1, b, a + 1, b + 1, b); }
  return { p, n, u, i };
}
// A card for the foliage atlas: a quad from its bottom-middle, up +y, facing +z, folded a little down the middle.
function card(cell, s = 1, fold = .35) {
  const [cx, cy] = T.ATLAS[cell], RW = T.ATLAS_ROWS, u0 = cx / 4 + .004, u1 = (cx + 1) / 4 - .004, v1 = 1 - cy / RW - .004, v0 = 1 - (cy + 1) / RW + .004;
  const h = s, w = s / 2, f = Math.sin(fold) * w;
  return {
    p: [-w, 0, -f, 0, 0, 0, w, 0, -f, -w, h, -f, 0, h, 0, w, h, -f],
    n: [-.3, 0, 1, 0, 0, 1, .3, 0, 1, -.3, 0, 1, 0, 0, 1, .3, 0, 1],
    u: [u0, v0, (u0 + u1) / 2, v0, u1, v0, u0, v1, (u0 + u1) / 2, v1, u1, v1],
    i: [0, 1, 3, 1, 4, 3, 1, 2, 4, 2, 5, 4],
  };
}
function sphere(r, wseg = 8, hseg = 6) { const g = new THREE.SphereGeometry(r, wseg, hseg); return { p: [...g.attributes.position.array], n: [...g.attributes.normal.array], u: [...g.attributes.uv.array], i: [...g.index.array] }; }
function cone(r0, r1, h, seg = 6) { const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1, true).translate(0, h / 2, 0); return { p: [...g.attributes.position.array], n: [...g.attributes.normal.array], u: [...g.attributes.uv.array], i: [...g.index.array] }; }

/* ---------- materials ---------- */
function noFlip(mat) {                    // thin leaves: light both faces the same way, so none go black from behind
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => { prev?.(sh, r); sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', 'vec3 normal = normalize(vNormal); vec3 nonPerturbedNormal = normal; float faceDirection = 1.0;'); };
  return mat;
}
function makeMaterials() {
  const atlas = T.foliageAtlas();
  const mk = (opts, wind) => { const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, ...opts }); const depth = windy(m, wind); noFlip(m); return { m, depth }; };
  return {
    leaf: mk({ roughness: .72 }, { translucent: .35, key: 'leaf' }),
    glossy: mk({ roughness: .42, envMapIntensity: 1.1 }, { translucent: .25, key: 'glossy' }),
    petal: mk({ roughness: .6 }, { translucent: .6, stiff: .6, key: 'petal' }),
    cards: mk({ map: atlas, alphaTest: .45, roughness: .75, alphaToCoverage: true }, { translucent: .45, stiff: .8, key: 'cards' }),
    wood: {},
  };
}
function barkMaterial(kind) {
  const b = T.bark(kind), m = new THREE.MeshStandardMaterial({ map: b.map, normalMap: b.normal, roughness: kind === 'cherry' ? .6 : .9, vertexColors: true });
  return { m, depth: windy(m, { key: 'bark' + kind }) };
}

/* ---------- trees ---------- */
const SPECIES = {
  cherry: { h: [4.6, 5.4], r: .16, fork: 1.5, limbs: [3, 4], limbAng: .72, levels: 3, kids: [0, 3, 3, 2], kidAng: .7, decay: .6, up: [0, .5, .35, .2], droop: [0, .05, .15, .2], wobble: 1.2, card: 'blossom', cardS: [.62, .85], every: .2, leafFrom: 2, bark: 'cherry', sway: .14 },
  birch: { h: [8.5, 11], r: .13, leader: true, limbs: [9, 12], limbAng: 1.05, levels: 3, kids: [0, 3, 3, 0], kidAng: .75, decay: .55, up: [.08, .35, .1, 0], droop: [0, .5, .8, 0], wobble: .8, card: 'birch', cardS: [.55, .75], every: .19, leafFrom: 1, bark: 'birch', sway: .2 },
  willow: { h: [6.2, 7], r: .3, fork: 1.8, limbs: [5, 6], limbAng: .55, levels: 3, kids: [0, 4, 4, 3], kidAng: .75, decay: .6, up: [0, .5, .12, 0], droop: [0, .15, .75, 1.2], wobble: .7, card: 'willow', willow: true, bark: 'oak', sway: .12 },
  maple: { h: [3.4, 4], r: .09, fork: .7, limbs: [4, 5], limbAng: .95, levels: 3, kids: [0, 3, 3, 3], kidAng: .75, decay: .62, up: [0, .3, .02, 0], droop: [0, .15, .25, .2], wobble: 1, card: 'maple', cardS: [.5, .7], every: .15, leafFrom: 2, bark: 'oak', sway: .1, layered: true },
  olive: { h: [2.4, 2.9], r: .11, fork: .95, limbs: [3, 4], limbAng: .6, levels: 3, kids: [0, 3, 3, 2], kidAng: .75, decay: .58, up: [0, .3, .25, .15], droop: [0, .1, .2, .25], wobble: 2.2, card: 'olive', cardS: [.42, .55], every: .12, leafFrom: 2, bark: 'olive', sway: .08, gnarled: true },
  lemon: { h: [1.9, 2.1], r: .05, fork: 1.15, limbs: [4, 5], limbAng: .7, levels: 2, kids: [0, 4, 3], kidAng: .8, decay: .6, up: [0, .45, .2], droop: [0, .1, .2], wobble: 1.4, card: 'glossy', cardS: [.36, .46], every: .085, leafFrom: 1, bark: 'olive', sway: .06, fruit: true },
  oak: { h: [15, 21], r: .5, fork: 3.5, limbs: [5, 6], limbAng: .85, levels: 3, kids: [0, 3, 2, 2], kidAng: .7, decay: .58, up: [0, .3, .15, .05], droop: [0, .1, .15, .15], wobble: 1, card: 'oak', cardS: [1.5, 2.1], every: .55, leafFrom: 2, bark: 'oak', sway: .25, far: true },
  poplar: { h: [18, 24], r: .4, leader: true, limbs: [16, 20], limbAng: .32, levels: 2, kids: [0, 3, 0], kidAng: .4, decay: .5, up: [.02, .6, .3], droop: [0, 0, 0], wobble: .6, card: 'oak', cardS: [1.3, 1.7], every: .45, leafFrom: 1, bark: 'oak', sway: .3, far: true, narrow: true },
};

function growTree(sp, x, z, seed, wood, cards, extra) {
  const R = L.mulberry(seed), H = lerp(sp.h[0], sp.h[1], R()), base = new THREE.Vector3(x, 0, z);
  const crown = new THREE.Vector3(x, H * (sp.narrow ? .55 : sp.layered ? .6 : .68), z);
  const swayAt = (p, level) => sp.sway * clamp(p.y / H, 0, 1.2) ** 1.6 * (1 + level * .35);
  const barkCol = C(0xffffff);
  function branch(p0, dir, len, r0, r1, level, noKidsBelow = 0) {
    const n = Math.max(3, Math.round(len / (sp.far ? .9 : .22))), step = len / n, pts = [];
    const p = p0.clone(), d = dir.clone().normalize();
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push({ x: p.x, y: p.y, z: p.z, r: lerp(r0, r1, t ** .8) * (sp.gnarled && level === 0 ? 1 + .25 * Math.sin(t * 9 + seed) : 1) });
      if (i === n) break;
      d.y += (sp.up[level] - sp.droop[level] * t) * step * (sp.leader && level === 0 ? 3 : 1);
      d.x += (R() - .5) * sp.wobble * step; d.z += (R() - .5) * sp.wobble * step;
      if (sp.layered && level >= 1) d.y *= .9;
      d.normalize();
      p.addScaledVector(d, step);
    }
    wood.add(tube(pts, sp.far ? (level === 0 ? 6 : 3) : level === 0 ? 10 : level === 1 ? 6 : 4, level > 0), new THREE.Matrix4(), barkCol, v => swayAt(v, level));
    const at = t => { const f = t * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(f)), u = f - k, a = pts[k], b = pts[k + 1]; return { p: new THREE.Vector3(lerp(a.x, b.x, u), lerp(a.y, b.y, u), lerp(a.z, b.z, u)), r: lerp(a.r, b.r, u) }; };
    // side branches
    if (level < sp.levels) {
      const nk = level === 0 ? 0 : sp.kids[level] + (R() < .5 ? 1 : 0);
      for (let k = 0; k < nk; k++) {
        const t = lerp(.3, .92, (k + R() * .7) / nk);
        if (t < noKidsBelow) continue;
        const { p: bp, r } = at(t), az = k * 2.4 + R() * 1.2;
        const perp = new THREE.Vector3(Math.cos(az), 0, Math.sin(az)); perp.addScaledVector(d, -perp.dot(d)).normalize();
        const cd = d.clone().applyAxisAngle(new THREE.Vector3().crossVectors(d, perp).normalize(), sp.kidAng * (.7 + R() * .6));
        branch(bp, cd, len * sp.decay * (1 - .3 * t) * (.8 + R() * .4), r * .72, Math.max(.004, r * .2), level + 1);
      }
    }
    // leaves along the finer branches
    if (sp.willow && level >= 2) {
      for (let t = .12; t <= 1; t += .085) extra.strands.push({ p: at(t).p, sway: swayAt(at(t).p, level) });
    } else if (level >= sp.leafFrom && cards) {
      for (let t = .2; t <= 1.001; t += sp.every / len) {
        const { p: lp } = at(Math.min(1, t)), out = lp.clone().sub(crown), s = lerp(sp.cardS[0], sp.cardS[1], R());
        if (sp.narrow) out.y *= .3;
        out.normalize();
        const up = d.clone().multiplyScalar(.6).add(out).add(new THREE.Vector3(R() - .5, R() - .2, R() - .5).multiplyScalar(.9)).normalize();
        const m = frame(lp.clone().addScaledVector(out, s * .1), up, R() * TAU, s);
        const sw = swayAt(lp, level) + .03;
        cards.add(card(sp.card, 1, .3 + R() * .3), m, C(0xffffff).multiplyScalar(.82 + R() * .3), sw,
          (v) => _w.copy(v).sub(crown).normalize().multiplyScalar(.75).add(new THREE.Vector3(0, .35, 0)).normalize());
        if (sp.fruit && R() < .22) extra.fruit.push(lp.clone().addScaledVector(out, .08).add(new THREE.Vector3(0, -.05, 0)));
      }
    }
    return { at, pts };
  }
  // the trunk, then the main limbs from where it forks (or all along it, for a tree with a leader)
  const lean = new THREE.Vector3((R() - .5) * .12, 1, (R() - .5) * .12);
  if (sp.leader) {
    const trunk = branch(base, lean, H, sp.r, sp.r * .12, 0);
    const nl = sp.limbs[0] + (R() * (sp.limbs[1] - sp.limbs[0] + 1) | 0);
    for (let k = 0; k < nl; k++) {
      const t = lerp(sp.narrow ? .12 : .32, .96, k / nl), { p, r } = trunk.at(t), az = k * 2.39996 + R() * .5;
      const dir = new THREE.Vector3(Math.cos(az) * Math.sin(sp.limbAng), Math.cos(sp.limbAng), Math.sin(az) * Math.sin(sp.limbAng));
      branch(p, dir, H * (sp.narrow ? .2 : .32) * (1 - t * .55) * (.8 + R() * .4), r * .55, r * .1, 1);
    }
  } else {
    const fork = sp.fork * (extra.tallFork ? 1.8 : 1) * (.9 + R() * .2);
    const trunk = branch(base, lean, fork, sp.r, sp.r * .8, 0);
    const top = trunk.at(1).p, nl = sp.limbs[0] + (R() * (sp.limbs[1] - sp.limbs[0] + 1) | 0);
    for (let k = 0; k < nl; k++) {
      const az = k / nl * TAU + R() * .6, a = sp.limbAng * (.75 + R() * .5);
      const dir = new THREE.Vector3(Math.cos(az) * Math.sin(a), Math.cos(a), Math.sin(az) * Math.sin(a));
      branch(top, dir, (H - fork) * (.75 + R() * .3) * (sp.layered ? 1.15 : 1), sp.r * .62, sp.r * .12, 1, sp.layered ? .25 : 0);
    }
  }
  return H;
}

// Willow strands: long ribbons of leaves hanging from the ends of the branches, swinging in the breeze.
function strands(list, bucket, R) {
  for (const s of list) {
    const len = Math.min(s.p.y - .25, 2 + R() * 3), n = 7, az = R() * TAU;
    if (len < .6) continue;
    for (const spin of [0, Math.PI / 2]) {
      const pts = [];
      for (let k = 0; k <= n; k++) { const t = k / n; pts.push(new THREE.Vector3(s.p.x + Math.cos(az) * t * .35, s.p.y - t * len, s.p.z + Math.sin(az) * t * .35)); }
      const [cx, cy] = T.ATLAS.willow, RW = T.ATLAS_ROWS, u0 = cx / 4 + .01, u1 = (cx + 1) / 4 - .01, v1 = 1 - cy / RW - .01, v0 = 1 - (cy + 1) / RW + .01;
      const w = .2, p = [], nn = [], u = [], i = [];
      pts.forEach((q, k) => {
        const ox = Math.cos(spin + az) * w, oz = Math.sin(spin + az) * w;
        p.push(q.x - ox, q.y, q.z - oz, q.x + ox, q.y, q.z + oz); nn.push(-Math.sin(spin + az), .3, Math.cos(spin + az), -Math.sin(spin + az), .3, Math.cos(spin + az));
        const v = v1 - (v1 - v0) * (k / n) * Math.min(1, len / 3);
        u.push(u0, v, u1, v);
        if (k < n) { const a = k * 2; i.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      });
      bucket.add({ p, n: nn, u, i }, new THREE.Matrix4(), C(0xffffff).multiplyScalar(.85 + R() * .25), (v) => s.sway + ((s.p.y - v.y) / 2.5) ** 1.6 * .5);
    }
  }
}

/* ---------- smaller plants: each returns a Bucket-making function for one variant ---------- */
const COL = {
  lavLeaf: C('#8a9a7c'), lavStem: C('#7c8c63'), lavFlower: [C('#7a68a6'), C('#8676b2'), C('#6c5c96')],
  roseLeaf: [C('#2f4f23'), C('#3a5d2a'), C('#44672e')], cane: C('#4f5a2c'),
  green: [C('#4f7a2e'), C('#5d8a36'), C('#45702a')], dark: [C('#2f4f23'), C('#355a26')],
};
function lavender(R, { hue = COL.lavFlower, h = .45, n = 46, leafCol = COL.lavLeaf, spike = .09, spread = .55 } = {}) {
  const leaf = new Bucket(), flower = new Bucket();
  for (let k = 0; k < 44; k++) {                           // a grey mound of needle leaves
    const a = R() * TAU, tilt = .3 + R() * 1.1, l = .1 + R() * .12;
    leaf.add(blade({ len: l, w: .014, segs: 1, cols: 1, bend: -.5 }), M4(Math.cos(a) * .06 * R(), .02, Math.sin(a) * .06 * R(), -tilt, a, 0), leafCol.clone().multiplyScalar(.8 + R() * .35), .01 + l * .05);
  }
  for (let k = 0; k < n; k++) {                           // flower stems fanning out, each tipped with a purple spike
    const a = R() * TAU, tilt = R() ** .8 * spread, len = h * (.75 + R() * .45), ox = Math.cos(a) * .05 * R(), oz = Math.sin(a) * .05 * R();
    const dir = new THREE.Vector3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a));
    const pts = []; for (let j = 0; j <= 2; j++) { const t = j / 2; pts.push({ x: ox + dir.x * len * t, y: .03 + dir.y * len * t + (t * t) * -.02, z: oz + dir.z * len * t, r: .0035 }); }
    leaf.add(tube(pts, 3, false), new THREE.Matrix4(), COL.lavStem, v => (v.y / h) ** 2 * .12);
    const tip = pts[2], sp = [], col = hue[R() * hue.length | 0].clone().multiplyScalar(.85 + R() * .3);
    for (let j = 0; j <= 4; j++) { const t = j / 4; sp.push({ x: tip.x + dir.x * spike * t, y: tip.y + dir.y * spike * t, z: tip.z + dir.z * spike * t, r: .011 * (1 - t * .6) * (1 + .25 * Math.sin(t * 13)) }); }
    flower.add(tube(sp, 3, false), new THREE.Matrix4(), col, v => (v.y / h) ** 2 * .12);
  }
  return { leaf, petal: flower };
}
function rose(R, { h = 1, blooms = 12, climber = null } = {}) {
  const leaf = new Bucket(), cards = new Bucket(), petal = new Bucket();
  const canes = [];
  if (climber) canes.push(...climber);
  else for (let k = 0; k < 8; k++) {
    const a = k / 8 * TAU + R() * .5, tilt = .12 + R() * .42, len = h * (.7 + R() * .45), pts = [];
    for (let j = 0; j <= 5; j++) { const t = j / 5; pts.push(new THREE.Vector3(Math.cos(a) * Math.sin(tilt) * len * t + Math.cos(a) * .04, Math.cos(tilt) * len * t - t * t * .1, Math.sin(a) * Math.sin(tilt) * len * t + Math.sin(a) * .04)); }
    canes.push(pts);
  }
  const bloomAt = [], centre = new THREE.Vector3(0, h * .5, 0);
  for (const pts of canes) {
    if (!climber) leaf.add(tube(pts.map(p => ({ x: p.x, y: p.y, z: p.z, r: .011 })), 4, false), new THREE.Matrix4(), COL.cane, v => (v.y / h) ** 2 * .06);
    const segLen = pts.reduce((a, p, i) => i ? a + p.distanceTo(pts[i - 1]) : 0, 0), every = climber ? .055 : .075;
    for (let s = climber ? 0 : segLen * .15; s < segLen; s += every * (.8 + R() * .5)) {
      const f = s / segLen * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(f)), p = pts[k].clone().lerp(pts[k + 1], f - k);
      const out = climber ? new THREE.Vector3(R() - .5, R() * .8 - .1, R() - .5).normalize() : p.clone().sub(centre).setY(.2).normalize().add(new THREE.Vector3(R() - .5, R() * .7, R() - .5)).normalize();
      const sz = (climber ? .24 : .22) + R() * .1;
      cards.add(card('rose', sz, .35), frame(p, out, R() * TAU), C(0xffffff).multiplyScalar(.8 + R() * .3), v => climber ? .03 : (v.y / h) ** 2 * .07 + .015,
        v => _w.copy(v).sub(climber ? p : centre).normalize().multiplyScalar(.7).add(new THREE.Vector3(0, .5, 0)).normalize());
      if (R() < (climber ? .3 : .16)) bloomAt.push(p.clone().addScaledVector(out, .08));
    }
    bloomAt.push(pts[pts.length - 1].clone());
  }
  // blooms: rings of cupped petals round a tight centre; a few still in bud
  for (const p of bloomAt.slice(0, blooms + (climber ? 60 : 0))) {
    const up = new THREE.Vector3(R() - .5, 1.3, R() - .5).normalize(), m0 = frame(p, up, R() * TAU, 1.1 + R() * .45), bud = R() < .2;
    const white = C(0xffffff);
    if (bud) { petal.add(sphere(.022, 6, 5), m0.clone().multiply(M4(0, .02, 0, 0, 0, 0, 1, 1.5, 1)), white, .05); continue; }
    for (const [ring, count, len, open] of [[0, 5, .05, 1.25], [1, 6, .042, .85], [2, 5, .034, .45]]) {
      for (let k = 0; k < count; k++) {
        const a = k / count * TAU + ring * .5, m = m0.clone().multiply(M4(0, .004 + ring * .006, 0, 0, a, 0)).multiply(M4(0, 0, .008 * (2 - ring), -open + .2, 0, 0));
        petal.add(blade({ len, w: len * 1.05, segs: 2, cols: 2, bend: -.9 - ring * .3, cup: .9, shape: t => Math.sin(Math.PI * (t * .8 + .12)) ** .6 }), m, white.clone().multiplyScalar(1 - ring * .12), .05);
      }
    }
    petal.add(sphere(.016, 6, 4), m0.clone().multiply(M4(0, .014, 0, 0, 0, 0, 1, 1.3, 1)), white.clone().multiplyScalar(.8), .05);
  }
  return { leaf, cards, petal };
}
function daisy(R, { h = .7, rays = 14, rayLen = .035, rayCol, disk = C('#e0b020'), diskR = .012, droop = .2, leafy = 4, stemCol = C('#4f7a2e'), cone = 0, heads = 1 }) {
  const leaf = new Bucket(), petal = new Bucket();
  for (let hd = 0; hd < heads; hd++) {
    const a = R() * TAU, lean = R() * .25, top = h * (.8 + R() * .35), pts = [];
    for (let j = 0; j <= 4; j++) { const t = j / 4; pts.push({ x: Math.cos(a) * Math.sin(lean) * top * t + (hd ? Math.cos(a) * .05 : 0), y: top * t, z: Math.sin(a) * Math.sin(lean) * top * t + (hd ? Math.sin(a) * .05 : 0), r: .004 }); }
    leaf.add(tube(pts, 3, false), new THREE.Matrix4(), stemCol, v => (v.y / h) ** 2 * .14);
    for (let k = 0; k < leafy; k++) { const t = .1 + k / leafy * .5, p = pts[Math.round(t * 4)]; leaf.add(blade({ len: .08 + R() * .05, w: .018, segs: 2, bend: -.6 }), M4(p.x, p.y, p.z, -.7, R() * TAU, 0), stemCol, v => (v.y / h) ** 2 * .14); }
    const tip = pts[4], face = new THREE.Vector3(Math.cos(a) * .3, 1, Math.sin(a) * .3).normalize(), m0 = frame(new THREE.Vector3(tip.x, tip.y, tip.z), face, R() * TAU);
    for (let k = 0; k < rays; k++) petal.add(blade({ len: rayLen, w: rayLen * .38, segs: 2, bend: -droop, shape: t => t < .8 ? 1 : (1 - t) * 5 }), m0.clone().multiply(M4(0, 0, 0, -(Math.PI / 2 - .15), k / rays * TAU, 0)), rayCol.clone().multiplyScalar(.9 + R() * .15), v => (v.y / h) ** 2 * .14 + .01);
    petal.add(sphere(diskR, 8, 5), m0.clone().multiply(M4(0, cone * .5, 0, 0, 0, 0, 1, cone ? 1.4 : .5, 1)), disk, v => (v.y / h) ** 2 * .14 + .01);
  }
  return { leaf, petal };
}
function cupFlower(R, { h = .6, petals = 4, len = .035, col, center = C('#1c1a18'), open = .9 }) {   // poppies, buttercups
  const leaf = new Bucket(), petal = new Bucket();
  const a = R() * TAU, lean = R() * .3, top = h * (.75 + R() * .4), pts = [];
  for (let j = 0; j <= 4; j++) { const t = j / 4; pts.push({ x: Math.cos(a) * Math.sin(lean) * top * t * t, y: top * t, z: Math.sin(a) * Math.sin(lean) * top * t * t, r: .0035 }); }
  leaf.add(tube(pts, 3, false), new THREE.Matrix4(), COL.green[0], v => (v.y / h) ** 2 * .16);
  leaf.add(blade({ len: .1, w: .03, segs: 2, bend: -.8 }), M4(0, .05, 0, -.9, R() * TAU, 0), COL.green[1], .01);
  const tip = pts[4], m0 = frame(new THREE.Vector3(tip.x, tip.y, tip.z), new THREE.Vector3(Math.cos(a) * .4, 1, Math.sin(a) * .4), R() * TAU);
  for (let k = 0; k < petals; k++) petal.add(blade({ len, w: len * 1.2, segs: 3, bend: .6, cup: .8, shape: t => Math.sin(Math.PI * (t * .75 + .15)) ** .5 }), m0.clone().multiply(M4(0, 0, 0, 0, k / petals * TAU, 0)).multiply(M4(0, 0, .004, -open, 0, 0)), col.clone().multiplyScalar(.9 + R() * .2), v => (v.y / h) ** 2 * .16 + .01);
  petal.add(sphere(.008, 6, 4), m0, center, v => (v.y / h) ** 2 * .16 + .01);
  return { leaf, petal };
}
function spikePlant(R, { h = 1.3, bells = 24, col, leafCol = C('#476a30') }) {                  // foxgloves
  const leaf = new Bucket(), petal = new Bucket();
  for (let k = 0; k < 11; k++) leaf.add(blade({ len: .24 + R() * .1, w: .09, segs: 3, bend: -.5, fold: .2 }), M4(0, .02, 0, -(1 + R() * .3), k / 11 * TAU + R() * .3, 0), leafCol.clone().multiplyScalar(.85 + R() * .25), .015);
  const lean = new THREE.Vector3((R() - .5) * .15, 1, (R() - .5) * .15).normalize(), pts = [];
  for (let j = 0; j <= 6; j++) { const t = j / 6; pts.push({ x: lean.x * h * t, y: lean.y * h * t, z: lean.z * h * t, r: .008 * (1 - t * .6) }); }
  leaf.add(tube(pts, 4, true), new THREE.Matrix4(), leafCol, v => (v.y / h) ** 2 * .1);
  const face = R() * TAU;
  for (let k = 0; k < bells; k++) {
    const t = .42 + k / bells * .56, y = h * t, s = 1.15 - t * .6, a = face + (k % 3 - 1) * .7 + (R() - .5) * .4;
    const p = new THREE.Vector3(lean.x * y + Math.cos(a) * .02, y, lean.z * y + Math.sin(a) * .02);
    const m = frame(p, new THREE.Vector3(Math.cos(a) * .7, -.7, Math.sin(a) * .7), 0, s);
    petal.add(cone(.009, .02, .045, 7), m, col.clone().multiplyScalar(.85 + R() * .25), v => (v.y / h) ** 2 * .1);
  }
  return { leaf, petal };
}
function fern(R) {
  const leaf = new Bucket(), n = 9;
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU + R() * .4, len = .55 + R() * .35, col = COL.green[R() * 3 | 0].clone().multiplyScalar(.9 + R() * .3), pts = [];
    for (let j = 0; j <= 8; j++) { const t = j / 8, arc = t * (1.1 + R() * .1); pts.push(new THREE.Vector3(Math.cos(a) * Math.sin(arc * 1.1) * len * .8, Math.sin(Math.PI * .5 * (1 - t * .35)) * len * t * .9 - t * t * .12, Math.sin(a) * Math.sin(arc * 1.1) * len * .8)); }
    leaf.add(tube(pts.map(p => ({ x: p.x, y: p.y, z: p.z, r: .004 })), 3, false), new THREE.Matrix4(), col, v => v.y * .12 + .02);
    for (let j = 1; j < 16; j++) {                        // pinnae, longest in the middle of the frond
      const t = j / 16, f = t * 8, i0 = Math.min(7, Math.floor(f)), p = pts[i0].clone().lerp(pts[i0 + 1], f - i0), dir = pts[i0 + 1].clone().sub(pts[i0]).normalize();
      const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(), pl = .12 * Math.sin(Math.PI * (t * .9 + .08));
      for (const s of [-1, 1]) {
        const d2 = side.clone().multiplyScalar(s).addScaledVector(dir, .45).normalize();
        leaf.add(blade({ len: pl, w: pl * .32, segs: 2, bend: .3, shape: u => (1 - u * .85) }), frame(p, d2, s > 0 ? 0 : Math.PI), col, v => v.y * .12 + .03);
      }
    }
  }
  return { leaf };
}
function hosta(R, { variegated = false } = {}) {
  const leaf = new Bucket(), base = variegated ? C('#557a36') : C('#5a8474'), edge = variegated ? C('#e8e2b0') : C('#6f9486');
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * TAU + R() * .3, inner = k % 3 === 0, tilt = inner ? .25 + R() * .25 : .5 + R() * .35, len = (inner ? .26 : .32) + R() * .08;
    const stalk = inner ? .24 : .16, sx = Math.cos(a) * .1, sz = Math.sin(a) * .1, m = M4(sx, stalk, sz, -(tilt + .55), -a - Math.PI / 2, 0);
    leaf.add(blade({ len, w: len * .8, segs: 4, cols: 4, bend: -.7, fold: .3, shape: t => t < .38 ? Math.sin(t / .38 * Math.PI / 2) ** .5 : Math.cos((t - .38) / .62 * Math.PI / 2) ** .75 }), m,
      (v, i) => (i % 5 === 0 || i % 5 === 4) ? edge : base.clone().multiplyScalar(.9 + R() * .15), v => v.y * .1 + .01);
    leaf.add(tube([{ x: 0, y: 0, z: 0, r: .007 }, { x: sx * .7, y: stalk * .8, z: sz * .7, r: .006 }, { x: sx, y: stalk + .01, z: sz, r: .005 }], 3, false), new THREE.Matrix4(), base, .005);
  }
  return { glossy: leaf };
}
function grassClump(R, { h = .8, n = 60, col = C('#8a9a52'), plume = C('#c8b98a'), plumes = 10 } = {}) {
  const leaf = new Bucket(), petal = new Bucket();
  for (let k = 0; k < n; k++) {
    const a = R() * TAU, tilt = .15 + R() * .5, len = h * (.6 + R() * .5);
    leaf.add(blade({ len, w: .012, segs: 4, bend: -(1.2 + R()), shape: t => 1 - t * .8 }), M4(Math.cos(a) * .05, 0, Math.sin(a) * .05, -tilt, a, 0), col.clone().multiplyScalar(.8 + R() * .35), v => (v.y / h) ** 1.5 * .25);
  }
  for (let k = 0; k < plumes; k++) {
    const a = R() * TAU, tilt = .1 + R() * .3, len = h * (1 + R() * .4), dir = new THREE.Vector3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a)), pts = [];
    for (let j = 0; j <= 4; j++) { const t = j / 4; pts.push({ x: dir.x * len * t, y: dir.y * len * t - t * t * .05, z: dir.z * len * t, r: .002 }); }
    leaf.add(tube(pts, 3, false), new THREE.Matrix4(), col, v => (v.y / h) ** 1.5 * .25);
    const tip = pts[4], sp = [];
    for (let j = 0; j <= 5; j++) { const t = j / 5; sp.push({ x: tip.x + dir.x * .16 * t, y: tip.y + dir.y * .16 * t, z: tip.z + dir.z * .16 * t, r: .014 * Math.sin(Math.PI * (t * .85 + .1)) }); }
    petal.add(tube(sp, 5, true), new THREE.Matrix4(), plume.clone().multiplyScalar(.9 + R() * .2), v => (v.y / h) ** 1.5 * .25);
  }
  return { leaf, petal };
}
function shrubBall(R, { r = .5, leaves = 80, col = COL.dark, leafL = .12, flowers = 0, flowerCol, flowerR = .12, florets = 30 }) {   // hydrangeas
  const leaf = new Bucket(), petal = new Bucket();
  for (let k = 0; k < leaves; k++) {
    const u = R() * TAU, v = Math.acos(1 - R() * 1.1), p = new THREE.Vector3(Math.sin(v) * Math.cos(u) * r, Math.cos(v) * r * .85 + r * .1, Math.sin(v) * Math.sin(u) * r);
    leaf.add(blade({ len: leafL, w: leafL * .62, segs: 3, bend: .6, fold: .3 }), frame(p, p.clone().normalize().add(new THREE.Vector3(R() - .5, .3, R() - .5)), R() * TAU), col[R() * col.length | 0].clone().multiplyScalar(.85 + R() * .3), v => v.y * .03 + .01);
  }
  for (let k = 0; k < flowers; k++) {
    const u = R() * TAU, v = Math.acos(1 - R() * .85), c = new THREE.Vector3(Math.sin(v) * Math.cos(u) * r, Math.cos(v) * r * .85 + r * .12, Math.sin(v) * Math.sin(u) * r);
    const fr = flowerR * (.8 + R() * .4);
    for (let j = 0; j < florets; j++) {                     // a mophead: little four-petalled florets over a dome
      const uu = R() * TAU, vv = Math.acos(1 - R() * 1.3), d = new THREE.Vector3(Math.sin(vv) * Math.cos(uu), Math.cos(vv), Math.sin(vv) * Math.sin(uu));
      const up = d.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().normalize()));
      const p = c.clone().addScaledVector(up, fr), m = frame(p, up, R() * TAU, .9 + R() * .3), shade = flowerCol.clone().multiplyScalar(.85 + R() * .3);
      for (let q = 0; q < 4; q++) petal.add(blade({ len: .026, w: .022, segs: 1, cols: 1, shape: () => 1 }), m.clone().multiply(M4(0, 0, 0, Math.PI / 2 - .25, q * Math.PI / 2, 0)), shade, .02);
    }
  }
  return { leaf, petal };
}

/* ---------- placing things ---------- */
function scatter(poly, spacing, R, keep = () => true) {       // points inside a polygon, roughly `spacing` apart
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const out = [], row = spacing * .866;
  for (let z = z0 + row / 2, j = 0; z < z1; z += row, j++) for (let x = x0 + spacing / 2 + (j % 2) * spacing / 2; x < x1; x += spacing) {
    const px = x + (R() - .5) * spacing * .45, pz = z + (R() - .5) * spacing * .45, { d, inside } = L.polyDist(poly, px, pz);
    if (inside && d > spacing * .3 && keep(px, pz)) out.push([px, pz]);
  }
  return out;
}
export function buildPlants(scene) {
  const MAT = makeMaterials(), R = L.mulberry(2024), group = new THREE.Group();
  scene.add(group);
  const mesh = (geo, mat, shadow = true) => { const m = new THREE.Mesh(geo, mat.m); m.customDepthMaterial = mat.depth; m.castShadow = shadow; m.receiveShadow = true; group.add(m); return m; };
  // A species: a few variants, each an InstancedMesh per material, placed at (x, z, [yaw, scale, y, tint]).
  function plant(make, variants, spots, { shadow = false, tint = null, y = 0 } = {}) {
    if (!spots.length) return;
    const vs = Array.from({ length: variants }, () => make(R));
    const per = vs.map(() => []);
    spots.forEach((s, i) => per[i % variants].push(s));
    vs.forEach((v, vi) => {
      for (const [key, bucket] of Object.entries(v)) {
        if (!bucket.count || !per[vi].length) continue;
        const im = new THREE.InstancedMesh(bucket.geometry(), MAT[key === 'leaf' ? 'leaf' : key].m, per[vi].length);
        im.customDepthMaterial = MAT[key === 'leaf' ? 'leaf' : key].depth;
        per[vi].forEach((s, i) => {
          im.setMatrixAt(i, M4(s[0], s[4] ?? y, s[1], 0, s[2] ?? R() * TAU, 0, s[3] ?? 1));
          if (key === 'petal' && tint) im.setColorAt(i, tint(R, s));
        });
        im.castShadow = shadow && key !== 'petal'; im.receiveShadow = true;
        im.computeBoundingSphere();
        group.add(im);
        if (!shadow) small.push(im);                        // little plants: not drawn from far away, where hedges hide them
      }
    });
  }
  const small = [];
  const bedsOf = kind => L.BEDS.filter(b => b.plant === kind);
  const clearOf = (x, z, r) => !L.PATHS.some(p => p.kind !== 'mown' && L.lineDist(p.pts, x, z) < p.w / 2 + r) && !L.TREES.some(t => Math.hypot(t.x - x, t.z - z) < .55) && !L.SPEAKERS.some(s => Math.hypot(s.x - x, s.z - z) < .6);

  /* trees */
  const wood = {}, cards = new Bucket(), extra = { strands: [], fruit: [] };
  const trees = [...L.TREES];
  // beyond the wall: a ring of big oaks and poplars for the skyline
  for (let k = 0; k < 24; k++) {
    const a = k / 24 * TAU + R() * .15, r = 46 + R() * 26;
    trees.push({ kind: R() < .3 ? 'poplar' : 'oak', x: Math.cos(a) * r, z: Math.sin(a) * r });
  }
  for (let k = 0; k < 30; k++) {                            // and a woodland further off, to close the view
    const a = k / 30 * TAU + R() * .12, r = 95 + R() * 45;
    trees.push({ kind: R() < .25 ? 'poplar' : 'oak', x: Math.cos(a) * r, z: Math.sin(a) * r, far: true });
  }
  trees.forEach((t, i) => {
    const sp = SPECIES[t.kind], b = SPECIES[t.kind].bark;
    wood[b] ||= new Bucket();
    growTree(sp, t.x, t.z, 77 + i * 131, wood[b], cards, { ...extra, tallFork: t.speaker, strands: extra.strands, fruit: extra.fruit });
    if (t.kind === 'olive' || t.kind === 'lemon') { /* planted in pots: lift them to the soil */ }
  });
  for (const [b, bucket] of Object.entries(wood)) mesh(bucket.geometry(), barkMaterial(b));
  strands(extra.strands, cards, R);
  mesh(cards.geometry(), MAT.cards);
  if (extra.fruit.length) {
    const lemons = new THREE.InstancedMesh(new THREE.SphereGeometry(.045, 10, 8).scale(1, 1.2, 1), new THREE.MeshStandardMaterial({ color: 0xf2c51f, roughness: .45 }), extra.fruit.length);
    extra.fruit.forEach((p, i) => lemons.setMatrixAt(i, M4(p.x, p.y, p.z, R(), R(), 0)));
    lemons.castShadow = true; group.add(lemons);
  }

  /* lavender: the walk from the gate, and edging the rose beds */
  const lavSpots = [];
  for (const b of bedsOf('lavender')) for (const [x, z] of scatter(b.pts, .52, R)) lavSpots.push([x, z, R() * TAU, .9 + R() * .3]);
  for (const b of bedsOf('roses')) {
    const [[x0, z0], , [x1, z1]] = b.pts, near = Math.abs(z0) < Math.abs(z1) ? z0 : z1, zz = near + Math.sign(z1 - z0) * (near === z0 ? .28 : -.28);
    for (let x = x0 + .3; x < x1 - .2; x += .5) lavSpots.push([x + (R() - .5) * .1, zz, R() * TAU, .8 + R() * .2]);
  }
  plant(r => lavender(r), 4, lavSpots);

  /* roses: bush roses in the beds, climbers on the arches */
  const roseSpots = [];
  for (const b of bedsOf('roses')) {
    const [[x0, z0], , [x1, z1]] = b.pts;
    for (let x = x0 + .7; x < x1 - .4; x += .95) for (let z = Math.min(z0, z1) + .75; z < Math.max(z0, z1) - .45; z += .95) roseSpots.push([x + (R() - .5) * .15, z + (R() - .5) * .15, R() * TAU, .85 + R() * .3]);
  }
  const ROSE = [C('#c8203a'), C('#f2a0b4'), C('#f5ecd8'), C('#f0a070'), C('#e8607e'), C('#b0142e')];
  plant(r => rose(r), 3, roseSpots, { tint: r => ROSE[r() * ROSE.length | 0].clone(), shadow: true });
  for (const a of L.PROPS.filter(p => p.kind === 'arch' && p.path)) {
    const canes = [], m = new THREE.Matrix4().makeRotationY(a.yaw).setPosition(a.x, 0, a.z);
    for (const zz of [-.2, .2]) canes.push(Array.from({ length: 30 }, (_, i) => a.path.getPoint(i / 29).clone().add(new THREE.Vector3((R() - .5) * .08, 0, zz + (R() - .5) * .1)).applyMatrix4(m)));
    const v = rose(R, { climber: canes, blooms: 0 }), tint = ROSE[R() * 3 | 0];
    mesh(v.cards.geometry(), MAT.cards);
    const pm = new THREE.Mesh(v.petal.geometry(), MAT.petal.m.clone()); pm.material.color = tint; pm.customDepthMaterial = MAT.petal.depth; group.add(pm);
  }

  /* the centre: a butterfly garden round the dais */
  const centre = bedsOf('centre'), cs = { lav: [], cone: [], salvia: [], allium: [], grass: [], buddleja: [] };
  for (const b of centre) {
    const pts = scatter(b.pts, .5, R);
    pts.forEach(([x, z], i) => {
      const r = Math.hypot(x, z);
      const kind = r < 5.6 ? (i % 3 ? 'lav' : 'cone') : r > 7 ? (i % 5 === 0 ? 'grass' : i % 2 ? 'salvia' : 'cone') : ['cone', 'salvia', 'lav', 'allium'][i % 4];
      cs[kind].push([x, z, R() * TAU, .85 + R() * .35]);
    });
    // one butterfly bush at the back of each bed
    const [cx, cz] = b.pts[Math.floor(b.pts.length * .75)];
    cs.buddleja.push([cx * .92, cz * .92, R() * TAU, 1]);
  }
  plant(r => lavender(r), 2, cs.lav);
  plant(r => daisy(r, { h: .75, rays: 13, rayLen: .058, rayCol: C('#c65c9c'), disk: C('#b05a24'), diskR: .02, droop: .75, cone: .025, heads: 3 }), 3, cs.cone);
  plant(r => lavender(r, { hue: [C('#4a4aa8'), C('#5654b8'), C('#3f3f96')], h: .62, n: 30, leafCol: C('#5d7a3a'), spike: .16, spread: .3 }), 3, cs.salvia);
  plant(r => daisy(r, { h: .95, rays: 0, rayCol: C('#fff'), disk: C('#8e5cc0'), diskR: .05, leafy: 1, heads: 1 }), 2, cs.allium);
  plant(r => grassClump(r, { h: .9 }), 2, cs.grass);
  plant(r => {
    const leaf = new Bucket(), petal = new Bucket();
    for (let k = 0; k < 9; k++) {                        // arching branches, each ending in a long purple cone of flowers
      const a = k / 9 * TAU + r() * .4, len = 1.3 + r() * .5, pts = [];
      for (let j = 0; j <= 6; j++) { const t = j / 6; pts.push(new THREE.Vector3(Math.cos(a) * Math.sin(t * 1.3) * len * .7, len * Math.sin(Math.PI * .5 * t) * .95 - t * t * .25, Math.sin(a) * Math.sin(t * 1.3) * len * .7)); }
      leaf.add(tube(pts.map(p => ({ x: p.x, y: p.y, z: p.z, r: .012 })), 4, false), new THREE.Matrix4(), C('#6a6a4a'), v => (v.y / 1.6) ** 2 * .12);
      for (let j = 1; j < 6; j++) for (const s of [-1, 1]) leaf.add(blade({ len: .16, w: .04, segs: 2, bend: .7 }), frame(pts[j], new THREE.Vector3(Math.cos(a + s * 1.4), -.2, Math.sin(a + s * 1.4)), 0), C('#6e8a5a').multiplyScalar(.85 + r() * .3), v => (v.y / 1.6) ** 2 * .12);
      const tip = pts[6], dir = pts[6].clone().sub(pts[5]).normalize(), sp = [];
      for (let j = 0; j <= 6; j++) { const t = j / 6; sp.push({ x: tip.x + dir.x * .28 * t, y: tip.y + dir.y * .28 * t, z: tip.z + dir.z * .28 * t, r: .035 * (1 - t * .8) * (1 + .15 * Math.sin(t * 20)) }); }
      petal.add(tube(sp, 6, true), new THREE.Matrix4(), C('#8a5cb8').multiplyScalar(.85 + r() * .3), v => (v.y / 1.6) ** 2 * .12);
    }
    return { leaf, petal };
  }, 2, cs.buddleja, { shadow: true });

  /* the south border and lawn edges: grasses, salvias and coneflowers */
  const border = [];
  for (const b of bedsOf('border')) for (const [x, z] of scatter(b.pts, .55, R)) border.push([x, z, R() * TAU, .9 + R() * .3]);
  plant(r => grassClump(r, { h: 1, col: C('#9aa060'), plume: C('#d6c79a') }), 2, border.filter((_, i) => i % 3 === 0));
  plant(r => daisy(r, { h: .75, rays: 13, rayLen: .058, rayCol: C('#c65c9c'), disk: C('#b05a24'), diskR: .02, droop: .75, cone: .025, heads: 3 }), 2, border.filter((_, i) => i % 3 === 1));
  plant(r => lavender(r, { hue: [C('#4a4aa8'), C('#5654b8')], h: .62, n: 30, leafCol: C('#5d7a3a'), spike: .16, spread: .3 }), 2, border.filter((_, i) => i % 3 === 2));

  /* the meadow: wildflowers in long grass */
  const meadow = L.BEDS.find(b => b.kind === 'meadow'), wild = { poppy: [], corn: [], ox: [], butter: [], knap: [] };
  const mown = L.PATHS.filter(p => p.kind === 'mown');
  for (const [x, z] of scatter(meadow.pts, .32 / Math.sqrt(DETAIL), R, (x, z) => !mown.some(p => L.lineDist(p.pts, x, z) < p.w / 2 + .15) && !L.TREES.some(t => Math.hypot(t.x - x, t.z - z) < .8) && !L.PROPS.some(p => p.kind === 'hive' && Math.hypot(p.x - x, p.z - z) < 1) && !L.PROPS.some(p => p.kind === 'bench' && Math.hypot(p.x - x, p.z - z) < 1.1))) {
    const k = R();
    if (k > .72) continue;
    (k < .17 ? wild.poppy : k < .3 ? wild.corn : k < .5 ? wild.ox : k < .6 ? wild.butter : wild.knap).push([x, z, R() * TAU, .9 + R() * .45]);
  }
  plant(r => cupFlower(r, { h: .62, petals: 4, len: .052, col: C('#d42a1e') }), 2, wild.poppy);
  plant(r => daisy(r, { h: .55, rays: 10, rayLen: .028, rayCol: C('#3e62d0'), disk: C('#2a3a9a'), diskR: .012, droop: .2, heads: 3 }), 2, wild.corn);
  plant(r => daisy(r, { h: .6, rays: 18, rayLen: .04, rayCol: C('#f4f1e6'), disk: C('#e8b820'), diskR: .016, droop: .15, heads: 3 }), 2, wild.ox);
  plant(r => cupFlower(r, { h: .45, petals: 5, len: .02, col: C('#f2c21c'), center: C('#c89a10'), open: .7 }), 2, wild.butter);
  plant(r => daisy(r, { h: .7, rays: 16, rayLen: .02, rayCol: C('#a0529a'), disk: C('#6a3a5a'), diskR: .016, droop: -.4, heads: 3 }), 2, wild.knap);

  /* the woodland: ferns, hostas and foxgloves under the birches */
  const wood2 = L.BEDS.find(b => b.kind === 'litter'), bark = L.PATHS.filter(p => p.kind === 'bark');
  const ws = { fern: [], hosta: [], fox: [] };
  for (const [x, z] of scatter(wood2.pts, 1.05, R, (x, z) => !bark.some(p => L.lineDist(p.pts, x, z) < p.w / 2 + .4) && clearOf(x, z, .3) && !L.PROPS.some(p => (p.kind === 'log' || p.kind === 'bench') && Math.hypot(p.x - x, p.z - z) < 1.8) && Math.hypot(x + 18.1, z + 21.4) > 1)) {
    const k = R();
    if (k < .2) continue;
    (k < .55 ? ws.fern : k < .78 ? ws.hosta : ws.fox).push([x, z, R() * TAU, .8 + R() * .45]);
  }
  plant(r => fern(r), 2, ws.fern);
  plant(r => hosta(r, { variegated: r() < .4 }), 2, ws.hosta);
  plant(r => spikePlant(r, { h: 1.25 + r() * .4, col: r() < .7 ? C('#c26aa4') : C('#f0e6ee') }), 2, ws.fox);

  /* the zen garden: bamboo and moss */
  {
    const b = bedsOf('bamboo')[0], leaf = new Bucket(), leaves = new Bucket();
    for (const [x, z] of scatter(b.pts, .28, R)) {
      const h = 3.6 + R() * 1.6, lean = new THREE.Vector3((R() - .5) * .12 + .05, 1, (R() - .5) * .12).normalize(), pts = [];
      for (let j = 0; j <= 10; j++) { const t = j / 10; pts.push({ x: x + lean.x * h * t, y: lean.y * h * t, z: z + lean.z * h * t, r: .028 * (1 - t * .55) }); }
      leaf.add(tube(pts, 6, true), new THREE.Matrix4(), C('#7f9a3c').multiplyScalar(.85 + R() * .3), v => (v.y / h) ** 2 * .28);
      for (let j = 1; j < 10; j++) leaf.add(tube([{ x: 0, y: 0, z: 0, r: .031 * (1 - j / 10 * .55) }, { x: 0, y: .012, z: 0, r: .031 * (1 - j / 10 * .55) }], 6, false), M4(pts[j].x, pts[j].y, pts[j].z), C('#a8b060'), v => (v.y / h) ** 2 * .28);
      for (let j = 4; j <= 10; j++) for (let s = 0; s < 2; s++) {
        const p = new THREE.Vector3(pts[j].x, pts[j].y, pts[j].z), up = new THREE.Vector3(R() - .5, .5, R() - .5).normalize();
        leaves.add(card('bamboo', .7 + R() * .3, .3), frame(p, up, R() * TAU), C(0xffffff).multiplyScalar(.85 + R() * .25), (p.y / h) ** 2 * .28 + .03,
          v => _w.set(v.x - x, .6, v.z - z).normalize());
      }
    }
    mesh(leaf.geometry(), MAT.glossy);
    mesh(leaves.geometry(), MAT.cards);
    const moss = new Bucket(), mc = [C('#d8e0c8'), C('#c8d4b4'), C('#e8ecd8')];
    const mounds = [[-19, -3.9, 1.5], [-16.3, 3.7, 1.1], [-23, 4.6, .8], [-12.9, 2.9, .6], [-24.6, -6.9, 1.1], [-11.2, 6.9, .9], [-12.4, -6.9, .9]];
    for (const [x, z, r0] of mounds) for (let k = 0; k < 7; k++) {
      const a = R() * TAU, d = r0 * (.6 + R() * .5), r = .22 + R() * .3, g = sphere(r, 12, 6);
      for (let i = 0; i < g.p.length; i += 3) { g.p[i + 1] = Math.max(0, g.p[i + 1]) * .35; const nx = g.p[i], nz = g.p[i + 2]; g.p[i] = nx * (1 + .1 * Math.sin(nz * 30)); }
      moss.add(g, M4(x + Math.cos(a) * d, -.01, z + Math.sin(a) * d), mc[R() * 3 | 0].clone().multiplyScalar(.85 + R() * .25), 0);
    }
    const mt = T.moss(), mm = new THREE.MeshStandardMaterial({ map: mt.map, normalMap: mt.normal, normalScale: new THREE.Vector2(1.5, 1.5), vertexColors: true, roughness: 1 });
    const mg = moss.geometry(), mp = mg.attributes.position, muv = mg.attributes.uv;
    for (let i = 0; i < mp.count; i++) muv.setXY(i, mp.getX(i) * 1.6, mp.getZ(i) * 1.6);
    const mo = new THREE.Mesh(mg, mm); mo.receiveShadow = true; group.add(mo);
  }

  /* the pond's edge: irises */
  const iris = [];
  for (let k = 0; k < 16; k++) { const a = k / 16 * TAU + R() * .2; if (a > 3.6 && a < 4.6) continue; const [x, z] = L.pondEdge(a, .35 + R() * .3); iris.push([x, z, R() * TAU, .9 + R() * .3]); }
  plant(r => {
    const leaf = new Bucket(), petal = new Bucket();
    for (let k = 0; k < 13; k++) { const a = r() * TAU; leaf.add(blade({ len: .6 + r() * .35, w: .032, segs: 4, bend: .35 + r() * .3, shape: t => 1 - t * .9 }), M4(Math.cos(a) * .06, 0, Math.sin(a) * .06, .08 + r() * .15, a, 0), C('#4d7a3a').multiplyScalar(.85 + r() * .3), v => v.y * .12); }
    for (let f = 0; f < 2; f++) {
      const h = .8 + r() * .2, a = r() * TAU, p = new THREE.Vector3(Math.cos(a) * .08, h, Math.sin(a) * .08);
      leaf.add(tube([{ x: 0, y: 0, z: 0, r: .005 }, { x: p.x, y: h, z: p.z, r: .004 }], 3, false), new THREE.Matrix4(), C('#4d7a3a'), v => v.y * .12);
      for (let q = 0; q < 3; q++) {
        petal.add(blade({ len: .06, w: .035, segs: 3, bend: -1.4, cup: .4 }), frame(p, new THREE.Vector3(Math.cos(q * 2.09), .4, Math.sin(q * 2.09)), 0), C('#5a3ea8'), h * .12);
        petal.add(blade({ len: .05, w: .025, segs: 2, bend: .5, cup: .5 }), frame(p, new THREE.Vector3(Math.cos(q * 2.09 + 1), 2, Math.sin(q * 2.09 + 1)), 0), C('#7a5ec8'), h * .12);
      }
    }
    return { leaf, petal };
  }, 2, iris);

  /* the terrace: hydrangeas along the hedges */
  const hyd = [];
  for (const b of bedsOf('hydrangea')) for (const [x, z] of scatter(b.pts, 1.25, R, (x, z) => Math.hypot(x - 23.5, z - 22.9) > .8)) hyd.push([x, z, R() * TAU, .9 + R() * .25]);
  const HYD = [C('#7fa0e0'), C('#c88ac8'), C('#f0eef0'), C('#9a8ae0')];
  plant(r => shrubBall(r, { r: .5, leaves: 90, leafL: .13, flowers: 9, flowerCol: C(0xffffff), flowerR: .11, florets: 26 }), 2, hyd, { tint: r => HYD[r() * HYD.length | 0].clone(), shadow: true });

  /* the kitchen garden: lettuces, cabbages and bean wigwams; the cutting beds: dahlias, cosmos and sunflowers */
  const kg = { lettuce: [], cabbage: [], beans: [], dahlia: [], cosmos: [], sun: [] };
  for (const b of L.BEDS.filter(b => b.raised)) {
    const [[x0, z0], , [x1, z1]] = b.pts, y = b.soilY ?? .29, spots = [];
    for (let x = x0 + .5; x < x1 - .3; x += .55) for (let z = z0 + .5; z < z1 - .3; z += .55) spots.push([x + (R() - .5) * .08, z + (R() - .5) * .08, R() * TAU, .9 + R() * .2, y]);
    spots.forEach((s, i) => {
      if (b.plant === 'kitchen') (i % 3 === 0 ? kg.lettuce : i % 3 === 1 ? kg.cabbage : i % 2 === 0 ? kg.beans : kg.lettuce).push(s);
      else (i % 3 === 0 ? kg.dahlia : i % 3 === 1 ? kg.cosmos : i % 2 === 0 ? kg.sun : kg.cosmos).push(s);
    });
  }
  {
    const { lettuce, cabbage, beans } = kg;
    plant(r => { const leaf = new Bucket(), red = r() < .4; for (let k = 0; k < 22; k++) { const a = k * 2.4, t = k / 22; leaf.add(blade({ len: .14 - t * .05, w: .11 - t * .03, segs: 3, cols: 3, bend: 1.2 - t * .6, cup: .5, fold: .2 }), M4(0, .01 + t * .03, 0, -(1.2 - t * 1.1), a, 0), red ? C('#8a3a3a').lerp(C('#9ab04a'), t * .5) : C('#9ac050').multiplyScalar(.9 + r() * .2), .01); } return { glossy: leaf }; }, 2, lettuce);
    plant(r => { const leaf = new Bucket(); leaf.add(sphere(.12, 12, 8), M4(0, .11, 0), C('#7a9a8a'), 0); for (let k = 0; k < 9; k++) leaf.add(blade({ len: .2, w: .18, segs: 3, cols: 3, bend: 1.3, cup: .4 }), M4(0, .02, 0, -1.1, k / 9 * TAU, 0), C('#6e9080').multiplyScalar(.9 + r() * .2), .01); return { glossy: leaf }; }, 2, cabbage);
    plant(r => {
      const leaf = new Bucket(), petal = new Bucket(), top = new THREE.Vector3(0, 1.9, 0);
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * TAU, foot = new THREE.Vector3(Math.cos(a) * .35, 0, Math.sin(a) * .35);
        leaf.add(tube([{ ...foot, r: .01 }, { x: top.x + Math.cos(a) * .03, y: top.y + .15, z: top.z + Math.sin(a) * .03, r: .008 }], 4, true), new THREE.Matrix4(), C('#b8a070'), .01);
        for (let t = .08; t < .9; t += .07) { const p = foot.clone().lerp(top, t); leaf.add(blade({ len: .09, w: .07, segs: 2, bend: .5 }), frame(p, new THREE.Vector3(r() - .5, .3, r() - .5), r() * TAU), C('#4e7a30').multiplyScalar(.9 + r() * .25), t * .04); if (r() < .25) petal.add(sphere(.012, 5, 4), M4(p.x + .03, p.y, p.z), C('#e03a2a'), t * .04); }
      }
      return { leaf, petal };
    }, 1, beans);
  }
  {
    const { dahlia, cosmos, sun } = kg;
    const DAH = [C('#d8406a'), C('#f08a3a'), C('#8a1a3a'), C('#f5c8d6')];
    plant(r => {
      const leaf = new Bucket(), petal = new Bucket();
      for (let k = 0; k < 18; k++) leaf.add(blade({ len: .12, w: .07, segs: 2, bend: -.6 }), M4((r() - .5) * .3, .2 + r() * .5, (r() - .5) * .3, -.8, r() * TAU, 0), COL.dark[r() * 2 | 0].clone().multiplyScalar(1.1), v => v.y * .06);
      for (let f = 0; f < 4; f++) {
        const p = new THREE.Vector3((r() - .5) * .35, .75 + r() * .35, (r() - .5) * .35), m0 = frame(p, new THREE.Vector3(r() - .5, 1.5, r() - .5), 0);
        leaf.add(tube([{ x: p.x * .3, y: .2, z: p.z * .3, r: .007 }, { x: p.x, y: p.y, z: p.z, r: .006 }], 3, false), new THREE.Matrix4(), COL.green[1], v => v.y * .06);
        for (const [ring, n, len, open] of [[0, 12, .07, 1.35], [1, 11, .058, 1], [2, 9, .044, .6], [3, 7, .03, .25]]) for (let k = 0; k < n; k++) petal.add(blade({ len, w: len * .45, segs: 2, bend: -.4, cup: .9, shape: t => Math.sin(Math.PI * (t * .7 + .15)) }), m0.clone().multiply(M4(0, ring * .008, 0, 0, k / n * TAU + ring * .3, 0)).multiply(M4(0, 0, 0, -open + .2, 0, 0)), C(0xffffff).multiplyScalar(1 - ring * .08), v => v.y * .06);
      }
      return { leaf, petal };
    }, 2, dahlia, { tint: r => DAH[r() * DAH.length | 0].clone() });
    plant(r => daisy(r, { h: 1, rays: 8, rayLen: .045, rayCol: C('#ffffff'), disk: C('#e8b020'), diskR: .012, droop: .1, leafy: 8, heads: 5 }), 2, cosmos, { tint: r => [C('#f07ab0'), C('#fbe6ef'), C('#c83a7a')][r() * 3 | 0] });
    plant(r => {
      const leaf = new Bucket(), petal = new Bucket(), h = 1.7 + r() * .5, pts = [];
      for (let j = 0; j <= 6; j++) { const t = j / 6; pts.push({ x: Math.sin(t * 2) * .05, y: h * t, z: 0, r: .018 * (1 - t * .4) }); }
      leaf.add(tube(pts, 5, false), new THREE.Matrix4(), C('#5a7a2c'), v => (v.y / h) ** 2 * .1);
      for (let j = 1; j < 6; j++) leaf.add(blade({ len: .24, w: .2, segs: 3, cols: 3, bend: 1.1, fold: .2 }), frame(new THREE.Vector3(pts[j].x, pts[j].y, 0), new THREE.Vector3(Math.cos(j * 2.4), .6, Math.sin(j * 2.4)), 0), C('#557a2a').multiplyScalar(.9 + r() * .2), v => (v.y / h) ** 2 * .1);
      const top = new THREE.Vector3(pts[6].x, h, 0), m0 = frame(top, new THREE.Vector3(.2, .3, 1), 0);
      petal.add(sphere(.08, 14, 6), m0.clone().multiply(M4(0, 0, 0, 0, 0, 0, 1, .25, 1)), C('#3a2412'), .1);
      for (let k = 0; k < 22; k++) petal.add(blade({ len: .07, w: .025, segs: 2, bend: -.2 }), m0.clone().multiply(M4(0, 0, 0, -(Math.PI / 2 - .1), k / 22 * TAU, 0)).multiply(M4(0, .075, 0)), C('#f2c010').multiplyScalar(.9 + r() * .2), .1);
      return { leaf, petal };
    }, 2, sun);
  }

  /* pots on the terrace: geraniums */
  const potSpots = [];
  for (const p of L.PROPS.filter(p => p.kind === 'pot')) potSpots.push([p.x, p.z, R() * TAU, p.r / .38, p.r * 1.35 * .93]);
  plant(r => shrubBall(r, { r: .3, leaves: 40, leafL: .1, col: [C('#4f7a30'), C('#5a8a36')], flowers: 7, flowerCol: C('#e02a2a'), flowerR: .05, florets: 12 }), 2, potSpots);

  /* wisteria over the pergola */
  {
    const per = L.PROPS.find(p => p.kind === 'pergola'), vine = new Bucket(), leaves = new Bucket(), flowers = new Bucket();
    for (const z of [per.z0, per.z1]) {
      const pts = []; for (let x = per.x0 - .3; x <= per.x1 + .3; x += .3) pts.push({ x, y: 2.74 + Math.sin(x * 3) * .04, z: z + Math.sin(x * 2.1) * .07, r: .025 });
      vine.add(tube(pts, 5, false), new THREE.Matrix4(), C('#6a5a48'), .01);
      for (const px of [per.x0, per.x1]) vine.add(tube(Array.from({ length: 9 }, (_, i) => ({ x: px + Math.sin(i * 1.3) * .08 + .08, y: i / 8 * 2.72, z: z + Math.cos(i * 1.1) * .08, r: .035 - i * .002 })), 5, false), new THREE.Matrix4(), C('#6a5a48'), 0);
    }
    for (const x of per.rafters) for (let z = per.z0 - .3; z <= per.z1 + .3; z += .22) {
      if (R() < .35) continue;
      const p = new THREE.Vector3(x + (R() - .5) * .4, 2.82 + R() * .12, z);
      leaves.add(card('wisteria', .6 + R() * .35, .4), frame(p, new THREE.Vector3(R() - .5, R() * .6 - .1, R() - .5), R() * TAU), C(0xffffff).multiplyScalar(.85 + R() * .2), .03, () => new THREE.Vector3(0, 1, 0));
      if (R() < .7) {                                     // a raceme: dozens of small pea flowers round a drooping stalk
        const len = .24 + R() * .24, top = new THREE.Vector3(p.x, 2.73, p.z), n = 42, lean = (R() - .5) * .08;
        for (let k = 0; k < n; k++) {
          const t = k / n, a = k * 2.4, rr = .052 * (1 - t * .7), y = -len * t, s = .019 * (1 - t * .5);
          const fp = new THREE.Vector3(top.x + Math.cos(a) * rr + lean * t, top.y + y, top.z + Math.sin(a) * rr);
          const col = C('#c8b4ee').lerp(C('#6a4aa8'), t * .9).multiplyScalar(.9 + R() * .2);
          flowers.add(sphere(s, 5, 4), M4(fp.x, fp.y, fp.z, 0, a, 0, 1, .8, 1.25), col, ((2.74 - fp.y) / .4) ** 1.5 * .09);
        }
      }
    }
    mesh(vine.geometry(), MAT.leaf);
    mesh(leaves.geometry(), MAT.cards);
    mesh(flowers.geometry(), MAT.petal, false);
  }

  // Where the flowers are, for butterflies and bees to visit.
  const flowers = [];
  const add = (list, y, kind) => { for (const s of list) flowers.push({ x: s[0] + (R() - .5) * .15, y: y * (s[3] ?? 1) + (s[4] ?? 0), z: s[1] + (R() - .5) * .15, kind }); };
  add(lavSpots, .52, 'lavender'); add(cs.lav, .52, 'lavender'); add(cs.cone, .78, 'bed'); add(cs.salvia, .68, 'bed'); add(border, .7, 'bed');
  for (const b of cs.buddleja) for (let k = 0; k < 4; k++) { const a = R() * TAU; flowers.push({ x: b[0] + Math.cos(a) * .7, y: 1.35, z: b[1] + Math.sin(a) * .7, kind: 'bed' }); }
  add(roseSpots, .95, 'rose'); add(hyd, .95, 'bed');
  for (const k of Object.keys(wild)) add(wild[k], .6, 'meadow');
  const _c = new THREE.Vector3();
  return {
    flowers,
    update(t, dt, camera) {
      const far = camera.position.y > 4 ? 120 : 24;           // from above, over the hedges, you'd see everything
      for (const m of small) {
        _c.copy(m.boundingSphere.center);
        m.visible = camera.position.distanceTo(_c) - m.boundingSphere.radius < far;
      }
    },
  };
}
