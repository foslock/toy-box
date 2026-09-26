// Models for the Backyard set's patio cards. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Compute normals, then average them across vertices that share a position, so lathe, sphere and tube seams don't show.
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
// A surface from fn(u, v) => [x, y, z] over the unit square, with UVs (u, v). Faces point along (d/du × d/dv).
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
const curveOf = (k, pts, closed = false) => new k.THREE.CatmullRomCurve3(pts.map(q => new k.THREE.Vector3(...q)), closed);
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
// Turn obj so its local +y runs along d, with its local +z leaning toward w (world up by default).
function orient(k, obj, d, w = [0, 1, 0]) {
  const T = k.THREE, Y = new T.Vector3(...d).normalize(), W = new T.Vector3(...w);
  const Z = W.clone().addScaledVector(Y, -W.dot(Y));
  if (Z.lengthSq() < 1e-8) Z.set(1, 0, 0).addScaledVector(Y, -Y.x);
  Z.normalize();
  const X = new T.Vector3().crossVectors(Y, Z);
  obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z));
  return obj;
}
// A cylinder from a to b.
function rod(k, a, b, r, mat, o = {}) {
  const T = k.THREE, A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A);
  const m = k.mesh(k.cyl(r, r, d.length(), { seg: o.seg ?? 16 }), mat, { shadow: o.shadow });
  m.position.copy(A).addScaledVector(d, .5);
  return orient(k, m, d.toArray());
}
// A tube along a polyline whose corners are bent round like tubing: pts [[x, y, z, bendRadius?], ...].
function bentTube(k, pts, r, o = {}) {
  const T = k.THREE, V = pts.map(p => new T.Vector3(p[0], p[1], p[2])), n = V.length, closed = !!o.closed, path = new T.CurvePath();
  const corner = i => {
    const b = V[i], a = V[(i - 1 + n) % n], c = V[(i + 1) % n];
    const ua = a.clone().sub(b), uc = c.clone().sub(b), la = ua.length(), lc = uc.length();
    const rr = Math.min(pts[i][3] ?? o.bend ?? r * 3, la * .45, lc * .45);
    return [b.clone().addScaledVector(ua, rr / la), b.clone(), b.clone().addScaledVector(uc, rr / lc)];
  };
  const corners = V.map((_, i) => closed || (i > 0 && i < n - 1) ? corner(i) : null);
  let cur = closed ? corners[0][2].clone() : V[0].clone();
  const order = closed ? [...Array(n).keys()].slice(1).concat([0]) : [...Array(n).keys()].slice(1);
  for (const i of order) {
    const cn = corners[i];
    if (cn) {
      if (cur.distanceTo(cn[0]) > 1e-5) path.add(new T.LineCurve3(cur.clone(), cn[0]));
      path.add(new T.QuadraticBezierCurve3(cn[0], cn[1], cn[2]));
      cur = cn[2].clone();
    } else { path.add(new T.LineCurve3(cur.clone(), V[i].clone())); cur = V[i].clone(); }
  }
  return new T.TubeGeometry(path, o.seg ?? 240, r, o.rs ?? 12, closed);
}
// A soft additive glow around a light (drawn over what's behind it, casts no shadow).
function halo(k, r, color, opacity = .35) {
  const T = k.THREE, tex = k.tex(128, 128, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, { cache: 'patio-halo' });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k.color(color), transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }));
  s.scale.set(r * 2, r * 2, 1);
  return s;
}
// A rounded rectangle's outline in the xz plane, walked by arc length: at(u) => [x, z, nx, nz] for u in 0..1,
// starting at the middle of the front (+z) edge and running toward +x.
function rrPath(hw, hd, r) {
  const sx = hw - r, sz = hd - r, q = Math.PI / 2 * r;
  const segs = [
    [sx, s => [s, hd, 0, 1]],
    [q, s => { const a = s / r; return [sx + Math.sin(a) * r, sz + Math.cos(a) * r, Math.sin(a), Math.cos(a)]; }],
    [2 * sz, s => [hw, sz - s, 1, 0]],
    [q, s => { const a = s / r; return [sx + Math.cos(a) * r, -sz - Math.sin(a) * r, Math.cos(a), -Math.sin(a)]; }],
    [2 * sx, s => [sx - s, -hd, 0, -1]],
    [q, s => { const a = s / r; return [-sx - Math.sin(a) * r, -sz - Math.cos(a) * r, -Math.sin(a), -Math.cos(a)]; }],
    [2 * sz, s => [-hw, -sz + s, -1, 0]],
    [q, s => { const a = s / r; return [-sx - Math.cos(a) * r, sz + Math.sin(a) * r, -Math.cos(a), Math.sin(a)]; }],
    [sx, s => [-sx + s, hd, 0, 1]],
  ];
  const len = segs.reduce((a, [l]) => a + l, 0);
  const at = u => {
    let s = (((u % 1) + 1) % 1) * len;
    for (const [l, f] of segs) { if (s <= l + 1e-9) return f(Math.min(s, l)); s -= l; }
    return segs[0][1](0);
  };
  return { at, len };
}
// Paint text letter by letter along a line, each letter nudged and tilted like it was painted by hand.
function handLetters(k, c, str, x0, x1, y, o = {}) {
  c.save();
  c.font = `${o.weight ?? 700} ${o.size}px ${o.font ?? 'Fredoka, system-ui, sans-serif'}`;
  const ws = [...str].map(ch => c.measureText(ch).width + (o.gap ?? 0)), total = ws.reduce((a, b) => a + b, 0);
  let x = (x0 + x1) / 2 - total / 2;
  [...str].forEach((ch, i) => {
    c.save(); c.translate(x + ws[i] / 2, y + k.range(-1, 1) * (o.bounce ?? 0)); c.rotate(k.range(-1, 1) * (o.tilt ?? 0));
    k.text(c, ch, 0, 0, { size: o.size, weight: o.weight, font: o.font, color: Array.isArray(o.color) ? o.color[i % o.color.length] : o.color, stroke: o.stroke, strokeWidth: o.strokeWidth });
    c.restore();
    x += ws[i];
  });
  c.restore();
}

export default {
  // A tall glass of pale lemonade: ice, a lemon wheel on the rim, a striped paper straw and beads of condensation.
  lemonade(k) {
    const T = k.THREE, g = k.group();
    const H = 3.9, R0 = .78, R1 = .97, W = .06, B = .34, F = 3.0;           // glass height, bottom and top radius, wall, base; fill line
    const Ro = y => R0 + (R1 - R0) * y / H, Ri = y => Ro(y) - W;
    // the glass: a heavy base, straight tapered walls and a rounded rim that catches the light
    const glassGeo = k.lathe([[0, 0], [R0 - .07, 0], [R0 - .015, .02], [R0, .07], [Ro(H - .03), H - .03], [Ro(H) - .015, H], [Ri(H) + .015, H], [Ri(H - .03), H - .03],
      [Ri(B + .05), B + .05], [Ri(B) - .05, B], [0, B]], { seg: 72 });
    k.add(g, glassGeo, k.glass('#f2fbff', { opacity: .13, env: 2.4 }), { shadow: false }).renderOrder = 6;
    k.add(g, k.torus(Ro(H) - W / 2, W / 2 + .006, { rs: 8, ts: 72 }), k.glass('#ffffff', { opacity: .55, env: 3 }), { p: [0, H - .004, 0], r: [Math.PI / 2, 0, 0], shadow: false }).renderOrder = 6;
    k.add(g, k.cyl(R0 - .02, Ro(B) - .03, B - .03, { seg: 48 }), k.glass('#e6fff4', { opacity: .28, env: 2.4 }), { p: [0, B / 2, 0], shadow: false }).renderOrder = 5;
    // the lemonade: a denser back layer and a thin front layer, so what's inside shows through, tinted
    const liqGeo = k.lathe([[0, B + .005], [Ri(B) - .05, B + .005], [Ri(B + .05) - .004, B + .055], [Ri(F) - .004, F], [0, F]], { seg: 72 });
    const juiceBack = k.mat({ color: '#fad232', roughness: .3, transparent: true, opacity: .9, emissive: '#f5b400', emissiveIntensity: .32, side: T.BackSide, depthWrite: false });
    const juiceFront = k.mat({ color: '#fff3a8', roughness: .06, clearcoat: 1, clearcoatRoughness: .05, transparent: true, opacity: .24, emissive: '#ffd84a', emissiveIntensity: .1, depthWrite: false });
    k.add(g, liqGeo, juiceBack).renderOrder = 1;
    k.add(g, liqGeo, juiceFront, { shadow: false }).renderOrder = 4;
    // ice cubes with bright frosted edges, the top ones bobbing out of the lemonade
    const iceTex = k.tex(128, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(0, 0, w, h);
      const gr = c.createRadialGradient(w / 2, h / 2, w * .2, w / 2, h / 2, w * .72);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.95)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(k.range(20, 60), k.range(20, 108)); c.lineTo(k.range(60, 108), k.range(20, 108)); c.stroke(); }
    });
    const ice = k.mat({ color: '#eef8ff', map: iceTex, roughness: .05, transparent: true, opacity: 1, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 2.6, depthWrite: false, specularIntensity: 1 });
    const cube = k.box(.56, .5, .56, .08, 2);
    for (const [x, y, z, rx, ry, rz, s] of [[-.34, F - .02, .12, .3, .5, .2, 1], [.3, F + .04, -.18, -.25, .9, .35, .95], [.1, F - .1, .42, .5, .2, -.3, .85],
      [-.12, F - .75, -.22, .2, 1.3, .1, .9], [.28, F - 1.35, .2, .9, .4, .5, .85], [-.25, F - 1.95, .1, .4, .7, .2, .8]])
      k.add(g, cube, ice, { p: [x, y, z], r: [rx, ry, rz], s, shadow: false }).renderOrder = 2;
    // lemon: a wheel slit onto the rim and a slice pressed against the inside of the glass
    const face = k.tex(256, 256, (c, w, h) => {
      const m = w / 2;
      c.fillStyle = '#f2c511'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fbf4d6'; c.beginPath(); c.arc(m, m, m * .9, 0, TAU); c.fill();
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a0 = i / n * TAU + .07, a1 = (i + 1) / n * TAU - .07, am = (a0 + a1) / 2;
        const gr = c.createRadialGradient(m, m, m * .1, m, m, m * .82);
        gr.addColorStop(0, '#fff7c2'); gr.addColorStop(.6, '#fbe46a'); gr.addColorStop(1, '#f5d23a');
        c.fillStyle = gr; c.beginPath();
        c.moveTo(m + Math.cos(am) * m * .14, m + Math.sin(am) * m * .14);
        c.arc(m, m, m * .82, a0, a1); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.5;
        for (let j = 0; j < 7; j++) { const a = k.range(a0 + .06, a1 - .06), r0 = k.range(.22, .6) * m, r1 = r0 + k.range(.08, .18) * m; c.beginPath(); c.moveTo(m + Math.cos(a) * r0, m + Math.sin(a) * r0); c.lineTo(m + Math.cos(a) * r1, m + Math.sin(a) * r1); c.stroke(); }
      }
      c.fillStyle = '#fffbe6'; c.beginPath(); c.arc(m, m, m * .1, 0, TAU); c.fill();
    });
    const pulp = k.mat({ map: face, roughness: .25, clearcoat: .8, clearcoatRoughness: .1, emissive: '#ffffff', emissiveMap: face, emissiveIntensity: .12 });
    const rind = k.gloss('#f2c511', { rough: .35 });
    const th = k.deg(-75), rw = Ro(H) - W / 2;
    const wheel = k.mesh(k.cyl(.62, .62, .11, { seg: 48 }), [rind, pulp, pulp], { p: [Math.sin(th) * rw, H + .02, Math.cos(th) * rw] });
    g.add(orient(k, wheel, [Math.cos(th), .12, -Math.sin(th)]));
    const ta = k.deg(-20), ry = 1.55, rs = Ri(ry) - .08;
    const inside = k.mesh(k.cyl(.52, .52, .09, { seg: 40 }), [rind, pulp, pulp], { p: [Math.sin(ta) * rs, ry, Math.cos(ta) * rs] });
    g.add(orient(k, inside, [Math.sin(ta), .25, Math.cos(ta)]));
    // a striped paper straw leaning on the rim
    const stripes = k.tex(64, 64, (c, w, h) => {
      c.fillStyle = '#fdf9f2'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#e63b3b';
      for (const x0 of [-w, -w / 2, 0, w / 2]) { c.beginPath(); c.moveTo(x0, h); c.lineTo(x0 + w / 4, h); c.lineTo(x0 + w / 4 + w, 0); c.lineTo(x0 + w, 0); c.closePath(); c.fill(); }
    }, { repeat: [1, 11] });
    const sb = new T.Vector3(-.3, B + .04, -.12), sc = new T.Vector3(Ri(H) - .1, H, .12), sd = sc.clone().sub(sb).normalize();
    const SL = sc.distanceTo(sb) + 1.3;
    const straw = k.mesh(k.cyl(.085, .085, SL, { open: true, seg: 24 }), k.mat({ map: stripes, roughness: .75, side: T.DoubleSide }), { p: sb.clone().addScaledVector(sd, SL / 2).toArray() });
    g.add(orient(k, straw, sd.toArray()));
    // condensation: beads on the cold part of the glass, and two that have run
    const dropMat = k.mat({ color: '#ffffff', roughness: .02, transparent: true, opacity: .55, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 3, depthWrite: false, specularIntensity: 1 });
    const drops = [];
    for (let i = 0; i < 38; i++) {
      const a = k.range(-1.3, 2.3), y = k.range(.4, F - .1), s = k.range(.03, .075);
      drops.push({ p: [Math.sin(a) * (Ro(y) + s * .15), y, Math.cos(a) * (Ro(y) + s * .15)], r: [0, a, 0], s: [s, s * k.range(1.05, 1.5), s * .45] });
    }
    for (const [a, y0, y1] of [[.35, F - .3, 1.15], [1.25, F - .55, .75]]) {
      const run = [];
      for (let i = 0; i <= 6; i++) { const y = y0 + (y1 - y0) * i / 6, aa = a + .02 * Math.sin(i * 1.7); run.push([Math.sin(aa) * (Ro(y) + .004), y, Math.cos(aa) * (Ro(y) + .004)]); }
      const tm = k.mesh(k.tube(run, .018, { seg: 30, rs: 8 }), dropMat, { shadow: false }); tm.renderOrder = 7; g.add(tm);
      drops.push({ p: [Math.sin(a) * (Ro(y1) + .01), y1 - .03, Math.cos(a) * (Ro(y1) + .01)], r: [0, a, 0], s: [.07, .09, .032] });
    }
    const dm = k.instances(k.sphere(1, { w: 16, h: 12 }), dropMat, drops); dm.castShadow = false; dm.renderOrder = 7; g.add(dm);
    g.userData.view = { el: 18 };
    return g;
  },

  // A red, white and blue rocket pop on its stick, frosty and starting to drip.
  rocketpop(k) {
    const T = k.THREE, g = k.group();
    const pop = k.group([], { r: [0, .3, 0] }), tilt = k.group([pop], { r: [0, 0, -.13] }); g.add(tilt);
    const iceMat = (base, light, dark) => {
      const map = k.tex(128, 128, (c, w, h) => {
        c.fillStyle = base; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 260; i++) { c.fillStyle = k.rand() < .7 ? light : dark; c.globalAlpha = k.range(.15, .55); const s = k.range(1, 2.6); c.fillRect(k.rand() * w, k.rand() * h, s, s); }
        c.globalAlpha = 1;
      }, { repeat: [4, 3] });
      return k.mat({ color: '#ffffff', map, roughness: .32, clearcoat: 1, clearcoatRoughness: .07, sheen: .6, sheenRoughness: .35, sheenColor: k.color('#ffffff'), bumpMap: map, bumpScale: .5 });
    };
    const red = iceMat('#e0252f', '#ff8a8a', '#a8121c'), white = iceMat('#f3f6f8', '#ffffff', '#cfd8e0'), blue = iceMat('#1f63d8', '#7fb2ff', '#123f96');
    const y0 = 1.9;
    const blueP = [[0, 0], [.8, 0], [.9, .02], [.97, .08], [1.0, .18], [.97, .6], [.92, 1.15], [.87, 1.55], [.84, 1.6], [.7, 1.62], [0, 1.62]];
    const whiteP = [[0, 1.58], [.84, 1.58], [.9, 1.61], [.915, 1.68], [.88, 2.1], [.82, 2.6], [.77, 2.97], [.74, 3.02], [.6, 3.04], [0, 3.04]];
    const redP = [[0, 3.0], [.76, 3.0], [.81, 3.03], [.825, 3.1], [.8, 3.4], [.72, 3.8], [.58, 4.2], [.4, 4.5], [.22, 4.7], [.08, 4.79], [0, 4.8]];
    for (const [prof, mat] of [[blueP, blue], [whiteP, white], [redP, red]]) k.add(pop, k.lathe(prof, { seg: 64 }), mat, { p: [0, y0, 0] });
    const rAt = (prof, y) => { for (let i = 1; i < prof.length; i++) { const [r0, a] = prof[i - 1], [r1, b] = prof[i]; if (y >= a && y <= b && b > a) return r0 + (r1 - r0) * (y - a) / (b - a); } return 0; };
    // a cherry drip running down over the white, and a blue one hanging off the bottom with a drop about to fall
    const dripA = 0;
    const dc = curveOf(k, [3.04, 2.9, 2.75, 2.6, 2.45, 2.36].map((y, i) => { const r = rAt(whiteP, y) + .015, a = dripA + .04 * Math.sin(i * 1.3); return [Math.sin(a) * r, y0 + y, Math.cos(a) * r]; }));
    k.add(pop, varTube(k, dc, (s, L) => { const t = s / L; return (t < .15 ? .06 + .02 * (1 - t / .15) : .05 + .04 * smooth(.6, .95, t)) * (t > .92 ? Math.sqrt(Math.max(0, 1 - ((t - .92) / .08) ** 2)) : 1); }, { seg: 40, rs: 14, up: [0, 0, 1], flat: .55 }), red);
    const bA = 1.6;
    const bc = curveOf(k, [[.72, .34], [.95, .17], [1.0, .05], [.97, -.1], [.95, -.26]].map(([r, y]) => [Math.sin(bA) * r, y0 + y, Math.cos(bA) * r]));
    k.add(pop, varTube(k, bc, (s, L) => { const t = s / L; return (.05 + .065 * smooth(.5, .9, t)) * (t > .88 ? Math.sqrt(Math.max(0, 1 - ((t - .88) / .12) ** 2)) : 1); }, { seg: 40, rs: 14 }), blue);
    k.add(pop, k.sphere(.075, { w: 20, h: 14 }), blue, { p: [Math.sin(bA) * .95, y0 - .7, Math.cos(bA) * .95], s: [1, 1.3, 1] });
    // blue melt running down the front of the stick
    const sc2 = curveOf(k, [[.06, y0 + .02, .07], [.08, y0 - .25, .066], [.05, y0 - .55, .064], [.07, y0 - .72, .064]]);
    k.add(pop, varTube(k, sc2, (s, L) => { const t = s / L; return (.07 - .03 * t + .03 * smooth(.75, .95, t)) * (t > .9 ? Math.sqrt(Math.max(0, 1 - ((t - .9) / .1) ** 2)) : 1); }, { seg: 30, rs: 12, up: [0, 0, 1], flat: .35 }), blue);
    // the flat birch stick
    const wood = k.wood('maple', { rough: .7 });
    k.add(pop, k.extrude(k.roundRect(.52, 2.5, .26), .07, { bevel: .025 }), [wood, wood], { p: [0, 1.25, 0] });
    return g;
  },

  // A s'more: graham crackers, a toasted marshmallow squished out of the sides, and a square of chocolate peeking out.
  smore(k) {
    const T = k.THREE, g = k.group();
    const S = 2.5, t = .22, M = .95;                 // cracker size and thickness, marshmallow height
    const holes = [];
    for (const hx of [.16, .32, .68, .84]) for (let j = 0; j < 5; j++) holes.push([hx, .13 + j * .185]);
    const crackerTex = k.tex(512, 512, (c, w, h) => {
      const gr = c.createRadialGradient(w / 2, h / 2, w * .2, w / 2, h / 2, w * .75);
      gr.addColorStop(0, '#e3b066'); gr.addColorStop(1, '#b8792f');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) { c.fillStyle = k.rand() < .5 ? `rgba(120,64,20,${k.range(.1, .35)})` : `rgba(255,226,160,${k.range(.1, .4)})`; const s = k.range(1, 3.5); c.fillRect(k.rand() * w, k.rand() * h, s, s); }
      c.fillStyle = 'rgba(110,58,18,.6)'; c.fillRect(w / 2 - 4, 18, 8, h - 36);                 // the score line
      c.fillStyle = 'rgba(255,230,170,.4)'; c.fillRect(w / 2 + 4, 18, 3, h - 36);
      for (const [hx, hy] of holes) {
        c.fillStyle = 'rgba(255,230,170,.5)'; c.beginPath(); c.arc(hx * w + 2, hy * h + 2, 7.5, 0, TAU); c.fill();
        c.fillStyle = '#6b3814'; c.beginPath(); c.arc(hx * w, hy * h, 6.5, 0, TAU); c.fill();
      }
    });
    const crackerBump = k.tex(512, 512, (c, w, h) => {
      c.fillStyle = '#9a9a9a'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) { const v = k.range(90, 190) | 0; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(k.rand() * w, k.rand() * h, k.range(1, 4), k.range(1, 4)); }
      c.fillStyle = '#202020'; c.fillRect(w / 2 - 4, 18, 8, h - 36);
      for (const [hx, hy] of holes) { c.beginPath(); c.arc(hx * w, hy * h, 6.5, 0, TAU); c.fill(); }
    }, { data: true });
    for (const tx of [crackerTex, crackerBump]) { tx.repeat.set(1 / S, 1 / S); tx.offset.set(.5, .5); }
    const edgeTex = k.tex(128, 128, (c, w, h) => {
      c.fillStyle = '#c4843d'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 700; i++) { c.fillStyle = k.rand() < .5 ? `rgba(110,56,16,${k.range(.15, .45)})` : `rgba(250,215,150,${k.range(.15, .45)})`; c.fillRect(k.rand() * w, k.rand() * h, k.range(1, 3), k.range(1, 3)); }
    }, { repeat: [4, 1] });
    const top = k.mat({ map: crackerTex, bumpMap: crackerBump, bumpScale: 2.5, roughness: .85 }), side = k.mat({ map: edgeTex, bumpMap: edgeTex, bumpScale: 2, roughness: .95 });
    const cracker = () => k.mesh(k.extrude(k.roundRect(S - .06, S - .06, .1), t - .06, { bevel: .03, bevelSeg: 2 }), [top, side], { r: [-Math.PI / 2, 0, 0] });
    const bottom = cracker(); bottom.position.y = t / 2; g.add(bottom);
    // the chocolate square: four segments of a bar, its front corner poking out past the marshmallow
    const choc = k.mat({ color: '#4a2818', roughness: .3, clearcoat: .7, clearcoatRoughness: .2 });
    const cg = k.group([], { p: [.4, t, .46], r: [0, .12, 0] }); g.add(cg);
    k.add(cg, k.box(1.3, .08, 1.3, .03), choc, { p: [0, .04, 0] });
    cg.add(k.instances(k.box(.58, .08, .58, .035), choc, [[-.31, -.31], [.31, -.31], [-.31, .31], [.31, .31]].map(([x, z]) => ({ p: [x, .1, z] }))));
    // the marshmallow: toasted golden-brown over the top, its skin split round the sides where the soft white goo bulges out
    const edge = [];                                           // where the toasted skin tore: canvas top = the top of the marshmallow
    for (let i = 0; i <= 80; i++) edge.push([i / 80, .42 + .05 * Math.sin(i / 80 * TAU * 5) + .025 * Math.sin(i / 80 * TAU * 13 + 1) + k.range(-.006, .006)]);
    edge[80][1] = edge[0][1];
    const mallowTex = k.tex(1024, 512, (c, w, h) => {
      c.fillStyle = '#fdf7ea'; c.fillRect(0, 0, w, h);
      const edgePx = edge.map(([u, v]) => [u * w, v * h]);
      const gr = c.createLinearGradient(0, 0, 0, h * .46);
      gr.addColorStop(0, '#6e3510'); gr.addColorStop(.35, '#8a4818'); gr.addColorStop(.7, '#a55e22'); gr.addColorStop(1, '#c07c3a');
      c.fillStyle = gr; c.beginPath(); c.moveTo(0, 0); for (const [x, y] of edgePx) c.lineTo(x, y); c.lineTo(w, 0); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(214,160,100,.8)'; c.lineWidth = 5; c.beginPath(); for (const [x, y] of edgePx) c.lineTo(x, y + 3); c.stroke();
      const dab = (x, y, rx, ry, col) => { for (const dx of [-w, 0, w]) { c.save(); c.translate(x + dx, y); c.scale(1, ry / rx); const g2 = c.createRadialGradient(0, 0, 0, 0, 0, rx); g2.addColorStop(0, col); g2.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g2; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore(); } };
      for (let i = 0; i < 160; i++) dab(k.rand() * w, k.range(0, .36) * h, k.range(10, 28), k.range(5, 12), k.pick(['rgba(90,40,10,.4)', 'rgba(230,170,100,.3)', 'rgba(120,60,20,.35)']));
      for (let i = 0; i < 26; i++) { const x = k.rand() * w, y = k.range(0, .22) * h; c.fillStyle = `rgba(70,32,10,${k.range(.3, .6)})`; c.beginPath(); c.ellipse(x, y, k.range(2, 5), k.range(1.5, 3), 0, 0, TAU); c.fill(); }
      for (let i = 0; i < 16; i++) { const x = k.rand() * w, y = k.range(.47, .58) * h; c.fillStyle = `rgba(214,150,80,${k.range(.35, .6)})`; c.beginPath(); c.ellipse(x, y, k.range(4, 10), k.range(2, 3.5), k.range(-.3, .3), 0, TAU); c.fill(); }
      c.strokeStyle = 'rgba(236,224,200,.9)'; c.lineWidth = 2.5;
      for (let i = 0; i < 50; i++) { const x = k.rand() * w, y = k.range(.55, .85) * h; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 10, y + k.range(-4, 4), x + k.range(18, 40), y + k.range(-3, 3)); c.stroke(); }
      const lo = c.createLinearGradient(0, h * .88, 0, h);
      lo.addColorStop(0, 'rgba(236,190,130,0)'); lo.addColorStop(1, 'rgba(226,172,104,.85)');
      c.fillStyle = lo; c.fillRect(0, h * .88, w, h * .12);
    });
    const finish = k.tex(256, 128, (c, w, h) => {
      c.fillStyle = 'rgb(255,80,0)'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgb(25,200,0)'; c.beginPath(); c.moveTo(0, 0); for (const [u, v] of edge) c.lineTo(u * w, v * h); c.lineTo(w, 0); c.closePath(); c.fill();
    }, { data: true });
    const mx = -.06, mz = -.02;
    const mallow = warp(k.lathe([[0, 0], [1.0, 0], [1.14, .06], [1.26, .18], [1.32, .34], [1.3, .5], [1.2, .63], [1.03, .74], [.78, .83], [.42, .88], [0, .895]], { smooth: true, seg: 96, samples: 72 }), (x, y, z) => {
      const a = Math.atan2(x, z), mid = smooth(.04, .3, y) * smooth(.72, .45, y), dA = Math.atan2(Math.sin(a + .45), Math.cos(a + .45));
      const f = 1 + (.06 * Math.sin(3 * a + .8) + .035 * Math.sin(5 * a + 2.1) + .02 * Math.sin(11 * a)) * mid + .13 * Math.exp(-dA * dA / .25) * mid;
      const X = x * f, Z = z * f, over = Math.max(Math.abs(X + mx), Math.abs(Z + mz)) - (S / 2 - .1);
      return [X, y - .24 * smooth(0, .25, over) * (1 - .7 * y / M), Z];
    });
    k.add(g, mallow, k.mat({ map: mallowTex, bumpMap: mallowTex, bumpScale: 1.5, roughness: 1, roughnessMap: finish, clearcoat: .7, clearcoatMap: finish, clearcoatRoughness: .3 }), { p: [mx, t, mz] });
    // the top cracker, set down a little crooked
    const lid = cracker(); lid.position.y = 0;
    g.add(k.group([lid], { p: [-.16, t + .845 + t / 2, -.5], r: [-.025, .3, -.03] }));
    g.userData.view = { el: 26 };
    g.userData.fullView = { el: 20 };
    return g;
  },

  // A wicker picnic hamper: two flip lids (one propped up on a baguette), an arched handle and a gingham napkin hanging out.
  picnicbasket(k) {
    const T = k.THREE, g = k.group();
    const W = 3.4, D = 2.2, H = 1.75, rc = .32, hw = W / 2, hd = D / 2, tp = .1;
    const weave = (rep, o = {}) => k.tex(256, 256, (c, w, h) => {
      const cols = 4, rows = 8, cw = w / cols, rh = h / rows;
      c.fillStyle = '#4a2e14'; c.fillRect(0, 0, w, h);
      for (let j = 0; j < rows; j++) {
        const y = j * rh, tone = k.range(-12, 12);
        const gr = c.createLinearGradient(0, y, 0, y + rh);
        gr.addColorStop(0, `rgb(${150 + tone},${104 + tone},${52 + tone})`); gr.addColorStop(.4, `rgb(${232 + tone},${188 + tone},${116 + tone})`);
        gr.addColorStop(.62, `rgb(${214 + tone},${164 + tone},${92 + tone})`); gr.addColorStop(1, `rgb(${128 + tone},${84 + tone},${40 + tone})`);
        c.fillStyle = gr; c.fillRect(0, y + 1.5, w, rh - 3);
        for (let i = 0; i < cols; i++) {
          const x = (i + .5) * cw;
          if ((i + j) % 2) {       // the weaver dives behind this stake: shade it, then show the stake
            const sh = c.createLinearGradient(x - cw * .5, 0, x + cw * .5, 0);
            sh.addColorStop(0, 'rgba(40,20,5,0)'); sh.addColorStop(.35, 'rgba(40,20,5,.55)'); sh.addColorStop(.65, 'rgba(40,20,5,.55)'); sh.addColorStop(1, 'rgba(40,20,5,0)');
            c.fillStyle = sh; c.fillRect(x - cw * .5, y, cw, rh);
            const sg = c.createLinearGradient(x - cw * .16, 0, x + cw * .16, 0);
            sg.addColorStop(0, '#8a5a2a'); sg.addColorStop(.45, '#e0b070'); sg.addColorStop(1, '#7a4c22');
            c.fillStyle = sg; c.fillRect(x - cw * .16, y, cw * .32, rh);
          } else {                 // it passes in front: a little highlight on the bump
            c.fillStyle = 'rgba(255,240,200,.18)'; c.beginPath(); c.ellipse(x, y + rh * .4, cw * .36, rh * .16, 0, 0, TAU); c.fill();
          }
        }
      }
    }, { repeat: rep, cache: o.cache ?? 'patio-weave' });
    const wrapTex = rep => k.tex(128, 64, (c, w, h) => {
      c.fillStyle = '#7a4c22'; c.fillRect(0, 0, w, h);
      const n = 4;
      for (let i = -1; i <= n; i++) {
        const x = i * w / n, gr = c.createLinearGradient(x, 0, x + w / n, 0);
        gr.addColorStop(0, '#9a6a34'); gr.addColorStop(.5, '#e8c07c'); gr.addColorStop(1, '#8a5a2a');
        c.fillStyle = gr; c.beginPath(); c.moveTo(x + 2, 0); c.lineTo(x + w / n - 2, 0); c.lineTo(x + w / n + 14, h); c.lineTo(x + 18, h); c.closePath(); c.fill();
      }
    }, { repeat: rep });
    const { at, len } = rrPath(hw, hd, rc);
    const wall = k.mat({ map: weave([Math.round(len / .88), H / .88]), roughness: .78 });
    wall.bumpMap = wall.map; wall.bumpScale = 3;
    const inner = k.mat({ map: weave([Math.round(len / .88), H / .88]), roughness: .85, color: '#b89a78', side: T.BackSide });
    const shell = (off, bulge) => surface(k, (u, v) => {
      const [x, z, nx, nz] = at(u), inset = (1 - v) * tp + off - bulge * Math.sin(Math.PI * v);
      return [x - nx * inset, v * H, z - nz * inset];
    }, 160, 12);
    k.add(g, shell(0, .035), wall);
    k.add(g, shell(.07, .02), inner, { shadow: false });
    const floorShape = new T.Shape(); for (let i = 0; i <= 64; i++) { const [x, z] = at(i / 64); i ? floorShape.lineTo(x * .95, -z * .95) : floorShape.moveTo(x * .95, -z * .95); }
    k.add(g, new T.ShapeGeometry(floorShape, 8), k.matte('#5a3a1c', .9), { p: [0, .02, 0], r: [-Math.PI / 2, 0, 0] });
    // rolled rims, top and bottom, wrapped in cane
    const loop = (off, y, n = 96) => { const pts = []; for (let i = 0; i < n; i++) { const [x, z, nx, nz] = at(i / n); pts.push([x + nx * off, y, z + nz * off]); } return pts; };
    const cane = k.mat({ map: wrapTex([60, 1]), roughness: .6, clearcoat: .2 });
    k.add(g, k.tube(loop(-.01, H, 96), .085, { closed: true, seg: 240, rs: 12 }), cane);
    k.add(g, k.tube(loop(-tp - .01, .06, 96), .06, { closed: true, seg: 240, rs: 10 }), cane);
    // the two lids: the back one shut, the front one propped open
    const lidShape = () => {
      const s = new T.Shape(), a = hw + .05, b = hd + .05, r = rc + .05;
      s.moveTo(-a, 0); s.lineTo(a, 0); s.lineTo(a, -b + r); s.quadraticCurveTo(a, -b, a - r, -b); s.lineTo(-a + r, -b); s.quadraticCurveTo(-a, -b, -a, -b + r); s.closePath();
      return s;
    };
    const lidTop = k.mat({ map: weave([1 / .88, 1 / .88]), roughness: .78 }); lidTop.bumpMap = lidTop.map; lidTop.bumpScale = 3;
    const lidEdge = k.mat({ color: '#8a5a2a', roughness: .8 });
    const lidGeo = k.extrude(lidShape(), .06, { bevel: .02 });
    const rimPts = [];
    const uSide = ((hw - rc) + Math.PI / 2 * rc + (hd - rc)) / len;    // where the outline crosses z = 0 on the right
    for (let i = 0; i <= 48; i++) { const [x, z, nx, nz] = at(-uSide + 2 * uSide * i / 48); rimPts.push([x + nx * .04, 0, z + nz * .04]); }
    const lid = (open) => {
      const p = k.group([], { p: [0, H + .08, 0], r: [-open, 0, 0] });
      k.add(p, lidGeo, [lidTop, lidEdge], { p: [0, .02, 0], r: [-Math.PI / 2, 0, 0] });
      k.add(p, k.tube(rimPts, .06, { seg: 120, rs: 10 }), cane, { p: [0, .04, 0] });
      return p;
    };
    const phi = k.deg(25);
    g.add(lid(phi));
    g.add(k.group([lid(0)], { r: [0, Math.PI, 0] }));
    k.add(g, k.cyl(.07, .07, W - .2, { seg: 16 }), cane, { p: [0, H + .1, 0], r: [0, 0, Math.PI / 2] });                  // hinge rod
    // the arched handle, with leather straps and brass rivets where it meets the basket
    const hc = [[-hw - .06, H - .4, 0], [-hw - .1, H + .1, 0], [-hw + .1, H + .8, 0], [-hw * .5, H + 1.24, 0], [0, H + 1.34, 0], [hw * .5, H + 1.24, 0], [hw - .1, H + .8, 0], [hw + .1, H + .1, 0], [hw + .06, H - .4, 0]];
    k.add(g, k.tube(hc, .075, { seg: 160, rs: 12, caps: true }), k.mat({ map: wrapTex([30, 1]), roughness: .6, clearcoat: .2 }));
    const leather = k.mat({ color: '#6b3a1c', roughness: .55, clearcoat: .3 });
    const gripC = curveOf(k, hc.slice(3, 6));
    k.add(g, varTube(k, gripC, capped(.1, .04), { seg: 40, rs: 14 }), leather);
    const stitch = []; for (let i = 1; i < 12; i++) { const P = gripC.getPointAt(i / 12); stitch.push({ p: [P.x, P.y + .098, P.z] }); }
    g.add(k.instances(k.box(.05, .012, .02), k.matte('#f1e3c4', .7), stitch));
    for (const s of [-1, 1]) {
      k.add(g, k.box(.07, .5, .26, .03), leather, { p: [s * (hw + .02), H - .12, 0] });
      k.add(g, k.sphere(.035, { w: 12, h: 8 }), k.brass(), { p: [s * (hw + .06), H - .28, 0] });
    }
    // gingham napkin, hanging out over the front edge in a point
    const gingham = k.tex(128, 128, (c, w, h) => {
      c.fillStyle = '#fbf7ee'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(214,38,40,.55)';
      for (let i = 0; i < w; i += 32) { c.fillRect(i, 0, 16, h); c.fillRect(0, i, w, 16); }
    }, { repeat: [10, 5] });
    const cloth = k.mat({ map: gingham, roughness: .95, sheen: .6, sheenColor: k.color('#ffffff'), side: T.DoubleSide });
    const drape = surface(k, (u, v) => {
      const x = -1.35 + u * 2.3, point = Math.pow(1 - Math.abs(2 * u - 1), 1.4), hang = .18 + .62 * point;
      const fold = .045 * Math.sin(u * TAU * 3.2 + 1) * smooth(.3, 1, v);
      const c = curveOf(k, [[0, H - .15, hd - .6], [0, H + .1, hd - .2], [0, H + .16, hd + .02], [0, H + .04, hd + .14], [0, H - .3, hd + .16], [0, H - hang, hd + .15]]);
      const P = c.getPointAt(v);
      return [x, P.y, P.z + fold];
    }, 48, 30);
    k.add(g, drape, cloth);
    // a baguette poking out from under the lid
    const bagTex = k.tex(256, 512, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, 0);          // u = 0 (and 1) is the top of the loaf
      gr.addColorStop(0, '#b8661f'); gr.addColorStop(.2, '#cf8a3a'); gr.addColorStop(.5, '#eac27e'); gr.addColorStop(.8, '#cf8a3a'); gr.addColorStop(1, '#b8661f');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 600; i++) { c.fillStyle = k.rand() < .6 ? `rgba(255,246,225,${k.range(.1, .35)})` : `rgba(120,60,16,${k.range(.1, .3)})`; c.fillRect(k.rand() * w, k.rand() * h, k.range(1, 3), k.range(1, 3)); }
      for (let i = 0; i < 6; i++) for (const x of [0, w]) {
        c.save(); c.translate(x, (.1 + i * .16) * h); c.rotate(.6);
        c.fillStyle = 'rgba(110,50,12,.55)'; c.beginPath(); c.ellipse(3, 3, 30, 58, 0, 0, TAU); c.fill();
        c.fillStyle = '#f7e2b0'; c.beginPath(); c.ellipse(0, 0, 24, 52, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(214,160,90,.5)'; c.beginPath(); c.ellipse(-6, 0, 10, 40, 0, 0, TAU); c.fill();
        c.restore();
      }
    });
    const bagProf = [], BL = 3.0;
    for (let i = 0; i <= 40; i++) { const q = Math.abs(2 * i / 40 - 1); bagProf.push([.2 * Math.pow(Math.max(0, 1 - q ** 5), .42), i / 40 * BL]); }
    const bagGeo = k.lathe(bagProf, { seg: 32 }); bagGeo.translate(0, -BL / 2, 0); bagGeo.scale(1, 1, .84);
    const Cs = new T.Vector3(hw + .02, H + .26, .86), bd = new T.Vector3(.8, .5, .2).normalize();
    const bag = k.mesh(bagGeo, k.mat({ map: bagTex, roughness: .6, clearcoat: .15 }), { p: Cs.clone().addScaledVector(bd, BL / 2 - 1.35).toArray() });
    g.add(orient(k, bag, bd.toArray()));
    // and a shiny red apple peeking out of the gap
    const apple = k.group([], { p: [-.95, H - .02, .66], r: [.2, 0, -.15] }); g.add(apple);
    k.add(apple, warp(k.sphere(.3, { w: 40, h: 28 }), (x, y, z) => { const r = Math.hypot(x, z) / .3; return [x * (1 + .08 * (y / .3)), y * .92 - .09 * Math.exp(-r * r * 6) * Math.sign(y) , z * (1 + .08 * (y / .3))]; }), k.gloss('#d9262c', { rough: .25 }));
    k.add(apple, k.cyl(.018, .025, .2, { seg: 8 }), k.mat({ color: '#5a3a1e', roughness: .8 }), { p: [.02, .3, 0], r: [0, 0, -.25] });
    k.add(apple, k.sphere(.1, { w: 16, h: 10 }), k.gloss('#3f9a35'), { p: [.13, .33, 0], r: [0, 0, -.9], s: [1, .3, .5] });
    g.userData.view = { el: 20 };
    return g;
  },

  // The classic folding aluminium lawn chair: tube frame, green and white webbing, white plastic armrests.
  lawnchair(k) {
    const T = k.THREE, g = k.group();
    const alu = k.metal('#dfe3e8', .24), tr = .052;
    // back frame and rear legs: one loop of tubing
    k.add(g, bentTube(k, [[-1, .045, -1.12, .12], [-1, 1.18, -.86, .35], [-1, 3.05, -1.42, .2], [1, 3.05, -1.42, .2], [1, 1.18, -.86, .35], [1, .045, -1.12, .12]], tr, { closed: true, seg: 320 }), alu);
    // front legs and arms: one U of tubing
    k.add(g, bentTube(k, [[-1.07, 2.0, -1.1], [-1.07, 2.0, .72, .2], [-1.07, .045, .98, .12], [1.07, .045, .98, .12], [1.07, 2.0, .72, .2], [1.07, 2.0, -1.1]], tr, { seg: 320 }), alu);
    // the seat frame
    const yF = 1.28, yB = 1.16, zF = .84, zB = -.84, xs = .93;
    k.add(g, bentTube(k, [[-xs, yF, zF], [xs, yF, zF], [xs, yB, zB], [-xs, yB, zB]], tr, { closed: true, bend: .1, seg: 240 }), alu);
    const yL = 1.36, zL = -.86 - (yL - 1.18) / 1.87 * .56;              // a low crossbar on the back frame for the upright straps
    g.add(rod(k, [-1, yL, zL], [1, yL, zL], tr, alu));
    // webbing: woven green and white straps, painted on two gently sagging panels
    const G = '#1f8a47', Wt = '#f6f4ee';
    const webTex = (nu, nv, colU, colV) => k.tex(512, 512, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      const cw = w / nu, ch = h / nv, gu = cw * .1, gv = ch * .1;
      const strapV = (i, y0, y1) => { const x = i * cw + gu / 2, gr = c.createLinearGradient(x, 0, x + cw - gu, 0); gr.addColorStop(0, shade(colV(i), -.18)); gr.addColorStop(.5, colV(i)); gr.addColorStop(1, shade(colV(i), -.18)); c.fillStyle = gr; c.fillRect(x, y0, cw - gu, y1 - y0); };
      const strapH = (j, x0, x1) => { const y = j * ch + gv / 2, gr = c.createLinearGradient(0, y, 0, y + ch - gv); gr.addColorStop(0, shade(colU(j), -.18)); gr.addColorStop(.5, colU(j)); gr.addColorStop(1, shade(colU(j), -.18)); c.fillStyle = gr; c.fillRect(x0, y, x1 - x0, ch - gv); };
      for (let i = 0; i < nu; i++) strapV(i, 0, h);
      for (let j = 0; j < nv; j++) strapH(j, 0, w);
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) if ((i + j) % 2) {
        strapV(i, j * ch, (j + 1) * ch);
        const x = i * cw + gu / 2;
        for (const [y, dir] of [[j * ch, 1], [(j + 1) * ch, -1]]) { const sh = c.createLinearGradient(0, y, 0, y + dir * ch * .35); sh.addColorStop(0, 'rgba(0,0,0,.28)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sh; c.fillRect(x, Math.min(y, y + dir * ch * .35), cw - gu, ch * .35); }
      } else {
        const y = j * ch + gv / 2;
        for (const [x, dir] of [[i * cw, 1], [(i + 1) * cw, -1]]) { const sh = c.createLinearGradient(x, 0, x + dir * cw * .35, 0); sh.addColorStop(0, 'rgba(0,0,0,.25)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sh; c.fillRect(Math.min(x, x + dir * cw * .35), y, cw * .35, ch - gv); }
      }
      c.globalAlpha = .08; c.fillStyle = '#000';
      for (let i = 0; i < w; i += 3) c.fillRect(i, 0, 1, h);
      c.globalAlpha = 1;
    });
    function shade(hex, f) { const col = k.color(hex); col.lerp(new T.Color(f < 0 ? '#000000' : '#ffffff'), Math.abs(f)); return '#' + col.getHexString(); }
    const webMat = map => k.mat({ map, alphaTest: .5, side: T.DoubleSide, roughness: .7, sheen: .4, sheenColor: k.color('#ffffff') });
    const nSeat = 6, nBack = 6, nUp = 5;
    // seat: straps across (rows, front to back) alternate green and white; straps front to back are green
    const seatMap = webTex(nSeat, nSeat, j => (j % 2 ? Wt : G), () => G);
    k.add(g, surface(k, (u, v) => { const x = -xs + u * 2 * xs, z = zB + v * (zF - zB), y = yB + (yF - yB) * v - .07 * (1 - (x / xs) ** 2) * Math.sin(Math.PI * v); return [x, y + .01, z]; }, 24, 24), webMat(seatMap));
    // back: straps across alternate white and green, the upright straps are green
    const backMap = webTex(nUp, nBack, j => (j % 2 ? G : Wt), () => G);
    const bz = y => -.86 - (y - 1.18) / 1.87 * .56;
    const yT = 3.05;
    k.add(g, surface(k, (u, v) => { const x = -1 + u * 2, y = yL + v * (yT - yL); return [x, y, bz(y) - .06 * (1 - x * x) * Math.sin(Math.PI * v) - .012]; }, 24, 24), webMat(backMap));
    // the straps wrapping round the tubes
    const bands = { [G]: [], [Wt]: [] }, bw = .2;
    const band = (col, p, axis) => { const o = orient(k, new T.Object3D(), axis); bands[col].push({ p, r: [o.rotation.x, o.rotation.y, o.rotation.z] }); };
    const railDir = [0, yF - yB, zF - zB], upDir = [0, 1.87, -.56];
    for (let j = 0; j < nSeat; j++) { const v = (j + .5) / nSeat, z = zB + v * (zF - zB), y = yB + (yF - yB) * v; for (const s of [-1, 1]) band(j % 2 ? Wt : G, [s * xs, y, z], railDir); }
    for (let i = 0; i < nSeat; i++) { const x = -xs + (i + .5) / nSeat * 2 * xs; band(G, [x, yF, zF], [1, 0, 0]); band(G, [x, yB, zB], [1, 0, 0]); }
    for (let j = 0; j < nBack; j++) { const y = yL + (j + .5) / nBack * (yT - yL); for (const s of [-1, 1]) band(j % 2 ? G : Wt, [s * 1, y, bz(y)], upDir); }
    for (let i = 0; i < nUp; i++) { const x = -1 + (i + .5) / nUp * 2; band(G, [x, yT, -1.42], [1, 0, 0]); band(G, [x, yL, zL], [1, 0, 0]); }
    const bandGeo = k.cyl(tr + .014, tr + .014, bw, { seg: 16, open: true });
    for (const col of [G, Wt]) g.add(k.instances(bandGeo, k.mat({ color: col, roughness: .7, side: T.DoubleSide }), bands[col]));
    // armrests and rivets
    const arm = k.plastic('#f4f1ea', { rough: .3 });
    for (const s of [-1, 1]) k.add(g, k.box(.26, .07, 1.92, .03), arm, { p: [s * 1.07, 2.0 + tr + .03, -.17] });
    const rivets = [];
    for (const s of [-1, 1]) {
      rivets.push({ p: [s * 1.12, 2.0, -1.1], r: [0, 0, s * Math.PI / 2], s: [1, .5, 1] });
      rivets.push({ p: [s * 1.12, yF, .81], r: [0, 0, s * Math.PI / 2], s: [1, .5, 1] });
      rivets.push({ p: [s * 1.05, yB + .02, zB - .02], r: [0, 0, s * Math.PI / 2], s: [1, .5, 1] });
    }
    g.add(k.instances(k.sphere(.035, { w: 12, h: 8 }), k.chrome(), rivets));
    return g;
  },

  // A kid's wooden lemonade stand: hand-painted sign, striped awning on two posts, a pitcher, cups and a cash box.
  lemonadestand(k) {
    const T = k.THREE, g = k.group();
    const W = 4, D = 1.3, Hc = 3.0, hw = W / 2, hd = D / 2;
    const planks = (n, seed) => k.tex(512, 512, (c, w, h) => {
      const tones = ['#dcae70', '#cf9f60', '#e4bb7e', '#c99558', '#d8a868'];
      for (let i = 0; i < n; i++) {
        const x0 = i * w / n, bw = w / n;
        c.fillStyle = tones[(i * 3 + seed) % tones.length]; c.fillRect(x0, 0, bw + 1, h);
        c.strokeStyle = 'rgba(110,64,26,.22)';
        for (let j = 0; j < 7; j++) { c.lineWidth = k.range(.8, 2.2); c.beginPath(); const x = x0 + k.range(4, bw - 4); for (let y = 0; y <= h; y += 16) { const xx = x + Math.sin(y * .02 + j * 1.7 + i) * 3; y ? c.lineTo(xx, y) : c.moveTo(xx, y); } c.stroke(); }
        c.fillStyle = 'rgba(70,38,14,.85)'; c.fillRect(x0, 0, 3, h);
        c.fillStyle = '#5d5a56'; for (const y of [.05, .95]) { c.beginPath(); c.arc(x0 + bw / 2, y * h, 4, 0, TAU); c.fill(); }
      }
    });
    const woodMat = map => k.mat({ map, roughness: .7 });
    const front = woodMat(planks(8, 0)), side = woodMat(planks(3, 2)), edgeW = k.mat({ color: '#c99558', roughness: .7 });
    const paint = k.plastic('#f7f3ea', { rough: .55, coat: .15 });
    // the counter box
    k.add(g, k.box(W, Hc - .1, .1), [edgeW, edgeW, edgeW, edgeW, front, front], { p: [0, (Hc - .1) / 2, hd - .05] });
    k.add(g, k.box(W, Hc - .1, .1), [edgeW, edgeW, edgeW, edgeW, front, front], { p: [0, (Hc - .1) / 2, -hd + .05] });
    for (const s of [-1, 1]) k.add(g, k.box(.1, Hc - .1, D - .2), [side, side, edgeW, edgeW, side, side], { p: [s * (hw - .05), (Hc - .1) / 2, 0] });
    const topWood = k.wood('pine', { rough: .55, varnish: .3 }); topWood.map.rotation = Math.PI / 2; topWood.map.center.set(.5, .5);
    k.add(g, k.box(W + .3, .14, D + .3, .03), topWood, { p: [0, Hc - .03, .05] });
    for (const s of [-1, 1]) k.add(g, k.box(.12, .08, D - .1, .02), paint, { p: [s * (hw - .12), .04, 0] });
    // the hand-painted sign
    const sign = k.painted(1024, 440, (c, w, h) => {
      c.fillStyle = '#fff3ae'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,255,255,${k.range(.05, .22)})`; c.fillRect(0, k.rand() * h, w, k.range(2, 7)); }
      c.strokeStyle = '#34a853'; c.lineWidth = 14; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(24, 26); c.lineTo(w - 26, 22); c.lineTo(w - 22, h - 25); c.lineTo(26, h - 22); c.closePath(); c.stroke();
      handLetters(k, c, 'LEMONADE', 40, w - 40, 150, { size: 176, color: '#2458d6', stroke: '#123a9a', strokeWidth: 10, tilt: .1, bounce: 10, gap: 2 });
      // a lemon on the left, ICE COLD in the middle, 5¢ in a sunny circle on the right
      c.save(); c.translate(150, 330); c.rotate(-.3);
      c.fillStyle = '#ffd21a'; c.strokeStyle = '#c99400'; c.lineWidth = 6; c.beginPath(); c.ellipse(0, 0, 78, 54, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#ffd21a'; c.beginPath(); c.ellipse(-80, 0, 14, 10, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(80, 0, 14, 10, 0, 0, TAU); c.fill();
      c.fillStyle = '#3aa655'; c.beginPath(); c.ellipse(40, -58, 30, 13, -.5, 0, TAU); c.fill();
      c.fillStyle = '#fff6c0'; c.beginPath(); c.ellipse(-24, -18, 20, 9, -.3, 0, TAU); c.fill();
      c.restore();
      handLetters(k, c, 'ICE COLD', 250, 700, 335, { size: 74, color: '#e8412c', tilt: .08, bounce: 5 });
      c.fillStyle = '#e8412c'; c.beginPath(); c.arc(860, 320, 92, 0, TAU); c.fill();
      c.strokeStyle = '#ffd21a'; c.lineWidth = 10; c.stroke();
      k.text(c, '5¢', 860, 326, { size: 128, weight: 700, color: '#ffffff' });
    }, { rough: .6 });
    const signEdge = k.mat({ color: '#e9dca4', roughness: .7 });
    k.add(g, k.box(3.7, 1.6, .06, .02), [signEdge, signEdge, signEdge, signEdge, sign, signEdge], { p: [0, 1.95, hd + .03] });
    // posts and the awning
    const pz = -hd + .12;
    for (const s of [-1, 1]) k.add(g, k.box(.16, 5.3, .16, .03), paint, { p: [s * 1.9, 2.65, pz] });
    const yb = 5.25, yf = 4.82, zf = hd + .32;
    for (const s of [-1, 1]) {
      g.add(rod(k, [s * 1.9, yb, pz], [s * 1.9, yf, zf], .05, paint));
      g.add(rod(k, [s * 1.9, 4.15, pz], [s * 1.9, (yb + yf) / 2 + .03, (pz + zf) / 2], .035, paint));
    }
    g.add(rod(k, [-1.9, yb, pz], [1.9, yb, pz], .05, paint));
    g.add(rod(k, [-1.9, yf, zf], [1.9, yf, zf], .05, paint));
    const AW = 4.4, nS = 12, sw = AW / nS;
    const stripeTex = () => k.tex(128, 8, (c, w, h) => { c.fillStyle = '#e8403a'; c.fillRect(0, 0, w / 2, h); c.fillStyle = '#fbf7ef'; c.fillRect(w / 2, 0, w / 2, h); }, { repeat: [1, 1] });
    const canvasTex = stripeTex(); canvasTex.repeat.set(nS / 2, 1);
    const awning = k.mat({ map: canvasTex, roughness: .8, sheen: .3, sheenColor: k.color('#ffffff'), side: T.DoubleSide });
    k.add(g, surface(k, (u, v) => {
      const x = -AW / 2 + u * AW, ax = Math.abs(x), y = yb + .07 + (yf - yb) * v - .06 * (1 - Math.min(1, (x / 1.9) ** 2)) * Math.sin(Math.PI * v) - (ax > 1.9 ? .5 * (ax - 1.9) ** 2 : 0);
      return [x, y, pz - .06 + (zf - pz + .06) * v];
    }, 48, 12), awning);
    const val = new T.Shape(), vh = .26, sr = sw / 2;
    val.moveTo(-AW / 2, 0); val.lineTo(AW / 2, 0); val.lineTo(AW / 2, -vh);
    for (let i = nS - 1; i >= 0; i--) val.absarc(-AW / 2 + (i + .5) * sw, -vh, sr, 0, Math.PI, true);
    val.closePath();
    const valTex = stripeTex(); valTex.repeat.set(1 / (2 * sw), 1); valTex.offset.set(AW / 2 / (2 * sw), 0);
    const valMat = k.mat({ map: valTex, roughness: .8, sheen: .3, sheenColor: k.color('#ffffff') });
    k.add(g, k.extrude(val, .02, { bevel: .006, bevelSeg: 1, curve: 12 }), [valMat, valMat], { p: [0, yf + .06, zf + .02] });
    // on the counter: a glass pitcher of lemonade, paper cups, lemons and the cash box
    const ct = Hc + .04;
    const pit = k.group([], { p: [1.12, ct, .12], r: [0, .38, 0], s: 1.2 }); g.add(pit);
    const pr = [[0, 0], [.3, 0], [.34, .05], [.37, .35], [.36, .7], [.31, .92], [.33, 1.0], [.345, 1.04]];
    const pitGeo = warp(k.lathe([...pr, [.325, 1.04], [.31, 1.0], [.29, .92], [.34, .7], [.35, .35], [.32, .07], [0, .07]], { seg: 48 }), (x, y, z) => {
      if (y < .8) return [x, y, z];
      const a = Math.atan2(x, z), wgt = Math.exp(-((Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)) / .45) ** 2)) * ((y - .8) / .24) ** 2;
      return [x * (1 + .35 * wgt), y + .04 * wgt, z * (1 + .35 * wgt)];
    });
    k.add(pit, pitGeo, k.glass('#f4fbff', { opacity: .2, env: 2.4 }), { shadow: false }).renderOrder = 6;
    k.add(pit, k.torus(.335, .014, { rs: 6, ts: 48 }), k.glass('#ffffff', { opacity: .6, env: 3 }), { p: [0, 1.04, 0], r: [Math.PI / 2, 0, 0], shadow: false }).renderOrder = 6;
    const pf = .76;
    const pl = k.lathe([[0, .075], [.315, .075], [.345, .35], [.34, pf], [0, pf]], { seg: 40 });
    k.add(pit, pl, k.mat({ color: '#fad232', roughness: .3, transparent: true, opacity: .9, emissive: '#f5b400', emissiveIntensity: .32, side: T.BackSide, depthWrite: false })).renderOrder = 1;
    k.add(pit, pl, k.mat({ color: '#fff3a8', roughness: .06, clearcoat: 1, transparent: true, opacity: .24, emissive: '#ffd84a', emissiveIntensity: .1, depthWrite: false }), { shadow: false }).renderOrder = 4;
    const lemonFace = k.tex(128, 128, (c, w, h) => {
      const m = w / 2;
      c.fillStyle = '#f2c511'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fbf4d6'; c.beginPath(); c.arc(m, m, m * .88, 0, TAU); c.fill();
      for (let i = 0; i < 8; i++) { const a0 = i / 8 * TAU + .09, a1 = (i + 1) / 8 * TAU - .09; c.fillStyle = '#fbe36a'; c.beginPath(); c.moveTo(m, m); c.arc(m, m, m * .8, a0, a1); c.closePath(); c.fill(); }
    });
    const slice = k.mat({ map: lemonFace, roughness: .3, clearcoat: .6 }), rind = k.gloss('#f2c511');
    for (const [x, y, z, rx, rz] of [[.06, pf - .01, .1, .15, .25], [-.1, .48, .12, 1.3, .2], [.12, .3, .08, 1.0, -.5]]) k.add(pit, k.cyl(.2, .2, .04, { seg: 24 }), [rind, slice, slice], { p: [x, y, z], r: [rx, 0, rz] });
    k.add(pit, k.tube([[.33, .9, 0], [.56, .93, 0], [.64, .7, 0], [.58, .36, 0], [.36, .2, 0]], .06, { seg: 40, rs: 12 }), k.glass('#f4fbff', { opacity: .62, env: 3 }), { shadow: false }).renderOrder = 6;
    // paper cups: a stack, and one poured
    const cupPaint = k.painted(256, 64, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8403a'; c.fillRect(0, 5, w, 11); for (let i = 0; i < 8; i++) { c.fillStyle = '#ffd21a'; c.beginPath(); c.arc(16 + i * 32, 40, 8, 0, TAU); c.fill(); } }, { rough: .6, side: T.DoubleSide });
    const cupGeo = k.cyl(.2, .15, .46, { seg: 28, open: true });
    const cup = (x, z, n, full) => {
      for (let i = 0; i < n; i++) k.add(g, cupGeo, cupPaint, { p: [x, ct + .23 + i * .08, z] });
      k.add(g, k.disc(.15, 24), k.paper('#ffffff'), { p: [x, ct + .005, z], r: [-Math.PI / 2, 0, 0] });
      if (full) k.add(g, k.disc(.185, 24), k.mat({ color: '#fbe36a', roughness: .1, clearcoat: 1, emissive: '#f5c518', emissiveIntensity: .25 }), { p: [x, ct + .4, z], r: [-Math.PI / 2, 0, 0] });
    };
    cup(-.62, .04, 3, false);
    cup(-.2, .44, 1, true);
    // a couple of lemons
    const peel = k.mat({ color: '#f7cf12', roughness: .45, clearcoat: .6, clearcoatRoughness: .3 });
    for (const [x, z, ry] of [[.26, .42, .4], [.42, .06, 2.1]]) {
      const l = k.group([], { p: [x, ct + .2, z], r: [0, ry, 0] }); g.add(l);
      k.add(l, k.sphere(.2, { w: 24, h: 16 }), peel, { s: [1.35, 1, 1] });
      for (const s of [-1, 1]) k.add(l, k.sphere(.06, { w: 10, h: 8 }), peel, { p: [s * .27, 0, 0], s: [1.2, .8, .8] });
    }
    // the cash box, lid up, coins inside
    const cb = k.group([], { p: [-1.42, ct, -.02], r: [0, .3, 0], s: 1.15 }); g.add(cb);
    const tin = k.gloss('#2a8f6e');
    k.add(cb, k.box(.66, .26, .44, .04), tin, { p: [0, .13, 0] });
    k.add(cb, k.box(.58, .02, .36), k.matte('#1d4d3c', .8), { p: [0, .255, 0] });
    const lidP = k.group([], { p: [0, .26, -.22], r: [-1.9, 0, 0] }); cb.add(lidP);
    k.add(lidP, k.box(.68, .05, .45, .04), tin, { p: [0, .02, .22] });
    k.add(cb, k.box(.14, .05, .03, .015), k.chrome(), { p: [0, .2, .225] });
    const coins = [];
    for (let i = 0; i < 9; i++) coins.push({ p: [k.range(-.22, .22), .27 + k.range(0, .02), k.range(-.12, .12)], r: [k.range(-.3, .3), 0, k.range(-.3, .3)], color: k.pick(['#e8c25a', '#d7dbe0', '#c98a5a']) });
    cb.add(k.instances(k.cyl(.06, .06, .015, { seg: 20 }), k.metal('#ffffff', .25), coins));
    g.userData.view = { az: 22, el: 14 };
    return g;
  },

  // A stone fire pit: a teepee of logs burning bright, embers rising, and a marshmallow on a stick leaning in.
  firepit(k) {
    const T = k.THREE, g = k.group();
    const Rr = 1.52;
    // stones: a few lumpy, faceted shapes, reused round the ring
    const rock = () => {
      const waves = Array.from({ length: 7 }, () => [new T.Vector3(k.range(-1, 1), k.range(-1, 1), k.range(-1, 1)).normalize(), k.range(1.5, 4), k.range(0, TAU), k.range(.03, .08)]);
      const cuts = Array.from({ length: 5 }, () => [new T.Vector3(k.range(-1, 1), k.range(-.4, 1), k.range(-1, 1)).normalize(), k.range(.66, .86)]);
      return warp(new T.IcosahedronGeometry(1, 3), (x, y, z) => {
        let f = 1;
        for (const [d, fr, ph, a] of waves) f += a * Math.sin((d.x * x + d.y * y + d.z * z) * fr + ph);
        const P = new T.Vector3(x * f, y * f, z * f);
        for (const [n, c] of cuts) { const d = P.dot(n); if (d > c) P.addScaledVector(n, -(d - c) * .85); }
        return [P.x, Math.max(P.y, -.5), P.z];
      });
    };
    const granite = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#b4aea4'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(${k.pick(['90,84,78', '160,150,136', '70,66,64'])},${k.range(.1, .3)})`; c.beginPath(); c.ellipse(k.rand() * w, k.rand() * h, k.range(10, 40), k.range(6, 20), k.rand() * 3, 0, TAU); c.fill(); }
      for (let i = 0; i < 1800; i++) { const v = k.rand(); c.fillStyle = v < .5 ? `rgba(40,36,34,${k.range(.2, .6)})` : v < .8 ? `rgba(255,255,255,${k.range(.2, .5)})` : `rgba(150,110,90,${k.range(.2, .5)})`; const sz = k.range(1, 3.5); c.fillRect(k.rand() * w, k.rand() * h, sz, sz); }
    }, { repeat: 2 });
    const stoneMat = k.mat({ color: '#ffffff', map: granite, bumpMap: granite, bumpScale: 2.5, roughness: .86 });
    const rocks = [rock(), rock(), rock(), rock()], lists = [[], [], [], []], N = 14;
    for (let i = 0; i < N; i++) {
      const a = (i + k.range(-.12, .12)) / N * TAU, big = k.range(.9, 1.15), sw = .36 * big, sh = k.range(.26, .36), sd = k.range(.28, .34);
      lists[i % 4].push({ p: [Math.sin(a) * Rr, sh * .5, Math.cos(a) * Rr], r: [k.range(-.15, .15), a + k.range(-.3, .3), k.range(-.12, .12)], s: [sw, sh, sd],
        color: k.pick(['#8c877f', '#7a756f', '#958a7c', '#6d6b69', '#8a7f72', '#a39d93', '#7f7a76']) });
    }
    rocks.forEach((geo, i) => g.add(k.instances(geo, stoneMat, lists[i])));
    // the bed of ash and glowing coals
    const ash = k.tex(512, 512, (c, w, h) => {
      c.fillStyle = '#1e1917'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 700; i++) { const v = k.range(40, 120) | 0; c.fillStyle = `rgba(${v},${v - 6},${v - 10},${k.range(.2, .6)})`; c.beginPath(); c.arc(k.rand() * w, k.rand() * h, k.range(2, 9), 0, TAU); c.fill(); }
    });
    const embers = k.tex(512, 512, (c, w, h) => {
      c.fillStyle = '#000000'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 300; i++) {
        const r = Math.sqrt(k.rand()) * .44 * w, a = k.rand() * TAU, x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r, sz = k.range(4, 15) * (1.25 - r / (.5 * w));
        const gr = c.createRadialGradient(x, y, 0, x, y, sz);
        gr.addColorStop(0, 'rgba(255,170,40,1)'); gr.addColorStop(.45, 'rgba(240,70,10,.85)'); gr.addColorStop(1, 'rgba(120,16,0,0)');
        c.fillStyle = gr; c.fillRect(x - sz, y - sz, 2 * sz, 2 * sz);
      }
    });
    k.add(g, k.lathe([[0, .16], [.6, .15], [1.1, .1], [1.36, .05], [1.38, 0]], { smooth: true, seg: 48 }), k.matte('#2a2422', .95));
    k.add(g, k.disc(1.22, 48), k.mat({ map: ash, roughness: .95, emissive: '#ffffff', emissiveMap: embers, emissiveIntensity: 1.35 }), { p: [0, .165, 0], r: [-Math.PI / 2, 0, 0] });
    const coals = [];
    for (let i = 0; i < 16; i++) { const a = k.rand() * TAU, r = k.range(.15, .9); coals.push({ p: [Math.sin(a) * r, .19, Math.cos(a) * r], r: [k.range(0, 3), k.range(0, 3), k.range(0, 3)], s: k.range(.06, .12) }); }
    g.add(k.instances(new T.DodecahedronGeometry(1, 0), k.mat({ color: '#2a1d18', roughness: .8, emissive: '#ff5212', emissiveIntensity: .7 }), coals));
    // four logs in a teepee, bark outside, charred and glowing where the fire has them
    const barkTex = k.tex(256, 512, (c, w, h) => {
      c.fillStyle = '#6a4a34'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(170,130,95,${k.range(.15, .35)})`; c.fillRect(k.rand() * w, k.rand() * h, k.range(3, 10), k.range(20, 60)); }
      for (let i = 0; i < 90; i++) {
        const x = k.rand() * w, y0 = k.rand() * h, l = k.range(40, 180);
        c.strokeStyle = `rgba(30,18,10,${k.range(.4, .8)})`; c.lineWidth = k.range(1.5, 4);
        c.beginPath(); c.moveTo(x, y0); c.bezierCurveTo(x + k.range(-6, 6), y0 + l / 3, x + k.range(-6, 6), y0 + 2 * l / 3, x + k.range(-4, 4), y0 + l); c.stroke();
      }
      const gr = c.createLinearGradient(0, 0, 0, h * .6);
      gr.addColorStop(0, 'rgba(18,12,10,1)'); gr.addColorStop(.5, 'rgba(22,15,12,.85)'); gr.addColorStop(1, 'rgba(22,15,12,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h * .6);
    });
    const barkGlow = k.tex(256, 512, (c, w, h) => {
      c.fillStyle = '#000000'; c.fillRect(0, 0, w, h);
      c.lineCap = 'round';
      for (let i = 0; i < 70; i++) {
        const x = k.rand() * w, y = k.range(0, .45) * h, l = k.range(10, 40);
        c.strokeStyle = `rgba(255,${k.range(80, 150) | 0},20,${k.range(.5, 1)})`; c.lineWidth = k.range(1.5, 3.5);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + k.range(-8, 8), y + l); c.stroke();
      }
    });
    const endTex = k.tex(128, 128, (c, w, h) => {
      const m = w / 2;
      c.fillStyle = '#dcb88c'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(140,90,50,.55)'; c.lineWidth = 2;
      for (let r = 6; r < m * .85; r += k.range(5, 9)) { c.beginPath(); c.arc(m + k.range(-2, 2), m + k.range(-2, 2), r, 0, TAU); c.stroke(); }
      c.strokeStyle = '#3a2618'; c.lineWidth = 12; c.beginPath(); c.arc(m, m, m - 6, 0, TAU); c.stroke();
    });
    const bark = k.mat({ map: barkTex, bumpMap: barkTex, bumpScale: 3, roughness: .92, emissive: '#ffffff', emissiveMap: barkGlow, emissiveIntensity: 1.1 });
    const cutEnd = k.mat({ map: endTex, roughness: .8 }), charEnd = k.mat({ color: '#1c1512', roughness: .9, emissive: '#ff5a14', emissiveIntensity: .35 });
    for (let i = 0; i < 4; i++) {
      const a = k.deg(75 + i * 90 + k.range(-6, 6)), r = k.range(.13, .15);
      const Bt = new T.Vector3(Math.sin(a) * 1.0, .17 + r * .7, Math.cos(a) * 1.0), Tp = new T.Vector3(-Math.sin(a) * .1, 1.36 + k.range(-.06, .06), -Math.cos(a) * .1), d = Tp.clone().sub(Bt);
      const log = k.mesh(k.cyl(r, r * 1.05, d.length(), { seg: 20 }), [bark, charEnd, cutEnd], { p: Bt.clone().addScaledVector(d, .5).toArray() });
      g.add(orient(k, log, d.toArray()));
    }
    // flames: tongues of fire in layers, red-orange outside, then yellow, then a pale hot core (each set a little toward the camera)
    const flameGeo = (h, r, lean, ph, c0, c1) => {
      const geo = warp(k.lathe(Array.from({ length: 25 }, (_, i) => { const t = i / 24; return [r * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, .6))), .85), t * h]; }), { seg: 20 }), (x, y, z) => {
        const t = y / h;
        return [x + lean[0] * t * t * h + .08 * Math.sin(t * 6 + ph) * t * h, y, z + lean[1] * t * t * h + .06 * Math.cos(t * 5 + ph) * t * h];
      });
      const pos = geo.attributes.position, col = [], A = k.color(c0), B = k.color(c1), C = new T.Color();
      for (let i = 0; i < pos.count; i++) { C.copy(A).lerp(B, clamp01(pos.getY(i) / h) ** .9); col.push(C.r, C.g, C.b); }
      geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      return geo;
    };
    const flameMat = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const cam = new T.Vector3(Math.sin(k.deg(30)), 0, Math.cos(k.deg(30)));
    const layers = [['#ff7a14', '#e0280a', 1, 0], ['#ffae22', '#ff6a10', .74, .5], ['#ffe46a', '#ffb224', .5, .85], ['#fffbe2', '#ffe68a', .27, 1.1]];
    const tongues = [[0, 0, 2.1, .44, [0, 0], 0], [.34, .12, 1.4, .28, [.22, .08], 1.3], [-.32, .14, 1.3, .27, [-.26, .1], 2.2], [.08, -.34, 1.55, .28, [0, -.2], 3.1], [-.14, .34, 1.15, .24, [-.06, .22], 4.2], [.3, -.24, 1.05, .22, [.28, -.18], 5.1]];
    const fg = k.group([], { p: [0, .2, 0] }); g.add(fg);
    for (const [c0, c1, sc, fwd] of layers) for (const [x, z, h, r, lean, ph] of tongues) {
      if (sc < .5 && h < 1.3) continue;
      k.add(fg, flameGeo(h * (sc * .6 + .4), r * sc, lean, ph, c0, c1), flameMat, { p: [x + cam.x * r * fwd, 0, z + cam.z * r * fwd], shadow: false });
    }
    const h1 = halo(k, 1.25, '#ff8a2a', .45); h1.position.set(0, 1.1, 0); g.add(h1);
    const light = new T.PointLight(0xff9040, 9, 0, 2); light.position.set(0, .8, 0); g.add(light);
    // embers drifting up
    const sparks = [];
    for (let i = 0; i < 24; i++) { const y = k.range(1.3, 3.0), r = k.range(0, .2 + y * .2), a = k.rand() * TAU; sparks.push({ p: [Math.sin(a) * r, y, Math.cos(a) * r], s: k.range(.6, 1.4) * (1.2 - y / 5) }); }
    g.add(k.instances(k.sphere(.03, { w: 8, h: 6 }), new T.MeshBasicMaterial({ color: k.color('#ffb040'), toneMapped: false }), sparks));
    // a marshmallow on a stick, resting on a stone and reaching into the heat
    const sa = k.deg(62), Ps = new T.Vector3(Math.sin(sa) * Rr, .55, Math.cos(sa) * Rr), Pt = new T.Vector3(Math.sin(sa) * .62, 1.05, Math.cos(sa) * .62 + .1);
    const sdir = Ps.clone().sub(Pt), sEnd = Pt.clone().addScaledVector(sdir, Pt.y / (Pt.y - Ps.y)), sn = sdir.clone().normalize();
    k.add(g, k.tube([sEnd.toArray(), Ps.clone().lerp(sEnd, .5).add(new T.Vector3(0, .03, 0)).toArray(), Ps.toArray(), Pt.clone().lerp(Ps, .5).toArray(), Pt.toArray()], .035, { caps: true, seg: 40, rs: 8 }), k.mat({ color: '#7a5638', roughness: .8 }));
    const toast = k.tex(256, 128, (c, w, h) => {
      c.fillStyle = '#fbf6ea'; c.fillRect(0, 0, w, h);
      const gr = c.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(.12, 'rgba(226,170,96,0)'); gr.addColorStop(.3, 'rgba(214,146,68,1)'); gr.addColorStop(.5, 'rgba(160,88,34,1)'); gr.addColorStop(.7, 'rgba(214,146,68,1)'); gr.addColorStop(.88, 'rgba(226,170,96,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(90,44,14,${k.range(.3, .7)})`; c.beginPath(); c.ellipse(k.range(.35, .65) * w, k.rand() * h, k.range(3, 9), k.range(2, 6), 0, 0, TAU); c.fill(); }
    });
    const mm = k.mesh(k.rcyl(.18, .32, .07, { seg: 32 }), k.mat({ map: toast, roughness: .5, clearcoat: .4, sheen: .3, sheenColor: k.color('#ffffff') }), { p: Pt.clone().addScaledVector(sn, .02).toArray() });
    g.add(orient(k, mm, sn.toArray()));
    g.userData.view = { el: 24 };
    g.userData.fullView = { el: 17 };
    return g;
  },
};
