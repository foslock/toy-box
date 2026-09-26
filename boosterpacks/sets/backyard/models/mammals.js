// Models for the Backyard set's mammals cards. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const bell = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));

// Smooth 3D value noise in 0–1, for mottled (agouti, grizzled) fur colours.
const hash3 = (x, y, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), f = t => t * t * (3 - 2 * t), u = f(x - xi), v = f(y - yi), w = f(z - zi);
  let r = 0;
  for (let c = 0; c < 8; c++) { const dx = c & 1, dy = c >> 1 & 1, dz = c >> 2 & 1; r += hash3(xi + dx, yi + dy, zi + dz) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w); }
  return r;
}
// Mottle a colour: darker and lighter patches about 1/scale across, by up to ±amount.
const mottle = (c, p, amount = .1, scale = 9) => c.multiplyScalar(1 + amount * (2 * (.65 * noise3(p.x * scale, p.y * scale, p.z * scale) + .35 * noise3(p.x * scale * 2.3 + 7, p.y * scale * 2.3, p.z * scale * 2.3)) - 1));

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
// An ellipsoid (centre c, radii r) as a blob, optionally with a colour function over its directions.
const ovoid = (k, c, r, o = {}) => blob(k, (x, y, z) => [c[0] + x * r[0], c[1] + y * r[1], c[2] + z * r[2]], o);

// Move a part (made with sweep() or blob()) by a matrix, turning its fur's comb with it.
function bake(k, geo, m) {
  geo.applyMatrix4(m);
  const cb = geo.attributes.comb, v = new k.THREE.Vector3(), n3 = new k.THREE.Matrix3().getNormalMatrix(m);
  if (cb) for (let i = 0; i < cb.count; i++) { v.fromBufferAttribute(cb, i).applyMatrix3(n3); cb.setXYZ(i, v.x, v.y, v.z); }
  return geo;
}
// A matrix from { p, r, s } (like k.place).
const mtx = (k, o) => { const g = k.place(new k.THREE.Object3D(), o); g.updateMatrix(); return g.matrix; };
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

// A point on an ellipsoid (centre c, radii r) in direction d, with the surface normal there.
function onBall(k, c, r, d) {
  const T = k.THREE, u = new T.Vector3(...d).normalize();
  return { p: new T.Vector3(c[0] + r[0] * u.x, c[1] + r[1] * u.y, c[2] + r[2] * u.z), n: new T.Vector3(u.x / r[0], u.y / r[1], u.z / r[2]).normalize() };
}
// Turn an object so its own axis (default +y) points along n.
const aim = (k, obj, n, axis = [0, 1, 0]) => { obj.quaternion.setFromUnitVectors(new k.THREE.Vector3(...axis), n.clone().normalize()); return obj; };

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
  }, { repeat: o.repeat ?? 2.5, cache: 'mammals-fur' });
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
const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
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
  }, { data: true, repeat: o.density ?? 9, cache: 'mammals-strands' });
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
      mat.customProgramCacheKey = () => 'mammals-soft-shell';
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

// A lock of fur (or a spine, a feather of hair): root at the origin, lying along +y with length 1, flattened in z and
// curling its tip toward -z (lay -z against the skin). Vertex colours fade from root to tip.
function lockGeo(k, root, tip, o = {}) {
  const T = k.THREE, pts = o.pts ?? [[0, 0], [.36, .1], [.42, .32], [.32, .62], [.15, .86], [0, 1]];
  const geo = k.lathe(pts, { smooth: true, seg: o.seg ?? 8, samples: o.samples ?? 12 });
  const p = geo.attributes.position, cols = [], c0 = k.color(root), c1 = k.color(tip), c = new T.Color();
  const stops = o.stops?.map(([y, h]) => [y, k.color(h)]);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setZ(i, p.getZ(i) * (o.flat ?? .45) - (o.curl ?? .18) * y * y);
    if (stops) {
      let j = 0; while (j < stops.length - 2 && y > stops[j + 1][0]) j++;
      c.copy(stops[j][1]).lerp(stops[j + 1][1], smooth(stops[j][0], stops[j + 1][0], y));
    } else c.copy(c0).lerp(c1, smooth(o.from ?? .15, o.to ?? 1, y));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
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

// A strap hugging a sweep() at t (a collar, a band): a rounded h × th section carried all the way round, lifted by lift.
function strap(k, geo, t, h, th, lift = 0, n = 72) {
  const T = k.THREE, r = Math.min(h, th) * .45, prof = [], pos = [], idx = [];
  const cs = [[h / 2 - r, th - r], [-h / 2 + r, th - r], [-h / 2 + r, r], [h / 2 - r, r]];
  for (let c = 0; c < 4; c++) for (let i = 0; i <= 3; i++) { const a = c * Math.PI / 2 + i / 3 * Math.PI / 2; prof.push([cs[c][0] + Math.cos(a) * r, cs[c][1] + Math.sin(a) * r]); }
  const m = prof.length;
  for (let j = 0; j <= n; j++) {
    const q = geo.userData.at(t, j / n * TAU, lift);
    for (const [u, w] of prof) { const v = q.p.clone().addScaledVector(q.t, u).addScaledVector(q.n, w); pos.push(v.x, v.y, v.z); }
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < m; i++) { const a = j * m + i, b = j * m + (i + 1) % m; idx.push(a, a + m, b, b, a + m, b + m); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return weld(g);
}

// A leaf (or any thin blade) along a path: width(v) across it, disp(u, v, w) lifts it off its plane (ruffles, a cupped
// middle). u runs -1..1 across, v 0..1 along; UVs match, so a painted texture's x is across and y is along (tip at the top).
function blade(k, pts, width, o = {}) {
  const T = k.THREE, curve = curveOf(k, pts), nv = o.nv ?? 40, nu = o.nu ?? 16, side = new T.Vector3(...(o.side ?? [1, 0, 0])).normalize();
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nv; i++) {
    const v = i / nv, P = curve.getPointAt(v), Tn = curve.getTangentAt(v);
    const S = side.clone().addScaledVector(Tn, -side.dot(Tn)).normalize(), N = new T.Vector3().crossVectors(Tn, S).normalize(), w = width(v);
    for (let j = 0; j <= nu; j++) {
      const u = j / nu * 2 - 1, p = P.clone().addScaledVector(S, u * w).addScaledVector(N, o.disp ? o.disp(u, v, w) : 0);
      pos.push(p.x, p.y, p.z); uv.push(j / nu, v);
    }
  }
  for (let i = 0; i < nv; i++) for (let j = 0; j < nu; j++) { const a = i * (nu + 1) + j, b = a + nu + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// A glossy eye at p looking along n (radius r); catchlights() later puts a glint on it where the camera will see one.
function eye(k, parent, p, n, r, mat, o = {}) {
  const T = k.THREE, e = k.group([], { p: p.toArray ? p.toArray() : p });
  e.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), n.clone().normalize());
  k.add(e, k.sphere(r, { w: 32, h: 24 }), mat, { s: o.s ?? 1 });
  e.userData.eyeR = r; e.userData.glint = o.glint ?? .2; e.userData.lim = o.lim ?? .85;
  parent.add(e);
  return e;
}
// One tiny glowing glint per eye, where the key light (from the viewer's upper left) would reflect to the camera.
function catchlights(k, g, view = {}) {
  const T = k.THREE, az = k.deg(view.az ?? 30), el = k.deg(view.el ?? 16), ka = az - 1, ke = k.deg(50);
  const cam = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const key = new T.Vector3(Math.sin(ka) * Math.cos(ke), Math.sin(ke), Math.cos(ka) * Math.cos(ke));
  const h = cam.add(key).normalize(), glint = k.glow('#ffffff', 1.1);
  g.updateMatrixWorld(true);
  const list = []; g.traverse(o => { if (o.userData.eyeR) list.push(o); });
  for (const e of list) {
    const c = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
    e.matrixWorld.decompose(c, q, s);
    const n = new T.Vector3(0, 0, 1).applyQuaternion(q), r = e.userData.eyeR * s.x, ang = n.angleTo(h);
    let d = h.clone();
    if (ang > e.userData.lim) d = n.clone().applyQuaternion(new T.Quaternion().setFromAxisAngle(new T.Vector3().crossVectors(n, h).normalize(), e.userData.lim));
    k.add(g, k.sphere(r * e.userData.glint, { w: 12, h: 8 }), glint, { p: c.addScaledVector(d, r * .96).toArray(), shadow: false });
  }
}

// Thin whiskers from a muzzle: a fan of fine tubes. root: [x, y, z], dirs: list of [x, y, z] tips (relative to root).
function whiskers(k, parent, root, tips, r, mat) {
  for (const tip of tips) {
    const mid = [root[0] + tip[0] * .5, root[1] + tip[1] * .5 + Math.abs(tip[0]) * .06, root[2] + tip[2] * .5];
    k.add(parent, k.tube([root, mid, [root[0] + tip[0], root[1] + tip[1], root[2] + tip[2]]], r, { seg: 12, rs: 4 }), mat, { shadow: false });
  }
}

// An eastern grey squirrel sitting up on its haunches with an acorn, its big bushy tail curling up behind.
function squirrelModel(k) {
  const g = k.group(), s = k.group([], { r: [0, -.35, 0] }); g.add(s);
  const C = h => k.color(h);
  const grey = C('#7e8084'), warm = C('#8f7866'), cream = C('#f2efe8'), dusk = C('#5f6064');
  const parts = [];
  // body: haunches up to the neck, sitting up and leaning a little forward
  const brx = keys([[0, .5], [.18, .56], [.43, .45], [.68, .33], [.86, .26], [1, .23]]), bry = keys([[0, .46], [.18, .5], [.43, .41], [.68, .3], [.86, .24], [1, .21]]);
  parts.push(sweep(k, [[0, 0, -.16], [0, .42, -.12], [0, .8, 0], [0, 1.08, .12], [0, 1.28, .2], [0, 1.44, .24]], (t, a) => {
    const e = ends(t, .16, .12); return [brx(t) * e, bry(t) * e * (1 + .06 * Math.sin(a))];
  }, { seg: 72, rs: 44, floor: 0, comb: 'back', fur: (t, a) => 1 + .5 * smooth(.3, .9, Math.sin(a)) * smooth(.4, .8, t), color: (t, a, p) => {
    const front = Math.sin(a), side = Math.abs(Math.cos(a));
    const c = grey.clone().lerp(warm, .4 * smooth(.25, -.15, front) * smooth(.5, .9, side));      // a cinnamon wash along the flanks
    mottle(c.lerp(dusk, .35 * smooth(-.4, -.9, front)), p, .08, 11);                             // darker down the back, a little grizzled
    return c.lerp(cream, smooth(.45, .8, front) * smooth(.1, .28, t));
  } }));
  // head: a sweep from the back of the skull to the nose, a little big (it's a collectible)
  const hr = keys([[0, .24], [.18, .33], [.45, .33], [.7, .27], [.88, .2], [1, .165]]);
  const head = sweep(k, [[0, 1.62, .02], [0, 1.58, .27], [0, 1.51, .47], [0, 1.43, .63]], (t, a) => {
    const e = ends(t, .26, .22); return [hr(t) * e * 1.02, hr(t) * e * (.95 - .05 * Math.sin(a))];
  }, { seg: 64, rs: 48, comb: 'back', fur: (t, a) => {
    const lat = Math.abs(Math.cos(a)), ap = Math.atan2(Math.sin(a), lat);
    return lerp(.8, .25, smooth(.5, .9, t)) * (1 - .85 * bell(t, .44, .08) * bell(ap, -.4, .3));
  }, color: (t, a) => {
    const under = Math.sin(a);                    // +1 under the chin, -1 over the top
    const c = grey.clone().lerp(warm, .55 * smooth(-.1, -.8, under) * smooth(.15, .55, t));
    return c.lerp(cream, smooth(.3, .75, under) * smooth(.35, .62, t));
  } });
  parts.push(head);
  // eyes, with pale rings
  const eyeM = k.gloss('#120d0a', { rough: .08 });
  for (const sd of [-1, 1]) {
    const at = head.userData.at(.44, sd > 0 ? -.4 : Math.PI + .4);
    const ring = k.group([], { p: at.p.clone().addScaledVector(at.n, -.012).toArray() }); aim(k, ring, at.n, [0, 0, 1]); s.add(ring);
    k.add(ring, k.torus(.094, .012, { rs: 10, ts: 36 }), k.fabric('#dcd7ce', { weave: false }), { s: [1.12, 1, .6] });
    eye(k, s, at.p.clone().addScaledVector(at.n, -.036), at.n, .094, eyeM);
  }
  // ears: little rounded points
  const inner = k.fabric('#c9a194', { weave: false });
  for (const sd of [-1, 1]) {
    const at = head.userData.at(.2, sd > 0 ? -1.08 : Math.PI + 1.08);
    const em = mtx(k, { p: at.p.clone().addScaledVector(at.n, -.03).toArray(), r: [-.15, sd * .3, sd * -.22] });
    parts.push(bake(k, blob(k, (x, y, z) => [x * .11 * (1 - .45 * Math.max(0, y)), .13 + y * .18, z * .038 + .038 * x * x], { color: () => warm.clone().lerp(grey, .35), fur: .6, w: 24, h: 20 }), em));
    k.add(s, bake(k, blob(k, (x, y, z) => [x * .072 * (1 - .45 * Math.max(0, y)), .12 + y * .125, z * .02 + .03], { w: 20, h: 16 }), em), inner);
  }
  // nose and whiskers
  k.add(s, k.sphere(.052, { w: 20, h: 14 }), k.plastic('#5e3d33', { rough: .4, coat: .4 }), { p: [0, 1.455, .66], s: [1.25, .8, .8] });
  const wh = k.matte('#2a2622', .6);
  for (const sd of [-1, 1]) whiskers(k, s, [sd * .08, 1.41, .62], [[sd * .32, .06, -.06], [sd * .35, -.03, -.03], [sd * .3, -.1, .01]], .004, wh);
  // arms reaching forward to hold the acorn at the chin
  const paw = k.fabric('#6e5a48', { weave: false });
  for (const sd of [-1, 1]) {
    parts.push(sweep(k, [[sd * .17, 1.2, .14], [sd * .26, 1.02, .3], [sd * .22, 1.0, .42], [sd * .09, 1.15, .54]], t => { const r = lerp(.12, .058, smooth(0, .8, t)) * ends(t, .1, .15); return [r, r]; },
      { seg: 28, rs: 18, comb: 'path', fur: .7, color: t => grey.clone().lerp(warm, .45 + .3 * t) }));
    k.add(s, k.sphere(.056, { w: 16, h: 12 }), paw, { p: [sd * .075, 1.19, .58], s: [1, 1.3, .95] });
  }
  // the acorn
  const acorn = k.group([], { p: [0, 1.21, .62], r: [.45, 0, .12] }); s.add(acorn);
  k.add(acorn, k.lathe([[0, -.2], [.04, -.18], [.085, -.1], [.1, 0], [.097, .06], [0, .07]], { smooth: true, seg: 32 }), k.gloss('#a8662f', { rough: .3 }));
  k.add(acorn, k.lathe([[0, .02], [.105, .03], [.118, .07], [.1, .11], [.05, .13], [0, .135]], { smooth: true, seg: 32 }), k.matte('#8c6a44', .9));
  k.add(acorn, k.cyl(.012, .015, .06, { seg: 8 }), k.matte('#6a4c2e', .9), { p: [0, .16, 0] });
  // haunches and long hind feet
  for (const sd of [-1, 1]) {
    parts.push(ovoid(k, [sd * .4, .32, .06], [.22, .3, .4], { color: (x, y, z) => grey.clone().lerp(warm, .5 + .2 * y), w: 40, h: 28, floor: 0 }));
    parts.push(sweep(k, [[sd * .38, .06, 0], [sd * .36, .05, .3], [sd * .32, .045, .52]], t => { const r = lerp(.08, .062, t) * ends(t, .2, .2); return [r * 1.1, r * .8]; },
      { seg: 20, rs: 16, floor: 0, fur: .4, comb: 'path', color: () => warm.clone() }));
  }
  furry(k, s, parts, { len: .035, sheenColor: '#6f6b66' });
  // the tail: an S of fluff rising up the back, its tip flicking out
  const tailPts = [[0, .2, -.36], [0, .22, -.66], [0, .42, -.98], [0, .92, -1.06], [0, 1.42, -.86], [0, 1.84, -.76], [0, 2.12, -.92], [0, 2.2, -1.18]];
  const tr = keys([[0, .14], [.12, .22], [.4, .27], [.75, .25], [1, .15]]);
  const tail = sweep(k, tailPts, t => { const r = tr(t) * ends(t, 0, .07); return [r, r]; }, { seg: 100, rs: 32, comb: 'path',
    fur: t => .6 + .4 * Math.sin(Math.PI * Math.min(1, t * 1.1)), color: () => C('#7a7672') });
  k.add(s, tail, furMat(k, { sheenColor: '#8a8680' }));
  shells(k, s, tail, { n: 16, len: .3, droop: .9, density: 3, shade: [.58, 1.45], sheenColor: '#a8a49e' });
  catchlights(k, g);
  return g;
}

// A golden retriever sitting happily: fluffy golden coat, floppy ears, tongue out, red collar and tag, a tennis ball at his paws.
function goodBoy(k) {
  const T = k.THREE, g = k.group(), d = k.group([], { r: [0, -.44, 0] }); g.add(d);
  const C = h => k.color(h);
  const gold = C('#d89b4f'), light = C('#eecb92'), deep = C('#bb7b36');
  // a short coat everywhere, and long feathering on the chest, the backs of the legs, the britches, the tail and the ears
  const furO = { sheenColor: '#8a6a3a', len: .05, feather: { n: 14, len: .16, density: 4, droop: 1.1, shade: [.86, 1.12] } };
  const body = k.group(); d.add(body);
  const parts = [];
  // torso: from the rump on the ground up through the deep chest to the neck; the fur is longest down the chest
  const trx = keys([[0, .41], [.2, .4], [.45, .37], [.7, .32], [.88, .28], [1, .26]]), tr_y = keys([[0, .42], [.2, .37], [.45, .43], [.7, .36], [.88, .31], [1, .28]]);
  const torso = sweep(k, [[0, .02, -.32], [0, .42, -.22], [0, .8, -.05], [0, 1.1, .1], [0, 1.36, .22], [0, 1.58, .3]], (t, a) => {
    const e = ends(t, .16, .1), front = Math.sin(a); return [trx(t) * e, tr_y(t) * e * (1 + .1 * front + .12 * Math.max(0, front) * bell(t, .5, .15))];
  }, { seg: 80, rs: 48, floor: 0, comb: 'back', fur: (t, a) => 1 + .5 * smooth(.1, .8, Math.sin(a)) * bell(t, .55, .22),
    feather: (t, a) => smooth(.05, .7, Math.sin(a)) * smooth(.3, .45, t) * smooth(.8, .68, t), color: (t, a, p) => {
    const front = Math.sin(a);
    return mottle(gold.clone().lerp(deep, .45 * smooth(-.3, -.9, front)), p, .05, 6).lerp(light, .75 * smooth(.2, .8, front) * smooth(.25, .45, t));
  } });
  parts.push(torso);
  // hind legs: big thighs, feet forward on the ground
  for (const sd of [-1, 1]) {
    parts.push(sweep(k, [[sd * .3, .6, -.4], [sd * .37, .42, -.13], [sd * .35, .27, .13]], (t, a) => { const e = ends(t, .32, .3); return [.2 * e, .3 * e]; },
      { seg: 30, rs: 30, floor: 0, comb: [0, -1, -.4], fur: (t, a) => 1 + .6 * smooth(.3, -.8, Math.sin(a)), feather: (t, a) => .8 * smooth(.2, .9, Math.sin(a)) * smooth(0, .3, t),
        color: (t, a) => gold.clone().lerp(deep, .25 * smooth(0, -1, Math.sin(a))).lerp(light, .3 * smooth(.3, .9, Math.sin(a))) }));
    parts.push(sweep(k, [[sd * .37, .07, -.28], [sd * .38, .07, -.02], [sd * .36, .07, .22]], t => { const e = ends(t, .25, .25); return [.1 * e, .075 * e]; },
      { seg: 20, rs: 16, floor: 0, fur: .5, color: () => gold.clone().lerp(light, .3) }));
  }
  // front legs, feathered down the back, on round paws
  for (const sd of [-1, 1]) {
    parts.push(sweep(k, [[sd * .12, 1.1, .04], [sd * .22, .76, .15], [sd * .22, .38, .27], [sd * .22, .12, .33]], (t, a) => {
      const r = lerp(.16, .112, smooth(.1, .5, t)) * ends(t, .05, .08); return [r, r * 1.08];
    }, { seg: 40, rs: 24, comb: 'path', fur: .7, feather: (t, a) => .75 * smooth(.2, .9, Math.sin(a)) * smooth(.12, .3, t) * smooth(.82, .6, t),
      color: (t, a) => gold.clone().lerp(light, .25 * t + .35 * smooth(.3, .9, Math.sin(a)) * smooth(.2, .5, t)) }));
    const px = sd * .22, pz = .41;
    parts.push(ovoid(k, [px, .07, pz], [.13, .08, .15], { color: () => gold.clone().lerp(light, .35), w: 24, h: 16, floor: 0, fur: .45 }));
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * .06;
      parts.push(ovoid(k, [px + x, .05, pz + .11 - Math.abs(x) * .4], [.038, .05, .05], { color: () => gold.clone().lerp(light, .4), w: 12, h: 10, floor: 0, fur: .35 }));
    }
  }
  // the tail, lying on the ground and curling round his left side
  const tail = sweep(k, [[0, .2, -.42], [.26, .1, -.62], [.58, .085, -.52], [.76, .085, -.22], [.8, .085, .06]], t => { const r = lerp(.1, .07, t) * ends(t, 0, .14); return [r, r * .8]; },
    { seg: 50, rs: 20, side: [0, 1, 0], comb: 'path', fur: 1.4, feather: t => 1.1 * smooth(0, .15, t), color: t => gold.clone().lerp(light, .3 * t) });
  parts.push(tail);
  furry(k, body, parts, furO);
  // collar and tag
  const red = k.plastic('#d4232b', { rough: .45, coat: .4 });
  k.add(body, strap(k, torso, .85, .09, .03, .03), red);
  const front = torso.userData.at(.85, Math.PI / 2, .065);
  const tag = k.group([], { p: front.p.toArray() }); body.add(tag);
  k.add(tag, k.torus(.022, .006, { rs: 6, ts: 16 }), k.gold(), { p: [0, -.02, .01], r: [0, Math.PI / 2, 0] });
  k.add(tag, k.cyl(.062, .062, .014, { seg: 32 }), k.gold(), { p: [0, -.09, .03], r: [Math.PI / 2 - .2, 0, 0] });
  const bone = k.decal(.084, .084, (c, w, h) => {                                      // a bone engraved on the tag
    c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(120,82,20,.85)'; c.translate(w / 2, h / 2); c.rotate(-.5);
    c.fillRect(-w * .26, -h * .07, w * .52, h * .14);
    for (const x of [-1, 1]) for (const y of [-1, 1]) { c.beginPath(); c.arc(x * w * .27, y * h * .085, w * .085, 0, TAU); c.fill(); }
  }, { px: 128, rough: .3 });
  bone.material.metalness = 1; bone.position.set(0, -.09 + .2 * .0076, .03 + .98 * .0076); bone.rotation.set(-.2, 0, 0); tag.add(bone);
  // the buckle, on his left side
  const bk = torso.userData.at(.85, .15, .062), buckle = k.group([], { p: bk.p.toArray() }); aim(k, buckle, bk.n, [1, 0, 0]); body.add(buckle);
  const frame = k.roundRect(.075, .105, .014); frame.holes.push(k.roundRect(.045, .07, .008));
  k.add(buckle, k.extrude(frame, .012, { bevel: .004 }), k.steel(), { r: [0, Math.PI / 2, 0] });
  k.add(buckle, k.box(.008, .012, .075, .003), k.steel(), { p: [.008, 0, 0] });
  // the tennis ball
  const ball = k.group([], { p: [.02, .12, .74], r: [.3, .6, .2] }); body.add(ball);
  k.add(ball, k.sphere(.12, { w: 40, h: 28 }), k.fabric('#d4e83c', { sheen: '#f4ffb0' }));
  const seam = [];
  for (let i = 0; i < 96; i++) { const t = i / 96 * TAU, a = .7, b = .3; seam.push([(a * Math.cos(t) + b * Math.cos(3 * t)) * .121, (a * Math.sin(t) - b * Math.sin(3 * t)) * .121, 2 * Math.sqrt(a * b) * Math.sin(2 * t) * .121]); }
  k.add(ball, k.tube(seam, .007, { closed: true, seg: 192, rs: 6 }), k.matte('#f6f7f0', .6));

  // ---- the head, turned to the camera with a little tilt ----
  const hg = k.group([], { p: [0, 1.5, .17], r: [.06, .52, .1], order: 'YXZ', s: 1.1 }); d.add(hg);
  const hparts = [];
  // skull and muzzle in one: separate top and bottom profiles make the stop, the cheeks and the jaw line; the flews hang at the sides
  const hTop = keys([[0, .2], [.14, .28], [.34, .28], [.47, .21], [.58, .155], [.8, .135], [1, .125]]);
  const hBot = keys([[0, .22], [.14, .28], [.34, .26], [.47, .18], [.58, .14], [.8, .125], [1, .11]]);
  const hW = keys([[0, .23], [.14, .31], [.34, .32], [.47, .25], [.58, .2], [.8, .185], [1, .16]]);
  const head = sweep(k, [[0, .34, -.04], [0, .33, .2], [0, .29, .43], [0, .265, .59], [0, .26, .74]], (t, a) => {
    const e = ends(t, .12, .07), sq = 1 + .1 * smooth(.45, .6, t) * Math.abs(Math.sin(2 * a)), down = (1 + Math.sin(a)) / 2;
    const flew = 1 + .28 * bell(Math.abs(Math.cos(a)), .55, .28) * smooth(.4, .75, down) * smooth(.46, .62, t) * smooth(1, .85, t);
    const lat = Math.abs(Math.cos(a)), ap = Math.atan2(Math.sin(a), lat), brow = 1 + .07 * bell(t, .41, .05) * bell(ap, -.9, .22);
    return [hW(t) * e * sq * brow, lerp(hTop(t), hBot(t), down) * e * sq * flew * brow];
  }, { seg: 96, rs: 56, comb: 'back', fur: (t, a) => {
    const lat = Math.abs(Math.cos(a)), ap = Math.atan2(Math.sin(a), lat), nearEye = bell(t, .43, .07) * bell(ap, -.62, .3);
    return lerp(.7, .2, smooth(.35, .6, t)) * (1 - .9 * nearEye);
  }, color: (t, a) => {
    const down = Math.sin(a);
    const c = gold.clone().lerp(deep, .3 * smooth(-.3, -.9, down) * smooth(.5, .2, t)).lerp(light, .45 * smooth(.45, .75, t) * smooth(-.6, .3, down));
    // under the muzzle: the black lip along its edges, the roof of the open mouth between them
    const under = smooth(.84, .94, down) * smooth(.48, .56, t), lat = Math.abs(Math.cos(a));
    return c.lerp(C('#2a1a16'), under).lerp(C('#7a3038'), under * smooth(.34, .14, lat) * smooth(.5, .62, t));
  } });
  hparts.push(head);
  const at = head.userData.at;
  // nose
  const leather = k.plastic('#161313', { rough: .45, coat: .5, coatRough: .3 });
  const nose = k.group([], { p: [0, .325, .735] }); hg.add(nose);
  k.add(nose, blob(k, (x, y, z) => [x * .08 * (1 + .22 * y), y * .052, z * .058 - .025 * y * y - .02 * x * x], { w: 28, h: 20 }), leather);
  for (const sd of [-1, 1]) k.add(nose, k.sphere(.019, { w: 10, h: 8 }), k.matte('#050404', .8), { p: [sd * .034, -.01, .05], s: [1.3, .65, .5], r: [0, 0, sd * .45] });
  // the open mouth: dark inside, lower jaw dropped, tongue lolling out
  k.add(hg, ovoid(k, [0, .09, .38], [.12, .07, .21], { w: 28, h: 18, color: (x, y, z) => C('#2e0c10').lerp(C('#6e2530'), smooth(-.2, .9, z)) }), k.mat({ vertexColors: true, roughness: .75 }));
  const jawM = mtx(k, { p: [0, .16, .16], r: [.26, 0, 0] });
  hparts.push(bake(k, sweep(k, [[0, -.04, 0], [0, -.06, .25], [0, -.066, .49]], (t, a) => {
    const e = ends(t, .1, .2), down = (1 + Math.sin(a)) / 2; return [lerp(.15, .1, t) * e, lerp(.035, .065, down) * e];
  }, { seg: 32, rs: 28, fur: (t, a) => .3 * smooth(-.2, .3, Math.sin(a)), color: (t, a) => gold.clone().lerp(light, .5).lerp(C('#2a1a16'), smooth(-.4, -.75, Math.sin(a))) }), jawM));
  const tongue = sweep(k, [[0, -.02, .05], [0, -.02, .28], [0, -.04, .46], [.01, -.12, .52], [.02, -.21, .51]], (t, a) => {
    const e = ends(t, 0, .12), w = lerp(.085, .095, t) * e, th = .024 * e * (1 - .45 * bell(Math.cos(a), 0, .25) * (Math.sin(a) < 0 ? 1 : 0));
    return [w, th];
  }, { seg: 48, rs: 24 });
  k.add(hg, bake(k, tongue, jawM), k.plastic('#ea7483', { rough: .32, coat: .5, coatRough: .2 }));
  // warm brown eyes with dark rims, under soft brows
  const irisM = eyeMat(k, ['#4e2a12', '#86501f']);
  for (const sd of [-1, 1]) {
    const q = at(.43, sd > 0 ? -.62 : Math.PI + .62), n = q.n.clone().add(new T.Vector3(0, 0, 1.3)).normalize();
    const c = q.p.clone().addScaledVector(q.n, -.028);
    eye(k, hg, c, n, .058, irisM);
    const rim = k.group([], { p: c.clone().addScaledVector(n, .021).toArray() }); aim(k, rim, n, [0, 0, 1]); hg.add(rim);
    k.add(rim, k.torus(.054, .011, { rs: 8, ts: 32 }), k.matte('#241810', .6), { s: [1.1, .92, 1] });
  }
  // floppy ears, folded at the top and hanging down past the cheeks, feathered along the edge
  for (const sd of [-1, 1]) {
    const q = at(.27, sd > 0 ? -.95 : Math.PI + .95);
    const earM = mtx(k, { p: q.p.toArray(), r: [-.1, sd * .1, sd * .1] });
    hparts.push(bake(k, blob(k, (x, y, z) => {
      const yy = (1 - y) / 2;                                                    // 0 at the fold, 1 at the tip
      return [sd * (.015 + .14 * smooth(0, .38, yy) - .035 * smooth(.6, 1, yy)) + x * .04, .03 - .56 * yy, z * .19 * (1 - .32 * yy) + .05 * yy];
    }, { color: (x, y, z) => deep.clone().lerp(gold, .25 + .2 * y), w: 32, h: 32, fur: (x, y) => .7 + .4 * smooth(0, -1, y), feather: (x, y, z) => .6 * smooth(.2, -.6, y) * smooth(.2, -.4, z), comb: [0, -1, -.3] }), earM));
  }
  furry(k, hg, hparts, { ...furO, len: .045, feather: { ...furO.feather, len: .12 } });
  catchlights(k, g);
  return g;
}

// A cottontail crouched low, ears up, nibbling the end of a lettuce leaf.
function rabbitModel(k) {
  const T = k.THREE, g = k.group(), r = k.group([], { r: [0, -.78, 0] }); g.add(r);
  const C = h => k.color(h);
  const brown = C('#8a735c'), dark = C('#5a4838'), rust = C('#a26e40'), buff = C('#d9c7a6'), white = C('#f3efe6');
  const parts = [];
  // body: a crouched egg, highest over the hips
  const bw = keys([[0, .36], [.22, .43], [.6, .38], [1, .29]]), bt = keys([[0, .4], [.22, .47], [.6, .4], [1, .3]]), bb = keys([[0, .38], [.22, .44], [.6, .42], [1, .36]]);
  parts.push(sweep(k, [[0, .44, -.64], [0, .52, -.3], [0, .5, 0], [0, .46, .3]], (t, a) => {
    const e = ends(t, .26, .14), down = (1 + Math.sin(a)) / 2; return [bw(t) * e, lerp(bt(t), bb(t), down) * e];
  }, { seg: 64, rs: 44, floor: 0, comb: 'back', color: (t, a, p) => {
    const down = Math.sin(a);
    return mottle(brown.clone().lerp(dark, .3 * smooth(-.4, -.95, down)).lerp(rust, .3 * smooth(.75, .95, t) * smooth(-.5, -.9, down)), p, .12).lerp(white, smooth(.45, .85, down));
  } }));
  // head
  const hw = keys([[0, .19], [.3, .235], [.62, .19], [.85, .13], [1, .1]]), ht = keys([[0, .19], [.3, .23], [.62, .18], [.85, .12], [1, .09]]), hb = keys([[0, .2], [.3, .24], [.62, .19], [.85, .12], [1, .09]]);
  const head = sweep(k, [[0, .98, .14], [0, .96, .36], [0, .88, .56], [0, .8, .68]], (t, a) => {
    const e = ends(t, .22, .18), down = (1 + Math.sin(a)) / 2; return [hw(t) * e, lerp(ht(t), hb(t), down) * e];
  }, { seg: 64, rs: 44, comb: 'back', fur: (t, a) => {
    const lat = Math.abs(Math.cos(a)), ap = Math.atan2(Math.sin(a), lat);
    return lerp(.75, .3, smooth(.6, .95, t)) * (1 - .85 * bell(t, .44, .09) * bell(ap, -.38, .32));
  }, color: (t, a, p) => {
    const down = Math.sin(a);
    return mottle(brown.clone().lerp(rust, .35 * smooth(.4, 0, t) * smooth(0, -.8, down)), p, .08).lerp(buff, .5 * smooth(.6, .9, t)).lerp(white, smooth(.35, .8, down) * smooth(.3, .7, t));
  } });
  parts.push(head);
  const at = head.userData.at;
  // big dark eyes in pale rings
  const eyeM = eyeMat(k, ['#2a170c', '#4a2c16'], { ia: 1.0, pa: .5 });
  for (const sd of [-1, 1]) {
    const q = at(.44, sd > 0 ? -.38 : Math.PI + .38);
    const ring = k.group([], { p: q.p.clone().addScaledVector(q.n, -.012).toArray() }); aim(k, ring, q.n, [0, 0, 1]); r.add(ring);
    k.add(ring, k.torus(.07, .018, { rs: 10, ts: 36 }), k.fabric('#e8dcc4', { weave: false }), { s: [1.15, 1, .6] });
    eye(k, r, q.p.clone().addScaledVector(q.n, -.03), q.n.clone().add(new T.Vector3(0, 0, .25)).normalize(), .07, eyeM);
  }
  // long ears, cupped, dark-edged
  const inner = k.fabric('#dcb0a2', { weave: false });
  for (const sd of [-1, 1]) {
    const q = at(.24, sd > 0 ? -1.25 : Math.PI + 1.25);
    const em = mtx(k, { p: q.p.clone().addScaledVector(q.n, -.04).toArray(), r: [sd > 0 ? -.18 : -.5, sd * .55, sd * -.26], order: 'YXZ' });
    parts.push(bake(k, blob(k, (x, y, z) => { const w = .1 * (1 - .15 * y) * (.55 + .45 * smooth(-1, -.5, y)); return [x * w, .34 + y * .34, z * .03 + .05 * x * x]; },
      { color: (x, y) => brown.clone().lerp(dark, smooth(.6, .95, Math.abs(x)) * .8 + smooth(.7, .95, y) * .5), w: 32, h: 32, fur: .45, comb: [0, 1, 0] }), em));
    k.add(r, bake(k, blob(k, (x, y, z) => { const w = .065 * (1 - .15 * y) * (.5 + .5 * smooth(-1, -.4, y)); return [x * w, .34 + y * .29, z * .015 + .05 * x * x + .025]; }, { w: 24, h: 24 }), em), inner);
  }
  // nose, split lip and whiskers
  k.add(r, blob(k, (x, y, z) => [x * .042 * (1 + .3 * y), .83 + y * .026, .705 + z * .022], { w: 16, h: 12 }), k.plastic('#c07f76', { rough: .4, coat: .4 }));
  const lipM = k.matte('#5a3a32', .7);
  k.add(r, k.tube([[0, .81, .712], [0, .77, .707]], .006, { rs: 5 }), lipM);
  for (const sd of [-1, 1]) {
    k.add(r, k.tube([[0, .77, .707], [sd * .025, .755, .692], [sd * .05, .76, .672]], .006, { rs: 5, caps: true }), lipM);
    whiskers(k, r, [sd * .06, .79, .66], [[sd * .36, .07, -.08], [sd * .38, -.01, -.04], [sd * .34, -.08, 0]], .004, k.matte('#f4f1ea', .6));
  }
  // front legs and paws, big hind feet and haunches
  for (const sd of [-1, 1]) {
    parts.push(sweep(k, [[sd * .1, .44, .2], [sd * .13, .26, .31], [sd * .125, .1, .37]], t => { const q = lerp(.115, .078, smooth(0, .8, t)) * ends(t, .1, .1); return [q, q * 1.05]; },
      { seg: 18, rs: 18, comb: 'path', fur: .6, color: t => brown.clone().lerp(buff, .25 + .35 * t) }));
    parts.push(ovoid(k, [sd * .125, .04, .42], [.07, .045, .095], { color: () => buff.clone(), w: 18, h: 14, floor: 0, fur: .5 }));
    for (const dx of [-.028, 0, .028]) parts.push(ovoid(k, [sd * .125 + dx, .03, .5], [.02, .025, .025], { color: () => buff.clone(), w: 8, h: 6, floor: 0, fur: .3 }));
    parts.push(bake(k, ovoid(k, [0, 0, 0], [.14, .25, .35], { color: (x, y, z) => brown.clone().lerp(dark, .12 * y).lerp(white, smooth(-.6, -.95, y) * .6), w: 32, h: 24, comb: [0, -1, -.5], fur: (x, y) => smooth(-.9, -.3, y) + .2 }), mtx(k, { p: [sd * .27, .3, -.26], r: [.3, 0, 0] })));
    parts.push(sweep(k, [[sd * .31, .06, -.5], [sd * .32, .055, -.2], [sd * .3, .05, .06]], t => { const q = .075 * ends(t, .2, .25); return [q * 1.1, q * .75]; },
      { seg: 20, rs: 16, floor: 0, fur: .6, comb: 'path', color: (t, a) => buff.clone().lerp(brown, .85 * smooth(.2, -.5, Math.sin(a))) }));
  }
  // the cotton tail
  parts.push(blob(k, (x, y, z) => [x * .12, .6 + y * .11, -.63 + z * .1], { color: (x, y) => white.clone().lerp(brown, .45 * smooth(.55, 1, y)), w: 24, h: 18, fur: 3.2, comb: [0, .2, -1] }));
  furry(k, r, parts, { len: .04, sheenColor: '#7a6a5a' });
  // the lettuce leaf, from his mouth down to the ground, turned to show its face
  const leafTex = k.tex(256, 512, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, 0);
    for (const [t, col] of [[0, '#5d9f3c'], [.14, '#79b84c'], [.34, '#b3d880'], [.5, '#eef5d2'], [.66, '#b3d880'], [.86, '#79b84c'], [1, '#5d9f3c']]) gr.addColorStop(t, col);
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(244,250,226,.9)'; c.lineCap = 'round';
    c.lineWidth = 16; c.beginPath(); c.moveTo(w / 2, h); c.lineTo(w / 2, 30); c.stroke();
    c.lineWidth = 3.5;
    for (let i = 0; i < 10; i++) for (const sd of [-1, 1]) { const y = h - 50 - i * 46; c.beginPath(); c.moveTo(w / 2, y); c.quadraticCurveTo(w / 2 + sd * 40, y - 24, w / 2 + sd * 112, y - 70); c.stroke(); }
    c.fillStyle = 'rgba(70,130,40,.35)'; c.fillRect(0, 0, 8, h); c.fillRect(w - 8, 0, 8, h);
  });
  const leaf = blade(k, [[0, .76, .64], [0, .64, .8], [0, .44, .9], [.02, .22, .96], [.04, .06, 1.0]],
    vv => (.035 + .21 * Math.sin(Math.PI * Math.min(1, .12 + vv * .92)) ** .6) * (1 + .07 * Math.sin(vv * 38)),
    { nv: 60, nu: 22, side: [0, 0, 1], disp: (u, vv, w) => .35 * u * u * w + .03 * Math.abs(u) ** 2 * Math.sin(vv * 52 + u * 3) * smooth(0, .15, vv) });
  k.add(r, leaf, k.mat({ map: leafTex, roughness: .5, clearcoat: .35, clearcoatRoughness: .3, side: T.DoubleSide }));
  catchlights(k, g);
  return g;
}

// A round little hedgehog: brown spines with cream tips, a soft pointed face, a black button nose, tiny feet.
function hedgehogModel(k) {
  const T = k.THREE, g = k.group(), h = k.group([], { r: [0, -.2, 0] }); g.add(h);
  const C = hx => k.color(hx);
  const tan = C('#b89b7c'), cream = C('#e6d7bf'), mask = C('#80634a'), deepB = C('#3d2b1e'), blush = C('#d3988a');
  const parts = [];
  // the body under the spines: a ball, soft tan fur on the face side and underneath
  const B = [0, .46, -.06], R = [.52, .45, .64];
  const face = (x, y, z) => z - (.66 + .42 * y);                    // > 0 where the soft face fur is (on the unit sphere)
  parts.push(ovoid(k, B, R, { floor: .05, w: 72, h: 54, comb: [0, -.4, -1], fur: (x, y, z) => .8 + .4 * smooth(-.2, -.6, y),
    color: (x, y, z) => deepB.clone().lerp(tan, Math.max(smooth(-.08, .04, face(x, y, z)), smooth(-.62, -.75, y))).lerp(cream, smooth(-.7, -.9, y) * .6) }));
  // the snout: full cheeks narrowing to a pointed nose
  const fr = keys([[0, .31], [.3, .265], [.6, .17], [.85, .105], [1, .072]]);
  const snout = sweep(k, [[0, .44, .3], [0, .41, .53], [0, .37, .71], [0, .35, .84]], (t, a) => {
    const e = ends(t, 0, .12), down = (1 + Math.sin(a)) / 2; return [fr(t) * e * 1.1, fr(t) * e * lerp(.95, .82, down)];
  }, { seg: 48, rs: 40, comb: 'back', fur: t => lerp(.9, .25, smooth(.4, .95, t)), color: (t, a) => {
    const lat = Math.abs(Math.cos(a)), ap = Math.atan2(Math.sin(a), lat);
    return tan.clone().lerp(mask, .55 * bell(t, .42, .18) * bell(ap, -.5, .45)).lerp(cream, smooth(.1, .9, Math.sin(a)) * .8)
      .lerp(blush, .35 * bell(t, .38, .12) * bell(ap, .15, .25)).lerp(C('#6e5440'), smooth(.8, .98, t) * .7);
  } });
  parts.push(snout);
  const at = snout.userData.at;
  k.add(h, blob(k, (x, y, z) => [x * .068, .358 + y * .054, .842 + z * .052 + .015 * y], { w: 24, h: 18 }), k.gloss('#141111', { rough: .12 }));
  k.add(h, k.tube([[-.05, .282, .77], [-.025, .27, .79], [0, .274, .796], [.025, .27, .79], [.05, .282, .77]], .006, { caps: true, seg: 16, rs: 5 }), k.matte('#3a2a20', .7));
  // bright little eyes and round ears peeking out at the edge of the spines
  const eyeM = k.gloss('#0c0a09', { rough: .06 });
  for (const sd of [-1, 1]) {
    const q = at(.3, sd > 0 ? -.62 : Math.PI + .62);
    eye(k, h, q.p.clone().addScaledVector(q.n, -.026), q.n.clone().add(new T.Vector3(0, 0, .45)).normalize(), .07, eyeM);
    const e = onBall(k, B, R, [sd * .5, .36, .79]);
    const ear = k.group([], { p: e.p.clone().addScaledVector(e.n, .02).toArray() }); aim(k, ear, e.n.clone().add(new T.Vector3(0, .2, .8)), [0, 0, 1]); h.add(ear);
    k.add(ear, k.sphere(.09, { w: 20, h: 14 }), k.mat({ color: C('#a88464'), roughness: .9, sheen: 1, sheenColor: C('#6a5a4a') }), { s: [1, 1.08, .42] });
    k.add(ear, k.sphere(.062, { w: 16, h: 12 }), k.fabric('#d5a292', { weave: false }), { p: [0, 0, .024], s: [1, 1.08, .32] });
    whiskers(k, h, [sd * .05, .335, .78], [[sd * .2, .03, -.05], [sd * .22, -.03, -.02]], .003, k.matte('#3a2c22', .6));
  }
  // tiny feet
  for (const [x, z, fwd] of [[.19, .3, 1], [-.19, .3, 1], [.25, -.34, 0], [-.25, -.34, 0]]) {
    parts.push(ovoid(k, [x, .03, z], [.05, .03, .065], { color: () => C('#7a5f50'), w: 16, h: 12, floor: 0, fur: .3 }));
    if (fwd) for (const dx of [-.026, 0, .026]) parts.push(ovoid(k, [x + dx, .018, z + .06], [.014, .016, .018], { color: () => C('#8a6e60'), w: 8, h: 6, floor: 0, fur: .1 }));
  }
  furry(k, h, parts, { len: .035, sheenColor: '#6a5a4a' });
  // spines, laid back like a brushed coat
  const spine = lockGeo(k, '#fff', '#fff', { pts: [[0, 0], [.5, .03], [.42, .35], [.22, .78], [0, 1]], seg: 5, samples: 8, flat: 1, curl: .05,
    stops: [[0, '#d6c2a0'], [.36, '#8c6644'], [.54, '#3b281b'], [.8, '#3b281b'], [.9, '#eadcc0'], [1, '#f6eedb']] });
  const list = [], N = 1900;
  for (let i = 0; i < N; i++) {
    const y = 1 - 2 * (i + .5) / N, rr = Math.sqrt(1 - y * y), th = i * 2.399963, dx = Math.cos(th) * rr, dz = Math.sin(th) * rr;
    if (y < -.68 || face(dx, y, dz) > -.04) continue;                   // the face and the belly stay soft
    const q = onBall(k, B, R, [dx, y, dz]);
    const back = new T.Vector3(0, .15, -1); back.addScaledVector(q.n, -back.dot(q.n)).normalize();
    const edge = smooth(-.3, -.04, face(dx, y, dz)) + smooth(-.3, -.68, y);  // shorter along the fringe of the face and low on the sides
    list.push({ p: q.p.addScaledVector(q.n, -.02), d: q.n.clone().multiplyScalar(.45 + k.range(-.1, .15)).add(back), n: q.n, len: k.range(.17, .22) * (1 - .4 * Math.min(1, edge)),
      wid: .048, thick: 1, color: new T.Color().setScalar(k.range(.84, 1.06)) });
  }
  h.add(locks(k, spine, k.mat({ vertexColors: true, roughness: .5, clearcoat: .3, clearcoatRoughness: .4 }), list));
  catchlights(k, g);
  return g;
}

// A raccoon caught in the act: sitting up beside the galvanised lid he just took off the can, ringed tail curled round.
function raccoonModel(k) {
  const T = k.THREE, g = k.group(), rc = k.group([], { p: [.18, 0, 0], r: [0, -.25, 0] }); g.add(rc);
  const C = h => k.color(h);
  const grey = C('#716d68'), dark = C('#45423f'), pale = C('#a8a299'), black = C('#1e1c1b'), band = C('#a0978a');
  const body = k.group(); rc.add(body);
  const parts = [];
  // body: a round-bellied pear, sitting up
  const brx = keys([[0, .47], [.2, .52], [.5, .43], [.78, .31], [1, .25]]), bry = keys([[0, .44], [.2, .49], [.5, .42], [.78, .29], [1, .24]]);
  parts.push(sweep(k, [[0, 0, -.1], [0, .42, -.08], [0, .82, 0], [0, 1.12, .08], [0, 1.34, .12]], (t, a) => {
    const e = ends(t, .16, .12); return [brx(t) * e, bry(t) * e * (1 + .07 * Math.sin(a))];
  }, { seg: 72, rs: 44, floor: 0, comb: 'back', fur: (t, a) => 1.2 + .3 * smooth(.2, -.6, Math.sin(a)), feather: (t, a) => .35 * smooth(.3, -.5, Math.sin(a)) * smooth(.05, .3, t) * smooth(.95, .75, t), color: (t, a) => {
    const front = Math.sin(a); return grey.clone().lerp(dark, .45 * smooth(-.3, -.9, front)).lerp(pale, .55 * smooth(.3, .85, front) * smooth(.1, .35, t));
  } }));
  // arms: one holding his snack up, one reaching for the lid
  const armCol = t => grey.clone().lerp(C('#3a3836'), smooth(.55, .95, t));
  parts.push(sweep(k, [[.19, 1.16, .1], [.33, .93, .28], [.3, .98, .46], [.24, 1.04, .52]], t => { const q = lerp(.1, .062, t) * ends(t, .1, .12); return [q, q]; }, { seg: 28, rs: 16, comb: 'path', color: armCol }));
  parts.push(sweep(k, [[-.2, 1.18, .12], [-.42, 1.08, .2], [-.6, 1.1, .2]], t => { const q = lerp(.1, .065, t) * ends(t, .1, .15); return [q, q]; }, { seg: 24, rs: 16, comb: 'path', color: armCol }));
  // haunches and dark feet
  for (const sd of [-1, 1]) {
    parts.push(ovoid(k, [sd * .38, .3, .08], [.22, .28, .38], { color: (x, y) => grey.clone().lerp(dark, .3 * (1 - y)), w: 32, h: 24, floor: 0, fur: 1.2 }));
    parts.push(sweep(k, [[sd * .38, .06, 0], [sd * .37, .05, .3], [sd * .34, .045, .48]], t => { const q = lerp(.085, .07, t) * ends(t, .2, .2); return [q * 1.15, q * .8]; },
      { seg: 20, rs: 14, floor: 0, fur: .3, comb: 'path', color: () => C('#34312f') }));
  }
  // the ringed tail, curled round on the ground: six black rings and a black tip
  parts.push(sweep(k, [[0, .2, -.4], [.36, .14, -.62], [.72, .13, -.4], [.84, .13, 0], [.72, .13, .36], [.46, .14, .52]], t => { const q = lerp(.14, .11, t) * ends(t, 0, .07); return [q, q * .9]; },
    { seg: 140, rs: 24, side: [0, 1, 0], comb: 'path', fur: 1.6, feather: t => .9 * smooth(0, .12, t), color: t => {
      const s = Math.sin((t * 6.2 - .3) * TAU), b = Math.max(smooth(.05, .35, s), smooth(.9, .94, t));
      return band.clone().lerp(black, b);
    } }));
  furry(k, body, parts, { len: .045, shade: [.72, 1.12], sheenColor: '#6a6865', feather: { n: 14, len: .13, density: 4, droop: .9, shade: [.8, 1.12] } });
  // the head, a little big: its parts are placed full size and scaled about the neck
  const hd = k.group([], { p: [0, 1.36 * -.2, .1 * -.2], s: 1.2 }); rc.add(hd);
  // little dark hands: one holding the apple core, one gripping the lid
  const handM = furMat(k, { sheenColor: '#3a3836' });
  const hand = (p, dir) => {
    const hgp = k.group([], { p }); aim(k, hgp, dir); body.add(hgp);
    k.add(hgp, ovoid(k, [0, .03, 0], [.06, .05, .035], { color: () => C('#2e2b29'), w: 16, h: 12 }), handM);
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * .026;
      k.add(hgp, k.tube([[x, .05, 0], [x * 1.25, .1, .012], [x * 1.3, .13, .005]], .012, { caps: true, seg: 8, rs: 6 }), handM);
    }
  };
  hand([.24, 1.05, .54], new T.Vector3(-.35, .8, .5));
  // ...and the midnight snack in it: an apple core
  const core = k.group([], { p: [.17, 1.2, .6], r: [.15, 0, -.25] }); body.add(core);
  k.add(core, k.lathe([[0, -.13], [.07, -.12], [.085, -.09], [.05, -.05], [.036, 0], [.05, .05], [.085, .09], [.075, .12], [0, .13]], { smooth: true, seg: 32 }), k.matte('#f3e7c4', .7));
  k.add(core, k.lathe([[0, -.135], [.068, -.125], [.088, -.095], [.08, -.08], [0, -.08]], { smooth: true, seg: 32 }), k.gloss('#c8262c'));
  k.add(core, k.lathe([[0, .08], [.08, .08], [.088, .095], [.075, .125], [0, .135]], { smooth: true, seg: 32 }), k.gloss('#c8262c'));
  k.add(core, k.cyl(.008, .01, .07, { seg: 8 }), k.matte('#5a3a22', .8), { p: [0, .16, 0], r: [0, 0, .25] });
  for (const a of [0, 2.1, 4.2]) k.add(core, k.sphere(.012, { w: 8, h: 6 }), k.gloss('#3a2414'), { p: [Math.sin(a) * .034, .01 * Math.cos(a * 3), Math.cos(a) * .034], s: [.7, 1.2, .7] });
  hand([-.63, 1.1, .2], new T.Vector3(-.8, .5, .1));

  // ---- head: broad cheeks, pointed snout, and the mask painted on ----
  const hw = keys([[0, .22], [.25, .32], [.5, .28], [.72, .16], [.9, .09], [1, .065]]), ht = keys([[0, .2], [.25, .25], [.5, .22], [.72, .12], [.9, .075], [1, .06]]), hb = keys([[0, .22], [.25, .28], [.5, .21], [.72, .1], [.9, .065], [1, .05]]);
  const head = sweep(k, [[0, 1.52, -.1], [0, 1.5, .14], [0, 1.44, .38], [0, 1.39, .58]], (t, a) => {
    const e = ends(t, .15, .12), down = (1 + Math.sin(a)) / 2, lat = Math.abs(Math.cos(a));
    const cheek = 1 + .12 * bell(t, .3, .12) * smooth(.3, .8, lat) * smooth(.3, .7, down);          // fluffy sideburns
    return [hw(t) * e * cheek, lerp(ht(t), hb(t), down) * e];
  }, { seg: 96, rs: 72, comb: 'back', fur: (t, a) => {
    const lat = Math.abs(Math.cos(a)), ap = Math.atan2(Math.sin(a), lat);
    return lerp(1, .3, smooth(.55, .9, t)) * (1 + .8 * bell(t, .3, .12) * smooth(0, .8, ap)) * (1 - .85 * bell(t, .56, .06) * bell(ap, -.75, .22));
  }, feather: (t, a) => { const lat = Math.abs(Math.cos(a)), ap = Math.atan2(Math.sin(a), lat); return .8 * bell(t, .3, .1) * smooth(-.1, .5, ap) * smooth(1.4, 1, ap); } });
  const G = rgb('#8a857e'), D = rgb('#1b1918'), W = rgb('#f2f0eb'), DG = rgb('#403c39');
  const maskTex = procTex(k, 512, 256, (u, vv) => {
    const t = u, a = vv * TAU, lat = Math.abs(Math.cos(a)), ap = Math.atan2(Math.sin(a), lat);    // ap: -π/2 on top, +π/2 under the chin
    // a black band through the eyes: across the face over the nose, sweeping back and down onto the cheeks
    const ey = ap + .75, et = t - .56 - .16 * Math.max(0, ey);                   // relative to the eye, slanting back as it goes down
    const mask = smooth(1.08, .92, Math.hypot(et / .085, ey / (ey > 0 ? .95 : .42))) + smooth(-1.1, -1.4, ap) * smooth(.5, .54, t) * smooth(.66, .62, t);
    // white brows above it, a white muzzle and white cheeks below it, a dark stripe down the middle of the face
    const brow = smooth(1.2, .95, Math.hypot((t - .5 + .06 * (ap + 1.1)) / .085, (ap + 1.12) / .22)) * (1 - smooth(-1.38, -1.5, ap));
    const stripe = smooth(.3, .12, Math.abs(ap + Math.PI / 2)) * smooth(.15, .32, t);
    const muzzle = smooth(.64, .7, t) * smooth(-1.36, -1.2, ap);
    const cheek = smooth(-.2, .25, ap) * smooth(.62, .5, t) * smooth(.14, .28, t);
    let c = G;
    c = mixRgb(c, W, Math.max(muzzle, cheek, brow));
    c = mixRgb(c, DG, stripe);
    c = mixRgb(c, D, clamp(mask));
    c = mixRgb(c, D, smooth(.93, .97, t));
    return c;
  });
  furry(k, hd, [head], { len: .035, map: maskTex, shade: [.78, 1.08], sheenColor: '#6a6865', feather: { n: 12, len: .1, density: 5, droop: .6, shade: [.85, 1.1] } });
  const at = head.userData.at;
  const eyeM = k.gloss('#0a0808', { rough: .06 }), ears = [];
  for (const sd of [-1, 1]) {
    const q = at(.56, sd > 0 ? -.75 : Math.PI + .75);
    eye(k, hd, q.p.clone().addScaledVector(q.n, -.022), q.n.clone().add(new T.Vector3(0, 0, .6)).normalize(), .052, eyeM);
    // rounded ears, white-rimmed
    const e = at(.2, sd > 0 ? -1.0 : Math.PI + 1.0);
    const em = mtx(k, { p: e.p.clone().addScaledVector(e.n, -.03).toArray(), r: [-.15, sd * .25, sd * -.3] });
    ears.push(bake(k, blob(k, (x, y, z) => [x * .1, .1 + y * .12, z * .04 + .03 * x * x], { color: (x, y) => dark.clone().lerp(C('#f2f0eb'), smooth(.7, .9, Math.hypot(x, y * 1.05))), w: 24, h: 24, fur: .8, comb: [0, 1, 0] }), em));
  }
  furry(k, hd, ears, { len: .035, sheenColor: '#6a6865' });
  k.add(hd, k.sphere(.05, { w: 20, h: 14 }), k.gloss('#141212'), { p: [0, 1.405, .6], s: [1.2, .85, .85] });
  whiskers(k, hd, [.05, 1.37, .55], [[.26, .04, -.05], [.28, -.03, -.02]], .0035, k.matte('#e8e6e0', .6));
  whiskers(k, hd, [-.05, 1.37, .55], [[-.26, .04, -.05], [-.28, -.03, -.02]], .0035, k.matte('#e8e6e0', .6));

  // the galvanised lid, stood on its rim
  const spangle = k.tex(512, 512, (c, w, h) => {
    c.fillStyle = '#c9ced4'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) {
      const x = k.rand() * w, y = k.rand() * h, rr = 10 + k.rand() * 28, vv = 165 + k.rand() * 70 | 0, sides = 5 + (k.rand() * 3 | 0);
      c.fillStyle = `rgba(${vv},${vv + 4},${vv + 9},.5)`; c.beginPath();
      for (let j = 0; j < sides; j++) { const a = j / sides * TAU + k.rand() * .5, r2 = rr * (.6 + k.rand() * .5); j ? c.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2) : c.moveTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); }
      c.closePath(); c.fill();
    }
  }, { repeat: [2, 2] });
  const galv = k.metal('#ffffff', .34, { map: spangle, side: T.DoubleSide }), zinc = k.metal('#c6ccd3', .3);
  const lid = k.group([], { p: [-.62, 0, .12], r: [0, .45, 0] }); g.add(lid);
  const tilt = k.group([], { p: [0, .62, 0], r: [Math.PI / 2 - .18, 0, 0] }); lid.add(tilt);
  const R0 = .62, domeY = r => .15 * (1 - (r / R0) ** 2);
  const dome = []; for (let i = 0; i <= 24; i++) { const rr = i / 24 * R0; dome.push([rr, domeY(rr)]); }
  k.add(tilt, k.lathe(dome, { seg: 72 }), galv);
  k.add(tilt, k.torus(R0, .035, { rs: 12, ts: 80 }), zinc, { r: [Math.PI / 2, 0, 0] });
  for (const rr of [.2, .34, .48]) k.add(tilt, k.torus(rr, .014, { rs: 8, ts: 64 }), zinc, { p: [0, domeY(rr), 0], r: [Math.PI / 2, 0, 0] });
  k.add(tilt, k.tube([[-.2, domeY(.2), 0], [-.18, .24, 0], [0, .28, 0], [.18, .24, 0], [.2, domeY(.2), 0]], .028, { caps: true, rs: 10 }), zinc);
  catchlights(k, g);
  return g;
}

export default {
  squirrel: k => squirrelModel(k),
  rabbit: k => rabbitModel(k),
  hedgehog: k => hedgehogModel(k),
  raccoon: k => raccoonModel(k),
  goodboy: k => goodBoy(k),
};
