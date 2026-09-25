// The 3D furniture: the same pieces as pieces.js, built from boards, legs, rails and knobs in waxed wood,
// paint, rush and fabric, with the grain running along each board. A piece's parts are merged into one
// mesh per material. x runs left–right (the plane the physics lives in), z front–back.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry } from './pieces.js';

const TAU = Math.PI * 2;
const pick = (R, arr) => arr[R() * arr.length | 0];

/* ---------- textures (grey, tinted by each material's colour; also used as bump maps) ---------- */
function canvasTexture(w, h, paint) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  paint(img.data, w, h);
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
// Growth rings running along v, wandering a little, over fine fibres. Tiles in both directions.
function grain(contrast, rings, seed) {
  const R = mulberry(seed);
  return canvasTexture(256, 512, (d, w, h) => {
    const fib = Array.from({ length: w }, R), sm = fib.map((v, x) => (v * 2 + fib[(x + 1) % w] + fib[(x + w - 1) % w]) / 4);
    const p = [R(), R(), R()].map(v => v * TAU);
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const warp = .03 * Math.sin(TAU * 2 * v + p[0] + TAU * u) + .016 * Math.sin(TAU * 5 * v + p[1] + TAU * 2 * u) + .005 * Math.sin(TAU * 13 * v + p[2]);
        const r = (u + warp) * rings, f = r - Math.floor(r);
        const late = Math.pow(f, 4) * .7 + Math.pow(1 - Math.abs(f * 2 - 1), 12) * .4;
        const val = 1 - contrast * (late * .62 + sm[x] * .3 + R() * .06);
        const i = (y * w + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, val * 255)); d[i + 3] = 255;
      }
    }
  });
}
// Plain weave for cushions and rush seats.
function weave(seed, cell) {
  const R = mulberry(seed);
  return canvasTexture(128, 128, (d, w, h) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const over = ((x / cell | 0) + (y / cell | 0)) & 1;
      const t = Math.sin(((over ? y : x) % cell + .5) / cell * Math.PI);
      const val = .62 + .34 * t - R() * .06;
      const i = (y * w + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = val * 255; d[i + 3] = 255;
    }
  });
}
let TEX = null;
const textures = () => TEX || (TEX = { wood: grain(.55, 14, 11), paint: grain(.09, 22, 5), cloth: weave(3, 4), rush: weave(9, 8) });

/* ---------- finishes ---------- */
const WOODS = [0xd8a868, 0x7d5638, 0xae6443, 0xe9c28a, 0xecdcbf, 0xab7746, 0x8e432d];   // oak, walnut, cherry, pine, ash, teak, mahogany
const PAINTS = [0xf3ecdc, 0xa9c4a2, 0xe6b24a, 0xea836c, 0x4c9a96, 0x42578a, 0xf0b3c0, 0x383431, 0x92bbe0, 0xcc4a40];
const FABRICS = [0xc3483d, 0x36638a, 0xdbb660, 0x729a60, 0xebe4d4, 0x8e5e9e, 0xe07d40];
const METALS = [{ kind: 'brass', color: 0xd0a650 }, { kind: 'iron', color: 0x2e2e33 }, { kind: 'chrome', color: 0xdfe3e8 }];

export function finishFor(p) {
  const R = mulberry(p.seed ^ 0x2f6b1d3);
  const wood = { kind: 'wood', color: pick(R, WOODS) }, paint = { kind: 'paint', color: pick(R, PAINTS) };
  const r = R();
  const f = r < .45 ? { top: wood, frame: wood } : r < .72 ? { top: wood, frame: paint } : { top: paint, frame: paint };
  f.accent = f.frame.kind === 'paint' && f.top.kind === 'wood' ? f.top : f.frame;
  f.fabric = { kind: 'cloth', color: pick(R, FABRICS) };
  f.rush = { kind: 'rush', color: 0xd3b173 };
  f.metal = pick(R, METALS);
  f.iron = { kind: 'iron', color: 0x2b2b30 };
  f.dark = { kind: 'dark', color: 0x21180f };
  if (p.type === 'bistro' && R() < .4) f.top = { kind: 'stone', color: 0xefebe4 };
  return f;
}

function material(f) {
  const T = textures();
  switch (f.kind) {
    case 'wood': return new THREE.MeshStandardMaterial({ color: f.color, map: T.wood, bumpMap: T.wood, bumpScale: .9, roughness: .56 });
    case 'paint': return new THREE.MeshStandardMaterial({ color: f.color, map: T.paint, bumpMap: T.paint, bumpScale: .5, roughness: .48 });
    case 'stone': return new THREE.MeshStandardMaterial({ color: f.color, map: T.paint, roughness: .22 });
    case 'cloth': return new THREE.MeshStandardMaterial({ color: f.color, map: T.cloth, bumpMap: T.cloth, bumpScale: 1.5, roughness: .95 });
    case 'rush': return new THREE.MeshStandardMaterial({ color: f.color, map: T.rush, bumpMap: T.rush, bumpScale: 2, roughness: .9 });
    case 'brass': return new THREE.MeshStandardMaterial({ color: f.color, metalness: 1, roughness: .3 });
    case 'chrome': return new THREE.MeshStandardMaterial({ color: f.color, metalness: 1, roughness: .14 });
    case 'iron': return new THREE.MeshStandardMaterial({ color: f.color, metalness: .55, roughness: .52 });
    default: return new THREE.MeshStandardMaterial({ color: f.color, roughness: 1 });
  }
}

/* ---------- geometry kit ---------- */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();

// Box UVs in world units, with v along the board's longest side so the grain follows it.
function boxUV(g, dims, s, R) {
  const long = dims.indexOf(Math.max(...dims)), pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  const ou = R(), ov = R(), c = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    const na = nx > ny ? (nx > nz ? 0 : 2) : (ny > nz ? 1 : 2);
    c[0] = pos.getX(i); c[1] = pos.getY(i); c[2] = pos.getZ(i);
    let u, v;
    if (na !== long) { u = c[3 - na - long]; v = c[long]; } else { u = c[(na + 1) % 3]; v = c[(na + 2) % 3] * .3; }   // end grain
    uv.setXY(i, ou + u / s, ov + v / s);
  }
}
function scaleUV(g, su, sv, R) {
  const uv = g.attributes.uv, ou = R(), ov = R();
  for (let i = 0; i < uv.count; i++) uv.setXY(i, ou + uv.getX(i) * su, ov + uv.getY(i) * sv);
}
// A turned leg's profile: [radius, height] as fractions, foot to top. The top block is added as a box.
const TURNED = [[0, 0], [.62, 0], [.66, .02], [.5, .05], [.46, .1], [.52, .16], [.68, .27], [.72, .31], [.6, .38], [.42, .46], [.4, .56],
  [.5, .62], [.56, .66], [.44, .7], [.62, .75], [.66, .78], [.5, .8], [.5, .83], [0, .83]];

class Kit {
  constructor(s, seed) { this.geos = {}; this.s = s; this.R = mulberry(seed); }
  put(key, g, x = 0, y = 0, z = 0, rz = 0, rx = 0) {
    _e.set(rx, 0, rz); _q.setFromEuler(_e); _p.set(x, y, z);
    g.applyMatrix4(_m.compose(_p, _q, _one));
    (this.geos[key] ||= []).push(g);
  }
  // A board centred at (x, y, z), turned rz about z, with softened edges.
  board(key, w, h, d, x, y, z, rz = 0, round = 0) {
    const r = Math.min(round, Math.min(w, h, d) * .45);
    const g = r > 1e-4 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
    boxUV(g, [w, h, d], this.s, this.R);
    this.put(key, g, x, y, z, rz);
  }
  // An upright cylinder centred at (x, y, z), radius r0 at the bottom and r1 at the top.
  cyl(key, r0, r1, h, x, y, z, segs = 24) {
    const g = new THREE.CylinderGeometry(r1, r0, h, segs);
    scaleUV(g, TAU * r1 / this.s, h / this.s, this.R);
    this.put(key, g, x, y, z);
  }
  sphere(key, r, x, y, z) {
    const g = new THREE.SphereGeometry(r, 14, 10);
    scaleUV(g, TAU * r / this.s, Math.PI * r / this.s, this.R);
    this.put(key, g, x, y, z);
  }
  // A leg, post or rail from a to b ([x, y, z]), wa thick at a and wb at b.
  stick(key, style, a, b, wa, wb) {
    _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = _d.length(), w = Math.max(wa, wb), gs = [];
    _d.divideScalar(len);
    if (style === 'turned') {
      const lathe = new THREE.LatheGeometry(TURNED.map(([r, y]) => new THREE.Vector2(r * w / 2 * 1.25, y * len)), 14);
      scaleUV(lathe, TAU * w / 2 / this.s, len / this.s, this.R);
      const block = new THREE.BoxGeometry(w, len * .18, w).translate(0, len * .91, 0);
      boxUV(block, [w, len * .18, w], this.s, this.R);
      gs.push(lathe, block);
    } else if (style === 'round') {
      const g = new THREE.CylinderGeometry(wb / 2, wa / 2, len, 14).translate(0, len / 2, 0);
      scaleUV(g, TAU * w / 2 / this.s, len / this.s, this.R);
      gs.push(g);
    } else {   // square, tapering from wa to wb
      const g = new THREE.BoxGeometry(1, len, 1), pos = g.attributes.position;
      boxUV(g, [1, len * 9, 1], this.s, this.R);
      for (let i = 0; i < pos.count; i++) {
        const k = wa + (wb - wa) * (pos.getY(i) / len + .5);
        pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) + len / 2, pos.getZ(i) * k);
      }
      g.computeVertexNormals();
      gs.push(g);
    }
    _q.setFromUnitVectors(_up, _d); _p.set(a[0], a[1], a[2]);
    _m.compose(_p, _q, _one);
    for (const g of gs) { g.applyMatrix4(_m); (this.geos[key] ||= []).push(g); }
  }
  build(mats) {
    const group = new THREE.Group();
    for (const key in this.geos) {
      // rounded boxes come without an index, so everything goes in without one
      const parts = this.geos[key].map(g => g.index ? g.toNonIndexed() : g), geo = mergeGeometries(parts);
      for (const g of [...this.geos[key], ...parts]) g.dispose();
      const mesh = new THREE.Mesh(geo, mats[key]);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}

/* ---------- the pieces ---------- */
function table(k, d) {
  const { W, H, D, t, lw, lwb, lx, lz, ap, at, style, shelf, st } = d, hb = H - t, inset = lw * .12, ay = hb - ap / 2;
  k.board('top', W, t, D, 0, H - t / 2, 0, 0, t * .3);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.stick('frame', style, [sx * lx, 0, sz * lz], [sx * lx, hb, sz * lz], lwb, lw);
  for (const sz of [-1, 1]) k.board('frame', 2 * lx, ap, at, 0, ay, sz * (lz + lw / 2 - at / 2 - inset));
  for (const sx of [-1, 1]) k.board('frame', at, ap, 2 * lz, sx * (lx + lw / 2 - at / 2 - inset), ay, 0);
  if (shelf) k.board('top', 2 * lx + lw * .4, st, 2 * lz + lw * .4, 0, shelf, 0, 0, st * .3);
}

function bistro(k, d) {
  const { W, H, t, cw, fh, F, round, foot } = d, hb = H - t;
  if (round) k.cyl('top', W / 2, W / 2, t, 0, H - t / 2, 0, 56); else k.board('top', W, t, W, 0, H - t / 2, 0, 0, t * .3);
  k.cyl('iron', cw * 1.5, cw * 1.2, t * .7, 0, hb - t * .35, 0, 20);
  k.cyl('iron', cw * .55, cw * .5, hb - fh, 0, (fh + hb) / 2, 0, 18);
  k.cyl('iron', cw * .7, cw * .55, cw * .6, 0, hb * .5, 0, 18);
  k.cyl('iron', cw * 1.1, cw * .55, fh * 1.8, 0, fh * 1.9, 0, 18);
  if (foot === 'disc') {
    k.cyl('iron', F / 2, F / 2 * .94, fh * .7, 0, fh * .35, 0, 48);
    k.cyl('iron', F / 2 * .9, F / 2 * .5, fh * .3, 0, fh * .85, 0, 48);
  } else {
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const len = F / 2 - fh * .6;
      k.board('iron', sx ? len : fh * 1.3, fh, sz ? len : fh * 1.3, sx * len / 2, fh / 2, sz * len / 2, 0, fh * .2);
      k.cyl('iron', fh * .7, fh * .65, fh, sx * (F / 2 - fh * .7), fh / 2, sz * (F / 2 - fh * .7), 12);
    }
  }
}

function desk(k, d) {
  const { W, H, D, t, pw, lw, lx, px, ap, at, lz, F, drawers } = d, hb = H - t, fz = D * .46;
  k.board('top', W, t, D, 0, H - t / 2, 0, 0, t * .3);
  k.board('frame', pw, hb, D * .92, px, hb / 2, 0, 0, lw * .08);
  const gap = hb * .035, dh = (hb - gap * (drawers + 1)) / drawers;
  for (let i = 0; i < drawers; i++) {
    const y = gap + dh / 2 + i * (dh + gap);
    k.board('accent', pw * .84, dh, t * .35, px, y, fz + t * .17, 0, t * .07);
    k.sphere('metal', Math.min(pw, dh) * .065, px, y, fz + t * .35 + Math.min(pw, dh) * .05);
  }
  for (const sz of [-1, 1]) k.stick('frame', 'square', [lx, 0, sz * lz], [lx, hb, sz * lz], lw * .8, lw);
  const ax0 = -F / 2 + pw, ax1 = lx;
  for (const sz of [-1, 1]) k.board('frame', ax1 - ax0, ap, at, (ax0 + ax1) / 2, hb - ap / 2, sz * (lz + lw / 2 - at / 2));
  k.board('frame', at, ap, 2 * lz, lx + lw / 2 - at / 2, hb - ap / 2, 0);
  k.board('accent', (ax1 - ax0) * .5, ap * .7, t * .3, (ax0 + ax1) / 2, hb - ap / 2, lz + lw / 2 + t * .1, 0, t * .06);
}

function nightstand(k, d) {
  const { W, H, D, t, legH, lw, lx, F, lz, open } = d, bh = H - t - legH, fz = D * .46;
  k.board('top', W, t, D, 0, H - t / 2, 0, 0, t * .3);
  k.board('frame', F, bh, D * .92, 0, legH + bh / 2, 0, 0, lw * .06);
  const knob = (y, h) => k.sphere('metal', Math.min(F, h) * .06, 0, y, fz + t * .3 + Math.min(F, h) * .045);
  if (open) {
    const dh = bh * .34, y = H - t - bh * .06 - dh / 2;
    k.board('accent', F * .86, dh, t * .3, 0, y, fz + t * .15, 0, t * .06); knob(y, dh);
    k.board('dark', F * .84, bh * .46, t * .1, 0, legH + bh * .07 + bh * .23, fz + t * .03);
  } else {
    const dh = bh * .42;
    for (const y of [legH + bh * .06 + dh / 2, H - t - bh * .06 - dh / 2]) { k.board('accent', F * .86, dh, t * .3, 0, y, fz + t * .15, 0, t * .06); knob(y, dh); }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.stick('frame', 'square', [sx * lx, 0, sz * lz], [sx * lx, legH + t, sz * lz], lw * .7, lw);
}

function chair(k, d) {
  const { F, SH, st, lw, lwb, pw, Dz, BH, rake, cushion, L, bx, by, sx0, sx1, back, style, rush, rungs } = d;
  const zl = Dz / 2 - lw / 2, zp = Dz / 2 - pw / 2, fx = F / 2 - lw / 2;
  const along = s => [bx - Math.sin(rake) * s, by + Math.cos(rake) * s];
  k.board(rush ? 'rush' : 'top', sx1 - sx0, st, Dz, (sx0 + sx1) / 2, SH - st / 2, 0, 0, st * .35);
  const post = style === 'turned' ? 'round' : style;
  for (const sz of [-1, 1]) {
    k.stick('frame', style, [fx, 0, sz * zl], [fx, by, sz * zl], lwb, lw);
    k.stick('frame', post, [bx, 0, sz * zp], [bx, by, sz * zp], pw * lwb / lw, pw);
    const [tx, ty] = along(L);
    k.stick('frame', post, [bx, by, sz * zp], [tx, ty, sz * zp], pw, pw * .9);
    if (back === 'ladder') k.sphere('frame', pw * .7, tx, ty + pw * .45, sz * zp);
  }
  const span = Dz - pw * 1.1, railH = Math.min(BH * .16, F * .16), b0 = st + cushion;
  const rail = (s, h, thick) => { const [x, y] = along(s); k.board('frame', thick, h, span, x, y, 0, rake, thick * .3); };
  if (back === 'ladder') {
    for (let i = 0; i < rungs; i++) rail(b0 + (L - b0) * (.3 + .62 * i / (rungs - 1)), railH * .55, pw * .45);
  } else {
    rail(L - railH / 2, railH, pw * .75);
    if (back === 'slats') { rail(b0 + (L - b0) * .6, railH * .6, pw * .5); rail(b0 + (L - b0) * .34, railH * .55, pw * .5); }
    if (back === 'spindles') {
      rail(b0 + railH * .3, railH * .5, pw * .6);
      const n = 4, [ax, ay] = along(b0 + railH * .4), [bx2, by2] = along(L - railH * .9);
      for (let i = 1; i <= n; i++) { const z = -span / 2 + span * i / (n + 1); k.stick('frame', 'round', [ax, ay, z], [bx2, by2, z], pw * .3, pw * .3); }
    }
    if (back === 'panel') { const mid = (b0 + L - railH) / 2, [x, y] = along(mid); k.board('frame', pw * .45, (L - railH - b0) * .92, Dz * .4, x, y, 0, rake, pw * .12); }
  }
  const sy = SH * .26;
  for (const sz of [-1, 1]) k.stick('frame', 'round', [bx, sy, sz * zl], [fx, sy, sz * zl], lw * .34, lw * .34);
  k.stick('frame', 'round', [fx, sy * .85, -zl], [fx, sy * .85, zl], lw * .32, lw * .32);
  k.stick('frame', 'round', [bx, sy * 1.1, -zp], [bx, sy * 1.1, zp], lw * .32, lw * .32);
  if (cushion) k.board('fabric', sx1 - (-F / 2 + pw) - F * .02, cushion, Dz * .94, (sx1 - F / 2 + pw) / 2, SH + cushion / 2, 0, 0, cushion * .45);
}

function stool(k, d) {
  const { SW, SH, st, lw, lwb, xb, xt, round, ry, style } = d;
  if (round) k.cyl('top', SW / 2 * .96, SW / 2, st, 0, SH - st / 2, 0, 40); else k.board('top', SW, st, SW, 0, SH - st / 2, 0, 0, st * .35);
  const legs = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const a = [sx * xb, 0, sz * xb], b = [sx * xt, SH - st, sz * xt];
    k.stick('frame', style, a, b, lwb, lw); legs.push([a, b]);
  }
  rungs(k, 'frame', legs, ry / (SH - st), lw * .36);
}

function barstool(k, d) {
  const { SW, SH, st, lw, xb, xt, ry, cushion, metal } = d, key = metal ? 'metal' : 'frame';
  if (cushion) {
    k.cyl('top', SW / 2 * .9, SW / 2 * .96, st * .5, 0, SH - st * .75, 0, 40);
    k.cyl('fabric', SW / 2, SW / 2 * .94, st * .5, 0, SH - st * .25, 0, 40);
  } else k.cyl('top', SW / 2 * .95, SW / 2, st, 0, SH - st / 2, 0, 40);
  k.cyl(key, xt * 1.25, xt * 1.3, st * .3, 0, SH - st - st * .15, 0, 24);
  const legs = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const a = [sx * xb, 0, sz * xb], b = [sx * xt, SH - st, sz * xt];
    k.stick(key, 'round', a, b, lw * .85, lw); legs.push([a, b]);
  }
  rungs(k, 'metal', legs, ry / (SH - st), lw * .42);
}
// Rungs between neighbouring legs, the front-back ones a little higher than the side ones.
function rungs(k, key, legs, f, w) {
  const at = ([a, b], t) => a.map((v, i) => v + (b[i] - v) * t);
  for (const [i, j, t] of [[0, 2, f], [1, 3, f], [0, 1, f * 1.18], [2, 3, f * 1.18]]) k.stick(key, 'round', at(legs[i], t), at(legs[j], t), w, w);
}

const BUILD = { dining: table, coffee: table, side: table, bistro, desk, nightstand, chair, ladder: chair, stool, barstool };

// Returns { group, color } where color is the piece's main colour (for the tower map).
export function buildModel(p) {
  const f = finishFor(p), k = new Kit(Math.max(.4, p.F * .3), p.seed + 1);
  BUILD[p.type](k, p.dims);
  const mats = {};
  for (const key in k.geos) mats[key] = material(f[key]);
  return { group: k.build(mats), color: f.frame.color, top: f.top.color };
}

export function disposeModel(group) {
  group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
}
