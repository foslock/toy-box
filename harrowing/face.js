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
export const FONT_T = '"Cinzel", "Trajan Pro", Georgia, serif';
export const FONT_B = '"Alegreya Sans", "Gill Sans", "Segoe UI", system-ui, sans-serif';
const TAU = Math.PI * 2;

/* ---------- palettes ---------- */
const FRAMES = {
  starter: { top: ['#efe6d2', '#cbbb98', '#a8946c'], ban: ['#fbf3df', '#e4d3ac'], ink: '#2a1d0e', trim: '#8a6d3b', text: ['#fbf5e6', '#efe2c4'] },
  common: { top: ['#f4e7c8', '#d6b77a', '#a8823e'], ban: ['#fdf4dc', '#ead39c'], ink: '#2a1a08', trim: '#9a7432', text: ['#fdf7e8', '#f1e1bd'] },
  uncommon: { top: ['#eef4fb', '#b7c8dc', '#7d93ad'], ban: ['#f6fbff', '#cfdeee'], ink: '#14202e', trim: '#5f7a98', text: ['#fbfdff', '#e3ecf5'] },
  rare: { top: ['#fff6cf', '#f2c64e', '#c08a1c'], ban: ['#fff8d8', '#f6d779'], ink: '#3a2400', trim: '#b07a12', text: ['#fffbea', '#f8ebc4'] },
  infernal: { top: ['#5b4a52', '#33262c', '#1b1216'], ban: ['#6e5442', '#4a3324'], ink: '#f6dcc4', trim: '#d0582c', text: ['#4a3a34', '#33261f'], dark: true },
  curse: { top: ['#5a4a6e', '#3a2c4c', '#1e1428'], ban: ['#77668e', '#4e4064'], ink: '#f1e8ff', trim: '#9b7fc4', text: ['#3e3350', '#2c2238'], dark: true },
  status: { top: ['#8a8784', '#5e5b58', '#3a3836'], ban: ['#a19d98', '#77736e'], ink: '#191716', trim: '#4a4744', text: ['#d4d0ca', '#b9b4ad'] },
  special: { top: ['#8a8784', '#5e5b58', '#3a3836'], ban: ['#a19d98', '#77736e'], ink: '#191716', trim: '#4a4744', text: ['#d4d0ca', '#b9b4ad'] },
};
const HELL = { frame: ['#2a0a0c', '#4a1012', '#140405'], ban: ['#4a1416', '#260709'], ink: '#ffd9c2', trim: '#c4471f', text: ['#2c0c0e', '#180506'] };
// the sky behind the emblem, by card type
const SKY = {
  attack: ['#2a2457', '#b45a3c', '#ffd98a'],
  skill: ['#16305a', '#3f86b5', '#cdf0ff'],
  power: ['#2a1650', '#8b5cc8', '#ffe1f3'],
  infernal: ['#1a0608', '#5a1410', '#e0572c'],
  curse: ['#120c1c', '#3e2e58', '#9d88c0'],
  status: ['#1c1a1a', '#4a4644', '#a8a29c'],
};
const frameOf = d => FRAMES[d.rarity === 'infernal' ? 'infernal' : d.type === 'curse' ? 'curse' : d.type === 'status' ? 'status' : d.rarity] ?? FRAMES.common;
const skyOf = d => d.rarity === 'infernal' ? SKY.infernal : d.type === 'curse' ? SKY.curse : d.type === 'status' ? SKY.status : SKY[d.type] ?? SKY.skill;

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
  const d = def(card), F = frameOf(d), dark = !!F.dark;
  // the whole card, clipped to its rounded outline
  rr(g, 0, 0, CW, CH, R); g.save(); g.clip();
  // frame: heaven's metal above the horizon, hell's below
  g.fillStyle = lin(g, 0, 0, 0, HZ, [F.top[0], F.top[1], F.top[2]]); g.fillRect(0, 0, CW, HZ);
  g.fillStyle = lin(g, 0, HZ, 0, CH, [HELL.frame[1], HELL.frame[0], HELL.frame[2]]); g.fillRect(0, HZ, CW, CH - HZ);
  // a fine engraved lattice on both halves
  g.save(); g.globalAlpha = .07; g.strokeStyle = dark ? '#fff' : '#000'; g.lineWidth = 1.5;
  for (let x = -CH; x < CW; x += 18) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + HZ, HZ); g.stroke(); g.beginPath(); g.moveTo(x + HZ, 0); g.lineTo(x, HZ); g.stroke(); }
  g.strokeStyle = '#ff6a3a'; g.globalAlpha = .06;
  for (let x = -CH; x < CW; x += 18) { g.beginPath(); g.moveTo(x, HZ); g.lineTo(x + CH - HZ, CH); g.stroke(); g.beginPath(); g.moveTo(x + CH - HZ, HZ); g.lineTo(x, CH); g.stroke(); }
  g.restore();
  // inner edge
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; rr(g, 7, 7, CW - 14, CH - 14, R - 6); g.stroke();
  g.strokeStyle = dark ? 'rgba(255,190,140,.25)' : 'rgba(255,255,255,.5)'; g.lineWidth = 1.5; rr(g, 9.5, 9.5, CW - 19, CH - 19, R - 8); g.stroke();

  drawArt(g, d);
  // the angel's half
  drawHalf(g, d, upText, F, false, o);
  // the demon's half, turned round
  g.save(); g.translate(CW, CH); g.rotate(Math.PI);
  drawHalf(g, d, downText, HELL, true, o);
  g.restore();
  // the type plaque on the art's top edge
  plaque(g, d, F);
  g.restore();
  // outer rim
  rr(g, 1.5, 1.5, CW - 3, CH - 3, R - 1); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.55)'; g.stroke();
}

function drawHalf(g, d, text, F, demon, o) {
  // name banner
  const [b0, b1] = BAN, bx = 92, bw = CW - bx - 20;
  g.save();
  g.beginPath();
  g.moveTo(bx - 10, b0 + 4); g.lineTo(bx + bw - 14, b0 + 4); g.quadraticCurveTo(bx + bw + 6, (b0 + b1) / 2, bx + bw - 14, b1 - 4); g.lineTo(bx - 10, b1 - 4); g.closePath();
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 8; g.shadowOffsetY = 2;
  g.fillStyle = lin(g, 0, b0, 0, b1, demon ? HELL.ban : F.ban); g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = 2.5; g.strokeStyle = demon ? HELL.trim : F.trim; g.stroke();
  g.restore();
  const title = demon ? d.rtitle : d.title;
  g.fillStyle = demon ? HELL.ink : F.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  fitFont(g, title, 700, 33, FONT_T, bw - 24);
  g.fillText(title, bx + (bw - 14) / 2 + 2, (b0 + b1) / 2 + 2);
  // text panel
  const [t0, t1] = demon ? [CH - TXT_D[1], CH - TXT_D[0]] : TXT_A;
  const px = 30, pw = CW - 60;
  g.save();
  rr(g, px, t0, pw, t1 - t0, 12);
  g.fillStyle = lin(g, 0, t0, 0, t1, demon ? HELL.text : F.text); g.fill();
  g.lineWidth = 2; g.strokeStyle = demon ? 'rgba(255,120,70,.35)' : (F.dark ? 'rgba(255,160,110,.35)' : 'rgba(120,80,20,.35)'); g.stroke();
  // a soft inner shade
  g.clip();
  const vg = g.createRadialGradient(CW / 2, (t0 + t1) / 2, 20, CW / 2, (t0 + t1) / 2, pw * .62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, demon ? 'rgba(0,0,0,.35)' : 'rgba(80,50,10,.12)');
  g.fillStyle = vg; g.fillRect(px, t0, pw, t1 - t0);
  g.restore();
  const box = { x: px + 16, y: t0 + 8, w: pw - 32, h: t1 - t0 - 16 };
  if (demon) {
    if (!text) text = 'Nothing happens.';
    richText(g, text, box, { size: 34, min: 18, lh: 1.14, ink: HELL.ink, kw: '#ffae5c', num: '#ffffff', up: '#ff6b5b', down: '#9df0a8' });
  } else if (text) {
    const darkText = !!F.dark;
    richText(g, text, box, { size: 35, min: 18, lh: 1.14, ink: darkText ? '#f6e3cf' : '#2b2116', kw: darkText ? '#ffb877' : '#94530a', num: darkText ? '#ffffff' : '#140c04', up: darkText ? '#9df0a8' : '#1f7a2c', down: darkText ? '#ff8f80' : '#b3261e' });
  }
  // the corner orb: Grace cost for the angel, a horned mark for the demon
  if (demon) orbDemon(g, 52, 43);
  else if (!d.unplayable) orbCost(g, 52, 43, d, o);
}
function orbCost(g, x, y, d, o) {
  const cost = o.cost ?? d.cost;
  g.save();
  g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 10; g.shadowOffsetY = 3;
  const rg = g.createRadialGradient(x - 10, y - 12, 4, x, y, 38);
  if (d.rarity === 'infernal') { rg.addColorStop(0, '#ffb08a'); rg.addColorStop(.5, '#c43a1a'); rg.addColorStop(1, '#3a0806'); }
  else { rg.addColorStop(0, '#ffffff'); rg.addColorStop(.45, '#bfe7ff'); rg.addColorStop(1, '#2c6fb0'); }
  g.fillStyle = rg; g.beginPath(); g.arc(x, y, 33, 0, TAU); g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = 5; g.strokeStyle = lin(g, x - 30, y - 30, x + 30, y + 30, ['#fff4c2', '#d9a43a', '#fff0b0', '#a8741a']); g.stroke();
  // a little halo arc over it
  g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,240,180,.9)'; g.beginPath(); g.ellipse(x, y - 34, 16, 4.5, 0, 0, TAU); g.stroke();
  const txt = cost < 0 ? 'X' : String(cost);
  g.font = `900 40px ${FONT_T}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(10,20,50,.85)'; g.strokeText(txt, x, y + 3);
  g.fillStyle = o.cost != null && o.cost < d.cost ? '#9dffb0' : '#ffffff'; g.fillText(txt, x, y + 3);
  g.restore();
}
function orbDemon(g, x, y) {
  g.save();
  g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 10; g.shadowOffsetY = 3;
  const rg = g.createRadialGradient(x - 8, y - 10, 3, x, y, 34);
  rg.addColorStop(0, '#ff8a5a'); rg.addColorStop(.5, '#8a1410'); rg.addColorStop(1, '#1c0304');
  g.fillStyle = rg; g.beginPath(); g.arc(x, y, 30, 0, TAU); g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = 4; g.strokeStyle = '#3a0a08'; g.stroke();
  g.restore();
  drawGlyph(g, 'horned', x - 24, y - 25, 48, { body: '#fff0e4', body2: '#ffb08a', outline: '#3a0606', hole: '#5a0a08' });
}
function plaque(g, d, F) {
  const label = (d.holy ? 'Holy ' : '') + ({ attack: 'Attack', skill: 'Skill', power: 'Power', curse: 'Curse', status: 'Status' }[d.type] ?? '') + (d.rarity === 'infernal' ? ' · Infernal' : '');
  g.font = `700 17px ${FONT_T}`;
  const w = g.measureText(label.toUpperCase()).width * 1.12 + 34, x = CW / 2 - w / 2, y = ART.y - 12;
  g.save();
  g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 6; g.shadowOffsetY = 2;
  rr(g, x, y, w, 26, 13); g.fillStyle = lin(g, 0, y, 0, y + 26, F.ban); g.fill();
  g.shadowColor = 'transparent'; g.lineWidth = 2; g.strokeStyle = F.trim; g.stroke();
  g.fillStyle = F.dark ? F.ink : F.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.letterSpacing = '2px';
  g.fillText(label.toUpperCase(), CW / 2 + 1, y + 14);
  g.letterSpacing = '0px';
  if (d.holy) { g.fillStyle = '#e9b83a'; g.beginPath(); g.ellipse(x + 15, y + 13, 7, 3, 0, 0, TAU); g.lineWidth = 2; g.strokeStyle = '#c8901c'; g.stroke(); }
  g.restore();
}

/* ---------- the picture: an emblem in heaven, mirrored in hell ---------- */
function drawArt(g, d) {
  const { x, y, w, h } = ART, sky = skyOf(d);
  g.save();
  artShape(g, d.type, x, y, w, h); g.save(); g.clip();
  // heaven
  g.fillStyle = lin(g, 0, y, 0, HZ, [sky[0], sky[1], sky[2]]); g.fillRect(x, y, w, HZ - y);
  const seed = [...d.id].reduce((s, c) => s * 31 + c.charCodeAt(0) >>> 0, 7);
  const rnd = (i) => { const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };
  // rays from behind the emblem
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + (i - 6.5) * .2 + (rnd(i) - .5) * .1;
    g.fillStyle = `rgba(255,240,200,${.05 + rnd(i + 20) * .07})`;
    g.beginPath(); g.moveTo(CW / 2, HZ - 40); g.lineTo(CW / 2 + Math.cos(a - .05) * 400, HZ - 40 + Math.sin(a - .05) * 400); g.lineTo(CW / 2 + Math.cos(a + .05) * 400, HZ - 40 + Math.sin(a + .05) * 400); g.fill();
  }
  g.restore();
  // clouds along the horizon
  for (let i = 0; i < 9; i++) {
    const cx = x + rnd(i + 3) * w, cy = HZ - 8 - rnd(i + 40) * 40, r = 26 + rnd(i + 9) * 34;
    const cg = g.createRadialGradient(cx, cy, 2, cx, cy, r);
    cg.addColorStop(0, d.rarity === 'infernal' || d.type === 'curse' ? 'rgba(40,20,30,.5)' : 'rgba(255,250,240,.55)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = cg; g.beginPath(); g.ellipse(cx, cy, r * 1.6, r * .6, 0, 0, TAU); g.fill();
  }
  // hell: a glow at the horizon sinking into black, with embers
  g.fillStyle = lin(g, 0, HZ, 0, y + h, [[0, '#ff9a3c'], [.12, '#d2361a'], [.5, '#5a0a0a'], [1, '#120203']]); g.fillRect(x, HZ, w, y + h - HZ);
  // spires of rock standing "up" from the horizon on hell's side (they hang down here)
  g.fillStyle = 'rgba(20,3,4,.85)';
  g.beginPath(); g.moveTo(x, y + h);
  for (let i = 0; i <= 12; i++) { const px = x + i / 12 * w, tall = (i === 0 || i === 12 ? .1 : .25 + rnd(i + 60) * .45) * (y + h - HZ); g.lineTo(px - 10, y + h); g.lineTo(px, y + h - tall); g.lineTo(px + 10, y + h); }
  g.lineTo(x + w, y + h); g.closePath(); g.fill();
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 22; i++) { const ex = x + rnd(i + 80) * w, ey = HZ + 6 + rnd(i + 120) * (y + h - HZ - 10), er = 1 + rnd(i + 160) * 2.2; g.fillStyle = `rgba(255,${120 + rnd(i) * 100 | 0},40,${.5 + rnd(i + 7) * .5})`; g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.fill(); }
  g.restore();
  // the emblem, standing on the horizon…
  const S = 150, gx = CW / 2 - S / 2, gy = HZ - S + 4;
  const infernal = d.rarity === 'infernal';
  const heavenly = infernal ? { body: '#3a1010', body2: '#120404', outline: '#ff7a3a', accent: '#ffb35a', detail: '#ff8a4a', hole: '#0a0202', glow: 'rgba(255,90,40,.9)', glowBlur: 10 }
    : d.type === 'curse' ? { body: '#d8ccf0', body2: '#7e6aa8', outline: '#2e2244', accent: '#f4eaff', detail: '#3a2c54', hole: '#241a34', glow: 'rgba(190,160,255,.6)', glowBlur: 10 }
    : d.type === 'status' ? { body: '#e8e4de', body2: '#9a958e', outline: '#3a3836', accent: '#ffffff', detail: '#4a4744', hole: '#2a2826', glow: 'rgba(255,255,255,.35)', glowBlur: 8 }
    : { body: '#fffdf2', body2: '#f2c14e', outline: '#8a5a08', accent: '#ffffff', detail: '#a06a10', hole: '#7a4a06', glow: 'rgba(255,236,170,.95)', glowBlur: 12 };
  drawGlyph(g, d.glyph, gx, gy, S, heavenly);
  // …and its reflection in hell
  g.save(); g.translate(0, HZ * 2); g.scale(1, -1);
  drawGlyph(g, d.glyph, gx, gy, S, { body: '#3a0606', body2: '#0c0101', outline: '#ff6a2a', accent: '#ff5a24', detail: '#ff7a3a', hole: '#000000', glow: 'rgba(255,60,20,.9)', glowBlur: 10 });
  g.restore();
  // the horizon line
  g.fillStyle = lin(g, x, 0, x + w, 0, [[0, 'rgba(255,220,150,0)'], [.5, 'rgba(255,240,200,.95)'], [1, 'rgba(255,220,150,0)']]);
  g.fillRect(x, HZ - 1.5, w, 3);
  g.restore();
  // its frame
  artShape(g, d.type, x, y, w, h);
  g.lineWidth = 7; g.strokeStyle = lin(g, 0, y, 0, y + h, [[0, '#fff3c4'], [.48, '#c99a3e'], [.52, '#7a2410'], [1, '#2a0606']]); g.stroke();
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(0,0,0,.6)'; g.stroke();
  g.restore();
}

/* ---------- the back every card shares: heaven and hell wound round each other ---------- */
let BACK = null;
export function paintBack() {
  if (BACK) return BACK;
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const g = c.getContext('2d');
  rr(g, 0, 0, CW, CH, R); g.save(); g.clip();
  g.fillStyle = lin(g, 0, 0, CW, CH, ['#141a3a', '#0b0d1f', '#1d0a10']); g.fillRect(0, 0, CW, CH);
  // a lattice of tiny stars
  g.fillStyle = 'rgba(255,230,170,.18)';
  for (let y = 30; y < CH; y += 34) for (let x = (y / 34 % 2) * 17 + 20; x < CW; x += 34) { g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); }
  // gold border
  g.strokeStyle = '#d9b25a'; g.lineWidth = 6; rr(g, 18, 18, CW - 36, CH - 36, 20); g.stroke();
  g.strokeStyle = 'rgba(217,178,90,.5)'; g.lineWidth = 2; rr(g, 30, 30, CW - 60, CH - 60, 14); g.stroke();
  // corner flourishes (point-symmetric, so the back looks the same either way up)
  for (const [cx, cy, r] of [[30, 30, 0], [CW - 30, CH - 30, Math.PI], [CW - 30, 30, Math.PI / 2], [30, CH - 30, -Math.PI / 2]]) {
    g.save(); g.translate(cx, cy); g.rotate(r);
    g.strokeStyle = '#d9b25a'; g.lineWidth = 3; g.beginPath(); g.moveTo(10, 50); g.quadraticCurveTo(10, 10, 50, 10); g.stroke();
    g.beginPath(); g.arc(18, 18, 5, 0, TAU); g.fillStyle = '#d9b25a'; g.fill();
    g.restore();
  }
  // the medallion: a gold and crimson swirl, like the two halves of every card
  const mx = CW / 2, my = CH / 2, mr = 150;
  g.save();
  g.shadowColor = 'rgba(255,200,120,.5)'; g.shadowBlur = 40;
  g.beginPath(); g.arc(mx, my, mr + 14, 0, TAU); g.fillStyle = '#0a0a14'; g.fill();
  g.restore();
  g.lineWidth = 6; g.strokeStyle = '#d9b25a'; g.beginPath(); g.arc(mx, my, mr + 12, 0, TAU); g.stroke();
  // heaven's half
  g.save(); g.beginPath();
  g.arc(mx, my, mr, -Math.PI / 2, Math.PI / 2, true); g.arc(mx, my + mr / 2, mr / 2, Math.PI / 2, -Math.PI / 2, true); g.arc(mx, my - mr / 2, mr / 2, Math.PI / 2, -Math.PI / 2, false); g.closePath();
  g.fillStyle = lin(g, mx - mr, my - mr, mx, my + mr, ['#fff8dc', '#f2c84e', '#b47a14']); g.fill();
  g.restore();
  // hell's half
  g.save(); g.beginPath();
  g.arc(mx, my, mr, -Math.PI / 2, Math.PI / 2, false); g.arc(mx, my + mr / 2, mr / 2, Math.PI / 2, -Math.PI / 2, true); g.arc(mx, my - mr / 2, mr / 2, Math.PI / 2, -Math.PI / 2, false); g.closePath();
  g.fillStyle = lin(g, mx + mr, my + mr, mx, my - mr, ['#2a0303', '#a01a10', '#ff6a2a']); g.fill();
  g.restore();
  drawGlyph(g, 'feather', mx - 34, my - mr / 2 - 36, 68, { body: '#ffffff', body2: '#ffe9a8', outline: '#8a5a08', detail: '#a06a10' });
  g.save(); g.translate(mx, my + mr / 2); g.rotate(Math.PI);
  drawGlyph(g, 'flame', -34, -34, 68, { body: '#ffb35a', body2: '#ff4a1a', accent: '#fff0a0', outline: '#3a0606' });
  g.restore();
  g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.stroke();
  // the title, top and (upside down) bottom
  g.fillStyle = '#d9b25a'; g.font = `700 30px ${FONT_T}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.letterSpacing = '8px';
  g.fillText('HARROWING', mx + 4, 92);
  g.save(); g.translate(mx, CH - 92); g.rotate(Math.PI); g.fillText('HARROWING', 4, 0); g.restore();
  g.letterSpacing = '0px';
  g.restore();
  rr(g, 1.5, 1.5, CW - 3, CH - 3, R - 1); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.6)'; g.stroke();
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
