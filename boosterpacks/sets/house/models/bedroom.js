// Models for the bedroom cards. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

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

// A point on an ellipsoid (centre c, radii r) in direction d, with the surface normal there.
function onBall(k, c, r, d) {
  const T = k.THREE, u = new T.Vector3(...d).normalize();
  return { p: new T.Vector3(c[0] + r[0] * u.x, c[1] + r[1] * u.y, c[2] + r[2] * u.z), n: new T.Vector3(u.x / r[0], u.y / r[1], u.z / r[2]).normalize() };
}
// Turn an object so its own axis (default +y) points along n.
const aim = (k, obj, n, axis = [0, 1, 0]) => { obj.quaternion.setFromUnitVectors(new k.THREE.Vector3(...axis), n.clone().normalize()); return obj; };

// A sheet lying in xz and facing up, w × d, with heights y = fn(x, z); plan corners rounded to rc; col(x, z) → grey shade.
function heightField(k, w, d, nx, nz, fn, rc = 0, col = null) {
  const T = k.THREE, geo = new T.PlaneGeometry(w, d, nx, nz);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, cols = [], ax = w / 2 - rc, az = d / 2 - rc;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i);
    if (rc > 0 && Math.abs(x) > ax && Math.abs(z) > az) {
      const dx = Math.abs(x) - ax, dz = Math.abs(z) - az, l = Math.hypot(dx, dz);
      if (l > rc) { x = Math.sign(x) * (ax + dx / l * rc); z = Math.sign(z) * (az + dz / l * rc); }
    }
    p.setXYZ(i, x, fn(x, z), z);
    if (col) { const c = col(x, z); cols.push(c, c, c); }
  }
  if (col) geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}

// A puffy pillow, w (x) × d (z), t thick in the middle, seamed all round with its corners poking out.
function pillowGeo(k, w, d, t, n = 36) {
  const T = k.THREE;
  return k.merge([1, -1].map(side => {
    const g = new T.PlaneGeometry(2, 2, n, n), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), v = p.getY(i);
      const f = Math.pow(Math.max(0, 1 - u * u), .42) * Math.pow(Math.max(0, 1 - v * v), .42);
      p.setXYZ(i, u * w / 2 * (1 - .07 * (1 - v * v)), side * f * t / 2, -side * v * d / 2 * (1 - .07 * (1 - u * u)));
    }
    g.computeVertexNormals();
    return g;
  }));
}

export default {
  // One striped crew sock, standing in profile the way socks are photographed (on a flat sock blocker).
  sock(k) {
    const T = k.THREE, g = k.group();
    const pts = [];
    for (let y = 3.3; y > 1.1; y -= .32) pts.push([0, y, 0]);
    for (let i = 0; i <= 8; i++) { const a = Math.PI + i / 8 * Math.PI / 2; pts.push([.62 + Math.cos(a) * .62, 1.07 + Math.sin(a) * .62, 0]); }
    for (let x = .95; x < 2.9; x += .32) pts.push([x, .45, 0]);
    const curve = curveOf(k, pts), L = curve.getLength(), SEG = 200, RS = 36;
    // arc length at the middle of the heel
    let sh = 0, best = 1e9;
    const P = new T.Vector3(), heel = new T.Vector3(.62 - .62 * Math.SQRT1_2, 1.07 - .62 * Math.SQRT1_2, 0);
    for (let i = 0; i <= 400; i++) { curve.getPointAt(i / 400, P); const d = P.distanceTo(heel); if (d < best) { best = d; sh = i / 400 * L; } }
    const cuff = .78, toe = .5;
    const rad = s => {
      let r = .43 + .035 * (1 - smooth(cuff - .12, cuff + .04, s)) + .05 * Math.exp(-(((s - sh) / .42) ** 2));
      const e = L - s; if (e < toe) { const q = e / toe; r *= Math.sqrt(Math.max(0, q * (2 - q))); }
      return r;
    };
    const geo = varTube(k, curve, rad, { flat: .44, up: [0, 0, 1], seg: SEG, rs: RS });
    // which way round the tube the back of the heel faces (texture v)
    const fr = curve.computeFrenetFrames(SEG, false), ih = Math.round(sh / L * SEG), out = new T.Vector3(-1, -1, 0).normalize();
    let vh = 0, bd = -2;
    for (let j = 0; j <= RS; j++) {
      const a = j / RS * TAU, dir = fr.normals[ih].clone().multiplyScalar(-Math.cos(a)).addScaledVector(fr.binormals[ih], Math.sin(a));
      if (dir.dot(out) > bd) { bd = dir.dot(out); vh = j / RS; }
    }
    const W = 1024, H = 256, X = s => s / L * W;
    const cream = '#f7efe0', coral = '#ee5846', gold = '#f5b53b', teal = '#2b9e99';
    const tex = k.tex(W, H, c => {
      c.fillStyle = cream; c.fillRect(0, 0, W, H);
      const bands = [coral, gold, teal];
      for (let s = cuff + .14, i = 0; s < L - toe; s += .34, i++) { c.fillStyle = bands[i % 3]; c.fillRect(X(s), 0, X(.18), H); }
      c.fillStyle = coral;
      c.fillRect(X(L - toe - .1), 0, W, H);                                                   // toe
      for (const dy of [-H, 0, H]) { c.beginPath(); c.ellipse(X(sh), (1 - vh) * H + dy, X(.56), H * .27, 0, 0, TAU); c.fill(); }   // heel
      c.fillStyle = cream; c.fillRect(0, 0, X(cuff), H);                                        // ribbed cuff
      c.fillStyle = 'rgba(110,80,50,.2)'; for (let y = 0; y < H; y += H / 36) c.fillRect(0, y, X(cuff), H / 90);
      c.fillStyle = teal; c.fillRect(X(cuff - .12), 0, X(.07), H);
      c.fillStyle = 'rgba(0,0,0,.05)'; for (let x = 0; x < W; x += 3) c.fillRect(x, 0, 1, H);   // knit rows
    });
    k.add(g, geo, k.mat({ map: tex, roughness: .95, sheen: .8, sheenRoughness: .45, sheenColor: new T.Color('#d8d0c6') }));
    // the opening at the top: a dark inside and a rolled edge
    const r0 = rad(0);
    k.add(g, k.disc(1, 40), k.matte('#5a4636', .9), { p: [0, 3.26, 0], r: [-Math.PI / 2, 0, 0], s: [r0 * .92, r0 * .44 * .92, 1] });
    const lip = []; for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; lip.push([Math.cos(a) * r0 * .96, 3.29, Math.sin(a) * r0 * .44 * .96]); }
    k.add(g, k.tube(lip, .035, { closed: true, rs: 8 }), k.fabric(cream));
    g.userData.view = { az: 26 };
    return g;
  },

  // A varnished wooden suit hanger with a chrome hook and trouser bar.
  hanger(k) {
    const g = k.group();
    const wood = k.wood('maple', { varnish: .8, rough: .45 });
    wood.map.center.set(.5, .5); wood.map.rotation = Math.PI / 2; wood.map.repeat.set(.45, .45);
    const chrome = k.chrome();
    const Wh = 3.9, N = 40;
    const yc = x => .95 - .95 * Math.pow(Math.abs(x) / Wh, 1.7);
    const dy = x => -.95 * 1.7 / Wh * Math.pow(Math.abs(x) / Wh, .7) * Math.sign(x);
    const th = x => .5 - .12 * Math.pow(Math.abs(x) / Wh, 2);
    const pt = (x, side) => { const f = Math.atan(dy(x)), h = th(x) / 2 * side; return [x - Math.sin(f) * h, yc(x) + Math.cos(f) * h]; };
    const outline = [];
    for (let i = 0; i <= N; i++) outline.push(pt(-Wh + 2 * Wh * i / N, 1));
    const fR = Math.atan(dy(Wh)), fL = Math.atan(dy(-Wh)), re = th(Wh) / 2;
    for (let i = 1; i < 10; i++) { const a = fR + Math.PI / 2 - i / 10 * Math.PI; outline.push([Wh + Math.cos(a) * re, yc(Wh) + Math.sin(a) * re]); }
    for (let i = N; i >= 0; i--) outline.push(pt(-Wh + 2 * Wh * i / N, -1));
    for (let i = 1; i < 10; i++) { const a = fL - Math.PI / 2 - i / 10 * Math.PI; outline.push([-Wh + Math.cos(a) * re, yc(-Wh) + Math.sin(a) * re]); }
    k.add(g, k.extrude(k.shape(outline), .26, { bevel: .09 }), wood);
    // hook
    const topY = yc(0) + th(0) / 2, hook = [[0, topY - .1, 0], [0, topY + .45, 0], [0, topY + .85, 0]];
    for (let i = 1; i <= 12; i++) { const a = i / 12 * k.deg(215); hook.push([-.5 + Math.cos(a) * .5, topY + .85 + Math.sin(a) * .5, 0]); }
    k.add(g, k.tube(hook, .07, { caps: true, seg: 120, rs: 12 }), chrome);
    k.add(g, k.cyl(.11, .14, .16, { seg: 24 }), chrome, { p: [0, topY + .03, 0] });
    // trouser bar
    const ex = 3.15, ey = yc(ex) - th(ex) / 2 + .05, by = ey - .92;
    const bar = [[-ex, ey, 0], [-ex, ey - .5, 0], [-ex + .1, ey - .8, 0], [-ex + .4, by, 0], [0, by, 0], [ex - .4, by, 0], [ex - .1, ey - .8, 0], [ex, ey - .5, 0], [ex, ey, 0]];
    k.add(g, k.tube(bar, .045, { caps: true, seg: 160, rs: 10 }), chrome);
    k.add(g, k.cyl(.085, .085, 4.2, { seg: 20 }), k.rubber('#26262b'), { p: [0, by, 0], r: [0, 0, Math.PI / 2] });
    g.userData.view = { az: 16, el: 8, lift: -.12 };
    g.userData.floating = true;
    return g;
  },

  // A polka-dot scrunchie, all gathered folds.
  scrunchie(k) {
    const T = k.THREE, g = k.group();
    const R = 1, r = .44, geo = new T.TorusGeometry(R, r, 40, 260);
    const p = geo.attributes.position, ph = [k.range(0, TAU), k.range(0, TAU), k.range(0, TAU), k.range(0, TAU)];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const u = Math.atan2(y, x), cx = Math.cos(u) * R, cy = Math.sin(u) * R;
      const dx = x - cx, dy = y - cy, radial = (dx * Math.cos(u) + dy * Math.sin(u)) / r, w = Math.atan2(z, radial * r);
      const fold = Math.sin(u * 19 + w + ph[0] + .6 * Math.sin(u * 5 + ph[2])) * (.085 + .045 * radial) + Math.sin(u * 31 - w + ph[1]) * .035 + Math.sin(u * 7 + 2 * w + ph[2]) * .035;
      const s = (1 + fold) * (1 + .07 * radial), Rr = 1 + .03 * Math.sin(2 * u + ph[3]);
      p.setXYZ(i, cx * Rr + dx * s, cy * Rr + dy * s, z * (1 + fold) * .9);
    }
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals(); weld(geo);
    const dots = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#e0587e'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff4f0';
      for (const [x, y] of [[.25, .25], [.75, .75]]) { c.beginPath(); c.arc(x * w, y * h, w * .09, 0, TAU); c.fill(); }
    }, { repeat: [22, 3] });
    k.add(g, geo, k.mat({ map: dots, roughness: .85, sheen: 1, sheenRoughness: .4, sheenColor: new T.Color('#ffc4d6') }), { r: [.3, 0, 0] });
    g.userData.view = { el: 26 };
    return g;
  },

  // The classic twin-bell wind-up alarm clock, set for seven.
  alarmclock(k) {
    const g = k.group();
    const red = k.gloss('#e23b36'), chrome = k.chrome(), black = k.gloss('#1b1b20');
    const R = 1, D = .72, cy = 1.5, fz = D / 2;
    const c = k.group([], { p: [0, cy, 0] }); g.add(c);
    k.add(c, k.rcyl(R, D, .16), red, { p: [0, 0, -D / 2], r: [Math.PI / 2, 0, 0] });
    k.add(c, k.torus(R - .05, .075, { rs: 16, ts: 80 }), chrome, { p: [0, 0, fz + .005] });
    k.add(c, k.torus(R - .05, .06, { rs: 16, ts: 80 }), chrome, { p: [0, 0, -fz - .005] });
    const face = k.painted(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#fbf6ea'; ctx.fillRect(0, 0, w, h);
      const m = w / 2;
      ctx.strokeStyle = '#2a2a33'; ctx.lineCap = 'round';
      for (let i = 0; i < 60; i++) {
        const a = i / 60 * TAU, big = i % 5 === 0, r0 = big ? 204 : 218;
        ctx.lineWidth = big ? 8 : 3; ctx.beginPath(); ctx.moveTo(m + Math.sin(a) * r0, m - Math.cos(a) * r0); ctx.lineTo(m + Math.sin(a) * 234, m - Math.cos(a) * 234); ctx.stroke();
      }
      for (let i = 1; i <= 12; i++) { const a = i / 12 * TAU; k.text(ctx, String(i), m + Math.sin(a) * 158, m - Math.cos(a) * 158 + 3, { size: 50, color: '#25252d' }); }
    }, { rough: .4 });
    k.add(c, k.disc(.95, 64), face, { p: [0, 0, fz + .01] });
    // hands at 10:09, alarm set for 7
    const hand = (len, wid, mat, ang, z, tail = .12) => {
      const geo = k.box(wid, len + tail, .025, Math.min(wid / 2, .01)); geo.translate(0, (len - tail) / 2, 0);
      return k.mesh(geo, mat, { p: [0, 0, fz + z], r: [0, 0, -ang] });
    };
    c.add(hand(.5, .09, black, k.deg(304.5), .03));
    c.add(hand(.78, .065, black, k.deg(54), .045));
    c.add(hand(.8, .022, k.gloss('#e23b36'), k.deg(160), .06, .2));
    const al = hand(.42, .035, k.gloss('#f2b71f'), k.deg(210), .02);
    const tip = k.mesh(k.cone(.07, .14, 3), k.gloss('#f2b71f'), { p: [0, .46, 0] }); al.add(tip); c.add(al);
    k.add(c, k.cyl(.07, .07, .09, { seg: 20 }), chrome, { p: [0, 0, fz + .06], r: [Math.PI / 2, 0, 0] });
    // domed glass
    const Rs = 2.6, th = Math.asin(.93 / Rs);
    k.add(c, k.sphere(Rs, { thetaLen: th, w: 64, h: 12 }), k.glass('#ffffff', { opacity: .16 }), { p: [0, 0, fz + .03 - Rs * Math.cos(th)], r: [Math.PI / 2, 0, 0], shadow: false });
    // bells, hammer and legs
    const bellPts = [];
    for (let i = 10; i >= 0; i--) { const a = i / 10 * Math.PI / 2; bellPts.push([.45 * Math.cos(a), .4 * Math.sin(a)]); }
    bellPts.push([.5, -.012]);
    for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; bellPts.push([.52 * Math.cos(a), .46 * Math.sin(a)]); }
    const bell = k.lathe(bellPts, { seg: 48 });
    for (const s of [-1, 1]) {
      const a = k.deg(40) * s;
      const arm = k.group([], { r: [0, 0, -a] }); c.add(arm);
      k.add(arm, k.cyl(.05, .05, .3, { seg: 16 }), chrome, { p: [0, R + .1, 0] });
      k.add(arm, bell, chrome, { p: [0, R + .14, 0] });
      k.add(arm, k.sphere(.07), chrome, { p: [0, R + .63, 0] });
      const leg = k.group([], { r: [0, 0, Math.PI + k.deg(36) * s] }); c.add(leg);
      k.add(leg, k.cyl(.05, .07, .55, { seg: 16 }), chrome, { p: [0, R + .1, 0] });
      k.add(leg, k.sphere(.1), black, { p: [0, R + .38, 0] });
    }
    k.add(c, k.cyl(.035, .035, .42, { seg: 12 }), chrome, { p: [0, R + .16, -.05] });
    k.add(c, k.sphere(.1), chrome, { p: [0, R + .4, -.05] });
    // winding key and alarm knob on the back
    k.add(c, k.cyl(.05, .05, .2, { seg: 12 }), chrome, { p: [-.35, .2, -fz - .1], r: [Math.PI / 2, 0, 0] });
    k.add(c, k.box(.34, .2, .04, .06), chrome, { p: [-.35, .2, -fz - .22] });
    k.add(c, k.cyl(.05, .05, .2, { seg: 12 }), chrome, { p: [.35, .2, -fz - .1], r: [Math.PI / 2, 0, 0] });
    k.add(c, k.rcyl(.12, .08, .03, { seg: 24 }), chrome, { p: [.35, .2, -fz - .18], r: [-Math.PI / 2, 0, 0] });
    g.userData.view = { az: 18, el: 12 };
    return g;
  },

  // A honey-coloured plush bear with a ribbon, one bead eye and one mismatched button eye.
  teddy(k) {
    const T = k.THREE, g = k.group();
    const fur = k.fabric('#bb8450', { sheen: '#f0cf9f' }), light = k.fabric('#f0d7b1'), brown = k.gloss('#3a2216');
    const thread = k.matte('#3a2216', .7);
    k.add(g, k.sphere(1), fur, { p: [0, 1.12, 0], s: [.95, 1.08, .82] });                    // body
    k.add(g, k.sphere(.55), light, { p: [0, 1.02, .6], s: [1, 1.1, .45] });                   // tummy
    const H = [0, 2.76, .08], hr = .88;
    k.add(g, k.sphere(hr), fur, { p: H });
    k.add(g, k.sphere(.4), light, { p: [0, 2.52, .8], s: [1.15, .85, .85] });                   // muzzle
    k.add(g, k.sphere(.14), brown, { p: [0, 2.66, 1.1], s: [1.35, .85, .8] });                 // nose
    k.add(g, k.tube([[0, 2.56, 1.13], [0, 2.46, 1.13], [.07, 2.39, 1.11], [.16, 2.41, 1.06]], .016, { caps: true }), thread);
    k.add(g, k.tube([[0, 2.46, 1.13], [-.07, 2.39, 1.11], [-.16, 2.41, 1.06]], .016, { caps: true }), thread);
    k.add(g, k.tube([[0, 2.95, .85], [0, 3.28, .66], [0, 3.56, .32]], .012, { caps: true }), k.matte('#8a5a33', .9));   // seam
    for (const s of [-1, 1]) {
      const ear = onBall(k, H, [hr, hr, hr], [s * .68, .72, -.02]);
      k.add(g, k.sphere(.3), fur, { p: ear.p.toArray(), s: [1, 1, .5] });
      k.add(g, k.sphere(.19), light, { p: ear.p.clone().add(new T.Vector3(0, -.02, .1)).toArray(), s: [1, 1, .35] });
      k.add(g, k.sphere(.45), fur, { p: [s * .52, .4, .62], s: [.95, .85, 1.35] });            // leg
      k.add(g, k.sphere(.3), light, { p: [s * .52, .42, 1.18], s: [1, 1.08, .32] });          // foot pad
      k.add(g, k.sphere(.38), fur, { p: [s * .93, 1.45, .3], s: [.75, 1.5, .8], r: [-.35, 0, s * .38] });   // arm
    }
    // eyes: a glass bead, and a blue button sewn on with red thread
    const bead = onBall(k, H, [hr, hr, hr], [-.36, .24, .9]);
    k.add(g, k.sphere(.085), k.gloss('#101010'), { p: bead.p.toArray() });
    k.add(g, k.sphere(.022), k.glow('#ffffff', 1), { p: bead.p.clone().add(new T.Vector3(.03, .035, .07)).toArray() });
    const btn = onBall(k, H, [hr, hr, hr], [.36, .24, .9]);
    const b = aim(k, k.group([], { p: btn.p.clone().addScaledVector(btn.n, -.02).toArray() }), btn.n); g.add(b);
    k.add(b, k.rcyl(.135, .06, .025, { seg: 32 }), k.gloss('#2f7fd6'));
    k.add(b, k.torus(.1, .012, { rs: 8, ts: 40 }), k.gloss('#2466b2'), { p: [0, .06, 0], r: [Math.PI / 2, 0, 0] });
    for (const [x, z] of [[-.035, -.035], [.035, -.035], [-.035, .035], [.035, .035]]) k.add(b, k.cyl(.016, .016, .02, { seg: 10 }), k.matte('#123a66'), { p: [x, .058, z] });
    k.add(b, k.box(.13, .02, .022, .01), k.matte('#d8303a', .7), { p: [0, .068, 0], r: [0, Math.PI / 4, 0] });
    k.add(b, k.box(.13, .02, .022, .01), k.matte('#d8303a', .7), { p: [0, .068, 0], r: [0, -Math.PI / 4, 0] });
    // ribbon bow
    const satin = k.plastic('#d8303f', { rough: .42, coat: .35 });
    k.add(g, k.torus(.54, .065, { rs: 12, ts: 64 }), satin, { p: [0, 2.0, .02], r: [Math.PI / 2, 0, 0], s: [1, .88, 1] });
    for (const s of [-1, 1]) {
      k.add(g, k.sphere(.19), satin, { p: [s * .21, 2.02, .6], s: [1.3, .78, .45], r: [0, s * -.3, s * .25] });
      k.add(g, k.box(.1, .34, .03, .015), satin, { p: [s * .1, 1.84, .6], r: [.2, 0, s * .35] });
    }
    k.add(g, k.sphere(.085), satin, { p: [0, 2.01, .65] });
    return g;
  },

  // A pair of plush bunny slippers. The left bunny has seen things; one ear never recovered.
  slippers(k) {
    const T = k.THREE, g = k.group();
    const plush = k.fabric('#f8f4ef', { sheen: '#ffffff' }), pinkIn = k.fabric('#f5a4bc'), lining = k.fabric('#f2b3c6');
    lining.side = T.BackSide;
    const soleM = k.rubber('#cdb7bd'), eyeM = k.gloss('#1a1414'), noseM = k.gloss('#f07a9a'), whisk = k.matte('#b9aeb0', .6);
    const outline = []; for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; outline.push([Math.cos(a) * (.56 + .08 * Math.sin(a)), Math.sin(a) * 1.35]); }
    const soleGeo = k.extrude(k.shape(outline), .12, { bevel: .05 });
    const insoleGeo = k.extrude(k.shape(outline.map(([x, y]) => [x * .86, y * .9])), .04, { bevel: .02 });
    const z0 = -.2, len = 1.45, a = .6, hgt = .78, yb = .2;
    const dome = k.sphere(1, { phiStart: 0, phiLen: Math.PI, thetaLen: Math.PI / 2, w: 48, h: 24 });
    const heel = []; for (let i = 0; i <= 16; i++) { const t = Math.PI + .15 + i / 16 * (Math.PI - .3); heel.push([Math.cos(t) * (.56 + .08 * Math.sin(t)) * .86, .36, Math.sin(t) * 1.35 * .93]); }
    const heelGeo = k.tube(heel, .14, { caps: true, rs: 16 });
    const arch = []; for (let i = 0; i <= 16; i++) { const t = i / 16 * Math.PI; arch.push([Math.cos(t) * a * .97, yb + Math.sin(t) * hgt * .97, z0]); }
    const archGeo = k.tube(arch, .08, { caps: true, rs: 12 });
    const C = [0, yb, z0], Rr = [a, hgt, len];
    const make = (flop) => {
      const s = k.group();
      k.add(s, soleGeo, soleM, { p: [0, .11, 0], r: [Math.PI / 2, 0, 0] });
      k.add(s, insoleGeo, pinkIn, { p: [0, .24, 0], r: [Math.PI / 2, 0, 0] });
      k.add(s, dome, plush, { p: C, s: Rr });
      k.add(s, dome, lining, { p: [0, yb, z0 + .01], s: [a - .05, hgt - .05, len - .06] });
      k.add(s, archGeo, plush);
      k.add(s, heelGeo, plush);
      for (const side of [-1, 1]) {
        const e = onBall(k, C, Rr, [side * .36, .6, .72]);
        k.add(s, k.sphere(.075), eyeM, { p: e.p.toArray() });
        k.add(s, k.sphere(.02), k.glow('#ffffff', 1), { p: e.p.clone().add(new T.Vector3(.02, .03, .06)).toArray() });
        const ch = onBall(k, C, Rr, [side * .15, .26, .96]);
        k.add(s, k.sphere(.12), plush, { p: ch.p.toArray(), s: [1, .85, .8] });
        for (const t of [-1, 0, 1]) k.add(s, k.tube([ch.p.toArray(), [ch.p.x + side * .22, ch.p.y + t * .06, ch.p.z + .02], [ch.p.x + side * .42, ch.p.y + t * .12 - .03, ch.p.z - .02]], .007, { rs: 6 }), whisk, { shadow: false });
        // ears
        const base = onBall(k, C, Rr, [side * .34, .9, .2]);
        const ear = k.group([], { p: base.p.toArray() }); s.add(ear);
        const floppy = flop && side < 0;
        ear.rotation.set(floppy ? .15 : -.32, 0, floppy ? 2.25 : side * -.22);
        k.add(ear, k.sphere(1, { w: 32, h: 20 }), plush, { p: [0, .5, 0], s: [.17, .56, .08] });
        k.add(ear, k.sphere(1, { w: 32, h: 20 }), pinkIn, { p: [0, .52, .045], s: [.1, .42, .045] });
      }
      const nose = onBall(k, C, Rr, [0, .36, .94]);
      k.add(s, k.sphere(.075), noseM, { p: nose.p.toArray(), s: [1.3, .9, .9] });
      return s;
    };
    g.add(k.place(make(false), { p: [.7, 0, .12], r: [0, -.08, 0] }));
    g.add(k.place(make(true), { p: [-.7, 0, -.12], r: [0, .1, 0] }));
    g.userData.view = { el: 22 };
    return g;
  },

  // A glossy pink ceramic piggy bank, with a coin going in.
  piggybank(k) {
    const T = k.THREE, g = k.group(), pig = k.group([], { r: [0, -.55, 0] }); g.add(pig);
    const pink = k.ceramic('#f7a2b8'), deep = k.ceramic('#ec7d9b'), dark = k.gloss('#5a2334');
    const cy = 1.02, B = [0, cy, 0], Br = [1.35, 1.05, 1.0];
    k.add(pig, k.sphere(1, { w: 64, h: 48 }), pink, { p: B, s: Br });
    for (const [x, z] of [[.72, .52], [.72, -.52], [-.7, .5], [-.7, -.5]]) k.add(pig, k.rcyl(.25, .5, .1, { seg: 32 }), pink, { p: [x, 0, z] });
    // snout
    k.add(pig, k.rcyl(.38, .34, .1), pink, { p: [1.2, cy + .02, 0], r: [0, 0, -Math.PI / 2] });
    for (const z of [-.13, .13]) k.add(pig, k.sphere(.075), dark, { p: [1.54, cy + .02, z], s: [.5, 1.3, .9] });
    // eyes and cheeks
    for (const s of [-1, 1]) {
      const e = onBall(k, B, Br, [.78, .42, s * .45]);
      k.add(pig, k.sphere(.085), k.gloss('#141012'), { p: e.p.toArray() });
      k.add(pig, k.sphere(.022), k.glow('#ffffff', 1), { p: e.p.clone().add(new T.Vector3(.05, .04, s * .02)).toArray() });
      const ch = onBall(k, B, Br, [.72, -.05, s * .62]);
      aim(k, k.add(pig, k.sphere(.2), deep, { p: ch.p.clone().addScaledVector(ch.n, -.04).toArray(), s: [1, 1, .25] }), ch.n, [0, 0, 1]);
      // ears: rounded triangles folding forward
      const ear = k.group([], { p: onBall(k, B, Br, [.5, .8, s * .42]).p.toArray(), r: [s * .35, 0, -.45] }); pig.add(ear);
      const tri = new T.Shape(); tri.moveTo(-.22, 0); tri.quadraticCurveTo(-.2, .3, 0, .42); tri.quadraticCurveTo(.2, .3, .22, 0); tri.closePath();
      k.add(ear, k.extrude(tri, .05, { bevel: .04 }), [deep, pink], { r: [0, Math.PI / 2, 0] });
    }
    // curly tail
    const tail = []; for (let i = 0; i <= 24; i++) { const t = i / 24 * TAU * 1.3; tail.push([-1.32 - i * .012, cy + .15 + Math.sin(t) * .12, Math.cos(t) * .12 - .12]); }
    k.add(pig, k.tube(tail, .04, { caps: true, rs: 10 }), pink);
    // coin slot, and a coin halfway in
    k.add(pig, k.box(.62, .08, .13, .04), dark, { p: [-.1, cy + 1.02, 0] });
    const coin = k.group([], { p: [-.12, cy + 1.1, 0], r: [Math.PI / 2, 0, .12] }); pig.add(coin);
    k.add(coin, k.cyl(.27, .27, .05, { seg: 48 }), k.gold());
    k.add(coin, k.torus(.22, .012, { rs: 8, ts: 48 }), k.gold(), { r: [Math.PI / 2, 0, 0], p: [0, .026, 0] });
    k.add(coin, k.torus(.22, .012, { rs: 8, ts: 48 }), k.gold(), { r: [Math.PI / 2, 0, 0], p: [0, -.026, 0] });
    return g;
  },

  // A lava lamp: glowing wax rising through purple liquid in a tapered glass, on a cone base.
  lavalamp(k) {
    const T = k.THREE, g = k.group();
    const metal = k.metal('#8a78d8', .28);
    k.add(g, k.lathe([[0, 0], [1.02, 0], [1.06, .05], [1.02, .14], [.64, 1.72], [.6, 1.84], [.62, 1.9], [0, 1.9]]), metal);   // base
    k.add(g, k.torus(.6, .04, { rs: 10, ts: 48 }), k.chrome(), { p: [0, 1.88, 0], r: [Math.PI / 2, 0, 0] });
    const glassPts = [[.56, 1.9], [.66, 2.2], [.7, 2.6], [.64, 3.4], [.5, 4.3], [.36, 4.95], [.33, 5.05]];
    k.add(g, k.lathe(glassPts, { smooth: true }), k.glass('#ffffff', { opacity: .1 }), { shadow: false }).renderOrder = 3;
    const liquidGeo = k.lathe([[0, 1.95], [.51, 1.95], [.61, 2.2], [.65, 2.6], [.59, 3.4], [.45, 4.3], [.32, 4.82], [0, 4.85]], { smooth: true });
    const back = k.mat({ color: '#8e1c9e', transparent: true, opacity: .66, roughness: .2, emissive: '#6e1286', emissiveIntensity: .9, depthWrite: false, side: T.BackSide });
    const front = k.mat({ color: '#b02ab0', transparent: true, opacity: .12, roughness: .1, emissive: '#5a0c62', emissiveIntensity: .5, depthWrite: false });
    k.add(g, liquidGeo, back, { shadow: false }).renderOrder = 1;
    k.add(g, liquidGeo, front, { shadow: false }).renderOrder = 2;
    // wax
    const wax = k.mat({ color: '#ff5a00', emissive: '#ff4500', emissiveIntensity: .95, roughness: .3, clearcoat: .6 });
    k.add(g, k.lathe([[0, 1.95], [.53, 1.98], [.5, 2.1], [.35, 2.2], [.18, 2.28], [0, 2.3]], { smooth: true }), wax);
    k.add(g, k.merge([k.sphere(.3).translate(0, 0, 0), k.sphere(.2).translate(-.08, -.32, 0), k.sphere(.12).translate(-.05, -.55, 0)]), wax, { p: [.08, 3.1, 0], s: [1, 1.25, 1] });
    k.add(g, k.sphere(.19), wax, { p: [-.15, 3.95, .05], s: [1, 1.2, 1] });
    k.add(g, k.sphere(.1), wax, { p: [.12, 4.4, 0] });
    k.add(g, k.sphere(.2), wax, { p: [0, 4.7, 0], s: [1, .5, 1] });
    k.add(g, k.lathe([[.34, 5.0], [.3, 5.3], [.18, 5.62], [.08, 5.7], [0, 5.72]], { smooth: true }), metal);   // cap
    g.userData.view = { az: 24 };
    return g;
  },

  // A thick memory foam mattress with a quilted top and a pillow, one corner cut away to show the foam layers.
  mattress(k) {
    const T = k.THREE, g = k.group();
    const W = 4.2, D = 3.1, H = .72, rc = .08, NX = 150, NZ = 110;
    const cw = 40 * W / NX, cd = 30 * D / NZ, yc = .43, x1 = W / 2 - cw, z1 = D / 2 - cd;   // the cutaway: front right, down to the base foam
    const band = k.fabric('#8b93a3', { sheen: '#c9d0de' }), cover = k.fabric('#ebe7e0', { sheen: '#ffffff' }), pipe = k.fabric('#dcd8d0'), dark = k.fabric('#5c6372');
    k.add(g, k.box(W, .24, D, .08), dark, { p: [0, .12, 0] });
    k.add(g, k.box(W - .02, .22, D - .02, .03), band, { p: [0, .32, 0] });
    // the upper side band, notched at the cut corner
    const bev = .025, w2 = W / 2 - bev, d2 = D / 2 - bev, xs = x1 - bev, ys = -(z1 - bev), hb = H - yc;
    const sh = new T.Shape();
    sh.moveTo(-w2 + rc, -d2); sh.lineTo(xs, -d2); sh.lineTo(xs, ys); sh.lineTo(w2, ys); sh.lineTo(w2, d2 - rc);
    sh.quadraticCurveTo(w2, d2, w2 - rc, d2); sh.lineTo(-w2 + rc, d2); sh.quadraticCurveTo(-w2, d2, -w2, d2 - rc);
    sh.lineTo(-w2, -d2 + rc); sh.quadraticCurveTo(-w2, -d2, -w2 + rc, -d2);
    k.add(g, k.extrude(sh, hb - 2 * bev, { bevel: bev }), band, { p: [0, yc + hb / 2, 0], r: [-Math.PI / 2, 0, 0] });
    // the quilted top panel
    const quilt = (x, z) => {
      const s = .52, a = (x + z) / s, b = (x - z) / s;
      const da = Math.abs(a - Math.round(a)) * s, db = Math.abs(b - Math.round(b)) * s;
      return Math.min(1, Math.exp(-((da / .045) ** 2)) + Math.exp(-((db / .045) ** 2)));
    };
    const edge = (x, z) => Math.min(W / 2 - Math.abs(x), D / 2 - Math.abs(z), Math.hypot(Math.max(0, x1 - x), Math.max(0, z1 - z)));
    const top = heightField(k, W, D, NX, NZ, (x, z) => { const e = edge(x, z); return H + .09 * smooth(0, .35, e) - .035 * quilt(x, z) * smooth(.1, .3, e); },
      rc, (x, z) => 1 - .2 * quilt(x, z) * smooth(.1, .3, edge(x, z)));
    const idx = top.index.array, pos = top.attributes.position, keep = [];
    for (let i = 0; i < idx.length; i += 3) {
      let cx = 0, cz = 0;
      for (let j = 0; j < 3; j++) { cx += pos.getX(idx[i + j]) / 3; cz += pos.getZ(idx[i + j]) / 3; }
      if (!(cx > x1 && cz > z1)) keep.push(idx[i], idx[i + 1], idx[i + 2]);
    }
    top.setIndex(keep);
    cover.vertexColors = true;
    k.add(g, top, cover);
    // piping round the top edge, cut at the corner
    const run = (pts, x, y, z) => { const [x0, , z0] = pts[pts.length - 1], n = Math.max(1, Math.ceil(Math.hypot(x - x0, z - z0) / .1)); for (let j = 1; j <= n; j++) pts.push([x0 + (x - x0) * j / n, y, z0 + (z - z0) * j / n]); };
    const corner = (pts, sx, sz, a0, r, y) => { for (let j = 1; j <= 4; j++) { const a = (a0 + j * 22.5) * Math.PI / 180; pts.push([sx * (W / 2 - r) + Math.cos(a) * r, y, sz * (D / 2 - r) + Math.sin(a) * r]); } };
    const rim = [[x1, H, D / 2]];
    run(rim, -W / 2 + rc, H, D / 2); corner(rim, -1, 1, 90, rc, H);
    run(rim, -W / 2, H, -D / 2 + rc); corner(rim, -1, -1, 180, rc, H);
    run(rim, W / 2 - rc, H, -D / 2); corner(rim, 1, -1, 270, rc, H);
    run(rim, W / 2, H, z1);
    k.add(g, k.tube(rim, .045, { caps: true, seg: 300, rs: 10 }), pipe);
    // the cut: memory foam over blue gel foam, on the grey base foam
    const R = k.rand, foam = (w, h, bands) => k.painted(512, Math.round(512 * h / w), (c, cw2, ch) => {
      for (const [a, b, col, dot] of bands) {
        c.fillStyle = col; c.fillRect(0, a * ch, cw2, (b - a) * ch + 1);
        c.fillStyle = dot;
        for (let i = 0; i < (b - a) * 2600; i++) { c.beginPath(); c.arc(R() * cw2, (a + R() * (b - a)) * ch, .6 + R() * 1.6, 0, TAU); c.fill(); }
      }
      c.fillStyle = 'rgba(40,40,60,.18)'; for (const [a] of bands.slice(1)) c.fillRect(0, a * ch - 1, cw2, 2);
    }, { rough: .95 });
    const layers = [[0, .12, '#f3f0ea', 'rgba(0,0,0,.05)'], [.12, .58, '#f2e3c4', 'rgba(150,110,40,.2)'], [.58, 1, '#84b9e8', 'rgba(20,70,140,.25)']];
    k.add(g, k.plane(cw, hb), foam(cw, hb, layers), { p: [x1 + cw / 2, yc + hb / 2, z1 + .003] });
    k.add(g, k.plane(cd, hb), foam(cd, hb, layers), { p: [x1 + .003, yc + hb / 2, z1 + cd / 2], r: [0, Math.PI / 2, 0] });
    k.add(g, k.plane(cw, cd), foam(cw, cd, [[0, 1, '#dcdfe6', 'rgba(60,70,90,.18)']]), { p: [x1 + cw / 2, yc + .003, z1 + cd / 2], r: [-Math.PI / 2, 0, 0] });
    // carry handles and a label
    const loop = (pts) => k.tube(pts, .03, { caps: true, rs: 8 });
    for (const x of [-1.55, .25]) k.add(g, loop([[x - .3, .62, D / 2], [x - .24, .58, D / 2 + .07], [x + .24, .58, D / 2 + .07], [x + .3, .62, D / 2]]), dark);
    k.add(g, loop([[W / 2, .62, -.2], [W / 2 + .07, .58, -.26], [W / 2 + .07, .58, -.74], [W / 2, .62, -.8]]), dark);
    const lbl = k.decal(.62, .2, (c, w, h) => {
      c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#4458c4'; c.beginPath(); c.arc(h * .5, h * .5, h * .3, 0, TAU); c.fill();
      c.fillStyle = '#fbfaf6'; c.beginPath(); c.arc(h * .62, h * .4, h * .27, 0, TAU); c.fill();
      k.text(c, 'MEMORY FOAM', w * .58, h * .52, { size: h * .3, color: '#3a3f4c', font: 'Nunito, sans-serif', weight: 800 });
    }, { px: 256 });
    lbl.position.set(-.68, .32, D / 2 - .006); g.add(lbl);
    // pillow
    k.add(g, pillowGeo(k, 1.05, 1.9, .42), k.fabric('#cfdcf5', { sheen: '#ffffff' }), { p: [-1.45, H + .2, -.05], r: [0, .06, 0] });
    g.userData.view = { el: 27, az: 32 };
    return g;
  },

  // A sleek two-tone game console with its controller in front (blinking low battery, of course).
  console(k) {
    const T = k.THREE, g = k.group();
    const white = k.plastic('#f1f2f5', { rough: .3 }), gloss = k.gloss('#141519'), port = k.matte('#0b0b0d', .6);
    const Wc = 3.4, D = 2.5, ft = .06;
    k.add(g, k.box(Wc, .3, D, .1), white, { p: [0, ft + .15, 0] });
    k.add(g, k.box(Wc - .12, .2, D - .12, .06), gloss, { p: [0, ft + .38, 0] });
    k.add(g, k.box(Wc, .3, D, .1), white, { p: [0, ft + .61, 0] });
    k.add(g, k.box(Wc * .7, .016, .02, .006), k.glow('#58d7ff', 2.2), { p: [.1, ft + .38, D / 2 - .05] });
    k.add(g, k.box(1.05, .03, .02, .01), port, { p: [-.72, ft + .2, D / 2 + .002] });                    // disc slot
    k.add(g, k.cyl(.05, .05, .02, { seg: 20 }), k.glow('#ffffff', 1.2), { p: [1.35, ft + .2, D / 2 + .002], r: [Math.PI / 2, 0, 0] });
    for (const x of [.95, 1.12]) k.add(g, k.box(.1, .05, .02, .01), port, { p: [x, ft + .2, D / 2 + .002] });
    const vents = []; for (let i = 0; i < 18; i++) for (let j = 0; j < 6; j++) vents.push({ p: [-1.36 + i * .16 + (j % 2) * .08, ft + .76, -.95 + j * .14] });
    g.add(k.instances(k.cyl(.035, .035, .012, { seg: 12 }), k.matte('#3a3c44', .7), vents));
    g.add(k.feet([[-1.4, -1], [1.4, -1], [-1.4, 1], [1.4, 1]], .12, ft));
    // controller
    const pad = new T.Shape();
    pad.moveTo(-.55, .42); pad.lineTo(.55, .42);
    pad.bezierCurveTo(.85, .44, 1.0, .35, 1.05, .12);
    pad.bezierCurveTo(1.12, -.2, 1.12, -.55, .98, -.72);
    pad.bezierCurveTo(.88, -.86, .62, -.84, .56, -.66);
    pad.bezierCurveTo(.5, -.46, .42, -.3, .28, -.28);
    pad.lineTo(-.28, -.28);
    pad.bezierCurveTo(-.42, -.3, -.5, -.46, -.56, -.66);
    pad.bezierCurveTo(-.62, -.84, -.88, -.86, -.98, -.72);
    pad.bezierCurveTo(-1.12, -.55, -1.12, -.2, -1.05, .12);
    pad.bezierCurveTo(-1.0, .35, -.85, .44, -.55, .42);
    const body = k.plastic('#2a2c33', { rough: .45, coat: .3 }), rub = k.matte('#1a1b1f', .7);
    const turn = k.group([], { p: [.35, 0, D / 2 + 1.05], r: [0, -.28, 0], s: .85 }); g.add(turn);
    const c = k.group([], { p: [0, .3, 0], r: [.12, 0, 0] }); turn.add(c);
    k.add(c, k.extrude(pad, .22, { bevel: .1, bevelSeg: 4 }), body, { r: [-Math.PI / 2, 0, 0] });
    const top = .21;
    for (const x of [-.33, .33]) {
      k.add(c, k.cyl(.17, .17, .04, { seg: 32 }), k.matte('#101114', .5), { p: [x, top, .02] });
      k.add(c, k.cyl(.06, .06, .12, { seg: 16 }), rub, { p: [x, top + .06, .02] });
      k.add(c, k.rcyl(.13, .07, .03, { seg: 32 }), rub, { p: [x, top + .1, .02] });
      k.add(c, k.torus(.1, .018, { rs: 8, ts: 32 }), k.matte('#34363d', .6), { p: [x, top + .17, .02], r: [Math.PI / 2, 0, 0] });
    }
    k.add(c, k.box(.3, .07, .09, .02), rub, { p: [-.66, top + .03, -.12] });
    k.add(c, k.box(.09, .07, .3, .02), rub, { p: [-.66, top + .03, -.12] });
    for (const [x, z, col] of [[0, -.12, '#48c46a'], [.12, 0, '#e8453c'], [0, .12, '#3a8ee8'], [-.12, 0, '#f2c230']]) {
      k.add(c, k.rcyl(.052, .06, .02, { seg: 20 }), k.gloss(col), { p: [.66 + x, top, -.12 + z] });
    }
    for (const x of [-.15, .15]) k.add(c, k.box(.1, .03, .05, .02), rub, { p: [x, top + .01, -.2] });
    k.add(c, k.box(.46, .02, .06, .01), k.glow('#ff3b30', 2.4), { p: [0, top + .004, -.35] });   // light bar, red: 3% battery
    for (const x of [-.72, .72]) {
      k.add(c, k.box(.42, .12, .14, .05), k.matte('#15161a', .5), { p: [x, .02, -.46] });
      k.add(c, k.box(.3, .2, .22, .07), k.matte('#15161a', .5), { p: [x, -.24, -.36] });
    }
    g.userData.view = { el: 20, az: 26 };
    return g;
  },
};
