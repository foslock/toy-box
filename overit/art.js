// Playfield art: each table painted like a 1990s arcade playfield, plus the moving parts on top.
import { W, H, R, arc, flipperTip } from './engine.js';
import { drawText, textWidth } from './font.js';

export const THEMES = {
  space:   { bg: ['#120c33', '#2c1660', '#0a0820'], ink: '#05040f', acc: '#ff8a2a', acc2: '#3fd0ff', cap: '#ff4f7a', rubber: '#ff4040', plastic: 'rgba(63,208,255,0.55)' },
  sea:     { bg: ['#06323f', '#0b5a6b', '#03202b'], ink: '#021318', acc: '#ffd23f', acc2: '#5ff0d0', cap: '#ff7ab8', rubber: '#ffd23f', plastic: 'rgba(95,240,208,0.5)' },
  west:    { bg: ['#ffb347', '#d9532b', '#5a1e14'], ink: '#2a0d08', acc: '#fff1c1', acc2: '#3a8fd6', cap: '#2d6fb8', rubber: '#1a1a1a', plastic: 'rgba(255,241,193,0.5)' },
  circus:  { bg: ['#b5172b', '#e8c27a', '#6b0f1c'], ink: '#2a0509', acc: '#ffe14d', acc2: '#2fb3ff', cap: '#2fb3ff', rubber: '#ffe14d', plastic: 'rgba(255,225,77,0.5)' },
  robot:   { bg: ['#2b3a4a', '#4f6478', '#18222c'], ink: '#0b1016', acc: '#ffcf1a', acc2: '#ff4b2b', cap: '#ff4b2b', rubber: '#ffcf1a', plastic: 'rgba(255,207,26,0.45)' },
  haunted: { bg: ['#0f2216', '#2a3d2a', '#070f0a'], ink: '#030805', acc: '#b6ff5a', acc2: '#c27bff', cap: '#8f4dff', rubber: '#b6ff5a', plastic: 'rgba(194,123,255,0.5)' },
  volcano: { bg: ['#2a0a06', '#5c1608', '#120302'], ink: '#0a0201', acc: '#ffb21a', acc2: '#ff4a1a', cap: '#ff7a1a', rubber: '#ff4a1a', plastic: 'rgba(255,122,26,0.5)' },
  temple:  { bg: ['#1f3b1a', '#4a6b2a', '#0e1d0c'], ink: '#071005', acc: '#ffd86b', acc2: '#3fe0a0', cap: '#d9a43a', rubber: '#c0392b', plastic: 'rgba(255,216,107,0.45)' },
  ice:     { bg: ['#cfefff', '#7cc4ef', '#2f6f9f'], ink: '#123049', acc: '#ffffff', acc2: '#2b7fff', cap: '#7ad8ff', rubber: '#2b7fff', plastic: 'rgba(255,255,255,0.55)' },
  storm:   { bg: ['#1b2230', '#3a4660', '#0b0f17'], ink: '#05070b', acc: '#fff36b', acc2: '#8ad0ff', cap: '#8ad0ff', rubber: '#fff36b', plastic: 'rgba(138,208,255,0.45)' },
};

function playfieldPath(c, t) {
  const cl = t.corner.l, cr = t.corner.r;
  c.beginPath();
  c.moveTo(0, 470);
  if (cl > 0) { c.lineTo(0, cl); c.arc(cl, cl, cl, Math.PI, Math.PI * 1.5); } else c.lineTo(0, 0);
  if (cr > 0) { c.lineTo(W - cr, 0); c.arc(W - cr, cr, cr, -Math.PI / 2, 0); } else c.lineTo(W, 0);
  c.lineTo(W, 470); c.lineTo(W - 108, 549); c.lineTo(W - 108, H + 40); c.lineTo(108, H + 40); c.lineTo(108, 549);
  c.closePath();
}

function hash(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

// ---- scenery, painted under everything ------------------------------------------------------
const SCENERY = {
  space(c, th) {
    for (let i = 0; i < 160; i++) {
      const x = hash(i) * W, y = hash(i + 500) * 520, r = hash(i + 900) * 1.3 + 0.3;
      c.fillStyle = `rgba(255,255,255,${0.3 + hash(i + 77) * 0.6})`;
      c.fillRect(x, y, r, r);
    }
    // ringed planet
    c.save(); c.translate(262, 330);
    let g = c.createRadialGradient(-14, -14, 4, 0, 0, 56);
    g.addColorStop(0, '#ffb35c'); g.addColorStop(0.7, '#c2410c'); g.addColorStop(1, '#4a1203');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 52, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,220,160,0.75)'; c.lineWidth = 5;
    c.beginPath(); c.ellipse(0, 0, 92, 18, -0.35, 0.15, Math.PI - 0.15, true); c.stroke();
    c.restore();
    // rocket
    c.save(); c.translate(84, 330); c.rotate(-0.5);
    c.fillStyle = '#e8e2d0'; c.beginPath(); c.moveTo(0, -46); c.quadraticCurveTo(18, -20, 14, 26); c.lineTo(-14, 26); c.quadraticCurveTo(-18, -20, 0, -46); c.fill();
    c.fillStyle = th.cap; c.beginPath(); c.moveTo(-14, 10); c.lineTo(-26, 34); c.lineTo(-12, 26); c.fill(); c.beginPath(); c.moveTo(14, 10); c.lineTo(26, 34); c.lineTo(12, 26); c.fill();
    c.fillStyle = th.acc2; c.beginPath(); c.arc(0, -12, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = th.acc; c.beginPath(); c.moveTo(-9, 28); c.lineTo(0, 54); c.lineTo(9, 28); c.fill();
    c.restore();
  },
  sea(c, th) {
    c.save();
    c.globalAlpha = 0.18; c.fillStyle = '#bff8ff';
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(30 + i * 60, 0); c.lineTo(70 + i * 60, 0); c.lineTo(10 + i * 70, 520); c.lineTo(-20 + i * 70, 520); c.fill(); }
    c.restore();
    c.fillStyle = 'rgba(2,30,24,0.65)';
    for (let k = 0; k < 9; k++) {
      const x = 20 + k * 42; c.beginPath(); c.moveTo(x, 470);
      for (let y = 470; y > 250 + hash(k) * 80; y -= 20) c.lineTo(x + Math.sin(y * 0.05 + k) * 10, y);
      c.lineTo(x + 8, 470); c.fill();
    }
    c.strokeStyle = 'rgba(220,255,255,0.35)'; c.lineWidth = 1.2;
    for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(hash(i) * W, hash(i + 40) * 460, 1.5 + hash(i + 80) * 4, 0, Math.PI * 2); c.stroke(); }
    // a big fish silhouette
    c.fillStyle = 'rgba(0,20,30,0.45)';
    c.beginPath(); c.ellipse(190, 380, 70, 26, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(250, 380); c.lineTo(290, 352); c.lineTo(290, 408); c.fill();
  },
  west(c, th) {
    c.fillStyle = '#fff1c1'; c.beginPath(); c.arc(180, 300, 70, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,241,193,0.5)';
    for (let i = 0; i < 5; i++) c.fillRect(100, 250 + i * 14, 160, 4);
    c.fillStyle = '#5a1e14';
    c.beginPath(); c.moveTo(0, 360); c.lineTo(40, 330); c.lineTo(40, 300); c.lineTo(120, 300); c.lineTo(130, 340); c.lineTo(230, 350); c.lineTo(240, 310); c.lineTo(330, 310); c.lineTo(330, 340); c.lineTo(W, 350); c.lineTo(W, 520); c.lineTo(0, 520); c.fill();
    c.fillStyle = '#2a0d08';
    const cactus = (x, y, s) => { c.save(); c.translate(x, y); c.scale(s, s); c.fillRect(-5, -50, 10, 50); c.fillRect(-18, -34, 6, 18); c.fillRect(-18, -22, 14, 6); c.fillRect(12, -40, 6, 20); c.fillRect(4, -26, 14, 6); c.restore(); };
    cactus(70, 420, 1.2); cactus(290, 410, 0.9); cactus(180, 450, 0.7);
  },
  circus(c, th) {
    c.save(); c.translate(180, 120);
    for (let i = 0; i < 24; i++) {
      c.fillStyle = i % 2 ? '#b5172b' : '#f2dfae';
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 700, i * Math.PI / 12, (i + 1) * Math.PI / 12); c.fill();
    }
    c.restore();
    c.fillStyle = 'rgba(40,5,10,0.35)'; c.fillRect(0, 0, W, H);
    c.fillStyle = th.acc;
    const star = (x, y, r) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.fill(); };
    star(60, 200, 14); star(300, 200, 14); star(180, 380, 22); star(110, 420, 9); star(250, 420, 9);
    // ring of lights round the centre ring
    c.strokeStyle = 'rgba(255,225,77,0.6)'; c.lineWidth = 3; c.beginPath(); c.ellipse(180, 380, 90, 34, 0, 0, Math.PI * 2); c.stroke();
  },
  robot(c, th) {
    c.strokeStyle = 'rgba(160,190,215,0.18)'; c.lineWidth = 1;
    for (let x = 0; x < W; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    const gear = (x, y, r, n) => {
      c.save(); c.translate(x, y); c.fillStyle = 'rgba(12,18,26,0.6)';
      c.beginPath();
      for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n, rr = i % 2 ? r : r * 1.18; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      c.fill(); c.fillStyle = '#4f6478'; c.beginPath(); c.arc(0, 0, r * 0.35, 0, Math.PI * 2); c.fill(); c.restore();
    };
    gear(70, 380, 46, 10); gear(140, 330, 26, 8); gear(290, 400, 38, 9);
    c.save(); c.beginPath(); c.rect(0, 440, W, 24); c.clip();
    for (let x = -40; x < W + 40; x += 28) { c.fillStyle = '#ffcf1a'; c.beginPath(); c.moveTo(x, 440); c.lineTo(x + 14, 440); c.lineTo(x - 10, 464); c.lineTo(x - 24, 464); c.fill(); }
    c.restore();
    c.fillStyle = 'rgba(10,15,20,0.7)'; c.fillRect(0, 440, W, 3); c.fillRect(0, 461, W, 3);
  },
  haunted(c, th) {
    let g = c.createRadialGradient(250, 180, 10, 250, 180, 90);
    g.addColorStop(0, '#f4ffd8'); g.addColorStop(0.5, 'rgba(220,255,180,0.6)'); g.addColorStop(1, 'rgba(220,255,180,0)');
    c.fillStyle = g; c.fillRect(150, 80, 200, 200);
    c.fillStyle = '#f0ffd0'; c.beginPath(); c.arc(250, 180, 34, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#050a06';
    c.beginPath(); c.moveTo(30, 470); c.lineTo(30, 360); c.lineTo(70, 320); c.lineTo(110, 360); c.lineTo(110, 300); c.lineTo(150, 250); c.lineTo(190, 300); c.lineTo(190, 360); c.lineTo(250, 360); c.lineTo(290, 330); c.lineTo(330, 360); c.lineTo(330, 470); c.fill();
    c.fillStyle = th.acc;
    for (const [x, y] of [[60, 380], [140, 300], [160, 300], [140, 330], [270, 380], [300, 400], [80, 420]]) c.fillRect(x, y, 10, 14);
    c.fillStyle = '#050a06';
    const bat = (x, y, s) => { c.save(); c.translate(x, y); c.scale(s, s); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-10, -10, -22, -4); c.quadraticCurveTo(-16, 0, -14, 6); c.quadraticCurveTo(-8, 2, 0, 6); c.quadraticCurveTo(8, 2, 14, 6); c.quadraticCurveTo(16, 0, 22, -4); c.quadraticCurveTo(10, -10, 0, 0); c.fill(); c.restore(); };
    bat(90, 150, 1); bat(300, 270, 0.8); bat(200, 120, 0.6);
  },
  volcano(c, th) {
    c.fillStyle = '#120302';
    c.beginPath(); c.moveTo(20, 470); c.lineTo(140, 230); c.lineTo(220, 230); c.lineTo(340, 470); c.fill();
    let g = c.createLinearGradient(0, 200, 0, 470);
    g.addColorStop(0, '#ffde59'); g.addColorStop(1, '#ff3a0a');
    c.strokeStyle = g; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(170, 232); c.quadraticCurveTo(150, 320, 110, 400); c.stroke();
    c.beginPath(); c.moveTo(195, 232); c.quadraticCurveTo(220, 330, 260, 440); c.stroke();
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,90,20,0.5)';
    for (let i = 0; i < 14; i++) { c.beginPath(); let x = hash(i) * W, y = 470 - hash(i + 9) * 60; c.moveTo(x, y); c.lineTo(x + 12, y - 10); c.lineTo(x + 6, y - 22); c.stroke(); }
    g = c.createRadialGradient(180, 220, 4, 180, 220, 80);
    g.addColorStop(0, 'rgba(255,200,60,0.8)'); g.addColorStop(1, 'rgba(255,60,10,0)');
    c.fillStyle = g; c.fillRect(80, 120, 200, 200);
  },
  temple(c, th) {
    c.fillStyle = 'rgba(10,20,8,0.55)';
    for (let i = 0; i < 6; i++) { const w = 260 - i * 36; c.fillRect(180 - w / 2 + 20, 460 - i * 30, w, 28); }
    c.fillStyle = 'rgba(255,216,107,0.25)';
    for (let i = 0; i < 6; i++) { const w = 260 - i * 36; c.fillRect(180 - w / 2 + 20, 460 - i * 30, w, 3); }
    c.strokeStyle = 'rgba(30,70,20,0.9)'; c.lineWidth = 4;
    for (let k = 0; k < 7; k++) {
      c.beginPath(); const x = 60 + k * 45; c.moveTo(x, 0);
      for (let y = 0; y < 160 + hash(k) * 120; y += 10) c.lineTo(x + Math.sin(y * 0.06 + k) * 8, y);
      c.stroke();
    }
    c.fillStyle = 'rgba(40,90,25,0.9)';
    for (let i = 0; i < 30; i++) { c.beginPath(); c.ellipse(60 + (i % 7) * 45 + Math.sin(i) * 8, 20 + Math.floor(i / 7) * 45 + hash(i) * 20, 7, 3.5, i, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = th.acc;  // carved eye
    c.beginPath(); c.ellipse(200, 300, 26, 12, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0e1d0c'; c.beginPath(); c.arc(200, 300, 7, 0, Math.PI * 2); c.fill();
  },
  ice(c, th) {
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.5;
    const flake = (x, y, r) => { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.stroke(); c.beginPath(); c.moveTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6); c.lineTo(x + Math.cos(a + 0.5) * r * 0.85, y + Math.sin(a + 0.5) * r * 0.85); c.stroke(); } };
    for (let i = 0; i < 18; i++) flake(hash(i) * W, hash(i + 30) * 480, 5 + hash(i + 60) * 10);
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath(); c.moveTo(60, 470); c.lineTo(60, 380); c.lineTo(80, 340); c.lineTo(100, 380); c.lineTo(100, 330); c.lineTo(130, 270); c.lineTo(160, 330); c.lineTo(160, 300); c.lineTo(180, 250); c.lineTo(200, 300); c.lineTo(200, 330); c.lineTo(230, 270); c.lineTo(260, 330); c.lineTo(260, 380); c.lineTo(280, 340); c.lineTo(300, 380); c.lineTo(300, 470); c.fill();
    c.fillStyle = 'rgba(43,127,255,0.35)';
    for (const [x, y] of [[120, 360], [170, 330], [230, 360], [178, 400]]) c.fillRect(x, y, 14, 22);
  },
  storm(c, th) {
    c.fillStyle = 'rgba(200,220,255,0.06)';
    for (let i = 0; i < 8; i++) { c.beginPath(); c.ellipse(hash(i) * W, 60 + hash(i + 8) * 200, 90, 30, 0, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = 'rgba(160,200,255,0.25)'; c.lineWidth = 1;
    for (let i = 0; i < 90; i++) { const x = hash(i) * W, y = hash(i + 100) * 480; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 6, y + 18); c.stroke(); }
    c.strokeStyle = th.acc; c.lineWidth = 4; c.lineJoin = 'miter';
    c.beginPath(); c.moveTo(110, 120); c.lineTo(90, 220); c.lineTo(120, 214); c.lineTo(84, 330); c.stroke();
    c.beginPath(); c.moveTo(270, 200); c.lineTo(250, 280); c.lineTo(276, 276); c.lineTo(250, 380); c.stroke();
    // a radio mast
    c.strokeStyle = 'rgba(5,7,11,0.85)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(150, 470); c.lineTo(180, 260); c.lineTo(210, 470); c.stroke();
    for (let y = 290; y < 470; y += 30) { const k = (y - 260) / 210 * 30; c.beginPath(); c.moveTo(180 - k, y); c.lineTo(180 + k + 4, y + 30); c.stroke(); }
    c.fillStyle = '#ff3b30'; c.beginPath(); c.arc(180, 258, 4, 0, Math.PI * 2); c.fill();
  },
};

// ---- static layer ----------------------------------------------------------------------------
export function paintTable(t, index, scale) {
  const th = THEMES[t.def.theme];
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(W * scale); cv.height = Math.ceil(H * scale);
  const c = cv.getContext('2d');
  c.scale(scale, scale);
  // cabinet wood behind everything
  c.fillStyle = '#1a0f08'; c.fillRect(0, 0, W, H);
  c.save();
  playfieldPath(c, t); c.clip();
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.bg[0]); g.addColorStop(0.55, th.bg[1]); g.addColorStop(1, th.bg[2]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  SCENERY[t.def.theme](c, th);
  // varnish sheen
  const sh = c.createLinearGradient(0, 0, W, H);
  sh.addColorStop(0, 'rgba(255,255,255,0.10)'); sh.addColorStop(0.4, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.25)');
  c.fillStyle = sh; c.fillRect(0, 0, W, H);
  // kelp zone tint
  for (const z of t.zones) { c.fillStyle = 'rgba(20,90,50,0.35)'; c.fillRect(z.x, z.y, z.w, z.h); }
  // unlit inserts: arrows toward the gate and a ring at the bottom
  for (const a of insertArrows(t)) drawArrow(c, a, 'rgba(0,0,0,0.45)', th.ink);
  c.restore();

  // apron at the bottom corners, with a little instruction card
  c.fillStyle = '#100a06';
  c.beginPath(); c.moveTo(0, 470); c.lineTo(108, 549); c.lineTo(108, H); c.lineTo(0, H); c.fill();
  c.beginPath(); c.moveTo(W, 470); c.lineTo(W - 108, 549); c.lineTo(W - 108, H); c.lineTo(W, H); c.fill();
  card(c, 36, 576, 66, 52, ['TABLE', `${index + 1}/10`], th);
  card(c, W - 100, 576, 92, 52, t.def.name.length > 13 ? t.def.name.split(' ').slice(-2) : [t.def.name.split(' ').slice(0, -1).join(' ') || t.def.name, t.def.name.split(' ').length > 1 ? t.def.name.split(' ').slice(-1)[0] : ''], th);

  // sling plastics
  if (t.slings) for (const s of t.slings) {
    const [a, b, d] = s.tri;
    c.fillStyle = th.plastic;
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1; c.stroke();
  }
  // rails
  for (const r of t.rails) drawRail(c, r.pts, r.kind);
  // the wire ramp that delivers the ball from the table below into the left inlane
  c.lineCap = 'round';
  for (const x of [15, 29]) {
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 2, H + 4); c.lineTo(x + 2, 426); c.stroke();
    c.strokeStyle = '#c9ced6'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, H); c.lineTo(x, 424); c.stroke();
  }
  c.strokeStyle = '#c9ced6'; c.lineWidth = 1.5;
  for (let y = 446; y < H; y += 46) { c.beginPath(); c.moveTo(15, y); c.lineTo(29, y); c.stroke(); }
  // gate housing on the top wall
  const gx = t.gate.base, gw = t.gate.w;
  if (!t.gate.amp) {
    c.fillStyle = '#050302';
    c.fillRect(gx - gw / 2, -4, gw, 8);
  }
  // posts (static ones)
  for (const p of t.circles) if (!p.move && (p.kind === 'post' || p.kind === 'slingpost')) drawPost(c, p, th);
  return cv;
}

function card(c, x, y, w, h, lines, th) {
  c.fillStyle = '#f3ead2';
  c.fillRect(x, y, w, h);
  c.fillStyle = th.cap; c.fillRect(x, y, w, 6);
  // dot-matrix style printing on the card
  const cols = Math.floor(w / 1.9), rows = 18, bm = new Float32Array(cols * rows);
  lines.forEach((l, i) => { const s = l.slice(0, 13); drawText(bm, cols, rows, s, Math.floor((cols - textWidth(s)) / 2), 1 + i * 9); });
  c.fillStyle = '#2a1a10';
  const dx = w / cols;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (bm[j * cols + i]) {
    c.beginPath(); c.arc(x + (i + 0.5) * dx, y + 10 + j * dx + dx / 2, dx * 0.42, 0, Math.PI * 2); c.fill();
  }
}

export function insertArrows(t) {
  const gx = t.gate.base, out = [];
  const x0 = 180, y0 = 430, x1 = gx, y1 = 70;
  for (let i = 0; i < 4; i++) {
    const k = 0.15 + i * 0.2;
    const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
    out.push({ x, y, a: Math.atan2(y1 - y0, x1 - x0), i });
  }
  return out;
}
function drawArrow(c, a, fill, edge) {
  c.save(); c.translate(a.x, a.y); c.rotate(a.a + Math.PI / 2);
  c.beginPath(); c.moveTo(0, -11); c.lineTo(9, 5); c.lineTo(0, 1); c.lineTo(-9, 5); c.closePath();
  c.fillStyle = fill; c.fill();
  c.strokeStyle = edge; c.lineWidth = 1.2; c.stroke();
  c.restore();
}

function drawRail(c, pts, kind) {
  const path = () => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); };
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (kind === 'outer') {
    path(); c.strokeStyle = '#0a0604'; c.lineWidth = 9; c.stroke();
    path(); c.strokeStyle = '#8e939a'; c.lineWidth = 4; c.stroke();
    path(); c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1.2; c.stroke();
    return;
  }
  if (kind === 'stone') {
    path(); c.strokeStyle = '#0b0805'; c.lineWidth = 10; c.stroke();
    path(); c.strokeStyle = '#a89470'; c.lineWidth = 7; c.stroke();
    path(); c.strokeStyle = 'rgba(255,240,200,0.5)'; c.lineWidth = 1.5; c.stroke();
    return;
  }
  path(); c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 7; c.stroke();
  path(); c.strokeStyle = '#b9bec6'; c.lineWidth = 4; c.stroke();
  path(); c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.2; c.stroke();
}

function drawPost(c, p, th) {
  c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.arc(p.x + 1.5, p.y + 2, p.r + 1.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = p.kind === 'slingpost' ? '#f4f4f4' : th.rubber; c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#d8d8d8'; c.beginPath(); c.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(p.x - p.r * 0.2, p.y - p.r * 0.25, p.r * 0.2, 0, Math.PI * 2); c.fill();
}

// ---- moving parts, drawn each frame in table units ----------------------------------------
export function drawDynamic(c, t, now, opts = {}) {
  const th = THEMES[t.def.theme];
  // chasing arrow lights toward the gate
  const arrows = insertArrows(t);
  const chase = Math.floor(now * 6) % 6;
  for (const a of arrows) {
    const on = (chase === a.i || chase === a.i + 1) || opts.hintGate;
    if (on) {
      c.save(); c.shadowColor = th.acc; c.shadowBlur = 10;
      drawArrow(c, a, th.acc, 'rgba(255,255,255,0.6)');
      c.restore();
    }
  }
  // the gate: a glowing opening in the top wall
  const g = t.gate, l = g.x - g.w / 2;
  c.save();
  if (g.closed) {
    c.fillStyle = '#2a2a2a'; c.fillRect(l - 2, -6, g.w + 4, 10);
    c.fillStyle = '#ff3a1a';
    for (let i = 0; i < 3; i++) c.fillRect(l + 4 + i * (g.w - 8) / 3, -3, (g.w - 8) / 3 - 3, 4);
  } else {
    const pulse = 0.6 + 0.4 * Math.sin(now * 6);
    const gr = c.createLinearGradient(0, 30, 0, -10);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(255,240,200,${0.55 * pulse + (opts.hintGate ? 0.3 : 0)})`);
    c.fillStyle = gr; c.fillRect(l, -10, g.w, 40);
    c.fillStyle = '#050302'; c.fillRect(l, -14, g.w, 10);
    // lane walls
    c.fillStyle = '#b9bec6'; c.fillRect(l - 3, -24, 3, 26); c.fillRect(l + g.w, -24, 3, 26);
  }
  if (g.amp) { c.fillStyle = '#b9bec6'; c.fillRect(t.top.x0, -3, l - t.top.x0, 4); c.fillRect(l + g.w, -3, t.top.x1 - l - g.w, 4); }
  c.restore();

  // drop targets
  for (const tg of t.targets) {
    if (tg.down) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(tg.x, tg.y + tg.h / 2 - 1, tg.w, 2); continue; }
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(tg.x + 2, tg.y + 2, tg.w, tg.h);
    const gr = c.createLinearGradient(tg.x, 0, tg.x + tg.w, 0);
    gr.addColorStop(0, '#5a2a10'); gr.addColorStop(0.5, '#a0522d'); gr.addColorStop(1, '#3a1a0a');
    c.fillStyle = gr; c.fillRect(tg.x, tg.y, tg.w, tg.h);
    c.fillStyle = th.acc; c.fillRect(tg.x + 2, tg.y + tg.h / 2 - 3, tg.w - 4, 6);
  }

  // bumpers and moving things
  for (const b of t.circles) {
    if (b.kind === 'bumper') drawBumper(c, b, th, now);
    else if (b.kind === 'ghost') drawGhost(c, b, now);
    else if (b.move) drawPost(c, b, th);
  }
  // sling flash
  if (t.slings) for (const s of t.slings) if (s.lit > 0) {
    c.save(); c.strokeStyle = '#fff'; c.lineWidth = 4; c.shadowColor = th.acc; c.shadowBlur = 12;
    c.beginPath(); c.moveTo(s.ax, s.ay); c.lineTo(s.bx, s.by); c.stroke(); c.restore();
  } else {
    c.strokeStyle = '#f4f4f4'; c.lineWidth = 3; c.beginPath(); c.moveTo(s.ax, s.ay); c.lineTo(s.bx, s.by); c.stroke();
  }
  // flippers
  for (const f of t.flippers) drawFlipper(c, f, th, t.tilted);
}

function drawBumper(c, b, th, now) {
  const lit = b.lit > 0;
  c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.arc(b.x + 2, b.y + 3, b.r + 3, 0, Math.PI * 2); c.fill();
  // skirt
  c.fillStyle = '#e9e4d8'; c.beginPath(); c.arc(b.x, b.y, b.r + 2, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#222'; c.beginPath(); c.arc(b.x, b.y, b.r - 1, 0, Math.PI * 2); c.fill();
  // cap
  c.save();
  if (lit) { c.shadowColor = th.acc; c.shadowBlur = 24; }
  const g = c.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, 1, b.x, b.y, b.r * 0.85);
  g.addColorStop(0, lit ? '#fff' : 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, lit ? th.acc : th.cap);
  g.addColorStop(1, lit ? th.cap : shade(th.cap));
  c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r * 0.8, 0, Math.PI * 2); c.fill();
  c.restore();
  if (b.jelly) {  // tentacles
    c.strokeStyle = 'rgba(255,200,230,0.6)'; c.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(b.x + i * 5, b.y + b.r); c.quadraticCurveTo(b.x + i * 5 + Math.sin(now * 4 + i) * 5, b.y + b.r + 10, b.x + i * 6, b.y + b.r + 18); c.stroke(); }
  }
}
function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) * 0.45, g = ((n >> 8) & 255) * 0.45, b = (n & 255) * 0.45;
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function drawGhost(c, b, now) {
  c.save(); c.translate(b.x, b.y);
  c.globalAlpha = 0.85;
  c.shadowColor = '#c8ffb0'; c.shadowBlur = 14;
  c.fillStyle = '#eaffe0';
  c.beginPath(); c.arc(0, -2, b.r, Math.PI, 0);
  const n = 4;
  for (let i = 0; i <= n; i++) { const x = b.r - (2 * b.r * i) / n; c.lineTo(x, b.r + (i % 2 ? -2 : 4) + Math.sin(now * 8 + i) * 2); }
  c.closePath(); c.fill();
  c.shadowBlur = 0; c.globalAlpha = 1;
  c.fillStyle = '#0a1a0c';
  c.beginPath(); c.ellipse(-5, -4, 3, 4.5, 0, 0, Math.PI * 2); c.ellipse(5, -4, 3, 4.5, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(0, 5, 3, 2.5, 0, 0, Math.PI * 2); c.fill();
  c.restore();
}

function drawFlipper(c, f, th, dead) {
  const [tx, ty] = flipperTip(f);
  const a = f.ang, nx = -Math.sin(a), ny = Math.cos(a);
  const shape = (grow) => {
    c.beginPath();
    c.arc(f.px, f.py, f.r1 + grow, a + Math.PI / 2, a - Math.PI / 2);
    c.lineTo(tx - nx * (f.r2 + grow), ty - ny * (f.r2 + grow));
    c.arc(tx, ty, f.r2 + grow, a - Math.PI / 2, a + Math.PI / 2);
    c.closePath();
  };
  c.save(); c.translate(2, 3); shape(1); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fill(); c.restore();
  shape(0); c.fillStyle = dead ? '#6a6a6a' : th.rubber; c.fill();
  shape(-2.2);
  const g = c.createLinearGradient(f.px - nx * 10, f.py - ny * 10, f.px + nx * 10, f.py + ny * 10);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c9c4b8');
  c.fillStyle = dead ? '#9a9a9a' : g; c.fill();
  c.fillStyle = '#7a7a7a'; c.beginPath(); c.arc(f.px, f.py, 3, 0, Math.PI * 2); c.fill();
}

export function drawBall(c, x, y, scale = 1) {
  c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.arc(x + 2.5, y + 3.5, R, 0, Math.PI * 2); c.fill();
  const g = c.createRadialGradient(x - R * 0.35, y - R * 0.45, R * 0.1, x, y, R);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#e6e9ee'); g.addColorStop(0.7, '#8a929c'); g.addColorStop(1, '#3a3f46');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(40,30,20,0.5)'; c.beginPath(); c.ellipse(x + R * 0.1, y + R * 0.45, R * 0.6, R * 0.22, 0, 0, Math.PI * 2); c.fill();
}

// The dark divider between two stacked tables, with the drain funnel and the tube to the gate below.
export function drawDivider(c, gap, gateX, upper) {
  c.fillStyle = '#0b0705'; c.fillRect(-20, 0, W + 40, gap);
  c.fillStyle = '#20140c'; c.fillRect(-20, 6, W + 40, gap - 12);
  // bolts
  c.fillStyle = '#5a4a3a';
  for (let x = 14; x < W; x += 48) { c.beginPath(); c.arc(x, gap / 2, 3, 0, Math.PI * 2); c.fill(); }
  // tube from the drain above down into the gate below
  c.strokeStyle = 'rgba(200,220,240,0.35)'; c.lineWidth = 22; c.lineCap = 'butt';
  c.beginPath(); c.moveTo(180, 0); c.bezierCurveTo(180, gap * 0.5, gateX, gap * 0.5, gateX, gap - 4); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(172, 0); c.bezierCurveTo(172, gap * 0.5, gateX - 8, gap * 0.5, gateX - 8, gap - 4); c.stroke();
  // the habitrail up the left side to the table above
  c.strokeStyle = 'rgba(200,220,240,0.3)'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(gateX - 10, gap); c.bezierCurveTo(gateX - 10, gap * 0.3, 22, gap * 0.7, 16, -10); c.stroke();
  c.beginPath(); c.moveTo(gateX + 10, gap); c.bezierCurveTo(gateX + 10, gap * 0.3, 34, gap * 0.7, 28, -10); c.stroke();
}
