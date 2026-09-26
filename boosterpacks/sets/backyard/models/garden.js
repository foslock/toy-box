// Models for the Backyard set's garden cards. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- local helpers ---------- */
const TAU = Math.PI * 2;
const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

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
// Move every vertex with fn(v) (a Vector3 to change in place), then redo the normals and weld the seams.
function warp(k, geo, fn) {
  const p = geo.attributes.position, v = new k.THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v, i); p.setXYZ(i, v.x, v.y, v.z); }
  p.needsUpdate = true; geo.computeVertexNormals();
  return weld(geo);
}

// A surface from fn(u, v) => [x, y, z] over the unit square, with (u, v) as its UVs.
function surface(k, fn, nu, nv) {
  const T = k.THREE, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { pos.push(...fn(i / nu, j / nv)); uv.push(i / nu, j / nv); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return weld(geo);
}

const curveOf = (k, pts, closed = false) => new k.THREE.CatmullRomCurve3(pts.map(q => Array.isArray(q) ? new k.THREE.Vector3(...q) : q.clone()), closed);

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
// Turn an object so its own axis (default +y) points along n.
const aim = (k, obj, n, axis = [0, 1, 0]) => { obj.quaternion.setFromUnitVectors(new k.THREE.Vector3(...axis), (n.isVector3 ? n.clone() : new k.THREE.Vector3(...n)).normalize()); return obj; };
// Turn an object so its local +y runs along L and its local +z (its face) points as near to N as it can.
function orient(k, obj, L, N) {
  const T = k.THREE, y = (L.isVector3 ? L.clone() : new T.Vector3(...L)).normalize(), n = N.isVector3 ? N.clone() : new T.Vector3(...N);
  const z = n.addScaledVector(y, -n.dot(y)).normalize(), x = new T.Vector3().crossVectors(y, z);
  obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
  return obj;
}
// Euler angles (XYZ, for k.instances) that turn +y to point along d, after first spinning `spin` about y.
function eulerTo(k, d, spin = 0) {
  const T = k.THREE, q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), (d.isVector3 ? d.clone() : new T.Vector3(...d)).normalize());
  q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), spin));
  const e = new T.Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z];
}

/* ---------- tomatoes ---------- */
// A tomato body standing on y = 0: radius R, n gentle lobes of depth `lobe`, squashed to `squash` of round.
// Returns { geo, surf(th, phi) → Vector3 on the skin (th from the top) }.
function tomatoBody(k, R, n, lobe, squash, ph = 0) {
  const T = k.THREE;
  const shape = (th, phi) => {
    const w = smooth(0, .55, th) * (1 - .6 * smooth(1.1, 2.8, th));
    const rr = 1 + lobe * (Math.pow(Math.abs(Math.cos((n * phi + ph) / 2)), .6) - .7) * w + .018 * Math.sin(2 * phi + 1.3) * Math.sin(th);
    const y = Math.cos(th) * squash - .16 * squash * Math.exp(-((th / .42) ** 2)) + .05 * squash * Math.exp(-(((Math.PI - th) / .5) ** 2));
    return [Math.sin(th) * Math.sin(phi) * rr, y, Math.sin(th) * Math.cos(phi) * rr];
  };
  // the lowest point, so it stands on the floor
  let lo = Infinity; for (let i = 0; i <= 40; i++) lo = Math.min(lo, shape(Math.PI * (.6 + .4 * i / 40), 0)[1], shape(Math.PI * (.6 + .4 * i / 40), .6)[1]);
  const surf = (th, phi) => { const [x, y, z] = shape(th, phi); return new T.Vector3(x * R, (y - lo) * R, z * R); };
  const geo = new T.SphereGeometry(1, 96, 64), p = geo.attributes.position, cols = [];
  const top = new T.Color('#e8421a'), mid = new T.Color('#d61c0e'), bot = new T.Color('#b3140b');
  for (let i = 0; i < p.count; i++) {
    const y = Math.max(-1, Math.min(1, p.getY(i))), th = Math.acos(y), phi = Math.atan2(p.getX(i), p.getZ(i));
    const v = surf(th, phi); p.setXYZ(i, v.x, v.y, v.z);
    const c = mid.clone().lerp(top, .7 * (1 - smooth(.15, .7, th))).lerp(bot, smooth(1.6, 3.0, th) * .7);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals(); weld(geo);
  return { geo, surf };
}
// The green star on top: `n` pointed sepals lying on the skin from the stem outwards, their tips curling.
function calyxGeo(k, surf, R, n, len, wid, curl, ph = 0) {
  const T = k.THREE, geos = [];
  for (let i = 0; i < n; i++) {
    const phi = ph + i / n * TAU + k.range(-.2, .2), L = len * k.range(.85, 1.15), c = curl * k.range(.6, 1.3);
    const pts = [];
    for (let j = 0; j <= 6; j++) {
      const t = j / 6, th = .03 + t * L;
      const s = surf(th, phi), out = new T.Vector3(Math.sin(phi), 0, Math.cos(phi));
      s.y += R * (.02 + c * t ** 2.4); s.addScaledVector(out, R * c * .25 * t ** 3);
      pts.push(s);
    }
    const cv = curveOf(k, pts);
    geos.push(varTube(k, cv, (s, Lc) => { const q = s / Lc; return wid * R * (q < .12 ? .75 + 2 * q : 1) * Math.pow(Math.max(0, 1 - q), .75) + .004 * R; }, { flat: .28, seg: 24, rs: 10 }));
  }
  return k.merge(geos);
}
// A whole tomato: body, calyx and a stem stub, standing on y = 0 at the origin.
function makeTomato(k, R, o = {}) {
  const T = k.THREE, g = k.group();
  const { geo, surf } = tomatoBody(k, R, o.lobes ?? 5, o.lobe ?? .09, o.squash ?? .8, o.ph ?? 0);
  const skin = k.mat({ color: '#ffffff', vertexColors: true, roughness: .2, clearcoat: 1, clearcoatRoughness: .05 });
  k.add(g, geo, skin);
  const green = o.green ?? k.plastic('#4c8a2a', { rough: .5, coat: .3 });
  k.add(g, calyxGeo(k, surf, R, o.sepals ?? 6, o.sepalLen ?? .78, o.sepalWid ?? .075, o.curl ?? .1, o.ph ?? 0), green);
  const topP = surf(0, 0);
  k.add(g, k.sphere(R * .075, { w: 16, h: 10 }), green, { p: [topP.x, topP.y + R * .02, topP.z], s: [1, .55, 1] });
  return { g, surf, top: topP };
}

export default {
  // A paper seed packet, a little puffed up with seeds: a painted sunflower on the front, pinked edges, a few seeds spilled.
  seedpacket(k) {
    const T = k.THREE, g = k.group();
    const W = 3, H = 4.5, puff = .2;
    // pinking-shear zigzag along the top and bottom edges (cut out of the paper's alpha)
    const pink = (c, w, h) => {
      c.globalCompositeOperation = 'destination-out';
      const n = 30, s = w / n, d = h * .014;
      for (const y0 of [0, h]) {
        c.beginPath();
        for (let i = 0; i < n; i++) { c.moveTo(i * s, y0); c.lineTo(i * s + s / 2, y0 + (y0 ? -d : d)); c.lineTo(i * s + s, y0); }
        c.fill();
      }
      c.globalCompositeOperation = 'source-over';
    };
    const crimp = (c, w, h, y0, y1) => {
      c.fillStyle = 'rgba(120,90,40,.12)'; c.fillRect(0, y0, w, y1 - y0);
      for (let x = 3; x < w; x += 7) { c.fillStyle = 'rgba(90,60,20,.22)'; c.fillRect(x, y0, 2, y1 - y0); }
    };
    const front = k.tex(600, 900, (c, w, h) => {
      c.fillStyle = '#f7eed6'; c.fillRect(0, 0, w, h);
      crimp(c, w, h, 0, 44); crimp(c, w, h, h - 26, h);
      c.strokeStyle = '#d2a54a'; c.lineWidth = 5; c.beginPath(); c.roundRect(18, 58, w - 36, h - 98, 18); c.stroke();
      // title band
      c.fillStyle = '#2f7a32'; c.beginPath(); c.roundRect(34, 72, w - 68, 118, 14); c.fill();
      k.text(c, 'SUNFLOWER', w / 2, 134, { size: 84, weight: 700, color: '#ffd23a', stroke: '#1d4d1f', strokeWidth: 10 });
      k.text(c, 'Giant Mammoth', w / 2, 222, { size: 40, weight: 700, color: '#2f7a32', font: 'Nunito, sans-serif' });
      // the painted picture
      const px = 40, py = 252, pw = w - 80, ph = 470;
      c.save(); c.beginPath(); c.roundRect(px, py, pw, ph, 16); c.clip();
      let gr = c.createLinearGradient(0, py, 0, py + ph); gr.addColorStop(0, '#5fb7ee'); gr.addColorStop(.62, '#cdeeff'); gr.addColorStop(.63, '#8fcf5c'); gr.addColorStop(1, '#4f9a36');
      c.fillStyle = gr; c.fillRect(px, py, pw, ph);
      c.fillStyle = 'rgba(255,255,255,.85)';
      for (const [x, y, r] of [[120, 330, 26], [150, 320, 34], [185, 332, 24], [430, 300, 20], [455, 292, 27], [482, 302, 19]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
      c.fillStyle = '#ffe680'; c.beginPath(); c.arc(505, 330, 0, 0, TAU); c.fill();
      const flower = (x, y, R, rot) => {
        c.strokeStyle = '#3f8a2a'; c.lineWidth = R * .16; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - R * .2, y + R * 1.6, x + R * .05, py + ph + 20); c.stroke();
        for (const [s, ly] of [[-1, 1.5], [1, 2.2]]) {
          c.save(); c.translate(x - R * .08, y + R * ly); c.rotate(s * .9); c.fillStyle = '#4c9a30';
          c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(s * R * .3, -R * .5, s * R * 1.0, -R * .45, s * R * 1.15, -R * .05); c.bezierCurveTo(s * R * .9, R * .25, s * R * .35, R * .25, 0, 0); c.fill();
          c.strokeStyle = 'rgba(30,80,20,.6)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(s * R * .5, -R * .15, s * R * 1.05, -R * .05); c.stroke();
          c.restore();
        }
        for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 18; i++) {
          const a = rot + i / 18 * TAU + ring * TAU / 36;
          c.save(); c.translate(x, y); c.rotate(a);
          c.fillStyle = ring ? '#ffc21c' : '#f09d0e';
          c.beginPath(); c.moveTo(-R * .12, R * .3); c.quadraticCurveTo(-R * .2, R * .75, 0, R * (ring ? .98 : 1.05)); c.quadraticCurveTo(R * .2, R * .75, R * .12, R * .3); c.closePath(); c.fill();
          c.restore();
        }
        let dg = c.createRadialGradient(x - R * .1, y - R * .1, 0, x, y, R * .42); dg.addColorStop(0, '#6a4a1a'); dg.addColorStop(.5, '#4a2c12'); dg.addColorStop(1, '#2c170a');
        c.fillStyle = dg; c.beginPath(); c.arc(x, y, R * .42, 0, TAU); c.fill();
        c.fillStyle = 'rgba(220,170,60,.55)';
        for (let i = 0; i < 90; i++) { const a = i * 2.39996, r = R * .4 * Math.sqrt(i / 90); c.beginPath(); c.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, R * .018, 0, TAU); c.fill(); }
      };
      flower(160, 430, 70, .3);
      flower(360, 470, 128, 0);
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(px, py, pw, 6);
      c.restore();
      c.strokeStyle = '#8a6a2a'; c.lineWidth = 4; c.beginPath(); c.roundRect(px, py, pw, ph, 16); c.stroke();
      // small print and a seed count badge
      k.text(c, 'ANNUAL · FULL SUN', 44, 760, { size: 27, weight: 800, color: '#6b4a1e', font: 'Nunito, sans-serif', align: 'left' });
      k.text(c, 'Sow 1 in. deep after', 44, 796, { size: 22, weight: 700, color: '#8a6a3e', font: 'Nunito, sans-serif', align: 'left' });
      k.text(c, 'the last frost. Grows 8–12 ft.', 44, 822, { size: 22, weight: 700, color: '#8a6a3e', font: 'Nunito, sans-serif', align: 'left' });
      c.fillStyle = '#d8402f'; c.beginPath(); c.arc(496, 790, 58, 0, TAU); c.fill();
      c.strokeStyle = '#fff3d6'; c.lineWidth = 3; c.setLineDash([6, 5]); c.beginPath(); c.arc(496, 790, 50, 0, TAU); c.stroke(); c.setLineDash([]);
      k.text(c, '50', 496, 778, { size: 46, weight: 700, color: '#fff' });
      k.text(c, 'SEEDS', 496, 816, { size: 18, weight: 800, color: '#fff3d6', font: 'Nunito, sans-serif' });
      pink(c, w, h);
    });
    const back = k.tex(300, 450, (c, w, h) => {
      c.fillStyle = '#f2e7cb'; c.fillRect(0, 0, w, h);
      crimp(c, w, h, 0, 22); crimp(c, w, h, h - 13, h);
      k.text(c, 'HOW TO GROW', w / 2, 60, { size: 28, weight: 700, color: '#2f7a32' });
      c.fillStyle = 'rgba(110,80,40,.45)';
      for (let i = 0; i < 12; i++) c.fillRect(30, 96 + i * 22, (w - 60) * (i % 4 === 3 ? .6 : 1), 7);
      pink(c, w, h);
    });
    const paper = map => k.mat({ map, roughness: .78, side: T.FrontSide, alphaTest: .5, sheen: .3, sheenColor: '#ffffff' });
    const sheet = (side, map) => {
      const geo = new T.PlaneGeometry(W, H, 36, 54);
      if (side < 0) geo.rotateY(Math.PI);
      warp(k, geo, v => {
        const u = v.x / (W / 2), t = v.y / (H / 2);
        const f = Math.pow(Math.max(0, 1 - u * u), .45) * smooth(.99, .86, t) * smooth(-.995, -.9, t);
        v.z = side * puff / 2 * f - .1 * u * u;
        v.y += H / 2;
      });
      return k.mesh(geo, paper(map));
    };
    const pk = k.group([sheet(1, front), sheet(-1, back)], { r: [-.09, .34, 0], p: [.1, 0, -.1] });
    pk.children.forEach(m => { m.position.y = .02; });
    g.add(pk);
    // spilled sunflower seeds: black with pale stripes
    const stripes = k.tex(128, 64, (c, w, h) => {
      c.fillStyle = '#1f1b19'; c.fillRect(0, 0, w, h);
      for (const [x, sw] of [[6, 3], [20, 2], [31, 4], [47, 2], [63, 4], [80, 2], [95, 3], [112, 2]]) {
        c.fillStyle = '#d9d2c4'; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 3, h * .3, x - 3, h * .7, x + 1, h); c.lineTo(x + 1 + sw, h); c.bezierCurveTo(x + sw - 3, h * .7, x + sw + 3, h * .3, x + sw, 0); c.fill();
      }
      c.fillStyle = 'rgba(40,30,25,.5)'; c.fillRect(0, 0, w, h * .1); c.fillRect(0, h * .9, w, h * .1);
    });
    const seedGeo = warp(k, k.sphere(1, { w: 20, h: 14 }), v => { const t = (v.y + 1) / 2; const s = 1 - .6 * t ** 1.6; v.x *= .1 * s; v.z *= .055 * s; v.y *= .21; });
    const seeds = [];
    for (const [x, z, yaw] of [[.95, .55, .4], [1.3, .85, 2.1], [.6, .85, -.8], [1.75, .45, 1.2], [1.05, 1.2, -1.9], [.2, .75, 2.8], [1.55, 1.25, .9]]) {
      seeds.push({ p: [x, .05, z], order: 'YXZ', r: [Math.PI / 2, yaw, k.range(-.15, .15)] });
    }
    g.add(k.instances(seedGeo, k.mat({ map: stripes, roughness: .45, clearcoat: .4, clearcoatRoughness: .3 }), seeds));
    g.userData.view = { az: 26, el: 18 };
    return g;
  },

  // A glossy ripe tomato with its green star, and two cherry tomatoes still on a bit of vine.
  tomato(k) {
    const T = k.THREE, g = k.group(), V = (x, y, z) => new T.Vector3(x, y, z);
    const green = k.plastic('#4c8a2a', { rough: .5, coat: .3 }), vine = k.plastic('#5d9a36', { rough: .55, coat: .2 });
    const big = makeTomato(k, 1, { lobes: 5, lobe: .1, squash: .8, sepals: 6, curl: .12, green, ph: .3 });
    g.add(big.g);
    // a short stem, cut clean
    const tp = big.top.clone();
    const sc = curveOf(k, [[tp.x, tp.y - .02, tp.z], [tp.x + .01, tp.y + .1, tp.z], [tp.x + .05, tp.y + .2, tp.z + .01], [tp.x + .12, tp.y + .27, tp.z + .02]]);
    k.add(g, varTube(k, sc, s => .058 - .01 * s / sc.getLength(), { seg: 24, rs: 12 }), green);
    const end = sc.getPointAt(1), dir = sc.getTangentAt(1);
    const cut = aim(k, k.group([], { p: end.toArray() }), dir); g.add(cut);
    k.add(cut, k.cyl(.049, .049, .012, { seg: 20 }), k.matte('#b9cf7a', .6));
    // fresh from the garden hose: a few droplets on its shoulder
    const drop = k.mat({ color: '#ffffff', roughness: 0, transparent: true, opacity: .3, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 2.2 });
    for (const [th, phi, r] of [[.82, .62, .075], [1.08, .34, .05], [.64, 1.02, .042], [1.22, .8, .036]]) {
      const P = big.surf(th, phi), n = big.surf(th + .01, phi).sub(big.surf(th - .01, phi)).cross(big.surf(th, phi + .01).sub(big.surf(th, phi - .01))).normalize();
      if (n.dot(V(P.x, 0, P.z)) < 0) n.negate();
      const dg = aim(k, k.group([], { p: P.toArray() }), n); g.add(dg);
      k.add(dg, k.sphere(r, { w: 20, h: 10, thetaLen: Math.PI / 2 }), drop, { s: [1, .62, 1], shadow: false });
      k.add(dg, k.sphere(r * .22, { w: 8, h: 6 }), k.glow('#ffffff', 1.3), { p: [-r * .3, r * .5, r * .25], s: [1, .6, 1], shadow: false });
    }
    // cherry tomatoes on their truss
    const cherries = [[.98, .78, 1.1], [1.52, .08, 2.3]].map(([x, z, ph]) => {
      const c = makeTomato(k, .34, { lobes: 3, lobe: .012, squash: .93, sepals: 5, sepalLen: .95, sepalWid: .09, curl: .35, green, ph });
      c.g.position.set(x, 0, z); c.g.rotation.y = ph; g.add(c.g);
      return c.top.clone().applyAxisAngle(new T.Vector3(0, 1, 0), ph).add(c.g.position);
    });
    const [a, b] = cherries;
    const j1 = a.clone().add(V(.1, .2, -.1)), j2 = b.clone().add(V(-.12, .2, .1));
    const mid = j1.clone().lerp(j2, .5).add(V(0, .07, 0));
    const truss = curveOf(k, [j1.clone().add(V(-.26, -.03, .2)), j1, mid, j2, j2.clone().add(V(.22, .1, -.24))]);
    k.add(g, varTube(k, truss, () => .034, { seg: 60, rs: 10 }), vine);
    for (const [top, j] of [[a, j1], [b, j2]]) {
      const kn = top.clone().lerp(j, .55).add(V(0, .05, 0));
      const pc = curveOf(k, [top.clone().add(V(0, -.01, 0)), top.clone().add(V(0, .07, 0)), kn, j]);
      k.add(g, varTube(k, pc, () => .022, { seg: 24, rs: 8 }), vine);
      k.add(g, k.sphere(.033, { w: 12, h: 8 }), vine, { p: kn.toArray() });
    }
    for (const e of [truss.getPointAt(0), truss.getPointAt(1)]) {
      const cap = aim(k, k.group([], { p: e.toArray() }), truss.getTangentAt(e === truss.getPointAt(0) ? 0 : 1)); g.add(cap);
      k.add(cap, k.cyl(.034, .034, .01, { seg: 16 }), k.matte('#b9cf7a', .6));
    }
    g.userData.view = { az: 28, el: 24 };
    return g;
  },

  // A sunflower on its sturdy stem: a big golden head nodding towards you, a spiral of seeds, three big leaves.
  sunflower(k) {
    const T = k.THREE, g = k.group(), V = (x, y, z) => new T.Vector3(x, y, z);
    const stemMat = k.mat({ color: '#5a8f2e', roughness: .7, sheen: .8, sheenColor: k.color('#d6efa8'), sheenRoughness: .5 });
    const Rd = .56;
    const az = k.deg(24), el = k.deg(-4);
    const faceN = V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const headC = V(.26, 3.55, .34);
    const head = k.group([], { p: headC.toArray() }); aim(k, head, faceN, [0, 0, 1]); g.add(head);
    // green receptacle behind the face, with pointed bracts round its rim
    const rec = k.lathe([[0, -.34], [.26, -.32], [.46, -.24], [.6, -.12], [.66, -.02], [.6, 0], [0, 0]], { smooth: true, seg: 48 });
    rec.rotateX(Math.PI / 2);
    k.add(head, rec, stemMat);
    const bractGeo = warp(k, k.sphere(1, { w: 12, h: 10 }), v => { const t = (v.y + 1) / 2, s = 1 - .85 * t ** 1.3; v.x *= .075 * s; v.z *= .025; v.y = t * .34; });
    const bracts = [];
    for (let i = 0; i < 22; i++) { const a = i / 22 * TAU + .1; bracts.push({ p: [Math.cos(a) * .58, Math.sin(a) * .58, -.14], order: 'ZXY', r: [-.55, 0, a - Math.PI / 2] }); }
    head.add(k.instances(bractGeo, stemMat, bracts));
    // the seed face: a low dome, packed with florets in a golden-angle spiral
    const dome = r => .1 * Math.pow(Math.max(0, 1 - (r / Rd) ** 2), .7) + .012;
    const face = warp(k, new T.RingGeometry(.0005, Rd, 64, 16), v => { v.z = dome(Math.hypot(v.x, v.y)); });
    k.add(head, face, k.matte('#2a1609', .9));
    const florets = [], N = 420;
    for (let i = 0; i < N; i++) {
      const t = (i + .5) / N, r = Rd * .965 * Math.sqrt(t), a = i * 2.399963, q = r / Rd;
      let col;
      if (q < .16) col = k.color('#6f7a24').lerp(k.color('#4a3a14'), q / .16);
      else if (q < .8) col = k.color(i % 21 < 4 ? '#4a2c14' : i % 13 < 2 ? '#3a2210' : '#2b170a');
      else col = k.color('#6a3a12').lerp(k.color('#e2a21e'), smooth(.8, .96, q));
      const s = .026 + .006 * q;
      florets.push({ p: [Math.cos(a) * r, Math.sin(a) * r, dome(r) + .006], s: [s, s, s * (q > .8 ? 1.2 : .7)], color: col });
    }
    head.add(k.instances(k.sphere(1, { w: 8, h: 6 }), k.mat({ color: '#ffffff', roughness: .75, sheen: .4, sheenColor: k.color('#ffcf6a') }), florets));
    // golden petals, two rings
    const petalTex = k.tex(32, 128, (c, w, h) => {
      const gr = c.createLinearGradient(0, h, 0, 0);
      gr.addColorStop(0, '#d9780a'); gr.addColorStop(.25, '#f2a613'); gr.addColorStop(1, '#ffcb2e');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(190,110,0,.28)'; c.lineWidth = 1.2;
      for (const x of [6, 11, 16, 21, 26]) { c.beginPath(); c.moveTo(x, h); c.quadraticCurveTo(x + (x - 16) * .2, h * .5, 16 + (x - 16) * .5, 4); c.stroke(); }
    });
    const Lp = .82, Wp = .27;
    const petalGeo = warp(k, new T.PlaneGeometry(1, 1, 6, 14), v => {
      const u = v.x * 2, t = v.y + .5;
      const hw = .5 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(t, .8))), .75) + .06 * (1 - t);
      v.x = u * hw * Wp; v.y = t * Lp;
      v.z = -.05 * u * u * (.3 + t) + .1 * t * t - .04 * Math.sin(t * Math.PI);
    });
    const petals = [];
    for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 21; i++) {
      const a = (i + ring * .5) / 21 * TAU + k.range(-.05, .05);
      const pitch = (ring ? .1 : -.14) + k.range(-.08, .08);
      petals.push({ p: [Math.cos(a) * (Rd - .05), Math.sin(a) * (Rd - .05), ring ? .03 : -.02], order: 'ZXY', r: [pitch, k.range(-.25, .25), a - Math.PI / 2],
        s: [k.range(.9, 1.1), k.range(.88, 1.08), 1], color: ring ? '#ffffff' : '#f3e2c8' });
    }
    head.add(k.instances(petalGeo, k.mat({ map: petalTex, side: T.DoubleSide, roughness: .55, sheen: .6, sheenColor: k.color('#fff0b0') }), petals));
    // the stem, bending forward into the back of the head
    const neck = headC.clone().addScaledVector(faceN, -.3);
    const stem = curveOf(k, [[0, 0, 0], [.02, 1.0, 0], [.03, 1.9, -.06], [.02, 2.6, -.14], [neck.x - .08, neck.y - .4, neck.z - .24], neck]);
    const SL = stem.getLength();
    k.add(g, varTube(k, stem, s => .12 - .03 * smooth(0, 2.4, s) + .03 * smooth(SL - .8, SL, s) + .03 * Math.exp(-s * 8), { seg: 90, rs: 16 }), stemMat);
    k.add(g, k.disc(.15, 24), k.matte('#a9c878', .7), { p: [0, .001, 0], r: [-Math.PI / 2, 0, 0] });
    // big heart-shaped leaves with toothed edges
    const leafTex = k.tex(260, 300, (c, w, h) => {
      const X = x => (x + 13) * 10, Y = y => (17.5 - y) * 10, pts = [];
      for (let i = 0; i < 72; i++) {
        const th = i / 72 * TAU, x = 16 * Math.sin(th) ** 3 * .78, y = -(13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th));
        const d = Math.hypot(x, y - 2) || 1, o = (i % 2 ? .45 : -.2) * smooth(.2, .6, Math.min(th, TAU - th));
        pts.push([x + x / d * o, y + (y - 2) / d * o]);
      }
      c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y))); c.closePath();
      const gr = c.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#255a15'); gr.addColorStop(1, '#3a7a22');
      c.fillStyle = gr; c.fill();
      c.save(); c.clip();
      c.strokeStyle = 'rgba(150,205,100,.5)'; c.lineCap = 'round'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(X(0), Y(-5)); c.quadraticCurveTo(X(.5), Y(6), X(0), Y(17)); c.stroke();
      c.lineWidth = 2.5;
      for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(X(0), Y(-4.5)); c.quadraticCurveTo(X(s * 6), Y(-4), X(s * 10), Y(-8)); c.stroke();
        for (const [y0, len] of [[-2, 10], [2.5, 9], [6.5, 7], [10.5, 4.5]]) { c.beginPath(); c.moveTo(X(0), Y(y0)); c.quadraticCurveTo(X(s * len * .5), Y(y0 + 1), X(s * len), Y(y0 + len * .45)); c.stroke(); }
      }
      c.fillStyle = 'rgba(20,50,10,.08)'; for (let i = 0; i < 500; i++) c.fillRect(k.rand() * w, k.rand() * h, 2, 2);
      c.restore();
    });
    const leafMat = k.mat({ map: leafTex, alphaTest: .5, side: T.DoubleSide, roughness: .6, sheen: .25, sheenColor: k.color('#a8d080') });
    const leaf = (len, droop, fold) => {
      const sc = len / 30, geo = new T.PlaneGeometry(26 * sc, 30 * sc, 14, 18);
      geo.translate(0, 7.5 * sc, 0);
      return warp(k, geo, v => { const t = Math.max(0, v.y) / (22.5 * sc); v.z += -droop * len * t * t + fold * Math.abs(v.x) - .08 * len * Math.max(0, -v.y / (7.5 * sc)); });
    };
    // [height on stem, direction (deg, 0 = +z), reach, rise (deg), length, droop]: the blades turn their faces to the viewer
    const toCam = V(Math.sin(k.deg(30)), .55, Math.cos(k.deg(30)));
    for (const [hy, dirDeg, reach, rise, len, droop] of [[.5, -30, .22, 8, 1.1, .45], [1.05, 78, .3, 12, 1.75, .42], [1.7, -72, .3, 16, 1.65, .4]]) {
      const P = stem.getPointAt(Math.min(1, hy / SL)), a = k.deg(dirDeg), d = V(Math.sin(a), 0, Math.cos(a));
      const end = P.clone().addScaledVector(d, reach).add(V(0, reach * .45, 0));
      k.add(g, varTube(k, curveOf(k, [P, P.clone().addScaledVector(d, reach * .5).add(V(0, reach * .35, 0)), end]), () => .035, { seg: 16, rs: 8 }), stemMat);
      const L = d.clone().multiplyScalar(Math.cos(k.deg(rise))).add(V(0, Math.sin(k.deg(rise)), 0));
      const lg = orient(k, k.group([], { p: end.toArray() }), L, toCam.clone().add(V(0, .6, 0)));
      k.add(lg, leaf(len, droop, .16), leafMat); g.add(lg);
    }
    g.userData.view = { az: 26, el: 12 };
    return g;
  },

  // A Venus flytrap in a little terracotta pot: one trap wide open, one snapped shut on a fly.
  flytrap(k) {
    const T = k.THREE, g = k.group(), V = (x, y, z) => new T.Vector3(x, y, z);
    // pot, rim and a mound of sphagnum moss
    const clayTex = k.tex(256, 128, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 5) { c.fillStyle = `rgba(120,50,20,${k.range(.02, .07)})`; c.fillRect(0, y, w, 2); }
      for (let i = 0; i < 700; i++) { c.fillStyle = k.pick(['rgba(255,235,210,.35)', 'rgba(110,40,15,.25)']); c.fillRect(k.rand() * w, k.rand() * h, k.range(1, 2.5), k.range(1, 2.5)); }
    }, { repeat: [3, 1] });
    const clay = k.mat({ color: '#c8683f', map: clayTex, roughness: .82, sheen: .3, sheenColor: k.color('#f0b090') });
    k.add(g, k.lathe([[0, 0], [.36, 0], [.38, .02], [.47, .5], [.53, .52], [.55, .72], [.52, .74], [.49, .68], [0, .68]]), clay);
    const mossTex = k.tex(256, 128, (c, w, h) => {
      c.fillStyle = '#3b4721'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        const x = k.rand() * w, y = k.rand() * h, a = k.rand() * TAU, l = k.range(3, 8);
        c.strokeStyle = k.pick(['#6f8440', '#56682f', '#2c3517', '#8c9c52', '#4a5a26']); c.lineWidth = k.range(1, 2.4);
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + 1) * l * .5, y + Math.sin(a + 1) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
      }
    }, { repeat: [3, 1] });
    const mound = warp(k, k.lathe([[0, .66], [.5, .66], [.47, .7], [.36, .75], [.18, .79], [0, .8]], { smooth: true, seg: 48 }), v => {
      const a = Math.atan2(v.z, v.x), r = Math.hypot(v.x, v.z);
      if (v.y > .67) v.y += .012 * Math.sin(a * 7 + r * 20) + .01 * Math.sin(a * 13 - r * 31);
    });
    k.add(g, mound, k.mat({ map: mossTex, roughness: .95, sheen: .4, sheenColor: k.color('#a8b878') }));
    const soilY = .78;
    // materials for the traps
    const inside = k.tex(64, 128, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h);   // v = 0 (hinge) at the canvas top
      gr.addColorStop(0, '#9e0f1c'); gr.addColorStop(.55, '#d3262e'); gr.addColorStop(.8, '#e0503a'); gr.addColorStop(.9, '#b9c24a'); gr.addColorStop(1, '#a8bf40');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(110,0,15,.35)'; c.lineWidth = 1;
      for (let i = 0; i < 14; i++) { const x = (i + .5) / 14 * w; c.beginPath(); c.moveTo(w / 2 + (x - w / 2) * .2, 0); c.lineTo(x, h * .82); c.stroke(); }
      c.fillStyle = 'rgba(255,190,190,.5)'; for (let i = 0; i < 90; i++) c.fillRect(k.rand() * w, k.rand() * h * .8, 1.5, 1.5);
    });
    inside.flipY = false;
    const inMat = k.mat({ map: inside, roughness: .32, clearcoat: .8, clearcoatRoughness: .2, side: T.BackSide });
    const outMat = k.plastic('#5c9a2c', { rough: .42, coat: .5, side: T.FrontSide });
    const toothMat = k.plastic('#b5c94a', { rough: .5, coat: .3 });
    const toothGeo = k.cyl(.003, .011, 1, { seg: 6 }); toothGeo.translate(0, .5, 0);
    // One trap: its midrib runs along +y (0 to Lt), the lobes open towards +z. a0: how far each lobe leans out (deg),
    // kap: how much it curls back in (deg); a shut trap curls right round until the rims meet.
    const trap = (Lt, Wt, a0d, kapd, flare, nT, tl) => {
      const tg = k.group(), a0 = k.deg(a0d), c = k.deg(kapd) / Wt;
      const wv = u => Wt * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2));
      const pt = (s, u, v) => {
        const sig = v * wv(u), y = u * Lt;
        return c < 1e-6 ? [s * sig * Math.sin(a0), y, sig * Math.cos(a0)] : [s * (Math.cos(a0 - c * sig) - Math.cos(a0)) / c, y, (Math.sin(a0) - Math.sin(a0 - c * sig)) / c];
      };
      for (const s of [-1, 1]) {
        const geo = surface(k, (u, v) => pt(s, s > 0 ? .015 + .97 * u : .985 - .97 * u, v), 24, 10);
        tg.add(k.mesh(geo, outMat), k.mesh(geo, inMat));
        const list = [];
        for (let i = 0; i < nT; i++) {
          const u = .06 + .88 * (i + (s > 0 ? .3 : .8)) / nT, P = pt(s, u, 1), ae = a0 - c * wv(u) + k.deg(flare);
          const dir = V(s * Math.sin(ae), (2 * u - 1) * .8, Math.cos(ae));
          list.push({ p: P, r: eulerTo(k, dir), s: [1, tl * (.75 + .35 * Math.sin(Math.PI * u)), 1] });
        }
        tg.add(k.instances(toothGeo, toothMat, list));
      }
      k.add(tg, k.cyl(.012, .012, Lt * .98, { seg: 8 }), outMat, { p: [0, Lt / 2, -.014] });   // the midrib
      return { tg, pt };
    };
    const petMat = k.plastic('#63a22e', { rough: .45, coat: .35 });
    // each leaf: direction (deg), petiole reach and rise, trap length and width, lobe lean (a0) and curl (deg), teeth flare and count,
    // and how far the trap turns its mouth from straight up towards the viewer
    const plants = [
      { dir: 112, reach: .5, rise: .5, Lt: .64, Wt: .35, a0: 50, kap: 38, flare: 30, nT: 16, tilt: .6, open: true },
      { dir: -64, reach: .44, rise: 1.0, Lt: .56, Wt: .3, a0: 32, kap: 64, flare: -8, nT: 14, tilt: .25, fly: true },
      { dir: 172, reach: .42, rise: 1.2, Lt: .44, Wt: .25, a0: 46, kap: 34, flare: 24, nT: 13, tilt: .75 },
      { dir: -128, reach: .4, rise: .8, Lt: .36, Wt: .2, a0: 42, kap: 38, flare: 22, nT: 12, tilt: .6 },
      { dir: -16, reach: .46, rise: .28, Lt: .36, Wt: .2, a0: 44, kap: 32, flare: 24, nT: 11, tilt: .5 },
    ];
    const toCam = V(Math.sin(k.deg(30)), .3, Math.cos(k.deg(30)));
    for (const pl of plants) {
      const a = k.deg(pl.dir), d = V(Math.sin(a), 0, Math.cos(a));
      const S = V(d.x * .06, soilY - .02, d.z * .06), E = S.clone().addScaledVector(d, pl.reach).add(V(0, pl.reach * pl.rise, 0));
      const M = S.clone().addScaledVector(d, pl.reach * .5).add(V(0, pl.reach * pl.rise * .35, 0));
      const cv = curveOf(k, [S, M, E]), D = cv.getTangentAt(1), up = V(0, 1, 0).addScaledVector(D, -D.y).normalize();
      const L = cv.getLength();
      k.add(g, varTube(k, cv, s => { const q = s / L; return .014 + .11 * Math.pow(Math.sin(Math.PI * Math.min(1, q / .86)), .9) * Math.pow(Math.min(1, q / .86), .5); }, { flat: .2, up: up.toArray(), seg: 40, rs: 12 }), petMat);
      const { tg, pt } = trap(pl.Lt, pl.Wt, pl.a0, pl.kap, pl.flare, pl.nT, pl.Wt * (pl.open ? .55 : .5));
      const face = up.clone().lerp(toCam, pl.tilt);
      g.add(orient(k, k.group([tg], { p: E.clone().addScaledVector(D, -.01).toArray() }), D, face));
      if (pl.fly) {
        // a fly, caught: wings and back legs sticking out between the teeth
        const rim = V(...pt(1, .5, 1));
        const f = k.group([], { p: [0, pl.Lt * .56, rim.z * .8], r: [0, 0, 0] }); tg.add(f);
        const shell = k.mat({ color: '#2c2c31', roughness: .4, clearcoat: .7, clearcoatRoughness: .2, sheen: .5, sheenColor: k.color('#8a8a94') });
        k.add(f, k.sphere(.075, { w: 16, h: 12 }), shell, { p: [0, -.02, .01], s: [.9, 1.3, .9] });                       // abdomen
        k.add(f, k.sphere(.05, { w: 16, h: 12 }), shell, { p: [0, -.1, 0] });                                             // thorax
        const wingTex = k.tex(64, 128, (c, w, h) => {
          c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(200,215,230,.55)'; c.beginPath(); c.ellipse(w / 2, h / 2, w * .44, h * .47, 0, 0, TAU); c.fill();
          c.strokeStyle = 'rgba(40,40,50,.8)'; c.lineWidth = 2;
          for (const x of [.3, .45, .6, .72]) { c.beginPath(); c.moveTo(w / 2, h * .95); c.quadraticCurveTo(w * x, h * .5, w * (x * 1.1 - .05), h * .08); c.stroke(); }
          c.beginPath(); c.ellipse(w / 2, h / 2, w * .44, h * .47, 0, 0, TAU); c.stroke();
        });
        const wingMat = k.mat({ map: wingTex, transparent: true, roughness: .1, side: T.DoubleSide, depthWrite: false, iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 500] });
        k.add(f, k.sphere(.036, { w: 16, h: 12 }), shell, { p: [0, -.16, .01] });                                          // head
        for (const s of [-1, 1]) {
          k.add(f, k.sphere(.028, { w: 16, h: 12 }), k.gloss('#a8261a'), { p: [s * .026, -.175, .022], s: [.9, 1, 1] });  // big red eyes
          k.add(f, k.sphere(.007, { w: 8, h: 6 }), k.glow('#ffffff', 1), { p: [s * .03, -.19, .05], shadow: false });
          k.add(f, k.plane(.1, .2), wingMat, { p: [s * .06, .06, .02], r: [-.2, s * .5, s * -.4], shadow: false });
          k.add(f, k.tube([[s * .03, -.08, .02], [s * .1, -.1, .07], [s * .15, -.05, .05]], .006, { caps: true, rs: 6 }), shell);
          k.add(f, k.tube([[s * .03, .0, .02], [s * .1, .05, .07], [s * .14, .12, .04]], .006, { caps: true, rs: 6 }), shell);
        }
      }
    }
    g.userData.view = { az: 26, el: 22 };
    return g;
  },

  // A wooden birdhouse on a short cedar post: painted sky blue, a red shingled roof and white trim.
  birdhouse(k) {
    const T = k.THREE, g = k.group();
    const grain = k.tex(128, 256, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 36; i++) {
        const x0 = k.rand() * w, amp = k.range(1, 5), f = k.range(.01, .03), ph = k.rand() * 9;
        c.strokeStyle = `rgba(70,50,30,${k.range(.04, .12)})`; c.lineWidth = k.range(.8, 2.5); c.beginPath();
        for (let y = 0; y <= h; y += 8) { const x = x0 + Math.sin(y * f + ph) * amp; y ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.stroke();
      }
    });
    grain.wrapS = grain.wrapT = T.RepeatWrapping;
    const paint = (c, o = {}) => k.mat({ color: c, map: grain, roughness: .5, clearcoat: .3, clearcoatRoughness: .35, ...o });
    const blue = paint('#35a3d9'), white = paint('#fbf7ee'), cedar = k.wood('#b58d62', { rough: .7 });
    const W = 1.6, D = 1.45, Hw = 1.65, Pk = .78, y0 = 1.75, hy = Hw * .6;
    // post, mounting plate and braces
    k.add(g, k.box(.34, y0 - .1, .34, .03), cedar, { p: [0, (y0 - .1) / 2, 0] });
    k.add(g, k.box(1.15, .1, 1.05, .025), cedar, { p: [0, y0 - .05, 0] });
    for (const s of [-1, 1]) k.add(g, k.box(.09, .56, .12, .02), cedar, { p: [s * .32, y0 - .3, 0], r: [0, 0, s * .72] });
    // the house: a gabled box with a round door
    const hole = new T.Path(); hole.absarc(0, hy, .2, 0, TAU, true);
    k.add(g, k.extrude(k.shape([[-W / 2, 0], [W / 2, 0], [W / 2, Hw], [0, Hw + Pk], [-W / 2, Hw]]), D, { bevel: .03, holes: [hole] }), [blue, blue], { p: [0, y0, 0] });
    k.add(g, k.disc(.24, 32), k.matte('#1a110a', 1), { p: [0, y0 + hy, D / 2 - .16] });
    k.add(g, k.torus(.225, .04, { rs: 10, ts: 48 }), white, { p: [0, y0 + hy, D / 2 + .04] });
    // perch peg
    k.add(g, k.cyl(.045, .045, .42, { seg: 16 }), cedar, { p: [0, y0 + hy - .4, D / 2 + .2], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.sphere(.06, { w: 16, h: 12 }), cedar, { p: [0, y0 + hy - .4, D / 2 + .41], s: [1, 1, .6] });
    // white trim: corner boards, a base band, a heart in the gable
    for (const x of [-1, 1]) for (const z of [-1, 1]) k.add(g, k.box(.11, Hw + .02, .11, .02), white, { p: [x * (W / 2 + .01), y0 + Hw / 2, z * (D / 2 + .01)] });
    k.add(g, k.box(W + .14, .14, D + .14, .03), white, { p: [0, y0 + .07, 0] });
    g.add(k.decal(.34, .3, (c, w, h) => {
      c.clearRect(0, 0, w, h); c.fillStyle = '#fbf7ee';
      c.beginPath(); c.moveTo(w / 2, h * .92); c.bezierCurveTo(w * .05, h * .55, w * .1, h * .06, w / 2, h * .3); c.bezierCurveTo(w * .9, h * .06, w * .95, h * .55, w / 2, h * .92); c.fill();
    }, { px: 128, p: [0, y0 + Hw + Pk * .36, D / 2 + .033] }));
    // a few painted daisies climbing the side wall
    g.add(k.decal(1.0, .9, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.strokeStyle = '#3f8f3a'; c.lineWidth = 7; c.lineCap = 'round';
      for (const [x, y] of [[.3, .38], [.55, .22], [.76, .46]]) { c.beginPath(); c.moveTo(w * .5, h); c.quadraticCurveTo(w * (x + .5) / 2, h * .8, w * x, h * y); c.stroke(); }
      c.fillStyle = '#4fa844';
      for (const [x, y, a] of [[.42, .72, -.7], [.6, .66, .6], [.52, .86, -.4]]) { c.save(); c.translate(w * x, h * y); c.rotate(a); c.beginPath(); c.ellipse(0, 0, 26, 11, 0, 0, TAU); c.fill(); c.restore(); }
      for (const [x, y, r] of [[.3, .38, 42], [.55, .22, 50], [.76, .46, 38]]) {
        c.fillStyle = '#fbf7ee';
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; c.save(); c.translate(w * x, h * y); c.rotate(a); c.beginPath(); c.ellipse(0, -r * .55, r * .2, r * .5, 0, 0, TAU); c.fill(); c.restore(); }
        c.fillStyle = '#f5c22b'; c.beginPath(); c.arc(w * x, h * y, r * .3, 0, TAU); c.fill();
      }
    }, { px: 256, p: [W / 2 + .034, y0 + .62, .12], r: [0, Math.PI / 2, 0] }));
    // roof: two shingled panels, white bargeboards and a ridge cap
    const shingles = k.tex(256, 256, (c, w, h) => {
      c.fillStyle = '#9e2c22'; c.fillRect(0, 0, w, h);
      const rows = 5, rw = w / rows, n = 7, sh = h / n;
      for (let r = 0; r < rows; r++) for (let j = -1; j <= n; j++) {
        const x0 = r * rw - 2, yc = (j + (r % 2) * .5) * sh;
        const gr = c.createLinearGradient(x0, 0, x0 + rw * 1.2, 0); gr.addColorStop(0, '#c63f30'); gr.addColorStop(1, '#e8604a');
        c.fillStyle = gr; c.strokeStyle = 'rgba(90,20,12,.55)'; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(x0, yc - sh / 2 + 1.5); c.lineTo(x0 + rw * .72, yc - sh / 2 + 1.5); c.arc(x0 + rw * .72, yc, sh / 2 - 1.5, -Math.PI / 2, Math.PI / 2); c.lineTo(x0, yc + sh / 2 - 1.5); c.closePath(); c.fill(); c.stroke();
      }
    });
    const roofMat = k.mat({ map: shingles, roughness: .55, clearcoat: .3, clearcoatRoughness: .4 });
    const th = Math.atan2(Pk, W / 2), slope = Math.hypot(W / 2, Pk), over = .24, tr = .1, Dr = D + .44, Lr = slope + over + .06;
    for (const s of [1, -1]) {
      const side = k.group([], { s: [s, 1, 1] }); g.add(side);
      const pn = k.group([], { p: [0, y0 + Hw + Pk, 0], r: [0, 0, -th] }); side.add(pn);
      k.add(pn, k.box(Lr, tr, Dr, .025), roofMat, { p: [Lr / 2 - .06, tr / 2 + .045, 0] });
      k.add(pn, k.box(Lr - .02, .13, .07, .02), white, { p: [Lr / 2 - .07, -.02, Dr / 2 - .07] });
      k.add(pn, k.box(Lr - .02, .13, .07, .02), white, { p: [Lr / 2 - .07, -.02, -Dr / 2 + .07] });
    }
    k.add(g, k.cyl(.075, .075, Dr + .04, { seg: 20 }), white, { p: [0, y0 + Hw + Pk + .12, 0], r: [Math.PI / 2, 0, 0] });
    g.userData.view = { az: 30, el: 14 };
    return g;
  },

  // A scarecrow on its post: burlap head with a stitched grin, floppy straw hat, plaid flannel, patched overalls,
  // straw poking out everywhere, and a crow sitting on its hat anyway.
  scarecrow(k) {
    const T = k.THREE, g = k.group(), V = (x, y, z) => new T.Vector3(x, y, z);
    const repeatOf = (tex, x, y) => { const t = tex.clone(); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(x, y); t.needsUpdate = true; return t; };
    const plaidTex = k.tex(128, 128, (c, w, h) => {
      c.fillStyle = '#c4302a'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(28,24,40,.55)'; c.fillRect(0, 36, w, 34); c.fillRect(36, 0, 34, h);
      c.fillStyle = 'rgba(28,24,40,.3)'; c.fillRect(0, 100, w, 10); c.fillRect(100, 0, 10, h);
      c.fillStyle = 'rgba(255,214,120,.7)'; c.fillRect(0, 86, w, 3); c.fillRect(86, 0, 3, h);
      for (let i = 0; i < 700; i++) { c.fillStyle = `rgba(255,255,255,${k.range(0, .08)})`; c.fillRect(k.rand() * w, k.rand() * h, 2, 1); }
    });
    const flannel = (x, y) => k.mat({ map: repeatOf(plaidTex, x, y), roughness: .95, sheen: .8, sheenColor: k.color('#ffb0a0'), sheenRoughness: .6 });
    const denimTex = k.tex(128, 128, (c, w, h) => {
      c.fillStyle = '#3f65a3'; c.fillRect(0, 0, w, h);
      for (let i = -h; i < w; i += 4) { c.strokeStyle = 'rgba(20,35,70,.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(i, h); c.lineTo(i + h, 0); c.stroke(); }
      for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(230,240,255,${k.range(0, .12)})`; c.fillRect(k.rand() * w, k.rand() * h, 3, 1); }
    });
    const denim = (x, y) => k.mat({ map: repeatOf(denimTex, x, y), roughness: .9, sheen: .5, sheenColor: k.color('#9fb8e0') });
    const burlapTex = k.tex(128, 128, (c, w, h) => {
      c.fillStyle = '#7a5a2e'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
        c.fillStyle = (i + j) % 2 ? '#c9a466' : '#b8914f';
        c.beginPath(); c.roundRect(i * 8 + .5, j * 8 + 1.5, 7, 5, 2); c.fill();
        c.fillStyle = (i + j) % 2 ? '#b08a4c' : '#c7a263';
        c.beginPath(); c.roundRect(i * 8 + 1.5, j * 8 + .5, 5, 7, 2); c.fill();
      }
    });
    const burlap = (x, y) => k.mat({ map: repeatOf(burlapTex, x, y), roughness: .95, sheen: .5, sheenColor: k.color('#f0d8a0') });
    const strawTex = k.tex(128, 128, (c, w, h) => {
      c.fillStyle = '#d9b15a'; c.fillRect(0, 0, w, h);
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
        const x = i * 16 + (j % 2) * 8, y = j * 16;
        const gr = c.createLinearGradient(x, y, x + 16, y + 16); gr.addColorStop(0, '#f2d68c'); gr.addColorStop(1, '#c39a45');
        c.fillStyle = gr; c.beginPath(); c.ellipse(x + 8, y + 8, 8, 5, .6, 0, TAU); c.fill();
      }
      c.strokeStyle = 'rgba(120,80,20,.35)'; c.lineWidth = 1; for (let y = 0; y < h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    });
    const hatMat = (x, y, o = {}) => k.mat({ map: repeatOf(strawTex, x, y), roughness: .8, ...o });
    const pole = k.wood('#9a7b55', { rough: .8 });
    const thread = k.matte('#2a1c12', .8);
    // straw: thin stalks in tufts
    const straws = [], strawCols = ['#f0d27a', '#e2bb52', '#d4a53c', '#f6e3a4', '#caa048'];
    const tuft = (c, dir, n, len, spread) => {
      for (let i = 0; i < n; i++) {
        const d = dir.clone().normalize().add(V(k.range(-spread, spread), k.range(-spread, spread), k.range(-spread, spread))).normalize();
        straws.push({ p: c.clone().add(V(k.range(-.05, .05), k.range(-.05, .05), k.range(-.05, .05))).toArray(), r: eulerTo(k, d), s: [1, len * k.range(.55, 1.2), 1], color: k.pick(strawCols) });
      }
    };
    // post and crossbar
    k.add(g, k.cyl(.07, .07, 4.0, { seg: 12 }), pole, { p: [0, 3.8, -.04], r: [0, 0, Math.PI / 2] });
    // flannel shirt: body, collar and droopy sleeves along the crossbar
    const torso = k.lathe([[0, 2.5], [.5, 2.5], [.55, 2.8], [.57, 3.3], [.56, 3.66], [.47, 3.92], [.24, 4.03], [0, 4.04]], { smooth: true, seg: 48 });
    k.add(g, torso, flannel(4, 3), { s: [1, 1, .64] });
    for (const s of [-1, 1]) {
      const sc = curveOf(k, [[s * .36, 3.86, -.02], [s * .8, 3.78, .0], [s * 1.25, 3.73, .02], [s * 1.66, 3.76, .01]]);
      k.add(g, varTube(k, sc, (q, L) => .23 - .05 * q / L + .014 * Math.sin(q * 15 + s), { seg: 50, rs: 18 }), flannel(3, 1));
      const end = sc.getPointAt(1), dir = sc.getTangentAt(1);
      k.add(g, k.torus(.185, .035, { rs: 8, ts: 28 }), flannel(2, 1), { p: end.toArray(), r: [0, Math.PI / 2, 0] });
      k.add(g, k.disc(.17, 20), k.matte('#caa048', .9), { p: end.clone().addScaledVector(dir, -.03).toArray(), r: [0, s * Math.PI / 2, 0] });
      tuft(end.clone().addScaledVector(dir, -.05), V(s, -.35, .1), 14, .36, .55);
    }
    // overalls: seat, legs hanging loose round the post, bib, straps, brass buttons and patches
    k.add(g, k.lathe([[0, 2.1], [.3, 2.1], [.46, 2.2], [.55, 2.42], [.56, 2.6], [.53, 2.72], [0, 2.72]], { smooth: true, seg: 48 }), denim(4, 1), { s: [1, 1, .68] });
    const legs = [];
    for (const s of [-1, 1]) {
      const lc = curveOf(k, [[s * .27, 2.4, 0], [s * .28, 1.8, s > 0 ? .06 : .02], [s * .3, 1.35, s > 0 ? .1 : -.02], [s * .33, 1.02, s > 0 ? .02 : -.06]]);
      k.add(g, varTube(k, lc, (q, L) => .285 - .065 * q / L + .01 * Math.sin(q * 18 + s * 2), { seg: 40, rs: 18 }), denim(2, 2));
      const end = lc.getPointAt(1), dir = lc.getTangentAt(1);
      const cuff = aim(k, k.group([], { p: end.toArray() }), dir); g.add(cuff);
      k.add(cuff, k.cyl(.23, .22, .1, { seg: 24 }), denim(2, .3), { p: [0, -.02, 0] });
      k.add(cuff, k.disc(.19, 20), k.matte('#caa048', .9), { p: [0, .02, 0], r: [-Math.PI / 2, 0, 0] });
      tuft(end.clone().addScaledVector(dir, .02), V(s * .15, -1, .1), 13, .34, .5);
      legs.push(lc);
    }
    const bibTex = k.tex(256, 256, (c, w, h) => {
      c.drawImage(denimTex.image, 0, 0, w, h);
      c.strokeStyle = '#e8a33a'; c.lineWidth = 3; c.setLineDash([9, 6]);
      c.strokeRect(12, 14, w - 24, h - 20);
      c.beginPath(); c.roundRect(w * .3, h * .3, w * .4, h * .36, 6); c.stroke();
      c.setLineDash([]);
    });
    k.add(g, k.lathe([[.561, 2.62], [.575, 3.0], [.575, 3.3], [.565, 3.5]], { smooth: true, seg: 24, start: -.62, len: 1.24 }), k.mat({ map: bibTex, roughness: .9, sheen: .5, sheenColor: k.color('#9fb8e0'), side: T.DoubleSide }), { s: [1, 1, .66] });
    for (const s of [-1, 1]) {
      k.add(g, k.tube([[s * .26, 3.48, .33], [s * .27, 3.78, .28], [s * .29, 4.0, .05], [s * .28, 3.9, -.25], [s * .22, 3.5, -.36]], .048, { rs: 8, seg: 40 }), denim(4, .3));
      const b = aim(k, k.group([], { p: [s * .26, 3.43, .355] }), V(s * .3, 0, 1)); g.add(b);
      k.add(b, k.rcyl(.07, .04, .015, { seg: 20 }), k.brass());
    }
    // patches: a yellow gingham square on the bib and a red one on the knee, sewn on with big stitches
    const patch = (base, check) => k.painted(128, 128, (c, w, h) => {
      c.fillStyle = base; c.fillRect(0, 0, w, h);
      c.fillStyle = check; for (let i = 0; i < 8; i++) { c.globalAlpha = .45; c.fillRect(i * 16, 0, 8, h); c.fillRect(0, i * 16, w, 8); }
      c.globalAlpha = 1; c.strokeStyle = '#2a1c12'; c.lineWidth = 5; c.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const t = 14 + i * 20; for (const [x0, y0, x1, y1] of [[t - 5, 3, t + 5, 15], [t - 5, h - 15, t + 5, h - 3], [3, t - 5, 15, t + 5], [w - 15, t - 5, w - 3, t + 5]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); } }
    }, { rough: .95 });
    const knee = legs[1].getPointAt(.52), kd = legs[1].getTangentAt(.52);
    const kp = aim(k, k.group([], { p: knee.toArray() }), kd.clone().negate()); g.add(kp);
    k.add(kp, k.cyl(.245, .245, .3, { open: true, start: -.75, len: 1.5, seg: 16 }), patch('#f2c230', '#fff4c0'), { r: [0, .35, 0] });
    k.add(g, k.plane(.22, .22), patch('#d8402f', '#ffd0c0'), { p: [-.2, 2.95, .383], r: [0, -.33, .12] });
    // burlap sack head, tied off with twine, a little tipped over from a long summer
    const head = k.group([], { p: [0, 4.5, .03], r: [0, .18, -.12] }); g.add(head);
    const R = .5;
    const skull = warp(k, k.sphere(R, { w: 48, h: 32 }), v => { const a = Math.atan2(v.x, v.z); v.multiplyScalar(1 + .025 * Math.sin(a * 5 + v.y * 9) + .02 * Math.sin(v.y * 14)); v.y *= 1.06; });
    k.add(head, skull, burlap(5, 3));
    k.add(head, k.lathe([[.16, -.43], [.19, -.52], [.3, -.6], [.42, -.66], [.44, -.68]], { smooth: true, seg: 40 }), burlap(5, 1));
    k.add(head, k.torus(.19, .035, { rs: 8, ts: 32 }), k.matte('#a47f45', .9), { p: [0, -.48, 0], r: [Math.PI / 2, 0, 0] });
    tuft(V(0, -.66, 0).applyEuler(head.rotation).add(head.position), V(0, -.2, 1), 10, .2, .9);
    const onHead = (x, y) => { const d = V(x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y))); return { p: d.clone().multiplyScalar(R).multiply(V(1, 1.06, 1)), n: d }; };
    for (const s of [-1, 1]) {
      const e = onHead(s * .34, .14), b = aim(k, k.group([], { p: e.p.toArray() }), e.n); head.add(b);
      k.add(b, k.rcyl(.1, .05, .02, { seg: 28 }), k.gloss('#18181c'));
      for (const [x, z] of [[-.028, -.028], [.028, .028], [-.028, .028], [.028, -.028]]) k.add(b, k.cyl(.013, .013, .01, { seg: 8 }), k.matte('#4a4a50', .6), { p: [x, .052, z] });
      k.add(b, k.box(.1, .012, .016, .005), k.matte('#e8dcc0', .7), { p: [0, .058, 0], r: [0, s * Math.PI / 4, 0] });
      k.add(b, k.sphere(.018, { w: 8, h: 6 }), k.glow('#ffffff', 1), { p: [-.04, .05, -.04], shadow: false });
      const ch = onHead(s * .42, -.12); k.add(head, k.sphere(.075, { w: 16, h: 10 }), k.fabric('#ee8f86', { weave: false }), { p: ch.p.toArray(), s: [1, .8, .35], r: [0, s * .45, 0] });
      const br = [onHead(s * .44, .32), onHead(s * .34, .35), onHead(s * .24, .31)].map(o => o.p.multiplyScalar(1.02));
      k.add(head, k.tube(br.map(v => v.toArray()), .014, { caps: true, rs: 6 }), thread);
    }
    const nose = onHead(0, -.02), nb = aim(k, k.group([], { p: nose.p.toArray() }), nose.n); head.add(nb);
    k.add(nb, k.extrude(k.shape([[-.09, .06], [.09, .06], [0, -.08]]), .025, { bevel: .012 }), k.fabric('#e8742a', { weave: false }), { r: [-Math.PI / 2, 0, 0], p: [0, .01, 0] });
    const mouth = [], stitches = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12 - .5; mouth.push(onHead(t * .62, -.2 - .12 * Math.cos(t * Math.PI) + .02).p.multiplyScalar(1.01)); }
    k.add(head, k.tube(mouth.map(v => v.toArray()), .016, { caps: true, rs: 6, seg: 60 }), thread);
    for (let i = 1; i < 12; i += 2) { const a = mouth[i - 1], b = mouth[i + 1], m = mouth[i], t = b.clone().sub(a).normalize(), n = m.clone().normalize(), up = n.clone().cross(t).normalize(); stitches.push({ p: m.toArray(), r: eulerTo(k, up), s: [1, .11, 1] }); }
    head.add(k.instances(k.cyl(.013, .013, 1, { seg: 6 }), thread, stitches));
    // floppy straw hat
    const hat = k.group([], { p: [0, .38, -.02], r: [-.12, 0, .08] }); head.add(hat);
    const brim = warp(k, new T.RingGeometry(.36, 1.0, 64, 6), v => {
      const r = Math.hypot(v.x, v.y), a = Math.atan2(v.y, v.x), q = (r - .36) / .64;
      const y = -.2 * q * q * (1 + .7 * Math.sin(2 * a + .8)) + .04 * q * Math.sin(5 * a);
      v.set(v.x, y, -v.y);
    });
    k.add(hat, brim, hatMat(3, 3, { side: T.DoubleSide }));
    const crown = warp(k, k.lathe([[.38, 0], [.4, .08], [.37, .34], [.3, .47], [.12, .5], [0, .44]], { smooth: true, seg: 48 }), v => { const a = Math.atan2(v.x, v.z); if (v.y > .3) v.y -= .05 * Math.max(0, Math.cos(a)); });
    k.add(hat, crown, hatMat(4, 2));
    k.add(hat, k.cyl(.395, .39, .1, { open: true, seg: 48 }), k.fabric('#3a5ea8', { weave: false }), { p: [0, .06, 0] });
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU + k.range(-.1, .1), r = .98, q = 1, y = -.2 * (1 + .7 * Math.sin(2 * a + .8)) + .04 * Math.sin(5 * a);
      const p = V(Math.cos(a) * r, y, -Math.sin(a) * r).applyEuler(hat.rotation).add(hat.position).applyEuler(head.rotation).add(head.position);
      tuft(p, V(Math.cos(a), -.4, -Math.sin(a)).applyEuler(head.rotation), 1, .16, .3);
    }
    for (const a of [-2.2, -1.6, -.9, 2.3, 2.9, 3.5]) tuft(V(Math.sin(a) * .42, .1, Math.cos(a) * .42).applyEuler(head.rotation).add(head.position), V(Math.sin(a), -.7, Math.cos(a)), 3, .3, .3);
    g.add(k.instances(k.cyl(.012, .017, 1, { seg: 5 }).translate(0, .5, 0), k.matte('#ffffff', .7), straws));
    // crows: one perched on the brim (of course), one on an arm
    const crowM = k.mat({ color: '#1c1f2a', roughness: .35, clearcoat: .8, clearcoatRoughness: .25, iridescence: .7, iridescenceIOR: 1.6, iridescenceThicknessRange: [250, 520], sheen: .4, sheenColor: k.color('#5a6fb0') });
    const beakM = k.gloss('#3b3d45'), feet = k.matte('#2b2b30', .6), eyeM = k.gloss('#0b0b0d'), glint = k.glow('#ffffff', 1);
    const tailGeo = k.extrude(k.shape([[0, .05], [-.4, .1], [-.45, 0], [-.4, -.1], [0, -.05]]), .02, { bevel: .01 });
    const beakGeo = warp(k, k.cone(.07, .3, 16), v => { const t = (v.y + .15) / .3; v.x -= .035 * t * t; });
    const crowFig = (o, cock = 0) => {
      const crow = k.group([], o);
      k.add(crow, k.sphere(1, { w: 32, h: 24 }), crowM, { p: [0, .3, 0], s: [.3, .2, .19], r: [0, 0, .42] });
      k.add(crow, k.sphere(.13, { w: 24, h: 16 }), crowM, { p: [.15, .4, 0], s: [1, 1.1, 1] });
      const hd = k.group([], { p: [.2, .45, 0], r: [cock, 0, 0] }); crow.add(hd);
      k.add(hd, k.sphere(.15, { w: 28, h: 20 }), crowM, { p: [.05, .05, 0] });
      k.add(hd, beakGeo, beakM, { p: [.29, .05, 0], r: [0, 0, -Math.PI / 2 - .08], s: [1, 1, .8] });
      for (const s of [-1, 1]) {
        k.add(hd, k.sphere(.034, { w: 16, h: 12 }), eyeM, { p: [.13, .1, s * .115] });
        k.add(hd, k.sphere(.011, { w: 8, h: 6 }), glint, { p: [.15, .115, s * .143], shadow: false });
        k.add(crow, k.sphere(1, { w: 24, h: 16 }), crowM, { p: [-.08, .33, s * .15], s: [.32, .14, .06], r: [0, s * .12, .12] });
        const lx = .02, lz = s * .06;
        k.add(crow, k.tube([[lx, .18, lz], [lx + .02, .08, lz], [lx, .0, lz]], .016, { caps: true, rs: 6 }), feet);
        for (const a of [-.5, 0, .5]) k.add(crow, k.tube([[lx, .0, lz], [lx + Math.cos(a) * .11, -.015, lz + Math.sin(a) * .08]], .011, { caps: true, rs: 5 }), feet);
      }
      k.add(crow, tailGeo, crowM, { p: [-.26, .22, 0], r: [Math.PI / 2, 0, .35] });
      return crow;
    };
    const brimY = (x, z) => { const r = Math.hypot(x, z), a = Math.atan2(-z, x), q = (r - .36) / .64; return -.2 * q * q * (1 + .7 * Math.sin(2 * a + .8)) + .04 * q * Math.sin(5 * a); };
    hat.add(crowFig({ p: [.74, brimY(.74, .22) - .005, .22], r: [0, -.4, .06], s: 1.25 }, -.15));
    g.add(crowFig({ p: [-1.22, 3.92, .03], r: [0, -2.55, 0], s: 1.05 }, .25));
    for (const c of g.children) c.position.y -= .32;
    k.add(g, k.cyl(.085, .1, 4.0, { seg: 14 }), pole, { p: [0, 2.0, -.04] });
    g.userData.view = { az: 26, el: 12 };
    return g;
  },

  // The prize pumpkin: squat, deeply ribbed, a thick curly stem, a blue ribbon pinned on, sagging over its pallet.
  pumpkin(k) {
    const T = k.THREE, g = k.group(), V = (x, y, z) => new T.Vector3(x, y, z);
    // pallet
    const pine = k.wood('#d6b27a', { rough: .8 }), pineDark = k.wood('#b99260', { rough: .85, seed: 2 });
    const PX = 2.3, PZ = 1.95, bt = .05, st = .15;
    for (const x of [-1, 0, 1]) k.add(g, k.box(.3, bt, PZ, .01), pineDark, { p: [x * (PX / 2 - .15), bt / 2, 0] });
    for (const z of [-1, 0, 1]) k.add(g, k.box(PX, st, .2, .01), pineDark, { p: [0, bt + st / 2, z * (PZ / 2 - .1)] });
    const nb = 7;
    for (let i = 0; i < nb; i++) k.add(g, k.box(.26, bt, PZ, .012), pine, { p: [-PX / 2 + .13 + i * (PX - .26) / (nb - 1), bt + st + bt / 2, 0], r: [0, k.range(-.01, .01), 0] });
    const top = bt * 2 + st;
    // the pumpkin
    const R0 = 1.62, n = 12, ph0 = .13;
    const shape = (th, phi) => {
      const gv = Math.abs(Math.sin(n * (phi + ph0) / 2)), lobe = Math.pow(gv, .4);
      const depth = .1 * Math.pow(Math.sin(th), .6);
      const wob = 1 + .025 * Math.sin(3 * phi + 1) + .015 * Math.sin(7 * phi + 2);
      let rh = R0 * Math.pow(Math.sin(th), .8) * (1 - depth * (1 - lobe)) * wob * (1 + .07 * smooth(1.5, 2.5, th));
      let y = R0 * .62 * Math.cos(th);
      const flat = -.4 * R0; if (y < flat) y = flat - (flat - y) * .22;
      y -= R0 * .12 * Math.exp(-((th / .32) ** 2));
      y *= 1 + .03 * (lobe - .5) * Math.sin(th);
      return { p: V(rh * Math.sin(phi), y, rh * Math.cos(phi)), lobe };
    };
    let lo = Infinity; for (let i = 0; i <= 60; i++) lo = Math.min(lo, shape(Math.PI * (.55 + .45 * i / 60), 0).p.y);
    const cy = top - lo - .01;
    const surfP = (th, phi) => shape(th, phi).p.add(V(0, cy, 0));
    const geo = new T.SphereGeometry(1, 144, 72), pp = geo.attributes.position, cols = [];
    const cRib = k.color('#f7861c'), cGroove = k.color('#b2430a'), cTop = k.color('#e9ac3c'), cLow = k.color('#d65a12');
    for (let i = 0; i < pp.count; i++) {
      const y = Math.max(-1, Math.min(1, pp.getY(i))), th = Math.acos(y), phi = Math.atan2(pp.getX(i), pp.getZ(i));
      const { p, lobe } = shape(th, phi); pp.setXYZ(i, p.x, p.y + cy, p.z);
      const c = cGroove.clone().lerp(cRib, Math.pow(lobe, .7)).lerp(cTop, .55 * (1 - smooth(.15, .6, th))).lerp(cLow, .35 * smooth(1.9, 2.8, th));
      const m = 1 + .05 * Math.sin(phi * 23 + th * 17) * Math.sin(th * 9 - phi * 5);
      cols.push(c.r * m, c.g * m, c.b * m);
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals(); weld(geo);
    k.add(g, geo, k.mat({ color: '#ffffff', vertexColors: true, roughness: .42, clearcoat: .45, clearcoatRoughness: .35 }));
    // a thick, corded, curling stem, and a curly tendril
    const stemTop = surfP(0, 0);
    const sc = curveOf(k, [[0, -.12, 0], [.02, .12, 0], [.08, .36, .02], [.24, .56, .06], [.46, .6, .1], [.6, .48, .12], [.62, .34, .1]].map(([x, y, z]) => [x + stemTop.x, y + stemTop.y, z + stemTop.z]));
    const SL = sc.getLength(), sseg = 60, srs = 36;
    const stemGeo = new T.TubeGeometry(sc, sseg, 1, srs, false), sp = stemGeo.attributes.position, P = new T.Vector3(), v = new T.Vector3();
    for (let i = 0; i <= sseg; i++) {
      sc.getPointAt(i / sseg, P); const s = i / sseg * SL;
      const r = .2 - .07 * smooth(0, SL, s) + .2 * Math.exp(-s * 7);
      for (let j = 0; j <= srs; j++) { const idx = i * (srs + 1) + j, a = j / srs * TAU; v.fromBufferAttribute(sp, idx).sub(P).multiplyScalar(r * (1 + .13 * Math.cos(7 * a + s * 1.5))); sp.setXYZ(idx, P.x + v.x, P.y + v.y, P.z + v.z); }
    }
    stemGeo.computeVertexNormals(); weld(stemGeo);
    const stemMat = k.mat({ color: '#8f9450', roughness: .75, clearcoat: .15 });
    k.add(g, stemGeo, stemMat);
    const cutP = sc.getPointAt(1), cut = aim(k, k.group([], { p: cutP.toArray() }), sc.getTangentAt(1)); g.add(cut);
    k.add(cut, k.cyl(.135, .135, .02, { seg: 24 }), k.matte('#d9cf9c', .8));
    const helix = [];
    for (let i = 0; i <= 90; i++) { const t = i / 90, a = t * TAU * 3.2; helix.push([stemTop.x - .25 - t * .5 + Math.cos(a) * .08 * (1 - t * .4), stemTop.y + .02 + t * .35 + Math.sin(a) * .08, stemTop.z + .05 + t * .15 + Math.sin(a + 1) * .04]); }
    k.add(g, k.tube([[stemTop.x - .08, stemTop.y + .08, stemTop.z], [stemTop.x - .2, stemTop.y + .05, stemTop.z + .03], ...helix], .022, { caps: true, seg: 240, rs: 8 }), k.plastic('#79953c', { rough: .5, coat: .2 }));
    // the blue ribbon rosette, pinned to the front
    const rTh = 1.08, rPhi = k.deg(10);
    const rp = surfP(rTh, rPhi), rn = surfP(rTh + .01, rPhi).sub(surfP(rTh - .01, rPhi)).cross(surfP(rTh, rPhi + .01).sub(surfP(rTh, rPhi - .01))).normalize();
    if (rn.dot(V(Math.sin(rPhi), 0, Math.cos(rPhi))) < 0) rn.negate();
    const ros = k.group([], { p: rp.clone().addScaledVector(rn, .05).toArray() });
    orient(k, ros, V(0, 1, 0).addScaledVector(rn, -rn.y), rn); g.add(ros);
    const satin = (c) => k.mat({ color: c, roughness: .3, sheen: 1, sheenColor: k.color('#9fc0ff'), sheenRoughness: .3, clearcoat: .4, side: T.DoubleSide });
    const pleat = (r0, r1, amp, nP) => warp(k, new T.RingGeometry(r0, r1, 96, 3), v => { const a = Math.atan2(v.y, v.x), q = (Math.hypot(v.x, v.y) - r0) / (r1 - r0); v.z = amp * q * Math.sin(a * nP) + .02 * q; });
    // tails first, hanging down behind the rosette and fanning apart
    const tailTex = k.tex(64, 256, (c, w, h) => {
      c.fillStyle = '#1f52c4'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f2c94c'; c.fillRect(4, 0, 5, h); c.fillRect(w - 9, 0, 5, h);
      c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.moveTo(0, h); c.lineTo(w / 2, h - 40); c.lineTo(w, h); c.fill();
    });
    for (const s of [-1, 1]) {
      const tg = surface(k, (u, t) => {
        const th = rTh + .12 + t * .5, phi = rPhi + s * (.06 + t * .16) + (u - .5) * .15;
        const q = surfP(th, phi), c = V(0, cy, 0), d = q.clone().sub(c);
        return q.addScaledVector(d.normalize(), .03 + .015 * t).toArray();
      }, 4, 16);
      k.add(g, tg, k.mat({ map: tailTex, alphaTest: .5, roughness: .3, sheen: 1, sheenColor: k.color('#9fc0ff'), clearcoat: .4, side: T.DoubleSide }));
    }
    k.add(ros, pleat(.2, .5, .045, 26), satin('#2458d0'));
    k.add(ros, pleat(.17, .36, .03, 20), satin('#e9eefb'), { p: [0, 0, .04] });
    k.add(ros, k.rcyl(.24, .05, .02, { seg: 40 }), k.gold(), { p: [0, 0, .05], r: [Math.PI / 2, 0, 0] });
    const badge = k.painted(256, 256, (c, w, h) => {
      c.fillStyle = '#1f52c4'; c.beginPath(); c.arc(w / 2, h / 2, w / 2, 0, TAU); c.fill();
      c.strokeStyle = '#f2c94c'; c.lineWidth = 8; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 14, 0, TAU); c.stroke();
      k.text(c, '1ST', w / 2, h * .46, { size: 104, weight: 700, color: '#ffffff' });
      k.text(c, 'PRIZE', w / 2, h * .74, { size: 40, weight: 800, color: '#f2c94c', font: 'Nunito, sans-serif' });
    }, { rough: .35, coat: .5 });
    k.add(ros, k.disc(.205, 40), badge, { p: [0, 0, .105] });
    // the weight, in marker, on its shoulder
    const note = k.tex(512, 160, (c, w, h) => { c.clearRect(0, 0, w, h); k.text(c, '1,142 lb', w / 2, h / 2, { size: 104, weight: 600, color: 'rgba(30,20,20,.85)', font: '"Comic Sans MS", "Marker Felt", Fredoka, sans-serif' }); });
    note.flipY = true;
    const ng = surface(k, (u, t) => { const q = surfP(.62 + (1 - t) * .28, k.deg(58) + (u - .5) * .62); return q.addScaledVector(q.clone().sub(V(0, cy, 0)).normalize(), .008).toArray(); }, 16, 6);
    k.add(g, ng, k.mat({ map: note, transparent: true, roughness: .5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), { shadow: false });
    g.userData.view = { az: 24, el: 18 };
    return g;
  },
};
