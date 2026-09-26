// Models for the Backyard set's little creatures: a garden snail, a monarch caterpillar, a dragonfly, a monarch butterfly
// and a luna moth. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// A small seeded random source for painting textures. Painted canvases are cached between renders, so painting mustn't
// use up the model's own k.rand() (the geometry would come out different the second time).
const rng = seed => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// Round off the ends of a body: 1 along the middle, closing like a ball over the first c0 and the last c1 of t.
const ends = (t, c0, c1 = c0) => {
  let f = 1;
  if (c0 > 0 && t < c0) { const q = t / c0; f *= Math.sqrt(Math.max(0, q * (2 - q))); }
  if (c1 > 0 && 1 - t < c1) { const q = (1 - t) / c1; f *= Math.sqrt(Math.max(0, q * (2 - q))); }
  return f;
};

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
const V = (k, a) => new k.THREE.Vector3(...a);

// The frame of a curve at t: point P, tangent D, side S (to the right of travel) and up U, with `up` as the hint for up.
function frameAt(k, curve, t, up = [0, 1, 0]) {
  const T = k.THREE, P = curve.getPointAt(t), D = curve.getTangentAt(t);
  const S = new T.Vector3().crossVectors(D, V(k, up)).normalize(), U = new T.Vector3().crossVectors(S, D).normalize();
  return { P, D, S, U };
}
// A soft body along a curve (bodies, abdomens, stalks, tentacles). prof(t, P) is the radius at t ∈ [0, 1], or { w, h, b }:
// the half-width, and the height above and depth below the curve (P is the curve point). o.up: which way is up
// (default +y). o.a0: where the texture's seam falls round the body (0 on top, π underneath). u runs along the body.
function softBody(k, curve, prof, o = {}) {
  const T = k.THREE, seg = o.seg ?? 96, rs = o.rs ?? 28, up = V(k, o.up ?? [0, 1, 0]).normalize(), a0 = o.a0 ?? 0;
  const pos = [], uv = [], idx = [], P = new T.Vector3(), D = new T.Vector3(), S = new T.Vector3(), U = new T.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    curve.getPointAt(t, P); curve.getTangentAt(t, D);
    S.crossVectors(D, up); if (S.lengthSq() < 1e-10) S.set(0, 0, 1); S.normalize(); U.crossVectors(S, D).normalize();
    let p = prof(t, P); if (typeof p === 'number') p = { w: p, h: p, b: p };
    for (let j = 0; j <= rs; j++) {
      const a = a0 + j / rs * TAU, ca = Math.cos(a), sa = Math.sin(a), r = ca >= 0 ? p.h : p.b;
      pos.push(P.x + U.x * ca * r + S.x * sa * p.w, P.y + U.y * ca * r + S.y * sa * p.w, P.z + U.z * ca * r + S.z * sa * p.w);
      uv.push(t, j / rs);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rs; j++) { const a = i * (rs + 1) + j, b = a + 1, c = a + rs + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return weld(geo);
}
// Point obj's local x along xDir and its local y along yDir (squared up to x); local z follows.
function orient(k, obj, xDir, yDir) {
  const T = k.THREE, X = V(k, xDir).normalize(), Z = new T.Vector3().crossVectors(X, V(k, yDir)).normalize(), Y = new T.Vector3().crossVectors(Z, X);
  obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z));
  return obj;
}
// Euler angles (XYZ) that turn +y to point along n: for k.instances.
const eulerTo = (k, n) => { const e = new k.THREE.Euler().setFromQuaternion(new k.THREE.Quaternion().setFromUnitVectors(V(k, [0, 1, 0]), n.clone().normalize())); return [e.x, e.y, e.z]; };
// A rod from a to b (a thin cylinder).
const rod = (k, a, b, r, mat, seg = 10) => {
  const A = V(k, a), B = V(k, b), d = B.clone().sub(A), m = k.mesh(k.cyl(r, r, d.length(), { seg }), mat);
  m.position.copy(A).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(V(k, [0, 1, 0]), d.normalize());
  return m;
};
// Tiny bright glints on glossy eyes, set towards the camera and the key light (upper left of the view) so they read.
function glints(k, g, eyes, view = {}) {
  const T = k.THREE, az = k.deg(view.az ?? 30), el = k.deg(view.el ?? 16);
  const cam = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const key = new T.Vector3(Math.sin(az - 1) * Math.cos(.87), Math.sin(.87), Math.cos(az - 1) * Math.cos(.87));
  const dir = cam.multiplyScalar(1.3).add(key).normalize();
  g.updateMatrixWorld(true);
  const mat = k.glow('#ffffff', 1.3), geo = k.sphere(1, { w: 12, h: 8 });
  for (const [mesh, r, s = .24] of eyes) {
    const p = mesh.getWorldPosition(new T.Vector3());
    k.add(g, geo, mat, { p: p.addScaledVector(dir, r * .9).toArray(), s: r * s, shadow: false });
  }
}

/* ---------- painting in wing units ---------- */
// A smooth curve through points on a 2D canvas (Catmull-Rom: the same curve as THREE.SplineCurve).
function spline(c, pts, closed = false, move = true) {
  const n = pts.length, P = i => closed ? pts[(i % n + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  if (move) c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) c.closePath();
}
const blob = (c, x, y, rx, ry = rx, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); };
// Points along an open curve by arc length, each with the normal pointing towards `inside`.
function along(k, pts, inside) {
  const T = k.THREE, cv = new T.SplineCurve(pts.map(([x, y]) => new T.Vector2(x, y)));
  return u => { const p = cv.getPointAt(u), t = cv.getTangentAt(u); let nx = -t.y, ny = t.x; if (nx * (inside[0] - p.x) + ny * (inside[1] - p.y) < 0) { nx = -nx; ny = -ny; } return { x: p.x, y: p.y, nx, ny }; };
}
// A vein: a line along a smooth curve, w0 wide at its root and w1 at its end.
function vein(k, c, pts, w0, w1 = w0) {
  const T = k.THREE, P = new T.SplineCurve(pts.map(([x, y]) => new T.Vector2(x, y))).getSpacedPoints(20);
  c.lineCap = 'round';
  for (let i = 1; i < P.length; i++) { c.lineWidth = lerp(w0, w1, i / (P.length - 1)); c.beginPath(); c.moveTo(P[i - 1].x, P[i - 1].y); c.lineTo(P[i].x, P[i].y); c.stroke(); }
}
// Scattered specks, for the dusty look of scales.
function specks(c, R, box, n, col, size) {
  const [x0, y0, x1, y1] = box;
  for (let i = 0; i < n; i++) { c.fillStyle = col(R()); blob(c, lerp(x0, x1, R()), lerp(y0, y1, R()), size * (.5 + R())); }
}
// A thin sheet cut out of a painted picture: wings, petals, leaves. box: [x0, y0, x1, y1] in sheet units (for a wing,
// x runs out from the body and y towards the head); paint(c) draws in those units with y up. o.bend(x, y) → z curves the
// sheet; o.clear makes it see-through (veined dragonfly wings), otherwise it's an opaque cut-out.
function sheet(k, box, paint, o = {}) {
  const T = k.THREE, [x0, y0, x1, y1] = box, W = x1 - x0, H = y1 - y0;
  const px = o.px ?? 1024, ph = Math.round(px * H / W);
  const map = k.tex(px, ph, (c, w, h) => { c.save(); c.scale(w / W, -h / H); c.translate(-x0, -y1); paint(c); c.restore(); }, { cache: o.cache });
  const geo = new T.PlaneGeometry(W, H, o.sx ?? 24, o.sy ?? 24); geo.translate(x0 + W / 2, y0 + H / 2, 0);
  if (o.bend) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, o.bend(p.getX(i), p.getY(i))); geo.computeVertexNormals(); }
  const mat = new T.MeshPhysicalMaterial({ map, side: T.DoubleSide, roughness: .6, ...o.mat });
  if (o.clear) Object.assign(mat, { transparent: true, alphaTest: .01, depthWrite: false });
  else Object.assign(mat, { alphaTest: .5, alphaToCoverage: true });
  return k.mesh(geo, mat, { shadow: !o.clear });
}

/* ---------- the monarch's wings ---------- */
// Right wings, in wing units: x out from the body, y towards the head; the forewing is about 1 long.
const MF = {
  costa: [[0, .03], [.2, .12], [.45, .25], [.7, .38], [.88, .465]],
  outer: [[.88, .465], [.94, .477], [.98, .44], [.965, .33], [.91, .2], [.83, .07], [.745, -.05]],
  inner: [[.745, -.05], [.52, -.095], [.28, -.105], [.08, -.08], [0, -.03]],
};
const MH = {
  front: [[0, -.02], [.2, 0], [.42, -.02], [.58, -.08]],
  outer: [[.58, -.08], [.66, -.17], [.69, -.29], [.66, -.42], [.58, -.53], [.46, -.61], [.32, -.65], [.2, -.63]],
  inner: [[.2, -.63], [.1, -.56], [.05, -.42], [.02, -.26], [0, -.1]],
};
const INK = '#17110e';
function paintMonarchFore(k) {
  const outline = [...MF.costa, ...MF.outer.slice(1), ...MF.inner.slice(1, -1)];
  return c => {
    const R = rng(21);
    c.save(); c.beginPath(); spline(c, outline, true); c.clip();
    const gr = c.createRadialGradient(.42, .1, .02, .42, .1, .7);
    gr.addColorStop(0, '#fd9a1e'); gr.addColorStop(.5, '#f37506'); gr.addColorStop(1, '#d95402');
    c.fillStyle = gr; c.fillRect(-.1, -.3, 1.3, 1);
    // the black apex: everything beyond the end of the cell towards the tip
    c.fillStyle = INK; c.beginPath(); spline(c, [[.44, .3], [.52, .27], [.62, .265], [.72, .255], [.82, .235], [.92, .235], [1.05, .25]]); c.lineTo(1.1, .7); c.lineTo(.4, .7); c.closePath(); c.fill();
    // veins, thickening towards the margin
    c.strokeStyle = INK;
    const veins = [
      [[.02, 0], [.2, .08], [.36, .15], [.5, .21]], [[.03, -.04], [.2, -.02], [.34, .02], [.46, .07]], [[.5, .21], [.48, .14], [.46, .07]],
      [[.26, .105], [.4, .2], [.52, .3]], [[.4, .17], [.55, .27], [.68, .37]], [[.5, .21], [.65, .31], [.8, .43], [.86, .5]],
      [[.5, .21], [.7, .32], [.82, .38], [.92, .45], [.98, .5]], [[.82, .38], [.92, .4], [1.02, .41]],
      [[.5, .2], [.7, .27], [.85, .3], [1.02, .33]], [[.48, .14], [.66, .17], [.82, .2], [.99, .22]],
      [[.46, .08], [.62, .08], [.78, .09], [.94, .1]], [[.36, .025], [.55, 0], [.7, -.01], [.88, -.01]],
      [[.22, -.015], [.45, -.05], [.62, -.06], [.82, -.06]], [[.03, -.07], [.3, -.09], [.55, -.085], [.8, -.07]],
    ];
    for (const v of veins) vein(k, c, v, .014, .026);
    // costa, inner margin and the wide black border
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.lineWidth = .075; c.beginPath(); spline(c, MF.costa); c.stroke();
    c.lineWidth = .035; c.beginPath(); spline(c, MF.inner); c.stroke();
    c.lineWidth = .13; c.beginPath(); spline(c, MF.outer); c.stroke();
    const root = c.createRadialGradient(0, -.02, 0, 0, -.02, .2);
    root.addColorStop(0, 'rgba(23,17,14,1)'); root.addColorStop(1, 'rgba(23,17,14,0)');
    c.fillStyle = root; c.fillRect(-.1, -.3, .4, .5);
    // the pale orange band across the black tip, and white spots beyond it and along the costa
    c.fillStyle = '#f7b04a';
    for (const [x, y, a] of [[.655, .335, .55], [.715, .33, .5], [.775, .315, .45], [.835, .29, .4]]) blob(c, x, y, .032, .019, a);
    c.fillStyle = '#fbeede';
    for (const [x, y, r] of [[.535, .3, .014], [.59, .325, .013], [.79, .405, .012], [.845, .4, .012], [.895, .37, .011], [.925, .32, .01]]) blob(c, x, y, r);
    // two rows of white dots in the border
    const m = along(k, MF.outer, [.5, .15]);
    for (let i = 0; i < 17; i++) { const p = m(.03 + i / 16 * .94); blob(c, p.x + p.nx * .021, p.y + p.ny * .021, .0105); }
    for (let i = 0; i < 12; i++) { const p = m(.05 + i / 11 * .88); blob(c, p.x + p.nx * .048, p.y + p.ny * .048, .013); }
    specks(c, R, [-.05, -.2, 1.05, .55], 2600, r => r < .5 ? 'rgba(255,230,180,.08)' : 'rgba(80,30,0,.08)', .006);
    c.restore();
  };
}
function paintMonarchHind(k) {
  const outline = [...MH.front, ...MH.outer.slice(1), ...MH.inner.slice(1, -1)];
  return c => {
    const R = rng(22);
    c.save(); c.beginPath(); spline(c, outline, true); c.clip();
    const gr = c.createRadialGradient(.26, -.26, .02, .26, -.26, .55);
    gr.addColorStop(0, '#fd9a1e'); gr.addColorStop(.55, '#f37506'); gr.addColorStop(1, '#d95402');
    c.fillStyle = gr; c.fillRect(-.1, -.8, 1, 1);
    c.strokeStyle = INK;
    const veins = [
      [[.02, -.04], [.18, -.05], [.34, -.08]], [[.03, -.08], [.16, -.14], [.29, -.2]], [[.34, -.08], [.32, -.14], [.29, -.2]],
      [[.02, -.03], [.3, -.03], [.62, -.09]], [[.34, -.08], [.52, -.13], [.74, -.2]], [[.34, -.1], [.52, -.2], [.75, -.32]],
      [[.33, -.14], [.5, -.28], [.72, -.47]], [[.3, -.19], [.44, -.36], [.62, -.6]], [[.25, -.19], [.35, -.38], [.48, -.68]],
      [[.15, -.155], [.24, -.38], [.32, -.72]], [[.05, -.1], [.12, -.35], [.18, -.7]], [[.02, -.12], [.05, -.35], [.08, -.62]],
    ];
    for (const v of veins) vein(k, c, v, .014, .024);
    c.fillStyle = INK; blob(c, .238, -.375, .03, .016, -1.2);              // the male's scent patch on vein Cu2
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.lineWidth = .15; c.beginPath(); spline(c, MH.outer); c.stroke();
    c.lineWidth = .05; c.beginPath(); spline(c, MH.inner); c.stroke();
    c.lineWidth = .03; c.beginPath(); spline(c, MH.front); c.stroke();
    const root = c.createRadialGradient(0, -.06, 0, 0, -.06, .2);
    root.addColorStop(0, 'rgba(23,17,14,1)'); root.addColorStop(1, 'rgba(23,17,14,0)');
    c.fillStyle = root; c.fillRect(-.1, -.4, .4, .5);
    c.fillStyle = '#fbeede';
    const m = along(k, MH.outer, [.3, -.3]);
    for (let i = 0; i < 18; i++) { const p = m(.03 + i / 17 * .94); blob(c, p.x + p.nx * .024, p.y + p.ny * .024, .011); }
    for (let i = 0; i < 13; i++) { const p = m(.05 + i / 12 * .9); blob(c, p.x + p.nx * .055, p.y + p.ny * .055, .016); }
    specks(c, R, [-.05, -.7, .75, .05], 2200, r => r < .5 ? 'rgba(255,230,180,.08)' : 'rgba(80,30,0,.08)', .006);
    c.restore();
  };
}

/* ---------- the luna moth's wings ---------- */
const LF = {
  costa: [[0, .04], [.25, .135], [.55, .245], [.8, .33], [.95, .385]],
  outer: [[.95, .385], [.99, .39], [1.0, .35], [.965, .25], [.915, .13], [.845, .01], [.76, -.1]],
  inner: [[.76, -.1], [.5, -.13], [.26, -.115], [.08, -.07], [0, -.02]],
};
const LH = {
  front: [[0, -.02], [.2, 0], [.42, -.03], [.57, -.1]],
  outer: [[.57, -.1], [.64, -.2], [.65, -.33], [.6, -.45], [.51, -.54], [.43, -.62], [.385, -.75], [.35, -.9], [.33, -1.04], [.335, -1.16], [.355, -1.26], [.375, -1.33], [.355, -1.385], [.315, -1.375], [.288, -1.31], [.266, -1.2], [.252, -1.07], [.246, -.93], [.236, -.79], [.19, -.64]],
  inner: [[.19, -.63], [.1, -.56], [.045, -.42], [.015, -.24], [0, -.08]],
};
const LUNA = { green: '#aee476', pale: '#e8f9cf', edge: '#e2e77a', costa: '#6a3346', rose: '#c46e96' };
// White fur at a wing's root: a soft patch and short hairs raying out from it.
function rootFur(c, R, x, y, r) {
  const fur = c.createRadialGradient(x, y, 0, x, y, r);
  fur.addColorStop(0, 'rgba(250,252,242,.95)'); fur.addColorStop(.6, 'rgba(250,252,242,.5)'); fur.addColorStop(1, 'rgba(250,252,242,0)');
  c.fillStyle = fur; c.fillRect(x - r, y - r, r * 2, r * 2);
  c.strokeStyle = 'rgba(252,253,246,.5)'; c.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const a = (R() - .5) * 2.6, l = r * (.6 + R() * .9), x0 = x + Math.cos(a) * r * .3 * R(), y0 = y + Math.sin(a) * r * .3 * R();
    c.lineWidth = .003 + R() * .003; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); c.stroke();
  }
}
// A luna eyespot: a clear little window ringed in yellow, with a maroon rim and a rusty crescent on its outer side.
function lunaEye(c, x, y, rx, ry, rot) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = '#5a2a36'; blob(c, 0, 0, rx, ry);
  c.fillStyle = '#c8683c'; blob(c, rx * .1, ry * .08, rx * .86, ry * .84);
  c.fillStyle = '#ecd060'; blob(c, 0, 0, rx * .74, ry * .76);
  c.fillStyle = '#e4f3d2'; blob(c, 0, 0, rx * .56, ry * .6);
  c.fillStyle = 'rgba(150,176,214,.8)'; blob(c, -rx * .05, -ry * .12, rx * .4, ry * .09, .2);
  c.restore();
}
function paintLunaFore(k) {
  const outline = [...LF.costa, ...LF.outer.slice(1), ...LF.inner.slice(1, -1)];
  return c => {
    const R = rng(31);
    c.save(); c.beginPath(); spline(c, outline, true); c.clip();
    const gr = c.createRadialGradient(.05, 0, .02, .1, .05, 1.0);
    gr.addColorStop(0, LUNA.pale); gr.addColorStop(.3, '#c4ec98'); gr.addColorStop(.75, LUNA.green); gr.addColorStop(1, '#c6e67a');
    c.fillStyle = gr; c.fillRect(-.1, -.2, 1.3, .9);
    c.strokeStyle = 'rgba(146,196,98,.6)';
    for (const v of [[[.05, .0], [.4, .1], [.78, .26], [.98, .36]], [[.42, .1], [.7, .16], [.94, .22]], [[.42, .06], [.65, .05], [.88, .06]], [[.3, -.01], [.55, -.05], [.8, -.05]], [[.05, -.05], [.4, -.09], [.74, -.09]]]) vein(k, c, v, .006, .004);
    // eyespot at the end of the cell, tied to the costa by a dark vein
    c.strokeStyle = LUNA.costa; vein(k, c, [[.4, .2], [.415, .15], [.43, .12]], .012, .008);
    lunaEye(c, .44, .07, .04, .054, -.25);
    // purple-brown leading edge
    c.strokeStyle = LUNA.costa; c.lineCap = 'round'; c.lineJoin = 'round';
    c.lineWidth = .15; c.beginPath(); spline(c, LF.costa.slice(0, 4)); c.stroke();
    c.lineWidth = .09; c.beginPath(); spline(c, LF.costa.slice(2)); c.stroke();
    // margin: a yellow line inside a rosy edge
    c.strokeStyle = LUNA.edge; c.lineWidth = .04; c.beginPath(); spline(c, LF.outer); c.stroke();
    c.strokeStyle = LUNA.rose; c.lineWidth = .016; c.beginPath(); spline(c, LF.outer); c.stroke();
    rootFur(c, R, 0, 0, .11);
    specks(c, R, [-.05, -.1, 1.05, .55], 1800, r => r < .5 ? 'rgba(255,255,230,.07)' : 'rgba(70,120,40,.05)', .006);
    c.restore();
  };
}
function paintLunaHind(k) {
  const outline = [...LH.front, ...LH.outer.slice(1), ...LH.inner.slice(1, -1)];
  return c => {
    const R = rng(32);
    c.save(); c.beginPath(); spline(c, outline, true); c.clip();
    const gr = c.createRadialGradient(.05, -.05, .02, .1, -.1, 1.1);
    gr.addColorStop(0, LUNA.pale); gr.addColorStop(.25, '#c4ec98'); gr.addColorStop(.6, LUNA.green); gr.addColorStop(1, '#cbe67c');
    c.fillStyle = gr; c.fillRect(-.1, -1.5, 1, 1.6);
    c.strokeStyle = 'rgba(146,196,98,.6)';
    for (const v of [[[.05, -.05], [.35, -.12], [.62, -.25]], [[.1, -.1], [.35, -.3], [.55, -.48]], [[.08, -.12], [.3, -.45], [.4, -.62], [.3, -1.2]], [[.05, -.15], [.15, -.45], [.2, -.62]]]) vein(k, c, v, .006, .004);
    lunaEye(c, .335, -.28, .043, .05, -.2);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = LUNA.edge; c.lineWidth = .04; c.beginPath(); spline(c, LH.outer); c.stroke();
    // the tails blush rosy towards their tips
    const tail = c.createLinearGradient(0, -.9, 0, -1.39);
    tail.addColorStop(0, 'rgba(206,140,168,0)'); tail.addColorStop(.65, 'rgba(206,140,168,.3)'); tail.addColorStop(1, 'rgba(232,200,120,.65)');
    c.fillStyle = tail; c.fillRect(-.1, -1.5, 1, .8);
    c.strokeStyle = LUNA.rose; c.lineWidth = .016; c.beginPath(); spline(c, LH.outer); c.stroke();
    c.strokeStyle = LUNA.costa; c.lineWidth = .03; c.beginPath(); spline(c, LH.front); c.stroke();
    rootFur(c, R, 0, -.06, .13);
    specks(c, R, [-.05, -1.4, .75, .05], 1800, r => r < .5 ? 'rgba(255,255,230,.07)' : 'rgba(70,120,40,.05)', .006);
    c.restore();
  };
}

/* ---------- a dragonfly's clear wing ---------- */
function paintDragonWing(k, hind) {
  const le = x => .012 * Math.sin(Math.PI * clamp(x));
  const tipR = x => x > .74 ? Math.sqrt(Math.max(0, 1 - ((x - .74) / .26) ** 2)) : 1;
  const chord = hind
    ? x => (lerp(.1, .25, smooth(0, .13, x)) + .1 * Math.exp(-(((x - .13) / .09) ** 2))) * (1 - .14 * smooth(.3, .74, x)) * tipR(x)
    : x => lerp(.07, .19, smooth(0, .32, x)) * (1 - .1 * smooth(.4, .74, x)) * tipR(x);
  const Y = (f, x) => le(x) - f * chord(x) * (1 + (f > 0 && f < 1 ? .05 * Math.sin(x * 13 + f * 31) : 0));
  const fr = hind ? [0, .06, .13, .27, .4, .55, .7, .85] : [0, .07, .14, .3, .45, .62, .8];
  return c => {
    const R = rng(hind ? 42 : 41), N = 160;
    c.beginPath(); c.moveTo(0, le(0));
    for (let i = 1; i <= N; i++) c.lineTo(i / N, le(i / N));
    for (let i = N; i >= 0; i--) c.lineTo(i / N, Y(1, i / N));
    c.closePath();
    c.save(); c.clip();
    c.fillStyle = 'rgba(228,240,252,.22)'; c.fillRect(-.1, -.6, 1.3, 1);
    const amber = c.createLinearGradient(0, 0, .18, 0);
    amber.addColorStop(0, 'rgba(214,160,72,.55)'); amber.addColorStop(1, 'rgba(214,160,72,0)');
    c.fillStyle = amber; c.fillRect(-.1, -.6, .3, 1);
    c.strokeStyle = 'rgba(26,30,36,.85)'; c.lineCap = 'round';
    // cross-veins between the long veins, and a finer mesh towards the trailing edge
    c.lineWidth = .0022;
    for (let i = 0; i < fr.length; i++) {
      const f0 = fr[i], f1 = i + 1 < fr.length ? fr[i + 1] : 1, back = f0 > .5, step = back ? .022 : .017;
      for (let x = .015 + R() * .015; x < .985; x += step * (.75 + R() * .6)) {
        const x2 = x + (R() - .5) * .012, fm = (f0 + f1) / 2 + (R() - .5) * .05;
        if (back) {
          const xm = x + step * (.3 + R() * .4);
          c.beginPath(); c.moveTo(x, Y(f0, x)); c.lineTo(xm, Y(fm, xm)); c.lineTo(x2, Y(f1, x2)); c.stroke();
          const xn = xm + step * (.7 + R() * .5);
          c.beginPath(); c.moveTo(xm, Y(fm, xm)); c.lineTo(xn, Y(fm + (R() - .5) * .05, xn)); c.stroke();
        } else {
          const xm = (x + x2) / 2 + (R() - .5) * .008;
          c.beginPath(); c.moveTo(x, Y(f0, x)); c.quadraticCurveTo(xm, Y(fm, xm), x2, Y(f1, x2)); c.stroke();
        }
      }
    }
    // the long veins; the subcosta stops at the nodus
    fr.forEach((f, i) => {
      c.lineWidth = i === 0 ? .009 : i < 3 ? .0042 : .0034;
      const x1 = i === 1 ? .47 : .995;
      c.beginPath(); for (let j = 0; j <= 120; j++) { const x = j / 120 * x1; j ? c.lineTo(x, Y(f, x)) : c.moveTo(x, Y(f, x)); } c.stroke();
    });
    c.lineWidth = .006; c.beginPath(); for (let i = 0; i <= N; i++) { const x = i / N; i ? c.lineTo(x, Y(1, x)) : c.moveTo(x, Y(1, x)); } c.stroke();
    c.lineWidth = .008; c.beginPath(); c.moveTo(.47, Y(0, .47)); c.lineTo(.47, Y(.14, .47)); c.stroke();          // nodus
    // pterostigma: a small dark cell on the leading edge near the tip
    c.fillStyle = 'rgba(44,26,14,.95)'; c.beginPath(); c.moveTo(.83, Y(0, .83)); c.lineTo(.905, Y(0, .905)); c.lineTo(.9, Y(.13, .9)); c.lineTo(.825, Y(.13, .825)); c.closePath(); c.fill();
    c.restore();
  };
}

/* ---------- a snail's coiled shell ---------- */
// Raup's coiling: a tube whose radius grows `grow` times each turn, `turns` turns from the apex (near the origin, on the +y
// axis) down to the aperture, which ends at angle 0 (on +x, opening towards +z). D: the tube's distance from the axis and
// tau: how far each whorl drops, both in tube radii. u runs along the coil (0 at the apex), v round the tube (0 outermost).
function shellGeo(k, o) {
  const T = k.THREE, n = o.seg ?? 360, rs = o.rs ?? 36, th1 = o.turns * TAU, b = Math.log(o.grow) / TAU, pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const th = i / n * th1, R = o.R * Math.exp(b * (th - th1)), D = R * o.D, Yc = -R * o.tau, c = Math.cos(th), s = Math.sin(th);
    for (let j = 0; j <= rs; j++) {
      const ph = j / rs * TAU, rr = D + R * Math.cos(ph);
      pos.push(rr * c, Yc + R * Math.sin(ph), rr * s); uv.push(i / n, j / rs);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < rs; j++) { const a = i * (rs + 1) + j, b2 = a + 1, c2 = a + rs + 1, d = c2 + 1; idx.push(a, b2, c2, b2, d, c2); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return weld(geo);
}

export default {
  // A garden snail gliding along on its foot, eye stalks up, its brown-banded shell coiled on its back.
  snail(k) {
    const T = k.THREE, g = k.group(), s = k.group([], { r: [0, k.deg(-128), 0] }); g.add(s);
    // skin: a cobbled net of soft, elongated tubercles slanting back down the sides; darker along the back, pale at the foot
    const R = rng(11), cells = [];
    for (let i = 0; i < 1900; i++) { const v = R(); cells.push([R(), v, 9 + R() * 9, 4.5 + R() * 3.5, (v > .5 ? -.38 : .38) + (R() - .5) * .4, R()]); }
    const dark = new T.Color('#a07c57'), mid = new T.Color('#c7a379'), pale = new T.Color('#dfc59f');
    const skinPaint = bump => (c, w, h) => {
      c.fillStyle = bump ? '#303030' : '#b8946b'; c.fillRect(0, 0, w, h);
      c.lineWidth = bump ? 2.4 : 1.3; c.strokeStyle = bump ? '#000' : 'rgba(92,64,38,.42)';
      for (const [u, v, rx, ry, rot, tone] of cells) {
        const top = 1 - Math.abs(v - .5) * 2, col = pale.clone().lerp(mid, smooth(.12, .42, top)).lerp(dark, smooth(.62, .95, top));
        col.offsetHSL(0, 0, (tone - .5) * .035);
        c.fillStyle = bump ? `rgb(${200 + tone * 55 | 0},${200 + tone * 55 | 0},${200 + tone * 55 | 0})` : col.getStyle();
        c.beginPath(); c.ellipse(u * w, v * h, rx, ry, rot, 0, TAU); c.fill(); c.stroke();
      }
    };
    const skin = k.mat({ map: k.tex(1024, 384, skinPaint(false), { cache: 'bp-wings:snail-skin' }), bumpMap: k.tex(1024, 384, skinPaint(true), { cache: 'bp-wings:snail-bump', data: true }),
      bumpScale: 1.1, roughness: .34, clearcoat: 1, clearcoatRoughness: .08, sheen: .6, sheenColor: new T.Color('#fff1dc'), sheenRoughness: .35 });
    // the body: a long foot, pointed behind, rising to the head in front (it heads along +x)
    const body = curveOf(k, [[-1.04, .05, 0], [-.7, .1, 0], [-.2, .14, 0], [.3, .16, 0], [.6, .22, 0], [.8, .34, 0], [.88, .47, 0], [.9, .55, 0]]);
    k.add(s, softBody(k, body, (t, P) => {
      const e = ends(t, .16, .08);
      const w = (.11 + .12 * smooth(0, .4, t) - .04 * smooth(.6, 1, t)) * e;
      const h = (.12 + .07 * smooth(.08, .45, t) - .05 * smooth(.6, 1, t)) * e;
      return { w, h, b: Math.min(P.y, .12) * Math.pow(e, .3) };
    }, { seg: 140, rs: 32, a0: Math.PI }), skin);
    // tentacles: two tall eye stalks, two short feelers
    const stalk = k.mat({ color: '#8c7560', roughness: .3, clearcoat: 1, clearcoatRoughness: .08, sheen: .5, sheenColor: new T.Color('#f0dcc4') });
    const eyeM = k.gloss('#16110d'), eyes = [];
    for (const sd of [-1, 1]) {
      const lean = sd < 0 ? .06 : -.02;   // one stalk leans out further than the other: curious
      const st = curveOf(k, [[.82, .54, sd * .05], [.88 + lean * .3, .72, sd * .1], [.95 + lean * .7, .88 - lean * .3, sd * .15], [1.01 + lean, 1.0 - lean * .6, sd * .2]]);
      k.add(s, softBody(k, st, t => (lerp(.055, .03, smooth(0, .7, t)) + .018 * smooth(.76, .92, t)) * ends(t, 0, .1), { seg: 30, rs: 14 }), stalk);
      const tip = st.getPointAt(1), dir = st.getTangentAt(1);
      eyes.push([k.add(s, k.sphere(.026, { w: 16, h: 12 }), eyeM, { p: tip.addScaledVector(dir, -.016).add(V(k, [.016, .006, sd * .008])).toArray() }), .026]);
      const fe = curveOf(k, [[.88, .46, sd * .07], [.97, .41, sd * .11], [1.05, .37, sd * .15]]);
      k.add(s, softBody(k, fe, t => lerp(.04, .03, t) * ends(t, 0, .25), { seg: 16, rs: 12 }), stalk);
    }
    // the shell, coiling clockwise from its apex (on the snail's left) down to the mouth over the foot
    const shellMat = k.mat({ map: k.tex(1024, 256, paintShell, { cache: 'bp-wings:snail-shell' }), roughness: .32, clearcoat: .9, clearcoatRoughness: .12 });
    const SR = .37, SD = 1.02, STau = 1.25;
    const shell = k.group();
    k.add(shell, shellGeo(k, { turns: 4, grow: 2.3, R: SR, D: SD, tau: STau, seg: 400, rs: 40 }), shellMat);
    // the mouth, filled by the soft mantle that the neck comes out from under
    const mouth = V(k, [SR * SD, -SR * STau, 0]);
    k.add(shell, k.sphere(SR * .9, { w: 32, h: 16 }), skin, { p: [mouth.x, mouth.y, -.02], s: [1, 1, .3] });
    const A = V(k, [-.28, .42, -1]).normalize(), U = V(k, [0, -1, 0]).addScaledVector(A, A.y).normalize(), W = new T.Vector3().crossVectors(U, A);
    shell.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(U, A, W));
    shell.position.copy(V(k, [.1, .41, .08]).sub(mouth.clone().applyQuaternion(shell.quaternion)));
    s.add(shell);
    const view = { az: 30, el: 18 };
    g.userData.view = view;
    glints(k, g, eyes, view);
    return g;
  },

  // A plump monarch caterpillar, banded yellow, black and white, munching a bite out of a milkweed leaf.
  caterpillar(k) {
    const T = k.THREE, g = k.group();
    // the leaf lies along x, its bitten edge towards the camera (+z)
    const L = 2.5, HW = .6, tn = .66, nw = .085, nd = .55;
    const hw = t => HW * Math.pow(Math.max(0, Math.sin(Math.PI * clamp(t))), .6) * (1 - .15 * t);
    const bite = t => { const q = (t - tn) / nw; return Math.abs(q) < 1 ? nd * Math.sqrt(1 - q * q) : 0; };
    const leafY = (t, s) => .1 * Math.sin(Math.PI * t) + .07 * s * s + .025 * s;
    const lg = new T.PlaneGeometry(1, 1, 100, 40), lp = lg.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      const t = lp.getX(i) + .5, s = -2 * lp.getY(i), half = hw(t) * (s > 0 ? 1 - bite(t) : 1);
      lp.setXYZ(i, -L / 2 + t * L, leafY(t, s), s * half);
    }
    lg.computeVertexNormals();
    const leafMap = k.tex(1024, 512, (c, w, h) => {
      const R = rng(51);
      const gr = c.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#3a7534'); gr.addColorStop(.5, '#5b9a47'); gr.addColorStop(1, '#3a7534');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) { c.fillStyle = R() < .5 ? `rgba(30,70,20,${.03 + R() * .05})` : `rgba(200,236,170,${.03 + R() * .05})`; blob(c, R() * w, R() * h, 4 + R() * 18); }
      c.strokeStyle = 'rgba(220,240,196,.8)'; c.lineCap = 'round';
      for (let t = .07; t < .95; t += .062) for (const sd of [-1, 1]) {
        c.lineWidth = 3.4 * (1 - t * .5);
        c.beginPath(); c.moveTo(t * w, h / 2); c.quadraticCurveTo((t + .05) * w, h / 2 + sd * .3 * h, (t + .15) * w, h / 2 + sd * .47 * h); c.stroke();
      }
      c.fillStyle = '#dcefc6'; c.beginPath(); c.moveTo(0, h / 2 - 9); c.lineTo(w, h / 2 - 1); c.lineTo(w, h / 2 + 1); c.lineTo(0, h / 2 + 9); c.closePath(); c.fill();
    }, { cache: 'bp-wings:milkweed' });
    k.add(g, lg, k.mat({ map: leafMap, roughness: .5, side: T.DoubleSide, sheen: .4, sheenColor: new T.Color('#e4f7d4'), clearcoat: .25, clearcoatRoughness: .3 }));
    k.add(g, k.tube([[-L / 2 + .02, leafY(0, 0), 0], [-L / 2 - .15, .03, -.02], [-L / 2 - .32, .02, -.06]], .03, { caps: true, rs: 10 }), k.plastic('#a8c98a', { rough: .5, coat: .2 }));
    // the caterpillar, lying on the leaf
    const surf = (x, z) => { const t = (x + L / 2) / L; return leafY(t, z / Math.max(.05, hw(t))); };
    const lift = .19, Wd = .15, nseg = 11;
    const cv = curveOf(k, [[-.98, -.1], [-.62, -.13], [-.24, -.07], [.08, .03], [.3, .12], [.4, .19]].map(([x, z]) => [x, surf(x, z) + lift, z]));
    const prof = t => {
      const fold = .5 + .5 * Math.cos(TAU * nseg * t), r = Wd * (1 - .035 * fold) * ends(t, .09, .05) * (1 - .1 * smooth(.85, 1, t));
      return { w: r, h: r * 1.04, b: r * .86 };
    };
    const bands = [['#151515', .06], ['#f6c21a', .24], ['#151515', .1], ['#f6f3e8', .2], ['#151515', .05], ['#f6f3e8', .2], ['#151515', .15]];
    const stripes = k.tex(1024, 128, (c, w, h) => {
      const sw = w / nseg;
      for (let i = 0; i < nseg; i++) { let x = i * sw; for (const [col, f] of bands) { c.fillStyle = col; c.fillRect(x, 0, f * sw + 1, h); x += f * sw; } }
      const gr = c.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(20,20,20,.95)'); gr.addColorStop(.15, 'rgba(20,20,20,0)'); gr.addColorStop(.85, 'rgba(20,20,20,0)'); gr.addColorStop(1, 'rgba(20,20,20,.95)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }, { cache: 'bp-wings:caterpillar' });
    k.add(g, softBody(k, cv, prof, { seg: 200, rs: 28, a0: Math.PI }), k.mat({ map: stripes, roughness: .32, clearcoat: .7, clearcoatRoughness: .15 }));
    const black = k.gloss('#141414');
    // head: glossy black with yellow and white stripes, bent down to the bite
    const f1 = frameAt(k, cv, 1), fwd = f1.D.clone().addScaledVector(f1.U, -.55).normalize();
    const headMap = k.tex(256, 128, (c, w, h) => {
      c.fillStyle = '#141414'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f6f3e8'; c.fillRect(0, h * .26, w, h * .07);
      // a yellow band that dips into a V on the face, and a pale mouth
      c.fillStyle = '#f6c21a'; c.beginPath(); c.moveTo(0, h * .44);
      for (let x = 0; x <= w; x += 4) { const d = Math.max(0, 1 - Math.abs(x / w - .25) / .09); c.lineTo(x, h * (.44 + .2 * d)); }
      for (let x = w; x >= 0; x -= 4) { const d = Math.max(0, 1 - Math.abs(x / w - .25) / .06); c.lineTo(x, h * (.52 + .2 * d)); }
      c.closePath(); c.fill();
      c.fillStyle = '#d9cba0'; c.fillRect(w * .225, h * .78, w * .05, h * .06);
    }, { cache: 'bp-wings:caterpillar-head' });
    const head = k.add(g, k.sphere(.13, { w: 32, h: 20 }), k.mat({ map: headMap, roughness: .2, clearcoat: 1, clearcoatRoughness: .05 }), { p: f1.P.clone().addScaledVector(fwd, .09).addScaledVector(f1.U, -.02).toArray() });
    orient(k, head, new T.Vector3().crossVectors(f1.U, fwd).toArray(), f1.U.toArray());
    // filaments: a long pair behind the head and a short pair near the tail
    for (const [t0, len, back] of [[.9, 1, false], [.1, .6, true]]) {
      const f = frameAt(k, cv, t0), dir = f.D.clone().multiplyScalar(back ? -1 : 1);
      for (const sd of [-1, 1]) {
        const B = f.P.clone().addScaledVector(f.U, prof(t0).h * .8).addScaledVector(f.S, sd * Wd * .4);
        const pts = [[0, 0, 0], [.03, .13, .03], [.13, .24, .07], [.28, .27, .11]].map(([a, u, sv]) => B.clone().addScaledVector(dir, a * len).addScaledVector(f.U, u * len).addScaledVector(f.S, sd * sv * len).toArray());
        k.add(g, softBody(k, curveOf(k, pts), t => lerp(.02, .008, t) * ends(t, 0, .08), { seg: 30, rs: 10 }), black);
      }
    }
    // three pairs of true legs up front, four pairs of prolegs and a pair of claspers behind
    for (const t0 of [.955, .915, .875]) {
      const f = frameAt(k, cv, t0);
      for (const sd of [-1, 1]) {
        const cone = k.add(g, k.cone(.024, .08, 10), black, { p: f.P.clone().addScaledVector(f.U, -prof(t0).b * .75).addScaledVector(f.S, sd * Wd * .5).toArray() });
        cone.quaternion.setFromUnitVectors(V(k, [0, 1, 0]), f.U.clone().negate().addScaledVector(f.D, .4).normalize());
      }
    }
    for (const t0 of [.3, .38, .46, .54, .05]) {
      const f = frameAt(k, cv, t0);
      for (const sd of [-1, 1]) {
        const top = f.P.clone().addScaledVector(f.U, -prof(t0).b * .5).addScaledVector(f.S, sd * Wd * .55);
        g.add(rod(k, top.toArray(), [top.x, surf(top.x, top.z) + .01, top.z], .04, black, 12));
      }
    }
    const view = { az: 30, el: 30 };
    g.userData.view = view;
    g.userData.fullView = { el: 34 };
    glints(k, g, [[head, .13, .1]], view);
    return g;
  },

  // A blue-green dragonfly perched on the tip of a cattail, its four clear, finely veined wings spread flat.
  dragonfly(k) {
    const T = k.THREE, g = k.group(), d = k.group([], { r: [0, k.deg(-15), 0] }); g.add(d);
    const H = 1.75;
    // abdomen: long, slim, metallic blue with dark rings at the segments
    const segs = [0, .05, .12, .24, .35, .46, .57, .68, .79, .89, .97, 1];
    const abMap = k.tex(1024, 128, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#1fae9a'); gr.addColorStop(.25, '#1d9fd6'); gr.addColorStop(1, '#1778b8');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let i = 0; i < segs.length - 1; i++) {
        const x0 = segs[i] * w, x1 = segs[i + 1] * w;
        const sg = c.createLinearGradient(x0, 0, x1, 0); sg.addColorStop(0, 'rgba(160,230,255,.35)'); sg.addColorStop(.6, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,20,40,.35)');
        c.fillStyle = sg; c.fillRect(x0, 0, x1 - x0, h);
        c.fillStyle = '#0d1a22'; c.fillRect(x1 - 5, 0, 7, h);
      }
      c.fillStyle = 'rgba(8,20,28,.8)'; c.fillRect(0, h * .47, w, h * .06);
      c.fillStyle = 'rgba(8,20,28,.85)'; c.fillRect(w * .9, 0, w * .1, h);
    }, { cache: 'bp-wings:dragon-abdomen' });
    const metal = { roughness: .26, metalness: .55, clearcoat: 1, clearcoatRoughness: .08, iridescence: .6, iridescenceIOR: 1.6, iridescenceThicknessRange: [280, 520] };
    const ab = curveOf(k, [[.42, H + .01, 0], [.1, H + .03, 0], [-.5, H + .01, 0], [-1.2, H - .04, 0], [-1.85, H - .11, 0]]);
    k.add(d, softBody(k, ab, t => {
      const r = t < .12 ? lerp(.095, .075, t / .12) : t < .2 ? lerp(.075, .05, smooth(.12, .2, t)) : lerp(.05, .058, smooth(.55, .88, t));
      const e = ends(t, .03, .025);
      return { w: r * e, h: r * 1.05 * e, b: r * .95 * e };
    }, { seg: 160, rs: 20, a0: Math.PI }), k.mat({ map: abMap, ...metal }));
    const black = k.gloss('#141518');
    for (const sd of [-1, 1]) k.add(d, k.tube([[-1.84, H - .11, sd * .012], [-1.95, H - .12, sd * .03], [-2.02, H - .1, sd * .04]], .012, { caps: true, rs: 8 }), black);
    // thorax: metallic green with dark stripes, slanting back
    const thMap = k.tex(256, 128, (c, w, h) => {
      c.fillStyle = '#2f9a52'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#123620'; for (const u of [.17, .3, .7, .83]) c.fillRect(u * w - 5, 0, 10, h);
      c.fillStyle = 'rgba(190,255,200,.35)'; for (const u of [.235, .765]) c.fillRect(u * w - 6, 0, 12, h);
    }, { cache: 'bp-wings:dragon-thorax' });
    k.add(d, k.sphere(1, { w: 40, h: 24 }), k.mat({ map: thMap, ...metal }), { p: [.64, H, 0], s: [.3, .2, .16], r: [0, 0, -.4] });
    k.add(d, k.sphere(.08, { w: 16, h: 12 }), k.mat({ color: '#2a7a48', ...metal }), { p: [.93, H + .02, 0] });
    // head: two huge compound eyes meeting on top (a honeycomb of facets, blue-green shading to deep teal), a pale face below
    const eyeMap = k.tex(256, 256, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#46b7a4'); gr.addColorStop(.35, '#1d8a8e'); gr.addColorStop(.7, '#10505e'); gr.addColorStop(1, '#0a2a33');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(4,24,30,.35)'; c.lineWidth = 1;
      for (let y = 0, row = 0; y < h + 6; y += 5.2, row++) for (let x = (row % 2) * 3; x < w + 6; x += 6) { c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.lineTo(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2); } c.closePath(); c.stroke(); }
    }, { cache: 'bp-wings:dragon-eye' });
    const eyeM = k.mat({ map: eyeMap, roughness: .22, clearcoat: 1, clearcoatRoughness: .04 }), eyes = [];
    for (const sd of [-1, 1]) eyes.push([k.add(d, k.sphere(.155, { w: 40, h: 28 }), eyeM, { p: [1.02, H + .1, sd * .08], s: [1, 1.02, .95], r: [0, 0, -.25] }), .155, .16]);
    k.add(d, k.sphere(.075, { w: 24, h: 16 }), k.plastic('#b7c768', { rough: .35 }), { p: [1.12, H - .02, 0], s: [.75, 1, 1.35] });
    k.add(d, k.sphere(.04, { w: 16, h: 12 }), k.plastic('#2b2f22', { rough: .4 }), { p: [1.15, H - .09, 0], s: [1, .7, 1.4] });
    // six legs gripping the tip of the spike
    const tipY = H - .33, tipX = .63;
    [[.78, .06, .92, .1], [.66, .07, .76, .14], [.54, .07, .58, .15]].forEach(([hx, hz, kx, kz], i) => {
      for (const sd of [-1, 1]) k.add(d, k.tube([[hx, H - .1, sd * hz], [kx, H - .2, sd * kz], [tipX + (1 - i) * .04, tipY - i * .02, sd * .03]], .011, { caps: true, rs: 8, seg: 24 }), black);
    });
    // wings
    const clear = { roughness: .12, clearcoat: .6, clearcoatRoughness: .1, iridescence: .8, iridescenceIOR: 1.35, iridescenceThicknessRange: [220, 560] };
    const wf = paintDragonWing(k, false), wh = paintDragonWing(k, true);
    for (const sd of [-1, 1]) {
      for (const [hx, len, sweep, paint, box, key] of [[.72, 1.36, 8, wf, [-.02, -.24, 1.02, .04], 'f'], [.54, 1.3, -6, wh, [-.02, -.38, 1.02, .04], 'h']]) {
        const w = sheet(k, box, paint, { clear: true, mat: clear, bend: (x) => -.03 * x * x, cache: `bp-wings:dragon-wing-${key}` });
        w.scale.setScalar(len); w.castShadow = false;
        const hinge = k.group([w], { p: [hx, H + .14, sd * .05] });
        const sw = k.deg(sweep);
        orient(k, hinge, [Math.sin(sw), -.03, sd * Math.cos(sw)], [1, 0, 0]);
        d.add(hinge);
      }
    }
    // the cattail: a thin spike above a velvety brown head on a green stem
    const velvet = k.tex(128, 256, (c, w, h) => {
      const R = rng(71); c.fillStyle = '#7a4b2c'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) { c.fillStyle = R() < .5 ? `rgba(40,20,8,${R() * .25})` : `rgba(190,140,90,${R() * .22})`; c.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 3); }
    }, { cache: 'bp-wings:cattail' });
    const fuzz = k.mat({ map: velvet, roughness: .95, sheen: 1, sheenColor: new T.Color('#c49a6c'), sheenRoughness: .55 });
    const green = k.plastic('#6f8f45', { rough: .55, coat: .2 });
    k.add(d, k.tube([[tipX, tipY + .02, 0], [tipX - .01, tipY - .14, 0], [tipX - .02, tipY - .28, 0]], .014, { caps: true, rs: 10 }), k.matte('#b09a68', .7));
    k.add(d, k.capsule(.12, .62, 12), fuzz, { p: [tipX - .02, tipY - .28 - .43, 0] });
    k.add(d, k.tube([[tipX - .02, tipY - 1.1, 0], [tipX - .03, (tipY - 1.1) / 2, 0], [tipX - .05, 0, 0]], .034, { rs: 12 }), green);
    const view = { az: 30, el: 46 };
    g.userData.view = view;
    g.userData.fullView = { el: 40 };
    glints(k, g, eyes, view);
    return g;
  },

  // A monarch butterfly on a purple coneflower, its wings open in a shallow V.
  monarch(k) {
    const T = k.THREE, g = k.group();
    // Built facing us: body along +y (head up), back towards +z, then tipped back to sit on the flower.
    const sp = k.group([], { order: 'YXZ', r: [-k.deg(42), k.deg(16), 0] }); g.add(sp);
    const wingMat = { roughness: .62, sheen: .5, sheenColor: new T.Color('#ffd9a0'), sheenRoughness: .5 };
    const bend = (x, y) => .03 * x * x;
    for (const sd of [1, -1]) {
      const hinge = k.group([], { p: [sd * .04, .06, .012], r: [0, -sd * k.deg(19), 0] }); sp.add(hinge);
      const side = k.group([], { s: [sd, 1, 1] }); hinge.add(side);
      side.add(sheet(k, [-.02, -.14, 1.02, .52], paintMonarchFore(k), { mat: wingMat, bend, cache: 'bp-wings:monarch-fore' }));
      const hw = sheet(k, [-.02, -.68, .72, .03], paintMonarchHind(k), { mat: wingMat, bend, cache: 'bp-wings:monarch-hind', px: 768 });
      hw.position.set(0, -.04, -.006); side.add(hw);
    }
    // body: fuzzy black, speckled white on the thorax and head
    const fuzz = k.mat({ color: '#1a1512', roughness: .7, sheen: 1, sheenColor: new T.Color('#6e5a48'), sheenRoughness: .5 });
    k.add(sp, k.sphere(1, { w: 32, h: 24 }), fuzz, { p: [0, .06, 0], s: [.068, .12, .062] });
    k.add(sp, k.sphere(.052, { w: 24, h: 16 }), fuzz, { p: [0, .2, .005] });
    const abd = curveOf(k, [[0, -.03, -.005], [0, -.2, -.015], [0, -.38, -.02], [0, -.47, -.02]]);
    k.add(sp, softBody(k, abd, t => .046 * (1 - .45 * smooth(.3, 1, t)) * ends(t, .05, .08), { seg: 40, rs: 16, up: [0, 0, 1] }), fuzz);
    const dots = [];
    for (let i = 0; i < 16; i++) {
      const a = k.range(-1.3, 1.3), b = k.range(-.9, .9), n = V(k, [Math.sin(a) * Math.cos(b), Math.sin(b), Math.cos(a) * Math.cos(b)]);
      dots.push({ p: [n.x * .066, .06 + n.y * .118, n.z * .06], s: k.range(.006, .011) });
    }
    for (let i = 0; i < 6; i++) dots.push({ p: [k.range(-.03, .03), .2 + k.range(-.02, .03), .048], s: .007 });
    sp.add(k.instances(k.sphere(1, { w: 8, h: 6 }), k.matte('#f4efe6', .6), dots));
    const eyeM = k.gloss('#1c1714'), eyes = [];
    for (const sd of [-1, 1]) eyes.push([k.add(sp, k.sphere(.03, { w: 20, h: 14 }), eyeM, { p: [sd * .036, .215, .02] }), .03]);
    // clubbed antennae
    const ink = k.gloss('#121212');
    for (const sd of [-1, 1]) {
      const pts = [[sd * .016, .245, .03], [sd * .06, .39, .045], [sd * .12, .54, .04], [sd * .155, .62, .03]];
      k.add(sp, k.tube(pts, .0055, { rs: 6, seg: 30 }), ink);
      const club = k.add(sp, k.sphere(.016, { w: 12, h: 10 }), ink, { p: pts[3] });
      club.scale.set(1, 2.1, 1); club.quaternion.setFromUnitVectors(V(k, [0, 1, 0]), V(k, [sd * .4, 1, -.1]).normalize());
    }
    // legs down to the flower, and the proboscis
    for (const sd of [-1, 1]) for (const [y, fy] of [[.09, .13], [.03, -.02]]) k.add(sp, k.tube([[sd * .03, y, -.04], [sd * .1, y + .02, -.07], [sd * .12, fy, -.14]], .006, { caps: true, rs: 6, seg: 20 }), ink);
    k.add(sp, k.tube([[0, .17, -.03], [0, .15, -.08], [0, .1, -.12]], .004, { rs: 6 }), ink);
    // the coneflower: an orange-brown cone of spiky florets and drooping pink petals, its face turned up to us
    const fl = k.group([], { p: [0, .02, -.135], r: [Math.PI / 2, 0, 0] }); sp.add(fl);
    k.add(fl, k.sphere(.19, { w: 40, h: 16, thetaLen: Math.PI / 2 }), k.matte('#6b2e12', .7), { p: [0, -.105, 0], s: [1, .55, 1] });
    const florets = [], N = 150;
    for (let i = 0; i < N; i++) {
      const r = .185 * Math.sqrt((i + .5) / N), a = i * 2.39996, x = Math.cos(a) * r, z = Math.sin(a) * r, y = -.105 + .105 * Math.sqrt(Math.max(0, 1 - (r / .19) ** 2));
      const n = V(k, [x / .19 ** 2, (y + .105) / .105 ** 2, z / .19 ** 2]);
      florets.push({ p: [x, y + .012, z], r: eulerTo(k, n), color: new T.Color('#f39a2c').lerp(new T.Color('#a8401a'), r / .19) });
    }
    fl.add(k.instances(k.cone(.013, .05, 6), k.plastic('#ffffff', { rough: .45, coat: .3 }), florets));
    const petalGeo = new T.PlaneGeometry(1, 1, 4, 14), pp = petalGeo.attributes.position;
    for (let i = 0; i < pp.count; i++) { const a = pp.getX(i), t = pp.getY(i) + .5; pp.setXYZ(i, a * .2 * (1 - .12 * t), -.2 * t * t + .016 * (1 - 4 * a * a), .02 + t * .5); }
    petalGeo.computeVertexNormals();
    const petalMap = k.tex(128, 512, (c, w, h) => {
      c.beginPath(); c.moveTo(w * .4, h); c.bezierCurveTo(w * .08, h * .75, w * .02, h * .25, w * .1, h * .06);
      c.quadraticCurveTo(w * .2, 0, w * .32, h * .05); c.quadraticCurveTo(w * .42, h * .01, w * .52, h * .05); c.quadraticCurveTo(w * .64, h * .01, w * .74, h * .05);
      c.quadraticCurveTo(w * .86, 0, w * .9, h * .07); c.bezierCurveTo(w * .98, h * .25, w * .92, h * .75, w * .6, h); c.closePath();
      const gr = c.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#93295c'); gr.addColorStop(.3, '#c9508a'); gr.addColorStop(1, '#e585b6');
      c.fillStyle = gr; c.fill();
      c.strokeStyle = 'rgba(130,24,76,.1)'; c.lineWidth = 3;
      for (let i = 0; i < 4; i++) { const x = w * (.3 + i * .13); c.beginPath(); c.moveTo(w * .5, h); c.quadraticCurveTo(x, h * .5, x, h * .12); c.stroke(); }
      c.strokeStyle = 'rgba(110,16,64,.22)'; c.lineWidth = 5; c.beginPath(); c.moveTo(w * .5, h); c.lineTo(w * .5, h * .15); c.stroke();
    }, { cache: 'bp-wings:coneflower-petal' });
    const petals = [];
    for (let i = 0; i < 22; i++) {
      const outer = i < 14, n = outer ? 14 : 8, a = ((outer ? i : i - 14) + (outer ? 0 : .5)) / n * TAU + k.range(-.06, .06);
      petals.push({ p: [Math.sin(a) * .15, outer ? -.1 : -.085, Math.cos(a) * .15], r: [k.range(-.08, .12) - (outer ? 0 : .12), a, k.range(-.12, .12)], order: 'YXZ', s: outer ? 1 : .84 });
    }
    fl.add(k.instances(petalGeo, k.mat({ map: petalMap, side: T.DoubleSide, alphaTest: .5, roughness: .55, sheen: .6, sheenColor: new T.Color('#ffc2e0') }), petals));
    k.add(fl, k.sphere(.13, { w: 24, h: 12 }), k.plastic('#4f7d32', { rough: .6, coat: .1 }), { p: [0, -.17, 0], s: [1, .5, 1] });
    // stem down to the ground
    g.updateMatrixWorld(true);
    const base = fl.localToWorld(V(k, [0, -.22, 0])), back = fl.localToWorld(V(k, [0, -.5, 0])).sub(base).normalize();
    const bb = new T.Box3().setFromObject(sp), floor = bb.min.y - .6;
    const stem = curveOf(k, [base.toArray(), base.clone().addScaledVector(back, .18).toArray(), [base.x * .8, lerp(base.y, floor, .55), base.z - .12], [base.x * .7, floor, base.z - .16]]);
    const stemM = k.plastic('#4f7d32', { rough: .6, coat: .1 });
    k.add(g, k.tube(stem.getPoints(40).map(p => p.toArray()), .035, { rs: 12, seg: 48 }), stemM);
    const leafPaint = c => {
      c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(.2, .1, .5, .1, .8, 0); c.bezierCurveTo(.5, -.1, .2, -.1, 0, 0); c.closePath();
      const gr = c.createLinearGradient(0, -.1, 0, .1); gr.addColorStop(0, '#3d6e2a'); gr.addColorStop(.5, '#5a8f3c'); gr.addColorStop(1, '#3d6e2a');
      c.fillStyle = gr; c.fill();
      c.strokeStyle = 'rgba(190,225,150,.55)'; c.lineWidth = .008; c.beginPath(); c.moveTo(0, 0); c.lineTo(.78, 0); c.stroke();
      c.lineWidth = .004; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(.02, 0); c.quadraticCurveTo(.3, sd * .05, .66, sd * .012); c.stroke(); }
    };
    const toCam = V(k, [Math.sin(k.deg(30)) * Math.cos(k.deg(20)), Math.sin(k.deg(20)), Math.cos(k.deg(30)) * Math.cos(k.deg(20))]);
    for (const [t, dir, len] of [[.74, [-.85, .5, .2], .8], [.86, [.9, .45, -.1], .66]]) {
      const at = stem.getPointAt(t), L = V(k, dir).normalize(), Wd = new T.Vector3().crossVectors(toCam, L).normalize();
      const leaf = sheet(k, [0, -.1, .8, .1], leafPaint, { px: 512, sx: 16, sy: 6, bend: (x, y) => -.18 * x * x + .5 * y * y, mat: { roughness: .6, sheen: .4, sheenColor: new T.Color('#d8f0c0') }, cache: 'bp-wings:coneflower-leaf' });
      leaf.scale.setScalar(len);
      g.add(orient(k, k.group([leaf], { p: at.toArray() }), L.toArray(), Wd.toArray()));
    }
    const view = { az: 30, el: 18 };
    g.userData.view = view;
    glints(k, g, eyes, view);
    return g;
  },

  // A luna moth spread wide as if resting on a tree trunk at night: pale green, long curling tails, feathery antennae.
  lunamoth(k) {
    const T = k.THREE, g = k.group();
    const sp = k.group([], { order: 'YXZ', r: [-k.deg(22), k.deg(20), 0] }); g.add(sp);
    const wingMat = { roughness: .55, sheen: .7, sheenColor: new T.Color('#f4ffe0'), sheenRoughness: .45, emissive: new T.Color('#ffffff'), emissiveIntensity: .16 };
    for (const sd of [1, -1]) {
      const hinge = k.group([], { p: [sd * .05, .06, .012], r: [0, -sd * k.deg(10), 0] }); sp.add(hinge);
      const side = k.group([], { s: [sd, 1, 1] }); hinge.add(side);
      const fw = sheet(k, [-.02, -.16, 1.03, .44], paintLunaFore(k), { mat: wingMat, bend: (x, y) => .025 * x * x, cache: 'bp-wings:luna-fore' });
      fw.material.emissiveMap = fw.material.map; side.add(fw);
      const hw = sheet(k, [-.02, -1.4, .7, .03], paintLunaHind(k), { mat: wingMat, px: 640, sy: 48, bend: (x, y) => .02 * x * x - .14 * Math.max(0, -y - .6) ** 2 + .12 * (x - .3) * Math.max(0, -y - .85), cache: 'bp-wings:luna-hind' });
      hw.material.emissiveMap = hw.material.map; hw.position.set(0, -.03, -.006); side.add(hw);
    }
    // fuzzy white body with a purple-brown collar
    const fur = k.fabric('#f6f4ee', { weave: false, sheen: '#ffffff' });
    k.add(sp, k.sphere(1, { w: 32, h: 24 }), fur, { p: [0, .06, 0], s: [.085, .135, .08] });
    k.add(sp, k.sphere(1, { w: 32, h: 16 }), k.fabric(LUNA.costa, { weave: false }), { p: [0, .155, .012], s: [.092, .045, .07], r: [-.3, 0, 0] });
    k.add(sp, k.sphere(.045, { w: 24, h: 16 }), fur, { p: [0, .205, -.012] });
    const abd = curveOf(k, [[0, -.03, -.01], [0, -.2, -.02], [0, -.36, -.03], [0, -.44, -.03]]);
    k.add(sp, softBody(k, abd, t => .062 * (1 - .4 * smooth(.3, 1, t)) * ends(t, .05, .1), { seg: 40, rs: 16, up: [0, 0, 1] }), fur);
    const hairs = [];
    for (let i = 0; i < 240; i++) {
      const onAbd = i >= 150, a = k.range(-1.7, 1.7), b = k.range(-1.2, 1.2);
      const n = V(k, [Math.sin(a) * Math.cos(b), Math.sin(b), Math.cos(a) * Math.cos(b)]);
      const y = k.range(-.36, -.04), rA = .062 * (1 - .4 * smooth(.3, 1, (-y) / .44));
      const c = onAbd ? V(k, [0, y, -.015]) : V(k, [0, .06, 0]), rr = onAbd ? V(k, [rA * .9, .02, rA * .9]) : V(k, [.08, .13, .075]);
      hairs.push({ p: [c.x + n.x * rr.x, c.y + n.y * rr.y, c.z + n.z * rr.z], r: eulerTo(k, n.add(V(k, [0, -.5, 0]))), s: onAbd ? k.range(.5, .8) : k.range(.7, 1.2) });
    }
    sp.add(k.instances(k.cone(.009, .04, 5), fur, hairs));
    const eyeM = k.gloss('#2a1a14'), eyes = [];
    for (const sd of [-1, 1]) eyes.push([k.add(sp, k.sphere(.018, { w: 14, h: 10 }), eyeM, { p: [sd * .04, .215, .0] }), .018]);
    // feathery antennae
    const tan = k.matte('#c9a868', .7), barbs = [];
    for (const sd of [-1, 1]) {
      const shaft = curveOf(k, [[sd * .02, .235, .02], [sd * .07, .35, .05], [sd * .13, .46, .055], [sd * .17, .53, .04]]);
      k.add(sp, k.tube(shaft.getPoints(20).map(p => p.toArray()), .006, { rs: 6 }), tan);
      for (let i = 0; i < 20; i++) {
        const t = (i + .5) / 20, p = shaft.getPointAt(t), tg = shaft.getTangentAt(t), side0 = new T.Vector3().crossVectors(tg, V(k, [0, 0, 1])).normalize();
        const len = .055 * Math.pow(Math.sin(Math.PI * (.08 + .88 * t)), .7);
        for (const s2 of [-1, 1]) {
          const dir = side0.clone().multiplyScalar(s2).addScaledVector(tg, .8).normalize();
          barbs.push({ p: p.clone().addScaledVector(dir, len / 2).toArray(), r: eulerTo(k, dir), s: [1, len, 1] });
        }
      }
    }
    sp.add(k.instances(k.cyl(.0035, .002, 1, { seg: 5 }), tan, barbs));
    // short purplish legs tucked under the front
    const legM = k.fabric('#b25a7e', { weave: false });
    for (const sd of [-1, 1]) for (const y of [.14, .08, .02]) k.add(sp, k.tube([[sd * .04, y, -.04], [sd * .11, y + .03, -.07], [sd * .15, y - .03, -.08]], .009, { caps: true, rs: 6, seg: 16 }), legM);
    const view = { az: 30, el: 16 };
    g.userData.view = view;
    g.userData.floating = true;
    glints(k, g, eyes, view);
    return g;
  },
};

// The garden snail's shell: a warm brown ground with dark chocolate spiral bands broken by pale flecks, and growth lines.
// u runs along the coil (apex at 0), v round the tube: v = 0 outermost, .25 towards the apex, .75 underneath.
function paintShell(c, w, h) {
  const R = rng(61);
  const gr = c.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, '#e2cfa8'); gr.addColorStop(.3, '#c9a067'); gr.addColorStop(1, '#b37a3f');
  c.fillStyle = gr; c.fillRect(0, 0, w, h);
  const yOf = deg => ((-deg / 360) % 1 + 1) % 1 * h;
  // paler underneath
  c.fillStyle = 'rgba(236,214,170,.55)'; c.fillRect(0, yOf(-100), w, yOf(-45) - yOf(-100));
  for (const [ph, wd, a] of [[64, 13, .78], [40, 10, .82], [18, 11, .78], [-6, 13, .88], [-30, 9, .6]]) {
    const yc = yOf(ph), bw = wd / 360 * h, p1 = R() * 9, p2 = R() * 9;
    c.fillStyle = `rgba(68,37,17,${a})`;
    for (const off of [-h, 0, h]) {
      c.beginPath();
      for (let x = 0; x <= w; x += 6) c.lineTo(x, off + yc - bw / 2 * (1 + .25 * Math.sin(x * .031 + p1)) + Math.sin(x * .013 + p2) * 1.5);
      for (let x = w; x >= 0; x -= 6) c.lineTo(x, off + yc + bw / 2 * (1 + .25 * Math.sin(x * .027 + p2)) + Math.sin(x * .013 + p2) * 1.5);
      c.closePath(); c.fill();
    }
  }
  // pale flames running across the whorl, breaking up the bands
  for (let x = R() * 10; x < w; x += 7 + R() * 22) {
    const fw = 1.5 + R() * 4.5, lean = (R() - .5) * 10;
    c.fillStyle = `rgba(226,196,138,${.35 + R() * .4})`;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x + fw, 0); c.lineTo(x + fw + lean, h); c.lineTo(x + lean, h); c.closePath(); c.fill();
  }
  // growth lines
  for (let x = 0; x < w; x += 2 + R() * 5) { c.fillStyle = R() < .5 ? 'rgba(60,30,10,.12)' : 'rgba(255,240,210,.12)'; c.fillRect(x, 0, 1 + R() * 1.5, h); }
  // worn, pale apex
  const ap = c.createLinearGradient(0, 0, w * .16, 0); ap.addColorStop(0, 'rgba(236,222,196,.95)'); ap.addColorStop(1, 'rgba(236,222,196,0)');
  c.fillStyle = ap; c.fillRect(0, 0, w * .16, h);
}
