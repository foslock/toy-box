// Card faces: every card is drawn on a 2D canvas in a 768 × 1072 design space (63 × 88 mm), plus a small "foil mask"
// that tells the card shader where the holo rainbow (red), metallic foil (green) and etched texture (blue) go.
// Faces are made on demand, a few per frame, and cached with reference counts.
import * as THREE from 'three';
import { HOLO, FULL, RARITY, VARIANT_NAME, money, itemOf } from './store.js';
import { SET_BY_ID } from './sets/index.js';
import { finishScene } from './sets/house/rooms.js';
import { hashString } from './kit.js';

export const CW = 768, CH = 1072;
export const HI = 768, LO = 320;                 // face widths in pixels
const ART = { x: 54, y: 122, w: 660, h: 470 };   // the picture window on a normal card
const ART_BOX = [.13, .1, .87, .86], FULL_BOX = [.06, .24, .94, .77];
const INK = '#1d1824', TAU = Math.PI * 2;
const FONT = 'Fredoka, "Nunito", system-ui, sans-serif', BODY = 'Nunito, system-ui, sans-serif';

/* ---------- drawing helpers ---------- */
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, c]) => gr.addColorStop(t, c)); return gr; };
const mix = (a, b, t) => { const A = new THREE.Color(a), B = new THREE.Color(b); return '#' + A.lerp(B, t).getHexString(); };
export const SILVER = ['#f7f8fa', '#d3d8df', '#fbfcfd', '#bfc6cf', '#eef1f4'];
export const GOLD = ['#fff3c4', '#e2ae45', '#fff6d6', '#c58a26', '#f7d77c'];
const metal = (g, x0, y0, x1, y1, cols) => lin(g, x0, y0, x1, y1, cols.map((c, i) => [i / (cols.length - 1), c]));

function fitFont(g, text, weight, size, family, maxW, min = size * .55) {
  let s = size;
  for (; s > min; s -= 1) { g.font = `${weight} ${s}px ${family}`; if (g.measureText(text).width <= maxW) break; }
  return s;
}
// Word-wrap text into at most maxLines lines, shrinking the size if needed. Returns the lines and the size used.
function wrap(g, text, weight, size, family, maxW, maxLines, min = size * .72) {
  for (let s = size; s >= min; s -= 1) {
    g.font = `${weight} ${s}px ${family}`;
    const words = text.split(/\s+/), lines = [];
    let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line);
    if (lines.length <= maxLines || s - 1 < min) return { lines: lines.slice(0, maxLines), size: s };
  }
  return { lines: [text], size: min };
}
export function typeBadge(g, type, x, y, r, ring = '#ffffff') {
  g.save();
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(x, y + r * .08, r * 1.02, 0, TAU); g.fill();
  g.fillStyle = lin(g, x, y - r, x, y + r, [[0, mix(type.color, '#ffffff', .25)], [1, mix(type.color, '#000000', .12)]]);
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.lineWidth = r * .12; g.strokeStyle = ring; g.stroke();
  g.fillStyle = '#ffffff'; type.icon(g, x, y, r * .78);
  g.restore();
}
function sparkle(g, x, y, s) {
  g.beginPath(); g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s); g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s); g.fill();
}
function houseGlyph(g, x, y, r) {
  g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y - r * .05); g.lineTo(x + r * .7, y - r * .05); g.lineTo(x + r * .7, y + r * .85);
  g.lineTo(x - r * .7, y + r * .85); g.lineTo(x - r * .7, y - r * .05); g.lineTo(x - r, y - r * .05); g.closePath(); g.fill();
}
// The value printed on a card, and the name's font: as big as fits beside it. The foil mask sets the name the same way.
const valueText = (item, v) => money(item.price * [1, 5, 2, 50][v & 3], { short: true });
function nameFont(g, item, v) {
  g.font = `700 40px ${FONT}`;
  fitFont(g, item.name, 700, 46, FONT, CW - 104 - g.measureText(valueText(item, v)).width - 30 - 46);
}
// The little info line under the art, and how wide its pill is (the silver sheen on it is exactly as wide).
function ribbon(g, set, item) {
  const text = `No. ${String(item.no).padStart(3, '0')}  ·  ${set.types[item.type].name}  ·  ${item.size}`;
  g.font = `italic 600 21px ${BODY}`;
  const w = Math.min(CW - 120, g.measureText(text).width + 56);
  return { text, w, x: CW / 2 - w / 2 };
}
// A full-art card's metal border: everything outside a window 18 in from the edge, its corners rounded like the card's.
function fullFrame(g) { g.beginPath(); g.rect(0, 0, CW, CH); g.roundRect(18, 18, CW - 36, CH - 36, 21); }
function setSymbol(g, set, x, y, r, color) {
  g.save(); g.fillStyle = color;
  if (set.symbol) set.symbol(g, x, y, r); else houseGlyph(g, x, y, r);
  g.restore();
}
function scenePaint(g, set, item, w, h, full) {
  const type = set.types[item.type];
  const o = { floor: h * (full ? FULL_BOX[3] : ART_BOX[3]), full, rarity: item.rarity, seed: hashString(item.id) };
  (type.scene || defaultScene)(g, w, h, o, type);
  finishScene(g, w, h, o, type);
}
function defaultScene(g, w, h, o, type) {
  g.fillStyle = lin(g, 0, 0, 0, h, [[0, type.light], [1, type.color]]); g.fillRect(0, 0, w, h);
}

/* ---------- normal card ---------- */
function drawNormal(g, set, item, v, art) {
  const type = set.types[item.type], rare = item.rarity === 'R', cols = rare ? GOLD : SILVER;
  // border
  g.fillStyle = metal(g, 0, 0, CW, CH, cols); g.fillRect(0, 0, CW, CH);
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; rr(g, 21, 21, CW - 42, CH - 42, 22); g.stroke();
  // panel
  rr(g, 22, 22, CW - 44, CH - 44, 22); g.save(); g.clip();
  g.fillStyle = lin(g, 0, 22, 0, CH, [[0, mix(type.light, '#ffffff', .25)], [.45, type.light], [1, mix(type.light, type.color, .55)]]);
  g.fillRect(0, 0, CW, CH);
  g.globalAlpha = .07; g.strokeStyle = type.color; g.lineWidth = 10;
  for (let x = -CH; x < CW; x += 34) { g.beginPath(); g.moveTo(x, CH); g.lineTo(x + CH, 0); g.stroke(); }
  g.globalAlpha = .08; g.fillStyle = type.dark; type.icon(g, CW * .78, CH * .8, 190);
  g.globalAlpha = 1;
  g.restore();
  // header: name, value, type
  typeBadge(g, type, CW - 66, 74, 25);
  g.font = `700 40px ${FONT}`; g.fillStyle = type.dark; g.textBaseline = 'alphabetic'; g.textAlign = 'right';
  g.fillText(valueText(item, v), CW - 104, 90);
  g.fillStyle = rare ? lin(g, 0, 50, 0, 92, [[0, '#a8761a'], [.55, '#7a4e06'], [1, '#5c3a02']]) : INK; g.textAlign = 'left';
  nameFont(g, item, v);
  g.fillText(item.name, 46, 90);
  // art window
  g.save(); rr(g, ART.x, ART.y, ART.w, ART.h, 10); g.clip();
  g.translate(ART.x, ART.y);
  scenePaint(g, set, item, ART.w, ART.h, false);
  if (art) g.drawImage(art, 0, 0, ART.w, ART.h);
  g.restore();
  g.lineWidth = 9; g.strokeStyle = metal(g, ART.x, ART.y, ART.x + ART.w, ART.y + ART.h, cols); rr(g, ART.x - 4, ART.y - 4, ART.w + 8, ART.h + 8, 13); g.stroke();
  g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,.35)'; rr(g, ART.x, ART.y, ART.w, ART.h, 10); g.stroke();
  // info ribbon
  const rib = ribbon(g, set, item);
  g.fillStyle = metal(g, rib.x, 0, rib.x + rib.w, 0, cols); rr(g, rib.x, 604, rib.w, 34, 17); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = INK; g.textAlign = 'center'; fitFont(g, rib.text, 'italic 600', 21, BODY, rib.w - 30); g.fillText(rib.text, CW / 2, 628);
  // move
  const pips = { C: 1, U: 2, R: 3 }[item.rarity];
  for (let i = 0; i < pips; i++) typeBadge(g, type, 72 + i * 42, 690, 18);
  const nameX = 72 + pips * 42 - 4;
  g.textAlign = 'right'; g.fillStyle = INK; g.font = `700 50px ${FONT}`; g.fillText(String(item.move.power), CW - 50, 708);
  const pw = g.measureText(String(item.move.power)).width;
  g.textAlign = 'left'; fitFont(g, item.move.name, 600, 38, FONT, CW - 50 - pw - 24 - nameX); g.fillText(item.move.name, nameX, 704);
  const mt = wrap(g, item.move.text, 600, 26, BODY, CW - 112, 3);
  g.fillStyle = '#2b2533';
  mt.lines.forEach((l, i) => g.fillText(l, 56, 752 + i * mt.size * 1.26));
  // stats: weakness, resistance, upkeep
  statRow(g, set, item, 812);
  // flavor
  const ft = wrap(g, item.flavor, 'italic 400', 23, BODY, CW - 140, 3, 18);
  g.fillStyle = 'rgba(29,24,36,.78)'; g.textAlign = 'left';
  const fy = 918 + (3 - ft.lines.length) * ft.size * .5;
  ft.lines.forEach((l, i) => g.fillText(l, 70, fy + i * ft.size * 1.3));
  // footer
  footer(g, set, item, v, 1030, INK);
}
// Weakness, resistance and upkeep (dots, by how dear the thing is). Sets can give items their own; rooms give defaults.
export function statsFor(set, item) {
  const t = set.types[item.type];
  const upkeep = Math.max(1, Math.min(4, Math.round(Math.log10(item.price / 100) + 1)));
  return { weak: item.weak ?? t.weak, resist: item.resist ?? t.resist, upkeep: item.upkeep ?? upkeep };
}
function statRow(g, set, item, y) {
  const st = statsFor(set, item), type = set.types[item.type];
  g.strokeStyle = mix(type.color, '#000000', .1); g.globalAlpha = .45; g.lineWidth = 2;
  g.beginPath(); g.moveTo(56, y); g.lineTo(CW - 56, y); g.stroke(); g.globalAlpha = 1;
  const cols = [[80, 'weakness'], [CW / 2 - 70, 'resistance'], [CW - 210, 'upkeep']];
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  for (const [x, what] of cols) {
    g.font = `800 15px ${BODY}`; g.fillStyle = 'rgba(29,24,36,.55)';
    g.fillText(what.toUpperCase(), x, y + 30);
    const cy = y + 58;
    g.font = `800 24px ${BODY}`; g.fillStyle = INK;
    if (what === 'weakness') { if (st.weak && set.types[st.weak]) { typeBadge(g, set.types[st.weak], x + 16, cy - 8, 15); g.fillText('×2', x + 40, cy); } else g.fillText('—', x, cy); }
    else if (what === 'resistance') { if (st.resist && set.types[st.resist]) { typeBadge(g, set.types[st.resist], x + 16, cy - 8, 15); g.fillText('−20', x + 40, cy); } else g.fillText('—', x, cy); }
    else { for (let i = 0; i < st.upkeep; i++) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x + 12 + i * 30, cy - 8, 11, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(29,24,36,.55)'; g.stroke(); g.fillStyle = 'rgba(29,24,36,.35)'; g.beginPath(); g.arc(x + 12 + i * 30, cy - 8, 4.5, 0, TAU); g.fill(); } }
  }
  g.strokeStyle = mix(type.color, '#000000', .1); g.globalAlpha = .45; g.lineWidth = 2;
  g.beginPath(); g.moveTo(56, y + 80); g.lineTo(CW - 56, y + 80); g.stroke(); g.globalAlpha = 1;
}
function footer(g, set, item, v, y, color, light = false) {
  const r = RARITY[item.rarity];
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.font = `900 21px ${BODY}`; g.fillStyle = item.rarity === 'R' ? '#c8901c' : color;
  g.fillText(r.symbol, 48, y);
  g.font = `800 17px ${BODY}`; g.fillStyle = color;
  g.fillText(`${set.code} ${String(item.no).padStart(3, '0')}/${String(set.items.length).padStart(3, '0')}${v & HOLO ? '  ✦ HOLO' : ''}`, 76, y - 1);
  setSymbol(g, set, CW / 2, y - 8, 10, color);
  g.textAlign = 'right'; g.font = `italic 600 16px ${BODY}`; g.fillStyle = light ? 'rgba(255,255,255,.8)' : 'rgba(29,24,36,.6)';
  g.fillText(`Odds & Ends · ${set.name}`, CW - 48, y - 1);
}

/* ---------- full-art card ---------- */
function drawFull(g, set, item, v, art) {
  const type = set.types[item.type], rare = item.rarity === 'R', cols = rare || v & HOLO ? GOLD : SILVER;
  scenePaint(g, set, item, CW, CH, true);
  if (art) g.drawImage(art, 0, 0, CW, CH);
  // legibility shades top and bottom
  g.fillStyle = lin(g, 0, 0, 0, 260, [[0, 'rgba(10,6,20,.62)'], [1, 'rgba(10,6,20,0)']]); g.fillRect(0, 0, CW, 260);
  // value tag (measured first, so the name knows how much room it has)
  const value = valueText(item, v);
  g.font = `700 38px ${FONT}`;
  const tw = g.measureText(value).width + 44, tx = CW - 40 - tw, ty = 50;
  // name: big, outlined, a little slanted
  g.save(); g.translate(44, 104); g.transform(1, 0, -.12, 1, 0, 0);
  const name = item.name.toUpperCase();
  const size = fitFont(g, name, 700, 70, FONT, tx - 38 - 30 - 44 - 20, 34);
  g.font = `700 ${size}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.lineJoin = 'round'; g.lineWidth = size * .2; g.strokeStyle = type.dark; g.strokeText(name, 0, 0);
  g.fillStyle = lin(g, 0, -size, 0, 0, [[0, '#ffffff'], [1, mix(type.light, '#ffffff', .3)]]); g.fillText(name, 0, 0);
  g.restore();
  g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 6;
  g.font = `800 22px ${BODY}`; g.fillStyle = '#ffffff'; g.textAlign = 'left';
  g.fillText(`${type.name.toUpperCase()}  ·  ${RARITY[item.rarity].name.toUpperCase()}${v & HOLO ? '  ·  HOLO' : ''}`, 50, 146);
  g.restore();
  g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
  g.fillStyle = metal(g, tx, ty, tx + tw, ty + 64, GOLD); rr(g, tx, ty, tw, 64, 32); g.fill(); g.restore();
  g.strokeStyle = 'rgba(120,70,0,.5)'; g.lineWidth = 2; rr(g, tx + 4, ty + 4, tw - 8, 56, 28); g.stroke();
  g.fillStyle = '#3b2600'; g.textAlign = 'center'; g.fillText(value, tx + tw / 2, ty + 46);
  typeBadge(g, type, tx - 38, ty + 32, 26);
  g.fillStyle = lin(g, 0, CH - 90, 0, CH, [[0, 'rgba(10,6,20,0)'], [1, 'rgba(10,6,20,.55)']]); g.fillRect(0, CH - 90, CW, 90);
  // frosted panel with the move
  const px = 34, py = 818, pw = CW - 68, ph = 190;
  g.save(); rr(g, px, py, pw, ph, 22); g.clip();
  const k = g.getTransform().a;
  g.filter = `blur(${Math.max(2, 14 * k)}px)`; g.drawImage(g.canvas, px * k, py * k, pw * k, ph * k, px, py, pw, ph); g.filter = 'none';
  g.fillStyle = 'rgba(255,255,255,.58)'; g.fillRect(px, py, pw, ph);
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2.5; rr(g, px, py, pw, ph, 22); g.stroke();
  const pips = { C: 1, U: 2, R: 3 }[item.rarity];
  for (let i = 0; i < pips; i++) typeBadge(g, type, px + 40 + i * 40, py + 44, 17);
  const nameX = px + 40 + pips * 40 - 4;
  g.textAlign = 'right'; g.fillStyle = INK; g.font = `700 46px ${FONT}`; g.fillText(String(item.move.power), px + pw - 26, py + 60);
  const pwid = g.measureText(String(item.move.power)).width;
  g.textAlign = 'left'; fitFont(g, item.move.name, 600, 36, FONT, pw - pwid - 60 - (nameX - px)); g.fillText(item.move.name, nameX, py + 57);
  const mt = wrap(g, item.move.text, 600, 25, BODY, pw - 56, 3);
  g.fillStyle = '#2b2533'; mt.lines.forEach((l, i) => g.fillText(l, px + 28, py + 100 + i * mt.size * 1.24));
  // border
  fullFrame(g); g.fillStyle = metal(g, 0, 0, CW, CH, cols); g.fill('evenodd');
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.7)'; rr(g, 22, 22, CW - 44, CH - 44, 17); g.stroke();
  footer(g, set, item, v, CH - 34, '#ffffff', true);
}

/* ---------- foil masks ---------- */
const MW = 256, MH = Math.round(256 * CH / CW);
function layer() { const c = document.createElement('canvas'); c.width = MW; c.height = MH; const g = c.getContext('2d'); g.scale(MW / CW, MH / CH); return [c, g]; }
function drawMask(set, item, v, art) {
  const full = v & FULL, holo = v & HOLO, rare = item.rarity === 'R';
  const [R, r] = layer(), [G, gg] = layer(), [B, b] = layer();
  r.fillStyle = gg.fillStyle = b.fillStyle = '#fff';
  if (full) {
    if (holo) {
      r.globalAlpha = 1; r.fillRect(0, 0, CW, CH);
      if (art) { r.globalCompositeOperation = 'destination-out'; r.globalAlpha = .85; r.drawImage(art, 0, 0, CW, CH); r.globalCompositeOperation = 'source-over'; }
      r.globalCompositeOperation = 'destination-out'; r.globalAlpha = .85; rr(r, 34, 818, CW - 68, 190, 22); r.fill();
      r.globalAlpha = .75; r.fillRect(CW * .45, 40, CW * .55, 90);          // the price tag stays readable
      r.globalAlpha = .45; r.fillRect(30, 30, CW * .7, 130);                // and so does the name
      r.globalCompositeOperation = 'source-over';
    }
    b.fillRect(0, 0, CW, CH); b.globalCompositeOperation = 'destination-out'; rr(b, 34, 818, CW - 68, 190, 22); b.fill();
    fullFrame(gg); gg.fill('evenodd');
  } else {
    if (holo) {
      r.globalAlpha = .16; r.fillRect(22, 22, CW - 44, CH - 44); r.globalAlpha = 1;
      r.save(); r.beginPath(); r.rect(ART.x, ART.y, ART.w, ART.h); r.clip();
      r.clearRect(ART.x, ART.y, ART.w, ART.h); r.fillRect(ART.x, ART.y, ART.w, ART.h);
      if (art) { r.globalCompositeOperation = 'destination-out'; r.globalAlpha = .9; r.drawImage(art, ART.x, ART.y, ART.w, ART.h); }
      r.restore();
    }
    // metallic foil: the border and art frame (gold on rares, silver on uncommons)
    if (rare || item.rarity === 'U' || holo) {
      gg.lineWidth = 12; gg.strokeStyle = '#fff'; rr(gg, ART.x - 4, ART.y - 4, ART.w + 8, ART.h + 8, 13); gg.stroke();
      gg.lineWidth = 22; rr(gg, 11, 11, CW - 22, CH - 22, 26); gg.stroke();
      const rib = ribbon(gg, set, item); rr(gg, rib.x, 604, rib.w, 34, 17); gg.fill();
    }
    if (rare) { nameFont(gg, item, v); gg.textBaseline = 'alphabetic'; gg.textAlign = 'left'; gg.fillText(item.name, 46, 90); }
  }
  const out = document.createElement('canvas'); out.width = MW; out.height = MH;
  const o = out.getContext('2d'), img = o.createImageData(MW, MH), d = img.data;
  const [rd, gd, bd] = [R, G, B].map(c => c.getContext('2d').getImageData(0, 0, MW, MH).data);
  for (let i = 0; i < d.length; i += 4) { d[i] = rd[i + 3]; d[i + 1] = gd[i + 3]; d[i + 2] = bd[i + 3]; d[i + 3] = 255; }
  o.putImageData(img, 0, 0);
  return out;
}
// How strong each foil is for a card: [holo, metal, etch, glitter]
export function foilFor(item, v) {
  const rare = item.rarity === 'R';
  if ((v & 3) === 3) return [1.15, .9, .7, 1.25];
  if (v & HOLO) return [1, rare ? 1 : .7, 0, 1];
  if (v & FULL) return [0, rare ? 1 : .8, 1, .4];
  return [0, rare ? 1 : item.rarity === 'U' ? .55 : 0, 0, 0];
}

/* ---------- card back ---------- */
let backCache = null;
export function cardBack() {
  if (backCache) return backCache;
  const c = document.createElement('canvas'); c.width = HI; c.height = Math.round(HI * CH / CW);
  const g = c.getContext('2d'); g.scale(HI / CW, HI / CW);
  g.fillStyle = metal(g, 0, 0, CW, CH, ['#28347a', '#1a2356', '#2c3a86', '#151c47']); g.fillRect(0, 0, CW, CH);
  rr(g, 30, 30, CW - 60, CH - 60, 24); g.save(); g.clip();
  const bg = g.createRadialGradient(CW / 2, CH / 2, 40, CW / 2, CH / 2, CH * .7);
  bg.addColorStop(0, '#5b7cff'); bg.addColorStop(.45, '#3043b8'); bg.addColorStop(1, '#141a4a');
  g.fillStyle = bg; g.fillRect(0, 0, CW, CH);
  g.globalCompositeOperation = 'screen';
  for (let i = 0; i < 28; i++) {
    const a0 = (i / 28) * TAU, a1 = a0 + TAU / 28 * .5;
    g.fillStyle = 'rgba(140,170,255,.12)'; g.beginPath(); g.moveTo(CW / 2, CH / 2); g.arc(CW / 2, CH / 2, CH, a0, a1); g.closePath(); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(255,255,255,.06)';
  for (let y = 60, row = 0; y < CH; y += 70, row++) for (let x = 40 + (row % 2) * 35; x < CW; x += 70) { houseGlyph(g, x, y, 13); }
  g.restore();
  g.lineWidth = 6; g.strokeStyle = metal(g, 0, 0, CW, CH, GOLD); rr(g, 30, 30, CW - 60, CH - 60, 24); g.stroke();
  // emblem
  const cx = CW / 2, cy = CH / 2 - 20;
  g.save(); g.shadowColor = 'rgba(0,0,20,.6)'; g.shadowBlur = 30;
  g.fillStyle = '#1b2463'; g.beginPath(); g.arc(cx, cy, 210, 0, TAU); g.fill(); g.restore();
  g.lineWidth = 34; g.strokeStyle = metal(g, cx - 210, cy - 210, cx + 210, cy + 210, GOLD); g.beginPath(); g.arc(cx, cy, 196, 0, TAU); g.stroke();
  g.lineWidth = 3; g.strokeStyle = '#7a5410'; g.beginPath(); g.arc(cx, cy, 214, 0, TAU); g.stroke(); g.beginPath(); g.arc(cx, cy, 178, 0, TAU); g.stroke();
  const inner = g.createRadialGradient(cx, cy - 60, 10, cx, cy, 178);
  inner.addColorStop(0, '#ff8a5c'); inner.addColorStop(.6, '#e8455a'); inner.addColorStop(1, '#9b1f55');
  g.fillStyle = inner; g.beginPath(); g.arc(cx, cy, 176, 0, TAU); g.fill();
  g.fillStyle = '#fff4d6'; houseGlyph(g, cx, cy + 6, 96);
  g.fillStyle = '#e8455a'; g.beginPath(); g.arc(cx, cy + 22, 22, 0, TAU); g.fill(); g.fillRect(cx - 9, cy + 30, 18, 42);
  g.fillStyle = '#fff4d6'; sparkle(g, cx + 108, cy - 92, 30); sparkle(g, cx - 118, cy - 70, 16); sparkle(g, cx + 124, cy + 70, 14);
  // arched lettering on the ring
  g.font = `700 30px ${FONT}`; g.fillStyle = '#3b2600'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const arc = (text, radius, start, dir) => {
    const chars = [...text]; let total = 0; const ws = chars.map(ch => { const w = g.measureText(ch).width + 3; total += w; return w; });
    let a = start - dir * (total / radius) / 2;
    chars.forEach((ch, i) => { const aa = a + dir * ws[i] / 2 / radius; g.save(); g.translate(cx + Math.cos(aa) * radius, cy + Math.sin(aa) * radius); g.rotate(aa + dir * Math.PI / 2); g.fillText(ch, 0, 0); g.restore(); a += dir * ws[i] / radius; });
  };
  arc('ODDS & ENDS', 196, -Math.PI / 2, 1);
  arc('TRADING CARDS', 196, Math.PI / 2, -1);
  g.font = `700 54px ${FONT}`; g.fillStyle = '#fff4d6'; g.textBaseline = 'alphabetic';
  g.save(); g.shadowColor = 'rgba(0,0,30,.7)'; g.shadowBlur = 10;
  g.fillText('ODDS & ENDS', cx, CH - 170); g.font = `800 22px ${BODY}`; g.fillText('C O L L E C T   T H E M   A L L', cx, CH - 128);
  g.restore();
  // its mask: gold on the ring and lettering
  const [M, m] = layer();
  m.lineWidth = 36; m.strokeStyle = '#fff'; m.beginPath(); m.arc(cx, cy, 196, 0, TAU); m.stroke();
  m.lineWidth = 8; rr(m, 30, 30, CW - 60, CH - 60, 24); m.stroke();
  const mask = document.createElement('canvas'); mask.width = MW; mask.height = MH;
  const mg = mask.getContext('2d'), img = mg.createImageData(MW, MH), md = M.getContext('2d').getImageData(0, 0, MW, MH).data;
  for (let i = 0; i < img.data.length; i += 4) { img.data[i] = 30; img.data[i + 1] = md[i + 3]; img.data[i + 2] = 0; img.data[i + 3] = 255; }
  mg.putImageData(img, 0, 0);
  backCache = { canvas: c, mask };
  return backCache;
}

/* ---------- the SOLD sash ---------- */
// A red ribbon across the card, corner to corner, with SOLD on it. Drawn in the face's own design space.
export function soldSash() {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const g = c.getContext('2d'), L = CH * 1.8, H = 156;
  g.translate(CW / 2, CH / 2); g.rotate(-.68);
  g.save(); g.shadowColor = 'rgba(50,0,12,.5)'; g.shadowBlur = 26; g.shadowOffsetY = 10;
  g.fillStyle = lin(g, 0, -H / 2, 0, H / 2, [[0, '#ff6a78'], [.45, '#e3263f'], [1, '#9e0c25']]);
  g.fillRect(-L / 2, -H / 2, L, H);
  g.restore();
  // a sheen along the top edge, and stitching
  g.fillStyle = lin(g, 0, -H / 2, 0, -H / 2 + 40, [[0, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(-L / 2, -H / 2, L, 40);
  g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 4; g.setLineDash([18, 10]);
  for (const y of [-H / 2 + 15, H / 2 - 15]) { g.beginPath(); g.moveTo(-L / 2, y); g.lineTo(L / 2, y); g.stroke(); }
  g.setLineDash([]);
  // the word, spaced out by hand (canvas letter-spacing isn't everywhere yet)
  const word = [...'SOLD'], gap = 16;
  g.font = `700 108px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left';
  const ws = word.map(ch => g.measureText(ch).width), total = ws.reduce((a, b) => a + b, 0) + gap * (word.length - 1);
  g.shadowColor = 'rgba(90,0,24,.55)'; g.shadowOffsetY = 5; g.fillStyle = '#ffffff';
  let x = -total / 2;
  word.forEach((ch, i) => { g.fillText(ch, x, 8); x += ws[i] + gap; });
  return c;
}

/* ---------- compose + cache ---------- */
// The size of the item picture a face of this width needs.
export const artSize = (width, full) => { const k = width / CW; return full ? [Math.round(CW * k), Math.round(CH * k)] : [Math.round(ART.w * k), Math.round(ART.h * k)]; };
export function composeFace(studio, card, width = HI) {
  const set = SET_BY_ID[card.set], item = itemOf(card), full = card.v & FULL;
  const scale = width / CW, h = Math.round(width * CH / CW);
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = h;
  const g = canvas.getContext('2d');
  g.scale(scale, scale);
  const [artW, artH] = artSize(width, full);
  const art = studio.art(set, item, full ? 'full' : 'art', artW, artH);
  if (full) drawFull(g, set, item, card.v, art); else drawNormal(g, set, item, card.v, art);
  const mask = drawMask(set, item, card.v, art);
  return { canvas, mask, foil: foilFor(item, card.v) };
}

export class FaceCache {
  constructor(renderer, studio) {
    this.renderer = renderer; this.studio = studio;
    this.map = new Map(); this.queue = [];
    this.max = { [HI]: 14, [LO]: 90 };
    const back = cardBack();
    this.back = { tex: this.texture(back.canvas, true), mask: this.texture(back.mask, false), foil: [0, 1, 0, 0], ready: true, refs: 1 };
    this.blankMask = this.texture((() => { const c = document.createElement('canvas'); c.width = c.height = 4; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 4, 4); return c; })(), false);
  }
  texture(canvas, color) {
    const t = new THREE.CanvasTexture(canvas);
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }
  // The SOLD sash every sold card shares (premultiplied, so its soft shadow blends cleanly).
  get sash() {
    if (!this._sash) { this._sash = this.texture(soldSash(), true); this._sash.premultiplyAlpha = true; }
    return this._sash;
  }
  // Ask for a face; returns an entry that fills in (entry.ready) when it's made. Call release() when done with it.
  get(card, width = HI, urgent = false) {
    const key = `${card.set}:${card.id}:${card.v}@${width}`;
    let e = this.map.get(key);
    if (!e) {
      e = { key, card, width, ready: false, refs: 0, tex: null, mask: null, foil: [0, 0, 0, 0], waiters: [], used: 0 };
      this.map.set(key, e);
      if (urgent) this.make(e); else this.queue.push(e);
    } else if (urgent && !e.ready) { this.queue = this.queue.filter(q => q !== e); this.make(e); }
    e.refs++; e.used = performance.now();
    return e;
  }
  release(e) { if (e && e !== this.back) e.refs = Math.max(0, e.refs - 1); }
  when(e, fn) { if (e.ready) fn(e); else e.waiters.push(fn); }
  make(e) {
    const out = composeFace(this.studio, e.card, e.width);
    e.tex = this.texture(out.canvas, true); e.mask = this.texture(out.mask, false); e.foil = out.foil; e.ready = true;
    this.renderer.initTexture(e.tex); this.renderer.initTexture(e.mask);
    for (const fn of e.waiters.splice(0)) fn(e);
    this.trim(e.width);
  }
  // Make queued faces until the time budget (ms) runs out.
  pump(budget = 8) {
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < budget) {
      const e = this.queue.shift();
      if (e.refs <= 0) { this.map.delete(e.key); continue; }
      this.make(e);
    }
  }
  pending() { return this.queue.length; }
  trim(width) {
    const list = [...this.map.values()].filter(e => e.width === width && e.ready && e.refs <= 0);
    let over = [...this.map.values()].filter(e => e.width === width && e.ready).length - this.max[width];
    list.sort((a, b) => a.used - b.used);
    for (const e of list) { if (over-- <= 0) break; e.tex.dispose(); e.mask.dispose(); this.map.delete(e.key); }
  }
}
