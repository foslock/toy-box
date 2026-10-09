// Draws a trial: the painted field, then everything that moves, then the weather and the guides.

import { SKIES, MARGIN, paintField } from './paint.js';

const TAU = Math.PI * 2;

export class View {
  constructor(canvas) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, s: 10 };
    this.inset = { top: 70, bottom: 30, left: 12, right: 12 };
    this.fogCv = document.createElement('canvas');
    this.ripples = [];
    this.wisps = [];
    this.streaks = [];
  }

  setTrial(tr) {
    this.tr = tr;
    const c = tr.c;
    // paint resolution: enough for a desktop close-up, small enough for a phone's memory
    const budget = matchMedia('(pointer: coarse)').matches ? 1800 : 2600;
    const ppm = Math.min(22, Math.max(11, Math.floor(budget / Math.max(c.w, c.h))));
    this.field = paintField(c, ppm);
    this.sky = SKIES[c.sky];
    this.snap = true;
    this.wisps = Array.from({ length: 16 }, (_, i) => ({ x: Math.random() * c.w, y: Math.random() * c.h, r: 10 + Math.random() * 16, v: 0.3 + Math.random() * 0.5, a: i }));
    this.streaks = [];
    this.ripples = [];
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.W = innerWidth; this.H = innerHeight;
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
    this.fogCv.width = Math.ceil(this.W / 3); this.fogCv.height = Math.ceil(this.H / 3);
    this.snap = true;
  }

  toWorld(px, py) { const c = this.cam; return [(px - this.W / 2) / c.s + c.x, (py - this.H / 2) / c.s + c.y]; }
  toScreen(x, y) { const c = this.cam; return [(x - c.x) * c.s + this.W / 2, (y - c.y) * c.s + this.H / 2]; }

  // frame the flock and the dog (and the post when it matters), with a sensible closest zoom
  frame(dt) {
    const tr = this.tr, c = tr.c, d = tr.dog, I = this.inset;
    let x0 = d.x, x1 = d.x, y0 = d.y, y1 = d.y;
    for (const s of tr.sheep) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y); }
    if (d.tx != null) { x0 = Math.min(x0, d.tx); x1 = Math.max(x1, d.tx); y0 = Math.min(y0, d.ty); y1 = Math.max(y1, d.ty); }
    const st = tr.stepNow;
    const goal = tr.goal();
    // keep the ground behind the flock in view: that's where the dog has to go
    if (goal && st) {
      let bx = tr.cx - goal[0], by = tr.cy - goal[1]; const bl = Math.hypot(bx, by) || 1;
      const k = tr.spread + 8;
      const px = tr.cx + bx / bl * k, py = tr.cy + by / bl * k;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    if (goal && st && st.k !== 'lift') {
      // lean towards where they're going, without always fitting all of it in
      const gx = goal[0], gy = goal[1], mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const f = Math.hypot(gx - mx, gy - my) < 34 ? 1 : 0.35;
      const px = mx + (gx - mx) * f, py = my + (gy - my) * f;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    const pad = 4;
    x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
    const vw = this.W - I.left - I.right, vh = this.H - I.top - I.bottom;
    const minSpan = 30;
    let s = Math.min(vw / Math.max(x1 - x0, 1), vh / Math.max(y1 - y0, 1));
    s = Math.min(s, Math.min(vw, vh) / minSpan);
    const sMin = Math.min(vw / (c.w + 6), vh / (c.h + 6));
    s = Math.max(s, sMin);
    let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    // centre in the space between the HUD and the note card
    cx += (I.right - I.left) / 2 / s; cy += (I.bottom - I.top) / 2 / s;
    // keep the view on the field (plus a little of the walls)
    const hw = this.W / 2 / s, hh = this.H / 2 / s, m = 4;
    cx = hw * 2 > c.w + m * 2 ? c.w / 2 : Math.max(-m + hw, Math.min(c.w + m - hw, cx));
    cy = hh * 2 > c.h + m * 2 ? c.h / 2 + (I.bottom - I.top) / 2 / s : Math.max(-m + hh - I.top / s, Math.min(c.h + m - hh + I.bottom / s, cy));
    const cam = this.cam;
    if (this.snap) { cam.x = cx; cam.y = cy; cam.s = s; this.snap = false; return; }
    const k = 1 - Math.exp(-dt * 1.8), ks = 1 - Math.exp(-dt * 1.2);
    cam.x += (cx - cam.x) * k; cam.y += (cy - cam.y) * k;
    cam.s *= Math.pow(s / cam.s, ks);
  }

  draw(dt, now, ui = {}) {
    const g = this.g, tr = this.tr, c = tr.c, cam = this.cam, F = this.field;
    this.frame(dt);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = this.sky.out[2]; g.fillRect(0, 0, this.W, this.H);
    g.save();
    g.translate(this.W / 2, this.H / 2); g.scale(cam.s, cam.s); g.translate(-cam.x, -cam.y);
    const M = MARGIN;
    g.imageSmoothingQuality = 'high';
    g.drawImage(F.ground, -M, -M, F.ground.width / F.ppm, F.ground.height / F.ppm);
    this.drawGuide(g, now);
    this.drawGates(g, now, false);
    this.drawPen(g);
    const [sx, sy] = this.sky.sun;
    // shadows first, so nobody's shadow falls on somebody else's back
    g.fillStyle = this.sky.shade;
    for (const s of tr.sheep) { const sc = s.r / 0.5 * LOOK; g.beginPath(); g.ellipse(s.x + sx * 0.35 * sc, s.y + sy * 0.35 * sc, 0.62 * sc, 0.45 * sc, s.h, 0, TAU); g.fill(); }
    g.beginPath(); g.ellipse(tr.dog.x + sx * 0.3, tr.dog.y + sy * 0.3, 0.5 * LOOK, 0.25 * LOOK, tr.dog.h, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(tr.hand.x + sx * 0.9, tr.hand.y + sy * 0.9, 0.9, 0.45, Math.atan2(sy, sx), 0, TAU); g.fill();
    if (ui.target && !tr.done) this.drawTarget(g, ui.target, now);
    for (const s of tr.sheep) drawSheep(g, s, now);
    drawDog(g, tr.dog, now);
    this.drawShed(g, now);
    drawHandler(g, tr.hand, c.post, tr.dog, now);
    g.drawImage(F.canopy, -M, -M, F.canopy.width / F.ppm, F.canopy.height / F.ppm);
    if (c.wind) this.drawWind(g, dt);
    g.restore();
    if (c.fog) this.drawFog(g, dt, now);
    // the gate flags stand up out of the mist
    if (c.fog) { g.save(); g.translate(this.W / 2, this.H / 2); g.scale(cam.s, cam.s); g.translate(-cam.x, -cam.y); this.drawGates(g, now, true); this.drawRipples(g, dt); g.restore(); }
    // the light of the day over everything
    g.fillStyle = this.sky.tint; g.fillRect(0, 0, this.W, this.H);
    if (!c.fog) this.drawRipples(null, dt);
    this.drawOffscreen(g, now);
  }

  // a chalky dashed line from the flock to where it's going next
  drawGuide(g, now) {
    const tr = this.tr, st = tr.stepNow, goal = tr.goal();
    if (!st || !goal || tr.done || st.k === 'lift' || st.k === 'shed') return;
    let [gx, gy] = goal;
    if (st.k === 'gate') { gx += st.gate.d[0] * 6; gy += st.gate.d[1] * 6; }
    const dx = gx - tr.cx, dy = gy - tr.cy, L = Math.hypot(dx, dy);
    if (L < 5) return;
    const ux = dx / L, uy = dy / L, start = tr.spread + 2;
    g.save();
    g.strokeStyle = 'rgba(250, 244, 220, .5)'; g.lineWidth = 0.28; g.setLineDash([0.9, 1.1]); g.lineDashOffset = -now * 1.6;
    g.beginPath(); g.moveTo(tr.cx + ux * start, tr.cy + uy * start); g.lineTo(gx - ux * 1.5, gy - uy * 1.5); g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(250, 244, 220, .55)';
    g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx - ux * 1.8 - uy * 0.9, gy - uy * 1.8 + ux * 0.9); g.lineTo(gx - ux * 1.8 + uy * 0.9, gy - uy * 1.8 - ux * 0.9); g.fill();
    g.restore();
  }

  // in the shed: ring the marked ewes, and show the gap between them and the rest
  drawShed(g, now) {
    const tr = this.tr, st = tr.stepNow;
    if (!st || (st.phase !== 'shed') || tr.done) return;
    const m = tr.sheep.filter(s => s.marked), u = tr.sheep.filter(s => !s.marked);
    g.lineWidth = 0.1; g.strokeStyle = 'rgba(200, 50, 35, .85)'; g.setLineDash([0.35, 0.3]); g.lineDashOffset = -now;
    for (const s of m) { g.beginPath(); g.arc(s.x, s.y, 1.25, 0, TAU); g.stroke(); }
    g.setLineDash([]);
    if (st.k !== 'shed') return;
    let best = 1e9, a = null, b = null;
    for (const p of m) for (const q of u) { const d = Math.hypot(p.x - q.x, p.y - q.y); if (d < best) { best = d; a = p; b = q; } }
    if (!a) return;
    const ok = st.ok, k = Math.min(1, best / 3.4);
    g.strokeStyle = ok ? 'rgba(255, 248, 225, .95)' : `rgba(255, 248, 225, ${0.35 + k * 0.3})`; g.lineWidth = ok ? 0.16 : 0.1;
    g.setLineDash(ok ? [] : [0.3, 0.3]);
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]);
    if (st.hold > 0) {
      g.strokeStyle = '#fff7e0'; g.lineWidth = 0.22;
      g.beginPath(); g.arc(a.x, a.y, 1.7, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, st.hold / 1.0)); g.stroke();
    }
  }

  drawTarget(g, [x, y], now) {
    const p = 0.5 + 0.5 * Math.sin(now * 7);
    g.strokeStyle = `rgba(255, 250, 230, ${0.55 + p * 0.3})`; g.lineWidth = 0.12;
    g.beginPath(); g.arc(x, y, 0.7 + p * 0.25, 0, TAU); g.stroke();
    g.beginPath(); g.arc(x, y, 0.12, 0, TAU); g.fillStyle = 'rgba(255, 250, 230, .8)'; g.fill();
  }

  drawGates(g, now, flagsOnly) {
    const tr = this.tr, st = tr.stepNow, [sx, sy] = this.sky.sun;
    for (const gt of tr.gateList) {
      const px = -gt.d[1], py = gt.d[0], h = gt.w / 2;
      const active = st && st.k === 'gate' && st.gate === gt && !tr.done;
      for (const side of [-1, 1]) {
        const ax = gt.c[0] + px * h * side, ay = gt.c[1] + py * h * side, bx = gt.c[0] + px * (h + 2.2) * side, by = gt.c[1] + py * (h + 2.2) * side;
        if (!flagsOnly) {
          g.strokeStyle = this.sky.shade; g.lineWidth = 0.35;
          g.beginPath(); g.moveTo(ax + sx * 0.5, ay + sy * 0.5); g.lineTo(bx + sx * 0.5, by + sy * 0.5); g.stroke();
          // the hurdle: two rails and a few uprights
          g.strokeStyle = '#a07c50'; g.lineWidth = 0.14;
          for (const o of [-0.09, 0.09]) { g.beginPath(); g.moveTo(ax - gt.d[0] * o, ay - gt.d[1] * o); g.lineTo(bx - gt.d[0] * o, by - gt.d[1] * o); g.stroke(); }
          g.fillStyle = '#6e5232';
          for (let i = 0; i <= 3; i++) { const t = i / 3; g.beginPath(); g.arc(ax + (bx - ax) * t, ay + (by - ay) * t, 0.13, 0, TAU); g.fill(); }
        }
        // the flag on the inner post
        const wave = Math.sin(now * 5 + side) * 0.15;
        g.fillStyle = active ? '#d23b2a' : '#efe6cc';
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + sx * 0.5 + 0.9, ay - 0.35 + wave); g.lineTo(ax + 0.1, ay - 0.65); g.closePath(); g.fill();
        g.fillStyle = '#3d2c1a'; g.beginPath(); g.arc(ax, ay, 0.12, 0, TAU); g.fill();
      }
      if (active && !flagsOnly) {
        const p = 0.5 + 0.5 * Math.sin(now * 3);
        g.strokeStyle = `rgba(255, 245, 210, ${0.25 + p * 0.25})`; g.lineWidth = 0.18; g.setLineDash([0.4, 0.5]);
        g.beginPath(); g.moveTo(gt.c[0] + px * h, gt.c[1] + py * h); g.lineTo(gt.c[0] - px * h, gt.c[1] - py * h); g.stroke(); g.setLineDash([]);
      }
    }
  }

  drawPen(g) {
    const tr = this.tr, p = tr.c.pen;
    if (!p) return;
    const [sx, sy] = this.sky.sun;
    const segs = tr.walls.slice(tr.penGate - 4, tr.penGate + 1);
    for (const pass of [0, 1]) {
      for (const [ax, ay, bx, by] of segs.slice(0, 4)) {
        if (pass === 0) { g.strokeStyle = this.sky.shade; g.lineWidth = 0.35; g.beginPath(); g.moveTo(ax + sx * 0.45, ay + sy * 0.45); g.lineTo(bx + sx * 0.45, by + sy * 0.45); g.stroke(); continue; }
        const L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L;
        g.strokeStyle = '#a88556'; g.lineWidth = 0.12;
        for (const o of [-0.08, 0.08]) { g.beginPath(); g.moveTo(ax + nx * o, ay + ny * o); g.lineTo(bx + nx * o, by + ny * o); g.stroke(); }
        g.fillStyle = '#6e5232';
        const n = Math.max(1, Math.round(L / 1.2));
        for (let i = 0; i <= n; i++) { const t = i / n; g.beginPath(); g.arc(ax + (bx - ax) * t, ay + (by - ay) * t, 0.12, 0, TAU); g.fill(); }
      }
    }
    // the gate itself: a lighter hurdle with a diagonal brace, swung open into the field
    const gw = tr.walls[tr.penGate];
    {
      const [ax, ay, bx, by] = gw, L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L;
      g.strokeStyle = this.sky.shade; g.lineWidth = 0.35; g.beginPath(); g.moveTo(ax + sx * 0.45, ay + sy * 0.45); g.lineTo(bx + sx * 0.45, by + sy * 0.45); g.stroke();
      g.strokeStyle = '#d2b47e'; g.lineWidth = 0.13;
      for (const o of [-0.1, 0.1]) { g.beginPath(); g.moveTo(ax + nx * o, ay + ny * o); g.lineTo(bx + nx * o, by + ny * o); g.stroke(); }
      g.lineWidth = 0.08; g.beginPath(); g.moveTo(ax - nx * 0.1, ay - ny * 0.1); g.lineTo(bx + nx * 0.1, by + ny * 0.1); g.stroke();
      g.fillStyle = '#6e5232'; g.beginPath(); g.arc(ax, ay, 0.16, 0, TAU); g.fill();
    }
    g.strokeStyle = '#d8c58e'; g.lineWidth = 0.06; g.beginPath(); g.arc(gw[2], gw[3], 0.22, 0, TAU); g.stroke();
  }

  drawWind(g, dt) {
    const tr = this.tr, c = tr.c, [wx, wy] = tr.windNow, cam = this.cam;
    const hw = this.W / 2 / cam.s, hh = this.H / 2 / cam.s;
    while (this.streaks.length < 70) this.streaks.push({ x: cam.x + (Math.random() - 0.5) * hw * 2.4, y: cam.y + (Math.random() - 0.5) * hh * 2.4, life: Math.random() * 2, len: 1 + Math.random() * 2.5 });
    const sp = Math.hypot(wx, wy) * 14;
    g.strokeStyle = 'rgba(240, 240, 225, .22)'; g.lineWidth = 0.06;
    g.beginPath();
    for (const s of this.streaks) {
      s.x += wx * 14 * dt; s.y += wy * 14 * dt; s.life -= dt;
      if (s.life < 0 || Math.abs(s.x - cam.x) > hw * 1.3 || Math.abs(s.y - cam.y) > hh * 1.3) {
        s.x = cam.x - hw * 1.2 + Math.random() * hw * 0.8; s.y = cam.y + (Math.random() - 0.5) * hh * 2.4; s.life = 1 + Math.random() * 2;
      }
      const L = s.len * Math.min(1, sp / 6);
      g.moveTo(s.x, s.y); g.lineTo(s.x - wx / (Math.hypot(wx, wy) || 1) * L, s.y - wy / (Math.hypot(wx, wy) || 1) * L);
    }
    g.stroke();
    void c;
  }

  // mist: a soft white layer with clear pockets round the dog and the handler
  drawFog(g, dt, now) {
    const tr = this.tr, c = tr.c, f = this.fogCv, k = f.getContext('2d'), sc = 1 / 3;
    k.setTransform(1, 0, 0, 1, 0, 0);
    k.globalCompositeOperation = 'source-over';
    k.clearRect(0, 0, f.width, f.height);
    k.fillStyle = 'rgba(226, 230, 228, .9)'; k.fillRect(0, 0, f.width, f.height);
    k.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r) => {
      const [px, py] = this.toScreen(x, y), R = r * this.cam.s * sc;
      const gr = k.createRadialGradient(px * sc, py * sc, R * 0.35, px * sc, py * sc, R);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      k.fillStyle = gr; k.fillRect(px * sc - R, py * sc - R, R * 2, R * 2);
    };
    hole(tr.dog.x, tr.dog.y, c.fog.r);
    hole(c.post[0], c.post[1], 11);
    k.globalCompositeOperation = 'source-over';
    // drifting wisps, so the mist moves
    for (const w of this.wisps) {
      w.x += w.v * dt; if (w.x > c.w + 20) w.x = -20;
      const [px, py] = this.toScreen(w.x, w.y + Math.sin(now * 0.1 + w.a) * 3), R = w.r * this.cam.s * sc;
      const gr = k.createRadialGradient(px * sc, py * sc, 0, px * sc, py * sc, R);
      gr.addColorStop(0, 'rgba(240, 243, 240, .35)'); gr.addColorStop(1, 'rgba(240, 243, 240, 0)');
      k.fillStyle = gr; k.fillRect(px * sc - R, py * sc - R, R * 2, R * 2);
    }
    g.save(); g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(f, 0, 0, this.W, this.H); g.restore();
  }

  ripple(x, y) { this.ripples.push({ x, y, t: 0 }); }

  // where a bleat came from, out in the mist
  drawRipples(g, dt) {
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter(r => r.t < 1.6);
    if (!g) return;
    for (const r of this.ripples) {
      const a = 1 - r.t / 1.6;
      g.strokeStyle = `rgba(80, 90, 90, ${a * 0.55})`; g.lineWidth = 0.15;
      for (const k of [0, 0.35]) { const t = Math.max(0, r.t - k); g.beginPath(); g.arc(r.x, r.y, 0.6 + t * 3.2, 0, TAU); g.stroke(); }
    }
  }

  // when the next gate (or the pen, or the sheep) is out of sight, point at it from the edge
  drawOffscreen(g, now) {
    const tr = this.tr, goal = tr.goal();
    const marks = [];
    if (goal && !tr.done) marks.push({ x: goal[0], y: goal[1], label: tr.stepNow.k === 'pen' ? 'pen' : tr.stepNow.k === 'post' || tr.stepNow.k === 'lift' ? 'post' : tr.stepNow.k === 'gate' ? 'gates' : 'ring' });
    const I = this.inset;
    for (const m of marks) {
      const [px, py] = this.toScreen(m.x, m.y);
      const l = I.left + 22, r = this.W - I.right - 22, t = I.top + 22, b = this.H - I.bottom - 22;
      if (px > l && px < r && py > t && py < b) continue;
      const cx = this.W / 2, cy = this.H / 2, dx = px - cx, dy = py - cy;
      const k = Math.min(dx > 0 ? (r - cx) / dx : dx < 0 ? (l - cx) / dx : 1e9, dy > 0 ? (b - cy) / dy : dy < 0 ? (t - cy) / dy : 1e9);
      const x = cx + dx * k, y = cy + dy * k, a = Math.atan2(dy, dx);
      const dist = Math.round(Math.hypot(m.x - this.tr.cx, m.y - this.tr.cy));
      g.save(); g.translate(x, y);
      g.fillStyle = 'rgba(251, 246, 231, .92)'; g.strokeStyle = '#2a2a22'; g.lineWidth = 1.2;
      g.rotate(a);
      g.beginPath(); g.moveTo(14, 0); g.lineTo(-6, -9); g.lineTo(-3, 0); g.lineTo(-6, 9); g.closePath(); g.fill(); g.stroke();
      g.rotate(-a);
      g.font = 'italic 13px "Libre Caslon Text", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const ty = y > cy ? -20 : 22, tx = Math.max(-30, Math.min(30, -Math.cos(a) * 30));
      g.lineWidth = 3; g.strokeStyle = 'rgba(251, 246, 231, .85)'; g.strokeText(`${m.label} ${dist} m`, tx, ty);
      g.fillStyle = '#2a2a22'; g.fillText(`${m.label} ${dist} m`, tx, ty);
      g.restore();
    }
    void now;
  }
}

// ---------------------------------------------------------------------------------------- sheep
export const LOOK = 1.3; // drawn a little larger than life, so a flock reads on a phone
export function drawSheep(g, s, now, look = LOOK) {
  const sc = s.r / 0.5 * look;
  g.save(); g.translate(s.x, s.y); g.rotate(s.h); g.scale(sc, sc);
  const bob = Math.sin(s.step * 7) * 0.035 * Math.min(1, s.speed || 0);
  const grazing = (s.speed || 0) < 0.15 && s.stress < 0.3 && !s.stand;
  // wool, in clumps: a darker underside and a lighter top, so it reads as round
  const R = clumps(s);
  const wool = s.kind === 'lamb' ? ['#d9d3c6', '#fbf8ef', '#ffffff'] : ['#c9bea6', '#ece4d0', '#f8f3e6'];
  g.fillStyle = wool[0];
  for (const [x, y, r] of R) { g.beginPath(); g.arc(x + 0.05, y + 0.06, r, 0, TAU); g.fill(); }
  g.fillStyle = wool[1];
  for (const [x, y, r] of R) { g.beginPath(); g.arc(x, y, r * 0.96, 0, TAU); g.fill(); }
  g.fillStyle = wool[2];
  for (const [x, y, r] of R) { g.beginPath(); g.arc(x - r * 0.25, y - r * 0.3, r * 0.45, 0, TAU); g.fill(); }
  if (s.marked) {
    g.fillStyle = 'rgba(184, 42, 34, .85)';
    g.beginPath(); g.ellipse(-0.08, -0.02, 0.24, 0.17, 0.4, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(0.1, 0.08, 0.12, 0.09, -0.3, 0, TAU); g.fill();
  }
  // head
  const hx = grazing ? 0.6 : 0.56 + bob, face = s.kind === 'lamb' ? '#4a4038' : '#24201c';
  g.fillStyle = face;
  for (const side of [-1, 1]) { g.beginPath(); g.ellipse(hx - 0.05, side * 0.15, 0.1, 0.045, side * 0.5, 0, TAU); g.fill(); }
  g.beginPath(); g.ellipse(hx, 0, grazing ? 0.17 : 0.19, 0.12, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(240, 232, 214, .7)'; g.beginPath(); g.ellipse(hx + 0.12, 0, 0.05, 0.05, 0, 0, TAU); g.fill();
  if (s.kind === 'ram') {
    // curled horns, either side of the head
    for (const side of [-1, 1]) {
      g.strokeStyle = '#5e4c36'; g.lineWidth = 0.13;
      g.beginPath(); g.moveTo(hx - 0.06, side * 0.07); g.quadraticCurveTo(hx - 0.3, side * 0.3, hx - 0.02, side * 0.33); g.quadraticCurveTo(hx + 0.12, side * 0.3, hx + 0.06, side * 0.2); g.stroke();
      g.strokeStyle = '#b39d78'; g.lineWidth = 0.07;
      g.beginPath(); g.moveTo(hx - 0.06, side * 0.07); g.quadraticCurveTo(hx - 0.3, side * 0.3, hx - 0.02, side * 0.33); g.quadraticCurveTo(hx + 0.12, side * 0.3, hx + 0.06, side * 0.2); g.stroke();
    }
  }
  g.restore();
  void now;
}

const clumpCache = new WeakMap();
function clumps(s) {
  let c = clumpCache.get(s);
  if (c) return c;
  let a = s.seed * 1e6;
  const r = () => (a = (a * 9301 + 49297) % 233280) / 233280;
  c = [];
  for (let i = 0; i < 9; i++) {
    const t = (i / 9) * TAU + r() * 0.4;
    c.push([Math.cos(t) * 0.3 - 0.04, Math.sin(t) * 0.18, 0.2 + r() * 0.06]);
  }
  c.push([0, 0, 0.3], [-0.12, 0.02, 0.24], [0.14, -0.02, 0.22]);
  clumpCache.set(s, c);
  return c;
}

// ---------------------------------------------------------------------------------------- the dog
export function drawDog(g, d, now, look = LOOK) {
  const sp = d.speed || 0, run = Math.min(1, sp / 8);
  g.save(); g.translate(d.x, d.y); g.rotate(d.h); g.scale(look, look);
  const gait = Math.sin(d.run * 3.2);
  const stretch = 1 + run * 0.18 * (0.6 + 0.4 * gait);
  // legs, only really visible when running
  if (sp > 0.6) {
    g.fillStyle = '#f2ede2';
    const k = 0.17 * Math.min(1, sp / 4);
    for (const [x, y, ph] of [[0.24, -0.12, 0], [0.24, 0.12, Math.PI], [-0.22, -0.12, Math.PI], [-0.22, 0.12, 0]]) {
      g.beginPath(); g.ellipse(x + Math.sin(d.run * 3.2 + ph) * k, y * 1.05, 0.07, 0.05, 0, 0, TAU); g.fill();
    }
  }
  if (d.lying) {
    g.fillStyle = '#f2ede2';
    for (const y of [-0.08, 0.08]) { g.beginPath(); g.ellipse(0.42, y, 0.1, 0.045, 0, 0, TAU); g.fill(); }
  }
  // tail, swinging
  const tw = Math.sin(now * (d.lying ? 2 : 9)) * (d.lying ? 0.15 : 0.35);
  g.strokeStyle = '#1b1a18'; g.lineWidth = 0.1;
  g.beginPath(); g.moveTo(-0.32 * stretch, 0); g.quadraticCurveTo(-0.5 * stretch, tw * 0.5, -0.66 * stretch, tw); g.stroke();
  g.fillStyle = '#f2ede2'; g.beginPath(); g.arc(-0.67 * stretch, tw, 0.06, 0, TAU); g.fill();
  // body
  const bl = d.lying ? 0.3 : 0.36 * stretch;
  g.fillStyle = '#1b1a18';
  g.beginPath(); g.ellipse(-0.02, 0, bl, d.lying ? 0.19 : 0.16, 0, 0, TAU); g.fill();
  // white collar and chest
  g.fillStyle = '#f2ede2';
  g.beginPath(); g.ellipse(bl * 0.62, 0, 0.1, 0.17, 0, 0, TAU); g.fill();
  // head
  const hx = bl * 0.62 + 0.15;
  g.fillStyle = '#1b1a18';
  g.beginPath(); g.ellipse(hx, 0, 0.14, 0.12, 0, 0, TAU); g.fill();
  for (const side of [-1, 1]) { g.beginPath(); g.ellipse(hx - 0.06, side * 0.1, 0.06, 0.035, side * 0.6, 0, TAU); g.fill(); }
  g.fillStyle = '#f2ede2';
  g.beginPath(); g.ellipse(hx + 0.05, 0, 0.11, 0.035, 0, 0, TAU); g.fill();
  g.fillStyle = '#1b1a18'; g.beginPath(); g.arc(hx + 0.16, 0, 0.035, 0, TAU); g.fill();
  g.restore();
}

// ---------------------------------------------------------------------------------------- you
function drawHandler(g, h, post, dog, now) {
  // the stake
  g.fillStyle = '#5a4630'; g.beginPath(); g.arc(post[0] + 1.1, post[1] + 0.6, 0.12, 0, TAU); g.fill();
  const a = Math.atan2(dog.y - h.y, dog.x - h.x);
  g.save(); g.translate(h.x, h.y);
  g.rotate(a); g.scale(LOOK, LOOK);
  if (h.moving) { const k = Math.sin(h.walk * 5) * 0.12; g.fillStyle = '#2e2a22'; g.beginPath(); g.ellipse(k, -0.14, 0.12, 0.07, 0, 0, TAU); g.ellipse(-k, 0.14, 0.12, 0.07, 0, 0, TAU); g.fill(); }
  // crook held out in the right hand
  g.strokeStyle = '#7a5a36'; g.lineWidth = 0.07;
  g.beginPath(); g.moveTo(0.05, 0.32); g.lineTo(0.95, 0.42); g.stroke();
  g.beginPath(); g.arc(1.02, 0.34, 0.09, Math.PI * 0.8, Math.PI * 2.3); g.stroke();
  // shoulders (waxed jacket), then the cap
  g.fillStyle = '#3f4a32'; g.beginPath(); g.ellipse(0, 0, 0.24, 0.38, 0, 0, TAU); g.fill();
  g.fillStyle = '#6b5a44'; g.beginPath(); g.ellipse(0.08, 0, 0.17, 0.16, 0, 0, TAU); g.fill();
  g.fillStyle = '#7c6a51'; g.beginPath(); g.ellipse(0.2, 0, 0.09, 0.14, 0, 0, TAU); g.fill();
  g.restore();
  void now;
}
