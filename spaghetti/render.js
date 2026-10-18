// Drawing: graph paper taped to a corkboard, construction-paper furniture, tasty pasta.
import { MAT, LOADS, compLimit } from './physics.js';

export const COL = {
  cork: '#c99d68', corkDot: '#a77b49', paper: '#fbf8ee', grid: '#d3e6d6', grid2: '#a6cdb2',
  ink: '#2b2623', red: '#e14b3b', blue: '#2f6fbf', yellow: '#f4c534', green: '#3d9a5b', teal: '#2b9c95',
  wood: '#c77b45', woodDk: '#97552a', woodLt: '#dd9a60',
  pasta: '#f4cb6a', pastaDk: '#c48d2c', pastaLt: '#fde7a8', rig: '#eab24f', rigDk: '#b47a22',
  hot: '#e5432e',
};

// ---------- camera ----------
export class Cam {
  constructor() { this.s = 40; this.ox = 0; this.oy = 0; }
  X(x) { return this.ox + x * this.s; }
  Y(y) { return this.oy - y * this.s; }
  wx(X) { return (X - this.ox) / this.s; }
  wy(Y) { return (this.oy - Y) / this.s; }
  world(ctx, dpr) { ctx.setTransform(this.s * dpr, 0, 0, -this.s * dpr, this.ox * dpr, this.oy * dpr); }
}

// deterministic noise so paper edges don't shimmer
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

// ---------- the board ----------
let corkPat = null;
function cork(ctx) {
  if (corkPat) return corkPat;
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = COL.cork; g.fillRect(0, 0, 160, 160);
  for (let i = 0; i < 900; i++) {
    const x = hash(i) * 160, y = hash(i + 999) * 160, r = 0.5 + hash(i + 77) * 1.6;
    g.fillStyle = hash(i + 5) > 0.5 ? 'rgba(120,80,40,.35)' : 'rgba(240,210,160,.35)';
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  corkPat = ctx.createPattern(c, 'repeat');
  return corkPat;
}

export function drawBoard(ctx, cam, lv, W, H, dpr) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = cork(ctx); ctx.fillRect(0, 0, W, H);
  const x0 = cam.X(-0.6), x1 = cam.X(lv.w + 0.6), y0 = cam.Y(lv.h + 0.5), y1 = cam.Y(-1.1);
  // the sheet, a little shadow, masking tape at the corners
  ctx.fillStyle = 'rgba(60,35,10,.28)'; ctx.fillRect(x0 + 5, y0 + 6, x1 - x0, y1 - y0);
  ctx.fillStyle = COL.paper; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
  const s = cam.s;
  // fine and bold rules
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? COL.grid2 : COL.grid; ctx.lineWidth = pass ? 1.2 : 1;
    ctx.beginPath();
    for (let x = -1; x <= lv.w + 1; x++) {
      if ((x % 5 === 0) !== !!pass) continue;
      const X = Math.round(cam.X(x)) + 0.5; ctx.moveTo(X, y0); ctx.lineTo(X, y1);
    }
    for (let y = -1; y <= lv.h + 1; y++) {
      if ((y % 5 === 0) !== !!pass) continue;
      const Y = Math.round(cam.Y(y)) + 0.5; ctx.moveTo(x0, Y); ctx.lineTo(x1, Y);
    }
    ctx.stroke();
  }
  // the classroom floor along the bottom
  const fy = cam.Y(0);
  ctx.fillStyle = '#d9d2bf'; ctx.fillRect(x0, fy, x1 - x0, y1 - fy);
  ctx.fillStyle = '#c4baa1';
  for (let i = -1; i < lv.w + 1; i++) if (i % 2 === 0) ctx.fillRect(cam.X(i), fy, s, y1 - fy);
  ctx.fillStyle = '#8b7f66'; ctx.fillRect(x0, fy, x1 - x0, Math.max(2, s * 0.06));
  ctx.restore();
  // tape
  const tape = (x, y, a) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = 'rgba(238,226,190,.88)'; ctx.fillRect(-26, -9, 52, 18);
    ctx.fillStyle = 'rgba(200,185,140,.35)'; for (let i = -24; i < 26; i += 4) ctx.fillRect(i, -9, 1, 18);
    ctx.restore();
  };
  tape(x0 + 6, y0 + 4, -0.7); tape(x1 - 6, y0 + 4, 0.7);
  return { x0, x1, y0, y1 };
}

// ---------- furniture ----------
function paperShadow(ctx, cam, x, y, w, h) {
  ctx.fillStyle = 'rgba(70,45,20,.22)';
  ctx.fillRect(cam.X(x) + 4, cam.Y(y + h) + 4, w * cam.s, h * cam.s);
}

const BOOKS = ['#2f6fbf', '#e14b3b', '#3d9a5b', '#f4c534', '#8a4fb0', '#e9853a'];

export function drawFurniture(ctx, cam, lv, dpr) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = cam.s;
  lv.boxes.forEach((b, bi) => {
    paperShadow(ctx, cam, b.x, b.y, b.w, b.h);
    const X = cam.X(b.x), Y = cam.Y(b.y + b.h), Wp = b.w * s, Hp = b.h * s;
    if (b.kind === 'desk' || b.kind === 'tall') {
      ctx.fillStyle = COL.wood; ctx.fillRect(X, Y, Wp, Hp);
      ctx.fillStyle = COL.woodLt; ctx.fillRect(X, Y, Wp, s * 0.28);
      ctx.fillStyle = COL.woodDk; ctx.fillRect(X, Y + s * 0.28, Wp, s * 0.06);
      // drawers on the far side from the gap
      const gapLeft = b.x > lv.w / 2;
      const dw = Math.min(Wp - s * 0.6, s * 2.2), dx = gapLeft ? X + Wp - dw - s * 0.3 : X + s * 0.3;
      const rows = Math.max(1, Math.floor((b.h - 1.2) / 1.25));
      for (let r = 0; r < rows; r++) {
        const dy = Y + s * (0.65 + r * 1.25);
        ctx.fillStyle = COL.woodDk; ctx.fillRect(dx, dy, dw, s * 1.0);
        ctx.fillStyle = COL.wood; ctx.fillRect(dx + 2, dy + 2, dw - 4, s * 1.0 - 4);
        ctx.fillStyle = COL.ink; ctx.fillRect(dx + dw / 2 - s * 0.25, dy + s * 0.42, s * 0.5, s * 0.14);
      }
      // a sticker or two, because it's a school
      if (bi === 0) { ctx.fillStyle = COL.yellow; star(ctx, X + Wp * 0.5, Y + Hp - s * 0.9, s * 0.32); }
      ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(X, Y + Hp - s * 0.15, Wp, s * 0.15);
    } else if (b.kind === 'books') {
      const n = Math.round(b.h / 0.5);
      for (let i = 0; i < n; i++) {
        const inset = (hash(i + bi * 9) - 0.5) * s * 0.35;
        const by = cam.Y(b.y + (i + 1) * (b.h / n));
        ctx.fillStyle = BOOKS[(i * 7 + bi) % BOOKS.length];
        ctx.fillRect(X + inset, by, Wp, b.h / n * s - 1);
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.fillRect(X + inset + Wp * 0.15, by + s * 0.12, Wp * 0.5, s * 0.06);
        ctx.fillStyle = '#f3ecd6'; ctx.fillRect(X + inset + Wp - s * 0.12, by + 2, s * 0.12, b.h / n * s - 5);
      }
    } else if (b.kind === 'shelf') {
      ctx.fillStyle = COL.woodDk; ctx.fillRect(X, Y, Wp, Hp);
      ctx.fillStyle = COL.wood; ctx.fillRect(X, Y, Wp, Hp - s * 0.2);
      // a few things on the shelf
      const items = Math.floor(b.w / 2);
      for (let i = 0; i < items; i++) {
        const ix = X + s * (0.4 + i * 2 + hash(i) * 0.6);
        if (i % 3 === 0) { ctx.fillStyle = BOOKS[i % 6]; ctx.fillRect(ix, Y - s * 0.9, s * 0.3, s * 0.9); ctx.fillStyle = BOOKS[(i + 2) % 6]; ctx.fillRect(ix + s * 0.32, Y - s * 0.75, s * 0.28, s * 0.75); }
        else if (i % 3 === 1) { ctx.fillStyle = '#7fb6d9'; ctx.fillRect(ix, Y - s * 0.6, s * 0.7, s * 0.6); ctx.fillStyle = '#5a9a3c'; ctx.fillRect(ix + s * 0.1, Y - s * 0.95, s * 0.12, s * 0.4); ctx.fillRect(ix + s * 0.35, Y - s * 1.05, s * 0.12, s * 0.5); }
        else { ctx.fillStyle = COL.red; ctx.beginPath(); ctx.arc(ix + s * 0.35, Y - s * 0.35, s * 0.35, 0, 7); ctx.fill(); ctx.fillStyle = '#4a8d3a'; ctx.fillRect(ix + s * 0.3, Y - s * 0.85, s * 0.08, s * 0.2); }
      }
    } else if (b.kind === 'lunchbox') {
      ctx.fillStyle = COL.teal; ctx.fillRect(X, Y, Wp, Hp);
      ctx.fillStyle = '#20746f'; ctx.fillRect(X, Y + Hp * 0.35, Wp, s * 0.1);
      ctx.strokeStyle = '#20746f'; ctx.lineWidth = s * 0.12;
      ctx.beginPath(); ctx.moveTo(X + Wp * 0.3, Y); ctx.lineTo(X + Wp * 0.3, Y - s * 0.3); ctx.lineTo(X + Wp * 0.7, Y - s * 0.3); ctx.lineTo(X + Wp * 0.7, Y); ctx.stroke();
      ctx.fillStyle = COL.yellow; star(ctx, X + Wp * 0.5, Y + Hp * 0.68, s * 0.3);
    }
  });
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}

export function drawFlags(ctx, cam, lv, dpr) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = cam.s;
  const fx = cam.X(lv.finish), fyb = cam.Y(deskTopAt(lv, lv.finish));
  ctx.strokeStyle = COL.ink; ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.beginPath(); ctx.moveTo(fx, fyb); ctx.lineTo(fx, fyb - s * 1.6); ctx.stroke();
  const fw = s * 0.9, fh = s * 0.6;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    ctx.fillStyle = (i + j) % 2 ? COL.ink : '#fff';
    ctx.fillRect(fx + i * fw / 3, fyb - s * 1.6 + j * fh / 2, fw / 3, fh / 2);
  }
  ctx.strokeRect(fx, fyb - s * 1.6, fw, fh);
}

function deskTopAt(lv, x) {
  let top = 0;
  for (const b of lv.boxes) if (x >= b.x && x <= b.x + b.w && b.y === 0) top = Math.max(top, b.h);
  return top;
}

export function drawPins(ctx, cam, lv, dpr, used) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const s = cam.s, r = Math.max(5, s * 0.17);
  for (const [x, y] of lv.anchors) {
    const X = cam.X(x), Y = cam.Y(y);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(X + r * 0.35, Y + r * 0.4, r, 0, 7); ctx.fill();
    ctx.fillStyle = COL.red; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(X - r * 0.32, Y - r * 0.32, r * 0.32, 0, 7); ctx.fill();
  }
}

// ---------- pasta ----------
export function stressColor(base, st) {
  if (st <= 0.3) return base;
  const k = Math.min(1, (st - 0.3) / 0.6);
  return mix(base, COL.hot, k);
}
function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = ((pa >> 16) & 255) * (1 - k) + ((pb >> 16) & 255) * k;
  const g = ((pa >> 8) & 255) * (1 - k) + ((pb >> 8) & 255) * k;
  const bl = (pa & 255) * (1 - k) + (pb & 255) * k;
  return `rgb(${r | 0},${g | 0},${bl | 0})`;
}

// draw one piece of pasta between (ax,ay) and (bx,by) in world units; ctx has the world transform
export function drawPasta(ctx, mat, ax, ay, bx, by, opt = {}) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
  if (L < 1e-4) return;
  const st = opt.stress || 0, alpha = opt.alpha ?? 1, seed = opt.seed || 0;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(ax, ay); ctx.rotate(Math.atan2(dy, dx));
  if (mat === 'spaghetti') {
    ctx.lineCap = 'round';
    ctx.strokeStyle = stressColor(COL.pastaDk, st); ctx.lineWidth = 0.11;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0); ctx.stroke();
    ctx.strokeStyle = stressColor(COL.pasta, st); ctx.lineWidth = 0.07;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,248,220,.7)'; ctx.lineWidth = 0.018;
    ctx.beginPath(); ctx.moveTo(0.05, 0.015); ctx.lineTo(L - 0.05, 0.015); ctx.stroke();
  } else if (mat === 'rigatoni') {
    const w = 0.3, h = w / 2;
    ctx.fillStyle = stressColor(COL.rigDk, st);
    ctx.fillRect(-0.02, -h - 0.02, L + 0.04, w + 0.04);
    ctx.fillStyle = stressColor(COL.rig, st);
    ctx.fillRect(0, -h, L, w);
    ctx.strokeStyle = stressColor(COL.rigDk, st); ctx.lineWidth = 0.025;
    ctx.beginPath();
    for (const o of [-0.08, 0, 0.08]) { ctx.moveTo(0.04, o); ctx.lineTo(L - 0.04, o); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,200,.5)'; ctx.fillRect(0.04, -h + 0.03, L - 0.08, 0.035);
    // the tube's open ends
    ctx.fillStyle = '#8a5a18';
    for (const ex of [0, L]) { ctx.beginPath(); ctx.ellipse(ex, 0, 0.045, h * 0.8, 0, 0, 7); ctx.fill(); }
  } else {
    const h = 0.14, n = Math.max(8, Math.round(L * 18));
    const ruff = i => 0.032 * Math.sin(i * 1.15 + seed);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) ctx.lineTo(L * i / n, h + ruff(i));
    for (let i = n; i >= 0; i--) ctx.lineTo(L * i / n, -h - ruff(i + 3));
    ctx.closePath();
    ctx.fillStyle = stressColor(COL.pasta, st); ctx.fill();
    ctx.strokeStyle = stressColor(COL.pastaDk, st); ctx.lineWidth = 0.035; ctx.stroke();
    ctx.strokeStyle = 'rgba(196,141,44,.45)'; ctx.lineWidth = 0.02;
    ctx.beginPath(); ctx.moveTo(0.05, 0.05); ctx.lineTo(L - 0.05, 0.05); ctx.moveTo(0.05, -0.05); ctx.lineTo(L - 0.05, -0.05); ctx.stroke();
  }
  if (opt.jag != null) {
    // a snapped end
    const x = opt.jag === 'b' ? L : 0, d = opt.jag === 'b' ? 1 : -1, hh = mat === 'spaghetti' ? 0.05 : mat === 'rigatoni' ? 0.17 : 0.16;
    ctx.fillStyle = COL.pastaLt;
    ctx.beginPath(); ctx.moveTo(x, -hh);
    for (let i = 0; i <= 4; i++) ctx.lineTo(x + d * (i % 2 ? 0.07 : 0), -hh + i * hh / 2);
    ctx.lineTo(x - d * 0.04, hh); ctx.lineTo(x - d * 0.04, -hh); ctx.fill();
  }
  ctx.restore();
}

export function drawGlue(ctx, x, y, r = 0.12) {
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(120,120,110,.6)'; ctx.lineWidth = 0.025; ctx.stroke();
  ctx.fillStyle = 'rgba(200,220,230,.7)'; ctx.beginPath(); ctx.arc(x + r * 0.3, y + r * 0.3, r * 0.3, 0, 7); ctx.fill();
}

// the order pasta is drawn in: sticks behind, road on top
const ORDER = { spaghetti: 0, rigatoni: 1, lasagne: 2 };

export function drawDesign(ctx, cam, members, dpr, opt = {}) {
  cam.world(ctx, dpr);
  const sorted = members.map((m, i) => [m, i]).sort((a, b) => ORDER[a[0].mat] - ORDER[b[0].mat]);
  for (const [m, i] of sorted) drawPasta(ctx, m.mat, m.a[0], m.a[1], m.b[0], m.b[1], { seed: i, alpha: opt.dim && opt.dim(m) ? 0.35 : 1 });
  const seen = new Set(), anchorSet = opt.anchors;
  for (const m of members) for (const p of [m.a, m.b]) {
    const k = p[0] + ',' + p[1];
    if (seen.has(k) || (anchorSet && anchorSet.has(k))) continue;
    seen.add(k); drawGlue(ctx, p[0], p[1]);
  }
}

export function drawSim(ctx, cam, sim, dpr) {
  cam.world(ctx, dpr);
  const cs = sim.cs.filter(c => c.mat && !c.broken).sort((a, b) => ORDER[a.mat.key] - ORDER[b.mat.key]);
  cs.forEach((c, i) => {
    const A = sim.ps[c.a], B = sim.ps[c.b];
    drawPasta(ctx, c.mat.key, A.x, A.y, B.x, B.y, { stress: sim.stress(c), seed: i, jag: c.debris ? c.jag : null });
  });
  const joints = new Set();
  for (const c of sim.cs) if (c.mat && !c.broken) { joints.add(c.a); if (!c.debris) joints.add(c.b); else if (c.jag === 'a') joints.add(c.b); }
  for (const i of joints) {
    const p = sim.ps[i];
    if (p.fixed || p.wheel) continue;
    drawGlue(ctx, p.x, p.y);
  }
}

// ---------- the loads ----------
export function drawLoads(ctx, cam, sim, dpr, t) {
  for (const L of sim.loads) {
    if (L.state === 'done') continue;
    const P = sim.loadPose(L);
    drawLoadAt(ctx, cam, dpr, L.kind, P.x, P.y, P.ang, t, -(P.x / L.def.r));
  }
}

export function drawLoadAt(ctx, cam, dpr, kind, x, y, ang, t, spin = 0) {
  cam.world(ctx, dpr);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  const r = LOADS[kind].r;
  if (kind === 'car') drawCar(ctx, r, spin);
  else if (kind === 'books') drawBooks(ctx, r, spin);
  else if (kind === 'tray') drawTray(ctx, r, spin);
  else if (kind === 'hamster') drawHamster(ctx, r, spin, t);
  else if (kind === 'bowling') drawBowling(ctx, r, spin);
  ctx.restore();
}

function wheel(ctx, x, r, spin) {
  ctx.fillStyle = '#26221f'; ctx.beginPath(); ctx.arc(x, 0, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#bfb8ae'; ctx.beginPath(); ctx.arc(x, 0, r * 0.45, 0, 7); ctx.fill();
  ctx.strokeStyle = '#26221f'; ctx.lineWidth = r * 0.15;
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + Math.cos(spin) * r * 0.45, Math.sin(spin) * r * 0.45); ctx.stroke();
}

function drawCar(ctx, r, spin) {
  ctx.fillStyle = COL.red;
  ctx.beginPath();
  ctx.moveTo(-0.85, 0.05); ctx.lineTo(-0.85, 0.38); ctx.lineTo(-0.4, 0.42); ctx.lineTo(-0.22, 0.72); ctx.lineTo(0.3, 0.72); ctx.lineTo(0.5, 0.42); ctx.lineTo(0.85, 0.36); ctx.lineTo(0.85, 0.05);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#bfe3f2';
  ctx.fillRect(-0.16, 0.44, 0.2, 0.22); ctx.beginPath(); ctx.moveTo(0.1, 0.44); ctx.lineTo(0.42, 0.44); ctx.lineTo(0.27, 0.66); ctx.lineTo(0.1, 0.66); ctx.fill();
  ctx.fillStyle = COL.yellow; ctx.fillRect(0.74, 0.2, 0.1, 0.08);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-0.45, 0.22, 0.1, 0, 7); ctx.fill();
  ctx.fillStyle = COL.ink; ctx.font = 'bold 0.16px sans-serif';
  ctx.save(); ctx.scale(1, -1); ctx.textAlign = 'center'; ctx.fillText('7', -0.45, -0.17); ctx.restore();
  wheel(ctx, -0.5, r, spin); wheel(ctx, 0.5, r, spin);
}

function drawBooks(ctx, r, spin) {
  ctx.fillStyle = '#8a6a48'; ctx.fillRect(-0.95, 0.05, 1.9, 0.16);
  const cols = ['#2f6fbf', '#3d9a5b', '#e14b3b', '#f4c534'];
  const ws = [1.7, 1.5, 1.6, 1.3];
  let y = 0.21;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = cols[i]; ctx.fillRect(-ws[i] / 2 + (i % 2 ? 0.08 : -0.05), y, ws[i], 0.24);
    ctx.fillStyle = '#f3ecd6'; ctx.fillRect(-ws[i] / 2 + (i % 2 ? 0.08 : -0.05) + 0.05, y + 0.04, ws[i] - 0.1, 0.04);
    y += 0.25;
  }
  ctx.strokeStyle = '#444'; ctx.lineWidth = 0.04;
  ctx.beginPath(); ctx.moveTo(-0.95, 0.12); ctx.lineTo(-1.25, 0.5); ctx.stroke();
  wheel(ctx, -0.65, r, spin); wheel(ctx, 0.65, r, spin);
}

function drawTray(ctx, r, spin) {
  // skateboard
  ctx.fillStyle = '#3a3a8a'; ctx.beginPath(); ctx.roundRect(-1.05, 0.08, 2.1, 0.12, 0.06); ctx.fill();
  // tray
  ctx.fillStyle = '#7fa7c9'; ctx.fillRect(-1.0, 0.2, 2.0, 0.1);
  ctx.fillRect(-1.0, 0.2, 0.06, 0.2); ctx.fillRect(0.94, 0.2, 0.06, 0.2);
  // lunch: a bowl of pasta (naturally), a carton, an apple
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-0.45, 0.32, 0.32, Math.PI, 0, true); ctx.fill();
  ctx.fillStyle = COL.pasta; ctx.beginPath(); ctx.ellipse(-0.45, 0.62, 0.3, 0.12, 0, 0, 7); ctx.fill();
  ctx.fillStyle = COL.red; for (const x of [-0.55, -0.38]) { ctx.beginPath(); ctx.arc(x, 0.68, 0.06, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.fillRect(0.1, 0.3, 0.3, 0.45); ctx.fillStyle = COL.blue; ctx.fillRect(0.1, 0.45, 0.3, 0.12);
  ctx.fillStyle = COL.green; ctx.beginPath(); ctx.arc(0.68, 0.48, 0.17, 0, 7); ctx.fill();
  wheel(ctx, -0.8, r, spin); wheel(ctx, 0.8, r, spin);
}

function drawHamster(ctx, r, spin, t) {
  // the ball
  ctx.fillStyle = 'rgba(190,225,240,.45)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  // Biscuit, running
  const bob = Math.sin(t * 22) * 0.025;
  ctx.fillStyle = '#e9a75c'; ctx.beginPath(); ctx.ellipse(0.02, -0.12 + bob, 0.26, 0.19, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#fbe6c4'; ctx.beginPath(); ctx.ellipse(0.12, -0.18 + bob, 0.14, 0.1, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#e9a75c'; ctx.beginPath(); ctx.arc(-0.05, 0.04 + bob, 0.07, 0, 7); ctx.fill();
  ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(0.18, -0.06 + bob, 0.03, 0, 7); ctx.fill();
  ctx.fillStyle = '#e57f8a'; ctx.beginPath(); ctx.arc(0.28, -0.12 + bob, 0.025, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 0.04;
  ctx.beginPath(); ctx.arc(0, 0, r - 0.02, 0, 7); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 1.8 + spin * 0.0, 2.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(110,160,190,.55)'; ctx.lineWidth = 0.025;
  for (let i = 0; i < 3; i++) { const a = spin + i * 2.09; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); }
}

function drawBowling(ctx, r, spin) {
  ctx.fillStyle = '#20325e'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(-r * 0.3, r * 0.35, r * 0.35, 0, 7); ctx.fill();
  ctx.fillStyle = '#0c1430';
  for (const [a, d] of [[0, 0.45], [0.45, 0.5], [-0.35, 0.55]]) {
    ctx.beginPath(); ctx.arc(Math.cos(spin + a) * r * d, Math.sin(spin + a) * r * d, r * 0.1, 0, 7); ctx.fill();
  }
}

// little pictures for the tray buttons and cards
export function loadIcon(kind) {
  const c = document.createElement('canvas'), S = 96;
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.setTransform(S / 2.6, 0, 0, -S / 2.6, S / 2, S * 0.68);
  const r = LOADS[kind].r;
  if (kind === 'car') drawCar(g, r, 0);
  else if (kind === 'books') drawBooks(g, r, 0);
  else if (kind === 'tray') drawTray(g, r, 0);
  else if (kind === 'hamster') { g.translate(0, r); drawHamster(g, r, 0.3, 0); }
  else if (kind === 'bowling') { g.translate(0, r); drawBowling(g, r, 0.4); }
  return c.toDataURL();
}

export function pastaIcon(mat, w = 120, h = 48) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const s = h / 1.1;
  g.setTransform(s, 0, 0, -s, 0, h / 2);
  const len = w / s;
  if (mat === 'spaghetti') { drawPasta(g, mat, 0.12, -0.15, len - 0.12, 0.15); drawPasta(g, mat, 0.12, 0.05, len - 0.12, -0.12); }
  else drawPasta(g, mat, 0.18, 0, len - 0.18, 0);
  return c.toDataURL();
}

export { compLimit, MAT };
