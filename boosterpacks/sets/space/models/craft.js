// Outer Space models: craft. The Space Shuttle, the Lunar Lander, a Flying Saucer, the Moon Buggy and a Mars Rover.
// Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const clamp01 = x => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Give vertices that share a position one shared normal, so seams on lathes and lofts don't show.
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

// Monotone cubic through [[x, y], ...] (x increasing): a smooth profile that never overshoots its points.
function curve1(pts) {
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// A skin over a grid of (nu + 1) × (nv + 1) samples: f(i, j) => { p: [x, y, z], uv: [u, v] }.
// Faces are turned to point away from o.inside (default: the middle of the bounding box).
function surf(k, nu, nv, f, o = {}) {
  const T = k.THREE, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const r = f(i, j); pos.push(r.p[0], r.p[1], r.p[2]); uv.push(r.uv[0], r.uv[1]); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingBox();
  const inside = o.inside ? new T.Vector3(...o.inside) : geo.boundingBox.getCenter(new T.Vector3());
  const P = geo.attributes.position, N = geo.attributes.normal, a = new T.Vector3(), n = new T.Vector3();
  let score = 0;
  for (let i = 0; i < P.count; i += 3) { a.fromBufferAttribute(P, i).sub(inside); n.fromBufferAttribute(N, i); score += Math.sign(a.dot(n)); }
  if (score < 0) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    geo.setIndex(idx); geo.computeVertexNormals();
  }
  return o.weld === false ? geo : weld(geo);
}

// A flat-faceted solid: verts [[x, y, z], ...] and faces (lists of vertex indices). Each face gets a flat normal
// (turned outward from the solid's middle), planar UVs (o.scale units per texture repeat) and a material slot (o.mat[f]).
function facets(k, verts, faces, o = {}) {
  const T = k.THREE, V = verts.map(v => new T.Vector3(...v)), ctr = new T.Vector3();
  V.forEach(v => ctr.add(v)); ctr.divideScalar(V.length);
  const byMat = new Map();
  faces.forEach((f, fi) => { const m = o.mat ? o.mat[fi] ?? 0 : 0; if (!byMat.has(m)) byMat.set(m, []); byMat.get(m).push(f); });
  const pos = [], nor = [], uv = [], geo = new T.BufferGeometry(), sc = o.scale ?? 1;
  let start = 0;
  for (const [m, list] of [...byMat].sort((a, b) => a[0] - b[0])) {
    let count = 0;
    for (let f of list) {
      const n = new T.Vector3(), c = new T.Vector3();
      for (let i = 0; i < f.length; i++) { const p = V[f[i]], q = V[f[(i + 1) % f.length]]; n.x += (p.y - q.y) * (p.z + q.z); n.y += (p.z - q.z) * (p.x + q.x); n.z += (p.x - q.x) * (p.y + q.y); c.add(p); }
      n.normalize(); c.divideScalar(f.length);
      if (n.dot(c.clone().sub(ctr)) < 0) { f = [...f].reverse(); n.negate(); }
      const t = Math.abs(n.y) > .92 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0).cross(n).normalize(), b = n.clone().cross(t);
      for (let i = 1; i < f.length - 1; i++) for (const vi of [f[0], f[i], f[i + 1]]) {
        const p = V[vi]; pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(p.dot(t) / sc, p.dot(b) / sc); count++;
      }
    }
    geo.addGroup(start, count, m); start += count;
  }
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  return geo;
}
// Rings of points stacked into a faceted solid (every ring the same length), capped at both ends.
function loft(k, rings, o = {}) {
  const verts = rings.flat(), n = rings[0].length, faces = [], mat = [];
  for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < n; i++) {
    const a = r * n + i, b = r * n + (i + 1) % n; faces.push([a, b, b + n, a + n]); mat.push(o.sideMat ? o.sideMat(r, i) : 0);
  }
  faces.push([...Array(n).keys()]); mat.push(o.capMat ?? 0);
  faces.push([...Array(n).keys()].map(i => (rings.length - 1) * n + i)); mat.push(o.capMat ?? 0);
  return facets(k, verts, faces, { mat, scale: o.scale });
}

// Turn obj so its local +y runs along d.
const aim = (k, obj, d) => { obj.quaternion.setFromUnitVectors(new k.THREE.Vector3(0, 1, 0), new k.THREE.Vector3(...d).normalize()); return obj; };
// A round rod from a to b.
function rod(k, a, b, r, mat, seg = 12) {
  const T = k.THREE, A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A);
  const m = k.mesh(k.cyl(r, r, d.length(), { seg }), mat);
  m.position.copy(A).addScaledVector(d, .5);
  return aim(k, m, d.toArray());
}
// Instance placement for a unit cylinder (radius 1, height 1) stretched from a to b with radius r.
function span(k, a, b, r) {
  const T = k.THREE, A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const e = new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()));
  return { p: A.add(B).multiplyScalar(.5).toArray(), r: [e.x, e.y, e.z], s: [r, L, r] };
}
// A soft additive glow around a light (a sprite: drawn over what's behind it, never framed or shadowed).
function halo(k, r, color, opacity = .35) {
  const T = k.THREE, tex = k.tex(128, 128, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.22, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, { cache: 'craft-halo' });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k.color(color), transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }));
  s.scale.set(r * 2, r * 2, 1);
  return s;
}
// Heat-shield tiles: a grid of near-black tiles, each a shade apart, with thin dark gaps between them.
function paintTiles(k, c, x0, y0, w, h, tw, th, base = [31, 32, 37]) {
  c.fillStyle = '#0c0d10'; c.fillRect(x0, y0, w, h);
  for (let y = y0; y < y0 + h; y += th) for (let x = x0; x < x0 + w; x += tw) {
    const d = k.range(-8, 10) | 0;
    c.fillStyle = `rgb(${base[0] + d},${base[1] + d},${base[2] + d + (d > 6 ? 2 : 0)})`;
    c.fillRect(x + 1, y + 1, tw - 1.7, th - 1.7);
  }
}
// The normalised thickness of a round-nosed airfoil at u (0 at the leading edge, 1 at the trailing edge): peaks at 1.
const airfoil = u => Math.max(0, (.2969 * Math.sqrt(u) - .126 * u - .3516 * u * u + .2843 * u ** 3 - .1036 * u ** 4) / .1003);

// Seeded smooth 2D value noise (about -1..1) and a few octaves of it.
function noise2(k) {
  const perm = new Uint8Array(512), vals = new Float32Array(256), p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(k.rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) vals[i] = k.rand() * 2 - 1;
  const f = t => t * t * (3 - 2 * t), h = (x, y) => vals[perm[perm[x & 255] + (y & 255)]];
  const n = (x, y) => { const X = Math.floor(x), Y = Math.floor(y), u = f(x - X), v = f(y - Y); return lerp(lerp(h(X, Y), h(X + 1, Y), u), lerp(h(X, Y + 1), h(X + 1, Y + 1), u), v); };
  return (x, y, oct = 3) => { let s = 0, a = 1, t = 0; for (let i = 0; i < oct; i++) { s += a * n(x, y); t += a; a *= .5; x *= 2.07; y *= 2.07; } return s / t; };
}
// Crinkled foil insulation: a colour map (tone patches, seams, creased facets) and a matching bump map, both tiling.
function foilMaps(k, tones, o = {}) {
  const W = o.size ?? 512, facets = [], seams = [];
  for (let i = 0; i < (o.facets ?? 260); i++) {
    const x = k.rand() * W, y = k.rand() * W, r = k.range(10, 34), n = 3 + (k.rand() * 3 | 0), a0 = k.rand() * TAU, pts = [];
    for (let j = 0; j < n; j++) { const a = a0 + j / n * TAU + k.range(-.3, .3), rr = r * k.range(.6, 1.2); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    facets.push({ pts, v: k.rand() });
  }
  for (let i = 0; i < (o.seams ?? 5); i++) { const horiz = k.rand() < .5, at = k.rand() * W; seams.push({ horiz, at, wob: k.range(2, 6), ph: k.rand() * 9 }); }
  const creases = [];
  for (let i = 0; i < 90; i++) { const x = k.rand() * W, y = k.rand() * W, a = k.rand() * TAU, l = k.range(12, 60); creases.push([x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, k.rand()]); }
  const wrap = (c, fn) => { for (const dx of [-W, 0, W]) for (const dy of [-W, 0, W]) { c.save(); c.translate(dx, dy); fn(); c.restore(); } };
  const draw = (c, color) => {
    c.fillStyle = color ? tones[0] : '#808080'; c.fillRect(0, 0, W, W);
    if (color) for (let i = 0; i < 7; i++) { c.fillStyle = tones[1 + i % (tones.length - 1)]; c.globalAlpha = .55; c.fillRect(k.rand() * W - W * .2, k.rand() * W - W * .2, k.range(.25, .6) * W, k.range(.25, .6) * W); c.globalAlpha = 1; }
    wrap(c, () => {
      for (const f of facets) {
        c.fillStyle = color ? (f.v < .5 ? `rgba(60,30,0,${(.5 - f.v) * .36})` : `rgba(255,245,210,${(f.v - .5) * .4})`) : `rgb(${90 + f.v * 80 | 0},${90 + f.v * 80 | 0},${90 + f.v * 80 | 0})`;
        c.beginPath(); f.pts.forEach(([x, y], j) => j ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
      }
      for (const [x0, y0, x1, y1, v] of creases) { c.strokeStyle = color ? (v < .5 ? 'rgba(70,35,0,.3)' : 'rgba(255,250,225,.45)') : (v < .5 ? '#3a3a3a' : '#d0d0d0'); c.lineWidth = 1.4; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    });
    for (const sm of seams) {
      c.strokeStyle = color ? 'rgba(80,40,5,.55)' : '#303030'; c.lineWidth = color ? 2.5 : 4; c.beginPath();
      for (let t = 0; t <= W; t += 8) { const q = sm.at + Math.sin(t * .05 + sm.ph) * sm.wob; sm.horiz ? c.lineTo(t, q) : c.lineTo(q, t); }
      c.stroke();
      if (color) { c.strokeStyle = 'rgba(255,240,200,.35)'; c.lineWidth = 1.5; c.beginPath(); for (let t = 0; t <= W; t += 8) { const q = sm.at + 3 + Math.sin(t * .05 + sm.ph) * sm.wob; sm.horiz ? c.lineTo(t, q) : c.lineTo(q, t); } c.stroke(); }
    }
  };
  const rep = o.repeat ?? 1;
  return { map: k.tex(W, W, c => draw(c, true), { repeat: rep }), bump: k.tex(W, W, c => draw(c, false), { repeat: rep, data: true }) };
}
// Brushed / anodised panels: a light grey with panel seams and rivets, for faceted spacecraft skins.
function panelTex(k, base = '#c7cbd1', o = {}) {
  return k.tex(256, 256, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) { c.fillStyle = k.rand() < .5 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'; c.fillRect(k.rand() * w, k.rand() * h, k.range(30, 120), k.range(30, 120)); }
    for (let y = 0; y < h; y += 2) { c.fillStyle = `rgba(255,255,255,${k.rand() * .05})`; c.fillRect(0, y, w, 1); }
    c.fillStyle = o.seam ?? 'rgba(20,24,30,.4)';
    c.fillRect(0, 0, 2, h); c.fillRect(0, h * .55, w, 2);
    c.fillStyle = 'rgba(20,24,30,.3)';
    for (let x = 8; x < w; x += 18) { c.beginPath(); c.arc(x, h * .55 + 6, 1.3, 0, TAU); c.fill(); }
    for (let y = 8; y < h; y += 18) { c.beginPath(); c.arc(6, y, 1.3, 0, TAU); c.fill(); }
  }, { repeat: o.repeat ?? 1 });
}

// Rusty dust on the low parts of a model: a material made dusty() blends toward the dust colour (and goes matte)
// by a per-vertex 'dust' attribute, which settleDust() fills in from each vertex's height in the model.
function dusty(k, mat, color = '#a8602e') {
  const c = k.color(color);
  mat.onBeforeCompile = sh => {
    sh.uniforms.dustCol = { value: c };
    sh.vertexShader = 'attribute float dust;\nvarying float vDust;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vDust = dust;');
    sh.fragmentShader = 'uniform vec3 dustCol;\nvarying float vDust;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, dustCol, vDust);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 1.0, vDust);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = mix(metalnessFactor, 0.0, vDust);');
  };
  mat.customProgramCacheKey = () => 'craft-dusty';
  mat.userData.dusty = true;
  return mat;
}
function settleDust(k, root, amount) {
  const T = k.THREE, v = new T.Vector3(), m = new T.Matrix4();
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material) || !o.material.userData.dusty) return;
    const geo = o.geometry = o.geometry.clone();
    if (o.isInstancedMesh) {
      const arr = new Float32Array(o.count);
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); v.setFromMatrixPosition(m.premultiply(o.matrixWorld)); arr[i] = amount(v); }
      geo.setAttribute('dust', new T.InstancedBufferAttribute(arr, 1));
      return;
    }
    const p = geo.attributes.position, arr = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); arr[i] = amount(v); }
    geo.setAttribute('dust', new T.BufferAttribute(arr, 1));
  });
}

export default {
  // The orbiter climbing out, nose up: white on top, black tiles underneath and round the nose, a double-delta wing,
  // the tall tail with its split rudder, three main engines glowing blue-white, payload bay doors and a black window mask.
  shuttle(k) {
    const T = k.THREE, g = k.group(), ob = k.group(); g.add(ob);
    const L = 32.8;                                   // fuselage length (m), nose tip at x = 0 running back along -x; +z is the right wing
    // the fuselage: stations s back from the nose; a flat-bottomed, round-topped section that swells out of a blunt nose
    const HW = curve1([[0, 0], [.15, .55], [.4, .9], [.8, 1.22], [1.5, 1.6], [2.5, 1.98], [4, 2.3], [6, 2.52], [8, 2.6], [L, 2.6]]);
    const YB = curve1([[0, 2.05], [.15, 1.72], [.4, 1.52], [.8, 1.3], [1.5, 1.02], [2.5, .72], [4, .38], [6, .12], [8, 0], [L, 0]]);
    const YT = curve1([[0, 2.05], [.15, 2.5], [.4, 2.8], [.8, 3.1], [1.5, 3.45], [2.5, 3.85], [3.6, 4.2], [4.6, 4.55], [5.3, 5.3], [6.0, 5.75], [6.8, 5.9], [8.6, 5.9], [9.6, 5.8], [10.6, 5.45], [27, 5.45], [L, 5.95]]);
    const YM = curve1([[0, 2.05], [.8, 2.1], [2.5, 2.3], [5, 2.65], [8, 2.8], [L, 2.8]]);
    const NLO = curve1([[0, 2.3], [3, 3.0], [7, 4.2], [L, 4.2]]);
    const NUP = curve1([[0, 2.0], [3, 2.2], [5.5, 2.7], [8.6, 2.6], [10.6, 2.15], [L, 2.15]]);
    const secPt = (s, th) => {
      const c = Math.cos(th), sn = Math.sin(th), ym = YM(s), e = 2 / (sn < 0 ? NLO(s) : NUP(s));
      return [HW(s) * Math.sign(c) * Math.abs(c) ** e, ym + (sn < 0 ? ym - YB(s) : YT(s) - ym) * Math.sign(sn) * Math.abs(sn) ** e];
    };
    const NS = 240;   // samples round a section: 0 bottom middle, NS/4 right waist, NS/2 top, 3NS/4 left waist
    const section = s => {
      const pts = [], cum = [0];
      for (let i = 0; i <= NS; i++) { pts.push(secPt(s, -Math.PI / 2 + TAU * i / NS)); if (i) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); }
      return { pts, cum, P: cum[NS] };
    };
    const atV = (sec, v) => {   // the point at a fraction v of the way round (by length)
      const want = v * sec.P; let i = 1; while (i < NS && sec.cum[i] < want) i++;
      const a = sec.cum[i - 1], b = sec.cum[i], t = b > a ? clamp01((want - a) / (b - a)) : 0;
      return [lerp(sec.pts[i - 1][0], sec.pts[i][0], t), lerp(sec.pts[i - 1][1], sec.pts[i][1], t)];
    };
    const vAtY = (sec, y) => {  // how far round (right side) the section reaches height y
      for (let i = 1; i <= NS / 2; i++) { const y0 = sec.pts[i - 1][1], y1 = sec.pts[i][1]; if (y1 >= y) { const t = y1 > y0 ? clamp01((y - y0) / (y1 - y0)) : 0; return (sec.cum[i - 1] + t * (sec.cum[i] - sec.cum[i - 1])) / sec.P; } }
      return .5;
    };
    const NU = 110, NV = 120, ss = Array.from({ length: NU + 1 }, (_, i) => L * (i / NU) ** 1.7), secs = ss.map(section);
    const fusGeo = surf(k, NU, NV, (i, j) => { const [z, y] = atV(secs[i], j / NV); return { p: [-ss[i], y, z], uv: [ss[i] / L, j / NV] }; }, { inside: [-L / 2, 2.8, 0] });

    // its paint: black tiles below and round the nose and windows, white above, glossy windows, payload bay door seams
    const FW = 2048, FH = 1024, colW = 2;
    const cols = [];
    for (let x = 0; x < FW; x += colW) { const s = (x + colW / 2) / FW * L; cols.push({ x, s, sec: section(s) }); }
    const yBlack = curve1([[0, 2.9], [1.5, 2.95], [3, 3.1], [4.3, 3.35], [5.6, 3.2], [7, 2.65], [8.6, 2.0], [10.5, 1.55], [13, 1.42], [L, 1.42]]);
    const vy = (v, side) => (side > 0 ? 1 - v : v) * FH;          // canvas y of fraction v on the right (+1) or its mirror on the left (-1)
    const band = (c, x, w, v0, v1) => { for (const sd of [1, -1]) { const a = vy(v0, sd), b = vy(v1, sd); c.fillRect(x, Math.min(a, b), w, Math.abs(b - a)); } };
    const winSpans = col => {   // [v0, v1] spans of window glass on the right side of this column
      const { s, sec } = col, out = [];
      if (s > 4.78 && s < 5.9) for (const [d0, d1] of [[.07, .6], [.7, 1.23], [1.33, 1.8]]) out.push([.5 - d1 / sec.P, .5 - d0 / sec.P]);
      for (const [a, b] of [[6.35, 6.95], [7.08, 7.68]]) if (s > a && s < b) out.push([vAtY(sec, 4.5), vAtY(sec, 5.02)]);
      if (s > 7.05 && s < 7.85) out.push([.5 - .66 / sec.P, .5 - .2 / sec.P]);
      return out;
    };
    const maskSpan = col => {   // the black band round the windows
      const { s, sec } = col;
      if (s < 4.4 || s > 8.55) return null;
      const lo = vAtY(sec, lerp(4.12, 4.3, smooth(4.4, 8.5, s)));
      const hi = s < 5.95 ? .5 : lerp(.5, vAtY(sec, 5.18), smooth(5.95, 6.3, s));
      return [lo, hi];
    };
    const fusMap = k.tex(FW, FH, c => {
      paintTiles(k, c, 0, 0, FW, FH, 12, 12);
      c.fillStyle = '#eceef1';
      for (const col of cols) {
        const vb = vAtY(col.sec, yBlack(col.s)), m = maskSpan(col);
        if (col.s < 1.25) continue;
        if (m) { band(c, col.x, colW, vb, m[0]); if (m[1] < .5) band(c, col.x, colW, m[1], .5); }
        else band(c, col.x, colW, vb, .5);
      }
      c.fillStyle = '#1f2025';   // dark frames round the two overhead windows
      for (const col of cols) if (col.s > 6.95 && col.s < 7.95) band(c, col.x, colW, .5 - .76 / col.sec.P, .5);
      // a patchwork of tiles a shade apart, the way the real thing is, then faint quilting over the white
      for (let i = 0; i < 1400; i++) { const x = (k.rand() * FW / 12 | 0) * 12, y = (k.rand() * FH / 12 | 0) * 12; c.fillStyle = `rgba(60,70,90,${k.range(.03, .08)})`; c.fillRect(x, y, 12 * (1 + (k.rand() * 3 | 0)), 12); }
      c.fillStyle = 'rgba(40,50,70,.05)';
      for (let x = 0; x < FW; x += 12) c.fillRect(x, 0, 1, FH);
      for (let y = 0; y < FH; y += 12) c.fillRect(0, y, FW, 1);
      // the nose cap: dark grey carbon
      const nx = 1.25 / L * FW, gr = c.createLinearGradient(0, 0, nx, 0);
      gr.addColorStop(0, '#2c2d31'); gr.addColorStop(1, '#3d3e43'); c.fillStyle = gr; c.fillRect(0, 0, nx, FH);
      // payload bay doors: a seam down the middle, hinge lines along the sides, and the joints between the door panels
      c.fillStyle = 'rgba(60,66,78,.55)';
      for (const col of cols) {
        if (col.s < 10.3 || col.s > 28.2) continue;
        band(c, col.x, colW, .4995, .5005);
        const vh = vAtY(col.sec, 4.05); band(c, col.x, colW, vh - .0012, vh + .0012);
      }
      for (const s of [10.3, 13.9, 17.5, 21.1, 24.7, 28.2]) {
        const col = cols[Math.round(s / L * FW / colW)], vh = vAtY(col.sec, 4.05);
        band(c, col.x - 1, 3, vh, .5);
      }
      // RCS thruster ports on the nose
      c.fillStyle = '#15161a';
      for (const [s, y] of [[2.1, 3.55], [2.5, 3.65], [2.9, 3.75], [2.3, 3.2], [2.7, 3.3]]) {
        const col = cols[Math.round(s / L * FW / colW)], v = vAtY(col.sec, y);
        for (const sd of [1, -1]) { c.beginPath(); c.arc(col.x, vy(v, sd), 4.5, 0, TAU); c.fill(); }
      }
      // the windows: dark glass with a sky-blue sheen at the top
      for (const col of cols) for (const [v0, v1] of winSpans(col)) {
        for (const sd of [1, -1]) {
          const a = vy(v0, sd), b = vy(v1, sd), y0 = Math.min(a, b), h = Math.abs(b - a);
          const gl = c.createLinearGradient(0, sd > 0 ? y0 : y0 + h, 0, sd > 0 ? y0 + h : y0);
          gl.addColorStop(0, '#34506e'); gl.addColorStop(.45, '#15202e'); gl.addColorStop(1, '#0a0f16');
          c.fillStyle = gl; c.fillRect(col.x, y0, colW, h);
        }
      }
      // the orbiter's name along each side
      const name = 'HORIZON';
      for (const sd of [1, -1]) {
        const col = cols[Math.round(13.2 / L * FW / colW)], v = vAtY(col.sec, 3.05);
        c.save(); c.translate(col.x, vy(v, sd)); c.scale(sd > 0 ? -1 : 1, sd > 0 ? 1 : -1);
        k.text(c, name, 0, 0, { size: 44, weight: 700, color: '#1d2433', font: 'Nunito, system-ui, sans-serif' });
        c.restore();
      }
    });
    const bumpTex = k.tex(512, 256, (c, w, h) => { c.fillStyle = '#909090'; c.fillRect(0, 0, w, h); c.fillStyle = '#505050'; for (let x = 0; x < w; x += 3) c.fillRect(x, 0, 1, h); for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1); }, { data: true });
    const glassMask = k.tex(FW / 4, FH / 4, c => {
      c.fillStyle = '#000'; c.fillRect(0, 0, FW / 4, FH / 4); c.fillStyle = '#fff';
      for (const col of cols) for (const [v0, v1] of winSpans(col)) for (const sd of [1, -1]) { const a = vy(v0, sd) / 4, b = vy(v1, sd) / 4; c.fillRect(col.x / 4, Math.min(a, b), colW / 4 + .5, Math.abs(b - a)); }
    }, { data: true });
    const skin = k.mat({ map: fusMap, roughness: .55, bumpMap: bumpTex, bumpScale: .6, clearcoat: 1, clearcoatMap: glassMask, clearcoatRoughness: .04 });
    k.add(ob, fusGeo, skin);
    // the aft bulkhead
    const endSec = section(L), endShape = new T.Shape();
    endSec.pts.forEach(([z, y], i) => i ? endShape.lineTo(z, y) : endShape.moveTo(z, y));
    k.add(ob, new T.ShapeGeometry(endShape, 4), k.matte('#3c3e44', .7), { p: [-L, 0, 0], r: [0, -Math.PI / 2, 0] });

    // the wings: a double delta, white on top with black leading edges, black tiles underneath
    const ZS = [1.6, 2.2, 2.6, 3.0, 3.5, 3.93, 4.6, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.2, 11.6, 11.75, 11.84, 11.9];
    const LE = z => z <= 2.6 ? 10 : z <= 3.93 ? 10 + (z - 2.6) / .158 : 18.43 + (z - 3.93);
    const TE = z => 31.8 - .176 * (z - 1.6);
    const TK = z => (z <= 2.6 ? 1.25 : lerp(1.25, .34, (z - 2.6) / 9)) * (z > 11.6 ? Math.sqrt(Math.max(0, 1 - ((z - 11.6) / .3) ** 2)) : 1);
    const base = z => (z - 1.6) * .061;
    const WU = 36, wuv = (s, z) => [(s - 9) / 23.5, (z - 1.5) / 10.8];
    const WW = 1024, WH = 470, wpx = (s, z) => [(s - 9) / 23.5 * WW, (1 - (z - 1.5) / 10.8) * WH];
    const wingTop = insignia => k.tex(WW, WH, c => {
      c.fillStyle = '#eceef1'; c.fillRect(0, 0, WW, WH);
      for (let i = 0; i < 500; i++) { const x = (k.rand() * WW / 9 | 0) * 9, y = (k.rand() * WH / 9 | 0) * 9; c.fillStyle = `rgba(60,70,90,${k.range(.03, .08)})`; c.fillRect(x, y, 9 * (1 + (k.rand() * 3 | 0)), 9); }
      c.fillStyle = 'rgba(40,50,70,.07)';
      for (let x = 0; x < WW; x += 9) c.fillRect(x, 0, 1, WH);
      for (let y = 0; y < WH; y += 9) c.fillRect(0, y, WW, 1);
      // black tiles back from the leading edge (wider along the glove), then the dark grey carbon edge itself
      const edge = (off, col) => {
        c.fillStyle = col; c.beginPath();
        const zs = []; for (let z = 1.5; z <= 12.3; z += .1) zs.push(z);
        zs.forEach((z, i) => { const [x, y] = wpx(LE(z) + off(z), z); i ? c.lineTo(x, y) : c.moveTo(x, y); });
        for (let i = zs.length - 1; i >= 0; i--) { const [x, y] = wpx(LE(zs[i]) - 3, zs[i]); c.lineTo(x, y); }
        c.closePath(); c.fill();
      };
      edge(z => z < 3.93 ? 1.1 : .55, '#202126');
      edge(() => .22, '#3a3b40');
      // elevons: two hinge lines ahead of the trailing edge, split halfway out
      c.strokeStyle = 'rgba(70,78,92,.6)'; c.lineWidth = 2.5;
      c.beginPath(); for (const z of [2.9, 11.3]) { const [x, y] = wpx(TE(z) - 2.1, z); z < 3 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke();
      for (const z of [2.9, 7.1, 11.3]) { const a = wpx(TE(z) - 2.1, z), b = wpx(TE(z) + .2, z); c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); }
      if (insignia) {   // a made-up roundel (like no real agency's): an orange disc, a navy ring and a white four-point star
        const [x, y] = wpx(22.3, 7.2), r = 1.25 / 10.8 * WH;
        c.save(); c.translate(x, y); c.rotate(-Math.PI / 2);
        c.fillStyle = '#e8651a'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        c.lineWidth = r * .1; c.strokeStyle = '#ffffff'; c.stroke();
        c.lineWidth = r * .09; c.strokeStyle = '#1b2a5c'; c.beginPath(); c.arc(0, 0, r * .8, 0, TAU); c.stroke();
        c.fillStyle = '#ffffff'; c.beginPath();
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU - Math.PI / 2, rr = i % 2 ? r * .16 : r * .62; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        c.closePath(); c.fill();
        c.restore();
      }
    });
    const wingBottom = k.tex(WW, WH, c => {
      paintTiles(k, c, 0, 0, WW, WH, 9, 9);
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 2.5;
      const [x0, y0] = wpx(19.6, 4.4), [x1, y1] = wpx(24.4, 2.9); c.strokeRect(x0, y0, x1 - x0, y1 - y0);   // main gear door
    });
    const wingSkin = map => k.mat({ map, roughness: .58, bumpMap: bumpTex, bumpScale: .45 });
    const topR = wingSkin(wingTop(true)), topL = wingSkin(wingTop(false)), under = wingSkin(wingBottom);
    for (const sd of [1, -1]) {
      for (const upper of [true, false]) {
        const geo = surf(k, WU, ZS.length - 1, (i, j) => {
          const z = ZS[j], u = (i / WU) ** 1.8, s = lerp(LE(z), TE(z), u), f = airfoil(u) * TK(z);
          return { p: [-s, base(z) + (upper ? f * .82 : -f * .18), sd * z], uv: wuv(s, z) };
        }, { inside: [-22, upper ? -3 : 3, sd * 6] });
        k.add(ob, geo, upper ? (sd > 0 ? topR : topL) : under);
      }
    }

    // the tail: a swept fin with a black leading edge, and the rudder split into two halves that splay open a little
    const LEt = y => 25.2 + (y - 5.3), TEt = y => 33.6 + (y - 5.3) * .29, HGt = y => lerp(LEt(y), TEt(y), .6);
    const R0 = 6.5, R1 = 14.35;
    const tailMap = k.tex(512, 512, c => {
      const px = (s, y) => [(s - 24.8) / 12 * 512, (1 - (y - 5) / 10) * 512];
      c.fillStyle = '#eceef1'; c.fillRect(0, 0, 512, 512);
      c.fillStyle = 'rgba(40,50,70,.07)';
      for (let x = 0; x < 512; x += 8) c.fillRect(x, 0, 1, 512);
      for (let y = 0; y < 512; y += 8) c.fillRect(0, y, 512, 1);
      c.fillStyle = '#212227'; c.beginPath();
      [[LEt(4.8) - 1, 4.8], [LEt(15) - 1, 15], [LEt(15) + .5, 15], [LEt(4.8) + .5, 4.8]].forEach(([s, y], i) => i ? c.lineTo(...px(s, y)) : c.moveTo(...px(s, y)));
      c.fill();
      c.strokeStyle = 'rgba(70,78,92,.55)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(...px(HGt(R0), R0)); c.lineTo(...px(HGt(R1), R1)); c.stroke();
    });
    const tailSkin = k.mat({ map: tailMap, roughness: .55, bumpMap: bumpTex, bumpScale: .45 });
    const TKt = y => lerp(.9, .3, (y - 5.3) / 9.4) * (y > 14.4 ? Math.sqrt(Math.max(0, 1 - ((y - 14.4) / .3) ** 2)) : 1);
    const YS = [5.2, 5.8, R0 - .01, R0 + .01, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5, R1 - .01, R1 + .01, 14.55, 14.65, 14.7];
    const tuv = (s, y) => [(s - 24.8) / 12, (y - 5) / 10];
    for (const sd of [1, -1]) {
      const geo = surf(k, 30, YS.length - 1, (i, j) => {
        const y = YS[j], te = y > R0 && y < R1 ? HGt(y) : TEt(y), u = (i / 30) ** 1.6, s = lerp(LEt(y), te, u);
        return { p: [-s, y, sd * airfoil(u) * TKt(y) * .5], uv: tuv(s, y) };
      }, { inside: [-30, 9, -sd] });
      k.add(ob, geo, tailSkin);
      // this half of the rudder: a thin wedge hinged on the centre line, swung out 6°
      const dl = k.deg(6), yb = R0 + .02, yt = R1 - .02;
      const cb = TEt(yb) - HGt(yb), ct = TEt(yt) - HGt(yt), hb = TKt(yb) * .5 * .55, ht = TKt(yt) * .5 * .55;
      const v = [
        [-HGt(yb), yb, sd * .01], [-HGt(yb), yb, sd * hb], [-TEt(yb), yb, sd * (cb * Math.sin(dl) + .03)], [-TEt(yb), yb, sd * cb * Math.sin(dl)],
        [-HGt(yt), yt, sd * .01], [-HGt(yt), yt, sd * ht], [-TEt(yt), yt, sd * (ct * Math.sin(dl) + .03)], [-TEt(yt), yt, sd * ct * Math.sin(dl)],
      ];
      const rg = facets(k, v, [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]);
      const ua = rg.attributes.position, uva = rg.attributes.uv;
      for (let i = 0; i < ua.count; i++) { const q = tuv(-ua.getX(i), ua.getY(i)); uva.setXY(i, q[0], q[1]); }
      k.add(ob, rg, tailSkin);
    }

    // the OMS pods either side of the tail, each with its little engine
    const podMap = k.tex(256, 256, c => {
      c.fillStyle = '#eceef1'; c.fillRect(0, 0, 256, 256);
      c.fillStyle = 'rgba(40,50,70,.08)'; for (let x = 0; x < 256; x += 8) c.fillRect(x, 0, 1, 256); for (let y = 0; y < 256; y += 8) c.fillRect(0, y, 256, 1);
      paintTiles(k, c, 0, 256 * .8, 256, 256 * .2, 8, 8);
    });
    const podGeo = k.lathe([[0, 0], [.35, .08], [.55, .3], [.72, .8], [.85, 1.8], [.9, 3.5], [.88, 6], [.82, 8.3], [0, 8.3]], { smooth: true, seg: 40 });
    const bellMat = k.mat({ color: '#b9b8b6', metalness: 1, roughness: .34, map: k.tex(256, 64, c => {
      c.fillStyle = '#b8b2ab'; c.fillRect(0, 0, 256, 64);
      for (let x = 0; x < 256; x += 2) { c.fillStyle = x % 4 ? 'rgba(0,0,0,.22)' : 'rgba(255,255,255,.12)'; c.fillRect(x, 0, 1, 64); }
      c.fillStyle = 'rgba(40,30,20,.35)'; for (const y of [10, 28, 44]) c.fillRect(0, y, 256, 3);
    }) });
    for (const sd of [1, -1]) {
      k.add(ob, podGeo, k.mat({ map: podMap, roughness: .55 }), { p: [-24.6, 5.02, sd * 1.3], r: [0, 0, Math.PI / 2], s: [.95, 1, .7] });
      const oms = k.group([], { p: [-32.75, 5.12, sd * 1.36], r: [0, sd * .06, Math.PI / 2 + .08] }); ob.add(oms);
      k.add(oms, k.lathe([[.22, 0], [.2, .08], [.3, .45], [.4, .9], [.42, 1.05]], { seg: 28 }), bellMat);
      k.add(oms, k.lathe([[.39, 1.02], [.38, .9], [.29, .45], [.2, .08]], { seg: 28 }), k.matte('#1a1b1f', .6));
    }

    // three main engines: bells with a faint blue-white glow deep inside
    const glowMap = k.tex(8, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.2, '#bfe6ff'); gr.addColorStop(.7, '#2a5a9a'); gr.addColorStop(1, '#0a1628'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    const inner = k.mat({ color: '#0b1220', roughness: .5, metalness: .2, emissive: k.color('#ffffff'), emissiveMap: glowMap, emissiveIntensity: 1.6 });
    const bellOut = [], bellIn = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14, r = .3 + .85 * t ** .82; bellOut.push([r + .045, .35 + t * 2.9]); bellIn.unshift([r, .35 + t * 2.9]); }
    bellOut.unshift([.5, 0], [.5, .22], [.38, .3]);
    bellOut.push([1.16, 3.28]);
    for (const [y, z] of [[4.35, 0], [1.92, 1.32], [1.92, -1.32]]) {
      const e = k.group([], { p: [-L + .05, y, z], r: [0, z * .03, Math.PI / 2 + (y > 3 ? .05 : -.02)], order: 'YXZ' }); ob.add(e);
      k.add(e, k.lathe(bellOut, { seg: 40 }), bellMat);
      k.add(e, k.lathe(bellIn, { seg: 40 }), inner);
      k.add(e, k.disc(.36, 24), k.glow('#dff3ff', 2.2), { p: [0, .36, 0], r: [-Math.PI / 2, 0, 0] });
      // the exhaust: a trail of soft blue-white glows fading out behind the bell
      for (const [y1, r, o] of [[3.45, 1.15, 1], [4.1, 2.0, .55], [5.2, 1.75, .36], [6.5, 1.55, .22], [7.9, 1.3, .13], [9.2, 1.05, .08]]) {
        const h1 = halo(k, r, y1 < 4 ? '#e8f6ff' : '#86c8ff', o); h1.position.set(0, y1, 0); e.add(h1);
      }
    }
    // the body flap under the engines
    k.add(ob, k.box(2.6, .42, 6.1, .14), k.matte('#26272c', .72), { p: [-L - 1.05, .27, 0] });

    // the pose, set on screen for the default camera: the nose climbing up to the right, the top turned toward us
    const pose = { ang: 37, toward: .22, top: [.5, .85, -.1] };
    const az = k.deg(30), el = k.deg(16);
    const F = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)), Rt = new T.Vector3(Math.cos(az), 0, -Math.sin(az)), Up = new T.Vector3().crossVectors(F, Rt);
    const nose = Rt.clone().multiplyScalar(Math.cos(k.deg(pose.ang))).addScaledVector(Up, Math.sin(k.deg(pose.ang))).addScaledVector(F, pose.toward).normalize();
    const top = F.clone().multiplyScalar(pose.top[0]).addScaledVector(Up, pose.top[1]).addScaledVector(Rt, pose.top[2]);
    top.addScaledVector(nose, -top.dot(nose)).normalize();
    ob.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(nose, top, new T.Vector3().crossVectors(nose, top)));
    g.userData.floating = true;
    g.userData.fullView = { lift: -.14 };   // fly a little higher on full-art cards and the pack wrapper
    return g;
  },

  // An Apollo-style lunar module: a crinkly gold-foil descent stage on four spindly legs with round footpads (a ladder
  // down the front one), and the angular grey ascent stage with its triangular windows, hatch, docking tunnel,
  // thruster quads and antennas.
  lander(k) {
    const T = k.THREE, g = k.group(), nz = noise2(k);
    const foil = foilMaps(k, ['#d9a13a', '#e8b54c', '#c98d2b', '#f0c25a', '#d39634'], { repeat: 1 });
    const gold = k.mat({ map: foil.map, bumpMap: foil.bump, bumpScale: 3, metalness: 1, roughness: .3 });
    const darkFoil = foilMaps(k, ['#2a2b30', '#34353b', '#212226', '#3b3c42'], { facets: 200, seams: 3 });
    const black = k.mat({ map: darkFoil.map, bumpMap: darkFoil.bump, bumpScale: 2, metalness: .6, roughness: .45 });
    const silverFoil = foilMaps(k, ['#c9ccd2', '#dadde2', '#b6bac1', '#e4e6ea'], { facets: 200, seams: 3 });
    const silver = k.mat({ map: silverFoil.map, bumpMap: silverFoil.bump, bumpScale: 2.5, metalness: 1, roughness: .28 });
    const alu = k.metal('#d2d5da', .32), strutMat = k.metal('#c3c6cc', .3);

    // the descent stage: an octagon of puffy foil blankets, each face bulging a little, crinkled all over
    const A = 2.1, RC = A / Math.cos(Math.PI / 8), Y0 = 1.5, Y1 = 3.15, NA = 96, NH = 14;
    const oct = t => {   // t 0..1 round the octagon → point, outward normal, fraction along its face
      const f = t * 8, i = Math.floor(f) % 8, fa = f - Math.floor(f), a0 = Math.PI / 8 + i * Math.PI / 4, a1 = a0 + Math.PI / 4;
      const x = lerp(Math.cos(a0), Math.cos(a1), fa) * RC, z = lerp(Math.sin(a0), Math.sin(a1), fa) * RC, na = a0 + Math.PI / 8;
      return { x, z, nx: Math.cos(na), nz: Math.sin(na), fa };
    };
    const perim = 8 * 2 * RC * Math.sin(Math.PI / 8);
    k.add(g, surf(k, NA, NH, (i, j) => {
      const t = i / NA, h = j / NH, q = oct(t), y = lerp(Y0, Y1, h);
      const puff = .09 * Math.sin(Math.PI * q.fa) * Math.sin(Math.PI * h) ** .7 + .025 * nz(t * 40, h * 6) * Math.sin(Math.PI * h);
      return { p: [q.x + q.nx * puff, y, q.z + q.nz * puff], uv: [t * perim / 1.6, y / 1.6] };
    }, { inside: [0, 2.3, 0] }), gold);
    const octShape = new T.Shape();
    for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; i ? octShape.lineTo(Math.cos(a) * RC, Math.sin(a) * RC) : octShape.moveTo(Math.cos(a) * RC, Math.sin(a) * RC); }
    k.add(g, new T.ShapeGeometry(octShape), black, { p: [0, Y0 + .005, 0], r: [Math.PI / 2, 0, 0] });
    k.add(g, new T.ShapeGeometry(octShape), silver, { p: [0, Y1, 0], r: [-Math.PI / 2, 0, 0] });
    // a dark band round the top edge and the descent engine's bell underneath
    k.add(g, k.cyl(RC * 1.005, RC * 1.005, .16, { seg: 8 }), black, { p: [0, Y1 - .06, 0], r: [0, Math.PI / 8, 0] });
    const bell = [[.42, 0], [.46, -.1], [.58, -.35], [.72, -.58], [.76, -.62]];
    k.add(g, k.lathe(bell.slice().reverse(), { seg: 32 }), k.metal('#4a4540', .45), { p: [0, Y0, 0] });
    k.add(g, k.lathe(bell.map(([r, y]) => [r - .03, y]), { seg: 32 }), k.matte('#141416', .8), { p: [0, Y0, 0] });

    // four legs: a fat primary strut out to a round footpad, two thin struts bracing it, the ladder on the front one
    const pad = k.lathe([[0, 0], [.42, 0], [.47, .04], [.47, .1], [.36, .19], [.14, .25], [0, .27]], { seg: 36 });
    const secs = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tx = -dz, tz = dx, top = [dx * (A + .02), Y1 - .15, dz * (A + .02)], foot = [dx * 4.25, .3, dz * 4.25];
      const mid = top.map((v, i) => lerp(foot[i], v, .52)), knee = top.map((v, i) => lerp(foot[i], v, .36));
      g.add(rod(k, top, mid, .11, gold, 16), rod(k, mid, foot, .07, strutMat, 14));
      k.add(g, k.cyl(.12, .12, .1, { seg: 16 }), black, { p: mid, r: aim(k, new T.Object3D(), foot.map((v, i) => v - top[i])).rotation.toArray().slice(0, 3) });
      k.add(g, pad, silver, { p: [dx * 4.25, 0, dz * 4.25] });
      k.add(g, k.sphere(.1, { w: 16, h: 12 }), strutMat, { p: foot });
      for (const sgn of [-1, 1]) secs.push(span(k, [dx * (A + .02) + tx * sgn * .82, Y0 + .08, dz * (A + .02) + tz * sgn * .82], knee, .045));
      k.add(g, k.box(.5, .5, .12, .04), black, { p: [dx * (A + .06), Y1 - .35, dz * (A + .06)], r: [0, Math.atan2(dx, dz), 0] });
    }
    g.add(k.instances(k.cyl(1, 1, 1, { seg: 10 }), strutMat, secs));
    // the ladder down the front leg, and the porch at its top
    const lTop = [0, Y1 - .25, A + .3], lBot = [0, .72, 3.78], ld = lBot.map((v, i) => v - lTop[i]);
    for (const sgn of [-1, 1]) g.add(rod(k, [sgn * .26, lTop[1], lTop[2]], [sgn * .26, lBot[1], lBot[2]], .03, alu, 8));
    const rungs = [];
    for (let i = 0; i < 8; i++) { const t = (i + .5) / 8, p = lTop.map((v, j) => v + ld[j] * t); rungs.push({ p, r: [0, 0, Math.PI / 2], s: [.022, .52, .022] }); }
    g.add(k.instances(k.cyl(1, 1, 1, { seg: 8 }), alu, rungs));
    k.add(g, k.box(1.0, .06, .75, .02), alu, { p: [0, Y1 - .04, A + .3] });
    for (const sgn of [-1, 1]) g.add(rod(k, [sgn * .5, Y1 + .55, A + .05], [sgn * .5, Y1 - .02, A + .62], .025, alu, 8));

    // the ascent stage: a faceted cabin with a chevron front, a box behind it and tanks bulging out of its sides
    const ascent = k.group(); g.add(ascent);
    const pnl = panelTex(k, '#c3c7cd', { repeat: 1 });
    const skin = k.mat({ map: pnl, metalness: .75, roughness: .38 });
    const dark = k.mat({ map: panelTex(k, '#34363c', { seam: 'rgba(0,0,0,.5)' }), metalness: .35, roughness: .5 });
    const ring = (y, pts) => pts.map(([x, z]) => [x, y, z]);
    const front = [[-1.2, -.55], [1.2, -.55], [1.2, .75], [.52, 1.2], [-.52, 1.2], [-1.2, .75]];
    const inset = [[-1.08, -.45], [1.08, -.45], [1.08, .68], [.47, 1.08], [-.47, 1.08], [-1.08, .68]];
    const cab = loft(k, [ring(3.3, front), ring(5.72, front), ring(5.92, inset)], { scale: 2.2, sideMat: (r, i) => i === 3 && r === 0 ? 1 : 0, capMat: 0 });
    k.add(ascent, cab, [skin, dark]);
    k.add(ascent, k.box(2.1, 2.1, 1.25, .04), skin, { p: [0, 4.35, -1.12] });
    k.add(ascent, k.box(2.5, .95, .55, .04), dark, { p: [0, 4.95, -1.95] });
    for (const sgn of [-1, 1]) k.add(ascent, k.sphere(.62, { w: 28, h: 20 }), black, { p: [sgn * 1.02, 3.92, -.8], s: [.5, .82, 1.1] });
    k.add(ascent, k.box(2.6, .14, 2.9, .03), black, { p: [0, 3.26, -.45] });
    // the two triangular windows, angled down like a pair of eyes, and the square hatch below them
    const glass = k.mat({ color: '#0d1a2c', roughness: .05, metalness: .5, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 2.2 });
    const frameM = k.metal('#8a8f98', .4);
    for (const sgn of [-1, 1]) {
      const pin = [sgn * .52, 1.2], pout = [sgn * 1.2, .75], dir = [pout[0] - pin[0], pout[1] - pin[1]], nrm = [sgn * Math.abs(dir[1]), Math.abs(dir[0])];
      const nl = Math.hypot(...nrm), n = [nrm[0] / nl, nrm[1] / nl];
      const P = (f, y, off) => [pin[0] + dir[0] * f + n[0] * off, y, pin[1] + dir[1] * f + n[1] * off];
      const tri = (pts, mat, off) => { const geo = new T.BufferGeometry().setFromPoints(pts.map(([f, y]) => new T.Vector3(...P(f, y, off)))); geo.computeVertexNormals(); const m = k.mesh(geo, mat); m.material.side = T.DoubleSide; ascent.add(m); };
      tri([[.04, 5.08], [.92, 5.08], [.04, 3.98]], frameM, .012);
      tri([[.1, 5.0], [.82, 5.0], [.1, 4.18]], glass, .024);
    }
    k.add(ascent, k.box(.86, .86, .05, .02), frameM, { p: [0, 3.95, 1.215] });
    k.add(ascent, k.box(.72, .72, .06, .02), dark, { p: [0, 3.95, 1.225] });
    k.add(ascent, k.box(.3, .05, .06, .02), alu, { p: [.12, 3.8, 1.27] });
    // the docking tunnel on top
    k.add(ascent, k.cyl(.44, .46, .55, { seg: 32, open: true }), k.mat({ map: pnl, metalness: .75, roughness: .38, side: T.DoubleSide }), { p: [0, 6.1, -.25] });
    k.add(ascent, k.torus(.46, .045, { rs: 10, ts: 40 }), alu, { p: [0, 6.38, -.25], r: [Math.PI / 2, 0, 0] });
    k.add(ascent, k.disc(.44, 32), k.matte('#1c1d21', .7), { p: [0, 6.12, -.25], r: [-Math.PI / 2, 0, 0] });
    // four thruster quads on struts at the corners: a little housing with four nozzles pointing four ways
    const noz = k.lathe([[.05, 0], [.06, .05], [.1, .2], [.11, .22]], { seg: 16 }), nozzles = [];
    for (const [qx, qz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const c = [qx * 1.62, 5.3, qz > 0 ? .95 : -1.45];
      ascent.add(rod(k, [qx * 1.15, 5.15, qz > 0 ? .55 : -1.05], c, .05, alu, 8));
      k.add(ascent, k.box(.3, .34, .3, .04), silver, { p: c });
      for (const d of [[0, 1, 0], [0, -1, 0], [qx, 0, 0], [0, 0, qz]]) {
        const e = new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...d)));
        nozzles.push({ p: [c[0] + d[0] * .15, c[1] + d[1] * .17, c[2] + d[2] * .15], r: [e.x, e.y, e.z] });
      }
      k.add(ascent, k.box(.46, .03, .46, .01), gold, { p: [c[0], c[1] - .42, c[2]] });
    }
    ascent.add(k.instances(noz, k.metal('#5a5650', .4), nozzles));
    // antennas: the rendezvous radar dish up front, the steerable dish on its boom, and two whips
    const dish = (r, depth) => k.lathe([[0, 0], [r * .3, depth * .09], [r * .6, depth * .36], [r, depth], [r * .96, depth], [r * .57, depth * .38], [r * .28, depth * .12], [0, .03]], { seg: 32 });
    const radar = k.group([], { p: [.62, 6.0, .45], r: [-.7, .35, 0] }); ascent.add(radar);
    k.add(radar, k.cyl(.07, .09, .4, { seg: 12 }), alu, { p: [0, -.2, 0] });
    k.add(radar, dish(.36, .14), gold, { p: [0, 0, 0] });
    k.add(radar, k.cyl(.02, .02, .3, { seg: 8 }), alu, { p: [0, .15, 0] });
    const sband = k.group([], { p: [1.25, 5.95, -1.25], r: [.2, 0, -.85] }); ascent.add(sband);
    k.add(sband, k.cyl(.035, .035, .8, { seg: 8 }), alu, { p: [0, .4, 0] });
    k.add(sband, dish(.34, .13), silver, { p: [0, .82, 0] });
    ascent.add(rod(k, [-.75, 5.85, -1.3], [-1.35, 7.0, -1.75], .018, alu, 6));
    ascent.add(rod(k, [.9, 4.4, -2.2], [1.6, 3.9, -2.9], .018, alu, 6));
    for (const [a, b] of [[[-1.35, 7.0, -1.75], .05], [[1.6, 3.9, -2.9], .05]]) k.add(ascent, k.sphere(b, { w: 10, h: 8 }), alu, { p: a });
    g.userData.view = { az: 20, el: 12 };
    return g;
  },

  // A 1950s flying saucer: a polished silver disc, a glass dome with a little green alien waving from inside, a ring of
  // coloured lights round the rim and a tractor beam shining down, with a very surprised cow floating up it.
  saucer(k) {
    const T = k.THREE, g = k.group(), ship = k.group([], { r: [.13, 0, -.05] }); g.add(ship);
    // the hull: a lens of polished metal, seamed into panels, with a gunmetal band round the rim
    const seams = (rings, n) => k.tex(512, 256, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(70,78,92,.5)';
      for (let i = 0; i < n; i++) c.fillRect(i * w / n, 0, 2, h);
      for (const v of rings) c.fillRect(0, (1 - v) * h - 1, w, 3);
      c.fillStyle = 'rgba(70,78,92,.35)';
      for (const v of rings) for (let x = 4; x < w; x += 10) { c.beginPath(); c.arc(x, (1 - v) * h + 7, 1.4, 0, TAU); c.fill(); }
    });
    const hullTop = k.mat({ color: '#e9edf2', map: seams([.3, .62], 16), metalness: 1, roughness: .13 });
    const hullBot = k.mat({ color: '#b9c0ca', map: seams([.35, .7], 12), metalness: 1, roughness: .2 });
    k.add(ship, k.lathe([[2.02, 0], [1.98, .05], [1.85, .11], [1.5, .23], [1.1, .35], [.93, .4], [.9, .43], [0, .43]], { smooth: true, seg: 96 }), hullTop);
    k.add(ship, k.lathe([[0, -.5], [.4, -.5], [.52, -.44], [.66, -.42], [1.1, -.33], [1.55, -.2], [1.85, -.09], [1.98, -.035], [2.02, 0]], { smooth: true, seg: 96 }), hullBot);
    const gun = k.metal('#6d7480', .28);
    k.add(ship, k.torus(2.0, .075, { rs: 16, ts: 128 }), gun, { r: [Math.PI / 2, 0, 0] });
    k.add(ship, k.torus(.9, .05, { rs: 12, ts: 64 }), k.chrome(), { p: [0, .44, 0], r: [Math.PI / 2, 0, 0] });
    k.add(ship, k.torus(.5, .045, { rs: 12, ts: 48 }), gun, { p: [0, -.47, 0], r: [Math.PI / 2, 0, 0] });
    // lights all the way round the rim, each with its own soft glow
    const cols = ['#ff3b5c', '#ffcf33', '#3dff7a', '#33ccff', '#b066ff'], bulbs = [];
    for (let i = 0; i < 15; i++) {
      const a = i / 15 * TAU + .1, col = cols[i % 5], p = [Math.sin(a) * 2.07, 0, Math.cos(a) * 2.07];
      bulbs.push({ p, color: col });
      const h = halo(k, .3, col, .6); h.position.set(...p); ship.add(h);
    }
    ship.add(k.instances(k.sphere(.085, { w: 16, h: 12 }), new T.MeshBasicMaterial({ color: '#ffffff' }), bulbs));
    // the beam's lens underneath
    k.add(ship, k.disc(.42, 40), k.glow('#c8fff4', 2.4), { p: [0, -.505, 0], r: [Math.PI / 2, 0, 0] });

    // the pilot: big head, big eyes, a smile, two antennae, one hand waving
    const pilot = k.group([], { p: [0, .43, 0], r: [0, .52, 0] }); ship.add(pilot);
    const skin = k.gloss('#62d765', { rough: .3 }), eye = k.gloss('#101216', { rough: .1 }), spark = k.glow('#ffffff', 1.4);
    k.add(pilot, k.capsule(.14, .16, 12), skin, { p: [0, .2, 0] });
    k.add(pilot, k.sphere(.26, { w: 36, h: 28 }), skin, { p: [0, .56, 0], s: [1.05, 1.02, .95] });
    for (const sd of [-1, 1]) {
      k.add(pilot, k.sphere(.075, { w: 20, h: 14 }), eye, { p: [sd * .1, .58, .2], r: [.1, sd * .25, sd * -.5], s: [1, 1.5, .55] });
      k.add(pilot, k.sphere(.018, { w: 8, h: 6 }), spark, { p: [sd * .1 - .02, .63, .245] });
      k.add(pilot, k.tube([[sd * .08, .76, 0], [sd * .12, .86, .01], [sd * .19, .93, .03]], .012, { rs: 6, seg: 16 }), skin);
      k.add(pilot, k.sphere(.035, { w: 12, h: 8 }), k.glow('#fff27a', 1.6), { p: [sd * .19, .94, .03] });
    }
    k.add(pilot, k.torus(.055, .01, { rs: 6, ts: 20, arc: Math.PI }), k.matte('#1c3a1c', .6), { p: [0, .47, .235], r: [.25, 0, Math.PI] });
    k.add(pilot, k.tube([[.12, .26, .02], [.24, .38, .08], [.29, .52, .1]], .032, { rs: 8, seg: 16, caps: true }), skin);
    k.add(pilot, k.sphere(.05, { w: 12, h: 10 }), skin, { p: [.3, .56, .1] });
    // the glass dome over it all, with a couple of gleams
    const dome = k.add(ship, k.sphere(.88, { w: 48, h: 24, thetaLen: Math.PI / 2 }), k.glass('#dff8ff', { opacity: .16, env: 2 }), { p: [0, .42, 0], s: [1, 1.02, 1], shadow: false });
    dome.renderOrder = 2;
    const gleam = Object.assign(k.glow('#ffffff', 1), { transparent: true, opacity: .55, depthWrite: false, side: T.DoubleSide });
    for (const [a, l, wd] of [[.55, .9, .12], [.85, .5, .05]]) {
      const m = k.mesh(k.sphere(.885, { w: 32, h: 8, phiStart: -.3 - wd * 3, phiLen: wd * 4, thetaStart: a - l / 2, thetaLen: l }), gleam, { p: [0, .42, 0], r: [0, -.2, 0], shadow: false });
      m.renderOrder = 3; ship.add(m);
    }

    // the tractor beam: a cone of light fading as it falls, streaked, with rings running down it and motes inside
    const beamTex = k.tex(256, 256, (c, w, h) => {
      const gr = c.createLinearGradient(0, h, 0, 0);
      gr.addColorStop(0, 'rgb(255,255,255)'); gr.addColorStop(.5, 'rgb(200,200,200)'); gr.addColorStop(1, 'rgb(150,150,150)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'multiply';
      for (let x = 0; x < w; x += 4) { const v = 150 + k.rand() * 105 | 0; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(x, 0, 4, h); }
      c.globalCompositeOperation = 'lighter';
      for (const v of [.18, .42, .66]) { const y = (1 - v) * h; const rg = c.createLinearGradient(0, y - 10, 0, y + 10); rg.addColorStop(0, 'rgba(90,90,90,0)'); rg.addColorStop(.5, 'rgba(90,90,90,1)'); rg.addColorStop(1, 'rgba(90,90,90,0)'); c.fillStyle = rg; c.fillRect(0, y - 10, w, 20); }
    });
    const fade = k.tex(4, 128, (c, w, h) => { const gr = c.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.45, '#d0d0d0'); gr.addColorStop(.78, '#707070'); gr.addColorStop(1, '#000000'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, { data: true });
    const beamMat = (col, o) => new T.MeshBasicMaterial({ map: beamTex, alphaMap: fade, color: k.color(col), transparent: true, opacity: o, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
    const beam = k.group([], { p: [0, -.5, 0] }); ship.add(beam);
    const cone = (r0, r1, len) => k.lathe([[r0, 0], [lerp(r0, r1, .5), -len * .5], [r1, -len]], { seg: 64 });
    k.add(beam, cone(.42, 1.55, 2.55), beamMat('#7de9f5', .5), { shadow: false }).renderOrder = 4;
    k.add(beam, cone(.3, .95, 2.45), beamMat('#d9fff6', .32), { shadow: false }).renderOrder = 4;
    const motes = [];
    for (let i = 0; i < 26; i++) { const y = -k.range(.2, 2.3), rr = lerp(.35, 1.4, -y / 2.55) * Math.sqrt(k.rand()), a = k.rand() * TAU; motes.push({ p: [Math.cos(a) * rr, y, Math.sin(a) * rr], s: k.range(.012, .03) }); }
    const mm = k.instances(k.sphere(1, { w: 8, h: 6 }), k.glow('#eafffb', 2), motes); mm.castShadow = false; beam.add(mm);

    // the cow, drifting up the beam with its legs dangling
    const hide = k.tex(256, 128, (c, w, h) => {
      c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, h); c.fillStyle = '#1b1b1e';
      for (let i = 0; i < 9; i++) { const x = k.rand() * w, y = k.rand() * h, r = k.range(10, 26); c.beginPath(); for (let j = 0; j < 9; j++) { const a = j / 9 * TAU, rr = r * k.range(.7, 1.2); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * .8); } c.closePath(); c.fill(); }
    });
    const cow = k.group([], { p: [.08, -1.9, .12], r: [.12, -.45, .2], s: .95 }); beam.add(cow);
    const coat = k.mat({ map: hide, roughness: .7, sheen: .5, sheenColor: k.color('#ffffff') }), pink = k.plastic('#f4a3b4', { rough: .5 }), white = k.plastic('#f7f5ef', { rough: .6 });
    k.add(cow, k.box(.78, .4, .4, .15), coat);
    k.add(cow, k.box(.27, .27, .26, .1), coat, { p: [.47, .14, 0] });
    k.add(cow, k.box(.13, .16, .22, .06), pink, { p: [.62, .07, 0] });
    for (const sd of [-1, 1]) {
      k.add(cow, k.sphere(.028, { w: 10, h: 8 }), eye, { p: [.575, .2, sd * .1] });
      k.add(cow, k.cone(.03, .1, 10), k.plastic('#f1e2b8', { rough: .5 }), { p: [.44, .31, sd * .1], r: [sd * -.5, 0, 0] });
      k.add(cow, k.sphere(.06, { w: 12, h: 8 }), white, { p: [.43, .22, sd * .19], s: [.6, .45, 1.2], r: [sd * .3, 0, 0] });
    }
    const legs = [], hooves = [];
    for (const [x, z] of [[.26, .12], [.26, -.12], [-.26, .12], [-.26, -.12]]) { legs.push({ p: [x, -.3, z] }); hooves.push({ p: [x, -.46, z] }); }
    cow.add(k.instances(k.cyl(.055, .05, .3, { seg: 12 }), coat, legs));
    cow.add(k.instances(k.cyl(.05, .055, .06, { seg: 12 }), k.matte('#2a2320', .6), hooves));
    k.add(cow, k.sphere(.08, { w: 14, h: 10 }), pink, { p: [-.22, -.2, 0], s: [1, .7, 1] });
    k.add(cow, k.tube([[-.39, .1, 0], [-.46, -.02, .02], [-.48, -.18, .05]], .014, { rs: 6, seg: 16 }), white);
    k.add(cow, k.sphere(.04, { w: 10, h: 8 }), k.matte('#1b1b1e', .7), { p: [-.48, -.21, .05], s: [1, 1.4, 1] });
    g.userData.floating = true;
    g.userData.view = { az: 30, el: 14 };
    return g;
  },

  // A lunar roving vehicle: an open aluminium frame, four wire-mesh wheels with chevron treads under gold-orange
  // fenders, two webbed seats with lap belts, the console and T-handle between them, the umbrella dish on its mast,
  // and a little TV camera up front.
  moonbuggy(k) {
    const T = k.THREE, g = k.group();
    const alu = k.metal('#cdd1d7', .34), dim = k.metal('#8d939c', .4), rubber = k.rubber('#1f2024');
    const WX = .915, WZ = 1.145, WR = .41;
    // the wheels: a see-through woven wire tyre with titanium chevrons, an inner frame and a spun hub
    const meshTex = k.tex(1024, 96, (c, w, h) => {
      c.fillStyle = '#1a1a1a'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#bdbdbd'; c.lineWidth = 2;
      for (let x = -h; x < w + h; x += 12) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + h, h); c.stroke(); c.beginPath(); c.moveTo(x, h); c.lineTo(x + h, 0); c.stroke(); }
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 24; i++) {   // chevrons: a V of titanium strips across the tread
        const x = (i + .5) * w / 24, a = w / 24 * .28;
        c.beginPath(); c.moveTo(x - a, h * .1); c.lineTo(x + a * .3, h * .5); c.lineTo(x - a, h * .9); c.lineTo(x - a * .45, h * .9); c.lineTo(x + a * .85, h * .5); c.lineTo(x - a * .45, h * .1); c.closePath(); c.fill();
      }
      c.fillRect(0, 0, w, h * .07); c.fillRect(0, h * .93, w, h * .07);
    }, { data: true });
    const tyreMat = k.mat({ color: '#d4d8de', metalness: .85, roughness: .38, alphaMap: meshTex, transparent: true, side: T.DoubleSide, alphaTest: .05 });
    const tyre = k.lathe([[WR - .045, -.12], [WR - .012, -.105], [WR, -.06], [WR + .004, 0], [WR, .06], [WR - .012, .105], [WR - .045, .12]], { seg: 64 });
    const hub = k.lathe([[0, .1], [.12, .1], [.2, .085], [.27, .06], [.3, .04], [.3, 0], [0, 0]], { seg: 40 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const wh = k.group([], { p: [sx * WX, WR, sz * WZ] }); g.add(wh);
      k.add(wh, tyre, tyreMat, { r: [0, 0, Math.PI / 2], shadow: false });
      k.add(wh, k.cyl(.3, .3, .2, { seg: 32, open: true }), k.metal('#50555d', .5, { side: T.DoubleSide }), { r: [0, 0, Math.PI / 2] });
      k.add(wh, hub, alu, { p: [sx * .02, 0, 0], r: [0, 0, sx * -Math.PI / 2] });
      k.add(wh, k.cyl(.09, .09, .16, { seg: 20 }), dim, { p: [-sx * .1, 0, 0], r: [0, 0, Math.PI / 2] });
      // the fender over the top: gold-orange, open underneath
      k.add(wh, k.cyl(WR + .07, WR + .07, .3, { open: true, start: -Math.PI / 2 - 1.25, len: 2.5, seg: 40 }), k.plastic('#e8861f', { rough: .38, coat: .45, side: T.DoubleSide }), { p: [sx * .01, 0, 0], r: [0, 0, -Math.PI / 2] });
    }
    // the chassis: two side rails and cross tubes, suspension arms out to each wheel, a floor under the seats
    const tubes = [], rail = (a, b, r = .022) => tubes.push(span(k, a, b, r));
    for (const sx of [-1, 1]) {
      rail([sx * .56, .52, -1.5], [sx * .56, .52, 1.5], .028);
      rail([sx * .56, .52, -.62], [sx * .56, .74, -.66]); rail([sx * .56, .52, .62], [sx * .56, .74, .66]);
      for (const sz of [-1, 1]) {
        rail([sx * .56, .55, sz * (WZ - .14)], [sx * (WX - .12), WR + .07, sz * WZ], .02);
        rail([sx * .56, .45, sz * (WZ + .14)], [sx * (WX - .12), WR - .05, sz * WZ], .02);
      }
    }
    for (const z of [-1.5, -1.0, -.62, .62, 1.0, 1.5]) rail([-.56, .52, z], [.56, .52, z], .022);
    g.add(k.instances(k.cyl(1, 1, 1, { seg: 10 }), alu, tubes));
    const floorTex = k.tex(128, 128, (c, w, h) => { c.fillStyle = '#9da3ab'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 8) { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x, 0, 2, h); c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x + 3, 0, 2, h); } }, { repeat: [3, 1] });
    k.add(g, k.box(1.12, .025, 1.24, .01), k.mat({ map: floorTex, metalness: .7, roughness: .45 }), { p: [0, .5, 0] });
    // the front: electronics under a white blanket, the relay box, the TV camera, the low- and high-gain antennas
    const blanket = k.fabric('#eef0f2', { sheen: '#ffffff' });
    k.add(g, k.box(1.1, .12, .8, .04), blanket, { p: [0, .6, 1.08] });
    k.add(g, k.box(.4, .24, .3, .04), blanket, { p: [0, .78, 1.3] });
    k.add(g, k.box(.42, .02, .32, .005), k.chrome(), { p: [0, .905, 1.3] });
    const cam = k.group([], { p: [.28, .66, 1.42] }); g.add(cam);
    k.add(cam, k.cyl(.02, .02, .5, { seg: 8 }), alu, { p: [0, .25, 0] });
    k.add(cam, k.box(.14, .15, .26, .03), k.plastic('#f2f2ee', { rough: .45 }), { p: [0, .56, .02] });
    k.add(cam, k.cyl(.045, .05, .1, { seg: 20 }), k.matte('#1b1c20', .4), { p: [0, .56, .19], r: [Math.PI / 2, 0, 0] });
    k.add(cam, k.disc(.038, 20), k.mat({ color: '#12202e', roughness: .05, metalness: .4, clearcoat: 1 }), { p: [0, .56, .241] });
    k.add(cam, k.box(.18, .02, .2, .005), k.plastic('#f2f2ee', { rough: .45 }), { p: [0, .65, .06] });
    g.add(rod(k, [.52, .6, 1.38], [.52, 1.35, 1.38], .018, alu, 8));
    k.add(g, k.cyl(.035, .035, .28, { seg: 12 }), k.plastic('#f2f2ee', { rough: .4 }), { p: [.52, 1.42, 1.38] });
    // the high-gain dish: an upside-down umbrella of silver mesh on a tall mast
    const hga = k.group([], { p: [-.46, .6, 1.34] }); g.add(hga);
    k.add(hga, k.cyl(.025, .025, 1.2, { seg: 10 }), alu, { p: [0, .6, 0] });
    const head = k.group([], { p: [0, 1.22, 0], r: [-.5, 0, .35] }); hga.add(head);
    const umb = k.tex(256, 64, (c, w, h) => { c.fillStyle = '#6a6a6a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; for (let x = 0; x < w; x += 5) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 5) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } }, { data: true });
    k.add(head, k.lathe([[0, 0], [.1, .004], [.22, .02], [.34, .05], [.46, .1]], { seg: 48 }), k.mat({ color: '#e2e5ea', metalness: .9, roughness: .3, alphaMap: umb, transparent: true, side: T.DoubleSide }), { shadow: false });
    const ribs = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ribs.push(span(k, [0, 0, 0], [Math.sin(a) * .47, .1, Math.cos(a) * .47], .007)); }
    head.add(k.instances(k.cyl(1, 1, 1, { seg: 6 }), alu, ribs));
    k.add(head, k.torus(.46, .008, { rs: 6, ts: 48 }), alu, { p: [0, .1, 0], r: [Math.PI / 2, 0, 0] });
    k.add(head, k.cyl(.012, .012, .3, { seg: 8 }), alu, { p: [0, .15, 0] });
    k.add(head, k.cone(.04, .07, 12), k.gold(), { p: [0, .32, 0], r: [Math.PI, 0, 0] });
    // two seats: tube frames with woven webbing, a lap belt across each
    const web = k.tex(128, 128, (c, w, h) => {
      c.fillStyle = '#5d6f88'; c.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 16) { c.fillStyle = '#9fb1c9'; c.fillRect(x + 1, 0, 13, h); }
      for (let y = 0; y < h; y += 16) { c.fillStyle = 'rgba(160,178,202,.85)'; c.fillRect(0, y + 1, w, 13); }
      for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) if ((x + y) / 16 % 2) { c.fillStyle = 'rgba(90,100,118,.35)'; c.fillRect(x + 1, y + 1, 13, 13); }
    }, { repeat: [2, 2] });
    const webMat = k.mat({ map: web, roughness: .9, sheen: .6, sheenColor: k.color('#ffffff') });
    const seatTubes = [];
    for (const sx of [-1, 1]) {
      const x0 = sx * .33, st = k.group([], { p: [x0, .64, -.02] }); g.add(st);
      k.add(st, k.box(.44, .025, .44, .008), webMat);
      k.add(st, k.box(.44, .46, .025, .008), webMat, { p: [0, .24, -.25], r: [-.25, 0, 0] });
      for (const ex of [-.23, .23]) {
        seatTubes.push(span(k, [x0 + ex, .64, .22], [x0 + ex, .64, -.24], .016));
        seatTubes.push(span(k, [x0 + ex, .64, -.24], [x0 + ex, 1.1, -.36], .016));
        seatTubes.push(span(k, [x0 + ex, .52, .18], [x0 + ex, .64, .18], .014));
      }
      seatTubes.push(span(k, [x0 - .23, 1.1, -.36], [x0 + .23, 1.1, -.36], .016), span(k, [x0 - .23, .64, .22], [x0 + .23, .64, .22], .016));
      // the lap belt: a flat strap lying across the seat with a buckle in the middle
      k.add(st, k.tube([[-.24, .03, -.05], [-.12, .045, -.02], [0, .05, -.01], [.12, .045, -.02], [.24, .03, -.05]], .018, { rs: 8, seg: 24 }), k.fabric('#f4f4f0', { weave: false }), { s: [1, .35, 1] });
      k.add(st, k.box(.07, .018, .05, .006), k.chrome(), { p: [0, .052, -.01] });
    }
    g.add(k.instances(k.cyl(1, 1, 1, { seg: 10 }), alu, seatTubes));
    // the console on its post, the T-handle between the seats, and the armrest
    const con = k.group([], { p: [0, .9, .58], r: [-.5, 0, 0] }); g.add(con);
    k.add(con, k.box(.44, .28, .09, .02), k.plastic('#3c4049', { rough: .5 }));
    k.add(con, k.box(.4, .24, .01, .004), k.painted(128, 80, (c, w, h) => {
      c.fillStyle = '#23262c'; c.fillRect(0, 0, w, h);
      for (const [x, y] of [[.2, .35], [.5, .35], [.8, .35]]) { c.strokeStyle = '#e8ecf0'; c.lineWidth = 3; c.beginPath(); c.arc(x * w, y * h, 13, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(x * w, y * h); c.lineTo(x * w + 8, y * h - 8); c.stroke(); }
      for (let i = 0; i < 6; i++) { c.fillStyle = ['#ff5a4a', '#ffd23f', '#40ff90'][i % 3]; c.fillRect(w * (.12 + i * .14), h * .75, 8, 6); }
    }, { glow: .4 }), { p: [0, 0, -.05], r: [0, Math.PI, 0] });
    k.add(con, k.cyl(.07, .07, .015, { seg: 20 }), k.chrome(), { p: [0, .15, 0] });
    k.add(con, k.cone(.012, .08, 8), k.matte('#1b1c20', .5), { p: [0, .19, 0] });
    g.add(rod(k, [0, .52, .62], [0, .82, .6], .025, alu, 10));
    g.add(rod(k, [0, .52, .2], [0, .92, .2], .02, alu, 8));
    k.add(g, k.box(.09, .06, .1, .02), k.plastic('#3c4049', { rough: .5 }), { p: [0, .94, .2] });
    k.add(g, k.cyl(.024, .024, .14, { seg: 12 }), rubber, { p: [0, 1.03, .2] });
    k.add(g, k.capsule(.022, .16, 8), rubber, { p: [0, 1.1, .2], r: [0, 0, Math.PI / 2] });
    // the back: a tool rack with a sample bag and a scoop and tongs standing up
    k.add(g, k.box(1.0, .05, .7, .02), dim, { p: [0, .58, -1.12] });
    k.add(g, k.box(.4, .22, .3, .04), k.fabric('#e8e4d6', { weave: false }), { p: [-.22, .72, -1.15] });
    for (const [x, tilt] of [[.15, .12], [.3, -.1]]) g.add(rod(k, [x, .6, -1.25], [x + tilt, 1.25, -1.3], .014, alu, 8));
    k.add(g, k.box(.1, .03, .12, .01), alu, { p: [.27, 1.26, -1.3], r: [.3, 0, -.1] });
    g.userData.view = { az: 32, el: 20 };
    return g;
  },

  // A Curiosity-style Mars rover: six wheels on rocker-bogie legs, a boxy white body with the finned power unit sloping
  // off the back, a tall mast whose camera head tilts to look at you, and its arm drilling a rock. Dusty red below.
  rover(k) {
    const T = k.THREE, g = k.group(), nz = noise2(k);
    const seamed = k.tex(256, 128, (c, w, h) => {
      c.fillStyle = '#eceae4'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(90,90,100,.28)'; for (const x of [0, w * .33, w * .66]) c.fillRect(x, 0, 2, h); c.fillRect(0, h * .5, w, 2);
      c.fillStyle = 'rgba(90,90,100,.22)'; for (let x = 6; x < w; x += 12) { c.beginPath(); c.arc(x, h * .5 + 6, 1.2, 0, TAU); c.fill(); }
    });
    const white = dusty(k, k.plastic('#ffffff', { rough: .5, coat: .2, map: seamed })), grey = dusty(k, k.metal('#a9adb3', .42));
    const deck = k.metal('#9ea3aa', .4);
    const tube = dusty(k, k.metal('#c4c7cc', .35)), dark = k.plastic('#35373d', { rough: .5 }), alu = dusty(k, k.metal('#a7abb2', .4));
    const goldFoil = foilMaps(k, ['#d9a13a', '#e8b54c', '#c98d2b', '#f0c25a'], { facets: 160, seams: 2 });
    const foil = k.mat({ map: goldFoil.map, bumpMap: goldFoil.bump, bumpScale: 2, metalness: 1, roughness: .3 });
    const lens = k.mat({ color: '#0c1118', roughness: .05, metalness: .5, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 2 });
    const spark = k.glow('#ffffff', 1.5);
    // wheels: ridged aluminium drums with chevron treads, curved spokes on the outer face
    const WR = .26, WW = .4, XW = 1.12, wheelsAt = [1.12, .08, -.98];
    const drum = k.lathe([[WR - .03, -WW / 2], [WR, -WW / 2 + .02], [WR, WW / 2 - .02], [WR - .03, WW / 2]], { seg: 48 });
    const spokes = k.painted(256, 256, (c, w, h) => {
      c.fillStyle = '#26282d'; c.beginPath(); c.arc(w / 2, h / 2, w / 2, 0, TAU); c.fill();
      c.strokeStyle = '#b9bdc3'; c.lineWidth = 12; c.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.beginPath(); c.moveTo(w / 2 + Math.cos(a) * 28, h / 2 + Math.sin(a) * 28); c.quadraticCurveTo(w / 2 + Math.cos(a + .7) * 80, h / 2 + Math.sin(a + .7) * 80, w / 2 + Math.cos(a + .35) * 118, h / 2 + Math.sin(a + .35) * 118); c.stroke(); }
      c.fillStyle = '#c9ccd1'; c.beginPath(); c.arc(w / 2, h / 2, 34, 0, TAU); c.fill();
      c.strokeStyle = '#8b9097'; c.lineWidth = 6; c.beginPath(); c.arc(w / 2, h / 2, 118, 0, TAU); c.stroke();
    }, { transparent: true, rough: .5, metal: .3 });
    const grousers = [];
    for (const sx of [-1, 1]) for (const z of wheelsAt) {
      k.add(g, drum, alu, { p: [sx * XW, WR, z], r: [0, 0, Math.PI / 2] });
      k.add(g, k.disc(WR - .025, 40), dusty(k, spokes.clone()), { p: [sx * (XW + WW / 2 - .04), WR, z], r: [0, sx * Math.PI / 2, 0] });
      k.add(g, k.cyl(.07, .07, .1, { seg: 16 }), grey, { p: [sx * (XW - WW / 2 - .02), WR, z], r: [0, 0, Math.PI / 2] });
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * TAU, yy = WR + Math.cos(a) * (WR + .004), zz = z + Math.sin(a) * (WR + .004);
        for (const side of [-1, 1]) grousers.push({ p: [sx * XW + side * .085, yy, zz], r: [a, side * .38, 0], s: [.17, .018, .014] });
      }
    }
    g.add(k.instances(k.box(1, 1, 1), k.metal('#c7a48a', .3), grousers));
    // rocker-bogie legs down each side: the rocker pivots on the body, the bogie hangs off its back end
    const legs = [], joints = [];
    for (const sx of [-1, 1]) {
      const X = x => sx * x, piv = [X(.8), .98, .3], bog = [X(.88), .64, -.42];
      const fTop = [X(1.0), .66, 1.12], mTop = [X(.93), .5, .08], rTop = [X(1.0), .66, -.98];
      const kneeF = [X(.9), .9, .85], kneeR = [X(.9), .64, -.84];
      legs.push(span(k, piv, kneeF, .036), span(k, kneeF, fTop, .036), span(k, piv, bog, .036), span(k, bog, mTop, .032), span(k, bog, kneeR, .032), span(k, kneeR, rTop, .032));
      for (const t of [fTop, rTop]) { legs.push(span(k, t, [t[0], WR + .02, t[2]], .03)); joints.push({ p: [t[0], t[1] + .04, t[2]], s: [.07, .12, .07] }); }
      legs.push(span(k, mTop, [X(.93), WR, .08], .03));
      joints.push({ p: piv, r: [0, 0, Math.PI / 2], s: [.1, .12, .1] }, { p: bog, r: [0, 0, Math.PI / 2], s: [.08, .1, .08] });
    }
    g.add(k.instances(k.cyl(1, 1, 1, { seg: 12 }), tube, legs));
    g.add(k.instances(k.cyl(1, 1, 1, { seg: 16 }), grey, joints));
    // the body: a warm white box with a grey deck, hazard cameras peering out of the front like a second pair of eyes
    k.add(g, k.box(1.36, .5, 1.86, .06), white, { p: [0, .93, .08] });
    k.add(g, k.box(1.5, .05, 2.04, .02), deck, { p: [0, 1.2, .06] });
    k.add(g, k.box(.5, .22, .44, .04), k.plastic('#e4e2dc', { rough: .5 }), { p: [.25, 1.34, .72] });
    k.add(g, k.box(.36, .12, .5, .03), k.plastic('#d8d6d0', { rough: .5 }), { p: [-.3, 1.28, .3] });
    for (const sx of [-.3, .3]) for (const dx of [-.06, .06]) {
      k.add(g, k.cyl(.035, .035, .04, { seg: 16 }), dark, { p: [sx + dx, .76, 1.02], r: [Math.PI / 2 - .3, 0, 0] });
      k.add(g, k.sphere(.028, { w: 12, h: 8 }), lens, { p: [sx + dx, .763, 1.037], s: [1, 1, .5] });
    }
    // on the deck: sample inlets with gold lids, a foil-wrapped box, the flat hexagonal dish, the UHF and low-gain antennas
    for (const [x, z] of [[.18, .35], [.34, .35]]) { k.add(g, k.cyl(.06, .06, .08, { seg: 16 }), grey, { p: [x, 1.3, z] }); k.add(g, k.cyl(.065, .065, .02, { seg: 16 }), foil, { p: [x, 1.35, z] }); }
    k.add(g, k.box(.4, .16, .32, .03), foil, { p: [.2, 1.34, -.2] });
    const hga = k.group([], { p: [-.42, 1.26, -.3] }); g.add(hga);
    k.add(hga, k.cyl(.04, .05, .18, { seg: 12 }), grey, { p: [0, .09, 0] });
    k.add(hga, k.cyl(.2, .2, .04, { seg: 6 }), k.plastic('#4a4d55', { rough: .45 }), { p: [0, .22, 0], r: [.5, 0, -.3] });
    k.add(g, k.cyl(.05, .05, .22, { seg: 12 }), white, { p: [-.52, 1.37, -.78] });
    k.add(g, k.cyl(.02, .045, .3, { seg: 12 }), grey, { p: [-.12, 1.42, -.78] });
    // the power unit: a finned drum sloping up off the back
    const rtg = k.group([], { p: [0, 1.1, -1.22], r: [-.85, 0, 0] }); g.add(rtg);
    k.add(rtg, k.cyl(.13, .13, .66, { seg: 24 }), k.metal('#8d9097', .4));
    const fins = [];
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; fins.push({ p: [Math.sin(a) * .2, 0, Math.cos(a) * .2], r: [0, a, 0], s: [.012, .62, .15] }); }
    rtg.add(k.instances(k.box(1, 1, 1), k.plastic('#3a3c42', { rough: .55 }), fins));
    for (const y of [-.34, .34]) k.add(rtg, k.cyl(.17, .17, .04, { seg: 24 }), k.metal('#b7bac0', .35), { p: [0, y, 0] });
    g.add(rod(k, [0, 1.0, -.95], [0, .98, -1.1], .06, grey, 12));
    // the mast and its head: a big round lens on top, two camera eyes below, tilted to look at you
    const mx = .46, mz = .8;
    k.add(g, k.cyl(.09, .1, .08, { seg: 20 }), grey, { p: [mx, 1.3, mz] });
    k.add(g, k.cyl(.055, .055, .74, { seg: 16 }), white, { p: [mx, 1.68, mz] });
    k.add(g, k.cyl(.075, .075, .1, { seg: 16 }), grey, { p: [mx, 2.06, mz] });
    const head = k.group([], { p: [mx, 2.2, mz], r: [-.12, .55, .16], order: 'YXZ' }); g.add(head);
    k.add(head, k.box(.4, .2, .24, .04), k.plastic('#f1efe9', { rough: .45, coat: .3 }));
    k.add(head, k.box(.16, .1, .06, .02), k.plastic('#f1efe9', { rough: .45, coat: .3 }), { p: [0, .13, .02] });
    k.add(head, k.cyl(.07, .07, .04, { seg: 24 }), dark, { p: [0, .13, .06], r: [Math.PI / 2, 0, 0] });
    k.add(head, k.sphere(.058, { w: 20, h: 14 }), lens, { p: [0, .13, .075], s: [1, 1, .4] });
    for (const sx of [-1, 1]) {
      k.add(head, k.cyl(.052, .052, .05, { seg: 20 }), dark, { p: [sx * .085, -.015, .12], r: [Math.PI / 2, 0, 0] });
      k.add(head, k.sphere(.042, { w: 20, h: 14 }), lens, { p: [sx * .085, -.015, .143], s: [1, 1, .45] });
      k.add(head, k.sphere(.012, { w: 8, h: 6 }), spark, { p: [sx * .085 - .015, 0, .16] });
      for (const dy of [-.04, .04]) k.add(head, k.sphere(.02, { w: 10, h: 8 }), lens, { p: [sx * .2, dy, .07], s: [.5, 1, 1] });
    }
    // the arm, reaching out front to drill into a rock
    const sh = [-.36, 1.0, 1.05], el = [-.4, 1.36, 1.62], wr = [-.44, .62, 2.02];
    g.add(rod(k, sh, el, .05, white, 14), rod(k, el, wr, .045, white, 14));
    for (const j of [sh, el, wr]) k.add(g, k.cyl(.075, .075, .14, { seg: 18 }), grey, { p: j, r: [0, 0, Math.PI / 2] });
    const tur = k.group([], { p: [-.44, .5, 2.05] }); g.add(tur);
    k.add(tur, k.cyl(.1, .1, .16, { seg: 20 }), grey, { r: [0, 0, Math.PI / 2] });
    k.add(tur, k.cyl(.03, .012, .24, { seg: 12 }), k.metal('#6d7178', .3), { p: [0, -.2, 0] });
    k.add(tur, k.box(.1, .12, .14, .02), foil, { p: [0, .12, -.04] });
    k.add(tur, k.cyl(.05, .05, .12, { seg: 16 }), white, { p: [0, 0, .14], r: [Math.PI / 2, 0, 0] });
    k.add(tur, k.box(.09, .09, .11, .02), dark, { p: [0, .02, -.15] });
    k.add(tur, k.sphere(.03, { w: 12, h: 8 }), lens, { p: [0, .02, -.21], s: [1, 1, .5] });
    // the rock it's drilling, with a little heap of powder
    const rockGeo = k.sphere(.2, { w: 32, h: 20 }), rp = rockGeo.attributes.position;
    for (let i = 0; i < rp.count; i++) {
      const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i), f = 1 + .3 * nz(x * 6 + 3, z * 6 + y * 4) + .08 * nz(x * 25, y * 25 + z * 20);
      rp.setXYZ(i, x * f * 1.25, Math.max(-.02, y * f * .8), z * f * 1.05);
    }
    rockGeo.computeVertexNormals();
    k.add(g, rockGeo, k.mat({ color: '#6e4432', roughness: .95, flatShading: true, bumpMap: k.tex(128, 128, (c, w, h) => { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const v = k.rand() * 255 | 0; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(k.rand() * w, k.rand() * h, 2, 2); } }, { data: true }), bumpScale: 2 }), { p: [-.44, .12, 2.06] });
    k.add(g, k.cone(.1, .05, 16), k.matte('#c77a48', 1), { p: [-.44, .3, 2.06] });
    settleDust(k, g, v => clamp01(1.05 * (1 - smooth(.3, 1.0, v.y)) * (.84 + .28 * nz(v.x * 5 + 7, v.z * 5 + v.y * 3))));
    g.userData.view = { az: 30, el: 16 };
    return g;
  },
};

