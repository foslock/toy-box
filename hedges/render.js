// Drawing the garden from above: raked gravel walks on the lattice, striped lawn
// beds in the cells, clipped yew for hedges, and stone, pebble and flower details.

export const C = {
  terrace: '#c9bc9b', gravel: '#ddd2b7', gravelDark: '#b9ab88', lawn: '#6f9b4b', lawn2: '#79a554', lawnEdge: '#4f7535',
  yew: '#2c4725', yewOld: '#253d20', yewHi: '#4f7a3a', yewHi2: '#6f9a4c', shadow: 'rgba(28,36,14,.38)',
  stone: '#efe8d6', stoneDark: '#b7aa88', ink: '#2a3522', glow: '#fff4cf', bad: '#d8432f',
  rose: '#df6a58', roseDark: '#a94436', heart: '#f2c24f', slate: '#3b4147', marble: '#f5f2ea', stud: '#3a3a30', water: '#5f8f9a',
};

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// a speckled tile for gravel
const tiles = {};
export function speckle(name, base, dots, density = 0.5, size = 96) {
  if (tiles[name]) return tiles[name];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  const R = rng(name.length * 977 + size);
  const n = Math.floor(size * size * density / 10);
  for (let i = 0; i < n; i++) {
    g.fillStyle = dots[Math.floor(R() * dots.length)];
    g.globalAlpha = 0.35 + R() * 0.4;
    const r = 0.5 + R() * 1.1;
    g.beginPath(); g.arc(R() * size, R() * size, r, 0, 7); g.fill();
  }
  return (tiles[name] = c);
}

// ---- polylines in pixels
export function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
export function cut(pts, L) { // the first L pixels of a polyline
  if (L <= 0) return [pts[0]];
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const d = Math.hypot(bx - ax, by - ay);
    if (L <= d) { out.push([ax + (bx - ax) * (L / d), ay + (by - ay) * (L / d)]); return out; }
    L -= d; out.push(pts[i]);
  }
  return out;
}
function strokePts(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (pts.length === 1) ctx.lineTo(pts[0][0] + 0.01, pts[0][1]);
  ctx.stroke();
}

// Clipped yew: a shadow, a dark body, then leaf clumps lit from the top left.
// `upto` draws only the first part (for planting), `ball` adds a topiary ball at the start.
export function hedge(ctx, pts, w, seed, { old = false, upto = Infinity, ball = false, alpha = 1 } = {}) {
  const total = polyLen(pts);
  const p = upto < total ? cut(pts, upto) : pts;
  const L = Math.min(upto, total);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.translate(w * 0.1, w * 0.2);
  ctx.strokeStyle = C.shadow; ctx.lineWidth = w * 1.06;
  strokePts(ctx, p);
  if (ball) { ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], w * 0.78, 0, 7); ctx.fill(); }
  ctx.translate(-w * 0.1, -w * 0.2);
  ctx.strokeStyle = old ? C.yewOld : C.yew; ctx.lineWidth = w;
  strokePts(ctx, p);
  // clumps: placed along the line by distance so a growing hedge never reshuffles
  const R = rng(seed);
  const step = w * 0.2;
  const hi = old ? ['#355a2c', '#3f6634', '#4a7139'] : ['#3c6531', '#4b7839', '#5a8843'];
  const lo = old ? '#1d321a' : '#22391e';
  let seg = 1, segStart = 0;
  for (let d = 0; d <= L; d += step) {
    while (seg < p.length - 1 && d > segStart + Math.hypot(p[seg][0] - p[seg - 1][0], p[seg][1] - p[seg - 1][1])) {
      segStart += Math.hypot(p[seg][0] - p[seg - 1][0], p[seg][1] - p[seg - 1][1]); seg++;
    }
    const [ax, ay] = p[seg - 1], [bx, by] = p[Math.min(seg, p.length - 1)];
    const dl = Math.hypot(bx - ax, by - ay) || 1;
    const t = Math.min(1, (d - segStart) / dl);
    const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    for (let k = 0; k < 3; k++) {
      const ox = (R() - 0.5) * w * 0.62, oy = (R() - 0.5) * w * 0.62, r = w * (0.13 + R() * 0.11);
      const lit = -(ox + oy) / (w * 0.62);
      ctx.fillStyle = lit > 0.25 ? hi[2] : lit > -0.15 ? hi[1] : lit > -0.45 ? hi[0] : lo;
      ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, 7); ctx.fill();
    }
  }
  // a sheen on the lit side
  ctx.globalAlpha = alpha * 0.28;
  ctx.strokeStyle = '#9cc275'; ctx.lineWidth = w * 0.22;
  ctx.translate(-w * 0.17, -w * 0.2);
  strokePts(ctx, p);
  ctx.restore();
  if (ball) topiary(ctx, pts[0][0], pts[0][1], w * 0.72, seed + 7, alpha);
}

export function topiary(ctx, x, y, r, seed, alpha = 1) {
  const R = rng(seed);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = C.yew; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  for (let i = 0; i < 26; i++) {
    const a = R() * 7, d = Math.sqrt(R()) * r * 0.78, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
    const lit = -(Math.cos(a) + Math.sin(a)) * d / r;
    ctx.fillStyle = lit > 0.35 ? '#5f9047' : lit > 0 ? '#4b7839' : lit > -0.4 ? '#3c6531' : '#22391e';
    ctx.beginPath(); ctx.arc(cx, cy, r * (0.2 + R() * 0.12), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle = '#a8cf7e';
  ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.38, r * 0.2, 0, 7); ctx.fill();
  ctx.restore();
}

// ---- symbols
export function stud(ctx, x, y, s, lit) {
  const r = s * 0.085;
  ctx.save();
  ctx.fillStyle = lit ? C.glow : C.stud;
  if (lit) { ctx.shadowColor = C.glow; ctx.shadowBlur = s * 0.2; }
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function pebble(ctx, x, y, s, black) {
  const r = s * 0.17;
  ctx.save();
  ctx.fillStyle = 'rgba(30,40,20,.35)';
  ctx.beginPath(); ctx.ellipse(x + r * 0.18, y + r * 0.3, r * 1.02, r * 0.92, 0, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  if (black) { g.addColorStop(0, '#6b737b'); g.addColorStop(0.55, C.slate); g.addColorStop(1, '#1d2125'); }
  else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, C.marble); g.addColorStop(1, '#bdb5a4'); }
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.9, -0.3, 0, 7); ctx.fill();
  ctx.restore();
}

export function flower(ctx, x, y, s, n) {
  const L = s * 0.2, W = s * 0.095;
  ctx.save();
  ctx.translate(x, y);
  // leaves under the bloom
  ctx.fillStyle = '#3f6a2f';
  for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(0, 0, s * 0.05, s * 0.2, Math.PI / 4 + i * Math.PI / 2, 0, 7); ctx.fill(); }
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / n);
    ctx.save(); ctx.rotate(a);
    ctx.fillStyle = 'rgba(40,30,20,.28)';
    ctx.beginPath(); ctx.ellipse(L * 0.62 + 1.5, 2, L * 0.55, W, 0, 0, 7); ctx.fill();
    const g = ctx.createLinearGradient(0, 0, L * 1.2, 0);
    g.addColorStop(0, C.roseDark); g.addColorStop(0.5, C.rose); g.addColorStop(1, '#f39a86');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(L * 0.6, 0, L * 0.58, W, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = C.heart; ctx.beginPath(); ctx.arc(0, 0, s * 0.055, 0, 7); ctx.fill();
  ctx.fillStyle = '#b88a22'; ctx.beginPath(); ctx.arc(s * 0.012, s * 0.014, s * 0.025, 0, 7); ctx.fill();
  ctx.restore();
}

export function plinth(ctx, x, y, s, { glow = 0, dead = false, lit = false } = {}) {
  const r = s * 0.25;
  ctx.save();
  if (glow > 0) {
    ctx.fillStyle = `rgba(255,244,207,${0.32 * glow})`;
    ctx.beginPath(); ctx.arc(x, y, r * (1.45 + glow * 0.25), 0, 7); ctx.fill();
  }
  ctx.fillStyle = 'rgba(30,40,20,.35)';
  ctx.beginPath(); ctx.arc(x + r * 0.12, y + r * 0.22, r, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, dead ? '#cfc8b8' : '#fffaf0'); g.addColorStop(1, dead ? '#9c9585' : '#cfc3a4');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = dead ? '#7d7768' : '#a39572'; ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, 7); ctx.stroke();
  if (lit) { ctx.fillStyle = C.glow; ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, 7); ctx.fill(); }
  if (dead) {
    ctx.strokeStyle = '#6d6757'; ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.2); ctx.lineTo(x - r * 0.1, y + r * 0.05); ctx.lineTo(x + r * 0.2, y - r * 0.3); ctx.lineTo(x + r * 0.65, y + r * 0.1); ctx.stroke();
  }
  ctx.restore();
}

export function urn(ctx, x, y, r, seed) {
  ctx.save();
  ctx.fillStyle = 'rgba(30,40,20,.35)';
  ctx.beginPath(); ctx.arc(x + r * 0.15, y + r * 0.25, r, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#f8f2e4'); g.addColorStop(1, '#b9ad8c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#8a7d5e'; ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, 7); ctx.fill();
  ctx.restore();
  // a clipped box ball planted in it, with a few pink flowers
  topiary(ctx, x, y, r * 0.66, seed);
  const R = rng(seed + 3);
  for (let i = 0; i < 5; i++) {
    const a = R() * 7, d = r * 0.4 * R();
    ctx.fillStyle = i % 2 ? '#f0a3b4' : '#fbe6ea';
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.07, 0, 7); ctx.fill();
  }
}

// ---- the title, planted in yew on a 2×4 lattice per letter
export const LETTERS = {
  H: [[[0, 0], [0, 4]], [[2, 0], [2, 4]], [[0, 2], [2, 2]]],
  E: [[[2, 0], [0, 0], [0, 4], [2, 4]], [[0, 2], [1.4, 2]]],
  D: [[[0, 0], [1, 0], [2, 1], [2, 3], [1, 4], [0, 4], [0, 0]]],
  G: [[[2, 0.4], [2, 0], [0, 0], [0, 4], [2, 4], [2, 2], [1.1, 2]]],
  S: [[[2, 0], [0, 0], [0, 2], [2, 2], [2, 4], [0, 4]]],
};
