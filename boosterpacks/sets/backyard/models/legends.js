// Models for the Backyard set's mythic and legendary cards: a fairy ring, a crystal geode, a golden koi, Bigfoot and a
// unicorn. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const bell = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const mixC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
// A small seeded random source for painting textures. Painted canvases are cached between renders, so painting mustn't
// use up the model's own k.rand() (the geometry would come out different the second time).
const rng = seed => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// Smooth 3D value noise in 0–1, and a few octaves of it (about 0–1 too).
const hash3 = (x, y, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), f = t => t * t * (3 - 2 * t), u = f(x - xi), v = f(y - yi), w = f(z - zi);
  let r = 0;
  for (let c = 0; c < 8; c++) { const dx = c & 1, dy = c >> 1 & 1, dz = c >> 2 & 1; r += hash3(xi + dx, yi + dy, zi + dz) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w); }
  return r;
}
// Mottle a colour: darker and lighter patches about 1/scale across, by up to ±amount.
const mottle = (c, p, amount = .1, scale = 9) => c.multiplyScalar(1 + amount * (2 * (.65 * noise3(p.x * scale, p.y * scale, p.z * scale) + .35 * noise3(p.x * scale * 2.3 + 7, p.y * scale * 2.3, p.z * scale * 2.3)) - 1));
const fbm = (x, y, z, oct = 3) => { let s = 0, a = 1, t = 0; for (let i = 0; i < oct; i++) { s += a * noise3(x, y, z); t += a; a *= .5; x *= 2.07; y *= 2.07; z *= 2.07; } return s / t; };

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
  n.needsUpdate = true;
  return geo;
}
// Move every vertex with fn(x, y, z) => [x, y, z], then redo the normals.
function warp(geo, fn) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const q = fn(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, q[0], q[1], q[2]); }
  p.needsUpdate = true; geo.computeVertexNormals();
  return weld(geo);
}
const curveOf = (k, pts, closed = false) => new k.THREE.CatmullRomCurve3(pts.map(q => Array.isArray(q) ? new k.THREE.Vector3(...q) : q.clone()), closed);
const V3 = (k, a) => a.isVector3 ? a.clone() : new k.THREE.Vector3(...a);

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
const aim = (k, obj, n, axis = [0, 1, 0]) => { obj.quaternion.setFromUnitVectors(new k.THREE.Vector3(...axis), V3(k, n).normalize()); return obj; };
// Turn an object so its local +y runs along L and its local +z (its face) points as near to N as it can.
function orient(k, obj, L, N) {
  const T = k.THREE, y = V3(k, L).normalize(), n = V3(k, N);
  const z = n.addScaledVector(y, -n.dot(y)).normalize(), x = new T.Vector3().crossVectors(y, z);
  obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
  return obj;
}
// Euler angles (XYZ, for k.instances) that turn +y to point along d, after first spinning `spin` about y.
function eulerTo(k, d, spin = 0) {
  const T = k.THREE, q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), V3(k, d).normalize());
  if (spin) q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), spin));
  const e = new T.Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z];
}
// A skin over a grid: f(u, v) => [x, y, z] over the unit square, (u, v) as its UVs. o.color(u, v) => [r, g, b] (sRGB)
// adds vertex colours; o.flip turns the faces the other way.
function surface(k, nu, nv, f, o = {}) {
  const T = k.THREE, pos = [], uv = [], col = [], idx = [], c = new T.Color();
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv; pos.push(...f(u, v)); uv.push(u, v);
    if (o.color) { const q = o.color(u, v); c.setRGB(q[0], q[1], q[2], T.SRGBColorSpace); col.push(c.r, c.g, c.b); }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, cc = a + nu + 1, d = cc + 1; o.flip ? idx.push(a, cc, b, b, cc, d) : idx.push(a, b, cc, b, d, cc); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  if (o.color) geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
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
// The camera's direction for a model's view (degrees), as the studio sets it up.
const camDir = (k, az = 30, el = 16) => new k.THREE.Vector3(Math.sin(k.deg(az)) * Math.cos(k.deg(el)), Math.sin(k.deg(el)), Math.cos(k.deg(az)) * Math.cos(k.deg(el)));

/* ---------- light: glows, twinkles and glints ---------- */
// A soft additive glow around a light: a sprite that always faces the camera (it doesn't count when the studio frames the model).
function halo(k, r, color, opacity = .5) {
  const T = k.THREE;
  const tex = k.tex(128, 128, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.22, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, { cache: 'legends:legendHalo' });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k.color(color), transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }));
  s.scale.set(r * 2, r * 2, 1);
  return s;
}
// A four-pointed twinkle, drawn over everything (o.depthTest: true lets things in front of it cover it).
function sparkle(k, size, rot = 0, color = '#fff4d2', o = {}) {
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
  }, { cache: 'legends:legendSparkle' });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k.color(color), transparent: true, depthWrite: false, depthTest: o.depthTest ?? false, blending: T.AdditiveBlending, rotation: rot, opacity: o.opacity ?? 1 }));
  s.scale.set(size, size, 1);
  s.renderOrder = 50;
  return s;
}
// Glowing motes: a few hundred bright specks in one draw (instanced spheres that ignore the lights).
function motes(k, list, color = '#fff6d0') {
  const T = k.THREE, m = k.instances(k.sphere(1, { w: 8, h: 6 }), new T.MeshBasicMaterial({ color: k.color(color), toneMapped: false }), list);
  m.castShadow = m.receiveShadow = false;
  return m;
}
// One tiny glint per eye (a mesh with userData.eye = radius), where the key light would reflect to the model's camera.
function glints(k, g, view = {}) {
  const T = k.THREE, az = k.deg(view.az ?? 30), el = k.deg(view.el ?? 16);
  const cam = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const key = new T.Vector3(Math.sin(az - 1) * Math.cos(.87), Math.sin(.87), Math.cos(az - 1) * Math.cos(.87));
  const H = cam.add(key).normalize(), glow = k.glow('#ffffff', 1.2), geo = k.sphere(1, { w: 10, h: 8 });
  g.updateMatrixWorld(true);
  const eyes = []; g.traverse(o => { if (o.userData.eye) eyes.push(o); });
  const pos = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3();
  for (const e of eyes) {
    e.matrixWorld.decompose(pos, q, sc);
    const r = e.userData.eye * sc.x;
    k.add(g, geo, glow, { p: pos.clone().addScaledVector(H, r * .92).toArray(), s: r * (e.userData.glint ?? .26), shadow: false });
  }
  return g;
}

/* ---------- fur (as the mammals are made) ---------- */
// A smooth function through keyed values: pts [[t, v], ...] (t ascending) → v(t), a cubic through every key.
function keys(pts) {
  const n = pts.length, m = pts.map((p, i) => i === 0 ? (pts[1][1] - p[1]) / (pts[1][0] - p[0])
    : i === n - 1 ? (p[1] - pts[i - 1][1]) / (p[0] - pts[i - 1][0])
    : (pts[i + 1][1] - pts[i - 1][1]) / (pts[i + 1][0] - pts[i - 1][0]));
  return t => {
    if (t <= pts[0][0]) return pts[0][1];
    if (t >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0; while (t > pts[i + 1][0]) i++;
    const [t0, v0] = pts[i], [t1, v1] = pts[i + 1], h = t1 - t0, s = (t - t0) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * h * m[i + 1];
  };
}
// Round off the ends of a swept shape: a factor that closes the radius over the first c0 and the last c1 of t.
const ends = (t, c0, c1 = c0) => {
  let f = 1;
  if (c0 > 0 && t < c0) { const q = t / c0; f *= Math.sqrt(Math.max(0, q * (2 - q))); }
  if (c1 > 0 && t > 1 - c1) { const q = (1 - t) / c1; f *= Math.sqrt(Math.max(0, q * (2 - q))); }
  return f;
};

// Every body part carries, besides position, normal, uv and color: uv1 (UVs in world units, so fur strands come out the
// same size on every part), fur (a fur-length multiplier), feather (the length of any long feathering, usually 0) and comb
// (the way the fur lies there). See shells().
function furAttrs(k, geo, cols, fur, comb, uv1, feather) {
  const T = k.THREE;
  geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  geo.setAttribute('fur', new T.Float32BufferAttribute(fur, 1));
  geo.setAttribute('feather', new T.Float32BufferAttribute(feather, 1));
  geo.setAttribute('comb', new T.Float32BufferAttribute(comb, 3));
  geo.setAttribute('uv1', new T.Float32BufferAttribute(uv1, 2));
  return geo;
}
const WHITE = { r: 1, g: 1, b: 1 };

// A soft body swept along a path, with an elliptical section: prof(t, a) → [rx, ry] (t 0–1 along the path, a the angle
// round it). rx runs along `side` (default +x) and ry across it (for a path heading up, +ry is the front, sin(a) = 1).
// Radii that fall to 0 at the ends close it off. o.color(t, a, p) → THREE.Color paints vertex colours; o.floor flattens
// anything below that height; o.fur and o.feather (numbers or (t, a) → number) and o.comb ([x, y, z], 'path', 'back' or
// (t, a, tangent) → [x, y, z]) set up its fur. geo.userData.at(t, a, lift) → { p, n, t } finds a point on the surface.
function sweep(k, pts, prof, o = {}) {
  const T = k.THREE, curve = Array.isArray(pts) ? curveOf(k, pts) : pts, seg = o.seg ?? 64, rs = o.rs ?? 32;
  const side = new T.Vector3(...(o.side ?? [1, 0, 0])).normalize(), L = curve.getLength();
  const frame = t => {
    const P = curve.getPointAt(t), Tn = curve.getTangentAt(t);
    const A = side.clone().addScaledVector(Tn, -side.dot(Tn)).normalize(), B = new T.Vector3().crossVectors(A, Tn).normalize();
    return { P, Tn, A, B };
  };
  let girth = 0;
  for (let i = 0; i <= 10; i++) { const t = i / 10; girth = Math.max(girth, Math.PI * (Math.abs(prof(t, 0)[0]) + Math.abs(prof(t, Math.PI / 2)[1]))); }
  girth = Math.max(1, Math.round(girth * 3)) / 3;                   // so strand textures (3, 6, 9… per unit) wrap round without a seam
  const pos = [], uv = [], uv1 = [], col = [], fur = [], fea = [], comb = [], idx = [], v = new T.Vector3();
  const combOf = typeof o.comb === 'function' ? o.comb : null, combV = Array.isArray(o.comb) ? o.comb : [0, -1, 0];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, { P, A, B, Tn } = frame(t);
    for (let j = 0; j <= rs; j++) {
      const a = j / rs * TAU, [rx, ry] = prof(t, a);
      v.copy(P).addScaledVector(A, rx * Math.cos(a)).addScaledVector(B, ry * Math.sin(a));
      const c = o.color ? o.color(t, a, v) : WHITE; col.push(c.r, c.g, c.b);
      fur.push(typeof o.fur === 'function' ? o.fur(t, a) : o.fur ?? 1);
      fea.push(typeof o.feather === 'function' ? o.feather(t, a) : o.feather ?? 0);
      const cb = o.comb === 'path' ? Tn.toArray() : o.comb === 'back' ? Tn.clone().negate().toArray() : combOf ? combOf(t, a, Tn) : combV; comb.push(...cb);
      if (o.floor != null && v.y < o.floor) v.y = o.floor;
      pos.push(v.x, v.y, v.z); uv.push(t, j / rs); uv1.push(t * L, j / rs * girth);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rs; j++) { const a = i * (rs + 1) + j, b = a + rs + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  furAttrs(k, geo, col, fur, comb, uv1, fea);
  geo.setIndex(idx); geo.computeVertexNormals(); weld(geo);
  geo.userData.curve = curve;
  geo.userData.at = (t, a, lift = 0) => {
    const { P, A, B, Tn } = frame(t), [rx, ry] = prof(t, a);
    return { p: P.clone().addScaledVector(A, (rx + lift) * Math.cos(a)).addScaledVector(B, (ry + lift) * Math.sin(a)),
      n: A.clone().multiplyScalar(Math.cos(a) * ry).addScaledVector(B, Math.sin(a) * rx).normalize(), t: Tn };
  };
  return geo;
}

// A sphere pushed into shape: fn(x, y, z) takes a point on the unit sphere and returns [x, y, z] where it goes.
// o.color(x, y, z) → THREE.Color paints vertex colours by the unit-sphere direction; o.floor flattens the bottom;
// o.fur, o.feather and o.comb as for sweep() (functions take the unit-sphere direction).
function blob(k, fn, o = {}) {
  const T = k.THREE, geo = new T.SphereGeometry(1, o.w ?? 64, o.h ?? 48), p = geo.attributes.position, uvA = geo.attributes.uv;
  const col = [], fur = [], fea = [], comb = [], uv1 = [], combV = Array.isArray(o.comb) ? o.comb : [0, -1, 0];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), q = fn(x, y, z);
    const c = o.color ? o.color(x, y, z, q) : WHITE; col.push(c.r, c.g, c.b);
    fur.push(typeof o.fur === 'function' ? o.fur(x, y, z) : o.fur ?? 1);
    fea.push(typeof o.feather === 'function' ? o.feather(x, y, z) : o.feather ?? 0);
    comb.push(...(typeof o.comb === 'function' ? o.comb(x, y, z) : combV));
    p.setXYZ(i, q[0], o.floor != null ? Math.max(o.floor, q[1]) : q[1], q[2]);
    x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); z0 = Math.min(z0, q[2]); z1 = Math.max(z1, q[2]);
  }
  const circ = Math.max(1, Math.round(Math.PI * ((x1 - x0) + (z1 - z0)) / 2 * 3)) / 3, tall = Math.PI * (y1 - y0) / 2;
  for (let i = 0; i < p.count; i++) uv1.push(uvA.getX(i) * circ, uvA.getY(i) * tall);
  furAttrs(k, geo, col, fur, comb, uv1, fea);
  geo.computeVertexNormals();
  return weld(geo);
}

// Join indexed parts that carry the same attributes into one geometry.
function mergeParts(k, geos) {
  const T = k.THREE, names = Object.keys(geos[0].attributes), out = new T.BufferGeometry(), idx = [];
  let base = 0;
  for (const g of geos) { for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base); base += g.attributes.position.count; }
  for (const n of names) {
    const size = geos[0].attributes[n].itemSize, arr = new Float32Array(base * size);
    let off = 0;
    for (const g of geos) { arr.set(g.attributes[n].array, off); off += g.attributes[n].array.length; }
    out.setAttribute(n, new T.BufferAttribute(arr, size));
  }
  out.setIndex(idx);
  return out;
}

// Fur: soft, matte and fuzzy at the edges, coloured by the geometry's vertex colours over fine strokes (laid out in
// world units, on uv1).
function furMat(k, o = {}) {
  const map = k.tex(256, 256, (c, w, h) => {
    c.fillStyle = '#f2f2f2'; c.fillRect(0, 0, w, h);
    let s = 91; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2600; i++) {
      const x = R() * w, y = R() * h, l = 3 + R() * 7, a = (R() - .5) * .5, dark = R() < .7;
      c.strokeStyle = dark ? `rgba(0,0,0,${.05 + R() * .1})` : `rgba(255,255,255,${.3 + R() * .5})`;
      c.lineWidth = .8 + R() * 1.1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(a) * l, y + Math.cos(a) * l); c.stroke();
    }
  }, { repeat: o.repeat ?? 2.5, cache: 'legends:fur' });
  map.channel = 1;
  return k.mat({ color: k.color(o.color ?? '#ffffff'), vertexColors: o.vc ?? true, map, roughness: o.rough ?? .88,
    sheen: o.sheen ?? 1, sheenRoughness: o.sheenRough ?? .5, sheenColor: k.color(o.sheenColor ?? '#6f6b66') });
}

// A texture computed texel by texel: fn(u, v) → [r, g, b] in 0–1 (sRGB), with u, v as the geometry's UVs.
function procTex(k, w, h, fn, o = {}) {
  return k.tex(w, h, c => {
    const img = c.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const col = fn((x + .5) / w, 1 - (y + .5) / h), i = (y * w + x) * 4;
      d[i] = col[0] * 255; d[i + 1] = col[1] * 255; d[i + 2] = col[2] * 255; d[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }, o);
}
// Where a sphere's UV (u, v) lands on the unit sphere (three.js SphereGeometry's mapping): +z is at u = .25, v = .5.
const sphereDir = (u, v) => { const ph = u * TAU, th = (1 - v) * Math.PI; return [-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)]; };
const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
// A glossy eyeball whose iris and pupil look along +z. iris: [outer, inner] colours; ia, pa: iris and pupil radii in radians.
function eyeMat(k, iris, o = {}) {
  const [c0, c1] = iris.map(rgb), pupil = rgb(o.pupil ?? '#060404'), white = rgb(o.white ?? '#1a0f0a'), ia = o.ia ?? .72, pa = o.pa ?? .36;
  const map = procTex(k, 256, 128, (u, v) => {
    const [x, y, z] = sphereDir(u, v), a = Math.acos(clamp(z, -1, 1)), ang = Math.atan2(y, x);
    if (a < pa) return pupil;
    if (a < ia) {
      const q = (a - pa) / (ia - pa), streak = .08 * Math.sin(ang * 23) + .06 * Math.sin(ang * 41 + 1);
      return mixRgb(mixRgb(c1, c0, smooth(.1, .95, q + streak)), pupil, smooth(.72, 1, q) * .7);
    }
    return mixRgb(pupil, white, smooth(0, .15, a - ia));
  });
  return k.mat({ map, roughness: .12, clearcoat: 1, clearcoatRoughness: .04 });
}

// Shell fur: copies of a body's geometry pushed out along its normals in thin layers, each showing only the strands that
// reach that high (softly blended, inner layer first), so the coat gets real depth and a soft, fuzzy outline. Needs the
// attributes sweep() and blob() add (fur or feather, comb, uv1). o: { n layers, len (fur length), attr ('fur' or 'feather':
// which length to grow), droop (how far tips follow the comb), density (strand tiles per world unit), shade [inner, outer],
// map (a colour texture instead of plain vertex colours), sheenColor, soft: false for hard alpha-tested layers }.
function shells(k, parent, geo, o = {}) {
  const T = k.THREE, n = o.n ?? 9, len = o.len ?? .04, droop = o.droop ?? .8, [s0, s1] = o.shade ?? [.84, 1.04], soft = o.soft ?? true;
  const map = k.tex(256, 256, (c, w, h) => {
    const img = c.createImageData(w, h), d = img.data, buf = new Float32Array(w * h);
    let s = 7; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 4200; i++) {
      const cx = R() * w, cy = R() * h, r = 1.4 + R() * 1.8, v = .35 + R() * .65;
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dd = Math.hypot(x + .5 - cx, y + .5 - cy) / r; if (dd >= 1) continue;
        const X = (x + w) % w, Y = (y + h) % h, val = v * (1 - dd * dd);
        if (val > buf[Y * w + X]) buf[Y * w + X] = val;
      }
    }
    for (let i = 0; i < w * h; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = buf[i] * 255; d[i * 4 + 3] = 255; }
    c.putImageData(img, 0, 0);
  }, { data: true, repeat: o.density ?? 9, cache: 'legends:strands' });
  map.channel = 1;
  const P = geo.attributes.position, N = geo.attributes.normal, F = geo.attributes[o.attr ?? 'fur'], CB = geo.attributes.comb;
  // only where there's fur to grow
  const src = geo.index.array, keep = [];
  for (let i = 0; i < src.length; i += 3) if (Math.max(F.getX(src[i]), F.getX(src[i + 1]), F.getX(src[i + 2])) > .01) keep.push(src[i], src[i + 1], src[i + 2]);
  const index = new T.Uint32BufferAttribute(keep, 1);
  for (let i = 1; i <= n; i++) {
    const h = i / n, g2 = new T.BufferGeometry(), arr = new Float32Array(P.count * 3);
    for (let j = 0; j < P.count; j++) {
      const f = len * F.getX(j), a = f * h, b = f * h * h * droop;
      arr[j * 3] = P.getX(j) + N.getX(j) * a + CB.getX(j) * b;
      arr[j * 3 + 1] = P.getY(j) + N.getY(j) * a + CB.getY(j) * b;
      arr[j * 3 + 2] = P.getZ(j) + N.getZ(j) * a + CB.getZ(j) * b;
    }
    g2.setAttribute('position', new T.BufferAttribute(arr, 3));
    for (const nm of ['normal', 'color', 'uv', 'uv1']) g2.setAttribute(nm, geo.attributes[nm]);
    g2.setIndex(index);
    const mat = k.mat({ color: new T.Color().setScalar(lerp(s0, s1, h)), vertexColors: true, map: o.map ?? null, alphaMap: map,
      roughness: .9, sheen: .8, sheenRoughness: .5, sheenColor: k.color(o.sheenColor ?? '#6f6b66') });
    if (soft) {
      // blended layers, drawn inner layer first: each strand fades out softly just below its tip (one shader for every layer)
      const cut = .03 + h * .88;
      Object.assign(mat, { transparent: true, depthWrite: false, alphaTest: .004 });
      mat.onBeforeCompile = sh => {
        sh.uniforms.shellCut = { value: cut };
        sh.fragmentShader = 'uniform float shellCut;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>',
          'diffuseColor.a *= smoothstep(shellCut - .14, shellCut + .02, texture2D(alphaMap, vAlphaMapUv).g);');
      };
      mat.customProgramCacheKey = () => 'legends-soft-shell';
    } else { mat.alphaTest = .03 + h * .9; mat.alphaToCoverage = true; }
    const m = k.mesh(g2, mat, { shadow: false }); m.receiveShadow = true;
    if (soft) m.renderOrder = 10 + i;
    parent.add(m);
  }
}
// A furry creature's parts (all sharing one fur material) as one mesh, with shell fur grown over it. o as for shells()
// plus furMat()'s options.
function furry(k, parent, geos, o = {}) {
  const geo = Array.isArray(geos) ? (geos.length === 1 ? geos[0] : mergeParts(k, geos)) : geos;
  const mat = furMat(k, o);
  if (o.map) mat.map = o.map;
  const mesh = k.add(parent, geo, mat);
  if ((o.len ?? .04) > 0) shells(k, parent, geo, o);
  if (o.feather) shells(k, parent, geo, { sheenColor: o.sheenColor, map: o.map, ...o.feather, attr: 'feather' });
  return mesh;
}

// Many locks at once: list of { p, d (where it points), n (the outward side), len, wid, thick, color }.
function locks(k, geo, mat, list) {
  const T = k.THREE, m = new T.InstancedMesh(geo, mat, list.length), M = new T.Matrix4(), Q = new T.Quaternion();
  const X = new T.Vector3(), Y = new T.Vector3(), Z = new T.Vector3(), S = new T.Vector3();
  list.forEach((it, i) => {
    Y.copy(it.d).normalize(); Z.copy(it.n).addScaledVector(Y, -it.n.dot(Y)).normalize(); X.crossVectors(Y, Z);
    M.makeBasis(X, Y, Z); Q.setFromRotationMatrix(M);
    M.compose(it.p, Q, S.set(it.wid, it.len, it.wid * (it.thick ?? 1)));
    m.setMatrixAt(i, M);
    if (it.color) m.setColorAt(i, it.color);
  });
  m.castShadow = m.receiveShadow = true;
  return m;
}

// A clump of long hair: root at the origin, running up +y for length 1, flattened in z, broad at the root and drawn to a
// soft point, with a lazy S-wave across it and its tip curling towards -z (lay -z against the skin). Colours fade from
// root to tip.
function hairGeo(k, root, tip, o = {}) {
  const T = k.THREE, rings = o.rings ?? 8, m = o.sides ?? 5, pos = [], col = [], idx = [], c0 = k.color(root), c1 = k.color(tip), c = new T.Color();
  const flat = o.flat ?? .4, curl = o.curl ?? .25, wave = o.wave ?? .08;
  for (let i = 0; i <= rings; i++) {
    const y = i / rings, w = .5 * Math.pow(1 - y, .8) * (.72 + .28 * smooth(0, .18, y)), x0 = wave * Math.sin(y * Math.PI * 1.4) * y, z0 = -curl * y * y;
    c.copy(c0).lerp(c1, smooth(0, .9, y));
    for (let j = 0; j < m; j++) { const a = j / m * TAU; pos.push(x0 + w * Math.cos(a), y, z0 + w * flat * Math.sin(a)); col.push(c.r, c.g, c.b); }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < m; j++) { const a = i * m + j, b = i * m + (j + 1) % m; idx.push(a, b, a + m, b, b + m, a + m); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// Turn obj so its local +z runs along zDir, with its +y as near to `up` as it can be.
function basisZ(k, obj, zDir, up = [0, 1, 0]) {
  const T = k.THREE, Z = V3(k, zDir).normalize(), X = new T.Vector3().crossVectors(V3(k, up), Z).normalize(), Y = new T.Vector3().crossVectors(Z, X);
  obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z));
  return obj;
}
// Shaggy hair: n locks growing out of fur parts (sweep() / blob() geometries) where their `feather` attribute says long hair
// grows, hanging along the fur's comb. o: { n, len, wid, droop, lift, jitter, bright, geo, mat }
function shag(k, parent, geos, o) {
  const T = k.THREE, cand = [], cum = [];
  let total = 0;
  for (const geo of geos) {
    const F = geo.attributes.feather;
    for (let i = 0; i < F.count; i++) { const f = F.getX(i); if (f > .04) { cand.push([geo, i, f]); total += f; cum.push(total); } }
  }
  const list = [], P = new T.Vector3(), N = new T.Vector3(), CB = new T.Vector3();
  for (let j = 0; j < o.n && cand.length; j++) {
    const r = k.rand() * total; let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
    const [geo, i, f] = cand[lo], A = geo.attributes;
    P.fromBufferAttribute(A.position, i); N.fromBufferAttribute(A.normal, i); CB.fromBufferAttribute(A.comb, i).normalize();
    const d = CB.clone().multiplyScalar(o.droop ?? 1).addScaledVector(N, o.lift ?? .45).add(new T.Vector3(k.range(-1, 1), k.range(-1, 1), k.range(-1, 1)).multiplyScalar(o.jitter ?? .3));
    const c = new T.Color(A.color.getX(i), A.color.getY(i), A.color.getZ(i)).multiplyScalar(k.range(.85, 1.15) * (o.bright ?? 1));
    list.push({ p: P.clone().addScaledVector(N, -.012), d, n: N.clone(), len: o.len * (.5 + .5 * Math.min(1, f)) * k.range(.55, 1.3), wid: o.wid * k.range(.75, 1.25), thick: 1, color: c });
  }
  const m = locks(k, o.geo, o.mat, list);
  parent.add(m);
  return m;
}

/* ---------- the fairy ring ---------- */
// A fly agaric, standing on y = 0, added into shared parts lists (so a whole ring of them is a few draw calls): a stout
// white stem with a skirt and a scaly bulb, a glossy red cap with white warts, cream gills underneath. h: height; R: cap
// radius; m: its placement matrix. parts: { stem: [], cap: [], gill: [], warts: [] }.
function flyAgaric(k, parts, h, R, m, o = {}) {
  const T = k.THREE, capY = h - R * .35, sr = R * .26, rnd = o.rand;
  const add = (list, geo, mm = m) => list.push(geo.applyMatrix4(mm));
  add(parts.stem, k.lathe([[0, 0], [sr * 1.5, 0], [sr * 1.75, sr * .5], [sr * 1.45, sr * 1.3], [sr * 1.02, sr * 2.2], [sr * .92, capY * .6], [sr * .85, capY * .9], [sr * 1.05, capY], [0, capY]], { smooth: true, samples: 20, seg: 18 }));
  add(parts.stem, k.lathe([[sr * .9, capY * .82], [sr * 1.6, capY * .76], [sr * 2.0, capY * .66], [sr * 1.92, capY * .64], [sr * 1.5, capY * .72], [sr * .88, capY * .77]], { smooth: true, samples: 12, seg: 18 }));
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + (i & 1) * .2; add(parts.stem, k.sphere(1, { w: 6, h: 4 }).scale(sr * .28, sr * .16, sr * .28).translate(Math.cos(a) * sr * 1.62, sr * (.55 + (i & 1) * .35), Math.sin(a) * sr * 1.62)); }
  // the cap: a glossy dome, its rim turned down; cream gills underneath
  const capM = new T.Matrix4().compose(new T.Vector3(0, capY, 0), new T.Quaternion().setFromEuler(new T.Euler(o.tilt?.[0] ?? 0, 0, o.tilt?.[1] ?? 0)), new T.Vector3(1, 1, 1)).premultiply(m);
  const capProf = []; for (let i = 0; i <= 10; i++) { const t = i / 10, a = t * Math.PI / 2; capProf.push([R * Math.sin(a) * (1 + .04 * Math.sin(t * Math.PI)), R * .62 * Math.cos(a) - R * .1 * t ** 4]); }
  capProf.push([R * .97, -R * .14], [R * .8, -R * .06], [0, -R * .04]);
  add(parts.cap, k.lathe(capProf.reverse(), { seg: 30 }), capM);
  add(parts.gill, k.ring(sr, R * .82, 30).rotateX(Math.PI / 2).translate(0, -R * .05, 0), capM);
  // white warts scattered over the cap, fewer towards the rim
  const q = new T.Quaternion(), P = new T.Vector3(), S = new T.Vector3();
  for (let i = 0; i < (o.warts ?? 16); i++) {
    const t = Math.sqrt(rnd()) * .9, a = rnd() * TAU, ang = t * Math.PI / 2, r = R * Math.sin(ang), y = R * .62 * Math.cos(ang) - R * .1 * t ** 4;
    const n = new T.Vector3(Math.sin(ang) * Math.cos(a) / R, Math.cos(ang) / (R * .62), Math.sin(ang) * Math.sin(a) / R).normalize(), sz = R * (.07 + rnd() * .07) * (1 - .4 * t);
    q.setFromUnitVectors(new T.Vector3(0, 1, 0), n);
    parts.warts.push(new T.Matrix4().compose(P.set(Math.cos(a) * r, y + .004, Math.sin(a) * r), q, S.set(sz, sz * .45, sz)).premultiply(capM));
  }
}
// A glowing mushroom into shared parts lists: a slender, pale stem and a bell-shaped cap that glows, brightest along its gills.
function glowShroom(k, parts, h, R, m) {
  const capY = h - R * .6;
  parts.gstem.push(k.lathe([[0, 0], [R * .2, 0], [R * .16, h * .3], [R * .13, capY * .9], [R * .15, capY], [0, capY]], { smooth: true, samples: 12, seg: 12 }).applyMatrix4(m));
  const prof = []; for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push([R * Math.pow(Math.sin(t * Math.PI / 2), .8), R * .95 * Math.pow(1 - t, 1.3)]); }
  prof.push([R * .9, R * .05], [R * .3, R * .12], [0, R * .14]);
  parts.gcap.push(k.lathe(prof.reverse(), { seg: 20 }).translate(0, capY, 0).applyMatrix4(m));
  parts.ggill.push(k.ring(R * .12, R * .9, 20).rotateX(Math.PI / 2).translate(0, capY + R * .06, 0).applyMatrix4(m));
}
// A fairy about a unit tall (feet at y = 0, facing +z): a petal dress, golden hair in a bun with bangs and a flower crown,
// a wand with a glowing star, and four glowing see-through wings.
function fairy(k) {
  const T = k.THREE, g = k.group(), C = h => k.color(h);
  const skin = k.mat({ color: '#ffd8c2', roughness: .5, sheen: .6, sheenColor: C('#ffffff'), clearcoat: .2 });
  const hairM = k.mat({ color: '#ffc85a', roughness: .35, clearcoat: .6, sheen: .8, sheenColor: C('#fff4d0'), emissive: '#ffa020', emissiveIntensity: .18 });
  const dressM = k.mat({ color: '#ff5fa8', roughness: .4, sheen: 1, sheenColor: C('#ffd0ea'), side: T.DoubleSide, iridescence: .5, iridescenceIOR: 1.3 });
  const leafM = k.mat({ color: '#5fcf6a', roughness: .45, sheen: .6, sheenColor: C('#e0ffd0'), side: T.DoubleSide });
  // head, face, hair
  const head = k.group([], { p: [0, .78, 0] }); g.add(head);
  k.add(head, k.sphere(.13, { w: 32, h: 24 }), skin, { s: [1, 1.02, .98] });
  for (const sd of [-1, 1]) {
    const e = k.add(head, k.sphere(.022, { w: 12, h: 10 }), k.gloss('#2a1830', { rough: .1 }), { p: [sd * .045, -.005, .118], s: [1, 1.25, .6] }); e.userData.eye = .022;
    k.add(head, k.sphere(.022, { w: 12, h: 8 }), k.mat({ color: '#ff9ab0', roughness: .6, transparent: true, opacity: .6 }), { p: [sd * .075, -.045, .1], s: [1, .6, .4] });
  }
  k.add(head, k.tube([[-.022, -.058, .122], [0, -.066, .126], [.022, -.058, .122]], .005, { seg: 8, rs: 4 }), k.matte('#c04a6a', .6));
  k.add(head, k.sphere(.14, { w: 32, h: 20, thetaLen: Math.PI * .56 }), hairM, { p: [0, .012, -.012], r: [-.35, 0, 0], s: [1.04, 1, 1.04] });
  k.add(head, k.sphere(.075, { w: 20, h: 14 }), hairM, { p: [0, .13, -.06] });
  const hairLocks = [];
  for (const sd of [-1, 1]) hairLocks.push(varTube(k, curveOf(k, [[sd * .11, .02, -.02], [sd * .14, -.08, -.04], [sd * .16, -.2, -.1], [sd * .2, -.3, -.2]]), capped(.03, 0, .02), { seg: 16, rs: 8 }));
  hairLocks.push(varTube(k, curveOf(k, [[0, .1, -.1], [.04, .02, -.2], [.12, -.08, -.3], [.2, -.14, -.42]]), capped(.035, 0, .025), { seg: 18, rs: 8 }));
  // bangs swept across the forehead
  for (let i = 0; i < 5; i++) { const x = (i - 2) * .045; hairLocks.push(varTube(k, curveOf(k, [[x * .6, .12, .06], [x * .9 + .01, .08, .115], [x * 1.1 + .02, .035, .13]]), capped(.024, 0, .018), { seg: 10, rs: 6 })); }
  k.add(head, k.merge(hairLocks), hairM);
  const flowers = []; for (let i = 0; i < 9; i++) { const a = (i / 8 - .5) * 2.6; flowers.push({ p: [Math.sin(a) * .135, .085 + .02 * Math.cos(a * 2), Math.cos(a) * .1 - .01], s: .02, color: ['#ffffff', '#ffe066', '#ff9ad6', '#a8e0ff'][i % 4] }); }
  head.add(k.instances(k.sphere(1, { w: 10, h: 8 }), k.mat({ color: '#ffffff', roughness: .4, emissive: '#ffffff', emissiveIntensity: .25 }), flowers));
  // body in a petal dress
  k.add(g, k.capsule(.05, .12, 8), leafM, { p: [0, .56, 0], s: [1, 1, .8] });
  const petal = surface(k, 6, 10, (u, v) => { const x = u * 2 - 1, w = .07 * Math.sin(Math.PI * Math.min(1, .1 + v * .9)) ** .7; return [x * w, -v * .22, .02 * (1 - x * x) + .06 * v * v]; });
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; const m = k.mesh(petal, dressM, { p: [Math.sin(a) * .04, .5, Math.cos(a) * .035] }); m.rotation.order = 'YXZ'; m.rotation.set(0, a, 0); m.rotateX(-.55); g.add(m); }
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + .3; const m = k.mesh(petal, leafM, { p: [Math.sin(a) * .04, .6, Math.cos(a) * .03], s: [.8, .5, .8] }); m.rotation.order = 'YXZ'; m.rotation.set(0, a, 0); m.rotateX(-1.1); g.add(m); }
  // arms: one raised with the wand, one held out; legs together, toes pointed, trailing back a little
  const limb = (pts, r0, r1) => varTube(k, curveOf(k, pts), (s2, L) => lerp(r0, r1, s2 / L), { seg: 14, rs: 8 });
  k.add(g, k.merge([limb([[.06, .64, 0], [.14, .7, .03], [.2, .8, .06], [.23, .9, .06]], .02, .014), limb([[-.06, .64, 0], [-.14, .6, .04], [-.22, .56, .08], [-.28, .55, .1]], .02, .014)]), skin);
  for (const p of [[.235, .915, .065], [-.29, .55, .1]]) k.add(g, k.sphere(.02, { w: 10, h: 8 }), skin, { p });
  k.add(g, k.merge([limb([[.025, .42, 0], [.03, .3, .04], [.03, .2, .02], [.02, .1, -.12]], .024, .014), limb([[-.025, .42, 0], [-.035, .32, .06], [-.04, .24, .03], [-.045, .17, -.1]], .024, .014)]), skin);
  for (const [x, y, z] of [[.02, .09, -.14], [-.045, .16, -.12]]) k.add(g, k.sphere(.022, { w: 10, h: 8 }), dressM, { p: [x, y, z], s: [.8, .8, 1.6], r: [-.5, 0, 0] });
  // the wand, with a glowing star
  const wand = k.group([], { p: [.235, .915, .065], r: [.2, 0, -.35] }); g.add(wand);
  k.add(wand, k.cyl(.007, .007, .26, { seg: 8 }), k.gold(), { p: [0, .1, 0] });
  const star = k.shape(Array.from({ length: 10 }, (_, i) => { const a = i / 10 * TAU + Math.PI / 2, r = i & 1 ? .025 : .06; return [Math.cos(a) * r, Math.sin(a) * r]; }));
  k.add(wand, k.extrude(star, .02, { bevel: .008 }), k.glow('#fff2a0', 2.2), { p: [0, .25, 0] });
  wand.add(k.place(halo(k, .16, '#fff0a0', .8), { p: [0, .25, 0] }));
  // wings: two big upper ones and two smaller lower ones, clear and glowing along their veins and edges
  const wingTex = k.tex(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const gr = c.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(.3, 'rgba(120,236,255,.55)'); gr.addColorStop(.7, 'rgba(190,150,255,.55)'); gr.addColorStop(1, 'rgba(255,150,220,.7)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,1)'; c.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const a = (i / 5 - .5) * 1.4; c.lineWidth = 3 - i * .2; c.beginPath(); c.moveTo(w * .04, h * .5); c.quadraticCurveTo(w * .5, h * .5 + Math.sin(a) * h * .3, w * .98, h * .5 + Math.sin(a) * h * .5); c.stroke(); }
    c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,255,255,.6)';
    for (let i = 0; i < 14; i++) { const x = w * (.3 + i * .05); c.beginPath(); c.moveTo(x, h * .12); c.quadraticCurveTo(x + 8, h * .5, x, h * .88); c.stroke(); }
  }, { cache: 'legends:fairyWing' });
  const wingM = k.mat({ map: wingTex, transparent: true, depthWrite: false, side: T.DoubleSide, roughness: .15, emissive: '#ffffff', emissiveMap: wingTex, emissiveIntensity: 1.1,
    iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [200, 600] });
  const rimM = new T.MeshBasicMaterial({ color: '#e8fcff', toneMapped: false, transparent: true, opacity: .85 });
  const wingShape = (len, wid) => {
    const sh = new T.Shape(); sh.moveTo(0, 0);
    sh.bezierCurveTo(len * .2, wid * .9, len * .8, wid * 1.1, len, wid * .25);
    sh.bezierCurveTo(len * 1.05, -wid * .2, len * .6, -wid * .5, 0, 0);
    const geo = new T.ShapeGeometry(sh, 24); geo.computeBoundingBox();
    geo.userData.rim = k.tube(sh.getSpacedPoints(60).map(p => [p.x, p.y, 0]), .005, { closed: true, seg: 90, rs: 4 });
    const bb = geo.boundingBox, p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (p.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
    return geo;
  };
  const upper = wingShape(.58, .28), lower = wingShape(.4, .18);
  for (const sd of [-1, 1]) {
    for (const [geo, rz, ry] of [[upper, .6, .5], [lower, -.4, .62]]) {
      const w = k.mesh(geo, wingM, { p: [sd * .03, .64, -.05], shadow: false });
      w.rotation.order = 'YZX'; w.rotation.set(0, sd > 0 ? ry : Math.PI - ry, sd > 0 ? rz : -rz); w.renderOrder = 6; g.add(w);
      const rim = k.mesh(geo.userData.rim, rimM, { shadow: false }); rim.rotation.copy(w.rotation); rim.position.copy(w.position); g.add(rim);
    }
  }
  g.add(k.place(halo(k, .5, '#fff0c0', .35), { p: [0, .6, -.05] }));
  return g;
}

function fairyRingModel(k) {
  const T = k.THREE, g = k.group(), C = h => k.color(h), V = (x, y, z) => new T.Vector3(x, y, z), R2 = k.rand;
  // the mound: deep, soft moss, a little higher in the middle
  const RM = 1.5;
  const mossTex = k.tex(256, 256, (c, w, h) => {
    const r = rng(901); c.fillStyle = '#26491a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 7000; i++) { const v = r(); c.fillStyle = v < .35 ? `rgba(80,128,40,${.4 + r() * .5})` : v < .7 ? `rgba(18,40,12,${.4 + r() * .5})` : `rgba(130,170,70,${.2 + r() * .4})`; const s2 = .8 + r() * 2.2; c.beginPath(); c.arc(r() * w, r() * h, s2, 0, TAU); c.fill(); }
  }, { cache: 'legends:fairyMoss', repeat: 6 });
  const hAt = (x, z) => { const r = Math.min(1, Math.hypot(x, z) / RM); return .17 * Math.max(0, 1 - r * r) ** 1.3; };
  const mound = warp(new T.RingGeometry(.002, 1, 96, 18), (x, y) => {
    const a = Math.atan2(y, x), f = 1 + .05 * Math.sin(a * 5 + 1) + .03 * Math.sin(a * 9), X = x * RM * f, Z = -y * RM * f;
    return [X, hAt(X / f, Z / f) + .03 * (fbm(X * 4, Z * 4, 2, 2) - .5) * smooth(RM, RM * .6, Math.hypot(X, Z)), Z];
  });
  k.add(g, mound, k.mat({ map: mossTex, bumpMap: mossTex, bumpScale: 4, roughness: .95, sheen: .6, sheenRoughness: .5, sheenColor: C('#7ab050') }));
  // grass round the edge, clover and tiny white flowers in the moss
  const bladeGeo = (() => { const geo = new T.PlaneGeometry(1, 1, 1, 3); geo.translate(0, .5, 0); return warp(geo, (x, y, z) => [x * (1 - y * .9), y, .25 * y * y]); })();
  const blades = [];
  for (let i = 0; i < 1300; i++) {
    const a = R2() * TAU, r = RM * (.72 + .36 * Math.sqrt(R2())), x = Math.cos(a) * r, z = Math.sin(a) * r;
    blades.push({ p: [x, Math.max(0, hAt(x, z) - .005), z], r: [(R2() - .5) * .6, R2() * TAU, (R2() - .5) * .6], order: 'YXZ', s: [.024, .05 + R2() * .09 * (1.2 - r / RM), .024], color: C(['#3f7a26', '#4d8a2c', '#5a9a32', '#2f6420', '#6aa83c'][i % 5]) });
  }
  g.add(k.instances(bladeGeo, k.mat({ color: '#ffffff', roughness: .6, side: T.DoubleSide, sheen: .4, sheenColor: C('#d8f0a0') }), blades));
  const blooms = [];
  for (let i = 0; i < 22; i++) { const a = R2() * TAU, r = RM * (.35 + .6 * R2()), x = Math.cos(a) * r, z = Math.sin(a) * r; blooms.push({ p: [x, hAt(x, z) + .012, z], s: [.028, .01, .028], color: i % 4 ? '#ffffff' : '#fff2a0' }); }
  g.add(k.instances(k.sphere(1, { w: 10, h: 6 }), k.mat({ color: '#ffffff', roughness: .5, emissive: '#ffffff', emissiveIntensity: .15 }), blooms));
  // the ring: fly agarics, and clusters of glowing mushrooms between them
  const parts = { stem: [], cap: [], gill: [], warts: [], gstem: [], gcap: [], ggill: [] };
  const RR = .98, N = 13, place = (x, y, z, ry = 0, s2 = 1) => new T.Matrix4().compose(V(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), V(s2, s2, s2));
  const glowCols = ['#18ffd0', '#4a6cff', '#8cff2a', '#18ffd0', '#b44cff'];
  const poolTex = k.tex(128, 128, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, { cache: 'legends:fairyPool' });
  let gi = 0;
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU - .644, x = Math.cos(a) * RR, z = Math.sin(a) * RR, y = hAt(x, z) - .01;       // (a glowing cluster just behind the fairy)
    const front = smooth(.2, .9, (x * Math.sin(k.deg(30)) + z * Math.cos(k.deg(30))) / RR);          // nearer the viewer: smaller, so the ring stays open
    if (i % 3 !== 1) {
      const sz = (.82 + .4 * R2()) * (1 - .3 * front);
      flyAgaric(k, parts, .5, .21, place(x, y, z, R2() * TAU, sz), { rand: R2, tilt: [(R2() - .5) * .3, (R2() - .5) * .3] });
      if (R2() < .55) { const s2 = .45 + .2 * R2(), off = (R2() < .5 ? -1 : 1) * .15, bx = Math.cos(a + off) * (RR + .07), bz = Math.sin(a + off) * (RR + .07); flyAgaric(k, parts, .5, .21, place(bx, hAt(bx, bz) - .01, bz, R2() * TAU, s2), { rand: R2, warts: 8 }); }
    } else {
      const col = glowCols[gi++ % glowCols.length], list = { gstem: [], gcap: [], ggill: [] };
      for (let j = 0; j < 5; j++) {
        const sz = [1.05, .78, .6, .46, .36][j] * (1 - .2 * front), da = (j - 2) * .065, rr = RR + [0, .07, -.07, .05, -.04][j], gx = Math.cos(a + da) * rr, gz = Math.sin(a + da) * rr;
        const mm = place(gx, hAt(gx, gz) - .01, gz, 0, 1).multiply(new T.Matrix4().makeRotationFromEuler(new T.Euler((R2() - .5) * .3, 0, (R2() - .5) * .3)));
        glowShroom(k, list, .44 * sz, .13 * sz, mm);
      }
      const cc = C(col), mats = {
        stem: k.mat({ color: '#f0fffa', roughness: .5, emissive: cc.clone().lerp(C('#ffffff'), .5), emissiveIntensity: .5 }),
        cap: k.mat({ color: '#000000', roughness: .25, clearcoat: .8, clearcoatRoughness: .1, emissive: cc, emissiveIntensity: 1, toneMapped: false }),
        gill: new T.MeshBasicMaterial({ color: cc.clone().lerp(C('#ffffff'), .45), toneMapped: false }) };
      k.add(g, k.merge(list.gstem), mats.stem); k.add(g, k.merge(list.gcap), mats.cap, { shadow: false }); k.add(g, k.merge(list.ggill), mats.gill, { shadow: false });
      g.add(k.place(halo(k, .42, col, .55), { p: [x, y + .22, z] }));
      // a pool of its light on the moss
      const pool = k.mesh(k.disc(.36, 24), new T.MeshBasicMaterial({ map: poolTex, color: cc, transparent: true, opacity: .8, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }), { p: [x, hAt(x, z) + .012, z], r: [-Math.PI / 2, 0, 0], shadow: false });
      pool.receiveShadow = false; pool.renderOrder = 1; g.add(pool);
    }
  }
  const stemM = k.mat({ color: '#f6f0e2', roughness: .6, sheen: .5, sheenColor: C('#ffffff') });
  const capM = k.mat({ color: '#e21a14', roughness: .2, clearcoat: 1, clearcoatRoughness: .06, emissive: '#5a0000', emissiveIntensity: .2 });
  const gillM = k.mat({ map: k.tex(128, 128, (c, w, h) => { c.fillStyle = '#f2e6cc'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(150,120,80,.5)'; c.lineWidth = 1; for (let i = 0; i < 90; i++) { const a = i / 90 * TAU; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + Math.cos(a) * w / 2, h / 2 + Math.sin(a) * h / 2); c.stroke(); } }, { cache: 'legends:fairyGills' }), roughness: .8, side: T.DoubleSide });
  k.add(g, k.merge(parts.stem), stemM); k.add(g, k.merge(parts.cap), capM); k.add(g, k.merge(parts.gill), gillM, { shadow: false });
  const warts = new T.InstancedMesh(k.sphere(1, { w: 8, h: 5 }), k.mat({ color: '#fffaf0', roughness: .7 }), parts.warts.length);
  parts.warts.forEach((mm, i) => warts.setMatrixAt(i, mm)); warts.castShadow = warts.receiveShadow = true; g.add(warts);
  // the fairy, hovering over the middle of the ring, lit warm
  const FZ = .42, f = fairy(k); f.scale.setScalar(.9); f.position.set(.05, .66, FZ); f.rotation.set(.06, .5, .05); g.add(f);
  const fl = new T.PointLight(0xffe2b0, 1.4, 1.6, 1.6); fl.position.set(0, 1.1, FZ + .25); g.add(fl);
  // her light pooled on the moss right under her, and fairy dust falling into it
  const below = k.mesh(k.disc(.42, 32), new T.MeshBasicMaterial({ map: poolTex, color: C('#ffd890'), transparent: true, opacity: .9, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }), { p: [.05, hAt(.05, FZ) + .015, FZ], r: [-Math.PI / 2, 0, 0], shadow: false });
  below.receiveShadow = false; below.renderOrder = 1; g.add(below);
  const dust = [];
  for (let i = 0; i < 26; i++) { const t = k.rand(), a = k.rand() * TAU, r = .03 + .14 * t; dust.push({ p: [.05 + Math.cos(a) * r, .2 + (1 - t) * .52, FZ + Math.sin(a) * r], s: .006 + .008 * (1 - t) }); }
  g.add(motes(k, dust, '#fff2c0'));
  // fairy lights and sparkles drifting over the ring
  const lights = [];
  for (let i = 0; i < 30; i++) {
    const a = R2() * TAU, r = .15 + 1.15 * Math.sqrt(R2()), y = .4 + R2() * .85, col = ['#fff0a0', '#ffc8f0', '#a8f4ff', '#fff0a0'][i % 4], p = [Math.cos(a) * r, y, Math.sin(a) * r];
    lights.push({ p, s: .01 + R2() * .014 });
    if (i % 2 === 0) g.add(k.place(halo(k, .06 + R2() * .05, col, .8), { p }));
  }
  // a swirl of sparks round the fairy, and a few warm glows about her
  for (let i = 0; i < 18; i++) { const t = i / 18, a = t * TAU * 1.7; lights.push({ p: [.05 + Math.cos(a) * (.3 + .1 * t), .56 + t * .75, Math.sin(a) * (.3 + .1 * t) + FZ], s: .008 + .008 * (1 - t) }); }
  for (const [x, y, z, r] of [[-.34, 1.16, .3, .09], [.4, .9, .5, .07], [-.24, .76, .66, .06], [.3, 1.34, .2, .06]]) g.add(k.place(halo(k, r, '#fff0b0', .85), { p: [x, y, z] }));
  g.add(motes(k, lights, '#fff6d8'));
  for (let i = 0; i < 8; i++) { const a = R2() * TAU, r = .3 + R2() * .9; g.add(k.place(sparkle(k, .1 + R2() * .14, R2(), ['#fff4d2', '#d8f8ff', '#ffe0f8'][i % 3]), { p: [Math.cos(a) * r, .4 + R2() * .8, Math.sin(a) * r] })); }
  g.userData.view = { az: 30, el: 24 };
  g.userData.fullView = { el: 30 };
  return glints(k, g, { az: 30, el: 24 });
}

/* ---------- the geode ---------- */
// One half of a geode, cut face on z = 0, the rind bulging back towards -z and the hollow opening towards +z.
// Returns the group and a list of crystal spots on the hollow's wall: { p, n (pointing into the hollow), depth 0–1 }.
function geodeHalf(k, o) {
  const T = k.THREE, g = k.group(), R = o.R, [sx, sy] = o.squash, seed = o.seed;
  const n3 = (x, y, z, f, s = 0) => noise3(x * f + seed * 7.1 + s, y * f + seed * 3.3, z * f - seed * 5.7) * 2 - 1;
  // the rind's lumpy outer radius (knobbly, like a cauliflower) and the hollow's radius, by direction
  const outer = d => R * (1 + .12 * n3(d.x, d.y, d.z, 1.3) + .045 * n3(d.x, d.y, d.z, 3.4, 11) + .03 * (1 - Math.abs(n3(d.x, d.y, d.z, 8, 23))) + .012 * n3(d.x, d.y, d.z, 20, 29));
  const inner = d => R * o.hollow * (1 + .08 * n3(d.x, d.y, d.z, 1.9, 41) + .025 * n3(d.x, d.y, d.z, 5, 57));
  // the break isn't a clean cut: the whole face wanders in and out, roughest out in the rind
  const brk = (x, y, s) => .05 * R * n3(x / R, y / R, 0, 1.6, 71) + (.008 + .02 * s) * R * n3(x / R, y / R, 0, 9, 83);
  const dir = (u, v) => { const th = v * Math.PI / 2, ph = u * TAU; return new T.Vector3(Math.sin(th) * Math.cos(ph) * sx, Math.sin(th) * Math.sin(ph) * sy, -Math.cos(th)); };
  const at = (d, r, v, s = 0) => { const p = d.clone().multiplyScalar(r); p.z += brk(p.x, p.y, s) * smooth(.55, 1, v); return p; };
  const NU = 120, NV = 30;
  // rind: dark, rough and pitted
  const rindTex = k.tex(512, 256, (c, w, h) => {
    const R2 = rng(401);
    c.fillStyle = '#6f6660'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(${R2() < .5 ? '52,46,42' : '150,138,122'},${.12 + R2() * .25})`; c.beginPath(); c.ellipse(R2() * w, R2() * h, 6 + R2() * 26, 4 + R2() * 14, R2() * 3, 0, TAU); c.fill(); }
    for (let i = 0; i < 7000; i++) { const v = R2(); c.fillStyle = v < .45 ? `rgba(34,28,26,${.3 + R2() * .5})` : v < .8 ? `rgba(186,174,158,${.25 + R2() * .5})` : `rgba(122,90,60,${.3 + R2() * .4})`; const s = 1 + R2() * 2.6; c.fillRect(R2() * w, R2() * h, s, s); }
  }, { cache: 'legends:geodeRind', repeat: [3, 1.5] });
  k.add(g, surface(k, NU, NV, (u, v) => at(dir(u, v), outer(dir(u, v)), v, 1).toArray()), k.mat({ map: rindTex, bumpMap: rindTex, bumpScale: 4, roughness: .95, color: '#c9beb4' }));
  // the broken face, from the hollow out: a thin white quartz band, fine grey-blue agate bands, a dark line, the rind
  const faceTex = uvTex(k, 128, 512, (u, v) => {
    const s = u, wob = .025 * Math.sin(v * TAU * 5 + seed) + .015 * Math.sin(v * TAU * 13 + 1);
    const q = s + wob;
    let c = mixC(rgb('#f7f2ff'), rgb('#e6dcf5'), .5 + .5 * Math.sin(v * 2400));                        // white quartz
    if (q > .1) c = mixC(mixC(mixC(rgb('#e4e2f6'), rgb('#8a8fc4'), .5 + .5 * Math.sin(q * 95)), rgb('#b9a2e0'), .45 * smooth(.3, 1, Math.sin(q * 23 + 2))), rgb('#f6f4fc'), .6 * smooth(.6, 1, Math.sin(q * 41 + 1)));   // agate
    if (q > .36) c = mixC(rgb('#8a95a8'), rgb('#525866'), smooth(.36, .4, q));
    if (q > .42) c = rgb('#3a3432');
    if (q > .46) { const n = hash3(Math.floor(v * 900), Math.floor(s * 60), seed); c = mixC(mixC(rgb('#7b7068'), rgb('#5a524c'), n), rgb('#a39486'), n > .9 ? .6 : 0); }
    return c;
  }, { cache: 'legends:geodeFace' + seed });
  k.add(g, surface(k, 8, NU, (s, u) => { const d = dir(u, 1); return at(d, lerp(inner(d), outer(d), s), 1, s).toArray(); }), k.mat({ map: faceTex, bumpMap: faceTex, bumpScale: 1.2, roughness: .38, clearcoat: .5, clearcoatRoughness: .3 }));
  // the hollow's wall, deep violet between the crystals
  k.add(g, surface(k, NU, NV, (u, v) => at(dir(u, v), inner(dir(u, v)), v).toArray(), { flip: true }), k.mat({ color: '#2c0f55', roughness: .5, emissive: '#1c0540', emissiveIntensity: .6 }));
  // crystal spots, spread evenly over the wall
  const spots = [];
  for (let i = 0; i < o.n; i++) {
    const v = Math.sqrt(k.rand()) * .99, u = k.rand();
    const d = dir(u, v), p = at(d, inner(d), v);
    const e = .012, pu = at(dir(u + e, v), inner(dir(u + e, v)), v), pv = at(dir(u, v + e), inner(dir(u, v + e)), v + e);
    const n = new T.Vector3().crossVectors(pu.sub(p), pv.sub(p)).normalize();
    if (n.dot(p) > 0) n.negate();
    spots.push({ p, n, depth: 1 - v });
  }
  return { g, spots, hollow: R * o.hollow };
}
// A crystal point: a hexagonal prism with a six-sided tip, length 1 along +y (its root a little below 0), radius .3,
// coloured from `root` at the bottom to `tip` at the point.
function crystalGeo(k, root, mid, tip) {
  const T = k.THREE, geo = new T.LatheGeometry([[.3, -.15], [.3, .55], [0, 1]].map(([x, y]) => new T.Vector2(x, y)), 6);
  const p = geo.attributes.position, col = [], c0 = new T.Color(root), c1 = new T.Color(mid), c2 = new T.Color(tip), c = new T.Color();
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); c.copy(c0).lerp(c1, smooth(-.15, .55, y)).lerp(c2, smooth(.55, 1, y)); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  return geo.toNonIndexed();
}

function geodeModel(k) {
  const T = k.THREE, g = k.group();
  const gem = o => k.mat({ color: '#ffffff', vertexColors: true, roughness: .04, metalness: 0, clearcoat: 1, clearcoatRoughness: .02, flatShading: true,
    envMapIntensity: 2.8, iridescence: .55, iridescenceIOR: 1.45, iridescenceThicknessRange: [300, 750], specularIntensity: 1, ...o });
  const amethyst = gem({ emissive: '#4a0a80', emissiveIntensity: .32 }), quartz = gem({ emissive: '#2a2438', emissiveIntensity: .3 });
  const amGeo = crystalGeo(k, '#f4dcff', '#a438dc', '#44066e'), qGeo = crystalGeo(k, '#ffffff', '#f4f0ff', '#dccdfa');
  const halves = [];
  const makeHalf = (R, n, seed, place) => {
    const h = geodeHalf(k, { R, hollow: .7, n, seed, squash: [1, .88] });
    const am = [], qz = [];
    for (const s of h.spots) {
      const dd = s.depth, rimmy = dd < .07;
      const len = R * (rimmy ? k.range(.05, .09) : lerp(.1, .32, smooth(.05, .8, dd)) * k.range(.75, 1.2)), th = len * k.range(.95, 1.4);
      const d = s.n.clone().multiplyScalar(1.1).add(new T.Vector3(k.range(-1, 1), k.range(-1, 1), k.range(-1, 1)).multiplyScalar(.5)).normalize();
      const it = { p: s.p.clone().addScaledVector(d, -len * .05).toArray(), r: eulerTo(k, d, k.rand() * TAU), s: [th, len, th] };
      if (rimmy) qz.push(it); else { it.color = new T.Color('#ffffff').lerp(new T.Color(k.pick(['#f0d0ff', '#dcb4ff', '#f6e8ff', '#d49cff'])), k.rand()); am.push(it); }
    }
    // and a few big points standing up out of the middle
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU + k.range(-.3, .3), r = h.hollow * k.range(.15, .4), len = R * k.range(.3, .42), th = len * k.range(1, 1.2);
      const base = new T.Vector3(Math.cos(a) * r, Math.sin(a) * r, -Math.sqrt(Math.max(0, h.hollow ** 2 - r * r)) * .95);
      const d = new T.Vector3(Math.cos(a) * .35, Math.sin(a) * .35, 1).normalize();
      am.push({ p: base.toArray(), r: eulerTo(k, d, k.rand() * TAU), s: [th, len, th], color: '#ffffff' });
    }
    h.g.add(k.instances(amGeo, amethyst, am), k.instances(qGeo, quartz, qz));
    // a violet glow from deep in the hollow
    const lamp = new T.PointLight(0xa060ff, 1.1 * R, R * 2.2, 1.5); lamp.position.set(0, 0, R * .2); h.g.add(lamp);
    h.g.add(k.place(halo(k, R * .8, '#8a3dff', .13), { p: [0, 0, 0] }));
    k.place(h.g, place);
    g.add(h.g); halves.push(h);
    return h;
  };
  // the upright half, turned to show its hollow; the other half on its back in front of it
  makeHalf(1, 520, 1, { p: [-.62, 1.0, -.3], r: [-.2, .3, .08], order: 'YXZ' });
  makeHalf(.86, 420, 2, { p: [1.05, .42, .7], r: [-Math.PI / 2 + .5, -.45, .1], order: 'YXZ' });
  g.updateMatrixWorld(true);
  for (const h of halves) { const bb = new T.Box3().setFromObject(h.g.children[0], true); h.g.position.y -= bb.min.y - .02; }
  // the heap of sand they were dug out of: a low, lumpy mound, flush with the ground at its edge
  const sandTex = k.tex(256, 256, (c, w, h) => {
    const R2 = rng(402);
    c.fillStyle = '#c99a55'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(${R2() < .5 ? '150,110,56' : '226,190,128'},${.2 + R2() * .3})`; c.beginPath(); c.ellipse(R2() * w, R2() * h, 6 + R2() * 18, 4 + R2() * 10, R2() * 3, 0, TAU); c.fill(); }
    for (let i = 0; i < 12000; i++) { const v = R2(); c.fillStyle = v < .4 ? `rgba(110,78,40,${.3 + R2() * .5})` : v < .75 ? `rgba(250,232,196,${.3 + R2() * .5})` : `rgba(90,80,72,${.25 + R2() * .35})`; c.fillRect(R2() * w, R2() * h, 1 + R2() * 1.6, 1 + R2() * 1.6); }
  }, { cache: 'legends:geodeSand', repeat: 5 });
  const sand = k.mat({ map: sandTex, bumpMap: sandTex, bumpScale: 3, roughness: .97 });
  const foot = a => 1 + .1 * Math.sin(a * 3 + 1) + .06 * Math.sin(a * 5 + 2) + .035 * Math.sin(a * 9 + .5);
  const heap = warp(new T.RingGeometry(.002, 1, 120, 30), (x, y) => {
    const a = Math.atan2(y, x), q = Math.min(1, Math.hypot(x, y)), f = foot(a);
    const lumps = .09 * (fbm(x * 5 + 3, y * 5, 1.7) - .5) + .035 * (noise3(x * 14, y * 14, 4) - .5);
    const h = .62 * Math.max(0, 1 - q * q) ** 1.8 * (1 + .5 * (fbm(x * 2.2 + 3, y * 2.2, 1.7) - .5)) + lumps * smooth(1, .7, q);
    return [x * 1.95 * f, Math.max(0, h), -y * 1.5 * f];
  });
  const heapMesh = k.add(g, heap, sand, { p: [.2, 0, .15] });
  // a few loose points in the sand
  const loose = [];
  for (const [x, y, z, a, t, s] of [[.02, .3, 1.28, .6, 1.2, .2], [.36, .24, 1.5, -.9, 1.35, .15], [2.0, .18, -.05, 1.2, 1.1, .17], [-1.3, .26, .72, -1.4, 1.3, .14], [-.6, .34, .98, 2.2, .9, .12]]) {
    loose.push({ p: [x, y, z], r: [t, a, 0], order: 'YXZ', s: [s * 1.2, s * 1.4, s * 1.2] });
  }
  g.add(k.instances(amGeo, amethyst, loose));
  // the hammer that did it, left lying on the sand (dropped onto the heap: its head and the end of its handle rest where
  // rays straight down meet the sand)
  g.updateMatrixWorld(true);
  const ray = new T.Raycaster(), sandAt = (x, z) => { ray.set(new T.Vector3(x, 5, z), new T.Vector3(0, -1, 0)); const hit = ray.intersectObject(heapMesh)[0]; return hit ? hit.point.y : 0; };
  const hA = new T.Vector3(-.55, 0, 1.12), hB = new T.Vector3(-1.45, 0, 1.28);                       // head, end of the handle
  hA.y = sandAt(hA.x, hA.z) + .065; hB.y = sandAt(hB.x, hB.z) + .055;
  const hammer = k.group([], { p: hA.toArray() }); g.add(hammer);
  hammer.quaternion.setFromRotationMatrix(new T.Matrix4().lookAt(hA, hB, new T.Vector3(0, 1, 0)));         // local -z runs down the handle
  const HL = hA.distanceTo(hB);
  k.add(hammer, varTube(k, curveOf(k, [[0, 0, -.02], [0, .005, -HL * .4], [0, .004, -HL * .8], [0, 0, -HL]]), (s2, L) => lerp(.048, .062, smooth(.2, 1, s2 / L)) * (s2 > L - .03 ? .5 + .5 * Math.sqrt(Math.max(0, (L - s2) / .03)) : 1), { seg: 24, rs: 12, flat: .78 }), k.wood('pine', { rough: .45, varnish: .6 }));
  k.add(hammer, k.box(.1, .1, .1, .02), k.steel(), { p: [0, 0, .02] });
  k.add(hammer, k.cyl(.064, .06, .15, { seg: 24 }), k.steel(), { p: [.11, 0, .02], r: [0, 0, Math.PI / 2] });
  k.add(hammer, k.rcyl(.068, .03, .01, { seg: 24 }), k.chrome(), { p: [.18, 0, .02], r: [0, 0, -Math.PI / 2] });
  k.add(hammer, varTube(k, curveOf(k, [[-.04, 0, .02], [-.13, .015, .02], [-.21, .06, .02], [-.25, .12, .02]]), (s2, L) => lerp(.045, .014, s2 / L), { seg: 16, rs: 10, flat: .5, up: [0, 0, 1] }), k.steel());
  // glints on the crystals
  g.updateMatrixWorld(true);
  const cam = camDir(k, 30, 25);
  let made = 0;
  for (const [h, sizes] of [[halves[0], [.62, .36, .26, .22]], [halves[1], [.44, .3, .2]]]) {
    const good = h.spots.filter(s => s.depth > .15 && h.g.localToWorld(s.n.clone()).sub(h.g.localToWorld(new T.Vector3())).dot(cam) > .55);
    for (const sz of sizes) { const sp = good[Math.floor(k.rand() * good.length)]; if (!sp) continue; g.add(k.place(sparkle(k, sz, k.rand(), made++ % 2 ? '#f2dcff' : '#fff4d2'), { p: h.g.localToWorld(sp.p.clone().addScaledVector(sp.n, .16)).toArray() })); }
  }
  // a dusting of tiny twinkles over the crystals, and a few specks of glitter in the air
  const specks = [];
  for (const h of halves) for (let i = 0; i < 14; i++) {
    const sp = h.spots[Math.floor(k.rand() * h.spots.length)]; if (sp.depth < .1) continue;
    const p = h.g.localToWorld(sp.p.clone().addScaledVector(sp.n, .1 + k.rand() * .1));
    if (i < 5) g.add(k.place(sparkle(k, k.range(.1, .2), k.rand(), k.pick(['#f6e4ff', '#fff4d2', '#e0d0ff']), { depthTest: true }), { p: p.toArray() }));
    else specks.push({ p: p.toArray(), s: k.range(.006, .014) });
  }
  for (let i = 0; i < 16; i++) specks.push({ p: [k.range(-1.4, 1.8), k.range(.7, 1.9), k.range(-.6, .9)], s: k.range(.006, .012) });
  g.add(motes(k, specks, '#f4e8ff'));
  g.userData.view = { az: 30, el: 25 };
  g.userData.fullView = { el: 18 };
  return g;
}

/* ---------- Bigfoot ---------- */
// A ripe tomato (the stolen goods): radius R, standing on y = 0, a green star of sepals and a stub of stem on top.
function tomato(k, R) {
  const T = k.THREE, g = k.group();
  const shape = (th, phi) => {
    const w = smooth(0, .55, th) * (1 - .6 * smooth(1.1, 2.8, th)), rr = 1 + .09 * (Math.pow(Math.abs(Math.cos(5 * phi / 2)), .6) - .7) * w;
    const y = Math.cos(th) * .82 - .13 * Math.exp(-((th / .42) ** 2));
    return new T.Vector3(Math.sin(th) * Math.sin(phi) * rr * R, (y + .82) * R, Math.sin(th) * Math.cos(phi) * rr * R);
  };
  const geo = new T.SphereGeometry(1, 48, 32), p = geo.attributes.position, cols = [];
  const top = new T.Color('#ee4a1c'), mid = new T.Color('#d8200f'), bot = new T.Color('#a8120a');
  for (let i = 0; i < p.count; i++) {
    const th = Math.acos(clamp(p.getY(i), -1, 1)), phi = Math.atan2(p.getX(i), p.getZ(i)), v = shape(th, phi); p.setXYZ(i, v.x, v.y, v.z);
    const c = mid.clone().lerp(top, .7 * (1 - smooth(.15, .7, th))).lerp(bot, smooth(1.6, 3.0, th) * .7); cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals(); weld(geo);
  k.add(g, geo, k.mat({ color: '#ffffff', vertexColors: true, roughness: .18, clearcoat: 1, clearcoatRoughness: .05 }));
  const green = k.plastic('#4c8a2a', { rough: .5, coat: .3 }), sep = [];
  for (let i = 0; i < 6; i++) {
    const phi = i / 6 * TAU + .3, pts = [];
    for (let j = 0; j <= 5; j++) { const t = j / 5, s2 = shape(.04 + t * .75, phi); s2.y += R * (.02 + .14 * t ** 2.4); pts.push(s2); }
    sep.push(varTube(k, curveOf(k, pts), (s2, L) => { const q = s2 / L; return .075 * R * Math.pow(Math.max(0, 1 - q), .75) + .004 * R; }, { flat: .3, seg: 16, rs: 8 }));
  }
  k.add(g, k.merge(sep), green);
  k.add(g, k.cyl(.05 * R, .06 * R, .22 * R, { seg: 10 }), green, { p: [0, shape(0, 0).y + .06 * R, 0], r: [.2, 0, .1] });
  return g;
}

// Two-bone IK: where the middle joint goes between a and c (bone lengths l1, l2), bending towards `pole`.
function ik(k, a, c, l1, l2, pole) {
  const A = V3(k, a), d = V3(k, c).sub(A), L = Math.min(d.length(), (l1 + l2) * .998), dn = d.clone().normalize();
  const x = (l1 * l1 - l2 * l2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - x * x)), P = V3(k, pole);
  const pv = P.addScaledVector(dn, -P.dot(dn)).normalize();
  return A.addScaledVector(dn, x).addScaledVector(pv, h);
}
// A limb's path through its joints: a, the middle joint b and c, with a point in the middle of each bone nudged out by
// bulge (the muscle), so the sweep bends smoothly at the joint.
function limbPath(k, a, b, c, bulge = [0, 0, 0]) {
  const A = V3(k, a), B = V3(k, b), Cc = V3(k, c), U = V3(k, bulge);
  return [A, A.clone().lerp(B, .5).add(U), B, B.clone().lerp(Cc, .5).addScaledVector(U, .6), Cc];
}

function bigfootModel(k) {
  const T = k.THREE, g = k.group(), C = h => k.color(h), V = (x, y, z) => new T.Vector3(x, y, z);
  // it strides past towards the viewer's left, head turned to look right at us
  const bf = k.group([], { r: [0, k.deg(-18), 0] }); g.add(bf);
  const body = k.group(); bf.add(body);
  const brown = C('#35231a'), deep = C('#150d09'), rust = C('#6e4128'), skinC = C('#3f302b');
  const coat = (p, dark = 0, rs = 0) => mottle(brown.clone().lerp(deep, clamp(dark)).lerp(rust, clamp(rs)), p, .2, 3.4);
  const parts = [];
  // the armature (facing +z, its left side towards +x): the far leg reaching forward, the near leg pushing off behind,
  // the near arm swinging forward with the tomato, the far arm swinging back
  const J = {
    rHip: [-.19, 1.24, .05], rAnk: [-.22, .17, .52], lHip: [.19, 1.24, -.05], lAnk: [.23, .32, -.58],
    lSh: [.47, 2.0, .1], lWr: [.58, 1.14, .62], rSh: [-.47, 2.0, .02], rWr: [-.55, 1.06, -.36],
  };
  J.rKnee = ik(k, J.rHip, J.rAnk, .6, .58, [-.1, 0, 1]); J.lKnee = ik(k, J.lHip, J.lAnk, .6, .58, [.1, 0, 1]);
  J.lElb = ik(k, J.lSh, J.lWr, .6, .56, [.3, -.2, -1]); J.rElb = ik(k, J.rSh, J.rWr, .6, .56, [-.3, -.2, -1]);
  // torso: a barrel chest and big belly under broad, hunched shoulders, the back humped up behind the head
  const tw = keys([[0, .27], [.15, .36], [.4, .36], [.62, .43], [.82, .5], [.93, .4], [1, .2]]);
  const tf = keys([[0, .23], [.15, .29], [.4, .34], [.62, .31], [.82, .25], [.93, .2], [1, .14]]);
  const tb = keys([[0, .25], [.15, .31], [.4, .27], [.62, .3], [.82, .33], [.93, .29], [1, .2]]);
  const torso = sweep(k, [[0, 1.08, -.04], [0, 1.34, .01], [0, 1.64, .09], [0, 1.92, .1], [0, 2.12, .04], [0, 2.25, -.05]], (t, a) => {
    const e = ends(t, .12, .2), s2 = Math.sin(a); return [tw(t) * e, (s2 > 0 ? tf(t) : tb(t)) * e];
  }, { seg: 36, rs: 28, comb: 'back', fur: (t, a) => 1 + .35 * smooth(0, -.8, Math.sin(a)) * smooth(.4, .8, t),
    feather: (t, a) => { const s2 = Math.sin(a), side = Math.abs(Math.cos(a)); return .28 * smooth(.08, .2, t) * smooth(.95, .85, t) + smooth(.5, .8, t) * smooth(1, .9, t) * (.55 + .45 * smooth(.3, -.6, s2)) + .55 * smooth(.15, .3, t) * smooth(.62, .45, t) * smooth(.5, .9, side) + .5 * smooth(.25, .08, t) * smooth(.2, -.5, s2) + .5 * bell(t, .6, .14) * smooth(.1, .8, s2); },
    color: (t, a, p) => coat(p, .35 * smooth(.3, 0, t) + .35 * smooth(.3, .9, Math.sin(a)) * smooth(.7, .3, t), .65 * smooth(.62, .92, t) * smooth(.4, -.5, Math.sin(a))) });
  parts.push(torso);
  // legs: thick thighs, heavy calves
  const legR = (t, a) => {
    const thigh = lerp(.2, .125, smooth(.08, .5, t)), calf = .122 + .03 * bell(t, .64, .1) * (Math.sin(a) < 0 ? 1 : .4);
    return (t < .5 ? thigh : lerp(calf, .09, smooth(.7, 1, t))) * ends(t, .06, .02);
  };
  const leg = (hip, knee, ank, sd) => sweep(k, limbPath(k, hip, knee, ank, [sd * .02, 0, 0]), (t, a) => { const r = legR(t, a); return [r, r * 1.05]; }, {
    seg: 28, rs: 16, comb: 'path', fur: t => 1.15 - .25 * t, feather: (t, a) => .35 + .65 * smooth(.3, 1, t) * (.6 + .4 * smooth(.2, -.8, Math.sin(a))),
    color: (t, a, p) => coat(p, .12 + .5 * smooth(.35, 1, t)) });
  parts.push(leg(J.rHip, J.rKnee, J.rAnk, -1), leg(J.lHip, J.lKnee, J.lAnk, 1));
  // arms: long and heavy, the forearms hung with long hair
  const armR = t => { const up = lerp(.15, .105, smooth(.05, .5, t)), fore = lerp(.125, .08, smooth(.62, 1, t)); return (t < .5 ? up : lerp(.105, fore, smooth(.5, .62, t))) * ends(t, .1, .03); };
  const arm = (sh, el, wr, sd) => sweep(k, limbPath(k, sh, el, wr, [sd * .03, 0, 0]), t => { const r = armR(t); return [r, r]; }, {
    seg: 28, rs: 16, comb: (t, a, tn) => [tn.x * .5, tn.y * .5 - .9, tn.z * .5], fur: 1.1, feather: t => (.7 + .3 * smooth(.35, .7, t)) * smooth(1, .9, t), color: (t, a, p) => coat(p, .15 * t, .45 * smooth(.35, 0, t)) });
  parts.push(arm(J.lSh, J.lElb, J.lWr, 1), arm(J.rSh, J.rElb, J.rWr, -1));
  const furO = { len: .06, n: 7, density: 5, shade: [.55, 1.18], sheenColor: '#a86c40' };
  furry(k, body, parts, furO);
  // the long, layered shag over it all: clumps of hair, dark at the roots, auburn at the tips
  const lock = hairGeo(k, '#a8a8a8', '#ffffff', { flat: .4, curl: .3, wave: .1, sides: 4 });
  const hairM = k.mat({ vertexColors: true, roughness: .68, sheen: .9, sheenRoughness: .38, sheenColor: C('#c08a5c') });
  shag(k, body, parts, { n: 860, len: .27, wid: .085, droop: 1, lift: .22, jitter: .25, bright: 1.14, geo: lock, mat: hairM });
  // leathery hands: a broad palm, four thick fingers and a thumb
  const leather = k.mat({ color: '#3b2b25', roughness: .6, clearcoat: .3, clearcoatRoughness: .45, sheen: .5, sheenColor: C('#8a6858') });
  const digit = (pts, r) => varTube(k, curveOf(k, pts), capped(r, r * .6, r * .9), { seg: 12, rs: 8 });
  // a hand: +y runs from the wrist to the fingers, the palm faces palmTo. With `hold` (a radius), the fingers wrap round
  // a ball of that size held in the palm, whose centre it returns.
  const hand = (wr, el, palmTo, hold) => {
    const d = V3(k, wr).sub(V3(k, el)).normalize(), hg = k.group([], { p: wr }); orient(k, hg, d, palmTo); body.add(hg);
    const geos = [], c = hold ? V(0, .19, .06 + hold) : null;
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * .05, ln = [.9, 1, .97, .82][i];
      if (hold) {
        const rho = hold + .03, pts = [[x * .9, .15, .02]];
        for (let j = 0; j <= 4; j++) { const th = .55 + j / 4 * (1.75 * ln); pts.push([x * (1 + .12 * Math.sin(th)), c.y + rho * Math.sin(th), c.z - rho * Math.cos(th)]); }
        geos.push(digit(pts, .027));
      } else geos.push(digit([[x, .15, 0], [x * 1.08, .19 + ln * .06, .04], [x * 1.1, .19 + ln * .1, .1], [x * 1.05, .18 + ln * .1, .15]], .027));
    }
    geos.push(hold ? digit([[.07, .05, .04], [.12, .11, .1], [.13, .17, .17], [.1, .21, .23]], .03) : digit([[.05, .06, .03], [.1, .14, .08], [.1, .19, .11]], .03));
    k.add(hg, k.merge(geos), leather);
    k.add(hg, k.sphere(1, { w: 20, h: 14 }), leather, { p: [0, .09, .01], s: [.1, .12, .06] });
    return { hg, c };
  };
  // the near hand shows off the stolen tomato, palm towards the viewer; the far one swings empty
  const held = hand(J.lWr, J.lElb, [.65, .1, .75], .15);
  hand(J.rWr, J.rElb, [-.2, 0, -1]);
  const tomPivot = k.group([], { p: held.c.toArray(), r: [1.2, 0, .3] }); held.hg.add(tomPivot);
  const tom = tomato(k, .15); tom.position.y = -.15 * .82; tomPivot.add(tom);
  // big bare feet: a broad forefoot, five stubby toes, the big one biggest
  const foot = (heel, toe) => {
    const H = V3(k, heel), d = V3(k, toe).sub(H), L = d.length(), fg = k.group([], { p: H.toArray() }); basisZ(k, fg, d); body.add(fg);
    k.add(fg, blob(k, (x, y, z) => {
      const t = (z + 1) / 2, w = .075 + .045 * smooth(.15, .7, t), top = .13 - .08 * smooth(.2, .9, t);
      return [x * w * (1 + .1 * Math.max(0, -y)), y > 0 ? y * top : y * .02, t * L * .86];
    }, { w: 28, h: 16 }), leather);
    const toes = [];
    for (let i = 0; i < 5; i++) { const x = (i - 2) * .045, big = i === 0 ? 1.3 : 1 - i * .07; toes.push({ p: [-x - .005, .03, L * .86 + .02 - Math.abs(i - .7) * .02], s: [.036 * big, .032 * big, .05 * big] }); }
    fg.add(k.instances(k.sphere(1, { w: 12, h: 8 }), leather, toes));
  };
  foot([-.22, .0, .36], [-.25, .0, .86]);
  foot([.23, .22, -.6], [.25, .0, -.16]);
  // the head: a heavy brow, a tall crest, a dark leathery face; turned to look straight at us
  const hg = k.group([], { p: [0, 2.14, .14], r: [.12, .7, 0], order: 'YXZ' }); body.add(hg);
  const faceDir = (x, y, z) => smooth(.38, .62, z) * smooth(-.85, -.55, y) * smooth(.66, .46, y) * smooth(.62, .42, Math.abs(x));
  const head = blob(k, (x, y, z) => {
    let X = x * .165, Y = y * .19, Z = z * .175;
    Y += .12 * Math.max(0, y) ** 2.4 * smooth(.6, -.4, z);
    X *= 1 - .38 * Math.max(0, y) ** 1.6;
    Z += .05 * Math.max(0, -y) * Math.max(0, z);
    return [X, .15 + Y, .05 + Z];
  }, { w: 32, h: 24, comb: [0, -1, -.4], fur: (x, y, z) => (1 - faceDir(x, y, z)) * (1 + .4 * smooth(0, .8, y)),
    feather: (x, y, z) => (1 - faceDir(x, y, z)) * smooth(.55, .15, y) * (.55 + .45 * smooth(.2, -.4, z)) * (1 - .6 * smooth(.3, .6, z) * smooth(.3, .5, y)),
    color: (x, y, z, q) => coat(new T.Vector3(...q), .15, .6 * smooth(0, .8, y)).lerp(skinC, faceDir(x, y, z)) });
  furry(k, hg, [head], { ...furO, len: .04 });
  shag(k, hg, [head], { n: 120, len: .2, wid: .07, droop: 1, lift: .4, jitter: .25, bright: 1.18, geo: lock, mat: hairM });
  const wrinkles = k.tex(128, 128, (c, w, h) => {
    const R2 = rng(611); c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const y = R2() * h, x = R2() * w, l = 10 + R2() * 30; c.strokeStyle = `rgba(0,0,0,${.2 + R2() * .3})`; c.lineWidth = 1 + R2() * 1.5; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + l / 2, y + (R2() - .5) * 8, x + l, y + (R2() - .5) * 6); c.stroke(); }
    for (let i = 0; i < 900; i++) { c.fillStyle = R2() < .5 ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.15)'; c.fillRect(R2() * w, R2() * h, 1.5, 1.5); }
  }, { cache: 'legends:bigfootWrinkles', data: true, repeat: 3 });
  const skinM = k.mat({ color: skinC, roughness: .55, clearcoat: .25, clearcoatRoughness: .45, sheen: .5, sheenColor: C('#8a6a5a'), bumpMap: wrinkles, bumpScale: 1.2 });
  const bits = [
    [[-.052, .205, .2], [.068, .036, .06], [-.3, 0, -.12]],   // the brow ridges, overhanging the eyes
    [[.052, .205, .2], [.068, .036, .06], [-.3, 0, .12]],
    [[0, .215, .19], [.05, .03, .05], [-.2, 0, 0]],
    [[0, .085, .19], [.108, .085, .078], [0, 0, 0]],          // the muzzle: a long upper lip
    [[0, .128, .238], [.058, .032, .032], [.3, 0, 0]],        // a broad, flat nose
    [[0, .022, .205], [.075, .038, .055], [0, 0, 0]],         // the chin and lower lip
  ];
  for (const [p, sc, r] of bits) k.add(hg, k.sphere(1, { w: 24, h: 16 }), skinM, { p, s: sc, r });
  for (const sd of [-1, 1]) k.add(hg, k.sphere(1, { w: 12, h: 8 }), k.matte('#120c0a', .7), { p: [sd * .024, .118, .262], s: [.016, .01, .01], r: [0, 0, sd * .5] });
  // deep-set amber eyes with a little eyeshine
  const eyeM = eyeMat(k, ['#3a1a04', '#d88a24'], { ia: .95, pa: .4 });
  eyeM.emissive = C('#ff9a2a'); eyeM.emissiveIntensity = .22; eyeM.emissiveMap = eyeM.map;
  for (const sd of [-1, 1]) { const e = k.add(hg, k.sphere(.02, { w: 16, h: 12 }), eyeM, { p: [sd * .056, .168, .214] }); e.userData.eye = .02; e.userData.glint = .3; }
  k.add(hg, k.tube([[-.07, .052, .24], [-.03, .058, .258], [0, .059, .262], [.03, .058, .258], [.07, .052, .24]], .006, { seg: 16, rs: 6 }), k.matte('#140d0b', .6));
  // its footprints behind it, pressed into the grass: bare mud with a raised rim, toe dents, grass standing round them
  const sole = (x, z, L) => {                                                  // signed distance to a big bare footprint (z 0 heel → L toes)
    const t = z / L, q = (t - .4) / .4, w = (.062 + .046 * smooth(.3, .62, t) * smooth(.9, .7, t) - .012 * bell(t, .36, .1)) * Math.sqrt(Math.max(0, 1 - q * q));
    let d = Math.abs(x + .012 * smooth(.3, .7, t)) - w;
    if (q < -1 || q > 1) d = Math.max(d, Math.abs(q) - 1) + .01;
    for (let i = 0; i < 5; i++) { const tx = (i - 2) * .044 + .01, tz = L * (.9 - .012 * (i - .6) ** 2); d = Math.min(d, Math.hypot((x - tx) / .85, z - tz) - .03 * (i === 0 ? 1.35 : 1 - i * .07)); }
    return d;
  };
  const mudM = k.mat({ vertexColors: true, transparent: true, depthWrite: false, roughness: .3, clearcoat: .7, clearcoatRoughness: .2 });
  const blades = [], L = .52;
  // (placed in the picture's own space: the trail curves in from the right, where it came from)
  for (const [px, pz, yaw, mirror] of [[1.0, -.5, -.82, -1], [1.78, -1.22, -.9, 1]]) {
    const geo = new T.PlaneGeometry(.6, .9, 28, 40); geo.rotateX(-Math.PI / 2);
    const pp = geo.attributes.position, cols = [], cc = new T.Color();
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i) * mirror, z = -pp.getZ(i) + L / 2, d = sole(x, z, L), n = noise3(x * 9, z * 9, 5);
      const edge = Math.hypot(x / .27, (z - L / 2) / .4) + .3 * (n - .5), rim = .014 * bell(d, .02, .02), dip = smooth(.006, -.012, d);
      pp.setY(i, .003 + rim * smooth(1, .7, edge));
      cc.set('#5e4128').lerp(k.color('#9a7a52'), bell(d, .022, .016) * .85).lerp(k.color('#140b05'), dip * .95);
      cols.push(cc.r, cc.g, cc.b, Math.max(smooth(1, .55, edge) * .9, dip));
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(cols, 4)); geo.computeVertexNormals();
    k.add(g, geo, mudM, { p: [px, 0, pz], r: [0, yaw, 0], shadow: false }).renderOrder = 1;
    // grass standing round the back and sides of each print
    for (let i = 0; i < 5; i++) { const a = k.range(-1.2, 1.9), r = k.range(.36, .46); blades.push([px + Math.cos(a) * r, pz - Math.sin(a) * r * 1.1, true]); }
  }
  // tussocks of grass round its feet
  for (const [x, z] of [[-.55, .9], [.5, .55], [-.65, -.2], [.62, -.9], [-.1, 1.15], [.1, -1.1]]) blades.push([x, z]);
  const bladeGeo = (() => { const geo = new T.PlaneGeometry(1, 1, 1, 3); geo.translate(0, .5, 0); return warp(geo, (x, y, z) => [x * (1 - y * .92), y, .3 * y * y]); })();
  const grass = [], grassW = [];
  for (const [x, z, world] of blades) for (let j = 0; j < 7; j++) {
    const a = k.rand() * TAU, r = k.range(0, .05);
    (world ? grassW : grass).push({ p: [x + Math.cos(a) * r, 0, z + Math.sin(a) * r], r: [k.range(-.35, .35), k.rand() * TAU, k.range(-.35, .35)], order: 'YXZ', s: [.03, k.range(.07, .16), .03], color: k.pick(['#3f7a26', '#4d8a2c', '#2f6420', '#5a9432', '#6a8a30']) });
  }
  const grassM = k.mat({ color: '#ffffff', roughness: .65, side: T.DoubleSide, sheen: .4, sheenColor: C('#c8e890') });
  g.add(k.instances(bladeGeo, grassM, grassW));
  body.add(k.instances(bladeGeo, grassM, grass));
  glints(k, g, { az: 30, el: 15 });
  g.userData.view = { az: 30, el: 16 };
  g.userData.fullView = { el: 15, zoom: 1.1 };
  return g;
}

/* ---------- the unicorn ---------- */
// A spiral horn: a slender cone standing on y = 0 with two ridges winding up it. len, radius at the base, turns.
function hornGeo(k, len, r0, turns = 3.2) {
  return surface(k, 40, 96, (u, v) => {
    const a = u * TAU, y = v * len, R = r0 * Math.pow(1 - v, .85) * (1 + .16 * Math.pow(.5 + .5 * Math.cos(2 * (a - v * turns * TAU)), 1.6) * smooth(1, .85, v)) + .004 * (1 - v);
    return [Math.sin(a) * R, y, Math.cos(a) * R];
  });
}
// A flowing strand of hair along pts, root radius r (flattened by flat along `up`), tapering to a soft point; coloured
// from c0 at the root to c1 at the tip.
function strand(k, pts, r, c0, c1, o = {}) {
  const T = k.THREE, curve = curveOf(k, pts), geo = varTube(k, curve, (s2, L) => r * Math.pow(1 - s2 / L, o.taper ?? .7) * (s2 < r ? .6 + .4 * s2 / r : 1) + r * .04, { seg: o.seg ?? 36, rs: o.rs ?? 7, flat: o.flat ?? .55, up: o.up ?? [0, 1, 0] });
  const p = geo.attributes.position, col = [], A = k.color(c0), B = k.color(c1), c = new T.Color(), seg = o.seg ?? 36, rs = o.rs ?? 7;
  for (let i = 0; i <= seg; i++) { c.copy(A).lerp(B, smooth(.1, 1, i / seg)); for (let j = 0; j <= rs; j++) col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  return geo;
}
const RAINBOW = ['#ff4b5c', '#ff9a2e', '#ffd93a', '#5fd35a', '#3fa8ff', '#9a5cff', '#ff6ad5'];
const rainbowAt = (k, t) => { const n = RAINBOW.length - 1, i = Math.min(n - 1, Math.floor(t * n)), f = t * n - i; return k.color(RAINBOW[i]).lerp(k.color(RAINBOW[i + 1]), f); };

function unicornModel(k) {
  const T = k.THREE, g = k.group(), C = h => k.color(h), V = (x, y, z) => new T.Vector3(x, y, z);
  const u = k.group([], { r: [0, k.deg(-58), 0] }); g.add(u);       // rearing up, facing off to the viewer's left
  // the white coat: pearly, with a faint lilac in the shadows
  const coatO = { roughness: .42, clearcoat: .35, clearcoatRoughness: .35, sheen: .8, sheenRoughness: .4, sheenColor: C('#ffd8f4'), iridescence: .6, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 520] };
  // (and a fine glitter in it: tiny flecks that light up, laid out in world units on the parts' second uv set)
  const glitter = k.tex(256, 256, (c, w, h) => {
    const R2 = rng(808); c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const v = R2(); c.fillStyle = v < .33 ? '#ffffff' : v < .55 ? '#ffd0f0' : v < .75 ? '#c8e4ff' : '#fff0b0'; const sz = R2() < .7 ? 2 : 3; c.fillRect(R2() * w | 0, R2() * h | 0, sz, sz); }
  }, { cache: 'legends:unicornGlitter', repeat: 1.4 });
  glitter.channel = 1;
  const coat = k.mat({ color: '#ffffff', vertexColors: true, ...coatO, emissive: '#ffffff', emissiveMap: glitter, emissiveIntensity: .7 }), coatPlain = k.mat({ color: '#f8f5ff', ...coatO });
  const white = C('#f6f1fb'), shade = C('#c4b2e4'), blush = C('#ffd8ec');
  const tint = (p, under) => white.clone().lerp(shade, clamp(under)).lerp(blush, .3 * noise3(p.x * 3, p.y * 3, p.z * 3));
  const gold = k.metal('#ffcf5a', .16, { envMapIntensity: 1.6 });
  // the barrel, built standing (facing +z) and pitched up about the hips to rear
  const HIP = V(0, 1.1, -.5), PITCH = k.deg(-50), E = new T.Euler(PITCH, 0, 0);
  const toU = (x, y, z) => V(x, y - HIP.y, z - HIP.z).applyEuler(E).add(HIP);   // standing coordinates → the unicorn's
  const bw = keys([[0, .22], [.13, .34], [.32, .35], [.55, .33], [.8, .31], [1, .25]]), bh = keys([[0, .27], [.13, .4], [.32, .41], [.55, .42], [.8, .41], [1, .34]]);
  const barrel = sweep(k, [toU(0, 1.36, -.86), toU(0, 1.34, -.52), toU(0, 1.27, -.05), toU(0, 1.28, .36), toU(0, 1.24, .7)], (t, a) => {
    const e = ends(t, .17, .15), dn = Math.sin(a), side = Math.abs(Math.cos(a));
    const muscle = 1 + .07 * bell(t, .2, .1) * smooth(.3, .9, side) * smooth(.5, -.2, dn) + .06 * bell(t, .84, .08) * smooth(.4, .9, side) * smooth(.6, 0, dn);
    return [bw(t) * e * muscle, bh(t) * e * (1 + .05 * dn)];
  }, { seg: 56, rs: 40, color: (t, a, p) => tint(p, .85 * smooth(.1, 1, Math.sin(a)) + .25 * bell(t, .5, .15) * smooth(.8, 1, Math.abs(Math.cos(a)))) });
  k.add(u, barrel, coat);
  // the neck, arched, rising from the chest
  const nb = toU(0, 1.3, .3);
  const nw = keys([[0, .29], [.22, .24], [.5, .18], [.75, .145], [1, .125]]), nd = keys([[0, .44], [.22, .36], [.5, .26], [.75, .2], [1, .18]]);
  const neckPts = [nb, V(0, nb.y + .3, nb.z + .1), V(0, nb.y + .62, nb.z + .26), V(0, nb.y + .86, nb.z + .44), V(0, nb.y + 1.0, nb.z + .64)];
  const neck = sweep(k, neckPts, (t, a) => {
    const e = ends(t, 0, .1), crest = 1 + .16 * smooth(0, -1, Math.sin(a)) * bell(t, .6, .3); return [nw(t) * e, nd(t) * e * crest];
  }, { seg: 44, rs: 32, side: [1, 0, 0], color: (t, a, p) => tint(p, .45 * smooth(.3, 1, Math.sin(a))) });
  k.add(u, neck, coat);
  const poll = V(0, nb.y + 1.03, nb.z + .6);
  // the head: broad jowls and a long, tapering face, angled down and forward
  const hw = keys([[0, .14], [.25, .168], [.5, .145], [.78, .105], [1, .098]]), hh = keys([[0, .165], [.25, .22], [.5, .17], [.78, .118], [1, .105]]);
  const hp = [poll.clone().add(V(0, .02, -.08)), poll.clone().add(V(0, .0, .12)), poll.clone().add(V(0, -.17, .36)), poll.clone().add(V(0, -.39, .56)), poll.clone().add(V(0, -.49, .64))];
  const head = sweep(k, hp, (t, a) => {
    const e = ends(t, .14, .16), jaw = 1 + .25 * smooth(.2, .9, Math.sin(a)) * bell(t, .3, .16); return [hw(t) * e, hh(t) * e * jaw];
  }, { seg: 44, rs: 30, color: (t, a, p) => tint(p, .3 * smooth(.3, 1, Math.sin(a))).lerp(C('#f6cfe0'), smooth(.8, .98, t) * .65) });
  k.add(u, head, coat);
  const hAt = head.userData.at;
  // eyes, ears, nostrils
  const eyeM = eyeMat(k, ['#2a1440', '#7a4ad8'], { ia: .95, pa: .45, white: '#1a1020' });
  for (const sd of [-1, 1]) {
    const q = hAt(.36, sd > 0 ? Math.PI + .45 : -.45);
    const e = k.add(u, k.sphere(.045, { w: 20, h: 14 }), eyeM, { p: q.p.clone().addScaledVector(q.n, -.014).toArray(), s: [1, .85, 1.1] }); e.userData.eye = .045;
    e.quaternion.setFromUnitVectors(V(0, 0, 1), q.n.clone().add(V(0, .1, .35)).normalize());
    // long lashes along the top of the eye
    const lash = [], up = hAt(.36, -Math.PI / 2).n, fwd = hp[3].clone().sub(hp[1]).normalize();
    for (let j = 0; j < 5; j++) {
      const f = (j - 2) / 2, r0 = q.p.clone().addScaledVector(q.n, .012).addScaledVector(up, .036).addScaledVector(fwd, f * .03);
      lash.push(varTube(k, curveOf(k, [r0, r0.clone().addScaledVector(q.n, .03).addScaledVector(up, .012).addScaledVector(fwd, f * .012), r0.clone().addScaledVector(q.n, .045).addScaledVector(up, .035).addScaledVector(fwd, .01 + f * .02)]), (s2, L) => .005 * (1 - .8 * s2 / L), { seg: 8, rs: 4 }));
    }
    k.add(u, k.merge(lash), k.matte('#3a2440', .5));
    const ear = k.group([], { p: poll.clone().add(V(sd * .08, .12, .04)).toArray(), r: [-.15, sd * .3, sd * .3] }); u.add(ear);
    k.add(ear, warp(k.sphere(1, { w: 16, h: 16 }), (x, y, z) => { const t = (y + 1) / 2; return [x * .055 * (1 - t * .8), t * .22, z * .032 + .016 * x * x]; }), coatPlain);
    k.add(ear, warp(k.sphere(1, { w: 12, h: 12 }), (x, y, z) => { const t = (y + 1) / 2; return [x * .034 * (1 - t * .8), .02 + t * .16, .022 + z * .012]; }), k.mat({ color: '#f7b8d4', roughness: .6, sheen: .6, sheenColor: C('#ffffff') }));
    k.add(u, k.sphere(.022, { w: 10, h: 8 }), k.matte('#b8849a', .6), { p: hAt(.95, sd > 0 ? Math.PI + .95 : -.95).p.toArray(), s: [1, 1.4, .6] });
  }
  // the horn: gold, spiralling, pointing up and forward out of the forehead
  const fq = hAt(.2, -Math.PI / 2), hornBase = fq.p.clone().addScaledVector(fq.n, -.01);
  const horn = k.group([], { p: hornBase.toArray() }); aim(k, horn, V(0, .78, .62)); u.add(horn);
  k.add(horn, hornGeo(k, .66, .058), gold);
  k.add(horn, k.torus(.058, .015, { rs: 8, ts: 24 }), gold, { r: [Math.PI / 2, 0, 0], p: [0, .01, 0] });
  // legs
  const legGeo = (pts, rad) => sweep(k, pts, (t, a) => { const r = rad(t); return [r, r * 1.08]; }, { seg: 48, rs: 20, color: (t, a, p) => tint(p, .25 + .2 * t) });
  // hind legs: under it, hocks bent, standing on the grass
  const hind = [];
  for (const sd of [-1, 1]) {
    const hip = toU(sd * .2, 1.2, -.58), hoof = V(sd * .23, .08, HIP.z + (sd > 0 ? .3 : .02));
    const stifle = V(sd * .27, hip.y - .36, hip.z + .36), hock = V(sd * .22, .55, hoof.z - .34), fet = V(sd * .22, .17, hoof.z - .05);
    const rad = t => t < .42 ? lerp(.21, .12, smooth(.02, .42, t)) : lerp(.1, .048, smooth(.42, .6, t)) + .022 * bell(t, .88, .04);
    k.add(u, legGeo([hip, hip.clone().lerp(stifle, .5), stifle, stifle.clone().lerp(hock, .5).add(V(0, 0, -.05)), hock, fet, hoof], t => rad(t) * ends(t, .05, 0)), coat);
    hind.push(hoof);
  }
  // front legs: tucked up and pawing the air
  const front = [];
  for (const [sd, lift] of [[-1, .14], [1, -.05]]) {
    const sh = toU(sd * .2, 1.16, .5), el = toU(sd * .21, .92, .44);
    const knee = el.clone().add(V(sd * .01, .05 + lift, .4)), fet = knee.clone().add(V(0, -.38 + lift * .5, -.08)), hoof = fet.clone().add(V(0, -.1, .1));
    const rad = t => (t < .4 ? lerp(.13, .075, smooth(0, .4, t)) : lerp(.066, .044, smooth(.4, .55, t)) + .022 * bell(t, .86, .04)) * ends(t, .05, 0);
    k.add(u, legGeo([sh, el, el.clone().lerp(knee, .5), knee, knee.clone().lerp(fet, .5), fet, hoof], rad), coat);
    front.push([fet, hoof]);
  }
  // the rainbow mane: locks from the crest of the neck, tossed back behind it, and more draped down its near side
  const hairM = k.mat({ vertexColors: true, roughness: .3, clearcoat: .6, clearcoatRoughness: .2, sheen: .8, sheenRoughness: .3, sheenColor: C('#ffffff'), iridescence: .3, iridescenceIOR: 1.3 });
  const locksG = [], nAt = neck.userData.at;
  const lockOf = (pts, r, c, o) => locksG.push(strand(k, pts, r, c.clone().multiplyScalar(.82).getStyle(), c.clone().lerp(C('#ffffff'), .35).getStyle(), o));
  for (let i = 0; i < 36; i++) {
    const t = .04 + .92 * (i + k.rand() * .7) / 36, q = nAt(t, -Math.PI / 2 + k.range(-.3, .3)), c = rainbowAt(k, clamp(1 - t + k.range(-.04, .04)));
    const len = lerp(.55, .8, bell(t, .5, .4)) * k.range(.85, 1.15), back = V(0, -.1, -1).normalize(), ph = k.rand() * TAU;
    const pts = [q.p.clone().addScaledVector(q.n, -.02)];
    for (let j = 1; j <= 5; j++) {
      const f = j / 5, w = Math.sin(f * 4 + ph) * .06 * f;
      pts.push(q.p.clone().addScaledVector(q.n, .1 * Math.min(1, f * 2.5)).addScaledVector(back, len * f * .85).add(V(-.05 * f + w, -len * .6 * f * f, 0)));
    }
    lockOf(pts, k.range(.04, .055), c, { up: [1, 0, 0], flat: .5 });
  }
  for (let i = 0; i < 34; i++) {
    const t = .05 + .9 * (i + k.rand()) / 34, c = rainbowAt(k, clamp(1 - t + k.range(-.05, .05))), ph = k.rand() * TAU, dt = k.range(.06, .18), reach = k.range(.25, .75);
    const lift = k.range(.07, .13), tt = x => Math.max(0, t - x);
    const pts = [nAt(t, -Math.PI / 2 + k.range(0, .3), -.01).p, nAt(t, -1.1, lift * .7).p, nAt(tt(dt * .3), -.55, lift).p, nAt(tt(dt * .6), -.05 + reach * .3, lift + .025 * Math.sin(ph)).p, nAt(tt(dt), reach, lift + .02 * Math.cos(ph)).p];
    pts.push(pts[4].clone().add(V(.05 * Math.sin(ph), -k.range(.06, .16), -k.range(.06, .16))));
    lockOf(pts, k.range(.038, .058), c, { seg: 30, rs: 6, flat: .45 });
  }
  // the forelock, spilling over its brow round the horn
  for (let i = 0; i < 8; i++) {
    const c = rainbowAt(k, i / 7), r0 = poll.clone().add(V(k.range(-.05, .05), .06, .05)), fwd = V((i - 3.5) * .12, .15, 1).normalize();
    lockOf([r0, r0.clone().addScaledVector(fwd, .1).add(V(0, .03, 0)), r0.clone().addScaledVector(fwd, .2).add(V((i - 3.5) * .025, -.04, 0)), r0.clone().addScaledVector(fwd, .26).add(V((i - 3.5) * .04, -.15, 0))], .032, c, { seg: 16, flat: .5 });
  }
  // the tail: a full plume from the top of the rump, dipping and sweeping out behind it in a big S, curling up at the
  // end; rainbow bands stacked from top to bottom
  const dock = toU(0, 1.4, -.86);
  const spine = curveOf(k, [[0, 0, 0], [0, -.05, -.22], [0, -.28, -.5], [0, -.42, -.86], [0, -.28, -1.22], [0, .04, -1.44], [0, .34, -1.47], [0, .5, -1.3]].map(([x, y, z]) => [dock.x + x, dock.y + y, dock.z + z]));
  const wOf = f => .03 + .24 * Math.sin(Math.PI * Math.min(1, f * 1.1)) ** .8;
  for (let i = 0; i < 42; i++) {
    const ang = k.rand() * TAU, rr = Math.sqrt(k.rand()), ox = Math.cos(ang) * rr, oy = Math.sin(ang) * rr, c = rainbowAt(k, clamp(.5 - oy * .5 + k.range(-.06, .06)));
    const ph = k.rand() * TAU, end = k.range(.82, 1), pts = [];
    for (let j = 0; j <= 9; j++) {
      const f = j / 9 * end, P = spine.getPointAt(f), Tn = spine.getTangentAt(f), N = new T.Vector3(0, 1, 0).addScaledVector(Tn, -Tn.y).normalize(), w = wOf(f);
      pts.push(P.addScaledVector(N, oy * w * .8).add(V(ox * w + .04 * Math.sin(f * 7 + ph) * f, 0, 0)));
    }
    lockOf(pts, k.range(.045, .06), c, { seg: 56, rs: 6, flat: .6, up: [1, 0, 0] });
  }
  k.add(u, k.merge(locksG), hairM);
  // golden hooves
  const hoofGeo = k.lathe([[0, 0], [.078, 0], [.085, .02], [.072, .11], [.06, .13], [0, .13]], { seg: 28 });
  for (const hf of hind) k.add(u, hoofGeo, gold, { p: [hf.x, 0, hf.z + .02] });
  for (const [fet, hf] of front) { const d = hf.clone().sub(fet).normalize(), m = k.mesh(hoofGeo, gold, { p: hf.clone().addScaledVector(d, -.05).toArray() }); aim(k, m, d.clone().negate()); u.add(m); }
  // the lawn it's been grazing: a round patch of grass, and the stripe it ate growing back in rainbow colours
  g.updateMatrixWorld(true);
  const feet = hind.map(h => u.localToWorld(h.clone())), mid = feet[0].clone().lerp(feet[1], .5);
  const cam = camDir(k, 30, 12), across = V(cam.z, 0, -cam.x), s0 = mid.clone().addScaledVector(cam, -.35);
  const LR = 1.4, lc = mid.clone().addScaledVector(cam, .2).add(V(-.05, 0, 0));
  const stripe = (x, z) => { const d = V(x, 0, z).sub(s0), along = d.dot(cam), off = d.dot(across) - .06 * Math.sin(along * 2.2); return { along, off }; };
  const inStripe = (x, z) => { const q = stripe(x, z); return q.along > -.1 && Math.abs(q.off) < .24 ? q : null; };
  const lawnTex = k.tex(384, 384, (c, w, h) => {
    const img = c.createImageData(w, h), d = img.data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = lc.x + (i / w * 2 - 1) * LR, z = lc.z + (j / h * 2 - 1) * LR, r = Math.hypot(i / w * 2 - 1, j / h * 2 - 1), q = inStripe(x, z), n = noise3(x * 12, z * 12, 1);
      let col = mixC(rgb('#3e7a26'), rgb('#6aa83a'), n);
      if (q) { const cc = rainbowAt(k, clamp(.5 + q.off / .48)); col = mixC([cc.r, cc.g, cc.b].map(v => Math.pow(v, 1 / 2.2)), [0, 0, 0], .15 * n); }
      const o = (j * w + i) * 4, a = smooth(.98, .78, r + .22 * (noise3(x * 2.5, z * 2.5, 7) - .5) + .08 * (noise3(x * 9, z * 9, 3) - .5));
      d[o] = col[0] * 255; d[o + 1] = col[1] * 255; d[o + 2] = col[2] * 255; d[o + 3] = a * 255;
    }
    c.putImageData(img, 0, 0);
  }, { cache: 'legends:unicornLawn' });
  const lawn = new T.PlaneGeometry(LR * 2, LR * 2, 1, 1); lawn.rotateX(-Math.PI / 2);
  k.add(g, lawn, k.mat({ map: lawnTex, transparent: true, depthWrite: false, roughness: .85 }), { p: [lc.x, .002, lc.z], shadow: false }).receiveShadow = true;
  const bladeGeo = (() => { const geo = new T.PlaneGeometry(1, 1, 1, 3); geo.translate(0, .5, 0); return warp(geo, (x, y, z) => [x * (1 - y * .9), y, .25 * y * y]); })();
  const blades = [];
  for (let i = 0; i < 2200; i++) {
    const a = k.rand() * TAU, r = LR * .96 * Math.sqrt(k.rand()), x = lc.x + Math.cos(a) * r, z = lc.z + Math.sin(a) * r;
    if (r > LR * (.68 + .22 * noise3(x * 2.5, z * 2.5, 7)) && k.rand() < .75) continue;
    const q = inStripe(x, z), ht = q ? k.range(.025, .05) : k.range(.06, .13) * (1 - .4 * smooth(.6, 1, r / LR));
    const col = q ? rainbowAt(k, clamp(.5 + q.off / .48 + k.range(-.04, .04))) : k.color(k.pick(['#3f7a26', '#4d8a2c', '#5a9a32', '#6aa83c', '#467e28']));
    blades.push({ p: [x, 0, z], r: [k.range(-.3, .3), k.rand() * TAU, k.range(-.3, .3)], order: 'YXZ', s: [q ? .03 : .026, ht, .03], color: col });
  }
  g.add(k.instances(bladeGeo, k.mat({ color: '#ffffff', roughness: .6, side: T.DoubleSide, sheen: .5, sheenColor: C('#ffffff') }), blades));
  // sparkles all round it, and a glint at the tip of the horn
  horn.updateMatrixWorld(true);
  const tip = horn.localToWorld(V(0, .64, 0));
  g.add(k.place(halo(k, .28, '#fff2b0', .75), { p: tip.toArray() }), k.place(sparkle(k, .55, .3), { p: tip.toArray() }));
  const bb = new T.Box3().setFromObject(u, true), sz = bb.getSize(V());
  for (let i = 0; i < 16; i++) {
    const p = V(lerp(bb.min.x, bb.max.x, k.rand()), lerp(bb.min.y + sz.y * .15, bb.max.y, k.rand()), lerp(bb.min.z, bb.max.z, k.rand()));
    g.add(k.place(sparkle(k, k.range(.12, .34), k.rand(), k.pick(['#fff4d2', '#ffd6f4', '#d6ecff', '#fff4d2']), { depthTest: true }), { p: p.toArray() }));
  }
  const dots = [];
  for (let i = 0; i < 40; i++) dots.push({ p: [lerp(bb.min.x, bb.max.x, k.rand()), lerp(bb.min.y + sz.y * .2, bb.max.y, k.rand()), lerp(bb.min.z, bb.max.z, k.rand())], s: k.range(.008, .02) });
  g.add(motes(k, dots, '#fff8e0'));
  g.userData.view = { az: 30, el: 14 };
  g.userData.fullView = { el: 12, zoom: 1.08 };
  return glints(k, g, { az: 30, el: 12 });
}

/* ---------- the golden koi ---------- */
// A sheet grown out from a base line: base(s) → { p, d (the way it grows), len, side } for s in 0–1, r out to the edge.
// o.wave(s, r) → how far it ripples out along `side`. UVs: (s, r).
function finSheet(k, base, o = {}) {
  const T = k.THREE, ns = o.ns ?? 24, nr = o.nr ?? 12, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nr; j++) for (let i = 0; i <= ns; i++) {
    const s2 = i / ns, r = j / nr, b = base(s2), side = b.side ?? new T.Vector3(0, 0, 1);
    const w = o.wave ? o.wave(s2, r) : 0, p = b.p.clone().addScaledVector(b.d, b.len * r).addScaledVector(side, w);
    pos.push(p.x, p.y, p.z); uv.push(s2, r);
  }
  for (let j = 0; j < nr; j++) for (let i = 0; i < ns; i++) { const a = j * (ns + 1) + i, b = a + 1, c = a + ns + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// Translucent fin: fine rays from the root (u along the root, v out to the edge), gold at the root fading to clear white,
// with orange streaks. Drawn once, shared by every fin.
function finMat(k) {
  const tex = k.tex(256, 256, (c, w, h) => {
    const R2 = rng(515), img = c.createImageData(w, h), d = img.data;
    for (let j = 0; j < h; j++) {
      const v = j / h;
      for (let i = 0; i < w; i++) {
        const u = i / w, ray = Math.pow(Math.abs(Math.sin(u * Math.PI * 22)), 18), streak = smooth(.55, .8, noise3(u * 7, v * 1.5, 3));
        const col = mixC(mixC(rgb('#ffd36a'), rgb('#fff6e4'), smooth(.1, .8, v)), rgb('#ff7a2a'), streak * .7 * smooth(.9, .3, v));
        const a = (.85 - .55 * smooth(.05, .95, v)) * (1 - smooth(.94, 1, v)) + ray * .35 * (1 - v);
        const o = ((h - 1 - j) * w + i) * 4;
        d[o] = Math.min(1, col[0] + ray * .1) * 255; d[o + 1] = Math.min(1, col[1] + ray * .1) * 255; d[o + 2] = Math.min(1, col[2] + ray * .1) * 255; d[o + 3] = clamp(a) * 255;
      }
    }
    c.putImageData(img, 0, 0);
  }, { cache: 'legends:koiFin' });
  return k.mat({ map: tex, transparent: true, depthWrite: false, side: k.THREE.DoubleSide, roughness: .2, metalness: .2, clearcoat: .6, clearcoatRoughness: .15,
    iridescence: .6, iridescenceIOR: 1.4, iridescenceThicknessRange: [250, 600], emissive: '#ffb050', emissiveMap: tex, emissiveIntensity: .25 });
}
// A lotus flower: three rings of cupped pink petals round a golden seed head, standing on y = 0.
function lotus(k, R) {
  const T = k.THREE, g = k.group();
  const petalTex = k.tex(64, 128, (c, w, h) => {
    const gr = c.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#fff4f6'); gr.addColorStop(.5, '#ffc2d6'); gr.addColorStop(1, '#f25a92');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(214,70,120,.35)'; c.lineWidth = 1;
    for (let i = 1; i < 8; i++) { const x = i / 8 * w; c.beginPath(); c.moveTo(w / 2 + (x - w / 2) * .3, h); c.quadraticCurveTo(x, h * .5, w / 2 + (x - w / 2) * .5, 0); c.stroke(); }
  }, { cache: 'legends:lotusPetal' });
  const petalM = k.mat({ map: petalTex, side: T.DoubleSide, roughness: .45, sheen: .8, sheenColor: k.color('#ffffff'), clearcoat: .3 });
  const petal = (len, wid, cup) => surface(k, 8, 12, (uu, vv) => {
    const x = (uu * 2 - 1), w = wid * Math.pow(Math.sin(Math.PI * Math.min(1, .05 + vv * .95)), .75) * (1 - .25 * vv);
    return [x * w, vv * len, -cup * (1 - x * x) * w - .15 * len * vv * vv];
  });
  const rings = [[8, 1, .15, .78, .5], [8, .82, .45, .8, .42], [6, .62, .95, .7, .35]];
  rings.forEach(([n, sc, open, wid, cup], ri) => {
    const geo = petal(R * sc, R * .42 * wid, cup);
    for (let i = 0; i < n; i++) {
      const a = (i + ri * .5) / n * TAU;
      const m = k.mesh(geo, petalM, { p: [0, R * .08, 0] });
      m.rotation.order = 'YXZ'; m.rotation.set(-(1.2 - open * .9), a, 0); g.add(m);
    }
  });
  k.add(g, k.cyl(R * .2, R * .16, R * .16, { seg: 24 }), k.mat({ color: '#f2c83a', roughness: .5 }), { p: [0, R * .2, 0] });
  const pits = []; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, r = i ? R * .11 : 0; pits.push({ p: [Math.cos(a) * r, R * .282, Math.sin(a) * r], s: R * .025 }); }
  g.add(k.instances(k.sphere(1, { w: 8, h: 6 }), k.matte('#a88a1a', .6), pits));
  const stamens = []; for (let i = 0; i < 26; i++) { const a = i / 26 * TAU; stamens.push({ p: [Math.cos(a) * R * .23, R * .22, Math.sin(a) * R * .23], r: [Math.sin(a) * .5, 0, -Math.cos(a) * .5], s: [1, 1, 1] }); }
  g.add(k.instances(k.cyl(R * .012, R * .01, R * .14, { seg: 5 }), k.matte('#ffd84a', .5), stamens));
  return g;
}

function koiModel(k) {
  const T = k.THREE, g = k.group(), C = h => k.color(h), V = (x, y, z) => new T.Vector3(x, y, z);
  const RP = 1.3, WY = .15;                                              // pond radius and the water's surface
  // ---- the pond: a ring of stones, dark water over a pebbled bottom, lily pads and a lotus ----
  const rock = seed => {
    const R2 = rng(seed), waves = Array.from({ length: 6 }, () => [V(R2() * 2 - 1, R2() * 2 - 1, R2() * 2 - 1).normalize(), 1.5 + R2() * 2.5, R2() * TAU, .03 + R2() * .06]);
    return warp(new T.IcosahedronGeometry(1, 3), (x, y, z) => { let f = 1; for (const [d, fr, ph, a] of waves) f += a * Math.sin((d.x * x + d.y * y + d.z * z) * fr + ph); return [x * f, Math.max(y * f, -.35), z * f]; });
  };
  const stoneTex = k.tex(256, 256, (c, w, h) => {
    const R2 = rng(612); c.fillStyle = '#b3aa9c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(${R2() < .5 ? '96,90,82' : '200,192,176'},${.15 + R2() * .25})`; c.beginPath(); c.ellipse(R2() * w, R2() * h, 10 + R2() * 30, 6 + R2() * 16, R2() * 3, 0, TAU); c.fill(); }
    for (let i = 0; i < 2400; i++) { const v = R2(); c.fillStyle = v < .5 ? `rgba(60,56,52,${.2 + R2() * .4})` : `rgba(240,236,228,${.2 + R2() * .4})`; c.fillRect(R2() * w, R2() * h, 1 + R2() * 2, 1 + R2() * 2); }
  }, { cache: 'legends:koiStone', repeat: 2 });
  const stoneM = k.mat({ map: stoneTex, bumpMap: stoneTex, bumpScale: 2, roughness: .75, clearcoat: .2 });
  const rocks = [rock(11), rock(12), rock(13)], lists = [[], [], []], NS = 17;
  for (let i = 0; i < NS; i++) {
    const a = (i + k.range(-.15, .15)) / NS * TAU, sw = k.range(.3, .38);
    lists[i % 3].push({ p: [Math.cos(a) * (RP + .1), .07, Math.sin(a) * (RP + .1)], r: [k.range(-.1, .1), -a + k.range(-.2, .2), k.range(-.1, .1)], s: [sw * .62, k.range(.12, .16), sw * .9], color: k.pick(['#aaa396', '#948d82', '#bdb5a8', '#8a847a', '#a39a8c']) });
  }
  rocks.forEach((geo, i) => g.add(k.instances(geo, stoneM, lists[i])));
  // the bottom, dark and pebbly
  const bedTex = k.tex(256, 256, (c, w, h) => {
    const R2 = rng(613), gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, '#1f4a4a'); gr.addColorStop(1, '#10282c');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(${R2() < .5 ? '60,90,80' : '20,40,40'},${.3 + R2() * .4})`; c.beginPath(); c.ellipse(R2() * w, R2() * h, 2 + R2() * 5, 2 + R2() * 4, R2() * 3, 0, TAU); c.fill(); }
  }, { cache: 'legends:koiBed' });
  k.add(g, k.disc(RP + .1, 48), k.mat({ map: bedTex, roughness: .9 }), { p: [0, .01, 0], r: [-Math.PI / 2, 0, 0], shadow: false });
  // the water: glassy and dark, a little see-through
  const water = k.mat({ color: '#0f3e4c', roughness: .04, metalness: .2, transparent: true, opacity: .8, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 1.8, depthWrite: false });
  k.add(g, k.disc(RP + .02, 64), water, { p: [0, WY, 0], r: [-Math.PI / 2, 0, 0], shadow: false }).renderOrder = 2;
  // ---- the koi, leaping: its body arched in the plane facing the camera ----
  const leap = k.group([], { p: [.08, -.1, .05], r: [0, k.deg(30), 0], s: 1.22 }); g.add(leap);
  const spinePts = [V(-.64, 1.62, 0), V(-.3, 1.66, 0), V(.04, 1.5, 0), V(.32, 1.2, 0), V(.5, .88, 0), V(.58, .6, 0)];
  const kw = keys([[0, .07], [.06, .13], [.17, .18], [.34, .215], [.55, .17], [.8, .085], [1, .055]]), kh = keys([[0, .08], [.06, .15], [.17, .24], [.34, .29], [.55, .23], [.8, .11], [1, .075]]);
  // scales: overlapping rows of gold, orange-red patches over the back and head, a pale belly; the gill cover behind the eye
  const NR = 30, NC = 30, headEnd = .17;
  const scaleAt = (u, v) => {
    const row = (u - headEnd) / (1 - headEnd) * NR, ri = Math.floor(row), col = v * NC + (ri & 1 ? .5 : 0), fr = row - ri, fc = col - Math.floor(col);
    const d = Math.hypot(fr + .32, (fc - .5) * 1.08);
    return { edge: u > headEnd ? bell(d, .8, .06) : 0, lit: u > headEnd ? smooth(.35, .78, d) : .6 };
  };
  const patchAt = (u, v) => {
    const a = v * TAU, sa = Math.sin(a), n = noise3(u * 5.5 + 3, Math.cos(a) * 1.6, sa * 1.6 + 2);
    return clamp(smooth(.5, .56, n) * smooth(-.35, .1, sa) + smooth(.13, .1, u) * smooth(.2, .6, sa));
  };
  const skinMap = uvTex(k, 768, 384, (u, v) => {
    const a = v * TAU, sa = Math.sin(a), sc = scaleAt(u, v), pt = patchAt(u, v);
    let c = mixC(rgb('#c98a1c'), rgb('#ffd65a'), .35 + .65 * sc.lit);
    c = mixC(c, mixC(rgb('#c8340e'), rgb('#ff6a26'), sc.lit), pt);
    c = mixC(c, rgb('#fff2cf'), smooth(-.35, -.75, sa) * .8);
    c = mixC(c, rgb('#6a3a08'), sc.edge * .55);
    const gill = bell(u - .012 * Math.cos(a * 2), .158, .006) * smooth(-.8, -.2, sa);
    return mixC(c, rgb('#8a5010'), gill * .7);
  }, { cache: 'legends:koiSkin' });
  const skinBump = uvTex(k, 768, 384, (u, v) => { const sc = scaleAt(u, v), a = v * TAU, gill = bell(u - .012 * Math.cos(a * 2), .158, .006); const x = .55 + .45 * sc.lit - .6 * sc.edge - .5 * gill; return [x, x, x]; }, { cache: 'legends:koiBump', data: true });
  const body = sweep(k, spinePts, (t, a) => { const e = ends(t, .05, 0); return [kw(t) * e, kh(t) * e * (1 + .08 * Math.sin(a))]; }, { seg: 72, rs: 40, side: [0, 0, 1] });
  k.add(leap, body, k.mat({ map: skinMap, bumpMap: skinBump, bumpScale: 2.2, metalness: .9, roughness: .24, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: 1.5 }));
  const at = body.userData.at;
  // eyes, mouth, barbels
  const eyeM = eyeMat(k, ['#2a1802', '#f0b030'], { ia: .95, pa: .5, white: '#6a4a10' });
  for (const sd of [1, -1]) {
    const q = at(.075, sd > 0 ? .5 : Math.PI - .5), e = k.add(leap, k.sphere(.036, { w: 18, h: 12 }), eyeM, { p: q.p.clone().addScaledVector(q.n, -.01).toArray() });
    e.quaternion.setFromUnitVectors(V(0, 0, 1), q.n); e.userData.eye = .036;
  }
  const tip = spinePts[0], fwd = spinePts[0].clone().sub(spinePts[1]).normalize(), dn = V(fwd.y, -fwd.x, 0).multiplyScalar(-1);
  const mouth = k.group([], { p: tip.clone().addScaledVector(fwd, -.012).toArray() }); aim(k, mouth, fwd); leap.add(mouth);
  k.add(mouth, k.torus(.032, .014, { rs: 8, ts: 20 }), k.mat({ color: '#e8904a', roughness: .35, clearcoat: .8 }), { r: [Math.PI / 2, 0, 0], s: [1, 1, .8] });
  k.add(mouth, k.disc(.03, 16), k.matte('#3a1406', .7), { r: [-Math.PI / 2, 0, 0], p: [0, .004, 0] });
  const barbels = [];
  for (const sd of [1, -1]) for (const [back, len] of [[.03, .12], [.07, .08]]) {
    const r0 = tip.clone().addScaledVector(fwd, -back).addScaledVector(dn, .045).add(V(0, 0, sd * .045));
    barbels.push(varTube(k, curveOf(k, [r0, r0.clone().addScaledVector(dn, len * .5).add(V(0, 0, sd * .02)), r0.clone().addScaledVector(dn, len).addScaledVector(fwd, -len * .5).add(V(0, 0, sd * .03))]), (s2, L) => .009 * (1 - .7 * s2 / L), { seg: 10, rs: 6 }));
  }
  k.add(leap, k.merge(barbels), k.mat({ color: '#ffc85a', metalness: .6, roughness: .3 }));
  // the long, flowing fins
  const fin = finMat(k), fins = [];
  const Tn = t => body.userData.curve.getTangentAt(t), Z = V(0, 0, 1), dorsalN = t => new T.Vector3().crossVectors(Z, Tn(t)).normalize();
  // dorsal: a long ridge down the back, streaming back
  fins.push(finSheet(k, s2 => { const t = lerp(.26, .64, s2), q = at(t, Math.PI / 2, -.01); return { p: q.p, d: dorsalN(t).multiplyScalar(.8).addScaledVector(Tn(t), .5 + .5 * s2).normalize(), len: lerp(.2, .3, s2) * (1 - .6 * smooth(.85, 1, s2)) + .02, side: Z }; },
    { ns: 24, nr: 10, wave: (s2, r) => .035 * r * Math.sin(r * 4 + s2 * 9) }));
  // tail: a big split fan, its two lobes trailing long
  const tEnd = spinePts[5], tT = Tn(1), tN = dorsalN(1);
  fins.push(finSheet(k, s2 => { const f = s2 * 2 - 1, d = tT.clone().multiplyScalar(Math.cos(f * .95)).addScaledVector(tN, Math.sin(f * .95)).normalize(); return { p: tEnd.clone().addScaledVector(tN, f * .07).addScaledVector(tT, -.03), d, len: .44 + .46 * Math.pow(Math.abs(f), 1.3), side: Z }; },
    { ns: 32, nr: 16, wave: (s2, r) => .08 * r * r * Math.sin(r * 4.5 + s2 * 7) }));
  // pectoral, pelvic and anal fins: long and ribbon-like, flowing back and out
  for (const sd of [1, -1]) {
    fins.push(finSheet(k, s2 => { const t = lerp(.19, .26, s2), q = at(t, -Math.PI / 2 + sd * .8, -.01); return { p: q.p, d: Tn(t).multiplyScalar(.55).addScaledVector(Z, sd * .3).addScaledVector(dorsalN(t), -.85 + .45 * s2).normalize(), len: .62 - .18 * s2, side: Z }; },
      { ns: 10, nr: 14, wave: (s2, r) => .08 * r * r * Math.sin(r * 5 + s2 * 3) }));
    fins.push(finSheet(k, s2 => { const t = lerp(.5, .55, s2), q = at(t, -Math.PI / 2 + sd * .5, -.01); return { p: q.p, d: Tn(t).multiplyScalar(.8).addScaledVector(Z, sd * .4).addScaledVector(dorsalN(t), -.45).normalize(), len: .36, side: dorsalN(t) }; },
      { ns: 8, nr: 10, wave: (s2, r) => .04 * r * r * Math.sin(r * 5 + s2 * 3) }));
  }
  fins.push(finSheet(k, s2 => { const t = lerp(.7, .77, s2), q = at(t, -Math.PI / 2, -.01); return { p: q.p, d: Tn(t).multiplyScalar(.7).addScaledVector(dorsalN(t), -.7).normalize(), len: .18, side: Z }; }, { ns: 8, nr: 8 }));
  const finMesh = k.add(leap, k.merge(fins), fin, { shadow: false }); finMesh.renderOrder = 3;
  // ---- where it burst out: a crown of water, rings spreading, drops flying ----
  g.updateMatrixWorld(true);
  const tailW = leap.localToWorld(spinePts[5].clone()), sp = V(tailW.x + .05, WY, tailW.z + .05);
  // (a sheet of water: clear at the bottom, streaked, frothing white along its torn top edge)
  const sheetTex = k.tex(128, 128, (c, w, h) => {
    const R2 = rng(733), gr = c.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, 'rgba(220,245,255,.08)'); gr.addColorStop(.6, 'rgba(230,248,255,.35)'); gr.addColorStop(.88, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,.95)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { const x = R2() * w; c.strokeStyle = `rgba(255,255,255,${.1 + R2() * .25})`; c.lineWidth = 1 + R2() * 2; c.beginPath(); c.moveTo(x, h); c.lineTo(x + (R2() - .5) * 10, h * (.1 + R2() * .4)); c.stroke(); }
  }, { cache: 'legends:koiSheet' });
  const wetM = k.mat({ color: '#ffffff', map: sheetTex, roughness: .03, metalness: 0, transparent: true, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 2.4, side: T.DoubleSide, depthWrite: false });
  // (ragged jets of different heights and widths round the rim)
  const jets = Array.from({ length: 14 }, (_, i) => [(i + .5 * (hash3(i, 3, 9) - .5)) / 14 * TAU, .3 + .7 * hash3(i, 5, 1), .1 + .12 * hash3(i, 8, 2)]);
  const spikeH = a => { let h = 0; for (const [c, ht, w] of jets) { let d = Math.abs(a - c); d = Math.min(d, TAU - d); h = Math.max(h, ht * Math.exp(-((d / w) ** 2))); } return h; };
  const crown = surface(k, 140, 10, (uu, vv) => {
    const a = uu * TAU, spike = spikeH(a), h = (.12 + .3 * spike) * vv, r = .19 + (.12 + .1 * spike) * vv * vv;
    return [sp.x + Math.cos(a) * r, WY + h, sp.z + Math.sin(a) * r];
  });
  k.add(g, crown, wetM, { shadow: false }).renderOrder = 4;
  const ringM = k.mat({ color: '#ffffff', roughness: .1, transparent: true, opacity: .45, depthWrite: false });
  for (const [r, th] of [[.3, .014], [.5, .011], [.72, .008]]) k.add(g, k.torus(r, th, { rs: 6, ts: 72 }), ringM, { p: [sp.x, WY + .004, sp.z], r: [Math.PI / 2, 0, 0], s: [1, 1, .35], shadow: false });
  const dropM = k.mat({ color: '#f2fbff', roughness: .02, transparent: true, opacity: .55, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 2.6, depthWrite: false });
  const drops = [], shine = [], light = V(-.5, .8, .4).normalize();
  const drop = (p, r, dir) => { drops.push({ p: p.toArray(), r: eulerTo(k, dir), s: [r, r * 1.5, r] }); shine.push({ p: p.clone().addScaledVector(light, r * .6).toArray(), s: r * .32 }); };
  for (const [a, ht] of jets) { if (ht < .5) continue; const r = .19 + .12 + .1 * ht + .03 + .02 * ht; drop(V(sp.x + Math.cos(a) * r, WY + .12 + .3 * ht + .04, sp.z + Math.sin(a) * r), k.range(.02, .032), V(Math.cos(a), 1.5, Math.sin(a))); }
  for (let i = 0; i < 26; i++) {
    const a = k.rand() * TAU, out = k.range(.3, .9), up = k.range(.3, 1.1) * (1.1 - out * .6);
    drop(V(sp.x + Math.cos(a) * out, WY + up, sp.z + Math.sin(a) * out * .8), k.range(.012, .03), V(Math.cos(a), .4, Math.sin(a)));
  }
  // and a trail of drops shed from its fins and belly along the arc
  for (let i = 0; i < 18; i++) { const t = k.range(.35, 1), P = leap.localToWorld(body.userData.curve.getPointAt(t)); drop(P.add(V(k.range(-.2, .2), -k.range(.15, .45), k.range(-.1, .25))), k.range(.012, .026), V(0, -1, 0)); }
  const dropMesh = k.instances(k.sphere(1, { w: 12, h: 8 }), dropM, drops); dropMesh.castShadow = false; dropMesh.renderOrder = 5; g.add(dropMesh);
  g.add(motes(k, shine, '#ffffff'));
  // ---- lily pads and a lotus ----
  const padTex = k.tex(256, 256, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, '#8cc63c'); gr.addColorStop(.7, '#4f9a2a'); gr.addColorStop(1, '#2f6a1c');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(200,236,140,.5)'; c.lineWidth = 2;
    for (let i = 0; i < 22; i++) { const a = i / 22 * TAU; c.beginPath(); c.moveTo(w / 2, h / 2); c.quadraticCurveTo(w / 2 + Math.cos(a + .2) * w * .25, h / 2 + Math.sin(a + .2) * h * .25, w / 2 + Math.cos(a) * w * .5, h / 2 + Math.sin(a) * h * .5); c.stroke(); }
    c.strokeStyle = 'rgba(120,40,40,.5)'; c.lineWidth = 5; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 3, 0, TAU); c.stroke();
  }, { cache: 'legends:koiPad' });
  const padM = k.mat({ map: padTex, roughness: .3, clearcoat: .8, clearcoatRoughness: .15, side: T.DoubleSide });
  for (const [x, z, r, rot] of [[-.72, .42, .26, .5], [-.3, .82, .2, 2.4], [.6, .7, .22, -1.2], [-.85, -.35, .21, 3.6], [.85, .05, .17, 1.9]]) {
    const pad = warp(new T.CircleGeometry(r, 40, .22, TAU - .44), (px, py, pz) => { const d = Math.hypot(px, py) / r; return [px, py, .025 * r * d * d * 4]; });
    pad.rotateX(-Math.PI / 2);
    k.add(g, pad, padM, { p: [x, WY + .006, z], r: [0, rot, 0], shadow: false });
  }
  const lo = lotus(k, .26); lo.position.set(-.7, WY + .01, .45); lo.rotation.y = .4; g.add(lo);
  // glints on the gold
  for (const [t, a, sz] of [[.3, .9, .5], [.55, .5, .32], [.12, .7, .26]]) { const q = at(t, a, .02); g.add(k.place(sparkle(k, sz, k.rand()), { p: leap.localToWorld(q.p.clone()).toArray() })); }
  g.userData.view = { az: 30, el: 22 };
  g.userData.fullView = { el: 18 };
  return glints(k, g, { az: 30, el: 22 });
}

export default {
  // A perfect fairy ring on a mossy mound: red, white-spotted toadstools and softly glowing ones in a circle, fairy lights
  // drifting over it, and a little fairy with glowing wings hovering in the middle.
  fairyring: k => fairyRingModel(k),

  // A big amethyst geode cracked open in two halves on a heap of sandbox sand: a rough grey-brown rind, bands of agate
  // and white quartz, and the hollow packed with glittering violet crystal points.
  geode: k => geodeModel(k),

  // A big metallic-gold koi with orange-red patches and long, flowing see-through fins, leaping out of a little round
  // stone-edged pond with lily pads and a pink lotus, water splashing up behind it.
  goldenkoi: k => koiModel(k),

  // The backyard cryptid: a huge, shaggy Bigfoot mid-stride, turning its head to look straight at you, a stolen tomato in
  // its hand and its giant footprints pressed into the grass behind it.
  bigfoot: k => bigfootModel(k),

  // A white unicorn rearing up: a spiralled golden horn, a flowing rainbow mane and tail, golden hooves, sparkles all
  // round, and the stripe of lawn it just ate growing back in rainbow colours.
  unicorn: k => unicornModel(k),
};
