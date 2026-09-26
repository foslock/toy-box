// Outer Space models: suits. What astronauts wear to step outside, and who goes out with them: a space suit waving
// hello, its gold-visored helmet on its own, the jet-powered backpack for flying untethered, and a robot astronaut.
// Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
// A small seeded random source for cached textures, so they paint the same whichever model asks for them first.
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

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
// A surface from fn(u, v) => [x, y, z] over the unit square, with (u, v) as its UVs. Faces point along dv × du.
function surface(k, fn, nu, nv) {
  const T = k.THREE, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { pos.push(...fn(i / nu, j / nv)); uv.push(i / nu, j / nv); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return weld(geo);
}
const curveOf = (k, pts, closed = false) => new k.THREE.CatmullRomCurve3(pts.map(q => Array.isArray(q) ? new k.THREE.Vector3(...q) : q.clone()), closed);
// A tube along a curve whose radius changes along the way and round it: rad(s, L, a) at arc length s (of L), angle a.
function varTube(k, curve, rad, o = {}) {
  const T = k.THREE, seg = o.seg ?? 96, rs = o.rs ?? 24, L = curve.getLength();
  const geo = new T.TubeGeometry(curve, seg, 1, rs, false);
  const p = geo.attributes.position, P = new T.Vector3(), v = new T.Vector3();
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, P);
    for (let j = 0; j <= rs; j++) {
      const n = i * (rs + 1) + j;
      v.fromBufferAttribute(p, n).sub(P).multiplyScalar(rad(i / seg * L, L, j / rs * TAU)).add(P);
      p.setXYZ(n, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return weld(geo);
}
// Round off the ends of a varTube: radius r0 along the middle, closing over the last `cap` of length at each end.
const capped = (r0, cap0, cap1 = cap0) => (s, L, a) => {
  let r = typeof r0 === 'function' ? r0(s, L, a) : r0;
  if (cap0 > 0 && s < cap0) { const q = s / cap0; r *= Math.sqrt(Math.max(0, q * (2 - q))); }
  if (cap1 > 0 && L - s < cap1) { const q = (L - s) / cap1; r *= Math.sqrt(Math.max(0, q * (2 - q))); }
  return r;
};
// Soft folds where fabric bunches at a joint: each {c, w, n, amp} puts n ripples in a window of half-width w round the
// fraction c of the way along; they wander round the limb so they don't look turned on a lathe.
const folds = list => (s, L, a) => {
  let f = 0;
  for (const { c, w, n, amp, ph = 0 } of list) {
    const t = (s / L - c) / w;
    if (Math.abs(t) >= 1) continue;
    const wob = Math.sin(a + ph) * .9 + Math.sin(2 * a + ph * 1.7) * .4;
    f += amp * Math.cos(t * Math.PI / 2) ** 2 * (.5 + .5 * Math.cos(Math.PI * n * t + wob));
  }
  return f;
};
// Catmull-Rom through a list of equal-length number arrays: t in 0..1 → an interpolated array.
function spline(keys) {
  const n = keys.length - 1;
  return t => {
    const x = clamp01(t) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
    const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(n, i + 2)];
    return p1.map((_, j) => .5 * (2 * p1[j] + (p2[j] - p0[j]) * f + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * f * f + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * f * f * f));
  };
}
// A body of rounded-square sections stacked up y: keys [[y, halfWidth, halfDepth, zOffset]] from bottom to top (make the
// first and last tiny to close it off). n: how square the sections are (2 is an ellipse).
function bodyGeo(k, keys, n = 2.6, nu = 64, nv = 56) {
  const S = spline(keys), e = 2 / n, sp = c => Math.sign(c) * Math.pow(Math.abs(c), e);
  return surface(k, (u, v) => { const [y, a, b, z0] = S(v), t = u * TAU - Math.PI / 2; return [a * sp(Math.cos(t)), y, z0 + b * sp(Math.sin(t))]; }, nu, nv);
}
// The outline of an oval window on a sphere, as an angle from the front (+z) in each direction round it (phi = 0 at +x,
// π/2 straight up): side half-width A, up to UP, down to DN (radians), squareness P.
const ovalOpen = (A, UP, DN, P = 2.4) => phi => { const s = Math.sin(phi); return Math.pow(Math.pow(Math.abs(Math.cos(phi)) / A, P) + Math.pow(Math.abs(s) / (s > 0 ? UP : DN), P), -1 / P); };
// A patch of a sphere of radius r round +z, out to open(phi); its texture is laid on flat from the front.
function capGeo(k, open, r = 1, o = {}) {
  const lo = o.clampY ?? -Infinity;
  const geo = surface(k, (u, v) => { const phi = u * TAU, th = open(phi) * v, s = Math.sin(th); return [s * Math.cos(phi) * r, Math.max(lo, s * Math.sin(phi) * r), Math.cos(th) * r]; }, o.nu ?? 72, o.nv ?? 16);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / r * .5 + .5, p.getY(i) / r * .5 + .5);
  return geo;
}

// Turn an object so its own axis (default +y) points along n.
const aim = (k, obj, n, axis = [0, 1, 0]) => { obj.quaternion.setFromUnitVectors(new k.THREE.Vector3(...axis), (n.isVector3 ? n.clone() : new k.THREE.Vector3(...n)).normalize()); return obj; };
// Turn an object so its local +y runs along L and its local +z points as near to N as it can.
function orient(k, obj, L, N) {
  const T = k.THREE, y = (L.isVector3 ? L.clone() : new T.Vector3(...L)).normalize(), n = N.isVector3 ? N.clone() : new T.Vector3(...N);
  const z = n.addScaledVector(y, -n.dot(y)).normalize(), x = new T.Vector3().crossVectors(y, z);
  obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
  return obj;
}
// Euler angles (for k.instances) that turn +y to point along d.
function eulerTo(k, d) {
  const T = k.THREE, e = new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), (d.isVector3 ? d.clone() : new T.Vector3(...d)).normalize()));
  return [e.x, e.y, e.z];
}
// Placement matrix for a unit cylinder (radius 1, height 1) stretched from a to b with radius r: for instanced rods.
function spanM(k, a, b, r) {
  const T = k.THREE, A = a.isVector3 ? a.clone() : new T.Vector3(...a), B = b.isVector3 ? b.clone() : new T.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  return new T.Matrix4().compose(A.add(B).multiplyScalar(.5), q, new T.Vector3(r, L, r));
}
const ballM = (k, p, r) => new k.THREE.Matrix4().compose(p.isVector3 ? p.clone() : new k.THREE.Vector3(...p), new k.THREE.Quaternion(), new k.THREE.Vector3(r, r, r));
function instanced(k, geo, mat, matrices) {
  const m = new k.THREE.InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((M, i) => m.setMatrixAt(i, M));
  m.castShadow = m.receiveShadow = true;
  return m;
}
// A soft additive glow round a light (a sprite: it faces the camera and doesn't count when the studio frames the model).
function halo(k, r, color, opacity = .45) {
  const T = k.THREE, tex = k.tex(128, 128, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, { cache: 'suits-halo' });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k.color(color), transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }));
  s.scale.set(r * 2, r * 2, 1);
  return s;
}

/* ---------- materials ---------- */
// The gold sun visor: a warm mirror with the black of space, a few stars and the blue curve of the Earth in it.
// The colour map tints what the metal reflects; the glow map keeps the stars, the Earth's rim and a window glint bright
// whatever the lighting, with a dim copy of the rest so the gold stays warm in shadow.
function visorMat(k) {
  const scene = (c, w, h) => {
    const R = rng(11);
    let gr = c.createLinearGradient(w * .2, h * .12, w * .78, h * .9);
    gr.addColorStop(0, '#ffe9a6'); gr.addColorStop(.3, '#f7bd45'); gr.addColorStop(.62, '#c47514'); gr.addColorStop(1, '#6a3006');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    // the black of space, reflected a dark bronze across the upper middle
    gr = c.createRadialGradient(w * .64, h * .4, 0, w * .64, h * .4, w * .42);
    gr.addColorStop(0, 'rgba(44,16,2,.82)'); gr.addColorStop(1, 'rgba(44,16,2,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    // the Earth: a great curve of gold-tinted blue low on the left, with cloud streaks
    c.save(); c.beginPath(); c.arc(w * .02, h * 1.62, w * 1.04, 0, TAU); c.clip();
    gr = c.createLinearGradient(0, h * .56, 0, h); gr.addColorStop(0, '#9adbc8'); gr.addColorStop(.45, '#46948a'); gr.addColorStop(1, '#1f4d50');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const a = -Math.PI * (.14 + R() * .36), rr = w * 1.04 * (.84 + R() * .14), x = w * .02 + Math.cos(a) * rr, y = h * 1.62 + Math.sin(a) * rr; c.fillStyle = `rgba(255,250,232,${.22 + R() * .4})`; c.beginPath(); c.ellipse(x, y, w * (.03 + R() * .08), h * (.008 + R() * .014), a + Math.PI / 2, 0, TAU); c.fill(); }
    c.restore();
  };
  const sparks = (c, w, h) => {
    const R = rng(12);
    for (let i = 0; i < 46; i++) { const x = w * (.34 + R() * .58), y = h * (.2 + R() * .42), r = R() < .15 ? 2.8 : 1.4; c.fillStyle = `rgba(255,244,214,${.55 + R() * .45})`; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(150,230,255,.45)'; c.lineWidth = w * .04; c.beginPath(); c.arc(w * .02, h * 1.62, w * 1.058, -Math.PI * .52, -Math.PI * .08); c.stroke();
    c.strokeStyle = 'rgba(236,255,246,.95)'; c.lineWidth = w * .011; c.beginPath(); c.arc(w * .02, h * 1.62, w * 1.04, -Math.PI * .52, -Math.PI * .08); c.stroke();
    // a window of light caught up on the left: two soft bars, curved like the visor
    c.save(); c.translate(w * .31, h * .27); c.rotate(-.6);
    for (const [y, t, a] of [[0, .034, .95], [h * .075, .018, .7]]) {
      const gr = c.createLinearGradient(0, y - h * t, 0, y + h * t); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.beginPath(); c.ellipse(0, y, w * (.17 - y / h * .6), h * t, 0, 0, TAU); c.fill();
    }
    c.restore();
  };
  const map = k.tex(512, 512, (c, w, h) => { scene(c, w, h); sparks(c, w, h); }, { cache: 'suits-visor-col' });
  const emi = k.tex(512, 512, (c, w, h) => { scene(c, w, h); c.fillStyle = 'rgba(0,0,0,.78)'; c.fillRect(0, 0, w, h); sparks(c, w, h); }, { cache: 'suits-visor-emi' });
  return k.mat({ map, metalness: .75, roughness: .15, clearcoat: 1, clearcoatRoughness: .03, emissive: k.color('#ffffff'), emissiveMap: emi, emissiveIntensity: 1, envMapIntensity: 1.1 });
}
// Crinkled gold foil insulation: gold metal crumpled into creased facets, some catching the light and some not. The
// colour and the bump are painted from the same facets, so the bright ones and the tilted ones match.
function foilMat(k, repeat = [1, 1]) {
  const gold = ['#7a4a0e', '#b7791c', '#e6b040', '#ffe08a', '#fff6d0'];
  const shade = t => gold[Math.min(4, Math.floor(t * 5))];
  const facets = col => (c, w, h) => {
    const R = rng(5);
    c.fillStyle = col ? '#d9a236' : '#808080'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) {
      const x = R() * w, y = R() * h, r = w * (.05 + R() * .12), a = R() * TAU, t0 = R(), t1 = R();
      const gr = c.createLinearGradient(x - Math.cos(a) * r, y - Math.sin(a) * r, x + Math.cos(a) * r, y + Math.sin(a) * r);
      if (col) { gr.addColorStop(0, shade(t0)); gr.addColorStop(1, shade(t1 * .8 + .1)); }
      else { const v0 = 30 + t0 * 195 | 0, v1 = 30 + t1 * 195 | 0; gr.addColorStop(0, `rgb(${v0},${v0},${v0})`); gr.addColorStop(1, `rgb(${v1},${v1},${v1})`); }
      c.fillStyle = gr; c.beginPath();
      for (let j = 0; j < 3; j++) { const b = a + j * TAU / 3 + (R() - .5) * .8, rr = r * (.6 + R() * .7); c.lineTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr); }
      c.closePath(); c.fill();
    }
    // creases running across it
    c.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      let x = R() * w, y = R() * h, a = R() * TAU; const bright = R() < .5;
      c.strokeStyle = col ? (bright ? 'rgba(255,248,210,.8)' : 'rgba(90,50,8,.6)') : (bright ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.6)');
      c.lineWidth = 1 + R() * 2; c.beginPath(); c.moveTo(x, y);
      for (let j = 0; j < 4; j++) { a += (R() - .5) * 1.2; x += Math.cos(a) * w * .06; y += Math.sin(a) * h * .06; c.lineTo(x, y); }
      c.stroke();
    }
  };
  const map = k.tex(256, 256, facets(true), { repeat, cache: 'suits-foil-col' });
  const bump = k.tex(256, 256, facets(false), { data: true, repeat, cache: 'suits-foil-bump' });
  return k.mat({ color: '#ffffff', map, metalness: 1, roughness: .14, bumpMap: bump, bumpScale: 1.6, emissive: k.color('#7a4800'), emissiveIntensity: .45, envMapIntensity: 1.4 });
}
// The suit's outer layer: white ortho fabric with a faint ripstop grid and soft mottling (a bump map, no knit), and
// seams stitched where its panels meet when o.seams paints them on.
function suitFabric(k, o = {}) {
  const bump = k.tex(256, 256, (c, w, h) => {
    const R = rng(3);
    c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
    c.filter = 'blur(6px)';
    for (let i = 0; i < 70; i++) { c.fillStyle = R() < .5 ? `rgba(0,0,0,${.05 + R() * .08})` : `rgba(255,255,255,${.05 + R() * .08})`; c.beginPath(); c.ellipse(R() * w, R() * h, 8 + R() * 30, 4 + R() * 10, R() * TAU, 0, TAU); c.fill(); }
    c.filter = 'none';
    c.fillStyle = 'rgba(0,0,0,.05)'; for (let i = 0; i < w; i += 6) { c.fillRect(i, 0, 1, h); c.fillRect(0, i, w, 1); }
  }, { data: true, repeat: o.repeat ?? [3, 3], cache: 'suits-fabric-bump' });
  const map = o.seams ? k.tex(512, 512, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); o.seams(c, w, h); }, { cache: o.cache }) : null;
  return k.mat({ color: o.color ?? '#f6f5f1', map, roughness: .9, sheen: .8, sheenRoughness: .45, sheenColor: k.color('#ffffff'), bumpMap: bump, bumpScale: o.bumpScale ?? 1 });
}
// Seams on the suit's body: down both sides, a yoke across the chest and back, two front panels and a band round the hips.
// The body's texture wraps round it (u, the back at 0 and 1, the front at 0.5) and runs up it (v, a key every 1/13).
function torsoSeams(c, w, h) {
  const Y = i => (1 - i / 13) * h;
  const seam = (pts, across) => {
    const run = (dx, dy) => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x * w + dx, y + dy) : c.moveTo(x * w + dx, y + dy)); c.stroke(); };
    c.setLineDash([]); c.strokeStyle = 'rgba(112,120,134,.55)'; c.lineWidth = 2.5; run(0, 0);
    c.setLineDash([5, 5]); c.strokeStyle = 'rgba(112,120,134,.4)'; c.lineWidth = 1.5; run(across ? 0 : 6, across ? 6 : 0); run(across ? 0 : -6, across ? -6 : 0);
  };
  seam([[.25, Y(2)], [.25, Y(11.5)]]); seam([[.75, Y(2)], [.75, Y(11.5)]]);
  seam([[0, Y(9)], [1, Y(9)]], true); seam([[0, Y(3)], [1, Y(3)]], true);
  seam([[.405, Y(5.5)], [.425, Y(9)]]); seam([[.595, Y(5.5)], [.575, Y(9)]]);
  c.setLineDash([]);
}
function suitMats(k) {
  return {
    fab: suitFabric(k),                                         // the outer layer: white ortho fabric
    body: suitFabric(k, { seams: torsoSeams, cache: 'suits-torso-seams', repeat: [4, 3] }),
    fab2: suitFabric(k, { color: '#d9dde3' }),                  // light grey fabric: bands and cuffs
    glove: suitFabric(k, { color: '#edebe6' }),
    boot: suitFabric(k, { color: '#f1efea' }),
    red: k.fabric('#d9342b', { sheen: '#ff9c90' }),
    pack: k.plastic('#f3f2ee', { rough: .55, coat: .15 }),
    shell: k.gloss('#f8f7f3'),                                  // the helmet's hard shell
    shell2: k.plastic('#e1e4e9', { rough: .4 }),
    redShell: k.gloss('#d9342b'),
    ring: k.metal('#3868e0', .28),                              // anodised blue rings
    alu: k.metal('#cfd4da', .3),
    dark: k.plastic('#2a2e36', { rough: .45 }),
    pad: k.mat({ color: '#9aa0a9', roughness: .85, map: k.tex(64, 64, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(40,44,52,.35)'; for (let y = 4; y < h; y += 8) for (let x = (y / 8 % 2) * 4 + 4; x < w; x += 8) { c.beginPath(); c.arc(x, y, 1.8, 0, TAU); c.fill(); } }, { repeat: [2, 2], cache: 'suits-grip' }) }),
    tip: k.rubber('#8c919a'),
    sole: k.rubber('#5d616a'),
    bumper: k.rubber('#9da3ac'),
    lamp: k.glow('#fff2d2', 2.2),
    // the helmet lamp's lens: a warm light panel behind a fine grid of LEDs
    lampFace: k.painted(64, 88, (c, w, h) => {
      c.fillStyle = '#23262c'; c.fillRect(0, 0, w, h);
      const gr = c.createRadialGradient(w / 2, h * .45, 2, w / 2, h / 2, h * .55);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(.5, '#fff1c8'); gr.addColorStop(1, '#e8b870');
      c.fillStyle = gr; c.beginPath(); c.roundRect(5, 5, w - 10, h - 10, 12); c.fill();
      c.strokeStyle = 'rgba(160,110,40,.35)'; c.lineWidth = 1.5;
      for (let x = 16; x < w - 8; x += 11) { c.beginPath(); c.moveTo(x, 8); c.lineTo(x, h - 8); c.stroke(); }
      for (let y = 18; y < h - 8; y += 11) { c.beginPath(); c.moveTo(8, y); c.lineTo(w - 8, y); c.stroke(); }
    }, { glow: 1.3, cache: 'suits-lamp' }),
    lens: k.mat({ color: '#0d1522', roughness: .05, metalness: .3, clearcoat: 1, clearcoatRoughness: .02 }),
    visor: visorMat(k),
  };
}

/* ---------- parts ---------- */
// An EVA helmet, centre at the origin and radius 1, visor to +z: the white shell round a gold visor, lamps on both sides
// (red commander's stripes on them with o.stripe, a camera on the left one unless o.camera is false), sitting in its
// neck ring. Its lowest point is at y = −0.93.
function evaHelmet(k, m, o = {}) {
  const T = k.THREE, g = k.group(), yN = -.7;
  const open = ovalOpen(1.2, .74, 1.0, 2.4);
  const dir = (th, phi, r = 1) => new T.Vector3(Math.sin(th) * Math.cos(phi) * r, Math.max(yN, Math.sin(th) * Math.sin(phi) * r), Math.cos(th) * r);
  // the shell: from the rim of the visor opening round the back, down to the neck ring
  k.add(g, surface(k, (u, v) => { const phi = u * TAU, t0 = open(phi); return dir(t0 + (Math.PI - t0) * v, phi).toArray(); }, 96, 40), m.shell);
  // the visor, just inside the rim, and a rolled lip round the opening
  k.add(g, capGeo(k, phi => open(phi) + .06, .975, { clampY: yN, nu: 96, nv: 20 }), m.visor);
  const lip = []; for (let i = 0; i < 120; i++) { const phi = i / 120 * TAU; lip.push(dir(open(phi), phi).toArray()); }
  k.add(g, k.tube(lip, .05, { closed: true, seg: 240, rs: 10 }), m.shell);
  // the visor's pivots at the sides
  for (const s of [-1, 1]) {
    const d = dir(1.2, s > 0 ? 0 : Math.PI), hub = aim(k, k.group([], { p: d.toArray() }), d); g.add(hub);
    k.add(hub, k.rcyl(.12, .05, .02, { seg: 28 }), m.shell2);
    k.add(hub, k.rcyl(.055, .075, .015, { seg: 20 }), m.alu);
  }
  // a slim lamp housing along each side, its glowing lens shining forward; a camera on top of the left one
  for (const s of [-1, 1]) {
    const P = k.group([], { p: [0, .3, -.08], s: [s, 1, 1] }); g.add(P);
    k.add(P, k.box(.14, .17, .42, .04), m.dark, { p: [.9, 0, -.04] });
    k.add(P, k.box(.2, .27, .72, .09), m.shell, { p: [1.02, 0, 0] });
    k.add(P, k.box(.21, .06, .6, .02), o.stripe ? m.redShell : m.shell2, { p: [1.02, -.1, -.02] });
    k.add(P, k.box(.16, .21, .03, .014), m.dark, { p: [1.02, .01, .357] });
    k.add(P, k.plane(.13, .18), m.lampFace, { p: [1.02, .01, .374], shadow: false });
    if (s > 0 && o.camera !== false) {
      const cam = k.group([], { p: [1.02, .23, .04] }); P.add(cam);
      k.add(cam, k.box(.15, .15, .3, .035), m.dark);
      k.add(cam, k.cyl(.056, .062, .08, { seg: 24 }), m.dark, { p: [0, 0, .185], r: [Math.PI / 2, 0, 0] });
      k.add(cam, k.disc(.045, 24), m.lens, { p: [0, 0, .227] });
      k.add(cam, k.torus(.047, .009, { rs: 6, ts: 24 }), m.alu, { p: [0, 0, .226] });
      k.add(cam, k.sphere(.016, { w: 8, h: 6 }), k.glow('#ff3b30', 2.4), { p: [.045, .06, .14], shadow: false });
    }
  }
  // the neck ring
  const ring = k.group([], { p: [0, yN, 0] }); g.add(ring);
  k.add(ring, k.cyl(.75, .76, .17, { seg: 64 }), m.ring, { p: [0, -.09, 0] });
  k.add(ring, k.torus(.73, .045, { rs: 10, ts: 64 }), m.ring, { r: [Math.PI / 2, 0, 0] });
  k.add(ring, k.torus(.765, .04, { rs: 10, ts: 64 }), m.alu, { p: [0, -.18, 0], r: [Math.PI / 2, 0, 0] });
  for (const a of [.55, 2.3, -1.3]) k.add(ring, k.box(.13, .1, .07, .02), m.alu, { p: [Math.sin(a) * .77, -.09, Math.cos(a) * .77], r: [0, a, 0] });
  return g;
}

// A right EVA glove, the wrist at the origin: fingers up +y, palm to +z, thumb toward +x. o.curl bends each knuckle
// (radians), o.spread fans the fingers, o.thumb is the thumb's direction. Fat fabric fingers with a bulge at each joint,
// grey rubber fingertips and a grip pad on the palm.
function glove(k, m, o = {}) {
  const T = k.THREE, g = k.group(), X = new T.Vector3(1, 0, 0), Z = new T.Vector3(0, 0, 1);
  const curl = o.curl ?? .25, spread = o.spread ?? .06;
  k.add(g, k.lathe([[0, -.02], [.25, -.02], [.268, .05], [.25, .17], [.215, .28], [0, .32]], { seg: 40 }), m.glove);
  k.add(g, k.box(.45, .4, .25, .115, 4), m.glove, { p: [0, .47, 0] });
  k.add(g, k.box(.37, .31, .06, .03, 3), m.pad, { p: [0, .455, .1] });
  const cloth = [], tips = [];
  const knuckles = (r, q) => r * (1 + .09 * Math.exp(-(((q - .36) / .07) ** 2)) + .09 * Math.exp(-(((q - .68) / .07) ** 2)));
  const finger = (base, dir, len, r, axis, bend) => {
    const d = dir.clone().normalize(); let p = base.clone(); const pts = [p.clone()];
    for (let j = 0; j < 3; j++) { d.applyAxisAngle(axis, bend); p = p.clone().addScaledVector(d, len / 3); pts.push(p); }
    const c = curveOf(k, pts);
    cloth.push(varTube(k, c, capped((sl, L) => knuckles(r, sl / L), 0, r), { seg: 22, rs: 14 }));
    const end = c.getPointAt(1).addScaledVector(c.getTangentAt(1), r * .1);
    tips.push(varTube(k, curveOf(k, [c.getPointAt(.78), c.getPointAt(.9), end]), capped(r * 1.05, 0, r * 1.08), { seg: 12, rs: 14 }));
  };
  [[.15, .38, .07], [.05, .42, .073], [-.05, .4, .071], [-.15, .33, .065]].forEach(([x, len, r], i) =>
    finger(new T.Vector3(x, .58, 0), new T.Vector3(0, 1, 0).applyAxisAngle(Z, -(1.5 - i) * spread), len, r, X, curl));
  const td = (o.thumb ?? new T.Vector3(.8, .55, .3)).clone().normalize();
  finger(new T.Vector3(.17, .38, .05), td, .34, .076, td.clone().cross(Z).normalize(), o.thumbCurl ?? .2);
  k.add(g, k.merge(cloth), m.glove);
  k.add(g, k.merge(tips), m.tip);
  return g;
}

// An EVA boot, the ankle over the origin, toe to +z: a rounded white fabric upper on a grey tread, rubber bumpers round
// the toe and heel, a strap over the instep and a cuff round the top.
function boot(k, m) {
  const T = k.THREE, g = k.group(), side = [0, -Math.PI / 2, 0];
  const s = new T.Shape();
  s.moveTo(-.3, .1); s.lineTo(.5, .1); s.bezierCurveTo(.78, .1, .85, .2, .81, .32); s.bezierCurveTo(.77, .44, .62, .47, .47, .5);
  s.quadraticCurveTo(.3, .54, .26, .74); s.lineTo(-.25, .76); s.quadraticCurveTo(-.4, .5, -.3, .1);
  k.add(g, k.extrude(s, .34, { bevel: .1, bevelSeg: 6, curve: 32 }), m.boot, { r: side });
  const so = new T.Shape();
  so.moveTo(-.44, 0); so.lineTo(.74, 0); so.quadraticCurveTo(.96, 0, .95, .13); so.lineTo(-.45, .13); so.closePath();
  k.add(g, k.extrude(so, .5, { bevel: .03, curve: 16 }), m.sole, { r: side });
  const toe = new T.Shape();
  toe.moveTo(.42, .06); toe.lineTo(.62, .06); toe.bezierCurveTo(.86, .06, .93, .16, .9, .26); toe.lineTo(.8, .3); toe.bezierCurveTo(.82, .2, .72, .15, .42, .17); toe.closePath();
  k.add(g, k.extrude(toe, .44, { bevel: .04, bevelSeg: 3, curve: 24 }), m.bumper, { r: side });
  const heel = new T.Shape();
  heel.moveTo(-.2, .06); heel.lineTo(-.4, .06); heel.quadraticCurveTo(-.47, .2, -.43, .34); heel.lineTo(-.36, .34); heel.quadraticCurveTo(-.37, .2, -.2, .17); heel.closePath();
  k.add(g, k.extrude(heel, .44, { bevel: .03, bevelSeg: 3, curve: 16 }), m.bumper, { r: side });
  k.add(g, k.box(.58, .045, .13, .02), m.ring, { p: [0, .68, .45], r: [.86, 0, 0] });
  k.add(g, k.box(.08, .08, .05, .015), m.alu, { p: [.29, .68, .45], r: [.86, 0, 0] });
  k.add(g, k.torus(.27, .05, { rs: 10, ts: 40 }), m.fab2, { p: [0, .84, 0], r: [Math.PI / 2, 0, 0], s: [1, 1.18, 1] });
  return g;
}

// A right robot hand, the wrist at the origin: fingers along +y, palm to +z, thumb toward +x. o.curl bends each knuckle;
// o.thumb is the thumb's direction.
function robotHand(k, m, o = {}) {
  const T = k.THREE, g = k.group(), X = new T.Vector3(1, 0, 0), Z = new T.Vector3(0, 0, 1);
  const curl = o.curl ?? .25, rods = [], balls = [];
  k.add(g, k.box(.21, .2, .09, .035), m.palm, { p: [0, .13, 0] });
  k.add(g, k.box(.2, .17, .05, .03), m.white, { p: [0, .14, -.035] });
  const chain = (base, dir, lens, r, axis, bend) => {
    let p = base.clone(); const d = dir.clone().normalize();
    for (const l of lens) {
      d.applyAxisAngle(axis, bend);
      const q = p.clone().addScaledVector(d, l);
      rods.push(spanM(k, p, q, r)); balls.push(ballM(k, p, r * 1.2));
      p = q;
    }
    balls.push(ballM(k, p, r * 1.05));
  };
  [[.072, .08], [.024, .09], [-.024, .085], [-.072, .07]].forEach(([x, len], i) =>
    chain(new T.Vector3(x, .23, 0), new T.Vector3(0, 1, 0).applyAxisAngle(Z, -(1.5 - i) * .05), [len, len * .8, len * .65], .025, X, curl));
  const td = (o.thumb ?? new T.Vector3(.7, .6, .4)).clone().normalize();
  chain(new T.Vector3(.1, .1, .03), td, [.075, .065, .05], .028, td.clone().cross(Z).normalize(), o.thumbCurl ?? .15);
  g.add(instanced(k, k.cyl(1, 1, 1, { seg: 10 }), m.finger, rods));
  g.add(instanced(k, k.sphere(1, { w: 12, h: 8 }), m.knuckle, balls));
  return g;
}

// A soft plume of gas from a thruster, streaming along +y from the origin: nested see-through cones, cyan at the nozzle
// and fading out, pale at the heart (plain alpha blending, so it still shows against a white wall).
function puff(k, len, r) {
  const T = k.THREE, g = k.group();
  const fade = k.tex(8, 64, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#000'); gr.addColorStop(.55, '#6a6a6a'); gr.addColorStop(1, '#fff'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, { data: true, cache: 'suits-puff' });
  for (const [s, op, col] of [[1, .32, '#39d8ff'], [.7, .42, '#5ff0ff'], [.4, .75, '#d8fdff']]) {
    const geo = k.cyl(r * s, r * .22, len * s, { open: true, seg: 28 }); geo.translate(0, len * s / 2, 0);
    const mat = new T.MeshBasicMaterial({ color: k.color(col), alphaMap: fade, transparent: true, opacity: op, depthWrite: false, side: T.DoubleSide });
    const m = k.add(g, geo, mat, { shadow: false }); m.receiveShadow = false; m.renderOrder = 2;
  }
  k.add(g, k.sphere(r * .3, { w: 16, h: 10 }), k.glow('#bff8ff', 2.4), { shadow: false });
  g.add(halo(k, r * 1.2, '#7ff6ff', .7));
  return g;
}

/* ---------- painted details ---------- */
// Panel lines on the robot's torso shell: a chest plate on the front, seams down the sides and round the waist. The
// texture wraps round the body (u, the front at 0.5) and runs up it (v, a key every 1/8).
function robotPanels(c, w, h) {
  const Y = i => (1 - i / 8) * h;
  c.fillStyle = '#f7f6f2'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(120,130,146,.6)'; c.lineWidth = 3; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(w * .25, Y(1.2)); c.lineTo(w * .25, Y(6.6)); c.moveTo(w * .75, Y(1.2)); c.lineTo(w * .75, Y(6.6)); c.stroke();
  c.beginPath(); c.moveTo(0, Y(2.2)); c.lineTo(w, Y(2.2)); c.stroke();
  c.beginPath(); c.roundRect(w * .37, Y(6.1), w * .26, Y(3.4) - Y(6.1), 22); c.stroke();
  c.beginPath(); c.moveTo(w * .5, Y(3.4)); c.lineTo(w * .5, Y(2.2)); c.stroke();
  c.fillStyle = 'rgba(120,130,146,.7)';
  for (const [x, y] of [[.39, 5.9], [.61, 5.9], [.39, 3.6], [.61, 3.6]]) { c.beginPath(); c.arc(w * x, Y(y), 4, 0, TAU); c.fill(); }
}

// A round mission patch: a ringed planet and an orbit on navy, three stars, a gold embroidered border.
function patchPaint(c, w, h) {
  const cx = w / 2, cy = h / 2, R = w * .47;
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#e9b43a'; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
  let gr = c.createRadialGradient(cx - R * .3, cy - R * .3, 0, cx, cy, R);
  gr.addColorStop(0, '#2f56c4'); gr.addColorStop(1, '#0c1a4d');
  c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, R * .84, 0, TAU); c.fill();
  c.save(); c.beginPath(); c.arc(cx, cy, R * .84, 0, TAU); c.clip();
  gr = c.createLinearGradient(0, cy + R * .3, 0, cy + R); gr.addColorStop(0, '#3fb0ff'); gr.addColorStop(1, '#1b5fc0');
  c.fillStyle = gr; c.beginPath(); c.arc(cx, cy + R * 1.55, R * 1.1, 0, TAU); c.fill();
  c.restore();
  gr = c.createRadialGradient(cx - R * .12, cy - R * .12, 0, cx, cy, R * .3);
  gr.addColorStop(0, '#ffcf6e'); gr.addColorStop(1, '#e8732a');
  c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, R * .26, 0, TAU); c.fill();
  c.strokeStyle = '#ffffff'; c.lineWidth = R * .07; c.beginPath(); c.ellipse(cx, cy, R * .5, R * .15, -.35, .15, Math.PI - .15, true); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = R * .04; c.beginPath(); c.ellipse(cx, cy, R * .72, R * .3, .4, Math.PI * 1.1, Math.PI * 2.02); c.stroke();
  c.fillStyle = '#ffffff';
  for (const [x, y, s] of [[-.52, -.42, .09], [.5, -.5, .07], [.58, .1, .05]]) {
    c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 ? .4 : 1) * s * R; c.lineTo(cx + x * R + Math.cos(a) * rr, cy + y * R + Math.sin(a) * rr); } c.closePath(); c.fill();
  }
  c.strokeStyle = '#b78520'; c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath(); c.arc(cx, cy, R * .92, 0, TAU); c.stroke(); c.setLineDash([]);
}

const models = {
  // A modern EVA suit standing tall and waving hello: white fabric bunched in soft folds at the knees and elbows, the
  // big life-support backpack, a control box on the chest, red commander's stripes, a mission patch, a checklist on the
  // wrist, and the helmet with its gold visor pulled down, lamps and a camera on its sides.
  spacesuit(k) {
    const T = k.THREE, g = k.group(), m = suitMats(k), V = (x, y, z) => new T.Vector3(x, y, z);
    // everything above the legs goes in `up`, which turns a little toward us and leans off the waving arm at the end
    const up = k.group(); g.add(up);
    // the body, hips to shoulders in one piece with its seams stitched on, a grey band where the top half locks on
    k.add(up, bodyGeo(k, [
      [2.36, .02, .02, 0], [2.42, .36, .3, 0], [2.56, .6, .47, 0], [2.8, .71, .53, 0], [3.04, .72, .53, 0], [3.26, .68, .5, 0],
      [3.56, .77, .55, .02], [3.96, .93, .62, .04], [4.34, .99, .64, .04], [4.62, .97, .61, .02], [4.84, .83, .53, 0], [4.98, .57, .42, 0], [5.04, .24, .21, 0], [5.05, .02, .02, 0],
    ], 2.6, 72, 64), m.body);
    k.add(up, bodyGeo(k, [[3.16, .685, .505, 0], [3.2, .715, .535, 0], [3.34, .72, .535, .005], [3.38, .69, .51, .005]], 2.6, 72, 6), m.fab2);
    // legs, knees a little bent: soft folds at the hips and knees, red stripes round the thighs and shins, and the boots
    const legR = q => lerp(.37, .285, smooth(0, 1, q));
    for (const s of [-1, 1]) {
      const c = curveOf(k, s > 0
        ? [[.4, 2.95, 0], [.45, 2.3, .06], [.5, 1.62, .17], [.54, 1.0, .1], [.56, .5, .08]]
        : [[-.4, 2.95, 0], [-.45, 2.3, 0], [-.5, 1.62, .08], [-.54, 1.0, -.02], [-.56, .5, -.05]]);
      k.add(g, varTube(k, c, (sl, L, a) => legR(sl / L) * (1 + folds([{ c: .52, w: .15, n: 3, amp: .15, ph: s }, { c: .1, w: .09, n: 2, amp: .05, ph: 2 * s }])(sl, L, a)), { seg: 96, rs: 28 }), m.fab);
      for (const q of [.28, .8]) {
        const b = aim(k, k.group([], { p: c.getPointAt(q).toArray() }), c.getTangentAt(q)); g.add(b);
        k.add(b, k.cyl(legR(q) + .012, legR(q) + .012, .14, { open: true, seg: 40 }), m.red);
      }
      const end = c.getPointAt(1), bt = boot(k, m);
      bt.position.set(end.x, 0, end.z); bt.rotation.y = s > 0 ? .26 : -.14; bt.scale.setScalar(1.08); g.add(bt);
    }
    // shoulders, and the arms: the right one up in a wave, the left hanging easy
    const armR = q => lerp(.32, .235, smooth(0, 1, q));
    const arms = [
      { s: -1, pts: [[-.88, 4.52, .02], [-1.28, 4.57, .06], [-1.68, 4.78, .14], [-1.86, 5.12, .22], [-1.93, 5.52, .28], [-1.95, 5.72, .3]], palm: V(.45, .05, 1), hand: { curl: .08, spread: .13, thumb: V(.75, .62, .3) } },
      { s: 1, pts: [[.88, 4.52, .02], [1.2, 4.3, .03], [1.32, 3.86, .06], [1.34, 3.44, .12], [1.32, 3.04, .24], [1.29, 2.8, .32]], palm: V(-1, 0, .2), hand: { curl: .42, spread: .03, thumb: V(.5, .8, .6) } },
    ];
    let leftArm = null;
    for (const a of arms) {
      k.add(up, k.sphere(.4, { w: 40, h: 28 }), m.fab, { p: [a.s * .92, 4.52, .02], s: [.86, 1, 1] });
      const c = curveOf(k, a.pts);
      k.add(up, varTube(k, c, (sl, L, an) => armR(sl / L) * (1 + folds([{ c: .56, w: .15, n: 3, amp: .13, ph: a.s }, { c: .1, w: .08, n: 2, amp: .05 }])(sl, L, an)), { seg: 96, rs: 28 }), m.fab);
      const end = c.getPointAt(1), dir = c.getTangentAt(1);
      const wr = orient(k, k.group([], { p: end.toArray() }), dir, a.palm); up.add(wr);
      k.add(wr, k.cyl(.255, .255, .1, { seg: 40 }), m.ring);
      k.add(wr, k.torus(.255, .022, { rs: 8, ts: 40 }), m.alu, { p: [0, .05, 0], r: [Math.PI / 2, 0, 0] });
      const hand = glove(k, m, a.hand); hand.position.y = .05; hand.scale.set(a.s > 0 ? -1.1 : 1.1, 1.1, 1.1);
      if (a.s > 0) leftArm = c;
      wr.add(hand);
    }
    // the mission patch on the left shoulder, and the checklist on the left wrist
    const pq = .29, pp = leftArm.getPointAt(pq), pr = armR(pq) + .006;
    const patch = orient(k, k.group([], { p: pp.toArray() }), leftArm.getTangentAt(pq), V(1, .1, .6)); up.add(patch);
    k.add(patch, k.cyl(pr, pr, .3, { open: true, start: -.52, len: 1.04, seg: 20 }), k.painted(256, 256, patchPaint, { transparent: true, rough: .8, cache: 'suits-patch' }), { shadow: false });
    const cl = orient(k, k.group([], { p: leftArm.getPointAt(.84).toArray() }), leftArm.getTangentAt(.84), V(.7, .2, 1)); up.add(cl);
    k.add(cl, k.box(.3, .34, .07, .025), m.shell2, { p: [0, 0, armR(.84) + .02], r: [.08, 0, 0] });
    cl.add(k.decal(.26, .3, (c, w, h) => {
      c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#3868e0'; c.fillRect(0, 0, w, h * .14);
      c.fillStyle = '#9aa3b0'; for (let i = 0; i < 6; i++) c.fillRect(w * .12, h * (.26 + i * .11), w * (i % 3 === 2 ? .5 : .76), h * .035);
    }, { px: 64, p: [0, 0, armR(.84) + .058], r: [.08, 0, 0] }));
    // the control box on the chest: a little screen, a knob, buttons and two hose connectors
    const dcm = k.group([], { p: [0, 3.98, .66], r: [-.1, 0, 0] }); up.add(dcm);
    k.add(dcm, k.box(.74, .42, .3, .06), m.shell2);
    dcm.add(k.decal(.68, .36, (c, w, h) => {
      c.fillStyle = '#3a414d'; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 14); c.fill();
      c.fillStyle = '#9aa6b6'; c.font = '700 13px Nunito, sans-serif'; c.textAlign = 'center';
      c.fillText('PWR', w * .14, h * .88); c.fillText('FAN', w * .3, h * .88); c.fillText('O2', w * .46, h * .88); c.fillText('TEMP', w * .8, h * .88);
    }, { px: 256, p: [0, 0, .152] }));
    k.add(dcm, k.plane(.3, .12), k.painted(160, 64, (c, w, h) => {
      c.fillStyle = '#0d2a1c'; c.fillRect(0, 0, w, h);
      k.text(c, 'O2 98%', w * .5, h * .36, { size: 22, color: '#8dffb0', font: 'Nunito, monospace', weight: 800 });
      k.text(c, '4.3 PSI', w * .5, h * .74, { size: 18, color: '#8dffb0', font: 'Nunito, monospace', weight: 800 });
    }, { glow: 1.1 }), { p: [-.15, .07, .154], shadow: false });
    const knob = k.knob(.075, .07, k.plastic('#23272e', { rough: .4 })); knob.position.set(.23, .03, .15); knob.rotation.x = Math.PI / 2; dcm.add(knob);
    for (const [col, x] of [['#e6e8eb', -.25], ['#f2c230', -.09], ['#3dc46b', .06]]) k.add(dcm, k.box(.075, .045, .04, .012), k.plastic(col, { rough: .4 }), { p: [x, -.1, .16] });
    for (const [col, y] of [['#3868e0', .07], ['#d9342b', -.08]]) k.add(dcm, k.cyl(.048, .048, .1, { seg: 16 }), k.plastic(col, { rough: .4 }), { p: [.41, y, 0], r: [0, 0, Math.PI / 2] });
    // the helmet, turned toward us and tipped a little toward the wave
    const hs = .72, hel = evaHelmet(k, m, { stripe: true }); hel.scale.setScalar(hs); hel.position.set(0, 4.95 + .93 * hs, .05); hel.rotation.set(-.04, .18, .07); up.add(hel);
    // the backpack: the life-support unit, with seams, a grey lower unit and a whip antenna
    const pl = k.group([], { p: [0, 4.36, -.96] }); up.add(pl);
    k.add(pl, k.box(1.72, 2.2, .76, .17), m.pack);
    k.add(pl, k.box(1.6, .38, .7, .1), m.fab2, { p: [0, -1.21, -.02] });
    k.add(pl, k.box(1.2, .6, .3, .08), m.fab2, { p: [0, -.8, .4] });
    pl.add(k.decal(.68, 1.98, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.strokeStyle = 'rgba(96,104,118,.5)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(w * .52, h * .03); c.lineTo(w * .52, h * .97); c.moveTo(w * .05, h * .34); c.lineTo(w * .95, h * .34); c.stroke();
      c.fillStyle = 'rgba(120,128,140,.8)';
      for (const [x, y] of [[.12, .06], [.88, .06], [.12, .94], [.88, .94], [.12, .3], [.88, .3], [.12, .38], [.88, .38]]) { c.beginPath(); c.arc(x * w, y * h, 4, 0, TAU); c.fill(); }
      c.fillStyle = '#2d3440'; c.beginPath(); c.roundRect(w * .62, h * .5, w * .26, h * .12, 6); c.fill();
      c.fillStyle = '#f2c230'; c.fillRect(w * .66, h * .53, w * .18, h * .02); c.fillRect(w * .66, h * .57, w * .18, h * .02);
    }, { px: 128, p: [.862, .05, 0], r: [0, Math.PI / 2, 0] }));
    pl.add(k.decal(.68, 1.98, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(96,104,118,.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(w * .48, h * .03); c.lineTo(w * .48, h * .97); c.stroke(); }, { px: 64, p: [-.862, .05, 0], r: [0, -Math.PI / 2, 0] }));
    k.add(pl, k.cyl(.02, .015, .76, { seg: 8 }), m.alu, { p: [.6, 1.46, -.2], r: [0, 0, -.08] });
    k.add(pl, k.sphere(.038, { w: 12, h: 8 }), m.alu, { p: [.63, 1.85, -.2] });
    k.add(pl, k.cyl(.065, .075, .09, { seg: 16 }), m.dark, { p: [.6, 1.12, -.2] });
    // turn the upper body about the hips
    const hip = V(0, 2.9, 0); up.rotation.set(0, .1, -.03); up.position.copy(hip).sub(hip.clone().applyEuler(up.rotation));
    g.userData.view = { az: 26, el: 10 };
    g.userData.fullView = { el: 7, zoom: .91 };
    return g;
  },

  // An EVA helmet on its own: a glossy white shell, the gold sun visor pulled down (a warm mirror with the Earth and a
  // few stars in it), lamps and a camera on its sides, standing on its blue neck ring.
  helmet(k) {
    const g = k.group(), m = suitMats(k);
    const h = evaHelmet(k, m, { stripe: true }); h.position.y = .93; h.rotation.y = .32; g.add(h);
    g.userData.view = { az: 30, el: 14 };
    return g;
  },

  // The manned manoeuvring unit: a white armchair of a backpack, hand controllers on the ends of its armrests, nitrogen
  // thrusters in threes at its eight corners (two of them puffing), gold foil and black trim. Nobody in it.
  jetpack(k) {
    const T = k.THREE, g = k.group(), V = (x, y, z) => new T.Vector3(x, y, z);
    const white = k.gloss('#f6f5f1'), black = k.plastic('#1d2026', { rough: .35 });
    const steel = k.metal('#c0c6ce', .22), gold = k.metal('#f0bd52', .2), foil = foilMat(k, [1, 3.2]);
    const W = 2.3, H = 2.9, D = 1.0, y0 = .45, zc = -.6, yc = y0 + H / 2;
    // the case holding the two nitrogen tanks, gold foil panels framed in black on its sides
    k.add(g, k.box(W, H, D, .24), white, { p: [0, yc, zc] });
    for (const s of [-1, 1]) {
      k.add(g, k.box(.04, H - .78, D - .38, .015), black, { p: [s * (W / 2 + .004), yc, zc] });
      k.add(g, k.box(.05, H - .88, D - .48, .015), foil, { p: [s * (W / 2 + .01), yc, zc] });
    }
    // the padded back the astronaut leans on, with latches at its corners
    const quilt = k.mat({ roughness: .9, sheen: .6, sheenColor: k.color('#b8c0cc'), map: k.tex(128, 180, (c, w, h) => {
      c.fillStyle = '#545b66'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(30,34,40,.55)'; c.lineWidth = 2;
      for (let i = -6; i < 12; i++) { c.beginPath(); c.moveTo(i * 22, 0); c.lineTo(i * 22 + h * .6, h); c.moveTo(i * 22 + h * .6, 0); c.lineTo(i * 22, h); c.stroke(); }
      c.fillStyle = '#2a2f37'; c.fillRect(w * .16, 0, w * .1, h); c.fillRect(w * .74, 0, w * .1, h);
      c.fillStyle = '#9aa2ae'; for (const x of [.21, .79]) c.fillRect(w * (x - .06), h * .46, w * .12, h * .06);
    }, { cache: 'suits-quilt' }) });
    k.add(g, k.box(1.5, 2.0, .12, .06), quilt, { p: [0, yc, zc + D / 2 + .02] });
    for (const x of [-.52, .52]) for (const y of [yc - .78, yc + .82]) k.add(g, k.box(.2, .13, .12, .03), steel, { p: [x, y, zc + D / 2 + .08] });
    // a black nameplate with a star over the backrest
    g.add(k.decal(.74, .13, (c, w, h) => {
      c.fillStyle = '#1d2026'; c.beginPath(); c.roundRect(1, 1, w - 2, h - 2, h * .3); c.fill();
      c.fillStyle = '#f0bd52'; c.fillRect(w * .06, h * .45, w * .3, h * .1); c.fillRect(w * .64, h * .45, w * .3, h * .1);
      c.fillStyle = '#ffffff'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? .18 : .42) * h; c.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } c.closePath(); c.fill();
    }, { px: 256, p: [0, yc + 1.08, zc + D / 2 + .004] }));
    // a thruster block at every corner, each with three gold nozzles pointing out three ways
    const blocks = [], nozzles = [];
    const px = W / 2 - .02, pys = [y0 + .16, y0 + H - .16], pzs = [zc + D / 2 - .04, zc - D / 2 + .04];
    for (const sx of [-1, 1]) for (const y of pys) for (const z of pzs) {
      const p = V(sx * px, y, z), sy = y > yc ? 1 : -1, sz = z > zc ? 1 : -1;
      blocks.push({ p: p.toArray() });
      for (const d of [V(sx, 0, 0), V(0, sy, 0), V(0, 0, sz)]) nozzles.push({ p: p.clone().addScaledVector(d, .17).toArray(), r: eulerTo(k, d), key: [sx, sy, sz, d.x, d.y, d.z].join(), d, at: p.clone().addScaledVector(d, .31) });
    }
    g.add(k.instances(k.box(.34, .34, .34, .07), black, blocks));
    const bell = k.lathe([[.045, 0], [.055, .02], [.065, .07], [.095, .14], [.08, .14], [.058, .085], [.038, .03], [0, .03]], { seg: 20 });
    g.add(k.instances(bell, gold, nozzles));
    // navigation lights on the two top front corners: red on its left (+x), green on its right
    for (const sx of [-1, 1]) {
      const p = V(sx * (px + .1), pys[1] + .18, pzs[0] + .1), col = sx > 0 ? '#ff4a3d' : '#4dff7a';
      k.add(g, k.sphere(.05, { w: 12, h: 8 }), k.glow(col, 2.4), { p: p.toArray(), shadow: false });
      g.add(k.place(halo(k, .17, col, .6), { p: p.toArray() }));
    }
    // the armrests: black arms swinging forward, white boxes on their ends carrying the hand controllers
    const arm = {};
    for (const sx of [-1, 1]) {
      const A = k.group([], { p: [sx * (W / 2 + .16), y0 + 1.0, zc + .25], r: [.12, 0, 0] }); g.add(A);
      k.add(A, k.cyl(.15, .15, .14, { seg: 24 }), steel, { p: [-sx * .09, 0, 0], r: [0, 0, Math.PI / 2] });
      k.add(A, k.box(.16, .19, .9, .06), black, { p: [0, 0, .45] });
      k.add(A, k.box(.42, .38, .7, .09), white, { p: [0, .06, 1.12] });
      k.add(A, k.box(.43, .07, .71, .02), black, { p: [0, -.08, 1.12] });
      arm[sx] = A;
    }
    // left: the translation controller, a T-handle, and a little screen
    k.add(arm[1], k.cyl(.035, .04, .2, { seg: 12 }), steel, { p: [0, .34, 1.2] });
    k.add(arm[1], k.capsule(.055, .26), black, { p: [0, .47, 1.2], r: [0, 0, Math.PI / 2] });
    k.add(arm[1], k.plane(.24, .12), k.painted(96, 48, (c, w, h) => { c.fillStyle = '#062416'; c.fillRect(0, 0, w, h); k.text(c, 'N2 98', w / 2, h / 2 + 1, { size: 22, color: '#6dffa0', font: 'Nunito, monospace', weight: 800 }); }, { glow: 1.2 }), { p: [0, .1, 1.473], shadow: false });
    // right: the rotation controller, a pistol grip with a red button
    const grip = k.group([], { p: [0, .25, 1.2], r: [.3, 0, 0] }); arm[-1].add(grip);
    k.add(grip, k.cyl(.05, .055, .07, { seg: 16 }), steel);
    k.add(grip, k.capsule(.075, .22), black, { p: [0, .18, 0] });
    k.add(grip, k.sphere(.036, { w: 12, h: 8 }), k.gloss('#e3342a'), { p: [0, .33, .02] });
    // two thrusters firing: soft cyan puffs
    const fire = (key, len) => { const n = nozzles.find(q => q.key === key.join()); const p = puff(k, len, .28); p.position.copy(n.at); aim(k, p, n.d); g.add(p); };
    fire([-1, 1, 1, 0, 1, 0], 1.2);
    fire([1, -1, 1, 1, 0, 0], 1.1);
    g.rotation.set(.04, 0, -.05);
    g.userData.floating = true;
    g.userData.view = { az: 40, el: 22 };
    return g;
  },

  // A robot astronaut on a short stand: a gold-visored head, a white torso with a backpack, jointed arms and
  // five-fingered hands, one giving a thumbs-up.
  robonaut(k) {
    const T = k.THREE, g = k.group(), V = (x, y, z) => new T.Vector3(x, y, z);
    const white = k.gloss('#f7f6f2'), joint = k.metal('#5f6877', .3), dark = k.plastic('#2b3039', { rough: .42 }), steel = k.metal('#b8bfc9', .28);
    const hm = { white, palm: dark, finger: k.metal('#aab2bd', .3), knuckle: joint };
    // the stand: a bolted base plate, a short column and the waist joint
    k.add(g, k.rcyl(.64, .1, .035, { seg: 56 }), k.metal('#59606b', .4));
    g.add(k.instances(k.cyl(.035, .035, .03, { seg: 12 }), steel, Array.from({ length: 8 }, (_, i) => { const a = i / 8 * TAU + .2; return { p: [Math.sin(a) * .54, .11, Math.cos(a) * .54] }; })));
    k.add(g, k.cyl(.15, .18, .62, { seg: 36 }), k.metal('#c8ced6', .3), { p: [0, .41, 0] });
    k.add(g, k.torus(.165, .025, { rs: 8, ts: 36 }), dark, { p: [0, .3, 0], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.rcyl(.27, .14, .04, { seg: 48 }), joint, { p: [0, .7, 0] });
    // the waist, a dark ribbed bellows, and the torso: a white shell, broad in the shoulders
    k.add(g, k.lathe([[0, .8], [.2, .8], [.235, .84], [.205, .88], [.235, .92], [.205, .96], [.235, 1.0], [.205, 1.04], [.235, 1.08], [.2, 1.14], [0, 1.16]], { seg: 40 }), dark, { s: [1, 1, .88] });
    k.add(g, bodyGeo(k, [[1.06, .02, .02, 0], [1.09, .27, .22, 0], [1.24, .35, .26, .01], [1.5, .46, .3, .03], [1.8, .56, .34, .04], [2.02, .58, .34, .03], [2.18, .5, .29, .01], [2.27, .27, .19, 0], [2.29, .02, .02, 0]], 3.2, 64, 44),
      k.gloss('#ffffff', { map: k.tex(512, 512, robotPanels, { cache: 'suits-robot-panels' }) }));
    // backpack
    k.add(g, k.box(1.0, 1.02, .48, .13), white, { p: [0, 1.72, -.52] });
    k.add(g, k.box(.92, .16, .5, .05), dark, { p: [0, 1.25, -.52] });
    g.add(k.decal(.36, .5, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#2b3039'; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 10); c.fill(); c.fillStyle = '#5b6371'; for (let i = 0; i < 7; i++) c.fillRect(w * .15, h * (.12 + i * .11), w * .7, h * .05); }, { px: 64, p: [.502, 1.8, -.52], r: [0, Math.PI / 2, 0] }));
    // chest: a badge and two friendly status lights
    g.add(k.decal(.24, .24, patchPaint, { px: 128, p: [.22, 1.8, .392], r: [0, .3, 0] }));
    for (const x of [-.24, -.16]) k.add(g, k.sphere(.024, { w: 12, h: 8 }), k.glow('#43f0ff', 2.2), { p: [x, 1.86, .392], shadow: false });
    // neck and head: a white helmet with a gold visor across its face, two soft cyan eyes behind the gold, a dark chin
    k.add(g, k.cyl(.09, .11, .24, { seg: 20 }), joint, { p: [0, 2.36, .02] });
    const head = k.group([], { p: [0, 2.66, .05], r: [.05, .3, -.08] }); g.add(head);
    const hg = k.group([], { s: [.37, .34, .38] }); head.add(hg);
    k.add(hg, k.sphere(1, { w: 48, h: 32 }), white);
    const vis = k.mesh(capGeo(k, ovalOpen(1.1, .7, .32, 2.6), 1.012, { nu: 72, nv: 14 }), visorMat(k)); vis.rotation.x = -.1; hg.add(vis);
    const chin = k.mesh(capGeo(k, ovalOpen(.55, .16, .16, 2.4), 1.006, { nu: 48, nv: 8 }), dark); chin.rotation.x = .78; hg.add(chin);
    for (const s of [-1, 1]) {
      const d = V(s * .34, .14, .93).normalize(), e = aim(k, k.group([], { p: d.clone().multiplyScalar(1.02).toArray() }), d); hg.add(e);
      k.add(e, k.cyl(.12, .12, .02, { seg: 24 }), k.glow('#6ff3ff', 1.6), { shadow: false });
      const ear = aim(k, k.group([], { p: [s * .99, 0, -.05] }), V(s, 0, 0)); hg.add(ear);
      k.add(ear, k.rcyl(.28, .08, .03, { seg: 28 }), joint);
    }
    // shoulders and arms: the left up in a thumbs-up, the right held out, palm up
    const limbSeg = (A, B, r, gap) => { const d = B.clone().sub(A); return k.add(g, k.capsule(r, Math.max(.05, d.length() - gap), 14), white, { p: A.clone().addScaledVector(d, .5).toArray() }); };
    const arm = (s, S, E, W) => {
      k.add(g, k.sphere(.26, { w: 32, h: 20 }), white, { p: [s * .62, 2.02, 0] });
      k.add(g, k.cyl(.19, .19, .12, { seg: 28 }), joint, { p: [s * .82, 1.97, 0], r: [0, 0, Math.PI / 2] });
      aim(k, limbSeg(S, E, .175, .34), E.clone().sub(S));
      k.add(g, k.sphere(.145, { w: 24, h: 16 }), joint, { p: E.toArray() });
      aim(k, limbSeg(E, W, .165, .3), W.clone().sub(E));
      k.add(g, k.sphere(.1, { w: 20, h: 14 }), joint, { p: W.toArray() });
    };
    const LS = V(.9, 1.95, 0), LE = V(1.02, 1.44, .14), LW = V(1.03, 1.84, .56);
    const RS = V(-.9, 1.95, 0), RE = V(-1.0, 1.42, .08), RW = V(-1.04, 1.08, .48);
    arm(1, LS, LE, LW); arm(-1, RS, RE, RW);
    // the thumbs-up: a fist, knuckles forward, thumb to the sky
    const lh = orient(k, k.group([], { p: LW.toArray() }), V(0, .35, 1), V(-1, 0, 0)); g.add(lh);
    const fist = robotHand(k, hm, { curl: 1.3, thumb: V(1, .12, .1), thumbCurl: 0 }); fist.scale.set(-1.6, 1.6, 1.6); fist.position.y = .02; lh.add(fist);
    const rh = orient(k, k.group([], { p: RW.toArray() }), RW.clone().sub(RE), V(.6, 1, 0)); g.add(rh);
    const open = robotHand(k, hm, { curl: .4, thumb: V(.6, .7, .5) }); open.scale.setScalar(1.6); open.position.y = .02; rh.add(open);
    g.userData.view = { az: 34, el: 12 };
    return g;
  },
};
export default models;
