// Draws the scene like a 1970s paperback cover: inky night, saturated little worlds, film grain on top.
import { CELL, TROOP_R, WEAPONS, simulate } from './world.js';
import { TEAMS } from './game.js';

const INK = '#1a0f2e', CREAM = '#f7ead0';
const SUN = { x: -0.55, y: -0.83 };
const L3 = (() => { const v = [-0.5, -0.62, 0.6], m = Math.hypot(...v); return { x: v[0] / m, y: v[1] / m, z: v[2] / m }; })();
const hash = (i, j) => { let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const mix = (a, b, t) => a + (b - a) * t;
const vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

export class View {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.parts = []; this.floaters = []; this.trails = new WeakMap();
    this.shake = 0; this.time = 0;
    this.grain = makeGrain();
    this.inset = { top: 60, bottom: 96, left: 8, right: 8 };
  }

  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.bg = makeBackdrop(w, h, dpr);
    if (this.game) this.fit();
  }

  setGame(game) {
    this.game = game; this.parts = []; this.floaters = []; this.trails = new WeakMap();
    const w = game.world;
    this.tc = document.createElement('canvas'); this.tc.width = w.gw; this.tc.height = w.gh;
    this.tctx = this.tc.getContext('2d');
    this.img = this.tctx.createImageData(w.gw, w.gh);
    this.paint(0, 0, w.gw - 1, w.gh - 1);
    w.dirty = null;
    this.fit();
  }

  fit() {
    const w = this.game.world, I = this.inset;
    const aw = this.w - I.left - I.right, ah = this.h - I.top - I.bottom;
    this.s = Math.min(aw / w.W, ah / w.H);
    this.ox = I.left + (aw - w.W * this.s) / 2; this.oy = I.top + (ah - w.H * this.s) / 2;
  }
  X(x) { return this.ox + x * this.s; }
  Y(y) { return this.oy + y * this.s; }
  toWorld(sx, sy) { return { x: (sx - this.ox) / this.s, y: (sy - this.oy) / this.s }; }

  // ---- terrain pixels ----------------------------------------------------------------------------------
  paint(i0, j0, i1, j1) {
    const w = this.game.world, gw = w.gw, gh = w.gh, cells = w.cells, data = this.img.data;
    i0 = Math.max(0, i0); j0 = Math.max(0, j0); i1 = Math.min(gw - 1, i1); j1 = Math.min(gh - 1, j1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * gw + i, c = cells[k], o = k * 4;
      if (!c) { data[o + 3] = 0; continue; }
      const p = w.planets[c - 1], pal = p.pal;
      const dx = (i + 0.5) * CELL - p.x, dy = (j + 0.5) * CELL - p.y, q = Math.min(1, Math.hypot(dx, dy) / p.r);
      const nz = Math.sqrt(1 - q * q), lam = (dx / p.r) * L3.x + (dy / p.r) * L3.y + nz * L3.z;
      const n = hash(i + p.seed, j);
      // a lit sphere: shadow, body colour, a hot highlight
      const sh = clamp01((lam + 0.15) / 0.75);
      let r = mix(pal.dark[0], pal.base[0], sh), g = mix(pal.dark[1], pal.base[1], sh), b = mix(pal.dark[2], pal.base[2], sh);
      if (lam > 0.62) { const t = Math.min(0.85, (lam - 0.62) * 2.6); r = mix(r, pal.light[0], t); g = mix(g, pal.light[1], t); b = mix(b, pal.light[2], t); }
      // blotchy seas
      const m = vnoise(i / 9 + p.seed % 97, j / 9) * 0.65 + vnoise(i / 3.5, j / 3.5 + p.seed % 31) * 0.35;
      if (m > 0.56) { const t = Math.min(1, (m - 0.56) * 5) * 0.22; r *= 1 - t; g *= 1 - t; b *= 1 - t * 0.6; }
      // halftone dots in the shadow, like a cheap cover print
      if (lam < 0.3) {
        const dark = Math.min(1, (0.3 - lam) / 0.9), gi = i % 4 - 1.5 + ((j >> 2) % 2) * 2, gj = j % 4 - 1.5;
        const gd = Math.hypot(gi > 2 ? gi - 4 : gi, gj);
        if (gd < dark * 2.3) { r = mix(r, 26, 0.55); g = mix(g, 15, 0.55); b = mix(b, 46, 0.55); }
      }
      const sp = (n - 0.5) * 16;
      r += sp; g += sp; b += sp;
      // rims: bright on the sunny side, inked on the shadow side
      const edge = i === 0 || j === 0 || i === gw - 1 || j === gh - 1 || !cells[k - 1] || !cells[k + 1] || !cells[k - gw] || !cells[k + gw];
      if (edge) {
        const nx = (cells[k - 1] ? 0 : -1) + (cells[k + 1] ? 0 : 1), ny = (cells[k - gw] ? 0 : -1) + (cells[k + gw] ? 0 : 1);
        const el = (nx * SUN.x + ny * SUN.y);
        if (el > 0.2) { r = mix(r, pal.light[0], 0.75); g = mix(g, pal.light[1], 0.75); b = mix(b, pal.light[2], 0.75); }
        else { r *= 0.55; g *= 0.5; b *= 0.6; }
      }
      const sc = w.scorch[k];
      if (sc) { const t = sc / 255 * 0.85; r = mix(r, 44, t); g = mix(g, 22, t); b = mix(b, 50, t); }
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
    this.tctx.putImageData(this.img, 0, 0, i0, j0, i1 - i0 + 1, j1 - j0 + 1);
  }

  // ---- effects ----------------------------------------------------------------------------------------
  boom(x, y, R, planet) {
    const pal = planet?.pal;
    this.parts.push({ k: 'flash', x, y, R, t: 0, life: 0.32 });
    this.parts.push({ k: 'ring', x, y, R, t: 0, life: 0.5 });
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.283, v = 60 + Math.random() * 220;
      const col = pal ? (Math.random() < 0.5 ? pal.base : pal.light) : [255, 200, 120];
      this.parts.push({ k: 'chunk', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.9 + Math.random() * 0.9, col: `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`, sz: 1.5 + Math.random() * 2.5 });
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * 6.283, v = 10 + Math.random() * 40;
      this.parts.push({ k: 'smoke', x: x + Math.cos(a) * R * 0.4, y: y + Math.sin(a) * R * 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 1.1 + Math.random() * 0.8, sz: R * (0.35 + Math.random() * 0.3) });
    }
    this.shake = Math.min(14, this.shake + R * 0.3);
  }
  puff(x, y, col = '#f7ead0', n = 8, v = 40) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = v * (0.3 + Math.random()); this.parts.push({ k: 'dust', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 0.5 + Math.random() * 0.4, col, sz: 1.5 + Math.random() * 1.5 }); }
  }
  float(x, y, text, color) { this.floaters.push({ x, y, text, color, t: 0 }); }

  // ---- the frame ------------------------------------------------------------------------------------------
  frame(dt, ui) {
    const g = this.game, w = g.world, c = this.ctx, s = this.s;
    this.time += dt;
    if (w.dirty) { const d = w.dirty; w.dirty = null; this.paint(d[0], d[1], d[2], d[3]); }
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.drawImage(this.bg, 0, 0, this.w, this.h);
    this.shake *= Math.pow(0.002, dt);
    const shx = (Math.random() - 0.5) * this.shake, shy = (Math.random() - 0.5) * this.shake;
    c.save();
    c.translate(shx, shy);

    // atmospheres
    for (const p of w.planets) {
      if (p.mass <= 0) continue;
      const k = Math.sqrt(Math.max(0, p.mass / p.mass0));
      const gr = c.createRadialGradient(this.X(p.x), this.Y(p.y), p.r * s * 0.85, this.X(p.x), this.Y(p.y), p.r * s * (1 + 0.32 * k));
      gr.addColorStop(0, `rgba(${p.pal.light.join(',')},${0.28 * k})`); gr.addColorStop(1, `rgba(${p.pal.light.join(',')},0)`);
      c.fillStyle = gr; c.beginPath(); c.arc(this.X(p.x), this.Y(p.y), p.r * s * 1.4, 0, 7); c.fill();
    }
    // gravity mines: rings falling inward
    for (const wl of w.wells) this.drawWell(c, wl);
    // the rock
    c.imageSmoothingEnabled = true;
    c.drawImage(this.tc, this.X(0), this.Y(0), w.gw * CELL * s, w.gh * CELL * s);

    // graves
    for (const gv of g.graves) this.drawGrave(c, gv, dt);
    // aim preview under the troops
    if (ui.aim) this.drawAim(c, ui.aim);
    // troops
    for (const t of g.troops) if (!t.dead && !t.flying) this.drawTroop(c, t, t === g.cur && g.phase !== 'over', ui);
    // projectiles
    for (const p of g.proj) this.drawProj(c, p, dt);
    // particles
    this.drawParts(c, dt);
    // tutorial markers
    if (ui.marks) for (const m of ui.marks) this.drawMark(c, m);
    // labels
    for (const t of g.troops) if (!t.dead && !t.flying) this.drawLabel(c, t, t === g.cur && g.phase !== 'over');
    this.drawFloaters(c, dt);
    c.restore();

    // grain and vignette over everything
    c.save();
    c.globalAlpha = 0.11; c.globalCompositeOperation = 'overlay';
    const ox = (Math.random() * 256) | 0, oy = (Math.random() * 256) | 0;
    c.translate(-ox, -oy); c.fillStyle = this.grainPat || (this.grainPat = c.createPattern(this.grain, 'repeat'));
    c.fillRect(0, 0, this.w + 256, this.h + 256);
    c.restore();
  }

  drawWell(c, wl) {
    const x = this.X(wl.x), y = this.Y(wl.y), s = this.s, R = 58 * s;
    c.save();
    for (let i = 0; i < 4; i++) {
      const f = 1 - ((this.time * 0.6 + i / 4) % 1);
      c.strokeStyle = `rgba(255,120,220,${0.55 * (1 - f) + 0.08})`; c.lineWidth = 1.5;
      c.setLineDash([3, 5]); c.lineDashOffset = this.time * 8;
      c.beginPath(); c.arc(x, y, 6 * s + f * R, 0, 7); c.stroke();
    }
    c.setLineDash([]);
    const gr = c.createRadialGradient(x, y, 0, x, y, 12 * s);
    gr.addColorStop(0, '#fff2fb'); gr.addColorStop(0.4, '#ff5fc8'); gr.addColorStop(1, 'rgba(120,20,140,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(x, y, 12 * s, 0, 7); c.fill();
    c.fillStyle = INK; c.beginPath(); c.arc(x, y, 4 * s, 0, 7); c.fill();
    c.strokeStyle = '#ff9be0'; c.lineWidth = 1.2; c.stroke();
    // turns left as pips
    for (let i = 0; i < wl.turns; i++) { c.fillStyle = '#ffd6f2'; c.beginPath(); c.arc(x + (i - (wl.turns - 1) / 2) * 6, y + 13 * s + 4, 2, 0, 7); c.fill(); }
    c.restore();
  }

  drawAim(c, a) {
    const s = this.s, t = a.troop, x = this.X(t.x), y = this.Y(t.y);
    c.save();
    // preview dots: only the first stretch of the flight
    if (a.path && a.path.length > 2) {
      c.fillStyle = CREAM;
      for (let i = 0; i < a.path.length; i += 2) {
        const k = i / a.path.length;
        if ((i / 2) % 5) continue;
        c.globalAlpha = 0.9 * (1 - k);
        c.beginPath(); c.arc(this.X(a.path[i]), this.Y(a.path[i + 1]), 2.1 * (1 - k * 0.5), 0, 7); c.fill();
      }
      c.globalAlpha = 1;
    }
    // power: a fat arrow from the trooper
    const L = (16 + 46 * a.pow) * Math.max(0.9, s), ca = Math.cos(a.ang), sa = Math.sin(a.ang);
    const col = a.kind === 'jet' ? '#9ef0ff' : '#ffd23f';
    c.translate(x, y); c.rotate(a.ang);
    c.fillStyle = 'rgba(26,15,46,.55)';
    c.beginPath(); c.moveTo(11, -4); c.lineTo(L, -4); c.lineTo(L, -8); c.lineTo(L + 11, 0); c.lineTo(L, 8); c.lineTo(L, 4); c.lineTo(11, 4); c.closePath();
    c.fill();
    const grd = c.createLinearGradient(11, 0, L + 11, 0); grd.addColorStop(0, col); grd.addColorStop(1, a.pow > 0.85 ? '#ff4d3d' : '#ff8a2a');
    c.fillStyle = grd; c.strokeStyle = INK; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(11, -2.6); c.lineTo(L, -2.6); c.lineTo(L, -6.5); c.lineTo(L + 9, 0); c.lineTo(L, 6.5); c.lineTo(L, 2.6); c.lineTo(11, 2.6); c.closePath();
    c.fill(); c.stroke();
    c.restore();
    // power readout
    c.save();
    c.font = '700 13px "Saira Extra Condensed", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const tx = x + ca * (L + 26), ty = y + sa * (L + 26);
    c.lineWidth = 3; c.strokeStyle = INK; c.strokeText(Math.round(a.pow * 100) + '%', tx, ty);
    c.fillStyle = CREAM; c.fillText(Math.round(a.pow * 100) + '%', tx, ty);
    c.restore();
  }

  drawTroop(c, t, active, ui) {
    const w = this.game.world, u = w.up(t.x, t.y), s = this.s;
    const team = TEAMS[t.team] || { color: '#c9b48a', dark: '#6b5530' };
    c.save();
    c.translate(this.X(t.x), this.Y(t.y));
    c.rotate(Math.atan2(u.y, u.x) + Math.PI / 2);
    c.scale(s * 1.18, s * 1.18);
    if (t.team === 2) { this.drawDummy(c); c.restore(); return; }
    const f = t.facing || 1, bob = active && !t.air ? Math.sin(this.time * 5) * 0.5 : 0;
    c.lineWidth = 1.3 / Math.max(0.6, s) + 0.3; c.strokeStyle = INK; c.lineJoin = 'round';
    // legs
    const step = active && ui.walking ? Math.sin(this.time * 14) * 2 : 0;
    c.fillStyle = '#d9c9a8';
    c.beginPath(); c.roundRect(-4.2 + step * 0.3, 2, 3.4, 5, 1.2); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(0.8 - step * 0.3, 2, 3.4, 5, 1.2); c.fill(); c.stroke();
    // backpack
    c.fillStyle = team.dark;
    c.beginPath(); c.roundRect(-f * 7.2 - (f < 0 ? -0 : 0) - 2, -4 + bob, 4.2, 7.5, 1.2); c.fill(); c.stroke();
    // body
    c.fillStyle = CREAM;
    c.beginPath(); c.roundRect(-5, -3 + bob, 10, 8, 3); c.fill(); c.stroke();
    c.fillStyle = team.color; c.fillRect(-5 + 0.6, 1.2 + bob, 8.8, 1.8);
    // helmet
    c.fillStyle = CREAM;
    c.beginPath(); c.arc(0, -7 + bob, 5.6, 0, 7); c.fill(); c.stroke();
    c.fillStyle = team.color;
    c.beginPath(); c.ellipse(f * 1.6, -7.2 + bob, 3.5, 3, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(f * 2.6, -8.4 + bob, 1.1, 0.8, -0.5, 0, 7); c.fill();
    // antenna
    c.beginPath(); c.moveTo(-f * 2.5, -12 + bob); c.lineTo(-f * 4.2, -16.5 + bob); c.stroke();
    c.fillStyle = team.color; c.beginPath(); c.arc(-f * 4.2, -16.5 + bob, 1.6, 0, 7); c.fill(); c.stroke();
    c.restore();
  }

  drawDummy(c) {
    // a cardboard cutout of a bug-eyed alien on a stick
    c.lineWidth = 1.3; c.strokeStyle = INK;
    c.fillStyle = '#a07a4a'; c.fillRect(-0.8, -2, 1.6, 9);
    c.fillStyle = '#c9a46a';
    c.beginPath(); c.ellipse(0, -8, 6.5, 7, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#7ad36a'; c.beginPath(); c.ellipse(0, -8, 5, 5.5, 0, 0, 7); c.fill();
    c.fillStyle = CREAM; c.beginPath(); c.arc(-2, -9, 1.8, 0, 7); c.arc(2, -9, 1.8, 0, 7); c.fill();
    c.fillStyle = INK; c.beginPath(); c.arc(-2, -9, 0.8, 0, 7); c.arc(2, -9, 0.8, 0, 7); c.fill();
    c.strokeStyle = '#c0392b'; c.lineWidth = 1; c.beginPath(); c.arc(0, -8, 9.5, 0, 7); c.stroke();
  }

  drawGrave(c, gv, dt) {
    if (gv.air) {
      // let a grave knocked into the air fall back down
      const w = this.game.world, g = w.gravity(gv.x, gv.y, false);
      gv.vx += g.x * dt; gv.vy += g.y * dt;
      const nx = gv.x + gv.vx * dt, ny = gv.y + gv.vy * dt;
      if (w.solidAt(nx, ny + 0) || w.solidAt(nx - Math.cos(gv.ang) * 3, ny - Math.sin(gv.ang) * 3)) { gv.air = false; const u = w.up(gv.x, gv.y); gv.ang = Math.atan2(u.y, u.x); }
      else { gv.x = nx; gv.y = ny; }
      if (Math.abs(gv.x) > 5000 || Math.abs(gv.y) > 5000) gv.air = false;
    }
    const s = this.s, team = TEAMS[gv.team] || { color: '#ccc' };
    c.save(); c.translate(this.X(gv.x), this.Y(gv.y)); c.rotate(gv.ang + Math.PI / 2); c.scale(s, s);
    c.strokeStyle = INK; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(0, 6); c.lineTo(0, -12); c.stroke();
    c.fillStyle = team.color; c.beginPath(); c.moveTo(0, -12); c.lineTo(8, -9.5); c.lineTo(0, -7); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#b9ab8e'; c.beginPath(); c.ellipse(0, 5.5, 4, 1.8, 0, 0, 7); c.fill(); c.stroke();
    c.restore();
  }

  drawProj(c, p, dt) {
    const s = this.s, x = this.X(p.x), y = this.Y(p.y);
    let tr = this.trails.get(p);
    if (!tr) { tr = []; this.trails.set(p, tr); }
    if (!p.rest) { tr.push(p.x, p.y); if (tr.length > (p.stray ? 120 : 70)) tr.splice(0, 2); }
    // trail
    c.save();
    c.lineCap = 'round';
    for (let i = 2; i < tr.length; i += 2) {
      const k = i / tr.length;
      c.strokeStyle = p.stray ? `rgba(255,90,90,${k * 0.5})` : p.kind === 'jet' ? `rgba(158,240,255,${k * 0.6})` : `rgba(255,${150 + k * 80 | 0},90,${k * 0.7})`;
      c.lineWidth = (p.kind === 'jet' ? 4 : 2.5) * k;
      c.beginPath(); c.moveTo(this.X(tr[i - 2]), this.Y(tr[i - 1])); c.lineTo(this.X(tr[i]), this.Y(tr[i + 1])); c.stroke();
    }
    c.restore();
    if (p.kind === 'jet') {
      if (Math.random() < 0.8) this.parts.push({ k: 'dust', x: p.x - p.vx * 0.02, y: p.y - p.vy * 0.02, vx: -p.vx * 0.2 + (Math.random() - 0.5) * 30, vy: -p.vy * 0.2 + (Math.random() - 0.5) * 30, t: 0, life: 0.35, col: Math.random() < 0.5 ? '#ffd23f' : '#ff7b2e', sz: 2 });
      const t = p.troop, ox = t.x, oy = t.y; t.x = p.x; t.y = p.y; t.facing = p.vx >= 0 ? 1 : -1;
      this.drawTroop(c, t, false, {}); t.x = ox; t.y = oy;
      return;
    }
    c.save(); c.translate(x, y);
    const ang = p.drilling ? Math.atan2(p.dy, p.dx) : Math.atan2(p.vy, p.vx);
    const k = Math.max(0.8, s);
    if (p.stray) {
      const pr = 7 + Math.sin(this.time * 8) * 2;
      c.strokeStyle = '#ff5a5a'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, pr * k, 0, 7); c.stroke();
      c.font = '700 11px "Saira Extra Condensed", sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffb0a8';
      c.fillText('IN ORBIT · ' + p.strayTurns, 0, -12 * k);
    }
    c.rotate(ang); c.scale(k, k);
    c.strokeStyle = INK; c.lineWidth = 1.2;
    if (p.kind === 'shell') {
      c.fillStyle = '#3b2b4f'; c.beginPath(); c.roundRect(-5, -2.4, 9, 4.8, 2.4); c.fill(); c.stroke();
      c.fillStyle = '#ffd23f'; c.fillRect(-5, -2.4, 2, 4.8);
    } else if (p.kind === 'grenade') {
      c.fillStyle = '#5d8a3a'; c.beginPath(); c.arc(0, 0, 3.6, 0, 7); c.fill(); c.stroke();
      if ((p.t * 4 % 1) < 0.5 || p.fuse - p.t < 1 && (p.t * 10 % 1) < 0.5) { c.fillStyle = '#ff3b3b'; c.beginPath(); c.arc(0, 0, 1.4, 0, 7); c.fill(); }
      c.rotate(-ang);
      c.font = '700 11px "Saira Extra Condensed", sans-serif'; c.textAlign = 'center'; c.fillStyle = CREAM;
      c.fillText(Math.max(0, Math.ceil(p.fuse - p.t)), 0, -7);
    } else if (p.kind === 'drill') {
      c.fillStyle = '#b8c2d6'; c.beginPath(); c.moveTo(6, 0); c.lineTo(-3, -3.2); c.lineTo(-3, 3.2); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ff7b2e'; c.fillRect(-6, -2.2, 3, 4.4);
      if (p.drilling) for (let i = 0; i < 2; i++) this.parts.push({ k: 'dust', x: p.x, y: p.y, vx: (Math.random() - 0.5) * 80 - p.dx * 30, vy: (Math.random() - 0.5) * 80 - p.dy * 30, t: 0, life: 0.4, col: '#e8d2a6', sz: 1.6 });
    } else if (p.kind === 'mine') {
      c.fillStyle = '#ff5fc8'; c.beginPath(); c.arc(0, 0, 4, 0, 7); c.fill(); c.stroke();
      c.fillStyle = INK; c.beginPath(); c.arc(0, 0, 1.6, 0, 7); c.fill();
    }
    c.restore();
  }

  drawMark(c, m) {
    const x = this.X(m.x), y = this.Y(m.y), b = Math.sin(this.time * 4) * 3;
    c.save();
    if (m.kind === 'flag') {
      const u = this.game.world.up(m.x, m.y);
      c.translate(x, y); c.rotate(Math.atan2(u.y, u.x) + Math.PI / 2); c.scale(this.s * 1.4, this.s * 1.4);
      c.strokeStyle = '#ffd23f'; c.lineWidth = 1.2; c.setLineDash([3, 3]); c.lineDashOffset = -this.time * 12;
      c.beginPath(); c.arc(0, -4, 13 + b * 0.4, 0, 7); c.stroke(); c.setLineDash([]);
      c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -20); c.stroke();
      c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(0, -20); c.lineTo(11, -16.5 + b * 0.3); c.lineTo(0, -13); c.closePath(); c.fill(); c.stroke();
    } else if (m.kind === 'ring') {
      c.strokeStyle = '#ffd23f'; c.lineWidth = 2; c.setLineDash([5, 5]); c.lineDashOffset = -this.time * 20;
      c.beginPath(); c.arc(x, y, m.r * this.s + b, 0, 7); c.stroke();
    }
    c.restore();
  }

  drawLabel(c, t, active) {
    if (t.team === 2) return;
    const u = this.game.world.up(t.x, t.y), team = TEAMS[t.team];
    const at = k => [this.X(t.x + u.x * k), this.Y(t.y + u.y * k)];
    c.save();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    const [lx, ly] = at(23);
    c.font = '800 13px "Saira Extra Condensed", sans-serif';
    c.lineWidth = 3; c.strokeStyle = INK; c.strokeText(t.hp, lx, ly);
    c.fillStyle = team.color; c.fillText(t.hp, lx, ly);
    if (active) {
      // a bobbing pointer that always points at the trooper, and their name past it
      const b = Math.abs(Math.sin(this.time * 4)) * 4;
      const [ax, ay] = at(36 + b);
      c.save(); c.translate(ax, ay); c.rotate(Math.atan2(-u.y, -u.x) - Math.PI / 2);
      c.fillStyle = '#ffd23f'; c.strokeStyle = INK; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-7, -5); c.lineTo(7, -5); c.lineTo(0, 5); c.closePath(); c.fill(); c.stroke();
      c.restore();
      c.font = '800 14px "Saira Extra Condensed", sans-serif';
      const wtx = c.measureText(t.name).width;
      const extra = 12 + Math.abs(u.x) * (wtx / 2) / this.s;
      let [nx, ny] = at(44 + b + extra);
      nx = Math.max(wtx / 2 + 6, Math.min(this.w - wtx / 2 - 6, nx));
      c.lineWidth = 3.5; c.strokeStyle = INK; c.strokeText(t.name, nx, ny);
      c.fillStyle = team.color; c.fillText(t.name, nx, ny);
    }
    c.restore();
  }

  drawParts(c, dt) {
    const w = this.game.world, s = this.s;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
      const k = p.t / p.life, x = this.X(p.x), y = this.Y(p.y);
      if (p.k === 'flash') {
        c.fillStyle = `rgba(255,${240 - k * 120 | 0},${180 - k * 160 | 0},${1 - k})`;
        c.beginPath(); c.arc(x, y, p.R * s * (0.6 + k * 0.7), 0, 7); c.fill();
      } else if (p.k === 'ring') {
        c.strokeStyle = `rgba(247,234,208,${(1 - k) * 0.9})`; c.lineWidth = 3 * (1 - k) + 0.5;
        c.beginPath(); c.arc(x, y, p.R * s * (0.8 + k * 1.1), 0, 7); c.stroke();
      } else if (p.k === 'smoke') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97;
        c.fillStyle = `rgba(70,40,90,${0.45 * (1 - k)})`;
        c.beginPath(); c.arc(x, y, p.sz * s * (1 + k), 0, 7); c.fill();
      } else {
        if (p.k === 'chunk') { const g = w.gravity(p.x, p.y, false); p.vx += g.x * dt; p.vy += g.y * dt; if (w.solidAt(p.x, p.y)) { p.vx *= -0.3; p.vy *= -0.3; } }
        p.x += p.vx * dt; p.y += p.vy * dt;
        c.fillStyle = p.col; c.globalAlpha = 1 - k * k;
        c.fillRect(x - p.sz / 2, y - p.sz / 2, p.sz, p.sz);
        c.globalAlpha = 1;
      }
    }
  }

  drawFloaters(c, dt) {
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      if (f.t > 1.6) { this.floaters.splice(i, 1); continue; }
      const k = f.t / 1.6, x = this.X(f.x), y = this.Y(f.y) - 26 - k * 34;
      const sz = f.t < 0.15 ? 14 + f.t / 0.15 * 10 : 24;
      c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      c.font = `${sz}px "Rammetto One", sans-serif`;
      c.lineWidth = 5; c.strokeStyle = INK; c.lineJoin = 'round'; c.strokeText(f.text, x, y);
      c.fillStyle = f.color; c.fillText(f.text, x, y);
    }
    c.restore();
  }
}

// ---- backdrop: inky sky, nebula, a huge ringed planet, stars --------------------------------------------
function makeBackdrop(w, h, dpr) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const c = cv.getContext('2d');
  c.scale(dpr, dpr);
  const g = c.createLinearGradient(0, 0, w * 0.3, h);
  g.addColorStop(0, '#0b0a2a'); g.addColorStop(0.55, '#1e0f45'); g.addColorStop(1, '#4a1352');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  let seed = 7;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // nebulae
  for (const [x, y, rad, col] of [[w * 0.82, h * 0.78, Math.max(w, h) * 0.5, '255,96,120'], [w * 0.12, h * 0.25, Math.max(w, h) * 0.38, '80,190,255'], [w * 0.55, h * 0.1, Math.max(w, h) * 0.3, '255,170,60']]) {
    const n = c.createRadialGradient(x, y, 0, x, y, rad);
    n.addColorStop(0, `rgba(${col},.22)`); n.addColorStop(0.5, `rgba(${col},.07)`); n.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = n; c.fillRect(0, 0, w, h);
  }
  // the gas giant, low and enormous, shaded with halftone dots
  const R = Math.max(w, h) * 0.42, gx = w * 0.95, gy = h * 1.08;
  c.save();
  c.beginPath(); c.arc(gx, gy, R, 0, 7); c.clip();
  const gg = c.createLinearGradient(gx - R, gy - R, gx + R * 0.3, gy + R * 0.3);
  gg.addColorStop(0, '#ff9a4a'); gg.addColorStop(0.45, '#c2346a'); gg.addColorStop(1, '#2a0f45');
  c.globalAlpha = 0.55; c.fillStyle = gg; c.fillRect(gx - R, gy - R, R * 2, R * 2);
  for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? 'rgba(255,200,140,.08)' : 'rgba(60,10,60,.12)'; c.fillRect(gx - R, gy - R + i * R * 0.22 + 10, R * 2, R * 0.09); }
  c.globalAlpha = 1;
  c.fillStyle = 'rgba(20,8,40,.35)';
  for (let y = gy - R; y < gy + R; y += 7) for (let x = gx - R; x < gx + R; x += 7) {
    const sh = clamp01(((x - gx) + (y - gy)) / (R * 1.4) + 0.4);
    if (sh > 0.05) { c.beginPath(); c.arc(x + ((y / 7) % 2) * 3.5, y, sh * 3.4, 0, 7); c.fill(); }
  }
  c.restore();
  c.save();
  c.translate(gx, gy); c.rotate(-0.38); c.scale(1, 0.22);
  c.strokeStyle = 'rgba(255,214,150,.35)'; c.lineWidth = 9; c.beginPath(); c.arc(0, 0, R * 1.35, Math.PI * 1.02, Math.PI * 1.98); c.stroke();
  c.strokeStyle = 'rgba(255,214,150,.18)'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, R * 1.5, Math.PI * 1.02, Math.PI * 1.98); c.stroke();
  c.restore();
  // stars
  const n = Math.round(w * h / 2600);
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, m = r();
    c.fillStyle = m > 0.9 ? '#ffe3a8' : m > 0.8 ? '#a8dcff' : '#f7ead0';
    c.globalAlpha = 0.35 + r() * 0.6;
    const sz = m > 0.97 ? 1.8 : m > 0.8 ? 1.2 : 0.8;
    c.fillRect(x, y, sz, sz);
    if (m > 0.985) { c.globalAlpha = 0.5; c.fillRect(x - 4, y + 0.4, 9, 0.6); c.fillRect(x + 0.4, y - 4, 0.6, 9); }
  }
  c.globalAlpha = 1;
  // vignette
  const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(5,2,15,.55)');
  c.fillStyle = v; c.fillRect(0, 0, w, h);
  return cv;
}

function makeGrain() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c = cv.getContext('2d'), im = c.createImageData(256, 256);
  for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  c.putImageData(im, 0, 0);
  return cv;
}

export function aimPath(game, kind, ang, pow) {
  const t = game.cur, v = game.launchVel(kind, ang, pow);
  const m = kind === 'jet' ? { x: t.x, y: t.y } : game.muzzle(t, ang);
  const path = [];
  simulate(game.world, kind === 'jet' ? 'jet' : kind, m.x, m.y, v.vx, v.vy, t, game.troops, 0.42, path, 0.42);
  return path;
}
