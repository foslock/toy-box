// Draws a floor: the museum at night baked once per size, then plates, doors, lasers, cameras, the jewel and the key,
// the guards with their torches, and every copy of you, each in its own tint with its run number over its head.
import { T, BW, BH, GW, GH, SEE, HZ, RUN_TICKS, MAX_RUNS, WALL, LADDER } from './sim.js';

export const TINTS = ['#ffc94d', '#ff7a6b', '#c792ff', '#5fc8ff', '#5be0a6', '#ffa04d', '#ff8fc4', '#a6e05a', '#8fa6ff', '#efe6d2'];
export const PLATE = { a: '#ffc94d', b: '#5fc8ff', c: '#c792ff', d: '#5be0a6', e: '#ff8a5c', f: '#ff8fc4' };
const INK = '#04060d', ROOM = '#13204a', ROOM2 = '#0f1a3d', RIM = '#4a6fc0';

const mix = (a, b, k) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const hash = (a, b = 0) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export class View {
  constructor(canvas) { this.cv = canvas; this.x = canvas.getContext('2d'); this.fx = []; this.bake = null; this.L = null; this.dpr = 1; this.S = 2; this.ox = 0; this.oy = 0; this.anim = new Map(); }
  setLevel(L) { this.L = L; this.bake = null; this.fx.length = 0; this.anim.clear(); this.doorVis = L.doors.map(() => 0); }
  // fit the floor inside the rectangle r (css pixels) of a canvas cw x ch
  layout(cw, ch, dpr, r) {
    this.cw = cw; this.ch = ch; this.dpr = dpr;
    const w = Math.round(cw * dpr), h = Math.round(ch * dpr);
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    const L = this.L, lw = L.W * T, lh = L.H * T;
    // a tall screen shows the floor bigger than its width, and follows you along it (see follow)
    this.S = Math.max(0.3, Math.min(r.w * (r.zoom || 1) / lw, r.h / lh, 4));
    this.r = r; this.ox = r.x + (r.w - lw * this.S) / 2; this.oy = r.y + (r.h - lh * this.S) / 2;
    this.bake = null;
  }
  follow(x, snap) {
    const r = this.r, w = this.L.W * T * this.S; if (!r || w <= r.w + 1) return;
    const want = r.x - Math.max(0, Math.min(w - r.w, x * this.S - r.w / 2));
    this.ox = snap ? want : this.ox + (want - this.ox) * 0.12;
  }
  toLevel(px, py) { return { x: (px - this.ox) / this.S, y: (py - this.oy) / this.S }; }

  /* ------------------------------------------------------------------------------------------------ the museum, baked */
  bakeStatic() {
    const L = this.L, S = this.S * this.dpr, lw = L.W * T, lh = L.H * T;
    const c = document.createElement('canvas'); c.width = Math.ceil(lw * S); c.height = Math.ceil(lh * S);
    const x = c.getContext('2d'); x.scale(S, S);
    const tile = (tx, ty) => (tx < 0 || ty < 0 || tx >= L.W || ty >= L.H) ? WALL : L.grid[ty * L.W + tx];
    // rooms: deep blue, darker below the dado rail
    const g = x.createLinearGradient(0, 0, 0, lh); g.addColorStop(0, '#16245a'); g.addColorStop(1, '#0f1a40'); x.fillStyle = g; x.fillRect(0, 0, lw, lh);
    // find each room's band of rows (between slabs) to place the rail, windows and paintings
    for (let ty = 0; ty < L.H; ty++) for (let tx = 0; tx < L.W; tx++) {
      if (tile(tx, ty) === WALL) continue;
      if (tile(tx, ty + 1) === WALL || tile(tx, ty + 1) === LADDER && tile(tx, ty + 2) !== LADDER && tile(tx, ty) !== LADDER) { x.fillStyle = ROOM2; x.fillRect(tx * T, ty * T + 7, T, 9); x.fillStyle = '#1d2c60'; x.fillRect(tx * T, ty * T + 6, T, 1); }
    }
    // windows and paintings along each room's upper wall
    const used = new Set();
    for (let ty = 1; ty < L.H; ty++) for (let tx = 1; tx < L.W - 1; tx++) {
      if (tile(tx, ty - 1) !== WALL || tile(tx, ty) === WALL) continue;
      const k = ty * 1000 + tx; if (used.has(k)) continue;
      // a room's ceiling row: is there a 3-tile tall clear space here?
      const clear = (ax, n) => { for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) if (tile(ax + i, ty + j) !== 0 || L.doorAt[(ty + j) * L.W + ax + i] >= 0 || isThing(L, ax + i, ty + j)) return false; return true; };
      const r = hash(tx, ty);
      if (tx % 7 === 3 && clear(tx, 2)) {
        for (let i = -1; i < 3; i++) used.add(ty * 1000 + tx + i);
        // a tall moonlit window and its shaft of light
        const wx = tx * T + 4, wy = ty * T + 3, ww = 24, wh = 22;
        x.fillStyle = 'rgba(140, 180, 255, .05)'; x.beginPath(); x.moveTo(wx, wy + wh); x.lineTo(wx + ww, wy + wh); x.lineTo(wx + ww + 26, wy + wh + 30); x.lineTo(wx + 22, wy + wh + 30); x.closePath(); x.fill();
        const wg = x.createLinearGradient(wx, wy, wx + ww, wy + wh); wg.addColorStop(0, '#3d63b0'); wg.addColorStop(1, '#22407e'); x.fillStyle = wg;
        x.beginPath(); x.moveTo(wx, wy + wh); x.lineTo(wx, wy + 7); x.arc(wx + ww / 2, wy + 7, ww / 2, Math.PI, 0); x.lineTo(wx + ww, wy + wh); x.closePath(); x.fill();
        x.strokeStyle = '#0a1230'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(wx + ww / 2, wy - 5); x.lineTo(wx + ww / 2, wy + wh); x.moveTo(wx, wy + 12); x.lineTo(wx + ww, wy + 12); x.stroke();
        x.strokeStyle = '#0a1230'; x.lineWidth = 2; x.beginPath(); x.moveTo(wx, wy + wh); x.lineTo(wx, wy + 7); x.arc(wx + ww / 2, wy + 7, ww / 2, Math.PI, 0); x.lineTo(wx + ww, wy + wh); x.stroke();
        x.fillStyle = 'rgba(220,235,255,.8)'; x.beginPath(); x.arc(wx + ww - 7, wy + 4, 2.2, 0, 7); x.fill();
      } else if (r < 0.55 && tx % 7 !== 2 && clear(tx, 1) && !used.has(k)) {
        used.add(k);
        // a painting in a dark frame
        const pw = r < 0.25 ? 10 : 12, ph = r < 0.25 ? 12 : 9, px = tx * T + (T - pw) / 2, py = ty * T + 6;
        x.fillStyle = '#2b3150'; x.fillRect(px - 1.5, py - 1.5, pw + 3, ph + 3); x.fillStyle = '#0b1230'; x.fillRect(px, py, pw, ph);
        x.fillStyle = '#25356b';
        if (r < 0.25) { x.beginPath(); x.ellipse(px + pw / 2, py + ph / 2 - 1, 2.6, 3.2, 0, 0, 7); x.fill(); x.fillRect(px + pw / 2 - 3.5, py + ph - 3, 7, 3); }
        else { x.beginPath(); x.moveTo(px, py + ph); x.lineTo(px + pw * .35, py + ph * .4); x.lineTo(px + pw * .6, py + ph * .7); x.lineTo(px + pw * .8, py + ph * .3); x.lineTo(px + pw, py + ph); x.fill(); }
        x.fillStyle = 'rgba(160,190,255,.12)'; x.fillRect(px + pw / 2 - 4, py + ph + 4, 8, 1);
      }
    }
    // solid walls and slabs, with moonlit edges where they meet the rooms
    for (let ty = 0; ty < L.H; ty++) for (let tx = 0; tx < L.W; tx++) {
      if (tile(tx, ty) !== WALL) continue;
      x.fillStyle = INK; x.fillRect(tx * T, ty * T, T, T);
    }
    for (let ty = 0; ty < L.H; ty++) for (let tx = 0; tx < L.W; tx++) {
      if (tile(tx, ty) !== WALL) continue;
      const open = (a, b) => a >= 0 && b >= 0 && a < L.W && b < L.H && tile(a, b) !== WALL;
      if (open(tx, ty - 1)) { x.fillStyle = RIM; x.fillRect(tx * T, ty * T, T, 1); x.fillStyle = 'rgba(74,111,192,.25)'; x.fillRect(tx * T, ty * T + 1, T, 1.5); }
      if (open(tx, ty + 1)) { x.fillStyle = '#18234a'; x.fillRect(tx * T, ty * T + T - 1, T, 1); }
      if (open(tx - 1, ty)) { x.fillStyle = '#1a2756'; x.fillRect(tx * T, ty * T, 1, T); }
      if (open(tx + 1, ty)) { x.fillStyle = '#1a2756'; x.fillRect(tx * T + T - 1, ty * T, 1, T); }
    }
    // ladders
    for (let ty = 0; ty < L.H; ty++) for (let tx = 0; tx < L.W; tx++) {
      if (tile(tx, ty) !== LADDER) continue;
      const lx = tx * T, ly = ty * T, top = tile(tx, ty - 1) !== LADDER;
      if (top) { x.fillStyle = INK; x.fillRect(lx, ly, T, T); x.fillStyle = '#0d1430'; x.fillRect(lx + 2, ly, T - 4, T); }
      x.fillStyle = '#41598f'; x.fillRect(lx + 3, ly - (top ? 6 : 0), 1.5, T + (top ? 6 : 0)); x.fillRect(lx + T - 4.5, ly - (top ? 6 : 0), 1.5, T + (top ? 6 : 0));
      x.fillStyle = '#33497c'; for (let k = 2; k < T; k += 4) x.fillRect(lx + 3, ly + k, T - 6, 1.2);
      if (top) { x.fillStyle = RIM; x.fillRect(lx, ly, 2, 1); x.fillRect(lx + T - 2, ly, 2, 1); }
    }
    // the loading dock: a roll-up door, a hazard strip, a green lamp
    if (L.exit.length) {
      const xs = L.exit.map(e => e.x), ys = L.exit.map(e => e.y), ex = Math.min(...xs) * T, ey = Math.min(...ys) * T, eh = (Math.max(...ys) + 1) * T - ey;
      const dg = x.createLinearGradient(ex, 0, ex + T, 0); dg.addColorStop(0, '#0b1124'); dg.addColorStop(1, '#1c2a4f'); x.fillStyle = dg; x.fillRect(ex, ey, T, eh);
      x.fillStyle = 'rgba(160,190,255,.10)'; for (let k = ey + 2; k < ey + 10; k += 2) x.fillRect(ex, k, T, 1);
      for (let k = 0; k < T; k += 4) { x.fillStyle = k % 8 ? '#0b0b0b' : '#e8b93a'; x.fillRect(ex + k, ey + eh - 2, 4, 2); }
      x.fillStyle = '#58f0a0'; x.beginPath(); x.arc(ex + 4, ey - 3, 1.6, 0, 7); x.fill();
      x.save(); x.font = '600 6.5px Oswald, sans-serif'; x.textAlign = 'right'; x.fillStyle = '#58f0a0'; x.fillText('DOCK', ex + T - 1, ey - 6); x.restore();
      x.fillStyle = 'rgba(88,240,160,.10)'; x.fillRect(ex - 6, ey, 6, eh);
    }
    // jewel pedestals and their glass cases
    for (const it of L.items) if (it.id === 'jewel') {
      x.fillStyle = '#2b3866'; x.fillRect(it.x - 4, it.y - 8, 8, 8); x.fillStyle = '#3c4f8a'; x.fillRect(it.x - 5, it.y - 9, 10, 2); x.fillStyle = '#1b2650'; x.fillRect(it.x - 5, it.y - 1, 10, 1);
      x.strokeStyle = 'rgba(180,210,255,.35)'; x.lineWidth = .7; x.strokeRect(it.x - 5, it.y - 20, 10, 11);
      x.fillStyle = 'rgba(180,210,255,.06)'; x.fillRect(it.x - 5, it.y - 20, 10, 11);
    }
    this.bake = c; this.bakeS = S;
  }

  /* ------------------------------------------------------------------------------------------------ a frame */
  // a is how far between this tick and the next we are (0..1), for smooth motion at any refresh rate
  draw(g, now, opts = {}) {
    const x = this.x, L = this.L, dpr = this.dpr;
    if (!this.bake) this.bakeStatic();
    x.setTransform(1, 0, 0, 1, 0, 0);
    this.night(now);
    x.setTransform(this.S * dpr, 0, 0, this.S * dpr, this.ox * dpr, this.oy * dpr);
    x.imageSmoothingEnabled = true;
    x.drawImage(this.bake, 0, 0, L.W * T, L.H * T);
    if (opts.rewind != null) { this.drawRewind(g, opts.rewind, now); this.frameFx(); return; }
    const t = g.t;
    // plates
    L.plates.forEach((p, k) => {
      const on = g.plateOn[k], col = PLATE[p.letter], px = p.x * T + 2, py = (p.y + 1) * T;
      x.fillStyle = INK; x.fillRect(px - 1, py - 3.5, 14, 3.5);
      x.fillStyle = on ? col : mix(col, '#0a0f22', .55); x.fillRect(px, py - (on ? 1.6 : 3), 12, on ? 1.6 : 3);
      if (on) { x.fillStyle = col + '40'; x.fillRect(px - 2, py - 6, 16, 5); }
    });
    // doors (they slide up into the ceiling)
    L.doors.forEach((d, k) => {
      this.doorVis[k] += ((d.open ? 1 : 0) - this.doorVis[k]) * Math.min(1, opts.dt ? opts.dt * 18 : 1);
      const v = this.doorVis[k], dx = d.x * T, dy = d.y0 * T, dh = (d.y1 + 1 - d.y0) * T, col = d.lock ? '#e8c35a' : PLATE[d.letter];
      x.fillStyle = INK; x.fillRect(dx + 2, dy, 12, 2);
      const h = dh * (1 - v);
      if (h > 0.5) {
        x.fillStyle = '#1d2a55'; x.fillRect(dx + 3, dy, 10, h);
        x.fillStyle = '#2a3b72'; for (let k2 = 3; k2 < h - 1; k2 += 6) x.fillRect(dx + 4, dy + k2, 8, 1);
        x.fillStyle = col; x.fillRect(dx + 3, dy + h - 2, 10, 2); x.fillRect(dx + 3, dy, 1, h); x.fillRect(dx + 12, dy, 1, h);
        if (d.lock && h > 12) { const cy = dy + h / 2; x.fillStyle = col; x.fillRect(dx + 5, cy - 1, 6, 5); x.strokeStyle = col; x.lineWidth = 1.2; x.beginPath(); x.arc(dx + 8, cy - 1, 2, Math.PI, 0); x.stroke(); x.fillStyle = INK; x.fillRect(dx + 7.5, cy + 0.5, 1, 2); }
        else if (!d.lock && h > 10) { x.fillStyle = col; x.font = '700 7px Oswald, sans-serif'; x.textAlign = 'center'; x.fillText(d.letter.toUpperCase(), dx + 8, dy + h / 2 + 3); }
      }
      x.fillStyle = d.open ? '#58f0a0' : '#ff4d5e'; x.beginPath(); x.arc(dx + 8, dy - 2.5, 1.3, 0, 7); x.fill();
    });
    // lasers
    for (const l of L.lasers) {
      const bx = l.x * T + T / 2, y0 = l.y0 * T, y1 = (l.y1 + 1) * T, on = g.laserOn(l);
      x.fillStyle = '#20263a'; x.fillRect(bx - 3, y0, 6, 3); x.fillRect(bx - 3, y1 - 3, 6, 3);
      let warn = false; if (!on && l.cycle) { const [a, b, ph = 0] = l.cycle, p = (t + ph) % (a + b); warn = p > a + b - 0.45; }
      if (on || (g.ended?.what === 'laser' && g.ended.laser === l)) {
        const fl = 0.85 + 0.15 * Math.sin(now * 40 + l.x);
        x.fillStyle = `rgba(255,40,60,${0.16 * fl})`; x.fillRect(bx - 2.5, y0 + 3, 5, y1 - y0 - 6);
        x.fillStyle = `rgba(255,70,80,${0.55 * fl})`; x.fillRect(bx - 1, y0 + 3, 2, y1 - y0 - 6);
        x.fillStyle = '#ffd8dc'; x.fillRect(bx - 0.35, y0 + 3, 0.7, y1 - y0 - 6);
      } else {
        x.fillStyle = warn && Math.sin(now * 50) > 0 ? 'rgba(255,70,80,.5)' : 'rgba(255,70,80,.18)';
        for (let yy = y0 + 4; yy < y1 - 4; yy += 4) x.fillRect(bx - 0.4, yy, 0.8, 2);
      }
      x.fillStyle = on ? '#ff4d5e' : '#552030'; x.fillRect(bx - 1, y0 + 1, 2, 1.5); x.fillRect(bx - 1, y1 - 2.5, 2, 1.5);
      if (l.off) { x.fillStyle = PLATE[l.off]; x.fillRect(bx - 3, y0 + 3, 6, 1); x.fillRect(bx - 3, y1 - 4, 6, 1); }
    }
    // cameras and what they see
    for (const cam of L.cams) {
      const on = g.camLive(cam), a = g.camAngle(cam) * Math.PI / 180, alarm = g.ended?.what === 'camera' && g.ended.cam === cam;
      if (on) {
        const pts = [[cam.x, cam.y + 2]], n = 10;
        for (let k = 0; k <= n; k++) { const aa = a + (k / n * 2 - 1) * cam.fov * Math.PI / 180, len = this.ray(g, cam.x, cam.y + 2, aa, cam.len * T); pts.push([cam.x + Math.cos(aa) * len, cam.y + 2 + Math.sin(aa) * len]); }
        x.fillStyle = alarm ? 'rgba(255,60,70,.32)' : 'rgba(190,215,255,.13)'; x.beginPath(); pts.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath(); x.fill();
        x.strokeStyle = alarm ? 'rgba(255,90,100,.6)' : 'rgba(200,225,255,.22)'; x.lineWidth = .6; x.stroke();
      }
      x.fillStyle = '#20263a'; x.fillRect(cam.x - 1, cam.y - 3, 2, 3);
      x.save(); x.translate(cam.x, cam.y + 2); x.rotate(a); x.fillStyle = '#2c3552'; x.fillRect(-3, -2.5, 8, 5); x.fillStyle = on ? (alarm || Math.sin(now * 6) > 0 ? '#ff4d5e' : '#7a2030') : '#333a50'; x.fillRect(4, -1, 1.5, 2); x.restore();
      if (cam.off) { x.fillStyle = PLATE[cam.off]; x.fillRect(cam.x - 3, cam.y - 3, 6, 1); }
    }
    // things lying about
    for (const it of g.items) {
      if (it.holder) continue;
      if (it.id === 'jewel') this.jewel(it.x, it.y - (it.home ? 13 : 4), now);
      else this.key(it.x, it.y - 1.5);
    }
    // guards' torches, then everyone
    for (const gd of g.guards) this.torch(g, gd);
    const ghosts = g.copies.filter(c => !c.live), me = g.you;
    const labels = [];
    for (const c of ghosts) this.copy(g, c, now, labels);
    for (const gd of g.guards) this.guard(g, gd, now);
    if (me) this.copy(g, me, now, labels);
    this.labels(labels);
    this.frameFx(opts.dt || 1 / 60);
    this.edges(g);
    if (g.ended?.type === 'alarm') { const c = g.ended.by; x.strokeStyle = `rgba(255,70,80,${0.6 + 0.4 * Math.sin(now * 12)})`; x.lineWidth = 1.2; x.beginPath(); x.arc(c.x + BW / 2, c.y + BH / 2, 16, 0, 7); x.stroke(); }
    if (g.ended?.type === 'win') { const c = g.ended.by; x.strokeStyle = `rgba(255,220,120,${0.6 + 0.4 * Math.sin(now * 8)})`; x.lineWidth = 1.2; x.beginPath(); x.arc(c.x + BW / 2, c.y + BH / 2, 16, 0, 7); x.stroke(); }
  }
  // when the floor is wider than the screen, a small arrow at the edge for each guard or copy out of sight
  edges(g) {
    const r = this.r, x = this.x; if (!r || this.L.W * T * this.S <= r.w + 1) return;
    const left = (r.x - this.ox) / this.S, right = (r.x + r.w - this.ox) / this.S;
    const mark = (bx, by, col) => {
      if (bx > left && bx < right) return;
      const side = bx <= left ? 1 : -1, ex = side > 0 ? left + 3 / this.S : right - 3 / this.S, s = 5 / Math.max(this.S, 0.8) + 2;
      x.fillStyle = col; x.strokeStyle = '#04060d'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(ex, by); x.lineTo(ex + side * s, by - s * 0.8); x.lineTo(ex + side * s, by + s * 0.8); x.closePath(); x.fill(); x.stroke();
    };
    for (const c of g.copies) if (!c.live && c.state !== 'caught') mark(c.x + BW / 2, c.y + BH / 2, TINTS[c.n % 10]);
    for (const gd of g.guards) mark(gd.x + GW / 2, gd.y + GH / 2, gd.state === 'chase' ? '#ff6b5a' : '#c8ccd8');
  }
  ray(g, x0, y0, a, max) { const c = Math.cos(a), s = Math.sin(a); for (let d = 4; d < max; d += 3) if (g.opaque(Math.floor((x0 + c * d) / T), Math.floor((y0 + s * d) / T))) return d; return max; }
  night(now) {
    const x = this.x, w = this.cv.width, h = this.cv.height;
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a1433'); g.addColorStop(1, '#03050c'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    if (!this.stars || this.stars.w !== w || this.stars.h !== h) { this.stars = { w, h, s: Array.from({ length: 70 }, (_, i) => [hash(i, 1) * w, hash(i, 2) * h * .8, hash(i, 3)]) }; }
    for (const [sx, sy, r] of this.stars.s) { x.fillStyle = `rgba(200,215,255,${0.25 + 0.35 * r * (0.7 + 0.3 * Math.sin(now * (0.5 + r) + sx))})`; x.fillRect(sx, sy, this.dpr * (r > .8 ? 1.6 : 1), this.dpr * (r > .8 ? 1.6 : 1)); }
    // the building's outline glows faintly against the night
    const d = this.dpr, L = this.L; x.fillStyle = 'rgba(80,120,220,.10)'; x.fillRect(this.ox * d - 3 * d, this.oy * d - 3 * d, L.W * T * this.S * d + 6 * d, L.H * T * this.S * d + 6 * d);
  }

  /* ------------------------------------------------------------------------------------------------ people */
  // the burglar: beanie, mask, a striped jumper's worth of silhouette; phase drives the walk
  thief(cx, top, face, phase, climb, fill, rim, alpha) {
    const x = this.x; x.save(); x.globalAlpha = alpha; x.translate(cx, top); x.scale(face, 1);
    x.lineCap = 'round'; x.lineJoin = 'round';
    const s = Math.sin(phase), s2 = Math.sin(phase + Math.PI);
    const limb = (x0, y0, x1, y1, w) => { x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.lineWidth = w; x.stroke(); };
    // rim pass then fill pass, so each copy gets a thin coloured outline
    for (const pass of [0, 1]) {
      const col = pass ? fill : rim, grow = pass ? 0 : 1.3;
      x.strokeStyle = col; x.fillStyle = col;
      if (climb) { limb(-1.6, 14, -1.6 + 0, 21 + s * 1.2, 2.4 + grow); limb(1.6, 14, 1.6, 21 + s2 * 1.2, 2.4 + grow); limb(-2, 8.5, -3, 3 + s * 2, 1.8 + grow); limb(2, 8.5, 3, 3 + s2 * 2, 1.8 + grow); }
      else { limb(-0.6, 14, s * 3 - 0.6, 21, 2.5 + grow); limb(0.6, 14, s2 * 3 + 0.6, 21, 2.5 + grow); limb(0, 8.5, s2 * 2.6 - 0.5, 13.8, 1.9 + grow); }
      x.beginPath(); x.roundRect(-3.6 - grow / 2, 7 - grow / 2, 7.2 + grow, 8.4 + grow, 2.4); x.fill();
      x.beginPath(); x.arc(0.4, 4.2, 3.3 + grow / 2, 0, 7); x.fill();
      x.beginPath(); x.arc(0.2, 3.6, 3.6 + grow / 2, Math.PI, 0); x.fill();
      if (!climb) limb(0, 8.5, s * 2.6 + 0.5, 13.8, 1.9 + grow);
    }
    // the mask
    x.fillStyle = rim; x.globalAlpha = alpha * .9; x.fillRect(-1.6, 3.6, 5.4, 1.4); x.fillStyle = '#05070f'; x.fillRect(1.6, 3.9, 1, 0.8);
    x.restore();
  }
  copy(g, c, now, labels) {
    const x = this.x;
    let a = this.anim.get(c); if (!a) { a = { px: c.x, phase: 0, gone: 0 }; this.anim.set(c, a); }
    const moved = Math.abs(c.x - a.px) + (c.climb ? Math.abs(c.y - (a.py ?? c.y)) : 0); a.px = c.x; a.py = c.y;
    a.phase += moved * 0.42; if (!moved && !c.climb) a.phase *= 0.8;
    const tint = TINTS[c.n % TINTS.length], cx = c.x + BW / 2;
    let alpha = c.live ? 1 : 0.55, fill = mix(tint, '#070a18', c.live ? 0.35 : 0.5), jx = 0;
    if (c.state === 'caught') { a.gone = Math.min(1, a.gone + 1 / 40); if (a.gone >= 1) return; alpha *= 1 - a.gone; }
    if (c.state === 'frozen') { const r = hash(Math.floor(now * 24), c.n); alpha = 0.18 + r * 0.5; jx = r > .7 ? (r - .85) * 6 : 0; fill = mix(tint, '#8090b0', .5); }
    if (c.live && g.ended?.type !== 'caught') { x.fillStyle = tint + '22'; x.beginPath(); x.ellipse(cx, c.y + BH / 2, 9, 14, 0, 0, 7); x.fill(); }
    this.thief(cx + jx, c.y, c.face, a.phase, c.climb, fill, tint, alpha);
    if (c.state === 'frozen') { x.fillStyle = tint; x.globalAlpha = .5; for (let k = 0; k < 2; k++) { const yy = c.y + hash(Math.floor(now * 30), k + c.n * 3) * BH; x.fillRect(c.x - 2 + jx * 2, yy, BW + 4, 0.8); } x.globalAlpha = 1; }
    let top = c.y - 3;
    if (c.carry) { if (c.carry.id === 'jewel') this.jewel(cx, c.y - 4, now, alpha); else this.key(cx, c.y - 3, alpha); top -= 8; }
    if (c.state !== 'caught') labels.push({ x: cx, y: top, n: c.n, live: c.live, tint, state: c.state, alpha: c.live ? 1 : c.state === 'frozen' ? 0.6 : 0.85 });
    else if (a.gone < 0.6) labels.push({ x: cx, y: top - a.gone * 8, n: c.n, tint, state: 'caught', alpha: 1 - a.gone });
  }
  labels(list) {
    const x = this.x; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.lineJoin = 'round';
    // nudge labels apart where copies stand together, so each number can be read
    list.sort((a, b) => a.n - b.n);
    const placed = [];
    for (const l of list) {
      let y = l.y; for (let k = 0; k < 12; k++) { if (!placed.some(p => Math.abs(p.x - l.x) < 7 && Math.abs(p.y - y) < 7)) break; y -= 7; }
      placed.push({ x: l.x, y });
      const txt = String(l.n + 1);
      x.globalAlpha = l.alpha; x.font = `700 ${l.live ? 8 : 7}px Oswald, sans-serif`;
      x.strokeStyle = '#04060d'; x.lineWidth = 2.4; x.strokeText(txt, l.x, y); x.fillStyle = l.tint; x.fillText(txt, l.x, y);
      if (l.live) { x.fillStyle = l.tint; x.beginPath(); x.moveTo(l.x - 2, y + 1.5); x.lineTo(l.x + 2, y + 1.5); x.lineTo(l.x, y + 3.5); x.fill(); }
      if (l.state === 'park') { x.font = '600 5px Oswald, sans-serif'; x.fillStyle = l.tint; x.fillText('zz', l.x + 6, y - 3); }
      if (l.state === 'caught') { x.strokeStyle = '#ff6b7a'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(l.x + 4, y - 6); x.lineTo(l.x + 8, y - 2); x.moveTo(l.x + 8, y - 6); x.lineTo(l.x + 4, y - 2); x.stroke(); }
    }
    x.globalAlpha = 1;
  }
  torch(g, gd) {
    const x = this.x, gx = gd.x + GW / 2 + gd.face * 4, gy = gd.y + 10;
    let len = 0; const row = Math.floor((gd.y + 8) / T);
    for (let d = 0; d < SEE; d += 2) { if (g.opaque(Math.floor((gx + gd.face * d) / T), row)) break; len = d; }
    const chase = gd.state === 'chase' || gd.state === 'hunt', col = chase ? '255,110,90' : '255,226,150';
    const gr = x.createLinearGradient(gx, 0, gx + gd.face * len, 0); gr.addColorStop(0, `rgba(${col},.34)`); gr.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = gr; x.beginPath(); x.moveTo(gx, gy - 1); x.lineTo(gx + gd.face * len, gy - 9); x.lineTo(gx + gd.face * len, gy + 13 - 1); x.lineTo(gx, gy + 1); x.closePath(); x.fill();
  }
  guard(g, gd, now) {
    const x = this.x, cx = gd.x + GW / 2;
    let a = this.anim.get(gd); if (!a) { a = { px: gd.x, phase: 0 }; this.anim.set(gd, a); }
    const mv = Math.abs(gd.x - a.px); a.px = gd.x; a.phase += mv * 0.35;
    const s = Math.sin(a.phase), s2 = -s;
    x.save(); x.translate(cx, gd.y); x.scale(gd.face, 1); x.lineCap = 'round';
    x.strokeStyle = '#000'; x.fillStyle = '#000';
    const limb = (x0, y0, x1, y1, w) => { x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.lineWidth = w; x.stroke(); };
    limb(-1, 15, s * 3.2 - 1, 23.4, 3.2); limb(1, 15, s2 * 3.2 + 1, 23.4, 3.2);
    x.beginPath(); x.roundRect(-4.6, 7, 9.2, 9.5, 2.5); x.fill();
    x.beginPath(); x.arc(0.3, 4.4, 3.3, 0, 7); x.fill();
    x.fillRect(-3.4, 0, 7, 2.6); x.fillRect(-1, 2, 6.2, 1.2);             // the cap and its peak
    limb(1, 9, 5.5, 11, 2.2);                                                // the arm holding the torch
    x.fillStyle = '#2a2f40'; x.fillRect(5, 9.6, 3, 2.2);
    x.fillStyle = 'rgba(120,150,220,.55)'; x.fillRect(-3.4, 2.5, 7, 0.6);    // moonlight on the cap's band
    x.fillStyle = '#c9a54a'; x.fillRect(-1.6, 9, 1.4, 1.4);                 // badge
    x.restore();
    const mark = gd.state === 'chase' ? '!' : gd.state === 'hunt' || gd.state === 'search' ? '?' : '';
    if (mark) { x.textAlign = 'center'; x.font = '700 9px Oswald, sans-serif'; x.lineWidth = 2.4; x.strokeStyle = '#04060d'; x.strokeText(mark, cx, gd.y - 3 + Math.sin(now * 10) * .6); x.fillStyle = mark === '!' ? '#ff6b5a' : '#ffe08a'; x.fillText(mark, cx, gd.y - 3 + Math.sin(now * 10) * .6); }
  }
  jewel(cx, cy, now, alpha = 1) {
    const x = this.x; x.save(); x.globalAlpha = alpha;
    const tw = 0.6 + 0.4 * Math.sin(now * 3);
    x.fillStyle = `rgba(255,140,220,${0.18 * tw})`; x.beginPath(); x.arc(cx, cy, 7, 0, 7); x.fill();
    const gr = x.createLinearGradient(cx - 4, cy - 4, cx + 4, cy + 4); gr.addColorStop(0, '#b9fbff'); gr.addColorStop(.5, '#ff8fe0'); gr.addColorStop(1, '#7b5cff');
    x.fillStyle = gr; x.beginPath(); x.moveTo(cx - 4, cy - 1.5); x.lineTo(cx - 2, cy - 4); x.lineTo(cx + 2, cy - 4); x.lineTo(cx + 4, cy - 1.5); x.lineTo(cx, cy + 4); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = .5; x.beginPath(); x.moveTo(cx - 4, cy - 1.5); x.lineTo(cx + 4, cy - 1.5); x.moveTo(cx - 2, cy - 4); x.lineTo(cx, cy + 4); x.lineTo(cx + 2, cy - 4); x.stroke();
    x.fillStyle = `rgba(255,255,255,${tw})`; x.fillRect(cx + 1.5, cy - 6.5, .8, 2.5); x.fillRect(cx + .65, cy - 5.6, 2.5, .8);
    x.restore();
  }
  key(cx, cy, alpha = 1) {
    const x = this.x; x.save(); x.globalAlpha = alpha; x.fillStyle = 'rgba(255,210,90,.18)'; x.beginPath(); x.arc(cx, cy, 5, 0, 7); x.fill();
    x.strokeStyle = '#ffd65a'; x.fillStyle = '#ffd65a'; x.lineWidth = 1.2; x.beginPath(); x.arc(cx - 2.5, cy, 1.8, 0, 7); x.stroke();
    x.fillRect(cx - 0.8, cy - 0.5, 5, 1.1); x.fillRect(cx + 2.4, cy, 1, 1.8); x.fillRect(cx + 3.8, cy, 0.9, 1.4); x.restore();
  }

  /* ------------------------------------------------------------------------------------------------ effects */
  onEvent(e) {
    const d = e.data;
    if (e.type === 'caught') this.fx.push({ k: 'puff', x: d.c.x + BW / 2, y: d.c.y + BH / 2, t: 0 });
    if (e.type === 'freeze') this.fx.push({ k: 'zap', x: d.x + BW / 2, y: d.y + BH / 2, t: 0, n: d.n });
    if (e.type === 'unlock') this.fx.push({ k: 'ring', x: d.d.x * T + 8, y: (d.d.y0 + d.d.y1 + 1) * T / 2, t: 0, col: '#ffd65a' });
    if (e.type === 'pick') this.fx.push({ k: 'ring', x: d.c.x + BW / 2, y: d.c.y - 2, t: 0, col: d.it.id === 'jewel' ? '#ff8fe0' : '#ffd65a' });
  }
  frameFx(dt = 1 / 60) {
    const x = this.x;
    this.fx = this.fx.filter(f => (f.t += dt) < 0.8);
    for (const f of this.fx) {
      const k = f.t / 0.8;
      if (f.k === 'puff') { x.fillStyle = `rgba(200,210,240,${0.5 * (1 - k)})`; for (let i = 0; i < 6; i++) { const a = i / 6 * 7; x.beginPath(); x.arc(f.x + Math.cos(a) * k * 10, f.y + Math.sin(a) * k * 8, 2.5 * (1 - k) + 1, 0, 7); x.fill(); } }
      if (f.k === 'zap') { x.strokeStyle = TINTS[f.n % 10]; x.globalAlpha = 1 - k; x.lineWidth = 1; x.beginPath(); x.arc(f.x, f.y, 6 + k * 14, 0, 7); x.stroke(); x.globalAlpha = 1; }
      if (f.k === 'ring') { x.strokeStyle = f.col; x.globalAlpha = 1 - k; x.lineWidth = 1; x.beginPath(); x.arc(f.x, f.y, 3 + k * 12, 0, 7); x.stroke(); x.globalAlpha = 1; }
    }
  }
  // between runs: every tape runs backwards to the start, in a hurry
  drawRewind(g, p, now) {
    const x = this.x, tapes = g.tapes.slice();
    for (const it of this.L.items) { if (it.id === 'jewel') this.jewel(it.x, it.y - 13, now, .7); else this.key(it.x, it.y - 1.5, .7); }
    if (g.pendingShown) tapes.push(g.pendingShown);
    tapes.forEach((tp, n) => {
      const len = Math.max(1, Math.min(tp.end, RUN_TICKS)), i = Math.max(0, Math.min(len - 1, Math.floor((1 - p) * (len - 1))));
      const fx = tp.frames[i * 3], fy = tp.frames[i * 3 + 1], fl = tp.frames[i * 3 + 2];
      if (fx === undefined) return;
      const tint = TINTS[n % 10]; this.thief(fx + BW / 2, fy, fl & 1 ? 1 : -1, -p * 40 + n, !!(fl & 2), mix(tint, '#070a18', .5), tint, 0.6);
    });
    for (const gd of g.L.guards) { x.globalAlpha = .5; this.guard(g, { x: gd.x0, y: gd.y0, face: gd.face, state: 'post' }, now); x.globalAlpha = 1; }
    x.setTransform(1, 0, 0, 1, 0, 0);
    const w = this.cv.width, h = this.cv.height;
    x.fillStyle = 'rgba(60,90,200,.10)'; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.05)'; for (let y = (now * 300 * this.dpr) % (6 * this.dpr); y < h; y += 6 * this.dpr) x.fillRect(0, y, w, this.dpr);
    const band = ((now * 1.7) % 1) * h; x.fillStyle = 'rgba(200,220,255,.08)'; x.fillRect(0, band, w, 14 * this.dpr);
  }
}

function isThing(L, tx, ty) {
  return L.plates.some(p => p.x === tx && p.y === ty) || L.items.some(i => Math.floor(i.x / T) === tx && (i.y / T - 1 === ty || i.y / T - 2 === ty)) || L.lasers.some(l => l.x === tx) || L.cams.some(c => c.tx === tx && c.ty === ty) || L.exit.some(e => e.x === tx && e.y === ty) || L.grid[ty * L.W + tx] === LADDER;
}

/* ---------------------------------------------------------------------------------------------------- the timeline */
// Ten lanes, one per run: a bar for each tape as long as it ran, marks where a copy froze or was caught this run,
// and a playhead at the current second.
export function drawTimeline(cv, g, dpr, now, hoverLane = -1) {
  const x = cv.getContext('2d'), w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
  const lab = 20, x0 = lab + 3, x1 = w - 4, lane = (h - 2) / MAX_RUNS, bh = Math.max(2.5, lane * 0.7);
  const tx = tk => x0 + (x1 - x0) * Math.min(1, tk / RUN_TICKS);
  x.fillStyle = 'rgba(8,12,28,.6)'; x.fillRect(x0, 0, x1 - x0, h);
  for (let s = 5; s < 30; s += 5) { x.fillStyle = s % 10 ? 'rgba(140,160,220,.08)' : 'rgba(140,160,220,.16)'; x.fillRect(tx(s * HZ), 0, 1, h); }
  x.font = `600 ${Math.max(7, Math.min(11, lane * 1.05))}px Oswald, sans-serif`; x.textAlign = 'right'; x.textBaseline = 'middle';
  const cur = g.run;
  for (let n = 0; n < MAX_RUNS; n++) {
    const y = 1 + n * lane + (lane - bh) / 2, tint = TINTS[n], c = g.copies[n];
    if (n % 2 === 0) { x.fillStyle = 'rgba(140,160,220,.035)'; x.fillRect(x0, 1 + n * lane, x1 - x0, lane); }
    x.globalAlpha = n <= cur ? 1 : 0.35; x.fillStyle = n === cur ? tint : n < cur ? tint : '#56608a'; x.fillText(String(n + 1), lab, y + bh / 2 + 0.5);
    if (n === hoverLane && n < cur) { x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, y - 1, w, bh + 2); }
    x.globalAlpha = 1;
    if (n < cur) {
      const tp = g.tapes[n], end = tp.end;
      x.fillStyle = tint; x.globalAlpha = .75; x.fillRect(x0, y, tx(end) - x0, bh);
      if (end < RUN_TICKS) { x.globalAlpha = .35; for (let k = tx(end); k < x1; k += 3) x.fillRect(k, y + bh / 2 - .5, 1.5, 1); }
      x.globalAlpha = 1;
      for (const a of tp.acts) if (a.type === 'pick') { x.fillStyle = a.item === 'jewel' ? '#ff8fe0' : '#ffd65a'; const ax = tx(a.i); x.beginPath(); x.moveTo(ax, y - 1); x.lineTo(ax + 2.5, y + bh / 2); x.lineTo(ax, y + bh + 1); x.lineTo(ax - 2.5, y + bh / 2); x.fill(); }
      if (c && (c.state === 'frozen' || c.state === 'caught')) {
        const fx = tx(c.at); x.fillStyle = 'rgba(4,6,13,.65)'; x.fillRect(fx, y, Math.max(0, tx(end) - fx), bh);
        x.strokeStyle = c.state === 'caught' ? '#ff6b7a' : '#ffffff'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(fx - 2.5, y - 1); x.lineTo(fx + 2.5, y + bh + 1); x.moveTo(fx + 2.5, y - 1); x.lineTo(fx - 2.5, y + bh + 1); x.stroke();
      }
    } else if (n === cur) {
      x.fillStyle = tint; x.fillRect(x0, y, tx(g.tick) - x0, bh);
      x.strokeStyle = tint; x.globalAlpha = .4; x.lineWidth = 1; x.strokeRect(x0 + .5, y + .5, x1 - x0 - 1, bh - 1); x.globalAlpha = 1;
      for (const a of g.acts) if (a.type === 'pick') { x.fillStyle = a.item === 'jewel' ? '#ff8fe0' : '#ffd65a'; const ax = tx(a.i); x.beginPath(); x.moveTo(ax, y - 1); x.lineTo(ax + 2.5, y + bh / 2); x.lineTo(ax, y + bh + 1); x.lineTo(ax - 2.5, y + bh / 2); x.fill(); }
    } else { x.strokeStyle = 'rgba(120,140,200,.18)'; x.lineWidth = 1; x.strokeRect(x0 + .5, y + .5, x1 - x0 - 1, bh - 1); }
  }
  const px = tx(g.tick); x.fillStyle = '#fff'; x.fillRect(px - .5, 0, 1.2, h);
  return { x0, x1, lane, laneAt: py => Math.floor((py - 1) / lane) };
}
