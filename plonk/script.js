// Four invented scripts, one per country. Glyphs are strokes in a unit box (baseline at y = 1).
import { rng } from './world.js';

const STYLES = {
  // Norrow: straight cuts, like runes on a gatepost
  rune(r) {
    const s = [];
    const xs = [0, 0.3, 0.6];
    const stemX = xs[(r() * 3) | 0];
    s.push({ t: 'l', p: [stemX, 0, stemX, 1] });
    const n = 1 + ((r() * 2.4) | 0);
    for (let i = 0; i < n; i++) {
      const y1 = [0, 0.33, 0.5, 0.66][(r() * 4) | 0];
      const x2 = xs[(r() * 3) | 0] === stemX ? (stemX === 0 ? 0.6 : 0) : xs[(r() * 3) | 0];
      const y2 = Math.max(0, Math.min(1, y1 + [-0.33, 0, 0.33, 0.5][(r() * 4) | 0]));
      s.push({ t: 'l', p: [stemX, y1, x2 === stemX ? 0.6 - stemX : x2, y2] });
    }
    return { w: 0.6, s };
  },
  // Calimbe: rings, bowls and tails
  loop(r) {
    const s = [];
    const kind = (r() * 4) | 0;
    if (kind === 0) { s.push({ t: 'a', c: [0.35, 0.68, 0.3], a: [0, 6.29] }); s.push({ t: 'q', p: [0.65, 0.68, 0.72, 0.2, 0.5, 0.05] }); }
    else if (kind === 1) { s.push({ t: 'a', c: [0.35, 0.68, 0.3], a: [3.14, 6.29 + 1.2] }); s.push({ t: 'd', p: [0.35, 0.25] }); }
    else if (kind === 2) { s.push({ t: 'a', c: [0.25, 0.75, 0.22], a: [0, 6.29] }); s.push({ t: 'a', c: [0.55, 0.45, 0.2], a: [2.2, 6.6] }); }
    else { s.push({ t: 'q', p: [0.05, 1, 0.35, 0.1, 0.65, 1] }); s.push({ t: 'a', c: [0.35, 0.4, 0.12], a: [0, 6.29] }); }
    if (r() < 0.4) s.push({ t: 'd', p: [0.7 * r() + 0.05, 0.02] });
    return { w: 0.75, s };
  },
  // Dastra: a bar along the top with shapes hanging from it
  bar(r) {
    const s = [];
    const n = 1 + ((r() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const x = 0.1 + i * 0.42 + r() * 0.08;
      const len = [0.55, 0.8, 1][(r() * 3) | 0];
      s.push({ t: 'l', p: [x, 0.05, x, len] });
      if (r() < 0.6) { const y = 0.3 + r() * 0.5; s.push({ t: 'l', p: [x, y, x + 0.3, y] }); }
      else if (r() < 0.5) s.push({ t: 'q', p: [x, 0.5, x + 0.4, 0.55, x + 0.2, 0.9] });
    }
    if (r() < 0.5) s.push({ t: 'd', p: [0.25 + r() * 0.3, 1.2] });
    return { w: 0.68, s, bar: true };
  },
  // Sulei: slanted brush hooks joined at the baseline
  hook(r) {
    const s = [];
    const a = 0.15 + r() * 0.5;
    s.push({ t: 'q', p: [0, 1, a, -0.1 + r() * 0.4, 0.45, 0.95] });
    const k = (r() * 3) | 0;
    if (k === 0) s.push({ t: 'q', p: [0.45, 0.95, 0.7, 0.5, 0.85, 1] });
    else if (k === 1) s.push({ t: 'q', p: [0.45, 0.95, 0.75, 1.1, 0.6, 0.45] });
    else s.push({ t: 'l', p: [0.45, 0.95, 0.85, 0.95] });
    if (r() < 0.55) s.push({ t: 'd', p: [0.2 + r() * 0.5, -0.15] });
    return { w: 0.8, s, join: true, slant: 0.22 };
  },
};

export function makeScript(style, seed) {
  const r = rng(seed);
  const glyphs = [];
  for (let i = 0; i < 20; i++) glyphs.push(STYLES[style](r));
  return { style, glyphs };
}

export function makeWord(r, n = 3 + ((r() * 3.2) | 0)) {
  const w = [];
  for (let i = 0; i < n; i++) w.push((r() * 20) | 0);
  return w;
}

export function wordWidth(script, word, size) {
  let w = 0;
  for (const g of word) w += script.glyphs[g].w + 0.28;
  return (w - 0.28) * size;
}

// draws so the word's box is centred on (x, y) when align='center'
export function drawWord(ctx, script, word, x, y, size, color, align = 'center') {
  const total = wordWidth(script, word, size);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const top = y - size / 2;
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(0.8, size * (script.style === 'bar' ? 0.13 : 0.12));
  if (script.style === 'bar') {
    ctx.beginPath(); ctx.moveTo(cx - size * 0.05, top + size * 0.05); ctx.lineTo(cx + total + size * 0.05, top + size * 0.05); ctx.stroke();
  }
  const sl = script.style === 'hook' ? 0.22 : 0;
  const P = (gx, gy, ox) => [ox + (gx + (1 - gy) * sl) * size, top + gy * size];
  let prevEnd = null;
  for (const gi of word) {
    const g = script.glyphs[gi];
    ctx.beginPath();
    for (const st of g.s) {
      if (st.t === 'l') { const a = P(st.p[0], st.p[1], cx), b = P(st.p[2], st.p[3], cx); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      else if (st.t === 'q') { const a = P(st.p[0], st.p[1], cx), c = P(st.p[2], st.p[3], cx), b = P(st.p[4], st.p[5], cx); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c[0], c[1], b[0], b[1]); }
      else if (st.t === 'a') { const c = P(st.c[0], st.c[1], cx); ctx.moveTo(c[0] + Math.cos(st.a[0]) * st.c[2] * size, c[1] + Math.sin(st.a[0]) * st.c[2] * size); ctx.arc(c[0], c[1], st.c[2] * size, st.a[0], st.a[1]); }
    }
    if (g.join && prevEnd) { const a = P(0, 1, cx); ctx.moveTo(prevEnd[0], prevEnd[1]); ctx.lineTo(a[0], a[1]); }
    ctx.stroke();
    for (const st of g.s) if (st.t === 'd') { const c = P(st.p[0], st.p[1], cx); ctx.beginPath(); ctx.arc(c[0], c[1], ctx.lineWidth * 0.75, 0, 6.29); ctx.fill(); }
    prevEnd = g.join ? P(0.85, 1, cx) : null;
    cx += (g.w + 0.28) * size;
  }
  ctx.restore();
}
