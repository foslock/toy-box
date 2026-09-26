// Outer Space models: the observatory. A space telescope and a space station floating in orbit, a backyard refractor on
// its tripod and a brass orrery. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;

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
// For k.instances: a unit cylinder (radius 1, height 1) stretched from a to b with radius r.
function strut(k, a, b, r) {
  const T = k.THREE, A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const e = new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.divideScalar(len)));
  return { p: A.clone().lerp(B, .5).toArray(), r: [e.x, e.y, e.z], s: [r, len, r] };
}
// A tube along a polyline whose corners are bent round like tubing: pts [[x, y, z, bendRadius?], ...].
function bentTube(k, pts, r, o = {}) {
  const T = k.THREE, V = pts.map(p => new T.Vector3(p[0], p[1], p[2])), n = V.length, path = new T.CurvePath();
  let cur = V[0].clone();
  for (let i = 1; i < n; i++) {
    if (i < n - 1) {
      const b = V[i], ua = V[i - 1].clone().sub(b), uc = V[i + 1].clone().sub(b), la = ua.length(), lc = uc.length();
      const rr = Math.min(pts[i][3] ?? o.bend ?? r * 3, la * .45, lc * .45);
      const c0 = b.clone().addScaledVector(ua, rr / la), c1 = b.clone().addScaledVector(uc, rr / lc);
      if (cur.distanceTo(c0) > 1e-5) path.add(new T.LineCurve3(cur.clone(), c0));
      path.add(new T.QuadraticBezierCurve3(c0, b.clone(), c1));
      cur = c1;
    } else path.add(new T.LineCurve3(cur.clone(), V[i].clone()));
  }
  return new T.TubeGeometry(path, o.seg ?? 64, r, o.rs ?? 8, false);
}
// A soft additive glow round a light (drawn over what's behind it, casts no shadow).
function halo(k, r, color, opacity = .35) {
  const T = k.THREE, tex = k.tex(128, 128, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, { cache: 'observatory-halo' });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k.color(color), transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }));
  s.scale.set(r * 2, r * 2, 1);
  return s;
}
// The default camera's direction (from the model toward the camera).
const camDir = (k, az = 30, el = 16) => new k.THREE.Vector3(Math.sin(k.deg(az)) * Math.cos(k.deg(el)), Math.sin(k.deg(el)), Math.cos(k.deg(az)) * Math.cos(k.deg(el)));
// Re-map the UVs of something spun round y (a lathe, a cylinder) so a tiling texture wraps evenly:
// `around` tiles per turn, one tile every `tile` units up.
function tileUV(geo, around, tile) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, uv.getX(i) * around, p.getY(i) / tile);
  uv.needsUpdate = true;
  return geo;
}
const repeatTex = (k, t) => { t.wrapS = t.wrapT = k.THREE.RepeatWrapping; return t; };

/* ---------- painted surfaces ---------- */
// Crinkles: little random facets, painted into a colour map and a bump map alike so the shine follows the wrinkles.
function crinkles(k, w, h, n, size) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const x = k.rand() * w, y = k.rand() * h, s = size * k.range(.5, 1.3), m = 3 + (k.rand() * 3 | 0), a0 = k.rand() * TAU, sq = k.range(.35, 1), pts = [];
    for (let j = 0; j < m; j++) { const a = a0 + j / m * TAU + k.range(-.3, .3), rr = s * k.range(.4, 1); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * sq]); }
    list.push({ pts, v: k.rand() });
  }
  return list;
}
function paintFacets(c, list, style) {
  for (const f of list) { c.fillStyle = style(f.v); c.beginPath(); f.pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); }
}
// Silver insulation blankets wrapped round a cylinder: rows of panels (offset like bricks), each a slightly different
// shade, crinkled, with dark seams and bright taped edges. Returns [colour map, bump map]; u runs round, v along.
function foilSkin(k, o = {}) {
  const W = o.w ?? 1024, H = o.h ?? 512, rows = o.rows ?? 4, cols = o.cols ?? 8, base = o.base ?? [206, 211, 218], spread = o.spread ?? 22;
  const panels = [], hs = Array.from({ length: rows }, () => k.range(.6, 1.4)), htot = hs.reduce((a, b) => a + b, 0);
  let y = 0;
  for (let r = 0; r < rows; r++) {
    const ph = hs[r] / htot * H, n = Math.max(2, Math.round(cols * k.range(.75, 1.25))), ws = Array.from({ length: n }, () => k.range(.6, 1.4)), tot = ws.reduce((a, b) => a + b, 0);
    let x = k.rand() * W;
    for (const wi of ws) { const pw = wi / tot * W; panels.push({ x, y, w: pw, h: ph, t: k.range(-1, 1) }); x += pw; }
    y += ph;
  }
  const cr = crinkles(k, W, H, o.crinkle ?? 1100, o.crSize ?? 24);
  const wrap = (c, x, y, w, h) => { x = ((x % W) + W) % W; c.fillRect(x, y, w, h); if (x + w > W) c.fillRect(x - W, y, w, h); };
  const map = k.tex(W, H, c => {
    for (const p of panels) { const v = base.map(b => Math.max(0, Math.min(255, Math.round(b + p.t * spread)))); c.fillStyle = `rgb(${v.join(',')})`; wrap(c, p.x, p.y, p.w, p.h); }
    paintFacets(c, cr, v => v < .5 ? `rgba(255,255,255,${(.5 - v) * .34})` : `rgba(30,34,44,${(v - .5) * .3})`);
    for (const p of panels) {
      c.fillStyle = 'rgba(64,70,82,.95)'; wrap(c, p.x - 2, p.y, 4, p.h); c.fillRect(0, p.y - 2, W, 4);
      c.fillStyle = 'rgba(255,255,255,.4)'; wrap(c, p.x + 2, p.y + 2, 5, p.h - 4); c.fillRect(0, p.y + 2, W, 3);
    }
  });
  const bump = k.tex(W, H, c => {
    c.fillStyle = '#808080'; c.fillRect(0, 0, W, H);
    paintFacets(c, cr, v => `rgba(${v < .5 ? '255,255,255' : '0,0,0'},${Math.abs(v - .5) * .7})`);
    c.fillStyle = '#1a1a1a';
    for (const p of panels) { wrap(c, p.x - 2, p.y, 4, p.h); c.fillRect(0, p.y - 2, W, 4); }
  }, { data: true });
  return [repeatTex(k, map), repeatTex(k, bump)];
}
// Crinkled gold foil (multi-layer insulation) for boxes and blankets.
function goldFoil(k, o = {}) {
  const cr = crinkles(k, 256, 256, 520, 20);
  const map = k.tex(256, 256, c => {
    c.fillStyle = o.base ?? '#dba443'; c.fillRect(0, 0, 256, 256);
    paintFacets(c, cr, v => v < .5 ? `rgba(255,238,170,${(.5 - v) * .8})` : `rgba(110,62,8,${(v - .5) * .7})`);
  });
  const bump = k.tex(256, 256, c => { c.fillStyle = '#808080'; c.fillRect(0, 0, 256, 256); paintFacets(c, cr, v => `rgba(${v < .5 ? '255,255,255' : '0,0,0'},${Math.abs(v - .5)})`); }, { data: true });
  return k.mat({ color: '#ffffff', map, bumpMap: bump, bumpScale: o.bump ?? 3, metalness: 1, roughness: o.rough ?? .24 });
}
// Solar cells: a grid of cells, each a two-tone gradient with a faint bus line, in a frame.
function cellTex(k, o) {
  const { w = 256, h = 1024, cols, rows, c0, c1, gap, frame, fw = 8, gw = 3, sheen = .1 } = o;
  return k.tex(w, h, c => {
    c.fillStyle = frame; c.fillRect(0, 0, w, h);
    c.fillStyle = gap; c.fillRect(fw, fw, w - 2 * fw, h - 2 * fw);
    const cw = (w - 2 * fw) / cols, ch = (h - 2 * fw) / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = fw + i * cw + gw / 2, y = fw + j * ch + gw / 2, ww = cw - gw, hh = ch - gw;
      const gr = c.createLinearGradient(x, y, x + ww, y + hh); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
      c.fillStyle = gr; c.fillRect(x, y, ww, hh);
      c.fillStyle = `rgba(255,255,255,${sheen})`; c.fillRect(x, y + hh * .5 - .5, ww, 1); c.fillRect(x + ww * .5 - .5, y, 1, hh);
    }
  });
}
// A 4 × 4 tile of a station module's white debris-shield panels: slightly different whites, softly quilted, seams and bolts.
function moduleSkin(k, tones, o = {}) {
  const W = 512, n = 4, pw = W / n, cells = [];
  for (let i = 0; i < n * n; i++) cells.push({ tone: k.pick(tones), mark: k.rand() });
  const map = k.tex(W, W, c => {
    cells.forEach(({ tone, mark }, i) => {
      const x = (i % n) * pw, y = Math.floor(i / n) * pw;
      c.fillStyle = tone; c.fillRect(x, y, pw, pw);
      const gr = c.createRadialGradient(x + pw / 2, y + pw / 2, pw * .1, x + pw / 2, y + pw / 2, pw * .75);
      gr.addColorStop(0, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(60,70,80,.12)');
      c.fillStyle = gr; c.fillRect(x, y, pw, pw);
      if (mark < .12) { c.fillStyle = o.accent ?? '#c9a24a'; c.fillRect(x + pw * .2, y + pw * .25, pw * .6, pw * .5); }         // a patch of foil
      else if (mark < .2) { c.fillStyle = '#6e757f'; c.fillRect(x + pw * .38, y + pw * .38, pw * .24, pw * .24); }              // a grapple fixture
      c.fillStyle = 'rgba(96,104,116,.7)'; c.fillRect(x, y, pw, 3); c.fillRect(x, y, 3, pw);
      c.fillStyle = 'rgba(110,118,128,.8)';
      for (const [bx, by] of [[12, 12], [pw - 12, 12], [12, pw - 12], [pw - 12, pw - 12]]) { c.beginPath(); c.arc(x + bx, y + by, 3.2, 0, TAU); c.fill(); }
    });
  });
  const bump = k.tex(W, W, c => {
    c.fillStyle = '#808080'; c.fillRect(0, 0, W, W);
    cells.forEach((_, i) => {
      const x = (i % n) * pw, y = Math.floor(i / n) * pw, gr = c.createRadialGradient(x + pw / 2, y + pw / 2, pw * .2, x + pw / 2, y + pw / 2, pw * .7);
      gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(0,0,0,.15)'); c.fillStyle = gr; c.fillRect(x, y, pw, pw);
      c.fillStyle = '#202020'; c.fillRect(x, y, pw, 4); c.fillRect(x, y, 4, pw);
    });
  }, { data: true });
  return [repeatTex(k, map), repeatTex(k, bump)];
}
// A clock wheel: teeth round the rim, a hub hole and parallel-sided spokes between windows.
function gearShape(k, r, n, o = {}) {
  const T = k.THREE, s = new T.Shape(), d = o.tooth ?? Math.min(r * .12, .045), rr = r - d, da = TAU / n;
  for (let i = 0; i < n; i++) {
    const a = i * da;
    for (const [rad, t] of [[rr, 0], [rr, .12], [r, .32], [r, .52], [rr, .72], [rr, .88]]) {
      const x = Math.cos(a + t * da) * rad, y = Math.sin(a + t * da) * rad;
      i || t ? s.lineTo(x, y) : s.moveTo(x, y);
    }
  }
  s.closePath();
  if (o.hub) { const h = new T.Path(); h.absarc(0, 0, o.hub, 0, TAU, true); s.holes.push(h); }
  if (o.spokes) {
    const ro = rr * (o.rim ?? .78), ri = o.inner ?? r * .3, sw = o.sw ?? r * .07;
    for (let j = 0; j < o.spokes; j++) {
      const b0 = j / o.spokes * TAU, b1 = (j + 1) / o.spokes * TAU, p = new T.Path();
      p.absarc(0, 0, ro, b0 + Math.asin(sw / ro), b1 - Math.asin(sw / ro), false);
      p.absarc(0, 0, ri, b1 - Math.asin(sw / ri), b0 + Math.asin(sw / ri), true);
      p.closePath(); s.holes.push(p);
    }
  }
  return s;
}

/* ---------- the planets of the orrery, painted like enamelled balls ---------- */
function planetTex(k, kind) {
  return k.tex(512, 256, (c, w, h) => {
    const blob = (x, y, r, col) => { for (const dx of [-w, 0, w]) { c.fillStyle = col; c.beginPath(); c.ellipse(x + dx, y, r, r * k.range(.5, .9), k.range(0, 3), 0, TAU); c.fill(); } };
    const bands = cols => { let y = 0; while (y < h) { const bh = k.range(8, 26); c.fillStyle = k.pick(cols); c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= w; x += 16) c.lineTo(x, y + Math.sin(x * .03 + y) * 2.5); c.lineTo(w, y + bh + 3); c.lineTo(0, y + bh + 3); c.fill(); y += bh; } };
    if (kind === 'earth') {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2c6fc7'); gr.addColorStop(.5, '#1f84d6'); gr.addColorStop(1, '#2c6fc7');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 7; i++) { const x = k.rand() * w, y = k.range(.25, .75) * h; for (let j = 0; j < 7; j++) blob(x + k.range(-40, 40), y + k.range(-26, 26), k.range(10, 28), j % 3 ? '#4f9a3c' : '#9c8a4e'); }
      c.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = 0; i < 22; i++) { const x = k.rand() * w, y = k.rand() * h; c.beginPath(); c.ellipse(x, y, k.range(18, 50), k.range(3, 7), k.range(-.2, .2), 0, TAU); c.fill(); }
      c.fillStyle = '#f4f8ff'; c.fillRect(0, 0, w, h * .07); c.fillRect(0, h * .93, w, h * .07);
    } else if (kind === 'mars') {
      c.fillStyle = '#c4532c'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) blob(k.rand() * w, k.range(.2, .8) * h, k.range(8, 34), k.rand() < .5 ? 'rgba(120,40,20,.45)' : 'rgba(236,140,90,.35)');
      c.fillStyle = '#fbf2ea'; c.fillRect(0, 0, w, h * .08);
    } else if (kind === 'jupiter') {
      bands(['#efe0c0', '#d6b088', '#c48c5c', '#f4e8d0', '#b8784c', '#e6ccaa']);
      c.fillStyle = '#c4553a'; c.beginPath(); c.ellipse(w * .3, h * .64, 34, 15, 0, 0, TAU); c.fill();
      c.strokeStyle = '#f4e2c8'; c.lineWidth = 4; c.stroke();
    } else if (kind === 'saturn') {
      bands(['#f2e2b2', '#e6cf96', '#f7ecc8', '#d9bc80', '#ecd9a4']);
    } else if (kind === 'venus') {
      c.fillStyle = '#e2aa4c'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 34; i++) blob(k.rand() * w, k.rand() * h, k.range(20, 60), k.rand() < .5 ? 'rgba(255,226,150,.4)' : 'rgba(170,100,30,.3)');
    } else {   // mercury and the moon: grey and cratered
      c.fillStyle = kind === 'moon' ? '#cfcbc3' : '#7d7873'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) blob(k.rand() * w, k.range(.2, .8) * h, k.range(10, 40), 'rgba(90,86,80,.25)');
      for (let i = 0; i < 70; i++) { const x = k.rand() * w, y = k.rand() * h, r = k.range(2, 9); c.fillStyle = 'rgba(70,66,60,.4)'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(x - r * .3, y - r * .3, r * .6, 0, TAU); c.fill(); }
    }
  });
}

export default {
  // A Hubble-style space telescope: a long tube wrapped in silver foil panels, stepping out to a ring of equipment bays at
  // the back, its aperture door swung open at the front, two long blue solar wings, yellow handrails and two dish antennas.
  // It floats tilted up and away, peering off into the deep.
  telescope(k) {
    const T = k.THREE, g = k.group(), tel = k.group(); g.add(tel);
    const R = 1, Rf = .8, yA = .1, yE0 = 1.15, yE1 = 2.25, yL = 4.1, yF = 5.9, Rd = R / Math.cos(Math.PI / 10);
    const skin = o => { const [map, bump] = foilSkin(k, o); return k.mat({ color: '#ffffff', map, bumpMap: bump, bumpScale: o.bs ?? 1.4, metalness: .8, roughness: .3 }); };
    const aftSkin = skin({ rows: 3, cols: 9, base: [218, 222, 228], spread: 14 });
    const fwdSkin = skin({ rows: 7, cols: 8, base: [204, 209, 217], spread: 26 });
    const steel = k.metal('#c3c8cf', .3), grey = k.metal('#8e949c', .4), black = k.matte('#050608', .95);
    const yellow = k.gloss('#f5bc1e', { rough: .28 }), white = k.plastic('#eef0f2', { rough: .4 });
    // the aft shroud, closed by a shallow bulkhead
    k.add(tel, k.cyl(R, R, yE0 - yA, { open: true, seg: 72 }), aftSkin, { p: [0, (yA + yE0) / 2, 0] });
    k.add(tel, k.lathe([[0, -.03], [.4, -.03], [.75, -.01], [.94, .04], [R, yA]], { seg: 72 }), grey);
    // equipment bays: ten flat doors round the widest part
    const bays = k.tex(1280, 256, (c, w, h) => {
      for (let i = 0; i < 10; i++) {
        const x = i * 128;
        c.fillStyle = i % 2 ? '#c6cbd2' : '#d4d8de'; c.fillRect(x, 0, 128, h);
        c.fillStyle = '#e8ebef'; c.fillRect(x + 14, 18, 100, h - 36);
        for (let y = 18; y < h - 18; y += 3) { c.fillStyle = `rgba(0,0,0,${k.range(.02, .07)})`; c.fillRect(x + 14, y, 100, 1); }
        c.strokeStyle = '#626873'; c.lineWidth = 4; c.strokeRect(x + 14, 18, 100, h - 36);
        c.fillStyle = '#4c525b'; for (const [lx, ly] of [[22, 28], [98, 28], [22, h - 40], [98, h - 40]]) c.fillRect(x + lx, ly, 8, 12);
        if (i % 3 === 0) { c.fillStyle = '#e2b12c'; c.fillRect(x + 44, h / 2 - 8, 40, 16); c.fillStyle = '#2a2a2a'; for (let s = 0; s < 4; s++) c.fillRect(x + 46 + s * 10, h / 2 - 8, 4, 16); }
        c.fillStyle = '#6a707a'; c.fillRect(x, 0, 3, h);
      }
    });
    const eq = new T.CylinderGeometry(Rd, Rd, yE1 - yE0, 10, 1, true).toNonIndexed(); eq.computeVertexNormals();
    k.add(tel, eq, k.mat({ map: bays, metalness: .7, roughness: .32 }), { p: [0, (yE0 + yE1) / 2, 0] });
    // the forward shell and light shield, one long slimmer tube, with stiffening rings
    k.add(tel, k.cyl(Rf, Rf, yF - yE1, { open: true, seg: 72 }), fwdSkin, { p: [0, (yE1 + yF) / 2, 0] });
    k.add(tel, k.ring(Rf - .01, Rd + .01, 72), grey, { p: [0, yE1, 0], r: [-Math.PI / 2, 0, 0] });
    for (const [y, r, t] of [[yA, R + .005, .03], [yE0, R + .03, .035], [yE1, R + .03, .035], [yE1 + .03, Rf + .01, .03], [yL, Rf + .012, .028]]) k.add(tel, k.torus(r, t, { rs: 10, ts: 72 }), steel, { p: [0, y, 0], r: [Math.PI / 2, 0, 0] });
    // the open aperture: a black throat with baffle rings, and the rim
    k.add(tel, k.torus(Rf + .01, .045, { rs: 12, ts: 72 }), steel, { p: [0, yF, 0], r: [Math.PI / 2, 0, 0] });
    k.add(tel, k.cyl(Rf - .006, Rf - .006, 1.4, { open: true, seg: 48 }), k.matte('#07080b', .9, { side: T.BackSide }), { p: [0, yF - .7, 0], shadow: false });
    for (const y of [yF - .3, yF - .7]) k.add(tel, k.ring(Rf * .74, Rf - .005, 48), k.matte('#15171c', .8, { side: T.DoubleSide }), { p: [0, y, 0], r: [-Math.PI / 2, 0, 0], shadow: false });
    k.add(tel, k.disc(Rf, 48), black, { p: [0, yF - 1.39, 0], r: [-Math.PI / 2, 0, 0], shadow: false });
    // the aperture door, hinged on the upper side and swung wide open
    const doorIn = k.painted(256, 256, (c, w, h) => {
      c.fillStyle = '#3a3f48'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#59606b'; c.lineWidth = 6;
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + Math.cos(a) * w, h / 2 + Math.sin(a) * w); c.stroke(); }
      for (const r of [.2, .34, .47]) { c.beginPath(); c.arc(w / 2, h / 2, r * w, 0, TAU); c.stroke(); }
    }, { rough: .6, metal: .3 });
    const [dMap, dBump] = foilSkin(k, { w: 512, h: 512, rows: 4, cols: 4, base: [214, 218, 224], spread: 22, crinkle: 500 });
    const doorOut = k.mat({ color: '#ffffff', map: dMap, bumpMap: dBump, bumpScale: 1.4, metalness: .8, roughness: .3 });
    const hinge = k.group([], { p: [Rf + .03, yF + .04, 0], r: [0, 0, -k.deg(112)] }); tel.add(hinge);
    k.add(hinge, k.cyl(Rf + .05, Rf + .05, .06, { seg: 56 }), [steel, doorOut, doorIn], { p: [-(Rf + .05) - .03, 0, 0] });
    k.add(hinge, k.torus(Rf + .05, .03, { rs: 8, ts: 56 }), steel, { p: [-(Rf + .05) - .03, -.01, 0], r: [Math.PI / 2, 0, 0] });
    k.add(hinge, k.cyl(.035, .035, .6, { seg: 12 }), steel, { r: [Math.PI / 2, 0, 0] });
    k.add(hinge, k.box(.5, .05, .08, .015), grey, { p: [-.25, -.06, 0] });
    // two long blue solar wings on arms out of the sides
    const cells = cellTex(k, { w: 256, h: 1024, cols: 4, rows: 20, c0: '#3057c4', c1: '#15296f', gap: '#9aa4b4', frame: '#d3d8de', fw: 8, gw: 5, sheen: .12 });
    const cellMat = k.mat({ map: cells, roughness: .26, metalness: .35, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: 1.2 });
    const yW = 2.4, xm = Rf + 1.0, Lw = 3.4, pw = .6, gap = .08, panel = k.box(pw, Lw, .025);
    for (const s of [-1, 1]) {
      k.add(tel, k.box(.14, .24, .24, .03), grey, { p: [s * (Rf + .04), yW, 0] });
      tel.add(rod(k, [s * Rf, yW, 0], [s * (xm - .03), yW, 0], .045, steel));
      const wing = k.group([], { p: [s * xm, yW, 0], r: [.3, 0, 0] }); tel.add(wing);
      k.add(wing, k.cyl(.035, .035, Lw + .3, { seg: 12 }), steel);
      k.add(wing, k.box(.12, .16, .12, .02), grey);
      for (const t of [-1, 1]) k.add(wing, panel, [steel, steel, steel, steel, cellMat, cellMat], { p: [t * (pw / 2 + gap / 2), 0, 0] });
      for (const e of [-1, 1]) k.add(wing, k.box(2 * pw + gap + .04, .04, .05, .01), steel, { p: [0, e * (Lw / 2 + .02), 0] });
    }
    // two high-gain dish antennas on booms, top and bottom
    const dishGeo = k.lathe(Array.from({ length: 9 }, (_, i) => { const x = i / 8 * .34; return [x, x * x * 1.1]; }), { seg: 40 });
    const dishMat = k.plastic('#f2f0ea', { rough: .45, side: T.DoubleSide });
    for (const s of [-1, 1]) {
      const tip = [0, yW - .55, s * (Rf + 1.15)];
      tel.add(rod(k, [0, yW, s * Rf], tip, .03, steel));
      const d = k.group([], { p: tip }); orient(k, d, [0, .55, s]); tel.add(d);
      k.add(d, dishGeo, dishMat);
      k.add(d, k.cyl(.02, .02, .22, { seg: 8 }), steel, { p: [0, .11, 0] });
      k.add(d, k.cyl(.045, .03, .06, { seg: 12 }), grey, { p: [0, .24, 0] });
    }
    // yellow handrails running along the body, on stand-offs
    const rails = [], posts = [];
    const railAt = (th, r, y0, y1, off) => {
      const P = (rr, y, b) => [Math.sin(th) * rr, y, Math.cos(th) * rr, b];
      rails.push(bentTube(k, [P(r, y0), P(r + off, y0, .04), P(r + off, y1, .04), P(r, y1)], .022, { seg: 48, rs: 8 }));
      for (let y = y0 + .45; y < y1 - .2; y += .45) posts.push(strut(k, P(r, y), P(r + off, y), .014));
    };
    for (const th of [35, 145, 215, 325]) railAt(k.deg(th), R, .3, yE1 - .12, .1);
    for (const th of [45, 135, 225, 315]) railAt(k.deg(th), Rf, yE1 + .2, yL - .15, .08);
    for (const th of [30, 150, 210, 330]) railAt(k.deg(th), Rf, yL + .2, yF - .25, .08);
    k.add(tel, k.merge(rails), yellow);
    tel.add(k.instances(k.cyl(1, 1, 1, { seg: 8 }), yellow, posts));
    // small antennas and sensors
    tel.add(rod(k, [0, yF - .35, Rf], [0, yF - .35, Rf + .14], .015, steel));
    k.add(tel, k.cone(.06, .12, 16), white, { p: [0, yF - .35, Rf + .2], r: [Math.PI / 2, 0, 0] });
    tel.add(rod(k, [0, -.02, 0], [0, -.26, 0], .018, steel));
    k.add(tel, k.cone(.07, .14, 16), white, { p: [0, -.32, 0], r: [Math.PI, 0, 0] });
    for (const s of [-1, 1]) k.add(tel, k.box(.1, .14, .08, .02), grey, { p: [Math.sin(s * 1.05) * (Rf + .05), yF - .22, Math.cos(s * 1.05) * (Rf + .05)], r: [0, s * 1.05, 0] });
    tel.add(k.instances(k.box(1, 1, 1, 0), grey, [[.35, .2], [-.3, .4], [.1, -.45]].map(([x, z]) => ({ p: [x, -.06, z], s: [.22, .07, .16] }))));
    // tilt it up and away: aperture to the upper left, going into the picture, wings turned to catch the light
    const cam = camDir(k), right = new T.Vector3(cam.z, 0, -cam.x).normalize(), up = new T.Vector3().crossVectors(cam, right);
    const a = k.deg(24), b = k.deg(9);
    const D = right.clone().multiplyScalar(-Math.cos(a) * Math.cos(b)).addScaledVector(up, Math.sin(a) * Math.cos(b)).addScaledVector(cam, -Math.sin(b)).normalize();
    const N = cam.clone().addScaledVector(D, -cam.dot(D)).normalize().applyAxisAngle(D, k.deg(32));
    tel.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3().crossVectors(D, N), D, N));
    g.userData.floating = true;
    g.userData.noHero = true;
    return g;
  },

  // An ISS-style space station: a long lattice truss carrying four pairs of huge gold solar wings (each with a newer blue
  // array in front of it), white radiators, a cluster of white modules in the middle with a cupola and a robot arm, and a
  // small capsule docked on top.
  station(k) {
    const T = k.THREE, g = k.group();
    const TH = .4, TW = .44, M = 1.35, MR = .3 * M, MY = -(TH / 2 + .07 + MR);   // truss height and depth; modules drawn a size up, their axis under the truss
    const trussM = k.metal('#cfd3d8', .34), greyM = k.metal('#9aa0a8', .4), darkM = k.metal('#50555e', .45);
    const gold = goldFoil(k);
    const [mMap, mBump] = moduleSkin(k, ['#f3f4f2', '#eceeec', '#e4e7e6', '#f7f7f5', '#dde1e1']);
    const white = k.mat({ map: mMap, bumpMap: mBump, bumpScale: .8, roughness: .5, clearcoat: .3, clearcoatRoughness: .4 });
    const [rMap, rBump] = moduleSkin(k, ['#e6e7e1', '#dadcd4', '#d2d6cc', '#ebebe6'], { accent: '#b8c2c8' });
    const russian = k.mat({ map: rMap, bumpMap: rBump, bumpScale: .8, roughness: .55, clearcoat: .2 });
    const unit = k.cyl(1, 1, 1, { seg: 6 });
    // ---- the truss: a solid centre section and lattice to either side
    const struts = [];
    const lattice = (list, xa, xb, bays) => {
      const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), hy = TH / 2, hz = TW / 2, C = [[hy, hz], [hy, -hz], [-hy, -hz], [-hy, hz]], bl = (x1 - x0) / bays;
      for (const [y, z] of C) list.push(strut(k, [x0, y, z], [x1, y, z], .022));
      for (let i = 0; i <= bays; i++) for (let j = 0; j < 4; j++) { const [ya, za] = C[j], [yb, zb] = C[(j + 1) % 4]; list.push(strut(k, [x0 + i * bl, ya, za], [x0 + i * bl, yb, zb], .014)); }
      for (let i = 0; i < bays; i++) for (let j = 0; j < 4; j++) { const [ya, za] = C[j], [yb, zb] = C[(j + 1) % 4], f = (i + j) % 2, xa2 = x0 + i * bl, xb2 = xa2 + bl; list.push(strut(k, [f ? xa2 : xb2, ya, za], [f ? xb2 : xa2, yb, zb], .012)); }
    };
    lattice(struts, .62, 1.98, 3); lattice(struts, -1.98, -.62, 3);
    g.add(k.instances(unit, trussM, struts));
    const s0 = k.painted(512, 256, (c, w, h) => {
      c.fillStyle = '#b9bec5'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) { c.fillStyle = k.pick(['#d6dade', '#c5cad0', '#e2e4e6', '#a9aeb6']); c.fillRect(i * 64 + 4, 20, 56, h - 40); }
      c.strokeStyle = '#7d838c'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6); c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
      c.fillStyle = '#d9a441'; c.fillRect(140, 40, 90, 70); c.fillRect(330, 150, 80, 60);
    }, { rough: .45, metal: .4 });
    k.add(g, k.box(1.24, TH + .02, TW + .02, .02), s0);
    g.add(k.instances(k.box(1, 1, 1, .1), gold, [[-.35, .25, .1, .3, .12, .22], [.3, .25, -.08, .36, .1, .26], [0, .26, .12, .16, .14, .16]].map(([x, y, z, w, h, d]) => ({ p: [x, y, z], s: [w, h, d] }))));
    // big white radiators hanging down and back from the inner truss, three a side
    const radTex = k.painted(128, 512, (c, w, h) => {
      c.fillStyle = '#f2f4f6'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#e3e8ee' : '#f7f8fa'; c.fillRect(4, i * h / 6 + 4, w - 8, h / 6 - 8); c.fillStyle = '#9aa2ad'; c.fillRect(0, i * h / 6, w, 4); }
      c.fillStyle = 'rgba(120,130,140,.35)'; for (let x = 16; x < w; x += 16) c.fillRect(x, 0, 1.5, h);
    }, { rough: .5 });
    const radEdge = k.matte('#c9ced4', .5), rads = [];
    for (const s of [-1, 1]) for (const x of [1.36, 1.63, 1.9]) { const phi = .62, L = 2.0; rads.push({ p: [s * x, -TH / 2 - .02 - Math.cos(phi) * L / 2, -.06 - Math.sin(phi) * L / 2], r: [phi, 0, 0] }); }
    g.add(k.instances(k.box(.24, 2.0, .018), [radEdge, radEdge, radEdge, radEdge, radTex, radTex], rads));
    // ---- the outboard truss on each side, turned on its rotary joint, with two pairs of solar wings. Each old gold wing
    // has a newer, shorter blue roll-out array mounted in front of it, canted out.
    const goldCells = k.tex(128, 1024, (c, w, h) => {
      c.fillStyle = '#26305e'; c.fillRect(0, 0, w, h);
      const cols = 3, rows = 36, fw = 5, gw = 3, cw = (w - 2 * fw) / cols, ch = (h - 2 * fw) / rows;
      for (let j = 0; j < rows; j++) {
        const tone = k.range(-.08, .08), band = Math.floor(j / 4) % 2 ? .06 : 0;
        for (let i = 0; i < cols; i++) {
          const x = fw + i * cw + gw / 2, y = fw + j * ch + gw / 2, ww = cw - gw, hh = ch - gw, gr = c.createLinearGradient(x, y, x + ww, y + hh);
          const L = v => Math.max(0, Math.min(255, Math.round(v * (1 + tone + band))));
          gr.addColorStop(0, `rgb(${L(244)},${L(186)},${L(84)})`); gr.addColorStop(1, `rgb(${L(190)},${L(118)},${L(34)})`);
          c.fillStyle = gr; c.fillRect(x, y, ww, hh);
          c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x, y + hh * .5 - .5, ww, 1);
        }
      }
    });
    const blueCells = cellTex(k, { w: 128, h: 512, cols: 3, rows: 16, c0: '#3b66d6', c1: '#15296e', gap: '#a3adbd', frame: '#d6dbe2', fw: 5, gw: 3, sheen: .14 });
    const backCells = cellTex(k, { w: 64, h: 512, cols: 2, rows: 18, c0: '#d9c9a6', c1: '#c2ae86', gap: '#8c8a86', frame: '#9a968e', fw: 3, gw: 2, sheen: .05 });
    const cellsF = k.mat({ map: goldCells, roughness: .32, metalness: .4, clearcoat: 1, clearcoatRoughness: .12, envMapIntensity: 1.1 });
    const cellsB = k.mat({ map: backCells, roughness: .6, metalness: .1 });
    const blueF = k.mat({ map: blueCells, roughness: .26, metalness: .35, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: 1.2 });
    const edge = k.matte('#c8c2b0', .6), Lw = 3.2, bw = .5, Li = 1.75, iw = .4, cant = .1;
    const [iMap, iBump] = foilSkin(k, { w: 256, h: 256, rows: 2, cols: 3, base: [210, 214, 220], spread: 18, crinkle: 200 });
    const iea = k.mat({ color: '#ffffff', map: iMap, bumpMap: iBump, bumpScale: 1.2, metalness: .7, roughness: .34 });
    const qb = new T.Quaternion(), qc = new T.Quaternion(), Yax = new T.Vector3(0, 1, 0), Xax = new T.Vector3(1, 0, 0);
    // an instance at p in a wing's own frame, turned (with the wing) by beta round its mast at x0, and canted by c
    const onWing = (list, x0, beta, p, c, s) => {
      const v = new T.Vector3(...p).applyAxisAngle(Yax, beta); v.x += x0;
      const e = new T.Euler().setFromQuaternion(qb.setFromAxisAngle(Yax, beta).multiply(qc.setFromAxisAngle(Xax, c)));
      list.push({ p: v.toArray(), r: [e.x, e.y, e.z], s });
    };
    for (const s of [-1, 1]) {
      const ob = k.group([], { p: [s * 2.1, 0, 0], r: [-.2, 0, 0] }); g.add(ob);
      const X = d => s * d, list = [], blankets = [], iros = [], masts = [], boxes = [], gimbals = [];
      k.add(ob, k.cyl(.3, .3, .16, { seg: 40 }), greyM, { r: [0, 0, Math.PI / 2] });
      k.add(ob, k.torus(.3, .03, { rs: 8, ts: 40 }), gold, { r: [0, Math.PI / 2, 0] });
      lattice(list, X(.1), X(.62), 1); lattice(list, X(1.36), X(1.86), 1);
      ob.add(k.instances(unit, trussM, list));
      for (const d of [.87, 2.11]) k.add(ob, k.box(.5, TH + .04, TW + .04, .02), iea, { p: [X(d), 0, 0] });
      ob.add(k.instances(k.box(1, 1, 1, .08), gold, [[.25, .26, .08], [.45, -.26, -.1]].map(([d, y, z]) => ({ p: [X(d), y, z], s: [.18, .12, .2] }))));
      // photovoltaic radiators off the back of each wing module
      ob.add(k.instances(k.box(.3, .016, 1.2), [radEdge, radEdge, radTex, radTex, radEdge, radEdge], [.87, 2.11].map(d => ({ p: [X(d), -.05, -TW / 2 - .62], r: [.12, 0, 0] }))));
      const betas = s > 0 ? [[.3, -.12], [-.16, .22]] : [[-.22, .1], [.2, -.26]];
      [1.24, 2.48].forEach((d, wi) => [1, -1].forEach((dir, di) => {
        const b = betas[wi][di], y0 = dir * (TH / 2 + .2), cy = y0 + dir * Lw / 2;
        gimbals.push({ p: [X(d), dir * (TH / 2 + .06), 0], s: [.1, .12, .1] });
        onWing(masts, X(d), b, [0, cy, 0], 0, [.022, Lw + .1, .022]);
        for (const t of [-1, 1]) onWing(blankets, X(d), b, [t * (bw / 2 + .04), cy, 0], 0);
        onWing(boxes, X(d), b, [0, dir * (TH / 2 + .16), 0], 0, [2 * bw + .12, .07, .12]);
        onWing(boxes, X(d), b, [0, dir * (TH / 2 + .24 + Lw), 0], 0, [2 * bw + .12, .05, .1]);
        // the roll-out array: from a bracket at the wing's root, leaning out in front of it
        const ic = [0, y0 + dir * (.12 + Math.cos(cant) * Li / 2), .1 + Math.sin(cant) * Li / 2];
        for (const t of [-1, 1]) onWing(iros, X(d), b, [t * (iw / 2 + .03), ic[1], ic[2]], dir * cant);
        onWing(masts, X(d), b, [0, ic[1], ic[2] + .01], dir * cant, [.018, Li, .018]);
        onWing(boxes, X(d), b, [0, y0 + dir * .08, .1], 0, [2 * iw + .1, .06, .1]);
      }));
      ob.add(k.instances(k.box(bw, Lw, .012), [edge, edge, edge, edge, cellsF, cellsB], blankets));
      ob.add(k.instances(k.box(iw, Li, .01), [edge, edge, edge, edge, blueF, cellsB], iros));
      ob.add(k.instances(unit, greyM, masts));
      ob.add(k.instances(k.box(1, 1, 1, .15), k.plastic('#e9e6dc', { rough: .5 }), boxes));
      ob.add(k.instances(k.cyl(1, 1, 1, { seg: 20 }), darkM, gimbals));
      k.add(ob, k.sphere(.035, { w: 12, h: 8 }), k.glow(s > 0 ? '#3dff7a' : '#ff3b30', 2.4), { p: [X(2.6), 0, TW / 2], shadow: false });
    }
    // ---- the pressurized modules: a spine under the truss, side modules off its nodes
    const modGeo = (len, r, o = {}) => {
      const e = o.end ?? .15, hr = o.hatch ?? .6;
      const geo = k.lathe([[0, 0], [r * hr, 0], [r * hr, .03], [r * .86, e * .55], [r, e], [r, len - e], [r * .86, len - e * .55], [r * hr, len - .03], [r * hr, len], [0, len]], { seg: 48 });
      tileUV(geo, Math.max(1, Math.round(r * TAU / 1.1)), 1.1); geo.translate(0, -len / 2, 0);
      return geo;
    };
    const AX = { z: [Math.PI / 2, 0, 0], x: [0, 0, -Math.PI / 2], y: [0, 0, 0] };
    const mod = (len, r, p, axis, mat = white, o) => k.add(g, modGeo(len * M, r * M, o), mat, { p, r: AX[axis] });
    const cbm = [], ring = (p, axis) => cbm.push({ p, r: AX[axis], s: [.27, .12, .27] });
    const zN2 = .81 + .1 + .54, zN1 = -(.81 + .1 + .42);
    mod(1.2, .3, [0, MY, 0], 'z');                                                          // the lab, right under the truss
    for (const x of [-.45, .45]) g.add(rod(k, [x, MY + MR - .03, 0], [x, -TH / 2, 0], .035, greyM));
    mod(.8, .3, [0, MY, zN2], 'z'); ring([0, MY, .86], 'z');                                // the forward node
    mod(.85, .27, [1.08, MY, zN2], 'x'); ring([.455, MY, zN2], 'x');                        // a lab to starboard
    mod(1.15, .3, [-1.28, MY, zN2], 'x'); ring([-.455, MY, zN2], 'x');                      // the big lab to port, its attic and its porch
    mod(.46, .24, [-1.2, MY + MR + .36, zN2], 'y');
    k.add(g, k.box(.56, .08, .62, .02), greyM, { p: [-2.36, MY - .1, zN2] });
    g.add(k.instances(k.box(1, 1, 1, .05), gold, [[-2.2, .16, zN2 - .16], [-2.5, .12, zN2 + .14], [-2.26, .1, zN2 + .2]].map(([x, h, z]) => ({ p: [x, MY - .06 + h / 2, z], s: [.2, h, .18] }))));
    mod(.62, .3, [0, MY, zN1], 'z'); ring([0, MY, -.86], 'z');                              // the aft node
    mod(.8, .28, [-1.045, MY, zN1], 'x'); ring([-.455, MY, zN1], 'x');                      // the node with the cupola under it
    mod(.5, .24, [.845, MY, zN1], 'x'); ring([.455, MY, zN1], 'x');                         // the airlock
    mod(.3, .17, [1.385, MY, zN1], 'x');
    mod(1.0, .26, [0, MY, -2.46], 'z', russian); ring([0, MY, -1.83], 'z');                 // and the older modules trailing behind
    k.add(g, k.sphere(.27, { w: 28, h: 18 }), russian, { p: [0, MY, -3.4] });
    mod(1.2, .27, [0, MY, -4.46], 'z', russian, { hatch: .5 });
    g.add(k.instances(unit, greyM, cbm));
    // the cupola: a little seven-window dome looking down, lit from inside
    const cup = k.group([], { p: [-1.045, MY - .38, zN1], r: [Math.PI, 0, 0], s: 1.35 }); g.add(cup);
    k.add(cup, k.cyl(.19, .19, .06, { seg: 24 }), greyM, { p: [0, .03, 0] });
    const winMat = k.mat({ color: '#ffe0a0', emissive: k.color('#ffc466'), emissiveIntensity: 1.1, roughness: .1, clearcoat: 1 });
    k.add(cup, k.cyl(.12, .18, .1, { seg: 6 }), [winMat, greyM, greyM], { p: [0, .11, 0] });
    k.add(cup, k.cyl(.11, .11, .02, { seg: 24 }), greyM, { p: [0, .17, 0] });
    // the service module's own blue wings
    const rusCells = cellTex(k, { w: 256, h: 128, cols: 8, rows: 3, c0: '#3a63d0', c1: '#162d78', gap: '#b7bec8', frame: '#d0d4da', fw: 5, gw: 3 });
    const rusMat = k.mat({ map: rusCells, roughness: .28, metalness: .35, clearcoat: 1, clearcoatRoughness: .1 });
    for (const s of [-1, 1]) {
      g.add(rod(k, [s * .3, MY, -4.7], [s * .55, MY, -4.7], .025, greyM));
      k.add(g, k.box(1.5, .014, .48), [edge, edge, rusMat, cellsB, edge, edge], { p: [s * 1.3, MY, -4.7], r: [0, 0, s * .25] });
    }
    // docking adapters at the front and on top of the forward node, and a capsule docked on top
    const zD = zN2 + .54, adapter = k.lathe([[0, 0], [.27, 0], [.27, .08], [.22, .19], [.2, .27], [0, .27]], { seg: 32 });
    k.add(g, adapter, white, { p: [0, MY, zD], r: [Math.PI / 2, 0, 0] });
    k.add(g, adapter, white, { p: [0, MY + MR - .03, zN2] });
    const capTex = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#f4f4f1'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1d1f24'; c.fillRect(0, h * .72, w, h * .12);               // the thruster band near the nose
      for (let i = 0; i < 4; i++) { c.fillStyle = '#3a3d44'; c.fillRect(i * w / 4 + 20, h * .7, 22, h * .16); }
      c.fillStyle = '#1c3552'; for (const x of [.3, .8]) { c.beginPath(); c.roundRect(x * w - 10, h * .4, 20, 20, 5); c.fill(); }
      c.fillStyle = '#c9ccd2'; c.fillRect(0, 0, w, 6);
    });
    const capGeo = k.lathe([[0, 0], [.3, 0], [.305, .02], [.29, .06], [.13, .42], [.12, .46], [0, .46]], { seg: 48 });
    tileUV(capGeo, 1, .46);
    const capTop = MY + MR - .03 + .27 + .46 * 1.3;
    const capsule = k.group([], { p: [0, capTop, zN2], r: [Math.PI, .5, 0], s: 1.3 }); g.add(capsule);   // nose down on the port, trunk up
    k.add(capsule, capGeo, k.mat({ map: capTex, roughness: .4, clearcoat: .5 }));
    k.add(capsule, k.cyl(.3, .3, .04, { seg: 48 }), k.matte('#26282d', .7), { p: [0, -.02, 0] });
    const trunkTex = k.tex(512, 128, (c, w, h) => {
      c.fillStyle = '#eceeef'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { const x = w * .25 + i * w * .5 / 16, y = 8 + j * (h - 16) / 4; c.fillStyle = (i + j) % 2 ? '#1a2f78' : '#233c92'; c.fillRect(x + 1, y + 1, w * .5 / 16 - 2, (h - 16) / 4 - 2); }
      c.fillStyle = '#b8bec6'; c.fillRect(0, 0, w, 5); c.fillRect(0, h - 5, w, 5);
    });
    k.add(capsule, k.cyl(.3, .3, .44, { open: true, seg: 48 }), k.mat({ map: trunkTex, roughness: .35, metalness: .2, clearcoat: .6 }), { p: [0, -.26, 0] });
    k.add(capsule, k.cyl(.29, .29, .42, { open: true, seg: 32 }), k.matte('#2a2d33', .8, { side: T.BackSide }), { p: [0, -.26, 0] });
    k.add(capsule, k.torus(.3, .018, { rs: 8, ts: 48 }), k.metal('#b8bec6', .35), { p: [0, -.48, 0], r: [Math.PI / 2, 0, 0] });
    k.add(capsule, k.disc(.29, 32), k.matte('#3a3e46', .7), { p: [0, -.12, 0], r: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .4; k.add(capsule, k.box(.02, .14, .12, .005), k.plastic('#e6e8ea'), { p: [Math.sin(a) * .34, -.42, Math.cos(a) * .34], r: [0, a, 0] }); }
    k.add(capsule, k.sphere(.12, { w: 20, h: 10, thetaLen: Math.PI / 2 }), k.plastic('#f4f4f1'), { p: [.02, .5, .2], r: [-1.9, 0, 0], s: [1, .5, 1] });
    // the robot arm, reaching up over the truss
    const armW = k.plastic('#f1f1ee', { rough: .45 }), joint = k.metal('#6b717a', .4);
    const A0 = [-1.12, TH / 2 + .1, .05], A1 = [-1.7, 1.62, .42], A2 = [-.72, 2.28, .9];
    for (const [p, q] of [[A0, A1], [A1, A2]]) g.add(rod(k, p, q, .062, armW));
    for (const p of [A0, A1, A2]) k.add(g, k.cyl(.1, .1, .2, { seg: 20 }), joint, { p, r: [Math.PI / 2, 0, 0] });
    g.add(rod(k, A2, [-.52, 2.02, 1.08], .065, joint));
    k.add(g, k.box(.2, .08, .2, .02), darkM, { p: [A0[0], TH / 2 + .03, A0[2]] });
    // a few little lights
    const lights = [[0, MY + MR + .01, zN2 + .3, '#ffffff'], [1.66, MY + .1, zN2, '#ff4a3a'], [-2.06, MY + .1, zN2, '#4dff8a'], [0, MY + .37, -5.05, '#ffffff'], [.4, capTop - .1, zN2, '#ffd27a']];
    for (const [x, y, z, c] of lights) k.add(g, k.sphere(.035, { w: 10, h: 8 }), k.glow(c, 2.6), { p: [x, y, z], shadow: false });
    g.userData.floating = true;
    g.userData.noHero = true;
    g.userData.view = { az: 30, el: 22 };
    return g;
  },

  // A backyard refractor: a glossy white tube with a dew shield, a finder scope, a star diagonal and eyepiece at the back,
  // on an alt-az mount with slow-motion cables, standing on an aluminium tripod with an accessory tray.
  stargazer(k) {
    const T = k.THREE, g = k.group();
    const white = k.gloss('#f7f7f3'), black = k.plastic('#16171b', { rough: .38, coat: .5 }), satin = k.plastic('#2a2b31', { rough: .55, coat: .15 });
    const alu = k.metal('#dde0e4', .24), alu2 = k.metal('#c4c9cf', .3), chrome = k.chrome(), rubber = k.rubber('#141416');
    const Ht = 1.86;
    // ---- the tripod: three legs with clamps, a head and a tray
    const legs = [k.deg(210), k.deg(90), k.deg(-30)], top = Ht - .12, foot = 1.08, rT = .15;
    const legPt = (th, f) => [Math.sin(th) * (rT + (foot - rT) * f), top * (1 - f), Math.cos(th) * (rT + (foot - rT) * f)];
    for (const th of legs) {
      g.add(rod(k, legPt(th, 0), legPt(th, .56), .05, alu));
      g.add(rod(k, legPt(th, .5), legPt(th, .985), .036, alu2));
      const cl = k.mesh(k.cyl(.064, .064, .14, { seg: 16 }), satin, { p: legPt(th, .56) }); g.add(orient(k, cl, [legPt(th, 1)[0] - legPt(th, 0)[0], -top, legPt(th, 1)[2] - legPt(th, 0)[2]]));
      k.add(g, k.cyl(.035, .05, .06, { seg: 16 }), rubber, { p: [legPt(th, 1)[0], .03, legPt(th, 1)[2]] });
      k.add(g, k.box(.1, .1, .12, .02), satin, { p: [Math.sin(th) * .17, Ht - .08, Math.cos(th) * .17], r: [0, th, 0] });
    }
    k.add(g, k.rcyl(.2, .09, .02, { seg: 40 }), satin, { p: [0, Ht - .12, 0] });
    // the accessory tray: a rounded triangle with holes, braced to the legs, two eyepieces waiting in it
    const yT = .8, rc = .09, rC = .36, tray = new T.Shape();
    const corners = legs.map(th => th - Math.PI / 2).sort((p, q) => p - q);
    for (const a of corners) tray.absarc(Math.cos(a) * (rC - rc), Math.sin(a) * (rC - rc), rc, a - Math.PI / 3, a + Math.PI / 3, false);
    tray.closePath();
    const holes = corners.map(a => { const p = new T.Path(); p.absarc(Math.cos(a) * .24, Math.sin(a) * .24, .058, 0, TAU, true); return p; });
    for (const a of corners) { const p = new T.Path(), m = a + Math.PI / 3; p.absarc(Math.cos(m) * .13, Math.sin(m) * .13, .035, 0, TAU, true); holes.push(p); }
    k.add(g, k.extrude(tray, .03, { bevel: .01, holes }), alu2, { p: [0, yT, 0], r: [-Math.PI / 2, 0, 0] });
    for (const th of legs) {
      const f = 1 - (yT + .01) / top, rl = rT + (foot - rT) * f;
      g.add(rod(k, [Math.sin(th) * (rC - .02), yT, Math.cos(th) * (rC - .02)], [Math.sin(th) * rl, yT + .01, Math.cos(th) * rl], .016, alu2));
    }
    for (const th of [legs[1], legs[2]]) {
      const x = Math.sin(th) * .24, z = Math.cos(th) * .24;
      k.add(g, k.cyl(.048, .048, .12, { seg: 20 }), chrome, { p: [x, yT - .02, z] });
      k.add(g, k.rcyl(.066, .15, .015, { seg: 24 }), black, { p: [x, yT + .03, z] });
      k.add(g, k.cyl(.05, .05, .012, { seg: 20 }), chrome, { p: [x, yT + .185, z] });
    }
    // ---- the alt-az mount, turned so the tube points off to the left
    const mount = k.group([], { p: [0, Ht - .03, 0], r: [0, k.deg(10), 0] }); g.add(mount);
    k.add(mount, k.cyl(.15, .15, .1, { seg: 32 }), satin, { p: [0, .05, 0] });
    k.add(mount, k.cyl(.155, .155, .03, { seg: 32 }), chrome, { p: [0, .1, 0] });
    k.add(mount, k.box(.22, .3, .17, .04), black, { p: [0, .26, 0] });
    k.add(mount, k.cyl(.11, .11, .06, { seg: 28 }), satin, { p: [0, .38, -.1], r: [Math.PI / 2, 0, 0] });
    const lock = k.knob(.07, .06, black, k.matte('#d8dadd', .4)); lock.rotation.x = Math.PI / 2; lock.position.set(0, .38, .085); mount.add(lock);
    // slow-motion cables hanging back toward the eyepiece, knobs on the ends
    for (const pts of [[[.11, .34, .05], [.3, .16, .1], [.4, -.14, .13], [.43, -.44, .14]], [[.12, .07, -.05], [.28, -.1, -.1], [.36, -.36, -.12], [.38, -.6, -.12]]]) {
      k.add(mount, k.tube(pts, .012, { seg: 32, rs: 6 }), chrome);
      const e = pts[3], kb = k.group([], { p: e }); mount.add(kb);
      k.add(kb, k.cyl(.04, .04, .09, { seg: 16 }), black, { p: [0, -.05, 0] });
      k.add(kb, k.cyl(.042, .042, .02, { seg: 16 }), chrome, { p: [0, -.1, 0] });
    }
    // ---- the tube, on its dovetail, tipped up toward the Moon
    const alt = k.group([], { p: [0, .44, 0], r: [0, 0, -k.deg(27)] }); mount.add(alt);
    k.add(alt, k.box(.5, .05, .16, .015), satin, { p: [0, -.025, 0] });
    const tube = k.group([], { p: [1.0, .33, 0], r: [0, 0, Math.PI / 2] }); alt.add(tube);   // tube: axis +y (back to front), top +x, camera side +z
    const r = .2;
    k.add(tube, k.cyl(r, r, 1.96, { seg: 56 }), white, { p: [0, .98, 0] });
    k.add(tube, k.lathe([[0, -.06], [.19, -.06], [.212, -.04], [.214, .08], [.2, .09]], { seg: 56 }), black);
    k.add(tube, k.lathe([[.2, 1.9], [.214, 1.91], [.216, 2.04], [.2, 2.06]], { seg: 56 }), black);
    k.add(tube, k.cyl(.234, .234, .7, { open: true, seg: 56 }), white, { p: [0, 2.36, 0] });
    k.add(tube, k.cyl(.226, .226, .7, { open: true, seg: 56 }), k.matte('#101114', .9, { side: T.BackSide }), { p: [0, 2.36, 0] });
    k.add(tube, k.torus(.23, .012, { rs: 8, ts: 56 }), black, { p: [0, 2.71, 0], r: [Math.PI / 2, 0, 0] });
    k.add(tube, k.lathe([[.2, 2.0], [.234, 2.02], [.234, 2.04], [0, 2.04]], { seg: 56 }), black);
    k.add(tube, k.disc(.2, 48), k.mat({ color: '#0b2b2a', metalness: .6, roughness: .06, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [300, 700] }), { p: [0, 2.07, 0], r: [-Math.PI / 2, 0, 0] });
    // the label on the side facing us, reading along the tube (front to back is left to right)
    const lbl = k.painted(160, 512, (c, w, h) => {
      c.fillStyle = '#1f3f8f'; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 20); c.fill();
      c.strokeStyle = '#e8c35a'; c.lineWidth = 4; c.beginPath(); c.roundRect(13, 13, w - 26, h - 26, 13); c.stroke();
      c.save(); c.translate(w / 2, h / 2); c.rotate(Math.PI / 2);
      k.text(c, 'STARGAZER', 0, -14, { size: 60, color: '#ffffff' });
      k.text(c, 'D 70 mm  ·  F 700 mm', 0, 38, { size: 24, weight: 800, font: 'Nunito, system-ui, sans-serif', color: '#e8c35a' });
      c.restore();
    }, { rough: .3, coat: .8, transparent: true });
    k.add(tube, k.cyl(r + .003, r + .003, .62, { open: true, start: -.5, len: 1.0, seg: 24 }), lbl, { p: [0, 1.0, 0], shadow: false });
    // tube rings on a dovetail bar
    for (const y of [.55, 1.45]) {
      k.add(tube, k.torus(r + .018, .022, { rs: 8, ts: 48 }), black, { p: [0, y, 0], r: [Math.PI / 2, 0, 0] });
      k.add(tube, k.box(.08, .06, .06, .01), black, { p: [-r - .04, y, 0] });
      k.add(tube, k.cyl(.02, .02, .05, { seg: 10 }), chrome, { p: [r + .03, y, 0], r: [0, 0, Math.PI / 2] });
    }
    k.add(tube, k.box(.05, 1.35, .1, .012), alu2, { p: [-r - .085, 1.0, 0] });
    // the focuser, a star diagonal and the eyepiece pointing up
    k.add(tube, k.cyl(.12, .12, .16, { seg: 32 }), black, { p: [0, -.13, 0] });
    k.add(tube, k.box(.1, .15, .13, .02), black, { p: [-.13, -.12, 0] });
    k.add(tube, k.cyl(.012, .012, .3, { seg: 8 }), chrome, { p: [-.15, -.12, 0], r: [Math.PI / 2, 0, 0] });
    for (const s of [-1, 1]) {
      k.add(tube, k.cyl(.055, .055, .04, { seg: 24 }), chrome, { p: [-.15, -.12, s * .15], r: [Math.PI / 2, 0, 0] });
      k.add(tube, k.cyl(.03, .03, .045, { seg: 16 }), black, { p: [-.15, -.12, s * .175], r: [Math.PI / 2, 0, 0] });
    }
    k.add(tube, k.cyl(.07, .07, .22, { seg: 28 }), chrome, { p: [0, -.31, 0] });
    k.add(tube, k.cyl(.075, .075, .05, { seg: 28 }), black, { p: [0, -.43, 0] });
    k.add(tube, k.box(.15, .15, .15, .04), black, { p: [.02, -.52, 0] });
    k.add(tube, k.cyl(.068, .068, .1, { seg: 28 }), black, { p: [.13, -.52, 0], r: [0, 0, Math.PI / 2] });
    k.add(tube, k.cyl(.048, .048, .06, { seg: 24 }), chrome, { p: [.2, -.52, 0], r: [0, 0, Math.PI / 2] });
    k.add(tube, k.cyl(.072, .072, .16, { seg: 28 }), satin, { p: [.3, -.52, 0], r: [0, 0, Math.PI / 2] });
    k.add(tube, k.cyl(.074, .074, .02, { seg: 28 }), chrome, { p: [.33, -.52, 0], r: [0, 0, Math.PI / 2] });
    k.add(tube, k.lathe([[.045, 0], [.078, 0], [.08, .06], [.07, .075], [.05, .06], [.045, .04]], { seg: 28 }), rubber, { p: [.38, -.52, 0], r: [0, 0, -Math.PI / 2] });
    // the finder scope in its bracket, up on top
    const fx = r + .13, fz = .05;
    k.add(tube, k.box(.03, .3, .07, .01), black, { p: [r + .012, .6, fz * .5] });
    for (const y of [.5, .72]) {
      k.add(tube, k.torus(.055, .011, { rs: 6, ts: 24 }), black, { p: [fx, y, fz], r: [Math.PI / 2, 0, 0] });
      k.add(tube, k.box(.08, .02, .02), black, { p: [r + .06, y, fz * .7] });
    }
    k.add(tube, k.cyl(.042, .042, .5, { seg: 24 }), white, { p: [fx, .62, fz] });
    k.add(tube, k.cyl(.05, .046, .12, { seg: 24 }), black, { p: [fx, .9, fz] });
    k.add(tube, k.disc(.042, 20), k.mat({ color: '#0b2b2a', metalness: .6, roughness: .06, clearcoat: 1 }), { p: [fx, .93, fz], r: [-Math.PI / 2, 0, 0] });
    k.add(tube, k.cyl(.03, .036, .1, { seg: 20 }), black, { p: [fx, .33, fz] });
    g.userData.view = { az: 30, el: 16 };
    return g;
  },

  // A brass orrery: a glowing sun on a column, planets on curved brass arms at different radii and heights, clockwork
  // gears showing through windows in a brass drum and on its deck, all on a turned walnut base with a little crank.
  orrery(k) {
    const T = k.THREE, g = k.group();
    const brass = k.metal('#d8a955', .22), brassDeep = k.metal('#b98b3f', .3), brassLight = k.metal('#efc774', .15);
    const walnut = k.wood('walnut', { varnish: .9, rough: .32 });
    walnut.map.rotation = Math.PI / 2; walnut.map.center.set(.5, .5); walnut.map.repeat.set(1, 3);   // turned: the grain runs round the base
    // ---- the turned walnut base, on three brass ball feet
    const yb0 = .1;
    k.add(g, k.lathe([[0, 0], [1.44, 0], [1.5, .02], [1.53, .06], [1.53, .12], [1.49, .15], [1.43, .17], [1.39, .21], [1.38, .27], [1.4, .31], [1.43, .34], [1.43, .38], [1.39, .41], [1.33, .43], [1.3, .45], [1.3, .5], [1.28, .52], [0, .52]].map(([r, y]) => [r * .88, y]), { seg: 96 }), walnut, { p: [0, yb0, 0] });
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + .3; k.add(g, k.sphere(.09, { w: 20, h: 14 }), brass, { p: [Math.sin(a) * 1.04, .09, Math.cos(a) * 1.04] }); }
    const yB = yb0 + .52;
    // the calendar ring: printed paper, months and degrees, under a brass bezel
    const cal = k.tex(1024, 1024, (c, w) => {
      const m = w / 2, ri = .84 / 1.12 * m;
      c.fillStyle = '#efe0bb'; c.beginPath(); c.arc(m, m, m, 0, TAU); c.arc(m, m, ri, 0, TAU, true); c.fill();
      const gr = c.createRadialGradient(m, m, ri, m, m, m); gr.addColorStop(0, 'rgba(150,100,40,.18)'); gr.addColorStop(.5, 'rgba(150,100,40,0)'); gr.addColorStop(1, 'rgba(150,100,40,.25)');
      c.fillStyle = gr; c.beginPath(); c.arc(m, m, m, 0, TAU); c.arc(m, m, ri, 0, TAU, true); c.fill();
      c.strokeStyle = '#3a2814'; c.lineWidth = 3;
      for (const r of [m - 8, m - 44, ri + 50, ri + 8]) { c.beginPath(); c.arc(m, m, r, 0, TAU); c.stroke(); }
      for (let i = 0; i < 360; i += 2) { const a = i / 360 * TAU, l = i % 30 === 0 ? 36 : i % 10 === 0 ? 24 : 12; c.lineWidth = i % 30 === 0 ? 3 : 1.5; c.beginPath(); c.moveTo(m + Math.cos(a) * (m - 8), m + Math.sin(a) * (m - 8)); c.lineTo(m + Math.cos(a) * (m - 8 - l), m + Math.sin(a) * (m - 8 - l)); c.stroke(); }
      ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].forEach((s, i) => {
        const a = (i + .5) / 12 * TAU, rr = (m - 44 + ri + 50) / 2;
        c.save(); c.translate(m + Math.cos(a) * rr, m + Math.sin(a) * rr); c.rotate(a - Math.PI / 2);
        k.text(c, s, 0, 0, { size: 34, weight: 700, font: 'Georgia, "Times New Roman", serif', color: i % 3 ? '#2d1f10' : '#9a2a18' }); c.restore();
      });
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.lineWidth = 2.5; c.beginPath(); c.moveTo(m + Math.cos(a) * (ri + 8), m + Math.sin(a) * (ri + 8)); c.lineTo(m + Math.cos(a) * (m - 44), m + Math.sin(a) * (m - 44)); c.stroke(); }
    });
    k.add(g, k.ring(.84, 1.12, 96), k.mat({ map: cal, roughness: .55, clearcoat: .4, clearcoatRoughness: .3 }), { p: [0, yB + .003, 0], r: [-Math.PI / 2, 0, 0] });
    k.add(g, k.torus(1.13, .02, { rs: 10, ts: 96 }), brass, { p: [0, yB + .006, 0], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.torus(.84, .015, { rs: 8, ts: 80 }), brass, { p: [0, yB + .004, 0], r: [Math.PI / 2, 0, 0] });
    // ---- the brass drum: arched windows all round, clockwork inside
    const rD = .66, hD = .46, yD1 = yB + hD;
    const win = k.tex(1024, 256, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#000000';
      for (let i = 0; i < 6; i++) { const cx = (i + .5) * w / 6, hw = w / 6 * .36; c.beginPath(); c.moveTo(cx - hw, h * .86); c.lineTo(cx - hw, h * .36); c.arc(cx, h * .36, hw, Math.PI, 0); c.lineTo(cx + hw, h * .86); c.closePath(); c.fill(); }
    }, { data: true });
    k.add(g, k.cyl(rD, rD, hD, { open: true, seg: 72 }), k.metal('#d2a24e', .26, { alphaMap: win, alphaTest: .5, side: T.DoubleSide }), { p: [0, yB + hD / 2, 0] });
    k.add(g, k.lathe([[rD - .02, 0], [rD + .08, 0], [rD + .08, .03], [rD + .04, .05], [rD + .01, .07], [rD - .02, .07]], { seg: 72 }), brassDeep, { p: [0, yB, 0] });
    k.add(g, k.lathe([[0, 0], [rD + .06, 0], [rD + .08, .02], [rD + .08, .04], [rD + .06, .06], [0, .06]], { seg: 72 }), brassDeep, { p: [0, yD1 - .02, 0] });
    k.add(g, k.torus(rD + .005, .016, { rs: 8, ts: 72 }), brassLight, { p: [0, yD1 - .06, 0], r: [Math.PI / 2, 0, 0] });
    const gearMat = k.metal('#e3b75e', .2), gearMat2 = k.metal('#c9993f', .26);
    const gear = (r, n, o, mat, p, rot) => k.add(g, k.extrude(gearShape(k, r, n, o), o.th ?? .035, { bevel: .005, bevelSeg: 1, curve: 16 }), [mat, mat], { p, r: rot });
    gear(.56, 44, { hub: .04, spokes: 5 }, gearMat, [0, yB + .14, 0], [-Math.PI / 2, 0, 0]);
    gear(.28, 22, { hub: .03, spokes: 4 }, gearMat2, [.3, yB + .27, -.18], [-Math.PI / 2, 0, .2]);
    gear(.2, 16, { hub: .025, spokes: 4 }, gearMat, [Math.sin(k.deg(70)) * .44, yB + .24, Math.cos(k.deg(70)) * .44], [0, k.deg(70), 0]);
    k.add(g, k.cyl(.03, .03, hD, { seg: 12 }), brassDeep, { p: [.3, yB + hD / 2, -.18] });
    // the deck: a big spoked wheel round the column and a pinion beside it
    gear(.44, 40, { hub: .06, spokes: 6 }, gearMat, [0, yD1 + .065, 0], [-Math.PI / 2, 0, 0]);
    gear(.15, 14, { hub: .02, spokes: 0 }, gearMat2, [Math.sin(k.deg(-40)) * .575, yD1 + .065, Math.cos(k.deg(-40)) * .575], [-Math.PI / 2, 0, .1]);
    k.add(g, k.cyl(.025, .025, .12, { seg: 12 }), brassLight, { p: [Math.sin(k.deg(-40)) * .575, yD1 + .08, Math.cos(k.deg(-40)) * .575] });
    k.add(g, k.lathe([[0, 0], [.12, 0], [.12, .03], [.09, .06], [.08, .1], [0, .1]], { seg: 32 }), brassLight, { p: [0, yD1 + .05, 0] });
    // ---- the column, the sun on top, and sleeves carrying the planets' arms
    const ySun = 2.3, rSun = .27, yBase = yD1 + .12;
    k.add(g, k.cyl(.034, .034, ySun - yBase, { seg: 16 }), brassLight, { p: [0, (ySun + yBase) / 2, 0] });
    const planets = [   // [kind, orbit radius, size, height, angle (deg, 0 = front), collar height]
      ['mercury', .56, .08, 2.02, 284, 1.84], ['venus', .84, .11, 1.9, 72, 1.74], ['earth', 1.14, .13, 1.95, 340, 1.64],
      ['mars', 1.44, .105, 1.6, 168, 1.54], ['jupiter', 1.8, .25, 1.78, 115, 1.44], ['saturn', 2.14, .2, 1.66, 295, 1.34]];
    const sleeves = [], arms = [], cups = [];
    planets.forEach(([kind, R, rp, yp, deg, yc], i) => {
      const th = k.deg(deg), rs = .05 + (5 - i) * .012, dir = [Math.sin(th), 0, Math.cos(th)];
      sleeves.push({ p: [0, (yBase + yc) / 2, 0], s: [rs, yc - yBase, rs] });
      sleeves.push({ p: [0, yc - .015, 0], s: [rs + .022, .05, rs + .022] });
      const P = (d, y) => [dir[0] * d, y, dir[2] * d], yEnd = yp - rp - .07;
      arms.push(k.tube([P(rs, yc), P(R * .35, yc + .01), P(R * .72, yc + (yEnd - yc) * .45), P(R * .95, yEnd - .06), P(R, yEnd)], .016, { seg: 48, rs: 8 }));
      cups.push({ p: P(R, yEnd + .005), s: [.045, .07, .045] });
      const mat = k.mat({ map: planetTex(k, kind), roughness: .38, clearcoat: .8, clearcoatRoughness: .15 });
      const pl = k.mesh(k.sphere(rp, { w: 40, h: 28 }), mat, { p: P(R, yp), r: [0, k.range(0, TAU), kind === 'earth' ? .41 : kind === 'saturn' ? .3 : 0] }); g.add(pl);
      if (kind === 'saturn') {
        const rt = k.tex(512, 512, (c, w) => {
          const m = w / 2, ri = 1.35 / 2.2 * m;
          for (let rr = ri; rr < m; rr += 1) { const f = (rr - ri) / (m - ri); let a = f < .18 ? .35 : f < .55 ? .95 : f < .62 ? .05 : f < .92 ? .75 : .3; if (Math.abs(f - .83) < .012) a = .1; const t = .85 + .15 * Math.sin(rr * .7); c.strokeStyle = `rgba(${236 * t | 0},${214 * t | 0},${168 * t | 0},${a})`; c.lineWidth = 1.5; c.beginPath(); c.arc(m, m, rr, 0, TAU); c.stroke(); }
        });
        k.add(g, k.ring(rp * 1.35, rp * 2.2, 72), k.mat({ map: rt, transparent: true, side: T.DoubleSide, roughness: .5, depthWrite: false }), { p: P(R, yp), r: [-Math.PI / 2 + .45, 0, .25], shadow: false });
      }
      if (kind === 'earth') {
        const m0 = P(R, yp + rp + .02), md = [Math.cos(th) * .2, .03, -Math.sin(th) * .2];
        g.add(rod(k, m0, [m0[0] + md[0], m0[1] + md[1], m0[2] + md[2]], .006, brass));
        k.add(g, k.sphere(.035, { w: 20, h: 14 }), k.mat({ map: planetTex(k, 'moon'), roughness: .6, clearcoat: .5 }), { p: [m0[0] + md[0], m0[1] + md[1] + .03, m0[2] + md[2]] });
      }
    });
    g.add(k.instances(k.cyl(1, 1, 1, { seg: 20 }), brass, sleeves));
    k.add(g, k.merge(arms), brass);
    g.add(k.instances(k.lathe([[0, 0], [.4, .1], [.9, .6], [1, 1], [.9, 1], [0, .5]], { seg: 16 }), brassLight, cups));
    // the sun: a glowing ball with a corona, lighting the planets from the middle
    const sunTex = k.tex(512, 256, (c, w, h) => {
      c.fillStyle = '#ffc443'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) { c.fillStyle = k.rand() < .55 ? `rgba(255,244,190,${k.range(.25, .7)})` : `rgba(240,120,20,${k.range(.2, .45)})`; c.beginPath(); c.arc(k.rand() * w, k.rand() * h, k.range(2, 7), 0, TAU); c.fill(); }
    });
    k.add(g, k.sphere(rSun, { w: 48, h: 32 }), k.mat({ map: sunTex, emissive: k.color('#ffffff'), emissiveMap: sunTex, emissiveIntensity: 1.8, roughness: .6 }), { p: [0, ySun, 0], shadow: false });
    const h1 = halo(k, .66, '#ffc24a', .7); h1.position.set(0, ySun, 0); g.add(h1);
    const h2 = halo(k, 1.0, '#ff9a30', .16); h2.position.set(0, ySun, 0); g.add(h2);
    const sunLight = new T.PointLight(0xffc070, 1.1, 0, 1); sunLight.position.set(0, ySun, 0); g.add(sunLight);   // gentle falloff, so the inner planets don't wash out
    // ---- the crank, out of the drum on the right
    const thc = k.deg(62), crank = k.group([], { p: [Math.sin(thc) * rD, yB + .25, Math.cos(thc) * rD], r: [0, thc - Math.PI / 2, 0] }); g.add(crank);
    k.add(crank, k.cyl(.05, .06, .06, { seg: 20 }), brassDeep, { p: [.03, 0, 0], r: [0, 0, Math.PI / 2] });
    k.add(crank, k.cyl(.022, .022, .26, { seg: 12 }), brassLight, { p: [.15, 0, 0], r: [0, 0, Math.PI / 2] });
    const armC = k.group([], { p: [.28, 0, 0], r: [k.deg(40), 0, 0] }); crank.add(armC);
    k.add(armC, k.box(.035, .32, .07, .014), brass, { p: [0, .13, 0] });
    k.add(armC, k.sphere(.04, { w: 16, h: 12 }), brassLight, { p: [0, 0, 0] });
    k.add(armC, k.lathe([[0, 0], [.035, 0], [.055, .04], [.047, .13], [.062, .19], [.04, .23], [0, .235]], { smooth: true, seg: 24 }), k.wood('maple', { varnish: .8, rough: .3 }), { p: [.015, .27, 0], r: [0, 0, -Math.PI / 2] });
    g.userData.view = { az: 30, el: 22 };
    g.userData.fullView = { az: 56, el: 20 };   // turned so the long outer arms run into the picture, filling the taller card
    return g;
  },
};
