// Drawing kit for a made-up 2003 desktop ("Meadow"): glossy blue windows, beige bodies,
// chunky icons, a rolling-hill wallpaper and WordArt. Everything is plain canvas paths.

export const FONT = 'Tahoma, Verdana, "DejaVu Sans", sans-serif';
export const ART = 'Anton, Impact, "Arial Narrow", sans-serif';
export const MONO = '"Lucida Console", "Courier New", monospace';

export const C = {
  body: '#ece9d8', body2: '#f6f4ec', edge: '#0831d9', ink: '#111', grey: '#7f7b70', line: '#aca899',
  sel: '#316ac5', felt: '#0b7a3a', red: '#e2412b', green: '#2fa82f', yellow: '#ffd500',
};

export function rr(c, x, y, w, h, r) {
  const [a, b, d, e] = Array.isArray(r) ? r : [r, r, r, r];
  c.beginPath();
  c.moveTo(x + a, y); c.lineTo(x + w - b, y); c.quadraticCurveTo(x + w, y, x + w, y + b);
  c.lineTo(x + w, y + h - d); c.quadraticCurveTo(x + w, y + h, x + w - d, y + h);
  c.lineTo(x + e, y + h); c.quadraticCurveTo(x, y + h, x, y + h - e);
  c.lineTo(x, y + a); c.quadraticCurveTo(x, y, x + a, y); c.closePath();
}

export const inR = (x, y, r, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
export const cx = r => r.x + r.w / 2, cy = r => r.y + r.h / 2;

// Window geometry, shared by the drawing and by the games' hit tests.
export function winLayout(x, y, w, h, tb = 34, buttons = 'x') {
  const b = 4, bs = tb - 8;
  const L = { x, y, w, h, tb, buttons, body: { x: x + b, y: y + tb, w: w - 2 * b, h: h - tb - b } };
  L.close = { x: x + w - b - bs - 2, y: y + 4, w: bs, h: bs };
  if (buttons === 'mmx') {
    L.max = { x: L.close.x - bs - 3, y: y + 4, w: bs, h: bs };
    L.min = { x: L.max.x - bs - 3, y: y + 4, w: bs, h: bs };
  }
  return L;
}

export function font(c, size, weight = '', fam = FONT) { c.font = `${weight} ${size}px ${fam}`.trim(); }

export function drawWin(c, L, title, o = {}) {
  const { x, y, w, h, tb } = L;
  const active = o.active !== false;
  c.save();
  if (o.shadow !== false) { c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 14; c.shadowOffsetY = 4; }
  rr(c, x, y, w, h, [9, 9, 2, 2]);
  const g = c.createLinearGradient(0, y, 0, y + tb);
  if (active) { g.addColorStop(0, '#3d95ff'); g.addColorStop(.1, '#0a64f0'); g.addColorStop(.55, '#0058e6'); g.addColorStop(1, '#0244c2'); }
  else { g.addColorStop(0, '#a6bff0'); g.addColorStop(.5, '#8aa6e4'); g.addColorStop(1, '#7b97dc'); }
  c.fillStyle = g; c.fill();
  c.restore();
  // frame sides are the same blue, a little darker
  c.fillStyle = active ? '#0446cf' : '#7b97dc';
  c.fillRect(x, y + tb, w, h - tb);
  // title bar shine
  c.fillStyle = 'rgba(255,255,255,.18)'; rr(c, x + 3, y + 2, w - 6, tb * .38, [7, 7, 2, 2]); c.fill();
  // body
  c.fillStyle = o.bodyColor || C.body;
  c.fillRect(L.body.x, L.body.y, L.body.w, L.body.h);
  // title text
  const ts = Math.round(tb * .44);
  let tx = x + 10;
  if (o.icon) { icon(c, o.icon, x + 8 + ts * .7, y + tb / 2, ts * 1.4); tx += ts * 1.5 + 2; }
  font(c, ts, 'bold');
  c.textBaseline = 'middle'; c.textAlign = 'left';
  const maxT = (L.min ? L.min.x : L.close.x) - tx - 6;
  const tt = fitText(c, title, maxT);
  c.fillStyle = 'rgba(0,0,40,.6)'; c.fillText(tt, tx + 1, y + tb / 2 + 2);
  c.fillStyle = '#fff'; c.fillText(tt, tx, y + tb / 2 + 1);
  if (L.buttons) {
    if (L.min) { capBtn(c, L.min, 'min', active, o.hot === 'min'); capBtn(c, L.max, 'max', active, o.hot === 'max'); }
    capBtn(c, L.close, 'x', active, o.hot === 'x');
  }
}

export function fitText(c, s, w) {
  if (c.measureText(s).width <= w) return s;
  while (s.length > 1 && c.measureText(s + '…').width > w) s = s.slice(0, -1);
  return s + '…';
}

function capBtn(c, r, kind, active, hot) {
  const { x, y, w, h } = r;
  const g = c.createLinearGradient(0, y, 0, y + h);
  if (kind === 'x') { g.addColorStop(0, hot ? '#ff9a7a' : '#f08a6c'); g.addColorStop(.5, '#e2512d'); g.addColorStop(1, '#c4321a'); }
  else { g.addColorStop(0, '#6fa6ff'); g.addColorStop(.5, '#2f6fe8'); g.addColorStop(1, '#1d55d0'); }
  rr(c, x, y, w, h, 4); c.fillStyle = active ? g : '#9db3e6'; c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
  c.strokeStyle = '#fff'; c.lineWidth = Math.max(2, w * .11); c.lineCap = 'round';
  const m = w * .3;
  c.beginPath();
  if (kind === 'x') { c.moveTo(x + m, y + m); c.lineTo(x + w - m, y + h - m); c.moveTo(x + w - m, y + m); c.lineTo(x + m, y + h - m); c.stroke(); }
  else if (kind === 'min') { c.moveTo(x + m, y + h - m); c.lineTo(x + w * .55, y + h - m); c.stroke(); }
  else { c.lineWidth = Math.max(1.5, w * .08); c.strokeRect(x + m, y + m, w - 2 * m, h - 2 * m); c.fillStyle = '#fff'; c.fillRect(x + m, y + m, w - 2 * m, w * .1); }
  c.lineCap = 'butt';
}

// A beige push button. state: 'def' (default, orange ring), 'dis', 'down', 'hot'
export function button(c, r, label, o = {}) {
  const { x, y, w, h } = r;
  const g = c.createLinearGradient(0, y, 0, y + h);
  if (o.dis) { g.addColorStop(0, '#f4f3ee'); g.addColorStop(1, '#f4f3ee'); }
  else if (o.down) { g.addColorStop(0, '#e3e0d6'); g.addColorStop(1, '#f2f1ec'); }
  else { g.addColorStop(0, '#ffffff'); g.addColorStop(.7, '#ecebe6'); g.addColorStop(1, '#d6d0c5'); }
  rr(c, x, y, w, h, 4); c.fillStyle = o.fill || g; c.fill();
  c.strokeStyle = o.dis ? '#c9c7ba' : '#003c74'; c.lineWidth = 1.2; c.stroke();
  if (o.def && !o.dis) { rr(c, x + 2.5, y + 2.5, w - 5, h - 5, 3); c.strokeStyle = o.hot ? '#f8b636' : '#7ba3f0'; c.lineWidth = 2; c.stroke(); }
  font(c, o.size || Math.min(16, h * .42), o.bold ? 'bold' : '');
  c.fillStyle = o.dis ? '#aca899' : (o.color || C.ink); c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(label, x + w / 2, y + h / 2 + 1);
}

export function wrap(c, text, w) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (c.measureText(t).width > w && line) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

export function para(c, text, x, y, w, size, lh = 1.35, color = C.ink, weight = '', fam = FONT) {
  font(c, size, weight, fam); c.fillStyle = color; c.textAlign = 'left'; c.textBaseline = 'top';
  const lines = wrap(c, text, w);
  lines.forEach((l, i) => c.fillText(l, x, y + i * size * lh));
  return lines.length * size * lh;
}

// ---- wallpaper: blue sky, soft clouds, a green hill
export function wallpaper(w, h, dpr) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const sky = c.createLinearGradient(0, 0, 0, h * .75);
  sky.addColorStop(0, '#2a62c9'); sky.addColorStop(.55, '#5d9ae6'); sky.addColorStop(1, '#bfe0fb');
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9; i++) {
    const x = r() * w, y = h * (.08 + r() * .35), k = 40 + r() * 90;
    for (let j = 0; j < 6; j++) {
      const gx = x + (r() - .5) * k * 2.2, gy = y + (r() - .5) * k * .35, gr = k * (.4 + r() * .5);
      const rg = c.createRadialGradient(gx, gy, 0, gx, gy, gr);
      rg.addColorStop(0, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = rg; c.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }
  }
  // back hill
  c.beginPath(); c.moveTo(0, h * .72);
  c.bezierCurveTo(w * .3, h * .6, w * .55, h * .66, w, h * .58);
  c.lineTo(w, h); c.lineTo(0, h); c.closePath();
  let gg = c.createLinearGradient(0, h * .58, 0, h);
  gg.addColorStop(0, '#79c447'); gg.addColorStop(1, '#3e8c26'); c.fillStyle = gg; c.fill();
  // front hill
  c.beginPath(); c.moveTo(0, h * .78);
  c.bezierCurveTo(w * .25, h * .66, w * .6, h * .7, w, h * .86);
  c.lineTo(w, h); c.lineTo(0, h); c.closePath();
  gg = c.createLinearGradient(0, h * .66, 0, h);
  gg.addColorStop(0, '#6cc23a'); gg.addColorStop(.6, '#3a9a22'); gg.addColorStop(1, '#2a7a18'); c.fillStyle = gg; c.fill();
  // sunlit ridge
  c.beginPath(); c.moveTo(0, h * .78);
  c.bezierCurveTo(w * .25, h * .66, w * .6, h * .7, w, h * .86);
  c.strokeStyle = 'rgba(220,255,160,.45)'; c.lineWidth = 3; c.stroke();
  return cv;
}

// ---- WordArt: slanted, outlined, gradient-filled, on a gentle wave
const ARTS = {
  rainbow: ['#fff36b', '#ffb000', '#ff5a1f', '#e8177d'],
  chrome: ['#ffffff', '#b9d7ff', '#3d7be0', '#123c99'],
  lime: ['#f6ffb0', '#b8f03c', '#3fae1f', '#0f6b2a'],
  grape: ['#ffd9ff', '#ff7ae6', '#a33dff', '#3c1aa8'],
};
export const ART_KEYS = Object.keys(ARTS);

export function wordart(c, text, x, y, size, style = 'rainbow', o = {}) {
  const stops = ARTS[style] || ARTS.rainbow;
  font(c, size, '', ART);
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  const chars = [...text];
  const widths = chars.map(ch => c.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + (chars.length - 1) * size * .02;
  let px = x - total / 2;
  const wave = o.wave ?? .12, ph = o.phase || 0;
  const g = c.createLinearGradient(0, -size * .82, 0, size * .04);
  stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
  for (let pass = 0; pass < 3; pass++) {
    let qx = px;
    chars.forEach((ch, i) => {
      const t = (qx + widths[i] / 2 - x) / (total || 1);
      const dy = Math.sin(t * Math.PI * 1.6 + ph) * size * wave;
      c.save(); c.translate(qx, y + dy); c.transform(1, 0, -.18, 1, 0, 0);
      c.lineJoin = 'round';
      if (pass === 0) { c.fillStyle = 'rgba(10,10,50,.45)'; c.fillText(ch, size * .07, size * .09); }
      else if (pass === 1) { c.strokeStyle = o.outline || '#14143c'; c.lineWidth = size * .14; c.strokeText(ch, 0, 0); }
      else { c.fillStyle = g; c.fillText(ch, 0, 0); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = size * .025; c.strokeText(ch, 0, 0); }
      c.restore();
      qx += widths[i] + size * .02;
    });
  }
  return total;
}

// ---- icons, drawn centred at (x, y), s is the full size (~48)
export function icon(c, type, x, y, s, o = {}) {
  c.save(); c.translate(x, y); c.scale(s / 48, s / 48);
  c.lineJoin = 'round'; c.lineCap = 'round';
  const f = ICONS[type] || ICONS.doc;
  f(c, o);
  c.restore();
}

function lg(c, y0, y1, ...stops) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
  return g;
}
function outline(c, w = 1.6, col = 'rgba(0,0,0,.55)') { c.strokeStyle = col; c.lineWidth = w; c.stroke(); }

export function suit(c, s, x, y, k) {
  c.save(); c.translate(x, y); c.scale(k / 20, k / 20);
  c.fillStyle = (s === 'h' || s === 'd') ? '#d01f1f' : '#111';
  c.beginPath();
  if (s === 'h') { c.moveTo(0, 9); c.bezierCurveTo(-14, -1, -9, -13, 0, -5); c.bezierCurveTo(9, -13, 14, -1, 0, 9); }
  else if (s === 'd') { c.moveTo(0, -10); c.lineTo(8, 0); c.lineTo(0, 10); c.lineTo(-8, 0); }
  else if (s === 's') { c.moveTo(0, -10); c.bezierCurveTo(12, 0, 10, 9, 2, 5); c.lineTo(4, 10); c.lineTo(-4, 10); c.lineTo(-2, 5); c.bezierCurveTo(-10, 9, -12, 0, 0, -10); }
  else { c.arc(0, -5, 4.6, 0, 7); c.moveTo(-5, 2); c.arc(-5, 2, 4.6, 0, 7); c.moveTo(5, 2); c.arc(5, 2, 4.6, 0, 7); c.moveTo(0, 0); c.lineTo(3, 10); c.lineTo(-3, 10); }
  c.fill(); c.restore();
}

const ICONS = {
  folder(c) {
    c.beginPath(); c.moveTo(-20, -12); c.lineTo(-8, -12); c.lineTo(-4, -8); c.lineTo(20, -8); c.lineTo(20, 15); c.lineTo(-20, 15); c.closePath();
    c.fillStyle = lg(c, -12, 15, '#ffe58a', '#f2bf3a'); c.fill(); outline(c, 1.4, '#a07818');
    c.beginPath(); c.moveTo(-22, -2); c.lineTo(22, -4); c.lineTo(19, 16); c.lineTo(-19, 16); c.closePath();
    c.fillStyle = lg(c, -4, 16, '#fff2b8', '#f7cf55'); c.fill(); outline(c, 1.4, '#a07818');
  },
  doc(c) {
    c.beginPath(); c.moveTo(-14, -20); c.lineTo(7, -20); c.lineTo(15, -12); c.lineTo(15, 20); c.lineTo(-14, 20); c.closePath();
    c.fillStyle = '#fff'; c.fill(); outline(c, 1.4, '#6a7a90');
    c.beginPath(); c.moveTo(7, -20); c.lineTo(7, -12); c.lineTo(15, -12); c.fillStyle = '#dde6f2'; c.fill(); outline(c, 1.2, '#6a7a90');
    c.fillStyle = '#7d9cc8'; for (let i = 0; i < 5; i++) c.fillRect(-9, -8 + i * 5.5, i === 4 ? 12 : 19, 2);
  },
  bin(c, o) {
    c.beginPath(); c.moveTo(-14, -12); c.lineTo(14, -12); c.lineTo(11, 19); c.lineTo(-11, 19); c.closePath();
    c.fillStyle = lg(c, -12, 19, '#e9f4ff', '#a9c4de'); c.fill(); outline(c, 1.4, '#4d6680');
    c.strokeStyle = '#7e9bb8'; c.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 7, -8); c.lineTo(i * 5.5, 16); c.stroke(); }
    c.beginPath(); c.ellipse(0, -12, 15, 4, 0, 0, 7); c.fillStyle = '#cfe2f5'; c.fill(); outline(c, 1.4, '#4d6680');
    if (o.full) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-8, -14); c.lineTo(2, -22); c.lineTo(9, -13); c.closePath(); c.fill(); outline(c, 1, '#6a7a90'); }
    c.fillStyle = '#2fa82f'; c.beginPath(); c.arc(0, 4, 5, 0, 7); c.fill();
  },
  pc(c) {
    rr(c, -19, -18, 38, 28, 3); c.fillStyle = lg(c, -18, 10, '#f1efe6', '#cfcbbd'); c.fill(); outline(c, 1.4, '#6d6a60');
    c.fillStyle = lg(c, -14, 6, '#4aa0ff', '#1550c8'); c.fillRect(-15, -14, 30, 20);
    c.fillStyle = '#6cc23a'; c.beginPath(); c.moveTo(-15, 2); c.quadraticCurveTo(0, -6, 15, 0); c.lineTo(15, 6); c.lineTo(-15, 6); c.fill();
    c.fillStyle = '#cfcbbd'; c.fillRect(-6, 10, 12, 4); rr(c, -14, 14, 28, 6, 2); c.fill(); outline(c, 1.2, '#6d6a60');
  },
  globe(c) {
    c.beginPath(); c.arc(0, 0, 18, 0, 7); c.fillStyle = lg(c, -18, 18, '#8fd0ff', '#1d68d8'); c.fill(); outline(c, 1.4, '#0b3c8a');
    c.fillStyle = '#4fbf3a';
    c.beginPath(); c.moveTo(-10, -12); c.quadraticCurveTo(0, -16, 4, -8); c.quadraticCurveTo(-2, -2, -8, 2); c.quadraticCurveTo(-16, -2, -10, -12); c.fill();
    c.beginPath(); c.moveTo(4, 2); c.quadraticCurveTo(14, 0, 14, 8); c.quadraticCurveTo(8, 16, 2, 12); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.beginPath(); c.arc(-6, -6, 10, 3.6, 4.6); c.stroke();
  },
  mail(c) {
    rr(c, -20, -13, 40, 27, 2); c.fillStyle = lg(c, -13, 14, '#ffffff', '#e4e0d0'); c.fill(); outline(c, 1.4, '#7a735a');
    c.beginPath(); c.moveTo(-20, -12); c.lineTo(0, 3); c.lineTo(20, -12); c.strokeStyle = '#7a735a'; c.lineWidth = 1.4; c.stroke();
    c.fillStyle = '#e2412b'; c.fillRect(11, -10, 6, 7);
  },
  cookie(c) {
    c.beginPath();
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = 18 + (i % 3 === 0 ? -1.5 : 1); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath(); c.fillStyle = lg(c, -18, 18, '#e8b468', '#b8742c'); c.fill(); outline(c, 1.4, '#7a4614');
    c.fillStyle = '#4a2810';
    [[-8, -7, 3.2], [6, -9, 2.6], [-2, 2, 3], [9, 4, 3.2], [-9, 8, 2.4], [2, 11, 2.2], [0, -12, 1.8]].forEach(([a, b, r]) => { c.beginPath(); c.arc(a, b, r, 0, 7); c.fill(); });
  },
  music(c) {
    c.beginPath(); c.arc(0, 0, 19, 0, 7); c.fillStyle = lg(c, -19, 19, '#ffd27a', '#f08a1c'); c.fill(); outline(c, 1.4, '#9a5208');
    c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(-6, 8, 5, 4, -.4, 0, 7); c.fill(); c.beginPath(); c.ellipse(8, 5, 5, 4, -.4, 0, 7); c.fill();
    c.beginPath(); c.moveTo(-2, 7); c.lineTo(-2, -11); c.lineTo(12, -14); c.lineTo(12, 4); c.stroke();
  },
  printer(c) {
    c.fillStyle = '#fff'; c.fillRect(-11, -20, 22, 14); outline(c, 1, '#888');
    rr(c, -20, -8, 40, 20, 4); c.fillStyle = lg(c, -8, 12, '#f1efe6', '#bdb8a8'); c.fill(); outline(c, 1.4, '#6d6a60');
    c.fillStyle = '#4d4a42'; c.fillRect(-13, 4, 26, 3);
    c.fillStyle = '#2fa82f'; c.beginPath(); c.arc(14, -2, 2.2, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.fillRect(-10, 7, 20, 12); outline(c, 1, '#888');
  },
  floppy(c, o) {
    rr(c, -17, -17, 34, 34, [2, 6, 2, 2]); c.fillStyle = lg(c, -17, 17, o.col1 || '#4b6fd8', o.col2 || '#1d3c9a'); c.fill(); outline(c, 1.4, '#0d1f55');
    c.fillStyle = '#d6dbe6'; c.fillRect(-9, -17, 16, 11); c.fillStyle = '#3b4a6a'; c.fillRect(1, -15, 4, 7);
    c.fillStyle = '#fff'; rr(c, -12, 1, 24, 15, 1.5); c.fill();
    c.fillStyle = '#e2412b'; c.fillRect(-12, 1, 24, 3);
  },
  setup(c) {
    c.beginPath(); c.moveTo(-18, -6); c.lineTo(0, -14); c.lineTo(18, -6); c.lineTo(0, 2); c.closePath();
    c.fillStyle = '#f7d576'; c.fill(); outline(c, 1.3, '#8a6a18');
    c.beginPath(); c.moveTo(-18, -6); c.lineTo(0, 2); c.lineTo(0, 20); c.lineTo(-18, 11); c.closePath(); c.fillStyle = '#e7b33e'; c.fill(); outline(c, 1.3, '#8a6a18');
    c.beginPath(); c.moveTo(18, -6); c.lineTo(0, 2); c.lineTo(0, 20); c.lineTo(18, 11); c.closePath(); c.fillStyle = '#c99528'; c.fill(); outline(c, 1.3, '#8a6a18');
    c.beginPath(); c.arc(8, -16, 9, 0, 7); c.fillStyle = lg(c, -25, -7, '#8fd0ff', '#1d68d8'); c.fill(); outline(c, 1.2, '#0b3c8a');
    c.fillStyle = '#fff'; font(c, 12, 'bold'); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 8, -15);
  },
  cd(c) {
    c.beginPath(); c.arc(0, 0, 19, 0, 7);
    const g = c.createConicGradient ? c.createConicGradient(0, 0, 0) : null;
    if (g) { ['#e0e8f0', '#ffd6f2', '#c8f0ff', '#fff6c0', '#e0e8f0'].forEach((s, i) => g.addColorStop(i / 4, s)); c.fillStyle = g; } else c.fillStyle = '#dde';
    c.fill(); outline(c, 1.4, '#6a7a90');
    c.beginPath(); c.arc(0, 0, 6, 0, 7); c.fillStyle = '#fff'; c.fill(); outline(c, 1.2, '#6a7a90');
  },
  image(c) {
    rr(c, -19, -15, 38, 30, 2); c.fillStyle = '#fff'; c.fill(); outline(c, 1.4, '#6a7a90');
    c.fillStyle = lg(c, -12, 12, '#7ec0ff', '#cfe9ff'); c.fillRect(-15, -11, 30, 22);
    c.fillStyle = '#4fae2f'; c.beginPath(); c.moveTo(-15, 11); c.lineTo(-4, -2); c.lineTo(4, 5); c.lineTo(9, 0); c.lineTo(15, 11); c.fill();
    c.fillStyle = '#ffd500'; c.beginPath(); c.arc(8, -5, 3.5, 0, 7); c.fill();
  },
  game(c) {
    rr(c, -20, -8, 40, 22, 11); c.fillStyle = lg(c, -8, 14, '#9aa3b4', '#4d5566'); c.fill(); outline(c, 1.4, '#232833');
    c.fillStyle = '#232833'; c.fillRect(-14, 0, 9, 3); c.fillRect(-11, -3, 3, 9);
    c.fillStyle = '#e2412b'; c.beginPath(); c.arc(9, 0, 3, 0, 7); c.fill(); c.fillStyle = '#2fa82f'; c.beginPath(); c.arc(14, 5, 3, 0, 7); c.fill();
    c.strokeStyle = '#232833'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(2, -16, 10, -18); c.stroke();
  },
  popup(c) {
    rr(c, -20, -16, 40, 32, [5, 5, 1, 1]); c.fillStyle = '#0a5ce6'; c.fill(); outline(c, 1.3, '#03338c');
    c.fillStyle = '#ffe600'; c.fillRect(-17, -7, 34, 20);
    c.fillStyle = '#e2412b'; rr(c, 10, -14, 7, 6, 1.5); c.fill();
    c.fillStyle = '#e2412b'; font(c, 11, 'bold'); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('WIN!', 0, 3);
  },
  warn(c) {
    c.beginPath(); c.moveTo(0, -19); c.lineTo(20, 16); c.lineTo(-20, 16); c.closePath();
    c.fillStyle = lg(c, -19, 16, '#ffe866', '#f2b705'); c.fill(); outline(c, 1.6, '#7a5a00');
    c.fillStyle = '#111'; c.fillRect(-2, -7, 4, 13); c.fillRect(-2, 9, 4, 4);
  },
  err(c) {
    c.beginPath(); c.arc(0, 0, 19, 0, 7); c.fillStyle = lg(c, -19, 19, '#ff7a6a', '#c81e10'); c.fill(); outline(c, 1.6, '#6a0a04');
    c.strokeStyle = '#fff'; c.lineWidth = 4.5; c.beginPath(); c.moveTo(-8, -8); c.lineTo(8, 8); c.moveTo(8, -8); c.lineTo(-8, 8); c.stroke();
  },
  ok(c) {
    c.beginPath(); c.arc(0, 0, 19, 0, 7); c.fillStyle = lg(c, -19, 19, '#8ee86a', '#22941c'); c.fill(); outline(c, 1.6, '#0f4f0c');
    c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.moveTo(-9, 0); c.lineTo(-2, 8); c.lineTo(10, -8); c.stroke();
  },
  info(c) {
    c.beginPath(); c.arc(0, 0, 19, 0, 7); c.fillStyle = lg(c, -19, 19, '#8fc6ff', '#1d5ed8'); c.fill(); outline(c, 1.6, '#0b2f7a');
    c.fillStyle = '#fff'; c.fillRect(-2.5, -3, 5, 14); c.beginPath(); c.arc(0, -9, 3, 0, 7); c.fill();
  },
  speaker(c, o) {
    c.beginPath(); c.moveTo(-16, -6); c.lineTo(-8, -6); c.lineTo(2, -15); c.lineTo(2, 15); c.lineTo(-8, 6); c.lineTo(-16, 6); c.closePath();
    c.fillStyle = lg(c, -15, 15, '#f1efe6', '#a9a494'); c.fill(); outline(c, 1.4, '#4d4a42');
    c.strokeStyle = o.off ? '#e2412b' : '#2f5fd0'; c.lineWidth = 3;
    if (o.off) { c.beginPath(); c.moveTo(7, -7); c.lineTo(18, 7); c.moveTo(18, -7); c.lineTo(7, 7); c.stroke(); }
    else { c.beginPath(); c.arc(4, 0, 8, -.8, .8); c.stroke(); c.beginPath(); c.arc(4, 0, 15, -.8, .8); c.stroke(); }
  },
  bug(c) {
    c.strokeStyle = '#1a3a10'; c.lineWidth = 2.4;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-6, i * 6); c.lineTo(-19, i * 9 - 2); c.moveTo(6, i * 6); c.lineTo(19, i * 9 - 2); c.stroke(); }
    c.beginPath(); c.ellipse(0, 3, 11, 14, 0, 0, 7); c.fillStyle = lg(c, -11, 17, '#9df05a', '#2f8a1a'); c.fill(); outline(c, 1.6, '#1a3a10');
    c.beginPath(); c.arc(0, -11, 7, 0, 7); c.fillStyle = '#2f8a1a'; c.fill(); outline(c, 1.4, '#1a3a10');
    c.fillStyle = '#ff2a2a'; c.beginPath(); c.arc(-3, -12, 2, 0, 7); c.arc(3, -12, 2, 0, 7); c.fill();
    c.strokeStyle = '#1a3a10'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, -4); c.lineTo(0, 16); c.stroke();
  },
  calc(c) {
    rr(c, -14, -19, 28, 38, 3); c.fillStyle = lg(c, -19, 19, '#e8e6dc', '#a9a494'); c.fill(); outline(c, 1.4, '#4d4a42');
    c.fillStyle = '#b8d8a8'; c.fillRect(-10, -15, 20, 8);
    c.fillStyle = '#4d4a42'; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c.fillRect(-10 + i * 7.5, -3 + j * 7, 5, 5);
  },
  clock(c) {
    c.beginPath(); c.arc(0, 0, 19, 0, 7); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#1d5ed8'; c.lineWidth = 3.5; c.stroke();
    c.strokeStyle = '#111'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -12); c.moveTo(0, 0); c.lineTo(8, 4); c.stroke();
  },
  key(c) {
    c.strokeStyle = '#8a6a18'; c.fillStyle = lg(c, -18, 18, '#ffe58a', '#d9a520'); c.lineWidth = 1.4;
    c.beginPath(); c.arc(-9, -4, 9, 0, 7); c.fill(); c.stroke();
    c.fillRect(-2, -7, 22, 6); c.strokeRect(-2, -7, 22, 6); c.fillRect(12, -1, 4, 7); c.fillRect(17, -1, 3, 5);
    c.fillStyle = '#fff8'; c.beginPath(); c.arc(-9, -4, 3.5, 0, 7); c.fillStyle = '#9a7a20'; c.fill();
  },
  paint(c) {
    c.beginPath(); c.ellipse(0, 2, 20, 16, -.2, 0, 7); c.fillStyle = lg(c, -14, 18, '#fff3d6', '#e2c89a'); c.fill(); outline(c, 1.4, '#7a5a30');
    [['#e2412b', -9, -4], ['#ffd500', 0, -8], ['#2f8ae0', 9, -3], ['#2fa82f', 8, 8]].forEach(([col, a, b]) => { c.fillStyle = col; c.beginPath(); c.arc(a, b, 3.6, 0, 7); c.fill(); });
    c.fillStyle = '#c9b48a'; c.beginPath(); c.arc(-6, 8, 4, 0, 7); c.fill();
  },
  monkey(c) {
    c.fillStyle = '#7a4a22';
    c.beginPath(); c.arc(-17, -2, 7, 0, 7); c.arc(17, -2, 7, 0, 7); c.fill();
    c.beginPath(); c.arc(0, 0, 18, 0, 7); c.fill(); outline(c, 1.4, '#3a200a');
    c.fillStyle = '#f2c89a';
    c.beginPath(); c.ellipse(0, 5, 12, 10, 0, 0, 7); c.fill();
    c.beginPath(); c.arc(-6, -4, 6, 0, 7); c.arc(6, -4, 6, 0, 7); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(-6, -4, 2.6, 0, 7); c.arc(6, -4, 2.6, 0, 7); c.fill();
    c.strokeStyle = '#3a200a'; c.lineWidth = 1.8; c.beginPath(); c.arc(0, 6, 6, .3, 2.8); c.stroke();
  },
  bitsy(c, o) {
    // the desktop helper: a floppy disk with big eyes
    rr(c, -18, -18, 36, 36, [2, 7, 2, 2]); c.fillStyle = lg(c, -18, 18, '#ff8a3d', '#d4500e'); c.fill(); outline(c, 1.6, '#6a2404');
    c.fillStyle = '#d6dbe6'; c.fillRect(-8, -18, 15, 9);
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(-7, 2, 6, 7.5, 0, 0, 7); c.ellipse(7, 2, 6, 7.5, 0, 0, 7); c.fill(); outline(c, 1.2, '#6a2404');
    const lx = o.look ? o.look[0] : 0, ly = o.look ? o.look[1] : 0;
    c.fillStyle = '#111'; c.beginPath(); c.arc(-7 + lx * 2.5, 3 + ly * 2.5, 2.8, 0, 7); c.arc(7 + lx * 2.5, 3 + ly * 2.5, 2.8, 0, 7); c.fill();
    c.strokeStyle = '#6a2404'; c.lineWidth = 1.6; c.beginPath();
    if (o.scared) c.arc(0, 15, 3, 0, 7); else c.arc(0, 11, 4, .4, 2.7);
    c.stroke();
    c.beginPath(); c.moveTo(-12, -7); c.lineTo(-3, -6); c.moveTo(12, -7); c.lineTo(3, -6); c.stroke();
  },
};
export const ICON_TYPES = Object.keys(ICONS);

export function deskLabel(c, text, x, y, size, sel) {
  font(c, size); c.textAlign = 'center'; c.textBaseline = 'top';
  const w = c.measureText(text).width;
  if (sel) { c.fillStyle = C.sel; c.fillRect(x - w / 2 - 3, y - 1, w + 6, size + 4); }
  else { c.fillStyle = 'rgba(0,0,0,.7)'; c.fillText(text, x + 1, y + 1); }
  c.fillStyle = '#fff'; c.fillText(text, x, y);
}

// Segmented green progress bar
export function progress(c, x, y, w, h, f, o = {}) {
  c.fillStyle = '#fff'; rr(c, x, y, w, h, 3); c.fill(); c.strokeStyle = '#686868'; c.lineWidth = 1; c.stroke();
  const seg = Math.max(6, h * .55), gap = Math.max(2, h * .14);
  const n = Math.floor((w - 6) / (seg + gap));
  const on = Math.round(n * Math.max(0, Math.min(1, f)));
  for (let i = 0; i < on; i++) {
    const sx = x + 3 + i * (seg + gap);
    const g = c.createLinearGradient(0, y + 3, 0, y + h - 3);
    const col = o.color || ['#c8f7b0', '#37c52b', '#1f9a1a'];
    g.addColorStop(0, col[0]); g.addColorStop(.5, col[1]); g.addColorStop(1, col[2]);
    c.fillStyle = g; c.fillRect(sx, y + 3, seg, h - 6);
  }
}

export function arrowHint(c, x, y, t, size = 1) {
  // a bouncing yellow arrow pointing down at (x, y)
  const b = Math.abs(Math.sin(t * 6)) * 10 * size;
  c.save(); c.translate(x, y - 6 - b); c.scale(size, size);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(-16, -20); c.lineTo(-6, -20); c.lineTo(-6, -42); c.lineTo(6, -42); c.lineTo(6, -20); c.lineTo(16, -20); c.closePath();
  c.fillStyle = '#ffe600'; c.fill(); c.strokeStyle = '#111'; c.lineWidth = 2.5; c.stroke();
  c.restore();
}

export function hand(c, x, y, down, s = 1) {
  // a pointing hand cursor, fingertip at (x, y)
  c.save(); c.translate(x, y); c.scale(s, s); if (down) c.scale(.92, .92);
  c.beginPath();
  c.moveTo(-3, 0); c.quadraticCurveTo(0, -3, 3, 0); c.lineTo(3, 14); c.lineTo(9, 13); c.quadraticCurveTo(12, 13, 12, 16);
  c.lineTo(15, 16); c.quadraticCurveTo(18, 16, 18, 20); c.lineTo(18, 30); c.quadraticCurveTo(16, 38, 8, 38); c.lineTo(0, 38);
  c.quadraticCurveTo(-6, 36, -9, 28); c.lineTo(-12, 20); c.quadraticCurveTo(-12, 17, -8, 18); c.lineTo(-3, 22); c.closePath();
  c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#111'; c.lineWidth = 2; c.stroke();
  c.restore();
}
