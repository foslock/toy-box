// Models for the Backyard set's birds and other small wildlife: robin, tree frog, box turtle, hummingbird, great horned owl.
// Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.
// The animals' bodies are smooth unions of ellipsoids shrink-wrapped into one mesh (skin), painted texel by texel from
// where each texel lands on the body (paintSkin), with wings, tails, eyes and the rest added as separate parts.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const mixC = (A, B, t) => [mix(A[0], B[0], t), mix(A[1], B[1], t), mix(A[2], B[2], t)];
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);          // Math.hypot is slow in per-texel loops

// A small seeded random generator for use inside texture painters (painted canvases are cached by the kit, so painters
// mustn't draw from k.rand: on a cache hit they don't run and every later k.rand() would shift).
const rng = (seed = 1) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
// Smooth 2D value noise on a wrapping grid (cheap enough to call per texel).
function noise2(seed, n = 64) {
  const R = rng(seed), g = new Float32Array(n * n);
  for (let i = 0; i < g.length; i++) g[i] = R();
  return (x, y) => {
    const X = Math.floor(x), Y = Math.floor(y), fx = x - X, fy = y - Y, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const x0 = ((X % n) + n) % n, y0 = ((Y % n) + n) % n, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const a = g[y0 * n + x0], b = g[y0 * n + x1], c = g[y1 * n + x0], d = g[y1 * n + x1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
// Built bodies, kept for the next picture of the same item (the studio builds a model again for each size it renders).
const SKINS = new Map();

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

const V = (k, a) => new k.THREE.Vector3(...a);
// Turn an object so its own axis (default +y) points along n.
const aim = (k, obj, n, axis = [0, 1, 0]) => { obj.quaternion.setFromUnitVectors(new k.THREE.Vector3(...axis), n.clone().normalize()); return obj; };
// Turn an object so its +y runs along `along` and its +z faces as nearly as it can towards `out`.
function orient(k, obj, along, out) {
  const T = k.THREE, y = (along.isVector3 ? along.clone() : V(k, along)).normalize(), zt = out.isVector3 ? out.clone() : V(k, out);
  const x = new T.Vector3().crossVectors(y, zt).normalize(), z = new T.Vector3().crossVectors(x, y).normalize();
  obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
  return obj;
}
// Turn an object so its +z points exactly along n, with its +y as near to `up` as it can be.
function face(k, obj, n, up = [0, 1, 0]) {
  const T = k.THREE, z = (n.isVector3 ? n.clone() : V(k, n)).normalize(), x = new T.Vector3().crossVectors(V(k, up), z).normalize(), y = new T.Vector3().crossVectors(z, x);
  obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
  return obj;
}

// Seeded smooth value noise in 3D (0–1), with octaves.
function noise3(k) {
  const perm = new Uint8Array(512), vals = new Float32Array(256), idx = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(k.rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = idx[i & 255];
  for (let i = 0; i < 256; i++) vals[i] = k.rand();
  const h = (x, y, z) => vals[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  const f = t => t * t * (3 - 2 * t);
  const n = (x, y, z) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = f(x - X), v = f(y - Y), w = f(z - Z);
    const a = h(X, Y, Z), b = h(X + 1, Y, Z), c = h(X, Y + 1, Z), d = h(X + 1, Y + 1, Z);
    const e = h(X, Y, Z + 1), g = h(X + 1, Y, Z + 1), i = h(X, Y + 1, Z + 1), j = h(X + 1, Y + 1, Z + 1);
    const m1 = mix(mix(a, b, u), mix(c, d, u), v), m2 = mix(mix(e, g, u), mix(i, j, u), v);
    return mix(m1, m2, w);
  };
  return (x, y, z, oct = 1) => { let s = 0, a = 1, t = 0; for (let o = 0; o < oct; o++) { s += n(x, y, z) * a; t += a; x *= 2.03; y *= 2.03; z *= 2.03; a *= .5; } return s / t; };
}

/* ---- organic bodies: smooth unions of ellipsoids, shrink-wrapped into one mesh ---- */
const smin = (a, b, r) => { const h = Math.max(r - Math.abs(a - b), 0) / r; return Math.min(a, b) - h * h * r * .25; };
// Signed distance (roughly) to a smooth union of ellipsoids. parts: [{ c: [x, y, z], r: [rx, ry, rz], rot: [x, y, z] radians,
// k: blend radius with the parts before it, sub: true to carve it away instead }]
function sdf(k, parts) {
  const T = k.THREE;
  const P = parts.map(q => ({ c: q.c, r: q.r, k: q.k ?? .2, sub: !!q.sub,
    e: new T.Matrix4().makeRotationFromEuler(new T.Euler(...(q.rot ?? [0, 0, 0]))).invert().elements }));
  return (x, y, z) => {
    let d = 0;
    for (let i = 0; i < P.length; i++) {
      const q = P[i], e = q.e, r = q.r, px = x - q.c[0], py = y - q.c[1], pz = z - q.c[2];
      const X = (e[0] * px + e[4] * py + e[8] * pz) / r[0], Y = (e[1] * px + e[5] * py + e[9] * pz) / r[1], Z = (e[2] * px + e[6] * py + e[10] * pz) / r[2];
      const k0 = Math.sqrt(X * X + Y * Y + Z * Z), k1 = Math.sqrt((X / r[0]) ** 2 + (Y / r[1]) ** 2 + (Z / r[2]) ** 2);
      const di = k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(r[0], r[1], r[2]);
      d = i === 0 ? di : q.sub ? -smin(-d, di, q.k) : smin(d, di, q.k);
    }
    return d;
  };
}
// Walk in from R along a ray from c to the outermost surface crossing; returns the distance from c.
function march(F, c, d, R) {
  let t = R, prev = t, f = F(c[0] + d[0] * t, c[1] + d[1] * t, c[2] + d[2] * t);
  for (let s = 0; s < 200 && f > 1e-5; s++) {
    prev = t; t -= Math.max(f * .8, R * .0015);
    if (t <= 0) return 0;
    f = F(c[0] + d[0] * t, c[1] + d[1] * t, c[2] + d[2] * t);
  }
  if (f < 0) {
    let lo = t, hi = prev;
    for (let b = 0; b < 20; b++) { const m = (lo + hi) / 2; F(c[0] + d[0] * m, c[1] + d[1] * m, c[2] + d[2] * m) < 0 ? lo = m : hi = m; }
    t = (lo + hi) / 2;
  }
  return t;
}
function gradOf(F, x, y, z, h = 1e-3) {
  const gx = F(x + h, y, z) - F(x - h, y, z), gy = F(x, y + h, z) - F(x, y - h, z), gz = F(x, y, z + h) - F(x, y, z - h), l = Math.hypot(gx, gy, gz) || 1;
  return [gx / l, gy / l, gz / l];
}
// One smooth mesh over a smooth union of ellipsoids, shrink-wrapped from a point c inside (so it should look
// star-shaped from c). UVs: v from the bottom (0) to the top (1); u round the y axis from the back (0) through −x (.25),
// the front +z (.5) and +x (.75). o: { c, R (bigger than the body), nu, nv, stretch: [x, y, z] to spread the rays }
function skin(k, parts, o) {
  const T = k.THREE, F = sdf(k, parts), nu = o.nu ?? 96, nv = o.nv ?? 64, c = o.c, R = o.R ?? 6, st = o.stretch ?? [1, 1, 1];
  const key = o.key && `${o.key}:${JSON.stringify([parts, o])}`;
  let built = key && SKINS.get(key);
  if (!built) {
    const geo = new T.SphereGeometry(1, nu, nv);
    geo.rotateY(-Math.PI / 2);
    const p = geo.attributes.position, nr = geo.attributes.normal, pos = new Float32Array(p.count * 3), nor = new Float32Array(p.count * 3);
    for (let iy = 0; iy <= nv; iy++) {
      let first = null;
      for (let ix = 0; ix <= nu; ix++) {
        const i = iy * (nu + 1) + ix;
        let hit = first;
        if (!hit || (iy > 0 && iy < nv && ix < nu)) {           // a pole row is one point; the seam repeats the row's first
          let dx = p.getX(i) * st[0], dy = p.getY(i) * st[1], dz = p.getZ(i) * st[2];
          const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
          const t = march(F, c, [dx, dy, dz], R), x = c[0] + dx * t, y = c[1] + dy * t, z = c[2] + dz * t;
          hit = [x, y, z, ...gradOf(F, x, y, z)];
        }
        if (ix === 0) first = hit;
        p.setXYZ(i, hit[0], hit[1], hit[2]); nr.setXYZ(i, hit[3], hit[4], hit[5]);
        pos[i * 3] = hit[0]; pos[i * 3 + 1] = hit[1]; pos[i * 3 + 2] = hit[2]; nor[i * 3] = hit[3]; nor[i * 3 + 1] = hit[4]; nor[i * 3 + 2] = hit[5];
      }
    }
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    built = { geo, pos, nor };
    if (key) SKINS.set(key, built);
  }
  const { pos, nor } = built, geo = built.geo.clone();
  // where a ray from `from` along `dir` leaves the body: { p, n }
  const hit = (from, dir) => {
    const d = V(k, dir).normalize(), t = march(F, from, d.toArray(), R);
    const q = V(k, from).addScaledVector(d, t);
    return { p: q, n: V(k, gradOf(F, q.x, q.y, q.z)) };
  };
  // the texture coordinates of the skin over a point (by its direction from c)
  const uvOf = q => {
    let dx = (q.x - c[0]) / st[0], dy = (q.y - c[1]) / st[1], dz = (q.z - c[2]) / st[2];
    const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
    return [.5 + Math.atan2(dx, dz) / TAU, 1 - Math.acos(clamp(dy, -1, 1)) / Math.PI];
  };
  return { geo, F, nu, nv, pos, nor, hit, uvOf, key: o.key };
}
// Paint a skin's texture. base(p, n, u, v) gives [r, g, b] (0–255) for the surface point p with normal n under each texel;
// marks(ctx, W, H, at, R) then draws strokes on top, where at(u, v) = { p, n, su, sv } (su, sv: surface length of one
// texel across, down) and R is a seeded random generator. The canvas is cached under the skin's key.
function paintSkin(k, S, W, H, base, marks, name = 'skin', o = {}) {
  const { pos: P, nor: N, nu, nv } = S;
  const look = (u, v, p, n) => {
    const gx = clamp(u) * nu, gy = clamp(1 - v) * nv, x0 = Math.min(nu - 1, gx | 0), y0 = Math.min(nv - 1, gy | 0), fx = gx - x0, fy = gy - y0;
    const i00 = (y0 * (nu + 1) + x0) * 3, i10 = i00 + 3, i01 = i00 + (nu + 1) * 3, i11 = i01 + 3;
    for (let c = 0; c < 3; c++) {
      p[c] = (P[i00 + c] * (1 - fx) + P[i10 + c] * fx) * (1 - fy) + (P[i01 + c] * (1 - fx) + P[i11 + c] * fx) * fy;
      n[c] = (N[i00 + c] * (1 - fx) + N[i10 + c] * fx) * (1 - fy) + (N[i01 + c] * (1 - fx) + N[i11 + c] * fx) * fy;
    }
    const l = len3(n[0], n[1], n[2]) || 1; n[0] /= l; n[1] /= l; n[2] /= l;
  };
  let extra = null;
  const cacheKey = S.key && `birds:${S.key}:${name}:${W}x${H}`;
  const map = k.tex(W, H, ctx => {
    const img = ctx.createImageData(W, H), D = img.data, p = [0, 0, 0], n = [0, 0, 0];
    if (o.extra) extra = new Uint8ClampedArray(W * H * 4);
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const u = (px + .5) / W, v = 1 - (py + .5) / H;
      look(u, v, p, n);
      const c = base(p, n, u, v), i = (py * W + px) * 4;
      D[i] = c[0]; D[i + 1] = c[1]; D[i + 2] = c[2]; D[i + 3] = 255;
      if (extra) { extra[i] = c[3]; extra[i + 1] = c[4]; extra[i + 2] = c[5]; extra[i + 3] = 255; }
    }
    ctx.putImageData(img, 0, 0);
    if (marks) {
      const at = (u, v) => {
        const p = [0, 0, 0], n = [0, 0, 0], a = [0, 0, 0], b = [0, 0, 0], m = [0, 0, 0];
        look(u, v, p, n); look(u + 1 / W, v, a, m); look(u, v - 1 / H, b, m);
        return { p, n, su: Math.hypot(a[0] - p[0], a[1] - p[1], a[2] - p[2]) || 1e-4, sv: Math.hypot(b[0] - p[0], b[1] - p[1], b[2] - p[2]) || 1e-4 };
      };
      marks(ctx, W, H, at, rng(W * 7 + H));
    }
  }, cacheKey ? { cache: cacheKey } : {});
  if (!o.extra) return map;
  // a second, non-colour texture from base's c[3], c[4], c[5] (say iridescence, roughness, metalness: R, G, B)
  const data = k.tex(W, H, ctx => { const img = ctx.createImageData(W, H); img.data.set(extra); ctx.putImageData(img, 0, 0); }, cacheKey ? { cache: cacheKey + ':extra', data: true } : { data: true });
  return { map, data };
}

// A thin leaf, feather or wing, growing up +y from its base at the origin with its outer face towards +z.
// L: length; w(s): half width at s (0 at the base, 1 at the tip); o.th(s): half thickness; o.bend(s, t): z offset
// (t from −1 to 1 across the width); o.curl(s): extra z along the length. UVs on both faces: u = (t + 1) / 2, v = s.
function lensGeo(k, L, w, o = {}) {
  const T = k.THREE, ns = o.ns ?? 32, nt = o.nt ?? 12, th = o.th ?? (() => .02), bend = o.bend ?? (() => 0), curl = o.curl ?? (() => 0), under = o.under ?? .6;
  const pos = [], uv = [], idx = [];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= ns; i++) {
      const s = i / ns, hw = w(s);
      for (let j = 0; j <= nt; j++) {
        const t = -1 + 2 * j / nt, e = Math.sqrt(Math.max(0, 1 - t * t));
        pos.push(hw * t, s * L, curl(s) + bend(s, t) + side * th(s) * e * (side > 0 ? 1 : under));
        uv.push((t + 1) / 2, s);
      }
    }
    for (let i = 0; i < ns; i++) for (let j = 0; j < nt; j++) {
      const a = base + i * (nt + 1) + j, b = a + 1, c = a + nt + 1, d = c + 1;
      if (side > 0) idx.push(a, b, d, a, d, c); else idx.push(a, d, b, a, c, d);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return weld(geo);
}

// A folded wing (or any feathered flap) lying on a skin. ray(s, t) gives [origin, direction] for s from the shoulder (0)
// to the tip (1) and t across the wing (−1 to 1); the wing's outer face sits lift(s, t) off the body where that ray leaves
// it, and it's closed underneath and round its edges. UVs: u = (t + 1) / 2, v = s.
function wingShell(k, S, ray, lift, o = {}) {
  const T = k.THREE, ns = o.ns ?? 30, nt = o.nt ?? 16, outer = [], inner = [];
  for (let i = 0; i <= ns; i++) for (let j = 0; j <= nt; j++) {
    const sv = i / ns, t = -1 + 2 * j / nt, [org, dir] = ray(sv, t), q = S.hit(org, dir);
    outer.push(q.p.clone().addScaledVector(q.n, lift(sv, t))); inner.push(q.p.clone().addScaledVector(q.n, -(o.sink ?? .03)));
  }
  const pos = [], uv = [], idx = [], id = (i, j) => i * (nt + 1) + j;
  const add = (P, u, v) => { pos.push(P.x, P.y, P.z); uv.push(u, v); return pos.length / 3 - 1; };
  const grid = (G, flip) => {
    const base = pos.length / 3;
    for (let i = 0; i <= ns; i++) for (let j = 0; j <= nt; j++) add(G[id(i, j)], j / nt, i / ns);
    for (let i = 0; i < ns; i++) for (let j = 0; j < nt; j++) {
      const a = base + id(i, j), b = base + id(i, j + 1), c = base + id(i + 1, j), d = base + id(i + 1, j + 1);
      flip ? idx.push(a, d, b, a, c, d) : idx.push(a, b, d, a, d, c);
    }
  };
  // which way round the outer face must wind to face out
  const a0 = outer[id(ns >> 1, nt >> 1)], nOut = a0.clone().sub(inner[id(ns >> 1, nt >> 1)]);
  const e1 = outer[id(ns >> 1, (nt >> 1) + 1)].clone().sub(a0), e2 = outer[id((ns >> 1) + 1, (nt >> 1) + 1)].clone().sub(a0);
  const flip = e1.clone().cross(e2).dot(nOut) < 0;
  grid(outer, flip); grid(inner, !flip);
  // the edges: strips joining the outer and inner faces all the way round
  const ring = [];
  for (let j = 0; j <= nt; j++) ring.push([0, j]);
  for (let i = 1; i <= ns; i++) ring.push([i, nt]);
  for (let j = nt - 1; j >= 0; j--) ring.push([ns, j]);
  for (let i = ns - 1; i >= 1; i--) ring.push([i, 0]);
  ring.push([0, 0]);
  for (let r = 0; r < ring.length - 1; r++) {
    const [i0, j0] = ring[r], [i1, j1] = ring[r + 1];
    const A = add(outer[id(i0, j0)], j0 / nt, i0 / ns), B = add(outer[id(i1, j1)], j1 / nt, i1 / ns), C = add(inner[id(i0, j0)], j0 / nt, i0 / ns), D = add(inner[id(i1, j1)], j1 / nt, i1 / ns);
    flip ? idx.push(A, B, D, A, D, C) : idx.push(A, D, B, A, C, D);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return weld(geo);
}

// Where a glossy ball shows the key light's glint to the camera, in the model's own frame (before its yaw).
function glintDir(k, yaw = 0, view = {}) {
  const T = k.THREE, az = k.deg(view.az ?? 30), el = k.deg(view.el ?? 16), ka = az - 1.0, ke = k.deg(50);
  const v = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const l = new T.Vector3(Math.sin(ka) * Math.cos(ke), Math.sin(ke), Math.cos(ka) * Math.cos(ke));
  return v.add(l).normalize().applyAxisAngle(new T.Vector3(0, 1, 0), -yaw);
}
// A glossy eye: a ball of radius r at p looking along n, with a little white glint (gl: glintDir).
// o.iris: paint(ctx, w, h) for the ball's texture (the canvas top is the front pole: the pupil), else plain glossy black.
function eyeBall(k, parent, p, n, r, gl, o = {}) {
  const geo = k.sphere(r, { w: 40, h: 28 }); geo.rotateX(Math.PI / 2);
  const mat = o.iris ? k.mat({ map: k.tex(256, 128, o.iris), roughness: .18, clearcoat: 1, clearcoatRoughness: .03 }) : k.gloss(o.color ?? '#141110', { rough: .12, coatRough: .03 });
  const ball = face(k, k.mesh(geo, mat, { p: p.toArray() }), n);
  parent.add(ball);
  k.add(parent, k.sphere(r * (o.glint ?? .2), { w: 12, h: 8 }), k.glow('#ffffff', 1), { p: p.clone().addScaledVector(gl, r * .96).toArray(), shadow: false });
  return ball;
}
// A painter for an eyeball texture (for eyeBall's o.iris): col(X, Y, th) gives [r, g, b] for the point th radians from the
// front of the eye, which is X across (along the eye's own +x) and Y up from the front, in radians.
const irisPaint = col => (ctx, W, H) => {
  const img = ctx.createImageData(W, H), D = img.data;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const th = (py + .5) / H * Math.PI, ph = (px + .5) / W * TAU, c = col(-th * Math.cos(ph), -th * Math.sin(ph), th), o = (py * W + px) * 4;
    D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
};
// Vertex colours from position and normal: fn(p, n) gives a hex colour or [r, g, b] (0–255).
function tint(k, geo, fn) {
  const T = k.THREE, p = geo.attributes.position, n = geo.attributes.normal, cols = new Float32Array(p.count * 3), c = new T.Color();
  for (let i = 0; i < p.count; i++) {
    const v = fn([p.getX(i), p.getY(i), p.getZ(i)], [n.getX(i), n.getY(i), n.getZ(i)]);
    typeof v === 'string' ? c.set(v) : c.setRGB(v[0] / 255, v[1] / 255, v[2] / 255, T.SRGBColorSpace);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  return geo;
}
// Many copies of one geometry, each placed with orient(): list of { p, along, out, s }.
function oriented(k, geo, mat, list) {
  const T = k.THREE, m = new T.InstancedMesh(geo, mat, list.length), o = new T.Object3D();
  list.forEach((it, i) => {
    o.position.set(...it.p); orient(k, o, it.along, it.out);
    typeof it.s === 'number' ? o.scale.setScalar(it.s) : o.scale.set(...(it.s ?? [1, 1, 1]));
    o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    if (it.color) m.setColorAt(i, new T.Color(it.color));
  });
  m.castShadow = m.receiveShadow = true;
  return m;
}
// A varTube along points, capped at both ends.
const limb = (k, pts, r0, r1, o = {}) => {
  const c = curveOf(k, pts), L = c.getLength();
  return varTube(k, c, capped(s => mix(r0, r1, s / L), o.cap0 ?? r0 * .9, o.cap1 ?? r1 * .9), { seg: o.seg ?? 32, rs: o.rs ?? 12, flat: o.flat, up: o.up });
};

export default {
  // An American robin, standing tall with its catch: a worm dangling from its beak.
  robin(k) {
    const T = k.THREE, g = k.group(), yaw = k.deg(98), b = k.group([], { r: [0, yaw, 0] }); g.add(b);
    const gl = glintDir(k, yaw);
    const headC = [0, 2.1, .3];
    const S = skin(k, [
      { c: [0, 1.25, -.1], r: [.5, .52, .74], rot: [-.66, 0, 0] },            // body, tipped up at the front
      { c: [0, 1.22, .26], r: [.46, .5, .45], k: .3 },                          // round breast
      { c: [0, .86, -.64], r: [.27, .25, .48], rot: [-.55, 0, 0], k: .3 },      // rump, running back into the tail
      { c: [0, 1.78, .2], r: [.3, .3, .3], k: .25 },                            // neck
      { c: headC, r: [.35, .34, .39], k: .16 },                                 // head
    ], { c: [0, 1.45, 0], R: 3.2, nu: 112, nv: 80, key: 'robin' });
    const N3 = noise3(k);
    const grey = hex('#6f665d'), head = hex('#2e2a27'), orange = hex('#cf5226'), orangeL = hex('#e0692f'), white = hex('#f2eee8');
    const tex = paintSkin(k, S, 512, 384, (p, n) => {
      const nz = N3(p[0] * 7, p[1] * 7, p[2] * 7, 2) - .5;
      const back = n[1] * .87 - n[2] * .5 + nz * .12;
      let c = mixC(mixC(orange, orangeL, smooth(.3, 1, -back) * .6), grey, smooth(-.02, .22, back));
      c = mixC(c, white, smooth(-.35, -.62, p[2] + nz * .1) * smooth(-.1, -.55, n[1]));                   // white under the tail
      const dh = len3(p[0] - headC[0], p[1] - headC[1], p[2] - headC[2]);
      c = mixC(c, head, smooth(.52, .44, dh + nz * .05));
      const thr = n[2] * .8 - n[1] * .6;                                                                   // white throat, streaked black
      const tw = smooth(.5, .42, dh) * smooth(.58, .8, thr) * smooth(2.04, 1.92, p[1]);
      const streak = smooth(.7, .9, Math.abs(Math.sin(p[0] * 58 + nz * 5)));
      c = mixC(c, mixC(white, head, streak * .8), tw);
      return c;
    }, (ctx, W, H, at, R) => {
      // soft feather scallops
      for (let i = 0; i < 2600; i++) {
        const u = R(), v = .08 + R() * .9, q = at(u, v), s = .035 + R() * .025;
        const w = s / q.su, h = s / q.sv * .7;
        if (w > 40 || h > 40) continue;
        const light = R() < .5;
        ctx.strokeStyle = light ? 'rgba(255,240,220,.13)' : 'rgba(40,20,10,.14)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(u * W, (1 - v) * H, w, h, 0, .15 * Math.PI, .85 * Math.PI); ctx.stroke();
      }
    });
    k.add(b, S.geo, k.mat({ map: tex, roughness: .72, sheen: .5, sheenRoughness: .5, sheenColor: new T.Color('#fff3e6') }));

    // eyes with their broken white rings
    for (const s of [-1, 1]) {
      const e = S.hit(headC, [s * .78, .28, .56]);
      const p = e.p.clone().addScaledVector(e.n, -.03);
      eyeBall(k, b, p, e.n, .075, gl);
      for (const a0 of [Math.PI / 2, -Math.PI / 2]) {
        const ring = k.group([], { p: e.p.clone().addScaledVector(e.n, -.005).toArray() });
        face(k, ring, e.n); b.add(ring);
        const arc = 1.75, t = k.mesh(k.torus(.094, .017, { rs: 8, ts: 24, arc }), k.matte('#f4f1ea', .6), { r: [0, 0, a0 - arc / 2] });
        ring.add(t);
      }
    }
    // beak: yellow, dusky at the tip, open just enough for the worm
    const bk = S.hit(headC, [0, -.15, 1]);
    const beak = k.group([], { p: bk.p.clone().add(V(k, [0, 0, -.06])).toArray(), r: [.12, 0, 0] }); b.add(beak);
    const bill = k.painted(8, 64, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6e5220'); gr.addColorStop(.25, '#e4a526'); gr.addColorStop(1, '#f2bd35'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, { rough: .35, coat: .6 });
    for (const [up, len, rad] of [[1, .42, .11], [-1, .36, .095]]) {
      const geo = k.lathe([[rad, 0], [rad * .92, len * .25], [rad * .6, len * .6], [rad * .25, len * .88], [0, len]], { smooth: true, seg: 24 });
      geo.rotateX(Math.PI / 2);
      const bp = geo.attributes.position;
      for (let i = 0; i < bp.count; i++) { const z = bp.getZ(i) / len; bp.setY(i, bp.getY(i) * .55 + up * .022 - .05 * z * z); }
      geo.computeVertexNormals();
      k.add(beak, geo, bill);
    }
    // the worm, held across the beak: a short end behind, a long wiggly end dangling in front
    const tipZ = .3, wormPts = [[.22, -.12, tipZ - .04], [.13, -.02, tipZ], [0, 0, tipZ + .02], [-.14, -.01, tipZ + .02], [-.25, -.12, tipZ + .01], [-.3, -.32, tipZ + .06], [-.19, -.5, tipZ + .1], [-.13, -.68, tipZ + .08], [-.24, -.86, tipZ + .04], [-.34, -.98, tipZ + .1], [-.28, -1.1, tipZ + .16], [-.18, -1.08, tipZ + .2]];
    const wc = curveOf(k, wormPts), wl = wc.getLength();
    const wormTex = k.tex(256, 16, (c, w, h) => {
      c.fillStyle = '#e8848f'; c.fillRect(0, 0, w, h);
      for (let x = 3; x < w; x += 5.5) { c.fillStyle = 'rgba(150,50,70,.35)'; c.fillRect(x, 0, 1.3, h); }
      c.fillStyle = '#f2a39d'; c.fillRect(w * .28, 0, w * .08, h);
    });
    k.add(beak, varTube(k, wc, capped(s => .042 * (1 - .25 * Math.abs(s / wl - .3)), .04, .05), { seg: 90, rs: 12 }), k.mat({ map: wormTex, roughness: .35, clearcoat: .6, clearcoatRoughness: .2 }));

    // tail: long and dark, a folded fan of feathers
    const featherTex = k.tex(64, 256, (c, w, h) => {
      const gr = c.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#3a3532'); gr.addColorStop(1, '#1e1b19');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(120,112,104,.45)'; c.fillRect(w / 2 - 1, 0, 2, h);
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 0, 3, h); c.fillRect(w - 3, 0, 3, h);
    }, { cache: 'birds:robin:feather' });
    const featherM = k.mat({ map: featherTex, roughness: .55, sheen: .25, sheenColor: new T.Color('#6a625c'), side: T.DoubleSide });
    const tailFeather = lensGeo(k, 1.42, q => .12 * Math.pow(Math.sin(Math.PI * Math.min(1, q * .55 + .45)), .35) * (q < .08 ? .6 + q * 5 : 1), { th: q => .018, bend: (q, t) => -.03 * t * t, curl: q => .06 * q * q, ns: 16, nt: 6 });
    const tailList = [];
    for (let i = 0; i < 7; i++) {
      const f = i / 6 - .5, a = f * .36;
      tailList.push({ p: [f * .1 - .02, .84 + .05 * (1 - Math.abs(f) * 2), -.8 + Math.abs(f) * .05], along: [Math.sin(a), -.52, -.85], out: [-.42 - f * .5, .88, -.45], s: [1, 1 - Math.abs(f) * .08, 1] });
    }
    b.add(oriented(k, tailFeather, featherM, tailList));
    // folded wings along the flanks
    const wingTex = k.tex(128, 256, (c, w, h) => {
      c.fillStyle = '#665d55'; c.fillRect(0, 0, w, h);
      // primaries (tip, canvas top): long dark feathers with pale edges
      for (let i = 0; i < 6; i++) { const x = w * (.1 + i * .14); c.fillStyle = '#4b443e'; c.beginPath(); c.ellipse(x, h * .22, w * .1, h * .3, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(190,178,165,.5)'; c.lineWidth = 1.5; c.stroke(); }
      // coverts: rows of little scallops
      for (let row = 0; row < 7; row++) for (let i = 0; i < 7; i++) {
        const x = (i + (row % 2) * .5) * w / 6.5, y = h * (.55 + row * .065);
        c.fillStyle = row < 3 ? '#5c544d' : '#6d645c'; c.beginPath(); c.ellipse(x, y, w * .085, h * .05, 0, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(200,188,172,.45)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(x, y, w * .085, h * .05, 0, .1 * Math.PI, .9 * Math.PI); c.stroke();
      }
    });
    const wingM = k.mat({ map: wingTex, roughness: .7, sheen: .4, sheenRoughness: .5, sheenColor: new T.Color('#f0e6dc') });
    const A0 = V(k, [0, 1.62, .16]), A1 = V(k, [0, .86, -.92]), ax = A1.clone().sub(A0).normalize(), dorsal = V(k, [0, -ax.z, ax.y]);
    for (const s of [-1, 1]) {
      // the folded wing hugs the flank from the shoulder back over the rump; its lower edge stands proud of the orange side
      const ray = (q, t) => {
        const beta = 1.3 + t * mix(.55, .2, q ** 1.5) * smooth(0, .12, q + .02) + q * .15;
        return [A0.clone().lerp(A1, q).toArray(), dorsal.clone().multiplyScalar(Math.cos(beta)).add(V(k, [s * Math.sin(beta), 0, 0])).toArray()];
      };
      const lift = (q, t) => (.03 + .06 * smooth(-.6, 1, t)) * smooth(0, .15, q) + .06 * smooth(.7, 1, q);
      k.add(b, wingShell(k, S, ray, lift, { ns: 30, nt: 14 }), wingM);
    }
    // legs and feet
    const legM = k.plastic('#5d4a40', { rough: .55, coat: .3 });
    for (const s of [-1, 1]) {
      const top = [s * .15, .85, .05], foot = [s * .17, .05, .16];
      k.add(b, limb(k, [top, [s * .16, .45, .1], foot], .045, .034), legM);
      const toes = [[-.4, .3], [0, .34], [.4, .3], [Math.PI, .2]];
      for (const [a, len] of toes) {
        const dx = Math.sin(a + s * .08), dz = Math.cos(a + s * .08);
        k.add(b, limb(k, [foot, [foot[0] + dx * len * .5, .035, foot[2] + dz * len * .5], [foot[0] + dx * len, .02, foot[2] + dz * len]], .028, .018), legM);
        b.add(aim(k, k.mesh(k.cone(.016, .07, 8), k.plastic('#2a211c'), { p: [foot[0] + dx * (len + .02), .018, foot[2] + dz * (len + .02)] }), V(k, [dx, -.3, dz])));
      }
    }
    return g;
  },

  // A green tree frog sitting up: glossy lime skin with a cream stripe down each side, gold eyes, a wide smile, sticky toes.
  treefrog(k) {
    const T = k.THREE, g = k.group(), yaw = k.deg(66), f = k.group([], { r: [0, yaw, 0] }); g.add(f);
    const gl = glintDir(k, yaw);
    const headC = [0, 1.0, .5], eyeC = s => [s * .39, 1.22, .55];
    const S = skin(k, [
      { c: [0, .54, -.22], r: [.6, .45, .7], rot: [-.42, 0, 0] },          // body, sitting low
      { c: [0, .72, .18], r: [.56, .44, .44], k: .3 },                      // shoulders
      { c: headC, r: [.6, .34, .5], rot: [.1, 0, 0], k: .25 },              // broad flat head
      { c: [0, .92, .88], r: [.37, .23, .25], k: .2 },                      // snout
      { c: [0, .77, .64], r: [.44, .25, .34], k: .2 },                      // throat
      { c: eyeC(-1), r: [.24, .24, .24], k: .12 },                          // eye bumps
      { c: eyeC(1), r: [.24, .24, .24], k: .12 },
    ], { c: [0, .74, .2], R: 3, nu: 112, nv: 80, key: 'treefrog' });
    const N3 = noise3(k);
    const green = hex('#3eb235'), greenD = hex('#2f962b'), lime = hex('#7fcb4a'), cream = hex('#f3edd2'), white = hex('#fbf8e8');
    // the pale stripe: along the upper jaw, then back over the shoulder and down the flank
    const stripeY = z => z > .42 ? .82 : z > 0 ? mix(.63, .82, z / .42) : mix(.32, .63, (z + .62) / .62);
    const tex = paintSkin(k, S, 512, 384, (p, n) => {
      const nz = N3(p[0] * 9, p[1] * 9, p[2] * 9, 2) - .5;
      let c = mixC(lime, green, smooth(-.35, .35, n[1] + nz * .2));
      c = mixC(c, greenD, smooth(.55, .95, n[1]) * .45);
      const ys = stripeY(p[2]), side = smooth(.22, .36, Math.abs(p[0]));
      if (p[2] > .4) c = mixC(c, cream, smooth(ys + .012, ys - .012, p[1]));                         // pale jaw
      else c = mixC(c, white, side * smooth(.04, .022, Math.abs(p[1] - ys)));                       // stripe
      c = mixC(c, cream, smooth(-.2, -.5, n[1]));                                                    // belly
      return c;
    }, (ctx, W, H, at, R) => {
      // a sprinkle of tiny gold flecks on the back
      for (let i = 0; i < 70; i++) {
        const u = R(), v = .45 + R() * .5, q = at(u, v);
        if (q.n[1] < .35) continue;
        const r = .01 + R() * .01;
        ctx.fillStyle = 'rgba(236,214,92,.85)'; ctx.beginPath(); ctx.ellipse(u * W, (1 - v) * H, r / q.su, r / q.sv, 0, 0, TAU); ctx.fill();
      }
    });
    const skinM = k.mat({ map: tex, roughness: .3, clearcoat: 1, clearcoatRoughness: .08 });
    k.add(f, S.geo, skinM);
    const legM = k.mat({ vertexColors: true, roughness: .3, clearcoat: 1, clearcoatRoughness: .08 });
    const legCol = (p, n) => mixC(mixC(hex('#e9e2bd'), lime, smooth(-.5, -.1, n[1])), green, smooth(-.1, .5, n[1]));
    const padM = k.mat({ color: '#9ad96a', roughness: .35, clearcoat: 1, clearcoatRoughness: .1 });
    const toeGeos = [], pads = [];
    const toe = (from, a, len, r) => {
      const dx = Math.sin(a), dz = Math.cos(a), end = [from[0] + dx * len, .04, from[2] + dz * len];
      toeGeos.push(limb(k, [from, [from[0] + dx * len * .5, from[1] * .4 + .04, from[2] + dz * len * .5], end], r, r * .8, { rs: 10, seg: 16 }));
      pads.push({ p: [end[0] + dx * .012, .038, end[2] + dz * .012], s: [r * 1.55, r * .95, r * 1.55] });
    };
    for (const s of [-1, 1]) {
      // hind leg folded up at the side: thigh forward to the knee, shin back to the heel, foot forward on the ground
      const hip = [s * .3, .34, -.5], knee = [s * .7, .38, .16], heel = [s * .68, .13, -.5], ball = [s * .84, .055, .02];
      const seg = (pts, rad, o = {}) => { const c = curveOf(k, pts); return tint(k, varTube(k, c, rad, { seg: 40, rs: 18, ...o }), legCol); };
      k.add(f, seg([hip, [s * .56, .44, -.2], knee], capped((q, L) => mix(.28, .13, (q / L) ** .8), .2, .12)), legM);                    // thigh
      k.add(f, seg([knee, [s * .84, .28, -.14], heel], capped((q, L) => .085 + .06 * Math.sin(Math.PI * Math.min(1, q / L * 1.3)) * (1 - q / L * .6), .1, .07)), legM);   // shin, with a calf
      k.add(f, seg([heel, [s * .8, .07, -.26], ball], capped((q, L) => mix(.075, .05, q / L), .06, .04), { flat: .65 }), legM);      // long foot
      [[.05, .26], [.35, .34], [.65, .4], [.95, .34], [1.3, .26]].forEach(([a, len]) => toe(ball, s * a, len, .032));
      // front leg: short and sturdy, down from the chest to a hand splayed under the chin
      const sh = [s * .32, .52, .46], el = [s * .46, .3, .54], wr = [s * .38, .07, .7];
      k.add(f, seg([sh, el, wr], capped((q, L) => .13 - .05 * (q / L) + .018 * Math.sin(Math.PI * q / L * 2), .1, .06)), legM);
      [[-.75, .19], [-.25, .24], [.25, .25], [.75, .2]].forEach(([a, len]) => toe(wr, s * a, len, .03));
    }
    k.add(f, tint(k, k.merge(toeGeos), legCol), legM);
    f.add(k.instances(k.sphere(1, { w: 16, h: 10 }), padM, pads));
    // eyes: gold with a sideways black pupil
    const iris = irisPaint((X, Y, th) => {
      const pupil = (X / .64) ** 2 + (Y / .27) ** 2;
      if (pupil < 1) return [12, 11, 9];
      const vein = Math.abs(N3(X * 10 + 5, Y * 10, 3) - .5) < .025;
      let c = mixC(hex('#f8d95e'), hex('#d8a126'), smooth(.35, 1.25, th));
      if (vein) c = mixC(c, hex('#8a6418'), .45);
      c = mixC(c, hex('#2f6a22'), smooth(1.3, 1.5, th));
      return mixC(c, [18, 16, 10], smooth(1.25, 1, pupil) * .7);                                  // a dark rim round the pupil
    });
    for (const s of [-1, 1]) {
      const c = V(k, eyeC(s)), dir = V(k, [s * .66, .42, .62]).normalize();
      eyeBall(k, f, c.clone().addScaledVector(dir, .14), dir, .2, gl, { iris, glint: .15 });
    }
    // the smile: a groove round the snout from one corner of the mouth to the other, the corners turned up
    const smile = [];
    for (let i = 0; i <= 24; i++) {
      const a = -1.55 + 3.1 * i / 24, q = S.hit([0, .82, .45], [Math.sin(a), -.02 + .16 * Math.abs(a / 1.55) ** 3, Math.cos(a)]);
      smile.push(q.p.clone().addScaledVector(q.n, -.004).toArray());
    }
    k.add(f, k.tube(smile, .013, { seg: 80, rs: 8, caps: true }), k.plastic('#1d4a17', { rough: .5 }));
    for (const s of [-1, 1]) {                                                                   // nostrils
      const q = S.hit([0, .92, .85], [s * .28, .55, .8]);
      k.add(f, k.sphere(.022, { w: 10, h: 8 }), k.matte('#1e3d18', .6), { p: q.p.toArray(), s: [1, .6, 1] });
    }
    g.userData.view = { el: 18 };
    return g;
  },

  // An Eastern box turtle out for a stroll: a high dark shell with a yellow-orange starburst on every scute, a spotted head.
  turtle(k) {
    const T = k.THREE, g = k.group(), yaw = k.deg(60), t = k.group([], { r: [0, yaw, 0] }); g.add(t);
    const view = { el: 22 }, gl = glintDir(k, yaw, view);
    const N3 = noise3(k);
    // --- carapace: a high dome over an oval, with a rolled rim. r runs from the top (0) to the rim (1) and under it (1.1);
    // UVs lay it out flat as seen from above, so the scutes can be painted like a diagram (front at the top of the canvas).
    const NP = 128, NR = 48, H = .98, e = .045, RMAX = 1.1;
    const shellPt = (phi, r) => {
      const sn = Math.sin(phi), cs = Math.cos(phi), rr = Math.min(r, 1), psi = rr * Math.PI / 2;
      const flare = 1 + .07 * smooth(.75, 1, rr) * Math.max(0, -cs) ** 1.5;
      const ax = .92 * flare, az = (cs > 0 ? 1.12 : 1.2) * flare, yRim = .42 + .06 * cs + .03 * Math.cos(2 * phi);
      const top = Math.pow(Math.cos(psi), .85);
      let P = [ax * Math.sin(psi) * sn, yRim + H * top * (1 - .06 * Math.sin(psi) ** 8), az * Math.sin(psi) * cs - .1 * Math.cos(psi)];
      if (r > 1) {
        const b = (r - 1) / (RMAX - 1) * Math.PI, ox = sn / ax, oz = cs / az, ol = Math.hypot(ox, oz);
        const cx = P[0] - ox / ol * e, cz = P[2] - oz / ol * e;
        P = [cx + ox / ol * e * Math.cos(b), P[1] - e * Math.sin(b), cz + oz / ol * e * Math.cos(b)];
      }
      return P;
    };
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= NR; i++) for (let j = 0; j <= NP; j++) {
      const r = i / NR * RMAX, phi = j / NP * TAU;
      pos.push(...shellPt(phi, r)); uv.push(.5 + .5 * r / RMAX * Math.sin(phi), .5 + .5 * r / RMAX * Math.cos(phi));
    }
    for (let i = 0; i < NR; i++) for (let j = 0; j < NP; j++) { const a = i * (NP + 1) + j, b = a + 1, c = a + NP + 1, d = c + 1; idx.push(a, b, d, a, d, c); }
    const shellGeo = new T.BufferGeometry();
    shellGeo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); shellGeo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    shellGeo.setIndex(idx); shellGeo.computeVertexNormals(); weld(shellGeo);
    // --- the scute pattern: Voronoi scutes (5 down the middle, 4 each side), a ring of marginals, starbursts from each areola
    const seeds = [];
    for (const y of [.63, .32, .02, -.28, -.58]) seeds.push({ x: 0, y, ax: 0, ay: y - .07 });
    for (const sx of [-1, 1]) for (const y of [.44, .15, -.15, -.45]) seeds.push({ x: sx * .56, y, ax: sx * .37, ay: y - .06 });
    for (const q of seeds) { q.a0 = k.rand() * TAU; q.n = 12 + (k.rand() * 4 | 0); q.len = Array.from({ length: 16 }, () => k.range(.5, 1)); }
    const RM = .84, NM = 26, W = 768;
    let bumpData = null;
    const shellTex = k.tex(W, W, ctx => {
      const img = ctx.createImageData(W, W), D = img.data, B = new Uint8ClampedArray(W * W * 4), grainN = noise2(11);
      const dk = hex('#39220f'), dd = hex('#1f1208'), go = hex('#eea43a'), ye = hex('#f8d25e');
      const ns = seeds.length, sx = seeds.map(q => q.x), sy = seeds.map(q => q.y);
      for (let py = 0; py < W; py++) for (let px = 0; px < W; px++) {
        const X = ((px + .5) / W * 2 - 1) * RMAX, Y = (1 - (py + .5) / W * 2) * RMAX, r = Math.sqrt(X * X + Y * Y);
        const grain = grainN(X * 22 + 40, Y * 22 + 40) - .5;
        let cr, cg, cb, bu = 150;
        if (r < RM) {
          let d1 = 9, d2 = 9, best = 0;
          for (let i = 0; i < ns; i++) { const ex = X - sx[i], ey = (Y - sy[i]) * 1.05, d = Math.sqrt(ex * ex + ey * ey); if (d < d1) { d2 = d1; d1 = d; best = i; } else if (d < d2) d2 = d; }
          const q = seeds[best], edge = Math.min(d2 - d1, (RM - r) * 2), dx = X - q.ax, dy = Y - q.ay, dist = Math.sqrt(dx * dx + dy * dy);
          const step = TAU / q.n, a = Math.atan2(dy, dx) - q.a0 + 20 * TAU, ri = Math.round(a / step), ray = Math.abs(a - ri * step);
          const reach = q.len[ri % 16] * .34;
          let mark = dist < .03 ? 1 : smooth(.01 + .07 * dist, .004 + .045 * dist, dist * ray * (1 - grain * .5)) * smooth(reach + .05, reach, dist);
          mark *= smooth(.012, .028, edge);
          const t = smooth(.14, 0, dist);
          cr = mix(dk[0], mix(go[0], ye[0], t), mark); cg = mix(dk[1], mix(go[1], ye[1], t), mark); cb = mix(dk[2], mix(go[2], ye[2], t), mark);
          const ring = 1 - .1 * (.5 + .5 * Math.sin(dist * 110)) * (1 - mark * .6);
          const seam = smooth(.016, .004, edge);
          cr = mix(cr * ring, dd[0], seam); cg = mix(cg * ring, dd[1], seam); cb = mix(cb * ring, dd[2], seam);
          bu = 150 - seam * 110 + Math.sin(dist * 110) * 6;
        } else {
          const phi = Math.atan2(X, Y), step = TAU / NM, a = phi + step / 2 + 20 * TAU, m = a % step, cen = Math.abs(m - step / 2) / step;
          const seam = Math.max(smooth(.012, .002, Math.abs(r - RM)), smooth(.47, .495, cen));
          const bar = smooth(.16, .09, cen + grain * .12) * smooth(.88, .94, r);
          cr = mix(mix(dk[0], go[0], bar), dd[0], seam); cg = mix(mix(dk[1], go[1], bar), dd[1], seam); cb = mix(mix(dk[2], go[2], bar), dd[2], seam);
          bu = 150 - seam * 110;
        }
        const o = (py * W + px) * 4;
        D[o] = cr + grain * 18; D[o + 1] = cg + grain * 14; D[o + 2] = cb + grain * 8; D[o + 3] = 255;
        B[o] = B[o + 1] = B[o + 2] = bu; B[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      bumpData = B;
    }, { cache: 'birds:turtle:shell' });
    const bumpTex = k.tex(W, W, ctx => { if (!bumpData) { ctx.fillStyle = '#969696'; ctx.fillRect(0, 0, W, W); return; } const img = ctx.createImageData(W, W); img.data.set(bumpData); ctx.putImageData(img, 0, 0); }, { cache: 'birds:turtle:shellbump', data: true });
    const shellM = k.mat({ map: shellTex, bumpMap: bumpTex, bumpScale: 3, roughness: .38, clearcoat: .7, clearcoatRoughness: .22, side: T.DoubleSide });
    k.add(t, shellGeo, shellM);
    // plastron and the body under the shell
    k.add(t, k.sphere(1, { w: 48, h: 20 }), k.plastic('#8a6a30', { rough: .5, coat: .3 }), { p: [0, .3, 0], s: [.84, .1, 1.1] });
    const skinM = k.mat({ color: '#3a302a', roughness: .75, sheen: .3, sheenColor: new T.Color('#8a7a6a') });
    k.add(t, k.sphere(1, { w: 48, h: 20 }), skinM, { p: [0, .4, 0], s: [.82, .2, 1.08] });

    // --- head and neck, stretched out of the shell: dark skin speckled orange, a yellow chin, a red eye
    const headC = [0, .7, 1.44];
    const S = skin(k, [
      { c: [0, .52, 1.08], r: [.19, .18, .38], rot: [-.34, 0, 0] },            // neck
      { c: headC, r: [.21, .19, .27], rot: [.12, 0, 0], k: .14 },             // head, a little flat on top
      { c: [0, .67, 1.66], r: [.13, .125, .13], k: .09 },                     // snout
      { c: [0, .61, 1.745], r: [.07, .075, .05], k: .05 },                    // hooked tip of the upper jaw
      { c: [0, .6, 1.5], r: [.17, .1, .22], k: .1 },                          // lower jaw
    ], { c: [0, .63, 1.4], R: 2, nu: 80, nv: 56, stretch: [1, 1, 1.6], key: 'turtlehead' });
    const skinC = hex('#2e2520'), chinC = hex('#e3a040');
    const chinOf = p => smooth(.62, .56, p[1] + (N3(p[0] * 20, p[1] * 20, p[2] * 20) - .5) * .06) * smooth(1.05, 1.25, p[2]);
    const headTex = paintSkin(k, S, 512, 256, p => mixC(skinC, chinC, chinOf(p)), (ctx, W, H, at, R) => {
      // orange and yellow freckles on the head and neck (dark ones on the yellow chin)
      for (let i = 0; i < 300; i++) {
        const u = .25 + R() * .5, v = .1 + R() * .85, q = at(u, v);
        if (q.p[2] < .9 || (q.p[2] < 1.2 && R() < .5)) continue;
        const r = .007 + R() * .014 * (R() < .15 ? 1.8 : 1), chin = chinOf(q.p);
        ctx.fillStyle = chin > .5 ? 'rgba(46,37,32,.9)' : R() < .6 ? '#f0a33a' : '#f3c653';
        ctx.beginPath(); ctx.ellipse(u * W, (1 - v) * H, r / q.su, r / q.sv, 0, 0, TAU); ctx.fill();
      }
    });
    k.add(t, S.geo, k.mat({ map: headTex, roughness: .55, clearcoat: .3, clearcoatRoughness: .4 }));
    for (const s of [-1, 1]) {
      const q = S.hit(headC, [s * .8, .4, .45]), dir = q.n.clone().add(V(k, [0, 0, .4])).normalize(), c = q.p.clone().addScaledVector(q.n, -.02);
      eyeBall(k, t, c, dir, .05, gl, { glint: .24,
        iris: irisPaint((X, Y, th) => th < .38 ? [10, 8, 8] : th < .95 ? mixC(hex('#e0441c'), hex('#8a1e0c'), smooth(.4, .95, th)) : [40, 30, 26]) });
      const lid = k.mesh(k.torus(.047, .011, { rs: 6, ts: 24 }), k.matte('#2a211c', .7));   // eyelid
      lid.position.copy(c).addScaledVector(dir, .018); face(k, lid, dir); t.add(lid);
    }
    // mouth line
    const mouth = [];
    for (let i = 0; i <= 16; i++) { const a = -1.2 + 2.4 * i / 16, q = S.hit([0, .6, 1.5], [Math.sin(a), -.1 - .15 * (1 - Math.abs(a) / 1.2), Math.cos(a)]); mouth.push(q.p.clone().addScaledVector(q.n, -.003).toArray()); }
    k.add(t, k.tube(mouth, .008, { seg: 48, rs: 6, caps: true }), k.matte('#120c09', .6));

    // --- legs: stubby, scaly, clawed
    const legM = k.mat({ color: '#3d322b', roughness: .7, sheen: .3, sheenColor: new T.Color('#8a7a6a') });
    const scaleM = k.mat({ color: '#ffffff', roughness: .45, clearcoat: .5, clearcoatRoughness: .3 });
    const clawM = k.plastic('#d9c9a2', { rough: .4 });
    const scales = [], claws = [];
    const leg = (pts, r0, r1, front, scaly = false) => {
      k.add(t, limb(k, pts, r0, r1, { seg: 24, rs: 16 }), legM);
      const c = curveOf(k, pts), end = V(k, pts[pts.length - 1]);
      k.add(t, k.sphere(1, { w: 24, h: 12 }), legM, { p: [end.x, .06, end.z + .02], s: [r1 * 1.25, .07, r1 * 1.3] });
      const fwd = V(k, [Math.sin(front), 0, Math.cos(front)]);
      for (let i = 0; i < 4; i++) {
        const a = front + (i - 1.5) * .38, d = V(k, [Math.sin(a), 0, Math.cos(a)]);
        const cp = V(k, [end.x, .05, end.z + .02]).addScaledVector(d, r1 * 1.15);
        claws.push({ p: cp.toArray(), r: [0, 0, 0], q: d });
      }
      // the forelegs wear big orange scales, shingled down their fronts
      if (!scaly) return;
      const side = V(k, [pts[0][0] > 0 ? 1 : -1, 0, 0]);
      for (let row = 0; row < 6; row++) for (let col = -1; col <= 1; col++) {
        const u = .5 + row * .085 + (col & 1) * .04, P = c.getPointAt(Math.min(u, .97)), Tn = c.getTangentAt(Math.min(u, .97));
        const out = fwd.clone().applyAxisAngle(V(k, [0, 1, 0]), col * .75 * side.x).addScaledVector(Tn, -Tn.dot(fwd)).normalize();
        const r = mix(r0, r1, u);
        scales.push({ p: P.clone().addScaledVector(out, r * .93).toArray(), s: [.045, .016, .038], color: k.rand() < .55 ? '#ee9a34' : '#f2bd4c', n: out, t: Tn });
      }
    };
    for (const s of [-1, 1]) {
      leg([[s * .5, .44, .72], [s * .74, .3, .88], [s * .8, .1, .98]], .15, .12, s * .45, true);
      leg([[s * .5, .4, -.72], [s * .7, .25, -.88], [s * .74, .1, -.94]], .17, .15, s * .5 + Math.PI * .15 * s);
    }
    const sc = k.instances(k.sphere(1, { w: 12, h: 8 }), scaleM, scales.map(q => ({ p: q.p, s: q.s, color: q.color })));
    scales.forEach((q, i) => { const o = new T.Object3D(); o.position.set(...q.p); face(k, o, q.n, q.t.toArray()); o.rotateX(Math.PI / 2); o.scale.set(...q.s); o.updateMatrix(); sc.setMatrixAt(i, o.matrix); });
    t.add(sc);
    const cl = k.instances(k.cone(.022, .09, 8), clawM, claws.map(q => ({ p: q.p })));
    claws.forEach((q, i) => { const o = new T.Object3D(); o.position.set(...q.p); aim(k, o, q.q.clone().add(V(k, [0, -.5, 0]))); o.updateMatrix(); cl.setMatrixAt(i, o.matrix); });
    t.add(cl);
    k.add(t, k.cone(.06, .2, 12), legM, { p: [0, .32, -1.22], r: [-Math.PI / 2 - .5, 0, 0] });   // a little tail
    g.userData.view = view;
    g.userData.fullView = { el: 19 };
    return g;
  },

  // A ruby-throated hummingbird sipping from a pink trumpet flower, wings a blur.
  hummingbird(k) {
    const T = k.THREE, g = k.group();
    // --- the flower: a trumpet on a tall stem, its mouth turned to the bird
    const F0 = V(k, [.72, 1.62, -.08]), d = V(k, [-1, -.12, -.3]).normalize(), FL = 1.0;
    const M = F0.clone().addScaledVector(d, FL);
    const trumpetGeo = (() => {
      const ns = 40, nt = 60, pos = [], uv = [], idx = [];
      for (let i = 0; i <= ns; i++) for (let j = 0; j <= nt; j++) {
        const s = i / ns, th = j / nt * TAU, lobe = Math.abs(Math.cos(th * 2.5)) ** .7, f = smooth(.78, 1, s);
        const r = (.08 + .06 * s + .36 * s ** 5) * (1 - f * .3 * (1 - lobe)), y = FL * s - f * .14 * lobe * s;
        pos.push(Math.sin(th) * r, y, Math.cos(th) * r); uv.push(j / nt, s);
      }
      for (let i = 0; i < ns; i++) for (let j = 0; j < nt; j++) { const a = i * (nt + 1) + j, b = a + 1, c = a + nt + 1, e = c + 1; idx.push(a, e, b, a, c, e); }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals(); return weld(geo);
    })();
    const petalTex = k.tex(256, 256, (c, w, h) => {
      const gr = c.createLinearGradient(0, h, 0, 0);                       // canvas bottom = the base of the trumpet
      gr.addColorStop(0, '#c2386e'); gr.addColorStop(.35, '#ee4c93'); gr.addColorStop(.75, '#ff6fac'); gr.addColorStop(.92, '#ff9bc8'); gr.addColorStop(1, '#ffc0dc');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(170,20,80,.35)'; c.lineWidth = 1.4;
      for (let i = 0; i < 40; i++) { const x = (i + .5) / 40 * w; c.beginPath(); c.moveTo(x, h); c.bezierCurveTo(x, h * .5, x + 3, h * .2, x + (i % 2 ? 5 : -5), 0); c.stroke(); }
    }, { cache: 'birds:hummingbird:petal' });
    const trumpet = k.mesh(trumpetGeo, k.mat({ map: petalTex, roughness: .5, sheen: .6, sheenColor: new T.Color('#ffd0e6'), side: T.DoubleSide }));
    trumpet.position.copy(F0); aim(k, trumpet, d); g.add(trumpet);
    // a yellow throat deep inside, and stamens peeping out
    const throat = k.mesh(k.cyl(.07, .1, .46, { seg: 24, open: true }), k.mat({ color: '#ffe27a', roughness: .6, side: T.BackSide }));
    throat.position.copy(F0).addScaledVector(d, .5); aim(k, throat, d); g.add(throat);
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + .4, off = V(k, [Math.cos(a), Math.sin(a), 0]).multiplyScalar(.05);
      const q = new T.Quaternion().setFromUnitVectors(V(k, [0, 0, 1]), d);
      const base = F0.clone().addScaledVector(d, .7).add(off.clone().applyQuaternion(q)), tip = F0.clone().addScaledVector(d, FL + .06).add(off.clone().multiplyScalar(2.2).applyQuaternion(q));
      k.add(g, k.tube([base.toArray(), tip.toArray()], .008, { rs: 6, seg: 4 }), k.matte('#fff4d6', .6));
      k.add(g, k.sphere(.028, { w: 10, h: 8 }), k.plastic('#ffd24a', { rough: .5 }), { p: tip.toArray(), s: [1, 1.5, 1] });
    }
    // calyx, stem, a bud and two leaves
    const green = k.plastic('#4f9a34', { rough: .55, coat: .2 }), greenD = k.plastic('#3f7f2a', { rough: .55, coat: .2 });
    const cal = k.mesh(k.lathe([[0, -.06], [.09, 0], [.12, .1], [.1, .16], [0, .16]], { smooth: true, seg: 20 }), green); cal.position.copy(F0).addScaledVector(d, -.02); aim(k, cal, d); g.add(cal);
    for (let i = 0; i < 5; i++) {
      const sep = k.mesh(lensGeo(k, .22, t => .045 * Math.sin(Math.PI * Math.min(1, t * 1.1)), { th: () => .008, ns: 8, nt: 4 }), green);
      const q = new T.Quaternion().setFromUnitVectors(V(k, [0, 1, 0]), d), a = i / 5 * TAU;
      sep.position.copy(F0).addScaledVector(d, .06); sep.quaternion.copy(q).multiply(new T.Quaternion().setFromEuler(new T.Euler(0, a, 0))).multiply(new T.Quaternion().setFromEuler(new T.Euler(.5, 0, 0)));
      g.add(sep);
    }
    const stemPts = [F0.clone().addScaledVector(d, -.1).toArray(), [.9, 1.52, -.1], [1.0, 1.2, -.06], [.98, .8, -.02], [.94, .4, .02], [.97, 0, .04]];
    k.add(g, k.tube(stemPts, .035, { seg: 80, rs: 10, caps: true }), green);
    const budC = curveOf(k, [[.99, 1.25, -.06], [1.14, 1.58, -.05], [1.24, 1.9, 0]]);
    k.add(g, k.tube(budC.getPoints(8).map(v => v.toArray()), .022, { seg: 24, rs: 8 }), green);
    const bud = k.mesh(k.lathe([[0, 0], [.07, .05], [.09, .25], [.07, .45], [.03, .56], [0, .58]], { smooth: true, seg: 24 }), k.mat({ map: petalTex, roughness: .5, sheen: .6, sheenColor: new T.Color('#ffd0e6') }));
    bud.position.copy(budC.getPointAt(1)); aim(k, bud, budC.getTangentAt(1).add(V(k, [.1, .2, 0]))); g.add(bud);
    const leafTex = k.tex(64, 256, (c, w, h) => {
      c.fillStyle = '#58a83a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#8ccf5a'; c.fillRect(w / 2 - 1.5, 0, 3, h);
      c.strokeStyle = 'rgba(140,207,90,.7)'; c.lineWidth = 1.2;
      for (let y = 20; y < h; y += 22) { c.beginPath(); c.moveTo(w / 2, y + 14); c.quadraticCurveTo(w * .3, y + 4, 2, y - 6); c.moveTo(w / 2, y + 14); c.quadraticCurveTo(w * .7, y + 4, w - 2, y - 6); c.stroke(); }
    }, { cache: 'birds:hummingbird:leaf' });
    const leafM = k.mat({ map: leafTex, roughness: .5, clearcoat: .3, side: T.DoubleSide });
    for (const [p, along, out] of [[[.985, .82, -.02], [.9, .5, .25], [0, .7, .5]], [[.95, .42, .01], [-.7, .45, .45], [0, .7, .6]]]) {
      const lf = k.mesh(lensGeo(k, .7, t => .17 * Math.sin(Math.PI * t ** .8), { th: t => .012 * Math.sin(Math.PI * t), bend: (q, t) => -.05 * t * t, curl: q => -.12 * q * q, ns: 20, nt: 8 }), leafM);
      lf.position.set(...p); orient(k, lf, along, out); g.add(lf);
    }

    // --- the bird, bill in the flower
    const yaw = Math.atan2(-d.x, -d.z), SC = 1.22, hb = k.group([], { r: [0, yaw, 0], s: SC }); g.add(hb);
    const gl = glintDir(k, yaw);
    const headC = [0, .52, .34], billLen = .9, billBase = V(k, [0, .49, .58]);
    const billDir = V(k, [0, Math.asin(-d.y) * 0 - .02, 1]).normalize();
    const tipLocal = billBase.clone().addScaledVector(billDir, billLen);
    const tipWorld = M.clone().addScaledVector(d, -.07);
    hb.position.copy(tipWorld).sub(tipLocal.clone().multiplyScalar(SC).applyAxisAngle(V(k, [0, 1, 0]), yaw));
    const S = skin(k, [
      { c: [0, 0, 0], r: [.28, .3, .56], rot: [-.8, 0, 0] },                // body, hanging at a slant
      { c: [0, .3, .28], r: [.24, .24, .24], k: .18 },                      // throat
      { c: headC, r: [.25, .245, .27], k: .14 },                            // head
    ], { c: [0, .2, .12], R: 2.5, nu: 96, nv: 72, key: 'hummingbird' });
    const emerald = hex('#2f9e52'), emeraldL = hex('#58c46c'), ruby = hex('#d2102c'), rubyL = hex('#ff3a52'), chin = hex('#1a1414'), belly = hex('#eeeee6'), flank = hex('#8fa585');
    const eyeDirs = [-1, 1].map(s => [s * .8, .3, .52]), dots = eyeDirs.map(d => S.hit(headC, [d[0] * 1.1, d[1] - .05, d[2] - .55]).p);
    const N3 = noise3(k);
    const tex = paintSkin(k, S, 512, 384, (p, n) => {
      const nz = N3(p[0] * 9, p[1] * 9, p[2] * 9, 2) - .5;
      const back = n[1] * .6 - n[2] * .8 + nz * .15;                                                     // back and crown
      let c = mixC(belly, flank, smooth(-.7, .1, back + Math.abs(n[0]) * .5));
      let iri = 0, rough = 200, metal = 40;
      const g1 = smooth(-.15, .15, back + (p[1] > .45 ? .6 : 0));
      c = mixC(c, mixC(emerald, emeraldL, smooth(-.2, .5, nz * 2)), g1); iri = g1 * 255; rough = mix(200, 110, g1); metal = mix(0, 140, g1);
      // ruby gorget on the throat, a dark chin at the bill
      const throat = smooth(.1, .4, n[2] - n[1] * .7) * smooth(.2, .28, p[1] + nz * .03) * smooth(.62, .45, p[1]) * smooth(.36, .3, Math.abs(p[0]) - (p[2] - .2) * .2);
      c = mixC(c, mixC(ruby, rubyL, smooth(-.3, .5, nz * 3 + n[1])), throat); iri = Math.max(iri, throat * 255); rough = mix(rough, 70, throat); metal = mix(metal, 150, throat);
      const ch = smooth(.12, .2, p[2] - .42) * smooth(.62, .44, p[1]) * smooth(.3, .6, n[2]);
      c = mixC(c, chin, ch * .85);
      // a white dot just behind each eye
      for (const q of dots) c = mixC(c, belly, smooth(.045, .03, len3(p[0] - q.x, p[1] - q.y, p[2] - q.z)));
      return [...c, iri, rough, metal];
    }, (ctx, W, H, at, R) => {
      for (let i = 0; i < 1800; i++) {
        const u = R(), v = .1 + R() * .85, q = at(u, v), s = .025 + R() * .02, w = s / q.su, h = s / q.sv * .7;
        if (w > 30 || h > 30) continue;
        ctx.strokeStyle = R() < .5 ? 'rgba(255,255,230,.12)' : 'rgba(0,30,10,.14)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(u * W, (1 - v) * H, w, h, 0, .15 * Math.PI, .85 * Math.PI); ctx.stroke();
      }
    }, 'skin', { extra: true });
    k.add(hb, S.geo, k.mat({ map: tex.map, roughness: 1, roughnessMap: tex.data, metalness: 1, metalnessMap: tex.data, iridescence: 1, iridescenceMap: tex.data,
      iridescenceIOR: 1.35, iridescenceThicknessRange: [260, 520], sheen: .3, sheenColor: new T.Color('#ffffff'), sheenRoughness: .5 }));
    for (const d of eyeDirs) {
      const e = S.hit(headC, d);
      eyeBall(k, hb, e.p.clone().addScaledVector(e.n, -.02), e.n, .06, gl, { glint: .22 });
    }
    // the needle bill
    const bill = k.mesh(k.lathe([[.036, 0], [.031, .2], [.021, .6], [.012, .86], [0, .9]], { smooth: true, seg: 16 }), k.gloss('#141212', { rough: .25 }));
    bill.position.copy(billBase).addScaledVector(billDir, -.04); aim(k, bill, billDir); hb.add(bill);
    // forked tail
    const tailM = k.mat({ color: '#2a3a2e', roughness: .45, metalness: .3, iridescence: .6, iridescenceIOR: 1.3, side: T.DoubleSide });
    const feather = lensGeo(k, .55, t => .055 * Math.sqrt(Math.sin(Math.PI * Math.min(1, t * .95 + .05))), { th: () => .01, ns: 12, nt: 4 });
    const tails = [];
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { const a = s * (.12 + i * .1); tails.push({ p: [0, -.3, -.34], along: [Math.sin(a) * .9, -.62, -.78], out: [0, .78, -.6], s: [1, 1 + i * .08, 1] }); }
    hb.add(oriented(k, feather, tailM, tails));
    // wings: a smoky translucent blade on each side, and the blur of its stroke fanned out beside it
    const wingTex = k.tex(128, 512, (c, w, h) => {
      // smoky and see-through, darkest along the leading edge and at the root, melting away towards the trailing edge and tip
      const img = c.createImageData(w, h), D = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = x / (w - 1), v = 1 - y / (h - 1), vein = Math.abs(((u * 9 + v * 1.5) % 1) - .5) < .06 ? 1 : 0;
        const a = (.62 - .42 * u) * smooth(1, .75, v) * smooth(0, .06, u) * smooth(1, .9, u) + .25 * smooth(.08, 0, u) + .12 * vein * smooth(1, .6, v);
        const i = (y * w + x) * 4, g = 70 + 90 * u;
        D[i] = g - 8; D[i + 1] = g; D[i + 2] = g + 4; D[i + 3] = clamp(a) * 255;
      }
      c.putImageData(img, 0, 0);
    }, { cache: 'birds:hummingbird:wing2' });
    const wingM = k.mat({ map: wingTex, transparent: true, roughness: .3, metalness: .1, iridescence: .8, iridescenceIOR: 1.3, side: T.DoubleSide, depthWrite: false });
    const blurTex = k.tex(256, 256, (c, w, h) => {
      const img = c.createImageData(w, h), D = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const X = x / w * 2 - 1, Y = 1 - y / h * 2, r = Math.hypot(X, Y), a = Math.atan2(Y, X) / (Math.PI / 2);
        const streak = .75 + .25 * Math.sin(a * 90 + Math.sin(a * 13) * 2);
        const al = r > 1 || a < 0 ? 0 : .5 * smooth(.1, .4, r) * smooth(1, .8, r) * (.25 + .75 * Math.max(smooth(.3, 0, a), smooth(.7, 1, a))) * streak;
        const i = (y * w + x) * 4; D[i] = 150; D[i + 1] = 160; D[i + 2] = 162; D[i + 3] = al * 255;
      }
      c.putImageData(img, 0, 0);
    }, { cache: 'birds:hummingbird:blur' });
    const blurM = k.mat({ map: blurTex, transparent: true, roughness: .5, side: T.DoubleSide, depthWrite: false });
    for (const s of [-1, 1]) {
      const sh = S.hit([0, .15, .05], [s, .55, .15]), root = sh.p.clone().addScaledVector(sh.n, -.05);
      const A = V(k, [s * .38, .72, -.58]).normalize(), B = V(k, [s * .38, .74, .56]).normalize(), nrm = A.clone().cross(B).normalize();
      const up = s < 0 ? A : B;                                  // the near wing is caught at the back of its stroke, the far one at the front
      const wing = k.mesh(lensGeo(k, 1.3, t => .125 * Math.pow(Math.sin(Math.PI * Math.min(1, t * .92 + .04)), .6) * (1 - .35 * t), { th: () => .006, ns: 20, nt: 6 }), wingM, { shadow: false });
      wing.position.copy(root); orient(k, wing, up, nrm); wing.renderOrder = 2; hb.add(wing);
      const fan = k.mesh(new T.CircleGeometry(1.3, 40, 0, Math.PI / 2), blurM, { shadow: false });
      fan.position.copy(root); orient(k, fan, B.clone().addScaledVector(A, -A.dot(B)).normalize(), nrm); fan.renderOrder = 1; hb.add(fan);
    }
    g.userData.view = { az: 26, el: 12 };
    return g;
  },

  // A great horned owl on an old stump: mottled brown, barred chest, tall ear tufts and a stare you can't win.
  owl(k) {
    const T = k.THREE, g = k.group(), yaw = k.deg(22), o = k.group([], { r: [0, yaw, 0] }); g.add(o);
    const gl = glintDir(k, yaw), N3 = noise3(k);
    const ST = .58;                                                         // top of the stump
    // --- the stump: flared roots, furrowed bark, a cut top with rings
    const stumpGeo = (() => {
      const ns = 24, nt = 72, pos = [], uv = [], idx = [];
      for (let i = 0; i <= ns; i++) for (let j = 0; j <= nt; j++) {
        const s = i / ns, th = j / nt * TAU, y = s * ST;
        const root = Math.max(0, Math.cos(5 * th + .7)) ** 3 * (1 - s / .5) ** 2 * (s < .5 ? 1 : 0);
        const r = (.9 + .22 * (1 - s) ** 3 + .32 * root) * (1 + .025 * Math.sin(th * 9 + s * 3) + .02 * Math.sin(th * 23));
        pos.push(Math.sin(th) * r, y, Math.cos(th) * r); uv.push(j / nt, s);
      }
      for (let i = 0; i < ns; i++) for (let j = 0; j < nt; j++) { const a = i * (nt + 1) + j, b = a + 1, c = a + nt + 1, e = c + 1; idx.push(a, b, e, a, e, c); }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals(); return weld(geo);
    })();
    const barkTex = k.tex(512, 128, (c, w, h) => {
      const R = rng(5);
      c.fillStyle = '#5a4535'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {                                         // ridges and furrows running up the trunk
        const x = R() * w, lw = 2 + R() * 7;
        c.strokeStyle = R() < .5 ? `rgba(128,105,82,${.4 + R() * .4})` : `rgba(38,27,20,${.5 + R() * .4})`; c.lineWidth = lw;
        c.beginPath(); c.moveTo(x, h); for (let y = h; y >= 0; y -= 8) c.lineTo(x + Math.sin(y * .05 + i) * 4, y); c.stroke();
      }
    }, { cache: 'birds:owl:bark' });
    k.add(o, stumpGeo, k.mat({ map: barkTex, roughness: .9 }));
    const top = k.painted(512, 512, (c, w, h) => {
      const m = w / 2, R = rng(9);
      c.fillStyle = '#c9a36a'; c.fillRect(0, 0, w, h);
      for (let r = 8; r < m * .9; r += 7 + R() * 6) { c.strokeStyle = `rgba(150,105,55,${.35 + R() * .3})`; c.lineWidth = 1.5 + R() * 2; c.beginPath(); c.ellipse(m + 6, m - 4, r, r * .96, 0, 0, TAU); c.stroke(); }
      c.strokeStyle = 'rgba(90,60,30,.5)'; c.lineWidth = 2.5;
      for (let i = 0; i < 5; i++) { const a = R() * TAU; c.beginPath(); c.moveTo(m + Math.cos(a) * 30, m + Math.sin(a) * 30); c.lineTo(m + Math.cos(a + .05) * m * .8, m + Math.sin(a + .05) * m * .8); c.stroke(); }
      c.strokeStyle = '#5a4535'; c.lineWidth = 26; c.beginPath(); c.arc(m, m, m - 13, 0, TAU); c.stroke();
    }, { rough: .8, cache: 'birds:owl:stumptop' });
    k.add(o, k.disc(.93, 72), top, { p: [0, ST, 0], r: [-Math.PI / 2, 0, 0] });

    // --- the owl: one feathered body from belly to crown
    const headC = [0, ST + 2.28, .08];
    const S = skin(k, [
      { c: [0, ST + 1.02, -.04], r: [.86, 1.0, .8] },                       // body
      { c: [0, ST + .7, .08], r: [.78, .6, .7], k: .3 },                    // round belly
      { c: [0, ST + 1.5, .14], r: [.86, .62, .68], k: .3 },                 // broad chest
      { c: headC, r: [.96, .66, .74], k: .4 },                              // big broad head, flat on top
      { c: [0, ST + 2.22, 2.34], r: [1.64, 1.64, 1.64], k: .24, sub: true },  // flattened face
    ], { c: [0, ST + 1.5, 0], R: 4, nu: 128, nv: 96, key: 'owl' });
    const E = [-1, 1].map(s => [s * .32, ST + 2.26]);                      // eye centres, seen face on
    const brown = hex('#6c4d33'), brownD = hex('#3f2b1c'), buff = hex('#c9ad84'), buffL = hex('#e4d3b2'), white = hex('#f3efe6'), bar = hex('#4e3524');
    const tex = paintSkin(k, S, 1024, 512, (p, n) => {
      const y = p[1] - ST, front = smooth(.25, .6, n[2] + (N3(p[0] * 9, p[1] * 3, 1, 2) - .5) * .3);
      const m1 = N3(p[0] * 5, p[1] * 5, p[2] * 5, 2), m2 = N3(p[0] * 17 + 9, p[1] * 17, p[2] * 17);
      // mottled brown all over the back, crown and shoulders
      let c = mixC(brown, brownD, smooth(.45, .7, m1) * .8);
      c = mixC(c, buff, smooth(.68, .84, m2) * .55);
      // barred buff underparts
      const chest = front * smooth(2.1, 1.85, y) * smooth(.05, .3, y);
      const wav = y * 70 + Math.sin(p[0] * 7) * 1.4 + (m2 - .5) * 6;
      const bars = smooth(.62, .9, Math.sin(wav)) * smooth(.3, .55, m2 + m1 * .4);
      let under = mixC(mixC(buffL, buff, smooth(.3, .75, m1)), bar, bars * smooth(1.95, 1.55, y) * .9);
      under = mixC(under, mixC(brown, brownD, m2), smooth(.5, .7, m1 + m2 * .3) * smooth(1.5, 1.8, y) * smooth(1.98, 1.86, y) * .9);   // a band of dark blotches up top
      c = mixC(c, under, chest);
      // white bib under the face
      const bib = smooth(.3, .55, n[2]) * smooth(.36, .24, Math.abs(p[0]) + (m2 - .5) * .15) * smooth(1.8, 1.9, y) * smooth(2.14, 2.04, y);
      c = mixC(c, white, bib);
      return c;
    }, (ctx, W, H, at, R) => {
      // little feather marks: dark shaft streaks and pale tips
      for (let i = 0; i < 3200; i++) {
        const u = R(), v = .05 + R() * .9, q = at(u, v), s = .045 + R() * .04, w = s / q.su, h = s / q.sv;
        if (w > 50 || h > 50) continue;
        const x = u * W, y = (1 - v) * H;
        if (R() < .6) { ctx.strokeStyle = 'rgba(40,26,16,.3)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y - h * .5); ctx.lineTo(x, y + h * .5); ctx.stroke(); }
        else { ctx.strokeStyle = 'rgba(236,222,196,.16)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(x, y, w * .5, h * .4, 0, .2 * Math.PI, .8 * Math.PI); ctx.stroke(); }
      }
    });
    k.add(o, S.geo, k.mat({ map: tex, roughness: .86, sheen: .7, sheenRoughness: .45, sheenColor: new T.Color('#f2e3c8') }));

    // --- the face: a mask laid over the front of the head: rufous discs, black rims, white brows
    const FX = .78, FY0 = ST + 1.8, FY1 = ST + 2.72, NF = 40, fpos = [], fuv = [], fidx = [];
    for (let i = 0; i <= NF; i++) for (let j = 0; j <= NF; j++) {
      const x = -FX + 2 * FX * j / NF, y = FY0 + (FY1 - FY0) * i / NF;
      const q = S.hit([x * .3, y, 0], [x * .7, 0, 1]);
      const P = q.p.addScaledVector(q.n, .012);
      fpos.push(P.x, P.y, P.z); fuv.push(j / NF, i / NF);
    }
    for (let i = 0; i < NF; i++) for (let j = 0; j < NF; j++) { const a = i * (NF + 1) + j, b = a + 1, c = a + NF + 1, e = c + 1; fidx.push(a, b, e, a, e, c); }
    const faceGeo = new T.BufferGeometry();
    faceGeo.setAttribute('position', new T.Float32BufferAttribute(fpos, 3)); faceGeo.setAttribute('uv', new T.Float32BufferAttribute(fuv, 2));
    faceGeo.setIndex(fidx); faceGeo.computeVertexNormals();
    const faceMat = k.painted(512, 320, (c, w, h) => {
      const img = c.createImageData(w, h), D = img.data, Nf = noise2(21);
      const cA = hex('#d8a672'), cB = hex('#b0672f'), cS = hex('#6e3a19'), cR = hex('#231811'), cW = hex('#eee8da'), cL = hex('#e6dccb');
      const brow = (x, y, s) => { const ay = ST + 2.06, bx = s * .5, by = ST + 2.62 - ay, t = clamp((x * bx + (y - ay) * by) / (bx * bx + by * by)), ex = x - bx * t, ey = y - ay - by * t; return Math.sqrt(ex * ex + ey * ey) - (.05 + .03 * t); };
      for (let py = 0; py < h; py++) {
        const y = FY1 - (FY1 - FY0) * (py + .5) / h, ay = y - E[0][1];
        for (let px = 0; px < w; px++) {
          const x = -FX + 2 * FX * (px + .5) / w, i = (py * w + px) * 4;
          const ax0 = x - E[0][0], ax1 = x - E[1][0], d0 = Math.sqrt(ax0 * ax0 + ay * ay), d1 = Math.sqrt(ax1 * ax1 + ay * ay);
          const dm = Math.min(d0, d1), bd = Math.min(brow(x, y, -1), brow(x, y, 1)), by2 = y - (ST + 2.0);
          const bill = smooth(.14, .08, Math.sqrt(x * x * 1.69 + by2 * by2)) * smooth(.12, .06, Math.abs(x) - .02);
          if (dm > .56 && bd > .04 && bill <= 0) { D[i + 3] = 0; continue; }
          // the disc: rufous, paler by the eye, finely streaked outwards from it
          const ang = Math.atan2(ay, d0 < d1 ? ax0 : ax1);
          const Rd = .45 + (Nf(ang * 8 + 50, dm * 6) - .5) * .05 + .03 * Math.sin(ang * 2);
          let a = smooth(Rd + .03, Rd, dm);
          const t1 = smooth(.18, .42, dm), st = smooth(.55, .9, Math.sin(ang * 34 + Nf(dm * 20, ang * 3) * 3)) * smooth(.22, .3, dm) * .4;
          let r = mix(mix(cA[0], cB[0], t1), cS[0], st), g = mix(mix(cA[1], cB[1], t1), cS[1], st), b = mix(mix(cA[2], cB[2], t1), cS[2], st);
          // its black rim, round the outside and below
          const rimW = .05 + .02 * Math.sin(ang * 3);
          const rim = smooth(Rd - rimW - .025, Rd - rimW, dm) * smooth(ST + 2.62, ST + 2.4, y) * smooth(.08, .2, Math.abs(x) + (ST + 2.2 - y) * .6);
          r = mix(r, cR[0], rim); g = mix(g, cR[1], rim); b = mix(b, cR[2], rim);
          // white brows in a V from the bill up over each eye, and pale bristles round the bill
          const bw = smooth(.015, -.01, bd + (Nf(x * 30 + 7, y * 30) - .5) * .03);
          r = mix(r, cW[0], bw); g = mix(g, cW[1], bw); b = mix(b, cW[2], bw); a = Math.max(a, bw);
          const bl = bill * .9;
          r = mix(r, cL[0], bl); g = mix(g, cL[1], bl); b = mix(b, cL[2], bl); a = Math.max(a, bill);
          const gn = (Nf(px * .7, py * .7) - .5) * 18;
          D[i] = r + gn; D[i + 1] = g + gn; D[i + 2] = b + gn; D[i + 3] = a * 255;
        }
      }
      c.putImageData(img, 0, 0);
    }, { transparent: true, rough: .85, cache: 'birds:owl:face' });
    faceMat.polygonOffset = true; faceMat.polygonOffsetFactor = -2; faceMat.polygonOffsetUnits = -2;
    k.add(o, faceGeo, faceMat, { shadow: false });

    // eyes: huge, yellow, black-pupilled, rimmed in black
    const iris = irisPaint((X, Y, th) => {
      if (th < .44) return [8, 6, 5];
      if (th > 1.02) return [26, 18, 12];
      const fib = Math.sin(Math.atan2(Y, X) * 40) * .5 + .5;
      let c = mixC(hex('#ffd23a'), hex('#f39a12'), smooth(.55, 1, th));
      c = mixC(c, hex('#ffe680'), fib * .25 * smooth(.95, .6, th));
      return mixC(c, [40, 22, 8], smooth(.9, 1.02, th));
    });
    for (const [ex, ey] of E) {
      const q = S.hit([ex * .3, ey, 0], [ex * .7, 0, 1]);
      const dir = V(k, [ex * .25, .02, 1]).normalize();
      const c = q.p.clone().addScaledVector(dir, -.075);
      eyeBall(k, o, c, dir, .2, gl, { iris, glint: .14 });
      const lid = k.mesh(k.torus(.19, .022, { rs: 10, ts: 48 }), k.gloss('#1c130d', { rough: .4 }));
      lid.position.copy(c).addScaledVector(dir, .072); face(k, lid, dir); o.add(lid);
    }
    // the hooked bill, half hidden in feathers
    const bq = S.hit([0, ST + 2.0, 0], [0, 0, 1]);
    const bill = k.mesh(k.lathe([[.075, 0], [.07, .06], [.05, .14], [.022, .2], [0, .23]], { smooth: true, seg: 20 }), k.gloss('#2c2622', { rough: .35 }));
    bill.position.copy(bq.p).addScaledVector(bq.n, -.03); bill.scale.set(1, 1, .8); aim(k, bill, V(k, [0, -.85, .6])); o.add(bill);
    // ear tufts: each a pointed horn of dark feathers edged in buff
    const tuftTex = k.tex(128, 256, (c, w, h) => {
      c.fillStyle = '#a88a64'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) {
        const x = w * (.14 + i * .18), gr = c.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#2a1c12'); gr.addColorStop(.7, '#4a3322'); gr.addColorStop(1, '#6a4d35');
        c.fillStyle = gr; c.beginPath(); c.ellipse(x, h * .55, w * .075, h * .55, 0, 0, TAU); c.fill();
        c.fillStyle = '#1c130c'; c.fillRect(x - 1.5, 0, 3, h);
      }
    }, { cache: 'birds:owl:tuft' });
    const tuftM = k.mat({ map: tuftTex, roughness: .8, sheen: .5, sheenColor: new T.Color('#e8d6b8'), side: T.DoubleSide });
    const tuftGeo = (len, wid) => lensGeo(k, len, t => wid * Math.pow(Math.sin(Math.PI * Math.min(1, t * .85 + .15)), .8) * (1 - .3 * t), { th: t => .035 * (1 - t), bend: (q, t) => -.03 * t * t, curl: q => -.1 * q * q, ns: 14, nt: 8 });
    const tuftBig = tuftGeo(.92, .17), tuftSmall = tuftGeo(.68, .115);
    for (const s of [-1, 1]) {
      const base = V(k, [s * .5, ST + 2.56, .22]);
      for (const [geo, dx, dy, dz, a, lean] of [[tuftBig, 0, 0, 0, .42, -.3], [tuftSmall, -.07, -.02, .07, .3, -.22], [tuftSmall, .07, -.03, -.04, .58, -.36]]) {
        const f = k.mesh(geo, tuftM);
        f.position.copy(base).add(V(k, [s * dx, dy, dz]));
        orient(k, f, [s * Math.sin(a), 1, lean], [s * .2, .05, 1]); o.add(f);
      }
    }
    // folded wings down the sides, barred flight feathers at the tips
    const wingTex = k.tex(256, 512, (c, w, h) => {
      const R = rng(13);
      c.fillStyle = '#654831'; c.fillRect(0, 0, w, h);
      // flight feathers (the tip, canvas top): long, barred dark and buff
      for (let i = 0; i < 7; i++) {
        const x = w * (.08 + i * .135);
        c.save(); c.beginPath(); c.ellipse(x, h * .3, w * .085, h * .42, 0, 0, TAU); c.clip();
        c.fillStyle = '#5a3f2a'; c.fillRect(0, 0, w, h);
        for (let y = 0; y < h * .75; y += 26) { c.fillStyle = '#b29470'; c.fillRect(0, y + (i % 2) * 6, w, 10); }
        c.restore();
        c.strokeStyle = 'rgba(30,20,12,.6)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, h * .3, w * .085, h * .42, 0, 0, TAU); c.stroke();
      }
      // coverts: rows of mottled feathers with pale spots
      for (let row = 0; row < 9; row++) for (let i = 0; i < 6; i++) {
        const x = (i + (row % 2) * .5) * w / 5.5, y = h * (.56 + row * .052), rw = w * .11, rh = h * .045;
        c.fillStyle = R() < .5 ? '#6f5037' : '#5c412c'; c.beginPath(); c.ellipse(x, y, rw, rh, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(206,182,142,.45)'; c.beginPath(); c.ellipse(x + rw * .3, y - rh * .2, rw * .16, rh * .22, 0, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(30,20,12,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y - rh); c.lineTo(x, y + rh); c.stroke();
      }
    }, { cache: 'birds:owl:wing' });
    const wingM = k.mat({ map: wingTex, roughness: .82, sheen: .6, sheenRoughness: .5, sheenColor: new T.Color('#eadbc0') });
    for (const s of [-1, 1]) {
      // rows from the shoulder down to the tip, each fanned round the body's axis; the leading edge stands proud
      const ray = (q, t) => {
        const y = ST + 1.98 - q * 1.62, a = mix(1.2, 2.2, q ** 1.3) + t * mix(.5, .12, q) * (q < .15 ? .6 + q / .15 * .4 : 1);
        return [[0, y, -.1], [s * Math.sin(a), .12 - q * .2, Math.cos(a)]];
      };
      const lift = (q, t) => (.035 + .09 * smooth(.9, -.7, t)) * smooth(0, .22, q) * (1 - .3 * q) + .05 * smooth(.75, 1, q);
      k.add(o, wingShell(k, S, ray, lift, { ns: 32, nt: 16 }), wingM);
    }
    // a short barred tail behind
    const tail = k.mesh(lensGeo(k, .62, t => (.2 + .08 * t) * Math.sqrt(Math.max(0, 1 - Math.max(0, (t - .85) / .15) ** 2)), { th: () => .03, bend: (q, t) => -.06 * t * t, ns: 12, nt: 8 }), wingM);
    tail.position.set(0, ST + .5, -.62); orient(k, tail, [0, -.45, -.9], [0, .9, -.45]); o.add(tail);
    // feet: feathered toes over the edge of the stump, black talons hooked down
    const toeM = k.mat({ color: '#d2bd98', roughness: .9, sheen: .8, sheenColor: new T.Color('#fff1d8') }), talonM = k.gloss('#1d1714', { rough: .3 });
    for (const s of [-1, 1]) for (const a of [-.35, 0, .35]) {
      const x0 = s * .28, z0 = .6, dx = Math.sin(a) * .9, dz = Math.cos(a);
      const tip = [x0 + dx * .3, ST + .03, z0 + dz * .3];
      k.add(o, limb(k, [[x0, ST + .12, z0 - .05], [x0 + dx * .15, ST + .07, z0 + dz * .15], tip], .085, .06, { rs: 12, seg: 16 }), toeM);
      const tc = curveOf(k, [tip, [tip[0] + dx * .08, ST + .02, tip[2] + dz * .08], [tip[0] + dx * .12, ST - .07, tip[2] + dz * .12]]);
      k.add(o, varTube(k, tc, (q, L) => .035 * (1 - q / L) + .004, { seg: 12, rs: 8 }), talonM);
    }
    g.userData.view = { el: 14, zoom: 1.08 };                               // a tall bird in a wide window: let it fill a little more
    g.userData.fullView = { el: 12, zoom: 1 };
    return g;
  },
};
