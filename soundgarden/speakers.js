// The eight speakers, each a kind you might really plant in a garden, and each with one small button. A ring of light
// round the button glows amber on standby and in the part's own colour when it's playing, breathing with the music.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import * as L from './layout.js';
import * as T from './textures.js';
import { TAU } from './common.js';
import { PARTS } from './music.js';
import { bake } from './features.js';

const PART = Object.fromEntries(PARTS.map(p => [p.id, p]));

function glowTexture() {
  const [c, g] = T.canvas(64), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(.6, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return T.tex(c, { repeat: false });
}
function ringsTexture() {                                  // the sawn top of a stump
  const [c, g] = T.canvas(256), R = L.mulberry(3);
  g.fillStyle = '#b08a60'; g.fillRect(0, 0, 256, 256);
  for (let r = 4; r < 128; r += 2.5 + R() * 3) {
    g.strokeStyle = `rgba(${90 + R() * 30},${60 + R() * 20},${35},${.35 + R() * .3})`; g.lineWidth = .8 + R() * 1.4;
    g.beginPath(); for (let a = 0; a <= TAU + .01; a += .05) { const rr = r * (1 + .04 * Math.sin(a * 3 + r) + .02 * Math.sin(a * 7)); a ? g.lineTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr) : g.moveTo(128 + rr, 128); } g.stroke();
  }
  for (let i = 0; i < 9; i++) { const a = R() * TAU; g.strokeStyle = 'rgba(50,32,18,.55)'; g.lineWidth = 1 + R(); g.beginPath(); g.moveTo(128 + Math.cos(a) * 10, 128 + Math.sin(a) * 10); g.lineTo(128 + Math.cos(a) * (40 + R() * 80), 128 + Math.sin(a) * (40 + R() * 80)); g.stroke(); }
  return T.tex(c, { repeat: false });
}

export function buildSpeakers(scene) {
  const grilleMap = T.grille(), stone = T.stone(13, '#a3a198'), sand = T.stone(17, '#bba583'), stumpBark = T.bark('stump');
  const M = {
    body: new THREE.MeshStandardMaterial({ color: 0x2d3033, roughness: .55, metalness: .15 }),
    alu: new THREE.MeshStandardMaterial({ color: 0x3c3f43, roughness: .35, metalness: .75 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0x5e4a35, roughness: .42, metalness: .85 }),
    black: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: .45, metalness: .5 }),
    grille: new THREE.MeshStandardMaterial({ map: grilleMap, roughness: .5, metalness: .55 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xd2d4d6, roughness: .22, metalness: 1 }),
    granite: new THREE.MeshStandardMaterial({ map: stone.map, normalMap: stone.normal, roughness: .85 }),
    sandstone: new THREE.MeshStandardMaterial({ map: sand.map, normalMap: sand.normal, roughness: .9 }),
    stump: new THREE.MeshStandardMaterial({ map: stumpBark.map, normalMap: stumpBark.normal, roughness: .95 }),
    rings: new THREE.MeshStandardMaterial({ map: ringsTexture(), roughness: .9 }),
    strap: new THREE.MeshStandardMaterial({ color: 0x2a2b2c, roughness: .9 }),
  };
  const glowTex = glowTexture(), out = [];
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

  // The button: a domed steel cap in a ring of light, facing along `dir` (a local direction).
  function button(parent, pos, dir) {
    const b = new THREE.Group(); b.position.copy(pos);
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const cap = mesh(new THREE.CylinderGeometry(.015, .017, .008, 20), M.steel, b, 0, .004, 0);
    mesh(new THREE.SphereGeometry(.015, 16, 8, 0, TAU, 0, Math.PI / 2).scale(1, .35, 1), M.steel, b, 0, .008, 0);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false });
    const led = mesh(new THREE.TorusGeometry(.022, .0032, 8, 32).rotateX(Math.PI / 2), ledMat, b, 0, .003, 0);
    led.castShadow = false;
    mesh(new THREE.CylinderGeometry(.03, .03, .004, 24), M.black, b, 0, 0, 0);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .5 }));
    glow.scale.setScalar(.16); glow.position.y = .012; b.add(glow);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    b.add(hit);
    parent.add(b);
    return { group: b, cap, led, ledMat, glow, hit };
  }
  function boxSpeaker(parent, w, h, d) {                   // a weatherproof box speaker, grille on the front
    mesh(new RoundedBoxGeometry(w, h, d, 3, .025), M.body, parent);
    mesh(new RoundedBoxGeometry(w * .86, h * .88, .012, 2, .005), M.grille, parent, 0, 0, d / 2 + .002);
    mesh(new THREE.BoxGeometry(w * .3, .012, .006), M.alu, parent, 0, -h / 2 + .03, d / 2 + .01);
  }

  for (const sp of L.SPEAKERS) {
    const g = new THREE.Group();
    g.position.set(sp.x, 0, sp.z); g.rotation.y = sp.yaw;
    let bpos, bdir = new THREE.Vector3(0, 1, 0);
    switch (sp.kind) {
      case 'bollard': {                                     // a bronze garden bollard with a 360° grille
        mesh(new THREE.CylinderGeometry(.13, .14, .03, 32), M.bronze, g, 0, .015, 0);
        mesh(new THREE.CylinderGeometry(.074, .08, .46, 32), M.bronze, g, 0, .26, 0);
        const band = new THREE.CylinderGeometry(.086, .086, .19, 40, 1, true), gm = M.grille.clone();
        gm.map = grilleMap.clone(); gm.map.repeat.set(5, 1); gm.map.needsUpdate = true;
        mesh(band, gm, g, 0, .585, 0);
        mesh(new THREE.CylinderGeometry(.09, .09, .02, 32), M.bronze, g, 0, .485, 0);
        const cap = new THREE.LatheGeometry([[0, .77], [.05, .768], [.1, .755], [.135, .735], [.15, .71], [.145, .69], [.1, .68], [.09, .68]].reverse().map(([x, y]) => new THREE.Vector2(x, y)), 40);
        mesh(cap, M.bronze, g);
        bpos = new THREE.Vector3(0, .77, .02);
        break;
      }
      case 'rock': {                                        // a sandstone rock with a speaker in its face
        const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 4).deleteAttribute('normal').deleteAttribute('uv')), p = geo.attributes.position, v = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i);
          const k = 1 + .12 * Math.sin(v.x * 3.1 + v.y * 2.3) * Math.sin(v.z * 2.7 + 1) + .06 * Math.sin(v.x * 7 + v.z * 5) + (v.z > .55 ? -.1 * (v.z - .55) : 0);
          v.multiplyScalar(k); v.y = Math.max(v.y, -.45);
          p.setXYZ(i, v.x * .34, v.y * .26 + .16, v.z * .3);
        }
        geo.computeVertexNormals();
        const uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + p.getZ(i)) * 1.5; uv[i * 2 + 1] = p.getY(i) * 1.5; }
        geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        mesh(geo, M.sandstone, g);
        const panel = mesh(new RoundedBoxGeometry(.23, .13, .02, 2, .008), M.grille, g, 0, .19, .27);
        panel.rotation.x = -.12;
        bpos = new THREE.Vector3(.02, .41, .08); bdir = new THREE.Vector3(0, 1, .25);
        break;
      }
      case 'arch': {                                        // a box speaker bolted to the top of a rose arch
        const s = new THREE.Group(); s.position.y = sp.y; g.add(s);
        boxSpeaker(s, .19, .27, .17);
        for (const x of [-.11, .11]) mesh(new THREE.BoxGeometry(.012, .2, .04), M.alu, s, x, -.12, -.02);
        mesh(new THREE.BoxGeometry(.24, .015, .08), M.alu, s, 0, -.215, -.02);
        bpos = new THREE.Vector3(0, sp.y - .115, .07); bdir = new THREE.Vector3(0, -.3, 1);
        break;
      }
      case 'lantern': {                                     // a granite tōrō with a speaker where the flame would be
        const hex = (r, h, y, r2 = r) => mesh(new THREE.CylinderGeometry(r2, r, h, 6), M.granite, g, 0, y + h / 2, 0);
        hex(.34, .14, 0, .3); hex(.12, .5, .14, .1); hex(.2, .1, .64, .27);
        hex(.2, .3, .74, .2);
        const roof = new THREE.LatheGeometry([[0, .34], [.2, .28], [.34, .16], [.42, .04], [.43, 0], [.2, 0], [0, 0]].reverse().map(([x, y]) => new THREE.Vector2(x, y)), 6);
        mesh(roof, M.granite, g, 0, 1.04, 0);
        mesh(new THREE.SphereGeometry(.07, 16, 12).scale(1, 1.25, 1), M.granite, g, 0, 1.42, 0);
        mesh(new THREE.CylinderGeometry(.045, .06, .05, 12), M.granite, g, 0, 1.36, 0);
        // the openings, with grilles set in
        for (let i = 0; i < 6; i++) {
          if (i % 2) continue;
          const a = i / 6 * TAU + Math.PI / 6, w = mesh(new THREE.PlaneGeometry(.13, .18), M.grille, g, Math.sin(a) * .176, .89, Math.cos(a) * .176);
          w.rotation.y = a;
        }
        // the button sits on the front-left face of the fire box
        bdir = new THREE.Vector3(-.5, 0, .866); bpos = bdir.clone().multiplyScalar(.176).setY(.84);
        break;
      }
      case 'tree': {                                        // strapped to a cherry trunk, pointing at the chair
        const s = new THREE.Group(); s.position.y = sp.y; g.add(s);
        boxSpeaker(s, .18, .26, .16);
        mesh(new THREE.TorusGeometry(.2, .012, 6, 32).rotateX(Math.PI / 2).scale(1, 1, 1.1), M.strap, s, 0, .03, -.2);
        mesh(new THREE.BoxGeometry(.2, .03, .1), M.alu, s, 0, .03, -.11);
        bpos = new THREE.Vector3(0, sp.y - .11, .065); bdir = new THREE.Vector3(0, -.35, 1);
        break;
      }
      case 'stump': {                                       // a sawn oak stump hiding a big low driver
        const prof = [[0, .52], [.3, .52], [.33, .5], [.34, .3], [.36, .12], [.44, .04], [.52, 0], [0, 0]];
        const lathe = new THREE.LatheGeometry(prof.reverse().map(([x, y]) => new THREE.Vector2(x, y)), 28);
        const p = lathe.attributes.position;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(z, x), k = 1 + (y < .15 ? .18 * Math.max(0, Math.sin(a * 5 + 1)) * (.15 - y) / .15 : 0) + .03 * Math.sin(a * 9); p.setX(i, x * k); p.setZ(i, z * k); }
        lathe.computeVertexNormals();
        mesh(lathe, M.stump, g);
        mesh(new THREE.CircleGeometry(.305, 40).rotateX(-Math.PI / 2), M.rings, g, 0, .523, 0);
        const ring = mesh(new THREE.TorusGeometry(.14, .012, 8, 36), M.black, g, 0, .27, .33);
        ring.rotation.x = -.08;
        const cone = mesh(new THREE.CircleGeometry(.135, 36), M.grille, g, 0, .27, .335);
        cone.rotation.x = -.08;
        bpos = new THREE.Vector3(0, .53, .2);
        break;
      }
      case 'pendant': {                                     // a pendant speaker on a cable from the pergola
        const s = new THREE.Group(); s.position.y = sp.y; g.add(s);
        mesh(new THREE.CylinderGeometry(.004, .004, 2.72 - sp.y - .12, 6), M.black, s, 0, (2.72 - sp.y + .12) / 2, 0);
        mesh(new THREE.CylinderGeometry(.06, .1, .06, 32), M.body, s, 0, .09, 0);
        mesh(new THREE.CylinderGeometry(.1, .1, .12, 32), M.body, s, 0, 0, 0);
        const gm = M.grille.clone(); gm.map = grilleMap.clone(); gm.map.repeat.set(4, .6); gm.map.needsUpdate = true;
        mesh(new THREE.CylinderGeometry(.101, .101, .07, 40, 1, true), gm, s, 0, -.02, 0);
        mesh(new THREE.CircleGeometry(.1, 32).rotateX(Math.PI / 2), M.grille, s, 0, -.061, 0);
        bpos = new THREE.Vector3(0, sp.y + .035, .1); bdir = new THREE.Vector3(0, 0, 1);
        break;
      }
      case 'post': {                                        // a lamp-post with a speaker for a lantern
        mesh(new THREE.BoxGeometry(.15, .06, .15), M.black, g, 0, .03, 0);
        mesh(new THREE.BoxGeometry(.065, 1.8, .065), M.black, g, 0, .93, 0);
        const s = new THREE.Group(); s.position.y = sp.y; g.add(s);
        mesh(new THREE.CylinderGeometry(.075, .065, .05, 24), M.black, s, 0, -.14, 0);
        const gm = M.grille.clone(); gm.map = grilleMap.clone(); gm.map.repeat.set(4, 1); gm.map.needsUpdate = true;
        mesh(new THREE.CylinderGeometry(.095, .095, .2, 40, 1, true), gm, s, 0, 0, 0);
        mesh(new THREE.CylinderGeometry(.1, .1, .02, 32), M.black, s, 0, -.1, 0);
        const hat = new THREE.LatheGeometry([[0, .19], [.03, .185], [.1, .13], [.14, .1], [.14, .09], [.1, .1], [0, .1]].reverse().map(([x, y]) => new THREE.Vector2(x, y)), 32);
        mesh(hat, M.black, s, 0, 0, 0);
        bpos = new THREE.Vector3(0, sp.y - .115, .07); bdir = new THREE.Vector3(0, -.2, 1);
        break;
      }
    }
    const b = button(g, bpos, bdir);
    scene.add(g);
    const color = new THREE.Color(PART[sp.part].color), amber = new THREE.Color(0xffa040);
    const phase = Math.random() * TAU;
    const s = {
      sp, group: g, button: b, hit: b.hit, on: false, lit: 0,
      where: new THREE.Vector3(),                            // the button, in the world
      update(t, level, dt) {
        this.lit += ((this.on ? 1 : 0) - this.lit) * Math.min(1, dt * 3);
        const breathe = this.on ? .75 + Math.min(1, level * 9) * .6 : .45 + .35 * Math.sin(t * 1.6 + phase) ** 2;
        b.ledMat.color.copy(amber).lerp(color, this.lit).multiplyScalar(breathe * (this.on ? 1.6 : .85));
        b.glow.material.color.copy(b.ledMat.color);
        b.glow.material.opacity = this.on ? .55 + Math.min(.4, level * 6) : .32;
        b.glow.scale.setScalar(this.on ? .2 + Math.min(.12, level * 1.5) : .14);
        if (this.pressT > 0) { this.pressT -= dt; b.ledMat.color.multiplyScalar(1.8); }
      },
      press() { this.pressT = .15; },
    };
    g.updateMatrixWorld(true);
    b.group.getWorldPosition(s.where);
    out.push(s);
  }
  // merge the speakers' bodies (not their buttons, which light up one by one)
  const skip = new Set(); for (const s of out) skip.add(s.button.led).add(s.button.glow).add(s.button.hit);
  const all = new THREE.Group(); for (const s of out) { scene.remove(s.group); all.add(s.group); }
  scene.add(all); bake(all, skip);
  for (const s of out) s.button.group.getWorldPosition(s.where);
  return out;
}
