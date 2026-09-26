// Models for the garage cards. Each entry: id => (k) => THREE.Object3D, built with the kit in ../../../kit.js.

// Placement for a unit-height y cylinder stretched from a to b: { p, r, s } plus its length L.
function span(k, a, b, r = 1) {
  const T = k.THREE, A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const e = new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()));
  const m = A.add(B).multiplyScalar(.5);
  return { p: [m.x, m.y, m.z], r: [e.x, e.y, e.z], s: [r, L, r], L };
}
// A round rod (tube, stay, spoke) between two points.
function rod(k, a, b, r, mat, seg = 20) {
  const t = span(k, a, b);
  return k.mesh(k.cyl(r, r, t.L, { seg }), mat, { p: t.p, r: t.r });
}
// A thin ribbon following a path in the xy plane, `width` wide along z. cut(t) trims the far end (t: 0–1 across) for a torn edge.
function ribbon(k, pts, width, cut = () => 0, nU = 90, nV = 28) {
  const T = k.THREE, curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], 0)));
  const L = curve.getLength(), pos = [], uv = [], idx = [];
  for (let j = 0; j <= nV; j++) {
    const t = j / nV, end = 1 - cut(t) / L;
    for (let i = 0; i <= nU; i++) {
      const u = (i / nU) * end, p = curve.getPointAt(u);
      pos.push(p.x, p.y, (t - .5) * width); uv.push(u * L, t);
    }
  }
  for (let j = 0; j < nV; j++) for (let i = 0; i < nU; i++) {
    const a = j * (nU + 1) + i, b = a + 1, c = a + nU + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

export default {
  // A flat-head screwdriver with a red handle and black rubber grip pads, lying on the bench.
  screwdriver(k) {
    const g = k.group(), T = k.THREE;
    const red = k.gloss('#e0302c'), pad = k.matte('#1c1d21', .9, { side: T.DoubleSide }), steel = k.metal('#e6eaf0', .12);
    const s = k.group();   // built standing on its butt, tip up (+y)
    s.add(k.mesh(k.lathe([[0, 0], [.17, 0], [.23, .03], [.25, .1], [.255, .3], [.26, .6], [.25, .9], [.232, 1.1], [.228, 1.22], [.238, 1.32], [.225, 1.42], [.17, 1.5], [.12, 1.55], [.1, 1.6], [0, 1.6]], { smooth: true, seg: 48 }), red));
    const padGeo = k.lathe([[.251, .14], [.266, .22], [.271, .4], [.274, .6], [.264, .9], [.243, 1.08], [.232, 1.14]], { smooth: true, seg: 14, len: k.deg(84) });
    for (const c of [270, 30, 150]) s.add(k.mesh(padGeo, pad, { r: [0, k.deg(c - 42), 0] }));
    s.add(k.mesh(k.torus(.215, .03), k.gloss('#ffd23a'), { p: [0, 1.36, 0], r: [Math.PI / 2, 0, 0] }));   // a yellow size ring
    s.add(k.mesh(k.lathe([[0, 1.56], [.108, 1.56], [.104, 1.64], [.075, 1.72], [0, 1.72]]), steel));        // bolster
    k.add(s, k.cyl(.062, .062, 1.72, { seg: 24 }), steel, { p: [0, 1.7 + .86, 0] });
    const blade = k.shape([[-.062, 0], [.062, 0], [.095, .14], [.097, .32], [-.097, .32], [-.095, .14]]);
    k.add(s, k.extrude(blade, .03, { bevel: .011 }), steel, { p: [0, 3.36, 0], r: [0, Math.PI / 2, 0] });
    // lay it down: tilted so the handle and the tip both touch, then turned to run across the picture
    g.add(k.group([k.group([s], { r: [0, 0, -Math.PI / 2 - .076] })], { r: [0, k.deg(58), 0] }));
    g.userData.view = { el: 38 };
    g.userData.fullView = { az: 6, el: 44 };
    return g;
  },

  // A roll of silver duct tape standing on edge, with a torn tail flopped out onto the bench.
  ducttape(k) {
    const g = k.group(), T = k.THREE;
    const R = 1, rc = .6, W = .78;
    const scrim = k.tex(128, 128, (c, w, h) => {
      c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(0,0,0,.09)'; c.lineWidth = 2;
      for (let i = 0; i < w; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); }
    }, { repeat: [24, 3] });
    const silver = k.mat({ color: '#c6cbd1', metalness: .72, roughness: .34, map: scrim, clearcoat: .4, clearcoatRoughness: .3 });
    const roll = k.group([], { p: [0, R, 0] });
    g.add(roll);
    roll.add(k.mesh(k.cyl(R, R, W, { open: true, seg: 96 }), silver, { r: [Math.PI / 2, 0, 0] }));
    const face = k.painted(512, 512, (c, w, h) => {
      c.fillStyle = '#9097a0'; c.fillRect(0, 0, w, h);
      for (let r = rc / R * 256 - 2; r < 256; r += 1.7) {
        c.strokeStyle = k.rand() < .5 ? `rgba(255,255,255,${.06 + k.rand() * .14})` : `rgba(20,24,30,${.05 + k.rand() * .12})`;
        c.lineWidth = 1.2; c.beginPath(); c.arc(w / 2, h / 2, r, 0, k.TAU); c.stroke();
      }
      const gr = c.createRadialGradient(w / 2, h / 2, 200, w / 2, h / 2, 256);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.35)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }, { rough: .42, metal: .45 });
    const card = k.painted(256, 256, (c, w, h) => {
      c.fillStyle = '#c7a17a'; c.fillRect(0, 0, w, h);
      for (let r = 100; r < 128; r += 3) { c.strokeStyle = 'rgba(90,55,20,.25)'; c.beginPath(); c.arc(w / 2, h / 2, r, 0, k.TAU); c.stroke(); }
    }, { rough: .9 });
    for (const s of [1, -1]) {
      roll.add(k.mesh(k.ring(rc, R - .004, 96), face, { p: [0, 0, s * W / 2], r: [0, s > 0 ? 0 : Math.PI, 0] }));
      roll.add(k.mesh(k.ring(rc - .06, rc + .004, 64), card, { p: [0, 0, s * (W / 2 + .004)], r: [0, s > 0 ? 0 : Math.PI, 0] }));
    }
    roll.add(k.mesh(k.cyl(rc - .06, rc - .06, W + .008, { open: true, seg: 64 }), k.matte('#b08d68', .9, { side: T.BackSide }), { r: [Math.PI / 2, 0, 0] }));
    // the tail: peels off the right side, drapes down and lies on the bench, torn across its end
    const R1 = R + .006, pts = [40, 26, 13, 0].map(a => [R1 * Math.cos(k.deg(a)), R + R1 * Math.sin(k.deg(a))]);
    pts.push([1.014, .72], [1.05, .42], [1.15, .17], [1.34, .035], [1.6, .012], [1.92, .016], [2.14, .05]);
    const tear = Array.from({ length: 29 }, (_, j) => (j % 2 ? k.range(.04, .08) : k.range(0, .018)));
    const tail = silver.clone(); tail.side = T.DoubleSide;
    g.add(k.mesh(ribbon(k, pts, W * .985, t => tear[Math.round(t * 28)]), tail));
    g.userData.view = { el: 18 };
    return g;
  },

  // One AA battery lying on its side: charcoal wrap, a lime + end, a little steel nub.
  battery(k) {
    const g = k.group();
    const L = 3.3, r = .5;
    const steel = k.metal('#dde1e6', .16);
    const b = k.group();   // standing, + end up
    b.add(k.mesh(k.lathe([[0, .01], [r - .07, .01], [r - .04, .03], [r - .03, .08], [r - .03, L - .08], [r - .05, L - .03], [.3, L - .02], [.22, L], [.2, L + .012], [.19, L + .03], [.19, L + .085], [.17, L + .11], [0, L + .11]]), steel));
    const wrap = k.painted(1024, 1024, (c, w, h) => {
      c.fillStyle = '#25272c'; c.fillRect(0, 0, w, h);
      const sh = c.createLinearGradient(0, 0, 0, h);
      sh.addColorStop(0, '#b4ec3a'); sh.addColorStop(1, '#8fd11f');
      c.fillStyle = sh; c.fillRect(0, 0, w, h * .3);
      c.fillStyle = '#e8ecef'; c.fillRect(0, h * .3, w, h * .014);
      c.fillStyle = '#e8ecef'; c.fillRect(0, h * .97, w, h * .01);
      const say = (str, y, size, color) => { c.save(); c.translate(w / 2, y); c.rotate(-Math.PI / 2); k.text(c, str, 0, 0, { size, color, weight: 700 }); c.restore(); };
      say('+', h * .15, 250, '#25272c');
      say('AA', h * .56, 230, '#ffffff');
      say('1.5V', h * .83, 110, '#b4ec3a');
      // a little lightning bolt between them
      c.save(); c.translate(w / 2, h * .355); c.rotate(-Math.PI / 2); c.fillStyle = '#b4ec3a';
      c.beginPath(); c.moveTo(-18, -70); c.lineTo(34, -70); c.lineTo(8, -8); c.lineTo(40, -8); c.lineTo(-26, 76); c.lineTo(-6, 12); c.lineTo(-38, 12); c.closePath(); c.fill(); c.restore();
    }, { rough: .22, coat: .8 });
    k.add(b, k.cyl(r, r, L - .16, { open: true, start: -Math.PI, len: k.TAU, seg: 72 }), wrap, { p: [0, L / 2, 0] });
    k.add(b, k.torus(r - .025, .036, { ts: 72 }), k.gloss('#25272c'), { p: [0, .08, 0], r: [Math.PI / 2, 0, 0] });
    k.add(b, k.torus(r - .025, .036, { ts: 72 }), k.gloss('#a6e22e'), { p: [0, L - .08, 0], r: [Math.PI / 2, 0, 0] });
    // turn the label up toward the camera, lay it down with + to the right, angle it a touch
    g.add(k.group([k.group([k.group([b], { r: [0, k.deg(-32), 0] })], { r: [0, 0, -Math.PI / 2] })], { r: [0, k.deg(6), 0] }));
    g.userData.view = { el: 30 };
    return g;
  },

  // A yellow tape measure with black rubber sides, its blade pulled out a little with the hook down on the bench.
  tapemeasure(k) {
    const g = k.group(), T = k.THREE;
    const yellow = k.gloss('#ffc414'), rubber = k.matte('#232428', .72), chrome = k.chrome(), black = k.plastic('#1b1c20', { rough: .45 });
    const D = 1.0, cy = 1.075;
    const outline = (sc = 1) => {   // the case's side profile, scaled about its middle
      const P = (x, y) => [x * sc, cy + (y - cy) * sc], s = new T.Shape();
      s.moveTo(...P(-.75, 0)); s.lineTo(...P(.95, 0)); s.quadraticCurveTo(...P(1.1, 0), ...P(1.1, .15)); s.lineTo(...P(1.1, 1.45));
      s.quadraticCurveTo(...P(1.1, 2.15), ...P(.4, 2.15)); s.lineTo(...P(-.3, 2.15)); s.quadraticCurveTo(...P(-1.1, 2.15), ...P(-1.1, 1.35));
      s.lineTo(...P(-1.1, .35)); s.quadraticCurveTo(...P(-1.1, 0), ...P(-.75, 0));
      return s;
    };
    const cs = k.group([], { p: [0, .14, 0] });
    g.add(cs);
    k.add(cs, k.extrude(outline(), D, { bevel: .14 }), yellow);
    const face = D / 2 + .14;
    const badge = k.painted(256, 256, (c, w, h) => {
      c.fillStyle = '#ffc414'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#1b1c20'; c.lineWidth = 7; c.beginPath(); c.arc(w / 2, h / 2, 112, 0, k.TAU); c.stroke();
      k.text(c, '25', w / 2, h * .44, { size: 92, color: '#1b1c20' });
      k.text(c, 'FT', w / 2, h * .74, { size: 44, color: '#1b1c20' });
    }, { rough: .25, coat: 1 });
    for (const s of [1, -1]) {
      const side = k.group([], { r: [0, s > 0 ? 0 : Math.PI, 0] });
      cs.add(side);
      k.add(side, k.extrude(outline(.8), .04, { bevel: .035 }), rubber, { p: [0, 0, face + .005] });
      k.add(side, k.rcyl(.5, .1, .04), yellow, { p: [0, cy, face + .05], r: [Math.PI / 2, 0, 0] });
      k.add(side, k.disc(.47), badge, { p: [0, cy, face + .152] });
      k.add(side, k.rcyl(.07, .04, .02, { seg: 20 }), chrome, { p: [-.28, cy + .28, face + .15], r: [Math.PI / 2, 0, 0] });
    }
    k.add(cs, k.box(.2, .52, .46, .08), black, { p: [1.25, 1.2, 0] });            // thumb lock
    k.add(cs, k.box(.12, .12, .66, .05), k.matte('#0d0d0f', .6), { p: [1.21, .07, 0] });   // the mouth
    // the blade: yellow steel with ticks, numbered from the hook
    const tape = k.painted(1024, 320, (c, w, h) => {
      c.fillStyle = '#ffd232'; c.fillRect(0, 0, w, h);
      const inch = 300;
      c.fillStyle = '#16161a';
      for (let i = 0; i * inch / 16 < w; i++) {
        const x = w - i * inch / 16, len = i % 16 === 0 ? .42 : i % 8 === 0 ? .3 : i % 4 === 0 ? .22 : i % 2 === 0 ? .16 : .1;
        c.fillRect(x - 2.5, 0, 5, h * len); c.fillRect(x - 2.5, h * (1 - len), 5, h * len);
        if (i && i % 16 === 0) k.text(c, String(i / 16), x - 46, h / 2, { size: 150, color: i / 16 === 2 ? '#d8261e' : '#16161a' });
      }
    }, { rough: .3, coat: .6 });
    const bladeMats = [yellow, yellow, tape, yellow, yellow, yellow];
    k.add(g, k.box(2.1, .018, .58), bladeMats, { p: [2.24, .12, 0] });
    const hook = k.metal('#d9dde2', .22);
    k.add(g, k.box(.035, .13, .64, .012), hook, { p: [3.3, .065, 0] });
    k.add(g, k.box(.16, .02, .54, .008), hook, { p: [3.23, .135, 0] });
    g.userData.view = { az: 24, el: 20 };
    return g;
  },

  // A blue aluminium flashlight, switched on, lying on the bench.
  flashlight(k) {
    const g = k.group(), T = k.THREE;
    const blue = k.mat({ color: '#2757d6', metalness: .7, roughness: .3, clearcoat: .7, clearcoatRoughness: .15 });
    const black = k.matte('#1d1e22', .85), chrome = k.chrome();
    const s = k.group();   // standing on its tail, lens up
    s.add(k.mesh(k.lathe([[0, 0], [.2, 0], [.27, .03], [.3, .08], [.3, .5], [.28, .54], [.28, 2.15], [.3, 2.2], [.33, 2.3], [.4, 2.55], [.44, 2.7], [.45, 2.75], [.45, 3.02], [.43, 3.05], [0, 3.05]]), blue));
    const knurlTex = k.tex(64, 64, (c, w, h) => {
      c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 3;
      for (const d of [1, -1]) for (let i = -w; i < w * 2; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + d * h, h); c.stroke(); }
    }, { repeat: [22, 11] });
    const knurl = blue.clone(); knurl.map = knurlTex;
    k.add(s, k.cyl(.287, .287, 1.1, { open: true, seg: 64 }), knurl, { p: [0, 1.25, 0] });
    for (const y of [.62, 1.88]) k.add(s, k.torus(.284, .018, { ts: 48 }), blue, { p: [0, y, 0], r: [Math.PI / 2, 0, 0] });
    k.add(s, k.torus(.29, .03, { ts: 48 }), black, { p: [0, .52, 0], r: [Math.PI / 2, 0, 0] });           // o-ring at the tail cap
    for (const [y, r] of [[2.4, .355], [2.48, .378], [2.56, .4]]) k.add(s, k.torus(r, .022, { ts: 48 }), blue, { p: [0, y, 0], r: [Math.PI / 2, 0, 0] });
    k.add(s, k.rcyl(.17, .1, .05, { seg: 32 }), black, { p: [0, .03, 0], r: [Math.PI, 0, 0] });           // tail switch
    k.add(s, k.rcyl(.11, .06, .04, { seg: 32 }), black, { p: [-.27, 1.98, 0], r: [0, 0, Math.PI / 2] });  // side button
    s.add(k.mesh(k.lathe([[.448, 2.98], [.472, 3.0], [.476, 3.1], [.458, 3.16], [.41, 3.17], [.39, 3.13]]), chrome));  // bezel
    const lens = k.painted(256, 256, (c, w, h) => {
      const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(.2, '#fffbe8'); gr.addColorStop(.62, '#ffeeb8'); gr.addColorStop(1, '#f4cf78');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let r = 34; r < 128; r += 15) { c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.beginPath(); c.arc(w / 2, h / 2, r, 0, k.TAU); c.stroke(); }
    }, { glow: 1.5 });
    k.add(s, k.disc(.395, 64), lens, { p: [0, 3.125, 0], r: [-Math.PI / 2, 0, 0] });
    // lay it down (head a touch higher, it's fatter), pointing right and a little toward us
    const lay = k.group([k.group([s], { r: [0, 0, -Math.PI / 2 + .061] })], { r: [0, k.deg(-15), 0] });
    g.add(lay);
    // a soft glow over the lens, turned to face the camera
    const view = { az: 30, el: 24 };
    lay.updateMatrixWorld(true);
    const at = s.localToWorld(new T.Vector3(0, 3.2, 0));
    const halo = k.mesh(k.plane(1.0, 1.0), new T.MeshBasicMaterial({ color: '#fff3c2', transparent: true, depthWrite: false, map: k.tex(128, 128, (c, w, h) => {
      const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(.3, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }) }), { p: [at.x, at.y, at.z], shadow: false });
    const az = k.deg(view.az), el = k.deg(view.el);
    halo.lookAt(at.x + Math.sin(az) * Math.cos(el), at.y + Math.sin(el), at.z + Math.cos(az) * Math.cos(el));
    g.add(halo);
    g.userData.view = view;
    return g;
  },

  // A claw hammer lying on its side: polished steel head, black fibreglass handle, orange rubber grip.
  hammer(k) {
    const g = k.group(), T = k.THREE;
    const steel = k.metal('#d9dee5', .14), shaftMat = k.gloss('#1e1f23'), grip = k.matte('#ff5b1e', .55), gripDark = k.matte('#1f2023', .8);
    const h = k.group();   // standing: handle along +y, head across the top, face to -x, claw to +x
    const oval = [1.2, 1, .95];
    k.add(h, k.lathe([[0, 0], [.19, .01], [.2, .1], [.2, 1.5], [.185, 2.3], [.17, 3.1], [.17, 3.95], [0, 3.95]], { seg: 40 }), shaftMat, { s: oval });
    k.add(h, k.lathe([[0, -.04], [.2, -.04], [.25, -.02], [.268, .06], [.266, .3], [.256, .9], [.25, 1.3], [.238, 1.5], [.214, 1.6], [.2, 1.63]], { smooth: true, seg: 40 }), grip, { s: oval });
    k.add(h, k.lathe([[0, -.06], [.2, -.06], [.255, -.03], [.272, .04], [.272, .1], [.26, .12]], { seg: 40 }), gripDark, { s: oval });   // end cap
    for (const y of [.55, .8, 1.05]) k.add(h, k.torus(.262, .018, { ts: 48 }), gripDark, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], s: [1.2, .95, 1] });
    const head = k.group([], { p: [0, 3.9, 0] });
    h.add(head);
    k.add(head, k.box(.46, .56, .34, .07), steel);                                                                        // eye block
    k.add(head, k.lathe([[0, 0], [.19, 0], [.17, .1], [.15, .25], [.17, .38], [.21, .47], [.222, .5], [.222, .58], [.2, .62], [0, .63]]), steel, { p: [-.2, 0, 0], r: [0, 0, Math.PI / 2] });
    const claw = new T.Shape();
    claw.moveTo(.1, .27); claw.bezierCurveTo(.45, .3, .8, .12, .93, -.4); claw.lineTo(.86, -.45);
    claw.bezierCurveTo(.7, -.12, .45, -.12, .1, -.16); claw.closePath();
    k.add(head, k.extrude(claw, .2, { bevel: .04 }), steel);
    // lay it on its side, handle running up and right across the picture
    g.add(k.group([k.group([h], { r: [-Math.PI / 2, 0, 0] })], { r: [0, k.deg(-26), 0] }));
    g.userData.view = { el: 50 };
    g.userData.fullView = { el: 40 };
    return g;
  },

  // A blue steel toolbox: hip-roof lid, carry handle, chrome latches, and a shallow drawer of mystery screws pulled open.
  toolbox(k) {
    const g = k.group(), T = k.THREE;
    const paint = k.gloss('#2158cf'), chrome = k.chrome(), black = k.plastic('#1b1c20', { rough: .4 }), dark = k.matte('#0e0f12', .7);
    const W = 3.8, H = 1.45, D = 1.6, F = D / 2;
    k.add(g, k.box(W, H, D, .07), paint, { p: [0, H / 2, 0] });
    const roof = k.shape([[-F, 0], [F, 0], [F - .32, .36], [-F + .32, .36]]);
    k.add(g, k.extrude(roof, W - .1, { bevel: .05 }), paint, { p: [0, H + .05, 0], r: [0, Math.PI / 2, 0] });
    k.add(g, k.box(W + .02, .05, D + .02, .02), k.matte('#1c3d86', .5), { p: [0, H + .005, 0] });     // shadow line under the lid
    // carry handle
    for (const x of [-.8, .8]) k.add(g, k.box(.2, .1, .34, .04), chrome, { p: [x, 1.92, 0] });
    k.add(g, k.tube([[-.8, 1.93, 0], [-.78, 2.12, 0], [-.66, 2.3, 0], [.66, 2.3, 0], [.78, 2.12, 0], [.8, 1.93, 0]], .045, { rs: 12 }), chrome);
    k.add(g, k.cyl(.09, .09, 1.1, { seg: 24 }), black, { p: [0, 2.3, 0], r: [0, 0, Math.PI / 2] });
    // latches and hasp
    for (const x of [-1.35, 1.35]) {
      k.add(g, k.box(.3, .44, .06, .03), chrome, { p: [x, H - .02, F + .07] });
      k.add(g, k.box(.18, .08, .1, .03), chrome, { p: [x, H - .16, F + .09] });
    }
    k.add(g, k.box(.2, .16, .05, .02), chrome, { p: [0, H - .04, F + .07] });
    k.add(g, k.torus(.07, .022), chrome, { p: [0, H - .12, F + .12], r: [Math.PI / 2, 0, 0] });
    // a little black name plate with a wrench on it
    const plate = k.painted(256, 96, (c, w, h) => {
      c.fillStyle = '#16171b'; c.fillRect(0, 0, w, h);
      c.save(); c.translate(w / 2, h / 2); c.rotate(-.5); c.fillStyle = '#e9edf2';
      c.fillRect(-58, -9, 100, 18); c.beginPath(); c.arc(52, 0, 24, 0, k.TAU); c.fill();
      c.globalCompositeOperation = 'destination-out'; c.fillRect(52, -9, 30, 18); c.restore();
    }, { rough: .3, coat: .8 });
    k.add(g, k.box(.74, .26, .04, .02), [chrome, chrome, chrome, chrome, plate, chrome], { p: [0, .98, F + .02] });
    // the drawer, pulled out, with loose screws and nuts in it
    const out = .62, dy0 = .16, dh = .3;
    k.add(g, k.box(3.3, dh + .04, .02), dark, { p: [0, dy0 + dh / 2, F + .004] });
    k.add(g, k.box(3.36, dh + .06, .07, .03), paint, { p: [0, dy0 + dh / 2, F + out] });
    k.add(g, k.box(1.0, .06, .06, .03), chrome, { p: [0, dy0 + dh / 2 + .03, F + out + .06] });
    const tray = k.metal('#9aa3ae', .35);
    for (const x of [-1.62, 1.62]) k.add(g, k.box(.035, dh - .06, out, .01), tray, { p: [x, dy0 + (dh - .06) / 2, F + out / 2] });
    k.add(g, k.box(3.28, .025, out, .01), tray, { p: [0, dy0 + .012, F + out / 2] });
    const screws = [], heads = [], nuts = [];
    for (let i = 0; i < 26; i++) {
      const x = k.range(-1.45, 1.45), z = F + k.range(.08, out - .1), a = k.range(0, k.TAU), y = dy0 + .045;
      if (k.rand() < .25) { nuts.push({ p: [x, y - .005, z], r: [0, a, 0] }); continue; }
      const dx = Math.cos(a) * .1, dz = Math.sin(a) * .1;
      screws.push({ p: [x, y, z], r: [0, -a, Math.PI / 2] });
      heads.push({ p: [x - dx * 1.2, y + .01, z - dz * 1.2], r: [0, -a, Math.PI / 2] });
    }
    g.add(k.instances(k.cyl(.02, .012, .22, { seg: 8 }), k.metal('#c9ced6', .3), screws));
    g.add(k.instances(k.cyl(.055, .055, .03, { seg: 16 }), k.metal('#d8b464', .3), heads));
    g.add(k.instances(k.cyl(.05, .05, .035, { seg: 6 }), k.metal('#c9ced6', .3), nuts));
    g.userData.view = { el: 24 };
    g.userData.fullView = { el: 20 };
    return g;
  },

  // A teal cordless drill standing on its battery pack, a twist bit in the chuck.
  drill(k) {
    const g = k.group(), T = k.THREE;
    const teal = k.gloss('#12a39a'), black = k.plastic('#202125', { rough: .5, coat: .25 }), rubber = k.matte('#26272b', .78);
    const chrome = k.chrome(), steel = k.metal('#d2d7dd', .18);
    // battery pack
    k.add(g, k.box(1.95, .52, 1.25, .12), black, { p: [-.4, .26, 0] });
    k.add(g, k.box(1.9, .24, 1.2, .09), teal, { p: [-.4, .58, 0] });
    for (let i = 0; i < 3; i++) k.add(g, k.cyl(.045, .045, .03, { seg: 16 }), k.glow('#3dff7a', 1.8), { p: [-.95 + i * .14, .3, .626], r: [Math.PI / 2, 0, 0] });
    const volts = k.decal(.5, .2, (c, w, h) => k.text(c, '20V', w / 2, h / 2 + 2, { size: 84, color: '#ffffff' }), { px: 256 });
    volts.position.set(-.1, .28, .63); g.add(volts);
    // handle: teal front, black rubber grip over the back
    k.add(g, k.extrude(k.shape([[-.72, .62], [.04, .62], [.14, 1.1], [.22, 1.6], [.36, 2.25], [-.44, 2.25], [-.54, 1.6], [-.64, 1.1]]), .5, { bevel: .15 }), teal);
    k.add(g, k.extrude(k.shape([[-.76, .64], [-.3, .64], [-.18, 1.2], [-.06, 1.75], [.04, 2.15], [-.46, 2.15], [-.56, 1.6], [-.66, 1.1]]), .56, { bevel: .15 }), rubber);
    k.add(g, k.box(.3, .44, .36, .12), black, { p: [.42, 1.88, 0], r: [0, 0, -.2] });                    // trigger
    k.add(g, k.cyl(.075, .075, 1.0, { seg: 20 }), black, { p: [.08, 2.2, 0], r: [Math.PI / 2, 0, 0] });  // forward / reverse
    // motor housing, lying along x
    const housing = k.lathe([[0, 0], [.28, .02], [.4, .1], [.47, .25], [.5, .45], [.5, 1.6], [.48, 2.1], [.44, 2.35], [.42, 2.45], [0, 2.45]]);
    k.add(g, housing, teal, { p: [-1.3, 2.62, 0], r: [0, 0, -Math.PI / 2], s: [1.05, 1, .86] });
    k.add(g, housing, black, { p: [-1.305, 2.62, 0], r: [0, 0, -Math.PI / 2], s: [1.06, .3, .87] });      // black rear cap
    for (let i = 0; i < 4; i++) k.add(g, k.box(.05, .34, .06, .02), k.matte('#0d0e10', .6), { p: [-.62 + i * .1, 2.64, .415] });   // vents
    // clutch collar with its numbers
    const clutch = k.painted(512, 64, (c, w, h) => {
      c.fillStyle = '#1f2024'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 24; i++) { c.fillStyle = '#e8ecef'; c.fillRect(i * w / 24 + 8, h * .3, 4, h * (i % 4 ? .3 : .5)); }
    }, { rough: .45 });
    k.add(g, k.cyl(.43, .45, .3, { seg: 48 }), clutch, { p: [1.3, 2.62, 0], r: [0, 0, -Math.PI / 2] });
    // chuck: ribbed black sleeve and a chrome nose
    k.add(g, k.lathe([[0, 0], [.36, 0], [.375, .05], [.375, .5], [.34, .56], [0, .56]]), black, { p: [1.45, 2.62, 0], r: [0, 0, -Math.PI / 2] });
    k.add(g, k.lathe([[0, .5], [.33, .5], [.3, .66], [.22, .78], [.12, .84], [0, .84]]), chrome, { p: [1.45, 2.62, 0], r: [0, 0, -Math.PI / 2] });
    g.add(k.instances(k.box(.4, .05, .06, .02), black, Array.from({ length: 16 }, (_, i) => {
      const a = i / 16 * k.TAU; return { p: [1.72, 2.62 + Math.cos(a) * .375, Math.sin(a) * .375], r: [a, 0, 0] };
    })));
    // the bit: a flat bar twisted into flutes, pointed at the end
    const bit = new T.BoxGeometry(1.1, .12, .045, 90, 1, 1), bp = bit.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i), a = x * 11, t = Math.min(1, Math.max(0, (.55 - x) / .12));
      const y = bp.getY(i) * (x > .43 ? t : 1), z = bp.getZ(i);
      bp.setXYZ(i, x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a));
    }
    bit.computeVertexNormals();
    k.add(g, bit, steel, { p: [2.9, 2.62, 0] });
    k.add(g, k.cyl(.06, .06, .3, { seg: 20 }), steel, { p: [2.35, 2.62, 0], r: [0, 0, Math.PI / 2] });
    g.userData.view = { az: 28, el: 14 };
    return g;
  },

  // An open gallon of paint: pink on the rim, drips down the label, a brush resting across the top.
  paintcan(k) {
    const g = k.group(), T = k.THREE;
    const tin = k.metal('#d0d5db', .2), pink = k.gloss('#ff4f8b', { rough: .1 }), navy = '#23305e';
    k.add(g, k.lathe([[0, 0], [.93, 0], [.99, .02], [1.03, .06], [1.03, .12], [1.0, .16], [1.0, 2.1], [1.03, 2.15], [1.04, 2.22], [1.02, 2.27], [.98, 2.28], [.95, 2.25], [.93, 2.17], [.9, 2.16], [.87, 2.2], [.86, 2.23], [.84, 2.23], [.83, 2.18], [.83, 2.0], [0, 2.0]]), tin);
    k.add(g, k.disc(.84, 64), pink, { p: [0, 2.08, 0], r: [-Math.PI / 2, 0, 0] });
    k.add(g, k.torus(.9, .036, { ts: 96 }), pink, { p: [0, 2.185, 0], r: [Math.PI / 2, 0, 0] });                       // paint in the lid well
    k.add(g, k.torus(1.02, .042, { arc: 1.5, ts: 48 }), pink, { p: [0, 2.24, 0], r: [Math.PI / 2, 0, k.deg(18)] });   // over the lip
    for (const [a, len] of [[26, .34], [52, .78], [75, .5], [96, .22]]) {
      const x = Math.cos(k.deg(a)) * 1.035, z = Math.sin(k.deg(a)) * 1.035;
      k.add(g, k.capsule(.042, len, 8), pink, { p: [x, 2.22 - len / 2, z] });
      k.add(g, k.sphere(.058, { w: 16, h: 12 }), pink, { p: [x * 1.004, 2.22 - len - .01, z * 1.004] });
    }
    // the label
    const label = k.painted(2048, 540, (c, w, h) => {
      c.fillStyle = '#f7f3ea'; c.fillRect(0, 0, w, h);
      c.fillStyle = navy; c.fillRect(0, 0, w, h * .2); c.fillRect(0, h * .83, w, h * .17);
      for (const cx of [w / 2, 0, w]) {
        k.text(c, 'PREMIUM', cx, h * .105, { size: 64, color: '#ffffff' });
        c.fillStyle = '#ff4f8b'; c.beginPath(); c.ellipse(cx, h * .49, 320, 105, -.04, 0, k.TAU); c.fill();
        for (const [dx, dl] of [[-200, 70], [-120, 40], [150, 60], [230, 30]]) { c.fillRect(cx + dx - 11, h * .55, 22, dl + 30); c.beginPath(); c.arc(cx + dx, h * .55 + dl + 30, 11, 0, k.TAU); c.fill(); }
        k.text(c, 'PAINT', cx, h * .49, { size: 160, color: '#ffffff', stroke: navy, strokeWidth: 12 });
        k.text(c, 'INTERIOR · SATIN', cx, h * .73, { size: 42, color: navy, weight: 600 });
        k.text(c, '1 GALLON', cx, h * .915, { size: 54, color: '#ffffff' });
      }
    }, { rough: .6 });
    k.add(g, k.cyl(1.006, 1.006, 1.65, { open: true, start: -Math.PI, len: k.TAU, seg: 96 }), label, { p: [0, 1.125, 0] });
    // ears and the wire bail, folded down behind
    for (const x of [-1.02, 1.02]) k.add(g, k.box(.08, .24, .26, .03), tin, { p: [x, 1.95, 0] });
    const u = [Math.cos(k.deg(115)), -Math.sin(k.deg(115))], bail = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12 * Math.PI; bail.push([1.08 * Math.cos(t), 1.95 + 1.3 * Math.sin(t) * u[0], 1.3 * Math.sin(t) * u[1]]); }
    k.add(g, k.tube(bail, .022, { rs: 8 }), tin);
    k.add(g, k.cyl(.065, .065, .5, { seg: 20 }), k.plastic('#1d1e22'), { p: [0, 1.95 + 1.3 * u[0], 1.3 * u[1]], r: [0, 0, Math.PI / 2] });
    // the brush: wood handle, steel ferrule, bristles dipped in pink
    const brush = k.group([], { p: [.3, 2.375, -.34] });
    const handle = new T.Shape();
    handle.moveTo(-.35, .21);
    handle.splineThru([k.v2(-.6, .135), k.v2(-.95, .16), k.v2(-1.35, .2), k.v2(-1.55, .14), k.v2(-1.6, 0), k.v2(-1.55, -.14), k.v2(-1.35, -.2), k.v2(-.95, -.16), k.v2(-.6, -.135), k.v2(-.35, -.21)]);
    handle.closePath();
    const hole = new T.Path(); hole.absarc(-1.4, 0, .05, 0, k.TAU, true);
    const wood = k.wood('#d99a5b', { varnish: .8 }); wood.map.repeat.set(.6, .6); wood.map.rotation = Math.PI / 2;
    k.add(brush, k.extrude(handle, .1, { bevel: .04, holes: [hole] }), wood, { r: [-Math.PI / 2, 0, 0] });
    k.add(brush, k.box(.42, .21, .82, .05), k.metal('#dfe3e8', .2), { p: [-.15, 0, 0] });
    for (const x of [-.26, -.06]) k.add(brush, k.box(.02, .215, .825, .01), k.metal('#8f959d', .35), { p: [x, 0, 0] });
    const bristles = (x0, x1, grow) => {   // a block that thins toward the tip (x = .85)
      const geo = new T.BoxGeometry(x1 - x0, .18, .78, 8, 1, 1), q = geo.attributes.position;
      for (let i = 0; i < q.count; i++) {
        const x = q.getX(i) + (x0 + x1) / 2, t = (x - .05) / .8;
        q.setXYZ(i, x, q.getY(i) * (1 - .55 * t) * grow, q.getZ(i) * (1 + .06 * t) * grow);
      }
      geo.computeVertexNormals(); return geo;
    };
    k.add(brush, bristles(.05, .85, 1), k.matte('#ecdcbc', .9));
    k.add(brush, bristles(.62, .87, 1.06), pink);
    g.add(k.group([brush], { r: [0, k.deg(-14), 0] }));
    g.userData.view = { el: 32 };
    g.userData.fullView = { el: 24 };
    return g;
  },

  // A red rolling mechanic's chest: a top chest on a roller cabinet, eleven drawers with chrome pulls, a push handle and casters.
  toolchest(k) {
    const g = k.group();
    const red = k.gloss('#d8262b'), chrome = k.chrome(), dark = k.matte('#141417', .6);
    const W = 3.0, D = 1.3, bz = D / 2;
    // casters: swivel plate, fork, wheel
    const cx = W / 2 - .22, cs = [[-cx, -.46], [cx, -.46], [-cx, .46], [cx, .46]];
    g.add(k.instances(k.box(.3, .04, .3, .015), chrome, cs.map(([x, z]) => ({ p: [x, .33, z] }))));
    g.add(k.instances(k.box(.2, .2, .2, .03), k.metal('#9aa0a8', .3), cs.map(([x, z]) => ({ p: [x, .22, z] }))));
    g.add(k.instances(k.cyl(.13, .13, .1, { seg: 28 }), k.rubber('#1b1b1e'), cs.map(([x, z]) => ({ p: [x, .13, z + .05], r: [0, 0, Math.PI / 2] }))));
    // roller cabinet and top chest
    k.add(g, k.box(W, 2.1, D, .06), red, { p: [0, .35 + 1.05, 0] });
    k.add(g, k.box(W - .02, .04, D - .04, .015), dark, { p: [0, 2.47, -.02] });
    const tz = -.05, tD = 1.2, tf = tz + tD / 2;
    k.add(g, k.box(W - .04, 1.24, tD, .06), red, { p: [0, 2.49 + .62, tz] });
    k.add(g, k.box(W, .17, tD + .06, .07), red, { p: [0, 3.73 + .085, tz] });           // lid
    k.add(g, k.box(.9, .07, .03, .02), chrome, { p: [0, 3.82, tf + .045] });           // lid badge strip
    k.add(g, k.cyl(.045, .045, .04, { seg: 20 }), chrome, { p: [W / 2 - .22, 3.82, tf + .04], r: [Math.PI / 2, 0, 0] });   // lock
    // drawers: dark recess behind, red fronts, full-width chrome pulls
    const fronts = [], pulls = [];
    const stack = (x0, x1, top, zf, rows) => {
      let y = top - .02;
      for (const row of rows) {
        const [h, n] = Array.isArray(row) ? row : [row, 1];
        for (let i = 0; i < n; i++) {
          const w = (x1 - x0 - .03 * (n - 1)) / n, cx = x0 + w / 2 + i * (w + .03);
          fronts.push({ cx, cy: y - h / 2, w, h, z: zf });
          pulls.push({ p: [cx, y - .075, zf + .085], s: [w - .28, 1, 1] });
        }
        y -= h + .03;
      }
    };
    k.add(g, k.box(W - .18, 1.93, .02), dark, { p: [0, .41 + .965, bz + .005] });
    k.add(g, k.box(W - .2, 1.1, .02), dark, { p: [0, 2.55 + .55, tf + .005] });
    stack(-W / 2 + .1, W / 2 - .1, 2.34, bz + .035, [.28, .28, .3, .42, .48]);
    stack(-W / 2 + .11, W / 2 - .11, 3.65, tf + .035, [[.2, 2], .17, .17, .18, .2]);
    for (const f of fronts) k.add(g, k.box(f.w, f.h, .06, .02), red, { p: [f.cx, f.cy, f.z] });
    g.add(k.instances(k.box(1, .06, .07, .025), chrome, pulls));
    // a label on one drawer
    const lab = k.decal(.62, .13, (c, w, h) => { c.fillStyle = '#f4f1e8'; c.fillRect(0, 0, w, h); k.text(c, 'SOCKETS', w / 2, h / 2 + 3, { size: 52, color: '#1d1d20', weight: 700 }); }, { px: 320 });
    const f2 = fronts[8]; lab.position.set(f2.cx - .82, f2.cy - .035, f2.z + .031); g.add(lab);
    // push handle on the right side, small handles on the top chest
    k.add(g, k.tube([[W / 2 - .02, 2.2, -.46], [W / 2 + .1, 2.2, -.44], [W / 2 + .17, 2.2, -.34], [W / 2 + .17, 2.2, .34], [W / 2 + .1, 2.2, .44], [W / 2 - .02, 2.2, .46]], .045, { rs: 12 }), chrome);
    for (const s of [-1, 1]) {
      k.add(g, k.box(.06, .07, .5, .025), chrome, { p: [s * (W / 2 + .03), 3.3, tz] });
      for (const z of [-.22, .22]) k.add(g, k.box(.06, .07, .06, .02), chrome, { p: [s * (W / 2 + .005), 3.3, tz + z] });
    }
    g.userData.view = { el: 14 };
    return g;
  },

  // A solid-body electric guitar in a blue burst, lying on its back, neck up and to the right.
  guitar(k) {
    const g = k.group(), T = k.THREE;
    const gt = k.group();   // built face up (+z), neck toward +y; units are inches
    const chrome = k.chrome(), pearl = k.gloss('#f6f3ec'), black = k.plastic('#16171a', { rough: .35 });
    // body outline: offset double cutaway
    const body = new T.Shape();
    body.moveTo(1.15, 12.2);
    body.splineThru([[1.8, 12.6], [2.6, 13.9], [3.4, 14.6], [4.3, 14.2], [4.8, 12.8], [4.6, 11.2], [4.3, 9.8], [4.8, 8.4], [6.0, 6.8], [6.35, 4.8], [5.9, 2.4], [4.4, .7], [2.2, .05], [0, -.1],
      [-2.2, .05], [-4.4, .7], [-5.9, 2.4], [-6.35, 4.8], [-6.0, 7.0], [-4.9, 8.6], [-4.5, 10.0], [-4.9, 11.6], [-5.3, 13.4], [-5.1, 15.4], [-4.4, 16.4], [-3.5, 16.2], [-2.8, 15.2], [-2.1, 13.6], [-1.6, 12.6], [-1.15, 12.2]].map(([x, y]) => k.v2(x, y)));
    body.closePath();
    const burst = k.painted(512, 656, (c, w, h) => {
      c.save(); c.translate(w * .5, h * .63); c.scale(1, 1.25);
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, w * .5);
      gr.addColorStop(0, '#9af3ff'); gr.addColorStop(.3, '#3fb6f6'); gr.addColorStop(.62, '#2f58da'); gr.addColorStop(.86, '#35208f'); gr.addColorStop(1, '#170d3d');
      c.fillStyle = gr; c.fillRect(-w, -h, w * 2, h * 2); c.restore();
    }, { rough: .15, coat: 1 });
    burst.map.repeat.set(1 / 13.6, 1 / 17.4); burst.map.offset.set(.5, .4 / 17.4);
    const edge = k.gloss('#1b1250');
    const zf = .875;   // the body's top face
    k.add(gt, k.extrude(body, 1.15, { bevel: .3, bevelSeg: 4 }), [burst, edge]);
    // pickguard
    const guard = new T.Shape();
    guard.moveTo(-1.15, 12.3);
    guard.splineThru([[-1.9, 12.75], [-2.7, 12.6], [-3.6, 11.4], [-3.9, 9.5], [-3.6, 7.8], [-3.3, 6.2], [-2.4, 4.8], [-.4, 4.2], [1.6, 3.7], [3.4, 2.8], [4.6, 3.2], [5.0, 4.6], [4.4, 6.4], [3.6, 8.2], [3.1, 10.0], [2.4, 11.7], [1.15, 12.3]].map(([x, y]) => k.v2(x, y)));
    guard.closePath();
    k.add(gt, k.extrude(guard, .04, { bevel: .025 }), pearl, { p: [0, 0, zf + .045] });
    // humbuckers with pole pieces, in cream rings
    const poles = [];
    for (const y of [9.2, 5.1]) {
      k.add(gt, k.box(3.2, 1.8, .14, .25), k.gloss('#efe4c8'), { p: [0, y, zf + .12] });
      k.add(gt, k.box(2.75, 1.4, .3, .14), black, { p: [0, y, zf + .2] });
      for (const dy of [-.33, .33]) for (let i = 0; i < 6; i++) poles.push({ p: [-1.0 + i * .4, y + dy, zf + .35], r: [Math.PI / 2, 0, 0] });
    }
    gt.add(k.instances(k.cyl(.09, .09, .04, { seg: 12 }), chrome, poles));
    // bridge and saddles
    k.add(gt, k.box(2.7, 1.0, .12, .05), chrome, { p: [0, 3.3, zf + .1] });
    gt.add(k.instances(k.box(.3, .42, .3, .06), chrome, Array.from({ length: 6 }, (_, i) => ({ p: [-1.05 + i * .42, 3.4, zf + .25] }))));
    k.add(gt, k.tube([[1.4, 3.0, zf + .2], [1.9, 2.7, zf + .55], [2.9, 1.6, zf + .62], [3.9, .7, zf + .62]], .07, { caps: true, rs: 10 }), chrome);   // whammy bar
    k.add(gt, k.capsule(.13, .4), pearl, { p: [3.95, .65, zf + .62], r: [0, 0, k.deg(48)] });
    // knobs, switch, jack
    for (const [x, y] of [[3.9, 4.3], [4.5, 5.9], [3.3, 2.6]]) k.add(gt, k.lathe([[0, 0], [.42, 0], [.42, .22], [.34, .38], [.18, .46], [0, .48]], { smooth: true, seg: 32 }), chrome, { p: [x, y, zf + .07], r: [Math.PI / 2, 0, 0] });
    k.add(gt, k.cyl(.22, .22, .06, { seg: 24 }), chrome, { p: [3.4, 11.5, zf + .1], r: [Math.PI / 2, 0, 0] });
    k.add(gt, k.tube([[3.4, 11.5, zf + .1], [3.5, 11.7, zf + .6]], .045, { rs: 8 }), chrome);
    k.add(gt, k.sphere(.13, { w: 16, h: 12 }), pearl, { p: [3.5, 11.72, zf + .65] });
    k.add(gt, k.cyl(.3, .3, .06, { seg: 24 }), chrome, { p: [5.0, 1.9, zf + .02], r: [Math.PI / 2, 0, 0] });
    // neck, fretboard, frets, dots, nut
    const nutY = 28.75, bridgeY = 3.3, scale = 25.5;
    const fbTop = zf + .38, wAt = y => 2.24 + (1.68 - 2.24) * (y - 10) / (nutY - 10);
    const maple = k.wood('maple', { varnish: .6 });
    k.add(gt, k.extrude(k.shape([[-1.1, 10.8], [1.1, 10.8], [.84, nutY], [-.84, nutY]]), .46, { bevel: .12 }), maple, { p: [0, 0, zf + .16 - .35] });
    k.add(gt, k.extrude(k.shape([[-wAt(10) / 2, 10], [wAt(10) / 2, 10], [.84, nutY], [-.84, nutY]]), .2, { bevel: .01 }), k.wood('#5a3322', { rough: .6 }), { p: [0, 0, fbTop - .11] });
    const fretY = n => nutY - scale * (1 - Math.pow(2, -n / 12));
    gt.add(k.instances(k.box(1, .07, .06, .02), k.metal('#dfe3e8', .18), Array.from({ length: 22 }, (_, i) => { const y = fretY(i + 1); return { p: [0, y, fbTop + .02], s: [wAt(y) - .04, 1, 1] }; })));
    const dots = [];
    for (const n of [3, 5, 7, 9, 12, 15, 17, 19, 21]) {
      const y = (fretY(n - 1) + fretY(n)) / 2;
      for (const x of n === 12 ? [-.42, .42] : [0]) dots.push({ p: [x, y, fbTop + .002], r: [Math.PI / 2, 0, 0] });
    }
    gt.add(k.instances(k.cyl(.13, .13, .02, { seg: 20 }), k.gloss('#f4efe6'), dots));
    k.add(gt, k.box(1.74, .14, .14, .03), k.gloss('#f2ecd8'), { p: [0, nutY + .07, fbTop + .05] });
    // headstock, painted to match, six tuners in a line on the bass side
    const head = new T.Shape();
    head.moveTo(.84, nutY);
    head.splineThru([[1.25, 30.0], [1.1, 31.2], [.6, 34.0], [.35, 35.4], [-.3, 36.1], [-.9, 36.0], [-1.25, 35.2], [-1.3, 32.5], [-1.15, 30.0], [-.84, nutY]].map(([x, y]) => k.v2(x, y)));
    head.closePath();
    k.add(gt, k.extrude(head, .39, { bevel: .08 }), [k.gloss('#2d55d4'), edge], { p: [0, 0, zf + .16 - .275] });
    const posts = [], keys = [], shafts = [];
    for (let j = 0; j < 6; j++) {
      const y = 30.2 + j * 1.0;
      posts.push({ p: [-.72, y, zf + .16 + .17], r: [Math.PI / 2, 0, 0] });
      shafts.push({ p: [-1.5, y, zf - .05], r: [0, 0, Math.PI / 2] });
      keys.push({ p: [-1.92, y, zf - .05] });
    }
    gt.add(k.instances(k.cyl(.12, .12, .34, { seg: 16 }), chrome, posts));
    gt.add(k.instances(k.cyl(.07, .07, .6, { seg: 12 }), chrome, shafts));
    gt.add(k.instances(k.box(.42, .5, .14, .07), chrome, keys));
    // strings: bridge to nut, then fanning out to the posts
    const strings = [];
    for (let i = 0; i < 6; i++) {
      const r = .026 - i * .0028, xb = -1.05 + i * .42, xn = -.7 + i * .28;
      strings.push(span(k, [xb, bridgeY + .1, zf + .43], [xn, nutY + .05, fbTop + .12], r));
      strings.push(span(k, [xn, nutY + .05, fbTop + .12], [-.72, 30.2 + i * 1.0, zf + .16 + .28], r));
    }
    gt.add(k.instances(k.cyl(1, 1, 1, { seg: 6 }), k.metal('#e8ebef', .2), strings));
    g.add(k.group([k.group([gt], { r: [-Math.PI / 2, 0, 0] })], { r: [0, k.deg(-25), 0] }));
    g.userData.view = { el: 55 };
    g.userData.fullView = { el: 45 };
    return g;
  },

  // A coral road bike in profile: spoked wheels, a diamond frame, drop bars, a leather saddle, chainring and chain.
  bicycle(k) {
    const g = k.group(), T = k.THREE;
    const paint = k.gloss('#ff5a45'), chrome = k.chrome(), alu = k.metal('#d3d8de', .25), tire = k.rubber('#1d1d20');
    const leather = k.matte('#8a4b25', .5), black = k.plastic('#1c1d21', { rough: .45 }), dark = k.metal('#4b4e55', .35);
    const P = (p, z = 0) => [p[0], p[1], z];
    const at = (p, d, t) => [p[0] + d[0] * t, p[1] + d[1] * t];
    const R = 3.4, rear = [-5, R], front = [5, R], BB = [-.75, 2.7];
    const sd = [-Math.cos(k.deg(73.5)), Math.sin(k.deg(73.5))];
    const STtop = at(BB, sd, 5.4), seatJ = at(BB, sd, 5.05), stayJ = at(BB, sd, 4.8), SPtop = at(BB, sd, 6.95);
    const hd = [-Math.cos(k.deg(72)), Math.sin(k.deg(72))], hp = [hd[1], -hd[0]];
    const A0 = [front[0] - .45 * hp[0], front[1] - .45 * hp[1]];
    const HB = at(A0, hd, 3.46), HT = at(A0, hd, 4.96), ttJ = at(A0, hd, 4.72), dtJ = at(A0, hd, 3.7);
    // frame
    g.add(rod(k, P(seatJ), P(ttJ), .17, paint), rod(k, P(BB), P(dtJ), .21, paint), rod(k, P(BB), P(STtop), .17, paint), rod(k, P(HB), P(HT), .21, paint));
    for (const s of [-1, 1]) {
      g.add(rod(k, P(BB, s * .2), P(rear, s * .34), .085, paint), rod(k, P(stayJ, s * .1), P(rear, s * .34), .075, paint));
      k.add(g, k.box(.42, .34, .06, .08), paint, { p: [rear[0] + .08, rear[1] + .04, s * .34] });            // dropouts
      k.add(g, k.tube([P(at(HB, hd, .05), s * .28), P(at(at(A0, hd, 2.1), hp, .08), s * .3), P(at(at(A0, hd, .9), hp, .3), s * .33), P(front, s * .34)], .09, { rs: 12 }), paint);   // fork blades
    }
    k.add(g, k.cyl(.24, .24, .72, { seg: 32 }), paint, { p: P(BB), r: [Math.PI / 2, 0, 0] });                   // bottom bracket shell
    for (const j of [seatJ, stayJ]) k.add(g, k.sphere(.175, { w: 20, h: 14 }), paint, { p: P(j) });
    const tilt = Math.atan2(hd[0], hd[1]);
    k.add(g, k.box(.4, .3, .78, .1), paint, { p: P(at(HB, hd, -.08)), r: [0, 0, -tilt] });                    // fork crown
    for (const t of [-.02, 1.52]) k.add(g, k.cyl(.22, .22, .1, { seg: 32 }), black, { p: P(at(HB, hd, t)), r: [0, 0, -tilt] });   // headset
    // cockpit: steerer, stem, drop bars with brown tape, hoods and levers
    const S1 = at(HT, hd, .32), stemEnd = [S1[0] + 1.0, S1[1] + .16];
    g.add(rod(k, P(HT), P(S1), .14, black), rod(k, P(at(HT, hd, .18)), P(stemEnd), .12, black));
    k.add(g, k.cyl(.1, .1, .9, { seg: 20 }), alu, { p: P(stemEnd), r: [Math.PI / 2, 0, 0] });
    const [bx, by] = stemEnd;
    for (const s of [-1, 1]) {
      k.add(g, k.tube([[bx, by, s * .4], [bx + .02, by, s * 1.3], [bx + .35, by - .02, s * 1.9], [bx + .75, by - .12, s * 2.05], [bx + .95, by - .47, s * 2.1], [bx + .85, by - .97, s * 2.1], [bx + .5, by - 1.22, s * 2.1], [bx + .02, by - 1.26, s * 2.1]], .1, { caps: true, rs: 12, seg: 80 }), leather);
      k.add(g, k.capsule(.13, .42, 8), black, { p: [bx + .78, by + .02, s * 2.08], r: [0, 0, k.deg(-62)] });
      k.add(g, k.tube([[bx + .98, by + .08, s * 2.08], [bx + 1.12, by - .3, s * 2.08], [bx + 1.05, by - .8, s * 2.08]], .045, { caps: true, rs: 8 }), alu);
    }
    // seatpost and saddle
    g.add(rod(k, P(STtop), P(SPtop), .13, alu));
    const seat = new T.Shape();
    seat.moveTo(1.35, 0);
    seat.splineThru([[1.2, .17], [.6, .21], [0, .33], [-.6, .6], [-1.1, .68], [-1.38, .5], [-1.44, 0], [-1.38, -.5], [-1.1, -.68], [-.6, -.6], [0, -.33], [.6, -.21], [1.2, -.17], [1.35, 0]].map(([x, y]) => k.v2(x, y)));
    k.add(g, k.extrude(seat, .14, { bevel: .12 }), leather, { p: [SPtop[0] + .1, SPtop[1] + .28, 0], r: [-Math.PI / 2, 0, k.deg(3)] });
    k.add(g, k.box(.5, .16, .3, .05), black, { p: [SPtop[0], SPtop[1] + .06, 0] });
    // wheels: tyre, rim, hub, 28 spokes each
    const spokes = [];
    for (const c of [rear, front]) {
      k.add(g, k.torus(3.25, .16, { rs: 16, ts: 128 }), tire, { p: P(c) });
      k.add(g, k.torus(2.99, .13, { rs: 12, ts: 96 }), alu, { p: P(c), s: [1, 1, .65] });
      k.add(g, k.lathe([[0, -.42], [.1, -.42], [.12, -.3], [.3, -.29], [.3, -.25], [.13, -.24], [.13, .24], [.3, .25], [.3, .29], [.12, .3], [.1, .42], [0, .42]], { seg: 24 }), alu, { p: P(c), r: [Math.PI / 2, 0, 0] });
      for (let i = 0; i < 28; i++) {
        const side = i % 2 ? 1 : -1, a = (i / 28) * k.TAU, b = a + (i % 4 < 2 ? .34 : -.34);
        spokes.push(span(k, [c[0] + Math.cos(a) * .27, c[1] + Math.sin(a) * .27, side * .27], [c[0] + Math.cos(b) * 2.88, c[1] + Math.sin(b) * 2.88, side * .03], .024));
      }
    }
    g.add(k.instances(k.cyl(1, 1, 1, { seg: 6 }), k.metal('#dfe3e8', .25), spokes));
    // drivetrain on the right (+z) side: chainring, cranks, pedals, cassette, derailleur, chain
    const zc = .5;
    const ring = k.circle(1.04); ring.holes.push(k.circle(.84));
    k.add(g, k.extrude(ring, .03, { bevel: .012 }), alu, { p: P(BB, zc) });
    g.add(k.instances(k.box(.07, .09, .05, .015), alu, Array.from({ length: 46 }, (_, i) => { const a = i / 46 * k.TAU; return { p: [BB[0] + Math.cos(a) * 1.08, BB[1] + Math.sin(a) * 1.08, zc], r: [0, 0, a - Math.PI / 2] }; })));
    g.add(k.instances(k.box(.72, .15, .06, .03), alu, Array.from({ length: 5 }, (_, i) => { const a = i / 5 * k.TAU + .3; return { p: [BB[0] + Math.cos(a) * .52, BB[1] + Math.sin(a) * .52, zc + .02], r: [0, 0, a] }; })));
    const ca = k.deg(-40);
    for (const [s, a] of [[1, ca], [-1, ca + Math.PI]]) {
      const tip = at(BB, [Math.cos(a), Math.sin(a)], 1.7), mid = at(BB, [Math.cos(a), Math.sin(a)], .85);
      k.add(g, k.box(1.95, .24, .1, .05), alu, { p: P(mid, s * (zc + .1)), r: [0, 0, a] });
      k.add(g, k.cyl(.05, .05, .5, { seg: 12 }), dark, { p: P(tip, s * (zc + .38)), r: [Math.PI / 2, 0, 0] });
      k.add(g, k.box(.55, .13, .8, .05), black, { p: P(tip, s * (zc + .75)) });
    }
    k.add(g, k.cyl(.2, .2, .08, { seg: 24 }), alu, { p: P(BB, zc + .14), r: [Math.PI / 2, 0, 0] });
    [.64, .58, .52, .47, .42].forEach((r, i) => k.add(g, k.cyl(r, r, .035, { seg: 40 }), alu, { p: P(rear, .2 + i * .065), r: [Math.PI / 2, 0, 0] }));
    const up = [rear[0] + .05, rear[1] - .72], lo = [rear[0] + .18, rear[1] - 1.28];
    k.add(g, k.box(.28, .5, .16, .06), dark, { p: [rear[0] + .02, rear[1] - .32, .56], r: [0, 0, .2] });
    k.add(g, k.box(.2, .78, .04, .08), dark, { p: [(up[0] + lo[0]) / 2, (up[1] + lo[1]) / 2, .6], r: [0, 0, .22] });
    for (const q of [up, lo]) k.add(g, k.cyl(.13, .13, .06, { seg: 20 }), black, { p: P(q, .56), r: [Math.PI / 2, 0, 0] });
    const r1 = 1.07, r2 = .43, cz = zc + .03;
    const arc = (c, r, a0, a1, n) => Array.from({ length: n }, (_, i) => { const a = k.deg(a0 + (a1 - a0) * i / (n - 1)); return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, cz]; });
    const chain = [...arc(BB, r1, 90, -80, 7), [-1.9, lo[1] + .2, cz], [-3.6, lo[1] + .02, cz], [lo[0] + .14, lo[1] - .1, cz], [lo[0] - .12, lo[1] + .08, cz], [up[0] + .14, up[1] - .05, cz], [up[0] - .12, up[1] + .2, cz], ...arc(rear, r2, 200, 90, 5), [-3.3, rear[1] + r2 - .03, cz], [-1.9, BB[1] + r1 + .02, cz]];
    k.add(g, k.tube(chain, .045, { closed: true, seg: 220, rs: 8 }), dark);
    // a water bottle on the down tube
    const dd = [dtJ[0] - BB[0], dtJ[1] - BB[1]], dl = Math.hypot(...dd), du = [dd[0] / dl, dd[1] / dl], dn = [-du[1], du[0]];
    const bot = k.group([], { p: P(at(at(BB, du, 1.55), dn, .44)), r: [0, 0, Math.atan2(-du[0], du[1])] });
    k.add(bot, k.lathe([[0, 0], [.3, 0], [.34, .08], [.34, .7], [.3, .95], [.34, 1.2], [.34, 1.75], [.26, 1.9], [0, 1.92]], { smooth: true, seg: 32 }), k.gloss('#f5f3ee'));
    k.add(bot, k.rcyl(.16, .22, .06, { seg: 24 }), black, { p: [0, 1.86, 0] });
    g.add(bot);
    g.add(rod(k, P(at(BB, du, 1.9)), P(at(at(BB, du, 1.9), dn, .2)), .05, dark), rod(k, P(at(BB, du, 2.9)), P(at(at(BB, du, 2.9), dn, .2)), .05, dark));
    g.userData.view = { az: 12, el: 8 };
    return g;
  },
};
