// Drawing: the printed trail map (hill-shading, contours, forests, rock) is baked once per size into an
// offscreen canvas; runs, lifts, chairs, skiers and lodges are drawn over it every frame.

import { W, H, GW, GH, CELL, CLIFF, GREEN_MAX, BLUE_MAX } from './terrain.js';

export const INK = '#1c2130', SNOW = '#fbfaf5', RED = '#cf3326', SUN = '#f0b43c';
export const LV = ['#2b8a4c', '#1d5fc6', '#16181d'];
export const LVN = ['Easy', 'Intermediate', 'Expert'];
const FONT = '"Sofia Sans Condensed", "Arial Narrow", sans-serif';

export function shape(c, lvl, x, y, r, fill = LV[lvl], stroke = SNOW, lw = 1) {
  c.beginPath();
  if (lvl === 0) c.arc(x, y, r, 0, 6.2832);
  else if (lvl === 1) c.rect(x - r * .9, y - r * .9, r * 1.8, r * 1.8);
  else { const q = r * 1.25; c.moveTo(x, y - q); c.lineTo(x + q, y); c.lineTo(x, y + q); c.lineTo(x - q, y); c.closePath(); }
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}

export class View {
  constructor(canvas) {
    this.cv = canvas; this.c = canvas.getContext('2d');
    this.dpr = 1; this.sc = 1; this.ox = 0; this.oy = 0; this.vw = 1; this.vh = 1;
    this.base = null; this.steep = null; this.game = null; this.fx = [];
  }
  resize(vw, vh, rect) {
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.vw = vw; this.vh = vh; this.rect = rect;
    this.cv.width = Math.round(vw * this.dpr); this.cv.height = Math.round(vh * this.dpr);
    this.sc0 = Math.min(rect.w / W, rect.h / H);
    this.cam = this.cam || { z: 1, cx: W / 2, cy: H / 2 };
    this.applyCam();
    if (this.game) this.bake();
  }
  // the camera: a zoom and the map point at the middle of the map's box
  applyCam() {
    const r = this.rect, c = this.cam;
    if (!r) return;
    c.z = Math.max(1, Math.min(3.2, c.z));
    const sc = this.sc0 * c.z, mw = W * sc, mh = H * sc;
    // keep the map covering the box when it's bigger than the box, centred when it's smaller
    const cx = mw <= r.w ? W / 2 : Math.max(r.w / 2 / sc, Math.min(W - r.w / 2 / sc, c.cx));
    const cy = mh <= r.h ? H / 2 : Math.max(r.h / 2 / sc, Math.min(H - r.h / 2 / sc, c.cy));
    c.cx = cx; c.cy = cy;
    this.sc = sc;
    this.ox = Math.round(r.x + r.w / 2 - cx * sc); this.oy = Math.round(r.y + r.h / 2 - cy * sc);
    // narrow screens: the map hangs from the top and the spare paper collects above the toolbar, where hints go
    if (mh < r.h && this.alignTop) this.oy = r.y;
    if (this.bakeK && Math.abs(Math.log(Math.min(4.2, sc * this.dpr) / this.bakeK)) > .2) this.rebakeAt = performance.now() + 220;
  }
  zoomAt(px, py, f) {
    const w = this.toWorld(px, py), c = this.cam;
    c.z *= f; c.z = Math.max(1, Math.min(3.2, c.z));
    const sc = this.sc0 * c.z;
    // keep the point under the finger where it was
    c.cx = w.x - (px - (this.rect.x + this.rect.w / 2)) / sc; c.cy = w.y - (py - (this.rect.y + this.rect.h / 2)) / sc;
    this.applyCam();
  }
  panBy(dx, dy) { this.cam.cx -= dx / this.sc; this.cam.cy -= dy / this.sc; this.applyCam(); }
  focus(x, y, z) { this.cam = { z, cx: x, cy: y }; this.applyCam(); }
  setGame(g) { this.game = g; this.fx = []; this.cam = { z: 1, cx: W / 2, cy: H / 2 }; this.applyCam(); if (this.rect) this.bake(); }
  X(x) { return this.ox + x * this.sc; }
  Y(y) { return this.oy + y * this.sc; }
  toWorld(px, py) { return { x: (px - this.ox) / this.sc, y: (py - this.oy) / this.sc }; }
  // how big things are drawn: a little bigger on small screens so they stay legible, and a little bigger zoomed in
  get u() { return Math.max(.75, Math.min(1.25, this.sc0 * 1.15)) * Math.pow(this.cam.z, .35); }

  // ------------------------------------------------------------ the printed map
  // shading and steepness live at grid resolution and are scaled up when drawn; the line work
  // (contours, rock, trees) is baked at the current zoom and re-baked when the zoom settles
  bake() {
    const T = this.game.T;
    if (this.shadeFor !== T) {
      this.shadeFor = T;
      const small = document.createElement('canvas'); small.width = GW; small.height = GH;
      const sx = small.getContext('2d'), img = sx.createImageData(GW, GH);
      const steepS = document.createElement('canvas'); steepS.width = GW; steepS.height = GH;
      const stx = steepS.getContext('2d'), simg = stx.createImageData(GW, GH);
      const L = [-.6, .25, .76], Ln = Math.hypot(...L);
      const flat = L[2] / Ln;
      const lo = T.lo, span = T.hi - T.lo;
      const valley = [226, 229, 214], peak = [251, 250, 245], shadow = [150, 164, 194];
      const SC = [[43, 138, 76, 70], [29, 95, 198, 78], [22, 24, 29, 92], [207, 51, 38, 110]];
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
        const k = j * GW + i, gx = T.gx[k] * 2.2, gy = T.gy[k] * 2.2;
        const n = Math.hypot(gx, gy, 1);
        const lam = (-gx * L[0] - gy * L[1] + L[2]) / (n * Ln);
        const e = Math.min(1, Math.max(0, (T.h[k] - lo) / span));
        const sh = Math.max(-.6, Math.min(.5, lam - flat));
        const p = k * 4;
        for (let c = 0; c < 3; c++) {
          let v = valley[c] + (peak[c] - valley[c]) * Math.pow(e, .6);
          v = sh < 0 ? v + (shadow[c] - v) * Math.min(1, -sh * 1.1) : v + (255 - v) * sh * .5;
          img.data[p + c] = v;
        }
        img.data[p + 3] = 255;
        const g = Math.hypot(T.gx[k], T.gy[k]);
        const s = SC[g < GREEN_MAX ? 0 : g < BLUE_MAX ? 1 : g < CLIFF ? 2 : 3];
        simg.data[p] = s[0]; simg.data[p + 1] = s[1]; simg.data[p + 2] = s[2]; simg.data[p + 3] = s[3];
      }
      sx.putImageData(img, 0, 0); stx.putImageData(simg, 0, 0);
      this.shade = small; this.steep = steepS;
      let hk = 0; for (let k = 1; k < T.h.length; k++) if (T.h[k] > T.h[hk]) hk = k;
      this.summit = { x: (hk % GW) * CELL, y: ((hk / GW) | 0) * CELL, h: Math.round(T.hi) };
    }
    const K = Math.min(4.2, this.sc * this.dpr);
    this.bakeK = K; this.rebakeAt = 0;
    const base = document.createElement('canvas'); base.width = Math.ceil(W * K); base.height = Math.ceil(H * K);
    const b = base.getContext('2d');
    b.scale(K, K);
    const px = 1 / this.sc0;   // one css pixel at the fitted zoom, in map units
    // contours: every 50 m, heavier every 250 m
    const step = 50;
    const thin = new Path2D(), thick = new Path2D();
    for (let j = 0; j < GH - 1; j++) for (let i = 0; i < GW - 1; i++) {
      const k = j * GW + i, a = T.h[k], bb = T.h[k + 1], c = T.h[k + GW + 1], dd = T.h[k + GW];
      const mn = Math.min(a, bb, c, dd), mx = Math.max(a, bb, c, dd);
      for (let lv = Math.ceil(mn / step) * step; lv <= mx; lv += step) {
        const pts = [];
        const ed = (v0, v1, x0, y0, x1, y1) => { if ((v0 < lv) !== (v1 < lv)) { const t = (lv - v0) / (v1 - v0); pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); } };
        const X0 = i * CELL, Y0 = j * CELL, X1 = X0 + CELL, Y1 = Y0 + CELL;
        ed(a, bb, X0, Y0, X1, Y0); ed(bb, c, X1, Y0, X1, Y1); ed(c, dd, X1, Y1, X0, Y1); ed(dd, a, X0, Y1, X0, Y0);
        const P = lv % 250 === 0 ? thick : thin;
        for (let q = 0; q + 1 < pts.length; q += 2) { P.moveTo(pts[q][0], pts[q][1]); P.lineTo(pts[q + 1][0], pts[q + 1][1]); }
      }
    }
    b.lineCap = 'round';
    b.strokeStyle = 'rgba(92, 112, 150, .33)'; b.lineWidth = .6 * px; b.stroke(thin);
    b.strokeStyle = 'rgba(78, 96, 134, .55)'; b.lineWidth = 1.1 * px; b.stroke(thick);
    // rock: hachures down the fall line
    b.strokeStyle = 'rgba(70, 64, 78, .5)'; b.lineWidth = .9 * px;
    const rr = rngLocal(7);
    const rock = new Path2D();
    for (let y = 3; y < H; y += 4.2) for (let x = 3; x < W; x += 4.2) {
      const jx = x + (rr() - .5) * 2.4, jy = y + (rr() - .5) * 2.4;
      const g = T.grade(jx, jy);
      if (g < CLIFF * .9) continue;
      const k = (Math.round(jy / CELL)) * GW + Math.round(jx / CELL);
      const gx = T.gx[k], gy = T.gy[k], n = Math.hypot(gx, gy) || 1, l = Math.min(4.2, 1.8 + g * 1.4);
      rock.moveTo(jx, jy); rock.lineTo(jx - gx / n * l, jy - gy / n * l);
    }
    b.stroke(rock);
    // forest: little conifers, in patches below the tree line
    const tr = rngLocal(3), trees = new Path2D(), tz = 2.0;
    for (let y = 4; y < H - 2; y += 7.5) for (let x = 4; x < W - 2; x += 7.5) {
      const jx = x + (tr() - .5) * 4.6, jy = y + (tr() - .5) * 4.6;
      if (!T.forest(jx, jy)) continue;
      trees.moveTo(jx, jy - tz * 1.2); trees.lineTo(jx + tz * .8, jy + tz * .7); trees.lineTo(jx - tz * .8, jy + tz * .7); trees.closePath();
    }
    b.fillStyle = 'rgba(52, 104, 70, .62)'; b.fill(trees);
    this.base = base;
  }

  // things printed on the map that stay the same size at any zoom
  furniture() {
    const c = this.c, sm = this.summit, u = this.u;
    if (sm) {
      const x = this.X(sm.x), y = Math.max(this.Y(sm.y), this.oy + 14);
      c.fillStyle = INK; c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x + 4.5, y + 3); c.lineTo(x - 4.5, y + 3); c.fill();
      c.font = `italic 600 ${12}px ${FONT}`; c.textBaseline = 'middle';
      const right = x > this.ox + W * this.sc * .7;
      c.textAlign = right ? 'right' : 'left';
      halo(c, `${this.game.def.id === 'tutorial' ? 'Nursery Hill' : 'Summit'} ${sm.h} m`, x + (right ? -8 : 8), y, 1);
    }
  }
  scaleBar() {
    const c = this.c, r = this.clipR;
    const kmPx = 200 * this.sc;
    const bx = r.x + r.w - kmPx - 14, by = r.y + r.h - 16;
    c.fillStyle = INK; c.fillRect(bx, by, kmPx / 2, 3); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(bx, by, kmPx, 3);
    c.font = `600 11px ${FONT}`; c.textBaseline = 'middle';
    c.textAlign = 'right'; halo(c, '1 km', bx + kmPx, by - 8, 1);
    c.textAlign = 'left'; halo(c, '0', bx, by - 8, 1);
  }

  // ------------------------------------------------------------ every frame
  draw(g, ui) {
    const c = this.c, d = this.dpr, u = this.u;
    c.setTransform(d, 0, 0, d, 0, 0);
    c.fillStyle = '#f1ede2'; c.fillRect(0, 0, this.vw, this.vh);
    // the map sits on the paper with a hard offset shadow
    const mw = W * this.sc, mh = H * this.sc, R = this.rect;
    if (this.rebakeAt && performance.now() > this.rebakeAt) this.bake();
    // the visible part of the map
    const x0 = Math.max(this.ox, R.x), y0 = Math.max(this.oy, R.y), x1 = Math.min(this.ox + mw, R.x + R.w), y1 = Math.min(this.oy + mh, R.y + R.h);
    const cr = this.clipR = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    c.fillStyle = 'rgba(28, 33, 48, .16)'; c.fillRect(cr.x + 5, cr.y + 5, cr.w, cr.h);
    c.save();
    c.beginPath(); c.rect(cr.x, cr.y, cr.w, cr.h); c.clip();
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    if (this.shade) c.drawImage(this.shade, this.ox, this.oy, mw, mh);
    if (this.base) c.drawImage(this.base, this.ox, this.oy, mw, mh);
    if (ui.steepA > 0 && this.steep) { c.globalAlpha = ui.steepA; c.drawImage(this.steep, this.ox, this.oy, mw, mh); c.globalAlpha = 1; }
    this.furniture();
    const sel = ui.sel;
    // runs
    for (const e of g.edges.values()) if (e.type === 'run') this.run(e, sel === e, ui);
    // lifts
    for (const e of g.edges.values()) if (e.type === 'lift') this.lift(g, e, sel === e, ui);
    // skiers on runs
    for (const s of g.skiers) {
      if (s.state !== 'ski') continue;
      const e = g.edges.get(s.edge); if (!e) continue;
      const [x, y, dx, dy] = g.pointAt(e, s.s), n = Math.hypot(dx, dy) || 1;
      const off = Math.sin(s.s * .32 + s.wob) * 2.6;
      shape(c, s.lvl, this.X(x - dy / n * off), this.Y(y + dx / n * off), 2.6 * u, LV[s.lvl], SNOW, .9);
    }
    // nodes
    for (const n of g.nodes.values()) if (n.kind !== 'lodge') this.station(g, n);
    for (const n of g.nodes.values()) if (n.kind === 'lodge') this.lodge(g, n, ui);
    // effects
    const now = ui.now;
    this.fx = this.fx.filter(f => now - f.t0 < f.dur);
    for (const f of this.fx) {
      const k = (now - f.t0) / f.dur;
      if (f.kind === 'ring') { c.strokeStyle = f.col; c.globalAlpha = 1 - k; c.lineWidth = 2; c.beginPath(); c.arc(this.X(f.x), this.Y(f.y), (8 + 22 * k) * u, 0, 6.2832); c.stroke(); c.globalAlpha = 1; }
      if (f.kind === 'built') { c.strokeStyle = SUN; c.globalAlpha = (1 - k) * .9; c.lineWidth = 8 * u * (1 - k) + 1; c.lineCap = 'round'; c.lineJoin = 'round'; this.path(f.pts); c.stroke(); c.globalAlpha = 1; }
    }
    // the tutorial's ghost line
    if (ui.ghost) this.ghost(ui.ghost, now);
    // what's being drawn
    if (ui.drag) this.preview(g, ui.drag, now);
    // night
    if (ui.night > 0) {
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = `rgba(40, 52, 98, ${ui.night * .62})`; c.fillRect(this.ox, this.oy, mw, mh);
      c.globalCompositeOperation = 'source-over';
      // floodlit runs and lodge windows
      c.globalAlpha = ui.night * .55; c.lineCap = 'round'; c.lineJoin = 'round';
      for (const e of g.edges.values()) if (e.type === 'run') { c.strokeStyle = '#ffe7a6'; c.lineWidth = 10 * u; this.path(e.pts); c.stroke(); }
      c.globalAlpha = 1;
      for (const e of g.edges.values()) if (e.type === 'run') { c.strokeStyle = LV[e.cls] === LV[2] ? '#3a3d48' : LV[e.cls]; c.lineWidth = 3 * u; this.path(e.pts); c.stroke(); }
      for (const n of g.nodes.values()) if (n.kind === 'lodge') { c.fillStyle = SUN; c.fillRect(this.X(n.x) - 2 * u, this.Y(n.y) - 1 * u, 4 * u, 3 * u); }
    }
    this.scaleBar();
    c.restore();
    c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(cr.x, cr.y, cr.w, cr.h);
  }

  path(pts) {
    const c = this.c; c.beginPath();
    c.moveTo(this.X(pts[0][0]), this.Y(pts[0][1]));
    for (let i = 1; i < pts.length; i++) c.lineTo(this.X(pts[i][0]), this.Y(pts[i][1]));
  }

  run(e, selected, ui) {
    const c = this.c, u = this.u;
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (selected) { c.strokeStyle = SUN; c.lineWidth = 12 * u; this.path(e.pts); c.stroke(); }
    c.strokeStyle = SNOW; c.lineWidth = 6.4 * u; this.path(e.pts); c.stroke();
    c.strokeStyle = LV[e.cls]; c.lineWidth = 3.4 * u; this.path(e.pts); c.stroke();
    // chevrons pointing downhill
    c.strokeStyle = SNOW; c.lineWidth = 1.2 * u;
    for (let s = 34; s < e.len - 14; s += 52) {
      const [x, y, dx, dy] = this.game.pointAt(e, s), n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, k = 2.2 * u / this.sc;
      c.beginPath();
      c.moveTo(this.X(x - ux * k - uy * k), this.Y(y - uy * k + ux * k)); c.lineTo(this.X(x), this.Y(y)); c.lineTo(this.X(x - ux * k + uy * k), this.Y(y - uy * k - ux * k));
      c.stroke();
    }
    if (selected || ui.labels) {
      const [x, y] = this.game.pointAt(e, e.len * .5);
      c.font = `italic 600 ${12 * u}px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillStyle = LV[e.cls]; halo(c, e.name, this.X(x) + 7 * u, this.Y(y), 1, LV[e.cls]);
    }
  }

  lift(g, e, selected, ui) {
    const c = this.c, u = this.u;
    const [a, b] = e.pts, ax = this.X(a[0]), ay = this.Y(a[1]), bx = this.X(b[0]), by = this.Y(b[1]);
    const L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L, uy = (by - ay) / L, nx = -uy, ny = ux;
    const side = 2.6 * u;
    if (selected || (ui.arm && !e.gondola)) {
      c.strokeStyle = SUN; c.globalAlpha = selected ? 1 : .55 + .45 * Math.sin(ui.now * 6); c.lineWidth = 12 * u; c.lineCap = 'round';
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.globalAlpha = 1;
    }
    // cable (two strands) and towers
    c.strokeStyle = SNOW; c.lineWidth = 4.5 * u; c.lineCap = 'butt';
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    c.strokeStyle = e.gondola ? RED : INK; c.lineWidth = 1.1 * u;
    c.beginPath(); c.moveTo(ax + nx * side, ay + ny * side); c.lineTo(bx + nx * side, by + ny * side);
    c.moveTo(ax - nx * side, ay - ny * side); c.lineTo(bx - nx * side, by - ny * side); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 1.6 * u; c.beginPath();
    const tw = 22 * this.sc;
    for (let s = tw; s < L - tw * .6; s += tw) { const x = ax + ux * s, y = ay + uy * s; c.moveTo(x + nx * (side + 2 * u), y + ny * (side + 2 * u)); c.lineTo(x - nx * (side + 2 * u), y - ny * (side + 2 * u)); }
    c.stroke();
    // empty chairs going round: up on one strand, down on the other
    const sp = e.spacing * this.sc, off = (e.clock * e.speed) * this.sc;
    c.fillStyle = e.gondola ? RED : INK;
    const cs = e.gondola ? 2.6 * u : 1.5 * u;
    for (let s = off % sp; s < L; s += sp) {
      const x = ax + ux * s + nx * side, y = ay + uy * s + ny * side;
      c.fillRect(x - cs, y - cs, cs * 2, cs * 2);
      const x2 = bx - ux * s - nx * side, y2 = by - uy * s - ny * side;
      c.fillRect(x2 - cs, y2 - cs, cs * 2, cs * 2);
    }
    // riders
    for (const s of g.skiers) if (s.state === 'lift' && s.edge === e.id) {
      const q = s.s * this.sc + (s.seat - (e.seats - 1) / 2) * 1.6 * u, x = ax + ux * q + nx * (side + 2.6 * u), y = ay + uy * q + ny * (side + 2.6 * u);
      shape(c, s.lvl, x, y, 2.3 * u, LV[s.lvl], SNOW, .8);
    }
    // terminals
    for (const [x, y] of [[ax, ay], [bx, by]]) {
      c.save(); c.translate(x, y); c.rotate(Math.atan2(uy, ux));
      c.fillStyle = INK; c.fillRect(-4.5 * u, -side - 2.5 * u, 9 * u, (side + 2.5 * u) * 2);
      c.restore();
    }
    // number plate by the bottom station
    const px = ax + ux * 26 * u + nx * 13 * u, py = ay + uy * 26 * u + ny * 13 * u;
    c.fillStyle = e.gondola ? RED : SNOW; c.strokeStyle = e.gondola ? RED : INK; c.lineWidth = 1.4;
    c.beginPath(); c.arc(px, py, 7.5 * u, 0, 6.2832); c.fill(); c.stroke();
    c.fillStyle = e.gondola ? SNOW : INK; c.font = `800 ${10.5 * u}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(e.no, px, py + .5);
  }

  station(g, n) {
    const c = this.c, u = this.u, x = this.X(n.x), y = this.Y(n.y);
    if (n.kind === 'jct') { c.fillStyle = SNOW; c.strokeStyle = INK; c.lineWidth = 1.3; c.beginPath(); c.arc(x, y, 3 * u, 0, 6.2832); c.fill(); c.stroke(); }
    this.crowdAt(g, n, x, y);
  }

  lodge(g, n, ui) {
    const c = this.c, u = this.u, x = this.X(n.x), y = this.Y(n.y);
    const age = ui.now - (n.shown ?? (n.shown = ui.now));
    const k = Math.min(1, age / .5), s = u * (k < 1 ? 1 + Math.sin(k * Math.PI) * .6 : 1);
    // chalet: roof and body
    c.fillStyle = SNOW; c.strokeStyle = INK; c.lineWidth = 1.5;
    c.beginPath(); c.arc(x, y, 11 * s, 0, 6.2832); c.fill(); c.stroke();
    c.fillStyle = INK; c.beginPath();
    c.moveTo(x - 6.5 * s, y - 1 * s); c.lineTo(x, y - 7 * s); c.lineTo(x + 6.5 * s, y - 1 * s); c.closePath(); c.fill();
    c.fillRect(x - 4.8 * s, y - 1.5 * s, 9.6 * s, 7 * s);
    c.fillStyle = RED; c.fillRect(x - 1.4 * s, y + 1.5 * s, 2.8 * s, 4 * s);
    // name, and which colours can be served from here
    c.font = `italic 600 ${12 * u}px ${FONT}`; c.textBaseline = 'middle';
    const right = n.x < W * .72;
    c.textAlign = right ? 'left' : 'right';
    const tx = x + (right ? 15 : -15) * u;
    halo(c, n.name, tx, y - 5 * u, 1);
    const can = ui.can.get(n.id) || [false, false, false];
    for (let l = 0; l < g.levelsOn; l++) {
      const bx = tx + (right ? 1 : -1) * (4 + l * 11) * u, by = y + 8 * u;
      shape(c, l, bx, by, 3.2 * u, can[l] ? LV[l] : SNOW, can[l] ? SNOW : LV[l], can[l] ? 1 : 1.4);
    }
    this.crowdAt(g, n, x, y);
  }

  // waiting skiers in rows beside the node, and the ring that fills when there are too many
  crowdAt(g, n, x, y) {
    const c = this.c, u = this.u;
    const who = [...n.wait];
    for (const e of g.edges.values()) if (e.type === 'lift' && e.a === n.id) who.push(...e.queue);
    if (n.ring > 0) {
      const r = 15 * u, warn = n.ring > .55;
      c.strokeStyle = 'rgba(207, 51, 38, .2)'; c.lineWidth = 4 * u; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.stroke();
      c.strokeStyle = RED; c.lineWidth = (warn ? 4 + Math.sin(performance.now() / 90) * 1.2 : 4) * u;
      c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + n.ring * 6.2832); c.stroke();
    }
    if (!who.length) return;
    const per = 6, gap = 6.4 * u, x0 = x + (n.x < W * .72 ? -1 : 1) * 0, below = n.kind === 'lodge' ? 19 * u : 9 * u;
    const show = Math.min(who.length, 18);
    for (let i = 0; i < show; i++) {
      const row = (i / per) | 0, col = i % per;
      shape(c, who[i].lvl, x0 - (per - 1) * gap / 2 + col * gap, y + below + row * gap, 2.4 * u, LV[who[i].lvl], SNOW, .8);
    }
    if (who.length > show) {
      c.font = `800 ${11 * u}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillStyle = RED;
      halo(c, `+${who.length - show}`, x0, y + below + 3 * gap - 2 * u, 1, RED);
    }
  }

  ghost(gh, now) {
    const c = this.c, u = this.u;
    c.save();
    c.setLineDash([7 * u, 7 * u]); c.lineDashOffset = -now * 30;
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = SNOW; c.lineWidth = 6 * u; this.path(gh.pts); c.stroke();
    c.strokeStyle = gh.col || RED; c.lineWidth = 3 * u; this.path(gh.pts); c.stroke();
    c.setLineDash([]);
    // a finger dot travelling along it
    const total = gh.pts.length - 1, k = ((now * .45) % 1.3) / 1.0;
    if (k <= 1) {
      const f = k * total, i = Math.min(total - 1, f | 0), t = f - i, p = gh.pts[i], q = gh.pts[i + 1];
      const x = this.X(p[0] + (q[0] - p[0]) * t), y = this.Y(p[1] + (q[1] - p[1]) * t);
      c.fillStyle = 'rgba(28, 33, 48, .2)'; c.beginPath(); c.arc(x, y, 15 * u, 0, 6.2832); c.fill();
      c.fillStyle = SNOW; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 7 * u, 0, 6.2832); c.fill(); c.stroke();
    }
    // end marker
    const e = gh.pts[gh.pts.length - 1];
    c.strokeStyle = gh.col || RED; c.lineWidth = 2; c.beginPath(); c.arc(this.X(e[0]), this.Y(e[1]), 9 * u + Math.sin(now * 5) * 2, 0, 6.2832); c.stroke();
    c.restore();
  }

  preview(g, dr, now) {
    const c = this.c, u = this.u;
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (dr.mode === 'lift') {
      const ax = this.X(dr.a.x), ay = this.Y(dr.a.y), bx = this.X(dr.b.x), by = this.Y(dr.b.y);
      // reach circle
      c.strokeStyle = 'rgba(28, 33, 48, .25)'; c.setLineDash([3, 5]); c.lineWidth = 1.2;
      c.beginPath(); c.arc(ax, ay, g.liftMax * this.sc, 0, 6.2832); c.stroke(); c.setLineDash([]);
      c.strokeStyle = SNOW; c.lineWidth = 6 * u; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      c.strokeStyle = dr.bad ? RED : INK; c.lineWidth = 2.4 * u; c.setLineDash(dr.bad ? [6, 5] : []);
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.setLineDash([]);
      for (const [x, y] of [[ax, ay], [bx, by]]) { c.fillStyle = dr.bad ? RED : INK; c.fillRect(x - 4 * u, y - 4 * u, 8 * u, 8 * u); }
      this.chip(bx, by, dr.bad ? dr.badText : `Chairlift · climbs ${Math.round(dr.climb)} m`, dr.bad ? RED : INK);
    } else if (dr.mode === 'run' && dr.pts.length > 1) {
      const col = LV[dr.cls];
      c.strokeStyle = SNOW; c.lineWidth = 7 * u; this.path(dr.pts); c.stroke();
      c.strokeStyle = col; c.lineWidth = 3.6 * u; this.path(dr.pts); c.stroke();
      const t = dr.pts[dr.pts.length - 1], tx = this.X(t[0]), ty = this.Y(t[1]);
      if (dr.bad && dr.fx != null) {
        c.strokeStyle = RED; c.lineWidth = 2; c.setLineDash([4, 4]);
        c.beginPath(); c.moveTo(tx, ty); c.lineTo(dr.fx, dr.fy); c.stroke(); c.setLineDash([]);
      }
      if (dr.snap) { c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); c.arc(this.X(dr.snap.x), this.Y(dr.snap.y), 13 * u, 0, 6.2832); c.stroke(); }
      this.chip(tx, ty, dr.bad ? dr.badText : `${LVN[dr.cls]} · ${Math.round(dr.steep * 100)}% pitch`, dr.bad ? RED : col, dr.bad ? null : dr.cls);
    }
  }

  chip(x, y, text, col, lvl = null) {
    const c = this.c, u = this.u;
    c.font = `800 ${13 * u}px ${FONT}`; c.textBaseline = 'middle'; c.textAlign = 'left';
    const w = c.measureText(text).width + (lvl != null ? 16 * u : 0) + 14 * u, h = 22 * u;
    let px = x + 16 * u, py = y - 34 * u;
    if (px + w > this.vw - 6) px = x - 16 * u - w;
    if (py < 6) py = y + 18 * u;
    c.fillStyle = col; c.fillRect(px, py, w, h);
    let tx = px + 7 * u;
    if (lvl != null) { shape(c, lvl, tx + 4 * u, py + h / 2, 3.6 * u, SNOW, null); tx += 16 * u; }
    c.fillStyle = SNOW; c.fillText(text, tx, py + h / 2 + .5);
  }
}

export function halo(c, text, x, y, d = 1, fill = INK) {
  c.lineJoin = 'round'; c.strokeStyle = 'rgba(251, 250, 245, .92)'; c.lineWidth = 3.4 * d; c.strokeText(text, x, y);
  c.fillStyle = fill; c.fillText(text, x, y);
}

function rngLocal(seed) { let s = seed * 2654435761 >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
