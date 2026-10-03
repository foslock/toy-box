// Ladder: painterly drawing helpers. Everything is drawn in metres with y up (the caller sets the transform).
// The look: flat, sun-faded colours, a few loose brush strokes over each shape, light from the upper right,
// and a soft warm outline.

export const HAZE = [239, 228, 207];
export function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
// a colour as the sun has left it: washed toward the haze
export const fade = (h, t = 0.32) => mix(typeof h === 'string' ? hex(h) : h, HAZE, t);
export const shade = (c, k) => k > 0 ? mix(c, [255, 250, 236], k) : mix(c, [58, 38, 40], -k);

export function path(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
export function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
export const box = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
export function circlePts(cx, cy, r, n = 10, a0 = 0) { const o = []; for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI * 2; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; }

// Brush over whatever path is current: a base fill, loose strokes in nearby tones, top light and a soft outline.
// opt: { dir: stroke angle, n: stroke count per square metre, rough: tone spread, outline: alpha, lw }
export function brush(ctx, c, R, bb, opt = {}) {
  const [x0, y0, x1, y1] = bb, w = x1 - x0, h = y1 - y0;
  ctx.save();
  ctx.fillStyle = rgba(c); ctx.fill();
  ctx.clip();
  const n = Math.min(260, Math.max(6, (opt.n ?? 34) * w * h)), dir = opt.dir ?? 0, rough = opt.rough ?? 0.07;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * w, y = y0 + R() * h, len = 0.12 + R() * 0.42, a = dir + (R() - 0.5) * 0.5;
    const up = (y - y0) / (h || 1);
    const k = (R() - 0.5) * 2 * rough + (up - 0.5) * 0.1;
    ctx.strokeStyle = rgba(shade(c, k), 0.22 + R() * 0.3);
    ctx.lineWidth = 0.03 + R() * 0.09;
    ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2);
    ctx.quadraticCurveTo(x + (R() - 0.5) * 0.06, y + (R() - 0.5) * 0.06, x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2); ctx.stroke();
  }
  // light from the upper right, shade toward the lower left
  const g = ctx.createLinearGradient(x0, y0, x0 + w * 0.35, y1);
  g.addColorStop(0, 'rgba(70,40,50,0.16)'); g.addColorStop(0.55, 'rgba(70,40,50,0)'); g.addColorStop(1, 'rgba(255,248,226,0.13)');
  ctx.fillStyle = g; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
  ctx.restore();
  if (opt.outline !== 0) {
    ctx.save(); ctx.strokeStyle = `rgba(74,46,44,${opt.outline ?? 0.42})`; ctx.lineWidth = opt.lw ?? 0.035; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }
}
const bbOf = pts => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; };
export function blob(ctx, pts, c, R, opt) { path(ctx, pts); brush(ctx, c, R, bbOf(pts), opt); }
export function rect(ctx, x, y, w, h, c, R, opt = {}) { if (opt.r) rrect(ctx, x, y, w, h, opt.r); else path(ctx, box(x, y, w, h)); brush(ctx, c, R, [x, y, x + w, y + h], opt); }
export function disc(ctx, x, y, r, c, R, opt) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); brush(ctx, c, R, [x - r, y - r, x + r, y + r], opt); }
// flat touches: lines and spots with no brushwork
export function line(ctx, x0, y0, x1, y1, w, c, a = 1) { ctx.strokeStyle = rgba(c, a); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
export function spot(ctx, x, y, r, c, a = 1) { ctx.fillStyle = rgba(c, a); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
export function flat(ctx, pts, c, a = 1) { ctx.fillStyle = rgba(c, a); path(ctx, pts); ctx.fill(); }
// a rust or dirt stain: a few overlapping soft spots
export function stain(ctx, x, y, r, R, c = [150, 92, 60], a = 0.28) {
  for (let i = 0; i < 6; i++) spot(ctx, x + (R() - 0.5) * r * 1.6, y + (R() - 0.5) * r, r * (0.25 + R() * 0.45), c, a * (0.4 + R() * 0.6));
}
// text in metres, upright (the transform has y up)
export function text(ctx, s, x, y, size, c, a = 1, opt = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, -1); if (opt.rot) ctx.rotate(opt.rot);
  // on junk drawn flipped, flip the lettering back so it still reads
  const m = ctx.getTransform(); if (m.a * m.d - m.b * m.c < 0) ctx.scale(-1, 1);
  ctx.scale(0.01, 0.01); ctx.font = `${opt.weight || 700} ${Math.round(size * 100)}px ${opt.font || 'Oswald, "Arial Narrow", sans-serif'}`;
  ctx.textAlign = opt.align || 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = rgba(c, a);
  if (opt.spacing) ctx.letterSpacing = (opt.spacing * 10) + 'px';
  ctx.fillText(s, 0, 0); ctx.restore();
}
