// The dance floor, printed: three inks (blue, fluoro pink, yellow) multiplied over cream paper,
// a hair off register, with halftone shadows and paper grain.
import { PAPER, BLUE, PINK, YELLOW, drawAnimal } from './animals.js';
import { R } from './game.js';

const FONT = 'Chango, "Arial Black", sans-serif';

function dots(col, step, rad) {
  const c = document.createElement('canvas'); c.width = c.height = step;
  const g = c.getContext('2d'); g.fillStyle = col;
  g.beginPath(); g.arc(step / 4, step / 4, rad, 0, 7); g.arc(step * 3 / 4, step * 3 / 4, rad, 0, 7); g.fill();
  return c;
}

export class View {
  constructor(cv) {
    this.cv = cv; this.g = cv.getContext('2d');
    this.parts = []; this.shake = 0; this.top = 64; this.bottom = 14;
    this.dpr = 1; this.s = 30; this.ox = 0; this.oy = 0; this.W = 15; this.H = 25;
    const n = document.createElement('canvas'); n.width = n.height = 200;
    const ng = n.getContext('2d'), id = ng.createImageData(200, 200);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = Math.random();
      const k = v < 0.04 ? 180 : v > 0.985 ? 255 : 236 + Math.random() * 19;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = k; id.data[i + 3] = 255;
    }
    ng.putImageData(id, 0, 0);
    this.grain = n;
  }

  resize() {
    const dpr = this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = innerWidth, h = innerHeight;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    this.vw = w; this.vh = h;
    this.fit(this.W, this.H);
  }

  // the floor's shape to ask for, given the room on screen
  room() { return { w: this.vw - 24, h: this.vh - this.top - this.bottom }; }

  fit(W, H) {
    this.W = W; this.H = H;
    const { w, h } = this.room();
    this.s = Math.min(w / W, h / H);
    this.ox = (this.vw - W * this.s) / 2;
    this.oy = this.top + (h - H * this.s) / 2;
    this.bake();
  }

  bake() {
    const dpr = this.dpr, c = this.base = document.createElement('canvas');
    c.width = this.cv.width; c.height = this.cv.height;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = PAPER; g.fillRect(0, 0, this.vw, this.vh);
    const s = this.s, x0 = this.ox, y0 = this.oy, fw = this.W * s, fh = this.H * s;
    g.globalCompositeOperation = 'multiply';
    // floor tiles: every other square printed in a yellow halftone
    const tile = 2 * s, pat = g.createPattern(dots(YELLOW, Math.max(5, s * 0.28), Math.max(1.4, s * 0.09)), 'repeat');
    g.save(); g.beginPath(); g.rect(x0, y0, fw, fh); g.clip();
    g.fillStyle = pat;
    for (let i = 0; i * tile < fw; i++) for (let j = 0; j * tile < fh; j++) if ((i + j) % 2 === 0) g.fillRect(x0 + i * tile, y0 + j * tile, tile, tile);
    // a big pink star printed faintly in the middle of the floor
    g.globalAlpha = 0.18; g.fillStyle = PINK;
    star(g, x0 + fw / 2, y0 + fh / 2, Math.min(fw, fh) * 0.34, Math.min(fw, fh) * 0.15, 8);
    g.globalAlpha = 1;
    g.restore();
    // the edge: a blue rule, with the pink drum printed a touch off
    g.lineJoin = 'round';
    g.strokeStyle = PINK; g.lineWidth = 3; g.strokeRect(x0 - 4 + 1.5, y0 - 4 - 1, fw + 8, fh + 8);
    g.strokeStyle = BLUE; g.lineWidth = 3; g.strokeRect(x0 - 4, y0 - 4, fw + 8, fh + 8);
    g.lineWidth = 1.2; g.strokeRect(x0 - 9, y0 - 9, fw + 18, fh + 18);
    // bunting along the top edge
    const n = Math.max(6, Math.round(fw / 34)), bw = (fw + 18) / n, cols = [PINK, YELLOW, BLUE];
    g.strokeStyle = BLUE; g.lineWidth = 1; g.beginPath(); g.moveTo(x0 - 9, y0 - 9); g.quadraticCurveTo(x0 + fw / 2, y0 + 4, x0 + fw + 9, y0 - 9); g.stroke();
    for (let i = 0; i < n; i++) {
      const xa = x0 - 9 + i * bw, xb = xa + bw, f = (i + 0.5) / n, sag = 4 * f * (1 - f) * 6.5;
      g.fillStyle = cols[i % 3];
      g.beginPath(); g.moveTo(xa + 2, y0 - 9 + sag); g.lineTo(xb - 2, y0 - 9 + sag); g.lineTo((xa + xb) / 2, y0 - 9 + sag + bw * 0.62); g.fill();
    }
    g.globalAlpha = 0.5; g.fillStyle = g.createPattern(this.grain, 'repeat'); g.fillRect(0, 0, this.vw, this.vh); g.globalAlpha = 1;
  }

  wx(x) { return this.ox + x * this.s; }
  wy(y) { return this.oy + y * this.s; }
  toWorld(px, py) { return { x: (px - this.ox) / this.s, y: (py - this.oy) / this.s }; }

  burst(x, y, team, n = 18) {
    const cols = team === 'foe' ? [PINK, YELLOW, BLUE] : [BLUE, YELLOW, PINK];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 5;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, r: Math.random() * 6, vr: (Math.random() - 0.5) * 14, c: cols[i % 3], t: 0, life: 0.9 + Math.random() * 0.6, w: 0.18 + Math.random() * 0.14 });
    }
  }

  draw(game, dt, ui = {}) {
    const g = this.g, s = this.s, dpr = this.dpr;
    this.game = game;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(this.base, 0, 0);
    if (!game) return;
    this.shake = Math.max(0, this.shake - dt * 3);
    const sh = this.shake * 6;
    g.setTransform(dpr, 0, 0, dpr, (Math.random() - 0.5) * sh * dpr, (Math.random() - 0.5) * sh * dpr);
    const beat = game.beat, ph = beat % 1;
    const bob = (i) => Math.abs(Math.sin((beat + i * 0.12) * Math.PI)) * 0.13 * s;
    const sway = (i) => Math.sin((beat + i * 0.25) * Math.PI) * 0.09;
    const tokR = R * s * 1.04;

    // coins
    for (const c of game.coins) {
      const x = this.wx(c.x), y = this.wy(c.y) - Math.abs(Math.sin(game.t * 3 + c.x)) * 0.15 * s, r = 0.32 * s;
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = YELLOW; circle(g, x - 1, y + 1, r);
      g.strokeStyle = PINK; g.lineWidth = Math.max(1.2, s * 0.06); g.beginPath(); g.arc(x + 1, y - 0.6, r, 0, 7); g.stroke();
      g.fillStyle = BLUE; star(g, x, y, r * 0.55, r * 0.24, 5);
    }

    // halftone shadows under everyone
    g.globalCompositeOperation = 'multiply';
    if (!this.shadowPat || this.shadowS !== s) { this.shadowPat = g.createPattern(dots(BLUE, Math.max(4, s * 0.16), Math.max(0.9, s * 0.045)), 'repeat'); this.shadowS = s; }
    g.fillStyle = this.shadowPat; g.globalAlpha = 0.55;
    const shadow = (x, y, r) => { g.beginPath(); g.ellipse(x + r * 0.15, y + r * 0.85, r * 0.95, r * 0.42, 0, 0, 7); g.fill(); };
    for (const w of game.wild) shadow(this.wx(w.x), this.wy(w.y), tokR);
    for (const L of game.lines) for (const d of L.dancers) shadow(this.wx(d.x), this.wy(d.y), tokR * (d.boss ? 1.5 : 1));
    g.globalAlpha = 1;

    // the rope of hands-on-shoulders through each line
    for (const L of game.lines) {
      const ds = L.dancers; if (ds.length < 2) continue;
      g.strokeStyle = L.team === 'you' ? BLUE : PINK;
      g.lineWidth = Math.max(2, s * 0.2); g.lineCap = g.lineJoin = 'round';
      g.globalAlpha = 0.45;
      g.beginPath();
      ds.forEach((d, i) => { const x = this.wx(d.x), y = this.wy(d.y) - bob(i) * 0.5; i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke(); g.globalAlpha = 1;
    }

    // free dancers on the floor, waiting to be picked up
    for (const w of game.wild) {
      const x = this.wx(w.x), y = this.wy(w.y) - Math.abs(Math.sin(game.t * 4 + w.x)) * 0.2 * s;
      g.globalCompositeOperation = 'multiply';
      g.strokeStyle = w.mine ? BLUE : PINK; g.lineWidth = Math.max(1.2, s * 0.06);
      g.setLineDash([s * 0.18, s * 0.14]); g.lineDashOffset = -game.t * s * 0.6;
      g.beginPath(); g.arc(x, y, tokR * 1.45, 0, 7); g.stroke(); g.setLineDash([]);
      g.save(); g.translate(x, y); g.rotate(Math.sin(game.t * 5 + w.x) * 0.15);
      drawAnimal(g, w.d.sp, tokR, w.mine ? 'mine' : 'wild');
      g.restore();
    }

    // the lines, back to front so heads sit on top
    for (const L of game.lines) {
      const team = L.team, ds = L.dancers;
      for (let i = ds.length - 1; i >= 0; i--) {
        const d = ds[i];
        let x = this.wx(d.x), y = this.wy(d.y) - bob(i);
        if (d.join > 0) { const f = d.join * d.join; x += (this.wx(d.jx) - x) * f; y += (this.wy(d.jy) - y) * f - Math.sin(d.join * Math.PI) * s * 0.9; }
        const r = tokR * (d.boss ? 1.55 : 1);
        if (d.safe > 0 && Math.floor(d.safe * 12) % 2) continue;
        g.save(); g.translate(x, y);
        // feet: a little kick on four
        g.globalCompositeOperation = 'multiply';
        g.strokeStyle = team === 'you' ? BLUE : PINK; g.lineWidth = Math.max(1.5, s * 0.09); g.lineCap = 'round';
        const k = d.kick > 0 ? Math.sin(d.kick / 0.3 * Math.PI) : 0, side = i % 2 ? 1 : -1;
        g.beginPath(); g.moveTo(-r * 0.35, r * 0.8); g.lineTo(-r * 0.4 - (side < 0 ? k * r * 0.7 : 0), r * 1.25 - (side < 0 ? k * r * 0.4 : 0));
        g.moveTo(r * 0.35, r * 0.8); g.lineTo(r * 0.4 + (side > 0 ? k * r * 0.7 : 0), r * 1.25 - (side > 0 ? k * r * 0.4 : 0)); g.stroke();
        g.rotate(sway(i));
        drawAnimal(g, d.sp, r, team, { hat: i === 0 && d.sp !== 'peacock' });
        if (d.hit > 0) { g.globalCompositeOperation = 'source-over'; g.globalAlpha = Math.min(1, d.hit * 4) * 0.75; g.fillStyle = PAPER; circle(g, 0, 0, r * 1.02); g.globalAlpha = 1; }
        g.restore();
        if (s >= 22 || i === 0) this.badges(g, x, y, r, d, team, L, i);
      }
    }

    this.effects(g, game, dt);

    // the floating thumb-stick
    if (ui.stick) {
      const { ax, ay, px, py } = ui.stick;
      g.globalCompositeOperation = 'multiply';
      g.strokeStyle = BLUE; g.lineWidth = 2; g.globalAlpha = 0.6;
      g.beginPath(); g.arc(ax, ay, 46, 0, 7); g.stroke();
      g.fillStyle = PINK; g.globalAlpha = 0.5; circle(g, px, py, 20);
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = 'source-over';
  }

  badges(g, x, y, r, d, team, L, i) {
    const s = this.s;
    const br = Math.max(6.5, s * 0.21), fs = Math.round(Math.max(9, br * 1.25));
    const atk = this.game.atkOf(L, i);
    const items = [[x - r * 0.8, y + r * 0.78, YELLOW, atk], [x + r * 0.8, y + r * 0.78, team === 'foe' ? BLUE : PINK, Math.max(0, d.hp)]];
    g.font = `${fs}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [bx, by, col, v] of items) {
      g.globalCompositeOperation = 'source-over'; g.fillStyle = PAPER; circle(g, bx, by, br);
      g.globalCompositeOperation = 'multiply'; g.fillStyle = col; circle(g, bx, by, br * 0.86);
      g.fillStyle = col === YELLOW ? BLUE : PAPER;
      if (col !== YELLOW) g.globalCompositeOperation = 'source-over';
      g.fillText(String(v), bx, by + fs * 0.06);
    }
    if (d.lvl > 1) {
      g.globalCompositeOperation = 'multiply'; g.fillStyle = team === 'foe' ? BLUE : PINK;
      for (let k = 0; k < d.lvl; k++) star(g, x + (k - (d.lvl - 1) / 2) * br * 1.1, y - r * 1.25, br * 0.55, br * 0.24, 5);
    }
  }

  effects(g, game, dt) {
    const s = this.s;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const f of game.fx) {
      const x = this.wx(f.x), y = this.wy(f.y), p = f.t / f.life;
      g.globalCompositeOperation = 'multiply';
      switch (f.k) {
        case 'clash': {
          const k = 1 - p;
          g.fillStyle = YELLOW; star(g, x, y, s * (0.5 + p * 0.5), s * 0.22, 9);
          g.globalAlpha = k; g.fillStyle = PINK; star(g, x + 1.5, y - 1, s * (0.32 + p * 0.4), s * 0.12, 9); g.globalAlpha = 1;
          break;
        }
        case 'dmg': {
          const fs = Math.round(Math.max(14, s * 0.62));
          g.font = `${fs}px ${FONT}`;
          const yy = y - s * 0.6 - p * s * 1.1;
          g.globalAlpha = Math.min(1, (1 - p) * 2.5);
          g.fillStyle = PINK; g.fillText('-' + f.n, x + 1.5, yy - 1);
          g.fillStyle = BLUE; g.fillText('-' + f.n, x, yy);
          g.globalAlpha = 1;
          break;
        }
        case 'heal': g.globalAlpha = 1 - p; g.fillStyle = BLUE; plus(g, x, y - s * (0.6 + p), s * 0.3); g.globalAlpha = 1; break;
        case 'hype': g.globalAlpha = 1 - p; g.fillStyle = PINK; tri(g, x, y - s * (0.7 + p * 0.9), s * 0.28); g.globalAlpha = 1; break;
        case 'block': g.globalAlpha = 1 - p; g.strokeStyle = BLUE; g.lineWidth = s * 0.1; g.beginPath(); g.arc(x, y, s * (0.6 + p * 0.3), 0, 7); g.stroke(); g.globalAlpha = 1; break;
        case 'hug': g.globalAlpha = 1 - p; g.strokeStyle = PINK; g.lineWidth = s * 0.12; g.beginPath(); g.arc(x, y, s * (0.9 - p * 0.3), 0, 7); g.stroke(); g.globalAlpha = 1; break;
        case 'spit': {
          g.fillStyle = BLUE;
          for (let k = 0; k < 4; k++) { const q = Math.min(1, p * 1.6 + k * 0.08); circle(g, x + (this.wx(f.x2) - x) * q, y + (this.wy(f.y2) - y) * q - Math.sin(q * Math.PI) * s * 0.5, s * 0.08); }
          break;
        }
        case 'stink': {
          g.globalAlpha = (1 - p) * 0.7;
          g.fillStyle = YELLOW; circle(g, x, y, s * 3 * (0.4 + p * 0.6));
          g.fillStyle = this.shadowPat; circle(g, x, y, s * 3 * (0.4 + p * 0.6));
          g.globalAlpha = 1;
          break;
        }
        case 'trip': case 'coin': {
          const txt = f.k === 'trip' ? 'OOPS!' : '+' + (f.n || 1);
          const fs = Math.round(Math.max(f.k === 'trip' ? 18 : 13, s * (f.k === 'trip' ? 0.9 : 0.55)));
          g.font = `${fs}px ${FONT}`; g.globalAlpha = Math.min(1, (1 - p) * 2.5);
          const yy = y - s * 0.5 - p * s;
          g.fillStyle = YELLOW; g.fillText(txt, x - 1.5, yy + 1.5);
          g.fillStyle = f.k === 'trip' ? PINK : BLUE; g.fillText(txt, x, yy);
          g.globalAlpha = 1;
          break;
        }
      }
    }
    // confetti from knock-outs
    for (const q of this.parts) {
      q.t += dt; q.vy += 9 * dt; q.vx *= 1 - dt * 1.5; q.x += q.vx * dt; q.y += q.vy * dt; q.r += q.vr * dt;
      const k = 1 - q.t / q.life;
      g.save(); g.translate(this.wx(q.x), this.wy(q.y)); g.rotate(q.r); g.scale(1, Math.cos(q.r * 1.7));
      g.globalAlpha = Math.max(0, Math.min(1, k * 2)); g.fillStyle = q.c;
      g.fillRect(-q.w * s / 2, -q.w * s * 0.3, q.w * s, q.w * s * 0.6);
      g.restore();
    }
    g.globalAlpha = 1;
    this.parts = this.parts.filter(q => q.t < q.life);
  }
}

function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
function star(g, x, y, R1, R2, n) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, r = i % 2 ? R2 : R1; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.closePath(); g.fill();
}
function plus(g, x, y, r) { g.fillRect(x - r, y - r * 0.3, r * 2, r * 0.6); g.fillRect(x - r * 0.3, y - r, r * 0.6, r * 2); }
function tri(g, x, y, r) { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y + r * 0.7); g.lineTo(x - r, y + r * 0.7); g.closePath(); g.fill(); }
