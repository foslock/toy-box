// Draws a hole top-down: the room is painted once in daylight colours, then
// multiplied by a night light-map (moonlight through the windows, night-lights),
// and the glowing things (ball, ripples, meters, Zzz) go on top, unlit.
import { BALL_R, CUP_R, MAX_V, hear } from './game.js';

const TAU = Math.PI * 2;
const WALL = 16;   // wall thickness drawn outside the room

// ---------- tiny drawing helpers
function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
function ell(c, x, y, rx, ry, a = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, a, 0, TAU); }
function shadow(c, draw, dx = 3, dy = 4, a = 0.28) {
  c.save(); c.translate(dx, dy); c.fillStyle = `rgba(20,16,40,${a})`; draw(); c.fill(); c.restore();
}
// a seeded random so the same room always gets the same speckles
function rng(seed) { let s = seed | 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

const SKIN = ['#f0c9a4', '#c99872', '#8d5b3e', '#f3d2b8', '#e2b28c'];
const HAIR = ['#5a3a26', '#1f1a1a', '#b5651d', '#d9c9b0', '#3b2a1a', '#e6d36a'];

export class View {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.bake = document.createElement('canvas');
    this.light = document.createElement('canvas');
    this.ripples = [];
    this.words = [];
    this.trail = [];
    this.sparks = [];
    this.lightsOn = 0;   // 0..1 when someone wakes
    this.dawn = 0;
    this.top = 58; this.bottom = 12;
  }

  // ---------- fitting the hole to the screen (rotated on wide screens)
  fit(hole) {
    this.h = hole;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = innerWidth, H = innerHeight;
    this.dpr = dpr; this.W = W; this.H = H;
    for (const c of [this.cv, this.bake, this.light]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px';
    const aw = W - 24, ah = H - this.top - this.bottom;
    const hw = hole.w + WALL * 2 + 8, hh = hole.h + WALL * 2 + 8;
    const s0 = Math.min(aw / hw, ah / hh), s1 = Math.min(aw / hh, ah / hw);
    this.rot = s1 > s0 * 1.12 ? 1 : 0;
    const s = this.rot ? s1 : s0;
    this.s = s;
    const sw = (this.rot ? hole.h : hole.w) * s, sh = (this.rot ? hole.w : hole.h) * s;
    this.ox = (W - sw) / 2;
    this.oy = this.top + (ah - sh) / 2;
    this.paintBake();
    this.paintLight();
  }
  // world → CSS px
  sx(x, y) { return this.rot ? this.ox + (this.h.h - y) * this.s : this.ox + x * this.s; }
  sy(x, y) { return this.rot ? this.oy + x * this.s : this.oy + y * this.s; }
  // CSS px → world
  wx(X, Y) { return this.rot ? (Y - this.oy) / this.s : (X - this.ox) / this.s; }
  wy(X, Y) { return this.rot ? this.h.h - (X - this.ox) / this.s : (Y - this.oy) / this.s; }
  // a screen-space vector → world vector
  wv(dx, dy) { return this.rot ? [dy, -dx] : [dx, dy]; }
  world(c) {
    const s = this.s * this.dpr, d = this.dpr;
    if (this.rot) c.setTransform(0, s, -s, 0, (this.ox + this.h.h * this.s) * d, this.oy * d);
    else c.setTransform(s, 0, 0, s, this.ox * d, this.oy * d);
  }
  screen(c) { c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }

  // ---------- the daylight painting
  paintBake() {
    const c = this.bake.getContext('2d'), h = this.h;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#2a2740';
    c.fillRect(0, 0, this.bake.width, this.bake.height);
    this.world(c);
    // walls
    c.fillStyle = '#4a4466';
    c.fillRect(-WALL, -WALL, h.w + WALL * 2, h.h + WALL * 2);
    c.fillStyle = '#5d5680';
    c.fillRect(-WALL / 2, -WALL / 2, h.w + WALL, h.h + WALL);
    // floor
    c.save();
    c.beginPath();
    h.room.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.clip();
    this.floor(c, h.floor, [0, 0, h.w, h.h], 1);
    (h.zones || []).forEach((z, i) => this.zone(c, z, i + 2));
    if (h.stairs) this.stairs(c, h.stairs.r);
    for (const sl of h.slopes || []) this.slope(c, sl);
    if (h.track) this.track(c, h.track);
    // furniture shadows first, then furniture
    for (const b of h.blocks || []) shadow(c, () => rr(c, b.r[0], b.r[1], b.r[2], b.r[3], 6));
    for (const r of h.rounds || []) if (r.kind !== 'duck') shadow(c, () => circ(c, r.x, r.y, r.r));
    for (const b of h.blocks || []) this.block(c, b);
    for (const r of h.rounds || []) if (r.kind !== 'duck') this.round(c, r);
    for (const s of h.segs || []) this.seg(c, s);
    this.cup(c, h.cup);
    // skirting
    c.restore();
    c.strokeStyle = '#efe4cf'; c.lineWidth = 2.2;
    c.beginPath(); h.room.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke();
    for (const d of h.doors || []) this.door(c, d, false);
    for (const s of h.sleepers) if (s.kind === 'door') this.door(c, s, true);
    for (const w of h.windows || []) this.window(c, w);
  }

  floor(c, m, r, seed) {
    const [x, y, w, hh] = r, R = rng(seed * 977);
    if (m === 'wood') {
      c.fillStyle = '#b98b5c'; c.fillRect(x, y, w, hh);
      for (let yy = y; yy < y + hh; yy += 14) {
        c.fillStyle = R() < 0.5 ? '#c49668' : '#ad7f52';
        c.fillRect(x, yy, w, 13);
        c.fillStyle = '#8e6440';
        c.fillRect(x, yy + 13, w, 1);
        let xx = x - R() * 120;
        while (xx < x + w) { xx += 70 + R() * 90; c.fillRect(xx, yy, 1, 13); }
      }
    } else if (m === 'carpet') {
      c.fillStyle = '#7f6a8e'; c.fillRect(x, y, w, hh);
      c.fillStyle = 'rgba(255,255,255,.05)';
      for (let i = 0; i < (w * hh) / 30; i++) c.fillRect(x + R() * w, y + R() * hh, 1.4, 1.4);
      c.fillStyle = 'rgba(0,0,0,.06)';
      for (let i = 0; i < (w * hh) / 30; i++) c.fillRect(x + R() * w, y + R() * hh, 1.4, 1.4);
    } else if (m === 'tile') {
      c.fillStyle = '#d9d3c4'; c.fillRect(x, y, w, hh);
      for (let yy = y, j = 0; yy < y + hh; yy += 26, j++) for (let xx = x, i = 0; xx < x + w; xx += 26, i++) {
        if ((i + j) % 2) { c.fillStyle = '#5d6c8a'; c.fillRect(xx, yy, 26, 26); }
      }
      c.fillStyle = 'rgba(60,50,40,.35)';
      for (let yy = y; yy < y + hh; yy += 26) c.fillRect(x, yy, w, 1);
      for (let xx = x; xx < x + w; xx += 26) c.fillRect(xx, y, 1, hh);
    } else if (m === 'lino') {
      c.fillStyle = '#c4b27e'; c.fillRect(x, y, w, hh);
      c.fillStyle = 'rgba(120,90,40,.25)';
      for (let yy = y; yy < y + hh; yy += 20) for (let xx = x + ((yy / 20) % 2) * 10; xx < x + w; xx += 20) {
        c.beginPath(); c.moveTo(xx, yy - 5); c.lineTo(xx + 5, yy); c.lineTo(xx, yy + 5); c.lineTo(xx - 5, yy); c.fill();
      }
    } else if (m === 'stone') {
      c.fillStyle = '#9d988c'; c.fillRect(x, y, w, hh);
      for (let yy = y; yy < y + hh; yy += 34) {
        let xx = x - R() * 30;
        while (xx < x + w) {
          const fw = 34 + R() * 30;
          c.fillStyle = ['#a7a294', '#958f82', '#aea89a', '#8f897d'][Math.floor(R() * 4)];
          rr(c, xx + 1.5, yy + 1.5, fw - 3, 31, 3); c.fill();
          xx += fw;
        }
      }
    }
  }

  zone(c, z, seed) {
    const [x, y, w, h] = z.r, R = rng(seed * 131);
    const look = z.look;
    if (look === 'runner' || look === 'runner2') {
      const base = look === 'runner' ? '#9c3d36' : '#d8c8a4', edge = look === 'runner' ? '#d9b35e' : '#8a5a6c';
      shadow(c, () => rr(c, x, y, w, h, 2), 1, 2, 0.2);
      c.fillStyle = base; c.fillRect(x, y, w, h);
      c.strokeStyle = edge; c.lineWidth = 4; c.strokeRect(x + 7, y + 7, w - 14, h - 14);
      c.lineWidth = 1.5; c.strokeRect(x + 14, y + 14, w - 28, h - 28);
      c.fillStyle = edge;
      const step = 34, cx = x + w / 2;
      if (h > w) for (let yy = y + 32; yy < y + h - 24; yy += step) { c.beginPath(); c.moveTo(cx, yy - 10); c.lineTo(cx + 12, yy); c.lineTo(cx, yy + 10); c.lineTo(cx - 12, yy); c.fill(); }
      else for (let xx = x + 32; xx < x + w - 24; xx += step) { const cy = y + h / 2; c.beginPath(); c.moveTo(xx - 10, cy); c.lineTo(xx, cy + 12); c.lineTo(xx + 10, cy); c.lineTo(xx, cy - 12); c.fill(); }
      // fringe
      c.strokeStyle = '#eadcbc'; c.lineWidth = 1;
      if (h > w) for (let xx = x + 3; xx < x + w; xx += 4) { c.beginPath(); c.moveTo(xx, y); c.lineTo(xx, y - 4); c.moveTo(xx, y + h); c.lineTo(xx, y + h + 4); c.stroke(); }
      else for (let yy = y + 3; yy < y + h; yy += 4) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x - 4, yy); c.moveTo(x + w, yy); c.lineTo(x + w + 4, yy); c.stroke(); }
    } else if (look === 'rug') {
      shadow(c, () => rr(c, x, y, w, h, 8), 1, 2, 0.2);
      c.fillStyle = '#2f6a6e'; rr(c, x, y, w, h, 8); c.fill();
      c.strokeStyle = '#e1b862'; c.lineWidth = 5; rr(c, x + 10, y + 10, w - 20, h - 20, 6); c.stroke();
      c.fillStyle = '#b5523c'; ell(c, x + w / 2, y + h / 2, w * 0.28, h * 0.3); c.fill();
      c.fillStyle = '#e1b862'; ell(c, x + w / 2, y + h / 2, w * 0.12, h * 0.13); c.fill();
      c.fillStyle = 'rgba(225,184,98,.6)';
      for (const [fx, fy] of [[0.16, 0.16], [0.84, 0.16], [0.16, 0.84], [0.84, 0.84]]) { circ(c, x + w * fx, y + h * fy, 7); c.fill(); }
    } else if (look === 'mat') {
      c.fillStyle = '#5f8a5a'; rr(c, x, y, w, h, 5); c.fill();
      c.fillStyle = '#7ea76f'; for (let xx = x + 6; xx < x + w - 4; xx += 10) c.fillRect(xx, y + 4, 4, h - 8);
    } else if (look === 'doormat') {
      c.fillStyle = '#b48a4a'; rr(c, x, y, w, h, 3); c.fill();
      c.strokeStyle = 'rgba(90,60,20,.4)'; c.lineWidth = 1;
      for (let i = 0; i < 260; i++) { const px = x + 3 + R() * (w - 6), py = y + 3 + R() * (h - 6); c.beginPath(); c.moveTo(px, py); c.lineTo(px + R() * 3 - 1.5, py + 3); c.stroke(); }
      c.strokeStyle = '#6d4a20'; c.lineWidth = 3; rr(c, x + 5, y + 5, w - 10, h - 10, 2); c.stroke();
    } else if (look === 'bathmat') {
      c.fillStyle = '#8fb5cc'; rr(c, x, y, w, h, 12); c.fill();
      c.fillStyle = '#a9cadc'; for (let yy = y + 6; yy < y + h - 3; yy += 7) for (let xx = x + 6 + (yy % 2) * 3; xx < x + w - 3; xx += 7) { circ(c, xx, yy, 2); c.fill(); }
    } else if (look === 'playmat') {
      const cols = ['#e46f5a', '#f2c14e', '#62b38a', '#5d8fd6', '#b07cc6'];
      const n = 6, m = 4, cw = w / n, ch = h / m;
      for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
        c.fillStyle = cols[(i + j * 2) % 5]; c.fillRect(x + i * cw, y + j * ch, cw, ch);
        c.fillStyle = 'rgba(255,255,255,.35)'; circ(c, x + i * cw + cw / 2, y + j * ch + ch / 2, Math.min(cw, ch) * 0.22); c.fill();
      }
      c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1;
      for (let j = 0; j <= m; j++) { c.beginPath(); c.moveTo(x, y + j * ch); c.lineTo(x + w, y + j * ch); c.stroke(); }
      for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(x + i * cw, y); c.lineTo(x + i * cw, y + h); c.stroke(); }
    } else if (look === 'roadmat') {
      c.fillStyle = '#6fa364'; rr(c, x, y, w, h, 4); c.fill();
      c.fillStyle = '#5b5e66'; c.fillRect(x + 10, y + h / 2 - 9, w - 20, 18); c.fillRect(x + w / 2 - 9, y + 10, 18, h - 20);
      c.fillStyle = '#f2e9c9'; for (let xx = x + 16; xx < x + w - 16; xx += 14) c.fillRect(xx, y + h / 2 - 1, 7, 2);
      c.fillStyle = '#d9604c'; c.fillRect(x + 20, y + 14, 22, 16); c.fillStyle = '#4c7dc9'; c.fillRect(x + w - 44, y + h - 30, 22, 16);
    } else if (look === 'creak') {
      // two pale, warped boards in the carpet: the carpet's worn through
      c.fillStyle = '#c9a477'; c.fillRect(x, y, w, h);
      c.fillStyle = '#a37f55'; c.fillRect(x, y + h / 2, w, 1.2);
      c.fillStyle = 'rgba(90,60,30,.35)'; for (let xx = x + 20; xx < x + w; xx += 37) c.fillRect(xx, y, 1, h);
      c.strokeStyle = 'rgba(70,45,25,.5)'; c.lineWidth = 1;
      for (let i = 0; i < 6; i++) { const px = x + 8 + R() * (w - 16); c.beginPath(); c.arc(px, y + h * 0.25 + (i % 2) * h / 2, 3, 0, TAU); c.stroke(); }
    } else if (look === 'tray') {
      c.fillStyle = '#eef1f2'; rr(c, x + 2, y + 2, w - 4, h - 4, 6); c.fill();
      c.strokeStyle = '#c6ccd0'; c.lineWidth = 1.5;
      const cx = this.h.cup.x, cy = this.h.cup.y;
      for (let k = 1; k <= 4; k++) { rr(c, cx - k * 14, cy - k * 15, k * 28, k * 30, 6); c.stroke(); }
    } else if (look === 'flags') {
      this.floor(c, 'stone', z.r, seed);
    }
  }

  // a sagging floor: faint chevrons pointing downhill
  slope(c, sl) {
    const [x, y, w, h] = sl.r, a = Math.atan2(sl.fy, sl.fx);
    c.save();
    c.strokeStyle = 'rgba(255,240,210,.22)'; c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let yy = y + 14; yy < y + h; yy += 24) for (let xx = x + 14; xx < x + w; xx += 24) {
      c.save(); c.translate(xx, yy); c.rotate(a);
      c.beginPath(); c.moveTo(-4, -6); c.lineTo(3, 0); c.lineTo(-4, 6); c.stroke();
      c.restore();
    }
    c.restore();
  }

  stairs(c, r) {
    const [x, y, w, h] = r;
    for (let i = 0; i < 10; i++) {
      const yy = y + (i * h) / 10;
      const g = 160 - i * 12;
      c.fillStyle = `rgb(${g * 0.75},${g * 0.6},${g * 0.45})`;
      c.fillRect(x, yy, w, h / 10 + 0.5);
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x, yy + h / 10 - 2, w, 2);
    }
    const grd = c.createLinearGradient(0, y, 0, y + h);
    grd.addColorStop(0, 'rgba(10,8,20,0)'); grd.addColorStop(1, 'rgba(10,8,20,.75)');
    c.fillStyle = grd; c.fillRect(x, y, w, h);
    c.fillStyle = '#8a3f3a'; c.fillRect(x + w * 0.25, y, w * 0.5, h);
    c.fillStyle = 'rgba(10,8,20,.4)'; c.fillRect(x + w * 0.25, y + h * 0.5, w * 0.5, h * 0.5);
  }

  track(c, t) {
    c.strokeStyle = '#a77a4c'; c.lineWidth = 14; ell(c, t.x, t.y, t.rx, t.ry); c.stroke();
    c.strokeStyle = '#7b5634'; c.lineWidth = 2;
    for (let a = 0; a < TAU; a += TAU / 46) {
      const px = t.x + Math.cos(a) * t.rx, py = t.y + Math.sin(a) * t.ry;
      const nx = Math.cos(a) * t.ry, ny = Math.sin(a) * t.rx, nl = Math.hypot(nx, ny);
      c.beginPath(); c.moveTo(px - (nx / nl) * 7, py - (ny / nl) * 7); c.lineTo(px + (nx / nl) * 7, py + (ny / nl) * 7); c.stroke();
    }
    c.strokeStyle = '#c9ced6'; c.lineWidth = 1.5;
    ell(c, t.x, t.y, t.rx - 4, t.ry - 4); c.stroke(); ell(c, t.x, t.y, t.rx + 4, t.ry + 4); c.stroke();
  }

  block(c, b) {
    const [x, y, w, h] = b.r;
    const k = b.kind;
    const fillRR = (col, xx, yy, ww, hh, r) => { c.fillStyle = col; rr(c, xx, yy, ww, hh, r); c.fill(); };
    if (k === 'console' || k === 'table' || k === 'bedside' || k === 'desk' || k === 'tvunit' || k === 'dresser') {
      const wood = k === 'tvunit' ? '#3d3a48' : k === 'desk' ? '#d6c2a0' : '#8c5c38';
      fillRR(wood, x, y, w, h, 4);
      fillRR('rgba(255,255,255,.12)', x + 2, y + 2, w - 4, h * 0.35, 3);
      c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1; rr(c, x + 0.5, y + 0.5, w - 1, h - 1, 4); c.stroke();
      if (k === 'console') { fillRR('#d9cfb8', x + 6, y + 10, w - 12, 18, 9); fillRR('#3b6e8f', x + 9, y + h - 30, w - 18, 20, 4); c.fillStyle = '#f1c66a'; circ(c, x + w / 2, y + h - 20, 3); c.fill(); }
      if (k === 'table') { fillRR('#d8d0c0', x + 8, y + 8, 26, 20, 2); fillRR('#c44f45', x + 30, y + 30, 28, 22, 2); c.fillStyle = '#f2ecdf'; circ(c, x + 50, y + 16, 6); c.fill(); c.fillStyle = '#5a3a2a'; circ(c, x + 50, y + 16, 4); c.fill(); }
      if (k === 'tvunit') { fillRR('#16151d', x + 16, y + 4, w - 32, 7, 2); c.fillStyle = '#e04c4c'; circ(c, x + w - 12, y + h - 9, 1.6); c.fill(); }
      if (k === 'bedside') { c.fillStyle = '#e9dfc4'; circ(c, x + w / 2, y + h / 2, 12); c.fill(); c.fillStyle = '#c9b78e'; circ(c, x + w / 2, y + h / 2, 5); c.fill(); }
      if (k === 'desk') { fillRR('#f2f0ea', x + 8, y + 50, 30, 40, 2); c.fillStyle = '#7c4bc0'; circ(c, x + 24, y + 22, 9); c.fill(); c.fillStyle = '#f07ac8'; circ(c, x + 24, y + 22, 5); c.fill(); }
      if (k === 'dresser') { fillRR('#a9c3cf', x + 6, y + 14, 10, h - 28, 3); for (let i = 0; i < 4; i++) { c.fillStyle = ['#e6b8c8', '#c4e0d0', '#f0dca0', '#d0c0e8'][i]; circ(c, x + 32, y + 20 + i * 20, 5); c.fill(); } }
    } else if (k === 'plant') {
      // (never reached; plants are rounds)
    } else if (k === 'counter') {
      fillRR('#cfc6b3', x, y, w, h, 3);
      fillRR('#e3dccb', x + 2, y + 2, w - 4, h - 6, 2);
      if (b.sink) { fillRR('#aab4bd', x + 54, y + 4, 60, h - 12, 6); fillRR('#7f8a94', x + 58, y + 8, 52, h - 20, 5); c.fillStyle = '#c9d0d6'; circ(c, x + 84, y + 4, 4); c.fill(); }
      else { c.fillStyle = '#6c5948'; circ(c, x + w / 2, y + 30, 10); c.fill(); fillRR('#e6e6e6', x + 8, y + 70, w - 16, 26, 3); c.fillStyle = '#d4b04c'; circ(c, x + w / 2, y + h - 40, 8); c.fill(); }
    } else if (k === 'fridge') {
      fillRR('#e7ebee', x, y, w, h, 6);
      c.fillStyle = '#c2c9cf'; c.fillRect(x + 4, y + h * 0.42, w - 8, 2);
      fillRR('#9aa3ab', x + 8, y + h - 10, 26, 4, 2);
      c.fillStyle = '#e15b4f'; circ(c, x + 18, y + 14, 4); c.fill(); c.fillStyle = '#4f8de1'; circ(c, x + 34, y + 20, 4); c.fill(); c.fillStyle = '#f3c54c'; c.fillRect(x + 42, y + 10, 8, 10);
    } else if (k === 'island') {
      fillRR('#a87545', x, y, w, h, 6);
      c.strokeStyle = 'rgba(70,40,20,.35)'; c.lineWidth = 1;
      for (let xx = x + 8; xx < x + w; xx += 8) { c.beginPath(); c.moveTo(xx, y + 2); c.lineTo(xx, y + h - 2); c.stroke(); }
      c.fillStyle = '#e8e0cf'; circ(c, x + w / 2, y + h / 2, 22); c.fill();
      for (const [dx, dy, col] of [[-8, -6, '#e05a3c'], [7, -4, '#f0b030'], [-2, 8, '#8cbf4a'], [9, 9, '#e05a3c']]) { c.fillStyle = col; circ(c, x + w / 2 + dx, y + h / 2 + dy, 6); c.fill(); }
    } else if (k === 'sofa' || k === 'armchair') {
      const col = k === 'sofa' ? '#6e8f5e' : '#c0794e';
      fillRR(col, x, y, w, h, 12);
      c.fillStyle = 'rgba(0,0,0,.18)';
      if (k === 'sofa') { rr(c, x + 2, y + 2, 16, h - 4, 8); c.fill(); }
      else { rr(c, x + 2, y + 2, w - 4, 16, 8); c.fill(); }
      fillRR('rgba(255,255,255,.14)', x + (k === 'sofa' ? 20 : 12), y + (k === 'sofa' ? 14 : 22), w - (k === 'sofa' ? 28 : 24), h - (k === 'sofa' ? 28 : 34), 8);
      if (k === 'armchair') { c.fillStyle = '#d9c38a'; circ(c, x + w / 2, y + h / 2 + 6, 10); c.fill(); }
    } else if (k === 'fireplace') {
      fillRR('#8f8a84', x, y, w, h, 2);
      fillRR('#1f1a1c', x + 18, y, w - 36, h - 6, 3);
      c.fillStyle = '#e4743a'; circ(c, x + w / 2 - 6, y + 8, 4); c.fill(); c.fillStyle = '#f4b04a'; circ(c, x + w / 2 + 5, y + 10, 3); c.fill();
    } else if (k === 'bookcase') {
      fillRR('#6b4a30', x, y, w, h, 2);
      const R = rng(x * 7 + y);
      const vert = h > w;
      if (vert) for (let yy = y + 4; yy < y + h - 6;) { const t = 4 + R() * 5; c.fillStyle = ['#c0473c', '#3f6ea8', '#e3c06a', '#5b8f5a', '#efe8da', '#8b5aa3'][Math.floor(R() * 6)]; c.fillRect(x + 6, yy, w - 10 - R() * 8, t); yy += t + 1; }
    } else if (k === 'washer') {
      fillRR('#eef0f1', x, y, w, h, 6);
      c.fillStyle = '#9ba6ae'; circ(c, x + w / 2, y + h / 2 + 4, 20); c.fill();
      c.fillStyle = '#5e6f7c'; circ(c, x + w / 2, y + h / 2 + 4, 15); c.fill();
      c.fillStyle = '#c4ccd2'; c.fillRect(x + 6, y + 5, w - 12, 6);
    } else if (k === 'shoerack') {
      fillRR('#7a5a3a', x, y, w, h, 2);
      const cols = ['#2f3a5c', '#9c3d36', '#d8c8a4', '#3d6b47'];
      for (let i = 0; i < 4; i++) { c.fillStyle = cols[i]; ell(c, x + 12, y + 18 + i * 32, 7, 12); c.fill(); ell(c, x + 27, y + 18 + i * 32, 7, 12); c.fill(); }
    } else if (k === 'campbed') {
      fillRR('#5a6b3c', x, y, w, h, 4);
      fillRR('#7c8f52', x + 4, y + 4, w - 8, h - 8, 3);
      fillRR('#e8e2d0', x + 30, y + 8, 34, 22, 8);   // pillow at the top
      fillRR('#b9573e', x + 6, y + 36, w - 12, h - 44, 6);   // blanket
    } else if (k === 'laundry') {
      fillRR('#c8a66e', x, y, w, h, 8);
      for (const [dx, dy, col] of [[10, 12, '#d65f5f'], [24, 20, '#6f9fd8'], [16, 28, '#f2e7c9']]) { c.fillStyle = col; ell(c, x + dx, y + dy, 10, 7, dx); c.fill(); }
    } else if (k === 'bath') {
      fillRR('#f1f3f4', x, y, w, h, 18);
      fillRR('#cfe2ea', x + 10, y + 10, w - 20, h - 20, 16);
      fillRR('rgba(255,255,255,.4)', x + 16, y + 14, w - 60, 10, 5);
      c.fillStyle = '#b8c0c6'; circ(c, x + 24, y + h / 2, 5); c.fill();
      c.fillStyle = '#9aa3ab'; circ(c, x + 6, y + h / 2 - 10, 3); c.fill(); circ(c, x + 6, y + h / 2 + 10, 3); c.fill();
    } else if (k === 'cot') {
      fillRR('#f2ead8', x, y, w, h, 4);
      fillRR('#f9f5ec', x + 6, y + 6, w - 12, h - 12, 3);
      c.strokeStyle = '#d8c7a6'; c.lineWidth = 2;
      for (let xx = x + 4; xx <= x + w - 4; xx += 7) { c.beginPath(); c.moveTo(xx, y + 1); c.lineTo(xx, y + 5); c.moveTo(xx, y + h - 5); c.lineTo(xx, y + h - 1); c.stroke(); }
      c.lineWidth = 3; rr(c, x + 1.5, y + 1.5, w - 3, h - 3, 4); c.stroke();
    } else if (k === 'toybox') {
      fillRR('#d9604c', x, y, w, h, 5);
      fillRR('#f2c14e', x + 5, y + 5, w - 10, 8, 3);
      c.fillStyle = '#f2ead8'; c.font = '700 20px Gaegu, sans-serif'; c.textAlign = 'center'; c.fillText('TOYS', x + w / 2, y + h / 2 + 8);
    } else if (k === 'block') {
      const col = ['#e46f5a', '#5d8fd6', '#62b38a'][b.hue || 0];
      fillRR(col, x, y, w, h, 3);
      c.fillStyle = 'rgba(255,255,255,.7)'; c.font = '700 13px Gaegu, sans-serif'; c.textAlign = 'center'; c.fillText('ABC'[b.hue || 0], x + w / 2, y + h / 2 + 4);
    } else if (k === 'bed') {
      const duvet = b.hue ? '#5d8fd6' : '#e46f8a';
      fillRR('#8c5c38', x, y, w, h, 4);
      fillRR(duvet, x + 3, y + 46, w - 6, h - 50, 6);
      c.fillStyle = 'rgba(255,255,255,.3)'; for (let yy = y + 56; yy < y + h - 6; yy += 16) for (let xx = x + 10; xx < x + w - 6; xx += 16) { circ(c, xx, yy, 3); c.fill(); }
      fillRR('#f4eee0', x + 8, y + 6, w - 16, 30, 10);
    } else if (k === 'bigbed') {
      fillRR('#6b4a30', x - 2, y, w + 4, h, 4);
      fillRR('#e9e1cf', x + 4, y + 4, w - 8, h - 8, 6);
      fillRR('#f6f1e6', x + 14, y + 14, 66, 34, 12);
      fillRR('#f6f1e6', x + w - 80, y + 14, 66, 34, 12);
      fillRR('#7d8fb7', x + 4, y + 66, w - 8, h - 72, 10);
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 2;
      for (let yy = y + 90; yy < y + h - 10; yy += 22) { c.beginPath(); c.moveTo(x + 10, yy); c.lineTo(x + w - 10, yy); c.stroke(); }
    } else if (k === 'wardrobe') {
      fillRR('#7a5232', x, y, w, h, 3);
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + 2, y + h / 2, w - 4, 1.5);
      c.fillStyle = '#d6b36a'; circ(c, x + w - 8, y + h / 2 - 8, 2.2); c.fill(); circ(c, x + w - 8, y + h / 2 + 8, 2.2); c.fill();
    }
  }

  round(c, r) {
    const { x, y } = r, R = r.r, k = r.kind;
    if (k === 'plant') {
      c.fillStyle = '#b86a43'; circ(c, x, y, R); c.fill();
      c.fillStyle = '#5a3b26'; circ(c, x, y, R - 3); c.fill();
      for (let i = 0; i < 7; i++) { const a = i * 0.9; c.fillStyle = i % 2 ? '#5f9a52' : '#4a8043'; ell(c, x + Math.cos(a) * R * 0.75, y + Math.sin(a) * R * 0.75, R * 0.7, R * 0.3, a); c.fill(); }
    } else if (k === 'bin') {
      c.fillStyle = '#b9c1c7'; circ(c, x, y, R); c.fill();
      c.strokeStyle = '#8a949c'; c.lineWidth = 2; circ(c, x, y, R - 4); c.stroke();
      c.fillStyle = '#8a949c'; c.fillRect(x - 5, y - 1.5, 10, 3);
    } else if (k === 'toilet') {
      c.fillStyle = '#f1f3f4'; rr(c, x - R, y - R - 4, R * 2, 14, 4); c.fill();
      ell(c, x, y + 6, R * 0.8, R * 0.95); c.fill();
      c.fillStyle = '#cfe2ea'; ell(c, x, y + 8, R * 0.5, R * 0.62); c.fill();
    } else if (k === 'basin') {
      c.fillStyle = '#f1f3f4'; circ(c, x, y, R); c.fill();
      c.fillStyle = '#cfe2ea'; ell(c, x, y + 2, R * 0.7, R * 0.6); c.fill();
      c.fillStyle = '#9aa3ab'; circ(c, x, y - R + 4, 2.5); c.fill();
    } else if (k === 'teddy') {
      c.fillStyle = '#a8703e'; circ(c, x - R * 0.7, y - R * 0.7, R * 0.4); c.fill(); circ(c, x + R * 0.7, y - R * 0.7, R * 0.4); c.fill();
      circ(c, x, y, R); c.fill();
      c.fillStyle = '#d9a874'; circ(c, x, y + 3, R * 0.45); c.fill();
      c.fillStyle = '#2a1d16'; circ(c, x - 5, y - 3, 1.6); c.fill(); circ(c, x + 5, y - 3, 1.6); c.fill(); circ(c, x, y + 2, 2); c.fill();
    } else if (k === 'rocker') {
      c.fillStyle = '#a0764c'; circ(c, x, y, R); c.fill();
      c.fillStyle = '#e8d6b4'; circ(c, x, y + 2, R - 6); c.fill();
      c.strokeStyle = '#6e4e30'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, R + 2, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
    } else if (k === 'tent') {
      const cols = ['#e46f5a', '#f2e9c9'];
      for (let i = 0; i < 8; i++) { c.fillStyle = cols[i % 2]; c.beginPath(); c.moveTo(x, y); c.arc(x, y, R, (i * TAU) / 8, ((i + 1) * TAU) / 8); c.closePath(); c.fill(); }
      c.fillStyle = '#f2c14e'; circ(c, x, y, 4); c.fill();
    } else if (k === 'beanbag') {
      c.fillStyle = '#f2a541'; c.beginPath();
      for (let i = 0; i <= 12; i++) { const a = (i / 12) * TAU, rr2 = R * (1 + 0.08 * Math.sin(i * 2.3)); i ? c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2) : c.moveTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
      c.fill();
      c.fillStyle = 'rgba(0,0,0,.12)'; circ(c, x + 3, y + 4, R * 0.5); c.fill();
    } else if (k === 'stool') {
      c.fillStyle = '#8c5c38'; circ(c, x, y, R); c.fill(); c.fillStyle = '#d6a2b4'; circ(c, x, y, R - 3); c.fill();
    } else if (k === 'basket') {
      c.fillStyle = '#c8a66e'; circ(c, x, y, R); c.fill();
      c.strokeStyle = '#a3824c'; c.lineWidth = 1.5; circ(c, x, y, R - 3); c.stroke();
      c.fillStyle = '#e8e2d0'; ell(c, x - 4, y - 2, 9, 6, 0.5); c.fill(); c.fillStyle = '#6f9fd8'; ell(c, x + 5, y + 4, 7, 5, -0.4); c.fill();
    }
  }

  seg(c, s) {
    if (s.kind === 'rail') {
      c.strokeStyle = '#6b4226'; c.lineWidth = s.t; c.lineCap = 'round';
      c.beginPath(); c.moveTo(s.a[0], s.a[1]); c.lineTo(s.b[0], s.b[1]); c.stroke();
      c.strokeStyle = '#a06a3e'; c.lineWidth = s.t * 0.4;
      c.beginPath(); c.moveTo(s.a[0], s.a[1]); c.lineTo(s.b[0], s.b[1]); c.stroke();
      c.fillStyle = '#4a2d18';
      c.fillRect(s.a[0] - 5, s.a[1] - 5, 10, 10); c.fillRect(s.b[0] - 5, s.b[1] - 5, 10, 10);
    } else if (s.kind === 'glass') {
      c.strokeStyle = 'rgba(190,225,240,.9)'; c.lineWidth = s.t; c.lineCap = 'round';
      c.beginPath(); c.moveTo(s.a[0], s.a[1]); c.lineTo(s.b[0], s.b[1]); c.stroke();
      c.strokeStyle = '#9aa3ab'; c.lineWidth = 1.5; c.stroke();
    } else {
      c.strokeStyle = '#4a4466'; c.lineWidth = s.t; c.lineCap = 'butt';
      c.beginPath(); c.moveTo(s.a[0], s.a[1]); c.lineTo(s.b[0], s.b[1]); c.stroke();
      c.strokeStyle = '#efe4cf'; c.lineWidth = 1.5;
      for (const o of [-s.t / 2, s.t / 2]) { c.beginPath(); c.moveTo(s.a[0], s.a[1] + o); c.lineTo(s.b[0], s.b[1] + o); c.stroke(); }
    }
  }

  cup(c, cup) {
    const { x, y } = cup, k = cup.kind;
    if (k === 'mug') {
      c.fillStyle = 'rgba(20,16,40,.3)'; circ(c, x + 2, y + 3, CUP_R + 4); c.fill();
      c.strokeStyle = '#e8e1d2'; c.lineWidth = 4; c.beginPath(); c.arc(x + CUP_R + 4, y, 5, -1.2, 1.2); c.stroke();
      c.fillStyle = '#e8e1d2'; circ(c, x, y, CUP_R + 3.5); c.fill();
      c.fillStyle = '#c0473c'; c.fillRect(x - CUP_R - 3, y - 1.5, 2.5, 3);
    } else if (k === 'slipper') {
      c.fillStyle = 'rgba(20,16,40,.3)'; ell(c, x + 2, y + 9, 13, 23); c.fill();
      c.fillStyle = '#7d4b6e'; ell(c, x, y + 7, 13, 23); c.fill();
      c.fillStyle = '#e7d9c2'; ell(c, x, y + 16, 8, 11); c.fill();
      c.fillStyle = '#9b6488'; ell(c, x, y, CUP_R + 3, CUP_R + 3.5); c.fill();
    } else if (k === 'welly') {
      c.fillStyle = 'rgba(20,16,40,.3)'; ell(c, x + 2, y + 12, 13, 24); c.fill();
      c.fillStyle = '#3d7a4a'; ell(c, x, y + 10, 12, 24); c.fill();
      c.fillStyle = '#356b40'; circ(c, x, y, CUP_R + 4); c.fill();
      c.fillStyle = '#3d7a4a'; ell(c, x - 22, y + 8, 12, 24, 0.15); c.fill(); c.fillStyle = '#2a5532'; circ(c, x - 23, y - 2, CUP_R + 2); c.fill();
    } else if (k === 'trainer') {
      c.fillStyle = 'rgba(20,16,40,.3)'; ell(c, x + 2, y + 12, 12, 24); c.fill();
      c.fillStyle = '#efefef'; ell(c, x, y + 10, 12, 24); c.fill();
      c.strokeStyle = '#e0503c'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - 8, y + 14); c.quadraticCurveTo(x, y + 26, x + 8, y + 14); c.stroke();
      c.fillStyle = '#d9d9d9'; circ(c, x, y, CUP_R + 3); c.fill();
    } else if (k === 'plughole') {
      c.fillStyle = '#c3cbd1'; circ(c, x, y, CUP_R + 4); c.fill();
      c.fillStyle = '#8e989f'; circ(c, x, y, CUP_R + 1.5); c.fill();
    } else if (k === 'bootee') {
      c.fillStyle = 'rgba(20,16,40,.3)'; ell(c, x + 2, y + 9, 11, 17); c.fill();
      c.fillStyle = '#9fd0c8'; ell(c, x, y + 7, 11, 17); c.fill();
      c.fillStyle = '#f2f0ea'; circ(c, x, y, CUP_R + 3.5); c.fill();
      c.fillStyle = '#f2c14e'; circ(c, x, y + 16, 3); c.fill();
    } else if (k === 'bucket') {
      c.fillStyle = 'rgba(20,16,40,.3)'; circ(c, x + 2, y + 3, CUP_R + 5); c.fill();
      c.fillStyle = '#e04c4c'; circ(c, x, y, CUP_R + 5); c.fill();
      c.strokeStyle = '#f2c14e'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, CUP_R + 8, 0.2, Math.PI - 0.2); c.stroke();
    }
    // the hole itself
    c.fillStyle = '#120f1e'; circ(c, x, y, CUP_R); c.fill();
    if (k === 'plughole') { c.fillStyle = '#8e989f'; for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; c.fillRect(x + Math.cos(a) * 4 - 1, y + Math.sin(a) * 4 - 1, 2, 2); } }
  }

  door(c, d, sleeper) {
    // a door in the wall band; sleepers' doors are shut with a dark crack under them
    const vert = d.side === 'left' || d.side === 'right';
    const L = 56;
    const wx = d.side === 'left' ? -WALL : d.side === 'right' ? this.h.w : d.x - L / 2;
    const wy = d.side === 'top' ? -WALL : d.side === 'bottom' ? this.h.h : d.y - L / 2;
    const w = vert ? WALL : L, hh = vert ? L : WALL;
    c.fillStyle = d.front ? '#3b5a8a' : '#a77a4c'; c.fillRect(wx, wy, w, hh);
    c.fillStyle = 'rgba(0,0,0,.25)';
    if (vert) { c.fillRect(wx, wy, w, 2); c.fillRect(wx, wy + hh - 2, w, 2); } else { c.fillRect(wx, wy, 2, hh); c.fillRect(wx + w - 2, wy, 2, hh); }
    c.fillStyle = '#e8c56a';
    const kx = vert ? wx + w / 2 : wx + w - 10, ky = vert ? wy + hh - 10 : wy + hh / 2;
    circ(c, kx, ky, 2); c.fill();
    if (sleeper) {
      // the dark crack under the door
      c.fillStyle = '#16131f';
      if (d.side === 'left') c.fillRect(0, wy + 4, 2.5, hh - 8);
      if (d.side === 'right') c.fillRect(this.h.w - 2.5, wy + 4, 2.5, hh - 8);
    }
  }

  window(c, w) {
    c.strokeStyle = '#b9d0ea'; c.lineWidth = WALL * 0.45;
    const nx = w.a[0] === w.b[0] ? (w.a[0] === 0 ? -1 : 1) : 0, ny = w.a[1] === w.b[1] ? (w.a[1] === 0 ? -1 : 1) : 0;
    const o = WALL * 0.5;
    c.beginPath(); c.moveTo(w.a[0] + nx * o, w.a[1] + ny * o); c.lineTo(w.b[0] + nx * o, w.b[1] + ny * o); c.stroke();
    c.strokeStyle = '#efe4cf'; c.lineWidth = 2;
    const mx = (w.a[0] + w.b[0]) / 2, my = (w.a[1] + w.b[1]) / 2;
    c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + nx * WALL, my + ny * WALL); c.stroke();
  }

  // ---------- the night
  paintLight() {
    const c = this.light.getContext('2d'), h = this.h;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = 'rgb(92,100,158)';
    c.fillRect(0, 0, this.light.width, this.light.height);
    this.world(c);
    c.globalCompositeOperation = 'lighter';
    for (const w of h.windows || []) {
      const [dx, dy] = w.dir, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
      const L = w.len;
      const a = w.a, b = w.b;
      const grd = c.createLinearGradient(a[0], a[1], a[0] + ux * L, a[1] + uy * L);
      grd.addColorStop(0, 'rgba(150,165,200,.95)'); grd.addColorStop(1, 'rgba(150,165,200,0)');
      c.fillStyle = grd;
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(b[0] + ux * L, b[1] + uy * L); c.lineTo(a[0] + ux * L, a[1] + uy * L); c.closePath(); c.fill();
    }
    for (const lp of h.lamps || []) {
      const col = { warm: '255,175,95', green: '120,240,170', ember: '255,120,60', star: '190,180,255', lava: '240,100,210' }[lp.c];
      const k = { warm: 0.85, green: 0.45, ember: 0.8, star: 0.7, lava: 0.6 }[lp.c];
      const grd = c.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, lp.r);
      grd.addColorStop(0, `rgba(${col},${k})`); grd.addColorStop(0.5, `rgba(${col},${k * 0.35})`); grd.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = grd; circ(c, lp.x, lp.y, lp.r); c.fill();
    }
    // window bars cast shadows across the moonlight
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = 'rgba(92,100,158,.55)'; c.lineWidth = 3;
    for (const w of h.windows || []) {
      const [dx, dy] = w.dir, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
      const mx = (w.a[0] + w.b[0]) / 2, my = (w.a[1] + w.b[1]) / 2;
      c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + ux * w.len * 0.8, my + uy * w.len * 0.8); c.stroke();
      const t = w.len * 0.42;
      c.beginPath(); c.moveTo(w.a[0] + ux * t, w.a[1] + uy * t); c.lineTo(w.b[0] + ux * t, w.b[1] + uy * t); c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
  }

  // ---------- noise you can see
  ripple(x, y, L, kind) {
    if (kind === 'roll') {
      if (L < 0.6) return;
      this.ripples.push({ x, y, r0: 4, r1: 10 + Math.sqrt(L) * 9, t: 0, life: 0.6, a: Math.min(0.5, L * 0.08), soft: true });
      return;
    }
    if (L < 0.8) return;
    this.ripples.push({ x, y, r0: 6, r1: 16 + Math.sqrt(L) * 15, t: 0, life: 0.9 + Math.min(0.8, L * 0.02), a: Math.min(1, 0.25 + L * 0.03), hot: L > 24 });
    if (L > 8) this.ripples.push({ x, y, r0: 4, r1: 10 + Math.sqrt(L) * 10, t: -0.12, life: 0.8, a: Math.min(1, 0.2 + L * 0.02), hot: L > 24 });
    const word = {
      hard: L > 30 ? 'KNOCK' : L > 14 ? 'tok' : null, metal: L > 30 ? 'CLANG!' : L > 12 ? 'ting' : null,
      putt: L > 30 ? 'THWACK' : L > 14 ? 'tock' : null, creak: 'creeeak', lego: 'crunch', squeak: 'SQUEAK',
      flap: 'clack', stairs: 'THUD THUD THUD', cat: 'mrrp?', train: 'clunk', sink: this.h.cup.kind === 'mug' ? 'plink' : this.h.cup.kind === 'plughole' ? 'glug' : 'fwump',
    }[kind];
    if (word) this.words.push({ x, y, text: word, t: 0, life: 1.3, big: L > 28, dx: (Math.random() - 0.5) * 12 });
  }

  // ---------- one frame
  frame(g, ui, dt, now) {
    const c = this.ctx, h = this.h;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.drawImage(this.bake, 0, 0);
    this.world(c);
    this.dynamic(c, g, now);
    // the night
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'multiply';
    c.drawImage(this.light, 0, 0);
    c.globalCompositeOperation = 'source-over';
    // somebody turned the light on
    if (this.lightsOn > 0 || this.dawn > 0) {
      const a = Math.max(this.lightsOn * 0.9, this.dawn * 0.75);
      c.globalAlpha = a;
      c.drawImage(this.bake, 0, 0);
      this.world(c);
      this.dynamic(c, g, now);
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = this.dawn > this.lightsOn ? '#ffd8c8' : '#ffe2b0';
      c.fillRect(0, 0, this.cv.width, this.cv.height);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
    }
    this.world(c);
    this.glow(c, g, ui, dt, now);
    this.screen(c);
    this.labels(c, g, ui, dt, now);
  }

  dynamic(c, g, now) {
    const h = this.h, t = g.t;
    // the toy train and cats
    for (const m of g.movers) {
      for (let i = m.n - 1; i >= 0; i--) {
        const p = m.at(t, i);
        c.save(); c.translate(p.x, p.y); c.rotate(p.a);
        if (m.kind === 'train') {
          c.fillStyle = 'rgba(20,16,40,.3)'; rr(c, -m.r + 2, -m.r * 0.75 + 3, m.r * 2, m.r * 1.5, 3); c.fill();
          c.fillStyle = i === 0 ? '#d9443c' : i === 1 ? '#3f6ea8' : '#f2c14e';
          rr(c, -m.r, -m.r * 0.75, m.r * 2, m.r * 1.5, 3); c.fill();
          if (i === 0) { c.fillStyle = '#222'; circ(c, m.r * 0.4, 0, 3.5); c.fill(); c.fillStyle = '#ffe9a0'; circ(c, m.r, 0, 2); c.fill(); }
          else { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-m.r + 3, -m.r * 0.5, m.r * 2 - 6, 3); }
        } else {
          this.cat(c, m.r, p.sit, now);
        }
        c.restore();
      }
    }
    // lego
    for (const l of g.lego) {
      c.save(); c.translate(l.x, l.y); c.rotate(l.a);
      c.fillStyle = ['#e0403a', '#f2c14e', '#3f7ad0', '#4fb35a'][Math.abs(Math.round(l.a * 10)) % 4];
      c.fillRect(-6, -3.5, 12, 7);
      c.fillStyle = 'rgba(255,255,255,.4)'; for (const dx of [-3, 3]) { circ(c, dx, 0, 1.6); c.fill(); }
      c.restore();
    }
    // the rubber duck
    for (const r of h.rounds || []) if (r.kind === 'duck') {
      c.fillStyle = 'rgba(20,16,40,.3)'; ell(c, r.x + 2, r.y + 3, r.r + 2, r.r); c.fill();
      c.fillStyle = '#f5cc3a'; ell(c, r.x, r.y, r.r + 2, r.r); c.fill();
      circ(c, r.x + r.r * 0.7, r.y - 3, r.r * 0.6); c.fill();
      c.fillStyle = '#e8792e'; ell(c, r.x + r.r * 1.3, r.y - 3, 3.5, 2); c.fill();
      c.fillStyle = '#222'; circ(c, r.x + r.r * 0.9, r.y - 5, 1.2); c.fill();
    }
    // the cat flap
    if (h.flap) {
      const f = h.flap, sw = g.flapSwing * Math.sin(g.t * 18) * 0.8;
      c.fillStyle = '#5a5f6a'; c.fillRect(f.x - f.w / 2 - 6, f.y - 8, f.w + 12, 16);
      c.fillStyle = '#c2d4e2';
      c.save(); c.translate(f.x, f.y - 7); c.scale(1, Math.cos(sw)); c.fillRect(-f.w / 2, 0, f.w, 14); c.restore();
    }
    // sleepers
    h.sleepers.forEach((s, i) => this.sleeper(c, s, g.meters[i], g.woke === i, now, i));
  }

  cat(c, r, sit, now) {
    c.fillStyle = 'rgba(20,16,40,.3)'; ell(c, 2, 3, r * 1.3, r * 0.9); c.fill();
    c.fillStyle = '#d08a4a';
    if (sit) { circ(c, 0, 0, r); c.fill(); }
    else { ell(c, 0, 0, r * 1.35, r * 0.75); c.fill(); }
    // tail
    c.strokeStyle = '#d08a4a'; c.lineWidth = 3.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-r * 1.1, 0); c.quadraticCurveTo(-r * 2, Math.sin(now * 3) * r, -r * 2.2, Math.sin(now * 3 + 1) * r * 1.2); c.stroke();
    // head
    circ(c, r * 1.05, 0, r * 0.62); c.fill();
    c.beginPath(); c.moveTo(r * 0.9, -r * 0.5); c.lineTo(r * 1.2, -r * 0.95); c.lineTo(r * 1.4, -r * 0.4); c.fill();
    c.beginPath(); c.moveTo(r * 0.9, r * 0.5); c.lineTo(r * 1.2, r * 0.95); c.lineTo(r * 1.4, r * 0.4); c.fill();
  }

  sleeper(c, s, m, woke, now, i) {
    if (s.kind === 'door') return;
    const br = Math.sin(now * (woke ? 6 : 1.4) + i * 2) * (woke ? 0.5 : 1);
    const skin = SKIN[(s.name.length + i) % SKIN.length], hair = HAIR[(s.name.charCodeAt(0) + i) % HAIR.length];
    if (s.kind === 'dog') {
      // a wicker basket with a curled-up dog
      c.fillStyle = 'rgba(20,16,40,.3)'; circ(c, s.x + 3, s.y + 4, s.solid); c.fill();
      c.fillStyle = '#a0753e'; circ(c, s.x, s.y, s.solid); c.fill();
      c.fillStyle = '#7d5a2c'; circ(c, s.x, s.y, s.solid - 4); c.fill();
      c.fillStyle = '#b84a4a'; circ(c, s.x, s.y, s.solid - 6); c.fill();
      const sc = 1 + br * 0.03;
      c.save(); c.translate(s.x, s.y); c.scale(sc, sc);
      if (woke) {
        c.fillStyle = '#e8cfa0'; ell(c, 0, 4, 12, 15); c.fill();
        circ(c, 0, -10, 9); c.fill();
        c.fillStyle = '#9a6b3e'; ell(c, -8, -12, 4, 8, 0.4); c.fill(); ell(c, 8, -12, 4, 8, -0.4); c.fill();
        c.fillStyle = '#222'; circ(c, -3, -11, 1.6); c.fill(); circ(c, 3, -11, 1.6); c.fill(); circ(c, 0, -5, 2); c.fill();
      } else {
        c.fillStyle = '#e8cfa0'; circ(c, 0, 0, 16); c.fill();
        c.fillStyle = '#d9b884'; circ(c, 6, -5, 8); c.fill();
        c.fillStyle = '#9a6b3e'; ell(c, 11, -2, 4, 7, -0.3); c.fill();
        c.strokeStyle = '#e8cfa0'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, 15, 2.2, 3.4); c.stroke();
        c.strokeStyle = '#5a4020'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(3, -7); c.lineTo(7, -6); c.stroke();
      }
      c.restore();
      return;
    }
    // a head on a pillow and a blanket that rises and falls
    const facing = s.kind === 'sofa' ? 0 : -Math.PI / 2;   // which way the body lies from the head
    const bx = Math.cos(facing + Math.PI), by = Math.sin(facing + Math.PI);
    const hx = s.x, hy = s.y;
    const R = s.kind === 'cot' ? 7 : 9.5;
    // body under the blanket
    if (s.kind === 'sofa') {
      c.fillStyle = '#c7a35a'; rr(c, s.x - 22, s.y + 6, 40, 92 + br, 12); c.fill();
      c.fillStyle = 'rgba(0,0,0,.1)'; for (let k = 0; k < 5; k++) c.fillRect(s.x - 22, s.y + 18 + k * 16, 40, 3);
    } else if (s.kind === 'cot') {
      c.fillStyle = '#f2b8c6'; rr(c, s.x - 15, s.y + 6, 30, 26 + br, 9); c.fill();
    } else if (s.kind === 'bed' && s.name === 'Uncle Ray') {
      // the camp bed's blanket is painted already; add the lump
      c.fillStyle = '#c4634a'; rr(c, s.x - 20, s.y + 10, 40, 60 + br, 14); c.fill();
    } else {
      c.fillStyle = 'rgba(255,255,255,.18)'; rr(c, s.x - 18, s.y + 14, 36, 70 + br * 1.5, 14); c.fill();
    }
    void bx; void by;
    if (woke) {
      // sitting bolt upright
      c.fillStyle = 'rgba(20,16,40,.3)'; circ(c, hx + 2, hy + 14, R + 1); c.fill();
      c.fillStyle = hair; circ(c, hx, hy + 12, R + 1.5); c.fill();
      c.fillStyle = skin; circ(c, hx, hy + 14, R); c.fill();
      c.fillStyle = '#1b1626'; circ(c, hx - R * 0.35, hy + 12, 1.8); c.fill(); circ(c, hx + R * 0.35, hy + 12, 1.8); c.fill();
      c.beginPath(); c.arc(hx, hy + 18, 2.4, 0, TAU); c.fill();
      return;
    }
    c.fillStyle = hair; circ(c, hx, hy - 1.5, R + 1.5); c.fill();
    c.fillStyle = skin; circ(c, hx, hy + 1, R); c.fill();
    // closed eyes, which flicker as the meter climbs
    c.strokeStyle = '#3a2a24'; c.lineWidth = 1.3; c.lineCap = 'round';
    const twitch = m > 60 && Math.sin(now * 13 + i) > 0.6;
    for (const sx of [-1, 1]) {
      c.beginPath();
      if (twitch) { circ(c, hx + sx * R * 0.38, hy + 2, 1.5); c.fillStyle = '#1b1626'; c.fill(); }
      else { c.arc(hx + sx * R * 0.38, hy + 1.5, R * 0.2, 0.2, Math.PI - 0.2); c.stroke(); }
    }
    if (m > 35) { c.beginPath(); c.moveTo(hx - R * 0.6, hy - 3.5); c.lineTo(hx - R * 0.15, hy - 2.5); c.moveTo(hx + R * 0.6, hy - 3.5); c.lineTo(hx + R * 0.15, hy - 2.5); c.stroke(); }
    c.fillStyle = 'rgba(160,60,60,.5)'; circ(c, hx, hy + R * 0.55, 1.4 + Math.max(0, br) * 0.8); c.fill();
  }

  // where a sleeper's meter and Zzz sit
  anchor(s) {
    if (s.kind === 'door') {
      const d = 22;
      return s.side === 'left' ? [s.x + d, s.y] : s.side === 'right' ? [s.x - d, s.y] : s.side === 'top' ? [s.x, s.y + d] : [s.x, s.y - d];
    }
    if (s.kind === 'dog') return [s.x, s.y];
    return [s.x, s.y + 1];
  }

  glow(c, g, ui, dt, now) {
    const h = this.h, b = g.ball;
    // the cup glows faintly, like a sticker on a bedroom ceiling
    const pulse = 0.5 + 0.5 * Math.sin(now * 2.2);
    if (g.phase !== 'sunk') {
      c.strokeStyle = `rgba(190,255,200,${0.25 + pulse * 0.25})`; c.lineWidth = 1.5;
      circ(c, h.cup.x, h.cup.y, CUP_R + 3 + pulse * 2); c.stroke();
    }
    // the stairs warn you off
    // moving trail
    if (g.phase === 'roll') { this.trail.push({ x: b.x, y: b.y, t: 0 }); }
    for (const p of this.trail) p.t += dt;
    this.trail = this.trail.filter((p) => p.t < 0.45);
    for (const p of this.trail) { c.fillStyle = `rgba(190,255,200,${0.22 * (1 - p.t / 0.45)})`; circ(c, p.x, p.y, BALL_R * (1 - p.t)); c.fill(); }
    // ripples
    c.lineCap = 'round';
    for (const r of this.ripples) {
      r.t += dt;
      if (r.t < 0) continue;
      const f = r.t / r.life, rad = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - f, 2));
      const a = r.a * (1 - f);
      c.strokeStyle = r.hot ? `rgba(255,170,130,${a})` : `rgba(215,225,255,${a})`;
      c.lineWidth = r.soft ? 1 : 2.2 * (1 - f) + 0.6;
      if (r.soft) { c.setLineDash([2, 4]); }
      circ(c, r.x, r.y, rad); c.stroke();
      c.setLineDash([]);
    }
    this.ripples = this.ripples.filter((r) => r.t < r.life);
    // ball (or the dip into the cup)
    let bs = 1, bx = b.x, by = b.y;
    if (g.phase === 'sunk') { const k = Math.min(1, g.sunkT / 0.35); bs = 1 - k * 0.6; bx += (h.cup.x - bx) * k; by += (h.cup.y - by) * k; }
    const gl = c.createRadialGradient(bx, by, 0, bx, by, 26);
    gl.addColorStop(0, 'rgba(190,255,200,.45)'); gl.addColorStop(1, 'rgba(190,255,200,0)');
    c.fillStyle = gl; circ(c, bx, by, 26); c.fill();
    if (!(g.phase === 'sunk' && g.sunkT > 0.35)) {
      c.fillStyle = '#ecffe9'; circ(c, bx, by, BALL_R * bs); c.fill();
      c.fillStyle = 'rgba(120,190,140,.6)'; circ(c, bx + 1.2, by + 1.4, BALL_R * 0.55 * bs); c.fill();
      c.fillStyle = '#ffffff'; circ(c, bx - 1.5, by - 1.6, 1.4 * bs); c.fill();
    }
    // sparkle when sunk
    for (const sp of this.sparks) { sp.t += dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vx *= 0.95; sp.vy *= 0.95; }
    this.sparks = this.sparks.filter((s) => s.t < 0.9);
    for (const sp of this.sparks) { c.fillStyle = `rgba(220,255,210,${1 - sp.t / 0.9})`; circ(c, sp.x, sp.y, 1.6); c.fill(); }

    // aim
    if (ui.aim && g.phase === 'aim') {
      const { ang, p } = ui.aim;
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const len = 24 + p * 150;
      c.strokeStyle = 'rgba(236,255,233,.85)'; c.lineWidth = 2.2; c.setLineDash([2, 6]); c.lineCap = 'round';
      c.beginPath(); c.moveTo(b.x + ux * 10, b.y + uy * 10); c.lineTo(b.x + ux * len, b.y + uy * len); c.stroke();
      c.setLineDash([]);
      // arrowhead
      const ex = b.x + ux * len, ey = b.y + uy * len;
      c.fillStyle = 'rgba(236,255,233,.9)';
      c.beginPath(); c.moveTo(ex + ux * 6, ey + uy * 6); c.lineTo(ex - uy * 5 - ux * 3, ey + ux * 5 - uy * 3); c.lineTo(ex + uy * 5 - ux * 3, ey - ux * 5 - uy * 3); c.fill();
      // power ring
      const col = p < 0.35 ? '160,230,180' : p < 0.7 ? '255,210,120' : '255,140,110';
      c.strokeStyle = `rgba(${col},.95)`; c.lineWidth = 3;
      c.beginPath(); c.arc(b.x, b.y, 13, ang + Math.PI - p * Math.PI, ang + Math.PI + p * Math.PI); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 3; circ(c, b.x, b.y, 13); c.stroke();
    }
    // the tutorial's ghost hand
    if (ui.ghost) this.ghostHand(c, g, now);
  }

  ghostHand(c, g, now) {
    const b = g.ball;
    const cyc = (now % 2.6) / 2.6;
    const pull = cyc < 0.15 ? 0 : cyc < 0.7 ? (cyc - 0.15) / 0.55 : 1;
    const fade = cyc > 0.85 ? 1 - (cyc - 0.85) / 0.15 : cyc < 0.1 ? cyc / 0.1 : 1;
    const dx = b.x - this.h.cup.x, dy = b.y - this.h.cup.y, d = Math.hypot(dx, dy);
    const ux = dx / d, uy = dy / d;
    const hx = b.x + ux * (8 + pull * 70), hy = b.y + uy * (8 + pull * 70);
    c.globalAlpha = fade * 0.9;
    if (pull > 0) {
      c.strokeStyle = 'rgba(236,255,233,.6)'; c.setLineDash([2, 6]); c.lineWidth = 2;
      c.beginPath(); c.moveTo(b.x - ux * 10, b.y - uy * 10); c.lineTo(b.x - ux * (24 + pull * 100), b.y - uy * (24 + pull * 100)); c.stroke(); c.setLineDash([]);
    }
    // a fingertip
    c.fillStyle = 'rgba(239,231,210,.95)'; circ(c, hx, hy, 9); c.fill();
    c.strokeStyle = '#1f2650'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = 'rgba(239,231,210,.35)'; circ(c, hx, hy, 15 + (cyc < 0.15 ? cyc * 40 : 0)); c.fill();
    c.globalAlpha = 1;
  }

  // screen-space text and meters (stay upright when the room is rotated)
  labels(c, g, ui, dt, now) {
    const h = this.h;
    // meters + Zzz
    h.sleepers.forEach((s, i) => {
      const [ax, ay] = this.anchor(s);
      const X = this.sx(ax, ay), Y = this.sy(ax, ay);
      const m = g.meters[i] / 100;
      const R = Math.max(15, 13 * this.s + 6);
      const woke = g.woke === i;
      // ring
      c.lineCap = 'round';
      c.strokeStyle = 'rgba(20,18,40,.55)'; c.lineWidth = 6;
      c.beginPath(); c.arc(X, Y, R, -Math.PI / 2, Math.PI * 1.5); c.stroke();
      const col = m < 0.5 ? '#a9c4ff' : m < 0.8 ? '#ffc86b' : '#ff7a62';
      if (m > 0.005) { c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.arc(X, Y, R, -Math.PI / 2, -Math.PI / 2 + m * Math.PI * 2); c.stroke(); }
      // how much the putt being aimed would add
      if (ui.aim && g.phase === 'aim') {
        const add = (g.strikeNoise(ui.aim.p) * s.sens * hear(Math.hypot(s.x - g.ball.x, s.y - g.ball.y))) / 100;
        if (add > 0.004) {
          c.strokeStyle = m + add >= 1 ? 'rgba(255,110,90,.9)' : 'rgba(255,255,255,.55)'; c.lineWidth = 4;
          c.beginPath(); c.arc(X, Y, R, -Math.PI / 2 + m * Math.PI * 2, -Math.PI / 2 + Math.min(1, m + add) * Math.PI * 2); c.stroke();
        }
      }
      // halfway tick: past it, no moon
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(X, Y + R - 4); c.lineTo(X, Y + R + 4); c.stroke();
      if (ui.focus === i) {
        c.strokeStyle = `rgba(255,236,170,${0.5 + 0.5 * Math.sin(now * 6)})`; c.lineWidth = 2.5;
        circ(c, X, Y, R + 9 + Math.sin(now * 6) * 2); c.stroke();
      }
      // name
      c.font = '700 14px Gaegu, sans-serif'; c.textAlign = 'center';
      c.fillStyle = 'rgba(239,231,210,.8)';
      const nyy = Y + R + 16;
      c.fillText(woke ? '' : s.name, X, nyy);
      // Zzz drifting up, slower and fewer as they stir
      if (!woke) {
        const n = m < 0.4 ? 3 : m < 0.75 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const ph = (now * 0.35 + k / n + i * 0.3) % 1;
          c.globalAlpha = Math.sin(ph * Math.PI) * 0.85;
          c.font = `700 ${12 + ph * 10}px Gaegu, sans-serif`;
          c.fillStyle = '#dfe6ff';
          c.fillText('z', X + R * 0.7 + ph * 16 + Math.sin(ph * 6) * 3, Y - R * 0.6 - ph * 30);
        }
        c.globalAlpha = 1;
        if (m > 0.7) {
          c.font = '700 15px Gaegu, sans-serif'; c.fillStyle = '#ffd38a';
          c.fillText(['mm?', 'hnn…', 'wha…'][Math.floor(now / 1.4 + i) % 3], X - R - 14, Y - R);
        }
      } else {
        c.font = '400 26px "Bagel Fat One", sans-serif'; c.fillStyle = '#ffd38a';
        c.fillText('!', X + R + 6, Y - R + 4);
      }
    });
    // sound words
    for (const w of this.words) {
      w.t += dt;
      const f = w.t / w.life;
      const X = this.sx(w.x, w.y) + w.dx, Y = this.sy(w.x, w.y) - 14 - f * 26;
      c.globalAlpha = f < 0.1 ? f / 0.1 : 1 - Math.max(0, (f - 0.5) / 0.5);
      c.font = w.big ? '400 22px "Bagel Fat One", sans-serif' : '700 18px Gaegu, sans-serif';
      c.textAlign = 'center';
      c.lineWidth = 4; c.strokeStyle = 'rgba(20,18,40,.8)'; c.strokeText(w.text, X, Y);
      c.fillStyle = w.big ? '#ffb38a' : '#e6ecff'; c.fillText(w.text, X, Y);
    }
    c.globalAlpha = 1;
    this.words = this.words.filter((w) => w.t < w.life);
  }

  sink(g) {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU, v = 40 + Math.random() * 50;
      this.sparks.push({ x: this.h.cup.x, y: this.h.cup.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: Math.random() * 0.2 });
    }
  }
}

export { MAX_V };
