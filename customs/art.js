// Customs of the Dead: every picture is drawn here, pixel by pixel.

export const C = {
  ink: '#1e1b22', bone: '#eadfc4', boneSh: '#c7b690', paper: '#e6d8b4',
  red: '#b23b2c', ox: '#7a2a24', mari: '#e3962b', mustard: '#c9a23c', rose: '#cc6b78', teal: '#3d7a72',
  violet: '#6e5683', sage: '#7f9070', wood: '#5b3a28', wood2: '#3e271c', woodHi: '#7a5236',
  sky0: '#141c25', sky1: '#1a2830', sky2: '#22353a', hill: '#111a20', silver: '#dff1f4', straw: '#cfa65c',
};
const RING = [C.mari, C.rose, C.teal, C.red, C.violet];
const SHIRT = ['#2f5b57', '#8a3a2c', '#56476b', '#b8902f', '#3b4a63', '#66745a'];

// ---------------------------------------------------------------- pixel buffers
function grid(w, h) { return { w, h, p: new Array(w * h).fill(null) }; }
const put = (g, x, y, c) => { if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.p[y * g.w + x] = c; };
const get = (g, x, y) => (x >= 0 && y >= 0 && x < g.w && y < g.h) ? g.p[y * g.w + x] : null;
function rect(g, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(g, x + i, y + j, c); }
function pattern(g, x, y, rows, map) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (map[ch]) put(g, x + i, y + j, map[ch]); }));
}
export function blit(ctx, g, ox, oy, s, alpha = 1) {
  ctx.globalAlpha = alpha;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const c = g.p[y * g.w + x];
    if (c) { ctx.fillStyle = c; ctx.fillRect(ox + x * s, oy + y * s, s, s); }
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- faces (24 x 24)
const MOTIF = [
  [['.rr.', 'rYYr', '.rr.'], { r: C.rose, Y: C.mari }],
  [['r..r', 'rrrr', '.rr.'], { r: C.red }],
  [['Y..Y', '.YY.', 'Y..Y'], { Y: C.mari }],
  [['.tt.', 'tttt', '.tt.'], { t: C.teal }],
  [['v..v', '....', 'v..v'], { v: C.violet }],
];
const faceCache = new Map();
export function faceGrid(f) {
  const key = [f.hat, f.motif, f.ring, f.shirt, f.mous, f.glasses, f.flower].join();
  if (faceCache.has(key)) return faceCache.get(key);
  const g = grid(24, 24), ring = RING[f.ring];
  // shoulders
  rect(g, 4, 21, 16, 3, SHIRT[f.shirt]); rect(g, 3, 22, 18, 2, SHIRT[f.shirt]);
  rect(g, 10, 20, 4, 2, C.boneSh); put(g, 11, 21, C.ink);
  if (f.hat === 5) { // rebozo shawl behind the head
    for (let y = 2; y < 22; y++) for (let x = 2; x < 22; x++) {
      const dx = (x - 11.5) / 9.5, dy = (y - 11) / 10;
      if (dx * dx + dy * dy <= 1) put(g, x, y, (x + y) % 4 < 2 ? '#7c3b5a' : '#93506f');
    }
    rect(g, 3, 21, 18, 3, '#7c3b5a');
  }
  if (f.hat === 6) { // hair and a bun
    for (let y = 2; y < 17; y++) for (let x = 3; x < 21; x++) {
      const dx = (x - 11.5) / 8.4, dy = (y - 10) / 8;
      if (dx * dx + dy * dy <= 1) put(g, x, y, '#2a2226');
    }
    rect(g, 9, 0, 6, 3, '#2a2226'); rect(g, 10, 0, 4, 1, '#3a3036');
  }
  // skull
  for (let y = 3; y < 18; y++) for (let x = 3; x < 21; x++) {
    const dx = (x - 11.5) / 7.2, dy = (y - 10.5) / 7.6;
    if (dx * dx + dy * dy <= 1) put(g, x, y, x >= 17 && get(g, x + 1, y) !== C.bone ? C.boneSh : C.bone);
  }
  rect(g, 8, 17, 8, 2, C.bone); rect(g, 9, 19, 6, 1, C.bone); put(g, 15, 18, C.boneSh);
  // eyes: petals then sockets
  for (const ex of [6, 13]) {
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const edge = i === 0 || j === 0 || i === 4 || j === 4, corner = (i === 0 || i === 4) && (j === 0 || j === 4);
      if (edge && !corner) put(g, ex + i, 9 + j, f.glasses ? C.ink : ring);
    }
    rect(g, ex + 1, 10, 3, 3, C.ink); put(g, ex + 1, 10, '#5a5262');
  }
  if (f.glasses) { put(g, 11, 10, C.ink); put(g, 12, 10, C.ink); }
  // nose, cheeks, teeth
  put(g, 11, 14, C.ink); put(g, 12, 14, C.ink); put(g, 11, 13, C.boneSh);
  put(g, 5, 14, ring); put(g, 18, 14, ring);
  rect(g, 8, 16, 8, 1, C.ink); for (let x = 8; x < 16; x += 2) put(g, x + 1, 17, C.ink); rect(g, 9, 18, 6, 1, C.ink);
  if (f.mous) { rect(g, 8, 15, 8, 1, C.ink); put(g, 7, 16, C.ink); put(g, 16, 16, C.ink); put(g, 11, 15, '#3a3036'); }
  const [rows, map] = MOTIF[f.motif];
  pattern(g, 10, 5, rows, map);
  // hats
  if (f.hat === 1) { // sombrero
    rect(g, 7, 0, 10, 4, C.straw); rect(g, 8, 0, 8, 1, '#ddb874'); rect(g, 7, 3, 10, 1, C.red);
    rect(g, 1, 4, 22, 1, C.straw); rect(g, 0, 5, 24, 1, '#a9853f');
  } else if (f.hat === 2) { // flat cap
    rect(g, 5, 2, 14, 3, '#4a4650'); rect(g, 6, 1, 12, 1, '#4a4650'); rect(g, 3, 5, 10, 1, '#36323b'); rect(g, 6, 2, 12, 1, '#5b5662');
  } else if (f.hat === 3) { // bowler
    rect(g, 8, 0, 8, 4, C.ink); rect(g, 7, 1, 10, 3, C.ink); rect(g, 9, 0, 6, 1, '#3a3540'); rect(g, 4, 4, 16, 1, C.ink); rect(g, 7, 3, 10, 1, C.ox);
  } else if (f.hat === 4) { // flower crown
    for (let x = 5; x < 19; x += 2) { put(g, x, 4, x % 4 === 1 ? C.mari : C.rose); put(g, x + 1, 3, C.sage); }
    put(g, 11, 2, C.mari); put(g, 12, 2, C.mari);
  } else if (f.hat === 5) {
    rect(g, 5, 2, 14, 2, '#93506f'); rect(g, 4, 3, 2, 3, '#7c3b5a'); rect(g, 18, 3, 2, 3, '#7c3b5a');
  }
  if (f.flower) {
    pattern(g, 16, 0, ['.RR.', 'RDDR', 'RDDR', '.RR.', '..g.'], { R: '#e0402e', D: '#8c1f1a', g: C.sage });
  }
  faceCache.set(key, g);
  return g;
}

export function faceCanvas(f, s = 2, bg = null) {
  const cv = document.createElement('canvas');
  cv.width = 24 * s; cv.height = 24 * s;
  const ctx = cv.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, cv.width, cv.height); }
  blit(ctx, faceGrid(f), 0, 0, s);
  return cv;
}

// ---------------------------------------------------------------- small icons
const ICONS = {
  moth: ['x.......x', 'xx..x..xx', 'xxx.x.xxx', '.xxxxxxx.', '..xx.xx..', '.xx...xx.', '.x.....x.'],
  key: ['.xxx.....', 'x...x....', 'x...xxxxx', 'x...x.x.x', '.xxx..x.x'],
  hand: ['..x.x.x..', '..x.x.x..', 'x.x.x.x..', 'xxxxxxx..', 'xxxxxxx..', '.xxxxx...', '..xxx....'],
  eye: ['..xxxxx..', '.x.....x.', 'x..xxx..x', 'x..xxx..x', '.x.....x.', '..xxxxx..'],
  bell: ['....x....', '...xxx...', '..xxxxx..', '..xxxxx..', '.xxxxxxx.', 'xxxxxxxxx', '....x....'],
  moon: ['...xxx...', '.xxx.....', '.xx......', 'xx.......', '.xx......', '.xxx.....', '...xxx...'],
  star: ['....x....', '....x....', 'xxxxxxxxx', '..xxxxx..', '..xx.xx..', '.xx...xx.'],
  skull: ['..xxxxx..', '.xxxxxxx.', '.x..x..x.', '.xxxxxxx.', '..xx.xx..', '..x.x.x..'],
  orchard: ['...xxxxx...', '..xx.xxxx..', '.xxxxxx.xx.', '.x.xxxxxxx.', '..xxxx.xx..', '....xxx....', '.....x.....', '.....x.....', '...xxxxx...'],
  stair: ['xxxx.......', '...x.......', '...xxxx....', '......x....', '......xxxx.', '.........x.', '.........xx', '..........x'],
  return: ['...x.......', '..xx.......', '.xxxxxxxx..', 'xxxxxxxxxx.', '.xxxxxxxxxx', '..xx.....xx', '...x.....xx', '.........xx', '..xxxxxxxx.'],
  paw: ['.x.x.', 'x...x', '..x..', '.xxx.', '.xxx.'],
  lens: ['.xxx...', 'x...x..', 'x...x..', 'x...x..', '.xxxx..', '....xx.', '.....xx'],
  book: ['xxxx.xxxx', 'x..x.x..x', 'x.xx.xx.x', 'x..x.x..x', 'x.xx.xx.x', 'x..xxx..x', 'xxxx.xxxx'],
  coin: ['.xxx.', 'x.x.x', 'xx.xx', 'x.x.x', '.xxx.'],
  candle: ['..y..', '.yoy.', '..o..', '.xxx.', '.xxx.', '.xxx.', '.xxx.'],
};
const iconCache = new Map();
export function iconURL(name, color = C.ink, s = 3, extra = {}) {
  const k = name + color + s;
  if (iconCache.has(k)) return iconCache.get(k);
  const rows = ICONS[name], w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const cv = document.createElement('canvas'); cv.width = w * s; cv.height = h * s;
  const ctx = cv.getContext('2d');
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    const c = ch === 'x' ? color : ch === 'y' ? C.mari : ch === 'o' ? '#fff3c4' : extra[ch];
    if (c) { ctx.fillStyle = c; ctx.fillRect(i * s, j * s, s, s); }
  }));
  const url = cv.toDataURL();
  iconCache.set(k, url);
  return url;
}

// A registrar seal: a ring of ink with the icon inside.
export function sealCanvas(name, s = 2, color = C.red) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 17 * s;
  const ctx = cv.getContext('2d'), g = grid(17, 17);
  for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) {
    const d = Math.hypot(x - 8, y - 8);
    if (d <= 8.2 && d >= 6.9) put(g, x, y, color);
    else if (d < 6.9 && (x + y) % 2 === 0 && d > 6) put(g, x, y, color);
  }
  const rows = ICONS[name], w = Math.max(...rows.map(r => r.length));
  pattern(g, Math.floor((17 - w) / 2), Math.floor((17 - rows.length) / 2), rows, { x: color });
  blit(ctx, g, 0, 0, s);
  return cv;
}

// Tally marks in groups of five.
export function tallyCanvas(n, s = 2, color = C.ink) {
  const groups = Math.ceil(n / 5), w = Math.max(1, groups * 11 - 2), h = 9;
  const cv = document.createElement('canvas'); cv.width = w * s; cv.height = h * s;
  const ctx = cv.getContext('2d'); ctx.fillStyle = color;
  for (let k = 0; k < n; k++) {
    const gI = Math.floor(k / 5), i = k % 5, gx = gI * 11;
    if (i < 4) ctx.fillRect((gx + i * 2 + 1) * s, 1 * s, s, 7 * s);
    else for (let t = 0; t < 9; t++) ctx.fillRect((gx + t) * s, (8 - t) * s, s, s);
  }
  return cv;
}

// ---------------------------------------------------------------- the window
const CAT = ['x...x...', 'xx.xx...', 'xoxox...', 'xxxxx..x', '.xxxx.x.', '.xxxxxx.', '.xxxxxx.', '.x.x.x.x'];
const DOG = ['xx.........', 'xxxx.......', 'xoxxx......', 'xxxxx.....x', '..xxxxxxxx.', '..xxxxxxxx.', '..xxxxxxxx.', '..x.x..x.x.'];
const PICADO = ['#cc6b78', '#e3962b', '#3d7a72', '#b23b2c', '#6e5683', '#c9a23c'];

export class Booth {
  constructor(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.W = 180; this.H = 80; this.s = 2;
    this.soul = null; this.x = 0; this.y = 0; this.mode = 'empty'; this.t0 = 0; this.dest = null;
    this.queue = 6; this.shuffle = 0; this.flash = 0; this.pick = false; this.petals = [];
  }
  resize(cssW, cssH) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const s = Math.max(1, Math.floor((cssH * dpr) / 80));
    this.s = s; this.H = 80; this.W = Math.ceil(cssW * dpr / s);
    this.cv.width = this.W * s; this.cv.height = this.H * s;
    this.cssScale = s / dpr;
  }
  // where the face is, in CSS pixels relative to the canvas, for taps and threads
  faceRect() {
    const k = this.cssScale, bx = this.bustX();
    return { x: bx * k, y: (this.H - 58) * k, w: 48 * k, h: 48 * k };
  }
  bustX() { return Math.round(this.W * .58 - 24); }
  arrive(soul, now) { this.soul = soul; this.mode = 'in'; this.t0 = now; }
  leave(dest, now) { this.mode = 'out'; this.dest = dest; this.t0 = now; this.shuffle = now; if (dest === 'orchard') this.burst(); }
  burst() { for (let i = 0; i < 18; i++) this.petals.push({ x: this.bustX() + 24 + (Math.random() - .5) * 30, y: this.H - 40 + (Math.random() - .5) * 20, vx: (Math.random() - .3) * 30, vy: -10 - Math.random() * 30, life: 1.4 }); }

  draw(now, dt) {
    const { ctx, W, H, s } = this;
    const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x) * s, Math.round(y) * s, w * s, h * s); };
    // sky in hard bands with dithered seams
    const bands = [[0, C.sky0], [26, C.sky1], [46, C.sky2]];
    bands.forEach(([y0, c], i) => R(0, y0, W, (bands[i + 1]?.[0] ?? H) - y0, c));
    for (const [y0, , ] of bands.slice(1)) for (let x = 0; x < W; x += 2) R(x, y0, 1, 1, i2c(bands, y0));
    // constructivist rays behind the far gate
    const gx = W * .86;
    ctx.globalAlpha = .18;
    for (let a = 0; a < 7; a++) {
      ctx.fillStyle = a % 2 ? C.mari : C.ox;
      ctx.beginPath(); ctx.moveTo(gx * s, 46 * s);
      const a0 = Math.PI + a * Math.PI / 7, a1 = a0 + Math.PI / 14;
      ctx.lineTo((gx + Math.cos(a0) * 140) * s, (46 + Math.sin(a0) * 140) * s);
      ctx.lineTo((gx + Math.cos(a1) * 140) * s, (46 + Math.sin(a1) * 140) * s);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // stars
    for (let i = 0; i < 40; i++) {
      const x = (i * 73) % W, y = (i * 37) % 40;
      if ((i + Math.floor(now / 700)) % 9) R(x, y, 1, 1, i % 5 ? '#55606a' : '#c9c2a6');
    }
    // moon
    for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) if (x * x + y * y <= 50) R(W * .16 + x, 16 + y, 1, 1, x * x + y * y > 36 ? '#bfb393' : '#e6dab8');
    R(W * .16 + 1, 13, 2, 2, '#cfc3a1'); R(W * .16 - 3, 18, 2, 1, '#cfc3a1');
    // hills, the far gate and orchard
    for (let x = 0; x < W; x++) {
      const h = 50 + Math.round(Math.sin(x * .05) * 3 + Math.sin(x * .13 + 1) * 1.5);
      R(x, h, 1, H - h, C.hill);
    }
    R(gx - 6, 34, 2, 13, '#2b3a3e'); R(gx + 5, 34, 2, 13, '#2b3a3e'); R(gx - 6, 32, 13, 2, '#2b3a3e');
    R(gx - 4, 34, 9, 13, '#e3962b33');
    for (let i = 0; i < 4; i++) { const tx = gx + 12 + i * 6; R(tx, 40, 1, 7, '#2b3a3e'); R(tx - 2, 36, 5, 4, '#26413c'); R(tx - 1 + (i % 2), 37, 1, 1, C.mari); }
    // ground and the queue
    R(0, 58, W, H - 58, '#0e161b');
    for (let x = 0; x < W; x += 3) R(x, 58, 1, 1, '#1b272d');
    const bx = this.bustX();
    const shuffleT = Math.min(1, (now - this.shuffle) / 900);
    for (let i = 0; i < this.queue; i++) {
      const qx = bx - 14 - i * 13 + (1 - shuffleT) * -13 * 0, bob = Math.round(Math.sin(now / 400 + i) * .6);
      const x = qx + (shuffleT < 1 ? (shuffleT - 1) * 13 : 0);
      if (x < -8) continue;
      R(x + 1, 44 + bob, 5, 5, '#cdbf9c'); R(x + 2, 46 + bob, 1, 1, C.ink); R(x + 4, 46 + bob, 1, 1, C.ink);
      R(x, 49 + bob, 7, 9, SHIRT[i % 6]); R(x + 6, 50 + bob, 1, 3, '#e9d9a4');
      if ((Math.floor(now / 160) + i) % 3) R(x + 6, 49 + bob, 1, 1, C.mari);
    }
    // papel picado
    const sway = Math.round(Math.sin(now / 900));
    for (let x = 0; x < W; x++) R(x, 3 + Math.round(Math.sin(x / W * Math.PI) * 3), 1, 1, '#6b6152');
    for (let i = 0, x = 3; x < W - 4; i++, x += 9) {
      const y = 4 + Math.round(Math.sin((x + 3) / W * Math.PI) * 3) + (i % 2 ? sway : 0);
      R(x, y, 7, 7, PICADO[i % 6]);
      R(x + 1, y + 2, 1, 1, C.sky0); R(x + 5, y + 2, 1, 1, C.sky0); R(x + 3, y + 4, 1, 1, C.sky0); R(x + 2, y + 6, 1, 1, C.sky0); R(x + 4, y + 6, 1, 1, C.sky0);
    }

    // the soul
    let ox = 0, oy = 0, a = 1;
    const t = (now - this.t0) / 1000;
    if (this.mode === 'in') { const k = Math.min(1, t / .9); ox = (1 - ease(k)) * -70; oy = Math.abs(Math.sin(k * 10)) * -2 * (1 - k); if (k >= 1) this.mode = 'idle'; }
    if (this.mode === 'out') {
      const k = Math.min(1, t / 1.0);
      if (this.dest === 'orchard') { ox = ease(k) * 90; oy = -ease(k) * 14; a = 1 - k * .6; }
      else if (this.dest === 'stair') { oy = ease(k) * 56; }
      else { ox = -ease(k) * 90; a = 1 - k * .5; }
      if (k >= 1) { this.mode = 'empty'; this.soul = null; }
    }
    if (this.soul) {
      const sx = bx + ox, sy = H - 58 + oy + Math.round(Math.sin(now / 700) * .6);
      if (this.soul.cord && this.mode !== 'out') {
        const fl = .55 + .45 * Math.sin(now / 130) * Math.sin(now / 370);
        ctx.globalAlpha = Math.max(.25, fl);
        for (let y = 0; y < sy + 2; y++) {
          const cx = sx + 24 + Math.round(Math.sin(y * .35 + now / 300) * 1.5);
          ctx.globalAlpha = Math.max(.12, fl * .35); R(cx - 1, y, 3, 1, '#9fd3de');
          ctx.globalAlpha = Math.max(.3, fl); R(cx, y, 1, 1, C.silver);
        }
        ctx.globalAlpha = 1;
      }
      blit(ctx, faceGrid(this.soul.face), sx * s, sy * s, s * 2, a);
      if (this.pick) { ctx.strokeStyle = C.mari; ctx.lineWidth = s; ctx.strokeRect((sx - 1) * s, (sy - 1) * s, 50 * s, 50 * s); }
      if (this.soul.pet) {
        const cat = this.soul.pet === 'cat', P = cat ? CAT : DOG, px = sx - (cat ? 14 : 20), py = H - 10 - P.length * 2;
        const body = cat ? '#d8c9a8' : '#9a7448', edge = cat ? '#8f7f66' : '#5e4128';
        P.forEach((row, j) => [...row].forEach((ch, i) => {
          if (ch === '.') return;
          const c = ch === 'o' ? (cat ? '#4f8a3a' : C.ink) : (j === P.length - 1 || i === 0 ? edge : body);
          R(px + i * 2, py + j * 2, 2, 2, c);
        }));
      }
    }
    // petals
    this.petals = this.petals.filter(p => (p.life -= dt) > 0);
    for (const p of this.petals) { p.vy += 40 * dt; p.x += p.vx * dt; p.y += p.vy * dt; R(p.x, p.y, 1, 1, p.life > .7 ? C.mari : C.red); }

    // the booth itself
    R(0, 0, 3, H, C.wood); R(W - 3, 0, 3, H, C.wood); R(2, 0, 1, H, C.woodHi); R(W - 3, 0, 1, H, C.wood2);
    R(0, H - 10, W, 10, C.wood); R(0, H - 10, W, 1, C.woodHi); R(0, H - 2, W, 2, C.wood2);
    for (let x = 6; x < W; x += 17) R(x, H - 7, 8, 1, C.wood2);
    R(Math.round(W * .58) - 16, H - 9, 32, 2, C.wood2);
    // the lamp
    const lx = Math.round(W * .3);
    R(lx, 0, 1, 10, '#40372f'); R(lx - 2, 10, 5, 2, '#40372f'); R(lx - 1, 12, 3, 2, (Math.floor(now / 90) % 23) ? '#f2c66a' : '#b48c40');
    if (this.flash > 0) { this.flash -= dt; ctx.globalAlpha = Math.max(0, this.flash) * .6; R(0, 0, W, H, '#fff3d0'); ctx.globalAlpha = 1; }
  }
}
function i2c(bands, y0) { const i = bands.findIndex(b => b[0] === y0); return bands[i - 1][1]; }
const ease = k => 1 - Math.pow(1 - k, 3);

// ---------------------------------------------------------------- the poster
// A big calavera on a red diagonal and a marigold sun, for the title and day cards.
export function posterCanvas(face, w, h, s, opts = {}) {
  const cv = document.createElement('canvas'); cv.width = w * s; cv.height = h * s;
  const ctx = cv.getContext('2d');
  const R = (x, y, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(x * s, y * s, ww * s, hh * s); };
  R(0, 0, w, h, opts.bg || '#2a2730');
  // sun
  const cx = w * .62, cy = h * .46, rr = Math.min(w, h) * .36;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d < rr) R(x, y, 1, 1, d > rr - 2 ? '#c27a22' : C.mari);
  }
  // red band
  for (let y = 0; y < h; y++) {
    const x0 = Math.round(y * .9 - h * .25), x1 = x0 + Math.round(w * .28);
    R(Math.max(0, x0), y, Math.max(0, Math.min(w, x1) - Math.max(0, x0)), 1, C.red);
  }
  // halftone dots
  for (let y = 1; y < h; y += 3) for (let x = (y % 2); x < w; x += 3) if (x / w + y / h > 1.3) R(x, y, 1, 1, '#00000033');
  const fs = Math.floor(Math.min(w * .6, h * .8) / 24);
  blit(ctx, faceGrid(face), Math.round(cx - 12 * fs) * s, Math.round(cy - 12 * fs + 2) * s, fs * s);
  // picado
  for (let i = 0, x = 1; x < w; i++, x += 8) {
    R(x, 0, 7, 6, PICADO[i % 6]); R(x + 2, 2, 1, 1, opts.bg || '#2a2730'); R(x + 4, 2, 1, 1, opts.bg || '#2a2730'); R(x + 3, 4, 1, 1, opts.bg || '#2a2730');
  }
  return cv;
}
