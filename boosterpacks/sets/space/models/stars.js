// Outer Space models: the stars. Glow-in-the-dark stars for the ceiling, a shooting star, the Big Dipper, a pulsar, the
// Sun, a black hole and a spiral galaxy. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.
// Everything here makes its own light: unlit or glowing surfaces, and soft glows added onto whatever is behind them
// (additive sprites, ribbons and instanced points), so it all shines out of the Stars sector's night sky.
// Additive textures keep their light in the alpha channel: the studio renders onto a clear canvas, so a glow painted on
// opaque black would print a black square over the card's background.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// Round off the ends of a body: 1 along the middle, closing like a ball over the first c0 and the last c1 of t.
const ends = (t, c0, c1 = c0) => {
  let f = 1;
  if (c0 > 0 && t < c0) { const q = t / c0; f *= Math.sqrt(Math.max(0, q * (2 - q))); }
  if (c1 > 0 && 1 - t < c1) { const q = (1 - t) / c1; f *= Math.sqrt(Math.max(0, q * (2 - q))); }
  return f;
};
// An integer hash to [0, 1), and smooth value noise on it. The noise is 3D so textures can be painted from points on a
// sphere or round a ring without seams; fbm adds a few octaves of it (about 0..1).
const hash = (x, y, z) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function noise(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = x - X, v = y - Y, w = z - Z;
  const a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), c = w * w * (3 - 2 * w);
  return lerp(
    lerp(lerp(hash(X, Y, Z), hash(X + 1, Y, Z), a), lerp(hash(X, Y + 1, Z), hash(X + 1, Y + 1, Z), a), b),
    lerp(lerp(hash(X, Y, Z + 1), hash(X + 1, Y, Z + 1), a), lerp(hash(X, Y + 1, Z + 1), hash(X + 1, Y + 1, Z + 1), a), b), c);
}
const fbm = (x, y, z, oct = 4) => { let s = 0, amp = .5, n = 0, f = 1; for (let i = 0; i < oct; i++) { s += amp * noise(x * f + i * 17.31, y * f, z * f); n += amp; amp *= .5; f *= 2.07; } return s / n; };
// Paint a canvas pixel by pixel in texture space: f(u, v, out) fills out with [r, g, b, a] (0..1). v runs up, like uv.y.
function pixels(c, w, h, f) {
  const img = c.createImageData(w, h), d = img.data, out = [0, 0, 0, 1];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    out[3] = 1; f((x + .5) / w, 1 - (y + .5) / h, out);
    const i = (y * w + x) * 4;
    d[i] = clamp(out[0]) * 255; d[i + 1] = clamp(out[1]) * 255; d[i + 2] = clamp(out[2]) * 255; d[i + 3] = clamp(out[3]) * 255;
  }
  c.putImageData(img, 0, 0);
}
const hex = s => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
// A colour ramp: stops [[t, [r, g, b]], ...], read at t into out.
function ramp(stops, t, out) {
  let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [t0, c0] = stops[i], [t1, c1] = stops[i + 1], f = clamp((t - t0) / (t1 - t0));
  out[0] = lerp(c0[0], c1[0], f); out[1] = lerp(c0[1], c1[1], f); out[2] = lerp(c0[2], c1[2], f);
  return out;
}
// About normally distributed, from the model's own random numbers.
const gauss = k => (k.rand() + k.rand() + k.rand() + k.rand() - 2) * 1.73;

/* ---------- the camera ---------- */
// A unit vector from the model towards the studio's camera, for a view { az, el } in degrees.
function camDir(k, v = {}) {
  const az = k.deg(v.az ?? 30), el = k.deg(v.el ?? 16);
  return new k.THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}
// The rotation that lines an object's axes up with the camera's: x to the right of the picture, y up it, z out of it.
function camQuat(k, v) {
  const T = k.THREE, z = camDir(k, v), x = new T.Vector3(0, 1, 0).cross(z).normalize(), y = z.clone().cross(x);
  return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
}
// A group lined up with the picture: build in it like drawing (x right, y up, z towards the viewer).
const picture = (k, v) => { const p = k.group(); p.quaternion.copy(camQuat(k, v)); return p; };
// One view for the card art and the full art alike, so whatever was built to face the camera still faces it (and the
// full art doesn't stand things up in its hero pose). Everything in this file floats.
function setView(g, v, full = {}) {
  g.userData.view = { ...v };
  g.userData.fullView = { az: v.az, el: v.el, ...full };
  g.userData.floating = true;
}

/* ---------- light ---------- */
// Round glows, white with the light in the alpha: 'soft' is a gentle haze, 'star' a hot core with a long faint skirt,
// 'dot' a small tight point, 'flare' a four-pointed twinkle, 'corona' the Sun's streaming corona (with its own colours).
const GLOW = {
  soft: r => Math.exp(-r * r * 3.4),
  star: r => .85 * Math.exp(-r * r * 90) + .4 * Math.exp(-r * r * 14) + .16 * Math.exp(-r * 3.2),
  dot: r => .75 * Math.exp(-r * r * 28) + .3 * Math.exp(-r * r * 6),
};
function glowTex(k, kind = 'soft') {
  if (kind === 'flare') return flareTex(k);
  if (kind === 'corona') return coronaTex(k);
  const S = kind === 'dot' ? 64 : 256, f = GLOW[kind];
  return k.tex(S, S, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const r = Math.hypot(u * 2 - 1, v * 2 - 1);
    o[0] = o[1] = o[2] = 1; o[3] = f(r) * smooth(1, .82, r);
  }), { cache: `space-stars:${kind}` });
}
function flareTex(k) {
  return k.tex(256, 256, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const X = u * 2 - 1, Y = v * 2 - 1, r = Math.hypot(X, Y), D = Math.SQRT1_2;
    const spike = (a, b, len, wd) => { const t = Math.abs(a) / len; return t >= 1 ? 0 : Math.exp(-((b / (wd * (1 - t * .75))) ** 2)) * (1 - t) ** 2.2; };
    o[0] = o[1] = o[2] = 1;
    o[3] = spike(X, Y, 1, .03) + spike(Y, X, 1, .03) + .35 * (spike((X + Y) * D, (X - Y) * D, .42, .022) + spike((X - Y) * D, (X + Y) * D, .42, .022))
      + .9 * Math.exp(-r * r * 80) + .22 * Math.exp(-r * r * 12);
  }), { cache: 'space-stars:flare' });
}
// A soft line across v (for ribbons that glow along their length).
const lineTex = k => k.tex(16, 64, (c, w, h) => pixels(c, w, h, (u, v, o) => { const x = v * 2 - 1; o[0] = o[1] = o[2] = 1; o[3] = (1 - x * x) ** 2 * (.55 * Math.exp(-x * x * 4) + .5 * Math.exp(-x * x * 30)); }), { cache: 'space-stars:line' });
// A glow that always faces the camera, added onto whatever is behind it. Sprites don't count when the studio frames the model.
function halo(k, r, color, opacity = .5, kind = 'soft', p = [0, 0, 0], o = {}) {
  const T = k.THREE, s = new T.Sprite(new T.SpriteMaterial({ map: glowTex(k, kind), color: k.color(color), transparent: true, opacity,
    depthWrite: false, blending: T.AdditiveBlending, rotation: o.rot ?? 0 }));
  s.scale.set(r * 2 * (o.sx ?? 1), r * 2 * (o.sy ?? 1), 1); s.position.set(p[0], p[1], p[2]);
  if (o.order != null) s.renderOrder = o.order;
  return s;
}
// A see-through surface that adds its light onto the picture.
const addMat = (k, o = {}) => new k.THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: k.THREE.AdditiveBlending, side: k.THREE.DoubleSide, ...o });
// Lots of little glowing points in one draw call: squares turned to face the camera (q: that rotation in the parent's
// space), each a soft round glow. list: [{ p, s, color }]. They do count when the studio frames the model.
function dots(k, list, q, o = {}) {
  const T = k.THREE, e = new T.Euler().setFromQuaternion(q), r = [e.x, e.y, e.z];
  const mat = new T.MeshBasicMaterial({ map: glowTex(k, o.kind ?? 'dot'), transparent: true, depthWrite: false, blending: T.AdditiveBlending });
  const m = k.instances(k.plane(1, 1), mat, list.map(d => ({ p: d.p, r, s: d.s, color: d.color ?? '#ffffff' })));
  m.castShadow = m.receiveShadow = false;
  return m;
}

/* ---------- geometry ---------- */
// Give vertices that share a position one shared normal, so seams don't show (after wings.js).
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
// A soft body along a curve (after wings.js): prof(t, P) is the radius at t ∈ [0, 1], or { w, h, b }: the half-width,
// and the height above and depth below the curve, with o.up as up.
function softBody(k, curve, prof, o = {}) {
  const T = k.THREE, seg = o.seg ?? 96, rs = o.rs ?? 28, up = new T.Vector3(...(o.up ?? [0, 1, 0])).normalize();
  const pos = [], uv = [], idx = [], P = new T.Vector3(), D = new T.Vector3(), S = new T.Vector3(), U = new T.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    curve.getPointAt(t, P); curve.getTangentAt(t, D);
    S.crossVectors(D, up); if (S.lengthSq() < 1e-10) S.set(0, 0, 1); S.normalize(); U.crossVectors(S, D).normalize();
    let p = prof(t, P); if (typeof p === 'number') p = { w: p, h: p, b: p };
    for (let j = 0; j <= rs; j++) {
      const a = j / rs * TAU, ca = Math.cos(a), sa = Math.sin(a), r = ca >= 0 ? p.h : p.b;
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
// A strip of quads along t ∈ [0, 1]: at(t) → [P, W] (Vector3s: the middle, and half the width across). u runs along
// the strip, v across it (0 at P − W). Rings, ribbons, beams and trails are all strips.
function strip(k, at, n = 64, m = 1) {
  const T = k.THREE, pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, [P, W] = at(t);
    for (let j = 0; j <= m; j++) { const s = j / m * 2 - 1; pos.push(P.x + W.x * s, P.y + W.y * s, P.z + W.z * s); uv.push(t, j / m); }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = i * (m + 1) + j, b = a + 1, c = a + m + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// A flat ring (or part of one) in the xy plane: from angle a0 to a1 (radians, from +x towards +y), inner radius r0(t)
// and width wd(t) (numbers or functions of t along it). u follows the angle, v runs from the inner edge out.
const arcRing = (k, a0, a1, r0, wd, n = 128, m = 6) => strip(k, t => {
  const a = lerp(a0, a1, t), c = Math.cos(a), s = Math.sin(a), ri = typeof r0 === 'function' ? r0(t) : r0, w = typeof wd === 'function' ? wd(t) : wd;
  return [new k.THREE.Vector3(c, s, 0).multiplyScalar(ri + w / 2), new k.THREE.Vector3(c, s, 0).multiplyScalar(w / 2)];
}, n, m);
// Squeeze a geometry's texture coordinates into [u0, u1] × [v0, v1] (to show part of a texture on a strip).
function remapUV(geo, u0, u1, v0 = 0, v1 = 1) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(u0, u1, uv.getX(i)), lerp(v0, v1, uv.getY(i))); return geo; }
// A soft glowing line along a 3D path: a ribbon turned to face the camera (view: towards the camera, in the same space).
function glowLine(k, pts, width, view, n = 48) {
  const T = k.THREE, curve = curveOf(k, pts);
  return strip(k, t => {
    const P = curve.getPointAt(t), D = curve.getTangentAt(t), w = typeof width === 'function' ? width(t) : width;
    return [P, new T.Vector3().crossVectors(D, view).normalize().multiplyScalar(w / 2)];
  }, n);
}
// A thin rod from A to B (Vector3s), as a geometry to merge with others.
function rodGeo(k, A, B, r, seg = 8) {
  const T = k.THREE, D = B.clone().sub(A), geo = k.cyl(r, r, D.length(), { seg });
  geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), D.clone().normalize()));
  const M = A.clone().addScaledVector(D, .5); geo.translate(M.x, M.y, M.z);
  return geo;
}
// A star's outline with rounded corners: n points of radius R, inner corners at radius r; round: how far back from each
// point the rounding starts (a fraction of R; the inner corners round half as much). Anticlockwise from the top point.
function starOutline(R, r, round = .14, n = 5, per = 8) {
  const V = [];
  for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r : R; V.push([Math.cos(a) * q, Math.sin(a) * q]); }
  const out = [], N = V.length, d = i => R * round * (i % 2 ? .5 : 1);
  V.forEach((C, i) => {
    const P = V[(i + N - 1) % N], Q = V[(i + 1) % N], lp = Math.hypot(P[0] - C[0], P[1] - C[1]), lq = Math.hypot(Q[0] - C[0], Q[1] - C[1]);
    const A = [C[0] + (P[0] - C[0]) / lp * d(i), C[1] + (P[1] - C[1]) / lp * d(i)], B = [C[0] + (Q[0] - C[0]) / lq * d(i), C[1] + (Q[1] - C[1]) / lq * d(i)];
    for (let j = 0; j < per; j++) { const t = j / per, s = 1 - t; out.push([s * s * A[0] + 2 * s * t * C[0] + t * t * B[0], s * s * A[1] + 2 * s * t * C[1] + t * t * B[1]]); }
    const E = [Q[0] + (C[0] - Q[0]) / lq * d(i + 1), Q[1] + (C[1] - Q[1]) / lq * d(i + 1)];
    for (let j = 0; j < 4; j++) out.push([lerp(B[0], E[0], j / 4), lerp(B[1], E[1], j / 4)]);
  });
  return out;
}
// A puffy sticker: an outline (star-shaped round the origin, anticlockwise) blown up into a pillow facing +z, H high in
// the middle, with a shallower dome (back deep) behind.
function pillow(k, outline, H, back = H * .25, rings = 14) {
  const T = k.THREE, n = outline.length, m = n + 1, prof = [], pos = [], idx = [];
  for (let i = 0; i <= rings; i++) { const a = i / rings * Math.PI / 2; prof.push([Math.sin(a), H * Math.cos(a)]); }
  const rb = Math.max(2, rings >> 1);
  for (let i = 1; i <= rb; i++) { const a = Math.PI / 2 + i / rb * Math.PI / 2; prof.push([Math.sin(a), back * Math.cos(a)]); }
  for (const [s, z] of prof) for (let j = 0; j <= n; j++) { const [x, y] = outline[j % n]; pos.push(x * s, y * s, z); }
  for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < n; j++) { const a = i * m + j, b = a + 1, c = a + m, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return weld(geo);
}

/* ---------- painted textures ---------- */
// The shooting star's trail: u along it (0 at the star), v across. 'soft' is the wide coloured haze with a few speed
// streaks in it, 'core' the narrow white-hot streak down its middle.
function trailTex(k, kind) {
  const SOFT = [[0, hex('#fffbe8')], [.12, hex('#ffe38a')], [.34, hex('#ffac66')], [.6, hex('#ff78b4')], [1, hex('#9c7dff')]];
  const CORE = [[0, hex('#ffffff')], [.25, hex('#fff2b8')], [.6, hex('#ffc678')], [1, hex('#ff9a7a')]];
  const R = rng(kind === 'soft' ? 71 : 72), lines = [];
  for (let i = 0; i < 9; i++) lines.push([.5 + (R() - .5) * .62, .008 + R() * .012, .2 + R() * .5, R() * 9]);
  return k.tex(512, 64, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const x = v - .5;
    if (kind === 'core') {
      ramp(CORE, u, o); o[3] = Math.pow(1 - u, 1.5) * Math.exp(-((x / .15) ** 2)) * smooth(.5, .42, Math.abs(x));
      return;
    }
    let a = Math.pow(1 - u, .9) * Math.exp(-((x / (.2 + .1 * u)) ** 2));
    for (const [lv, lw, la, ph] of lines) a += la * Math.pow(1 - u, 1.3) * Math.exp(-(((v - lv) / lw) ** 2)) * (.45 + .55 * noise(u * 9 + ph, lv * 7, 3));
    ramp(SOFT, u, o); o[3] = a * smooth(.5, .4, Math.abs(x));
  }), { cache: `space-stars:trail-${kind}` });
}
// A seeded random source for painting (painted canvases are cached, so painting mustn't use up the model's k.rand()).
function rng(seed) { return () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// A pulsar's beam: u along it (0 at the star), v across: a hot white core in a wider blue cone, fading out along it.
function beamTex(k) {
  const BEAM = [[0, [.3, .45, 1]], [.45, [.55, .85, 1]], [1, [1, 1, 1]]];
  return k.tex(256, 64, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const x = v * 2 - 1, along = Math.pow(1 - u, .65) * smooth(0, .04, u) * smooth(1, .8, u), edge = Math.pow(1 - x * x, 1.5);
    const I = along * edge * (.5 + .45 * Math.exp(-x * x * 10) + .7 * Math.exp(-x * x * 160) * (1 - u * .6));
    ramp(BEAM, clamp(I * 1.1), o); o[3] = clamp(I * .95);
  }), { cache: 'space-stars:beam' });
}
// The accretion disk: u round it, v from the inner edge (0) out. White-hot at the inner edge, cooling through orange to
// a dull red at the rim, in streaks that wind outwards; the side coming towards us (the left) is a little brighter.
function diskTex(k) {
  const HOT = [[0, hex('#6a1804')], [.16, hex('#c6461a')], [.38, hex('#ff8c32')], [.62, hex('#ffcf85')], [.85, hex('#fff3dc')], [1, hex('#ffffff')]];
  return k.tex(1024, 256, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const a = u * TAU + v * 2.2;
    // fine rings of gas that wander slowly round the disk, and a few bigger clumps
    const fine = fbm(Math.cos(a) * 1.6, Math.sin(a) * 1.6, v * 34, 4), clumps = fbm(Math.cos(a) * 5, Math.sin(a) * 5, v * 7, 2);
    const streaks = clamp(.5 + 1.9 * (fine - .5) + .8 * (clumps - .5));
    const radial = smooth(0, .03, v) * Math.pow(1 - v, 1.35) * (1 + 1.1 * Math.exp(-v / .12));
    const I = radial * (.4 + .85 * streaks) * (1 + .38 * Math.cos(u * TAU - Math.PI));
    ramp(HOT, clamp(I * .8), o); o[3] = clamp(I * 1.35);
  }), { cache: 'space-stars:disk' });
}
// The Sun's corona round a disc of radius .4 (of the sprite's half-size): bright at the limb, streaming out in rays.
function coronaTex(k) {
  const COR = [[0, [1, .98, .88]], [.25, [1, .84, .5]], [1, [1, .55, .22]]];
  return k.tex(512, 512, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const X = u * 2 - 1, Y = v * 2 - 1, r = Math.hypot(X, Y), a = Math.atan2(Y, X), x = r - .4;
    if (x < 0) { o[0] = 1; o[1] = .95; o[2] = .8; o[3] = 1; return; }
    const st = fbm(Math.cos(a) * 4, Math.sin(a) * 4, r * 1.2, 3), rays = lerp(1, .35 + 2.6 * st * st, smooth(0, .2, x));
    ramp(COR, clamp(x / .4), o); o[3] = clamp((.9 * Math.exp(-x / .04) + .4 * Math.exp(-x / .15)) * rays * smooth(1, .72, r));
  }), { cache: 'space-stars:corona' });
}
// The Sun's face, painted from points on the sphere: granules (bright cells in dark lanes), a mottled large-scale
// brightness, sunspots with dark umbrae in streaky penumbrae, and bright faculae round them. spots: [[x, y, z], radius].
function sunTex(k, spots) {
  const GRAN = [[0, hex('#a83a08')], [.4, hex('#e8781a')], [.75, hex('#ffb534')], [1, hex('#ffe07a')]];
  const S = spots.map(([d, r], i) => {
    const e1 = norm(cross(d, [0, 1, 0])), e2 = cross(d, e1);
    return { d, r, e1, e2, i };
  });
  return k.tex(1024, 512, (c, w, h) => {
    // one jittered feature point per cell of a 3D grid (the granules), with a brightness each
    const F = 30, off = F + 2, N = off * 2 + 1, fp = new Float32Array(N * N * N * 4);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let l = 0; l < N; l++) {
      const q = ((i * N + j) * N + l) * 4;
      fp[q] = i + hash(i, j, l); fp[q + 1] = j + hash(j + 91, l, i); fp[q + 2] = l + hash(l + 37, i, j + 5); fp[q + 3] = hash(i + 7, j + 3, l + 11);
    }
    pixels(c, w, h, (u, v, o) => {
      const th = (1 - v) * Math.PI, ph = u * TAU, st = Math.sin(th), x = -Math.cos(ph) * st, y = Math.cos(th), z = Math.sin(ph) * st;
      const X = x * F + off, Y = y * F + off, Z = z * F + off, xi = Math.floor(X), yi = Math.floor(Y), zi = Math.floor(Z);
      let f1 = 9, f2 = 9, cb = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) {
        const q = (((xi + a) * N + (yi + b)) * N + (zi + e)) * 4, dx = fp[q] - X, dy = fp[q + 1] - Y, dz = fp[q + 2] - Z, dd = dx * dx + dy * dy + dz * dz;
        if (dd < f1) { f2 = f1; f1 = dd; cb = fp[q + 3]; } else if (dd < f2) f2 = dd;
      }
      const lane = Math.pow(smooth(-.02, .55, Math.sqrt(f2) - Math.sqrt(f1)), .8), mott = fbm(x * 3.2, y * 3.2, z * 3.2, 2);
      let t = lane * (.62 + .3 * cb) * (.8 + .5 * (mott - .5)) + .2;
      // faculae and spots
      let um = 0, pen = 0, fac = 0, fil = 0;
      for (const s of S) {
        const dot = x * s.d[0] + y * s.d[1] + z * s.d[2]; if (dot < .8) continue;
        const dist = Math.acos(Math.min(1, dot)), px = x * s.e1[0] + y * s.e1[1] + z * s.e1[2], py = x * s.e2[0] + y * s.e2[1] + z * s.e2[2], ang = Math.atan2(py, px);
        const rr = s.r * (1 + .22 * (noise(Math.cos(ang) * 2 + s.i * 5, Math.sin(ang) * 2, s.i) - .5));
        um = Math.max(um, smooth(rr * .5, rr * .38, dist));
        pen = Math.max(pen, smooth(rr * 1.02, rr * .9, dist));
        fac = Math.max(fac, smooth(rr * 3.2, rr * 1.2, dist) * (1 - smooth(rr * 1.1, rr * .95, dist)));
        fil = Math.max(fil, (.5 + .5 * Math.sin(ang * 46 + 4 * noise(ang * 3, dist * 40, s.i))) * smooth(rr * 1.02, rr * .9, dist));
      }
      t = Math.min(1.1, t + .22 * fac * (.5 + mott));
      ramp(GRAN, t, o);
      if (pen > 0) {
        const pc = [.62 + .12 * fil, .26 + .08 * fil, .06], uc = [.2, .06, .02];
        for (let i = 0; i < 3; i++) o[i] = lerp(lerp(o[i], pc[i], pen), uc[i], um);
      }
    });
  }, { cache: 'space-stars:sun' });
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// The spiral galaxy's disk of light, in disk units (the rim at radius 1): two log-spiral arms of young blue-white stars
// over an older golden disk, a bright core, clumps, and dark dust lanes along the arms' inner edges.
const ARM_B = Math.tan(16 * Math.PI / 180), ARM_R0 = .1;
// The angle of arm i (0 or 1) at radius r: a log spiral, wobbling a little so it doesn't look drawn with a compass.
const armAngle = (r, i = 0) => Math.log(Math.max(r, .02) / ARM_R0) / ARM_B + i * Math.PI + .13 * Math.sin(r * 7.3 + i * 2.1) + .06 * Math.sin(r * 15.1 + i * 4.4);
// How much arm, and how much dust lane, there is at (X, Y), both about 0..1: the lanes run along the arms' inner edges.
function spiralAt(X, Y) {
  const r = Math.hypot(X, Y), ph = Math.atan2(Y, X), fade = smooth(.07, .2, r);
  let arm = 0, dust = 0;
  for (const i of [0, 1]) {
    const dp = ((ph - armAngle(r, i)) % TAU + TAU * 2 + Math.PI) % TAU - Math.PI, dist = dp * r;
    arm += Math.exp(-((dist / (.06 + .09 * r)) ** 2));
    dust += Math.exp(-(((dist - (.065 + .05 * r)) / (.03 + .04 * r)) ** 2));
  }
  return [arm * fade, clamp(dust) * fade];
}
function galaxyTex(k) {
  const GOLD = hex('#ffd89a'), BLUE = hex('#b4ccff'), CORE = hex('#fff1cf');
  return k.tex(512, 512, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const X = u * 2 - 1, Y = v * 2 - 1, r = Math.hypot(X, Y);
    if (r > 1) { o[3] = 0; return; }
    const [a, dust] = spiralAt(X, Y), n = fbm(X * 9, Y * 9, 2.5, 3), m = fbm(X * 26, Y * 26, 4.5, 2);
    const disk = Math.exp(-r / .3) * smooth(1, .7, r), arms = a * (.2 + 1.9 * n * n) * (.6 + .7 * m) * Math.exp(-r / .7) * smooth(1, .75, r);
    let I = .5 * disk + 1.9 * arms + 1.4 * Math.exp(-((r / .1) ** 2));
    I *= 1 - .85 * dust * smooth(.95, .45, r) * (.6 + .6 * n);
    const blue = clamp(a * 1.3) * smooth(.12, .4, r), core = Math.exp(-((r / .12) ** 2));
    for (let i = 0; i < 3; i++) o[i] = lerp(lerp(GOLD[i], BLUE[i], blue), CORE[i], core);
    o[3] = clamp(I * 1.05);
  }), { cache: 'space-stars:galaxy' });
}
// The dust lanes on their own, dark and see-through, to lay over the galaxy's light (and its stars) like real dust.
function dustTex(k) {
  return k.tex(512, 512, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const X = u * 2 - 1, Y = v * 2 - 1, r = Math.hypot(X, Y);
    if (r > .98) { o[3] = 0; return; }
    // feathery: broken up by noise at two scales
    const [, dust] = spiralAt(X, Y), n = fbm(X * 8, Y * 8, 7.5, 3), f = fbm(X * 30, Y * 30, 1.5, 2);
    o[0] = .28; o[1] = .15; o[2] = .09; o[3] = clamp(dust * smooth(.95, .3, r) * smooth(.28, .66, n) * (.35 + .9 * f) * .72);
  }), { cache: 'space-stars:dust' });
}

export default {
  // A little constellation of glow-in-the-dark ceiling stickers: puffy stars of different sizes and a crescent moon in
  // pale luminous yellow-green, each wrapped in a soft glow.
  glowstars(k) {
    const g = k.group(), v = { az: 26, el: 16 };
    setView(g, v);
    // the stickers lie in a sheet facing the camera, tipped back and turned a little so their puff shows
    const sheet = k.group(); sheet.quaternion.copy(camQuat(k, { az: v.az - 18, el: v.el + 22 })); g.add(sheet);
    const lum = k.mat({ color: '#e8f8b8', emissive: '#a2f06c', emissiveIntensity: .95, roughness: .48, clearcoat: .35, clearcoatRoughness: .3 });
    const HALO = '#98ff66';
    // x, y, outer radius, turn (degrees)
    const STARS = [[.15, .05, 1, 6], [1.72, 1.02, .56, -16], [1.9, -.86, .42, 22], [-.9, -1.08, .36, -10], [.78, -1.34, .24, 30], [-.28, 1.38, .22, 14], [2.55, .12, .17, -4]];
    for (const [x, y, R, turn] of STARS) {
      sheet.add(k.mesh(pillow(k, starOutline(R, R * .48, .16), R * .34, R * .1), lum, { p: [x, y, k.range(-.1, .1)], r: [k.range(-.12, .12), k.range(-.12, .12), k.deg(turn)], shadow: false }));
      sheet.add(halo(k, R * 2.6, HALO, .42, 'soft', [x, y, -R * .4]));
    }
    // the crescent moon, horns to the right
    const arc = [];
    for (let i = 0; i <= 24; i++) { const a = k.deg(62 + 236 * i / 24); arc.push([.2 + Math.cos(a) * .66, Math.sin(a) * .66, 0]); }
    const moon = softBody(k, curveOf(k, arc), t => { const f = Math.pow(Math.sin(Math.PI * t), .7) * ends(t, .05); return { w: .34 * f + .004, h: .3 * f + .004, b: .08 * f + .003 }; }, { seg: 96, rs: 24, up: [0, 0, 1] });
    const mp = [-1.8, .38];
    sheet.add(k.mesh(moon, lum, { p: [mp[0], mp[1], 0], r: [0, 0, k.deg(-14)], shadow: false }));
    for (const t of [.2, .5, .8]) { const a = k.deg(62 + 236 * t - 14); sheet.add(halo(k, .8, HALO, .22, 'soft', [mp[0] + Math.cos(a) * .6, mp[1] + Math.sin(a) * .6, -.3])); }
    return g;
  },

  // A shooting star: a bright five-pointed star streaking up to the right, trailing a long, tapering tail of sparkles.
  shootingstar(k) {
    const T = k.THREE, g = k.group(), v = { az: 30, el: 16 };
    setView(g, v);
    const pic = picture(k, v); g.add(pic);
    // the streak: from the star (t = 0, top right) back to the lower left, bowing up a little
    const H = [1.4, .95], E = [-2.5, -1.45], dx = E[0] - H[0], dy = E[1] - H[1], len = Math.hypot(dx, dy), nx = dy / len, ny = -dx / len;
    const path = t => [H[0] + dx * t + nx * Math.sin(Math.PI * t) * .22, H[1] + dy * t + ny * Math.sin(Math.PI * t) * .22];
    const across = t => { const [x0, y0] = path(Math.max(0, t - .002)), [x1, y1] = path(Math.min(1, t + .002)), l = Math.hypot(x1 - x0, y1 - y0); return [-(y1 - y0) / l, (x1 - x0) / l]; };
    const trail = (w, z) => strip(k, t => { const [x, y] = path(t), [ax, ay] = across(t), hw = w(t) / 2; return [new T.Vector3(x, y, z), new T.Vector3(ax * hw, ay * hw, 0)]; }, 96, 4);
    pic.add(k.mesh(trail(t => .16 + 1.0 * Math.pow(1 - t, .8), -.25), addMat(k, { map: trailTex(k, 'soft') }), { shadow: false }));
    pic.add(k.mesh(trail(t => .06 + .4 * Math.pow(1 - t, 1.1), -.2), addMat(k, { map: trailTex(k, 'core') }), { shadow: false }));
    // sparkles strung out along the tail, thinning and cooling towards its end
    const COLS = ['#fffaf0', '#ffe9a8', '#ffd08a', '#ffb0c8', '#e0b8ff', '#bfe4ff'], list = [];
    for (let i = 0; i < 230; i++) {
      const t = .04 + .95 * Math.pow(k.rand(), 1.2), [x, y] = path(t), [ax, ay] = across(t), off = gauss(k) * (.14 + .26 * (1 - t) + .14 * t);
      const s = (.04 + .12 * (1 - t)) * k.range(.5, 1.25) * (k.rand() < .08 ? 1.8 : 1);
      list.push({ p: [x + ax * off, y + ay * off, k.range(-.2, .15)], s, color: COLS[Math.min(COLS.length - 1, Math.floor(t * 4 + k.rand() * 2))] });
    }
    pic.add(dots(k, list, new T.Quaternion()));
    for (const [t, off, s, rot] of [[.15, .36, .5, .2], [.28, -.4, .38, .6], [.44, .34, .32, .1], [.6, -.26, .26, .5], [.76, .2, .22, .3], [.9, -.1, .16, .7]]) {
      const [x, y] = path(t), [ax, ay] = across(t);
      pic.add(halo(k, s, '#fff6dc', .85, 'flare', [x + ax * off, y + ay * off, .1], { rot }));
    }
    // the star itself: puffy and golden, glowing from inside, one point leading the way
    const starM = k.mat({ color: '#ffdc6a', emissive: '#ffc02a', emissiveIntensity: 1.05, roughness: .28, clearcoat: 1, clearcoatRoughness: .08 });
    pic.add(k.mesh(pillow(k, starOutline(.64, .3, .15), .26, .08), starM, { p: [H[0], H[1], .05], r: [k.deg(-16), k.deg(24), k.deg(14)], shadow: false }));
    pic.add(halo(k, 1.3, '#ffe08a', .8, 'star', [H[0], H[1], -.3]), halo(k, 2.4, '#ffa860', .28, 'soft', [H[0], H[1], -.35]), halo(k, 1.2, '#fffaf0', .9, 'flare', [H[0], H[1], -.28], { rot: .12 }));
    pic.add(halo(k, .62, '#fff2c0', .3, 'soft', [H[0], H[1], .5]));   // a bloom over the star itself: it's too bright to see crisply
    return g;
  },

  // The Big Dipper: its seven stars as glowing balls, each its own size and colour and at its own distance, joined by
  // thin glowing lines. Mizar has its faint companion Alcor riding beside it.
  constellation(k) {
    const T = k.THREE, g = k.group(), v = { az: 26, el: 14, lift: -.2 };
    setView(g, v, { lift: -.2 });
    // the sky faces a little to the left of and above the camera, so the stars' different distances show
    const sky = k.group(); sky.quaternion.copy(camQuat(k, { az: v.az - 14, el: v.el + 8 })); g.add(sky);
    const inv = sky.quaternion.clone().invert(), view = camDir(k, v).applyQuaternion(inv);
    // x, y as seen on the sky (a gnomonic projection, degrees / 4, east to the left), distance (light-years), magnitude, colour
    const STARS = [
      [2.5, 1.98, 123, 1.79, '#ffb766'],    // Dubhe, an orange giant, the farthest
      [2.98, .69, 80, 2.37, '#dce8ff'],     // Merak
      [1.27, -.38, 84, 2.44, '#eef2ff'],    // Phecda
      [.43, .39, 81, 3.31, '#fff1d8'],      // Megrez, the faintest
      [-.9, .16, 83, 1.77, '#e4edff'],      // Alioth, the brightest
      [-2, .06, 83, 2.23, '#edf2ff'],       // Mizar
      [-3.26, -1.12, 104, 1.86, '#9fc0ff'], // Alkaid, hot and blue
    ];
    const pos = [], rad = [];
    const star = (P, r, c, f) => {
      sky.add(k.mesh(k.sphere(r, { w: 24, h: 16 }), new T.MeshBasicMaterial({ color: k.color('#ffffff').lerp(k.color(c), .45) }), { p: P.toArray(), shadow: false }));
      sky.add(halo(k, r * 6, c, .95, 'star', P.clone().addScaledVector(view, r * 1.5).toArray()), halo(k, r * 11, c, .25, 'soft', P.toArray()));
      if (f > .6) sky.add(halo(k, r * 8, '#ffffff', .55, 'flare', P.clone().addScaledVector(view, r * 1.5).toArray(), { rot: k.range(-.3, .3) }));
    };
    const tip = k.deg(8), c8 = Math.cos(tip), s8 = Math.sin(tip);   // turned a little, to sit on a diagonal in the frame
    for (const [x, y, d, m, c] of STARS) {
      const f = Math.pow(10, -.4 * (m - 1.77)), r = .05 + .08 * Math.sqrt(f), P = new T.Vector3(x * c8 - y * s8, x * s8 + y * c8, -(d - 82) * .06 + k.range(-.2, .2));
      pos.push(P); rad.push(r); star(P, r, c, f);
    }
    star(pos[5].clone().add(new T.Vector3(-.16, .24, .05)), .042, '#fff4e8', .1);   // Alcor (really much closer in)
    // the lines: Alkaid–Mizar–Alioth–Megrez, then round the bowl
    const core = [], glow = [];
    for (const [a, b] of [[6, 5], [5, 4], [4, 3], [3, 0], [0, 1], [1, 2], [2, 3]]) {
      const A = pos[a], B = pos[b], D = B.clone().sub(A).normalize(), p0 = A.clone().addScaledVector(D, rad[a] * 2.2), p1 = B.clone().addScaledVector(D, -rad[b] * 2.2);
      core.push(rodGeo(k, p0, p1, .011));
      glow.push(glowLine(k, [p0.toArray(), p1.toArray()], .1, view, 2));
    }
    sky.add(k.mesh(k.merge(core), new T.MeshBasicMaterial({ color: '#c4d8ff' }), { shadow: false }));
    sky.add(k.mesh(k.merge(glow), addMat(k, { map: lineTex(k), color: '#7ea8ff', opacity: .55 }), { shadow: false }));
    return g;
  },

  // A pulsar: a tiny, blinding neutron star throwing two cones of light out of its magnetic poles, caged in glowing loops
  // of magnetic field.
  pulsar(k) {
    const T = k.THREE, g = k.group(), v = { az: 30, el: 16, lift: -.1 };
    setView(g, v, { lift: -.06 });
    const pic = picture(k, v); g.add(pic);
    const Z = new T.Vector3(0, 0, 1), Rn = .24;
    // the magnetic axis, well off the spin axis: the beams shine out along it, one up to the right, one down to the left
    const M = new T.Vector3(.8, .5, .33).normalize();
    pic.add(k.mesh(k.sphere(Rn, { w: 32, h: 24 }), new T.MeshBasicMaterial({ color: '#f4faff' }), { shadow: false }));
    pic.add(halo(k, .8, '#ffffff', 1, 'star', [0, 0, .4]), halo(k, 1.7, '#8fd0ff', .55, 'soft', [0, 0, -.3]), halo(k, 3.4, '#7064ff', .25, 'soft', [0, 0, -.4]), halo(k, 2.1, '#e8f6ff', .9, 'flare', [0, 0, .45], { rot: .38 }));
    // the beams: soft cones of light from both poles
    const bm = addMat(k, { map: beamTex(k) });
    for (const s of [1, -1]) {
      const A = M.clone().multiplyScalar(s), W = new T.Vector3().crossVectors(A, Z).normalize(), L = 3.3;
      pic.add(k.mesh(strip(k, t => [A.clone().multiplyScalar(t * L), W.clone().multiplyScalar(.12 + t * L * Math.tan(k.deg(14)))], 32, 6), bm, { shadow: false }));
    }
    // magnetic field loops: dipole lines, r = L sin²θ round the magnetic axis
    const e1 = new T.Vector3().crossVectors(M, Z).normalize(), e2 = new T.Vector3().crossVectors(M, e1), cores = [], glows = [];
    for (const [L, n, ph] of [[1.05, 6, .3], [1.8, 6, .8]]) for (let i = 0; i < n; i++) {
      const phi = ph + i / n * TAU, out = e1.clone().multiplyScalar(Math.cos(phi)).addScaledVector(e2, Math.sin(phi)), th0 = Math.asin(Math.sqrt(Rn / L)), pts = [];
      for (let j = 0; j <= 32; j++) { const th = lerp(th0, Math.PI - th0, j / 32), r = L * Math.sin(th) ** 2; pts.push(M.clone().multiplyScalar(r * Math.cos(th)).addScaledVector(out, r * Math.sin(th)).toArray()); }
      cores.push(k.tube(pts, .012, { seg: 64, rs: 6 }));
      glows.push(glowLine(k, pts, .12, Z, 64));
    }
    pic.add(k.mesh(k.merge(cores), new T.MeshBasicMaterial({ color: '#e6d2ff' }), { shadow: false }));
    pic.add(k.mesh(k.merge(glows), addMat(k, { map: lineTex(k), color: '#a55cff', opacity: .85 }), { shadow: false }));
    return g;
  },

  // The Sun: a big glowing ball with a boiling, granulated face, darker sunspots, loops of glowing gas standing off its
  // edge and a soft corona streaming out round it.
  sun(k) {
    const T = k.THREE, g = k.group(), v = { az: 30, el: 16 };
    setView(g, v);
    const d = camDir(k, v), q = camQuat(k, v), X = new T.Vector3(1, 0, 0).applyQuaternion(q), Y = new T.Vector3(0, 1, 0).applyQuaternion(q);
    // a point on the surface: lon degrees round from the middle of the face we see, lat up from the equator
    const at = (lon, lat) => [Math.sin(k.deg(v.az + lon)) * Math.cos(k.deg(lat)), Math.sin(k.deg(lat)), Math.cos(k.deg(v.az + lon)) * Math.cos(k.deg(lat))];
    const SPOTS = [[at(-24, 18), .075], [at(-15, 15), .035], [at(-10, 21), .022], [at(26, -10), .06], [at(33, -8), .03], [at(-50, -20), .032], [at(8, 34), .018]];
    const geo = k.sphere(1, { w: 128, h: 80 }), P = geo.attributes.position, col = [];
    for (let i = 0; i < P.count; i++) {   // limb darkening: dimmer and redder towards the edge we see
      const e = 1 - Math.max(0, P.getX(i) * d.x + P.getY(i) * d.y + P.getZ(i) * d.z);
      col.push(1 - .45 * e, 1 - .62 * e, 1 - .8 * e);
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.add(k.mesh(geo, new T.MeshBasicMaterial({ map: sunTex(k, SPOTS), vertexColors: true, color: new T.Color(1.42, 1.42, 1.42) }), { shadow: false }));
    // prominences: arches of glowing gas standing up off the limb, each a loop with a lower one inside it
    const strands = [], cores = [], glows = [];
    for (const [ang, spread, height, tw] of [[128, 12, .36, 0], [22, 8, .24, 2], [232, 6, .15, 4]]) {
      for (let s = 0; s < 2; s++) {   // a loop and a lower one nested inside it
        const pts = [], H = height * (1 - .32 * s), S = spread * (1 - .3 * s);
        for (let i = 0; i <= 28; i++) {
          const t = i / 28, a = k.deg(ang - S + 2 * S * t), h = H * Math.pow(Math.sin(Math.PI * t), .75) * (1 + .06 * Math.sin(t * 7 + tw));
          pts.push(X.clone().multiplyScalar(Math.cos(a)).addScaledVector(Y, Math.sin(a)).multiplyScalar(1 + h).addScaledVector(d, -.04 + .03 * Math.cos(t * 5 + s)).toArray());
        }
        const wd = t => (.008 + .022 * Math.pow(Math.sin(Math.PI * t), .5)) * (.7 + height) * (1 - .25 * s);
        strands.push(softBody(k, curveOf(k, pts), wd, { seg: 48, rs: 10, up: d.toArray() }));
        cores.push(glowLine(k, pts.map(p => new T.Vector3(...p).addScaledVector(d, .06).toArray()), t => wd(t) * 1.3, d, 48));
        glows.push(glowLine(k, pts, .2 * (.7 + height) * (1 - .3 * s), d, 48));
      }
    }
    // deep orange strands with hot yellow hearts and a red glow, drawn after the corona so its light doesn't bleach them
    const promo = [
      k.mesh(k.merge(strands), new T.MeshBasicMaterial({ color: '#ff6a2c', transparent: true, opacity: .9 }), { shadow: false }),
      k.mesh(k.merge(cores), addMat(k, { map: lineTex(k), color: '#ffc46a', opacity: .9 }), { shadow: false }),
      k.mesh(k.merge(glows), addMat(k, { map: lineTex(k), color: '#ff4418', opacity: .8 }), { shadow: false }),
    ];
    promo.forEach((m, i) => { m.renderOrder = 1 + i; g.add(m); });
    // a solar flare going off by the big spot group
    const fl = new T.Vector3(...at(-19, 12)).multiplyScalar(1.03);
    g.add(halo(k, .22, '#fff8e0', .9, 'star', fl.toArray()), halo(k, .32, '#fffbe8', .8, 'flare', fl.clone().addScaledVector(d, .05).toArray(), { rot: .2 }));
    // the corona, and a warm haze round everything
    g.add(halo(k, 2.5, '#ffffff', .95, 'corona', d.clone().multiplyScalar(-.2).toArray()), halo(k, 3.4, '#ff8a2a', .3, 'soft', d.clone().multiplyScalar(-.3).toArray()));
    // leave room for the corona in the picture: an invisible ring for the studio to frame
    const frame = k.mesh(k.ring(1.32, 1.34, 64), new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), { shadow: false }); frame.quaternion.copy(q); g.add(frame);
    return g;
  },

  // A black hole: a pitch-black shadow ringed by a thin, blazing photon ring, a nearly edge-on accretion disk crossing in
  // front of it, and the far side of the disk bent up over the top (and under the bottom) by its gravity.
  blackhole(k) {
    // a long lens (a narrow fov) keeps the near side of the disk from swinging down over the hole in perspective
    const T = k.THREE, g = k.group(), v = { az: 30, el: 16, fov: 14, zoom: 1.08, lift: -.3 };
    setView(g, v, { fov: 14, zoom: 1.16, lift: -.28 });
    const pic = picture(k, v); g.add(pic);
    const map = diskTex(k);
    pic.add(k.mesh(k.sphere(1, { w: 64, h: 48 }), new T.MeshBasicMaterial({ color: '#000000' }), { shadow: false }));
    // the accretion disk, tipped so we look down on it a little
    const tilt = k.deg(11), r0 = 1.34, r1 = 2.95;
    pic.add(k.mesh(arcRing(k, 0, TAU, r0, r1 - r0, 256, 12), addMat(k, { map }), { r: [-Math.PI / 2 + tilt, 0, 0], shadow: false }));
    // the lensed far side of the disk: a broad band bent up over the top of the hole, meeting the disk at either side,
    // and a thinner one under it (each shows the hotter inner part of the disk's picture)
    const bump = (a, b, p = .8) => t => a + (b - a) * Math.pow(Math.sin(Math.PI * t), p);
    pic.add(k.mesh(remapUV(arcRing(k, 0, Math.PI, 1.05, bump(r0 - 1.05, .54), 128, 8), 0, .5, 0, .42), addMat(k, { map }), { p: [0, 0, -.02], shadow: false }));
    pic.add(k.mesh(remapUV(arcRing(k, Math.PI, TAU, 1.05, bump(r0 - 1.08, .1, .5), 128, 6), .5, 1, 0, .36), addMat(k, { map, opacity: .85 }), { p: [0, 0, -.02], shadow: false }));
    // the photon ring, a thin white-hot line hugging the shadow
    pic.add(k.mesh(arcRing(k, 0, TAU, .985, .085, 256, 2), addMat(k, { map: lineTex(k), color: '#ffffff' }), { shadow: false }));
    // a warm haze round it all, and a bloom along the disk (both hidden behind the shadow where they cross it)
    pic.add(halo(k, 2.5, '#ffc27a', .6, 'soft', [0, 0, -1.3]), halo(k, 4.8, '#ff7a30', .28, 'soft', [0, 0, -1.4]), halo(k, 2.4, '#ffb060', .55, 'soft', [0, 0, 0], { sx: 1.5, sy: .24 }));
    return g;
  },

  // A spiral galaxy seen from above at a slant: thousands of glowing stars wound into two blue-white arms, pink knots
  // where new stars are forming, dark lanes of dust and a bright golden bulge, with a small companion galaxy in tow.
  galaxy(k) {
    const T = k.THREE, g = k.group(), v = { az: 30, el: 50 };
    setView(g, v, { zoom: 1.1, lift: -.08 });
    const gal = k.group(); gal.rotation.set(k.deg(4), k.deg(-30), k.deg(-6)); g.add(gal);
    const q = gal.quaternion.clone().invert().multiply(camQuat(k, v));   // turns a square in gal to face the camera
    // the disk's light, lying flat (disk units: x → x, y → −z), and its dust lanes just over it. Drawing order matters
    // here: light, then the bulge's haze, then dust over both, then the stars, then the bright core on top.
    gal.add(k.mesh(k.disc(1, 96), addMat(k, { map: galaxyTex(k) }), { r: [-Math.PI / 2, 0, 0], shadow: false }));
    const dust = k.mesh(k.disc(1, 96), new T.MeshBasicMaterial({ map: dustTex(k), transparent: true, depthWrite: false, side: T.DoubleSide }), { p: [0, .004, 0], r: [-Math.PI / 2, 0, 0], shadow: false });
    dust.renderOrder = 2; gal.add(dust);
    const P = (X, Y, h = 0) => [X, h, -Y];
    const arm = (r, i) => { const th = armAngle(r, i); return [r * Math.cos(th), r * Math.sin(th)]; };
    const dim = (c, a, b) => k.color(c).multiplyScalar(k.range(a, b));
    const list = [], knots = [];
    const ARMC = ['#c4d8ff', '#9dbdff', '#e4ecff', '#ffffff', '#86aaff', '#fff4e0'];
    for (let i = 0; i < 2400; i++) {   // young stars along the arms (fewer in the dust lanes)
      const r = .12 + .86 * Math.pow(k.rand(), .8), [x, y] = arm(r, i % 2), sp = .03 + .06 * r;
      const X = x + gauss(k) * sp, Y = y + gauss(k) * sp, [, du] = spiralAt(X, Y), big = k.rand() < .05;
      if (k.rand() < du * .85) continue;
      list.push({ p: P(X, Y, gauss(k) * .012), s: k.range(.018, .03) * (big ? 2.1 : 1), color: dim(k.pick(ARMC), big ? .9 : .3, 1) });
    }
    for (let c = 0; c < 34; c++) {     // clusters of young stars, so the arms look clumpy
      const r = k.range(.25, .95), [x, y] = arm(r, c % 2), n = 8 + Math.floor(k.rand() * 14), sp = k.range(.012, .025);
      for (let i = 0; i < n; i++) list.push({ p: P(x + gauss(k) * sp, y + gauss(k) * sp, gauss(k) * .008), s: k.range(.018, .032), color: dim(k.pick(ARMC), .5, 1) });
    }
    for (let i = 0; i < 1000; i++) {   // older stars all through the disk
      const r = Math.min(.97, -.3 * Math.log(1 - k.rand() * .96)), a = k.rand() * TAU;
      list.push({ p: P(r * Math.cos(a), r * Math.sin(a), gauss(k) * .015), s: k.range(.014, .024), color: dim(k.pick(['#fff1d6', '#ffe2b8', '#fff8ec']), .3, .9) });
    }
    for (let i = 0; i < 500; i++) {    // the bulge: a crowd of old golden stars
      list.push({ p: P(gauss(k) * .085, gauss(k) * .085, gauss(k) * .05), s: k.range(.016, .03), color: dim(k.pick(['#ffd58a', '#ffe7b3', '#ffc870', '#ffb85c']), .35, .8) });
    }
    for (let i = 0; i < 48; i++) {     // pink knots where new stars are being born, on the arms' outer edges, with hot blue clusters
      const r = k.range(.28, .94), [x, y] = arm(r, i % 2), a = Math.atan2(y, x) - k.range(.03, .1) / r;
      knots.push({ p: P(r * Math.cos(a), r * Math.sin(a), .004), s: k.range(.07, .12), color: k.pick(['#ff4f9e', '#ff66b0', '#ff5c8a']) });
      knots.push({ p: P(r * Math.cos(a) + .02, r * Math.sin(a) - .012, .006), s: k.range(.03, .045), color: '#d6e6ff' });
    }
    // a small companion galaxy at the tip of one arm, joined to it by a thin bridge of stars
    const [cx, cy] = arm(.97, 0);
    for (let i = 0; i < 100; i++) list.push({ p: P(cx + gauss(k) * .045, cy + gauss(k) * .035, gauss(k) * .025), s: k.range(.016, .026), color: dim(k.pick(['#ffe7b3', '#fff4e0', '#ffd58a']), .4, 1) });
    for (let i = 0; i < 40; i++) { const [x, y] = arm(k.range(.86, .98), 0); list.push({ p: P(x + gauss(k) * .02, y + gauss(k) * .02, 0), s: k.range(.012, .02), color: dim('#dfe8ff', .4, 1) }); }
    const stars = dots(k, list, q), pink = dots(k, knots, q, { kind: 'star' });
    stars.renderOrder = 3; pink.renderOrder = 4;
    gal.add(stars, pink);
    gal.add(halo(k, .1, '#fff4dc', .9, 'star', P(cx, cy, .02), { order: 5 }), halo(k, .22, '#ffd9a0', .5, 'soft', P(cx, cy, 0), { sx: 1.25, order: 1 }));
    // the bulge: a hot golden core
    gal.add(k.mesh(k.sphere(.06, { w: 32, h: 20 }), new T.MeshBasicMaterial({ color: '#fff0c8' }), { s: [1, .7, 1], shadow: false }));
    gal.add(halo(k, .36, '#ffc865', .85, 'star', [0, .05, 0], { order: 5 }), halo(k, .75, '#ffac4a', .35, 'soft', [0, 0, 0], { sy: .8, order: 1 }));
    return g;
  },
};
