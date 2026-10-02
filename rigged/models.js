// Rigged Racer: everything on and around the road, built from simple shapes in hard-banded toon colours with ink
// outlines: the eight karts and their drivers, what the player puts down, rockets and vultures, the tracks' traps, and
// the pieces the scenery is made of. One unit is one lane; a kart's nose points down -z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------- toon materials ---------- */
// Three hard bands of light, with a deep shadow band: heavy cel shading.
const ramp = (() => {
  const d = new Uint8Array([88, 88, 88, 255, 168, 168, 168, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
})();
export const RAMP = ramp;
export const INK = [.09, .05, .03];
const mats = new Map();
export function toon(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (mats.has(key) && !o.unique) return mats.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...o.params });
  if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.glow ?? 1; }
  m.userData.outlineParameters = { thickness: o.line ?? .005, color: INK, alpha: 1, visible: o.line !== 0 };
  if (!o.unique) mats.set(key, m);
  return m;
}
export const noLine = m => { m.userData.outlineParameters = { visible: false }; return m; };
export const flat = (color, o = {}) => noLine(new THREE.MeshBasicMaterial({ color, transparent: o.opacity != null, opacity: o.opacity ?? 1, depthWrite: o.opacity == null, side: o.side ?? THREE.FrontSide }));
export const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
export function labelTexture(draw, w = 128, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
export function rand(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- shared shapes ---------- */
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  rbox: roundBox(1, 1, 1, .18),
  ball: new THREE.IcosahedronGeometry(1, 2),
  bead: new THREE.SphereGeometry(1, 10, 7),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 10),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  stone: new THREE.DodecahedronGeometry(1, 0),
  torus: new THREE.TorusGeometry(1, .42, 8, 16),
  wheel: (() => { const g = new THREE.CylinderGeometry(1, 1, 1, 14); g.rotateZ(Math.PI / 2); return g; })(),
};
// a box with rounded edges, as a smoothed lathe-free shape: chamfered by scaling a subdivided cube onto a superellipse
function roundBox(w, h, d, r) {
  const g = new THREE.BoxGeometry(w, h, d, 4, 4, 4), p = g.attributes.position, v = new THREE.Vector3();
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const c = new THREE.Vector3(Math.max(-hw, Math.min(hw, v.x)), Math.max(-hh, Math.min(hh, v.y)), Math.max(-hd, Math.min(hd, v.z)));
    const n = v.clone().sub(c); if (n.lengthSq() > 0) n.setLength(r);
    p.setXYZ(i, c.x + n.x, c.y + n.y, c.z + n.z);
  }
  g.computeVertexNormals();
  return g;
}
export function part(geo, mat, [x, y, z] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1], [rx, ry, rz] = [0, 0, 0]) {
  const m = mesh(geo, mat, x, y, z); m.scale.set(sx, sy ?? sx, sz ?? sx); m.rotation.set(rx, ry, rz); return m;
}

/* ---------- the karts ---------- */
const SKIN = { duke: '#d9925e', pip: '#f2c49b', granny: '#f0c8a8', mutt: '#a8743e', sprocket: '#9fb4c8', rhonda: '#c98a5a', spike: '#5aa846', count: '#e6e2ea' };

function wheelSet(k, at, r, w, hubColor = '#c9c3b5') {
  const tyre = toon('#2a2522'), hub = toon(hubColor);
  for (const [x, z, big] of at) {
    const g = new THREE.Group(); g.position.set(x, (big || r), z);
    const rr = big || r;
    g.add(part(G.wheel, tyre, [0, 0, 0], [w, rr, rr]));
    g.add(part(G.wheel, hub, [Math.sign(x) * w * .52, 0, 0], [.02, rr * .5, rr * .5]));
    // a tread bump, so a turning wheel shows it turning
    g.add(part(G.box, toon('#3e3631', { line: 0 }), [0, rr * .92, 0], [w * 1.02, rr * .22, rr * .35]));
    k.userData.wheels.push(g); k.userData.body.add(g);
  }
}
function head(skin, r = .085) {
  const h = new THREE.Group();
  h.add(part(G.bead, toon(skin), [0, 0, 0], [r, r, r]));
  const eye = toon('#1a1010', { line: 0 });
  h.add(part(G.bead, eye, [-r * .38, r * .15, -r * .9], [r * .14]), part(G.bead, eye, [r * .38, r * .15, -r * .9], [r * .14]));
  return h;
}
function goggles(h, r, color = '#3a3a3a', lens = '#9fe0ff') {
  const band = part(G.torus, toon(color), [0, r * .2, 0], [r * 1.02, r * 1.02, r * .55], [Math.PI / 2, 0, 0]); h.add(band);
  for (const sd of [-1, 1]) h.add(part(G.cyl, toon(lens, { emissive: lens, glow: .25 }), [sd * r * .4, r * .22, -r * .92], [r * .3, r * .14, r * .3], [Math.PI / 2, 0, 0]));
}

export function makeKart(who, color) {
  const k = new THREE.Group(), body = new THREE.Group(); k.add(body);
  k.userData = { body, wheels: [], who, flames: [], parts: [] };
  const c = toon(color), dark = toon(new THREE.Color(color).multiplyScalar(.6).getStyle()), metal = toon('#8f8a80'), chrome = toon('#d8dde3'), rust = toon('#9b4a2a');
  const skin = SKIN[who];
  let driver = new THREE.Group();
  if (who === 'duke') {
    // a monster truck: huge tyres, a high red cab, a skull on the bonnet and spikes on the roll bar
    wheelSet(k, [[-.27, -.26], [.27, -.26], [-.27, .26], [.27, .26]], .17, .14);
    body.add(part(G.rbox, c, [0, .36, 0], [.5, .16, .86]));
    body.add(part(G.rbox, dark, [0, .3, 0], [.56, .06, .9]));
    body.add(part(G.rbox, c, [0, .5, .1], [.42, .16, .32]));                                  // cab
    body.add(part(G.box, toon('#36505e'), [0, .51, -.07], [.36, .1, .03], [-.4, 0, 0]));        // windscreen
    const skull = new THREE.Group(); skull.position.set(0, .47, -.38); body.add(skull);
    skull.add(part(G.bead, toon('#efe6cf'), [0, 0, 0], [.07, .06, .06]));
    for (const sd of [-1, 1]) skull.add(part(G.bead, toon('#1a1010', { line: 0 }), [sd * .028, .012, -.05], [.018]));
    for (const sd of [-1, 1]) for (const z of [-.05, .1, .25]) body.add(part(G.cone, chrome, [sd * .22, .64, z], [.025, .08, .025]));
    for (const sd of [-1, 1]) { body.add(part(G.cyl, chrome, [sd * .17, .66, .33], [.03, .26, .03])); k.userData.flames.push([sd * .17, .8, .33, 0, 1, 0]); }
    driver = head(skin, .075); driver.position.set(0, .62, .1);
    driver.add(part(G.box, toon('#151515'), [0, .015, -.065], [.11, .025, .02]));               // shades
    driver.add(part(G.bead, toon('#d23a2c'), [0, .05, 0], [.078, .04, .078]));                   // bandana
  } else if (who === 'pip') {
    // a bathtub on wheels, with a rubber duck
    wheelSet(k, [[-.21, -.24], [.21, -.24], [-.21, .25], [.21, .25]], .09, .07);
    const tub = new THREE.Group(); tub.position.y = .2; body.add(tub);
    tub.add(part(G.rbox, toon('#f4f1ea'), [0, .06, 0], [.42, .16, .74]));
    tub.add(part(G.rbox, toon('#6fc6d8', { line: 0 }), [0, .13, .02], [.34, .04, .64]));         // the water
    tub.add(part(G.rbox, c, [0, -.02, 0], [.44, .04, .76]));
    for (const [x, z] of [[-.17, -.3], [.17, -.3], [-.17, .3], [.17, .3]]) tub.add(part(G.bead, toon('#d4a83a'), [x, -.06, z], [.035]));   // claw feet
    const duck = new THREE.Group(); duck.position.set(.13, .2, -.3); tub.add(duck);
    duck.add(part(G.bead, toon('#ffd23a'), [0, 0, 0], [.045, .035, .055]), part(G.bead, toon('#ffd23a'), [0, .045, -.025], [.03]), part(G.cone, toon('#f07f2a'), [0, .045, -.06], [.012, .03, .012], [-Math.PI / 2, 0, 0]));
    body.add(part(G.cyl, chrome, [0, .35, .32], [.02, .2, .02]));                              // the tap, as an exhaust
    k.userData.flames.push([0, .45, .34, 0, 1, 0]);
    driver = head(skin, .07); driver.position.set(0, .41, .08);
    driver.add(part(G.bead, toon('#7a4a22'), [0, .02, .005], [.074, .055, .074]));               // leather cap
    goggles(driver, .07, '#5a3a1e');
  } else if (who === 'granny') {
    // an armchair with a jet engine on the back
    wheelSet(k, [[-.22, -.26], [.22, -.26], [-.22, .27], [.22, .27]], .09, .07);
    body.add(part(G.box, toon('#5a3a22'), [0, .17, 0], [.4, .05, .8]));                        // the cart
    body.add(part(G.rbox, c, [0, .27, .05], [.4, .12, .44]));                                   // seat
    body.add(part(G.rbox, c, [0, .44, .25], [.4, .32, .1]));                                    // back
    for (const sd of [-1, 1]) body.add(part(G.rbox, dark, [sd * .2, .36, .06], [.08, .12, .42]));
    body.add(part(G.bead, toon('#f2e6c8', { line: 0 }), [0, .58, .27], [.12, .03, .03]));      // a lace doily
    const jet = new THREE.Group(); jet.position.set(0, .33, .44); body.add(jet);
    jet.add(part(G.cyl, metal, [0, 0, 0], [.1, .26, .1], [Math.PI / 2, 0, 0]));
    jet.add(part(G.torus, chrome, [0, 0, -.13], [.1, .1, .07]));
    jet.add(part(G.cyl, toon('#3a3530'), [0, 0, .14], [.07, .04, .07], [Math.PI / 2, 0, 0]));
    k.userData.flames.push([0, .33, .6, 0, 0, 1]);
    driver = head(skin, .07); driver.position.set(0, .45, .05);
    driver.add(part(G.bead, toon('#d8d4dc'), [0, .03, .02], [.075, .06, .075]), part(G.bead, toon('#d8d4dc'), [0, .09, .05], [.04]));   // hair and bun
    for (const sd of [-1, 1]) driver.add(part(G.torus, toon('#5a4a6a'), [sd * .028, .012, -.068], [.022, .022, .015]));                // specs
  } else if (who === 'mutt') {
    // a dune buggy with a roll cage, and a dog with his ears out
    wheelSet(k, [[-.24, -.27], [.24, -.27]], .1, .08); wheelSet(k, [[-.25, .25], [.25, .25]], .13, .11);
    body.add(part(G.rbox, c, [0, .22, -.05], [.4, .1, .7]));
    body.add(part(G.rbox, c, [0, .26, -.32], [.3, .08, .2], [.3, 0, 0]));
    const bar = toon('#333'); for (const sd of [-1, 1]) { body.add(part(G.cyl6, bar, [sd * .16, .42, .05], [.016, .32, .016], [.25, 0, 0])); body.add(part(G.cyl6, bar, [sd * .16, .42, .25], [.016, .32, .016], [-.2, 0, 0])); }
    body.add(part(G.cyl6, bar, [0, .57, .14], [.016, .34, .016], [0, 0, Math.PI / 2]));
    body.add(part(G.cyl, metal, [0, .3, .33], [.08, .1, .08]));                                  // engine
    body.add(part(G.cyl, chrome, [.12, .36, .36], [.02, .14, .02])); k.userData.flames.push([.12, .44, .38, 0, 1, 0]);
    driver = head(skin, .075); driver.position.set(0, .4, .08);
    driver.add(part(G.bead, toon('#8a5a2c'), [0, -.02, -.085], [.04, .035, .05]));               // snout
    driver.add(part(G.bead, toon('#1a1010'), [0, -.005, -.13], [.016]));
    driver.add(part(G.bead, toon('#e0607a'), [0, -.055, -.1], [.02, .008, .03]));                // tongue
    for (const sd of [-1, 1]) { const ear = part(G.bead, toon('#6a4220'), [sd * .075, .01, .02], [.025, .06, .04], [0, 0, sd * .5]); driver.add(ear); k.userData.parts.push(ear); }
    goggles(driver, .075, '#333', '#ffb340');
  } else if (who === 'sprocket') {
    // a motorbike with a sidecar full of spanners, ridden by a robot
    wheelSet(k, [[-.08, -.3], [-.08, .28]], .12, .06); wheelSet(k, [[.24, .05]], .09, .06);
    body.add(part(G.rbox, c, [-.08, .26, 0], [.13, .14, .55]));
    body.add(part(G.box, metal, [-.08, .2, .02], [.1, .1, .28]));
    body.add(part(G.cyl6, chrome, [-.08, .42, -.22], [.012, .34, .012], [0, 0, Math.PI / 2]));      // handlebars
    const side = new THREE.Group(); side.position.set(.2, .2, .03); body.add(side);
    side.add(part(G.rbox, c, [0, .02, 0], [.2, .14, .42]));
    side.add(part(G.rbox, toon('#3a3a3a', { line: 0 }), [0, .09, .02], [.15, .02, .32]));
    for (const z of [-.1, .02, .12]) side.add(part(G.box, chrome, [.0, .12, z], [.12, .015, .025], [0, .6, 0]));
    body.add(part(G.cyl, chrome, [-.15, .26, .3], [.025, .12, .025], [Math.PI / 2.4, 0, 0])); k.userData.flames.push([-.15, .3, .38, 0, .4, 1]);
    driver = new THREE.Group(); driver.position.set(-.08, .5, .06);
    driver.add(part(G.rbox, toon('#9fb4c8'), [0, 0, 0], [.13, .11, .12]));
    driver.add(part(G.rbox, toon('#5d7388'), [0, -.13, .02], [.14, .14, .1]));
    const visor = part(G.box, toon('#101820', { line: 0 }), [0, .005, -.062], [.1, .04, .01]); driver.add(visor);
    for (const sd of [-1, 1]) driver.add(part(G.bead, toon('#5fffd0', { emissive: '#3fffc0', glow: 1, line: 0 }), [sd * .025, .005, -.068], [.012]));
    driver.add(part(G.cyl6, metal, [0, .1, 0], [.006, .1, .006]), part(G.bead, toon('#ff4a3d', { emissive: '#ff2a1d' }), [0, .15, 0], [.015]));
  } else if (who === 'rhonda') {
    // a hot rod: a long bonnet, a supercharger sticking out of it and flames down the sides
    wheelSet(k, [[-.22, -.3], [.22, -.3]], .09, .07); wheelSet(k, [[-.25, .26], [.25, .26]], .13, .12);
    const flames = labelTexture((g, w, h) => {
      g.fillStyle = color; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffd23a'; g.beginPath(); g.moveTo(0, h * .2);
      for (let i = 0; i <= 5; i++) { const x = i * w / 5 * .9; g.quadraticCurveTo(x + 10, h * (i % 2 ? .35 : .15), x + 20, h * .45); g.lineTo(x + 6, h * .5); }
      g.lineTo(w, h * .55); g.lineTo(w * .9, h * .8); g.lineTo(0, h * .8); g.fill();
      g.fillStyle = '#e8402a'; g.fillRect(0, h * .6, w * .7, h * .12);
    }, 128, 64);
    const fl = toon('#ffffff', { params: { map: flames }, unique: true });
    body.add(part(G.rbox, fl, [0, .22, -.08], [.36, .14, .66]));
    body.add(part(G.rbox, c, [0, .24, .26], [.42, .14, .26]));
    body.add(part(G.rbox, metal, [0, .33, -.22], [.16, .08, .2]));
    body.add(part(G.cyl, chrome, [0, .38, -.22], [.06, .06, .06]));
    for (const sd of [-1, 1]) body.add(part(G.cyl, chrome, [sd * .19, .2, .02], [.022, .5, .022], [Math.PI / 2, 0, 0]));
    k.userData.flames.push([-.19, .2, .3, 0, 0, 1], [.19, .2, .3, 0, 0, 1]);
    driver = head(skin, .07); driver.position.set(0, .42, .22);
    for (let i = 0; i < 5; i++) driver.add(part(G.cone4, toon('#f27a22'), [0, .07, -.05 + i * .028], [.02, .07, .02]));    // mohawk
    driver.add(part(G.box, toon('#151515'), [0, .015, -.064], [.1, .022, .02]));
  } else if (who === 'spike') {
    // a terracotta flowerpot on wheels, driven by a cactus
    wheelSet(k, [[-.21, -.24], [.21, -.24], [-.21, .24], [.21, .24]], .09, .07);
    const pot = part(new THREE.CylinderGeometry(.24, .17, .26, 14), toon('#c8693a'), [0, .27, .02], [1, 1, 1]); body.add(pot);
    body.add(part(G.torus, toon('#b0582e'), [0, .4, .02], [.25, .25, .1], [Math.PI / 2, 0, 0]));
    body.add(part(G.cyl, toon('#6a4630', { line: 0 }), [0, .395, .02], [.22, .02, .22]));
    body.add(part(G.cyl, chrome, [.0, .2, .3], [.022, .14, .022], [Math.PI / 2.3, 0, 0])); k.userData.flames.push([0, .22, .38, 0, .3, 1]);
    driver = new THREE.Group(); driver.position.set(0, .52, .02);
    const green = toon(skin), spine = toon('#f4f0d8', { line: 0 });
    driver.add(part(G.bead, green, [0, 0, 0], [.08, .15, .08]));
    for (const sd of [-1, 1]) { driver.add(part(G.bead, green, [sd * .1, .02, 0], [.03, .05, .03])); driver.add(part(G.bead, green, [sd * .12, .07, 0], [.026, .05, .026])); }
    for (let i = 0; i < 10; i++) { const a = i * 2.4, y = -.08 + (i % 5) * .045; driver.add(part(G.cone4, spine, [Math.cos(a) * .08, y, Math.sin(a) * .08], [.006, .03, .006], [Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4])); }
    const eye = toon('#1a1010', { line: 0 }); driver.add(part(G.bead, eye, [-.028, .05, -.075], [.012]), part(G.bead, eye, [.028, .05, -.075], [.012]));
    driver.add(part(G.bead, toon('#ff5a9a'), [0, .16, 0], [.035, .02, .035]));                 // a flower on top
  } else {
    // count: a long black hearse with chrome trim, and a coffin in the back
    wheelSet(k, [[-.22, -.3], [.22, -.3], [-.22, .3], [.22, .3]], .1, .08);
    body.add(part(G.rbox, toon('#2a2a30'), [0, .24, 0], [.44, .14, .92]));
    body.add(part(G.rbox, toon('#2a2a30'), [0, .36, .16], [.4, .14, .5]));
    body.add(part(G.box, toon('#9aa8b8'), [0, .38, -.1], [.36, .08, .03], [-.5, 0, 0]));
    body.add(part(G.box, chrome, [0, .22, -.47], [.42, .06, .04]));
    for (const sd of [-1, 1]) body.add(part(G.box, chrome, [sd * .222, .3, .1], [.01, .02, .7]));
    const coffin = part(G.box, toon('#7a4a2a'), [0, .47, .28], [.2, .06, .34]); body.add(coffin);
    body.add(part(G.box, toon('#d8c070', { line: 0 }), [0, .505, .28], [.03, .01, .16]), part(G.box, toon('#d8c070', { line: 0 }), [0, .505, .24], [.1, .01, .03]));
    body.add(part(G.cyl, chrome, [.15, .2, .47], [.02, .1, .02], [Math.PI / 2, 0, 0])); k.userData.flames.push([.15, .2, .53, 0, 0, 1]);
    driver = head(skin, .07); driver.position.set(0, .52, -.02);
    driver.add(part(G.bead, toon('#141418'), [0, .03, .01], [.074, .05, .074]));
    driver.add(part(G.cone4, toon('#141418', { line: 0 }), [0, .03, -.065], [.02, .03, .01], [Math.PI, 0, 0]));   // widow's peak
    driver.add(part(G.box, toon('#151515'), [0, .012, -.064], [.1, .022, .02]));
    const cape = part(G.cone, toon('#a01a2a'), [0, -.07, .02], [.1, .1, .09]); driver.add(cape);
  }
  body.add(driver);
  k.userData.driver = driver;
  // a kart is drawn as a few meshes: the body, each wheel, the driver (and anything that moves on its own)
  bake(body, new Set([...k.userData.wheels, driver, ...k.userData.parts]));
  for (const w of k.userData.wheels) bake(w);
  bake(driver, new Set(k.userData.parts));
  // a soft shadow blob under it, so it sits on the road even where the sun's shadow falls far off
  const blob = new THREE.Mesh(new THREE.CircleGeometry(.4, 18), flat('#2a1608', { opacity: .3 }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = .03; blob.scale.set(.75, 1.15, 1); blob.renderOrder = 1;
  k.add(blob); k.userData.blob = blob;
  // the materials, for going chrome
  k.traverse(o => { if (o.isMesh && o !== blob) o.userData.mat = o.material; });
  return k;
}
// Bakes the plain-coloured meshes directly under a group (and in its plain sub-groups) into one vertex-coloured mesh,
// so a kart is a handful of draws instead of dozens. Anything in `keep` (and textured or glowing parts) stays apart.
export function bake(group, keep = new Set()) {
  const B = new Batch(), drop = [];
  group.updateMatrixWorld(true);
  const inv = group.matrixWorld.clone().invert();
  const walk = o => {
    for (const c of o.children) {
      if (keep.has(c)) continue;
      if (c.isMesh) {
        const m = c.material;
        if (Array.isArray(m) || m.map || m.emissive?.getHex() || m.transparent || !m.isMeshToonMaterial) continue;
        B.add(c.geometry, '#' + m.color.getHexString(), inv.clone().multiply(c.matrixWorld));
        drop.push(c);
      } else if (c.isGroup) walk(c);
    }
  };
  walk(group);
  if (drop.length < 2) return null;
  for (const c of drop) c.parent.remove(c);
  const m = B.mesh();
  group.add(m);
  return m;
}
const CHROME = toon('#e8eef5', { emissive: '#9ab0c8', glow: .55, unique: true });
export function setChrome(k, on) {
  if (k.userData.chromed === on) return;
  k.userData.chromed = on;
  k.traverse(o => { if (o.isMesh && o.userData.mat) o.material = on ? CHROME : o.userData.mat; });
}

/* ---------- things put on the road ---------- */
export function makeThing(kind, seed = 1) {
  const g = new THREE.Group(), R = rand(seed);
  g.userData.kind = kind;
  if (kind === 'oil') {
    const sh = new THREE.Shape();
    for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, r = .36 + .07 * Math.sin(a * 3 + R() * 6) + .04 * Math.sin(a * 5); i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r * 1.15) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r * 1.15); }
    const pool = new THREE.Mesh(new THREE.ShapeGeometry(sh), toon('#231d2c', { line: 0, params: { polygonOffset: true, polygonOffsetFactor: -2 } }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = .035; pool.receiveShadow = true; g.add(pool);
    const sheen = new THREE.Mesh(new THREE.RingGeometry(.12, .2, 20, 1, .3, 2.2), flat('#b48cff', { opacity: .45 }));
    sheen.rotation.x = -Math.PI / 2; sheen.position.set(-.05, .04, -.05); g.add(sheen);
    const glint = new THREE.Mesh(new THREE.CircleGeometry(.05, 10), flat('#ffffff', { opacity: .8 }));
    glint.rotation.x = -Math.PI / 2; glint.position.set(.12, .041, -.12); glint.scale.set(1.6, 1, 1); g.add(glint);
    g.userData.sheen = sheen;
  } else if (kind === 'spikes') {
    g.add(part(G.box, toon('#6b4a2c'), [0, .03, 0], [.8, .04, .2]));
    const steel = toon('#b8bec6');
    for (let i = 0; i < 7; i++) g.add(part(G.cone4, steel, [-.33 + i * .11, .1, (i % 2 - .5) * .08], [.035, .12, .035], [0, R(), 0]));
  } else if (kind === 'barrel' || kind === 'rubble') {
    if (kind === 'barrel') {
      const red = toon('#d24a2e'), band = toon('#2a2522'), stripe = toon('#f2c230');
      for (const [x, z, lying] of [[-.17, .06, 0], [.16, -.04, 0], [.02, .22, 1]]) {
        const b = new THREE.Group(); b.position.set(x, lying ? .13 : .21, z); b.rotation.set(lying ? Math.PI / 2 : 0, R() * 6, 0); g.add(b);
        b.add(part(G.cyl, red, [0, 0, 0], [.13, .4, .13]));
        b.add(part(G.cyl, stripe, [0, .06, 0], [.133, .06, .133]));
        for (const y of [-.12, .12]) b.add(part(G.torus, band, [0, y, 0], [.135, .135, .05], [Math.PI / 2, 0, 0]));
        if (!lying) b.add(part(G.cyl, toon('#9a3220', { line: 0 }), [0, .2, 0], [.1, .005, .1]));
      }
    } else {
      const st = toon('#b0603a'), st2 = toon('#8a4a2c');
      for (let i = 0; i < 6; i++) g.add(part(G.stone, i % 2 ? st : st2, [(R() - .5) * .55, .08 + R() * .12, (R() - .5) * .4], [.12 + R() * .1, .1 + R() * .08, .12 + R() * .08], [R() * 3, R() * 3, R() * 3]));
    }
  } else if (kind === 'mine') {
    g.add(part(G.cyl, toon('#5d6b3a'), [0, .04, 0], [.22, .07, .22]));
    g.add(part(G.cyl, toon('#7d8b52'), [0, .09, 0], [.14, .05, .14]));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(part(G.bead, toon('#3a3a30', { line: 0 }), [Math.cos(a) * .19, .08, Math.sin(a) * .19], [.022])); }
    const led = part(G.bead, toon('#ff2a1d', { emissive: '#ff2a1d', glow: 1.2, line: 0 }), [0, .125, 0], [.035]); g.add(led);
    g.userData.led = led;
  } else if (kind === 'boost') {
    const tex = labelTexture((c, w, h) => {
      c.fillStyle = '#2a1a10'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffb31a';
      for (let i = 0; i < 3; i++) { const y = h * (.12 + i * .3); c.beginPath(); c.moveTo(w * .12, y + h * .2); c.lineTo(w * .5, y); c.lineTo(w * .88, y + h * .2); c.lineTo(w * .88, y + h * .3); c.lineTo(w * .5, y + h * .1); c.lineTo(w * .12, y + h * .3); c.fill(); }
    }, 64, 128);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(.8, 1.5), toon('#ffffff', { params: { map: tex, emissive: new THREE.Color('#ff8a00'), emissiveIntensity: .35 }, unique: true, line: 0 }));
    pad.rotation.x = -Math.PI / 2; pad.position.y = .036; pad.receiveShadow = true; g.add(pad);
    g.add(part(G.box, toon('#6a6a6a'), [0, .02, 0], [.86, .03, 1.56]));
    g.userData.tex = tex;
  } else if (kind === 'ramp') {
    const sh = new THREE.Shape(); sh.moveTo(-.75, 0); sh.lineTo(.75, 0); sh.lineTo(.75, .3); sh.lineTo(-.75, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: .8, bevelEnabled: false }); geo.translate(0, 0, -.4); geo.rotateY(Math.PI / 2);
    g.add(mesh(geo, toon('#b77a3e')));
    for (let i = 0; i < 5; i++) g.add(part(G.box, toon('#8a5a2c', { line: 0 }), [0, .03 + i * .058, .55 - i * .27], [.82, .012, .03], [-.2, 0, 0]));
    g.add(part(G.box, toon('#f2c230', { line: 0 }), [0, .17, 0], [.1, .01, .3], [-.2, 0, 0]));
  } else if (kind === 'crate') {
    const tex = labelTexture((c, w, h) => {
      c.fillStyle = '#b07a3e'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#946232'; for (let y = 0; y < h; y += 32) c.fillRect(0, y + 28, w, 4);
      c.strokeStyle = '#6b4220'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
      c.fillStyle = '#ffe9b0'; c.font = '700 84px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', w / 2, h / 2 + 6);
    }, 128, 128);
    const box = new THREE.Group(); box.position.y = .25; g.add(box);
    box.add(part(G.box, toon('#ffffff', { params: { map: tex }, unique: true }), [0, 0, 0], [.36, .36, .36]));
    for (const x of [-1, 1]) for (const y of [-1, 1]) box.add(part(G.box, toon('#5a5a5a', { line: 0 }), [x * .18, y * .18, 0], [.05, .05, .38]));
    g.userData.box = box;
  } else if (kind === 'skull') {
    const sk = new THREE.Group(); sk.position.y = .32; g.add(sk);
    const ch = toon('#e8eef5', { emissive: '#8aa0b8', glow: .6 });
    sk.add(part(G.bead, ch, [0, .03, 0], [.15, .13, .15]));
    sk.add(part(G.rbox, ch, [0, -.08, -.04], [.16, .08, .14]));
    const hole = toon('#1a1a22', { line: 0 });
    for (const sd of [-1, 1]) sk.add(part(G.bead, hole, [sd * .055, .02, -.125], [.04, .035, .02]));
    sk.add(part(G.cone4, hole, [0, -.035, -.135], [.02, .03, .01], [Math.PI, 0, 0]));
    g.userData.box = sk;
  }
  if (g.userData.box) bake(g.userData.box);
  bake(g, new Set([g.userData.led, g.userData.box].filter(Boolean)));
  g.traverse(o => { if (o.isMesh) o.castShadow = kind !== 'oil' && kind !== 'boost'; });
  return g;
}

/* ---------- rockets and vultures ---------- */
export function makeRocket(homing) {
  const g = new THREE.Group(), body = homing ? toon('#e0402a') : toon('#c8ccd2');
  g.add(part(G.cyl, body, [0, 0, 0], [.05, .3, .05], [Math.PI / 2, 0, 0]));
  g.add(part(G.cone, toon(homing ? '#ffd23a' : '#e0402a'), [0, 0, -.2], [.05, .12, .05], [-Math.PI / 2, 0, 0]));
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; g.add(part(G.box, toon('#3a3a3a'), [Math.cos(a) * .05, Math.sin(a) * .05, .12], [.012, .08, .09], [0, 0, a])); }
  return g;
}
export function makeVulture() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const brown = toon('#4a3326'), pink = toon('#e09a8a');
  body.add(part(G.bead, brown, [0, 0, 0], [.16, .12, .24]));
  body.add(part(G.bead, toon('#f0e6d0'), [0, .06, -.2], [.08, .05, .05]));     // ruff
  body.add(part(G.bead, pink, [0, .08, -.3], [.05, .05, .06]));
  body.add(part(G.cone, toon('#e8c050'), [0, .07, -.37], [.02, .06, .02], [-Math.PI / 2, 0, 0]));
  const wings = [-1, 1].map(sd => { const w = new THREE.Group(); w.position.set(sd * .12, .04, 0); w.add(part(G.bead, brown, [sd * .3, 0, 0], [.34, .025, .14])); body.add(w); return w; });
  const bomb = new THREE.Group(); bomb.position.set(0, -.18, 0); body.add(bomb);
  bomb.add(part(G.bead, toon('#202024'), [0, 0, 0], [.09]));
  bomb.add(part(G.cyl6, toon('#c8b080'), [0, .1, 0], [.012, .06, .012]));
  g.userData = { body, wings, bomb };
  return g;
}

/* ---------- the tracks' traps ---------- */
export function makeWorm() {
  // a sandworm: ringed segments, and a round mouth full of teeth
  const g = new THREE.Group(), segs = [];
  const skin = toon('#c98a5a'), ring = toon('#a8683e');
  for (let i = 0; i < 9; i++) {
    const r = .55 - i * .035, s = new THREE.Group();
    s.add(part(G.bead, i % 2 ? skin : ring, [0, 0, 0], [r, r, r * .8]));
    g.add(s); segs.push(s);
  }
  const mouth = segs[0];
  mouth.add(part(G.cyl, toon('#3a1018', { line: 0 }), [0, 0, -.42], [.38, .02, .38], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; mouth.add(part(G.cone4, toon('#f4ecd0'), [Math.cos(a) * .32, Math.sin(a) * .32, -.4], [.04, .12, .04], [Math.PI / 2, 0, -a - Math.PI / 2])); }
  g.userData = { segs };
  return g;
}
export function makeMound() {
  const g = new THREE.Group();
  g.add(part(G.bead, toon('#d9a25e'), [0, -.05, 0], [.9, .25, .9]));
  for (let i = 0; i < 4; i++) g.add(part(G.stone, toon('#b88550'), [Math.cos(i * 1.7) * .6, .05, Math.sin(i * 1.7) * .6], [.1, .07, .1], [i, i, 0]));
  const flag = new THREE.Group(); flag.position.set(.55, 0, -.4); g.add(flag);
  flag.add(part(G.cyl6, toon('#5a3a22'), [0, .4, 0], [.02, .8, .02]));
  const cloth = mesh(new THREE.PlaneGeometry(.28, .18), toon('#d23a2c', { params: { side: THREE.DoubleSide }, line: 0 }), .14, .72, 0); flag.add(cloth);
  g.userData = { flag: cloth };
  return g;
}
export function makeCrane() {
  // a rusty crane beside the road, its boom out over the lanes, with an electromagnet on a cable
  const g = new THREE.Group(), rustM = toon('#b0582e'), steel = toon('#5a5a60'), yel = toon('#f2c230');
  g.add(part(G.box, steel, [0, .1, 0], [1.1, .2, 1.1]));
  for (const [x, z] of [[-.35, -.35], [.35, -.35], [-.35, .35], [.35, .35]]) g.add(part(G.box, rustM, [x, 1.4, z], [.08, 2.6, .08]));
  for (let y = .4; y < 2.6; y += .45) g.add(part(G.box, rustM, [0, y, -.35], [.7, .05, .05], [0, 0, .5]), part(G.box, rustM, [0, y, .35], [.7, .05, .05], [0, 0, -.5]));
  const top = new THREE.Group(); top.position.y = 2.75; g.add(top);
  top.add(part(G.box, yel, [0, 0, 0], [.8, .35, .8]));
  top.add(part(G.box, toon('#36505e'), [0, .02, -.41], [.5, .18, .02]));
  const boom = new THREE.Group(); top.add(boom);
  boom.add(part(G.box, yel, [-1.6, .25, 0], [3.4, .14, .14]));
  boom.add(part(G.box, yel, [-1.4, .5, 0], [2.9, .06, .06], [0, 0, -.08]));
  boom.add(part(G.box, steel, [.6, .1, 0], [.5, .4, .5]));
  const cable = part(G.cyl6, toon('#222', { line: 0 }), [-3.1, -.6, 0], [.015, 1.4, .015]); boom.add(cable);
  const mag = new THREE.Group(); mag.position.set(-3.1, -1.35, 0); boom.add(mag);
  mag.add(part(G.cyl, toon('#3a3a40'), [0, 0, 0], [.35, .12, .35]));
  mag.add(part(G.cyl, toon('#c8c8c8'), [0, -.07, 0], [.3, .03, .3]));
  const glow = new THREE.Mesh(new THREE.CircleGeometry(.36, 20), flat('#7ad8ff', { opacity: 0 })); glow.rotation.x = Math.PI / 2; glow.position.y = -.09; mag.add(glow);
  g.userData = { top, boom, cable, mag, glow, reach: 3.1, hang: 2.75 - 1.35 };
  return g;
}
export function makeBoulderLedge() {
  const g = new THREE.Group(), rock = toon('#b0603a'), rock2 = toon('#8f4a2e');
  g.add(part(G.stone, rock2, [0, .5, 0], [1.4, .9, 1.2], [.2, .4, 0]));
  g.add(part(G.stone, rock, [.4, 1.2, .2], [.9, .6, .8], [.5, .2, .3]));
  const log = part(G.cyl, toon('#7a5230'), [-.2, 1.55, -.2], [.06, .9, .06], [0, 0, 1.2]); g.add(log);
  const ball = new THREE.Group(); ball.position.set(-.3, 1.95, 0); g.add(ball);
  ball.add(part(G.ball, toon('#c87a48'), [0, 0, 0], [.55]));
  for (let i = 0; i < 5; i++) ball.add(part(G.stone, toon('#a85e36', { line: 0 }), [Math.cos(i * 1.3) * .42, Math.sin(i * 2.1) * .3, Math.sin(i * 1.3) * .42], [.12, .08, .12]));
  g.userData = { ball, log };
  return g;
}
export function makeFlareStack() {
  const g = new THREE.Group(), steel = toon('#7a7f88'), red = toon('#c8352b'), white = toon('#efe9dc');
  for (let i = 0; i < 6; i++) g.add(part(G.cyl, i % 2 ? red : white, [0, .3 + i * .5, 0], [.22, .5, .22]));
  g.add(part(G.cyl, steel, [0, 3.15, 0], [.26, .2, .26]));
  // the nozzle out over the road
  g.add(part(G.cyl, steel, [-1.3, 2.4, 0], [.1, 2.6, .1], [0, 0, Math.PI / 2]));
  g.add(part(G.cyl, toon('#3a3a3a'), [-2.6, 2.3, 0], [.15, .25, .15]));
  const pilot = new THREE.Group(); pilot.position.set(0, 3.35, 0); g.add(pilot);
  const fire = new THREE.Group(); fire.position.set(-2.6, 2.1, 0); g.add(fire);
  g.userData = { pilot, fire, reach: 2.6 };
  return g;
}
export function makeGate() {
  const g = new THREE.Group();
  g.add(part(G.box, toon('#5a5a60'), [0, .35, 0], [.18, .7, .18]));
  g.add(part(G.box, toon('#f2c230'), [0, .62, 0], [.24, .14, .24]));
  const arm = new THREE.Group(); arm.position.y = .62; g.add(arm);
  const stripes = labelTexture((c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#d23a2c' : '#f4efe4'; c.fillRect(i * w / 8, 0, w / 8, h); } }, 128, 16);
  arm.add(part(G.box, toon('#ffffff', { params: { map: stripes }, unique: true }), [-.75, 0, 0], [1.5, .07, .07]));
  g.userData = { arm };
  return g;
}
export function makeFlame(scale = 1) {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(G.cone, flat('#ff7a1a', { opacity: .9 })); outer.scale.set(.12 * scale, .4 * scale, .12 * scale); outer.position.y = .18 * scale;
  const inner = new THREE.Mesh(G.cone, flat('#ffe24a', { opacity: .95 })); inner.scale.set(.07 * scale, .26 * scale, .07 * scale); inner.position.y = .12 * scale;
  g.add(outer, inner);
  g.userData = { outer, inner, scale };
  return g;
}

/* ---------- scenery: pieces baked into one mesh ---------- */
// Like Sail's plants: each piece is coloured through its vertices, and a whole track's worth is one draw, one outline.
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
export const at = (x, y, z, yaw = 0, tilt = 0, sx = 1, sy = sx, sz = sx, roll = 0) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(tilt, yaw, roll, 'YXZ')), _s.set(sx, sy, sz));
export class Batch {
  constructor() { this.parts = []; }
  add(geo, color, m) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(m);
    const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(g);
  }
  // a whole group of meshes (with their own toon colours), placed by m
  addGroup(group, m) {
    group.updateMatrixWorld(true);
    group.traverse(o => { if (o.isMesh && o.material.color) this.add(o.geometry, '#' + o.material.color.getHexString(), m.clone().multiply(o.matrixWorld)); });
  }
  mesh(o = {}) {
    if (!this.parts.length) return null;
    const geo = mergeGeometries(this.parts);
    this.parts.forEach(g => g.dispose()); this.parts = [];
    const m = new THREE.Mesh(geo, toon('#ffffff', { params: { vertexColors: true }, line: o.line }));
    m.castShadow = o.cast !== false; m.receiveShadow = true;
    return m;
  }
}
