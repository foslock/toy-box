// Draws the game: the baked ground, animated water, everything that stands or walks (sorted by its feet), the small
// lives going on (washing, smoke, birds, a train), and then the end of each loop: the groans, the shaking, the water.
import { T, G, MAPS, ANCHORS } from './world.js';
import { C, mk, bakeGround, waterFrames, propSprite, personSheet, catSheet, PLAYER_LOOK, letters, textW, OY } from './art.js';
import { NPCS } from './people.js';
import { hash, clamp, BREAK, LOOP } from './util.js';
import { FRONT_ROW0, FRONT_RATE } from './sim.js';

const FLAT = new Set(['stage', 'flowers', 'plaque', 'crack', 'sluice', 'bench', 'duck', 'wheel', 'sheet']);
const mapsSorted = {};
for (const [id, a] of Object.entries(MAPS)) mapsSorted[id] = a.props.filter(p => !FLAT.has(p.k)).map(p => ({ p, base: (p.y + p.h) * T })).sort((a, b) => a.base - b.base);

const SUNS = '#fff4cf';
export class View {
  constructor(canvas) {
    this.cv = canvas; this.x = canvas.getContext('2d'); this.S = 3; this.w = 0; this.h = 0;
    this.ground = {}; for (const [id, a] of Object.entries(MAPS)) this.ground[id] = bakeGround(a);
    this.water = waterFrames();
    this.sheets = { you: personSheet(PLAYER_LOOK), cat: catSheet() };
    for (const n of NPCS) if (!n.cat) this.sheets[n.id] = personSheet(n.look);
    this.fx = []; this.shakeAmt = 0; this.fade = 0; this.birds = this.makeBirds();
    this.cam = { x: 0, y: 0 };
  }
  makeBirds() { const spots = [[46, 5.2], [48, 5.4], [30, 10.5], [33, 10.6], [10, 12.6], [18, 6.7], [9, 24.4]]; return spots.map(([x, y], i) => ({ x, y, ph: i * 1.7, fly: 0, vx: 1 + (i % 3) * .4 })); }
  resize(W, H, dpr = 1) {
    this.W = W; this.H = H; this.dpr = dpr;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); this.setScale(null); this.x.imageSmoothingEnabled = false;
  }
  // the town is seen from further off than a room, so a room is drawn bigger, to fill the screen
  setScale(area) {
    const W = this.W, H = this.H, base = Math.max(2, Math.min(5, Math.floor(Math.min(W / (T * 15), H / (T * 10)))));
    const css = area && area.interior ? Math.max(base, Math.min(6, Math.floor(Math.min(W / ((area.w + 1) * T), H / ((area.h + 4) * T))))) : base;
    const S = Math.max(1, Math.round(css * this.dpr));
    if (S !== this.S || !this.w) { this.S = S; this.w = this.cv.width / S; this.h = this.cv.height / S; }
  }
  tilesAcross() { return { hw: Math.ceil(this.w / T / 2) + 1, hh: Math.ceil(this.h / T / 2) + 1 }; }
  onEvent(ev, g) {
    if (ev.type === 'caught') { const e = ev.data === 'you' ? g.player : g.npcs.find(n => n.id === ev.data); if (e) this.fx.push({ k: 'splash', map: e.map, x: e.rx * T + 8, y: e.ry * T + 14, t: 0 }); }
    if (ev.type === 'break') this.fx.push({ k: 'burst', t: 0 });
    if (ev.type === 'siren') this.fx.push({ k: 'siren', t: 0 });
    if (ev.type === 'bellring') this.fx.push({ k: 'bell', t: 0 });
    if (ev.type === 'chime') this.fx.push({ k: 'bell', t: 0 });
    if (ev.type === 'decree') this.fx.push({ k: 'decree', t: 0 });
  }

  /* ------------------------------------------------------------------------------------------------------------ frame */
  // alpha < 1 lays this picture over the last one, so several draws within one frame average into a motion blur
  draw(g, now, dt = 1 / 60, alpha = 1) {
    const x = this.x, p = g.player, area = MAPS[p.map], t = g.t; this.setScale(area); const S = this.S;
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = alpha;
    x.fillStyle = area.interior ? '#ecdcc4' : '#a8d8f0'; x.fillRect(0, 0, this.cv.width, this.cv.height);
    // camera: on the player, held inside the map; a room smaller than the screen sits in the middle
    const pw = area.w * T, ph = area.h * T;
    let cx = (p.rx + 0.5) * T - this.w / 2, cy = (p.ry + 0.5) * T - this.h / 2;
    cx = pw <= this.w ? -(this.w - pw) / 2 : clamp(cx, 0, pw - this.w); cy = ph <= this.h ? -(this.h - ph) / 2 : clamp(cy, 0, ph - this.h);
    // groans and the break shake the picture
    const sh = this.shake(g); const jx = sh ? (Math.sin(now * 53) + Math.sin(now * 91)) * sh : 0, jy = sh ? (Math.cos(now * 47) + Math.sin(now * 77)) * sh * .8 : 0;
    cx = Math.round(cx + jx); cy = Math.round(cy + jy); this.cam.x = cx; this.cam.y = cy;
    x.setTransform(S, 0, 0, S, -cx * S, -cy * S);
    const vx0 = cx, vy0 = cy, vx1 = cx + this.w, vy1 = cy + this.h;
    const gx0 = Math.max(0, Math.floor(vx0 / T)), gy0 = Math.max(0, Math.floor(vy0 / T)), gx1 = Math.min(area.w - 1, Math.floor(vx1 / T)), gy1 = Math.min(area.h - 1, Math.floor(vy1 / T));
    const gc = this.ground[area.id]; x.drawImage(gc, gx0 * T, gy0 * T, (gx1 - gx0 + 1) * T, (gy1 - gy0 + 1) * T, gx0 * T, gy0 * T, (gx1 - gx0 + 1) * T, (gy1 - gy0 + 1) * T);
    if (area.interior) this.drawRoomEdge(x, area);
    if (!area.interior) { this.drawWater(x, area, gx0, gy0, gx1, gy1, now); this.drawFlat(x, area, now, g); }
    else this.drawFlat(x, area, now, g);

    // the sorted pass: props, people, and the little lives that stand on the ground
    const list = [];
    for (const it of mapsSorted[area.id]) { const q = it.p, sp = (it.sp ??= propSprite(q) || false); if (!sp) continue; const px = q.x * T - ((sp.width - q.w * T) >> 1), py = (q.y + q.h) * T - sp.height; if (px > vx1 || py > vy1 || px + sp.width < vx0 || py + sp.height < vy0) continue; list.push({ b: it.base, d: () => this.drawProp(x, q, sp, px, py, now, g) }); }
    for (const n of g.npcs) if (n.map === area.id && !n.caught) list.push({ b: (n.ry + 1) * T + 0.5, d: () => this.drawPerson(x, n, g, now) });
    if (!p.caught) list.push({ b: (p.ry + 1) * T + 0.6, d: () => this.drawYou(x, g, now) });
    if (!area.interior) for (const s of this.sheetProps(area)) list.push({ b: (s.y + 1) * T, d: () => this.drawSheet(x, s, now) });
    if (!area.interior) list.push({ b: 99999, d: () => this.drawRails(x, g, now) });
    list.sort((a, b) => a.b - b.b);
    for (const it of list) it.d();
    if (!area.interior) { this.drawBunting(x, now); this.drawBirds(x, g, now, dt); this.drawButterflies(x, now); this.drawSmoke(x, now); this.drawChapel(x, g, now); this.drawSirenHorn(x, g, now); this.drawMillWheel(x, now, g); this.drawDuck(x, now, g); this.drawDamLife(x, g, now); }
    this.drawPrompt(x, g, now);
    this.drawFx(x, g, now, dt);
    this.drawFlood(x, g, area, now, gx0, gy0, gx1, gy1, cx, cy);
    // the light of the day: warm at first, then something cold in the air
    x.setTransform(1, 0, 0, 1, 0, 0);
    const warm = t < 190 ? 0.05 : 0, cold = clamp((t - 190) / 35, 0, 1) * 0.2;
    if (warm) { x.fillStyle = 'rgba(255,238,170,' + warm + ')'; x.fillRect(0, 0, this.cv.width, this.cv.height); }
    if (cold > 0) { x.fillStyle = 'rgba(96,110,160,' + cold + ')'; x.fillRect(0, 0, this.cv.width, this.cv.height); }
    if (this.fade > 0) { x.fillStyle = 'rgba(255,252,240,' + this.fade + ')'; x.fillRect(0, 0, this.cv.width, this.cv.height); }
    x.globalAlpha = 1;
    this.lapse = g.ff > 0 && !g.ended;
    if (this.lapse) this.warp(g, now);
  }
  // Time catching up: the picture ripples like heat over water, and pale streaks rush out from the player, but
  // everything stays plainly visible. It swells in at the start and settles out at the end.
  warp(g, now) {
    const cv = this.cv, W = cv.width, H = cv.height, S = this.S, x = this.x, f = 1 - g.ff / Math.max(0.01, g.ffCost || 1);
    const env = Math.max(0, Math.min(1, f / 0.1, (1 - f) / 0.1)) * Math.min(1, (g.ffCost || 0) / 8);
    if (env <= 0.01) return;
    if (!this.buf || this.buf.width !== W || this.buf.height !== H) { this.buf = document.createElement('canvas'); this.buf.width = W; this.buf.height = H; this.bx = this.buf.getContext('2d'); }
    this.bx.setTransform(1, 0, 0, 1, 0, 0); this.bx.drawImage(cv, 0, 0);
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1;
    const h = Math.max(3, Math.round(S * 1.5)), amp = env * S * 1.3, cy = H / 2;
    for (let y = 0; y < H; y += h) {
      const k = Math.abs(y - cy) / cy, dx = Math.round(Math.sin(y / (S * 3.2) + now * 11) * amp * (0.45 + 0.9 * k) + Math.sin(y / (S * 9) - now * 5) * amp * 0.6);
      x.drawImage(this.buf, 0, y, W, h, dx, y, W, h);
    }
    // streaks rushing outward from where you stand
    const p = g.player, px = (p.rx + 0.5) * T - this.cam.x, py = (p.ry + 0.5) * T - this.cam.y, cx0 = px * S, cy0 = py * S, R = Math.hypot(W, H) * 0.6;
    x.lineCap = 'round';
    for (let i = 0; i < 34; i++) {
      const a = hash(i, 3, 91) * Math.PI * 2, sp = 0.5 + hash(i, 4, 92), u = (now * sp * 0.8 + hash(i, 5, 93)) % 1, r0 = (0.18 + u * 0.8) * R, len = (0.05 + 0.12 * hash(i, 6, 94)) * R * (0.4 + u);
      x.strokeStyle = (i % 3 ? 'rgba(255,255,255,' : 'rgba(205,190,255,') + (env * 0.45 * Math.sin(u * Math.PI)) + ')'; x.lineWidth = Math.max(1, S * (0.5 + hash(i, 7, 95)));
      x.beginPath(); x.moveTo(cx0 + Math.cos(a) * r0, cy0 + Math.sin(a) * r0); x.lineTo(cx0 + Math.cos(a) * (r0 + len), cy0 + Math.sin(a) * (r0 + len)); x.stroke();
    }
  }
  shake(g) {
    const t = g.t; let s = 0;
    if (t >= 195 && t < 199.5) s = 0.4; else if (t >= 208 && t < 214) s = 0.7; else if (t >= 220 && t < BREAK) s = 1.4;
    else if (t >= BREAK && t < BREAK + 9) s = 2 - (t - BREAK) / 9 * 1.2;
    return s;
  }
  drawRoomEdge(x, a) { x.fillStyle = 'rgba(120,90,70,.5)'; x.fillRect(-2, -2, a.w * T + 4, 2); x.fillRect(-2, a.h * T, a.w * T + 4, 2); x.fillRect(-2, 0, 2, a.h * T); x.fillRect(a.w * T, 0, 2, a.h * T); }

  drawWater(x, a, gx0, gy0, gx1, gy1, now) {
    const fr = Math.floor(now * 4);
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const g = a.g[gy * a.w + gx]; if (g !== G.WATER && g !== G.DEEP) continue;
      const deep = g === G.DEEP ? 1 : 0, k = deep ? (fr + gx) & 3 : (fr - gy + (gx & 1)) & 3;
      x.drawImage(this.water[deep][((k % 4) + 4) % 4], gx * T, gy * T);
      // a soft sandy fringe on the banks, and foam where the river meets the dam
      if (!deep && gy === 5) { x.fillStyle = 'rgba(255,255,255,.65)'; for (let i = 0; i < 4; i++) x.fillRect(gx * T + ((i * 5 + fr * 2) % 14), gy * T + ((i * 3) % 4), 3, 1); }
    }
  }
  drawFlat(x, a, now, g) {
    for (const p of a.props) {
      if (!FLAT.has(p.k) || p.k === 'duck' || p.k === 'wheel' || p.k === 'sheet') continue;
      const sp = propSprite(p); if (!sp) continue;
      if (p.k === 'crack') { const grow = 1 + g.t / 90; x.drawImage(sp, p.x * T, p.y * T); x.fillStyle = '#8fd6ea'; x.fillRect(p.x * T + 8, p.y * T + 4, Math.min(3, grow), 12); if (g.t > 150) { x.fillStyle = 'rgba(255,255,255,.8)'; x.fillRect(p.x * T + 6, p.y * T + ((now * 30) % 14), 2, 2); } continue; }
      if (p.k === 'stage') continue;
      x.drawImage(sp, p.x * T - ((sp.width - p.w * T) >> 1), (p.y + p.h) * T - sp.height);
    }
    if (a.id === 'town') { this.drawStageBanner(x); this.drawDamTop(x, now); }
  }
  drawDamTop(x, now) {
    // a railing along the walkway, and the town's hundred-year banner hung off it
    x.fillStyle = '#f4efe6'; x.fillRect(12 * T, 3 * T - 1, 29 * T, 2); x.fillStyle = '#d6cfc4'; x.fillRect(12 * T, 3 * T + 1, 29 * T, 1);
    for (let px = 12 * T + 4; px < 41 * T; px += 12) { x.fillStyle = '#e8e1d6'; x.fillRect(px, 3 * T - 4, 2, 6); }
    const bx = 14 * T, by = 4 * T + 1, sway = Math.sin(now * 1.6) * 0.8;
    x.fillStyle = '#c9a070'; x.fillRect(bx - 1, 3 * T + 8, 2, 8); x.fillRect(bx + 7 * T - 1, 3 * T + 8, 2, 8);
    x.fillStyle = '#f2a3b4'; x.fillRect(bx, by + 2, 7 * T, 13); x.fillStyle = '#f8c6d2'; x.fillRect(bx, by + 2, 7 * T, 2); x.fillStyle = '#e08aa0'; for (let i = 0; i < 7 * T; i += 8) x.fillRect(bx + i + sway, by + 15, 4, 3);
    const nm = '100 YEARS OF THE DAM'; letters(x, nm, bx + ((7 * T - textW(nm)) >> 1), by + 6, '#fff');
  }
  drawStageBanner(x) { x.fillStyle = '#8c735f'; x.fillRect(33 * T + 12, 21 * T + 3, 4 * T - 8 + 4, 12); x.fillStyle = '#f6e0b4'; x.fillRect(33 * T + 14, 21 * T + 4, 4 * T - 12 + 4, 10); const nm = 'DAM DAY'; letters(x, nm, 33 * T + 14 + ((4 * T - 8 - textW(nm)) >> 1), 21 * T + 7, '#c86a7c'); }

  drawRails(x, g, now) {
    if (g.player.map !== 'town') return;
    const t = Math.max(0, g.t - 1.5); if (t > 26) return;
    // while time catches up, the train smears along its track
    if (this.lapse) for (let k = 5; k >= 1; k--) { const tt = t - k * 0.22; if (tt < 0) continue; x.globalAlpha = 0.05 + 0.07 * (5 - k); this.trainAt(x, tt, false); }
    x.globalAlpha = 1; this.trainAt(x, t, true);
  }
  trainAt(x, t, smoke) {
    const tx = 9 + t * t * 0.18, y = 40 * T - 2;
    const cars = [['#f2a3b4', '#f8c8d2'], ['#9ad0c0', '#bde8d8'], ['#f8d584', '#fbe6ae'], ['#b8a7e6', '#d6c9f4']];
    // the engine, facing east, then three carriages: the 7:56 you came in on, pulling away
    x.fillStyle = '#7f88a0'; x.fillRect(tx * T, y + 4, 52, 3);
    x.fillStyle = '#9a8ab8'; x.fillRect(tx * T + 18, y - 4, 32, 22); x.fillStyle = '#b8a8d8'; x.fillRect(tx * T + 18, y - 4, 32, 4);
    x.fillStyle = '#fffaf0'; x.fillRect(tx * T + 22, y, 8, 6); x.fillStyle = '#bfe6f6'; x.fillRect(tx * T + 23, y + 1, 6, 4);
    x.fillStyle = '#f6d36a'; x.fillRect(tx * T + 48, y + 6, 4, 4); x.fillStyle = '#6c5a78'; x.fillRect(tx * T + 4, y - 6, 8, 12); x.fillStyle = '#8a7aa8'; x.fillRect(tx * T + 2, y - 8, 12, 3);
    x.fillStyle = '#f2a3b4'; x.fillRect(tx * T, y + 6, 20, 12);
    for (let i = 0; i < 3; i++) { x.fillStyle = '#6c5a78'; x.fillRect(tx * T + 4 + i * 14, y + 16, 7, 6); }
    for (let k = 0; k < 3; k++) {
      const cx = tx * T - 64 * (k + 1) - 6; x.fillStyle = cars[k + 1][0]; x.fillRect(cx, y - 4, 58, 22); x.fillStyle = cars[k + 1][1]; x.fillRect(cx, y - 4, 58, 4);
      for (let w = 0; w < 4; w++) { x.fillStyle = '#fffaf0'; x.fillRect(cx + 5 + w * 13, y + 2, 9, 7); x.fillStyle = '#bfe6f6'; x.fillRect(cx + 6 + w * 13, y + 3, 7, 5); }
      x.fillStyle = '#6c5a78'; x.fillRect(cx + 6, y + 16, 8, 6); x.fillRect(cx + 42, y + 16, 8, 6);
    }
    if (smoke) for (let i = 0; i < 5; i++) { const k = (t * 2 + i * .3) % 1.5; x.fillStyle = 'rgba(255,255,255,' + (0.8 - k / 1.8) + ')'; const rr = 3 + k * 5; x.beginPath(); x.arc(tx * T + 8 - k * 14 - i * 4, y - 10 - k * 24, rr, 0, 7); x.fill(); }
  }

  /* ------------------------------------------------------------------------------------------------------------ things */
  drawProp(x, q, sp, px, py, now, g) {
    if (q.k === 'tree') { const sway = Math.sin(now * 1.3 + q.x * .7 + q.y) * 0.6; x.drawImage(sp, px, py); if (sway) { /* the leaves take the breeze via a faint highlight */ x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(px + 8 + sway * 2, py + 6, 4, 2); } return; }
    if (q.k === 'house' && q.style === 'hall') { x.drawImage(sp, px, py); this.faceClock(x, px + 3 * T + 24, py + 18, 10, 7 * 3600 + 56 * 60 + 180 + g.t); return; }
    if (q.k === 'house' && q.style === 'chapel') { x.drawImage(sp, px, py); return; }
    if (q.k === 'house' && q.style === 'clock') { x.drawImage(sp, px, py); this.faceClock(x, px + 3 * T + 8, py + 20, 10, 7 * 3600 + 41 * 60 + g.t * 3.7); return; }
    if (q.k === 'house') { x.drawImage(sp, px, py); return; }
    if (q.k === 'fireplace') { x.drawImage(sp, px, py); for (let i = 0; i < 5; i++) { const k = (now * 3 + i * .7) % 1; x.fillStyle = i % 2 ? '#ffb067' : '#ffd58a'; x.fillRect(px + 14 + i * 5, py + 28 - Math.sin(k * 3) * 6, 3, 4 + (i % 2) * 2); } return; }
    if (q.k === 'oven') { x.drawImage(sp, px, py); const a = 0.5 + Math.sin(now * 4) * .2; x.fillStyle = 'rgba(255,213,138,' + a + ')'; x.fillRect(px + 10, py + 17, 12, 4); return; }
    if (q.k === 'clockwall') { x.drawImage(sp, px, py); for (const [a, b, s] of [[3, 3, 12], [18, 6, 9], [20, 18, 8], [4, 19, 8]]) this.faceClock(x, px + a + s / 2, py + b + s / 2, s / 2 - 1, 3600 * (2 + a % 5) + now * (30 + (a % 3) * 14) + a * 190, true); return; }
    if (q.k === 'grand') { x.drawImage(sp, px, py); x.fillStyle = '#f2cf7a'; const sw = Math.sin(now * 3.1) * 3; x.fillRect(px + 7 + sw, py + 33, 3, 5); return; }
    x.drawImage(sp, px, py);
  }
  faceClock(x, cx, cy, r, secs, quiet) {
    const m = (secs / 60) % 60, h = ((secs / 3600) % 12), a = v => v * Math.PI * 2 - Math.PI / 2;
    x.fillStyle = '#fffaf0'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    x.strokeStyle = '#a58f7a'; x.lineWidth = 1; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
    x.strokeStyle = '#6c5a78'; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a(m / 60)) * (r - 2), cy + Math.sin(a(m / 60)) * (r - 2)); x.stroke();
    x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a(h / 12)) * (r * .55), cy + Math.sin(a(h / 12)) * (r * .55)); x.stroke();
  }
  sheetProps(a) { return a.props.filter(p => p.k === 'sheet'); }
  drawSheet(x, p, now) {
    const sp = propSprite(p); if (!sp) return; const px = p.x * T, py = (p.y + 1) * T - sp.height;
    for (let row = 0; row < sp.height; row += 2) { const off = Math.round(Math.sin(now * 1.8 + p.x * .8 + row * .35) * (row / sp.height) * 2.2); x.drawImage(sp, 0, row, T, 2, px + off, py + row, T, 2); }
  }
  drawBunting(x, now) {
    const lines = [[33 * T + 8, 20 * T + 2, 37 * T + 8, 20 * T + 2], [12 * T + 8, 17 * T + 2, 27 * T + 8, 17 * T + 2], [27 * T + 8, 17 * T + 2, 38 * T + 8, 17 * T + 2], [12 * T + 8, 30 * T + 2, 38 * T + 8, 30 * T + 2]];
    const cols = ['#f4a8b8', '#ffe08a', '#a8d8f4', '#b8e6b0', '#d6c8f4'];
    for (const [x0, y0, x1, y1] of lines) { const n = Math.max(3, Math.round((x1 - x0) / 10)); for (let i = 0; i <= n; i++) { const u = i / n, px = x0 + (x1 - x0) * u, py = y0 + Math.sin(u * Math.PI) * 5 + Math.sin(now * 2.2 + i) * 0.7; x.fillStyle = cols[i % 5]; x.fillRect(px - 2, py, 5, 1); x.fillRect(px - 1, py + 1, 3, 1); x.fillRect(px, py + 2, 1, 1); } }
  }
  drawBirds(x, g, now, dt) {
    for (const b of this.birds) {
      if (g.t >= 205 && !b.fly) { b.fly = 0.001; }
      if (g.t < 5) { b.fly = 0; }
      if (b.fly) { b.fly += dt; b.x += b.vx * dt * 14; b.y -= dt * 7 * (1 + b.vx * 0.2); }
      else { b.x += 0; }
      const hop = !b.fly && Math.sin(now * 2 + b.ph) > .94 ? 1 : 0, px = b.x * T, py = b.y * T - hop;
      if (b.y < -4) continue;
      x.fillStyle = '#9a8fb8'; x.fillRect(px, py, 5, 3); x.fillRect(px + 4, py - 1, 3, 2); x.fillStyle = '#f2a56a'; x.fillRect(px + 7, py - 1, 1, 1);
      if (b.fly) { const f = Math.sin(now * 25 + b.ph) > 0; x.fillStyle = '#b5aad0'; x.fillRect(px + 1, py - (f ? 3 : -1), 3, 2); }
    }
  }
  drawButterflies(x, now) {
    for (let i = 0; i < 6; i++) { const cx = [13, 33, 45, 20, 6, 51][i] * T, cy = [28, 26, 17, 17, 22, 12][i] * T, bx = cx + Math.sin(now * .6 + i * 2) * 28, by = cy + Math.sin(now * .9 + i) * 14 - 4, w = Math.sin(now * 14 + i) > 0 ? 3 : 1; x.fillStyle = ['#ffb7c9', '#fff0a8', '#b8d8ff', '#d6ccff', '#ffcfa0', '#ffb7c9'][i]; x.fillRect(bx - w, by, w, 2); x.fillRect(bx + 1, by, w, 2); x.fillStyle = '#6c5a78'; x.fillRect(bx, by, 1, 2); }
  }
  drawSmoke(x, now) {
    for (const [cx, cy] of [[6 * T + 24, 24 * T + 2], [28 * T + 90, 26 * T + 2], [15 * T + 92, 6 * T + 4]]) { x.fillStyle = '#c98d7f'; x.fillRect(cx - 3, cy + 3, 8, 10); x.fillStyle = '#e0a898'; x.fillRect(cx - 3, cy + 3, 3, 10); x.fillStyle = '#8a6a5a'; x.fillRect(cx - 4, cy + 1, 10, 3); for (let i = 0; i < 5; i++) { const k = ((now * .35 + i * .2 + cx * .01) % 1), r = 2 + k * 4; x.fillStyle = 'rgba(255,255,255,' + (0.7 - k * .7) + ')'; x.beginPath(); x.arc(cx + 1 + Math.sin(k * 5 + i) * 4 + k * 8, cy - k * 26, r, 0, 7); x.fill(); } }
  }
  drawChapel(x, g, now) {
    // the clock on the tower, two minutes slow, and the bell in its opening
    const cx = 44 * T + 80 + 16, cy = 2 * T + 32;
    this.faceClock(x, cx, cy, 9, 7 * 3600 + 56 * 60 - 120 + g.t);
    let ang = Math.sin(now * 1.3) * 0.04; for (const f of this.fx) if (f.k === 'bell') ang += Math.sin(f.t * 9) * Math.max(0, 1 - f.t / 2.5) * 0.7;
    if (g.F('decree') || g.t > BREAK - 15) ang += Math.sin(now * 8) * 0.35;
    x.save(); x.translate(cx, 5 * T + 6); x.rotate(ang); x.fillStyle = '#f2cf7a'; x.fillRect(-5, 0, 10, 8); x.fillStyle = '#fbe6a0'; x.fillRect(-4, 0, 3, 7); x.fillStyle = '#d8b050'; x.fillRect(-6, 7, 12, 2); x.fillRect(-1, 9, 2, 2); x.restore();
  }
  drawSirenHorn(x, g, now) {
    // a pole-top siren: a drum with a flared horn out of each side, and a little red lamp
    const px = 36 * T + 56 + 4, py = 24 * T + 2, on = g.F('siren_on') && g.since('siren_on') < 40, j = on ? Math.round(Math.sin(now * 60) * 0.8) : 0;
    x.fillStyle = '#9a8e84'; x.fillRect(px - 8, py + 2, 16, 3);                       // the platform on the tower
    x.fillStyle = '#c4c9d8'; x.fillRect(px - 4 + j, py - 8, 8, 10); x.fillStyle = '#e1e5f0'; x.fillRect(px - 4 + j, py - 8, 8, 2); x.fillStyle = '#a7adbe'; x.fillRect(px + 2 + j, py - 8, 2, 10);
    for (let i = 0; i < 8; i++) { const hgt = 3 + i * 2, tone = i % 3 === 0 ? '#e1e5f0' : '#c4c9d8'; x.fillStyle = tone; x.fillRect(px - 5 - i + j, py - 3 - (hgt >> 1), 1, hgt); x.fillRect(px + 4 + i + j, py - 3 - (hgt >> 1), 1, hgt); }
    x.fillStyle = on ? '#ff6a6a' : '#e8a8a8'; x.fillRect(px - 1 + j, py - 11, 3, 3);
    if (on) for (let i = 0; i < 4; i++) { const k = ((now * 1.4 + i * .25) % 1); x.strokeStyle = 'rgba(255,170,120,' + (0.9 - k) + ')'; x.lineWidth = 2; x.beginPath(); x.arc(px - 14, py - 3, 6 + k * 70, Math.PI - 1.0, Math.PI + 1.0); x.stroke(); x.beginPath(); x.arc(px + 14, py - 3, 6 + k * 70, -0.9, 0.9); x.stroke(); }
  }
  drawMillWheel(x, now, g) {
    const cx = 22 * T + 8, cy = 9 * T + 8, ang = now * 0.9;
    x.save(); x.translate(cx, cy); x.rotate(ang); x.fillStyle = '#c9a070'; for (let i = 0; i < 8; i++) { x.save(); x.rotate(i * Math.PI / 4); x.fillRect(-1, -19, 2, 19); x.fillStyle = '#e2bc8c'; x.fillRect(-4, -23, 8, 5); x.fillStyle = '#c9a070'; x.restore(); }
    x.strokeStyle = '#c9a070'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 19, 0, 7); x.stroke(); x.fillStyle = '#a97d58'; x.fillRect(-3, -3, 6, 6); x.restore();
  }
  drawDuck(x, now, g) {
    for (const [i, base] of [[0, 25], [1, 11], [2, 36]]) { const t = now * (.6 + i * .15) + i * 5, yp = 7 * T + ((base * 11 + t * 6) % (32 * T)), xx = 24 * T + Math.sin(t * .9 + i) * 11; if (g.t >= BREAK) continue; const sp = propSprite({ k: 'duck', w: 1, h: 1, seed: i }); x.drawImage(sp, xx, yp); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(xx + 2, yp + 11, 9, 1); }
  }
  drawDamLife(x, g, now) {
    // a fine thread of water through the crack, and dust shaken down as the dam begins to groan
    const t = g.t;
    if (t > 150 && t < BREAK) for (let i = 0; i < 3; i++) { const k = (now * 1.5 + i * .33) % 1; x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(29 * T + 7 + (i - 1) * 2, 4 * T + k * 22, 1, 2); }
    if (t >= 195 && t < BREAK) for (let i = 0; i < 14; i++) { const k = (now * (.8 + (i % 4) * .2) + i * .13) % 1; x.fillStyle = 'rgba(214,200,180,' + (.8 - k * .8) + ')'; x.fillRect(14 * T + hash(i, 3, 1) * 26 * T, 3 * T + k * 30, 2, 2); }
    // the spillway foams through its three gates, always
    for (let i = 0; i < 6; i++) { const k = (now * 1.2 + i * .17) % 1; x.fillStyle = 'rgba(255,255,255,' + (.8 - k * .6) + ')'; x.fillRect(23 * T + 3 + (i * 7) % 42, 5 * T + k * 14, 3, 1); }
  }

  /* ------------------------------------------------------------------------------------------------------------ people */
  drawPerson(x, n, g, now) {
    const cat = n.def.cat, sh = this.sheets[cat ? 'cat' : n.id];
    const moving = n.moving || n.act === 'walk';
    const f = moving ? 1 + (Math.floor(now * 8) & 1) : 0;
    let dir = n.dir; if (n.act === 'sleep' || n.act === 'fish' || n.act === 'speak' || n.act === 'cat' || n.act === 'bake') dir = n.moving ? n.dir : n.dir;
    const sp = sh[dir + f]; const px = Math.round(n.rx * T - 2), py = Math.round(n.ry * T + T - 19);
    let by = 0;
    if (n.act === 'bake' || n.act === 'tinker') by = Math.round(Math.sin(now * 9) * 0.5);
    if (n.act === 'sleep') by = 0;
    if (n.act === 'speak') by = Math.sin(now * 5) > .6 ? -1 : 0;
    if (n.act === 'drill') by = Math.sin(now * 12) > 0 ? -1 : 0;
    // while time catches up, anyone on the move leaves a soft trail behind them, and stays plainly visible on top of it
    if (this.lapse && n.trail && n.trail.length > 1) {
      const k = n.trail.length;
      for (let i = 0; i < k - 1; i++) { const s = n.trail[i]; if (s.m !== n.map || Math.hypot(s.x - n.rx, s.y - n.ry) < 0.06) continue; x.globalAlpha = 0.06 + 0.3 * (i / k); x.drawImage(sp, Math.round(s.x * T - 2), Math.round(s.y * T + T - 19) - OY); }
      x.globalAlpha = 1;
    }
    x.drawImage(sp, px, py + by - OY + (cat && n.act === 'cat' && !moving ? 1 : 0));
    this.drawAct(x, n, px, py, now, g);
  }
  drawAct(x, n, px, py, now, g) {
    if (n.moving || n.path.length) return;
    const a = n.act;
    if (a === 'sleep') { for (let i = 0; i < 3; i++) { const k = (now * .6 + i / 3) % 1; letters(x, 'z', px + 14 + k * 6, py - 4 - k * 14 - i * 2, 'rgba(120,110,170,' + (1 - k) + ')'.replace('rgba', 'rgba')); } x.fillStyle = 'rgba(0,0,0,0)'; }
    else if (a === 'fish') { const bx = px + 18, by = py + 14; x.strokeStyle = '#fff'; x.lineWidth = 1; x.beginPath(); x.moveTo(px + 14, py + 12); x.lineTo(px + 20, py - 2 + Math.sin(now * 2) * 1); x.lineTo(px + 26, py + 22 + Math.sin(now * 2.5) * 1); x.stroke(); x.fillStyle = '#9ad0c0'; x.fillRect(px + 24, py + 22 + Math.sin(now * 2.5), 5, 4); x.fillStyle = '#fff'; x.fillRect(px + 25, py + 21 + Math.sin(now * 2.5), 3, 1); const k = (now * .7) % 1; x.strokeStyle = 'rgba(255,255,255,' + (.8 - k) + ')'; x.beginPath(); x.ellipse(px + 27, py + 27, 2 + k * 7, 1 + k * 3, 0, 0, 7); x.stroke(); }
    else if (a === 'bake' || a === 'sing') { for (let i = 0; i < 2; i++) { const k = (now * .5 + i / 2) % 1; this.note(x, px + 4 + k * 12 * (i ? -1 : 1) + 6, py - 4 - k * 14, 1 - k); } }
    else if (a === 'shout') { const k = Math.sin(now * 6) > .3; if (k) { x.fillStyle = '#f4a0a8'; x.fillRect(px + 15, py + 1, 1, 4); x.fillRect(px + 15, py + 6, 1, 1); } }
    else if (a === 'drill') { if (Math.sin(now * 3) > .4) { letters(x, 'fire', px - 3, py - 8, '#e0606a'); } }
    else if (a === 'tinker') { if (Math.sin(now * 9) > .7) { x.fillStyle = '#ffe58a'; x.fillRect(px + 14 + (now * 7 % 4), py + 12, 1, 1); x.fillRect(px + 2, py + 10, 1, 1); } }
    else if (a === 'speak') { if (Math.sin(now * 3.2) > 0) { x.fillStyle = '#fff'; x.fillRect(px + 14, py + 3, 1, 1); x.fillRect(px + 16, py + 1, 1, 1); x.fillRect(px + 17, py + 3, 1, 1); } }
    else if (a === 'ring') { const sw = Math.sin(now * 3); x.fillStyle = '#e8d6b0'; x.fillRect(px + (n.dir === 'left' ? 4 : 10), py - 8, 2, 14 + sw * 2); }
    // the groan has started and they're still down in the valley: a start, a look north
    if (g.t >= 205 && n.map === 'town' && !g.safeAt(n)) { if (Math.sin(now * 7 + n.x) > -.5) letters(x, '!', px + 7, py - 7, '#e0606a'); }
    // when somebody has heard the siren and doesn't know what to do, they look up
    if (g.F('siren_on') && !g.F('decree') && n.act !== 'walk' && !n.def.cat && n.id !== 'gideon' && n.id !== 'orla' && n.id !== 'wim' && n.id !== 'barnaby' && g.since('siren_on') > 1 && n.map === 'town') { if (Math.sin(now * 4 + n.x) > -.2) letters(x, '?', px + 6, py - 7, '#e0606a'); }
  }
  note(x, px, py, a) { x.fillStyle = 'rgba(190,110,160,' + a + ')'; x.fillRect(px, py + 3, 3, 2); x.fillRect(px + 2, py, 1, 4); x.fillRect(px + 3, py, 2, 1); }
  drawYou(x, g, now) {
    const p = g.player, sh = this.sheets.you;
    if (g.wake > 0) {   // waking on the bench: sitting, a slow blink, then up
      const px = Math.round(p.rx * T - 2), py = Math.round(p.ry * T + T - 19), f = 0;
      x.drawImage(sh['down0'], px, py - OY + 3 + (g.wake > .6 ? 1 : 0)); if (g.wake > 0.9) { letters(x, 'z', px + 13, py - 3, 'rgba(120,110,170,.8)'); }
      return;
    }
    const f = p.moving ? 1 + (Math.floor(now * 9) & 1) : 0;
    x.drawImage(sh[p.dir + f], Math.round(p.rx * T - 2), Math.round(p.ry * T + T - 19) - OY);
  }
  drawPrompt(x, g, now) {
    if (g.talk || g.ended || this.hidePrompt) return;
    const c = g.nearby()[0]; if (!c) return;
    const q = c.kind === 'npc' ? g.npcs.find(n => n.id === c.id) : null;
    const pos = q ? { x: q.rx * T + 8, y: q.ry * T - 12 } : (() => { const o = MAPS[g.player.map] && require_obj(c.id); return o ? { x: o.x * T + 8, y: o.y * T - 6 } : null; })();
    if (!pos) return;
    const bob = Math.round(Math.sin(now * 5) * 1.5);
    x.fillStyle = '#fff'; x.fillRect(pos.x - 5, pos.y - 8 + bob, 11, 9); x.fillRect(pos.x - 1, pos.y + 1 + bob, 3, 2); x.fillStyle = '#7a6ac0'; x.fillRect(pos.x - 5, pos.y - 9 + bob, 11, 1); x.fillRect(pos.x - 6, pos.y - 8 + bob, 1, 9); x.fillRect(pos.x + 6, pos.y - 8 + bob, 1, 9); x.fillRect(pos.x - 5, pos.y + bob, 11, 1);
    letters(x, 'a', pos.x - 1, pos.y - 6 + bob, '#7a6ac0');
  }

  /* ------------------------------------------------------------------------------------------------------------ effects */
  drawFx(x, g, now, dt) {
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < 6);
    for (const f of this.fx) {
      if (f.k === 'splash' && f.map === g.player.map) { for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, d = f.t * 24; x.fillStyle = 'rgba(255,255,255,' + Math.max(0, 1 - f.t * 1.1) + ')'; x.fillRect(f.x + Math.cos(a) * d, f.y - Math.abs(Math.sin(a)) * d - f.t * 4, 3, 3); } }
      if (f.k === 'burst' && f.t < .7) { x.fillStyle = 'rgba(255,255,255,' + (0.55 * (1 - f.t / .7)) + ')'; x.fillRect(this.cam.x, this.cam.y, this.w, this.h); }
      if (f.k === 'mark' && f.map === g.player.map) { const k = f.t / .7; if (k < 1) { x.strokeStyle = 'rgba(122,106,192,' + (1 - k) + ')'; x.lineWidth = 1.5; x.strokeRect(f.x * T + 2 - k * 3, f.y * T + 2 - k * 3, T - 4 + k * 6, T - 4 + k * 6); } }
      if (f.k === 'decree') { for (let i = 0; i < 12; i++) { const a = i / 12 * 7, d = f.t * 40; x.fillStyle = 'rgba(255,215,120,' + Math.max(0, 1 - f.t) + ')'; x.fillRect(35 * T + Math.cos(a) * d, 23 * T - 10 + Math.sin(a) * d * .6, 2, 2); } }
    }
  }
  drawFlood(x, g, area, now, gx0, gy0, gx1, gy1, cx, cy) {
    if (g.t < BREAK) return;
    const fr = g.frontRow(), t = g.t - BREAK;
    if (!area.interior) {
      // the burst at the dam, then the water: a wall of foam, and brown-blue water churning behind it
      if (t < 4) for (let i = 0; i < 24; i++) { const k = (t * 1.2 + i * .041) % 1; x.fillStyle = 'rgba(255,255,255,' + (1 - k) + ')'; x.fillRect(22 * T + hash(i, 5, 3) * 5 * T, 4 * T + k * 70 - hash(i, 4, 2) * 20, 5, 5); }
      const wx0 = gx0 * T, wx1 = (gx1 + 1) * T;
      for (let gy = gy0; gy <= gy1; gy++) {
        const top = gy * T, bot = Math.min(top + T, fr * T); if (bot <= top) break;
        for (let gx = gx0; gx <= gx1; gx++) {
          if (area.safe[gy * area.w + gx]) continue;
          const px = gx * T, depth = fr - gy, deep = Math.min(1, depth / 7);
          x.fillStyle = `rgba(${118 - deep * 22},${186 - deep * 20},${208 - deep * 14},.9)`; x.fillRect(px, top, T, bot - top);
          x.fillStyle = 'rgba(80,150,180,.55)'; for (let i = 0; i < 3; i++) x.fillRect(px + ((i * 6 + now * 30 + gy * 3) % 16), top + ((i * 5 + gx * 7) % 14), 6, 1);
          x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(px + ((gx * 5 + now * 44 + gy) % 14), top + ((gy * 3 + gx) % 12), 3, 1);
          if (hash(gx, gy, 6) < .06 && depth > 1.5) { x.fillStyle = '#c9a070'; x.fillRect(px + 3 + Math.sin(now + gx) * 4, top + 5, 9, 3); x.fillStyle = '#e8c9a0'; x.fillRect(px + 3 + Math.sin(now + gx) * 4, top + 5, 9, 1); }   // a bit of the town, going by
        }
      }
      // the wall itself: a jagged crest of foam with a shadow in front of it
      for (let sx = wx0; sx < wx1; sx += 4) {
        const gx = Math.floor(sx / T); const fy = fr * T + Math.sin(now * 5 + sx * .21) * 3 + Math.sin(now * 2 + sx * .06) * 4, gyy = Math.floor(fy / T);
        if (area.safe[Math.max(0, Math.min(area.h - 1, gyy)) * area.w + gx] || area.safe[Math.max(0, Math.min(area.h - 1, Math.floor(fr))) * area.w + gx]) continue;
        x.fillStyle = 'rgba(40,60,110,.22)'; x.fillRect(sx, fy + 2, 4, 9);
        x.fillStyle = '#9fd8ea'; x.fillRect(sx, fy - 18, 4, 20); x.fillStyle = '#7dbfd6'; x.fillRect(sx, fy - 6, 4, 8);
        x.fillStyle = '#fff'; const h = 5 + (Math.sin(now * 9 + sx * .5) + 1) * 3; x.fillRect(sx, fy - 18 - h * .3, 4, h); x.fillStyle = '#e8f6fb'; x.fillRect(sx, fy - 12, 4, 4);
        if (((sx >> 2) + Math.floor(now * 9)) % 5 === 0) { x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(sx + 1, fy - 26 - ((now * 40 + sx) % 8), 2, 2); }
      }
    } else {
      const arrive = (g.t - BREAK) - (Math.max(0, (this.doorRow(area.id) - FRONT_ROW0)) * FRONT_RATE);
      if (!area.safeAll && arrive > -0.5) { const h = clamp((arrive + .5) / 3.5, 0, 1) * area.h * T; x.fillStyle = 'rgba(128,196,216,.88)'; x.fillRect(0, area.h * T - h, area.w * T, h); x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(0, area.h * T - h - 1, area.w * T, 3); }
    }
  }
  doorRow(id) { for (const [k, d] of MAPS.town.doors) if (d.to === id) return +k.split(',')[1]; return 0; }
}
function require_obj(id) { return OBJECTS_BY_ID[id]; }
import { OBJECTS } from './world.js';
const OBJECTS_BY_ID = Object.fromEntries(OBJECTS.map(o => [o.id, o]));
