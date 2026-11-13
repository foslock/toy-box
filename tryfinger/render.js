// Ink-wash renderer. Tiles are baked into chunk canvases; everything that moves is brushed each frame.
import { W, H } from './level.js';

const CH = 16;
const INK = '#120f0b', INK2 = '#1c1914', GOLD = '#c9a865', GLOW = '#ff9a3c', BONE = '#e9dfc6';
const hash = (x, y, k = 0) => { let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const stoneLook = (c) => c === '#' || c === '%' || c === '|' || c === 'o';

export class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.chunks = new Map();
    this.parts = [];
    this.shake = 0;
    this.cam = { x: 10, y: 8 };
  }
  resize(w, h, dpr, portrait) {
    this.w = w; this.h = h; this.dpr = dpr; this.portrait = portrait;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.ts = Math.max(24, Math.min(h / 14, w / 22));
    this.chunks.clear();
    this.bakeSky(); this.bakeGrain();
  }
  invalidate() { this.chunks.clear(); }

  // ---------- baked pieces
  bakeSky() {
    const c = document.createElement('canvas'), w = 512, h = 512;
    c.width = w; c.height = h; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#b3a789'); g.addColorStop(0.55, '#8e846c'); g.addColorStop(1, '#5c5545');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const rx = hash(i, 1) * w, ry = hash(i, 2) * h, r = 40 + hash(i, 3) * 140;
      const rg = x.createRadialGradient(rx, ry, 0, rx, ry, r);
      const dark = hash(i, 4) < 0.6;
      rg.addColorStop(0, dark ? 'rgba(60,52,38,0.16)' : 'rgba(230,214,170,0.14)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = rg; x.fillRect(0, 0, w, h);
    }
    this.sky = c;
    // two layers of far towers
    this.towers = [0, 1].map(L => {
      const tw = 1600, th = 600, t = document.createElement('canvas'); t.width = tw; t.height = th; const y = t.getContext('2d');
      const col = L ? 'rgba(44,40,32,0.55)' : 'rgba(70,64,50,0.38)';
      y.fillStyle = col;
      let px = 0, k = L * 100;
      while (px < tw) {
        const bw = 40 + hash(k, 1) * 120, bh = (L ? 120 : 220) + hash(k, 2) * (L ? 200 : 260);
        y.fillRect(px, th - bh, bw, bh + 2);
        if (hash(k, 3) < 0.6) { // spire
          y.beginPath(); y.moveTo(px - 4, th - bh); y.lineTo(px + bw / 2, th - bh - 60 - hash(k, 4) * 140); y.lineTo(px + bw + 4, th - bh); y.fill();
        } else { // crenels
          for (let c2 = px; c2 < px + bw - 8; c2 += 16) y.fillRect(c2, th - bh - 10, 9, 10);
        }
        // windows
        y.save(); y.globalCompositeOperation = 'destination-out';
        for (let wy = th - bh + 30; wy < th - 30; wy += 46) if (hash(k, wy) < 0.35) y.fillRect(px + bw / 2 - 3, wy, 6, 14);
        y.restore();
        px += bw + hash(k, 5) * (L ? 30 : 80); k++;
      }
      // fog at the base
      const fg = y.createLinearGradient(0, th - 220, 0, th); fg.addColorStop(0, 'rgba(150,140,115,0)'); fg.addColorStop(1, 'rgba(150,140,115,0.55)');
      y.fillStyle = fg; y.fillRect(0, th - 220, tw, 220);
      return t;
    });
  }
  bakeGrain() {
    const c = document.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d');
    const id = x.createImageData(160, 160);
    for (let i = 0; i < id.data.length; i += 4) { const v = 120 + (Math.random() * 135 | 0); id.data[i] = v; id.data[i + 1] = v * 0.96; id.data[i + 2] = v * 0.86; id.data[i + 3] = 22; }
    x.putImageData(id, 0, 0);
    this.grain = this.ctx.createPattern(c, 'repeat');
  }

  chunk(game, cx, cy) {
    const key = cx + ',' + cy;
    let c = this.chunks.get(key);
    if (c) return c;
    const s = this.ts * this.dpr, px = CH * s;
    c = document.createElement('canvas'); c.width = Math.ceil(px); c.height = Math.ceil(px);
    const x = c.getContext('2d');
    const T = (tx, ty) => game.tile(tx, ty);
    const interior = (tx, ty) => {
      const c0 = T(tx, ty);
      if (c0 === '.') return true;
      if (c0 === ' ' || stoneLook(c0)) return false;
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => T(tx + a, ty + b) === '.');
    };
    // pass 1: back walls
    for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
      const tx = cx * CH + i, ty = cy * CH + j; if (ty >= H || tx >= W) continue;
      if (!interior(tx, ty)) continue;
      const X = i * s, Y = j * s;
      const depth = Math.min(1, ty / 40);
      x.fillStyle = `rgb(${62 - depth * 20},${56 - depth * 18},${44 - depth * 14})`;
      x.fillRect(X, Y, s + 1, s + 1);
      // bricks
      x.strokeStyle = 'rgba(15,12,8,0.22)'; x.lineWidth = s * 0.03;
      for (let r = 0; r < 2; r++) {
        const yy = Y + r * s / 2 + s * 0.02;
        x.beginPath(); x.moveTo(X, yy + hash(tx, ty, r) * s * 0.03); x.lineTo(X + s, yy + hash(tx + 1, ty, r) * s * 0.03); x.stroke();
        const off = ((ty * 2 + r) % 2) * 0.5;
        x.beginPath(); x.moveTo(X + off * s + s * 0.1 * hash(tx, ty, 9 + r), yy); x.lineTo(X + off * s, yy + s / 2); x.stroke();
      }
      if (hash(tx, ty, 3) < 0.12) { // stain
        const rg = x.createRadialGradient(X + s / 2, Y + s / 2, 0, X + s / 2, Y + s / 2, s * 1.1);
        rg.addColorStop(0, 'rgba(20,16,10,0.3)'); rg.addColorStop(1, 'rgba(20,16,10,0)');
        x.fillStyle = rg; x.fillRect(X - s, Y - s, s * 3, s * 3);
      }
      // ambient occlusion from neighbouring stone
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (stoneLook(T(tx + a, ty + b))) {
        const g = x.createLinearGradient(X + (a > 0 ? s : 0), Y + (b > 0 ? s : 0), X + (a > 0 ? s * 0.4 : a < 0 ? s * 0.6 : 0), Y + (b > 0 ? s * 0.4 : b < 0 ? s * 0.6 : 0));
        g.addColorStop(0, 'rgba(10,8,5,0.45)'); g.addColorStop(1, 'rgba(10,8,5,0)');
        x.fillStyle = g; x.fillRect(X, Y, s, s);
      }
    }
    // pass 2: stone, planks, spikes
    for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
      const tx = cx * CH + i, ty = cy * CH + j; if (ty >= H || tx >= W) continue;
      let ch = T(tx, ty); const X = i * s, Y = j * s;
      if (ch === 'v' && T(tx, ty - 1) === 'o') ch = '#';
      if (stoneLook(ch)) {
        x.fillStyle = INK2; x.fillRect(X - 0.5, Y - 0.5, s + 1, s + 1);
        if (hash(tx, ty, 5) < 0.5) { x.fillStyle = 'rgba(70,60,44,0.22)'; x.beginPath(); x.ellipse(X + hash(tx, ty, 6) * s, Y + hash(tx, ty, 7) * s, s * (0.2 + hash(tx, ty, 8) * 0.4), s * 0.12, 0, 0, 7); x.fill(); }
        const T2 = (a, b) => { const q = T(a, b); return q === 'v' && T(a, b - 1) === 'o' ? '#' : q; };
        const up = T2(tx, ty - 1), dn = T2(tx, ty + 1), lf = T2(tx - 1, ty), rt = T2(tx + 1, ty);
        const open = (c2) => !stoneLook(c2) && c2 !== '^';
        x.fillStyle = INK2;
        // ragged edges reaching out a little
        const rag = (ax, ay, bx, by, nx, ny, k) => {
          x.beginPath(); x.moveTo(ax, ay);
          for (let q = 1; q <= 5; q++) { const f = q / 6, o = hash(tx, ty, k + q) * s * 0.09; x.lineTo(ax + (bx - ax) * f + nx * o, ay + (by - ay) * f + ny * o); }
          x.lineTo(bx, by); x.closePath(); x.fill();
        };
        if (open(up)) rag(X, Y, X + s, Y, 0, -1, 10);
        if (open(dn)) { rag(X, Y + s, X + s, Y + s, 0, 1, 20); if (hash(tx, ty, 31) < 0.3) { x.beginPath(); x.moveTo(X + s * 0.3, Y + s); x.quadraticCurveTo(X + s * 0.36, Y + s * 1.25, X + s * 0.4, Y + s); x.fill(); } }
        if (open(lf)) rag(X, Y, X, Y + s, -1, 0, 40);
        if (open(rt)) rag(X + s, Y, X + s, Y + s, 1, 0, 50);
        if (open(up)) {
          // dry-brush light along the walkable top: one tapered, broken stroke
          x.fillStyle = up === ' ' ? 'rgba(196,174,120,0.32)' : 'rgba(170,148,100,0.2)';
          x.beginPath();
          const pts = [];
          for (let q = 0; q <= 6; q++) pts.push([X + q / 6 * s, Y + s * 0.07 + hash(tx, ty, 70 + q) * s * 0.05, s * (0.015 + hash(tx, ty, 60 + q) * 0.035)]);
          x.moveTo(pts[0][0], pts[0][1] - pts[0][2]);
          for (const [px, py, w] of pts) x.lineTo(px, py - w);
          for (let q = pts.length - 1; q >= 0; q--) x.lineTo(pts[q][0], pts[q][1] + pts[q][2]);
          x.fill();
          if (up === ' ' && hash(tx, ty, 80) < 0.55) { // grass, brushed
            x.strokeStyle = INK; x.lineWidth = s * 0.035;
            for (let q = 0; q < 3; q++) { const gx = X + hash(tx, ty, 81 + q) * s, gh = s * (0.15 + hash(tx, ty, 85 + q) * 0.25); x.beginPath(); x.moveTo(gx, Y + 1); x.quadraticCurveTo(gx + s * 0.05, Y - gh * 0.6, gx + (hash(tx, ty, 90 + q) - 0.5) * s * 0.3, Y - gh); x.stroke(); }
          }
        }
      } else if (ch === '-') {
        x.fillStyle = '#2b2219'; x.fillRect(X - 1, Y, s + 2, s * 0.2);
        x.strokeStyle = 'rgba(190,160,110,0.45)'; x.lineWidth = s * 0.035; x.beginPath(); x.moveTo(X, Y + s * 0.04); x.lineTo(X + s, Y + s * 0.05); x.stroke();
        x.strokeStyle = INK; x.lineWidth = s * 0.03; x.beginPath(); x.moveTo(X + s * 0.5, Y + s * 0.03); x.lineTo(X + s * 0.5, Y + s * 0.2); x.stroke();
        if ((tx + ty) % 3 === 0) { x.beginPath(); x.moveTo(X + s * 0.2, Y + s * 0.2); x.lineTo(X + s * 0.45, Y + s * 0.55); x.stroke(); }
      } else if (ch === '^') {
        x.fillStyle = INK; x.fillRect(X, Y + s * 0.7, s, s * 0.3);
        for (let q = 0; q < 4; q++) {
          const bx = X + q * s / 4;
          x.fillStyle = INK; x.beginPath(); x.moveTo(bx, Y + s * 0.75); x.lineTo(bx + s / 8, Y + s * 0.05 + hash(tx, q) * s * 0.15); x.lineTo(bx + s / 4, Y + s * 0.75); x.fill();
          x.strokeStyle = 'rgba(220,200,160,0.55)'; x.lineWidth = s * 0.02; x.beginPath(); x.moveTo(bx + s / 8, Y + s * 0.1 + hash(tx, q) * s * 0.15); x.lineTo(bx + s / 8 + s * 0.03, Y + s * 0.4); x.stroke();
        }
      }
    }
    this.chunks.set(key, c);
    return c;
  }

  // ---------- frame
  draw(game, dt, ui) {
    const { ctx, dpr } = this; const ts = this.ts, p = game.player;
    // camera
    const look = p.face * 1.6 + p.vx * 0.15;
    let tx = p.x + look, ty = p.y - (this.portrait ? 1.0 : 2.4);
    if (game.fight) { const f = game.fight; tx = (p.x * 0.6 + (f.kind === 'hand' ? (f.ax0 + f.ax1) / 2 : f.x) * 0.4); ty = p.y - (this.portrait ? 1.5 : f.kind === 'hand' ? 4 : 3); }
    if (ui.lookDown) ty += 4;
    const vw = this.w / ts, vh = this.h / ts;
    const cam = this.cam;
    if (ui.snap) { cam.x = tx; cam.y = ty; }
    cam.x += (tx - cam.x) * Math.min(1, dt * 5); cam.y += (ty - cam.y) * Math.min(1, dt * 4);
    cam.x = Math.max(vw / 2, Math.min(W - vw / 2, cam.x)); cam.y = Math.max(vh / 2 - 2, Math.min(H - vh / 2 + (this.portrait ? vh * 0.22 : 0), cam.y));
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const sh = this.shake * this.shake * 0.35;
    const ox = cam.x - vw / 2 + (Math.random() - 0.5) * sh, oy = cam.y - vh / 2 + (Math.random() - 0.5) * sh;
    this.ox = ox; this.oy = oy;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // sky
    ctx.drawImage(this.sky, 0, 0, this.cv.width, this.cv.height);
    this.towers.forEach((t, L) => {
      const par = L ? 0.32 : 0.14, scale = dpr * (L ? 0.9 : 0.75);
      const tw = t.width * scale, th = t.height * scale;
      const baseY = (24 - oy) * ts * dpr * (L ? 0.5 : 0.3) + this.cv.height * 0.08 - th * 0.5;
      let sx = -((ox * ts * dpr * par) % tw); if (sx > 0) sx -= tw;
      for (let x = sx; x < this.cv.width; x += tw) ctx.drawImage(t, x, baseY, tw, th);
    });

    // world space
    const S = ts * dpr;
    ctx.setTransform(S, 0, 0, S, -ox * S, -oy * S);
    // chunks
    const c0 = Math.floor(ox / CH), c1 = Math.floor((ox + vw) / CH), r0 = Math.floor(oy / CH), r1 = Math.floor((oy + vh) / CH);
    for (let cy = Math.max(0, r0); cy <= Math.min(Math.ceil(H / CH) - 1, r1); cy++)
      for (let cx = Math.max(0, c0); cx <= Math.min(Math.ceil(W / CH) - 1, c1); cx++) {
        const c = this.chunk(game, cx, cy);
        ctx.drawImage(c, cx * CH, cy * CH, c.width / S, c.height / S);
      }
    if (oy + vh > H) { ctx.fillStyle = INK2; ctx.fillRect(ox - 1, H, vw + 2, oy + vh - H + 1); }
    const T = game.t;
    this.drawWindows(game, ox, oy, vw, vh, T);
    this.drawDynamicTiles(game, ox, oy, vw, vh);
    // candles, chests, stains, messages
    for (const c of game.candles) this.drawCandle(c, T);
    for (const c of game.chests) if (!c.gone) this.drawChest(c);
    if (game.bossDead.hand) this.drawExit(game.exit, T);
    for (const gs of game.ghostStains) this.drawStain(gs.x, gs.y, gs.play >= 0, T, 'rgba(140,40,25,');
    if (game.stain) this.drawStain(game.stain.x, game.stain.y, game.stainPlay >= 0, T, 'rgba(170,60,30,');
    for (const m of game.msgs) if (m.x > ox - 2 && m.x < ox + vw + 2) this.drawMsg(m, T, m === game.nearMsg);
    if (game.bossMsg) this.drawMsg(game.bossMsg, T, true, true);
    // ghosts
    for (const gs of game.ghostStains) if (gs.play >= 0) this.drawGhost(gs.track, gs.play, 'rgba(190,70,45,');
    if (game.stainPlay >= 0 && game.stain) this.drawGhost(game.stain.track, game.stainPlay, 'rgba(220,120,60,');
    // telegraphs
    const f = game.fight;
    if (f && f.kind === 'hand' && f.state === 'tele') this.drawTele(f, T);
    // enemies & player
    for (const e of game.enemies) this.drawEnemy(e, T, game);
    this.drawPlayer(p, T, game);
    this.drawParts(dt);

    // light & shade (screen space)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const depth = Math.max(0, Math.min(1, (p.y - 14) / 20));
    const px = (p.x - ox) * S, py = (p.y - 0.8 - oy) * S;
    const R = Math.max(this.cv.width, this.cv.height);
    const vg = ctx.createRadialGradient(px, py, R * 0.12, px, py, R * 0.75);
    vg.addColorStop(0, 'rgba(8,6,4,0)'); vg.addColorStop(1, `rgba(8,6,4,${0.45 + depth * 0.4})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    // glows
    ctx.globalCompositeOperation = 'lighter';
    const glow = (wx, wy, r, a, col = '255,150,60') => {
      const gx = (wx - ox) * S, gy = (wy - oy) * S, gr = r * S;
      if (gx < -gr || gx > this.cv.width + gr || gy < -gr || gy > this.cv.height + gr) return;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    };
    for (const m of game.msgs) glow(m.x, m.y - 0.1, 1.6, (m.mine ? 0.12 : 0.2) + 0.05 * Math.sin(T * 2 + m.x));
    if (game.bossMsg) glow(game.bossMsg.x, game.bossMsg.y - 0.2, 3, 0.35);
    for (const c of game.candles) glow(c.x, c.y - 1.1, c.lit ? 4.5 : 1.6, c.lit ? 0.32 + 0.04 * Math.sin(T * 9 + c.x) : 0.12, '255,170,80');
    if (game.bossDead.hand) glow(game.exit.x, game.exit.y - 3, 6, 0.3, '255,230,170');
    if (p.state === 'heal') glow(p.x, p.y - 1, 2, 0.35);
    ctx.globalCompositeOperation = 'source-over';
    // paper grain over everything
    ctx.fillStyle = this.grain; ctx.fillRect(0, 0, this.cv.width, this.cv.height);
  }

  w2s(x, y) { const S = this.ts; return [(x - this.ox) * S, (y - this.oy) * S]; }

  drawDynamicTiles(game, ox, oy, vw, vh) {
    const ctx = this.ctx, T = game.t;
    const x0 = Math.max(0, Math.floor(ox) - 1), x1 = Math.min(W - 1, Math.ceil(ox + vw) + 1), y0 = Math.max(0, Math.floor(oy) - 1), y1 = Math.min(H - 1, Math.ceil(oy + vh) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const c = game.grid[y][x];
      if (c === 'v' && game.grid[y - 1]?.[x] === 'o') continue;
      if (c === 'v') {
        if (x > x0 && game.grid[y][x - 1] === 'v') continue;
        let n = 1; while (game.grid[y][x + n] === 'v') n++;
        const g = ctx.createLinearGradient(0, y - 2.6, 0, y + 0.8);
        g.addColorStop(0, 'rgba(10,8,6,0)'); g.addColorStop(0.55, 'rgba(10,8,6,0.8)'); g.addColorStop(1, 'rgba(6,5,3,1)');
        ctx.fillStyle = g; ctx.fillRect(x, y - 2.6, n, 3.4);
        ctx.fillStyle = '#060503'; ctx.fillRect(x, y + 0.79, n, 3);
        ctx.fillStyle = 'rgba(200,180,140,0.3)';
        for (let i = 0; i < n * 2; i++) { const k = (T * 0.25 + hash(x + i, y)) % 1; ctx.fillRect(x + i / 2 + hash(x, y, i), y + 0.6 - k * 2.6, 0.04, 0.04); }
      } else if (c === ':' && game.bridge) {
        ctx.strokeStyle = `rgba(230,190,110,${0.35 + 0.1 * Math.sin(T * 3 + x)})`; ctx.lineWidth = 0.04; ctx.setLineDash([0.1, 0.12]);
        ctx.strokeRect(x + 0.04, y + 0.04, 0.92, 0.5); ctx.setLineDash([]);
      } else if (c === 'g' && game.fight) {
        for (let q = 0; q < 4; q++) {
          ctx.strokeStyle = `rgba(14,11,8,${0.55 + q * 0.1})`; ctx.lineWidth = 0.08;
          ctx.beginPath(); const bx = x + 0.2 + q * 0.2;
          ctx.moveTo(bx + Math.sin(T * 2 + y + q) * 0.1, y); ctx.lineTo(bx + Math.sin(T * 2 + y + 1 + q) * 0.1, y + 1); ctx.stroke();
        }
      } else if (c === 'G' && !game.bossDead.warden) {
        ctx.fillStyle = INK; for (let q = 0; q < 3; q++) ctx.fillRect(x + 0.12 + q * 0.32, y, 0.09, 1);
        ctx.fillRect(x, y + 0.45, 1, 0.07);
      } else if (c === '%' && game.falling != null) {
        ctx.strokeStyle = 'rgba(220,190,130,0.6)'; ctx.lineWidth = 0.03;
        ctx.beginPath(); ctx.moveTo(x + hash(x, 1) , y); ctx.lineTo(x + 0.5, y + 0.5); ctx.lineTo(x + hash(x, 2), y + 1); ctx.stroke();
      }
    }
  }

  drawWindows(game, ox, oy, vw, vh, T) {
    if (this._winGrid !== game.grid) {
      this._winGrid = game.grid; this.windows = [];
      for (let y = 1; y < H - 3; y++) for (let x = 0; x < W; x++)
        if (x % 9 === 4 && game.grid[y][x] === '.' && stoneLook(game.grid[y - 1][x]) && game.grid[y + 1][x] === '.' && game.grid[y + 2][x] === '.') this.windows.push([x, y]);
    }
    const ctx = this.ctx;
    for (const [x, y] of this.windows) {
      if (x < ox - 6 || x > ox + vw + 2 || y < oy - 2 || y > oy + vh + 1) continue;
      ctx.fillStyle = 'rgba(206,176,112,0.28)';
      ctx.beginPath(); ctx.moveTo(x + 0.22, y + 1.7); ctx.lineTo(x + 0.22, y + 0.6); ctx.quadraticCurveTo(x + 0.5, y + 0.05, x + 0.78, y + 0.6); ctx.lineTo(x + 0.78, y + 1.7); ctx.fill();
      ctx.strokeStyle = 'rgba(18,15,11,0.8)'; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(x + 0.5, y + 0.3); ctx.lineTo(x + 0.5, y + 1.7); ctx.moveTo(x + 0.22, y + 1.05); ctx.lineTo(x + 0.78, y + 1.05); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(x, y, x + 3, y + 6);
      const a = 0.07 + 0.015 * Math.sin(T * 0.7 + x);
      g.addColorStop(0, `rgba(210,180,120,${a})`); g.addColorStop(1, 'rgba(210,180,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x + 0.22, y + 0.6); ctx.lineTo(x + 0.78, y + 0.6); ctx.lineTo(x + 4.2, y + 6.5); ctx.lineTo(x + 2.4, y + 6.5); ctx.fill();
      ctx.restore();
    }
  }

  drawCandle(c, T) {
    const ctx = this.ctx, x = c.x, y = c.y;
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(x - 0.35, y); ctx.lineTo(x - 0.12, y - 0.22); ctx.lineTo(x + 0.12, y - 0.22); ctx.lineTo(x + 0.35, y); ctx.fill();
    ctx.fillRect(x - 0.05, y - 0.8, 0.1, 0.6);
    ctx.fillStyle = '#d9cba6'; ctx.fillRect(x - 0.1, y - 1.05, 0.2, 0.28);
    ctx.fillStyle = 'rgba(217,203,166,0.7)'; ctx.fillRect(x + 0.07, y - 0.95, 0.04, 0.16);
    const fl = c.lit ? 0.32 : 0.12, wob = Math.sin(T * 13 + x) * 0.03;
    ctx.fillStyle = c.lit ? '#ffcf7a' : '#a8642a';
    ctx.beginPath(); ctx.moveTo(x - fl * 0.35, y - 1.05); ctx.quadraticCurveTo(x - fl * 0.4, y - 1.05 - fl * 0.6, x + wob, y - 1.08 - fl * 1.4); ctx.quadraticCurveTo(x + fl * 0.4, y - 1.05 - fl * 0.6, x + fl * 0.35, y - 1.05); ctx.fill();
    if (c.lit) {
      // embers
      for (let i = 0; i < 3; i++) { const k = (T * 0.4 + i / 3 + hash(c.i, i)) % 1; ctx.fillStyle = `rgba(255,190,110,${1 - k})`; ctx.fillRect(x + Math.sin(k * 8 + i) * 0.2, y - 1.3 - k * 1.6, 0.04, 0.04); }
    }
  }
  drawChest(c) {
    const ctx = this.ctx, x = c.x, y = c.y;
    ctx.fillStyle = '#2a2016'; ctx.fillRect(x - 0.45, y - 0.55, 0.9, 0.55);
    ctx.strokeStyle = INK; ctx.lineWidth = 0.05; ctx.strokeRect(x - 0.45, y - 0.55, 0.9, 0.55);
    ctx.fillStyle = GOLD; ctx.fillRect(x - 0.32, y - 0.55, 0.07, 0.55); ctx.fillRect(x + 0.25, y - 0.55, 0.07, 0.55);
    if (c.opened) { ctx.fillStyle = '#1b140d'; ctx.save(); ctx.translate(x - 0.45, y - 0.55); ctx.rotate(-0.9); ctx.fillRect(0, -0.22, 0.9, 0.22); ctx.restore(); }
    else { ctx.fillStyle = '#2a2016'; ctx.beginPath(); ctx.ellipse(x, y - 0.55, 0.45, 0.2, 0, Math.PI, 0); ctx.fill(); ctx.stroke(); ctx.fillStyle = GOLD; ctx.fillRect(x - 0.05, y - 0.6, 0.1, 0.13); }
  }
  drawExit(e, T) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, e.y - 12, 0, e.y);
    g.addColorStop(0, 'rgba(255,235,190,0)'); g.addColorStop(1, `rgba(255,235,190,${0.35 + 0.08 * Math.sin(T * 2)})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(e.x - 0.6, e.y - 13); ctx.lineTo(e.x + 0.6, e.y - 13); ctx.lineTo(e.x + 1.4, e.y); ctx.lineTo(e.x - 1.4, e.y); ctx.fill();
  }
  drawStain(x, y, active, T, col) {
    const ctx = this.ctx;
    ctx.fillStyle = col + (active ? '0.9)' : (0.55 + 0.15 * Math.sin(T * 2.5 + x)) + ')');
    ctx.beginPath(); ctx.ellipse(x, y - 0.03, 0.42, 0.08, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 0.3, y - 0.02, 0.14, 0.05, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - 0.35, y - 0.02, 0.08, 0.04, 0, 0, 7); ctx.fill();
  }
  drawMsg(m, T, near, big) {
    const ctx = this.ctx, x = m.x, y = m.y - 0.04;
    const n = (m.text || '').length;
    const w = big ? 2.4 : 1.1, a = near ? 1 : 0.75;
    ctx.save();
    ctx.strokeStyle = m.mine ? `rgba(240,200,140,${a * 0.85})` : `rgba(255,${big ? 120 : 150},60,${a})`;
    ctx.lineWidth = big ? 0.07 : 0.05; ctx.lineCap = 'round';
    ctx.shadowColor = GLOW; ctx.shadowBlur = 8 * this.dpr;
    const seed = [...(m.text || 'x')].reduce((s, c) => s + c.charCodeAt(0), 0);
    let cx = x - w / 2;
    const step = w / Math.max(6, n * 0.6);
    ctx.beginPath(); ctx.moveTo(cx, y);
    for (let i = 0; cx < x + w / 2; i++) {
      const hh = 0.06 + hash(seed, i) * 0.16;
      const nx = cx + step;
      if (hash(seed, i, 2) < 0.18) { ctx.moveTo(nx, y); cx = nx; continue; }
      ctx.quadraticCurveTo(cx + step * 0.5, y - hh * (i % 2 ? 1 : -0.4) - 0.06, nx, y - 0.02);
      cx = nx;
    }
    ctx.stroke();
    ctx.restore();
  }
  drawGhost(track, t, col) {
    const i = Math.min(track.length - 1, Math.floor(t * 30));
    if (i < 0) return;
    const f = track[i];
    const fade = i >= track.length - 1 ? Math.max(0, 1 - (t * 30 - track.length) / 12) : 1;
    this.drawFigure(f[0], f[1], f[2], f[3] === 2 ? 'roll' : 'free', t * 10 * (f[3] ? 1 : 0), col + (0.55 * fade) + ')', null, t);
  }

  drawTele(f, T) {
    const ctx = this.ctx, fy = f.floorY;
    const a = 0.35 + 0.25 * Math.sin(T * 30);
    if (f.atk === 'sweep') {
      ctx.fillStyle = `rgba(20,10,5,${a})`; ctx.fillRect(f.ax0, fy - 1.1, f.ax1 - f.ax0, 1.1);
    } else {
      ctx.fillStyle = `rgba(15,8,4,${a})`;
      ctx.beginPath(); ctx.ellipse((f.z0 + f.z1) / 2, fy - 0.05, (f.z1 - f.z0) / 2, 0.25, 0, 0, 7); ctx.fill();
    }
  }

  // ---------- figures
  drawFigure(x, y, face, state, anim, col, p, T, extra = {}) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (state === 'roll') {
      const r = (extra.st || anim) * 14;
      ctx.translate(0, -0.42); ctx.rotate(r);
      ctx.beginPath(); ctx.arc(0, 0, 0.38, 0, 7); ctx.fill();
      if (extra.scarf) { ctx.strokeStyle = extra.scarf; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.arc(0, 0, 0.3, 0.3, 2.4); ctx.stroke(); }
      ctx.restore(); return;
    }
    if (state === 'dead') {
      ctx.beginPath(); ctx.ellipse(0, -0.14, 0.7, 0.16, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(0.6, -0.2, 0.17, 0, 7); ctx.fill();
      ctx.restore(); return;
    }
    const run = Math.sin(anim * 3.2), air = extra.air;
    // legs
    ctx.lineWidth = 0.13;
    const lg = (ph) => { const sw = air ? 0.18 * ph : run * 0.28 * ph; ctx.beginPath(); ctx.moveTo(0, -0.55); ctx.lineTo(sw * 0.6, -0.28 - (air ? 0.06 : Math.max(0, run * ph) * 0.08)); ctx.lineTo(sw, 0); ctx.stroke(); };
    lg(1); lg(-1);
    // cloak body
    const lean = extra.lean || 0;
    ctx.beginPath();
    ctx.moveTo(-0.2 + lean * 0.3, -1.12); ctx.lineTo(0.18 + lean * 0.3, -1.12);
    ctx.lineTo(0.3 + lean * 0.1, -0.5); ctx.quadraticCurveTo(0.05, -0.38 - Math.abs(run) * 0.05, -0.34 - Math.abs(extra.vx || 0) * 0.04, -0.46);
    ctx.closePath(); ctx.fill();
    // hood
    ctx.beginPath(); ctx.arc(0.04 + lean * 0.35, -1.2, 0.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-0.14 + lean * 0.35, -1.32); ctx.quadraticCurveTo(-0.3, -1.25, -0.28, -1.05); ctx.lineTo(-0.1, -1.1); ctx.fill();
    if (extra.mask) { ctx.fillStyle = extra.mask; ctx.fillRect(0.1 + lean * 0.35, -1.25, 0.1, 0.04); ctx.fillStyle = col; }
    // scarf
    if (extra.scarf) {
      ctx.strokeStyle = extra.scarf; ctx.lineWidth = 0.08;
      const wave = Math.sin((T || 0) * 9) * 0.08, back = 0.4 + Math.min(0.5, Math.abs(extra.vx || 0) * 0.07);
      ctx.beginPath(); ctx.moveTo(0.1 + lean * 0.3, -1.04); ctx.quadraticCurveTo(-back * 0.5, -1.0 + wave, -back, -0.9 - wave + (air ? -0.15 : 0)); ctx.stroke();
      ctx.strokeStyle = col;
    }
    // arm + blade
    if (extra.sword !== false) {
      const atk = extra.atk;
      ctx.lineWidth = 0.09;
      let ang;
      if (atk != null) { const k = Math.min(1, atk / 0.2); ang = -2.2 + k * 3.0; }
      else if (extra.heal != null) ang = -2.4;
      else ang = 0.7 + run * 0.15;
      const sx = 0.08 + lean * 0.3, sy = -0.98;
      const hx = sx + Math.cos(ang) * 0.3, hy = sy + Math.sin(ang) * 0.3;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
      if (extra.heal != null) { ctx.fillStyle = '#ff9a3c'; ctx.beginPath(); ctx.arc(hx, hy - 0.05, 0.08, 0, 7); ctx.fill(); }
      else {
        ctx.strokeStyle = extra.blade || BONE; ctx.lineWidth = 0.045;
        const bl = 0.85; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(ang) * bl, hy + Math.sin(ang) * bl); ctx.stroke();
      }
      if (atk != null && atk > 0.06 && atk < 0.24) {
        ctx.strokeStyle = `rgba(255,236,190,${0.9 - (atk - 0.06) * 4})`; ctx.lineWidth = 0.12;
        ctx.beginPath(); ctx.arc(sx, sy + 0.1, 1.15, -1.9, 0.9); ctx.stroke();
        ctx.strokeStyle = `rgba(255,170,80,${0.5 - (atk - 0.06) * 2.5})`; ctx.lineWidth = 0.05;
        ctx.beginPath(); ctx.arc(sx, sy + 0.1, 1.35, -1.6, 0.7); ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawPlayer(p, T, game) {
    if (p.inv > 0 && p.state !== 'hurt' && Math.floor(T * 20) % 2 === 0) return;
    const col = p.state === 'hurt' ? '#5a1d12' : INK;
    this.drawFigure(p.x, p.y, p.face, p.state, p.anim, col, p, T, {
      scarf: '#d8bf7f', mask: 'rgba(233,223,198,0.9)', st: p.st, vx: p.vx, air: !p.ground,
      atk: p.state === 'attack' ? p.st : null, heal: p.state === 'heal' ? p.st : null, lean: p.state === 'attack' ? 0.3 : Math.max(-0.2, Math.min(0.3, p.vx * 0.03 * p.face)),
    });
  }

  drawEnemy(e, T, game) {
    const ctx = this.ctx;
    const fade = e.state === 'dead' ? Math.max(0, 1 - e.st / (e.boss ? 2.5 : 1.2)) : 1;
    ctx.save(); ctx.globalAlpha = fade;
    const tel = e.state === 'windup' || e.state === 'aim';
    if (e.kind === 'hollow') {
      if (e.state === 'dormant') {
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(e.x, e.y - 0.35, 0.4, 0.38, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(e.x - 0.2 * e.face, e.y - 0.75, 0.17, 0, 7); ctx.fill();
      } else {
        const hunch = e.state === 'windup' ? -0.15 : 0.25;
        this.drawFigure(e.x, e.y, e.face, e.state === 'dead' ? 'dead' : 'free', game.t * (Math.abs(e.vx) > 0.3 ? 2 : 0), INK, null, T,
          { lean: hunch, atk: e.state === 'strike' ? 0.08 + e.st : e.state === 'windup' ? 0 : null, blade: '#8c826b', vx: e.vx });
        // eye
        ctx.fillStyle = tel ? '#ffb347' : 'rgba(230,180,90,0.8)';
        ctx.fillRect(e.x + e.face * (0.12 + hunch * 0.35), e.y - 1.24, 0.06, 0.04);
        if (e.state === 'windup' && e.st > 0.22) this.glint(e.x - e.face * 0.6, e.y - 1.9, e.st);
      }
    } else if (e.kind === 'crow') {
      const flap = Math.sin(T * (e.state === 'perch' ? 10 : 18)) * 0.35;
      ctx.fillStyle = INK; ctx.save(); ctx.translate(e.x, e.y - 0.3); ctx.scale(e.face, 1);
      ctx.beginPath(); ctx.ellipse(0, 0, 0.32, 0.14, e.state === 'swoop' ? 0.5 : 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-0.05, -0.02); ctx.lineTo(-0.3, -0.35 - flap); ctx.lineTo(0.15, -0.05); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0.28, -0.05); ctx.lineTo(0.48, 0.02); ctx.lineTo(0.28, 0.05); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-0.3, 0); ctx.lineTo(-0.55, -0.08); ctx.lineTo(-0.5, 0.1); ctx.fill();
      ctx.fillStyle = tel ? '#ffb347' : '#c9a865'; ctx.fillRect(0.18, -0.07, 0.05, 0.04);
      ctx.restore();
    } else if (e.kind === 'mimic') {
      if (e.state === 'dormant') this.drawChest(e);
      else {
        const open = e.state === 'windup' ? 0.3 + e.st : e.state === 'bite' ? 0.1 : 0.45 + Math.sin(T * 6) * 0.1;
        ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.face, 1);
        ctx.fillStyle = '#2a2016'; ctx.fillRect(-0.45, -0.5, 0.9, 0.5);
        ctx.fillStyle = GOLD; ctx.fillRect(-0.32, -0.5, 0.07, 0.5); ctx.fillRect(0.25, -0.5, 0.07, 0.5);
        ctx.save(); ctx.translate(-0.45, -0.5); ctx.rotate(-open); ctx.fillStyle = '#2a2016'; ctx.fillRect(0, -0.28, 0.95, 0.28);
        ctx.fillStyle = BONE; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0.1 + i * 0.14, 0); ctx.lineTo(0.17 + i * 0.14, 0.12); ctx.lineTo(0.24 + i * 0.14, 0); ctx.fill(); }
        ctx.restore();
        ctx.fillStyle = '#6e1f14'; ctx.beginPath(); ctx.moveTo(-0.3, -0.5); ctx.quadraticCurveTo(0.4, -0.45 - open * 0.3, 0.75 + open * 0.3, -0.4); ctx.lineTo(0.3, -0.5); ctx.fill();
        ctx.fillStyle = BONE; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-0.38 + i * 0.14, -0.5); ctx.lineTo(-0.31 + i * 0.14, -0.62); ctx.lineTo(-0.24 + i * 0.14, -0.5); ctx.fill(); }
        // legs
        ctx.strokeStyle = INK; ctx.lineWidth = 0.08; for (let i = 0; i < 4; i++) { const k = Math.sin(T * 12 + i) * (e.ground ? 0.05 : 0.15); ctx.beginPath(); ctx.moveTo(-0.35 + i * 0.23, -0.05); ctx.lineTo(-0.42 + i * 0.23 + k, 0.02); ctx.stroke(); }
        ctx.restore();
        if (e.state === 'windup') this.glint(e.x, e.y - 1.2, e.st);
      }
    } else if (e.kind === 'warden') this.drawWarden(e, T);
    else if (e.kind === 'hand') this.drawHand(e, T);
    ctx.restore();
  }
  glint(x, y, t) {
    const ctx = this.ctx, k = Math.min(1, t * 3);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,200,110,${k})`; ctx.lineWidth = 0.05;
    const r = 0.18 + k * 0.12;
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
    ctx.restore();
  }
  drawWarden(e, T) {
    const ctx = this.ctx;
    const s = e.state;
    ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.face, 1);
    const sleep = s === 'sleep';
    const bob = s === 'walk' ? Math.abs(Math.sin(T * 4)) * 0.06 : 0;
    ctx.fillStyle = INK;
    // legs
    const st = s === 'walk' ? Math.sin(T * 4) * 0.25 : 0;
    ctx.fillRect(-0.5 + st, -1.0, 0.36, 1.0); ctx.fillRect(0.15 - st, -1.0, 0.36, 1.0);
    // skirt of plates + torso
    ctx.beginPath(); ctx.moveTo(-0.8, -0.9 - bob); ctx.lineTo(0.8, -0.9 - bob); ctx.lineTo(0.6, -2.3 - bob); ctx.lineTo(-0.65, -2.3 - bob); ctx.fill();
    ctx.strokeStyle = 'rgba(200,175,120,0.35)'; ctx.lineWidth = 0.04;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-0.7, -1.1 - i * 0.35 - bob); ctx.lineTo(0.7, -1.1 - i * 0.35 - bob); ctx.stroke(); }
    // bell helm
    ctx.fillStyle = '#2a2318';
    ctx.beginPath(); ctx.moveTo(-0.5, -2.25 - bob); ctx.quadraticCurveTo(-0.45, -3.1 - bob, 0, -3.15 - bob); ctx.quadraticCurveTo(0.45, -3.1 - bob, 0.5, -2.25 - bob); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.moveTo(-0.52, -2.3 - bob); ctx.lineTo(0.52, -2.3 - bob); ctx.stroke();
    ctx.fillStyle = sleep ? 'rgba(200,150,80,0.3)' : '#ffb347'; ctx.fillRect(0.1, -2.62 - bob, 0.3, 0.05);
    // hammer
    let ang = sleep ? 0.9 : 0.4;
    if (s === 'windup') ang = e.atk === 'over' ? -2.6 * Math.min(1, e.st / 0.5) : e.atk === 'sweep' ? 2.4 : -2.2;
    if (s === 'over') ang = -2.6 + Math.min(1, e.st / 0.1) * 3.9;
    if (s === 'sweep') ang = 2.4 - Math.min(1, e.st / 0.15) * 2.6;
    if (s === 'leap') ang = -2.4;
    if (s === 'recover') ang = e.atk === 'over' || e.atk === 'leap' ? 1.3 : -0.3;
    const sx = 0.2, sy = -2.0 - bob;
    const hx = sx + Math.cos(ang) * 2.2, hy = sy + Math.sin(ang) * 2.2;
    ctx.strokeStyle = INK; ctx.lineWidth = 0.14; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang); ctx.fillStyle = INK; ctx.fillRect(-0.3, -0.42, 0.6, 0.84); ctx.restore();
    if ((s === 'over' || s === 'sweep') && e.st < 0.2) {
      ctx.strokeStyle = 'rgba(255,230,180,0.7)'; ctx.lineWidth = 0.18;
      ctx.beginPath(); ctx.arc(sx, sy, 2.3, s === 'over' ? -2 : 0.4, s === 'over' ? 1.2 : 2.4); ctx.stroke();
    }
    ctx.restore();
    if (s === 'windup') this.glint(e.x + e.face * 0.3, e.y - 3.6, e.st);
  }
  drawHand(e, T) {
    const ctx = this.ctx, s = e.state;
    ctx.save(); ctx.translate(e.x, e.y);
    const writing = s === 'write' || s === 'go';
    const flat = s === 'slam' || s === 'stunned';
    const sw = s === 'sweep' || s === 'rest' || (s === 'tele' && e.atk === 'sweep');
    if (sw) ctx.scale(e.sweepFrom < 0 ? 1 : -1, 1);
    ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineCap = 'round';
    // wrist trailing up out of the dark
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(0, -0.3);
    if (sw) ctx.quadraticCurveTo(-3, -1, -6, -0.6); else ctx.quadraticCurveTo(0.4, -5, -0.6, -12);
    ctx.stroke();
    // palm
    ctx.beginPath(); ctx.ellipse(0, 0, 1.1, flat ? 0.45 : 0.75, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 0.32;
    const finger = (a, len, bend) => { ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.8, Math.sin(a) * 0.5); const mx = Math.cos(a) * (0.8 + len * 0.6), my = Math.sin(a) * 0.5 + len * 0.5 * bend; ctx.quadraticCurveTo(mx, my, Math.cos(a) * (0.8 + len), Math.sin(a) * 0.5 + len * bend); ctx.stroke(); };
    if (writing) {
      finger(0.6, 0.4, 1.2); finger(0.9, 0.35, 1.3); finger(1.2, 0.3, 1.2); // curled
      ctx.lineWidth = 0.28; ctx.beginPath(); ctx.moveTo(-0.2, 0.5); ctx.lineTo(-0.35, 1.2); ctx.stroke(); // pointing down to write
      ctx.fillStyle = GLOW; ctx.beginPath(); ctx.arc(-0.35, 1.25, 0.12, 0, 7); ctx.fill();
      ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(-0.9, 0); ctx.lineTo(-1.4, 0.35); ctx.stroke();
    } else if (sw) {
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0.8, -0.3 + i * 0.22); ctx.lineTo(2.0 - Math.abs(i - 1.5) * 0.25, -0.3 + i * 0.22 + 0.1); ctx.stroke(); }
    } else {
      for (let i = 0; i < 4; i++) { const fx = -0.75 + i * 0.5; ctx.beginPath(); ctx.moveTo(fx, flat ? 0.2 : 0.4); ctx.lineTo(fx + (i - 1.5) * 0.08, flat ? 0.5 : 1.5 - Math.abs(i - 1.5) * 0.18); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(-1.6, flat ? 0.3 : 0.6); ctx.stroke();
    }
    // a single eye in the palm
    ctx.fillStyle = s === 'stunned' ? '#7a5a30' : '#ffb347';
    ctx.beginPath(); ctx.ellipse(0, 0, 0.32, s === 'stunned' ? 0.03 : 0.14, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ---------- particles (world units)
  burst(x, y, n, kind) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = kind === 'ink' ? 2 + Math.random() * 6 : 1 + Math.random() * 4;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, life: 0.4 + Math.random() * 0.5, t: 0, kind, r: 0.04 + Math.random() * 0.08 });
    }
  }
  dust(x, y, n = 6) { for (let i = 0; i < n; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 0.6, y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 1.5, life: 0.5, t: 0, kind: 'dust', r: 0.08 + Math.random() * 0.1 }); }
  drawParts(dt) {
    const ctx = this.ctx;
    this.parts = this.parts.filter(p => (p.t += dt) < p.life);
    for (const p of this.parts) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 'dust' ? -1 : 18) * dt; p.vx *= 0.97;
      const k = 1 - p.t / p.life;
      ctx.fillStyle = p.kind === 'ink' ? `rgba(14,10,7,${k})` : p.kind === 'gold' ? `rgba(255,190,100,${k})` : p.kind === 'blood' ? `rgba(110,25,15,${k})` : `rgba(150,138,110,${k * 0.5})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.kind === 'dust' ? 1 + p.t * 3 : 1), 0, 7); ctx.fill();
    }
  }
}
