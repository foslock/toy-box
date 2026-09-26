// Models for the Backyard set's sports cards. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

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

// Turn an object so its own axis (default +y) points along n.
const aim = (k, obj, n, axis = [0, 1, 0]) => { obj.quaternion.setFromUnitVectors(new k.THREE.Vector3(...axis), n.clone().normalize()); return obj; };
// A rod (cylinder) from a to b.
const rod = (k, a, b, r, mat, seg = 16) => {
  const A = new k.THREE.Vector3(...a), B = new k.THREE.Vector3(...b), d = B.clone().sub(A);
  const m = k.mesh(k.cyl(r, r, d.length(), { seg }), mat);
  m.position.copy(A).addScaledVector(d, .5);
  return aim(k, m, d);
};
// Placement matrix for a unit cylinder (radius 1, height 1) stretched from a to b with radius r: for instanced rods.
function spanM(k, a, b, r) {
  const T = k.THREE, A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  return new T.Matrix4().compose(A.add(B).multiplyScalar(.5), q, new T.Vector3(r, L, r));
}
// Placement matrix whose local x, y, z axes point along a, b, c (right-handed), at p, scaled by s.
function frameM(k, p, a, b, c, s = 1) {
  const M = new k.THREE.Matrix4().makeBasis(a, b, c);
  M.scale(typeof s === 'number' ? new k.THREE.Vector3(s, s, s) : new k.THREE.Vector3(...s));
  return M.setPosition(p);
}
// One mesh drawing geo at each of a list of placement matrices.
function instanced(k, geo, mat, matrices) {
  const m = new k.THREE.InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((M, i) => m.setMatrixAt(i, M));
  m.castShadow = m.receiveShadow = true;
  return m;
}

// The seam of a baseball or a tennis ball: a closed curve on the unit sphere that runs round the z axis, swinging up
// towards each pole twice (b sets how far). Returns n points evenly spaced along it, each with the unit tangent t, the
// outward normal n and b = n × t (across the seam). rot (a quaternion) turns the whole seam.
function seam(k, n, b = .3, rot = null) {
  const T = k.THREE, a = 1 - b, c = 2 * Math.sqrt(a * b), M = 3000;
  const f = t => new T.Vector3(a * Math.cos(t) + b * Math.cos(3 * t), a * Math.sin(t) - b * Math.sin(3 * t), c * Math.sin(2 * t));
  const P = [], L = [0];
  for (let i = 0; i <= M; i++) { P.push(f(i / M * TAU)); if (i) L.push(L[i - 1] + P[i].distanceTo(P[i - 1])); }
  const total = L[M], out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const s = i / n * total;
    while (j < M - 1 && L[j + 1] < s) j++;
    const q = (s - L[j]) / (L[j + 1] - L[j]);
    const p = P[j].clone().lerp(P[j + 1], q).normalize(), t = P[j + 1].clone().sub(P[j]).normalize();
    if (rot) { p.applyQuaternion(rot); t.applyQuaternion(rot); }
    t.addScaledVector(p, -t.dot(p)).normalize();
    out.push({ p, t, n: p.clone(), b: p.clone().cross(t) });
  }
  return out;
}

// A quaternion turning local directions a (and b, squared up to a) onto world directions A (and B).
function orient(k, a, b, A, B) {
  const T = k.THREE, V = v => new T.Vector3(...v).normalize();
  const basis = (x, y) => { const X = V(x), Y = V(y); Y.addScaledVector(X, -Y.dot(X)).normalize(); return new T.Matrix4().makeBasis(X, Y, X.clone().cross(Y)); };
  return new T.Quaternion().setFromRotationMatrix(basis(A, B).multiply(basis(a, b).transpose()));
}
// The default camera's view direction (towards the camera), screen right and screen up, for az 30°, el 16°.
const CAM = [.4806, .2756, .8324], RIGHT = [.866, 0, -.5], UP = [-.1378, .9612, -.2387];
const mix3 = (...terms) => terms.reduce((acc, [w, v]) => acc.map((x, i) => x + w * v[i]), [0, 0, 0]);

// A baseball of radius R centred on the origin: white hide, a faint grass stain facing the camera, the red-stitched seam.
function baseball(k, R, rot, o = {}) {
  const T = k.THREE, g = k.group();
  const hide = k.tex(1024, 512, (c, w, h) => {
    c.fillStyle = '#f9f5ec'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(150,130,100,${k.range(.02, .06)})`; c.fillRect(k.rand() * w, k.rand() * h, 2, 2); }   // grain
    if (o.stain === false) return;
    // grass stain: a few thin green-brown scuffs, low on the side that faces the camera
    const u0 = (o.stainU ?? .31) * w, v0 = (o.stainV ?? .64) * h;
    c.save(); c.filter = 'blur(2.5px)'; c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      c.strokeStyle = k.pick(['rgba(96,146,52,.2)', 'rgba(118,156,62,.17)', 'rgba(132,110,70,.14)']);
      c.lineWidth = k.range(2, 6);
      const x = u0 + k.range(-26, 26), y = v0 + k.range(-12, 12), l = k.range(20, 50);
      c.beginPath(); c.moveTo(x - l / 2, y + l * .18); c.quadraticCurveTo(x, y - 4, x + l / 2, y - l * .18); c.stroke();
    }
    c.restore();
  });
  const leather = k.mat({ map: hide, roughness: .55, clearcoat: .25, clearcoatRoughness: .5, sheen: .25, sheenRoughness: .6, sheenColor: new T.Color('#ffffff') });
  k.add(g, k.sphere(R, { w: 64, h: 40 }), leather);
  // the seam line, a little crease between the two pieces of hide
  const line = seam(k, 300, .3, rot);
  k.add(g, k.tube(line.map(s => s.p.clone().multiplyScalar(R * .999).toArray()), R * .016, { closed: true, seg: 420, rs: 6 }), k.matte('#ddd2bd', .7));
  // 108 red double stitches: a "V" of thread over the seam at each one
  const w = R * .085, d = R * .05, tr = R * .016, arms = [];
  for (const s of [-1, 1]) {
    const len = Math.hypot(w, d), geo = new T.CapsuleGeometry(tr, len, 2, 6);
    geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(-s * w, 0, d).normalize()));
    geo.scale(1, .7, 1);
    geo.translate(s * w / 2, 0, d / 2);
    arms.push(geo);
  }
  const vGeo = k.merge(arms);
  const mats = seam(k, 108, .3, rot).map(s => frameM(k, s.p.clone().multiplyScalar(R * 1.003), s.b, s.n, s.t));
  g.add(instanced(k, vGeo, k.mat({ color: '#d0212e', roughness: .6, sheen: .4, sheenColor: new T.Color('#ff8a8a') }), mats));
  return g;
}

// A basketball of radius R: pebbled orange with black seams (two great circles and two smaller rings).
function basketball(k, R) {
  const T = k.THREE, g = k.group();
  const pebble = k.tex(512, 256, (c, w, h) => {
    c.fillStyle = '#dc6424'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { c.fillStyle = k.rand() < .5 ? 'rgba(120,40,8,.18)' : 'rgba(255,170,110,.14)'; c.beginPath(); c.arc(k.rand() * w, k.rand() * h, k.range(.8, 1.8), 0, TAU); c.fill(); }
  });
  k.add(g, k.sphere(R, { w: 56, h: 36 }), k.mat({ map: pebble, roughness: .62, clearcoat: .15, clearcoatRoughness: .6 }));
  const line = k.matte('#1d1612', .6), tr = R * .022;
  k.add(g, k.torus(R, tr, { rs: 8, ts: 96 }), line);
  k.add(g, k.torus(R, tr, { rs: 8, ts: 96 }), line, { r: [Math.PI / 2, 0, 0] });
  const c0 = R * .6, rr = Math.sqrt(R * R - c0 * c0);
  for (const s of [-1, 1]) k.add(g, k.torus(rr, tr, { rs: 8, ts: 80 }), line, { p: [0, 0, s * c0] });
  return g;
}

// The shuttlecock, built standing on its cork and then turned by rot (Euler angles).
function shuttle(k, rot) {
  const T = k.THREE, g = k.group();
  const s = k.group([], { r: rot }); g.add(s);
  const leather = k.mat({ color: '#fbf8f1', roughness: .55, sheen: .5, sheenRoughness: .5, sheenColor: new T.Color('#ffffff') });
  const Rc = .52, hc = .4;
  const prof = [[0, 0]];
  for (let i = 1; i <= 14; i++) { const a = -Math.PI / 2 + i / 14 * Math.PI / 2; prof.push([Rc * Math.cos(a), Rc + Rc * Math.sin(a)]); }
  prof.push([Rc, Rc + hc], [Rc - .05, Rc + hc + .03], [0, Rc + hc + .03]);
  k.add(s, k.lathe(prof, { seg: 56 }), leather);
  const yTop = Rc + hc;
  k.add(s, k.cyl(Rc + .012, Rc + .012, .16, { seg: 56, open: true }), k.plastic('#2f6fe0', { rough: .4 }), { p: [0, yTop - .1, 0] });
  // feathers: a vane on the upper part of each quill, fanning out into a cone, each turned a little on its quill so
  // they overlap like shingles
  const N = 16, r0 = .34, Lf = 2.6, rTop = 1.3, tilt = Math.asin((rTop - r0) / Lf), y0 = yTop - .06, t0 = .36, W = .64;
  const vane = new T.PlaneGeometry(1, 1, 10, 36), vp = vane.attributes.position;
  for (let i = 0; i < vp.count; i++) {
    const u = vp.getX(i), v = vp.getY(i) + .5, t = t0 + (1 - t0) * v;
    let w = W * (.35 + .65 * smooth(0, .45, v));
    if (v > .72) w *= Math.sqrt(Math.max(0, 1 - ((v - .72) / .28) ** 2));
    const x = u * w, r = r0 + (rTop - r0) * t;
    vp.setXYZ(i, x, t * Lf, -x * x / (2 * r));
  }
  vane.computeVertexNormals();
  const barbs = k.tex(128, 256, (c, w, h) => {
    c.fillStyle = '#fdfcf8'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(150,145,135,.2)'; c.lineWidth = 1;
    for (let y = -w; y < h + w; y += 3) { c.beginPath(); c.moveTo(w / 2, y); c.lineTo(0, y - w * .45); c.moveTo(w / 2, y); c.lineTo(w, y - w * .45); c.stroke(); }
    for (const [x0, x1] of [[0, 14], [w, w - 14]]) { const e = c.createLinearGradient(x0, 0, x1, 0); e.addColorStop(0, 'rgba(160,154,142,.45)'); e.addColorStop(1, 'rgba(160,154,142,0)'); c.fillStyle = e; c.fillRect(Math.min(x0, x1), 0, 14, h); }
    const gr = c.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(200,196,186,.35)'); gr.addColorStop(.4, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  const featherM = k.mat({ map: barbs, roughness: .8, side: T.DoubleSide, sheen: .6, sheenRoughness: .5, sheenColor: new T.Color('#ffffff') });
  const quill = k.cyl(.018, .03, Lf, { seg: 8 }); quill.translate(0, Lf / 2, 0);
  const vm = [], qm = [];
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU;
    const D = new T.Vector3(Math.sin(tilt) * Math.sin(a), Math.cos(tilt), Math.sin(tilt) * Math.cos(a));
    const Nn = new T.Vector3(Math.cos(tilt) * Math.sin(a), -Math.sin(tilt), Math.cos(tilt) * Math.cos(a));
    const M = frameM(k, new T.Vector3(r0 * Math.sin(a), y0, r0 * Math.cos(a)), D.clone().cross(Nn), D, Nn);
    qm.push(M.clone().multiply(new T.Matrix4().makeTranslation(0, 0, .012)));
    vm.push(M.multiply(new T.Matrix4().makeRotationY(k.deg(7))));
  }
  s.add(instanced(k, vane, featherM, vm));
  s.add(instanced(k, quill, k.plastic('#f4f1ea', { rough: .45, coat: .3 }), qm));
  // two rings of thread binding the quills
  for (const t of [.12, .27]) {
    const r = r0 + (rTop - r0) * t + .02;
    k.add(s, k.torus(r, .032, { rs: 8, ts: 64 }), k.fabric('#e8413c', { weave: false }), { p: [0, y0 + t * Lf * Math.cos(tilt), 0], r: [Math.PI / 2, 0, 0] });
  }
  return g;
}

export default {
  // A white leather baseball: 108 red double stitches along the figure-eight seam, and a grass stain.
  baseball(k) {
    const g = k.group();
    // the pole of the seam a little up and left of the camera, so the two curves of stitching frame the face at a tilt
    const tilt = k.deg(28);
    const ball = baseball(k, 1, orient(k, [0, 0, 1], [1, 1, 0], mix3([1, CAM], [.3, UP], [-.18, RIGHT]), mix3([Math.cos(tilt), RIGHT], [Math.sin(tilt), UP])));
    ball.position.y = 1;
    g.add(ball);
    return g;
  },

  // An optic-yellow tennis ball: fuzzy felt with the white rubber seam curling round it.
  tennisball(k) {
    const T = k.THREE, g = k.group();
    const felt = k.tex(512, 256, (c, w, h) => {
      c.fillStyle = '#d3ea3a'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 2400; i++) {       // fibres
        const x = k.rand() * w, y = k.rand() * h, a = k.rand() * TAU, l = k.range(2, 7);
        c.strokeStyle = k.rand() < .5 ? 'rgba(255,255,190,.22)' : 'rgba(120,150,20,.16)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
      }
    });
    const fuzz = k.mat({ map: felt, roughness: 1, sheen: 1, sheenRoughness: .35, sheenColor: new T.Color('#f6ffb0') });
    const ball = k.group([], { p: [0, 1, 0] }); g.add(ball);
    k.add(ball, k.sphere(1, { w: 64, h: 40 }), fuzz);
    // a halo of loose fibres round the edge
    const speck = k.tex(512, 256, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(255,255,255,${k.range(.3, 1)})`; c.fillRect(k.rand() * w, k.rand() * h, 1.2, 1.2); } }, { data: true });
    k.add(ball, k.sphere(1.028, { w: 64, h: 40 }), k.mat({ color: '#e8ff70', alphaMap: speck, transparent: true, depthWrite: false, roughness: 1, sheen: 1, sheenColor: new T.Color('#ffffc0') }), { shadow: false });
    // turned so the seam sweeps across the middle of the face in a lazy S
    const tilt = k.deg(38);
    const line = seam(k, 360, .28, orient(k, [1, 0, 0], [0, 0, 1], mix3([1, CAM], [.12, RIGHT], [.06, UP]), mix3([Math.cos(tilt), UP], [Math.sin(tilt), RIGHT])));
    k.add(ball, k.tube(line.map(s => s.p.clone().multiplyScalar(1.005).toArray()), .04, { closed: true, seg: 720, rs: 10 }), k.mat({ color: '#f6f6ef', roughness: .55, sheen: .5, sheenColor: new T.Color('#ffffff') }));
    return g;
  },

  // A feather shuttlecock: a white leather-covered cork with a coloured band, sixteen overlapping goose feathers and two
  // rings of thread.
  shuttlecock(k) { return shuttle(k, [.1, .5, -1.2]); },   // lying on its side, cork down on the grass

  // A tan leather baseball glove, pocket to the front: fat laced finger stalls, a long thumb, a woven web between them,
  // a laced heel, and a ball sitting in the pocket.
  glove(k) {
    const T = k.THREE, g = k.group();
    const G = k.group([], { r: [-.2, .25, .04] }); g.add(G);
    const tanC = '#b5642b', sheenC = new T.Color('#eeaa72');
    const grain = k.tex(256, 256, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); for (let i = 0; i < 5000; i++) { c.fillStyle = k.rand() < .6 ? `rgba(90,40,10,${k.range(.04, .12)})` : `rgba(255,240,220,${k.range(.05, .15)})`; c.beginPath(); c.arc(k.rand() * w, k.rand() * h, k.range(.6, 1.8), 0, TAU); c.fill(); } }, { repeat: [3, 3] });
    const leatherOpts = { map: grain, roughness: .48, clearcoat: .35, clearcoatRoughness: .35, sheen: .3, sheenRoughness: .5, sheenColor: sheenC };
    const leather = k.mat({ color: tanC, ...leatherOpts });
    const laceM = k.mat({ color: '#5a2c12', roughness: .55, clearcoat: .25, clearcoatRoughness: .4 });
    // palm: a thick cushion with the pocket pressed into its face, darker where the ball lands
    const pc = [-.1, 1.22], prx = 1.12, pry = 1.08;
    const palmGeo = k.sphere(1, { w: 72, h: 54 }), pp = palmGeo.attributes.position, cols = [];
    const base = new T.Color(tanC), deep = new T.Color('#86401a');
    for (let i = 0; i < pp.count; i++) {
      const x = pc[0] + pp.getX(i) * prx, y = pc[1] + pp.getY(i) * pry;
      let z = pp.getZ(i) * (.5 + .16 * smooth(1.1, .2, y)) * lerp(1, .4, smooth(1.3, 2.3, y));   // thinner at the top, where it runs into the fingers
      const f = Math.exp(-(((x + .35) / .75) ** 2) - (((y - 1.4) / .72) ** 2));
      if (z > 0) z *= 1 - .5 * f;
      pp.setXYZ(i, x, y, z);
      const c = base.clone().lerp(deep, z > 0 ? .75 * f : 0); cols.push(c.r, c.g, c.b);
    }
    palmGeo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    palmGeo.computeVertexNormals(); weld(palmGeo);
    k.add(G, palmGeo, k.mat({ color: '#ffffff', vertexColors: true, ...leatherOpts }));
    // four fat finger stalls fanning out and curling forward, and the long thumb
    const fingers = [
      [[[-.64, 1.6, -.02], [-.74, 2.45, .0], [-.83, 3.15, .12], [-.84, 3.55, .34]], .31],
      [[[-.13, 1.7, -.02], [-.16, 2.6, .0], [-.19, 3.32, .14], [-.18, 3.74, .38]], .31],
      [[[.36, 1.65, -.02], [.41, 2.5, .0], [.46, 3.2, .12], [.47, 3.6, .35]], .3],
      [[[.84, 1.5, -.02], [.93, 2.28, .0], [1.01, 2.94, .12], [1.04, 3.32, .32]], .32],
    ];
    const tips = [], curves = [];
    for (const [pts, r] of fingers) {
      const c = curveOf(k, pts); curves.push(c);
      k.add(G, varTube(k, c, capped(r, 0, r * .9), { up: [0, 0, 1], flat: .75, seg: 60, rs: 28 }), leather);
      tips.push({ c, r });
    }
    const thumbC = curveOf(k, [[-.8, .7, .12], [-1.35, 1.25, .26], [-1.75, 2.0, .38], [-1.9, 2.78, .52]]);
    k.add(G, varTube(k, thumbC, capped(s => .33 - .05 * s / 2.3, 0, .28), { up: [0, 0, 1], flat: .78, seg: 70, rs: 28 }), leather);
    tips.push({ c: thumbC, r: .29 });
    // web: a woven basket panel between the thumb and the index finger, sagging back into the pocket
    const idx = curves[0], NU = 14, NT = 18, wpos = [], wuv = [], wid = [];
    for (let j = 0; j <= NT; j++) {
      const t = j / NT, L = thumbC.getPointAt(lerp(.42, .97, t)).add(new T.Vector3(.2, 0, -.03)), R = idx.getPointAt(lerp(.02, .9, t)).add(new T.Vector3(-.2, 0, -.03));
      for (let i = 0; i <= NU; i++) { const u = i / NU, P = L.clone().lerp(R, u); P.z -= .22 * Math.sin(Math.PI * u) * (1 - .4 * t); wpos.push(P.x, P.y, P.z); wuv.push(u, t); }
    }
    for (let j = 0; j < NT; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + NU + 1; wid.push(a, a + 1, b, a + 1, b + 1, b); }
    const webGeo = new T.BufferGeometry();
    webGeo.setAttribute('position', new T.Float32BufferAttribute(wpos, 3)); webGeo.setAttribute('uv', new T.Float32BufferAttribute(wuv, 2)); webGeo.setIndex(wid);
    webGeo.computeVertexNormals();
    const weave = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#4a240e'; c.fillRect(0, 0, w, h);
      const n = 4, cw = w / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x = i * cw, y = j * cw, hor = (i + j) % 2 === 0;
        const gr = hor ? c.createLinearGradient(0, y + 6, 0, y + cw - 6) : c.createLinearGradient(x + 6, 0, x + cw - 6, 0);
        gr.addColorStop(0, '#9a5322'); gr.addColorStop(.35, '#cf8140'); gr.addColorStop(1, '#8a481c');
        c.fillStyle = gr;
        hor ? c.fillRect(x - 2, y + 6, cw + 4, cw - 12) : c.fillRect(x + 6, y - 2, cw - 12, cw + 4);
      }
    }, { repeat: [1.5, 2] });
    k.add(G, webGeo, k.mat({ ...leatherOpts, map: weave, color: '#ffffff', side: T.DoubleSide }));
    // laces tying the web to the thumb and finger, and along its top
    const webLace = [];
    for (let j = 0; j < 6; j++) {
      const t = .08 + j / 5 * .82;
      const L = thumbC.getPointAt(lerp(.42, .97, t)), R = idx.getPointAt(lerp(.02, .9, t));
      webLace.push(k.tube([L.clone().add(new T.Vector3(.1, -.05, .2)).toArray(), L.clone().add(new T.Vector3(.3, 0, .06)).toArray(), L.clone().lerp(R, .18).add(new T.Vector3(0, .04, -.1)).toArray()], .035, { caps: true, rs: 8, seg: 16 }));
      webLace.push(k.tube([R.clone().add(new T.Vector3(-.1, -.05, .2)).toArray(), R.clone().add(new T.Vector3(-.3, 0, .06)).toArray(), R.clone().lerp(L, .18).add(new T.Vector3(0, .04, -.1)).toArray()], .035, { caps: true, rs: 8, seg: 16 }));
    }
    const wt0 = thumbC.getPointAt(.97), wt1 = idx.getPointAt(.9), topPts = [];
    for (let i = 0; i <= 10; i++) { const P = wt0.clone().lerp(wt1, i / 10); P.y += .05 + .04 * Math.sin(i / 10 * Math.PI); P.z += (i % 2 ? .06 : -.06) - .02; topPts.push(P.toArray()); }
    webLace.push(k.tube(topPts, .04, { caps: true, rs: 8, seg: 80 }));
    k.add(G, k.merge(webLace), laceM);
    // a lace over the tip of every finger and the thumb
    const tipLace = [];
    for (const { c, r } of tips) {
      const P = c.getPointAt(1), D = c.getTangentAt(1), fwd = new T.Vector3(0, 0, 1).addScaledVector(D, -D.z).normalize(), C = P.clone().addScaledVector(D, -r * .72);
      const pts = [];
      for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI; pts.push(C.clone().addScaledVector(fwd, Math.cos(a) * r * .82).addScaledVector(D, Math.sin(a) * r * .8).toArray()); }
      tipLace.push(k.tube(pts, .045, { caps: true, rs: 8, seg: 36 }));
    }
    // and the lace running across between the fingertips
    for (let i = 0; i < 3; i++) {
      const a = tips[i].c, b = tips[i + 1].c, pa = a.getPointAt(.9), pb = b.getPointAt(.9), m = pa.clone().lerp(pb, .5);
      tipLace.push(k.tube([pa.clone().add(new T.Vector3(.12, 0, -.06)).toArray(), m.clone().add(new T.Vector3(0, -.03, -.02)).toArray(), pb.clone().add(new T.Vector3(-.12, 0, -.06)).toArray()], .04, { caps: true, rs: 8, seg: 16 }));
    }
    k.add(G, k.merge(tipLace), laceM);
    // the rolled binding round the heel, laced over and over
    const rimAt = a => new T.Vector3(pc[0] + prx * Math.cos(a), pc[1] + pry * Math.sin(a), 0);
    const rim = [];
    for (let i = 0; i <= 40; i++) rim.push(rimAt(k.deg(205 + i / 40 * 180)).toArray());
    k.add(G, k.tube(rim, .09, { seg: 160, rs: 12 }), leather);
    const wraps = [], arc = k.torus(.13, .036, { rs: 6, ts: 14, arc: Math.PI });
    for (let i = 0; i < 15; i++) {
      const a = k.deg(210 + i / 14 * 170), n = new T.Vector3(Math.cos(a) / prx, Math.sin(a) / pry, 0).normalize(), Z = new T.Vector3(0, 0, 1);
      const M = frameM(k, rimAt(a), Z, n, Z.clone().cross(n));
      wraps.push(M.multiply(new T.Matrix4().makeRotationY(.35)));
    }
    G.add(instanced(k, arc, laceM, wraps));
    // a lace knot by the pinky, its two ends hanging down
    const kp = [1.12, 1.6, .06];
    k.add(G, k.sphere(.09, { w: 16, h: 12 }), laceM, { p: kp });
    k.add(G, k.tube([kp, [1.28, 1.3, .12], [1.32, .92, .2]], .035, { caps: true, rs: 8 }), laceM);
    k.add(G, k.tube([kp, [1.2, 1.32, -.02], [1.2, 1.02, -.06]], .035, { caps: true, rs: 8 }), laceM);
    // an oval leather patch on the heel, with a red star
    const patch = k.decal(.46, .32, (c, w, h) => {
      c.fillStyle = '#f3e3c3'; c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, TAU); c.fill();
      c.fillStyle = '#3d1d0c'; c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 12, h / 2 - 12, 0, 0, TAU); c.fill();
      c.strokeStyle = '#f3e3c3'; c.lineWidth = 3; c.setLineDash([6, 5]); c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 19, h / 2 - 19, 0, 0, TAU); c.stroke();
      c.fillStyle = '#e8312e'; c.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 16 : 38; c.lineTo(w / 2 + Math.cos(a) * rr, h / 2 + 3 + Math.sin(a) * rr); }
      c.closePath(); c.fill();
    }, { px: 256 });
    const hp = new T.Vector3(.45, .42, 0), hz = .66 * Math.sqrt(Math.max(0, 1 - ((.45 + .1) / 1.12) ** 2 - ((.42 - 1.22) / 1.08) ** 2));
    patch.position.set(hp.x, hp.y, hz * .98 + .01); patch.lookAt(new T.Vector3(hp.x + .55 / 1.12 ** 2 * .6, hp.y + (.42 - 1.22) / 1.08 ** 2 * .6, hz + .9));
    G.add(patch);
    // the ball, nestled in the pocket
    const ball = baseball(k, .44, orient(k, [0, 0, 1], [1, 1, 0], [.2, .5, .85], [1, .3, -.2]), { stainU: .27, stainV: .55 });
    ball.position.set(-.4, 1.5, .62);
    G.add(ball);
    return g;
  },

  // A popsicle skateboard on its edge: maple plies, black grip tape, a loud graphic underneath, trucks and four wheels.
  skateboard(k) {
    const T = k.THREE, g = k.group();
    const L = 3.1, W = .8, th = .056, r = th / 2, x0 = L / 2 - .72, bend = .2, tanK = Math.tan(k.deg(20));
    const kick = x => { const d = Math.abs(x) - x0; return d <= 0 ? 0 : d < bend ? tanK * d * d / (2 * bend) : tanK * (d - bend / 2); };
    const c0 = L / 2 - W / 2, NU = 100, NV = 12, NE = 8;
    const X = u => -L / 2 * Math.cos(Math.PI * u);
    const hw = x => { const d = Math.abs(x) - c0; return d > 0 ? Math.sqrt(Math.max(0, (W / 2) ** 2 - d * d)) : W / 2; };
    const build = (pos, uv, idx) => { const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals(); return geo; };
    const face = top => {
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= NU; i++) {
        const x = X(i / NU), h = hw(x);
        for (let j = 0; j <= NV; j++) { const z = (j / NV * 2 - 1) * h; pos.push(x, kick(x) + (top ? r : -r), z); uv.push((x + L / 2) / L, (z + W / 2) / W); }
      }
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; top ? idx.push(a, a + 1, b, a + 1, b + 1, b) : idx.push(a, b, a + 1, a + 1, b, b + 1); }
      return build(pos, uv, idx);
    };
    const edge = () => {
      const pos = [], uv = [], idx = [];
      for (const side of [1, -1]) {
        const o = pos.length / 3;
        for (let i = 0; i <= NU; i++) {
          const x = X(i / NU), h = hw(x), d = Math.abs(x) - c0;
          const n = d > 0 ? new T.Vector2(Math.sign(x) * d, side * h).normalize() : new T.Vector2(0, side);
          for (let e = 0; e <= NE; e++) {
            const al = -Math.PI / 2 + e / NE * Math.PI;
            pos.push(x + r * Math.cos(al) * n.x, kick(x) + r * Math.sin(al), side * h + r * Math.cos(al) * n.y);
            uv.push(i / NU, e / NE);
          }
        }
        for (let i = 0; i < NU; i++) for (let e = 0; e < NE; e++) {
          const a = o + i * (NE + 1) + e, b = a + NE + 1;
          side > 0 ? idx.push(a, b, a + 1, b, b + 1, a + 1) : idx.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
      return build(pos, uv, idx);
    };
    const graphic = k.tex(1024, 256, (c, w, h) => {
      const bg = c.createLinearGradient(0, 0, w, 0);
      bg.addColorStop(0, '#3a1a78'); bg.addColorStop(.5, '#6a1fa0'); bg.addColorStop(1, '#3a1a78');
      c.fillStyle = bg; c.fillRect(0, 0, w, h);
      // checkerboard bands at the nose and tail
      for (const x0c of [40, w - 40 - 96]) for (let i = 0; i < 6; i++) for (let j = 0; j < 12; j++) { if ((i + j) % 2) continue; c.fillStyle = '#ffffff'; c.fillRect(x0c + i * 16, j * 21.4, 16, 21.4); }
      // a striped sunset sun
      const cx = w / 2, cy = h / 2, R = 104;
      c.save(); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.clip();
      const sun = c.createLinearGradient(0, cy - R, 0, cy + R); sun.addColorStop(0, '#ffe45c'); sun.addColorStop(.55, '#ff8a3d'); sun.addColorStop(1, '#ff3d7f');
      c.fillStyle = sun; c.fillRect(cx - R, cy - R, R * 2, R * 2);
      c.fillStyle = '#6a1fa0'; for (let i = 0; i < 6; i++) c.fillRect(cx - R, cy + 8 + i * 17, R * 2, 3 + i * 1.6);
      c.restore();
      // zig-zag lightning on each side
      c.fillStyle = '#3ee6d0';
      for (const s of [-1, 1]) {
        c.beginPath(); const bx = cx + s * 230;
        [[0, -90], [34 * s, -10], [4 * s, -8], [30 * s, 90], [-28 * s, 0], [0, 2], [-24 * s, -90]].forEach(([dx, dy], i) => i ? c.lineTo(bx + dx, cy + dy) : c.moveTo(bx + dx, cy + dy));
        c.closePath(); c.fill();
      }
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 26; i++) { const x = k.range(150, w - 150), y = k.range(10, h - 10); if (Math.hypot(x - cx, y - cy) < R + 12) continue; const s = k.range(2, 5); c.beginPath(); c.moveTo(x, y - s * 2); c.lineTo(x + s * .5, y - s * .5); c.lineTo(x + s * 2, y); c.lineTo(x + s * .5, y + s * .5); c.lineTo(x, y + s * 2); c.lineTo(x - s * .5, y + s * .5); c.lineTo(x - s * 2, y); c.lineTo(x - s * .5, y - s * .5); c.closePath(); c.fill(); }
    });
    const grip = k.tex(512, 128, (c, w, h) => { c.fillStyle = '#1d1d21'; c.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { c.fillStyle = k.rand() < .5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.25)'; c.fillRect(k.rand() * w, k.rand() * h, 1, 1); } });
    // the edge: seven plies of maple (one dyed), with the grip tape's black line along the top corner
    const plies = k.tex(8, 64, (c, w, h) => { const cols = ['#e7c48f', '#d9b07a', '#e7c48f', '#2fb3c9', '#e7c48f', '#d9b07a', '#e7c48f']; cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, h * .2 + i * h * .8 / 7, w, h * .8 / 7 + 1); }); c.fillStyle = '#1d1d21'; c.fillRect(0, 0, w, h * .2); });
    const board = k.group();
    k.add(board, face(true), k.mat({ map: grip, roughness: .95 }));
    k.add(board, face(false), k.mat({ map: graphic, roughness: .35, clearcoat: .6, clearcoatRoughness: .2 }));
    k.add(board, edge(), k.mat({ map: plies, roughness: .6 }));
    // trucks and wheels
    const truck = k.metal('#c9ced6', .28), bush = k.plastic('#ffd23f', { rough: .5 }), wheel = k.plastic('#35d6c5', { rough: .45, coat: .3 });
    const Rw = .13, ww = .15, ay = -.2;
    const wheelGeo = k.lathe([[.05, -ww / 2], [.1, -ww / 2], [.122, -ww / 2 + .006], [.13, -ww / 2 + .025], [Rw, 0], [.13, ww / 2 - .025], [.122, ww / 2 - .006], [.1, ww / 2], [.05, ww / 2], [.05, -ww / 2]], { seg: 40 });
    const hanger = k.extrude(k.shape([[-.31, -.035], [.31, -.035], [.12, .075], [-.12, .075]]), .09, { bevel: .025 });
    for (const xs of [-.72, .72]) {
      k.add(board, k.box(.32, .035, .22, .012), truck, { p: [xs, -r - .018, 0] });                 // baseplate
      k.add(board, k.cyl(.062, .062, .05, { seg: 20 }), bush, { p: [xs, -r - .06, 0] });            // bushing round the kingpin
      k.add(board, hanger, truck, { p: [xs, ay + .02, 0], r: [0, Math.PI / 2, 0] });
      k.add(board, k.capsule(.035, .62, 6), truck, { p: [xs, ay, 0], r: [Math.PI / 2, 0, 0] });    // axle housing
      for (const s of [-1, 1]) {
        k.add(board, wheelGeo, wheel, { p: [xs, ay, s * .43], r: [Math.PI / 2, 0, 0] });
        k.add(board, k.cyl(.05, .05, ww + .004, { seg: 20 }), k.metal('#e6e9ee', .2), { p: [xs, ay, s * .43], r: [Math.PI / 2, 0, 0] });
        k.add(board, k.cyl(.026, .026, .05, { seg: 6 }), truck, { p: [xs, ay, s * (.43 + ww / 2 + .02)], r: [Math.PI / 2, 0, 0] });   // axle nut
      }
    }
    // on its edge, underside to the camera, the nose tipped up as if it's about to flip
    const pose = k.group([k.group([k.group([board], { r: [k.deg(-78), 0, 0] })], { r: [0, 0, k.deg(16)] })], { r: [0, k.deg(-4), 0] });
    g.add(pose);
    g.userData.noHero = true;
    return g;
  },

  // A pair of retro quad roller skates: pastel high-top boots, white laces with pom-poms, rainbow wheels and red toe stops.
  rollerskates(k) {
    const T = k.THREE, g = k.group();
    const cream = k.plastic('#fbf6ee', { rough: .45, coat: .4 }), lace = k.matte('#ffffff', .6), chrome = k.chrome(), metal = k.metal('#d5d9de', .25);
    const red = k.plastic('#e1262f', { rough: .6, coat: .2 });
    // The boot (facing +x) is a stack of horizontal rings: at each height y its front and back edges, from a side profile.
    const prof = tab => {
      const c = new T.SplineCurve(tab.map(([y, x]) => new T.Vector2(y, x))), pts = c.getPoints(300);
      return y => { let i = 0; while (i < pts.length - 2 && pts[i + 1].x < y) i++; const a = pts[i], b = pts[i + 1]; return a.y + (b.y - a.y) * clamp01((y - a.x) / (b.x - a.x || 1)); };
    };
    const F = prof([[.6, 1.34], [.66, 1.54], [.74, 1.64], [.86, 1.68], [1.0, 1.63], [1.14, 1.48], [1.28, 1.24], [1.44, .94], [1.7, .55], [2.0, .24], [2.35, .03], [2.7, -.05], [3.02, -.08]]);
    const B = prof([[.6, -.88], [.8, -.96], [1.0, -1.05], [1.2, -1.1], [1.5, -1.1], [2.0, -1.06], [2.5, -1.04], [3.02, -1.08]]);
    const Wd = y => lerp(.47, .44, smooth(1.3, 2.0, y));
    const Y0 = .6, Y1 = 3.02, NY = 50, RS = 48, SE = 2 / 2.4;
    const ringPt = (y, th, grow = 1) => {
      const xf = F(y), xb = B(y), xm = (xf + xb) / 2, hl = (xf - xb) / 2 * grow, c = Math.cos(th), s = Math.sin(th);
      return new T.Vector3(xm + hl * Math.sign(c) * Math.abs(c) ** SE, y, Wd(y) * grow * Math.sign(s) * Math.abs(s) ** SE * (1 + .06 * c));
    };
    const soleY = x => lerp(1.0, .72, smooth(-.3, .7, x));
    const bootGeo = (grow, lo, hi) => {
      const pos = [], uv = [], idx = [];
      for (let j = 0; j <= NY; j++) for (let i = 0; i <= RS; i++) {
        const P = ringPt(lerp(Y0, Y1, j / NY), i / RS * TAU, grow);
        pos.push(P.x, Math.min(Math.max(P.y, lo(P.x)), hi(P.x)), P.z); uv.push(i / RS, j / NY);
      }
      for (let j = 0; j < NY; j++) for (let i = 0; i < RS; i++) { const a = j * (RS + 1) + i, b = a + 1, c = a + RS + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
      geo.computeVertexNormals();
      return weld(geo);
    };
    const upper = bootGeo(1, soleY, () => 99), sole = bootGeo(1.05, x => soleY(x) - .09, soleY);
    // two-tone leather: a white toe cap and heel counter on the pink boot, each edged with a row of stitches
    const skin = k.tex(512, 256, (c, w, h) => {
      const img = c.createImageData(w, h), d = img.data, pink = [248, 173, 201], white = [253, 248, 243], st = [224, 118, 158], st2 = [236, 196, 206];
      for (let r = 0; r < h; r++) {
        const y = lerp(Y0, Y1, 1 - (r + .5) / h), xf = F(y), xb = B(y), xm = (xf + xb) / 2, hl = (xf - xb) / 2, W = Wd(y);
        for (let q = 0; q < w; q++) {
          const th = (q + .5) / w * TAU, cs = Math.cos(th), sn = Math.sin(th);
          const x = xm + hl * Math.sign(cs) * Math.abs(cs) ** SE, z = W * Math.sign(sn) * Math.abs(sn) ** SE * (1 + .06 * cs), zz = (z / .47) ** 2;
          const dT = x - (1.02 - .38 * zz), dH = 1 - ((x + 1.12) / .52 + (y - .7) / 1.05);
          let col = pink;
          if (dT > 0 && y < 1.6) col = dT < .05 && dT > .025 && Math.sin(z * 70) > -.1 ? st2 : white;
          else if (dT > -.05 && dT < -.025 && y < 1.6 && Math.sin(z * 70) > -.1) col = st;
          if (dH > 0) col = dH < .07 && dH > .04 && Math.sin(y * 60) > -.1 ? st2 : white;
          else if (dH > -.07 && dH < -.04 && Math.sin(y * 60) > -.1) col = st;
          const o = (r * w + q) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
        }
      }
      c.putImageData(img, 0, 0);
    });
    const boot = k.mat({ map: skin, roughness: .42, clearcoat: .45, clearcoatRoughness: .3, sheen: .35, sheenRoughness: .5, sheenColor: new T.Color('#ffffff') });
    const tongueM = k.mat({ color: '#f8adc9', roughness: .5, clearcoat: .3, clearcoatRoughness: .35, sheen: .4, sheenColor: new T.Color('#ffffff') });
    // a fluffy pom-pom: a lumpy ball of yarn
    const pomGeo = k.sphere(.2, { w: 40, h: 28 }), pmp = pomGeo.attributes.position;
    for (let i = 0; i < pmp.count; i++) { const x = pmp.getX(i), y = pmp.getY(i), z = pmp.getZ(i), f = 1 + .07 * Math.sin(x * 61 + 1) * Math.sin(y * 57 + 2) * Math.sin(z * 53 + 3) + .05 * Math.sin(x * 23 - y * 31 + z * 29); pmp.setXYZ(i, x * f, y * f, z * f); }
    pomGeo.computeVertexNormals(); weld(pomGeo);
    const pomM = k.mat({ color: '#ffffff', roughness: 1, sheen: 1, sheenRoughness: .3, sheenColor: new T.Color('#ffd6e6'), map: k.tex(128, 64, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(230,190,205,${k.range(.1, .4)})`; c.fillRect(k.rand() * w, k.rand() * h, 1, 2); } }) });
    // a point on the boot's surface, pushed out along the surface normal by lift
    const onBoot = (y, th, lift = 0) => {
      const P = ringPt(y, th), dT = ringPt(y, th + .01).sub(ringPt(y, th - .01)), dY = ringPt(y + .01, th).sub(ringPt(y - .01, th));
      return P.addScaledVector(dY.cross(dT).normalize(), lift);
    };
    // lace rows spaced evenly along the front, from the toe box up to the collar
    const fl = [], NL = 7;
    { let acc = 0, prev = null; const ys = []; for (let y = 1.42; y <= 2.86; y += .01) { const p = new T.Vector2(F(y), y); if (prev) acc += p.distanceTo(prev); prev = p; ys.push([y, acc]); }
      for (let i = 0; i < NL; i++) { const want = i / (NL - 1) * acc; fl.push(ys.find(([, a]) => a >= want - 1e-6)[0]); } }
    const wheelGeo = k.lathe([[.1, -.13], [.22, -.13], [.27, -.12], [.3, -.08], [.31, 0], [.3, .08], [.27, .12], [.22, .13], [.1, .13], [.1, -.13]], { seg: 40 });
    const skate = (cols) => {
      const s = k.group();
      k.add(s, upper, boot);
      k.add(s, sole, cream);
      // padded collar, the dark opening and the tongue
      const ring = []; for (let i = 0; i < 48; i++) ring.push(ringPt(Y1 + .03, i / 48 * TAU).toArray());
      k.add(s, k.tube(ring, .085, { closed: true, rs: 12, seg: 96 }), cream);
      const top = ringPt(Y1, Math.PI / 2), mid = (F(Y1) + B(Y1)) / 2;
      k.add(s, k.disc(1, 40), k.matte('#4a3038', .9), { p: [mid, Y1 + .01, 0], r: [-Math.PI / 2, 0, 0], s: [(F(Y1) - B(Y1)) / 2 * .9, top.z * .9, 1] });
      k.add(s, k.sphere(1, { w: 32, h: 20 }), tongueM, { p: [F(Y1) - .04, Y1 - .02, 0], s: [.08, .24, .3], r: [0, 0, -.2] });
      // laces criss-crossing up the front through chrome eyelets
      const th = .6, eyes = [], laces = [];
      fl.forEach((y, i) => {
        for (const sd of [-1, 1]) eyes.push(onBoot(y, sd * th, .01));
        if (i < NL - 1) { const y2 = fl[i + 1]; for (const sd of [-1, 1]) laces.push(k.tube([onBoot(y, sd * th, .025).toArray(), onBoot((y + y2) / 2, 0, .06).toArray(), onBoot(y2, -sd * th, .025).toArray()], .03, { caps: true, rs: 8, seg: 24 })); }
      });
      // a bow at the top
      const bw = onBoot(fl[NL - 1], 0, .06);
      for (const sd of [-1, 1]) laces.push(k.tube([bw.toArray(), [bw.x + .1, bw.y + .08, sd * .12], [bw.x + .12, bw.y - .04, sd * .2], bw.toArray()], .028, { rs: 8, seg: 32 }));
      for (const sd of [-1, 1]) laces.push(k.tube([bw.toArray(), [bw.x + .12, bw.y - .15, sd * .08], [bw.x + .1, bw.y - .32, sd * .12]], .028, { caps: true, rs: 8, seg: 24 }));
      k.add(s, k.merge(laces), lace);
      s.add(instanced(k, k.torus(.045, .016, { rs: 6, ts: 16 }), chrome, eyes.map((p, i) => { const n = onBoot(fl[i >> 1], (i & 1 ? 1 : -1) * th, 1).sub(ringPt(fl[i >> 1], (i & 1 ? 1 : -1) * th)); return new T.Matrix4().compose(p, new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), n.normalize()), new T.Vector3(1, 1, 1)); })));
      // a pom-pom at the toe of the laces
      k.add(s, pomGeo, pomM, { p: onBoot(fl[0] - .04, 0, .17).toArray() });
      // heel block, plate, trucks, wheels and the toe stop
      k.add(s, k.box(.64, .34, .74, .06), cream, { p: [-.66, .76, 0] });
      k.add(s, k.box(2.2, .05, .46, .02), metal, { p: [.3, .6, 0] });
      [[-.55, 0], [1.08, 1]].forEach(([x, i]) => {
        k.add(s, k.cyl(.07, .09, .25, { seg: 16 }), metal, { p: [x, .47, 0] });
        k.add(s, k.cyl(.1, .1, .08, { seg: 20 }), k.plastic('#fff1a8', { rough: .5 }), { p: [x, .53, 0] });
        k.add(s, k.capsule(.07, .74, 6), metal, { p: [x, .31, 0], r: [Math.PI / 2, 0, 0] });
        for (const sd of [-1, 1]) {
          k.add(s, wheelGeo, k.plastic(cols[i * 2 + (sd > 0 ? 0 : 1)], { rough: .35, coat: .5 }), { p: [x, .31, sd * .44], r: [Math.PI / 2, 0, 0] });
          k.add(s, k.cyl(.1, .1, .27, { seg: 20 }), chrome, { p: [x, .31, sd * .44], r: [Math.PI / 2, 0, 0] });
        }
      });
      const ts = k.group([], { p: [1.36, .6, 0], r: [0, 0, .55] }); s.add(ts);     // the toe stop, angled down in front of the wheels
      k.add(ts, k.cyl(.075, .075, .2, { seg: 16 }), metal, { p: [0, -.1, 0] });
      k.add(ts, k.cyl(.12, .12, .06, { seg: 20 }), metal, { p: [0, -.2, 0] });
      k.add(ts, k.rcyl(.18, .3, .07, { seg: 28 }), red, { p: [0, -.2, 0], r: [Math.PI, 0, 0] });
      return s;
    };
    // the pair stands in a V, heels together and toes out towards the camera
    g.add(k.place(skate(['#ff4d6d', '#b36bff', '#ffa62b', '#3fa7ff']), { p: [1.5, 0, -.4], r: [0, -.18, 0] }));
    g.add(k.place(skate(['#3fa7ff', '#ffd23f', '#9b5cff', '#3ddc84']), { p: [-.9, 0, .55], r: [0, -1.92, 0] }));
    return g;
  },

  // A portable driveway hoop: a weighted base, a steel pole, a backboard with the shooter's square, an orange rim with a
  // white net, and a basketball waiting at the bottom.
  hoop(k) {
    const T = k.THREE, g = k.group();
    const steel = k.gloss('#2b3038'), black = k.plastic('#1d2025', { rough: .5, coat: .3 }), orange = k.gloss('#ff6a1f');
    // the pole is shortened, and the backboard, rim and net drawn a bit big, so they read on the card
    const S = 1.1, rimY = 4.9, bbW = 3.6 * S, bbH = 2.4 * S, bbBot = rimY - .45 * S, bbZ = 0;
    // base: a plastic wedge full of sand, with wheels at the back and a fill cap
    const prof = k.shape([[-1.25, 0], [1.2, 0], [1.3, .12], [1.1, .46], [-1.0, .72], [-1.25, .56]]);
    k.add(g, k.extrude(prof, 2.0, { bevel: .1 }), black, { p: [0, 0, -1.9], r: [0, -Math.PI / 2, 0] });
    for (let i = 0; i < 3; i++) k.add(g, k.box(2.06, .05, .08, .02), k.plastic('#2c3037', { rough: .5 }), { p: [0, .16 + i * .1, -.7 + .01 * i], r: [.2, 0, 0] });   // moulded ribs on the front
    k.add(g, k.rcyl(.2, .1, .03, { seg: 28 }), k.plastic('#2f6fe0'), { p: [.5, .7, -2.35], r: [-.12, 0, 0] });
    for (const s of [-1, 1]) {
      k.add(g, k.torus(.18, .075, { rs: 10, ts: 28 }), k.rubber(), { p: [s * 1.16, .26, -3.0], r: [0, Math.PI / 2, 0] });
      k.add(g, k.cyl(.13, .13, .1, { seg: 20 }), k.plastic('#9aa0a8'), { p: [s * 1.16, .26, -3.0], r: [0, 0, Math.PI / 2] });
    }
    // pole, leaning forward a touch, in two sections
    const pb = [0, .4, -1.7], pm = [0, 3.0, -1.44], pt = [0, rimY + 1.0, -1.25];
    g.add(rod(k, pb, pm, .19, steel, 24), rod(k, pm, pt, .16, steel, 24));
    k.add(g, k.sphere(.16, { w: 20, h: 14 }), steel, { p: pt });
    k.add(g, k.cyl(.23, .23, .3, { seg: 24 }), steel, { p: pm, r: [.1, 0, 0] });
    k.add(g, k.box(.66, .18, .66, .06), steel, { p: [0, .74, -1.72] });
    // extension arms to the back of the backboard
    for (const sx of [-.4, .4]) {
      g.add(rod(k, [sx * .6, rimY + .1, -1.33], [sx, bbBot + .45, bbZ - .1], .06, steel, 12));
      g.add(rod(k, [sx * .6, rimY + .9, -1.26], [sx, bbBot + bbH - .55, bbZ - .1], .06, steel, 12));
    }
    k.add(g, k.box(.2, .9, .12, .04), steel, { p: [0, rimY + .3, -1.32] });   // height handle
    // the height gauge sticker on the pole: 7½ to 10 ft
    const gauge = k.painted(64, 256, (c, w, h) => {
      c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1d2025'; for (let i = 0; i <= 10; i++) c.fillRect(0, 12 + i * 23, i % 2 ? 18 : 30, 4);
      c.fillStyle = '#e0322a'; c.fillRect(0, 12, w, 8);
    }, { rough: .4 });
    const pd = new T.Vector3(...pm).sub(new T.Vector3(...pb)).normalize();
    const gp = new T.Vector3(...pm).addScaledVector(pd, -.9);
    k.add(g, k.cyl(.192, .192, .9, { open: true, seg: 24, start: -.6, len: 1.2 }), gauge, { p: gp.toArray(), r: [Math.atan2(pd.z, pd.y), 0, 0] });
    // backboard
    const bb = k.group([], { p: [0, bbBot + bbH / 2, bbZ] }); g.add(bb);
    k.add(bb, k.box(bbW, bbH, .16, .06), black);
    const face = k.painted(720, 480, (c, w, h) => {
      c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#e0322a'; c.lineWidth = 14; c.strokeRect(24, 24, w - 48, h - 48);
      const sw = w * 24 / 44, sh = h * 18 / 30, sy = (bbH - (rimY - bbBot)) / bbH * h;
      c.lineWidth = 12; c.strokeRect(w / 2 - sw / 2, sy - sh, sw, sh);
    }, { rough: .2, coat: .8 });
    k.add(bb, k.plane(bbW - .16, bbH - .16), face, { p: [0, 0, .081] });
    // rim and its bracket
    const rimR = .75 * S, rimZ = bbZ + .08 + .16 + rimR;
    k.add(g, k.torus(rimR, .055, { rs: 12, ts: 72 }), orange, { p: [0, rimY, rimZ], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.box(.56, .5, .06, .02), orange, { p: [0, rimY - .12, bbZ + .11] });
    k.add(g, k.box(.3, .05, .24, .02), orange, { p: [0, rimY - .02, bbZ + .24] });
    for (const s of [-1, 1]) g.add(rod(k, [s * .2, rimY - .34, bbZ + .12], [s * .14, rimY - .03, bbZ + .34], .03, orange, 10));
    // net: a diamond mesh hanging from hooks under the rim, tapering and then flaring a little at the bottom
    const J = 6, NN = 12, knots = [];
    for (let j = 0; j <= J; j++) {
      const t = j / J, rr = lerp(rimR - .02, .44 * S, Math.pow(t, .75)) + (j === J ? .05 : 0), y = rimY - .05 - t * 1.4 * S;
      knots.push(Array.from({ length: NN }, (_, i) => { const a = (i + (j % 2) * .5) / NN * TAU; return [Math.sin(a) * rr, y, rimZ + Math.cos(a) * rr]; }));
    }
    const seg = [];
    for (let j = 0; j < J; j++) for (let i = 0; i < NN; i++) {
      const a = knots[j][i], n1 = knots[j + 1][j % 2 ? i : (i + NN - 1) % NN], n2 = knots[j + 1][j % 2 ? (i + 1) % NN : i];
      seg.push(spanM(k, a, n1, .02), spanM(k, a, n2, .02));
    }
    g.add(instanced(k, k.cyl(1, 1, 1, { seg: 6 }), k.matte('#ffffff', .75), seg));
    g.add(instanced(k, k.torus(.05, .014, { rs: 4, ts: 10 }), k.metal('#d0d4da', .3), knots[0].map(([x, y, z]) => new T.Matrix4().makeRotationY(Math.atan2(x, z - rimZ)).setPosition(x, y + .02, z))));
    // the ball
    const ball = basketball(k, .47); ball.position.set(1.15, .47, .7); ball.rotation.set(.5, .9, .1); g.add(ball);
    g.userData.view = { az: 22, el: 12 };
    return g;
  },
};
