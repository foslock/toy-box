// Sail: everything on the water, built from simple shapes in flat toon colours: the boat and her crew, the whales and
// sharks, and the buoys, barrels, posts, rocks, palms and piers. One unit is one square of the chart; the boat's bow
// points down -z, so a heading of north needs no turn.
import * as THREE from 'three';

/* ---------- toon materials ---------- */
// Three bands of light, hard-edged: the cel-shaded look.
const ramp = (() => {
  const d = new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
})();
const mats = new Map();
export function toon(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (mats.has(key) && !o.unique) return mats.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...o.params });
  if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.glow ?? 1; }
  m.userData.outlineParameters = { thickness: o.line ?? .0042, color: [.12, .07, .04], alpha: 1, visible: o.line !== 0 };
  if (!o.unique) mats.set(key, m);
  return m;
}
export const noLine = m => { m.userData.outlineParameters = { visible: false }; return m; };
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };

/* ---------- little shapes ---------- */
function barrelGeo(r = .12, h = .3) {
  const pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8, y = (t - .5) * h; pts.push(new THREE.Vector2(r * (.82 + .18 * Math.sin(t * Math.PI)), y)); }
  pts.unshift(new THREE.Vector2(0, -h / 2)); pts.push(new THREE.Vector2(0, h / 2));
  return new THREE.LatheGeometry(pts, 14);
}
// a flag, a number or a word painted on a little canvas
export function labelTexture(draw, w = 128, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/* ---------- the boat ---------- */
// A stubby little sloop: red hull, a wooden deck, one mast and a white mainsail with a wren on it; a bow cannon, an
// anchor and a coil of line for the hook once the crew who work them have joined; red and green lamps on her port and
// starboard sides, like the Port and Starboard orders.
export function makeBoat(crewIn, opts = {}) {
  const boat = new THREE.Group(), body = new THREE.Group();
  boat.add(body);
  // hull: a teardrop outline, extruded down and pinched in at the keel
  const s = new THREE.Shape();
  s.moveTo(0, -.46);
  s.bezierCurveTo(.17, -.34, .25, -.1, .25, .12);
  s.bezierCurveTo(.25, .3, .18, .38, 0, .38);
  s.bezierCurveTo(-.18, .38, -.25, .3, -.25, .12);
  s.bezierCurveTo(-.25, -.1, -.17, -.34, 0, -.46);
  const hullGeo = new THREE.ExtrudeGeometry(s, { depth: .2, bevelEnabled: true, bevelSize: .04, bevelThickness: .05, bevelSegments: 3, curveSegments: 14 });
  hullGeo.rotateX(Math.PI / 2);   // extrude downward; the shape's y becomes -z... flip so the bow points to -z
  hullGeo.scale(1, 1, 1);
  const p = hullGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);                         // 0 at the deck down to -.25 at the keel
    const k = 1 - Math.max(0, -y - .02) * 1.6;   // narrower toward the keel
    p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * (.88 + .12 * k));
  }
  hullGeo.computeVertexNormals();
  const hull = mesh(hullGeo, toon('#d9463c'), 0, .2, 0);
  body.add(hull);
  // a cream band round her, just under the rail
  const outer = s.getPoints(48), band = new THREE.Shape(outer.map(v => new THREE.Vector2(v.x * 1.2, v.y * 1.1)));
  band.holes.push(new THREE.Path(outer.map(v => new THREE.Vector2(v.x * 1.08, v.y * 1.03))));
  const bandGeo = new THREE.ExtrudeGeometry(band, { depth: .04, bevelEnabled: false });
  bandGeo.rotateX(Math.PI / 2);
  body.add(mesh(bandGeo, toon('#f7f0dc', { line: 0 }), 0, .19, -.005));
  const deckGeo = new THREE.ShapeGeometry(s, 14); deckGeo.rotateX(-Math.PI / 2); deckGeo.rotateY(Math.PI); deckGeo.scale(.9, 1, .9);
  const deck = mesh(deckGeo, noLine(toon('#e2b877', { line: 0 })), 0, .215, -.02);
  body.add(deck);
  // mast, boom and the sail
  const wood = toon('#8a5a32'), dark = toon('#5a3a1e');
  const mastH = 1.15;
  const mast = mesh(new THREE.CylinderGeometry(.028, .036, mastH, 8), wood, 0, .2 + mastH / 2, -.06);
  body.add(mast);
  const boom = new THREE.Group(); boom.position.set(0, .4, -.06); body.add(boom);
  const boomRod = mesh(new THREE.CylinderGeometry(.022, .022, .52, 6), wood, 0, 0, .26); boomRod.rotation.x = Math.PI / 2; boom.add(boomRod);
  const flag = mesh(new THREE.PlaneGeometry(.2, .12), toon('#f5c542', { params: { side: THREE.DoubleSide }, line: 0 }), .1, 1.25, -.06);
  body.add(flag);
  // the sail: a triangle from the masthead to the end of the boom, bellied out; hoisting scales it up the mast
  const sailGeo = new THREE.BufferGeometry();
  const SX = 8, SY = 10, sv = [], su = [], si = [];
  for (let j = 0; j <= SY; j++) for (let i = 0; i <= SX; i++) {
    const v = j / SY, u = i / SX;          // v up the mast, u from the mast to the leech
    const reach = (1 - v * .92) * .56;     // nearly a triangle: the full boom at the foot, a little at the head
    sv.push(0, v * .86, u * reach); su.push(u * (1 - v * .6), v);
  }
  for (let j = 0; j < SY; j++) for (let i = 0; i < SX; i++) {
    const a = j * (SX + 1) + i, b = a + 1, c = a + SX + 1, d = c + 1;
    si.push(a, c, b, b, c, d);
  }
  sailGeo.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
  sailGeo.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2));
  sailGeo.setIndex(si);
  sailGeo.computeVertexNormals();
  const sailTex = labelTexture((g, w, h) => {
    g.fillStyle = '#fbf7ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e6dcc0'; for (let y = 20; y < h; y += 26) g.fillRect(0, y, w, 3);
    // a wren, in red, on the sail
    g.save(); g.translate(w * .34, h * .36); g.scale(1.1, 1.1); g.fillStyle = '#d9463c';
    g.beginPath(); g.ellipse(0, 0, 17, 12, -.2, 0, 7); g.fill();
    g.beginPath(); g.arc(14, -9, 8, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-12, -3); g.lineTo(-26, -20); g.lineTo(-10, -8); g.fill();
    g.beginPath(); g.moveTo(20, -10); g.lineTo(28, -8); g.lineTo(20, -6); g.fill();
    g.restore();
  }, 128, 128);
  const sail = mesh(sailGeo, toon('#ffffff', { params: { map: sailTex, side: THREE.DoubleSide }, unique: true }), 0, 0, 0);
  sail.userData.base = Float32Array.from(sv);
  const sailRig = new THREE.Group(); sailRig.position.set(0, .4, -.06); sailRig.add(sail); body.add(sailRig);
  // the boom and sail swing out to starboard, as if running before the wind, so the sail shows from any side
  sailRig.rotation.y = .55; boom.rotation.y = .55;
  // the furled sail: a bundle along the boom, shown when it's struck
  const furl = mesh(new THREE.CylinderGeometry(.055, .045, .5, 8), toon('#f3ecd8'), 0, .045, .26); furl.rotation.x = Math.PI / 2; boom.add(furl);
  // lamps: red to port (left), green to starboard (right)
  const lampR = mesh(new THREE.SphereGeometry(.045, 8, 6), toon('#ff4a3d', { emissive: '#ff2a1d', glow: .9 }), -.25, .27, -.02);
  const lampG = mesh(new THREE.SphereGeometry(.045, 8, 6), toon('#3dff6a', { emissive: '#1ddf4a', glow: .9 }), .25, .27, -.02);
  body.add(lampR, lampG);
  // bow cannon
  const cannon = new THREE.Group(); cannon.position.set(0, .29, -.34); body.add(cannon);
  const barrel = mesh(new THREE.CylinderGeometry(.045, .06, .26, 10), toon('#3a3f47'), 0, .02, -.08); barrel.rotation.x = Math.PI / 2 - .12; cannon.add(barrel);
  cannon.add(mesh(new THREE.BoxGeometry(.13, .06, .12), wood, 0, -.03, 0));
  // anchor, hung on the bow
  const anchor = new THREE.Group(); anchor.position.set(.2, .26, -.24); body.add(anchor);
  const iron = toon('#4b5560');
  anchor.add(mesh(new THREE.CylinderGeometry(.016, .016, .2, 6), iron));
  const fluke = mesh(new THREE.TorusGeometry(.07, .016, 6, 12, Math.PI), iron, 0, -.08, 0); fluke.rotation.z = Math.PI; anchor.add(fluke);
  anchor.add(mesh(new THREE.TorusGeometry(.028, .01, 6, 10), iron, 0, .11, 0));
  // a coil of line for the grappling hook
  const coil = mesh(new THREE.TorusGeometry(.07, .025, 6, 14), toon('#d8c08a'), -.12, .25, .14); coil.rotation.x = Math.PI / 2; body.add(coil);
  // the crew
  const crew = {};
  const at = { captain: [0, .215, .28], bosun: [.1, .215, .02], anchor: [.08, .215, -.24], gunner: [-.09, .215, -.2], hook: [-.13, .215, .12] };
  for (const who of Object.keys(at)) {
    const f = makeSailor(who);
    f.position.set(...at[who]);
    f.rotation.y = who === 'bosun' ? Math.PI / 2 : who === 'hook' ? .5 : 0;
    f.visible = crewIn.includes(who);
    body.add(f); crew[who] = f;
  }
  cannon.visible = crewIn.includes('gunner');
  anchor.visible = crewIn.includes('anchor');
  coil.visible = crewIn.includes('hook');
  // a soft shadow on the water
  const shadow = mesh(new THREE.CircleGeometry(.36, 20), noLine(new THREE.MeshBasicMaterial({ color: '#06233f', transparent: true, opacity: .28, depthWrite: false })), 0, .012, 0);
  shadow.rotation.x = -Math.PI / 2; shadow.scale.set(.85, 1.2, 1);
  boat.add(shadow);
  if (opts.brokenMast) {
    // snapped halfway up: the stump stands, the top lies across the deck with the sail bundled on it
    mast.scale.y = .42; mast.position.y = .2 + mastH * .21;
    flag.visible = false;
    const top = mesh(new THREE.CylinderGeometry(.024, .028, mastH * .55, 8), wood, -.05, .33, .08);
    top.rotation.set(1.35, 0, .5); body.add(top);
  }
  Object.assign(boat.userData, { body, sail, sailRig, furl, cannon, anchor, coil, crew, flag, boom, hull });
  return boat;
}

// A sailor: a round head on a stubby body, in their own colours and hat.
const SAILORS = {
  captain: { body: '#2d4f8a', skin: '#f2c49b', hat: '#2d4f8a', kind: 'tricorn' },
  bosun: { body: '#f4f1e6', skin: '#8d5a3b', hat: '#e0524a', kind: 'bandana', stripes: '#3f97d6' },
  anchor: { body: '#2f6f7e', skin: '#e8b48a', hat: '#2f6f7e', kind: 'beanie', big: 1.15 },
  gunner: { body: '#b8322a', skin: '#c68b5e', hat: '#f07f2a', kind: 'cap' },
  hook: { body: '#8a5cc2', skin: '#f5d0b0', hat: '#e8b73c', kind: 'hair' },
};
export function makeSailor(who) {
  const c = SAILORS[who], g = new THREE.Group(), k = c.big || 1;
  const bodyMesh = mesh(new THREE.CapsuleGeometry(.045 * k, .06 * k, 4, 8), toon(c.body), 0, .075 * k, 0);
  g.add(bodyMesh);
  if (c.stripes) { const band = mesh(new THREE.TorusGeometry(.047, .012, 5, 10), toon(c.stripes, { line: 0 }), 0, .08, 0); band.rotation.x = Math.PI / 2; g.add(band); }
  const head = mesh(new THREE.SphereGeometry(.052 * k, 10, 8), toon(c.skin), 0, .175 * k, 0);
  g.add(head);
  const eyeM = toon('#1a1010', { line: 0 });
  head.add(mesh(new THREE.SphereGeometry(.009, 5, 4), eyeM, -.018, .008, -.047), mesh(new THREE.SphereGeometry(.009, 5, 4), eyeM, .018, .008, -.047));
  const hatM = toon(c.hat);
  if (c.kind === 'tricorn') { const h = mesh(new THREE.ConeGeometry(.075, .06, 3), hatM, 0, .05, 0); h.rotation.y = Math.PI; head.add(h); }
  if (c.kind === 'bandana') head.add(mesh(new THREE.SphereGeometry(.055, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.2), hatM, 0, .005, 0));
  if (c.kind === 'beanie') head.add(mesh(new THREE.SphereGeometry(.056 * k, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hatM, 0, .01, 0), mesh(new THREE.SphereGeometry(.016, 6, 5), toon('#9fd8e0'), 0, .066, 0));
  if (c.kind === 'cap') { head.add(mesh(new THREE.SphereGeometry(.055, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), hatM, 0, .01, 0)); const b = mesh(new THREE.CylinderGeometry(.04, .04, .008, 10), hatM, 0, .02, -.05); head.add(b); }
  if (c.kind === 'hair') { head.add(mesh(new THREE.SphereGeometry(.056, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hatM, 0, .006, .004)); head.add(mesh(new THREE.SphereGeometry(.022, 6, 5), hatM, 0, -.03, .055)); }
  // arms: two little capsules, hinged at the shoulder, for pulling ropes and waving
  const armM = toon(c.body);
  const arms = [-1, 1].map(sd => {
    const pivot = new THREE.Group(); pivot.position.set(sd * .05 * k, .11 * k, 0);
    const a = mesh(new THREE.CapsuleGeometry(.014, .05, 3, 6), armM, 0, -.035, 0); pivot.add(a);
    pivot.rotation.z = sd * .35;
    g.add(pivot); return pivot;
  });
  g.userData = { head, arms, body: bodyMesh };
  return g;
}

/* ---------- creatures ---------- */
export function makeWhale() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const blue = toon('#3d6fae'), belly = toon('#d9e6ef');
  const b = mesh(new THREE.SphereGeometry(.34, 18, 12), blue, 0, 0, 0); b.scale.set(.95, .62, 1.5); body.add(b);
  const bl = mesh(new THREE.SphereGeometry(.34, 16, 10), belly, 0, -.06, -.06); bl.scale.set(.8, .5, 1.25); body.add(bl);
  const tail = new THREE.Group(); tail.position.set(0, .05, .5); body.add(tail);
  const stalk = mesh(new THREE.ConeGeometry(.12, .34, 10), blue, 0, 0, .12); stalk.rotation.x = Math.PI / 2; tail.add(stalk);
  const fl = new THREE.Shape(); fl.moveTo(0, 0); fl.bezierCurveTo(.12, .05, .26, .16, .3, .1); fl.bezierCurveTo(.2, .02, .1, -.02, 0, -.02); fl.bezierCurveTo(-.1, -.02, -.2, .02, -.3, .1); fl.bezierCurveTo(-.26, .16, -.12, .05, 0, 0);
  const flukes = mesh(new THREE.ExtrudeGeometry(fl, { depth: .03, bevelEnabled: false }), blue, 0, 0, .3); flukes.rotation.x = -Math.PI / 2; tail.add(flukes);
  const eyeW = toon('#ffffff'), eyeB = toon('#10141c', { line: 0 });
  for (const sd of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(.05, 8, 6), eyeW, sd * .27, .03, -.28); body.add(e);
    e.add(mesh(new THREE.SphereGeometry(.028, 6, 5), eyeB, sd * .025, 0, -.02));
    const fin = mesh(new THREE.SphereGeometry(.1, 8, 6), blue, sd * .33, -.1, -.05); fin.scale.set(.35, .15, 1); fin.rotation.y = sd * .5; body.add(fin);
  }
  // pale grooves along the throat, and a blowhole
  body.add(mesh(new THREE.SphereGeometry(.03, 6, 5), toon('#1f3f6a', { line: 0 }), 0, .21, -.2));
  g.userData = { body, tail, spoutAt: new THREE.Vector3(0, .25, -.2), kind: 'whale', size: .9 };
  return g;
}
export function makeShark() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const grey = toon('#8d9aa8'), pale = toon('#e8edf2');
  // most of it under the water: a dark shape, then its back, fin and tail cutting the surface
  const under = mesh(new THREE.SphereGeometry(.3, 14, 8), noLine(new THREE.MeshBasicMaterial({ color: '#06203a', transparent: true, opacity: .55, depthWrite: false })), 0, .01, 0);
  under.scale.set(.75, .05, 1.7); under.renderOrder = 1;
  g.add(under);
  const top = mesh(new THREE.SphereGeometry(.3, 14, 8), grey, 0, -.06, 0); top.scale.set(.62, .42, 1.45); body.add(top);
  const fin = new THREE.Shape(); fin.moveTo(-.2, 0); fin.quadraticCurveTo(-.03, .14, .03, .48); fin.quadraticCurveTo(.1, .16, .22, 0); fin.lineTo(-.2, 0);
  const finM = mesh(new THREE.ExtrudeGeometry(fin, { depth: .05, bevelEnabled: true, bevelSize: .018, bevelThickness: .014, bevelSegments: 2 }), grey, -.025, .04, .02);
  finM.rotation.y = Math.PI / 2; body.add(finM);
  const tail = new THREE.Group(); tail.position.set(0, 0, .4); body.add(tail);
  const tf = new THREE.Shape(); tf.moveTo(0, 0); tf.quadraticCurveTo(.05, .12, .02, .24); tf.quadraticCurveTo(.1, .1, .18, .02); tf.lineTo(0, 0);
  const tailFin = mesh(new THREE.ExtrudeGeometry(tf, { depth: .03, bevelEnabled: false }), grey, 0, -.02, 0); tailFin.rotation.y = Math.PI / 2; tail.add(tailFin);
  body.add(mesh(new THREE.SphereGeometry(.2, 10, 6), pale, 0, -.2, -.1));
  // a white tip to the fin, and eyes
  const tip = mesh(new THREE.SphereGeometry(.035, 6, 5), pale, 0, .5, .03); body.add(tip);
  for (const sd of [-1, 1]) body.add(mesh(new THREE.SphereGeometry(.03, 6, 5), toon('#10141c', { line: 0 }), sd * .15, .02, -.3));
  g.userData = { body, tail, under, kind: 'shark', size: .8 };
  return g;
}

/* ---------- things on the chart ---------- */
export function makeBuoy(n, last) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const red = toon('#e0524a'), white = toon('#fbf7ea');
  const base = mesh(new THREE.CylinderGeometry(.16, .2, .18, 14), red, 0, .06, 0); body.add(base);
  body.add(mesh(new THREE.CylinderGeometry(.12, .16, .12, 14), white, 0, .2, 0));
  body.add(mesh(new THREE.ConeGeometry(.12, .2, 14), red, 0, .36, 0));
  body.add(mesh(new THREE.CylinderGeometry(.012, .012, .42, 5), toon('#5a3a1e'), 0, .62, 0));
  const flagTex = labelTexture((c, w, h) => {
    c.fillStyle = '#f5c542'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#2a1a10'; c.font = '700 84px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(n), w / 2, h / 2 + 6);
  }, 96, 80);
  const flag = mesh(new THREE.PlaneGeometry(.26, .2), toon('#ffffff', { params: { map: flagTex, side: THREE.DoubleSide }, unique: true }), .14, .74, 0);
  body.add(flag);
  g.userData = { body, flag, flagMat: flag.material, n };
  return g;
}
export function makeBarrels(seed) {
  const g = new THREE.Group(), R = rand(seed);
  const wood = toon('#a86f3a'), band = toon('#5a3a1e', { line: 0 });
  const geo = barrelGeo();
  const spots = [[-.16, .1], [.14, .14], [0, -.15], [.2, -.14], [-.2, -.16]].slice(0, 3 + (R() * 2 | 0));
  for (const [x, z] of spots) {
    const b = new THREE.Group(); b.position.set(x, .08, z);
    const lying = R() < .5;
    b.rotation.set(lying ? Math.PI / 2 : 0, R() * 6, lying ? 0 : (R() - .5) * .3);
    b.add(mesh(geo, wood));
    for (const y of [-.09, .09]) { const r = mesh(new THREE.TorusGeometry(.118, .012, 5, 14), band, 0, y, 0); r.rotation.x = Math.PI / 2; b.add(r); }
    g.add(b);
  }
  // lashed to a scrap of raft
  const raft = mesh(new THREE.BoxGeometry(.62, .05, .56), toon('#8a5a32'), 0, .0, 0); raft.rotation.y = R(); g.add(raft);
  return g;
}
export function makePost(seed) {
  const g = new THREE.Group(), R = rand(seed);
  const wood = toon('#8a5a32'), rope = toon('#e8d7a8');
  const h = .95 + R() * .2;
  const p = mesh(new THREE.CylinderGeometry(.11, .13, h, 10), wood, 0, h / 2 - .15, 0); p.rotation.z = (R() - .5) * .08; g.add(p);
  g.add(mesh(new THREE.CylinderGeometry(.115, .115, .04, 10), toon('#5a3a1e'), 0, h - .15, 0));
  const r = mesh(new THREE.TorusGeometry(.12, .025, 6, 14), rope, 0, h - .35, 0); r.rotation.x = Math.PI / 2; g.add(r);
  // a red-and-white band, so posts read as posts
  const band = mesh(new THREE.CylinderGeometry(.125, .125, .12, 10), toon('#fbf7ea'), 0, .15, 0); g.add(band);
  g.userData = { top: h - .15 };
  if (R() < .55) { const gull = makeGull(); gull.position.set(0, h - .13, 0); gull.rotation.y = R() * 6; g.add(gull); g.userData.gull = gull; }
  return g;
}
export function makeGull() {
  const g = new THREE.Group(), w = toon('#ffffff'), grey = toon('#9aa8b6');
  const b = mesh(new THREE.SphereGeometry(.07, 8, 6), w, 0, .07, 0); b.scale.set(.8, .8, 1.3); g.add(b);
  g.add(mesh(new THREE.SphereGeometry(.045, 8, 6), w, 0, .13, -.06));
  const beak = mesh(new THREE.ConeGeometry(.015, .05, 5), toon('#f5c542'), 0, .13, -.11); beak.rotation.x = -Math.PI / 2; g.add(beak);
  for (const sd of [-1, 1]) { const wing = mesh(new THREE.SphereGeometry(.05, 6, 4), grey, sd * .055, .08, .01); wing.scale.set(.3, .5, 1.2); g.add(wing); }
  return g;
}
export function makeRock(seed) {
  const g = new THREE.Group(), R = rand(seed);
  const grey = toon('#8e98a3'), dark = toon('#6b7580'), moss = toon('#7fae5a');
  const n = 2 + (R() * 2 | 0);
  for (let i = 0; i < n; i++) {
    const s = .26 + R() * .16, geo = new THREE.DodecahedronGeometry(s, 0);
    const m = mesh(geo, i ? dark : grey, (R() - .5) * .34, s * (.4 + R() * .5), (R() - .5) * .34);
    m.scale.set(1, 1.1 + R() * .9, 1); m.rotation.set(R() * 3, R() * 3, R() * 3);
    g.add(m);
    if (!i && R() < .5) { const top = mesh(new THREE.SphereGeometry(s * .55, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), moss, m.position.x, m.position.y + s * .75, m.position.z); g.add(top); }
  }
  return g;
}
export function makePalm(seed) {
  const g = new THREE.Group(), R = rand(seed);
  const trunkM = toon('#9c6b3c'), leafM = toon('#3f9a3a'), leafM2 = toon('#5cc24a', { line: 0 });
  const h = .75 + R() * .35, lean = (R() - .5) * .5;
  const pts = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector3(Math.sin(lean) * t * t * .4, t * h, 0)); }
  const trunk = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, .04, 6), trunkM);
  g.add(trunk);
  const top = pts[pts.length - 1];
  const crown = new THREE.Group(); crown.position.copy(top); g.add(crown);
  const leaf = new THREE.Shape(); leaf.moveTo(0, 0); leaf.quadraticCurveTo(.12, .06, .42, -.08); leaf.quadraticCurveTo(.14, -.04, 0, 0);
  const lg = new THREE.ShapeGeometry(leaf, 6);
  const k = 5 + (R() * 2 | 0);
  for (let i = 0; i < k; i++) {
    const l = mesh(lg, i % 2 ? leafM : leafM2); l.material = l.material.clone(); l.material.side = THREE.DoubleSide; l.material.userData = { outlineParameters: { visible: false } };
    l.rotation.set(-Math.PI / 2 + .25, (i / k) * Math.PI * 2 + R() * .4, 0);
    crown.add(l);
  }
  crown.add(mesh(new THREE.SphereGeometry(.05, 6, 5), toon('#6b4a22'), .03, -.03, 0), mesh(new THREE.SphereGeometry(.05, 6, 5), toon('#6b4a22'), -.03, -.04, .02));
  g.rotation.y = R() * 6;
  g.userData.crown = crown;
  return g;
}
export function makeBush(seed) {
  const g = new THREE.Group(), R = rand(seed), m = toon(R() < .5 ? '#3f9a3a' : '#4fae45');
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.SphereGeometry(.1 + R() * .06, 8, 6), m, (R() - .5) * .2, .06, (R() - .5) * .2));
  return g;
}
export function makeHut(seed, roof = '#d9463c') {
  const g = new THREE.Group(), R = rand(seed);
  const walls = mesh(new THREE.BoxGeometry(.36, .26, .32), toon('#f3e2c0'), 0, .13, 0); g.add(walls);
  const r = mesh(new THREE.ConeGeometry(.3, .24, 4), toon(roof), 0, .38, 0); r.rotation.y = Math.PI / 4; g.add(r);
  g.add(mesh(new THREE.BoxGeometry(.08, .13, .02), toon('#6b4a2c'), 0, .07, -.17));
  g.rotation.y = R() * 6;
  return g;
}
export function makeLighthouse() {
  const g = new THREE.Group();
  const red = toon('#e0524a'), white = toon('#fbf7ea');
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.CylinderGeometry(.2 - i * .025, .22 - i * .025, .3, 14), i % 2 ? red : white, 0, .15 + i * .3, 0));
  const lamp = mesh(new THREE.CylinderGeometry(.13, .13, .16, 12), toon('#fff3a0', { emissive: '#ffd84a', glow: 1.2 }), 0, 1.33, 0); g.add(lamp);
  g.add(mesh(new THREE.ConeGeometry(.17, .18, 12), red, 0, 1.5, 0));
  g.userData.lamp = lamp;
  return g;
}
// the harbour's pier: planks on posts running out from the shore, a flag, and a lantern
export function makePier(len = .9) {
  const g = new THREE.Group(), wood = toon('#b98450'), dark = toon('#7a5230');
  const deck = mesh(new THREE.BoxGeometry(.36, .05, len), wood, 0, .16, 0); g.add(deck);
  for (let z = -len / 2 + .1; z <= len / 2 - .05; z += .2) g.add(mesh(new THREE.BoxGeometry(.38, .012, .03), dark, 0, .19, z));
  for (const x of [-.16, .16]) for (const z of [-len / 2 + .06, len / 2 - .06]) g.add(mesh(new THREE.CylinderGeometry(.03, .03, .4, 6), dark, x, .02, z));
  const pole = mesh(new THREE.CylinderGeometry(.018, .018, .75, 6), dark, .15, .55, -len / 2 + .08); g.add(pole);
  const flag = mesh(new THREE.PlaneGeometry(.28, .17), toon('#f5c542', { params: { side: THREE.DoubleSide }, line: 0 }), .29, .82, -len / 2 + .08); g.add(flag);
  const lantern = mesh(new THREE.SphereGeometry(.05, 8, 6), toon('#fff3a0', { emissive: '#ffcf4a', glow: 1.1 }), -.15, .3, -len / 2 + .08); g.add(lantern);
  g.userData = { flag };
  return g;
}

export function rand(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
