// Draws a scene as a flat, screen-printed travel-poster panorama.
import { EXAG, shade } from './scene.js';
import { drawWord, wordWidth } from './script.js';

const TAU = Math.PI * 2;
const wrapPi = (a) => ((a % TAU) + TAU * 1.5) % TAU - Math.PI;
const rgbCache = new Map();
function rgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) { const n = parseInt(hex.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; rgbCache.set(hex, v); }
  return v;
}
export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  const r = (A[0] + (B[0] - A[0]) * t) | 0, g = (A[1] + (B[1] - A[1]) * t) | 0, bb = (A[2] + (B[2] - A[2]) * t) | 0;
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bb).toString(16).slice(1);
}

let grain = null;
function grainPattern(ctx) {
  if (grain) return grain;
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d'); const im = g.createImageData(160, 160);
  for (let i = 0; i < im.data.length; i += 4) {
    const v = Math.random();
    const dark = v < 0.5;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = dark ? 40 : 255;
    im.data[i + 3] = (Math.abs(v - 0.5) * 2) ** 3 * 38;
  }
  g.putImageData(im, 0, 0);
  grain = ctx.createPattern(c, 'repeat');
  return grain;
}

// view: { yaw (deg), zoom, camU }
export function renderPano(ctx, W, H, sc, view, opts = {}) {
  const f = Math.max((W / 2) / Math.tan(0.9), (H / 2) / Math.tan(0.75)) * (view.zoom || 1);
  const hor = Math.round(H * 0.5 + (opts.tilt || 0) * H);
  const yawR = view.yaw * Math.PI / 180, dirR = sc.dir * Math.PI / 180;
  const camU = view.camU || 0;
  const pal = sc.pal, haze = pal.sky[3];
  const vis = pal.vis;
  const fogAt = (d) => Math.min(pal.fog ? 0.94 : 0.8, 1 - Math.exp(-d / vis));
  const sunRel = wrapPi(sc.sunAz * Math.PI / 180 - dirR); // sun bearing in road-local terms
  const out = { hits: [] };

  // ---------- sky: flat bands like screen-print layers
  const sky = pal.sky;
  const bandY = [Math.tan(0.5), Math.tan(0.24), Math.tan(0.09)].map((t) => hor - f * t);
  ctx.fillStyle = sky[0]; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = sky[1]; ctx.fillRect(0, bandY[0], W, H);
  ctx.fillStyle = sky[2]; ctx.fillRect(0, bandY[1], W, H);
  ctx.fillStyle = sky[3]; ctx.fillRect(0, bandY[2], W, H);

  const azX = (azDeg) => {
    const th = wrapPi(azDeg * Math.PI / 180 - yawR);
    return Math.abs(th) > 1.4 ? -9999 : W / 2 + f * Math.tan(th);
  };
  // sun
  if (!pal.fog) {
    const sx = azX(sc.sunAz), sy = hor - f * Math.tan(sc.sunEl);
    const R = Math.max(18, f * 0.05);
    ctx.fillStyle = mix(sky[3], '#fff6d0', 0.6);
    ctx.beginPath(); ctx.arc(sx, sy, R * 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff4cf';
    ctx.beginPath(); ctx.arc(sx, sy, R, 0, TAU); ctx.fill();
  }
  // clouds: stacked flat lobes
  for (const cl of sc.clouds) {
    const cx = azX(cl.az), cy = hor - f * Math.tan(cl.el), cw = f * cl.w;
    if (cx + cw < -50 || cx - cw > W + 50) continue;
    let s = cl.seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    ctx.fillStyle = mix(sky[0], '#ffffff', 0.75);
    const lobes = 4 + ((rnd() * 3) | 0);
    ctx.beginPath();
    for (let i = 0; i < lobes; i++) {
      const lx = cx - cw / 2 + (i + 0.5) * cw / lobes, lr = cw / lobes * (0.7 + rnd() * 0.6);
      ctx.moveTo(lx + lr, cy); ctx.arc(lx, cy - lr * 0.2 * rnd(), lr, Math.PI, 0);
    }
    ctx.rect(cx - cw / 2 - cw / lobes * 0.3, cy - 1, cw + cw / lobes * 0.6, cw * 0.06);
    ctx.fill();
    ctx.fillStyle = mix(sky[1], '#ffffff', 0.35);
    ctx.fillRect(cx - cw / 2, cy + cw * 0.03, cw, cw * 0.04);
  }

  // ---------- terrain bands from the heightmap
  const N = sc.N;
  const angAt = (band, th) => {
    let a = ((th * 180 / Math.PI) % 360 + 360) % 360;
    const i0 = Math.floor(a) % N, i1 = (i0 + 1) % N, t = a - Math.floor(a);
    return [band.ang[i0] * (1 - t) + band.ang[i1] * t, t < 0.5 ? i0 : i1];
  };
  const bandCols = [
    mix(pal.near, haze, pal.fog ? 0.75 : 0.1),
    mix(mix(pal.far, pal.near, 0.45), haze, pal.fog ? 0.88 : 0.3),
    mix(pal.far, haze, pal.fog ? 0.95 : 0.5),
  ];
  const seaCols = [mix('#5b8eaa', haze, 0.15), mix('#6a98b0', haze, 0.4), mix('#7aa3b8', haze, 0.6)];
  const snowCol = ['#f4f3ec', mix('#f4f3ec', haze, 0.25), mix('#f4f3ec', haze, 0.45)];
  const step = Math.max(2, Math.round(W / 300));
  let nearYs = null;
  for (let b = 2; b >= 0; b--) {
    const band = sc.sky[b];
    const ys = [], ks = [];
    if (b === 0) nearYs = ys;
    for (let x = -step; x <= W + step; x += step) {
      const tc = Math.atan((x - W / 2) / f);
      const [a, i] = angAt(band, yawR + tc);
      ys.push(hor - f * Math.tan(a) / Math.cos(tc)); ks.push(i);
    }
    ctx.fillStyle = bandCols[b];
    ctx.beginPath(); ctx.moveTo(-step, H);
    ys.forEach((y, j) => ctx.lineTo(-step + j * step, y));
    ctx.lineTo(W + step, H); ctx.closePath(); ctx.fill();
    for (let j = 0; j < ys.length; j++) {
      const i = ks[j], k = band.kind[i];
      if (k === 1) { ctx.fillStyle = seaCols[b]; ctx.fillRect(-step + j * step - 0.5, ys[j], step + 1, H); }
      else if (k === 2) {
        const cap = f * EXAG * Math.max(0, band.top[i] - 2250) / (band.dist[i] * 1000 + 1) * 0.9;
        ctx.fillStyle = snowCol[b]; ctx.fillRect(-step + j * step - 0.5, ys[j], step + 1, Math.min(cap, 60));
      }
    }
  }
  // near ground plane
  const gY = (d) => hor + f * sc.eye / d;
  for (const [dd, col] of [[110, mix(pal.ground, haze, fogAt(110))], [50, mix(pal.ground, haze, fogAt(50))], [22, pal.ground]]) {
    const g0 = gY(dd);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-step, H);
    nearYs.forEach((y, j) => ctx.lineTo(-step + j * step, Math.max(g0, y)));
    ctx.lineTo(W + step, H); ctx.closePath(); ctx.fill();
  }

  // ---------- projection: an ordinary perspective camera looking along `yaw`
  const psi = dirR - yawR, cP = Math.cos(psi), sP = Math.sin(psi);
  const NEAR = 0.08;
  const cam = (u, v, z) => { const du = u - camU; return [du * sP + v * cP, z - sc.eye, du * cP - v * sP]; };
  const toS = ([x, y, z]) => [W / 2 + f * x / z, hor - f * y / z];
  function clip(pts) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ia = a[2] >= NEAR, ib = b[2] >= NEAR;
      if (ia) out.push(a);
      if (ia !== ib) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
    }
    return out;
  }
  function poly(pts, fill) {
    const cp = clip(pts.map(([u, v, z]) => cam(u, v, z)));
    if (cp.length < 3) return;
    ctx.beginPath();
    cp.forEach((p, i) => { const [x, y] = toS(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  function polyline(pts, color, width) {
    const cp = pts.map(([u, v, z]) => cam(u, v, z));
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i < cp.length; i++) {
      const a = cp[i];
      if (a[2] >= NEAR) { const [x, y] = toS(a); pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; }
      else pen = false;
    }
    ctx.stroke();
  }
  // screen position of a point: [x, y, depth, visible]
  function scr(u, v, z) {
    const c = cam(u, v, z);
    if (c[2] < NEAR) return [0, 0, c[2], false];
    const [x, y] = toS(c);
    return [x, y, c[2], true];
  }
  function quadTransform(TL, TR, BL, w, h) {
    const pts = [TL, TR, BL].map(([u, v, z]) => cam(u, v, z));
    if (pts.some((p) => p[2] < 0.3)) return null;
    const [p0, p1, p2] = pts.map(toS);
    return [(p1[0] - p0[0]) / w, (p1[1] - p0[1]) / w, (p2[0] - p0[0]) / h, (p2[1] - p0[1]) / h, p0[0], p0[1]];
  }

  // ---------- gather things near the road
  const SEG = sc.SEG;
  const items = [];
  const k0 = Math.floor((camU - 380) / SEG), k1 = Math.floor((camU + 380) / SEG);
  for (let k = k0; k <= k1; k++) for (const o of sc.seg(k)) items.push(o);
  for (const o of sc.cars) items.push(o);
  for (const o of sc.signs) items.push(o);

  // fields first (they lie flat on the ground)
  const fields = items.filter((o) => o.t === 'field');
  fields.sort((a, b) => dist2(b) - dist2(a));
  function dist2(o) { const u = (o.u0 + o.u1) / 2 - camU, v = (o.v0 + o.v1) / 2; return u * u + v * v; }
  for (const o of fields) {
    const d = Math.sqrt(dist2(o));
    const col = mix(o.color, haze, fogAt(d));
    const pts = [];
    const n = 6;
    for (let i = 0; i <= n; i++) pts.push([o.u0 + (o.u1 - o.u0) * i / n, o.v0, 0]);
    for (let i = n; i >= 0; i--) pts.push([o.u0 + (o.u1 - o.u0) * i / n, o.v1, 0]);
    poly(pts, col);
    if (o.stripes) {
      const sc2 = mix(shade(o.color, 0.88), haze, fogAt(d));
      for (let s = 1; s < 6; s++) {
        const vv = o.v0 + (o.v1 - o.v0) * s / 6, vw = (o.v1 - o.v0) / 24;
        poly([[o.u0, vv, 0], [o.u1, vv, 0], [o.u1, vv + vw, 0], [o.u0, vv + vw, 0]], sc2);
      }
    }
  }

  // ---------- the road
  const w = sc.w;
  poly([[camU - 3000, -w, 0], [camU + 3000, -w, 0], [camU + 3000, w, 0], [camU - 3000, w, 0]], sc.roadColor);
  // markings
  const lineW = 0.12;
  const colorOf = (c) => (c === 'yellow' ? '#f0c23b' : '#f2efe6');
  const lineStrip = (v, col) => poly([[camU - 3000, v - lineW, 0], [camU + 3000, v - lineW, 0], [camU + 3000, v + lineW, 0], [camU - 3000, v + lineW, 0]], col);
  const c = sc.c;
  if (c.centre) {
    const col = colorOf(c.centre.color);
    if (c.centre.style === 'solid') lineStrip(0, col);
    else if (c.centre.style === 'double') { lineStrip(-0.22, col); lineStrip(0.22, col); }
    else {
      for (let k = Math.floor((camU - 300) / 9); k <= Math.floor((camU + 300) / 9); k++) {
        const ua = k * 9, ub = ua + 3.2;
        const d = Math.min(Math.abs(ua - camU), Math.abs(ub - camU));
        poly([[ua, -lineW, 0], [ub, -lineW, 0], [ub, lineW, 0], [ua, lineW, 0]], mix(col, sc.roadColor, Math.min(0.6, d / 500)));
      }
    }
  }
  if (c.edge) { const col = colorOf(c.edge); lineStrip(-(w - 0.25), col); lineStrip(w - 0.25, col); }

  // walk arrows on the road
  for (const sgn of [1, -1]) {
    const [x, y, , ok] = scr(camU + sgn * 7, 0, 0);
    if (ok && y < H && x > -40 && x < W + 40) out.hits.push({ x, y, sgn });
  }

  // ---------- upright things, far to near
  const upright = items.filter((o) => o.t !== 'field');
  for (const o of upright) {
    const uu = o.t === 'wall' || o.t === 'fence' ? (o.u0 + o.u1) / 2 : o.u;
    o._d = Math.hypot(uu - camU, o.v);
  }
  upright.sort((a, b) => b._d - a._d);
  const sunRight = (x) => Math.sin(wrapPi(sc.sunAz * Math.PI / 180 - (Math.atan((x - W / 2) / f) + yawR))) > 0;

  for (const o of upright) {
    const d = o._d;
    if (d > 420 || d < 0.6) continue;
    const fog = fogAt(d);
    const F = (col) => (fog > 0.01 ? mix(col, haze, fog) : col);
    switch (o.t) {
      case 'house': drawHouse(o, F); break;
      case 'tree': case 'rock': drawBillboard(o, F); break;
      case 'pole': drawPole(o, F); break;
      case 'lamp': drawLamp(o, F); break;
      case 'bollard': drawBollard(o, F); break;
      case 'car': drawCar(o, F); break;
      case 'sign': drawSign(o, F); break;
      case 'townsign': drawTownSign(o, F); break;
      case 'wall': {
        const n = 6, pts = [];
        for (let i = 0; i <= n; i++) pts.push([o.u0 + (o.u1 - o.u0) * i / n, o.v, 0]);
        for (let i = n; i >= 0; i--) pts.push([o.u0 + (o.u1 - o.u0) * i / n, o.v, 0.75]);
        poly(pts, F('#a9a69a'));
        const top = []; for (let i = 0; i <= n; i++) top.push([o.u0 + (o.u1 - o.u0) * i / n, o.v, 0.75]);
        polyline(top, F('#cfccbf'), Math.max(1, f * 0.12 / d));
        const mid = []; for (let i = 0; i <= n; i++) mid.push([o.u0 + (o.u1 - o.u0) * i / n, o.v, 0.38]);
        polyline(mid, F('#8d8a7f'), Math.max(0.6, f * 0.04 / d));
        break;
      }
      case 'fence': {
        const col = F('#7a5d3f');
        for (let u = o.u0; u < o.u1; u += 3.3) polyline([[u, o.v, 0], [u, o.v, 1.2]], col, Math.max(0.8, f * 0.1 / Math.hypot(u - camU, o.v)));
        for (const z of [0.55, 1.05]) { const pts = []; for (let i = 0; i <= 6; i++) pts.push([o.u0 + (o.u1 - o.u0) * i / 6, o.v, z]); polyline(pts, col, Math.max(0.6, f * 0.06 / d)); }
        break;
      }
    }
  }

  function drawHouse(o, F) {
    const { u, v, wd, dp, hh } = o;
    const u0 = u - wd / 2, u1 = u + wd / 2, v0 = v - dp / 2, v1 = v + dp / 2;
    const lit = (nu, nv) => Math.cos(Math.atan2(nv, nu) - sunRel) > 0;
    const wallC = (nu, nv) => F(lit(nu, nv) ? o.wall : shade(o.wall, 0.78));
    const style = o.style;
    let prof;
    if (style === 'steep') prof = [[v0 - 0.3, hh - 0.2], [v, hh + dp * 0.7], [v1 + 0.3, hh - 0.2]];
    else if (style === 'barrel') prof = [[v0 - 0.2, hh], [v0 + dp * 0.15, hh + dp * 0.22], [v, hh + dp * 0.3], [v1 - dp * 0.15, hh + dp * 0.22], [v1 + 0.2, hh]];
    else if (style === 'hip') prof = [[v0 - 0.4, hh - 0.1], [v, hh + dp * 0.32], [v1 + 0.4, hh - 0.1]];
    else prof = null;
    const gable = style === 'steep' || style === 'barrel';
    // walls
    const walls = [];
    const endProfile = (uu) => gable ? prof.slice().reverse().map(([pv, pz]) => [uu, Math.max(v0, Math.min(v1, pv)), Math.min(pz, pz)]) : [[uu, v1, hh], [uu, v0, hh]];
    walls.push({ n: [-1, 0], pts: [[u0, v0, 0], [u0, v1, 0], ...endProfile(u0)], c: [u0, v] });
    walls.push({ n: [1, 0], pts: [[u1, v0, 0], [u1, v1, 0], ...endProfile(u1)], c: [u1, v] });
    walls.push({ n: [0, -1], pts: [[u0, v0, 0], [u1, v0, 0], [u1, v0, hh], [u0, v0, hh]], c: [u, v0] });
    walls.push({ n: [0, 1], pts: [[u0, v1, 0], [u1, v1, 0], [u1, v1, hh], [u0, v1, hh]], c: [u, v1] });
    const camV = 0;
    for (const wl of walls) {
      const vis = (camU - wl.c[0]) * wl.n[0] + (camV - wl.c[1]) * wl.n[1] > 0;
      if (!vis) continue;
      poly(wl.pts, wallC(wl.n[0], wl.n[1]));
      drawOpenings(o, wl, F);
    }
    // roofs
    const rc = o.roofC;
    const faces = [];
    if (style === 'flat') {
      const pz = hh + 0.5;
      faces.push({ pts: [[u0, v0, hh], [u1, v0, hh], [u1, v0, pz], [u0, v0, pz]], c: F(shade(o.wall, 0.92)), n: [0, -1], cu: u, cv: v0 });
      faces.push({ pts: [[u0, v1, hh], [u1, v1, hh], [u1, v1, pz], [u0, v1, pz]], c: F(shade(o.wall, 0.92)), n: [0, 1], cu: u, cv: v1 });
      if (o.tank) faces.push({ pts: [[u - 1, v - 0.6, pz], [u + 1, v - 0.6, pz], [u + 1, v - 0.6, pz + 1.3], [u - 1, v - 0.6, pz + 1.3]], c: F('#3c3c3c'), cu: u, cv: v - 0.6, n: [0, -1] });
    } else if (style === 'hip') {
      const r0 = u0 + dp * 0.45, r1 = u1 - dp * 0.45;
      const [a, rdg, b] = prof;
      faces.push({ pts: [[u0 - 0.4, a[0], a[1]], [u1 + 0.4, a[0], a[1]], [r1, rdg[0], rdg[1]], [r0, rdg[0], rdg[1]]], n: [0, -1] });
      faces.push({ pts: [[u0 - 0.4, b[0], b[1]], [u1 + 0.4, b[0], b[1]], [r1, rdg[0], rdg[1]], [r0, rdg[0], rdg[1]]], n: [0, 1] });
      faces.push({ pts: [[u0 - 0.4, a[0], a[1]], [u0 - 0.4, b[0], b[1]], [r0, rdg[0], rdg[1]]], n: [-1, 0] });
      faces.push({ pts: [[u1 + 0.4, a[0], a[1]], [u1 + 0.4, b[0], b[1]], [r1, rdg[0], rdg[1]]], n: [1, 0] });
    } else {
      for (let i = 0; i < prof.length - 1; i++) {
        const [pa, za] = prof[i], [pb, zb] = prof[i + 1];
        faces.push({ pts: [[u0 - 0.3, pa, za], [u1 + 0.3, pa, za], [u1 + 0.3, pb, zb], [u0 - 0.3, pb, zb]], n: [0, pb > v ? 1 : -1], cv: (pa + pb) / 2 });
      }
    }
    for (const fc of faces) { const m = fc.pts.reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]); fc.dd = Math.hypot(m[0] / fc.pts.length - camU, m[1] / fc.pts.length); }
    faces.sort((a, b) => b.dd - a.dd);
    for (const fc of faces) {
      if (style === 'flat' && fc.n && (camU - fc.cu) * fc.n[0] + (0 - fc.cv) * fc.n[1] <= 0) continue;
      const col = fc.c || F(fc.n && lit(fc.n[0], fc.n[1]) ? shade(rc, 1.12) : rc);
      poly(fc.pts, col);
    }
  }

  function drawOpenings(o, wl, F) {
    if (o._d > 260) return;
    const [nu, nv] = wl.n;
    const c = sc.c;
    const right = [nv, -nu];
    const off = 0.03;
    const glass = F(c.id === 2 ? '#3b3530' : '#33404c');
    const trim = c.id === 0 ? F('#f1ede2') : null;
    const shutter = c.id === 3 ? F('#3f6b4e') : c.id === 1 ? F(shade(o.wall, 0.8)) : null;
    const quad = (cu, cv, hw, z0, z1, col) => {
      const bu = cu + nu * off, bv = cv + nv * off;
      poly([[bu - right[0] * hw, bv - right[1] * hw, z0], [bu + right[0] * hw, bv + right[1] * hw, z0], [bu + right[0] * hw, bv + right[1] * hw, z1], [bu - right[0] * hw, bv - right[1] * hw, z1]], col);
    };
    const facesRoad = nv !== 0 && Math.sign(nv) === -Math.sign(o.v);
    const span = nv !== 0 ? o.wd : o.dp;
    const slots = Math.max(1, Math.floor(span / 2.6));
    for (let fl = 0; fl < o.floors; fl++) {
      for (let s = 0; s < slots; s++) {
        const t = (s + 0.5) / slots - 0.5;
        const cu = wl.c[0] + right[0] * t * span * 0.9, cv = wl.c[1] + right[1] * t * span * 0.9;
        const isDoor = facesRoad && fl === 0 && s === Math.floor(slots / 2);
        if (isDoor) { quad(cu, cv, 0.55, 0, 2.15, F(o.shopC ? '#2a2622' : shade(o.wall, 0.5))); continue; }
        const z0 = fl * 2.9 + (c.id === 2 ? 1.4 : 1.0), z1 = fl * 2.9 + (c.id === 2 ? 2.2 : 2.25);
        const hw = c.id === 2 ? 0.35 : 0.45;
        if (shutter) { quad(cu, cv, hw * 2.05, z0, z1, shutter); }
        if (trim) quad(cu, cv, hw + 0.12, z0 - 0.12, z1 + 0.12, trim);
        quad(cu, cv, hw, z0, z1, glass);
      }
    }
    if (facesRoad && o.shop) {
      const z1 = 2.75, z0 = 2.2, hw = Math.min(span * 0.42, 3.4);
      const cu = wl.c[0] + nu * 0.06, cv = wl.c[1] + nv * 0.06;
      quad(cu, cv, hw, z0, z1, F(o.shopC));
      if (o._d < 150) {
        const TL = [cu - right[0] * hw, cv - right[1] * hw, z1], TR = [cu + right[0] * hw, cv + right[1] * hw, z1], BL = [cu - right[0] * hw, cv - right[1] * hw, z0];
        const t = quadTransform(TL, TR, BL, 100 * hw * 2, 55);
        if (t) {
        ctx.save(); ctx.setTransform(...t);
        const ww = wordWidth(sc.script, o.shop, 30);
        const sz = Math.min(30, 30 * (100 * hw * 2 * 0.85) / ww);
        drawWord(ctx, sc.script, o.shop, 100 * hw, 27.5, sz, F('#f3ecd8'));
        ctx.restore();
        }
      }
    }
  }

  function drawBillboard(o, F) {
    const [x, y, d, ok] = scr(o.u, o.v, 0);
    if (!ok || d < 0.5) return;
    const s = f / d; // px per metre
    const h = o.hgt * s;
    if (x + h < -10 || x - h > W + 10) return;
    const right = sunRight(x);
    const lightSide = right ? 1 : -1;
    let sd = o.seed || 1;
    const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const trunk = F('#5e4632');
    if (o.t === 'rock') {
      const rw = o.hgt * s * 1.05;
      ctx.fillStyle = F('#8b877c');
      ctx.beginPath(); ctx.moveTo(x - rw, y); ctx.quadraticCurveTo(x - rw * 0.8, y - o.hgt * s, x, y - o.hgt * s); ctx.quadraticCurveTo(x + rw * 0.9, y - o.hgt * s * 0.9, x + rw, y); ctx.fill();
      ctx.fillStyle = F('#a7a397');
      ctx.beginPath(); ctx.moveTo(x, y - o.hgt * s); ctx.quadraticCurveTo(x + lightSide * rw * 0.8, y - o.hgt * s * 0.9, x + lightSide * rw * 0.7, y - o.hgt * s * 0.3); ctx.lineTo(x, y - o.hgt * s * 0.5); ctx.fill();
      return;
    }
    const k = o.kind;
    const G = (a, b) => [F(a), F(b)];
    if (k === 'pine') {
      const [c1, c2] = G('#2f4f3d', '#3f6a4c');
      ctx.fillStyle = trunk; ctx.fillRect(x - 0.15 * s, y - h * 0.25, 0.3 * s, h * 0.25);
      for (let i = 0; i < 3; i++) {
        const ty = y - h * (0.18 + i * 0.25), tw = (1.9 - i * 0.45) * s * o.hgt / 8, tt = h * 0.42;
        ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(x - tw, ty); ctx.lineTo(x, ty - tt); ctx.lineTo(x + tw, ty); ctx.fill();
        ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(x, ty - tt); ctx.lineTo(x + lightSide * tw, ty); ctx.lineTo(x, ty); ctx.fill();
      }
    } else if (k === 'cypress') {
      const [c1, c2] = G('#34503d', '#4a6b50');
      const cw = h * 0.13;
      ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(x, y - h * 0.5, cw, h * 0.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(x + lightSide * cw * 0.35, y - h * 0.52, cw * 0.55, h * 0.44, 0, 0, TAU); ctx.fill();
    } else if (k === 'poplar') {
      const [c1, c2] = G('#5c8a45', '#78a557');
      ctx.fillStyle = trunk; ctx.fillRect(x - 0.12 * s, y - h * 0.2, 0.24 * s, h * 0.2);
      ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(x, y - h * 0.58, h * 0.14, h * 0.42, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(x + lightSide * h * 0.05, y - h * 0.62, h * 0.07, h * 0.34, 0, 0, TAU); ctx.fill();
    } else if (k === 'palm') {
      ctx.strokeStyle = F('#8a6d4c'); ctx.lineWidth = Math.max(1, 0.35 * s); ctx.lineCap = 'round';
      const bend = (rnd() - 0.5) * h * 0.5;
      const tx = x + bend, ty = y - h;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x, y - h * 0.6, tx, ty); ctx.stroke();
      ctx.strokeStyle = F('#3d7f4a'); ctx.lineWidth = Math.max(1, 0.5 * s);
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.48 + (rnd() - 0.5) * 0.2, L = h * 0.38;
        ctx.strokeStyle = F(i % 2 ? '#3d7f4a' : '#58a05a');
        ctx.beginPath(); ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(tx + Math.cos(a) * L * 0.7, ty + Math.sin(a) * L * 0.7 - L * 0.2, tx + Math.cos(a) * L, ty + Math.sin(a) * L * 0.5 + L * 0.35); ctx.stroke();
      }
    } else if (k === 'acacia') {
      ctx.strokeStyle = trunk; ctx.lineWidth = Math.max(1, 0.25 * s);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h * 0.55); ctx.lineTo(x - h * 0.25, y - h * 0.82); ctx.moveTo(x, y - h * 0.55); ctx.lineTo(x + h * 0.28, y - h * 0.84); ctx.stroke();
      const [c1, c2] = G('#6a7a3a', '#85954a');
      ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(x, y - h * 0.86, h * 0.55, h * 0.12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(x + lightSide * h * 0.12, y - h * 0.9, h * 0.35, h * 0.06, 0, 0, TAU); ctx.fill();
    } else if (k === 'shrub') {
      const sw = Math.max(1.4, o.hgt * 0.25) * s;
      const [c1, c2] = G(sc.biome === 'desert' ? '#9a8a5a' : '#7f8a4c', sc.biome === 'desert' ? '#b3a46e' : '#98a35c');
      ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(x, y, sw, sw * 0.6, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(x + lightSide * sw * 0.3, y - sw * 0.05, sw * 0.5, sw * 0.4, 0, Math.PI, 0); ctx.fill();
    } else {
      // round-canopied: oak, birch, broad, olive
      const pal2 = { oak: ['#4f7a3f', '#6a9a4e'], birch: ['#8aae55', '#a6c46a'], broad: ['#2f7a45', '#4c9a55'], olive: ['#7d8a62', '#9aa67a'] }[k] || ['#4f7a3f', '#6a9a4e'];
      const [c1, c2] = G(pal2[0], pal2[1]);
      ctx.fillStyle = k === 'birch' ? F('#ece8dc') : trunk;
      ctx.fillRect(x - 0.18 * s, y - h * 0.45, 0.36 * s, h * 0.45);
      const R = h * (k === 'broad' ? 0.36 : k === 'olive' ? 0.3 : 0.32);
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.arc(x, y - h + R, R, 0, TAU);
      ctx.arc(x - R * 0.6, y - h + R * 1.5, R * 0.75, 0, TAU);
      ctx.arc(x + R * 0.6, y - h + R * 1.45, R * 0.8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = c2;
      ctx.beginPath(); ctx.arc(x + lightSide * R * 0.4, y - h + R * 0.9, R * 0.55, 0, TAU); ctx.fill();
    }
  }

  function drawPole(o, F) {
    const [x, y, d, ok] = scr(o.u, o.v, 0);
    const [, yt] = scr(o.u, o.v, o.hgt);
    const s = f / d;
    if (ok && d > 0.5 && x > -60 && x < W + 60) {
      const col = F(o.kind === 'concrete' ? '#b9b6ad' : '#6b5038');
      ctx.fillStyle = col;
      const pw = Math.max(1, 0.26 * s);
      ctx.fillRect(x - pw / 2, yt, pw, y - yt);
      if (o.kind === 'wood1' || o.kind === 'wood2') {
        const bars = o.kind === 'wood2' ? [0.35, 1.05] : [0.35];
        for (const b of bars) {
          ctx.fillRect(x - 1.1 * s, yt + b * s, 2.2 * s, Math.max(1, 0.16 * s));
          ctx.fillStyle = F('#e8e4d8');
          for (const ox of [-0.9, 0, 0.9]) ctx.fillRect(x + ox * s - Math.max(0.7, 0.07 * s), yt + b * s - 0.22 * s, Math.max(1.4, 0.14 * s), 0.22 * s);
          ctx.fillStyle = col;
        }
      } else if (o.kind === 'concrete') {
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, 0.14 * s);
        ctx.beginPath(); ctx.moveTo(x, yt + 0.3 * s); ctx.lineTo(x + 1.3 * s, yt + 0.05 * s); ctx.stroke();
        ctx.fillStyle = F('#7d7a72'); ctx.fillRect(x - 0.35 * s, yt + 1.6 * s, 0.7 * s, 0.9 * s);
      }
    }
    // wires to the next pole
    const offs = o.kind === 'concrete' ? [1.3] : [-0.9, 0.9];
    for (const ov of offs) {
      const pts = [];
      for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([o.u + 40 * t, o.v + ov * (sc.sideOfDrive || 1) * 0 + ov, o.hgt - 0.3 - Math.sin(t * Math.PI) * 0.7]); }
      polyline(pts, F('#2f2c28'), Math.max(0.6, Math.min(2, 0.04 * f / d)));
    }
  }

  function drawLamp(o, F) {
    const [x, y, d, ok] = scr(o.u, o.v, 0);
    if (!ok || d < 0.5 || x < -60 || x > W + 60) return;
    const s = f / d, h = o.hgt * s;
    const side = o.v > 0 ? -1 : 1;
    ctx.strokeStyle = F('#2e3b36'); ctx.lineWidth = Math.max(1, 0.18 * s); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h * 0.85); ctx.quadraticCurveTo(x, y - h, x + side * 0.9 * s, y - h); ctx.stroke();
    ctx.fillStyle = F('#f6e7b0'); ctx.beginPath(); ctx.ellipse(x + side * 1.1 * s, y - h + 0.15 * s, 0.35 * s, 0.18 * s, 0, 0, TAU); ctx.fill();
  }

  function drawBollard(o, F) {
    const [x, y, d, ok] = scr(o.u, o.v, 0);
    if (!ok || d < 0.5 || x < -30 || x > W + 30) return;
    const s = f / d;
    const bw = Math.max(1.2, 0.16 * s), bh = (o.kind === 'redwhite' ? 0.8 : 1.0) * s;
    if (o.kind === 'blackcap') {
      ctx.fillStyle = F('#f2efe6'); ctx.fillRect(x - bw / 2, y - bh, bw, bh);
      ctx.fillStyle = F('#1f1f1f'); ctx.fillRect(x - bw / 2, y - bh, bw, bh * 0.22);
      ctx.fillStyle = F('#e8a53a'); ctx.fillRect(x - bw / 4, y - bh * 0.7, bw / 2, bh * 0.1);
    } else if (o.kind === 'redwhite') {
      for (let i = 0; i < 4; i++) { ctx.fillStyle = F(i % 2 ? '#f2efe6' : '#c23a2b'); ctx.fillRect(x - bw / 2, y - bh + i * bh / 4, bw, bh / 4 + 0.5); }
    } else if (o.kind === 'yellow') {
      ctx.fillStyle = F('#e9c13a'); ctx.fillRect(x - bw / 2, y - bh, bw, bh);
      ctx.fillStyle = F('#1f1f1f'); ctx.fillRect(x - bw / 2, y - bh * 0.55, bw, bh * 0.14);
    }
  }

  function drawCar(o, F) {
    const L = 2.1, Wd = 0.9;
    const u = o.u, v = o.v;
    const body = [[u - L, v - Wd, 0.3], [u + L, v + Wd, 1.0]];
    const cab = [[u - L * 0.55 - o.face * 0.3, v - Wd * 0.85, 1.0], [u + L * 0.45 - o.face * 0.3, v + Wd * 0.85, 1.5]];
    const box = ([[ua, va, za], [ub, vb, zb]], col, glass, isBody) => {
      const fcs = [
        { n: [-1, 0], c: [ua, (va + vb) / 2], pts: [[ua, va, za], [ua, vb, za], [ua, vb, zb], [ua, va, zb]] },
        { n: [1, 0], c: [ub, (va + vb) / 2], pts: [[ub, va, za], [ub, vb, za], [ub, vb, zb], [ub, va, zb]] },
        { n: [0, -1], c: [(ua + ub) / 2, va], pts: [[ua, va, za], [ub, va, za], [ub, va, zb], [ua, va, zb]] },
        { n: [0, 1], c: [(ua + ub) / 2, vb], pts: [[ua, vb, za], [ub, vb, za], [ub, vb, zb], [ua, vb, zb]] },
      ];
      for (const fc of fcs) {
        if ((camU - fc.c[0]) * fc.n[0] + (0 - fc.c[1]) * fc.n[1] <= 0) continue;
        const litF = Math.cos(Math.atan2(fc.n[1], fc.n[0]) - sunRel) > 0;
        poly(fc.pts, F(glass && fc.n[0] !== 0 ? '#2c3540' : litF ? col : shade(col, 0.8)));
        if (glass && fc.n[1] !== 0) {
          const vv = fc.c[1] + fc.n[1] * 0.02;
          poly([[ua + 0.15, vv, za + 0.08], [ub - 0.15, vv, za + 0.08], [ub - 0.25, vv, zb - 0.08], [ua + 0.25, vv, zb - 0.08]], F('#2c3540'));
        }
        if (isBody && fc.n[0] !== 0) {
          const front = fc.n[0] === o.face;
          const uu = fc.c[0] + fc.n[0] * 0.02;
          const lc = F(front ? '#fff3c4' : '#d23b2b');
          for (const sv of [-1, 1]) poly([[uu, v + sv * 0.62 - 0.17, 0.62], [uu, v + sv * 0.62 + 0.17, 0.62], [uu, v + sv * 0.62 + 0.17, 0.8], [uu, v + sv * 0.62 - 0.17, 0.8]], lc);
          poly([[uu, v - 0.26, 0.38], [uu, v + 0.26, 0.38], [uu, v + 0.26, 0.52], [uu, v - 0.26, 0.52]], F(o.plate));
        }
        if (isBody && fc.n[1] !== 0) {
          const vv = fc.c[1] + fc.n[1] * 0.02;
          for (const su of [-1.35, 1.35]) poly([[u + su - 0.35, vv, 0], [u + su + 0.35, vv, 0], [u + su + 0.35, vv, 0.6], [u + su - 0.35, vv, 0.6]], F('#1e1e1e'));
        }
      }
      // top
      if (zb < sc.eye) poly([[ua, va, zb], [ub, va, zb], [ub, vb, zb], [ua, vb, zb]], F(shade(col, 1.08)));
    };
    box(body, o.color, false, true);
    box(cab, o.color, true, false);
  }

  function drawSign(o, F) {
    const facing = (camU - o.u) * o.face > 0;
    const hw = 1.3, z0 = 1.7, rows = o.rows.length, z1 = z0 + 0.55 * rows + 0.2;
    // the board faces along u; "right" for a viewer facing it
    const n = [o.face, 0], right = [n[1], -n[0]];
    const TL = [o.u - right[0] * hw, o.v - right[1] * hw, z1], TR = [o.u + right[0] * hw, o.v + right[1] * hw, z1];
    const BR = [o.u + right[0] * hw, o.v + right[1] * hw, z0], BL = [o.u - right[0] * hw, o.v - right[1] * hw, z0];
    for (const sv of [-0.9, 0.9]) polyline([[o.u, o.v + sv * right[1], 0], [o.u, o.v + sv * right[1], z0]], F('#8a8a86'), Math.max(1, 0.1 * f / o._d));
    const sg = sc.c.sign;
    if (!facing) { poly([TL, TR, BR, BL], F('#9a9a94')); return; }
    if (sg.rim) poly([TL, TR, BR, BL], F(sg.rim));
    const inset = sg.rim ? 0.07 : 0;
    poly([[TL[0], TL[1] + right[1] * inset, TL[2] - inset], [TR[0], TR[1] - right[1] * inset, TR[2] - inset], [BR[0], BR[1] - right[1] * inset, BR[2] + inset], [BL[0], BL[1] + right[1] * inset, BL[2] + inset]], F(sg.bg));
    if (o._d > 140) return;
    const BW = 260, BH = (z1 - z0) * 100;
    const t = quadTransform(TL, TR, BL, BW, BH);
    if (!t) return;
    ctx.save(); ctx.setTransform(...t);
    const fg = F(sg.fg);
    o.rows.forEach((row, i) => {
      const cy = 10 + 55 * i + 27;
      // arrow
      ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(22, cy - 18); ctx.lineTo(36, cy - 2); ctx.lineTo(27, cy - 2); ctx.lineTo(27, cy + 16); ctx.lineTo(17, cy + 16); ctx.lineTo(17, cy - 2); ctx.lineTo(8, cy - 2); ctx.closePath(); ctx.fill();
      const ww = wordWidth(sc.script, row.word, 30);
      const sz = Math.min(30, 30 * 150 / ww);
      drawWord(ctx, sc.script, row.word, 48, cy, sz, fg, 'left');
      ctx.font = '600 34px Jost, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(String(row.km), 250, cy + 2);
    });
    ctx.restore();
  }

  function drawTownSign(o, F) {
    const [x, y, d, ok] = scr(o.u, o.v, 0);
    if (!ok || d < 0.5 || x < -100 || x > W + 100) return;
    const s = f / d;
    const sg = sc.c.sign;
    const bw = 2.2 * s, bh = 0.8 * s, top = y - 2.6 * s;
    ctx.fillStyle = F('#8a8a86');
    ctx.fillRect(x - bw * 0.4, top + bh, Math.max(1, 0.08 * s), 2.6 * s - bh);
    ctx.fillRect(x + bw * 0.4, top + bh, Math.max(1, 0.08 * s), 2.6 * s - bh);
    ctx.fillStyle = F(sg.rim || sg.fg); ctx.fillRect(x - bw / 2, top, bw, bh);
    ctx.fillStyle = F(sg.bg); ctx.fillRect(x - bw / 2 + 0.06 * s, top + 0.06 * s, bw - 0.12 * s, bh - 0.12 * s);
    if (d < 160) {
      const ww = wordWidth(sc.script, o.word, 1);
      const sz = Math.min(bh * 0.5, bw * 0.82 / ww);
      drawWord(ctx, sc.script, o.word, x, top + bh / 2, sz, F(sg.fg));
    }
  }

  // ---------- fog and grain
  if (pal.fog) {
    const g = ctx.createLinearGradient(0, hor - f * 0.25, 0, hor + f * 0.08);
    g.addColorStop(0, 'rgba(221,224,218,0)'); g.addColorStop(0.6, 'rgba(221,224,218,0.55)'); g.addColorStop(1, 'rgba(221,224,218,0)');
    ctx.fillStyle = g; ctx.fillRect(0, hor - f * 0.25, W, f * 0.33);
  }
  if (!opts.noGrain) {
    ctx.save(); ctx.fillStyle = grainPattern(ctx); ctx.globalAlpha = 1; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  out.f = f; out.hor = hor;
  return out;
}
