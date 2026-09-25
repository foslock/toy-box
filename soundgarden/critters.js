// Life in the garden: butterflies that wander between the flowers and settle on them, bees working the lavender and
// the hives, dragonflies over the pond, cherry petals falling on the breeze, and motes drifting in the low sun.
import * as THREE from 'three';
import * as L from './layout.js';
import * as T from './textures.js';
import { TAU, U, SUN, DETAIL, REDUCED, clamp, lerp, gust } from './common.js';

/* ---------- butterflies ---------- */
// Four species in a 2×2 atlas. Each cell holds both wings, spread flat, with the body down the middle.
function wingAtlas() {
  const W = 512, H = 256, [c, g] = T.canvas(W, H);
  const species = [
    { base: '#e8781e', vein: '#1c1410', edge: '#140f0c', dots: '#fff4e0' },          // a tiger, orange with black veins
    { base: '#6a8ee8', vein: '#3a4a8a', edge: '#2a2a3a', dots: '#ffffff', fringe: true }, // a common blue
    { base: '#f4f0e2', vein: '#c8c2b0', edge: '#8a8a8a', dots: '#2a2a2a', tip: true },    // a cabbage white
    { base: '#2a1e1a', vein: '#1a1210', edge: '#140e0c', dots: '#f6f2ea', band: '#e0482a' }, // a red admiral
  ];
  species.forEach((s, i) => {
    const ox = (i % 2) * 256, oy = Math.floor(i / 2) * 128;
    for (const side of [-1, 1]) {
      g.save(); g.translate(ox + 128, oy + 64); g.scale(side, 1);
      // forewing (towards the head, +y up in the cell) and hindwing
      const fore = new Path2D(); fore.moveTo(2, -4); fore.bezierCurveTo(40, -58, 104, -62, 118, -46); fore.bezierCurveTo(112, -20, 70, -2, 2, 4); fore.closePath();
      const hind = new Path2D(); hind.moveTo(2, 2); hind.bezierCurveTo(60, 0, 92, 18, 84, 44); hind.bezierCurveTo(70, 62, 30, 56, 2, 16); hind.closePath();
      for (const p of [hind, fore]) {
        const gr = g.createRadialGradient(10, 0, 4, 40, 0, 120);
        gr.addColorStop(0, s.base); gr.addColorStop(1, s.base);
        g.fillStyle = gr; g.fill(p);
        g.save(); g.clip(p);
        if (s.band) { g.strokeStyle = s.band; g.lineWidth = 14; g.beginPath(); g.moveTo(30, -44); g.quadraticCurveTo(70, -30, 96, -8); g.stroke(); g.beginPath(); g.moveTo(20, 48); g.quadraticCurveTo(60, 58, 86, 40); g.stroke(); }
        g.strokeStyle = s.vein; g.lineWidth = 2.2;
        for (let v = 0; v < 6; v++) { g.beginPath(); g.moveTo(4, 0); const a = -1.2 + v * .45; g.quadraticCurveTo(50 * Math.cos(a), 50 * Math.sin(a), 130 * Math.cos(a), 130 * Math.sin(a)); g.stroke(); }
        g.lineWidth = 10; g.strokeStyle = s.edge; g.stroke(p);
        if (s.tip) { g.fillStyle = '#5a5a5a'; g.beginPath(); g.ellipse(106, -48, 20, 12, .3, 0, TAU); g.fill(); g.fillStyle = s.dots; g.beginPath(); g.arc(70, -26, 6, 0, TAU); g.fill(); }
        else { g.fillStyle = s.dots; for (let d = 0; d < 6; d++) { g.beginPath(); g.arc(100 - d * 8, -48 + d * 7, 2.6, 0, TAU); g.fill(); } }
        if (s.fringe) { g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.stroke(p); }
        g.restore();
      }
      g.restore();
    }
    g.fillStyle = '#1e1814'; g.beginPath(); g.ellipse(ox + 128, oy + 64, 5, 34, 0, 0, TAU); g.fill();
  });
  return T.tex(c, { repeat: false });
}

function butterflies(scene, flowers, count) {
  const w = .045, l = .05, g = new THREE.BufferGeometry();
  // two wings, hinged on the body along z; x < 0 is the left wing
  g.setAttribute('position', new THREE.Float32BufferAttribute([-w * 2, 0, -l, 0, 0, -l, 0, 0, l, -w * 2, 0, l, 0, 0, -l, w * 2, 0, -l, w * 2, 0, l, 0, 0, l], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Array(8).fill([0, 1, 0]).flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, .5, 0, .5, 1, 0, 1, .5, 0, 1, 0, 1, 1, .5, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const mat = new THREE.MeshStandardMaterial({ map: wingAtlas(), alphaTest: .5, side: THREE.DoubleSide, roughness: .75 });
  const aFlap = new THREE.InstancedBufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage);
  const aCell = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
  g.setAttribute('aFlap', aFlap); g.setAttribute('aCell', aCell);
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFlap; attribute vec2 aCell;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = (uv + aCell) * vec2(.5, .5);')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { float s = sign(position.x), c = cos(aFlap), sn = sin(aFlap);
          transformed = vec3(position.x * c, abs(position.x) * sn, position.z); }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        { float s = sign(position.x); objectNormal = normalize(vec3(-s * sin(aFlap), cos(aFlap), 0.0)); }`);
  };
  const mesh = new THREE.InstancedMesh(g, mat, count);
  mesh.frustumCulled = false; mesh.castShadow = true;
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: mat.map, alphaTest: .5, side: THREE.DoubleSide });
  depth.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFlap; attribute vec2 aCell;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = (uv + aCell) * vec2(.5, .5);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = vec3(position.x * cos(aFlap), abs(position.x) * sin(aFlap), position.z);');
  };
  mesh.customDepthMaterial = depth;
  scene.add(mesh);

  const R = L.mulberry(12), homes = [];
  // where they like to be: the butterfly garden round the chair, the lavender walk, the meadow, the terrace
  const near = (x, z, r) => flowers.filter(f => Math.hypot(f.x - x, f.z - z) < r);
  const H = [[0, 0, 8, .45], [0, 17, 6, .2], [18, -18, 7, .2], [18, 0, 6, .08], [18, 19, 6, .07]];
  const bs = Array.from({ length: count }, (_, i) => {
    let pick = R(), hi = 0; while (hi < H.length - 1 && (pick -= H[hi][3]) > 0) hi++;
    const [hx, hz, hr] = H[hi], spots = near(hx, hz, hr);
    const b = { home: [hx, hz, hr], spots: spots.length ? spots : flowers, p: new THREE.Vector3(hx + (R() - .5) * hr, .6 + R(), hz + (R() - .5) * hr), v: new THREE.Vector3(), aim: new THREE.Vector3(), state: 'fly', t: R() * 4, flap: R() * TAU, yaw: R() * TAU, s: .8 + R() * .5, cell: [R() < .35 ? 0 : 1, R() < .5 ? 0 : 1] };
    aCell.setXY(i, b.cell[0], b.cell[1]);
    return b;
  });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), sc = new THREE.Vector3();
  const newAim = b => { const [hx, hz, hr] = b.home; b.aim.set(hx + (R() - .5) * 2 * hr, .5 + R() * 1.4, hz + (R() - .5) * 2 * hr); };
  bs.forEach(newAim);
  return function update(t, dt, eye) {
    bs.forEach((b, i) => {
      b.t -= dt;
      const dEye = Math.hypot(b.p.x - eye.x, b.p.y - eye.y, b.p.z - eye.z);
      if (b.state === 'rest') {
        b.flap = 1.25 + Math.sin(t * .9 + i) * .35 + Math.max(0, Math.sin(t * .31 + i * 2)) * -.9;   // wings closed up, now and then opening flat
        if (b.t < 0 || dEye < 1.3) { b.state = 'fly'; b.v.set(0, .9, 0); newAim(b); b.t = 3 + R() * 5; }
      } else {
        const to = new THREE.Vector3().subVectors(b.aim, b.p), dist = to.length();
        const landing = b.state === 'land';
        const want = to.normalize().multiplyScalar(landing ? Math.min(.9, dist * 2 + .15) : 1.05);
        // a butterfly's flight is all lurches: steer loosely, bob and swerve
        want.x += Math.sin(t * 2.3 + i * 5) * .6; want.z += Math.cos(t * 1.9 + i * 3) * .6; want.y += Math.sin(t * 4.1 + i) * .5 * (landing ? .3 : 1);
        if (dEye < 1.2) want.add(new THREE.Vector3(b.p.x - eye.x, .4, b.p.z - eye.z).normalize().multiplyScalar(1.5));
        b.v.lerp(want, 1 - Math.exp(-dt * 2.2));
        b.p.addScaledVector(b.v, dt);
        b.p.y = clamp(b.p.y, .25, 3.2);
        if (landing && dist < .05) { b.state = 'rest'; b.t = 3 + R() * 8; b.p.copy(b.aim); b.v.set(0, 0, 0); }
        else if (!landing && (dist < .4 || b.t < 0)) {
          if (R() < .45 && b.spots.length) { const f = b.spots[R() * b.spots.length | 0]; b.aim.set(f.x, f.y, f.z); b.state = 'land'; b.t = 8; }
          else { newAim(b); b.t = 2 + R() * 4; }
        } else if (landing && b.t < 0) { b.state = 'fly'; newAim(b); }
        // quick bursts of beats, then a glide on raised wings
        const glide = Math.sin(t * .9 + i * 1.7) > .72 && !landing;
        b.flap = glide ? lerp(b.flap, .55, 1 - Math.exp(-dt * 10)) : Math.sin(t * (landing ? 44 : 38) + i) * .95 + .25;
        if (Math.hypot(b.v.x, b.v.z) > .05) { let d = Math.atan2(b.v.x, b.v.z) - b.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); b.yaw += d * Math.min(1, dt * 6); }
      }
      aFlap.setX(i, b.flap);
      e.set(b.state === 'rest' ? -.1 : clamp(-b.v.y * .4, -.5, .5), b.yaw, 0);
      m.compose(b.p, q.setFromEuler(e), sc.setScalar(b.s));
      mesh.setMatrixAt(i, m);
    });
    aFlap.needsUpdate = true; mesh.instanceMatrix.needsUpdate = true;
  };
}

/* ---------- bees ---------- */
function bees(scene, flowers, count) {
  const g = new THREE.SphereGeometry(.007, 8, 6).scale(1, 1, 1.7), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const z = g.attributes.position.getZ(i), dark = Math.sin(z * 900) > .2; col.set(dark ? [.05, .04, .02] : [.78, .52, .08], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6 }), count);
  mesh.frustumCulled = false; scene.add(mesh);
  const wings = new THREE.InstancedMesh(new THREE.CircleGeometry(.009, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe8eef2, transparent: true, opacity: .35, depthWrite: false, side: THREE.DoubleSide }), count);
  wings.frustumCulled = false; scene.add(wings);
  const R = L.mulberry(31), hives = L.PROPS.filter(p => p.kind === 'hive');
  const lav = flowers.filter(f => f.kind === 'lavender' || f.kind === 'meadow');
  const list = Array.from({ length: count }, (_, i) => ({ p: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), t: 1, dur: 1, hover: R() * 2, seed: R() * 100 }));
  const pickFlower = (b, from) => { const cands = lav.filter(f => Math.hypot(f.x - from.x, f.z - from.z) < 4); const f = (cands.length ? cands : lav)[R() * (cands.length || lav.length) | 0]; return new THREE.Vector3(f.x + (R() - .5) * .1, f.y + .05, f.z + (R() - .5) * .1); };
  list.forEach(b => { const f = lav[R() * lav.length | 0]; b.p.set(f.x, f.y, f.z); b.to.copy(b.p); b.from.copy(b.p); });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  return function update(t, dt) {
    list.forEach((b, i) => {
      if (b.hover > 0) {
        b.hover -= dt;
        b.p.set(b.to.x + Math.sin(t * 17 + b.seed) * .015, b.to.y + Math.sin(t * 23 + b.seed * 2) * .012, b.to.z + Math.cos(t * 19 + b.seed) * .015);
        if (b.hover <= 0) {
          b.from.copy(b.p);
          b.to = R() < .06 && hives.length ? (h => new THREE.Vector3(h.x, .55, h.z))(hives[R() * hives.length | 0]) : pickFlower(b, b.p);
          b.t = 0; b.dur = Math.max(.3, b.from.distanceTo(b.to) / (1.8 + R()));
        }
      } else {
        b.t += dt / b.dur;
        const k = b.t * b.t * (3 - 2 * b.t);
        b.p.lerpVectors(b.from, b.to, Math.min(1, k)); b.p.y += Math.sin(Math.PI * Math.min(1, b.t)) * .25;
        b.p.x += Math.sin(t * 9 + b.seed) * .02;
        if (b.t >= 1) b.hover = 1 + R() * 3;
      }
      const dir = new THREE.Vector3().subVectors(b.to, b.from); dir.y = 0;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dir.x, dir.z) + Math.sin(t * 3 + i));
      m.compose(b.p, q, new THREE.Vector3(1, 1, 1)); mesh.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(b.p.x, b.p.y + .008, b.p.z), q, new THREE.Vector3(1 + Math.sin(t * 90 + i) * .3, 1, .8)); wings.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true; wings.instanceMatrix.needsUpdate = true;
  };
}

/* ---------- dragonflies ---------- */
function dragonflies(scene, count) {
  const body = new THREE.CylinderGeometry(.004, .0025, .075, 6).rotateX(Math.PI / 2);
  const bodyMesh = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ color: 0x2a6ab8, roughness: .25, metalness: .4 }), count);
  const wing = new THREE.PlaneGeometry(.11, .018).rotateX(-Math.PI / 2);
  const wingMesh = new THREE.InstancedMesh(wing, new THREE.MeshStandardMaterial({ color: 0xdfe8f0, transparent: true, opacity: .4, roughness: .1, metalness: .3, depthWrite: false, side: THREE.DoubleSide }), count * 2);
  bodyMesh.frustumCulled = wingMesh.frustumCulled = false;
  scene.add(bodyMesh, wingMesh);
  const R = L.mulberry(71), P = L.POND;
  const pt = () => { const a = R() * TAU, k = Math.sqrt(R()) * .85; return new THREE.Vector3(P.x + Math.cos(a) * P.rx * k, P.level + .25 + R() * .6, P.z + Math.sin(a) * P.rz * k); };
  const list = Array.from({ length: count }, () => ({ p: pt(), to: pt(), hover: R() * 2, yaw: R() * TAU }));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  return function update(t, dt) {
    list.forEach((d, i) => {
      if (d.hover > 0) { d.hover -= dt; if (d.hover <= 0) d.to = pt(); }
      else {
        const to = d.to.clone().sub(d.p), dist = to.length();
        d.p.addScaledVector(to.normalize(), Math.min(dist, dt * 4.5));
        d.yaw = Math.atan2(to.x, to.z);
        if (dist < .03) d.hover = .8 + R() * 2.5;
      }
      const p = d.p.clone().add(new THREE.Vector3(Math.sin(t * 7 + i) * .006, Math.sin(t * 11 + i) * .006, 0));
      q.setFromAxisAngle(up, d.yaw);
      m.compose(p, q, new THREE.Vector3(1, 1, 1)); bodyMesh.setMatrixAt(i, m);
      for (const s of [0, 1]) { m.compose(p.clone().add(new THREE.Vector3(0, .004, s ? -.008 : .012).applyQuaternion(q)), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(t * 60 + s) * .15)), new THREE.Vector3(1, 1, 1)); wingMesh.setMatrixAt(i * 2 + s, m); }
    });
    bodyMesh.instanceMatrix.needsUpdate = true; wingMesh.instanceMatrix.needsUpdate = true;
  };
}

/* ---------- cherry petals ---------- */
function petals(scene, count) {
  const g = new THREE.CircleGeometry(.011, 7).scale(1, 1.35, 1);
  const mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xf7cfdc, roughness: .6, side: THREE.DoubleSide }), count);
  mesh.frustumCulled = false; scene.add(mesh);
  const trees = L.TREES.filter(t => t.kind === 'cherry'), R = L.mulberry(9), wd = U.uWindDir.value;
  const spawn = (p, fresh) => { const tr = trees[R() * trees.length | 0], a = R() * TAU, r = Math.sqrt(R()) * 2.2; p.pos.set(tr.x + Math.cos(a) * r, fresh ? R() * 4.5 : 3 + R() * 2, tr.z + Math.sin(a) * r); p.ground = 0; p.spin = new THREE.Vector3(R() * 3, R() * 3, R() * 3); p.rot = new THREE.Euler(R() * 6, R() * 6, R() * 6); p.seed = R() * 50; };
  const list = Array.from({ length: count }, () => { const p = { pos: new THREE.Vector3() }; spawn(p, true); return p; });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
  return function update(t, dt) {
    const gu = gust(t);
    list.forEach((p, i) => {
      if (p.pos.y > .01) {
        p.pos.y -= dt * (.35 + .1 * Math.sin(t * 2 + p.seed));
        p.pos.x += (wd.x * (.25 + gu * 1.4) + Math.sin(t * 1.3 + p.seed) * .25) * dt;
        p.pos.z += (wd.y * (.25 + gu * 1.4) + Math.cos(t * 1.1 + p.seed) * .25) * dt;
        p.rot.x += p.spin.x * dt; p.rot.y += p.spin.y * dt; p.rot.z += p.spin.z * dt;
        if (p.pos.y <= .01) { p.pos.y = .008; p.rot.set(-Math.PI / 2, p.rot.y, 0); p.ground = 0; }
      } else if ((p.ground += dt) > 6 + (i % 5)) spawn(p, false);
      q.setFromEuler(p.rot); m.compose(p.pos, q, s1); mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
}

/* ---------- motes in the sunlight ---------- */
function motes(scene, count) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) { seed[i] = Math.random(); pos.set([(Math.random() - .5) * 20, Math.random() * 4, (Math.random() - .5) * 20], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uSun: { value: SUN }, uPx: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSeed; uniform float uPx; uniform vec3 uSun; varying float vA;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z;
        vec3 v = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        float back = pow(max(dot(v, uSun), 0.0), 6.0);                  // they glint looking towards the sun
        gl_PointSize = clamp(uPx * (1.0 + aSeed) * 7.0 / max(d, .2), 1.0, 5.0);
        vA = (.05 + back * .9) * smoothstep(12.0, 3.0, d) * smoothstep(.3, 1.2, d);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; void main() { float r = length(gl_PointCoord - .5); if (r > .5) discard; gl_FragColor = vec4(vec3(1.0, .93, .78) * vA * smoothstep(.5, 0.0, r), 1.0); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
  return function update(t, dt, eye) {
    for (let i = 0; i < count; i++) {
      let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; const s = seed[i];
      x += (Math.sin(t * .3 + s * 20) * .08 + .05) * dt; y += Math.sin(t * .5 + s * 30) * .04 * dt; z += Math.cos(t * .23 + s * 10) * .06 * dt;
      if (x - eye.x > 10) x -= 20; else if (x - eye.x < -10) x += 20;
      if (z - eye.z > 10) z -= 20; else if (z - eye.z < -10) z += 20;
      if (y > 4) y = .1;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    }
    g.attributes.position.needsUpdate = true;
    mat.uniforms.uPx.value = devicePixelRatio;
  };
}

export function buildCritters(scene, flowers = []) {
  const parts = [
    butterflies(scene, flowers, Math.round(30 * Math.max(.6, DETAIL))),
    bees(scene, flowers, Math.round(26 * Math.max(.6, DETAIL))),
    dragonflies(scene, 3),
    petals(scene, Math.round(170 * Math.max(.5, DETAIL))),
    motes(scene, 260),
  ];
  return { update(t, dt, camera) { if (REDUCED) dt *= .6; for (const u of parts) u(t, dt, camera.position); } };
}
