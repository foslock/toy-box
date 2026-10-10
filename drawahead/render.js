// Everything on the page is drawn as if by hand: ruled exercise-book paper, blue pencil for your track,
// black pen for the course, red pen for notes and flags, and a soft graphite scribble at the bottom.
import { jig } from './rng.js';
import { R } from './game.js';

export const C = {
  paper: '#f5f0e1', rule: 'rgba(120,150,200,.42)', margin: 'rgba(214,74,74,.55)',
  pencil: '#2c50b0', pencilSoft: 'rgba(44,80,176,.28)', graphite: '#3b3a3f', ink: '#16161c', red: '#cf3a2f', faint: 'rgba(70,70,80,.33)',
};
const HAND = '"Gochi Hand", "Schoolbell", "Comic Sans MS", cursive';

function grain(color, alphaLo, alphaHi, size = 96) {
  const cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size });
  const x = cv.getContext('2d');
  x.fillStyle = color;
  for (let i = 0; i < size * size * 0.55; i++) {
    x.globalAlpha = alphaLo + Math.random() * (alphaHi - alphaLo);
    x.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random(), 1);
  }
  return cv;
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, s: 1 };
    const ctx = this.ctx;
    this.pPencil = ctx.createPattern(grain('#2c50b0', 0.35, 1), 'repeat');
    this.pGraphite = ctx.createPattern(grain('#38373d', 0.2, 0.85), 'repeat');
    this.pPaper = ctx.createPattern(grain('#8a7a55', 0.02, 0.09, 160), 'repeat');
    this.pRed = ctx.createPattern(grain('#cf3a2f', 0.45, 1), 'repeat');
    this.popups = [];
    this.marks = [];
  }

  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    // how much world fits: at least ~650 units across and ~600 down
    this.base = Math.min(w / 650, h / 600);
  }

  // world ↔ screen
  sx(x) { return (x - this.cam.x) * this.cam.s + this.w / 2; }
  sy(y) { return (y - this.cam.y) * this.cam.s + this.h / 2; }
  wx(px) { return (px - this.w / 2) / this.cam.s + this.cam.x; }
  wy(py) { return (py - this.h / 2) / this.cam.s + this.cam.y; }

  follow(game, dt, snap = false) {
    const rd = game.rider, c = game.course, cam = this.cam;
    let tx = rd.x, ty = rd.y;
    if (game.state === 'crash' || game.state === 'over') { const d = game.debris?.[0]; if (d) { tx = rd.x + (d.x - rd.x) * 0.3; ty = rd.y; } }
    const sp = Math.hypot(rd.vx, rd.vy);
    const s = this.base / (1 + 0.28 * Math.min(1, Math.max(0, (sp - 350) / 550)));
    const k = snap ? 1 : 1 - Math.exp(-dt * 1.6);
    cam.s += (s - cam.s) * (snap ? 1 : 1 - Math.exp(-dt * 0.8));
    const vw = this.w / cam.s, vh = this.h / cam.s;
    const lead = Math.min(0.24, 0.12 + sp / 4000);
    const cx = tx + vw * lead;
    const ahead = c.baseline(tx + vw * 0.35) + 70;
    let cy = ty * 0.55 + ahead * 0.45;
    // keep a bit of the scribble in view below, but the sled well clear of the top
    cy = Math.max(cy, ty - vh * 0.5 + vh * 0.3);
    cam.x += (cx - cam.x) * (snap ? 1 : 1 - Math.exp(-dt * 4));
    cam.y += (cy - cam.y) * k;
  }

  draw(game, opts = {}) {
    const { ctx, w, h, dpr } = this, cam = this.cam, c = game.course, t = game.t;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
    // ruled lines, in world space so they scroll as you fall
    const sp = 34;
    const top = this.wy(0), bot = this.wy(h);
    ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = Math.floor(top / sp) * sp; y < bot; y += sp) { const yy = Math.round(this.sy(y)) + 0.5; ctx.moveTo(0, yy); ctx.lineTo(w, yy); }
    ctx.stroke();
    ctx.strokeStyle = C.margin; ctx.lineWidth = 1.4;
    const mx = Math.min(78, w * 0.12);
    ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, h); ctx.moveTo(mx + 4, 0); ctx.lineTo(mx + 4, h); ctx.stroke();
    ctx.fillStyle = this.pPaper; ctx.fillRect(0, 0, w, h);

    const x0 = this.wx(-40), x1 = this.wx(w + 40);
    ctx.save();
    ctx.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * (w / 2 - cam.x * cam.s), dpr * (h / 2 - cam.y * cam.s));
    const px = 1 / cam.s; // one screen pixel, in world units

    this.drawDoodles(c, x0, x1, px);
    this.drawScribble(c, x0, x1, px, bot);
    for (const o of c.near(x0 - 200, x1 + 200)) {
      if (o.type === 'wind') this.drawWind(o, t, px);
    }
    for (const l of c.ledges) if (l.x1 > x0 && l.x0 < x1) this.drawLedge(l, px);
    for (const o of c.near(x0 - 100, x1 + 100)) {
      if (o.type === 'blot') this.drawBlot(o, px);
      else if (o.type === 'pillar') this.drawPillar(o, px);
      else if (o.type === 'gate') this.drawGate(o, px, t);
    }
    if (c.finishX) this.drawFinish(c, px);
    for (const n of c.notes) if (n.x > x0 - 300 && n.x < x1 + 300) this.drawNote(n, px);
    if (opts.ghost) this.drawGhost(opts.ghost, px, t);
    this.drawStrokes(game, px);
    if (game.state === 'crash' || game.state === 'over') this.drawDebris(game, px);
    else this.drawRider(game.rider, px, t, game.state);
    ctx.restore();

    this.drawPopups(game, opts.dt || 0);
    // a little arrow when the sled is above the page
    const ry = this.sy(game.rider.y);
    if (ry < 6 && game.state === 'ride') {
      const rx = this.sx(game.rider.x);
      ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(rx, 8); ctx.lineTo(rx - 8, 22); ctx.lineTo(rx + 8, 22); ctx.fill();
    }
  }

  // ---- pieces
  wobPath(pts, px, salt, amp = 1.2, close = false) {
    const ctx = this.ctx;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = p.x + jig(i, salt) * amp * px * 2, y = p.y + jig(i, salt + 7) * amp * px * 2;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    if (close) ctx.closePath();
  }

  drawScribble(c, x0, x1, px, bot) {
    const ctx = this.ctx, step = 10;
    const k0 = Math.floor(x0 / step), k1 = Math.ceil(x1 / step);
    // hatching under the scribble line
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(k0 * step, bot + 50);
    for (let k = k0; k <= k1; k++) ctx.lineTo(k * step, c.floor(k * step) + 8);
    ctx.lineTo(k1 * step, bot + 50);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = 'rgba(60,58,66,.07)'; ctx.fillRect(x0, this.wy(0), x1 - x0, bot - this.wy(0) + 60);
    ctx.strokeStyle = this.pGraphite; ctx.lineWidth = 1.3 * px; ctx.globalAlpha = 0.55;
    ctx.beginPath();
    const hs = 13;
    const yTop = c.floor(x0) - 40;
    for (let k = Math.floor((x0 - (bot - yTop)) / hs); k * hs < x1; k++) {
      const x = k * hs;
      ctx.moveTo(x + jig(k, 3) * 4, yTop);
      ctx.lineTo(x + (bot - yTop + 60) * 0.7 + jig(k, 4) * 6, bot + 60);
    }
    ctx.stroke();
    ctx.restore();
    // the scribble itself: a dense zig-zag, three passes
    ctx.strokeStyle = this.pGraphite; ctx.lineJoin = 'round';
    for (let pass = 0; pass < 3; pass++) {
      ctx.lineWidth = (pass === 0 ? 2.4 : 1.4) * px;
      ctx.globalAlpha = pass === 0 ? 0.9 : 0.6;
      ctx.beginPath();
      for (let k = k0 - 1; k <= k1; k++) {
        const x = k * step + jig(k, 11 + pass) * 6;
        const y = c.floor(k * step) + (k & 1 ? -9 : 9) * (0.7 + 0.5 * Math.abs(jig(k, 21 + pass))) + pass * 5;
        k === k0 - 1 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawLedge(l, px) {
    const ctx = this.ctx;
    ctx.strokeStyle = C.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = 2.6 * px;
    this.wobPath(l.pts, px, l.x0 | 0, 0.6); ctx.stroke();
    // little hatch marks under it so it reads as solid
    ctx.lineWidth = 1 * px; ctx.globalAlpha = 0.6;
    ctx.beginPath();
    for (let i = 0; i < l.pts.length - 1; i++) {
      const a = l.pts[i], b = l.pts[i + 1];
      for (let f = 0.2; f < 1; f += 0.4) {
        const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
        ctx.moveTo(x, y + 2); ctx.lineTo(x - 6, y + 10);
      }
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  drawBlot(o, px) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(o.x, o.y);
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    const p = o.pts, n = p.length;
    for (let i = 0; i < n; i++) {
      const a = p[i], b = p[(i + 1) % n];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      i ? ctx.quadraticCurveTo(a.x, a.y, mx, my) : ctx.moveTo(mx, my);
    }
    const a = p[0], b = p[1];
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    ctx.fill();
    for (const d of o.drops) { ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill(); }
    // a glint so it looks wet
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.beginPath(); ctx.ellipse(-o.r * 0.32, -o.r * 0.36, o.r * 0.22, o.r * 0.1, -0.6, 0, 7); ctx.fill();
    ctx.restore();
  }

  drawPillar(o, px) {
    const ctx = this.ctx;
    ctx.save();
    this.wobPath(o.pts, px, o.id * 13, 0.8, true);
    ctx.fillStyle = '#ece5d1'; ctx.fill();
    ctx.clip();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.1 * px; ctx.globalAlpha = 0.65;
    ctx.beginPath();
    const yb = o.pts[0].y, H = yb - o.top + 30;
    for (let x = o.x0 - H; x < o.x1 + 40; x += 9) { ctx.moveTo(x, yb); ctx.lineTo(x + H * 0.75, yb - H); }
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    for (let x = o.x0 - 40; x < o.x1 + H; x += 15) { ctx.moveTo(x, yb); ctx.lineTo(x - H * 0.75, yb - H); }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.6 * px; ctx.lineJoin = 'round';
    this.wobPath(o.pts, px, o.id * 13, 0.8, true); ctx.stroke();
    ctx.lineWidth = 1.2 * px;
    this.wobPath(o.pts, px, o.id * 13 + 5, 1.6, true); ctx.stroke();
  }

  drawGate(o, px, t) {
    const ctx = this.ctx;
    const yA = o.y - o.gap / 2, yB = o.y + o.gap / 2;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2 * px; ctx.lineCap = 'round';
    for (const [y, dir] of [[yA, -1], [yB, 1]]) {
      // a pole sticking away from the gap, with a flag
      ctx.beginPath(); ctx.moveTo(o.x, y); ctx.lineTo(o.x + 1, y + dir * 46); ctx.stroke();
      const fy = y + dir * 46;
      const flap = Math.sin(t * 6 + o.id) * 3;
      ctx.fillStyle = o.done ? 'rgba(207,58,47,.35)' : C.red;
      ctx.beginPath(); ctx.moveTo(o.x, fy); ctx.lineTo(o.x + 26, fy - dir * 8 + flap); ctx.lineTo(o.x, fy - dir * 18); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x, y, 3.2, 0, 7); ctx.fillStyle = C.ink; ctx.fill();
    }
    // a dotted line across the gap
    ctx.strokeStyle = 'rgba(207,58,47,.5)'; ctx.lineWidth = 1.5 * px; ctx.setLineDash([3 * px, 7 * px]);
    ctx.beginPath(); ctx.moveTo(o.x, yA + 6); ctx.lineTo(o.x, yB - 6); ctx.stroke(); ctx.setLineDash([]);
  }

  drawWind(o, t, px) {
    const ctx = this.ctx;
    const dirx = Math.sign(o.ax), diry = Math.sign(o.ay);
    ctx.strokeStyle = 'rgba(80,90,110,.42)'; ctx.lineWidth = 1.6 * px; ctx.lineCap = 'round';
    const n = Math.round(o.w / 55);
    const H = o.y1 - o.y0;
    for (let i = 0; i < n * 3; i++) {
      const fx = (i % n + 0.5) / n + jig(i, o.id) * 0.1;
      let fy = ((Math.floor(i / n) + 0.5) / 3 + jig(i, o.id + 1) * 0.2);
      let x = o.x0 + fx * o.w, y = o.y0 + fy * H;
      // drift along the wind and wrap within the zone
      const s = (t * 90 + i * 37) % 160;
      if (diry) y = o.y0 + ((fy * H + diry * s) % H + H) % H;
      else x = o.x0 + ((fx * o.w + dirx * s) % o.w + o.w) % o.w;
      // a wavy streak with an arrowhead, pointing the way the wind blows
      const L = 44, ux = dirx || 0, uy = diry || 0, nx = -uy, ny = ux;
      ctx.beginPath();
      for (let k = 0; k <= 8; k++) {
        const f = k / 8, wv = Math.sin(f * Math.PI * 2 + t * 4 + i) * 3.5;
        const qx = x + ux * L * f + nx * wv, qy = y + uy * L * f + ny * wv;
        k ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy);
      }
      const hx = x + ux * L, hy = y + uy * L;
      ctx.moveTo(hx - ux * 8 + nx * 5, hy - uy * 8 + ny * 5); ctx.lineTo(hx, hy); ctx.lineTo(hx - ux * 8 - nx * 5, hy - uy * 8 - ny * 5);
      ctx.stroke();
    }
    // the zone's edges, faint dashes
    ctx.setLineDash([6 * px, 10 * px]); ctx.strokeStyle = 'rgba(80,90,110,.22)';
    ctx.beginPath(); ctx.moveTo(o.x0, o.y0); ctx.lineTo(o.x0, o.y1); ctx.moveTo(o.x1, o.y0); ctx.lineTo(o.x1, o.y1); ctx.stroke();
    ctx.setLineDash([]);
  }

  drawFinish(c, px) {
    const ctx = this.ctx, x = c.finishX, y = c.baseline(x);
    ctx.strokeStyle = C.red; ctx.lineWidth = 2.4 * px; ctx.setLineDash([10 * px, 8 * px]);
    ctx.beginPath(); ctx.moveTo(x, y - 600); ctx.lineTo(x, y + 320); ctx.stroke(); ctx.setLineDash([]);
  }

  drawNote(n, px) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.rotate(-0.04);
    ctx.font = `${24 * px}px ${HAND}`;
    ctx.fillStyle = C.red; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n.text, 0, 0);
    ctx.restore();
    if (n.ax !== undefined) {
      // a hand-drawn arrow from the note to the thing
      const dx = n.ax - n.x, dy = n.ay - n.y, d = Math.hypot(dx, dy);
      if (d > 30) {
        const ux = dx / d, uy = dy / d;
        const sx = n.x + ux * 18, sy = n.y + uy * 18, ex = n.ax - ux * 6, ey = n.ay - uy * 6;
        ctx.strokeStyle = C.red; ctx.lineWidth = 1.8 * px; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo((sx + ex) / 2 + uy * 14, (sy + ey) / 2 - ux * 14, ex, ey);
        const a = Math.atan2(ey - ((sy + ey) / 2 - ux * 14), ex - ((sx + ex) / 2 + uy * 14));
        ctx.moveTo(ex - Math.cos(a - 0.5) * 11, ey - Math.sin(a - 0.5) * 11); ctx.lineTo(ex, ey);
        ctx.lineTo(ex - Math.cos(a + 0.5) * 11, ey - Math.sin(a + 0.5) * 11);
        ctx.stroke();
      }
    }
  }

  drawGhost(g, px, t) {
    // a dashed guide showing where to draw (tutorial)
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(44,80,176,.45)'; ctx.lineWidth = 3 * px; ctx.setLineDash([8 * px, 9 * px]);
    ctx.lineDashOffset = -t * 30 * px;
    ctx.beginPath(); g.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
    const p = g[0], pulse = 6 + Math.sin(t * 5) * 2;
    ctx.strokeStyle = C.red; ctx.lineWidth = 2 * px;
    ctx.beginPath(); ctx.arc(p.x, p.y, pulse * px * 2, 0, 7); ctx.stroke();
  }

  drawStrokes(game, px) {
    const ctx = this.ctx, t = game.t;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const st of game.strokes) {
      const segs = st.segs;
      if (!segs.length) continue;
      // two passes: a soft halo, then the grainy core
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? this.pPencil : C.pencilSoft;
        ctx.lineWidth = (pass ? 2.6 : 4.4) * px;
        let alpha = -1;
        ctx.beginPath();
        for (const s of segs) {
          if (s.dead) continue;
          const a = s.fade === null ? 1 : Math.max(0, 1 - (t - s.fade) / 1.1);
          const qa = Math.round(a * 8) / 8;
          if (qa !== alpha) {
            if (alpha >= 0) ctx.stroke();
            alpha = qa; ctx.globalAlpha = qa;
            ctx.beginPath(); ctx.moveTo(s.ax, s.ay);
          }
          ctx.lineTo(s.bx, s.by);
        }
        if (alpha >= 0) ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  drawRider(rd, px, t, state) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(rd.x, rd.y);
    ctx.rotate(rd.a);
    ctx.translate(0, R);           // sled bottom sits on the line
    drawSled(ctx, px);
    const sp = Math.hypot(rd.vx, rd.vy);
    drawKid(ctx, px, t, sp, state === 'ready');
    ctx.restore();
  }

  drawDebris(game, px) {
    const ctx = this.ctx;
    for (const d of game.debris) {
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a);
      if (d.part === 'sled') { ctx.translate(0, R); drawSled(ctx, px); }
      else { ctx.translate(0, 12); drawKid(ctx, px, game.t, 0, false, true); }
      ctx.restore();
    }
    // a scribbled "poof" where it happened
    const rd = game.rider, k = Math.min(1, game.crashT * 3);
    ctx.strokeStyle = C.graphite; ctx.lineWidth = 1.4 * px; ctx.globalAlpha = 0.7 * (1 - Math.max(0, game.crashT - 0.8));
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const a = i * 2.4, r = (10 + 22 * Math.abs(jig(i, 5))) * k;
      const x = rd.x + Math.cos(a) * r, y = rd.y - 10 + Math.sin(a) * r * 0.8;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  drawDoodles(c, x0, x1, px) {
    const ctx = this.ctx;
    ctx.strokeStyle = C.faint; ctx.lineWidth = 1.5 * px; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const d of c.doodles) {
      if (d.x < x0 - 120 || d.x > x1 + 120) continue;
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot); ctx.scale(d.s, d.s);
      doodle(ctx, d.kind, d.seed);
      ctx.restore();
    }
  }

  // floating red-pen scores
  pop(text, x, y, big = false) { this.popups.push({ text, x, y, t: 0, big }); }
  drawPopups(game, dt) {
    const ctx = this.ctx;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of this.popups) {
      p.t += dt;
      const a = p.t < 0.15 ? p.t / 0.15 : Math.max(0, 1 - (p.t - 1.0) / 0.5);
      const x = this.sx(p.x), y = this.sy(p.y) - 40 - p.t * 40;
      ctx.globalAlpha = a;
      ctx.font = `${p.big ? 36 : 25}px ${HAND}`;
      ctx.fillStyle = C.red;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.06);
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    this.popups = this.popups.filter(p => p.t < 1.5);
  }
}

export function drawSled(ctx, px) {
  // a red sled: runner with a curled nose, a slatted deck
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8 * px;
  ctx.beginPath();
  ctx.moveTo(-15, -1); ctx.lineTo(10, -1);
  ctx.quadraticCurveTo(18, -1, 17, -7); ctx.quadraticCurveTo(16, -11, 12, -9);
  ctx.stroke();
  ctx.fillStyle = C.red;
  ctx.beginPath();
  ctx.moveTo(-14, -5); ctx.lineTo(11, -5); ctx.lineTo(10, -9); ctx.lineTo(-13, -9); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#7a1e18'; ctx.lineWidth = 1.2 * px; ctx.stroke();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1.4 * px;
  ctx.beginPath(); ctx.moveTo(-9, -5); ctx.lineTo(-9, -1); ctx.moveTo(6, -5); ctx.lineTo(6, -1); ctx.stroke();
}

export function drawKid(ctx, px, t, sp, waiting, tumbling = false) {
  // a stick kid sitting on the sled, holding the rope, scarf streaming out behind
  ctx.strokeStyle = C.graphite; ctx.lineWidth = 2.1 * px; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const bob = waiting ? Math.sin(t * 2.2) * 0.6 : 0;
  const hip = { x: -4, y: -11 }, neck = { x: -1, y: -27 + bob }, head = { x: 0, y: -34 + bob };
  if (tumbling) {
    ctx.beginPath();
    ctx.moveTo(0, -4); ctx.lineTo(0, -20);
    ctx.moveTo(0, -4); ctx.lineTo(-7, 7); ctx.moveTo(0, -4); ctx.lineTo(7, 7);
    ctx.moveTo(0, -16); ctx.lineTo(-10, -24); ctx.moveTo(0, -16); ctx.lineTo(10, -24);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -26, 5.5, 0, 7); ctx.fillStyle = C.paper; ctx.fill(); ctx.stroke();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y); ctx.lineTo(neck.x, neck.y);              // back
  ctx.moveTo(hip.x, hip.y); ctx.lineTo(5, -12); ctx.lineTo(10, -10);  // legs out front
  ctx.moveTo(neck.x + 0.5, neck.y + 4); ctx.lineTo(7, -19); ctx.lineTo(13, -10); // arm to the rope
  ctx.stroke();
  // rope from hand to the sled's nose
  ctx.lineWidth = 1 * px; ctx.strokeStyle = '#8a5a2b';
  ctx.beginPath(); ctx.moveTo(13, -10); ctx.quadraticCurveTo(16, -8, 15, -9); ctx.stroke();
  // head and bobble hat
  ctx.strokeStyle = C.graphite; ctx.lineWidth = 2 * px;
  ctx.beginPath(); ctx.arc(head.x, head.y, 5.5, 0, 7); ctx.fillStyle = C.paper; ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.pencil;
  ctx.beginPath(); ctx.moveTo(-5.5, head.y - 1.5); ctx.quadraticCurveTo(0, head.y - 11, 5.5, head.y - 1.5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(-1, head.y - 8.5, 2.2, 0, 7); ctx.fill();
  // an eye
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(2.6, head.y + 0.5, 0.9, 0, 7); ctx.fill();
  // scarf
  const flow = Math.min(1, sp / 500);
  ctx.strokeStyle = C.red; ctx.lineWidth = 2.6 * px;
  ctx.beginPath(); ctx.moveTo(neck.x, neck.y);
  const w1 = Math.sin(t * 13) * 2 * flow, w2 = Math.sin(t * 13 + 1.5) * 3 * flow;
  ctx.quadraticCurveTo(neck.x - 7, neck.y + 3 - 3 * flow + w1, neck.x - 6 - 10 * flow, neck.y + 6 - 7 * flow + w2);
  ctx.stroke();
}

function doodle(ctx, kind, seed) {
  const j = i => jig(i, seed) * 3;
  ctx.beginPath();
  switch (kind) {
    case 'star':
      for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 4 / 5; const x = Math.cos(a) * 16 + j(i), y = Math.sin(a) * 16 + j(i + 9); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      break;
    case 'spiral':
      for (let i = 0; i < 60; i++) { const a = i * 0.32, r = i * 0.36; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      break;
    case 'sun':
      ctx.arc(0, 0, 11, 0, 7);
      for (let i = 0; i < 9; i++) { const a = i * 0.7; ctx.moveTo(Math.cos(a) * 16, Math.sin(a) * 16); ctx.lineTo(Math.cos(a) * 24 + j(i), Math.sin(a) * 24 + j(i + 3)); }
      break;
    case 'cat':
      ctx.arc(0, 0, 12, 0.15, Math.PI - 0.15, true);
      ctx.moveTo(-11, -4); ctx.lineTo(-9, -17); ctx.lineTo(-3, -11); ctx.moveTo(3, -11); ctx.lineTo(9, -17); ctx.lineTo(11, -4);
      ctx.moveTo(-5, -2); ctx.arc(-5, -2, 1, 0, 7); ctx.moveTo(5, -2); ctx.arc(5, -2, 1, 0, 7);
      ctx.moveTo(-14, 3); ctx.lineTo(-4, 4); ctx.moveTo(14, 3); ctx.lineTo(4, 4);
      break;
    case 'heart':
      ctx.moveTo(0, 12); ctx.bezierCurveTo(-22, -2, -10, -18, 0, -6); ctx.bezierCurveTo(10, -18, 22, -2, 0, 12);
      break;
    case 'cloud':
      ctx.moveTo(-24, 6); ctx.quadraticCurveTo(-28, -6, -14, -6); ctx.quadraticCurveTo(-10, -18, 2, -12); ctx.quadraticCurveTo(14, -20, 18, -6);
      ctx.quadraticCurveTo(30, -2, 22, 6); ctx.closePath();
      break;
    case 'house':
      ctx.rect(-12, -6, 24, 18); ctx.moveTo(-16, -4); ctx.lineTo(0, -18); ctx.lineTo(16, -4); ctx.rect(-3, 4, 6, 8); ctx.moveTo(8, -12); ctx.lineTo(8, -20); ctx.lineTo(12, -20); ctx.lineTo(12, -9);
      break;
    case 'smiley':
      ctx.arc(0, 0, 13, 0, 7); ctx.moveTo(-4, -4); ctx.arc(-4, -4, 1, 0, 7); ctx.moveTo(5, -4); ctx.arc(4, -4, 1, 0, 7); ctx.moveTo(-6, 3); ctx.quadraticCurveTo(0, 9, 6, 3);
      break;
    case 'plane':
      ctx.moveTo(-18, 0); ctx.lineTo(18, -4); ctx.lineTo(-6, 6); ctx.closePath(); ctx.moveTo(-6, 6); ctx.lineTo(-4, 1);
      break;
    case 'flower':
      for (let i = 0; i < 5; i++) { const a = i * 1.257; ctx.moveTo(0, 0); ctx.ellipse(Math.cos(a) * 8, Math.sin(a) * 8, 7, 4, a, 0, 7); }
      ctx.moveTo(0, 6); ctx.quadraticCurveTo(3, 16, 0, 26);
      break;
    case 'bird':
      ctx.moveTo(-12, 0); ctx.quadraticCurveTo(-6, -7, 0, 0); ctx.quadraticCurveTo(6, -7, 12, 0);
      ctx.moveTo(10, 14); ctx.quadraticCurveTo(14, 9, 18, 14); ctx.quadraticCurveTo(22, 9, 26, 14);
      break;
    case 'tree':
      ctx.moveTo(0, 20); ctx.lineTo(0, 0); ctx.moveTo(-12, 2); ctx.lineTo(0, -22); ctx.lineTo(12, 2); ctx.closePath();
      break;
  }
  ctx.stroke();
}
