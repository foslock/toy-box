// Last Checkout: everything drawn on the canvas. Flat shop-floor colours,
// thick ink outlines, packaging lettered like a cheap own-brand range.

export const INK = '#1f1b26';
export const FONT_HEAD = '"Bowlby One", "Arial Black", sans-serif';
export const FONT_TILL = '"DotGothic16", "Courier New", monospace';
export const FONT_BODY = '"Atkinson Hyperlegible", "Trebuchet MS", sans-serif';

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fs(ctx, fill, lw = 2.2) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}
function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
function label(ctx, text, x, y, maxW, size, col) {
  if (!text) return;
  ctx.fillStyle = col;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let s = size;
  ctx.font = `${s}px ${FONT_HEAD}`;
  while (s > 5 && ctx.measureText(text).width > maxW) { s -= 0.5; ctx.font = `${s}px ${FONT_HEAD}`; }
  ctx.fillText(text, x, y + s * 0.06);
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// a seeded wobble so things look hand-cut but don't jitter between frames
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

export function barcode(ctx, x, y, w, h, seed = 1) {
  ctx.fillStyle = '#fbfaf5';
  rr(ctx, x, y, w, h, 2); ctx.fill();
  ctx.fillStyle = INK;
  let px = x + 3;
  let i = 0;
  while (px < x + w - 3) {
    const bw = hash(seed * 31 + i) < 0.35 ? 2 : 1;
    if (i % 2 === 0) ctx.fillRect(px, y + 2, bw * 0.9, h - 6);
    px += bw * 1.1; i++;
  }
  ctx.font = `5px ${FONT_TILL}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('5 012345 67890' .slice(0, Math.max(4, Math.floor(w / 3.5))), x + w / 2, y + h - 0.5);
}

// The silhouette path for an item, so the back can reuse it.
function silhouette(ctx, def, x, y, w, h) {
  const k = def.kind;
  if (k === 'tin') { rr(ctx, x + 2, y + (def.flat ? h * 0.22 : 2), w - 4, def.flat ? h * 0.6 : h - 4, 4); return; }
  if (k === 'bag' || k === 'sack') { // a pillow with crimped ends
    ctx.beginPath();
    const t = y + 3, b = y + h - 3, l = x + 4, r = x + w - 4;
    ctx.moveTo(l, t);
    for (let i = 1; i <= 5; i++) ctx.lineTo(l + (r - l) * i / 5, t + (i % 2 ? 2 : 0));
    ctx.quadraticCurveTo(r + 3, (t + b) / 2, r, b);
    for (let i = 1; i <= 5; i++) ctx.lineTo(r - (r - l) * i / 5, b - (i % 2 ? 2 : 0));
    ctx.quadraticCurveTo(l - 3, (t + b) / 2, l, t);
    ctx.closePath(); return;
  }
  if (k === 'jug') {
    ctx.beginPath();
    ctx.moveTo(x + w * 0.35, y + 3); ctx.lineTo(x + w * 0.65, y + 3);
    ctx.lineTo(x + w * 0.65, y + h * 0.14);
    ctx.quadraticCurveTo(x + w - 3, y + h * 0.2, x + w - 3, y + h * 0.35);
    ctx.lineTo(x + w - 3, y + h - 6); ctx.quadraticCurveTo(x + w - 3, y + h - 3, x + w - 7, y + h - 3);
    ctx.lineTo(x + 7, y + h - 3); ctx.quadraticCurveTo(x + 3, y + h - 3, x + 3, y + h - 6);
    ctx.lineTo(x + 3, y + h * 0.35); ctx.quadraticCurveTo(x + 3, y + h * 0.2, x + w * 0.35, y + h * 0.14);
    ctx.closePath(); return;
  }
  if (k === 'bottle') {
    ctx.beginPath();
    const cx = x + w / 2, nw = w * 0.13, bw = w * 0.34;
    ctx.moveTo(cx - nw, y + 3); ctx.lineTo(cx + nw, y + 3);
    ctx.lineTo(cx + nw, y + h * 0.3); ctx.quadraticCurveTo(cx + bw, y + h * 0.34, cx + bw, y + h * 0.45);
    ctx.lineTo(cx + bw, y + h - 6); ctx.quadraticCurveTo(cx + bw, y + h - 3, cx + bw - 4, y + h - 3);
    ctx.lineTo(cx - bw + 4, y + h - 3); ctx.quadraticCurveTo(cx - bw, y + h - 3, cx - bw, y + h - 6);
    ctx.lineTo(cx - bw, y + h * 0.45); ctx.quadraticCurveTo(cx - bw, y + h * 0.34, cx - nw, y + h * 0.3);
    ctx.closePath(); return;
  }
  if (k === 'loaf') {
    ctx.beginPath();
    ctx.moveTo(x + 4, y + h - 4);
    ctx.lineTo(x + 4, y + h * 0.42);
    ctx.bezierCurveTo(x + 4, y + 2, x + w * 0.5, y + 2, x + w * 0.5, y + h * 0.3);
    ctx.bezierCurveTo(x + w * 0.5, y + 2, x + w - 4, y + 2, x + w - 4, y + h * 0.42);
    ctx.lineTo(x + w - 4, y + h - 4); ctx.closePath(); return;
  }
  if (k === 'jar') { rr(ctx, x + 5, y + 5, w - 10, h - 8, 6); return; }
  if (k === 'tub') {
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 6); ctx.lineTo(x + w - 3, y + 6); ctx.lineTo(x + w - 7, y + h - 3); ctx.lineTo(x + 7, y + h - 3); ctx.closePath(); return;
  }
  if (k === 'lolly') { rr(ctx, x + w * 0.22, y + 4, w * 0.56, h - 8, 3); return; }
  if (k === 'bar') { rr(ctx, x + 2, y + h * 0.28, w - 4, h * 0.44, 2); return; }
  if (k === 'eggs') { rr(ctx, x + 3, y + h * 0.18, w - 6, h * 0.68, 5); return; }
  if (k === 'packet') { rr(ctx, x + 3, y + 3, w - 6, h - 6, 3); return; }
  if (k === 'punnet') { ctx.beginPath(); ctx.moveTo(x + 3, y + h * 0.35); ctx.lineTo(x + w - 3, y + h * 0.35); ctx.lineTo(x + w - 6, y + h - 3); ctx.lineTo(x + 6, y + h - 3); ctx.closePath(); return; }
  if (k === 'chicken') { rr(ctx, x + 3, y + h * 0.3, w - 6, h * 0.62, 6); return; }
  if (k === 'block') { rr(ctx, x + 3, y + h * 0.2, w - 6, h * 0.62, 3); return; }
  if (k === 'flowers') { rr(ctx, x + 3, y + h * 0.15, w - 6, h * 0.7, 6); return; }
  rr(ctx, x + 3, y + 3, w - 6, h - 6, 3); // box, rolls, water
}

// draw one item into the rectangle. face 0 = front label, 1 = back with barcode.
export function drawItem(ctx, def, x, y, w, h, face, opts = {}) {
  ctx.save();
  if (opts.crushed) {
    ctx.translate(x + w / 2, y + h);
    ctx.scale(1.08, 0.78);
    ctx.rotate(0.05);
    ctx.translate(-x - w / 2, -y - h);
  }
  if (opts.shadow) {
    ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = '#000';
    ctx.translate(4, 6); silhouette(ctx, def, x, y, w, h); ctx.fill(); ctx.restore();
  }
  if (def.produce) drawProduce(ctx, def, x, y, w, h);
  else if (face === 1) drawBack(ctx, def, x, y, w, h, opts.seed || 1);
  else drawFront(ctx, def, x, y, w, h);
  if (opts.crushed) {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y + h * 0.2); ctx.lineTo(x + w * 0.42, y + h * 0.48); ctx.lineTo(x + w * 0.34, y + h * 0.62); ctx.lineTo(x + w * 0.5, y + h * 0.85);
    ctx.moveTo(x + w * 0.42, y + h * 0.48); ctx.lineTo(x + w * 0.6, y + h * 0.42);
    ctx.stroke();
    if (def.kind === 'eggs') {
      ctx.fillStyle = '#f4c430'; circ(ctx, x + w * 0.62, y + h * 0.92, 4); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + w * 0.62, y + h * 0.95, 9, 3, 0, 0, 7); ctx.fillStyle = 'rgba(255,250,220,.8)'; ctx.fill();
    }
  }
  ctx.restore();
  if (opts.scanned) {
    // a little green "beeped" sticker
    const sx = x + w - 7, sy = y + 7;
    circ(ctx, sx, sy, 5.5); fs(ctx, '#3bbf6a', 1.6);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(sx - 2.6, sy); ctx.lineTo(sx - 0.6, sy + 2); ctx.lineTo(sx + 2.8, sy - 2.2); ctx.stroke();
  }
}

function drawBack(ctx, def, x, y, w, h, seed) {
  silhouette(ctx, def, x, y, w, h);
  fs(ctx, shade(def.col, def.kind === 'bottle' ? 0.1 : 0.35));
  ctx.save(); silhouette(ctx, def, x, y, w, h); ctx.clip();
  // a few lines of small print
  ctx.fillStyle = 'rgba(31,27,38,.28)';
  const lines = Math.max(1, Math.floor(h / 12));
  for (let i = 0; i < lines; i++) ctx.fillRect(x + 7, y + 7 + i * 5, (w - 14) * (0.4 + 0.5 * hash(seed + i)), 1.3);
  const bw = Math.min(w - 10, 30), bh = Math.min(h * 0.42, 18);
  barcode(ctx, x + (w - bw) / 2, y + h - bh - 6, bw, bh, seed);
  ctx.restore();
  silhouette(ctx, def, x, y, w, h); fs(ctx, null);
}

function drawFront(ctx, def, x, y, w, h) {
  const k = def.kind, c = def.col, c2 = def.col2;
  const cx = x + w / 2;
  switch (k) {
    case 'tin': {
      silhouette(ctx, def, x, y, w, h); fs(ctx, '#c9ccd2');
      const ty = def.flat ? y + h * 0.22 : y + 2, th = def.flat ? h * 0.6 : h - 4;
      ctx.fillStyle = c; ctx.fillRect(x + 3, ty + th * 0.18, w - 6, th * 0.64);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x + 3, ty + th * 0.18); ctx.lineTo(x + w - 3, ty + th * 0.18); ctx.moveTo(x + 3, ty + th * 0.82); ctx.lineTo(x + w - 3, ty + th * 0.82); ctx.stroke();
      ctx.fillStyle = c2; ctx.fillRect(x + 3, ty + th * 0.62, w - 6, th * 0.1);
      label(ctx, def.label, cx, ty + th * 0.42, w - 10, def.flat ? 8 : 9, '#fff8e8');
      if (def.label === 'MEOW') { // a cat ear or two
        ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(cx - 9, ty + th * 0.2); ctx.lineTo(cx - 6, ty + th * 0.08); ctx.lineTo(cx - 3, ty + th * 0.2); ctx.fill();
      }
      silhouette(ctx, def, x, y, w, h); fs(ctx, null);
      break;
    }
    case 'bag': {
      silhouette(ctx, def, x, y, w, h); fs(ctx, c);
      ctx.fillStyle = c2; circ(ctx, cx, y + h * 0.58, Math.min(w, h) * 0.22); ctx.fill();
      label(ctx, def.label, cx, y + h * 0.3, w - 10, 8, '#fff8e8');
      break;
    }
    case 'sack': {
      silhouette(ctx, def, x, y, w, h); fs(ctx, c);
      ctx.fillStyle = c2; ctx.fillRect(x + 5, y + h * 0.36, w - 10, h * 0.24);
      label(ctx, def.label, cx, y + h * 0.48, w - 12, h > 50 ? 9 : 8, '#fff8e8');
      if (h > 50) { ctx.fillStyle = c2; ctx.font = `7px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.fillText('1.5kg', cx, y + h * 0.78); }
      break;
    }
    case 'jug': {
      silhouette(ctx, def, x, y, w, h); fs(ctx, c);
      ctx.fillStyle = c2; rr(ctx, cx - 6, y, 12, 7, 2); fs(ctx, c2, 1.8);
      ctx.fillStyle = c2; ctx.fillRect(x + 4, y + h * 0.48, w - 8, h * 0.2);
      label(ctx, def.label, cx, y + h * 0.58, w - 10, 9, '#fff8e8');
      silhouette(ctx, def, x, y, w, h); fs(ctx, null);
      break;
    }
    case 'bottle': {
      silhouette(ctx, def, x, y, w, h); fs(ctx, c);
      if (def.foil) { ctx.fillStyle = c2; rr(ctx, cx - w * 0.15, y + 1, w * 0.3, h * 0.2, 2); fs(ctx, c2, 1.6); }
      else { ctx.fillStyle = '#7a1f2f'; rr(ctx, cx - w * 0.14, y + 1, w * 0.28, h * 0.1, 2); fs(ctx, '#7a1f2f', 1.6); }
      ctx.fillStyle = c2; rr(ctx, cx - w * 0.28, y + h * 0.55, w * 0.56, h * 0.26, 2); fs(ctx, c2, 1.4);
      label(ctx, def.label, cx, y + h * 0.68, w * 0.5, 7, INK);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - w * 0.22, y + h * 0.48); ctx.lineTo(cx - w * 0.22, y + h * 0.52); ctx.stroke();
      break;
    }
    case 'loaf': {
      silhouette(ctx, def, x, y, w, h); fs(ctx, '#f1e3c4');
      ctx.save(); silhouette(ctx, def, x, y, w, h); ctx.clip();
      ctx.fillStyle = c; ctx.fillRect(x, y, w, h * 0.32);
      ctx.fillStyle = c2; ctx.fillRect(x, y + h * 0.5, w, h * 0.3);
      ctx.restore();
      label(ctx, def.label, cx, y + h * 0.65, w - 16, 9, '#fff8e8');
      silhouette(ctx, def, x, y, w, h); fs(ctx, null);
      break;
    }
    case 'eggs': {
      silhouette(ctx, def, x, y, w, h); fs(ctx, c);
      for (let i = 0; i < 3; i++) { circ(ctx, x + w * (0.22 + i * 0.28), y + h * 0.36, h * 0.15); fs(ctx, shade(c, 0.25), 1.4); }
      ctx.fillStyle = c2; rr(ctx, x + 8, y + h * 0.56, w - 16, h * 0.22, 2); ctx.fill();
      label(ctx, def.label, cx, y + h * 0.67, w - 20, 8, INK);
      break;
    }
    case 'packet': {
      silhouette(ctx, def, x, y, w, h); fs(ctx, c);
      if (w < h) { // spaghetti: a window with sticks
        ctx.fillStyle = '#f2d98b'; rr(ctx, cx - 6, y + 10, 12, h * 0.5, 2); fs(ctx, '#f2d98b', 1.2);
        ctx.strokeStyle = 'rgba(31,27,38,.35)'; ctx.lineWidth = 1; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 3, y + 12); ctx.lineTo(cx + i * 3, y + 8 + h * 0.5); ctx.stroke(); }
        label(ctx, def.label, cx, y + h * 0.78, w - 8, 8, c2);
      } else {
        ctx.fillStyle = c2; ctx.fillRect(x + 4, y + h * 0.32, w - 8, h * 0.36);
        for (let i = 0; i < 3; i++) { circ(ctx, x + 12 + i * 6, y + h / 2, 6); fs(ctx, '#d9a45a', 1.2); }
        label(ctx, def.label, x + w * 0.65, y + h / 2, w * 0.45, 8, INK);
      }
      break;
    }
    case 'box': {
      silhouette(ctx, def, x, y, w, h); fs(ctx, c);
      ctx.fillStyle = c2; ctx.fillRect(x + 4, y + h * 0.58, w - 8, h * 0.2);
      if (def.label === 'CANDLES') {
        for (let i = 0; i < 3; i++) {
          const px = x + w * (0.3 + i * 0.2);
          ctx.fillStyle = '#fffaf0'; ctx.fillRect(px - 2.5, y + h * 0.3, 5, h * 0.26);
          ctx.fillStyle = '#f2a33a'; ctx.beginPath(); ctx.ellipse(px, y + h * 0.24, 2.2, 4, 0, 0, 7); ctx.fill();
        }
        label(ctx, 'CANDLES', cx, y + h * 0.68, w - 8, 6.5, '#fff8e8');
      } else if (def.label === 'SPARK') {
        ctx.strokeStyle = c2; ctx.lineWidth = 1.4;
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 3, y + h * 0.32 + Math.sin(a) * 3); ctx.lineTo(cx + Math.cos(a) * 9, y + h * 0.32 + Math.sin(a) * 9); ctx.stroke(); }
        label(ctx, def.label, cx, y + h * 0.68, w - 8, 7, INK);
      } else {
        label(ctx, def.label, cx, y + h * 0.36, w - 8, 9, '#fff8e8');
        label(ctx, def.label === 'TEA' ? '80' : def.label === 'AA' ? '× 4' : '', cx, y + h * 0.68, w - 8, 6, INK);
      }
      silhouette(ctx, def, x, y, w, h); fs(ctx, null);
      break;
    }
    case 'block': {
      silhouette(ctx, def, x, y, w, h); fs(ctx, c);
      ctx.fillStyle = c2; ctx.fillRect(x + 4, y + h * 0.3, w - 8, h * 0.14);
      label(ctx, def.label, cx, y + h * 0.6, w - 8, 7, INK);
      silhouette(ctx, def, x, y, w, h); fs(ctx, null);
      break;
    }
    case 'tub': {
      silhouette(ctx, def, x, y, w, h); fs(ctx, c);
      rr(ctx, x + 1, y + 2, w - 2, 7, 3); fs(ctx, '#fbe9ef', 1.8);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = c2; circ(ctx, x + 9 + hash(i) * (w - 18), y + h * 0.4 + hash(i + 9) * h * 0.3, 1.6); ctx.fill(); }
      label(ctx, def.label, cx, y + h * 0.56, w - 14, 9, c2);
      break;
    }
    case 'lolly': {
      ctx.fillStyle = '#e8c79a'; ctx.fillRect(cx - 1.5, y + h - 9, 3, 7);
      ctx.beginPath(); ctx.moveTo(cx - w * 0.2, y + h - 9); ctx.lineTo(cx - w * 0.2, y + h * 0.35); ctx.lineTo(cx, y + 4); ctx.lineTo(cx + w * 0.2, y + h * 0.35); ctx.lineTo(cx + w * 0.2, y + h - 9); ctx.closePath();
      fs(ctx, c);
      ctx.fillStyle = c2; ctx.fillRect(cx - w * 0.2 + 1, y + h * 0.45, w * 0.4 - 2, h * 0.14);
      ctx.fillStyle = '#3a6fb0'; ctx.fillRect(cx - w * 0.2 + 1, y + h * 0.6, w * 0.4 - 2, h * 0.12);
      ctx.beginPath(); ctx.moveTo(cx - w * 0.2, y + h - 9); ctx.lineTo(cx - w * 0.2, y + h * 0.35); ctx.lineTo(cx, y + 4); ctx.lineTo(cx + w * 0.2, y + h * 0.35); ctx.lineTo(cx + w * 0.2, y + h - 9); ctx.closePath(); fs(ctx, null);
      break;
    }
    case 'bar': {
      silhouette(ctx, def, x, y, w, h); fs(ctx, c);
      ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(x + 2, y + h * 0.28); ctx.lineTo(x + w * 0.3, y + h * 0.28); ctx.lineTo(x + 2, y + h * 0.72); ctx.fill();
      label(ctx, def.label, cx + 3, y + h / 2, w - 16, 7.5, '#fff8e8');
      silhouette(ctx, def, x, y, w, h); fs(ctx, null);
      break;
    }
    case 'rolls': {
      silhouette(ctx, def, x, y, w, h); fs(ctx, '#e9eef2');
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { circ(ctx, x + w * (0.22 + i * 0.28), y + h * (0.22 + j * 0.28), w * 0.12); fs(ctx, c, 1.4); circ(ctx, x + w * (0.22 + i * 0.28), y + h * (0.22 + j * 0.28), w * 0.035); ctx.fillStyle = '#c9ccd2'; ctx.fill(); }
      ctx.fillStyle = c2; rr(ctx, x + 8, y + h * 0.42, w - 16, h * 0.16, 3); fs(ctx, c2, 1.4);
      label(ctx, def.label, cx, y + h * 0.5, w - 24, 9, '#fff8e8');
      break;
    }
    case 'water': {
      silhouette(ctx, def, x, y, w, h); fs(ctx, 'rgba(191,227,242,.6)');
      for (let i = 0; i < 3; i++) { const bx = x + w * (0.18 + i * 0.32); rr(ctx, bx - w * 0.12, y + 10, w * 0.24, h - 18, 6); fs(ctx, c, 1.6); ctx.fillStyle = c2; ctx.fillRect(bx - w * 0.12 + 1, y + h * 0.45, w * 0.24 - 2, h * 0.14); }
      ctx.fillStyle = 'rgba(255,255,255,.5)'; rr(ctx, x + 8, y + h * 0.7, w - 16, 11, 3); ctx.fill();
      label(ctx, def.label, cx, y + h * 0.7 + 5.5, w - 24, 8, c2);
      silhouette(ctx, def, x, y, w, h); fs(ctx, null);
      break;
    }
    case 'jar': {
      if (def.tub) { silhouette(ctx, def, x, y, w, h); fs(ctx, c); }
      else { silhouette(ctx, def, x, y, w, h); fs(ctx, c); }
      ctx.fillStyle = def.tub ? '#c0392b' : '#f2e6c9'; rr(ctx, x + 6, y + 2, w - 12, 7, 2); fs(ctx, def.tub ? '#c0392b' : '#e0d2a8', 1.6);
      ctx.fillStyle = c2; rr(ctx, x + 8, y + h * 0.42, w - 16, h * 0.3, 2); ctx.fill();
      label(ctx, def.label, cx, y + h * 0.57, w - 20, 7, INK);
      silhouette(ctx, def, x, y, w, h); fs(ctx, null);
      break;
    }
    case 'punnet': {
      for (let i = 0; i < 4; i++) { const bx = x + 9 + (i % 2) * (w - 18) * 0.7 + (i > 1 ? 4 : 0), by = y + h * (0.3 - (i > 1 ? 0.08 : 0)); circ(ctx, bx + 3, by, 6); fs(ctx, c, 1.4); }
      silhouette(ctx, def, x, y, w, h); fs(ctx, 'rgba(240,248,250,.85)');
      ctx.strokeStyle = 'rgba(31,27,38,.25)'; ctx.lineWidth = 1; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + 4 + i * (w - 8) / 4, y + h * 0.37); ctx.lineTo(x + 6 + i * (w - 12) / 4, y + h - 4); ctx.stroke(); }
      ctx.fillStyle = c2; ctx.fillRect(x + 7, y + h * 0.58, w - 14, 6);
      break;
    }
    case 'chicken': {
      silhouette(ctx, def, x, y, w, h); fs(ctx, '#2b2f3a');
      ctx.beginPath(); ctx.ellipse(cx, y + h * 0.56, w * 0.32, h * 0.3, 0, 0, 7); fs(ctx, c, 1.8);
      circ(ctx, cx - w * 0.3, y + h * 0.5, 5); fs(ctx, c, 1.6); circ(ctx, cx + w * 0.3, y + h * 0.5, 5); fs(ctx, c, 1.6);
      ctx.fillStyle = '#fbfaf5'; rr(ctx, cx - 14, y + h * 0.66, 28, 8, 1); ctx.fill();
      ctx.fillStyle = c2; ctx.font = `6px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.fillText('1.6kg', cx, y + h * 0.66 + 5);
      break;
    }
    case 'flowers': {
      ctx.fillStyle = '#4f9a4a';
      for (let i = 0; i < 3; i++) { ctx.fillRect(x + w * 0.6 + i * 3, y + h * 0.45, 2, h * 0.4); }
      const pal = [c, c2, '#f2f2f2', '#9a6fd0', c, c2];
      for (let i = 0; i < 6; i++) {
        const fx = x + w * (0.12 + hash(i + 2) * 0.48), fy = y + h * (0.25 + hash(i + 7) * 0.45);
        for (let p = 0; p < 5; p++) { const a = p / 5 * 6.28; circ(ctx, fx + Math.cos(a) * 4, fy + Math.sin(a) * 4, 3.2); fs(ctx, pal[i], 1.1); }
        ctx.fillStyle = '#f6d34a'; circ(ctx, fx, fy, 2); ctx.fill();
      }
      // cellophane cone
      ctx.beginPath(); ctx.moveTo(x + w * 0.5, y + h * 0.14); ctx.lineTo(x + w - 4, y + h * 0.42); ctx.lineTo(x + w - 4, y + h * 0.62); ctx.lineTo(x + w * 0.5, y + h * 0.88); ctx.closePath();
      fs(ctx, 'rgba(220,240,250,.55)', 1.6);
      break;
    }
    default:
      silhouette(ctx, def, x, y, w, h); fs(ctx, c);
      label(ctx, def.label, cx, y + h / 2, w - 8, 9, '#fff8e8');
  }
}

export function drawProduce(ctx, def, x, y, w, h, icon = false) {
  const c = def.col, k = def.kind;
  const balls = (n, r, col, wobble = 0) => {
    for (let i = 0; i < n; i++) {
      const bx = x + w * (0.28 + (i % 2) * 0.44) + (hash(i + 3) - 0.5) * wobble, by = y + h * (0.36 + Math.floor(i / 2) * 0.32) + (hash(i + 5) - 0.5) * wobble;
      circ(ctx, bx, by, r); fs(ctx, col, 1.6);
      ctx.fillStyle = 'rgba(255,255,255,.4)'; circ(ctx, bx - r * 0.35, by - r * 0.35, r * 0.25); ctx.fill();
    }
  };
  if (k === 'bananas') {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const oy = y + h * (0.3 + i * 0.16);
      ctx.moveTo(x + 6, oy + 2);
      ctx.quadraticCurveTo(x + w / 2, oy + h * 0.42, x + w - 6, oy - 2);
      ctx.quadraticCurveTo(x + w / 2, oy + h * 0.22, x + 6, oy + 2);
      fs(ctx, c, 1.6);
    }
    ctx.fillStyle = '#5a4a2a'; ctx.fillRect(x + 3, y + h * 0.28, 6, 6);
  } else if (k === 'apples') { balls(4, w * 0.18, c); ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + w * 0.28, y + h * 0.2); ctx.lineTo(x + w * 0.3, y + h * 0.14); ctx.stroke(); }
  else if (k === 'pears') {
    for (let i = 0; i < 2; i++) { const px = x + w * (0.3 + i * 0.4), py = y + h * 0.55; ctx.beginPath(); ctx.ellipse(px, py + 3, w * 0.16, h * 0.22, 0, 0, 7); fs(ctx, c, 1.6); ctx.beginPath(); ctx.ellipse(px, py - h * 0.15, w * 0.09, h * 0.13, 0, 0, 7); fs(ctx, c, 1.6); }
  }
  else if (k === 'lemons' || k === 'limes') {
    for (let i = 0; i < 4; i++) { const bx = x + w * (0.3 + (i % 2) * 0.4), by = y + h * (0.33 + Math.floor(i / 2) * 0.34); ctx.beginPath(); ctx.ellipse(bx, by, w * 0.18, h * 0.13, 0.2, 0, 7); fs(ctx, c, 1.5); }
  }
  else if (k === 'onions') { balls(4, w * 0.18, c); }
  else if (k === 'potatoes') {
    for (let i = 0; i < 5; i++) { const bx = x + w * (0.15 + i * 0.17), by = y + h * (0.45 + (i % 2) * 0.18); ctx.beginPath(); ctx.ellipse(bx, by, w * 0.1, h * 0.2, i, 0, 7); fs(ctx, c, 1.5); }
  }
  else if (k === 'carrots') {
    for (let i = 0; i < 3; i++) {
      const oy = y + h * (0.3 + i * 0.2);
      ctx.beginPath(); ctx.moveTo(x + 10, oy - 4); ctx.lineTo(x + w - 6, oy); ctx.lineTo(x + 10, oy + 4); ctx.closePath(); fs(ctx, c, 1.4);
      ctx.strokeStyle = '#3f8f3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 10, oy); ctx.lineTo(x + 3, oy - 3); ctx.moveTo(x + 10, oy); ctx.lineTo(x + 3, oy + 2); ctx.stroke();
    }
  }
  if (!icon && def.kind !== 'bananas' && def.kind !== 'carrots') {
    // the clear produce bag
    rr(ctx, x + 2, y + 4, w - 4, h - 6, 6);
    ctx.fillStyle = 'rgba(235,245,250,.28)'; ctx.fill();
    ctx.strokeStyle = 'rgba(31,27,38,.45)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w / 2 - 4, y + 4); ctx.lineTo(x + w / 2, y + 1); ctx.lineTo(x + w / 2 + 4, y + 4); ctx.stroke();
  }
}

// ---------------------------------------------------------------- people

// cx = centre, by = bottom of shoulders, s = scale. mood: 0 happy .. 1 cross
export function drawPerson(ctx, p, cx, by, s, o = {}) {
  ctx.save();
  ctx.translate(cx, by); ctx.scale(s, s);
  const kid = p.kid;
  const headR = kid ? 27 : 30;
  const neckY = kid ? -58 : -70;
  const hy = neckY - headR + 6;
  const lw = 2.6 / Math.max(0.6, s) * 1;

  // body / shoulders
  ctx.beginPath();
  const sw = kid ? 46 : 62;
  ctx.moveTo(-sw, 0); ctx.quadraticCurveTo(-sw, neckY + 20, -16, neckY + 10); ctx.lineTo(16, neckY + 10); ctx.quadraticCurveTo(sw, neckY + 20, sw, 0); ctx.closePath();
  fs(ctx, p.top, lw);
  if (p.gown) {
    ctx.fillStyle = shade(p.top, 0.25);
    ctx.beginPath(); ctx.moveTo(-16, neckY + 10); ctx.lineTo(0, -8); ctx.lineTo(16, neckY + 10); ctx.lineTo(8, neckY + 10); ctx.lineTo(0, -26); ctx.lineTo(-8, neckY + 10); ctx.closePath(); fs(ctx, shade(p.top, 0.3), lw * 0.8);
  }
  if (p.hood) {
    ctx.beginPath(); ctx.moveTo(-30, neckY + 12); ctx.quadraticCurveTo(0, neckY + 34, 30, neckY + 12); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, neckY + 22); ctx.lineTo(-9, neckY + 40); ctx.moveTo(8, neckY + 22); ctx.lineTo(9, neckY + 40); ctx.stroke();
  }
  if (p.tie) {
    ctx.fillStyle = '#fbfaf5'; ctx.beginPath(); ctx.moveTo(-14, neckY + 10); ctx.lineTo(0, neckY + 26); ctx.lineTo(14, neckY + 10); ctx.closePath(); fs(ctx, '#fbfaf5', lw * 0.8);
    ctx.beginPath(); ctx.moveTo(-4, neckY + 18); ctx.lineTo(4, neckY + 18); ctx.lineTo(6, -6); ctx.lineTo(0, 0); ctx.lineTo(-6, -6); ctx.closePath(); fs(ctx, p.tie, lw * 0.8);
  }
  if (p.badge) { rr(ctx, 22, neckY + 26, 22, 11, 2); fs(ctx, '#f6d34a', lw * 0.7); ctx.fillStyle = INK; ctx.fillRect(25, neckY + 30, 16, 2); }
  if (p.hair === 'veil') { ctx.fillStyle = '#e86f9a'; circ(ctx, -26, neckY + 26, 6); fs(ctx, '#e86f9a', lw * 0.7); }

  // neck & head
  ctx.fillStyle = p.skin; ctx.fillRect(-9, neckY - 6, 18, 18);
  ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(-9, neckY - 4); ctx.lineTo(-9, neckY + 10); ctx.moveTo(9, neckY - 4); ctx.lineTo(9, neckY + 10); ctx.stroke();

  // hair behind the head
  const hc = p.hairCol;
  if (p.hair === 'long') { rr(ctx, -headR - 4, hy - headR + 4, headR * 2 + 8, headR * 2 + 22, 18); fs(ctx, hc, lw); }
  if (p.hair === 'veil') {
    ctx.beginPath(); ctx.moveTo(-headR + 2, hy - headR * 0.6); ctx.quadraticCurveTo(-headR - 26, hy + 30, -headR - 22, hy + 70); ctx.lineTo(headR + 22, hy + 70); ctx.quadraticCurveTo(headR + 26, hy + 30, headR - 2, hy - headR * 0.6); ctx.closePath();
    fs(ctx, 'rgba(250,250,255,.7)', lw * 0.7);
    rr(ctx, -headR - 2, hy - headR + 4, headR * 2 + 4, headR * 2 + 10, 16); fs(ctx, hc, lw);
  }
  if (p.hair === 'wrap') { circ(ctx, 0, hy - headR * 0.9, headR * 0.85); fs(ctx, hc, lw); }
  // ears
  circ(ctx, -headR + 1, hy + 4, 6); fs(ctx, p.skin, lw); circ(ctx, headR - 1, hy + 4, 6); fs(ctx, p.skin, lw);
  ctx.beginPath(); ctx.ellipse(0, hy, headR * 0.92, headR, 0, 0, 7); fs(ctx, p.skin, lw);

  // hair on top
  ctx.save();
  if (p.hair === 'side') {
    ctx.beginPath(); ctx.moveTo(-headR * 0.95, hy - 2); ctx.quadraticCurveTo(-headR, hy - headR * 1.05, 4, hy - headR - 2); ctx.quadraticCurveTo(headR, hy - headR, headR * 0.95, hy - 4); ctx.quadraticCurveTo(headR * 0.4, hy - headR * 0.75, -headR * 0.2, hy - headR * 0.55); ctx.quadraticCurveTo(-headR * 0.7, hy - headR * 0.4, -headR * 0.95, hy - 2);
    fs(ctx, hc, lw);
  } else if (p.hair === 'short' || p.hair === 'messy') {
    ctx.beginPath(); ctx.moveTo(-headR * 0.95, hy - 4);
    const spikes = p.hair === 'messy' ? 7 : 5;
    for (let i = 0; i <= spikes; i++) { const a = Math.PI + i / spikes * Math.PI; const r = headR * (i % 2 ? 1.12 : 1.02) + (p.hair === 'messy' ? 4 : 0); ctx.lineTo(Math.cos(a) * r, hy + Math.sin(a) * r); }
    ctx.lineTo(headR * 0.95, hy - 4); ctx.quadraticCurveTo(0, hy - headR * 0.6, -headR * 0.95, hy - 4); fs(ctx, hc, lw);
  } else if (p.hair === 'cap') {
    ctx.beginPath(); ctx.moveTo(-headR, hy - 4); ctx.quadraticCurveTo(-headR, hy - headR * 1.15, 0, hy - headR * 1.12); ctx.quadraticCurveTo(headR, hy - headR * 1.15, headR, hy - 4); ctx.closePath(); fs(ctx, hc, lw);
    ctx.beginPath(); ctx.moveTo(-headR * 0.2, hy - 6); ctx.quadraticCurveTo(headR * 0.9, hy - 14, headR * 1.5, hy - 4); ctx.quadraticCurveTo(headR * 0.9, hy - 2, -headR * 0.2, hy - 6); fs(ctx, shade(hc, -0.2), lw);
  } else if (p.hair === 'bald') {
    ctx.beginPath(); ctx.moveTo(-headR * 0.92, hy + 2); ctx.quadraticCurveTo(-headR * 1.05, hy - 14, -headR * 0.65, hy - 18); ctx.lineWidth = 7; ctx.strokeStyle = hc; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(headR * 0.92, hy + 2); ctx.quadraticCurveTo(headR * 1.05, hy - 14, headR * 0.65, hy - 18); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-8, hy - headR * 0.7, 8, 4, -0.4, 0, 7); ctx.fill();
  } else if (p.hair === 'perm' || p.hair === 'curly') {
    const n = p.hair === 'perm' ? 9 : 8;
    for (let i = 0; i < n; i++) { const a = Math.PI * (1.02 + i / (n - 1) * 0.96); circ(ctx, Math.cos(a) * headR * 0.92, hy + Math.sin(a) * headR * 0.92, p.hair === 'perm' ? 11 : 10); fs(ctx, hc, lw * 0.8); }
  } else if (p.hair === 'long' || p.hair === 'veil') {
    ctx.beginPath(); ctx.moveTo(-headR * 0.95, hy + 4); ctx.quadraticCurveTo(-headR, hy - headR * 1.1, 0, hy - headR - 2); ctx.quadraticCurveTo(headR, hy - headR * 1.1, headR * 0.95, hy + 4); ctx.quadraticCurveTo(headR * 0.5, hy - headR * 0.6, 0, hy - headR * 0.68); ctx.quadraticCurveTo(-headR * 0.5, hy - headR * 0.6, -headR * 0.95, hy + 4); fs(ctx, hc, lw);
    if (p.hair === 'veil') { ctx.fillStyle = '#f6d34a'; for (let i = -2; i <= 2; i++) { circ(ctx, i * 7, hy - headR - 1 - (2 - Math.abs(i)) * 2, 3); fs(ctx, '#fbfaf5', 1.2); } }
  } else if (p.hair === 'wrap') {
    ctx.beginPath(); ctx.moveTo(-headR * 1.02, hy - 2); ctx.quadraticCurveTo(-headR * 1.1, hy - headR * 1.2, 0, hy - headR * 1.25); ctx.quadraticCurveTo(headR * 1.1, hy - headR * 1.2, headR * 1.02, hy - 2); ctx.quadraticCurveTo(0, hy - headR * 0.55, -headR * 1.02, hy - 2); fs(ctx, hc, lw);
    ctx.strokeStyle = shade(hc, 0.35); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-headR * 0.7, hy - headR * 0.75); ctx.quadraticCurveTo(0, hy - headR * 1.15, headR * 0.7, hy - headR * 0.75); ctx.stroke();
  }
  ctx.restore();

  // face
  const mood = o.mood || 0;
  const blink = o.blink;
  const ey = hy + 2;
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = lw;
  if (blink) { ctx.beginPath(); ctx.moveTo(-14, ey); ctx.lineTo(-6, ey); ctx.moveTo(6, ey); ctx.lineTo(14, ey); ctx.stroke(); }
  else { circ(ctx, -10, ey, 3); ctx.fill(); circ(ctx, 10, ey, 3); ctx.fill(); }
  // brows lean in when cross, up when sad
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  const bt = mood > 0.6 ? 4 : mood > 0.3 ? -2 : 0;
  ctx.moveTo(-16, ey - 9 - (bt < 0 ? -bt : 0)); ctx.lineTo(-5, ey - 9 + (bt > 0 ? bt : 0));
  ctx.moveTo(16, ey - 9 - (bt < 0 ? -bt : 0)); ctx.lineTo(5, ey - 9 + (bt > 0 ? bt : 0));
  ctx.stroke();
  if (p.glasses) {
    ctx.lineWidth = lw * 0.8;
    circ(ctx, -10, ey, 8); ctx.stroke(); circ(ctx, 10, ey, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2, ey); ctx.lineTo(2, ey); ctx.stroke();
  }
  // nose
  ctx.lineWidth = lw * 0.8; ctx.beginPath(); ctx.moveTo(1, ey + 4); ctx.quadraticCurveTo(5, ey + 11, 0, ey + 12); ctx.stroke();
  if (p.age >= 2) { ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-20, ey + 10); ctx.quadraticCurveTo(-18, ey + 16, -16, ey + 18); ctx.moveTo(20, ey + 10); ctx.quadraticCurveTo(18, ey + 16, 16, ey + 18); ctx.stroke(); }
  if (p.age >= 3) { ctx.beginPath(); ctx.moveTo(-19, ey - 1); ctx.lineTo(-23, ey - 3); ctx.moveTo(19, ey - 1); ctx.lineTo(23, ey - 3); ctx.stroke(); }
  if (p.kid || p.age === 0) { ctx.fillStyle = 'rgba(232,111,120,.35)'; circ(ctx, -17, ey + 10, 5); ctx.fill(); circ(ctx, 17, ey + 10, 5); ctx.fill(); }
  if (p.beard) { ctx.beginPath(); ctx.moveTo(-headR * 0.85, hy + 6); ctx.quadraticCurveTo(-headR * 0.7, hy + headR * 1.25, 0, hy + headR * 1.3); ctx.quadraticCurveTo(headR * 0.7, hy + headR * 1.25, headR * 0.85, hy + 6); ctx.quadraticCurveTo(0, hy + 20, -headR * 0.85, hy + 6); fs(ctx, p.hairCol, lw); }
  if (p.stubble) { ctx.fillStyle = 'rgba(31,27,38,.18)'; ctx.beginPath(); ctx.ellipse(0, hy + 20, 18, 10, 0, 0, 7); ctx.fill(); }
  // mouth
  const my = hy + 19;
  ctx.lineWidth = lw * 0.9; ctx.strokeStyle = INK;
  if (o.talk) { ctx.beginPath(); ctx.ellipse(0, my, 6, 3 + o.talk * 4, 0, 0, 7); ctx.fillStyle = '#5a1f2a'; ctx.fill(); ctx.stroke(); }
  else {
    ctx.beginPath();
    const curve = mood < 0.3 ? 6 : mood < 0.6 ? 0 : -5;
    ctx.moveTo(-8, my); ctx.quadraticCurveTo(0, my + curve, 8, my); ctx.stroke();
  }
  if (p.tash) { ctx.beginPath(); ctx.moveTo(-12, my - 2); ctx.quadraticCurveTo(-6, my - 9, 0, my - 5); ctx.quadraticCurveTo(6, my - 9, 12, my - 2); ctx.quadraticCurveTo(0, my - 4, -12, my - 2); fs(ctx, p.hairCol, lw * 0.8); }
  ctx.restore();
}

// ---------------------------------------------------------------- the shop

// sky colour through the window across the week (0 = Monday, 6 = Sunday)
export function skyFor(day, t) {
  const stops = [
    ['#a9cbe0', '#dfeaf0'], ['#9fc3dd', '#e8e6dc'], ['#a7b9d4', '#f0dcc4'], ['#c1a9c8', '#f6cfa4'],
    ['#d8a39a', '#f8c486'], ['#eba67a', '#fbd59a'], ['#f6c48a', '#fff4dc'],
  ];
  const s = stops[Math.max(0, Math.min(6, day))];
  return s;
}

export function drawWindow(ctx, x, y, w, h, day, t, storeName = "BELLAMY'S") {
  ctx.save();
  rr(ctx, x, y, w, h, 6); ctx.clip();
  const [top, bot] = skyFor(day, t);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // the rock: a small hard star that grows all week
  const size = [3, 4.5, 7, 10, 15, 23, 40][day] || 3;
  const mx = x + w * 0.78, my = y + h * 0.22;
  const glow = ctx.createRadialGradient(mx, my, 0, mx, my, size * (day >= 5 ? 6 : 4));
  glow.addColorStop(0, 'rgba(255,250,235,.95)'); glow.addColorStop(0.25, 'rgba(255,230,190,.55)'); glow.addColorStop(1, 'rgba(255,220,170,0)');
  ctx.fillStyle = glow; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#fffaf0'; circ(ctx, mx, my, size); ctx.fill();
  if (day >= 1) {
    ctx.strokeStyle = 'rgba(255,250,235,.5)'; ctx.lineWidth = size * 0.5;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + size * 2.4, my - size * 1.3); ctx.stroke();
  }
  // rooftops across the road
  ctx.fillStyle = day >= 5 ? '#8a6a6a' : '#7d8a9a';
  ctx.beginPath(); ctx.moveTo(x, y + h);
  const roofs = [0.62, 0.55, 0.66, 0.5, 0.6, 0.7, 0.58, 0.64];
  for (let i = 0; i < roofs.length; i++) {
    const rx = x + w * i / roofs.length, ry = y + h * roofs[i];
    ctx.lineTo(rx, ry); ctx.lineTo(rx + w / roofs.length * 0.5, ry - h * 0.06); ctx.lineTo(rx + w / roofs.length, ry);
  }
  ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
  // window lettering, back to front from inside the shop
  ctx.save();
  ctx.translate(x + w / 2, y + Math.min(26, w * 0.09) * 0.75 + 8); ctx.scale(-1, 1);
  ctx.font = `${Math.min(26, w * 0.09)}px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(200,40,50,.55)'; ctx.fillText(storeName, 0, 0);
  ctx.restore();
  // mullions
  ctx.fillStyle = '#d9ddd6'; ctx.fillRect(x + w * 0.5 - 3, y, 6, h);
  ctx.restore();
  rr(ctx, x, y, w, h, 6); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
}

// a starburst price card, the shop's own promo shape
export function starburst(ctx, x, y, r, points, fill, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + i / (points * 2) * Math.PI * 2;
    const rr2 = i % 2 ? r * 0.8 : r;
    ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  ctx.closePath(); fs(ctx, fill, 2.2);
}

// wrap text into lines that fit maxW in the current font
export function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

export { fs, circ, shade, label, hash };
