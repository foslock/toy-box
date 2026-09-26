// Models for the bathroom cards. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

// ---- local helpers ----
// A skin through closed rings of points (each ring [[x, y, z], ...], all the same length, going round from +z towards +x
// seen from above). u runs round the rings, v from the first ring to the last (by distance). Faces point out of the
// solid while the rings climb and into the hollow when they come back down (so a tub's inside faces the inside).
function loft(k, rings, o = {}) {
  const T = k.THREE, n = rings[0].length, m = rings.length, pos = [], uv = [], idx = [], lens = [0];
  for (let j = 1; j < m; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) { const a = rings[j][i], b = rings[j - 1][i]; s += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
    lens.push(lens[j - 1] + s / n);
  }
  const total = lens[m - 1] || 1;
  for (let j = 0; j < m; j++) for (let i = 0; i <= n; i++) { const p = rings[j][i % n]; pos.push(p[0], p[1], p[2]); uv.push(i / n, lens[j] / total); }
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
    if (o.flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const nr = geo.attributes.normal, v = new T.Vector3();
  for (let j = 0; j < m; j++) {     // smooth the seam
    const a = j * (n + 1), b = a + n;
    v.set(nr.getX(a) + nr.getX(b), nr.getY(a) + nr.getY(b), nr.getZ(a) + nr.getZ(b)).normalize();
    nr.setXYZ(a, v.x, v.y, v.z); nr.setXYZ(b, v.x, v.y, v.z);
  }
  return geo;
}
// A flat lid filling one ring of points (all at the same height), facing up or down.
function cap(k, ring, up = true) {
  const s = new k.THREE.Shape();
  ring.forEach(([x, , z], i) => i ? s.lineTo(x, up ? -z : z) : s.moveTo(x, up ? -z : z));
  const geo = new k.THREE.ShapeGeometry(s, 1);
  geo.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
  geo.translate(0, ring[0][1], 0);
  return geo;
}
// A closed outline in the xz plane as a Shape (x, z), for extruding flat parts like seats and lids.
function outlineShape(k, pts) { const s = new k.THREE.Shape(); pts.forEach(([x, z], i) => i ? s.lineTo(x, z) : s.moveTo(x, z)); s.closePath(); return s; }
// A point on a superellipse of half-sizes a (x) and b (z); n = 2 is an ellipse, bigger is squarer. t = 0 is the front (+z).
const superPt = (a, b, n, t) => { const s = Math.sin(t), c = Math.cos(t); return [a * Math.sign(s) * Math.abs(s) ** (2 / n), b * Math.sign(c) * Math.abs(c) ** (2 / n)]; };
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// A point on a rounded rectangle (half-sizes hw, hd, corner radius rc), t in [0, 1) by arc length from the front middle towards +x.
function rrPt(hw, hd, rc, t) {
  rc = Math.max(1e-4, Math.min(rc, hw, hd));
  const sx = hw - rc, sz = hd - rc, arc = Math.PI / 2 * rc;
  const segs = [
    [sx, u => [u, hd]],
    [arc, u => [sx + Math.sin(u / rc) * rc, sz + Math.cos(u / rc) * rc]],
    [2 * sz, u => [hw, sz - u]],
    [arc, u => [sx + Math.cos(u / rc) * rc, -sz - Math.sin(u / rc) * rc]],
    [2 * sx, u => [sx - u, -hd]],
    [arc, u => [-sx - Math.sin(u / rc) * rc, -sz - Math.cos(u / rc) * rc]],
    [2 * sz, u => [-hw, -sz + u]],
    [arc, u => [-sx - Math.cos(u / rc) * rc, sz + Math.sin(u / rc) * rc]],
    [sx, u => [-sx + u, hd]],
  ];
  let s = t * segs.reduce((a, [l]) => a + l, 0);
  for (const [l, f] of segs) { if (s <= l) return f(s); s -= l; }
  return [0, hd];
}
// A soap-bubble film: clear with a rainbow sheen.
const bubbleMat = k => Object.assign(k.glass('#ffffff', { opacity: .34, env: 2.6 }), { iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [180, 560] });
// A bubble with a little window glint so it reads at card size.
function bubble(k, parent, mat, x, y, z, r) {
  k.add(parent, k.sphere(r, { w: 32, h: 20 }), mat, { p: [x, y, z], shadow: false });
  k.add(parent, k.sphere(r * .2, { w: 12, h: 8 }), k.glow('#ffffff', 1.2), { p: [x - r * .38, y + r * .48, z + r * .62], s: [1, .7, .5], r: [0, 0, .6], shadow: false });
}
// Quilted paper: one diamond of a repeating grid per tile (tile w × h pixels at x0, y0), with a stitch dot in each.
function quiltTile(c, x0, y0, w, h) {
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + w, y0 + h); c.moveTo(x0 + w, y0); c.lineTo(x0, y0 + h); c.stroke();
  for (const [x, y] of [[w / 2, 0], [0, h / 2], [w, h / 2], [w / 2, h]]) { c.beginPath(); c.arc(x0 + x, y0 + y, Math.min(w, h) * .05, 0, 7); c.fill(); }
}

export default {
  // The classic yellow rubber duck, in profile facing right.
  duck(k) {
    const g = k.group(), d = k.group([], { r: [0, -.45, 0] });
    g.add(d);
    const yellow = k.gloss('#ffd21f'), orange = k.gloss('#ff8a1c'), eye = k.gloss('#141414');
    k.add(d, k.sphere(1), yellow, { p: [0, .82, 0], s: [1.35, .82, 1.02] });
    k.add(d, k.sphere(.45), yellow, { p: [-1.05, 1.12, 0], s: [1, .8, .9], r: [0, 0, .7] });               // tail
    k.add(d, k.sphere(.7), yellow, { p: [.72, 1.78, 0], s: [1, .97, .95] });                              // head
    k.add(d, k.sphere(.42), orange, { p: [1.32, 1.66, 0], s: [1.05, .34, .78] });                         // bill
    k.add(d, k.sphere(.36), orange, { p: [1.26, 1.56, 0], s: [.95, .22, .66] });
    for (const z of [-.47, .47]) {
      k.add(d, k.sphere(.12), eye, { p: [1.0, 1.98, z] });
      k.add(d, k.sphere(.035), k.glow('#ffffff', 1), { p: [1.07, 2.03, z * 1.13] });
      k.add(d, k.sphere(.5), k.gloss('#ffc40f'), { p: [-.05, 1.0, z * 1.72], s: [1.1, .55, .28], r: [0, 0, .25] }); // wing
    }
    return g;
  },

  // A pink toothbrush lying on its back, with a striped squiggle of toothpaste on the bristles.
  toothbrush(k) {
    const g = k.group(), b = k.group([], { r: [0, -.26, 0] });
    g.add(b);
    const body = k.gloss('#ff5c7a'), grip = k.plastic('#ffe0e7', { rough: .55, coat: .2 });
    const yA = .21, flat = .62, hx = 6.3;
    // handle: a lathe turned to lie along +x, squashed to an oval
    const handle = k.lathe([[0, 0], [.17, .02], [.27, .1], [.32, .35], [.34, .95], [.34, 1.8], [.31, 2.6], [.25, 3.3], [.17, 3.9], [.125, 4.5], [.13, 5.1], [.17, 5.5], [.19, 5.72], [0, 5.74]], { smooth: true, seg: 40 });
    k.add(b, handle, body, { p: [0, yA, 0], r: [0, 0, -Math.PI / 2], s: [flat, 1, 1] });
    k.add(b, k.box(1.42, .2, .5, .09), body, { p: [hx, yA, 0] });                                   // head
    k.add(b, k.sphere(1, { w: 32, h: 16 }), grip, { p: [1.75, yA + .16, 0], s: [1.05, .07, .14] });  // rubber grip on top
    for (const z of [-1, 1]) k.add(b, k.sphere(1, { w: 32, h: 16 }), grip, { p: [1.65, yA, z * .3], s: [1.0, .11, .07] });
    const tufts = [];
    for (let i = 0; i < 8; i++) for (let j = -1; j <= 1; j++) tufts.push({ p: [hx - .56 + i * .16, .31 + .2, j * .14], color: (i + j + 2) % 2 ? '#8fdcff' : '#ffffff' });
    b.add(k.instances(k.cyl(.06, .06, .4, { seg: 10 }), k.plastic('#ffffff', { rough: .6, coat: 0 }), tufts));
    const pasteTex = k.tex(32, 64, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#34c6d6'; c.fillRect(0, h * .08, w, h * .14); c.fillRect(0, h * .58, w, h * .14);
      c.fillStyle = '#2f74e0'; c.fillRect(0, h * .34, w, h * .08); c.fillRect(0, h * .84, w, h * .08);
    });
    const pts = [[hx - .64, .78, -.06], [hx - .4, .84, .08], [hx - .15, .85, -.08], [hx + .1, .85, .08], [hx + .35, .85, -.07], [hx + .56, .87, .03], [hx + .68, .95, .06]];
    k.add(b, k.tube(pts, .12, { caps: true, seg: 80, rs: 16 }), k.gloss('#ffffff', { map: pasteTex, rough: .25 }));
    g.userData.view = { az: 30, el: 38 };
    g.userData.fullView = { el: 30 };
    return g;
  },

  // A pink bar of soap stamped SOAP, with a few bubbles.
  soap(k) {
    const g = k.group();
    const soap = k.mat({ color: '#f7a3c7', roughness: .38, clearcoat: .5, clearcoatRoughness: .35, sheen: .5, sheenColor: '#ffe3ef', sheenRoughness: .5 });
    const W = 3.0, D = 1.9, T = .5, bev = .3, top = T + bev * 2;
    k.add(g, k.extrude(k.roundRect(W, D, .78), T, { bevel: bev, bevelSeg: 8 }), soap, { p: [0, top / 2, 0], r: [-Math.PI / 2, 0, 0] });
    const stamp = k.decal(2.3, 1.25, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      const draw = (dx, dy, color) => {
        c.save(); c.translate(dx, dy);
        c.strokeStyle = color; c.lineWidth = 8; c.beginPath(); c.roundRect(16, 16, w - 32, h - 32, 70); c.stroke();
        k.text(c, 'SOAP', w / 2, h / 2 + 6, { size: 120, weight: 700, color });
        c.restore();
      };
      draw(-3, 3, 'rgba(120,30,70,.35)');
      draw(3, -3, 'rgba(255,255,255,.6)');
      draw(0, 0, '#ec93b9');
    }, { px: 512, p: [0, top + .003, 0], r: [-Math.PI / 2, 0, 0] });
    g.add(stamp);
    const bub = bubbleMat(k);
    for (const [x, y, z, r] of [[1.3, top, .5, .22], [1.02, top, .78, .13], [1.6, top, .2, .12], [2.1, 0, .9, .32], [2.55, 0, .3, .16], [-1.1, top + 1.1, .3, .26], [-.45, top + 1.65, -.1, .17]]) {
      bubble(k, g, bub, x, y + r * .55, z, r);
    }
    g.userData.view = { az: 28, el: 32 };
    g.userData.fullView = { el: 26 };
    return g;
  },

  // A quilted roll lying on its side, its tail rolled out over the counter.
  toiletpaper(k) {
    const g = k.group(), T = k.THREE;
    const R = 1.1, L = 2.1, rc = .42, e = .08, white = '#fbfaf6';
    // embossed quilting, as a bump map
    const quilt = repeat => k.tex(128, 128, (c, w, h) => { c.fillStyle = '#9a9a9a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#5a5a5a'; c.fillStyle = '#5a5a5a'; c.lineWidth = 5; quiltTile(c, 0, 0, w, h); }, { data: true, repeat });
    const side = k.lathe([[R - e, -L / 2], [R - e * .3, -L / 2 + e * .1], [R, -L / 2 + e * .7], [R, L / 2 - e * .7], [R - e * .3, L / 2 - e * .1], [R - e, L / 2]], { seg: 80 });
    k.add(g, side, k.matte(white, .9, { bumpMap: quilt([12, 3]), bumpScale: 1.4 }), { p: [0, R, 0], r: [0, 0, -Math.PI / 2] });
    // the ends: fine rings of paper, and the cardboard core
    const endTex = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = white; c.fillRect(0, 0, w, h);
      for (let r = (rc / (R - e)) * w / 2; r < w / 2; r += 2.3) { c.strokeStyle = `rgba(110,110,135,${.04 + k.rand() * .08})`; c.lineWidth = 1; c.beginPath(); c.arc(w / 2, h / 2, r, 0, 7); c.stroke(); }
    });
    const endMat = k.matte(white, .92, { map: endTex });
    for (const sx of [-1, 1]) {
      k.add(g, k.ring(rc + .015, R - e, 80), endMat, { p: [sx * L / 2, R, 0], r: [0, sx * Math.PI / 2, 0] });
      k.add(g, k.ring(rc - .03, rc + .02, 40), k.matte('#b88550', .9), { p: [sx * (L / 2 + .004), R, 0], r: [0, sx * Math.PI / 2, 0] });
    }
    k.add(g, k.cyl(rc - .005, rc - .005, L + .006, { open: true, seg: 40 }), k.matte('#c89a66', .9, { side: T.DoubleSide }), { p: [0, R, 0], r: [0, 0, Math.PI / 2] });
    // the tail: off the front of the roll, down to the counter and out towards us
    // (kept a hair above the floor so it doesn't flicker against the studio's shadow catcher)
    const path = new T.CatmullRomCurve3([[0, R, R + .006], [0, R * .55, R + .07], [0, .24, R + .28], [0, .045, R + .66], [0, .03, R + 1.15], [0, .03, R + 1.7], [0, .06, R + 2.05], [0, .14, R + 2.22]].map(p => new T.Vector3(...p)));
    const N = 90, P = path.getSpacedPoints(N), len = path.getLength(), tw = L * .97;
    const tailTex = k.tex(256, 1024, (c, w, h) => {
      c.fillStyle = white; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(90,95,120,.4)';                  // a perforation, one sheet in
      const py = h * (1 - 1.35 / len);
      for (let x = 4; x < w; x += 12) c.fillRect(x, py - 2, 6, 4);
    });
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const p = P[i];
      pos.push(-tw / 2, p.y, p.z, tw / 2, p.y, p.z); uv.push(0, i / N, 1, i / N);
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const tail = new T.BufferGeometry();
    tail.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); tail.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    tail.setIndex(idx); tail.computeVertexNormals();
    k.add(g, tail, k.matte(white, .9, { map: tailTex, bumpMap: quilt([tw / .58, len / .7]), bumpScale: 1.4, side: T.DoubleSide }));
    g.userData.view = { az: 34, el: 24 };
    return g;
  },

  // The red rubber cup and the long wooden handle.
  plunger(k) {
    const g = k.group();
    const red = k.plastic('#d93a32', { rough: .32, coat: .8, coatRough: .15 });
    k.add(g, k.lathe([[0, .03], [2.3, 0], [2.74, .04], [2.9, .18], [2.92, .4], [2.84, .6], [2.76, .95], [2.58, 1.6], [2.24, 2.28], [1.74, 2.85], [1.16, 3.24], [.88, 3.46], [.8, 3.76], [.8, 4.3], [.7, 4.45], [0, 4.47]], { smooth: true, seg: 72 }), red);
    for (const y of [3.86, 4.16]) k.add(g, k.torus(.81, .05, { rs: 12, ts: 48 }), red, { p: [0, y, 0], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.rcyl(.5, 12.4, .32, { seg: 32 }), k.wood('maple', { varnish: .6 }), { p: [0, 4.0, 0] });
    g.userData.view = { az: 30, el: 14 };
    return g;
  },

  // A pearly teal squeeze bottle with a flip-top cap and a waterfall label.
  shampoo(k) {
    const g = k.group(), zs = .58;
    const grad = k.tex(8, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9ff0ef'); gr.addColorStop(.55, '#35c2d3'); gr.addColorStop(1, '#1789b3'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    const bottle = k.mat({ map: grad, roughness: .16, clearcoat: 1, clearcoatRoughness: .06, iridescence: .3, iridescenceIOR: 1.5 });
    const prof = [[0, 0], [1.08, 0], [1.28, .05], [1.37, .22], [1.4, .55], [1.39, 1.2], [1.33, 2.6], [1.27, 3.9], [1.2, 4.45], [1.04, 4.95], [.8, 5.3], [.6, 5.52], [.54, 5.7], [.54, 5.85], [0, 5.86]];
    k.add(g, k.lathe(prof, { smooth: true, seg: 64 }), bottle, { s: [1, 1, zs] });
    const lbl = k.painted(512, 420, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 36); c.fill();
      c.save(); c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 36); c.clip();
      c.fillStyle = '#bfeef5'; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w, h * .3);
      for (let x = w; x >= 0; x -= 8) c.lineTo(x, h * .3 + Math.sin(x / 40) * 10);
      c.fill();
      c.fillStyle = '#6fd2e6'; c.fillRect(w * .44, 0, w * .12, h * .36);                 // a little waterfall
      c.restore();
      k.text(c, 'SHAMPOO', w / 2, h * .58, { size: 88, weight: 700, color: '#1668a8' });
      k.text(c, 'waterfall fresh', w / 2, h * .78, { size: 42, weight: 700, color: '#2aa6c4', font: 'Nunito, sans-serif' });
    }, { transparent: true, rough: .3, coat: .6 });
    const len = 2.1;
    k.add(g, k.cyl(1.3, 1.402, 2.3, { open: true, start: -len / 2, len, seg: 48 }), lbl, { p: [0, 2.35, 0], s: [1, 1, zs], shadow: false });
    const capMat = k.gloss('#ffffff');
    k.add(g, k.rcyl(.62, .5, .08, { seg: 48 }), capMat, { p: [0, 5.72, 0], s: [1, 1, .74] });
    k.add(g, k.rcyl(.6, .3, .1, { seg: 48 }), capMat, { p: [0, 6.2, 0], s: [1, 1, .74] });
    k.add(g, k.torus(.6, .016, { rs: 8, ts: 48 }), k.matte('#9aa7b4', .5), { p: [0, 6.21, 0], r: [Math.PI / 2, 0, 0], s: [1, .74, 1] });
    k.add(g, k.box(.3, .1, .14, .04), capMat, { p: [0, 6.3, .44] });                          // thumb tab
    g.userData.view = { az: 26, el: 14 };
    return g;
  },

  // A pink pistol-grip hair dryer with a flat concentrator nozzle and its cord curled behind.
  hairdryer(k) {
    const g = k.group(), T = k.THREE;
    const pink = k.gloss('#ff8fa6'), dark = k.plastic('#2d2a33', { rough: .4 }), chrome = k.chrome();
    const Yb = 4.55;
    k.add(g, k.lathe([[0, -3.1], [.96, -3.1], [1.18, -3.03], [1.3, -2.85], [1.35, -2.5], [1.34, -1.5], [1.27, -.2], [1.17, 1.1], [1.08, 1.9], [1.0, 2.2], [0, 2.2]], { smooth: true, seg: 64 }), pink, { p: [0, Yb, 0], r: [0, 0, -Math.PI / 2] });
    k.add(g, k.torus(1.03, .07, { rs: 14, ts: 64 }), chrome, { p: [2.12, Yb, 0], r: [0, Math.PI / 2, 0] });
    k.add(g, k.torus(1.345, .04, { rs: 10, ts: 64 }), chrome, { p: [-2.65, Yb, 0], r: [0, Math.PI / 2, 0] });
    // the concentrator: round where it meets the barrel, a flat slot at the tip
    const rings = [];
    for (let j = 0; j <= 8; j++) {
      const t = j / 8, x = 2.15 + t * 1.4, ry = .92 + (.24 - .92) * t ** .8, rz = .92 + (1.02 - .92) * t, n = 2 + 4 * t, ring = [];
      for (let i = 0; i < 48; i++) { const [yy, zz] = superPt(ry, rz, n, i / 48 * k.TAU); ring.push([x, Yb + yy, zz]); }
      rings.push(ring);
    }
    k.add(g, loft(k, rings, { flip: true }), dark);
    const last = rings[rings.length - 1], sh = new T.Shape();
    last.forEach(([, y, z], i) => i ? sh.lineTo(-z, y - Yb) : sh.moveTo(-z, y - Yb));
    k.add(g, new T.ShapeGeometry(sh), k.matte('#141316', .7), { p: [3.551, Yb, 0], r: [0, Math.PI / 2, 0] });
    // the handle, raked back, flat underneath so it stands
    const hs = new T.Shape();
    hs.moveTo(-2.35, .16); hs.lineTo(-1.2, .16); hs.bezierCurveTo(-1.0, 1.4, -.6, 2.8, -.3, Yb - .3); hs.lineTo(-1.8, Yb - .1); hs.bezierCurveTo(-2.05, 2.8, -2.3, 1.4, -2.35, .16);
    k.add(g, k.extrude(hs, .72, { bevel: .16, bevelSeg: 5 }), pink);
    k.add(g, k.slab(.42, 1.3, .08, .16), dark, { p: [-1.28, 2.25, .52], r: [0, 0, -.18] });
    k.add(g, k.box(.26, .2, .1, .05), k.gloss('#ffffff'), { p: [-1.21, 2.62, .57], r: [0, 0, -.18] });
    k.add(g, k.box(.26, .2, .1, .05), k.gloss('#ffffff'), { p: [-1.33, 1.95, .57], r: [0, 0, -.18] });
    k.add(g, k.sphere(.15), chrome, { p: [-.42, 3.45, 0], s: [.7, 1, 1] });                    // cool-shot button
    k.add(g, k.cyl(.09, .14, .55, { seg: 20 }), dark, { p: [-2.62, .36, 0], r: [0, 0, 1.87] });   // strain relief
    g.add(k.cord([[-2.85, .28, 0], [-3.2, .09, .1], [-3.65, .08, .55], [-3.6, .08, 1.15], [-3.0, .08, 1.45], [-2.3, .08, 1.35], [-2.0, .08, .95], [-2.45, .08, .75], [-2.8, .08, 1.0]], .075, '#2b2b2e'));
    g.userData.view = { az: 24, el: 12 };
    return g;
  },

  // Two plump folded bath towels, stacked, each with a woven band across the fold.
  towels(k) {
    const g = k.group();
    const W = 3.4, D = 2.3, H = .78, N = 120;
    const bump = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 5000; i++) { const v = k.rand(); c.fillStyle = v > .5 ? `rgba(255,255,255,${(v - .5) * .9})` : `rgba(0,0,0,${(.5 - v) * .9})`; c.beginPath(); c.arc(k.rand() * w, k.rand() * h, 1 + k.rand() * 1.4, 0, 7); c.fill(); }
    }, { data: true, repeat: [12, 3] });
    const towel = (col, sheen, bandCol, y, rot, dx, dz, sc) => {
      const hw = W / 2 * sc, hd = D / 2 * sc, rc = .5 * sc, r = H / 2 * .92;
      // profile [scale, offset, y]: flat bottom, a round soft side, a gently domed top
      const prof = [[.35, -r, 0], [.7, -r, 0]];
      for (let a = -90; a <= 90; a += 15) { const q = a * Math.PI / 180; prof.push([1, -r * (1 - Math.cos(q)), H / 2 + H / 2 * Math.sin(q)]); }
      for (const [s, dy] of [[.94, .035], [.8, .07], [.6, .09], [.35, .1]]) prof.push([s, -r, H + dy]);
      const rings = prof.map(([s, d, yy]) => { const ring = []; for (let i = 0; i < N; i++) { const [x, z] = rrPt(hw + d, hd + d, rc + d, i / N); ring.push([x * s, yy, z * s]); } return ring; });
      const geo = loft(k, rings);
      const vAt = j => geo.attributes.uv.getY(j * (N + 1));
      const v0 = vAt(2 + 7), v1 = vAt(2 + 9), uEnd = (hw - rc) / (4 * (hw - rc) + 4 * (hd - rc) + 2 * Math.PI * rc) + .02;
      const tex = k.tex(1024, 256, (c, w, h) => {
        c.fillStyle = col; c.fillRect(0, 0, w, h);
        const band = (x0, x1) => {       // a woven dobby band, tone on tone, edged with fine cream lines
          const y0 = h * (1 - v1), bh = h * (v1 - v0);
          c.fillStyle = bandCol; c.fillRect(x0, y0, x1 - x0, bh);
          c.fillStyle = 'rgba(0,0,0,.08)'; for (let x = x0; x < x1; x += 6) c.fillRect(x, y0, 3, bh);
          c.fillStyle = '#fff6ea'; c.fillRect(x0, y0 - 3, x1 - x0, 3); c.fillRect(x0, y0 + bh, x1 - x0, 3);
        };
        band(0, uEnd * w); band((1 - uEnd) * w, w);
        for (let i = 0; i < 6000; i++) { c.fillStyle = k.rand() > .5 ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)'; c.fillRect(k.rand() * w, k.rand() * h, 2, 2); }
      });
      const m = k.mat({ map: tex, roughness: .95, sheen: .8, sheenRoughness: .7, sheenColor: sheen, bumpMap: bump, bumpScale: 2 });
      const t = k.group([], { p: [dx, y, dz], r: [0, rot, 0] });
      k.add(t, geo, m);
      k.add(t, cap(k, rings[0], false), m);
      k.add(t, cap(k, rings[rings.length - 1]), m);
      g.add(t);
    };
    towel('#2fb0a5', '#a8efe6', '#78d8cc', 0, 0, 0, 0, 1);
    towel('#ff8a80', '#ffd6d1', '#ffbdb4', H + .05, .08, .06, .03, .94);
    g.userData.view = { az: 30, el: 20 };
    return g;
  },

  // An analogue bathroom scale: a coral body, a ribbed mat with footprints and a dial.
  scale(k) {
    const g = k.group();
    const W = 3.0, D = 3.2, H = .5, lift = .05, top = lift + H;
    const body = k.gloss('#f2736a');
    k.add(g, k.box(W, H, D, .2), body, { p: [0, lift + H / 2, 0] });
    k.add(g, k.box(W - .4, lift + .04, D - .4, .02), k.rubber('#3a3438'), { p: [0, (lift + .04) / 2, 0] });
    // ribbed rubber mat with two footprints, toes towards the dial
    k.add(g, k.slab(2.6, 2.05, .06, .3), k.matte('#e2e0dc', .9), { p: [0, top + .01, .5], r: [-Math.PI / 2, 0, 0] });
    g.add(k.decal(2.4, 1.85, (c, w, h) => {
      c.fillStyle = '#e2e0dc'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(0,0,0,.09)'; for (let y = 6; y < h; y += 14) c.fillRect(0, y, w, 5);
      const foot = (cx, cy, m) => {
        c.save(); c.translate(cx, cy); c.scale(m, 1); c.fillStyle = '#b3aca4';
        c.beginPath(); c.ellipse(0, 20, 36, 70, .08, 0, 7); c.fill();
        c.beginPath(); c.ellipse(-4, 88, 30, 34, 0, 0, 7); c.fill();
        for (const [x, y, r] of [[-22, -62, 14], [-1, -71, 11], [15, -67, 10], [28, -58, 9], [38, -46, 8]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
        c.restore();
      };
      foot(w * .3, h * .52, -1); foot(w * .7, h * .52, 1);
    }, { px: 512, p: [0, top + .052, .5], r: [-Math.PI / 2, 0, 0] }));
    // the dial at the back, under a glass dome
    const dz = -1.0;
    k.add(g, k.rcyl(.8, .12, .05), body, { p: [0, top - .03, dz] });
    k.add(g, k.torus(.72, .05, { rs: 12, ts: 64 }), k.chrome(), { p: [0, top + .1, dz], r: [-Math.PI / 2, 0, 0] });
    const face = k.painted(512, 512, (c, w, h) => {
      const cx = w / 2, cy = h / 2, R = w / 2;
      c.fillStyle = '#fbfaf5'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#2a2a2a';
      for (let i = 0; i < 60; i++) {
        const a = i / 60 * Math.PI * 2, long = i % 5 === 0, r0 = R * (long ? .7 : .78), r1 = R * .88;
        c.lineWidth = long ? 6 : 3; c.beginPath(); c.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0); c.lineTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1); c.stroke();
      }
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.text(c, String(i * 25), cx + Math.sin(a) * R * .54, cy - Math.cos(a) * R * .54, { size: 40, color: '#2a2a2a' }); }
      const a = .9;
      c.strokeStyle = '#e0322b'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - Math.sin(a) * R * .12, cy + Math.cos(a) * R * .12); c.lineTo(cx + Math.sin(a) * R * .86, cy - Math.cos(a) * R * .86); c.stroke();
      c.fillStyle = '#e0322b'; c.beginPath(); c.arc(cx, cy, 20, 0, 7); c.fill();
    }, { rough: .4 });
    k.add(g, k.disc(.7, 64), face, { p: [0, top + .095, dz], r: [-Math.PI / 2, 0, 0] });
    const th = .55, Rd = .72 / Math.sin(th);
    k.add(g, k.sphere(Rd, { thetaLen: th }), k.glass('#ffffff', { opacity: .18 }), { p: [0, top + .1 - Rd * Math.cos(th), dz], shadow: false });
    g.userData.view = { az: 22, el: 46 };
    g.userData.fullView = { el: 36 };
    return g;
  },

  // A white enamel double-ended clawfoot tub on gold lion feet, full of bubbles, with a chrome gooseneck faucet.
  clawfoot(k) {
    const g = k.group();
    const A = 3.35, B = 1.5, n = 2.5, N = 96, lift = .42;
    const enamel = k.ceramic('#fdfcf8'), gold = k.gold(), chrome = k.chrome();
    const ringAt = (d, y, flat) => {
      const r = [];
      for (let i = 0; i < N; i++) {
        const [px, pz] = superPt(1, 1, n, i / N * k.TAU);
        r.push([(A + d) * px, y + (flat ? 0 : lift * px ** 4 * smoothstep(1.0, 2.2, y)), (B + d) * pz]);
      }
      return r;
    };
    const roll = [];
    for (let a = -90; a <= 215; a += 25) { const r = a * Math.PI / 180; roll.push([.1 * Math.cos(r), 2.28 + .1 * Math.sin(r)]); }
    const prof = [[-.78, .5], [-.7, .54], [-.6, .62], [-.5, .74], [-.4, .92], [-.3, 1.18], [-.2, 1.5], [-.12, 1.82], [-.07, 2.05], [-.035, 2.15], ...roll,
      [-.13, 2.12], [-.19, 1.9], [-.27, 1.6], [-.36, 1.3], [-.47, 1.05], [-.6, .88], [-.72, .82], [-.8, .8]];
    k.add(g, loft(k, prof.map(([d, y]) => ringAt(d, y))), enamel);
    k.add(g, cap(k, ringAt(-.78, .5), false), enamel);
    k.add(g, cap(k, ringAt(-.8, .8)), enamel);
    k.add(g, k.tube(ringAt(-.042, 2.1), .014, { closed: true, seg: 200, rs: 6 }), gold, { shadow: false });   // gold pinstripe under the rim
    // bath water and a mound of bubbles
    const wy = 1.72;
    k.add(g, cap(k, ringAt(-.26, wy, true)), k.mat({ color: '#8fd6ee', roughness: .05, clearcoat: 1, clearcoatRoughness: .02 }));
    const foam = [];
    for (let i = 0; i < 46; i++) {
      const a = k.range(0, k.TAU), rr = Math.sqrt(k.rand()), s = k.range(.12, .3) * (1 - rr * .4);
      foam.push({ p: [-.3 + Math.cos(a) * rr * 1.7, wy + s * .3 + (1 - rr) * .14, Math.sin(a) * rr * .8], s });
    }
    g.add(k.instances(k.sphere(1, { w: 16, h: 12 }), k.plastic('#ffffff', { rough: .35, coat: .3 }), foam));
    // a little duck
    const dk = k.group([], { p: [1.55, wy - .12, .3], r: [0, -.2, 0], s: .37 });
    const yellow = k.gloss('#ffd21f'), orange = k.gloss('#ff8a1c');
    k.add(dk, k.sphere(1), yellow, { p: [0, .82, 0], s: [1.35, .82, 1.02] });
    k.add(dk, k.sphere(.7), yellow, { p: [.72, 1.78, 0] });
    k.add(dk, k.sphere(.42), orange, { p: [1.32, 1.66, 0], s: [1.05, .34, .78] });
    for (const z of [-.47, .47]) k.add(dk, k.sphere(.12), k.gloss('#141414'), { p: [1.0, 1.98, z] });
    g.add(dk);
    // four gold lion's feet: a leg reaching down from the tub to a ball gripped by three claws
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const fx = sx * 2.3, fz = sz * .84;
      const f = k.group([], { p: [fx, 0, fz], r: [0, Math.atan2(-sz * .45, sx), 0] });
      k.add(f, k.sphere(.14, { w: 24, h: 16 }), gold, { p: [.08, .14, 0] });
      k.add(f, k.tube([[.02, .22, 0], [-.02, .42, 0], [-.1, .62, 0], [-.22, .82, 0]], .085, { caps: true, seg: 24, rs: 12 }), gold);
      k.add(f, k.sphere(.17, { w: 24, h: 16 }), gold, { p: [-.2, .82, 0], s: [1.25, .8, 1.3] });
      for (const a of [-.75, 0, .75]) {
        const toe = [[.02, .28, 0], [.2, .24, 0], [.27, .12, 0], [.26, .03, 0]].map(([x, y, z]) => {
          const dx = x - .08; return [.08 + dx * Math.cos(a), y, dx * Math.sin(a)];
        });
        k.add(f, k.tube(toe, .045, { caps: true, seg: 16, rs: 8 }), gold);
      }
      g.add(f);
    }
    // the faucet on the far end: two cross handles and a gooseneck spout
    const fx0 = -3.33, base = 2.78;
    for (const sz of [-1, 1]) {
      k.add(g, k.cyl(.055, .07, .34, { seg: 20 }), chrome, { p: [fx0, base + .17, sz * .3] });
      const hy = base + .36;
      k.add(g, k.capsule(.024, .22, 6), chrome, { p: [fx0, hy, sz * .3], r: [0, 0, Math.PI / 2] });
      k.add(g, k.capsule(.024, .22, 6), chrome, { p: [fx0, hy, sz * .3], r: [Math.PI / 2, 0, 0] });
      k.add(g, k.sphere(.05), k.ceramic('#ffffff'), { p: [fx0, hy + .035, sz * .3] });
    }
    k.add(g, k.tube([[fx0, base + .22, -.3], [fx0, base + .22, .3]], .035), chrome);
    k.add(g, k.tube([[fx0, base + .22, 0], [fx0, base + .55, 0], [fx0 + .1, base + .75, 0], [fx0 + .3, base + .8, 0], [fx0 + .5, base + .7, 0], [fx0 + .6, base + .5, 0]], .05, { caps: true, seg: 48 }), chrome);
    g.userData.view = { az: 30, el: 22 };
    g.userData.fullView = { el: 20 };
    return g;
  },

  // A sleek one-piece smart toilet: skirted bowl, lid up, a glowing bowl and a side panel full of settings.
  smarttoilet(k) {
    const g = k.group(), N = 112;
    const white = k.ceramic('#fbfbfa'), seatMat = k.gloss('#ffffff'), chrome = k.chrome();
    // plan: an elongated oval in front, squarer at the back where it meets the tank
    const hw = .74, bf = 1.3, bb = .92;
    const eg = (t, d) => {
      const s = Math.sin(t), c = Math.cos(t);
      if (c >= 0) return [(hw + d) * s, (bf + d) * c];
      return [(hw + d) * Math.sign(s) * Math.abs(s) ** (2 / 3.4), -(bb + d) * Math.abs(c) ** (2 / 3.4)];
    };
    const ring = (d, y) => { const r = []; for (let i = 0; i < N; i++) { const [x, z] = eg(i / N * k.TAU, d); r.push([x, y, z]); } return r; };
    const outline = d => { const pts = []; for (let i = 0; i < N; i++) pts.push(eg(i / N * k.TAU, d)); return outlineShape(k, pts); };
    const prof = [[-.07, 0], [-.06, .06], [-.05, .3], [-.035, .7], [-.015, 1.0], [0, 1.12], [-.006, 1.2], [-.035, 1.25], [-.1, 1.27], [-.2, 1.26], [-.25, 1.2], [-.31, 1.08], [-.4, .95], [-.49, .84], [-.55, .78]];
    k.add(g, loft(k, prof.map(([d, y]) => ring(d, y))), white);
    k.add(g, cap(k, ring(-.07, 0), false), white);
    k.add(g, cap(k, ring(-.52, .81)), k.glow('#7fe6ff', .8));                    // lit water
    k.add(g, k.box(1.5, 1.85, .72, .26), white, { p: [0, .925, -1.0] });          // the low tank
    k.add(g, k.rcyl(.15, .05, .02, { seg: 32 }), chrome, { p: [.44, 1.85, -1.0] }); // flush button
    // the seat, its electronics housing, and the lid standing up
    k.add(g, k.extrude(outline(-.02), .05, { bevel: .025, holes: [outline(-.22)] }), seatMat, { p: [0, 1.32, 0], r: [Math.PI / 2, 0, 0] });
    // the seat's electronics: a glossy charcoal housing with a chrome line and a status light
    const tech = k.gloss('#2a2f3a');
    k.add(g, k.box(1.52, .2, .44, .09), tech, { p: [0, 1.42, -.66] });
    k.add(g, k.box(1.3, .02, .02, .008), chrome, { p: [0, 1.47, -.435] });
    k.add(g, k.box(.36, .035, .02, .012), k.glow('#5fd8ff', 1.8), { p: [0, 1.39, -.435] });
    const lid = k.group([], { p: [0, 1.53, -.52], r: [-1.8, 0, 0] });
    k.add(lid, k.extrude(outline(-.03), .05, { bevel: .025 }), tech, { p: [0, .05, .92], r: [Math.PI / 2, 0, 0] });
    g.add(lid);
    // the side arm with its control panel, lit up
    k.add(g, k.box(.2, .15, .95, .07), tech, { p: [.86, 1.37, -.3] });
    g.add(k.decal(.15, .86, (c, w, h) => {
      c.fillStyle = '#141925'; c.beginPath(); c.roundRect(0, 0, w, h, w * .3); c.fill();
      c.fillStyle = '#5fd8ff'; c.beginPath(); c.roundRect(w * .15, h * .05, w * .7, h * .16, 6); c.fill();     // little screen
      const cols = ['#ffffff', '#7dffb0', '#ffb04a', '#ff6fa8'];
      cols.forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(w / 2, h * (.33 + i * .18), w * .2, 0, 7); c.fill(); });
    }, { px: 64, p: [.86, 1.447, -.3], r: [-Math.PI / 2, 0, 0], glow: 1.3 }));
    // a night light round the base
    k.add(g, k.tube(ring(-.066, .05), .016, { closed: true, seg: 160, rs: 8 }), k.glow('#5fd8ff', 1.4), { shadow: false });
    g.userData.view = { az: 32, el: 32 };
    g.userData.fullView = { el: 24 };
    return g;
  },
};
