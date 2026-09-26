// The booster pack: a foil pillow with crimped ends. Its top strip tears off along a line, following your finger,
// and the cards inside can then be pulled out of the opening.
import * as THREE from 'three';
import { mulberry, hashString } from './kit.js';
import { GOLD } from './faces.js';

export const PW = 7.6, PH = 12.2, CRIMP = .85, TEAR_Y = PH / 2 - 1.25, THICK = .5;
const NX = 56, NY_BODY = 60, NY_CAP = 10, TAU = Math.PI * 2;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const FONT = 'Fredoka, system-ui, sans-serif', BODY = 'Nunito, system-ui, sans-serif';

/* ---------- printed wrapper ---------- */
const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, c]) => gr.addColorStop(t, c)); return gr; };
function banner(g, x, y, w, h, fill, text, size) {
  g.save();
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.moveTo(x - 30, y + 8); g.lineTo(x + w + 30, y + 8); g.lineTo(x + w + 10, y + h / 2 + 8); g.lineTo(x + w + 30, y + h + 8); g.lineTo(x - 30, y + h + 8); g.lineTo(x - 10, y + h / 2 + 8); g.fill();
  g.fillStyle = fill; g.beginPath(); g.moveTo(x - 30, y); g.lineTo(x + w + 30, y); g.lineTo(x + w + 10, y + h / 2); g.lineTo(x + w + 30, y + h); g.lineTo(x - 30, y + h); g.lineTo(x - 10, y + h / 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 3; g.strokeRect(x + 4, y + 8, w - 8, h - 16);
  g.fillStyle = '#fff'; g.font = `700 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x + w / 2, y + h / 2 + 2);
  g.restore();
}
function starburst(g, x, y, r, n, fill) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU, rr = i % 2 ? r * .78 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fillStyle = fill; g.fill();
}
function logo(g, cx, y, size, dark) {
  g.save(); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.translate(cx, y); g.transform(1, 0, -.1, 1, 0, 0);
  g.font = `700 ${size}px ${FONT}`;
  g.lineJoin = 'round'; g.lineWidth = size * .26; g.strokeStyle = dark; g.strokeText('ODDS & ENDS', 0, 0);
  g.lineWidth = size * .1; g.strokeStyle = '#fff6d8'; g.strokeText('ODDS & ENDS', 0, 0);
  g.fillStyle = lin(g, 0, -size * .8, 0, 0, GOLD.map((c, i) => [i / (GOLD.length - 1), c])); g.fillText('ODDS & ENDS', 0, 0);
  g.restore();
}
// Front and back prints plus a roughness/metal map (G = roughness, B = metalness) for one wrapper design.
export function makeWrapper(set, wrap, hero, W = 1024) {
  const H = Math.round(W * PH / PW), [dark, mid, light] = wrap.colors;
  const yOf = u => H - (u / PH + .5) * H;           // pack y (units) → canvas y
  const front = document.createElement('canvas'); front.width = W; front.height = H;
  const g = front.getContext('2d');
  g.fillStyle = lin(g, 0, 0, 0, H, [[0, dark], [.35, mid], [.7, mid], [1, dark]]); g.fillRect(0, 0, W, H);
  const hy = H * .56;
  const rg = g.createRadialGradient(W / 2, hy, 30, W / 2, hy, W * .85); rg.addColorStop(0, light); rg.addColorStop(.5, mid + '00'); rg.addColorStop(1, mid + '00');
  g.fillStyle = rg; g.globalAlpha = .9; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  g.save(); g.globalCompositeOperation = 'screen';
  for (let i = 0; i < 32; i++) { const a0 = (i / 32) * TAU, a1 = a0 + TAU / 64; g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.moveTo(W / 2, hy); g.arc(W / 2, hy, H, a0, a1); g.closePath(); g.fill(); }
  const R = mulberry(hashString(wrap.hero));
  for (let i = 0; i < 90; i++) { const x = R() * W, y = R() * H, s = 2 + R() * 7; g.fillStyle = `rgba(255,255,255,${.2 + R() * .5})`; g.beginPath(); g.moveTo(x, y - s * 2); g.quadraticCurveTo(x, y, x + s * 2, y); g.quadraticCurveTo(x, y, x, y + s * 2); g.quadraticCurveTo(x, y, x - s * 2, y); g.quadraticCurveTo(x, y, x, y - s * 2); g.fill(); }
  g.restore();
  // hero item
  if (hero) { const hw = W * .98, hh = hw * hero.height / hero.width; g.drawImage(hero, (W - hw) / 2, hy - hh * .5, hw, hh); }
  // logo and series banner
  logo(g, W / 2 + 10, H * .205, W * .15, dark);
  g.fillStyle = '#fff'; g.font = `800 ${W * .034}px ${BODY}`; g.textAlign = 'center'; g.letterSpacing = '8px'; g.fillText('TRADING CARD GAME', W / 2, H * .237); g.letterSpacing = '0px';
  banner(g, W * .2, H * .258, W * .6, W * .1, wrap.accentInk ?? '#e8455a', set.name.toUpperCase(), W * .046);
  // stickers
  g.save(); g.translate(W * .83, H * .4); g.rotate(.2);
  starburst(g, 0, 0, W * .1, 14, wrap.accent); starburst(g, 0, 0, W * .085, 14, '#ffffff');
  g.fillStyle = '#e8455a'; g.font = `700 ${W * .036}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('HOLO', 0, -W * .018); g.font = `800 ${W * .022}px ${BODY}`; g.fillStyle = '#2b2233'; g.fillText('CHANCE!', 0, W * .024);
  g.restore();
  g.save(); g.translate(W * .16, H * .87);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(4, 6, W * .085, 0, TAU); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, W * .085, 0, TAU); g.fill();
  g.lineWidth = 6; g.strokeStyle = wrap.accent; g.stroke();
  g.fillStyle = dark; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${W * .07}px ${FONT}`; g.fillText('9', 0, -W * .012);
  g.font = `800 ${W * .02}px ${BODY}`; g.fillText('CARDS', 0, W * .045);
  g.restore();
  g.fillStyle = 'rgba(255,255,255,.9)'; g.font = `800 ${W * .024}px ${BODY}`; g.textAlign = 'right'; g.fillText(`${set.series.toUpperCase()} · ${set.code}`, W * .92, H * .885);
  // crimps and the tear line
  for (const [y0, y1] of [[0, H * CRIMP / PH], [H - H * CRIMP / PH, H]]) {
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, y0, W, y1 - y0);
    for (let x = 0; x < W; x += 9) { g.fillStyle = x % 18 ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.18)'; g.fillRect(x, y0, 4, y1 - y0); }
  }
  const ty = yOf(TEAR_Y);
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 4; g.setLineDash([16, 12]);
  g.beginPath(); g.moveTo(W * .1, ty); g.lineTo(W, ty); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#fff'; g.font = `700 ${W * .03}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('✂', W * .03, ty);
  g.font = `800 ${W * .017}px ${BODY}`; g.fillText('TEAR HERE', W * .75, ty - W * .028);

  // back
  const back = document.createElement('canvas'); back.width = W; back.height = H;
  const b = back.getContext('2d');
  b.fillStyle = lin(b, 0, 0, 0, H, [[0, dark], [.5, mid], [1, dark]]); b.fillRect(0, 0, W, H);
  b.save(); b.globalAlpha = .12; b.fillStyle = '#fff';
  for (let y = 60, row = 0; y < H; y += 90, row++) for (let x = 40 + (row % 2) * 45; x < W; x += 90) { b.beginPath(); b.arc(x, y, 5, 0, TAU); b.fill(); }
  b.restore();
  for (const [y0, y1] of [[0, H * CRIMP / PH], [H - H * CRIMP / PH, H]]) {
    b.fillStyle = 'rgba(0,0,0,.28)'; b.fillRect(0, y0, W, y1 - y0);
    for (let x = 0; x < W; x += 9) { b.fillStyle = x % 18 ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.18)'; b.fillRect(x, y0, 4, y1 - y0); }
  }
  b.fillStyle = 'rgba(0,0,0,.2)'; b.fillRect(W / 2 - 22, 0, 44, H);           // the fin seam down the middle
  b.fillStyle = 'rgba(255,255,255,.18)'; b.fillRect(W / 2 - 22, 0, 6, H);
  logo(b, W / 2, H * .2, W * .1, dark);
  const panel = (y, h) => { b.fillStyle = 'rgba(255,255,255,.92)'; b.beginPath(); b.roundRect(W * .1, y, W * .8, h, 28); b.fill(); };
  panel(H * .26, H * .3);
  b.fillStyle = '#231d2b'; b.textAlign = 'left'; b.textBaseline = 'alphabetic';
  b.font = `700 ${W * .045}px ${FONT}`; b.fillText('Each pack holds 9 cards', W * .15, H * .3);
  b.font = `600 ${W * .032}px ${BODY}`;
  const top = r => Math.max(0, ...set.items.filter(i => i.rarity === r).map(i => i.price)), usd = c => '$' + (c / 100).toFixed(c % 100 ? 2 : 0);
  const tiers = set.tiers ?? { C: `worth up to ${usd(top('C'))}`, U: `worth up to ${usd(top('U'))}`, R: 'worth anything' };
  [['●', '5 Common', tiers.C], ['◆', '3 Uncommon', tiers.U], ['★', '1 Rare', tiers.R]].forEach(([s, a, c], i) => {
    const y = H * .345 + i * W * .07; b.fillStyle = i === 2 ? '#c8901c' : '#231d2b'; b.fillText(s, W * .15, y); b.fillStyle = '#231d2b'; b.fillText(a, W * .21, y); b.fillStyle = '#6a6275'; b.fillText(c, W * .55, y);
  });
  b.font = `600 ${W * .028}px ${BODY}`; b.fillStyle = '#231d2b';
  b.fillText('1 card in 40 is Holo (worth 5×).', W * .15, H * .5); b.fillText('1 in 20 is Full Art (2×). Both: 50×!', W * .15, H * .53);
  panel(H * .6, H * .2);
  b.fillStyle = '#231d2b'; b.font = `700 ${W * .036}px ${FONT}`; b.fillText(`Collect all ${set.items.length}!`, W * .15, H * .645);
  b.font = `italic 600 ${W * .026}px ${BODY}`; b.fillStyle = '#6a6275';
  const lines = (set.blurb || '').match(/.{1,38}(\s|$)/g) || []; lines.slice(0, 3).forEach((l, i) => b.fillText(l.trim(), W * .15, H * .69 + i * W * .04));
  // barcode
  b.fillStyle = '#fff'; b.fillRect(W * .58, H * .84, W * .3, H * .07); b.fillStyle = '#111';
  for (let x = W * .6, i = 0; x < W * .86; i++) { const w = 2 + (R() * 4 | 0); if (i % 2) b.fillRect(x, H * .848, w, H * .045); x += w + 2; }
  b.font = `600 ${W * .016}px ${BODY}`; b.fillText('0 12345 67890 5', W * .6, H * .905);
  b.fillStyle = 'rgba(255,255,255,.75)'; b.font = `600 ${W * .018}px ${BODY}`; b.fillText('Not a toy. Well, it is a toy.', W * .12, H * .88);

  // roughness (G) and metalness (B): foil everywhere except the white ink
  const orm = document.createElement('canvas'); orm.width = W / 4; orm.height = H / 4;
  const o = orm.getContext('2d');
  o.fillStyle = 'rgb(0,80,255)'; o.fillRect(0, 0, orm.width, orm.height);
  o.fillStyle = 'rgb(0,150,40)';
  o.save(); o.scale(.25, .25);
  o.fillRect(W * .2 - 30, H * .258, W * .6 + 60, W * .1);
  o.beginPath(); o.arc(W * .16, H * .87, W * .085, 0, TAU); o.fill();
  o.beginPath(); o.arc(W * .83, H * .4, W * .1, 0, TAU); o.fill();
  o.restore();
  return { front, back, orm };
}

// Foil crinkles and the crimp ridges, as a normal map.
function crinkleNormals(w = 256, h = 412) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), R = mulberry(99);
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  g.filter = 'blur(1.5px)';
  for (let i = 0; i < 60; i++) {
    const x = R() * w, y = R() * h, a = R() * Math.PI, l = 20 + R() * 90;
    g.strokeStyle = R() < .5 ? `rgba(255,255,255,${.2 + R() * .3})` : `rgba(0,0,0,${.2 + R() * .3})`; g.lineWidth = 1 + R() * 2.5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.filter = 'none';
  const cr = Math.round(h * CRIMP / PH);
  for (const y0 of [0, h - cr]) for (let x = 0; x < w; x += 3) { g.fillStyle = x % 6 ? '#b0b0b0' : '#505050'; g.fillRect(x, y0, 2, cr); }
  const src = g.getImageData(0, 0, w, h).data, out = g.createImageData(w, h), d = out.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * 2.2, dy = (H(x, y + 1) - H(x, y - 1)) * 2.2;
    const n = new THREE.Vector3(-dx, dy, 1).normalize(), i = (y * w + x) * 4;
    d[i] = (n.x * .5 + .5) * 255; d[i + 1] = (n.y * .5 + .5) * 255; d[i + 2] = (n.z * .5 + .5) * 255; d[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  return t;
}

/* ---------- geometry ---------- */
function thickness(x, y) {
  const sx = Math.min(1, Math.abs(x) / (PW / 2));
  const side = Math.sqrt(Math.max(0, 1 - Math.pow(sx, 6)));
  const top = PH / 2 - CRIMP, bot = -PH / 2 + CRIMP;
  return .014 + THICK * side * smooth(0, .6, top - y) * smooth(0, .6, y - bot);
}
// One layer of foil between per-column bottom and top edges. side +1 is the front (faces +z), −1 the back.
function layer(y0, y1, rows, side, wobble) {
  const nV = (NX + 1) * (rows + 1), pos = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), idx = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= NX; i++) {
    const k = j * (NX + 1) + i, x = (i / NX - .5) * PW, y = y0[i] + (y1[i] - y0[i]) * (j / rows);
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = side * (thickness(x, y) / 2 + wobble(x, y));
    uv[k * 2] = side > 0 ? x / PW + .5 : .5 - x / PW; uv[k * 2 + 1] = y / PH + .5;
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 2, d = a + NX + 1;
    if (side > 0) idx.push(a, b, d, b, c, d); else idx.push(a, d, b, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  geo.userData.base = pos.slice();
  return geo;
}

let NORMALS = null, INNER = null, GUIDE_TEX = null;
export class Pack {
  constructor(set, wrapper, prints) {
    this.set = set; this.wrapper = wrapper;
    const R = mulberry(7);
    const zig = i => (i % 2 ? .11 : 0);
    const jag = Array.from({ length: NX + 1 }, (_, i) => TEAR_Y + (R() - .5) * .07 + (i % 2 ? .025 : -.025));
    this.jag = jag;
    const bottom = Array.from({ length: NX + 1 }, (_, i) => -PH / 2 + zig(i)), top = Array.from({ length: NX + 1 }, (_, i) => PH / 2 - zig(i));
    const wob = (x, y) => .012 * Math.sin(x * 3.1 + y * 1.7) * Math.sin(y * 2.3 - x) * smooth(0, .8, PH / 2 - CRIMP - Math.abs(y));
    NORMALS ??= crinkleNormals();
    // one set of textures and materials per wrapper design, shared by every pack that wears it
    const shared = prints.materials ??= (() => {
      const tex = (c, color) => { const t = new THREE.CanvasTexture(c); if (color) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
      const orm = tex(prints.orm, false);
      const mat = map => new THREE.MeshPhysicalMaterial({ map, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: .92, normalMap: NORMALS, normalScale: new THREE.Vector2(.35, .35),
        clearcoat: .8, clearcoatRoughness: .18, envMapIntensity: 1.6, iridescence: .55, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 560] });
      return { front: mat(tex(prints.front, true)), back: mat(tex(prints.back, true)) };
    })();
    INNER ??= new THREE.MeshStandardMaterial({ color: 0xd7dce4, metalness: 1, roughness: .32, side: THREE.BackSide, normalMap: NORMALS, normalScale: new THREE.Vector2(.5, .5) });
    this.frontMat = shared.front; this.backMat = shared.back; this.innerMat = INNER;
    this.group = new THREE.Group();
    this.body = new THREE.Group(); this.cap = new THREE.Group();
    this.group.add(this.body, this.cap);
    const add = (parent, geo, outer) => { const a = new THREE.Mesh(geo, outer), b = new THREE.Mesh(geo, this.innerMat); parent.add(a, b); return geo; };
    this.bodyGeo = [add(this.body, layer(bottom, jag, NY_BODY, 1, wob), this.frontMat), add(this.body, layer(bottom, jag, NY_BODY, -1, wob), this.backMat)];
    this.capGeo = [add(this.cap, layer(jag, top, NY_CAP, 1, wob), this.frontMat), add(this.cap, layer(jag, top, NY_CAP, -1, wob), this.backMat)];
    // the card slot: where the stack rides inside the pack
    this.slot = new THREE.Group(); this.group.add(this.slot);
    // a glowing dotted guide along the tear line
    GUIDE_TEX ??= (() => {
      const gc = document.createElement('canvas'); gc.width = 512; gc.height = 32;
      const gg = gc.getContext('2d'); gg.fillStyle = '#fff';
      for (let x = 5; x < 512; x += 22) { gg.beginPath(); gg.roundRect(x, 9, 13, 14, 7); gg.fill(); }
      return new THREE.CanvasTexture(gc);
    })();
    // dots along the tear line, with a bright sweep running across them to show the way to swipe
    this.guideU = { map: { value: GUIDE_TEX }, uTime: { value: 0 }, uOpacity: { value: 0 } };
    this.guide = new THREE.Mesh(new THREE.PlaneGeometry(PW * .98, .3), new THREE.ShaderMaterial({ uniforms: this.guideU, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform sampler2D map; uniform float uTime, uOpacity; varying vec2 vUv;
        void main() {
          float dots = texture2D(map, vUv).r;
          float x = fract(uTime * .42) * 1.6 - .3, sweep = exp(-pow((vUv.x - x) * 6., 2.));
          float a = dots * (.35 + 1.6 * sweep) * uOpacity;
          gl_FragColor = vec4(vec3(1., .93, .7) * a, a);
        }` }));
    this.guide.position.set(0, TEAR_Y, thickness(0, TEAR_Y) / 2 + .03);
    this.group.add(this.guide);
    this.tear = 0; this.dir = 0; this.front = null; this.detached = false; this.open = 0; this.openShown = 0;
    this.capVel = new THREE.Vector3(); this.capSpin = new THREE.Vector3(); this.capLife = 0;
  }
  // Where the tear front is, 0–1 across, and whether the strip has come off.
  get progress() { return this.dir === 0 || this.front == null ? 0 : this.dir > 0 ? (this.front + PW / 2) / PW : (PW / 2 - this.front) / PW; }
  startTear(dir) { if (!this.dir) { this.dir = dir; this.front = -dir * (PW / 2 + .05); } }
  // Pull the tear front toward a local x (it only ever moves forward).
  tearToward(x) { if (!this.dir || this.detached) return; this.target = this.dir > 0 ? Math.max(this.target ?? this.front, x) : Math.min(this.target ?? this.front, x); }
  frontWorld(v = new THREE.Vector3()) { return v.set(this.front ?? 0, this.jag[Math.round(((this.front ?? 0) / PW + .5) * NX)] ?? TEAR_Y, thickness(0, TEAR_Y) / 2 + .05).applyMatrix4(this.group.matrixWorld); }
  update(dt) {
    let moved = 0;
    if (this.dir && !this.detached && this.target != null) {
      const before = this.front;
      this.front += (this.target - this.front) * Math.min(1, dt * 16);
      moved = Math.abs(this.front - before);
      this.deformCap();
      if (this.progress >= 1.04) this.detach();
    }
    if (this.detached && this.cap.parent) {
      this.capLife += dt;
      this.capVel.y -= 26 * dt;
      this.cap.position.addScaledVector(this.capVel, dt);
      this.cap.rotation.x += this.capSpin.x * dt; this.cap.rotation.y += this.capSpin.y * dt; this.cap.rotation.z += this.capSpin.z * dt;
      if (this.capLife > 2.5) this.cap.removeFromParent();
    }
    if (Math.abs(this.open - this.openShown) > .001) { this.openShown += (this.open - this.openShown) * Math.min(1, dt * 10); this.deformBody(); }
    return moved;
  }
  deformCap() {
    const f = this.front, dir = this.dir;
    for (const geo of this.capGeo) {
      const p = geo.attributes.position, base = geo.userData.base;
      for (let k = 0; k < p.count; k++) {
        const bx = base[k * 3], by = base[k * 3 + 1], bz = base[k * 3 + 2];
        const i = Math.round((bx / PW + .5) * NX), yt = this.jag[i], d = dir > 0 ? f - bx : bx - f;
        if (d <= 0) { p.setXYZ(k, bx, by, bz); continue; }
        const th = 1.25 * smooth(0, 2.4, d) + .25 * smooth(1.5, 5, d), yy = by - yt, c = Math.cos(th), s = Math.sin(th);
        p.setXYZ(k, bx + dir * .12 * smooth(0, 3, d), yt + yy * c - bz * s + .08 * smooth(0, 2, d), yy * s + bz * c + .06 * Math.min(d, 3));
      }
      p.needsUpdate = true; geo.computeVertexNormals();
    }
  }
  deformBody() {
    const o = this.openShown;
    this.bodyGeo.forEach((geo, side) => {
      const p = geo.attributes.position, base = geo.userData.base, sgn = side ? -1 : 1;
      for (let k = 0; k < p.count; k++) {
        const x = base[k * 3], y = base[k * 3 + 1];
        const t = smooth(TEAR_Y - 2.2, TEAR_Y, y) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(x) / (PW / 2), 4)));
        p.setZ(k, base[k * 3 + 2] + sgn * o * t * (side ? .16 : .34));
      }
      p.needsUpdate = true; geo.computeVertexNormals();
    });
  }
  detach() {
    if (this.detached) return;
    this.detached = true;
    this.guide.visible = false;
    this.front = this.dir * (PW / 2 + .3); this.deformCap();
    // hand the strip to the world so it can fall on its own
    const world = this.group.parent;
    this.group.updateMatrixWorld();
    if (world) world.attach(this.cap);
    this.capVel.set(this.dir * 9, 7, 3);
    this.capSpin.set(-2.5, this.dir * 1.5, -this.dir * 4.5);
    this.open = 1;
  }
  dispose() {   // materials and textures are shared between packs, so only the shapes go
    for (const g of [...this.bodyGeo, ...this.capGeo]) g.dispose();
    this.guide.geometry.dispose(); this.guide.material.dispose();
    this.cap.removeFromParent(); this.group.removeFromParent(); this.holder?.removeFromParent();
  }
}

// A soft, colorful studio for the foil to reflect: bright boxes of light around a dark room.
export function foilEnvironment(renderer) {
  const scene = new THREE.Scene();
  // a dim room that's lighter above than below, so the foil always has something to reflect
  const room = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying vec3 vP; void main() { float h = normalize(vP).y; gl_FragColor = vec4(mix(vec3(.08, .06, .14), vec3(.55, .5, .7), smoothstep(-.4, .9, h)), 1.); }' }));
  scene.add(room);
  const box = (color, intensity, pos, size) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }));
    m.position.set(...pos); m.lookAt(0, 0, 0); scene.add(m);
  };
  box('#ffffff', 6, [-4, 6, 8], [9, 5, .2]);
  box('#ffffff', 3, [5, 4, 9], [3, 3, .2]);
  box('#ffe2b0', 2.2, [7, 2, 5], [3, 9, .2]);
  box('#ff6fc8', 2, [-9, -1, 2], [2, 10, .2]);
  box('#5fd0ff', 2, [9, -4, -2], [2, 8, .2]);
  box('#b69cff', 1.4, [0, -9, 4], [12, 1.5, .2]);
  box('#ffffff', 1.5, [0, 10, -6], [14, 2, .2]);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(scene, .02).texture;
  pm.dispose();
  return env;
}
