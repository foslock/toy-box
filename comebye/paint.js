// Paints a field once, at the start of a trial, into two canvases: the ground (grass, walls, beck,
// heather, rocks, tree shadows, the shedding ring) and a canopy layer that goes over the sheep.
// The look is gouache: lots of short overlapping strokes in a few close greens, no outlines.

import { rng } from './sim.js';

export const SKIES = {
  morning: { grass: ['#6f8f4a', '#7c9a52', '#5f7f40', '#87a45c', '#93ad66'], dark: '#4c6634', out: ['#8b9152', '#a19d5e', '#7b8346'], sun: [1.1, 0.7], tint: 'rgba(255, 228, 170, .10)', shade: 'rgba(28, 40, 24, .28)' },
  evening: { grass: ['#6e8a45', '#7d944e', '#5d7a3c', '#8c9c55', '#9aa35c'], dark: '#485f30', out: ['#a08f50', '#b39c5a', '#8a7c44'], sun: [1.5, 0.95], tint: 'rgba(255, 180, 110, .07)', shade: 'rgba(40, 30, 40, .32)' },
  noon:    { grass: ['#6c9447', '#79a051', '#5c843d', '#86aa5a', '#91b262'], dark: '#4a6c33', out: ['#9aa257', '#b0ad62', '#879049'], sun: [0.45, 0.35], tint: 'rgba(255, 250, 220, .06)', shade: 'rgba(24, 40, 22, .30)' },
  grey:    { grass: ['#687c4c', '#748755', '#5a6d42', '#80905d', '#8a9866'], dark: '#45543a', out: ['#6f5f58', '#7f6a62', '#5d4f4a'], sun: [0.7, 0.5], tint: 'rgba(170, 190, 210, .12)', shade: 'rgba(30, 36, 40, .22)' },
  mist:    { grass: ['#6f8655', '#7b915e', '#62794b', '#879c68', '#91a472'], dark: '#4f6340', out: ['#7d8a66', '#8b976f', '#6e7a5a'], sun: [0.6, 0.45], tint: 'rgba(230, 236, 240, .10)', shade: 'rgba(40, 50, 50, .2)' },
};

export const MARGIN = 9;

export function paintField(c, ppm) {
  const sky = SKIES[c.sky], R = rng(c.seed * 31 + 7), M = MARGIN;
  const W = c.w + M * 2, H = c.h + M * 2;
  const mk = () => { const cv = document.createElement('canvas'); cv.width = Math.ceil(W * ppm); cv.height = Math.ceil(H * ppm); return cv; };
  const ground = mk(), canopy = mk();
  const g = ground.getContext('2d'), k = canopy.getContext('2d');
  for (const x of [g, k]) { x.scale(ppm, ppm); x.translate(M, M); x.lineCap = 'round'; x.lineJoin = 'round'; }
  const pick = a => a[(R() * a.length) | 0];
  const jit = (hex, n) => {
    const v = parseInt(hex.slice(1), 16), j = () => ((R() - 0.5) * n) | 0;
    const r = Math.max(0, Math.min(255, (v >> 16) + j())), gg = Math.max(0, Math.min(255, ((v >> 8) & 255) + j())), b = Math.max(0, Math.min(255, (v & 255) + j()));
    return `rgb(${r},${gg},${b})`;
  };
  const strokes = (x0, y0, x1, y1, cols, n, len, wid, alpha, ang = -0.6) => {
    g.globalAlpha = alpha;
    for (let i = 0; i < n; i++) {
      const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0), a = ang + (R() - 0.5) * 0.9, l = len * (0.5 + R());
      g.strokeStyle = jit(pick(cols), 22); g.lineWidth = wid * (0.6 + R() * 0.8);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (R() - 0.5) * 0.2, y + Math.sin(a) * l * 0.5 + (R() - 0.5) * 0.2, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    g.globalAlpha = 1;
  };
  const blobs = (x0, y0, x1, y1, cols, n, r0, r1, alpha) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0), r = r0 + R() * (r1 - r0);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const col = jit(pick(cols), 26);
      gr.addColorStop(0, col.replace('rgb', 'rgba').replace(')', `,${alpha})`)); gr.addColorStop(1, col.replace('rgb', 'rgba').replace(')', ',0)'));
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  };

  // ---- the land outside the walls
  g.fillStyle = sky.out[0]; g.fillRect(-M, -M, W, H);
  blobs(-M, -M, c.w + M, c.h + M, sky.out, 160, 2, 7, 0.35);
  strokes(-M, -M, c.w + M, c.h + M, sky.out.concat([sky.dark]), W * H * 0.9, 0.9, 0.16, 0.3, 0.9);

  // ---- the field
  g.fillStyle = sky.grass[0]; g.fillRect(0, 0, c.w, c.h);
  blobs(0, 0, c.w, c.h, sky.grass, (c.w * c.h) / 14, 3, 11, 0.32);
  blobs(0, 0, c.w, c.h, [sky.dark], (c.w * c.h) / 90, 2, 6, 0.18);
  strokes(0, 0, c.w, c.h, sky.grass, c.w * c.h * 2.4, 0.75, 0.13, 0.32);
  strokes(0, 0, c.w, c.h, [sky.dark, sky.grass[2]], c.w * c.h * 0.5, 0.5, 0.1, 0.28, -1.1);
  // light catching the tops of the grass
  strokes(0, 0, c.w, c.h, ['#c3cf86', '#b6c47a', '#d4d697'], c.w * c.h * 0.22, 0.45, 0.07, 0.3, -0.5);
  // tussocks and darker growth along the walls
  for (let i = 0; i < (c.w + c.h) * 2.2; i++) {
    const side = R() * 4 | 0, t = R(), off = R() * 3.2;
    const x = side === 0 ? t * c.w : side === 1 ? c.w - off : side === 2 ? t * c.w : off;
    const y = side === 0 ? off : side === 1 ? t * c.h : side === 2 ? c.h - off : t * c.h;
    g.fillStyle = jit(sky.dark, 18); g.globalAlpha = 0.35;
    g.beginPath(); g.ellipse(x, y, 0.3 + R() * 0.5, 0.25 + R() * 0.35, R() * 3, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  // daisies and buttercups, in drifts
  for (let i = 0; i < c.w * c.h / 160; i++) {
    const x = R() * c.w, y = R() * c.h, col = R() < 0.6 ? '#f4f0e0' : '#e9c64a', n = 6 + R() * 18;
    g.fillStyle = col;
    for (let j = 0; j < n; j++) { g.globalAlpha = 0.55 + R() * 0.4; g.beginPath(); g.arc(x + (R() - 0.5) * 3.2, y + (R() - 0.5) * 3.2, 0.04 + R() * 0.05, 0, 7); g.fill(); }
  }
  g.globalAlpha = 1;
  // a trodden path from the post
  g.strokeStyle = 'rgba(180, 170, 110, .16)'; g.lineWidth = 1.1;
  g.beginPath(); g.moveTo(c.post[0], c.post[1]); g.quadraticCurveTo(c.post[0] - 3, c.h - 4, c.post[0] - 6, c.h); g.stroke();

  // ---- heather
  for (const [hx, hy, hr] of c.heather || []) {
    for (let i = 0; i < hr * hr * 14; i++) {
      const a = R() * 7, d = Math.sqrt(R()) * hr * (0.85 + 0.25 * Math.sin(a * 3 + hx));
      const x = hx + Math.cos(a) * d, y = hy + Math.sin(a) * d;
      g.fillStyle = jit(pick(['#6b4560', '#7d5470', '#5a3b4f', '#8a6378', '#6a5440']), 20);
      g.globalAlpha = 0.5;
      g.beginPath(); g.ellipse(x, y, 0.22 + R() * 0.3, 0.15 + R() * 0.2, R() * 3, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }

  // ---- the beck
  const s = c.stream;
  if (s) {
    const path = (w, col, a = 1) => {
      g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = w; g.beginPath();
      g.moveTo(s.pts[0][0], s.pts[0][1]);
      for (let i = 1; i < s.pts.length - 1; i++) { const p = s.pts[i], q = s.pts[i + 1]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
      g.lineTo(s.pts.at(-1)[0], s.pts.at(-1)[1]); g.stroke(); g.globalAlpha = 1;
    };
    path(s.w + 2.6, sky.dark, 0.5);
    path(s.w + 1.0, '#6a6650', 0.85);
    path(s.w, '#3e5a5c');
    path(s.w * 0.6, '#4d6f70', 0.8);
    path(s.w * 0.22, '#7d9b98', 0.5);
    // ripples
    for (let i = 0; i < s.pts.length - 1; i++) {
      const [a, b] = [s.pts[i], s.pts[i + 1]];
      for (let j = 0; j < 14; j++) {
        const t = R(), x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t + (R() - 0.5) * s.w * 0.6;
        g.strokeStyle = 'rgba(220, 235, 230, .45)'; g.lineWidth = 0.06;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 0.4 + R() * 0.5, y + (R() - 0.5) * 0.1); g.stroke();
      }
    }
    // reeds along the banks
    for (let i = 0; i < 260; i++) {
      const seg = (R() * (s.pts.length - 1)) | 0, [a, b] = [s.pts[seg], s.pts[seg + 1]], t = R();
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t + (R() < 0.5 ? -1 : 1) * (s.w / 2 + 0.2 + R() * 0.5);
      if (s.fords.some(([fx, fy, fr]) => Math.hypot(x - fx, y - fy) < fr)) continue;
      g.strokeStyle = jit(pick(['#56693a', '#6c7d45', '#8a8a52']), 20); g.lineWidth = 0.07;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.3) * 0.5, y - 0.3 - R() * 0.5); g.stroke();
    }
    // the ford: stones showing through
    for (const [fx, fy, fr] of s.fords) {
      g.fillStyle = 'rgba(150, 140, 110, .55)';
      g.beginPath(); g.ellipse(fx, fy, fr * 0.9, s.w * 0.75, 0.15, 0, 7); g.fill();
      for (let i = 0; i < 70; i++) {
        const a = R() * 7, d = Math.sqrt(R()), x = fx + Math.cos(a) * d * fr * 0.85, y = fy + Math.sin(a) * d * s.w * 0.6;
        g.fillStyle = jit(pick(['#a59c84', '#8d8670', '#bcb196']), 18);
        g.beginPath(); g.ellipse(x, y, 0.15 + R() * 0.2, 0.1 + R() * 0.14, R() * 3, 0, 7); g.fill();
      }
    }
  }

  // ---- the shedding ring: sawdust
  if (c.ring) {
    const [rx, ry] = c.ring.c, rr = c.ring.r;
    for (let i = 0; i < 420; i++) {
      const a = (i / 420) * Math.PI * 2 + R() * 0.01, d = rr + (R() - 0.5) * 0.25;
      if ((i % 14) > 9) continue;
      g.fillStyle = jit('#e8dcb8', 20); g.globalAlpha = 0.75;
      g.beginPath(); g.arc(rx + Math.cos(a) * d, ry + Math.sin(a) * d, 0.09 + R() * 0.07, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }

  // ---- shadows of the things that stand up: walls, rocks, trees
  const [sx, sy] = sky.sun;
  g.fillStyle = sky.shade;
  for (const [tx, ty, tr] of c.trees || []) {
    g.save(); g.translate(tx + sx * tr * 0.7, ty + sy * tr * 0.7); g.rotate(Math.atan2(sy, sx)); g.globalAlpha = 0.8;
    g.beginPath(); g.ellipse(0, 0, tr * (0.9 + Math.hypot(sx, sy) * 0.25), tr * 0.85, 0, 0, 7); g.fill(); g.restore();
  }
  for (const [rx, ry, rr] of c.rocks || []) { g.beginPath(); g.ellipse(rx + sx * rr * 0.5, ry + sy * rr * 0.5, rr * 1.15, rr * 0.9, 0.4, 0, 7); g.fill(); }
  // the wall's shadow falls on the field along the top and left walls (the sun is up and to the left)
  g.fillRect(0, 0, c.w, Math.max(0.6, sy * 1.0)); g.fillRect(0, 0, Math.max(0.6, sx * 1.0), c.h);

  // ---- rocks
  for (const [rx, ry, rr] of c.rocks || []) {
    g.fillStyle = '#7e7b72';
    g.beginPath();
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, d = rr * (0.85 + R() * 0.25); i ? g.lineTo(rx + Math.cos(a) * d, ry + Math.sin(a) * d * 0.85) : g.moveTo(rx + Math.cos(a) * d, ry + Math.sin(a) * d * 0.85); }
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(210, 205, 190, .45)'; g.beginPath(); g.ellipse(rx - rr * 0.25, ry - rr * 0.25, rr * 0.5, rr * 0.35, -0.5, 0, 7); g.fill();
    for (let i = 0; i < 6; i++) { g.fillStyle = R() < 0.5 ? 'rgba(200, 190, 110, .7)' : 'rgba(170, 180, 150, .7)'; g.beginPath(); g.arc(rx + (R() - 0.5) * rr, ry + (R() - 0.5) * rr * 0.8, 0.08 + R() * 0.1, 0, 7); g.fill(); }
  }

  // ---- drystone walls round the field, just outside it
  const wall = (x0, y0, x1, y1, nx, ny) => {
    const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, T = 1.0;
    g.fillStyle = 'rgba(60, 58, 50, .9)';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x1 + nx * T, y1 + ny * T); g.lineTo(x0 + nx * T, y0 + ny * T); g.fill();
    for (let row = 0; row < 3; row++) {
      let t = R() * 0.3;
      while (t < L) {
        const sw = 0.28 + R() * 0.3, sh = 0.22 + R() * 0.1, off = 0.17 + row * 0.33 + (R() - 0.5) * 0.06;
        const x = x0 + ux * (t + sw / 2) + nx * off, y = y0 + uy * (t + sw / 2) + ny * off;
        g.fillStyle = jit(pick(['#9a978c', '#8b887d', '#a8a497', '#7c796f', '#b0aa9a']), 16);
        g.beginPath(); g.ellipse(x, y, sw / 2, sh / 2, Math.atan2(uy, ux) + (R() - 0.5) * 0.3, 0, 7); g.fill();
        g.fillStyle = 'rgba(235, 230, 215, .28)'; g.beginPath(); g.ellipse(x - 0.04, y - 0.04, sw / 3.4, sh / 3.6, Math.atan2(uy, ux), 0, 7); g.fill();
        if (R() < 0.12) { g.fillStyle = 'rgba(120, 140, 60, .6)'; g.beginPath(); g.arc(x, y, 0.06, 0, 7); g.fill(); }
        t += sw + 0.03;
      }
    }
    // coping stones along the top
    let t = 0;
    while (t < L) {
      const sw = 0.12 + R() * 0.1, x = x0 + ux * t + nx * 0.5, y = y0 + uy * t + ny * 0.5;
      g.fillStyle = jit('#6f6c62', 14); g.fillRect(x - Math.abs(ny) * 0.4 - sw / 2 * Math.abs(ux), y - Math.abs(nx) * 0.4 - sw / 2 * Math.abs(uy), Math.abs(ux) * sw + Math.abs(ny) * 0.8, Math.abs(uy) * sw + Math.abs(nx) * 0.8);
      t += sw + 0.05 + R() * 0.03;
    }
  };
  wall(-1, 0, c.w + 1, 0, 0, -1); wall(c.w, -1, c.w, c.h + 1, 1, 0); wall(-1, c.h, c.w + 1, c.h, 0, 1); wall(0, -1, 0, c.h + 1, -1, 0);

  // ---- tree canopies (painted onto their own layer, drawn over the sheep)
  for (const [tx, ty, tr] of c.trees || []) {
    const cols = ['#2f4a2a', '#3b5a31', '#4a6b38', '#5c7c42', '#6f8c4c', '#86a05a'];
    for (let layer = 0; layer < cols.length; layer++) {
      const n = 26 - layer * 3, shrink = 1 - layer * 0.13, off = layer * 0.16 * tr;
      for (let i = 0; i < n; i++) {
        const a = R() * 7, d = Math.sqrt(R()) * tr * shrink * 0.8;
        const x = tx + Math.cos(a) * d - off * 0.6, y = ty + Math.sin(a) * d - off * 0.6;
        k.fillStyle = jit(cols[layer], 16); k.globalAlpha = 0.85;
        k.beginPath(); k.ellipse(x, y, tr * (0.22 + R() * 0.2) * shrink, tr * (0.18 + R() * 0.16) * shrink, R() * 3, 0, 7); k.fill();
      }
    }
    k.globalAlpha = 1;
  }
  return { ground, canopy, ppm };
}
