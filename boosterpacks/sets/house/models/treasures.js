// Models for the treasures of the house: its Mythic Rares and Legends. Each entry: id => (k) => THREE.Object3D, built
// with the kit in ../../../kit.js.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

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
// Move every vertex of a geometry with fn(v) (a Vector3 you can change in place), then fix the normals.
function warp(k, geo, fn, welded = false) {
  const pos = geo.attributes.position, v = new k.THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); fn(v); pos.setXYZ(i, v.x, v.y, v.z); }
  pos.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
  return welded ? weld(geo) : geo;
}
// A skin through closed rings of points (each ring [[x, y, z], ...], all the same length, going round from +z towards +x
// seen from above). Faces point out of the solid while the rings climb and into the hollow when they come back down.
function loft(k, rings) {
  const T = k.THREE, n = rings[0].length, m = rings.length, pos = [], uv = [], idx = [];
  for (let j = 0; j < m; j++) for (let i = 0; i <= n; i++) { const p = rings[j][i % n]; pos.push(p[0], p[1], p[2]); uv.push(i / n, j / (m - 1)); }
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return weld(geo);
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
const curveOf = (k, pts, closed = false, tension = .5) => new k.THREE.CatmullRomCurve3(pts.map(q => new k.THREE.Vector3(...q)), closed, 'catmullrom', tension);
// Points evenly spaced along a smooth path through pts.
const along = (k, pts, n, closed = false) => curveOf(k, pts, closed).getSpacedPoints(closed ? n : n - 1).slice(0, n).map(v => [v.x, v.y, v.z]);

// A smooth function through [[x, y], ...] keys (x ascending): cubic Hermite with Catmull-Rom slopes, flat outside.
function interp(keys) {
  const n = keys.length, m = keys.map((_, i) => {
    const a = keys[Math.max(0, i - 1)], b = keys[Math.min(n - 1, i + 1)];
    return (b[1] - a[1]) / (b[0] - a[0]);
  });
  return x => {
    if (x <= keys[0][0]) return keys[0][1];
    if (x >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0; while (keys[i + 1][0] < x) i++;
    const [x0, y0] = keys[i], [x1, y1] = keys[i + 1], h = x1 - x0, t = (x - x0) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m[i + 1];
  };
}
// A point on a rounded rectangle section (half-width hw, from y0 up to y1, top corners rt, bottom corners rb), by arc
// length: t = 0 is the top middle, going round to the right (+x), down, under and back up the left.
function rrSec(hw, y0, y1, rt, rb, t) {
  const side = Math.max(0, y1 - rt - (y0 + rb)), segs = [
    [hw - rt, u => [u, y1]],
    [Math.PI / 2 * rt, u => { const a = u / rt; return [hw - rt + Math.sin(a) * rt, y1 - rt + Math.cos(a) * rt]; }],
    [side, u => [hw, y1 - rt - u]],
    [Math.PI / 2 * rb, u => { const a = u / rb; return [hw - rb + Math.cos(a) * rb, y0 + rb - Math.sin(a) * rb]; }],
    [2 * (hw - rb), u => [hw - rb - u, y0]],
    [Math.PI / 2 * rb, u => { const a = u / rb; return [-(hw - rb) - Math.sin(a) * rb, y0 + rb - Math.cos(a) * rb]; }],
    [side, u => [-hw, y0 + rb + u]],
    [Math.PI / 2 * rt, u => { const a = u / rt; return [-(hw - rt) - Math.cos(a) * rt, y1 - rt + Math.sin(a) * rt]; }],
    [hw - rt, u => [-(hw - rt) + u, y1]],
  ];
  let s = (((t % 1) + 1) % 1) * segs.reduce((a, [l]) => a + l, 0);
  for (const [l, fn] of segs) { if (s <= l) return fn(s); s -= l; }
  return [0, y1];
}
// A surface patch over a grid of parameters: fn(a, b) → [x, y, z] for each a in as and b in bs (both lists ascending).
// keep(i, j) can drop the quad between as[i..i+1] and bs[j..j+1]. uv runs 0–1 over the lists.
function gridGeo(k, fn, as, bs, keep = () => true, flip = false) {
  const T = k.THREE, pos = [], uv = [], idx = [], na = as.length, nb = bs.length;
  for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) { const p = fn(as[i], bs[j]); pos.push(p[0], p[1], p[2]); uv.push(i / (na - 1), j / (nb - 1)); }
  for (let i = 0; i < na - 1; i++) for (let j = 0; j < nb - 1; j++) {
    if (!keep(i, j)) continue;
    const a = i * nb + j, b = a + 1, c = a + nb, d = c + 1;
    if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return weld(geo);
}
// A small seeded random source for texture painting (so canvases don't draw from the model's k.rand stream).
const mulberryish = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
// Merge sorted number lists (dropping near-duplicates).
const mergeSorted = (...lists) => [...new Set(lists.flat().map(v => +v.toFixed(5)))].sort((a, b) => a - b);

/* ---------- precious materials ---------- */
// Polished 18-karat gold: warm and mirror-bright, with a little glow of its own so it never goes brown in the shadows.
const gold = (k, rough = .13, o = {}) => k.metal('#ffc84a', rough, { emissive: k.color('#4a2c00'), emissiveIntensity: .32, envMapIntensity: 1.3, ...o });
// A cut stone: flat-shaded facets, deep colour, bright reflections and a little fire of its own.
const GEM = { ruby: '#c4001f', sapphire: '#1238e0', emerald: '#01a04e', amethyst: '#8a24d6', topaz: '#ff9e0a', diamond: '#f2f8ff' };
function gemMat(k, c, glow = .3) {
  const col = k.color(GEM[c] ?? c), clear = c === 'diamond';
  return k.mat({ color: col, roughness: .04, metalness: clear ? .1 : .5, clearcoat: clear ? 1 : .5, clearcoatRoughness: 0, flatShading: true, ior: 2.1, specularIntensity: 1,
    envMapIntensity: clear ? 2.6 : 1.4, emissive: col, emissiveIntensity: clear ? glow : glow * 1.5, iridescence: clear ? .8 : .2, iridescenceIOR: 1.8 });
}
// Pearls: creamy white with a rainbow lustre.
const pearlMat = k => k.mat({ color: k.color('#fdf6ec'), roughness: .2, clearcoat: 1, clearcoatRoughness: .08, iridescence: .7, iridescenceIOR: 1.45,
  iridescenceThicknessRange: [260, 620], sheen: .6, sheenColor: k.color('#ffe2ee'), emissive: k.color('#ffffff'), emissiveIntensity: .06 });
// Velvet: deep colour with a bright sheen where it turns away from you.
const velvet = (k, c, sheen, o = {}) => k.mat({ color: k.color(c), roughness: .88, sheen: 1, sheenRoughness: o.sheenRough ?? .38, sheenColor: k.color(sheen),
  map: o.map === undefined ? k.weaveTex(o.scale ?? 1) : o.map, side: o.side ?? k.THREE.FrontSide });
// A round brilliant with its girdle on y = 0: a flat table, sloping crown and pointed pavilion, `seg` facets round.
const brilliant = (k, seg = 10) => k.lathe([[0, -.62], [1, 0], [1, .05], [.6, .32], [0, .32]], { seg });
// A cabochon: a polished dome of a stone, sitting on y = 0.
const cabochon = k => k.sphere(1, { w: 12, h: 4, thetaLen: Math.PI / 2 });

// A soft additive glow (a camera-facing sprite; the studio doesn't frame by it).
function halo(k, r, color, opacity = .5) {
  const T = k.THREE, tex = k.tex(128, 128, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.22, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, { cache: 'treasureHalo' });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k.color(color), transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }));
  s.scale.set(r * 2, r * 2, 1);
  return s;
}
// A four-pointed glint of light, drawn over everything.
function sparkle(k, size, rot = 0, color = '#fff4d2') {
  const T = k.THREE, tex = k.tex(128, 128, (c, w, h) => {
    c.translate(w / 2, h / 2);
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, w * .2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(-w / 2, -h / 2, w, h);
    for (const a of [0, Math.PI / 2]) {
      c.save(); c.rotate(a);
      const lg = c.createLinearGradient(-w / 2, 0, w / 2, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.5, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = lg; c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(0, -w * .035); c.lineTo(w / 2, 0); c.lineTo(0, w * .035); c.closePath(); c.fill();
      c.restore();
    }
  }, { cache: 'treasureSparkle' });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k.color(color), transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending, rotation: rot }));
  s.scale.set(size, size, 1);
  return s;
}
// Glints at a list of [x, y, z, size, turn] spots.
function glints(k, parent, spots) { for (const [x, y, z, s, rot = 0] of spots) parent.add(k.place(sparkle(k, s, rot), { p: [x, y, z] })); }

export default {
  // The solid gold toilet: 18 karats of bowl, seat, lid and cistern, engraved all over, a jewelled crest inside the lid,
  // a ruby on the flush lever, plumbed in with gold, on a red velvet pedestal mat with gold fringe.
  goldtoilet(k) {
    const T = k.THREE, g = k.group(), N = 120;
    const au = gold(k, .12), auSatin = gold(k, .3);
    // plan: an elongated oval in front, squarer at the back
    const hw = .72, bf = 1.26, bb = .88;
    const eg = (t, d) => {
      const s = Math.sin(t), c = Math.cos(t);
      if (c >= 0) return [(hw + d) * s, (bf + d) * c];
      return [(hw + d) * Math.sign(s) * Math.abs(s) ** (2 / 3.2), -(bb + d) * Math.abs(c) ** (2 / 3.2)];
    };
    const ring = (d, y, dz = 0) => { const r = []; for (let i = 0; i < N; i++) { const [x, z] = eg(i / N * TAU, d); r.push([x, y, z + dz]); } return r; };
    const outline = d => { const s = new T.Shape(); for (let i = 0; i < N; i++) { const [x, z] = eg(i / N * TAU, d); i ? s.lineTo(x, z) : s.moveTo(x, z); } s.closePath(); return s; };
    // the pedestal flaring up into the bowl, over the rolled rim and down inside to the water: [inset, y, shift back]
    const prof = [[-.22, 0, -.24], [-.23, .05, -.24], [-.3, .12, -.23], [-.37, .24, -.21], [-.4, .4, -.17], [-.37, .55, -.12], [-.3, .68, -.07],
      [-.19, .82, -.03], [-.08, .96, 0], [-.02, 1.07, 0], [0, 1.15, 0], [-.01, 1.2, 0], [-.04, 1.235, 0], [-.09, 1.245, 0], [-.13, 1.225, 0],
      [-.16, 1.17, 0], [-.22, 1.08, 0], [-.3, .99, 0], [-.38, .92, 0], [-.45, .87, 0]];
    k.add(g, loft(k, prof.map(([d, y, dz]) => ring(d, y, dz))), au);
    k.add(g, cap(k, ring(-.22, 0, -.24), false), au);
    k.add(g, cap(k, ring(-.45, .87)), k.mat({ color: '#7fd8f0', roughness: .04, clearcoat: 1, clearcoatRoughness: 0, emissive: k.color('#2a9ec4'), emissiveIntensity: .35 }));
    // bolt caps on the foot, each set with a sapphire
    for (const s of [-1, 1]) {
      const [x, z] = eg(s * Math.PI / 2, -.25);
      k.add(g, k.sphere(.075, { w: 20, h: 12, thetaLen: Math.PI / 2 }), au, { p: [x + s * .02, .03, z - .3], s: [1, .9, 1] });
      k.add(g, brilliant(k, 8), gemMat(k, 'sapphire'), { p: [x + s * .02, .1, z - .3], s: .035 });
    }
    // the seat and its hinge
    const seatY = 1.29;
    k.add(g, k.extrude(outline(-.01), .05, { bevel: .03, bevelSeg: 4, holes: [outline(-.25)], curve: 48 }), au, { p: [0, seatY, 0], r: [Math.PI / 2, 0, 0] });
    for (const s of [-1, 1]) k.add(g, k.box(.16, .1, .2, .04), au, { p: [s * .36, seatY + .02, -.78] });
    k.add(g, k.cyl(.04, .04, .9, { seg: 20 }), au, { p: [0, seatY + .07, -.8], r: [0, 0, Math.PI / 2] });
    // the lid, up against the tank; its underside engraved round the edge, set with diamonds and a ruby crest
    const lid = k.group([], { p: [0, seatY + .08, -.8], r: [-k.deg(95), 0, 0] });
    const lz = bb + .02;
    k.add(lid, k.extrude(outline(-.02), .05, { bevel: .03, bevelSeg: 4, curve: 48 }), au, { p: [0, .04, lz], r: [Math.PI / 2, 0, 0] });
    const lidTex = k.tex(512, 768, (c, w, h) => {
      const X = x => (x / (2 * hw) + .5) * w, Y = z => (1 - (z + bb) / (bf + bb)) * h;
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#70470c'; c.lineCap = 'round'; c.lineJoin = 'round';
      const oval = d => { c.beginPath(); for (let i = 0; i <= 96; i++) { const [x, z] = eg(i / 96 * TAU, d); i ? c.lineTo(X(x), Y(z)) : c.moveTo(X(x), Y(z)); } c.closePath(); };
      c.lineWidth = 7; oval(-.1); c.stroke(); c.lineWidth = 3; oval(-.17); c.stroke(); oval(-.215); c.stroke();
      // beading between the rules
      c.fillStyle = '#8a5a12';
      for (let i = 0; i < 90; i++) { const [x, z] = eg(i / 90 * TAU, -.193); c.beginPath(); c.arc(X(x), Y(z), 3.4, 0, TAU); c.fill(); }
      // acanthus scrolls above and below the crest
      c.lineWidth = 5;
      for (const [cy, fl] of [[Y(.95), 1], [Y(-.55), -1]]) for (const sx of [-1, 1]) {
        c.save(); c.translate(w / 2, cy); c.scale(sx, fl);
        c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(40, -40, 110, -30, 120, 10); c.bezierCurveTo(126, 40, 90, 50, 80, 26); c.bezierCurveTo(74, 10, 94, 4, 98, 18); c.stroke();
        c.beginPath(); c.moveTo(20, 8); c.bezierCurveTo(50, 40, 120, 60, 160, 40); c.stroke();
        for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(40 + i * 22, -14 - i * 2, 9, 4, -.5, 0, TAU); c.stroke(); }
        c.restore();
      }
    }, { cache: 'goldToiletLid' });
    lidTex.repeat.set(1 / (2 * hw), 1 / (bf + bb)); lidTex.offset.set(.5, bb / (bf + bb));
    const engrave = (map, rough = .16) => { const m = k.metal('#ffcb52', rough, { map, bumpMap: map, bumpScale: 1.4, emissive: k.color('#4a2c00'), emissiveIntensity: .3, envMapIntensity: 1.3 }); m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; return m; };
    k.add(lid, new T.ShapeGeometry(outline(-.04), 48), engrave(lidTex), { p: [0, -.017, lz], r: [Math.PI / 2, 0, 0], shadow: false });
    const dia = gemMat(k, 'diamond', .15), studs = [];
    for (let i = 0; i < 44; i++) { const [x, z] = eg((i + .5) / 44 * TAU, -.135); studs.push({ p: [x, -.02, z + lz], r: [Math.PI, i, 0], s: .028 }); }
    lid.add(k.instances(brilliant(k, 8), dia, studs));
    const crest = k.group([], { p: [0, -.02, lz + .3], r: [Math.PI / 2, 0, 0] }); lid.add(crest);
    const oval = (rx, ry) => { const s = new T.Shape(); s.absellipse(0, 0, rx, ry, 0, TAU, false, 0); return s; };
    k.add(crest, k.extrude(oval(.25, .32), .04, { bevel: .03, bevelSeg: 3, curve: 40 }), au, { p: [0, 0, .02] });
    k.add(crest, cabochon(k), gemMat(k, 'ruby', .5), { p: [0, 0, .06], r: [Math.PI / 2, 0, 0], s: [.17, .11, .23] });
    const halo16 = []; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; halo16.push({ p: [Math.sin(a) * .215, Math.cos(a) * .28, .07], r: [Math.PI / 2, 0, 0], s: .026 }); }
    crest.add(k.instances(brilliant(k, 8), dia, halo16));
    const cr = crown(k, .2, { gold: au }); cr.position.set(0, .3, .05); cr.scale.set(1, 1, .45); crest.add(cr);
    g.add(lid);
    // the tank (cistern) and its lid, engraved panels, and the jewelled flush lever on its side
    const tw = 1.5, th = 1.0, td = .54, tz = -1.28, ty0 = 1.27;
    k.add(g, k.box(1.1, .4, .74, .12, 4), au, { p: [0, 1.06, -1.18] });                    // the deck under the tank
    k.add(g, k.box(tw, th, td, .1, 4), au, { p: [0, ty0 + th / 2, tz] });
    k.add(g, k.box(tw + .1, .12, td + .1, .05, 4), au, { p: [0, ty0 + th + .06, tz] });
    k.add(g, k.box(tw + .02, .03, td + .02, .012), auSatin, { p: [0, ty0 + th - .02, tz] });
    const scroll = k.tex(512, 320, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#6a4a10'; c.lineWidth = 6; c.lineCap = 'round';
      c.beginPath(); c.roundRect(14, 14, w - 28, h - 28, 30); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.roundRect(28, 28, w - 56, h - 56, 22); c.stroke();
      c.lineWidth = 5;
      for (const sx of [-1, 1]) {
        c.save(); c.translate(w / 2, h / 2); c.scale(sx, 1);
        for (const [x, y, r, a0, a1] of [[80, 0, 44, -2.6, 2.6], [150, -30, 30, -1.2, 3.4], [150, 30, 30, -3.4, 1.2], [200, 0, 22, -2.4, 2.4]]) { c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke(); }
        c.beginPath(); c.moveTo(36, -70); c.bezierCurveTo(90, -110, 170, -100, 216, -70); c.stroke();
        c.beginPath(); c.moveTo(36, 70); c.bezierCurveTo(90, 110, 170, 100, 216, 70); c.stroke();
        c.restore();
      }
      c.beginPath(); c.ellipse(w / 2, h / 2, 42, 58, 0, 0, TAU); c.stroke();
      c.beginPath(); c.ellipse(w / 2, h / 2, 30, 44, 0, 0, TAU); c.stroke();
    }, { cache: 'goldToiletScroll' });
    k.add(g, k.plane(tw - .34, th - .36), engrave(scroll, .18), { p: [0, ty0 + th / 2 + .02, tz + td / 2 + .003], shadow: false });
    k.add(g, k.plane(td - .16, th - .36), engrave(scroll, .18), { p: [tw / 2 + .003, ty0 + th / 2 + .02, tz], r: [0, Math.PI / 2, 0], shadow: false });
    // flush lever on the right side: a rosette ringed with diamonds, a swept arm and a big ruby
    const lv = k.group([], { p: [tw / 2 + .01, ty0 + th - .22, tz + td / 2 - .16], r: [0, Math.PI / 2, 0], s: 1.35 }); g.add(lv);
    k.add(lv, k.cyl(.1, .11, .05, { seg: 32 }), au, { r: [Math.PI / 2, 0, 0] });
    k.add(lv, k.sphere(.05, { w: 20, h: 12 }), au, { p: [0, 0, .04] });
    const ros = []; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; ros.push({ p: [Math.cos(a) * .077, Math.sin(a) * .077, .035], r: [Math.PI / 2, 0, 0], s: .017 }); }
    lv.add(k.instances(brilliant(k, 8), dia, ros));
    k.add(lv, k.tube([[0, 0, .04], [-.1, .0, .1], [-.26, -.04, .12]], .024, { caps: true, seg: 16, rs: 10 }), au);
    k.add(lv, brilliant(k, 10), gemMat(k, 'ruby', .5), { p: [-.32, -.05, .12], r: [0, 0, Math.PI / 2 - .1], s: .075 });
    // plumbed in: a gold supply line from under the tank to a shut-off valve with a crystal handle
    const sup = [[.52, ty0 + .02, tz + .05], [.56, ty0 - .2, tz + .06], [.6, .52, tz + .1], [.62, .36, tz + .12]];
    k.add(g, k.tube(sup, .028, { seg: 24, rs: 8 }), au);
    k.add(g, k.cyl(.05, .05, .1, { seg: 16 }), au, { p: [.62, .32, tz + .12] });
    k.add(g, k.cyl(.035, .035, .26, { seg: 12 }), au, { p: [.62, .32, tz - .02], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.cyl(.07, .07, .03, { seg: 20 }), au, { p: [.62, .32, tz - .16], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.sphere(.045, { w: 10, h: 6 }), gemMat(k, 'diamond', .2), { p: [.69, .32, tz + .12] });
    k.add(g, k.box(.1, .03, .03, .01), au, { p: [.66, .32, tz + .12] });
    // the red velvet pedestal mat with gold fringe
    const mat = new T.Shape(), mw = 1.12, mf = 1.85, mb = -.62, nw = .54, nz = .3;
    mat.moveTo(-nw, mb); mat.lineTo(-mw + .3, mb); mat.quadraticCurveTo(-mw, mb, -mw, mb + .3); mat.lineTo(-mw, mf - .45);
    mat.quadraticCurveTo(-mw, mf, -mw + .45, mf); mat.lineTo(mw - .45, mf); mat.quadraticCurveTo(mw, mf, mw, mf - .45); mat.lineTo(mw, mb + .3);
    mat.quadraticCurveTo(mw, mb, mw - .3, mb); mat.lineTo(nw, mb); mat.lineTo(nw, nz); mat.absarc(0, nz, nw, 0, Math.PI, false); mat.closePath();
    const rugTex = k.tex(512, 512, (c, w, h) => {
      c.fillStyle = '#8e0a22'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#f4c24e'; c.lineWidth = 9; c.beginPath(); c.roundRect(22, 22, w - 44, h - 44, 60); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.roundRect(40, 40, w - 80, h - 80, 46); c.stroke();
      c.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 2200; i++) c.fillRect((i * 97.3) % w, (i * 57.7) % h, 2, 2);
    }, { cache: 'goldToiletRug' });
    rugTex.repeat.set(1 / (2 * mw), 1 / (mf - mb)); rugTex.offset.set(.5, -mb / (mf - mb));
    const rug = k.extrude(mat, .05, { bevel: .03, bevelSeg: 3, curve: 24 });
    k.add(g, rug, [velvet(k, '#ffffff', '#ff5c74', { map: rugTex }), velvet(k, '#8a0a20', '#ff5c74')], { p: [0, .055, 0], r: [Math.PI / 2, 0, 0] });
    const fr = [];
    const edge = [[-nw - .02, mb - .03], [-mw - .03, mb - .03], [-mw - .03, mf + .03], [mw + .03, mf + .03], [mw + .03, mb - .03], [nw + .02, mb - .03]];
    for (let e = 0; e < edge.length - 1; e++) {
      const [x0, z0] = edge[e], [x1, z1] = edge[e + 1], L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / .045);
      for (let i = 0; i < n; i++) { const t = (i + .5) / n; fr.push({ p: [lerp(x0, x1, t), .045, lerp(z0, z1, t)] }); }
    }
    g.add(k.instances(k.box(.025, .08, .025), gold(k, .35), fr));
    // glints
    glints(k, g, [[.55, 1.2, .55, .5, .3], [-.5, 2.2, -.92, .4, 0], [.6, 2.9, -.8, .45, .5], [.02, .45, .7, .35, .2]]);
    g.userData.view = { az: 32, el: 22 };
    return g;
  },

  // A candy-red supercar with its scissor door swung up: gold rims on low-profile tyres, glowing headlights and a light
  // bar behind, quilted cream leather inside, a gold pinstripe, a carbon wing and four gold exhaust tips.
  supercar(k) {
    const T = k.THREE, g = k.group();
    const paint = k.mat({ color: k.color('#a8000f'), metalness: .45, roughness: .3, clearcoat: 1, clearcoatRoughness: .03, envMapIntensity: 1.25 });
    const glass = k.mat({ color: k.color('#0a0c12'), roughness: .03, metalness: .3, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.7, side: T.DoubleSide });
    const carbonTex = k.tex(64, 64, (c, w, h) => {
      c.fillStyle = '#16171a'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { const on = ((x + y) / 8) % 2; c.fillStyle = on ? '#2c2e33' : '#1d1e22'; c.fillRect(x + (on ? 0 : 1), y + (on ? 1 : 0), on ? 8 : 7, on ? 6 : 8); }
    }, { repeat: 8, cache: 'supercarCarbon' });
    const carbon = k.mat({ map: carbonTex, roughness: .28, metalness: .35, clearcoat: 1, clearcoatRoughness: .05 });
    const rubber = k.rubber('#1a1a1d'), au = gold(k, .12);
    const decalMat = (mat) => { mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2; mat.side = T.DoubleSide; return mat; };
    // ---- the body: rounded sections along the car (front at +z), a wedge nose, haunches over the rear wheels ----
    const ZN = 2.25, ZT = -2.25, AF = 1.36, AR = -1.32, RF = .34, RR = .355, ARCH = .41;
    const yTop = interp([[-2.25, .8], [-2.1, .9], [-1.85, .94], [-1.35, .96], [-.75, .87], [-.15, .79], [.6, .77], [1.05, .8], [1.36, .84], [1.7, .75], [2.0, .6], [2.15, .51], [2.25, .43]]);
    const yBot = interp([[-2.25, .38], [-2.05, .24], [-1.8, .14], [1.9, .13], [2.25, .18]]);
    const halfW = interp([[-2.25, .9], [-2.0, .97], [-1.35, 1.0], [-.6, .95], [.1, .92], [.9, .94], [1.4, .96], [1.9, .9], [2.25, .8]]);
    const dip = interp([[-2.25, 0], [-1.6, .02], [.7, .05], [1.3, .09], [1.9, .07], [2.25, .03]]);
    const archY = z => { let y = 0; for (const [za, r] of [[AF, RF], [AR, RR]]) { const d = z - za; if (Math.abs(d) < ARCH) y = Math.max(y, r + Math.sqrt(ARCH * ARCH - d * d)); } return y; };
    const pinch = z => { let e = 1; const dn = ZN - z, dt = z - ZT; if (dn < .2) e *= Math.max(0, 1 - (1 - dn / .2) ** 3) ** (1 / 3); if (dt < .2) e *= Math.max(0, 1 - (1 - dt / .2) ** 3) ** (1 / 3); return e; };
    const body = (z, t) => {
      const hw = halfW(z), y1 = yTop(z), y0 = yBot(z), H = y1 - y0, ym = y0 + H * .42, e = pinch(z);
      let [x, y] = rrSec(hw, y0, y1, Math.min(.25, H * .45), .07, t);
      if (y > ym) x *= 1 - .11 * ((y - ym) / (y1 - ym)) ** 1.6; else x *= 1 - .05 * ((ym - y) / (ym - y0)) ** 2;
      const ax = Math.abs(x) / hw;
      y -= dip(z) * (1 - smooth(.3, .78, ax)) * smooth(y1 - .3, y1, y);
      const sc = smooth(-.4, -.62, z) * smooth(-1.04, -.86, z) * smooth(.3, .44, y) * smooth(.74, .6, y) * smooth(.8, .93, ax);
      x -= Math.sign(x) * .14 * sc;
      const a = archY(z); if (a > 0 && y < a) y = a;
      return [x * e, ym + (y - ym) * e, z];
    };
    const V = (p) => new T.Vector3(...p);
    // a point on the body pushed out along its normal
    const onBody = (z, t, lift = 0) => {
      const e = 1e-3, p = V(body(z, t));
      if (!lift) return p.toArray();
      const dz = V(body(z + e, t)).sub(V(body(z - e, t))), dt = V(body(z, t + e)).sub(V(body(z, t - e)));
      return p.addScaledVector(dz.cross(dt).normalize(), lift).toArray();
    };
    const tAtY = (z, y) => { let a = .12, b = .33; for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (body(z, m)[1] > y) a = m; else b = m; } return (a + b) / 2; };
    // stations close together at the nose and tail; the door's edges fall on stations and section lines, and the body is
    // left open where the door and the cabin above it were
    const zD0 = .6, zD1 = -.42, tTop = .17, tSill = .285;
    const zs = mergeSorted(range(0, 1, 150).map(u => ZT + (ZN - ZT) * (u - .9 * Math.sin(TAU * u) / TAU)), [zD0, zD1]);
    const ts = mergeSorted(range(0, 1, 120), [tTop, tSill, 1 - tTop]);
    const iD0 = zs.indexOf(zD1), iD1 = zs.indexOf(zD0), jT = ts.indexOf(tTop), jS = ts.indexOf(tSill), jT2 = ts.indexOf(1 - tTop);
    k.add(g, gridGeo(k, body, zs, ts, (i, j) => !(i >= iD0 && i < iD1 && (j < jS || j >= jT2)), true), paint);
    // ---- the canopy: dark glass from the windscreen over the roof and down over the engine ----
    const roofH = interp([[-1.55, 0], [-1.2, .12], [-.8, .26], [-.35, .35], [.15, .36], [.5, .24], [.8, .09], [.98, 0]]);
    const canopy = (z, s) => {
      const [xb, yb] = body(z, tTop), h = roofH(z), xr = xb * .8, f = Math.PI * s, u = Math.cos(f), v = Math.sin(f);
      const ys = Math.abs(v) ** (2 / 2.6), xs = Math.sign(u) * Math.abs(u) ** (2 / 2.6);
      return [xs * lerp(xb, xr, ys), yb - .04 + (h + .04) * ys, z];
    };
    const sRail = .25, czs = mergeSorted(range(-1.52, .98, 100), [zD0, zD1]), ss = mergeSorted(range(0, 1, 56), [sRail]);
    const cD0 = czs.indexOf(zD1), cD1 = czs.indexOf(zD0), cR = ss.indexOf(sRail);
    k.add(g, gridGeo(k, canopy, czs, ss, (i, j) => !(i >= cD0 && i < cD1 && j < cR)), glass);
    const onCanopy = (z, s, lift) => { const e = 1e-3, p = V(canopy(z, s)), dz = V(canopy(z + e, s)).sub(V(canopy(z - e, s))), ds = V(canopy(z, s + e)).sub(V(canopy(z, s - e))); return p.addScaledVector(ds.cross(dz).normalize(), lift).toArray(); };
    k.add(g, gridGeo(k, (z, s) => onCanopy(z, s, .004), range(-.5, .2, 24), range(.3, .7, 16)), paint);         // the roof panel
    // ---- the near door: cut from the same surfaces and swung up on its hinge ahead of the opening (the far one stays shut) ----
    const doorIn = k.mat({ color: k.color('#1c1716'), roughness: .6, sheen: .5, sheenColor: k.color('#6a5a50'), side: T.BackSide });
    const hinge = [.86, .7, zD0 - .02], rel = p => [p[0] - hinge[0], p[1] - hinge[1], p[2] - hinge[2]];
    const door = k.group([], { p: hinge, order: 'ZYX', r: [1.22, 0, -.12] }); g.add(door);
    const panel = gridGeo(k, (a, b) => rel(body(a, b)), zs.slice(iD0, iD1 + 1), ts.slice(jT, jS + 1), undefined, true);
    k.add(door, panel, paint); k.add(door, panel, doorIn);
    k.add(door, gridGeo(k, (a, b) => rel(canopy(a, b)), czs.slice(cD0, cD1 + 1), ss.slice(0, cR + 1)), glass);
    // round the door (sill, rear edge, window, roof rail, front edge): a painted edge on it, a rubber seal round the opening
    const ring = [];
    for (const z of range(zD0, zD1, 16)) ring.push(body(z, tSill));
    for (const t of range(tSill, tTop, 6).slice(1)) ring.push(body(zD1, t));
    for (const s2 of range(0, sRail, 5).slice(1)) ring.push(canopy(zD1, s2));
    for (const z of range(zD1, zD0, 16).slice(1)) ring.push(canopy(z, sRail));
    for (const s2 of range(sRail, 0, 5).slice(1)) ring.push(canopy(zD0, s2));
    for (const t of range(tTop, tSill, 6).slice(1, -1)) ring.push(body(zD0, t));
    k.add(door, k.tube(ring.map(rel), .016, { closed: true, seg: 110, rs: 6, tension: .1 }), paint);
    k.add(g, k.tube(ring, .02, { closed: true, seg: 110, rs: 6, tension: .1 }), k.matte('#0c0c0e', .7));
    // ---- inside: carpet, a pair of quilted cream leather seats, the dash and the wheel ----
    const quilt = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#efe0c4'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#c99a3c'; c.lineWidth = 3;
      for (let i = -8; i < 16; i++) { c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32 + h, h); c.stroke(); c.beginPath(); c.moveTo(i * 32, h); c.lineTo(i * 32 + h, 0); c.stroke(); }
      c.fillStyle = 'rgba(120,80,30,.12)'; for (let i = 0; i < 400; i++) c.fillRect((i * 71.3) % w, (i * 37.9) % h, 2, 2);
    }, { repeat: 2, cache: 'supercarQuilt' });
    const leather = k.mat({ map: quilt, roughness: .45, clearcoat: .3, clearcoatRoughness: .4, sheen: .4, sheenColor: k.color('#fff4dc') });
    const inner = k.mat({ color: k.color('#1d1a19'), roughness: .7, sheen: .4, sheenColor: k.color('#5a4a40') });
    const zc = (zD0 + zD1) / 2, dl = zD0 - zD1;
    k.add(g, k.box(1.76, .12, dl + .1, .03), inner, { p: [0, .2, zc] });
    k.add(g, k.box(.06, .5, dl, .02), inner, { p: [-.84, .46, zc] });
    k.add(g, k.box(1.7, .48, .1, .03), inner, { p: [0, .46, zD1 - .02] });
    k.add(g, k.box(1.5, .22, .3, .08), inner, { p: [0, .58, zD0 + .02] });
    k.add(g, k.box(1.4, .02, .02, .008), au, { p: [0, .64, zD0 - .13] });
    k.add(g, k.box(.26, .26, dl, .06), inner, { p: [0, .38, zc] });
    for (const sx of [-1, 1]) {
      const seat = k.group([], { p: [sx * .44, .24, -.06] }); g.add(seat);
      k.add(seat, k.box(.48, .13, .5, .06, 3), leather, { p: [0, .07, .08] });
      k.add(seat, k.box(.48, .64, .13, .06, 3), leather, { p: [0, .4, -.18], r: [-.32, 0, 0] });
      for (const bx of [-1, 1]) k.add(seat, k.capsule(.055, .46, 6), leather, { p: [bx * .24, .4, -.14], r: [-.32, 0, 0] });
    }
    const sw = k.group([], { p: [-.44, .74, .36], r: [-1.1, 0, 0] }); g.add(sw);
    k.add(sw, k.torus(.14, .024, { rs: 10, ts: 40 }), inner, { r: [Math.PI / 2, 0, 0] });
    k.add(sw, k.cyl(.05, .05, .04, { seg: 20 }), au);
    // ---- wheels: low-profile tyres, gold ten-spoke rims, drilled discs and black calipers ----
    const discTex = k.tex(128, 128, (c, w, h) => { c.fillStyle = '#6f7278'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a2b2e'; for (let r = 0; r < 3; r++) for (let i = 0; i < 24; i++) { const a = i / 24 * TAU + r * .12, rr = w * (.3 + r * .06); c.beginPath(); c.arc(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr, 2.6, 0, TAU); c.fill(); } }, { cache: 'supercarDisc' });
    const discMat = k.mat({ map: discTex, metalness: .8, roughness: .35 }), caliper = k.gloss('#141416'), auIn = gold(k, .2, { side: T.DoubleSide });
    const wheel = (R, tw, sd) => {
      const w = k.group([], { r: [0, 0, -sd * Math.PI / 2] }), Rr = R * .71;
      k.add(w, k.lathe([[Rr + .004, -tw / 2 + .025], [Rr + .03, -tw / 2], [R - .07, -tw / 2 - .006], [R - .018, -tw / 2 + .014], [R, -tw / 2 + .05],
        [R, tw / 2 - .05], [R - .018, tw / 2 - .014], [R - .07, tw / 2 + .006], [Rr + .03, tw / 2], [Rr + .004, tw / 2 - .025]], { smooth: true, samples: 34, seg: 56 }), rubber);
      k.add(w, k.cyl(Rr, Rr, tw * .9, { seg: 48, open: true }), auIn);
      k.add(w, k.torus(Rr - .006, .014, { rs: 8, ts: 64 }), au, { p: [0, tw / 2 - .02, 0], r: [Math.PI / 2, 0, 0] });
      const face = new T.Shape(); face.absarc(0, 0, Rr - .012, 0, TAU, false);
      const holes = [], nSp = 10, ro = Rr - .045, ri = .1;
      for (let i = 0; i < nSp; i++) {
        const a0 = i / nSp * TAU, a1 = (i + 1) / nSp * TAU, wo = .024 / ro, wi = .02 / ri, sweep = .22 * sd, h = new T.Path();
        for (let q = 0; q <= 5; q++) { const a = lerp(a0 + wo, a1 - wo, q / 5); q ? h.lineTo(Math.cos(a) * ro, Math.sin(a) * ro) : h.moveTo(Math.cos(a) * ro, Math.sin(a) * ro); }
        for (let q = 0; q <= 3; q++) { const a = lerp(a1 - wi, a0 + wi, q / 3) + sweep; h.lineTo(Math.cos(a) * ri, Math.sin(a) * ri); }
        h.closePath(); holes.push(h);
      }
      const fg = k.extrude(face, .02, { holes, bevel: .01, bevelSeg: 1, curve: 40 });
      fg.rotateX(-Math.PI / 2);
      warp(k, fg, v => { const r = Math.hypot(v.x, v.z); v.y -= .07 * (1 - r / Rr) ** 1.4; });
      k.add(w, fg, au, { p: [0, tw / 2 - .035, 0] });
      k.add(w, k.cyl(.075, .075, .05, { seg: 6 }), au, { p: [0, tw / 2 - .09, 0] });
      k.add(w, k.sphere(.045, { w: 20, h: 12, thetaLen: Math.PI / 2 }), au, { p: [0, tw / 2 - .07, 0] });
      k.add(w, k.cyl(Rr * .86, Rr * .86, .028, { seg: 48 }), discMat, { p: [0, -.02, 0] });
      k.add(w, k.torus(Rr * .74, .045, { rs: 10, ts: 20, arc: .9 }), caliper, { p: [0, .02, 0], r: [Math.PI / 2, 0, sd > 0 ? 1.9 : Math.PI - 2.8], s: [1, 1, 1.5] });
      return w;
    };
    for (const sd of [1, -1]) for (const [za, R, tw] of [[AF, RF, .3], [AR, RR, .36]]) {
      g.add(k.group([wheel(R, tw, sd)], { p: [sd * (.94 - tw / 2), R, za] }));
      k.add(g, k.cyl(ARCH - .01, ARCH - .01, tw + .14, { open: true, start: -.3, len: Math.PI + .6, seg: 40 }), k.matte('#0d0d0f', .8, { side: T.DoubleSide }), { p: [sd * (.94 - tw / 2), R, za], r: [0, 0, Math.PI / 2], shadow: false });
    }
    // ---- the nose and tail faces, found by walking out along the car until a point leaves the body ----
    const inside = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    const ends = (z0, z1) => range(z0, z1, 70).map(z => ({ z, P: range(0, 1, 72).slice(0, -1).map(t => body(z, t)) }));
    const nose = ends(1.82, ZN - 1e-4), tail = ends(-1.78, ZT + 1e-4);
    const faceZ = (E, x, y) => { let last = E[0].z; for (const { z, P } of E) { if (inside(P, x, y)) last = z; else break; } return last + (E[1].z - E[0].z) * .5; };
    const faceGeo = (E, x0, x1, y0, y1, lift = .01, nx = 12, ny = 6) => gridGeo(k, (u, v) => { const x = lerp(x0, x1, u), y = lerp(y0, y1, v); return [x, y, faceZ(E, x, y) + Math.sign(E[1].z - E[0].z) * lift]; }, range(0, 1, nx), range(0, 1, ny));
    // headlights: smoked lenses on the nose corners with a glowing arrow of LEDs and a halo
    const lamp = k.tex(256, 128, (c, w, h) => {
      c.fillStyle = '#10141c'; c.beginPath(); c.moveTo(w * .02, h * .9); c.lineTo(w * .3, h * .18); c.lineTo(w * .98, h * .08); c.lineTo(w * .9, h * .5); c.lineTo(w * .35, h * .72); c.closePath(); c.fill();
      c.strokeStyle = '#eaf6ff'; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(w * .12, h * .72); c.lineTo(w * .34, h * .3); c.lineTo(w * .9, h * .18); c.stroke();
      c.beginPath(); c.moveTo(w * .36, h * .56); c.lineTo(w * .82, h * .4); c.stroke();
      c.fillStyle = '#ffffff'; for (const x of [.5, .64, .78]) { c.beginPath(); c.arc(w * x, h * .3, 9, 0, TAU); c.fill(); }
    }, { cache: 'supercarLamp' });
    const lampMat = decalMat(k.mat({ map: lamp, transparent: true, roughness: .05, clearcoat: 1, clearcoatRoughness: 0, emissive: k.color('#ffffff'), emissiveMap: lamp, emissiveIntensity: 1.6, metalness: .2 }));
    for (const sd of [1, -1]) {
      const gx = sd > 0 ? [.3, .82] : [-.82, -.3], lg = faceGeo(nose, gx[0], gx[1], .44, .62, .012, 14, 8);
      if (sd < 0) { const uv = lg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
      k.add(g, lg, lampMat, { shadow: false });
      const hp = [sd * .6, .55, faceZ(nose, sd * .6, .55) + .1];
      g.add(k.place(halo(k, .42, '#dff2ff', .5), { p: hp }));
    }
    // intakes: black honeycomb under the lights and across the chin, a carbon splitter below
    const hex = k.tex(128, 128, (c, w, h) => {
      c.fillStyle = '#060607'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3a3c42'; c.lineWidth = 2.5;
      for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) { const x = i * 16 + (j % 2) * 8, y = j * 14; c.beginPath(); for (let q = 0; q < 6; q++) { const a = q / 6 * TAU + Math.PI / 6; c.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); } c.closePath(); c.stroke(); }
    }, { repeat: [4, 1.5], cache: 'supercarHex' });
    const mesh = decalMat(k.mat({ map: hex, roughness: .5, metalness: .4 }));
    for (const sd of [1, -1]) k.add(g, faceGeo(nose, sd > 0 ? .3 : -.8, sd > 0 ? .8 : -.3, .2, .38, .01), mesh, { shadow: false });
    k.add(g, faceGeo(nose, -.26, .26, .2, .3, .01, 8, 4), mesh, { shadow: false });
    const splitPts = range(-.86, .86, 24).map(x => [x, faceZ(nose, x * .98, .2) + .06]);
    const split = new T.Shape(); split.moveTo(-.86, 1.75); for (const [x, z] of splitPts) split.lineTo(x, z); split.lineTo(.86, 1.75); split.closePath();
    k.add(g, k.extrude(split, .02, { bevel: .008, bevelSeg: 1 }), carbon, { p: [0, .125, 0], r: [Math.PI / 2, 0, 0] });
    // a gold crest on the nose
    const crest = k.group([], { p: onBody(1.98, 0, .004) }); g.add(crest);
    crest.quaternion.setFromUnitVectors(V([0, 0, 1]), V(onBody(1.98, 0, 1)).sub(V(body(1.98, 0))).normalize());
    const shield = k.shape([[-.07, .06], [.07, .06], [.07, 0], [0, -.09], [-.07, 0]]);
    k.add(crest, k.extrude(shield, .01, { bevel: .008, bevelSeg: 2 }), au);
    k.add(crest, k.extrude(k.shape([[-.05, .045], [.05, .045], [.05, 0], [0, -.066], [-.05, 0]]), .01, { bevel: .003, bevelSeg: 1 }), k.gloss('#101012'), { p: [0, 0, .01] });
    k.add(crest, brilliant(k, 8), gemMat(k, 'ruby', .5), { p: [0, 0, .02], r: [Math.PI / 2, 0, 0], s: .025 });
    // the side intakes: honeycomb in the scoop ahead of the rear wheels
    const scoop = gridGeo(k, (u, v) => { const z = lerp(-.98, -.46, u); return onBody(z, lerp(tAtY(z, .66), tAtY(z, .34), v), .006); }, range(0, 1, 16), range(0, 1, 8), undefined, true);
    const scoopL = gridGeo(k, (u, v) => { const z = lerp(-.98, -.46, u); return onBody(z, 1 - lerp(tAtY(z, .66), tAtY(z, .34), v), .006); }, range(0, 1, 16), range(0, 1, 8));
    const scoopMat = decalMat(k.mat({ map: hex.clone(), roughness: .5, metalness: .4 })); scoopMat.map.repeat.set(3, 2);
    k.add(g, scoop, scoopMat, { shadow: false }); k.add(g, scoopL, scoopMat, { shadow: false });
    // carbon side skirts
    for (const sd of [1, -1]) k.add(g, k.box(.05, .07, 1.78, .02), carbon, { p: [sd * .895, .17, .02] });
    // a gold pinstripe along each flank
    for (const sd of [1, -1]) k.add(g, k.tube(range(-1.95, 1.95, 60).map(z => onBody(z, sd > 0 ? .205 : .795, .006)), .008, { seg: 160, rs: 5 }), au, { shadow: false });
    // the tail: a glowing light bar, smoked lenses, a black diffuser with four gold tips, louvres and the wing
    const barY = .72, bar = range(-.84, .84, 30).map(x => [x, barY - .04 * (x / .84) ** 2, faceZ(tail, x, barY - .04 * (x / .84) ** 2) - .012]);
    k.add(g, k.tube(bar, .018, { seg: 90, rs: 8, caps: true }), k.glow('#ff2a2a', 2.4), { shadow: false });
    k.add(g, faceGeo(tail, -.86, .86, .64, .8, .006, 24, 4), decalMat(k.mat({ color: k.color('#190406'), roughness: .05, clearcoat: 1 })), { shadow: false });
    for (const x of [-.72, 0, .72]) g.add(k.place(halo(k, .45, '#ff3030', .45), { p: [x, barY, faceZ(tail, x, barY) - .12] }));
    k.add(g, faceGeo(tail, -.8, .8, .2, .44, .006, 20, 5), mesh, { shadow: false });
    for (const x of [-.24, -.09, .09, .24]) {
      const ez = faceZ(tail, x, .34);
      k.add(g, k.cyl(.055, .06, .16, { seg: 28, open: true }), gold(k, .12, { side: T.DoubleSide }), { p: [x, .34, ez - .02], r: [Math.PI / 2, 0, 0] });
      k.add(g, k.disc(.05, 24), k.matte('#050505', .9), { p: [x, .34, ez + .02], r: [0, Math.PI, 0] });
    }
    for (const x of [-.62, -.44, .44, .62]) k.add(g, k.box(.02, .16, .42, .006), carbon, { p: [x, .2, -1.98] });
    const louvre = k.tex(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#0c0c0e'; for (let i = 0; i < 6; i++) c.fillRect(8, 6 + i * 21, w - 16, 12); }, { cache: 'supercarLouvre' });
    k.add(g, gridGeo(k, (u, v) => onBody(lerp(-1.95, -1.58, u), lerp(-.075, .075, v), .004), range(0, 1, 8), range(0, 1, 8), undefined, true), decalMat(k.mat({ map: louvre, transparent: true, roughness: .4 })), { shadow: false });
    const foil = new T.Shape(); foil.moveTo(0, 0); foil.bezierCurveTo(.02, .05, .2, .06, .44, .03); foil.lineTo(.44, .015); foil.bezierCurveTo(.2, .005, .05, -.02, 0, 0);
    const wing = k.extrude(foil, 1.72, { bevel: .006, bevelSeg: 1, curve: 16 }); wing.rotateY(Math.PI / 2);
    k.add(g, wing, carbon, { p: [0, 1.18, -1.92], r: [-.1, 0, 0] });
    for (const sd of [1, -1]) {
      k.add(g, k.extrude(k.shape([[0, 0], [.5, 0], [.46, .18], [.06, .2]]), .015, { bevel: .004, bevelSeg: 1 }), carbon, { p: [sd * .87, 1.08, -1.9], r: [0, -Math.PI / 2, 0] });
      k.add(g, k.box(.03, .26, .1, .012), carbon, { p: [sd * .42, 1.03, -2.05], r: [-.2, 0, 0] });
    }
    // glints on the paint and the rims
    glints(k, g, [[.62, .86, 1.2, .4, .2], [.98, .62, -1.1, .32, .6], [.2, 1.12, .1, .3, 0]]);
    g.userData.view = { az: 40, el: 14 };
    g.userData.fullView = { az: 28, el: 11 };
    g.userData.noHero = true;
    return g;
  },

  // A royal four-poster: gilded barley-twist posts, a jewelled cornice under a velvet dome and a crown, velvet curtains
  // tied back with gold tassels, a tufted headboard buttoned with crystals, a quilted satin coverlet and a heap of pillows.
  canopybed(k) {
    const T = k.THREE, g = k.group();
    const au = gold(k, .16), auSoft = gold(k, .3);
    const red = velvet(k, '#7e0a20', '#ff5a74'), redIn = velvet(k, '#7e0a20', '#ff5a74', { side: T.BackSide });
    const lining = k.mat({ color: k.color('#e8c46a'), roughness: .4, metalness: .3, sheen: .8, sheenColor: k.color('#fff2c8'), side: T.BackSide });
    const W = 2.2, L = 2.6, top = 1.08, PX = 1.26, PZ = 1.46, HT = 3.35;           // bed, posts, tester height
    // ---- the coverlet: quilted champagne satin over the top, falling to the floor all round with folds ----
    const quiltTex = k.tex(512, 512, (c, w, h) => {
      c.fillStyle = '#f2d594'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#b07a22'; c.lineWidth = 3;
      for (let i = -8; i <= 16; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64 + h, h); c.stroke(); c.beginPath(); c.moveTo(i * 64, h); c.lineTo(i * 64 + h, 0); c.stroke(); }
      c.fillStyle = '#c99a3c'; for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { c.beginPath(); c.arc(i * 64, j * 64, 4, 0, TAU); c.fill(); c.beginPath(); c.arc(i * 64 + 32, j * 64 + 32, 4, 0, TAU); c.fill(); }
    }, { repeat: [2.2, 2.6], cache: 'canopyQuilt' });
    const satin = k.mat({ map: quiltTex, roughness: .35, sheen: 1, sheenRoughness: .3, sheenColor: k.color('#fff6dc'), clearcoat: .3, clearcoatRoughness: .3 });
    const q = (x, z) => { const s = .5, a = (x + z) / s, b = (x - z) / s, da = Math.abs(a - Math.round(a)) * s, db = Math.abs(b - Math.round(b)) * s; return Math.min(1, Math.exp(-((da / .04) ** 2)) + Math.exp(-((db / .04) ** 2))); };
    const edge = (x, z) => Math.min(W / 2 - Math.abs(x), L / 2 - Math.abs(z) + (z < 0 ? 1 : 0));
    const topGeo = gridGeo(k, (x, z) => { const e = edge(x, z); return [x, top + .06 * smooth(0, .3, e) - .025 * q(x, z) * smooth(.05, .25, e) - .1 * (1 - smooth(0, .12, e)), z]; }, range(-W / 2, W / 2, 56), range(-L / 2, L / 2, 68));
    k.add(g, topGeo, satin);
    // the drape: along the right side, round the foot and back up the left side
    const rc = .14, path = [];
    const addRun = (a, b, n) => { for (let i = 0; i < n; i++) { const t = i / n; path.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]); } };
    addRun([W / 2, -L / 2], [W / 2, L / 2 - rc], 40);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI / 2; path.push([W / 2 - rc + Math.cos(a) * rc, L / 2 - rc + Math.sin(a) * rc]); }
    addRun([W / 2 - rc, L / 2], [-W / 2 + rc, L / 2], 36);
    for (let i = 0; i < 8; i++) { const a = Math.PI / 2 + i / 8 * Math.PI / 2; path.push([-W / 2 + rc + Math.cos(a) * rc, L / 2 - rc + Math.sin(a) * rc]); }
    addRun([-W / 2, L / 2 - rc], [-W / 2, -L / 2], 40); path.push([-W / 2, -L / 2]);
    const plen = [0]; for (let i = 1; i < path.length; i++) plen.push(plen[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    const P = plen[plen.length - 1];
    const at = s => { let i = 1; while (i < path.length - 1 && plen[i] < s) i++; const f = (s - plen[i - 1]) / Math.max(1e-6, plen[i] - plen[i - 1]); const [x0, z0] = path[i - 1], [x1, z1] = path[i]; const l = Math.hypot(x1 - x0, z1 - z0) || 1; return [lerp(x0, x1, f), lerp(z0, z1, f), (z1 - z0) / l, -(x1 - x0) / l]; };
    const skirt = (u, v) => {
      const [x, z, nx, nz] = at(u * P), fold = Math.sin(u * P * 9.5) * .045 * v ** 1.3 + Math.sin(u * P * 23) * .012 * v, out = .015 + .09 * v ** 1.8 + fold;
      return [x + nx * out, lerp(top - .1, .06, v) + .02 * Math.sin(u * P * 9.5 + 1) * v, z + nz * out];
    };
    const ssU = range(0, 1, 240), ssV = range(0, 1, 14);
    k.add(g, gridGeo(k, skirt, ssU, ssV, undefined, true), satin);
    k.add(g, k.tube(ssU.map(u => skirt(u, 0)), .03, { seg: 240, rs: 6 }), au);                       // gold piping at the edge
    const fringe = ssU.filter((_, i) => i % 2 === 0).map(u => { const p = skirt(u, 1); return { p: [p[0], .09, p[2]] }; });
    g.add(k.instances(k.cyl(.012, .006, .1, { seg: 5 }), auSoft, fringe));
    // ---- the headboard: an arched frame of gold round crimson velvet, tufted and buttoned with crystals ----
    const HW = W / 2 + .02, hb0 = .5, hbTop = x => 2.45 + .38 * Math.cos(Math.min(1, Math.abs(x) / HW) * Math.PI / 2) ** 1.5 - .12 * smooth(.75, 1, Math.abs(x) / HW);
    const zH = -L / 2 - .1;
    const tuft = (u, v) => {
      const x = lerp(-HW, HW, u), yT = hbTop(x) - .1, y = lerp(hb0, yT, v);
      const gx = x / .3, gy = (y - hb0) / .3, fx = gx - Math.round(gx), fy = gy - Math.round(gy);
      const ox = (Math.round(gx) + Math.round(gy)) & 1, dx = ox ? Math.abs(fx) : Math.abs(Math.abs(fx) - .5), dy = ox ? Math.abs(fy) : Math.abs(Math.abs(fy) - .5);
      const dimple = Math.exp(-((Math.hypot(dx, dy) / .22) ** 2));
      const rim = smooth(0, .06, Math.min(u, 1 - u) * 2 * HW) * smooth(0, .06, Math.min(v, 1 - v) * (yT - hb0));
      return [x, y, zH + .12 * rim * (1 - .7 * dimple)];
    };
    k.add(g, gridGeo(k, tuft, range(0, 1, 62), range(0, 1, 50)), Object.assign(velvet(k, '#b3142f', '#ff8aa0', { scale: 1.5 }), { emissive: k.color('#3a0010'), emissiveIntensity: .5 }));
    const btn = [];
    for (let i = -8; i <= 8; i++) for (let j = 0; j <= 8; j++) {
      const x = i * .3 / 2 * 2 / 2 * 2, y = hb0 + j * .3;
      for (const [bx, by] of [[x, y], [x + .15, y + .15]]) if (Math.abs(bx) < HW - .12 && by > hb0 + .1 && by < hbTop(bx) - .22 && (Math.round(bx / .15) + Math.round((by - hb0) / .15)) % 2 === 0) btn.push({ p: [bx, by, zH + .05], s: .028 });
    }
    g.add(k.instances(k.sphere(1, { w: 8, h: 4 }), gemMat(k, 'diamond', .2), btn));
    const hbOut = [...range(-HW, HW, 60).map(x => [x, hbTop(x), zH + .02])];
    k.add(g, k.tube([[-HW, hb0 - .05, zH + .02], ...hbOut, [HW, hb0 - .05, zH + .02]], .07, { seg: 140, rs: 10 }), au);
    k.add(g, k.box(2 * HW, .1, .16, .03), au, { p: [0, hb0 - .05, zH] });
    k.add(g, k.box(2 * HW + .1, 2.2, .1, .03), k.wood('#4a1a10', { varnish: .6 }), { p: [0, 1.4, zH - .1] });
    const crest = k.group([], { p: [0, hbTop(0) + .08, zH + .05] }); g.add(crest);
    const cart = new T.Shape(); cart.absellipse(0, 0, .22, .28, 0, TAU, false, 0);
    k.add(crest, k.extrude(cart, .05, { bevel: .03, bevelSeg: 3, curve: 32 }), au, { p: [0, .12, 0] });
    k.add(crest, cabochon(k), gemMat(k, 'sapphire', .45), { p: [0, .12, .06], r: [Math.PI / 2, 0, 0], s: [.13, .08, .17] });
    const cc = crown(k, .16, { gold: au }); cc.position.set(0, .38, 0); crest.add(cc);
    // ---- pillows: velvet shams against the headboard, satin pillows, gold cushions with tassels and a bolster ----
    const pil = (w, d, t, mat, p, r) => k.add(g, pillowGeo(k, w, d, t), mat, { p, r });
    const ivory = k.mat({ color: k.color('#fbf3e2'), roughness: .35, sheen: 1, sheenRoughness: .3, sheenColor: k.color('#ffffff'), clearcoat: .2 });
    const brocade = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#d9a93e'; c.fillRect(0, 0, w, h); c.fillStyle = '#b07a1c';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const x = i * 64 + 32, y = j * 64 + 32; c.beginPath(); for (let a = 0; a < 8; a++) { const r = a % 2 ? 10 : 24, t2 = a / 8 * TAU; c.lineTo(x + Math.cos(t2) * r, y + Math.sin(t2) * r); } c.fill(); }
    }, { cache: 'canopyBrocade' });
    const goldCloth = k.mat({ map: brocade, roughness: .45, metalness: .35, sheen: .7, sheenColor: k.color('#fff0b0') });
    for (const sx of [-1, 1]) {
      pil(1.02, 1.0, .34, red, [sx * .54, top + .52, -1.08], [-Math.PI / 2 + .2, 0, 0]);
      pil(.98, .62, .3, ivory, [sx * .5, top + .36, -.86], [-Math.PI / 2 + .75, sx * .08, 0]);
      pil(.52, .52, .2, goldCloth, [sx * .36, top + .28, -.6], [-Math.PI / 2 + .9, sx * .25, sx * .1]);
      for (const [cx, cy] of [[-.26, .26], [.26, .26], [-.26, -.26], [.26, -.26]]) {
        const tp = new T.Vector3(cx, cy, 0).applyEuler(new T.Euler(-Math.PI / 2 + .9, sx * .25, sx * .1)).add(new T.Vector3(sx * .36, top + .28, -.6));
        const ts = tassel(k, .14, au); ts.position.copy(tp); g.add(ts);
      }
    }
    const bol = k.group([], { p: [0, top + .2, -.42] }); g.add(bol);
    k.add(bol, k.capsule(.15, .7, 12), red, { r: [0, 0, Math.PI / 2] });
    for (const sx of [-1, 1]) {
      k.add(bol, k.torus(.12, .025, { rs: 8, ts: 24 }), au, { p: [sx * .47, 0, 0], r: [0, Math.PI / 2, 0] });
      const ts = tassel(k, .2, au); ts.position.set(sx * .53, 0, .02); bol.add(ts);
    }
    // ---- four gilded barley-twist posts ----
    const postGeo = (() => {
      const pts = [[0, 0], [.2, 0], [.2, .06], [.17, .08], [.17, .38], [.21, .42], [.21, .46], [.13, .5], [.2, .62], [.2, .7], [.1, .82], [.11, .9]];
      for (let y = .95; y <= HT - .5; y += .045) pts.push([.1, y]);
      pts.push([.13, HT - .44], [.16, HT - .38], [.1, HT - .3], [.12, HT - .2], [.17, HT - .12], [.17, HT], [0, HT]);
      const geo = k.lathe(pts, { seg: 26 });
      return warp(k, geo, v => {
        if (v.y < .95 || v.y > HT - .5) return;
        const r = Math.hypot(v.x, v.z), a = Math.atan2(v.x, v.z), f = 1 + .3 * Math.cos(2 * a - v.y * 9) * smooth(.95, 1.1, v.y) * smooth(HT - .5, HT - .65, v.y);
        v.x = Math.sin(a) * r * f; v.z = Math.cos(a) * r * f;
      }, true);
    })();
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.add(g, postGeo, au, { p: [sx * PX, 0, sz * PZ] });
    // ---- the tester: a gold cornice set with stones and crested with fleurs-de-lis ----
    const TW = 2 * PX + .3, TL = 2 * PZ + .3;
    k.add(g, k.box(TW, .1, TL, .03), auSoft, { p: [0, HT + .05, 0] });
    k.add(g, k.box(TW + .12, .24, TL + .12, .05), au, { p: [0, HT + .22, 0] });
    k.add(g, k.box(TW + .24, .07, TL + .24, .03), au, { p: [0, HT + .37, 0] });
    k.add(g, k.box(TW - .1, .06, TL - .1, .03), red, { p: [0, HT + .03, 0] });
    const jewels = [], jc = ['ruby', 'sapphire', 'emerald'];
    const band = (x0, z0, x1, z1, n, nx, nz) => { for (let i = 0; i < n; i++) { const t = (i + .5) / n; jewels.push([lerp(x0, x1, t), HT + .22, lerp(z0, z1, t), nx, nz, i]); } };
    band(-TW / 2, TL / 2 + .06, TW / 2, TL / 2 + .06, 7, 0, 1); band(TW / 2 + .06, TL / 2, TW / 2 + .06, -TL / 2, 8, 1, 0);
    band(TW / 2, -TL / 2 - .06, -TW / 2, -TL / 2 - .06, 7, 0, -1); band(-TW / 2 - .06, -TL / 2, -TW / 2 - .06, TL / 2, 8, -1, 0);
    for (const [x, y, z, nx, nz, i] of jewels) k.add(g, cabochon(k), gemMat(k, jc[i % 3], .4), { p: [x, y, z], r: [nz * Math.PI / 2, 0, -nx * Math.PI / 2], s: [.07, .05, .09] });
    const fl = fleurGeo(k);
    const crestAt = (x, z, ry) => k.add(g, fl, au, { p: [x, HT + .4, z], r: [0, ry, 0], s: .34 });
    for (const x of range(-TW / 2 + .3, TW / 2 - .3, 4)) { crestAt(x, TL / 2 + .08, 0); crestAt(x, -TL / 2 - .08, 0); }
    for (const z of range(-TL / 2 + .3, TL / 2 - .3, 5)) { crestAt(TW / 2 + .08, z, Math.PI / 2); crestAt(-TW / 2 - .08, z, Math.PI / 2); }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      k.add(g, k.lathe([[0, 0], [.11, 0], [.12, .04], [.07, .08], [.12, .18], [.13, .26], [.06, .33], [.04, .38], [0, .4]], { smooth: true, samples: 28, seg: 24 }), au, { p: [sx * (TW / 2 + .06), HT + .4, sz * (TL / 2 + .06)] });
      k.add(g, k.sphere(.07, { w: 20, h: 14 }), au, { p: [sx * (TW / 2 + .06), HT + .84, sz * (TL / 2 + .06)] });
    }
    // the canopy's top: a velvet dome rising from the cornice to the crown, ribbed in gold like a crown's arches
    const rim = th => { const c = Math.cos(th), s2 = Math.sin(th), t = Math.min((TW / 2 - .02) / Math.abs(s2 || 1e-9), (TL / 2 - .02) / Math.abs(c || 1e-9)); return [s2 * t, c * t]; };
    const RC = .5, DH = .5, dome = (th, v) => { const [x, z] = rim(th), f = 1 - Math.cos(v * Math.PI / 2), y = HT + .39 + DH * Math.sin(v * Math.PI / 2); return [lerp(x, Math.sin(th) * RC, f), y, lerp(z, Math.cos(th) * RC, f)]; };
    k.add(g, gridGeo(k, dome, range(0, TAU, 72), range(0, 1, 12), undefined, true), red);
    for (let i = 0; i < 8; i++) {
      const th = i / 8 * TAU, rib = range(0, 1, 14).map(v => { const p2 = dome(th, v), [x, z] = rim(th), l = Math.hypot(x, z); return [p2[0] + x / l * .03, p2[1] + .02, p2[2] + z / l * .03]; });
      k.add(g, k.tube(rib, .035, { seg: 20, rs: 6 }), au);
    }
    const big = crown(k, .54, { gold: au }); big.position.set(0, HT + .39 + DH - .02, 0); g.add(big);
    // ---- velvet: swags under the cornice, a pleated back cloth and curtains tied back to the foot posts ----
    const swag = (x0, x1, y0, sag, n) => (u, v) => {
      const x = lerp(x0, x1, u), drop = .12 + sag * Math.sin(Math.PI * u), y = y0 - v * drop;
      return [x, y, .06 * Math.sin(v * Math.PI * n) * Math.sin(Math.PI * u) + .05 * v * Math.sin(Math.PI * u)];
    };
    const swags = (len, count, place) => {
      for (let i = 0; i < count; i++) {
        const x0 = -len / 2 + i * len / count, x1 = x0 + len / count, fn = swag(x0, x1, HT + .02, .32, 3), sg = k.group([], place); g.add(sg);
        const geo = gridGeo(k, fn, range(0, 1, 26), range(0, 1, 10));
        k.add(sg, geo, red); k.add(sg, geo, redIn);
        const hem = range(0, 1, 26).map(u => fn(u, 1));
        sg.add(k.instances(k.cyl(.012, .006, .09, { seg: 4 }), auSoft, hem.filter((_, i) => i % 2).map(p => ({ p: [p[0], p[1] - .04, p[2]] }))));
        k.add(sg, k.tube(hem, .018, { seg: 40, rs: 5 }), au);
        const ts = tassel(k, .3, au); ts.position.set(x1, HT - .02, .08); sg.add(ts);
      }
    };
    swags(TW, 2, { p: [0, 0, TL / 2 + .1] });
    swags(TL, 3, { p: [TW / 2 + .1, 0, 0], r: [0, Math.PI / 2, 0] });
    swags(TL, 3, { p: [-TW / 2 - .1, 0, 0], r: [0, -Math.PI / 2, 0] });
    const back = gridGeo(k, (u, v) => [lerp(-PX, PX, u), lerp(HT, .02, v), zH - .2 + .05 * Math.sin(u * 30) - .02], range(0, 1, 120), range(0, 1, 6));
    k.add(g, back, red);
    const curtain = (sx) => (u, v) => {
      const yT = HT - .05, yTie = 1.45, x0 = sx * (PX + .12), x1 = sx * (PX - 1.0), tieW = .2, botW = .5;
      let x, y = lerp(yT, 0, v), z;
      if (y > yTie) { const s = (yT - y) / (yT - yTie), e = s ** 1.7; x = lerp(lerp(x0, x1, u), x0 - sx * (u - .35) * tieW, e); }
      else { const s = (yTie - y) / yTie; x = x0 - sx * (u - .35) * lerp(tieW, botW, Math.sqrt(s)); }
      const width = y > yTie ? lerp(1.12, tieW, ((yT - y) / (yT - yTie)) ** 1.7) : lerp(tieW, botW, Math.sqrt((yTie - y) / yTie));
      z = .035 * Math.sqrt(1.12 / width) * Math.sin(u * Math.PI * 9) + .1 * Math.exp(-(((y - yTie) / .35) ** 2));
      return [x, y, PZ + .16 + z];
    };
    for (const sx of [-1, 1]) {
      const geo = gridGeo(k, curtain(sx), range(0, 1, 36), range(0, 1, 46), undefined, sx > 0);
      k.add(g, geo, red); k.add(g, geo, lining);
      const tie = new T.Vector3(sx * (PX + .12) - sx * .06, 1.45, PZ + .2);
      k.add(g, k.torus(.2, .03, { rs: 8, ts: 36 }), au, { p: tie.toArray(), r: [Math.PI / 2, 0, 0], s: [1, 1, .6] });
      for (const dx of [-.07, .07]) { const ts = tassel(k, .36, au); ts.position.set(tie.x + dx, tie.y - .05, tie.z + .12); g.add(ts); }
    }
    glints(k, g, [[PX + .05, 2.6, PZ + .1, .5, .3], [.3, HT + 1.1, .2, .45, 0], [-.6, HT + .25, TL / 2 + .15, .35, .5], [.9, top + .1, 1.2, .3, .2]]);
    g.userData.view = { az: 28, el: 12 };
    return g;
  },

  // The treasure chest from under the bed, thrown open: gold coins heaped up and spilling out, rubies, emeralds and
  // sapphires, strings of pearls, a jewelled crown and a goblet, and a warm light glowing up out of it.
  treasurechest(k) {
    const T = k.THREE, g = k.group();
    const W = 2.0, D = 1.25, H = .95, F = .16, rimY = F + H;
    const au = gold(k, .15);
    const planks = k.tex(512, 512, (c, w, h) => {
      const tones = ['#6e3a1c', '#5f3117', '#7a4322', '#66361b', '#5a2e16'], R = mulberryish(11);
      for (let i = 0; i < 5; i++) {
        const y0 = i * h / 5; c.fillStyle = tones[i]; c.fillRect(0, y0, w, h / 5);
        for (let j = 0; j < 26; j++) { c.strokeStyle = `rgba(30,12,4,${.12 + R() * .2})`; c.lineWidth = .8 + R() * 1.6; c.beginPath(); const yy = y0 + R() * h / 5; for (let x = 0; x <= w; x += 16) c.lineTo(x, yy + Math.sin(x * .02 + j) * 3); c.stroke(); }
        c.fillStyle = 'rgba(18,6,2,.85)'; c.fillRect(0, y0, w, 5); c.fillStyle = 'rgba(255,200,150,.12)'; c.fillRect(0, y0 + 5, w, 2);
      }
    }, { cache: 'chestPlanks' });
    const wood = k.mat({ map: planks, roughness: .45, clearcoat: .7, clearcoatRoughness: .2 });
    const lidPlanks = planks.clone(); lidPlanks.center.set(.5, .5); lidPlanks.rotation = Math.PI / 2; lidPlanks.repeat.set(1, 1.4); lidPlanks.wrapS = lidPlanks.wrapT = T.RepeatWrapping;
    const lidWood = k.mat({ map: lidPlanks, roughness: .45, clearcoat: .7, clearcoatRoughness: .2, side: T.FrontSide });
    // ---- the chest: planked box on gold bun feet, banded, strapped and cornered in gold, with rivets and a lock ----
    k.add(g, k.box(W, H, D, .03, 2), wood, { p: [0, F + H / 2, 0] });
    k.add(g, k.box(W + .08, .1, D + .08, .03, 2), au, { p: [0, F + .05, 0] });
    k.add(g, k.box(W + .08, .09, D + .08, .03, 2), au, { p: [0, rimY - .045, 0] });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      k.add(g, k.lathe([[0, 0], [.1, 0], [.14, .04], [.15, .09], [.11, .15], [.09, F], [0, F]], { smooth: true, samples: 24, seg: 24 }), au, { p: [sx * (W / 2 - .1), 0, sz * (D / 2 - .1)] });
      k.add(g, k.box(.16, H - .1, .02, .01), au, { p: [sx * (W / 2 - .06), F + H / 2, sz * (D / 2 + .012)] });
      k.add(g, k.box(.02, H - .1, .16, .01), au, { p: [sx * (W / 2 + .012), F + H / 2, sz * (D / 2 - .06)] });
    }
    const rivets = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 6; i++) { const y = F + .16 + i * (H - .3) / 5; rivets.push({ p: [sx * (W / 2 - .06), y, sz * (D / 2 + .024)], s: .018 }, { p: [sx * (W / 2 + .024), y, sz * (D / 2 - .06)], s: .018 }); }
    for (const x of [-.62, .62]) {
      k.add(g, k.box(.14, H - .02, .025, .01), au, { p: [x, F + H / 2, D / 2 + .012] });
      k.add(g, k.box(.14, H - .02, .025, .01), au, { p: [x, F + H / 2, -D / 2 - .012] });
      for (let i = 0; i < 6; i++) rivets.push({ p: [x, F + .14 + i * (H - .26) / 5, D / 2 + .028], s: .02 });
    }
    for (let i = 0; i < 18; i++) { const x = -W / 2 + .08 + i * (W - .16) / 17; rivets.push({ p: [x, rimY - .045, D / 2 + .045], s: .016 }, { p: [x, F + .05, D / 2 + .045], s: .016 }); }
    g.add(k.instances(k.sphere(1, { w: 8, h: 3, thetaLen: Math.PI / 2 }).rotateX(Math.PI / 2), au, rivets));
    for (const sx of [-1, 1]) {           // ring handles on the ends
      k.add(g, k.cyl(.12, .12, .03, { seg: 24 }), au, { p: [sx * (W / 2 + .02), F + H * .62, 0], r: [0, 0, Math.PI / 2] });
      k.add(g, k.torus(.15, .025, { rs: 8, ts: 32, arc: Math.PI }), au, { p: [sx * (W / 2 + .05), F + H * .62, 0], r: [0, Math.PI / 2, Math.PI], s: [1, 1, 1] });
    }
    // the lock: a shield escutcheon with a keyhole, a ruby, and the padlock hanging open
    const esc = k.group([], { p: [0, rimY - .3, D / 2 + .02] }); g.add(esc);
    k.add(esc, k.extrude(k.shape([[-.2, .22], [.2, .22], [.22, -.02], [0, -.3], [-.22, -.02]]), .03, { bevel: .015, bevelSeg: 2 }), au);
    const kh = new T.Shape(); kh.absarc(0, .04, .045, -Math.PI * .25, Math.PI * 1.25, false); kh.lineTo(-.035, -.12); kh.lineTo(.035, -.12); kh.closePath();
    k.add(esc, k.extrude(kh, .01, { bevel: .002, bevelSeg: 1 }), k.matte('#0b0806', .9), { p: [0, -.02, .03] });
    k.add(esc, brilliant(k, 10), gemMat(k, 'ruby', .5), { p: [0, .15, .04], r: [Math.PI / 2, 0, 0], s: .05 });
    const lock = k.group([], { p: [.02, rimY - .62, D / 2 + .1], r: [.25, 0, .12] }); g.add(lock);
    k.add(lock, k.box(.24, .22, .09, .04, 3), au);
    k.add(lock, k.torus(.075, .022, { rs: 8, ts: 24, arc: Math.PI }), au, { p: [-.04, .14, 0], r: [0, .7, 0] });
    k.add(lock, k.cyl(.022, .022, .06, { seg: 10 }), au, { p: [.035, .13, -.02] });
    k.add(lock, k.cyl(.022, .022, .1, { seg: 10 }), au, { p: [-.115, .16, .05], r: [0, 0, 0] });
    k.add(lock, k.extrude(kh, .005, { bevel: .001, bevelSeg: 1 }), k.matte('#0b0806', .9), { p: [0, -.02, .047], s: .6 });
    // ---- the lid: a planked barrel top, banded in gold, lined with buttoned crimson velvet, flung open ----
    const lid = k.group([], { p: [0, rimY, -D / 2], r: [-k.deg(108), 0, 0] }); g.add(lid);
    const R = D / 2;
    const barrel = (outer) => gridGeo(k, (x, a) => { const r = outer ? R : R - .05; return [x, Math.sin(a) * r, R - Math.cos(a) * r]; }, range(-W / 2, W / 2, 40), range(0, Math.PI, 40), undefined, !outer);
    k.add(lid, barrel(true), lidWood);
    const tuftTex = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#9c0f2a'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (const [dx, dy] of [[0, 0], [.5, .5]]) {
        const x = (i + dx) * w / 4, y = (j + dy) * h / 4, gr = c.createRadialGradient(x, y, 0, x, y, w / 7);
        gr.addColorStop(0, 'rgba(40,0,8,.75)'); gr.addColorStop(1, 'rgba(40,0,8,0)'); c.fillStyle = gr; c.fillRect(x - w / 7, y - h / 7, w / 3.5, h / 3.5);
        c.fillStyle = '#f7d77a'; c.beginPath(); c.arc(x, y, 5, 0, TAU); c.fill();
      }
    }, { repeat: [5, 3], cache: 'chestTuft' });
    k.add(lid, barrel(false), k.mat({ map: tuftTex, roughness: .85, sheen: 1, sheenRoughness: .4, sheenColor: k.color('#ff7a90') }));
    for (const sx of [-1, 1]) {
      const cap = new T.Shape(); cap.absarc(0, 0, R, 0, Math.PI, false); cap.closePath();
      k.add(lid, k.extrude(cap, .04, { bevel: .01, bevelSeg: 1 }), [lidWood, lidWood], { p: [sx * (W / 2 - .02), 0, R], r: [0, Math.PI / 2, 0] });
      k.add(lid, k.torus(R + .01, .03, { rs: 8, ts: 40, arc: Math.PI }), au, { p: [sx * (W / 2 + .005), 0, R], r: [0, Math.PI / 2, 0] });
    }
    for (const x of [-.62, .62]) k.add(lid, k.torus(R + .012, .035, { rs: 8, ts: 40, arc: Math.PI }), au, { p: [x, 0, R], r: [0, Math.PI / 2, 0], s: [1, 1, 1.6] });
    for (const z of [.02, 2 * R - .02]) k.add(lid, k.box(W + .06, .05, .05, .015), au, { p: [0, .02, z] });
    k.add(lid, k.extrude(k.shape([[-.12, 0], [.12, 0], [.1, -.28], [0, -.36], [-.1, -.28]]), .02, { bevel: .01, bevelSeg: 2 }), au, { p: [0, .02, 2 * R + .012], r: [Math.PI / 2, 0, 0] });
    // ---- the hoard: a mound of coins inside, spilling down to a pile and stacks on the floor ----
    const coinTex = k.tex(128, 128, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#7a5210'; c.lineWidth = 5; c.beginPath(); c.arc(w / 2, h / 2, w * .42, 0, TAU); c.stroke();
      c.fillStyle = '#9a6a18'; for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; c.beginPath(); c.arc(w / 2 + Math.cos(a) * w * .36, h / 2 + Math.sin(a) * h * .36, 2, 0, TAU); c.fill(); }
      c.fillStyle = '#8a5c14'; c.beginPath(); c.moveTo(w * .3, h * .62); c.lineTo(w * .3, h * .4); c.lineTo(w * .4, h * .5); c.lineTo(w * .5, h * .34); c.lineTo(w * .6, h * .5); c.lineTo(w * .7, h * .4); c.lineTo(w * .7, h * .62); c.closePath(); c.fill();
    }, { cache: 'coinFace' });
    const coinMat = k.metal('#ffcf55', .2, { map: coinTex, bumpMap: coinTex, bumpScale: 1.2, emissive: k.color('#6a3c00'), emissiveIntensity: .35, envMapIntensity: 1.3 });
    const coin = k.cyl(.075, .075, .014, { seg: 14 });
    const heapH = (x, z) => .34 * Math.max(0, 1 - (x / 1.05) ** 2) ** .6 * Math.max(0, 1 - ((z + .05) / .72) ** 2) ** .5 + .03 * Math.sin(x * 7 + z * 3) * Math.cos(z * 6 - x * 2);
    const heapY = (x, z) => rimY - .02 + heapH(x, z);
    const pileY = (x, z) => .26 * Math.max(0, 1 - ((x - .15) / .95) ** 2 - ((z - D / 2 - .5) / .52) ** 2) ** .8;
    const coins = [], up = new T.Vector3(0, 1, 0), q = new T.Quaternion(), e = new T.Euler();
    const lay = (x, y, z, n, tilt) => {
      const d = n.clone().add(new T.Vector3(k.range(-tilt, tilt), 0, k.range(-tilt, tilt))).normalize();
      q.setFromUnitVectors(up, d).multiply(new T.Quaternion().setFromAxisAngle(up, k.range(0, TAU)));
      e.setFromQuaternion(q); coins.push({ p: [x, y, z], r: [e.x, e.y, e.z] });
    };
    const normalOf = (f, x, z) => new T.Vector3(f(x - .01, z) - f(x + .01, z), .02, f(x, z - .01) - f(x, z + .01)).normalize();
    for (let x = -.96; x <= .96; x += .085) for (let z = -.56; z <= .6; z += .085) {
      const px = x + k.range(-.03, .03), pz = z + k.range(-.03, .03);
      lay(px, heapY(px, pz) + k.range(0, .02), pz, normalOf(heapY, px, pz), .5);
    }
    for (let i = 0; i < 26; i++) { const x = k.range(-.9, .9); lay(x, rimY + .01, D / 2 + k.range(-.02, .04), new T.Vector3(0, .6, 1), .6); }     // over the front lip
    for (let x = -.8; x <= 1.1; x += .085) for (let z = D / 2 + .05; z <= D / 2 + 1.05; z += .085) {
      const px = x + k.range(-.03, .03), pz = z + k.range(-.03, .03), h = pileY(px, pz);
      if (h > .005) lay(px, h + .007, pz, normalOf(pileY, px, pz), .45);
    }
    for (let i = 0; i < 44; i++) { const a = k.range(0, TAU), r = k.range(1.0, 1.35); const x = .15 + Math.cos(a) * r * 1.05, z = D / 2 + .5 + Math.sin(a) * r * .6; if (z > D / 2 + .1 || Math.abs(x) > W / 2 + .12) lay(x, .008, z, up, .05); }
    for (const [sx, sz, n] of [[1.2, .9, 9], [1.4, .62, 6], [1.05, 1.15, 4], [-1.25, .85, 7]]) for (let i = 0; i < n; i++) coins.push({ p: [sx + k.range(-.008, .008), .008 + i * .0145, sz + k.range(-.008, .008)], r: [0, k.range(0, 3), 0] });
    g.add(k.instances(coin, coinMat, coins));
    // under the top layer, more gold (so the gaps glitter too) with a light of its own
    const glowGold = k.metal('#ffd66a', .3, { map: coinTex, emissive: k.color('#ffaa20'), emissiveIntensity: .55 });
    glowGold.map = coinTex.clone(); glowGold.map.wrapS = glowGold.map.wrapT = T.RepeatWrapping; glowGold.map.repeat.set(14, 9);
    k.add(g, gridGeo(k, (x, z) => [x, heapY(x, z) - .03, z], range(-W / 2 + .03, W / 2 - .03, 40), range(-D / 2 + .03, D / 2 - .03, 26)), glowGold, { shadow: false });
    const pxs = range(-.85, 1.15, 40), pzs = range(D / 2, D / 2 + 1.05, 24);
    k.add(g, gridGeo(k, (x, z) => [x, Math.max(.002, pileY(x, z) - .02), z], pxs, pzs, (i, j) => pileY(pxs[i], pzs[j]) > .03 && pileY(pxs[i + 1], pzs[j + 1]) > .03 && pileY(pxs[i + 1], pzs[j]) > .03 && pileY(pxs[i], pzs[j + 1]) > .03), glowGold, { shadow: false });
    // ---- jewels: cut stones scattered through the gold ----
    const kinds = ['ruby', 'emerald', 'sapphire', 'amethyst', 'diamond', 'ruby', 'emerald', 'sapphire', 'topaz'];
    const stones = {}; for (const c of new Set(kinds)) stones[c] = [];
    const placeGem = (x, z, fy, s) => { const kind = k.pick(kinds); stones[kind].push({ p: [x, fy(x, z) + s * .3, z], r: [k.range(.3, .9), k.range(-.6, .6), k.range(-.3, .3)], s }); };
    for (let i = 0; i < 30; i++) placeGem(k.range(-.85, .85), k.range(-.45, .55), heapY, k.range(.07, .13));
    for (let i = 0; i < 12; i++) { const a = k.range(0, TAU), r = Math.sqrt(k.rand()) * .8; placeGem(.15 + Math.cos(a) * r, D / 2 + .5 + Math.sin(a) * r * .45, pileY, k.range(.05, .1)); }
    for (const kind in stones) if (stones[kind].length) g.add(k.instances(brilliant(k, 8), gemMat(k, kind, .45), stones[kind]));
    const bigGems = [['emerald', -.62, .2, .15], ['ruby', .3, .3, .17], ['sapphire', .7, -.1, .14]];
    for (const [kind, x, z, s] of bigGems) k.add(g, brilliant(k, 10), gemMat(k, kind, .5), { p: [x, heapY(x, z) + s * .3, z], r: [-.4, x * 3, .2], s });
    // ---- strings of pearls over the lip, a gold chain, a goblet and a crown on top ----
    const pearls = [];
    const strand = (pts, r = .028) => { const c = curveOf(k, pts), n = Math.round(c.getLength() / (r * 2.1)); for (const p of c.getSpacedPoints(n)) pearls.push({ p: p.toArray(), s: r }); };
    strand([[-.62, heapY(-.62, .2) + .02, .2], [-.58, rimY + .06, D / 2 + .05], [-.5, rimY - .3, D / 2 + .08], [-.3, rimY - .5, D / 2 + .1], [-.05, rimY - .4, D / 2 + .09], [.12, rimY - .1, D / 2 + .07], [.2, rimY + .06, D / 2 + .04], [.3, heapY(.3, .25) + .02, .25]]);
    strand([[-.2, heapY(-.2, .35) + .02, .35], [-.24, rimY + .05, D / 2 + .05], [-.18, rimY - .22, D / 2 + .08], [0, rimY - .3, D / 2 + .09], [.1, rimY - .18, D / 2 + .07], [.14, rimY + .04, D / 2 + .05]], .024);
    strand([[.82, heapY(.82, 0) + .02, 0], [W / 2 + .04, rimY + .05, .05], [W / 2 + .09, rimY - .35, .2], [W / 2 + .1, rimY - .5, .45], [W / 2 + .08, rimY - .2, .55], [W / 2 + .04, rimY + .04, .5], [.8, heapY(.8, .4) + .02, .4]]);
    strand([[-.2, pileY(-.2, D / 2 + .75) + .02, D / 2 + .75], [.1, pileY(.1, D / 2 + .85) + .02, D / 2 + .85], [.4, pileY(.4, D / 2 + .7) + .03, D / 2 + .7], [.6, .02, D / 2 + .95], [.3, .02, D / 2 + 1.1]], .026);
    g.add(k.instances(k.sphere(1, { w: 8, h: 6 }), pearlMat(k), pearls));
    const chainPts = curveOf(k, [[-.8, heapY(-.8, .1) + .02, .1], [-W / 2 - .02, rimY + .05, .35], [-W / 2 - .06, rimY - .35, .55], [-W / 2 - .03, rimY - .55, D / 2 + .03], [-.8, rimY - .3, D / 2 + .08], [-.7, rimY + .03, D / 2 + .05], [-.72, heapY(-.72, .45) + .02, .45]]).getSpacedPoints(70);
    const links = chainPts.slice(0, -1).map((p, i) => { const d = chainPts[i + 1].clone().sub(p).normalize(); q.setFromUnitVectors(new T.Vector3(1, 0, 0), d).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), i % 2 ? Math.PI / 2 : 0)); e.setFromQuaternion(q); return { p: p.toArray(), r: [e.x, e.y, e.z] }; });
    g.add(k.instances(k.torus(.028, .008, { rs: 4, ts: 10 }), au, links));
    const gob = k.group([], { p: [.62, heapY(.62, -.25) - .05, -.25], r: [.1, .4, -.12] }); g.add(gob);
    k.add(gob, k.lathe([[0, 0], [.16, 0], [.17, .03], [.06, .08], [.04, .2], [.07, .24], [.04, .28], [.05, .32], [.16, .4], [.2, .58], [.19, .62], [.17, .6], [0, .52]], { smooth: true, seg: 40 }), au);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; k.add(gob, cabochon(k), gemMat(k, i % 2 ? 'sapphire' : 'ruby', .45), { p: [Math.sin(a) * .185, .5, Math.cos(a) * .185], r: [Math.PI / 2, a, 0], s: [.04, .025, .05] }); }
    const cr = crown(k, .34, { gold: au }); cr.position.set(-.34, heapY(-.34, .12) - .05, .12); cr.rotation.set(.16, .4, .14); g.add(cr);
    // ---- the glow rising out of it ----
    const top = rimY + .3;
    g.add(k.place(halo(k, 1.7, '#ffc84a', .42), { p: [0, top + .45, -.2] }));
    g.add(k.place(halo(k, .7, '#fff0b8', .28), { p: [.15, top - .05, -.1] }));
    const rayTex = k.tex(64, 256, (c, w, h) => { const gr = c.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.beginPath(); c.moveTo(w * .35, h); c.lineTo(w * .65, h); c.lineTo(w, 0); c.lineTo(0, 0); c.fill(); }, { cache: 'treasureRay' });
    const az = k.deg(24), right = new T.Vector3(Math.cos(az), 0, -Math.sin(az));
    [[-.5, 1.7, .5], [-.25, 2.1, .4], [0, 2.3, .6], [.22, 2.0, .45], [.48, 1.6, .5], [-.1, 1.5, .3], [.12, 1.8, .35]].forEach(([ang, len, w2]) => {
      const s = new T.Sprite(new T.SpriteMaterial({ map: rayTex, color: k.color('#ffe08a'), transparent: true, opacity: .28, depthWrite: false, blending: T.AdditiveBlending, rotation: ang }));
      s.scale.set(w2, len, 1);
      s.position.set(0, rimY + .1 + len / 2 * Math.cos(ang), .05).addScaledVector(right, -len / 2 * Math.sin(ang));
      g.add(s);
    });
    glints(k, g, [[-.34, rimY + .78, .1, .45, .3], [.45, rimY + .3, .35, .4, 0], [.62, rimY + .55, -.25, .35, .6], [-.1, .35, D / 2 + .6, .35, .2], [W / 2, rimY - .3, D / 2 + .05, .3, .5],
      [-.62, rimY - .1, D / 2 + .1, .3, .1], [.3, rimY + .38, .3, .28, .4], [-.7, rimY + .3, .15, .26, 0], [.55, .22, D / 2 + .45, .26, .7], [0, rimY - .3, D / 2 + .1, .3, .25]]);
    g.userData.view = { az: 24, el: 18 };
    g.userData.fullView = { el: 16 };
    return g;
  },

  // A priceless Ming vase: blue-and-white porcelain painted with two five-clawed dragons chasing a flaming pearl through
  // the clouds, gilt lines and gilt-bronze mounts, on a carved rosewood stand behind a velvet rope, in a spotlight.
  mingvase(k) {
    const T = k.THREE, g = k.group();
    const SY = .56;                                                       // the stand's top, where the vase sits
    // ---- the profile: foot, a body swelling to broad shoulders, a short neck and a flared lip, then down inside ----
    const prof = [[.4, 0], [.44, .04], [.43, .1], [.38, .16], [.42, .4], [.55, .9], [.7, 1.45], [.8, 1.95], [.8, 2.18], [.7, 2.42], [.46, 2.62], [.3, 2.76],
      [.27, 2.92], [.3, 3.06], [.38, 3.18], [.39, 3.22], [.35, 3.23], [.3, 3.14], [.24, 3.0]];
    const spline = new T.SplineCurve(prof.map(([r, y]) => new T.Vector2(r, y)));
    const pts = spline.getSpacedPoints(150), lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = lens[lens.length - 1];
    // where a height on the outside falls along the profile (0 at the foot, 1 inside the lip)
    const frac = y => { for (let i = 1; i < pts.length; i++) if (pts[i].y >= y) return lens[i] / total; return 1; };
    const porcelain = k.tex(2048, 1536, (c, w, h) => paintMing(c, w, h, frac), { cache: 'mingVase' });
    const gilt = k.tex(64, 1536, (c, w, h) => { c.fillStyle = '#000000'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; for (const yv of MING_RULES) c.fillRect(0, (1 - frac(yv)) * h - 5, w, 10); }, { cache: 'mingGilt', data: true });
    k.add(g, new T.LatheGeometry(pts, 112, Math.PI, TAU), k.ceramic('#ffffff', { map: porcelain, metalness: 1, metalnessMap: gilt, roughness: .14 }), { p: [0, SY, 0] });
    k.add(g, k.disc(.4, 48), k.ceramic('#f4f6fb'), { p: [0, SY + .001, 0], r: [Math.PI / 2, 0, 0] });
    // ---- gilt-bronze mounts: a beaded collar at the lip, a band at the neck, a leafy foot ----
    const au = gold(k, .16), beads = [];
    k.add(g, k.torus(.385, .022, { rs: 10, ts: 96 }), au, { p: [0, SY + 3.2, 0], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.lathe([[.395, 3.08], [.405, 3.1], [.41, 3.16], [.395, 3.19]], { seg: 96 }), au, { p: [0, SY, 0] });
    for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; beads.push({ p: [Math.sin(a) * .41, SY + 3.13, Math.cos(a) * .41], s: .016 }); }
    k.add(g, k.torus(.278, .014, { rs: 8, ts: 80 }), au, { p: [0, SY + 2.78, 0], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.lathe([[.47, 0], [.49, .02], [.47, .06], [.45, .1], [.46, .14], [.44, .16], [0, .16]], { seg: 96 }), au, { p: [0, SY - .02, 0] });
    for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; beads.push({ p: [Math.sin(a) * .485, SY + .03, Math.cos(a) * .485], s: .018 }); }
    g.add(k.instances(k.sphere(1, { w: 8, h: 5 }), au, beads));
    const leaf = k.extrude(k.shape([[-.05, 0], [.05, 0], [.035, .1], [0, .17], [-.035, .1]]), .01, { bevel: .006, bevelSeg: 1 });
    for (let i = 0; i < 16; i++) { const a = (i + .5) / 16 * TAU; k.add(g, leaf, au, { p: [Math.sin(a) * .445, SY + .1, Math.cos(a) * .445], r: [-.18, a, 0], order: 'YXZ' }); }
    // ---- the rosewood stand: a moulded top, a pierced apron, five cabriole legs on a ring ----
    const rose = k.wood('#5c1d10', { varnish: 1, rough: .35 });
    k.add(g, k.lathe([[0, SY - .1], [.62, SY - .1], [.68, SY - .08], [.7, SY - .05], [.69, SY - .02], [.64, SY], [.52, SY], [.5, SY + .02], [0, SY + .02]], { seg: 80 }), rose);
    const apron = k.tex(512, 64, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#000000';
      for (let i = 0; i < 10; i++) { const x = (i + .5) * w / 10; c.beginPath(); c.ellipse(x - 12, h * .5, 9, 14, 0, 0, TAU); c.ellipse(x + 12, h * .5, 9, 14, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(x, h * .35, 8, 0, TAU); c.fill(); }
    }, { data: true, cache: 'mingApron' });
    const apronMat = k.wood('#5c1d10', { varnish: 1, rough: .35 }); apronMat.alphaMap = apron; apronMat.alphaTest = .5; apronMat.side = T.DoubleSide;
    k.add(g, k.cyl(.62, .6, .16, { seg: 80, open: true }), apronMat, { p: [0, SY - .18, 0] });
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU + TAU / 10, P = (r, y) => [Math.sin(a) * r, y, Math.cos(a) * r];
      k.add(g, k.tube([P(.58, SY - .1), P(.66, SY - .22), P(.62, SY - .36), P(.66, .1), P(.74, .05)], .045, { seg: 30, rs: 10, caps: true }), rose);
      k.add(g, k.sphere(.06, { w: 16, h: 10 }), rose, { p: P(.76, .06), s: [1, .8, 1] });
    }
    k.add(g, k.torus(.7, .035, { rs: 10, ts: 80 }), rose, { p: [0, .035, 0], r: [Math.PI / 2, 0, 0] });
    // ---- the velvet rope on two gold stanchions ----
    const redRope = velvet(k, '#9c0c26', '#ff6a86', { map: null });
    for (const sx of [-1, 1]) {
      const px = sx * 1.3, pz = .55;
      k.add(g, k.lathe([[0, 0], [.24, 0], [.25, .02], [.2, .05], [.08, .1], [.045, .14], [.04, .2]], { smooth: true, samples: 24, seg: 32 }), au, { p: [px, 0, pz] });
      k.add(g, k.cyl(.035, .035, 1.2, { seg: 20 }), au, { p: [px, .8, pz] });
      k.add(g, k.lathe([[0, 0], [.06, 0], [.075, .04], [.05, .08], [.09, .16], [.07, .24], [0, .26]], { smooth: true, samples: 24, seg: 24 }), au, { p: [px, 1.38, pz] });
      k.add(g, k.torus(.04, .012, { rs: 6, ts: 20 }), au, { p: [px - sx * .05, 1.32, pz + .02], r: [0, Math.PI / 2, 0] });
    }
    const rope = along(k, [[-1.25, 1.3, .57], [-.9, 1.02, .66], [-.4, .86, .72], [0, .84, .73], [.4, .86, .72], [.9, 1.02, .66], [1.25, 1.3, .57]], 60);
    k.add(g, k.tube(rope, .045, { seg: 90, rs: 10 }), redRope);
    for (const i of [0, rope.length - 1]) k.add(g, k.cyl(.052, .052, .09, { seg: 16 }), au, { p: rope[i], r: [0, 0, (i ? -1 : 1) * .9] });
    // ---- the spotlight: a soft glow behind and a cone of light from above ----
    g.add(k.place(halo(k, 1.9, '#e6eeff', .38), { p: [0, SY + 2.0, -.3] }));
    const beam = k.tex(128, 256, (c, w, h) => {                        // a cone, widening downwards, soft at the sides
      for (let x = 0; x < w; x++) {
        const u = Math.abs(x / w - .5) * 2, edge = t => Math.max(0, 1 - u / (.25 + .75 * t)) ** 1.5, gr = c.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.35, `rgba(255,255,255,${.3 * edge(.35)})`); gr.addColorStop(1, `rgba(255,255,255,${.65 * edge(1)})`);
        c.fillStyle = gr; c.fillRect(x, 0, 1, h);
      }
    }, { cache: 'mingBeam' });
    const sb = new T.Sprite(new T.SpriteMaterial({ map: beam, color: k.color('#fff8e6'), transparent: true, opacity: .22, depthWrite: false, blending: T.AdditiveBlending }));
    sb.scale.set(2.4, 3.2, 1); sb.position.set(0, SY + 2.4, -.2); g.add(sb);
    glints(k, g, [[.36, SY + 2.3, .75, .5, .3], [-.2, SY + 3.21, .33, .35, 0], [.3, SY + .9, .5, .3, .5], [1.3, 1.62, .55, .3, .2]]);
    g.userData.view = { az: 6, el: 9 };
    g.userData.fullView = { el: 9 };
    return g;
  },
};

/* ---------- the crown ---------- */
// A jewelled crown of radius R standing on y = 0: a gold band set with stones and pearls, eight fleur-de-lis and cross
// points, and (o.arches, default true) two pearl-studded arches over a velvet cap with an orb and cross on top.
function crown(k, R = 1, o = {}) {
  const T = k.THREE, g = k.group(), au = o.gold ?? gold(k), H = R * .44;
  k.add(g, k.lathe([[R * .95, 0], [R * 1.05, 0], [R * 1.09, H * .1], [R * 1.05, H * .2], [R * 1.05, H * .8], [R * 1.09, H * .9], [R * 1.05, H], [R * .95, H], [R * .95, 0]], { seg: 64 }), au);
  // stones round the band
  const stones = ['ruby', 'sapphire', 'emerald', 'sapphire'], nS = 8;
  for (let i = 0; i < nS; i++) {
    const a = i / nS * TAU + TAU / 16, m = k.group([], { p: [Math.sin(a) * R * 1.05, H / 2, Math.cos(a) * R * 1.05], r: [0, a, 0] }); g.add(m);
    k.add(m, k.cyl(R * .13, R * .13, R * .04, { seg: 16 }), au, { r: [Math.PI / 2, 0, 0] });
    k.add(m, cabochon(k), gemMat(k, stones[i % 4], .35), { p: [0, 0, R * .02], r: [Math.PI / 2, 0, 0], s: [R * .1, R * .07, R * .12] });
  }
  const pearls = [];
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; for (const y of [H * .1, H * .9]) pearls.push({ p: [Math.sin(a) * R * 1.09, y, Math.cos(a) * R * 1.09], s: R * .04 }); }
  // points: fleurs-de-lis between crosses
  const cross = k.shape([[-.08, 0], [.08, 0], [.06, .2], [.22, .16], [.22, .44], [.06, .4], [.08, .62], [-.08, .62], [-.06, .4], [-.22, .44], [-.22, .16], [-.06, .2]]);
  const fGeo = fleurGeo(k), cGeo = k.extrude(cross, .05, { bevel: .02, bevelSeg: 1 });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, big = i % 2 === 0, m = k.group([], { p: [Math.sin(a) * R * 1.02, H * .96, Math.cos(a) * R * 1.02], r: [0, a, 0], s: R * (big ? .62 : .5) });
    k.add(m, big ? fGeo : cGeo, au);
    if (big) pearls.push({ p: [Math.sin(a) * R * 1.02, H * .96 + R * .62 * .9, Math.cos(a) * R * 1.02], s: R * .06 });
    else k.add(m, brilliant(k, 8), gemMat(k, i % 4 === 1 ? 'emerald' : 'ruby', .4), { p: [0, .3, .06], r: [Math.PI / 2, 0, 0], s: .09 });
    g.add(m);
  }
  if (o.arches !== false) {
    k.add(g, k.lathe([[R * .95, H * .6], [R * .93, H * 1.2], [R * .8, H * 1.9], [R * .5, H * 2.4], [R * .15, H * 2.55], [0, H * 2.56]], { smooth: true, samples: 20, seg: 32 }), velvet(k, '#9e0f2c', '#ff8aa0'));
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + TAU / 8, P = (r, y) => [Math.sin(a) * r, y, Math.cos(a) * r];
      const arc = [P(R * 1.02, H * .95), P(R * 1.02, H * 1.7), P(R * .82, H * 2.45), P(R * .45, H * 2.75), P(R * .12, H * 2.62), P(0, H * 2.55)];
      k.add(g, k.tube(arc, R * .045, { seg: 24, rs: 6 }), au);
      for (const p of along(k, arc, 9).slice(1, -1)) pearls.push({ p: [p[0] * 1.05, p[1] + R * .04, p[2] * 1.05], s: R * .04 });
    }
    k.add(g, k.sphere(R * .16, { w: 20, h: 12 }), au, { p: [0, H * 2.55 + R * .14, 0] });
    k.add(g, k.torus(R * .16, R * .02, { rs: 8, ts: 36 }), au, { p: [0, H * 2.55 + R * .14, 0], r: [Math.PI / 2, 0, 0] });
    const cx = k.group([], { p: [0, H * 2.55 + R * .28, 0], s: R * .55 }); g.add(cx);
    k.add(cx, cGeo, au);
    k.add(cx, brilliant(k, 8), gemMat(k, 'diamond', .2), { p: [0, .3, .06], r: [Math.PI / 2, 0, 0], s: .1 });
  }
  g.add(k.instances(k.sphere(1, { w: 7, h: 4 }), pearlMat(k), pearls));
  return g;
}

// A puffy pillow, w (x) × d (z), t thick in the middle, seamed all round with its corners poking out.
function pillowGeo(k, w, d, t, n = 20) {
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
// A gold tassel hanging down from y = 0: a knob, a bound neck and a skirt of threads, L long.
function tassel(k, L, mat) {
  const g = k.group(), threads = k.tex(64, 16, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#8a6a2a'; for (let x = 0; x < w; x += 4) c.fillRect(x, 0, 1.5, h); }, { cache: 'tasselThreads' });
  const skirt = mat.clone(); skirt.map = threads; skirt.roughness = .35;
  k.add(g, k.torus(L * .05, L * .015, { rs: 5, ts: 10 }), mat, { p: [0, -L * .02, 0] });
  k.add(g, k.sphere(L * .12, { w: 12, h: 8 }), mat, { p: [0, -L * .16, 0] });
  k.add(g, k.lathe([[0, -L], [L * .19, -L], [L * .2, -L * .95], [L * .16, -L * .6], [L * .1, -L * .36], [L * .12, -L * .32], [L * .07, -L * .27], [0, -L * .27]], { seg: 14 }), skirt);
  return g;
}
// A gold fleur-de-lis, standing on y = 0, facing +z, about a unit tall.
function fleurGeo(k) {
  const s = new k.THREE.Shape();
  s.moveTo(0, 0); s.lineTo(.18, 0); s.bezierCurveTo(.2, .12, .42, .12, .46, .3); s.bezierCurveTo(.48, .46, .3, .5, .22, .38);
  s.bezierCurveTo(.2, .3, .14, .3, .1, .36); s.bezierCurveTo(.12, .55, .1, .7, 0, .85);
  s.bezierCurveTo(-.1, .7, -.12, .55, -.1, .36); s.bezierCurveTo(-.14, .3, -.2, .3, -.22, .38); s.bezierCurveTo(-.3, .5, -.48, .46, -.46, .3);
  s.bezierCurveTo(-.42, .12, -.2, .12, -.18, 0); s.closePath();
  return k.extrude(s, .06, { bevel: .025, bevelSeg: 1, curve: 5 });
}

/* ---------- the Ming vase's painting ---------- */
// Heights of the gilt lines between the bands (they're painted gold and made metal).
const MING_RULES = [2.66, 2.14, .64, .18];
// Cobalt blue on white, in bands from the lip down: key fret, plantain leaves, a cloud collar, two dragons chasing a
// flaming pearl through ruyi clouds and wisps of fire, and lotus panels round the foot, with gilt lines between.
// frac(y) gives how far up the profile height y is; the canvas wraps once round the vase with its seam at the back.
function paintMing(c, w, h, frac) {
  const deep = '#0f2466', mid = '#1f45a6', pale = 'rgba(52,98,204,.42)';
  const Y = yv => (1 - frac(yv)) * h, R = mulberryish(1368);
  c.fillStyle = '#f8f9fc'; c.fillRect(0, 0, w, h);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const rule = (yv, heavy = true) => { const y = Y(yv); c.fillStyle = heavy ? '#d9a93c' : deep; c.fillRect(0, y - (heavy ? 5 : 1.5), w, heavy ? 10 : 3); };
  // draw something at three offsets a canvas-width apart, so it wraps round the vase seamlessly
  const wrap = fn => { for (const dx of [-w, 0, w]) { c.save(); c.translate(dx, 0); fn(); c.restore(); } };
  // key fret between two heights
  const fret = (y0, y1) => {
    const top = Y(y1), bot = Y(y0), hh = bot - top, n = Math.round(w / (hh * 1.3)), sw = w / n;
    c.strokeStyle = mid; c.lineWidth = Math.max(2, hh * .1);
    for (let i = 0; i < n; i++) { const x = i * sw, m = hh * .22; c.beginPath(); c.moveTo(x + m, bot - m); c.lineTo(x + m, top + m); c.lineTo(x + sw - m, top + m); c.lineTo(x + sw - m, bot - m * 2.2); c.lineTo(x + sw * .38, bot - m * 2.2); c.lineTo(x + sw * .38, top + m * 2.4); c.stroke(); }
    rule(y0, false); rule(y1, false);
  };
  fret(3.08, 3.17);
  // plantain leaves up the neck
  { const top = Y(3.02), bot = Y(2.68), n = 14, sw = w / n;
    for (let i = 0; i < n; i++) {
      const x = (i + .5) * sw;
      c.beginPath(); c.moveTo(x - sw * .42, bot); c.quadraticCurveTo(x - sw * .5, (top + bot) / 2, x, top); c.quadraticCurveTo(x + sw * .5, (top + bot) / 2, x + sw * .42, bot); c.closePath();
      c.fillStyle = pale; c.fill(); c.strokeStyle = deep; c.lineWidth = 3; c.stroke();
      c.fillStyle = mid; c.beginPath(); c.moveTo(x - 5, bot); c.lineTo(x, top + 14); c.lineTo(x + 5, bot); c.fill();
      c.strokeStyle = mid; c.lineWidth = 2; for (let j = 1; j < 7; j++) { const y = bot - (bot - top) * j / 8, s = (1 - j / 8) * sw * .34; c.beginPath(); c.moveTo(x - s, y + 8); c.lineTo(x, y); c.lineTo(x + s, y + 8); c.stroke(); }
    }
    rule(2.66); }
  // the cloud collar: lobed ruyi lappets hanging from the neck, a white scroll reserved in each
  { const top = Y(2.64), bot = Y(2.2), n = 8, sw = w / n;
    for (let i = 0; i < n; i++) {
      const x = (i + .5) * sw, hw = sw * .46, hh = bot - top;
      c.beginPath(); c.moveTo(x - hw, top);
      c.bezierCurveTo(x - hw, top + hh * .5, x - hw * .7, top + hh * .7, x - hw * .35, top + hh * .72);
      c.bezierCurveTo(x - hw * .5, top + hh * 1.0, x - hw * .08, top + hh * 1.02, x, top + hh);
      c.bezierCurveTo(x + hw * .08, top + hh * 1.02, x + hw * .5, top + hh * 1.0, x + hw * .35, top + hh * .72);
      c.bezierCurveTo(x + hw * .7, top + hh * .7, x + hw, top + hh * .5, x + hw, top); c.closePath();
      c.fillStyle = mid; c.fill(); c.strokeStyle = deep; c.lineWidth = 4; c.stroke();
      c.strokeStyle = '#f8f9fc'; c.lineWidth = 5;
      c.beginPath(); c.arc(x, top + hh * .42, hh * .16, Math.PI * .1, Math.PI * 1.9); c.stroke();
      for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * hw * .5, top + hh * .3, hh * .1, 0, TAU * .8); c.stroke(); c.beginPath(); c.moveTo(x + s * hw * .2, top + hh * .5); c.quadraticCurveTo(x + s * hw * .45, top + hh * .62, x + s * hw * .62, top + hh * .45); c.stroke(); }
    } }
  rule(2.14); rule(2.1, false);
  // the main band: ruyi clouds behind, then the dragon chasing the flaming pearl
  const b0 = Y(2.04), b1 = Y(.72), bh = b1 - b0, midY = (b0 + b1) / 2;
  const cloud = (x, y, s) => {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.beginPath(); c.moveTo(-60, 10); c.bezierCurveTo(-70, -20, -30, -30, -20, -10); c.bezierCurveTo(-18, -40, 20, -42, 22, -12); c.bezierCurveTo(40, -30, 70, -10, 56, 12); c.bezierCurveTo(40, 26, -40, 26, -60, 10); c.closePath();
    c.fillStyle = pale; c.fill(); c.strokeStyle = mid; c.lineWidth = 4 / s; c.stroke();
    c.lineWidth = 3 / s; for (const [cx, cy, r] of [[-38, 2, 12], [2, -8, 14], [38, 2, 11]]) { c.beginPath(); c.arc(cx, cy, r, Math.PI * .2, Math.PI * 1.7); c.stroke(); c.beginPath(); c.arc(cx + 2, cy + 2, r * .45, 0, Math.PI * 1.5); c.stroke(); }
    c.beginPath(); c.moveTo(56, 12); c.bezierCurveTo(90, 20, 110, 5, 130, 18); c.stroke();
    c.restore();
  };
  wrap(() => { for (let i = 0; i < 26; i++) cloud(((i * .137 + .05) % 1) * w + w * (i % 2 ? .02 : 0), b0 + bh * (.1 + ((i * .61) % 1) * .8), 1.0 + (i % 3) * .25); });
  // the dragon's spine: from its tail round the back of the vase to its head at the front, facing the pearl
  // two dragons chasing one flaming pearl: each a coil from its tail round the back to its head at the front
  const cat = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return [0, 1].map(i => .5 * (2 * p1[i] + (p2[i] - p0[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (3 * p1[i] - p0[i] - 3 * p2[i] + p3[i]) * t3)); };
  const flame = (x, y, s, rot) => { c.save(); c.translate(x, y); c.rotate(rot); c.beginPath(); c.moveTo(-s * .5, 0); c.quadraticCurveTo(-s * .4, -s * .9, s * .1, -s * 1.4); c.quadraticCurveTo(0, -s * .7, s * .5, 0); c.closePath(); c.fill(); c.restore(); };
  const dragon = (ctrlUT, faceRight) => {
    const ctrl = ctrlUT.map(([u, t]) => [u * w, b0 + bh * (.1 + .8 * t)]);
    const dense = []; for (let i = 0; i < ctrl.length - 1; i++) for (let j = 0; j < 40; j++) dense.push(cat(ctrl[Math.max(0, i - 1)], ctrl[i], ctrl[i + 1], ctrl[Math.min(ctrl.length - 1, i + 2)], j / 40)); dense.push(ctrl[ctrl.length - 1]);
    const dl = [0]; for (let i = 1; i < dense.length; i++) dl.push(dl[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
    const pathAt = s => { const d = s * dl[dl.length - 1]; let i = 1; while (i < dl.length - 1 && dl[i] < d) i++; const f = (d - dl[i - 1]) / (dl[i] - dl[i - 1] || 1); return [lerp(dense[i - 1][0], dense[i][0], f), lerp(dense[i - 1][1], dense[i][1], f)]; };
    const rad = s => lerp(10, bh * .105, Math.min(1, s * 3) ** .6) * (s > .94 ? .82 : 1);
    const N = 240, sp = [], nr = [];
    for (let i = 0; i <= N; i++) sp.push(pathAt(i / N));
    for (let i = 0; i <= N; i++) { const a2 = sp[Math.max(0, i - 1)], b2 = sp[Math.min(N, i + 1)], dx = b2[0] - a2[0], dy = b2[1] - a2[1], l = Math.hypot(dx, dy) || 1; nr.push([-dy / l, dx / l]); }
    const edge = side => { const out = []; for (let i = 0; i <= N; i++) { const r = rad(i / N); out.push([sp[i][0] + nr[i][0] * r * side, sp[i][1] + nr[i][1] * r * side]); } return out; };
    const leg = (s, side, len) => {
      const i = Math.round(s * N), [x, y] = sp[i], [nx, ny] = nr[i], r = rad(s), dir = -Math.sign(sp[Math.min(N, i + 4)][0] - sp[Math.max(0, i - 4)][0]) || -1;
      const kx = x + nx * side * (r + len * .45) + dir * len * .3, ky = y + ny * side * (r + len * .45), fx = kx + dir * len * .5, fy = ky + ny * side * len * .2 + len * .15;
      for (const [col, extra] of [[deep, 5], [mid, 0]]) {
        c.strokeStyle = col; c.lineWidth = r * .95 + extra; c.beginPath(); c.moveTo(x, y); c.lineTo(kx, ky); c.stroke();
        c.lineWidth = r * .55 + extra; c.beginPath(); c.moveTo(kx, ky); c.lineTo(fx, fy); c.stroke();
      }
      c.strokeStyle = deep; c.lineWidth = 5;                                                        // five talons
      const base = Math.atan2(fy - ky, fx - kx);
      for (let j = 0; j < 5; j++) { const an = base + (j - 2) * .5, L = r * .75; c.beginPath(); c.moveTo(fx, fy); c.quadraticCurveTo(fx + Math.cos(an) * L, fy + Math.sin(an) * L, fx + Math.cos(an + .7 * dir) * L * 1.3, fy + Math.sin(an + .7 * dir) * L * 1.3); c.stroke(); }
      c.fillStyle = mid; for (let j = 0; j < 3; j++) flame(kx - dir * 4, ky - 2, 18 + j * 6, -dir * (1.3 + j * .4));   // flames at the elbow
    };
    wrap(() => {
      for (const s of [.47, .8]) leg(s, -1, bh * .2);                                               // far legs first
      const up = edge(1), dn = edge(-1).reverse();
      c.beginPath(); up.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); dn.forEach(([x, y]) => c.lineTo(x, y)); c.closePath();
      c.fillStyle = mid; c.fill(); c.strokeStyle = deep; c.lineWidth = 5; c.stroke();
      c.save(); c.clip();
      c.strokeStyle = deep; c.lineWidth = 2.4;                                                       // scales
      for (let i = 2; i < N - 8; i += 2) { const r = rad(i / N); for (let q = -2; q <= 2; q++) { const off = q * r * .38 + (i % 4 ? r * .19 : 0), x = sp[i][0] + nr[i][0] * off, y = sp[i][1] + nr[i][1] * off; c.beginPath(); c.arc(x, y, r * .22, 0, Math.PI); c.stroke(); } }
      c.fillStyle = 'rgba(248,249,252,.88)';                                                          // pale belly with its plates
      const belly = edge(-1); c.beginPath(); belly.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
      for (let i = N; i >= 0; i--) { const r = rad(i / N) * .42; c.lineTo(sp[i][0] - nr[i][0] * r, sp[i][1] - nr[i][1] * r); } c.closePath(); c.fill();
      c.strokeStyle = mid; c.lineWidth = 2.2; for (let i = 3; i < N; i += 3) { const r = rad(i / N); c.beginPath(); c.moveTo(sp[i][0] - nr[i][0] * r * .42, sp[i][1] - nr[i][1] * r * .42); c.lineTo(sp[i][0] - nr[i][0] * r, sp[i][1] - nr[i][1] * r); c.stroke(); }
      c.restore();
      c.fillStyle = deep; for (let i = 4; i < N - 12; i += 5) { const r = rad(i / N), [x, y] = sp[i]; c.beginPath(); c.moveTo(x + nr[i][0] * r, y + nr[i][1] * r); c.lineTo(x + nr[i][0] * (r + 15) - (sp[i + 2][0] - x) * 1.2, y + nr[i][1] * (r + 15) - (sp[i + 2][1] - y) * 1.2); c.lineTo(sp[i + 3][0] + nr[i][0] * r, sp[i + 3][1] + nr[i][1] * r); c.fill(); }   // dorsal fins
      c.fillStyle = mid; for (let j = 0; j < 5; j++) flame(sp[2][0], sp[2][1], 26, -1.4 + j * .55);   // a flaming tail tip
      for (const s of [.55, .88]) leg(s, -1, bh * .21);                                              // near legs
      // the head, looking along the band at the pearl
      const [hx, hy] = sp[N], r = rad(1) * 1.3;
      c.save(); c.translate(hx, hy); if (faceRight) c.scale(-1, 1);
      c.fillStyle = mid;
      for (let j = 0; j < 7; j++) flame(r * .9 + j * 3, -r * .2 + (j - 3) * r * .3, r * .9, .9 + j * .15);        // the mane
      c.beginPath(); c.moveTo(r * .9, -r * .9); c.bezierCurveTo(-r * .4, -r * 1.4, -r * 1.6, -r * 1.0, -r * 2.2, -r * .6); c.lineTo(-r * 2.3, -r * .15); c.lineTo(-r * .9, -r * .2);
      c.lineTo(-r * 2.1, r * .4); c.bezierCurveTo(-r * 1.6, r * 1.0, -r * .2, r * 1.1, r * .9, r * .8); c.closePath();
      c.fill(); c.strokeStyle = deep; c.lineWidth = 5; c.stroke();
      c.fillStyle = '#f8f9fc'; for (let j = 0; j < 5; j++) { c.beginPath(); c.moveTo(-r * (1.9 - j * .22), -r * .22); c.lineTo(-r * (1.8 - j * .22), -r * .02); c.lineTo(-r * (1.7 - j * .22), -r * .22); c.fill(); }
      c.fillStyle = '#f8f9fc'; c.beginPath(); c.arc(-r * .55, -r * .72, r * .28, 0, TAU); c.fill(); c.strokeStyle = deep; c.lineWidth = 4; c.stroke();
      c.fillStyle = deep; c.beginPath(); c.arc(-r * .62, -r * .72, r * .13, 0, TAU); c.fill();
      c.strokeStyle = deep; c.lineWidth = 7;                                                              // horns
      for (const [dx, dy] of [[0, 0], [r * .35, r * .15]]) { c.beginPath(); c.moveTo(-r * .2 + dx, -r * 1.05 + dy); c.bezierCurveTo(r * .5 + dx, -r * 1.9 + dy, r * 1.3 + dx, -r * 1.7 + dy, r * 1.7 + dx, -r * 2.2 + dy); c.stroke(); }
      c.lineWidth = 3;                                                                                    // whiskers
      c.beginPath(); c.moveTo(-r * 2.1, -r * .55); c.bezierCurveTo(-r * 2.8, -r * 1.6, -r * 1.6, -r * 2.2, -r * 2.6, -r * 2.8); c.stroke();
      c.beginPath(); c.moveTo(-r * 1.9, r * .5); c.bezierCurveTo(-r * 2.8, r * 1.4, -r * 1.4, r * 1.9, -r * 2.4, r * 2.5); c.stroke();
      c.restore();
    });
    return sp[N];
  };
  // wisps of fire among the clouds
  c.fillStyle = 'rgba(31,69,166,.7)';
  wrap(() => { for (let i = 0; i < 40; i++) flame(R() * w, b0 + bh * (.12 + R() * .76), 14 + R() * 12, R() * TAU); });
  const h1 = dragon([[1.04, .72], [.98, .5], [.91, .26], [.84, .42], [.81, .72], [.7, .88], [.61, .72], [.66, .46], [.6, .3]], false);
  const h2 = dragon([[-.08, .72], [-.02, .5], [.05, .26], [.12, .42], [.15, .72], [.26, .88], [.35, .72], [.3, .46], [.36, .3]], true);
  // the flaming pearl between them
  wrap(() => {
    const px = (h1[0] + h2[0]) / 2, py = (h1[1] + h2[1]) / 2 - bh * .04, pr = bh * .078;
    c.fillStyle = mid; for (let j = 0; j < 9; j++) { const an = j / 9 * TAU; flame(px + Math.cos(an) * pr * .9, py + Math.sin(an) * pr * .9, pr * .7, an + Math.PI / 2); }
    c.fillStyle = '#f8f9fc'; c.beginPath(); c.arc(px, py, pr, 0, TAU); c.fill(); c.strokeStyle = deep; c.lineWidth = 5; c.stroke();
    c.lineWidth = 4; c.beginPath(); for (let an = 0; an < 10; an += .2) { const rr = pr * (1 - an / 11); c.lineTo(px + Math.cos(an) * rr * .8, py + Math.sin(an) * rr * .8); } c.stroke();
  });
  rule(.68, false); rule(.64);
  // lotus panels round the foot
  { const top = Y(.62), bot = Y(.2), n = 16, sw = w / n, hh = bot - top;
    for (let i = 0; i < n; i++) {
      const x = (i + .5) * sw;
      c.beginPath(); c.moveTo(x - sw * .47, bot); c.bezierCurveTo(x - sw * .5, top + hh * .3, x - sw * .2, top + hh * .1, x, top); c.bezierCurveTo(x + sw * .2, top + hh * .1, x + sw * .5, top + hh * .3, x + sw * .47, bot); c.closePath();
      c.fillStyle = pale; c.fill(); c.strokeStyle = deep; c.lineWidth = 4; c.stroke();
      c.beginPath(); c.moveTo(x - sw * .3, bot); c.bezierCurveTo(x - sw * .32, top + hh * .45, x - sw * .1, top + hh * .3, x, top + hh * .22); c.bezierCurveTo(x + sw * .1, top + hh * .3, x + sw * .32, top + hh * .45, x + sw * .3, bot); c.strokeStyle = mid; c.lineWidth = 2.5; c.stroke();
      c.fillStyle = mid; c.beginPath(); c.moveTo(x, top + hh * .4); c.quadraticCurveTo(x + sw * .12, top + hh * .7, x, top + hh * .85); c.quadraticCurveTo(x - sw * .12, top + hh * .7, x, top + hh * .4); c.fill();
    } }
  rule(.18); fret(.07, .16);
  // a little of the heaped-and-piled look: darker specks where the cobalt pooled
  c.fillStyle = 'rgba(10,24,80,.35)'; for (let i = 0; i < 900; i++) { const x = R() * w, y = Y(.72) + R() * (Y(2.66) - Y(.72)); c.fillRect(x, y, 1.5, 1.5); }
  // plain white inside the lip
  c.fillStyle = '#f4f6fb'; c.fillRect(0, 0, w, Y(3.2) - 2);
}
