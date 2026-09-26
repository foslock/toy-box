// Models for the living cards. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

/* ---------- small local helpers ---------- */
// Move every vertex of a geometry with fn(v) (a Vector3 you can change in place), then fix the normals.
// weld: also average the normals of vertices that share a position (hides the seams of rounded boxes and lathes).
function warp(k, geo, fn, weld = false) {
  const pos = geo.attributes.position, v = new k.THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); fn(v); pos.setXYZ(i, v.x, v.y, v.z); }
  pos.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
  if (weld) {
    const n = geo.attributes.normal, groups = new Map();
    for (let i = 0; i < pos.count; i++) { const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`; (groups.get(key) || groups.set(key, []).get(key)).push(i); }
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      let x = 0, y = 0, z = 0;
      for (const i of ids) { x += n.getX(i); y += n.getY(i); z += n.getZ(i); }
      const l = Math.hypot(x, y, z) || 1;
      for (const i of ids) n.setXYZ(i, x / l, y / l, z / l);
    }
    n.needsUpdate = true;
  }
  return geo;
}
// A soft additive halo around a light (drawn over everything behind it, never casts shadows).
function halo(k, r, color, opacity = .35) {
  const T = k.THREE;
  const tex = k.tex(128, 128, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  const mat = new T.SpriteMaterial({ map: tex, color: k.color(color), transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending });
  const s = new T.Sprite(mat); s.scale.set(r * 2, r * 2, 1);
  return s;
}

// A convex polygon [[x, y], ...] shrunk by d on every side (so a bevel of d brings it back to size).
function inset(pts, d) {
  const n = pts.length; let area = 0;
  for (let i = 0; i < n; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n]; area += x1 * y2 - x2 * y1; }
  const sg = area > 0 ? 1 : -1, lines = pts.map(([x1, y1], i) => {
    const [x2, y2] = pts[(i + 1) % n], dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy);
    return [x1 - dy / l * sg * d, y1 + dx / l * sg * d, dx, dy];
  });
  return lines.map((L, i) => {
    const [px, py, pdx, pdy] = lines[(i + n - 1) % n], [lx, ly, ldx, ldy] = L, t = ((lx - px) * ldy - (ly - py) * ldx) / (pdx * ldy - pdy * ldx);
    return [px + pdx * t, py + pdy * t];
  });
}
// Four mitred rails round a w × h opening (outer size W × H), depth D, bevelled by b: a picture frame. mats: [vertical grain, horizontal grain]
function mitredFrame(k, W, H, w, h, D, b, [matV, matH]) {
  const X = W / 2, Y = H / 2, x = w / 2, y = h / 2, g = k.group();
  const rails = [[[[-X, Y], [-x, y], [x, y], [X, Y]], matH], [[[-X, -Y], [X, -Y], [x, -y], [-x, -y]], matH],
    [[[-X, -Y], [-x, -y], [-x, y], [-X, Y]], matV], [[[X, -Y], [X, Y], [x, y], [x, -y]], matV]];
  for (const [pts, m] of rails) k.add(g, k.extrude(k.shape(inset(pts, b)), Math.max(.001, D - 2 * b), { bevel: b, bevelSeg: 4 }), [m, m]);
  return g;
}

export default {
  // A black TV remote lying on its back: number pad, a silver D-pad, colour keys and a red power button.
  remote(k) {
    const g = k.group(), T = k.THREE;
    const body = k.group([], { r: [-Math.PI / 2, 0, 0] });     // built face-up along +z, length along y
    const yaw = k.group([body], { r: [0, k.deg(-48), 0], p: [0, 0, 0] });
    g.add(yaw);
    const L = 8.2, W = 2.1, D = .72, top = D / 2;
    const shell = k.plastic('#2a2c33', { rough: .5, coat: .3 });
    k.add(body, k.slab(W, L, D, .95, .22), shell, { p: [0, 0, 0] });
    k.add(body, k.slab(W - .36, L - .5, .06, .8, .02), k.gloss('#16171b'), { p: [0, .02, top - .005] });   // glossy face plate
    k.add(body, k.box(1.1, .18, .3, .08), k.gloss('#5a1418', { transparent: true, opacity: .9 }), { p: [0, L / 2 - .06, .02] }); // IR window
    const btnH = .12, face = top + .02;
    const keyMat = k.plastic('#ffffff', { rough: .55, coat: .2 });
    // round buttons: [x, y, r, colour]
    const rounds = [[-.56, 3.35, .26, '#e0322b'], [.56, 3.35, .2, '#555a66'],
      [-.56, -1.5, .2, '#555a66'], [0, -1.5, .2, '#555a66'], [.56, -1.5, .2, '#555a66'], [0, -2.45, .2, '#555a66']];
    const rgeo = k.rcyl(1, btnH, .05, { seg: 28 });
    body.add(k.instances(rgeo, keyMat, rounds.map(([x, y, r, c]) => ({ p: [x, y, face - .03], r: [Math.PI / 2, 0, 0], s: [r, 1, r], color: c }))));
    // number pad and colour keys (rounded boxes)
    const pads = [];
    for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) pads.push({ p: [(col - 1) * .56, 2.55 - row * .46, face + btnH / 2 - .03], s: [.44, .34, btnH], color: '#474b56' });
    ['#e94343', '#3fbf5a', '#f2c230', '#3a7de0'].forEach((c, i) => pads.push({ p: [(i - 1.5) * .42, .62, face + btnH / 2 - .03], s: [.32, .17, btnH], color: c }));
    pads.push({ p: [-.56, -2.45, face + btnH / 2 - .03], s: [.34, .82, btnH], color: '#474b56' }, { p: [.56, -2.45, face + btnH / 2 - .03], s: [.34, .82, btnH], color: '#474b56' });
    body.add(k.instances(k.box(1, 1, 1, .3, 2), keyMat, pads));
    // D-pad: a silver ring with an OK button in the middle
    k.add(body, k.rcyl(.66, btnH * .9, .06), k.metal('#c9ced8', .28), { p: [0, -.35, face - .03], r: [Math.PI / 2, 0, 0] });
    k.add(body, k.rcyl(.3, btnH * 1.2, .08), k.plastic('#30333b', { rough: .45 }), { p: [0, -.35, face - .03], r: [Math.PI / 2, 0, 0] });
    // printed labels, level with the tops of the keys
    const lab = k.decal(W - .3, L - .6, (c, w, h) => {
      const sx = w / (W - .3), sy = h / (L - .6), X = x => w / 2 + x * sx, Y = y => h / 2 - y * sy;
      const t = (s, x, y, size, col = '#e9ecf2') => k.text(c, s, X(x), Y(y), { size: size * sx, weight: 700, color: col, font: 'Nunito, sans-serif' });
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '–', '0', '↵'].forEach((s, i) => t(s, ((i % 3) - 1) * .56, 2.55 - Math.floor(i / 3) * .46, .24));
      t('+', -.56, -2.2, .26); t('–', -.56, -2.72, .26); t('⌃', .56, -2.16, .26); t('⌄', .56, -2.76, .26);
      c.strokeStyle = '#ffffff'; c.lineWidth = .045 * sx; c.lineCap = 'round';        // power symbol
      c.beginPath(); c.arc(X(-.56), Y(3.35), .11 * sx, -Math.PI / 2 + .6, -Math.PI / 2 - .6 + Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(X(-.56), Y(3.35 + .15)); c.lineTo(X(-.56), Y(3.35 + .02)); c.stroke();
      c.fillStyle = '#3b3f49';                                                          // D-pad arrows
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2, cx = X(Math.sin(a) * .49), cy = Y(-.35 + Math.cos(a) * .49), s = .07 * sx;
        c.save(); c.translate(cx, cy); c.rotate(a); c.beginPath(); c.moveTo(0, -s); c.lineTo(s, s * .6); c.lineTo(-s, s * .6); c.closePath(); c.fill(); c.restore();
      }
      t('OK', 0, -.35, .15, '#d8dce4');
      t('VOL', -.56, -3.03, .13, '#8a90a0'); t('CH', .56, -3.03, .13, '#8a90a0'); t('MUTE', 0, -2.8, .11, '#8a90a0');
      t('BACK', -.56, -1.8, .1, '#8a90a0'); t('HOME', 0, -1.8, .1, '#8a90a0'); t('MENU', .56, -1.8, .1, '#8a90a0');
      t('INPUT', .56, 3.05, .1, '#8a90a0');
    }, { px: 512, p: [0, .3, face + btnH - .03 + .004] });
    body.add(lab);
    g.userData.view = { az: 18, el: 52 };
    return g;
  },

  // A glass jar candle (Clean Linen), lit, with a melted pool around the wick.
  candle(k) {
    const g = k.group(), T = k.THREE;
    const R = 1, H = 2.3;
    const wax = new T.MeshPhysicalMaterial({ color: k.color('#f4ecdf'), roughness: .55, sheen: .6, sheenColor: k.color('#fff6e0') });
    k.add(g, k.cyl(R - .08, R - .08, 1.76, { seg: 48 }), wax, { p: [0, .12 + .88, 0] });
    // melt pool: a shallow glossy dish of liquid wax, warmed by the flame
    k.add(g, k.lathe([[0, 1.84], [.55, 1.845], [.8, 1.86], [R - .08, 1.885]], { smooth: true, seg: 48 }),
      k.mat({ color: '#f1d9ad', roughness: .08, clearcoat: 1, emissive: k.color('#ffb45a'), emissiveIntensity: .25 }), { p: [0, .0, 0] });
    // the jar: thick glass with a heavy bottom
    k.add(g, k.lathe([[0, 0], [R - .06, 0], [R, .06], [R + .02, H - .06], [R, H], [R - .05, H], [R - .06, .14], [0, .12]]), k.glass('#fdf6ea', { opacity: .22 }), { shadow: false });
    k.add(g, k.cyl(R - .02, R - .02, .12, { seg: 48 }), k.glass('#fdf6ea', { opacity: .45 }), { p: [0, .06, 0], shadow: false });
    // wick + flame
    k.add(g, k.tube([[0, 1.84, 0], [0, 2.0, 0], [.025, 2.08, 0], [.05, 2.12, 0]], .02, { caps: true }), k.matte('#1c1410', .9));
    k.add(g, k.sphere(.03, { w: 12, h: 8 }), k.glow('#ff7a2a', 3), { p: [.05, 2.12, 0], shadow: false });
    const flame = k.lathe([[0, 0], [.07, .04], [.1, .14], [.085, .3], [.04, .48], [0, .58]], { smooth: true, seg: 24 });
    k.add(g, flame, k.glow('#ffcf5e', 2.4), { p: [.01, 2.02, 0], s: 1.35, shadow: false });
    k.add(g, flame, k.glow('#fff4d0', 3), { p: [.01, 2.05, 0], s: [.75, .65, .75], shadow: false });
    k.add(g, k.sphere(.08, { w: 16, h: 12 }), k.glow('#6fb5ff', 1.4), { p: [.01, 2.08, 0], s: [1, .6, 1], shadow: false });
    const h1 = halo(k, .8, '#ffb04a', .45); h1.position.set(0, 2.4, 0); g.add(h1);
    const light = new T.PointLight(0xffb45a, 2.2, 4, 1.6); light.position.set(0, 2.3, 0); g.add(light);
    // label round the front
    const label = k.painted(512, 300, (c, w, h) => {
      c.fillStyle = '#f7f1e6'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#8fb3c9'; c.lineWidth = 6; c.strokeRect(14, 14, w - 28, h - 28);
      c.lineWidth = 2; c.strokeRect(24, 24, w - 48, h - 48);
      k.text(c, 'Clean Linen', w / 2, h * .38, { size: 66, weight: 600, color: '#3d5a73', font: 'Nunito, serif' });
      c.strokeStyle = '#8fb3c9'; c.lineWidth = 3;                                     // a little washing line
      c.beginPath(); c.moveTo(w * .3, h * .6); c.quadraticCurveTo(w / 2, h * .68, w * .7, h * .6); c.stroke();
      [[.4, '#bcd6e8'], [.5, '#ffffff'], [.6, '#bcd6e8']].forEach(([x, col], i) => {
        const cx = w * x, cy = h * .63 + (i === 1 ? 4 : 0);
        c.fillStyle = col; c.strokeStyle = '#6f93ab'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(cx - 16, cy); c.lineTo(cx + 16, cy); c.lineTo(cx + 13, cy + 30); c.lineTo(cx - 13, cy + 30); c.closePath(); c.fill(); c.stroke();
      });
      k.text(c, 'SOY WAX CANDLE · 14 OZ', w / 2, h * .86, { size: 22, weight: 700, color: '#7a8f9f', font: 'Nunito, sans-serif' });
    }, { rough: .7 });
    k.add(g, k.cyl(R + .03, R + .03, 1.05, { open: true, start: -1.15, len: 2.3 }), label, { p: [0, 1.0, 0], r: [0, k.deg(26), 0], shadow: false });
    g.userData.view = { el: 20 };
    return g;
  },

  // A clear 60 W bulb, switched on: a glowing coiled filament on its glass stem, over a threaded screw base.
  lightbulb(k) {
    const g = k.group(), T = k.THREE;
    // screw base: black glass tip, brass contact, threaded aluminium shell
    k.add(g, k.sphere(.1, { w: 20, h: 10, thetaLen: Math.PI / 2 }), k.brass(), { p: [0, .1, 0], r: [Math.PI, 0, 0] });
    k.add(g, k.lathe([[0, .08], [.14, .08], [.3, .16], [.38, .3], [0, .3]]), k.gloss('#141416'));
    const thread = [];
    for (let i = 0; i <= 60; i++) { const y = .28 + i * .011; thread.push([.5 + .045 * Math.sin(i / 60 * Math.PI * 2 * 5.5), y]); }
    k.add(g, k.lathe([[0, .28], [.38, .28], ...thread, [.52, .96], [.56, 1.0], [.5, 1.04], [0, 1.04]], { seg: 48 }), k.metal('#cfd3da', .28));
    // the glass envelope
    const glass = k.glass('#fff6e2', { opacity: .2 });
    glass.emissive = k.color('#ffcb73'); glass.emissiveIntensity = .12;
    k.add(g, k.lathe([[.45, .98], [.5, 1.2], [.62, 1.6], [.92, 2.1], [1.18, 2.7], [1.18, 3.25], [.95, 3.8], [.55, 4.12], [0, 4.22]], { smooth: true, seg: 64 }), glass, { shadow: false });
    // stem, lead-in wires and the filament
    const stemGlass = k.glass('#ffffff', { opacity: .35 });
    k.add(g, k.lathe([[.28, 1.0], [.16, 1.45], [.1, 2.0], [.08, 2.45], [0, 2.5]], { smooth: true, seg: 24 }), stemGlass, { shadow: false });
    const wire = k.metal('#b9bcc2', .3);
    k.add(g, k.tube([[-.05, 1.2, 0], [-.07, 2.2, 0], [-.3, 2.9, 0]], .012, { seg: 24, rs: 6 }), wire);
    k.add(g, k.tube([[.05, 1.2, 0], [.07, 2.2, 0], [.3, 2.9, 0]], .012, { seg: 24, rs: 6 }), wire);
    k.add(g, k.tube([[0, 2.4, 0], [0, 3.06, 0]], .01, { seg: 8, rs: 6 }), wire);
    const coil = [];
    for (let i = 0; i <= 160; i++) {
      const t = i / 160, a = t * Math.PI * 2 * 14, x = -.3 + t * .6, sag = Math.sin(t * Math.PI) * .16;
      coil.push([x, 2.9 + sag + Math.sin(a) * .035, Math.cos(a) * .035]);
    }
    k.add(g, k.tube(coil, .011, { seg: 320, rs: 6 }), k.glow('#ffe7a8', 4), { shadow: false });
    const h1 = halo(k, 1.1, '#ffc04a', .5); h1.position.set(0, 3.0, 0); g.add(h1);
    const h2 = halo(k, 2.2, '#ffb040', .22); h2.position.set(0, 2.9, 0); g.add(h2);
    const light = new T.PointLight(0xffc36e, 3, 5, 1.5); light.position.set(0, 3.0, .2); g.add(light);
    g.userData.view = { el: 14 };
    return g;
  },

  // A table lamp: a glazed ceramic gourd on a walnut foot, brass neck and a lit linen drum shade.
  tablelamp(k) {
    const g = k.group(), T = k.THREE;
    k.add(g, k.rcyl(1.55, .32, .1), k.wood('walnut', { varnish: .6 }));
    const glaze = k.ceramic('#cf8216');
    k.add(g, k.lathe([[0, .3], [.95, .3], [1.3, .55], [1.95, 1.4], [2.1, 2.2], [1.85, 3.1], [1.1, 3.8], [.6, 4.2], [.55, 4.45], [0, 4.45]], { smooth: true, seg: 64 }), glaze);
    k.add(g, k.torus(.6, .07, { rs: 12, ts: 40 }), k.brass(), { p: [0, 4.45, 0], r: [Math.PI / 2, 0, 0] });
    // neck, socket and harp
    const brass = k.brass();
    k.add(g, k.cyl(.12, .12, .9, { seg: 20 }), brass, { p: [0, 4.9, 0] });
    k.add(g, k.lathe([[0, 0], [.32, 0], [.36, .08], [.3, .7], [.26, .82], [0, .82]], { seg: 32 }), brass, { p: [0, 5.3, 0] });
    k.add(g, k.tube([[-1.05, 5.4, 0], [-1.1, 6.5, 0], [-.6, 8.0, 0], [0, 8.25, 0], [.6, 8.0, 0], [1.1, 6.5, 0], [1.05, 5.4, 0]], .035, { seg: 60, rs: 8 }), brass);
    k.add(g, k.tube([[0, 5.9, .28], [.03, 5.6, .32], [0, 5.25, .3]], .015, { seg: 20, rs: 6 }), brass);        // pull chain
    k.add(g, k.sphere(.07, { w: 16, h: 12 }), brass, { p: [0, 5.2, .3] });
    // the shade, glowing from the bulb inside
    const shadeTex = k.weaveTex(1.4);
    const shade = new T.MeshPhysicalMaterial({ color: k.color('#f6ecd6'), map: shadeTex, roughness: 1, sheen: .6, sheenColor: k.color('#ffffff'),
      emissive: k.color('#ffc978'), emissiveIntensity: .38, side: T.DoubleSide });
    k.add(g, k.cyl(2.15, 2.9, 3.4, { open: true, seg: 64 }), shade, { p: [0, 7.35, 0] });
    const trim = k.fabric('#b9864a', { weave: false });
    k.add(g, k.torus(2.9, .05, { rs: 10, ts: 80 }), trim, { p: [0, 5.66, 0], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.torus(2.15, .05, { rs: 10, ts: 80 }), trim, { p: [0, 9.04, 0], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.ring(.2, 2.87), k.glow('#fff1cf', 1.4), { p: [0, 5.72, 0], r: [Math.PI / 2, 0, 0], shadow: false });   // lit underside
    const bulb = k.sphere(.42); k.add(g, bulb, k.glow('#fff4d8', 2.2), { p: [0, 6.35, 0], shadow: false });
    k.add(g, k.lathe([[0, 0], [.14, 0], [.14, .1], [.1, .16], [.1, .3], [0, .3]], { seg: 24 }), brass, { p: [0, 8.2, 0] });   // finial
    k.add(g, k.sphere(.2, { w: 24, h: 16 }), brass, { p: [0, 8.62, 0] });
    const light = new T.PointLight(0xffd08a, 6, 9, 1.4); light.position.set(0, 6.4, 0); g.add(light);
    g.add(k.cord([[-.3, .2, -1.3], [-.4, .06, -1.9], [-1.2, .04, -2.3], [-2.2, .04, -2.1]], .05, '#2a2522'));
    return g;
  },

  // A monstera in a woven basket: big glossy split leaves with holes, and one new leaf still unfurling.
  monstera(k) {
    const g = k.group(), T = k.THREE;
    // basket
    const weave = k.tex(256, 128, (c, w, h) => {
      c.fillStyle = '#b98a52'; c.fillRect(0, 0, w, h);
      const rows = 8, cols = 16, rh = h / rows, cw = w / cols;
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
        const x = q * cw, y = r * rh, lit = (r + q) % 2;
        const gr = c.createLinearGradient(x, y, x, y + rh);
        gr.addColorStop(0, lit ? '#e4c08a' : '#c99c62'); gr.addColorStop(.5, lit ? '#d6ad73' : '#b88a50'); gr.addColorStop(1, lit ? '#a8773f' : '#94672f');
        c.fillStyle = gr; c.beginPath(); c.roundRect(x + 1, y + 1, cw - 2, rh - 2, 5); c.fill();
      }
      c.fillStyle = 'rgba(70,40,15,.35)'; for (let q = 0; q <= cols; q++) c.fillRect(q * cw - 1, 0, 2, h);
    }, { repeat: [3, 1] });
    const basket = k.mat({ map: weave, roughness: .85 });
    k.add(g, k.lathe([[0, 0], [1.05, 0], [1.1, .05], [1.28, 1.55], [1.2, 1.56], [1.02, .1], [0, .1]], { seg: 64 }), basket);
    k.add(g, k.torus(1.29, .085, { rs: 12, ts: 64 }), k.mat({ color: '#c89a5e', roughness: .8 }), { p: [0, 1.58, 0], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.cyl(1.22, 1.22, .06, { seg: 48 }), k.matte('#3a2618', .95), { p: [0, 1.48, 0] });
    // one leaf: a heart with slits and holes, painted on a bendable sheet (base at the origin, tip at +y, 0–1 units)
    const side = [], holes = [];
    const prof = new T.SplineCurve([[0, .6], [.1, .55], [.28, .5], [.5, .49], [.68, .5], [.82, .52], [.91, .47], [.97, .39], [1, .34]].map(([a, r]) => new T.Vector2(a * Math.PI, r)));
    const O = .42, at = t => { const p = prof.getPoint(t); return [Math.sin(p.x) * p.y, O + Math.cos(p.x) * p.y]; };
    const slots = [.22, .37, .52, .67], N = 200;
    for (let i = 0; i <= N; i++) {
      const t = i / N, s = slots.find(q => Math.abs(q - t) < .5 / N);
      if (s !== undefined) {
        const m = at(s), inner = [m[0] * .42, m[1] - .05 - s * .1];            // each slit runs in along a vein
        const dx = inner[0] - m[0], dy = inner[1] - m[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l, wd = .014 + s * .012;
        side.push(at(s - .012), [inner[0] - nx * wd, inner[1] - ny * wd]);
        for (let j = 1; j < 6; j++) { const a = Math.PI * j / 6, ca = Math.cos(a), sa = Math.sin(a); side.push([inner[0] - nx * wd * ca + dx / l * wd * sa, inner[1] - ny * wd * ca + dy / l * wd * sa]); }
        side.push([inner[0] + nx * wd, inner[1] + ny * wd], at(s + .012));
        continue;
      }
      if (slots.some(q => Math.abs(q - t) < .013)) continue;
      side.push(at(t));
    }
    for (const s of [.295, .445, .595]) for (const sg of [1, -1]) {              // oval holes between the slits, near the midrib
      const m = at(s), c = [m[0] * .24 * sg, m[1] - .07 - s * .07];
      holes.push([c[0], c[1], .05, .02, Math.atan2(m[1] - c[1], Math.abs(m[0]) * sg - c[0])]);
    }
    const leafTex = k.tex(512, 512, (c, w, h) => {
      const X = x => (x + .5) * w, Y = y => (1 - y) * h;
      c.beginPath(); side.forEach(([x, y], i) => i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)));
      for (let i = side.length - 1; i >= 0; i--) c.lineTo(X(-side[i][0]), Y(side[i][1]));
      c.closePath();
      const gr = c.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#2f8440'); gr.addColorStop(1, '#1c6130');
      c.fillStyle = gr; c.fill();
      c.save(); c.clip();
      c.strokeStyle = 'rgba(20,70,30,.5)'; c.lineWidth = 6; c.stroke();              // darker rim
      c.strokeStyle = 'rgba(150,210,110,.75)'; c.lineCap = 'round'; c.lineWidth = 9;
      c.beginPath(); c.moveTo(X(0), Y(.02)); c.quadraticCurveTo(X(.012), Y(.5), X(0), Y(1)); c.stroke();
      c.strokeStyle = 'rgba(150,210,110,.28)'; c.lineWidth = 3.5;
      for (const s of [.15, .295, .445, .595, .745, .85]) for (const sg of [1, -1]) {
        const m = at(s), y0 = m[1] - .09 - s * .1;
        c.beginPath(); c.moveTo(X(0), Y(y0)); c.quadraticCurveTo(X(m[0] * .45 * sg), Y(y0 + .03), X(m[0] * sg), Y(m[1])); c.stroke();
      }
      c.restore();
      c.globalCompositeOperation = 'destination-out';
      for (const [cx, cy, rx, ry, rot] of holes) { c.beginPath(); c.ellipse(X(cx), Y(cy), rx * w, ry * h, -rot, 0, Math.PI * 2); c.fill(); }
      c.globalCompositeOperation = 'source-over';
    });
    const leafGeo = new T.PlaneGeometry(1, 1, 14, 18); leafGeo.translate(0, .5, 0);
    warp(k, leafGeo, v => { v.z -= .45 * v.x * v.x + .24 * v.y * v.y - .04 * Math.sin(v.y * 9) * v.x; });   // cupped, drooping, a little wavy
    leafGeo.rotateX(-Math.PI / 2);                                                  // lie flat: tip towards -z, face up
    const leafMat = k.mat({ map: leafTex, alphaTest: .5, side: T.DoubleSide, roughness: .45, clearcoat: .3, clearcoatRoughness: .35 });
    const stemMat = k.plastic('#4e8c3a', { rough: .5, coat: .2 });
    // leaves: [angle round (deg, 0 = towards camera), reach, height, size, pitch (deg, - = droop), roll (deg)]
    const leaves = [[5, .85, 3.95, 2.6, -52, 0], [-48, 1.05, 3.55, 2.4, -40, 14], [52, 1.05, 3.7, 2.45, -42, -14], [-100, 1.25, 3.95, 2.3, -24, 24],
      [98, 1.25, 4.15, 2.3, -22, -24], [-150, .75, 5.2, 2.3, 26, 8], [150, .75, 5.4, 2.4, 30, -8], [-118, .9, 4.9, 2.1, 4, 22]];
    for (const [a0, reach, hgt, size, pitch, roll] of leaves) {
      const a = k.deg(a0 + k.range(-4, 4)), dir = [Math.sin(a), Math.cos(a)];
      const J = [dir[0] * reach, hgt, dir[1] * reach];
      const b = [dir[0] * .2 + k.range(-.1, .1), 1.5, dir[1] * .2 + k.range(-.1, .1)];
      k.add(g, k.tube([b, [b[0] * 1.2, 1.5 + (hgt - 1.5) * .5, b[2] * 1.2], [J[0] * .8, hgt + .3, J[2] * .8], J], .05, { seg: 40, rs: 8 }), stemMat);
      g.add(k.mesh(leafGeo, leafMat, { p: J, order: 'YXZ', r: [k.deg(pitch), a + Math.PI, k.deg(roll)], s: size }));
    }
    // the new leaf, still rolled up like a cigar
    k.add(g, k.tube([[.05, 1.5, -.05], [.1, 3.6, 0], [.2, 5.5, .05]], .045, { seg: 30, rs: 8 }), stemMat);
    k.add(g, k.lathe([[0, 0], [.1, .15], [.11, .55], [.07, 1.0], [0, 1.3]], { smooth: true, seg: 16 }), k.plastic('#8cc152', { rough: .4 }), { p: [.2, 5.45, .05], r: [0, 0, -.12] });
    return g;
  },

  // A stuffed velvet throw pillow with a kilim pattern, piping, corner tassels and the karate chop on top.
  pillow(k) {
    const g = k.group(), T = k.THREE, p = k.group([], { p: [0, 0, 0], r: [k.deg(-8), k.deg(-14), k.deg(2)] });
    g.add(p);
    const n = 40, geo = new T.PlaneGeometry(2, 2, n, n), T0 = .5;
    warp(k, geo, v => {
      const u = v.x, w = v.y;
      const puff = Math.pow(Math.max(0, (1 - u * u) * (1 - w * w)), .42);
      const chop = Math.exp(-((u / .22) ** 2)) * Math.max(0, w) ** 3;
      v.x = u * (1 - .09 * (1 - w * w));
      v.y = w * (1 - .09 * (1 - u * u)) - .13 * chop;
      v.z = T0 * puff * (1 - .45 * chop);
    });
    const pattern = k.tex(512, 512, (c, w, h) => {
      c.fillStyle = '#e0a52c'; c.fillRect(0, 0, w, h);
      const cell = w / 4;
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
        const x = i * cell, y = j * cell;
        c.fillStyle = '#b2452b'; c.beginPath(); c.moveTo(x, y - cell * .42); c.lineTo(x + cell * .42, y); c.lineTo(x, y + cell * .42); c.lineTo(x - cell * .42, y); c.fill();
        c.fillStyle = '#f5e6c8'; c.beginPath(); c.moveTo(x, y - cell * .26); c.lineTo(x + cell * .26, y); c.lineTo(x, y + cell * .26); c.lineTo(x - cell * .26, y); c.fill();
        c.fillStyle = '#2e6f73'; c.beginPath(); c.moveTo(x, y - cell * .12); c.lineTo(x + cell * .12, y); c.lineTo(x, y + cell * .12); c.lineTo(x - cell * .12, y); c.fill();
        c.fillStyle = '#f5e6c8'; for (const [dx, dy] of [[.5, .5]]) { c.beginPath(); c.arc(x + cell * dx, y + cell * dy, cell * .07, 0, Math.PI * 2); c.fill(); }
      }
      c.fillStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < w; i += 3) c.fillRect(i, 0, 1, h);
    });
    const velvet = new T.MeshPhysicalMaterial({ map: pattern, roughness: .9, sheen: 1, sheenRoughness: .35, sheenColor: k.color('#fff0c8') });
    k.add(p, geo, velvet, { p: [0, 1.1, 0] });
    k.add(p, geo, velvet, { p: [0, 1.1, 0], s: [1, 1, -1] });
    // piping round the seam
    const edge = [];
    const rim = (u, w) => { const chop = Math.exp(-((u / .22) ** 2)) * Math.max(0, w) ** 3; return [u * (1 - .09 * (1 - w * w)), w * (1 - .09 * (1 - u * u)) - .13 * chop + 1.1, 0]; };
    for (let i = 0; i < 24; i++) edge.push(rim(-1 + i / 12, 1));
    for (let i = 0; i < 24; i++) edge.push(rim(1, 1 - i / 12));
    for (let i = 0; i < 24; i++) edge.push(rim(1 - i / 12, -1));
    for (let i = 0; i < 24; i++) edge.push(rim(-1, -1 + i / 12));
    const cordMat = k.fabric('#b2452b', { weave: false });
    k.add(p, k.tube(edge, .045, { closed: true, seg: 200, rs: 10, tension: .2 }), cordMat);
    // tassels at the corners
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tg = k.group([], { p: [sx * 1.02, 1.1 + sy * 1.02, 0], r: [0, 0, Math.atan2(sy, sx) - Math.PI / 2] });
      k.add(tg, k.sphere(.07, { w: 16, h: 12 }), cordMat, { p: [0, .06, 0] });
      k.add(tg, k.lathe([[0, 0], [.05, .02], [.06, .1], [.1, .3], [.09, .34], [0, .34]], { seg: 20 }), k.fabric('#f5e6c8', { weave: false }), { p: [0, .08, 0] });
      p.add(tg);
    }
    g.userData.view = { az: 24, el: 14 };
    return g;
  },

  // An 8 × 10 oak frame on its easel back, still holding the stock photo of a smiling family, price sticker and all.
  frame(k) {
    const g = k.group(), T = k.THREE, f = k.group([], { r: [k.deg(-12), 0, 0] });
    g.add(f);
    const W = 12, H = 9.6, ow = 9.2, oh = 6.8, D = .9;
        const woodV = k.wood('walnut', { varnish: .8, repeat: .3 }), woodH = k.wood('walnut', { varnish: .8, repeat: .3 });
    woodH.map.center.set(.5, .5); woodH.map.rotation = Math.PI / 2;
    const rails = mitredFrame(k, W, H, ow, oh, D + .44, .2, [woodV, woodH]); rails.position.set(0, H / 2, 0); f.add(rails);
    // mat board and photo
    k.add(f, k.box(ow + .1, oh + .1, .1), k.paper('#fbf8f1'), { p: [0, H / 2, -.05] });
    const photo = k.painted(640, 480, (c, w, h) => {
      let gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8fd0f5'); gr.addColorStop(.55, '#d7efff'); gr.addColorStop(.56, '#9ed38a'); gr.addColorStop(1, '#5fae55');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 14; i++) { c.fillStyle = `rgba(${90 + i * 5},${160 + i * 3},90,.5)`; c.beginPath(); c.arc(40 + i * 46, h * .5 + Math.sin(i) * 12, 38 + (i % 3) * 12, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = 'rgba(255,250,220,.55)'; c.beginPath(); c.arc(w * .85, h * .12, 60, 0, Math.PI * 2); c.fill();
      // [x, head y, head r, skin, hair, shirt, shoulders]
      const fam = [[.24, .3, 48, '#f0c3a0', '#5a3a22', '#3d7fd0', 108], [.47, .35, 44, '#e2a57e', '#7a2c1f', '#e8604c', 96], [.66, .52, 36, '#f3caa6', '#e0b050', '#ffd23e', 74], [.84, .45, 34, '#c98a60', '#2a1c14', '#48b36b', 70]];
      for (const [x, y, r, skin, hair, shirt, sh] of fam) {                   // bodies first
        c.fillStyle = shirt; c.beginPath(); c.ellipse(w * x, h * y + r * 2.6, sh, r * 2, 0, Math.PI, 0); c.lineTo(w * x + sh, h); c.lineTo(w * x - sh, h); c.fill();
      }
      fam.forEach(([x, y, r, skin, hair], i) => {
        const cx = w * x, cy = h * y;
        c.fillStyle = hair;
        if (i === 1) { c.beginPath(); c.ellipse(cx, cy + r * .4, r * 1.25, r * 1.5, 0, 0, Math.PI * 2); c.fill(); }
        if (i === 2) { for (const s of [-1, 1]) { c.beginPath(); c.arc(cx + s * r * 1.05, cy + r * .1, r * .38, 0, Math.PI * 2); c.fill(); } }
        c.fillStyle = skin; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
        c.fillStyle = hair; c.beginPath(); c.arc(cx, cy - r * .1, r * 1.02, Math.PI * 1.05, Math.PI * 1.95); c.fill();
        c.strokeStyle = '#2b1a12'; c.lineWidth = r * .1; c.lineCap = 'round';
        for (const s of [-1, 1]) { c.beginPath(); c.arc(cx + s * r * .36, cy + r * .08, r * .14, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
        c.fillStyle = '#ffffff'; c.strokeStyle = '#8a3a2a'; c.lineWidth = r * .06;
        c.beginPath(); c.arc(cx, cy + r * .3, r * .42, .15, Math.PI - .15); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,120,120,.35)'; for (const s of [-1, 1]) { c.beginPath(); c.arc(cx + s * r * .58, cy + r * .34, r * .16, 0, Math.PI * 2); c.fill(); }
      });
    }, { rough: .35, coat: .3 });
    k.add(f, k.plane(ow - 1.2, oh - 1.1), photo, { p: [0, H / 2, .01] });
    // glass with a glint, and the price sticker
    k.add(f, k.plane(ow, oh), k.glass('#ffffff', { opacity: .08 }), { p: [0, H / 2, .06], shadow: false });
    const glint = k.decal(ow, oh, (c, w, h) => {
      c.fillStyle = 'rgba(255,255,255,.22)';
      c.beginPath(); c.moveTo(w * .55, 0); c.lineTo(w * .72, 0); c.lineTo(w * .42, h); c.lineTo(w * .25, h); c.fill();
      c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(w * .76, 0); c.lineTo(w * .8, 0); c.lineTo(w * .5, h); c.lineTo(w * .46, h); c.fill();
    }, { p: [0, H / 2, .07] });
    f.add(glint);
    const tag = k.decal(1.5, 1, (c, w, h) => {
      c.fillStyle = '#ff8a2a'; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 18); c.fill();
      k.text(c, '$17.99', w / 2, h / 2 + 2, { size: 64, weight: 700, color: '#ffffff' });
    }, { p: [ow / 2 - 1.1, H / 2 - oh / 2 + .8, .075] });
    f.add(tag);
    // backing board and easel leg
    const back = -(D / 2 + .22);
    k.add(f, k.box(W - 1.6, H - 1.6, .12, .04), k.matte('#6b4a2f', .9), { p: [0, H / 2, back - .05] });
    const leg = k.group([], { p: [0, H * .62, back - .1], r: [k.deg(30), 0, 0] });
    k.add(leg, k.box(1.6, H * .64, .14, .05), k.matte('#6b4a2f', .9), { p: [0, -H * .32, -.07] });
    f.add(leg);
    g.userData.view = { az: 20, el: 12 };
    return g;
  },

  // A walnut wall clock with a cream dial, stopped for its portrait at ten past ten.
  wallclock(k) {
    const g = k.group(), c0 = k.group([], { p: [0, 6.1, 0], r: [k.deg(-6), 0, 0] });
    g.add(c0);
    const rim = k.lathe([[5.15, 0], [5.95, 0], [6.1, .3], [6.05, .95], [5.75, 1.25], [5.4, 1.2], [5.2, .95], [5.1, .9], [5.15, 0]], { seg: 96 });
    k.add(c0, rim, k.wood('walnut', { varnish: 1, repeat: .3 }), { r: [Math.PI / 2, 0, 0] });
    k.add(c0, k.torus(5.12, .09, { rs: 12, ts: 96 }), k.brass(), { p: [0, 0, .9] });
    k.add(c0, k.cyl(5.9, 5.9, .2, { seg: 64 }), k.matte('#3a2616', .8), { p: [0, 0, .1], r: [Math.PI / 2, 0, 0] });
    const dial = k.painted(1024, 1024, (c, w, h) => {
      const cx = w / 2, cy = h / 2, R = w / 2;
      const gr = c.createRadialGradient(cx, cy, 0, cx, cy, R); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, '#f1e6cf');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = '#2a2420';
      for (let i = 0; i < 60; i++) {
        const a = i / 60 * Math.PI * 2, big = i % 5 === 0, r0 = R * (big ? .84 : .88), r1 = R * .95;
        c.save(); c.translate(cx, cy); c.rotate(a); c.fillRect(-(big ? 7 : 2.5), -r1, big ? 14 : 5, r1 - r0); c.restore();
      }
      for (let i = 1; i <= 12; i++) {
        const a = i / 12 * Math.PI * 2;
        k.text(c, String(i), cx + Math.sin(a) * R * .7, cy - Math.cos(a) * R * .7 + 6, { size: 104, weight: 600, color: '#2a2420' });
      }
      k.text(c, 'QUARTZ', cx, cy + R * .36, { size: 30, weight: 700, color: '#9a8a74', font: 'Nunito, sans-serif' });
    }, { rough: .6 });
    k.add(c0, k.disc(5.12, 96), dial, { p: [0, 0, .31] });
    // hands at 10:10:35
    const black = k.gloss('#1d1b1a');
    const hand = (len, wid, tail, ang, z, mat) => {
      const s = k.shape([[-wid / 2, -tail], [wid / 2, -tail], [wid * .35, len * .82], [0, len], [-wid * .35, len * .82]]);
      k.add(c0, k.extrude(s, .05, { bevel: .015, bevelSeg: 1 }), mat, { p: [0, 0, z], r: [0, 0, -ang] });
    };
    hand(2.7, .34, .5, k.deg(305), .45, black);
    hand(4.0, .24, .6, k.deg(60), .56, black);
    const red = k.gloss('#d8342a');
    k.add(c0, k.box(.06, 5.0, .03), red, { p: [Math.sin(k.deg(210)) * 1.6, Math.cos(k.deg(210)) * 1.6, .66], r: [0, 0, -k.deg(210)] });
    k.add(c0, k.cyl(.26, .26, .08, { seg: 24 }), red, { p: [0, 0, .66], r: [Math.PI / 2, 0, 0] });
    k.add(c0, k.cyl(.1, .1, .14, { seg: 16 }), k.brass(), { p: [0, 0, .72], r: [Math.PI / 2, 0, 0] });
    // domed glass
    k.add(c0, k.sphere(34, { thetaLen: .154, w: 64, h: 8 }), k.glass('#ffffff', { opacity: .1 }), { p: [0, 0, 1.35 - 34], r: [Math.PI / 2, 0, 0], shadow: false });
    g.userData.view = { az: 16, el: 10 };
    return g;
  },

  // A mid-century three-seater in rust velvet: tufted back cushions, tapered walnut legs with brass toes.
  sofa(k) {
    const g = k.group(), T = k.THREE;
    const velvet = new T.MeshPhysicalMaterial({ color: k.color('#b4472a'), roughness: .8, sheen: 1, sheenRoughness: .45, sheenColor: k.color('#ff9a78'), map: k.weaveTex(1.5) });
    const W = 8.4, D = 3.4, legH = .62;
    // a rounded box with its top (axis 'y') or front ('z') puffed out
    const cushion = (w, h, d, r, axis, amt) => warp(k, k.box(w, h, d, r, 4), v => {
      const a = v.x / (w / 2), b = axis === 'y' ? v.z / (d / 2) : v.y / (h / 2), f = amt * Math.max(0, 1 - a * a) * Math.max(0, 1 - b * b);
      if (axis === 'y' && v.y > 0) v.y += f * v.y / (h / 2);
      if (axis === 'z' && v.z > 0) v.z += f * v.z / (d / 2);
    }, true);
    const walnut = k.wood('walnut', { varnish: .8 }), brass = k.brass();
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = k.group([], { p: [sx * (W / 2 - .45), legH, sz * (D / 2 - .4)], r: [sz * .14, 0, -sx * .14] });
      k.add(leg, k.cyl(.11, .065, legH, { seg: 20 }), walnut, { p: [0, -legH / 2, 0] });
      k.add(leg, k.cyl(.068, .06, .12, { seg: 20 }), brass, { p: [0, -legH + .06, 0] });
      g.add(leg);
    }
    k.add(g, cushion(W, .62, D, .2, 'y', 0), velvet, { p: [0, legH + .31, 0] });                                  // seat deck
    for (const sx of [-1, 1]) k.add(g, k.box(.72, 1.6, D, .3, 4), velvet, { p: [sx * (W / 2 - .36), legH + .8, 0] }); // arms
    k.add(g, k.box(W - 1.3, 2.1, .55, .22, 4), velvet, { p: [0, legH + 1.05, -D / 2 + .28] });                    // back
    const seatY = legH + .62;
    for (let i = -1; i <= 1; i++) k.add(g, cushion(2.3, .52, 2.72, .2, 'y', .09), velvet, { p: [i * 2.32, seatY + .26, .3] });
    const backs = [];
    for (let i = -1; i <= 1; i++) {
      const b = k.group([], { p: [i * 2.32, seatY + .52 + .66, -1.12], r: [k.deg(-9), 0, 0] });
      k.add(b, cushion(2.3, 1.36, .62, .24, 'z', .12), velvet);
      for (const x of [-.6, 0, .6]) backs.push({ p: [i * 2.32 + x, seatY + .52 + .72, -1.12 + .38 + .05] });
      g.add(b);
    }
    g.add(k.instances(k.sphere(.07, { w: 12, h: 8 }), k.fabric('#9c4222', { weave: false }), backs));
    // a mustard throw pillow in the corner
    const pil = warp(k, new T.PlaneGeometry(2, 2, 16, 16), v => { const f = Math.pow(Math.max(0, (1 - v.x * v.x) * (1 - v.y * v.y)), .45); v.x *= 1 - .08 * (1 - v.y * v.y); v.y *= 1 - .08 * (1 - v.x * v.x); v.z = .32 * f; });
    const pm = k.fabric('#e3a92f');
    const pg = k.group([], { p: [-2.75, seatY + .52 + .62, -.62], r: [k.deg(-18), k.deg(22), k.deg(8)], s: .62 });
    k.add(pg, pil, pm); k.add(pg, pil, pm, { s: [1, 1, -1] });
    g.add(pg);
    g.userData.view = { el: 14 };
    g.userData.noHero = true;      // low and long, but it's furniture: keep it on its feet
    return g;
  },

  // A 65-inch flat screen on a pedestal, playing a sunset — and asking the question.
  tv(k) {
    const g = k.group();
    const W = 6.4, H = 3.6, bz = .06, lift = .42;
    const tv = k.group([], { p: [0, lift + H / 2 + bz, 0] }); g.add(tv);
    const dark = k.metal('#2a2b31', .35);
    k.add(tv, k.box(W + bz * 2, H + bz * 2, .12, .05), dark);
    k.add(tv, k.box(W * .62, H * .55, .3, .12), k.plastic('#1d1e22', { rough: .6, coat: .1 }), { p: [0, -H * .08, -.2] });
    const screen = k.painted(1024, 576, (c, w, h) => {
      let gr = c.createLinearGradient(0, 0, 0, h * .6);
      gr.addColorStop(0, '#29287e'); gr.addColorStop(.45, '#b5388a'); gr.addColorStop(.8, '#ff7b4a'); gr.addColorStop(1, '#ffc65c');
      c.fillStyle = gr; c.fillRect(0, 0, w, h * .6);
      const sx = w * .6, sy = h * .5;
      gr = c.createRadialGradient(sx, sy, 0, sx, sy, h * .45); gr.addColorStop(0, 'rgba(255,240,180,.9)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff4c2'; c.beginPath(); c.arc(sx, sy, h * .11, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,170,200,.55)';                                             // clouds
      for (const [x, y, s] of [[.18, .18, 1], [.34, .24, .7], [.78, .14, .9], [.9, .28, .6]]) { c.beginPath(); c.ellipse(w * x, h * y, w * .09 * s, h * .03 * s, 0, 0, Math.PI * 2); c.ellipse(w * x + w * .04 * s, h * y - h * .02, w * .05 * s, h * .03 * s, 0, 0, Math.PI * 2); c.fill(); }
      const ridge = (base, amp, col, seed) => {                                        // mountains
        c.fillStyle = col; c.beginPath(); c.moveTo(0, h * .6);
        for (let x = 0; x <= w; x += 8) c.lineTo(x, h * (base - amp * (Math.abs(Math.sin(x * .006 + seed)) * .7 + Math.sin(x * .021 + seed * 3) * .15)));
        c.lineTo(w, h * .6); c.fill();
      };
      ridge(.6, .22, '#7d3a8f', 1); ridge(.6, .14, '#4d2474', 4);
      gr = c.createLinearGradient(0, h * .6, 0, h); gr.addColorStop(0, '#ff9c5c'); gr.addColorStop(.35, '#b7457f'); gr.addColorStop(1, '#2a2468');
      c.fillStyle = gr; c.fillRect(0, h * .6, w, h * .4);
      c.fillStyle = 'rgba(255,236,170,.75)';                                            // sun on the water
      for (let i = 0; i < 12; i++) { const y = h * (.62 + i * .03), ww = w * (.07 - i * .004); c.fillRect(sx - ww / 2 + Math.sin(i * 2.3) * 10, y, ww, h * .008); }
      c.fillStyle = '#1d1238';                                                          // pines
      for (const [x, s] of [[.04, 1.2], [.1, .9], [.15, 1.05], [.92, 1.15], [.97, .95]]) {
        const bx = w * x, by = h, th = h * .5 * s;
        c.fillRect(bx - 4, by - th * .15, 8, th * .15);
        for (let j = 0; j < 4; j++) { const y = by - th * (.12 + j * .2), ww = w * .045 * s * (1 - j * .2); c.beginPath(); c.moveTo(bx, y - th * .32); c.lineTo(bx + ww, y); c.lineTo(bx - ww, y); c.fill(); }
      }
      // the question
      c.fillStyle = 'rgba(12,10,26,.72)'; c.beginPath(); c.roundRect(w * .31, h * .7, w * .38, h * .2, 14); c.fill();
      k.text(c, 'Are you still watching?', w / 2, h * .76, { size: 30, weight: 600, color: '#ffffff' });
      c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(w * .36, h * .815, w * .13, h * .055, 12); c.fill();
      k.text(c, 'Continue', w * .425, h * .843, { size: 18, weight: 700, color: '#15131f' });
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.beginPath(); c.roundRect(w * .51, h * .815, w * .13, h * .055, 12); c.stroke();
      k.text(c, 'Back', w * .575, h * .843, { size: 18, weight: 600, color: '#ffffff' });
    }, { glow: .9, rough: .18, coat: .8 });
    k.add(tv, k.plane(W, H), screen, { p: [0, 0, .061] });
    k.add(tv, k.box(.42, .03, .01), k.metal('#c9ced6', .25), { p: [0, -H / 2 - bz / 2, .062] });                   // badge
    k.add(tv, k.sphere(.018, { w: 10, h: 8 }), k.glow('#ff4a3d', 2.5), { p: [W / 2 - .25, -H / 2 - bz / 2, .065] }); // standby light
    // pedestal
    const stand = k.metal('#3a3b42', .3);
    k.add(g, k.box(.6, lift + .9, .12, .05), stand, { p: [0, (lift + .9) / 2 + .06, -.28] });
    k.add(g, k.box(2.8, .08, 1.25, .04), stand, { p: [0, .04, -.2] });
    g.userData.view = { az: 16, el: 9 };
    return g;
  },

  // A walnut turntable spinning a record, tonearm down on the first song.
  recordplayer(k) {
    const g = k.group(), T = k.THREE;
    const PW = 4.4, PD = 3.5, PH = .55, foot = .12, top = foot + PH + .02;
    const plinth = k.wood('walnut', { varnish: .9 }); plinth.map.center.set(.5, .5); plinth.map.rotation = Math.PI / 2;   // grain running along the long sides
    k.add(g, k.box(PW, PH, PD, .1), plinth, { p: [0, foot + PH / 2, 0] });
    k.add(g, k.box(PW - .14, .04, PD - .14, .02), k.metal('#232327', .5), { p: [0, foot + PH, 0] });
    g.add(k.feet([[-PW / 2 + .35, -PD / 2 + .35], [PW / 2 - .35, -PD / 2 + .35], [-PW / 2 + .35, PD / 2 - .35], [PW / 2 - .35, PD / 2 - .35]], .2, foot, k.aluminum()));
    // platter with strobe dots, and the record
    const C = [-.52, .1];
    k.add(g, k.cyl(1.6, 1.6, .16, { seg: 96 }), k.aluminum(), { p: [C[0], top + .08, C[1]] });
    const dots = k.painted(1024, 32, (c, w, h) => { c.fillStyle = '#b7bcc4'; c.fillRect(0, 0, w, h); c.fillStyle = '#4a4d55'; for (let i = 0; i < 90; i++) c.fillRect(i * w / 90, h * .2, w / 180, h * .6); }, { metal: .8, rough: .3 });
    k.add(g, k.cyl(1.603, 1.603, .1, { seg: 96, open: true }), dots, { p: [C[0], top + .08, C[1]], shadow: false });
    k.add(g, k.cyl(1.52, 1.52, .03, { seg: 96 }), k.gloss('#101012'), { p: [C[0], top + .175, C[1]] });
    const vinyl = k.painted(1024, 1024, (c, w, h) => {
      const cx = w / 2, cy = h / 2, R = w / 2;
      c.fillStyle = '#121214'; c.fillRect(0, 0, w, h);
      for (let r = R * .36; r < R * .985; r += 1.6) {
        const band = [.5, .62, .74, .86].some(b => Math.abs(r / R - b) < .006);
        c.strokeStyle = band ? 'rgba(0,0,0,.9)' : `rgba(255,255,255,${.035 + (Math.sin(r * .9) + 1) * .018})`;
        c.lineWidth = band ? 3 : .8; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
      }
      const sheen = c.createConicGradient(-.5, cx, cy);                                  // the sheen that runs across a record
      [[0, 0], [.06, .2], [.12, 0], [.5, 0], [.56, .16], [.62, 0], [1, 0]].forEach(([t, a]) => sheen.addColorStop(t, `rgba(255,255,255,${a})`));
      c.fillStyle = sheen; c.beginPath(); c.arc(cx, cy, R * .985, 0, Math.PI * 2); c.arc(cx, cy, R * .35, 0, Math.PI * 2, true); c.fill();
      c.fillStyle = '#e0492f'; c.beginPath(); c.arc(cx, cy, R * .34, 0, Math.PI * 2); c.fill();          // label
      c.strokeStyle = '#ffd66b'; c.lineWidth = 5; c.beginPath(); c.arc(cx, cy, R * .31, 0, Math.PI * 2); c.stroke();
      k.text(c, 'SIDE A', cx, cy - R * .17, { size: 44, weight: 700, color: '#ffe9b0' });
      k.text(c, '33⅓', cx, cy + R * .18, { size: 36, weight: 700, color: '#ffe9b0' });
      c.fillStyle = '#ffe9b0'; c.fillRect(cx - R * .16, cy + R * .06, R * .32, 3);
    }, { rough: .22, coat: .9 });
    k.add(g, k.disc(1.52, 96), vinyl, { p: [C[0], top + .1915, C[1]], r: [-Math.PI / 2, 0, 0] });
    k.add(g, k.cyl(.035, .035, .14, { seg: 16 }), k.chrome(), { p: [C[0], top + .25, C[1]] });
    // tonearm: find where the stylus lands (1.2 from the centre, 2.3 from the pivot)
    const P = [1.62, -1.02], armL = 2.3, playR = 1.2;
    let best = 0, err = 1e9;
    for (let a = 0; a < Math.PI * 2; a += .002) { const x = C[0] + Math.cos(a) * playR, z = C[1] + Math.sin(a) * playR, e = Math.abs(Math.hypot(x - P[0], z - P[1]) - armL); if (e < err && z > C[1] - .2) { err = e; best = a; } }
    const S = [C[0] + Math.cos(best) * playR, C[1] + Math.sin(best) * playR];
    const chrome = k.chrome(), black = k.plastic('#1b1b1e', { rough: .5 });
    k.add(g, k.rcyl(.24, .12, .03), k.aluminum(), { p: [P[0], top, P[1]] });
    k.add(g, k.cyl(.1, .12, .36, { seg: 24 }), chrome, { p: [P[0], top + .18, P[1]] });
    const armY = top + .4, headY = top + .3;
    const ux = (S[0] - P[0]) / armL, uz = (S[1] - P[1]) / armL;
    const elbow = [S[0] - ux * .42 + uz * .1, headY + .04, S[1] - uz * .42 - ux * .1];
    k.add(g, k.tube([[P[0] - ux * .05, armY, P[1] - uz * .05], [P[0] + ux * .8 - uz * .1, armY - .02, P[1] + uz * .8 + ux * .1], elbow, [S[0] - ux * .2, headY + .02, S[1] - uz * .2]], .032, { seg: 48, rs: 10 }), chrome);
    const yaw = Math.atan2(-uz, ux);
    const head = k.group([], { p: [S[0], headY, S[1]], r: [0, yaw + .35, 0] });
    k.add(head, k.box(.42, .05, .2, .02), black);
    k.add(head, k.box(.2, .12, .13, .02), k.gloss('#d83a2c'), { p: [.02, -.08, 0] });
    k.add(head, k.tube([[.18, .02, .07], [.3, .04, .13], [.36, .1, .15]], .014, { seg: 12, rs: 6 }), chrome);
    g.add(head);
    k.add(g, k.cyl(.15, .15, .3, { seg: 32 }), black, { p: [P[0] - ux * .32, armY, P[1] - uz * .32], r: [0, 0, 0], order: 'YXZ' }).rotation.set(Math.PI / 2, -yaw + Math.PI / 2, 0, 'YXZ');
    k.add(g, k.cyl(.035, .035, .34, { seg: 12 }), chrome, { p: [1.55, top + .17, .45] });                           // arm rest
    k.add(g, k.box(.16, .05, .12, .02), black, { p: [1.55, top + .35, .45] });
    // speed knob, start button, a light
    const knob = k.knob(.2, .12, k.aluminum(), black); knob.position.set(-1.85, top, 1.45); knob.rotation.y = .7; g.add(knob);
    k.add(g, k.rcyl(.13, .06, .03, { seg: 24 }), k.gloss('#e8e2d4'), { p: [1.35, top, 1.35] });
    k.add(g, k.sphere(.035, { w: 12, h: 8 }), k.glow('#6dff8a', 2), { p: [1.72, top + .01, 1.38] });
    const lab = k.decal(.6, .2, (c, w, h) => { k.text(c, '33   45', w / 2, h / 2, { size: 40, weight: 700, color: '#d8dbe2' }); }, { p: [-1.85, top + .005, 1.12], r: [-Math.PI / 2, 0, 0] });
    g.add(lab);
    g.userData.view = { az: 26, el: 30 };
    return g;
  },

  // A cherry longcase clock: brass dial with a moon arch under a swan-neck crown, pendulum and weights behind the glass.
  grandfatherclock(k) {
    const g = k.group(), T = k.THREE;
    const wood = k.wood('cherry', { varnish: 1, repeat: 1.2 }), dark = k.wood('#4a2012', { varnish: .8, repeat: 1.2 }), brass = k.brass(), gold = k.gold();
    const inside = k.matte('#2b140b', .9);
    // base
    k.add(g, k.box(2.3, .32, 1.36, .04), dark, { p: [0, .16, 0] });
    k.add(g, k.box(2.06, 1.5, 1.2, .04), wood, { p: [0, .32 + .75, 0] });
    k.add(g, k.box(1.4, 1.0, .08, .04), dark, { p: [0, 1.07, .62] });
    k.add(g, k.box(1.2, .8, .08, .04), wood, { p: [0, 1.07, .66] });
    k.add(g, k.box(2.2, .16, 1.3, .05), dark, { p: [0, 1.9, 0] });
    // trunk: sides and back, so you can see in
    const y0 = 1.98, y1 = 5.2, th = y1 - y0, ym = (y0 + y1) / 2;
    for (const sx of [-1, 1]) k.add(g, k.box(.12, th, 1.0, .02), wood, { p: [sx * .76, ym, 0] });
    k.add(g, k.box(1.6, th, .1, .02), inside, { p: [0, ym, -.45] });
    // trunk door: a frame with an arched window
    const door = k.shape([[-.8, -th / 2], [.8, -th / 2], [.8, th / 2], [-.8, th / 2]]);
    const win = new T.Path(); const ww = .5, wb = -th / 2 + .45, wt = th / 2 - .9;
    win.moveTo(-ww, wb); win.lineTo(ww, wb); win.lineTo(ww, wt); win.absarc(0, wt, ww, 0, Math.PI, false); win.lineTo(-ww, wb);
    k.add(g, k.extrude(door, .08, { holes: [win], bevel: .02, bevelSeg: 2 }), [wood, dark], { p: [0, ym, .5] });
    k.add(g, k.plane(1.1, th - .5), k.glass('#fff8e8', { opacity: .12 }), { p: [0, ym, .5], shadow: false });
    // pendulum and three weights on chains
    k.add(g, k.box(.05, 2.4, .03), brass, { p: [.05, 5.1 - 1.2, -.2], r: [0, 0, .03] });
    k.add(g, k.cyl(.36, .36, .06, { seg: 48 }), gold, { p: [.05 + Math.sin(.03) * 2.4, 2.7, -.2], r: [Math.PI / 2, 0, 0] });
    k.add(g, k.torus(.36, .025, { rs: 8, ts: 48 }), brass, { p: [.05 + Math.sin(.03) * 2.4, 2.7, -.17] });
    const chain = k.metal('#b08a3e', .35);
    for (const [x, y] of [[-.42, 3.9], [0, 3.55], [.42, 3.8]]) {
      k.add(g, k.cyl(.12, .12, .78, { seg: 32 }), brass, { p: [x, y, .12] });
      k.add(g, k.cyl(.125, .125, .05, { seg: 32 }), k.metal('#8f6a28', .3), { p: [x, y + .36, .12] });
      k.add(g, k.cyl(.012, .012, 5.1 - y - .39, { seg: 6 }), chain, { p: [x, (5.1 + y + .39) / 2, .12] });
    }
    k.add(g, k.box(1.9, .18, 1.22, .05), dark, { p: [0, 5.29, 0] });
    // hood with the dial behind glass, columns on the corners
    const hy0 = 5.38, hh = 2.1, hm = hy0 + hh / 2;
    k.add(g, k.box(2.0, hh, 1.18, .04), wood, { p: [0, hm, -.04] });
    const dw = 1.36, sq = dw, dialCy = hy0 + .12 + sq / 2;                          // square dial + arch
    const hoodFront = k.shape([[-1.0, -hh / 2], [1.0, -hh / 2], [1.0, hh / 2], [-1.0, hh / 2]]);
    const op = new T.Path(), oy0 = dialCy - sq / 2 - hm, oy1 = dialCy + sq / 2 - hm;
    op.moveTo(-sq / 2, oy0); op.lineTo(sq / 2, oy0); op.lineTo(sq / 2, oy1); op.absarc(0, oy1, sq / 2, 0, Math.PI, false); op.lineTo(-sq / 2, oy0);
    k.add(g, k.extrude(hoodFront, .08, { holes: [op], bevel: .02, bevelSeg: 2 }), [wood, dark], { p: [0, hm, .6] });
    const dial = k.painted(512, 768, (c, w, h) => {
      const cx = w / 2, cy = h - w / 2, R = w / 2;
      c.beginPath(); c.moveTo(0, h); c.lineTo(w, h); c.lineTo(w, h - w); c.arc(cx, h - w, R, 0, Math.PI, true); c.closePath(); c.clip();
      let gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#f0d58a'); gr.addColorStop(.5, '#caa04c'); gr.addColorStop(1, '#e7c574');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      // moon arch: night sky, stars and a smiling moon between two hemispheres
      c.save(); c.beginPath(); c.arc(cx, h - w, R * .82, Math.PI, 0); c.closePath(); c.clip();
      c.fillStyle = '#1f3f8f'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffe9a0'; for (let i = 0; i < 16; i++) { const a = Math.PI + (i * 2.39 % Math.PI), r = R * (.35 + (i * .37 % .45)); c.beginPath(); c.arc(cx + Math.cos(a) * r, h - w + Math.sin(a) * r, 4, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#fbeec0'; c.beginPath(); c.arc(cx + R * .08, h - w - R * .42, R * .3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c9a76a'; c.beginPath(); c.arc(cx + R * .0, h - w - R * .44, 5, 0, Math.PI * 2); c.arc(cx + R * .16, h - w - R * .44, 5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#c9a76a'; c.lineWidth = 4; c.beginPath(); c.arc(cx + R * .08, h - w - R * .38, R * .1, .3, Math.PI - .3); c.stroke();
      c.restore();
      c.fillStyle = '#d8b460'; for (const s of [-1, 1]) { c.beginPath(); c.arc(cx + s * R * .5, h - w, R * .32, Math.PI, 0); c.fill(); }
      // chapter ring
      c.fillStyle = '#f4eedc'; c.beginPath(); c.arc(cx, cy, R * .92, 0, Math.PI * 2); c.arc(cx, cy, R * .6, 0, Math.PI * 2, true); c.fill();
      c.strokeStyle = '#3a2c1a'; c.lineWidth = 2;
      for (const r of [.92, .84, .6]) { c.beginPath(); c.arc(cx, cy, R * r, 0, Math.PI * 2); c.stroke(); }
      for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; c.lineWidth = i % 5 ? 1.5 : 4; c.beginPath(); c.moveTo(cx + Math.sin(a) * R * .84, cy - Math.cos(a) * R * .84); c.lineTo(cx + Math.sin(a) * R * .92, cy - Math.cos(a) * R * .92); c.stroke(); }
      const romans = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      romans.forEach((s, i) => {
        const a = i / 12 * Math.PI * 2;
        c.save(); c.translate(cx + Math.sin(a) * R * .72, cy - Math.cos(a) * R * .72); c.rotate(a);
        k.text(c, s, 0, 2, { size: 34, weight: 600, color: '#2a2016', font: 'Georgia, serif' }); c.restore();
      });
      c.fillStyle = 'rgba(120,80,20,.45)';                                             // spandrel scrolls
      for (const [x, y] of [[0, h - w], [w, h - w], [0, h], [w, h]]) { c.beginPath(); c.arc(x, y, R * .3, 0, Math.PI * 2); c.fill(); }
      // hands at eight minutes past ten
      c.fillStyle = '#1a140e'; c.strokeStyle = '#1a140e';
      const handPath = (a, len, wid) => { c.save(); c.translate(cx, cy); c.rotate(a); c.beginPath(); c.moveTo(-wid, 10); c.lineTo(0, -len); c.lineTo(wid, 10); c.fill(); c.beginPath(); c.arc(0, -len * .62, wid * 1.6, 0, Math.PI * 2); c.lineWidth = 4; c.stroke(); c.restore(); };
      handPath(k.deg(304), R * .5, 9); handPath(k.deg(48), R * .78, 6);
      c.beginPath(); c.arc(cx, cy, 12, 0, Math.PI * 2); c.fill();
    }, { transparent: true, rough: .35, metal: .45 });
    k.add(g, k.plane(sq, sq * 1.5), dial, { p: [0, dialCy + sq / 4, .55] });
    k.add(g, k.plane(sq + .1, sq * 1.5 + .1), k.glass('#fffaf0', { opacity: .1 }), { p: [0, dialCy + sq / 4, .6], shadow: false });
    for (const sx of [-1, 1]) {
      k.add(g, k.cyl(.075, .075, hh - .3, { seg: 20 }), dark, { p: [sx * .88, hm, .74] });
      for (const y of [hy0 + .1, hy0 + hh - .1]) k.add(g, k.cyl(.11, .11, .1, { seg: 20 }), brass, { p: [sx * .88, y, .74] });
    }
    // swan-neck crown with rosettes and finials
    const cy0 = hy0 + hh;
    k.add(g, k.box(2.2, .16, 1.3, .05), dark, { p: [0, cy0 + .08, 0] });
    for (const sx of [-1, 1]) {
      const half = new T.Shape(); half.moveTo(sx * 1.08, 0); half.lineTo(sx * .2, 0); half.lineTo(sx * .2, .66); half.quadraticCurveTo(sx * .55, 1.02, sx * 1.08, .42); half.closePath();
      k.add(g, k.extrude(half, .5, { bevel: .03, bevelSeg: 2 }), [wood, dark], { p: [0, cy0 + .16, .35] });
      k.add(g, k.cyl(.1, .1, .06, { seg: 24 }), brass, { p: [sx * .27, cy0 + .16 + .62, .64], r: [Math.PI / 2, 0, 0] });
      k.add(g, k.lathe([[0, 0], [.08, 0], [.05, .06], [.09, .14], [.07, .22], [0, .26]], { smooth: true, seg: 24 }), brass, { p: [sx * .96, cy0 + .16, .45] });
    }
    k.add(g, k.box(.3, .3, .5, .03), wood, { p: [0, cy0 + .31, .35] });
    k.add(g, k.lathe([[0, 0], [.12, 0], [.08, .08], [.15, .24], [.1, .38], [.04, .44], [.06, .5], [0, .56]], { smooth: true, seg: 24 }), brass, { p: [0, cy0 + .46, .35] });
    g.userData.view = { az: 26, el: 12 };
    return g;
  },

  // A brass crystal chandelier: twelve flame-tip bulbs on scrolled arms, prisms, bead swags and a crystal ball.
  chandelier(k) {
    const g = k.group(), T = k.THREE;
    const brass = k.brass();
    const crystal = new T.MeshPhysicalMaterial({ color: k.color('#f4f9ff'), roughness: .02, metalness: .1, transparent: true, opacity: .78, envMapIntensity: 2.8,
      clearcoat: 1, clearcoatRoughness: 0, iridescence: .7, iridescenceIOR: 1.6, flatShading: true, specularIntensity: 1 });
    // canopy and chain
    k.add(g, k.lathe([[0, 0], [.18, 0], [.3, .08], [.5, .22], [.52, .3], [0, .3]], { smooth: false, seg: 48 }), brass, { p: [0, 5.1, 0] });
    const links = [];
    for (let i = 0; i < 9; i++) links.push({ p: [0, 5.05 - i * .15, 0], r: [0, i % 2 ? Math.PI / 2 : 0, 0], s: [1, 1.35, 1] });
    g.add(k.instances(k.torus(.06, .016, { rs: 8, ts: 20 }), brass, links));
    // the stem: a turned brass baluster from the bottom finial up to the chain
    k.add(g, k.lathe([[0, 0], [.05, .06], [.08, .2], [.2, .42], [.34, .58], [.42, .7], [.5, .82], [.52, .9], [.3, .96], [.12, 1.05], [.1, 1.3], [.2, 1.5], [.24, 1.62],
      [.12, 1.78], [.08, 2.0], [.18, 2.15], [.2, 2.25], [.1, 2.35], [.06, 2.7], [.1, 3.3], [.05, 3.72], [0, 3.72]], { smooth: true, seg: 48 }), brass, { p: [0, .72, 0] });
    // arms: 8 low, 4 high, all S-scrolls merged into one mesh
    const arms = [], cups = [], bulbs = [], drops = [], lights = [];
    const addArm = (a, y, R, rise) => {
      const c = Math.cos(a), s = Math.sin(a), P = (r, h) => [s * r, y + h, c * r];
      arms.push(k.tube([P(.3, 0), P(.75, -.34), P(R * .7, -.4), P(R * .95, -.12), P(R, rise)], .045, { seg: 40, rs: 8 }));
      arms.push(k.tube([P(R * .55, -.36), P(R * .5, -.1), P(R * .6, .05), P(R * .67, -.05)], .025, { seg: 16, rs: 6 }));   // a little curl
      const top = y + rise;
      cups.push([s * R, top, c * R]);
      return top;
    };
    for (let i = 0; i < 8; i++) addArm(i / 8 * Math.PI * 2, 1.62, 2.2, .35);
    for (let i = 0; i < 4; i++) addArm((i + .5) / 4 * Math.PI * 2, 2.9, 1.25, .3);
    g.add(k.mesh(k.merge(arms), brass));
    const cupGeo = k.lathe([[0, 0], [.1, 0], [.13, .06], [.24, .12], [.25, .15], [.1, .12], [.09, .2], [0, .2]], { seg: 24 });
    g.add(k.instances(cupGeo, brass, cups.map(p => ({ p }))));
    g.add(k.instances(k.cyl(.07, .07, .42, { seg: 16 }), k.matte('#fbf6ea', .5), cups.map(([x, y, z]) => ({ p: [x, y + .2 + .21, z] }))));
    const flame = k.lathe([[0, 0], [.07, .05], [.1, .15], [.08, .28], [.03, .4], [0, .46]], { smooth: true, seg: 20 });
    g.add(k.instances(flame, k.glow('#ffd98a', 2.6), cups.map(([x, y, z]) => ({ p: [x, y + .62, z] }))));
    for (const [x, y, z] of cups) { const h = halo(k, .55, '#ffc861', .6); h.position.set(x, y + .8, z); g.add(h); }
    // crystals: a prism under every cup, bead swags between the low arms, a ring round the bowl and a ball at the bottom
    const prism = new T.OctahedronGeometry(.1, 0);
    cups.forEach(([x, y, z], i) => drops.push({ p: [x, y - .28, z], s: [1, 2.2, 1], r: [0, i, 0] }));
    for (let i = 0; i < 8; i++) {
      const a0 = i / 8 * Math.PI * 2, a1 = (i + 1) / 8 * Math.PI * 2, [x0, y0, z0] = cups[i], [x1, y1, z1] = cups[(i + 1) % 8];
      for (let j = 1; j < 10; j++) {
        const t = j / 10, sag = Math.sin(t * Math.PI) * .42, am = a0 + (a1 - a0) * t, r = 2.2 * (1 - Math.sin(t * Math.PI) * .12);
        drops.push({ p: [Math.sin(am) * r, y0 - .02 - sag, Math.cos(am) * r], s: .45, r: [j, 0, j] });
      }
    }
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; drops.push({ p: [Math.sin(a) * .5, 1.2, Math.cos(a) * .5], s: [.8, 2, .8], r: [0, a, 0] }); }
    g.add(k.instances(prism, crystal, drops));
    k.add(g, k.sphere(.26, { w: 12, h: 8 }), crystal, { p: [0, .48, 0], shadow: false });
    k.add(g, new T.OctahedronGeometry(.16, 0), crystal, { p: [0, .12, 0], s: [1, 1.8, 1] });
    g.userData.floating = true;
    g.userData.view = { el: 8, lift: -.2 };        // hung up near the ceiling
    g.userData.fullView = { lift: -.42 };
    return g;
  },

  // The grand piano: black lacquer, lid up on its stick, gold plate and strings inside, 88 keys, brass pedals.
  piano(k) {
    const g = k.group(), T = k.THREE;
    const lacquer = k.gloss('#0d0d10', { rough: .12, coatRough: .03 });
    const rimY0 = .64, rimY1 = .98, W2 = .75;
    // the case outline seen from above, as (x, back) — back runs from the keyboard (0) to the tail
    const bent = new T.SplineCurve([[-.745, 1.42], [-.73, 1.72], [-.63, 1.93], [-.45, 2.06], [-.22, 2.09], [-.03, 1.99], [.11, 1.79], [.21, 1.53], [.32, 1.23], [.47, .93], [.63, .65], [.72, .43], [W2, .22]].map(([x, z]) => new T.Vector2(x, z)));
    const outline = [[W2, 0], [-.745, 0], ...bent.getPoints(90).map(v => [v.x, v.y])];
    // an outline shrunk by d (the rim's wall)
    const shrink = (pts, d) => {
      const n = pts.length, out = [];
      let area = 0; for (let i = 0; i < n; i++) { const [a, b] = pts[i], [c, e] = pts[(i + 1) % n]; area += a * e - c * b; }
      const sg = area > 0 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const [px, pz] = pts[(i + n - 1) % n], [x, z] = pts[i], [nx2, nz2] = pts[(i + 1) % n];
        let ax = -(z - pz), az = x - px, bx = -(nz2 - z), bz = nx2 - x;
        const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1; ax /= la; az /= la; bx /= lb; bz /= lb;
        let mx = ax + bx, mz = az + bz; const lm = Math.hypot(mx, mz) || 1; mx /= lm; mz /= lm;
        const k2 = d / Math.max(.3, mx * ax + mz * az);
        out.push([x + mx * k2 * sg, z + mz * k2 * sg]);
      }
      return out;
    };
    // Plan shapes are drawn as (x, -back); turning them +90° about x lays them flat with the tail towards -z.
    const toShape = pts => { const s = new T.Shape(); pts.forEach(([x, z], i) => i ? s.lineTo(x, -z) : s.moveTo(x, -z)); s.closePath(); return s; };
    const toPath = pts => { const s = new T.Path(); pts.forEach(([x, z], i) => i ? s.lineTo(x, -z) : s.moveTo(x, -z)); s.closePath(); return s; };
    const plan = (geo, y) => { geo.rotateX(Math.PI / 2); geo.translate(0, y, 0); return geo; };
    const inner = shrink(outline, .045);
    const rim = plan(k.extrude(toShape(outline), rimY1 - rimY0 - .02, { holes: [toPath(inner)], bevel: .01, bevelSeg: 2, curve: 12 }), (rimY0 + rimY1) / 2);
    k.add(g, rim, lacquer);
    k.add(g, plan(k.extrude(toShape(outline), .03, { bevel: .005, bevelSeg: 1 }), rimY0 + .02), lacquer);
    // inside: maple rim lining, spruce soundboard, gold plate with its windows, strings, pins and dampers
    const lining = shrink(inner, .012);
    k.add(g, plan(k.extrude(toShape(inner), .16, { holes: [toPath(lining)], bevel: 0 }), rimY1 - .1), lacquer);
    k.add(g, plan(k.extrude(toShape(lining), .01, { bevel: 0 }), rimY1 - .17), k.wood('#e0bf86', { varnish: .5, repeat: 2 }));
    const plateOut = shrink(lining, .02);
    const plateShape = toShape(plateOut.map(([x, z]) => [x, Math.max(z, .07)]));
    const win = (cx, cz, rx, rz) => { const p = new T.Path(); p.absellipse(cx, -cz, rx, rz, 0, Math.PI * 2, false, 0); return p; };
    const wins = [win(-.42, 1.05, .16, .42), win(-.08, 1.25, .12, .36), win(.2, .82, .1, .22), win(-.5, .45, .09, .09), win(-.22, .45, .09, .09), win(.06, .45, .09, .09), win(.34, .45, .09, .09)];
    const gold = k.metal('#d99a28', .28, { emissive: k.color('#4a2a00'), emissiveIntensity: .3 });
    k.add(g, plan(k.extrude(plateShape, .014, { holes: wins, bevel: .006, bevelSeg: 1, curve: 24 }), rimY1 - .135), gold);
    // strings: back ends follow the case, bass strings cross over the rest
    const backAt = x => { let best = 0; for (const [px, pz] of inner) if (Math.abs(px - x) < .03 && pz > best) best = pz; return best; };
    const steel = k.metal('#eef0f4', .18), copper = k.metal('#c8844e', .3);
    const strs = [], bass = [];
    for (let i = 0; i < 64; i++) {
      const x = -.46 + i * .0165, z0 = .3, z1 = Math.max(.6, backAt(x) - .08), L = z1 - z0;
      strs.push({ p: [x, rimY1 - .11, -(z0 + L / 2)], s: [1, L, 1], r: [Math.PI / 2, 0, 0] });
    }
    for (let i = 0; i < 16; i++) {
      const x0 = -.69 + i * .016, z0 = .32, x1 = x0 + .34, z1 = 1.95 - i * .035, L = Math.hypot(x1 - x0, z1 - z0);
      bass.push({ p: [(x0 + x1) / 2, rimY1 - .095, -(z0 + z1) / 2], s: [1.6, L, 1.6], r: [Math.PI / 2, 0, -Math.atan2(x1 - x0, z1 - z0)], order: 'XYZ' });
    }
    const wire = k.cyl(.0022, .0022, 1, { seg: 5 });
    g.add(k.instances(wire, steel, strs));
    const bassMesh = k.instances(wire, copper, bass.map(b => ({ p: b.p, s: b.s, r: [Math.PI / 2, 0, 0] })));
    bass.forEach((b, i) => { const o = new T.Object3D(); o.position.set(...b.p); o.rotation.set(0, b.r[2], 0); o.rotateX(Math.PI / 2); o.scale.set(...b.s); o.updateMatrix(); bassMesh.setMatrixAt(i, o.matrix); });
    g.add(bassMesh);
    const pins = [], damp = [];
    for (let i = 0; i < 44; i++) for (let j = 0; j < 2; j++) pins.push({ p: [-.66 + i * .0305 + j * .012, rimY1 - .1, -(.14 + j * .05)] });
    g.add(k.instances(k.cyl(.005, .005, .04, { seg: 8 }), k.steel(), pins));
    for (let i = 0; i < 46; i++) damp.push({ p: [-.68 + i * .0285, rimY1 - .085, -.34] });
    g.add(k.instances(k.box(.02, .03, .05, .004), k.matte('#1a1a1c', .7), damp));
    // lid, hinged on the straight side and held up by the stick; its front flap folded back on top
    const lidOut = outline.filter(([, z]) => z >= .3);
    const lidPts = [[W2 - .003, .3], [-.745, .3], ...lidOut.filter(([x, z]) => !(z === 0))];
    const lidAng = k.deg(34);
    const lid = k.group([], { p: [-.745, rimY1 + .005, 0], r: [0, 0, lidAng] });
    const lidGeo = plan(k.extrude(toShape(lidPts.map(([x, z]) => [x + .745, z])), .02, { bevel: .006, bevelSeg: 2 }), .013);
    const lidMat = k.mat({ color: '#08080a', roughness: .3, clearcoat: .15, clearcoatRoughness: .2, specularIntensity: .35 });   // its underside, seen at a glancing angle
    k.add(lid, lidGeo, lidMat, { shadow: false });
    const rightAt = z => { let bx = W2, bd = 9; for (const [x, pz] of outline) if (x > 0 && Math.abs(pz - z) < bd) { bd = Math.abs(pz - z); bx = x; } return bx; };
    const flapPts = [[0, .3]]; for (let z = .3; z <= .601; z += .05) flapPts.push([rightAt(z) + .745 - .012, z]); flapPts.push([0, .6]);
    k.add(lid, plan(k.extrude(toShape(flapPts), .016, { bevel: .005, bevelSeg: 2 }), .036), lidMat, { shadow: false });
    g.add(lid);
    const cup = [.55, -.62], la = cup[0] + .745;
    const tip = [-.745 + Math.cos(lidAng) * la + Math.sin(lidAng) * .004, rimY1 + Math.sin(lidAng) * la - .004];
    const baseP = [.61, rimY1, -.62];
    k.add(g, k.tube([baseP, [tip[0], tip[1], -.62]], .011, { seg: 4, rs: 10, caps: true }), lacquer);
    // keyboard: 52 white keys and 36 black, between the cheek blocks, over the key slip
    const kw = 1.23 / 52, kx0 = -.615, whites = [], blacks = [];
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    for (let i = 0; i < 52; i++) {
      whites.push({ p: [kx0 + (i + .5) * kw, .714, .085] });
      if (i < 51 && 'ACDFG'.includes(names[i % 7])) blacks.push({ p: [kx0 + (i + 1) * kw, .729, .058] });
    }
    g.add(k.instances(k.box(kw - .0016, .022, .15, .003, 2), k.plastic('#fbf8f0', { rough: .3, coat: .6 }), whites));
    g.add(k.instances(k.box(.0125, .02, .092, .003, 2), k.gloss('#141416', { rough: .25 }), blacks));
    k.add(g, k.box(1.26, .05, .04, .01), lacquer, { p: [0, .685, .165] });                               // key slip
    k.add(g, k.box(1.5, .06, .24, .01), lacquer, { p: [0, rimY0 + .02, .07] });                           // key bed
    for (const sx of [-1, 1]) k.add(g, k.box(.12, .11, .25, .02), lacquer, { p: [sx * (.615 + .06), .72, .065] });   // cheeks
    k.add(g, k.box(1.23, .085, .03, .006), lacquer, { p: [0, .765, 0] });                                 // name board
    k.add(g, k.box(.18, .006, .002), k.metal('#e2c068', .3), { p: [0, .77, .016] });
    k.add(g, k.box(1.26, .02, .16, .006), lacquer, { p: [0, .8, -.07] });
    k.add(g, k.box(1.5, .06, .3, .01), lacquer, { p: [0, rimY1 - .03, -.15] });                           // front deck over the pins
    // music desk with a page of music
    const desk = k.group([], { p: [0, rimY1, -.2], r: [k.deg(-14), 0, 0] });
    k.add(desk, k.box(.86, .25, .02, .006), lacquer, { p: [0, .125, 0] });
    k.add(desk, k.box(.9, .02, .05, .006), lacquer, { p: [0, .01, .03] });
    const page = k.painted(256, 180, (c, w, h) => {
      c.fillStyle = '#f7f1e2'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a2622';
      for (let r = 0; r < 4; r++) for (let l = 0; l < 5; l++) c.fillRect(12, 22 + r * 40 + l * 4, w - 24, 1);
      for (let r = 0; r < 4; r++) for (let n = 0; n < 12; n++) { c.beginPath(); c.ellipse(24 + n * 19, 22 + r * 40 + ((n * 7 + r * 3) % 9) * 2, 3.4, 2.6, -.4, 0, 7); c.fill(); c.fillRect(27 + n * 19, 8 + r * 40 + ((n * 7 + r * 3) % 9) * 2, 1, 14); }
    });
    k.add(desk, k.plane(.27, .19), page, { p: [-.145, .135, .012], r: [0, .03, 0] });
    k.add(desk, k.plane(.27, .19), page, { p: [.14, .135, .012], r: [0, -.03, 0] });
    g.add(desk);
    // legs with brass casters, and the lyre with three pedals
    const brass = k.brass();
    for (const [x, z] of [[-.64, -.12], [.64, -.12], [-.36, -1.78]]) {
      k.add(g, k.lathe([[.034, 0], [.04, .02], [.036, .06], [.042, .4], [.052, .52], [.07, .56], [.07, rimY0 - .05], [0, rimY0 - .05]], { seg: 24 }), lacquer, { p: [x, .06, z] });
      k.add(g, k.cyl(.04, .036, .03, { seg: 20 }), brass, { p: [x, .06, z] });
      k.add(g, k.cyl(.03, .03, .025, { seg: 20 }), k.rubber('#1a1a1a'), { p: [x, .03, z + .01], r: [0, 0, Math.PI / 2] });
    }
    for (const sx of [-1, 1]) k.add(g, k.tube([[sx * .05, .12, -.24], [sx * .09, .35, -.24], [sx * .06, .5, -.24], [sx * .08, rimY0, -.24]], .016, { seg: 20, rs: 8 }), lacquer);
    k.add(g, k.box(.3, .08, .12, .02), lacquer, { p: [0, .1, -.24] });
    g.add(k.instances(k.box(.028, .012, .11, .005), brass, [-.075, 0, .075].map(x => ({ p: [x, .08, -.14] }))));
    for (const sx of [-1, 1]) k.add(g, k.tube([[sx * .1, .1, -.3], [sx * .16, rimY0, -.62]], .01, { seg: 4, rs: 6 }), lacquer);
    g.userData.view = { az: 40, el: 21 };
    return g;
  },

  // A 25-gallon tank: gravel, plants, rocks, six fish, the plastic diver and the snail nobody bought.
  aquarium(k) {
    const g = k.group(), T = k.THREE;
    const L = 4.8, D = 2.4, H = 4.0, y0 = .22, top = y0 + H;
    const trim = k.plastic('#1c1d21', { rough: .45, coat: .4 });
    k.add(g, k.box(L + .12, .24, D + .12, .05), trim, { p: [0, .12, 0], shadow: false });
    k.add(g, k.box(L + .12, .14, D + .12, .04), trim, { p: [0, top + .02, 0], shadow: false });
    k.add(g, k.box(L + .18, .34, D + .18, .1), trim, { p: [0, top + .26, 0], shadow: false });
    k.add(g, k.box(L - .2, .03, .02), k.glow('#bff3ff', 1.5), { p: [0, top + .1, D / 2 + .08], shadow: false });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.add(g, k.box(.05, H, .05), k.glass('#9fd8c8', { opacity: .45 }), { p: [sx * L / 2, y0 + H / 2, sz * D / 2], shadow: false });
    // backdrop sticker on the back glass
    const back = k.painted(512, 420, (c, w, h) => {
      let gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5fd0e6'); gr.addColorStop(.6, '#1f86b0'); gr.addColorStop(1, '#0d4f7a');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.save(); c.globalCompositeOperation = 'screen';
      for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(200,250,255,.12)'; const x = w * (.1 + i * .17); c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 40, 0); c.lineTo(x + 110, h); c.lineTo(x + 50, h); c.fill(); }
      c.restore();
      c.fillStyle = 'rgba(10,70,80,.55)';
      for (let i = 0; i < 16; i++) { const x = i * w / 15, hh = h * (.3 + (i * 37 % 11) / 30); c.beginPath(); c.moveTo(x - 12, h); c.quadraticCurveTo(x + 20 * Math.sin(i), h - hh * .6, x + 6, h - hh); c.quadraticCurveTo(x + 10, h - hh * .5, x + 12, h); c.fill(); }
      c.fillStyle = 'rgba(40,60,80,.6)'; c.beginPath(); c.ellipse(w * .7, h, w * .25, h * .18, 0, Math.PI, 0); c.fill();
    });
    k.add(g, k.plane(L - .06, H - .1), back, { p: [0, y0 + (H - .1) / 2, -D / 2 + .03], shadow: false });
    // gravel bed, sloping up to the back, with pebbles
    const slope = z => .42 + .22 * (-z / D + .5);
    const bed = warp(k, new T.BoxGeometry(L - .08, 1, D - .08, 10, 1, 6), v => { v.y = v.y > 0 ? slope(v.z) : 0; });
    const gravelTex = k.tex(256, 256, (c, w, h) => { c.fillStyle = '#b49a78'; c.fillRect(0, 0, w, h); const R = [...'abcdefgh'].map((_, i) => i); for (let i = 0; i < 1400; i++) { c.fillStyle = ['#8a7358', '#d9c7a6', '#6f6458', '#efe6d4', '#a0765a'][i % 5]; c.beginPath(); c.arc((i * 73.13) % w, (i * 41.7 + (i % 7) * 13) % h, 2 + (i % 3), 0, 7); c.fill(); } }, { repeat: [3, 2] });
    k.add(g, bed, k.mat({ map: gravelTex, roughness: .9 }), { p: [0, y0, 0] });
    const peb = [];
    for (let i = 0; i < 170; i++) {
      const x = k.range(-L / 2 + .15, L / 2 - .15), z = k.range(-D / 2 + .15, D / 2 - .1), s = k.range(.05, .1);
      peb.push({ p: [x, y0 + slope(z) - .01, z], s: [s * 1.3, s * .8, s], r: [0, k.range(0, 3), 0], color: k.pick(['#8a7358', '#d9c7a6', '#6f6458', '#efe6d4', '#a0765a', '#c9b08a']) });
    }
    g.add(k.instances(k.sphere(1, { w: 10, h: 6 }), k.plastic('#ffffff', { rough: .6, coat: .2 }), peb));
    // rocks
    const rock = (x, z, r, sq) => {
      const geo = warp(k, new T.IcosahedronGeometry(r, 1), v => { const n = 1 + .18 * Math.sin(v.x * 7.1 + v.z * 3.3) + .12 * Math.cos(v.y * 9.2 + v.x * 2); v.multiplyScalar(n); v.y *= sq; });
      k.add(g, geo, k.matte('#7c7a78', .8), { p: [x, y0 + slope(z) + r * sq * .45, z] });
    };
    rock(1.35, -.35, .55, .75); rock(1.85, .15, .32, .7); rock(-.9, -.6, .4, .8);
    // plants: tall ribbon grass in two clumps, a broad sword plant, a red stem plant
    const blades = (cx, cz, n, hgt, col) => {
      const parts = [];
      for (let i = 0; i < n; i++) {
        const a = k.range(0, Math.PI * 2), bend = k.range(-.5, .5), hh = hgt * k.range(.7, 1.05), bx = cx + Math.cos(a) * .12, bz = cz + Math.sin(a) * .12;
        const b = new T.PlaneGeometry(.09, 1, 1, 12); b.translate(0, .5, 0);
        warp(k, b, v => { const t = v.y; v.x += bend * t * t * .6; v.z += .15 * Math.sin(t * 4 + i); v.y = t * hh; v.x *= 1; }, false);
        b.rotateY(a); b.translate(bx, 0, bz); parts.push(b);
      }
      k.add(g, k.merge(parts), k.mat({ color: col, roughness: .5, side: T.DoubleSide, clearcoat: .3 }), { p: [0, y0 + slope(cz) - .05, 0] });
    };
    blades(-1.75, -.7, 11, 3.0, '#3f9e4a'); blades(.6, -.8, 9, 2.6, '#5cb85a'); blades(2.05, -.75, 8, 2.9, '#3f9e4a');
    const sword = [];
    for (let i = 0; i < 9; i++) {
      const lf = new T.PlaneGeometry(.3, 1.1, 1, 8); lf.translate(0, .55, 0);
      warp(k, lf, v => { const t = v.y / 1.1; v.x *= Math.sin(Math.min(1, t * 1.1) * Math.PI) * 1.2 + .1; v.z = -.35 * t * t; }, false);
      lf.rotateX(-.35); lf.rotateY(i / 9 * Math.PI * 2); sword.push(lf);
    }
    k.add(g, k.merge(sword), k.mat({ color: '#2f8a3c', roughness: .45, side: T.DoubleSide, clearcoat: .4 }), { p: [-.35, y0 + slope(-.2) - .03, -.2], s: [1, 1.1, 1] });
    const red = [];
    for (let s = 0; s < 3; s++) {
      const x = -.05 + s * .2, z = -.5 + (s % 2) * .12, hs = 1.3 + s * .25;
      k.add(g, k.cyl(.018, .018, hs, { seg: 6 }), k.plastic('#7a8a3a', { rough: .6 }), { p: [x, y0 + slope(z) + hs / 2, z] });
      for (let j = 0; j < 7; j++) for (const sg of [-1, 1]) red.push({ p: [x + sg * .1, y0 + slope(z) + .2 + j * hs / 7.5, z], s: [.13, .022, .06], r: [0, j * 1.3 + s, sg * .35], color: j > 3 ? '#e4553c' : '#c24a36' });
    }
    g.add(k.instances(k.sphere(1, { w: 12, h: 6 }), k.plastic('#ffffff', { rough: .5 }), red));
    // fish: [colour, fin colour, length, height, x, y, z, heading (deg), kind]
    const fishes = [['#ff8a1c', '#ffc34d', .7, .42, -1.15, 2.4, .35, 20, 'gold'], ['#ff7a12', '#ffd070', .6, .36, 1.1, 3.25, .1, 200, 'gold'],
      ['#6fd3ff', '#ff4d5e', .36, .12, .55, 1.9, .5, 170, 'tetra'], ['#6fd3ff', '#ff4d5e', .34, .11, .95, 2.05, .3, 165, 'tetra'], ['#6fd3ff', '#ff4d5e', .35, .12, .75, 1.75, .15, 175, 'tetra'],
      ['#e9eef2', '#e9eef2', .55, .7, -.2, 3.05, -.2, 30, 'angel']];
    const eyeMat = k.gloss('#101010'), shine = k.glow('#ffffff', 1.2);
    for (const [col, fin, len, hgt, x, y, z, head, kind] of fishes) {
      const f = k.group([], { p: [x, y0 + y, z], r: [0, k.deg(head), 0] });
      const bodyMat = kind === 'angel' ? k.painted(128, 64, (c, w, h) => { c.fillStyle = '#eef2f5'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a2a30'; for (const u of [.12, .2, .3, .38, .62, .7, .8, .88]) c.fillRect(u * w - w * .02, 0, w * .04, h); }, { rough: .3, coat: .6 }) : k.gloss(col);
      k.add(f, k.sphere(1, { w: 24, h: 16 }), bodyMat, { s: [len / 2, hgt / 2, kind === 'angel' ? .07 : hgt * .32] });
      const tail = kind === 'gold' ? k.shape([[0, 0], [-.5, .35], [-.38, 0], [-.5, -.35]]) : kind === 'angel' ? k.shape([[0, 0], [-.3, .25], [-.25, 0], [-.3, -.25]]) : k.shape([[0, 0], [-.35, .22], [-.26, 0], [-.35, -.22]]);
      const finMat = k.mat({ color: fin, roughness: .4, transparent: true, opacity: .85, side: T.DoubleSide });
      k.add(f, k.extrude(tail, .01, { bevel: .004, bevelSeg: 1 }), finMat, { p: [-len * .42, 0, 0], s: len / .7 * (kind === 'tetra' ? 1.2 : 1) });
      if (kind === 'tetra') k.add(f, k.capsule(.018, len * .6, 4), k.glow('#38b6ff', 1.6), { p: [len * .02, hgt * .1, hgt * .3], r: [0, 0, Math.PI / 2] });
      if (kind === 'tetra') k.add(f, k.sphere(1, { w: 16, h: 10 }), k.gloss('#ff3d4f'), { p: [-len * .15, -hgt * .15, 0], s: [len * .28, hgt * .28, hgt * .3] });
      if (kind === 'angel') { k.add(f, k.extrude(k.shape([[.1, 0], [-.3, .75], [-.25, 0]]), .01, { bevel: .004, bevelSeg: 1 }), finMat, { p: [0, hgt * .35, 0] }); k.add(f, k.extrude(k.shape([[.1, 0], [-.3, -.75], [-.25, 0]]), .01, { bevel: .004, bevelSeg: 1 }), finMat, { p: [0, -hgt * .35, 0] }); }
      if (kind === 'gold') k.add(f, k.extrude(k.shape([[.12, 0], [-.05, .2], [-.18, 0]]), .01, { bevel: .004, bevelSeg: 1 }), finMat, { p: [0, hgt * .42, 0], s: len / .7 });
      for (const sz of [-1, 1]) {
        k.add(f, k.sphere(1, { w: 12, h: 8 }), eyeMat, { p: [len * .3, hgt * .1, sz * hgt * (kind === 'angel' ? .08 : .24)], s: len * .06 + .01 });
        k.add(f, k.sphere(1, { w: 8, h: 6 }), shine, { p: [len * .32, hgt * .14, sz * (hgt * (kind === 'angel' ? .08 : .24) + .02)], s: .012 });
      }
      g.add(f);
    }
    // the plastic diver
    const dv = k.group([], { p: [-1.45, y0 + slope(.45) - .03, .45], r: [0, .5, 0], s: .9 });
    const suit = k.plastic('#b9c2cc', { rough: .5 }), brass = k.brass();
    for (const sx of [-1, 1]) {
      k.add(dv, k.box(.16, .1, .24, .04), k.plastic('#2c2e33'), { p: [sx * .1, .05, .03] });
      k.add(dv, k.capsule(.07, .3), suit, { p: [sx * .1, .3, 0] });
      k.add(dv, k.capsule(.06, .28), suit, { p: [sx * .26, .72, .05], r: [.4, 0, sx * .35] });
      k.add(dv, k.sphere(.06, { w: 12, h: 8 }), k.plastic('#2c2e33'), { p: [sx * .31, .56, .14] });
    }
    k.add(dv, k.capsule(.19, .28), suit, { p: [0, .72, 0] });
    k.add(dv, k.cyl(.26, .3, .1, { seg: 24 }), brass, { p: [0, .98, 0] });
    k.add(dv, k.sphere(.24, { w: 24, h: 16 }), brass, { p: [0, 1.2, 0] });
    k.add(dv, k.cyl(.12, .12, .06, { seg: 24 }), brass, { p: [0, 1.2, .22], r: [Math.PI / 2, 0, 0] });
    k.add(dv, k.disc(.1, 24), k.gloss('#1f3440'), { p: [0, 1.2, .252] });
    for (const sx of [-1, 1]) k.add(dv, k.cyl(.07, .07, .05, { seg: 20 }), brass, { p: [sx * .22, 1.2, .02], r: [0, 0, Math.PI / 2] });
    k.add(dv, k.tube([[0, 1.42, -.05], [0, 1.6, -.2], [.1, 1.75, -.45]], .025, { seg: 16, rs: 6 }), k.rubber('#3a3a3f'));
    g.add(dv);
    // the snail on a rock, and bubbles from an air stone
    const sn = k.group([], { p: [1.72, y0 + slope(.15) + .2, .3], r: [0, -.6, 0], s: .8 });
    k.add(sn, k.capsule(.07, .32), k.plastic('#e9d7b4', { rough: .5 }), { p: [0, .06, 0], r: [0, 0, Math.PI / 2] });
    const shell = [];
    for (let i = 0; i < 12; i++) { const a = i * .75, r = .16 * Math.exp(-i * .12); shell.push({ p: [Math.cos(a) * r * .9 - .02, .22 + Math.sin(a) * r * .9, 0], s: r * .9 + .02, color: i % 2 ? '#9a5a2a' : '#c77f3e' }); }
    sn.add(k.instances(k.sphere(1, { w: 16, h: 12 }), k.plastic('#ffffff', { rough: .35, coat: .5 }), shell));
    for (const sz of [-1, 1]) { k.add(sn, k.cyl(.012, .012, .14, { seg: 6 }), k.plastic('#e9d7b4'), { p: [.22, .14, sz * .03], r: [sz * .3, 0, -.5] }); k.add(sn, k.sphere(.022, { w: 8, h: 6 }), eyeMat, { p: [.26, .21, sz * .05] }); }
    g.add(sn);
    k.add(g, k.cyl(.12, .12, .1, { seg: 16 }), k.matte('#6c7f8a', .9), { p: [1.0, y0 + slope(-.85) + .02, -.85] });
    k.add(g, k.tube([[1.0, y0 + slope(-.85), -.88], [1.2, y0 + 1, -1.1], [1.25, top - .2, -1.12]], .02, { seg: 20, rs: 6 }), k.glass('#ddffee', { opacity: .5 }), { shadow: false });
    const bubbles = [];
    for (let i = 0; i < 14; i++) { const y = y0 + slope(-.85) + .2 + i * .24, r = .035 + (i % 3) * .015; bubbles.push({ p: [1.0 + Math.sin(i * 1.7) * .06, y, -.85 + Math.cos(i * 1.3) * .05], s: r }); }
    g.add(k.instances(k.sphere(1, { w: 12, h: 8 }), k.glass('#ffffff', { opacity: .55, env: 3 }), bubbles));
    // water, front glass with a glint and a stick-on thermometer
    k.add(g, k.box(L - .06, H - .42, D - .06), k.mat({ color: '#6fd0e2', transparent: true, opacity: .2, roughness: .08, clearcoat: 1, depthWrite: false }), { p: [0, y0 + (H - .42) / 2, 0], shadow: false });
    k.add(g, k.plane(L, H), k.glass('#ffffff', { opacity: .05 }), { p: [0, y0 + H / 2, D / 2], shadow: false });
    const glint = k.decal(L, H, (c, w, h) => { c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.moveTo(w * .62, 0); c.lineTo(w * .74, 0); c.lineTo(w * .56, h); c.lineTo(w * .44, h); c.fill(); }, { p: [0, y0 + H / 2, D / 2 + .005] });
    g.add(glint);
    const therm = k.decal(.22, 1.0, (c, w, h) => {
      c.fillStyle = '#1c1d21'; c.beginPath(); c.roundRect(0, 0, w, h, 16); c.fill();
      ['#3aa0ff', '#27c3a0', '#39d353', '#f2d02e', '#ff8a2a', '#ff4d4d'].forEach((col, i) => { c.fillStyle = col; c.fillRect(w * .25, h * (.1 + i * .13), w * .5, h * .1); });
      c.fillStyle = '#39d353'; c.beginPath(); c.arc(w * .5, h * .5, w * .2, 0, 7); c.fill();
    }, { px: 64, p: [L / 2 - .45, y0 + 2.4, D / 2 + .008] });
    g.add(therm);
    g.userData.view = { az: 22, el: 12 };
    return g;
  },

  // A thrift-store seascape: a sailboat and a lighthouse in oils, in a heavy gilt frame, with the price still taped on.
  painting(k) {
    const g = k.group(), T = k.THREE, p = k.group([], { r: [k.deg(-7), 0, 0] });
    g.add(p);
    const CW = 3.0, CH = 2.4, cy = 1.65;
    const gilt = k.metal('#e6b650', .26), antique = k.metal('#b98a33', .4), lip = k.metal('#d2a246', .3);
    // a frame ring: outer w × h, inner iw × ih, depth d with rounded bevel b
    const ring = (w, h, iw, ih, d, b, mat, z) => {
      const hole = new T.Path(); hole.moveTo(-iw / 2 - b, -ih / 2 - b); hole.lineTo(iw / 2 + b, -ih / 2 - b); hole.lineTo(iw / 2 + b, ih / 2 + b); hole.lineTo(-iw / 2 - b, ih / 2 + b); hole.closePath();
      k.add(p, k.extrude(k.roundRect(w - 2 * b, h - 2 * b, .02), d - 2 * b, { holes: [hole], bevel: b, bevelSeg: 5 }), mat, { p: [0, cy, z] });
    };
    ring(3.9, 3.3, 3.52, 2.92, .24, .06, antique, .02);
    ring(3.64, 3.04, 3.26, 2.66, .36, .08, gilt, .08);
    ring(3.3, 2.7, 3.0, 2.4, .18, .035, lip, -.01);
    // pearl beading round the outside, and carved ornaments at the corners and the middles
    const beads = [], bw = 3.77, bh = 3.17;
    for (let i = 0; i < 64; i++) { const x = -bw / 2 + (i + .5) * bw / 64; beads.push({ p: [x, cy + bh / 2, .15] }, { p: [x, cy - bh / 2, .15] }); }
    for (let i = 0; i < 54; i++) { const y = cy - bh / 2 + (i + .5) * bh / 54; beads.push({ p: [-bw / 2, y, .15] }, { p: [bw / 2, y, .15] }); }
    p.add(k.instances(k.sphere(.028, { w: 10, h: 8 }), gilt, beads));
    const petals = [];
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      k.add(p, k.torus(.13, .04, { rs: 10, ts: 32 }), gilt, { p: [sx * 1.7, cy + sy * 1.4, .27] });
      k.add(p, k.sphere(.075, { w: 16, h: 12 }), gilt, { p: [sx * 1.7, cy + sy * 1.4, .29] });
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; petals.push({ p: [sx * 1.7 + Math.cos(a) * .2, cy + sy * 1.4 + Math.sin(a) * .2, .26], s: [1, 1, .6] }); }
    }
    p.add(k.instances(k.sphere(.05, { w: 12, h: 8 }), gilt, petals));
    const shellShape = new T.Shape(); shellShape.moveTo(0, -.1); shellShape.absarc(0, -.1, .26, 0, Math.PI, false); shellShape.closePath();
    for (const sy of [-1, 1]) {
      k.add(p, k.extrude(shellShape, .04, { bevel: .03, bevelSeg: 3, curve: 16 }), gilt, { p: [0, cy + sy * 1.44, .27], r: [0, 0, sy < 0 ? Math.PI : 0], s: [1, .8, 1] });
      for (let i = 0; i < 5; i++) k.add(p, k.box(.018, .2, .03, .008), antique, { p: [Math.sin((i - 2) * .45) * .1, cy + sy * (1.44 + .06), .32], r: [0, 0, (i - 2) * -.45 * sy] });
    }
    // the painting
    const art = k.painted(1024, 820, (c, w, h) => {
      const hz = h * .56;
      let gr = c.createLinearGradient(0, 0, 0, hz); gr.addColorStop(0, '#6fa9d6'); gr.addColorStop(.6, '#b9d4e0'); gr.addColorStop(1, '#f3d9a8');
      c.fillStyle = gr; c.fillRect(0, 0, w, hz);
      const stroke = (x, y, len, wid, col, ang = 0) => { c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, len, wid, 0, 0, 7); c.fill(); c.restore(); };
      let s = 11; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 90; i++) { const cx = [.2, .55, .85][i % 3] * w + (R() - .5) * 240, cyy = [.16, .1, .22][i % 3] * h + (R() - .5) * 50; stroke(cx, cyy, 30 + R() * 50, 10 + R() * 14, `rgba(255,${240 + R() * 15 | 0},${225 + R() * 25 | 0},${.25 + R() * .35})`, (R() - .5) * .3); }
      // headland and lighthouse
      c.fillStyle = '#5a4a3c'; c.beginPath(); c.moveTo(w * .7, hz + 6); c.quadraticCurveTo(w * .78, hz - 70, w * .86, hz - 92); c.lineTo(w, hz - 110); c.lineTo(w, hz + 30); c.fill();
      c.fillStyle = '#6f8f4a'; c.beginPath(); c.moveTo(w * .8, hz - 80); c.quadraticCurveTo(w * .88, hz - 104, w, hz - 116); c.lineTo(w, hz - 100); c.quadraticCurveTo(w * .9, hz - 92, w * .8, hz - 76); c.fill();
      const lx = w * .9, ly = hz - 100;
      c.fillStyle = '#f4efe6'; c.beginPath(); c.moveTo(lx - 20, ly); c.lineTo(lx - 13, ly - 120); c.lineTo(lx + 13, ly - 120); c.lineTo(lx + 20, ly); c.fill();
      c.fillStyle = '#c8372d'; for (const t of [.25, .6]) c.fillRect(lx - 20 + t * 7, ly - 120 * t - 14, 40 - t * 14, 16);
      c.fillStyle = '#2c2c30'; c.fillRect(lx - 16, ly - 136, 32, 16); c.fillStyle = '#ffe9a0'; c.fillRect(lx - 11, ly - 133, 22, 10);
      c.fillStyle = '#c8372d'; c.beginPath(); c.moveTo(lx - 18, ly - 136); c.lineTo(lx, ly - 152); c.lineTo(lx + 18, ly - 136); c.fill();
      // sea
      gr = c.createLinearGradient(0, hz, 0, h); gr.addColorStop(0, '#4d93ad'); gr.addColorStop(.5, '#2c6d8a'); gr.addColorStop(1, '#1d4e66');
      c.fillStyle = gr; c.fillRect(0, hz, w, h - hz);
      for (let i = 0; i < 420; i++) { const y = hz + Math.pow(R(), 1.3) * (h - hz), sc = .3 + (y - hz) / (h - hz); stroke(R() * w, y, (8 + R() * 22) * sc * 1.6, (1.5 + R() * 2.5) * sc, R() < .35 ? `rgba(240,250,255,${.35 + R() * .4})` : `rgba(20,60,${90 + R() * 40 | 0},${.3 + R() * .3})`, (R() - .5) * .2); }
      c.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 40; i++) stroke(w * .72 + R() * w * .28, hz + 4 + R() * 26, 10 + R() * 22, 3 + R() * 3, 'rgba(255,255,255,.7)');
      // sailboat
      const bx = w * .36, by = hz + 70;
      c.fillStyle = 'rgba(30,50,70,.35)'; c.beginPath(); c.ellipse(bx + 10, by + 22, 110, 12, 0, 0, 7); c.fill();
      c.fillStyle = '#7a2f22'; c.beginPath(); c.moveTo(bx - 110, by - 8); c.lineTo(bx + 120, by - 8); c.quadraticCurveTo(bx + 90, by + 20, bx - 80, by + 18); c.closePath(); c.fill();
      c.fillStyle = '#f2e8d4'; c.fillRect(bx - 104, by - 10, 222, 5);
      c.fillStyle = '#4a3222'; c.fillRect(bx - 4, by - 250, 7, 244);
      gr = c.createLinearGradient(bx - 110, 0, bx, 0); gr.addColorStop(0, '#f8f2e4'); gr.addColorStop(1, '#dcd3c0');
      c.fillStyle = gr; c.beginPath(); c.moveTo(bx - 8, by - 240); c.quadraticCurveTo(bx - 70, by - 120, bx - 104, by - 22); c.lineTo(bx - 8, by - 22); c.fill();
      c.fillStyle = '#efe6d2'; c.beginPath(); c.moveTo(bx + 8, by - 232); c.quadraticCurveTo(bx + 70, by - 110, bx + 104, by - 24); c.lineTo(bx + 8, by - 24); c.fill();
      c.fillStyle = '#c8372d'; c.beginPath(); c.moveTo(bx, by - 250); c.lineTo(bx + 30, by - 242); c.lineTo(bx, by - 234); c.fill();
      c.strokeStyle = '#3a2a1e'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx, by - 250); c.lineTo(bx + 116, by - 12); c.stroke();
      // gulls, signature, then brush texture and canvas weave over everything
      c.strokeStyle = '#3b4652'; c.lineWidth = 3; for (const [x, y, sz] of [[.58, .2, 1], [.64, .26, .7], [.5, .3, .6]]) { c.beginPath(); c.moveTo(w * x - 14 * sz, h * y); c.quadraticCurveTo(w * x - 6 * sz, h * y - 10 * sz, w * x, h * y); c.quadraticCurveTo(w * x + 6 * sz, h * y - 10 * sz, w * x + 14 * sz, h * y); c.stroke(); }
      k.text(c, 'H. Varga', w * .1, h * .94, { size: 30, weight: 600, color: '#8a2a1e', font: 'Nunito, serif', align: 'left' });
      for (let i = 0; i < 900; i++) stroke(R() * w, R() * h, 6 + R() * 16, 1 + R() * 2, R() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)', (R() - .5) * .5);
      c.fillStyle = 'rgba(0,0,0,.05)'; for (let i = 0; i < w; i += 3) c.fillRect(i, 0, 1, h); for (let j = 0; j < h; j += 3) c.fillRect(0, j, w, 1);
    }, { rough: .5, coat: .35 });
    k.add(p, k.plane(CW + .02, CH + .02), art, { p: [0, cy, -.03] });
    k.add(p, k.box(3.7, 3.1, .08, .02), k.matte('#6b5236', .9), { p: [0, cy, -.12] });
    // the price, on a bit of masking tape
    const tape = k.decal(.62, .3, (c, w, h) => {
      c.fillStyle = '#efe2b8'; c.beginPath(); c.moveTo(4, 6); for (let x = 4; x < w; x += 10) c.lineTo(x, 4 + (x / 10 % 2) * 4); c.lineTo(w - 4, h - 6); for (let x = w - 4; x > 0; x -= 10) c.lineTo(x, h - 4 - (x / 10 % 2) * 4); c.fill();
      k.text(c, '$12', w / 2, h / 2 + 4, { size: 76, weight: 700, color: '#d0342c' });
    }, { px: 256, p: [1.05, cy - 1.43, .275], r: [0, 0, .12], s: 1.3 });
    p.add(tape);
    g.userData.view = { az: 14, el: 10 };
    return g;
  },
};
