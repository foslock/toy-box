// Rigged Racer: the scenery round each track, in its own colours and light: the Dustbowl's grandstand, cacti and
// windmill; the Scrapyard's crushed cars and tyre mountains; the Canyon's mesas, rope bridge and hawks; the
// Refinery's tanks, pumpjacks and flare stacks. What stands still is baked into one mesh (one draw, one outline);
// what moves (tumbleweeds, vultures, crowds, pumpjacks, flames) is kept apart and animated each frame.
import * as THREE from 'three';
import { point, sampleAt } from './track.js';
import { toon, part, G, Batch, at, rand, labelTexture, makeFlame } from './models.js';

export const LOOKS = {
  dust: {
    sand: '#e9b66c', sand2: '#dca25a', ripple: '#c98b46', crack: '#b8753c', shoulder: '#c48a52', dust: '#e8c48e',
    road: '#a77246', road2: '#8a5a36', paint: '#f4e7c6', curbA: '#d23a2c', curbB: '#f4e7c6',
    sky: '#ffdcae', bounce: '#8a4a2e', hemiI: 1.05, sun: '#fff0d0', sunI: 2.5, sunDir: [-.55, 1, .45], haze: '#f0c78c', cracks: 0.68,
  },
  scrap: {
    sand: '#bf9466', sand2: '#ad8258', ripple: '#94704a', crack: '#7e5c3c', shoulder: '#8e6e50', dust: '#c8a882',
    road: '#7d6450', road2: '#64503f', paint: '#efe3c8', curbA: '#e2a51e', curbB: '#2a2522',
    sky: '#f3d8b8', bounce: '#5e4434', hemiI: 1.0, sun: '#fff0d8', sunI: 2.4, sunDir: [.5, 1, .5], haze: '#d8b48a', cracks: 0.80, ripples: .5,
  },
  canyon: {
    sand: '#dd8c58', sand2: '#cc7a4a', ripple: '#b4663c', crack: '#a45a34', shoulder: '#bb7446', dust: '#e6a878',
    road: '#a8683e', road2: '#8a522e', paint: '#f6e4c6', curbA: '#f2efe4', curbB: '#3a2a22',
    sky: '#ffd2a8', bounce: '#7a3422', hemiI: 1.0, sun: '#fff0d6', sunI: 2.6, sunDir: [-.4, 1, .6], haze: '#eda878', cracks: 0.72,
    abyss: '#2e140e', cliff: '#9a4a2c',
  },
  refinery: {
    sand: '#c49064', sand2: '#b07e56', ripple: '#94643e', crack: '#7a5236', shoulder: '#80604a', dust: '#c8a07a',
    road: '#6e5a4e', road2: '#56463c', paint: '#ffd23a', curbA: '#ffd23a', curbB: '#2a2522',
    sky: '#ffb58a', bounce: '#5a2e3a', hemiI: 1.1, sun: '#ffc48a', sunI: 2.3, sunDir: [.75, .8, .25], haze: '#e09a70', cracks: 0.76, ripples: .4,
  },
};

const SIGNS = {
  dust: ['DUSTBOWL', 'EAT DUST', 'NO REFUNDS', 'WATER 5¢'],
  scrap: ['SCRAP', 'WE BUY CARS', 'BEWARE OF DOG', 'TYRES'],
  canyon: ['RATTLESNAKE', 'DON’T LOOK DOWN', 'FALLING ROCKS', 'BRIDGE 1 AT A TIME'],
  refinery: ['NO SMOKING', 'REFINERY ROW', 'GAS', 'DANGER'],
};

export function buildDecor(world, T, L) {
  const theme = T.def.theme, F = world.field, R = rand(T.main.L * 100 | 0);
  const B = new Batch(), anim = [], meshes = [], spots = [];
  const main = T.main;
  // somewhere free: far enough from the road and from the other big things
  const free = (x, z, r, road = r) => {
    if (F.at(x, z) < road || F.chasmAt(x, z) < 3.6) return false;
    for (const s of spots) if (Math.hypot(s[0] - x, s[1] - z) < s[2] + r) return false;
    return true;
  };
  const claim = (x, z, r) => spots.push([x, z, r]);
  const { x0, x1, z0, z1 } = T.box;
  const scatter = (n, r, road, fn, reach = 22) => {
    let tries = n * 30;
    while (n > 0 && tries-- > 0) {
      const x = x0 - reach + R() * (x1 - x0 + 2 * reach), z = z0 - reach + R() * (z1 - z0 + 2 * reach);
      if (!free(x, z, r, road)) continue;
      claim(x, z, r); fn(x, z, R); n--;
    }
  };
  /* ---------- along the road: barriers ---------- */
  const bridge = T.def.bridge ? [T.def.bridge[0] * main.L, T.def.bridge[1] * main.L] : null;
  for (const p of T.paths) {
    for (const sd of [-1, 1]) {
      const gap = theme === 'canyon' ? 1.6 : theme === 'refinery' ? 1.25 : 1;
      for (let s = .5; s < p.L - (p.closed ? 0 : .5); s += gap) {
        const [i] = sampleAt(p, s), off = sd < 0 ? p.lo[i] - .38 : p.hi[i] + .38;
        const q = point(p, s, off), yaw = Math.atan2(-q.tx, -q.tz);
        if (F.at(q.x, q.z) < .3) continue;                          // another road runs here (a fork, or a join)
        if (p.id === 0 && (s < 1.2 || s > p.L - 1.2)) continue;     // the start line
        if (p.id === 0 && bridge && s > bridge[0] - .2 && s < bridge[1] + .2) {
          // the rope bridge: posts at its ends and every few metres, with the ropes along it
          if ((s - bridge[0]) % 2.4 < gap) { B.add(G.cyl6, '#6b4a2c', at(q.x, .45, q.z, 0, 0, .06, .9, .06)); }
          continue;
        }
        barrier(B, theme, q.x, q.z, yaw, R, s, sd);
      }
    }
  }
  // the bridge's ropes
  if (bridge) {
    for (const sd of [-1, 1]) {
      const pts = [];
      for (let s = bridge[0] - .2; s <= bridge[1] + .2; s += .5) { const [i] = sampleAt(main, s), q = point(main, s, sd < 0 ? main.lo[i] - .38 : main.hi[i] + .38); pts.push(new THREE.Vector3(q.x, .62 - Math.sin((s - bridge[0]) / (bridge[1] - bridge[0]) * Math.PI) * .25, q.z)); }
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, .025, 5), toon('#d8c08a'));
      meshes.push(m);
    }
  }

  /* ---------- the start: a gantry over the line, with the lights ---------- */
  {
    const [i] = sampleAt(main, 0), a = point(main, 0, main.lo[i] - .7), b = point(main, 0, main.hi[i] + .7), yaw = Math.atan2(-a.tx, -a.tz);
    const metal = theme === 'refinery' ? '#ffd23a' : '#6b4a2c';
    for (const q of [a, b]) { B.add(G.box, metal, at(q.x, 1.4, q.z, yaw, 0, .22, 2.8, .22)); B.add(G.box, '#3a2a22', at(q.x, .1, q.z, yaw, 0, .5, .2, .5)); claim(q.x, q.z, 1); }
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, w = Math.hypot(b.x - a.x, b.z - a.z);
    const banner = labelTexture((c, W, H) => {
      c.fillStyle = '#1e1612'; c.fillRect(0, 0, W, H);
      for (let k = 0; k < 16; k++) for (let j = 0; j < 2; j++) { c.fillStyle = (k + j) % 2 ? '#f4e7c6' : '#1e1612'; c.fillRect(k * W / 16, j * 14, W / 16, 14); }
      c.fillStyle = '#ffd23a'; c.font = '700 44px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(T.def.name.toUpperCase(), W / 2, H / 2 + 16);
    }, 512, 96);
    const ban = new THREE.Mesh(new THREE.BoxGeometry(w, .62, .08), [toon('#2a1e18'), toon('#2a1e18'), toon('#2a1e18'), toon('#2a1e18'), toon('#ffffff', { params: { map: banner }, unique: true }), toon('#ffffff', { params: { map: banner }, unique: true })]);
    ban.position.set(mx, 2.55, mz); ban.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x); ban.castShadow = true;
    meshes.push(ban);
    // five lamps for the count down, on the banner's side facing the karts
    const lamps = [];
    for (let k = 0; k < 5; k++) {
      const f = (k - 2) * .4, lx = mx + (b.x - a.x) / w * f, lz = mz + (b.z - a.z) / w * f;
      const lamp = new THREE.Mesh(G.bead, toon('#3a2222', { unique: true, emissive: '#000000' }));
      lamp.scale.setScalar(.14); lamp.position.set(lx, 2.95, lz);
      meshes.push(lamp); lamps.push(lamp);
    }
    world.lamps = lamps;
  }

  /* ---------- each theme's big pieces ---------- */
  const startOut = (s, off) => { const [i] = sampleAt(main, s); return point(main, s, main.hi[i] + off); };
  // the middle of the infield: the point furthest from any road, inside the track's box
  // (inside the loop: an odd number of the loop's edges cross a ray from the point)
  const inLoop = (x, z) => {
    let inside = false;
    for (let i = 0, j = main.count - 1; i < main.count; j = i++) {
      const xi = main.x[i], zi = main.z[i], xj = main.x[j], zj = main.z[j];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
  let mid = null;
  for (let i = 0; i < 600; i++) {
    const x = x0 + 4 + R() * (x1 - x0 - 8), z = z0 + 4 + R() * (z1 - z0 - 8), d = F.at(x, z);
    if (inLoop(x, z) && (!mid || d > mid.d)) mid = { x, z, d };
  }
  const landmark = (r, fn) => { if (mid && mid.d > r * .6) { const rr = Math.min(r, mid.d - 1.2); claim(mid.x, mid.z, rr + .5); fn(mid.x, mid.z, rr); } };
  if (theme === 'dust') {
    grandstand(B, meshes, anim, main, startOut, claim, R);
    landmark(5, (x, z, r) => bigSkull(B, x, z, r));
    scatter(1, 2.5, 6, (x, z) => windmill(B, meshes, anim, x, z), 14);
    scatter(1, 2.2, 6, (x, z) => waterTower(B, x, z), 14);
    scatter(5, 1.8, 3.5, (x, z, r) => wreck(B, x, z, r));
    scatter(44, .8, 2.2, (x, z, r) => cactus(B, x, z, r));
    scatter(26, .6, 1.8, (x, z, r) => rocks(B, x, z, r, '#c8945c', '#a8743e'));
    scatter(14, .5, 1.6, (x, z, r) => skull(B, x, z, r));
    scatter(12, .7, 2.5, (x, z, r) => deadTree(B, x, z, r));
    scatter(4, 1.4, 4, (x, z, r) => sign(B, meshes, x, z, r, SIGNS.dust));
    tumbleweeds(meshes, anim, T, R, 6);
    vultures(meshes, anim, T, R, 4);
    dustDevil(world, anim, T, R, free);
  } else if (theme === 'scrap') {
    grandstand(B, meshes, anim, main, startOut, claim, R);
    landmark(6, (x, z, r) => junkMountain(B, meshes, anim, x, z, r, R));
    // the shortcut runs through a canyon of crushed cars
    for (const b of T.paths.slice(1)) for (let s = 4; s < b.L - 4; s += 1.7) for (const sd of [-1, 1]) {
      const q = point(b, s, sd * 1.75);
      if (F.at(q.x, q.z) < 1.2) continue;
      const yaw = Math.atan2(-q.tx, -q.tz), n = 2 + ((s * 7 | 0) % 3);
      for (let k = 0; k < n; k++) B.add(G.rbox, ['#8a3a2a', '#3d6a8a', '#c8a03a', '#4a6a3a', '#7a7a80', '#a85a2a'][(s * 13 + k * 5 | 0) % 6], at(q.x, .22 + k * .42, q.z, yaw + (R() - .5) * .25, 0, .9, .4, 1.6));
      claim(q.x, q.z, .9);
    }
    scatter(36, 1.5, 2.4, (x, z, r) => carStack(B, x, z, r));
    scatter(18, 1.3, 2.4, (x, z, r) => tyrePile(B, x, z, r));
    scatter(2, 2.4, 5, (x, z) => crusher(B, meshes, anim, x, z), 14);
    scatter(4, 1.6, 4, (x, z, r) => shack(B, meshes, anim, x, z, r, world));
    scatter(8, .7, 2.2, (x, z) => fireBarrel(B, meshes, anim, x, z, world));
    scatter(1, 1, 3, (x, z) => dog(B, meshes, anim, x, z), 12);
    scatter(40, .4, 1.4, (x, z, r) => scrapBits(B, x, z, r));
    scatter(4, 1.4, 4, (x, z, r) => sign(B, meshes, x, z, r, SIGNS.scrap));
    vultures(meshes, anim, T, R, 3);
  } else if (theme === 'canyon') {
    landmark(7, (x, z, r) => mesa(B, x, z, () => .5, Math.max(2.5, r * .8), 3.2));
    scatter(14, 4.5, 6, (x, z, r) => mesa(B, x, z, r), 26);
    scatter(12, 1, 2.6, (x, z, r) => hoodoo(B, x, z, r));
    scatter(1, 2.5, 4, (x, z, r) => arch(B, x, z, r), 16);
    scatter(28, 1.2, 2.4, (x, z, r) => rocks(B, x, z, r, '#c8744a', '#a85e36', 2));
    scatter(26, .8, 2.2, (x, z, r) => cactus(B, x, z, r));
    scatter(8, .6, 1.6, (x, z, r) => skull(B, x, z, r));
    scatter(1, 1.6, 3, (x, z, r) => wagon(B, x, z, r), 12);
    scatter(3, 1.4, 4, (x, z, r) => sign(B, meshes, x, z, r, SIGNS.canyon));
    scatter(4, .8, 2.4, (x, z) => snake(B, meshes, anim, x, z), 10);
    grandstand(B, meshes, anim, main, startOut, claim, R);
    vultures(meshes, anim, T, R, 4, '#5a3a2a');
    tumbleweeds(meshes, anim, T, R, 3);
  } else if (theme === 'refinery') {
    grandstand(B, meshes, anim, main, startOut, claim, R);
    landmark(6, (x, z, r) => crackingTower(B, meshes, anim, x, z, r, world));
    scatter(10, 3, 4.5, (x, z, r) => tank(B, meshes, anim, x, z, r), 22);
    scatter(6, 1.8, 3.5, (x, z) => pumpjack(B, meshes, anim, x, z), 16);
    scatter(4, 1.2, 4, (x, z) => chimney(B, anim, x, z, world), 18);
    scatter(2, 1.2, 4, (x, z) => flareDecor(B, meshes, anim, x, z, world), 14);
    scatter(10, 1, 2.2, (x, z, r) => puddle(meshes, x, z, r));
    scatter(16, .8, 2, (x, z, r) => drums(B, x, z, r));
    scatter(3, 1.4, 4, (x, z, r) => sign(B, meshes, x, z, r, SIGNS.refinery));
    pipes(B, T);
    // pipe racks along the outside of the loop
    for (let s = 6; s < main.L - 6; s += 1.6) {
      if ((s / main.L) % .25 > .14) continue;
      const [i] = sampleAt(main, s), q = point(main, s, main.hi[i] + 2.2);
      if (F.at(q.x, q.z) < 1.6 || !free(q.x, q.z, .3, 1.6)) continue;
      const yaw = Math.atan2(-q.tx, -q.tz);
      B.add(G.box, '#5a5a62', at(q.x, .6, q.z, yaw, 0, 1.2, .08, .08));
      for (const sd of [-1, 1]) B.add(G.box, '#5a5a62', at(q.x + q.tz * sd * .55, .3, q.z - q.tx * sd * .55, yaw, 0, .07, .6, .07));
      for (const [o, c] of [[-.3, '#c8c0b4'], [0, '#8a8a90'], [.3, '#c8352b']]) B.add(G.cyl, c, at(q.x - q.tz * o, .78, q.z + q.tx * o, yaw, Math.PI / 2, .13, 1.7, .13));
    }
  }
  const m = B.mesh();
  if (m) meshes.push(m);
  return { meshes, anim };
}

/* ---------- the pieces ---------- */
function bigSkull(B, x, z, r) {
  // a giant cow skull, half sunk in the sand, with a ring of stones round it
  const k = Math.min(1.6, r / 3.2), c = '#f1e6cc', d = '#d8c8a4';
  B.add(G.bead, c, at(x, .4 * k, z, 0, 0, 1.5 * k, 1.05 * k, 1.9 * k));
  B.add(G.bead, c, at(x, .3 * k, z - 1.9 * k, 0, 0, .8 * k, .62 * k, 1.1 * k));
  for (const sd of [-1, 1]) {
    B.add(G.bead, '#2a1e18', at(x + sd * .62 * k, .95 * k, z - .7 * k, 0, 0, .38 * k, .3 * k, .32 * k));
    B.add(G.cone, c, at(x + sd * 1.75 * k, 1.1 * k, z + .2 * k, 0, 0, .28 * k, 1.9 * k, .28 * k, sd * 1.05));
    B.add(G.cone, d, at(x + sd * 2.55 * k, 1.85 * k, z + .2 * k, 0, 0, .16 * k, .7 * k, .16 * k, sd * .3));
    B.add(G.bead, '#2a1e18', at(x + sd * .22 * k, .5 * k, z - 2.75 * k, 0, 0, .12 * k, .1 * k, .08 * k));
  }
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; B.add(G.stone, i % 2 ? '#b8854e' : '#a07040', at(x + Math.cos(a) * 3.1 * k, .2, z + Math.sin(a) * 3.1 * k, a, .3, .35, .28, .35)); }
}
function junkMountain(B, meshes, anim, x, z, r, R) {
  // crushed cars piled into a hill, and a crane on top swinging one more round
  const cols = ['#8a3a2a', '#3d6a8a', '#c8a03a', '#4a6a3a', '#7a7a80', '#a85a2a', '#5a4a6a', '#2e5a5a'];
  const layers = 4;
  for (let l = 0; l < layers; l++) {
    const rr = r * (1 - l / layers) * .95, n = Math.max(1, Math.round(rr * 2.2));
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.28 + l, d = rr * (.35 + R() * .6);
      B.add(G.rbox, cols[(R() * cols.length) | 0], at(x + Math.cos(a) * d, .22 + l * .4, z + Math.sin(a) * d, R() * 6, (R() - .5) * .3, .9, .4, 1.6, (R() - .5) * .3));
    }
  }
  const top = layers * .4;
  B.add(G.box, '#e2a51e', at(x, top + 1.4, z, 0, 0, .3, 2.8, .3));
  const arm = new THREE.Group(); arm.position.set(x, top + 2.8, z); meshes.push(arm);
  arm.add(part(G.box, toon('#e2a51e'), [1.4, 0, 0], [3.2, .2, .2]));
  arm.add(part(G.box, toon('#5a5a62'), [-.4, 0, 0], [.6, .45, .45]));
  arm.add(part(G.cyl6, toon('#222', { line: 0 }), [2.8, -.7, 0], [.02, 1.4, .02]));
  const car = part(G.rbox, toon('#3d6a8a'), [2.8, -1.55, 0], [.9, .4, 1.6]); arm.add(car);
  anim.push((dt, time) => { arm.rotation.y = Math.sin(time * .35) * 1.4; car.rotation.y = Math.sin(time * 1.3) * .2; });
}
function scrapBits(B, x, z, R) {
  const c = ['#7a7a80', '#8a3a2a', '#5a5a62', '#a85a2a', '#3a3a3a'];
  const n = 1 + (R() * 3 | 0);
  for (let i = 0; i < n; i++) {
    const k = R();
    if (k < .3) B.add(G.torus, '#2e2824', at(x + (R() - .5) * .6, .07, z + (R() - .5) * .6, R() * 6, Math.PI / 2, .17, .17, .17));
    else if (k < .6) B.add(G.box, c[(R() * c.length) | 0], at(x + (R() - .5) * .6, .05, z + (R() - .5) * .6, R() * 6, (R() - .5) * .4, .5, .05, .35));
    else B.add(G.cyl, c[(R() * c.length) | 0], at(x + (R() - .5) * .6, .12, z + (R() - .5) * .6, R() * 6, Math.PI / 2, .1, .5, .1));
  }
}
function hoodoo(B, x, z, R) {
  // a tall stack of balanced rocks
  const n = 3 + (R() * 3 | 0), cols = ['#c8693a', '#b45a32', '#d47a46', '#a85030'];
  let y = 0;
  for (let i = 0; i < n; i++) { const s = .55 - i * .06 + R() * .15, h = s * (.9 + R() * .5); B.add(G.stone, cols[i % cols.length], at(x + (R() - .5) * .1, y + h * .5, z + (R() - .5) * .1, R() * 6, (R() - .5) * .2, s, h * .6, s)); y += h * .85; }
  B.add(G.stone, '#e0a070', at(x, y + .2, z, R() * 6, 0, .6, .25, .6));
}
function arch(B, x, z, R) {
  // a natural stone arch
  const yaw = R() * 6.28, cols = ['#c8693a', '#b45a32', '#d47a46'];
  for (let i = 0; i <= 12; i++) {
    const a = i / 12 * Math.PI, px = Math.cos(a) * 2.6, py = Math.sin(a) * 2.4;
    B.add(G.stone, cols[i % 3], at(x + Math.cos(yaw) * px, py + .4, z - Math.sin(yaw) * px, yaw + i, i * .4, .75, .65, .75));
  }
}
function wagon(B, x, z, R) {
  // a broken covered wagon
  const yaw = R() * 6.28;
  B.add(G.box, '#7a5232', at(x, .45, z, yaw, 0, 1, .35, 2));
  B.add(new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, 0, Math.PI), '#efe2c4', at(x, .62, z, yaw, Math.PI / 2, .55, 1.7, .55, Math.PI / 2));
  for (const [dx, dz] of [[-.55, -.7], [.55, -.7], [-.55, .7]]) B.add(G.torus, '#5a3a22', at(x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, .32, z - Math.sin(yaw) * dx + Math.cos(yaw) * dz, yaw + Math.PI / 2, 0, .32, .32, .32));
  B.add(G.torus, '#5a3a22', at(x + Math.cos(yaw) * .7 + Math.sin(yaw) * .9, .06, z - Math.sin(yaw) * .7 + Math.cos(yaw) * .9, yaw, Math.PI / 2, .32, .32, .32));
}
function crackingTower(B, meshes, anim, x, z, r, world) {
  // the refinery's tall column, ringed with platforms, piped to its tanks, a red light blinking on top
  const h = 9;
  B.add(G.cyl, '#d8d0c4', at(x, h / 2, z, 0, 0, .9, h, .9));
  for (let y = 1.5; y < h; y += 1.5) { B.add(G.cyl, '#5a5a62', at(x, y, z, 0, 0, 1.35, .08, 1.35)); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; B.add(G.box, '#ffd23a', at(x + Math.cos(a) * 1.3, y + .25, z + Math.sin(a) * 1.3, -a, 0, .04, .5, .04)); } }
  B.add(G.cone, '#c8c0b4', at(x, h + .4, z, 0, 0, .9, .8, .9));
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + .4, d = Math.min(r, 4.2), tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d;
    B.add(G.cyl, i % 2 ? '#e8e2d6' : '#c8c2b8', at(tx, 1.1, tz, 0, 0, 1.1, 2.2, 1.1));
    B.add(G.cyl, '#c8352b', at(tx, 1.6, tz, 0, 0, 1.11, .18, 1.11));
    B.add(G.cyl, '#8a8a90', at((x + tx) / 2, 1.8 + i * .3, (z + tz) / 2, -a, 0, .12, d, .12, Math.PI / 2));
  }
  const light = new THREE.Mesh(G.bead, toon('#ff3a2a', { emissive: '#ff2a1d', glow: 1.4, unique: true }));
  light.scale.setScalar(.18); light.position.set(x, h + .9, z); meshes.push(light);
  const st = { t: 0 };
  anim.push((dt, time) => { light.visible = (time % 1.2) < .6; st.t += dt; if (st.t > .5) { st.t = 0; world.puff(x + .6, h - 1, z, { color: '#efe8e0', n: 1, up: 1, speed: .4, life: 1.6, s0: 1.2, s1: 3, a: .5, drag: .5 }); } });
}
function flareDecor(B, meshes, anim, x, z, world) {
  for (let i = 0; i < 5; i++) B.add(G.cyl, i % 2 ? '#c8352b' : '#efe9dc', at(x, .35 + i * .7, z, 0, 0, .2, .7, .2));
  const f = makeFlame(3); f.position.set(x, 3.6, z); meshes.push(f);
  anim.push((dt, time) => { const s = 1 + Math.sin(time * 13 + x) * .12 + Math.random() * .12; f.scale.set(s, s * (1 + Math.random() * .25), s); if (dt > 0 && Math.random() < .05) world.puff(x, 4.6, z, { color: '#3a3030', n: 1, up: 1.4, life: 1.6, s0: 1.4, s1: 3.5, a: .5, drag: .4 }); });
}
function barrier(B, theme, x, z, yaw, R, s, sd) {
  if (theme === 'dust' || theme === 'scrap') {
    // stacks of old tyres, now and then a drum or a stake
    const k = Math.floor(s) % 9;
    if (theme === 'dust' && k === 4) { B.add(G.cyl, '#c8352b', at(x, .24, z, yaw, 0, .16, .48, .16)); B.add(G.cyl, '#f2c230', at(x, .3, z, yaw, 0, .162, .07, .162)); return; }
    if (theme === 'scrap' && k === 2) { B.add(G.rbox, ['#5a7a8a', '#8a3a2a', '#c8a03a', '#4a6a3a'][Math.floor(s / 9) % 4], at(x, .22, z, yaw + .2, 0, .5, .44, .8)); return; }
    const n = 2 + (Math.floor(s * 7) % 2);
    for (let i = 0; i < n; i++) B.add(G.torus, i % 2 ? '#2e2824' : '#3a332e', at(x, .09 + i * .15, z, R() * 6, Math.PI / 2, .17, .17, .17));
    if (theme === 'dust' && (Math.floor(s * 3) % 5 === 0)) B.add(G.cyl, '#f2c230', at(x, .09 + n * .15, z, 0, 0, .1, .02, .1));
  } else if (theme === 'canyon') {
    // boulders and fence posts
    if (Math.floor(s) % 3 === 0) { B.add(G.cyl6, '#7a5232', at(x, .35, z, yaw, 0, .06, .7, .06)); B.add(G.box, '#8a6240', at(x, .5, z, yaw, 0, .05, .05, 1.6)); }
    else B.add(G.stone, R() < .5 ? '#b0603a' : '#9a5232', at(x, .18, z, R() * 6, R(), .26 + R() * .1, .2 + R() * .1, .26 + R() * .1));
  } else {
    // concrete barriers, striped
    B.add(G.box, '#c8c0b4', at(x, .2, z, yaw, 0, .3, .4, 1.1));
    B.add(G.box, Math.floor(s) % 2 ? '#ffd23a' : '#2a2522', at(x, .32, z, yaw, 0, .31, .1, 1.11));
  }
}

function grandstand(B, meshes, anim, main, startOut, claim, R) {
  // tiered benches on the outside of the start straight, with a tin roof, flags and a crowd that bounces
  const s0 = main.L - 9, len = 14;
  const rows = [];
  for (let s = s0; s < s0 + len; s += 1.2) {
    const ss = s % main.L;
    for (let t = 0; t < 3; t++) {
      const q = startOut(ss, 3 + t * .9), yaw = Math.atan2(-q.tx, -q.tz);
      const h = .5 + t * .45;
      B.add(G.box, '#7a5a3a', at(q.x, h / 2, q.z, yaw, 0, .8, h, 1.25));
      B.add(G.box, '#a07a4e', at(q.x, h + .03, q.z, yaw, 0, .82, .06, 1.26));
      rows[t] ||= [];
      for (let k = 0; k < 2; k++) if (R() < .85) rows[t].push([q.x - q.tx * (k - .5) * .55 + q.tz * 0, .8 + t * .45, q.z - q.tz * (k - .5) * .55, R()]);
    }
    if (Math.round((s - s0) / 1.2) % 4 === 0) {
      // a striped parasol now and then, over the top tier
      const q = startOut(ss, 4.9);
      B.add(G.cyl6, '#5a5a5a', at(q.x, 1.9, q.z, 0, 0, .04, 2.2, .04));
      const col = Math.round((s - s0) / 1.2) % 8 ? '#d23a2c' : '#f2c230';
      B.add(G.cone, col, at(q.x, 3.02, q.z, R() * 6, 0, .48, .32, .48));
      B.add(G.bead, '#efe6cf', at(q.x, 3.2, q.z, 0, 0, .06));
    }
    claim(startOut(ss, 4).x, startOut(ss, 4).z, 1.6);
  }
  // the crowd: a row of heads per tier, bobbing in turn
  const cols = ['#f2c49b', '#c98a5a', '#8d5a3b', '#e8b48a', '#a8743e'];
  const shirts = ['#d23a2c', '#3d72b8', '#e7a92a', '#4f9e3c', '#9a5cc8', '#efe6cf', '#2a2522'];
  rows.forEach((row, t) => {
    const g = new Batch();
    for (const [x, y, z, r] of row) {
      g.add(G.bead, shirts[(r * 70 | 0) % shirts.length], at(x, y, z, 0, 0, .14, .16, .14));
      g.add(G.bead, cols[(r * 50 | 0) % cols.length], at(x, y + .2, z, 0, 0, .1));
      if (r < .3) g.add(G.cone, '#d23a2c', at(x, y + .32, z, 0, 0, .07, .12, .07));
      if (r > .8) g.add(G.box, shirts[(r * 13 | 0) % shirts.length], at(x + .1, y + .42, z, 0, 0, .02, .3, .02));
    }
    const m = g.mesh(); if (!m) return;
    meshes.push(m);
    anim.push((dt, time) => { m.position.y = Math.max(0, Math.sin(time * 9 + t * 1.3)) * .07; });
  });
  // flags along the roof
  for (let k = 0; k < 4; k++) {
    const q = startOut((s0 + 1 + k * 3.6) % main.L, 5.6), f = new THREE.Mesh(new THREE.PlaneGeometry(.6, .36, 6, 1), toon(['#d23a2c', '#f2c230', '#efe6cf', '#3d72b8'][k], { params: { side: THREE.DoubleSide }, line: 0, unique: true }));
    f.position.set(q.x, 2.3, q.z); meshes.push(f);
    const pole = new THREE.Mesh(G.cyl6, toon('#3a3a3a')); pole.scale.set(.03, 2.5, .03); pole.position.set(q.x - .3, 1.25, q.z); meshes.push(pole);
    const base = f.geometry.attributes.position.array.slice();
    anim.push((dt, time) => {
      const pa = f.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) { const x = base[i * 3]; pa.setZ(i, Math.sin(time * 6 + x * 6 + k) * .08 * (x + .3)); }
      pa.needsUpdate = true;
    });
  }
}

function cactus(B, x, z, R) {
  const h = 1 + R() * 1.4, g = R() < .5 ? '#5a9a46' : '#4e8a3e', r = .17 + R() * .06;
  B.add(G.cyl, g, at(x, h / 2, z, 0, 0, r, h, r));
  B.add(G.bead, g, at(x, h, z, 0, 0, r, r * .9, r));
  const arms = 1 + (R() * 2 | 0);
  for (let i = 0; i < arms; i++) {
    const a = R() * 6.28, y = h * (.35 + R() * .3), ax = x + Math.cos(a) * r * 2.2, az = z + Math.sin(a) * r * 2.2, ah = .3 + R() * .4;
    B.add(G.cyl, g, at((x + ax) / 2, y, (z + az) / 2, -a, 0, r * .7, r * 2.4, r * .7, Math.PI / 2));
    B.add(G.cyl, g, at(ax, y + ah / 2, az, 0, 0, r * .7, ah, r * .7));
    B.add(G.bead, g, at(ax, y + ah, az, 0, 0, r * .7));
  }
  if (R() < .3) B.add(G.bead, '#ff5a9a', at(x, h + r * .8, z, 0, 0, .07, .05, .07));
}
function rocks(B, x, z, R, c1, c2, big = 1) {
  const n = 1 + (R() * 3 | 0);
  for (let i = 0; i < n; i++) { const s = (.18 + R() * .3) * big; B.add(G.stone, i % 2 ? c2 : c1, at(x + (R() - .5) * .8 * big, s * .5, z + (R() - .5) * .8 * big, R() * 6, R(), s, s * (.6 + R() * .5), s)); }
}
function skull(B, x, z, R) {
  // a cow's skull, bleached
  const yaw = R() * 6.28, c = '#efe6cf';
  B.add(G.bead, c, at(x, .12, z, yaw, 0, .16, .12, .2));
  B.add(G.bead, c, at(x + Math.sin(yaw) * -.18, .08, z + Math.cos(yaw) * -.18, yaw, 0, .08, .07, .12));
  for (const sd of [-1, 1]) B.add(G.cone, c, at(x + Math.cos(yaw) * sd * .2, .2, z - Math.sin(yaw) * sd * .2, yaw, 0, .04, .26, .04, sd * 1.1));
  for (const sd of [-1, 1]) B.add(G.bead, '#2a1e18', at(x + Math.cos(yaw) * sd * .07 - Math.sin(yaw) * .14, .16, z - Math.sin(yaw) * sd * .07 - Math.cos(yaw) * .14, 0, 0, .035));
}
function deadTree(B, x, z, R) {
  const c = '#6b4a30', h = 1.2 + R() * .8;
  B.add(G.cyl6, c, at(x, h / 2, z, 0, 0, .09, h, .09));
  for (let i = 0; i < 4; i++) { const a = R() * 6.28, y = h * (.5 + R() * .45), l = .4 + R() * .5; B.add(G.cyl6, c, at(x + Math.cos(a) * l * .35, y + l * .25, z + Math.sin(a) * l * .35, -a, 0, .04, l, .04, .9)); }
}
function wreck(B, x, z, R) {
  // a burnt-out car, nose down in the sand
  const yaw = R() * 6.28, c = ['#8a4a2a', '#5a6a72', '#7a6a3a'][R() * 3 | 0];
  B.add(G.rbox, c, at(x, .3, z, yaw, .15, .9, .4, 1.7));
  B.add(G.rbox, c, at(x, .62, z + .1, yaw, .15, .8, .3, .8));
  B.add(G.box, '#2a2522', at(x, .66, z + .1, yaw, .15, .82, .14, .6));
  for (const [dx, dz] of [[-.45, -.5], [.45, .6]]) B.add(G.torus, '#2e2824', at(x + dx, .14, z + dz, yaw, Math.PI / 2, .16, .16, .16));
}
function waterTower(B, x, z) {
  for (const [dx, dz] of [[-.6, -.6], [.6, -.6], [-.6, .6], [.6, .6]]) B.add(G.box, '#6b4a2c', at(x + dx, 1.5, z + dz, 0, 0, .14, 3, .14));
  B.add(G.cyl, '#8a5a32', at(x, 3.6, z, 0, 0, 1.1, 1.3, 1.1));
  B.add(G.cone, '#5a3a22', at(x, 4.6, z, 0, 0, 1.2, .7, 1.2));
  for (const y of [3.2, 4]) B.add(G.cyl, '#3a2a22', at(x, y, z, 0, 0, 1.12, .06, 1.12));
}
function windmill(B, meshes, anim, x, z) {
  for (const [dx, dz] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) B.add(G.box, '#7a7a7a', at(x + dx * (1 - .1), 2, z + dz * (1 - .1), 0, 0, .08, 4, .08, dx * dz > 0 ? .1 : -.1));
  B.add(G.box, '#6a6a6a', at(x, 4.1, z, 0, 0, .3, .3, .5));
  const fan = new THREE.Group(); fan.position.set(x, 4.2, z - .35); meshes.push(fan);
  for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(G.box, toon(i % 2 ? '#d8d0c0' : '#c8352b')); b.scale.set(.18, 1.1, .03); const a = i / 12 * Math.PI * 2; b.position.set(Math.sin(a) * .6, Math.cos(a) * .6, 0); b.rotation.z = -a; b.castShadow = true; fan.add(b); }
  const tail = new THREE.Mesh(G.box, toon('#d8d0c0')); tail.scale.set(.04, .5, .9); tail.position.set(0, 0, .8); fan.add(tail);
  anim.push(dt => { fan.rotation.z += dt * 2.2; });
}
function sign(B, meshes, x, z, R, words) {
  const text = words[R() * words.length | 0], yaw = (R() - .5) * .8;
  for (const sd of [-1, 1]) B.add(G.box, '#6b4a2c', at(x + Math.cos(yaw) * sd * .9, .9, z - Math.sin(yaw) * sd * .9, yaw, 0, .1, 1.8, .1));
  const tex = labelTexture((c, w, h) => {
    c.fillStyle = '#e8d4a8'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(120,70,30,.25)'; for (let i = 0; i < 6; i++) c.fillRect(0, i * h / 6 + 6, w, 3);
    c.fillStyle = '#b8322a'; c.font = `700 ${text.length > 12 ? 30 : 46}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 3);
    c.strokeStyle = '#5a3a22'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
  }, 320, 96);
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.1, .66, .07), [toon('#8a6040'), toon('#8a6040'), toon('#8a6040'), toon('#8a6040'), toon('#ffffff', { params: { map: tex }, unique: true }), toon('#ffffff', { params: { map: tex }, unique: true })]);
  board.position.set(x, 1.55, z); board.rotation.y = yaw; board.rotation.z = (R() - .5) * .12; board.castShadow = true;
  meshes.push(board);
}
function tumbleweeds(meshes, anim, T, R, n) {
  const { x0, x1, z0, z1 } = T.box;
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.32, 1), toon('#b8925a', { params: { wireframe: true }, line: 0 }));
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.22, 0), toon('#a07a48'));
    g.add(m, core); meshes.push(g);
    const st = { x: x0 - 10 + R() * (x1 - x0 + 20), z: z0 + R() * (z1 - z0), v: 1.5 + R() * 1.5, ph: R() * 10 };
    anim.push((dt, time) => {
      st.x += st.v * dt; st.z += Math.sin(time * .7 + st.ph) * .3 * dt;
      if (st.x > x1 + 14) st.x = x0 - 14; else if (st.x < x0 - 14) st.x = x1 + 14;
      g.position.set(st.x, .3 + Math.abs(Math.sin(time * 3 + st.ph)) * .4, st.z);
      g.rotation.z -= st.v * dt / .3;
    });
  }
}
function vultures(meshes, anim, T, R, n, color = '#4a3326') {
  const { x0, x1, z0, z1 } = T.box, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group(), body = toon(color);
    g.add(part(G.bead, body, [0, 0, 0], [.18, .1, .3]));
    const wings = [-1, 1].map(sd => { const w = new THREE.Group(); w.position.x = sd * .12; w.add(part(G.bead, body, [sd * .45, 0, 0], [.5, .03, .18])); g.add(w); return w; });
    meshes.push(g);
    const r = 8 + R() * 10, h = 7 + R() * 4, sp = .25 + R() * .15, ph = R() * 6, ox = cx + (R() - .5) * 20, oz = cz + (R() - .5) * 14;
    anim.push((dt, time) => {
      const a = time * sp + ph;
      g.position.set(ox + Math.cos(a) * r, h, oz + Math.sin(a) * r);
      g.rotation.y = -a; g.rotation.z = .3;
      const flap = Math.sin(time * 2 + ph) > .7 ? Math.sin(time * 14) * .4 : .1;
      wings[0].rotation.z = flap; wings[1].rotation.z = -flap;
    });
  }
}
function dustDevil(world, anim, T, R, free) {
  const { x0, x1, z0, z1 } = T.box;
  const st = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, t: 0 };
  anim.push((dt, time) => {
    st.x += Math.sin(time * .13) * dt * 1.2; st.z += Math.cos(time * .17) * dt * 1;
    st.t += dt;
    if (st.t > .06) {
      st.t = 0;
      const a = time * 8, r = .3 + Math.random() * .8, y = Math.random() * 3;
      world.puff(st.x + Math.cos(a) * r * (1 + y * .4), y, st.z + Math.sin(a) * r * (1 + y * .4), { color: world.look.dust, n: 1, speed: .2, up: .8, life: 1.2, s0: 1 + y * .3, s1: 2, a: .35 });
    }
  });
}
function carStack(B, x, z, R) {
  const yaw = R() * 6.28, n = 1 + (R() * 4 | 0), cols = ['#8a3a2a', '#3d6a8a', '#c8a03a', '#4a6a3a', '#7a7a80', '#a85a2a', '#5a4a6a'];
  for (let i = 0; i < n; i++) B.add(G.rbox, cols[R() * cols.length | 0], at(x + (R() - .5) * .15, .22 + i * .42, z + (R() - .5) * .15, yaw + (R() - .5) * .3, 0, .9, .4, 1.6));
}
function tyrePile(B, x, z, R) {
  const n = 6 + (R() * 8 | 0);
  for (let i = 0; i < n; i++) { const a = R() * 6.28, d = R() * .7, y = .1 + Math.max(0, (.8 - d)) * 1.2 * R(); B.add(G.torus, i % 2 ? '#2e2824' : '#3a332e', at(x + Math.cos(a) * d, y, z + Math.sin(a) * d, R() * 6, R() * 3, .2, .2, .2)); }
}
function crusher(B, meshes, anim, x, z) {
  B.add(G.box, '#5a5a62', at(x, .5, z, 0, 0, 2.2, 1, 1.6));
  for (const sd of [-1, 1]) B.add(G.box, '#e2a51e', at(x + sd * 1, 1.9, z, 0, 0, .3, 2.8, .3));
  B.add(G.box, '#e2a51e', at(x, 3.3, z, 0, 0, 2.4, .35, .5));
  B.add(G.rbox, '#3d6a8a', at(x, 1.15, z, 0, 0, .9, .3, 1.4));
  const press = new THREE.Mesh(G.box, toon('#7a7a80')); press.scale.set(1.6, .4, 1.2); press.castShadow = true; meshes.push(press);
  anim.push((dt, time) => { const c = (time * .4) % 1, y = c < .15 ? 2.9 - c / .15 * 1.5 : c < .3 ? 1.4 : 1.4 + (c - .3) / .7 * 1.5; press.position.set(x, y, z); });
}
function shack(B, meshes, anim, x, z, R, world) {
  const yaw = R() * 6.28;
  // someone's welding round the back
  const wx = x + Math.cos(yaw) * 1.3, wz = z - Math.sin(yaw) * 1.3, st = { t: R() * 3 };
  anim.push(dt => { st.t += dt; if (dt > 0 && st.t % 3 < 1.2 && Math.random() < .5) world.sparks(wx, .4, wz, 2); });
  B.add(G.box, '#8a8a90', at(x, .7, z, yaw, 0, 2, 1.4, 1.6));
  B.add(G.box, '#a85a2a', at(x, 1.5, z, yaw, 0, 2.3, .1, 1.9, .12));
  B.add(G.box, '#3a2a22', at(x + Math.sin(yaw) * -.81, .55, z + Math.cos(yaw) * -.81, yaw, 0, .5, 1, .04));
}
function fireBarrel(B, meshes, anim, x, z, world) {
  B.add(G.cyl, '#5a3a2a', at(x, .3, z, 0, 0, .2, .6, .2));
  B.add(G.torus, '#3a2a22', at(x, .45, z, 0, Math.PI / 2, .21, .21, .1));
  const f = makeFlame(1.6); f.position.set(x, .6, z); meshes.push(f);
  anim.push((dt, time) => { const s = 1 + Math.sin(time * 17 + x) * .15 + Math.random() * .1; f.scale.set(s, s * (1 + Math.random() * .2), s); if (dt > 0 && Math.random() < .04) world.puff(x, 1.2, z, { color: '#4a4040', n: 1, up: 1.2, life: 1.2, s0: 1, s1: 2.5, a: .5 }); });
}
function dog(B, meshes, anim, x, z) {
  // a doghouse and a guard dog that won't stop barking
  B.add(G.box, '#a85a2a', at(x, .35, z, .4, 0, .8, .7, .9));
  B.add(G.cone4, '#7a3a22', at(x, .9, z, .4 + Math.PI / 4, 0, .75, .45, .75));
  const g = new THREE.Group(); g.position.set(x + .9, 0, z + .3); meshes.push(g);
  const fur = toon('#8a5a2c');
  g.add(part(G.bead, fur, [0, .22, 0], [.14, .12, .24]));
  const headG = new THREE.Group(); headG.position.set(0, .38, -.2); g.add(headG);
  headG.add(part(G.bead, fur, [0, 0, 0], [.1]), part(G.bead, toon('#6a4220'), [0, -.02, -.1], [.05, .04, .06]), part(G.bead, toon('#1a1010'), [0, 0, -.16], [.02]));
  for (const sd of [-1, 1]) g.add(part(G.cyl6, fur, [sd * .08, .08, .12], [.03, .16, .03]), part(G.cyl6, fur, [sd * .08, .08, -.12], [.03, .16, .03]));
  anim.push((dt, time) => { const bark = Math.sin(time * 2) > .3; headG.rotation.x = bark ? Math.sin(time * 26) * .25 : 0; g.position.y = bark ? Math.abs(Math.sin(time * 13)) * .04 : 0; });
}
function mesa(B, x, z, R, r0, h0) {
  // a flat-topped butte, in bands of red rock
  const r = r0 ?? 2.5 + R() * 2.5, h = h0 ?? 3 + R() * 5, sides = 7, yaw = R() * 6;
  const bands = ['#c8693a', '#b45a32', '#d47a46', '#a85030'];
  const steps = Math.ceil(h / .8);
  for (let i = 0; i < steps; i++) {
    const y0 = i * h / steps, rr = r * (1 - i / steps * .25) * (.95 + R() * .1);
    B.add(new THREE.CylinderGeometry(rr * .97, rr, h / steps, sides), bands[i % bands.length], at(x, y0 + h / steps / 2, z, yaw + i * .2, 0, 1, 1, 1));
  }
  B.add(new THREE.CylinderGeometry(r * .72, r * .75, .2, sides), '#9a6a3a', at(x, h + .1, z, yaw, 0, 1, 1, 1));
  for (let i = 0; i < 4; i++) { const a = R() * 6.28; B.add(G.stone, '#a85030', at(x + Math.cos(a) * r * 1.05, .3, z + Math.sin(a) * r * 1.05, R() * 6, R(), .5, .4, .5)); }
}
function snake(B, meshes, anim, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); meshes.push(g);
  const skin = toon('#a8904a'), band = toon('#5a4a2a');
  for (let i = 0; i < 10; i++) { const a = i * .7, r = .32 - i * .015; g.add(part(G.bead, i % 2 ? skin : band, [Math.cos(a) * r, .06 + i * .012, Math.sin(a) * r], [.07])); }
  const headG = new THREE.Group(); headG.position.set(0, .3, 0); g.add(headG);
  headG.add(part(G.bead, skin, [0, 0, 0], [.08, .07, .11]), part(G.bead, toon('#1a1010', { line: 0 }), [.04, .02, -.08], [.015]), part(G.bead, toon('#1a1010', { line: 0 }), [-.04, .02, -.08], [.015]));
  headG.add(part(G.box, toon('#d84a4a', { line: 0 }), [0, -.02, -.14], [.01, .005, .06]));
  const rattle = new THREE.Group(); rattle.position.set(.28, .22, .1); g.add(rattle);
  for (let i = 0; i < 3; i++) rattle.add(part(G.bead, toon('#e8d8a8'), [0, i * .05, 0], [.035, .03, .035]));
  anim.push((dt, time) => { rattle.rotation.z = Math.sin(time * 45) * .25; headG.position.y = .3 + Math.sin(time * 1.6) * .04; headG.rotation.y = Math.sin(time * .8) * .6; });
}
function tank(B, meshes, anim, x, z, R) {
  const r = 1.6 + R() * 1.2, h = 2 + R() * 1.6, c = R() < .5 ? '#e8e2d6' : '#c8c2b8';
  const light = new THREE.Mesh(G.bead, toon('#ffb31a', { emissive: '#ff9a00', glow: 1.3, unique: true }));
  light.scale.setScalar(.12); light.position.set(x, h + 1.05, z); meshes.push(light);
  const ph = R() * 2;
  anim.push((dt, time) => { light.visible = ((time + ph) % 2) < .25; });
  B.add(G.cyl, c, at(x, h / 2, z, 0, 0, r, h, r));
  B.add(new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), c, at(x, h, z, 0, 0, r, .5, r));
  B.add(G.cyl, '#c8352b', at(x, h * .7, z, 0, 0, r * 1.01, .25, r * 1.01));
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; B.add(G.box, '#6a6a70', at(x + Math.cos(a) * r * 1.02, h / 2, z + Math.sin(a) * r * 1.02, -a, 0, .06, h, .06)); }
  B.add(G.box, '#6a6a70', at(x, h + .5, z, 0, 0, .1, 1, .1));
}
function pumpjack(B, meshes, anim, x, z) {
  // a nodding donkey: an A-frame, a walking beam that rocks, a horse head that dips into the ground
  const yaw = Math.random() * 6;
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; meshes.push(g);
  const frame = toon('#3a3a40'), yel = toon('#ffd23a');
  g.add(part(G.box, toon('#5a5a60'), [0, .1, 0], [.8, .2, 3]));
  for (const sd of [-1, 1]) g.add(part(G.box, frame, [sd * .25, 1, .1], [.1, 2, .1], [0, 0, sd * -.12]));
  const beam = new THREE.Group(); beam.position.set(0, 2, .1); g.add(beam);
  beam.add(part(G.box, yel, [0, 0, 0], [.2, .2, 2.6]));
  beam.add(part(G.box, yel, [0, -.15, -1.35], [.22, .7, .3]));
  const crank = new THREE.Group(); crank.position.set(0, .7, 1.1); g.add(crank);
  crank.add(part(G.box, toon('#c8352b'), [0, 0, 0], [.5, .25, .9]));
  g.add(part(G.cyl6, frame, [0, .5, -1.35], [.05, 1, .05]));
  anim.push((dt, time) => { const a = time * 1.6 + x; beam.rotation.x = Math.sin(a) * .28; crank.rotation.x = a; });
}
function chimney(B, anim, x, z, world) {
  B.add(G.cyl, '#8a7a70', at(x, 3, z, 0, 0, .45, 6, .45));
  for (const y of [1.5, 3.5, 5.6]) B.add(G.cyl, '#c8352b', at(x, y, z, 0, 0, .47, .3, .47));
  const st = { t: 0 };
  anim.push(dt => { st.t += dt; if (st.t > .25) { st.t = 0; world.puff(x, 6.2, z, { color: '#5a5050', n: 1, up: 1.4, speed: .3, life: 2.4, s0: 2, s1: 6, a: .55, drag: .3 }); } });
}
function puddle(meshes, x, z, R) {
  const sh = new THREE.Shape(), r0 = .6 + R() * .7;
  for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI * 2, r = r0 * (1 + .25 * Math.sin(a * 3 + R() * 6)); i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), toon('#1e1824', { line: 0 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, .015, z); m.receiveShadow = true; meshes.push(m);
}
function drums(B, x, z, R) {
  const n = 1 + (R() * 3 | 0), cols = ['#3d6a8a', '#c8352b', '#ffd23a', '#4a6a3a'];
  for (let i = 0; i < n; i++) { const c = cols[R() * cols.length | 0]; B.add(G.cyl, c, at(x + (R() - .5) * .7, .25, z + (R() - .5) * .7, R() * 6, 0, .16, .5, .16)); }
}
function pipes(B, T) {
  // long pipelines on stands, out in the sand
  const { x0, x1, z0, z1 } = T.box;
  for (let k = 0; k < 3; k++) {
    const z = z0 - 6 - k * 3, len = x1 - x0 + 20;
    if (k < 2) {
      B.add(G.cyl, k ? '#b8b0a4' : '#8a8a90', at((x0 + x1) / 2, .6, z, Math.PI / 2, Math.PI / 2, .3, len, .3));
      for (let x = x0 - 10; x < x1 + 10; x += 3) B.add(G.box, '#5a5a60', at(x, .3, z, 0, 0, .15, .6, .5));
    }
  }
}
