// Glossy gumballs with a printed glyph on each, drawn at unit radius and cached as sprites.
import { KINDS } from './symbols.js';

const CREAM = '#fff4e0';
const TAU = Math.PI * 2;

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export { shade };

function star(c, n, r0, r1, rot = -Math.PI / 2) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n, r = i % 2 ? r1 : r0;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath();
}
const circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); };

const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };

// draws the glyph for `kind` in a unit circle; `col` is the ball colour (for cut-outs)
export function glyph(c, kind, col, roll = 0) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  switch (kind) {
    case 'coin': {
      c.strokeStyle = CREAM; c.lineWidth = 0.15;
      c.beginPath(); c.arc(0.02, 0, 0.36, 0.28 * Math.PI, 1.72 * Math.PI, false); c.stroke();
      c.beginPath(); c.moveTo(0.02, -0.6); c.lineTo(0.02, 0.6); c.stroke();
      break;
    }
    case 'gold': {
      star(c, 5, 0.62, 0.27); c.fillStyle = '#fff6cc'; c.fill();
      c.strokeStyle = '#a77700'; c.lineWidth = 0.08; c.stroke();
      break;
    }
    case 'diamond': {
      c.beginPath(); c.moveTo(-0.55, -0.18); c.lineTo(-0.3, -0.45); c.lineTo(0.3, -0.45); c.lineTo(0.55, -0.18); c.lineTo(0, 0.55); c.closePath();
      c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = '#2a8fb0'; c.lineWidth = 0.07; c.stroke();
      c.beginPath(); c.moveTo(-0.55, -0.18); c.lineTo(0.55, -0.18); c.moveTo(-0.15, -0.45); c.lineTo(-0.22, -0.18); c.lineTo(0, 0.55); c.lineTo(0.22, -0.18); c.lineTo(0.15, -0.45); c.stroke();
      break;
    }
    case 'cherry': {
      c.strokeStyle = CREAM; c.lineWidth = 0.09;
      c.beginPath(); c.moveTo(-0.25, 0.12); c.quadraticCurveTo(-0.05, -0.35, 0.25, -0.55); c.moveTo(0.25, 0.2); c.quadraticCurveTo(0.2, -0.2, 0.25, -0.55); c.stroke();
      c.fillStyle = CREAM; circle(c, -0.27, 0.3, 0.24); c.fill(); circle(c, 0.25, 0.36, 0.24); c.fill();
      c.beginPath(); c.ellipse(0.42, -0.5, 0.2, 0.09, -0.4, 0, TAU); c.fill();
      break;
    }
    case 'flower': case 'clover': {
      c.fillStyle = CREAM;
      const n = kind === 'flower' ? 6 : 4, pr = kind === 'flower' ? 0.21 : 0.24, pd = kind === 'flower' ? 0.36 : 0.26;
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU + (kind === 'clover' ? Math.PI / 4 : 0); circle(c, Math.cos(a) * pd, Math.sin(a) * pd - (kind === 'clover' ? 0.08 : 0), pr); c.fill(); }
      if (kind === 'flower') { c.fillStyle = '#ffd23f'; circle(c, 0, 0, 0.19); c.fill(); }
      else { c.strokeStyle = CREAM; c.lineWidth = 0.09; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(0.08, 0.4, 0.28, 0.6); c.stroke(); }
      break;
    }
    case 'sunflower': {
      c.fillStyle = '#c45f00';
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; c.save(); c.rotate(a); c.beginPath(); c.ellipse(0.42, 0, 0.17, 0.08, 0, 0, TAU); c.fill(); c.restore(); }
      c.fillStyle = '#5a2e0c'; circle(c, 0, 0, 0.26); c.fill();
      c.fillStyle = '#8a4a1a'; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; circle(c, Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0.035); c.fill(); }
      break;
    }
    case 'bee': {
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.beginPath(); c.ellipse(-0.14, -0.36, 0.17, 0.25, -0.5, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(0.14, -0.36, 0.17, 0.25, 0.5, 0, TAU); c.fill();
      c.fillStyle = '#2b1d14'; c.beginPath(); c.ellipse(0, 0.1, 0.42, 0.3, 0, 0, TAU); c.fill();
      c.fillStyle = col; c.fillRect(-0.16, -0.25, 0.1, 0.7); c.fillRect(0.08, -0.25, 0.1, 0.7);
      c.strokeStyle = '#2b1d14'; c.lineWidth = 0.07; c.beginPath(); c.moveTo(0.42, 0.1); c.lineTo(0.6, 0.12); c.stroke();
      break;
    }
    case 'hive': {
      c.fillStyle = '#5a3300';
      const rows = [[0.5, 0.3], [0.42, 0.06], [0.3, -0.18], [0.16, -0.4]];
      for (const [w, y] of rows) { c.beginPath(); c.roundRect(-w, y - 0.1, w * 2, 0.19, 0.09); c.fill(); }
      c.fillStyle = col; circle(c, 0, 0.32, 0.09); c.fill();
      break;
    }
    case 'fish': {
      c.fillStyle = CREAM;
      c.beginPath(); c.ellipse(-0.08, 0, 0.42, 0.26, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(0.26, 0); c.lineTo(0.62, -0.26); c.lineTo(0.62, 0.26); c.closePath(); c.fill();
      c.fillStyle = col; circle(c, -0.3, -0.06, 0.06); c.fill();
      break;
    }
    case 'milk': {
      c.fillStyle = '#2f62b0';
      c.beginPath(); c.moveTo(-0.3, -0.18); c.lineTo(-0.3, 0.58); c.lineTo(0.3, 0.58); c.lineTo(0.3, -0.18); c.lineTo(0.18, -0.42); c.lineTo(-0.18, -0.42); c.closePath(); c.fill();
      c.fillRect(-0.12, -0.6, 0.24, 0.16);
      c.fillStyle = col; c.fillRect(-0.3, 0.06, 0.6, 0.2);
      break;
    }
    case 'mouse': {
      c.fillStyle = CREAM;
      circle(c, -0.3, -0.3, 0.2); c.fill(); circle(c, 0.3, -0.3, 0.2); c.fill(); circle(c, 0, 0.05, 0.36); c.fill();
      c.fillStyle = '#ff8fab'; circle(c, -0.3, -0.3, 0.1); c.fill(); circle(c, 0.3, -0.3, 0.1); c.fill(); circle(c, 0, 0.24, 0.07); c.fill();
      c.fillStyle = '#3a3a44'; circle(c, -0.13, 0.0, 0.05); c.fill(); circle(c, 0.13, 0.0, 0.05); c.fill();
      break;
    }
    case 'cheese': {
      c.beginPath(); c.moveTo(-0.55, 0.38); c.lineTo(0.55, 0.38); c.lineTo(0.55, -0.05); c.lineTo(-0.55, 0.12); c.closePath();
      c.fillStyle = '#fff0b8'; c.fill();
      c.beginPath(); c.moveTo(-0.55, 0.12); c.lineTo(0.55, -0.05); c.lineTo(0.2, -0.38); c.closePath(); c.fillStyle = '#ffe07a'; c.fill();
      c.strokeStyle = '#8a5200'; c.lineWidth = 0.06;
      c.beginPath(); c.moveTo(-0.55, 0.38); c.lineTo(0.55, 0.38); c.lineTo(0.55, -0.05); c.lineTo(0.2, -0.38); c.lineTo(-0.55, 0.12); c.closePath(); c.stroke();
      c.fillStyle = '#e0a020'; circle(c, -0.2, 0.25, 0.07); c.fill(); circle(c, 0.25, 0.18, 0.09); c.fill(); circle(c, 0.12, -0.08, 0.05); c.fill();
      break;
    }
    case 'seed': {
      c.fillStyle = CREAM;
      c.beginPath(); c.moveTo(0, -0.55); c.bezierCurveTo(0.42, -0.2, 0.36, 0.45, 0, 0.5); c.bezierCurveTo(-0.36, 0.45, -0.42, -0.2, 0, -0.55); c.fill();
      c.strokeStyle = col; c.lineWidth = 0.06; c.beginPath(); c.moveTo(0, -0.35); c.lineTo(0, 0.35); c.stroke();
      break;
    }
    case 'egg': {
      c.strokeStyle = '#b8864f'; c.lineWidth = 0.08;
      c.beginPath(); c.moveTo(-0.6, 0.05); c.lineTo(-0.38, -0.12); c.lineTo(-0.18, 0.08); c.lineTo(0.02, -0.12); c.lineTo(0.22, 0.08); c.lineTo(0.42, -0.12); c.lineTo(0.6, 0.04); c.stroke();
      c.fillStyle = '#e6b77a'; circle(c, -0.25, 0.35, 0.07); c.fill(); circle(c, 0.18, 0.4, 0.06); c.fill(); circle(c, 0.05, -0.4, 0.06); c.fill(); circle(c, 0.35, -0.38, 0.05); c.fill();
      break;
    }
    case 'chick': {
      c.fillStyle = '#2b1d14'; circle(c, -0.2, -0.08, 0.07); c.fill(); circle(c, 0.2, -0.08, 0.07); c.fill();
      c.fillStyle = '#ff8a1f'; c.beginPath(); c.moveTo(-0.13, 0.08); c.lineTo(0.13, 0.08); c.lineTo(0, 0.28); c.closePath(); c.fill();
      c.strokeStyle = '#e8b800'; c.lineWidth = 0.07; c.beginPath(); c.moveTo(-0.05, -0.52); c.quadraticCurveTo(0, -0.7, 0.08, -0.5); c.stroke();
      break;
    }
    case 'hen': {
      c.fillStyle = '#ff3b3b'; circle(c, -0.16, -0.5, 0.13); c.fill(); circle(c, 0.02, -0.56, 0.14); c.fill(); circle(c, 0.19, -0.48, 0.12); c.fill();
      c.fillStyle = CREAM; circle(c, 0.12, -0.12, 0.09); c.fill();
      c.fillStyle = '#2b1d14'; circle(c, 0.13, -0.12, 0.04); c.fill();
      c.fillStyle = '#ffc21f'; c.beginPath(); c.moveTo(0.34, -0.06); c.lineTo(0.62, 0.04); c.lineTo(0.34, 0.14); c.closePath(); c.fill();
      c.fillStyle = '#ff3b3b'; c.beginPath(); c.ellipse(0.36, 0.26, 0.07, 0.12, 0, 0, TAU); c.fill();
      break;
    }
    case 'dice': {
      c.strokeStyle = '#d8d0c4'; c.lineWidth = 0.06; c.beginPath(); c.roundRect(-0.48, -0.48, 0.96, 0.96, 0.16); c.stroke();
      if (!roll) {
        c.fillStyle = '#2b2b33'; c.font = '900 0.9px "Big Shoulders Display", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, 0.06);
      } else {
        c.fillStyle = '#2b2b33';
        for (const [x, y] of PIPS[roll]) { circle(c, x * 0.27, y * 0.27, 0.1); c.fill(); }
      }
      break;
    }
    case 'balloon': {
      c.strokeStyle = CREAM; c.lineWidth = 0.05; c.beginPath(); c.moveTo(0, 0.28); c.bezierCurveTo(0.12, 0.4, -0.12, 0.5, 0.04, 0.65); c.stroke();
      c.fillStyle = CREAM; c.beginPath(); c.ellipse(0, -0.12, 0.32, 0.38, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(-0.07, 0.3); c.lineTo(0.07, 0.3); c.lineTo(0, 0.22); c.fill();
      c.fillStyle = col; c.beginPath(); c.ellipse(-0.12, -0.26, 0.06, 0.1, -0.5, 0, TAU); c.fill();
      break;
    }
    case 'cat': {
      c.fillStyle = '#3b1a0c';
      c.beginPath(); c.moveTo(-0.62, -0.25); c.lineTo(-0.5, -0.7); c.lineTo(-0.2, -0.5); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(0.62, -0.25); c.lineTo(0.5, -0.7); c.lineTo(0.2, -0.5); c.closePath(); c.fill();
      c.fillStyle = '#c7f25a'; c.beginPath(); c.ellipse(-0.24, -0.08, 0.13, 0.1, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0.24, -0.08, 0.13, 0.1, 0, 0, TAU); c.fill();
      c.fillStyle = '#3b1a0c'; c.fillRect(-0.26, -0.17, 0.04, 0.18); c.fillRect(0.22, -0.17, 0.04, 0.18);
      c.fillStyle = '#ff9fb2'; c.beginPath(); c.moveTo(-0.07, 0.12); c.lineTo(0.07, 0.12); c.lineTo(0, 0.2); c.closePath(); c.fill();
      c.strokeStyle = '#3b1a0c'; c.lineWidth = 0.04;
      c.beginPath(); c.moveTo(-0.15, 0.22); c.lineTo(-0.6, 0.15); c.moveTo(-0.15, 0.26); c.lineTo(-0.58, 0.32); c.moveTo(0.15, 0.22); c.lineTo(0.6, 0.15); c.moveTo(0.15, 0.26); c.lineTo(0.58, 0.32); c.stroke();
      break;
    }
    case 'magnet': {
      c.strokeStyle = '#d7263d'; c.lineWidth = 0.26; c.lineCap = 'butt';
      c.beginPath(); c.moveTo(-0.3, -0.5); c.lineTo(-0.3, 0.05); c.arc(0, 0.05, 0.3, Math.PI, 0, true); c.lineTo(0.3, -0.5); c.stroke();
      c.strokeStyle = '#f4f6f8'; c.beginPath(); c.moveTo(-0.3, -0.6); c.lineTo(-0.3, -0.38); c.moveTo(0.3, -0.6); c.lineTo(0.3, -0.38); c.stroke();
      break;
    }
    case 'bomb': {
      c.fillStyle = CREAM; circle(c, -0.06, 0.12, 0.34); c.fill();
      c.fillRect(0.06, -0.34, 0.2, 0.18);
      c.strokeStyle = CREAM; c.lineWidth = 0.06; c.beginPath(); c.moveTo(0.16, -0.34); c.quadraticCurveTo(0.22, -0.55, 0.42, -0.5); c.stroke();
      c.fillStyle = '#ffb627'; c.save(); c.translate(0.45, -0.52); star(c, 6, 0.17, 0.07); c.fill(); c.restore();
      c.fillStyle = col; c.beginPath(); c.ellipse(-0.18, 0.02, 0.07, 0.1, 0.5, 0, TAU); c.fill();
      break;
    }
    case 'superball': {
      c.strokeStyle = '#ffe14d'; c.lineWidth = 0.22;
      c.beginPath(); c.moveTo(-0.95, 0.3); c.bezierCurveTo(-0.4, -0.5, 0.4, 0.5, 0.95, -0.3); c.stroke();
      c.strokeStyle = '#ff5c8a'; c.lineWidth = 0.1;
      c.beginPath(); c.moveTo(-0.95, 0.62); c.bezierCurveTo(-0.4, -0.18, 0.4, 0.82, 0.95, 0.02); c.stroke();
      break;
    }
    case 'jawbreaker': {
      const rings = ['#ffd23f', '#3fb6ff', '#fff4e0', '#7ad15a', '#ff4f79'];
      for (let i = 0; i < rings.length; i++) { c.fillStyle = rings[i]; circle(c, 0.04 * i, 0.04 * i, 0.78 - i * 0.16); c.fill(); }
      break;
    }
    case 'rainbow': {
      const cols = ['#e63946', '#ff9f1c', '#ffd23f', '#3fb950', '#3a86ff', '#8e5cf7'];
      c.lineWidth = 0.1; c.lineCap = 'butt';
      cols.forEach((cc, i) => { c.strokeStyle = cc; c.beginPath(); c.arc(0, 0.32, 0.62 - i * 0.1, Math.PI, 0); c.stroke(); });
      break;
    }
  }
}

const LIGHT = new Set(['milk', 'egg', 'dice', 'rainbow', 'chick', 'diamond', 'gold', 'cheese', 'sunflower', 'bee']);

// a full glossy ball, at radius r in pixels, centred on (0,0)
export function paintBall(c, kind, r, roll = 0) {
  const col = KINDS[kind].color;
  c.save();
  // body
  const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, shade(col, 0.35));
  g.addColorStop(0.55, col);
  g.addColorStop(1, shade(col, LIGHT.has(kind) ? -0.22 : -0.38));
  c.fillStyle = g;
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  // glyph
  c.save();
  c.beginPath(); c.arc(0, 0, r * 0.98, 0, TAU); c.clip();
  c.scale(r, r);
  glyph(c, kind, col, roll);
  c.restore();
  // gloss
  const s = c.createRadialGradient(-r * 0.38, -r * 0.48, 0, -r * 0.38, -r * 0.48, r * 0.55);
  s.addColorStop(0, 'rgba(255,255,255,.85)'); s.addColorStop(0.35, 'rgba(255,255,255,.35)'); s.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = s; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  c.lineWidth = Math.max(1, r * 0.06); c.strokeStyle = 'rgba(40,10,10,.32)';
  c.beginPath(); c.arc(0, 0, r - c.lineWidth / 2, 0, TAU); c.stroke();
  c.restore();
}

const cache = new Map();
// cached sprite: returns a canvas of size ~2r+pad (device pixels)
export function sprite(kind, rpx, roll = 0) {
  const R = Math.max(4, Math.round(rpx));
  const key = kind + '|' + R + '|' + roll;
  let cv = cache.get(key);
  if (!cv) {
    if (cache.size > 600) cache.clear();
    cv = document.createElement('canvas');
    cv.width = cv.height = R * 2 + 4;
    const c = cv.getContext('2d');
    c.translate(R + 2, R + 2);
    paintBall(c, kind, R, roll);
    cache.set(key, cv);
  }
  return cv;
}
export function clearSprites() { cache.clear(); }
