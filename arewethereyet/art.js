// Are We There Yet: everything drawn. Car cutaway, the family, the road, the atlas, the snapshots.
import { REGIONS, regionOf, BILLBOARDS, TAPES } from './data.js';

export const HAND = '"Covered By Your Grace", "Comic Sans MS", cursive';
export const SIGN = '"Overpass", "Helvetica Neue", Arial, sans-serif';

export const INK = '#2b2420', PAPER = '#f3e8cc', RED = '#c8372d', SIGN_GREEN = '#1d6a47';

// ---------------------------------------------------------------- the car (top-down, roof cut away)
export const CAR_W = 100, CAR_H = 222;
export const SEAT_POS = { drive: [31, 76], shot: [69, 76], benchL: [21, 124], benchM: [50, 124], benchR: [79, 124], wayback: [50, 176] };
export const HEAD_R = 12.5;

function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }

export function drawCar(c, t, opts = {}) {
  // assumes c is already transformed into car units
  c.save();
  // shadow
  c.fillStyle = 'rgba(30,20,10,.28)'; rr(c, 5, 8, CAR_W, CAR_H, 18); c.fill();
  // body
  c.fillStyle = '#c9a77a'; rr(c, 0, 0, CAR_W, CAR_H, 17); c.fill();
  c.strokeStyle = '#5c3f26'; c.lineWidth = 1.6; c.stroke();
  // bumpers
  c.fillStyle = '#d9d6cc'; rr(c, 6, -3, 88, 6, 3); c.fill(); rr(c, 6, CAR_H - 3, 88, 6, 3); c.fill();
  c.strokeStyle = '#8b877c'; c.lineWidth = 0.8; rr(c, 6, -3, 88, 6, 3); c.stroke(); rr(c, 6, CAR_H - 3, 88, 6, 3); c.stroke();
  // headlights
  c.fillStyle = opts.lights ? '#fff6c2' : '#efe9d6';
  rr(c, 8, 2, 14, 5, 2); c.fill(); rr(c, 78, 2, 14, 5, 2); c.fill();
  // hood
  c.strokeStyle = 'rgba(80,50,25,.45)'; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(30, 6); c.quadraticCurveTo(50, 2, 70, 6); c.moveTo(14, 46); c.lineTo(86, 46); c.stroke();
  c.beginPath(); c.moveTo(50, 8); c.lineTo(50, 44); c.stroke();
  // hood ornament + a little chrome
  c.fillStyle = '#ece8dc'; c.beginPath(); c.arc(50, 9, 1.8, 0, 7); c.fill();
  // wood panelling along both flanks
  for (const x0 of [0, 92]) {
    c.fillStyle = '#7b4b28'; c.fillRect(x0 + 1, 54, 7, 160);
    c.strokeStyle = 'rgba(40,20,8,.45)'; c.lineWidth = 0.5;
    for (let y = 58; y < 212; y += 7) { c.beginPath(); c.moveTo(x0 + 1.5, y); c.quadraticCurveTo(x0 + 4.5, y + 3, x0 + 7.5, y + 1); c.stroke(); }
    c.strokeStyle = '#e1d9c6'; c.lineWidth = 0.9; c.strokeRect(x0 + 1, 54, 7, 160);
  }
  // windshield
  c.fillStyle = '#9fc4c9';
  c.beginPath(); c.moveTo(12, 48); c.lineTo(88, 48); c.lineTo(84, 58); c.lineTo(16, 58); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.moveTo(22, 49.5); c.lineTo(34, 49.5); c.lineTo(26, 56.5); c.lineTo(18, 56.5); c.fill();
  // interior
  c.fillStyle = '#6b3d2e'; rr(c, 9, 58, 82, 150, 6); c.fill();
  // dashboard
  c.fillStyle = '#3c2a22'; rr(c, 10, 58, 80, 7, 2); c.fill();
  c.fillStyle = '#d7c49a'; c.fillRect(44, 60, 12, 3); // radio
  // steering wheel
  c.strokeStyle = '#1e1714'; c.lineWidth = 2.6; c.beginPath(); c.ellipse(31, 64, 10, 3.6, 0, 0, 7); c.stroke();
  // front seats
  seat(c, 15, 68, 32, 30); seat(c, 53, 68, 32, 30);
  // back bench
  seat(c, 11, 116, 78, 30);
  c.strokeStyle = 'rgba(60,30,15,.4)'; c.lineWidth = 0.7;
  c.beginPath(); c.moveTo(36, 118); c.lineTo(36, 144); c.moveTo(64, 118); c.lineTo(64, 144); c.stroke();
  // way-back: rear-facing jump seat, cooler, suitcases
  seat(c, 35, 166, 30, 24, true);
  // cooler
  c.fillStyle = '#e8e2d2'; rr(c, 12, 162, 20, 26, 3); c.fill(); c.fillStyle = RED; rr(c, 12, 162, 20, 9, 3); c.fill();
  c.fillStyle = '#fff'; c.fillRect(16, 165, 12, 2);
  if (opts.snacks != null) { c.fillStyle = INK; c.font = `bold 8px ${SIGN}`; c.textAlign = 'center'; c.fillText(opts.snacks, 22, 183); }
  // suitcases
  c.fillStyle = '#4f6e8c'; rr(c, 68, 156, 21, 18, 2); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 0.6; for (let x = 70; x < 89; x += 3) { c.beginPath(); c.moveTo(x, 156); c.lineTo(x, 174); c.stroke(); }
  c.fillStyle = '#b8653a'; rr(c, 69, 176, 19, 16, 2); c.fill();
  c.fillStyle = '#e2c25d'; rr(c, 72, 194, 13, 10, 2); c.fill();
  // pillars (the roof was here)
  c.fillStyle = '#c9a77a';
  for (const y of [57, 108, 152]) { c.fillRect(8, y, 4, 4); c.fillRect(88, y, 4, 4); }
  // tailgate glass
  c.fillStyle = '#9fc4c9'; rr(c, 16, 208, 68, 6, 2); c.fill();
  c.restore();
}

function seat(c, x, y, w, h, back) {
  c.fillStyle = '#c38f57'; rr(c, x, y, w, h, 5); c.fill();
  c.fillStyle = '#a8743f'; if (back) rr(c, x, y + h - 6, w, 6, 3); else rr(c, x, y, w, 6, 3); c.fill();
  c.strokeStyle = 'rgba(70,35,15,.35)'; c.lineWidth = 0.5;
  for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x + 2, y + (h * i) / 4); c.lineTo(x + w - 2, y + (h * i) / 4); c.stroke(); }
}

// ---------------------------------------------------------------- the family
export const LOOK = {
  dad: { skin: '#e3ad86', hair: '#5a3a22', shirt: '#d9a43a', shirt2: '#b8862a' },
  mom: { skin: '#efc29f', hair: '#8e4a26', shirt: '#2f8a87', shirt2: '#24706d' },
  tina: { skin: '#eab996', hair: '#e2bf6e', shirt: '#d9468a', shirt2: '#b13470' },
  kevin: { skin: '#d6a07a', hair: '#3b2a1e', shirt: '#3f6fb0', shirt2: '#e8e2d2' },
  jo: { skin: '#f3c9a8', hair: '#c4622d', shirt: '#efc93a', shirt2: '#d6ad22' },
};

// mood: happy | ok | meh | cross | asleep | yell | green
export function drawPerson(c, id, x, y, r, mood = 'ok', t = 0, opts = {}) {
  const L = LOOK[id];
  c.save();
  c.translate(x, y);
  if (opts.bob) c.translate(0, Math.sin(t * 9 + x) * r * 0.05);
  if (opts.shake) c.translate(Math.sin(t * 50) * r * 0.08, 0);
  // shoulders
  if (!opts.noBody) {
    c.fillStyle = L.shirt; c.beginPath(); c.ellipse(0, r * 0.95, r * 1.05, r * 0.6, 0, Math.PI, 0); c.lineTo(r * 1.05, r * 1.15); c.lineTo(-r * 1.05, r * 1.15); c.fill();
    if (id === 'kevin') { c.fillStyle = L.shirt2; for (let i = 0; i < 2; i++) c.fillRect(-r * 1.0, r * (0.62 + i * 0.22), r * 2, r * 0.08); }
  }
  // back hair (behind head)
  c.fillStyle = L.hair;
  if (id === 'mom') { for (let i = 0; i < 11; i++) { const a = Math.PI * (0.95 + i * 0.11); c.beginPath(); c.arc(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.9 + r * 0.05, r * 0.42, 0, 7); c.fill(); } for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * r * 0.95, r * 0.35, r * 0.4, 0, 7); c.fill(); } }
  if (id === 'tina') { c.beginPath(); c.ellipse(r * 1.05, -r * 0.1, r * 0.35, r * 0.75, 0.5, 0, 7); c.fill(); c.fillStyle = '#7fd3d0'; c.beginPath(); c.arc(r * 0.82, -r * 0.62, r * 0.2, 0, 7); c.fill(); c.fillStyle = L.hair; }
  if (id === 'jo') { for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(sx * r * 1.05, r * 0.05, r * 0.3, r * 0.42, sx * 0.4, 0, 7); c.fill(); } c.fillStyle = '#e8506a'; for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * r * 0.88, -r * 0.3, r * 0.14, 0, 7); c.fill(); } c.fillStyle = L.hair; }
  // head
  c.fillStyle = mood === 'green' ? '#b9c98d' : L.skin;
  c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
  c.strokeStyle = 'rgba(60,30,15,.35)'; c.lineWidth = r * 0.06; c.stroke();
  // hair on top
  c.fillStyle = L.hair;
  if (id === 'dad') { c.beginPath(); c.arc(0, -r * 0.1, r * 1.0, Math.PI * 1.08, Math.PI * 1.92); c.quadraticCurveTo(0, -r * 0.55, -r * 0.93, -r * 0.45); c.fill(); }
  if (id === 'mom') { c.beginPath(); c.arc(0, -r * 0.05, r * 1.02, Math.PI * 1.05, Math.PI * 1.95); c.quadraticCurveTo(r * 0.3, -r * 0.35, 0, -r * 0.5); c.quadraticCurveTo(-r * 0.4, -r * 0.3, -r * 0.98, -r * 0.3); c.fill(); }
  if (id === 'tina') { c.beginPath(); c.arc(0, -r * 0.05, r * 1.02, Math.PI * 1.0, Math.PI * 1.95); c.quadraticCurveTo(-r * 0.1, -r * 0.6, -r * 1.0, r * 0.15); c.fill(); }
  if (id === 'kevin') {
    c.fillStyle = '#c8372d'; c.beginPath(); c.arc(0, -r * 0.18, r * 0.98, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); c.fill();
    c.beginPath(); c.ellipse(0, -r * 0.42, r * 1.0, r * 0.22, 0, 0, Math.PI); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -r * 0.72, r * 0.16, 0, 7); c.fill();
  }
  if (id === 'jo') { c.beginPath(); c.arc(0, -r * 0.08, r * 1.0, Math.PI * 1.08, Math.PI * 1.92); c.quadraticCurveTo(0, -r * 0.4, -r * 0.93, -r * 0.4); c.fill(); }
  // face
  const ey = r * 0.08, ex = r * 0.36;
  c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = r * 0.1; c.lineCap = 'round';
  if (mood === 'asleep') { for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * ex, ey, r * 0.13, 0.2, Math.PI - 0.2); c.stroke(); } }
  else if (id === 'dad' && !opts.noShades) {
    c.fillStyle = '#2a2a30'; for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(sx * ex, ey, r * 0.27, r * 0.21, 0, 0, 7); c.fill(); }
    c.fillRect(-ex, ey - r * 0.04, ex * 2, r * 0.06);
    c.fillStyle = 'rgba(255,255,255,.4)'; for (const sx of [-1, 1]) c.fillRect(sx * ex - r * 0.15, ey - r * 0.1, r * 0.08, r * 0.08);
  } else {
    const er = r * (mood === 'yell' ? 0.13 : 0.1);
    for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * ex, ey, er, 0, 7); c.fill(); }
    if (mood === 'cross' || mood === 'yell') { for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * (ex + r * 0.2), ey - r * 0.3); c.lineTo(sx * (ex - r * 0.15), ey - r * 0.18); c.stroke(); } }
  }
  if (id === 'mom' || id === 'tina') { c.fillStyle = 'rgba(220,90,90,.25)'; for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * r * 0.55, r * 0.35, r * 0.15, 0, 7); c.fill(); } }
  // mouth
  c.strokeStyle = INK; c.lineWidth = r * 0.09;
  const my = r * 0.45;
  c.beginPath();
  if (mood === 'happy') c.arc(0, my - r * 0.12, r * 0.28, 0.25, Math.PI - 0.25);
  else if (mood === 'ok') c.arc(0, my - r * 0.25, r * 0.3, 0.6, Math.PI - 0.6);
  else if (mood === 'meh') { c.moveTo(-r * 0.2, my); c.lineTo(r * 0.2, my); }
  else if (mood === 'cross' || mood === 'green') c.arc(0, my + r * 0.18, r * 0.24, Math.PI + 0.5, -0.5);
  else if (mood === 'yell') { c.fillStyle = '#5a1e1e'; c.ellipse(0, my, r * 0.2, r * 0.17, 0, 0, 7); c.fill(); }
  else if (mood === 'asleep') { c.arc(0, my, r * 0.08, 0, 7); }
  c.stroke();
  if (id === 'dad') { c.fillStyle = L.hair; c.beginPath(); c.ellipse(0, my - r * 0.14, r * 0.34, r * 0.1, 0, 0, 7); c.fill(); }
  c.restore();
}

// ---------------------------------------------------------------- speech bubbles
export function bubble(c, x, y, text, size, kind, t) {
  c.save();
  c.font = `${size}px ${HAND}`;
  const w = c.measureText(text).width + size * 0.9, h = size * 1.35;
  const wob = kind === 'bad' ? Math.sin(t * 22) * size * 0.06 : 0;
  const bx = x - w / 2 + wob, by = y - h;
  c.fillStyle = kind === 'bad' ? '#fff3d6' : '#fffdf6';
  c.strokeStyle = kind === 'bad' ? RED : INK; c.lineWidth = Math.max(1.2, size * 0.09);
  c.beginPath(); c.roundRect(bx, by, w, h, h * 0.45);
  c.moveTo(x - size * 0.25, by + h - 0.5); c.lineTo(x - size * 0.05, by + h + size * 0.45); c.lineTo(x + size * 0.2, by + h - 0.5);
  c.fill(); c.stroke();
  c.fillStyle = kind === 'bad' ? RED : INK; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, x + wob, by + h * 0.55);
  c.restore();
}

// ---------------------------------------------------------------- the road
export function drawRoad(c, w, h, scroll, region, road, t, props, extras = {}) {
  const R = REGIONS[region];
  const rw = extras.rw, cx = extras.cx;
  c.fillStyle = R.ground; c.fillRect(0, 0, w, h);
  // field texture: soft stripes that scroll
  c.fillStyle = R.ground2;
  const band = 46;
  for (let y = -band * 2 + (scroll * 0.999 % (band * 2)); y < h; y += band * 2) c.fillRect(0, y, w, band * 0.5);
  // shoulders
  c.fillStyle = road === 'dirt' ? '#a07a50' : R.edge; c.fillRect(cx - rw / 2 - 14, 0, rw + 28, h);
  c.fillStyle = road === 'dirt' ? '#b8915e' : '#6b6560'; c.fillRect(cx - rw / 2, 0, rw, h);
  if (road !== 'dirt') {
    // asphalt speckle
    c.fillStyle = 'rgba(255,255,255,.05)';
    for (let i = 0; i < 40; i++) { const yy = ((i * 97 + scroll) % (h + 20)) - 10; c.fillRect(cx - rw / 2 + ((i * 53) % rw), yy, 2, 2); }
    c.fillStyle = '#efe6cf'; c.fillRect(cx - rw / 2 + 5, 0, 2.5, h); c.fillRect(cx + rw / 2 - 7.5, 0, 2.5, h);
    const dash = 34, gap = 30;
    c.fillStyle = road === 'interstate' ? '#efe6cf' : '#e8b83a';
    const off = scroll % (dash + gap);
    if (road === 'interstate') {
      for (const lx of [cx - rw / 6, cx + rw / 6]) for (let y = -dash + off - (dash + gap); y < h; y += dash + gap) c.fillRect(lx - 1.5, y, 3, dash);
    } else {
      for (let y = -dash + off - (dash + gap); y < h; y += dash + gap) { c.fillRect(cx - 4, y, 3, dash); c.fillRect(cx + 1, y, 3, dash); }
    }
  } else {
    c.strokeStyle = 'rgba(90,60,30,.35)'; c.lineWidth = 6;
    for (const lx of [cx - rw / 4, cx + rw / 4]) { c.beginPath(); c.moveTo(lx, 0); c.lineTo(lx, h); c.stroke(); }
  }
  // roadside props
  for (const pr of props) drawProp(c, pr, cx, rw, scroll, h, t);
  // other traffic
  if (extras.traffic) for (const tr of extras.traffic) drawOtherCar(c, cx + tr.lane * rw, tr.y, Math.min(rw * 0.16, 46), tr.color, tr.dir);
  return { cx, rw };
}

function drawProp(c, pr, cx, rw, scroll, h, t) {
  const y = ((pr.y + scroll) % (h + 400)) - 200;
  const side = pr.side, x = side < 0 ? cx - rw / 2 - 30 - pr.off : cx + rw / 2 + 30 + pr.off;
  c.save(); c.translate(x, y);
  const k = pr.k;
  switch (pr.kind) {
    case 'pole':
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-2, 0, 24 * k, 4);
      c.fillStyle = '#6a4a2e'; c.beginPath(); c.arc(0, 0, 4 * k, 0, 7); c.fill();
      c.fillStyle = '#4c3520'; c.fillRect(-14 * k, -2, 28 * k, 4);
      break;
    case 'cactus':
      c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.ellipse(6, 6, 14 * k, 6 * k, 0.4, 0, 7); c.fill();
      c.fillStyle = '#5f8a4a'; c.beginPath(); c.arc(0, 0, 9 * k, 0, 7); c.fill();
      c.beginPath(); c.arc(-11 * k, -3 * k, 5 * k, 0, 7); c.arc(10 * k, 3 * k, 5 * k, 0, 7); c.fill();
      c.strokeStyle = '#3e6332'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 5 * k, 0, 7); c.stroke();
      break;
    case 'rock':
      c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(5, 5, 16 * k, 10 * k, 0, 0, 7); c.fill();
      c.fillStyle = '#a18466'; c.beginPath(); c.moveTo(-14 * k, 2); c.lineTo(-6 * k, -11 * k); c.lineTo(10 * k, -8 * k); c.lineTo(15 * k, 5 * k); c.lineTo(0, 10 * k); c.fill();
      break;
    case 'pine':
      c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.arc(8, 8, 18 * k, 0, 7); c.fill();
      for (let i = 0; i < 3; i++) { c.fillStyle = ['#2f4b33', '#3a5c3d', '#4a7049'][i]; c.beginPath(); for (let a = 0; a < 16; a++) { const rr2 = (a % 2 ? 0.7 : 1) * (18 - i * 5) * k; c.lineTo(Math.cos(a * Math.PI / 8) * rr2, Math.sin(a * Math.PI / 8) * rr2); } c.fill(); }
      break;
    case 'orchard':
      for (let j = 0; j < 3; j++) { c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.arc(4 + j * 34 * side, 4, 13 * k, 0, 7); c.fill(); c.fillStyle = '#5d7d3a'; c.beginPath(); c.arc(j * 34 * side, 0, 13 * k, 0, 7); c.fill(); c.fillStyle = '#7d9b4a'; c.beginPath(); c.arc(j * 34 * side - 3, -3, 7 * k, 0, 7); c.fill(); }
      break;
    case 'silo':
      c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.arc(10, 10, 20 * k, 0, 7); c.fill();
      c.fillStyle = '#c9c4b8'; c.beginPath(); c.arc(0, 0, 20 * k, 0, 7); c.fill();
      c.strokeStyle = '#8f8a80'; c.lineWidth = 1; for (let i = 1; i < 4; i++) { c.beginPath(); c.arc(0, 0, i * 5 * k, 0, 7); c.stroke(); }
      c.fillStyle = '#9b3b2b'; c.fillRect(24 * k * side - (side < 0 ? 26 * k : 0), -14 * k, 26 * k, 30 * k);
      break;
    case 'cornrow':
      c.strokeStyle = '#8fa046'; c.lineWidth = 3;
      for (let j = 0; j < 5; j++) { c.beginPath(); c.moveTo(j * 10 * side, -40); c.lineTo(j * 10 * side, 40); c.stroke(); }
      break;
    case 'fruitstand':
      c.fillStyle = '#e2dccb'; c.fillRect(-18, -10, 36, 20); c.fillStyle = RED; for (let i = 0; i < 6; i++) c.fillRect(-18 + i * 6, -10, 3, 20);
      c.fillStyle = '#e88a2a'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(-14 + i * 7, 15, 3, 0, 7); c.fill(); }
      break;
    case 'billboard': {
      const bw = 96, bh = 40;
      c.rotate(side * 0.06);
      c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(-bw / 2 + 6, -bh / 2 + 8, bw, bh);
      c.fillStyle = '#4a3a2a'; c.fillRect(-bw / 3, bh / 2 - 2, 4, 10); c.fillRect(bw / 3 - 4, bh / 2 - 2, 4, 10);
      c.fillStyle = pr.color; c.fillRect(-bw / 2, -bh / 2, bw, bh);
      c.strokeStyle = '#f6efdc'; c.lineWidth = 2; c.strokeRect(-bw / 2 + 3, -bh / 2 + 3, bw - 6, bh - 6);
      c.fillStyle = '#f6efdc'; c.font = `800 10px ${SIGN}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      wrapText(c, pr.text, 0, 0, bw - 12, 11);
      break;
    }
  }
  c.restore();
}

export function wrapText(c, text, x, y, maxW, lh) {
  const words = text.split(' '), lines = [];
  let line = '';
  for (const w of words) { const tst = line ? line + ' ' + w : w; if (c.measureText(tst).width > maxW && line) { lines.push(line); line = w; } else line = tst; }
  lines.push(line);
  const y0 = y - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => c.fillText(l, x, y0 + i * lh));
}

export function makeProps(region, r) {
  const R = REGIONS[region], out = [];
  const bbColors = ['#b8452f', '#2f6e8e', '#3d7a4a', '#c78a2a', '#6a4a8a'];
  for (let i = 0; i < 16; i++) {
    const kind = R.props[Math.floor(r() * R.props.length)];
    out.push({ kind, side: r() < 0.5 ? -1 : 1, y: i * 95 + r() * 60, off: r() * 40, k: 0.8 + r() * 0.5,
      text: BILLBOARDS[Math.floor(r() * BILLBOARDS.length)], color: bbColors[Math.floor(r() * bbColors.length)] });
  }
  return out;
}

function drawOtherCar(c, x, y, w, color, dir) {
  const h = w * 2;
  c.save(); c.translate(x, y); if (dir < 0) c.rotate(Math.PI);
  c.fillStyle = 'rgba(0,0,0,.22)'; rr(c, -w / 2 + 3, -h / 2 + 4, w, h, w * 0.25); c.fill();
  c.fillStyle = color; rr(c, -w / 2, -h / 2, w, h, w * 0.25); c.fill();
  c.fillStyle = '#9fc4c9'; rr(c, -w * 0.38, -h * 0.22, w * 0.76, h * 0.14, 2); c.fill(); rr(c, -w * 0.36, h * 0.25, w * 0.72, h * 0.1, 2); c.fill();
  c.fillStyle = 'rgba(0,0,0,.12)'; rr(c, -w * 0.38, -h * 0.07, w * 0.76, h * 0.3, 3); c.fill();
  c.restore();
}

// ---------------------------------------------------------------- places you stop at (beside the parked car)
export function drawPlace(c, w, h, cx, rw, type, name, t) {
  const x = cx + rw / 2 + 24, bw = Math.max(80, w - x - 10);
  c.save();
  if (type === 'gas' || type === 'motel' || type === 'diner') {
    // building roof, top-down
    c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x + 10, h * 0.18 + 10, bw, h * 0.5);
    c.fillStyle = type === 'gas' ? '#e9e2cf' : type === 'diner' ? '#d6d2c4' : '#c7b089'; c.fillRect(x, h * 0.18, bw, h * 0.5);
    c.strokeStyle = 'rgba(0,0,0,.15)'; c.lineWidth = 1; for (let y = h * 0.18; y < h * 0.68; y += 8) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + bw, y); c.stroke(); }
    c.fillStyle = type === 'gas' ? RED : type === 'diner' ? '#2f8a87' : '#d9a43a'; c.fillRect(x, h * 0.18, 8, h * 0.5);
  }
  if (type === 'gas') { for (let i = 0; i < 2; i++) { c.fillStyle = '#e2dccb'; c.fillRect(cx + rw / 2 - 30, h * 0.35 + i * 60, 18, 26); c.fillStyle = RED; c.fillRect(cx + rw / 2 - 30, h * 0.35 + i * 60, 18, 8); } }
  if (type === 'summit') {
    c.fillStyle = '#e8eef0'; c.beginPath(); c.moveTo(x - 10, h * 0.7); c.lineTo(x + bw * 0.4, h * 0.15); c.lineTo(x + bw, h * 0.6); c.fill();
  }
  if (type === 'attraction') { c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.arc(x + bw / 2 + 10, h * 0.42 + 10, Math.min(bw, h) * 0.32, 0, 7); c.fill(); c.fillStyle = '#c8604a'; c.beginPath(); c.arc(x + bw / 2, h * 0.42, Math.min(bw, h) * 0.32, 0, 7); c.fill(); c.strokeStyle = '#e8b89a'; c.lineWidth = 2; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(x + bw / 2, h * 0.42, Math.min(bw, h) * 0.32 * (i / 7), i, i + 3); c.stroke(); } }
  c.restore();
}

// ---------------------------------------------------------------- engine bay (breakdowns)
export const BAY_W = 100, BAY_H = 100;
export const FIX_POS = { radiator: [50, 13], battery: [19, 38], belt: [50, 46], hose: [81, 40], tire: [14, 82] };

export function drawBay(c, problems, t) {
  c.save();
  // car front, bonnet up
  c.fillStyle = 'rgba(0,0,0,.25)'; rr(c, 4, 6, 92, 96, 12); c.fill();
  c.fillStyle = '#c9a77a'; rr(c, 0, 0, 100, 96, 12); c.fill(); c.strokeStyle = '#5c3f26'; c.lineWidth = 1; c.stroke();
  c.fillStyle = '#2d2724'; rr(c, 8, 6, 84, 64, 6); c.fill();
  // engine block
  c.fillStyle = '#5a5552'; rr(c, 30, 26, 40, 34, 4); c.fill();
  c.fillStyle = '#6e6966'; for (let i = 0; i < 4; i++) rr(c, 34 + i * 9, 30, 6, 26, 2), c.fill();
  c.fillStyle = '#a03a2a'; rr(c, 40, 21, 20, 8, 3); c.fill(); // air filter lid
  // radiator
  c.fillStyle = '#7a7672'; c.fillRect(14, 8, 72, 10);
  c.strokeStyle = '#4a4744'; c.lineWidth = 0.6; for (let x = 16; x < 86; x += 2.5) { c.beginPath(); c.moveTo(x, 8); c.lineTo(x, 18); c.stroke(); }
  // battery
  c.fillStyle = '#1e1e22'; rr(c, 11, 31, 16, 14, 2); c.fill(); c.fillStyle = RED; c.fillRect(13, 29, 4, 3); c.fillStyle = '#ddd'; c.fillRect(21, 29, 4, 3);
  // belt
  c.strokeStyle = '#151210'; c.lineWidth = 1.6; c.beginPath(); c.arc(44, 46, 5, 0, 7); c.stroke(); c.beginPath(); c.arc(57, 50, 3.5, 0, 7); c.stroke();
  // hose
  c.strokeStyle = '#2a2826'; c.lineWidth = 3.2; c.beginPath(); c.moveTo(70, 20); c.bezierCurveTo(90, 26, 74, 48, 86, 58); c.stroke();
  // fender + wheel
  c.fillStyle = '#1e1a18'; rr(c, 2, 72, 22, 22, 4); c.fill(); c.fillStyle = '#9c968c'; c.beginPath(); c.arc(13, 83, 5, 0, 7); c.fill();
  c.fillStyle = '#1e1a18'; rr(c, 76, 72, 22, 22, 4); c.fill(); c.fillStyle = '#9c968c'; c.beginPath(); c.arc(87, 83, 5, 0, 7); c.fill();
  // steam from whatever's still broken
  for (const pr of problems) {
    if (pr.work >= 1) continue;
    const [px, py] = FIX_POS[pr.type];
    if (pr.type === 'radiator' || pr.type === 'hose') for (let i = 0; i < 5; i++) {
      const ph = (t * 0.7 + i / 5) % 1;
      c.fillStyle = `rgba(250,250,245,${0.5 * (1 - ph)})`; c.beginPath(); c.arc(px + Math.sin(i * 3 + t * 2) * 6, py - ph * 22, 3 + ph * 8, 0, 7); c.fill();
    }
    if (pr.type === 'battery' && Math.sin(t * 13) > 0.6) { c.strokeStyle = '#ffe36a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(px - 3, py - 10); c.lineTo(px + 1, py - 6); c.lineTo(px - 2, py - 4); c.lineTo(px + 3, py); c.stroke(); }
    if (pr.type === 'tire') { c.fillStyle = '#1e1a18'; c.beginPath(); c.ellipse(13, 92, 12, 3, 0, 0, 7); c.fill(); }
  }
  c.restore();
}

export function fixIcon(c, type, x, y, s, col = INK) {
  c.save(); c.translate(x, y); c.scale(s / 10, s / 10); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1.6; c.lineCap = 'round'; c.lineJoin = 'round';
  if (type === 'belt') { c.beginPath(); c.arc(-3, 0, 3.5, 0, 7); c.stroke(); c.beginPath(); c.arc(4, 1, 2.2, 0, 7); c.stroke(); c.beginPath(); c.moveTo(-3, -3.5); c.lineTo(4, -1.2); c.moveTo(-3, 3.5); c.lineTo(4, 3.2); c.stroke(); }
  if (type === 'tire') { c.beginPath(); c.arc(0, 0, 5, 0, 7); c.stroke(); c.beginPath(); c.arc(0, 0, 2, 0, 7); c.stroke(); }
  if (type === 'battery') { c.strokeRect(-5, -3, 10, 7); c.fillRect(-4, -5, 2, 2); c.fillRect(2, -5, 2, 2); c.beginPath(); c.moveTo(-3, 0.5); c.lineTo(-1, 0.5); c.moveTo(1, 0.5); c.lineTo(3, 0.5); c.moveTo(2, -0.5); c.lineTo(2, 1.5); c.stroke(); }
  if (type === 'radiator') { c.strokeRect(-5, -4, 10, 8); for (let i = -3; i <= 3; i += 2) { c.beginPath(); c.moveTo(i, -4); c.lineTo(i, 4); c.stroke(); } }
  if (type === 'hose') { c.beginPath(); c.moveTo(-5, -3); c.bezierCurveTo(0, -5, 0, 5, 5, 3); c.stroke(); }
  if (type === 'flash') { c.beginPath(); c.moveTo(-4, -2); c.lineTo(2, -2); c.lineTo(5, -4); c.lineTo(5, 4); c.lineTo(2, 2); c.lineTo(-4, 2); c.closePath(); c.stroke(); }
  c.restore();
}

// ---------------------------------------------------------------- the road atlas
export const MAP_W = 1000, MAP_H = 620;
const ICON = { gas: 'gas', diner: 'diner', attraction: 'star', motel: 'bed', event: 'q', summit: 'peak', home: 'home', grandma: 'home' };

export function drawAtlasBase(c, map, r) {
  // paper
  c.fillStyle = '#f2e7c9'; c.fillRect(0, 0, MAP_W, MAP_H);
  // regions as soft bands with wavy borders
  const bandX = [0, 230, 470, 700, MAP_W];
  const tints = ['#d4dfb0', '#ecd6aa', '#cfcfa2', '#e6e2ad'];
  for (let i = 0; i < 4; i++) {
    c.fillStyle = tints[i]; c.beginPath();
    for (let y = 0; y <= MAP_H; y += 20) c.lineTo(bandX[i] + (i ? Math.sin(y * 0.03 + i) * 12 : 0), y);
    for (let y = MAP_H; y >= 0; y -= 20) c.lineTo(bandX[i + 1] + (i < 3 ? Math.sin(y * 0.03 + i + 1) * 12 : 0), y);
    c.fill();
  }
  // state lines
  c.strokeStyle = 'rgba(120,80,110,.55)'; c.lineWidth = 1.4; c.setLineDash([9, 4, 2, 4]);
  for (let i = 1; i < 4; i++) { c.beginPath(); for (let y = 0; y <= MAP_H; y += 20) c.lineTo(bandX[i] + Math.sin(y * 0.03 + i) * 12, y); c.stroke(); }
  c.setLineDash([]);
  // mountains hatching in the range
  c.strokeStyle = 'rgba(110,90,60,.45)'; c.lineWidth = 1;
  for (let i = 0; i < 60; i++) {
    const x = 485 + r() * 200, y = 20 + r() * 580, s = 6 + r() * 10;
    c.beginPath(); c.moveTo(x - s, y + s * 0.6); c.lineTo(x, y - s * 0.6); c.lineTo(x + s, y + s * 0.6); c.stroke();
    c.beginPath(); c.moveTo(x, y - s * 0.6); c.lineTo(x + s * 0.3, y + s * 0.6); c.stroke();
  }
  // desert stipple
  c.fillStyle = 'rgba(160,110,60,.25)'; for (let i = 0; i < 400; i++) c.fillRect(240 + r() * 220, r() * MAP_H, 1.5, 1.5);
  // rivers
  c.strokeStyle = '#7aa7c2'; c.lineWidth = 2;
  for (const [x0, y0, dx] of [[120, 0, 40], [610, 0, -60], [820, MAP_H, 50]]) {
    c.beginPath(); c.moveTo(x0, y0); let x = x0;
    for (let k = 1; k <= 12; k++) { x += (r() - 0.5) * 40 + dx / 12; c.lineTo(x, y0 === 0 ? k * MAP_H / 12 : MAP_H - k * MAP_H / 12); }
    c.stroke();
  }
  // a lake
  c.fillStyle = '#a9c8d6'; c.beginPath(); c.ellipse(860, 120, 34, 18, 0.3, 0, 7); c.fill();
  // region labels
  c.fillStyle = 'rgba(80,60,50,.33)'; c.font = `800 15px ${SIGN}`; c.textAlign = 'center';
  REGIONS.forEach((R, i) => { const x = (bandX[i] + bandX[i + 1]) / 2; spaced(c, R.name, x, i % 2 ? 600 : 36, 3.5); });
  // grid letters along the edge, like a real atlas
  c.fillStyle = 'rgba(80,60,50,.5)'; c.font = `700 10px ${SIGN}`;
  for (let i = 0; i < 10; i++) { c.fillText(String.fromCharCode(65 + i), 50 + i * 100, 12); }
  for (let j = 0; j < 6; j++) { c.textAlign = 'left'; c.fillText(String(j + 1), 4, 60 + j * 100); }
  // roads
  for (const e of map.edges) {
    const a = map.nodes[e.a], b = map.nodes[e.b];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + (e.road === 'scenic' ? 14 : 0) * Math.sign(b.y - a.y + 0.01);
    c.lineCap = 'round';
    if (e.road === 'interstate') {
      c.strokeStyle = '#6b2a20'; c.lineWidth = 6.5; c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(mx, my, b.x, b.y); c.stroke();
      c.strokeStyle = '#d6503a'; c.lineWidth = 4; c.stroke();
    } else {
      c.strokeStyle = '#3b3633'; c.lineWidth = 2; c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(mx, my, b.x, b.y); c.stroke();
      c.strokeStyle = '#4f8a4a'; c.lineWidth = 5; c.setLineDash([1, 7]); c.globalAlpha = 0.7; c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    }
    e.mid = [mx * 0.5 + (a.x + b.x) / 4, my * 0.5 + (a.y + b.y) / 4];
  }
  for (const e of map.edges) shield(c, e.mid[0], e.mid[1], e.road, e.num);
  // towns
  for (const n of map.nodes) {
    c.fillStyle = '#fff8e6'; c.strokeStyle = INK; c.lineWidth = 1.6;
    c.beginPath(); c.arc(n.x, n.y, n.type === 'home' || n.type === 'grandma' ? 7 : 5.5, 0, 7); c.fill(); c.stroke();
    c.font = `italic 600 12.5px ${SIGN}`; c.fillStyle = INK; c.textAlign = 'center';
    const ly = n.y + (n.i === 0 && n.n > 1 ? -27 : 26);
    c.lineWidth = 3.5; c.strokeStyle = 'rgba(242,231,201,.9)'; c.strokeText(n.town, n.x, ly); c.fillText(n.town, n.x, ly);
    mapIcon(c, ICON[n.type], n.x + 15, n.y - 13, 9.5);
  }
  // legend
  c.save(); c.translate(18, MAP_H - 128);
  c.fillStyle = 'rgba(250,244,226,.92)'; c.strokeStyle = INK; c.lineWidth = 1.2; c.fillRect(0, 0, 150, 112); c.strokeRect(0, 0, 150, 112);
  c.font = `800 10px ${SIGN}`; c.fillStyle = INK; c.textAlign = 'left'; spaced(c, 'LEGEND', 10, 15, 2, 'left');
  c.font = `600 10px ${SIGN}`;
  const L = [['gas', 'Gas • snacks • garage'], ['diner', 'Diner'], ['star', 'Roadside attraction'], ['bed', 'Motel'], ['q', 'Who knows?']];
  L.forEach(([ic, tx], i) => { mapIcon(c, ic, 16, 30 + i * 15, 7); c.fillStyle = INK; c.fillText(tx, 30, 34 + i * 15); });
  c.restore();
  // a coffee ring, because of course
  c.strokeStyle = 'rgba(140,90,40,.18)'; c.lineWidth = 5; c.beginPath(); c.arc(905, 520, 46, 0.3, 5.6); c.stroke();
  c.lineWidth = 2; c.beginPath(); c.arc(905, 520, 40, 2, 6.9); c.stroke();
  // page gutter
  const g = c.createLinearGradient(MAP_W / 2 - 18, 0, MAP_W / 2 + 18, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(60,40,20,.13)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(MAP_W / 2 - 18, 0, 36, MAP_H);
}

function spaced(c, text, x, y, sp, align = 'center') {
  const chars = [...text]; let w = 0; for (const ch of chars) w += c.measureText(ch).width + sp; w -= sp;
  let xx = align === 'center' ? x - w / 2 : x; const prev = c.textAlign; c.textAlign = 'left';
  for (const ch of chars) { c.fillText(ch, xx, y); xx += c.measureText(ch).width + sp; }
  c.textAlign = prev;
}

function shield(c, x, y, road, num) {
  c.save(); c.translate(x, y);
  if (road === 'interstate') {
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-10, -10); c.lineTo(10, -10); c.quadraticCurveTo(12, 4, 0, 11); c.quadraticCurveTo(-12, 4, -10, -10); c.fill();
    c.fillStyle = '#2b4d8c'; c.beginPath(); c.moveTo(-8.5, -5); c.lineTo(8.5, -5); c.quadraticCurveTo(10, 4, 0, 9.3); c.quadraticCurveTo(-10, 4, -8.5, -5); c.fill();
    c.fillStyle = RED; c.fillRect(-8.6, -8.6, 17.2, 3.8);
    c.fillStyle = '#fff'; c.font = `800 8.5px ${SIGN}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(num, 0, 2.2);
  } else {
    c.fillStyle = '#fffaf0'; c.strokeStyle = INK; c.lineWidth = 1; c.fillRect(-9, -7, 18, 14); c.strokeRect(-9, -7, 18, 14);
    c.fillStyle = INK; c.font = `800 8.5px ${SIGN}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(num, 0, 0.5);
  }
  c.restore();
}

export function mapIcon(c, kind, x, y, r) {
  c.save(); c.translate(x, y);
  const bg = { gas: RED, diner: '#2f8a87', star: '#d99a2b', bed: '#4a5f9a', q: '#7a5a8a', peak: '#6a6a5a', home: '#9b4a2b' }[kind] || INK;
  c.fillStyle = bg; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
  c.strokeStyle = '#fff8e6'; c.fillStyle = '#fff8e6'; c.lineWidth = r * 0.16; c.lineCap = 'round'; c.lineJoin = 'round';
  const k = r / 10;
  c.scale(k, k);
  if (kind === 'gas') { c.fillRect(-4, -5, 6, 10); c.beginPath(); c.moveTo(2, -2); c.lineTo(5, 0); c.lineTo(5, 4); c.stroke(); c.fillStyle = bg; c.fillRect(-3, -4, 4, 3); }
  if (kind === 'diner') { c.beginPath(); c.moveTo(-5, -3); c.lineTo(3, -3); c.lineTo(2, 4); c.lineTo(-4, 4); c.closePath(); c.fill(); c.beginPath(); c.arc(4, 0, 2.5, -1.4, 1.4); c.stroke(); }
  if (kind === 'star') { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? 2.6 : 6; c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } c.fill(); }
  if (kind === 'bed') { c.fillRect(-6, 0, 12, 3); c.fillRect(-6, -4, 2, 8); c.fillRect(-3, -3, 4, 3); c.fillRect(4, 2, 2, 3); }
  if (kind === 'q') { c.font = `900 13px ${SIGN}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, 1); }
  if (kind === 'peak') { c.beginPath(); c.moveTo(-6, 4); c.lineTo(-1, -5); c.lineTo(2, 0); c.lineTo(3.5, -2); c.lineTo(6, 4); c.closePath(); c.fill(); }
  if (kind === 'home') { c.beginPath(); c.moveTo(-6, 0); c.lineTo(0, -6); c.lineTo(6, 0); c.lineTo(4, 0); c.lineTo(4, 5); c.lineTo(-4, 5); c.lineTo(-4, 0); c.closePath(); c.fill(); }
  c.restore();
}

// the felt-tip route through everywhere you've been
export function feltLine(c, pts, t, color = 'rgba(200,40,40,.78)', width = 5.5) {
  if (pts.length < 2) return;
  c.save(); c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const n = 8;
    for (let k = 1; k <= n; k++) { const u = k / n; c.lineTo(x0 + (x1 - x0) * u + Math.sin(u * 9 + i) * 1.6, y0 + (y1 - y0) * u + Math.cos(u * 7 + i * 2) * 1.6); }
  }
  c.stroke(); c.restore();
}

export function feltCircle(c, x, y, r, t, color = 'rgba(200,40,40,.85)') {
  c.save(); c.strokeStyle = color; c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath();
  for (let a = 0; a <= Math.PI * 2.15; a += 0.15) { const rr2 = r * (1 + Math.sin(a * 3 + t) * 0.05); c.lineTo(x + Math.cos(a - 0.6) * rr2 * 1.12, y + Math.sin(a - 0.6) * rr2); }
  c.stroke(); c.restore();
}

// the little wagon that marks where you are
export function tinyWagon(c, x, y, s, ang = 0) {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(s / 30, s / 30);
  c.fillStyle = 'rgba(0,0,0,.25)'; rr(c, -14, -6, 30, 14, 4); c.fill();
  c.fillStyle = '#c9a77a'; rr(c, -15, -7, 30, 14, 4); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
  c.fillStyle = '#7b4b28'; c.fillRect(-10, 4, 22, 2.4); c.fillRect(-10, -6.4, 22, 2.4);
  c.fillStyle = '#9fc4c9'; c.fillRect(5, -4.5, 4, 9);
  c.restore();
}

// ---------------------------------------------------------------- snapshots
const SNAP_SKY = { summit: ['#9ec3d8', '#e8eef0'], cave: ['#2a2420', '#4a3a30'], grandma: ['#f2c78a', '#f7e2b8'] };
export function drawSnapshot(c, key, w, h, seed = 1) {
  let a = seed * 9301 + 49297; const r = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
  const sky = SNAP_SKY[key] || ['#8fb8cf', '#f2dfb6'];
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, sky[0]); g.addColorStop(0.62, sky[1]); c.fillStyle = g; c.fillRect(0, 0, w, h);
  const gy = h * 0.66;
  c.fillStyle = key === 'cave' ? '#3a2e26' : key === 'summit' ? '#7d8a5c' : '#c9b46a'; c.fillRect(0, gy, w, h - gy);
  c.save(); c.translate(w / 2, gy);
  const S = h / 100;
  c.scale(S, S);
  const subj = {
    twine: () => { c.fillStyle = '#c9a874'; c.beginPath(); c.arc(0, -30, 30, 0, 7); c.fill(); c.strokeStyle = '#9a7a4a'; c.lineWidth = 1.2; for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse(0, -30, 30, 30 * Math.abs(Math.cos(i * 0.4)), i * 0.4, 0, 7); c.stroke(); } },
    dino: () => { c.fillStyle = '#6f8f5a'; c.beginPath(); c.ellipse(5, -24, 30, 14, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(-18, -30); c.quadraticCurveTo(-30, -70, -45, -66); c.lineTo(-46, -58); c.quadraticCurveTo(-34, -60, -26, -24); c.fill(); c.fillRect(-12, -14, 7, 14); c.fillRect(16, -14, 7, 14); c.beginPath(); c.moveTo(33, -26); c.quadraticCurveTo(55, -20, 62, -6); c.lineTo(34, -18); c.fill(); },
    vortex: () => { c.save(); c.rotate(-0.25); c.fillStyle = '#7a5236'; c.fillRect(-26, -46, 52, 46); c.fillStyle = '#5a3a24'; c.beginPath(); c.moveTo(-32, -46); c.lineTo(0, -66); c.lineTo(32, -46); c.fill(); c.fillStyle = '#2a1e18'; c.fillRect(-6, -24, 12, 24); c.restore(); },
    cow: () => { c.fillStyle = '#f3ede0'; c.beginPath(); c.ellipse(0, -40, 34, 18, 0, 0, 7); c.fill(); c.fillStyle = '#2a2420'; c.beginPath(); c.ellipse(-10, -44, 9, 6, 0.4, 0, 7); c.fill(); c.beginPath(); c.ellipse(14, -36, 7, 5, 0, 0, 7); c.fill(); c.fillStyle = '#f3ede0'; for (const x of [-24, -12, 12, 24]) c.fillRect(x - 3, -26, 6, 26); c.beginPath(); c.ellipse(-40, -50, 11, 9, 0, 0, 7); c.fill(); c.fillStyle = '#e7a9a0'; c.beginPath(); c.ellipse(-46, -46, 6, 4, 0, 0, 7); c.fill(); },
    snake: () => { c.strokeStyle = '#6a8a2a'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(-50, -20); c.bezierCurveTo(-20, -60, 10, 10, 50, -30); c.stroke(); c.fillStyle = '#e8d8a0'; c.fillRect(-60, -6, 120, 6); },
    cave: () => { c.fillStyle = '#1a1512'; c.beginPath(); c.ellipse(0, -10, 50, 40, 0, Math.PI, 0); c.fill(); c.fillStyle = '#9ad0d8'; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-40 + i * 16, -48 + (i % 2) * 6); c.lineTo(-36 + i * 16, -30); c.lineTo(-44 + i * 16, -30); c.fill(); } },
    prairie: () => { c.fillStyle = '#a07a50'; for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(-50 + i * 20, -2, 7, 3, 0, 0, 7); c.fill(); } c.fillStyle = '#b48a5a'; c.beginPath(); c.ellipse(-10, -10, 4, 8, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(30, -10, 4, 8, 0, 0, 7); c.fill(); },
    teapot: () => { c.fillStyle = '#e8e0cc'; c.beginPath(); c.ellipse(0, -28, 30, 26, 0, 0, 7); c.fill(); c.fillStyle = '#c8372d'; c.fillRect(-32, -36, 64, 6); c.strokeStyle = '#e8e0cc'; c.lineWidth = 6; c.beginPath(); c.arc(34, -28, 12, -1.2, 1.2); c.stroke(); c.beginPath(); c.moveTo(-28, -30); c.lineTo(-48, -46); c.stroke(); c.fillStyle = '#e8e0cc'; c.beginPath(); c.arc(0, -56, 6, 0, 7); c.fill(); },
    guitar: () => { c.fillStyle = '#b8653a'; c.beginPath(); c.ellipse(30, -18, 12, 15, 0.3, 0, 7); c.fill(); c.fillStyle = '#4a3020'; c.save(); c.rotate(0.3); c.fillRect(30, -60, 4, 40); c.restore(); c.fillStyle = '#6b3d2e'; c.beginPath(); c.arc(42, -58, 9, 0, 7); c.fill(); },
    pie: () => { c.fillStyle = '#d9a46a'; c.beginPath(); c.ellipse(0, -14, 34, 10, 0, 0, 7); c.fill(); c.fillStyle = '#b8302a'; c.beginPath(); c.ellipse(0, -16, 28, 7, 0, 0, 7); c.fill(); c.fillStyle = '#d9a46a'; for (let i = -2; i <= 2; i++) c.fillRect(i * 10 - 2, -22, 4, 12); c.fillStyle = '#e8c23a'; c.beginPath(); c.arc(40, -40, 9, 0, 7); c.fill(); c.fillStyle = '#c8372d'; c.fillRect(37, -32, 6, 14); },
    ray: () => { c.fillStyle = '#5aa6c8'; c.beginPath(); c.ellipse(0, -8, 48, 10, 0, 0, 7); c.fill(); c.strokeStyle = '#d8d0c0'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#4a9a3a'; c.beginPath(); c.arc(40, -46, 6, 0, 7); c.fill(); },
    fortune: () => { c.fillStyle = '#7a2a4a'; c.fillRect(-22, -70, 44, 70); c.fillStyle = '#e8d8a0'; c.fillRect(-16, -62, 32, 30); c.fillStyle = '#d9a46a'; c.beginPath(); c.arc(0, -46, 8, 0, 7); c.fill(); c.fillStyle = '#c8372d'; c.fillRect(-9, -56, 18, 5); },
    summit: () => { c.fillStyle = '#5f6e48'; c.beginPath(); c.moveTo(-90, 0); c.lineTo(-40, -60); c.lineTo(-10, -30); c.lineTo(30, -75); c.lineTo(90, 0); c.fill(); c.fillStyle = '#f2f2ee'; c.beginPath(); c.moveTo(30, -75); c.lineTo(20, -63); c.lineTo(38, -62); c.fill(); c.beginPath(); c.moveTo(-40, -60); c.lineTo(-48, -50); c.lineTo(-32, -50); c.fill(); },
    grandma: () => { c.fillStyle = '#f2ece0'; c.fillRect(-40, -50, 80, 50); c.fillStyle = '#9b4a2b'; c.beginPath(); c.moveTo(-46, -50); c.lineTo(0, -78); c.lineTo(46, -50); c.fill(); c.fillStyle = '#6a8fae'; c.fillRect(-28, -38, 14, 14); c.fillRect(14, -38, 14, 14); c.fillStyle = '#f6efe4'; c.fillRect(-14, -14, 28, 12); c.fillStyle = '#e8506a'; c.fillRect(-14, -18, 28, 4); c.fillStyle = '#f3d06a'; for (let i = -2; i <= 2; i++) c.fillRect(i * 5 - 0.5, -24, 1.5, 6); },
  }[key];
  if (subj) subj();
  c.restore();
  // the family lined up in front
  const ids = key === 'fortune' || key === 'snake' ? ['tina', 'jo', 'kevin'] : ['dad', 'mom', 'tina', 'kevin', 'jo'];
  const pr = h * 0.095;
  ids.forEach((id, i) => {
    const x = w * (0.5 + (i - (ids.length - 1) / 2) * 0.16) + (r() - 0.5) * 6;
    drawPerson(c, id, x, h * 0.82 + (id === 'jo' || id === 'kevin' ? pr * 0.4 : 0), pr * (id === 'jo' ? 0.85 : 1), 'happy', 0, { noShades: r() < 0.3 });
  });
  if (key === 'grandma') drawGrandma(c, w * 0.5 + w * 0.36, h * 0.8, pr * 1.05);
}

function drawGrandma(c, x, y, r) {
  c.save(); c.translate(x, y);
  c.fillStyle = '#8a6aa8'; c.beginPath(); c.ellipse(0, r * 0.95, r * 1.05, r * 0.6, 0, Math.PI, 0); c.fill();
  c.fillStyle = '#d8d4cc'; for (let i = 0; i < 9; i++) { const a = Math.PI * (1 + i / 8); c.beginPath(); c.arc(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r * 0.35, 0, 7); c.fill(); }
  c.fillStyle = '#efc8a8'; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
  c.fillStyle = '#d8d4cc'; c.beginPath(); c.arc(0, -r * 0.1, r * 0.98, Math.PI * 1.1, Math.PI * 1.9); c.fill();
  c.strokeStyle = INK; c.lineWidth = r * 0.07; for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * r * 0.36, r * 0.08, r * 0.2, 0, 7); c.stroke(); }
  c.beginPath(); c.arc(0, r * 0.3, r * 0.28, 0.3, Math.PI - 0.3); c.stroke();
  c.restore();
}

// ---------------------------------------------------------------- photo treatment
let grainCanvas = null;
export function grain() {
  if (grainCanvas) return grainCanvas;
  grainCanvas = document.createElement('canvas'); grainCanvas.width = grainCanvas.height = 256;
  const g = grainCanvas.getContext('2d'), id = g.createImageData(256, 256);
  for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 90; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  g.putImageData(id, 0, 0);
  return grainCanvas;
}

export function photoFinish(c, w, h, t) {
  c.save();
  // warm faded cast
  c.globalCompositeOperation = 'soft-light'; c.fillStyle = 'rgba(255,190,120,.55)'; c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'screen'; c.fillStyle = 'rgba(60,40,70,.12)'; c.fillRect(0, 0, w, h);
  // grain
  c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.16;
  const gp = c.createPattern(grain(), 'repeat'); c.fillStyle = gp; c.translate((t * 977) % 256, (t * 613) % 256); c.fillRect(-256, -256, w + 512, h + 512);
  c.restore();
  // vignette
  c.save();
  const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(60,30,10,.38)');
  c.fillStyle = v; c.fillRect(0, 0, w, h);
  c.restore();
}

export { TAPES };
