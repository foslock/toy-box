// A linocut print: the ground is black ink, everything is gouged out of it in bone white,
// and the host's torch is the only colour that isn't the invader's own red thread.
import { rng } from './levels.js';

export const INK = '#15120f', BONE = '#ebe3d0', TORCH = '#e8892b', BLOOD = '#c0392b';
const TAU = Math.PI * 2;

function rough(ctx, pts, R, amp = 0.9) {
  // a polygon with every edge chipped a little, as if cut by hand
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 7));
    for (let k = 0; k < n; k++) {
      const u = k / n;
      const x = a[0] + (b[0] - a[0]) * u + (R() - 0.5) * amp * 2, y = a[1] + (b[1] - a[1]) * u + (R() - 0.5) * amp * 2;
      if (i === 0 && k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}
const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

function gouge(ctx, x, y, a, len, w) {
  const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x - dx, y - dy);
  ctx.quadraticCurveTo(x + dy * 0.15, y - dx * 0.15, x + dx, y + dy);
  ctx.stroke();
}

function flow(x, y) {
  return Math.sin(x * 0.0042 + 1.3) * 1.5 + Math.cos(y * 0.0051 - 0.7) * 1.2 + Math.sin((x + y) * 0.0021) * 0.9;
}

export function bakeWorld(L, k) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(L.W * k); cv.height = Math.ceil(L.H * k);
  const ctx = cv.getContext('2d');
  ctx.scale(k, k);
  const R = rng(L.W * 7 + L.H);
  ctx.fillStyle = INK; ctx.fillRect(0, 0, L.W, L.H);
  ctx.lineCap = 'round';
  // the ground: short gouges following the grain of the block
  const inSolid = (x, y) => L.walls.some(w => x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h);
  const n = L.W * L.H / 230;
  ctx.strokeStyle = BONE;
  for (let i = 0; i < n; i++) {
    const x = R() * L.W, y = R() * L.H;
    if (inSolid(x, y)) continue;
    ctx.globalAlpha = 0.05 + R() * 0.12;
    gouge(ctx, x, y, flow(x, y) + (R() - 0.5) * 0.4, 4 + R() * 9, 0.8 + R() * 1.1);
  }
  // worn paths: pale bands of gouges running along the track
  for (const s of L.segs) {
    const len = Math.hypot(s[2] - s[0], s[3] - s[1]), a = Math.atan2(s[3] - s[1], s[2] - s[0]);
    const nx = -Math.sin(a), ny = Math.cos(a);
    for (let i = 0; i < len / 1.3; i++) {
      const u = R(), off = (R() + R() + R() - 1.5) / 1.5 * 19;
      const x = s[0] + (s[2] - s[0]) * u + nx * off, y = s[1] + (s[3] - s[1]) * u + ny * off;
      if (inSolid(x, y)) continue;
      ctx.globalAlpha = (0.42 - Math.abs(off) / 19 * 0.3) * (0.6 + R() * 0.5);
      gouge(ctx, x, y, a + (R() - 0.5) * 0.25, 6 + R() * 12, 1 + R() * 1.4);
    }
  }
  ctx.globalAlpha = 1;
  for (const s of L.smalls) drawSmall(ctx, s, R);
  for (const c of L.circles) drawCircle(ctx, c, R);
  for (const w of L.walls) drawWall(ctx, w, R, L);
  // a carved border, like the edge of the block
  ctx.strokeStyle = BONE; ctx.lineWidth = 3; ctx.globalAlpha = 0.5;
  rough(ctx, rectPts(4, 4, L.W - 8, L.H - 8), R, 1.2); ctx.stroke();
  ctx.globalAlpha = 1;
  return cv;
}

function hatch(ctx, x, y, w, h, gap, ang, R) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const c = Math.cos(ang), s = Math.sin(ang), L = w + h;
  for (let d = -L; d < L; d += gap) {
    const cx = x + w / 2 + -s * d, cy = y + h / 2 + c * d;
    ctx.lineWidth = 0.9 + R() * 0.8;
    ctx.beginPath(); ctx.moveTo(cx - c * L, cy - s * L); ctx.lineTo(cx + c * L, cy + s * L); ctx.stroke();
  }
  ctx.restore();
}

function drawWall(ctx, w, R, L) {
  ctx.fillStyle = BONE; ctx.strokeStyle = INK;
  rough(ctx, rectPts(w.x, w.y, w.w, w.h), R, 0.8); ctx.fill();
  if (w.kind === 'wall') {
    // courses of stone
    ctx.lineWidth = 1.4;
    const horiz = w.w > w.h;
    const len = horiz ? w.w : w.h, th = horiz ? w.h : w.w;
    for (let row = 0; row < 2; row++) {
      for (let p = (row ? 9 : 0) + R() * 4; p < len; p += 16 + R() * 6) {
        const a = p, b = row * th / 2 + 2, c = th / 2 - 4;
        ctx.beginPath();
        if (horiz) { ctx.moveTo(w.x + a, w.y + b); ctx.lineTo(w.x + a, w.y + b + c); }
        else { ctx.moveTo(w.x + b, w.y + a); ctx.lineTo(w.x + b + c, w.y + a); }
        ctx.stroke();
      }
    }
    ctx.beginPath();
    if (horiz) { ctx.moveTo(w.x, w.y + th / 2); ctx.lineTo(w.x + len, w.y + th / 2); }
    else { ctx.moveTo(w.x + th / 2, w.y); ctx.lineTo(w.x + th / 2, w.y + len); }
    ctx.stroke();
  } else if (w.kind === 'chapel' || w.kind === 'house') {
    // roof: ridge along the long side, one slope in shadow
    const horiz = w.w >= w.h;
    hatch(ctx, w.x + 3, w.y + 3, horiz ? w.w - 6 : (w.w - 6) / 2, horiz ? (w.h - 6) / 2 : w.h - 6, 4, horiz ? 0 : Math.PI / 2, R);
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (horiz) { ctx.moveTo(w.x + 4, w.y + w.h / 2); ctx.lineTo(w.x + w.w - 4, w.y + w.h / 2); }
    else { ctx.moveTo(w.x + w.w / 2, w.y + 4); ctx.lineTo(w.x + w.w / 2, w.y + w.h - 4); }
    ctx.stroke();
    if (w.kind === 'chapel') {
      // a bell tower with a cross on it
      const bx = w.x + w.w / 2, by = w.y + w.h - 34;
      ctx.fillStyle = INK; ctx.fillRect(bx - 22, by - 22, 44, 44);
      ctx.fillStyle = BONE; ctx.fillRect(bx - 16, by - 16, 32, 32);
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(bx, by - 11); ctx.lineTo(bx, by + 11); ctx.moveTo(bx - 7, by - 4); ctx.lineTo(bx + 7, by - 4); ctx.stroke();
    }
  } else if (w.kind === 'tomb') {
    ctx.lineWidth = 2;
    rough(ctx, rectPts(w.x + 7, w.y + 7, w.w - 14, w.h - 14), R, 0.6); ctx.stroke();
    hatch(ctx, w.x + 9, w.y + 9, w.w - 18, w.h - 18, 5, -0.8, R);
    ctx.fillStyle = BONE; ctx.fillRect(w.x + w.w / 2 - 12, w.y + w.h / 2 - 6, 24, 12);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(w.x + w.w / 2 - 8, w.y + w.h / 2 - 2 + i * 4); ctx.lineTo(w.x + w.w / 2 + 8, w.y + w.h / 2 - 2 + i * 4); ctx.stroke(); }
  } else if (w.kind === 'stall') {
    // striped awning
    ctx.save(); rough(ctx, rectPts(w.x, w.y, w.w, w.h), R, 0.8); ctx.clip();
    ctx.fillStyle = INK;
    for (let x = w.x + 6; x < w.x + w.w; x += 18) ctx.fillRect(x, w.y, 9, w.h);
    ctx.restore();
    ctx.lineWidth = 2.4; ctx.strokeStyle = INK;
    rough(ctx, rectPts(w.x, w.y, w.w, w.h), R, 0.8); ctx.stroke();
    ctx.fillStyle = BONE;
    for (let x = w.x + 4; x < w.x + w.w; x += 18) { ctx.beginPath(); ctx.arc(x + 7, w.y + w.h + 1, 4.5, 0, Math.PI); ctx.fill(); }
  } else if (w.kind === 'altar') {
    ctx.lineWidth = 2;
    rough(ctx, rectPts(w.x + 8, w.y + 8, w.w - 16, w.h - 16), R, 0.5); ctx.stroke();
    for (let x = w.x + 20; x < w.x + w.w - 14; x += 10) { ctx.beginPath(); ctx.moveTo(x, w.y + 8); ctx.lineTo(x, w.y + w.h - 8); ctx.lineWidth = 1; ctx.stroke(); }
    ctx.fillStyle = INK; ctx.fillRect(w.x + w.w / 2 - 3, w.y + 12, 6, w.h - 24); ctx.fillRect(w.x + w.w / 2 - 12, w.y + 22, 24, 6);
  }
}

function drawCircle(ctx, c, R) {
  ctx.fillStyle = BONE; ctx.strokeStyle = BONE;
  if (c.kind === 'yew') {
    // a canopy of radial gouges
    for (let i = 0; i < 90; i++) {
      const a = R() * TAU, r = Math.sqrt(R()) * (c.r + 6);
      ctx.globalAlpha = 0.5 + R() * 0.5;
      gouge(ctx, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, a + (R() - 0.5) * 0.6, 5 + R() * 7, 1.5 + R() * 1.5);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, TAU); ctx.fill();
  } else if (c.kind === 'fountain') {
    for (let r = c.r; r > 6; r -= 9) {
      ctx.lineWidth = r === c.r ? 6 : 1.4 + R();
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, TAU); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(c.x, c.y, 10, 0, TAU); ctx.fill();
  } else if (c.kind === 'pillar') {
    const pts = []; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; pts.push([c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r]); }
    rough(ctx, pts, R, 0.6); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * 7, c.y + Math.sin(a) * 7); ctx.lineTo(c.x + Math.cos(a) * (c.r - 4), c.y + Math.sin(a) * (c.r - 4)); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, TAU); ctx.stroke();
  }
}

function drawSmall(ctx, s, R) {
  ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot);
  ctx.fillStyle = BONE; ctx.strokeStyle = INK;
  if (s.kind === 'stone') {
    ctx.globalAlpha = 0.7 + s.v * 0.3;
    rough(ctx, [[-s.w / 2, -s.h / 2], [s.w / 2, -s.h / 2], [s.w / 2, s.h / 2], [-s.w / 2, s.h / 2]], R, 0.6); ctx.fill();
    ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-5, -1); ctx.lineTo(5, -1); ctx.moveTo(-3, 2); ctx.lineTo(4, 2); ctx.stroke();
  } else if (s.kind === 'cross') {
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-9, -2.5, 18, 5); ctx.fillRect(-4, -7, 5, 14);
  } else if (s.kind === 'barrel') {
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
    ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 1.4, 0, TAU); ctx.stroke();
  } else if (s.kind === 'crate') {
    ctx.fillRect(-7, -7, 14, 14);
    ctx.lineWidth = 1.3; ctx.strokeRect(-4.5, -4.5, 9, 9); ctx.beginPath(); ctx.moveTo(-4.5, -4.5); ctx.lineTo(4.5, 4.5); ctx.stroke();
  } else if (s.kind === 'pew') {
    rough(ctx, [[-s.w / 2, -s.h / 2], [s.w / 2, -s.h / 2], [s.w / 2, s.h / 2], [-s.w / 2, s.h / 2]], R, 0.5); ctx.fill();
    ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-s.w / 2 + 4, -2); ctx.lineTo(s.w / 2 - 4, -2); ctx.moveTo(-s.w / 2 + 4, 3); ctx.lineTo(s.w / 2 - 4, 3); ctx.stroke();
  }
  ctx.restore();
}

// ---- figures, drawn every frame in world units, facing +x before rotation
export function figure(ctx, f) {
  const { x, y, face, walk = 0, g = 0, pose = 'kneel', kind = 'npc', dead = 0, alpha = 1 } = f;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(face);
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const S = kind === 'host' ? 1.35 : 1.12;
  ctx.scale(S, S);
  ctx.strokeStyle = INK; ctx.fillStyle = BONE;
  if (dead) {
    ctx.globalAlpha = alpha * 0.75;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(-2, 0, 11, 5.5, 0.15, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(11, 2, 4.2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = BONE; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-1, -5); ctx.lineTo(4, -12); ctx.moveTo(-6, 5); ctx.lineTo(-13, 10); ctx.stroke();
    ctx.restore();
    return;
  }
  const step = Math.sin(walk);
  const kn = pose === 'kneel' ? g : 0, bw = pose === 'bow' ? g : 0, rs = pose === 'raise' ? g : 0;
  // feet
  if (kn < 0.5) {
    ctx.lineWidth = 1.6;
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(step * 4.5 * sd * (1 - g), sd * 4, 3.4, 2.4, 0, 0, TAU); ctx.fill(); ctx.stroke();
    }
  } else {
    ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(-7, 3, 4, 3, 0, 0, TAU); ctx.fill(); ctx.stroke(); // the knee down behind
  }
  // cloak behind the host
  if (kind === 'host') {
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-3, -10); ctx.quadraticCurveTo(-16 - step * 2, 0, -3, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-6, -5); ctx.lineTo(-12, -1); ctx.moveTo(-6, 4); ctx.lineTo(-12, 1); ctx.stroke();
  }
  // arms raised for the choir
  if (rs > 0) {
    ctx.strokeStyle = INK; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(1, -8); ctx.lineTo(1 + 9 * rs, -8 - 6 * rs); ctx.moveTo(1, 8); ctx.lineTo(1 + 9 * rs, 8 + 6 * rs); ctx.stroke();
    ctx.strokeStyle = BONE; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.strokeStyle = INK;
  }
  // shoulders
  const bx = kn * 1.5 + bw * 1, sh = 1 - kn * 0.15;
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.ellipse(bx, 0, 6.2 * sh, 10.5 * sh, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(bx - 2.5, -6.5 * sh); ctx.quadraticCurveTo(bx - 4.6, 0, bx - 2.5, 6.5 * sh); ctx.stroke();
  // weapon
  if (kind !== 'host') {
    ctx.strokeStyle = INK; ctx.lineWidth = 3.4;
    const sy = 8.5 - kn * 2, ex = 17 - kn * 6 - bw * 5;
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(ex, sy + 1.5); ctx.stroke();
    ctx.strokeStyle = BONE; ctx.lineWidth = 1.4; ctx.stroke();
  } else {
    // sword in the right hand, raised in a windup
    const up = f.windup || 0, sw = f.swing || 0;
    const ang = 0.35 - up * 1.4 + sw * 2.4;
    const hx = 3, hy = 9;
    ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(ang) * 19, hy + Math.sin(ang) * 19 - up * 4); ctx.stroke();
    ctx.strokeStyle = BONE; ctx.lineWidth = 2; ctx.stroke();
    // torch in the left
    ctx.strokeStyle = INK; ctx.lineWidth = 3.6; ctx.beginPath(); ctx.moveTo(2, -9); ctx.lineTo(10, -12); ctx.stroke();
    ctx.strokeStyle = BONE; ctx.lineWidth = 1.6; ctx.stroke();
  }
  // head: a dark hood seen from above, the face a pale sliver at the front
  const hx = 1 + kn * 3 + bw * 5.5, hr = 5 - bw * 0.7;
  if (kind === 'host') {
    ctx.fillStyle = BONE; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(hx, 0, hr + 0.6, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(hx - hr, 0); ctx.lineTo(hx + hr - 1, 0); ctx.stroke(); // crest
  } else {
    ctx.fillStyle = INK; ctx.strokeStyle = BONE; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(hx - hr - 3, 0); ctx.quadraticCurveTo(hx - hr, -hr * 1.1, hx + 1, -hr); ctx.arc(hx + 1, 0, hr, -Math.PI / 2, Math.PI / 2); ctx.quadraticCurveTo(hx - hr, hr * 1.1, hx - hr - 3, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = BONE; ctx.beginPath(); ctx.arc(hx + 1, 0, hr - 1.2, -1.1, 1.1); ctx.quadraticCurveTo(hx + 2.5, 0, hx + 1 + Math.cos(-1.1) * (hr - 1.2), Math.sin(-1.1) * (hr - 1.2)); ctx.fill();
  }
  if (kind === 'player') {
    // the red thread, tied round the arm
    ctx.strokeStyle = BLOOD; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(-2, -9.5); ctx.lineTo(3, -10); ctx.stroke();
    ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-2, -9.5); ctx.quadraticCurveTo(-7, -13, -10 - Math.sin(walk * 0.7) * 2, -12); ctx.stroke();
  }
  ctx.restore();
}

export function flame(ctx, x, y, t, s = 1) {
  const fl = Math.sin(t * 23) * 0.6 + Math.sin(t * 37) * 0.4;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = TORCH;
  ctx.beginPath(); ctx.moveTo(-3.5 * s, 1); ctx.quadraticCurveTo(-3 * s, -6 * s, fl * s, -11 * s - fl); ctx.quadraticCurveTo(3 * s, -6 * s, 3.5 * s, 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fbd59a';
  ctx.beginPath(); ctx.arc(0, -1.5, 1.8 * s, 0, TAU); ctx.fill();
  ctx.restore();
}

// ray-cast the host's cone so it stops at walls
export function conePoly(game, h, rays = 44) {
  const L = game.L, pts = [[h.x, h.y]];
  for (let i = 0; i <= rays; i++) {
    const a = h.face - h.half + (2 * h.half) * i / rays;
    const dx = Math.cos(a), dy = Math.sin(a);
    let t = h.range;
    for (const w of L.walls) {
      if (!w.sight) continue;
      let t0 = 0, t1 = t;
      const ok = [[dx, h.x, w.x, w.x + w.w], [dy, h.y, w.y, w.y + w.h]].every(([d, o, lo, hi]) => {
        if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
        let a1 = (lo - o) / d, a2 = (hi - o) / d;
        if (a1 > a2) [a1, a2] = [a2, a1];
        t0 = Math.max(t0, a1); t1 = Math.min(t1, a2);
        return t0 <= t1;
      });
      if (ok && t0 > 0) t = Math.min(t, t0);
    }
    for (const c of L.circles) {
      if (!c.sight) continue;
      const fx = h.x - c.x, fy = h.y - c.y;
      const b = fx * dx + fy * dy, cc = fx * fx + fy * fy - c.r * c.r, disc = b * b - cc;
      if (disc > 0) { const r = -b - Math.sqrt(disc); if (r > 0) t = Math.min(t, r); }
    }
    pts.push([h.x + dx * t, h.y + dy * t]);
  }
  return pts;
}
