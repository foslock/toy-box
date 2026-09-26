// Models for the laundry cards. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

// ---- local helpers ----
// A skin through closed rings of points (each ring [[x, y, z], ...], all the same length, going round from +z towards +x
// seen from above). u runs round the rings, v from the first ring to the last (by distance). Faces point out of the
// solid while the rings climb and into the hollow when they come back down.
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
// Rings for a soft pillow shape on a rounded-rectangle plan: flat bottom, round sides (radius r), top domed by `dome`.
function pillowRings(hw, hd, rc, H, r, dome, N) {
  const prof = [[.4, -r, 0], [.75, -r, 0]];
  for (let a = -90; a <= 90; a += 15) { const q = a * Math.PI / 180; prof.push([1, -r * (1 - Math.cos(q)), H / 2 + H / 2 * Math.sin(q)]); }
  for (const [s, f] of [[.92, .35], [.78, .7], [.56, .9], [.32, 1]]) prof.push([s, -r, H + dome * f]);
  return prof.map(([s, d, y]) => { const ring = []; for (let i = 0; i < N; i++) { const [x, z] = rrPt(hw + d, hd + d, rc + d, i / N); ring.push([x * s, y, z * s]); } return ring; });
}
// A tube along a smooth path whose radius changes along it: r(t) for t in 0..1, a number or [across, up] for an oval.
function sweep(k, pts, r, o = {}) {
  const T = k.THREE, curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p)));
  const S = o.seg ?? 64, M = o.rs ?? 24, fr = curve.computeFrenetFrames(S, false), rings = [];
  for (let j = 0; j <= S; j++) {
    const t = j / S, c = curve.getPointAt(t), N = fr.normals[j], B = fr.binormals[j], rr = r(t), [rx, ry] = Array.isArray(rr) ? rr : [rr, rr], ring = [];
    for (let i = 0; i < M; i++) {
      const a = i / M * Math.PI * 2, ca = Math.cos(a) * rx, sa = Math.sin(a) * ry;
      ring.push([c.x + N.x * ca + B.x * sa, c.y + N.y * ca + B.y * sa, c.z + N.z * ca + B.z * sa]);
    }
    rings.push(ring);
  }
  return loft(k, rings, o);
}
// Gold scrollwork for the sewing machine's decals: a spiral curl at (x, y), radius r, turning dir (±1).
function curl(c, x, y, r, a0, dir) {
  c.beginPath();
  for (let i = 0; i <= 60; i++) { const t = i / 60 * Math.PI * 2.6, rr = r * (1 - t / (Math.PI * 3.1)), a = a0 + t * dir; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.stroke();
}
function leaf(c, x, y, len, a) { c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.ellipse(len / 2, 0, len / 2, len / 5, 0, 0, 7); c.fill(); c.restore(); }

export default {
  // A classic wooden spring clothespin resting on its side, so its profile (jaws, bite, spring) faces us.
  clothespin(k) {
    const g = k.group(), T = k.THREE, lift = .4, p = k.group([], { p: [0, lift, 0] });
    g.add(p);
    const grain = k.tex(512, 512, (c, w, h) => {
      c.fillStyle = '#e9c48e'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        const y0 = k.rand() * h, a = 1 + k.rand() * 3, ph = k.rand() * 6;
        c.strokeStyle = `rgba(160,100,50,${.08 + k.rand() * .14})`; c.lineWidth = .8 + k.rand() * 1.4; c.beginPath();
        for (let x = 0; x <= w; x += 8) { const y = y0 + Math.sin(x / w * Math.PI * 4 + ph) * a; x ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
      }
    }, { repeat: [1, 1] });
    const wood = k.mat({ map: grain, roughness: .55, clearcoat: .2, clearcoatRoughness: .3 });
    // one prong's side profile (sg = 1 the back one, -1 the front one): the jaw with its bite, the notch for the spring, the handle
    const prong = sg => {
      const s = new T.Shape(), y = v => v * sg;
      s.moveTo(0, y(.03)); s.lineTo(.3, y(.03));
      s.absarc(.42, y(.03), .1, Math.PI, sg > 0 ? 0 : Math.PI * 2, sg > 0);
      s.lineTo(1.18, y(.03));
      s.absarc(1.34, y(.03), .16, Math.PI, sg > 0 ? 0 : Math.PI * 2, sg > 0);
      s.lineTo(1.56, y(.045)); s.lineTo(3.12, y(.17));
      s.quadraticCurveTo(3.22, y(.18), 3.2, y(.26)); s.lineTo(3.17, y(.33));
      s.lineTo(2.0, y(.365)); s.lineTo(1.0, y(.36)); s.lineTo(.35, y(.31)); s.lineTo(.02, y(.24));
      s.quadraticCurveTo(-.03, y(.14), 0, y(.03));
      return s;
    };
    for (const sg of [1, -1]) k.add(p, k.extrude(prong(sg), .3, { bevel: .035, curve: 16 }), wood);
    // the steel spring: a coil through the notches (seen end on), its legs pressing along the outside of each prong
    const coil = [];
    for (let i = 0; i <= 140; i++) { const t = i / 140, a = t * 3.5 * k.TAU + Math.PI; coil.push([1.34 + Math.sin(a) * .135, Math.cos(a) * .135, -.15 + t * .3]); }
    const low = [[.6, -.33, -.15], [.7, -.395, -.15], [1.0, -.4, -.15], [1.2, -.32, -.15]];
    const high = [[1.2, .32, .15], [1.0, .4, .15], [.7, .395, .15], [.6, .33, .15]];
    k.add(p, k.tube([...low, ...coil, ...high], .032, { seg: 420, rs: 8, caps: true }), k.metal('#c4cad2', .22));
    g.userData.view = { az: 16, el: 22 };
    return g;
  },

  // A lint roller: a roll of sticky sheets (with some cat fur on it) and a blue handle.
  lintroller(k) {
    const g = k.group(), T = k.THREE;
    const L = 2.6, R = .62, rc = .36;
    const blue = k.gloss('#3a6ff0'), grip = k.plastic('#9cc0ff', { rough: .55, coat: .2 });
    const paper = k.tex(512, 512, (c, w, h) => {
      c.fillStyle = '#f7f5ee'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(120,120,140,.35)'; c.lineWidth = 3;                // the spiral cut between sheets
      for (let i = -3; i < 5; i++) { c.beginPath(); c.moveTo(0, i * h / 2.2); c.lineTo(w, (i + 1) * h / 2.2); c.stroke(); }
      for (let i = 0; i < 80; i++) {                                              // fur and fluff it has picked up
        const x = k.rand() * w, y = k.rand() * h, a = k.rand() * 7, l = 12 + k.rand() * 28;
        c.strokeStyle = k.pick(['rgba(90,90,95,.75)', 'rgba(232,148,60,.8)', 'rgba(60,60,60,.65)', 'rgba(190,190,198,.85)']); c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * .6 + 6, y + Math.sin(a) * l * .6, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
      }
    });
    k.add(g, k.cyl(R, R, L, { open: true, seg: 64 }), k.plastic('#ffffff', { map: paper, rough: .42, coat: .35 }), { p: [0, R, 0], r: [0, 0, Math.PI / 2] });
    // the used top sheet, peeling up off the roll
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= 24; i++) {
      const s = i / 24, th = (28 + 58 * s) * Math.PI / 180, rr = R + .006 + .22 * s * s;
      pos.push(-L / 2 + .02, R + rr * Math.sin(th), rr * Math.cos(th), L / 2 - .02, R + rr * Math.sin(th), rr * Math.cos(th));
      uv.push(0, s * .3, 1, s * .3);
      if (i < 24) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const flap = new T.BufferGeometry();
    flap.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); flap.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    flap.setIndex(idx); flap.computeVertexNormals();
    k.add(g, flap, k.plastic('#ffffff', { map: paper, rough: .42, coat: .35, side: T.DoubleSide }));
    const ends = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#f4f2ea'; c.fillRect(0, 0, w, h);
      for (let r = rc / R * w / 2; r < w / 2; r += 3) { c.strokeStyle = `rgba(120,120,130,${.06 + k.rand() * .1})`; c.beginPath(); c.arc(w / 2, h / 2, r, 0, 7); c.stroke(); }
    });
    for (const sx of [-1, 1]) k.add(g, k.ring(rc, R, 64), k.matte('#ffffff', .6, { map: ends }), { p: [sx * L / 2, R, 0], r: [0, sx * Math.PI / 2, 0] });
    k.add(g, k.cyl(rc + .02, rc + .02, .1, { seg: 40 }), blue, { p: [L / 2 + .02, R, 0], r: [0, 0, Math.PI / 2] });     // core caps
    k.add(g, k.cyl(.16, .16, .1, { seg: 24 }), grip, { p: [L / 2 + .07, R, 0], r: [0, 0, Math.PI / 2] });
    k.add(g, k.cyl(rc + .05, rc + .05, .16, { seg: 40 }), blue, { p: [-L / 2 - .05, R, 0], r: [0, 0, Math.PI / 2] });
    // the handle: a neck out of the end cap, swelling into a chunky grip with a rubber section
    const x0 = -L / 2 - .1, hp = [[x0, R, 0], [x0 - .22, R + .02, 0], [x0 - .45, R + .25, 0], [x0 - .65, R + .7, 0], [x0 - .9, R + 1.4, 0], [x0 - 1.2, R + 2.3, 0], [x0 - 1.36, R + 2.8, 0]];
    const hr = t => t < .22 ? .13 : t < .42 ? .13 + (t - .22) / .2 * .14 : .27;
    const gripTex = k.tex(64, 512, (c, w, h) => {
      c.fillStyle = '#3a6ff0'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#9cc0ff'; c.fillRect(0, h * .1, w, h * .38);
      c.fillStyle = 'rgba(40,70,160,.45)'; for (let y = h * .13; y < h * .46; y += 16) c.fillRect(0, y, w, 5);
    });
    k.add(g, sweep(k, hp, hr, { seg: 80, rs: 24 }), k.plastic('#ffffff', { map: gripTex, rough: .3, coat: .8, coatRough: .1 }));
    k.add(g, k.sphere(.27, { w: 24, h: 16 }), blue, { p: hp[hp.length - 1] });
    g.userData.view = { az: 34, el: 22 };
    return g;
  },

  // A squishy laundry pod: a big swirled violet chamber under two little ones, sealed in shiny film.
  pod(k) {
    const g = k.group(), N = 96;
    const H = .74, hw = .88, hd = .88, rc = .58, r = .34;
    const swirl = k.tex(512, 256, (c, w, h) => {
      c.fillStyle = '#6b3cf5'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) {
        c.strokeStyle = i % 2 ? 'rgba(255,255,255,.9)' : 'rgba(176,146,255,.85)'; c.lineWidth = 5 + k.rand() * 12; c.lineCap = 'round'; c.beginPath();
        const y0 = k.rand() * h, a = 15 + k.rand() * 35, ph = k.rand() * 7, f = 1 + Math.floor(k.rand() * 3);
        for (let x = 0; x <= w; x += 6) { const y = y0 + Math.sin(x / w * Math.PI * 2 * f + ph) * a; x ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
      }
    });
    const rings = pillowRings(hw, hd, rc, H, r, .1, N);
    const base = k.mat({ map: swirl, roughness: .12, clearcoat: 1, clearcoatRoughness: .04 });
    k.add(g, loft(k, rings), base);
    k.add(g, cap(k, rings[0], false), base);
    k.add(g, cap(k, rings[rings.length - 1]), base);
    // the two little top chambers: soft pillows side by side, pressed together along a seam
    for (const [sx, col] of [[-1, '#1ccdb8'], [1, '#ffc53a']]) {
      const cr = pillowRings(.3, .5, .26, .14, .07, .07, 64).map(ring => ring.map(([x, y, z]) => [x + sx * .33, y + H - .06, z + .02]));
      const m = k.gloss(col);
      k.add(g, loft(k, cr), m);
      k.add(g, cap(k, cr[cr.length - 1]), m);
    }
    // the clear film seal round its middle
    const film = k.glass('#ffffff', { opacity: .5, env: 2.4 });
    k.add(g, k.extrude(k.roundRect(2 * hw + .16, 2 * hd + .16, rc + .08), .012, { bevel: .006, holes: [k.roundRect(2 * hw - .06, 2 * hd - .06, rc - .03)] }), film, { p: [0, H / 2, 0], r: [-Math.PI / 2, 0, 0], shadow: false });
    g.userData.view = { az: 30, el: 40 };
    g.userData.fullView = { el: 30 };
    return g;
  },

  // A wooden spool of red thread, its loose end trailing onto the counter.
  thread(k) {
    const g = k.group();
    const wood = k.wood('maple', { varnish: .4 });
    const fl = .22, bh = 1.56, Rf = .95, Rb = .8;
    const tex = k.tex(256, 512, (c, w, h) => {
      c.fillStyle = '#e0432f'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 3) { c.fillStyle = `rgba(0,0,0,${.08 + k.rand() * .12})`; c.fillRect(0, y, w, 1); }
      for (let y = 1; y < h; y += 6) { c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(0, y, w, 1); }
    });
    const threadMat = k.mat({ map: tex, roughness: .65, sheen: .7, sheenColor: '#ffb3a6', sheenRoughness: .5 });
    k.add(g, k.rcyl(Rf, fl, .07), wood);
    k.add(g, k.rcyl(Rf, fl, .07), wood, { p: [0, fl + bh, 0] });
    k.add(g, k.lathe([[Rb - .04, fl], [Rb + .01, fl + .1], [Rb + .035, fl + bh / 2], [Rb + .01, fl + bh - .1], [Rb - .04, fl + bh]], { smooth: true, seg: 64 }), threadMat);
    g.add(k.decal(1.3, 1.3, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.fillStyle = '#fbf6ea'; c.beginPath(); c.arc(w / 2, h / 2, w * .4, 0, 7); c.fill();
      c.strokeStyle = '#e0432f'; c.lineWidth = 7; c.beginPath(); c.arc(w / 2, h / 2, w * .36, 0, 7); c.stroke();
      k.text(c, '250 YD', w / 2, h * .27, { size: 34, color: '#8a2a1e' });
      k.text(c, 'COTTON', w / 2, h * .74, { size: 28, color: '#8a2a1e' });
      c.fillStyle = '#3a2615'; c.beginPath(); c.arc(w / 2, h / 2, w * .12, 0, 7); c.fill();       // the hole
    }, { px: 256, p: [0, 2 * fl + bh + .003, 0], r: [-Math.PI / 2, 0, 0] }));
    const a = .75, px = Math.sin(a), pz = Math.cos(a);
    const pts = [[px * (Rb + .04), 1.25, pz * (Rb + .04)], [px * (Rb + .07), .7, pz * (Rb + .07)], [px * (Rf + .03), fl + .02, pz * (Rf + .03)], [px * (Rf + .16), .05, pz * (Rf + .2)], [px * 1.35, .03, pz * 1.55], [1.05, .03, 1.95], [.6, .03, 1.85], [.62, .03, 1.52], [.92, .03, 1.58]];
    k.add(g, k.tube(pts, .028, { seg: 140, rs: 8, caps: true }), k.mat({ color: '#e0432f', roughness: .6, sheen: .6, sheenColor: '#ffb3a6' }));
    g.userData.view = { az: 28, el: 24 };
    return g;
  },

  // A blue plastic laundry basket with slotted sides and handle holes, heaped with clothes.
  basket(k) {
    const g = k.group(), T = k.THREE, N = 160;
    const top = [2.4, 1.7, .6], bot = [2.08, 1.42, .45], Hr = 2.05;
    const ringAt = (f, y, d = 0) => {
      const hw = bot[0] + (top[0] - bot[0]) * f + d, hd = bot[1] + (top[1] - bot[1]) * f + d, rc = bot[2] + (top[2] - bot[2]) * f + d, r = [];
      for (let i = 0; i < N; i++) { const [x, z] = rrPt(hw, hd, rc, i / N); r.push([x, y, z]); }
      return r;
    };
    const rings = [ringAt(0, 0, -.1), ringAt(0, .05, -.03)];
    for (let j = 0; j <= 10; j++) { const f = j / 10; rings.push(ringAt(f, .14 + f * (Hr - .14))); }
    const holes = k.tex(2048, 512, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#000000';
      const P = 15.4;
      const slot = (u, v0, v1, ww) => { const pw = ww / P * w; c.beginPath(); c.roundRect(u * w - pw / 2, (1 - v1) * h, pw, (v1 - v0) * h, pw / 2); c.fill(); };
      for (let i = 0; i < 44; i++) {
        const u = (i + .5) / 44, nearHandle = Math.min(Math.abs(u - .25), Math.abs(u - .75)) < .07;
        slot(u, .2, .5, .13);
        if (!nearHandle) slot(u, .57, .84, .13);
      }
      for (const u of [.25, .75]) { const pw = 1.2 / P * w; c.beginPath(); c.roundRect(u * w - pw / 2, .1 * h, pw, .2 * h, 30); c.fill(); }   // handle holes
    }, { data: true });
    const plastic = k.plastic('#3d7bf5', { rough: .4, coat: .3, side: T.DoubleSide, alphaMap: holes, alphaTest: .5 });
    k.add(g, loft(k, rings), plastic);
    const solid = k.plastic('#3d7bf5', { rough: .4, coat: .3 });
    k.add(g, cap(k, rings[0], false), solid);
    const rim = [];
    for (let a = 0; a <= 360; a += 30) { const q = a * Math.PI / 180; rim.push(ringAt(1, Hr + .05 + Math.sin(q) * .09, .04 + Math.cos(q) * .09)); }
    k.add(g, loft(k, rim), solid);
    // the laundry: folded layers inside (seen through the slots) and a heap on top
    const cloth = c => k.fabric(c, { scale: .6 });
    k.add(g, k.box(4.0, .6, 2.7, .25), cloth('#34507a'), { p: [0, .46, 0] });
    k.add(g, k.box(4.15, .6, 2.85, .27), cloth('#ffc94d'), { p: [0, 1.05, 0] });
    k.add(g, k.box(4.3, .6, 3.0, .28), cloth('#f3f1ec'), { p: [0, 1.65, 0] });
    k.add(g, k.box(2.0, .42, 1.5, .2), cloth('#ff8fa3'), { p: [-.85, 2.14, .1], r: [0, .12, .03] });
    k.add(g, k.box(1.8, .38, 1.4, .18), cloth('#6fdcb8'), { p: [.9, 2.1, -.25], r: [0, -.18, -.02] });
    k.add(g, k.box(1.5, .32, 1.2, .16), cloth('#b99cff'), { p: [.05, 2.48, .15], r: [0, .32, .02] });
    // a towel flopped over the front rim, with a band across its end
    const band = k.tex(64, 256, (c, w, h) => { c.fillStyle = '#ff8fa3'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff4ea'; c.fillRect(0, h * .1, w, h * .08); c.fillRect(0, h * .22, w, h * .03); });
    const drape = k.fabric('#ffffff', { weave: false }); drape.side = T.DoubleSide;
    drape.map = band;
    k.add(g, sweep(k, [[-1.0, 1.9, .5], [-1.0, 2.22, 1.0], [-1.0, 2.38, 1.5], [-1.0, 2.3, 1.84], [-1.0, 2.08, 1.91], [-1.0, 1.7, 1.8], [-1.0, 1.25, 1.73]], () => [.06, .44], { seg: 56, rs: 16 }), drape);
    g.userData.view = { az: 30, el: 26 };
    g.userData.fullView = { el: 20 };
    return g;
  },

  // A steam iron: a polished soleplate, a white body with a violet water tank, and a puff of steam.
  iron(k) {
    const g = k.group(), T = k.THREE;
    const sole = .14;
    const w = x => Math.max(.02, x < -1.2 ? .65 * Math.sqrt(Math.max(0, 1 - ((-1.2 - x) / .3) ** 2)) : x <= -.3 ? .65 : .65 * Math.sqrt(Math.max(0, 1 - ((x + .3) / 2.0) ** 2.2)));
    const prof = new T.SplineCurve([[-1.5, .6], [-1.3, .84], [-1.0, .9], [-.4, .88], [.2, .8], [.8, .6], [1.3, .36], [1.7, .07]].map(([a, b]) => new T.Vector2(a, b))).getPoints(80);
    const hgt = x => { for (let i = 1; i < prof.length; i++) if (x <= prof[i].x) { const a = prof[i - 1], b = prof[i], t = (x - a.x) / (b.x - a.x || 1); return a.y + (b.y - a.y) * t; } return .06; };
    // body: rings along x, each a rounded cross-section (flatter underneath)
    const M = 48, xs = [];
    for (let j = 0; j <= 36; j++) xs.push(-1.5 + 3.2 * (1 - Math.cos(Math.PI * j / 36)) / 2);
    const ringX = x => {
      const W = w(x), hh = Math.max(.03, hgt(x)) / 2, yc = sole + hh, r = [];
      for (let i = 0; i < M; i++) {
        const t = i / M * k.TAU, s = Math.sin(t), c = Math.cos(t), n = c > 0 ? 2.3 : 5;
        r.push([x, yc + hh * Math.sign(c) * Math.abs(c) ** (2 / n), W * Math.sign(s) * Math.abs(s) ** (2 / n)]);
      }
      return r;
    };
    const split = xs.findIndex(x => x > .25);
    const white = k.gloss('#f6f6fa'), violet = k.gloss('#7b5cf6');
    k.add(g, loft(k, xs.slice(0, split + 1).map(ringX)), white);
    k.add(g, loft(k, xs.slice(split).map(ringX)), k.mat({ color: '#9b80ff', roughness: .08, clearcoat: 1, clearcoatRoughness: .03, transparent: true, opacity: .82 }));
    // soleplate
    const plan = [];
    for (let i = 0; i <= 60; i++) { const x = -1.5 + 3.22 * i / 60; plan.push([x, w(x) + .05]); }
    for (let i = 60; i >= 0; i--) { const x = -1.5 + 3.22 * i / 60; plan.push([x, -(w(x) + .05)]); }
    const ps = new T.Shape(); plan.forEach(([x, z], i) => i ? ps.lineTo(x, z) : ps.moveTo(x, z));
    k.add(g, k.extrude(ps, .1, { bevel: .03 }), k.metal('#e4e7ec', .14), { p: [0, .08, 0], r: [Math.PI / 2, 0, 0] });
    // handle, dial, buttons
    const hp = [[.66, sole + hgt(.66) - .05, 0], [.48, 1.45, 0], [.12, 1.72, 0], [-.5, 1.78, 0], [-1.0, 1.64, 0], [-1.18, 1.3, 0], [-1.22, sole + hgt(-1.22) - .05, 0]];
    k.add(g, k.tube(hp, .17, { seg: 64, rs: 16 }), white, { s: [1, 1, .85] });
    const dial = k.knob(.26, .1, violet, k.matte('#ffffff', .4));
    dial.position.set(-.3, sole + hgt(-.3) - .02, 0); dial.rotation.z = .08; g.add(dial);
    const hc = new T.CatmullRomCurve3(hp.map(q => new T.Vector3(...q)));
    for (const [t, r] of [[.17, .1], [.25, .085]]) { const q = hc.getPointAt(t); k.add(g, k.sphere(r), violet, { p: [q.x, q.y + .15, 0], s: [1, .6, 1] }); }
    k.add(g, k.cyl(.05, .07, .08, { seg: 16 }), k.matte('#3a3f4a', .5), { p: [1.52, sole + hgt(1.52) - .02, 0], r: [0, 0, -1.2] });   // spray nozzle
    // cord out of the heel on a swivel
    k.add(g, k.sphere(.14), k.plastic('#d9d9e2', { rough: .4 }), { p: [-1.52, .5, 0] });
    g.add(k.cord([[-1.55, .5, 0], [-1.85, .4, 0], [-2.05, .1, .1], [-2.3, .07, .45], [-2.05, .07, .82], [-1.6, .07, .78]], .055, '#e9e9f0'));
    // steam
    const steam = k.mat({ color: '#ffffff', transparent: true, opacity: .45, roughness: 1, emissive: '#ffffff', emissiveIntensity: .5, depthWrite: false });
    for (const [x, z, s] of [[1.66, .25, 1], [1.95, -.1, -1], [1.4, .58, -1]]) {
      k.add(g, k.tube([[x, .12, z], [x + .15 * s, .45, z], [x - .1 * s, .8, z], [x + .12 * s, 1.15, z]], .065, { caps: true }), steam, { shadow: false });
    }
    g.userData.view = { az: 30, el: 16 };
    return g;
  },

  // A big blue jug of Mountain Fresh laundry detergent with a measuring cap.
  detergent(k) {
    const g = k.group(), T = k.THREE;
    const s = new T.Shape();
    s.moveTo(-.52, 0); s.lineTo(.5, 0); s.quadraticCurveTo(.6, 0, .6, .12); s.lineTo(.6, 2.02); s.quadraticCurveTo(.6, 2.24, .42, 2.26); s.lineTo(.08, 2.28);
    s.quadraticCurveTo(0, 2.28, 0, 2.38); s.lineTo(0, 2.5); s.quadraticCurveTo(0, 2.62, -.12, 2.62); s.lineTo(-.52, 2.62); s.quadraticCurveTo(-.64, 2.62, -.64, 2.5);
    s.lineTo(-.64, .12); s.quadraticCurveTo(-.64, 0, -.52, 0);
    const hole = new T.Path(), hx0 = -.5, hx1 = -.14, hy0 = 1.95, hy1 = 2.47, hr = .15;
    hole.moveTo(hx0 + hr, hy0); hole.lineTo(hx1 - hr, hy0); hole.quadraticCurveTo(hx1, hy0, hx1, hy0 + hr); hole.lineTo(hx1, hy1 - hr); hole.quadraticCurveTo(hx1, hy1, hx1 - hr, hy1);
    hole.lineTo(hx0 + hr, hy1); hole.quadraticCurveTo(hx0, hy1, hx0, hy1 - hr); hole.lineTo(hx0, hy0 + hr); hole.quadraticCurveTo(hx0, hy0, hx0 + hr, hy0);
    s.holes.push(hole);
    const geo = new T.ExtrudeGeometry(s, { depth: 1.66, bevelEnabled: true, bevelThickness: .14, bevelSize: .07, bevelSegments: 5, curveSegments: 24 });
    geo.translate(0, 0, -.83);
    k.add(g, geo, k.gloss('#1f8fff'), { r: [0, -Math.PI / 2, 0] });
    // the label
    g.add(k.decal(1.5, 1.46, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.save(); c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 40); c.clip();
      const sky = c.createLinearGradient(0, 0, 0, h * .6); sky.addColorStop(0, '#bfe6ff'); sky.addColorStop(1, '#ffffff');
      c.fillStyle = sky; c.fillRect(0, 0, w, h);
      const peak = (x, y, s, col) => {
        c.fillStyle = col; c.beginPath(); c.moveTo(x - s, h * .56); c.lineTo(x, y); c.lineTo(x + s, h * .56); c.fill();
        c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x - s * .32, y + (h * .56 - y) * .32); c.lineTo(x, y); c.lineTo(x + s * .32, y + (h * .56 - y) * .32);
        c.lineTo(x + s * .12, y + (h * .56 - y) * .26); c.lineTo(x, y + (h * .56 - y) * .36); c.lineTo(x - s * .14, y + (h * .56 - y) * .27); c.fill();
      };
      peak(w * .3, h * .2, w * .3, '#5b6fd6'); peak(w * .68, h * .12, w * .36, '#3f4fb8');
      c.fillStyle = '#4cc27a'; c.beginPath(); c.moveTo(0, h * .6); c.quadraticCurveTo(w * .3, h * .48, w * .6, h * .58); c.quadraticCurveTo(w * .8, h * .52, w, h * .56); c.lineTo(w, h); c.lineTo(0, h); c.fill();
      c.fillStyle = '#ffffff'; c.fillRect(0, h * .62, w, h);
      c.restore();
      k.text(c, 'MOUNTAIN', w / 2, h * .7, { size: 50, weight: 700, color: '#1d3f9e' });
      k.text(c, 'FRESH', w / 2, h * .83, { size: 84, weight: 700, color: '#1f8fff', stroke: '#1d3f9e', strokeWidth: 6 });
      c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(w * .82, h * .36, 50, 0, 7); c.fill();
      k.text(c, '64', w * .82, h * .34, { size: 40, weight: 700, color: '#1d3f9e' });
      k.text(c, 'LOADS', w * .82, h * .41, { size: 17, weight: 700, color: '#1d3f9e' });
    }, { px: 512, p: [0, 1.1, .675], coat: .6 }));
    // spout and a ribbed measuring cap
    k.add(g, k.cyl(.19, .21, .16, { seg: 32 }), k.gloss('#1f8fff'), { p: [0, 2.4, .28] });
    const ribs = k.tex(256, 32, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,.12)'; for (let x = 0; x < w; x += 8) c.fillRect(x, 0, 3, h); });
    k.add(g, k.lathe([[0, 0], [.3, 0], [.32, .04], [.32, .38], [.3, .42], [0, .42]], { seg: 48 }), k.gloss('#ffffff', { map: ribs }), { p: [0, 2.44, .28] });
    g.userData.view = { az: 28, el: 14 };
    return g;
  },

  // A white front-loading washing machine, the round door showing clothes and suds going round.
  washer(k) {
    const g = k.group(), T = k.THREE;
    const W = 2.7, H = 3.7, D = 2.9, y0 = .1, F = D / 2;
    const white = k.gloss('#fbfbfd'), chrome = k.chrome(), panel = k.gloss('#e6e9ef');
    k.add(g, k.box(W, H, D, .14), white, { p: [0, y0 + H / 2, 0] });
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.add(g, k.cyl(.1, .12, .12, { seg: 16 }), k.rubber('#2b2b30'), { p: [x * (W / 2 - .25), .06, z * (D / 2 - .3)] });
    // control panel: drawer, display, buttons, program dial
    const cy = y0 + H - .46;
    k.add(g, k.slab(W - .16, .72, .06, .1), panel, { p: [0, cy, F + .005] });
    k.add(g, k.slab(.85, .44, .06, .06), white, { p: [-.78, cy, F + .05] });
    k.add(g, k.slab(.5, .07, .03, .03), k.matte('#9aa2ad', .5), { p: [-.78, cy - .14, F + .085] });
    k.add(g, k.slab(.6, .28, .03, .05), k.gloss('#1a1f2b'), { p: [.18, cy + .06, F + .045] });
    g.add(k.decal(.54, .22, (c, w, h) => {
      c.fillStyle = '#1a1f2b'; c.fillRect(0, 0, w, h);
      k.text(c, '0:42', w * .42, h * .54, { size: 64, weight: 600, color: '#5fe3ff', font: 'Nunito, sans-serif' });
      c.fillStyle = '#ffb347'; c.beginPath(); c.arc(w * .85, h * .5, 9, 0, 7); c.fill();
    }, { px: 256, p: [.18, cy + .06, F + .062], glow: 1.2 }));
    for (const x of [.0, .18, .36]) k.add(g, k.slab(.13, .07, .04, .03), k.gloss('#c9ced8'), { p: [x, cy - .18, F + .05] });
    const knob = k.knob(.19, .12, k.gloss('#f4f5f8'), k.matte('#6b7380', .5));
    knob.rotation.x = Math.PI / 2; knob.position.set(.88, cy, F + .03); g.add(knob);
    k.add(g, k.torus(.215, .025, { rs: 10, ts: 48 }), chrome, { p: [.88, cy, F + .04] });
    g.add(k.instances(k.sphere(.022, { w: 10, h: 8 }), k.glow('#5fe3ff', 2), Array.from({ length: 9 }, (_, i) => { const a = -2.2 + i * .55; return { p: [.88 + Math.sin(a) * .29, cy + Math.cos(a) * .29, F + .04] }; })));
    // the door
    const dc = [0, y0 + 1.55, F];
    const door = k.group([], { p: dc });
    g.add(door);
    k.add(door, k.lathe([[1.08, 0], [1.1, .1], [1.07, .22], [.99, .29], [.84, .3], [.78, .27], [.74, .18], [.72, .04]], { seg: 72 }), k.gloss('#f2f3f6'), { r: [Math.PI / 2, 0, 0] });
    k.add(door, k.torus(.86, .03, { rs: 10, ts: 64 }), chrome, { p: [0, 0, .3] });
    k.add(door, k.torus(.72, .06, { rs: 12, ts: 64 }), k.rubber('#50555f'), { p: [0, 0, .05] });
    k.add(door, k.box(.12, .5, .1, .05), k.gloss('#d5d9e0'), { p: [.98, 0, .28] });                 // handle
    const drum = k.painted(512, 512, (c, w, h) => {
      const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, '#3a414c'); gr.addColorStop(1, '#161a20');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(200,210,225,.35)';
      for (let y = 12; y < h; y += 26) for (let x = 12 + (y / 26 % 2) * 13; x < w; x += 26) { c.beginPath(); c.arc(x, y, 4.5, 0, 7); c.fill(); }
      const water = c.createLinearGradient(0, h * .55, 0, h); water.addColorStop(0, 'rgba(90,190,255,.75)'); water.addColorStop(1, 'rgba(40,120,220,.85)');
      c.fillStyle = water; c.fillRect(0, h * .58, w, h);
    }, { rough: .35, metal: .4 });
    k.add(door, k.disc(.74, 64), drum, { p: [0, 0, .006] });
    const cloth = c => k.fabric(c, { scale: .4 });
    for (const [x, y, z, sx, sy, col, rz] of [[-.28, -.38, .1, .36, .2, '#ff6f7d', .3], [.26, -.44, .1, .34, .19, '#ffd166', -.2], [.02, -.2, .13, .3, .17, '#4f86f7', .1], [-.42, -.08, .08, .22, .14, '#ffffff', .8], [.42, -.1, .09, .2, .13, '#6fdcb8', -.6]]) {
      k.add(door, k.sphere(1, { w: 24, h: 16 }), cloth(col), { p: [x, y, z], s: [sx, sy, .1], r: [0, 0, rz] });
    }
    const suds = [];
    for (let i = 0; i < 26; i++) { const a = k.range(-2.6, 2.6), rr = k.range(.1, .6), s = k.range(.05, .12); suds.push({ p: [Math.sin(a) * rr, -.1 + Math.cos(a) * rr * .35 + k.range(-.05, .08), .14 + k.range(0, .08)], s }); }
    door.add(k.instances(k.sphere(1, { w: 14, h: 10 }), k.plastic('#ffffff', { rough: .3, coat: .4 }), suds));
    const Rg = 1.063, th = .769;
    k.add(door, k.sphere(Rg, { thetaLen: th, w: 64, h: 16 }), k.glass('#a9c9e0', { opacity: .26 }), { p: [0, 0, .05 - Rg * Math.cos(th)], r: [Math.PI / 2, 0, 0], shadow: false });
    // a little filter hatch down by the floor
    k.add(g, k.slab(.5, .3, .03, .06), k.gloss('#f0f1f4'), { p: [.92, y0 + .34, F + .01] });
    g.userData.view = { az: 18, el: 12 };
    return g;
  },

  // A round robot vacuum, bumper and side brush and a glowing button, with a ginger cat riding on top.
  robovac(k) {
    const g = k.group(), T = k.THREE;
    const R = 1.75, Hb = .46, top = .06 + Hb;
    const shell = k.gloss('#f5f5f8'), dark = k.gloss('#2a2e36'), glow = k.glow('#4fe0ff', 1.8);
    k.add(g, k.rcyl(R, Hb, .14), shell, { p: [0, .06, 0] });
    k.add(g, k.cyl(R * .96, R * .96, .08, { seg: 64 }), k.rubber('#26282d'), { p: [0, .04, 0] });
    k.add(g, k.cyl(R + .02, R + .02, .26, { open: true, start: -Math.PI * .58, len: Math.PI * 1.16, seg: 72 }), k.plastic('#3a3e46', { rough: .4, side: T.DoubleSide }), { p: [0, .25, 0] });
    k.add(g, k.rcyl(1.3, .03, .015, { seg: 64 }), dark, { p: [0, top - .01, 0] });
    k.add(g, k.rcyl(.19, .05, .02, { seg: 32 }), k.gloss('#e9ebef'), { p: [0, top, 1.02] });            // the button
    k.add(g, k.torus(.21, .02, { rs: 8, ts: 40 }), glow, { p: [0, top + .03, 1.02], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.rcyl(.36, .2, .06, { seg: 40 }), dark, { p: [0, top, -.98] });                          // lidar turret
    k.add(g, k.torus(.365, .018, { rs: 8, ts: 40 }), glow, { p: [0, top + .1, -.98], r: [Math.PI / 2, 0, 0] });
    // side brush poking out at the front right
    const hub = [1.15, .05, 1.12];
    k.add(g, k.cyl(.09, .09, .05, { seg: 16 }), k.gloss('#2a2e36'), { p: hub });
    for (const a of [.3, 2.4, 4.5]) k.add(g, k.cone(.09, .5, 12), k.matte('#b7bec8', .6), { p: [hub[0] + Math.sin(a) * .3, .05, hub[2] + Math.cos(a) * .3], r: [-Math.PI / 2 + .1, a, 0], order: 'YXZ' });
    // the cat in charge
    const cat = k.group([], { p: [0, top - .02, -.12], r: [0, .36, 0] });
    g.add(cat);
    const furTex = (paint) => k.tex(256, 128, (c, w, h) => { c.fillStyle = '#f29b44'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(190,90,20,.55)'; paint(c, w, h); });
    const headFur = k.mat({ roughness: .85, sheen: .6, sheenColor: '#ffd9a8', sheenRoughness: .6, map: furTex((c, w, h) => {
      for (const dx of [-9, 0, 9]) c.fillRect(w * .25 + dx - 2.5, h * .1, 5, h * .16);     // the tabby M
      for (const s of [-1, 1]) for (const dy of [0, 9]) c.fillRect(w * .25 + s * 30 - 8, h * .45 + dy, 16, 3.5);
    }) });
    const bodyFur = k.mat({ roughness: .85, sheen: .6, sheenColor: '#ffd9a8', sheenRoughness: .6, map: furTex((c, w, h) => {
      for (const u of [0, .5]) for (let i = 0; i < 4; i++) { c.save(); c.translate(w * (u + .02 + i * .045), h * .45); c.rotate(.2); c.fillRect(-3, -h * .2, 6, h * .4); c.restore(); }
    }) });
    const fur = k.mat({ color: '#f29b44', roughness: .85, sheen: .6, sheenColor: '#ffd9a8', sheenRoughness: .6 });
    const cream = k.mat({ color: '#fff4e6', roughness: .85, sheen: .5, sheenColor: '#ffffff', sheenRoughness: .6 });
    k.add(cat, k.sphere(.62, { w: 48, h: 32 }), bodyFur, { p: [0, .52, -.12], s: [1.05, .92, 1.12] });
    k.add(cat, k.sphere(.45, { w: 40, h: 28 }), cream, { p: [0, .92, .2], s: [.95, 1.15, .85] });
    k.add(cat, k.sphere(.48, { w: 48, h: 32 }), headFur, { p: [0, 1.52, .22], s: [1.12, .95, 1.0] });
    for (const sx of [-1, 1]) {
      k.add(cat, k.cone(.17, .34, 24), fur, { p: [sx * .27, 1.9, .16], r: [-.1, 0, -sx * .35] });
      k.add(cat, k.cone(.1, .2, 16), k.matte('#ff9fb0', .7), { p: [sx * .265, 1.86, .225], r: [-.1, 0, -sx * .35] });
      k.add(cat, k.sphere(.12, { w: 24, h: 16 }), cream, { p: [sx * .09, 1.42, .6] });                               // muzzle
      k.add(cat, k.sphere(.1, { w: 24, h: 16 }), k.gloss('#1f2a1a'), { p: [sx * .185, 1.6, .64], s: [1, 1.15, .6] }); // eyes
      k.add(cat, k.sphere(.03, { w: 10, h: 8 }), k.glow('#ffffff', 1.2), { p: [sx * .185 - .035, 1.645, .695] });
      k.add(cat, k.capsule(.1, .45, 8), fur, { p: [sx * .17, .38, .42] });                                           // front legs
      k.add(cat, k.sphere(.12, { w: 24, h: 16 }), cream, { p: [sx * .17, .08, .5], s: [1, .7, 1.2] });              // paws
    }
    k.add(cat, k.sphere(.05, { w: 16, h: 12 }), k.gloss('#ff7f93'), { p: [0, 1.5, .69], s: [1.2, .8, .8] });         // nose
    k.add(cat, k.tube([[-.3, .2, -.62], [-.62, .1, -.3], [-.66, .08, .15], [-.45, .08, .45], [-.15, .08, .6]], .1, { caps: true, seg: 40 }), fur);
    g.userData.view = { az: 30, el: 20 };
    return g;
  },

  // Grandma's vintage sewing machine: black enamel with gold scrollwork, on a walnut base.
  sewingmachine(k) {
    const g = k.group(), T = k.THREE;
    const black = k.gloss('#141416'), chrome = k.chrome(), zc = -.1, y0 = .66;
    k.add(g, k.box(4.4, .3, 2.05, .08), k.wood('walnut', { varnish: .8 }), { p: [0, .15, 0] });
    k.add(g, k.box(4.1, .36, 1.8, .06), black, { p: [0, .48, 0] });
    // the arm: pillar on the right, arm across the top, head on the left over the needle
    const s = new T.Shape();
    s.moveTo(.85, y0); s.lineTo(1.8, y0);
    s.bezierCurveTo(1.72, 1.2, 1.75, 1.9, 1.78, 2.3);
    s.bezierCurveTo(1.8, 2.7, 1.6, 2.86, 1.2, 2.86);
    s.bezierCurveTo(.4, 2.96, -.8, 2.96, -1.5, 2.82);
    s.bezierCurveTo(-1.8, 2.8, -1.85, 2.6, -1.85, 2.4);
    s.lineTo(-1.85, 1.35); s.quadraticCurveTo(-1.85, 1.2, -1.7, 1.2); s.lineTo(-1.2, 1.2); s.quadraticCurveTo(-1.08, 1.2, -1.08, 1.35);
    s.lineTo(-1.08, 1.95); s.quadraticCurveTo(-1.08, 2.18, -.85, 2.18); s.lineTo(.6, 2.18); s.quadraticCurveTo(.88, 2.18, .9, 1.9);
    s.bezierCurveTo(.92, 1.4, .82, 1.0, .85, y0);
    k.add(g, k.extrude(s, .9, { bevel: .12, bevelSeg: 5, curve: 24 }), black, { p: [0, 0, zc] });
    const zf = zc + .45 + .12;   // the flat front of the arm
    // gold decals
    const gold = (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fff0a8'); gr.addColorStop(.5, '#e2b24c'); gr.addColorStop(1, '#b07c22'); c.strokeStyle = gr; c.fillStyle = gr; c.lineCap = 'round'; };
    g.add(k.decal(1.9, .56, (c, w, h) => {
      c.clearRect(0, 0, w, h); gold(c, w, h);
      c.lineWidth = 4; c.strokeRect(10, 10, w - 20, h - 20);
      c.lineWidth = 7; c.beginPath(); c.ellipse(w / 2, h / 2, 62, 84, 0, 0, 7); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.ellipse(w / 2, h / 2, 44, 64, 0, 0, 7); c.stroke();
      for (let i = 0; i < 8; i++) leaf(c, w / 2, h / 2, 34, i / 8 * Math.PI * 2);
      for (const m of [-1, 1]) {
        c.lineWidth = 7; c.beginPath(); c.moveTo(w / 2 + m * 70, h / 2); c.bezierCurveTo(w / 2 + m * 170, h / 2 - 90, w / 2 + m * 280, h / 2 + 90, w / 2 + m * 400, h / 2 - 10); c.stroke();
        c.lineWidth = 5; curl(c, w / 2 + m * 400, h / 2 - 34, 26, Math.PI / 2, -m);
        c.lineWidth = 4; curl(c, w / 2 + m * 180, h / 2 + 40, 20, -Math.PI / 2, m);
        for (const [x, y, a] of [[130, -40, -.9], [230, 30, .6], [300, 50, -.4], [350, -30, -1.3]]) leaf(c, w / 2 + m * x, h / 2 + y, 30, m > 0 ? a : Math.PI - a);
      }
    }, { px: 1024, p: [-.1, 2.55, zf + .004] }));
    g.add(k.decal(.66, 1.1, (c, w, h) => {
      c.clearRect(0, 0, w, h); gold(c, w, h);
      c.lineWidth = 4; c.strokeRect(8, 8, w - 16, h - 16);
      c.lineWidth = 6; c.beginPath(); c.moveTo(w / 2, h - 30); c.bezierCurveTo(w * .1, h * .7, w * .9, h * .4, w / 2, 40); c.stroke();
      c.lineWidth = 4; curl(c, w / 2 - 10, 60, 30, 0, 1); curl(c, w / 2 + 6, h - 60, 26, Math.PI, -1);
      for (const [x, y, a] of [[.35, .75, -2.2], [.62, .6, -.6], [.38, .45, -2.4], [.62, .3, -.5]]) leaf(c, w * x, h * y, 34, a);
    }, { px: 256, p: [1.33, 1.42, zf + .004] }));
    g.add(k.decal(4.0, .1, (c, w, h) => { c.clearRect(0, 0, w, h); gold(c, w, h); c.lineWidth = 3; c.beginPath(); c.moveTo(0, h * .3); c.lineTo(w, h * .3); c.stroke(); for (let x = 20; x < w; x += 40) { c.beginPath(); c.arc(x, h * .68, 4, 0, 7); c.fill(); } }, { px: 1024, p: [0, .56, .905] }));
    // handwheel on the right
    k.add(g, k.cyl(.52, .52, .26, { seg: 48 }), black, { p: [2.05, 2.3, zc], r: [0, 0, Math.PI / 2] });
    k.add(g, k.torus(.52, .045, { rs: 10, ts: 64 }), chrome, { p: [2.18, 2.3, zc], r: [0, Math.PI / 2, 0] });
    k.add(g, k.cyl(.17, .17, .14, { seg: 32 }), chrome, { p: [2.25, 2.3, zc], r: [0, 0, Math.PI / 2] });
    // needle, presser foot, needle plate, tension dial
    const nx = -1.47, nz = zc + .25;
    k.add(g, k.cyl(.045, .045, .3, { seg: 16 }), chrome, { p: [nx, 1.05, nz] });
    k.add(g, k.cyl(.014, .014, .3, { seg: 8 }), chrome, { p: [nx, .82, nz] });
    k.add(g, k.cyl(.035, .035, .45, { seg: 12 }), chrome, { p: [nx, .95, nz - .16] });
    k.add(g, k.box(.18, .05, .34, .02), chrome, { p: [nx, .7, nz - .02] });
    k.add(g, k.box(.7, .02, .6, .01), chrome, { p: [nx, .665, nz - .05] });
    for (const dz of [0, .05]) k.add(g, k.cyl(.12 - dz * .6, .12 - dz * .6, .04, { seg: 24 }), chrome, { p: [-1.42, 2.15, zf + .02 + dz], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.box(.2, .06, .08, .02), chrome, { p: [-1.5, 2.5, zf + .03] });                           // take-up lever
    // spool pin with a spool of red thread, and the thread to the needle
    k.add(g, k.cyl(.025, .025, .5, { seg: 8 }), chrome, { p: [.55, 3.1, zc] });
    k.add(g, k.cyl(.16, .16, .3, { seg: 24 }), k.mat({ color: '#d8323a', roughness: .6, sheen: .6, sheenColor: '#ffb3b3' }), { p: [.55, 3.12, zc] });
    for (const y of [2.95, 3.29]) k.add(g, k.cyl(.2, .2, .04, { seg: 24 }), k.wood('maple'), { p: [.55, y, zc] });
    k.add(g, k.tube([[.45, 3.15, zc + .1], [-.4, 3.02, zc + .42], [-1.3, 2.9, zf + .02], [-1.42, 2.25, zf + .08], [-1.46, 1.5, zf + .06], [nx, .9, nz + .02]], .012, { seg: 80, rs: 6 }), k.matte('#d8323a', .6));
    g.userData.view = { az: 28, el: 14 };
    return g;
  },
};
