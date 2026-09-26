// Modelling kit for card art. Every item model is a function (k) => THREE.Object3D built from the pieces here.
// Conventions: the model stands on y = 0 and faces +z (the camera looks from the front, a little to the right and above).
// Units are up to you (the studio scales and frames each model), but keep an item's parts in proportion.
// Geometry helpers are centred like three.js primitives unless noted (lathe and rcyl sit on y = 0).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const toColor = c => c instanceof THREE.Color ? c.clone() : new THREE.Color(c);

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hashString = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

function place(obj, o = {}) {
  if (o.p) obj.position.set(o.p[0] ?? 0, o.p[1] ?? 0, o.p[2] ?? 0);
  if (o.order) obj.rotation.order = o.order;
  if (o.r) obj.rotation.set(o.r[0] ?? 0, o.r[1] ?? 0, o.r[2] ?? 0);
  if (o.s != null) typeof o.s === 'number' ? obj.scale.setScalar(o.s) : obj.scale.set(o.s[0], o.s[1], o.s[2]);
  return obj;
}

// Painted procedural textures are cached by recipe, so a hundred wooden things don't each repaint the grain.
const painted = new Map();
function cachedCanvas(key, w, h, paint) {
  let c = painted.get(key);
  if (!c) { c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); painted.set(key, c); }
  return c;
}

export function createKit() {
  const k = { THREE, TAU, PI: Math.PI };
  k.deg = d => d * Math.PI / 180;
  k.color = toColor;
  k.rand = Math.random;
  k.seed = n => { k.rand = mulberry(typeof n === 'string' ? hashString(n) : n); };
  k.range = (a, b) => a + (b - a) * k.rand();
  k.pick = arr => arr[Math.floor(k.rand() * arr.length)];
  k.v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  k.v2 = (x = 0, y = 0) => new THREE.Vector2(x, y);

  /* ---------- textures ---------- */
  // A canvas texture you paint with 2D canvas calls: paint(ctx, w, h). Colour (sRGB) by default.
  k.tex = (w, h, paint, o = {}) => {
    let c;
    if (o.cache) c = cachedCanvas(o.cache, w, h, paint);
    else { c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); }
    const t = new THREE.CanvasTexture(c);
    if (!o.data) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0] ?? o.repeat, o.repeat[1] ?? o.repeat); }
    return t;
  };
  // Text on a canvas, in the page's fonts (Fredoka, Nunito) or anything system-ish.
  k.text = (g, str, x, y, o = {}) => {
    g.save();
    g.font = `${o.weight ?? 700} ${o.size ?? 32}px ${o.font ?? 'Fredoka, system-ui, sans-serif'}`;
    g.textAlign = o.align ?? 'center'; g.textBaseline = o.baseline ?? 'middle';
    if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = o.strokeWidth ?? 6; g.strokeStyle = o.stroke; g.strokeText(str, x, y); }
    g.fillStyle = o.color ?? '#fff'; g.fillText(str, x, y);
    g.restore();
  };
  // Wood grain, running along the texture's v (height) axis. tone: 'oak' | 'walnut' | 'pine' | 'cherry' | 'maple' | '#hex'.
  const WOODS = { oak: ['#c08a52', '#9a6534'], walnut: ['#6e4428', '#472a17'], pine: ['#e0b77a', '#bf8f52'], cherry: ['#a4553a', '#7a3522'], maple: ['#e6c79a', '#c9a06c'], ebony: ['#2a1d17', '#140d0a'] };
  k.woodTex = (tone = 'oak', o = {}) => {
    const [light, dark] = WOODS[tone] || [tone, toColor(tone).multiplyScalar(.7).getStyle()];
    const R = mulberry(hashString(String(tone) + (o.seed ?? 0)));
    return k.tex(256, 512, (g, w, h) => {
      g.fillStyle = light; g.fillRect(0, 0, w, h);
      const d = toColor(dark);
      for (let i = 0; i < 70; i++) {
        const x0 = R() * w, amp = 4 + R() * 14, freq = .004 + R() * .01, ph = R() * 9, a = .08 + R() * .22, lw = .6 + R() * 2.6;
        g.strokeStyle = `rgba(${d.r * 255 | 0},${d.g * 255 | 0},${d.b * 255 | 0},${a})`; g.lineWidth = lw; g.beginPath();
        for (let y = 0; y <= h; y += 8) { const x = x0 + Math.sin(y * freq + ph) * amp + Math.sin(y * freq * 3.1 + ph * 2) * amp * .3; y ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }
      for (let i = 0; i < 5; i++) { // a few knots
        const x = R() * w, y = R() * h, r = 4 + R() * 9;
        g.strokeStyle = 'rgba(60,30,10,.25)';
        for (let j = 0; j < 4; j++) { g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, r + j * 3, (r + j * 3) * 2.2, 0, 0, TAU); g.stroke(); }
      }
    }, { repeat: o.repeat ?? 1, cache: `wood:${tone}:${o.seed ?? 0}` });
  };
  // A fine fabric weave to multiply a colour by.
  k.weaveTex = (scale = 1) => k.tex(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 4) { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(i, 0, 2, h); g.fillRect(0, i, w, 2); }
    const R = mulberry(7);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${R() * .05})`; g.fillRect(R() * w, R() * h, 2, 2); }
  }, { repeat: 6 * scale, cache: 'weave' });

  /* ---------- materials ---------- */
  // Shiny plastic with a clear coat. o: { rough, coat, coatRough, ...any MeshPhysicalMaterial params }
  k.plastic = (c, o = {}) => { const { rough = .36, coat = .55, coatRough = .28, ...rest } = o; return new THREE.MeshPhysicalMaterial({ color: toColor(c), roughness: rough, clearcoat: coat, clearcoatRoughness: coatRough, ...rest }); };
  k.gloss = (c, o = {}) => k.plastic(c, { rough: .2, coat: 1, coatRough: .06, ...o });          // lacquer, enamel, candy-shiny plastic
  k.matte = (c, rough = .82, o = {}) => new THREE.MeshStandardMaterial({ color: toColor(c), roughness: rough, ...o });
  k.rubber = (c = '#2b2b2e') => k.matte(c, .95);
  k.paper = (c = '#f4efe4') => k.matte(c, .96);
  k.metal = (c = '#c9ced6', rough = .3, o = {}) => new THREE.MeshStandardMaterial({ color: toColor(c), metalness: 1, roughness: rough, ...o });
  k.chrome = () => k.metal('#f4f6fa', .06);
  k.steel = () => k.metal('#b8bec6', .3);                 // brushed stainless
  k.aluminum = () => k.metal('#d5d9de', .38);
  k.iron = () => k.metal('#3b3b3f', .55);                  // cast iron, black steel
  k.brass = () => k.metal('#dcae54', .22);
  k.gold = () => k.metal('#f6c85a', .15);
  k.copper = () => k.metal('#d98458', .24);
  k.ceramic = (c = '#ffffff', o = {}) => new THREE.MeshPhysicalMaterial({ color: toColor(c), roughness: .12, clearcoat: 1, clearcoatRoughness: .05, ...o });
  // Clear glass or clear plastic. Seen-through (it's drawn over the card background), so keep what's behind it simple.
  k.glass = (tint = '#ffffff', o = {}) => new THREE.MeshPhysicalMaterial({ color: toColor(tint), roughness: .04, metalness: 0, transparent: true, opacity: o.opacity ?? .3,
    clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: o.env ?? 1.8, depthWrite: false, side: THREE.DoubleSide, specularIntensity: 1 });
  // Soft cloth: towels, pillows, socks, plush. o: { weave: false } to skip the weave texture, { sheen: '#hex' }
  k.fabric = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: toColor(c), roughness: 1, sheen: 1, sheenRoughness: .5,
    sheenColor: toColor(o.sheen ?? toColor(c).lerp(new THREE.Color('#ffffff'), .5)), map: o.weave === false ? null : k.weaveTex(o.scale ?? 1) });
  k.wood = (tone = 'oak', o = {}) => new THREE.MeshPhysicalMaterial({ map: k.woodTex(tone, o), roughness: o.rough ?? .55, clearcoat: o.varnish ?? 0, clearcoatRoughness: .2 });
  // Lights, LEDs, screens, lava: glows on its own.
  k.glow = (c, intensity = 1.6) => new THREE.MeshStandardMaterial({ color: toColor(c), emissive: toColor(c), emissiveIntensity: intensity, roughness: .5 });
  // A material with a painted canvas map: labels, printed boxes, screens (o.glow makes it light up).
  k.painted = (w, h, paint, o = {}) => {
    const map = k.tex(w, h, paint, o);
    return new THREE.MeshPhysicalMaterial({ map, roughness: o.rough ?? .5, metalness: o.metal ?? 0, clearcoat: o.coat ?? 0, clearcoatRoughness: .15,
      transparent: !!o.transparent, alphaTest: o.transparent ? .01 : 0, side: o.side ?? THREE.FrontSide,
      emissive: o.glow ? new THREE.Color('#ffffff') : new THREE.Color('#000000'), emissiveMap: o.glow ? map : null, emissiveIntensity: o.glow ?? 0 });
  };
  k.mat = params => new THREE.MeshPhysicalMaterial(params);

  /* ---------- geometry ---------- */
  k.box = (w, h, d, r = 0, seg = 3) => r > 0 ? new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - 1e-4)) : new THREE.BoxGeometry(w, h, d);
  // o: { seg, hseg, open, start, len } — start/len in radians; theta = 0 points at +z (the front).
  k.cyl = (rt, rb = rt, h = 1, o = {}) => new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 48, o.hseg ?? 1, o.open ?? false, o.start ?? 0, o.len ?? TAU);
  k.cone = (r, h, seg = 48) => new THREE.ConeGeometry(r, h, seg);
  k.sphere = (r, o = {}) => new THREE.SphereGeometry(r, o.w ?? 48, o.h ?? 32, o.phiStart ?? 0, o.phiLen ?? TAU, o.thetaStart ?? 0, o.thetaLen ?? Math.PI);
  k.capsule = (r, len, seg = 16) => new THREE.CapsuleGeometry(r, len, seg, 32);
  // Ring lying in the xy plane (facing +z): big radius R, tube radius r, optional arc (radians).
  k.torus = (R, r, o = {}) => new THREE.TorusGeometry(R, r, o.rs ?? 20, o.ts ?? 64, o.arc ?? TAU);
  k.plane = (w, h) => new THREE.PlaneGeometry(w, h);
  k.disc = (r, seg = 48) => new THREE.CircleGeometry(r, seg);
  k.ring = (rIn, rOut, seg = 64) => new THREE.RingGeometry(rIn, rOut, seg);
  // A shape spun around the y axis. pts: [[radius, y], ...] from the bottom centre to the top centre.
  // smooth: true runs a spline through the points (bottles, vases, bells); false keeps hard corners.
  k.lathe = (pts, o = {}) => {
    let p = pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
    if (o.smooth) {
      const curve = new THREE.SplineCurve(p);
      p = curve.getPoints(o.samples ?? Math.max(48, pts.length * 12)).map(v => new THREE.Vector2(Math.max(0, v.x), v.y));
    }
    return new THREE.LatheGeometry(p, o.seg ?? 64, o.start ?? 0, o.len ?? TAU);
  };
  // A cylinder with rounded top and bottom edges, standing on y = 0. bevel is the edge radius.
  k.rcyl = (r, h, bevel = r * .15, o = {}) => {
    const b = Math.min(bevel, r * .99, h / 2 - 1e-4), pts = [[0, 0]];
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * Math.PI / 2; pts.push([r - b + Math.cos(a) * b, b + Math.sin(a) * b]); }
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; pts.push([r - b + Math.cos(a) * b, h - b + Math.sin(a) * b]); }
    pts.push([0, h]);
    return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), o.seg ?? 64);
  };
  // A tube along a smooth path. pts: [[x, y, z], ...]. o: { seg, rs, closed, tension, caps }
  k.tube = (pts, r, o = {}) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q)), !!o.closed, 'catmullrom', o.tension ?? .5);
    const geo = new THREE.TubeGeometry(curve, o.seg ?? 64, r, o.rs ?? 16, !!o.closed);
    if (!o.caps || o.closed) return geo;
    const a = new THREE.SphereGeometry(r, 16, 12); a.translate(...pts[0]);
    const b = new THREE.SphereGeometry(r, 16, 12); b.translate(...pts[pts.length - 1]);
    return mergeGeometries([geo.toNonIndexed(), a.toNonIndexed(), b.toNonIndexed()]);
  };
  // 2D shapes for extrude(). pts: [[x, y], ...]
  k.shape = pts => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; };
  k.roundRect = (w, h, r) => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2);
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  };
  k.circle = (r, cx = 0, cy = 0) => { const s = new THREE.Shape(); s.absarc(cx, cy, r, 0, TAU, false); return s; };
  // Push a shape out along z, centred on z = 0. o: { bevel, bevelSeg, curve, holes: [Shape|Path] }
  k.extrude = (shape, depth, o = {}) => {
    if (o.holes) shape.holes.push(...o.holes);
    const bevel = o.bevel ?? Math.min(depth * .2, .05);
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: o.bevelSize ?? bevel, bevelSegments: o.bevelSeg ?? 3, curveSegments: o.curve ?? 32, steps: o.steps ?? 1 });
    g.translate(0, 0, -depth / 2);
    return g;
  };
  // A flat rounded slab (phone, remote, board, frame), w × h in xy, thickness d along z.
  k.slab = (w, h, d, r = Math.min(w, h) * .1, bevel = d * .25) => k.extrude(k.roundRect(w - bevel * 2, h - bevel * 2, Math.max(1e-3, r - bevel)), Math.max(1e-3, d - bevel * 2), { bevel });
  k.merge = geos => mergeGeometries(geos.map(g => g.index ? g.toNonIndexed() : g));

  /* ---------- building ---------- */
  // Mesh with placement: o = { p: [x,y,z], r: [x,y,z] radians, s: n | [x,y,z], shadow: true }
  k.mesh = (geo, mat, o = {}) => { const m = new THREE.Mesh(geo, mat); place(m, o); m.castShadow = o.shadow ?? true; m.receiveShadow = true; return m; };
  k.group = (children = [], o = {}) => { const g = new THREE.Group(); for (const c of children) if (c) g.add(c); return place(g, o); };
  k.add = (parent, geo, mat, o) => { const m = k.mesh(geo, mat, o); parent.add(m); return m; };
  k.place = place;
  // The same geometry many times: list of { p, r, s, color }.
  k.instances = (geo, mat, list) => {
    const m = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
    list.forEach((it, i) => { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); place(o, it); o.updateMatrix(); m.setMatrixAt(i, o.matrix); if (it.color) m.setColorAt(i, toColor(it.color)); });
    m.castShadow = m.receiveShadow = true; return m;
  };
  // A flat printed sticker/label: a plane with a painted texture, nudged off the surface it sits on.
  k.decal = (w, h, paint, o = {}) => {
    const px = o.px ?? 256, ph = Math.max(8, Math.round(px * h / w));
    const mat = k.painted(px, ph, paint, { transparent: true, rough: o.rough ?? .45, coat: o.coat ?? 0, glow: o.glow });
    mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2;
    return k.mesh(k.plane(w, h), mat, { ...o, shadow: false });
  };

  /* ---------- common parts ---------- */
  // A round knob with a pointer line, standing on y = 0 (rotate it onto a face).
  k.knob = (r, h, mat, lineMat = k.matte('#ffffff', .5)) => k.group([
    k.mesh(k.rcyl(r, h, r * .25), mat),
    k.mesh(k.box(r * .18, h * .08, r * .8), lineMat, { p: [0, h + h * .02, r * .35] }),
  ]);
  // A power cord from a list of points (ends are rounded).
  k.cord = (pts, r = .02, c = '#1d1d20') => k.mesh(k.tube(pts, r, { caps: true, seg: Math.max(32, pts.length * 16), rs: 10 }), k.rubber(c));
  // Little rubber feet under an appliance: list of [x, z], height h.
  k.feet = (spots, r, h, mat = k.rubber()) => k.group(spots.map(([x, z]) => k.mesh(k.rcyl(r, h, r * .3, { seg: 24 }), mat, { p: [x, 0, z] })));
  return k;
}

// Frees everything a model made (geometry, materials, their textures).
export function disposeObject(root) {
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) { for (const key of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'bumpMap']) m[key]?.dispose?.(); m.dispose(); }
  });
}
