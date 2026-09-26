// Models for the Backyard set's toys cards. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

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

const curveOf = (k, pts, closed = false) => new k.THREE.CatmullRomCurve3(pts.map(q => new k.THREE.Vector3(...q)), closed);

// A tube along a curve whose radius changes along the way: rad(s, L) is the radius at arc length s (of L).
function varTube(k, curve, rad, o = {}) {
  const T = k.THREE, seg = o.seg ?? 120, rs = o.rs ?? 28, L = curve.getLength();
  const geo = new T.TubeGeometry(curve, seg, 1, rs, false);
  const p = geo.attributes.position, P = new T.Vector3(), v = new T.Vector3();
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, P);
    const r = rad(i / seg * L, L);
    for (let j = 0; j <= rs; j++) {
      const n = i * (rs + 1) + j;
      v.fromBufferAttribute(p, n).sub(P).multiplyScalar(r).add(P);
      p.setXYZ(n, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return weld(geo);
}
// Round off the ends of a varTube: radius r0 along the middle, closing over the last `cap` of length at each end.
const capped = (r0, cap0, cap1 = cap0) => (s, L) => {
  let r = typeof r0 === 'function' ? r0(s, L) : r0;
  if (cap0 > 0 && s < cap0) { const q = s / cap0; r *= Math.sqrt(Math.max(0, q * (2 - q))); }
  if (cap1 > 0 && L - s < cap1) { const q = (L - s) / cap1; r *= Math.sqrt(Math.max(0, q * (2 - q))); }
  return r;
};

// Turn an object so its own axis (default +y) points along n.
const aim = (k, obj, n, axis = [0, 1, 0]) => { obj.quaternion.setFromUnitVectors(new k.THREE.Vector3(...axis), n.clone().normalize()); return obj; };
// Euler angles [x, y, z] that turn +y to point along d (for instance lists).
function eulerTo(k, d) {
  const T = k.THREE, e = new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...d).normalize()));
  return [e.x, e.y, e.z];
}
// A rod (cylinder) from a to b.
function rod(k, a, b, r, mat, seg = 16) {
  const A = new k.THREE.Vector3(...a), B = new k.THREE.Vector3(...b), d = B.clone().sub(A);
  const m = k.mesh(k.cyl(r, r, d.length(), { seg }), mat);
  m.position.copy(A).addScaledVector(d, .5);
  return aim(k, m, d);
}
// Points round a rounded rectangle in the xz plane (half-sizes hw, hd, corner radius rc), for rims and pinstripes.
function rrPts(hw, hd, rc, n = 12) {
  const pts = [], sx = hw - rc, sz = hd - rc;
  const edge = (x0, z0, x1, z1) => { for (let i = 1; i < 6; i++) pts.push([x0 + (x1 - x0) * i / 6, z0 + (z1 - z0) * i / 6]); };
  const arc = (cx, cz, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; pts.push([cx + Math.cos(a) * rc, cz + Math.sin(a) * rc]); } };
  arc(sx, sz, 0); edge(sx, hd, -sx, hd);
  arc(-sx, sz, Math.PI / 2); edge(-hw, sz, -hw, -sz);
  arc(-sx, -sz, Math.PI); edge(-sx, -hd, sx, -hd);
  arc(sx, -sz, Math.PI * 1.5); edge(hw, -sz, hw, sz);
  return pts;
}
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
// Merge indexed geometries that share the same attributes, keeping them indexed (k.merge un-indexes, which bloats
// big smooth meshes like a canopy of leafy lobes).
function mergeIndexed(k, geos) {
  const T = k.THREE, out = new T.BufferGeometry();
  let vCount = 0, iCount = 0;
  for (const g of geos) { vCount += g.attributes.position.count; iCount += g.index.count; }
  for (const name of Object.keys(geos[0].attributes)) {
    const size = geos[0].attributes[name].itemSize, arr = new Float32Array(vCount * size);
    let off = 0;
    for (const g of geos) { arr.set(g.attributes[name].array, off); off += g.attributes[name].count * size; }
    out.setAttribute(name, new T.BufferAttribute(arr, size));
  }
  const idx = new Uint32Array(iCount);
  let io = 0, vo = 0;
  for (const g of geos) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io++] = a[i] + vo; vo += g.attributes.position.count; }
  out.setIndex(new T.BufferAttribute(idx, 1));
  return out;
}
// The default camera's direction (az 30°, el 16°), for things that should face it.
const camDir = (k, az = 30, el = 16) => new k.THREE.Vector3(Math.sin(k.deg(az)) * Math.cos(k.deg(el)), Math.sin(k.deg(el)), Math.cos(k.deg(az)) * Math.cos(k.deg(el)));

// Soap film: nearly clear face-on, thickening to a rainbow sheen at the rim (alpha follows the viewing angle),
// with faint swirls of colour drifting over it.
function soapMat(k) {
  // a smooth greyscale swirl; the shader turns it into drifting bands of thin-film colour
  const swirl = k.tex(256, 128, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#303030'); gr.addColorStop(1, '#b0b0b0'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.filter = 'blur(6px)';
    for (let i = 0; i < 14; i++) {
      const y0 = k.rand() * h, a = k.range(6, 20), f = k.range(.02, .05), ph = k.rand() * 9, v = k.rand() * 255 | 0;
      c.strokeStyle = `rgb(${v},${v},${v})`; c.lineWidth = k.range(8, 22);
      c.beginPath(); for (let x = -16; x <= w + 16; x += 8) c.lineTo(x, y0 + Math.sin(x * f + ph) * a); c.stroke();
    }
    c.filter = 'none';
  });
  const m = k.mat({ color: '#10161c', roughness: .03, metalness: 0, transparent: true, depthWrite: false,
    iridescence: 1, iridescenceIOR: 1.33, iridescenceThicknessRange: [200, 700], clearcoat: 1, clearcoatRoughness: 0,
    envMapIntensity: 2.6, emissive: k.color('#000000'), emissiveMap: swirl, emissiveIntensity: 0 });
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      float rimF = 1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
      float sw = texture2D(emissiveMap, vEmissiveMapUv).g;
      vec3 film = 0.55 + 0.45 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + rimF * 1.4 + sw * 1.2));
      vec3 soapCol = outgoingLight + film * (0.16 + 1.15 * pow(rimF, 1.3)) + vec3(0.85) * pow(rimF, 4.0);
      gl_FragColor = vec4(soapCol, clamp(0.1 + 0.9 * pow(rimF, 1.6), 0.0, 1.0));`);
  };
  return m;
}
// A soap bubble with a window glint up on the left and a small one low on the right, so it reads at card size.
function bubble(k, parent, mat, glint, x, y, z, r) {
  const T = k.THREE, c = camDir(k), right = new T.Vector3(c.z, 0, -c.x).normalize(), up = new T.Vector3().crossVectors(c, right).normalize();
  k.add(parent, k.sphere(r, { w: 40, h: 28 }), mat, { p: [x, y, z], shadow: false }).receiveShadow = false;
  const spot = (du, dr, s, sq) => {
    const d = c.clone().multiplyScalar(.78).addScaledVector(up, du).addScaledVector(right, dr).normalize();
    const m = k.mesh(k.sphere(r * s, { w: 16, h: 10 }), glint, { p: [x + d.x * r, y + d.y * r, z + d.z * r], s: [1, sq, .3], shadow: false });
    m.receiveShadow = false; m.lookAt(m.position.clone().add(d)); m.rotateZ(.7); parent.add(m);
  };
  spot(.5, -.42, .2, .6);
  spot(-.45, .45, .08, .7);
}

export default {
  // Two fat water balloons, tied off and beaded with drops: a big pink one and a little yellow one.
  waterballoon(k) {
    const T = k.THREE, g = k.group();
    // a fat ball of water slumped on the grass: flat underneath, bulging at the sides, drawn up to a short neck
    const prof = [[0, 0], [.5, 0], [.86, .07], [1.1, .22], [1.22, .45], [1.24, .7], [1.17, .98], [1.0, 1.24], [.74, 1.44], [.46, 1.57], [.27, 1.63], [.2, 1.68]];
    const spline = new T.SplineCurve(prof.map(([r, y]) => new T.Vector2(r, y)));
    const body = k.lathe(prof, { smooth: true, seg: 72 });
    // drops of water: clear lenses that show the latex through them
    const drop = k.mat({ color: '#ffffff', roughness: .02, transmission: 1, thickness: .15, ior: 1.33, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.6 });
    const glint = k.glow('#ffffff', 1.4);
    const balloon = (col, deep, o) => {
      const b = k.group([], o); g.add(b);
      const grad = k.tex(4, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, deep); gr.addColorStop(.12, col); gr.addColorStop(1, col); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
      const latex = k.mat({ map: grad, roughness: .2, clearcoat: 1, clearcoatRoughness: .03, emissive: k.color(col), emissiveIntensity: .08 });
      k.add(b, body, latex);
      // a short neck leaning over, the tight knot, and the rolled lip poking out
      const neck = k.mat({ color: deep, roughness: .28, clearcoat: 1, clearcoatRoughness: .06 });
      const nc = curveOf(k, [[0, 1.64, 0], [0, 1.72, 0], [.03, 1.8, 0], [.1, 1.86, 0]]), nl = nc.getLength();
      k.add(b, varTube(k, nc, s => .205 - .09 * smooth(0, nl, s), { seg: 24, rs: 24 }), neck);
      const knot = aim(k, k.group([], { p: nc.getPointAt(1).toArray() }), nc.getTangentAt(1)); b.add(knot);
      k.add(knot, k.sphere(.16, { w: 24, h: 16 }), neck, { p: [0, .08, 0], s: [1, .78, .95] });
      k.add(knot, k.torus(.12, .055, { rs: 12, ts: 32 }), neck, { p: [.01, .1, 0], r: [Math.PI / 2 + .6, .2, .3] });
      k.add(knot, k.tube([[0, .14, 0], [.03, .24, .01], [.08, .31, .02]], .05, { rs: 10 }), neck);
      k.add(knot, k.torus(.065, .03, { rs: 10, ts: 24 }), neck, { p: [.085, .32, .02], r: [Math.PI / 2, 0, -.6] });
      // water beading on the side we see
      const drops = [], glints = [], toLight = new T.Vector3(-.3, .4, .3).applyAxisAngle(new T.Vector3(0, 1, 0), -o.r[1]);
      for (let i = 0, n = o.s ? 7 : 11; i < n; i++) {   // on the side facing the camera, whichever way the balloon is turned
        const t = k.range(.3, .78), phi = k.deg(k.range(-40, 100)) - o.r[1];
        const P = spline.getPoint(t), D = spline.getTangent(t);
        const N = new T.Vector3(D.y * Math.sin(phi), -D.x, D.y * Math.cos(phi)).normalize();
        const S = new T.Vector3(P.x * Math.sin(phi), P.y, P.x * Math.cos(phi));
        const d = k.range(.05, .11);
        drops.push({ p: S.clone().addScaledVector(N, d * .2).toArray(), r: eulerTo(k, N.toArray()), s: [d, d * .5, d] });
        glints.push({ p: S.clone().addScaledVector(N, d * .56).add(toLight.clone().multiplyScalar(d * .42)).toArray(), s: [d * .3, d * .2, d * .3] });
      }
      b.add(k.instances(k.sphere(1, { w: 20, h: 14 }), drop, drops));
      b.add(k.instances(k.sphere(1, { w: 10, h: 8 }), glint, glints));
    };
    balloon('#ff3d8e', '#d6116a', { r: [.05, .6, -.06] });
    balloon('#ffd21f', '#ffa600', { p: [-1.95, 0, .75], r: [-.06, 3.5, .08], s: .66 });
    g.userData.view = { az: 30, el: 20 };
    return g;
  },

  // A pink bottle of bubble mix, the wand held up out of it with a film across the ring, and bubbles drifting off.
  bubbles(k) {
    const T = k.THREE, g = k.group();
    const pink = k.gloss('#ff4f9a'), yellow = k.gloss('#ffcf2e');
    const bx = -.5;
    k.add(g, k.lathe([[0, 0], [.5, 0], [.57, .03], [.6, .1], [.6, 1.46], [.585, 1.58], [.52, 1.7], [.41, 1.79], [.32, 1.84], [.3, 1.88], [.3, 2.14], [.275, 2.16], [.25, 2.12], [.25, 1.9]], { seg: 56 }), pink, { p: [bx, 0, 0] });
    for (const y of [1.96, 2.04]) k.add(g, k.torus(.305, .018, { rs: 8, ts: 40 }), pink, { p: [bx, y, 0], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.disc(.25, 32), k.mat({ color: '#9fdcff', roughness: .05, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 500] }), { p: [bx, 2.0, 0], r: [-Math.PI / 2, 0, 0] });
    // the label
    const arc = 2.3, lh = .92, lr = .604;
    const lbl = k.painted(512, Math.round(512 * lh / (arc * lr)), (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ff4f9a'; c.fillRect(0, 0, w, h * .07); c.fillRect(0, h * .93, w, h * .07);
      for (const [x, y, r] of [[.07, .25, .07], [.13, .72, .05], [.92, .28, .06], [.86, .74, .085], [.96, .55, .035], [.04, .52, .035]]) {
        c.fillStyle = '#bfe6ff'; c.beginPath(); c.arc(x * w, y * h, r * w, 0, TAU); c.fill();
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc((x - r * .3) * w, y * h - r * w * .35, r * w * .28, 0, TAU); c.fill();
      }
      const word = 'BUBBLES', cols = ['#ff3d7f', '#ff8a00', '#18b458', '#2b7cf0', '#8a4cf0', '#ff3d7f', '#ff8a00'];
      const fs = h * .27;
      c.font = `700 ${fs}px Fredoka, system-ui, sans-serif`;
      const ws = [...word].map(ch => c.measureText(ch).width), tot = ws.reduce((a, b) => a + b, 0) + 6 * 2;
      let x = w / 2 - tot / 2;
      [...word].forEach((ch, i) => { k.text(c, ch, x + ws[i] / 2, h * .53 + (i % 2 ? -3 : 3), { size: fs, color: cols[i], stroke: '#ffffff', strokeWidth: 6 }); x += ws[i] + 2; });
    }, { rough: .35, coat: .6 });
    k.add(g, k.cyl(lr, lr, lh, { open: true, start: -arc / 2, len: arc, seg: 48 }), lbl, { p: [bx, .74, 0], r: [0, .55, 0], shadow: false });
    // the cap, upside down on the ground beside it
    const cap = k.group([], { p: [bx + .78, 0, .8] }); g.add(cap);
    k.add(cap, k.rcyl(.33, .28, .05, { seg: 40 }), yellow);
    k.add(cap, k.disc(.27, 32), k.plastic('#f0b400', { rough: .5 }), { p: [0, .282, 0], r: [-Math.PI / 2, 0, 0] });
    const ribs = []; for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; ribs.push({ p: [Math.sin(a) * .33, .14, Math.cos(a) * .33], r: [0, a, 0] }); }
    cap.add(k.instances(k.box(.03, .2, .02), yellow, ribs));
    // the wand: a stick out of the bottle, a ring on top facing us with a film of soap across it, and a drip
    const s0 = new T.Vector3(bx - .32, 1.2, 0), sd = new T.Vector3(Math.sin(.52), Math.cos(.52), .08).normalize();
    const cam = camDir(k), nz = cam.clone().addScaledVector(sd, -cam.dot(sd)).normalize(), nx = new T.Vector3().crossVectors(sd, nz).normalize();
    const wand = k.group(); wand.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(nx, sd, nz)); wand.position.copy(s0); g.add(wand);
    const SL = 1.95, R = .4, ry = SL + R + .02;
    k.add(wand, k.cyl(.045, .045, SL, { seg: 16 }), yellow, { p: [0, SL / 2, 0] });
    k.add(wand, k.torus(R, .05, { rs: 12, ts: 64 }), yellow, { p: [0, ry, 0], shadow: false }).receiveShadow = false;
    const nub = []; for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; nub.push({ p: [Math.sin(a) * (R - .05), ry + Math.cos(a) * (R - .05), 0], s: .035 }); }
    const nubs = k.instances(k.sphere(1, { w: 10, h: 8 }), yellow, nub); nubs.castShadow = nubs.receiveShadow = false; wand.add(nubs);
    const filmTex = k.tex(128, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      const cols = ['rgba(255,110,210,.42)', 'rgba(90,220,255,.4)', 'rgba(255,230,90,.4)', 'rgba(120,255,170,.36)', 'rgba(170,120,255,.4)'];
      for (let i = 0; i < 12; i++) { c.strokeStyle = cols[i % 5]; c.lineWidth = 6 + i; c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, h * (.1 + i * .075) + Math.sin(x * .06 + i) * 4); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(0, 0, w, h);
    });
    const film = k.mat({ map: filmTex, transparent: true, depthWrite: false, side: T.DoubleSide, roughness: .04, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.33, iridescenceThicknessRange: [200, 600] });
    k.add(wand, k.disc(R - .03, 48), film, { p: [0, ry, 0], shadow: false }).receiveShadow = false;
    // bubbles drifting off up and to the right, and a drip hanging from the ring
    const soap = soapMat(k), glint = k.glow('#ffffff', 1.3);
    wand.updateMatrix();
    const dp = new T.Vector3(Math.sin(.9) * R, ry - Math.cos(.9) * R, 0).applyMatrix4(wand.matrix);
    k.add(g, k.lathe([[0, 0], [.07, .016], [.1, .07], [.09, .12], [.06, .19], [.03, .26], [.024, .32], [0, .34]], { smooth: true, seg: 24 }), soap, { p: [dp.x, dp.y - .36, dp.z], shadow: false }).receiveShadow = false;
    k.add(g, k.sphere(.022, { w: 8, h: 6 }), glint, { p: [dp.x - .03, dp.y - .27, dp.z + .08], shadow: false }).receiveShadow = false;
    for (const [x, y, z, r] of [[1.55, 3.35, .35, .78], [2.75, 3.75, 0, .38], [3.15, 2.72, .4, .24], [.75, 3.95, .15, .2], [-1.3, 2.75, .4, .15], [3.4, 3.55, .5, .1], [1.95, 1.3, .9, .26], [-1.2, 1.55, .6, .18], [2.5, 2.2, .7, .12], [3.05, 1.35, .75, .2]]) bubble(k, g, soap, glint, x, y, z, r);
    return g;
  },

  // A teal pail of chunky pastel sidewalk chalk, two sticks on the ground, one worn down at a slant.
  chalk(k) {
    const g = k.group();
    const teal = k.gloss('#1fb4ae');
    const R0 = .92, R1 = 1.14, H = 1.5;
    k.add(g, k.lathe([[0, 0], [R0 - .08, 0], [R0, .05], [R1, H], [R1 - .07, H], [R0 - .06, .12], [0, .12]]), teal);
    k.add(g, k.torus(R1 - .02, .055, { rs: 12, ts: 80 }), teal, { p: [0, H, 0], r: [Math.PI / 2, 0, 0] });
    // label band
    const ya = .36, yb = 1.12, ra = R0 + (R1 - R0) * ya / H + .008, rb = R0 + (R1 - R0) * yb / H + .008, arc = 2.6;
    const lbl = k.painted(768, Math.round(768 * (yb - ya) / (arc * (ra + rb) / 2)), (c, w, h) => {
      c.fillStyle = '#fffaf0'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffd23a'; c.fillRect(0, 0, w, h * .1); c.fillRect(0, h * .9, w, h * .1);
      const word = 'CHALK', cols = ['#ff6fa3', '#4fa8f0', '#f5b400', '#3cc25c', '#9a6ff0'];
      c.font = `700 ${h * .62}px Fredoka, system-ui, sans-serif`;
      const ws = [...word].map(ch => c.measureText(ch).width), tot = ws.reduce((a, b) => a + b, 0) + 4 * 8;
      let x = w / 2 - tot / 2;
      [...word].forEach((ch, i) => { k.text(c, ch, x + ws[i] / 2, h * .54, { size: h * .62, color: cols[i] }); x += ws[i] + 8; });
      c.strokeStyle = '#f5a3c0'; c.lineWidth = 5; c.lineCap = 'round';
      for (const [cx, cy] of [[.15, .5], [.85, .5]]) { c.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5; c.lineTo(cx * w + Math.cos(a) * h * .22, cy * h + Math.sin(a) * h * .22); } c.closePath(); c.stroke(); }
    }, { rough: .4, coat: .4 });
    k.add(g, k.cyl(rb, ra, yb - ya, { open: true, start: -arc / 2, len: arc, seg: 64 }), lbl, { p: [0, (ya + yb) / 2, 0], r: [0, .5, 0], shadow: false });
    // wire bail with a grip, laid back
    const steel = k.metal('#c9ced6', .3), ey = H - .22;
    for (const s of [-1, 1]) k.add(g, k.cyl(.1, .1, .08, { seg: 20 }), teal, { p: [s * (R0 + (R1 - R0) * ey / H + .02), ey, 0], r: [0, 0, Math.PI / 2] });
    const bail = k.group([], { p: [0, ey, 0], r: [-1.05, 0, 0] }); g.add(bail);
    const bp = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI; bp.push([-Math.cos(a) * (R1 + .06), Math.sin(a) * (R1 + .1), 0]); }
    k.add(bail, k.tube(bp, .03, { seg: 80, rs: 8 }), steel);
    k.add(bail, k.capsule(.07, .5), k.gloss('#ffd23a'), { p: [0, R1 + .1, 0], r: [0, 0, Math.PI / 2] });
    // the chalk
    const speck = k.tex(128, 256, (c, w, h) => {
      c.fillStyle = '#f2f2f2'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1800; i++) { const v = k.rand(); c.fillStyle = v < .55 ? `rgba(255,255,255,${.3 + v})` : `rgba(0,0,0,${(v - .55) * .16})`; c.fillRect(k.rand() * w, k.rand() * h, 1 + k.rand() * 2, 1 + k.rand() * 2); }
    });
    const chalk = k.mat({ color: '#ffffff', map: speck, roughness: .96, bumpMap: speck, bumpScale: 1.2 });
    const cols = ['#f7a3c3', '#93cdf5', '#f9e07c', '#9fe39a', '#c6a6f2', '#fbbf86'];
    const stick = k.rcyl(.18, 2.1, .07, { seg: 28 }), sticks = [];
    [[0, 0], [.42, .1], [-.38, .22], [.12, .45], [-.1, -.42], [.4, -.35], [-.45, -.25], [.5, .42], [-.28, .56], [.2, -.62]].forEach(([x, z], i) => {
      const lean = .08 + .14 * Math.hypot(x, z), a = Math.atan2(x, z);
      sticks.push({ p: [x, .12, z], r: [Math.cos(a) * lean, 0, -Math.sin(a) * lean], s: [1, k.range(.84, 1.06), 1], color: cols[i % cols.length] });
    });
    g.add(k.instances(stick, chalk, sticks));
    // on the ground: a blue stick, and a pink one ground down at a slant, dusty at the tip
    k.add(g, stick, k.mat({ color: '#93cdf5', map: speck, roughness: .96, bumpMap: speck, bumpScale: 1.2 }), { p: [1.0, .18, 1.3], r: [0, .59, -Math.PI / 2], s: [1, .62, 1], order: 'YXZ' });
    const L = 1.7, r = .18, pts = [[0, 0]];
    for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i / 5 * Math.PI / 2; pts.push([r - .06 + Math.cos(a) * .06, .06 + Math.sin(a) * .06]); }
    for (let y = .15; y < L; y += .06) pts.push([r, y]);
    pts.push([r, L], [r * .6, L + .02], [0, L + .03]);
    const worn = k.lathe(pts, { seg: 32 }), wp = worn.attributes.position;
    for (let i = 0; i < wp.count; i++) { const x = wp.getX(i), y = wp.getY(i), cut = L - .34 + .6 * x; if (y > cut) wp.setY(i, cut + (y - cut) * .05); }
    worn.computeVertexNormals();
    const dusty = k.tex(128, 256, (c, w, h) => {
      c.fillStyle = '#f7a3c3'; c.fillRect(0, 0, w, h);
      const gr = c.createLinearGradient(0, 0, 0, h * .22); gr.addColorStop(0, '#fff0f5'); gr.addColorStop(1, 'rgba(255,240,245,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h * .22);
      for (let i = 0; i < 1800; i++) { const v = k.rand(); c.fillStyle = v < .55 ? `rgba(255,255,255,${.2 + v * .6})` : `rgba(120,40,70,${(v - .55) * .14})`; c.fillRect(k.rand() * w, k.rand() * h, 1 + k.rand() * 2, 1 + k.rand() * 2); }
    });
    const pinkMat = k.mat({ color: '#ffffff', map: dusty, roughness: .97, bumpMap: speck, bumpScale: 1.2 });
    const wyaw = -.16, wb = [-1.25, 1.58];
    k.add(g, worn, pinkMat, { p: [wb[0], .18, wb[1]], r: [0, wyaw, -Math.PI / 2], order: 'YXZ' });
    const crumbs = [];
    for (let i = 0; i < 12; i++) crumbs.push({ p: [wb[0] + Math.cos(wyaw) * (L + .22) + k.range(-.25, .3), .02, wb[1] - Math.sin(wyaw) * (L + .22) + k.range(-.3, .3)], s: [k.range(.02, .05), k.range(.015, .03), k.range(.02, .05)], r: [0, k.range(0, 3), 0] });
    g.add(k.instances(k.sphere(1, { w: 8, h: 6 }), k.mat({ color: '#f9b9d0', roughness: 1 }), crumbs));
    g.userData.view = { az: 30, el: 24 };
    return g;
  },

  // A bucket-moulded sand castle: a keep, four towers, a gate, a flag on a toothpick, a moat and a spade.
  sandcastle(k) {
    const T = k.THREE, g = k.group();
    const grains = k.tex(512, 512, (c, w, h) => {
      c.fillStyle = '#e6c78d'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { const v = k.rand(), s = 1 + k.rand() * 2; c.fillStyle = v < .5 ? `rgba(120,86,40,${.08 + v * .3})` : `rgba(255,250,235,${(v - .5) * .6})`; c.fillRect(k.rand() * w, k.rand() * h, s, s); }
    }, { repeat: [3, 3] });
    const bump = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 7000; i++) { const v = k.rand(); c.fillStyle = v > .5 ? `rgba(255,255,255,${(v - .5) * .9})` : `rgba(0,0,0,${(.5 - v) * .9})`; c.fillRect(k.rand() * w, k.rand() * h, 2, 2); }
    }, { data: true, repeat: [6, 6] });
    const sand = k.mat({ map: grains, bumpMap: bump, bumpScale: 1.6, roughness: .96 });
    const damp = k.mat({ map: grains, color: '#eadbc2', bumpMap: bump, bumpScale: 1.3, roughness: .85 });
    // the island, the moat, and the outer bank
    const piled = geo => {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), f = 1 + .012 * Math.sin(3 * a + 1) + .008 * Math.sin(7 * a + 2);
        p.setXYZ(i, x * f, y * (1 + .07 * Math.sin(5 * a + .5) + .04 * Math.sin(11 * a)), z * f);
      }
      geo.computeVertexNormals(); return weld(geo);
    };
    k.add(g, piled(k.lathe([[2.05, 0], [1.97, .1], [1.85, .22], [1.7, .31], [1.5, .34], [0, .34]], { smooth: true, seg: 80 })), sand);
    const ripples = k.tex(512, 512, (c, w, h) => {
      const gr = c.createRadialGradient(w / 2, h / 2, w * .3, w / 2, h / 2, w * .5);
      gr.addColorStop(0, '#1f8fd6'); gr.addColorStop(.5, '#3cb6ee'); gr.addColorStop(1, '#1f8fd6');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 2;
      for (let i = 0; i < 60; i++) { const a = k.rand() * TAU, rr = w * k.range(.36, .48), l = k.range(.04, .12); c.beginPath(); c.arc(w / 2, h / 2, rr, a, a + l); c.stroke(); }
    });
    k.add(g, k.ring(1.8, 2.75, 96), k.mat({ map: ripples, roughness: .04, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 1.3 }), { p: [0, .08, 0], r: [-Math.PI / 2, 0, 0] });
    k.add(g, piled(k.lathe([[3.15, 0], [2.98, .14], [2.78, .21], [2.6, .16], [2.5, .07], [2.47, 0]], { smooth: true, seg: 96 })), damp);
    // keep and towers: bucket shapes turned out, a lip round the top
    const bucket = (rb, rt, h) => k.lathe([[0, 0], [rb, 0], [rb - .02, .08], [rt, h - .14], [rt + .05, h - .1], [rt + .05, h], [0, h]], { seg: 48 });
    const merlons = [];
    const crown = (x, y, z, r, n) => { for (let i = 0; i < n; i++) { const a = i / n * TAU + .2; merlons.push({ p: [x + Math.sin(a) * r, y + .1, z + Math.cos(a) * r], r: [0, a, 0] }); } };
    const kz = -.3;
    k.add(g, bucket(.92, .78, 1.55), sand, { p: [0, .32, kz] });
    crown(0, .32 + 1.55, kz, .7, 9);
    const towers = [[-1.05, .72], [1.05, .72], [-1.05, -1.25], [1.05, -1.25]];
    for (const [x, z] of towers) { k.add(g, bucket(.5, .4, 1.05), sand, { p: [x, .29, z] }); crown(x, .29 + 1.05, z, .37, 6); }
    // walls between the towers, with a gate in the front one
    const wall = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0) - .7, a = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      k.add(g, k.box(.3, .62, len, .06), sand, { p: [cx, .3 + .31, cz], r: [0, a, 0] });
      for (let i = 0; i < 3; i++) { const t = (i - 1) / 3 * len; merlons.push({ p: [cx + Math.sin(a) * t, .3 + .62 + .1, cz + Math.cos(a) * t], r: [0, a, 0] }); }
    };
    wall(-1.05, .72, 1.05, .72); wall(-1.05, -1.25, 1.05, -1.25); wall(-1.05, -1.25, -1.05, .72); wall(1.05, -1.25, 1.05, .72);
    g.add(k.instances(k.box(.2, .2, .17, .04), sand, merlons));
    const arch = col => (c, cw, ch) => {
      c.clearRect(0, 0, cw, ch); c.fillStyle = col;
      c.beginPath(); c.moveTo(cw * .1, ch); c.lineTo(cw * .1, ch * .45); c.arc(cw / 2, ch * .45, cw * .4, Math.PI, 0); c.lineTo(cw * .9, ch); c.closePath(); c.fill();
    };
    g.add(k.decal(.42, .5, arch('#6b4a26'), { px: 64, p: [0, .3 + .25, .72 + .155] }));
    const win = (x, y, z, r, a) => g.add(k.decal(.16, .24, arch('#6b4a26'), { px: 32, p: [x + Math.sin(a) * r, y, z + Math.cos(a) * r], r: [0, a, 0] }));
    win(0, .32 + 1.08, kz, .83, .15); win(0, .32 + .62, kz, .87, -.35); win(-1.05, .3 + .66, .72, .45, .3); win(1.05, .3 + .66, .72, .45, .5);
    // the flag on a toothpick
    const ty = .32 + 1.55;
    k.add(g, k.cyl(.022, .022, 1.0, { seg: 10 }), k.matte('#ecd6a4', .7), { p: [0, ty + .5, kz] });
    const fl = new T.PlaneGeometry(.55, .34, 12, 4), fp = fl.attributes.position;
    for (let i = 0; i < fp.count; i++) { const u = (fp.getX(i) + .275) / .55, y = fp.getY(i); fp.setXYZ(i, u * .55, y * (1 - u * .92), Math.sin(u * 5) * .04 * u); }
    fl.computeVertexNormals();
    const flag = k.painted(64, 40, (c, w, h) => { c.fillStyle = '#ff3b3b'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.fillRect(0, h * .42, w, h * .16); }, { side: T.DoubleSide, rough: .8 });
    k.add(g, fl, flag, { p: [.02, ty + .82, kz], r: [0, .35, 0] });
    // a starfish and a scallop shell on the beach in front
    const star = new T.Shape();
    for (let i = 0; i <= 10; i++) { const a = i / 10 * TAU + Math.PI / 2, r = i % 2 ? .1 : .27; i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    k.add(g, k.extrude(star, .04, { bevel: .035, bevelSeg: 4 }), k.plastic('#ff8a4c', { rough: .6, coat: .2 }), { p: [-.45, .37, 1.62], r: [-Math.PI / 2 + .12, 0, .5] });
    const shell = new T.CircleGeometry(.2, 32, 0, Math.PI), shp = shell.attributes.position;
    for (let i = 0; i < shp.count; i++) { const x = shp.getX(i), y = shp.getY(i), r = Math.hypot(x, y) / .2, a = Math.atan2(y, x); shp.setZ(i, .07 * (1 - r * r) + .018 * r * Math.abs(Math.sin(a * 6))); }
    shell.computeVertexNormals();
    k.add(g, shell, k.plastic('#f9d4c8', { rough: .45, side: T.DoubleSide }), { p: [.62, .25, 1.72], r: [-Math.PI / 2 + .25, 0, 2.6] });
    // a red spade stuck in the bank
    const sp = k.group([], { p: [2.3, .17, 1.62], r: [-.15, .5, -.32], order: 'YXZ', s: .85 }); g.add(sp);
    k.add(g, k.sphere(1, { w: 24, h: 12, thetaLen: Math.PI / 2 }), damp, { p: [2.33, .17, 1.63], s: [.3, .09, .26] });
    const red = k.gloss('#ff4236');
    const blade = new T.Shape(); blade.moveTo(-.34, .7); blade.lineTo(.34, .7); blade.lineTo(.36, .22); blade.quadraticCurveTo(.3, -.08, 0, -.16); blade.quadraticCurveTo(-.3, -.08, -.36, .22); blade.closePath();
    const bg = k.extrude(blade, .04, { bevel: .02 }), bpp = bg.attributes.position;
    for (let i = 0; i < bpp.count; i++) { const x = bpp.getX(i); bpp.setZ(i, bpp.getZ(i) + .22 * x * x); }
    bg.computeVertexNormals();
    k.add(sp, bg, red);
    k.add(sp, k.cyl(.06, .07, 1.35, { seg: 16 }), red, { p: [0, .7 + .67, .02] });
    k.add(sp, k.capsule(.075, .36), red, { p: [0, 2.08, .02], r: [0, 0, Math.PI / 2] });
    g.userData.view = { az: 30, el: 26 };
    g.userData.fullView = { el: 22 };
    return g;
  },

  // A diamond kite in four bold panels, crossed spars, a tail of little bows and the line curving away.
  kite(k) {
    const T = k.THREE, g = k.group();
    const kg = k.group([], { r: [-.18, .42, -.38], order: 'YXZ' }); g.add(kg);
    const Tp = [0, 2.0], Rp = [1.3, 1.0], Bp = [0, -1.6], Lp = [-1.3, 1.0], C = [0, 1.0], X0 = -1.3, XW = 2.6, Y0 = -1.6, YH = 3.6;
    // the sail: four panels, each billowing back a little between spars and hem
    const pos = [], uv = [], idx = [], n = 14;
    for (const [A, B] of [[Tp, Rp], [Rp, Bp], [Bp, Lp], [Lp, Tp]]) {
      const base = pos.length / 3, rowStart = [];
      let o = 0; for (let i = 0; i <= n; i++) { rowStart.push(o); o += n - i + 1; }
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
        const a = i / n, b = j / n, c0 = 1 - a - b;
        const x = C[0] * c0 + A[0] * a + B[0] * b, y = C[1] * c0 + A[1] * a + B[1] * b;
        pos.push(x, y, -.24 * 27 * c0 * a * b); uv.push((x - X0) / XW, (y - Y0) / YH);
      }
      for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
        const p0 = base + rowStart[i] + j, p1 = p0 + 1, p2 = base + rowStart[i + 1] + j;
        idx.push(p0, p1, p2);
        if (j < n - i - 1) idx.push(p1, p2 + 1, p2);
      }
    }
    const sail = new T.BufferGeometry();
    sail.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); sail.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    sail.setIndex(idx); sail.computeVertexNormals(); weld(sail);
    const W = 400, H = Math.round(400 * YH / XW), P = ([x, y]) => [(x - X0) / XW * W, (1 - (y - Y0) / YH) * H];
    const sailMat = k.painted(W, H, (c) => {
      const tri = (a, b, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(...P(C)); c.lineTo(...P(a)); c.lineTo(...P(b)); c.closePath(); c.fill(); };
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
      tri(Lp, Tp, '#ff4a3d'); tri(Tp, Rp, '#ffd12e'); tri(Rp, Bp, '#2c7ff5'); tri(Bp, Lp, '#26c06a');
      const I = p => P([C[0] + (p[0] - C[0]) * .86, C[1] + (p[1] - C[1]) * .86]);
      c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 9; c.lineJoin = 'round';
      c.beginPath(); [Tp, Rp, Bp, Lp].forEach((p, i) => i ? c.lineTo(...I(p)) : c.moveTo(...I(p))); c.closePath(); c.stroke();
      c.fillStyle = 'rgba(0,0,0,.035)'; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 1.5);
    }, { rough: .5, side: T.DoubleSide });
    k.add(kg, sail, sailMat);
    const navy = k.plastic('#1d2a52', { rough: .5 }), wood = k.wood('pine', { varnish: .4 });
    const corners = [Tp, Rp, Bp, Lp].map(([x, y]) => [x, y, 0]);
    corners.forEach((a, i) => { kg.add(rod(k, a, corners[(i + 1) % 4], .028, navy, 8)); k.add(kg, k.sphere(.045, { w: 12, h: 8 }), navy, { p: a }); });
    kg.add(rod(k, [0, 2.07, .05], [0, -1.67, .05], .035, wood, 10));
    k.add(kg, k.tube([[-1.36, 1.0, .01], [0, 1.0, .15], [1.36, 1.0, .01]], .032, { rs: 10, caps: true }), wood);
    k.add(kg, k.box(.13, .13, .1, .03), k.gloss('#ff4a3d'), { p: [0, 1.0, .13], r: [0, 0, Math.PI / 4] });
    const str = k.matte('#f6f1e4', .6);
    const tow = [0, .75, .85];
    k.add(kg, k.tube([[0, 1.6, .06], [0, 1.2, .5], tow], .009, { rs: 5 }), str);
    k.add(kg, k.tube([[0, -.8, .06], [0, .05, .6], tow], .009, { rs: 5 }), str);
    // the line, curving away down to the left and fading out
    kg.updateMatrixWorld(true);
    const Tw = kg.localToWorld(new T.Vector3(...tow)), Bw = kg.localToWorld(new T.Vector3(0, -1.65, 0));
    const fade = k.tex(64, 4, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#fff'); gr.addColorStop(.4, '#fff'); gr.addColorStop(1, '#000'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, { data: true });
    const line = k.matte('#f6f1e4', .6, { transparent: true, alphaMap: fade, depthWrite: false });
    k.add(g, k.tube([[0, 0, 0], [-.4, -.28, .28], [-.9, -.8, .42], [-1.35, -1.45, .46], [-1.65, -2.1, .42]].map(([x, y, z]) => [Tw.x + x, Tw.y + y, Tw.z + z]), .015, { seg: 80, rs: 5 }), line, { shadow: false });
    // the tail: a string streaming off to the right with little bows along it
    const tc = curveOf(k, [[0, 0, 0], [.18, -.42, .05], [.52, -.74, .1], [.95, -.86, .12], [1.4, -1.06, .05], [1.85, -1.32, -.05], [2.25, -1.42, -.1]].map(([x, y, z]) => [Bw.x + x, Bw.y + y, Bw.z + z]));
    k.add(g, k.tube(tc.getPoints(60).map(v => v.toArray()), .016, { seg: 120, rs: 6 }), str);
    const bow = new T.Shape();
    bow.moveTo(0, 0); bow.lineTo(-.24, .12); bow.quadraticCurveTo(-.3, 0, -.24, -.12); bow.lineTo(0, 0); bow.lineTo(.24, -.12); bow.quadraticCurveTo(.3, 0, .24, .12); bow.closePath();
    const bowGeo = k.extrude(bow, .02, { bevel: .012 });
    const cam = camDir(k), bowCols = ['#ff4a3d', '#ffd12e', '#2c7ff5', '#26c06a', '#ff4a3d', '#ffd12e'];
    bowCols.forEach((col, i) => {
      const t = .1 + i * .16, p = tc.getPointAt(t), d = tc.getTangentAt(t);
      const xa = new T.Vector3().crossVectors(cam, d).normalize(), za = cam.clone().addScaledVector(xa, -cam.dot(xa)).normalize(), ya = new T.Vector3().crossVectors(za, xa);
      const b = k.group([], { p: p.toArray() }); b.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(xa, ya, za)); b.rotateZ(k.range(-.35, .35)); g.add(b);
      k.add(b, bowGeo, k.plastic(col, { rough: .5 }));
      k.add(b, k.sphere(.05, { w: 12, h: 8 }), k.plastic(col, { rough: .5 }), { s: [1, 1, .8] });
    });
    g.userData.floating = true;
    return g;
  },

  // A chunky neon pump-action water blaster with a see-through tank on top, two-thirds full.
  waterblaster(k) {
    const T = k.THREE, g = k.group(), b = k.group([], { r: [0, .22, 0] }); g.add(b);
    const neon = (c, e = .12) => k.gloss(c, { emissive: k.color(c), emissiveIntensity: e });
    const green = neon('#35e05a'), orange = neon('#ff7a14', .1), blue = neon('#1f7dff', .08), grey = k.plastic('#3a3f4a', { rough: .45 });
    // body: receiver and pistol grip in one chunky piece
    const s = new T.Shape();
    s.moveTo(1.1, 2.3); s.lineTo(-2.0, 2.3); s.quadraticCurveTo(-2.5, 2.3, -2.5, 1.85); s.lineTo(-2.45, 1.45);
    s.quadraticCurveTo(-2.4, 1.25, -2.45, 1.1); s.lineTo(-2.75, .25); s.quadraticCurveTo(-2.8, 0, -2.5, 0); s.lineTo(-1.95, 0);
    s.quadraticCurveTo(-1.75, 0, -1.72, .25); s.lineTo(-1.5, 1.0); s.quadraticCurveTo(-1.45, 1.2, -1.2, 1.2); s.lineTo(.6, 1.2);
    s.quadraticCurveTo(1.1, 1.2, 1.15, 1.6); s.lineTo(1.1, 2.3);
    const D = .5, bev = .16, zs = D / 2 + bev;
    k.add(b, k.extrude(s, D, { bevel: bev, bevelSeg: 4 }), green);
    // trigger guard and trigger
    k.add(b, k.tube([[-1.62, .62, 0], [-1.3, .42, 0], [-.9, .48, 0], [-.72, .85, 0], [-.7, 1.2, 0]], .075, { rs: 12, caps: true }), green);
    const trig = new T.Shape(); trig.moveTo(-1.05, 1.22); trig.quadraticCurveTo(-1.2, 1.0, -1.18, .76); trig.lineTo(-1.06, .74); trig.quadraticCurveTo(-1.02, .98, -.9, 1.22); trig.closePath();
    k.add(b, k.extrude(trig, .18, { bevel: .04 }), orange);
    // barrel, nozzle, pump
    k.add(b, k.cyl(.26, .26, 2.0, { seg: 32 }), blue, { p: [2.1, 1.95, 0], r: [0, 0, Math.PI / 2] });
    for (const x of [1.3, 2.9]) k.add(b, k.torus(.27, .05, { rs: 10, ts: 36 }), orange, { p: [x, 1.95, 0], r: [0, Math.PI / 2, 0] });
    k.add(b, k.lathe([[.3, 0], [.32, .06], [.3, .3], [.2, .42], [.12, .44], [0, .44]], { seg: 32 }), orange, { p: [3.05, 1.95, 0], r: [0, 0, -Math.PI / 2] });
    k.add(b, k.disc(.07, 16), k.matte('#0d1a2a', .6), { p: [3.495, 1.95, 0], r: [0, Math.PI / 2, 0] });
    k.add(b, k.cyl(.12, .12, 2.0, { seg: 20 }), grey, { p: [2.0, 1.3, 0], r: [0, 0, Math.PI / 2] });
    const pump = k.group([], { p: [1.7, 1.3, 0], r: [0, 0, -Math.PI / 2] }); b.add(pump);
    k.add(pump, k.lathe([[0, 0], [.26, 0], [.3, .06], [.3, .9], [.26, .96], [0, .96]], { seg: 32 }), orange);
    for (let i = 0; i < 5; i++) k.add(pump, k.torus(.3, .035, { rs: 8, ts: 32 }), orange, { p: [0, .2 + i * .14, 0], r: [Math.PI / 2, 0, 0] });
    k.add(b, k.box(.22, .75, .3, .08), orange, { p: [2.95, 1.62, 0] });
    // the tank: clear, with water two-thirds up and orange end caps
    const tr = .62, tcx = -.9, tcy = 2.3 + bev + tr, tl = 2.3;
    const wr = .58, lvl = -wr + .66 * wr * 2, th0 = Math.asin(lvl / wr), ws = new T.Shape();
    ws.moveTo(Math.cos(th0) * wr, lvl); ws.absarc(0, 0, wr, th0, Math.PI - th0, true); ws.closePath();
    const water = k.mat({ color: '#0a5fe0', transparent: true, opacity: .9, roughness: .06, clearcoat: 1, depthWrite: false, emissive: k.color('#0b6cf0'), emissiveIntensity: .3 });
    k.add(b, k.extrude(ws, tl - .1, { bevel: .03 }), water, { p: [tcx, tcy, 0], r: [0, Math.PI / 2, 0], shadow: false }).renderOrder = 1;
    const wl = Math.sqrt(wr * wr - lvl * lvl) + .02, foam = k.glow('#d8f2ff', .9);
    for (const side of [-1, 1]) k.add(b, k.cyl(.018, .018, tl - .12, { seg: 8 }), foam, { p: [tcx, tcy + lvl + .02, side * wl], r: [0, 0, Math.PI / 2], shadow: false }).renderOrder = 1;
    const tank = k.add(b, k.cyl(tr, tr, tl, { open: true, seg: 48 }), k.glass('#ffffff', { opacity: .14, env: 2 }), { p: [tcx, tcy, 0], r: [0, 0, Math.PI / 2], shadow: false });
    tank.renderOrder = 2;
    // gleams along the clear plastic
    const gleam = Object.assign(k.glow('#ffffff', 1), { transparent: true, opacity: .7, depthWrite: false });
    for (const [a, wd] of [[.95, .07], [1.25, .025]]) {
      const m = k.add(b, k.box(tl - .3, wd, .01), gleam, { p: [tcx, tcy + Math.sin(a) * (tr + .006), Math.cos(a) * (tr + .006)], r: [-a, 0, 0], shadow: false });
      m.renderOrder = 3;
    }
    for (const sgn of [-1, 1]) k.add(b, k.rcyl(tr + .05, .3, .1, { seg: 40 }), orange, { p: [tcx + sgn * (tl / 2 - .02), tcy, 0], r: [0, 0, sgn * -Math.PI / 2] });
    k.add(b, k.rcyl(.22, .2, .05, { seg: 32 }), orange, { p: [tcx + .7, tcy + tr - .04, 0] });
    k.add(b, k.box(1.9, .3, .62, .1), green, { p: [tcx, 2.3 + bev + .05, 0] });
    // decals: a grip pad and a SPLASH badge
    b.add(k.decal(.5, .82, (c, w, h) => { c.fillStyle = '#2b3140'; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, w * .3); c.fill(); c.fillStyle = 'rgba(255,255,255,.12)'; for (let y = h * .12; y < h * .9; y += h / 9) c.fillRect(w * .15, y, w * .7, h * .03); }, { px: 64, p: [-2.2, .62, zs + .004], r: [0, 0, .33] }));
    b.add(k.decal(1.45, .5, (c, w, h) => {
      c.fillStyle = '#1f7dff'; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, h * .45); c.fill();
      c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(w * .12, h * .2); c.quadraticCurveTo(w * .07, h * .55, w * .12, h * .78); c.quadraticCurveTo(w * .17, h * .55, w * .12, h * .2); c.fill();
      c.save(); c.translate(w * .56, h * .54); c.transform(1, 0, -.22, 1, 0, 0); k.text(c, 'SPLASH', 0, 0, { size: h * .56, color: '#ffffff', stroke: '#0c3f99', strokeWidth: 5 }); c.restore();
    }, { px: 320, p: [-.55, 1.76, zs + .004] }));
    const gauge = k.group([], { p: [.62, 1.82, zs], r: [Math.PI / 2, 0, 0] }); b.add(gauge);
    k.add(gauge, k.rcyl(.24, .07, .03, { seg: 32 }), orange);
    k.add(gauge, k.disc(.19, 32), k.painted(128, 128, (c, w, h) => {
      c.fillStyle = '#fbfaf4'; c.fillRect(0, 0, w, h);
      c.lineWidth = 12; c.strokeStyle = '#2fd05a'; c.beginPath(); c.arc(w / 2, h / 2, 42, Math.PI * .75, Math.PI * 1.5); c.stroke();
      c.strokeStyle = '#ffb000'; c.beginPath(); c.arc(w / 2, h / 2, 42, Math.PI * 1.5, Math.PI * 1.9); c.stroke();
      c.strokeStyle = '#ff3b30'; c.beginPath(); c.arc(w / 2, h / 2, 42, Math.PI * 1.9, Math.PI * 2.25); c.stroke();
      c.strokeStyle = '#1b2230'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + 36, h / 2 - 22); c.stroke();
      c.fillStyle = '#1b2230'; c.beginPath(); c.arc(w / 2, h / 2, 8, 0, TAU); c.fill();
    }, { rough: .3, coat: 1 }), { p: [0, .072, 0], r: [-Math.PI / 2, 0, 0] });
    const screws = [[-2.2, 2.05], [1.0, 2.12], [-.8, 1.4], [1.0, 1.42]].map(([x, y]) => ({ p: [x, y, zs], r: [Math.PI / 2, 0, 0] }));
    b.add(k.instances(k.cyl(.05, .05, .03, { seg: 12 }), grey, screws));
    g.userData.view = { az: 22, el: 14 };
    return g;
  },

  // The classic red steel wagon: rolled rim, black wheels with chrome hubcaps, a long handle, and a bear riding along.
  wagon(k) {
    const g = k.group(), w = k.group([], { r: [0, -.1, 0] }); g.add(w);
    const red = k.gloss('#d9261c'), black = k.gloss('#1b1c20'), rub = k.rubber('#161618'), chrome = k.chrome(), steel = k.metal('#9aa1ab', .35);
    const y0 = .8, hw = 1.7, hd = .8, H = .48;
    const outer = k.roundRect(hw * 2, hd * 2, .22), inner = k.roundRect(hw * 2 - .1, hd * 2 - .1, .17); outer.holes.push(inner);
    k.add(w, k.extrude(outer, H, { bevel: .012 }), red, { p: [0, y0 + H / 2, 0], r: [-Math.PI / 2, 0, 0] });
    k.add(w, k.box(hw * 2 - .06, .05, hd * 2 - .06, .02), red, { p: [0, y0 + .025, 0] });
    k.add(w, k.tube(rrPts(hw - .025, hd - .025, .2).map(([x, z]) => [x, y0 + H + .01, z]), .058, { closed: true, seg: 260, rs: 12 }), red);
    k.add(w, k.tube(rrPts(hw + .006, hd + .006, .225).map(([x, z]) => [x, y0 + H - .12, z]), .014, { closed: true, seg: 260, rs: 6 }), k.gloss('#f6efe2'));
    // undercarriage: axles, brackets, the steering plate and yoke
    for (const x of [-1.12, 1.12]) {
      k.add(w, k.cyl(.04, .04, 2.16, { seg: 12 }), steel, { p: [x, .46, 0], r: [Math.PI / 2, 0, 0] });
      for (const s of [-1, 1]) k.add(w, k.box(.12, .34, .08, .02), black, { p: [x, .63, s * .55] });
    }
    k.add(w, k.cyl(.32, .32, .06, { seg: 32 }), black, { p: [1.12, .75, 0] });
    k.add(w, k.box(.6, .1, .2, .03), black, { p: [1.42, .46, 0] });
    // wheels
    for (const x of [-1.12, 1.12]) for (const s of [-1, 1]) {
      const wh = k.group([], { p: [x, .46, s * 1.0] }); w.add(wh);
      k.add(wh, k.torus(.33, .13, { rs: 16, ts: 56 }), rub);
      k.add(wh, k.cyl(.3, .3, .2, { seg: 40 }), black, { r: [Math.PI / 2, 0, 0] });
      k.add(wh, k.sphere(.19, { thetaLen: Math.PI / 2, w: 32, h: 12 }), chrome, { p: [0, 0, s * .09], r: [s * Math.PI / 2, 0, 0], s: [1, .55, 1] });
    }
    // the long handle with its T-grip
    const hA = [1.62, .46, 0], ha = k.deg(52), hl = 2.25, hB = [hA[0] + Math.cos(ha) * hl, hA[1] + Math.sin(ha) * hl, 0];
    w.add(rod(k, hA, hB, .045, red));
    k.add(w, k.cyl(.06, .06, .26, { seg: 16 }), steel, { p: hA, r: [Math.PI / 2, 0, 0] });
    k.add(w, k.capsule(.075, .5), black, { p: hB, r: [Math.PI / 2, 0, 0] });
    // cargo: a beach ball and a teddy bear
    const ballTex = k.tex(512, 256, (c, cw, ch) => {
      ['#ff3b30', '#ffffff', '#2f7cf6', '#ffcc00', '#ffffff', '#2fbf5a'].forEach((col, i) => { c.fillStyle = col; c.fillRect(i * cw / 6, 0, cw / 6 + 1, ch); });
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, cw, ch * .1); c.fillRect(0, ch * .9, cw, ch * .1);
    });
    k.add(w, k.sphere(.42, { w: 48, h: 32 }), k.gloss('#ffffff', { map: ballTex }), { p: [.8, y0 + .05 + .42, .05], r: [.85, .5, .25] });
    const bear = k.group([], { p: [-.85, y0 + .05, 0], r: [0, .45, 0], s: .62 }); w.add(bear);
    const fur = k.fabric('#c08a55', { sheen: '#f0d0a0' }), light = k.fabric('#f1dcb8'), dark = k.gloss('#2b1a10');
    k.add(bear, k.sphere(.5, { w: 32, h: 24 }), fur, { p: [0, .5, 0], s: [1, 1.08, .88] });
    k.add(bear, k.sphere(.28, { w: 24, h: 16 }), light, { p: [0, .44, .34], s: [1, 1.1, .45] });
    for (const s of [-1, 1]) {
      k.add(bear, k.sphere(.22, { w: 24, h: 16 }), fur, { p: [s * .28, .2, .38], s: [.95, .85, 1.4] });
      k.add(bear, k.sphere(.15, { w: 20, h: 14 }), light, { p: [s * .28, .2, .67], s: [1, 1, .3] });
      k.add(bear, k.sphere(.18, { w: 24, h: 16 }), fur, { p: [s * .5, .62, .14], s: [.75, 1.45, .8], r: [-.5, 0, s * .45] });
    }
    const Hd = [0, 1.22, .05], hr = .43;
    k.add(bear, k.sphere(hr, { w: 40, h: 28 }), fur, { p: Hd });
    k.add(bear, k.sphere(.19, { w: 24, h: 16 }), light, { p: [0, 1.1, .4], s: [1.15, .85, .85] });
    k.add(bear, k.sphere(.07, { w: 16, h: 12 }), dark, { p: [0, 1.17, .56], s: [1.35, .85, .8] });
    for (const s of [-1, 1]) {
      k.add(bear, k.sphere(.055, { w: 16, h: 12 }), dark, { p: [s * .16, 1.3, .4] });
      k.add(bear, k.sphere(.016, { w: 8, h: 6 }), k.glow('#ffffff', 1), { p: [s * .16 + .02, 1.32, .45] });
      k.add(bear, k.sphere(.15, { w: 20, h: 14 }), fur, { p: [s * .32, 1.55, 0], s: [1, 1, .5] });
      k.add(bear, k.sphere(.09, { w: 16, h: 12 }), light, { p: [s * .32, 1.54, .05], s: [1, 1, .35] });
    }
    const bowM = k.plastic('#2f7cf6', { rough: .45, coat: .3 });
    for (const s of [-1, 1]) k.add(bear, k.sphere(.12, { w: 16, h: 12 }), bowM, { p: [s * .12, .9, .36], s: [1.3, .8, .5], r: [0, 0, s * .3] });
    k.add(bear, k.sphere(.05, { w: 12, h: 8 }), bowM, { p: [0, .9, .4] });
    g.userData.view = { az: 30, el: 22 };
    return g;
  },

  // A plank-built treehouse in the crook of a big leafy tree: red shingle roof, a lit window, a porch and a rope ladder.
  treehouse(k) {
    const T = k.THREE, g = k.group(), nz = noise3(k);
    /* the tree */
    const barkTex = k.tex(512, 256, (c, w, h) => {
      c.fillStyle = '#7b5536'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 110; i++) {
        const y0 = k.rand() * h, amp = k.range(1.5, 5), f = k.range(.01, .04), ph = k.rand() * 9, dk = k.rand() < .7;
        c.strokeStyle = dk ? `rgba(48,28,14,${k.range(.25, .6)})` : `rgba(170,130,90,${k.range(.15, .35)})`;
        c.lineWidth = dk ? k.range(2, 6) : k.range(1, 3);
        c.beginPath(); for (let x = -10; x <= w + 10; x += 10) c.lineTo(x, y0 + Math.sin(x * f + ph) * amp); c.stroke();
      }
    }, { repeat: [2, 2] });
    const bark = k.mat({ map: barkTex, bumpMap: barkTex, bumpScale: 4, roughness: .92 });
    const trunk = curveOf(k, [[0, 0, -1.0], [.05, 1.4, -1.1], [-.03, 2.8, -1.35], [.04, 4.4, -1.8], [0, 6.4, -2.3], [.1, 8.6, -2.6]]);
    k.add(g, varTube(k, trunk, capped((s, L) => .86 - .5 * s / L + .62 * Math.exp(-s / .5), 0, .5), { seg: 70, rs: 40 }), bark);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU + .4 + k.range(-.2, .2), dx = Math.sin(a), dz = Math.cos(a);
      const rc = curveOf(k, [[dx * .5, 1.0, -1.0 + dz * .5], [dx * 1.1, .48, -1.0 + dz * 1.1], [dx * 1.7, .16, -1.0 + dz * 1.7], [dx * 2.25, .06, -1.0 + dz * 2.25]]);
      k.add(g, varTube(k, rc, capped((s, L) => .5 - .42 * s / L, 0, .1), { seg: 30, rs: 16 }), bark);
    }
    const limb = (pts, r0, r1) => { const c = curveOf(k, pts); k.add(g, varTube(k, c, capped((s, L) => r0 + (r1 - r0) * s / L, 0, r1 * 1.5), { seg: 48, rs: 20 }), bark); return c; };
    const left = limb([[0, 3.8, -1.5], [-.9, 4.8, -1.8], [-2.1, 6.0, -2.0], [-3.2, 7.4, -2.0]], .55, .22);
    limb([[0, 4.1, -1.7], [1.0, 5.0, -2.0], [2.2, 6.2, -2.2], [3.3, 7.6, -1.9]], .52, .22);
    const twig = limb([[-2.0, 5.9, -2.0], [-2.9, 6.2, -1.6], [-3.8, 6.5, -1.2]], .26, .12);
    const twigR = limb([[2.1, 6.1, -2.2], [3.0, 6.4, -1.7], [3.9, 6.7, -1.2]], .25, .12);
    // the canopy: soft lobes, sunlit on top and shaded underneath, covered in leaves that fringe the outline
    const dark = k.color('#133f1c'), mid = k.color('#2c8034'), light = k.color('#9ccf52');
    const shade = t => dark.clone().lerp(mid, smooth(0, .5, t)).lerp(light, smooth(.5, 1, t));
    const clumps = [[-3.6, 7.8, -1.9, 1.9], [3.7, 8.0, -1.8, 1.9], [0, 9.0, -2.5, 2.3], [-2.1, 9.7, -2.0, 1.7], [2.1, 9.8, -2.2, 1.7], [-5.0, 6.7, -1.2, 1.15], [5.0, 6.9, -1.1, 1.05], [0, 7.6, -3.7, 2.1]];
    const puffs = [];
    for (const [x, y, z, r] of clumps) {
      puffs.push([x, y, z, r * .92]);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + k.range(-.4, .4), e = k.range(-.1, .85), d = [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
        puffs.push([x + d[0] * r * .62, y + d[1] * r * .4, z + d[2] * r * .62, r * k.range(.42, .6)]);
      }
    }
    k.add(g, mergeIndexed(k, puffs.map(([x, y, z, r]) => {
      const geo = k.sphere(1, { w: 36, h: 24 }), p = geo.attributes.position, cols = [], o = [k.range(0, 50), k.range(0, 50), k.range(0, 50)];
      for (let i = 0; i < p.count; i++) {
        const dx = p.getX(i), dy = p.getY(i), dz = p.getZ(i), n1 = nz.fbm(dx * 1.3 + o[0], dy * 1.3 + o[1], dz * 1.3 + o[2], 2), bmp = 1 + .1 * n1;
        const wy = y + dy * bmp * r * (dy < 0 ? .8 : 1);
        p.setXYZ(i, x + dx * bmp * r, wy, z + dz * bmp * r);
        const col = shade(clamp01(.2 + .34 * dy + .3 * (wy - 6.5) / 5 + .2 * n1));
        cols.push(col.r, col.g, col.b);
      }
      geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
      geo.computeVertexNormals(); weld(geo);
      return geo;
    })), k.mat({ vertexColors: true, roughness: .85 }));
    const foliage = [], Y = new T.Vector3(0, 1, 0), q = new T.Quaternion(), q2 = new T.Quaternion(), e = new T.Euler();
    const inside = (px, py, pz, skip) => puffs.some(([x, y, z, r], j) => j !== skip && (px - x) ** 2 + ((py - y) / (py < y ? .8 : 1)) ** 2 + (pz - z) ** 2 < (r * .96) ** 2);
    for (let n = 0; n < 6000 && foliage.length < 2600; n++) {
      const j = Math.floor(k.rand() * puffs.length), [x, y, z, r] = puffs[j];
      const u = k.range(-.45, 1), a = k.rand() * TAU, sq = Math.sqrt(1 - u * u), d = new T.Vector3(sq * Math.cos(a), u, sq * Math.sin(a));
      const px = x + d.x * r, py = y + d.y * r * (d.y < 0 ? .8 : 1), pz = z + d.z * r;
      if (inside(px, py, pz, j)) continue;
      const sz = k.range(.2, .32);
      q.setFromUnitVectors(Y, d).multiply(q2.setFromEuler(e.set(k.range(-.95, .95), k.rand() * TAU, k.range(-.7, .7))));
      e.setFromQuaternion(q);
      foliage.push({ p: [px + d.x * .03, py + d.y * .03, pz + d.z * .03], r: [e.x, e.y, e.z], s: [sz, sz * .22, sz * .55], color: shade(clamp01(.34 + .38 * d.y + .3 * (py - 6.5) / 5 + k.range(-.2, .2))) });
    }
    g.add(k.instances(k.sphere(1, { w: 8, h: 6 }), k.mat({ color: '#ffffff', roughness: .55, sheen: .3, sheenColor: k.color('#dcffb8'), sheenRoughness: .5 }), foliage));
    // a few red apples among the leaves on the side we see
    const cam = camDir(k), apples = [], stems = [];
    for (let n = 0; n < 400 && apples.length < 9; n++) {
      const [x, y, z, r] = puffs[Math.floor(k.rand() * puffs.length)];
      const d = new T.Vector3(k.range(-1, 1), k.range(-.6, .5), k.range(-1, 1)).normalize();
      if (d.dot(cam) < .45) continue;
      const px = x + d.x * r, py = y + d.y * r * (d.y < 0 ? .8 : 1), pz = z + d.z * r;
      if (puffs.some(([qx, qy, qz, qr]) => (px - qx) ** 2 + ((py - qy) / (py < qy ? .8 : 1)) ** 2 + (pz - qz) ** 2 < (qr * .98) ** 2)) continue;
      if (apples.some(a => Math.hypot(a.p[0] - px, a.p[1] - py, a.p[2] - pz) < 1.3)) continue;
      const ar = k.range(.15, .19);
      apples.push({ p: [px + d.x * .06, py + d.y * .06, pz + d.z * .06], s: [ar, ar * .9, ar], r: [0, k.rand() * TAU, 0] });
      stems.push({ p: [px + d.x * .06, py + d.y * .06 + ar * .95, pz + d.z * .06], r: [k.range(-.3, .3), 0, k.range(-.3, .3)] });
    }
    g.add(k.instances(k.sphere(1, { w: 20, h: 14 }), k.gloss('#e0302a'), apples));
    g.add(k.instances(k.cyl(.018, .025, .12, { seg: 6 }), k.matte('#5a3b1c', .8), stems));
    // a tire swing on the low left branch
    const swp = twig.getPointAt(.72), rope = k.fabric('#d6b37a', { weave: false });
    k.add(g, k.tube([[swp.x, swp.y, swp.z], [swp.x, 1.9, swp.z]], .04, { seg: 8, rs: 8 }), rope);
    const tire = k.group([], { p: [swp.x, 1.35, swp.z], r: [0, .5, 0] }); g.add(tire);
    k.add(tire, k.torus(.42, .2, { rs: 16, ts: 48 }), k.rubber('#222226'));
    k.add(tire, k.torus(.3, .04, { rs: 8, ts: 40 }), rope, { p: [0, .35, 0], r: [Math.PI / 2, 0, 0], s: [.35, 1, 1] });
    // and a pail on a rope, for hauling supplies up
    const bp = twigR.getPointAt(.6), by = 3.05;
    k.add(g, k.tube([[bp.x, bp.y, bp.z], [bp.x, by + .62, bp.z]], .025, { seg: 6, rs: 6 }), rope);
    const pail = k.group([], { p: [bp.x, by, bp.z], r: [0, .4, 0] }); g.add(pail);
    k.add(pail, k.lathe([[0, 0], [.2, 0], [.22, .02], [.29, .42], [.31, .44], [.27, .44], [.2, .06], [0, .06]], { seg: 32 }), k.gloss('#e8453c'));
    k.add(pail, k.torus(.3, .015, { rs: 6, ts: 32, arc: Math.PI }), k.metal('#c9ced6', .3), { p: [0, .42, 0] });
    /* the house */
    const yd = 4.0;
    const plankTex = (vert, tones, seam = 'rgba(60,32,14,.75)') => k.tex(256, 256, (c, w, h) => {
      const n = 4;
      for (let i = 0; i < n; i++) {
        const a = i * (vert ? w : h) / n, b = (vert ? w : h) / n;
        c.fillStyle = tones[i % tones.length]; vert ? c.fillRect(a, 0, b, h) : c.fillRect(0, a, w, b);
        for (let j = 0; j < 7; j++) {
          c.strokeStyle = `rgba(90,50,20,${k.range(.1, .25)})`; c.lineWidth = k.range(.8, 2); c.beginPath();
          const off = a + k.range(.15, .85) * b;
          for (let t = 0; t <= (vert ? h : w); t += 16) { const q = off + Math.sin(t * .03 + j) * 2; vert ? c.lineTo(q, t) : c.lineTo(t, q); }
          c.stroke();
        }
        c.fillStyle = seam; vert ? c.fillRect(a, 0, 3, h) : c.fillRect(0, a, w, 3);
        c.fillStyle = 'rgba(255,230,190,.25)'; vert ? c.fillRect(a + 3, 0, 2, h) : c.fillRect(0, a + 3, w, 2);
      }
    }, { repeat: 1 });
    const tones = ['#c98e55', '#b97c47', '#d49b62', '#bf8450'];
    const boardsH = k.mat({ map: plankTex(false, tones), roughness: .7 }), boardsV = k.mat({ map: plankTex(true, tones), roughness: .7 });
    const trim = k.wood('walnut', { rough: .6 }), pine = k.wood('pine', { rough: .6 });
    // deck, joists and knee braces
    const deckTex = k.tex(512, 256, (c, w, h) => {
      const n = 15;
      for (let i = 0; i < n; i++) { c.fillStyle = tones[i % 4]; c.fillRect(i * w / n, 0, w / n, h); c.fillStyle = 'rgba(60,32,14,.7)'; c.fillRect(i * w / n, 0, 2, h); }
    });
    k.add(g, k.box(4.6, .2, 4.3, .02), k.mat({ map: deckTex, roughness: .7 }), { p: [0, yd - .1, 0] });
    for (const x of [-1.5, 1.5]) k.add(g, k.box(.18, .22, 4.2, .02), trim, { p: [x, yd - .31, 0] });
    for (const s of [-1, 1]) g.add(rod(k, [s * .25, 2.5, -1.0], [s * 1.9, yd - .3, 1.75], .09, trim, 10));
    // walls: a pentagon of boards, gable and all
    const hs = k.shape([[-1.45, 0], [1.45, 0], [1.45, 2.0], [0, 3.05], [-1.45, 2.0]]), hz = .3, fz = hz + 1.0 + .03;
    k.add(g, k.extrude(hs, 2.0, { bevel: .03 }), [boardsH, boardsV], { p: [0, yd, hz] });
    for (const x of [-1.47, 1.47]) for (const z of [hz - 1.02, hz + 1.02]) k.add(g, k.box(.16, 2.02, .16, .02), trim, { p: [x, yd + 1.0, z] });
    // roof: two slabs of red shingles and a ridge
    const shingles = k.tex(512, 512, (c, w, h) => {
      c.fillStyle = '#8e2c24'; c.fillRect(0, 0, w, h);
      const rows = 6, cols = 8, rw = w / rows, cw = h / cols;
      for (let r = rows - 1; r >= 0; r--) for (let j = -1; j <= cols; j++) {
        const y = j * cw + (r % 2 ? cw / 2 : 0), x = r * rw;
        c.fillStyle = k.pick(['#c8473a', '#bf4034', '#d0503f', '#b93c31']);
        c.strokeStyle = '#7d2a20'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(x - 2, y + 2); c.lineTo(x + rw * .8, y + 2); c.arc(x + rw * .8, y + cw / 2, cw / 2 - 2, -Math.PI / 2, Math.PI / 2); c.lineTo(x - 2, y + cw - 2); c.closePath(); c.fill(); c.stroke();
      }
    });
    const roofMat = k.mat({ map: shingles, roughness: .7, clearcoat: .2 });
    const peak = [0, yd + 3.05], dd = [1.45 / 1.79, -1.05 / 1.79], nn = [1.05 / 1.79, 1.45 / 1.79], sw = 2.3;
    const rc = [peak[0] + dd[0] * (sw / 2 - .1) + nn[0] * .09, peak[1] + dd[1] * (sw / 2 - .1) + nn[1] * .09];
    for (const rot of [0, Math.PI]) {
      const side = k.group([], { r: [0, rot, 0], p: [0, 0, hz] }); g.add(side);
      k.add(side, k.box(sw, .14, 2.75, .03), roofMat, { p: [rc[0], rc[1], 0], r: [0, 0, -Math.atan2(1.05, 1.45)] });
    }
    k.add(g, k.cyl(.12, .12, 2.8, { seg: 16 }), k.plastic('#8e2c24', { rough: .6 }), { p: [0, yd + 3.2, hz], r: [Math.PI / 2, 0, 0] });
    // door, window with a flower box, and a round window on the side
    const blue = k.gloss('#3c86c8', { rough: .35 });
    k.add(g, k.slab(.72, 1.34, .08, .1), blue, { p: [.62, yd + .7, fz + .02] });
    k.add(g, k.sphere(.05, { w: 12, h: 8 }), k.brass(), { p: [.86, yd + .7, fz + .08] });
    for (const y of [.25, 1.15]) k.add(g, k.box(.14, .06, .02, .01), k.iron(), { p: [.32, yd + y, fz + .07] });
    const wx = -.62, wy = yd + 1.18;
    k.add(g, k.plane(.72, .66), k.painted(128, 128, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffe6a0'); gr.addColorStop(1, '#f0a850'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (const s of [0, 1]) { c.fillStyle = '#e8453c'; c.beginPath(); const x0 = s ? w : 0, x1 = s ? w * .72 : w * .28; c.moveTo(x0, 0); c.lineTo(x1, 0); c.quadraticCurveTo(x1 + (s ? 10 : -10), h * .6, x0 + (s ? -6 : 6), h); c.lineTo(x0, h); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.45)'; for (let y = 6; y < h; y += 14) c.fillRect(s ? w * .78 : 0, y, w * .22, 5); }
    }, { glow: .7 }), { p: [wx, wy, fz + .005] });
    const frame = k.roundRect(.9, .84, .04); frame.holes.push(k.roundRect(.72, .66, .02));
    const white = k.plastic('#f6f1e6', { rough: .5 });
    k.add(g, k.extrude(frame, .06, { bevel: .015 }), white, { p: [wx, wy, fz + .04] });
    k.add(g, k.box(.04, .66, .03), white, { p: [wx, wy, fz + .04] });
    k.add(g, k.box(.72, .04, .03), white, { p: [wx, wy, fz + .04] });
    k.add(g, k.box(1.0, .2, .22, .03), pine, { p: [wx, wy - .54, fz + .12] });
    const flowers = [];
    for (let i = 0; i < 7; i++) flowers.push({ p: [wx - .4 + i * .133, wy - .4 + k.range(-.02, .04), fz + .12 + k.range(-.05, .05)], s: k.range(.07, .09), color: k.pick(['#ff4f6e', '#ffd23a', '#ff8ac2', '#ffffff']) });
    g.add(k.instances(k.sphere(1, { w: 12, h: 8 }), k.plastic('#ffffff', { rough: .5 }), flowers));
    const leaves = [];
    for (let i = 0; i < 9; i++) leaves.push({ p: [wx - .45 + i * .11, wy - .45, fz + .14 + k.range(-.05, .05)], s: [.09, .06, .09] });
    g.add(k.instances(k.sphere(1, { w: 10, h: 8 }), k.plastic('#3f9a3a', { rough: .6 }), leaves));
    k.add(g, k.torus(.25, .045, { rs: 10, ts: 36 }), white, { p: [1.5, yd + 1.3, hz + .1], r: [0, Math.PI / 2, 0] });
    k.add(g, k.disc(.24, 32), k.glow('#ffd98a', .7), { p: [1.485, yd + 1.3, hz + .1], r: [0, Math.PI / 2, 0] });
    // porch railing, with a gap for the ladder
    const rz = 2.08, posts = [];
    for (const x of [-2.22, -1.0, .42, 1.58, 2.22]) posts.push({ p: [x, yd + .41, rz] });
    for (const x of [-2.22, 2.22]) posts.push({ p: [x, yd + .41, 1.35] });
    g.add(k.instances(k.box(.11, .82, .11, .02), pine, posts));
    const rail = (x0, z0, x1, z1, y) => { const len = Math.hypot(x1 - x0, z1 - z0); k.add(g, k.box(len, .08, .1, .02), pine, { p: [(x0 + x1) / 2, yd + y, (z0 + z1) / 2], r: [0, -Math.atan2(z1 - z0, x1 - x0), 0] }); };
    for (const y of [.8, .42]) { rail(-2.22, rz, .42, rz, y); rail(1.58, rz, 2.22, rz, y); rail(-2.22, 1.3, -2.22, rz, y); rail(2.22, 1.3, 2.22, rz, y); }
    // the sign
    k.add(g, k.box(1.3, .42, .05, .02), pine, { p: [-1.5, yd + .62, rz + .08], r: [0, 0, .05] });
    g.add(k.decal(1.24, .36, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.font = '700 100px Fredoka, system-ui, sans-serif';
      k.text(c, 'NO GROWN-UPS', w / 2, h * .56, { size: Math.min(h * .66, 100 * w * .94 / c.measureText('NO GROWN-UPS').width), color: '#c8302a' });
    }, { px: 384, p: [-1.5, yd + .62, rz + .108], r: [0, 0, .05] }));
    // the rope ladder
    const lx = [.66, 1.34];
    const rp = [[yd + .02, 2.0], [yd + .06, 2.2], [yd - .18, 2.28], [3.0, 2.36], [1.5, 2.44], [.07, 2.52]];
    for (const x of lx) k.add(g, k.tube(rp.map(([y, z]) => [x, y, z]), .045, { seg: 80, rs: 8 }), rope);
    const zAt = y => 2.28 + (2.52 - 2.28) * (1 - y / (yd - .18)), rungs = [], knots = [];
    for (let y = .4; y < yd - .3; y += .42) { rungs.push({ p: [1.0, y, zAt(y)], r: [0, 0, Math.PI / 2] }); for (const x of lx) knots.push({ p: [x, y, zAt(y)], s: .08 }); }
    g.add(k.instances(k.cyl(.055, .055, .86, { seg: 12 }), pine, rungs));
    g.add(k.instances(k.sphere(1, { w: 10, h: 8 }), rope, knots));
    // a pennant on the roof
    k.add(g, k.cyl(.025, .025, .8, { seg: 8 }), trim, { p: [0, yd + 3.55, hz + 1.3] });
    const pen = new T.PlaneGeometry(.6, .3, 12, 3), pp = pen.attributes.position;
    for (let i = 0; i < pp.count; i++) { const u = (pp.getX(i) + .3) / .6, y = pp.getY(i); pp.setXYZ(i, u * .6, y * (1 - u * .95), Math.sin(u * 5) * .05 * u); }
    pen.computeVertexNormals();
    k.add(g, pen, k.matte('#ffd23a', .7, { side: T.DoubleSide }), { p: [.02, yd + 3.8, hz + 1.3], r: [0, .6, 0] });
    return g;
  },
};
