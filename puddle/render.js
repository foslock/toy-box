// Drawing, in the manner of a shin-hanga woodblock print: flat colour blocks, a key-block line over them
// printed a hair out of register, bokashi gradients, long straight rain, and wood grain through everything.
import { INK, BY_ID, SPOTS } from './data.js';
import { phaseOf, weatherOf } from './game.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- colour
const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
export function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function rgba(c, a) { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; }

const SKY = [
  { zen: '#24345c', mid: '#8e7a98', hor: '#eaa46a', pave: '#3b3a47', line: '#24232c', glint: '#eab47c', win: '#f3cf7c', bld: '#2b2434', lit: 0.5 },
  { zen: '#0d1730', mid: '#1b2c51', hor: '#30507e', pave: '#1f2533', line: '#11151d', glint: '#f2cd7a', win: '#f4d27d', bld: '#141526', lit: 1 },
  { zen: '#090f21', mid: '#13243f', hor: '#24485b', pave: '#181d28', line: '#0d1017', glint: '#d2dacb', win: '#e9c873', bld: '#0f111c', lit: 0.35 },
  { zen: '#3d5d8c', mid: '#b19bb0', hor: '#f5c7a0', pave: '#4b4b58', line: '#33333e', glint: '#f6d4b0', win: '#f0d39a', bld: '#3a3346', lit: 0.15 },
];
export function palette(phase, weather) {
  const p = { ...SKY[phase] };
  const tint = weather === 1 ? ['#3a4252', 0.42] : weather === 0 ? ['#5d6678', 0.16] : null;
  if (tint) for (const k of ['zen', 'mid', 'hor', 'pave', 'glint']) p[k] = mix(p[k], tint[0], tint[1]);
  return p;
}

// ---------------------------------------------------------------- shared helpers
function seeded(seed) { let s = seed >>> 0 || 7; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

let grainTile = null;
function grain() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), r = seeded(11);
  // wood grain: long wavy strokes, the block the colour was cut from
  for (let i = 0; i < 46; i++) {
    const y0 = r() * 256, amp = 2 + r() * 5, f = 0.01 + r() * 0.02, ph = r() * TAU;
    x.strokeStyle = r() < 0.5 ? 'rgba(20,14,10,0.07)' : 'rgba(255,248,230,0.05)';
    x.lineWidth = 0.6 + r() * 1.4;
    x.beginPath();
    for (let px = -4; px <= 260; px += 6) { const y = y0 + Math.sin(px * f + ph) * amp; px < 0 ? x.moveTo(px, y) : x.lineTo(px, y); }
    x.stroke();
  }
  // paper fibre speckle
  const id = x.getImageData(0, 0, 256, 256), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = r();
    if (n < 0.06) { d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.max(d[i + 3], 14); }
    else if (n > 0.95) { d[i] = 20; d[i + 1] = 16; d[i + 2] = 12; d[i + 3] = Math.max(d[i + 3], 16); }
  }
  x.putImageData(id, 0, 0);
  return grainTile = c;
}
function laygrain(x, w, h) {
  const pat = x.createPattern(grain(), 'repeat');
  x.save(); x.fillStyle = pat; x.fillRect(0, 0, w, h); x.restore();
}

// The puddle outline: a wobbly ellipse, different for each spot. Returns radius multiplier at angle a.
const SHAPES = SPOTS.map((_, i) => { const r = seeded(31 + i * 17); return [2, 3, 4, 5].map(k => [k, (r() - 0.5) * (0.13 / k * 2), r() * TAU]); });
export function edgeR(spot, a) { let v = 1; for (const [k, amp, ph] of SHAPES[spot]) v += amp * Math.sin(k * a + ph); return v; }
function puddlePath(x, V, spot, grow = 0) {
  x.beginPath();
  for (let i = 0; i <= 80; i++) {
    const a = i / 80 * TAU, r = edgeR(spot, a) + grow;
    const px = V.cx + Math.cos(a) * r * V.rx, py = V.cy + Math.sin(a) * r * V.ry;
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.closePath();
}

// ---------------------------------------------------------------- catch pictures
const pathCache = new Map();
function P(d) { let p = pathCache.get(d); if (!p) { p = new Path2D(d); pathCache.set(d, p); } return p; }

// mode 'print': colour blocks out of register under the key block. 'flat': one colour (for shadows and silhouettes).
export function drawArt(x, c, cx, cy, size, mode = 'print', flat = '#000') {
  x.save();
  x.translate(cx - size / 2, cy - size / 2);
  x.scale(size / 100, size / 100);
  x.lineJoin = 'round'; x.lineCap = 'round';
  if (mode === 'flat') {
    x.fillStyle = flat; x.strokeStyle = flat; x.lineWidth = 5;
    for (const [, d] of c.art) { x.fill(P(d)); x.stroke(P(d)); }
    for (const d of c.line) x.stroke(P(d));
  } else {
    x.save(); x.translate(1.8, 1.3);
    for (const [k, d] of c.art) { x.fillStyle = INK[k]; x.fill(P(d)); }
    x.restore();
    x.strokeStyle = INK.ink; x.lineWidth = 2.6;
    for (const [k, d] of c.art) if (k !== 'lamp' && k !== 'ink') x.stroke(P(d));
    x.lineWidth = 2.8;
    for (const d of c.line) x.stroke(P(d));
  }
  x.restore();
}

// soft silhouettes for things drifting in the reflection, made once per catch
const ghostCache = new Map();
function ghost(c, glow) {
  const key = c.id + (glow ? 'g' : '');
  if (ghostCache.has(key)) return ghostCache.get(key);
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d');
  const col = glow ? (c.id === 'moon' ? '#f6ecc4' : '#ffe6a0') : '#070b18';
  if (glow) {
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,236,170,0.55)'); g.addColorStop(1, 'rgba(255,236,170,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
  }
  x.globalAlpha = 0.16;
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, d = i ? 3 : 0; drawArt(x, c, S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, S * 0.7, 'flat', col); }
  x.globalAlpha = 0.5; drawArt(x, c, S / 2, S / 2, S * 0.66, 'flat', col);
  ghostCache.set(key, cv);
  return cv;
}

// ---------------------------------------------------------------- the reflected sky, drawn hanging from the far edge
function reflection(V, spot, phase, weather, dpr) {
  const w = Math.ceil(V.rx * 2.3), h = Math.ceil(V.ry * 2.3);
  const cv = document.createElement('canvas'); cv.width = w * dpr; cv.height = h * dpr;
  const x = cv.getContext('2d'); x.scale(dpr, dpr);
  const p = palette(phase, weather), r = seeded(100 + spot * 13 + phase * 3 + weather);
  // y = 0 is where the street meets the sky beyond the puddle; y grows up into the sky (toward you).
  const sky = x.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, p.hor); sky.addColorStop(0.45, p.mid); sky.addColorStop(1, p.zen);
  x.fillStyle = sky; x.fillRect(0, 0, w, h);
  // clouds: soft flat bands
  if (weather !== 2 || phase === 0 || phase === 3) {
    const n = weather === 1 ? 6 : weather === 0 ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const cy = h * (0.15 + r() * 0.75), cw = w * (0.5 + r() * 0.7), cx = r() * w, th = 6 + r() * (weather === 1 ? 22 : 12);
      x.fillStyle = weather === 1 ? rgba(mix(p.zen, '#000000', 0.25), 0.55) : rgba(mix(p.mid, '#ffffff', 0.25), weather === 2 ? 0.35 : 0.45);
      x.beginPath(); x.ellipse(cx, cy, cw / 2, th, 0, 0, TAU); x.fill();
    }
  }
  if (weather === 2 && (phase === 1 || phase === 2)) {
    for (let i = 0; i < 60; i++) {
      const sx = r() * w, sy = h * (0.25 + r() * 0.75), s = r() < 0.15 ? 2.2 : 1.1;
      x.fillStyle = rgba('#f4ecd0', 0.5 + r() * 0.5);
      x.fillRect(sx - s / 2, sy - s / 2, s, s);
      if (s > 2) { x.fillRect(sx - 4, sy - 0.4, 8, 0.8); x.fillRect(sx - 0.4, sy - 4, 0.8, 8); }
    }
  }
  const lit = p.lit;
  const building = (x0, x1, top, roof) => {
    x.fillStyle = p.bld;
    x.beginPath(); x.moveTo(x0, -2); x.lineTo(x0, top);
    if (roof === 'gable') { x.lineTo((x0 + x1) / 2, top + (x1 - x0) * 0.28); x.lineTo(x1, top); }
    else if (roof === 'eave') { x.lineTo(x0 - 8, top); x.quadraticCurveTo((x0 + x1) / 2, top + 14, x1 + 8, top); x.lineTo(x1, top); }
    else x.lineTo(x1, top);
    x.lineTo(x1, -2); x.closePath(); x.fill();
    x.strokeStyle = INK.ink; x.lineWidth = 2; x.lineJoin = 'round'; x.stroke();
    if (lit > 0) {
      const cols = Math.max(1, Math.floor((x1 - x0) / 18)), rows = Math.max(1, Math.floor(top / 26));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if (r() > lit * 0.8) continue;
        const wx = x0 + (i + 0.5) * (x1 - x0) / cols - 4, wy = 10 + j * 26;
        x.fillStyle = p.win; x.fillRect(wx, wy, 8, 11);
      }
    }
  };
  const K = SPOTS[spot].key;
  const glowAt = (gx, gy, rad, a) => {
    const g = x.createRadialGradient(gx, gy, 0, gx, gy, rad);
    g.addColorStop(0, rgba('#ffe7a6', a)); g.addColorStop(1, rgba('#ffe7a6', 0));
    x.fillStyle = g; x.fillRect(gx - rad, gy - rad, rad * 2, rad * 2);
  };
  const lampOn = phase === 1 || phase === 2 ? 1 : phase === 0 ? 0.6 : 0.25;
  if (K === 'lamp') {
    building(0, w * 0.22, h * 0.55, 'gable'); building(w * 0.8, w, h * 0.62);
    const px = w * 0.36, top = h * 0.66;
    x.strokeStyle = INK.ink; x.lineWidth = 7; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, top); x.quadraticCurveTo(px, top + 22, px + 30, top + 22); x.stroke();
    glowAt(px + 34, top + 6, 120, 0.55 * lampOn);
    x.fillStyle = INK.ink; x.beginPath(); x.moveTo(px + 22, top + 22); x.lineTo(px + 46, top + 22); x.lineTo(px + 42, top); x.lineTo(px + 26, top); x.closePath(); x.fill();
    x.fillStyle = mix(INK.lamp, p.zen, 1 - lampOn); x.fillRect(px + 28, top + 3, 12, 16);
  } else if (K === 'bakery') {
    building(0, w * 0.55, h * 0.5); building(w * 0.84, w, h * 0.42, 'gable');
    const ay = h * 0.12, n = 9;
    for (let i = 0; i < n; i++) {
      const ax = i * w * 0.6 / n;
      x.fillStyle = i % 2 ? INK.white : INK.red;
      x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax + w * 0.6 / n, ay); x.lineTo(ax + w * 0.6 / n, ay + 26); x.arc(ax + w * 0.3 / n, ay + 26, w * 0.3 / n, 0, Math.PI); x.closePath(); x.fill();
    }
    x.strokeStyle = INK.ink; x.lineWidth = 3; x.beginPath(); x.moveTo(0, ay); x.lineTo(w * 0.6, ay); x.stroke();
    x.beginPath(); x.moveTo(w * 0.66, h * 0.2); x.lineTo(w * 0.66, h * 0.3); x.stroke();
    x.fillStyle = INK.gold; x.beginPath(); x.ellipse(w * 0.66, h * 0.34, 18, 13, 0, 0, TAU); x.fill(); x.stroke();
  } else if (K === 'tram') {
    building(0, w * 0.18, h * 0.3); building(w * 0.18, w * 0.34, h * 0.38, 'gable'); building(w * 0.72, w, h * 0.34);
    x.strokeStyle = INK.ink; x.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(-10, h * (0.45 + i * 0.12)); x.quadraticCurveTo(w * 0.5, h * (0.55 + i * 0.12), w + 10, h * (0.4 + i * 0.13)); x.stroke(); }
    x.lineWidth = 6; x.beginPath(); x.moveTo(w * 0.62, 0); x.lineTo(w * 0.62, h * 0.72); x.stroke();
    x.fillStyle = INK.white; x.beginPath(); x.arc(w * 0.62, h * 0.52, 16, 0, TAU); x.fill(); x.lineWidth = 3; x.stroke();
    x.fillStyle = INK.red; x.fillRect(w * 0.62 - 14, h * 0.52 - 4, 28, 8);
  } else if (K === 'cherry') {
    building(w * 0.66, w, h * 0.34, 'eave');
    x.strokeStyle = '#2b1c18'; x.lineCap = 'round';
    const branch = (x0, y0, a, len, wd, d) => {
      const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
      x.lineWidth = wd; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
      if (d > 0) { branch(x1, y1, a - 0.5 + r() * 0.3, len * 0.72, wd * 0.65, d - 1); branch(x1, y1, a + 0.35 + r() * 0.3, len * 0.7, wd * 0.65, d - 1); }
      else for (let i = 0; i < 6; i++) { x.fillStyle = r() < 0.6 ? INK.pink : '#f6dcd6'; x.beginPath(); x.arc(x1 + (r() - 0.5) * 26, y1 + (r() - 0.5) * 22, 4 + r() * 5, 0, TAU); x.fill(); }
    };
    branch(-10, h * 0.1, 0.55, h * 0.32, 14, 4);
  } else if (K === 'bridge') {
    x.fillStyle = mix(p.bld, p.hor, 0.35);
    x.beginPath(); x.moveTo(0, 0); for (let i = 0; i <= 10; i++) x.lineTo(i / 10 * w, h * 0.05 + Math.sin(i * 1.3) * 6 + 8); x.lineTo(w, 0); x.fill();
    for (let i = 0; i < 4; i++) {
      const lx = w * (0.1 + i * 0.27), lh = h * (0.32 - i * 0.04);
      x.strokeStyle = INK.ink; x.lineWidth = 4; x.beginPath(); x.moveTo(lx, 0); x.lineTo(lx, lh); x.stroke();
      glowAt(lx, lh + 6, 50, 0.5 * lampOn);
      x.fillStyle = INK.ink; x.fillRect(lx - 7, lh, 14, 12);
      x.fillStyle = mix(INK.lamp, p.zen, 1 - lampOn); x.fillRect(lx - 4, lh + 2, 8, 8);
    }
    x.strokeStyle = '#2f4a2e'; x.lineWidth = 1.6;
    for (let i = 0; i < 26; i++) { const sx = w * 0.78 + r() * w * 0.3; x.beginPath(); x.moveTo(sx, h); x.quadraticCurveTo(sx - 10, h * 0.7, sx - 4 - r() * 14, h * (0.35 + r() * 0.25)); x.stroke(); }
  } else if (K === 'square') {
    for (let i = 0; i < 7; i++) building(i * w / 7, (i + 1) * w / 7 - 2, h * (0.08 + r() * 0.08), r() < 0.5 ? 'gable' : null);
    building(w * 0.66, w * 0.76, h * 0.62);
    x.fillStyle = p.bld; x.beginPath(); x.moveTo(w * 0.65, h * 0.62); x.lineTo(w * 0.71, h * 0.78); x.lineTo(w * 0.77, h * 0.62); x.fill();
    x.fillStyle = mix(INK.paper, p.zen, 0.35); x.beginPath(); x.arc(w * 0.71, h * 0.48, 10, 0, TAU); x.fill();
    x.strokeStyle = INK.ink; x.lineWidth = 1.5; x.stroke(); x.beginPath(); x.moveTo(w * 0.71, h * 0.48); x.lineTo(w * 0.71, h * 0.48 - 7); x.moveTo(w * 0.71, h * 0.48); x.lineTo(w * 0.71 + 5, h * 0.48); x.stroke();
  }
  laygrain(x, w, h);
  return { cv, w, h };
}

// ---------------------------------------------------------------- the wet street around the puddle
function pavement(V, spot, phase, weather, dpr) {
  const { W, H } = V;
  const cv = document.createElement('canvas'); cv.width = W * dpr; cv.height = H * dpr;
  const x = cv.getContext('2d'); x.scale(dpr, dpr);
  const p = palette(phase, weather), r = seeded(7 + spot * 5);
  const K = SPOTS[spot].key;
  x.fillStyle = p.pave; x.fillRect(0, 0, W, H);
  // cobbles in perspective: small and close-packed far away (top), bigger near your feet
  x.fillStyle = p.line; x.fillRect(0, 0, W, H);
  const big = K === 'square' ? 1.7 : K === 'bridge' ? 1.35 : K === 'bakery' ? 1.15 : 1;
  for (let y = -4; y < H;) {
    const rh = (12 + (y / H) * 34) * big, rw0 = rh * 1.7;
    for (let xx = -r() * rw0; xx < W;) {
      const rw = rw0 * (0.75 + r() * 0.5), v = (r() - 0.5) * 0.16;
      x.fillStyle = mix(p.pave, v > 0 ? '#ffffff' : '#000000', Math.abs(v));
      const g = Math.max(1.6, rh * 0.09);
      x.beginPath(); x.roundRect(xx + g, y + g, rw - g * 2, rh - g * 2, rh * 0.22); x.fill();
      // the wet top edge of each stone catching the light
      if (r() < 0.55) { x.fillStyle = rgba(p.glint, 0.12 + r() * 0.16); x.fillRect(xx + rh * 0.25, y + g + 1, rw - rh * 0.5, Math.max(1, rh * 0.07)); }
      xx += rw;
    }
    y += rh;
  }
  // a few little puddles of light scattered about
  for (let i = 0; i < 9; i++) {
    const gx = r() * W, gy = r() * H, gr = 6 + r() * 18;
    x.fillStyle = rgba(p.glint, 0.12); x.beginPath(); x.ellipse(gx, gy, gr * 1.8, gr * 0.6, 0, 0, TAU); x.fill();
  }
  // props, one per spot, outside the puddle
  const below = V.cy + V.ry * 1.25, above = V.cy - V.ry * 1.25;
  x.lineJoin = 'round';
  if (K === 'lamp') {
    const bx = V.cx - V.rx * 1.12, by = above + 10;
    x.fillStyle = INK.ink; x.beginPath(); x.ellipse(bx, by + 30, 26, 10, 0, 0, TAU); x.fill(); x.fillRect(bx - 12, -10, 24, by + 30);
    x.fillStyle = rgba(p.glint, 0.4); x.fillRect(bx - 7, -10, 4, by + 28);
  } else if (K === 'bakery') {
    x.fillStyle = mix(p.pave, '#8b5b3c', 0.5); x.fillRect(0, 0, W, Math.max(26, above - V.ry * 0.3));
    x.fillStyle = rgba('#000000', 0.25); x.fillRect(0, Math.max(26, above - V.ry * 0.3), W, 8);
    x.strokeStyle = p.line; x.lineWidth = 2; x.strokeRect(-2, -2, W + 4, Math.max(26, above - V.ry * 0.3) + 2);
  } else if (K === 'tram') {
    x.strokeStyle = mix(p.glint, '#cfd6dc', 0.5); x.lineWidth = 5;
    for (const o of [-1, 1]) { x.beginPath(); x.moveTo(-20, H * 0.15 + o * 34); x.lineTo(W + 20, H * 0.15 + 120 + o * 34); x.stroke(); }
    x.strokeStyle = p.line; x.lineWidth = 2;
    for (const o of [-1, 1]) { x.beginPath(); x.moveTo(-20, H * 0.15 + o * 34 + 4); x.lineTo(W + 20, H * 0.15 + 124 + o * 34); x.stroke(); }
  } else if (K === 'cherry') {
    for (let i = 0; i < 70; i++) {
      const px = r() * W, py = r() * H, a = r() * TAU;
      x.save(); x.translate(px, py); x.rotate(a); x.fillStyle = r() < 0.7 ? INK.pink : '#f6dcd6';
      x.beginPath(); x.ellipse(0, 0, 5, 3, 0, 0, TAU); x.fill(); x.restore();
    }
  } else if (K === 'bridge') {
    const ty = Math.max(30, above - V.ry * 0.45);
    x.fillStyle = mix(p.pave, '#c9b89a', 0.35); x.fillRect(0, 0, W, ty);
    x.strokeStyle = p.line; x.lineWidth = 2.5;
    for (let xx = 0; xx < W; xx += 60) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, ty); x.stroke(); }
    x.beginPath(); x.moveTo(0, ty); x.lineTo(W, ty); x.stroke();
    x.fillStyle = rgba('#000000', 0.22); x.fillRect(0, ty, W, 10);
  } else if (K === 'square') {
    const fx = V.cx + V.rx * 1.25, fy = below + 30;
    x.fillStyle = mix(p.pave, '#c9b89a', 0.4); x.beginPath(); x.ellipse(fx, fy, 120, 50, 0, 0, TAU); x.fill();
    x.strokeStyle = p.line; x.lineWidth = 3; x.stroke();
    x.fillStyle = mix(p.zen, p.hor, 0.3); x.beginPath(); x.ellipse(fx, fy + 2, 100, 38, 0, 0, TAU); x.fill(); x.stroke();
  }
  // bokashi: a band of deep indigo printed across the top of the sheet
  const b = x.createLinearGradient(0, 0, 0, H * 0.32);
  b.addColorStop(0, rgba(mix(p.zen, '#000000', 0.35), 0.92)); b.addColorStop(1, rgba(p.zen, 0));
  x.fillStyle = b; x.fillRect(0, 0, W, H * 0.32);
  const b2 = x.createLinearGradient(0, H * 0.7, 0, H);
  b2.addColorStop(0, rgba('#000000', 0)); b2.addColorStop(1, rgba('#000000', 0.35));
  x.fillStyle = b2; x.fillRect(0, H * 0.7, W, H * 0.3);
  laygrain(x, W, H);
  return cv;
}

// ---------------------------------------------------------------- the view
export function makeView(canvas) {
  const ctx = canvas.getContext('2d');
  const V = { W: 0, H: 0, dpr: 1, cx: 0, cy: 0, rx: 0, ry: 0, stripTop: 0, topSafe: 0 };
  let scene = null, prev = null, fade = 1;
  const rings = [], drops = [], splashes = [];
  let ringAcc = 0;

  function layout(W, H, stripTop, topSafe) {
    V.W = W; V.H = H; V.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * V.dpr); canvas.height = Math.round(H * V.dpr);
    V.stripTop = stripTop; V.topSafe = topSafe;
    const top = topSafe + 14, bot = stripTop - 74; // leave room for the reel gauge under the puddle
    const availH = bot - top, ratio = W < availH * 0.8 ? 0.86 : 0.66; // a rounder puddle on a tall phone
    V.rx = Math.min(W * 0.465, availH * 0.5 / ratio / 1.06, 430);
    V.ry = V.rx * ratio;
    V.cx = W / 2; V.cy = (top + bot) / 2;
    scene = null; prev = null;
    drops.length = 0;
  }

  function ensure(g) {
    const ph = phaseOf(g), wx = weatherOf(g), key = g.spot + ':' + ph + ':' + wx;
    if (scene && scene.key === key) return;
    const fresh = { key, spot: g.spot, phase: ph, weather: wx, refl: reflection(V, g.spot, ph, wx, V.dpr), pave: pavement(V, g.spot, ph, wx, V.dpr), p: palette(ph, wx) };
    if (scene && scene.spot === g.spot) { prev = scene; fade = 0; } else { prev = null; fade = 1; }
    scene = fresh;
  }

  const toScreen = (lx, ly) => [V.cx + lx * V.rx, V.cy + ly * V.ry];
  const toLocal = (sx, sy) => [(sx - V.cx) / V.rx, (sy - V.cy) / V.ry];

  function drawScene(S, t, alpha) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(S.pave, 0, 0, V.W, V.H);
    ctx.save();
    puddlePath(ctx, V, S.spot); ctx.clip();
    const R = S.refl, x0 = V.cx - R.w / 2, y0 = V.cy - R.h / 2;
    const amp = S.weather === 1 ? 3.4 : S.weather === 0 ? 1.5 : 0.5, sh = 3, d = V.dpr;
    for (let y = 0; y < R.h; y += sh) {
      const dx = Math.sin(y * 0.09 + t * 2.1) * amp + Math.sin(y * 0.23 - t * 1.4) * amp * 0.5;
      ctx.drawImage(R.cv, 0, y * d, R.w * d, sh * d, x0 + dx, y0 + y, R.w, sh + 0.5);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function frame(g, dt, ui = {}) {
    ensure(g);
    const t = g.time, S = scene, p = S.p;
    ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    if (prev && fade < 1) { fade = Math.min(1, fade + dt / 1.6); drawScene(prev, t, 1); drawScene(S, t, fade); if (fade >= 1) prev = null; }
    else drawScene(S, t, 1);

    // inside the puddle: drifting things, rain rings, the float
    ctx.save();
    puddlePath(ctx, V, S.spot); ctx.clip();
    for (const s of g.shadows) {
      const c = BY_ID[s.id];
      const [sx, sy] = toScreen(s.x, s.y);
      const size = V.rx * 0.5 * c.size * (1 + Math.sin(s.wob * 1.3) * 0.03);
      const busy = s.state === 'nibble' || s.state === 'hooked';
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, s.a)) * (S.weather === 1 ? 0.75 : 1);
      ctx.translate(sx + (busy ? Math.sin(t * 30) * 1.5 : 0), sy);
      ctx.rotate(Math.PI + Math.sin(s.wob * 0.7) * 0.25 + (s.state === 'hooked' ? Math.sin(t * 9) * 0.3 * (g.reel ? g.reel.f : 0) : 0));
      ctx.scale(1, 0.8);
      const gimg = ghost(c, !!c.glow);
      ctx.drawImage(gimg, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    // rain rings on the water
    const rate = S.weather === 1 ? 26 : S.weather === 0 ? 7 : 0.4;
    ringAcc += dt * rate;
    while (ringAcc > 1) {
      ringAcc--;
      const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * 0.95;
      rings.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, t: 0, big: 0.6 + Math.random() * 0.6 });
    }
    ctx.strokeStyle = rgba(mix(p.hor, '#ffffff', 0.55), 1);
    for (let i = rings.length - 1; i >= 0; i--) {
      const R = rings[i]; R.t += dt;
      const life = R.cast ? 1.6 : 0.9;
      if (R.t > life) { rings.splice(i, 1); continue; }
      const k = R.t / life, [sx, sy] = toScreen(R.x, R.y), rad = (R.cast ? 60 : 16) * R.big * (0.15 + k);
      ctx.globalAlpha = (1 - k) * (R.cast ? 0.8 : 0.5);
      ctx.lineWidth = R.cast ? 2 : 1.2;
      ctx.beginPath(); ctx.ellipse(sx, sy, rad, rad * 0.5, 0, 0, TAU); ctx.stroke();
      if (R.cast || R.big > 1) { ctx.beginPath(); ctx.ellipse(sx, sy, rad * 0.55, rad * 0.27, 0, 0, TAU); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // the rim of the puddle: a pale wet edge and the key-block line
    ctx.save();
    ctx.lineJoin = 'round';
    puddlePath(ctx, V, S.spot, 0.012); ctx.strokeStyle = rgba(p.glint, 0.55); ctx.lineWidth = 2; ctx.stroke();
    puddlePath(ctx, V, S.spot, 0.035); ctx.strokeStyle = rgba(INK.ink, 0.85); ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();

    drawRodAndLine(g, t, p);
    if (g.reel) drawGauge(g, p);
    if (ui.aim && !g.line && !g.reel) drawAim(ui.aim, t);
    if (ui.ring) drawRing(ui.ring, t);
    drawRain(S.weather, dt);
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i]; s.t += dt; if (s.t > 0.5) { splashes.splice(i, 1); continue; }
      const [sx, sy] = toScreen(s.x, s.y);
      ctx.fillStyle = rgba('#e8eef2', 1 - s.t * 2);
      for (let k = 0; k < 7; k++) { const a = -Math.PI * (0.1 + 0.8 * k / 6), d = 6 + s.t * 70; ctx.beginPath(); ctx.arc(sx + Math.cos(a) * d, sy + Math.sin(a) * d * 0.7 + s.t * s.t * 120, 2.2, 0, TAU); ctx.fill(); }
    }
  }

  function rodTip(g) {
    const T = g.reel ? g.reel.T : 0;
    const bx = Math.min(V.W - 6, V.cx + V.rx * 1.05), by = V.stripTop + 6;
    const tx = V.cx + V.rx * 0.5 - T * 18, ty = V.cy + V.ry * 1.18 + T * 10;
    return { bx, by, tx, ty };
  }

  function drawRodAndLine(g, t, p) {
    const L = g.line, { bx, by, tx, ty } = rodTip(g);
    // the line
    if (L) {
      let lx, ly;
      if (L.state === 'fly') {
        const k = Math.min(1, L.t / 0.42), [ex, ey] = toScreen(L.x, L.y);
        lx = tx + (ex - tx) * k; ly = ty + (ey - ty) * k - Math.sin(k * Math.PI) * 90;
      } else {
        [lx, ly] = toScreen(L.x, L.y);
        ly += Math.sin(t * 2.2) * 1.2 + L.twitch * Math.sin(t * 50) * 3 + L.dip * 7;
      }
      const T = g.reel ? g.reel.T : 0, danger = T > 0.8;
      const sag = g.reel ? (1 - T) * 46 : 38;
      const shake = danger ? Math.sin(t * 70) * 2 : 0;
      ctx.strokeStyle = danger ? INK.verm : rgba('#efe6d0', 0.75); ctx.lineWidth = danger ? 1.8 : 1.2;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo((tx + lx) / 2 + shake, Math.max(ty, ly) + sag * 0.5 + shake, lx, ly); ctx.stroke();
      // the float
      const sub = L.state === 'bite' || L.state === 'reel' ? 0.75 : L.dip * 0.75;
      ctx.save(); ctx.translate(lx, ly);
      if (L.state !== 'fly') {
        ctx.strokeStyle = rgba('#ffffff', 0.35); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 4, 13, 5, 0, 0, TAU); ctx.stroke();
      }
      ctx.beginPath(); ctx.rect(-12, -20, 24, 24 - sub * 10); ctx.clip();
      ctx.fillStyle = INK.white; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI); ctx.fill();
      ctx.fillStyle = INK.red; ctx.beginPath(); ctx.arc(0, 0, 7, Math.PI, TAU); ctx.fill();
      ctx.strokeStyle = INK.ink; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, -15); ctx.stroke();
      ctx.restore();
      if (L.state === 'bite') {
        const k = (t * 3) % 1;
        ctx.strokeStyle = rgba('#ffffff', 0.7 * (1 - k)); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(lx, ly + 4, 14 + k * 30, (14 + k * 30) * 0.45, 0, 0, TAU); ctx.stroke();
      }
    }
    // the rod: a length of bamboo, nodes and all
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(bx + 30, by + 30); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = '#b8955a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(bx + 30, by + 30); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 2;
    for (let k = 0.15; k < 1; k += 0.2) {
      const nx = tx + (bx + 30 - tx) * k, ny = ty + (by + 30 - ty) * k, ang = Math.atan2(by - ty, bx - tx) + Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(nx - Math.cos(ang) * 4, ny - Math.sin(ang) * 4); ctx.lineTo(nx + Math.cos(ang) * 4, ny + Math.sin(ang) * 4); ctx.stroke();
    }
    ctx.restore();
  }

  function drawGauge(g, p) {
    const R = g.reel, w = Math.min(V.rx * 1.3, 320), h = 14;
    const x0 = V.cx - w / 2, y0 = Math.min(V.cy + V.ry * 1.1 + 18, V.stripTop - 40);
    ctx.save();
    ctx.fillStyle = INK.paper; ctx.fillRect(x0 - 4, y0 - 4, w + 8, h + 8);
    ctx.fillStyle = mix(INK.paper, INK.indigo, 0.12); ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = rgba(INK.red, 0.85); ctx.fillRect(x0 + w * 0.8, y0, w * 0.2, h);
    ctx.fillStyle = INK.indigo; ctx.fillRect(x0, y0, w * Math.min(1, R.T), h);
    ctx.strokeStyle = INK.ink; ctx.lineWidth = 2; ctx.strokeRect(x0 - 4, y0 - 4, w + 8, h + 8);
    // landing progress as a row of little marks under the bar
    const n = 12;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i / n < R.P ? INK.red : rgba(INK.paper, 0.35);
      ctx.fillRect(x0 + i * (w / n) + 2, y0 + h + 9, w / n - 4, 4);
    }
    ctx.restore();
  }

  function drawAim(a, t) {
    const [sx, sy] = toScreen(a[0], a[1]);
    ctx.save(); ctx.strokeStyle = rgba('#f4ecd8', 0.5); ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]); ctx.lineDashOffset = -t * 10;
    ctx.beginPath(); ctx.ellipse(sx, sy, 16, 8, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
  function drawRing(r, t) {
    const [sx, sy] = toScreen(r[0], r[1]), k = (t * 1.2) % 1, rad = r[2] || 50;
    ctx.save(); ctx.strokeStyle = rgba(INK.verm, 0.9 * (1 - k)); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(sx, sy, rad * (0.7 + k * 0.6), rad * 0.6 * (0.7 + k * 0.6), 0, 0, TAU); ctx.stroke(); ctx.restore();
  }

  function drawRain(weather, dt) {
    const want = weather === 1 ? 230 : weather === 0 ? 80 : 0;
    while (drops.length < want) drops.push({ x: Math.random() * (V.W + 200), y: Math.random() * V.H, l: 30 + Math.random() * 90, v: 900 + Math.random() * 500 });
    if (drops.length > want) drops.length = want;
    const sx = -0.16;
    ctx.save();
    ctx.strokeStyle = rgba('#dfe6ea', weather === 1 ? 0.32 : 0.26); ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of drops) {
      d.y += d.v * dt; d.x += d.v * sx * dt;
      if (d.y - d.l > V.H || d.x < -40) { d.y = -Math.random() * 100; d.x = Math.random() * (V.W + 200); }
      ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * sx, d.y - d.l);
    }
    ctx.stroke(); ctx.restore();
  }

  return {
    V, layout, frame, toLocal, toScreen,
    plop(x, y, big = 1) { rings.push({ x, y, t: 0, big, cast: true }); },
    splash(x, y) { splashes.push({ x, y, t: 0 }); rings.push({ x, y, t: 0, big: 1.4, cast: true }); },
    inPuddle(sx, sy, spot) { const [lx, ly] = toLocal(sx, sy); const a = Math.atan2(ly, lx); return Math.hypot(lx, ly) <= edgeR(spot, a) * 0.98; },
    reset() { scene = null; prev = null; rings.length = 0; },
  };
}
