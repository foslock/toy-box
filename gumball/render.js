// Draws the shop: striped wallpaper, a wooden counter, the red-enamel machine with its glass
// globe (which holds every gumball you own, in its own little physics world), the delivery pipe,
// and the felt tray where the scoring happens.
import { World, ring } from './physics.js';
import { L } from './game.js';
import { KINDS } from './symbols.js';
import { sprite, shade } from './icons.js';

const TAU = Math.PI * 2;
const G = L.globe, T = L.tray, C = L.crank;
const GR = 15;                         // gumball radius inside the globe
const ENAMEL = '#d42a2a', ENAMEL_D = '#8f1414', CREAM = '#fff4e0';
const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3));

export class View {
  constructor(cv) {
    this.cv = cv;
    this.c = cv.getContext('2d');
    this.dpr = 1; this.s = 1; this.ox = 0; this.oy = 0;
    this.crankA = 0; this.crankV = 0;
    this.shake = 0; this.shakeDir = 0;
    this.flap = 0;
    this.parts = [];
    this.floats = [];
    this.flyers = [];
    this.time = 0;
    this.globe = new World({ g: 900, sub: 3, iters: 2 });
    ring(this.globe, G.x, G.y, G.r - 3, 32);
    this.gmap = new Map();
    this.highlight = null;      // uid to ring in the tray
    this.wall = null;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = innerWidth, h = innerHeight;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    this.dpr = dpr; this.w = w; this.h = h;
    const top = 0, bot = 0;
    this.s = Math.min(w / L.W, (h - top - bot) / L.H);
    this.ox = (w - L.W * this.s) / 2;
    this.oy = top + Math.max(0, (h - top - bot - L.H * this.s) / 2);
    this.wall = null;
  }

  toWorld(px, py) { return { x: (px - this.ox) / this.s, y: (py - this.oy) / this.s }; }
  toScreen(x, y) { return { x: this.ox + x * this.s, y: this.oy + y * this.s }; }

  // ---- the globe's contents follow the machine's item list
  syncGlobe(items, skip = null) {
    const want = new Set();
    for (const it of items) {
      if (skip && skip.has(it.uid)) continue;
      want.add(it.uid);
      let b = this.gmap.get(it.uid);
      if (!b) {
        b = this.globe.add({ x: G.x + (Math.random() - 0.5) * 60, y: G.y - G.r + 30 + Math.random() * 20, r: GR, vx: (Math.random() - 0.5) * 80, vy: 0, e: 0.3, mu: 0.3, kind: it.kind, uid: it.uid });
        this.gmap.set(it.uid, b);
      }
      b.kind = it.kind;
    }
    for (const [uid, b] of this.gmap) if (!want.has(uid)) { this.globe.remove(b); this.gmap.delete(uid); }
  }

  globePos(uid) { const b = this.gmap.get(uid); return b ? { x: b.x, y: b.y } : { x: G.x, y: G.y + 60 }; }

  jostle(k = 1) {
    for (const b of this.globe.balls) { b.vx += (Math.random() - 0.5) * 260 * k; b.vy -= Math.random() * 240 * k; }
  }

  // a ball travelling along a path of points over `dur` seconds, then calling done()
  fly(kind, pts, dur, delay, done, r0 = GR, r1 = GR) {
    this.flyers.push({ kind, pts, dur, t: -delay, done, r0, r1 });
  }

  burst(x, y, col, n = 14, spd = 260) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = spd * (0.4 + Math.random() * 0.8);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0.6 + Math.random() * 0.4, t: 0, col, sz: 2 + Math.random() * 4 });
    }
  }

  float(x, y, text, col = '#ffe14d', big = false) { this.floats.push({ x, y, text, col, t: 0, big }); }

  turnCrank() { this.crankV = TAU * 2.2; }

  update(dt) {
    this.time += dt;
    this.globe.step(Math.min(dt, 1 / 30));
    if (this.crankV > 0) { const d = Math.min(this.crankV * dt * 2.2, this.crankV); this.crankA += d; this.crankV -= d; if (this.crankV < 0.01) this.crankV = 0; }
    this.shake *= Math.exp(-dt * 9);
    this.flap = Math.max(0, this.flap - dt * 5);
    for (const p of this.parts) { p.t += dt; p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.parts = this.parts.filter((p) => p.t < p.life);
    for (const f of this.floats) f.t += dt;
    this.floats = this.floats.filter((f) => f.t < 1.1);
    for (const f of this.flyers) {
      f.t += dt;
      if (f.t >= f.dur && !f.fin) { f.fin = true; f.done && f.done(); }
    }
    this.flyers = this.flyers.filter((f) => !f.fin);
  }

  // ---------------------------------------------------------------- drawing
  draw(game, score, opts = {}) {
    const c = this.c, d = this.dpr;
    c.setTransform(d, 0, 0, d, 0, 0);
    this.drawWall();
    c.setTransform(d * this.s, 0, 0, d * this.s, d * this.ox, d * this.oy);
    this.drawMachine();
    this.drawTray(game, score, opts);
    this.drawFlyers();
    this.drawFx();
  }

  drawWall() {
    const c = this.c, w = this.w, h = this.h;
    if (!this.wall) {
      const cv = document.createElement('canvas');
      cv.width = Math.round(w * this.dpr); cv.height = Math.round(h * this.dpr);
      const x = cv.getContext('2d');
      x.scale(this.dpr, this.dpr);
      const sw = 22 * Math.max(0.8, this.s);
      x.fillStyle = '#f9efdc'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#bfe6d3';
      for (let i = -1; i * sw * 2 < w + sw * 2; i++) x.fillRect(this.ox % (sw * 2) + i * sw * 2, 0, sw, h);
      // pinstripe
      x.fillStyle = 'rgba(212,42,42,.25)';
      for (let i = -1; i * sw * 2 < w + sw * 2; i++) x.fillRect(this.ox % (sw * 2) + i * sw * 2 + sw * 1.5 - 1, 0, 2, h);
      // counter
      const cy = this.oy + 437 * this.s;
      const wood = x.createLinearGradient(0, cy, 0, h);
      wood.addColorStop(0, '#a8643a'); wood.addColorStop(0.02, '#8a4b29'); wood.addColorStop(1, '#5e3019');
      x.fillStyle = wood; x.fillRect(0, cy, w, h - cy);
      x.strokeStyle = 'rgba(40,15,5,.25)'; x.lineWidth = 1;
      for (let yy = cy + 26 * this.s; yy < h; yy += 34 * this.s) { x.beginPath(); x.moveTo(0, yy); x.lineTo(w, yy); x.stroke(); }
      x.fillStyle = '#c47a48'; x.fillRect(0, cy - 4 * this.s, w, 5 * this.s);
      x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, cy - 4 * this.s, w, 1.5 * this.s);
      // a soft shadow where the machine stands
      const sh = x.createRadialGradient(this.ox + 200 * this.s, cy, 0, this.ox + 200 * this.s, cy, 170 * this.s);
      sh.addColorStop(0, 'rgba(30,8,0,.35)'); sh.addColorStop(1, 'rgba(30,8,0,0)');
      x.fillStyle = sh; x.fillRect(0, cy - 10, w, 60 * this.s);
      this.wall = cv;
    }
    c.drawImage(this.wall, 0, 0, w, h);
  }

  ball(kind, x, y, r, roll = 0, alpha = 1) {
    const c = this.c, px = r * this.s * this.dpr;
    const sp = sprite(kind, px, roll);
    const k = r / Math.round(Math.max(4, px));
    const sz = sp.width * k;
    if (alpha < 1) c.globalAlpha = alpha;
    c.drawImage(sp, x - sz / 2, y - sz / 2, sz, sz);
    if (alpha < 1) c.globalAlpha = 1;
  }

  drawMachine() {
    const c = this.c;
    // pipe from machine to tray, behind everything
    const pg = c.createLinearGradient(178, 0, 222, 0);
    pg.addColorStop(0, '#7d8590'); pg.addColorStop(0.35, '#f4f6f8'); pg.addColorStop(0.6, '#c9ced6'); pg.addColorStop(1, '#6b727c');
    c.fillStyle = pg; c.fillRect(180, L.body.bot - 6, 40, T.lid - L.body.bot + 4);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(180, L.body.bot - 6, 40, 4);

    // body: red enamel, flaring at the base
    const top = L.body.top, bot = L.body.bot;
    c.beginPath();
    c.moveTo(118, top + 6); c.lineTo(282, top + 6);
    c.quadraticCurveTo(290, top + 6, 292, top + 18);
    c.lineTo(310, bot - 14); c.quadraticCurveTo(312, bot, 298, bot);
    c.lineTo(102, bot); c.quadraticCurveTo(88, bot, 90, bot - 14);
    c.lineTo(108, top + 18); c.quadraticCurveTo(110, top + 6, 118, top + 6);
    c.closePath();
    const bg = c.createLinearGradient(90, 0, 310, 0);
    bg.addColorStop(0, ENAMEL_D); bg.addColorStop(0.18, ENAMEL); bg.addColorStop(0.42, '#ff5a4a'); bg.addColorStop(0.6, ENAMEL); bg.addColorStop(1, '#7a0f0f');
    c.fillStyle = bg; c.fill();
    c.lineWidth = 2; c.strokeStyle = '#5c0909'; c.stroke();
    // enamel shine
    c.fillStyle = 'rgba(255,255,255,.22)';
    c.beginPath(); c.moveTo(132, top + 14); c.lineTo(146, top + 14); c.lineTo(132, bot - 10); c.lineTo(118, bot - 10); c.closePath(); c.fill();
    // chrome base band
    const cb = c.createLinearGradient(0, bot - 16, 0, bot);
    cb.addColorStop(0, '#f4f6f8'); cb.addColorStop(0.5, '#9aa2ad'); cb.addColorStop(1, '#5d646e');
    c.fillStyle = cb; c.beginPath(); c.roundRect(86, bot - 12, 228, 14, 5); c.fill();
    // lettering
    c.fillStyle = CREAM; c.font = '400 19px Shrikhand, Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillText('Gumballs', 200, top + 32);
    // little chrome plates either side of the crank
    for (const [px, t1, t2] of [[133, '1¢', 'A TURN'], [267, 'NO', 'REFUNDS']]) {
      const pl = c.createLinearGradient(0, C.y - 16, 0, C.y + 22);
      pl.addColorStop(0, '#f4f6f8'); pl.addColorStop(1, '#8a929c');
      c.fillStyle = pl; c.beginPath(); c.roundRect(px - 25, C.y - 14, 50, 34, 6); c.fill();
      c.fillStyle = ENAMEL_D; c.font = '900 15px "Big Shoulders Display", sans-serif'; c.fillText(t1, px, C.y + 2);
      c.font = '800 9px "Big Shoulders Display", sans-serif'; c.fillText(t2, px, C.y + 14);
    }

    // crank: chrome plate, rotating handle
    const cx = C.x, cy = C.y + 4;
    const plate = c.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, C.r + 4);
    plate.addColorStop(0, '#ffffff'); plate.addColorStop(0.5, '#c9ced6'); plate.addColorStop(1, '#6b727c');
    c.fillStyle = plate; c.beginPath(); c.arc(cx, cy, C.r + 2, 0, TAU); c.fill();
    c.strokeStyle = '#4b525c'; c.lineWidth = 1.5; c.stroke();
    c.save(); c.translate(cx, cy); c.rotate(this.crankA);
    c.fillStyle = '#5d646e'; c.beginPath(); c.roundRect(-30, -8, 60, 16, 8); c.fill();
    const arm = c.createLinearGradient(0, -7, 0, 7); arm.addColorStop(0, '#ffffff'); arm.addColorStop(0.5, '#cfd4db'); arm.addColorStop(1, '#868e98');
    c.fillStyle = arm; c.beginPath(); c.roundRect(-29, -6.5, 58, 13, 6.5); c.fill();
    c.restore();
    const hub = c.createRadialGradient(cx - 4, cy - 5, 1, cx, cy, 12);
    hub.addColorStop(0, '#ffffff'); hub.addColorStop(1, '#7d8590');
    c.fillStyle = hub; c.beginPath(); c.arc(cx, cy, 11, 0, TAU); c.fill();

    // collar between globe and body
    const col = c.createLinearGradient(0, top - 14, 0, top + 10);
    col.addColorStop(0, '#f4f6f8'); col.addColorStop(0.5, '#a3abb5'); col.addColorStop(1, '#5d646e');
    c.fillStyle = col; c.beginPath(); c.roundRect(112, top - 12, 176, 22, 8); c.fill();

    // globe: glass back, balls, glass front
    c.save();
    c.beginPath(); c.arc(G.x, G.y, G.r, 0, TAU);
    const gb = c.createRadialGradient(G.x - 30, G.y - 40, 10, G.x, G.y, G.r);
    gb.addColorStop(0, 'rgba(255,255,255,.55)'); gb.addColorStop(0.7, 'rgba(220,240,245,.35)'); gb.addColorStop(1, 'rgba(150,190,200,.55)');
    c.fillStyle = gb; c.fill();
    c.clip();
    for (const b of this.globe.balls) this.ball(b.kind, b.x, b.y, b.r);
    c.restore();
    c.lineWidth = 3; c.strokeStyle = 'rgba(90,120,130,.45)'; c.beginPath(); c.arc(G.x, G.y, G.r, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.arc(G.x, G.y, G.r - 14, Math.PI * 1.08, Math.PI * 1.38); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.arc(G.x, G.y, G.r - 14, Math.PI * 1.45, Math.PI * 1.52); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 4; c.beginPath(); c.arc(G.x, G.y, G.r - 10, Math.PI * 0.1, Math.PI * 0.3); c.stroke();

    // cap and knob
    const capY = G.y - G.r + 2;
    const cap = c.createLinearGradient(0, capY - 22, 0, capY + 6);
    cap.addColorStop(0, '#ff6a5a'); cap.addColorStop(0.5, ENAMEL); cap.addColorStop(1, ENAMEL_D);
    c.fillStyle = cap; c.beginPath(); c.ellipse(G.x, capY, 52, 14, 0, Math.PI, 0); c.lineTo(G.x + 52, capY + 4); c.lineTo(G.x - 52, capY + 4); c.closePath(); c.fill();
    c.fillStyle = col; c.beginPath(); c.roundRect(G.x - 56, capY, 112, 9, 4); c.fill();
    const kn = c.createRadialGradient(G.x - 4, capY - 22, 1, G.x, capY - 16, 11);
    kn.addColorStop(0, '#ffffff'); kn.addColorStop(1, '#7d8590');
    c.fillStyle = kn; c.beginPath(); c.arc(G.x, capY - 16, 9, 0, TAU); c.fill();
  }

  drawTray(game, score, opts) {
    const c = this.c;
    const sx = this.shake * this.shakeDir * 7;
    c.save();
    c.translate(sx, 0);
    // chrome frame
    const fx0 = T.x0 - 12, fx1 = T.x1 + 12, fy0 = T.lid - 12, fy1 = T.floorMid + 16;
    const fr = c.createLinearGradient(0, fy0, 0, fy1);
    fr.addColorStop(0, '#f4f6f8'); fr.addColorStop(0.08, '#aab2bc'); fr.addColorStop(0.92, '#8a929c'); fr.addColorStop(1, '#4b525c');
    c.fillStyle = 'rgba(30,8,0,.35)'; c.beginPath(); c.roundRect(fx0 + 4, fy0 + 8, fx1 - fx0, fy1 - fy0, 14); c.fill();
    c.fillStyle = fr; c.beginPath(); c.roundRect(fx0, fy0, fx1 - fx0, fy1 - fy0, 14); c.fill();
    // felt
    c.save();
    c.beginPath(); c.moveTo(T.x0, T.lid); c.lineTo(T.x1, T.lid); c.lineTo(T.x1, T.floorSide); c.lineTo(L.W / 2, T.floorMid); c.lineTo(T.x0, T.floorSide); c.closePath();
    const felt = c.createRadialGradient(200, 560, 20, 200, 580, 230);
    felt.addColorStop(0, '#2c8a70'); felt.addColorStop(1, '#155846');
    c.fillStyle = felt; c.fill();
    c.clip();
    // felt texture dots
    c.fillStyle = 'rgba(255,255,255,.035)';
    for (let i = 0; i < 160; i++) { const x = T.x0 + ((i * 97) % 344), y = T.lid + ((i * 53) % 220); c.fillRect(x, y, 2, 2); }
    // a printed ring on the felt
    c.strokeStyle = 'rgba(255,244,224,.10)'; c.lineWidth = 2; c.setLineDash([6, 6]);
    c.beginPath(); c.arc(200, 640, 120, Math.PI, 0); c.stroke(); c.setLineDash([]);

    // trapdoor flap in the lid
    c.fillStyle = '#0d3a2e'; c.fillRect(180, T.lid, 40, 6 + this.flap * 18);

    // balls
    const balls = game.tray;
    for (const b of balls) {
      if (b.hidden) continue;
      const roll = b.kind === 'dice' ? b.roll : 0;
      this.ball(b.kind, b.x, b.y, b.r, roll);
    }
    if (score && opts.showScore) this.drawScore(balls, score);
    if (this.highlight != null) {
      const b = balls.find((x) => x.id === this.highlight);
      if (b) { c.strokeStyle = '#fff4e0'; c.lineWidth = 2.5; c.setLineDash([5, 4]); c.beginPath(); c.arc(b.x, b.y, b.r + 5, this.time * 2, this.time * 2 + TAU); c.stroke(); c.setLineDash([]); }
    }
    c.restore();
    // glass front: highlights
    c.fillStyle = 'rgba(255,255,255,.07)';
    c.beginPath(); c.moveTo(T.x0, T.lid); c.lineTo(T.x0 + 70, T.lid); c.lineTo(T.x0 + 20, T.floorSide); c.lineTo(T.x0, T.floorSide); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.12)';
    c.fillRect(T.x0 + 84, T.lid + 4, 8, 60);
    // lid lip
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(T.x0, T.lid, T.x1 - T.x0, 3);
    c.restore();
  }

  drawScore(balls, s) {
    const c = this.c;
    // contact badges: where two gumballs work together
    const seen = new Set();
    for (const l of s.links) {
      const a = balls[l.a], b = balls[l.b];
      if (!a || !b || a.hidden || b.hidden) continue;
      const key = Math.min(l.a, l.b) + ':' + Math.max(l.a, l.b) + l.kind;
      if (seen.has(key)) continue; seen.add(key);
      const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy) || 1;
      const t = a.r / (a.r + b.r);
      const x = a.x + dx * t, y = a.y + dy * t;
      const col = l.kind === 'boom' ? '#ff3b30' : l.kind === 'eat' ? '#ff8a1f' : l.kind === 'mult' ? '#ff4fd8' : '#ffd23f';
      const pulse = 1 + Math.sin(this.time * 6 + l.a) * 0.08;
      c.fillStyle = col; c.strokeStyle = '#3a1208'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(x, y, 7 * pulse, 0, TAU); c.fill(); c.stroke();
      c.strokeStyle = '#3a1208'; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath();
      if (l.kind === 'plus') { c.moveTo(x - 3.5, y); c.lineTo(x + 3.5, y); c.moveTo(x, y - 3.5); c.lineTo(x, y + 3.5); }
      else if (l.kind === 'mult') { c.moveTo(x - 3, y - 3); c.lineTo(x + 3, y + 3); c.moveTo(x + 3, y - 3); c.lineTo(x - 3, y + 3); }
      else if (l.kind === 'eat') { c.moveTo(x - 3.5, y - 2); c.lineTo(x - 1.5, y + 2); c.lineTo(x, y - 2); c.lineTo(x + 1.5, y + 2); c.lineTo(x + 3.5, y - 2); }
      else { c.moveTo(x - 3, y - 3); c.lineTo(x + 3, y + 3); c.moveTo(x + 3, y - 3); c.lineTo(x - 3, y + 3); c.moveTo(x, y - 4); c.lineTo(x, y + 4); }
      c.stroke();
    }
    // value tags
    c.font = '800 13px "Big Shoulders Display", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    balls.forEach((b, i) => {
      if (b.hidden) return;
      const v = s.vals[i], f = s.fate[i];
      const base = KINDS[b.kind].base;
      const x = b.x + b.r * 0.62, y = b.y - b.r * 0.62;
      const txt = f === 'eaten' ? '0' : String(v);
      const w = Math.max(17, c.measureText(txt).width + 9);
      c.fillStyle = f === 'boom' ? '#ff3b30' : f === 'eaten' ? '#6b6b6b' : v > base ? '#ffd23f' : v === 0 ? '#c9c2b6' : CREAM;
      c.strokeStyle = '#3a1208'; c.lineWidth = 1.5;
      c.beginPath(); c.roundRect(x - w / 2, y - 8.5, w, 17, 8.5); c.fill(); c.stroke();
      c.fillStyle = '#3a1208'; c.fillText(txt, x, y + 0.5);
    });
  }

  drawFlyers() {
    for (const f of this.flyers) {
      if (f.t < 0) continue;
      const u = ease(f.t / f.dur), n = f.pts.length - 1;
      const seg = Math.min(n - 1, Math.floor(u * n)), lt = u * n - seg;
      const a = f.pts[seg], b = f.pts[seg + 1];
      const x = a.x + (b.x - a.x) * lt, y = a.y + (b.y - a.y) * lt;
      // hide while inside the pipe
      if (x > 178 && x < 222 && y > L.body.bot - 4 && y < T.lid) continue;
      if (Math.abs(x - 200) < 30 && y > L.body.top - 10 && y < L.body.bot) continue;
      this.ball(f.kind, x, y, f.r0 + (f.r1 - f.r0) * u);
    }
  }

  drawFx() {
    const c = this.c;
    for (const p of this.parts) {
      c.globalAlpha = Math.max(0, 1 - p.t / p.life);
      c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.sz, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const f of this.floats) {
      const u = f.t / 1.1;
      c.globalAlpha = u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25;
      const y = f.y - ease(f.t / 0.8) * 34;
      c.font = (f.big ? '900 30px' : '900 20px') + ' "Big Shoulders Display", sans-serif';
      c.lineWidth = 4; c.strokeStyle = '#3a1208'; c.strokeText(f.text, f.x, y);
      c.fillStyle = f.col; c.fillText(f.text, f.x, y);
    }
    c.globalAlpha = 1;
  }

  hitBall(game, px, py) {
    const p = this.toWorld(px, py);
    let best = null, bd = 1e9;
    for (const b of game.tray) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < b.r + 8 && d < bd) { bd = d; best = b; } }
    return best;
  }
  hitCrank(px, py) { const p = this.toWorld(px, py); return Math.hypot(p.x - C.x, p.y - C.y) < C.r + 16 || (Math.hypot(p.x - G.x, p.y - G.y) < G.r); }
  inTray(px, py) { const p = this.toWorld(px, py); return p.x > T.x0 - 10 && p.x < T.x1 + 10 && p.y > T.lid - 10 && p.y < T.floorMid + 20; }
}
