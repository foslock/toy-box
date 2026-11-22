// Linocut show-poster look: a few flat inks on cream paper, chunky carved outlines,
// paper-coloured gouge marks cut into the dark areas, colour slightly out of register with the black,
// and a fixed paper grain over everything.
import { W } from './walker.js';

export const INK = {
  paper: '#f1e6cf', paper2: '#e7d9bc', ink: '#221d1a', red: '#c8432b', red2: '#9c3020', mustard: '#e0a82e',
  green: '#4c7a3d', green2: '#355c2c', blue: '#3e6d8f', cream: '#fbf4e2',
};
const REG = [1.6, -1.1]; // colour plates sit a touch off the key plate

// ---------- tiny deterministic noise
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
const hh = (a, b = 0) => hash((a * 73856093) ^ (b * 19349663));

// a closed, slightly lumpy shape through points, smoothed with quadratic curves
function smoothClosed(ctx, pts) {
  const n = pts.length;
  ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}
function blobPts(cx, cy, rx, ry, seed, n = 10, rough = 0.12, rot = 0) {
  const pts = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + (hh(seed, i) - 0.5) * 2 * rough;
    const x = Math.cos(a) * rx * r, y = Math.sin(a) * ry * r;
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return pts;
}
function blob(ctx, cx, cy, rx, ry, seed, n, rough, rot) { ctx.beginPath(); smoothClosed(ctx, blobPts(cx, cy, rx, ry, seed, n, rough, rot)); }

// a gouge: the sliver of lino a V-tool takes out, left as bare paper
function gouge(ctx, x, y, len, ang, w) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const ex = x + c * len, ey = y + s * len;
  const nx = -s * w, ny = c * w;
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo((x + ex) / 2 + nx, (y + ey) / 2 + ny, ex, ey);
  ctx.quadraticCurveTo((x + ex) / 2 - nx * 0.3, (y + ey) / 2 - ny * 0.3, x, y);
}

// ---------- paper and print texture (screen space: it's the sheet, not the world)
let grain = null, speck = null;
function makeTextures() {
  const g = document.createElement('canvas'); g.width = g.height = 384;
  const c = g.getContext('2d');
  c.fillStyle = INK.paper; c.fillRect(0, 0, 384, 384);
  const id = c.getImageData(0, 0, 384, 384), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (hash(i * 7 + 3) - 0.5) * 16 + (hash(((i >> 2) % 384) * 131 + 7) - 0.5) * 6;
    d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8;
  }
  c.putImageData(id, 0, 0);
  // fibres
  c.strokeStyle = 'rgba(120,90,50,.07)'; c.lineWidth = 1;
  for (let i = 0; i < 140; i++) { const x = hh(i, 1) * 384, y = hh(i, 2) * 384, a = hh(i, 3) * 6.28, l = 6 + hh(i, 4) * 14; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  grain = g;
  // where the ink didn't quite take: pale specks laid over everything
  const s = document.createElement('canvas'); s.width = s.height = 256;
  const sc = s.getContext('2d');
  for (let i = 0; i < 900; i++) {
    const x = hh(i, 11) * 256, y = hh(i, 12) * 256, r = 0.4 + hh(i, 13) ** 3 * 1.8;
    sc.fillStyle = `rgba(251,244,226,${0.25 + hh(i, 14) * 0.5})`;
    sc.beginPath(); sc.ellipse(x, y, r * (1 + hh(i, 15)), r, hh(i, 16) * 3, 0, 6.29); sc.fill();
  }
  speck = s;
}

// ---------- the view
export class View {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.camX = 0; this.dpr = 1; this.t = 0;
    this.crowdJoy = 0;
    if (!grain) makeTextures();
  }
  resize(w, h) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w; this.h = h;
    this.cv.width = Math.round(w * this.dpr); this.cv.height = Math.round(h * this.dpr);
    this.portrait = h > w * 1.05;
    this.s = this.portrait ? Math.min(w / 3.9, h / 5.6) : Math.min(w / 7.8, h / 3.9);
    this.short = !this.portrait && h < 500;
    if (this.short) this.s = Math.min(w / 8.2, h / 4.3);
    this.groundY = this.portrait ? h * 0.64 : this.short ? h * 0.77 : h * 0.73;
    this.lead = this.portrait ? 0.4 : this.short ? 0.3 : 0.36;
  }
  X(x) { return (x - this.camX) * this.s; }
  Y(y) { return this.groundY - y * this.s; }

  follow(x, dt, snap) {
    const target = x - (this.w / this.s) * this.lead;
    if (snap) this.camX = target;
    else this.camX += (target - this.camX) * Math.min(1, dt * 4);
  }

  // ---- draw a whole frame
  draw(run, ui = {}) {
    const ctx = this.ctx, dpr = this.dpr;
    this.t = ui.t ?? this.t;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // paper
    const pat = this.grainPat || (this.grainPat = ctx.createPattern(grain, 'repeat'));
    ctx.fillStyle = pat; ctx.fillRect(0, 0, this.w, this.h);
    this.sky();
    this.hills(0.12, INK.green2, 0.95, 31, 0.34);
    this.hills(0.22, INK.green, 0.55, 57, 0.2);
    this.tents(0.38);
    this.bunting(0.55);
    this.crowd(0.72, ui);
    this.ground(run && run.course);
    if (run) {
      this.courseBits(run);
      if (run.band) this.band(run.band, run);
      if (run.rivals) for (const r of run.rivals) this.rival(r, run);
    }
    const pose = ui.pose || (run && run.pose());
    if (pose) this.horse(pose, { main: true, hup: run && run.hup, simT: run ? run.simT : this.t, mood: ui.mood });
    this.frontGrass();
    if (run && run.state === 'replay') this.replayFrame();
    // print texture last
    const sp = this.speckPat || (this.speckPat = ctx.createPattern(speck, 'repeat'));
    ctx.globalAlpha = 0.55; ctx.fillStyle = sp; ctx.fillRect(0, 0, this.w, this.h); ctx.globalAlpha = 1;
  }

  // ---------- backdrop
  sky() {
    const ctx = this.ctx, w = this.w;
    // a carved sun, barely moving
    const sx = w * 0.82 - (this.camX * this.s * 0.02) % (w * 1.4), sy = this.groundY * 0.28, r = Math.min(this.s * 0.55, 60);
    ctx.save(); ctx.translate(REG[0], REG[1]);
    ctx.fillStyle = INK.mustard; blob(ctx, sx, sy, r, r, 5, 14, 0.04); ctx.fill();
    ctx.restore();
    ctx.fillStyle = INK.ink;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.1, r0 = r * 1.22, r1 = r * (1.5 + (i % 2) * 0.25);
      ctx.beginPath(); gouge(ctx, sx + Math.cos(a) * r0, sy + Math.sin(a) * r0, r1 - r0, a, 2.6); ctx.fill();
    }
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 2.5; blob(ctx, sx, sy, r, r, 5, 14, 0.04); ctx.stroke();
    // a few carved sky lines
    ctx.strokeStyle = 'rgba(34,29,26,.16)'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 7; i++) {
      const y = this.groundY * (0.08 + i * 0.07), off = (this.camX * this.s * 0.04) % 400;
      ctx.beginPath();
      for (let x = -400; x < w + 400; x += 160) {
        const xx = x - off + hh(i, Math.floor((x + this.camX * this.s * 0.04) / 160)) * 60;
        ctx.moveTo(xx, y + hh(i, x) * 4); ctx.lineTo(xx + 40 + hh(x, i) * 70, y + hh(x, i + 1) * 4);
      }
      ctx.stroke();
    }
  }

  hills(par, colour, height, seed, gy) {
    const ctx = this.ctx, w = this.w, base = this.groundY - this.s * gy;
    const off = this.camX * this.s * par, seg = 260;
    const i0 = Math.floor(off / seg) - 1, i1 = i0 + Math.ceil(w / seg) + 3;
    const H = (i) => base - this.s * height * (0.45 + hh(seed, i) * 0.55);
    ctx.save(); ctx.translate(REG[0], REG[1]);
    ctx.fillStyle = colour;
    ctx.beginPath(); ctx.moveTo(-10, this.groundY + 4);
    for (let i = i0; i <= i1; i++) { const x = i * seg - off, nx = (i + 1) * seg - off; ctx.quadraticCurveTo(x + seg / 2, H(i), nx, (H(i) + H(i + 1)) / 2 + 10); }
    ctx.lineTo(w + 10, this.groundY + 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    // carved contour lines in the hills
    ctx.strokeStyle = INK.paper; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.6;
    for (let i = i0; i <= i1; i++) {
      const x = i * seg - off;
      for (let k = 0; k < 3; k++) {
        const y = H(i) + 14 + k * 11 + hh(seed + k, i) * 6;
        if (y > this.groundY - 4) continue;
        ctx.beginPath(); ctx.moveTo(x + 50 + k * 14, y); ctx.quadraticCurveTo(x + seg / 2, y - 7, x + seg - 40 - k * 10, y + 4); ctx.stroke();
      }
      // a lollipop tree now and then
      if (hh(seed, i + 99) > 0.55) {
        const tx = x + seg * 0.4, ty = H(i) + 8, tr = this.s * 0.22 * (0.7 + hh(seed, i + 5) * 0.6) * (par + 0.6);
        ctx.globalAlpha = 1;
        ctx.fillStyle = INK.ink; ctx.fillRect(tx - 2, ty - tr * 0.5, 4, tr * 1.4);
        blob(ctx, tx, ty - tr * 1.1, tr, tr * 1.15, seed + i, 9, 0.18); ctx.fill();
        ctx.fillStyle = INK.paper;
        ctx.beginPath(); for (let g = 0; g < 4; g++) gouge(ctx, tx - tr * 0.6 + g * tr * 0.25, ty - tr * 1.4 + g * 4, tr * 0.5, 0.9, 1.4); ctx.fill();
        ctx.globalAlpha = 0.6;
      }
    }
    ctx.globalAlpha = 1;
  }

  tents(par) {
    const ctx = this.ctx, w = this.w, off = this.camX * this.s * par, seg = 520;
    const i0 = Math.floor(off / seg) - 1, i1 = i0 + Math.ceil(w / seg) + 2;
    const base = this.groundY - this.s * 0.6;
    for (let i = i0; i <= i1; i++) {
      if (hh(i, 3) < 0.25) continue;
      const cx = i * seg - off + hh(i, 4) * 120, tw = this.s * (1.4 + hh(i, 5) * 0.8), th = this.s * (0.9 + hh(i, 6) * 0.4);
      const big = hh(i, 7) > 0.5;
      // walls in stripes
      const stripes = 7;
      ctx.save(); ctx.translate(REG[0], REG[1]);
      for (let k = 0; k < stripes; k++) {
        ctx.fillStyle = k % 2 ? INK.cream : big ? INK.red : INK.green;
        ctx.fillRect(cx - tw / 2 + (k * tw) / stripes, base - th * 0.55, tw / stripes + 0.5, th * 0.55);
      }
      ctx.restore();
      ctx.fillStyle = big ? INK.red : INK.green;
      ctx.beginPath(); ctx.moveTo(cx - tw / 2 - 8, base - th * 0.55); ctx.lineTo(cx, base - th * 1.25); ctx.lineTo(cx + tw / 2 + 8, base - th * 0.55);
      // scalloped valance
      for (let k = 6; k >= 0; k--) { const x = cx - tw / 2 - 8 + ((k + 0.5) * (tw + 16)) / 7; ctx.quadraticCurveTo(x + (tw + 16) / 14, base - th * 0.42, x - (tw + 16) / 14, base - th * 0.55); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK.ink; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.strokeRect(cx - tw / 2, base - th * 0.55, tw, th * 0.55);
      // the door flap
      ctx.fillStyle = INK.ink; ctx.beginPath(); ctx.moveTo(cx - tw * 0.1, base); ctx.lineTo(cx, base - th * 0.45); ctx.lineTo(cx + tw * 0.1, base); ctx.fill();
      // flag on top
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, base - th * 1.25); ctx.lineTo(cx, base - th * 1.5); ctx.stroke();
      const wave = Math.sin(this.t * 3 + i) * 3;
      ctx.fillStyle = INK.mustard; ctx.beginPath(); ctx.moveTo(cx, base - th * 1.5); ctx.lineTo(cx + 18, base - th * 1.45 + wave); ctx.lineTo(cx, base - th * 1.4); ctx.fill(); ctx.stroke();
      // a painted sign on the big ones
      if (big && hh(i, 9) > 0.4) {
        const names = ['TEAS', 'JAMS', 'MARROWS', 'PIMMS', 'RAFFLE', 'BONNY BABIES'];
        ctx.fillStyle = INK.cream; ctx.fillRect(cx - tw * 0.3, base - th * 0.52, tw * 0.6, th * 0.18);
        ctx.strokeRect(cx - tw * 0.3, base - th * 0.52, tw * 0.6, th * 0.18);
        ctx.fillStyle = INK.ink; ctx.font = `${Math.round(th * 0.12)}px "Holtwood One SC", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(names[Math.floor(hh(i, 10) * names.length)], cx, base - th * 0.43, tw * 0.56);
      }
    }
  }

  bunting(par) {
    const ctx = this.ctx, w = this.w, off = this.camX * this.s * par, seg = 300;
    const i0 = Math.floor(off / seg) - 1, i1 = i0 + Math.ceil(w / seg) + 2;
    const y0 = this.portrait ? this.groundY * 0.2 : this.groundY * 0.16;
    const cols = [INK.red, INK.mustard, INK.cream, INK.green, INK.blue];
    for (let i = i0; i <= i1; i++) {
      const xa = i * seg - off, xb = xa + seg, sag = 38 + hh(i, 1) * 16;
      const ya = y0 + hh(i, 2) * 10, yb = y0 + hh(i + 1, 2) * 10;
      ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(xa, ya); ctx.quadraticCurveTo((xa + xb) / 2, (ya + yb) / 2 + sag * 2, xb, yb); ctx.stroke();
      for (let k = 1; k < 9; k++) {
        const u = k / 9, x = (1 - u) * (1 - u) * xa + 2 * u * (1 - u) * ((xa + xb) / 2) + u * u * xb;
        const y = (1 - u) * (1 - u) * ya + 2 * u * (1 - u) * ((ya + yb) / 2 + sag * 2) + u * u * yb;
        const sway = Math.sin(this.t * 2.2 + i * 3 + k) * 0.12;
        const fw = 11, fh = 22;
        ctx.save(); ctx.translate(x, y); ctx.rotate(sway);
        ctx.fillStyle = cols[(i * 9 + k) % cols.length];
        ctx.beginPath(); ctx.moveTo(-fw + 1.5, 1); ctx.lineTo(fw + 1.5, 1); ctx.lineTo(1.5, fh); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-fw, 0); ctx.lineTo(fw, 0); ctx.lineTo(0, fh); ctx.closePath(); ctx.lineWidth = 1.4; ctx.stroke();
        ctx.restore();
      }
    }
  }

  crowd(par, ui) {
    const ctx = this.ctx, w = this.w, off = this.camX * this.s * par;
    const sp = this.s * 0.26;
    const base = this.groundY - this.s * 0.25;
    const i0 = Math.floor(off / sp) - 2, i1 = i0 + Math.ceil(w / sp) + 4;
    const joy = this.crowdJoy;
    ctx.save();
    for (let row = 0; row < 2; row++) {
      const by = base - row * this.s * 0.2;
      for (let i = i0; i <= i1; i++) {
        const id = i * 2 + row;
        if (hh(id, 1) < 0.12) continue;
        const x = i * sp - off + (row ? sp * 0.5 : 0) + (hh(id, 2) - 0.5) * sp * 0.4;
        const hgt = this.s * (0.42 + hh(id, 3) * 0.2);
        const bob = Math.max(0, Math.sin(this.t * (6 + hh(id, 4) * 4) + id)) * joy * this.s * 0.07;
        const y = by - bob;
        const colour = row ? INK.green2 : INK.ink;
        ctx.fillStyle = colour;
        // shoulders and head
        ctx.beginPath(); ctx.ellipse(x, y, sp * 0.42, hgt * 0.35, 0, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x, y - hgt * 0.5, sp * 0.22, sp * 0.25, 0, 0, 6.29); ctx.fill();
        const hat = Math.floor(hh(id, 5) * 5);
        if (hat === 0) { ctx.fillRect(x - sp * 0.34, y - hgt * 0.62, sp * 0.68, sp * 0.06); ctx.fillRect(x - sp * 0.2, y - hgt * 0.82, sp * 0.4, sp * 0.22); }
        else if (hat === 1) { ctx.beginPath(); ctx.ellipse(x, y - hgt * 0.62, sp * 0.4, sp * 0.08, 0, 0, 6.29); ctx.fill(); ctx.beginPath(); ctx.ellipse(x, y - hgt * 0.68, sp * 0.2, sp * 0.13, 0, Math.PI, 0); ctx.fill(); }
        else if (hat === 2) { ctx.fillStyle = INK.red; ctx.beginPath(); ctx.ellipse(x, y - hgt * 0.65, sp * 0.24, sp * 0.12, 0, Math.PI, 0); ctx.fill(); }
        // carved highlight down one side
        ctx.fillStyle = INK.paper;
        ctx.beginPath(); gouge(ctx, x - sp * 0.15, y - hgt * 0.6, sp * 0.2, 1.4, 1.3); gouge(ctx, x + sp * 0.12, y - hgt * 0.22, sp * 0.22, 1.2, 1.4); ctx.fill();
        // someone waving a little flag
        if (hh(id, 6) > 0.86) {
          const wave = Math.sin(this.t * 7 + id) * (0.25 + joy * 0.5);
          const ax = x + sp * 0.3, ay = y - hgt * 0.3;
          const tx = ax + Math.sin(wave) * sp * 0.7, ty = ay - Math.cos(wave) * sp * 1.1;
          ctx.strokeStyle = colour; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx, ty); ctx.stroke();
          ctx.fillStyle = hh(id, 7) > 0.5 ? INK.red : INK.mustard;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + 14, ty + 4); ctx.lineTo(tx + 1, ty + 10); ctx.fill();
        }
      }
    }
    ctx.restore();
    // rope and posts along the ring
    const ropeY = this.groundY - this.s * 0.3;
    const off2 = this.camX * this.s;
    const ps = this.s * 1.6;
    const j0 = Math.floor(off2 / ps) - 1, j1 = j0 + Math.ceil(w / ps) + 2;
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let j = j0; j < j1; j++) { const xa = j * ps - off2, xb = xa + ps; ctx.moveTo(xa, ropeY); ctx.quadraticCurveTo((xa + xb) / 2, ropeY + 9, xb, ropeY); }
    ctx.stroke();
    for (let j = j0; j <= j1; j++) {
      const x = j * ps - off2;
      ctx.fillStyle = INK.cream; ctx.fillRect(x - 4, ropeY - 6, 8, this.s * 0.3 + 6);
      ctx.strokeRect(x - 4, ropeY - 6, 8, this.s * 0.3 + 6);
    }
  }

  ground(course) {
    const ctx = this.ctx, w = this.w, s = this.s;
    const x0 = this.camX - 1, x1 = this.camX + w / s + 1;
    const fl = course ? (x) => course.floor(x) : () => 0;
    ctx.save(); ctx.translate(REG[0] * 0.6, REG[1] * 0.6);
    ctx.fillStyle = INK.green;
    ctx.beginPath(); ctx.moveTo(-10, this.h + 10);
    for (let x = x0; x <= x1; x += 0.1) ctx.lineTo(this.X(x), this.Y(fl(x)));
    ctx.lineTo(w + 10, this.h + 10); ctx.closePath(); ctx.fill();
    ctx.restore();
    // the edge of the turf, cut with a knife
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 0.1) { const X = this.X(x), Y = this.Y(fl(x)) + (hh(Math.floor(x * 10), 3) - 0.5) * 1.4; if (x === x0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); }
    ctx.stroke();
    // carved grass: rows of little V cuts that scroll with the world
    ctx.fillStyle = INK.paper; ctx.globalAlpha = 0.75;
    ctx.beginPath();
    for (let row = 0; row < 5; row++) {
      const yy = this.groundY + 14 + row * row * 9 + row * 10;
      if (yy > this.h) break;
      const step = 0.42 + row * 0.12;
      for (let x = Math.floor(x0 / step) * step; x < x1; x += step) {
        const k = Math.round(x / step);
        if (hh(k, row) < 0.35) continue;
        const X = this.X(x + hh(k, row + 9) * step * 0.5), Y = yy + hh(k, row + 4) * 6;
        gouge(ctx, X, Y, 6 + row * 2.2, -1.25 - hh(k, 2) * 0.4, 1.4);
        gouge(ctx, X + 4, Y, 5 + row * 2, -1.9 + hh(k, 3) * 0.3, 1.3);
      }
    }
    ctx.fill(); ctx.globalAlpha = 1;
    // a chalked track line
    ctx.strokeStyle = INK.cream; ctx.lineWidth = 2; ctx.setLineDash([14, 10]); ctx.lineDashOffset = this.camX * s;
    ctx.beginPath(); ctx.moveTo(0, this.groundY + s * 0.5); ctx.lineTo(w, this.groundY + s * 0.5); ctx.stroke(); ctx.setLineDash([]);
  }

  frontGrass() {
    const ctx = this.ctx, w = this.w, s = this.s;
    const off = this.camX * s * 1.18, sp = 46;
    const i0 = Math.floor(off / sp) - 1, i1 = i0 + Math.ceil(w / sp) + 2;
    ctx.fillStyle = INK.green2;
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      if (hh(i, 41) < 0.6) continue;
      const x = i * sp - off, y = this.groundY + s * 0.22 + hh(i, 42) * s * 0.1;
      for (let k = 0; k < 4; k++) { const a = -1.9 + k * 0.28 + (hh(i, k) - 0.5) * 0.2, l = s * (0.16 + hh(i, k + 5) * 0.12); gouge(ctx, x + k * 3, y, l, a, 2.6); }
    }
    ctx.fill();
  }

  // ---------- course furniture
  courseBits(run) {
    const ctx = this.ctx, s = this.s, c = run.course;
    const x0 = this.camX - 2, x1 = this.camX + this.w / s + 2;
    // start and finish banners
    for (const [x, label, col] of [[0, 'START', INK.green], [c.length, 'FINISH', INK.red]]) {
      if (x < x0 - 2 || x > x1 + 2) continue;
      const X = this.X(x + 0.9), top = this.Y(2.25);
      const pw = s * 2.1;
      ctx.fillStyle = INK.ink;
      ctx.fillRect(X - pw / 2 - 4, top, 7, this.groundY - top); ctx.fillRect(X + pw / 2 - 3, top, 7, this.groundY - top);
      ctx.save(); ctx.translate(REG[0], REG[1]); ctx.fillStyle = col; ctx.fillRect(X - pw / 2, top + 6, pw, s * 0.38); ctx.restore();
      ctx.strokeStyle = INK.ink; ctx.lineWidth = 2.5; ctx.strokeRect(X - pw / 2, top + 6, pw, s * 0.38);
      ctx.fillStyle = INK.cream; ctx.font = `${Math.round(s * 0.24)}px "Holtwood One SC", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, X, top + 6 + s * 0.2, pw * 0.9);
    }
    // checkpoint flags
    run.course.flags.forEach((f, i) => {
      if (i === 0 || f < x0 || f > x1) return;
      const X = this.X(f), top = this.Y(1.25), passed = run.flag >= f;
      ctx.strokeStyle = INK.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X, this.groundY); ctx.lineTo(X, top); ctx.stroke();
      const wave = Math.sin(this.t * 4 + i) * 4;
      ctx.save(); ctx.translate(REG[0], REG[1]);
      ctx.fillStyle = passed ? INK.mustard : INK.red;
      ctx.beginPath(); ctx.moveTo(X, top); ctx.quadraticCurveTo(X + s * 0.25, top + wave, X + s * 0.5, top + s * 0.14 + wave); ctx.quadraticCurveTo(X + s * 0.25, top + s * 0.2, X, top + s * 0.3); ctx.fill();
      ctx.restore();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X, top); ctx.quadraticCurveTo(X + s * 0.25, top + wave, X + s * 0.5, top + s * 0.14 + wave); ctx.quadraticCurveTo(X + s * 0.25, top + s * 0.2, X, top + s * 0.3); ctx.stroke();
      ctx.fillStyle = INK.ink; ctx.font = `${Math.round(s * 0.13)}px "Holtwood One SC", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i), X + s * 0.18, top + s * 0.15 + wave * 0.4);
    });
    // dressage letters
    if (run.marks) for (const m of run.marks) {
      if (m.x < x0 || m.x > x1) continue;
      const X = this.X(m.x);
      // halt line chalked on the turf
      ctx.strokeStyle = m.state === 'done' ? INK.mustard : INK.cream; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(X - s * 0.45, this.groundY + 3); ctx.lineTo(X + s * 0.45, this.groundY + 3); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X - s * 0.45, this.groundY - 4); ctx.lineTo(X - s * 0.45, this.groundY + 10); ctx.moveTo(X + s * 0.45, this.groundY - 4); ctx.lineTo(X + s * 0.45, this.groundY + 10); ctx.stroke();
      // the letter board, behind the horse
      const bx = X, by = this.groundY - s * 0.42, bw = s * 0.42;
      ctx.fillStyle = INK.ink; ctx.fillRect(bx - 2, by, 4, s * 0.42);
      ctx.fillStyle = m.state === 'missed' ? INK.paper2 : INK.cream;
      ctx.fillRect(bx - bw / 2, by - bw, bw, bw); ctx.strokeStyle = INK.ink; ctx.lineWidth = 2.5; ctx.strokeRect(bx - bw / 2, by - bw, bw, bw);
      ctx.fillStyle = m.state === 'done' ? INK.red : INK.ink;
      ctx.font = `${Math.round(bw * 0.62)}px "Holtwood One SC", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(m.letter, bx, by - bw / 2 + 2);
      if (m.state === 'todo' && m.hold > 0) {
        ctx.strokeStyle = INK.red; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(bx, by - bw * 1.75, bw * 0.32, -Math.PI / 2, -Math.PI / 2 + (m.hold / 1.5) * Math.PI * 2); ctx.stroke();
      }
      if (m.state === 'done') { ctx.fillStyle = INK.red; ctx.font = `${Math.round(s * 0.16)}px "Holtwood One SC", serif`; ctx.fillText('✓', bx + bw * 0.62, by - bw * 0.9); }
    }
    // obstacles
    for (const o of c.obstacles) {
      if (o.x1 < x0 || o.x0 > x1) continue;
      if (o.type === 'log') this.log(o);
      else if (o.type === 'bale') this.bale(o);
      else if (o.type === 'ditch') this.ditch(o);
    }
  }

  log(o) {
    const ctx = this.ctx, s = this.s, X = this.X(o.x), Y = this.Y(o.r), r = o.r * s;
    const kerb = o.kind === 'kerb', pole = o.kind === 'pole';
    if (kerb) {
      ctx.fillStyle = INK.cream; ctx.fillRect(X - r * 6, Y - r, r * 12, r * 2);
      ctx.strokeStyle = INK.ink; ctx.lineWidth = 2.5; ctx.strokeRect(X - r * 6, Y - r, r * 12, r * 2);
      ctx.fillStyle = INK.ink; for (let k = -5; k < 6; k += 2) ctx.fillRect(X + k * r, Y - r, r, r * 2);
      return;
    }
    if (pole) {
      // a striped dressage pole on two little blocks
      const L = s * 1.1;
      ctx.fillStyle = INK.cream; ctx.fillRect(X - L / 2, Y - r, L, r * 2);
      ctx.fillStyle = INK.red; for (let k = 0; k < 6; k += 2) ctx.fillRect(X - L / 2 + (k * L) / 6, Y - r, L / 6, r * 2);
      ctx.strokeStyle = INK.ink; ctx.lineWidth = 2.5; ctx.strokeRect(X - L / 2, Y - r, L, r * 2);
      return;
    }
    // lying across the track: we see the cut end, and the log running away from us into the ring
    const dx = s * 0.22, dy = -s * 0.2, L = Math.hypot(dx, dy), nx = -dy / L * r, ny = dx / L * r;
    ctx.save(); ctx.translate(REG[0], REG[1]);
    ctx.fillStyle = INK.mustard;
    ctx.beginPath(); ctx.moveTo(X + nx, Y + ny); ctx.lineTo(X + dx + nx, Y + dy + ny); ctx.arc(X + dx, Y + dy, r, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true); ctx.lineTo(X - nx, Y - ny); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(X + nx, Y + ny); ctx.lineTo(X + dx + nx, Y + dy + ny); ctx.arc(X + dx, Y + dy, r, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true); ctx.lineTo(X - nx, Y - ny); ctx.stroke();
    ctx.fillStyle = INK.ink; ctx.beginPath();
    for (let k = 0; k < 3; k++) { const u = -0.5 + k * 0.5; gouge(ctx, X + nx * u + dx * 0.2, Y + ny * u + dy * 0.2, L * 0.6, Math.atan2(dy, dx), 1.3); }
    ctx.fill();
    ctx.fillStyle = INK.paper2; blob(ctx, X, Y, r, r, o.x * 10, 9, 0.06); ctx.fill();
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.lineWidth = 1.3;
    for (let k = 1; k < 3; k++) { blob(ctx, X + 1, Y, r * k / 3, r * k / 3, o.x * 10 + k, 8, 0.1); ctx.stroke(); }
  }

  bale(o) {
    const ctx = this.ctx, s = this.s, X0 = this.X(o.x0), X1 = this.X(o.x1), Yt = this.Y(o.h), Yb = this.groundY;
    ctx.save(); ctx.translate(REG[0], REG[1]);
    ctx.fillStyle = INK.mustard; ctx.fillRect(X0, Yt, X1 - X0, Yb - Yt);
    ctx.restore();
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.strokeRect(X0, Yt, X1 - X0, Yb - Yt);
    // straw texture: short black strokes
    ctx.lineWidth = 1.4; ctx.beginPath();
    for (let k = 0; k < 26; k++) {
      const x = X0 + hh(o.x * 9, k) * (X1 - X0), y = Yt + hh(o.x * 9, k + 40) * (Yb - Yt);
      const a = (hh(o.x, k) - 0.5) * 0.9;
      ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9);
    }
    ctx.stroke();
    // baling twine
    ctx.strokeStyle = INK.red; ctx.lineWidth = 2.4; ctx.beginPath();
    ctx.moveTo(X0 + (X1 - X0) * 0.3, Yt); ctx.lineTo(X0 + (X1 - X0) * 0.3, Yb); ctx.moveTo(X0 + (X1 - X0) * 0.7, Yt); ctx.lineTo(X0 + (X1 - X0) * 0.7, Yb); ctx.stroke();
    // loose straw on top
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let k = 0; k < 6; k++) { const x = X0 + hh(o.x, k + 70) * (X1 - X0); ctx.moveTo(x, Yt); ctx.lineTo(x + (hh(o.x, k + 80) - 0.5) * 12, Yt - 6 - hh(o.x, k + 90) * 5); }
    ctx.stroke();
  }

  ditch(o) {
    const ctx = this.ctx, s = this.s;
    const X0 = this.X(o.x0 - 0.1), X1 = this.X(o.x1 + 0.1), Yw = this.Y(-0.06), Yb = this.Y(-o.depth);
    ctx.save(); ctx.translate(REG[0], REG[1]);
    ctx.fillStyle = INK.blue;
    ctx.beginPath(); ctx.moveTo(X0, Yw); ctx.lineTo(X1, Yw); ctx.lineTo(this.X(o.x1), Yb); ctx.lineTo(this.X(o.x0), Yb); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = INK.cream; ctx.beginPath();
    for (let k = 0; k < 7; k++) { const x = X0 + ((k + 0.5) / 7) * (X1 - X0) + Math.sin(this.t * 2 + k) * 3; gouge(ctx, x - 8, Yw + 6 + (k % 3) * 4, 16, 0.08, 1.6); }
    ctx.fill();
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(X0, Yw); ctx.lineTo(X1, Yw); ctx.stroke();
    // reeds at either end
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 2;
    for (const ex of [X0 - 6, X1 + 6]) for (let k = 0; k < 4; k++) {
      const sway = Math.sin(this.t * 1.5 + k + ex) * 3;
      ctx.beginPath(); ctx.moveTo(ex + k * 4 - 6, this.groundY); ctx.quadraticCurveTo(ex + k * 4 - 6, this.groundY - s * 0.3, ex + k * 4 - 6 + sway, this.groundY - s * (0.4 + (k % 2) * 0.12)); ctx.stroke();
      if (k % 2 === 0) { ctx.fillStyle = INK.ink; ctx.fillRect(ex + k * 4 - 8 + sway, this.groundY - s * (0.36 + (k % 2) * 0.12), 4, s * 0.1); }
    }
  }

  // ---------- the band (parade)
  band(b, run) {
    const ctx = this.ctx, s = this.s;
    const kinds = ['tuba', 'trombone', 'cornet', 'drum'];
    kinds.forEach((kind, i) => {
      const x = b.x + 0.25 + i * 0.85;
      if (x < this.camX - 1 || x > this.camX + this.w / s + 1) return;
      const phase = (b.x * 2.2 + i * 0.5) * Math.PI;
      const marching = run.t > b.wait && !b.done;
      const tilt = kind === 'tuba' && b.stumble > 0 ? Math.sin(b.stumble * 9) * 0.25 : 0;
      this.bandsman(x, kind, marching ? phase : 0, tilt);
    });
  }

  bandsman(x, kind, phase, tilt) {
    const ctx = this.ctx, s = this.s;
    const X = this.X(x), Y = this.groundY;
    const sw = Math.sin(phase) * 0.35;
    ctx.save(); ctx.translate(X, Y); ctx.rotate(tilt);
    ctx.lineCap = 'round'; ctx.strokeStyle = INK.ink;
    // legs
    ctx.lineWidth = s * 0.09;
    const hipY = -s * 0.82;
    for (const k of [1, -1]) { ctx.beginPath(); ctx.moveTo(0, hipY); ctx.lineTo(Math.sin(sw * k) * s * 0.82, hipY + Math.cos(sw * k) * s * 0.82); ctx.stroke(); }
    // tunic
    ctx.save(); ctx.translate(REG[0], REG[1]);
    ctx.fillStyle = INK.red; ctx.beginPath(); ctx.roundRect(-s * 0.16, hipY - s * 0.62, s * 0.32, s * 0.66, s * 0.06); ctx.fill();
    ctx.restore();
    ctx.lineWidth = 2.4; ctx.beginPath(); ctx.roundRect(-s * 0.16, hipY - s * 0.62, s * 0.32, s * 0.66, s * 0.06); ctx.stroke();
    ctx.fillStyle = INK.mustard; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(s * 0.1, hipY - s * 0.5 + k * s * 0.16, 2.5, 0, 6.29); ctx.fill(); }
    // head and peaked cap
    ctx.fillStyle = INK.cream; ctx.beginPath(); ctx.arc(0, hipY - s * 0.76, s * 0.12, 0, 6.29); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK.ink; ctx.fillRect(-s * 0.13, hipY - s * 0.98, s * 0.26, s * 0.12); ctx.fillRect(-s * 0.02, hipY - s * 0.88, s * 0.2, s * 0.04);
    ctx.fillStyle = INK.ink; ctx.beginPath(); ctx.arc(s * 0.05, hipY - s * 0.77, 2, 0, 6.29); ctx.fill();
    // instrument
    ctx.lineWidth = 2.4; ctx.fillStyle = INK.mustard;
    const iy = hipY - s * 0.4;
    if (kind === 'tuba') {
      ctx.beginPath(); ctx.ellipse(-s * 0.05, iy, s * 0.2, s * 0.26, 0, 0, 6.29); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.1, iy - s * 0.2); ctx.quadraticCurveTo(-s * 0.3, iy - s * 0.6, -s * 0.05, iy - s * 0.72); ctx.lineTo(s * 0.32, iy - s * 0.86); ctx.lineTo(s * 0.32, iy - s * 0.42); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK.ink; ctx.beginPath(); ctx.ellipse(s * 0.32, iy - s * 0.64, s * 0.05, s * 0.22, 0, 0, 6.29); ctx.fill();
    } else if (kind === 'trombone') {
      ctx.strokeStyle = INK.mustard; ctx.lineWidth = 4;
      const slide = Math.sin(phase * 2) * s * 0.12;
      ctx.beginPath(); ctx.moveTo(s * 0.05, iy - s * 0.32); ctx.lineTo(s * 0.7 + slide, iy - s * 0.32); ctx.moveTo(s * 0.05, iy - s * 0.24); ctx.lineTo(s * 0.7 + slide, iy - s * 0.24); ctx.stroke();
      ctx.strokeStyle = INK.ink; ctx.lineWidth = 2; ctx.fillStyle = INK.mustard;
      ctx.beginPath(); ctx.moveTo(s * 0.4, iy - s * 0.3); ctx.lineTo(s * 0.62, iy - s * 0.45); ctx.lineTo(s * 0.62, iy - s * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (kind === 'cornet') {
      ctx.beginPath(); ctx.moveTo(s * 0.1, iy - s * 0.3); ctx.lineTo(s * 0.42, iy - s * 0.38); ctx.lineTo(s * 0.42, iy - s * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = INK.cream; ctx.beginPath(); ctx.ellipse(s * 0.12, iy + s * 0.05, s * 0.12, s * 0.24, 0, 0, 6.29); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = INK.red; ctx.lineWidth = 2;
      ctx.beginPath(); for (let k = -2; k <= 2; k++) { ctx.moveTo(s * 0.04, iy + k * s * 0.08); ctx.lineTo(s * 0.2, iy + (k + 1) * s * 0.08); } ctx.stroke();
      ctx.strokeStyle = INK.ink; ctx.lineWidth = 3; const beat = Math.sin(phase * 2) * 0.6;
      ctx.beginPath(); ctx.moveTo(s * 0.05, iy - s * 0.2); ctx.lineTo(s * 0.05 + Math.cos(beat - 0.6) * s * 0.3, iy - s * 0.2 + Math.sin(beat - 0.6) * s * 0.3); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- rival horses run in the lane behind, a size smaller
  rival(r, run) {
    const depth = 0.3 + r.lane * 0.26;
    const keep = { s: this.s, groundY: this.groundY, camX: this.camX };
    const sc = 1 - depth * 0.5;
    this.s = keep.s * sc; this.groundY = keep.groundY - keep.s * depth * 0.9;
    const focus = keep.camX + (this.w / keep.s) * this.lead;
    this.camX = focus - (this.w / this.s) * this.lead;
    this.ctx.globalAlpha = 0.82 - r.lane * 0.12;
    if (r.down > 0 && r.heap) this.heap(r.heap.x, r.colour);
    else this.horse(r.w.pose(), { colour: r.colour, rival: true, simT: run.simT + r.lane });
    this.ctx.globalAlpha = 1;
    // name flag over the head
    if (r.down <= 0) {
      const p = r.w.front;
      const X = this.X(p.x - 0.3), Y = this.Y(p.y + 1.25) - r.lane * 22;
      if (X > -60 && X < this.w + 60) {
        const ctx = this.ctx; ctx.font = `${Math.round(13)}px "Zilla Slab", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(r.name).width + 12;
        ctx.fillStyle = INK.cream; ctx.fillRect(X - tw / 2, Y - 10, tw, 20); ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.5; ctx.strokeRect(X - tw / 2, Y - 10, tw, 20);
        ctx.fillStyle = INK.ink; ctx.fillText(r.name, X, Y + 1);
      }
    }
    Object.assign(this, keep);
  }

  heap(x, colour) {
    const ctx = this.ctx, s = this.s, X = this.X(x), Y = this.groundY;
    ctx.fillStyle = INK[colour] || INK.red; blob(ctx, X, Y - s * 0.22, s * 0.8, s * 0.26, Math.floor(x * 10), 11, 0.18); ctx.fill();
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.lineWidth = s * 0.12; ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) { const lx = X - s * 0.5 + k * s * 0.33; ctx.beginPath(); ctx.moveTo(lx, Y - s * 0.3); ctx.lineTo(lx + Math.sin(this.t * 5 + k) * s * 0.15, Y - s * 0.75); ctx.stroke(); }
    ctx.fillStyle = INK.ink; ctx.font = `${Math.round(s * 0.18)}px "Holtwood One SC", serif`; ctx.textAlign = 'center'; ctx.fillText('?!', X, Y - s * 0.95);
  }

  // ---------- the horse
  horse(p, o = {}) {
    const ctx = this.ctx, s = this.s;
    const body = INK[o.colour] || INK.red;
    const P = (x, y) => [this.X(x), this.Y(y)];
    const rot = (ox, oy, a) => [ox * Math.cos(a) - oy * Math.sin(a), ox * Math.sin(a) + oy * Math.cos(a)];
    const F = p.F, B = p.B;
    const fa = F.a - 0.32, ba = B.a; // the front person stoops forward under the costume
    const fp = (ox, oy) => { const r = rot(ox, oy, fa); return P(F.x + r[0], F.y + r[1]); };
    const bp = (ox, oy) => { const r = rot(ox, oy, ba); return P(B.x + r[0], B.y + r[1]); };
    const LW = Math.max(2, s * 0.028);

    // legs: far ones first (a shade darker), near ones after the body
    const legW = s * 0.15;
    const drawLeg = (L, far, half) => {
      const [hx, hy, kx, ky, fx, fy] = L;
      const h = P(hx, hy), k = P(kx, ky), f = P(fx, fy);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = INK.ink; ctx.lineWidth = legW + LW * 2;
      ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.lineTo(k[0], k[1]); ctx.lineTo(f[0], f[1]); ctx.stroke();
      ctx.strokeStyle = far ? (o.colour ? INK.ink : INK.red2) : body; ctx.lineWidth = legW;
      ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.lineTo(k[0], k[1]); ctx.lineTo(f[0] + (k[0] - f[0]) * 0.18, f[1] + (k[1] - f[1]) * 0.18); ctx.stroke();
      // a carved highlight down the shin
      if (!far) { ctx.strokeStyle = INK.paper; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(k[0] + legW * 0.22, k[1] + 4); ctx.lineTo(k[0] + (f[0] - k[0]) * 0.6 + legW * 0.22, k[1] + (f[1] - k[1]) * 0.6); ctx.stroke(); }
      // hoof boot
      const ang = Math.atan2(f[1] - k[1], f[0] - k[0]) - Math.PI / 2;
      ctx.save(); ctx.translate(f[0], f[1]); ctx.rotate(ang);
      ctx.fillStyle = INK.ink;
      ctx.beginPath(); ctx.moveTo(-legW * 0.55, -legW * 0.75); ctx.lineTo(legW * 0.55, -legW * 0.75); ctx.lineTo(legW * 0.75, legW * 0.1); ctx.lineTo(-legW * 0.65, legW * 0.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = INK.paper; ctx.beginPath(); gouge(ctx, -legW * 0.3, -legW * 0.5, legW * 0.6, 0.1, 1.2); ctx.fill();
      ctx.restore();
    };
    drawLeg(p.legs[1], true, 'front'); drawLeg(p.legs[3], true, 'back');

    const tail = () => {
      const r0 = bp(-0.14, 0.12);
      const swish = Math.sin((o.simT || 0) * 5) * 0.25 + (p.ragdoll ? 0.6 : 0);
      ctx.strokeStyle = INK.ink; ctx.lineCap = 'round';
      for (let k = 0; k < 5; k++) {
        ctx.lineWidth = s * 0.035;
        const a = ba + Math.PI + 0.9 + k * 0.1 + swish;
        const L = s * (0.5 + k * 0.04);
        ctx.beginPath(); ctx.moveTo(r0[0], r0[1]);
        ctx.quadraticCurveTo(r0[0] - s * 0.18, r0[1] + s * 0.02 + k * 3, r0[0] + Math.cos(a) * L, r0[1] - Math.sin(a) * L * 0.2 + L * 0.85);
        ctx.stroke();
      }
    };

    if (p.torn) this.tornHorse(p, o, fp, bp, body, LW, tail);
    else {
      tail();
      // the costume: one long sack from the back's rump to the front's withers
      const top = [bp(-0.22, 0.1), bp(0.02, 0.25), bp(0.45, 0.28), bp(0.82, 0.27), fp(-0.12, 0.5), fp(0.08, 0.62), fp(0.3, 0.55)];
      const sag = Math.max(0, -p.stretch) * 0.5;
      const bot = [fp(0.3, 0.22), fp(0.16, -0.04), fp(-0.16, -0.06), bp(0.8, -0.18 - sag), bp(0.38, -0.2 - sag), bp(0.02, -0.12), bp(-0.22, -0.04)];
      const outline = top.concat(bot);
      ctx.save(); ctx.translate(REG[0], REG[1]);
      ctx.fillStyle = body; ctx.beginPath(); smoothClosed(ctx, outline); ctx.fill();
      ctx.restore();
      // dapples cut out of the colour plate
      ctx.save(); ctx.beginPath(); smoothClosed(ctx, outline); ctx.clip();
      ctx.fillStyle = o.colour ? INK.cream : INK.mustard;
      const spots = [[0.12, 0.08, 0.1], [0.32, 0.02, 0.08], [0.55, 0.1, 0.11], [0.78, 0.02, 0.07], [-0.02, -0.06, 0.07]];
      for (const [u, v, r] of spots) { const c = bp(u * W.bTorso * 1.1, v); blob(ctx, c[0], c[1], r * s, r * s * 0.8, Math.round(u * 100), 8, 0.2, ba); ctx.fill(); }
      const fs = fp(0.02, 0.3); blob(ctx, fs[0], fs[1], 0.09 * s, 0.07 * s, 77, 8, 0.2, fa); ctx.fill();
      // saddle cloth
      const sc = bp(0.42, 0.12);
      ctx.fillStyle = o.colour ? INK.red : INK.blue;
      ctx.save(); ctx.translate(sc[0], sc[1]); ctx.rotate(-ba);
      ctx.fillRect(-s * 0.22, -s * 0.16, s * 0.44, s * 0.3);
      ctx.strokeStyle = INK.cream; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.strokeRect(-s * 0.19, -s * 0.13, s * 0.38, s * 0.24); ctx.setLineDash([]);
      if (!o.rival) { ctx.fillStyle = INK.cream; ctx.font = `${Math.round(s * 0.15)}px "Holtwood One SC", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('7', 0, 0); }
      ctx.restore();
      // the seam where the two people meet, stretching and popping
      const seamA = bp(0.86, 0.25), seamB = bp(0.86, -0.17);
      const st = Math.max(0, p.stretch);
      ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.6;
      const n = 6;
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n, x = seamA[0] + (seamB[0] - seamA[0]) * u, y = seamA[1] + (seamB[1] - seamA[1]) * u;
        const broke = p.tear > (k + 1) / (n + 1) && hh(k, 5) < p.tear * 1.3;
        const w = 4 + st * s * 0.12;
        if (broke) { ctx.fillStyle = INK.ink; ctx.beginPath(); ctx.ellipse(x, y, w * 0.9, 2.5 + st * 6, 0, 0, 6.29); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(x - w, y - 2); ctx.lineTo(x + w, y + 2); ctx.moveTo(x - w, y + 2); ctx.lineTo(x + w, y - 2); ctx.stroke(); }
      }
      // patches from earlier rips
      for (let k = 0; k < (p.patches || 0) && k < 4; k++) {
        const c = bp(0.62 - k * 0.22, 0.05 - (k % 2) * 0.08);
        ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(-ba + (hh(k, 9) - 0.5) * 0.6);
        ctx.fillStyle = k % 2 ? INK.green : INK.mustard; ctx.fillRect(-s * 0.09, -s * 0.07, s * 0.18, s * 0.14);
        ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.3; ctx.setLineDash([3, 2]); ctx.strokeRect(-s * 0.09, -s * 0.07, s * 0.18, s * 0.14); ctx.setLineDash([]);
        ctx.restore();
      }
      // carved fold lines
      ctx.fillStyle = INK.paper; ctx.globalAlpha = 0.8; ctx.beginPath();
      for (let k = 0; k < 4; k++) { const c = bp(0.1 + k * 0.17, -0.12); gouge(ctx, c[0], c[1], s * 0.12, -1.2 - ba, 1.3); }
      ctx.fill(); ctx.globalAlpha = 1;
      ctx.restore();
      ctx.strokeStyle = INK.ink; ctx.lineWidth = LW * 1.3; ctx.lineJoin = 'round';
      ctx.beginPath(); smoothClosed(ctx, outline); ctx.stroke();
      this.headAndNeck(p, o, fp, body, LW, fa);
    }
    drawLeg(p.legs[2], false, 'back'); drawLeg(p.legs[0], false, 'front');

    // Ready… / Hup!
    if (o.main && o.hup && !o.hup.gone && (o.simT - o.hup.t) < 0.7) {
      const at = fp(0.55, 1.35);
      this.bubble(at[0], at[1], o.hup.st === 'hup' ? 'HUP!' : 'Ready…', o.hup.st === 'hup');
    }
  }

  headAndNeck(p, o, fp, body, LW, fa) {
    const ctx = this.ctx, s = this.s;
    const wob = Math.max(p.wob[0], p.wob[1]);
    const bob = Math.sin((o.simT || 0) * 9) * 0.02;
    // the neck rises from the withers; it's a stuffed tube on a pole, so it stays fairly upright
    const nfp = (ox, oy) => { const k = Math.min(1, Math.max(0, (oy - 0.4) / 0.6)); const a = fa + 0.32 * k; const c = Math.cos(a), sn = Math.sin(a); return [this.X(p.F.x + ox * c - oy * sn), this.Y(p.F.y + ox * sn + oy * c)]; };
    fp = nfp;
    const neck = [fp(0.0, 0.55), fp(0.2, 1.02 + bob), fp(0.44, 1.1 + bob), fp(0.4, 0.82), fp(0.32, 0.48)];
    ctx.save(); ctx.translate(REG[0], REG[1]); ctx.fillStyle = body; ctx.beginPath(); smoothClosed(ctx, neck); ctx.fill(); ctx.restore();
    ctx.strokeStyle = INK.ink; ctx.lineWidth = LW * 1.2; ctx.beginPath(); smoothClosed(ctx, neck); ctx.stroke();
    // mane: black, with carved strands
    const mane = [fp(-0.04, 0.56), fp(0.14, 1.04 + bob), fp(0.36, 1.17 + bob), fp(0.32, 1.06 + bob), fp(0.12, 0.88), fp(0.03, 0.6)];
    ctx.fillStyle = INK.ink; ctx.beginPath(); smoothClosed(ctx, mane); ctx.fill();
    ctx.fillStyle = INK.paper; ctx.beginPath();
    for (let k = 0; k < 5; k++) { const c = fp(0.0 + k * 0.07, 0.68 + k * 0.08 + bob); gouge(ctx, c[0], c[1], s * 0.1, -2.2 - fa, 1.1); }
    ctx.fill();
    // the head: long, a bit lopsided, held up on a pole by the front end
    const hc = fp(0.58, 1.08 + bob);
    const ha = -fa + 0.62 + Math.sin((o.simT || 0) * 4.3) * 0.05 + (p.ragdoll ? 0.4 : 0);
    ctx.save(); ctx.translate(hc[0], hc[1]); ctx.rotate(ha);
    const hw = s * 0.36, hhh = s * 0.17;
    // ears
    ctx.fillStyle = body; ctx.strokeStyle = INK.ink; ctx.lineWidth = LW;
    for (const ex of [-0.2, -0.05]) { ctx.beginPath(); ctx.moveTo(ex * s - s * 0.06, -hhh * 0.7); ctx.lineTo(ex * s - s * 0.02, -hhh * 1.9); ctx.lineTo(ex * s + s * 0.07, -hhh * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.save(); ctx.translate(REG[0], REG[1]);
    ctx.fillStyle = body; blob(ctx, 0, 0, hw, hhh, 4, 11, 0.05); ctx.fill();
    ctx.restore();
    // muzzle
    ctx.fillStyle = INK.cream; blob(ctx, hw * 0.62, hhh * 0.2, hw * 0.42, hhh * 0.78, 6, 9, 0.06); ctx.fill();
    ctx.strokeStyle = INK.ink; ctx.lineWidth = LW * 1.2; blob(ctx, 0, 0, hw, hhh, 4, 11, 0.05); ctx.stroke();
    ctx.lineWidth = LW * 0.8; blob(ctx, hw * 0.62, hhh * 0.2, hw * 0.42, hhh * 0.78, 6, 9, 0.06); ctx.stroke();
    // nostrils, and buck teeth
    ctx.fillStyle = INK.ink;
    ctx.beginPath(); ctx.ellipse(hw * 0.86, -hhh * 0.12, s * 0.025, s * 0.04, 0.4, 0, 6.29); ctx.fill();
    const gape = Math.min(1, wob * 1.4) * s * 0.06;
    ctx.fillStyle = INK.ink; ctx.beginPath(); ctx.ellipse(hw * 0.72, hhh * 0.72, s * 0.11, s * 0.02 + gape, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = INK.cream; ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.4;
    ctx.fillRect(hw * 0.62, hhh * 0.62, s * 0.05, s * 0.07); ctx.strokeRect(hw * 0.62, hhh * 0.62, s * 0.05, s * 0.07);
    ctx.fillRect(hw * 0.73, hhh * 0.62, s * 0.05, s * 0.07); ctx.strokeRect(hw * 0.73, hhh * 0.62, s * 0.05, s * 0.07);
    // the big googly eye
    const ex = -hw * 0.1, ey = -hhh * 0.25, er = s * 0.085;
    ctx.fillStyle = INK.cream; ctx.beginPath(); ctx.arc(ex, ey, er, 0, 6.29); ctx.fill(); ctx.lineWidth = LW; ctx.stroke();
    const look = (o.simT || 0) * (wob > 0.35 ? 14 : 1.2);
    const pr = wob > 0.35 ? er * 0.3 : er * 0.48;
    ctx.fillStyle = INK.ink; ctx.beginPath(); ctx.arc(ex + Math.cos(look) * er * 0.35, ey + Math.sin(look) * er * 0.3 + er * 0.1, pr, 0, 6.29); ctx.fill();
    // lashes
    ctx.lineWidth = 1.6; ctx.beginPath();
    for (let k = 0; k < 3; k++) { const a = -2.3 + k * 0.45; ctx.moveTo(ex + Math.cos(a) * er, ey + Math.sin(a) * er); ctx.lineTo(ex + Math.cos(a) * er * 1.45, ey + Math.sin(a) * er * 1.45); }
    ctx.stroke();
    // forelock
    ctx.fillStyle = INK.ink; ctx.beginPath(); ctx.moveTo(-hw * 0.5, -hhh * 0.95); ctx.quadraticCurveTo(-hw * 0.1, -hhh * 1.5, hw * 0.12, -hhh * 0.6); ctx.quadraticCurveTo(-hw * 0.2, -hhh * 0.75, -hw * 0.5, -hhh * 0.95); ctx.fill();
    // a rosette on the bridle
    if (!o.rival) { ctx.fillStyle = INK.mustard; ctx.beginPath(); ctx.arc(-hw * 0.55, hhh * 0.1, s * 0.05, 0, 6.29); ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke(); }
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-hw * 0.55, hhh * 0.1); ctx.lineTo(hw * 0.45, hhh * 0.35); ctx.stroke();
    ctx.restore();
  }

  // the seam has gone: two halves, and the people inside
  tornHorse(p, o, fp, bp, body, LW, tail) {
    const ctx = this.ctx, s = this.s;
    tail();
    const backHalf = [bp(-0.2, 0.1), bp(0.1, 0.22), bp(0.5, 0.24), bp(0.62, 0.12), bp(0.7, 0.2), bp(0.66, -0.02), bp(0.7, -0.16), bp(0.35, -0.2), bp(0.02, -0.12), bp(-0.2, -0.04)];
    const frontHalf = [fp(-0.14, 0.55), fp(-0.26, 0.4), fp(-0.17, 0.3), fp(-0.27, 0.16), fp(-0.18, -0.04), fp(0.1, -0.06), fp(0.2, 0.1), fp(0.08, 0.66)];
    // the back person's head poking out, cap and all
    const hd = bp(0.82, 0.05);
    ctx.fillStyle = INK.cream; ctx.beginPath(); ctx.arc(hd[0], hd[1], s * 0.13, 0, 6.29); ctx.fill(); ctx.strokeStyle = INK.ink; ctx.lineWidth = LW; ctx.stroke();
    ctx.fillStyle = INK.green; ctx.beginPath(); ctx.ellipse(hd[0] - s * 0.02, hd[1] - s * 0.09, s * 0.14, s * 0.07, -p.B.a, Math.PI, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK.ink; ctx.beginPath(); ctx.arc(hd[0] + s * 0.06, hd[1] - s * 0.01, 2.4, 0, 6.29); ctx.arc(hd[0] + s * 0.02, hd[1] - s * 0.01, 2.4, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(hd[0] + s * 0.05, hd[1] + s * 0.06, s * 0.03, 0, 6.29); ctx.fill();
    // front person's stripy jumper where the costume parted
    const jm = fp(-0.2, 0.2);
    ctx.save(); ctx.translate(jm[0], jm[1]); ctx.rotate(-p.F.a);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? INK.cream : INK.mustard; ctx.fillRect(-s * 0.12, -s * 0.2 + k * s * 0.1, s * 0.12, s * 0.1); }
    ctx.restore();
    for (const shape of [backHalf, frontHalf]) {
      ctx.save(); ctx.translate(REG[0], REG[1]); ctx.fillStyle = body; ctx.beginPath(); smoothClosed(ctx, shape); ctx.fill(); ctx.restore();
      ctx.strokeStyle = INK.ink; ctx.lineWidth = LW * 1.3; ctx.beginPath(); smoothClosed(ctx, shape); ctx.stroke();
    }
    // frayed threads at the torn edges
    ctx.lineWidth = 1.3; ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = bp(0.66, 0.2 - k * 0.07), b2 = fp(-0.22, 0.5 - k * 0.09); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + 7, a[1] + (k % 2 ? 4 : -3)); ctx.moveTo(b2[0], b2[1]); ctx.lineTo(b2[0] - 7, b2[1] + (k % 2 ? -4 : 3)); }
    ctx.stroke();
    this.headAndNeck(p, o, fp, body, LW, p.F.a);
  }

  bubble(x, y, text, loud) {
    const ctx = this.ctx;
    ctx.font = `${loud ? 26 : 19}px "Holtwood One SC", serif`;
    const tw = ctx.measureText(text).width, pw = tw + 26, ph = loud ? 44 : 36;
    x = Math.max(pw / 2 + 8, Math.min(this.w - pw / 2 - 8, x));
    y = Math.max(ph + 64, y);
    ctx.fillStyle = loud ? INK.red : INK.cream; ctx.strokeStyle = INK.ink; ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (loud) { // a jagged shout
      const n = 14;
      for (let k = 0; k < n; k++) { const a = (k / n) * 6.283, r = k % 2 ? 1 : 1.18; const px = x + Math.cos(a) * pw * 0.56 * r, py = y - ph / 2 + Math.sin(a) * ph * 0.62 * r; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath();
    } else { ctx.ellipse(x, y - ph / 2, pw / 2, ph / 2, 0, 0, 6.29); }
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 8, y - 3); ctx.lineTo(x - 18, y + 14); ctx.lineTo(x + 4, y - 2); ctx.fillStyle = loud ? INK.red : INK.cream; ctx.fill(); ctx.stroke();
    ctx.fillStyle = loud ? INK.cream : INK.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - ph / 2 + 2);
  }

  replayFrame() {
    const ctx = this.ctx, w = this.w, h = this.h;
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = INK.ink;
    const bar = Math.max(26, h * 0.06);
    ctx.fillRect(0, 0, w, bar * 0.5); ctx.fillRect(0, h - bar * 0.5, w, bar * 0.5);
  }
}
