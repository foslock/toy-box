// Outer Space models: rocks. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const mixC = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
// Polynomial smooth minimum and maximum: like Math.min/max, but rounded over a blend of width w.
const smin = (a, b, w) => { const h = clamp(.5 + .5 * (b - a) / w); return mix(b, a, h) - w * h * (1 - h); };
const smax = (a, b, w) => -smin(-a, -b, w);
// A small seeded generator for painting textures, so painting never uses up the item's own random numbers.
function prng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const randDir = k => { const z = k.range(-1, 1), a = k.range(0, TAU), s = Math.sqrt(1 - z * z); return new k.THREE.Vector3(s * Math.cos(a), z, s * Math.sin(a)); };

// Compute normals, then average them across vertices that share a position, so seams don't show.
function weld(geo) {
  geo.computeVertexNormals();
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
// Move every vertex with fn(x, y, z) => [x, y, z], then rebuild smooth normals.
function warp(geo, fn) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const [x, y, z] = fn(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, x, y, z); }
  p.needsUpdate = true;
  return weld(geo);
}
const curveOf = (k, pts, closed = false) => new k.THREE.CatmullRomCurve3(pts.map(q => Array.isArray(q) ? new k.THREE.Vector3(...q) : q.clone()), closed);
// A tube along a curve whose radius changes along the way: rad(s, L) is the radius at arc length s (of L).
// o.flat squashes the cross-section along o.up (default y). o.seg, o.rs: segment counts.
function varTube(k, curve, rad, o = {}) {
  const T = k.THREE, seg = o.seg ?? 80, rs = o.rs ?? 20, L = curve.getLength();
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
  return weld(geo);
}
// Round both ends of a varTube: radius r0 along the middle, closing over the last `cap` of length at each end.
const capped = (r0, cap0, cap1 = cap0) => (s, L) => {
  let r = typeof r0 === 'function' ? r0(s, L) : r0;
  if (cap0 > 0 && s < cap0) { const q = s / cap0; r *= Math.sqrt(Math.max(0, q * (2 - q))); }
  if (cap1 > 0 && L - s < cap1) { const q = (L - s) / cap1; r *= Math.sqrt(Math.max(0, q * (2 - q))); }
  return r;
};
// Seeded smooth 3D value noise (about -1..1), and a few octaves of it.
function noise3(k) {
  const perm = new Uint8Array(512), vals = new Float32Array(256), p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(k.rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) vals[i] = k.rand() * 2 - 1;
  const f = t => t * t * (3 - 2 * t), lerp = (a, b, t) => a + (b - a) * t;
  const h = (x, y, z) => vals[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  const n = (x, y, z) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = f(x - X), v = f(y - Y), w = f(z - Z);
    return lerp(lerp(lerp(h(X, Y, Z), h(X + 1, Y, Z), u), lerp(h(X, Y + 1, Z), h(X + 1, Y + 1, Z), u), v),
      lerp(lerp(h(X, Y, Z + 1), h(X + 1, Y, Z + 1), u), lerp(h(X, Y + 1, Z + 1), h(X + 1, Y + 1, Z + 1), u), v), w);
  };
  const fbm = (x, y, z, oct = 3) => { let s = 0, a = 1, tot = 0; for (let i = 0; i < oct; i++) { s += a * n(x, y, z); tot += a; a *= .5; x *= 2.03; y *= 2.03; z *= 2.03; } return s / tot; };
  return { n, fbm };
}
// A ball made of six subdivided cube faces (n × n quads each, each face with its own 0–1 uvs), pushed about by
// fn(d) for every unit direction d: it returns the point [x, y, z] and, optionally, a colour [r, g, b] (sRGB 0–1).
// Rocks, pebbles and comet cores all start here: the faces are evenly sized, so displacement looks even everywhere.
function ballGeo(k, n, fn) {
  const T = k.THREE, pos = [], uv = [], col = [], idx = [], d = new T.Vector3(), c = new T.Color();
  let colored = false;
  for (const [a0, a1, a2] of [[0, 1, 2], [1, 2, 0], [2, 0, 1]]) for (const s of [1, -1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const q = [0, 0, 0];
      q[a0] = s; q[a1] = Math.tan((i / n * 2 - 1) * Math.PI / 4) * s; q[a2] = Math.tan((j / n * 2 - 1) * Math.PI / 4);
      d.set(q[0], q[1], q[2]).normalize();
      const r = fn(d.clone());
      pos.push(r[0], r[1], r[2]); uv.push(i / n, j / n);
      if (r.length > 3) { colored = true; c.setRGB(r[3], r[4], r[5], T.SRGBColorSpace); col.push(c.r, c.g, c.b); } else col.push(1, 1, 1);
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const p0 = base + j * (n + 1) + i; idx.push(p0, p0 + 1, p0 + n + 1, p0 + 1, p0 + n + 2, p0 + n + 1); }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  if (colored) geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return weld(geo);
}
// A rounded, boxy blob: a superellipsoid with radii r = [x, y, z] and squareness sq (2 = an ellipsoid).
const blobGeo = (k, r, sq = 2.6, n = 16) => ballGeo(k, n, d => {
  // push the unit direction out to the superellipsoid's surface
  const t = 1 / Math.pow(Math.abs(d.x) ** sq + Math.abs(d.y) ** sq + Math.abs(d.z) ** sq, 1 / sq);
  return [d.x * t * r[0], d.y * t * r[1], d.z * t * r[2]];
});
// A flat ribbon in the xy plane along a spine f(t) → [x, y] (t from 0 to 1), half as wide as hw(t) on each side.
// uv: u runs along the ribbon, v across it.
function ribbon(k, f, hw, nu = 64, nv = 10) {
  const T = k.THREE, pos = [], uv = [], idx = [];
  for (let i = 0; i <= nu; i++) {
    const t = i / nu, [x, y] = f(t), [x1, y1] = f(Math.min(1, t + 1e-3)), [x0, y0] = f(Math.max(0, t - 1e-3));
    let dx = x1 - x0, dy = y1 - y0; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = hw(t);
    for (let j = 0; j <= nv; j++) { const s = j / nv * 2 - 1; pos.push(x - dy * w * s, y + dx * w * s, 0); uv.push(t, j / nv); }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// A texture painted pixel by pixel: fn(u, v) => [r, g, b, a] in 0–1 (v = 0 at the bottom, like a mesh's uvs).
function uvTex(k, W, H, fn, o = {}) {
  return k.tex(W, H, (c, w, h) => {
    const img = c.createImageData(w, h), d = img.data;
    for (let j = 0; j < h; j++) {
      const v = 1 - (j + .5) / h;
      for (let i = 0; i < w; i++) {
        const q = fn((i + .5) / w, v), n = (j * w + i) * 4;
        d[n] = clamp(q[0]) * 255; d[n + 1] = clamp(q[1]) * 255; d[n + 2] = clamp(q[2]) * 255; d[n + 3] = clamp(q[3] ?? 1) * 255;
      }
    }
    c.putImageData(img, 0, 0);
  }, o);
}
// A fine tileable grain, for bump maps on stone.
function grainTex(k, seed, dots = 1600) {
  const R = prng(seed);
  return k.tex(256, 256, (c, w, h) => {
    c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < dots; i++) {
      const x = R() * w, y = R() * h, r = .6 + R() ** 3 * 4, v = R() < .5 ? 40 + R() * 50 : 170 + R() * 60;
      c.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},${.35 + R() * .5})`;
      for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) { c.beginPath(); c.arc(x + ox, y + oy, r, 0, TAU); c.fill(); }
    }
  }, { data: true, repeat: 2 });
}
// A soft additive glow (a sprite: it always faces the camera and doesn't count when the studio frames the model).
function halo(k, r, color, opacity = .4) {
  const T = k.THREE, tex = k.tex(128, 128, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.22, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, { cache: 'rocks-halo' });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k.color(color), transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }));
  s.scale.set(r * 2, r * 2, 1);
  return s;
}
// A four-pointed twinkle, drawn over everything.
function sparkle(k, size, rot = 0, color = '#fff4d2') {
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
  }, { cache: 'rocks-sparkle' });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k.color(color), transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending, rotation: rot }));
  s.scale.set(size, size, 1);
  s.renderOrder = 20;
  return s;
}
// Where the key light's highlight sits on a shiny ball, seen from the model's camera (a unit vector in model space).
function glintDir(k, az = 30, el = 16) {
  const T = k.THREE, a = k.deg(az), e = k.deg(el);
  const cam = new T.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
  const key = new T.Vector3(Math.sin(a - 1) * Math.cos(.87), Math.sin(.87), Math.cos(a - 1) * Math.cos(.87));
  return cam.add(key).normalize();
}
// A lathe whose v runs by distance along the profile (the kit's runs by point count), so paint on it doesn't stretch.
function latheArc(k, pts, seg = 64) {
  const geo = k.lathe(pts, { seg }), L = [0], n = pts.length;
  for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, L[i % n] / L[n - 1]);
  return geo;
}

/* ---------- space junk parts ---------- */
// A bulky white spacewalk glove, fingers up (+y), palm facing +z: blue-grey rubber on the fingertips and palm,
// a white gauntlet, and a metal wrist ring with a blue band.
function glove(k) {
  const T = k.THREE, g = k.group();
  const white = k.fabric('#f4f5f8', { sheen: '#ffffff' });
  // fingers: white fabric in puffy segments between restraint seams, and a rubber tip, all painted along each tube
  const seams = [0, .36, .6, .78, 1];
  const fingerTex = k.tex(256, 32, (c, w, h) => {
    c.fillStyle = '#f4f5f8'; c.fillRect(0, 0, w, h);
    for (const x of [.36, .6]) { c.fillStyle = 'rgba(120,132,155,.55)'; c.fillRect(x * w - 2, 0, 3, h); }
    c.fillStyle = '#7b8aa3'; c.fillRect(.78 * w, 0, w, h);
    c.fillStyle = 'rgba(80,92,112,.7)'; c.fillRect(.78 * w - 2, 0, 3, h);
  });
  const fingerMat = k.mat({ map: fingerTex, roughness: .78, sheen: .6, sheenColor: k.color('#ffffff') });
  const puffy = r0 => (s, L) => {
    const q = s / L; let i = 0; while (i < 3 && q > seams[i + 1]) i++;
    return r0 * (.95 + .07 * Math.sin(Math.PI * clamp((q - seams[i]) / (seams[i + 1] - seams[i]))));
  };
  k.add(g, blobGeo(k, [.5, .5, .23], 2.9, 16), white, { p: [0, .52, 0] });
  // [x at the knuckle, length, splay]: four fat fingers side by side, curling a little towards the palm
  for (const [x, L, sp] of [[.345, .5, .04], [.118, .6, .012], [-.118, .57, -.012], [-.345, .45, -.04]]) {
    const cv = curveOf(k, [[x, .86, -.02], [x + sp * .5, .86 + L * .5, .03], [x + sp, .86 + L, .13]]);
    k.add(g, varTube(k, cv, capped(puffy(.125), 0, .12), { seg: 28, rs: 16 }), fingerMat);
  }
  const th = curveOf(k, [[.38, .36, .08], [.6, .5, .16], [.74, .72, .22]]);
  k.add(g, varTube(k, th, capped(puffy(.135), 0, .13), { seg: 28, rs: 16 }), fingerMat);
  // rubber grip pads across the palm, with a grid of grip dots
  const grip = k.tex(128, 128, (c, w, h) => {
    c.fillStyle = '#7b8aa3'; c.fillRect(0, 0, w, h);
    for (let x = 8; x < w; x += 16) for (let y = 8; y < h; y += 16) { c.fillStyle = 'rgba(40,50,70,.45)'; c.beginPath(); c.arc(x, y, 3.5, 0, TAU); c.fill(); }
  });
  const rubber = k.mat({ map: grip, roughness: .6, clearcoat: .3, clearcoatRoughness: .45 });
  k.add(g, blobGeo(k, [.36, .13, .04], 2.6, 10), rubber, { p: [0, .72, .205] });
  k.add(g, blobGeo(k, [.28, .12, .04], 2.6, 10), rubber, { p: [.06, .4, .2] });
  // the gauntlet flaring over the wrist, edged in blue, then the metal disconnect ring
  const blueTrim = k.fabric('#2d5fd6', { weave: false });
  k.add(g, k.lathe([[.4, -.3], [.46, -.3], [.45, -.26], [.39, -.12], [.35, .02], [.34, .16]], { smooth: true, seg: 48 }), white, { s: [1, 1, .9] });
  k.add(g, k.torus(.452, .03, { rs: 10, ts: 56 }), blueTrim, { p: [0, -.29, 0], r: [Math.PI / 2, 0, 0], s: [1, .9, 1] });
  const alu = k.metal('#dfe3ea', .22), blue = k.metal('#2f6fe0', .28);
  k.add(g, k.lathe([[.3, -.56], [.38, -.56], [.405, -.54], [.405, -.46], [.39, -.45], [.39, -.41], [.405, -.4], [.405, -.32], [.385, -.3], [.3, -.3]], { seg: 48 }), alu);
  k.add(g, k.torus(.395, .024, { rs: 10, ts: 48 }), blue, { p: [0, -.43, 0], r: [Math.PI / 2, 0, 0] });
  k.add(g, k.box(.09, .07, .06, .015), k.gloss('#e0302a'), { p: [0, -.43, .41] });
  k.add(g, k.cyl(.3, .3, .26, { open: true, seg: 40 }), k.matte('#20232a', .9, { side: T.DoubleSide }), { p: [0, -.43, 0] });
  k.add(g, k.disc(.3, 40), k.matte('#15171c', .9), { p: [0, -.4, 0], r: [Math.PI / 2, 0, 0] });
  return g;
}
// A chrome combination wrench, lying along x in the xy plane: a ring at one end, open jaws at the other.
function wrench(k) {
  const T = k.THREE, g = k.group(), chrome = k.metal('#eef1f5', .12), L = 1.3;
  k.add(g, k.extrude(k.roundRect(L - .24, .13, .06), .045, { bevel: .014 }), [chrome, chrome]);
  const ring = k.circle(.16), hole = new T.Path();
  for (let i = 0; i <= 12; i++) { const a = i / 12 * TAU, r = i % 2 ? .09 : .1; i ? hole.lineTo(Math.cos(a) * r, Math.sin(a) * r) : hole.moveTo(r, 0); }
  ring.holes.push(hole);
  k.add(g, k.extrude(ring, .07, { bevel: .014 }), [chrome, chrome], { p: [-L / 2, 0, 0] });
  const R = .19, w = .072, xb = -.01, a = Math.asin(w / R), open = new T.Shape();
  open.moveTo(Math.sqrt(R * R - w * w), w); open.absarc(0, 0, R, a, TAU - a, false); open.lineTo(xb, -w);
  open.absarc(xb, 0, w, -Math.PI / 2, Math.PI / 2, true); open.closePath();
  const og = k.extrude(open, .065, { bevel: .013 }); og.rotateZ(.26);
  k.add(g, og, [chrome, chrome], { p: [L / 2, 0, 0] });
  return g;
}
// A hex bolt with its thread, head up.
function bolt(k, mat, len = .34) {
  const g = k.group(), hex = k.cyl(.1, .1, .07, { seg: 6 }).toNonIndexed();
  hex.computeVertexNormals();
  k.add(g, hex, mat, { p: [0, .035, 0] });
  k.add(g, k.cyl(.096, .096, .016, { seg: 32 }), mat, { p: [0, -.008, 0] });
  k.add(g, k.cyl(.043, .043, len, { seg: 20 }), mat, { p: [0, -len / 2, 0] });
  const pts = [], turns = len / .035;
  for (let i = 0; i <= 160; i++) { const t = i / 160, a = t * TAU * turns; pts.push([Math.cos(a) * .045, -.04 - t * (len - .06), Math.sin(a) * .045]); }
  k.add(g, k.tube(pts, .009, { seg: 320, rs: 5 }), mat);
  return g;
}
// A torn-off, bent scrap of solar panel: blue cells in a silver grid on the front, bare aluminium behind.
function panelScrap(k) {
  const T = k.THREE, g = k.group(), W = .9, H = .62;
  const edge = [[.02, .06], [.3, .02], [.55, .05], [.97, .03], [.95, .4], [.99, .62], [.86, .7], [.9, .8], [.74, .84], [.66, .97], [.52, .9], [.4, .98], [.28, .88], [.14, .94], [.05, .8], [.08, .6], [.01, .42]];
  const cut = (c, w, h) => { c.beginPath(); edge.forEach(([x, y], i) => i ? c.lineTo(x * w, (1 - y) * h) : c.moveTo(x * w, (1 - y) * h)); c.closePath(); };
  const front = k.tex(512, 360, (c, w, h) => {
    cut(c, w, h); c.clip();
    c.fillStyle = '#c9ced8'; c.fillRect(0, 0, w, h);
    const cw = w / 4, ch = h / 3;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const x = i * cw + 6, y = j * ch + 6, gr = c.createLinearGradient(x, y, x + cw, y + ch);
      gr.addColorStop(0, '#2b4fb0'); gr.addColorStop(.5, '#1a347c'); gr.addColorStop(1, '#27469e');
      c.fillStyle = gr; c.beginPath(); c.roundRect(x, y, cw - 12, ch - 12, 6); c.fill();
      c.strokeStyle = 'rgba(200,215,240,.55)'; c.lineWidth = 1.5;
      for (let l = 1; l < 6; l++) { c.beginPath(); c.moveTo(x + (cw - 12) * l / 6, y); c.lineTo(x + (cw - 12) * l / 6, y + ch - 12); c.stroke(); }
    }
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(w * .62, h * .1); c.lineTo(w * .7, h * .35); c.lineTo(w * .66, h * .5); c.lineTo(w * .8, h * .7); c.stroke();
    c.lineWidth = 6; c.strokeStyle = '#9aa1ad'; cut(c, w, h); c.stroke();
  });
  const back = k.tex(256, 180, (c, w, h) => {
    cut(c, w, h); c.clip();
    c.fillStyle = '#b9bec7'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { c.fillStyle = `rgba(255,255,255,${(y * 7) % 11 / 60})`; c.fillRect(0, y, w, 1); }
  });
  // curled, and folded back along a crease near the torn end
  const geo = warp(new T.PlaneGeometry(W, H, 36, 16), (x, y, z) => [x, y, .18 * (x + W / 2) ** 2 - .55 * Math.max(0, x - .08 + y * .15) - .1 * y * y + .1 * x * y]);
  k.add(g, geo, k.mat({ map: front, metalness: .35, roughness: .3, clearcoat: .8, clearcoatRoughness: .1, alphaTest: .5, side: T.FrontSide }));
  k.add(g, geo, k.mat({ map: back, metalness: .8, roughness: .4, alphaTest: .5, side: T.BackSide }));
  return g;
}

/* ---------- painted textures ---------- */
// The etched face of an iron meteorite: long silvery plates crossing in three directions, fine dark seams between.
function widmanTex(k) {
  const R = prng(51);
  return k.tex(512, 512, (c, w, h) => {
    c.fillStyle = '#51555c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) { c.fillStyle = R() < .5 ? `rgba(40,43,49,${.15 + R() * .25})` : `rgba(140,144,150,${.1 + R() * .2})`; c.fillRect(R() * w, R() * h, 2 + R() * 5, 2 + R() * 5); }
    // kamacite plates in three directions, 60° apart, each with a bright taenite rim and a dark seam beside it
    const dirs = [.32, .32 + Math.PI / 3, .32 + 2 * Math.PI / 3];
    for (let i = 0; i < 620; i++) {
      const a = dirs[i % 3] + (R() - .5) * .04, x = R() * w, y = R() * h, L = 40 + R() * 240, W = 3 + R() * 8;
      c.save(); c.translate(x, y); c.rotate(a);
      const v = 128 + R() * 70 | 0;
      c.fillStyle = `rgb(${v},${v + 3},${v + 8})`; c.fillRect(-L / 2, -W / 2, L, W);
      c.fillStyle = 'rgba(235,240,248,.55)'; c.fillRect(-L / 2, -W / 2, L, 1); c.fillRect(-L / 2, W / 2 - 1, L, 1);
      c.fillStyle = 'rgba(30,32,38,.4)'; c.fillRect(-L / 2, -W / 2 - 1, L, 1); c.fillRect(-L / 2, W / 2, L, 1);
      c.restore();
    }
    // troilite nodules: dark bronze inclusions
    for (const [x, y, rx, ry] of [[.6, .42, 13, 9], [.38, .62, 7, 5]]) {
      c.fillStyle = '#2c2924'; c.beginPath(); c.ellipse(x * w, y * h, rx + 3, ry + 3, .4, 0, TAU); c.fill();
      c.fillStyle = '#8a7244'; c.beginPath(); c.ellipse(x * w, y * h, rx, ry, .4, 0, TAU); c.fill();
    }
  });
}

export default {
  // A lumpy grey-brown asteroid, tumbling: craters big and small, boulders scattered over it, a few pebbles in tow.
  asteroid(k) {
    const T = k.THREE, g = k.group(), N = noise3(k);
    const ag = k.group([], { r: [.3, .5, -.45] }); g.add(ag);
    // two big craters and a middling one on the side we see, the rest anywhere
    const inv = ag.quaternion.clone().invert(), seen = (x, y, z) => new T.Vector3(x, y, z).normalize().applyQuaternion(inv);
    const craters = [{ d: seen(.28, .5, .82), r: .44 }, { d: seen(-.62, -.05, .78), r: .3 }, { d: seen(.8, -.3, .5), r: .2 }];
    for (const [n, r0, r1] of [[2, .3, .42], [8, .13, .22], [40, .04, .09]]) for (let i = 0; i < n; i++) craters.push({ d: randDir(k), r: k.range(r0, r1) });
    const A = [1.55, 1.0, 1.1], C = { hi: rgb('#a89b8c'), mid: rgb('#7f7366'), lo: rgb('#594f45'), pit: rgb('#3f3831'), rust: rgb('#8d6d52') };
    // the surface point and colour in direction d
    const shape = d => {
      let r = 1 / Math.hypot(d.x / A[0], d.y / A[1], d.z / A[2]);
      r *= 1 - .09 * Math.exp(-(((d.x - .12) / .32) ** 2));                   // a gentle waist
      const lump = N.fbm(d.x * 1.2 + 3.1, d.y * 1.2, d.z * 1.2, 3), fine = N.fbm(d.x * 4.5, d.y * 4.5 + 7, d.z * 4.5, 3);
      r *= 1 + .17 * lump + .035 * fine;
      let h = 0, floor = 0, rim = 0;
      for (const c of craters) {
        const x = d.distanceTo(c.d) / c.r;
        if (x > 1.9) continue;
        const rx = Math.min(x - 1.6, 0), small = c.r < .12;
        const s = smin(smax(x * x - 1, small ? -.42 : -.55, .25), .75 * rx * rx, .22);
        h += s * c.r * (small ? .5 : .62);
        floor = Math.max(floor, clamp(-s * 2.2) * (small ? .6 : 1)); rim = Math.max(rim, clamp(s * 7));
      }
      r *= 1 + h;
      let col = mixC(C.mid, C.hi, clamp(.4 + fine * 1.6 + lump * .8));
      col = mixC(col, C.lo, clamp(-lump * 2.5));
      col = mixC(col, C.rust, clamp(N.fbm(d.x * 2 + 9, d.y * 2, d.z * 2, 2) * 2.2) * .6);
      col = mixC(col, C.pit, floor * .75);
      col = mixC(col, C.hi, rim * .6);
      return [d.x * r, d.y * r, d.z * r, ...col];
    };
    const rock = k.mat({ vertexColors: true, roughness: .92, bumpMap: grainTex(k, 11), bumpScale: 2 });
    k.add(ag, ballGeo(k, 72, shape), rock);
    // boulders sitting on the surface, half sunk in
    const pebble = seed => ballGeo(k, 6, d => { const r = 1 + .3 * N.fbm(d.x * 2.1 + seed, d.y * 2.1, d.z * 2.1 - seed, 2); return [d.x * r, d.y * r * .8, d.z * r]; });
    const bl = [];
    for (let i = 0; i < 30; i++) {
      const d = randDir(k), [x, y, z] = shape(d), s = k.range(.035, .08) * (k.rand() < .2 ? 1.9 : 1);
      bl.push({ p: [x - d.x * s * .35, y - d.y * s * .35, z - d.z * s * .35], r: [k.rand() * 3, k.rand() * 3, k.rand() * 3], s: [s, s * k.range(.7, 1), s * k.range(.8, 1.1)], color: k.pick(['#857a6d', '#74685c', '#968b7e', '#665b50']) });
    }
    ag.add(k.instances(pebble(3), k.mat({ roughness: .9, bumpMap: grainTex(k, 12), bumpScale: 2 }), bl));
    // little rocks tumbling alongside
    for (const [x, y, z, s, seed] of [[2.05, 1.05, .1, .2, 5], [-1.95, -.45, .75, .13, 9], [1.55, -.8, 1.15, .09, 13]]) {
      k.add(g, pebble(seed), k.mat({ color: '#8f8376', roughness: .92, bumpMap: grainTex(k, 13), bumpScale: 2 }), { p: [x, y, z], r: [seed, seed * 2, seed * .5], s });
    }
    g.userData.floating = true;
    g.userData.view = { lift: -.16, zoom: .92 };
    g.userData.fullView = { lift: -.1 };
    return g;
  },

  // A little corked vial of glittering stardust (gold, blue and pink), glowing from inside, with a paper tag on a string.
  stardust(k) {
    const T = k.THREE, g = k.group(), F = 1.12;
    // the glass: a flat heavy bottom, straight sides, round shoulders, a neck with a rolled lip
    const glassGeo = k.lathe([[0, 0], [.4, 0], [.47, .02], [.5, .08], [.5, 1.32], [.49, 1.42], [.45, 1.52], [.38, 1.6], [.31, 1.65], [.288, 1.7], [.288, 1.84],
      [.31, 1.86], [.325, 1.9], [.318, 1.935], [.295, 1.952], [.262, 1.948], [.252, 1.92], [.252, 1.7]], { seg: 64 });
    k.add(g, glassGeo, k.glass('#e9f6ff', { opacity: .16, env: 2.4 }), { shadow: false }).renderOrder = 6;
    k.add(g, k.cyl(.47, .47, .07, { seg: 48 }), k.glass('#dff2ff', { opacity: .3 }), { p: [0, .045, 0], shadow: false }).renderOrder = 5;
    // the dust, settled in soft layers (gold, then pink, then blue), glowing and packed with glittering flecks
    const heapY = r => F + .085 * (1 - (r / .47) ** 2);
    const GOLD = rgb('#d4901c'), PINK = rgb('#cc3f8c'), BLUE = rgb('#3a5ed6');
    const layer = y => { const t = clamp((y - .08) / (F - .08)); return t < .55 ? mixC(GOLD, PINK, smooth(.26, .46, t)) : mixC(PINK, BLUE, smooth(.62, .82, t)); };
    const prof = [[0, .08], [.44, .08], [.465, .11], [.47, .2]];
    for (let y = .3; y < F - .05; y += .1) prof.push([.47, y]);
    prof.push([.47, F - .04], [.45, F], [.38, heapY(.38)], [.3, heapY(.3)], [.2, heapY(.2)], [.1, heapY(.1)], [0, heapY(0)]);
    const dustGeo = latheArc(k, prof, 48), dp = dustGeo.attributes.position, dn = dustGeo.attributes.normal, dc = [];
    // it glows, so it's drawn unlit; shade it by hand (darker where it turns away from the camera) so it still looks round
    const lin = new T.Color(), cam = new T.Vector3(Math.sin(k.deg(28)), .3, Math.cos(k.deg(28))).normalize(), nv = new T.Vector3();
    for (let i = 0; i < dp.count; i++) {
      const f = clamp(nv.fromBufferAttribute(dn, i).dot(cam)), q = layer(dp.getY(i)).map(x => x * (.4 + .6 * f ** .6));
      lin.setRGB(q[0], q[1], q[2], T.SRGBColorSpace); dc.push(lin.r, lin.g, lin.b);
    }
    dustGeo.setAttribute('color', new T.Float32BufferAttribute(dc, 3));
    const dustTex = k.tex(512, 256, (c, w, h) => {
      c.fillStyle = '#9a9a9a'; c.fillRect(0, 0, w, h);
      const R = prng(31);
      for (let i = 0; i < 5200; i++) { c.fillStyle = R() < .55 ? `rgba(255,255,255,${.5 + R() * .5})` : `rgba(40,30,60,${.2 + R() * .35})`; c.beginPath(); c.arc(R() * w, R() * h, .5 + R() * 1.3, 0, TAU); c.fill(); }
    });
    k.add(g, dustGeo, new T.MeshBasicMaterial({ map: dustTex, vertexColors: true }));
    // glitter: each fleck mostly the colour of its layer, some strays from the others, and a few pure white
    const oct = new T.OctahedronGeometry(1, 0), lists = [[], [], [], []];
    const pickCol = y => {
      if (k.rand() < .08) return 3;
      if (k.rand() < .16) return Math.floor(k.rand() * 3);
      const t = clamp((y - .08) / (F - .08)) + k.range(-.1, .1);
      return t < .36 ? 0 : t < .72 ? 2 : 1;
    };
    for (let i = 0; i < 1500; i++) {
      const a = k.range(0, TAU);
      let r, y;
      if (k.rand() < .75) { r = Math.sqrt(k.range(.36 ** 2, .458 ** 2)); y = k.range(.1, F - .02); }
      else { r = Math.sqrt(k.rand()) * .45; y = heapY(r) + k.range(-.015, .012); }
      lists[pickCol(y)].push({ p: [Math.sin(a) * r, y, Math.cos(a) * r], r: [k.rand() * 3, k.rand() * 3, k.rand() * 3], s: k.range(.012, .026) });
    }
    for (let i = 0; i < 70; i++) {   // a few flecks still drifting above the heap
      const y = F + .1 + k.rand() ** 1.6 * .55, rMax = y < 1.35 ? .44 : .44 - (y - 1.35) * .9, a = k.range(0, TAU), r = Math.sqrt(k.rand()) * rMax;
      lists[Math.floor(k.rand() * 4)].push({ p: [Math.sin(a) * r, y, Math.cos(a) * r], r: [k.rand() * 3, k.rand() * 3, k.rand() * 3], s: k.range(.008, .02) });
    }
    [['#ffd35a', 2.2], ['#6cc8ff', 2.2], ['#ff7fd0', 2.2], ['#ffffff', 1.8]].forEach(([c, e], i) => g.add(k.instances(oct, k.glow(c, e), lists[i])));
    for (const [y, r, c, o] of [[.3, .8, '#ffb347', .3], [.72, .8, '#ff5fb8', .26], [1.05, .8, '#6a8cff', .3]]) { const h = halo(k, r, c, o); h.position.set(0, y, .1); g.add(h); }
    // the cork, pushed into the neck
    const corkTex = k.tex(256, 128, (c, w, h) => {
      c.fillStyle = '#c99c63'; c.fillRect(0, 0, w, h);
      const R = prng(8);
      for (let i = 0; i < 700; i++) { c.fillStyle = R() < .6 ? `rgba(110,70,30,${.2 + R() * .4})` : `rgba(240,210,160,${.3 + R() * .4})`; c.beginPath(); c.ellipse(R() * w, R() * h, .8 + R() * 2.4, .6 + R() * 1.6, R() * 3, 0, TAU); c.fill(); }
    }, { repeat: [2, 1] });
    k.add(g, k.lathe([[0, 1.68], [.246, 1.68], [.252, 1.8], [.262, 1.95], [.272, 2.08], [.28, 2.15], [.272, 2.19], [.25, 2.21], [0, 2.215]], { seg: 48 }), k.mat({ map: corkTex, roughness: .88 }));
    // twine round the neck, knotted, running down to a paper tag
    const twine = k.mat({ color: '#d9c49a', roughness: .9, sheen: .5, sheenColor: k.color('#fff3d0') });
    k.add(g, k.torus(.297, .016, { rs: 8, ts: 64 }), twine, { p: [0, 1.755, 0], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.torus(.297, .016, { rs: 8, ts: 64 }), twine, { p: [0, 1.79, 0], r: [Math.PI / 2 + .05, 0, 0] });
    const ka = .95, knot = [Math.sin(ka) * .31, 1.775, Math.cos(ka) * .31];
    k.add(g, k.sphere(.036, { w: 12, h: 8 }), twine, { p: knot, s: [1, .85, .85] });
    const TW = .62, TH = .34, tag = k.group([], { p: [.756, 1.338, .288], r: [0, .52, -.35] }); g.add(tag);
    tag.updateMatrix();
    const hole = new T.Vector3(-TW / 2 + .07, 0, 0).applyMatrix4(tag.matrix);
    for (const o of [-.012, .012]) {
      const sh = [Math.sin(ka + o * 2) * .47, 1.56, Math.cos(ka + o * 2) * .47];
      k.add(g, k.tube([knot, [(knot[0] + sh[0]) / 2 + .02, 1.7, (knot[2] + sh[2]) / 2 + .02], sh, [hole.x - .02 + o, hole.y + .08, hole.z + o], [hole.x + o, hole.y, hole.z]], .01, { rs: 6, seg: 40 }), twine);
    }
    const shp = k.shape([[-TW / 2 + .09, TH / 2], [TW / 2, TH / 2], [TW / 2, -TH / 2], [-TW / 2 + .09, -TH / 2], [-TW / 2, -TH / 2 + .09], [-TW / 2, TH / 2 - .09]]);
    const hp = new T.Path(); hp.absarc(-TW / 2 + .07, 0, .026, 0, TAU, true); shp.holes.push(hp);
    const tagTex = k.tex(512, 280, (c, w, h) => {
      c.fillStyle = '#f6eed8'; c.fillRect(0, 0, w, h);
      const R = prng(4);
      for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(150,120,70,${R() * .08})`; c.fillRect(R() * w, R() * h, 1 + R() * 3, 1); }
      c.strokeStyle = '#d7a93e'; c.lineWidth = 4; c.setLineDash([10, 7]); c.beginPath(); c.roundRect(96, 16, w - 112, h - 32, 10); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#e7dcbc'; c.beginPath(); c.arc(.07 / TW * w, h / 2, 34, 0, TAU); c.fill();
      k.text(c, 'Stardust', 300, 124, { size: 92, weight: 700, color: '#26337a' });
      k.text(c, 'older than the Sun', 300, 206, { size: 38, weight: 700, color: '#8a6a32', font: 'Nunito, sans-serif' });
      c.fillStyle = '#f0b429'; c.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 9 : 22; c.lineTo(478 + Math.cos(a) * r, 70 + Math.sin(a) * r); }
      c.fill();
    });
    tagTex.repeat.set(1 / TW, 1 / TH); tagTex.offset.set(.5, .5);
    k.add(tag, k.extrude(shp, .008, { bevel: .003, bevelSeg: 1 }), [k.mat({ map: tagTex, roughness: .85 }), k.paper('#efe3c4')]);
    // glitter catching the light
    for (const [x, y, z, s, rot] of [[-.3, .98, .42, .5, .2], [.3, .42, .42, .34, .6], [.05, 1.28, .5, .26, 0], [-.78, 1.6, .2, .3, .1], [.5, 2.12, .1, .28, .5]]) {
      const sp = sparkle(k, s, rot); sp.position.set(x, y, z); g.add(sp);
    }
    // and tiny twinkles all over the dust, each in its layer's colour
    for (const [a, y, s, c] of [[.1, .2, .14, '#ffe08a'], [.75, .33, .12, '#ffe08a'], [-.2, .55, .13, '#ffb0e4'], [.55, .68, .15, '#ffb0e4'], [.2, .86, .12, '#b8dcff'], [-.35, 1.0, .13, '#b8dcff'], [.8, .95, .11, '#ffffff']]) {
      const sp = sparkle(k, s, a * 3, c); sp.position.set(Math.sin(k.deg(28) + a) * .48, y, Math.cos(k.deg(28) + a) * .48); g.add(sp);
    }
    g.userData.view = { az: 28, el: 16 };
    return g;
  },

  // A lost spacewalk glove tumbling through space, with a stray wrench, two bolts and a bent scrap of solar panel.
  spacejunk(k) {
    const g = k.group();
    const gl = glove(k); gl.position.set(0, .55, 0); gl.rotation.set(-.3, .55, .62); g.add(gl);
    const wr = wrench(k); wr.position.set(1.15, 1.55, -.25); wr.rotation.set(.7, .4, -.75); g.add(wr);
    const steel = k.metal('#c3c8d0', .3), brass = k.metal('#d7ae5a', .25);
    const b1 = bolt(k, steel, .3); b1.position.set(-1.15, 1.62, .2); b1.rotation.set(.8, .3, .9); g.add(b1);
    const b2 = bolt(k, brass, .26); b2.position.set(1.02, .12, .65); b2.rotation.set(-.6, 0, 1.9); g.add(b2);
    const ps = panelScrap(k); ps.position.set(-.95, .05, .4); ps.rotation.set(.12, .5, .38); g.add(ps);
    g.userData.floating = true;
    return g;
  },

  // A dark iron meteorite with thumbprint dimples and a sawn, polished end showing its crossing crystal plates, on a walnut stand.
  meteorite(k) {
    const T = k.THREE, g = k.group(), N = noise3(k);
    const cells = [];
    for (let i = 0; i < 72; i++) cells.push({ d: randDir(k), r: k.range(.2, .34), dep: k.range(.7, 1) });
    const A = [1.3, .78, .92], n = new T.Vector3(.74, .3, .6).normalize();
    const C = { crust: rgb('#292725'), rust: rgb('#4c3526'), ridge: rgb('#65625e'), deep: rgb('#1a1817') };
    const raw = d => {
      let r = 1 / Math.hypot(d.x / A[0], d.y / A[1], d.z / A[2]);
      const lump = N.fbm(d.x * 1.3 + 2, d.y * 1.3, d.z * 1.3 + 5, 3);
      r *= 1 + .12 * lump;
      // regmaglypts: overlapping shallow bowls, with sharp ridges where they meet
      let q = 9, dep = 1;
      for (const c of cells) { const v = d.distanceToSquared(c.d) / (c.r * c.r); if (v < q) { q = v; dep = c.dep; } }
      const bowl = 1 - Math.min(1, q);
      r *= 1 - .075 * dep * bowl;
      return { p: d.clone().multiplyScalar(r), bowl, lump };
    };
    // where to saw: a little way in from the end that faces the camera
    let far = 0;
    for (let i = 0; i < 800; i++) { const z = 1 - 2 * (i + .5) / 800, a = i * 2.39996, s = Math.sqrt(1 - z * z); far = Math.max(far, raw(new T.Vector3(s * Math.cos(a), z, s * Math.sin(a))).p.dot(n)); }
    const cut = far * .7;
    const geo = ballGeo(k, 64, d => {
      const { p, bowl, lump } = raw(d);
      const s = p.dot(n) - cut;
      if (s > 0) p.addScaledVector(n, -s);
      let col = mixC(C.crust, C.rust, clamp(N.fbm(d.x * 2.4, d.y * 2.4 + 3, d.z * 2.4, 2) * 2 + .1) * .5);
      col = mixC(col, C.deep, bowl * .6);
      col = mixC(col, C.ridge, clamp(1 - bowl * 6) * .55 + clamp(lump * 2) * .15);
      return [p.x, p.y, p.z, ...col];
    });
    const rockG = k.group(); g.add(rockG);
    k.add(rockG, geo, k.mat({ vertexColors: true, metalness: .55, roughness: .55, clearcoat: .4, clearcoatRoughness: .35, bumpMap: grainTex(k, 31, 2400), bumpScale: 1.2 }));
    // the polished face: trace the outline of the flattened part and lay the etched plate over it
    const e1 = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), n).normalize(), e2 = new T.Vector3().crossVectors(n, e1), O = n.clone().multiplyScalar(cut);
    const bins = new Array(180).fill(0), P = geo.attributes.position, v = new T.Vector3();
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      if (Math.abs(v.dot(n) - cut) > 1e-5) continue;
      v.sub(O);
      const x = v.dot(e1), y = v.dot(e2), b = Math.floor(((Math.atan2(y, x) / TAU) + 1) % 1 * 180);
      bins[b] = Math.max(bins[b], Math.hypot(x, y));
    }
    for (let i = 0; i < 180; i++) if (!bins[i]) { let a = i, b = i; while (!bins[(a + 179) % 180]) a--; while (!bins[(b + 1) % 180]) b++; bins[i] = (bins[(a + 179) % 180] + bins[(b + 1) % 180]) / 2; }
    const rad = bins.map((_, i) => (bins[(i + 179) % 180] + 2 * bins[i] + bins[(i + 1) % 180]) / 4 * .985);
    const face = new T.Shape(); let rMax = 0;
    rad.forEach((r, i) => { const a = (i + .5) / 180 * TAU; rMax = Math.max(rMax, r); i ? face.lineTo(Math.cos(a) * r, Math.sin(a) * r) : face.moveTo(Math.cos(a) * r, Math.sin(a) * r); });
    const wt = widmanTex(k); wt.repeat.set(1 / (2 * rMax), 1 / (2 * rMax)); wt.offset.set(.5, .5);
    const fm = k.mesh(new T.ShapeGeometry(face, 4), k.mat({ map: wt, metalness: 1, roughness: .24, clearcoat: .5, clearcoatRoughness: .08 }));
    fm.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(e1, e2, n)); fm.position.copy(O).addScaledVector(n, .003);
    rockG.add(fm);
    // the walnut stand: an oval base, a cradle on top, a brass plaque in front
    const walnut = k.wood('walnut', { varnish: .7, rough: .45 });
    const oval = (rx, ry) => { const s = new T.Shape(); s.absellipse(0, 0, rx, ry, 0, TAU, false); return s; };
    const base = k.extrude(oval(1.3, .85), .18, { bevel: .05, bevelSeg: 4 }); base.rotateX(-Math.PI / 2);
    k.add(g, base, [walnut, walnut], { p: [0, .14, 0] });
    const cradle = k.extrude(oval(.7, .46), .14, { bevel: .04, bevelSeg: 3 }); cradle.rotateX(-Math.PI / 2);
    k.add(g, cradle, [walnut, walnut], { p: [-.05, .39, -.05] });
    geo.computeBoundingBox();
    rockG.position.set(.05, .56 - geo.boundingBox.min.y - .1, -.05);
    const plaque = k.group([], { p: [.05, .35, .64], r: [-1.05, 0, 0] }); g.add(plaque);
    k.add(plaque, k.box(.86, .22, .025, .008), k.metal('#d8b25c', .22));
    plaque.add(k.decal(.8, .18, (c, w, h) => {
      c.strokeStyle = '#5a4012'; c.lineWidth = 3; c.strokeRect(4, 4, w - 8, h - 8);
      k.text(c, 'IRON METEORITE', w / 2, h * .4, { size: h * .38, weight: 700, color: '#2a1c05' });
      k.text(c, 'OCTAHEDRITE · 22 LB', w / 2, h * .77, { size: h * .2, weight: 800, color: '#3d2a08', font: 'Nunito, sans-serif' });
    }, { p: [0, 0, .014], px: 512 }));
    g.userData.view = { az: 30, el: 20, rim: 3 };
    return g;
  },

  // A grey-white lunar basalt full of little gas holes, dotted with glassy beads, under a glass dome on a walnut plinth.
  moonrock(k) {
    const T = k.THREE, g = k.group(), N = noise3(k);
    const planes = [];
    for (let i = 0; i < 7; i++) { const d = randDir(k); d.y = Math.max(d.y, -.2); planes.push({ n: d.normalize(), o: k.range(.6, .74) }); }
    const pits = [];
    for (let i = 0; i < 150; i++) pits.push({ d: randDir(k), r: k.range(.022, .058) });
    const A = [1.02, .72, .86], C = { base: rgb('#a9a6a0'), dark: rgb('#7a7772'), pit: rgb('#4b4845'), light: rgb('#cfccc6') };
    const shape = d => {
      let r = 1 / Math.hypot(d.x / A[0], d.y / A[1], d.z / A[2]);
      const lump = N.fbm(d.x * 1.6, d.y * 1.6 + 4, d.z * 1.6, 3);
      r *= 1 + .1 * lump;
      const p = d.clone().multiplyScalar(r);
      for (const pl of planes) { const s = p.dot(pl.n); p.addScaledVector(pl.n, smin(s, pl.o, .08) - s); }   // broken faces
      if (p.y < -.5) p.y = smax(p.y, -.52, .06);
      let hole = 0;
      for (const c of pits) { const x = d.distanceTo(c.d) / c.r; if (x < 1) hole = Math.max(hole, Math.sqrt(1 - x * x)); }
      p.multiplyScalar(1 - .07 * hole);
      let col = mixC(C.base, C.dark, clamp(-lump * 2.2 + .2));
      col = mixC(col, C.light, clamp(N.fbm(d.x * 5, d.y * 5, d.z * 5 + 3, 2) * 2));
      col = mixC(col, C.pit, clamp(hole * 1.3));
      return [p.x, p.y, p.z, ...col];
    };
    const speck = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#d2d2d2'; c.fillRect(0, 0, w, h);
      const R = prng(77);
      for (let i = 0; i < 3000; i++) { const s = .7 + R() * 2; c.fillStyle = R() < .5 ? `rgba(30,29,28,${.3 + R() * .5})` : 'rgba(255,255,255,.95)'; c.fillRect(R() * w, R() * h, s, s); }
    }, { repeat: 2 });
    // as big as the dome allows, sitting on the cushion
    const rockGeo = ballGeo(k, 56, shape), rp = rockGeo.attributes.position, yaw = -.3;
    let reach = 0, low = 0;
    for (let i = 0; i < rp.count; i++) { reach = Math.max(reach, Math.hypot(rp.getX(i), rp.getZ(i))); low = Math.min(low, rp.getY(i)); }
    const rs = Math.min(1.3, 1.16 / reach);
    const rockG = k.group([], { p: [0, .6 - low * rs, 0], r: [0, yaw, 0], s: rs }); g.add(rockG);
    k.add(rockG, rockGeo, k.mat({ vertexColors: true, map: speck, roughness: .86, bumpMap: grainTex(k, 21), bumpScale: 2.5 }));
    // glassy beads: orange, amber and black glass spheres stuck to the rock and scattered on the cushion
    const G = glintDir(k, 30, 16), beads = { orange: [], amber: [], black: [] }, glints = [];
    const addBead = (P, r, kind) => { beads[kind].push({ p: P.toArray(), s: r }); glints.push({ p: P.clone().addScaledVector(G, r * .8).toArray(), s: r * .34 }); };
    rockG.updateMatrix();
    for (let i = 0; i < 7; i++) {
      const d = new T.Vector3(k.range(-.6, 1), k.range(-.1, 1), k.range(.2, 1)).normalize().applyAxisAngle(new T.Vector3(0, 1, 0), .3);
      const [x, y, z] = shape(d), r = k.range(.03, .05);
      addBead(new T.Vector3(x, y, z).addScaledVector(d, -r * .3).applyMatrix4(rockG.matrix), r, k.pick(['orange', 'orange', 'amber', 'black']));
    }
    for (const [a, rr] of [[.4, 1.05], [.9, 1.12], [1.4, .98], [-.5, 1.08], [2.4, 1.1], [-1.2, 1.0]]) addBead(new T.Vector3(Math.sin(a) * rr, .62, Math.cos(a) * rr), k.range(.03, .042), k.pick(['orange', 'amber', 'black']));
    const bead = k.sphere(1, { w: 20, h: 14 });
    const glassy = (c, e, ei) => k.mat({ color: c, roughness: .03, clearcoat: 1, clearcoatRoughness: 0, emissive: k.color(e), emissiveIntensity: ei, iridescence: .5, iridescenceIOR: 1.5, specularIntensity: 1 });
    g.add(k.instances(bead, glassy('#ff8a2e', '#ff4a00', .3), beads.orange));
    g.add(k.instances(bead, glassy('#f0bb4a', '#c07000', .22), beads.amber));
    g.add(k.instances(bead, k.mat({ color: '#15181c', roughness: .04, metalness: .3, clearcoat: 1, clearcoatRoughness: 0 }), beads.black));
    const gl = k.instances(k.sphere(1, { w: 8, h: 6 }), k.glow('#ffffff', 1.6), glints); gl.castShadow = false; g.add(gl);
    // the plinth: turned walnut, a velvet cushion, a brass seat for the dome
    const walnut = k.wood('walnut', { varnish: .8, rough: .4 });
    k.add(g, k.lathe([[0, 0], [1.62, 0], [1.66, .03], [1.66, .09], [1.62, .12], [1.6, .14], [1.6, .4], [1.63, .42], [1.63, .47], [1.58, .5], [0, .5]], { seg: 72 }), walnut);
    const brass = k.metal('#d8b25c', .22);
    k.add(g, k.torus(1.33, .045, { rs: 12, ts: 96 }), brass, { p: [0, .52, 0], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.lathe([[0, .5], [1.24, .5], [1.27, .53], [1.23, .58], [1.08, .61], [.6, .63], [0, .635]], { smooth: true, seg: 64 }), k.fabric('#1c2a55', { sheen: '#6a86d8' }));
    // the numbered plaque on the front of the plinth
    const lab = k.painted(512, 120, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f0d27c'); gr.addColorStop(.5, '#c99b3e'); gr.addColorStop(1, '#e8c56a');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#8a6420'; c.lineWidth = 4; c.strokeRect(6, 6, w - 12, h - 12);
      k.text(c, 'LUNAR SAMPLE', w / 2, h * .38, { size: 40, weight: 700, color: '#3e2a08' });
      k.text(c, 'No. 70417  ·  BASALT', w / 2, h * .74, { size: 26, weight: 800, color: '#5a3f10', font: 'Nunito, sans-serif' });
    }, { metal: .7, rough: .3 });
    const la = .62;
    k.add(g, k.cyl(1.607, 1.607, .22, { open: true, start: -la / 2, len: la, seg: 24 }), lab, { p: [0, .27, 0], r: [0, k.deg(26), 0], shadow: false });
    // the glass dome, with a knob on top
    const DR = 1.3, DW = 1.62, dome = [[DR, .5], [DR, DW]];
    for (let i = 1; i <= 16; i++) { const a = i / 16 * Math.PI / 2; dome.push([DR * Math.cos(a), DW + DR * Math.sin(a)]); }
    const glass = k.glass('#eef8ff', { opacity: .08, env: 2.6 });
    k.add(g, k.lathe(dome, { seg: 72 }), glass, { shadow: false }).renderOrder = 8;
    k.add(g, k.sphere(.14, { w: 24, h: 16 }), k.glass('#eef8ff', { opacity: .35, env: 2.4 }), { p: [0, DW + DR + .19, 0], shadow: false }).renderOrder = 9;
    k.add(g, k.cyl(.06, .09, .1, { seg: 20 }), k.glass('#eef8ff', { opacity: .35 }), { p: [0, DW + DR + .07, 0], shadow: false }).renderOrder = 9;
    for (const [x, y, z, s, rot] of [[.42, 1.62, .9, .34, .3], [-.35, 1.2, 1.05, .24, 0], [.72, .8, 1.1, .22, .6]]) { const sp = sparkle(k, s, rot); sp.position.set(x, y, z); g.add(sp); }
    g.userData.view = { az: 30, el: 18 };
    return g;
  },

  // A comet streaking by: a dark icy core spitting bright jets, a glowing coma, a broad curved dust tail and a straight blue ion tail.
  // Built flat, face-on to a level camera: the head on the right, the tails streaming away up to the left.
  comet(k) {
    const T = k.THREE, g = k.group(), N = noise3(k), deg = k.deg;
    const add = (geo, mat, ro) => { const m = k.mesh(geo, mat, { shadow: false }); m.receiveShadow = false; m.renderOrder = ro; g.add(m); return m; };
    const glowMat = (map, opacity = 1) => new T.MeshBasicMaterial({ map, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
    const polar = (r, a) => new T.Vector2(r * Math.cos(deg(a)), r * Math.sin(deg(a)));
    // the dust tail: broad and bright, curving away below the ion tail, white fading to warm yellow, with faint streaks
    const dc = new T.QuadraticBezierCurve(new T.Vector2(0, 0), polar(2.5, 146), polar(4.6, 166));
    const dustW = t => .24 + 1.35 * t ** .75;
    const dustTex = uvTex(k, 512, 128, (u, v) => {
      const s = v * 2 - 1, along = smooth(0, .035, u) * (1 - smooth(.3, 1, u)) ** 1.1;
      const across = Math.exp(-(s * s) / (s > 0 ? .42 : .8) * 1.5);
      const streak = .7 + .3 * (.5 + .5 * Math.sin(s * 22 + u * 6 + Math.sin(u * 11) * .9));
      const c = mixC([1, .99, .95], [1, .8, .45], clamp(Math.abs(s) * .8 + u * .6));
      return [c[0], c[1], c[2], along * across * streak];
    });
    add(ribbon(k, t => dc.getPointAt(t).toArray(), dustW, 90, 14), glowMat(dustTex, 1), 3);
    add(ribbon(k, t => dc.getPointAt(t).toArray(), t => dustW(t) * .45, 90, 10), glowMat(dustTex, .55), 4);
    // the ion tail: straight and narrow, electric blue, drawn out into fine streamers
    const R = prng(19), streamers = [];
    for (let i = 0; i < 8; i++) streamers.push([(R() - .5) * 1.5, .04 + R() * .06, .3 + R() * .4, R() * 9]);
    const ionTex = uvTex(k, 512, 128, (u, v) => {
      const s = v * 2 - 1, along = smooth(0, .03, u) * (1 - smooth(.42, 1, u)) ** .8;
      let a = .75 * Math.exp(-s * s / .05);
      for (const [c0, w, b, ph] of streamers) a += b * Math.exp(-((s - c0) ** 2) / (w * w)) * (.55 + .45 * Math.sin(u * 8 + ph));
      const c = mixC([.78, .92, 1], [.2, .45, 1], clamp(Math.abs(s) * 1.3 + u * .5));
      return [c[0], c[1], c[2], clamp(a) * along];
    });
    const iEnd = polar(5.4, 143);
    add(ribbon(k, t => [iEnd.x * t, iEnd.y * t], t => .06 + .34 * t, 60, 18), glowMat(ionTex, 1), 2);
    // the coma: a soft teal-white glow round the head
    const comaTex = uvTex(k, 256, 256, (u, v) => {
      const x = (u - .5) * 2, y = (v - .5) * 2, r2 = x * x + y * y;
      const a = Math.exp(-r2 * 6) + Math.exp(-r2 * 1.8) * .45;
      const c = mixC([1, 1, 1], [.4, .95, .85], clamp(Math.sqrt(r2) * 1.5));
      return [c[0], c[1], c[2], clamp(a) * smooth(1, .8, Math.sqrt(r2))];
    });
    add(k.plane(2.5, 2.5), glowMat(comaTex, 1), 5).position.set(-.12, .05, 0);
    // the nucleus: a dark, icy lump
    const core = ballGeo(k, 12, d => {
      const r = .23 * (1 + .25 * N.fbm(d.x * 2 + 1, d.y * 2, d.z * 2, 3)) * (1 + .3 * Math.abs(d.x));
      const ice = clamp(N.fbm(d.x * 3, d.y * 3 + 5, d.z * 3, 2) * 3);
      return [d.x * r, d.y * r * .8, d.z * r, ...mixC(rgb('#30353d'), rgb('#e4f0ff'), ice)];
    });
    g.add(k.mesh(core, k.mat({ vertexColors: true, roughness: .65 }), { r: [.4, .6, .3], shadow: false }));
    // jets of gas bursting out of the sunward side, bending back into the coma
    const jetTex = uvTex(k, 128, 64, (u, v) => { const s = v * 2 - 1, a = Math.exp(-s * s * 5) * (1 - u) ** 1.1 * smooth(0, .06, u); return [.88, .98, 1, a]; });
    for (const [a0, bend, len] of [[-18, 60, .75], [22, 70, .6], [-58, 40, .55], [58, 50, .42]]) {
      const P0 = polar(.17, a0), P1 = P0.clone().add(polar(len * .6, a0)), P2 = P1.clone().add(polar(len * .5, a0 + bend * Math.sign(a0 || 1)));
      const jc = new T.QuadraticBezierCurve(P0, P1, P2);
      add(ribbon(k, t => jc.getPointAt(t).toArray(), t => .04 + .1 * t, 24, 6), glowMat(jetTex, 1), 6);
    }
    // specks of dust glittering down the tail
    const specks = [];
    for (let i = 0; i < 110; i++) {
      const t = .05 + k.rand() ** .8 * .8, P = dc.getPointAt(t), D = dc.getTangentAt(t), w = dustW(t) * (k.rand() * 2 - 1) * .75;
      specks.push({ p: [P.x - D.y * w, P.y + D.x * w, k.range(-.05, .05)], s: k.range(.01, .026) * (1 - t * .5) });
    }
    const sm = k.instances(k.sphere(1, { w: 8, h: 6 }), new T.MeshBasicMaterial({ color: k.color('#fff4d0'), transparent: true, opacity: .95, depthWrite: false, blending: T.AdditiveBlending }), specks);
    sm.castShadow = sm.receiveShadow = false; sm.renderOrder = 7; g.add(sm);
    for (const [r, c, o] of [[.42, '#ffffff', .55], [1.15, '#a8f6ff', .5], [2.3, '#4fd6c4', .26]]) { const h = halo(k, r, c, o); h.position.set(-.1, .05, .1); g.add(h); }
    for (const [x, y, s, rot] of [[-.02, .02, 1.0, .3], [-2.1, 1.55, .32, 0], [-3.3, 1.45, .24, .5], [-1.3, 1.3, .2, .2]]) { const sp = sparkle(k, s, rot, '#e8fbff'); sp.position.set(x, y, .2); g.add(sp); }
    g.userData.floating = true;
    g.userData.noHero = true;
    g.userData.view = { az: 0, el: 0, lift: -.3, zoom: 1 };
    g.userData.fullView = { az: 0, el: 0, lift: -.3, zoom: 1.15 };
    return g;
  },
};
