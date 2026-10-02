// The battlefield: a ledge deep in hell, painted fresh for each circle (sky, far cliffs and the circle's landmark,
// rock pillars, a cracked floor glowing from below, weather), with the angel on the left and the demons on the
// right, all as flat painted layers at different depths so the camera's slow drift gives real parallax.
import * as THREE from 'three';
import { CIRCLE_LOOK, canvas, lin, rad, rgba, mixc, rand, noise2, fbm, TAU } from './paint.js';
import { lookFor, FW } from './figures.js';
import { spriteMaterial, glowMaterial, texOf, LIGHT } from './sprite.js';
import { SETS, propLook } from './props.js';

/* ================= backdrops ================= */
function ridge(g, w, y, amp, freq, seed, col, rimCol, rim = 2) {
  const n = noise2(seed);
  g.beginPath(); g.moveTo(0, g.canvas.height);
  for (let x = 0; x <= w; x += 4) g.lineTo(x, y - fbm(n, x * freq, .5, 4) * amp);
  g.lineTo(w, g.canvas.height); g.closePath();
  g.fillStyle = col; g.fill();
  if (rimCol) { g.save(); g.clip(); g.strokeStyle = rimCol; g.lineWidth = rim; g.beginPath(); for (let x = 0; x <= w; x += 4) g.lineTo(x, y - fbm(n, x * freq, .5, 4) * amp + rim * .5); g.stroke(); g.restore(); }
}
const HZ = .8;   // where the horizon sits on the backdrop
function paintBackdrop(L, ci) {
  const W = 1536, H = 1280, c = canvas(W, H), g = c.getContext('2d'), r = rand(ci * 77 + 3);
  const hz = H * HZ;
  g.fillStyle = lin(g, 0, 0, 0, H, [[0, L.sky[0]], [.5, L.sky[0]], [.68, L.sky[1]], [HZ, L.sky[2]], [1, L.sky[1]]]); g.fillRect(0, 0, W, H);
  // the great glow on the horizon
  g.fillStyle = rad(g, W / 2, hz, 10, W * .55, [[0, rgba(L.glow, .55)], [.4, rgba(L.glow, .18)], [1, rgba(L.glow, 0)]]); g.fillRect(0, 0, W, H);
  // far cliffs, fading into fog
  // a faint far wall of the pit, high up
  ridge(g, W, hz - 300, 220, .003, ci * 13 + 7, mixc(L.rock, L.sky[1], .55), rgba(L.rim, .12));
  ridge(g, W, hz - 70, 150, .004, ci * 13 + 1, mixc(L.rock, L.fog, .55), rgba(L.rim, .25));
  landmark(g, W, H, hz, L, ci, r);
  // a band of mist
  g.fillStyle = lin(g, 0, hz - 70, 0, hz + 40, [[0, rgba(L.fog, 0)], [.6, rgba(L.fog, .5)], [1, rgba(L.fog, 0)]]); g.fillRect(0, hz - 70, W, 110);
  ridge(g, W, hz + 14, 60, .008, ci * 13 + 2, mixc(L.rock, L.fog, .3), rgba(L.rim, .35));
  // the cavern roof: stalactites against the sky
  g.fillStyle = mixc(L.rock, '#000000', .45);
  g.beginPath(); g.moveTo(0, 0);
  for (let x = 0; x <= W; x += 12) { const t = r(); g.lineTo(x, 50 + t * 60 + (t > .85 ? 200 * r() : 0)); }
  g.lineTo(W, 0); g.closePath(); g.fill();
  g.fillStyle = lin(g, 0, 0, 0, 360, [[0, 'rgba(0,0,0,.85)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, W, 360);
  return c;
}
// each circle's far-off landmark
function landmark(g, W, H, hz, L, ci, r) {
  const name = L.name;
  g.save();
  if (name === 'limbo') {
    // the noble castle of Limbo, seven walls, pale light in its windows
    const cx = W * .62, base = hz - 30;
    g.fillStyle = mixc(L.rock, L.fog, .35);
    g.beginPath(); g.moveTo(cx - 220, base); g.quadraticCurveTo(cx, base - 90, cx + 220, base); g.fill();
    for (let i = 0; i < 7; i++) { const x = cx - 150 + i * 50, h = 90 + (i === 3 ? 70 : (i % 2) * 30); g.fillRect(x - 12, base - 60 - h, 24, h + 30); g.beginPath(); g.moveTo(x - 16, base - 60 - h); g.lineTo(x, base - 96 - h); g.lineTo(x + 16, base - 60 - h); g.fill(); }
    g.fillRect(cx - 160, base - 90, 320, 60);
    for (let i = 0; i < 18; i++) { g.fillStyle = rgba('#fff4d0', .6 + r() * .4); g.fillRect(cx - 150 + r() * 300, base - 80 - r() * 140, 3, 5); }
  } else if (name === 'lust') {
    // the endless storm: spiralling streams of souls
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 7; k++) { g.strokeStyle = rgba(L.glow, .06 + k * .01); g.lineWidth = 18 - k * 2; g.beginPath(); for (let a = 0; a < 9; a += .05) { const rr = 40 + a * 46 + k * 10; g.lineTo(W * .5 + Math.cos(a + k) * rr * 1.8, hz - 200 + Math.sin(a + k) * rr * .45); } g.stroke(); }
    for (let i = 0; i < 160; i++) { const a = r() * 9, rr = 40 + a * 46; g.fillStyle = rgba('#ffd0e8', .3 + r() * .5); g.fillRect(W * .5 + Math.cos(a) * rr * 1.8, hz - 200 + Math.sin(a) * rr * .45, 2, 2); }
  } else if (name === 'gluttony') {
    // a mire under endless filthy rain
    g.fillStyle = rgba(L.fog, .5); for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(r() * W, 160 + r() * 120, 260, 60, 0, 0, TAU); g.fill(); }
    g.strokeStyle = rgba('#c8c8a0', .12); g.lineWidth = 1.5; for (let i = 0; i < 420; i++) { const x = r() * W, y = r() * hz; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 8, y + 30); g.stroke(); }
  } else if (name === 'greed') {
    // mountains of gold, glittering
    for (let i = 0; i < 5; i++) { const x = r() * W, w = 200 + r() * 260, h = 100 + r() * 120; g.fillStyle = lin(g, 0, hz - h, 0, hz, [[0, mixc('#ffd86a', L.fog, .3)], [1, mixc('#8a5a10', L.fog, .4)]]); g.beginPath(); g.moveTo(x - w, hz + 20); g.quadraticCurveTo(x, hz - h * 2, x + w, hz + 20); g.fill(); }
    g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 200; i++) { g.fillStyle = rgba('#fff2b0', r() * .8); g.fillRect(r() * W, hz - r() * 200, 2, 2); }
  } else if (name === 'wrath') {
    // the black marsh of the Styx, bubbling
    g.fillStyle = lin(g, 0, hz - 40, 0, hz + 60, [[0, '#120806'], [1, '#050202']]); g.fillRect(0, hz - 30, W, 120);
    g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(L.glow, .3); g.lineWidth = 2; for (let i = 0; i < 40; i++) { g.beginPath(); g.ellipse(r() * W, hz - 20 + r() * 80, 10 + r() * 30, 2 + r() * 4, 0, 0, TAU); g.stroke(); }
  } else if (name === 'heresy') {
    // the iron walls and glowing towers of the City of Dis
    const base = hz - 10;
    g.fillStyle = mixc('#2a0a06', L.fog, .25);
    g.fillRect(0, base - 90, W, 110);
    for (let i = 0; i < 16; i++) { const x = i * W / 15 + r() * 30, h = 60 + r() * 110, w = 26 + r() * 24; g.fillRect(x - w / 2, base - 90 - h, w, h); g.beginPath(); g.moveTo(x - w / 2 - 6, base - 90 - h); g.lineTo(x, base - 120 - h - r() * 30); g.lineTo(x + w / 2 + 6, base - 90 - h); g.fill(); }
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) { g.fillStyle = rgba('#ff7a2a', .5 + r() * .5); g.fillRect(r() * W, base - 90 - r() * 160, 4, 6); }
    g.fillStyle = rad(g, W * .5, base - 160, 10, 500, [[0, rgba('#ff5a1a', .35)], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, W, H);
  } else if (name === 'violence') {
    // the river of boiling blood
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = lin(g, 0, hz - 20, 0, hz + 40, [[0, 'rgba(255,40,20,0)'], [.5, 'rgba(255,40,20,.65)'], [1, 'rgba(255,40,20,0)']]); g.fillRect(0, hz - 20, W, 60);
    for (let i = 0; i < 60; i++) { g.fillStyle = rgba('#ffb08a', r() * .6); g.beginPath(); g.arc(r() * W, hz + (r() - .5) * 30, 1 + r() * 3, 0, TAU); g.fill(); }
    // falling flakes of fire
    for (let i = 0; i < 140; i++) { const x = r() * W, y = r() * hz; g.strokeStyle = rgba('#ff8a3a', .2 + r() * .3); g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y + 14); g.stroke(); }
  } else if (name === 'fraud') {
    // Malebolge: stone bridges arching over ditches
    g.strokeStyle = mixc(L.rock2, L.fog, .3); g.lineWidth = 16;
    for (let i = 0; i < 5; i++) { const y = hz - 60 - i * 34; g.beginPath(); for (let k = 0; k < 7; k++) { const x = k * W / 6; g.moveTo(x - 60, y + 20); g.quadraticCurveTo(x + 60, y - 40 + i * 4, x + 180, y + 20); } g.stroke(); }
    g.globalCompositeOperation = 'lighter'; g.fillStyle = lin(g, 0, hz - 20, 0, hz + 30, [[0, 'rgba(60,255,190,0)'], [.5, 'rgba(60,255,190,.25)'], [1, 'rgba(60,255,190,0)']]); g.fillRect(0, hz - 20, W, 50);
  } else if (name === 'treachery') {
    // the frozen lake, with shapes of the damned in the ice
    g.fillStyle = lin(g, 0, hz - 30, 0, H, [[0, '#cfe8f8'], [.2, '#7aa8c8'], [1, '#1a3048']]); g.fillRect(0, hz - 20, W, H);
    for (let i = 0; i < 30; i++) { g.fillStyle = rgba('#0a1a2a', .25); g.beginPath(); g.ellipse(r() * W, hz + 10 + r() * 60, 6, 14, r() - .5, 0, TAU); g.fill(); }
    // far shards of ice
    g.fillStyle = rgba('#e0f4ff', .6);
    for (let i = 0; i < 14; i++) { const x = r() * W, h = 60 + r() * 140; g.beginPath(); g.moveTo(x - 20, hz); g.lineTo(x + (r() - .5) * 30, hz - h); g.lineTo(x + 20, hz); g.fill(); }
  }
  g.restore();
}
function paintPillars(L, ci) {
  // rock columns and hanging stone on both sides, lit along their edges
  const W = 1536, H = 900, c = canvas(W, H), g = c.getContext('2d'), r = rand(ci * 91 + 5), n = noise2(ci + 40);
  const column = (x, w, lean) => {
    g.beginPath();
    for (let y = 0; y <= H; y += 10) g.lineTo(x - w / 2 + (fbm(n, y * .01, x * .01, 3) - .5) * w * .6 + lean * y / H * 60, y);
    for (let y = H; y >= 0; y -= 10) g.lineTo(x + w / 2 + (fbm(n, y * .012 + 9, x * .01, 3) - .5) * w * .6 + lean * y / H * 60, y);
    g.closePath();
    g.fillStyle = lin(g, x - w, 0, x + w, 0, [[0, mixc(L.rock, '#000000', .3)], [.5, L.rock], [1, mixc(L.rock2, L.rim, .1)]]); g.fill();
    g.save(); g.clip(); g.fillStyle = lin(g, 0, 0, 0, H, [[0, 'rgba(0,0,0,.6)'], [.6, 'rgba(0,0,0,0)'], [1, rgba(L.glow, .25)]]); g.fillRect(0, 0, W, H); g.restore();
  };
  column(70, 150, -1); column(W - 80, 170, 1);
  if (r() < .7) column(W * .2, 70, 0);
  if (r() < .6) column(W * .84, 60, 0);
  // stalactites
  g.fillStyle = mixc(L.rock, '#000000', .35);
  for (let i = 0; i < 26; i++) { const x = r() * W, w = 20 + r() * 50, h = 60 + r() * 220; g.beginPath(); g.moveTo(x - w / 2, 0); g.quadraticCurveTo(x - w * .2, h * .6, x, h); g.quadraticCurveTo(x + w * .2, h * .6, x + w / 2, 0); g.fill(); }
  return c;
}
function paintGround(L, ci) {
  const W = 512, H = 512, c = canvas(W, H), g = c.getContext('2d'), n = noise2(ci * 5 + 2), r = rand(ci * 19 + 1);
  const img = g.createImageData(W, H), d = img.data;
  const base = [0, 2, 4].map(i => parseInt((L.rock2).slice(1 + i, 3 + i), 16)), dark = [0, 2, 4].map(i => parseInt((L.rock).slice(1 + i, 3 + i), 16));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = fbm(n, x * .024, y * .024, 4), v2 = n(x * .18, y * .18);
    const t = Math.min(1, Math.max(0, v * 1.3 - .15 + v2 * .15));
    const i = (y * W + x) * 4;
    for (let k = 0; k < 3; k++) d[i + k] = dark[k] + (base[k] - dark[k]) * t;
    d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // glowing cracks
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 14; k++) {
    let x = r() * W, y = H * .35 + r() * H * .65, a = r() * TAU;
    g.strokeStyle = rgba(L.lava, .18 + r() * .25); g.lineWidth = .5 + r() * 1; g.shadowColor = L.lava; g.shadowBlur = 3;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 10; s++) { a += (r() - .5) * 1.2; x += Math.cos(a) * 7; y += Math.sin(a) * 4.5; g.lineTo(x, y); }
    g.stroke();
  }
  g.shadowBlur = 0;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = lin(g, 0, 0, 0, H, [[0, 'rgba(0,0,0,.75)'], [.45, 'rgba(0,0,0,.25)'], [1, 'rgba(0,0,0,.35)']]); g.fillRect(0, 0, W, H);
  g.fillStyle = lin(g, 0, 0, W, 0, [[0, 'rgba(0,0,0,.6)'], [.25, 'rgba(0,0,0,0)'], [.75, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.6)']]); g.fillRect(0, 0, W, H);
  if (L.name === 'treachery') { g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(210,240,255,.35)'; g.fillRect(0, 0, W, H); }
  return c;
}

/* ================= particles: embers, ash, rain, snow ================= */
const PVERT = `
  attribute vec4 aColor; attribute float aSize; attribute float aAng; attribute float aStretch;
  varying vec4 vColor; varying float vAng; varying float vStretch;
  uniform float uScale;
  void main() { vColor = aColor; vAng = aAng; vStretch = aStretch;
    vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const PFRAG = `
  varying vec4 vColor; varying float vAng; varying float vStretch;
  void main() { vec2 p = gl_PointCoord * 2. - 1.; float c = cos(vAng), s = sin(vAng); p = mat2(c, -s, s, c) * p; p.y /= max(vStretch, 1.); p.x *= max(vStretch, 1.) * .6 + .4;
    float a = exp(-dot(p, p) * 3.2); gl_FragColor = vec4(vColor.rgb, vColor.a * a); }`;
class Particles {
  constructor(n, additive) {
    this.n = n; this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.col = new Float32Array(n * 4); this.size = new Float32Array(n); this.ang = new Float32Array(n); this.str = new Float32Array(n); this.kind = new Uint8Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAng', new THREE.BufferAttribute(this.ang, 1));
    geo.setAttribute('aStretch', new THREE.BufferAttribute(this.str, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: PVERT, fragmentShader: PFRAG, uniforms: { uScale: { value: 300 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false;
    this.geo = geo; this.next = 0;
  }
  spawn(o) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.p.set(o.p, i * 3); this.v.set(o.v ?? [0, 0, 0], i * 3);
    this.life[i] = this.max[i] = o.life ?? 2; this.size[i] = o.size ?? 10; this.str[i] = o.stretch ?? 1;
    const c = o.color; this.col[i * 4] = c.r; this.col[i * 4 + 1] = c.g; this.col[i * 4 + 2] = c.b; this.col[i * 4 + 3] = o.alpha ?? 1;
    this.kind[i] = o.kind ?? 0; this.ang[i] = o.ang ?? 0;
    this.alpha0 = this.alpha0 ?? new Float32Array(this.n); this.alpha0[i] = o.alpha ?? 1;
    this.drag = this.drag ?? new Float32Array(this.n); this.drag[i] = o.drag ?? 0;
    this.grav = this.grav ?? new Float32Array(this.n); this.grav[i] = o.grav ?? 0;
  }
  update(dt, t) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; continue; }
      this.life[i] -= dt;
      const k = i * 3;
      this.v[k + 1] -= (this.grav?.[i] ?? 0) * dt;
      const dr = Math.exp(-(this.drag?.[i] ?? 0) * dt);
      this.v[k] *= dr; this.v[k + 1] *= dr; this.v[k + 2] *= dr;
      if (this.kind[i] === 1) this.v[k] += Math.sin(t * 2 + i) * dt * .4;   // embers wander
      this.p[k] += this.v[k] * dt; this.p[k + 1] += this.v[k + 1] * dt; this.p[k + 2] += this.v[k + 2] * dt;
      const f = this.life[i] / this.max[i];
      this.col[i * 4 + 3] = (this.alpha0?.[i] ?? 1) * Math.min(1, f * 3) * Math.min(1, (1 - f) * 6 + .2);
      if (this.str[i] > 1) this.ang[i] = Math.atan2(this.v[k], this.v[k + 1]);
    }
    for (const a of ['position', 'aColor', 'aSize', 'aAng', 'aStretch']) this.geo.attributes[a].needsUpdate = true;
  }
}

/* ================= the figures ================= */
export class Figure {
  constructor(look, size, o = {}) {
    this.rig = lookFor(look);
    this.look = look;
    const frameH = this.rig.frameH, feet = this.rig.feet;
    this.k = size * 2.5 / 400;                  // world units per frame pixel
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.parts = [];
    this.mats = [];
    this.facing = o.facing ?? 1;
    const k = this.k;
    for (const p of this.rig.parts) {
      const pivot = new THREE.Group();
      pivot.position.set((p.pivot[0] - FW / 2) * k, (feet - p.pivot[1]) * k, p.z * .012);
      this.body.add(pivot);
      for (const [crop, glow] of [[p.base, false], [p.glow, true]]) {
        if (!crop) continue;
        const tex = texOf(crop.canvas);
        const mat = glow ? glowMaterial(tex) : spriteMaterial(tex, { keyDir: -this.facing, lit: o.lit ?? 1 });
        const geo = new THREE.PlaneGeometry(crop.canvas.width * k, crop.canvas.height * k);
        const m = new THREE.Mesh(geo, mat);
        const cx = crop.x + crop.canvas.width / 2, cy = crop.y + crop.canvas.height / 2;
        m.position.set((cx - p.pivot[0]) * k, -(cy - p.pivot[1]) * k, glow ? .004 : 0);
        m.renderOrder = 10;
        pivot.add(m);
        if (!glow) this.mats.push(mat); else (this.glows ??= []).push(mat);
      }
      this.parts.push({ name: p.name, pivot, anim: p.anim, base: pivot.position.clone() });
    }
    if (this.facing < 0) this.body.scale.x = -1;
    this.height = (feet - this.rig.top) * k;
    this.width = 300 * k;
    this.hover = !!this.rig.hover;
    this.t = Math.random() * 10; this.speed = 1;
    // a shadow on the ground
    const sc = canvas(128, 64), sg = sc.getContext('2d');
    sg.fillStyle = rad(sg, 64, 32, 2, 60, [[0, 'rgba(0,0,0,.7)'], [1, 'rgba(0,0,0,0)']]); sg.scale(1, .5); sg.fillRect(0, 0, 128, 128);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(this.width * 1.1, this.width * .4), new THREE.MeshBasicMaterial({ map: texOf(sc), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = .02; this.shadow.renderOrder = 2;
    this.root.add(this.shadow);
    this.flash = 0; this.hi = 0; this.dissolve = 0; this.alpha = 1;
    this.off = new THREE.Vector3(); this.offV = new THREE.Vector3(); this.shake = 0;
    this.lunge = null;
  }
  setFloor(y) { for (const m of this.mats) m.uniforms.uFloor.value = y; }
  update(dt) {
    this.t += dt * this.speed;
    const t = this.t;
    for (const p of this.parts) {
      const a = p.anim; if (!a) continue;
      const ph = a.phase ?? 0, w = (a.speed ?? 1.5);
      if (a.rot) p.pivot.rotation.z = a.rot * Math.sin(t * w + ph) * (p.name.startsWith('wing') && this.flap ? 1.8 : 1);
      if (a.bob) p.pivot.position.y = p.base.y + a.bob * this.k * Math.sin(t * w + ph + 1);
      if (a.sway) p.pivot.position.x = p.base.x + a.sway * this.k * Math.sin(t * w * .7 + ph);
      if (a.breath) p.pivot.scale.y = 1 + a.breath * Math.sin(t * w + ph);
    }
    // body bob for hovering figures
    const hov = this.hover ? .18 + .1 * Math.sin(t * 1.3) : 0;
    // a scripted lunge or recoil
    if (this.lunge) {
      const L = this.lunge; L.t += dt;
      const u = Math.min(1, L.t / L.dur);
      const e = u < L.peak ? Math.sin(u / L.peak * Math.PI / 2) : Math.cos((u - L.peak) / (1 - L.peak) * Math.PI / 2);
      this.off.x = L.dx * e; this.off.y = (L.dy ?? 0) * e;
      this.body.rotation.z = (L.tilt ?? 0) * e;
      if (u >= 1) { this.lunge = null; this.off.set(0, 0, 0); this.body.rotation.z = 0; }
    }
    this.shake = Math.max(0, this.shake - dt * 3);
    this.body.position.set(this.off.x + (Math.random() - .5) * this.shake * .25, hov + this.off.y, 0);
    this.flash = Math.min(1, Math.max(0, this.flash - dt * 4));
    for (const m of this.mats) { const u = m.uniforms; u.uFlash.value = this.flash * .85; u.uHi.value = this.hi; u.uDissolve.value = this.dissolve; u.uAlpha.value = this.alpha; }
    for (const m of this.glows ?? []) m.opacity = this.alpha * (1 - this.dissolve);
    this.shadow.material.opacity = this.alpha * (1 - this.dissolve) * (this.hover ? .6 : 1);
  }
  // world point above the head (for cards and labels)
  top(v = new THREE.Vector3()) { return v.set(0, this.height + .15 + (this.hover ? .2 : 0), 0).applyMatrix4(this.root.matrixWorld); }
  feet(v = new THREE.Vector3()) { return v.set(0, 0, 0).applyMatrix4(this.root.matrixWorld); }
  center(v = new THREE.Vector3()) { return v.set(0, this.height * .55 + (this.hover ? .2 : 0), 0).applyMatrix4(this.root.matrixWorld); }
  doLunge(dx, o = {}) { this.lunge = { t: 0, dur: o.dur ?? .55, peak: o.peak ?? .3, dx, dy: o.dy ?? 0, tilt: o.tilt ?? 0 }; }
  hit(dir = 1) { this.flash = 1; this.shake = 1; this.doLunge(.35 * dir, { dur: .4, peak: .25, tilt: -.08 * dir }); }
  dispose() { this.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); o.material.uniforms?.map?.value?.dispose(); o.material.dispose(); } }); this.root.removeFromParent(); }
}

/* ================= the stage ================= */
const FOG_FRAG = `
  uniform float uTime, uAlpha; uniform vec3 uCol; varying vec2 vUv;
  float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
  float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  void main() { vec2 p = vUv * vec2(4., 1.5); float t = uTime * .03;
    float v = n(p + vec2(t, 0.)) * .5 + n(p * 2.1 - vec2(t * 1.6, t * .3)) * .3 + n(p * 4.3 + vec2(t * 2., 0.)) * .2;
    float edge = smoothstep(0., .25, vUv.y) * smoothstep(1., .55, vUv.y);
    gl_FragColor = vec4(uCol, smoothstep(.35, .85, v) * edge * uAlpha); }`;
const FOG_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

const LEDGE = -8.5, BACK_Z = -60;
const PAINTED = {};
const FIRE = new THREE.Color('#ffa040');   // each circle's paintings, made once   // the far edge of the ledge they fight on; beyond it, the abyss

export class Stage {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, .1, 200);
    this.layers = {};
    this.figures = [];
    this.angel = null;
    this.time = 0;
    this.drift = new THREE.Vector2();
    this.pointer = new THREE.Vector2();
    this.shakeAmt = 0;
    this.embers = new Particles(420, true);
    this.dust = new Particles(260, false);
    this.scene.add(this.embers.points, this.dust.points);
    this.circle = -1;
    this.view = { w: 1, h: 1, battleTop: 0, battleBottom: .62 };
    this.camBase = new THREE.Vector3(0, 3, 15); this.look = new THREE.Vector3(0, 2, 0);
    this.spawnAcc = 0;
  }
  setCircle(ci) {
    if (ci === this.circle) return;
    this.circle = ci;
    const L = this.look_ = CIRCLE_LOOK[ci];
    for (const k of Object.keys(this.layers)) { const m = this.layers[k]; m.removeFromParent(); m.traverse?.(o => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); o.material.uniforms?.map?.value?.dispose?.(); o.material.dispose(); } }); }
    this.layers = {};
    const tex = c => { const t = texOf(c); t.anisotropy = 4; return t; };
    const P = PAINTED[ci] ??= { back: paintBackdrop(L, ci), pillars: paintPillars(L, ci), ground: paintGround(L, ci) };
    // the far sky and cliffs
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(P.back), depthWrite: false, fog: false }));
    back.position.set(0, 24, BACK_Z); back.renderOrder = 0; this.scene.add(back); this.layers.back = back;
    // pillars
    const pil = new THREE.Mesh(new THREE.PlaneGeometry(64, 37.5), new THREE.MeshBasicMaterial({ map: tex(P.pillars), transparent: true, depthWrite: false }));
    pil.position.set(0, 14, -18); pil.renderOrder = 1; this.scene.add(pil); this.layers.pillars = pil;
    // the ledge
    const gt = tex(P.ground);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 20), new THREE.MeshBasicMaterial({ map: gt, color: new THREE.Color(1, 1, 1) }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, LEDGE + 10); ground.renderOrder = 1; this.scene.add(ground); this.layers.ground = ground;
    // the ledge's broken front lip, seen edge-on
    const lc = canvas(1024, 128), lg = lc.getContext('2d'), lr = rand(ci * 3 + 9);
    lg.fillStyle = mixc(L.rock, '#000000', .5); lg.beginPath(); lg.moveTo(0, 0);
    for (let x = 0; x <= 1024; x += 16) lg.lineTo(x, 8 + lr() * 18);
    lg.lineTo(1024, 128); lg.lineTo(0, 128); lg.closePath(); lg.fill();
    lg.fillStyle = lin(lg, 0, 0, 0, 128, [[0, rgba(L.rim, .25)], [.15, 'rgba(0,0,0,0)'], [1, rgba(L.glow, .15)]]); lg.fill();
    const lip = new THREE.Mesh(new THREE.PlaneGeometry(70, 2.4), new THREE.MeshBasicMaterial({ map: tex(lc), transparent: true, depthWrite: false }));
    lip.position.set(0, -1.15, LEDGE); lip.renderOrder = 1; this.scene.add(lip); this.layers.lip = lip;
    // the ledge's far edge drops into a glow
    const ec = canvas(16, 256), eg = ec.getContext('2d');
    eg.fillStyle = lin(eg, 0, 0, 0, 256, [[0, rgba(L.glow, 0)], [.6, rgba(L.glow, .45)], [1, rgba(L.glow, 0)]]); eg.fillRect(0, 0, 16, 256);
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(90, 6), new THREE.MeshBasicMaterial({ map: tex(ec), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    edge.position.set(0, -1.6, LEDGE - .6); edge.renderOrder = 1; this.scene.add(edge); this.layers.edge = edge;
    // drifting fog banks
    for (const [k, z, y, a] of [['fog1', -30, 4, .35], ['fog2', -12, 1.6, .22]]) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(110, 12), new THREE.ShaderMaterial({ vertexShader: FOG_VERT, fragmentShader: FOG_FRAG, transparent: true, depthWrite: false, uniforms: { uTime: LIGHT.uTime, uAlpha: { value: a }, uCol: { value: new THREE.Color(L.fog).multiplyScalar(1.6) } } }));
      f.position.set(0, y, z); f.renderOrder = 1; this.scene.add(f); this.layers[k] = f;
    }
    // things lying about on the ledge
    this.fires = [];
    this.props = [];
    SETS[ci].forEach(([kind, anchor, dx, z, size], i) => {
      const x = 0;
      const look = propLook(kind, L, ci * 31 + i);
      const grp = new THREE.Group();
      const k = size / 256;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), spriteMaterial(texOf(look.canvas), { keyDir: x > 0 ? -1 : 1, ink: .6 }));
      m.position.y = size / 2; m.renderOrder = 5; grp.add(m);
      if (look.glow) { const gm = new THREE.Mesh(new THREE.PlaneGeometry(size, size), glowMaterial(texOf(look.glow))); gm.position.set(0, size / 2, .01); gm.renderOrder = 6; grp.add(gm); }
      grp.position.set(x, 0, z);
      this.scene.add(grp); this.layers['prop' + i] = grp;
      grp.geometry = { dispose() {} }; grp.material = { dispose() {} };
      grp.userData.mats = [m.material];
      const fire = kind === 'brazier' || kind === 'tomb' ? new THREE.Vector3(x, size * .55, z) : null;
      if (fire) this.fires.push(fire);
      this.props.push({ grp, anchor, dx, z, fire });
    });
    // the light the figures stand in
    LIGHT.uAmb.value.set(L.light).lerp(new THREE.Color(1, 1, 1), .6).multiplyScalar(.95);
    LIGHT.uGlow.value.set(L.glow);
    LIGHT.uKey.value.set(L.rim);
    this.scene.background = new THREE.Color(L.sky[0]);
    this.weather = L.weather;
    this.emberCol = new THREE.Color(L.lava);
  }
  // Place the figures: the angel on the left, the demons in a row (or a diagonal on tall screens).
  setFigures(angel, demons) {
    for (const f of this.figures) if (!angel || f !== angel) { if (!demons.includes(f)) f.root.removeFromParent(); }
    this.angel = angel; this.figures = [angel, ...demons].filter(Boolean);
    for (const f of this.figures) if (!f.root.parent) this.scene.add(f.root);
    this.layout();
  }
  layout() {
    const { w, h } = this.view, aspect = w / h, tall = aspect < .9;
    this.tall = tall;
    const ds = this.figures.filter(f => f !== this.angel && !f.leaving);
    // the demons' row
    let x = tall ? -.6 : .9;
    const gap = tall ? .1 : .55;
    const xs = [];
    for (const d of ds) { xs.push(x + d.width * .5); x += d.width + gap; }
    const rowW = x - gap - (tall ? -.6 : .9);
    const maxH = Math.max(2.5, ...ds.map(d => d.height));
    ds.forEach((d, i) => {
      const z = tall ? (ds.length > 1 ? (i % 2 ? -3.4 : -.9) : -1.2) - (d.height > 4 ? 1 : 0) : (i % 2 ? -.9 : 0) - (d.height > 4 ? 1.2 : 0);
      d.home = new THREE.Vector3(xs[i] + (tall ? 0 : 0), 0, z);
      if (!d.placed) { d.root.position.copy(d.home); d.placed = true; }
    });
    const solo = !ds.length;
    if (this.angel) { this.angel.home = solo ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(tall ? -2.4 - (ds.length > 2 ? .4 : 0) : -4.6 - Math.max(0, rowW - 9) * .3, 0, tall ? 1.4 : .6); if (!this.angel.placed) { this.angel.root.position.copy(this.angel.home); this.angel.placed = true; } }
    // frame them: the whole group plus room above for the held cards
    const left = solo ? -4 : (this.angel?.home.x ?? 0) - 2.3, right = solo ? 4 : Math.max(left + 6, ...ds.map(d => d.home.x + d.width * .55)) + .4;
    const top = maxH + (tall ? 2.4 : 1.9), bottom = -.3;
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    for (const p of this.props ?? []) {
      const x = (p.anchor === 'L' ? left : p.anchor === 'R' ? right : cx) + p.dx;
      p.grp.position.set(x, 0, p.z);
      if (p.fire) p.fire.x = x;
    }
    const fov = this.camera.fov * Math.PI / 180, region = this.view.battleBottom - this.view.battleTop;
    const dW = (right - left) / 2 / (Math.tan(fov / 2) * aspect * .94), dH = (top - bottom) / 2 / (Math.tan(fov / 2) * region * .94);
    const D = Math.max(dW, dH, 9);
    this.camBase.set(cx, cy + D * .16, D + (tall ? -.6 : 0));
    this.look.set(cx, cy - .2, tall ? -1 : 0);
    // shift the picture so the battle sits in its band of the screen
    const centre = (this.view.battleTop + this.view.battleBottom) / 2;
    this.camera.setViewOffset(w, h, 0, (.5 - centre) * h, w, h);
    // the far backdrop's horizon sits just behind the floor's far edge, as seen from here
    if (this.layers.back) {
      const cz = this.camBase.z, cy2 = this.camBase.y, t = (cz - BACK_Z) / (cz - LEDGE);
      const yEdge = cy2 + (0 - cy2) * t;
      // as wide as the view at that depth, with room for the camera's drift; the painting keeps its shape
      const half = (cz - BACK_Z) * Math.tan(fov / 2), wide = 2 * half * Math.max(aspect, .8) * 1.35;
      this.layers.back.scale.set(wide, wide / 1.2, 1);
      this.layers.back.position.set(cx, yEdge + .6 + (HZ - .5) * wide / 1.2, BACK_Z);
    }
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.embers.mat.uniforms.uScale.value = h * .013;
    this.dust.mat.uniforms.uScale.value = h * .013;
  }
  resize(w, h, band) {
    this.view = { w, h, battleTop: band?.[0] ?? 0, battleBottom: band?.[1] ?? .64 };
    this.layout();
  }
  // world → CSS pixels
  project(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * .5 + .5) * this.view.w, y: (-p.y * .5 + .5) * this.view.h, z: p.z };
  }
  shake(a) { this.shakeAmt = Math.min(1.2, this.shakeAmt + a); }
  burst(pos, o = {}) {
    const n = o.n ?? 24, col = new THREE.Color(o.color ?? '#ffb060');
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = (o.speed ?? 3) * (.4 + Math.random() * .8);
      (o.dark ? this.dust : this.embers).spawn({ p: [pos.x, pos.y, pos.z + .3], v: [Math.cos(a) * s, Math.sin(a) * s * .8 + (o.up ?? 1), (Math.random() - .5) * s * .4], life: (o.life ?? .8) * (.6 + Math.random() * .6), size: (o.size ?? 26) * (.5 + Math.random()), color: col, alpha: o.alpha ?? 1, drag: 2, grav: o.grav ?? 2, kind: 0 });
    }
  }
  update(dt) {
    this.time += dt;
    LIGHT.uTime.value = this.time;
    const t = this.time;
    // the camera drifts a little, and leans toward the pointer
    this.drift.lerp(this.pointer, 1 - Math.exp(-dt * 2));
    const sh = this.shakeAmt * this.shakeAmt; this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.2);
    this.camera.position.set(this.camBase.x + Math.sin(t * .13) * .25 + this.drift.x * .5 + (Math.random() - .5) * sh * .3, this.camBase.y + Math.sin(t * .17) * .12 + this.drift.y * .25 + (Math.random() - .5) * sh * .3, this.camBase.z);
    this.camera.lookAt(this.look.x + this.drift.x * .2, this.look.y, this.look.z);
    // figures walk home if they've moved
    for (const f of this.figures) {
      if (f.home && !f.leaving) f.root.position.lerp(f.home, 1 - Math.exp(-dt * 4));
      f.update(dt);
      f.setFloor(f.root.position.y);
    }
    // weather
    this.spawnAcc += dt;
    const L = this.look_;
    while (this.spawnAcc > .03 && L) {
      this.spawnAcc -= .03;
      const x = this.look.x + (Math.random() - .5) * 34, z = -14 + Math.random() * 18;
      if (Math.random() < .5) this.embers.spawn({ p: [x, -.2, z], v: [(Math.random() - .5) * .3, .5 + Math.random() * .9, 0], life: 4 + Math.random() * 4, size: 9 + Math.random() * 14, color: this.emberCol, alpha: .55 + Math.random() * .45, kind: 1 });
      if (this.fires?.length && Math.random() < .5) { const f = this.fires[Math.floor(Math.random() * this.fires.length)]; this.embers.spawn({ p: [f.x + (Math.random() - .5) * .5, f.y, f.z + .1], v: [(Math.random() - .5) * .4, 1 + Math.random() * 1.4, 0], life: 1.2 + Math.random(), size: 10 + Math.random() * 10, color: FIRE, alpha: .9, kind: 1 }); }
      const wth = this.weather;
      if (wth === 'ash' || wth === 'embers') this.dust.spawn({ p: [x, 12, z], v: [(Math.random() - .5) * .3, -.5 - Math.random() * .4, 0], life: 10, size: 7 + Math.random() * 8, color: new THREE.Color(wth === 'ash' ? '#b8bcc8' : '#3a3030'), alpha: .5 });
      else if (wth === 'rain') for (let i = 0; i < 2; i++) this.dust.spawn({ p: [x + Math.random() * 3, 12, z], v: [-1.5, -14, 0], life: 1.2, size: 22, stretch: 6, color: new THREE.Color('#aab0a0'), alpha: .35 });
      else if (wth === 'snow') this.dust.spawn({ p: [x, 12, z], v: [.4 + Math.random() * .4, -.8 - Math.random() * .5, 0], life: 14, size: 10 + Math.random() * 10, color: new THREE.Color('#f4fbff'), alpha: .8 });
      else if (wth === 'wind') this.embers.spawn({ p: [this.look.x - 18, 1 + Math.random() * 9, z], v: [8 + Math.random() * 6, Math.sin(t) * .8, 0], life: 4, size: 26, stretch: 7, color: new THREE.Color('#ff7ab8'), alpha: .25, ang: Math.PI / 2 });
      else if (wth === 'gold') this.embers.spawn({ p: [x, 0, z], v: [0, .3 + Math.random() * .4, 0], life: 5, size: 8 + Math.random() * 8, color: new THREE.Color('#ffe08a'), alpha: .9, kind: 1 });
      else if (wth === 'spores') this.embers.spawn({ p: [x, Math.random() * 3, z], v: [(Math.random() - .5) * .3, .2 + Math.random() * .3, 0], life: 8, size: 10 + Math.random() * 10, color: new THREE.Color('#5affc8'), alpha: .6, kind: 1 });
      else if (wth === 'fire') this.embers.spawn({ p: [x, 12, z], v: [.5, -3 - Math.random() * 2, 0], life: 4, size: 18, stretch: 3, color: new THREE.Color('#ff7a2a'), alpha: .7 });
    }
    this.embers.update(dt, t); this.dust.update(dt, t);
  }
}
