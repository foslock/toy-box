// Models for the Backyard set's beetles cards. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

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
const aim = (k, obj, n, axis = [0, 1, 0]) => { obj.quaternion.setFromUnitVectors(new k.THREE.Vector3(...axis), (n.isVector3 ? n.clone() : new k.THREE.Vector3(...n)).normalize()); return obj; };
// Turn an object so its local x runs along dx and its local y as near to dy as it can.
function orient(k, obj, dx, dy) {
  const T = k.THREE, X = new T.Vector3(...dx).normalize(), Z = new T.Vector3().crossVectors(X, new T.Vector3(...dy)).normalize(), Y = new T.Vector3().crossVectors(Z, X);
  obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z));
  return obj;
}

// A skin over a grid: f(u, v, i, j) => [x, y, z]. us / vs: sample counts or lists of sample values in [0, 1].
// The uv attribute is (u, v), so a uvTex painted with the same f lines up. Faces are turned to point away from o.inside
// (default: the middle of the bounding box). o.color(u, v, i, j) => [r, g, b] (sRGB 0–1) adds vertex colours.
function surface(k, us, vs, f, o = {}) {
  const T = k.THREE, U = typeof us === 'number' ? Array.from({ length: us + 1 }, (_, i) => i / us) : us;
  const V = typeof vs === 'number' ? Array.from({ length: vs + 1 }, (_, i) => i / vs) : vs;
  const nu = U.length, nv = V.length, pos = [], uv = [], col = [], idx = [], c = new T.Color();
  V.forEach((v, j) => U.forEach((u, i) => {
    const p = f(u, v, i, j); pos.push(p[0], p[1], p[2]); uv.push(u, v);
    if (o.color) { const q = o.color(u, v, i, j); c.setRGB(q[0], q[1], q[2], T.SRGBColorSpace); col.push(c.r, c.g, c.b); }
  }));
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = j * nu + i, b = a + 1, cc = a + nu, d = cc + 1; idx.push(a, b, cc, b, d, cc); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  if (o.color) geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  geo.computeBoundingBox();
  const inside = o.inside ? new T.Vector3(...o.inside) : geo.boundingBox.getCenter(new T.Vector3());
  const P = geo.attributes.position, N = geo.attributes.normal, a = new T.Vector3(), n = new T.Vector3();
  let score = 0;
  for (let i = 0; i < P.count; i += 3) { a.fromBufferAttribute(P, i).sub(inside); n.fromBufferAttribute(N, i); score += Math.sign(a.dot(n)); }
  if (score < 0) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    geo.setIndex(idx); geo.computeVertexNormals();
  }
  return weld(geo);
}
// A texture painted pixel by pixel in uv space: fn(u, v) => [r, g, b(, a)] in 0–1 (sRGB colour unless o.data).
function uvTex(k, W, H, fn, o = {}) {
  return k.tex(W, H, (c, w, h) => {
    const img = c.createImageData(w, h), d = img.data;
    for (let j = 0; j < h; j++) {
      const v = 1 - (j + .5) / h;
      for (let i = 0; i < w; i++) {
        const q = fn((i + .5) / w, v), n = (j * w + i) * 4;
        d[n] = q[0] * 255; d[n + 1] = q[1] * 255; d[n + 2] = q[2] * 255; d[n + 3] = (q[3] ?? 1) * 255;
      }
    }
    c.putImageData(img, 0, 0);
  }, o);
}
// A point on a dome over an ellipsoid (radii rx, ry, rz, centred on the origin) by angles: f round from the top
// towards +x, l along from the middle towards the front (+z).
const domePt = (rx, ry, rz, f, l) => [rx * Math.cos(l) * Math.sin(f), ry * Math.cos(l) * Math.cos(f), rz * Math.sin(l)];

// A jointed leg or antenna: tapered segments through pts ([[x, y, z], ...]) with a ball at every joint.
// rads: the radius at each point; o.bulge: how much each segment swells in the middle (a number or one per segment).
function limbGeo(k, pts, rads, o = {}) {
  const T = k.THREE, parts = [], Y = new T.Vector3(0, 1, 0), rs = o.rs ?? 10;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new T.Vector3(...pts[i]), d = new T.Vector3(...pts[i + 1]).sub(a), L = d.length();
    const bu = (Array.isArray(o.bulge) ? o.bulge[i] : o.bulge) ?? 1.12, prof = [];
    for (let j = 0; j <= 8; j++) { const t = j / 8; prof.push(new T.Vector2((rads[i] + (rads[i + 1] - rads[i]) * t) * (1 + (bu - 1) * Math.sin(Math.PI * t)), t * L)); }
    const geo = new T.LatheGeometry(prof, rs);
    geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(Y, d.normalize())); geo.translate(a.x, a.y, a.z);
    parts.push(geo);
  }
  pts.forEach((p, i) => { const s = new T.SphereGeometry(rads[i] * (o.joint ?? 1.06), rs, 8); s.translate(p[0], p[1], p[2]); parts.push(s); });
  return k.merge(parts);
}
// sign-preserving power, for superellipses: n = 2 is round, bigger is squarer.
const se = (a, n) => Math.sign(a) * Math.abs(a) ** (2 / n);
// A point on a dome over a superellipsoid (radii rx, ry, rz, centred on the origin) by angles: f round from the top
// towards +x, l along from the middle towards the front (+z). nf squares the cross-section, nl the outline seen from above.
const superDome = (rx, ry, rz, f, l, nf = 2, nl = 2) => { const cl = se(Math.cos(l), nl); return [rx * cl * se(Math.sin(f), nf), ry * cl * se(Math.cos(f), nf), rz * se(Math.sin(l), nl)]; };
// Move every vertex with fn(x, y, z) => [x, y, z], then fix the normals.
function warp(geo, fn) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const q = fn(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, q[0], q[1], q[2]); }
  geo.computeVertexNormals();
  return weld(geo);
}
// A rounded, boxy blob: a superellipsoid with radii r and squareness n (2 = an ellipsoid).
const blobGeo = (k, r, n = 2.6, seg = [40, 24]) => surface(k, seg[0], seg[1], (u, v) => {
  const a = u * TAU, e = (v - .5) * Math.PI, ce = se(Math.cos(e), n);
  return [r[0] * ce * se(Math.sin(a), n), r[1] * se(Math.sin(e), n), r[2] * ce * se(Math.cos(a), n)];
}, { inside: [0, 0, 0] });

// A glossy dark eye: an ellipsoid (radius r, or radii [x, y, z]); finish() gives it a tiny highlight facing the camera.
function eye(k, parent, p, r, mat, o = {}) {
  const m = k.add(parent, k.sphere(1, { w: 28, h: 18 }), mat, { p, s: Array.isArray(r) ? r : [r, r, r], r: o.r });
  m.userData.eye = { hr: o.hr ?? .24 };
  return m;
}
// Last touch for every model: a white glint on each eye where the key light would catch it from the model's camera
// (the model root is still untransformed here, so its local space is the world the studio will show).
function finish(k, g) {
  const T = k.THREE, v = g.userData.view ?? {}, az = k.deg(v.az ?? 30), el = k.deg(v.el ?? 16);
  const cam = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const key = new T.Vector3(Math.sin(az - 1) * Math.cos(.87), Math.sin(.87), Math.cos(az - 1) * Math.cos(.87));
  const H = cam.add(key).normalize(), glow = k.glow('#ffffff', 1.1), geo = k.sphere(1, { w: 10, h: 8 });
  g.updateMatrixWorld(true);
  const eyes = []; g.traverse(o => { if (o.userData.eye) eyes.push(o); });
  const pos = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3();
  for (const e of eyes) {
    e.matrixWorld.decompose(pos, q, sc);
    const u = H.clone().applyQuaternion(q.clone().invert()).multiply(sc).normalize().multiplyScalar(.97).applyMatrix4(e.matrixWorld);
    k.add(g, geo, glow, { p: u.toArray(), s: e.userData.eye.hr * Math.min(sc.x, sc.y, sc.z), shadow: false });
  }
  return g;
}
// A soft glow around a light: a sprite that always faces the camera (it doesn't count when the studio frames the model).
function halo(k, r, color, opacity = .5) {
  const T = k.THREE;
  const tex = k.tex(128, 128, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.22, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, { cache: 'beetleHalo' });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k.color(color), transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }));
  s.scale.set(r * 2, r * 2, 1);
  return s;
}
// A four-pointed twinkle, drawn over everything.
function sparkle(k, size, rot = 0) {
  const T = k.THREE, tex = k.tex(128, 128, (c, w, h) => {
    c.translate(w / 2, h / 2);
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, w * .2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(-w / 2, -h / 2, w, h);
    for (const a of [0, Math.PI / 2]) {
      c.save(); c.rotate(a);
      const lg = c.createLinearGradient(-w / 2, 0, w / 2, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.5, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = lg; c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(0, -w * .035); c.lineTo(w / 2, 0); c.lineTo(0, w * .035); c.closePath(); c.fill();
      c.restore();
    }
  }, { cache: 'sparkle4' });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k.color('#fff4d2'), transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending, rotation: rot }));
  s.scale.set(size, size, 1);
  return s;
}
// Hairs standing out of an ellipsoid (centre c, radii r): n thin cones along the normals with a little lean.
// o.where(d) keeps a direction or not. colors: hex colours to pick from.
function fuzz(k, parent, c, r, n, len, colors, o = {}) {
  const T = k.THREE, list = [], Y = new T.Vector3(0, 1, 0), q = new T.Quaternion(), e = new T.Euler();
  for (let tries = 0; list.length < n && tries < n * 30; tries++) {
    const z = k.range(-1, 1), a = k.range(0, TAU), s = Math.sqrt(1 - z * z), d = [s * Math.cos(a), z, s * Math.sin(a)];
    if (o.where && !o.where(d)) continue;
    const { p, n: nn } = onBall(k, c, r, d);
    nn.add(new T.Vector3(k.range(-1, 1), k.range(-1, 1), k.range(-1, 1)).multiplyScalar(o.lean ?? .35)).normalize();
    q.setFromUnitVectors(Y, nn); e.setFromQuaternion(q);
    p.addScaledVector(nn, -len * .2);
    list.push({ p: p.toArray(), r: [e.x, e.y, e.z], s: [1, k.range(.6, 1.2), 1], color: k.pick(colors) });
  }
  const geo = k.cone(len * (o.thick ?? .12), len, 5); geo.translate(0, len / 2, 0);
  const m = k.instances(geo, o.mat ?? k.matte('#ffffff', .8), list);
  parent.add(m); return m;
}
// A flat see-through wing. pts: outline [[x, y], ...] with x along the span from the root (0) to the tip (1), y across
// (leading edge +y), all scaled by len. paint(ctx, outline) draws the veins in those same span units.
function wingMesh(k, pts, len, paint, o = {}) {
  const T = k.THREE, shape = new T.Shape();
  shape.moveTo(pts[0][0] * len, pts[0][1] * len);
  shape.splineThru(pts.slice(1).map(([x, y]) => new T.Vector2(x * len, y * len)));
  shape.closePath();
  const geo = new T.ShapeGeometry(shape, 40);
  geo.computeBoundingBox();
  const bb = geo.boundingBox, uv = geo.attributes.uv, p = geo.attributes.position, w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - bb.min.x) / w, (p.getY(i) - bb.min.y) / h);
  const W = 512, H = Math.max(32, Math.round(W * h / w)), outline = shape.getPoints(48).map(v => [v.x / len, v.y / len]);
  const map = k.tex(W, H, c => {
    c.setTransform(W / w * len, 0, 0, -H / h * len, -bb.min.x * W / w, H + bb.min.y * H / h);
    c.lineJoin = c.lineCap = 'round';
    paint(c, outline);
  }, { cache: o.cache });
  const mat = k.mat({ map, transparent: true, depthWrite: false, side: T.DoubleSide, roughness: .2, metalness: 0, clearcoat: 1, clearcoatRoughness: .08,
    iridescence: o.irid ?? .9, iridescenceIOR: 1.3, iridescenceThicknessRange: [220, 520] });
  return k.mesh(geo, mat, { shadow: false });
}
// Stroke a polyline (in the current canvas transform).
const vein = (c, w, ...p) => { c.lineWidth = w; c.beginPath(); p.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); };
// Smooth value noise in 2D (0–1), for mottled textures.
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export default {
  // A seven-spot ladybug: glossy red wing cases, a black and white head shield, six thin black legs.
  ladybug(k) {
    const g = k.group(), b = k.group([], { r: [0, -.42, 0] }); g.add(b);
    const black = k.gloss('#141215'), whiteM = k.gloss('#f5f1e8', { rough: .3 }), legM = k.plastic('#161316', { rough: .4, coat: .4 });
    const yb = .3, zc = -.12;
    // wing cases: a dome split by the centre seam, painted with seven spots
    const E = [.9, .74, 1.02], wrapE = 1.66;
    const eF = (u, v) => { const t = u * 2 - 1; return [Math.sign(t) * Math.abs(t) ** 1.2 * wrapE, -Math.PI / 2 + v * Math.PI * .9]; };
    const elytra = (u, v) => {
      const [f, l] = eF(u, v), gr = 1 - .022 * Math.exp(-((f / .045) ** 2)), p = domePt(E[0] * gr, E[1] * gr, E[2], f, l);
      return [p[0], yb + p[1], zc + p[2]];
    };
    const spot = (f, l, r) => { const p = domePt(...E, f, l); return [[p[0], yb + p[1], zc + p[2]], r]; };
    const spots = [spot(0, 1.02, .2), ...[1, -1].flatMap(s => [spot(s * .6, .5, .165), spot(s * 1.12, -.06, .21), spot(s * .52, -.74, .165)])];
    const red = rgb('#d8261b'), ink = rgb('#141013'), deep = rgb('#9c160f');
    const elytraMap = uvTex(k, 512, 512, (u, v) => {
      const p = elytra(u, v), af = Math.abs(eF(u, v)[0]);
      let d = 9; for (const [c, r] of spots) d = Math.min(d, dist3(p, c) - r);
      let c = mixC(red, deep, smooth(1.3, 1.62, af) * .7);
      c = mixC(c, ink, smooth(.006, -.006, d));
      return mixC(c, ink, smooth(.022, .008, af) * .85);   // the seam
    });
    k.add(b, surface(k, 96, 72, elytra), k.gloss('#ffffff', { map: elytraMap }));
    // head shield (pronotum): black with two white patches at the front corners
    const P = [.6, .4, .42], pz = zc + .8, py = yb - .02;
    const pF = (u, v) => [(u * 2 - 1) * 1.62, -Math.PI / 2 + (.3 + .7 * v) * Math.PI];
    const pronMap = uvTex(k, 256, 256, (u, v) => { const [f, l] = pF(u, v); return mixC(ink, rgb('#f5f1e8'), smooth(1.04, .96, Math.hypot((Math.abs(f) - 1.05) / .42, (l - .62) / .52))); });
    k.add(b, surface(k, 64, 40, (u, v) => { const [f, l] = pF(u, v), p = domePt(...P, f, l); return [p[0], py + p[1], pz + p[2]]; }), k.gloss('#ffffff', { map: pronMap }));
    // head, with pale cheek patches, eyes and short clubbed antennae
    const hz = pz + P[2] - .03, hy = yb - .02;
    k.add(b, k.sphere(1, { w: 40, h: 24 }), black, { p: [0, hy, hz], s: [.35, .23, .22] });
    for (const s of [-1, 1]) {
      k.add(b, k.sphere(1, { w: 20, h: 12 }), whiteM, { p: [s * .14, hy + .06, hz + .18], s: [.075, .05, .03], r: [0, s * .5, s * .3] });
      eye(k, b, [s * .265, hy + .035, hz + .1], .092, black);
    }
    const ant = [1, -1].map(s => limbGeo(k, [[s * .18, hy + .08, hz + .16], [s * .28, hy + .15, hz + .31], [s * .34, hy + .18, hz + .4], [s * .39, hy + .2, hz + .48]], [.017, .015, .018, .036], { bulge: [1, 1, 1.25], rs: 8 }));
    k.add(b, k.merge(ant), legM);
    // belly and six jointed legs, mid-stride
    k.add(b, k.sphere(1, { w: 40, h: 20 }), black, { p: [0, yb - .03, zc], s: [.76, .15, .9] });
    const legs = [];
    for (const s of [-1, 1]) {
      [[.5, .42], [.1, .04], [-.28, -.4]].forEach(([z0, dz], i) => {
        const up = (i === 1) === (s > 0) ? .05 : 0;
        legs.push(limbGeo(k, [[s * .32, .16, z0], [s * .98, .18 + up, z0 + dz * .55], [s * 1.1, .05 + up, z0 + dz * .9], [s * 1.18, .02 + up, z0 + dz * 1.15]],
          [.045, .038, .028, .018], { bulge: [1.3, 1.1, 1], joint: 1 }));
      });
    }
    k.add(b, k.merge(legs), legM);
    g.userData.view = { az: 28, el: 34 };
    g.userData.fullView = { el: 26 };
    g.userData.noHero = true;
    return finish(k, g);
  },

  // A honeybee: fuzzy golden thorax, amber and black striped abdomen, veined glassy wings, pollen on her back legs.
  honeybee(k) {
    const T = k.THREE, g = k.group(), b = k.group([], { r: [0, -.8, 0] }); g.add(b);
    const chitin = k.plastic('#2b1d14', { rough: .45, coat: .45 }), headM = k.plastic('#24180f', { rough: .6, coat: .15 }), eyeM = k.gloss('#302219', { rough: .08 }), hairM = k.matte('#ffffff', .85);
    const golds = ['#e8b85c', '#d9a44c', '#c68b3b', '#f2cd7a', '#b57b31', '#e0ac52'];
    // thorax: a fuzzy golden ball
    const TH = [0, .68, 0], thr = [.42, .4, .47];
    k.add(b, k.sphere(1, { w: 40, h: 28 }), k.fabric('#b88233', { sheen: '#ffdd90' }), { p: TH, s: thr });
    fuzz(k, b, TH, thr, 1300, .085, golds, { mat: hairM, lean: .6, thick: .12, where: d => d[1] > -.6 });
    // head: a rounded triangle seen from the front, tipped forward, with big dark eyes
    const hg = k.group([], { p: [0, .64, .56], r: [.38, 0, 0] }); b.add(hg);
    const HR = [.39, .43, .24];
    k.add(hg, warp(k.sphere(1, { w: 40, h: 28 }), (x, y, z) => [x * (1 - .36 * Math.max(0, -y)) * HR[0], y * HR[1], z * HR[2] * (1 - .25 * Math.max(0, -y))]), headM);
    fuzz(k, hg, [0, .02, .02], [.32, .38, .22], 220, .075, ['#f0cf86', '#e2b868', '#f7dca0', '#d9a955'], { mat: hairM, lean: .35, where: d => d[2] > .3 && d[1] > -.45 && d[1] < .75 && Math.abs(d[0]) < .62 });
    for (const s of [-1, 1]) eye(k, hg, [s * .29, .06, .05], [.11, .27, .16], eyeM, { r: [0, 0, s * .12] });
    for (const [x, y, z] of [[0, .43, .07], [-.08, .4, .02], [.08, .4, .02]]) k.add(hg, k.sphere(.03, { w: 12, h: 8 }), eyeM, { p: [x, y, z] });
    for (const s of [-1, 1]) k.add(hg, k.sphere(1, { w: 16, h: 10 }), k.plastic('#a8651f', { rough: .4 }), { p: [s * .07, -.42, .08], s: [.06, .08, .05], r: [0, 0, s * .4] });
    const ant = [1, -1].map(s => limbGeo(k, [[s * .06, .1, .21], [s * .1, .36, .3], [s * .17, .45, .45], [s * .25, .46, .6], [s * .31, .41, .72]], [.026, .024, .022, .02, .019], { bulge: 1.05, rs: 8 }));
    k.add(hg, k.merge(ant), chitin);
    // abdomen: six overlapping bands, amber at the front of each, black behind
    const AB = k.group([], { p: [0, .62, -.4], r: [-.2, 0, 0] }); b.add(AB);
    const bounds = [0, .07, .24, .41, .57, .71, .84, 1], L = 1.5, R = .45, rows = [];
    for (let s = 0; s < bounds.length - 1; s++) { const m = s ? 10 : 4; for (let i = 0; i <= m; i++) { const q = i / m; rows.push({ t: bounds[s] + (bounds[s + 1] - bounds[s]) * q, q, s }); } }
    const prof = t => t < .3 ? .12 + .88 * Math.sqrt(1 - ((.3 - t) / .3) ** 2) : Math.pow(Math.max(0, 1 - ((t - .3) / .7) ** 2), .5);
    const amber = rgb('#e2a232'), amberD = rgb('#bf7a1d'), blk = rgb('#1f150e'), hair = rgb('#f0d38e');
    const abdCol = (s, q) => {
      if (s === 0) return blk;
      const to = [0, .6, .58, .55, .28, .14, .1][s];
      const c = mixC(mixC(amber, amberD, q * .6), blk, smooth(to - .05, to + .05, q));
      return mixC(c, hair, .55 * smooth(.16, 0, q));
    };
    k.add(AB, surface(k, 48, rows.map(r => r.t), (u, v, i, j) => {
      const { t, q, s } = rows[j], r = R * prof(t) * (s ? 1 + .06 * q * q : 1), a = u * TAU;
      return [r * Math.sin(a), r * .9 * Math.cos(a), -t * L];
    }, { color: (u, v, i, j) => abdCol(rows[j].s, rows[j].q) }), k.mat({ vertexColors: true, roughness: .5, clearcoat: .35, clearcoatRoughness: .3, sheen: .7, sheenColor: k.color('#ffe2a2'), sheenRoughness: .45 }));
    k.add(AB, k.cone(.035, .16, 12), chitin, { p: [0, 0, -L - .05], r: [-Math.PI / 2, 0, 0] });
    k.add(b, k.sphere(.1, { w: 16, h: 12 }), chitin, { p: [0, .62, -.4] });
    // wings: two on each side, clear with brown veins
    const fore = [[0, 0], [.14, .075], [.4, .12], [.65, .135], [.86, .115], [.98, .06], [1, 0], [.95, -.07], [.78, -.12], [.52, -.135], [.28, -.1], [.1, -.045], [0, -.005]];
    const hind = [[0, 0], [.2, .06], [.55, .09], [.85, .07], [.99, .02], [.96, -.05], [.75, -.1], [.45, -.11], [.18, -.07], [0, -.01]];
    const ink = 'rgba(84,56,30,.95)';
    const veinsFore = (c, out) => {
      c.fillStyle = 'rgba(214,224,240,.34)'; c.fillRect(-1, -1, 3, 2);
      c.strokeStyle = ink; c.fillStyle = ink;
      vein(c, .014, [0, 0], [.2, .08], [.45, .118], [.63, .128]);
      c.beginPath(); c.ellipse(.62, .118, .035, .011, .05, 0, TAU); c.fill();
      vein(c, .008, [.63, .12], [.78, .118], [.9, .095], [.86, .08], [.7, .085], [.63, .1], [.63, .12]);
      vein(c, .008, [0, -.004], [.3, .055], [.5, .08], [.63, .1]);
      vein(c, .008, [.48, .075], [.6, .062], [.72, .062], [.84, .055]);
      for (const [x0, x1] of [[.5, .5], [.6, .6], [.7, .71], [.8, .82]]) vein(c, .007, [x0, .077], [x1, .03]);
      vein(c, .007, [.02, -.01], [.25, .01], [.5, .03], [.8, .03]);
      vein(c, .007, [.03, -.03], [.3, -.04], [.5, -.03], [.72, -.005], [.88, .01]);
      vein(c, .007, [.02, -.04], [.2, -.08], [.36, -.1]);
      for (const x of [.3, .42]) vein(c, .006, [x, .01 + (x - .3) * .1], [x, -.045]);
      c.strokeStyle = 'rgba(84,56,30,.7)'; vein(c, .007, ...out, out[0]);
    };
    const veinsHind = (c, out) => {
      c.fillStyle = 'rgba(214,224,240,.3)'; c.fillRect(-1, -1, 3, 2);
      c.strokeStyle = ink;
      vein(c, .012, [0, 0], [.3, .06], [.55, .08]);
      vein(c, .008, [.03, -.01], [.3, 0], [.55, -.01], [.75, -.02]);
      vein(c, .007, [.3, .06], [.3, 0]);
      vein(c, .007, [.05, -.03], [.3, -.07]);
      c.strokeStyle = 'rgba(84,56,30,.6)'; vein(c, .007, ...out, out[0]);
    };
    for (const s of [-1, 1]) {
      const fw = k.group([], { p: [s * .24, .98, .12] }); b.add(fw);
      orient(k, fw, [s * .5, .3, -1], [s * .88, 0, .47]);
      fw.add(wingMesh(k, fore, 1.5, veinsFore, { cache: 'beeFore' }));
      const hw = k.group([], { p: [s * .22, .93, -.04] }); b.add(hw);
      orient(k, hw, [s * .66, .22, -1], [s * .82, 0, .57]);
      hw.add(wingMesh(k, hind, 1.02, veinsHind, { cache: 'beeHind' }));
    }
    // six legs; the back pair carry baskets of pollen
    const pollenGeo = warp(k.sphere(1, { w: 24, h: 16 }), (x, y, z) => { const n = 1 + .07 * Math.sin(9 * x + 3 * y) * Math.sin(7 * z + 2 * y) + .04 * Math.sin(15 * y + 5 * x); return [x * n, y * n, z * n]; });
    const pollenM = k.plastic('#f9b51e', { rough: .7, coat: .1 });
    const legs = [], L0 = [.055, .05, .04, .03, .022];
    for (const s of [-1, 1]) {
      legs.push(limbGeo(k, [[s * .13, .42, .26], [s * .34, .42, .42], [s * .42, .14, .58], [s * .45, .05, .66], [s * .47, .016, .74]], L0, { bulge: [1.25, 1.1, 1, 1] }));
      legs.push(limbGeo(k, [[s * .18, .38, .04], [s * .52, .48, .08], [s * .66, .14, .06], [s * .72, .05, .02], [s * .76, .016, -.04]], L0, { bulge: [1.25, 1.1, 1, 1] }));
      const hk = [s * .52, .5, -.34], ha = [s * .66, .16, -.62];
      legs.push(limbGeo(k, [[s * .16, .38, -.14], hk, ha, [s * .7, .05, -.74], [s * .72, .016, -.86]], [.058, .052, .08, .036, .022], { bulge: [1.25, 1.2, 1, 1] }));
      const d = new T.Vector3(...ha).sub(new T.Vector3(...hk)), pc = new T.Vector3(...hk).addScaledVector(d, .42); pc.x += s * .075;
      b.add(aim(k, k.mesh(pollenGeo, pollenM, { p: pc.toArray(), s: [.14, .18, .14] }), d));
    }
    k.add(b, k.merge(legs), chitin);
    g.userData.view = { az: 34, el: 22 };
    g.userData.fullView = { el: 18 };
    g.userData.noHero = true;
    return finish(k, g);
  },

  // A pill bug on the move, heading for a second one rolled up into a tight armoured ball.
  rolypoly(k) {
    const g = k.group();
    // the body plan along t, from the tail (0) to the front of the head (1): tail tip, five little tail rings,
    // seven armour plates and the head
    const B = [0, .05];
    for (let i = 1; i <= 5; i++) B.push(.05 + i * .038);
    for (let i = 1; i <= 7; i++) B.push(.24 + i * .0921);
    B.push(1);
    const HEAD = B.length - 2;
    const amp = s => s === 0 || s === HEAD ? 0 : s <= 5 ? .03 : .055;
    const rows = [];
    for (let s = 0; s <= HEAD; s++) { const m = s === 0 ? 5 : s <= 5 ? 3 : 8; for (let i = 0; i <= m; i++) { const q = i / m; rows.push({ t: B[s] + (B[s + 1] - B[s]) * q, q, s }); } }
    // each plate rises to a rim at its back edge, which laps over the front of the plate behind
    const lift = r => r.s === HEAD ? .9 + .03 * (1 - r.q) : 1 + amp(r.s) * (1 - r.q) ** 1.5;
    const segAt = t => { let s = 0; while (s < HEAD && t > B[s + 1]) s++; return [s, (t - B[s]) / (B[s + 1] - B[s])]; };
    const slate = rgb('#565c65'), rim = rgb('#979ca3'), tuck = rgb('#2f3339'), fleck = rgb('#c4bb9c'), skirt = rgb('#7c7f86'), headC = rgb('#464b53');
    const shellMap = uvTex(k, 256, 512, (u, v) => {
      const [s, q] = segAt(v), side = Math.abs(u - .5) * 2;
      let c = s === HEAD ? headC : slate;
      if (s > 0 && s < HEAD) {
        c = mixC(c, rim, smooth(.22, 0, q) * .85);
        c = mixC(c, tuck, smooth(.62, 1, q) * .85);
        if (s > 5) for (const fx of [.28, .6]) { const d = Math.hypot((side - fx) * .9, (q - .42) * .22); c = mixC(c, fleck, smooth(.042, .026, d) * .6); }
      }
      return mixC(c, skirt, smooth(.8, .98, side) * .55);
    });
    const shell = k.plastic('#ffffff', { map: shellMap, rough: .45, coat: .35, coatRough: .3 });
    const legM = k.plastic('#7d766f', { rough: .5, coat: .2 }), dark = k.gloss('#141416'), slateM = k.plastic('#5d636b', { rough: .4, coat: .4 });
    // the walker
    const L = 2.4, W0 = .7, H0 = .58, yb = .24, fm = 1.62;
    const halfW = t => W0 * Math.pow(Math.max(0, 1 - Math.abs(2 * t - 1) ** 2.4), .45) * (.8 + .2 * smooth(0, .5, t));
    const halfH = t => H0 * Math.pow(Math.max(0, 1 - Math.abs(2 * t - 1) ** 2.2), .5) * (.82 + .18 * smooth(0, .5, t));
    const bodyPt = (t, a, f) => [halfW(t) * f * se(Math.sin(a), 2.4), yb + halfH(t) * f * se(Math.cos(a), 2.4), (t - .5) * L];
    const w = k.group([], { p: [-.7, 0, .1], r: [0, 1.1, 0] }); g.add(w);
    k.add(w, surface(k, 56, rows.map(r => r.t), (u, v, i, j) => bodyPt(rows[j].t, (u * 2 - 1) * fm, lift(rows[j])), { inside: [0, yb + .1, 0] }), shell);
    k.add(w, k.sphere(1, { w: 32, h: 16 }), legM, { p: [0, yb - .02, 0], s: [W0 * .82, .1, L * .44] });
    const legs = [];
    for (let i = 0; i < 7; i++) {
      const t = (B[6 + i] + B[7 + i]) / 2, z = (t - .5) * L, hw = halfW(t), dz = (t - .56) * .45;
      for (const s of [-1, 1]) { const st = (i + (s > 0 ? 1 : 0)) % 2 ? .05 : -.04; legs.push(limbGeo(k, [[s * hw * .5, .15, z], [s * (hw + .02), .15, z + dz * .5 + st], [s * (hw + .1), .018, z + dz + st * 1.5]], [.032, .026, .016], { bulge: [1.15, 1.05], rs: 8 })); }
    }
    k.add(w, k.merge(legs), legM);
    const ant = [-1, 1].map(s => { const p0 = bodyPt(.965, s * .5, .9); return limbGeo(k, [[p0[0] * .8, p0[1] - .04, p0[2]], [s * .3, yb + .2, 1.22], [s * .44, yb + .24, 1.34], [s * .58, yb + .17, 1.46], [s * .68, yb + .08, 1.56], [s * .74, yb + .01, 1.62]], [.036, .032, .028, .024, .02, .016], { bulge: 1.08, rs: 8 }); });
    k.add(w, k.merge(ant), k.plastic('#6d6a68', { rough: .4, coat: .4 }));
    for (const s of [-1, 1]) {
      const e = bodyPt(.935, s * 1.0, .92);
      eye(k, w, [e[0] * 1.02, e[1], e[2]], .045, dark);
      k.add(w, k.sphere(1, { w: 16, h: 10 }), slateM, { p: [s * .12, yb + .02, -1.19], s: [.05, .04, .09] });
    }
    // the ball
    const Rb = .56;
    const ball = k.group([], { p: [1.25, Rb * 1.06, .1], r: [Math.PI + .6, .6, 0], order: 'YXZ' }); g.add(ball);
    k.add(ball, surface(k, 40, rows.map(r => r.t), (u, v, i, j) => {
      const r = rows[j], be = (u - .5) * Math.PI, cb = Math.cos(be), f = 1 + (lift(r) - 1) * Math.pow(Math.max(0, cb), .7), a = r.t * TAU;
      return [Rb * .97 * Math.sin(be), Rb * f * cb * Math.cos(a), Rb * f * cb * Math.sin(a)];
    }, { inside: [0, 0, 0] }), shell);
    g.userData.view = { az: 30, el: 24 };
    g.userData.fullView = { el: 20 };
    g.userData.noHero = true;
    return finish(k, g);
  },

  // A firefly with its wing covers just open and its lantern lit.
  firefly(k) {
    const T = k.THREE, g = k.group(), b = k.group([], { r: [0, -1.95, 0] }); g.add(b);
    const brown = k.plastic('#2b1e15', { rough: .4, coat: .5 }), legM = k.plastic('#241913', { rough: .45, coat: .3 }), eyeM = k.gloss('#0f0c0a', { rough: .1 });
    const yb = .26;
    // head shield: red-orange with a black spot and pale yellow margins
    const P = [.48, .17, .42], pz = .64, py = yb + .1, lo = .3;
    const pronF = (u, v) => [(u * 2 - 1) * 1.68, -Math.PI / 2 + (lo + (1 - lo) * v) * Math.PI];
    const pronMap = uvTex(k, 256, 256, (u, v) => {
      const [f, l] = pronF(u, v), af = Math.abs(f);
      let c = mixC(rgb('#f25a26'), rgb('#e2431f'), smooth(.2, 1, l));
      c = mixC(c, rgb('#121010'), smooth(1.05, .9, Math.hypot(f / .32, (l - .12) / .62)));
      return mixC(c, rgb('#f4cf62'), smooth(1.12, 1.3, af));
    });
    k.add(b, surface(k, 56, 36, (u, v) => { const [f, l] = pronF(u, v), p = domePt(...P, f, l); return [p[0], py + p[1], pz + p[2]]; }), k.gloss('#ffffff', { map: pronMap, rough: .28 }));
    // head tucked underneath, with big eyes and long feelers
    const hz = pz + P[2] - .08;
    k.add(b, k.sphere(1, { w: 32, h: 20 }), brown, { p: [0, yb + .04, hz - .04], s: [.2, .15, .17] });
    for (const s of [-1, 1]) eye(k, b, [s * .14, yb + .05, hz + .02], .11, eyeM);
    const ant = [1, -1].map(s => limbGeo(k, [[s * .07, yb + .1, hz + .08], [s * .16, yb + .22, hz + .28], [s * .28, yb + .3, hz + .5], [s * .42, yb + .32, hz + .7], [s * .55, yb + .27, hz + .88]], [.024, .022, .02, .017, .014], { bulge: 1.05, rs: 8 }));
    k.add(b, k.merge(ant), brown);
    // wing covers, dark with pale edges, parted, and the smoky flying wings peeking out between them
    const Le = 1.45, We = .36;
    const elyMap = uvTex(k, 128, 512, (u, v) => {
      let c = mixC(rgb('#3d2c1f'), rgb('#4e3828'), smooth(.15, .55, u) * (1 - smooth(.6, .85, u)) * .6);
      c = mixC(c, rgb('#e6cc78'), smooth(.91, .95, u));
      return mixC(c, rgb('#c2a35c'), smooth(.04, .015, u) * .85);
    });
    const elyM = k.plastic('#ffffff', { map: elyMap, rough: .4, coat: .55, side: T.DoubleSide });
    for (const s of [-1, 1]) {
      const hinge = k.group([], { p: [s * .01, yb + .09, .46], r: [.13, -s * .25, s * .08] }); b.add(hinge);
      k.add(hinge, surface(k, 24, 48, (u, v) => {
        const wv = We * (v < .7 ? 1 - .06 * v : .958 * Math.sqrt(Math.max(0, 1 - ((v - .7) / .3) ** 2)));
        return [s * wv * u, (.13 * (1 - u ** 2.2) - .1 * smooth(.78, 1, u)) * Math.sqrt(wv / We), -v * Le];
      }), elyM);
    }
    const wingOut = [[0, 0], [.2, .09], [.5, .13], [.8, .12], [.97, .06], [1, 0], [.95, -.07], [.7, -.11], [.4, -.1], [.15, -.06], [0, -.01]];
    const smoky = (c, out) => {
      c.fillStyle = 'rgba(96,84,70,.42)'; c.fillRect(-1, -1, 3, 2);
      c.strokeStyle = 'rgba(40,30,22,.85)';
      vein(c, .012, [0, 0], [.35, .1], [.7, .1]);
      vein(c, .008, [.02, -.01], [.4, .01], [.8, .02]);
      vein(c, .008, [.05, -.03], [.4, -.06], [.7, -.07]);
      c.strokeStyle = 'rgba(40,30,22,.5)'; vein(c, .006, ...out, out[0]);
    };
    for (const s of [-1, 1]) {
      const wg = k.group([], { p: [s * .05, yb + .12, .36] }); b.add(wg);
      orient(k, wg, [s * .1, .03, -1], [s * 1, .05, .1]);
      wg.add(wingMesh(k, wingOut, 1.5, smoky, { cache: 'fireflyWing', irid: .5 }));
    }
    // abdomen: dark rings, the last two a big glowing lantern
    const abB = [0, .14, .27, .4, .52, .64, .81, 1], Lb = 1.62, z0 = .32, abRows = [];
    for (let s = 0; s < 7; s++) for (let i = 0; i <= 6; i++) { const q = i / 6; abRows.push({ t: abB[s] + (abB[s + 1] - abB[s]) * q, q, s }); }
    const abR = t => .27 * Math.pow(Math.max(0, 1 - Math.abs((t - .42) / .58) ** 2.4), .5) * (1 + .5 * smooth(.6, .74, t));
    const abC = t => [0, yb + .06 + .3 * t * t, z0 - t * Lb];
    const abPt = rs => (u, v, i, j) => { const r = rs[j], R = abR(r.t) * (1 + .045 * r.q * r.q), c = abC(r.t), a = u * TAU; return [c[0] + R * Math.sin(a), c[1] + (.62 + .24 * smooth(.6, .72, r.t)) * R * Math.cos(a), c[2]]; };
    const front = abRows.filter(r => r.s < 5), lamp = abRows.filter(r => r.s >= 5);
    k.add(b, surface(k, 36, front.map(r => r.t), abPt(front)), brown);
    // the lantern: two rings, glowing brightest towards the tip
    const glowMap = uvTex(k, 8, 256, (u, v) => { const e = (.6 + .4 * smooth(.64, .95, v)) * (1 - .35 * Math.exp(-(((v - .81) / .012) ** 2))); return [e, e, e]; });
    k.add(b, surface(k, 36, lamp.map(r => r.t), abPt(lamp)), k.mat({ color: '#eaff8a', emissive: '#c6ff2e', emissiveIntensity: 1.8, emissiveMap: glowMap, roughness: .35, clearcoat: .6 }));
    const lc = abC(.86);
    b.add(k.place(halo(k, 1.3, '#b4ff2a', .5), { p: lc }));
    b.add(k.place(halo(k, .66, '#f0ffb0', .8), { p: lc }));
    // underside and six thin legs
    k.add(b, k.sphere(1, { w: 32, h: 16 }), brown, { p: [0, yb - .02, .48], s: [.24, .12, .3] });
    const legs = [], LR = [.036, .031, .023, .016];
    for (const s of [-1, 1]) {
      legs.push(limbGeo(k, [[s * .12, yb - .03, .62], [s * .36, yb + .06, .8], [s * .48, .04, .94], [s * .54, .016, 1.04]], LR, { bulge: [1.25, 1.1, 1] }));
      legs.push(limbGeo(k, [[s * .14, yb - .04, .44], [s * .44, yb + .06, .46], [s * .6, .04, .42], [s * .7, .016, .38]], LR, { bulge: [1.25, 1.1, 1] }));
      legs.push(limbGeo(k, [[s * .12, yb - .04, .26], [s * .42, yb + .05, .08], [s * .54, .04, -.16], [s * .6, .016, -.3]], LR, { bulge: [1.25, 1.1, 1] }));
    }
    k.add(b, k.merge(legs), legM);
    g.userData.view = { az: 30, el: 26 };
    g.userData.fullView = { el: 20 };
    g.userData.noHero = true;
    return finish(k, g);
  },

  // A male stag beetle, glossy mahogany, rearing up with his great branched jaws.
  stagbeetle(k) {
    const T = k.THREE, g = k.group(), b = k.group([], { r: [0, -.25, 0] }); g.add(b);
    const mahog = k.gloss('#5e1f0e', { rough: .22 }), dark = k.gloss('#22100a', { rough: .26 }), legM = k.plastic('#1c0d07', { rough: .32, coat: .6, coatRough: .15 });
    const yb = .44, zc = -.6;
    // wing cases: long, glossy chestnut, split by the seam
    const E = [.6, .4, 1.0], cut = .85;
    const eF = (u, v) => { const t = u * 2 - 1; return [Math.sign(t) * Math.abs(t) ** 1.2 * 1.62, -Math.PI / 2 + v * Math.PI * cut]; };
    const ely = (u, v) => { const [f, l] = eF(u, v), gr = 1 - .02 * Math.exp(-((f / .045) ** 2)), p = superDome(E[0] * gr, E[1] * gr, E[2], f, l, 2.7, 3); return [p[0], yb + p[1], zc + p[2]]; };
    const elyMap = uvTex(k, 256, 512, (u, v) => {
      const af = Math.abs(eF(u, v)[0]);
      let c = mixC(rgb('#7a2e14'), rgb('#4d180a'), smooth(.3, 1.5, af));
      c = mixC(c, rgb('#2a0c05'), smooth(.03, .012, af) * .8);
      return mixC(c, rgb('#250a04'), smooth(1.4, 1.6, af) * .6);
    });
    k.add(b, surface(k, 80, 72, ely), k.gloss('#ffffff', { map: elyMap, rough: .2 }));
    // pronotum
    const P = [.6, .32, .32], pz = zc + 1.04, py = yb - .02;
    k.add(b, surface(k, 56, 36, (u, v) => { const f = (u * 2 - 1) * 1.62, l = -Math.PI / 2 + (.25 + .75 * v) * Math.PI, p = superDome(...P, f, l, 2.4, 3); return [p[0], py + p[1], pz + p[2]]; }), dark);
    // head: broad and flat, widest at the front where the jaws sit, with bulging eyes at the corners
    const hz = pz + P[2] + .1, hy = yb;
    const hg = k.group([], { p: [0, hy, hz], r: [-.1, 0, 0] }); b.add(hg);
    k.add(hg, warp(blobGeo(k, [.58, .16, .3], 3.2), (x, y, z) => [x * (1 + .12 * z / .3), y, z]), dark);
    for (const s of [-1, 1]) eye(k, hg, [s * .56, .03, -.1], .085, k.gloss('#0c0706', { rough: .1 }));
    // the antlers: long jaws raised high, curving in, each with a big tooth part way and a forked tip
    const up = [0, .8, -.6];
    for (const s of [-1, 1]) {
      const mc = curveOf(k, [[s * .3, 0, .16], [s * .56, .16, .5], [s * .72, .44, .86], [s * .7, .78, 1.18], [s * .52, 1.0, 1.38], [s * .36, 1.08, 1.44]]), ML = mc.getLength();
      k.add(hg, varTube(k, mc, capped(q => .014 + .13 * (1 - q / ML) ** .75, 0, .02), { seg: 80, rs: 18, flat: .55, up }), mahog);
      const fp = mc.getPointAt(.8), fork = curveOf(k, [fp.toArray(), [fp.x - s * .02, fp.y + .17, fp.z - .05], [fp.x - s * .07, fp.y + .31, fp.z - .08]]), FL = fork.getLength();
      k.add(hg, varTube(k, fork, capped(q => .01 + .05 * (1 - q / FL) ** .8, 0, .015), { seg: 24, rs: 12 }), mahog);
      const tp = mc.getPointAt(.42), tooth = curveOf(k, [tp.toArray(), [tp.x - s * .17, tp.y + .1, tp.z - .02], [tp.x - s * .3, tp.y + .19, tp.z - .03]]), TL = tooth.getLength();
      k.add(hg, varTube(k, tooth, capped(q => .01 + .065 * (1 - q / TL) ** .8, 0, .015), { seg: 24, rs: 12 }), mahog);
      for (const q of [.57, .67]) { const bp = mc.getPointAt(q), tn = mc.getTangentAt(q); const c = k.mesh(k.cone(.026, .09, 10), mahog, { p: [bp.x - s * .06, bp.y, bp.z] }); aim(k, c, new T.Vector3(-s, 0, 0).addScaledVector(tn, .3)); hg.add(c); }
    }
    // elbowed antennae with little combs at the ends
    const ants = [1, -1].map(s => limbGeo(k, [[s * .46, -.02, .18], [s * .7, .06, .48], [s * .74, .06, .57], [s * .74, .05, .65], [s * .72, .05, .72]], [.032, .027, .024, .024, .022], { bulge: 1.05, rs: 8 }));
    k.add(hg, k.merge(ants), legM);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) k.add(hg, k.sphere(1, { w: 12, h: 8 }), legM, { p: [s * (.69 - .02 * i), .05, .68 + i * .045], s: [.065, .02, .026], r: [0, s * .25, 0] });
    // belly and six strong legs with spines
    k.add(b, k.sphere(1, { w: 40, h: 20 }), dark, { p: [0, yb - .1, zc + .35], s: [.46, .16, 1.05] });
    const legs = [], spines = [], R4 = [.085, .07, .055, .038, .026];
    for (const s of [-1, 1]) {
      const set = [
        [[s * .28, yb - .12, pz + .05], [s * .66, yb + .1, pz + .22], [s * .86, .06, pz + .5], [s * .9, .02, pz + .66], [s * .92, .02, pz + .77]],
        [[s * .3, yb - .14, zc + .72], [s * .84, yb + .12, zc + .76], [s * 1.06, .06, zc + .66], [s * 1.14, .02, zc + .56], [s * 1.18, .02, zc + .48]],
        [[s * .28, yb - .14, zc + .45], [s * .78, yb + .1, zc + .24], [s * .98, .06, zc - .16], [s * 1.03, .02, zc - .34], [s * 1.05, .02, zc - .45]],
      ];
      for (const P5 of set) {
        legs.push(limbGeo(k, P5, R4, { bulge: [1.2, 1.08, 1, 1], joint: 1 }));
        const kn = new T.Vector3(...P5[1]), d = new T.Vector3(...P5[2]).sub(kn);
        for (const q of [.35, .6, .85]) { const p = kn.clone().addScaledVector(d, q); p.x += s * .05; spines.push({ p: p.toArray(), r: [0, 0, -s * 1.1] }); }
      }
    }
    k.add(b, k.merge(legs), legM);
    b.add(k.instances(k.cone(.02, .08, 6), legM, spines));
    g.userData.view = { az: 30, el: 24 };
    g.userData.fullView = { el: 18 };
    g.userData.noHero = true;
    return finish(k, g);
  },

  // The jackpot: a polished gold scarab with engraved wing cases and garnet eyes, on a little dark stone.
  scarab(k) {
    const T = k.THREE, g = k.group(), sg = k.group([], { r: [0, -.4, 0] }); g.add(sg);
    // the stone
    const SR = [1.3, .24, 1.08], ex = .5;
    const stoneMap = uvTex(k, 512, 256, (u, v) => {
      const m = vnoise(u * 24, v * 12) * .6 + vnoise(u * 70, v * 35) * .4, n = hash2(Math.floor(u * 420), Math.floor(v * 210));
      let c = mixC(rgb('#3d3937'), rgb('#262322'), m);
      if (n > .965) c = mixC(c, rgb('#8f8a83'), .45);
      return c;
    });
    k.add(sg, warp(k.sphere(1, { w: 64, h: 32 }), (x, y, z) => {
      const n = 1 + .05 * Math.sin(3.1 * x + 1.3) * Math.sin(2.3 * z + .4) + .035 * Math.sin(5.2 * z + 2.1 * x + 1) * (1 - Math.abs(y));
      return [x * SR[0] * n, SR[1] * (1 + Math.sign(y) * Math.abs(y) ** ex), z * SR[2] * n];
    }), k.mat({ map: stoneMap, roughness: .7, clearcoat: .25, clearcoatRoughness: .5 }));
    const top = SR[1] * 2;
    const stoneY = (x, z) => { const r2 = (x / SR[0]) ** 2 + (z / SR[2]) ** 2; return SR[1] * (1 + Math.max(0, 1 - r2) ** (ex / 2)) - top; };
    const b = k.group([], { p: [0, top - .01, .06] }); sg.add(b);
    const foot = (x, y, z) => [x, stoneY(x, z + .06) + y, z];
    // gold: wing cases, head shield, head
    const yb = .3, zc = -.26, E = [.66, .5, .68], P = [.6, .34, .36];
    const goldC = rgb('#ffd35e'), goldD = rgb('#d69a30'), lineC = rgb('#7a4c12');
    const goldM = (map, bump, rough = .14) => k.metal('#ffffff', rough, { map, bumpMap: bump, bumpScale: 2, envMapIntensity: 1.5 });
    const eF = (u, v) => { const t = u * 2 - 1; return [Math.sign(t) * Math.abs(t) ** 1.15 * 1.62, -Math.PI / 2 + v * Math.PI * .88]; };
    const eP = (u, v) => { const [f, l] = eF(u, v), gr = 1 - .014 * Math.exp(-((f / .035) ** 2)), p = superDome(E[0] * gr, E[1] * gr, E[2], f, l, 2.2, 2.3); return [p[0], yb + p[1], zc + p[2]]; };
    const eLines = (u, v) => {
      const [f, l] = eF(u, v), af = Math.abs(f);
      let ln = smooth(.022, .008, af);
      for (let i = 1; i <= 6; i++) ln = Math.max(ln, smooth(.011, .004, Math.abs(af - i * .2)) * smooth(-1.35, -1.1, l) * .75);
      return Math.max(ln, smooth(.016, .006, Math.abs(af - 1.42)));
    };
    const eMap = uvTex(k, 512, 512, (u, v) => mixC(mixC(goldC, goldD, smooth(.9, 1.6, Math.abs(eF(u, v)[0])) * .55), lineC, eLines(u, v) * .55));
    const eBump = uvTex(k, 512, 512, (u, v) => { const x = 1 - eLines(u, v); return [x, x, x]; }, { data: true });
    k.add(b, surface(k, 96, 72, eP), goldM(eMap, eBump));
    const pF = (u, v) => [(u * 2 - 1) * 1.62, -Math.PI / 2 + (.28 + .72 * v) * Math.PI];
    const pz = zc + E[2] * .9 + .1, py = yb - .01;
    const pP = (u, v) => { const [f, l] = pF(u, v), p = superDome(...P, f, l, 2.2, 2.4); return [p[0], py + p[1], pz + p[2]]; };
    const pLines = (u, v) => {
      const [f, l] = pF(u, v), af = Math.abs(f);
      let ln = smooth(.02, .008, Math.abs(af - 1.36));
      ln = Math.max(ln, smooth(.02, .008, Math.abs(l + .5)) * smooth(1.4, 1.2, af));
      const gx = f * 9, gy = l * 9, fx = gx - Math.round(gx), fy = gy - Math.round(gy);
      return Math.max(ln, smooth(.13, .07, Math.hypot(fx, fy)) * .4 * smooth(.6, .85, af) * smooth(1.3, 1.1, af) * (Math.round(gx) + Math.round(gy) & 1));
    };
    const pMap = uvTex(k, 256, 256, (u, v) => mixC(mixC(goldC, goldD, smooth(.8, 1.6, Math.abs(pF(u, v)[0])) * .5), lineC, pLines(u, v) * .75));
    const pBump = uvTex(k, 256, 256, (u, v) => { const x = 1 - pLines(u, v); return [x, x, x]; }, { data: true });
    k.add(b, surface(k, 64, 40, pP), goldM(pMap, pBump));
    // the head: a flat shovel with six teeth, like a little crown
    const hOut = [];
    for (let i = 0; i <= 64; i++) {
      const a = -1.75 + i / 64 * 3.5;
      let r = .34;
      for (let j = 0; j < 6; j++) r += .075 * Math.max(0, 1 - Math.abs(a - (-62.5 + 25 * j) * Math.PI / 180) / .16);
      hOut.push([Math.sin(a) * r * 1.15, Math.cos(a) * r]);
    }
    const hGeo = k.extrude(k.shape(hOut), .05, { bevel: .025, bevelSeg: 3, curve: 12 });
    hGeo.rotateX(Math.PI / 2);
    warp(hGeo, (x, y, z) => [x, y - .35 * (x * x + z * z), z]);
    const plainGold = k.metal('#ffd35e', .16, { envMapIntensity: 1.5 }), legGold = k.metal('#f7c451', .2, { envMapIntensity: 1.4 });
    k.add(b, hGeo, plainGold, { p: [0, yb - .02, pz + P[2] - .1], r: [.15, 0, 0] });
    for (const s of [-1, 1]) k.add(b, k.sphere(1, { w: 16, h: 10 }), plainGold, { p: [s * .1, yb + .01, pz + P[2] + .02], s: [.045, .035, .045] });
    // garnet eyes
    const gem = k.mat({ color: '#3a0b1c', roughness: .04, metalness: .1, clearcoat: 1, clearcoatRoughness: 0, flatShading: true, envMapIntensity: 2.2 });
    for (const s of [-1, 1]) { const e = k.add(b, new T.IcosahedronGeometry(1, 1), gem, { p: [s * .4, yb, pz + P[2] - .06], s: .065 }); e.userData.eye = { hr: .25 }; }
    // short antennae with fanned clubs
    for (const s of [-1, 1]) {
      const a0 = [s * .3, yb - .08, pz + P[2] - .02], a1 = [s * .48, yb - .02, pz + P[2] + .12];
      k.add(b, limbGeo(k, [a0, a1], [.022, .02]), legGold);
      for (let i = 0; i < 3; i++) k.add(b, k.sphere(1, { w: 16, h: 10 }), legGold, { p: [a1[0] + s * .05, a1[1] + .01, a1[2] + .02], s: [.075, .02, .045], r: [(i - 1) * .35, s * .5, 0] });
    }
    // gold legs: toothed digging legs in front, long spurred legs behind
    k.add(b, k.sphere(1, { w: 40, h: 20 }), k.metal('#c58f2c', .3), { p: [0, yb - .12, zc + .3], s: [.5, .14, .85] });
    const legs = [], teeth = [];
    for (const s of [-1, 1]) {
      const fk = [s * .6, yb - .02, pz + .08], fa = foot(s * .8, .04, pz + .46);
      legs.push(limbGeo(k, [[s * .3, yb - .16, pz - .05], fk], [.065, .055], { bulge: 1.3 }));
      const tc = curveOf(k, [fk, [(fk[0] + fa[0]) / 2 + s * .02, (fk[1] + fa[1]) / 2, (fk[2] + fa[2]) / 2], fa]), TL = tc.getLength();
      k.add(b, varTube(k, tc, capped(q => .055 + .035 * q / TL, .02, .045), { seg: 24, rs: 12, flat: .45 }), legGold);
      for (let i = 0; i < 4; i++) { const p = tc.getPointAt(.4 + i * .19); teeth.push({ p: [p.x + s * .07, p.y, p.z], r: [0, 0, -s * 1.3] }); }
      legs.push(limbGeo(k, [[s * .34, yb - .18, zc + .62], [s * .8, yb + .08, zc + .6], foot(s * .94, .05, zc + .4), foot(s * 1.0, .02, zc + .24), foot(s * 1.03, .02, zc + .12)], [.06, .052, .04, .027, .02], { bulge: [1.3, 1.1, 1, 1] }));
      legs.push(limbGeo(k, [[s * .3, yb - .18, zc + .36], [s * .74, yb + .06, zc + .08], foot(s * .88, .05, zc - .32), foot(s * .92, .02, zc - .5), foot(s * .93, .02, zc - .62)], [.06, .052, .04, .027, .02], { bulge: [1.3, 1.1, 1, 1] }));
    }
    k.add(b, k.merge(legs), legGold);
    b.add(k.instances(k.cone(.03, .1, 8), legGold, teeth));
    // a glint or two
    g.updateMatrixWorld(true);
    for (const [p, s, rot] of [[eP(.64, .5), .55, 0], [pP(.36, .72), .3, .5], [eP(.3, .28), .22, .3]]) g.add(k.place(sparkle(k, s, rot), { p: b.localToWorld(new T.Vector3(...p)).toArray() }));
    g.userData.view = { az: 30, el: 30 };
    g.userData.fullView = { el: 24 };
    g.userData.noHero = true;
    return finish(k, g);
  },
};
