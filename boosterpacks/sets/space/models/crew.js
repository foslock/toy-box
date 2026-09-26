// Outer Space models: crew. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// Compute normals, then average them across vertices that share a position, so seams on bent geometry don't show.
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
// A surface from fn(u, v) => [x, y, z] over the unit square, with (u, v) as its UVs. Faces point along d/du × d/dv.
function surface(k, fn, nu, nv) {
  const T = k.THREE, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { pos.push(...fn(i / nu, j / nv)); uv.push(i / nu, j / nv); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return weld(geo);
}
const curveOf = (k, pts, closed = false) => new k.THREE.CatmullRomCurve3(pts.map(q => q.isVector3 ? q.clone() : new k.THREE.Vector3(...q)), closed);
// A tube along a curve whose radius changes along the way: rad(s, L) is the radius at arc length s (of L).
// o.flat squashes the cross-section along o.up (default y); o.closed for a loop.
function varTube(k, curve, rad, o = {}) {
  const T = k.THREE, seg = o.seg ?? 80, rs = o.rs ?? 20, L = curve.getLength();
  const geo = new T.TubeGeometry(curve, seg, 1, rs, !!o.closed);
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
// Turn obj so its local +y runs exactly along Y and its local +z leans as near to Z as it can.
function alongY(k, obj, Y, Z) {
  const T = k.THREE, y = Y.clone().normalize(), z = Z.clone().addScaledVector(y, -Z.dot(y)).normalize(), x = new T.Vector3().crossVectors(y, z);
  obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
  return obj;
}
// Turn obj so its local +z (its face) points exactly along Z and its local +y leans as near to Y as it can.
function facing(k, obj, Z, Y) {
  const T = k.THREE, z = Z.clone().normalize(), y = Y.clone().addScaledVector(z, -Y.dot(z)).normalize(), x = new T.Vector3().crossVectors(y, z);
  obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
  return obj;
}
// Placement matrix whose local x, y, z axes point along a, b, c (right-handed), at p.
const frameM = (k, p, a, b, c) => new k.THREE.Matrix4().makeBasis(a, b, c).setPosition(p);
// One mesh drawing geo at each of a list of placement matrices.
function instanced(k, geo, mat, matrices, colors) {
  const m = new k.THREE.InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((M, i) => { m.setMatrixAt(i, M); if (colors) m.setColorAt(i, k.color(colors[i])); });
  m.castShadow = m.receiveShadow = true;
  return m;
}
// A soft additive glow (drawn over what's behind it, casts no shadow).
function halo(k, r, color, opacity = .35) {
  const T = k.THREE, tex = k.tex(128, 128, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, { cache: 'crew-halo' });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k.color(color), transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }));
  s.scale.set(r * 2, r * 2, 1);
  return s;
}
// The default camera's frame: C points at the camera, R is screen right, U is screen up.
function camFrame(k, az = 30, el = 16) {
  const T = k.THREE, a = k.deg(az), e = k.deg(el);
  const C = new T.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)), R = new T.Vector3(Math.cos(a), 0, -Math.sin(a));
  return { C, R, U: new T.Vector3().crossVectors(C, R) };
}
// Seeded smooth 3D value noise (about -1..1), and a few octaves of it.
function noise3(k) {
  const perm = new Uint8Array(512), vals = new Float32Array(256), p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(k.rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) vals[i] = k.rand() * 2 - 1;
  const f = t => t * t * (3 - 2 * t);
  const h = (x, y, z) => vals[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  const n = (x, y, z) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = f(x - X), v = f(y - Y), w = f(z - Z);
    return lerp(lerp(lerp(h(X, Y, Z), h(X + 1, Y, Z), u), lerp(h(X, Y + 1, Z), h(X + 1, Y + 1, Z), u), v),
      lerp(lerp(h(X, Y, Z + 1), h(X + 1, Y, Z + 1), u), lerp(h(X, Y + 1, Z + 1), h(X + 1, Y + 1, Z + 1), u), v), w);
  };
  const fbm = (x, y, z, oct = 3) => { let s = 0, a = 1, tot = 0; for (let i = 0; i < oct; i++) { s += a * n(x, y, z); tot += a; a *= .5; x *= 2.03; y *= 2.03; z *= 2.03; } return s / tot; };
  return { n, fbm };
}
// A star's outline on a canvas (call fill or stroke after).
function starPath(c, x, y, R, r, n = 5, rot = -Math.PI / 2) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, rr = i % 2 ? r : R; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath();
}
// A star as a three.js Shape, points up.
function starShape(k, R, r, n = 5) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r : R; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  return k.shape(pts);
}
// Points round a rounded rectangle in the xy plane (for a closed tube).
function rrLoop(w, h, r, n = 6) {
  const pts = [], sx = w / 2 - r, sy = h / 2 - r;
  for (const [cx, cy, a0] of [[sx, sy, 0], [-sx, sy, Math.PI / 2], [-sx, -sy, Math.PI], [sx, -sy, Math.PI * 1.5]])
    for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0]); }
  return pts;
}

/* ---------- astronaut ice cream ---------- */
// A freeze-dried block: a finely cut-up box with rounded edges, a dry crumbly skin, grooves between its flavours,
// an optional ragged broken top and bites out of it. colorAt(x) gives the flavour colour across its width.
function crumblyBlock(k, nz, w, h, d, colorAt, o = {}) {
  const T = k.THREE, hw = w / 2, hh = h / 2, hd = d / 2, rr = o.round ?? .06;
  const geo = new T.BoxGeometry(w, h, d, o.nx ?? 36, o.ny ?? 72, o.nz ?? 14);
  const p = geo.attributes.position, v = new T.Vector3(), q = new T.Vector3(), cols = [];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    q.set(Math.max(-hw + rr, Math.min(hw - rr, v.x)), Math.max(-hh + rr, Math.min(hh - rr, v.y)), Math.max(-hd + rr, Math.min(hd - rr, v.z)));
    const dl = v.distanceTo(q); if (dl > 1e-6) v.sub(q).multiplyScalar(rr / dl).add(q);
    const x0 = v.x;
    for (const xb of o.layers ?? []) { const gz = Math.exp(-(((v.x - xb) / .026) ** 2)); v.z *= 1 - .1 * gz; v.y -= .035 * gz * smooth(hh - .25, hh, v.y); }
    if (o.brk) { const drop = o.brk * (.5 + .5 * nz.fbm(v.x * 2.4 + 3, 1.7, v.z * 2.4)) + .025 * nz.n(v.x * 10, 5, v.z * 10); v.y -= drop * smooth(hh - .4, hh, v.y); }
    const f = o.rough ?? .014, e = nz.n(v.x * 13 + 1, v.y * 13, v.z * 13 + 2) * f;
    v.x += e * Math.sign(v.x) * smooth(hw * .6, hw, Math.abs(v.x)); v.z += e * Math.sign(v.z) * smooth(hd * .6, hd, Math.abs(v.z)); v.y += e * Math.sign(v.y) * smooth(hh * .8, hh, Math.abs(v.y));
    for (let pass = 0; pass < 2; pass++) for (const [bx, by, br] of o.bites ?? []) { const dx = v.x - bx, dy = v.y - by, dd = Math.hypot(dx, dy); if (dd < br) { v.x = bx + dx * br / Math.max(dd, 1e-4); v.y = by + dy * br / Math.max(dd, 1e-4); } }
    p.setXYZ(i, v.x, v.y, v.z);
    const c = colorAt(x0); cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  return weld(geo);
}

export default {
  // A chrome bullet pen with its cap posted on the back, floating at a jaunty angle, trailing the loop-the-loop of blue
  // ink it has just written in thin air, with a few little gold stars.
  spacepen(k) {
    const T = k.THREE, g = k.group();
    const { C, R, U } = camFrame(k);
    const scr = (x, y, z = 0) => R.clone().multiplyScalar(x).addScaledVector(U, y).addScaledVector(C, z);
    // the pen, built standing on its point along +y, then aimed: point at the origin, body rising up to the right,
    // the clip along its upper edge
    const pen = k.group();
    alongY(k, pen, scr(.4, .9, .2), C.clone().multiplyScalar(.75).add(scr(-.9, .4).normalize().multiplyScalar(.66)));
    // polished chrome: bands of studio light and shadow running down the length, laid out round the side we see
    const seen = C.clone().applyQuaternion(pen.quaternion.clone().invert()), uc = Math.atan2(seen.x, seen.z) / TAU;
    const bands = k.tex(512, 4, (c, w, h) => {
      const stops = [[-.5, '#6c737d'], [-.25, '#3b4049'], [-.2, '#8d949e'], [-.13, '#ffffff'], [-.085, '#f4f6f8'], [-.05, '#5d646e'], [0, '#c3c9d0'], [.07, '#eef1f4'], [.12, '#6a717b'], [.17, '#fbfcfd'], [.21, '#a2a9b2'], [.25, '#454a53'], [.5, '#6c737d']];
      for (const off of [-1, 0, 1]) for (let i = 0; i < stops.length - 1; i++) {
        const [t0, c0] = stops[i], [t1, c1] = stops[i + 1], x0 = (uc + t0 + off) * w, x1 = (uc + t1 + off) * w;
        if (x1 < 0 || x0 > w) continue;
        const gr = c.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, c0); gr.addColorStop(1, c1); c.fillStyle = gr; c.fillRect(x0, 0, x1 - x0 + 1, h);
      }
    });
    const chrome = k.metal('#ffffff', .06, { map: bands }), plain = k.metal('#eef1f6', .08), satin = k.metal('#d4d9e0', .24), dark = k.metal('#23262c', .35);
    const rB = .2, rC = .225;
    k.add(pen, k.sphere(.024, { w: 16, h: 12 }), k.metal('#e8ebef', .1), { p: [0, .022, 0] });
    k.add(pen, k.lathe([[0, .028], [.026, .034], [.038, .07], [.05, .13], [.062, .19], [0, .19]], { seg: 32 }), satin);
    // the front section: a bullet taper from the point back to the barrel
    const nose = [[0, .17], [.066, .17]];
    for (let i = 0; i <= 18; i++) { const t = i / 18; nose.push([.072 + (rB - .072) * (1 - Math.pow(1 - t, 2)), .18 + t * .84]); }
    nose.push([0, 1.02]);
    k.add(pen, k.lathe(nose, { seg: 64 }), chrome);
    k.add(pen, k.cyl(rB * .97, rB * .97, .03, { seg: 64 }), dark, { p: [0, 1.035, 0] });
    k.add(pen, k.cyl(rB, rB, 1.6, { seg: 64 }), chrome, { p: [0, 1.85, 0] });
    // the cap, posted on the back end: a rolled lip, a long tube and a domed end
    const y0 = 2.55, y1 = 4.45, cap = [[rB * .98, y0], [rC - .012, y0], [rC, y0 + .015], [rC, y1]];
    for (let i = 1; i <= 14; i++) { const a = i / 14 * Math.PI / 2; cap.push([rC * Math.cos(a), y1 + .3 * Math.sin(a)]); }
    k.add(pen, k.lathe(cap, { seg: 64 }), chrome);
    // a navy enamel band round the cap's mouth, with a row of little stars
    const band = k.painted(512, 64, (c, w, h) => {
      c.fillStyle = '#1c2f86'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffffff'; for (let i = 0; i < 14; i++) { starPath(c, (i + .5) * w / 14, h / 2, h * .3, h * .13); c.fill(); }
    }, { rough: .18, coat: 1 });
    k.add(pen, k.cyl(rC + .003, rC + .003, .15, { seg: 64, open: true }), band, { p: [0, y0 + .17, 0] });
    for (const y of [y0 + .095, y0 + .245]) k.add(pen, k.torus(rC + .003, .007, { rs: 8, ts: 64 }), plain, { p: [0, y, 0], r: [Math.PI / 2, 0, 0] });
    // the clip: a collar near the top of the cap and a sprung strip down its side, ending in a round foot
    k.add(pen, k.cyl(rC + .014, rC + .014, .12, { seg: 64 }), chrome, { p: [0, y1 - .15, 0] });
    const clipC = curveOf(k, [[0, y1 - .1, rC + .012], [0, y1 - .24, rC + .04], [0, y1 - .7, rC + .05], [0, y1 - 1.1, rC + .042], [0, y1 - 1.25, rC + .02]]);
    k.add(pen, varTube(k, clipC, capped(.05, 0, .02), { up: [0, 0, 1], flat: .34, seg: 48, rs: 16 }), plain);
    k.add(pen, k.sphere(.042, { w: 20, h: 14 }), plain, { p: [0, y1 - 1.26, rC + .012], s: [1, 1, .72] });
    g.add(pen);
    // the ink: loop-the-loops trailing back from the point and climbing as they go, thinning away at the end
    const ink = k.mat({ color: '#0f33d6', roughness: .14, clearcoat: 1, clearcoatRoughness: .06, emissive: k.color('#0a2bd6'), emissiveIntensity: .45 });
    const pts = [], T1 = 4.3 * Math.PI;
    for (let i = 0; i <= 160; i++) {
      const t = i / 160 * T1, rl = .42 + .05 * t;
      pts.push(scr(-(.25 * t + rl * Math.sin(t)), rl * (1 - Math.cos(t)) + .13 * t, .35 * Math.sin(t * .5) - .03 * t));
    }
    const inkC = new T.CatmullRomCurve3(pts);
    k.add(g, varTube(k, inkC, (s, L) => .058 * Math.sqrt(smooth(0, .3, s)) * (1 - smooth(L * .72, L, s) ** 1.5) + .014, { seg: 480, rs: 12 }), ink);
    k.add(g, k.sphere(.014, { w: 10, h: 8 }), ink, { p: inkC.getPointAt(1).toArray() });
    // little gold stars
    const gold = k.mat({ color: '#ffc526', roughness: .25, metalness: .35, clearcoat: 1, clearcoatRoughness: .08, emissive: k.color('#ff9d00'), emissiveIntensity: .35 });
    const starG = k.extrude(starShape(k, .22, .095), .07, { bevel: .03, bevelSeg: 3 });
    for (const [x, y, s, spin] of [[-1.35, 2.75, 1, .15], [-3.55, 3.5, .7, -.25], [1.3, 1.25, .62, .4], [-2.6, .55, .5, .7], [.25, 4.3, .5, -.5]]) {
      const m = k.mesh(starG, gold, { s });
      m.position.copy(scr(x, y, .2)); facing(k, m, C, U); m.rotateZ(spin); g.add(m);
    }
    g.userData.floating = true;
    g.userData.noHero = true;
    return g;
  },

  // A silver foil pouch of freeze-dried Neapolitan ice cream, torn open at the top, the chalky three-flavour block poking
  // out with a bite gone from its corner, a broken-off piece and a few crumbs on the floor.
  icecream(k) {
    const T = k.THREE, g = k.group(), nz = noise3(k);
    // ---- the pouch: two sheets of foil sealed down the sides, a gusset underneath, torn open along the top ----
    const W = 2.7, H = 3.4, seal = .15, a = W / 2 - seal;
    const side = x => Math.pow(Math.max(0, 1 - (x / a) ** 2), .6);
    const dv = t => .4 + .1 * Math.sin(Math.PI * t) + .12 * smooth(.7, 1, t);
    const half = (x, y) => Math.abs(x) >= a ? .004 : .004 + side(x) * (dv(y / H) + (.03 + .05 * smooth(.6, 1, y / H)) * nz.fbm(x * 1.6, y * 1.9, 2.3));
    const sheet = s => surface(k, (u, v) => { const x = (u - .5) * W * s, y = v * H; return [x, y, s * half(x, y)]; }, 72, 90);
    // crinkles: a crease field (ridges and valleys along random lines), with the seals' crimping down each side
    const sealU = seal / W;
    const crinkle = k.tex(512, 640, (c, w, h) => {
      const img = c.createImageData(w, h), d = img.data, hf = new Float32Array(w * h);
      const lines = [];
      for (let i = 0; i < 30; i++) { const ang = k.rand() * Math.PI, nx = Math.cos(ang), ny = Math.sin(ang); lines.push([nx, ny, nx * k.rand() * w + ny * k.rand() * h, k.range(-1, 1) * k.range(.3, 1), k.range(18, 110)]); }
      let lo = Infinity, hi = -Infinity;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let s = 0;
        for (const [nx, ny, c0, amp, wid] of lines) s += amp * Math.min(Math.abs(nx * x + ny * y - c0), wid);
        hf[y * w + x] = s; if (s < lo) lo = s; if (s > hi) hi = s;
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let v = (hf[y * w + x] - lo) / (hi - lo);
        const u = x / w;
        if (u < sealU || u > 1 - sealU) v = .5 + .35 * Math.sin(y * 1.3);
        const o = (y * w + x) * 4; d[o] = d[o + 1] = d[o + 2] = v * 255; d[o + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    }, { data: true });
    // the tear along the top: transparent above a ragged line
    const tear = (c, w, h, base) => {
      c.save(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.moveTo(0, 0);
      let y = base;
      for (let x = 0; x <= w; x += w / 60) { y = Math.max(base * .4, Math.min(base * 1.7, y + k.range(-1, 1) * base * .35)); c.lineTo(x, y + (Math.round(x / (w / 60)) % 2 ? base * .18 : 0)); }
      c.lineTo(w, 0); c.closePath(); c.fill(); c.restore();
    };
    const foil = (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, '#c9ced6'); gr.addColorStop(.5, '#eceff3'); gr.addColorStop(1, '#c9ced6');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 50; i++) { c.fillStyle = `rgba(${k.rand() < .5 ? '255,255,255' : '110,118,130'},${k.range(.03, .09)})`; c.fillRect(k.rand() * w, 0, k.range(2, 16), h); }
      const sw = sealU * w;
      for (const x0 of [0, w - sw]) { c.fillStyle = 'rgba(120,128,140,.25)'; c.fillRect(x0, 0, sw, h); for (let y = 0; y < h; y += 5) { c.fillStyle = 'rgba(80,88,100,.22)'; c.fillRect(x0, y, sw, 2); } }
    };
    const front = k.tex(640, 800, (c, w, h) => {
      foil(c, w, h);
      // the label: a navy panel with the name, a picture of the block orbiting a star, and the small print
      const lx = 84, ly = 226, lw = 472, lh = 536;
      c.save();
      c.beginPath(); c.roundRect(lx, ly, lw, lh, 36);
      let gr = c.createLinearGradient(0, ly, 0, ly + lh); gr.addColorStop(0, '#26409f'); gr.addColorStop(1, '#101a55');
      c.fillStyle = gr; c.fill(); c.clip();
      for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,255,255,${k.range(.3, .9)})`; c.beginPath(); c.arc(lx + k.rand() * lw, ly + k.rand() * lh, k.range(1, 2.6), 0, TAU); c.fill(); }
      gr = c.createRadialGradient(lx + lw * .3, ly + lh * 1.25, 0, lx + lw * .3, ly + lh * 1.25, lw * .9); gr.addColorStop(0, '#3fb4ff'); gr.addColorStop(.62, '#2a7fe0'); gr.addColorStop(.63, 'rgba(120,200,255,.5)'); gr.addColorStop(.7, 'rgba(120,200,255,0)');
      c.fillStyle = gr; c.fillRect(lx, ly, lw, lh);
      c.restore();
      c.lineWidth = 8; c.strokeStyle = '#ffffff'; c.beginPath(); c.roundRect(lx, ly, lw, lh, 36); c.stroke();
      c.fillStyle = '#ff5a36'; c.beginPath(); c.roundRect(w / 2 - 150, ly + 26, 300, 56, 28); c.fill();
      k.text(c, 'FREEZE-DRIED', w / 2, ly + 56, { size: 34, weight: 700, color: '#ffffff' });
      k.text(c, 'ASTRONAUT', w / 2, ly + 150, { size: 74, weight: 700, color: '#ffffff', stroke: '#0b1440', strokeWidth: 12 });
      k.text(c, 'ICE CREAM', w / 2, ly + 232, { size: 84, weight: 700, color: '#ffd23f', stroke: '#0b1440', strokeWidth: 12 });
      // the block, with a bite out of it, in orbit
      c.save(); c.translate(w / 2, ly + 362); c.rotate(-.2); c.scale(.88, .88);
      c.strokeStyle = 'rgba(255,210,63,.9)'; c.lineWidth = 5; c.beginPath(); c.ellipse(0, 0, 170, 52, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
      c.beginPath(); c.roundRect(-84, -80, 168, 160, 16); c.save(); c.clip();
      [['#7b4a2c', -84], ['#f6ecd6', -28], ['#f29bb0', 28]].forEach(([col, x]) => { c.fillStyle = col; c.fillRect(x, -80, 56, 160); });
      c.fillStyle = 'rgba(80,40,30,.25)'; for (let i = 0; i < 90; i++) { c.beginPath(); c.arc(k.range(-84, 84), k.range(-80, 80), k.range(1, 3), 0, TAU); c.fill(); }
      c.restore();
      c.fillStyle = '#1a2a78'; for (const [x, y, r] of [[80, -84, 34], [50, -92, 26], [96, -52, 24]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
      c.strokeStyle = 'rgba(255,210,63,.9)'; c.lineWidth = 5; c.beginPath(); c.ellipse(0, 0, 170, 52, 0, Math.PI * -.05, Math.PI * .95); c.stroke();
      c.fillStyle = '#ffd23f'; starPath(c, 150, 30, 18, 8); c.fill();
      c.restore();
      k.text(c, 'NEAPOLITAN', w / 2, ly + 464, { size: 40, weight: 700, color: '#bfe6ff' });
      k.text(c, 'NET WT 1 OZ (28 g)', w / 2, ly + 502, { size: 22, weight: 700, color: '#c9d6ff', font: 'Nunito, sans-serif' });
      tear(c, w, h, 30);
    });
    const back = k.tex(320, 400, (c, w, h) => {
      foil(c, w, h);
      c.fillStyle = '#f4f4f0'; c.beginPath(); c.roundRect(60, 150, 200, 200, 12); c.fill();
      c.fillStyle = 'rgba(40,40,50,.55)'; for (let i = 0; i < 12; i++) c.fillRect(76, 168 + i * 14, i % 4 === 3 ? 100 : 168, 5);
      tear(c, w, h, 16);
    });
    const mr = label => k.tex(160, 200, (c, w, h) => {
      c.fillStyle = 'rgb(0,60,255)'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgb(0,120,0)'; label(c, w, h);
    }, { data: true });
    const frontMR = mr(c => { c.beginPath(); c.roundRect(84 / 4, 226 / 4, 472 / 4, 536 / 4, 9); c.fill(); });
    const backMR = mr(c => { c.beginPath(); c.roundRect(60 / 2, 150 / 2, 100, 100, 6); c.fill(); });
    const foilMat = (map, rm) => k.mat({ map, roughnessMap: rm, metalnessMap: rm, roughness: 1, metalness: 1, bumpMap: crinkle, bumpScale: 3, side: T.DoubleSide, alphaTest: .5, envMapIntensity: 1.6 });
    const pouch = k.group();
    k.add(pouch, sheet(1), foilMat(front, frontMR));
    k.add(pouch, sheet(-1), foilMat(back, backMR));
    const lens = new T.Shape();
    for (let i = 0; i <= 40; i++) { const x = -a + 2 * a * i / 40; i ? lens.lineTo(x, half(x, 0)) : lens.moveTo(x, half(x, 0)); }
    for (let i = 40; i >= 0; i--) { const x = -a + 2 * a * i / 40; lens.lineTo(x, -half(x, 0)); }
    const bottom = new T.ShapeGeometry(lens, 1); bottom.rotateX(Math.PI / 2);
    k.add(pouch, bottom, k.metal('#cfd4db', .3));
    // ---- the ice cream ----
    const choc = k.color('#7a4529'), van = k.color('#f6ead0'), straw = k.color('#f39ab0');
    const bw = 1.5, bh = 3.0, bd = .6;
    const flavour = x => choc.clone().lerp(van, smooth(-bw / 6 - .012, -bw / 6 + .012, x)).lerp(straw, smooth(bw / 6 - .012, bw / 6 + .012, x));
    const pores = []; for (let i = 0; i < 1500; i++) pores.push([k.rand(), k.rand(), k.range(.5, 2.6), k.rand()]);
    const poreTex = (data) => k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      for (const [x, y, r, s] of pores) { c.fillStyle = data ? `rgba(0,0,0,${.35 + s * .5})` : `rgba(90,55,45,${.1 + s * .22})`; c.beginPath(); c.arc(x * w, y * h, r, 0, TAU); c.fill(); }
      if (!data) for (let i = 0; i < 500; i++) { c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(k.rand() * w, k.rand() * h, 1.5, 1.5); }
    }, { data, repeat: [2, 4] });
    const creamM = k.mat({ vertexColors: true, map: poreTex(false), bumpMap: poreTex(true), bumpScale: 2.5, roughness: .96, sheen: .6, sheenRoughness: .7, sheenColor: k.color('#fff6ee') });
    const block = k.mesh(crumblyBlock(k, nz, bw, bh, bd, flavour, { layers: [-bw / 6, bw / 6], brk: .08, bites: [[bw / 2 - .3, bh / 2 + .02, .2], [bw / 2 + .03, bh / 2 + .03, .22], [bw / 2 + .02, bh / 2 - .31, .2]] }), creamM,
      { p: [.03, H + 1.3 - bh / 2, 0], r: [-.04, 0, -.07] });
    pouch.add(block);
    pouch.rotation.y = .3;
    g.add(pouch);
    // a piece that broke off, and crumbs
    const piece = k.mesh(crumblyBlock(k, nz, .62, .5, .56, x => van.clone().lerp(straw, smooth(-.06, -.03, x)), { layers: [-.045], rough: .05, round: .05, nx: 14, ny: 12, nz: 12 }), creamM,
      { p: [-1.5, .25, .95], r: [.3, .7, -.12] });
    g.add(piece);
    const crumbs = [], crumbCols = [];
    for (let i = 0; i < 18; i++) {
      const s = k.range(.035, .085), near = i < 12;
      crumbs.push(new T.Matrix4().compose(new T.Vector3(near ? k.range(-2.0, -.9) : k.range(-.6, 1.1), s * .6, near ? k.range(.5, 1.5) : k.range(.9, 1.35)),
        new T.Quaternion().setFromEuler(new T.Euler(k.rand() * 3, k.rand() * 3, k.rand() * 3)), new T.Vector3(s, s * k.range(.6, 1), s * k.range(.7, 1.2))));
      crumbCols.push(k.pick(['#7a4529', '#f6ead0', '#f39ab0', '#f6ead0']));
    }
    g.add(instanced(k, new T.IcosahedronGeometry(1, 0), k.mat({ color: '#ffffff', roughness: .95, sheen: .5, sheenColor: k.color('#ffffff') }), crumbs, crumbCols));
    g.userData.view = { az: 30, el: 18 };
    return g;
  },

  // An embroidered mission patch floating in the cabin: a rocket arcing up over a blue planet among stars, a crescent
  // moon, a gold merrowed border and a red name ribbon, all a little curved like cloth.
  patch(k) {
    const T = k.THREE, g = k.group(), P = k.group();
    const Rp = 2, tw = .07, N = 1024, S = N / (2 * Rp), Rc = 9;
    const X = x => N / 2 + x * S, Y = y => N / 2 - y * S;
    // a gentle bend round a vertical axis, like a patch that has been folded in a pocket
    const bendP = (x, y, z) => { const a = x / Rc, r = Rc + z; return [r * Math.sin(a), y, r * Math.cos(a) - Rc]; };
    const bendGeo = geo => {
      const p = geo.attributes.position, n = geo.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), a = x / Rc, [bx, by, bz] = bendP(x, p.getY(i), p.getZ(i)); p.setXYZ(i, bx, by, bz);
        if (n) { const nx = n.getX(i), nz = n.getZ(i), c = Math.cos(a), s = Math.sin(a); n.setXYZ(i, nx * c + nz * s, n.getY(i), -nx * s + nz * c); }
      }
      p.needsUpdate = true; if (n) n.needsUpdate = true;
      return geo;
    };
    // ---- the design, in patch units ----
    const planet = [-.12, -.62, .98], moon = [1.2, .12, .27];
    const tb = [[-.95, -.2], [-1.3, .55], [-.62, .8], [.12, .98]], rs = 1.15;
    const bez = t => { const s = 1 - t; return [0, 1].map(i => s * s * s * tb[0][i] + 3 * s * s * t * tb[1][i] + 3 * s * t * t * tb[2][i] + t * t * t * tb[3][i]); };
    const dir = Math.atan2(tb[3][1] - tb[2][1], tb[3][0] - tb[2][0]), rk = [tb[3][0] + .46 * rs * Math.cos(dir), tb[3][1] + .46 * rs * Math.sin(dir)];
    const stars = [[-1.02, 1.25, .13, '#ffd84a'], [1.35, .62, .1, '#ffffff'], [.5, .5, .07, '#ffffff'], [-1.55, .35, .06, '#ffffff'], [.1, 1.58, .065, '#ffd84a'],
      [1.3, -.55, .08, '#ffd84a'], [-.5, 1.52, .045, '#ffffff'], [.95, .28, .045, '#ffffff'], [-1.62, -.62, .05, '#ffffff'], [1.62, .05, .045, '#ffffff']];
    const circ = (c, [x, y, r]) => { c.beginPath(); c.arc(X(x), Y(y), r * S, 0, TAU); };
    const trailPoly = (c, wk) => {
      const L = [], Rr = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60, [x, y] = bez(t), [x2, y2] = bez(Math.min(1, t + .01)), [x1, y1] = bez(Math.max(0, t - .01));
        const tx = x2 - x1, ty = y2 - y1, l = Math.hypot(tx, ty), nx = -ty / l, ny = tx / l, wd = wk * (.03 + .13 * t ** 1.3);
        L.push([x + nx * wd, y + ny * wd]); Rr.push([x - nx * wd, y - ny * wd]);
      }
      c.beginPath(); [...L, ...Rr.reverse()].forEach(([x, y], i) => i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y))); c.closePath();
    };
    // the rocket, drawn pointing up in its own units, then turned along its heading
    const inRocket = (c, fn) => { c.save(); c.translate(X(rk[0]), Y(rk[1])); c.rotate(Math.PI / 2 - dir); c.scale(S * rs, -S * rs); fn(); c.restore(); };
    const body = c => { c.beginPath(); c.moveTo(0, .48); c.quadraticCurveTo(.14, .38, .135, .12); c.lineTo(.135, -.3); c.lineTo(.11, -.4); c.lineTo(-.11, -.4); c.lineTo(-.135, -.3); c.lineTo(-.135, .12); c.quadraticCurveTo(-.14, .38, 0, .48); c.closePath(); };
    const fins = c => { c.beginPath(); for (const s of [-1, 1]) { c.moveTo(s * .12, -.08); c.lineTo(s * .31, -.36); c.lineTo(s * .3, -.47); c.lineTo(s * .11, -.36); c.closePath(); } c.rect(-.024, -.48, .048, .3); };
    const flame = (c, f = 1) => { c.beginPath(); c.moveTo(-.085 * f, -.39); c.quadraticCurveTo(-.1 * f, -.6, 0, -.4 - .36 * f); c.quadraticCurveTo(.1 * f, -.6, .085 * f, -.39); c.closePath(); };
    const moonPath = c => { circ(c, moon); };
    const moonCut = c => { c.beginPath(); c.rect(0, 0, N, N); c.arc(X(moon[0] + .12), Y(moon[1] + .05), moon[2] * .86 * S, 0, TAU, true); };
    // parallel thread lines over whatever path is current (satin stitch)
    const satin = (c, ang, sp, light, dark) => {
      c.save(); c.clip(); c.translate(N / 2, N / 2); c.rotate(ang);
      for (let i = -N; i < N; i += sp) { c.fillStyle = light; c.fillRect(-N, i, 2 * N, sp * .45); c.fillStyle = dark; c.fillRect(-N, i + sp * .5, 2 * N, sp * .3); }
      c.restore();
    };
    const outline = (c, lw = 5, col = '#0b1233') => { c.lineWidth = lw; c.strokeStyle = col; c.lineJoin = 'round'; c.stroke(); };
    const L1 = 'rgba(255,255,255,.14)', D1 = 'rgba(0,0,0,.12)';
    const colorTex = k.tex(N, N, c => {
      // navy twill
      let gr = c.createRadialGradient(X(-.6), Y(.8), 0, X(0), Y(0), 2 * S); gr.addColorStop(0, '#263b8c'); gr.addColorStop(1, '#131d52');
      c.fillStyle = gr; c.fillRect(0, 0, N, N);
      c.save(); c.translate(N / 2, N / 2); c.rotate(-.7); for (let i = -N; i < N; i += 5) { c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(-N, i, 2 * N, 2); } c.restore();
      // stars
      for (const [x, y, r, col] of stars) { c.fillStyle = col; starPath(c, X(x), Y(y), r * S, r * S * .42); c.fill(); satin(c, .5, 5, L1, D1); starPath(c, X(x), Y(y), r * S, r * S * .42); outline(c, 3, '#8a6a10'); }
      // the planet: ocean, continents, clouds, a shadow on its night side and a rim of air
      c.fillStyle = '#2f8de0'; circ(c, planet); c.fill();
      c.save(); circ(c, planet); c.clip();
      c.fillStyle = '#44c26e';
      for (const [x, y, rx, ry, rot] of [[-.62, -.3, .38, .22, .5], [.28, -.1, .3, .4, -.3], [-.2, -.95, .45, .2, .1], [.5, -.75, .2, .14, .8]]) { c.beginPath(); c.ellipse(X(x), Y(y), rx * S, ry * S, rot, 0, TAU); c.fill(); }
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = .07 * S; c.lineCap = 'round';
      for (const [x, y, l, b] of [[-.5, .05, .5, .08], [.05, -.45, .6, -.1], [-.75, -.65, .35, .06]]) { c.beginPath(); c.moveTo(X(x), Y(y)); c.quadraticCurveTo(X(x + l / 2), Y(y + b), X(x + l), Y(y)); c.stroke(); }
      circ(c, planet); satin(c, 1.05, 6, L1, D1);
      gr = c.createRadialGradient(X(planet[0] - .45), Y(planet[1] + .45), 0, X(planet[0] - .2), Y(planet[1] + .2), 1.35 * S); gr.addColorStop(.55, 'rgba(8,16,60,0)'); gr.addColorStop(.75, 'rgba(8,16,60,.45)');
      c.fillStyle = gr; c.fillRect(0, 0, N, N);
      c.restore();
      circ(c, planet); outline(c, 9, '#9be0ff'); circ(c, [planet[0], planet[1], planet[2] + .02]); outline(c, 4);
      // the moon: a crescent
      c.save(); moonPath(c); c.clip(); moonCut(c); c.fillStyle = '#fff1bd'; c.fill('nonzero'); moonCut(c); satin(c, -.8, 5, L1, D1); c.restore();
      c.save(); moonPath(c); c.clip(); c.beginPath(); c.arc(X(moon[0] + .12), Y(moon[1] + .05), moon[2] * .86 * S, 0, TAU); outline(c, 6); c.restore();
      c.save(); moonCut(c); c.clip(); moonPath(c); outline(c, 5); c.restore();
      // the trail: red, orange and yellow bands
      for (const [wk, col] of [[1, '#ff4b2e'], [.62, '#ff9a1f'], [.28, '#ffe45c']]) { c.fillStyle = col; trailPoly(c, wk); c.fill(); trailPoly(c, wk); satin(c, dir + 1.2, 5, L1, D1); }
      trailPoly(c, 1); outline(c, 4);
      // the rocket
      inRocket(c, () => { c.fillStyle = '#ffb21f'; flame(c); c.fill(); c.fillStyle = '#fff17a'; flame(c, .55); c.fill(); });
      inRocket(c, () => { c.fillStyle = '#e8322e'; fins(c); c.fill(); });
      inRocket(c, () => { c.fillStyle = '#f7f8fb'; body(c); c.fill(); c.save(); body(c); c.clip(); c.fillStyle = '#e8322e'; c.fillRect(-.3, .17, .6, .4); c.fillRect(-.3, -.26, .6, .05); c.restore(); });
      inRocket(c, () => { c.fillStyle = '#b9c4d4'; c.beginPath(); c.arc(0, .0, .075, 0, TAU); c.fill(); c.fillStyle = '#4fc3ff'; c.beginPath(); c.arc(0, 0, .052, 0, TAU); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(-.018, .018, .016, 0, TAU); c.fill(); });
      inRocket(c, () => { body(c); c.lineWidth = .018; c.strokeStyle = '#0b1233'; c.stroke(); fins(c); c.stroke(); });
      c.save(); c.translate(0, 0); inRocket(c, () => { body(c); }); satin(c, dir, 5, 'rgba(255,255,255,.1)', 'rgba(0,0,40,.1)');
    });
    // relief: how far each part of the embroidery stands up from the twill
    const heightTex = k.tex(N, N, c => {
      c.fillStyle = '#000'; c.fillRect(0, 0, N, N);
      c.filter = 'blur(2.5px)';
      c.fillStyle = 'rgb(105,105,105)'; for (const [x, y, r] of stars) { starPath(c, X(x), Y(y), r * S * 1.05, r * S * .45); c.fill(); }
      let gr = c.createRadialGradient(X(planet[0] - .2), Y(planet[1] + .2), 0, X(planet[0]), Y(planet[1]), planet[2] * S);
      gr.addColorStop(0, 'rgb(200,200,200)'); gr.addColorStop(1, 'rgb(150,150,150)'); c.fillStyle = gr; circ(c, [planet[0], planet[1], planet[2] + .02]); c.fill();
      c.save(); moonPath(c); c.clip(); moonCut(c); c.fillStyle = 'rgb(150,150,150)'; c.fill(); c.restore();
      c.fillStyle = 'rgb(130,130,130)'; trailPoly(c, 1.05); c.fill();
      inRocket(c, () => { c.fillStyle = 'rgb(150,150,150)'; flame(c); c.fill(); c.fillStyle = 'rgb(200,200,200)'; fins(c); c.fill(); c.fillStyle = 'rgb(245,245,245)'; body(c); c.fill(); });
      c.filter = 'none';
    }, { data: true });
    const bumpTex = k.tex(N, N, c => {
      c.fillStyle = '#808080'; c.fillRect(0, 0, N, N);
      c.save(); c.translate(N / 2, N / 2); c.rotate(-.7); for (let i = -N; i < N; i += 5) { c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-N, i, 2 * N, 2); } c.restore();
      const Lb = 'rgba(255,255,255,.45)', Db = 'rgba(0,0,0,.45)';
      for (const [x, y, r] of stars) { starPath(c, X(x), Y(y), r * S, r * S * .42); satin(c, .5, 5, Lb, Db); }
      circ(c, planet); satin(c, 1.05, 6, Lb, Db);
      c.save(); moonPath(c); c.clip(); moonCut(c); satin(c, -.8, 5, Lb, Db); c.restore();
      trailPoly(c, 1); satin(c, dir + 1.2, 5, Lb, Db);
      inRocket(c, () => { body(c); }); satin(c, dir, 5, Lb, Db);
      c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.6)';
      circ(c, [planet[0], planet[1], planet[2] + .02]); c.stroke(); trailPoly(c, 1); c.stroke();
    }, { data: true });
    // the face: a fine grid over the disc, lifted by the relief map
    const hImg = heightTex.image.getContext('2d').getImageData(0, 0, N, N).data;
    const hAt = (x, y) => {
      const fx = Math.max(0, Math.min(N - 1.001, X(x))), fy = Math.max(0, Math.min(N - 1.001, Y(y))), ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy;
      const s = (i, j) => hImg[((iy + j) * N + ix + i) * 4] / 255;
      return lerp(lerp(s(0, 0), s(1, 0), ax), lerp(s(0, 1), s(1, 1), ax), ay);
    };
    const n = 180, Rf = 1.95, pos = [], uv = [], idx = [], id = new Map();
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const x = -Rf + 2 * Rf * i / n, y = -Rf + 2 * Rf * j / n;
      if (x * x + y * y > (Rf + .04) ** 2) continue;
      id.set(j * (n + 1) + i, pos.length / 3);
      pos.push(x, y, tw + .085 * hAt(x, y)); uv.push((x + Rp) / (2 * Rp), (y + Rp) / (2 * Rp));
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = id.get(j * (n + 1) + i), b = id.get(j * (n + 1) + i + 1), c = id.get((j + 1) * (n + 1) + i), d = id.get((j + 1) * (n + 1) + i + 1);
      if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
      idx.push(a, b, c, b, d, c);
    }
    const face = new T.BufferGeometry();
    face.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); face.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); face.setIndex(idx);
    face.computeVertexNormals();
    const thread = { roughness: .55, sheen: .8, sheenRoughness: .35, sheenColor: k.color('#ffffff') };
    k.add(P, bendGeo(face), k.mat({ map: colorTex, bumpMap: bumpTex, bumpScale: 1.4, ...thread, sheen: .55, sheenColor: k.color('#b8c6ff') }));
    // the felt back
    const backG = new T.RingGeometry(0, Rf, 96, 12); backG.rotateY(Math.PI); backG.translate(0, 0, -tw);
    k.add(P, bendGeo(backG), k.matte('#e9e2d2', .95));
    // the merrowed border: a gold roll with thread wrapped round and round it
    const Rb = 1.985, gold = k.mat({ color: '#f0b429', ...thread, sheenColor: k.color('#fff2a8') });
    k.add(P, bendGeo(k.torus(Rb, .115, { rs: 16, ts: 200 })), k.mat({ color: '#c98f16', ...thread }));
    const wraps = [], Z = new T.Vector3(0, 0, 1);
    for (let i = 0, nw = 250; i < nw; i++) {
      const ph = i / nw * TAU, r = new T.Vector3(Math.cos(ph), Math.sin(ph), 0), t = new T.Vector3(Math.sin(ph), -Math.cos(ph), 0);
      const p0 = r.clone().multiplyScalar(Rb), a = p0.x / Rc, [bx, by, bz] = bendP(p0.x, p0.y, 0);
      const M = frameM(k, new T.Vector3(), r, Z, t).premultiply(new T.Matrix4().makeRotationY(a)).setPosition(bx, by, bz);
      wraps.push(M.multiply(new T.Matrix4().makeRotationX(.5)));
    }
    P.add(instanced(k, k.torus(.134, .024, { rs: 6, ts: 20 }), gold, wraps));
    // the name ribbon, curving along the bottom, with swallowtail ends
    const cy = .95, r0 = 2.03, r1 = 2.43, a0 = k.deg(-90 - 45), a1 = k.deg(-90 + 45), notch = k.deg(4), rm = (r0 + r1) / 2;
    const Pa = (r, ang) => [r * Math.cos(ang), cy + r * Math.sin(ang)];
    const rib = new T.Shape();
    rib.moveTo(...Pa(r1, a0)); rib.absarc(0, cy, r1, a0, a1, false); rib.lineTo(...Pa(rm, a1 - notch)); rib.lineTo(...Pa(r0, a1));
    rib.absarc(0, cy, r0, a1, a0, true); rib.lineTo(...Pa(rm, a0 + notch)); rib.closePath();
    const ribG = k.extrude(rib, .07, { bevel: .025, bevelSeg: 2, curve: 64 });
    const ruv = ribG.attributes.uv, rpos = ribG.attributes.position;
    for (let i = 0; i < rpos.count; i++) { const x = rpos.getX(i), y = rpos.getY(i) - cy; ruv.setXY(i, (Math.atan2(y, x) - a0) / (a1 - a0), (r1 - Math.hypot(x, y)) / (r1 - r0)); }
    ribG.translate(0, 0, tw + .14);
    const ribTex = k.tex(1024, 128, (c, w, h) => {
      c.fillStyle = '#a80a22'; c.fillRect(0, 0, w, h);
      c.save(); c.beginPath(); c.rect(0, 0, w, h); satin(c, -.9, 5, 'rgba(255,120,120,.1)', 'rgba(0,0,0,.16)'); c.restore();
      c.fillStyle = '#f0b429'; c.fillRect(0, 0, w, 8); c.fillRect(0, h - 8, w, 8);
      k.text(c, '★  NOVA 7  ★', w / 2, h * .55, { size: 96, weight: 700, color: '#ffffff', stroke: '#6a0a18', strokeWidth: 8 });
    });
    k.add(P, bendGeo(ribG), k.mat({ map: ribTex, ...thread, sheen: .35, sheenColor: k.color('#ff5a5a') }));
    // float it in the cabin, turned a little away and tipped back
    const { C, R, U } = camFrame(k);
    facing(k, P, C.clone().addScaledVector(R, -.42).addScaledVector(U, .26), U);
    P.rotateZ(k.deg(-9));
    g.add(P);
    g.userData.floating = true;
    g.userData.noHero = true;
    return g;
  },

  // A pair of Apollo-style lunar overshoes, dusted with moon dust: white quilted uppers over a grey woven-metal band,
  // a buckled strap, thick blue silicone soles. One stands; the other has tipped over to show off its ribbed tread.
  moonboot(k) {
    const T = k.THREE, g = k.group();
    const prof = tab => { const c = new T.SplineCurve(tab.map(([y, x]) => new T.Vector2(y, x))), pts = c.getPoints(240); return y => { let i = 0; while (i < pts.length - 2 && pts[i + 1].x < y) i++; const a = pts[i], b = pts[i + 1]; return a.y + (b.y - a.y) * clamp01((y - a.x) / (b.x - a.x || 1)); }; };
    // the upper's side profile (toe along +z): its front and back edges and its half-width at each height
    const F = prof([[.14, .8], [.22, .83], [.3, .82], [.38, .76], [.46, .64], [.54, .5], [.62, .37], [.72, .26], [.84, .19], [1.0, .16], [1.2, .17], [1.34, .19]]);
    const B = prof([[.14, -.72], [.24, -.78], [.36, -.79], [.5, -.76], [.66, -.68], [.84, -.61], [1.04, -.58], [1.2, -.58], [1.34, -.6]]);
    const Wd = prof([[.14, .34], [.3, .36], [.5, .345], [.75, .32], [1.0, .31], [1.34, .33]]);
    const Y0 = .14, Y1 = 1.34, SE = 2 / 2.5, flapW = .56, flapU = flapW / TAU, Q0 = .95, QS = .075, Q1 = 1.3;
    const lift = (y, th) => { const a = Math.abs(Math.atan2(Math.sin(th), Math.cos(th))); return .024 * smooth(flapW + .07, flapW - .01, a) * smooth(.46, .56, y); };
    const ring = (y, th, off = 0) => {
      const zf = F(y), zb = B(y), zm = (zf + zb) / 2, hl = (zf - zb) / 2, w = Wd(y), c = Math.cos(th), s = Math.sin(th);
      const x = w * Math.sign(s) * Math.abs(s) ** SE, z = hl * Math.sign(c) * Math.abs(c) ** SE, f = 1 + off / Math.max(.15, Math.hypot(x, z));
      return new T.Vector3(x * f, y, zm + z * f);
    };
    // quilted channels puff out round the shaft between rows of stitching
    const quilt = (y, th) => { const a = Math.abs(Math.atan2(Math.sin(th), Math.cos(th))); return y < Q0 || y > Q1 ? 0 : .013 * (.5 - .5 * Math.cos((y - Q0) / QS * TAU)) * smooth(flapW - .02, flapW + .08, a); };
    const onUpper = (y, th, off = 0) => ring(y, th, lift(y, th) + quilt(y, th) + off);
    // ---- materials and textures ----
    const vy = (y, h) => h * (1 - (y - Y0) / (Y1 - Y0));
    const dust = [];
    for (let i = 0; i < 300; i++) dust.push([k.rand(), Y0 + Math.pow(k.rand(), 2) * .6, k.range(8, 32)]);
    const upperTex = k.tex(1024, 512, (c, w, h) => {
      c.fillStyle = '#eceef1'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(40,50,70,.05)'; for (let x = 0; x < w; x += 3) c.fillRect(x, 0, 1, h); for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
      // the front flap, a touch brighter
      const fy = vy(.55, h);
      c.fillStyle = '#f7f8fa'; c.fillRect(0, 0, flapU * w, fy); c.fillRect(w - flapU * w, 0, flapU * w, fy);
      c.setLineDash([9, 6]); c.lineWidth = 2.5; c.strokeStyle = '#a3abb6';
      for (const x of [flapU * w - 8, w - flapU * w + 8, 4, w - 4]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, fy - 10); c.stroke(); }
      for (const x0 of [0, w - flapU * w]) { c.beginPath(); c.moveTo(x0, fy - 10); c.lineTo(x0 + flapU * w, fy - 10); c.stroke(); }
      // quilted channels round the shaft
      for (let y = Q0; y < Q1 + .01; y += QS) {
        const yy = vy(y, h), gr = c.createLinearGradient(0, yy, 0, yy + 16); gr.addColorStop(0, 'rgba(60,70,90,.2)'); gr.addColorStop(1, 'rgba(60,70,90,0)');
        c.fillStyle = gr; c.fillRect(flapU * w, yy, w - 2 * flapU * w, 16);
        c.beginPath(); c.moveTo(flapU * w, yy); c.lineTo(w - flapU * w, yy); c.stroke();
      }
      // toe cap and heel counter, stitched on
      c.beginPath(); c.moveTo(-.16 * w, vy(.37, h)); c.quadraticCurveTo(0, vy(.62, h), .16 * w, vy(.37, h)); c.stroke();
      c.beginPath(); c.moveTo(.84 * w, vy(.37, h)); c.quadraticCurveTo(w, vy(.62, h), 1.16 * w, vy(.37, h)); c.stroke();
      c.beginPath(); c.moveTo(.38 * w, vy(.37, h)); c.quadraticCurveTo(.5 * w, vy(.8, h), .62 * w, vy(.37, h)); c.stroke();
      c.setLineDash([]);
      // the woven metal band along the bottom, and its piping
      const yb = vy(.37, h);
      c.fillStyle = '#a9b0ba'; c.fillRect(0, yb, w, h - yb);
      for (let y = yb; y < h; y += 4) for (let x = (Math.floor(y / 4) % 2) * 2; x < w; x += 4) { c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x, y, 2, 2); }
      c.fillStyle = '#737b87'; c.fillRect(0, yb - 3, w, 6);
      // moon dust, thickest near the sole
      for (const [u, y, r] of dust) for (const du of [-1, 0, 1]) {
        const x = (u + du) * w, yy = vy(y, h), al = .42 * (1 - smooth(Y0, .72, y));
        const gr = c.createRadialGradient(x, yy, 0, x, yy, r); gr.addColorStop(0, `rgba(112,110,106,${al})`); gr.addColorStop(1, 'rgba(112,110,106,0)');
        c.fillStyle = gr; c.fillRect(x - r, yy - r, 2 * r, 2 * r);
      }
      for (let i = 0; i < 1400; i++) { const y = Y0 + Math.pow(k.rand(), 2.5) * .7; c.fillStyle = `rgba(80,78,74,${k.range(.2, .5)})`; c.fillRect(k.rand() * w, vy(y, h), 1.6, 1.6); }
    });
    const upperBump = k.tex(1024, 512, (c, w, h) => {
      c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(0,0,0,.14)'; for (let x = 0; x < w; x += 3) c.fillRect(x, 0, 1, h); for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
      const yb = vy(.37, h);
      for (let y = yb; y < h; y += 4) for (let x = (Math.floor(y / 4) % 2) * 2; x < w; x += 4) { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x, y, 2, 2); }
      c.fillStyle = '#b0b0b0'; c.fillRect(0, yb - 4, w, 8);
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
      for (let y = Q0; y < Q1 + .01; y += QS) { const yy = vy(y, h); c.beginPath(); c.moveTo(flapU * w, yy); c.lineTo(w - flapU * w, yy); c.stroke(); }
      const fy = vy(.55, h);
      for (const x of [flapU * w, w - flapU * w]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, fy); c.stroke(); }
    }, { data: true });
    const upperMR = k.tex(256, 128, (c, w, h) => { c.fillStyle = 'rgb(0,232,0)'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgb(0,118,255)'; c.fillRect(0, vy(.37, h), w, h); }, { data: true });
    const upperM = k.mat({ map: upperTex, bumpMap: upperBump, bumpScale: 1.2, roughnessMap: upperMR, metalnessMap: upperMR, roughness: 1, metalness: 1, sheen: .45, sheenRoughness: .5, sheenColor: k.color('#ffffff') });
    const soleTex = k.tex(512, 128, (c, w, h) => {
      c.fillStyle = '#3d7ddd'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) { const x = k.rand() * w, y = h - Math.pow(k.rand(), 1.8) * h * .7, r = k.range(6, 20); for (const dx of [-w, 0, w]) { const gr = c.createRadialGradient(x + dx, y, 0, x + dx, y, r); gr.addColorStop(0, 'rgba(120,118,114,.35)'); gr.addColorStop(1, 'rgba(120,118,114,0)'); c.fillStyle = gr; c.fillRect(x + dx - r, y - r, 2 * r, 2 * r); } }
      for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(150,148,144,${k.range(.2, .5)})`; c.fillRect(k.rand() * w, k.rand() * h, 1.5, 1.5); }
    });
    const soleM = k.mat({ map: soleTex, roughness: .5, clearcoat: .3, clearcoatRoughness: .45 });
    const chrome = k.metal('#e9edf2', .12);
    const strapM = k.fabric('#98a7bd', { scale: 2 }), collarM = k.fabric('#e3e6ea', { scale: 3 }), loopM = k.fabric('#3d7ddd', { scale: 2 });
    // ---- one boot ----
    const boot = k.group();
    k.add(boot, surface(k, (u, v) => onUpper(lerp(Y0, Y1, v), u * TAU).toArray(), 96, 110), upperM);
    // the sole: a blue rand round the upper's foot, rising at the toe and the heel, with a flat underside
    const SO = .05, yS = .2, yB = .06, rE = .035;
    const soleTop = z => .25 + .09 * smooth(.35, .76, z) + .05 * smooth(-.45, -.76, z);
    const outN = th => { const d = ring(yS, th + .01).sub(ring(yS, th - .01)); return new T.Vector3(-d.z, 0, d.x).normalize(); };
    k.add(boot, surface(k, (u, v) => {
      const th = u * TAU, O = ring(yS, th), nn = outN(th), top = soleTop(O.z);
      let off, y;
      if (v < .2) { const a2 = v / .2 * Math.PI / 2; off = SO - rE + rE * Math.sin(a2); y = yB + rE - rE * Math.cos(a2); }
      else if (v < .8) { off = SO; y = lerp(yB + rE, top - .03, (v - .2) / .6); }
      else { const a2 = (v - .8) / .2 * Math.PI / 2; off = -.012 + (SO + .012) * Math.cos(a2); y = top - .03 + .03 * Math.sin(a2); }
      return [O.x + nn.x * off, y, O.z + nn.z * off];
    }, 96, 20), soleM);
    const capPts = []; for (let i = 0; i < 96; i++) { const th = i / 96 * TAU; capPts.push(ring(yS, th).addScaledVector(outN(th), SO - rE)); }
    const capShape = new T.Shape(); capPts.forEach((q, i) => i ? capShape.lineTo(q.x, q.z) : capShape.moveTo(q.x, q.z));
    const capGeo = new T.ShapeGeometry(capShape, 1); capGeo.rotateX(Math.PI / 2); capGeo.translate(0, yB, 0);
    k.add(boot, capGeo, k.matte('#666a72', .96));
    // the tread: ribs straight across the sole
    const xExt = z => { let m = 0; for (let i = 0; i < capPts.length; i++) { const a = capPts[i], b = capPts[(i + 1) % capPts.length]; if ((a.z - z) * (b.z - z) <= 0 && a.z !== b.z) m = Math.max(m, Math.abs(lerp(a.x, b.x, (z - a.z) / (b.z - a.z)))); } return m; };
    const zs = capPts.map(q => q.z), zMin = Math.min(...zs), zMax = Math.max(...zs), ribs = [];
    for (let z = zMin + .065; z < zMax - .04; z += .1) { const wx = xExt(z) * 2 - .07; if (wx > .1) ribs.push(new T.Matrix4().compose(new T.Vector3(0, .035, z), new T.Quaternion(), new T.Vector3(wx, 1, 1))); }
    boot.add(instanced(k, k.box(1, .07, .058, .022, 2), k.mat({ color: '#4f88dc', roughness: .55, clearcoat: .2 }), ribs));
    // the padded collar and the dark opening
    const collar = []; for (let i = 0; i < 64; i++) collar.push(onUpper(Y1, i / 64 * TAU, .01));
    k.add(boot, varTube(k, curveOf(k, collar, true), () => .052, { closed: true, seg: 128, rs: 16 }), collarM);
    const zm1 = (F(Y1) + B(Y1)) / 2, hl1 = (F(Y1) - B(Y1)) / 2;
    k.add(boot, k.disc(1, 48), k.matte('#48505b', .95), { p: [0, Y1 - .03, zm1], r: [-Math.PI / 2, 0, 0], s: [Wd(Y1) * .95, hl1 * .95, 1] });
    // the ankle strap and its buckle
    const yT = .84, strap = []; for (let i = 0; i < 72; i++) strap.push(onUpper(yT, i / 72 * TAU, .02));
    k.add(boot, varTube(k, curveOf(k, strap, true), () => .016, { closed: true, up: [0, 1, 0], flat: 3.6, seg: 144, rs: 12 }), strapM);
    const tb = .92, bp = onUpper(yT, tb, .05), bt = onUpper(yT, tb + .01).sub(onUpper(yT, tb - .01)).normalize(), Yv = new T.Vector3(0, 1, 0), bn = new T.Vector3().crossVectors(bt, Yv).normalize();
    const buckle = k.group(); buckle.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(bt, Yv, bn)); buckle.position.copy(bp);
    k.add(buckle, k.tube(rrLoop(.2, .2, .045), .016, { closed: true, seg: 96, rs: 10 }), chrome);
    k.add(buckle, k.cyl(.013, .013, .2, { seg: 12 }), chrome, { p: [-.02, 0, 0] });
    k.add(buckle, k.box(.12, .018, .018, .008), chrome, { p: [.035, 0, .012] });
    k.add(buckle, k.box(.2, .1, .018, .008), strapM, { p: [.16, 0, -.008] });
    boot.add(buckle);
    // a pull loop at the back of the collar
    const zb1 = B(Y1);
    k.add(boot, varTube(k, curveOf(k, [[0, Y1 - .12, zb1 - .012], [0, Y1 + .05, zb1 - .045], [0, Y1 + .15, zb1 + .01], [0, Y1 + .09, zb1 + .08], [0, Y1 - .04, zb1 + .075]]), () => .02, { up: [1, 0, 0], flat: 2.4, seg: 48, rs: 10 }), loopM);
    // ---- the pair: one standing, one tipped over on its side with its tread to the camera ----
    const b1 = boot; b1.rotation.y = -.32; b1.position.set(.55, 0, -.3); g.add(b1);
    const b2 = boot.clone(); b2.scale.set(-1, 1, 1); b2.rotation.set(0, k.deg(-52), Math.PI / 2); b2.position.set(-.72, 0, .72); g.add(b2);
    b2.updateMatrixWorld(true); b2.position.y -= new T.Box3().setFromObject(b2).min.y;
    // a sprinkle of dust that fell off the tread
    const specks = [], speckCols = [];
    for (let i = 0; i < 26; i++) {
      const s = k.range(.012, .032);
      specks.push(new T.Matrix4().compose(new T.Vector3(k.range(-1.5, .6), s * .4, k.range(.85, 1.6)), new T.Quaternion().setFromEuler(new T.Euler(k.rand() * 3, k.rand() * 3, k.rand() * 3)), new T.Vector3(s, s * .6, s)));
      speckCols.push(k.pick(['#8d8b86', '#a3a09a', '#76746f']));
    }
    g.add(instanced(k, new T.IcosahedronGeometry(1, 0), k.matte('#ffffff', .95), specks, speckCols));
    g.userData.view = { az: 30, el: 18 };
    return g;
  },
};
