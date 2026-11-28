// The four reels: palettes, the cut-paper scenery for each, and where the
// creatures live along the river. Pure data and geometry (no DOM), so the
// headless sim can build the same trips the page does.
import { rng, noise1, blobPts, cutPts, stripPts } from './paper.js';

export const WORLD_H = 600;

// one sheet of scenery at parallax/scale p. Shapes are flat point lists.
function layer(p, opts = {}) { return { p, z: opts.z ?? p, sh: opts.sh ?? 2.4, shapes: [], vellum: !!opts.vellum, glow: !!opts.glow }; }
const add = (L, pts, c, extra) => {
  let x0 = Infinity, x1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) { if (pts[i] < x0) x0 = pts[i]; if (pts[i] > x1) x1 = pts[i]; }
  L.shapes.push({ pts, c, x0, x1, ...extra });
};

function hills(L, seed, len, baseY, amp, c, scale = 260, bottom = 612) {
  const n = noise1(seed, scale), n2 = noise1(seed + 9, scale / 3.3);
  const step = 26, per = 22;
  for (let s = -120; s < len + 120; s += step * per) {
    const pts = [];
    for (let k = 0; k <= per; k++) { const x = s + k * step; pts.push(x, baseY - amp * (n(x) * 0.8 + n2(x) * 0.2)); }
    pts.push(s + per * step, bottom, s, bottom);
    add(L, pts, c);
  }
}
function band(L, seed, len, y0, y1, c, wob = 8, extra) { // a strip with ragged top and bottom (mist, banks)
  const r = rng(seed); const step = 30, per = 20;
  for (let s = -120; s < len + 120; s += step * per) {
    const top = [], bot = [];
    for (let k = 0; k <= per; k++) {
      const x = s + k * step;
      top.push(x, y0 + Math.sin(x * 0.011 + seed) * wob + (r() - 0.5) * wob * 0.6);
      bot.push(x, y1 + Math.sin(x * 0.007 + seed * 2) * wob * 0.6 + (r() - 0.5) * wob * 0.4);
    }
    const pts = [...top]; for (let i = bot.length - 2; i >= 0; i -= 2) pts.push(bot[i], bot[i + 1]);
    add(L, pts, c, extra);
  }
}
function pine(L, r, x, gy, h, c, trunk) {
  const w = h * 0.34;
  add(L, cutPts([x - 3, gy, x + 3, gy, x + 2, gy - h * 0.3, x - 2, gy - h * 0.3], r() * 1e9 | 0, 0.6, 10), trunk);
  const tiers = 4;
  for (let t = 0; t < tiers; t++) {
    const y0 = gy - h * 0.18 - t * h * 0.2, ww = w * (1 - t * 0.2);
    add(L, cutPts([x - ww, y0, x + ww, y0, x + ww * 0.15, y0 - h * 0.36, x - ww * 0.15, y0 - h * 0.36], r() * 1e9 | 0, 2, 9), c);
  }
}
function broadTree(L, r, x, gy, h, c, trunk, branches = []) {
  const tw = 8 + h * 0.04;
  add(L, cutPts([x - tw, gy + 4, x + tw, gy + 4, x + tw * 0.6, gy - h * 0.7, x - tw * 0.6, gy - h * 0.7], r() * 1e9 | 0, 1.2, 12), trunk);
  for (const b of branches) {
    const dir = b.x > x ? 1 : -1;
    const line = [x, b.y + 10, (x + b.x) / 2, b.y + 2, b.x + dir * 14, b.y];
    add(L, stripPts(line, 9, 3), trunk);
    add(L, blobPts(b.x + dir * 26, b.y - 10, 22, 13, 0, r() * 1e9 | 0, 14, 0.14), c);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI - Math.PI;
    add(L, blobPts(x + Math.cos(a) * h * 0.28, gy - h * 0.78 + Math.sin(a) * h * 0.16, h * 0.2, h * 0.15, 0, r() * 1e9 | 0, 16, 0.12), c);
  }
}
function reed(L, r, x, gy, h, c, head) {
  const bend = (r() - 0.5) * h * 0.25;
  const line = [x, gy + 6, x + bend * 0.3, gy - h * 0.5, x + bend, gy - h];
  add(L, stripPts(line, 4.5, 1.2), c);
  if (head) add(L, stripPts([x + bend * 0.9, gy - h * 0.86, x + bend * 1.02, gy - h * 0.98], 6, 4), head);
  if (r() < 0.6) { // a leaf blade
    const s = r() < 0.5 ? -1 : 1;
    add(L, stripPts([x, gy - h * 0.2, x + s * h * 0.12, gy - h * 0.45, x + s * h * 0.28, gy - h * 0.5], 5, 0.5), c);
  }
}
function fern(L, r, x, gy, s, c) {
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.42 + (r() - 0.5) * 0.2;
    const len = s * (0.7 + r() * 0.5);
    const ex = x + Math.cos(a) * len, ey = gy + Math.sin(a) * len;
    const mx = x + Math.cos(a) * len * 0.55 - Math.sin(a) * len * 0.12, my = gy + Math.sin(a) * len * 0.55;
    add(L, stripPts([x, gy + 4, mx, my, ex, ey], s * 0.22, 1), c);
  }
}
function spikes(L, r, x, y, h, w, c, down) { // stalactites (down=true) and stalagmites
  const d = down ? 1 : -1;
  add(L, cutPts([x - w, y, x + w, y, x + w * 0.2, y + d * h, x - w * 0.15, y + d * h * 0.96], r() * 1e9 | 0, 1.4, 10), c);
}
function willow(L, r, x, gy, h, c, trunk) {
  add(L, cutPts([x - 9, gy + 4, x + 9, gy + 4, x + 5, gy - h * 0.7, x - 6, gy - h * 0.7], r() * 1e9 | 0, 1.2, 12), trunk);
  add(L, blobPts(x, gy - h * 0.78, h * 0.42, h * 0.2, 0, r() * 1e9 | 0, 18, 0.1), c);
  for (let i = 0; i < 9; i++) {
    const sx = x - h * 0.4 + i * h * 0.1, sy = gy - h * 0.72;
    add(L, stripPts([sx, sy, sx + (r() - 0.5) * 8, sy + h * 0.3, sx + (r() - 0.5) * 14, sy + h * (0.45 + r() * 0.25)], 7, 1.5), c);
  }
}

// species depth (p) and resting height per reel
export const ROUTES = [
  {
    key: 'wood', reel: 1, name: 'The Misty Wood', time: 'Dawn', length: 4500,
    sky: ['#e7b3a2', '#f1d3bb', '#f6e6cc'], sun: { x: 0.72, y: 150, r: 46, c: '#fff4dc' },
    water: { y: 440, top: '#94b5ae', bot: '#577f7c', ripple: '#c4dad0' },
    shadow: 'rgba(40,40,30,.26)', ink: '#2f3f33',
    depth: { puffwick: 0.6, mossback: 0.9, ferngrazer: 0.9 },
    spawns: [
      { sp: 'puffwick', at: 0, y: 300, tut: 0.26 }, { sp: 'mossback', at: 0, y: 436, tut: 0.64 },
      { sp: 'ferngrazer', at: 620, y: 434, cover: 1 },
      { sp: 'puffwick', at: 1050, y: 262, tree: 'a' }, { sp: 'puffwick', at: 1050, y: 300, tree: 'a', dx: 70 }, { sp: 'puffwick', at: 1050, y: 334, tree: 'a', dx: -60 },
      { sp: 'ferngrazer', at: 1500, y: 434, cover: 1 }, { sp: 'ferngrazer', at: 1500, y: 434, cover: 1, dx: 90 },
      { sp: 'mossback', at: 1900, y: 436 },
      { sp: 'puffwick', at: 2250, y: 290 }, { sp: 'puffwick', at: 2250, y: 326, dx: 80 },
      { sp: 'ferngrazer', at: 2650, y: 434, cover: 1 }, { sp: 'puffwick', at: 2750, y: 300 },
      { sp: 'puffwick', at: 3150, y: 268, tree: 'b' }, { sp: 'puffwick', at: 3150, y: 306, tree: 'b', dx: 76 }, { sp: 'puffwick', at: 3150, y: 336, tree: 'b', dx: -64 }, { sp: 'puffwick', at: 3150, y: 290, tree: 'b', dx: -120 },
      { sp: 'mossback', at: 3550, y: 436 }, { sp: 'ferngrazer', at: 3700, y: 434, cover: 1 },
      { sp: 'ferngrazer', at: 4050, y: 434, cover: 1 }, { sp: 'ferngrazer', at: 4050, y: 434, cover: 1, dx: 84 },
    ],
    build(R, len, spawns) {
      const r = rng(R.seed);
      const Ls = [];
      const far = layer(0.12, { sh: 0 }); hills(far, R.seed + 1, len * 0.12 + 1600, 300, 70, '#b5bfab', 320); Ls.push(far);
      const m1 = layer(0.2, { vellum: true, sh: 0 }); band(m1, R.seed + 2, len * 0.2 + 1600, 268, 330, 'rgba(250,240,226,.55)', 10); Ls.push(m1);
      const pn = layer(0.3, { sh: 1.4 }); hills(pn, R.seed + 3, len * 0.3 + 1600, 348, 26, '#8ea392', 200);
      for (let x = -60; x < len * 0.3 + 1600; x += 22 + r() * 30) pine(pn, r, x, 350 - r() * 14, 90 + r() * 70, '#879d8c', '#7a8d7c');
      Ls.push(pn);
      const m2 = layer(0.4, { vellum: true, sh: 0 }); band(m2, R.seed + 4, len * 0.4 + 1600, 318, 372, 'rgba(250,240,226,.5)', 12); Ls.push(m2);
      const pn2 = layer(0.48, { sh: 1.8 });
      for (let x = -60; x < len * 0.48 + 1600; x += 46 + r() * 60) pine(pn2, r, x, 392, 150 + r() * 90, '#617f6c', '#556f5e');
      hills(pn2, R.seed + 5, len * 0.48 + 1600, 392, 10, '#5c7865', 120);
      Ls.push(pn2);
      // big trees whose branches are perches
      const tr = layer(0.6, { sh: 2.2 });
      const perches = spawns.filter((s) => s.sp === 'puffwick');
      const groups = new Map();
      for (const s of perches) { const k = s.tree || 'solo' + s.at + (s.dx || 0); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
      const treeXs = [];
      for (const g of groups.values()) {
        const cx = g.reduce((a, s) => a + s.x, 0) / g.length + (g.length === 1 ? 64 : 12);
        broadTree(tr, r, cx, 420, 330, '#3f6a4b', '#4d3e30', g.map((s) => ({ x: s.x, y: s.y })));
        treeXs.push(cx);
      }
      for (let x = -80; x < len * 0.6 + 1600; x += 260 + r() * 260) {
        if (treeXs.some((t) => Math.abs(t - x) < 220)) continue;
        broadTree(tr, r, x, 420, 260 + r() * 110, '#456f50', '#4d3e30', []);
      }
      Ls.push(tr);
      const bank = layer(0.9, { sh: 2.6 }); band(bank, R.seed + 6, len * 0.9 + 1600, 430, 470, '#5d743c', 5);
      for (let x = -60; x < len * 0.9 + 1600; x += 14 + r() * 30) add(bank, stripPts([x, 436, x + (r() - 0.5) * 6, 420 - r() * 14], 4, 0.6), '#728b46');
      for (let x = -60; x < len * 0.9 + 1600; x += 120 + r() * 200) add(bank, blobPts(x, 436, 16 + r() * 14, 9 + r() * 5, 0, r() * 1e9 | 0, 12, 0.14), '#8c8a78');
      Ls.push(bank);
      const cover = layer(0.9, { z: 0.901, sh: 2.2 });
      for (const s of spawns) if (s.cover) { fern(cover, r, s.x - 12, 438, 48, '#4c7a36'); fern(cover, r, s.x + 14, 440, 42, '#558440'); fern(cover, r, s.x + 2, 442, 34, '#3f6c2e'); }
      for (let x = 0; x < len * 0.9 + 1600; x += 160 + r() * 260) if (!spawns.some((s) => s.cover && Math.abs(s.x - x) < 120)) fern(cover, r, x, 440, 30 + r() * 16, '#4f7d39');
      Ls.push(cover);
      const fg = layer(1.25, { sh: 3 });
      for (let x = 300; x < len * 1.25 + 1800; x += 900 + r() * 900) { fern(fg, r, x, 612, 120 + r() * 50, '#2f4a2c'); }
      return { layers: Ls, fg };
    },
  },
  {
    key: 'marsh', reel: 2, name: 'The Reed Marsh', time: 'Midday', length: 4600,
    sky: ['#97c4d6', '#cfe2dc', '#efeccf'], sun: { x: 0.24, y: 82, r: 38, c: '#fffbe6' },
    water: { y: 418, top: '#86afab', bot: '#4b777b', ripple: '#c9e0d6' },
    shadow: 'rgba(60,40,10,.26)', ink: '#3b2d16',
    depth: { stiltbill: 0.78, reedotter: 1.0, boomer: 0.9 },
    spawns: [
      { sp: 'stiltbill', at: 300, y: 462 }, { sp: 'reedotter', at: 520, y: 530 },
      { sp: 'boomer', at: 850, y: 486 },
      { sp: 'stiltbill', at: 1200, y: 460 }, { sp: 'stiltbill', at: 1200, y: 466, dx: 110 },
      { sp: 'reedotter', at: 1550, y: 536 }, { sp: 'boomer', at: 1800, y: 488 },
      { sp: 'boomer', at: 2150, y: 484 }, { sp: 'boomer', at: 2150, y: 490, dx: 120 }, { sp: 'reedotter', at: 2400, y: 528 },
      { sp: 'stiltbill', at: 2750, y: 462 }, { sp: 'stiltbill', at: 2750, y: 458, dx: -100 },
      { sp: 'reedotter', at: 3100, y: 534 }, { sp: 'reedotter', at: 3150, y: 524, dx: 120 },
      { sp: 'boomer', at: 3500, y: 486 }, { sp: 'stiltbill', at: 3800, y: 462 },
      { sp: 'reedotter', at: 4100, y: 530 }, { sp: 'boomer', at: 4150, y: 488, dx: 90 },
    ],
    build(R, len, spawns) {
      const r = rng(R.seed); const Ls = [];
      const far = layer(0.1, { sh: 0 }); hills(far, R.seed + 1, len * 0.1 + 1600, 330, 26, '#a7b39a', 160);
      for (let x = -60; x < len * 0.1 + 1600; x += 30 + r() * 50) add(far, blobPts(x, 318 - r() * 10, 26 + r() * 14, 16 + r() * 8, 0, r() * 1e9 | 0, 12, 0.1), '#9eac92');
      Ls.push(far);
      const fields = layer(0.22, { sh: 1 }); hills(fields, R.seed + 2, len * 0.22 + 1600, 350, 14, '#d9be72', 300);
      hills(fields, R.seed + 3, len * 0.22 + 1600, 372, 10, '#cfa85a', 200); Ls.push(fields);
      const rd1 = layer(0.42, { sh: 1.6 });
      for (let x = -60; x < len * 0.42 + 1600; x += 5 + r() * 7) reed(rd1, r, x, 404, 70 + r() * 50, '#c8a050', r() < 0.4 ? '#8a5a2a' : null);
      band(rd1, R.seed + 4, len * 0.42 + 1600, 396, 420, '#b89040', 4); Ls.push(rd1);
      const rd2 = layer(0.6, { sh: 2 });
      for (let x = -60; x < len * 0.6 + 1600; x += 6 + r() * 10) {
        if (r() < 0.25) { x += 60 + r() * 120; continue; }
        reed(rd2, r, x, 420, 110 + r() * 70, '#b5852f', r() < 0.5 ? '#6f4320' : null);
      }
      Ls.push(rd2);
      const rip = layer(0.78, { sh: 0 });
      for (let x = 0; x < len * 0.78 + 1600; x += 60 + r() * 120) add(rip, stripPts([x, 448 + r() * 30, x + 40 + r() * 60, 448 + r() * 30], 2.5, 2.5), 'rgba(220,236,226,.55)');
      Ls.push(rip);
      const pads = layer(0.9, { sh: 1.8 });
      for (const s of spawns) if (s.sp === 'boomer') add(pads, blobPts(s.x, s.y + 2, 46, 10, 0, r() * 1e9 | 0, 16, 0.06), '#6f9440');
      for (let x = 0; x < len * 0.9 + 1600; x += 90 + r() * 200) add(pads, blobPts(x, 480 + r() * 30, 18 + r() * 16, 5 + r() * 3, 0, r() * 1e9 | 0, 12, 0.08), '#7a9e48');
      Ls.push(pads);
      const fg = layer(1.3, { sh: 3 });
      for (let x = 500; x < len * 1.3 + 1800; x += 700 + r() * 900) for (let k = 0; k < 7; k++) reed(fg, r, x + k * 9, 612, 230 + r() * 120, '#7a5a22', r() < 0.5 ? '#4a2e12' : null);
      return { layers: Ls, fg };
    },
  },
  {
    key: 'caves', reel: 3, name: 'The Glow Caves', time: 'Underground', length: 4400, dark: true,
    sky: ['#120d1f', '#1b1430', '#251c3c'],
    water: { y: 444, top: '#141026', bot: '#06040c', ripple: 'rgba(130,240,210,.35)' },
    shadow: 'rgba(0,0,0,.45)', ink: '#0c0816',
    depth: { lampjelly: 0.72, shellcap: 0.86, hushbat: 0.66 },
    spawns: [
      { sp: 'lampjelly', at: 250, y: 260 }, { sp: 'shellcap', at: 450, y: 424 },
      { sp: 'hushbat', at: 800, y: 118 }, { sp: 'hushbat', at: 800, y: 112, dx: 50 }, { sp: 'hushbat', at: 800, y: 124, dx: -46 },
      { sp: 'lampjelly', at: 1150, y: 230 }, { sp: 'lampjelly', at: 1180, y: 300, dx: 80 },
      { sp: 'shellcap', at: 1500, y: 424 }, { sp: 'shellcap', at: 1520, y: 424, dx: 80 },
      { sp: 'hushbat', at: 1900, y: 116 }, { sp: 'hushbat', at: 1900, y: 122, dx: 56 },
      { sp: 'lampjelly', at: 2250, y: 250 }, { sp: 'shellcap', at: 2450, y: 424 },
      { sp: 'lampjelly', at: 2800, y: 220 }, { sp: 'lampjelly', at: 2820, y: 280, dx: -70 }, { sp: 'lampjelly', at: 2840, y: 330, dx: 60 },
      { sp: 'hushbat', at: 3200, y: 120 }, { sp: 'shellcap', at: 3400, y: 424 },
      { sp: 'hushbat', at: 3750, y: 114 }, { sp: 'hushbat', at: 3750, y: 120, dx: 60 }, { sp: 'lampjelly', at: 3950, y: 270 },
    ],
    build(R, len, spawns) {
      const r = rng(R.seed); const Ls = [];
      const wall = layer(0.14, { sh: 0 });
      hills(wall, R.seed + 1, len * 0.14 + 1600, 380, 120, '#2a2044', 220);
      for (let x = -60; x < len * 0.14 + 1600; x += 30 + r() * 40) spikes(wall, r, x, -10, 90 + r() * 120, 18 + r() * 20, '#2a2044', true);
      Ls.push(wall);
      const mid = layer(0.38, { sh: 1.6 });
      for (let x = -60; x < len * 0.38 + 1600; x += 24 + r() * 40) spikes(mid, r, x, -10, 50 + r() * 110, 12 + r() * 14, '#382c5c', true);
      for (let x = -60; x < len * 0.38 + 1600; x += 40 + r() * 70) spikes(mid, r, x, 430, 30 + r() * 80, 14 + r() * 16, '#30264f', false);
      band(mid, R.seed + 2, len * 0.38 + 1600, -20, 30, '#382c5c', 10);
      for (let x = 0; x < len * 0.38 + 1600; x += 50 + r() * 90) add(mid, blobPts(x, 380 + r() * 60, 2.5, 2.5, 0, 1, 8, 0), r() < 0.5 ? '#6fe0c4' : '#c88cf0', { glow: 14 });
      Ls.push(mid);
      const roof = layer(0.66, { sh: 2.4 });
      band(roof, R.seed + 3, len * 0.66 + 1600, -30, 84, '#231a3c', 12);
      for (let x = -60; x < len * 0.66 + 1600; x += 30 + r() * 50) {
        if (spawns.some((s) => s.sp === 'hushbat' && Math.abs(s.x - x) < 26)) continue;
        spikes(roof, r, x, 70, 40 + r() * 90, 12 + r() * 12, '#231a3c', true);
      }
      Ls.push(roof);
      const ledge = layer(0.86, { sh: 2.6 }); band(ledge, R.seed + 4, len * 0.86 + 1600, 424, 470, '#2c2347', 6);
      for (let x = 0; x < len * 0.86 + 1600; x += 50 + r() * 90) {
        const tall = 10 + r() * 22, c = r() < 0.55 ? '#7ff0d0' : '#e597ff';
        add(ledge, stripPts([x, 428, x + 1, 428 - tall], 3, 2.4), '#d8cfe8');
        add(ledge, blobPts(x + 1, 428 - tall, 7 + r() * 5, 4, 0, r() * 1e9 | 0, 10, 0.05, Math.PI, Math.PI * 2), c, { glow: 26 });
      }
      for (let x = -60; x < len * 0.86 + 1600; x += 90 + r() * 120) spikes(ledge, r, x, 430, 20 + r() * 40, 14 + r() * 12, '#2c2347', false);
      Ls.push(ledge);
      const fg = layer(1.28, { sh: 3 });
      for (let x = 400; x < len * 1.28 + 1800; x += 800 + r() * 1000) spikes(fg, r, x, 614, 200 + r() * 160, 40 + r() * 30, '#08060f', false);
      for (let x = 900; x < len * 1.28 + 1800; x += 900 + r() * 1100) spikes(fg, r, x, -14, 150 + r() * 100, 36 + r() * 30, '#08060f', true);
      return { layers: Ls, fg };
    },
  },
  {
    key: 'night', reel: 4, name: 'The River at Night', time: 'Midnight', length: 4600, dark: true,
    sky: ['#0d1430', '#1d2b52', '#33426c'], moon: { x: 0.74, y: 104, r: 36, c: '#f5edd2' },
    water: { y: 446, top: '#24365e', bot: '#0b1430', ripple: 'rgba(240,232,200,.5)' },
    shadow: 'rgba(0,0,10,.42)', ink: '#0b1124',
    depth: { gloamer: 0.9, wisps: 0.78, moonmoth: 0.82 },
    spawns: [
      { sp: 'wisps', at: 250, y: 300 }, { sp: 'moonmoth', at: 500, y: 330 },
      { sp: 'gloamer', at: 850, y: 452 },
      { sp: 'wisps', at: 1250, y: 270 }, { sp: 'moonmoth', at: 1450, y: 316 }, { sp: 'moonmoth', at: 1450, y: 344, dx: 90 },
      { sp: 'gloamer', at: 1850, y: 452 },
      { sp: 'wisps', at: 2200, y: 290 }, { sp: 'moonmoth', at: 2500, y: 330 },
      { sp: 'gloamer', at: 2850, y: 452 }, { sp: 'wisps', at: 3150, y: 260 },
      { sp: 'moonmoth', at: 3450, y: 320 }, { sp: 'gloamer', at: 3800, y: 452 }, { sp: 'wisps', at: 4100, y: 300 },
    ],
    build(R, len, spawns) {
      const r = rng(R.seed); const Ls = [];
      const far = layer(0.1, { sh: 0 }); hills(far, R.seed + 1, len * 0.1 + 1600, 360, 60, '#22305a', 280); Ls.push(far);
      const wl = layer(0.4, { sh: 1.6 });
      for (let x = -60; x < len * 0.4 + 1600; x += 140 + r() * 160) willow(wl, r, x, 420, 170 + r() * 80, '#1a2647', '#16203c');
      hills(wl, R.seed + 2, len * 0.4 + 1600, 418, 8, '#18233f', 100); Ls.push(wl);
      const rd = layer(0.82, { sh: 2.2 });
      for (let x = -60; x < len * 0.82 + 1600; x += 7 + r() * 14) {
        if (r() < 0.3) { x += 50 + r() * 100; continue; }
        reed(rd, r, x, 446, 60 + r() * 70, '#162142', r() < 0.4 ? '#0f1830' : null);
      }
      for (const s of spawns) if (s.sp === 'moonmoth') reed(rd, () => 0.5, s.x, 446, 446 - s.y + 20, '#1c2a52', '#121c38');
      Ls.push(rd);
      const bank = layer(0.9, { sh: 2.6 }); band(bank, R.seed + 3, len * 0.9 + 1600, 448, 478, '#1c2645', 5);
      for (let x = -60; x < len * 0.9 + 1600; x += 100 + r() * 200) add(bank, blobPts(x, 454, 18 + r() * 14, 8 + r() * 5, 0, r() * 1e9 | 0, 12, 0.14), '#2a3558');
      Ls.push(bank);
      const fg = layer(1.25, { sh: 3 });
      for (let x = 600; x < len * 1.25 + 1800; x += 800 + r() * 900) for (let k = 0; k < 6; k++) reed(fg, r, x + k * 10, 612, 200 + r() * 140, '#050914', null);
      return { layers: Ls, fg };
    },
  },
];

// lay out a trip: spawn x positions depend on the view width so each group is
// centred on screen when the boat reaches its `at`
export function buildTrip(ri, seed, VW) {
  const R = ROUTES[ri];
  const rr = rng(seed * 31 + 7);
  const spawns = R.spawns.map((s, i) => {
    const p = R.depth[s.sp];
    const jitter = s.tut ? 0 : (rr() - 0.5) * 120;
    return { ...s, id: i, p, x: s.tut ? s.tut * VW : (s.at + jitter) * p + VW / 2 + (s.dx || 0) * p };
  });
  const len = R.length + 400;
  const geo = R.build({ seed: seed * 13 + ri * 101 + 5 }, len, spawns);
  // water ripples drift at p=1
  const rip = layer(1, { sh: 0, z: 0.999 });
  const r2 = rng(seed + 3);
  for (let x = 0; x < len + 1800; x += 50 + r2() * 110) {
    const y = R.water.y + 20 + r2() * (WORLD_H - R.water.y - 30);
    add(rip, stripPts([x, y, x + 50 + r2() * 90, y + (r2() - 0.5) * 3], 2 + (y - R.water.y) / 70, 2), R.water.ripple, { ripple: 1 });
  }
  geo.layers.push(rip);
  return { route: R, ri, seed, spawns, layers: geo.layers, fg: geo.fg, length: R.length };
}
