// Everything built rather than grown: the stone dais and its chair, laid paths and their edging, stepping stones,
// rose arches, the pergola and its terrace, the gate, benches, a water basin, a sundial, a birdbath, the zen garden's
// rocks, a fallen log, beehives, pots, raised beds and a wheelbarrow.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import * as L from './layout.js';
import * as T from './textures.js';
import { TAU, U, clamp } from './common.js';
import { stepStones } from './ground.js';

const V2 = (x, y) => new THREE.Vector2(x, y);
const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([x, y]) => V2(x, y)), seg);

export function bake(group, skip = new Set()) {
  group.updateMatrixWorld(true);
  const buckets = new Map(), gone = [];
  group.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || skip.has(o) || Array.isArray(o.material) || !o.visible) return;
    const key = o.material.uuid + (o.castShadow ? 's' : '');
    let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    if (o.material.vertexColors && !g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, shadow: o.castShadow, geos: [] });
    buckets.get(key).geos.push(g);
    gone.push(o);
  });
  for (const o of gone) o.parent.remove(o);
  for (const b of buckets.values()) {
    const m = new THREE.Mesh(mergeGeometries(b.geos), b.mat);
    m.castShadow = b.shadow; m.receiveShadow = true;
    group.add(m);
  }
}

export function buildFeatures(scene) {
  const lime = T.stone(7, '#d9ccb0'), gran = T.stone(19, '#9d9b93'), slate = T.stone(23, '#8f9088'), sand = T.stone(29, '#c8b596');
  const brick = T.bricks(), flag = T.flags(), teakMap = T.timber('#a0744a', 91), oakMap = T.timber('#7d6a55', 92), sageMap = T.timber('#6f8a78', 93);
  const tiled = (t, r) => { const c = t.clone(); c.repeat.set(r, r); c.needsUpdate = true; return c; };
  const M = {
    lime: new THREE.MeshStandardMaterial({ map: lime.map, normalMap: lime.normal, roughness: .8 }),
    daisTop: new THREE.MeshStandardMaterial({ map: T.dais(), normalMap: tiled(lime.normal, 3), roughness: .75 }),
    granite: new THREE.MeshStandardMaterial({ map: gran.map, normalMap: gran.normal, roughness: .85, vertexColors: true }),
    slate: new THREE.MeshStandardMaterial({ map: slate.map, normalMap: slate.normal, roughness: .8 }),
    sandstone: new THREE.MeshStandardMaterial({ map: sand.map, normalMap: sand.normal, roughness: .88 }),
    brick: new THREE.MeshStandardMaterial({ map: brick.map, normalMap: brick.normal, roughness: .9 }),
    flags: new THREE.MeshStandardMaterial({ map: flag.map, normalMap: flag.normal, roughness: .85 }),
    teak: new THREE.MeshStandardMaterial({ map: teakMap, roughness: .7 }),
    oak: new THREE.MeshStandardMaterial({ map: oakMap, roughness: .85 }),
    sage: new THREE.MeshStandardMaterial({ map: sageMap, roughness: .75 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x2c3a30, roughness: .5, metalness: .6 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x1d1d1e, roughness: .6, metalness: .7 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0x6d5438, roughness: .38, metalness: .9 }),
    cushion: new THREE.MeshStandardMaterial({ map: T.linen('#e6dfcd'), roughness: .95 }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0xb8653f, roughness: .85 }),
    soil: new THREE.MeshStandardMaterial({ map: T.soil(), roughness: 1 }),
    paint: new THREE.MeshStandardMaterial({ color: 0xece8dc, roughness: .7 }),
    bamboo: new THREE.MeshStandardMaterial({ color: 0x9aa35a, roughness: .45 }),
    bark: (() => { const b = T.bark('oak'); return new THREE.MeshStandardMaterial({ map: b.map, normalMap: b.normal, roughness: .95, vertexColors: true }); })(),
  };
  const group = new THREE.Group();
  scene.add(group);
  const put = (geo, mat, x = 0, y = 0, z = 0, ry = 0, parent = group, shadow = true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry;
    m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const at = (x, y, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; group.add(g); return g; };
  const R = L.mulberry(99);

  /* ---------- the dais and the chair ---------- */
  {
    const P = L.PLATFORM;
    const riser = (r) => { const m = M.lime.clone(); m.map = lime.map.clone(); m.map.repeat.set(TAU * r / 1.6, .1); m.map.needsUpdate = true; m.normalMap = lime.normal.clone(); m.normalMap.repeat.set(TAU * r / 1.6, .1); m.normalMap.needsUpdate = true; return m; };
    put(new THREE.CylinderGeometry(P.r, P.r + .02, P.h / 2, 120), [riser(P.r), M.daisTop, M.lime], L.CHAIR.x, P.h * .75, L.CHAIR.z);
    const stepTop = M.lime.clone(); stepTop.map = tiled(lime.map, 2.4); stepTop.normalMap = tiled(lime.normal, 2.4);
    put(new THREE.CylinderGeometry(P.step, P.step + .02, P.h / 2, 120), [riser(P.step), stepTop, M.lime], L.CHAIR.x, P.h * .25, L.CHAIR.z);
  }
  const chair = at(L.CHAIR.x, L.PLATFORM.h, L.CHAIR.z, L.CHAIR.yaw);
  {                                                          // a teak Adirondack chair with linen cushions
    const rail = box(.036, .1, .7);
    for (const s of [-1, 1]) {
      const r = put(rail, M.teak, s * .29, .35, .04, 0, chair); r.rotation.x = -.145;
      put(box(.042, .6, .085), M.teak, s * .3, .3, .33, 0, chair);
      put(box(.042, .33, .07), M.teak, s * .285, .165, -.27, 0, chair);
      const arm = put(new RoundedBoxGeometry(.14, .026, .74, 2, .01), M.teak, s * .36, .615, .05, 0, chair); arm.rotation.z = s * .02;
      put(box(.03, .1, .07), M.teak, s * .31, .56, .39, 0, chair);
    }
    for (let i = 0; i < 7; i++) {                             // seat slats, following the slope of the rails
      const z = .34 - i * .1, y = .42 - (.34 - z) * .146;
      put(box(.62, .022, .078), M.teak, 0, y, z, 0, chair);
    }
    for (let i = 0; i < 7; i++) {                             // the fan of back slats, tallest in the middle
      const u = (i - 3) / 3, len = .78 + .16 * (1 - u * u), g = new THREE.Group();
      g.position.set(u * .25, .33, -.29); g.rotation.set(-.42, 0, -u * .12); chair.add(g);
      put(new RoundedBoxGeometry(.078, len, .022, 1, .008), M.teak, 0, len / 2, 0, 0, g);
    }
    for (const [y, z, w] of [[.52, -.38, .6], [.86, -.52, .7]]) put(box(w, .06, .024), M.teak, 0, y, z - .035, 0, chair).rotation.x = -.42;
    const cs = put(new RoundedBoxGeometry(.56, .075, .52, 3, .03), M.cushion, 0, .455, .07, 0, chair); cs.rotation.x = -.145;
    const cb = put(new RoundedBoxGeometry(.52, .6, .075, 3, .03), M.cushion, 0, .76, -.36, 0, chair); cb.rotation.x = -.42;
    // and a little table beside it, with a pot of tea
    const tbl = at(L.CHAIR.x + .12, L.PLATFORM.h, L.CHAIR.z + .72, 0);
    put(new THREE.CylinderGeometry(.22, .22, .025, 32), M.teak, 0, .47, 0, 0, tbl);
    for (let k = 0; k < 3; k++) { const a = k / 3 * TAU, l = put(box(.025, .47, .025), M.teak, Math.cos(a) * .15, .235, Math.sin(a) * .15, 0, tbl); l.rotation.set(Math.sin(a) * .1, 0, -Math.cos(a) * .1); }
    const glaze = new THREE.MeshStandardMaterial({ color: 0x6f8e86, roughness: .2 });
    put(lathe([[0, 0], [.05, 0], [.075, .03], [.08, .07], [.065, .11], [.03, .125], [.012, .14], [0, .145]]), glaze, -.04, .483, -.02, 0, tbl);
    const spout = put(new THREE.CylinderGeometry(.008, .014, .08, 8), glaze, .04, .55, -.02, 0, tbl); spout.rotation.z = -.9;
    put(lathe([[0, 0], [.03, 0], [.04, .045], [.036, .045], [.026, .004], [0, .004]]), new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: .25 }), -.05, .483, .12, 0, tbl);
  }
  const chairHit = new THREE.Mesh(box(1, 1.2, 1.1), new THREE.MeshBasicMaterial({ visible: false }));
  chairHit.position.set(0, .55, -.05); chair.add(chairHit);

  /* ---------- laid paths: brick walks, and edging along the gravel ---------- */
  const other = (p, x, z) => L.PATHS.some(q => q !== p && (q.kind === 'gravel' || q.kind === 'brick') && L.lineDist(q.pts, x, z) < q.w / 2 + .02);
  function ribbon(pts, off, w, y0, y1, keep) {           // a strip along a polyline, offset sideways by `off`
    const pos = [], uv = [], idx = [];
    const runs = [];
    let run = [], along = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], len = Math.hypot(bx - ax, bz - az);
      if (len < 1e-4) continue;
      const tx = (bx - ax) / len, tz = (bz - az) / len, nx = -tz, nz = tx, n = Math.max(1, Math.ceil(len / .12));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) {
        const s = k / n, cx = ax + (bx - ax) * s + nx * off, cz = az + (bz - az) * s + nz * off;
        if (keep(cx, cz)) run.push({ x: cx, z: cz, nx, nz, v: along + len * s });
        else if (run.length) { runs.push(run); run = []; }
      }
      along += len;
    }
    if (run.length) runs.push(run);
    for (const r of runs) {
      if (r.length < 2) continue;
      const base = pos.length / 3;
      for (const p of r) for (const [sx, sy] of [[-1, y0], [-1, y1], [1, y1], [1, y0]]) { pos.push(p.x + p.nx * sx * w / 2, sy, p.z + p.nz * sx * w / 2); uv.push((sx + 1) / 2 * w + (sy === y0 ? 0 : .02), p.v); }
      for (let i = 0; i < r.length - 1; i++) {
        const a = base + i * 4, b = a + 4;
        idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1, a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  {
    const walks = [], edges = [];
    for (const p of L.PATHS) {
      if (p.kind === 'brick') walks.push(ribbon(p.pts, 0, p.w, 0, .018, () => true));
      if (p.kind === 'gravel' || p.kind === 'brick') for (const s of [-1, 1]) {
        edges.push(ribbon(p.pts, s * (p.w / 2 + .05), .1, -.02, p.kind === 'brick' ? .03 : .045, (x, z) =>
          !other(p, x, z) && Math.hypot(x - L.CHAIR.x, z - L.CHAIR.z) > L.PLATFORM.step + .06 && !L.HEDGES.some(h => h.y0 < 1 && x > h.x0 - .05 && x < h.x1 + .05 && z > h.z0 - .05 && z < h.z1 + .05)));
      }
    }
    const bm = M.brick.clone(); bm.map = brick.map.clone(); bm.map.repeat.set(1, 1); bm.map.needsUpdate = true;
    put(mergeGeometries(walks), bm, 0, 0, 0, 0, group, false);
    const em = M.brick.clone(); em.map = brick.map.clone(); em.map.repeat.set(1.6, 4); em.map.rotation = Math.PI / 2; em.map.needsUpdate = true;
    put(mergeGeometries(edges), em, 0, 0, 0, 0, group, false);
  }
  const stones = [];
  {                                                          // stepping stones: flat slabs of slate, set into the ground
    const geos = [];
    for (const p of L.PATHS) if (p.kind === 'stones') for (const s of stepStones(p)) {
      const n = 9 + (s.seed % 4), shape = new THREE.Shape(), r2 = L.mulberry(s.seed * 7 + 1);
      for (let i = 0; i < n; i++) { const a = i / n * TAU, r = s.r * (.82 + r2() * .22) * (1 + .12 * Math.cos(a * 2 + s.rot)); i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: .05, bevelEnabled: true, bevelThickness: .012, bevelSize: .015, bevelSegments: 2, curveSegments: 4 });
      g.rotateX(-Math.PI / 2); g.rotateY(s.rot); g.translate(s.x, -.02, s.z);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / .9 + s.x * .3, uv.getY(i) / .9 + s.z * .3);
      geos.push(g); stones.push(s);
    }
    put(mergeGeometries(geos), M.slate, 0, 0, 0, 0, group, false);
  }

  /* ---------- rose arches ---------- */
  for (const a of L.PROPS.filter(p => p.kind === 'arch')) {
    const g = at(a.x, 0, a.z, a.yaw), geos = [], hw = 1.06, post = 2.0, rise = .46;
    const curve = t => t < .3 ? new THREE.Vector3(-hw, post * t / .3, 0) : t > .7 ? new THREE.Vector3(hw, post * (1 - t) / .3, 0)
      : (u => new THREE.Vector3(-Math.cos(u * Math.PI) * hw, post + Math.sin(u * Math.PI) * rise, 0))((t - .3) / .4);
    const path = new THREE.CatmullRomCurve3(Array.from({ length: 41 }, (_, i) => curve(i / 40)));
    for (const z of [-.2, .2]) geos.push(new THREE.TubeGeometry(path, 80, .016, 8).translate(0, 0, z));
    for (let i = 1; i < 26; i++) { const p = path.getPoint(i / 26); geos.push(new THREE.CylinderGeometry(.009, .009, .4, 6).rotateX(Math.PI / 2).translate(p.x, p.y, 0)); }
    put(mergeGeometries(geos), M.metal, 0, 0, 0, 0, g);
    a.path = path;                                            // for the climbing roses
  }

  /* ---------- the pergola and its terrace ---------- */
  const ter = L.PROPS.find(p => p.kind === 'terrace'), per = L.PROPS.find(p => p.kind === 'pergola');
  {
    const w = ter.x1 - ter.x0, d = ter.z1 - ter.z0, fm = M.flags.clone();
    fm.map = flag.map.clone(); fm.map.repeat.set(w / 2.2, d / 2.2); fm.map.needsUpdate = true;
    fm.normalMap = flag.normal.clone(); fm.normalMap.repeat.set(w / 2.2, d / 2.2); fm.normalMap.needsUpdate = true;
    put(box(w, .06, d), [M.lime, M.lime, fm, M.lime, M.lime, M.lime], (ter.x0 + ter.x1) / 2, .015, (ter.z0 + ter.z1) / 2, 0, group, false);
    const tim = [], xs = [per.x0, (per.x0 + per.x1) / 2, per.x1];
    for (const x of xs) for (const z of [per.z0, per.z1]) tim.push(box(.13, 2.6, .13).translate(x, 1.3, z));
    for (const z of [per.z0, per.z1]) tim.push(box(per.x1 - per.x0 + .9, .2, .09).translate((per.x0 + per.x1) / 2, 2.62, z));
    per.rafters = [];
    for (let x = per.x0; x <= per.x1 + .01; x += (per.x1 - per.x0) / 12) { tim.push(box(.065, .15, per.z1 - per.z0 + .8).translate(x, 2.795, (per.z0 + per.z1) / 2)); per.rafters.push(x); }
    for (const x of xs) for (const z of [per.z0, per.z1]) for (const s of [-1, 1]) tim.push(box(.06, .06, .5).rotateX(s * .8).translate(x, 2.35, z + s * .19));
    put(mergeGeometries(tim), M.oak, 0, 0, 0, 0, group);
    // a table for two
    const t = L.PROPS.find(p => p.kind === 'table'), tg = at(t.x, .045, t.z, t.yaw);
    put(new THREE.CylinderGeometry(.55, .55, .035, 40), M.teak, 0, .74, 0, 0, tg);
    put(new THREE.CylinderGeometry(.045, .06, .72, 12), M.teak, 0, .37, 0, 0, tg);
    for (let k = 0; k < 4; k++) put(box(.5, .04, .06), M.teak, 0, .02, 0, k * Math.PI / 2 + .4, tg).translateX(.2);
    for (const s of [-1, 1]) {
      const c = at(t.x + s * .85, .045, t.z + s * .15, s > 0 ? -Math.PI / 2 : Math.PI / 2);
      put(box(.44, .03, .42), M.teak, 0, .45, 0, 0, c);
      for (const [x, z] of [[-.19, -.18], [.19, -.18], [-.19, .18], [.19, .18]]) put(box(.035, .45, .035), M.teak, x, .225, z, 0, c);
      for (const y of [.62, .78]) put(box(.42, .06, .02), M.teak, 0, y, -.2, 0, c).rotation.x = -.1;
      for (const x of [-.19, .19]) put(box(.035, .45, .03), M.teak, x, .67, -.2, 0, c);
    }
    const cup = new THREE.MeshStandardMaterial({ color: 0xf1ede2, roughness: .25 });
    put(lathe([[0, 0], [.028, 0], [.04, .05], [.036, .05], [.024, .004], [0, .004]]), cup, t.x - .15, .78, t.z + .1);
    put(lathe([[0, 0], [.028, 0], [.04, .05], [.036, .05], [.024, .004], [0, .004]]), cup, t.x + .18, .78, t.z - .06);
  }

  // a wind chime beside the pendant speaker: five tubes, a clapper and a sail, swinging in the breeze
  const chime = new THREE.Group();
  {
    const x = per.rafters[7], alu = new THREE.MeshStandardMaterial({ color: 0xc9cdd2, roughness: .22, metalness: 1 }), cord = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
    chime.position.set(x, 2.72, 18.1);
    put(new THREE.CylinderGeometry(.075, .075, .02, 20), M.teak, 0, -.12, 0, 0, chime);
    put(new THREE.CylinderGeometry(.0015, .0015, .12, 4), cord, 0, -.06, 0, 0, chime, false);
    chime.userData.tubes = [];
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * TAU, len = .24 + k * .05, t = new THREE.Group();
      t.position.set(Math.cos(a) * .055, -.13, Math.sin(a) * .055); chime.add(t);
      put(new THREE.CylinderGeometry(.0012, .0012, .08, 4), cord, 0, -.04, 0, 0, t, false);
      put(new THREE.CylinderGeometry(.009, .009, len, 12), alu, 0, -.08 - len / 2, 0, 0, t);
      chime.userData.tubes.push(t);
    }
    put(new THREE.CylinderGeometry(.0012, .0012, .5, 4), cord, 0, -.37, 0, 0, chime, false);
    put(new THREE.CylinderGeometry(.03, .03, .012, 16), M.teak, 0, -.3, 0, 0, chime);
    const sail = put(new THREE.BoxGeometry(.07, .12, .006), M.teak, 0, -.66, 0, 0, chime);
    chime.userData.sail = sail;
    group.add(chime);
  }

  /* ---------- the gate ---------- */
  {
    const g = at(0, 0, L.HALF, 0), boards = [];
    for (const s of [-1, 1]) boards.push(box(.14, 2.5, .14).translate(s * 1.08, 1.25, 0));
    boards.push(box(2.3, .16, .16).translate(0, 2.47, 0));
    put(mergeGeometries(boards), M.oak, 0, 0, 0, 0, g);
    const planks = [];
    for (let i = 0; i < 14; i++) { const x = -.98 + i * .1415; planks.push(box(.132, 2.28, .04).translate(x + .07, 1.18, 0)); }
    for (const y of [.35, 1.2, 2.05]) for (const z of [-.035, .035]) planks.push(box(1.96, .12, .03).translate(0, y, z));
    put(mergeGeometries(planks), M.sage, 0, 0, 0, 0, g);
    const iron = [];
    for (const y of [.35, 2.05]) for (const s of [-1, 1]) for (const z of [-.055, .055]) iron.push(box(.5, .045, .012).translate(s * .72, y, z));
    for (const z of [-.08, .08]) iron.push(new THREE.TorusGeometry(.055, .009, 8, 20).translate(-.12, 1.1, z));
    put(mergeGeometries(iron), M.iron, 0, 0, 0, 0, g);
  }

  /* ---------- benches ---------- */
  for (const b of L.PROPS.filter(p => p.kind === 'bench')) {
    const g = at(b.x, 0, b.z, b.yaw), parts = [];
    for (let i = 0; i < 4; i++) parts.push(box(1.5, .028, .085).translate(0, .45, .16 - i * .1));
    for (const s of [-1, 1]) {
      parts.push(box(.06, .45, .06).translate(s * .68, .225, .15), box(.06, .85, .06).translate(s * .68, .425, -.18).rotateX(0));
      parts.push(box(.06, .04, .5).translate(s * .7, .66, -.02), box(.05, .2, .05).translate(s * .7, .55, .17));
      parts.push(box(.05, .05, .42).translate(s * .68, .1, -.02));
    }
    for (const y of [.62, .74, .86]) parts.push(box(1.36, .07, .022).translate(0, y, -.2));
    put(mergeGeometries(parts), M.teak, 0, 0, 0, 0, g);
  }

  /* ---------- water basin, sundial, birdbath ---------- */
  const streams = [];
  {
    const b = L.PROPS.find(p => p.kind === 'basin'), g = at(b.x, 0, b.z, b.yaw);
    put(lathe([[0, .38], [.3, .38], [.36, .42], [.4, .5], [.42, .52], [.46, .44], [.48, .3], [.46, .12], [.4, .02], [.3, 0], [0, 0]].reverse(), 40), M.granite, 0, 0, 0, 0, g);
    const wm = new THREE.MeshStandardMaterial({ color: 0x1d2a26, roughness: .05, metalness: 0, envMapIntensity: 1.4 });
    const surf = put(new THREE.CircleGeometry(.3, 32).rotateX(-Math.PI / 2), wm, 0, .47, 0, 0, g, false);
    // a bamboo spout pouring into it
    const bam = [];
    bam.push(new THREE.CylinderGeometry(.03, .03, .9, 12).translate(0, .45, 0).translate(.62, 0, 0));
    const spout = new THREE.CylinderGeometry(.022, .022, .6, 12); spout.rotateZ(Math.PI / 2 - .12); spout.translate(.36, .86, 0); bam.push(spout);
    for (const y of [.2, .5, .8]) bam.push(new THREE.TorusGeometry(.031, .004, 6, 14).rotateX(Math.PI / 2).translate(.62, y, 0));
    put(mergeGeometries(bam), M.bamboo, 0, 0, 0, 0, g);
    const sm = new THREE.MeshStandardMaterial({ color: 0xdfeef0, transparent: true, opacity: .5, roughness: .05, depthWrite: false });
    const stream = put(new THREE.CylinderGeometry(.006, .009, .35, 8, 1, true), sm, .08, .66, 0, 0, g, false);
    streams.push({ mesh: stream, surf, base: .47 });
    for (let i = 0; i < 40; i++) {                             // pebbles round its foot
      const a = R() * TAU, r = .5 + R() * .35, s = .03 + R() * .04;
      put(new THREE.IcosahedronGeometry(s, 1).scale(1, .55, 1), M.granite, Math.cos(a) * r, s * .35, Math.sin(a) * r, R() * 3, g, false);
    }
  }
  {
    const s = L.PROPS.find(p => p.kind === 'sundial'), g = at(s.x, 0, s.z, 0);
    put(new THREE.CylinderGeometry(1.65, 1.65, .03, 48), M.brick, 0, .015, 0, 0, g, false);
    put(box(.44, .1, .44), M.sandstone, 0, .08, 0, 0, g);
    put(lathe([[0, 0], [.15, 0], [.15, .05], [.11, .1], [.1, .5], [.12, .62], [.17, .68], [.17, .72], [0, .72]], 8), M.sandstone, 0, .13, 0, 0, g);
    put(new THREE.CylinderGeometry(.155, .155, .012, 40), M.bronze, 0, .86, 0, 0, g);
    const gn = new THREE.Shape([V2(0, 0), V2(.13, 0), V2(0, .1)]);
    put(new THREE.ExtrudeGeometry(gn, { depth: .006, bevelEnabled: false }).translate(-.065, 0, -.003).rotateY(Math.PI / 2), M.bronze, 0, .866, 0, 0, g);
  }
  {
    const b = L.PROPS.find(p => p.kind === 'birdbath'), g = at(b.x, 0, b.z, 0);
    put(lathe([[0, 0], [.2, 0], [.2, .06], [.1, .12], [.08, .5], [.1, .6], [.34, .72], [.36, .78], [.32, .78], [.12, .68], [0, .68]], 40), M.sandstone, 0, 0, 0, 0, g);
    const wm = new THREE.MeshStandardMaterial({ color: 0x22302c, roughness: .04, envMapIntensity: 1.4 });
    const surf = put(new THREE.CircleGeometry(.315, 32).rotateX(-Math.PI / 2), wm, 0, .75, 0, 0, g, false);
    const bub = put(new THREE.SphereGeometry(.035, 16, 8, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe8f4f4, transparent: true, opacity: .55, roughness: .05 }), 0, .75, 0, 0, g, false);
    streams.push({ bubble: bub, surf });
  }

  /* ---------- rocks, a log, hives, pots, beds, a wheelbarrow ---------- */
  const moss = new THREE.Color(0x4f6a2c), grey = new THREE.Color(1, 1, 1);
  const tintUp = (geo, col, amt) => {                        // moss on the upward faces
    const n = geo.attributes.normal, c = new Float32Array(n.count * 3), k = new THREE.Color();
    for (let i = 0; i < n.count; i++) { const t = clamp((n.getY(i) - .45) * 2.2, 0, 1) * amt; k.copy(grey).lerp(col, t); c.set([k.r, k.g, k.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return geo;
  };
  for (const r of L.PROPS.filter(p => p.kind === 'rock')) {
    const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 5).deleteAttribute('normal').deleteAttribute('uv')), p = geo.attributes.position, v = new THREE.Vector3(), rr = L.mulberry(r.seed);
    const ph = [rr() * 9, rr() * 9, rr() * 9];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const k = 1 + .16 * Math.sin(v.x * 2.1 + ph[0]) * Math.sin(v.z * 1.7 + ph[1]) + .08 * Math.sin(v.y * 4 + v.x * 3 + ph[2]) + .03 * Math.sin(v.x * 11 + v.z * 9);
      v.multiplyScalar(k); v.y = v.y > 0 ? v.y * .72 : v.y * .3;
      p.setXYZ(i, v.x * r.r, v.y * r.r, v.z * r.r * .85);
    }
    geo.computeVertexNormals();
    const uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + p.getZ(i) * .7) / 1.2; uv[i * 2 + 1] = p.getY(i) / 1.2 + p.getZ(i) * .3; }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    put(tintUp(geo, moss, .55), M.granite, r.x, -.08 * r.r, r.z, rr() * TAU);
  }
  {
    const lg = L.PROPS.find(p => p.kind === 'log'), g = at(lg.x, 0, lg.z, lg.yaw);
    const geo = new THREE.CylinderGeometry(.21, .25, 3.2, 20, 12);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 + .06 * Math.sin(y * 3))); p.setZ(i, p.getZ(i) * (1 + .05 * Math.cos(y * 2.3))); }
    geo.computeVertexNormals(); geo.rotateX(Math.PI / 2);
    put(tintUp(geo, moss, .85), M.bark, 0, .2, 0, 0, g);
    const ends = new THREE.MeshStandardMaterial({ color: 0x9a7a55, roughness: .9 });
    for (const s of [-1, 1]) put(new THREE.CircleGeometry(s > 0 ? .245 : .205, 20), ends, 0, .2, s * 1.601, s > 0 ? 0 : Math.PI, g, false);
    const br = new THREE.CylinderGeometry(.03, .06, .9, 8).rotateZ(1).translate(.3, .45, .6);
    put(br, M.bark, 0, 0, 0, 0, g);
  }
  for (const h of L.PROPS.filter(p => p.kind === 'hive')) {   // white WBC hives on their legs
    const g = at(h.x, 0, h.z, h.yaw), parts = [];
    for (const [x, z] of [[-.22, -.22], [.22, -.22], [-.22, .22], [.22, .22]]) parts.push(box(.05, .3, .05).translate(x, .15, z));
    parts.push(box(.58, .05, .58).translate(0, .32, 0));
    for (let i = 0; i < 4; i++) parts.push(box(.54 - (i % 2) * .02, .2, .54 - (i % 2) * .02).translate(0, .45 + i * .21, 0));
    put(mergeGeometries(parts), M.paint, 0, 0, 0, 0, g);
    const roof = new THREE.CylinderGeometry(0, .46, .22, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 1);
    put(roof, M.paint, 0, 1.4, 0, 0, g);
    put(box(.3, .02, .03), M.iron, 0, .37, .28, 0, g);
  }
  const pots = [...L.PROPS.filter(p => p.kind === 'pot'), ...L.TREES.filter(t => t.kind === 'olive' || t.kind === 'lemon').map(t => ({ x: t.x, z: t.z, r: t.kind === 'olive' ? .55 : .42 }))];
  for (const p of pots) {
    const r = p.r, h = r * 1.35;
    put(lathe([[0, .01], [r * .62, 0], [r * .7, .02], [r * .95, h * .82], [r * 1.02, h * .85], [r * 1.04, h], [r * .93, h], [r * .92, h * .9], [0, h * .9]], 36), M.terracotta, p.x, 0, p.z);
    put(new THREE.CircleGeometry(r * .9, 28).rotateX(-Math.PI / 2), M.soil, p.x, h * .93, p.z, 0, group, false);
    p.top = h * .93;
  }
  for (const b of L.BEDS.filter(b => b.raised)) {             // oak sleepers round the kitchen beds
    const [[x0, z0], , [x1, z1]] = b.pts, parts = [], t = .12, h = .32;
    parts.push(box(x1 - x0, h, t).translate((x0 + x1) / 2, h / 2, z0 + t / 2), box(x1 - x0, h, t).translate((x0 + x1) / 2, h / 2, z1 - t / 2));
    parts.push(box(t, h, z1 - z0 - 2 * t).translate(x0 + t / 2, h / 2, (z0 + z1) / 2), box(t, h, z1 - z0 - 2 * t).translate(x1 - t / 2, h / 2, (z0 + z1) / 2));
    put(mergeGeometries(parts), M.oak, 0, 0, 0, 0, group);
    const sm = M.soil.clone(); sm.map = M.soil.map.clone(); sm.map.repeat.set((x1 - x0) / 1.1, (z1 - z0) / 1.1); sm.map.needsUpdate = true;
    put(box(x1 - x0 - 2 * t, .02, z1 - z0 - 2 * t), sm, (x0 + x1) / 2, h - .04, (z0 + z1) / 2, 0, group, false);
    b.soilY = h - .03;
  }
  {
    const w = L.PROPS.find(p => p.kind === 'wheelbarrow'), g = at(w.x, 0, w.z, w.yaw);
    const tray = lathe([[0, 0], [.25, 0], [.4, .28], [.37, .28], [.23, .025], [0, .025]], 4);
    tray.rotateY(Math.PI / 4); tray.scale(1.25, 1, .8);
    put(tray, new THREE.MeshStandardMaterial({ color: 0x3e6b4c, roughness: .45, metalness: .5, side: THREE.DoubleSide }), 0, .32, 0, 0, g);
    put(new THREE.CylinderGeometry(.34, .34, .02, 24).scale(1.2, 1, .75), M.soil, 0, .56, 0, 0, g, false);
    put(new THREE.TorusGeometry(.17, .045, 10, 24).rotateY(Math.PI / 2), M.iron, 0, .2, .62, 0, g);
    for (const s of [-1, 1]) { const hnd = put(box(.04, .04, 1.3), M.oak, s * .24, .36, -.2, 0, g); hnd.rotation.x = -.12; put(box(.035, .3, .035), M.iron, s * .2, .16, -.2, 0, g); }
  }

  // Everything that doesn't move is merged, one mesh per material, so the GPU gets a few big batches.
  const moving = new Set([chairHit, ...streams.flatMap(s => [s.mesh, s.surf, s.bubble]).filter(Boolean)]);
  chime.traverse(o => moving.add(o));
  bake(group, moving);

  /* ---------- per frame ---------- */
  function update(t) {
    const g = U.uGust.value;
    chime.rotation.set(Math.sin(t * 1.1) * .05 * (.2 + g), 0, Math.sin(t * 1.37 + 1) * .07 * (.2 + g));
    chime.userData.tubes.forEach((tb, k) => tb.rotation.set(Math.sin(t * (2.1 + k * .3) + k) * .12 * g, 0, Math.cos(t * (1.8 + k * .25) + k * 2) * .12 * g));
    chime.userData.sail.rotation.y = Math.sin(t * .7) * 1.2 * (.3 + g);
    for (const s of streams) {
      if (s.mesh) { s.mesh.scale.x = s.mesh.scale.z = 1 + .15 * Math.sin(t * 23); s.surf.position.y = s.base + .002 * Math.sin(t * 9); }
      if (s.bubble) s.bubble.scale.set(1 + .12 * Math.sin(t * 7.3), .8 + .35 * Math.sin(t * 5.1) ** 2, 1 + .12 * Math.cos(t * 6.7));
    }
  }
  function surfaceAt(x, z) {
    for (const p of L.PATHS) if (p.kind === 'brick' && L.lineDist(p.pts, x, z) < p.w / 2) return 'stone';
    if (x > ter.x0 && x < ter.x1 && z > ter.z0 && z < ter.z1) return 'stone';
    for (const s of stones) if (Math.hypot(x - s.x, z - s.z) < s.r * .9) return 'stone';
    return null;
  }
  return { chairHit, update, surfaceAt, pots };
}
