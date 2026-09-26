// Outer Space models: orbit. Things that go round up there, and one that listens to them from the backyard: a satellite
// dish, a student CubeSat, a weather satellite, Sputnik, a Voyager-style deep space probe and a solar sail.
// Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
// A small seeded random source for painting. Painted canvases are cached between renders, so painting mustn't use up
// the model's own k.rand() (the geometry would come out different the second time).
const rng = seed => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rgbOf = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const mixRGB = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// Compute normals, then average them between vertices that share a position (lathe and sphere seams, poles).
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
// A surface from fn(u, v) => [x, y, z] over the unit square. Faces point along (d/du × d/dv). o.uv(u, v) => [s, t].
function surface(k, fn, nu, nv, o = {}) {
  const T = k.THREE, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const u = i / nu, v = j / nv; pos.push(...fn(u, v)); uv.push(...(o.uv ? o.uv(u, v) : [u, v])); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return weld(geo);
}
// Sweep a closed profile ([x, y] points, counter-clockwise) along a curve, the profile's y held along `up` (squared
// off against the curve), with flat caps on both ends. For arms and brackets with a squarish section.
function sweep(k, curve, prof, o = {}) {
  const T = k.THREE, seg = o.seg ?? 48, n = prof.length, up = new T.Vector3(...(o.up ?? [1, 0, 0]));
  const pos = [], idx = [], P = new T.Vector3(), D = new T.Vector3(), X = new T.Vector3(), Y = new T.Vector3(), ends = [];
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, P); curve.getTangentAt(i / seg, D);
    Y.copy(up).addScaledVector(D, -up.dot(D)).normalize(); X.crossVectors(Y, D).normalize();
    const ring = prof.map(([px, py]) => [P.x + X.x * px + Y.x * py, P.y + X.y * px + Y.y * py, P.z + X.z * px + Y.z * py]);
    for (const q of ring) pos.push(...q);
    if (i === 0 || i === seg) ends.push({ ring, c: P.toArray() });
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < n; j++) { const a = i * n + j, b = i * n + (j + 1) % n, c = a + n, d = b + n; idx.push(a, b, c, b, d, c); }
  ends.forEach(({ ring, c }, e) => {
    const base = pos.length / 3; pos.push(...c); for (const q of ring) pos.push(...q);
    for (let j = 0; j < n; j++) { const a = base + 1 + j, b = base + 1 + (j + 1) % n; e ? idx.push(base, a, b) : idx.push(base, b, a); }
  });
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// Turn obj so its local +y runs along d, with its local +z leaning toward w.
function orient(k, obj, d, w = [0, 1, 0]) {
  const T = k.THREE, Y = new T.Vector3(...d).normalize(), W = new T.Vector3(...w);
  const Z = W.clone().addScaledVector(Y, -W.dot(Y));
  if (Z.lengthSq() < 1e-8) Z.set(1, 0, 0).addScaledVector(Y, -Y.x);
  Z.normalize();
  const X = new T.Vector3().crossVectors(Y, Z);
  obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z));
  return obj;
}
// Turn obj so its local +x runs along X and its local +y leans toward Y.
function aimX(k, obj, X, Y = [0, 1, 0]) {
  const T = k.THREE, x = new T.Vector3(...X).normalize(), y = new T.Vector3(...Y);
  y.addScaledVector(x, -y.dot(x)).normalize();
  obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, new T.Vector3().crossVectors(x, y)));
  return obj;
}
// A cylinder from a to b; r is one radius or [radius at a, radius at b].
function rod(k, a, b, r, mat, o = {}) {
  const T = k.THREE, A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A);
  const [r0, r1] = Array.isArray(r) ? r : [r, r];
  const m = k.mesh(k.cyl(r1, r0, d.length(), { seg: o.seg ?? 16 }), mat, { shadow: o.shadow });
  m.position.copy(A).addScaledVector(d, .5);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  return m;
}
// A thin lattice boom from a to b: three longerons w apart and a zigzag of braces, merged into one mesh.
function truss(k, a, b, w, bays, r, mat) {
  const T = k.THREE, A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length(); d.normalize();
  const hint = Math.abs(d.y) < .9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0);
  const e1 = hint.addScaledVector(d, -hint.dot(d)).normalize(), e2 = new T.Vector3().crossVectors(d, e1), R0 = w / Math.sqrt(3);
  const at = (j, t) => { const q = j / 3 * TAU; return A.clone().addScaledVector(d, t * L).addScaledVector(e1, Math.cos(q) * R0).addScaledVector(e2, Math.sin(q) * R0); };
  const bar = (p, q, rr) => {
    const dd = q.clone().sub(p), geo = new T.CylinderGeometry(rr, rr, dd.length(), 6, 1);
    geo.applyMatrix4(new T.Matrix4().compose(p.clone().addScaledVector(dd, .5), new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dd.clone().normalize()), new T.Vector3(1, 1, 1)));
    return geo;
  };
  const geos = [];
  for (let j = 0; j < 3; j++) geos.push(bar(at(j, 0), at(j, 1), r));
  for (let i = 0; i < bays; i++) for (let j = 0; j < 3; j++) geos.push(bar(at(j, i / bays), at((j + 1) % 3, (i + 1) / bays), r * .6));
  return k.mesh(k.merge(geos), mat);
}
// A soft glow around a light: a sprite that always faces the camera (sprites don't count when the studio frames a model).
function halo(k, r, color, opacity = .5) {
  const T = k.THREE, tex = k.tex(128, 128, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.22, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, { cache: 'orbit-halo' });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k.color(color), transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }));
  s.scale.set(r * 2, r * 2, 1);
  return s;
}
// A four-pointed twinkle, drawn over everything.
function sparkle(k, size, rot = 0, color = '#fff6e0') {
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
  }, { cache: 'orbit-sparkle' });
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: k.color(color), transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending, rotation: rot }));
  s.scale.set(size, size, 1);
  return s;
}

/* ---------- painted surfaces ---------- */
// Crinkled foil (multi-layer insulation), crumpled along random fold lines: each fold tips the film one way on one side of
// its crease and the other way on the other, and where folds cross they leave facets. Returns { map, normal }: a gold
// (or silver) map with faint creases and a soft mottle, and the normal map that tips the facets so each catches the
// light differently. Not tileable: meant to cover one face with repeat 1.
function foilMaps(k, o = {}) {
  const S = o.px ?? 256, seed = o.seed ?? 5, tone = o.tone ?? 'gold', nF = o.folds ?? 38, key = `orbit-foil:${tone}:${seed}:${S}:${nF}`;
  const TONES = { gold: ['#ffe7a0', '#f1c152', '#d1952f', '#9a6216'], silver: ['#ffffff', '#e4e8ee', '#b6bdc7', '#7a818c'] };
  const [c0, c1, c2, c3] = TONES[tone].map(rgbOf);
  const R = rng(seed), folds = [];
  for (let i = 0; i < nF; i++) {
    const a = R() * Math.PI, big = i < 8;
    folds.push({ cx: R(), cy: R(), nx: Math.cos(a), ny: Math.sin(a), len: big ? 1.4 : .18 + R() * .5, amp: (big ? .1 + R() * .12 : .06 + R() * .2) * (R() < .5 ? -1 : 1) });
  }
  const blots = []; for (let i = 0; i < 9; i++) blots.push([R(), R(), .15 + R() * .3, R() * 2 - 1]);
  const field = (u, v) => {
    let gx = 0, gy = 0, crease = 0;
    for (const f of folds) {
      const dx = u - f.cx, dy = v - f.cy, dn = dx * f.nx + dy * f.ny, dt = Math.abs(-dx * f.ny + dy * f.nx);
      const w = 1 - smooth(f.len * .35, f.len * .5, dt);
      if (w <= 0) continue;
      const sg = Math.tanh(dn / .004) * w;
      gx += f.amp * sg * f.nx; gy += f.amp * sg * f.ny;
      crease = Math.max(crease, w * Math.abs(f.amp) * 5 * (1 - smooth(0, .006, Math.abs(dn))));
    }
    return [gx, gy, Math.min(1, crease)];
  };
  const paint = normal => (c, w, h) => {
    const img = c.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = (x + .5) / w, v = (y + .5) / h, [gx, gy, cr] = field(u, v), i4 = (y * w + x) * 4;
      if (normal) {
        const l = Math.hypot(gx, gy, 1);
        d[i4] = (-gx / l * .5 + .5) * 255; d[i4 + 1] = (gy / l * .5 + .5) * 255; d[i4 + 2] = (1 / l * .5 + .5) * 255;
      } else {
        let t = .66 + (gx * .9 - gy * .5) * .9 - cr * .22;
        for (const [bx, by, br, bv] of blots) t += bv * .12 * Math.max(0, 1 - Math.hypot(u - bx, v - by) / br);
        t = clamp01(t);
        const col = t < .3 ? mixRGB(c3, c2, t / .3) : t < .72 ? mixRGB(c2, c1, (t - .3) / .42) : mixRGB(c1, c0, (t - .72) / .28);
        d[i4] = col[0]; d[i4 + 1] = col[1]; d[i4 + 2] = col[2];
      }
      d[i4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  };
  return { map: k.tex(S, S, paint(false), { cache: key }), normal: k.tex(S, S, paint(true), { cache: key + ':n', data: true }) };
}
const foilMat = (k, o = {}) => {
  const f = foilMaps(k, o);
  return k.metal('#ffffff', o.rough ?? .22, { map: f.map, normalMap: f.normal, normalScale: new k.THREE.Vector2(o.bump ?? 1.4, o.bump ?? 1.4), envMapIntensity: o.env ?? 1.3 });
};

// A solar array's face: cols × rows dark blue cells between silver strips, on a panel `aspect` times as tall as wide.
// The data map carries roughness (G) and metalness (B), so the cells are glassy and the strips metal.
function solarMat(k, cols, rows, aspect, o = {}) {
  const W = o.px ?? 512, H = Math.round(W * aspect), key = `orbit-solar:${cols}:${rows}:${W}:${H}`;
  const paint = data => (c, w, h) => {
    const R = rng(cols * 31 + rows * 7), edge = w * .03, gap = Math.max(2, w * .01);
    const cw = (w - edge * 2 - gap * (cols - 1)) / cols, ch = (h - edge * 2 - gap * (rows - 1)) / rows;
    c.fillStyle = data ? 'rgb(0,80,255)' : '#cdd2d9'; c.fillRect(0, 0, w, h);
    if (!data) { c.fillStyle = '#9aa3af'; c.fillRect(edge * .55, edge * .55, w - edge * 1.1, h - edge * 1.1); }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = edge + i * (cw + gap), y = edge + j * (ch + gap);
      if (data) { c.fillStyle = 'rgb(0,34,30)'; c.fillRect(x, y, cw, ch); continue; }
      const t = R() * .1, gr = c.createLinearGradient(x, y, x + cw, y + ch);
      gr.addColorStop(0, `rgb(${40 + t * 60 | 0},${78 + t * 80 | 0},${178 + t * 50 | 0})`); gr.addColorStop(1, `rgb(${16 + t * 40 | 0},${38 + t * 50 | 0},${112 + t * 50 | 0})`);
      c.fillStyle = gr; c.fillRect(x, y, cw, ch);
      c.fillStyle = 'rgba(160,185,240,.16)'; for (let yy = y + 2; yy < y + ch; yy += 3.5) c.fillRect(x, yy, cw, 1);
      c.fillStyle = 'rgba(215,222,236,.6)'; for (const f of [.28, .72]) c.fillRect(x + cw * f - 1, y, 2, ch);
    }
  };
  const map = k.tex(W, H, paint(false), { cache: key }), data = k.tex(W, H, paint(true), { cache: key + ':d', data: true });
  return k.mat({ map, roughnessMap: data, metalnessMap: data, roughness: 1, metalness: 1, clearcoat: .7, clearcoatRoughness: .08,
    iridescence: o.irid ?? .35, iridescenceIOR: 1.5, iridescenceThicknessRange: [300, 520], envMapIntensity: 1.2 });
}

// A CubeSat side: a black circuit board carrying solar cells (dark blue, with the clipped corners of the real ones), silver
// tabs, gold pads and white printing. kind: 'cells' (two cells), 'front' (one cell, with room on the right for the camera
// and the status light), 'top' (the antenna board). o.label: the panel's printed name. o.tall: the face is that many cubes tall.
function cubeFaceMat(k, kind, o = {}) {
  const tall = o.tall ?? 1, W = 256, H = 256 * tall, key = `orbit-cube2:${kind}:${o.label ?? ''}:${tall}`;
  const paint = data => (c, w, h) => {
    const pcb = data ? 'rgb(0,110,0)' : '#16181d', silk = data ? 'rgb(0,150,0)' : 'rgba(236,238,242,.9)';
    const tab = data ? 'rgb(0,70,255)' : '#cfd4db', pad = data ? 'rgb(0,60,255)' : '#dcae44';
    c.fillStyle = pcb; c.fillRect(0, 0, w, h);
    const cell = (x, y, cw, ch, flip) => {
      const cut = cw * .2;
      c.beginPath();
      if (!flip) { c.moveTo(x + cut, y); c.lineTo(x + cw - cut, y); c.lineTo(x + cw, y + cut); c.lineTo(x + cw, y + ch); c.lineTo(x, y + ch); c.lineTo(x, y + cut); }
      else { c.moveTo(x, y); c.lineTo(x + cw, y); c.lineTo(x + cw, y + ch - cut); c.lineTo(x + cw - cut, y + ch); c.lineTo(x + cut, y + ch); c.lineTo(x, y + ch - cut); }
      c.closePath();
      if (data) { c.fillStyle = 'rgb(0,26,60)'; c.fill(); }
      else {
        const gr = c.createLinearGradient(x, y, x + cw, y + ch);
        gr.addColorStop(0, '#4a5cc4'); gr.addColorStop(.5, '#26338c'); gr.addColorStop(1, '#3645aa');
        c.fillStyle = gr; c.fill();
        c.save(); c.clip(); c.fillStyle = 'rgba(150,170,240,.14)'; for (let yy = y + 3; yy < y + ch; yy += 4) c.fillRect(x, yy, cw, 1); c.restore();
      }
      c.fillStyle = tab; c.fillRect(x + cut, flip ? y + ch - 5 : y + 2, cw - cut * 2, 3);
    };
    const mx = w * .07, my = h * .05 / tall;
    if (kind === 'cells' || kind === 'front') {
      for (let s = 0; s < tall; s++) {
        const y0 = s * h / tall + my, ch = h / tall - my * 2 - (s === tall - 1 ? h * .06 / tall : 0);
        if (kind === 'cells') { const cw = (w - mx * 2 - w * .04) / 2; cell(mx, y0, cw, ch, false); cell(mx + cw + w * .04, y0, cw, ch, true); }
        else cell(mx, y0, (w - mx * 2 - w * .04) / 2, ch, false);
      }
      c.fillStyle = pad; for (const x of [w * .04, w * .96]) c.fillRect(x - 3, h - 9, 6, 6);
      if (o.label) { c.fillStyle = silk; c.font = '700 13px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(o.label, w / 2, h - 3); }
    }
    if (kind === 'front') {
      const x0 = w * .55, x1 = w * .93;
      c.strokeStyle = silk; c.lineWidth = 2;
      c.beginPath(); c.arc(w * .738, h * .375, w * .12, 0, TAU); c.stroke();                   // where the lens goes
      c.strokeRect(x0, h * .68, x1 - x0, h * .2);
      c.fillStyle = silk; c.font = '700 14px Nunito, system-ui, sans-serif'; c.textAlign = 'center';
      c.fillText('CAM-1', w * .74, h * .6); c.fillText('STATUS', w * .74, h * .93);
      // a little student-made insignia: a star in a ring
      c.beginPath(); c.arc(w * .62, h * .12, w * .045, 0, TAU); c.stroke();
      c.beginPath(); for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? w * .014 : w * .034; c.lineTo(w * .62 + Math.cos(a) * r, h * .12 + Math.sin(a) * r); } c.fill();
      c.fillStyle = pad; for (let i = 0; i < 5; i++) c.fillRect(w * .78 + i * 8, h * .09, 5, 9);
    }
    if (kind === 'top') {
      c.fillStyle = pad;
      for (const [x, y, rw, rh] of [[.5, .04, .22, .06], [.5, .96, .22, .06], [.04, .5, .06, .22], [.96, .5, .06, .22]]) c.fillRect((x - rw / 2) * w, (y - rh / 2) * h, rw * w, rh * h);
      c.strokeStyle = silk; c.lineWidth = 2; c.strokeRect(w * .3, h * .3, w * .4, h * .4);
      c.fillStyle = silk; c.font = '700 13px Nunito, system-ui, sans-serif'; c.textAlign = 'center';
      c.fillText('UHF', w * .5, h * .2); c.fillText('VHF', w * .5, h * .86);
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 3 ? silk : pad; c.fillRect(w * (.16 + i * .025), h * .76, 4, 7); }
    }
  };
  const map = k.tex(W, H, paint(false), { cache: key }), data = k.tex(W, H, paint(true), { cache: key + ':d', data: true });
  return k.mat({ map, roughnessMap: data, metalnessMap: data, roughness: 1, metalness: 1, clearcoat: .6, clearcoatRoughness: .1,
    iridescence: .45, iridescenceIOR: 1.5, iridescenceThicknessRange: [300, 520] });
}

export default {
  // A backyard TV dish: a white oval reflector tipped up at the sky on a steel mast and bracket, a curved arm holding
  // the feed horn out in front, and the black cable running down the pole and off across the ground.
  dish(k) {
    const T = k.THREE, g = k.group(), s = k.group([], { r: [0, -.14, 0] }); g.add(s);
    const white = k.plastic('#f1f2f4', { rough: .45, coat: .3, coatRough: .3 });
    const galv = k.metal('#c3c9d0', .36), grey = k.plastic('#d8dbe0', { rough: .45, coat: .3 }), dark = k.plastic('#2f333a', { rough: .5, coat: .25 });
    const A = 1, B = 1.08, D = .27, TH = .03;            // the reflector's half-width, half-height, depth and thickness
    const Y0 = 2.0, ZD = .1, ZM = -.36, tilt = k.deg(17); // its centre, where the mast stands, how far it's tipped back
    const dg = k.group([], { p: [0, Y0, ZD], r: [-tilt, 0, 0] }); s.add(dg);
    // the reflector: a shallow oval dish, concave face forward, with a rolled rim and a little sticker low on the face
    const faceMap = k.tex(512, 512, (c, w, h) => {
      c.fillStyle = '#eef0f3'; c.fillRect(0, 0, w, h);
      // a soft shadow pooled in the bottom of the bowl, and two rings pressed into the steel
      const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * .5);
      gr.addColorStop(0, 'rgba(140,148,164,.34)'); gr.addColorStop(.65, 'rgba(160,168,182,.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (const q of [.27, .43]) {
        c.strokeStyle = 'rgba(112,120,136,.38)'; c.lineWidth = 4; c.beginPath(); c.arc(w / 2, h / 2, w * q, 0, TAU); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 3; c.beginPath(); c.arc(w / 2, h / 2, w * q + 4, 0, TAU); c.stroke();
      }
      const x = w * .5, y = h * .79, r = w * .072;
      c.fillStyle = '#1f5fd6'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = r * .1; c.beginPath(); c.arc(x, y, r * .84, 0, TAU); c.stroke();
      c.strokeStyle = '#ffa31a'; c.lineCap = 'round'; c.lineWidth = r * .15;
      for (const q of [.32, .55, .78]) { c.beginPath(); c.arc(x - r * .32, y + r * .32, r * q, -Math.PI / 2, 0); c.stroke(); }
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x - r * .32, y + r * .32, r * .12, 0, TAU); c.fill();
    }, { cache: 'orbit-dish-face-2' });
    const face = k.plastic('#ffffff', { map: faceMap, rough: .42, coat: .3, coatRough: .3 });
    const rp = (u, a) => [A * u * Math.cos(a), B * u * Math.sin(a), D * u * u];
    dg.add(k.mesh(surface(k, (u, v) => rp(u, v * TAU), 24, 96, { uv: (u, v) => [.5 + .5 * u * Math.cos(v * TAU), .5 + .5 * u * Math.sin(v * TAU)] }), face));
    dg.add(k.mesh(surface(k, (u, v) => { const q = rp(v, u * TAU); q[2] -= TH; return q; }, 96, 24), white));
    const rim = []; for (let i = 0; i < 120; i++) { const a = i / 120 * TAU; rim.push([A * Math.cos(a), B * Math.sin(a), D - TH / 2]); }
    dg.add(k.mesh(k.tube(rim, .03, { closed: true, seg: 240, rs: 12 }), white));
    // the backing plate, and two cheek plates reaching back to the collar on the mast
    k.add(dg, k.box(.46, .52, .06, .02), grey, { p: [0, -.04, -TH - .03] });
    dg.updateMatrix();
    const inv = dg.matrix.clone().invert(), toDish = v => new T.Vector3(...v).applyMatrix4(inv), toS = v => new T.Vector3(...v).applyMatrix4(dg.matrix);
    const col = toDish([0, Y0 - .02, ZM]);
    for (const sx of [-1, 1]) {
      const a = new T.Vector3(sx * .15, -.04, -.1), b = new T.Vector3(sx * .15, col.y, col.z), d = b.clone().sub(a);
      const plate = k.mesh(k.box(.028, d.length(), .26, .012), galv); plate.position.copy(a).addScaledVector(d, .5); orient(k, plate, d.toArray()); dg.add(plate);
      for (const t of [.25, .92]) k.add(dg, k.cyl(.035, .035, .03, { seg: 6 }), galv, { p: a.clone().addScaledVector(d, t).add(new T.Vector3(sx * .025, 0, 0)).toArray(), r: [0, 0, Math.PI / 2] });
    }
    // the mast: a galvanised pole in a collar, on a square foot plate with gussets and bolts
    k.add(s, k.cyl(.062, .062, Y0 + .26, { seg: 24 }), galv, { p: [0, (Y0 + .26) / 2, ZM] });
    k.add(s, k.sphere(.066, { w: 20, h: 10, thetaLen: Math.PI / 2 }), galv, { p: [0, Y0 + .26, ZM] });
    k.add(s, k.cyl(.085, .085, .44, { seg: 28 }), galv, { p: [0, Y0 - .02, ZM] });
    k.add(s, k.box(.3, .14, .22, .02), galv, { p: [0, Y0 - .02, ZM] });
    dg.add(rod(k, [-.19, col.y, col.z], [.19, col.y, col.z], .022, galv));
    k.add(s, k.box(.8, .05, .8, .015), galv, { p: [0, .025, ZM] });
    k.add(s, k.cyl(.085, .09, .26, { seg: 28 }), galv, { p: [0, .05 + .13, ZM] });
    const gus = k.extrude(k.shape([[0, 0], [.26, 0], [0, .24]]), .02, { bevel: .004 });
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; k.add(s, gus, galv, { p: [Math.sin(a) * .08, .05, ZM + Math.cos(a) * .08], r: [0, a - Math.PI / 2, 0] }); }
    s.add(k.instances(k.cyl(.03, .03, .025, { seg: 6 }), galv, [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => ({ p: [x * .31, .062, ZM + z * .31] }))));
    // the feed arm: out from behind the dish, down round the rim and up in front, holding the LNB at the focus
    const arm = new T.CatmullRomCurve3([[0, -.3, -.1], [0, -.75, -.11], [0, -1.12, -.03], [0, -1.24, .26], [0, -1.17, .62], [0, -.94, .92], [0, -.68, 1.07]].map(q => new T.Vector3(...q)));
    const prof = k.roundRect(.06, .095, .02).getPoints(3).map(v => [v.x, v.y]); if (prof.length > 1 && Math.hypot(prof[0][0] - prof.at(-1)[0], prof[0][1] - prof.at(-1)[1]) < 1e-6) prof.pop();
    dg.add(k.mesh(sweep(k, arm, prof, { seg: 64, up: [1, 0, 0] }), white));
    const end = arm.getPointAt(1), tip = end.clone().add(arm.getTangentAt(1).multiplyScalar(.06));
    const lnb = k.group([], { p: tip.toArray() }); dg.add(lnb);
    orient(k, lnb, new T.Vector3(0, 0, .04).sub(tip).toArray(), [0, 1, 0]);
    k.add(lnb, k.cyl(.105, .105, .1, { seg: 28 }), grey);                                         // the holder
    k.add(lnb, k.cyl(.095, .075, .22, { seg: 28 }), dark, { p: [0, .12, 0] });                     // the feed horn
    k.add(lnb, k.sphere(.096, { w: 28, h: 14, thetaLen: Math.PI / 2 }), k.plastic('#3a3f48', { rough: .35, coat: .6 }), { p: [0, .23, 0], s: [1, .35, 1] });
    k.add(lnb, k.box(.17, .24, .15, .04), grey, { p: [0, -.16, -.01] });                           // the LNB's body
    k.add(lnb, k.cyl(.026, .026, .09, { seg: 16 }), k.metal('#d8c27a', .3), { p: [0, -.2, -.12], r: [Math.PI / 2, 0, 0] });
    // the cable: from the LNB, along under the arm, down the mast and off across the ground
    lnb.updateMatrix();
    const inArm = [];
    for (let i = 0; i <= 8; i++) {
      const t = 1 - i / 8, P = arm.getPointAt(t), Dd = arm.getTangentAt(t), X = new T.Vector3(1, 0, 0).cross(Dd).normalize().negate();
      inArm.push(toS(P.addScaledVector(X, -.05).toArray()));
    }
    const cn = toS(new T.Vector3(0, -.2, -.17).applyMatrix4(lnb.matrix).toArray());
    const cable = [cn, ...inArm.slice(1), toS([.02, -.3, -.2]),
      new T.Vector3(.07, Y0 - .4, ZM + .02), new T.Vector3(.068, 1.2, ZM + .03), new T.Vector3(.07, .5, ZM + .04),
      new T.Vector3(.12, .12, ZM + .14), new T.Vector3(.36, .03, ZM + .44), new T.Vector3(.85, .03, ZM + .56), new T.Vector3(1.2, .03, ZM + .3), new T.Vector3(1.3, .03, ZM + .05)];
    s.add(k.cord(cable.map(v => v.toArray()), .022, '#17181c'));
    const plugAt = cable.at(-1), plugDir = cable.at(-1).clone().sub(cable.at(-2)).normalize();
    s.add(rod(k, plugAt.toArray(), plugAt.clone().addScaledVector(plugDir, .1).toArray(), .03, k.metal('#d9dde2', .3), { seg: 6 }));
    s.add(rod(k, plugAt.clone().addScaledVector(plugDir, .1).toArray(), plugAt.clone().addScaledVector(plugDir, .15).toArray(), .008, k.metal('#e8c56a', .3), { seg: 8 }));
    for (const y of [1.25, .7]) k.add(s, k.torus(.075, .012, { rs: 6, ts: 24 }), dark, { p: [.012, y, ZM + .01], r: [Math.PI / 2, 0, 0] });
    return g;
  },

  // A 10 cm student CubeSat: a black-anodised frame with rails up the corners, solar cells on the sides, a camera and
  // a green status light on the front, and two pairs of tape-measure antennas sprung out from the top.
  cubesat(k) {
    const T = k.THREE, g = k.group(), c = k.group([], { r: [.36, -.12, .14], order: 'YXZ' }); g.add(c);
    const E = 1, RW = .085, H = 1.135, h = E / 2;
    const frame = k.metal('#343842', .32, { envMapIntensity: 1.4 });
    // the frame: four rails standing proud of the ends, and bars round the top and bottom
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.add(c, k.box(RW, H, RW, .014, 2), frame, { p: [sx * (h - RW / 2), 0, sz * (h - RW / 2)] });
    const bars = [];
    for (const y of [-1, 1]) for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; bars.push({ p: [Math.sin(a) * (h - .03), y * (h - .035), Math.cos(a) * (h - .03)], r: [0, a, 0] }); }
    c.add(k.instances(k.box(E - RW * 2, .07, .06, .012, 2), frame, bars));
    // the side panels: solar cells on circuit boards
    const edge = k.plastic('#1b1d22', { rough: .5 }), PW = E - RW * 2 + .01, PH = E - .14;
    const faces = [['front', 0, ''], ['cells', Math.PI / 2, '+X'], ['cells', Math.PI, '-Y'], ['cells', -Math.PI / 2, '-X']];
    for (const [kind, a, label] of faces) {
      const mats = [edge, edge, edge, edge, cubeFaceMat(k, kind, { label }), edge];
      k.add(c, k.box(PW, PH, .02), mats, { p: [Math.sin(a) * (h - .022), 0, Math.cos(a) * (h - .022)], r: [0, a, 0] });
    }
    k.add(c, k.box(PW, .02, PW), [edge, edge, cubeFaceMat(k, 'top'), edge, edge, edge], { p: [0, h - .03, 0] });
    k.add(c, k.box(PW, .02, PW), edge, { p: [0, -h + .03, 0] });
    // a GPS patch on top
    k.add(c, k.box(.26, .045, .26, .01), k.plastic('#e9dfc8', { rough: .5 }), { p: [0, h - .01, 0] });
    k.add(c, k.box(.17, .012, .17, .004), k.metal('#dcdfe4', .25), { p: [0, h + .016, 0] });
    // the camera and the status light on the front
    const fz = h - .01;
    k.add(c, k.cyl(.09, .1, .08, { seg: 32 }), frame, { p: [.2, .12, fz + .04], r: [Math.PI / 2, 0, 0] });
    k.add(c, k.torus(.078, .012, { rs: 8, ts: 32 }), k.metal('#d9dde2', .2), { p: [.2, .12, fz + .082] });
    k.add(c, k.sphere(.07, { w: 32, h: 16, thetaLen: Math.PI / 2 }), k.mat({ color: '#0d1238', roughness: .04, metalness: .3, clearcoat: 1, clearcoatRoughness: 0,
      iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [300, 600], envMapIntensity: 2 }), { p: [.2, .12, fz + .075], r: [Math.PI / 2, 0, 0], s: [1, .45, 1] });
    k.add(c, k.sphere(.028, { w: 16, h: 10 }), k.glow('#45ff8a', 2.4), { p: [.2, -.25, fz + .01], s: [1, 1, .6] });
    c.add(k.place(halo(k, .16, '#45ff8a', .8), { p: [.2, -.25, fz + .05] }));
    // tape-measure antennas: a long pair and a short pair, sprung out flat from the top edges
    const tape = k.tex(32, 512, (cx, w, hh) => {
      cx.fillStyle = '#f7c81c'; cx.fillRect(0, 0, w, hh);
      cx.fillStyle = '#1c1c1c';
      for (let i = 0; i < 48; i++) { const y = (i + .5) / 48 * hh, l = i % 8 === 0 ? .75 : i % 4 === 0 ? .55 : .32; cx.fillRect(0, y, w * l, 2); }
    }, { cache: 'orbit-tape' });
    const tapeMat = k.mat({ map: tape, metalness: .35, roughness: .3, clearcoat: .6, clearcoatRoughness: .2 });
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2, L = i % 2 ? .8 : 1.15, off = (i < 2 ? 1 : -1) * .16;
      const dir = [Math.sin(a), 0, Math.cos(a)], side = [Math.cos(a), 0, -Math.sin(a)];
      const root = [dir[0] * (h - .06) + side[0] * off, h + .005, dir[2] * (h - .06) + side[2] * off];
      k.add(c, k.box(.1, .05, .09, .012), edge, { p: [root[0], h - .005, root[2]], r: [0, a, 0] });
      k.add(c, k.box(.065, .006, L), tapeMat, { p: [root[0] + dir[0] * L / 2, h + .03, root[2] + dir[2] * L / 2], r: [0, a, 0] });
    }
    g.userData.floating = true;
    return g;
  },

  // A weather satellite: a boxy body wrapped in crinkled gold foil, an instrument deck with its scanning imager and a
  // dish antenna, and a big blue solar wing out on a boom to each side.
  satellite(k) {
    const T = k.THREE, g = k.group(), s = k.group([], { r: [.1, -.14, -.1], order: 'YXZ' }); g.add(s);
    const BW = 1.5, BH = 1.4, BD = 1.3, hw = BW / 2, hh = BH / 2, hd = BD / 2;
    const gold = foilMat(k);
    const white = k.plastic('#f2f3f5', { rough: .45, coat: .35 }), silver = k.metal('#cfd4da', .28), black = k.plastic('#15171c', { rough: .35, coat: .6 });
    // the body: a box in puffy gold blankets
    k.add(s, warp(k.box(BW, BH, BD, .1, 5), (x, y, z) => {
      const fx = 1 - (x / hw) ** 2, fy = 1 - (y / hh) ** 2, fz = 1 - (z / hd) ** 2, b = .04;
      return [x * (1 + b * fy * fz), y * (1 + b * fx * fz), z * (1 + b * fx * fy)];
    }), gold);
    // the instrument deck, low on the front: a white panel carrying the imager (a black port in a hood) and a sounder
    const fz = hd + .03, glassy = k.mat({ color: '#101a3a', roughness: .05, metalness: .6, clearcoat: 1, iridescence: .8, iridescenceIOR: 1.6, iridescenceThicknessRange: [300, 600] });
    k.add(s, k.box(BW - .22, .78, .06, .02), white, { p: [0, -.24, fz] });
    k.add(s, k.box(.64, .52, .34, .05), white, { p: [-.3, -.16, fz + .2] });
    k.add(s, k.extrude(k.roundRect(.5, .4, .06), .2, { holes: [k.roundRect(.38, .28, .03)], bevel: .012 }), [white, white], { p: [-.3, -.14, fz + .45] });
    k.add(s, k.box(.4, .3, .02), black, { p: [-.3, -.14, fz + .37] });
    k.add(s, k.box(.3, .2, .01), glassy, { p: [-.3, -.14, fz + .385] });
    k.add(s, k.cyl(.1, .1, .6, { seg: 28 }), silver, { p: [-.3, .15, fz + .16], r: [0, 0, Math.PI / 2] });
    k.add(s, k.box(.4, .34, .28, .04), white, { p: [.38, -.2, fz + .17] });
    k.add(s, k.cyl(.1, .1, .08, { seg: 28 }), black, { p: [.38, -.18, fz + .34], r: [Math.PI / 2, 0, 0] });
    k.add(s, k.cyl(.075, .075, .02, { seg: 28 }), glassy, { p: [.38, -.18, fz + .38], r: [Math.PI / 2, 0, 0] });
    const louv = []; for (let i = 0; i < 5; i++) louv.push({ p: [.24 + i * .07, -.52, fz + .04] });
    s.add(k.instances(k.box(.05, .14, .02, .006), silver, louv));
    // the dish antenna on a post on top, and a pair of star trackers
    const dishG = k.group([], { p: [.32, hh + .3, .15] }); s.add(dishG);
    orient(k, dishG, [.25, .55, .8]);
    k.add(dishG, k.lathe([[0, -.02], [.2, .01], [.34, .07], [.38, .1], [.36, .105], [.2, .045], [0, .02]], { seg: 48 }), white);
    k.add(dishG, k.cyl(.02, .02, .22, { seg: 10 }), white, { p: [0, .13, 0] });
    k.add(dishG, k.cyl(.04, .03, .06, { seg: 16 }), k.plastic('#dcdfe4'), { p: [0, .25, 0] });
    s.add(rod(k, [.32, hh - .02, .15], dishG.position.toArray(), .045, silver));
    for (const x of [-.45, -.22]) k.add(s, k.cyl(.07, .06, .2, { seg: 24 }), black, { p: [x, hh + .1, -.25], r: [-.35, 0, 0] });
    s.add(rod(k, [.6, hh, -.45], [.72, hh + .7, -.55], .012, silver));
    // underneath: the launch adapter ring and four thrusters
    k.add(s, k.torus(.42, .04, { rs: 10, ts: 48 }), silver, { p: [0, -hh - .04, 0], r: [Math.PI / 2, 0, 0] });
    s.add(k.instances(k.cone(.05, .1, 16), k.metal('#8c929b', .35), [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => ({ p: [x * (hw - .15), -hh - .05, z * (hd - .15)], r: [Math.PI, 0, 0] }))));
    // the solar wings: a drive, a boom and a yoke out to two hinged panels of cells on each side
    const PW = 1.0, PH = 1.3, GAP = .06, cells = solarMat(k, 5, 7, PH / PW);
    const back = k.plastic('#e6e8ec', { rough: .6, coat: .1 }), rim = k.metal('#b9c0c9', .3);
    for (const sd of [-1, 1]) {
      const w = k.group([], { p: [sd * hw, 0, 0], r: [-.2, 0, 0] }); s.add(w);
      k.add(w, k.cyl(.12, .12, .16, { seg: 28 }), silver, { p: [sd * .08, 0, 0], r: [0, 0, Math.PI / 2] });
      w.add(rod(k, [sd * .16, 0, 0], [sd * .7, 0, 0], .04, white));
      for (const y of [-1, 1]) w.add(rod(k, [sd * .7, 0, 0], [sd * .9, y * (PH / 2 - .1), 0], .02, white));
      for (let i = 0; i < 2; i++) {
        const cx = sd * (.9 + PW / 2 + i * (PW + GAP));
        k.add(w, k.box(PW, PH, .035), [rim, rim, rim, rim, cells, back], { p: [cx, 0, 0] });
        if (i) for (const y of [-.4, .4]) k.add(w, k.box(.1, .08, .06, .01), silver, { p: [cx - sd * (PW / 2 + GAP / 2), y, 0] });
      }
    }
    g.userData.floating = true;
    g.userData.fullView = { az: 48, el: 12 };
    return g;
  },

  // Sputnik: a polished ball with a bolted seam round its middle and four long whip antennas swept back behind it.
  sputnik(k) {
    const T = k.THREE, g = k.group(), s = k.group(); g.add(s);
    const R = .5;
    const mirror = k.metal('#f1f4f8', .045, { envMapIntensity: 1.75 }), rodMat = k.metal('#e2e6ea', .16);
    k.add(s, k.sphere(R, { w: 96, h: 64 }), mirror);
    // the seam: a flange round the middle, and a ring of bolt heads just behind it
    k.add(s, k.torus(R + .002, .014, { rs: 10, ts: 128 }), mirror, { r: [0, Math.PI / 2, 0] });
    const bolts = []; for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; bolts.push({ p: [-.022, Math.cos(a) * (R + .002), Math.sin(a) * (R + .002)], r: [a, 0, 0] }); }
    s.add(k.instances(k.cyl(.011, .011, .022, { seg: 6 }), mirror, bolts));
    // four antennas, hinged on the front half and swept back
    const al = k.deg(58), be = k.deg(36);
    for (let i = 0; i < 4; i++) {
      const psi = k.deg(45 + 90 * i), L = i % 2 ? 2.05 : 2.4;
      const P = new T.Vector3(Math.cos(al) * R, Math.sin(al) * Math.cos(psi) * R, Math.sin(al) * Math.sin(psi) * R);
      const D = new T.Vector3(-Math.cos(be), Math.sin(be) * Math.cos(psi), Math.sin(be) * Math.sin(psi));
      s.add(rod(k, P.clone().addScaledVector(D, -.03).toArray(), P.clone().addScaledVector(D, .15).toArray(), [.036, .03], mirror));
      s.add(rod(k, P.clone().addScaledVector(D, .1).toArray(), P.clone().addScaledVector(D, L).toArray(), [.019, .009], rodMat, { seg: 12 }));
    }
    // fly it off to the left, a little up and toward us, rolled 44° about its axis so the four whiskers fan out evenly
    const F = [-.874, .139, .465];
    aimX(k, s, F);
    s.quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), k.deg(44)));
    // beep, beep: three rings of radio waves spreading out ahead of it
    const waves = k.group(); g.add(waves);
    const cam = new T.Vector3(Math.sin(k.deg(30)) * Math.cos(k.deg(16)), Math.sin(k.deg(16)), Math.cos(k.deg(30)) * Math.cos(k.deg(16)));
    aimX(k, waves, F, new T.Vector3().crossVectors(cam, new T.Vector3(...F)).toArray());
    const waveMat = k.mat({ color: '#bfe9ff', emissive: k.color('#9fdcff'), emissiveIntensity: 1.4, transparent: true, opacity: .75, depthWrite: false, roughness: .4 });
    [.72, .92, 1.12].forEach((r, i) => k.add(waves, k.torus(r, .012, { rs: 6, ts: 40, arc: k.deg(64 - i * 8) }), waveMat, { r: [0, 0, -k.deg(32 - i * 4)], shadow: false }));
    const H = new T.Vector3(.11, .6, .79).normalize();   // halfway between the camera and the key light
    g.add(k.place(sparkle(k, .42, .3), { p: H.multiplyScalar(R * 1.02).toArray() }));
    g.userData.floating = true;
    return g;
  },

  // A Voyager-style probe: a big white dish on top of a ten-sided body, the golden record on its side, three RTGs out on
  // one boom, the cameras on a science boom on the other, and a long thin magnetometer boom.
  probe(k) {
    // turned so the booms fan out left and right and we see the dish from a little below, the golden record toward us
    const yaw = -40, T = k.THREE, g = k.group(), p = k.group([], { r: [k.deg(-12), k.deg(yaw), k.deg(10)], order: 'YXZ' }); g.add(p);
    const white = k.plastic('#f4f3ef', { rough: .5, coat: .25, coatRough: .4 });
    const silver = k.metal('#c9ced5', .32), dark = k.metal('#474a52', .42), black = k.plastic('#1b1d22', { rough: .55, coat: .2 });
    // the high-gain dish, facing up, with its feed and the subreflector held out on struts
    const DR = 1.5, DD = .4, DT = .05, NS = 20, prof = [];
    for (let i = 0; i <= NS; i++) { const r = DR * i / NS; prof.push([r, DD * (r / DR) ** 2 - DT]); }
    prof.push([DR + .03, DD - DT * .3], [DR + .03, DD + .015], [DR - .015, DD + .015]);
    for (let i = NS; i >= 0; i--) { const r = DR * i / NS * (i === NS ? .99 : 1); prof.push([r, DD * (r / DR) ** 2]); }
    const dishTex = k.tex(512, 64, (c, w, h) => {
      c.fillStyle = '#f7f6f2'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(150,150,140,.35)'; for (let i = 0; i < 16; i++) c.fillRect(i / 16 * w, 0, 2, h);
    }, { cache: 'orbit-probe-dish' });
    k.add(p, k.lathe(prof, { seg: 96 }), k.plastic('#ffffff', { map: dishTex, rough: .5, coat: .25, coatRough: .4 }));
    k.add(p, k.cyl(.13, .1, .4, { seg: 28 }), white, { p: [0, .2, 0] });
    k.add(p, k.lathe([[0, -.03], [.3, -.01], [.31, .02], [.2, .05], [0, .07]], { seg: 40 }), white, { p: [0, 1.02, 0] });
    k.add(p, k.cyl(.06, .08, .14, { seg: 20 }), white, { p: [0, 1.15, 0] });
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + .5, r0 = .95; p.add(rod(k, [Math.sin(a) * r0, DD * (r0 / DR) ** 2, Math.cos(a) * r0], [Math.sin(a) * .26, 1.0, Math.cos(a) * .26], .016, white, { seg: 8 })); }
    // the ten-sided bus: bays of gold foil, black louvres and silver panels
    const busTex = k.tex(1024, 128, (c, w, h) => {
      const R = rng(41), bw = w / 10;
      for (let i = 0; i < 10; i++) {
        const x = i * bw, kind = [0, 2, 1, 0, 2, 0, 1, 0, 2, 1][i];
        if (kind === 0) {
          const gr = c.createLinearGradient(x, 0, x + bw, h); gr.addColorStop(0, '#f5cf6a'); gr.addColorStop(1, '#b8801f'); c.fillStyle = gr; c.fillRect(x, 0, bw, h);
          for (let j = 0; j < 40; j++) { c.fillStyle = R() < .5 ? 'rgba(120,70,10,.3)' : 'rgba(255,240,190,.35)'; c.beginPath(); const px = x + R() * bw, py = R() * h; c.moveTo(px, py); c.lineTo(px + (R() - .5) * 30, py + (R() - .5) * 30); c.lineTo(px + (R() - .5) * 30, py + (R() - .5) * 30); c.fill(); }
        } else if (kind === 1) {
          c.fillStyle = '#1a1c21'; c.fillRect(x, 0, bw, h);
          c.fillStyle = '#b9bfc8'; for (let y = 10; y < h - 8; y += 12) c.fillRect(x + 8, y, bw - 16, 5);
        } else { c.fillStyle = '#c3c8cf'; c.fillRect(x, 0, bw, h); c.strokeStyle = 'rgba(80,86,96,.5)'; c.lineWidth = 2; c.strokeRect(x + 10, 10, bw - 20, h - 20); }
        c.fillStyle = 'rgba(30,32,36,.8)'; c.fillRect(x, 0, 2, h);
      }
    }, { cache: 'orbit-probe-bus' });
    const busGeo = k.cyl(.78, .78, .45, { seg: 10 }).toNonIndexed(); busGeo.computeVertexNormals();
    const busY = -.34;
    k.add(p, busGeo, [k.mat({ map: busTex, roughness: .45, metalness: .6 }), dark, dark], { p: [0, busY, 0] });
    k.add(p, k.cyl(.36, .42, .14, { seg: 24 }), dark, { p: [0, -.09, 0] });
    k.add(p, k.cyl(.3, .2, .16, { seg: 24 }), dark, { p: [0, busY - .3, 0] });
    // the golden record, on the bay facing us
    const rec = k.tex(256, 256, (c, w, h) => {
      const gr = c.createRadialGradient(w * .4, h * .4, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, '#ffe39a'); gr.addColorStop(1, '#c9912e');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(96,58,10,.75)'; c.lineWidth = 3;
      c.beginPath(); c.arc(w / 2, h / 2, w * .44, 0, TAU); c.stroke();
      c.lineWidth = 2;
      c.beginPath(); c.arc(w * .33, h * .33, w * .1, 0, TAU); c.stroke(); c.beginPath(); c.arc(w * .33, h * .33, w * .025, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(w * .2, h * .2); c.lineTo(w * .4, h * .26); c.stroke();
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + .2, l = w * (.07 + (i * 37 % 11) / 11 * .1); c.beginPath(); c.moveTo(w * .33, h * .68); c.lineTo(w * .33 + Math.cos(a) * l, h * .68 + Math.sin(a) * l); c.stroke(); }
      for (const x of [.62, .76]) { c.beginPath(); c.arc(w * x, h * .7, w * .035, 0, TAU); c.stroke(); }
      c.beginPath(); c.moveTo(w * .655, h * .7); c.lineTo(w * .725, h * .7); c.stroke();
      c.strokeRect(w * .6, h * .24, w * .18, w * .14);
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(w * .6, h * (.27 + i * .03)); c.lineTo(w * .78, h * (.27 + i * .03)); c.stroke(); }
    }, { cache: 'orbit-record' });
    const recGold = k.metal('#f2c65a', .2), recFace = k.mat({ map: rec, metalness: 1, roughness: .22, bumpMap: rec, bumpScale: .6 });
    const bay = ((Math.round((30 - yaw - 18) / 36) % 10) + 10) % 10, ra = k.deg(18 + 36 * bay), ap = .78 * Math.cos(Math.PI / 10);
    const recG = k.group([], { p: [Math.sin(ra) * (ap + .035), busY, Math.cos(ra) * (ap + .035)] }); p.add(recG);
    orient(k, recG, [Math.sin(ra), 0, Math.cos(ra)]);
    k.add(recG, k.cyl(.19, .19, .02, { seg: 48 }), [recGold, recFace, recGold]);
    k.add(recG, k.torus(.195, .012, { rs: 8, ts: 48 }), silver, { r: [Math.PI / 2, 0, 0] });
    // the science boom: a lattice out to the scan platform with its cameras and spectrometers
    const bus = new T.Vector3(0, busY, 0), sciD = new T.Vector3(1, .06, -.28).normalize(), sci0 = bus.clone().addScaledVector(new T.Vector3(1, 0, 0), .74), sci1 = sci0.clone().addScaledVector(sciD, 2.0);
    p.add(truss(k, sci0.toArray(), sci1.toArray(), .12, 14, .012, silver));
    const plat = k.group([], { p: sci1.toArray() }); p.add(plat);
    k.add(plat, k.box(.36, .26, .3, .03), k.plastic('#dfe2e6', { rough: .5 }));
    const camD = [0, -.25, 1];
    const nac = k.group([], { p: [.02, .2, .02] }); plat.add(nac); orient(k, nac, camD);
    k.add(nac, k.cyl(.08, .08, .56, { seg: 24 }), white); k.add(nac, k.cyl(.083, .083, .1, { seg: 24 }), black, { p: [0, .3, 0] });
    const wac = k.group([], { p: [-.16, .16, .06] }); plat.add(wac); orient(k, wac, camD);
    k.add(wac, k.cyl(.055, .055, .32, { seg: 20 }), white); k.add(wac, k.cyl(.058, .058, .07, { seg: 20 }), black, { p: [0, .17, 0] });
    const iris = k.group([], { p: [.2, -.02, -.06] }); plat.add(iris); orient(k, iris, camD);
    k.add(iris, k.cyl(.15, .15, .34, { seg: 28 }), silver); k.add(iris, k.cyl(.12, .12, .02, { seg: 28 }), black, { p: [0, .172, 0] });
    const lecp = sci0.clone().addScaledVector(sciD, 1.1);
    k.add(p, k.cyl(.1, .1, .16, { seg: 24 }), white, { p: [lecp.x, lecp.y + .1, lecp.z] });
    k.add(p, k.cone(.08, .12, 20), black, { p: [lecp.x, lecp.y + .24, lecp.z] });
    // the RTG boom: three finned power units in a row
    const rtgD = new T.Vector3(-1, -.06, .22).normalize(), rtg0 = bus.clone().addScaledVector(new T.Vector3(-1, 0, 0), .74);
    const rtgA = rtg0.clone().addScaledVector(rtgD, 1.35);
    p.add(truss(k, rtg0.toArray(), rtgA.toArray(), .11, 9, .012, silver));
    const rtg = k.group([], { p: rtgA.toArray() }); p.add(rtg); orient(k, rtg, rtgD.toArray());
    const fins = [];
    for (let i = 0; i < 3; i++) {
      const y = .24 + i * .46;
      k.add(rtg, k.cyl(.12, .12, .4, { seg: 24 }), dark, { p: [0, y, 0] });
      k.add(rtg, k.cyl(.07, .07, .08, { seg: 16 }), silver, { p: [0, y + .23, 0] });
      for (let j = 0; j < 6; j++) { const a = j / 6 * TAU; fins.push({ p: [Math.sin(a) * .17, y, Math.cos(a) * .17], r: [0, a, 0] }); }
    }
    rtg.add(k.instances(k.box(.012, .38, .11), k.metal('#5a5e66', .4), fins));
    k.add(rtg, k.cyl(.06, .06, .08, { seg: 16 }), silver, { p: [0, .01, 0] });
    // the magnetometer boom: long and spindly, off into the dark, with its sensors
    const magD = new T.Vector3(-.551, .444, .707).normalize(), mag0 = bus.clone().add(new T.Vector3(-.456, .15, .583)), ML = 3.0, mag1 = mag0.clone().addScaledVector(magD, ML);
    p.add(truss(k, mag0.toArray(), mag1.toArray(), .07, 24, .008, silver));
    for (const t of [.55, 1]) { const q = mag0.clone().addScaledVector(magD, ML * t); p.add(rod(k, q.clone().addScaledVector(magD, -.1).toArray(), q.clone().addScaledVector(magD, .1).toArray(), .045, white)); }
    // two long radio antennas in a V underneath
    for (const d of [[.55, -.75, -.4], [-.25, -.75, -.62]]) { const a = bus.clone().add(new T.Vector3(0, -.2, -.3)); p.add(rod(k, a.toArray(), a.clone().addScaledVector(new T.Vector3(...d).normalize(), 1.6).toArray(), .009, silver, { seg: 6 })); }
    g.userData.floating = true;
    g.userData.view = { el: 14 };
    g.userData.fullView = { az: 45, el: 10 };   // on the tall card, look along the booms a little so the dish fills it
    return g;
  },

  // A solar sail: a huge, hair-thin square of mirror film on four diagonal booms, billowing a little in the sunlight,
  // round a small spacecraft at its hub.
  solarsail(k) {
    const T = k.THREE, g = k.group(), s = k.group([], { r: [.25, k.deg(10), -.15], order: 'YXZ' }); g.add(s);   // tipped toward us
    const C = 2, K = C * Math.SQRT2, HUB = .2;
    const corner = i => { const a = k.deg(45 + 90 * i); return [Math.cos(a) * K, Math.sin(a) * K]; };   // [x, z]
    // the film: concentric seams, soft tone variation and fine creases
    const sailMap = k.tex(1024, 1024, (c, w, h) => {
      const R = rng(61);
      c.fillStyle = '#e9edf2'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 30; i++) { const x = R() * w, y = R() * h, r = w * (.08 + R() * .2), gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, R() < .5 ? 'rgba(255,255,255,.35)' : 'rgba(180,188,200,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); }
      // a faint pastel sheen washing across it
      const wash = c.createLinearGradient(0, h, w, 0);
      [[0, 'rgba(150,215,255,.3)'], [.3, 'rgba(255,225,165,.3)'], [.45, 'rgba(255,175,210,.32)'], [.6, 'rgba(210,180,255,.32)'], [.75, 'rgba(165,215,255,.28)'], [1, 'rgba(190,255,220,.26)']].forEach(([t, col]) => wash.addColorStop(t, col));
      c.fillStyle = wash; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(150,158,170,.55)'; c.lineWidth = 2;
      for (let q = .08; q < .5; q += .055) { c.strokeRect(w * (.5 - q), h * (.5 - q), w * q * 2, h * q * 2); }
    }, { cache: 'orbit-sail-2' });
    const sailBump = k.tex(512, 512, (c, w, h) => {
      const R = rng(62);
      c.fillStyle = '#808080'; c.fillRect(0, 0, w, h);
      c.lineCap = 'round';
      c.filter = 'blur(1.5px)';
      for (let i = 0; i < 40; i++) {
        const x = R() * w, y = R() * h, a = R() * TAU, l = w * (.05 + R() * .2), v = R() < .5 ? 255 : 0;
        c.strokeStyle = `rgba(${v},${v},${v},${.1 + R() * .18})`; c.lineWidth = 1.5 + R() * 3;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + .3) * l * .5, y + Math.sin(a + .3) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
      }
    }, { cache: 'orbit-sailb', data: true });
    const film = k.mat({ color: '#ffffff', map: sailMap, metalness: 1, roughness: .2, bumpMap: sailBump, bumpScale: 1.2, side: T.DoubleSide,
      iridescence: .15, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 400], envMapIntensity: 1.6 });
    // four triangular quadrants, each held at the hub and two boom tips: the free edges curve in, the middles billow
    const BIL = .28, SCAL = .22, quads = [];
    for (let i = 0; i < 4; i++) {
      const A = corner(i), Bc = corner(i + 1), M = [(A[0] + Bc[0]) / 2, (A[1] + Bc[1]) / 2], ml = Math.hypot(M[0], M[1]), N = [M[0] / ml, M[1] / ml];
      const at = (u, v) => {
        const t = lerp(.012, .988, u), ex = lerp(A[0], Bc[0], t) - N[0] * SCAL * Math.sin(Math.PI * t), ez = lerp(A[1], Bc[1], t) - N[1] * SCAL * Math.sin(Math.PI * t);
        const el = Math.hypot(ex, ez), x = lerp(ex / el * HUB, ex, v), z = lerp(ez / el * HUB, ez, v);
        let y = -BIL * Math.sin(Math.PI * t) ** .85 * (1 - (1 - v) ** 2);
        for (const Q of [A, Bc]) {   // wrinkles fanning out from each corner the film is pulled from
          const dx = x - Q[0], dz = z - Q[1], d = Math.hypot(dx, dz), ang = Math.atan2(dz, dx) - Math.atan2(-Q[1], -Q[0]);
          y += .035 * Math.exp(-d / .9) * smooth(0, .3, d) * Math.sin(ang * 26);
        }
        y += .012 * Math.sin(x * 5.3 + z * 1.7) * Math.sin(z * 4.1 - x * 2.3);
        return [x, y, z];
      };
      k.add(s, surface(k, at, 40, 36, { uv: (u, v) => { const [x, , z] = at(u, v); return [.5 + x / (2 * K), .5 - z / (2 * K)]; } }), film, { shadow: false });
      quads.push(at);
    }
    // the booms, out to each corner, with a fitting at each tip
    const boom = k.metal('#dfe3e8', .25);
    for (let i = 0; i < 4; i++) { const [x, z] = corner(i); s.add(rod(k, [x / K * .2, 0, z / K * .2], [x * 1.012, 0, z * 1.012], .02, boom, { seg: 8 })); k.add(s, k.sphere(.035, { w: 12, h: 8 }), boom, { p: [x * 1.015, 0, z * 1.015] }); }
    // the hub: a little three-unit CubeSat standing through the middle, with the boom deployer round its waist
    const hubG = k.group([], { r: [0, Math.PI / 4, 0] }); s.add(hubG);
    const edge = k.plastic('#1b1d22', { rough: .5 }), cm = cubeFaceMat(k, 'cells', { tall: 3 });
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; k.add(hubG, k.box(.3, .9, .02), [edge, edge, edge, edge, cm, edge], { p: [Math.sin(a) * .15, 0, Math.cos(a) * .15], r: [0, a, 0] }); }
    const railM = k.metal('#343842', .32);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.add(hubG, k.box(.04, .96, .04, .008), railM, { p: [sx * .15, 0, sz * .15] });
    k.add(hubG, k.box(.3, .02, .3), foilMat(k), { p: [0, .46, 0] });
    k.add(hubG, k.box(.44, .09, .44, .02), k.metal('#c9ced5', .3), { p: [0, 0, 0] });
    hubG.add(rod(k, [.08, .46, .08], [.08, .9, .08], .008, boom));
    s.updateMatrix();
    for (const [q, u, v, size, rot] of [[1, .55, .62, .75, .2], [3, .4, .78, .38, .6]]) g.add(k.place(sparkle(k, size, rot), { p: new T.Vector3(...quads[q](u, v)).applyMatrix4(s.matrix).toArray() }));
    g.userData.floating = true;
    g.userData.noHero = true;
    g.userData.view = { az: 30, el: 38 };
    g.userData.fullView = { el: 36 };
    return g;
  },
};
