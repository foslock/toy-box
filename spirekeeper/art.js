// Spire Keeper — everything is chalk on a slate.
// A Pen draws wobbly, doubled strokes; grain() knocks dusty holes out of them.
// Monsters are drawn once per "boil" frame and cached, then cycled so the lines shimmer.
import { rng } from './sim.js';

export const INK = {
  white: '#f2efe6', dim: '#a9aea6', yellow: '#f4d775', pink: '#f4a3b8', blue: '#93cdf2',
  green: '#a9e39d', orange: '#f6ad62', red: '#f27c6c', lilac: '#c9adf2', slate: '#28302c',
};

// ---------------------------------------------------------------- grain
let grainPat = null;
function grainCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const R = rng(77);
  const img = x.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) {
    const v = R();
    img.data[i * 4 + 3] = v < 0.18 ? 255 * (0.5 + R() * 0.5) : v < 0.4 ? 90 * R() : 0;
  }
  x.putImageData(img, 0, 0);
  // a few horizontal drag-gaps, like chalk skipping over the slate
  x.fillStyle = 'rgba(0,0,0,.55)';
  for (let i = 0; i < 26; i++) x.fillRect(R() * 128, R() * 128, 2 + R() * 9, 1);
  return c;
}
export function grain(ctx, w, h, strength = 1) {
  if (!grainPat) grainPat = ctx.createPattern(grainCanvas(), 'repeat');
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = strength;
  ctx.fillStyle = grainPat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
// a grain image for CSS masks (white = keep)
export function grainMaskURL() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128);
  x.globalCompositeOperation = 'destination-out';
  x.globalAlpha = 0.8;
  x.drawImage(grainCanvas(), 0, 0);
  return c.toDataURL();
}

// ---------------------------------------------------------------- pen
export class Pen {
  constructor(ctx, seed = 1, o = {}) {
    this.c = ctx; this.r = rng(seed);
    this.color = o.color || INK.white; this.w = o.w || 3; this.wob = o.wob ?? 1.1;
  }
  set(color, w) { if (color) this.color = color; if (w) this.w = w; return this; }
  // draw a polyline with wobble; two passes so it reads as chalk, not vector
  path(pts, closed = false) {
    const res = resample(closed ? [...pts, pts[0]] : pts, 4);
    if (closed) { // chalk loops overshoot a little
      const extra = Math.min(res.length - 1, 3 + this.r.int(4));
      for (let i = 1; i <= extra; i++) res.push(res[i]);
    }
    const c = this.c, R = this.r;
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      const ph = R() * 6.28, fr = 0.18 + R() * 0.2, amp = this.wob * (pass ? 0.8 : 1);
      c.beginPath();
      for (let i = 0; i < res.length; i++) {
        const [x, y, nx, ny] = res[i];
        const o = Math.sin(i * fr + ph) * amp + (R() - 0.5) * amp * 0.7;
        const X = x + nx * o, Y = y + ny * o;
        i ? c.lineTo(X, Y) : c.moveTo(X, Y);
      }
      c.strokeStyle = this.color;
      c.globalAlpha = pass ? 0.95 : 0.5;
      c.lineWidth = pass ? this.w * 0.62 : this.w;
      c.stroke();
    }
    c.globalAlpha = 1;
    return this;
  }
  line(x1, y1, x2, y2) { return this.path([[x1, y1], [x2, y2]]); }
  curve(pts, closed = false) { return this.path(smooth(pts, closed), false); }
  ellipse(cx, cy, rx, ry, rot = 0, a0 = 0, a1 = Math.PI * 2) {
    const n = Math.max(10, Math.round((rx + ry) * 0.5 * Math.abs(a1 - a0) / 4));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n;
      const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    const full = Math.abs(a1 - a0) >= 6.28;
    return this.path(full ? pts.slice(0, -1) : pts, full);
  }
  circle(cx, cy, r) { return this.ellipse(cx, cy, r, r); }
  rect(x, y, w, h) { return this.path([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true); }
  // scribbled dot
  dot(x, y, r = 3) {
    const c = this.c; c.fillStyle = this.color; c.globalAlpha = 0.9;
    c.beginPath(); c.arc(x + (this.r() - 0.5), y + (this.r() - 0.5), r, 0, 6.29); c.fill(); c.globalAlpha = 1;
    return this;
  }
  // hatch-fill a closed shape (points or a Path2D builder) with angled chalk strokes
  hatch(pts, { color, gap = 6, angle = -0.9, w = 2, alpha = 0.7 } = {}) {
    const c = this.c;
    const poly = Array.isArray(pts) ? pts : null;
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const [x, y] of poly) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    c.save();
    c.beginPath(); poly.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.clip();
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, L = Math.hypot(maxX - minX, maxY - minY) / 2 + 4;
    const dx = Math.cos(angle), dy = Math.sin(angle), px = -dy, py = dx;
    const old = [this.color, this.w, this.wob];
    this.color = color || this.color; this.w = w; this.wob = 0.8;
    c.globalAlpha = alpha;
    for (let t = -L; t <= L; t += gap * (0.8 + this.r() * 0.45)) {
      const ox = cx + px * t, oy = cy + py * t;
      const s = L * (0.92 + this.r() * 0.1);
      this._raw(ox - dx * s, oy - dy * s, ox + dx * s, oy + dy * s, alpha);
    }
    [this.color, this.w, this.wob] = old;
    c.restore();
    return this;
  }
  _raw(x1, y1, x2, y2, alpha) {
    const c = this.c;
    c.beginPath(); c.moveTo(x1, y1);
    const mx = (x1 + x2) / 2 + (this.r() - 0.5) * 2, my = (y1 + y2) / 2 + (this.r() - 0.5) * 2;
    c.quadraticCurveTo(mx, my, x2, y2);
    c.strokeStyle = this.color; c.lineWidth = this.w; c.globalAlpha = alpha * (0.6 + this.r() * 0.4); c.stroke();
    c.globalAlpha = 1;
  }
  ellipsePts(cx, cy, rx, ry, n = 28) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p; }
  text(str, x, y, size, { color, align = 'center', font = 'Kalam', weight = 700, base = 'middle' } = {}) {
    const c = this.c;
    c.font = `${weight} ${size}px ${font}, 'Comic Sans MS', cursive`;
    c.textAlign = align; c.textBaseline = base;
    c.fillStyle = color || this.color;
    c.globalAlpha = 0.55; c.fillText(str, x + 0.8, y + 0.6);
    c.globalAlpha = 1; c.fillText(str, x, y);
  }
}

function resample(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const L = Math.hypot(x2 - x1, y2 - y1) || 1;
    const n = Math.max(1, Math.ceil(L / step));
    const nx = -(y2 - y1) / L, ny = (x2 - x1) / L;
    for (let k = 0; k < n; k++) { const t = k / n; out.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, nx, ny]); }
  }
  const [lx, ly] = pts[pts.length - 1];
  const prev = out[out.length - 1] || [lx, ly, 0, 1];
  out.push([lx, ly, prev[2], prev[3]]);
  return out;
}
// Catmull-Rom through points
function smooth(pts, closed) {
  const out = [], n = pts.length;
  const P = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < 8; k++) {
      const t = k / 8, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(closed ? pts[0] : pts[n - 1]);
  return out;
}

// ---------------------------------------------------------------- slate
export function drawSlate(ctx, w, h, seed = 3) {
  const R = rng(seed);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#2c3631'); g.addColorStop(1, '#212924');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // old eraser smears
  for (let i = 0; i < 22; i++) {
    const x = R() * w, y = R() * h, r = 60 + R() * 220;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(220,230,220,${0.025 + R() * 0.035})`); rg.addColorStop(1, 'rgba(220,230,220,0)');
    ctx.fillStyle = rg;
    ctx.save(); ctx.translate(x, y); ctx.scale(1.8, 0.6); ctx.translate(-x, -y);
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill(); ctx.restore();
  }
  // ghost scribbles of old lessons
  const p = new Pen(ctx, seed + 9, { color: 'rgba(230,235,225,.05)', w: 2.2, wob: 1.6 });
  for (let i = 0; i < 9; i++) {
    const x = R() * w, y = R() * h;
    const pts = []; for (let k = 0; k < 6; k++) pts.push([x + k * (14 + R() * 18), y + (R() - 0.5) * 22]);
    p.curve(pts);
  }
  // fine speckle
  ctx.fillStyle = 'rgba(255,255,255,.035)';
  for (let i = 0; i < w * h / 900; i++) ctx.fillRect(R() * w, R() * h, 1, 1);
}

// ---------------------------------------------------------------- 9-slice chalk frames for CSS border-image
export function frameURL(color = INK.white, seed = 1, size = 120, inset = 10, w = 3) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const p = new Pen(x, seed, { color, w, wob: 1.3 });
  const a = inset, b = size - inset;
  // corners overshoot, like a hand-drawn box
  p.line(a - 6, a + 1, b + 5, a - 1);
  p.line(b, a - 6, b + 1, b + 6);
  p.line(b + 6, b, a - 5, b + 1);
  p.line(a, b + 5, a - 1, a - 6);
  grain(x, size, size, 0.85);
  return c.toDataURL();
}

// ---------------------------------------------------------------- icons (sword, shield, up, down, heart, drop, zzz)
const iconCache = {};
export function icon(kind, color, px = 28, dpr = 2) {
  const key = kind + color + px + dpr;
  if (iconCache[key]) return iconCache[key];
  const c = document.createElement('canvas'); c.width = c.height = Math.round(px * dpr);
  const x = c.getContext('2d'); x.scale(c.width / 32, c.height / 32);
  const p = new Pen(x, kind.length * 7 + 3, { color, w: 2.6, wob: 0.5 });
  drawIcon(p, kind);
  grain(x, 32, 32, 0.4);
  return (iconCache[key] = c);
}
export function drawIcon(p, kind) {
  switch (kind) {
    case 'atk': p.line(7, 25, 24, 8); p.line(20, 6, 26, 12); p.line(10, 18, 14, 22); p.line(5, 27, 9, 23); break;
    case 'def': p.path([[16, 4], [27, 8], [25, 19], [16, 28], [7, 19], [5, 8]], true); p.line(16, 8, 16, 23); break;
    case 'buff': p.line(16, 27, 16, 6); p.path([[8, 13], [16, 5], [24, 13]]); break;
    case 'debuff': p.ellipse(16, 15, 9, 8); p.dot(12.5, 14, 1.6); p.dot(19.5, 14, 1.6); p.path([[11, 27], [13, 22], [16, 27], [19, 22], [21, 27]]); break;
    case 'heal': p.curve([[16, 27], [5, 16], [7, 7], [16, 11], [25, 7], [27, 16], [16, 27]]); break;
    case 'poison': p.curve([[16, 4], [9, 17], [11, 25], [16, 27], [21, 25], [23, 17], [16, 4]]); p.dot(13, 19, 1.5); break;
    case 'sleep': p.path([[6, 9], [14, 9], [6, 17], [14, 17]]); p.path([[17, 17], [25, 17], [17, 25], [25, 25]]); break;
    case 'skull': p.ellipse(16, 13, 10, 9); p.dot(12, 13, 2.4); p.dot(20, 13, 2.4); p.line(12, 22, 12, 27); p.line(16, 22, 16, 27); p.line(20, 22, 20, 27); break;
    case 'str': p.path([[6, 18], [16, 8], [26, 18]]); p.path([[6, 27], [16, 17], [26, 27]]); break;
    case 'weak': p.curve([[6, 10], [12, 14], [16, 22], [24, 26]]); p.path([[19, 26], [25, 26], [24, 20]]); break;
    case 'vuln': p.path([[16, 4], [27, 8], [25, 19], [16, 28], [7, 19], [5, 8]], true); p.path([[15, 6], [18, 13], [13, 18], [17, 26]]); break;
    case 'thorns': p.line(4, 22, 28, 22); p.path([[7, 22], [10, 12], [13, 22]]); p.path([[13, 22], [16, 9], [19, 22]]); p.path([[19, 22], [22, 12], [25, 22]]); break;
    case 'regrow': p.curve([[16, 28], [16, 16], [14, 8]]); p.ellipse(10, 12, 5, 3, -0.6); p.ellipse(21, 14, 5, 3, 0.6); break;
    case 'fortify': p.rect(6, 12, 20, 14); p.path([[6, 12], [6, 7], [10, 7], [10, 12]]); p.path([[14, 12], [14, 7], [18, 7], [18, 12]]); p.path([[22, 12], [22, 7], [26, 7], [26, 12]]); break;
    case 'energy': p.path([[18, 3], [9, 18], [16, 18], [13, 29], [23, 13], [16, 13], [18, 3]]); break;
  }
}

// ---------------------------------------------------------------- creatures
// Each draws into a 200x200 box, feet near y=188, facing left (toward Pip) unless hero.
const C = INK;
export const CREATURES = {
  hero(p) { // Pip: a small round knight, facing right
    p.set(C.blue, 3.4);
    const body = [[78, 122], [122, 122], [128, 166], [72, 166]];
    p.hatch(body, { color: C.blue, gap: 6, alpha: 0.55 }); p.path(body, true);
    p.set(C.white, 3); p.line(84, 166, 82, 188); p.line(116, 166, 119, 188); p.line(76, 188, 88, 188); p.line(113, 188, 125, 188);
    p.set(C.white, 3.4); p.circle(100, 98, 24);
    p.line(80, 98, 120, 96); p.set(C.white, 2.4); p.line(86, 104, 114, 103);
    p.dot(92, 91, 2.6); p.dot(108, 90, 2.6);
    p.set(C.pink, 3); p.curve([[100, 74], [96, 58], [108, 50], [118, 56]]); p.curve([[104, 74], [110, 60], [122, 62]]);
    p.set(C.yellow, 3.6); p.line(128, 140, 166, 92); p.line(150, 118, 160, 128); p.line(122, 146, 130, 138);
    p.set(C.white, 3); p.ellipse(70, 142, 15, 20, 0.15); p.dot(70, 142, 2.5);
  },
  rat(p) {
    p.set(C.white, 3.4);
    const b = p.ellipsePts(108, 160, 48, 24);
    p.hatch(b, { color: C.dim, gap: 7, alpha: 0.45 }); p.path(b, true);
    p.path([[66, 150], [38, 162], [64, 172]]); p.dot(46, 162, 3);
    p.set(C.pink, 3); p.circle(76, 138, 10);
    p.set(C.white, 2); p.line(42, 160, 26, 154); p.line(42, 164, 24, 166);
    p.dot(66, 152, 3.4);
    p.set(C.pink, 3); p.curve([[154, 160], [178, 150], [184, 126], [170, 116], [160, 128]]);
    p.set(C.white, 2.6); p.line(84, 180, 82, 190); p.line(128, 180, 132, 190);
  },
  jelly(p) {
    const b = [[40, 188], [44, 140], [70, 100], [100, 90], [132, 100], [156, 140], [160, 188]];
    p.set(C.green, 3.6); p.hatch(b, { color: C.green, gap: 9, alpha: 0.4, angle: -0.5 }); p.curve(b); p.line(40, 188, 160, 188);
    p.set(C.white, 3); p.circle(84, 140, 9); p.circle(118, 138, 9); p.dot(86, 142, 3.5); p.dot(120, 140, 3.5);
    p.curve([[88, 164], [100, 170], [114, 162]]);
    p.set(C.white, 2.4); p.curve([[66, 118], [72, 108], [82, 104]]);
    p.set(C.green, 3); p.curve([[150, 160], [156, 176], [152, 196]]);
  },
  bats(p) {
    const bat = (x, y, s, col) => {
      p.set(col, 2.8);
      p.path([[x - 26 * s, y - 4 * s], [x - 18 * s, y - 14 * s], [x - 12 * s, y - 4 * s], [x - 6 * s, y - 10 * s], [x, y], [x + 6 * s, y - 10 * s], [x + 12 * s, y - 4 * s], [x + 18 * s, y - 14 * s], [x + 26 * s, y - 4 * s], [x + 16 * s, y + 6 * s], [x, y + 10 * s], [x - 16 * s, y + 6 * s]], true);
      p.set(C.yellow); p.dot(x - 3 * s, y, 2.2 * s); p.dot(x + 3 * s, y, 2.2 * s);
    };
    bat(70, 70, 1.15, C.lilac); bat(136, 96, 1, C.lilac); bat(84, 138, 0.9, C.white); bat(140, 160, 1.1, C.lilac);
  },
  bones(p) {
    p.set(C.white, 3.4); p.circle(100, 62, 22);
    p.set(C.white, 3); p.circle(91, 62, 6); p.circle(110, 62, 6); p.dot(91, 62, 2.6); p.dot(110, 62, 2.6);
    p.line(92, 78, 92, 86); p.line(100, 79, 100, 87); p.line(108, 78, 108, 86);
    p.line(100, 86, 100, 140);
    for (let i = 0; i < 4; i++) p.curve([[80, 98 + i * 10], [100, 94 + i * 10], [120, 98 + i * 10]]);
    p.line(100, 140, 84, 188); p.line(100, 140, 118, 188);
    p.line(80, 98, 60, 124); p.line(120, 98, 132, 126);
    p.set(C.yellow, 4); p.line(60, 124, 40, 82); p.circle(40, 78, 7); p.circle(46, 74, 6);
  },
  shroom(p) {
    const cap = [[30, 112], [46, 70], [100, 46], [154, 70], [170, 112]];
    p.set(C.red, 3.6); p.hatch([...cap, [100, 118]], { color: C.red, gap: 6, alpha: 0.6 }); p.curve(cap); p.curve([[30, 112], [100, 120], [170, 112]]);
    p.set(C.white, 3); p.circle(70, 82, 9); p.circle(112, 66, 8); p.circle(140, 92, 7); p.circle(92, 100, 5);
    p.set(C.white, 3.4); p.path([[76, 118], [72, 186], [128, 186], [124, 118]]);
    p.dot(90, 146, 3); p.dot(110, 146, 3); p.curve([[92, 160], [100, 156], [108, 160]]);
    p.set(C.yellow, 2); for (const [x, y] of [[38, 140], [162, 140], [26, 96], [176, 86], [150, 166]]) p.dot(x, y, 2.4);
  },
  chanter(p) {
    const robe = [[100, 30], [60, 80], [40, 188], [160, 188], [140, 80]];
    p.set(C.lilac, 3.6); p.hatch(robe, { color: C.lilac, gap: 7, alpha: 0.5 }); p.path(robe, true);
    p.set(C.white, 3); p.ellipse(100, 72, 20, 24);
    p.c.fillStyle = '#1c221f'; p.c.beginPath(); p.c.ellipse(100, 72, 18, 22, 0, 0, 6.29); p.c.fill();
    p.set(C.yellow); p.dot(92, 70, 3.6); p.dot(108, 70, 3.6);
    p.set(C.white, 3); p.line(66, 110, 36, 78); p.line(134, 110, 164, 78);
    p.set(C.yellow, 2.6); p.circle(30, 66, 6); p.line(36, 66, 36, 46); p.line(36, 46, 44, 50);
    p.circle(170, 56, 6); p.line(176, 56, 176, 36);
  },
  snake(p) {
    p.set(C.green, 6);
    p.curve([[170, 186], [120, 190], [70, 178], [70, 150], [120, 146], [140, 120], [110, 96], [80, 84], [64, 64]]);
    p.set(C.green, 2.2); p.hatch([[70, 172], [120, 186], [140, 170], [100, 160], [70, 160]], { color: C.green, gap: 6, alpha: 0.35 });
    p.set(C.white, 3.4); p.ellipse(56, 58, 20, 14, -0.3); p.dot(50, 52, 3.6);
    p.set(C.pink, 2.4); p.path([[38, 64], [24, 68], [16, 62]]); p.line(24, 68, 18, 74);
  },
  moth(p) {
    p.set(C.yellow, 3.2);
    const wl = p.ellipsePts(62, 92, 44, 32), wr = p.ellipsePts(138, 92, 44, 32);
    p.hatch(wl, { color: C.yellow, gap: 8, alpha: 0.35 }); p.hatch(wr, { color: C.yellow, gap: 8, alpha: 0.35, angle: 0.9 });
    p.path(wl, true); p.path(wr, true);
    p.ellipse(72, 148, 26, 20, 0.5); p.ellipse(128, 148, 26, 20, -0.5);
    p.set(C.white, 3); p.circle(56, 90, 11); p.circle(144, 90, 11); p.dot(56, 90, 4); p.dot(144, 90, 4);
    p.set(C.white, 3.4); p.ellipse(100, 128, 12, 46);
    p.set(C.lilac, 3.2); p.path([[80, 74], [100, 18], [120, 74]], true); p.line(72, 76, 128, 74);
    p.set(C.white); p.dot(95, 88, 2.4); p.dot(105, 88, 2.4);
  },
  bucket(p) {
    p.set(C.blue, 3.6);
    const helm = [[70, 30], [130, 30], [136, 90], [64, 90]];
    p.hatch(helm, { color: C.blue, gap: 6, alpha: 0.45 }); p.path(helm, true);
    p.set(C.white, 3); p.line(78, 58, 122, 58); p.line(66, 36, 134, 36);
    p.set(C.blue, 3.6); p.rect(68, 92, 64, 56);
    p.set(C.white, 3.2); p.line(84, 148, 80, 188); p.line(116, 148, 120, 188);
    p.set(C.white, 3.4); const sh = [[22, 92], [62, 92], [60, 140], [42, 160], [24, 140]];
    p.hatch(sh, { color: C.dim, gap: 6, alpha: 0.4 }); p.path(sh, true); p.line(42, 98, 42, 150);
    p.set(C.yellow, 4); p.line(140, 120, 172, 40); p.line(160, 70, 176, 78);
  },
  mimic(p) {
    p.set(C.orange, 3.6);
    const box = [[34, 120], [166, 120], [166, 188], [34, 188]];
    p.hatch(box, { color: C.orange, gap: 8, alpha: 0.4, angle: 0 }); p.path(box, true);
    p.line(34, 150, 166, 150);
    const lid = [[34, 112], [44, 60], [156, 54], [166, 104]];
    p.path(lid, false);
    p.set(C.white, 3); p.path([[40, 112], [52, 126], [64, 112], [76, 126], [88, 112], [100, 126], [112, 112], [124, 126], [136, 112], [148, 126], [160, 112]]);
    p.path([[44, 104], [56, 90], [68, 102], [80, 88], [92, 100], [104, 86], [116, 98], [128, 84], [140, 96], [154, 84]]);
    p.set(C.pink, 4); p.curve([[96, 120], [80, 140], [56, 150], [42, 168]]);
    p.set(C.yellow); p.dot(70, 74, 4); p.dot(124, 70, 4); p.rect(92, 140, 16, 18);
  },
  gargoyle(p) {
    p.set(C.dim, 3.6);
    const wl = [[70, 80], [20, 40], [28, 80], [10, 100], [60, 110]], wr = [[130, 80], [180, 40], [172, 80], [190, 100], [140, 110]];
    p.path(wl, true); p.path(wr, true);
    p.hatch(wl, { color: C.dim, gap: 7, alpha: 0.35 }); p.hatch(wr, { color: C.dim, gap: 7, alpha: 0.35 });
    p.set(C.white, 3.6); const body = [[70, 70], [130, 70], [146, 150], [120, 188], [80, 188], [54, 150]];
    p.hatch(body, { color: C.dim, gap: 6, alpha: 0.5 }); p.path(body, true);
    p.rect(78, 30, 44, 40); p.path([[78, 32], [70, 12], [86, 30]]); p.path([[122, 32], [130, 12], [114, 30]]);
    p.set(C.red); p.dot(90, 46, 3.6); p.dot(110, 46, 3.6);
    p.set(C.white, 2.6); p.path([[86, 60], [92, 56], [98, 60], [104, 56], [110, 60], [114, 56]]);
    p.set(C.white, 4); p.line(54, 150, 40, 176); p.line(146, 150, 160, 176);
  },
  brute(p) {
    p.set(C.orange, 3.8);
    const body = p.ellipsePts(100, 132, 62, 56);
    p.hatch(body, { color: C.orange, gap: 7, alpha: 0.45 }); p.path(body, true);
    p.set(C.white, 3.4); p.circle(100, 62, 20); p.dot(92, 58, 3.4); p.dot(108, 58, 3.4);
    p.path([[92, 70], [96, 76], [96, 70]]); p.line(88, 72, 112, 72);
    p.line(80, 186, 82, 176); p.line(120, 186, 118, 176);
    p.set(C.yellow, 5); p.line(160, 130, 186, 46); p.ellipse(184, 46, 14, 22, 0.3);
    p.set(C.white, 3.6); p.line(150, 120, 164, 132); p.line(44, 116, 30, 150);
    p.set(C.white, 2.4); p.dot(176, 38, 2); p.dot(190, 54, 2);
  },
  bell(p) {
    p.set(C.yellow, 4);
    const bell = [[60, 170], [66, 110], [72, 60], [100, 36], [128, 60], [134, 110], [140, 170]];
    p.hatch([...bell, [100, 178]], { color: C.yellow, gap: 7, alpha: 0.45 }); p.curve(bell); p.curve([[40, 178], [100, 166], [160, 178]]); p.line(40, 178, 60, 170); p.line(160, 178, 140, 170);
    p.rect(92, 18, 16, 18);
    p.set(C.white, 3.4); p.ellipse(86, 100, 9, 12); p.ellipse(114, 100, 9, 12); p.dot(86, 104, 4); p.dot(114, 104, 4);
    p.curve([[84, 138], [100, 128], [116, 138]]);
    p.set(C.white, 2.4); p.path([[124, 64], [116, 80], [126, 90], [118, 104]]);
    p.set(C.white, 4); p.line(100, 178, 100, 192); p.circle(100, 196, 7);
  },
  crown(p) {
    p.set(C.lilac, 3.6);
    const cloak = [[56, 92], [40, 188], [160, 188], [144, 92]];
    p.path(cloak, false); p.curve([[56, 92], [100, 104], [144, 92]]);
    p.set(C.lilac, 2.4); p.curve([[70, 120], [76, 160], [72, 186]]); p.curve([[130, 120], [124, 160], [128, 186]]);
    p.set(C.yellow, 4);
    const crown = [[60, 74], [60, 34], [76, 54], [90, 22], [100, 48], [110, 22], [124, 54], [140, 34], [140, 74]];
    p.hatch([...crown], { color: C.yellow, gap: 6, alpha: 0.5 }); p.path(crown, true);
    p.set(C.red); p.dot(80, 64, 4); p.dot(100, 64, 4); p.dot(120, 64, 4);
    p.set(C.white, 2.6); p.dot(88, 98, 2.4); p.dot(112, 98, 2.4);
  },
  eye(p) {
    p.set(C.white, 4); const ball = p.ellipsePts(100, 86, 62, 58);
    p.path(ball, true);
    p.set(C.pink, 2); for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.3; p.curve([[100 + Math.cos(a) * 60, 86 + Math.sin(a) * 56], [100 + Math.cos(a + 0.2) * 46, 86 + Math.sin(a + 0.2) * 42], [100 + Math.cos(a) * 36, 86 + Math.sin(a) * 34]]); }
    p.set(C.blue, 4); const iris = p.ellipsePts(96, 88, 26, 26);
    p.hatch(iris, { color: C.blue, gap: 4, alpha: 0.6 }); p.path(iris, true);
    p.c.fillStyle = '#141917'; p.c.beginPath(); p.c.arc(96, 88, 11, 0, 6.29); p.c.fill();
    p.set(C.white); p.dot(88, 80, 4);
    p.set(C.pink, 3.4);
    for (let i = 0; i < 5; i++) { const x = 58 + i * 21; p.curve([[x, 136], [x + (i % 2 ? 8 : -8), 160], [x, 188]]); }
  },
};
// rooms that aren't monsters
Object.assign(CREATURES, {
  chest(p) {
    p.set(C.yellow, 3.6);
    const box = [[44, 116], [156, 116], [156, 184], [44, 184]];
    p.hatch(box, { color: C.orange, gap: 8, alpha: 0.4, angle: 0 }); p.path(box, true);
    p.curve([[44, 116], [52, 82], [100, 72], [148, 82], [156, 116]]); p.line(44, 116, 156, 116);
    p.set(C.white, 3); p.rect(92, 116, 16, 22); p.dot(100, 128, 2.4);
    p.set(C.yellow, 2.4); for (const [x, y] of [[30, 70], [170, 64], [100, 44], [62, 52], [140, 46]]) { p.line(x - 6, y, x + 6, y); p.line(x, y - 6, x, y + 6); }
  },
  campfire(p) {
    p.set(C.orange, 4); p.line(50, 184, 150, 160); p.line(50, 160, 150, 184);
    p.set(C.yellow, 3.4); const fl = [[100, 60], [128, 112], [124, 150], [100, 164], [76, 150], [72, 112]];
    p.hatch(fl, { color: C.orange, gap: 6, alpha: 0.5 }); p.curve(fl, true);
    p.set(C.red, 3); p.curve([[100, 96], [114, 128], [100, 152], [86, 128]], true);
    p.set(C.white, 2); p.dot(70, 70, 2); p.dot(132, 56, 2); p.dot(116, 36, 1.8);
  },
  shrine(p) {
    p.set(C.white, 3.4); p.rect(52, 120, 96, 66); p.line(40, 120, 160, 120);
    p.path([[60, 120], [60, 60], [100, 30], [140, 60], [140, 120]]);
    p.set(C.red, 3.4); p.curve([[100, 66], [88, 88], [92, 100], [100, 104], [108, 100], [112, 88], [100, 66]]);
    p.set(C.red, 2.4); p.line(100, 120, 100, 150); p.dot(100, 160, 3);
  },
  well(p) {
    p.set(C.white, 3.4); p.ellipse(100, 140, 52, 16); p.line(48, 140, 50, 184); p.line(152, 140, 150, 184); p.curve([[50, 184], [100, 194], [150, 184]]);
    p.set(C.dim, 2.4); p.hatch([[50, 150], [150, 150], [150, 184], [50, 184]], { color: C.dim, gap: 8, alpha: 0.35, angle: 0 });
    p.set(C.orange, 3.4); p.line(60, 136, 60, 60); p.line(140, 136, 140, 60); p.path([[44, 66], [100, 30], [156, 66]]);
    p.set(C.white, 2.4); p.line(100, 64, 100, 110); p.rect(92, 110, 16, 14);
    p.set(C.yellow, 2.6); p.circle(128, 160, 6);
  },
  altar(p) {
    p.set(C.lilac, 3.6); const st = [[40, 130], [160, 130], [150, 186], [50, 186]];
    p.hatch(st, { color: C.lilac, gap: 7, alpha: 0.4 }); p.path(st, true);
    p.set(C.white, 3.2); p.ellipse(100, 100, 22, 20); p.dot(92, 98, 3.4); p.dot(108, 98, 3.4); p.line(92, 120, 108, 120);
    p.set(C.lilac, 2.4); p.curve([[60, 120], [52, 90], [64, 70]]); p.curve([[140, 120], [148, 86], [136, 64]]);
    p.set(C.yellow, 3); p.line(54, 126, 54, 104); p.line(146, 126, 146, 104); p.dot(54, 98, 3); p.dot(146, 98, 3);
  },
  barber(p) {
    p.set(C.white, 3.4); p.circle(68, 150, 18); p.circle(132, 150, 18);
    p.line(80, 136, 128, 50); p.line(120, 136, 72, 50);
    p.set(C.red, 3); p.path([[160, 40], [174, 40], [174, 190], [160, 190]], true);
    p.set(C.white, 2.4); for (let y = 50; y < 186; y += 22) p.line(160, y + 10, 174, y);
  },
  door(p) {
    p.set(C.dim, 3.6); p.path([[50, 190], [50, 70], [70, 36], [100, 26], [130, 36], [150, 70], [150, 190]]);
    p.set(C.dim, 2.2); p.hatch([[56, 186], [56, 72], [100, 32], [144, 72], [144, 186]], { color: C.dim, gap: 9, alpha: 0.25, angle: 1.4 });
    p.set(C.yellow, 3); p.dot(132, 118, 4);
    p.set(C.white, 3.6); p.text('?', 100, 110, 64, { font: 'Cabin Sketch' });
  },
});
export const CREATURE_SCALE ={ bell: 1.3, crown: 1.3, eye: 1.3, gargoyle: 1.15, brute: 1.15, hero: 1, bats: 1 };

// Cached boil frames: draw(name) -> [canvas, canvas, canvas], each 200x200 logical * res
const spriteCache = {};
export function sprite(name, res = 2) {
  const k = name + res;
  if (spriteCache[k]) return spriteCache[k];
  const frames = [];
  for (let f = 0; f < 3; f++) {
    const c = document.createElement('canvas'); c.width = c.height = 200 * res;
    const x = c.getContext('2d'); x.scale(res, res);
    const p = new Pen(x, name.length * 131 + f * 17 + 5);
    CREATURES[name](p);
    grain(x, 200, 200, 0.55);
    frames.push(c);
  }
  return (spriteCache[k] = frames);
}
