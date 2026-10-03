// Ladder: the junk the heap is made of. Each kind has its solid parts (convex polygons in metres, origin at the
// bottom centre, y up, each with a material) and a painterly drawing in the same frame.
import { box, circlePts, rect, blob, disc, line, spot, flat, stain, text, fade, shade, rrect, brush, path, hex } from './paint.js';

export const MATS = {
  dirt: { mu: 0.72, snd: 'dirt', word: 'dirt' },
  rubber: { mu: 0.95, snd: 'rubber', word: 'rubber' },
  wood: { mu: 0.62, snd: 'wood', word: 'wood' },
  rust: { mu: 0.52, snd: 'metal', word: 'rusty steel' },
  steel: { mu: 0.4, snd: 'metal', word: 'steel' },
  paint: { mu: 0.3, snd: 'metal', word: 'paintwork' },
  enamel: { mu: 0.22, snd: 'enamel', word: 'enamel' },
  gloss: { mu: 0.15, snd: 'gloss', word: 'lacquer' },
  cloth: { mu: 0.85, snd: 'soft', word: 'upholstery' },
  plastic: { mu: 0.36, snd: 'plastic', word: 'plastic' },
  ghost: { mu: 0, ghost: true },
};
for (const k in MATS) MATS[k].id = k;

const P = (pts, mat) => ({ pts, mat });
const wheel = (ctx, x, y, r, R) => { disc(ctx, x, y, r, fade('#2f2b2b', 0.25), R, { n: 20 }); disc(ctx, x, y, r * 0.52, fade('#b9b3a5', 0.2), R, { n: 30, outline: 0.3 }); spot(ctx, x, y, r * 0.14, [90, 80, 74], 0.7); };
const handle = (ctx, x, y0, y1, c = [205, 200, 188]) => { line(ctx, x, y0, x, y1, 0.045, shade(c, -0.25)); line(ctx, x - 0.008, y0, x - 0.008, y1, 0.025, c); };

export const KINDS = {
  fridge: {
    name: 'the fridge', colors: ['#e9e3d0', '#9fceb4', '#cfb253', '#dd8a77', '#93c0d6'],
    parts: () => [P(box(-0.38, 0, 0.76, 1.8), 'enamel')],
    draw(ctx, o, R) {
      rect(ctx, -0.38, 0, 0.76, 1.8, o.col, R, { r: 0.07, dir: Math.PI / 2, n: 30 });
      line(ctx, -0.36, 1.22, 0.36, 1.22, 0.02, shade(o.col, -0.35), 0.8);
      handle(ctx, 0.27, 1.32, 1.6); handle(ctx, 0.27, 0.72, 1.1);
      rect(ctx, -0.37, 0.02, 0.74, 0.1, shade(o.col, -0.3), R, { outline: 0 });
      spot(ctx, -0.12 + R() * 0.2, 1.45, 0.045, fade(['#e05a3a', '#3a7ad0', '#f2c230'][o.seed % 3], 0.2));
      rect(ctx, -0.2, 0.9, 0.18, 0.13, [246, 240, 225], R, { outline: 0.2, lw: 0.012 });
      if (R() < 0.7) stain(ctx, -0.2 + R() * 0.4, 0.3 + R() * 0.3, 0.12, R);
    },
  },
  washer: {
    name: 'the washing machine', colors: ['#ebe6d6', '#d8d2c1', '#a6c9c2'],
    parts: () => [P(box(-0.33, 0, 0.66, 0.86), 'enamel')],
    draw(ctx, o, R) {
      rect(ctx, -0.33, 0, 0.66, 0.86, o.col, R, { r: 0.04 });
      rect(ctx, -0.32, 0.7, 0.64, 0.15, shade(o.col, -0.12), R, { outline: 0.25 });
      for (let i = 0; i < 3; i++) spot(ctx, 0.05 + i * 0.09, 0.775, 0.03, [120, 110, 104]);
      disc(ctx, -0.02, 0.36, 0.22, shade(o.col, -0.15), R, { n: 20 });
      disc(ctx, -0.02, 0.36, 0.15, fade('#6f8d9a', 0.15), R, { n: 40 });
      spot(ctx, 0.04, 0.42, 0.04, [235, 240, 236], 0.6);
    },
  },
  stove: {
    name: 'the stove', colors: ['#ede2c7', '#e0a982', '#b3c7a0'],
    parts: () => [P(box(-0.38, 0, 0.76, 0.9), 'enamel')],
    draw(ctx, o, R) {
      rect(ctx, -0.38, 0, 0.76, 0.9, o.col, R, { r: 0.03 });
      rect(ctx, -0.36, 0.74, 0.72, 0.12, shade(o.col, -0.1), R, { outline: 0.2 });
      for (let i = 0; i < 4; i++) disc(ctx, -0.24 + i * 0.16, 0.8, 0.035, [70, 64, 62], R, { outline: 0 });
      rect(ctx, -0.3, 0.12, 0.6, 0.52, shade(o.col, -0.08), R, { outline: 0.3 });
      rect(ctx, -0.22, 0.24, 0.44, 0.28, fade('#3b302d', 0.2), R, { outline: 0 });
      line(ctx, -0.22, 0.6, 0.22, 0.6, 0.03, [200, 196, 186]);
    },
  },
  car: {
    name: 'the car', colors: ['#b4523e', '#5d8aa6', '#7d9a62', '#d8b45c', '#9a7fae', '#d7d0c2'],
    parts: () => [
      P([[-2.2, 0.3], [2.2, 0.3], [2.28, 0.86], [2.05, 1.0], [-2.12, 1.0], [-2.28, 0.82]], 'paint'),
      P([[-1.32, 1.0], [1.3, 1.0], [0.82, 1.47], [-0.86, 1.47]], 'paint'),
      P(circlePts(-1.42, 0.33, 0.33, 8, Math.PI / 8), 'rubber'), P(circlePts(1.42, 0.33, 0.33, 8, Math.PI / 8), 'rubber'),
    ],
    draw(ctx, o, R) {
      blob(ctx, [[-1.32, 0.98], [1.3, 0.98], [0.82, 1.47], [-0.86, 1.47]], o.col, R);
      flat(ctx, [[-1.14, 1.03], [-0.05, 1.03], [-0.05, 1.4], [-0.8, 1.4]], fade('#9fb7c0', 0.2));
      flat(ctx, [[0.05, 1.03], [1.12, 1.03], [0.76, 1.4], [0.05, 1.4]], fade('#9fb7c0', 0.2));
      line(ctx, -0.6, 1.36, -0.3, 1.1, 0.03, [240, 245, 240], 0.45);
      blob(ctx, [[-2.2, 0.3], [2.2, 0.3], [2.28, 0.86], [2.05, 1.0], [-2.12, 1.0], [-2.28, 0.82]], o.col, R, { n: 26 });
      line(ctx, -0.05, 0.36, -0.05, 0.98, 0.02, shade(o.col, -0.4), 0.6); line(ctx, 1.15, 0.38, 1.18, 0.98, 0.02, shade(o.col, -0.4), 0.6);
      line(ctx, -0.35, 0.82, -0.15, 0.82, 0.04, [210, 205, 192]); line(ctx, 0.78, 0.82, 0.98, 0.82, 0.04, [210, 205, 192]);
      line(ctx, -2.3, 0.42, -1.9, 0.42, 0.09, [196, 192, 182]); line(ctx, 1.9, 0.42, 2.3, 0.42, 0.09, [196, 192, 182]);
      spot(ctx, 2.18, 0.72, 0.07, [250, 236, 190]); spot(ctx, -2.2, 0.7, 0.06, [214, 88, 70]);
      for (let i = 0; i < 3; i++) stain(ctx, -1.8 + R() * 3.6, 0.45 + R() * 0.35, 0.16, R);
      wheel(ctx, -1.42, 0.33, 0.33, R); wheel(ctx, 1.42, 0.33, 0.33, R);
    },
  },
  crushed: {
    name: 'a crushed car', colors: ['#b4523e', '#5d8aa6', '#7d9a62', '#d8b45c', '#8c8a88', '#9a7fae'],
    parts: o => { const w = o.w || 3.6; return [P(box(-w / 2, 0, w, o.h || 1.0), 'rust')]; },
    draw(ctx, o, R) {
      const h = o.h || 1.0, w = o.w || 3.6;
      rect(ctx, -w / 2, 0, w, h, o.col, R, { n: 40, rough: 0.14 });
      for (let i = 1; i < 5; i++) {
        const y = h * i / 5 + (R() - 0.5) * 0.06; ctx.strokeStyle = 'rgba(70,40,36,0.45)'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(-w / 2, y);
        for (let x = -w / 2; x <= w / 2; x += 0.3) ctx.lineTo(x, y + (R() - 0.5) * 0.08); ctx.stroke();
      }
      flat(ctx, [[-0.6, h * 0.55], [0.4, h * 0.6], [0.3, h * 0.72], [-0.5, h * 0.68]], fade('#9fb7c0', 0.25), 0.8);
      spot(ctx, w / 2 - 0.2, h * 0.3, 0.07, [250, 236, 190]);
      disc(ctx, -w / 2 + 0.7, h * 0.18, 0.15, fade('#2f2b2b', 0.25), R, { n: 10, outline: 0.2 });
      for (let i = 0; i < 5; i++) stain(ctx, -w / 2 + 0.2 + R() * (w - 0.4), R() * h, 0.2, R, [140, 80, 50], 0.35);
    },
  },
  piano: {
    name: 'the piano', colors: ['#4a3530', '#6b4a36', '#2f2b33', '#7a5a43'],
    parts: () => [P(box(-0.76, 0.06, 1.52, 1.26), 'gloss')],
    draw(ctx, o, R) {
      rect(ctx, -0.76, 0.06, 1.52, 1.26, o.col, R, { n: 30, rough: 0.05 });
      rect(ctx, -0.78, 1.26, 1.56, 0.07, shade(o.col, 0.1), R, { outline: 0.3 });
      rect(ctx, -0.7, 0.6, 1.4, 0.16, [236, 228, 208], R, { outline: 0.3, n: 10 });
      for (let i = 0; i < 20; i++) { const x = -0.68 + i * 0.07; if (i % 7 !== 2 && i % 7 !== 6) flat(ctx, box(x + 0.045, 0.67, 0.04, 0.09), [40, 34, 34]); line(ctx, x, 0.6, x, 0.76, 0.006, [120, 110, 100], 0.6); }
      rect(ctx, -0.7, 0.76, 1.4, 0.06, shade(o.col, -0.15), R, { outline: 0 });
      rect(ctx, -0.55, 0.9, 1.1, 0.3, shade(o.col, 0.08), R, { outline: 0.25 });
      text(ctx, 'STEINWALD', 0, 0.84, 0.05, [210, 180, 110], 0.8, { spacing: 1 });
      rect(ctx, -0.74, 0.06, 0.1, 0.54, shade(o.col, -0.1), R, { outline: 0.2 }); rect(ctx, 0.64, 0.06, 0.1, 0.54, shade(o.col, -0.1), R, { outline: 0.2 });
      spot(ctx, -0.69, 0.05, 0.05, [170, 150, 90]); spot(ctx, 0.69, 0.05, 0.05, [170, 150, 90]);
      line(ctx, 0.3, 1.25, 0.1, 0.95, 0.025, [255, 250, 235], 0.25);
    },
  },
  grand: {
    pad: 0.3, name: 'the grand piano', colors: ['#2f2b33', '#4a3530'],
    parts: () => [
      P([[-1.05, 0.62], [1.0, 0.62], [1.05, 0.8], [1.0, 0.98], [-1.05, 0.98]], 'gloss'),
      P([[-0.98, 0.98], [-0.86, 0.98], [0.98, 1.88], [0.92, 2.02]], 'gloss'),
      P(box(-0.92, 0, 0.12, 0.62), 'wood'), P(box(0.78, 0, 0.12, 0.62), 'wood'),
    ],
    draw(ctx, o, R) {
      line(ctx, 0.35, 0.98, 0.42, 1.48, 0.03, [150, 120, 80]);
      blob(ctx, [[-0.98, 0.98], [-0.86, 0.98], [0.98, 1.88], [0.92, 2.02]], shade(o.col, 0.12), R, { dir: 0.45 });
      line(ctx, -0.7, 1.1, 0.7, 1.82, 0.02, [255, 250, 235], 0.22);
      rect(ctx, -0.92, 0, 0.12, 0.62, shade(o.col, -0.05), R, { outline: 0.3 }); rect(ctx, 0.78, 0, 0.12, 0.62, shade(o.col, -0.05), R, { outline: 0.3 });
      blob(ctx, [[-1.05, 0.62], [1.0, 0.62], [1.05, 0.8], [1.0, 0.98], [-1.05, 0.98]], o.col, R);
      rect(ctx, -1.14, 0.78, 0.12, 0.08, [236, 228, 208], R, { outline: 0.3 });
      line(ctx, -0.9, 0.93, 0.9, 0.93, 0.012, [210, 180, 110], 0.7);
    },
  },
  scaffold: {
    name: 'the scaffolding', colors: ['#9a9a98'],
    // one level of a scaffold tower: two poles and a plank on top. w is the width between poles.
    parts: o => { const w = o.w || 2.4, h = o.h || 2.0; return [P(box(-w / 2, 0, 0.1, h - 0.16), 'steel'), P(box(w / 2 - 0.1, 0, 0.1, h - 0.16), 'steel'), P(box(-w / 2 - 0.25, h - 0.16, w + 0.5, 0.16), 'wood')]; },
    draw(ctx, o, R) {
      const w = o.w || 2.4, h = o.h || 2.0, pole = fade('#8f9496', 0.2);
      line(ctx, -w / 2 + 0.05, 0.1, w / 2 - 0.05, h - 0.25, 0.05, shade(pole, -0.1), 0.85);
      line(ctx, -w / 2 + 0.05, h * 0.5, w / 2 - 0.05, h * 0.5, 0.045, shade(pole, -0.05), 0.85);
      rect(ctx, -w / 2, 0, 0.1, h - 0.16, pole, R, { n: 20, outline: 0.3, lw: 0.02 }); rect(ctx, w / 2 - 0.1, 0, 0.1, h - 0.16, pole, R, { n: 20, outline: 0.3, lw: 0.02 });
      for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const y of [0.1, h * 0.5]) spot(ctx, x, y, 0.06, [110, 104, 96]);
      rect(ctx, -w / 2 - 0.25, h - 0.16, w + 0.5, 0.16, fade('#c69a5e', 0.25), R, { n: 60 });
      for (let x = -w / 2 - 0.1; x < w / 2 + 0.2; x += 0.5 + R() * 0.4) line(ctx, x, h - 0.15, x + 0.02, h - 0.02, 0.012, [120, 84, 50], 0.4);
    },
  },
  crate: {
    name: 'the crate', colors: ['#c9a06a', '#b98b57', '#d6b47e'],
    parts: o => [P(box(-(o.w || 1) / 2, 0, o.w || 1, o.h || 1), 'wood')],
    draw(ctx, o, R) {
      const w = o.w || 1, h = o.h || 1;
      rect(ctx, -w / 2, 0, w, h, o.col, R, { n: 50 });
      for (let y = h / 4; y < h - 0.05; y += h / 4) line(ctx, -w / 2, y, w / 2, y, 0.015, shade(o.col, -0.4), 0.5);
      line(ctx, -w / 2 + 0.06, 0.06, w / 2 - 0.06, h - 0.06, 0.07, shade(o.col, -0.12), 0.9);
      for (const [x, y] of [[-w / 2 + 0.06, 0.06], [w / 2 - 0.06, 0.06], [-w / 2 + 0.06, h - 0.06], [w / 2 - 0.06, h - 0.06]]) spot(ctx, x, y, 0.02, [80, 60, 50]);
      if (o.seed % 3 === 0) text(ctx, 'FRAGILE', 0, h * 0.5, Math.min(0.16, w * 0.15), [160, 60, 50], 0.55, { rot: -0.1 });
      else if (o.seed % 3 === 1) text(ctx, 'THIS WAY UP ↑', 0, h * 0.62, Math.min(0.1, w * 0.09), [60, 50, 50], 0.5);
    },
  },
  tires: {
    name: 'the tyres', colors: ['#3a3434'],
    parts: o => [P(box(-0.42, 0, 0.84, 0.27 * (o.n || 3)), 'rubber')],
    draw(ctx, o, R) {
      const n = o.n || 3;
      for (let i = 0; i < n; i++) {
        const dx = (R() - 0.5) * 0.04;
        rect(ctx, -0.42 + dx, i * 0.27, 0.84, 0.27, fade('#353030', 0.22), R, { r: 0.1, n: 30 });
        line(ctx, -0.36 + dx, i * 0.27 + 0.135, 0.36 + dx, i * 0.27 + 0.135, 0.02, [90, 84, 80], 0.5);
        for (let x = -0.33; x < 0.35; x += 0.11) line(ctx, x + dx, i * 0.27 + 0.05, x + dx + 0.03, i * 0.27 + 0.22, 0.012, [25, 22, 22], 0.4);
      }
    },
  },
  tire: {
    name: 'a tyre', colors: ['#3a3434'],
    parts: () => [P(circlePts(0, 0.4, 0.4, 10), 'rubber')],
    draw(ctx, o, R) { disc(ctx, 0, 0.4, 0.4, fade('#353030', 0.2), R, { n: 30 }); disc(ctx, 0, 0.4, 0.22, fade('#5b5450', 0.2), R, { n: 20, outline: 0.3 }); spot(ctx, 0, 0.4, 0.12, [60, 50, 48]); },
  },
  drum: {
    name: 'the oil drum', colors: ['#3f6e8c', '#b5523d', '#d0a63f', '#5e7d4d'],
    parts: () => [P(box(-0.29, 0, 0.58, 0.88), 'steel')],
    draw(ctx, o, R) {
      rect(ctx, -0.29, 0, 0.58, 0.88, o.col, R, { n: 40, dir: Math.PI / 2 });
      for (const y of [0.04, 0.3, 0.58, 0.84]) line(ctx, -0.3, y, 0.3, y, 0.035, shade(o.col, -0.2));
      for (let i = 0; i < 3; i++) stain(ctx, -0.2 + R() * 0.4, R() * 0.8, 0.1, R);
    },
  },
  barrel: {
    name: 'the oil drum', colors: ['#3f6e8c', '#b5523d', '#d0a63f'],
    parts: () => [P(circlePts(0, 0.3, 0.3, 12), 'steel')],
    draw(ctx, o, R) { disc(ctx, 0, 0.3, 0.3, o.col, R, { n: 30 }); disc(ctx, 0, 0.3, 0.22, shade(o.col, -0.12), R, { outline: 0.3 }); spot(ctx, 0.08, 0.36, 0.04, [60, 50, 48]); },
  },
  mattress: {
    name: 'the mattress', colors: ['#e7dcc5', '#d9c3b5'],
    parts: o => [P(box(-(o.w || 1.9) / 2, 0, o.w || 1.9, 0.24), 'cloth')],
    draw(ctx, o, R) {
      const w = o.w || 1.9;
      rect(ctx, -w / 2, 0, w, 0.24, o.col, R, { r: 0.08 });
      for (let x = -w / 2 + 0.12; x < w / 2; x += 0.16) line(ctx, x, 0.03, x, 0.21, 0.035, [150, 160, 190], 0.35);
      stain(ctx, R() * 0.6 - 0.3, 0.12, 0.12, R, [190, 150, 90], 0.3);
    },
  },
  sofa: {
    name: 'the sofa', colors: ['#c27b5e', '#7c9a7a', '#c9a64e', '#8e7ca8'],
    parts: () => [P(box(-1.0, 0.08, 2.0, 0.4), 'cloth'), P(box(-1.0, 0.48, 0.26, 0.48), 'cloth'), P(box(0.8, 0.48, 0.2, 0.16), 'cloth')],
    draw(ctx, o, R) {
      rect(ctx, -1.0, 0.48, 0.26, 0.48, shade(o.col, -0.06), R, { r: 0.08 });
      rect(ctx, -1.0, 0.08, 2.0, 0.4, o.col, R, { r: 0.06 });
      rect(ctx, -0.74, 0.44, 0.78, 0.14, shade(o.col, 0.06), R, { r: 0.06 }); rect(ctx, 0.04, 0.44, 0.76, 0.14, shade(o.col, 0.04), R, { r: 0.06 });
      rect(ctx, 0.8, 0.48, 0.2, 0.16, o.col, R, { r: 0.06 });
      for (const x of [-0.9, 0.9]) rect(ctx, x - 0.04, 0, 0.08, 0.09, [90, 66, 50], R, { outline: 0 });
    },
  },
  tub: {
    pad: 0.3, name: 'the bathtub', colors: ['#efe8da', '#a9cdd0'],
    parts: () => [P([[-0.78, 0.18], [0.78, 0.18], [0.84, 0.32], [-0.84, 0.32]], 'enamel'), P([[-0.9, 0.3], [-0.68, 0.3], [-0.66, 0.66], [-0.92, 0.66]], 'enamel'), P([[0.68, 0.3], [0.9, 0.3], [0.92, 0.66], [0.66, 0.66]], 'enamel')],
    draw(ctx, o, R) {
      for (const x of [-0.6, 0.6]) { blob(ctx, [[x - 0.08, 0.2], [x + 0.08, 0.2], [x + 0.11, 0], [x - 0.11, 0]], [170, 150, 90], R, { outline: 0.3 }); }
      ctx.beginPath(); ctx.moveTo(-0.92, 0.66); ctx.lineTo(-0.66, 0.66); ctx.quadraticCurveTo(-0.66, 0.32, -0.4, 0.32); ctx.lineTo(0.4, 0.32); ctx.quadraticCurveTo(0.66, 0.32, 0.66, 0.66); ctx.lineTo(0.92, 0.66);
      ctx.quadraticCurveTo(0.95, 0.2, 0.6, 0.18); ctx.lineTo(-0.6, 0.18); ctx.quadraticCurveTo(-0.95, 0.2, -0.92, 0.66); ctx.closePath();
      brush(ctx, o.col, R, [-0.95, 0.18, 0.95, 0.66], { dir: 0 });
      line(ctx, -0.9, 0.66, 0.92, 0.66, 0.035, shade(o.col, 0.15)); spot(ctx, 0.78, 0.7, 0.04, [190, 180, 160]);
    },
  },
  wardrobe: {
    name: 'the wardrobe', colors: ['#8a5e3c', '#a7784c', '#6f5040'],
    parts: () => [P(box(-0.52, 0, 1.04, 2.0), 'wood')],
    draw(ctx, o, R) {
      rect(ctx, -0.52, 0, 1.04, 2.0, o.col, R, { dir: Math.PI / 2, n: 40 });
      rect(ctx, -0.56, 1.92, 1.12, 0.1, shade(o.col, 0.08), R, { outline: 0.3 });
      rect(ctx, -0.46, 0.12, 0.44, 1.72, shade(o.col, 0.05), R, { outline: 0.3, dir: Math.PI / 2 });
      rect(ctx, 0.02, 0.12, 0.44, 1.72, shade(o.col, 0.03), R, { outline: 0.3, dir: Math.PI / 2 });
      rect(ctx, 0.08, 0.5, 0.32, 1.1, fade('#b8cdd2', 0.25), R, { outline: 0.25, dir: Math.PI / 2 });
      line(ctx, 0.12, 1.4, 0.3, 1.1, 0.025, [255, 255, 250], 0.4);
      spot(ctx, -0.06, 1.0, 0.025, [200, 170, 90]); spot(ctx, 0.06, 1.0, 0.025, [200, 170, 90]);
    },
  },
  container: {
    name: 'the shipping container', colors: ['#b5583f', '#3f7690', '#6e8b5a', '#c49a43'],
    parts: o => [P(box(-(o.w || 6) / 2, 0, o.w || 6, 2.6), 'rust')],
    draw(ctx, o, R) {
      const w = o.w || 6;
      rect(ctx, -w / 2, 0, w, 2.6, o.col, R, { n: 22, dir: Math.PI / 2 });
      for (let x = -w / 2 + 0.2; x < w / 2 - 0.1; x += 0.28) line(ctx, x, 0.12, x, 2.48, 0.05, shade(o.col, -0.14), 0.7);
      rect(ctx, -w / 2, 2.46, w, 0.14, shade(o.col, -0.1), R, { outline: 0.3 }); rect(ctx, -w / 2, 0, w, 0.14, shade(o.col, -0.15), R, { outline: 0.3 });
      text(ctx, 'SOL LINES', 0, 1.5, 0.5, [246, 238, 222], 0.6, { spacing: 4 });
      for (let i = 0; i < 6; i++) stain(ctx, -w / 2 + R() * w, R() * 2.4, 0.3, R, [130, 70, 40], 0.4);
    },
  },
  bus: {
    name: 'the school bus', colors: ['#dcae3a'],
    parts: () => [P(box(-4.2, 0.4, 8.4, 2.5), 'paint'), P([[4.2, 0.4], [5.3, 0.4], [5.3, 1.45], [4.2, 1.75]], 'paint'),
      P(circlePts(-2.8, 0.45, 0.45, 8, Math.PI / 8), 'rubber'), P(circlePts(3.2, 0.45, 0.45, 8, Math.PI / 8), 'rubber')],
    draw(ctx, o, R) {
      rect(ctx, -4.2, 0.4, 8.4, 2.5, o.col, R, { n: 18, r: 0.15 });
      blob(ctx, [[4.2, 0.4], [5.3, 0.4], [5.3, 1.45], [4.2, 1.75]], o.col, R);
      for (let i = 0; i < 9; i++) rect(ctx, -3.9 + i * 0.86, 1.75, 0.7, 0.85, fade('#93abb3', 0.25), R, { outline: 0.3, n: 10 });
      line(ctx, -4.2, 1.5, 4.2, 1.5, 0.06, [40, 34, 30], 0.8); line(ctx, -4.2, 1.1, 5.3, 1.1, 0.06, [40, 34, 30], 0.8);
      text(ctx, 'SCHOOL BUS', -0.4, 1.3, 0.24, [40, 34, 30], 0.75, { spacing: 2 });
      line(ctx, -4.3, 0.55, -3.9, 0.55, 0.12, [60, 56, 52]); line(ctx, 5.0, 0.55, 5.4, 0.55, 0.12, [60, 56, 52]);
      spot(ctx, 5.22, 1.25, 0.09, [250, 236, 190]);
      for (let i = 0; i < 8; i++) stain(ctx, -4 + R() * 9, 0.5 + R() * 2.2, 0.25, R, [150, 92, 50], 0.3);
      wheel(ctx, -2.8, 0.45, 0.45, R); wheel(ctx, 3.2, 0.45, 0.45, R);
    },
  },
  boat: {
    name: 'the rowing boat', colors: ['#e5ddca', '#3f7690', '#b5583f'],
    // upside down: gunwale at the bottom, keel on top
    parts: () => [P([[-1.65, 0], [1.65, 0], [1.25, 0.5], [-1.15, 0.58]], 'paint')],
    draw(ctx, o, R) {
      blob(ctx, [[-1.65, 0], [1.65, 0], [1.25, 0.5], [-1.15, 0.58]], o.col, R, { n: 40 });
      line(ctx, -1.6, 0.07, 1.6, 0.07, 0.07, fade('#b5583f', 0.2)); line(ctx, -1.1, 0.58, 1.22, 0.52, 0.05, shade(o.col, -0.3));
      for (let i = 1; i < 4; i++) line(ctx, -1.5 + i * 0.1, 0.12 + i * 0.12, 1.5 - i * 0.1, 0.12 + i * 0.11, 0.012, shade(o.col, -0.3), 0.5);
      text(ctx, 'MAUD', 0.6, 0.24, 0.12, [50, 50, 60], 0.6);
    },
  },
  tv: {
    pad: 0.4, name: 'the television', colors: ['#8c6a4a', '#d8cdb4'],
    parts: () => [P(box(-0.32, 0, 0.64, 0.54), 'plastic')],
    draw(ctx, o, R) {
      rect(ctx, -0.32, 0, 0.64, 0.54, o.col, R, { r: 0.05 });
      rect(ctx, -0.26, 0.07, 0.38, 0.4, fade('#55625f', 0.15), R, { r: 0.07, outline: 0.3 });
      line(ctx, -0.18, 0.38, -0.08, 0.3, 0.02, [230, 240, 236], 0.4);
      spot(ctx, 0.22, 0.38, 0.035, [60, 50, 48]); spot(ctx, 0.22, 0.26, 0.035, [60, 50, 48]);
      line(ctx, -0.05, 0.54, -0.2, 0.8, 0.012, [80, 80, 80]); line(ctx, 0.05, 0.54, 0.22, 0.78, 0.012, [80, 80, 80]);
    },
  },
  booth: {
    name: 'the phone box', colors: ['#c8463a'],
    parts: () => [P(box(-0.5, 0, 1.0, 2.4), 'paint')],
    draw(ctx, o, R) {
      rect(ctx, -0.5, 0, 1.0, 2.4, o.col, R, { dir: Math.PI / 2 });
      rect(ctx, -0.54, 2.3, 1.08, 0.14, shade(o.col, 0.05), R, { r: 0.05 });
      rect(ctx, -0.36, 2.06, 0.72, 0.16, [235, 228, 210], R, { outline: 0.25 });
      text(ctx, 'TELEPHONE', 0, 2.14, 0.08, [40, 40, 44], 0.85, { spacing: 1 });
      for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) rect(ctx, -0.36 + c * 0.25, 0.4 + r * 0.26, 0.21, 0.22, fade('#a8c0c4', 0.3), R, { outline: 0.2, n: 6 });
    },
  },
  clock: {
    name: 'the grandfather clock', colors: ['#7a5236', '#9a6d45'],
    parts: () => [P(box(-0.28, 0, 0.56, 2.1), 'wood')],
    draw(ctx, o, R) {
      rect(ctx, -0.28, 0, 0.56, 2.1, o.col, R, { dir: Math.PI / 2 });
      rect(ctx, -0.32, 1.98, 0.64, 0.12, shade(o.col, 0.06), R, { outline: 0.3 });
      disc(ctx, 0, 1.68, 0.2, [236, 226, 200], R, { outline: 0.4 });
      line(ctx, 0, 1.68, 0.03, 1.82, 0.018, [40, 30, 30]); line(ctx, 0, 1.68, 0.12, 1.64, 0.018, [40, 30, 30]);
      rect(ctx, -0.14, 0.45, 0.28, 0.9, fade('#4c3a30', 0.1), R, { outline: 0.3 });
      line(ctx, 0, 1.3, 0.02, 0.7, 0.012, [190, 160, 80]); spot(ctx, 0.02, 0.68, 0.07, [200, 170, 80]);
    },
  },
  beam: {
    name: 'the girder', colors: ['#b0644a', '#8e8f8c'],
    parts: o => [P(box(-(o.l || 4) / 2, 0, o.l || 4, 0.3), 'steel')],
    draw(ctx, o, R) {
      const l = o.l || 4;
      rect(ctx, -l / 2, 0, l, 0.3, o.col, R, { n: 50 });
      line(ctx, -l / 2, 0.04, l / 2, 0.04, 0.05, shade(o.col, -0.2)); line(ctx, -l / 2, 0.26, l / 2, 0.26, 0.05, shade(o.col, 0.12));
      for (let x = -l / 2 + 0.2; x < l / 2; x += 0.4) { spot(ctx, x, 0.08, 0.02, shade(o.col, -0.35)); spot(ctx, x, 0.22, 0.02, shade(o.col, -0.35)); }
      for (let i = 0; i < l; i++) stain(ctx, -l / 2 + R() * l, 0.15, 0.12, R, [130, 70, 40], 0.4);
    },
  },
  plank: {
    name: 'the plank', colors: ['#c79d64', '#b48a55'],
    parts: o => [P(box(-(o.l || 3) / 2, 0, o.l || 3, 0.2), 'wood')],
    draw(ctx, o, R) {
      const l = o.l || 3;
      rect(ctx, -l / 2, 0, l, 0.2, o.col, R, { n: 60 });
      for (let i = 0; i < l * 2; i++) { const x = -l / 2 + R() * l; line(ctx, x, 0.05, x + 0.3, 0.06 + R() * 0.08, 0.01, shade(o.col, -0.3), 0.4); }
      spot(ctx, -l / 2 + 0.1, 0.1, 0.02, [70, 60, 60]); spot(ctx, l / 2 - 0.1, 0.1, 0.02, [70, 60, 60]);
    },
  },
  door: {
    name: 'the old door', colors: ['#7aa3a0', '#c4b48a', '#a85c4a'],
    parts: () => [P(box(-0.45, 0, 0.9, 2.0), 'wood')],
    draw(ctx, o, R) {
      rect(ctx, -0.45, 0, 0.9, 2.0, o.col, R, { dir: Math.PI / 2 });
      for (const [y, h] of [[0.15, 0.75], [1.05, 0.8]]) { rect(ctx, -0.32, y, 0.26, h, shade(o.col, -0.07), R, { outline: 0.3 }); rect(ctx, 0.06, y, 0.26, h, shade(o.col, -0.07), R, { outline: 0.3 }); }
      spot(ctx, 0.36, 1.0, 0.04, [200, 170, 90]);
      for (let i = 0; i < 4; i++) stain(ctx, -0.3 + R() * 0.6, R() * 1.8, 0.1, R, [235, 230, 215], 0.5);
    },
  },
  cabinet: {
    name: 'the filing cabinet', colors: ['#8a9a88', '#a3a9ae', '#c2b28a'],
    parts: () => [P(box(-0.25, 0, 0.5, 1.32), 'steel')],
    draw(ctx, o, R) {
      rect(ctx, -0.25, 0, 0.5, 1.32, o.col, R, { dir: Math.PI / 2 });
      for (let i = 0; i < 4; i++) { rect(ctx, -0.21, 0.05 + i * 0.32, 0.42, 0.28, shade(o.col, 0.04), R, { outline: 0.3, n: 8 }); line(ctx, -0.08, 0.25 + i * 0.32, 0.08, 0.25 + i * 0.32, 0.03, [200, 196, 186]); rect(ctx, -0.06, 0.12 + i * 0.32, 0.12, 0.06, [236, 230, 214], R, { outline: 0.2, n: 2 }); }
    },
  },
  vending: {
    name: 'the vending machine', colors: ['#c64a3d', '#3f6f9a'],
    parts: () => [P(box(-0.46, 0, 0.92, 1.86), 'paint')],
    draw(ctx, o, R) {
      rect(ctx, -0.46, 0, 0.92, 1.86, o.col, R, { dir: Math.PI / 2, r: 0.04 });
      rect(ctx, -0.38, 0.6, 0.5, 1.1, fade('#bcd2d4', 0.2), R, { outline: 0.3 });
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) rect(ctx, -0.34 + c * 0.11, 0.68 + r * 0.26, 0.07, 0.16, fade(['#e05a3a', '#f2c230', '#3a9a6a', '#3a7ad0'][(r + c) % 4], 0.3), R, { outline: 0, n: 2 });
      rect(ctx, 0.2, 1.1, 0.18, 0.3, [50, 46, 46], R, { outline: 0.2 }); rect(ctx, -0.34, 0.18, 0.5, 0.2, [40, 36, 36], R, { outline: 0.2 });
      text(ctx, 'COLD', 0, 1.78, 0.1, [250, 245, 230], 0.8, { spacing: 2 });
    },
  },
  jukebox: {
    name: 'the jukebox', colors: ['#c98a4a'],
    parts: () => [P([[-0.45, 0], [0.45, 0], [0.45, 1.25], [0.32, 1.52], [0, 1.6], [-0.32, 1.52], [-0.45, 1.25]], 'gloss')],
    draw(ctx, o, R) {
      blob(ctx, [[-0.45, 0], [0.45, 0], [0.45, 1.25], [0.32, 1.52], [0, 1.6], [-0.32, 1.52], [-0.45, 1.25]], o.col, R);
      ctx.save(); ctx.beginPath(); ctx.arc(0, 1.2, 0.34, Math.PI, 0, true); ctx.lineTo(0.34, 0.75); ctx.lineTo(-0.34, 0.75); ctx.closePath(); ctx.restore();
      brush(ctx, fade('#e8c178', 0.2), R, [-0.34, 0.75, 0.34, 1.54], { outline: 0.3 });
      for (let i = 0; i < 4; i++) line(ctx, -0.3 + i * 0.2, 0.15, -0.3 + i * 0.2, 0.6, 0.06, fade(['#e05a3a', '#3a9a6a', '#3a7ad0', '#f2c230'][i], 0.35));
    },
  },
  dish: {
    pad: 0.7, name: 'the satellite dish', colors: ['#d8d4ca'],
    parts: () => [P([[-0.9, 0.9], [-0.55, 0.62], [0.0, 0.5], [0.55, 0.62], [0.9, 0.9]], 'paint'), P(box(-0.1, 0, 0.2, 0.55), 'steel')],
    draw(ctx, o, R) {
      rect(ctx, -0.1, 0, 0.2, 0.55, [130, 130, 128], R, { outline: 0.3 });
      blob(ctx, [[-0.9, 0.9], [-0.55, 0.62], [0.0, 0.5], [0.55, 0.62], [0.9, 0.9]], o.col, R);
      line(ctx, -0.7, 0.88, 0, 1.5, 0.025, [120, 120, 118]); line(ctx, 0.7, 0.88, 0, 1.5, 0.025, [120, 120, 118]); spot(ctx, 0, 1.5, 0.06, [90, 90, 90]);
    },
  },
  cart: {
    pad: 0.3, name: 'the shopping trolley', colors: ['#b7b9b4'],
    parts: () => [P([[-0.5, 0.34], [0.46, 0.34], [0.56, 0.95], [-0.5, 0.95]], 'steel')],
    draw(ctx, o, R) {
      const c = [150, 152, 148];
      for (let x = -0.48; x <= 0.5; x += 0.08) line(ctx, x, 0.36, x + 0.03 * (x + 0.5), 0.94, 0.012, c);
      for (let y = 0.36; y <= 0.95; y += 0.1) line(ctx, -0.5, y, 0.46 + (y - 0.34) * 0.16, y, 0.012, c);
      line(ctx, -0.5, 0.95, 0.56, 0.95, 0.03, c); line(ctx, -0.5, 0.34, 0.46, 0.34, 0.03, c); line(ctx, -0.5, 0.34, -0.5, 1.12, 0.03, c);
      line(ctx, -0.56, 1.12, -0.42, 1.12, 0.05, fade('#c8463a', 0.3));
      line(ctx, -0.42, 0.34, -0.42, 0.06, 0.025, c); line(ctx, 0.4, 0.34, 0.4, 0.06, 0.025, c);
      spot(ctx, -0.42, 0.05, 0.05, [50, 46, 46]); spot(ctx, 0.4, 0.05, 0.05, [50, 46, 46]);
    },
  },
  horse: {
    pad: 0.5, name: 'the carousel horse', colors: ['#efe5d1', '#e6b8a2'],
    parts: () => [P([[-0.62, 0.95], [0.5, 0.92], [0.78, 1.35], [0.6, 1.5], [-0.55, 1.32]], 'gloss'), P(box(-0.04, 0, 0.08, 2.4), 'steel')],
    draw(ctx, o, R) {
      line(ctx, 0, 0, 0, 2.4, 0.07, [200, 170, 90]); for (let y = 0.1; y < 2.4; y += 0.18) line(ctx, -0.035, y, 0.035, y + 0.09, 0.02, [240, 220, 160], 0.6);
      for (const [x0, x1] of [[-0.45, -0.7], [-0.3, -0.35], [0.3, 0.45], [0.42, 0.75]]) line(ctx, x0, 1.0, x1, 0.62, 0.07, shade(o.col, -0.06));
      blob(ctx, [[-0.62, 0.95], [0.5, 0.92], [0.78, 1.35], [0.6, 1.5], [-0.55, 1.32]], o.col, R);
      blob(ctx, [[0.48, 1.3], [0.66, 1.42], [0.95, 1.4], [0.98, 1.6], [0.72, 1.78], [0.55, 1.62]], o.col, R);
      line(ctx, -0.6, 1.25, -0.85, 0.95, 0.07, [150, 110, 80]); line(ctx, 0.55, 1.62, 0.7, 1.77, 0.08, [150, 110, 80]);
      line(ctx, -0.2, 1.42, 0.25, 1.4, 0.1, fade('#c8463a', 0.3)); spot(ctx, 0.84, 1.6, 0.025, [40, 30, 30]);
    },
  },
  van: {
    name: 'the van', colors: ['#e8e2d2'],
    parts: () => [P(box(-2.4, 0.38, 4.0, 1.9), 'paint'), P([[1.6, 0.38], [2.5, 0.38], [2.5, 1.2], [2.1, 1.55], [1.6, 1.62]], 'paint'),
      P(circlePts(-1.5, 0.36, 0.36, 8, Math.PI / 8), 'rubber'), P(circlePts(1.75, 0.36, 0.36, 8, Math.PI / 8), 'rubber')],
    draw(ctx, o, R) {
      rect(ctx, -2.4, 0.38, 4.0, 1.9, o.col, R, { r: 0.12 });
      blob(ctx, [[1.6, 0.38], [2.5, 0.38], [2.5, 1.2], [2.1, 1.55], [1.6, 1.62]], o.col, R);
      flat(ctx, [[1.68, 1.2], [2.12, 1.2], [1.98, 1.48], [1.68, 1.52]], fade('#9fb7c0', 0.2));
      for (let x = -2.2; x < 1.4; x += 0.5) line(ctx, x, 2.32, x + 0.35, 2.32, 0.06, [130, 120, 110]);
      line(ctx, -2.3, 2.38, 1.5, 2.38, 0.04, [130, 120, 110]);
      text(ctx, 'TOP COAT', -0.4, 1.5, 0.36, fade('#2f5d8a', 0.15), 0.9, { spacing: 2 });
      text(ctx, 'PAINTING & DECORATING', -0.4, 1.12, 0.13, fade('#2f5d8a', 0.15), 0.85, { spacing: 1 });
      for (let i = 0; i < 3; i++) spot(ctx, -1.6 + i * 0.25 + R() * 0.1, 0.8 + R() * 0.2, 0.05 + R() * 0.03, fade(['#e05a3a', '#3a7ad0', '#f2c230'][i], 0.35));
      spot(ctx, 2.42, 0.95, 0.07, [250, 236, 190]);
      wheel(ctx, -1.5, 0.36, 0.36, R); wheel(ctx, 1.75, 0.36, 0.36, R);
    },
  },
  armchair: {
    name: 'the armchair', colors: ['#7c9a7a', '#c27b5e', '#d1b072'],
    parts: () => [P(box(-0.45, 0.08, 0.9, 0.4), 'cloth'), P(box(-0.45, 0.48, 0.2, 0.55), 'cloth')],
    draw(ctx, o, R) {
      rect(ctx, -0.45, 0.48, 0.2, 0.55, shade(o.col, -0.05), R, { r: 0.07 });
      rect(ctx, -0.45, 0.08, 0.9, 0.4, o.col, R, { r: 0.06 });
      rect(ctx, -0.25, 0.42, 0.66, 0.13, shade(o.col, 0.07), R, { r: 0.06 });
      for (const x of [-0.38, 0.38]) rect(ctx, x - 0.04, 0, 0.08, 0.09, [90, 66, 50], R, { outline: 0 });
    },
  },
  sign: {
    pad: 1.0, name: 'the sign', colors: ['#e9dfc6'],
    parts: () => [P(box(-0.06, 0, 0.12, 2.6), 'ghost')],
    draw(ctx, o, R) {
      line(ctx, 0, 0, 0, 2.5, 0.08, [120, 116, 110]);
      rect(ctx, -0.8, 1.9, 1.6, 0.62, o.col, R, { r: 0.05 });
      text(ctx, o.text || 'NO DUMPING', 0, 2.21, 0.2, [150, 50, 44], 0.9, { spacing: 1 });
    },
  },
  parasol: {
    pad: 1.25, name: 'the parasol', colors: ['#d77a62'],
    parts: () => [P(box(-0.03, 0, 0.06, 2.2), 'ghost')],
    draw(ctx, o, R) {
      line(ctx, 0, 0, 0, 2.2, 0.05, [210, 200, 180]);
      for (let i = 0; i < 6; i++) { const x0 = -1.1 + i * 0.367; flat(ctx, [[x0, 1.85], [x0 + 0.367, 1.85], [0, 2.3]], fade(i % 2 ? '#efe2c4' : '#d77a62', 0.15)); }
      ctx.strokeStyle = 'rgba(74,46,44,0.4)'; ctx.lineWidth = 0.02; path(ctx, [[-1.1, 1.85], [1.1, 1.85], [0, 2.3]]); ctx.stroke();
    },
  },
  easel: {
    pad: 0.5, name: 'the easel', colors: ['#a67c52'],
    parts: () => [P(box(-0.05, 0, 0.1, 1.6), 'ghost')],
    draw(ctx, o, R) {
      line(ctx, -0.35, 0, 0, 1.7, 0.04, [140, 100, 66]); line(ctx, 0.35, 0, 0, 1.7, 0.04, [140, 100, 66]); line(ctx, 0, 0, 0.05, 1.5, 0.035, [120, 86, 56]);
      rect(ctx, -0.42, 0.75, 0.84, 0.66, [240, 234, 220], R, { outline: 0.4, n: 8 });
      flat(ctx, box(-0.38, 1.06, 0.76, 0.32), fade('#9db8c8', 0.4)); flat(ctx, box(-0.38, 0.79, 0.76, 0.27), fade('#c9a06a', 0.35));
      line(ctx, -0.42, 0.75, 0.42, 0.75, 0.04, [140, 100, 66]);
    },
  },
};
for (const k in KINDS) KINDS[k].id = k;

// An instance: { k, x, y, r (degrees), f (±1 flip), c (colour index), seed, ...params }. World polygons for its parts.
export function placeParts(o) {
  const K = KINDS[o.k], ca = Math.cos((o.r || 0) * Math.PI / 180), sa = Math.sin((o.r || 0) * Math.PI / 180), f = o.f || 1;
  return K.parts(o).map(part => ({ mat: part.mat, pts: part.pts.map(([x, y]) => { x *= f; return [o.x + x * ca - y * sa, o.y + x * sa + y * ca]; }) }));
}
export function colorOf(o) { const K = KINDS[o.k]; return fade(K.colors[(o.c ?? o.seed) % K.colors.length], o.back ? 0.5 : 0.3); }
export { hex };
