// Models for the garden cards. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;

// Give vertices that share a position one shared normal, so seams on bent or displaced geometry don't show.
function weld(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, groups = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${Math.round(p.getX(i) * 1e4)}|${Math.round(p.getY(i) * 1e4)}|${Math.round(p.getZ(i) * 1e4)}`;
    const a = groups.get(key); a ? a.push(i) : groups.set(key, [i]);
  }
  for (const a of groups.values()) {
    if (a.length < 2) continue;
    let x = 0, y = 0, z = 0;
    for (const i of a) { x += n.getX(i); y += n.getY(i); z += n.getZ(i); }
    const l = Math.hypot(x, y, z) || 1;
    for (const i of a) n.setXYZ(i, x / l, y / l, z / l);
  }
  return geo;
}

const curveOf = (k, pts, closed = false) => new k.THREE.CatmullRomCurve3(pts.map(q => new k.THREE.Vector3(...q)), closed);

// A tube along a curve whose radius changes along the way: rad(s, L) is the radius at arc length s (of L).
// o.flat squashes the cross-section along o.up (default y). o.seg, o.rs: segment counts.
function varTube(k, curve, rad, o = {}) {
  const T = k.THREE, seg = o.seg ?? 120, rs = o.rs ?? 28, L = curve.getLength();
  const geo = new T.TubeGeometry(curve, seg, 1, rs, false);
  const p = geo.attributes.position, P = new T.Vector3(), v = new T.Vector3(), h = new T.Vector3();
  const up = new T.Vector3(...(o.up ?? [0, 1, 0])).normalize(), flat = o.flat ?? 1;
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, P);
    const r = rad(i / seg * L, L);
    for (let j = 0; j <= rs; j++) {
      const n = i * (rs + 1) + j;
      v.fromBufferAttribute(p, n).sub(P);
      const a = v.dot(up);
      h.copy(v).addScaledVector(up, -a).multiplyScalar(r);
      v.copy(P).add(h).addScaledVector(up, a * r * flat);
      p.setXYZ(n, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return weld(geo);
}
// Round both ends of a varTube: radius r0 along the middle, closing over the last `cap` of length at each end.
const capped = (r0, cap0, cap1 = cap0) => (s, L) => {
  let r = typeof r0 === 'function' ? r0(s, L) : r0;
  if (cap0 > 0 && s < cap0) { const q = s / cap0; r *= Math.sqrt(Math.max(0, q * (2 - q))); }
  if (cap1 > 0 && L - s < cap1) { const q = (L - s) / cap1; r *= Math.sqrt(Math.max(0, q * (2 - q))); }
  return r;
};

// A point on an ellipsoid (centre c, radii r) in direction d, with the surface normal there.
function onBall(k, c, r, d) {
  const T = k.THREE, u = new T.Vector3(...d).normalize();
  return { p: new T.Vector3(c[0] + r[0] * u.x, c[1] + r[1] * u.y, c[2] + r[2] * u.z), n: new T.Vector3(u.x / r[0], u.y / r[1], u.z / r[2]).normalize() };
}
// Turn an object so its own axis (default +y) points along n.
const aim = (k, obj, n, axis = [0, 1, 0]) => { obj.quaternion.setFromUnitVectors(new k.THREE.Vector3(...axis), n.clone().normalize()); return obj; };
// A rod (cylinder) from a to b.
const rod = (k, a, b, r, mat, seg = 16) => {
  const A = new k.THREE.Vector3(...a), B = new k.THREE.Vector3(...b), d = B.clone().sub(A);
  const m = k.mesh(k.cyl(r, r, d.length(), { seg }), mat);
  m.position.copy(A).addScaledVector(d, .5);
  return aim(k, m, d);
};
// A puffy cushion, w (x) × d (z), t thick in the middle, seamed all round.
function pillowGeo(k, w, d, t, n = 24) {
  const T = k.THREE;
  return k.merge([1, -1].map(side => {
    const g = new T.PlaneGeometry(2, 2, n, n), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), v = p.getY(i);
      const f = Math.pow(Math.max(0, 1 - u * u), .42) * Math.pow(Math.max(0, 1 - v * v), .42);
      p.setXYZ(i, u * w / 2 * (1 - .06 * (1 - v * v)), side * f * t / 2, -side * v * d / 2 * (1 - .06 * (1 - u * u)));
    }
    g.computeVertexNormals();
    return g;
  }));
}
// Soft puffs of smoke or steam: camera-facing cards with a cloudy texture. spots: [[x, y, z, size, opacity], ...]
function puffs(k, g, spots, color = '#ffffff', view = { az: 30, el: 16 }) {
  const T = k.THREE, tex = k.tex(128, 128, (c, w, h) => {
    for (const [x, y, r] of [[.5, .55, .42], [.36, .45, .26], [.64, .42, .28], [.5, .34, .24]]) {
      const gr = c.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
      gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }
  });
  for (const [x, y, z, size, opacity] of spots) {
    const m = k.mesh(k.plane(size, size), new T.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false }), { p: [x, y, z], shadow: false });
    m.rotation.order = 'YXZ'; m.rotation.set(-k.deg(view.el), k.deg(view.az), 0);
    m.receiveShadow = false; g.add(m);
  }
}

export default {
  // A terracotta pot with a blue-green echeveria rosette.
  flowerpot(k) {
    const g = k.group();
    const clay = k.matte('#c9653a', .78);
    k.add(g, k.lathe([[0, 0], [.78, 0], [.8, .04], [.98, 1.2], [1.12, 1.22], [1.14, 1.6], [1.02, 1.62], [.99, 1.5], [0, 1.5]]), clay);
    k.add(g, k.lathe([[0, 1.42], [.99, 1.42], [.9, 1.52], [.6, 1.56], [0, 1.58]], { smooth: true }), k.matte('#3b2518', .95));   // soil
    // Fleshy pointed leaves, blue-green going pink at the tips, in rings: [count, tilt out from upright (deg), length, width]
    const leafGeo = k.lathe([[0, 0], [.16, .06], [.28, .26], [.3, .5], [.22, .78], [.08, .95], [0, 1]], { smooth: true, seg: 20, samples: 30 });
    const lp = leafGeo.attributes.position;
    for (let i = 0; i < lp.count; i++) { const y = lp.getY(i); lp.setZ(i, lp.getZ(i) - .28 * y * y); }   // tips curl up
    leafGeo.computeVertexNormals();
    const leaf = k.painted(4, 64, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#d8648a'); gr.addColorStop(.06, '#d38fa6'); gr.addColorStop(.2, '#7fbca6'); gr.addColorStop(1, '#4a8a78');   // canvas top = leaf tip
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }, { rough: .45, coat: .35 });
    const rings = [[10, 70, 1.0, .44], [8, 54, .9, .42], [7, 38, .78, .38], [5, 24, .62, .33], [3, 10, .45, .26]];
    rings.forEach(([n, tilt, len, wid], j) => {
      for (let i = 0; i < n; i++) {
        const spin = k.group([], { p: [0, 1.52 + j * .04, 0], r: [0, (i / n) * k.TAU + j * .5, 0] });
        const lean = k.group([], { r: [k.deg(tilt), 0, 0] });
        k.add(lean, leafGeo, leaf, { s: [wid / .3, len, wid * .5 / .3] });
        spin.add(lean); g.add(spin);
      }
    });
    return g;
  },

  // A steel trowel stuck in a little mound of soil, with an evicted worm.
  trowel(k) {
    const T = k.THREE, g = k.group();
    const steel = k.metal('#d6dbe1', .2, { side: T.DoubleSide }), L = 2.6, Wm = .86, dip = .24;
    const hw = t => t < .72 ? Wm * Math.pow(Math.max(0, 1 - (1 - t / .72) ** 2), .62) : Wm * (1 - .5 * ((t - .72) / .28) ** 2);
    const bz = (s, t) => -dip * (1 - s * s) * (hw(t) / Wm) - .12 * t * t;
    const blade = new T.PlaneGeometry(1, 1, 24, 60), bp = blade.attributes.position;
    for (let i = 0; i < bp.count; i++) { const s = bp.getX(i) * 2, t = bp.getY(i) + .5; bp.setXYZ(i, s * hw(t), t * L, bz(s, t)); }
    blade.computeVertexNormals();
    const tool = k.group([], { p: [0, .06, 0], r: [-.22, 0, -.26] });
    const turn = k.group([tool], { r: [0, .5, 0] }); g.add(turn);
    k.add(tool, blade, steel);
    const edge = [];
    for (let i = 0; i <= 24; i++) { const t = 1 - (i / 24) ** 1.6; edge.push([-hw(t), t * L, bz(-1, t)]); }
    for (let i = 1; i <= 24; i++) { const t = (i / 24) ** 1.6; edge.push([hw(t), t * L, bz(1, t)]); }
    for (let i = 1; i < 12; i++) { const s = 1 - i / 6; edge.push([s * hw(1), L, bz(s, 1)]); }
    k.add(tool, k.tube(edge, .022, { closed: true, seg: 240, rs: 8 }), steel);
    // shank, ferrule and a wooden handle with a red-dipped end
    k.add(tool, k.tube([[0, L - .14, -.3], [0, L + .08, -.25], [0, L + .3, -.05], [0, L + .5, .14], [0, L + .66, .2]], .08, { caps: true, rs: 12 }), steel);
    const hy = L + .62;
    k.add(tool, k.lathe([[.11, 0], [.165, .02], [.165, .24], [.145, .26], [0, .26]]), k.brass(), { p: [0, hy, .2] });
    k.add(tool, k.lathe([[.14, 0], [.17, .1], [.2, .4], [.225, .75], [.225, 1.0], [.2, 1.2], [.14, 1.32], [0, 1.36]], { smooth: true }), k.wood('oak', { varnish: .7, rough: .4 }), { p: [0, hy + .24, .2] });
    k.add(tool, k.lathe([[.226, .96], [.23, .98], [.205, 1.2], [.145, 1.325], [0, 1.37]], { smooth: true }), k.gloss('#d7362c'), { p: [0, hy + .24, .2] });
    // soil mound with clods
    const soil = k.matte('#4b3122', .96), soilDark = k.matte('#3a2519', .96);
    const mound = k.lathe([[0, 0], [1.25, 0], [1.12, .1], [.9, .28], [.55, .45], [.22, .51], [0, .52]], { smooth: true, seg: 48 });
    const mp = mound.attributes.position;
    for (let i = 0; i < mp.count; i++) {
      const x = mp.getX(i), y = mp.getY(i), z = mp.getZ(i), a = Math.atan2(z, x);
      if (y > .01) { const f = 1 + .07 * Math.sin(a * 5 + 1) + .05 * Math.sin(a * 11 + 2); mp.setXYZ(i, x * f, y * (1 + .1 * Math.sin(a * 7)), z * f); }
    }
    mound.computeVertexNormals(); weld(mound);
    k.add(g, mound, soil);
    const clods = [];
    for (let i = 0; i < 22; i++) { const a = k.range(0, TAU), r = k.range(.3, 1.25), s = k.range(.05, .12); clods.push({ p: [Math.cos(a) * r, Math.max(0, .52 * (1 - (r / 1.25) ** 2)) + s * .3, Math.sin(a) * r], s: [s, s * .75, s] }); }
    g.add(k.instances(k.sphere(1, { w: 10, h: 8 }), soilDark, clods));
    // a worm, arching out of the dirt
    const worm = k.plastic('#e58c93', { rough: .5, coat: .3 });
    const wc = curveOf(k, [[-.55, .2, .62], [-.62, .5, .7], [-.68, .76, .7], [-.82, .9, .64], [-.97, .88, .58]]);
    k.add(g, varTube(k, wc, capped(.07, 0, .07), { seg: 60, rs: 14 }), worm);
    k.add(g, varTube(k, curveOf(k, [0, 1, 2].map(i => wc.getPointAt(.5 + i * .06).toArray())), capped(.079, .02), { seg: 12, rs: 14 }), k.plastic('#d4717c', { rough: .5 }));
    return g;
  },

  // A pistol-grip hose nozzle: die-cast body, orange grip, a dial of spray patterns and a brass coupling.
  nozzle(k) {
    const T = k.THREE, g = k.group(), n = k.group([], { r: [0, -.4, 0] }); g.add(n);
    const metal = k.metal('#dfe3e8', .2), rubber = k.plastic('#f07b1d', { rough: .55, coat: .2 }), dark = k.plastic('#26282c', { rough: .5, coat: .2 });
    const by = 2.1, br = .27;
    k.add(n, k.rcyl(br, 1.9, .1, { seg: 40 }), metal, { p: [-.98, by, 0], r: [0, 0, -Math.PI / 2] });          // barrel
    const frame = new T.Shape();
    frame.moveTo(-.26, by); frame.quadraticCurveTo(-.4, 1.8, -.45, 1.65); frame.lineTo(-.6, .82); frame.quadraticCurveTo(-.62, .7, -.72, .7);
    frame.lineTo(-1.02, .7); frame.quadraticCurveTo(-1.1, .7, -1.08, .82); frame.lineTo(-.98, by); frame.closePath();
    k.add(n, k.extrude(frame, .34, { bevel: .08 }), metal);
    // rubber overmould on the grip, with finger scallops
    const grip = new T.Shape();
    grip.moveTo(-.41, 1.7);
    for (let i = 0; i < 3; i++) { const y0 = 1.7 - i * .3, x0 = -.41 - i * .05; grip.quadraticCurveTo(x0 + .06, y0 - .15, x0 - .05, y0 - .3); }
    grip.lineTo(-.6, .8); grip.quadraticCurveTo(-.62, .74, -.7, .74); grip.lineTo(-1.04, .74); grip.quadraticCurveTo(-1.09, .76, -1.08, .84);
    grip.lineTo(-1.0, 1.7); grip.closePath();
    k.add(n, k.extrude(grip, .44, { bevel: .09 }), rubber);
    // trigger and its lock clip
    const trig = k.shape([[.55, 1.86], [.45, 1.7], [.2, 1.45], [.02, 1.15], [-.12, .96], [-.2, .9], [-.26, .96], [-.14, 1.22], [.06, 1.52], [.28, 1.76], [.4, 1.86]]);
    k.add(n, k.extrude(trig, .2, { bevel: .05 }), k.metal('#aab1bb', .28));
    k.add(n, k.box(.12, .12, .46, .04), k.plastic('#d8342a', { rough: .4 }), { p: [-.3, 1.15, 0], r: [0, 0, .3] });
    // pattern dial
    const cx = .9, cy = by - .02, dr = .44;
    k.add(n, k.torus(br + .01, .035, { rs: 8, ts: 40 }), k.chrome(), { p: [.88, by, 0], r: [0, Math.PI / 2, 0] });
    k.add(n, k.rcyl(dr, .28, .06, { seg: 48 }), rubber, { p: [cx, cy, 0], r: [0, 0, -Math.PI / 2] });
    const ribs = [];
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; ribs.push({ p: [cx + .14, cy + Math.cos(a) * (dr + .005), Math.sin(a) * (dr + .005)], r: [a, 0, 0] }); }
    n.add(k.instances(k.box(.18, .04, .05, .015), rubber, ribs));
    const face = k.painted(256, 256, (c, w, h) => {
      const m = w / 2;
      c.fillStyle = '#e3e6ea'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#c4cad2'; c.beginPath(); c.arc(m, m, 40, 0, TAU); c.fill();
      const names = ['JET', 'MIST', 'SHOWER', 'CONE', 'FLAT', 'SOAK'];
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU, px = m + Math.sin(a) * 70, py = m - Math.cos(a) * 70;
        c.fillStyle = '#2a2d33';
        if (i === 0) { c.beginPath(); c.arc(px, py, 8, 0, TAU); c.fill(); }
        else for (let j = 0; j < 3 + i * 2; j++) { const b = j / (3 + i * 2) * TAU, rr = 6 + (i % 2) * 5; c.beginPath(); c.arc(px + Math.cos(b) * rr, py + Math.sin(b) * rr, 2.6, 0, TAU); c.fill(); }
        c.save(); c.translate(m + Math.sin(a) * 106, m - Math.cos(a) * 106); c.rotate(a);
        k.text(c, names[i], 0, 0, { size: 16, weight: 800, color: '#e8661a', font: 'Nunito, sans-serif' }); c.restore();
      }
    }, { rough: .45 });
    k.add(n, k.disc(dr - .05, 48), face, { p: [cx + .285, cy, 0], r: [0, Math.PI / 2, 0] });
    k.add(n, k.cone(.07, .12, 3), k.plastic('#d8342a'), { p: [.74, by + br + .02, 0], r: [0, 0, -Math.PI / 2] });   // pattern pointer
    // brass coupling at the foot of the grip
    const cp = k.group([], { p: [-.86, .72, 0], r: [0, 0, -.09] }); n.add(cp);
    k.add(cp, k.cyl(.2, .2, .44, { seg: 32 }), k.brass(), { p: [0, -.2, 0] });
    for (let i = 0; i < 5; i++) k.add(cp, k.torus(.2, .018, { rs: 8, ts: 40 }), k.brass(), { p: [0, -.38 + i * .08, 0], r: [Math.PI / 2, 0, 0] });
    k.add(cp, k.cyl(.23, .23, .06, { seg: 32 }), dark, { p: [0, -.02, 0] });
    g.userData.view = { az: 24 };
    return g;
  },

  // A galvanised watering can with a brass rose.
  wateringcan(k) {
    const T = k.THREE, g = k.group(), can = k.group([], { r: [0, -.42, 0] }); g.add(can);
    const spangle = k.tex(512, 512, (c, w, h) => {
      c.fillStyle = '#c9ced4'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 300; i++) {
        const x = k.rand() * w, y = k.rand() * h, r = 10 + k.rand() * 28, v = 165 + k.rand() * 70 | 0, sides = 5 + (k.rand() * 3 | 0);
        c.fillStyle = `rgba(${v},${v + 4},${v + 9},.5)`; c.beginPath();
        for (let j = 0; j < sides; j++) { const a = j / sides * TAU + k.rand() * .5, rr = r * (.6 + k.rand() * .5); j ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        c.closePath(); c.fill();
      }
    }, { repeat: [3, 2] });
    const galv = k.metal('#ffffff', .34, { map: spangle }), zinc = k.metal('#c6ccd3', .3), brass = k.brass();
    k.add(can, k.lathe([[0, 0], [.98, 0], [1.0, .06], [.92, 1.72], [0, 1.72]]), galv);
    k.add(can, k.lathe([[.925, 1.7], [.86, 1.79], [.6, 1.9], [.3, 1.95], [0, 1.96]], { smooth: true }), galv);
    for (const [y, R, r] of [[.05, 1.0, .055], [.88, .965, .03], [1.71, .925, .05]]) k.add(can, k.torus(R, r, { rs: 10, ts: 72 }), zinc, { p: [0, y, 0], r: [Math.PI / 2, 0, 0] });
    // filler opening at the back of the top
    k.add(can, k.cyl(.3, .31, .16, { open: true, seg: 40 }), galv, { p: [-.4, 1.95, 0] });
    k.add(can, k.torus(.3, .045, { rs: 10, ts: 48 }), zinc, { p: [-.4, 2.03, 0], r: [Math.PI / 2, 0, 0] });
    k.add(can, k.disc(.3, 36), k.matte('#1e2226', .8), { p: [-.4, 2.0, 0], r: [-Math.PI / 2, 0, 0] });
    // spout and rose
    const sc = curveOf(k, [[.7, .3, 0], [1.05, .45, 0], [1.55, 1.0, 0], [2.05, 1.62, 0], [2.36, 2.02, 0]]);
    k.add(can, varTube(k, sc, s => .17 - .08 * s / sc.getLength(), { seg: 60, rs: 20 }), galv);
    const end = sc.getPointAt(1), dir = sc.getTangentAt(1);
    const rose = aim(k, k.group([], { p: end.toArray() }), dir); can.add(rose);
    k.add(rose, k.lathe([[.085, -.06], [.11, .04], [.2, .16], [.28, .25], [.3, .3], [0, .3]]), brass);
    const holes = k.painted(128, 128, (c, w, h) => {
      c.fillStyle = '#c8973f'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#3b2a12';
      for (let r = 10; r < 56; r += 11) for (let i = 0, n = Math.round(r * .55); i < n; i++) { const a = i / n * TAU; c.beginPath(); c.arc(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 2.2, 0, TAU); c.fill(); }
      c.beginPath(); c.arc(w / 2, h / 2, 2.2, 0, TAU); c.fill();
    }, { metal: 1, rough: .3 });
    k.add(rose, k.disc(.3, 40), holes, { p: [0, .301, 0], r: [-Math.PI / 2, 0, 0] });
    k.add(can, k.tube([sc.getPointAt(.45).toArray(), [1.2, 1.12, 0], [.9, 1.3, 0]], .035, { rs: 8 }), zinc);   // brace
    // handles: an arch over the top and one at the back
    k.add(can, k.tube([[.62, 1.76, 0], [.52, 2.28, 0], [0, 2.62, 0], [-.52, 2.38, 0], [-.78, 1.82, 0]], .065, { caps: true, rs: 12 }), zinc);
    k.add(can, k.tube([[-.86, 1.58, 0], [-1.3, 1.42, 0], [-1.36, .98, 0], [-1.22, .6, 0], [-.96, .46, 0]], .06, { caps: true, rs: 12 }), zinc);
    g.userData.view = { az: 26 };
    return g;
  },

  // A painted resin garden gnome: red hat, white beard, blue coat.
  gnome(k) {
    const T = k.THREE, g = k.group();
    const paint = (c, r = .42) => k.plastic(c, { rough: r, coat: .6, coatRough: .2 });
    const red = paint('#d7332b'), blue = paint('#2e6fd2'), white = paint('#f6f3ec', .55), skin = paint('#f3c4a0', .5), rosy = paint('#ec8a7c', .45);
    const boot = paint('#4a2d1c', .5), belt = paint('#3b2415', .45);
    for (const s of [-1, 1]) k.add(g, k.sphere(.3), boot, { p: [s * .3, .18, .4], s: [1, .62, 1.45] });
    k.add(g, k.lathe([[0, .15], [.8, .15], [.88, .3], [.92, .65], [.87, 1.1], [.75, 1.5], [.6, 1.82], [.42, 2.02], [0, 2.08]], { smooth: true }), blue);
    k.add(g, k.torus(.9, .075, { rs: 12, ts: 64 }), belt, { p: [0, .98, 0], r: [Math.PI / 2, 0, 0] });
    const buckle = k.roundRect(.36, .3, .06); buckle.holes.push(k.roundRect(.2, .15, .03));
    k.add(g, k.extrude(buckle, .04, { bevel: .02 }), k.gold(), { p: [0, .98, .955] });
    // arms, with hands on the belt
    for (const s of [-1, 1]) {
      const S = [s * .6, 1.76, .08], E = [s * .84, 1.36, .38], Hn = [s * .44, 1.2, .8];
      k.add(g, k.tube([S, E, Hn], .16, { caps: true, rs: 14 }), blue);
      k.add(g, k.sphere(.15), skin, { p: [Hn[0] * .9, Hn[1] - .02, Hn[2] + .07] });
    }
    // beard, face and moustache
    k.add(g, k.lathe([[0, 0], [.14, .06], [.32, .26], [.46, .56], [.5, .82], [.46, 1.0], [.32, 1.1], [0, 1.14]], { smooth: true }), white, { p: [0, .95, .55], s: [1, 1, .55] });
    k.add(g, k.sphere(.44), skin, { p: [0, 2.26, .3] });
    k.add(g, k.sphere(.17), rosy, { p: [0, 2.2, .76] });
    for (const s of [-1, 1]) {
      k.add(g, k.sphere(.12), rosy, { p: [s * .25, 2.17, .62], s: [1, .8, .6] });
      k.add(g, k.sphere(.065), k.gloss('#1c1410'), { p: [s * .16, 2.34, .7] });
      k.add(g, k.sphere(.018), k.glow('#ffffff', 1), { p: [s * .16 + .02, 2.36, .76] });
      k.add(g, k.sphere(.08), white, { p: [s * .17, 2.46, .68], s: [1.4, .6, .7], r: [0, 0, s * -.25] });
      k.add(g, k.sphere(.15), white, { p: [s * .15, 2.06, .74], s: [1.3, .6, .7], r: [0, 0, s * .45] });
    }
    // hat, its tip flopping over
    const hat = k.lathe([[0, 0], [.6, 0], [.62, .1], [.5, .6], [.34, 1.12], [.18, 1.55], [.05, 1.85], [0, 1.92]], { smooth: true });
    const hp = hat.attributes.position;
    for (let i = 0; i < hp.count; i++) { const y = hp.getY(i), f = Math.max(0, y - .7) / 1.2; hp.setX(i, hp.getX(i) + .55 * f * f); hp.setY(i, y - .12 * f * f); }
    hat.computeVertexNormals(); weld(hat);
    k.add(g, hat, red, { p: [0, 2.4, .22], r: [-.12, 0, 0] });
    return g;
  },

  // A hose reel cart, wound with bright green hose (neater than it will ever be again).
  hosereel(k) {
    const T = k.THREE, g = k.group();
    const frame = k.plastic('#2c3036', { rough: .45, coat: .4 }), hose = k.plastic('#39c24c', { rough: .35, coat: .5 });
    const flange = k.plastic('#3a3f47', { rough: .4, coat: .4 }), yellow = k.gloss('#f2c230'), rub = k.rubber();
    const ay = 1.35, fx = .78;
    // drum and flanges
    k.add(g, k.cyl(.42, .42, fx * 2, { seg: 40 }), flange, { p: [0, ay, 0], r: [0, 0, Math.PI / 2] });
    for (const s of [-1, 1]) {
      k.add(g, k.rcyl(1.15, .08, .03, { seg: 64 }), flange, { p: [s * (fx + (s > 0 ? 0 : .08)), ay, 0], r: [0, 0, -Math.PI / 2] });
      k.add(g, k.cyl(.16, .16, .14, { seg: 24 }), frame, { p: [s * (fx + .12), ay, 0], r: [0, 0, Math.PI / 2] });
    }
    // hose windings: rows of rings across the drum, three layers
    const hr = .08;
    for (let layer = 0; layer < 3; layer++) {
      const rings = [];
      for (let i = 0; i < 9 - (layer % 2); i++) rings.push({ p: [-fx + hr + (i + (layer % 2) * .5) * (fx * 2 - hr * 2) / 8, ay, 0], r: [layer * .7, Math.PI / 2, layer % 2 ? .05 : -.05] });
      g.add(k.instances(k.torus(.52 + layer * .15, hr, { rs: 10, ts: 64 }), hose, rings));
    }
    // the loose end: off the front of the drum, across the lawn, to a nozzle
    const hc = curveOf(k, [[.35, ay - .3, .76], [.4, ay - .8, .95], [.5, .4, 1.25], [.62, .09, 1.55], [1.0, .08, 1.85], [1.6, .08, 1.8], [2.0, .08, 1.45]]);
    k.add(g, k.tube(hc.getPoints(80).map(v => v.toArray()), hr, { seg: 120, rs: 12 }), hose);
    const tip = aim(k, k.group([], { p: hc.getPointAt(1).toArray() }), hc.getTangentAt(1)); g.add(tip);
    k.add(tip, k.cyl(.11, .11, .16, { seg: 24 }), k.brass(), { p: [0, .06, 0] });
    k.add(tip, k.lathe([[.1, 0], [.1, .12], [.075, .38], [.05, .44], [0, .44]]), yellow, { p: [0, .14, 0] });
    // side frames: legs to a front foot bar and back wheels, up to a handle
    for (const s of [-1, 1]) {
      const x = s * (fx + .2);
      g.add(rod(k, [x, ay, 0], [x, .08, .95], .06, frame));
      g.add(rod(k, [x, ay, 0], [x, .42, -.75], .06, frame));
      g.add(rod(k, [x, ay, 0], [x, 2.55, -.55], .06, frame));
      k.add(g, k.sphere(.1), frame, { p: [x, ay, 0] });
      const wheel = k.group([], { p: [s * (fx + .42), .42, -.75], r: [0, 0, Math.PI / 2] }); g.add(wheel);
      k.add(wheel, k.torus(.3, .12, { rs: 12, ts: 40 }), rub, { r: [Math.PI / 2, 0, 0] });
      k.add(wheel, k.cyl(.27, .27, .16, { seg: 32 }), yellow);
      k.add(wheel, k.cyl(.08, .08, .22, { seg: 16 }), frame);
    }
    g.add(rod(k, [-(fx + .2), .08, .95], [fx + .2, .08, .95], .065, frame));
    g.add(rod(k, [-(fx + .42), .42, -.75], [fx + .42, .42, -.75], .04, frame));
    const bar = rod(k, [-(fx + .2), 2.55, -.55], [fx + .2, 2.55, -.55], .06, frame); g.add(bar);
    k.add(g, k.cyl(.085, .085, 1.1, { seg: 20 }), yellow, { p: [0, 2.55, -.55], r: [0, 0, Math.PI / 2] });
    // crank
    k.add(g, k.cyl(.05, .05, .3, { seg: 16 }), frame, { p: [fx + .35, ay, 0], r: [0, 0, Math.PI / 2] });
    g.add(rod(k, [fx + .48, ay, 0], [fx + .48, ay + .32, .42], .05, frame));
    k.add(g, k.cyl(.075, .075, .34, { seg: 20 }), yellow, { p: [fx + .62, ay + .32, .42], r: [0, 0, Math.PI / 2] });
    g.userData.view = { az: 34 };
    return g;
  },

  // The pink plastic lawn flamingo on its two wire legs.
  flamingo(k) {
    const T = k.THREE, g = k.group(), f = k.group([], { r: [0, -.3, 0] }); g.add(f);
    const pink = k.gloss('#ff5d9e'), deep = k.gloss('#f0407f'), wire = k.iron();
    const by = 2.75;
    // a teardrop body, round chest forward, tail up behind
    const body = k.lathe([[0, 0], [.42, .12], [.64, .45], [.7, .85], [.63, 1.3], [.46, 1.78], [.24, 2.2], [.06, 2.48], [0, 2.52]], { smooth: true, seg: 48 });
    k.add(f, body, pink, { p: [1.1, by - .12, 0], r: [0, 0, 1.3], s: [1, 1, .84] });
    for (const s of [-1, 1]) {
      k.add(f, k.sphere(1, { w: 40, h: 24 }), deep, { p: [-.05, by + .2, s * .44], s: [1.0, .4, .16], r: [0, 0, -.28] });
      k.add(f, k.sphere(1, { w: 24, h: 16 }), deep, { p: [-.85, by + .45, s * .3], s: [.42, .16, .1], r: [0, 0, -.4] });
    }
    // neck: an S up to the head
    const nc = curveOf(k, [[.95, by + .25, 0], [1.22, by + .75, 0], [1.1, by + 1.3, 0], [.78, by + 1.72, 0], [.84, by + 2.2, 0], [1.14, by + 2.42, 0]]);
    k.add(f, varTube(k, nc, s => .21 - .08 * s / nc.getLength(), { seg: 80, rs: 18 }), pink);
    const head = nc.getPointAt(1);
    k.add(f, k.sphere(.24), pink, { p: head.toArray(), s: [1.15, .95, .9] });
    // bent beak, pale then black at the tip
    const bc = curveOf(k, [[head.x + .15, head.y + .02, 0], [head.x + .42, head.y - .04, 0], [head.x + .56, head.y - .2, 0], [head.x + .56, head.y - .38, 0]]);
    const bl = bc.getLength();
    k.add(f, varTube(k, bc, capped(s => .12 - .075 * s / bl, 0, .04), { seg: 40, rs: 14 }), k.gloss('#fbe3da'));
    const tipC = curveOf(k, [bc.getPointAt(.62).toArray(), bc.getPointAt(.8).toArray(), bc.getPointAt(1).toArray()]);
    const tl = tipC.getLength();
    k.add(f, varTube(k, tipC, capped(s => .124 - .075 * (.62 + .38 * s / tl), 0, .038), { seg: 20, rs: 14 }), k.gloss('#1a1a1a'));
    for (const s of [-1, 1]) {
      k.add(f, k.sphere(.07), k.gloss('#fff3b0'), { p: [head.x + .06, head.y + .07, s * .2] });
      k.add(f, k.sphere(.045), k.gloss('#141414'), { p: [head.x + .08, head.y + .075, s * .245] });
    }
    // wire legs
    for (const s of [-1, 1]) f.add(rod(k, [.05 + s * .08, by - .35, s * .16], [.02 + s * .14, 0, s * .26], .035, wire, 10));
    g.userData.view = { az: 24 };
    return g;
  },

  // A round charcoal kettle grill on three legs, smoking away.
  grill(k) {
    const T = k.THREE, g = k.group();
    const enamel = k.gloss('#18191c'), alu = k.aluminum(), black = k.plastic('#101113', { rough: .5, coat: .3 }), rub = k.rubber();
    const cy = 2.25, R = 1.2;
    const bowl = [], lid = [];
    for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI / 2; bowl.push([R * Math.sin(a) * (i === 16 ? 1 : 1), cy - R * Math.cos(a) * .92]); }
    k.add(g, k.lathe([[0, cy - R * .92], ...bowl.slice(1), [R + .03, cy + .02], [R - .02, cy + .04], [0, cy + .04]]), enamel);
    for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI / 2; lid.push([(R + .03) * Math.cos(a), cy + .06 + R * .9 * Math.sin(a)]); }
    k.add(g, k.lathe([[0, cy + .03], [R + .05, cy + .03], ...lid]), enamel);
    k.add(g, k.torus(R + .04, .025, { rs: 8, ts: 96 }), alu, { p: [0, cy + .05, 0], r: [Math.PI / 2, 0, 0] });
    // lid handle with heat shield, vent and thermometer
    const hp = onBall(k, [0, cy + .06, 0], [R + .03, R * .9, R + .03], [0, .62, 1]);
    const hg = aim(k, k.group([], { p: hp.p.toArray() }), hp.n); g.add(hg);
    for (const x of [-.3, .3]) k.add(hg, k.cyl(.035, .035, .26, { seg: 12 }), alu, { p: [x, .12, 0] });
    k.add(hg, k.capsule(.08, .62), black, { p: [0, .27, 0], r: [0, 0, Math.PI / 2] });
    const vent = onBall(k, [0, cy + .06, 0], [R, R * .9, R], [0, 1, -.45]);
    const v = aim(k, k.group([], { p: vent.p.toArray() }), vent.n); g.add(v);
    k.add(v, k.rcyl(.24, .03, .01, { seg: 32 }), alu);
    for (let i = 0; i < 3; i++) k.add(v, k.cyl(.12, .12, .01, { seg: 16, start: i * TAU / 3, len: .7 }), k.matte('#0b0b0c', .6), { p: [0, .032, 0] });
    k.add(v, k.box(.14, .04, .05, .02), alu, { p: [.24, .04, 0] });
    const th = onBall(k, [0, cy + .06, 0], [R + .03, R * .9, R + .03], [.55, .9, .3]);
    const tg = aim(k, k.group([], { p: th.p.toArray() }), th.n); g.add(tg);
    k.add(tg, k.rcyl(.14, .05, .02, { seg: 32 }), k.chrome());
    const dial = k.painted(128, 128, (c, w, h) => {
      c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#d8342a'; c.lineWidth = 10; c.beginPath(); c.arc(w / 2, h / 2, 46, Math.PI * .8, Math.PI * 1.25); c.stroke();
      c.strokeStyle = '#333'; c.lineWidth = 3; for (let i = 0; i <= 8; i++) { const a = Math.PI * (.8 + i * .175); c.beginPath(); c.moveTo(w / 2 + Math.cos(a) * 40, h / 2 + Math.sin(a) * 40); c.lineTo(w / 2 + Math.cos(a) * 52, h / 2 + Math.sin(a) * 52); c.stroke(); }
      c.strokeStyle = '#d8342a'; c.lineWidth = 5; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + 38, h / 2 - 20); c.stroke();
    });
    k.add(tg, k.disc(.12, 32), dial, { p: [0, .052, 0], r: [-Math.PI / 2, 0, 0] });
    // bowl handles
    for (const s of [-1, 1]) {
      g.add(rod(k, [s * (R - .02), cy - .12, -.12], [s * (R + .22), cy - .12, -.12], .025, alu));
      g.add(rod(k, [s * (R - .02), cy - .12, .12], [s * (R + .22), cy - .12, .12], .025, alu));
      k.add(g, k.capsule(.065, .26), black, { p: [s * (R + .24), cy - .12, 0], r: [Math.PI / 2, 0, 0] });
    }
    // legs, wheels, ash catcher
    const legs = [[Math.PI / 2 + .1, false], [Math.PI / 2 + 2.2, true], [Math.PI / 2 - 2.0, true]];
    for (const [a, wheel] of legs) {
      const top2 = [Math.sin(a) * .82, cy - .78, Math.cos(a) * .82], foot = [Math.sin(a) * 1.3, wheel ? .26 : .03, Math.cos(a) * 1.3];
      g.add(rod(k, top2, foot, .055, alu));
      if (wheel) {
        const w = k.group([], { p: foot, r: [0, a + Math.PI / 2, 0] }); g.add(w);
        k.add(w, k.torus(.2, .07, { rs: 10, ts: 32 }), rub);
        k.add(w, k.cyl(.17, .17, .08, { seg: 24 }), k.plastic('#2a2b2f'), { r: [Math.PI / 2, 0, 0] });
      } else k.add(g, k.sphere(.07), black, { p: [foot[0], .07, foot[2]] });
      g.add(rod(k, [Math.sin(a) * 1.1, .72, Math.cos(a) * 1.1], [0, .72, 0], .02, alu, 8));
    }
    k.add(g, k.lathe([[0, .9], [.46, .9], [.5, 1.02], [.46, 1.04], [.42, .95], [0, .95]]), alu);
    g.add(rod(k, [0, .95, 0], [0, cy - R * .92, 0], .03, alu));
    const vp = vent.p;
    puffs(k, g, [[vp.x, vp.y + .26, vp.z, .5, 1], [vp.x + .1, vp.y + .56, vp.z + .05, .66, .85], [vp.x - .04, vp.y + .9, vp.z + .1, .82, .6]], '#7f8590');
    return g;
  },

  // A square cedar-clad hot tub: bubbling blue water, headrests, a control panel and steps.
  hottub(k) {
    const T = k.THREE, g = k.group();
    const S = 3.2, Hc = 1.25;
    const boards = k.tex(512, 256, (c, w, h) => {
      const n = 11, tones = ['#b9773f', '#a96a35', '#c3844b', '#9f6231', '#b47240'];
      for (let i = 0; i < n; i++) {
        const x0 = i * w / n;
        c.fillStyle = tones[i % tones.length]; c.fillRect(x0, 0, w / n + 1, h);
        c.strokeStyle = 'rgba(85,42,16,.2)';
        for (let j = 0; j < 6; j++) { c.lineWidth = .8 + k.rand() * 1.4; c.beginPath(); const x = x0 + k.rand() * w / n; for (let y = 0; y <= h; y += 16) { const xx = x + Math.sin(y * .04 + j * 2 + i) * 2.5; y ? c.lineTo(xx, y) : c.moveTo(xx, y); } c.stroke(); }
        c.fillStyle = 'rgba(40,18,6,.75)'; c.fillRect(x0, 0, 2.5, h);
      }
    });
    const wood = k.mat({ map: boards, roughness: .62, clearcoat: .25, clearcoatRoughness: .4 }), trim = k.wood('walnut', { varnish: .4 });
    k.add(g, k.box(S, Hc, S), wood, { p: [0, .1 + Hc / 2, 0] });
    k.add(g, k.box(S + .08, .12, S + .08, .03), k.matte('#3a2a20', .8), { p: [0, .06, 0] });
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.add(g, k.box(.2, Hc, .2, .03), trim, { p: [x * (S / 2 - .06), .1 + Hc / 2, z * (S / 2 - .06)] });
    // acrylic shell rim
    const lip = k.roundRect(S + .16, S + .16, .22), hole = k.roundRect(S - .5, S - .5, .55); lip.holes.push(hole);
    const y0 = .1 + Hc, yTop = y0 + .18, yW = y0 + .05;
    k.add(g, k.extrude(lip, .08, { bevel: .05 }), k.gloss('#eeebe6'), { p: [0, y0 + .09, 0], r: [-Math.PI / 2, 0, 0] });
    // water
    const wS = S - .5, water = k.painted(512, 512, (c, w, h) => {
      const gr = c.createRadialGradient(w * .5, h * .55, 20, w * .5, h * .5, w * .62);
      gr.addColorStop(0, '#7fe3f4'); gr.addColorStop(.55, '#33b8dc'); gr.addColorStop(1, '#1480b0');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 2.2;
      for (let i = 0; i < 70; i++) { const x = k.rand() * w, y = k.rand() * h, r = 12 + k.rand() * 26; c.beginPath(); c.moveTo(x - r, y); c.bezierCurveTo(x - r * .3, y - r * .5, x + r * .3, y + r * .5, x + r, y); c.stroke(); }
      const light = c.createRadialGradient(w * .5, h * .9, 0, w * .5, h * .9, 110);
      light.addColorStop(0, 'rgba(230,255,255,.95)'); light.addColorStop(1, 'rgba(230,255,255,0)');
      c.fillStyle = light; c.fillRect(0, 0, w, h);
      for (const [fx, fy] of [[.15, .3], [.85, .3], [.15, .75], [.85, .75], [.5, .12]]) {
        const fr = c.createRadialGradient(fx * w, fy * h, 0, fx * w, fy * h, 60);
        fr.addColorStop(0, 'rgba(255,255,255,.95)'); fr.addColorStop(.5, 'rgba(240,255,255,.55)'); fr.addColorStop(1, 'rgba(240,255,255,0)');
        c.fillStyle = fr; c.fillRect(0, 0, w, h);
      }
    }, { rough: .05, coat: 1, glow: .35 });
    water.map.repeat.set(1 / wS, 1 / wS); water.map.offset.set(.5, .5);
    k.add(g, new T.ShapeGeometry(k.roundRect(wS + .02, wS + .02, .55), 24), water, { p: [0, yW, 0], r: [-Math.PI / 2, 0, 0], shadow: false });
    // bubbles over the jets
    const bubbles = [], jets = [[-.35, -.2], [.35, -.2], [-.35, .25], [.35, .25], [0, -.38]];
    for (const [jx, jz] of jets) for (let i = 0; i < 9; i++) { const a = k.range(0, TAU), r = k.range(0, .3), s = k.range(.025, .07); bubbles.push({ p: [jx * wS + Math.cos(a) * r, yW + s * .3, jz * wS + Math.sin(a) * r], s }); }
    g.add(k.instances(k.sphere(1, { w: 12, h: 8 }), k.mat({ color: '#ffffff', roughness: .15, clearcoat: 1, transparent: true, opacity: .85 }), bubbles));
    // headrests on the back corners
    for (const s of [-1, 1]) k.add(g, pillowGeo(k, .62, .38, .2), k.plastic('#4a4e56', { rough: .55, coat: .3 }), { p: [s * (wS / 2 - .22), yTop + .02, -(wS / 2 + .02)], r: [-.5, s * -.6, 0] });
    // control panel on the front right corner
    const panel = k.group([], { p: [S / 2 - .38, yTop, S / 2 - .1], r: [0, -.1, 0] }); g.add(panel);
    k.add(panel, k.box(.5, .05, .22, .03), k.plastic('#26282d', { rough: .4 }));
    k.add(panel, k.box(.2, .01, .1, .005), k.glow('#56e0ff', 1.6), { p: [-.1, .03, 0] });
    for (const x of [.08, .18]) k.add(panel, k.cyl(.03, .03, .02, { seg: 12 }), k.glow('#9ff0ff', 1.2), { p: [x, .03, 0] });
    // steps
    k.add(g, k.box(1.5, .44, .9, .03), wood, { p: [0, .22, S / 2 + .45] });
    k.add(g, k.box(1.5, .86, .46, .03), wood, { p: [0, .43, S / 2 + .23] });
    k.add(g, k.box(1.54, .05, .94, .02), trim, { p: [0, .46, S / 2 + .45] });
    k.add(g, k.box(1.54, .05, .5, .02), trim, { p: [0, .88, S / 2 + .23] });
    const towel = k.group([], { p: [-.95, yTop + .12, (S + .16) / 2 - .17], r: [0, .12, 0] }); g.add(towel);
    k.add(towel, k.cyl(.12, .12, .72, { seg: 24 }), k.fabric('#2fa7b5'), { r: [0, 0, Math.PI / 2] });
    for (const x of [-.36, .36]) k.add(towel, k.torus(.07, .022, { rs: 6, ts: 24 }), k.fabric('#23808b'), { p: [x, 0, 0], r: [0, Math.PI / 2, 0] });
    g.userData.view = { el: 28 };
    return g;
  },

  // A red walk-behind petrol mower with a grass bag.
  lawnmower(k) {
    const T = k.THREE, g = k.group(), m = k.group([], { r: [0, -.5, 0] }); g.add(m);
    const red = k.gloss('#d8302a'), black = k.plastic('#1e2024', { rough: .5, coat: .3 }), rub = k.rubber('#1b1b1e');
    const hub = k.plastic('#cfd2d8', { rough: .35 }), metal = k.metal('#9aa0a8', .35);
    // deck
    k.add(m, k.box(2.3, .42, 2.0, .18), red, { p: [0, .52, 0] });
    k.add(m, k.sphere(1, { thetaLen: Math.PI / 2, w: 48, h: 16 }), red, { p: [.05, .66, 0], s: [1.05, .26, .9] });
    k.add(m, k.box(2.36, .08, 2.06, .04), k.plastic('#b5231e', { rough: .4 }), { p: [0, .34, 0] });
    // wheels
    for (const [x, z, r] of [[.82, 1.08, .34], [.82, -1.08, .34], [-.88, 1.1, .4], [-.88, -1.1, .4]]) {
      const w = k.group([], { p: [x, r, z] }); m.add(w);
      k.add(w, k.torus(r - .1, .1, { rs: 12, ts: 40 }), rub);
      k.add(w, k.cyl(r - .12, r - .12, .16, { seg: 32 }), hub, { r: [Math.PI / 2, 0, 0] });
      k.add(w, k.cyl(.09, .09, .2, { seg: 16 }), k.gloss('#e8e8ea'), { r: [Math.PI / 2, 0, 0] });
      const tread = []; for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; tread.push({ p: [Math.cos(a) * r, Math.sin(a) * r, 0], r: [0, 0, a] }); }
      w.add(k.instances(k.box(.04, .05, .22, .015), rub, tread));
    }
    // engine
    const e = k.group([], { p: [.12, .88, 0] }); m.add(e);
    k.add(e, k.box(1.0, .52, .95, .16), k.plastic('#2a2c31', { rough: .45, coat: .3 }), { p: [0, .26, 0] });
    k.add(e, k.rcyl(.42, .2, .07, { seg: 40 }), black, { p: [-.04, .5, 0] });
    for (let i = 0; i < 5; i++) k.add(e, k.box(.36, .03, .6, .01), metal, { p: [.58, .12 + i * .075, 0] });
    k.add(e, k.rcyl(.11, .1, .03, { seg: 24 }), k.gloss('#f2c230'), { p: [.33, .5, .3] });
    k.add(e, k.box(.3, .36, .5, .08), black, { p: [.3, .3, -.62] });
    k.add(e, k.sphere(.06), k.gloss('#d8302a'), { p: [.5, .42, .36] });
    k.add(e, k.cyl(.035, .035, .2, { seg: 10 }), k.matte('#111', .5), { p: [.66, .38, .22], r: [0, 0, -.9] });
    // handle, bail bar and grip
    const hx0 = -.95, hy0 = .7, hx1 = -2.35, hy1 = 2.35, hz = .62;
    k.add(m, k.tube([[hx0, hy0, hz], [(hx0 + hx1) / 2, (hy0 + hy1) / 2, hz], [hx1 + .05, hy1 - .08, hz], [hx1 - .03, hy1, hz * .8], [hx1 - .04, hy1 + .01, 0], [hx1 - .03, hy1, -hz * .8], [hx1 + .05, hy1 - .08, -hz], [(hx0 + hx1) / 2, (hy0 + hy1) / 2, -hz], [hx0, hy0, -hz]], .045, { seg: 200, rs: 10 }), black);
    k.add(m, k.cyl(.07, .07, .9, { seg: 20 }), rub, { p: [hx1 - .04, hy1 + .01, 0], r: [Math.PI / 2, 0, 0] });
    k.add(m, k.tube([[hx1 + .22, hy1 - .28, hz], [hx1 + .16, hy1 - .3, hz * .6], [hx1 + .16, hy1 - .3, -hz * .6], [hx1 + .22, hy1 - .28, -hz]], .03, { seg: 60, rs: 8 }), k.gloss('#e8e8ea'));
    for (const s of [-1, 1]) k.add(m, k.box(.2, .2, .1, .04), black, { p: [hx0, hy0, s * hz] });
    k.add(m, k.tube([[-.2, 1.4, .1], [-.9, 1.5, .45], [-1.5, 1.44, .7]], .012, { rs: 6 }), k.matte('#e8d9a8', .8));   // pull cord
    k.add(m, k.capsule(.045, .22), black, { p: [-1.52, 1.44, .74], r: [Math.PI / 2, 0, 0] });
    // grass bag
    k.add(m, k.box(1.15, .78, 1.12, .3), k.fabric('#454b53'), { p: [-1.62, .74, 0], r: [0, 0, -.12] });
    k.add(m, k.box(1.22, .1, 1.18, .05), black, { p: [-1.58, 1.12, 0], r: [0, 0, -.12] });
    g.userData.view = { az: 32 };
    return g;
  },
};
