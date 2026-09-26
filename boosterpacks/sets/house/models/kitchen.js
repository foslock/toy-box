// Models for the kitchen cards. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- small local helpers ---------- */
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const smax = (a, b, s) => { const h = clamp01(.5 + .5 * (b - a) / s); return a * (1 - h) + b * h + s * h * (1 - h); };

// A surface from a function fn(u, v) => [x, y, z] over the unit square (u wraps around, v runs along).
// UVs are (u, v), so a k.wood grain (which runs along v) follows the length. Normals are welded across seams.
function surface(k, fn, nu, nv) {
  const T = k.THREE, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { pos.push(...fn(i / nu, j / nv)); uv.push(i / nu, j / nv); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return weld(geo);
}
// Compute normals, then average them between vertices that share a position (lathe and sphere seams, poles).
function weld(geo) {
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, key = i => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
  const groups = new Map();
  for (let i = 0; i < p.count; i++) { const kk = key(i); (groups.get(kk) || groups.set(kk, []).get(kk)).push(i); }
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    let x = 0, y = 0, z = 0;
    for (const i of ids) { x += n.getX(i); y += n.getY(i); z += n.getZ(i); }
    const l = Math.hypot(x, y, z) || 1;
    for (const i of ids) n.setXYZ(i, x / l, y / l, z / l);
  }
  n.needsUpdate = true;
  return geo;
}
// Smooth shading for extruded shapes (ExtrudeGeometry comes out faceted): average the normals of faces that meet
// at a vertex at less than `crease` degrees, so big bevels read as soft and round while real corners stay crisp.
function soft(geo, crease = 60) {
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
// Move every vertex of a geometry: fn(x, y, z) => [x, y, z]. Then fix the normals.
function warp(geo, fn) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const [x, y, z] = fn(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, x, y, z); }
  p.needsUpdate = true;
  return weld(geo);
}
// Bold wood grain running along v (k.wood's is very fine, and vanishes at card size). light/dark: CSS colours.
function grainTex(k, light, dark, o = {}) {
  return k.tex(256, 512, (c, w, h) => {
    c.fillStyle = light; c.fillRect(0, 0, w, h);
    c.strokeStyle = dark; c.lineCap = 'round';
    for (let i = 0; i < (o.lines ?? 34); i++) {
      const x0 = k.rand() * w, amp = k.range(2, 9), f = k.range(.006, .016), ph = k.rand() * 9;
      c.globalAlpha = k.range(.1, o.alpha ?? .38); c.lineWidth = k.range(1, 5);
      c.beginPath();
      for (let y = -8; y <= h + 8; y += 8) c.lineTo(x0 + Math.sin(y * f + ph) * amp + Math.sin(y * f * 2.7 + ph) * amp * .3, y);
      c.stroke();
    }
    c.globalAlpha = 1;
  }, { repeat: o.repeat ?? [1, 1] });
}
const woodMat = (k, light, dark, o = {}) => k.mat({ map: grainTex(k, light, dark, o), roughness: o.rough ?? .5, clearcoat: o.varnish ?? .3, clearcoatRoughness: .25 });
// Polished steel for round things: soft light and dark bands around u stand in for reflections of a kitchen.
function polished(k, c = '#eef1f4', rough = .08) {
  const bands = k.tex(512, 4, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    [[0, '#7d848d'], [.1, '#f4f6f8'], [.2, '#aab1b9'], [.32, '#ffffff'], [.42, '#8e959e'], [.55, '#e9edf1'], [.66, '#9aa1aa'], [.78, '#ffffff'], [.9, '#b3bac2'], [1, '#7d848d']]
      .forEach(([t, col]) => gr.addColorStop(t, col));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  return k.metal(c, rough, { map: bands });
}
// Euler angles that turn +y to point along the direction d.
function aim(k, d) {
  const q = new k.THREE.Quaternion().setFromUnitVectors(new k.THREE.Vector3(0, 1, 0), new k.THREE.Vector3(...d).normalize());
  const e = new k.THREE.Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z];
}

export default {
  // A retro enamel toaster with two slices of toast popping up.
  toaster(k) {
    const g = k.group();
    const enamel = k.gloss('#7fd3c4'), chrome = k.chrome(), black = k.plastic('#1f2226', { rough: .5 });
    k.add(g, k.box(3.1, .24, 1.85, .1), black, { p: [0, .12, 0] });
    k.add(g, k.box(3, 1.95, 1.7, .45), enamel, { p: [0, 1.2, 0] });
    k.add(g, k.box(3.04, .1, 1.74, .05), chrome, { p: [0, .3, 0] });                  // chrome band at the base
    k.add(g, k.box(2.5, .1, 1.3, .08), chrome, { p: [0, 2.16, 0] });                  // top plate
    const crust = k.matte('#a9652e', .8), crumb = k.matte('#e7b46c', .9);
    const bread = new k.THREE.Shape();
    bread.moveTo(-.95, -.7); bread.lineTo(.95, -.7); bread.lineTo(.95, .3);
    bread.bezierCurveTo(1.12, .62, .72, .82, .42, .66); bread.bezierCurveTo(.2, .86, -.2, .86, -.42, .66);
    bread.bezierCurveTo(-.72, .82, -1.12, .62, -.95, .3); bread.closePath();
    for (const z of [-.3, .3]) {
      k.add(g, k.box(2.2, .12, .26, .05), k.matte('#101114', .6), { p: [0, 2.2, z] });   // slot
      k.add(g, k.extrude(bread, .14, { bevel: .03 }), [crumb, crust], { p: [z * .15, 2.35, z], s: .95 });
    }
    k.add(g, k.box(.16, .9, .08, .04), k.matte('#101114', .6), { p: [1.52, 1.25, .2] });    // lever slot
    k.add(g, k.box(.5, .2, .34, .08), black, { p: [1.7, 1.45, .2] });                      // lever
    const dial = k.knob(.2, .14, black, chrome); dial.rotation.x = Math.PI / 2; dial.position.set(.95, .75, .85); g.add(dial);
    k.add(g, k.slab(.9, .26, .04, .08), chrome, { p: [-.55, .75, .86] });                   // badge
    k.add(g, k.cyl(.05, .05, .02, { seg: 16 }), k.glow('#ff6a3d', 2), { p: [.55, .75, .86], r: [Math.PI / 2, 0, 0] });
    return g;
  },

  // A white diner mug that says WORLD'S BEST, with coffee in it.
  mug(k) {
    const g = k.group();
    const white = k.ceramic('#fbfaf7');
    k.add(g, k.lathe([[0, 0], [.9, 0], [.97, .05], [1.02, .2], [1.04, 1.9], [1.01, 2.02], [.94, 2.03], [.91, 1.95], [.9, .22], [0, .2]]), white);
    k.add(g, k.disc(.9), k.mat({ color: '#3a1f10', roughness: .12, clearcoat: 1 }), { p: [0, 1.72, 0], r: [-Math.PI / 2, 0, 0] });
    k.add(g, k.torus(.52, .14, { arc: Math.PI }), white, { p: [1.0, 1.05, 0], r: [0, 0, -Math.PI / 2], s: [1, 1.12, 1] });
    const band = k.painted(512, 160, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      k.text(c, 'WORLD’S', w / 2, h * .3, { size: 46, weight: 700, color: '#d8342a' });
      k.text(c, 'BEST', w / 2, h * .72, { size: 70, weight: 700, color: '#d8342a' });
    }, { transparent: true, rough: .15 });
    k.add(g, k.cyl(1.046, 1.046, .9, { open: true, start: -Math.PI / 2 + .35, len: Math.PI }), band, { p: [0, 1.05, 0], shadow: false });
    k.add(g, k.torus(1.03, .02), k.ceramic('#d8342a'), { p: [0, 1.58, 0], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.torus(1.035, .02), k.ceramic('#d8342a'), { p: [0, .5, 0], r: [Math.PI / 2, 0, 0] });
    const steam = k.mat({ color: '#ffffff', transparent: true, opacity: .22, roughness: 1, emissive: '#ffffff', emissiveIntensity: .4, depthWrite: false });
    for (const [x, z, s] of [[-.3, .1, 1], [.15, -.2, -1], [.35, .25, 1]]) {
      k.add(g, k.tube([[x, 1.9, z], [x + .15 * s, 2.3, z], [x - .1 * s, 2.7, z], [x + .12 * s, 3.1, z]], .045, { caps: true }), steam, { shadow: false });
    }
    return g;
  },
  // A wooden spoon lying on the counter, with a dab of tomato sauce in its bowl.
  spoon(k) {
    const g = k.group(), L = 5.12;
    const end = s => s < .14 ? Math.sqrt(clamp01(1 - ((.14 - s) / .14) ** 2)) : 1;           // rounds off the handle end
    const halfW = s => {
      const hw = (.098 + .032 * smooth(3.2, .6, s)) * smooth(3.95, 3.55, s) * end(s);
      const e = 1 - ((s - 4.26) / .86) ** 2, bw = e > 0 ? .56 * Math.sqrt(e) : 0;
      return hw > 0 && bw > 0 ? smax(hw, bw, .09) : Math.max(hw, bw);
    };
    const thick = s => (.042 + .034 * smooth(4.0, 3.2, s)) * end(s) * Math.sqrt(clamp01((L - s) / .1));
    const dish = s => .16 * clamp01(1 - ((s - 4.3) / .7) ** 2), belly = s => .19 * clamp01(1 - ((s - 4.26) / .86) ** 2);
    const topY = (x, s) => { const c = Math.min(1, Math.abs(x) / Math.max(1e-4, halfW(s))), sn = Math.sqrt(1 - c * c); return thick(s) * sn - dish(s) * sn * sn; };
    const geo = surface(k, (u, v) => {
      const s = v * L, a = u * k.TAU, sn = Math.sin(a);
      return [halfW(s) * Math.cos(a), thick(s) * sn - (sn >= 0 ? dish(s) : belly(s)) * sn * sn, s - L / 2];
    }, 48, 140);
    const spoon = k.group([], { r: [-.03, 0, 0] });
    k.add(spoon, geo, woodMat(k, '#dcae78', '#a86c3c', { varnish: .25 }));
    // a film of tomato sauce pooled in the bowl, following its curve
    const sauce = surface(k, (u, v) => {
      const t = u * k.TAU, rho = v * (1 + .1 * Math.sin(3 * t + 1) + .06 * Math.sin(5 * t + 2)), x = .27 * rho * Math.cos(t), s = 4.3 + .4 * rho * Math.sin(t);
      return [x, topY(x, s) + .008, s - L / 2];
    }, 48, 12);
    const sm = k.gloss('#b02a1c', { side: k.THREE.DoubleSide });
    k.add(spoon, sauce, sm, { shadow: false });
    g.add(k.group([spoon], { r: [0, 2.5, 0] }));
    g.userData.view = { el: 50 };
    g.userData.fullView = { el: 38 };
    return g;
  },

  // A balloon whisk with a beech handle, lying on the counter.
  whisk(k) {
    const g = k.group(), w = k.group();
    const steel = k.metal('#e3e7ec', .16), wood = woodMat(k, '#d6a26c', '#9a6232', { varnish: .45 });
    k.add(w, k.lathe([[0, 0], [.1, 0], [.14, .03], [.155, .12], [.16, .5], [.15, 1.1], [.13, 1.7], [.12, 2.0], [0, 2.02]], { smooth: true, seg: 40 }), wood);
    k.add(w, k.lathe([[0, 1.9], [.128, 1.9], [.14, 1.96], [.14, 2.2], [.12, 2.32], [.08, 2.4], [0, 2.42]], { seg: 40 }), steel);   // ferrule
    const prof = [[.07, 2.3], [.14, 2.55], [.32, 2.95], [.55, 3.38], [.71, 3.82], [.73, 4.18], [.62, 4.48], [.38, 4.68], [0, 4.76]];
    const N = 6;
    for (let i = 0; i < N; i++) {
      const t = i * Math.PI / N, c = Math.cos(t), sn = Math.sin(t);
      const pts = [...prof.map(([r, y]) => [r * c, y, r * sn]), ...prof.slice(0, -1).reverse().map(([r, y]) => [-r * c, y, -r * sn])];
      k.add(w, k.tube(pts, .024, { seg: 120, rs: 8 }), steel);
    }
    k.add(w, k.torus(.15, .025, { rs: 10, ts: 32 }), steel, { p: [0, -.13, 0], r: [0, Math.PI / 2, 0] });   // hanging ring
    w.rotation.z = -Math.PI / 2 + .152;                // lying down: resting on the handle end and the balloon
    g.add(k.group([w], { r: [0, .7, 0] }));
    g.userData.view = { el: 36 };
    g.userData.fullView = { el: 26 };
    return g;
  },

  // A diner salt shaker: fluted glass full of salt, a chrome cap with holes, and a few spilled grains.
  saltshaker(k) {
    const g = k.group();
    const glass = warp(k.lathe([[0, 0], [.55, 0], [.6, .03], [.62, .12], [.615, 1.2], [.6, 1.78], [.56, 1.9], [.5, 1.96], [.47, 2.02], [.47, 2.2],
      [.44, 2.2], [.44, 1.98], [.5, 1.86], [.53, 1.72], [.53, .32], [.45, .28], [0, .28]], { seg: 112 }), (x, y, z) => {
      if (Math.hypot(x, z) < .56 || y < .06 || y > 1.84) return [x, y, z];
      const f = 1 - .05 * (.5 - .5 * Math.cos(14 * Math.atan2(x, z))) * smooth(.06, .2, y) * smooth(1.84, 1.7, y);
      return [x * f, y, z * f];
    });
    k.add(g, glass, k.glass('#eaf8ff', { opacity: .28 }), { shadow: false });
    const saltTex = k.tex(128, 128, (c, w, h) => {
      c.fillStyle = '#f7f5f0'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { c.fillStyle = k.rand() < .5 ? `rgba(255,255,255,${k.range(.4, 1)})` : `rgba(150,140,130,${k.range(.1, .3)})`; const s = k.range(1, 3); c.fillRect(k.rand() * w, k.rand() * h, s, s); }
    }, { repeat: [4, 2] });
    const salt = k.mat({ color: '#ffffff', map: saltTex, roughness: .7, clearcoat: .2, sheen: .5, sheenColor: '#ffffff' });
    k.add(g, k.lathe([[0, .3], [.505, .3], [.505, 1.46], [.44, 1.53], [.3, 1.57], [0, 1.6]]), salt);
    const cap = [[.44, 1.94], [.56, 1.94], [.575, 1.97], [.575, 2.24], [.56, 2.27]];
    for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI / 2; cap.push([.56 * Math.cos(a), 2.27 + .22 * Math.sin(a)]); }
    const capGeo = warp(k.lathe(cap, { seg: 144 }), (x, y, z) => {
      if (y < 1.98 || y > 2.23) return [x, y, z];
      const f = 1 + .012 * Math.cos(72 * Math.atan2(x, z));
      return [x * f, y, z * f];
    });
    k.add(g, capGeo, k.chrome());
    const holes = [[0, 0], ...[0, 1, 2, 3, 4, 5].map(i => [.24, i * Math.PI / 3 + .3])].map(([r, a]) => {
      const x = r * Math.sin(a), z = r * Math.cos(a), y = 2.27 + .22 * Math.sqrt(1 - (r / .56) ** 2);
      const n = [x / .56 ** 2, (y - 2.27) / .22 ** 2, z / .56 ** 2], l = Math.hypot(...n);
      return { p: [x + n[0] / l * .004, y + n[1] / l * .004, z + n[2] / l * .004], r: aim(k, n) };
    });
    g.add(k.instances(k.cyl(.036, .036, .012, { seg: 14 }), k.matte('#15161a', .6), holes));
    const grains = [];
    for (let i = 0; i < 11; i++) {
      const a = k.range(.1, 1.7), r = k.range(.78, 1.2), s = k.range(.022, .036);
      grains.push({ p: [r * Math.sin(a), s / 2, r * Math.cos(a)], r: [k.range(0, 3), k.range(0, 3), k.range(0, 3)], s });
    }
    g.add(k.instances(k.box(1, 1, 1), k.mat({ color: '#ffffff', roughness: .35, clearcoat: .6 }), grains));
    g.userData.view = { el: 22 };
    return g;
  },
  // The yellow kitchen sponge with a green scrubber on top, and a few soap suds.
  sponge(k) {
    const g = k.group(), sp = k.group([], { r: [0, -.28, 0] });
    g.add(sp);
    const pores = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) {
        const r = k.range(.8, 3.4);
        c.fillStyle = `rgba(${k.rand() < .5 ? '170,120,0' : '120,80,0'},${k.range(.18, .5)})`;
        c.beginPath(); c.ellipse(k.rand() * w, k.rand() * h, r, r * k.range(.6, 1), k.rand() * 3, 0, k.TAU); c.fill();
      }
    });
    const bump = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) { const r = k.range(.8, 3.4); c.fillStyle = `rgba(0,0,0,${k.range(.3, .8)})`; c.beginPath(); c.arc(k.rand() * w, k.rand() * h, r, 0, k.TAU); c.fill(); }
    }, { data: true });
    const foam = k.mat({ color: '#ffd23c', map: pores, bumpMap: bump, bumpScale: 3, roughness: .92, sheen: .4, sheenColor: '#fff2b0' });
    const fibers = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#8a8a8a'; c.fillRect(0, 0, w, h);
      c.lineCap = 'round';
      for (let i = 0; i < 3200; i++) {
        const x = k.rand() * w, y = k.rand() * h, a = k.rand() * k.TAU, l = k.range(4, 14), v = k.range(60, 255) | 0;
        c.strokeStyle = `rgba(${v},${v},${v},${k.range(.4, .9)})`; c.lineWidth = k.range(.5, 1.2);
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + k.range(-4, 4), y + k.range(-4, 4), x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
      }
    });
    const scrub = k.mat({ color: '#3c9a52', map: fibers, bumpMap: fibers, bumpScale: 1.5, roughness: 1 });
    k.add(sp, k.box(3.0, .8, 1.95, .2, 4), foam, { p: [0, .4, 0] });
    k.add(sp, k.box(3.0, .3, 1.95, .07, 3), scrub, { p: [0, .93, 0] });
    // soap suds on one end of the scrubber
    const suds = k.mat({ color: '#eef6ff', roughness: .1, clearcoat: 1, clearcoatRoughness: .04, iridescence: .7, iridescenceIOR: 1.3, sheen: .8, sheenColor: '#cfe8ff' });
    const puffs = [[-1.05, .3, .19], [-.82, .5, .15], [-.84, .12, .16], [-1.18, -.08, .13], [-.6, .3, .11], [-1.22, .56, .11], [-.98, -.3, .09],
      [-.66, -.08, .08], [-1.32, .25, .09], [-.95, .64, .08], [-.5, .55, .06], [-1.12, .12, .12], [-.72, .72, .06], [-1.36, -.02, .07], [-.46, .12, .06]];
    sp.add(k.instances(k.sphere(1, { w: 20, h: 14 }), suds, puffs.map(([x, z, r]) => ({ p: [x, 1.08 + r * .5, z], s: [r, r * .85, r] }))));
    const bubble = k.mat({ color: '#ffffff', roughness: .05, transparent: true, opacity: .3, iridescence: 1, iridescenceIOR: 1.3, clearcoat: 1, depthWrite: false });
    k.add(sp, k.sphere(.2, { w: 32, h: 24 }), bubble, { p: [-.78, 1.45, .2], shadow: false });
    k.add(sp, k.sphere(.11, { w: 24, h: 16 }), bubble, { p: [-.42, 1.36, .45], shadow: false });
    g.userData.view = { el: 44 };
    g.userData.fullView = { el: 34 };
    return g;
  },

  // A tomato-shaped kitchen timer, set for ten minutes.
  timer(k) {
    const g = k.group(), sq = .8, set = .31;     // squash, and where (0–1 around, .25 = front) the pointer sits
    const skin = k.tex(1024, 512, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#d8331d'); gr.addColorStop(.5, '#e8401f'); gr.addColorStop(1, '#d42f1a');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      const eq = h / 2;
      for (let m = 0; m < 60; m++) {       // one tick a minute, longer every five
        const x = ((set + (m - 10) / 60) % 1 + 1) % 1 * w, big = m % 5 === 0;
        c.fillStyle = '#fff6ea'; c.fillRect(x - (big ? 2.5 : 1.5), eq - (big ? 30 : 18), big ? 5 : 3, big ? 26 : 14);
      }
      for (let n = 0; n < 12; n++) {
        const x = ((set + (n - 2) / 12) % 1 + 1) % 1 * w;
        for (const dx of [0, -w, w]) {
          c.save(); c.translate(x + dx, eq - 64); c.scale(1, 1 / sq);
          k.text(c, String(n * 5), 0, 0, { size: 40, weight: 700, color: '#fff6ea' });
          c.restore();
        }
      }
      c.fillStyle = '#fff6ea';           // the pointer on the bottom half
      const px = set * w; c.beginPath(); c.moveTo(px, eq + 10); c.lineTo(px - 13, eq + 34); c.lineTo(px + 13, eq + 34); c.closePath(); c.fill();
    });
    const body = warp(k.sphere(1, { w: 128, h: 72 }), (x, y, z) => {
      const phi = Math.atan2(z, -x), f = 1 - .05 * Math.pow(Math.abs(y), 1.2) * (.5 - .5 * Math.cos(6 * phi));
      const dimple = .1 * Math.exp(-(1 - y) / .04);
      return [x * f, (y - dimple) * sq, z * f];
    });
    k.add(g, body, k.gloss('#ffffff', { map: skin }), { p: [0, sq, 0] });
    k.add(g, k.torus(1.0, .012, { rs: 8, ts: 96 }), k.plastic('#8e1d10'), { p: [0, sq, 0], r: [Math.PI / 2, 0, 0] });   // the seam where the top turns
    // the green calyx, lying over the top of the tomato, and the stem
    const green = k.gloss('#3f9a35');
    const leaf = warp(k.lathe([[0, 0], [.14, .1], [.17, .32], [.12, .62], [.05, .88], [0, 1]], { smooth: true, seg: 16 }), (x, y, z) => [x, y, z + .32 * y * y]);
    for (let i = 0; i < 6; i++) {
      const spin = k.group([], { p: [0, sq * 2 - .01, 0], r: [0, i / 6 * k.TAU + .2, 0] });
      k.add(spin, leaf, green, { r: [k.deg(93 + (i % 2) * 3), 0, 0], s: [1.1, .72 - (i % 2) * .1, .5] });
      g.add(spin);
    }
    k.add(g, k.cyl(.06, .075, .3, { seg: 16 }), k.gloss('#4f8f33'), { p: [0, sq * 2 + .1, 0], r: [.15, 0, .1] });
    k.add(g, k.sphere(.072, { w: 16, h: 12 }), k.gloss('#4f8f33'), { p: [.013, sq * 2 + .24, .02] });
    g.userData.view = { el: 22 };
    return g;
  },

  // A quilted oven mitt with a gingham cuff, a hanging loop and a small hole at the thumb.
  ovenmitt(k) {
    const g = k.group(), m = k.group([], { r: [0, .28, 0] });
    g.add(m);
    const T = k.THREE;
    const outline = new T.Shape();
    outline.moveTo(.92, .6); outline.lineTo(.98, 2.7);
    outline.bezierCurveTo(1.0, 3.95, .6, 4.38, 0, 4.38);
    outline.bezierCurveTo(-.6, 4.38, -.96, 3.95, -.95, 3.25);
    outline.lineTo(-.93, 2.55);
    outline.bezierCurveTo(-1.02, 2.72, -1.14, 3.02, -1.32, 3.16);
    outline.bezierCurveTo(-1.52, 3.3, -1.8, 3.2, -1.78, 2.92);
    outline.bezierCurveTo(-1.76, 2.38, -1.42, 1.72, -1.1, 1.32);
    outline.bezierCurveTo(-.98, 1.15, -.94, .95, -.94, .6);
    outline.closePath();
    const quilt = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#c93224'; c.fillRect(0, 0, w, h);
      for (let i = -1; i <= 2; i++) for (let j = -1; j <= 2; j++) {     // a soft puff in each diamond
        const cx = (i + j) * 64 + 64, cy = (j - i) * 64 + 64;
        const gr = c.createRadialGradient(cx, cy, 0, cx, cy, 64);
        gr.addColorStop(0, 'rgba(255,160,130,.35)'); gr.addColorStop(1, 'rgba(90,0,0,.25)');
        c.fillStyle = gr; c.beginPath(); c.moveTo(cx, cy - 64); c.lineTo(cx + 64, cy); c.lineTo(cx, cy + 64); c.lineTo(cx - 64, cy); c.closePath(); c.fill();
      }
      c.strokeStyle = 'rgba(255,225,205,.85)'; c.lineWidth = 3; c.setLineDash([9, 6]);
      for (let d = -256; d <= 512; d += 128) {
        c.beginPath(); c.moveTo(d, 0); c.lineTo(d + 256, 256); c.stroke();
        c.beginPath(); c.moveTo(d, 256); c.lineTo(d + 256, 0); c.stroke();
      }
    }, { repeat: [1, 1] });
    const fabricOf = map => k.mat({ color: '#ffffff', map, roughness: .95, sheen: 1, sheenRoughness: .5, sheenColor: '#ffd0c0' });
    k.add(m, soft(k.extrude(outline, .16, { bevel: .22, bevelSeg: 6, curve: 48 })), fabricOf(quilt));
    const gingham = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#fbf6ec'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(206,44,34,.55)';
      for (let i = 0; i < 256; i += 64) { c.fillRect(i, 0, 32, h); c.fillRect(0, i, w, 32); }
    }, { repeat: [1, 1] });
    k.add(m, soft(k.extrude(k.roundRect(2.05, .95, .28), .3, { bevel: .2, bevelSeg: 5 })), fabricOf(gingham), { p: [-.02, .46, 0] });
    k.add(m, k.torus(.2, .05, { rs: 12, ts: 40 }), fabricOf(quilt), { p: [1.28, .78, 0], r: [0, 0, -.5] });   // hanging loop
    const hole = k.decal(.44, .44, (c, w, h) => {       // worn through at the thumb: frayed edge, stuffing showing
      c.clearRect(0, 0, w, h);
      const blob = (r, jit) => { c.beginPath(); for (let i = 0; i <= 14; i++) { const a = i / 14 * k.TAU, rr = r * (1 + k.range(-jit, jit)); c.lineTo(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr); } c.closePath(); c.fill(); };
      c.strokeStyle = '#f3ead8'; c.lineCap = 'round';
      for (let i = 0; i < 26; i++) { const a = k.rand() * k.TAU, r0 = w * .16, r1 = w * k.range(.26, .38); c.lineWidth = k.range(2, 4);
        c.beginPath(); c.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0); c.lineTo(w / 2 + Math.cos(a + k.range(-.3, .3)) * r1, h / 2 + Math.sin(a) * r1); c.stroke(); }
      c.fillStyle = '#f6efe2'; blob(w * .24, .14);
      c.fillStyle = '#ddd0b8'; blob(w * .13, .3);
    }, { p: [-1.5, 2.9, .08 + .22 + .004], r: [0, 0, .4] });
    m.add(hole);
    g.userData.view = { el: 14 };
    return g;
  },
  // A whistling stovetop kettle in blue enamel, letting off steam.
  kettle(k) {
    const g = k.group();
    const enamel = k.gloss('#2c5fd6'), chrome = k.chrome(), black = k.plastic('#1c1c20', { rough: .35 });
    k.add(g, k.lathe([[0, 0], [1.16, 0], [1.25, .03], [1.31, .09], [1.35, .18], [1.37, .3], [1.37, .45], [1.35, .62], [1.3, .8], [1.22, 1.0], [1.11, 1.2],
      [.98, 1.4], [.85, 1.58], [.73, 1.74], [.64, 1.88], [.6, 1.97], [0, 1.97]], { seg: 72 }), enamel);
    k.add(g, k.torus(1.345, .03, { rs: 10, ts: 72 }), chrome, { p: [0, .16, 0], r: [Math.PI / 2, 0, 0] });
    // lid and knob
    k.add(g, k.lathe([[0, 2.26], [.14, 2.25], [.3, 2.2], [.46, 2.11], [.6, 2.02], [.67, 1.97], [.66, 1.94], [0, 1.94]], { seg: 64 }), enamel);
    k.add(g, k.torus(.655, .026, { rs: 10, ts: 64 }), chrome, { p: [0, 1.97, 0], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.lathe([[0, 2.24], [.09, 2.24], [.07, 2.31], [.15, 2.38], [.17, 2.46], [.12, 2.53], [0, 2.55]], { smooth: true, seg: 32 }), black);
    // spout, with a whistle cap on the end
    const sp = k.group([], { p: [-1.02, .78, 0], r: [0, 0, k.deg(48)] });
    k.add(sp, k.lathe([[0, 0], [.24, 0], [.22, .3], [.18, .65], [.145, .95], [.135, 1.18], [0, 1.18]], { seg: 32 }), enamel);
    k.add(sp, k.rcyl(.165, .26, .05, { seg: 32 }), chrome, { p: [0, 1.1, 0] });
    k.add(sp, k.cyl(.05, .05, .02, { seg: 16 }), k.matte('#141418', .5), { p: [0, 1.365, 0] });
    k.add(sp, k.box(.09, .5, .06, .03), black, { p: [.19, 1.05, 0], r: [0, 0, -.25] });           // the flip lever
    g.add(sp);
    // handle: chrome posts and a black grip over the top
    k.add(g, k.tube([[-.6, 1.86, 0], [-.66, 2.15, 0], [-.72, 2.45, 0]], .05, { caps: true }), chrome);
    k.add(g, k.tube([[.7, 1.74, 0], [.8, 2.05, 0], [.9, 2.36, 0]], .05, { caps: true }), chrome);
    k.add(g, k.tube([[-.72, 2.36, 0], [-.62, 2.9, 0], [-.1, 3.2, 0], [.55, 3.06, 0], [.9, 2.62, 0], [.93, 2.3, 0]], .11, { caps: true, seg: 64, rs: 16 }), black);
    // steam from the whistle
    sp.updateMatrixWorld(true);
    const t = sp.localToWorld(new k.THREE.Vector3(0, 1.4, 0));
    [[0, .1, .75], [.2, .15, .65], [.45, .21, .55], [.75, .27, .45], [1.08, .31, .32]].forEach(([d, r, o], i) => {
      const puff = k.mat({ color: '#ffffff', transparent: true, opacity: o, roughness: 1, emissive: '#eef4ff', emissiveIntensity: .25, depthWrite: false });
      k.add(g, k.sphere(r, { w: 24, h: 16 }), puff, { p: [t.x - d * .5 + (i % 2 ? .06 : -.04), t.y + d * .95, t.z + (i % 2 ? .05 : -.05)], shadow: false });
    });
    return g;
  },

  // A cast iron skillet with an egg frying in it.
  skillet(k) {
    const g = k.group();
    const iron = k.mat({ color: '#3a393c', metalness: .5, roughness: .42, clearcoat: .35, clearcoatRoughness: .35 });
    const pan = warp(k.lathe([[0, 0], [1.66, 0], [1.74, .02], [1.8, .08], [1.84, .16], [1.98, .52], [2.04, .62], [2.03, .66], [1.98, .67], [1.93, .63],
      [1.79, .26], [1.74, .19], [1.66, .16], [0, .16]], { seg: 128 }), (x, y, z) => {
      if (y < .3) return [x, y, z];
      const a = Math.atan2(x, z), w = Math.exp(-((a / .2) ** 2)) + Math.exp(-(((Math.abs(a) - Math.PI) / .2) ** 2));
      const r = Math.hypot(x, z), r2 = r + w * .2 * ((y - .3) / .37) ** 2;
      return [x / r * r2, y - w * .03 * (y - .3), z / r * r2];
    });
    k.add(g, pan, iron);
    // long handle with a hanging hole, and the helper lug opposite
    const T = k.THREE, hs = new T.Shape();
    hs.moveTo(0, -.3); hs.lineTo(1.9, -.19); hs.quadraticCurveTo(2.35, -.2, 2.35, 0); hs.quadraticCurveTo(2.35, .2, 1.9, .19); hs.lineTo(0, .3); hs.closePath();
    hs.holes.push(k.circle(.09, 2.02, 0));
    k.add(g, soft(k.extrude(hs, .07, { bevel: .045, bevelSeg: 3 })), iron, { p: [1.9, .57, 0], r: [-Math.PI / 2, 0, .12] });
    const lug = new T.Shape(); lug.absarc(0, 0, .42, -Math.PI / 2, Math.PI / 2, false); lug.closePath();
    lug.holes.push((() => { const h = new T.Path(); h.absarc(.02, 0, .22, Math.PI / 2, -Math.PI / 2, true); h.closePath(); return h; })());
    k.add(g, soft(k.extrude(lug, .06, { bevel: .035 })), iron, { p: [-1.96, .6, 0], r: [-Math.PI / 2, 0, Math.PI + .1] });
    // the egg: crispy lace, white, yolk
    const blob = (r, n, jit) => { const s = new T.Shape(), pts = []; for (let i = 0; i < n; i++) { const a = i / n * k.TAU, rr = r * k.range(1 - jit, 1 + jit); pts.push(new T.Vector2(Math.cos(a) * rr * 1.1, Math.sin(a) * rr)); } s.moveTo(pts[0].x, pts[0].y); s.splineThru([...pts.slice(1), pts[0]]); return s; };
    const egg = k.group([], { p: [-.25, .16, .1], r: [0, .4, 0] });
    k.add(egg, soft(k.extrude(blob(.86, 12, .12), .01, { bevel: .02 })), k.mat({ color: '#d69a4a', roughness: .6 }), { p: [0, .02, 0], r: [-Math.PI / 2, 0, 0] });
    k.add(egg, soft(k.extrude(blob(.78, 11, .1), .04, { bevel: .045, bevelSeg: 4 })), k.mat({ color: '#fbfaf4', roughness: .3, clearcoat: .6 }), { p: [0, .06, 0], r: [-Math.PI / 2, 0, 0] });
    k.add(egg, k.sphere(.3, { w: 40, h: 24 }), k.gloss('#ffb21c'), { p: [.08, .11, -.05], s: [1, .55, 1] });
    g.add(egg);
    g.userData.view = { el: 36 };
    g.userData.fullView = { el: 28 };
    return g;
  },

  // A wooden rolling pin with red handles, dusted with flour.
  rollingpin(k) {
    const g = k.group(), pin = k.group([], { p: [0, .55, 0], r: [0, 0, Math.PI / 2] });
    g.add(k.group([pin], { r: [0, .12, 0] }));
    k.add(pin, k.lathe([[0, -1.8], [.45, -1.8], [.52, -1.77], [.55, -1.7], [.55, 1.7], [.52, 1.77], [.45, 1.8], [0, 1.8]], { seg: 64 }), woodMat(k, '#e8c690', '#b98a55', { varnish: .2 }));
    const flour = k.painted(512, 256, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      for (let i = 0; i < 14; i++) {            // powdery patches: clusters of fine dots, thick in the middle
        const x = k.rand() * w, y = h * (.2 + .6 * k.rand()), r = k.range(10, 30);
        for (let j = 0; j < 260; j++) {
          const a = k.rand() * k.TAU, d = r * Math.pow(k.rand(), .7);
          c.fillStyle = `rgba(255,254,249,${k.range(.35, .95) * (1 - d / r * .6)})`; c.fillRect(x + Math.cos(a) * d * 1.6, y + Math.sin(a) * d, k.range(1, 2.5), k.range(1, 2.5));
        }
      }
      for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(255,255,250,${k.range(.4, .9)})`; c.fillRect(k.rand() * w, h * (.1 + .8 * k.rand()), 1.5, 1.5); }
    }, { transparent: true, rough: .9 });
    k.add(pin, k.cyl(.556, .556, 3.3, { open: true, seg: 64 }), flour, { r: [0, -1.2, 0], shadow: false });
    const red = k.gloss('#d63a2c'), ring = k.metal('#d8dde3', .25);
    const handle = k.group([
      k.mesh(k.lathe([[0, 1.8], [.13, 1.8], [.13, 1.9]], { seg: 32 }), ring),
      k.mesh(k.lathe([[0, 1.88], [.16, 1.88], [.2, 1.93], [.19, 2.0], [.23, 2.12], [.27, 2.35], [.27, 2.6], [.25, 2.78], [.2, 2.9], [.1, 2.95], [0, 2.96]], { smooth: true, seg: 40 }), red),
    ]);
    pin.add(handle, k.group([handle.clone()], { r: [0, 0, Math.PI] }));
    g.userData.view = { el: 28 };
    g.userData.fullView = { el: 22 };
    return g;
  },
  // A countertop blender: steel motor base with five speed buttons, a glass jar of berry smoothie.
  blender(k) {
    const g = k.group();
    const steel = k.metal('#cdd2d8', .26), black = k.plastic('#1d1e22', { rough: .3 }), glass = k.glass('#eef9ff', { opacity: .2 });
    g.add(k.feet([[-.72, -.68], [.72, -.68], [-.72, .68], [.72, .68]], .12, .08));
    const base = warp(k.box(2.0, 1.5, 2.0, .3, 5), (x, y, z) => { const f = 1 - .1 * (y + .75) / 1.5; return [x * f, y, z * f]; });
    k.add(g, base, steel, { p: [0, .83, 0] });
    k.add(g, k.box(1.5, .62, .1, .05), black, { p: [0, .72, .965], r: [-.066, 0, 0] });                       // control panel
    g.add(k.instances(k.box(.2, .16, .08, .04), k.plastic('#e9ebee', { rough: .3 }), [0, 1, 2, 3, 4].map(i => ({ p: [(i - 2) * .26, .66, 1.02 + (i === 2 ? -.02 : 0)], r: [-.066, 0, 0] }))));
    g.add(k.instances(k.cyl(.025, .025, .02, { seg: 12 }), k.matte('#3a3d44', .4), [0, 1, 3, 4].map(i => ({ p: [(i - 2) * .26, .86, 1.0], r: [Math.PI / 2 - .066, 0, 0] }))));
    k.add(g, k.cyl(.03, .03, .02, { seg: 12 }), k.glow('#45c8ff', 3), { p: [0, .86, 1.0], r: [Math.PI / 2 - .066, 0, 0] });
    // jar collar, glass jar, smoothie, lid
    k.add(g, k.lathe([[0, 1.56], [.8, 1.56], [.82, 1.62], [.8, 1.9], [.72, 1.94], [0, 1.94]], { seg: 48 }), black);
    const R = y => .72 + .26 * (y - 1.9) / 2.3;
    const jar = warp(k.lathe([[0, 1.9], [R(1.9), 1.9], [R(4.2), 4.2], [R(4.2) - .04, 4.2], [R(2.1) - .04, 2.1], [0, 2.1]], { seg: 64 }), (x, y, z) => {
      if (y < 3.9) return [x, y, z];                        // pull the rim out into a pouring spout at the back left
      const a = Math.atan2(x, z) - k.deg(-120), w = Math.exp(-((Math.atan2(Math.sin(a), Math.cos(a)) / .35) ** 2)) * ((y - 3.9) / .3) ** 2;
      return [x * (1 + .16 * w), y, z * (1 + .16 * w)];
    });
    k.add(g, jar, glass, { shadow: false });
    const fill = 3.35, smoothie = k.mat({ color: '#d8457a', roughness: .5, clearcoat: .3 });
    k.add(g, k.lathe([[0, 2.1], [R(2.1) - .045, 2.1], [R(fill) - .045, fill], [0, fill]], { seg: 64 }), smoothie);
    k.add(g, k.disc(R(fill) - .046, 64), k.mat({ color: '#f07aa5', roughness: .7 }), { p: [0, fill + .002, 0], r: [-Math.PI / 2, 0, 0] });
    const marks = k.painted(256, 256, (c, w, h) => {
      c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.9)';
      for (let i = 0; i <= 8; i++) { const y = h - 20 - i * 27; c.fillRect(w / 2 - (i % 2 ? 22 : 38), y - 2, i % 2 ? 22 : 38, 4); if (i % 2 === 0 && i) k.text(c, String(i / 2), w / 2 + 16, y, { size: 26, color: 'rgba(255,255,255,.9)' }); }
    }, { transparent: true, rough: .2 });
    k.add(g, k.cyl(R(4.0) + .006, R(2.2) + .006, 1.8, { open: true, start: k.deg(12) - .4, len: .8 }), marks, { p: [0, 3.1, 0], shadow: false });
    k.add(g, k.tube([[R(4.05), 4.02, 0], [1.28, 3.96, 0], [1.42, 3.6, 0], [1.4, 2.6, 0], [1.2, 2.25, 0], [R(2.2), 2.2, 0]], .1, { caps: true, seg: 64, rs: 14 }), black);   // handle
    k.add(g, k.lathe([[0, 4.12], [R(4.2) - .02, 4.12], [R(4.2) + .04, 4.16], [R(4.2) + .045, 4.3], [R(4.2) - .02, 4.36], [.36, 4.38], [0, 4.38]], { seg: 64 }), black);
    k.add(g, k.rcyl(.3, .22, .05, { seg: 40 }), k.plastic('#3b3f47', { rough: .25, transparent: true, opacity: .92 }), { p: [0, 4.36, 0] });
    return g;
  },

  // A chef's knife with a walnut handle, and the carrot matchsticks it just cut.
  chefknife(k) {
    const g = k.group(), T = k.THREE, knife = k.group([], { r: [-Math.PI / 2, 0, 0] }), board = k.group([knife], { r: [0, .36, 0] });
    g.add(board);
    const blade = new T.Shape();
    blade.moveTo(0, 0); blade.lineTo(1.8, 0); blade.quadraticCurveTo(3.05, .02, 3.5, .56);
    blade.quadraticCurveTo(3.1, .88, 2.2, .95); blade.lineTo(0, .95); blade.closePath();
    const bladeTex = k.tex(512, 160, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(0,0,0,${k.range(.02, .07)})`; c.fillRect(0, k.rand() * h, w, 1); }    // brushed
      const edge = y => h - (y + .05) / 1.05 * h;
      c.fillStyle = 'rgba(40,50,60,.22)'; c.fillRect(0, edge(.3), w, edge(0) - edge(.3));                    // the ground bevel
      c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(0, edge(.035), w, 3);
    });
    bladeTex.repeat.set(1 / 3.7, 1 / 1.05); bladeTex.offset.set(.1 / 3.7, .05 / 1.05);
    k.add(knife, k.extrude(blade, .03, { bevel: .012, bevelSeg: 2 }), k.metal('#dde1e6', .18, { map: bladeTex }));
    k.add(knife, k.box(.24, .62, .17, .07), k.metal('#d2d7dd', .2), { p: [-.08, .63, 0] });                        // bolster
    const hs = new T.Shape();
    hs.moveTo(-.18, .43); hs.lineTo(-1.7, .4); hs.bezierCurveTo(-2.05, .38, -2.16, .5, -2.12, .7);
    hs.bezierCurveTo(-2.08, .9, -1.95, .94, -1.7, .92); hs.lineTo(-.18, .86); hs.closePath();
    const walnut = grainTex(k, '#7b4a2b', '#3e2212', { lines: 26, alpha: .5 }); walnut.rotation = Math.PI / 2;
    k.add(knife, soft(k.extrude(hs, .18, { bevel: .08, bevelSeg: 4 })), k.mat({ map: walnut, roughness: .38, clearcoat: .5, clearcoatRoughness: .2 }));
    k.add(knife, k.extrude(hs, .03, { bevel: .005, bevelSize: .085 }), k.metal('#c5cad1', .25));                   // the full tang, between the scales
    knife.add(k.instances(k.cyl(.055, .055, .02, { seg: 20 }), k.metal('#e4e8ec', .15), [-.55, -1.1, -1.65].map(x => ({ p: [x, .65, .175], r: [Math.PI / 2, 0, 0] }))));
    // a little heap of julienned carrot in front of the edge
    const carrot = k.gloss('#f27b1c', { rough: .35 }), sticks = [];
    for (let i = 0; i < 11; i++) {
      const layer = i < 7 ? 0 : 1;
      sticks.push({ p: [k.range(1.35, 2.35) + layer * .2, .045 + layer * .085, k.range(.28, .62) + layer * .08], r: [0, k.range(-.35, .35), 0], s: [k.range(.75, 1.05), 1, 1] });
    }
    board.add(k.instances(k.box(.62, .085, .085, .02), carrot, sticks));
    g.userData.view = { el: 38 };
    g.userData.fullView = { el: 26 };
    return g;
  },

  // An open Belgian waffle maker with a golden waffle, a pat of butter and syrup in the squares.
  waffleiron(k) {
    const g = k.group();
    const steel = k.metal('#c9ced4', .28), black = k.plastic('#1c1d21', { rough: .3 }), plate = k.plastic('#2a2b2f', { rough: .45 });
    g.add(k.feet([[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]], .14, .08));
    k.add(g, k.rcyl(1.65, .6, .18, { seg: 72 }), steel, { p: [0, .06, 0] });
    k.add(g, k.torus(1.64, .05, { rs: 10, ts: 72 }), black, { p: [0, .62, 0], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.cyl(1.5, 1.5, .04, { seg: 72 }), plate, { p: [0, .65, 0] });
    k.add(g, k.box(.62, .18, .5, .08), black, { p: [0, .42, 1.78] });                                  // front handle
    k.add(g, k.cyl(.04, .04, .04, { seg: 12 }), k.glow('#ff4a3a', 2.4), { p: [-.28, .32, 1.62], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.cyl(.04, .04, .04, { seg: 12 }), k.glow('#4dff7a', 2.4), { p: [.28, .32, 1.62], r: [Math.PI / 2, 0, 0] });
    // the waffle: a disc with a grid of ridges, syrup in some squares, butter on top
    const wy = .67, WR = 1.3, gold = k.mat({ color: '#eab45c', roughness: .62, clearcoat: .15 }), toasty = k.mat({ color: '#d69440', roughness: .55, clearcoat: .2 });
    k.add(g, k.rcyl(WR, .16, .06, { seg: 72 }), gold, { p: [0, wy, 0] });
    const ridges = [], sp = .34;
    for (let i = 0; i < 7; i++) {
      const d = (i - 3) * sp, L = 2 * Math.sqrt(Math.max(0, (WR - .04) ** 2 - d * d));
      ridges.push({ p: [0, wy + .2, d], s: [L, 1, 1] }, { p: [d, wy + .2, 0], r: [0, Math.PI / 2, 0], s: [L, 1, 1] });
    }
    g.add(k.instances(k.box(1, .14, .09, .035), toasty, ridges));
    const syrup = [], cells = [[0, 0], [1, 0], [0, 1], [-1, 0], [1, 1], [-1, -1], [2, 0], [0, -1], [1, -1], [-1, 1], [2, 1], [-2, 0], [1, 2]];
    for (const [a, b] of cells) syrup.push({ p: [(a - .5) * sp, wy + .205, (b - .5) * sp] });
    g.add(k.instances(k.box(.25, .06, .25, .02), k.gloss('#8f420e', { coatRough: .02 }), syrup));
    k.add(g, k.box(.38, .18, .34, .05), k.gloss('#ffe9a0', { rough: .3 }), { p: [-.12, wy + .36, -.12], r: [0, .5, 0] });
    // hinge and the open lid, showing its grid plate
    k.add(g, k.box(1.0, .36, .34, .1), black, { p: [0, .72, -1.66] });
    const lid = k.group([], { p: [0, .78, -1.62], r: [k.deg(-100), 0, 0] });
    k.add(lid, k.rcyl(1.65, .48, .18, { seg: 72 }), steel, { p: [0, .02, 1.62] });
    k.add(lid, k.torus(1.64, .05, { rs: 10, ts: 72 }), black, { p: [0, .02, 1.62], r: [Math.PI / 2, 0, 0] });
    k.add(lid, k.cyl(1.5, 1.5, .04, { seg: 72 }), plate, { p: [0, -.01, 1.62] });
    const pegs = [];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { const x = (i - 2.5) * sp, z = (j - 2.5) * sp; if (Math.hypot(x, z) < 1.2) pegs.push({ p: [x, -.07, 1.62 + z] }); }
    lid.add(k.instances(k.box(.25, .1, .25, .04), plate, pegs));
    k.add(lid, k.box(.6, .2, .5, .08), black, { p: [0, .25, 3.4] });
    g.add(lid);
    g.userData.view = { el: 26 };
    return g;
  },
  // A tilt-head stand mixer in glossy candy pink, with a polished steel bowl of cake batter.
  standmixer(k) {
    const g = k.group(), T = k.THREE, m = k.group([], { r: [0, -.35, 0] });
    g.add(m);
    const candy = k.gloss('#ea6197', { coatRough: .04 }), chrome = k.chrome(), bowlSteel = polished(k);
    // the body (column and head) as one extruded side profile, rounded by a big bevel
    const b = new T.Shape();
    b.moveTo(-3.9, 1.0); b.lineTo(-3.95, 7.4);
    b.quadraticCurveTo(-3.95, 10.8, -1.4, 10.8);
    b.lineTo(3.7, 10.85);
    b.bezierCurveTo(4.55, 10.85, 4.62, 12.2, 3.8, 12.25);
    b.bezierCurveTo(1.8, 12.5, -2.5, 12.55, -4.6, 12.3);
    b.bezierCurveTo(-5.5, 12.2, -5.6, 10.6, -5.0, 9.6);
    b.lineTo(-4.95, 3.0); b.lineTo(-5.05, 1.0); b.closePath();
    k.add(m, soft(k.extrude(b, 3.2, { bevel: 1.7, bevelSize: 1.5, bevelSeg: 10, curve: 40 })), candy);
    // the base, with the bowl clamping plate
    const plan = new T.Shape();
    plan.moveTo(-5.2, -3.1); plan.lineTo(3.8, -2.7); plan.bezierCurveTo(6.4, -2.4, 6.4, 2.4, 3.8, 2.7); plan.lineTo(-5.2, 3.1);
    plan.bezierCurveTo(-7.2, 3.1, -7.2, -3.1, -5.2, -3.1);
    k.add(m, soft(k.extrude(plan, .7, { bevel: .42, bevelSeg: 5 })), candy, { p: [0, .86, 0], r: [-Math.PI / 2, 0, 0] });
    k.add(m, k.cyl(2.7, 2.8, .16, { seg: 64 }), chrome, { p: [2.2, 1.78, 0] });
    m.add(k.feet([[-5.5, -2.2], [-5.5, 2.2], [3.8, -1.9], [3.8, 1.9]], .45, .12));
    // polished steel bowl with a handle, full of batter
    const bowl = k.group([], { p: [2.2, 1.85, 0] });
    k.add(bowl, k.lathe([[0, 0], [1.95, 0], [2.08, .08], [2.02, .38], [2.5, .62], [3.3, 1.5], [3.88, 3.0], [4.18, 4.8], [4.28, 6.1], [4.42, 6.3], [4.48, 6.45],
      [4.4, 6.56], [4.26, 6.5], [4.16, 6.2], [4.06, 4.8], [3.76, 3.0], [3.18, 1.62], [2.2, .72], [0, .62]], { seg: 96 }), bowlSteel);
    k.add(bowl, k.tube([[0, 5.7, 4.18], [0, 5.95, 5.15], [0, 5.2, 5.62], [0, 4.0, 5.2], [0, 3.35, 3.88]], .26, { caps: true, seg: 48, rs: 14 }), bowlSteel);
    const batter = k.mat({ color: '#f6dfa4', roughness: .38, clearcoat: .5, clearcoatRoughness: .3 });
    k.add(bowl, warp(k.lathe([[0, 5.35], [3.6, 5.35], [4.08, 5.3], [4.12, 5.12], [0, 5.1]], { seg: 96 }), (x, y, z) => y < 5.34 ? [x, y, z] : [x, y + .18 * Math.sin(Math.atan2(x, z) * 3 + Math.hypot(x, z) * 1.6) * Math.min(1, Math.hypot(x, z) / 1.5), z]), batter);
    m.add(bowl);
    // the beater shaft, down into the batter
    k.add(m, k.cyl(.22, .22, 3.4, { seg: 24 }), chrome, { p: [2.2, 8.6, 0] });
    k.add(m, k.cyl(.42, .42, .5, { seg: 24 }), chrome, { p: [2.2, 9.55, 0] });
    // chrome trim band, attachment hub, knob, speed lever and a blank badge
    const band = k.roundRect(6.75, 4.55, 1.72); band.holes.push(k.roundRect(6.45, 4.25, 1.6));
    k.add(m, k.extrude(band, .32, { bevel: .04 }), chrome, { p: [3.2, 11.55, 0], r: [0, Math.PI / 2, 0] });
    k.add(m, k.lathe([[0, 0], [1.25, 0], [1.3, .1], [1.22, .35], [.95, .56], [.5, .66], [0, .68]], { seg: 48 }), chrome, { p: [5.6, 11.55, 0], r: [0, 0, -Math.PI / 2] });
    k.add(m, k.cyl(.62, .62, .08, { seg: 36 }), k.metal('#bfc5cc', .3), { p: [6.3, 11.55, 0], r: [0, 0, -Math.PI / 2] });
    const knob = k.group([], { p: [4.6, 13.55, 0] });
    k.add(knob, k.cyl(.36, .42, .5, { seg: 24 }), chrome, { p: [0, .2, 0] });
    k.add(knob, k.box(1.1, .5, .22, .1), chrome, { p: [0, .62, 0] });
    m.add(knob);
    k.add(m, k.box(1.5, .22, .5, .1), chrome, { p: [-3.9, 12.15, 3.45], r: [0, 0, -.12] });                    // speed lever
    k.add(m, k.sphere(.26, { w: 20, h: 14 }), chrome, { p: [-3.15, 12.05, 3.62] });
    k.add(m, k.slab(2.6, .72, .12, .3), chrome, { p: [-.4, 11.55, 3.33] });
    g.userData.view = { el: 18 };
    return g;
  },
  // A chrome espresso machine pulling a double shot into a little cup.
  espresso(k) {
    const g = k.group();
    const chrome = k.chrome(), black = k.plastic('#1b1c20', { rough: .35 });
    const sheet = k.tex(256, 256, (c, w, h) => {           // polished sheet steel: a soft diagonal sheen and fine brushing
      const gr = c.createLinearGradient(0, 0, w, h);
      [[0, '#aeb5be'], [.3, '#f7f9fb'], [.45, '#dde2e8'], [.62, '#a3aab3'], [.8, '#d6dbe1'], [1, '#b8bfc7']].forEach(([t, col]) => gr.addColorStop(t, col));
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(${k.rand() < .5 ? '0,0,0' : '255,255,255'},${k.range(.03, .08)})`; c.fillRect(0, k.rand() * h, w, 1); }
    });
    const steel = k.metal('#ffffff', .24, { map: sheet });
    const walnut = k.mat({ map: grainTex(k, '#7b4a2b', '#3e2212', { lines: 22, alpha: .5 }), roughness: .35, clearcoat: .6, clearcoatRoughness: .2 });
    const white = k.ceramic('#fbfaf7');
    g.add(k.feet([[-4.2, -4.6], [4.2, -4.6], [-4.2, 3.6], [4.2, 3.6]], .5, .5, chrome));
    // body: brushed sides and top, a polished front panel, a cup rail on top
    k.add(g, k.box(10, 12, 10, .6, 4), steel, { p: [0, 6.5, -.5] });
    k.add(g, k.box(9.5, 11.5, .3, .14), chrome, { p: [0, 6.5, 4.52] });
    k.add(g, k.tube([[4.25, 13.2, 4.0], [-4.25, 13.2, 4.0], [-4.55, 13.2, 3.7], [-4.55, 13.2, -4.7], [-4.25, 13.2, -5.0], [4.25, 13.2, -5.0], [4.55, 13.2, -4.7], [4.55, 13.2, 3.7]], .12, { closed: true, seg: 160, rs: 10, tension: .2 }), chrome);
    g.add(k.instances(k.cyl(.1, .1, .8, { seg: 12 }), chrome, [[4.4, 3.85], [-4.4, 3.85], [-4.4, -4.85], [4.4, -4.85]].map(([x, z]) => ({ p: [x, 12.8, z] }))));
    // drip tray with a slotted grate
    k.add(g, k.box(8, 1.4, 4.2, .35), steel, { p: [0, 1.2, 6.4] });
    const grate = k.painted(512, 256, (c, w, h) => {
      c.fillStyle = '#e8ebee'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#15171a';
      for (let i = 0; i < 12; i++) c.beginPath(), c.roundRect(24 + i * 39.5, 22, 22, h - 44, 11), c.fill();
    }, { metal: 1, rough: .25 });
    k.add(g, k.plane(7.4, 3.7), grate, { p: [0, 1.905, 6.4], r: [-Math.PI / 2, 0, 0] });
    // the group head (E61 style), its lever, and the portafilter locked in
    k.add(g, k.cyl(1.05, 1.05, 1.6, { seg: 40 }), chrome, { p: [0, 8.4, 5.3], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.lathe([[0, 6.9], [1.3, 6.9], [1.42, 7.05], [1.42, 9.1], [1.3, 9.25], [1.05, 9.35], [1.02, 9.6], [.95, 9.95], [.7, 10.2], [.35, 10.3], [0, 10.32]], { seg: 48 }), chrome, { p: [0, 0, 6.0] });
    k.add(g, k.tube([[1.25, 9.2, 6.0], [1.6, 9.7, 6.0], [1.95, 10.35, 6.0]], .09, { caps: true }), chrome);
    k.add(g, k.sphere(.32, { w: 24, h: 16 }), black, { p: [2.0, 10.45, 6.0] });
    const pf = k.group([], { p: [0, 6.35, 6.0], r: [0, k.deg(-28), 0] });
    k.add(pf, k.lathe([[0, -.55], [1.25, -.55], [1.4, -.4], [1.48, .35], [1.3, .5], [0, .5]], { seg: 48 }), chrome);
    k.add(pf, k.box(3.1, .28, .5, .12), chrome, { p: [0, .3, 0] });                                                            // the locking ears
    const arm = k.group([], { p: [0, 0, 1.3], r: [k.deg(-8), 0, 0] });
    k.add(arm, k.cyl(.3, .36, 1.3, { seg: 24 }), chrome, { p: [0, 0, .5], r: [Math.PI / 2, 0, 0] });
    k.add(arm, k.lathe([[0, 0], [.38, 0], [.44, .3], [.47, 1.6], [.54, 2.9], [.56, 3.35], [.46, 3.66], [0, 3.72]], { smooth: true, seg: 32 }), walnut, { p: [0, 0, 1.1], r: [Math.PI / 2, 0, 0] });
    pf.add(arm);
    g.add(pf);
    k.add(g, k.box(1.3, .4, .7, .15), chrome, { p: [0, 5.65, 6.0] });
    for (const x of [-.36, .36]) {
      k.add(g, k.cyl(.12, .16, .5, { seg: 16 }), chrome, { p: [x, 5.3, 6.0] });
      k.add(g, k.tube([[x, 5.05, 6.0], [x * .8, 4.4, 6.0], [x * .55, 3.72, 6.0]], .055, { seg: 24, rs: 8 }), k.gloss('#5b2f14'));   // the double shot
    }
    // demitasse on a saucer, on the grate
    k.add(g, k.lathe([[0, 0], [1.6, 0], [1.95, .1], [2.08, .2], [1.98, .24], [1.3, .13], [0, .12]], { seg: 48 }), white, { p: [0, 1.91, 6.0] });
    const cup = k.group([], { p: [0, 2.03, 6.0] });
    k.add(cup, k.lathe([[0, 0], [.62, 0], [.7, .08], [.92, .9], [1.02, 1.6], [1.05, 1.72], [.99, 1.76], [.95, 1.66], [.86, .92], [.6, .22], [0, .2]], { seg: 48 }), white);
    const crema = k.painted(128, 128, (c, w, h) => {
      const gr = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      gr.addColorStop(0, '#d9a066'); gr.addColorStop(.7, '#b8753c'); gr.addColorStop(1, '#6b3a18');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }, { rough: .25, coat: .6 });
    k.add(cup, k.disc(.93, 40), crema, { p: [0, 1.5, 0], r: [-Math.PI / 2, 0, 0] });
    k.add(cup, k.torus(.34, .09, { arc: Math.PI * 1.2, rs: 12, ts: 24 }), white, { p: [.75, 1.1, .75], r: [0, Math.PI / 4, -Math.PI * .6] });
    g.add(cup);
    // steam wand and its knob; the water knob; gauge; switch and lamp; a blank red badge
    k.add(g, k.tube([[3.4, 8.3, 4.6], [3.5, 8.3, 5.5], [3.75, 7.4, 5.8], [4.05, 4.2, 6.1]], .13, { caps: true, seg: 48, rs: 12 }), chrome);
    k.add(g, k.cyl(.3, .3, .8, { seg: 20 }), chrome, { p: [3.4, 8.3, 4.95], r: [Math.PI / 2, 0, 0] });
    for (const x of [3.3, -3.3]) {
      k.add(g, k.cyl(.35, .35, .6, { seg: 24 }), chrome, { p: [x, x > 0 ? 10.4 : 7.4, 4.9], r: [Math.PI / 2, 0, 0] });
      k.add(g, k.rcyl(.7, .75, .2, { seg: 32 }), walnut, { p: [x, x > 0 ? 10.4 : 7.4, 5.1], r: [Math.PI / 2, 0, 0] });
    }
    const gauge = k.painted(256, 256, (c, w, h) => {
      c.fillStyle = '#f7f1e3'; c.beginPath(); c.arc(w / 2, h / 2, w / 2, 0, k.TAU); c.fill();
      const ang = v => Math.PI * .75 + v / 16 * Math.PI * 1.5;
      c.lineWidth = 14; c.strokeStyle = '#4caf6a'; c.beginPath(); c.arc(w / 2, h / 2, w * .36, ang(8), ang(11)); c.stroke();
      c.strokeStyle = '#d23a2a'; c.beginPath(); c.arc(w / 2, h / 2, w * .36, ang(13), ang(16)); c.stroke();
      c.strokeStyle = '#222'; c.lineCap = 'round';
      for (let v = 0; v <= 16; v++) { const a = ang(v), r0 = w * (v % 4 ? .4 : .36), r1 = w * .45; c.lineWidth = v % 4 ? 3 : 5; c.beginPath(); c.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0); c.lineTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1); c.stroke(); }
      for (let v = 0; v <= 16; v += 4) { const a = ang(v); k.text(c, String(v), w / 2 + Math.cos(a) * w * .25, h / 2 + Math.sin(a) * w * .25, { size: 26, color: '#222' }); }
      k.text(c, 'BAR', w / 2, h * .7, { size: 22, color: '#666' });
      const a = ang(9.2); c.strokeStyle = '#d0281c'; c.lineWidth = 6; c.beginPath(); c.moveTo(w / 2 - Math.cos(a) * 16, h / 2 - Math.sin(a) * 16); c.lineTo(w / 2 + Math.cos(a) * w * .42, h / 2 + Math.sin(a) * w * .42); c.stroke();
      c.fillStyle = '#222'; c.beginPath(); c.arc(w / 2, h / 2, 10, 0, k.TAU); c.fill();
    }, { rough: .3, coat: 1 });
    k.add(g, k.cyl(1.12, 1.12, .3, { seg: 40 }), chrome, { p: [-3.3, 10.4, 4.75], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.torus(1.02, .12, { rs: 12, ts: 48 }), chrome, { p: [-3.3, 10.4, 4.92] });
    k.add(g, k.disc(.98, 40), gauge, { p: [-3.3, 10.4, 4.91] });
    const badge = k.decal(3.6, .8, (c, w, h) => {
      c.fillStyle = '#c8281e'; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, h / 2 - 2); c.fill();
      c.strokeStyle = '#f4d9a0'; c.lineWidth = 4; c.beginPath(); c.roundRect(8, 8, w - 16, h - 16, h / 2 - 8); c.stroke();
      k.text(c, 'ESPRESSO', w / 2, h / 2 + 2, { size: 36, weight: 700, color: '#fff2d6', font: 'Fredoka' });
    }, { p: [0, 11.75, 4.68], px: 256 });
    g.add(badge);
    k.add(g, k.cyl(.16, .16, .1, { seg: 16 }), k.glow('#ffa23a', 2.6), { p: [-3.3, 6.2, 4.7], r: [Math.PI / 2, 0, 0] });
    // two cups warming on top
    for (const [x, z, a] of [[-2.2, -2.0, .5], [1.4, -2.8, -.3]]) {
      k.add(g, k.lathe([[0, 0], [.62, 0], [.7, .08], [.92, .9], [1.02, 1.6], [1.05, 1.72], [.99, 1.76], [.95, 1.66], [.86, .92], [.6, .22], [0, .2]], { seg: 40 }), white, { p: [x, 12.5, z] });
      k.add(g, k.torus(.34, .09, { arc: Math.PI * 1.2, rs: 12, ts: 24 }), white, { p: [x + Math.cos(a) * 1.02, 13.6, z - Math.sin(a) * 1.02], r: [0, a, -Math.PI * .6] });
    }
    g.userData.view = { el: 14 };
    return g;
  },
  // A pastel refrigerator whose door is a gallery: a child's drawing, a takeout menu, a photo, a list, and magnets.
  fridge(k) {
    const g = k.group(), T = k.THREE;
    const paint = k.gloss('#a9d2ec', { coatRough: .08 }), chrome = k.chrome(), dark = k.plastic('#2a2d33', { rough: .5 });
    g.add(k.instances(k.cyl(.9, .7, 1.6, { seg: 20 }), chrome, [[-14, 11], [14, 11], [-14, -11], [14, -11]].map(([x, z]) => ({ p: [x, .8, z] }))));
    k.add(g, k.box(33, 68.5, 26, 3.4, 5), paint, { p: [0, 35.75, -1] });
    k.add(g, k.slab(32.6, 19.2, 2.6, 3.2, .7), paint, { p: [0, 60.0, 13.3] });          // freezer door
    k.add(g, k.slab(32.6, 47.6, 2.6, 3.2, .7), paint, { p: [0, 26.2, 13.3] });          // main door
    k.add(g, k.box(31.4, 1.6, 1.4, .4), dark, { p: [0, 1.9, 11.6] });                    // kick plate
    g.add(k.instances(k.box(.35, .5, .1, .08), k.matte('#111316', .6), Array.from({ length: 14 }, (_, i) => ({ p: [-11.7 + i * 1.8, 1.9, 12.32] }))));
    // chrome bar handles and hinge caps
    const bar = (y0, y1) => k.add(g, k.tube([[-13.6, y0, 14.4], [-13.6, y0 + .4, 16.4], [-13.6, (y0 + y1) / 2, 16.6], [-13.6, y1 - .4, 16.4], [-13.6, y1, 14.4]], .6, { caps: true, seg: 64, rs: 14, tension: .3 }), chrome);
    bar(52.2, 59.5); bar(37.5, 48.4);
    g.add(k.instances(k.box(2.2, 1.2, 1.6, .4), chrome, [69.2, 50.3, 2.6].map(y => ({ p: [14.7, y, 13.6] }))));
    const front = 14.62;
    // a child's crayon drawing: house, sun, family, grass
    const crayon = (c, col, lw, pts) => { c.strokeStyle = col; c.lineWidth = lw; c.lineCap = c.lineJoin = 'round'; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); };
    g.add(k.decal(10.6, 13.4, (c, w, h) => {
      c.fillStyle = '#fffdf5'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(64, 64, 36, 0, k.TAU); c.fill();
      for (let i = 0; i < 10; i++) { const a = i / 10 * k.TAU; crayon(c, '#ffab00', 7, [[64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46], [64 + Math.cos(a) * 66, 64 + Math.sin(a) * 66]]); }
      c.fillStyle = '#ffb877'; c.fillRect(176, 250, 170, 150);
      crayon(c, '#d86a1e', 7, [[176, 250], [346, 250], [346, 400], [176, 400], [176, 250]]);
      c.fillStyle = '#e8392b'; c.beginPath(); c.moveTo(158, 258); c.lineTo(261, 160); c.lineTo(364, 258); c.closePath(); c.fill();
      c.fillStyle = '#7fd0ff'; c.fillRect(196, 278, 48, 44); crayon(c, '#2d6fd6', 5, [[220, 278], [220, 322]]); crayon(c, '#2d6fd6', 5, [[196, 300], [244, 300]]);
      c.fillStyle = '#8a5a34'; c.fillRect(272, 322, 46, 78);
      crayon(c, '#3fb54a', 12, Array.from({ length: 24 }, (_, i) => [8 + i * 17, 430 + (i % 2) * 22]));
      const kid = (x, y, s, col) => {
        c.fillStyle = '#ffd9b8'; c.beginPath(); c.arc(x, y, 18 * s, 0, k.TAU); c.fill(); crayon(c, '#6b4a2a', 4, [[x - 18 * s, y - 4], [x, y - 22 * s], [x + 18 * s, y - 4]]);
        crayon(c, col, 9, [[x, y + 18 * s], [x, y + 80 * s]]);
        crayon(c, col, 7, [[x - 34 * s, y + 42 * s], [x + 34 * s, y + 42 * s]]);
        crayon(c, '#3a3a8a', 7, [[x - 22 * s, y + 124 * s], [x, y + 80 * s], [x + 22 * s, y + 124 * s]]);
      };
      kid(70, 262, 1.15, '#9b4de0'); kid(128, 300, .8, '#e84a8a');
      c.fillStyle = '#e8392b'; c.beginPath(); c.moveTo(100, 206); c.bezierCurveTo(100, 188, 76, 188, 76, 206); c.bezierCurveTo(76, 220, 100, 232, 100, 240);
      c.bezierCurveTo(100, 232, 124, 220, 124, 206); c.bezierCurveTo(124, 188, 100, 188, 100, 206); c.fill();
      k.text(c, 'MOM', 300, 78, { size: 70, weight: 700, color: '#8a4de0', font: 'Fredoka' });
    }, { p: [1.6, 33.0, front], r: [0, 0, .05], px: 400 }));
    // takeout menu
    g.add(k.decal(5.6, 10.4, (c, w, h) => {
      c.fillStyle = '#fbf6ea'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#d8342a'; c.fillRect(0, 0, w, 120);
      k.text(c, 'PIZZA', w / 2, 58, { size: 62, weight: 700, color: '#fff6e0', font: 'Fredoka' });
      k.text(c, 'MENU', w / 2, 102, { size: 22, weight: 700, color: '#ffd6c8', font: 'Fredoka' });
      c.fillStyle = '#f6c343'; c.beginPath(); c.moveTo(w / 2 - 44, 150); c.lineTo(w / 2 + 44, 150); c.lineTo(w / 2, 230); c.closePath(); c.fill();
      c.fillStyle = '#c0392b'; for (const [x, y] of [[-16, 168], [14, 172], [0, 198]]) { c.beginPath(); c.arc(w / 2 + x, y, 8, 0, k.TAU); c.fill(); }
      c.fillStyle = 'rgba(60,60,70,.45)';
      for (let i = 0; i < 9; i++) { c.fillRect(24, 262 + i * 26, 130 + (i * 37 % 60), 8); c.fillRect(w - 64, 262 + i * 26, 40, 8); }
      c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(w / 2 - 2, 0, 4, h);
    }, { p: [-8.6, 16.5, front], r: [0, 0, -.06], px: 256 }));
    // a beach photo
    g.add(k.decal(5.0, 5.9, (c, w, h) => {
      c.fillStyle = '#fdfdfb'; c.fillRect(0, 0, w, h);
      const gr = c.createLinearGradient(0, 18, 0, 150); gr.addColorStop(0, '#4fb0f0'); gr.addColorStop(1, '#bfe6ff');
      c.fillStyle = gr; c.fillRect(18, 18, w - 36, 132);
      c.fillStyle = '#2f86d6'; c.fillRect(18, 150, w - 36, 40); c.fillStyle = '#f2d59a'; c.fillRect(18, 190, w - 36, 48);
      c.fillStyle = '#fff3a8'; c.beginPath(); c.arc(w - 60, 60, 22, 0, k.TAU); c.fill();
      c.fillStyle = '#e8392b'; c.beginPath(); c.arc(90, 186, 26, Math.PI, 0); c.fill(); c.fillStyle = '#5a3a22'; c.fillRect(88, 186, 4, 36);
    }, { p: [10.0, 44.4, front], r: [0, 0, .1], px: 256 }));
    // shopping list on a sticky note
    g.add(k.decal(5.2, 5.2, (c, w, h) => {
      c.fillStyle = '#ffe66d'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(0, 0, w, 30);
      ['milk', 'eggs', 'bread', 'ice cream!'].forEach((t, i) => k.text(c, t, 30, 70 + i * 48, { size: 36, weight: 600, color: '#2b3a8f', font: 'Nunito', align: 'left' }));
    }, { p: [10.2, 25.0, front], r: [0, 0, -.09], px: 256 }));
    // another masterpiece: a rainbow and a cloud
    g.add(k.decal(8.4, 6.6, (c, w, h) => {
      c.fillStyle = '#fffdf5'; c.fillRect(0, 0, w, h);
      ['#e8392b', '#ff9a1f', '#ffd23a', '#3fb54a', '#2f7de1', '#8a4de0'].forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 14; c.lineCap = 'round'; c.beginPath(); c.arc(w / 2, h * .86, 150 - i * 15, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); });
      c.fillStyle = '#ffffff'; c.strokeStyle = '#8fb8e8'; c.lineWidth = 5;
      for (const [x, y, r] of [[70, 160, 30], [100, 145, 36], [134, 162, 28]]) { c.beginPath(); c.arc(x, y, r, 0, k.TAU); c.fill(); c.stroke(); }
    }, { p: [8.6, 12.4, front], r: [0, 0, .07], px: 320 }));
    // magnets: heart and star on the drawing, round ones on the menu, photo and list, and HI on the freezer
    const heart = new T.Shape();
    heart.moveTo(0, -1); heart.bezierCurveTo(-.4, -.6, -1.05, -.25, -1.05, .3); heart.bezierCurveTo(-1.05, .8, -.4, 1.0, 0, .55);
    heart.bezierCurveTo(.4, 1.0, 1.05, .8, 1.05, .3); heart.bezierCurveTo(1.05, -.25, .4, -.6, 0, -1);
    k.add(g, soft(k.extrude(heart, .4, { bevel: .2, bevelSeg: 4 })), k.gloss('#e8303a'), { p: [-2.6, 39.6, front + .45], r: [0, 0, .2] });
    const star = new T.Shape();
    for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i / 10 * k.TAU, r = i % 2 ? .5 : 1.2; i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    k.add(g, soft(k.extrude(star, .35, { bevel: .15, bevelSeg: 3 })), k.gloss('#ffc81f'), { p: [6.4, 40.0, front + .4], r: [0, 0, -.2] });
    for (const [x, y, col] of [[-8.8, 21.2, '#2f7de1'], [9.7, 46.8, '#35b36a'], [10.1, 27.1, '#f07a1a'], [9.2, 13.6, '#9b4de0']])
      k.add(g, k.rcyl(.85, .6, .2, { seg: 32 }), k.gloss(col), { p: [x, y, front], r: [Math.PI / 2, 0, 0] });
    const red = k.gloss('#e8303a'), blue = k.gloss('#2f7de1');
    for (const [x, y, w, h, m] of [[4.6, 58.5, .8, 3.6, red], [6.6, 58.5, .8, 3.6, red], [5.6, 58.5, 1.4, .7, red], [8.8, 58.5, .8, 3.6, blue]])
      k.add(g, k.box(w, h, .7, .3), m, { p: [x, y, front + .3], r: [0, 0, x > 8 ? .12 : -.08] });
    g.userData.view = { el: 12 };
    return g;
  },
  // An air fryer with its basket pulled out, full of golden fries.
  airfryer(k) {
    const g = k.group();
    const shell = k.gloss('#f1ece2', { rough: .3, coat: .6, coatRough: .2 }), black = k.gloss('#1b1c20'), dark = k.plastic('#2a2b2f', { rough: .45 });
    g.add(k.feet([[-3.6, -3.8], [3.6, -3.8], [-3.6, 3.8], [3.6, 3.8]], .5, .4));
    const body = warp(k.box(10.5, 12.4, 12, 2.3, 6), (x, y, z) => { const f = 1 - .08 * (y + 6.2) / 12.4; return [x * f, y, z * f]; });
    k.add(g, body, shell, { p: [0, 6.6, 0] });
    // the control panel and its display on the upper front
    const face = y => 6 * (1 - .08 * (y - .4) / 12.4);
    k.add(g, k.slab(7.6, 3.3, .3, .7), black, { p: [0, 10.4, face(10.4) - .02], r: [-.04, 0, 0] });
    g.add(k.decal(6.8, 2.8, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      k.text(c, '400°', w * .3, h * .38, { size: 64, weight: 600, color: '#ff8a2a', font: 'Fredoka' });
      k.text(c, '15:00', w * .74, h * .38, { size: 44, weight: 600, color: '#ffb35a', font: 'Fredoka' });
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3;
      for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(w * (.14 + i * .18), h * .8, 13, 0, k.TAU); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,.8)';
      c.fillRect(w * .14 - 7, h * .8 - 2, 14, 4); c.fillRect(w * .86 - 7, h * .8 - 2, 14, 4); c.fillRect(w * .86 - 2, h * .8 - 7, 4, 14);
      c.beginPath(); c.moveTo(w * .5 - 5, h * .8 - 8); c.lineTo(w * .5 + 8, h * .8); c.lineTo(w * .5 - 5, h * .8 + 8); c.fill();
    }, { p: [0, 10.4, face(10.4) + .17], r: [-.04, 0, 0], glow: 1.1, px: 320 }));
    // the drawer, pulled out: a dark mouth in the body, the basket, its front with a handle, and fries
    const out = 4.2;
    k.add(g, k.box(8.9, 6.4, .4, .7), k.plastic('#141518', { rough: .6 }), { p: [0, 4.1, face(4.1) - .05] });
    k.add(g, k.box(8.0, 4.6, 8.0, .5), dark, { p: [0, 3.2, 6 + out - 4.4] });
    for (const x of [-3.85, 3.85]) k.add(g, k.box(.3, 1.8, out + .6, .12), dark, { p: [x, 6.0, 6 + out / 2 - .2] });
    k.add(g, k.slab(9.4, 6.9, 1.1, 1.3, .35), shell, { p: [0, 4.05, 6 + out + .4] });
    k.add(g, k.box(4.6, 1.3, 2.0, .55), black, { p: [0, 5.3, 6 + out + 1.6] });
    k.add(g, k.box(3.6, .5, 1.2, .2), k.plastic('#0e0f11', { rough: .5 }), { p: [0, 4.6, 6 + out + 1.2] });
    const fries = [], tones = ['#f2b544', '#e9a53a', '#f7c65c', '#dc9a36', '#f4bb4c'];
    for (let i = 0; i < 30; i++) {
      const layer = i < 14 ? 0 : i < 24 ? 1 : 2;
      fries.push({ p: [k.range(-3.2, 3.2), 5.75 + layer * .38 + k.range(0, .12), k.range(6.6, 6 + out - .3)], r: [k.range(-.25, .25), k.range(0, Math.PI), k.range(-.2, .2)],
        s: [1, 1, k.range(.7, 1.15)], color: k.pick(tones) });
    }
    g.add(k.instances(k.box(.38, .38, 2.6, .1), k.mat({ color: '#ffffff', roughness: .55, clearcoat: .25 }), fries));
    g.userData.view = { el: 24 };
    g.userData.fullView = { el: 22 };
    return g;
  },

  // A microwave reheating leftovers (the middle is still frozen), about to beep at 0:01.
  microwave(k) {
    const g = k.group();
    const steel = k.metal('#c9ced4', .3), black = k.gloss('#16171b'), chrome = k.chrome();
    g.add(k.feet([[-8.6, -6], [8.6, -6], [-8.6, 6], [8.6, 6]], .5, .45));
    const ring = k.roundRect(20, 11.6, 1.1); ring.holes.push(k.roundRect(18.9, 10.5, .3));
    k.add(g, k.extrude(ring, 14.2, { bevel: .1 }), steel, { p: [0, 6.25, -.4] });
    k.add(g, k.box(19.2, 10.8, .4), steel, { p: [0, 6.25, -7.3] });
    // the lit cavity behind the door: an inside-out box, a glass turntable, a bowl of soup with an ice cube in it
    const inside = k.mat({ color: '#5a4a30', emissive: '#ffd07a', emissiveIntensity: .95, roughness: .9, side: k.THREE.BackSide });
    k.add(g, k.box(12.4, 10.0, 13.0), inside, { p: [-3.1, 6.25, 0], shadow: false }).receiveShadow = false;
    k.add(g, k.cyl(4.6, 4.6, .16, { seg: 48 }), k.glass('#dff4ff', { opacity: .45 }), { p: [-3.1, 1.55, -.6] });
    const bowl = k.group([], { p: [-3.1, 1.63, -.2] });
    k.add(bowl, k.lathe([[0, 0], [1.3, 0], [1.4, .12], [2.3, 1.4], [2.45, 1.72], [2.36, 1.76], [2.2, 1.45], [1.3, .3], [0, .26]], { seg: 48 }), k.ceramic('#fbfaf6'));
    k.add(bowl, k.disc(2.22, 48), k.mat({ color: '#e0662a', roughness: .3, clearcoat: .6 }), { p: [0, 1.38, 0], r: [-Math.PI / 2, 0, 0] });
    k.add(bowl, k.box(1.1, .7, 1.1, .18), k.mat({ color: '#e6f8ff', roughness: .08, clearcoat: 1, emissive: '#bfe9ff', emissiveIntensity: .25 }), { p: [.1, 1.55, .1], r: [.1, .6, .08] });
    g.add(bowl);
    // the door: a black frame, a screened window, a chrome handle
    const door = k.roundRect(13.4, 11.0, .6); door.holes.push(k.roundRect(10.6, 8.0, .5));
    k.add(g, k.extrude(door, .4, { bevel: .1 }), black, { p: [-3.05, 6.25, 7.15] });
    const screen = k.painted(512, 384, (c, w, h) => {
      c.fillStyle = 'rgba(12,14,18,.55)'; c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'destination-out';
      for (let y = 4; y < h; y += 8) for (let x = (y / 8 % 2) * 4 + 4; x < w; x += 8) { c.beginPath(); c.arc(x, y, 2.4, 0, k.TAU); c.fill(); }
    }, { transparent: true, rough: .9 });
    screen.depthWrite = false; screen.envMapIntensity = 0;
    k.add(g, k.plane(10.8, 8.2), screen, { p: [-3.05, 6.25, 7.12], shadow: false });
    k.add(g, k.box(1.6, 10.8, .3), black, { p: [3.85, 6.25, 6.85] });                 // closes the gap between door and panel
    k.add(g, k.tube([[3.0, 2.6, 7.45], [3.05, 2.9, 8.35], [3.05, 9.6, 8.35], [3.0, 9.9, 7.45]], .28, { caps: true, seg: 48, rs: 12, tension: .2 }), chrome);
    // control panel: display, keypad, start and stop
    k.add(g, k.slab(5.6, 11.0, .5, .5), black, { p: [7.0, 6.25, 7.1] });
    g.add(k.decal(4.4, 1.7, (c, w, h) => {
      c.fillStyle = '#06110c'; c.beginPath(); c.roundRect(0, 0, w, h, 12); c.fill();
      k.text(c, '0:01', w / 2, h / 2 + 4, { size: 76, weight: 600, color: '#6dffb0', font: 'Fredoka' });
    }, { p: [7.0, 10.0, 7.37], glow: 1.4, px: 256 }));
    g.add(k.decal(4.4, 7.4, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      const bw = 64, bh = 46, gx = 14, x0 = (w - 3 * bw - 2 * gx) / 2;
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''].forEach((t, i) => {
        if (!t) return;
        const x = x0 + (i % 3) * (bw + gx), y = 16 + Math.floor(i / 3) * (bh + 14);
        c.fillStyle = '#34363d'; c.beginPath(); c.roundRect(x, y, bw, bh, 10); c.fill();
        k.text(c, t, x + bw / 2, y + bh / 2 + 2, { size: 30, weight: 600, color: '#f2f2f2', font: 'Fredoka' });
      });
      const y = 16 + 4 * (bh + 14) + 8;
      c.fillStyle = '#e0443a'; c.beginPath(); c.roundRect(x0, y, 100, 58, 12); c.fill(); k.text(c, 'STOP', x0 + 50, y + 31, { size: 24, color: '#fff' });
      c.fillStyle = '#35b36a'; c.beginPath(); c.roundRect(w - x0 - 100, y, 100, 58, 12); c.fill(); k.text(c, 'START', w - x0 - 50, y + 31, { size: 24, color: '#fff' });
    }, { p: [7.0, 5.0, 7.37], px: 256 }));
    g.userData.view = { az: 18, el: 12 };
    return g;
  },
};
