// Outer Space models: wonders. The rarest cards in the set, each one a light show: the Golden Record sliding out of its
// engraved cover with the stylus that plays it, a Great Comet streaming its twin tails, a Nebula's pillars where new
// stars are born, a Supernova tearing itself apart and a Wormhole with another galaxy at the far end of its throat.
// Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.
// As in stars.js, most of the light here is made, not lit: unlit and additive surfaces, sprites and instanced glows,
// with the light kept in the alpha channel (the studio renders onto a clear canvas). The studio frames a model by its
// meshes and ignores sprites, so the biggest glows are sprites that spill out over the whole card. And because the
// card paints a burst of light behind a mythic's or legend's picture, glowing gas is laid down twice: its own colour
// over what's behind it (normal blending, so the burst can't bleach it), then its light added on top.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// Polynomial smooth minimum and maximum: like Math.min/max, but rounded over a blend of width w.
const smin = (a, b, w) => { const h = clamp(.5 + .5 * (b - a) / w); return lerp(b, a, h) - w * h * (1 - h); };
const smax = (a, b, w) => -smin(-a, -b, w);
const hex = s => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
const mixC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
// A colour ramp: stops [[t, [r, g, b]], ...], read at t into out.
function ramp(stops, t, out) {
  let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [t0, c0] = stops[i], [t1, c1] = stops[i + 1], f = clamp((t - t0) / (t1 - t0));
  out[0] = lerp(c0[0], c1[0], f); out[1] = lerp(c0[1], c1[1], f); out[2] = lerp(c0[2], c1[2], f);
  return out;
}
const stopsOf = list => list.map(([t, c]) => [t, hex(c)]);
// A seeded random source for painting: painted canvases are cached, so painting mustn't use up the model's k.rand().
function rng(seed) { return () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// An integer to a steady random number in [0, 1).
const hash1 = n => { let h = Math.imul(n | 0, 374761393) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// About normally distributed, from the model's own random numbers.
const gauss = k => (k.rand() + k.rand() + k.rand() + k.rand() - 2) * 1.73;
const randDir = k => { const z = k.range(-1, 1), a = k.range(0, TAU), s = Math.sqrt(1 - z * z); return new k.THREE.Vector3(s * Math.cos(a), z, s * Math.sin(a)); };

// Seeded gradient noise in 2D and 3D (about -1..1), and a few octaves of each.
function makeNoise(seed) {
  const R = rng(seed), p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const P = new Uint8Array(512); for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const GX = [1, -1, 0, 0, .7071, -.7071, .7071, -.7071], GY = [0, 0, 1, -1, .7071, .7071, -.7071, -.7071];
  const n2 = (x, y) => {
    let X = Math.floor(x), Y = Math.floor(y); x -= X; y -= Y; X &= 255; Y &= 255;
    const a = P[P[X] + Y] & 7, b = P[P[X + 1] + Y] & 7, c = P[P[X] + Y + 1] & 7, d = P[P[X + 1] + Y + 1] & 7, u = fade(x), v = fade(y);
    const e = GX[a] * x + GY[a] * y, f = GX[b] * (x - 1) + GY[b] * y, g = GX[c] * x + GY[c] * (y - 1), h = GX[d] * (x - 1) + GY[d] * (y - 1);
    const i = e + u * (f - e), j = g + u * (h - g);
    return (i + v * (j - i)) * 1.41;
  };
  const gr = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
  const n3 = (x, y, z) => {
    let X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    x -= X; y -= Y; z -= Z; X &= 255; Y &= 255; Z &= 255;
    const u = fade(x), v = fade(y), w = fade(z);
    const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
    const g0 = gr(P[AA], x, y, z), g1 = gr(P[BA], x - 1, y, z), g2 = gr(P[AB], x, y - 1, z), g3 = gr(P[BB], x - 1, y - 1, z);
    const g4 = gr(P[AA + 1], x, y, z - 1), g5 = gr(P[BA + 1], x - 1, y, z - 1), g6 = gr(P[AB + 1], x, y - 1, z - 1), g7 = gr(P[BB + 1], x - 1, y - 1, z - 1);
    const a = g0 + u * (g1 - g0), b = g2 + u * (g3 - g2), c = g4 + u * (g5 - g4), d = g6 + u * (g7 - g6);
    const e = a + v * (b - a), f = c + v * (d - c);
    return e + w * (f - e);
  };
  const fbm2 = (x, y, oct = 4) => { let s = 0, a = 1, t = 0; for (let i = 0; i < oct; i++) { s += a * n2(x, y); t += a; a *= .5; x = x * 2.03 + 17.1; y = y * 2.03 + 5.3; } return s / t; };
  const fbm3 = (x, y, z, oct = 4) => { let s = 0, a = 1, t = 0; for (let i = 0; i < oct; i++) { s += a * n3(x, y, z); t += a; a *= .5; x = x * 2.03 + 17.1; y *= 2.03; z = z * 2.03 + 5.3; } return s / t; };
  return { n2, n3, fbm2, fbm3 };
}
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
// A soft copy of a w × h field: box blurs of radius r, twice each way (close to a gaussian).
function boxBlur(src, w, h, r) {
  const a = new Float32Array(src), b = new Float32Array(src.length), n = 2 * r + 1;
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < h; j++) {
      const row = j * w; let s = 0;
      for (let i = -r; i <= r; i++) s += a[row + clamp(i, 0, w - 1)];
      for (let i = 0; i < w; i++) { b[row + i] = s / n; s += a[row + Math.min(w - 1, i + r + 1)] - a[row + Math.max(0, i - r)]; }
    }
    for (let i = 0; i < w; i++) {
      let s = 0;
      for (let j = -r; j <= r; j++) s += b[clamp(j, 0, h - 1) * w + i];
      for (let j = 0; j < h; j++) { a[j * w + i] = s / n; s += b[Math.min(h - 1, j + r + 1) * w + i] - b[Math.max(0, j - r) * w + i]; }
    }
  }
  return a;
}
// Give vertices that share a position one shared normal, so seams don't show.
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
// One view for the card art and the full art alike (so what faces the camera keeps facing it, and the full art doesn't
// stand things up in its hero pose), with extra framing for the full art. Everything in this file floats.
function setView(g, v, full = {}) {
  g.userData.view = { ...v };
  g.userData.fullView = { az: v.az, el: v.el, ...full };
  g.userData.floating = true;
}

/* ---------- light ---------- */
// Glows, white with the light in the alpha: 'soft' a gentle haze, 'star' a hot core with a long faint skirt, 'dot' a
// small tight point, 'flare' a four-pointed twinkle, 'flare6' a big telescope's six-pointed star, 'ray' a beam from its
// root (the bottom of the texture) out, 'streak' a flat lens streak, 'bolt' a glowing fleck with its trail behind it.
const spike = (a, b, len, wd) => { const t = Math.abs(a) / len; return t >= 1 ? 0 : Math.exp(-((b / (wd * (1 - t * .75))) ** 2)) * (1 - t) ** 2.2; };
const GLOW = {
  soft: (X, Y, r) => Math.exp(-r * r * 3.4),
  star: (X, Y, r) => .85 * Math.exp(-r * r * 90) + .4 * Math.exp(-r * r * 14) + .16 * Math.exp(-r * 3.2),
  dot: (X, Y, r) => .75 * Math.exp(-r * r * 28) + .3 * Math.exp(-r * r * 6),
  flare: (X, Y, r) => {
    const D = Math.SQRT1_2;
    return spike(X, Y, 1, .03) + spike(Y, X, 1, .03) + .35 * (spike((X + Y) * D, (X - Y) * D, .42, .022) + spike((X - Y) * D, (X + Y) * D, .42, .022))
      + .9 * Math.exp(-r * r * 80) + .22 * Math.exp(-r * r * 12);
  },
  flare6: (X, Y, r) => {
    let s = spike(Y, X, 1, .026) + .28 * spike(X, Y, .42, .018);
    for (const a of [Math.PI / 6, -Math.PI / 6]) { const c = Math.cos(a), sn = Math.sin(a); s += spike(X * c + Y * sn, -X * sn + Y * c, .85, .024); }
    return s + .9 * Math.exp(-r * r * 80) + .25 * Math.exp(-r * r * 12);
  },
};
function glowTex(k, kind = 'soft') {
  let w = kind === 'dot' ? 64 : 256, h = w, paint;
  if (kind === 'ray') {
    w = 64; paint = (u, v, o) => {
      const x = u * 2 - 1, wd = .55 - .4 * v;
      o[3] = (Math.pow(1 - v, 1.4) * Math.exp(-((x / wd) ** 2) * 3) + .5 * Math.pow(1 - v, 2.5) * Math.exp(-((x / (wd * .22)) ** 2))) * smooth(1, .9, Math.abs(x));
    };
  } else if (kind === 'streak') {
    h = 32; paint = (u, v, o) => { const x = u * 2 - 1, y = v * 2 - 1; o[3] = Math.pow(1 - Math.abs(x), 2.2) * (.6 * Math.exp(-y * y * 9) + .6 * Math.exp(-y * y * 60)) * smooth(1, .8, Math.abs(y)); };
  } else if (kind === 'bolt') {
    w = 128; h = 32; paint = (u, v, o) => {
      const y = v * 2 - 1;
      o[3] = (.8 * Math.pow(u, 2.4) * Math.exp(-y * y * 6 / (.3 + .7 * u)) + Math.exp(-(((u - .82) / .1) ** 2) - y * y * 12)) * smooth(1, .92, u) * smooth(1, .85, Math.abs(y));
    };
  } else paint = (u, v, o) => { const X = u * 2 - 1, Y = v * 2 - 1, r = Math.hypot(X, Y); o[3] = GLOW[kind](X, Y, r) * smooth(1, .82, r); };
  return k.tex(w, h, (c, W, H) => pixels(c, W, H, (u, v, o) => { o[0] = o[1] = o[2] = 1; paint(u, v, o); }), { cache: `space-wonders:${kind}` });
}
// A soft line across v (for ribbons and rings that glow along their length).
const lineTex = k => k.tex(16, 64, (c, w, h) => pixels(c, w, h, (u, v, o) => { const x = v * 2 - 1; o[0] = o[1] = o[2] = 1; o[3] = (1 - x * x) ** 2 * (.55 * Math.exp(-x * x * 4) + .5 * Math.exp(-x * x * 30)); }), { cache: 'space-wonders:line' });
// A glow that always faces the camera, added onto whatever is behind it. Sprites don't count when the studio frames the
// model. o: { map (its own picture), rot, sx, sy (stretch), center ([.5, 0] to hang it from its bottom edge), order,
// normal (lay its colour over what's behind instead of adding light: the burst of light behind a mythic or legend's
// picture would bleach a glow that only adds) }
function halo(k, r, color, opacity = .5, kind = 'soft', p = [0, 0, 0], o = {}) {
  const T = k.THREE, s = new T.Sprite(new T.SpriteMaterial({ map: o.map ?? glowTex(k, kind), color: k.color(color), transparent: true, opacity,
    depthWrite: false, blending: o.normal ? T.NormalBlending : T.AdditiveBlending, rotation: o.rot ?? 0 }));
  s.scale.set(r * 2 * (o.sx ?? 1), r * 2 * (o.sy ?? 1), 1); s.position.set(p[0], p[1], p[2]);
  if (o.center) s.center.set(o.center[0], o.center[1]);
  if (o.order != null) s.renderOrder = o.order;
  return s;
}
// A beam of light from p out at angle a (in the picture: radians anticlockwise from the right), len long, wd wide.
const ray = (k, p, a, len, wd, color, opacity, order) => halo(k, 1, color, opacity, 'ray', p, { rot: a - Math.PI / 2, sx: wd / 2, sy: len / 2, center: [.5, 0], order });
// A see-through surface that adds its light onto the picture.
const addMat = (k, o = {}) => new k.THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: k.THREE.AdditiveBlending, side: k.THREE.DoubleSide, ...o });
// Lots of little glows in one draw call: squares turned to face the camera (q: that rotation in the parent's space),
// each a glow of o.kind. list: [{ p, s (size, or [sx, sy, 1]), a (a turn in the picture), color }]. They do count
// when the studio frames the model.
function dots(k, list, q, o = {}) {
  const T = k.THREE, e = new T.Euler(), qa = new T.Quaternion(), Z = new T.Vector3(0, 0, 1);
  const mat = new T.MeshBasicMaterial({ map: glowTex(k, o.kind ?? 'dot'), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: o.opacity ?? 1 });
  const m = k.instances(k.plane(1, 1), mat, list.map(d => {
    e.setFromQuaternion(d.a ? qa.setFromAxisAngle(Z, d.a).premultiply(q) : q);
    return { p: d.p, r: [e.x, e.y, e.z], s: d.s, color: d.color ?? '#ffffff' };
  }));
  m.castShadow = m.receiveShadow = false;
  if (o.order != null) m.renderOrder = o.order;
  return m;
}
// A shell that glows most round its edge, where we look through the most of it (a fresnel falloff): o.pow sharpens the
// edge, o.floor keeps some light face-on, o.map paints it. o.normal lays its colour over what's behind rather than
// adding light (draw such a shell in two meshes, o.side BackSide then FrontSide, so its far side goes down first).
function rimMat(k, color, o = {}) {
  const T = k.THREE, m = new T.MeshBasicMaterial({ color: k.color(color), map: o.map ?? null, transparent: true, depthWrite: false,
    blending: o.normal ? T.NormalBlending : T.AdditiveBlending, side: o.side ?? T.DoubleSide, opacity: o.opacity ?? 1 });
  const U = { uPow: { value: o.pow ?? 2.5 }, uFloor: { value: o.floor ?? 0 } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vRN;\nvarying vec3 vRV;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tvRN = normalize(normalMatrix * normal); vRV = -mvPosition.xyz;');
    sh.fragmentShader = 'uniform float uPow;\nuniform float uFloor;\nvarying vec3 vRN;\nvarying vec3 vRV;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `{
		float fr = 1.0 - abs(dot(normalize(vRN), normalize(vRV)));
		diffuseColor.a *= uFloor + (1.0 - uFloor) * pow(fr, uPow);
	}
	#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'space-wonders-rim';
  return m;
}

/* ---------- geometry ---------- */
const curveOf = (k, pts, closed = false) => new k.THREE.CatmullRomCurve3(pts.map(q => Array.isArray(q) ? new k.THREE.Vector3(...q) : q.clone()), closed);
// A strip of quads along t ∈ [0, 1]: at(t) → [P, W] (Vector3s: the middle, and half the width across). u runs along
// the strip, v across it (0 at P − W). Tails, rings, beams and trails are all strips.
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
// A flat ring (or part of one) in the xy plane: from angle a0 to a1, inner radius r0 and width wd. u follows the angle,
// v runs from the inner edge out.
const arcRing = (k, a0, a1, r0, wd, n = 128, m = 2) => strip(k, t => {
  const a = lerp(a0, a1, t), c = Math.cos(a), s = Math.sin(a);
  return [new k.THREE.Vector3(c, s, 0).multiplyScalar(r0 + wd / 2), new k.THREE.Vector3(c, s, 0).multiplyScalar(wd / 2)];
}, n, m);
// A soft glowing line along a 3D path: a ribbon turned to face the camera (view: towards the camera, in the same space).
function glowLine(k, pts, width, view, n = 48) {
  const T = k.THREE, curve = curveOf(k, pts);
  return strip(k, t => {
    const P = curve.getPointAt(t), D = curve.getTangentAt(t), w = typeof width === 'function' ? width(t) : width;
    return [P, new T.Vector3().crossVectors(D, view).normalize().multiplyScalar(w / 2)];
  }, n);
}
// A surface spun round the z axis: prof(s) → [radius, z] for s ∈ [0, 1]. u runs once round (from +x toward +y), v = s.
function surfRev(k, prof, nu, nv) {
  const T = k.THREE, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    const s = j / nv, [r, z] = prof(s);
    for (let i = 0; i <= nu; i++) { const a = i / nu * TAU; pos.push(r * Math.cos(a), r * Math.sin(a), z); uv.push(i / nu, s); }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// A tapered rod from A to B (Vector3s), r0 thick at A and r1 at B.
function taper(k, A, B, r0, r1, mat) {
  const T = k.THREE, d = B.clone().sub(A), m = k.mesh(k.cyl(r1, r0, d.length(), { seg: 12 }), mat, { shadow: false });
  m.position.copy(A).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  return m;
}

/* ---------- the Golden Record ---------- */
// Letters round an arc of radius r about the origin: along the top reading clockwise, or along the bottom reading
// anticlockwise, both the right way up.
function arcText(c, str, r, top, spacing = .14) {
  const chars = [...str], ws = chars.map(ch => c.measureText(ch).width), sp = c.measureText('M').width * spacing;
  const total = ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1), dir = top ? 1 : -1;
  let a = (top ? -Math.PI / 2 : Math.PI / 2) - dir * total / r / 2;
  c.textAlign = 'center'; c.textBaseline = top ? 'bottom' : 'top';
  chars.forEach((ch, i) => {
    a += dir * ws[i] / 2 / r;
    c.save(); c.translate(Math.cos(a) * r, Math.sin(a) * r); c.rotate(a + dir * Math.PI / 2); c.fillText(ch, 0, 0); c.restore();
    a += dir * (ws[i] / 2 + sp) / r;
  });
}
// The record's face, 1 unit of radius to half the canvas: gold grooves gathered into tracks with bright bands between
// them, the sheen that runs across a record's grooves, and the label with its words engraved round it.
function recordTex(k) {
  return k.tex(1024, 1024, (c, w) => {
    const S = w / 2, R = rng(1977);
    c.save(); c.translate(S, S);
    let gr = c.createRadialGradient(0, 0, 0, 0, 0, S);
    gr.addColorStop(0, '#e9b75a'); gr.addColorStop(.4, '#d9a13c'); gr.addColorStop(1, '#c98b28');
    c.fillStyle = gr; c.fillRect(-S, -S, w, w);
    const TRACKS = [.37, .43, .49, .535, .6, .655, .72, .77, .83, .89, .94];
    for (let r = .345; r < .972; r += .0021) {
      const band = TRACKS.some(b => Math.abs(r - b) < .006);
      c.strokeStyle = band ? 'rgba(255,236,178,.8)' : R() < .5 ? `rgba(92,52,0,${.14 + R() * .2})` : `rgba(255,226,140,${.08 + R() * .16})`;
      c.lineWidth = band ? 3 : 1.1;
      c.beginPath(); c.arc(0, 0, r * S, 0, TAU); c.stroke();
    }
    c.lineWidth = 6; c.strokeStyle = 'rgba(255,240,196,.85)'; c.beginPath(); c.arc(0, 0, .978 * S, 0, TAU); c.stroke();   // the smooth lip
    // a little sheen across the grooves: two brighter wedges and two dimmer ones
    c.save(); c.beginPath(); c.arc(0, 0, .972 * S, 0, TAU); c.moveTo(.345 * S, 0); c.arc(0, 0, .345 * S, 0, TAU, true); c.clip();
    const cg = c.createConicGradient(-Math.PI * .3, 0, 0), L = 'rgba(255,244,206,', D = 'rgba(60,28,0,';
    for (const [t, col] of [[0, L + '.4)'], [.06, L + '.12)'], [.14, D + '.0)'], [.25, D + '.25)'], [.36, D + '.0)'], [.44, L + '.12)'], [.5, L + '.4)'],
      [.56, L + '.12)'], [.64, D + '.0)'], [.75, D + '.25)'], [.86, D + '.0)'], [.94, L + '.12)'], [1, L + '.4)']]) cg.addColorStop(t, col);
    c.fillStyle = cg; c.fillRect(-S, -S, w, w);
    c.restore();
    // the label: a paler, satin gold, with its words engraved round it
    const LR = .33 * S;
    c.fillStyle = 'rgba(80,44,0,.8)'; c.beginPath(); c.arc(0, 0, LR + 5, 0, TAU); c.fill();
    gr = c.createRadialGradient(-LR * .3, -LR * .4, LR * .05, 0, 0, LR);
    gr.addColorStop(0, '#fff0c0'); gr.addColorStop(.6, '#f0cc72'); gr.addColorStop(1, '#dcaa4a');
    c.fillStyle = gr; c.beginPath(); c.arc(0, 0, LR, 0, TAU); c.fill();
    const engrave = draw => {
      c.save(); c.translate(2, 2); c.strokeStyle = c.fillStyle = 'rgba(255,250,228,.8)'; draw(); c.restore();
      c.strokeStyle = c.fillStyle = 'rgba(84,48,2,.95)'; draw();
    };
    c.lineWidth = 4;
    engrave(() => { for (const f of [.955, .6, .2]) { c.beginPath(); c.arc(0, 0, LR * f, 0, TAU); c.stroke(); } });
    c.font = `700 ${Math.round(LR * .17)}px Fredoka, system-ui, sans-serif`;
    engrave(() => { arcText(c, 'THE SOUNDS OF EARTH', LR * .7, true, .1); arcText(c, 'PLANET EARTH', LR * .7, false, .2); });
    c.font = `600 ${Math.round(LR * .12)}px Fredoka, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    engrave(() => { c.fillText('SIDE 1', 0, -LR * .38); c.fillText('16⅔ RPM', 0, LR * .38); });
    c.fillStyle = '#1c1204'; c.beginPath(); c.arc(0, 0, .026 * S, 0, TAU); c.fill();   // the spindle hole
    c.restore();
  }, { cache: 'space-wonders:record' });
}
// How rough the record is: the grooves a little, the bands between tracks and the label less.
function recordRough(k) {
  return k.tex(256, 256, (c, w) => {
    const S = w / 2;
    c.fillStyle = '#5a5a5a'; c.fillRect(0, 0, w, w);
    c.lineWidth = 2; c.strokeStyle = '#2a2a2a';
    for (const b of [.37, .43, .49, .535, .6, .655, .72, .77, .83, .89, .94]) { c.beginPath(); c.arc(S, S, b * S, 0, TAU); c.stroke(); }
    c.fillStyle = '#3c3c3c'; c.beginPath(); c.arc(S, S, .33 * S, 0, TAU); c.fill();
  }, { cache: 'space-wonders:record-rough', data: true });
}
// Which way the grooves smear the light: straight out from the middle (the grooves run round), in the red and green,
// and how much, in the blue (none on the smooth label). Highlights on it stretch into the streaks across a record.
// One texture, kept for good: the studio frees a model's maps when it's done with it, but not this kind.
let recordAnisoMap = null;
function recordAniso(k) {
  return recordAnisoMap ??= k.tex(128, 128, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const x = u - .5, y = v - .5, r = Math.hypot(x, y) * 2 || 1e-6;
    o[0] = .5 + .5 * x * 2 / r; o[1] = .5 + .5 * y * 2 / r; o[2] = smooth(.33, .36, r) * smooth(.99, .96, r);
  }), { cache: 'space-wonders:record-aniso', data: true });
}
// What's engraved on the cover, in the current stroke and fill, radius S about the origin: the record seen from above
// and from the side with its stylus and binary numbers, the picture signal and how to scan it, the first picture (a
// circle), the map of fourteen pulsars and a line to the middle of the galaxy, and the two states of a hydrogen atom.
function coverArt(c, S) {
  const R = rng(1972);
  const line = pts => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x * S, y * S) : c.moveTo(x * S, y * S)); c.stroke(); };
  const circ = (x, y, r, fill) => { c.beginPath(); c.arc(x * S, y * S, r * S, 0, TAU); fill ? c.fill() : c.stroke(); };
  // binary: a tick across the line for one, a dash along it for nought
  const bits = (x, y, dx, dy, str, gap = .03, len = .024) => [...str].forEach((b, i) => {
    const px = x + dx * i * gap, py = y + dy * i * gap;
    b === '1' ? line([[px - dy * len / 2, py + dx * len / 2], [px + dy * len / 2, py - dx * len / 2]]) : line([[px - dx * len / 3, py - dy * len / 3], [px + dx * len / 3, py + dy * len / 3]]);
  });
  circ(0, 0, .955);
  // the record from above, with the arm of the stylus on it, and its turning time in binary round the top
  circ(-.4, -.38, .25); circ(-.4, -.38, .07); circ(-.4, -.38, .014, true);
  line([[-.13, -.66], [-.23, -.5], [-.3, -.46]]);
  const T1 = '100110000110010000111';
  for (let i = 0; i < T1.length; i++) {
    const a = -2.75 + i * .085, r0 = .3, x = -.4 + Math.cos(a) * r0, y = -.38 + Math.sin(a) * r0;
    T1[i] === '1' ? line([[x, y], [x + Math.cos(a) * .035, y + Math.sin(a) * .035]]) : line([[x - Math.sin(a) * .012, y + Math.cos(a) * .012], [x + Math.sin(a) * .012, y - Math.cos(a) * .012]]);
  }
  // the record seen edge on, the stylus at its rim, and how long a side plays
  line([[-.68, -.02], [-.14, -.02]]); line([[-.64, -.1], [-.55, -.045]]);
  bits(-.6, .06, 1, 0, '1001010011001100');
  // the picture signal: a trace with its sync pulses, and binary above it
  line([[.08, -.5], [.18, -.5], [.18, -.62], [.22, -.62], [.22, -.5], [.34, -.5], [.34, -.58], [.38, -.58], [.38, -.5], [.5, -.5], [.5, -.66], [.54, -.66], [.54, -.5], [.66, -.5]]);
  bits(.12, -.74, 1, 0, '10110010110100', .033);
  // how the picture is scanned: lines down a frame, and the first picture it makes, a circle
  line([[.16, -.38], [.6, -.38], [.6, -.08], [.16, -.08], [.16, -.38]]);
  for (let i = 0; i < 7; i++) { const x = .2 + i * .058; line([[x, -.35], [x + .03, -.11]]); }
  circ(.42, .14, .1);
  // the pulsar map: fourteen lines from the Sun, each with its pulsar's period in binary, and the long line to the
  // middle of the galaxy
  const pc = [-.3, .44];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + (R() - .5) * .35, len = .1 + R() * .24, ex = pc[0] + Math.cos(a) * len, ey = pc[1] + Math.sin(a) * len;
    line([pc, [ex, ey]]);
    for (let b = 0, nb = 4 + (R() * 5 | 0); b < nb; b++) {
      if (R() < .45) continue;
      const t = .4 + .55 * b / nb, x = pc[0] + Math.cos(a) * len * t, y = pc[1] + Math.sin(a) * len * t;
      line([[x - Math.sin(a) * .016, y + Math.cos(a) * .016], [x + Math.sin(a) * .016, y - Math.cos(a) * .016]]);
    }
  }
  line([pc, [pc[0] + .56, pc[1]]]);
  circ(pc[0], pc[1], .012, true);
  // hydrogen, in its two lowest states
  circ(.12, .72, .045); circ(.34, .72, .045); circ(.12, .72, .01, true); circ(.34, .72, .01, true);
  line([[.165, .72], [.295, .72]]); line([[.23, .64], [.23, .69]]);
}
// The aluminium cover: a soft anodised grey with fine turned lines and its engraving (bump: the grooves as a bump map).
function coverTex(k, bump) {
  return k.tex(1024, 1024, (c, w) => {
    const S = w / 2, R = rng(1978);
    c.save(); c.translate(S, S);
    if (bump) { c.fillStyle = '#808080'; c.fillRect(-S, -S, w, w); }
    else {
      const gr = c.createRadialGradient(-S * .35, -S * .4, 0, 0, 0, S * 1.05);
      gr.addColorStop(0, '#f3f5f8'); gr.addColorStop(1, '#b3bac4');
      c.fillStyle = gr; c.fillRect(-S, -S, w, w);
      for (let r = 6; r < S; r += 1.7) { c.strokeStyle = R() < .5 ? `rgba(255,255,255,${R() * .16})` : `rgba(70,80,95,${R() * .1})`; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); }
    }
    c.lineCap = c.lineJoin = 'round';
    if (bump) { c.strokeStyle = c.fillStyle = '#161616'; c.lineWidth = 7; coverArt(c, S); }
    else {
      c.save(); c.translate(2.2, 2.2); c.strokeStyle = c.fillStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 6; coverArt(c, S); c.restore();
      c.strokeStyle = c.fillStyle = 'rgba(38,44,56,.9)'; c.lineWidth = 5.5; coverArt(c, S);
    }
    c.restore();
  }, { cache: `space-wonders:cover${bump ? '-bump' : ''}`, data: bump });
}

/* ---------- the Great Comet ---------- */
// The ion tail, u along it (0 at the head), v across: kind 0 a broad blue haze, kind 1 the fine streamers that
// converge on the head, a bright core line and knots of gas pinched off down the tail; kind 2 the haze's own deep blue,
// to lay down under the light.
function ionTex(k, kind) {
  const N = makeNoise(kind === 1 ? 301 : 300), R = rng(310), st = [];
  for (let i = 0; i < 12; i++) st.push([(R() - .5) * 1.5, .025 + R() * .05, .3 + R() * .7, R() * 9, 2 + R() * 4]);
  const COL = stopsOf(kind === 2 ? [[0, '#7cc4ff'], [.3, '#2f6cff'], [1, '#2a22c8']] : [[0, '#f2fbff'], [.2, '#a8dcff'], [.5, '#4d97ff'], [1, '#3a4cff']]);
  return k.tex(512, 128, (c, w, h) => {
    // how bright each streamer is along the tail (the same all the way across it, so worked out once per column)
    const mod = st.map(([c0, , , ph]) => Float32Array.from({ length: w }, (_, x) => .45 + .55 * smooth(-.4, .4, N.fbm2((x + .5) / w * 7 + ph, c0 * 3, 3))));
    pixels(c, w, h, (u, v, o) => {
      const s = v * 2 - 1, along = smooth(0, .03, u) * Math.pow(1 - u, .8) * smooth(1, .9, u), x = Math.min(w - 1, u * w | 0);
      let a;
      if (kind !== 1) a = (kind ? .55 : .5) * Math.exp(-s * s * (kind ? 3.2 : 2.2)) * (1 + .3 * N.fbm2(u * 5, s * 2, 3));
      else {
        a = .7 * Math.exp(-s * s / .012) * Math.pow(1 - u, .5);
        st.forEach(([c0, wd, b, ph, f], i) => {
          const cc = c0 * (.1 + .9 * Math.pow(u, .6)) + .07 * u * Math.sin(u * f * 4 + ph);
          a += b * Math.exp(-(((s - cc) / wd) ** 2)) * mod[i][x] * smooth(.01, .12, u);
        });
        a += .6 * Math.exp(-(((u - .48) / .045) ** 2) - (s / .3) ** 2) + .35 * Math.exp(-(((u - .7) / .05) ** 2) - ((s - .1) / .35) ** 2);
      }
      ramp(COL, clamp(u + Math.abs(s) * .2), o); o[3] = clamp(a * along) * smooth(1, .8, Math.abs(s));
    });
  }, { cache: `space-wonders:ion${kind}` });
}
// The dust tail's fan, u along it, v across (1 its sharp leading edge, 0 its soft trailing one): kind 0 a broad golden
// glow, kind 1 the striae, bands of dust thrown off at different times, fanning out from the head; kind 2 the striae's
// own deep gold, to lay down under the light.
function dustTex(k, kind) {
  const N = makeNoise(kind ? 401 : 400), R = rng(410), bands = [];
  for (let i = 0; i < 34; i++) bands.push([.06 + R() * .9, .005 + R() * .025, .25 + R() * .75, R() * .25, R() * 20]);
  const COL = stopsOf(kind === 2 ? [[0, '#ffd46a'], [.2, '#ffb436'], [.5, '#ff8a26'], [.8, '#ee5530'], [1, '#c83a5a']]
    : [[0, '#fff6dc'], [.12, '#ffe6a0'], [.35, '#ffcc66'], [.7, '#ffaa56'], [1, '#ff8f6a']]);
  return k.tex(512, 256, (c, w, h) => {
    // how bright each band is along the tail (worked out once per column)
    const mod = bands.map(([c0, , , , ph]) => Float32Array.from({ length: w }, (_, x) => .4 + .6 * smooth(-.35, .35, N.fbm2((x + .5) / w * 5 + ph, c0 * 8, 3))));
    pixels(c, w, h, (u, v, o) => {
      const along = smooth(0, .02, u) * Math.pow(1 - u, .9) * smooth(1, .9, u), edge = smooth(0, .4, v) * smooth(1, .88, v), x = Math.min(w - 1, u * w | 0);
      let a;
      if (kind === 0) a = .7 * edge * (1 + .25 * N.fbm2(u * 4, v * 3, 3));
      else {
        a = .45 * Math.exp(-(((v - .7) / .32) ** 2)) + .2 * Math.exp(-u * 8);
        bands.forEach(([c0, wd, b, u0], i) => { const d = (v - c0) / wd; if (d * d < 9) a += b * .7 * Math.exp(-d * d) * smooth(u0, u0 + .12, u) * mod[i][x]; });
        a *= edge;
      }
      ramp(COL, clamp(u * 1.05 + (1 - v) * .12), o); o[3] = clamp(a * along * (kind === 2 ? 1 : 1.3));
    });
  }, { cache: `space-wonders:dust${kind}` });
}
// The head's hoods: shells of gas thrown off the sunward side one after another, nested round the nucleus (x runs
// down the tail, away from the Sun).
function hoodTex(k) {
  return k.tex(256, 256, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const x = (u - .5) * 2, y = (v - .5) * 2, r = Math.hypot(x, y);
    let a = .4 * Math.exp(-r * r * 7);
    for (const [q, b] of [[.14, .75], [.26, .5], [.4, .3]]) {
      const d = x - (-q + y * y / (3 * q));
      a += b * Math.exp(-((d / (.035 + .06 * q)) ** 2)) * Math.exp(-(y * y) / (q * 1.1)) * smooth(.7, .1, x + q);
    }
    o[0] = .85; o[1] = 1; o[2] = .98; o[3] = clamp(a) * smooth(1, .75, r);
  }), { cache: 'space-wonders:hood' });
}
// A jet of gas, u along it: bright and narrow at its vent, spreading and fading.
function jetTex(k) {
  const N = makeNoise(520);
  return k.tex(128, 64, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const s = v * 2 - 1;
    o[0] = o[1] = o[2] = 1; o[3] = clamp(Math.exp(-s * s * (3 + 6 * (1 - u))) * Math.pow(1 - u, 1.2) * smooth(0, .08, u) * (.7 + .5 * N.fbm2(u * 6, s * 2, 2)));
  }), { cache: 'space-wonders:jet' });
}
// The nucleus, radius about r: two lumpy lobes of dark dirty ice joined at a neck, with bright frosty patches.
function cometCore(k, r) {
  const T = k.THREE, N = makeNoise(6767), geo = k.sphere(1, { w: 96, h: 72 }), p = geo.attributes.position, col = [], c = new T.Color(), d = new T.Vector3();
  const LOBES = [[-.34, 0, 0, .78], [.42, .06, .04, .6]], ROCK = hex('#4f4843'), ROCK2 = hex('#857a70'), ICE = hex('#eaf6ff');
  for (let i = 0; i < p.count; i++) {
    d.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    let R = 0;
    for (const [x, y, z, rr] of LOBES) { const b = d.x * x + d.y * y + d.z * z, t = b + Math.sqrt(Math.max(0, b * b - (x * x + y * y + z * z - rr * rr))); R = R ? smax(R, t, .18) : t; }
    const n = N.fbm3(d.x * 2.2, d.y * 2.2, d.z * 2.2, 4), n2 = N.fbm3(d.x * 7 + 3, d.y * 7, d.z * 7, 3);
    R *= 1 + .12 * n + .04 * n2;
    p.setXYZ(i, d.x * R * r, d.y * R * r * .86, d.z * R * r * .9);
    const ice = smooth(.1, .28, N.fbm3(d.x * 3 + 9, d.y * 3, d.z * 3, 3) + .1 * n2);
    const q = mixC(mixC(ROCK, ROCK2, smooth(-.3, .4, n + n2)), ICE, ice * .85);
    c.setRGB(q[0], q[1], q[2], T.SRGBColorSpace); col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return k.mesh(weld(geo), k.mat({ vertexColors: true, roughness: .75, metalness: 0, emissive: '#1d4450', emissiveIntensity: .35 }), { shadow: false });
}

/* ---------- the Nebula ---------- */
// The glowing gas behind the pillars, 7 × 7.9 picture units round its middle: billows of teal where the young stars
// have blown a bright hollow, magenta out in the wings, gold in the brightest billows and a violet haze at the edges.
function nebulaBack(k) {
  const N = makeNoise(9001), TEAL = hex('#2ee6d2'), TEAL2 = hex('#c4fff6'), MAG = hex('#ff3a95'), GOLD = hex('#ffb54d'), BLUE = hex('#5a4dff');
  return k.tex(384, 432, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const X = (u - .5) * 7, Y = (v - .5) * 7.9;
    const wx = N.fbm2(X * .32 + 3.1, Y * .32 - 1.7, 3), wy = N.fbm2(X * .32 - 5.2, Y * .32 + 2.9, 3), qx = X + 1.5 * wx, qy = Y + 1.5 * wy;
    const d = N.fbm2(qx * .5, qy * .5, 5), bil = 1 - Math.abs(N.fbm2(qx * 1.05 + 7, qy * 1.05, 4));
    const dens = smooth(-.3, .6, d + .45 * bil - .15);
    const cav = Math.exp(-(((X + .2) / 2.3) ** 2) - (((Y - .7) / 2.1) ** 2)), r = Math.hypot((u - .5) * 2, (v - .5) * 2);
    let col = mixC(MAG, TEAL, smooth(.15, .7, cav + .25 * wx));
    col = mixC(col, TEAL2, smooth(.55, 1, cav) * smooth(.3, .9, bil) * .7);
    col = mixC(col, GOLD, smooth(.62, .92, bil) * smooth(-.1, .45, N.fbm2(X * .45 - 9, Y * .45, 2)) * .75);
    col = mixC(col, BLUE, smooth(.5, 1, r) * .45);
    o[0] = col[0]; o[1] = col[1]; o[2] = col[2]; o[3] = clamp((dens * (.3 + .85 * cav) + .1 * cav) * smooth(1, .55, r) * 1.05);
  }), { cache: 'space-wonders:nebula-back' });
}
// The pillars of dust, as a field over their 4.8 × 4.05 picture: how dense (0..1), and a blurred copy for the glow
// round them. Worked out once and shared by the two pictures painted from it.
const PILLARS = { w: 480, h: 405, field: null };
function pillarField() {
  if (PILLARS.field) return PILLARS.field;
  const { w, h } = PILLARS, N = makeNoise(4242), rho = new Float32Array(w * h), Y0 = -2.2;
  // base x, head x, head y, half-width at the base and at the head, how much the column bows
  const COLS = [[-1.3, -1.02, 1.22, .66, .3, .14], [.2, .42, .36, .52, .25, -.1], [1.52, 1.38, -.52, .4, .19, .07]];
  const EGGS = [[-1.12, 1.5, .09], [-.86, 1.44, .06], [.5, .6, .07], [.3, .58, .05], [1.42, -.3, .05], [-1.32, 1.18, .05]];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = (i + .5) / w * 4.8 - 2.4, y = 2.025 - (j + .5) / h * 4.05;
    const x2 = x + .17 * N.fbm2(x * 1.5 + 2, y * 1.5, 3) + .05 * N.fbm2(x * 6, y * 6 + 3, 2), y2 = y + .17 * N.fbm2(x * 1.5 - 7, y * 1.5 + 4, 3) + .05 * N.fbm2(x * 6 + 5, y * 6, 2);
    let D = 9;
    for (const [bx, tx, ty, bw, tw, bend] of COLS) {
      const t = clamp((y2 - Y0) / (ty - Y0)), xc = lerp(bx, tx, t) + bend * Math.sin(Math.PI * t), hw = lerp(bw, tw, Math.pow(t, .8));
      D = Math.min(D, y2 > ty ? Math.hypot(x2 - tx, y2 - ty) - tw : Math.abs(x2 - xc) - hw);
    }
    for (const [ex, ey, er] of EGGS) D = smin(D, Math.hypot(x2 - ex, y2 - ey) - er, .05);
    D = smin(D, y2 - (-1.42 + .42 * N.fbm2(x * .9 + 4, 1.5, 3) + .1 * Math.sin(x * 2.3 + 1) - .18 * Math.exp(-x * x)), .3);   // the cloud bank they rise from
    // which thins away to nothing toward the picture's edges
    const edge = smooth(2.4, 1.7 + .25 * N.fbm2(y * 1.4, 9, 2), Math.abs(x)) * smooth(-2.02, -1.45 + .2 * N.fbm2(x * 1.3, 3, 2), y);
    rho[j * w + i] = smooth(.04, -.12, D) * edge;
  }
  return (PILLARS.field = { rho, blur: boxBlur(rho, w, h, 7), N });
}
// The young cluster above them, which lights and wears away their heads.
const PILLAR_LIGHT = [-.25, 2.7];
// Walk the pillar field: f(i, x, y, r, lit, skin, haze, N) for each texel, lit the pillars' surface facing the light,
// skin how much of the glowing surface there is, haze the glow breathed out round it.
function eachPillar(f) {
  const { w, h } = PILLARS, { rho, blur, N } = pillarField();
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const id = j * w + i, x = (i + .5) / w * 4.8 - 2.4, y = 2.025 - (j + .5) / h * 4.05, r = rho[id];
    const L = (a, b) => a[j * w + Math.min(w - 1, Math.max(0, b))];
    const U = (a, dj) => a[Math.min(h - 1, Math.max(0, j + dj)) * w + i];
    let lx = PILLAR_LIGHT[0] - x, ly = PILLAR_LIGHT[1] - y; const ll = Math.hypot(lx, ly); lx /= ll; ly /= ll;
    const gx = (L(rho, i + 1) - L(rho, i - 1)) * .5, gy = (U(rho, -1) - U(rho, 1)) * .5, gl = Math.hypot(gx, gy);
    const lit = gl > 1e-5 ? clamp(-(gx * lx + gy * ly) / gl) : 0;
    const bx = (L(blur, i + 1) - L(blur, i - 1)) * .5, by = (U(blur, -1) - U(blur, 1)) * .5, bl = Math.hypot(bx, by);
    const blit = bl > 1e-5 ? clamp(-(bx * lx + by * ly) / bl) : 0;
    f(id, x, y, r, lit, clamp(gl * 10) * (.15 + .85 * lit), clamp((blur[id] - r) * 2.4) * (.2 + .8 * blit), N);
  }
}
// The pillars themselves, laid over the gas: dark brown dust, warmer toward their heads, their lit skins gold and pink.
function nebulaPillars(k) {
  const DARK = hex('#1b0b06'), MID = hex('#6e3419'), GOLD = hex('#ffb654'), MAG = hex('#ff4a98');
  return k.tex(PILLARS.w, PILLARS.h, c => {
    const img = c.createImageData(PILLARS.w, PILLARS.h), d = img.data;
    eachPillar((id, x, y, r, lit, skin, haze, N) => {
      const top = smooth(-1.6, 1.4, y), m = smooth(-.3, .35, N.fbm2(x * .9 + 20, y * .9, 2));
      let col = mixC(DARK, MID, clamp(.12 + .4 * top * (.4 + .6 * lit) + .3 * N.fbm2(x * 3.2, y * 3.2, 3)));
      col = mixC(col, mixC(GOLD, MAG, m), clamp(skin * 1.2));
      d[id * 4] = col[0] * 255; d[id * 4 + 1] = col[1] * 255; d[id * 4 + 2] = col[2] * 255; d[id * 4 + 3] = clamp(r * .98 + skin * .3) * 255;
    });
    c.putImageData(img, 0, 0);
  }, { cache: 'space-wonders:nebula-pillars' });
}
// The light on the pillars, added over them: their skins where the starlight strikes, hot at the heads, and the glowing
// gas it boils off them.
function nebulaGlow(k) {
  const GOLD = hex('#ffc46a'), MAG = hex('#ff5aa6'), HOT = hex('#fff1f6'), TEAL = hex('#7ffff0');
  return k.tex(PILLARS.w, PILLARS.h, c => {
    const img = c.createImageData(PILLARS.w, PILLARS.h), d = img.data;
    eachPillar((id, x, y, r, lit, skin, haze, N) => {
      const top = smooth(-1.4, 1.3, y), m = smooth(-.3, .35, N.fbm2(x * .9 + 20, y * .9, 2));
      let col = mixC(mixC(GOLD, MAG, m), HOT, lit * lit * top * .7);
      const hz = haze * (.35 + .65 * top);
      col = mixC(col, mixC(MAG, TEAL, smooth(-.2, .4, N.fbm2(x * .6 - 4, y * .6, 2)) * .5), clamp(hz / (skin + hz + 1e-4)) * .6);
      const a = clamp(skin * (.35 + .9 * top) + hz * .5);
      d[id * 4] = col[0] * 255; d[id * 4 + 1] = col[1] * 255; d[id * 4 + 2] = col[2] * 255; d[id * 4 + 3] = a * 255;
    });
    c.putImageData(img, 0, 0);
  }, { cache: 'space-wonders:nebula-glow' });
}
// Thin wisps of gas drifting in front, magenta and gold, mostly low down and round the edges.
function nebulaWisps(k) {
  const N = makeNoise(777), MAG = hex('#ff5aa8'), GOLD = hex('#ffc46a');
  return k.tex(320, 288, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const X = (u - .5) * 5.6, Y = (v - .5) * 4.8;
    const f = 1 - Math.abs(N.fbm2(X * .8 + 1.3 * N.fbm2(X * .4, Y * .4, 2), Y * .8, 4)), r = Math.hypot((u - .5) * 2, (v - .5) * 2);
    const col = mixC(MAG, GOLD, smooth(-.3, .5, N.fbm2(X * .3 + 8, Y * .3, 2)));
    o[0] = col[0]; o[1] = col[1]; o[2] = col[2]; o[3] = clamp(Math.pow(f, 7) * smooth(1, .6, r) * (.3 + .7 * smooth(.6, -1.4, Y) + .5 * smooth(.4, .9, r)) * .8);
  }), { cache: 'space-wonders:nebula-wisps' });
}

/* ---------- the Supernova ---------- */
// A shell of the explosion, painted from points on the sphere so it has no seams: kind 0 the blast wave, thin wispy
// filaments of shocked gas in blue and white; kind 1 the ejecta, knots of the star's insides burning orange and pink.
function shellTex(k, kind) {
  const N = makeNoise(kind ? 1604 : 1572);
  const BLUE = stopsOf([[0, '#2d6bff'], [.5, '#7cc4ff'], [1, '#f0f8ff']]), FIRE = stopsOf([[0, '#8e0f3c'], [.28, '#ff3a5c'], [.52, '#ff6a1c'], [.78, '#ffb83a'], [1, '#fff2c8']]);
  return k.tex(512, 256, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const th = (1 - v) * Math.PI, ph = u * TAU, st = Math.sin(th), x = -Math.cos(ph) * st, y = Math.cos(th), z = Math.sin(ph) * st;
    if (!kind) {
      const f1 = 1 - Math.abs(N.fbm3(x * 1.8, y * 1.8, z * 1.8, 4)), f2 = 1 - Math.abs(N.fbm3(x * 4.2 + 7, y * 4.2, z * 4.2, 3)), gap = smooth(-.25, .2, N.fbm3(x * 1.3 + 3, y * 1.3, z * 1.3, 2));
      const I = (Math.pow(f1, 8) * 1.3 + Math.pow(f2, 12) * .7) * (.25 + .75 * gap) + .03;
      ramp(BLUE, clamp(I), o); o[3] = clamp(I);
    } else {
      const n = N.fbm3(x * 2.6, y * 2.6, z * 2.6, 5), m = N.fbm3(x * 1.2 + 9, y * 1.2, z * 1.2, 2), f = 1 - Math.abs(N.fbm3(x * 3.4 - 4, y * 3.4, z * 3.4, 3));
      const I = smooth(0, .4, n) + Math.pow(f, 7) * .6;
      ramp(FIRE, clamp(I * .75 + .35 * m + .16), o); o[3] = clamp(I);
    }
  }), { cache: `space-wonders:shell${kind}` });
}
// A ball of radius r pushed in and out by up to amp of its radius (a shell that has burst unevenly), stretched s along
// y (the ball's own), with steady normals across its seam.
function lumpyBall(k, r, amp, seed, s = 1) {
  const N = makeNoise(seed), geo = k.sphere(1, { w: 72, h: 48 }), p = geo.attributes.position, d = new k.THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    d.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const f = r * (1 + amp * N.fbm3(d.x * 1.5, d.y * 1.5, d.z * 1.5, 3));
    p.setXYZ(i, d.x * f, d.y * f * s, d.z * f);
  }
  geo.computeVertexNormals();
  return weld(geo);
}
// The shock wave's ring, u once round it and v from its inner edge (0) out: a blazing front along the inner edge, broken
// into clumps, and streamers of gas thrown out behind it, pink, then orange, fading to a dull red (kind 0, its light),
// or the gas's own deeper colours to lay under the light (kind 1).
function shockTex(k, kind) {
  const N = makeNoise(1054), NS = 90;
  const COL = stopsOf(kind ? [[0, '#a8b8ff'], [.15, '#ff4fb0'], [.5, '#ff5a22'], [1, '#7a1432']] : [[0, '#ffffff'], [.12, '#d6e8ff'], [.3, '#ff9ad6'], [.6, '#ffa060'], [1, '#ff5a4a']]);
  return k.tex(1024, 128, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const a = u * TAU, cx = Math.cos(a) * 3, cy = Math.sin(a) * 3, q = u * NS, q0 = Math.floor(q), f = q - q0 - .5, i = q0 % NS;
    const turb = .5 + .5 * N.fbm3(cx * 1.2, cy * 1.2, v * 4, 3);
    const front = Math.exp(-((v / .06) ** 2)) * (.45 + .55 * smooth(-.3, .4, N.n3(cx * 2, cy * 2, 1.3)));
    const streak = (.3 + .7 * hash1(i * 3)) * Math.exp(-((f / (.15 + .3 * hash1(i * 3 + 1))) ** 2)) * Math.exp(-v / (.2 + .5 * hash1(i * 3 + 2)));
    const I = front * 1.5 + streak * 1.5 * turb + .6 * turb * Math.exp(-v * 1.8);
    ramp(COL, clamp(v * 1.1), o); o[3] = clamp(I * (kind ? .95 : 1.1)) * smooth(1, .55, v);
  }), { cache: `space-wonders:shock${kind}` });
}
// Squeeze a geometry's texture coordinates into [u0, u1] × [v0, v1] (to show part of a texture on a strip).
function remapUV(geo, u0, u1, v0 = 0, v1 = 1) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(u0, u1, uv.getX(i)), lerp(v0, v1, uv.getY(i))); return geo; }
// Light echoes: rings of old dust far out round the star, lit up in turn as the flash passes through them, broken and
// swirled; white-blue inside, through pink to rusty orange outside.
function echoTex(k) {
  const N = makeNoise(1987), R = rng(1988), rings = [];
  for (let i = 0; i < 7; i++) rings.push([.44 + i * .075 + R() * .03, .012 + R() * .02, .4 + R() * .6, R() * 20]);
  const COL = stopsOf([[.4, '#bfe0ff'], [.55, '#ff9ad2'], [.7, '#ff9a4a'], [.85, '#c2552e'], [1, '#7a2a50']]);
  // how far each ring wanders in and out, round the circle (worked out once per step round it)
  const A = 720, wob = rings.map(([, , , ph]) => Float32Array.from({ length: A }, (_, i) => .03 * N.fbm2(Math.cos(i / A * TAU) * 2.5 + ph, Math.sin(i / A * TAU) * 2.5, 3)));
  return k.tex(512, 512, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const X = u * 2 - 1, Y = v * 2 - 1, r = Math.hypot(X, Y);
    if (r > 1 || r < .3) { o[3] = 0; return; }
    const cx = X / r, cy = Y / r, ai = Math.floor((Math.atan2(Y, X) / TAU + 1) % 1 * A);
    let I = .12 * smooth(.35, .6, r) * smooth(1, .75, r) * (.5 + .5 * N.fbm2(X * 4, Y * 4, 3));
    rings.forEach(([r0, wd, b, ph], i) => {
      const d = (r - r0 - wob[i][ai]) / wd;
      if (d * d < 9) I += b * Math.exp(-d * d) * (.3 + .7 * smooth(-.25, .45, N.fbm2(cx * 3.5 + ph, cy * 3.5 + r * 5, 3)));
    });
    ramp(COL, r, o); o[3] = clamp(I * .8) * smooth(1, .9, r);
  }), { cache: 'space-wonders:echo' });
}
// A starburst of fine rays, each its own length and brightness.
function burstTex(k) {
  const NR = 160;
  return k.tex(512, 512, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const X = u * 2 - 1, Y = v * 2 - 1, r = Math.hypot(X, Y), q = (Math.atan2(Y, X) / TAU + .5) * NR, q0 = Math.floor(q);
    let I = 0;
    for (const di of [-1, 0, 1]) {
      const i = (q0 + di + NR) % NR, f = q - q0 - di - .5;
      I += (.3 + .7 * hash1(i * 3 + 2)) * Math.exp(-((f / (.1 + .25 * hash1(i * 3 + 1))) ** 2)) * Math.exp(-r / ((.25 + .75 * hash1(i * 3)) * .45));
    }
    o[0] = o[1] = o[2] = 1; o[3] = clamp(I * .7 * smooth(0, .06, r)) * smooth(1, .85, r);
  }), { cache: 'space-wonders:burst' });
}

/* ---------- the Wormhole ---------- */
// How far round a swirl has wound at s along the funnel (0 at the throat, 1 out at its rim), in turns.
const winding = s => 1.5 * Math.log(1 + 9 * (1 - s));
// The funnel's walls, u once round and v from the throat (0) out to the rim (1): fine streaks of starlight and broader
// bands of gas spiralling down, brightest round the lip, gold and pink near the throat (light from the far side), violet
// and blue down the walls and teal out on the rim, ruled with the grid of the space it's bending.
function swirlTex(k) {
  const N = makeNoise(3141), NA = 40, NB = 14;
  const COL = stopsOf([[0, '#fff1c8'], [.12, '#ff7ad0'], [.32, '#b06bff'], [.55, '#6a8cff'], [.78, '#3fe0ff'], [1, '#48f5dc']]);
  return k.tex(1024, 256, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const tw = winding(v);
    let I = 0;
    { const q = (u + tw * .5) * NA, q0 = Math.floor(q), f = q - q0 - .5, i = ((q0 % NA) + NA) % NA;
      I += (.25 + .75 * hash1(i * 5 + 1)) * Math.exp(-((f / (.07 + .18 * hash1(i * 5))) ** 2)) * smooth(-.15, .55, N.n2(v * (3 + 9 * hash1(i * 5 + 2)) + hash1(i * 5 + 3) * 50, i * .71)); }
    { const q = (u + tw * .42) * NB, q0 = Math.floor(q), f = q - q0 - .5, i = ((q0 % NB) + NB) % NB;
      I += (.25 + .35 * hash1(i * 7 + 99)) * Math.exp(-((f / .32) ** 2)) * (.6 + .4 * N.n2(v * 4 + i, i * 1.3)); }
    const mu = u * 24 - Math.floor(u * 24), mer = Math.exp(-((Math.min(mu, 1 - mu) * w / 24 / 1.3) ** 2));
    const pv = v * 11 - Math.floor(v * 11), par = Math.exp(-((Math.min(pv, 1 - pv) * h / 11 / 1.2) ** 2));
    const lip = .55 + .9 * Math.exp(-(((v - .42) / .2) ** 2));
    ramp(COL, v, o);
    o[3] = clamp((I * lip + (mer + par) * .55 * smooth(.02, .15, v)) * smooth(1, .72, v) * smooth(0, .05, v));
  }), { cache: 'space-wonders:swirl' });
}
// What's through the throat: another galaxy, golden, under a strange magenta sky, the view bending round at its rim.
function farTex(k) {
  const N = makeNoise(4004), R = rng(4005);
  const SKY = hex('#2a0a44'), SKY2 = hex('#8a1f6a'), NEB = hex('#ff7a3d'), GOLD = hex('#ffcf73'), ARM = hex('#ffe6bf'), CORE = hex('#fff6e2'), BLUE = hex('#a8dcff');
  return k.tex(320, 320, (c, w, h) => {
    pixels(c, w, h, (u, v, o) => {
      const X = u * 2 - 1, Y = v * 2 - 1, r = Math.hypot(X, Y), n = N.fbm2(X * 2.2, Y * 2.2, 4), m = N.fbm2(X * 5 + 3, Y * 5, 3);
      let col = mixC(SKY, SKY2, smooth(-.3, .6, n + .3 * (1 - r)));
      col = mixC(col, NEB, smooth(.15, .6, n + .2 * m) * .55);
      // a two-armed spiral, tipped a little toward us
      const gx = X * .95 + Y * .2, gy = (-X * .2 + Y * .95) / .72, gr = Math.hypot(gx, gy) / .62, ga = Math.atan2(gy, gx);
      let arm = 0;
      for (const i of [0, 1]) { const th = Math.log(Math.max(gr, .03) / .08) / .32 + i * Math.PI, dp = ((ga - th) % TAU + TAU * 2 + Math.PI) % TAU - Math.PI; arm += Math.exp(-((dp * gr / (.08 + .1 * gr)) ** 2)); }
      const arms = arm * smooth(1, .6, gr) * smooth(.05, .2, gr) * (.5 + .6 * smooth(-.3, .5, m)), core = Math.exp(-((gr / .12) ** 2));
      col = mixC(col, mixC(mixC(GOLD, ARM, clamp(arms)), CORE, core), clamp(.6 * Math.exp(-gr / .28) * smooth(1, .7, gr) + .9 * arms + 1.2 * core));
      col = mixC(col, BLUE, smooth(.8, .98, r) * .55);
      o[0] = col[0]; o[1] = col[1]; o[2] = col[2];
    });
    for (let i = 0; i < 60; i++) {
      const x = R() * w, y = R() * h, s = 1 + R() * R() * 4, gr = c.createRadialGradient(x, y, 0, x, y, s * 2);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.3, 'rgba(255,236,250,.5)'); gr.addColorStop(1, 'rgba(255,220,240,0)');
      c.fillStyle = gr; c.fillRect(x - s * 2, y - s * 2, s * 4, s * 4);
    }
  }, { cache: 'space-wonders:far' });
}
// The dark inside of the funnel, u round and v along its inner part: deep indigo, darkest down by the throat.
const tunnelTex = k => k.tex(8, 128, (c, w, h) => pixels(c, w, h, (u, v, o) => { o[0] = .045; o[1] = .025; o[2] = .14; o[3] = .92 * (1 - smooth(.1, 1, v)); }), { cache: 'space-wonders:tunnel' });
// A trail of starlight, u along it: faint where it came from, a bright head where it's got to.
const trailTex = k => k.tex(256, 32, (c, w, h) => pixels(c, w, h, (u, v, o) => {
  const y = v * 2 - 1;
  o[0] = o[1] = o[2] = 1; o[3] = (.8 * Math.pow(u, 2.2) * Math.exp(-y * y * 5) + .9 * Math.exp(-(((u - .94) / .05) ** 2) - y * y * 9)) * smooth(1, .85, Math.abs(y));
}), { cache: 'space-wonders:trail' });
// The swirl of the space round it, for a sprite: faint trails of stars winding in, spilling out over the card.
function vortexTex(k) {
  const N = makeNoise(2718), NA = 64, COL = stopsOf([[0, '#e6f8ff'], [.4, '#7fd8ff'], [.7, '#6a6bff'], [1, '#2fd6c6']]);
  return k.tex(640, 640, (c, w, h) => pixels(c, w, h, (u, v, o) => {
    const X = u * 2 - 1, Y = v * 2 - 1, r = Math.hypot(X, Y);
    if (r > 1 || r < .05) { o[3] = 0; return; }
    const q = (Math.atan2(Y, X) / TAU + .5 - .55 * Math.log(r)) * NA, q0 = Math.floor(q), f = q - q0 - .5, i = ((q0 % NA) + NA) % NA;
    const I = (.3 + .7 * hash1(i * 3 + 1)) * Math.exp(-((f / (.05 + .12 * hash1(i * 3))) ** 2)) * smooth(-.1, .6, N.n2(r * (5 + 8 * hash1(i * 3 + 2)) + i, i * .3)) + .15 * Math.exp(-r * 2.2);
    ramp(COL, r, o); o[3] = clamp(I * smooth(.12, .35, r) * smooth(1, .55, r));
  }), { cache: 'space-wonders:vortex' });
}

export default {
  // The Voyager Golden Record: a gold-plated disc with its fine grooves gathered into tracks and its label engraved
  // THE SOUNDS OF EARTH, sliding out in front of its aluminium cover, which is engraved with how to play it and the
  // pulsar map of how to find us; the stylus cartridge that came with it floats alongside, diamond tip glinting, all of
  // it in a warm golden glow among specks of starlight.
  goldenrecord(k) {
    const T = k.THREE, g = k.group(), v = { az: 30, el: 16 };
    setView(g, v);
    const pic = picture(k, v); g.add(pic);
    // the cover, behind and to the left, its engraved face turned a little toward the record
    const cov = k.group([], { p: [-.72, .27, -.5], r: [-.05, .3, .03] }); pic.add(cov);
    const CR = 1.1, CT = .07;
    k.add(cov, k.rcyl(CR, CT, .028, { seg: 128 }), k.metal('#cfd5dc', .3), { p: [0, 0, -CT / 2], r: [Math.PI / 2, 0, 0], shadow: false });
    k.add(cov, k.disc(CR - .03, 128), k.mat({ map: coverTex(k, false), bumpMap: coverTex(k, true), bumpScale: 3, metalness: .85, roughness: .34, clearcoat: .3, clearcoatRoughness: .25 }),
      { p: [0, 0, CT / 2 + .002], shadow: false });
    // the record, in front and to the right, as if just slid out of it
    const rec = k.group([], { p: [.5, -.1, .18], r: [-.05, -.26, -.05] }); pic.add(rec);
    const RT = .032, map = recordTex(k);
    const face = k.mat({ map, metalness: 1, roughness: 1, roughnessMap: recordRough(k), emissive: '#ffffff', emissiveMap: map, emissiveIntensity: .07,
      anisotropy: .85, anisotropyMap: recordAniso(k), clearcoat: .15, clearcoatRoughness: .2 });
    k.add(rec, k.disc(1, 160), face, { p: [0, 0, RT / 2], shadow: false });
    k.add(rec, k.disc(1, 160), face, { p: [0, 0, -RT / 2], r: [0, Math.PI, 0], shadow: false });
    k.add(rec, k.torus(1, RT / 2, { rs: 12, ts: 160 }), k.metal('#f2c55c', .18), { shadow: false });
    k.add(rec, k.cyl(.026, .026, RT + .006, { seg: 24 }), k.matte('#1b1206', .6), { r: [Math.PI / 2, 0, 0], shadow: false });
    // the stylus cartridge: a glossy black body with a slanted nose under a gold mounting plate, a gold stripe down its
    // side, colour-coded pins out the back and a slim cantilever with a diamond on its tip, reaching for the grooves
    const cart = k.group([], { p: [-1.1, -.92, .75], r: [.38, -.5, .42], s: 1.7 }); pic.add(cart);
    const goldM = k.metal('#f2c55c', .2), chrome = k.metal('#eef1f5', .12);
    const bodyM = k.mat({ color: '#1b1d25', metalness: .5, roughness: .3, clearcoat: 1, clearcoatRoughness: .08 });
    k.add(cart, k.extrude(k.shape([[-.2, .06], [.2, .06], [.2, .01], [.12, -.07], [-.2, -.07]]), .15, { bevel: .014, curve: 8 }), bodyM, { shadow: false });
    k.add(cart, k.box(.44, .026, .21, .01), goldM, { p: [-.01, .085, 0], shadow: false });
    for (const x of [-.11, .09]) k.add(cart, k.cyl(.026, .026, .018, { seg: 20 }), chrome, { p: [x, .104, 0], shadow: false });
    for (const z of [-.089, .089]) k.add(cart, k.box(.3, .014, .006, .003), goldM, { p: [-.03, .012, z], shadow: false });
    const tip = new T.Vector3(.27, -.14, 0);
    cart.add(taper(k, new T.Vector3(.11, -.07, 0), tip, .01, .004, goldM));
    k.add(cart, k.sphere(.014, { w: 12, h: 8 }), k.mat({ color: '#ffffff', roughness: .05, emissive: '#e6f8ff', emissiveIntensity: 1.2 }), { p: tip.toArray(), shadow: false });
    [['#e8322e', .026, .042], ['#2fbf4a', .026, -.042], ['#2f6bff', -.026, .042], ['#f4f4f4', -.026, -.042]].forEach(([c, y, z]) => {
      k.add(cart, k.cyl(.012, .012, .05, { seg: 10 }), goldM, { p: [-.225, y, z], r: [0, 0, Math.PI / 2], shadow: false });
      k.add(cart, k.cyl(.017, .017, .018, { seg: 12 }), k.plastic(c), { p: [-.212, y, z], r: [0, 0, Math.PI / 2], shadow: false });
    });
    // a warm glow behind it all, brightest behind the record
    for (const o of [rec, cov, cart]) o.updateMatrix();
    const at = (obj, x, y, z = 0) => new T.Vector3(x, y, z).applyMatrix4(obj.matrix).toArray();
    const mid = at(rec, 0, 0, -1.1);
    pic.add(halo(k, 2.2, '#ffc766', .6, 'soft', mid), halo(k, 3.8, '#ff8f3a', .24, 'soft', [-.1, 0, -1.3]), halo(k, 1.5, '#fff0c8', .25, 'soft', at(cov, 0, 0, -.6)));
    // and golden light streaming out from behind the record
    for (let i = 0; i < 22; i++) pic.add(ray(k, mid, k.rand() * TAU, k.range(1.6, 3.2), k.range(.1, .3), k.pick(['#ffd27a', '#ffe7b0', '#ffb24a']), k.range(.12, .3)));
    // glints where the rims catch the light, and on the diamond
    for (const [a, s, rot] of [[2.2, .42, .2], [-.95, .3, .5], [.9, .2, .1]]) pic.add(halo(k, s, '#fff4d6', .9, 'flare', at(rec, Math.cos(a) * 1.01, Math.sin(a) * 1.01, .03), { rot }));
    pic.add(halo(k, .22, '#ffffff', .9, 'flare', at(cov, Math.cos(2.4) * CR, Math.sin(2.4) * CR, .05), { rot: .4 }));
    const tp = tip.clone().applyMatrix4(cart.matrix).toArray();
    pic.add(halo(k, .16, '#e8faff', 1, 'flare', tp, { rot: .3 }), halo(k, .08, '#ffffff', .9, 'star', tp));
    // specks of starlight all round
    const list = [];
    for (let i = 0; i < 130; i++) {
      const big = k.rand() < .08;
      list.push({ p: [k.range(-2.1, 2), k.range(-1.35, 1.55), k.range(-1.4, -.6)], s: k.range(.02, .05) * (big ? 2.4 : 1), color: k.pick(['#fff6dc', '#ffe3a0', '#ffffff', '#ffd08a', '#cfe2ff']) });
    }
    // and a drift of gold glitter round the record
    for (let i = 0; i < 90; i++) {
      const a = k.rand() * TAU, r = 1.08 + Math.abs(gauss(k)) * .28, P = at(rec, Math.cos(a) * r, Math.sin(a) * r, k.range(-.2, .3));
      list.push({ p: P, s: k.range(.018, .045) * (k.rand() < .1 ? 2 : 1), color: k.pick(['#ffe39a', '#ffd070', '#fff4d6', '#ffc04a']) });
    }
    pic.add(dots(k, list, new T.Quaternion()));
    for (const [x, y, s, rot] of [[1.62, .82, .26, .3], [-1.85, -.5, .2, .1], [1.2, -1.2, .18, .5], [-.1, 1.42, .16, .2]]) pic.add(halo(k, s, '#fff2cc', .85, 'flare', [x, y, .5], { rot }));
    return g;
  },

  // A Great Comet sweeping past: a two-lobed nucleus of dark, frosty ice spitting jets of gas, a blinding head in a
  // green coma with shells of gas nested round it, a dead-straight blue ion tail drawn out into streamers, and a broad
  // golden dust tail curving away below it, combed into striae and glittering all the way down.
  greatcomet(k) {
    const T = k.THREE, g = k.group(), v = { az: 30, el: 16, zoom: 1.14, lift: -.1 };
    setView(g, v, { zoom: 1.1, lift: -.12 });
    const pic = picture(k, v); g.add(pic);
    const M = (geo, mat, order = 0) => { const m = k.mesh(geo, mat, { shadow: false }); m.renderOrder = order; pic.add(m); return m; };
    const H = new T.Vector3(-1.8, -1, 0), AX = k.deg(35), dir = a => new T.Vector3(Math.cos(a), Math.sin(a), 0);   // the head, and the way its tails stream
    // the ion tail: dead straight, narrow and electric blue
    const LI = 5.6, DI = dir(AX + k.deg(9)), NI = dir(AX + k.deg(9) + Math.PI / 2);
    const ion = (wd, z) => strip(k, t => [H.clone().addScaledVector(DI, t * LI).setZ(z), NI.clone().multiplyScalar(wd(t) / 2)], 64, 8);
    // (each tail twice: first its own colour, laid over what's behind so the card's burst of light can't bleach it, then
    // its light, added on top)
    const bodyMat = map => new T.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: T.DoubleSide });
    M(ion(t => .16 + 1.2 * Math.pow(t, .8), -.44), bodyMat(ionTex(k, 2)), 1);
    M(ion(t => .16 + 1.2 * Math.pow(t, .8), -.42), addMat(k, { map: ionTex(k, 0), opacity: .8 }), 2);
    M(ion(t => .08 + .7 * Math.pow(t, .85), -.4), addMat(k, { map: ionTex(k, 1) }), 3);
    // the dust tail: a broad golden fan, curving away below it
    const LD = 5, aD = AX - k.deg(8), bend = k.deg(18);
    const dc = t => { const th = aD - bend * Math.pow(t, 1.5); return new T.Vector3(H.x + Math.cos(th) * LD * t, H.y + Math.sin(th) * LD * t, 0); };
    const across = t => { const D = dc(Math.min(1, t + .005)).sub(dc(Math.max(0, t - .005))).normalize(); return new T.Vector3(-D.y, D.x, 0); };
    const dW = t => .38 + 2.4 * t;
    const fan = (wd, z) => strip(k, t => [dc(t).setZ(z), across(t).multiplyScalar(wd(t) / 2)], 96, 16);
    M(fan(dW, -.48), bodyMat(dustTex(k, 2)), 1);
    M(fan(t => dW(t) * 1.3, -.5), addMat(k, { map: dustTex(k, 0), opacity: .7 }), 2);
    M(fan(dW, -.46), addMat(k, { map: dustTex(k, 1) }), 3);
    // the head: shells of gas nested round the nucleus, and a green coma round it all
    const hood = M(k.plane(1.7, 1.7), addMat(k, { map: hoodTex(k), color: '#c8fff0', opacity: .9 }), 4);
    hood.position.set(H.x, H.y, -.15); hood.rotation.z = AX;
    const hp = z => [H.x, H.y, z];
    pic.add(halo(k, 1.35, '#12a88c', .5, 'soft', hp(-.6), { normal: true, order: 1 }));
    const C = { order: 4 };
    pic.add(halo(k, .7, '#ffffff', .95, 'star', hp(-.3), C), halo(k, .9, '#c8fff0', .55, 'soft', hp(-.33), C), halo(k, 1.9, '#5cffc0', .5, 'soft', hp(-.35), C),
      halo(k, 3, '#34d6e6', .26, 'soft', hp(-.45), C), halo(k, 4.4, '#3d6bff', .12, 'soft', hp(-.55), C));
    pic.add(halo(k, 1.35, '#eafcff', .55, 'flare', hp(-.25), { rot: .22, order: 4 }));
    // the nucleus, and jets of gas bursting from its sunlit side, bending back into the coma
    const nuc = cometCore(k, .22); nuc.position.copy(H); nuc.rotation.set(.3, -.5, AX + .5); pic.add(nuc);
    const jets = [];
    for (const [da, len, curl, wd] of [[-6, .85, 38, .34], [34, .6, 45, .26], [-42, .56, -40, .24]]) {
      const a0 = AX + Math.PI + k.deg(da), P0 = H.clone().addScaledVector(dir(a0), .17), P1 = P0.clone().addScaledVector(dir(a0), len * .65), P2 = P1.clone().addScaledVector(dir(a0 + k.deg(curl)), len * .55);
      const cv = new T.QuadraticBezierCurve3(P0, P1, P2);
      jets.push(strip(k, t => { const P = cv.getPointAt(t), D = cv.getTangentAt(t); return [P.setZ(.02), new T.Vector3(-D.y, D.x, 0).multiplyScalar((.05 + wd * t) / 2)]; }, 24, 4));
    }
    M(k.merge(jets), addMat(k, { map: jetTex(k), color: '#f0ffff' }), 5);
    // dust glittering all down the tails, a few twinkles, and the stars behind
    const glit = [];
    for (let i = 0; i < 320; i++) {
      const t = .05 + .92 * Math.pow(k.rand(), 1.3), P = dc(t).addScaledVector(across(t), gauss(k) * .38 * dW(t) / 2);
      glit.push({ p: [P.x, P.y, k.range(-.35, -.1)], s: k.range(.014, .045) * (1 - .45 * t) * (k.rand() < .06 ? 2 : 1), color: k.pick(['#fff6dc', '#ffe3a0', '#ffd08a', '#ffffff', '#ffc2a8']) });
    }
    for (let i = 0; i < 70; i++) {
      const t = .06 + .9 * k.rand(), P = H.clone().addScaledVector(DI, t * LI).addScaledVector(NI, gauss(k) * (.05 + .3 * t));
      glit.push({ p: [P.x, P.y, -.3], s: k.range(.012, .03), color: k.pick(['#cfe8ff', '#9fd0ff', '#ffffff']) });
    }
    for (let i = 0; i < 70; i++) glit.push({ p: [k.range(-2.2, 3), k.range(-1.4, 2.2), -1.2], s: k.range(.015, .04), color: k.pick(['#ffffff', '#dfe8ff', '#fff2dc']) });
    pic.add(dots(k, glit, new T.Quaternion(), { order: 6 }));
    for (const [t, off, s, rot] of [[.18, .3, .3, .2], [.32, -.5, .22, .5], [.5, .45, .2, .1], [.7, -.2, .16, .3], [.42, -.05, .26, .4], [.62, .7, .18, .15], [.85, .2, .14, .5]]) {
      const P = dc(t).addScaledVector(across(t), off * dW(t) / 2);
      pic.add(halo(k, s, '#fff4d8', .85, 'flare', [P.x, P.y, .1], { rot, order: 6 }));
    }
    for (const [t, off, s, rot] of [[.26, .12, .2, .3], [.56, -.2, .16, .1]]) {
      const P = H.clone().addScaledVector(DI, t * LI).addScaledVector(NI, off);
      pic.add(halo(k, s, '#dff0ff', .85, 'flare', [P.x, P.y, .1], { rot, order: 6 }));
    }
    return g;
  },

  // A star nursery: three towering pillars of dark dust rising out of a cloud bank, their skins glowing gold and pink
  // where the light of a young cluster above strikes them, newborn stars blazing at their heads, all standing in
  // billows of teal, magenta and gold gas and dense with stars.
  nebula(k) {
    const T = k.THREE, g = k.group(), v = { az: 30, el: 16 };
    setView(g, v);
    const pic = picture(k, v); g.add(pic);
    const q0 = new T.Quaternion();
    // far behind: the glowing gas the pillars stand in, big enough to fill a full-art card, and a wash of colour past it
    pic.add(halo(k, 1, '#ffffff', 1, 'soft', [0, .35, -1.6], { map: nebulaBack(k), sx: 3.5, sy: 3.95 }));
    pic.add(halo(k, 3.8, '#27c9d9', .16, 'soft', [0, .8, -1.8]), halo(k, 2.6, '#ff3d9a', .15, 'soft', [-2.3, -.7, -1.8]), halo(k, 2.2, '#ffb14a', .12, 'soft', [2.2, .1, -1.8]));
    // stars behind the pillars
    const far = [];
    for (let i = 0; i < 300; i++) {
      const big = k.rand() < .05;
      far.push({ p: [k.range(-2.35, 2.35), k.range(-1.95, 1.98), -1.3], s: k.range(.012, .035) * (big ? 2.2 : 1), color: k.pick(['#ffffff', '#cfe3ff', '#ffe7c2', '#ffc8e6', '#bff7ff']) });
    }
    pic.add(dots(k, far, q0, { order: 1 }));
    // the pillars, laid over all that (not added to it), then the light on them added over the top
    const body = k.mesh(k.plane(4.8, 4.05), new T.MeshBasicMaterial({ map: nebulaPillars(k), transparent: true, depthWrite: false }), { p: [0, 0, -.5], shadow: false });
    const glow = k.mesh(k.plane(4.8, 4.05), addMat(k, { map: nebulaGlow(k) }), { p: [0, 0, -.45], shadow: false });
    body.renderOrder = 2; glow.renderOrder = 3; pic.add(body, glow);
    PILLARS.field = null;   // (both pictures are painted and kept now, so the field they came from can go)
    pic.add(halo(k, 1, '#ffffff', .8, 'soft', [0, -.2, .1], { map: nebulaWisps(k), sx: 2.8, sy: 2.4, order: 4 }));
    // newborn stars at the pillars' heads, and the young cluster above them, blue-white and blazing
    for (const [x, y, s, c] of [[-1.04, 1.34, .34, '#ffd6ec'], [-.84, 1.48, .2, '#ffe6c8'], [.44, .44, .32, '#ffe0f0'], [1.38, -.44, .26, '#e6f4ff']]) {
      pic.add(halo(k, s * 1.8, '#ff6fb6', .45, 'soft', [x, y, .2], { order: 5 }), halo(k, s * .7, c, 1, 'star', [x, y, .22], { order: 5 }), halo(k, s * 1.5, '#ffffff', .75, 'flare6', [x, y, .24], { order: 5 }));
    }
    for (let i = 0; i < 9; i++) {
      const x = PILLAR_LIGHT[0] + .3 + gauss(k) * .32, y = 1.86 + gauss(k) * .14, s = k.range(.1, .22);
      pic.add(halo(k, s, '#e8f4ff', .75, 'star', [x, y, .3], { order: 5 }), halo(k, s * 2.2, '#ffffff', .45, 'flare6', [x, y, .32], { order: 5 }));
    }
    pic.add(halo(k, 1.2, '#9fe8ff', .18, 'soft', [PILLAR_LIGHT[0] + .3, 1.86, .2], { order: 5 }));
    // stars in front
    const near = [];
    for (let i = 0; i < 90; i++) near.push({ p: [k.range(-2.35, 2.35), k.range(-1.95, 1.98), .5], s: k.range(.014, .04) * (k.rand() < .06 ? 2 : 1), color: k.pick(['#ffffff', '#ffe9f4', '#e0f0ff', '#fff2d6']) });
    pic.add(dots(k, near, q0, { order: 6 }));
    return g;
  },

  // A star blowing itself apart: a blinding white-blue core inside a fireball of its own burning insides, a broad ring
  // of shocked gas racing out round its waist with hot spots blazing along its front, jets squirting out of its poles,
  // a thin blue shell of the blast wave, flung glowing debris, light blazing out in every direction, and far out, rings
  // of old dust lit up by the flash.
  supernova(k) {
    const T = k.THREE, g = k.group(), v = { az: 30, el: 16 };
    setView(g, v, { zoom: 1.08 });
    const pic = picture(k, v); g.add(pic);
    const q0 = new T.Quaternion();
    const M = (geo, mat, order, o = {}) => { const m = k.mesh(geo, mat, { shadow: false, ...o }); m.renderOrder = order; pic.add(m); return m; };
    // Drawing order matters here: the colour of each layer of gas is laid over what's behind it (so the burst of light
    // behind the card's picture can't bleach it), far things first, and the light it gives off is added after.
    // far out: the light echoes and a wash of colour; light blazing out in every direction
    pic.add(halo(k, 3.4, '#ffffff', .8, 'soft', [0, 0, -3], { map: echoTex(k) }));
    pic.add(halo(k, 4.6, '#7a3cff', .16, 'soft', [0, 0, -3.2]), halo(k, 3.2, '#ff4d8d', .14, 'soft', [0, 0, -3.1]));
    pic.add(halo(k, 3.6, '#ffffff', .3, 'soft', [0, 0, -2.4], { map: burstTex(k) }));
    const RC = ['#ffffff', '#d6ecff', '#9fcfff', '#ffd9b0', '#ffa8dc', '#c9b0ff'];
    for (let i = 0; i < 24; i++) pic.add(ray(k, [0, 0, -.5], k.rand() * TAU, k.range(1.4, 4.2) * (k.rand() < .2 ? 1.3 : 1), k.range(.04, .14), k.pick(RC), k.range(.12, .32)));
    // the ring's tilt, and jets squirting out of the poles along its axis
    const A = new T.Vector3(.3, 1, .38).normalize(), qA = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), A), aJ = Math.atan2(A.y, A.x);
    for (const s of [0, Math.PI]) pic.add(ray(k, [0, 0, -.3], aJ + s, 3.1, .55, '#9fd4ff', .4), ray(k, [0, 0, -.3], aJ + s, 2.4, .16, '#ffffff', .45));
    // the blast wave's thin blue shell (its far side), and the ring's far half
    const blast = lumpyBall(k, 1.5, .14, 61), ej = lumpyBall(k, .98, .2, 62, 1.1), BR = [.5, .3, 0], ER = [-.3, .9, .2];
    const shell = (geo, r, col, map, o, side, order) => M(geo, rimMat(k, col, { map, normal: true, side, ...o }), order, { r });
    shell(blast, BR, '#6d5cff', shellTex(k, 0), { pow: 1.6, floor: .1, opacity: .5 }, T.BackSide, 1);
    const ex = new T.Vector3(1, 0, 0).applyQuaternion(qA), ey = new T.Vector3(0, 1, 0).applyQuaternion(qA), aNear = Math.atan2(ey.z, ex.z);
    const half = (a0, u0, order) => {
      const geo = () => remapUV(arcRing(k, a0, a0 + Math.PI, 1.2, 1.05, 96, 8), u0, u0 + .5);
      M(geo(), new T.MeshBasicMaterial({ map: shockTex(k, 1), transparent: true, depthWrite: false, side: T.DoubleSide }), order).quaternion.copy(qA);
      M(geo(), addMat(k, { map: shockTex(k, 0) }), order + .5).quaternion.copy(qA);
    };
    half(aNear + Math.PI / 2, .5, 2);
    // hot spots blazing along the shock's front, where it slams into the old gas round the star
    const far = [], near = [];
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * TAU + k.range(-.06, .06), P = new T.Vector3(Math.cos(a), Math.sin(a), 0).multiplyScalar(1.23 + k.range(0, .05)).applyQuaternion(qA);
      (P.z < 0 ? far : near).push({ p: P.toArray(), s: k.range(.08, .17), color: k.pick(['#ffffff', '#fff0f8', '#ffe0f0', '#e8f2ff']) });
    }
    pic.add(dots(k, far, q0, { kind: 'star', order: 3 }));
    // the fireball: the star's insides, burning orange, gold and crimson
    shell(ej, ER, '#ffffff', shellTex(k, 1), { pow: .8, floor: .6, opacity: .92 }, T.BackSide, 4);
    shell(ej, ER, '#ffffff', shellTex(k, 1), { pow: .8, floor: .6, opacity: .92 }, T.FrontSide, 5);
    M(ej, rimMat(k, '#ffffff', { map: shellTex(k, 1), pow: 1.2, floor: .3, opacity: .45 }), 5.5, { r: ER });
    // the ring's near half and its hot spots, then the blast wave's near side
    half(aNear - Math.PI / 2, 0, 6);
    pic.add(dots(k, near, q0, { kind: 'star', order: 7 }));
    shell(blast, BR, '#6d5cff', shellTex(k, 0), { pow: 1.6, floor: .1, opacity: .5 }, T.FrontSide, 8);
    M(blast, rimMat(k, '#cfe6ff', { map: shellTex(k, 0), pow: 2.2, opacity: .8 }), 8.5, { r: BR });
    // flung debris: glowing knots trailing streaks back toward the middle, the fastest out past the blast wave
    const DEB = ['#ff8a2a', '#ffb347', '#ff4fa3', '#ff6a3d', '#7ab8ff', '#a98bff', '#ffe0a0', '#ff3d6e'], bolts = [], knots = [];
    for (let i = 0; i < 200; i++) {
      const P = randDir(k).multiplyScalar(k.range(.8, 1.62)), pr = Math.hypot(P.x, P.y), a = Math.atan2(P.y, P.x);
      if (pr < .3) continue;
      const l = k.range(.12, .38) * (.4 + .6 * pr / 1.6), col = k.pick(DEB);
      bolts.push({ p: [P.x - Math.cos(a) * l * .32, P.y - Math.sin(a) * l * .32, P.z], a, s: [l, l * k.range(.14, .24), 1], color: col });
      if (k.rand() < .5) knots.push({ p: P.toArray(), s: k.range(.04, .09), color: col });
    }
    pic.add(dots(k, bolts, q0, { kind: 'bolt', order: 9 }), dots(k, knots, q0, { kind: 'star', order: 9 }));
    for (let i = 0; i < 26; i++) {
      const a = k.rand() * TAU, r = k.range(1.8, 3.1), l = k.range(.25, .6);
      pic.add(halo(k, 1, k.pick(DEB), .9, 'bolt', [Math.cos(a) * (r - l * .32), Math.sin(a) * (r - l * .32), -.2], { rot: a, sx: l / 2, sy: l * .1, order: 9 }));
    }
    // the core: too bright to look at
    M(k.sphere(.085, { w: 24, h: 16 }), new T.MeshBasicMaterial({ color: '#ffffff' }), 0);
    const C = { order: 10 };
    pic.add(halo(k, .42, '#ffffff', 1, 'star', [0, 0, .3], C), halo(k, .36, '#cfeaff', .5, 'soft', [0, 0, .2], C), halo(k, 1.6, '#5a8cff', .22, 'soft', [0, 0, -.2], C));
    pic.add(halo(k, 1.8, '#ffffff', .85, 'flare', [0, 0, .35], { rot: .18, order: 10 }), halo(k, 1.1, '#e0f0ff', .45, 'flare', [0, 0, .34], { rot: .18 + Math.PI / 4, order: 10 }));
    pic.add(halo(k, 1, '#a8d4ff', .5, 'streak', [0, 0, .36], { sx: 3.8, sy: .08, order: 10 }));
    // stars behind it all
    const sky = [];
    for (let i = 0; i < 170; i++) sky.push({ p: [k.range(-2.2, 2.2), k.range(-1.8, 1.8), -2.6], s: k.range(.012, .035), color: k.pick(['#ffffff', '#dfe8ff', '#ffe8f4', '#fff2dc']) });
    pic.add(dots(k, sky, q0));
    return g;
  },

  // A wormhole: a funnel of bent space spiralling down to a throat, its walls streaked with light and ruled with the grid
  // of the space it's bending, the stars round it drawn out into trails as they fall in, a blazing ring of light round
  // the throat, and through it, another galaxy under another sky.
  wormhole(k) {
    const T = k.THREE, g = k.group(), v = { az: 30, el: 16, zoom: 1.1 };
    setView(g, v, { zoom: 1.12, lift: -.04 });
    const pic = picture(k, v); g.add(pic);
    const q0 = new T.Quaternion();
    // the funnel (its own z out of its mouth), turned to look at us, a little up and to the left
    const wh = k.group(); pic.add(wh);
    wh.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(-.3, .42, 1).normalize());
    const rt = .56, RO = 2.3, ZD = 1.9;
    const prof = s => { const r = rt * Math.pow(RO / rt, s); return [r, -ZD * Math.pow(rt / r, 1.2)]; };
    const toCam = new T.Vector3(0, 0, 1).applyQuaternion(wh.quaternion.clone().invert());
    const inPic = (x, y, z) => new T.Vector3(x, y, z).applyQuaternion(wh.quaternion).toArray();
    // through the throat, another galaxy; round it, the walls and a ring of light
    wh.add(k.mesh(k.disc(rt * 1.01, 64), new T.MeshBasicMaterial({ map: farTex(k) }), { p: [0, 0, -ZD], shadow: false }));
    const dark = k.mesh(surfRev(k, s => prof(s * .78), 96, 48), new T.MeshBasicMaterial({ map: tunnelTex(k), transparent: true, depthWrite: false, side: T.DoubleSide }), { shadow: false });
    dark.renderOrder = 1; wh.add(dark);
    const wall = k.mesh(surfRev(k, prof, 192, 110), addMat(k, { map: swirlTex(k) }), { shadow: false });
    const ring = k.mesh(arcRing(k, 0, TAU, rt * .94, rt * .18, 160, 2), addMat(k, { map: lineTex(k), color: '#f2fbff' }), { p: [0, 0, -ZD + .01], shadow: false });
    wall.renderOrder = 2; ring.renderOrder = 3; wh.add(wall, ring);
    // starlight caught in it, streaking down in spirals
    const trails = [];
    for (let i = 0; i < 54; i++) {
      const a0 = k.rand() * TAU, s0 = k.range(.5, .97), s1 = Math.max(.05, s0 - k.range(.2, .45)), pts = [];
      for (let j = 0; j <= 20; j++) {
        const s = lerp(s0, s1, j / 20), a = a0 - TAU * .35 * (winding(s) - winding(s0)), [r, z] = prof(s);
        pts.push([r * Math.cos(a), r * Math.sin(a), z + .015]);
      }
      trails.push(glowLine(k, pts, t => .012 + .04 * t, toCam, 40));
    }
    const tm = k.mesh(k.merge(trails), addMat(k, { map: trailTex(k), color: '#e6f7ff' }), { shadow: false }); tm.renderOrder = 4; wh.add(tm);
    // the light of the far side welling up through the throat, and a few stars caught bright at the lip
    const th = inPic(0, 0, -ZD + .3);
    pic.add(halo(k, .9, '#ffd9a8', .45, 'soft', th, { order: 5 }), halo(k, .3, '#ffffff', .7, 'star', th, { order: 5 }));
    for (const [a, s] of [[.6, .3], [2.3, .22], [3.9, .26], [5.2, .18]]) { const [r, z] = prof(.42); pic.add(halo(k, s, '#ecfbff', .85, 'flare', inPic(r * Math.cos(a), r * Math.sin(a), z + .05), { rot: a, order: 6 })); }
    // the swirl of space all round, spilling out over the card, and the stars behind
    pic.add(halo(k, 1, '#ffffff', .75, 'soft', [0, 0, -2], { map: vortexTex(k), sx: 3.8, sy: 3.4 }), halo(k, 3.4, '#2fd6c6', .16, 'soft', [0, 0, -2.2]), halo(k, 2, '#8a5cff', .2, 'soft', [0, 0, -2.1]));
    const sky = [];
    for (let i = 0; i < 160; i++) sky.push({ p: [k.range(-2.3, 2.3), k.range(-2, 2), -2.5], s: k.range(.012, .035) * (k.rand() < .05 ? 2 : 1), color: k.pick(['#ffffff', '#dff4ff', '#ffe8f4', '#e8e0ff']) });
    pic.add(dots(k, sky, q0));
    return g;
  },
};
