// Outer Space models: rockets. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.
// The rockets stand on their fins (the moon rocket on its engines) at y = 0; the capsule hangs under its parachutes.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Smooth shading for extrusions: faces that meet at less than `crease` degrees share normals (bevels read round,
// real corners stay crisp).
function soft(geo, crease = 50) {
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, f = Float32Array.from(n.array), cos = Math.cos(crease * Math.PI / 180);
  const groups = new Map();
  for (let i = 0; i < p.count; i++) {
    const kk = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    (groups.get(kk) || groups.set(kk, []).get(kk)).push(i);
  }
  for (const ids of groups.values()) for (const i of ids) {
    let x = 0, y = 0, z = 0;
    for (const j of ids) if (f[i * 3] * f[j * 3] + f[i * 3 + 1] * f[j * 3 + 1] + f[i * 3 + 2] * f[j * 3 + 2] > cos) { x += f[j * 3]; y += f[j * 3 + 1]; z += f[j * 3 + 2]; }
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(i, x / l, y / l, z / l);
  }
  n.needsUpdate = true;
  return geo;
}
// A lathe whose texture v runs by height (0 at y0, 1 at y1), so painted bands land at the right heights.
function latheY(k, pts, o = {}) {
  const geo = k.lathe(pts, o), p = geo.attributes.position, uv = geo.attributes.uv;
  const ys = pts.map(q => q[1]), y0 = o.y0 ?? Math.min(...ys), y1 = o.y1 ?? Math.max(...ys);
  for (let i = 0; i < p.count; i++) uv.setY(i, (p.getY(i) - y0) / (y1 - y0));
  uv.needsUpdate = true;
  return geo;
}
// The radius of a lathe profile at height y (the same spline k.lathe runs through when smooth).
function radiusAt(k, pts, smoothed = true) {
  const T = k.THREE, P = smoothed ? new T.SplineCurve(pts.map(([r, y]) => new T.Vector2(r, y))).getPoints(600) : pts.map(([r, y]) => new T.Vector2(r, y));
  return y => {
    for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i]; if ((y - a.y) * (y - b.y) <= 0 && a.y !== b.y) return a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y); }
    return y < P[0].y ? P[0].x : P[P.length - 1].x;
  };
}
// Turn obj so its local +y runs along d, with its local +z leaning toward w.
function orient(k, obj, d, w = [0, 0, 1]) {
  const T = k.THREE, Y = new T.Vector3(...d).normalize(), W = new T.Vector3(...w);
  const Z = W.clone().addScaledVector(Y, -W.dot(Y));
  if (Z.lengthSq() < 1e-8) Z.set(1, 0, 0).addScaledVector(Y, -Y.x);
  Z.normalize();
  obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3().crossVectors(Y, Z), Y, Z));
  return obj;
}
// Put obj at pos with its local +z along the surface normal n and its local +y leaning toward up.
function onSurface(k, obj, pos, n, up = [0, 1, 0]) {
  const T = k.THREE, Z = new T.Vector3(...n).normalize(), U = new T.Vector3(...up);
  const Y = U.addScaledVector(Z, -U.dot(Z)).normalize(), X = new T.Vector3().crossVectors(Y, Z);
  obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z));
  obj.position.set(...pos);
  return obj;
}
// An instance (for k.instances with a unit cylinder, k.cyl(1, 1, 1)) running from a to b, radius r.
function rodInst(k, a, b, r) {
  const T = k.THREE, A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const e = new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()));
  return { p: A.clone().lerp(B, .5).toArray(), r: [e.x, e.y, e.z], s: [r, L, r] };
}
// A soft additive glow round a light (a sprite: it faces the camera and casts no shadow).
function halo(k, r, color, opacity = .35) {
  const T = k.THREE, tex = k.tex(128, 128, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, { cache: 'rockets-halo' });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k.color(color), transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }));
  s.scale.set(r * 2, r * 2, 1);
  return s;
}
// Clear plastic that shows its shape: nearly see-through face on, thickening to a bright edge where it turns away
// (alpha follows the viewing angle), so a bottle or a cover reads against a dark sky.
function clearMat(k, tint = '#ffffff', o = {}) {
  const a0 = o.a0 ?? .05, a1 = o.a1 ?? .75, pw = o.pow ?? 2.5, rim = o.rim ?? .35;
  const m = k.glass(tint, { opacity: 1, env: o.env ?? 2.4 });
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      float rimF = 1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
      gl_FragColor = vec4(outgoingLight + vec3(${rim.toFixed(3)}) * pow(rimF, 3.0), ${a0.toFixed(3)} + ${(a1 - a0).toFixed(3)} * pow(rimF, ${pw.toFixed(3)}));`);
  };
  m.customProgramCacheKey = () => `rockets-clear:${a0}:${a1}:${pw}:${rim}`;
  return m;
}
// A five-pointed star path on a 2D canvas.
function starPath(c, x, y, r, inner = .45, rot = -Math.PI / 2) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5, rr = i % 2 ? r * inner : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath();
}

export default {
  // A big glossy red mushroom button on a hazard-striped console, its clear safety cover flipped up, LAUNCH on the front.
  redbutton(k) {
    const g = k.group();
    const S = 2.8, H = 1.1, yb = .2, top = yb + H, plateT = .22, y0 = top + plateT;
    const chrome = k.chrome(), dark = k.plastic('#2a3039', { rough: .42, coat: .4 });
    // the plinth and the console block: yellow-and-black stripes all round, a dark deck on top
    k.add(g, k.box(S + .24, yb, S + .24, .08), k.plastic('#17191e', { rough: .6, coat: .15 }), { p: [0, yb / 2, 0] });
    const hz = k.tex(512, Math.round(512 * H / S), (c, w, h) => {
      c.fillStyle = '#ffc410'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#18191d';
      const p = w / 5;
      for (let x = -h - p; x < w + p; x += p) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + p / 2, h); c.lineTo(x + p / 2 + h, 0); c.lineTo(x + h, 0); c.closePath(); c.fill(); }
      for (let i = 0; i < 140; i++) { c.fillStyle = `rgba(255,255,255,${k.range(.04, .14)})`; c.fillRect(k.rand() * w, k.rand() * h, k.range(2, 6), 1); }
    });
    const stripes = k.plastic('#ffffff', { map: hz, rough: .32, coat: .7 });
    k.add(g, k.box(S, H, S, .06), [stripes, stripes, dark, dark, stripes, stripes], { p: [0, yb + H / 2, 0] });
    k.add(g, k.box(S + .12, plateT, S + .12, .07), dark, { p: [0, top + plateT / 2 - .005, 0] });
    const screws = [];
    for (const x of [-1, 1]) for (const z of [-1, 1]) screws.push({ p: [x * (S / 2 - .2), y0 + .005, z * (S / 2 - .2)] });
    g.add(k.instances(k.cyl(.075, .075, .035, { seg: 16 }), chrome, screws));
    // the button: a chrome bezel, a ring of red light, and the big glossy mushroom cap
    k.add(g, k.rcyl(1.02, .18, .06, { seg: 64 }), chrome, { p: [0, y0 - .02, 0] });
    k.add(g, k.cyl(.9, .9, .12, { seg: 64 }), k.plastic('#0e0f12', { rough: .5 }), { p: [0, y0 + .16, 0] });
    k.add(g, k.torus(.9, .035, { rs: 10, ts: 72 }), k.glow('#ff3322', 2.4), { p: [0, y0 + .19, 0], r: [Math.PI / 2, 0, 0], shadow: false });
    const cap = k.lathe([[0, 0], [.8, 0], [.89, .03], [.94, .1], [.94, .19], [.89, .29], [.79, .39], [.63, .48], [.43, .545], [.21, .578], [0, .588]], { smooth: true, seg: 72 });
    k.add(g, cap, k.gloss('#d20b13', { emissive: k.color('#ff1a10'), emissiveIntensity: .12 }), { p: [0, y0 + .18, 0] });
    const hb = halo(k, 1.35, '#ff3a26', .22); hb.position.set(0, y0 + .4, 0); g.add(hb);
    // the hinge along the back, and the clear safety cover flipped up and over on it
    const hingeZ = -S / 2 + .2, hingeY = y0 + .08;
    k.add(g, k.cyl(.075, .075, 2.1, { seg: 20 }), chrome, { p: [0, hingeY, hingeZ], r: [0, 0, Math.PI / 2] });
    for (const x of [-.8, .8]) k.add(g, k.box(.24, .16, .26, .04), dark, { p: [x, y0 + .05, hingeZ] });
    const cover = k.group([], { p: [0, hingeY, hingeZ], r: [-2.05, 0, 0] }); g.add(cover);
    const cw = 2.18, cd = 2.2, ch = .8, clear = clearMat(k, '#fff3cc', { a0: .1, a1: .8 });
    const ring = k.roundRect(cw, cd, .28); ring.holes.push(k.roundRect(cw - .09, cd - .09, .24));
    k.add(cover, k.extrude(ring, ch, { bevel: .012 }), clear, { p: [0, ch / 2, cd / 2 + .06], r: [-Math.PI / 2, 0, 0], shadow: false });
    k.add(cover, k.extrude(k.roundRect(cw, cd, .28), .05, { bevel: .015 }), clear, { p: [0, ch + .02, cd / 2 + .06], r: [-Math.PI / 2, 0, 0], shadow: false });
    k.add(cover, k.box(1.5, .1, .16, .04), k.plastic('#ffc410', { rough: .35 }), { p: [0, .02, .1] });
    // printed on the lid, facing whoever just flipped it open
    cover.add(k.decal(1.7, .62, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.strokeStyle = '#e8141c'; c.lineWidth = h * .05; c.beginPath(); c.roundRect(h * .05, h * .05, w - h * .1, h * .9, h * .14); c.stroke();
      k.text(c, 'DO NOT', w / 2, h * .32, { size: h * .3, weight: 700, color: '#e8141c' });
      k.text(c, 'PRESS', w / 2, h * .68, { size: h * .36, weight: 700, color: '#e8141c' });
    }, { px: 320, p: [0, ch - .02, cd / 2 + .06], r: [Math.PI / 2, 0, 0] }));
    // the engraved plate on the front, and two status lights on the deck
    const brushed = k.tex(256, 64, (c, w, h) => { c.fillStyle = '#cfd4db'; c.fillRect(0, 0, w, h); for (let i = 0; i < 200; i++) { c.fillStyle = `rgba(${k.rand() < .5 ? '255,255,255' : '80,86,96'},${k.range(.06, .26)})`; c.fillRect(0, k.rand() * h, w, 1); } });
    const pl = k.group([], { p: [0, yb + H * .5, S / 2] }); g.add(pl);
    k.add(pl, k.box(1.62, .5, .06, .025), k.metal('#e2e6eb', .3, { map: brushed }));
    pl.add(k.decal(1.36, .42, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      k.text(c, 'LAUNCH', w / 2, h / 2 + 3, { size: h * .66, weight: 700, color: 'rgba(255,255,255,.75)' });
      k.text(c, 'LAUNCH', w / 2, h / 2, { size: h * .66, weight: 700, color: '#15171b' });
    }, { px: 384, p: [0, 0, .034] }));
    pl.add(k.instances(k.cyl(.04, .04, .02, { seg: 12 }), chrome, [-.73, .73].map(x => ({ p: [x, 0, .033], r: [Math.PI / 2, 0, 0] }))));
    for (const [c, x] of [['#39ff6a', .95], ['#ffae1a', .62]]) {
      k.add(g, k.torus(.085, .022, { rs: 8, ts: 24 }), chrome, { p: [x, y0 + .01, S / 2 - .3], r: [Math.PI / 2, 0, 0] });
      k.add(g, k.sphere(.075, { w: 16, h: 10, thetaLen: Math.PI / 2 }), k.glow(c, 2.4), { p: [x, y0, S / 2 - .3] });
      const hh = halo(k, .32, c, .55); hh.position.set(x, y0 + .06, S / 2 - .3); g.add(hh);
    }
    g.userData.view = { el: 24 };
    return g;
  },

  // A 2-litre soda bottle turned upside down: three bright fins taped on, a red nose cone, water sloshing inside.
  waterrocket(k) {
    const T = k.THREE, g = k.group();
    const yN = .36;                                           // the nozzle's tip, above the ground; the fins stand lower
    const b = k.group([], { p: [0, yN, 0] }); g.add(b);       // the bottle, from the neck's tip (y = 0) up
    const pet = clearMat(k, '#e8fbff', { a0: .07, a1: .72 });
    // neck: a lip, threads and the support ring
    const neck = k.lathe([[.12, 0], [.14, .015], [.14, .28], [.2, .29], [.205, .32], [.2, .35], [.15, .36], [.15, .42]], { seg: 40 });
    k.add(b, neck, pet, { shadow: false }).renderOrder = 3;
    for (const y of [.07, .13, .19]) k.add(b, k.torus(.143, .012, { rs: 6, ts: 32 }), pet, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], shadow: false }).renderOrder = 3;
    // body: the shoulder swelling out to the barrel, a couple of grooves, then the base (hidden in the nose cone)
    const prof = [[.15, .4], [.16, .47], [.22, .58], [.32, .72], [.42, .88], [.49, 1.04], [.515, 1.2], [.52, 1.35], [.52, 2.1], [.503, 2.16], [.52, 2.22], [.52, 2.26], [.503, 2.31], [.52, 2.36], [.52, 2.88], [.49, 3.0], [.4, 3.1]];
    const rb = radiusAt(k, prof);
    k.add(b, k.lathe(prof, { smooth: true, seg: 64 }), pet, { shadow: false }).renderOrder = 3;
    // gleams along the clear plastic
    const gleam = Object.assign(k.glow('#ffffff', 1), { transparent: true, opacity: .55, depthWrite: false });
    for (const [a, wd, y, len] of [[-.16, .07, 2.12, 1.3], [.02, .025, 2.05, 1.1]]) {
      const m = k.add(b, k.cyl(.525, .525, len, { open: true, seg: 8, start: a, len: wd }), gleam, { p: [0, y, 0], shadow: false }); m.renderOrder = 4;
    }
    // the water: settled into the neck and shoulder, its surface tipped and rippling
    const L = 1.28, tilt = [.1, .05];
    const wp = prof.filter(([, y]) => y < L + .2).map(([r, y]) => [r - .018, y]);
    const wprof = [[0, .02], [.1, .02], [.12, .1], [.12, .36], ...wp, [rb(L + .2) - .018, L + .2], [.36, L + .2], [.24, L + .2], [.12, L + .2], [0, L + .2]];
    const wg = k.lathe(wprof, { seg: 48 }), wpos = wg.attributes.position;
    for (let i = 0; i < wpos.count; i++) {
      const x = wpos.getX(i), z = wpos.getZ(i), y = wpos.getY(i), d = Math.hypot(x, z);
      const surf = L + tilt[0] * x + tilt[1] * z + .018 * Math.sin(d * 14 + x * 3);
      if (y > surf) wpos.setY(i, surf);
    }
    wg.computeVertexNormals();
    const water = k.mat({ color: '#2b8dff', transparent: true, opacity: .78, roughness: .05, clearcoat: 1, clearcoatRoughness: .05, emissive: k.color('#1a66ff'), emissiveIntensity: .4, depthWrite: false, side: T.DoubleSide });
    k.add(b, wg, water, { shadow: false }).renderOrder = 1;
    const wl = k.mesh(k.torus(rb(L) - .018, .013, { rs: 6, ts: 64 }), k.glow('#c8ecff', 1.2), { p: [0, L, 0], shadow: false });
    orient(k, wl, [-tilt[0], 1, -tilt[1]]); wl.rotateX(Math.PI / 2); wl.renderOrder = 2; b.add(wl);
    // three fins cut from bright corrugated plastic, hugging the shoulder and reaching down past the nozzle
    const flutes = k.tex(128, 128, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,.08)'; for (let x = 0; x < w; x += 8) c.fillRect(x, 0, 3, h); }, { repeat: [6, 6] });
    const finMat = k.plastic('#8be02a', { rough: .45, coat: .3, map: flutes });
    const fs = new T.Shape(), yTop = 1.95, yIn = .6;
    fs.moveTo(rb(yTop) - .01, yTop); fs.lineTo(1.08, .95); fs.lineTo(1.2, -yN + .03); fs.quadraticCurveTo(1.2, -yN, 1.16, -yN); fs.lineTo(.98, -yN);
    fs.lineTo(rb(yIn) - .01, yIn);
    for (let i = 1; i <= 12; i++) { const y = yIn + (yTop - yIn) * i / 12; fs.lineTo(rb(y) - .01, y); }
    const finGeo = soft(k.extrude(fs, .05, { bevel: .014, bevelSeg: 2 }));
    for (const a of [70, 190, 310].map(k.deg)) k.add(b, finGeo, finMat, { r: [0, a - Math.PI / 2, 0] });
    // silver duct tape round the fin roots, and over the fins
    const tapeTex = k.tex(128, 64, (c, w, h) => {
      c.fillStyle = '#b9bfc7'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < w; i += 3) { c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(i, 0, 1, h); }
      for (let i = 0; i < h; i += 3) { c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(0, i, w, 1); }
      for (let i = 0; i < 18; i++) { c.strokeStyle = `rgba(${k.rand() < .5 ? '255,255,255' : '60,64,70'},.25)`; c.lineWidth = 1; c.beginPath(); const x = k.rand() * w; c.moveTo(x, 0); c.lineTo(x + k.range(-8, 8), h); c.stroke(); }
    }, { repeat: [5, 1] });
    const tape = k.mat({ color: '#ffffff', map: tapeTex, metalness: .5, roughness: .45 });
    for (const [y0, y1] of [[1.72, 1.9], [.66, .8]]) k.add(b, k.lathe([[rb(y0) + .008, y0], [rb((y0 + y1) / 2) + .01, (y0 + y1) / 2], [rb(y1) + .008, y1]], { seg: 64 }), tape);
    // a strip of masking tape with its name on, in marker
    const lbl = k.painted(1024, Math.round(1024 * .28 / (TAU * .527)), (c, w, h) => {
      c.fillStyle = '#efe0b8'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(150,120,60,${k.range(.03, .1)})`; c.fillRect(k.rand() * w, k.rand() * h, k.range(1, 3), 1); }
      c.fillStyle = 'rgba(120,90,40,.3)'; c.fillRect(0, 0, w, 2); c.fillRect(0, h - 2, w, 2);
      c.save(); c.translate(w / 2, h * .55); c.rotate(-.035);
      k.text(c, 'SOAKER 1', 0, 0, { size: h * .62, weight: 700, color: '#1d4fd6' });
      c.restore();
    }, { rough: .85 });
    k.add(b, k.cyl(.527, .527, .28, { open: true, start: k.deg(30) - Math.PI, len: TAU, seg: 64 }), lbl, { p: [0, 2.53, 0] });
    // the nose cone
    k.add(b, k.lathe([[.548, 0], [.552, .1], [.54, .3], [.49, .56], [.4, .78], [.27, .95], [.13, 1.05], [0, 1.09]], { smooth: true, seg: 56 }), k.gloss('#ff3b2f'), { p: [0, 2.74, 0] });
    k.add(b, k.torus(.55, .025, { rs: 8, ts: 56 }), k.gloss('#ff3b2f'), { p: [0, 2.74, 0], r: [Math.PI / 2, 0, 0] });
    // a burst of droplets spraying from the nozzle
    const drop = clearMat(k, '#8fd0ff', { a0: .35, a1: .95, rim: .5 });
    const drops = [], glints = [], toLight = new T.Vector3(-.5, .6, .4).normalize();
    for (let i = 0; i < 18; i++) {
      const a = k.deg(k.range(-70, 130)), t = Math.pow(k.rand(), .8), sp = (.08 + .7 * t) * k.range(.6, 1), s = k.range(.022, .045) * (1.25 - t * .45);
      const p = [Math.sin(a) * sp, yN - .03 - t * (yN - .05) * k.range(.7, 1), Math.cos(a) * sp];
      const dir = new T.Vector3(p[0], p[1] - yN, p[2]).normalize();
      const e = new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir));
      const st = i < 6 ? 2.6 : 1.5;                    // the first few, nearest the nozzle, are stretched into streaks
      drops.push({ p, r: [e.x, e.y, e.z], s: [s, s * st, s] });
      glints.push({ p: new T.Vector3(...p).addScaledVector(toLight, s * .55).toArray(), s: s * .28 });
    }
    const dm = k.instances(k.sphere(1, { w: 14, h: 10 }), drop, drops); dm.castShadow = false; dm.renderOrder = 5; g.add(dm);
    const gm = k.instances(k.sphere(1, { w: 8, h: 6 }), k.glow('#ffffff', 1.4), glints); gm.castShadow = false; g.add(gm);
    g.userData.view = { el: 14 };
    return g;
  },

  // A slim hobby rocket on three balsa fins: a boldly painted body tube, a glossy nose cone, a launch lug, and the
  // orange parachute peeking out under the nose.
  modelrocket(k) {
    const T = k.THREE, g = k.group();
    const R = .3, yB = .62, yT = 4.55, L = yT - yB;
    // the painted body tube
    const tw = 512, th = Math.round(tw * L / (TAU * R));
    const paint = k.tex(tw, th, (c, w, h) => {
      c.fillStyle = '#ff7a12'; c.fillRect(0, 0, w, h);
      // a black spiral stripe winding down the middle
      c.fillStyle = '#16161a';
      const y0 = h * .2, y1 = h * .66, turns = 1.5, band = h * .045;
      for (const dx of [-w, 0, w]) {
        c.beginPath(); c.moveTo(dx, y0); c.lineTo(dx + w * turns, y1); c.lineTo(dx + w * turns, y1 + band); c.lineTo(dx, y0 + band); c.closePath(); c.fill();
      }
      c.fillStyle = '#ff7a12'; c.fillRect(0, 0, w, y0); c.fillRect(0, y1 + band, w, h);
      // a band of checks near the top
      const cy = h * .07, ch = h * .07, n = 8;
      c.fillStyle = '#ffffff'; c.fillRect(0, cy, w, ch);
      c.fillStyle = '#16161a';
      for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) c.fillRect(i * w / n, cy + j * ch / 2, w / n + 1, ch / 2);
      // black lower body where the fins go
      c.fillRect(0, h * .76, w, h * .24);
      c.fillStyle = '#ffffff'; c.fillRect(0, h * .745, w, h * .012);
      // a white star facing out
      c.fillStyle = '#ffffff'; starPath(c, w * .083, h * .7, w * .06); c.fill();
      c.fillStyle = 'rgba(0,0,0,.05)'; for (let y = 0; y < h; y += 5) c.fillRect(0, y, w, 1);   // the tube's spiral wrap, faintly
    });
    k.add(g, k.cyl(R, R, L, { open: true, seg: 48 }), k.plastic('#ffffff', { map: paint, rough: .4, coat: .7, coatRough: .2 }), { p: [0, yB + L / 2, 0] });
    k.add(g, k.ring(R * .78, R, 48), k.matte('#b58a5a', .8), { p: [0, yB, 0], r: [Math.PI / 2, 0, 0] });
    // the motor peeking out of the bottom: a paper casing and a clay nozzle, held by a wire hook
    k.add(g, k.cyl(R * .76, R * .76, .3, { seg: 32 }), k.matte('#c49a64', .75), { p: [0, yB - .05, 0] });
    k.add(g, k.cyl(R * .74, R * .7, .06, { seg: 32 }), k.matte('#8d8a84', .9), { p: [0, yB - .23, 0] });
    k.add(g, k.disc(R * .22, 16), k.matte('#1d1a18', .9), { p: [0, yB - .261, 0], r: [Math.PI / 2, 0, 0] });
    // the glossy nose cone, popped up a little, with the orange parachute bulging out of the gap
    const gap = .17;
    k.add(g, k.lathe([[R, 0], [R - .004, .2], [R * .93, .46], [R * .8, .74], [R * .6, 1.0], [R * .37, 1.24], [R * .14, 1.42], [0, 1.47]], { smooth: true, seg: 48 }), k.gloss('#f6f5f0'), { p: [0, yT + gap, 0] });
    k.add(g, k.torus(R - .004, .012, { rs: 6, ts: 48 }), k.gloss('#16161a'), { p: [0, yT + gap + .01, 0], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.cyl(R - .025, R - .025, gap + .12, { seg: 40 }), k.plastic('#e8e6df', { rough: .5 }), { p: [0, yT + gap / 2 - .02, 0] });
    const nylon = k.tex(128, 64, (c, w, h) => { for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#fff4e8' : '#ff5a14'; c.fillRect(i * w / 6, 0, w / 6 + 1, h); } c.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 6; i++) c.fillRect(0, k.rand() * h, w, 2); });
    const chute = k.mat({ map: nylon, roughness: .55, sheen: .8, sheenColor: k.color('#ffd0b0'), clearcoat: .3 });
    const lobes = [];
    for (const [deg, dy, out, sx, sy, sz] of [[26, 0, .07, .17, .12, .15], [62, -.02, .04, .12, .1, .11], [-8, .01, .03, .12, .09, .1], [92, .01, 0, .09, .08, .08]]) {
      const a = k.deg(deg);
      lobes.push({ p: [Math.sin(a) * (R - .05 + out), yT + gap * .5 + dy, Math.cos(a) * (R - .05 + out)], s: [sx, sy, sz], r: [0, a, k.range(-.25, .25)] });
    }
    g.add(k.instances(k.sphere(1, { w: 18, h: 12 }), chute, lobes));
    k.add(g, k.tube([[Math.sin(.75) * (R + .04), yT + gap * .35, Math.cos(.75) * (R + .04)], [Math.sin(.82) * (R + .06), yT - .14, Math.cos(.82) * (R + .06)], [Math.sin(.78) * (R + .012), yT - .36, Math.cos(.78) * (R + .012)]], .013, { rs: 6, caps: true }), k.matte('#f2eadb', .7));
    // three balsa fins, swept back and reaching down past the motor
    const balsa = k.tex(128, 256, (c, w, h) => {
      c.fillStyle = '#ecd6a8'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { c.strokeStyle = `rgba(160,120,70,${k.range(.08, .25)})`; c.lineWidth = k.range(.6, 2); const x = k.rand() * w; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + k.range(-6, 6), h); c.stroke(); }
    }, { repeat: [2, 1] });
    const finMat = k.mat({ map: balsa, roughness: .8 });
    const fs = new T.Shape();
    fs.moveTo(R - .01, yB + 1.2); fs.lineTo(1.12, yB - .04); fs.lineTo(1.15, 0); fs.lineTo(1.07, 0); fs.lineTo(R - .01, yB + .02); fs.closePath();
    const finGeo = soft(k.extrude(fs, .045, { bevel: .016, bevelSeg: 2 }));
    for (const a of [90, 210, 330].map(k.deg)) k.add(g, finGeo, finMat, { r: [0, a - Math.PI / 2, 0] });
    // the launch lug
    const la = k.deg(62);
    k.add(g, k.cyl(.045, .045, .7, { seg: 16 }), k.matte('#f1ede4', .7), { p: [Math.sin(la) * (R + .045), 2.6, Math.cos(la) * (R + .045)] });
    g.userData.view = { el: 10, zoom: 1.06 };
    g.userData.fullView = { el: 10, zoom: 1 };
    return g;
  },

  // A 1950s pressed-tin rocket: glossy red and cream, chrome trim, three swept fins, and one porthole with the pilot in it.
  retrorocket(k) {
    const T = k.THREE, g = k.group();
    const red = k.gloss('#d51f24'), chrome = k.chrome();
    const prof = [[.34, .78], [.41, .92], [.5, 1.15], [.6, 1.5], [.67, 1.9], [.71, 2.3], [.72, 2.7], [.705, 3.1], [.66, 3.55], [.58, 4.0], [.47, 4.45], [.34, 4.85], [.2, 5.2], [.09, 5.44]];
    const rAt = radiusAt(k, prof), y0 = .78, y1 = 5.44, yLo = 2.42, yHi = 3.93;
    const paint = k.tex(512, 1024, (c, w, h) => {
      const Y = y => (1 - (y - y0) / (y1 - y0)) * h;
      c.fillStyle = '#d51f24'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f6e9c8'; c.fillRect(0, Y(yHi), w, Y(yLo) - Y(yHi));
      c.fillStyle = '#d51f24'; for (const y of [yLo + .12, yHi - .12]) c.fillRect(0, Y(y) - 2, w, 4);
      c.fillStyle = '#f6e9c8';
      for (let i = 0; i < 3; i++) c.fillRect(0, Y(1.45 + i * .16) - 3, w, 6);
      for (let i = 0; i < 9; i++) { starPath(c, (i / 9 + .03) * w, Y(i % 2 ? 4.35 : 4.7), 11); c.fill(); }
    });
    k.add(g, latheY(k, prof, { smooth: true, seg: 72 }), k.gloss('#ffffff', { map: paint }));
    // chrome: the nose spike, trim bands at the colour breaks, and the exhaust bell
    k.add(g, k.lathe([[.1, 5.4], [.08, 5.52], [.055, 5.66], [.03, 5.82], [.012, 5.96], [0, 5.99]], { smooth: true, seg: 32 }), chrome);
    k.add(g, k.sphere(.028, { w: 12, h: 8 }), chrome, { p: [0, 5.99, 0] });
    for (const y of [yLo, yHi]) k.add(g, k.torus(rAt(y) + .005, .035, { rs: 10, ts: 72 }), chrome, { p: [0, y, 0], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.lathe([[.36, .44], [.34, .52], [.29, .62], [.28, .7], [.32, .8], [.345, .84]], { smooth: true, seg: 48 }), k.metal('#f4f6fa', .08, { side: T.DoubleSide }));
    k.add(g, k.disc(.28, 32), k.glow('#ff8a2a', 1.4), { p: [0, .62, 0], r: [Math.PI / 2, 0, 0] });
    // three swept fins with rolled chrome edges and ball feet
    const fin = new T.Shape(), rootLo = 1.0, rootHi = 2.4, tip = [1.5, .07];
    fin.moveTo(rAt(rootLo) - .02, rootLo);
    for (let i = 1; i <= 10; i++) { const y = rootLo + (rootHi - rootLo) * i / 10; fin.lineTo(rAt(y) - .02, y); }
    fin.quadraticCurveTo(1.18, 1.75, tip[0], tip[1]);
    fin.quadraticCurveTo(.98, .5, rAt(rootLo) - .02, rootLo);
    const finGeo = soft(k.extrude(fin, .06, { bevel: .02, bevelSeg: 2 }));
    // lithographed on each fin: a cream stripe and a pinstripe following the leading edge
    const fx0 = .3, fx1 = 1.6, fy0 = -.02, fy1 = 2.5;
    const finTex = k.tex(256, 512, (c, w, h) => {
      const X = x => (x - fx0) / (fx1 - fx0) * w, Yf = y => (1 - (y - fy0) / (fy1 - fy0)) * h;
      c.fillStyle = '#d51f24'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#f6e9c8'; c.lineCap = 'round';
      for (const [d, lw] of [[.14, .08], [.27, .03]]) {
        const ox = -.95 * d, oy = -.32 * d;
        c.lineWidth = lw / (fx1 - fx0) * w;
        c.beginPath(); c.moveTo(X(rAt(rootHi) + ox), Yf(rootHi + oy)); c.quadraticCurveTo(X(1.18 + ox), Yf(1.75 + oy), X(tip[0] + ox), Yf(tip[1] + oy)); c.stroke();
      }
    });
    finTex.repeat.set(1 / (fx1 - fx0), 1 / (fy1 - fy0)); finTex.offset.set(-fx0 / (fx1 - fx0), -fy0 / (fy1 - fy0));
    const finPaint = k.gloss('#ffffff', { map: finTex });
    const edge = [];
    { const A = new T.Vector2(rAt(rootHi), rootHi), C = new T.Vector2(1.18, 1.75), B = new T.Vector2(...tip), D = new T.Vector2(.98, .5), E = new T.Vector2(rAt(rootLo), rootLo);
      const q1 = new T.QuadraticBezierCurve(A, C, B), q2 = new T.QuadraticBezierCurve(B, D, E);
      for (const v of q1.getPoints(20)) edge.push([v.x, v.y, 0]);
      for (const v of q2.getPoints(20).slice(1)) edge.push([v.x, v.y, 0]); }
    const edgeGeo = k.tube(edge, .035, { seg: 80, rs: 8 });
    const fins = [90, 210, 330].map(k.deg);
    for (const a of fins) {
      const f = k.group([], { r: [0, a - Math.PI / 2, 0] }); g.add(f);
      k.add(f, finGeo, [finPaint, red]);
      k.add(f, edgeGeo, chrome);
      k.add(f, k.sphere(.075, { w: 16, h: 12 }), chrome, { p: [tip[0], .075, 0] });
    }
    // the porthole, facing us: a chrome ring, and the pilot's silhouette against the cabin light
    const pa = k.deg(30), py = 3.18, pr = rAt(py), slope = (rAt(py + .05) - rAt(py - .05)) / .1;
    const n = [Math.sin(pa), -slope, Math.cos(pa)];
    const port = onSurface(k, k.group(), [Math.sin(pa) * pr, py, Math.cos(pa) * pr], n); g.add(port);
    k.add(port, k.torus(.27, .05, { rs: 12, ts: 48 }), chrome, { p: [0, 0, .015] });
    k.add(port, k.disc(.25, 40), k.painted(256, 256, (c, w, h) => {
      const gr = c.createRadialGradient(w * .5, h * .42, 10, w * .5, h * .5, w * .6);
      gr.addColorStop(0, '#fff2b8'); gr.addColorStop(.6, '#ffc25a'); gr.addColorStop(1, '#e0761e');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1c1420';
      c.beginPath(); c.moveTo(w * .12, h); c.quadraticCurveTo(w * .16, h * .7, w * .38, h * .66); c.lineTo(w * .62, h * .66); c.quadraticCurveTo(w * .84, h * .7, w * .88, h); c.closePath(); c.fill();   // shoulders
      c.beginPath(); c.arc(w * .5, h * .45, w * .2, 0, TAU); c.fill();                                                                     // helmet
      c.fillRect(w * .495, h * .14, w * .02, h * .14); c.beginPath(); c.arc(w * .505, h * .13, w * .03, 0, TAU); c.fill();                    // antenna
      c.fillStyle = 'rgba(255,230,160,.5)'; c.beginPath(); c.ellipse(w * .47, h * .46, w * .12, h * .07, 0, 0, TAU); c.fill();              // visor glint
    }, { glow: .9, rough: .4 }), { p: [0, 0, .005] });
    k.add(port, k.sphere(.625, { w: 32, h: 8, thetaLen: .4 }), k.glass('#ffffff', { opacity: .18, env: 2.5 }), { r: [Math.PI / 2, 0, 0], p: [0, 0, -.565], shadow: false });
    // rivets along the trim bands and round the porthole
    const rivets = [];
    for (const [y, dy] of [[yLo, .09], [yLo, -.09], [yHi, .09], [yHi, -.09]]) {
      const yy = y + dy, rr = rAt(yy);
      for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; rivets.push({ p: [Math.sin(a) * rr, yy, Math.cos(a) * rr], s: .025 }); }
    }
    port.updateMatrix();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + .2; rivets.push({ p: new T.Vector3(Math.cos(a) * .36, Math.sin(a) * .36, .005).applyMatrix4(port.matrix).toArray(), s: .022 }); }
    g.add(k.instances(k.sphere(1, { w: 10, h: 8 }), chrome, rivets));
    g.userData.view = { el: 12 };
    return g;
  },

  // An Apollo-style command capsule coming home under three striped parachutes, its scorched heat shield underneath.
  capsule(k) {
    const T = k.THREE, g = k.group();
    const cap = k.group();
    // the heat shield: a shallow dish of scorched ablator, charred darkest in the middle
    const Rs = 4.7, Rb = 1.95, th = Math.asin(Rb / Rs), hS = Rs - Math.sqrt(Rs * Rs - Rb * Rb);
    const shieldTex = k.tex(512, 256, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#a8703c'); gr.addColorStop(.5, '#6e4020'); gr.addColorStop(1, '#2e1a10');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { c.fillStyle = k.rand() < .5 ? `rgba(20,10,4,${k.range(.1, .4)})` : `rgba(230,170,110,${k.range(.05, .2)})`; const s = k.range(1, 4); c.fillRect(k.rand() * w, k.rand() * h, s, s); }
      c.strokeStyle = 'rgba(30,16,8,.35)'; c.lineWidth = 1;
      for (let x = 0; x < w; x += 12) for (let y = 0; y < h; y += 10) { c.beginPath(); c.arc(x + (y / 10 % 2) * 6, y, 5, 0, TAU); c.stroke(); }
    });
    const ablator = k.mat({ map: shieldTex, metalness: .35, roughness: .55, clearcoat: .2 });
    k.add(cap, k.sphere(Rs, { w: 72, h: 12, thetaStart: Math.PI - th, thetaLen: th }), ablator, { p: [0, Rs, 0] });
    k.add(cap, k.lathe([[Rb - .01, hS - .02], [Rb + .035, hS + .04], [Rb + .045, hS + .11], [Rb + .02, hS + .19], [Rb - .03, hS + .24]], { smooth: true, seg: 72 }), ablator);
    // the hull: silver-white quilted foil, panel seams, and scorch streaks up from the shoulder
    const yC0 = hS + .23, yC1 = 2.72;
    const hullTex = k.tex(1024, 512, (c, w, h) => {
      c.fillStyle = '#e9ecef'; c.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) for (let y = 0; y < h; y += 24) { c.fillStyle = `rgba(${k.rand() < .5 ? '255,255,255' : '150,160,172'},${k.range(.05, .22)})`; c.fillRect(x + 1, y + 1, 30, 22); }
      c.fillStyle = 'rgba(90,98,110,.45)';
      for (let i = 0; i < 12; i++) c.fillRect(i / 12 * w, 0, 2, h);
      for (const y of [.25, .55, .8]) c.fillRect(0, y * h, w, 2);
      for (let i = 0; i < 70; i++) {   // scorch streaks rising from the bottom edge
        const x = k.rand() * w, len = h * k.range(.05, .22), a = k.range(.06, .25);
        const gr = c.createLinearGradient(0, h, 0, h - len); gr.addColorStop(0, `rgba(96,58,28,${a})`); gr.addColorStop(1, 'rgba(96,58,28,0)');
        c.fillStyle = gr; c.fillRect(x, h - len, k.range(3, 12), len);
      }
      const gr = c.createLinearGradient(0, h, 0, h * .86); gr.addColorStop(0, 'rgba(110,70,36,.5)'); gr.addColorStop(1, 'rgba(110,70,36,0)');
      c.fillStyle = gr; c.fillRect(0, h * .86, w, h * .14);
    });
    const hull = k.mat({ map: hullTex, metalness: .55, roughness: .3, clearcoat: .4, clearcoatRoughness: .2 });
    k.add(cap, latheY(k, [[Rb - .03, yC0], [.62, yC1], [.57, yC1 + .05], [.47, yC1 + .07], [0, yC1 + .07]], { seg: 72 }), hull);
    const alpha = Math.atan2(Rb - .03 - .62, yC1 - yC0), rC = y => Rb - .03 - (y - yC0) * Math.tan(alpha);
    const onCone = (obj, phi, y, lift = 0) => onSurface(k, obj, [Math.sin(phi) * (rC(y) + lift * Math.cos(alpha)), y + lift * Math.sin(alpha), Math.cos(phi) * (rC(y) + lift * Math.cos(alpha))], [Math.sin(phi) * Math.cos(alpha), Math.sin(alpha), Math.cos(phi) * Math.cos(alpha)]);
    // windows: the hatch with its little window in front, two rendezvous windows above, and one each side
    const glassDark = k.mat({ color: '#0d1826', roughness: .04, metalness: .4, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 2.2 });
    const rim = k.metal('#8d949d', .35);
    const hatch = onCone(k.group(), 0, 1.5, .01); cap.add(hatch);
    k.add(hatch, k.slab(.95, .85, .05, .1), k.metal('#e4e8ec', .32));
    k.add(hatch, k.slab(.34, .32, .07, .07), rim, { p: [0, .08, .01] });
    k.add(hatch, k.slab(.26, .24, .08, .05), glassDark, { p: [0, .08, .02] });
    for (const s of [-1, 1]) {
      const rv = onCone(k.group(), s * .38, 2.05, .01); cap.add(rv);
      const tri = k.shape([[-.15, -.1], [.15, -.1], [.08, .12], [-.08, .12]]);
      k.add(rv, k.extrude(tri, .06, { bevel: .02 }), [glassDark, rim]);
      const sw = onCone(k.group(), s * 1.25, 1.45, .01); cap.add(sw);
      k.add(sw, k.slab(.34, .34, .06, .08), rim);
      k.add(sw, k.slab(.26, .26, .07, .06), glassDark, { p: [0, 0, .01] });
    }
    // thruster quads round the top
    const rcs = [];
    for (const phi of [.75, -.75, 2.4, -2.4]) for (const dx of [-.07, .07]) { const q = onCone(k.group(), phi, 2.3, 0); q.translateX(dx); q.updateMatrix(); const e = q.rotation; rcs.push({ p: q.position.toArray(), r: [e.x, e.y, e.z] }); }
    cap.add(k.instances(k.box(.08, .08, .06, .02), k.plastic('#23262c', { rough: .5 }), rcs));
    // the docking tunnel and probe on top
    const steel = k.metal('#b9bfc7', .3);
    k.add(cap, k.cyl(.42, .44, .26, { seg: 48 }), k.metal('#d5d9de', .35), { p: [0, yC1 + .07 + .13, 0] });
    const yP = yC1 + .33;
    k.add(cap, k.cyl(.13, .16, .24, { seg: 24 }), steel, { p: [0, yP + .12, 0] });
    k.add(cap, k.cyl(.035, .035, .46, { seg: 12 }), steel, { p: [0, yP + .47, 0] });
    k.add(cap, k.sphere(.06, { w: 16, h: 12 }), steel, { p: [0, yP + .72, 0] });
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + .3; k.add(cap, k.tube([[Math.sin(a) * .1, yP + .22, Math.cos(a) * .1], [Math.sin(a) * .3, yP + .06, Math.cos(a) * .3], [Math.sin(a) * .34, yP - .02, Math.cos(a) * .34]], .018, { rs: 6 }), steel); }
    // hang it: tipped so the heat shield shows, the hatch turned to us
    cap.rotation.set(0, k.deg(30), 0);
    const tipper = k.group([cap]); g.add(tipper);
    tipper.rotateOnWorldAxis(new T.Vector3(Math.cos(k.deg(30)), 0, -Math.sin(k.deg(30))), k.deg(-14));
    tipper.updateMatrixWorld(true);
    const top = new T.Vector3(0, yP + .75, 0).applyMatrix4(cap.matrixWorld);
    // three striped canopies on their lines, gathered above the capsule
    const nG = 16, cR = 2.35, cH = 1.6;
    const goreTex = k.tex(512, 256, (c, w, h) => {
      for (let i = 0; i < nG; i++) { c.fillStyle = i % 2 ? '#fbf7ee' : '#ff6a1c'; c.fillRect(i * w / nG, 0, w / nG + 1, h); }
      c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(0, h * .78, w, h * .07);
      c.fillStyle = 'rgba(120,40,10,.25)'; for (let i = 0; i < nG; i++) c.fillRect(i * w / nG - 1, 0, 2, h);
    });
    const canopyMat = k.mat({ map: goreTex, roughness: .75, sheen: .5, sheenColor: k.color('#ffffff'), side: T.DoubleSide });
    const canopy = k.lathe([[cR, 0], [cR * .985, cH * .19], [cR * .9, cH * .43], [cR * .76, cH * .66], [cR * .56, cH * .85], [cR * .32, cH * .96], [cR * .08, cH]], { smooth: true, seg: 96 });
    { const p = canopy.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), phi = Math.atan2(x, z), wave = (1 - Math.cos(nG * phi)) / 2, f = 1 - y / cH;
        const s = 1 + .03 * wave * Math.sin(Math.PI * clamp01(f)) - .05 * wave * smooth(.8, 1, f);
        p.setXYZ(i, x * s, y + .16 * wave * smooth(.85, 1, f), z * s);
      }
      canopy.computeVertexNormals(); }
    const Lr = 4.5, beta = k.deg(35), P = top.clone().add(new T.Vector3(0, 1.1, 0));
    const lines = [];
    for (const psi of [210, 330, 90].map(k.deg)) {
      const d = new T.Vector3(Math.sin(psi) * Math.sin(beta), Math.cos(beta), Math.cos(psi) * Math.sin(beta));
      const cg = k.group(); cg.position.copy(P).addScaledVector(d, Lr); orient(k, cg, d.toArray()); g.add(cg);
      k.add(cg, canopy, canopyMat, { shadow: false });
      cg.updateMatrixWorld(true);
      for (let i = 0; i < nG; i += 2) { const a = i / nG * TAU, q = new T.Vector3(Math.sin(a) * cR, 0, Math.cos(a) * cR).applyMatrix4(cg.matrixWorld); lines.push(rodInst(k, q.toArray(), P.toArray(), .014)); }
    }
    lines.push(rodInst(k, P.toArray(), top.toArray(), .04));
    const lm = k.instances(k.cyl(1, 1, 1, { seg: 6 }), k.matte('#f1ece2', .7), lines); lm.castShadow = false; g.add(lm);
    g.userData.floating = true;
    g.userData.view = { el: 6 };
    return g;
  },

  // A Saturn V-style moon rocket standing on its five engines: white with black roll-pattern bands, three stages,
  // fins at the base, the capsule and escape tower on top.
  moonrocket(k) {
    const T = k.THREE, g = k.group(), rk = k.group([], { r: [0, k.deg(30), 0] }); g.add(rk);   // built facing +z, turned to the camera
    const ex = 1.3, R1 = .505 * ex, R3 = .33 * ex, R5 = .196 * ex;                               // a little stouter than the real thing
    const yS1 = .44, yS2 = 4.6, yA = 7.1, yS3 = 7.52, yIU = 8.86, ySLA = 8.95, ySM = 9.8, yCM = 10.36;
    const prof = [[0, yS1], [R1, yS1], [R1, yS1], [R1, yA], [R1, yA], [R3, yS3], [R3, yS3], [R3, ySLA], [R3, ySLA], [R5, ySM], [R5, ySM], [R5, yCM], [R5, yCM], [0, yCM]];
    const W = 1024, Hh = 2048, Y = y => (1 - (y - yS1) / (yCM - yS1)) * Hh;
    const livery = k.tex(W, Hh, (c, w, h) => {
      const white = '#f4f4f0', black = '#18191d';
      c.fillStyle = white; c.fillRect(0, 0, w, h);
      // roll-pattern panels: n round, alternately black, with a seam facing the front
      const panels = (ya, yb, n, off) => { c.fillStyle = black; for (let i = 0; i < n; i++) if ((i + off) % 2 === 0) c.fillRect(i * w / n, Y(yb), w / n + 1, Y(ya) - Y(yb)); };
      panels(yS1, yS1 + 1.0, 8, 1);                                    // first stage: tall roll-pattern panels at the base
      panels(2.5, 2.86, 8, 0);                                         // and a checked band round the middle
      c.fillStyle = black; c.fillRect(0, Y(yS2), w, Y(yS2 - .24) - Y(yS2));   // its black forward skirt
      c.fillRect(0, Y(yA - .02), w, Y(yA - .14) - Y(yA - .02));        // a black ring at the top of the second stage
      panels(yS3, yS3 + .44, 8, 1);                                    // third stage: the checked aft skirt
      c.fillStyle = '#7d838c'; c.fillRect(0, Y(ySLA), w, Y(yIU) - Y(ySLA));   // the instrument ring
      c.fillStyle = '#e4e7ea'; c.fillRect(0, Y(ySM), w, Y(ySLA) - Y(ySM));    // the adapter, and the silver service module
      c.fillStyle = '#c9ced4'; c.fillRect(0, Y(yCM), w, Y(ySM) - Y(yCM));
      c.fillStyle = 'rgba(0,0,0,.16)';                                 // seams and stringers
      for (const y of [1.6, 2.5, 2.86, 3.7, 5.2, 5.9, 6.5, 8.2]) c.fillRect(0, Y(y) - 1, w, 2);
      for (let i = 0; i < 16; i++) c.fillRect(i / 16 * w, Y(ySM), 1.5, Y(ySLA) - Y(ySM));
      for (let i = 0; i < 24; i++) c.fillRect(i / 24 * w, Y(yCM), 2, Y(ySM) - Y(yCM));
      c.fillStyle = '#5d636c';                                          // umbilical plates on the side facing the tower
      for (const [y, hh] of [[4.05, .16], [6.62, .12], [8.45, .1]]) c.fillRect(w * .79, Y(y + hh / 2), w * .035, Y(y - hh / 2) - Y(y + hh / 2));
      c.fillStyle = 'rgba(0,0,0,.06)';
      for (let i = 0; i < 96; i++) { c.fillRect(i / 96 * w, Y(yS2), 1, Y(yS2 - .7) - Y(yS2)); c.fillRect(i / 96 * w, Y(yS1 + 1.0), 1, Y(yS1) - Y(yS1 + 1.0)); }
      // a small generic insignia: a crescent moon and three stars in a gold ring
      const iy = Y(5.8), rx = .3 * w / (TAU * R1), ry = .3 * h / (yCM - yS1);
      for (const dx of [0, w]) {
        c.save(); c.translate(dx, iy); c.scale(rx / 100, ry / 100);
        c.fillStyle = '#e2ae45'; c.beginPath(); c.arc(0, 0, 100, 0, TAU); c.fill();
        c.fillStyle = '#16307a'; c.beginPath(); c.arc(0, 0, 86, 0, TAU); c.fill();
        c.fillStyle = '#fff6dc'; c.beginPath(); c.arc(-8, 6, 50, 0, TAU); c.fill();
        c.fillStyle = '#16307a'; c.beginPath(); c.arc(12, -8, 44, 0, TAU); c.fill();
        c.fillStyle = '#ffd24a'; for (const [x, y, r] of [[40, 30, 15], [58, -30, 11], [14, 58, 9]]) { starPath(c, x, y, r); c.fill(); }
        c.restore();
      }
    });
    k.add(rk, latheY(k, prof, { seg: 72, y0: yS1, y1: yCM }), k.plastic('#ffffff', { map: livery, rough: .42, coat: .3 }));
    const white = k.plastic('#f4f4f0', { rough: .42, coat: .3 }), seam = k.plastic('#c7ccd2', { rough: .4 });
    // joint rings where the stages meet, and the cable tunnel running up the side
    for (const [y, r] of [[yS2, R1], [yA, R1], [yS3, R3], [yIU, R3]]) k.add(rk, k.torus(r + .004, .013, { rs: 6, ts: 72 }), seam, { p: [0, y, 0], r: [Math.PI / 2, 0, 0] });
    const ta = k.deg(72);
    k.add(rk, k.box(.06, yA - .3 - (yS1 + 1.1), .04, .015), white, { p: [Math.sin(ta) * (R1 + .01), (yA - .3 + yS1 + 1.1) / 2, Math.cos(ta) * (R1 + .01)], r: [0, ta, 0] });
    // the third stage's two thruster pods
    for (const sg of [-1, 1]) k.add(rk, k.box(.12 * ex, .22, .07 * ex, .025), white, { p: [sg * (R3 + .03 * ex), yS3 + .2, 0], r: [0, Math.PI / 2, 0] });
    // the base: a heat shield, five big engine bells, and a fairing with a fin over each of the outer four
    k.add(rk, k.cyl(R1 - .01, R1 - .03, .06, { seg: 64 }), k.plastic('#3b3f47', { rough: .6 }), { p: [0, yS1 - .03, 0] });
    const bell = k.lathe([[.067, .52], [.071, .46], [.089, .38], [.116, .28], [.143, .17], [.17, .06], [.183, 0]].map(([r, y]) => [r * ex, y]), { smooth: true, seg: 40 });
    const bellMat = k.metal('#4a4d55', .42, { side: T.DoubleSide }), band = k.metal('#8a8f98', .35);
    const spots = [[0, 0], ...[45, 135, 225, 315].map(a => [Math.sin(k.deg(a)) * .36 * ex, Math.cos(k.deg(a)) * .36 * ex])];
    for (const [x, z] of spots) {
      k.add(rk, bell, bellMat, { p: [x, 0, z] });
      k.add(rk, k.torus(.125 * ex, .018 * ex, { rs: 8, ts: 32 }), band, { p: [x, .3, z], r: [Math.PI / 2, 0, 0] });
    }
    const fairing = k.lathe([[.19, 0], [.18, .12], [.145, .45], [.09, .78], [.035, .98], [0, 1.02]].map(([r, y]) => [r * ex, y]), { smooth: true, seg: 32 });
    const fin = soft(k.extrude(k.shape([[0, 0], [0, .62], [.4 * ex, .27], [.4 * ex, .04]]), .04, { bevel: .01, bevelSeg: 2 }));
    for (const a of [45, 135, 225, 315].map(k.deg)) {
      const d = [Math.sin(a), Math.cos(a)];
      k.add(rk, fairing, white, { p: [d[0] * (R1 - .02), yS1 - .06, d[1] * (R1 - .02)] });
      k.add(rk, fin, white, { p: [d[0] * (R1 + .07 * ex), yS1 - .02, d[1] * (R1 + .07 * ex)], r: [0, a - Math.PI / 2, 0] });
    }
    // the command module under its cover, and the escape tower: a red lattice, the motor and its nose
    k.add(rk, k.lathe([[R5, 0], [R5 - .01, .02], [.06 * ex, .3], [.05 * ex, .33], [0, .34]], { seg: 48 }), white, { p: [0, yCM, 0] });
    const red = k.plastic('#d8452c', { rough: .45 });
    const tb = yCM + .3, tt = yCM + .72, legs = [], s0 = .055 * ex, s1 = .04 * ex;
    const SQ = [[-1, -1], [1, -1], [1, 1], [-1, 1]], corner = (s, y, i) => [SQ[i][0] * s, y, SQ[i][1] * s];
    for (let i = 0; i < 4; i++) {
      const a0 = corner(s0, tb, i), a1 = corner(s1, tt, i), b0 = corner(s0, tb, (i + 1) % 4), b1 = corner(s1, tt, (i + 1) % 4);
      legs.push(rodInst(k, a0, a1, .011), rodInst(k, a0, b1, .007), rodInst(k, b0, a1, .007));
    }
    rk.add(k.instances(k.cyl(1, 1, 1, { seg: 6 }), red, legs));
    const rm = .05 * ex;
    k.add(rk, k.cyl(rm, rm * 1.08, .44, { seg: 24 }), white, { p: [0, tt + .22, 0] });
    k.add(rk, k.cyl(rm * 1.04, rm * 1.04, .05, { seg: 24 }), k.plastic('#18191d', { rough: .5 }), { p: [0, tt + .08, 0] });
    k.add(rk, k.lathe([[rm, 0], [rm * .9, .08], [rm * .55, .16], [rm * .22, .21], [0, .22]], { smooth: true, seg: 24 }), white, { p: [0, tt + .44, 0] });
    const nz = [];
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4; nz.push({ p: [Math.sin(a) * rm, tt + .02, Math.cos(a) * rm], r: [Math.cos(a) * .5, 0, -Math.sin(a) * .5] }); }
    rk.add(k.instances(k.cone(.02 * ex, .06, 12), k.metal('#3d4047', .4), nz));
    g.userData.view = { el: 1, fov: 36, zoom: 1.08 };
    g.userData.fullView = { el: 1, fov: 40, zoom: 1.18 };
    return g;
  },
};
