// Card faces, painted on a canvas: a 500 × 700 card, printed like a tarot card.
//
//   ┌──────────────────┐  the angel's half: Grace cost, name, upright text (gold and ivory)
//   │(1) SMITE          │
//   │  Deal 6 damage.   │
//   │ ┌──────────────┐ │  the art: an emblem standing in a gold heaven…
//   │ │   heaven      │ │
//   │ │───────────────│ │  …and its reflection standing in hell, upside down
//   │ │   hell        │ │
//   │ └──────────────┘ │
//   │   .ɹoɟ noʎ sʇᴉH   │  the demon's half: printed upside down, so a demon holding the card
//   │           ƎʇIdS(☠)│  turned round reads it the right way up
//   └──────────────────┘
//
// Faces are cached by everything that changes them (the card, Blessing, and any numbers changed by Might etc.).
import { def, uprightText, reversedText, CARDS } from './cards.js';
import { drawGlyph } from './art.js';

export const CW = 500, CH = 700;
const R = 30;                       // corner radius
const BAN = [16, 70];               // name banner (and the demon's, turned round)
const TXT_A = [76, 222], TXT_D = [516 - 0, 624];
const ART = { x: 26, y: 228, w: 448, h: 282 };
const HZ = ART.y + ART.h / 2;       // the horizon
export const FONT_T = '"IM Fell English SC", "IM Fell English", Georgia, serif';
export const FONT_B = '"Alegreya Sans", "Gill Sans", "Segoe UI", system-ui, sans-serif';
const TAU = Math.PI * 2;

/* ---------- palettes ---------- */
// The angel's half is printed on ivory (tinted by rarity), the demon's on black; rules and type in ink or ember.
const FRAMES = {
  starter: { paper: '#ece2cb', rule: '#5c4a34', ink: '#1e160e', kw: '#7a4a12' },
  common: { paper: '#efe3c4', rule: '#7a5a28', ink: '#1e150a', kw: '#8a4c0c' },
  uncommon: { paper: '#e4e9ea', rule: '#3c5d7a', ink: '#0f1a26', kw: '#2a5a86' },
  rare: { paper: '#f1dfa8', rule: '#8a6014', ink: '#2a1a02', kw: '#8a4a00', gilt: true },
  infernal: { paper: '#2a1816', rule: '#c8582c', ink: '#f6dcc4', kw: '#ffa66a', dark: true },
  curse: { paper: '#28202f', rule: '#9b7fc4', ink: '#efe6ff', kw: '#c8b0f0', dark: true },
  status: { paper: '#cbc5bc', rule: '#4a4642', ink: '#191716', kw: '#3a3634' },
  special: { paper: '#cbc5bc', rule: '#4a4642', ink: '#191716', kw: '#3a3634' },
};
const HELL = { paper: '#140c0c', rule: '#b8482a', ink: '#f6d8c4', kw: '#ff9a5c' };
// the sky behind the emblem, by card type: top, middle, the horizon
const SKY = {
  attack: ['#3a2442', '#d08a5c', '#fff0d2'],
  skill: ['#1e3456', '#7aa6c4', '#f0f6f4'],
  power: ['#2c2048', '#a487c4', '#fbeef6'],
  infernal: ['#140406', '#5a1410', '#e0582c'],
  curse: ['#120c1c', '#3e2e58', '#a090c4'],
  status: ['#1c1a1a', '#5a5654', '#d0cac2'],
};
const frameOf = d => FRAMES[d.rarity === 'infernal' ? 'infernal' : d.type === 'curse' ? 'curse' : d.type === 'status' ? 'status' : d.rarity] ?? FRAMES.common;
const skyOf = d => d.rarity === 'infernal' ? SKY.infernal : d.type === 'curse' ? SKY.curse : d.type === 'status' ? SKY.status : SKY[d.type] ?? SKY.skill;
const rgbaHex = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };
let GRAIN = null;
function grain(g, x, y, w, h, a) {
  if (!GRAIN) { const c = document.createElement('canvas'); c.width = c.height = 96; const gg = c.getContext('2d'), im = gg.createImageData(96, 96); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } gg.putImageData(im, 0, 0); GRAIN = c; }
  g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'overlay'; g.fillStyle = g.createPattern(GRAIN, 'repeat'); g.fillRect(x, y, w, h); g.restore();
}

/* ---------- helpers ---------- */
const lin = (g, x0, y0, x1, y1, cols) => { const gr = g.createLinearGradient(x0, y0, x1, y1); cols.forEach((c, i) => gr.addColorStop(Array.isArray(c) ? c[0] : i / (cols.length - 1), Array.isArray(c) ? c[1] : c)); return gr; };
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
function artShape(g, type, x, y, w, h) {
  g.beginPath();
  if (type === 'attack') {
    const c = 22;
    g.moveTo(x + c, y); g.lineTo(x + w - c, y); g.lineTo(x + w, y + c); g.lineTo(x + w, y + h - c); g.lineTo(x + w - c, y + h); g.lineTo(x + c, y + h); g.lineTo(x, y + h - c); g.lineTo(x, y + c); g.closePath();
  } else if (type === 'power') {
    const r = 46;
    g.moveTo(x, y + r); g.quadraticCurveTo(x, y, x + w / 2, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w / 2, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.closePath();
  } else g.roundRect(x, y, w, h, 14);
}
function fitFont(g, text, weight, size, family, maxW, min = size * .6) {
  let s = size;
  for (; s > min; s -= 1) { g.font = `${weight} ${s}px ${family}`; if (g.measureText(text).width <= maxW) break; }
  return s;
}

/* ---------- rich text: [n] numbers, [n+] raised, [n-] lowered, *Keyword* ---------- */
function tokens(text) {
  const out = [];
  const re = /\[(\d+)([+-]?)\]|\*([^*]+)\*|(\S+)|(\s+)/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[1] != null) out.push({ t: m[1], k: m[2] === '+' ? 'up' : m[2] === '-' ? 'down' : 'num' });
    else if (m[3] != null) for (const [i, w] of m[3].split(' ').entries()) { if (i) out.push({ t: ' ', k: 'sp' }); out.push({ t: w, k: 'kw' }); }
    else if (m[4] != null) out.push({ t: m[4], k: 'w' });
    else out.push({ t: ' ', k: 'sp' });
  }
  // glue punctuation to the word before it so lines never start with "."
  const glued = [];
  for (const t of out) {
    const last = glued[glued.length - 1];
    if (last && t.k !== 'sp' && last.k !== 'sp') { last.parts = (last.parts ?? [{ t: last.t, k: last.k }]).concat([{ t: t.t, k: t.k }]); last.t += t.t; continue; }
    glued.push({ ...t });
  }
  return glued;
}
const fontFor = (k, size) => `${k === 'w' || k === 'sp' ? 600 : 800} ${size}px ${FONT_B}`;
function measure(g, tok, size) {
  if (tok.parts) return tok.parts.reduce((s, p) => s + measure(g, p, size), 0);
  g.font = fontFor(tok.k, size); return g.measureText(tok.t).width;
}
function layout(g, text, size, maxW) {
  const toks = tokens(text), lines = [[]], widths = [0];
  const space = (g.font = fontFor('w', size), g.measureText(' ').width);
  for (const t of toks) {
    if (t.k === 'sp') continue;
    const w = measure(g, t, size), L = lines.length - 1;
    const add = (lines[L].length ? space : 0) + w;
    if (widths[L] + add > maxW && lines[L].length) { lines.push([t]); widths.push(w); }
    else { lines[L].push(t); widths[L] += add; }
  }
  return { lines, widths, space };
}
// Draw wrapped, centred rich text in a box, shrinking it to fit.
export function richText(g, text, box, o) {
  let size = o.size, L;
  for (; size >= o.min; size -= 1) {
    L = layout(g, text, size, box.w);
    if (L.lines.length * size * o.lh <= box.h) break;
  }
  const lh = size * o.lh, total = L.lines.length * lh;
  let y = box.y + (box.h - total) / 2 + size * .82;
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  L.lines.forEach((line, i) => {
    let x = box.x + (box.w - L.widths[i]) / 2;
    for (const t of line) {
      for (const p of t.parts ?? [t]) {
        g.font = fontFor(p.k, size);
        g.fillStyle = p.k === 'kw' ? o.kw : p.k === 'up' ? o.up : p.k === 'down' ? o.down : p.k === 'num' ? o.num : o.ink;
        g.fillText(p.t, x, y);
        x += g.measureText(p.t).width;
      }
      x += L.space;
    }
    y += lh;
  });
}

/* ---------- the painter ---------- */
const CACHE = new Map();
let cacheTick = 0;
export function faceKey(card, o = {}) {
  const d = def(card);
  return `${card.id}${card.plus ? '+' : ''}|${o.upText ?? ''}|${o.downText ?? ''}|${card.freeThisTurn ? 'f' : ''}|${o.cost ?? ''}`;
}
// o.mods: the angel's damage maths for the upright numbers; o.dmods: the holder's for the reversed ones
export function paintFace(card, o = {}) {
  const upText = uprightText(card, o.mods);
  const downText = reversedText(card, o.dmods);
  const key = faceKey(card, { upText, downText, cost: o.cost });
  let e = CACHE.get(key);
  if (e) { e.t = ++cacheTick; return e.canvas; }
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const g = c.getContext('2d');
  drawCard(g, card, upText, downText, o);
  CACHE.set(key, { canvas: c, t: ++cacheTick });
  if (CACHE.size > 90) {
    const old = [...CACHE.entries()].sort((a, b) => a[1].t - b[1].t).slice(0, 20);
    for (const [k] of old) CACHE.delete(k);
  }
  return c;
}

function drawCard(g, card, upText, downText, o) {
  const d = def(card), F = frameOf(d);
  rr(g, 0, 0, CW, CH, R); g.save(); g.clip();
  // ivory above the horizon, black below
  g.fillStyle = F.paper; g.fillRect(0, 0, CW, HZ);
  g.fillStyle = HELL.paper; g.fillRect(0, HZ, CW, CH - HZ);
  grain(g, 0, 0, CW, CH, .1);
  // rules round each half: a heavy one and a fine one inside it
  const rule = (y0, y1, col, gilt) => {
    g.strokeStyle = col; g.lineWidth = gilt ? 5 : 2.5; g.strokeRect(12, y0 + 12, CW - 24, y1 - y0 - 24);
    g.lineWidth = 1.2; g.strokeRect(19, y0 + 19, CW - 38, y1 - y0 - 38);
  };
  g.save(); g.beginPath(); g.rect(0, 0, CW, HZ); g.clip(); rule(0, CH, F.gilt ? '#b88a2c' : F.rule, F.gilt); g.restore();
  g.save(); g.beginPath(); g.rect(0, HZ, CW, CH - HZ); g.clip(); rule(0, CH, HELL.rule, false); g.restore();
  drawArt(g, d);
  drawHalf(g, d, upText, F, false, o);
  g.save(); g.translate(CW, CH); g.rotate(Math.PI);
  drawHalf(g, d, downText, HELL, true, o);
  g.restore();
  plaque(g, d, F);
  g.restore();
  rr(g, 1, 1, CW - 2, CH - 2, R - 1); g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,.7)'; g.stroke();
}

function drawHalf(g, d, text, F, demon, o) {
  const [b0, b1] = BAN, bx = 92, bw = CW - bx - 26;
  // the name, between two rules
  g.strokeStyle = F.rule; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(bx, b1 + 2); g.lineTo(bx + bw, b1 + 2); g.stroke();
  g.beginPath(); g.moveTo(bx + 30, b1 + 6); g.lineTo(bx + bw - 30, b1 + 6); g.stroke();
  const title = demon ? d.rtitle : d.title;
  g.fillStyle = F.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  fitFont(g, title, 400, 42, FONT_T, bw - 10);
  g.fillText(title, bx + bw / 2, (b0 + b1) / 2 + 6);
  const [t0, t1] = demon ? [CH - TXT_D[1], CH - TXT_D[0]] : TXT_A;
  const px = 34, pw = CW - 68;
  const box = { x: px + 10, y: t0 + 6, w: pw - 20, h: t1 - t0 - 12 };
  if (demon) {
    if (!text) text = 'Nothing happens.';
    richText(g, text, box, { size: 34, min: 18, lh: 1.14, ink: HELL.ink, kw: HELL.kw, num: '#ffffff', up: '#ff7a64', down: '#a8eab0' });
  } else if (text) {
    const dk = !!F.dark;
    richText(g, text, box, { size: 35, min: 18, lh: 1.14, ink: F.ink, kw: F.kw, num: dk ? '#ffffff' : '#000000', up: dk ? '#a8eab0' : '#1f6a2a', down: dk ? '#ff8f80' : '#a8241c' });
  }
  if (demon) orbDemon(g, 54, 46);
  else if (!d.unplayable) orbCost(g, 54, 46, d, o);
}
// the cost: an ivory sun ringed with gilt rays (an ember one for infernal cards)
function orbCost(g, x, y, d, o) {
  const cost = o.cost ?? d.cost, inf = d.rarity === 'infernal';
  g.save();
  g.fillStyle = inf ? '#e0703c' : '#b88a2c';
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.beginPath(); g.moveTo(x + Math.cos(a - .1) * 30, y + Math.sin(a - .1) * 30); g.lineTo(x + Math.cos(a) * 42, y + Math.sin(a) * 42); g.lineTo(x + Math.cos(a + .1) * 30, y + Math.sin(a + .1) * 30); g.fill(); }
  g.beginPath(); g.arc(x, y, 31, 0, TAU); g.fillStyle = '#141010'; g.fill();
  g.beginPath(); g.arc(x, y, 28, 0, TAU); g.fillStyle = inf ? '#3a1410' : '#f6eedb'; g.fill();
  const txt = cost < 0 ? 'X' : String(cost);
  g.font = `800 40px ${FONT_B}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = o.cost != null && o.cost < d.cost ? '#1f7a2c' : inf ? '#ffd8c0' : '#141010'; g.fillText(txt, x, y + 2);
  g.restore();
}
function orbDemon(g, x, y) {
  g.save();
  g.beginPath(); g.arc(x, y, 31, 0, TAU); g.fillStyle = '#000'; g.fill();
  g.lineWidth = 2; g.strokeStyle = HELL.rule; g.stroke();
  g.restore();
  drawGlyph(g, 'horned', x - 22, y - 23, 44, { body: '#e8643a', outline: '#000000', hole: '#000000', detail: '#000000' });
}
function plaque(g, d, F) {
  const label = (d.holy ? 'Holy ' : '') + ({ attack: 'Attack', skill: 'Skill', power: 'Power', curse: 'Curse', status: 'Status' }[d.type] ?? '') + (d.rarity === 'infernal' ? ' · Infernal' : '');
  g.font = `400 21px ${FONT_T}`;
  g.letterSpacing = '2px';
  const w = g.measureText(label).width + 36, x = CW / 2 - w / 2, y = ART.y - 14;
  g.save();
  g.fillStyle = '#141010'; g.fillRect(x, y, w, 28);
  g.strokeStyle = F.gilt ? '#d9b66a' : 'rgba(241,231,208,.55)'; g.lineWidth = 1; g.strokeRect(x + 3, y + 3, w - 6, 22);
  g.fillStyle = d.holy ? '#ead08e' : '#f1e7d0'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, CW / 2 + 1, y + 15);
  g.restore();
  g.letterSpacing = '0px';
}

/* ---------- the picture: an ivory emblem in a dawn sky, its black shadow standing in hellfire ---------- */
function drawArt(g, d) {
  const { x, y, w, h } = ART, sky = skyOf(d);
  const seed = [...d.id].reduce((s, c) => s * 31 + c.charCodeAt(0) >>> 0, 7);
  const rnd = i => { const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };
  g.save();
  artShape(g, d.type, x, y, w, h); g.save(); g.clip();
  // heaven
  g.fillStyle = lin(g, 0, y, 0, HZ, [sky[0], [.55, sky[1]], [1, sky[2]]]); g.fillRect(x, y, w, HZ - y);
  // flat rays from the horizon
  g.fillStyle = 'rgba(255,250,235,.12)';
  for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * .3; g.beginPath(); g.moveTo(CW / 2, HZ); g.lineTo(CW / 2 + Math.cos(a - .06) * 420, HZ + Math.sin(a - .06) * 420); g.lineTo(CW / 2 + Math.cos(a + .06) * 420, HZ + Math.sin(a + .06) * 420); g.fill(); }
  // paper clouds: two long flat bands, scalloped along the top
  const dim = d.rarity === 'infernal' || d.type === 'curse';
  for (const [cy, a, n] of [[HZ - 64, .2, 5], [HZ - 20, .42, 7]]) {
    g.fillStyle = dim ? `rgba(20,8,12,${a})` : `rgba(255,252,244,${a})`; g.beginPath();
    for (let i = 0; i < n; i++) { const cx = x + (i + rnd(i + cy)) / n * w, r = 12 + rnd(i * 3 + cy) * 14; g.moveTo(cx + r * 2.4, cy); g.ellipse(cx, cy, r * 2.4, r, 0, 0, TAU); }
    g.fill(); g.fillRect(x, cy, w, HZ - cy);
  }
  // hell: the fire's glow at the horizon sinking into black
  g.fillStyle = lin(g, 0, HZ, 0, y + h, [[0, '#ffc070'], [.1, '#e0582c'], [.45, '#5a0e0a'], [1, '#100303']]); g.fillRect(x, HZ, w, y + h - HZ);
  g.fillStyle = '#0c0303';
  g.beginPath(); g.moveTo(x, y + h);
  for (let i = 0; i <= 12; i++) { const px = x + i / 12 * w, tall = (i === 0 || i === 12 ? .1 : .22 + rnd(i + 60) * .42) * (y + h - HZ); g.lineTo(px - 11, y + h); g.lineTo(px + (rnd(i + 90) - .5) * 8, y + h - tall); g.lineTo(px + 11, y + h); }
  g.lineTo(x + w, y + h); g.closePath(); g.fill();
  // the emblem, standing on the horizon, cut from ivory…
  const S = 150, gx = CW / 2 - S / 2, gy = HZ - S + 4;
  const infernal = d.rarity === 'infernal';
  const heavenly = infernal ? { body: '#140606', outline: '#ff7a3a', accent: '#3a0e08', detail: '#ff8a4a', hole: '#000000', glow: 'rgba(255,90,40,.7)', glowBlur: 8 }
    : d.type === 'curse' ? { body: '#d8ccf0', outline: '#1e1428', accent: '#f4eaff', detail: '#3a2c54', hole: '#1e1428', glow: 'rgba(0,0,0,.35)', glowBlur: 6 }
    : d.type === 'status' ? { body: '#ebe6de', outline: '#1c1a18', accent: '#ffffff', detail: '#4a4744', hole: '#1c1a18', glow: 'rgba(0,0,0,.35)', glowBlur: 6 }
    : { body: '#f8f1de', outline: '#2a1d0e', accent: '#ffffff', detail: '#7a5420', hole: '#2a1d0e', glow: 'rgba(60,30,0,.35)', glowBlur: 6 };
  drawGlyph(g, d.glyph, gx, gy, S, heavenly);
  // …and its shadow in hell, black paper rimmed with fire
  g.save(); g.translate(0, HZ * 2); g.scale(1, -1);
  drawGlyph(g, d.glyph, gx, gy, S, { body: '#0c0303', outline: '#ff7a3a', accent: '#200606', detail: '#ff6a2a', hole: '#000000', glow: 'rgba(255,80,30,.75)', glowBlur: 8 });
  g.restore();
  g.fillStyle = 'rgba(255,246,226,.95)'; g.fillRect(x, HZ - 1, w, 2);
  g.restore();
  // its frame: an ink line, a gilt one inside
  artShape(g, d.type, x, y, w, h);
  g.lineWidth = 5; g.strokeStyle = '#141010'; g.stroke();
  artShape(g, d.type, x + 5, y + 5, w - 10, h - 10);
  g.lineWidth = 1.2; g.strokeStyle = 'rgba(234,208,142,.75)'; g.stroke();
  g.restore();
}

/* ---------- the back every card shares: a sun above, its black twin below ---------- */
let BACK = null;
export function paintBack() {
  if (BACK) return BACK;
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const g = c.getContext('2d');
  rr(g, 0, 0, CW, CH, R); g.save(); g.clip();
  g.fillStyle = '#120d0d'; g.fillRect(0, 0, CW, CH);
  grain(g, 0, 0, CW, CH, .12);
  // a lattice of small diamonds
  g.fillStyle = 'rgba(202,164,92,.16)';
  for (let y = 40; y < CH - 20; y += 30) for (let x = (Math.round(y / 30) % 2) * 15 + 30; x < CW - 20; x += 30) { g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x + 3, y); g.lineTo(x, y + 3); g.lineTo(x - 3, y); g.fill(); }
  g.strokeStyle = '#caa45c'; g.lineWidth = 3; g.strokeRect(16, 16, CW - 32, CH - 32);
  g.lineWidth = 1.2; g.strokeRect(24, 24, CW - 48, CH - 48);
  // the medallion: a gilt sun, and below it, turned round, a black one burning
  const mx = CW / 2, my = CH / 2, mr = 120;
  g.beginPath(); g.arc(mx, my, mr + 30, 0, TAU); g.fillStyle = '#120d0d'; g.fill();
  g.lineWidth = 1.2; g.strokeStyle = 'rgba(202,164,92,.7)'; g.stroke();
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * TAU, up = Math.sin(a) < 0, long = i % 2 ? 1 : .8;
    g.fillStyle = up ? '#caa45c' : '#d8582c';
    g.beginPath(); g.moveTo(mx + Math.cos(a - .06) * (mr * .62), my + Math.sin(a - .06) * (mr * .62)); g.lineTo(mx + Math.cos(a) * (mr + 22) * long, my + Math.sin(a) * (mr + 22) * long); g.lineTo(mx + Math.cos(a + .06) * (mr * .62), my + Math.sin(a + .06) * (mr * .62)); g.fill();
  }
  g.save(); g.beginPath(); g.arc(mx, my, mr * .62, Math.PI, 0); g.closePath(); g.fillStyle = '#f1e7d0'; g.fill(); g.restore();
  g.save(); g.beginPath(); g.arc(mx, my, mr * .62, 0, Math.PI); g.closePath(); g.fillStyle = '#000'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#d8582c'; g.stroke(); g.restore();
  g.fillStyle = '#f1e7d0'; g.fillRect(mx - mr - 26, my - 1, (mr + 26) * 2, 2);
  drawGlyph(g, 'feather', mx - 30, my - 66, 60, { body: '#141010', outline: '#141010', detail: '#f1e7d0' });
  g.save(); g.translate(mx, my + 36); g.rotate(Math.PI);
  drawGlyph(g, 'flame', -30, -30, 60, { body: '#e0582c', outline: '#000', accent: '#ffb070' });
  g.restore();
  g.fillStyle = '#caa45c'; g.font = `400 36px ${FONT_T}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.letterSpacing = '8px';
  g.fillText('Harrowing', mx + 4, 88);
  g.save(); g.translate(mx, CH - 88); g.rotate(Math.PI); g.fillText('Harrowing', 4, 0); g.restore();
  g.letterSpacing = '0px';
  g.restore();
  rr(g, 1, 1, CW - 2, CH - 2, R - 1); g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,.7)'; g.stroke();
  return (BACK = c);
}

// A small foil mask for the card shader: red where the holo goes (rare cards' art and banners), green on the frame.
export function paintMask(card) {
  const d = def(card);
  const c = document.createElement('canvas'); c.width = CW / 4; c.height = CH / 4;
  const g = c.getContext('2d'); g.scale(.25, .25);
  g.fillStyle = '#000'; g.fillRect(0, 0, CW, CH);
  g.fillStyle = '#00ff00'; g.fillRect(0, 0, CW, HZ);
  g.fillStyle = '#000'; g.fillRect(26, TXT_A[0], CW - 52, TXT_A[1] - TXT_A[0]); g.fillRect(26, CH - TXT_D[1], CW - 52, TXT_D[1] - TXT_D[0]);
  if (d.rarity === 'rare') {
    g.fillStyle = '#ff0000'; artShape(g, d.type, ART.x, ART.y, ART.w, HZ - ART.y); g.fill();
    g.fillRect(80, BAN[0], CW - 100, BAN[1] - BAN[0]);
  }
  return c;
}
export const isRare = card => def(card).rarity === 'rare';
