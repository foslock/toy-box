// Chat Dungeon: drawing. Flat bright colours, fat ink outlines that "boil" (re-jitter a few times a second), big hit effects.
import { T, COLS, ROWS, W, H, VOTE_TIME, RELICS } from './game.js';

export const INK = '#1d1029';
const CREAM = '#fff4dc';
const PALETTES = {
  tutorial: { a: '#efe6ff', b: '#e4d8fb', wall: '#6a55b5', top: '#8a77d6', ob: '#a08cf0' },
  1: { a: '#ffe2b0', b: '#f8d49a', wall: '#7b4bff', top: '#9d78ff', ob: '#b598ff' },
  2: { a: '#c9f0d0', b: '#b5e6bf', wall: '#159a8c', top: '#2ec4b6', ob: '#5fd8cc' },
  3: { a: '#ffd6c9', b: '#ffc4b2', wall: '#e0434f', top: '#ff6b6b', ob: '#ff9090' },
  4: { a: '#d3e0ff', b: '#c0d1fb', wall: '#3550e6', top: '#5a74ff', ob: '#8296ff' },
  5: { a: '#f6cfe9', b: '#edbade', wall: '#a8164f', top: '#d6336c', ob: '#ee5e8f' },
};
const COL = {
  player: '#2ec4b6', goblin: '#7ee05a', bat: '#9a6bff', slime: '#ff6fae', minislime: '#ff6fae', skeleton: '#f4efe0', boss: '#ff5245', dummy: '#e8c27a',
};
const POWS = ['POW', 'BONK', 'WHAM', 'THWACK', 'SMACK', 'BOP'];
const DOOR_ICON = { fight: 'swords', elite: 'crown', treasure: 'chest', shrine: 'heart', stairs: 'stairs', boss: 'skull' };
export const DOOR_WORD = { fight: 'MONSTERS', elite: 'ELITE', treasure: 'TREASURE', shrine: 'SHRINE', stairs: 'STAIRS', boss: 'BOSS' };

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const lerp = (a, b, t) => a + (b - a) * t;

export class View {
  constructor(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.s = 1; this.camX = 0; this.vw = W; this.time = 0; this.bf = 0;
    this.fx = []; this.parts = []; this.shake = 0; this.flash = 0; this.flashCol = '#fff';
    this.slams = []; this.labelPx = 12;
    this.reduced = false;
  }

  // fit the room into a box of cssW × cssH; on narrow screens zoom in and pan instead of shrinking to nothing
  fit(cssW, cssH) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let s = Math.min(cssW / W, cssH / H);
    if (s < 0.78) s = Math.min(cssH / H, cssW / (W * 0.72), 0.78);
    this.s = s;
    const cw = Math.min(cssW, W * s), ch = H * s;
    this.cssW = cw; this.cssH = ch;
    this.vw = cw / s;
    this.cv.style.width = cw + 'px'; this.cv.style.height = ch + 'px';
    this.cv.width = Math.round(cw * dpr); this.cv.height = Math.round(ch * dpr);
    this.dpr = dpr;
    this.labelPx = Math.max(11, Math.min(15, 11 * s));
  }
  toWorld(cx, cy) { return { x: cx / this.s + this.camX, y: cy / this.s }; }
  toScreen(x, y) { return { x: (x - this.camX) * this.s, y: y * this.s }; }

  // ---------------------------------------------------------------- effects from game events
  event(e, g) {
    const R = Math.random;
    switch (e.t) {
      case 'hit': {
        const col = COL[e.kind] || '#fff';
        this.burst(e.x, e.y, col, e.big ? 9 : 5, 180);
        this.fx.push({ k: 'spark', x: e.x, y: e.y, t: 0, life: 0.16, a: R() * 6 });
        this.shake = Math.max(this.shake, e.big ? 5 : 3);
        break;
      }
      case 'kill': {
        const col = COL[e.kind] || '#fff';
        this.burst(e.x, e.y, col, e.kind === 'boss' ? 40 : 14, e.kind === 'boss' ? 380 : 260);
        this.burst(e.x, e.y, '#ffd23f', 5, 200);
        this.fx.push({ k: 'pow', x: e.x, y: e.y - 6, t: 0, life: 0.5, word: e.kind === 'boss' ? 'K.O.!' : POWS[(R() * POWS.length) | 0], rot: (R() - 0.5) * 0.5, big: e.kind === 'boss' || e.elite });
        this.shake = Math.max(this.shake, e.kind === 'boss' ? 16 : 7);
        if (e.chat) this.fx.push({ k: 'float', x: e.x, y: e.y - 20, t: 0, life: 1.1, text: 'bye ' + e.chat, col: '#fff', small: true });
        break;
      }
      case 'hurt': this.flash = 0.35; this.flashCol = '#ff2d55'; this.shake = Math.max(this.shake, 10); this.burst(e.x, e.y, '#ff2d55', 10, 220); this.fx.push({ k: 'float', x: e.x, y: e.y - 18, t: 0, life: 0.9, text: '−1', col: '#ff2d55' }); break;
      case 'block': this.fx.push({ k: 'float', x: e.x, y: e.y - 18, t: 0, life: 0.9, text: 'BLOCKED', col: '#6fb8ff' }); this.burst(e.x, e.y, '#6fb8ff', 10, 200); this.shake = Math.max(this.shake, 4); break;
      case 'swing': this.fx.push({ k: 'swing', x: e.x, y: e.y, a: e.a, t: 0, life: 0.18, spin: e.spin }); break;
      case 'dash': this.fx.push({ k: 'dust', x: e.x, y: e.y + 6, t: 0, life: 0.3 }); break;
      case 'summon': this.fx.push({ k: 'summon', x: e.x, y: e.y, t: 0, life: 0.75, chat: e.chat }); break;
      case 'appear': this.burst(e.x, e.y, e.chat ? '#ffffff' : '#ffd23f', 8, 160); break;
      case 'spike': this.shake = Math.max(this.shake, 3); break;
      case 'slam': this.slams.push({ x: e.x, y: e.y, r: e.r, t: 0 }); this.shake = Math.max(this.shake, 14); this.burst(e.x, e.y, '#c79a63', 18, 300); break;
      case 'thud': this.shake = Math.max(this.shake, 12); this.fx.push({ k: 'pow', x: e.x, y: e.y - 30, t: 0, life: 0.6, word: 'THUD', rot: -0.2, big: true }); break;
      case 'roar': this.shake = Math.max(this.shake, 10); this.fx.push({ k: 'pow', x: e.x, y: e.y - 50, t: 0, life: 0.9, word: 'ROAR', rot: 0.12, big: true }); break;
      case 'parry': this.burst(e.x, e.y, '#fff', 6, 200); this.fx.push({ k: 'float', x: e.x, y: e.y - 10, t: 0, life: 0.6, text: 'SWAT', col: '#fff', small: true }); break;
      case 'poof': this.burst(e.x, e.y, '#ffffff', 3, 90); break;
      case 'splat': this.burst(e.x, e.y + 8, '#ff6fae', e.small ? 2 : 4, 70); break;
      case 'chest': this.burst(e.x, e.y, '#ffd23f', 18, 240); break;
      case 'relic': this.fx.push({ k: 'float', x: e.x, y: e.y - 20, t: 0, life: 1.6, text: RELICS[e.relic].name.toUpperCase() + '!', col: '#ffd23f' }); this.burst(e.x, e.y, '#ffd23f', 16, 220); break;
      case 'heart': this.fx.push({ k: 'float', x: e.x, y: e.y - 16, t: 0, life: 0.9, text: '+1', col: '#7ee05a' }); break;
      case 'shrine': this.fx.push({ k: 'float', x: e.x, y: e.y - 30, t: 0, life: 1.4, text: e.healed ? '+' + e.healed + ' HEARTS' : 'ALREADY FULL', col: '#7ee05a' }); this.burst(e.x, e.y, '#7ee05a', 16, 200); break;
      case 'bless': { const p = g.p; this.fx.push({ k: 'float', x: p.x, y: p.y - 24, t: 0, life: 1.2, text: e.kind === 'heal' ? '+1 from ' + e.user : 'SHIELD from ' + e.user, col: '#7ee05a', small: true }); this.burst(p.x, p.y, '#b7ffb0', 10, 140); break; }
      case 'curse': { const p = g.p; this.fx.push({ k: 'float', x: p.x, y: p.y - 24, t: 0, life: 1.4, text: 'CURSED by ' + e.user, col: '#ff5d8f', small: true }); this.burst(p.x, p.y, '#b14bff', 12, 160); this.flash = 0.25; this.flashCol = '#7a2bff'; break; }
      case 'fizzle': { const p = g.p; this.fx.push({ k: 'float', x: p.x, y: p.y - 24, t: 0, life: 1.2, text: 'FIZZLE (nice hat)', col: '#ffd23f', small: true }); break; }
      case 'die': this.shake = 18; this.flash = 0.6; this.flashCol = '#ff2d55'; this.burst(g.p.x, g.p.y, COL.player, 24, 300); break;
      case 'win': this.flash = 0.8; this.flashCol = '#fff'; break;
      case 'room': this.fx = []; this.parts = []; this.slams = []; this.camX = Math.max(0, Math.min(W - this.vw, g.p.x - this.vw / 2)); break;
    }
  }
  burst(x, y, col, n, sp) {
    if (this.reduced) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = sp * (0.35 + Math.random() * 0.75);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.35 + Math.random() * 0.35, r: 3 + Math.random() * 4, col, rot: Math.random() * 6, tri: Math.random() < 0.5 });
    }
  }

  // ---------------------------------------------------------------- frame
  frame(g, dt, ui = {}) {
    const ctx = this.ctx, s = this.s, dpr = this.dpr;
    this.time += dt;
    this.bf = Math.floor(this.time * 6) % 3;
    const p = g.p;
    if (this.vw < W) {
      const want = Math.max(0, Math.min(W - this.vw, p.x - this.vw / 2));
      this.camX = lerp(this.camX, want, Math.min(1, dt * 6));
    } else this.camX = (W - this.vw) / 2;
    let sx = 0, sy = 0;
    if (this.shake > 0.2 && !this.reduced) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; }
    this.shake *= Math.pow(0.002, dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (sx - this.camX * s), dpr * sy);
    const pal = PALETTES[g.room.type === 'tutorial' ? 'tutorial' : g.room.type === 'boss' ? 5 : Math.min(5, g.floor)];
    this.drawRoom(ctx, g, pal);
    this.drawProps(ctx, g, ui);
    // shadows, then bodies sorted by y
    const bodies = [...g.ents, p].sort((a, b) => a.y - b.y);
    ctx.fillStyle = 'rgba(29,16,41,.18)';
    for (const b of bodies) { ctx.beginPath(); ctx.ellipse(b.x, b.y + b.r * 0.85, b.r * 0.95, b.r * 0.38, 0, 0, Math.PI * 2); ctx.fill(); }
    for (const b of bodies) b === p ? this.drawPlayer(ctx, g, p) : this.drawEnemy(ctx, g, b);
    this.drawShots(ctx, g);
    this.drawFx(ctx, g, dt);
    this.drawTags(ctx, g);
    if (g.curse?.kind === 'fog') this.drawFog(ctx, g);
    this.drawVote(ctx, g);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.vw < W) this.drawPips(ctx, g);
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.5, this.flash) * (this.reduced ? 0.4 : 1);
      ctx.fillStyle = this.flashCol; ctx.fillRect(0, 0, this.cssW, this.cssH);
      ctx.globalAlpha = 1; this.flash -= dt * 1.6;
    }
  }

  // a wobbly closed shape: n jittered points smoothed through their midpoints
  blob(ctx, x, y, rx, ry, seed, amp = 0.06, n = 11) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, j = 1 + amp * (hash(seed * 13.1 + i * 7.7 + this.bf * 101.3) - 0.5) * 2;
      pts.push([x + Math.cos(a) * rx * j, y + Math.sin(a) * ry * j]);
    }
    ctx.beginPath();
    const m0 = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    ctx.closePath();
  }
  wob(seed, k = 1.2) { return (hash(seed * 3.7 + this.bf * 17.9) - 0.5) * 2 * k; }
  ink(ctx, fill, lw = 3) { if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  // a wobbly rectangle
  rect(ctx, x, y, w, h, seed, k = 1.3) {
    ctx.beginPath();
    ctx.moveTo(x + this.wob(seed, k), y + this.wob(seed + 1, k));
    ctx.lineTo(x + w + this.wob(seed + 2, k), y + this.wob(seed + 3, k));
    ctx.lineTo(x + w + this.wob(seed + 4, k), y + h + this.wob(seed + 5, k));
    ctx.lineTo(x + this.wob(seed + 6, k), y + h + this.wob(seed + 7, k));
    ctx.closePath();
  }

  drawRoom(ctx, g, pal) {
    // floor checker
    for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
      ctx.fillStyle = (r + c) % 2 ? pal.a : pal.b;
      ctx.fillRect(c * T, r * T, T, T);
    }
    // little floor scuffs
    ctx.strokeStyle = 'rgba(29,16,41,.10)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const x = T * 1.3 + hash(g.seed + i * 3 + g.roomIdx * 50 + g.floor * 7) * (W - T * 2.6), y = T * 1.3 + hash(g.seed + i * 5 + 1 + g.roomIdx * 50 + g.floor * 9) * (H - T * 2.6);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 7, y - 2); ctx.stroke();
    }
    // walls: one thick band
    ctx.fillStyle = pal.wall;
    ctx.fillRect(0, 0, W, T); ctx.fillRect(0, H - T, W, T); ctx.fillRect(0, 0, T, H); ctx.fillRect(W - T, 0, T, H);
    // brick lines on the top wall
    ctx.strokeStyle = 'rgba(29,16,41,.28)'; ctx.lineWidth = 2;
    for (let r = 0; r < 2; r++) for (let c = 0; c < COLS * 2; c++) {
      const x = c * T / 2 + (r % 2) * T / 4, y = r * T / 2;
      ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.lineTo(x, y + T / 2 - 3); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, T / 2); ctx.lineTo(W, T / 2); ctx.stroke();
    // inner ink rim around the floor
    this.rect(ctx, T, T, W - 2 * T, H - 2 * T, 999, 1.2);
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    // bottom entry arch (decor)
    ctx.fillStyle = INK; ctx.fillRect(W / 2 - T + 6, H - T + 8, 2 * T - 12, T - 8);
    // obstacles: chunky blocks with a lit top
    for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
      if (!g.solidAt(c, r)) continue;
      const x = c * T, y = r * T;
      this.rect(ctx, x + 2, y + 4, T - 4, T - 4, c * 31 + r * 7); this.ink(ctx, pal.wall, 3);
      this.rect(ctx, x + 2, y - 2, T - 4, T - 12, c * 31 + r * 7 + 50); this.ink(ctx, pal.ob, 3);
    }
    // doors
    const rm = g.room;
    rm.doors.forEach((d, i) => this.drawDoor(ctx, g, d, i, pal));
  }

  drawDoor(ctx, g, d, i, pal) {
    const rm = g.room, x = d.c0 * T + 4, w = 2 * T - 8, y = 4, h = T + 2;
    const open = g.doorOpen(i);
    const voting = rm.phase === 'vote' || rm.phase === 'tutorialVote';
    const chosen = rm.choice === i, lost = rm.next === 'fork' && rm.choice >= 0 && !chosen;
    this.rect(ctx, x, y, w, h, 400 + i * 9, 0.8);
    if (open) { this.ink(ctx, INK, 4); }
    else {
      this.ink(ctx, lost ? '#8a7a8c' : '#b8743c', 4);
      ctx.strokeStyle = 'rgba(29,16,41,.45)'; ctx.lineWidth = 2;
      for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + k * w / 4, y + 4); ctx.lineTo(x + k * w / 4, y + h - 3); ctx.stroke(); }
      if (lost) { // boarded up
        ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x + 4, y + 8); ctx.lineTo(x + w - 4, y + h - 8); ctx.moveTo(x + w - 4, y + 8); ctx.lineTo(x + 4, y + h - 8); ctx.stroke();
        ctx.lineWidth = 3.5; ctx.strokeStyle = '#d9c2a0'; ctx.stroke();
      }
    }
    // sign with the room type
    const type = d.type;
    if (type) {
      const cx = x + w / 2, cy = y + h / 2 + 1;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.wob(i * 5 + 3, 0.03));
      this.rect(ctx, -22, -14, 44, 28, 700 + i, 0.8); this.ink(ctx, open ? '#ffd23f' : CREAM, 3);
      this.icon(ctx, DOOR_ICON[type], 0, 0, 11);
      ctx.restore();
    }
    // lock while monsters are about
    if (!open && !lost && (rm.phase === 'open' || voting) && (g.ents.length || g.pending.length) && (!voting || rm.choice < 0)) {
      if (rm.phase === 'open' && (rm.next !== 'fork' || chosen)) {
        const cx = x + w / 2, cy = y + h + 12;
        ctx.beginPath(); ctx.arc(cx, cy - 7, 6, Math.PI, 0); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
        this.rect(ctx, cx - 9, cy - 7, 18, 14, 800 + i, 0.6); this.ink(ctx, '#ffd23f', 3);
      }
    }
  }

  icon(ctx, kind, x, y, s) {
    ctx.save(); ctx.translate(x, y);
    ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    switch (kind) {
      case 'swords':
        for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-s * 0.8 * k, s * 0.8); ctx.lineTo(s * 0.8 * k, -s * 0.8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.85 * k + k * 4, s * 0.45); ctx.lineTo(-s * 0.4 * k, s * 0.9); ctx.stroke(); }
        break;
      case 'crown':
        ctx.beginPath(); ctx.moveTo(-s, s * 0.6); ctx.lineTo(-s, -s * 0.4); ctx.lineTo(-s * 0.5, s * 0.1); ctx.lineTo(0, -s * 0.8); ctx.lineTo(s * 0.5, s * 0.1); ctx.lineTo(s, -s * 0.4); ctx.lineTo(s, s * 0.6); ctx.closePath();
        ctx.fillStyle = '#ff5d8f'; ctx.fill(); ctx.stroke(); break;
      case 'chest':
        ctx.beginPath(); ctx.rect(-s, -s * 0.5, s * 2, s * 1.2); ctx.fillStyle = '#c47a3a'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-s, -s * 0.05); ctx.lineTo(s, -s * 0.05); ctx.stroke();
        ctx.beginPath(); ctx.rect(-2.5, -s * 0.25, 5, 6); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.stroke(); break;
      case 'heart': this.heartPath(ctx, 0, 1, s * 1.05); ctx.fillStyle = '#ff4f6d'; ctx.fill(); ctx.stroke(); break;
      case 'stairs':
        ctx.beginPath(); ctx.moveTo(-s, s * 0.8); ctx.lineTo(-s, s * 0.2); ctx.lineTo(-s * 0.35, s * 0.2); ctx.lineTo(-s * 0.35, -s * 0.3); ctx.lineTo(s * 0.3, -s * 0.3); ctx.lineTo(s * 0.3, -s * 0.8); ctx.lineTo(s, -s * 0.8); ctx.lineTo(s, s * 0.8); ctx.closePath();
        ctx.fillStyle = '#9d78ff'; ctx.fill(); ctx.stroke(); break;
      case 'skull':
        ctx.beginPath(); ctx.arc(0, -s * 0.15, s * 0.85, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-s * 0.32, -s * 0.15, s * 0.22, 0, 7); ctx.arc(s * 0.32, -s * 0.15, s * 0.22, 0, 7); ctx.fill(); break;
    }
    ctx.restore();
  }
  heartPath(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.75);
    ctx.bezierCurveTo(x - s * 1.25, y - s * 0.1, x - s * 0.55, y - s * 1.05, x, y - s * 0.4);
    ctx.bezierCurveTo(x + s * 0.55, y - s * 1.05, x + s * 1.25, y - s * 0.1, x, y + s * 0.75);
    ctx.closePath();
  }

  drawProps(ctx, g, ui) {
    const rm = g.room, t = this.time;
    // tutorial: spike strips and the target marker
    for (const s of g.spikes) {
      for (let x = s.x0 + 4; x < s.x1 - 4; x += 14) {
        ctx.beginPath(); ctx.moveTo(x, s.y1 - 4); ctx.lineTo(x + 7, s.y0 + 4 + this.wob(x, 1)); ctx.lineTo(x + 14, s.y1 - 4); ctx.closePath();
        this.ink(ctx, '#d8dde8', 2.5);
      }
    }
    if (ui.marker) {
      const m = ui.marker, k = 1 + Math.sin(t * 5) * 0.08;
      ctx.save(); ctx.translate(m.x, m.y); ctx.scale(k, k * 0.55);
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,210,63,.45)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.setLineDash([8, 7]); ctx.lineDashOffset = -t * 30; ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.lineCap = 'round';
      const b = Math.sin(t * 6) * 4;
      ctx.beginPath(); ctx.moveTo(m.x, m.y - 46 + b); ctx.lineTo(m.x, m.y - 22 + b); ctx.moveTo(m.x - 8, m.y - 30 + b); ctx.lineTo(m.x, m.y - 20 + b); ctx.lineTo(m.x + 8, m.y - 30 + b); ctx.stroke();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffd23f'; ctx.stroke();
    }
    // traps
    for (const tr of g.traps) {
      if (tr.t > 0) {
        const k = 1 - tr.t / 1.05;
        ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,45,85,${0.12 + k * 0.25})`; ctx.fill();
        ctx.setLineDash([6, 5]); ctx.lineDashOffset = t * 40; ctx.lineWidth = 3; ctx.strokeStyle = '#ff2d55'; ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r * k, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,45,85,.9)'; ctx.stroke();
      } else {
        const up = Math.min(1, tr.up / 0.2);
        for (let i = 0; i < 7; i++) {
          const a = i / 7 * Math.PI * 2, rr = i === 0 ? 0 : tr.r * 0.55, x = tr.x + Math.cos(a) * rr, y = tr.y + Math.sin(a) * rr * 0.7;
          ctx.beginPath(); ctx.moveTo(x - 7, y + 6); ctx.lineTo(x, y + 6 - 22 * up); ctx.lineTo(x + 7, y + 6); ctx.closePath(); this.ink(ctx, '#e9edf5', 2.5);
        }
      }
    }
    // chest, shrine
    if (rm.chest) {
      const c = rm.chest;
      ctx.save(); ctx.translate(c.x, c.y);
      this.rect(ctx, -22, -6, 44, 26, 61); this.ink(ctx, '#c47a3a', 3.5);
      if (c.open) { this.rect(ctx, -22, -26, 44, 14, 62); this.ink(ctx, '#a8622b', 3.5); ctx.fillStyle = INK; ctx.fillRect(-18, -8, 36, 4); }
      else {
        this.rect(ctx, -22, -18, 44, 14, 63); this.ink(ctx, '#d98b47', 3.5);
        this.rect(ctx, -5, -8, 10, 10, 64, 0.5); this.ink(ctx, '#ffd23f', 2.5);
        if (Math.sin(t * 4) > 0.6) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(14, -20, 3, 0, 7); ctx.fill(); }
      }
      ctx.restore();
    }
    if (rm.shrine) {
      const sh = rm.shrine;
      ctx.save(); ctx.translate(sh.x, sh.y);
      this.blob(ctx, 0, 8, 32, 18, 71, 0.05); this.ink(ctx, '#bdb3d6', 3.5);
      this.blob(ctx, 0, 4, 24, 11, 72, 0.06); this.ink(ctx, sh.used ? '#8c86a3' : '#6fd8ff', 3);
      if (!sh.used) { this.heartPath(ctx, 0, -18 + Math.sin(t * 3) * 4, 11); this.ink(ctx, '#ff4f6d', 3); }
      ctx.restore();
    }
    // pickups
    for (const k of g.pickups) {
      const bob = Math.sin(t * 4 + k.x) * 3;
      if (k.kind === 'heart') { this.heartPath(ctx, k.x, k.y + bob, 9); this.ink(ctx, '#ff4f6d', 3); }
      else {
        ctx.save(); ctx.translate(k.x, k.y + bob);
        ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + t, r = i % 2 ? 14 : 22; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath();
        ctx.fillStyle = 'rgba(255,210,63,.55)'; ctx.fill();
        this.relicIcon(ctx, k.relic, 0, 0, 11);
        ctx.restore();
      }
    }
    // summoning circles
    for (const s of g.pending) {
      const k = 1 - s.t / 0.75;
      ctx.save(); ctx.translate(s.x, s.y);
      ctx.rotate(t * 3);
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.setLineDash([5, 5]); ctx.lineWidth = 3; ctx.strokeStyle = s.chat ? '#fff' : INK; ctx.stroke(); ctx.setLineDash([]);
      ctx.rotate(-t * 3);
      ctx.beginPath(); ctx.arc(0, 0, 20 * k, 0, Math.PI * 2); ctx.fillStyle = s.chat ? 'rgba(255,255,255,.35)' : 'rgba(29,16,41,.25)'; ctx.fill();
      ctx.restore();
    }
    // boss slam telegraph
    for (const e of g.ents) {
      if (e.kind !== 'boss') continue;
      if (e.st === 'slamWind') {
        const k = 1 - e.st2 / 0.85;
        ctx.beginPath(); ctx.arc(e.x, e.y, 118, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,45,85,${0.08 + 0.2 * k})`; ctx.fill();
        ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.strokeStyle = '#ff2d55'; ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(e.x, e.y, 118 * k, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.stroke();
      }
      if (e.st === 'chargeWind') {
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.atan2(e.ay, e.ax));
        ctx.fillStyle = 'rgba(255,45,85,.22)'; ctx.fillRect(0, -e.r, 640, e.r * 2);
        ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.strokeStyle = '#ff2d55'; ctx.strokeRect(0, -e.r, 640, e.r * 2); ctx.setLineDash([]);
        ctx.restore();
      }
    }
    for (const sl of this.slams) {
      const k = sl.t / 0.35;
      ctx.beginPath(); ctx.arc(sl.x, sl.y, sl.r * Math.min(1, k * 1.2), 0, Math.PI * 2); ctx.lineWidth = 10 * (1 - k); ctx.strokeStyle = CREAM; ctx.stroke();
    }
  }

  relicIcon(ctx, kind, x, y, s) {
    ctx.save(); ctx.translate(x, y);
    switch (kind) {
      case 'sword': ctx.rotate(-0.8); this.rect(ctx, -3, -s * 1.3, 6, s * 1.7, 81, 0.4); this.ink(ctx, '#e9edf5', 2.5); this.rect(ctx, -8, s * 0.35, 16, 4, 82, 0.3); this.ink(ctx, '#ffd23f', 2.5); this.rect(ctx, -2.5, s * 0.4 + 4, 5, 8, 83, 0.3); this.ink(ctx, '#b8743c', 2.5); break;
      case 'heart': this.rect(ctx, -s * 0.8, -s, s * 1.6, s * 2, 84, 0.5); this.ink(ctx, '#bfe9ff', 2.5); this.heartPath(ctx, 0, 1, s * 0.6); this.ink(ctx, '#ff4f6d', 2); break;
      case 'boots': this.blob(ctx, -1, 0, s * 0.6, s, 85, 0.05, 8); this.ink(ctx, '#ff8a3d', 2.5); this.blob(ctx, 4, s * 0.7, s * 0.8, s * 0.35, 86, 0.05, 8); this.ink(ctx, '#ff8a3d', 2.5); break;
      case 'spin': ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0.3, Math.PI * 1.85); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#4ce0d2'; ctx.stroke(); break;
      case 'hat': ctx.beginPath(); ctx.moveTo(-s * 1.1, s * 0.5); ctx.lineTo(s * 1.1, s * 0.5); ctx.lineTo(s * 0.3, -s * 1.1); ctx.lineTo(-s * 0.4, -s * 0.2); ctx.closePath(); this.ink(ctx, '#7ee05a', 2.5); ctx.beginPath(); ctx.arc(s * 0.3, -s * 1.1, 3, 0, 7); this.ink(ctx, '#ffd23f', 2); break;
      case 'cape': ctx.beginPath(); ctx.moveTo(-s * 0.6, -s); ctx.lineTo(s * 0.6, -s); ctx.lineTo(s, s); for (let i = 0; i < 4; i++) { ctx.lineTo(s - (i + 0.5) * s / 2, s * 0.6); ctx.lineTo(s - (i + 1) * s / 2, s); } ctx.closePath(); this.ink(ctx, '#b14bff', 2.5); break;
    }
    ctx.restore();
  }

  drawPlayer(ctx, g, p) {
    const t = this.time;
    if (g.over === 'dead') return;
    if (p.inv > 0 && p.dashT <= 0 && Math.floor(t * 18) % 2 === 0) return;
    const moving = Math.hypot(p.vx, p.vy) > 20;
    const bob = moving ? Math.abs(Math.sin(p.walk * 0.09)) * 3 : Math.sin(t * 3) * 1;
    const sq = p.dashT > 0 ? 0.82 : 1;
    const x = p.x, y = p.y - bob;
    // dash smear
    if (p.dashT > 0) {
      for (let i = 1; i <= 3; i++) { ctx.globalAlpha = 0.18 * (4 - i) / 3; this.blob(ctx, x - p.dx * i * 10, y - p.dy * i * 10, 13, 13, 5, 0.05); ctx.fillStyle = COL.player; ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // sword at rest
    const fa = Math.atan2(p.fy, p.fx);
    if (p.swingT <= 0) {
      ctx.save(); ctx.translate(x + Math.cos(fa + 1.3) * 12, y + 2 + Math.sin(fa + 1.3) * 8); ctx.rotate(fa - 0.2);
      this.rect(ctx, 0, -2.5, 18, 5, 21, 0.4); this.ink(ctx, '#e9edf5', 2.5);
      ctx.restore();
    }
    const tint = g.curse?.kind === 'slippery' ? '#f2d64b' : COL.player;
    this.blob(ctx, x, y, 13 * (2 - sq), 13 * sq, 3, 0.05); this.ink(ctx, tint, 3);
    // face toward facing
    const ex = p.fx * 4.5, ey = p.fy * 3 - 2;
    this.blob(ctx, x + ex, y + ey + 1, 8.5, 6.5, 4, 0.06, 9); this.ink(ctx, CREAM, 2);
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(x + ex - 3, y + ey, 1.6, 2.4, 0, 0, 7); ctx.ellipse(x + ex + 3, y + ey, 1.6, 2.4, 0, 0, 7); ctx.fill();
    // headset
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(x, y - 1, 13.5, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
    for (const k of [-1, 1]) { this.blob(ctx, x + k * 13, y - 1, 4, 5.5, 6 + k, 0.08, 7); this.ink(ctx, '#ff5d8f', 2.5); }
    ctx.beginPath(); ctx.moveTo(x - 13, y + 2); ctx.quadraticCurveTo(x - 12, y + 9, x - 5, y + 8); ctx.lineWidth = 2; ctx.stroke();
    // shield bubble
    if (p.shield) { ctx.beginPath(); ctx.arc(x, y, 19 + Math.sin(t * 6), 0, Math.PI * 2); ctx.fillStyle = 'rgba(111,184,255,.2)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#6fb8ff'; ctx.stroke(); }
    if (g.curse?.kind === 'backwards') { ctx.save(); ctx.translate(x, y - 26); ctx.rotate(-t * 4); ctx.beginPath(); ctx.arc(0, 0, 6, 0.4, Math.PI * 1.7); ctx.lineWidth = 3; ctx.strokeStyle = '#b14bff'; ctx.stroke(); ctx.restore(); }
  }

  drawEnemy(ctx, g, e) {
    const t = this.time, sd = e.seed % 97;
    let x = e.x, y = e.y;
    const flash = e.flash > 0;
    const col = flash ? '#ffffff' : COL[e.kind];
    if ((e.st === 'wind' || e.st === 'aim') && !this.reduced) { x += (Math.random() - 0.5) * 3; }
    const lw = e.elite ? 4 : 3;
    switch (e.kind) {
      case 'goblin': {
        const lunge = e.st === 'lunge', sx = lunge ? 1.2 : 1, sy = lunge ? 0.85 : 1;
        for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + k * e.r * 0.6, y - e.r * 0.4); ctx.lineTo(x + k * e.r * 1.5, y - e.r * 0.9 + this.wob(sd + k, 1)); ctx.lineTo(x + k * e.r * 0.8, y + e.r * 0.1); ctx.closePath(); this.ink(ctx, col, lw - 0.5); }
        this.blob(ctx, x, y, e.r * sx, e.r * sy, sd, 0.07); this.ink(ctx, e.st === 'wind' && !flash ? '#c3f05a' : col, lw);
        this.eyes(ctx, g, e, x, y - 2, true);
        ctx.beginPath(); ctx.moveTo(x - 5, y + 5); ctx.lineTo(x + 5, y + 5); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillRect(x - 3.5, y + 5.5, 2.5, 3); ctx.fillRect(x + 1, y + 5.5, 2.5, 3);
        break;
      }
      case 'bat': {
        const f = Math.sin(t * 22 + sd) * 0.7;
        for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + k * 4, y - 2); ctx.lineTo(x + k * 20, y - 8 - f * 8 * k * k); ctx.lineTo(x + k * 15, y + 2); ctx.lineTo(x + k * 9, y - 1); ctx.closePath(); this.ink(ctx, flash ? '#fff' : '#6c43d9', 2.5); }
        this.blob(ctx, x, y, e.r, e.r, sd, 0.08, 9); this.ink(ctx, col, lw);
        this.eyes(ctx, g, e, x, y - 1, true, 0.75);
        break;
      }
      case 'slime': case 'minislime': {
        const hop = e.st === 'hop' ? Math.sin((1 - e.st2 / 0.36) * Math.PI) : 0;
        const squash = e.st === 'hop' ? 0.9 : 1 + Math.sin(t * 5 + sd) * 0.05;
        const yy = y - hop * 10;
        ctx.globalAlpha = 0.92;
        this.blob(ctx, x, yy + e.r * 0.1, e.r * (2 - squash), e.r * squash * 0.9, sd, 0.06); this.ink(ctx, col, lw);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(x - e.r * 0.4, yy - e.r * 0.35, e.r * 0.22, e.r * 0.13, -0.5, 0, 7); ctx.fill();
        this.eyes(ctx, g, e, x, yy, false, e.kind === 'slime' ? 1 : 0.7);
        break;
      }
      case 'skeleton': {
        const a = Math.atan2(g.p.y - y, g.p.x - x);
        // bow
        ctx.save(); ctx.translate(x + Math.cos(a) * 14, y + Math.sin(a) * 14); ctx.rotate(a);
        ctx.beginPath(); ctx.arc(-6, 0, 11, -1.2, 1.2); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#b8743c'; ctx.stroke();
        const pull = e.st === 'aim' ? 6 * (1 - e.st2 / 0.55) : 0;
        ctx.beginPath(); ctx.moveTo(-6 + Math.cos(-1.2) * 11, Math.sin(-1.2) * 11); ctx.lineTo(-pull - 2, 0); ctx.lineTo(-6 + Math.cos(1.2) * 11, Math.sin(1.2) * 11); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
        ctx.restore();
        this.blob(ctx, x, y, e.r, e.r * 1.05, sd, 0.05); this.ink(ctx, col, lw);
        ctx.fillStyle = e.st === 'aim' ? '#ff2d55' : INK;
        ctx.beginPath(); ctx.arc(x - 4.5, y - 1, 3.3, 0, 7); ctx.arc(x + 4.5, y - 1, 3.3, 0, 7); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.beginPath(); for (let i = -2; i <= 2; i++) { ctx.moveTo(x + i * 2.5, y + 5); ctx.lineTo(x + i * 2.5, y + 8.5); } ctx.stroke();
        if (e.st === 'aim') { ctx.save(); ctx.globalAlpha = 0.5; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 120, y + Math.sin(a) * 120); ctx.lineWidth = 2; ctx.strokeStyle = '#ff2d55'; ctx.stroke(); ctx.restore(); }
        break;
      }
      case 'dummy': {
        const w = (e.wob || 0) * Math.sin(t * 30) * 0.25;
        ctx.save(); ctx.translate(x, y + 10); ctx.rotate(w);
        ctx.fillStyle = INK; ctx.fillRect(-2.5, -4, 5, 16);
        this.blob(ctx, 0, -14, 14, 16, 91, 0.05); this.ink(ctx, flash ? '#fff' : COL.dummy, 3);
        ctx.beginPath(); ctx.arc(0, -14, 8, 0, 7); ctx.lineWidth = 3; ctx.strokeStyle = '#ff4f6d'; ctx.stroke(); ctx.beginPath(); ctx.arc(0, -14, 3, 0, 7); ctx.fillStyle = '#ff4f6d'; ctx.fill();
        ctx.restore();
        break;
      }
      case 'boss': this.drawBoss(ctx, g, e, col); break;
    }
    if (e.elite) { // crown
      const cy = y - e.r - 2;
      ctx.beginPath(); ctx.moveTo(x - 9, cy + 4); ctx.lineTo(x - 10, cy - 6); ctx.lineTo(x - 4, cy - 1); ctx.lineTo(x, cy - 9); ctx.lineTo(x + 4, cy - 1); ctx.lineTo(x + 10, cy - 6); ctx.lineTo(x + 9, cy + 4); ctx.closePath();
      this.ink(ctx, '#ffd23f', 2.5);
    }
    // hp pips for tough ones
    if ((e.elite || e.kind === 'slime') && e.hp < e.max && e.kind !== 'boss') {
      const w = 26, k = e.hp / e.max;
      ctx.fillStyle = INK; ctx.fillRect(x - w / 2 - 1.5, y + e.r + 5, w + 3, 6);
      ctx.fillStyle = '#ff4f6d'; ctx.fillRect(x - w / 2, y + e.r + 6.5, w * k, 3);
    }
  }

  eyes(ctx, g, e, x, y, angry, k = 1) {
    const a = Math.atan2(g.p.y - y, g.p.x - x), lx = Math.cos(a) * 1.6 * k, ly = Math.sin(a) * 1.6 * k;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(x + s * 4.5 * k, y, 3.4 * k, 3.8 * k, 0, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.arc(x + s * 4.5 * k + lx, y + ly, 1.7 * k, 0, 7); ctx.fillStyle = INK; ctx.fill();
      if (angry) { ctx.beginPath(); ctx.moveTo(x + s * 8 * k, y - 5 * k); ctx.lineTo(x + s * 1.5 * k, y - 3 * k); ctx.lineWidth = 2.4; ctx.stroke(); }
    }
  }

  drawBoss(ctx, g, e, col) {
    const t = this.time, x = e.x, y = e.y, r = e.r;
    const raise = e.st === 'slamWind' ? 1 - e.st2 / 0.85 : 0;
    const a = Math.atan2(g.p.y - y, g.p.x - x);
    // hammer
    const ha = e.st === 'slamWind' ? -Math.PI / 2 - 0.4 * raise : e.st === 'rest' ? Math.PI / 2 : a + 0.9;
    ctx.save(); ctx.translate(x + 26, y - 4); ctx.rotate(ha);
    this.rect(ctx, 0, -3.5, 46, 7, 301, 0.5); this.ink(ctx, '#b8743c', 3);
    this.rect(ctx, 38, -15, 22, 30, 302, 0.8); this.ink(ctx, '#9aa3b5', 3.5);
    ctx.save(); ctx.translate(49, 0); ctx.rotate(Math.PI / 2); ctx.font = '700 8px Bungee, sans-serif'; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BAN', 0, 0.5); ctx.restore();
    ctx.restore();
    // horns
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + k * r * 0.45, y - r * 0.7); ctx.quadraticCurveTo(x + k * r * 1.05, y - r * 1.05, x + k * r * 0.9, y - r * 1.45); ctx.quadraticCurveTo(x + k * r * 0.7, y - r * 1.0, x + k * r * 0.15, y - r * 0.85); ctx.closePath(); this.ink(ctx, CREAM, 3); }
    const wob = e.st === 'charge' ? 1.12 : 1;
    this.blob(ctx, x, y, r * wob, r / wob, 300, 0.05, 14); this.ink(ctx, e.st === 'dizzy' && !e.flash ? '#ff8a7f' : col, 4.5);
    // belly
    this.blob(ctx, x, y + r * 0.35, r * 0.6, r * 0.45, 303, 0.05); this.ink(ctx, e.flash ? '#fff' : '#ffb3a3', 3);
    // face
    if (e.st === 'dizzy') {
      ctx.lineWidth = 3; ctx.strokeStyle = INK;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * 10 - 4, y - 12); ctx.lineTo(x + s * 10 + 4, y - 4); ctx.moveTo(x + s * 10 + 4, y - 12); ctx.lineTo(x + s * 10 - 4, y - 4); ctx.stroke(); }
      for (let i = 0; i < 3; i++) { const aa = t * 4 + i * 2.1; this.star(ctx, x + Math.cos(aa) * 30, y - r - 6 + Math.sin(aa) * 8, 6); }
    } else {
      const ex = Math.cos(a) * 2, ey = Math.sin(a) * 2;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(x + s * 10, y - 8, 6, 6.5, 0, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
        ctx.beginPath(); ctx.arc(x + s * 10 + ex, y - 8 + ey, 3, 0, 7); ctx.fillStyle = INK; ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + s * 17, y - 18); ctx.lineTo(x + s * 4, y - 14); ctx.lineWidth = 4; ctx.stroke();
      }
    }
    // underbite tusks
    ctx.beginPath(); ctx.moveTo(x - 12, y + 6); ctx.quadraticCurveTo(x, y + 12, x + 12, y + 6); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * 8, y + 8); ctx.lineTo(x + s * 10, y - 1); ctx.lineTo(x + s * 12, y + 7); ctx.closePath(); this.ink(ctx, CREAM, 2); }
  }
  star(ctx, x, y, s) {
    ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? s * 0.45 : s; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath();
    this.ink(ctx, '#ffd23f', 2);
  }

  drawShots(ctx, g) {
    for (const s of g.shots) {
      if (s.kind === 'arrow') {
        const a = Math.atan2(s.vy, s.vx);
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(4, 0); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#d9b07a'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(1, -5); ctx.lineTo(1, 5); ctx.closePath(); this.ink(ctx, '#e9edf5', 2);
        ctx.restore();
      } else { this.blob(ctx, s.x, s.y, s.r + 1, s.r + 1, 5 + (s.t * 10 | 0), 0.12, 7); this.ink(ctx, '#9be35a', 2.5); }
    }
  }

  drawFx(ctx, g, dt) {
    for (const sl of this.slams) sl.t += dt;
    this.slams = this.slams.filter(s => s.t < 0.35);
    for (const q of this.parts) {
      q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= Math.pow(0.03, dt); q.vy *= Math.pow(0.03, dt); q.rot += dt * 8;
      const k = 1 - q.t / q.life;
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(k, k);
      ctx.beginPath();
      if (q.tri) { ctx.moveTo(0, -q.r); ctx.lineTo(q.r, q.r * 0.8); ctx.lineTo(-q.r, q.r * 0.8); ctx.closePath(); } else ctx.arc(0, 0, q.r * 0.8, 0, 7);
      ctx.fillStyle = q.col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      ctx.restore();
    }
    this.parts = this.parts.filter(q => q.t < q.life);
    for (const f of this.fx) {
      f.t += dt;
      const k = f.t / f.life;
      switch (f.k) {
        case 'swing': {
          const p = g.p, ease = 1 - Math.pow(1 - Math.min(1, k * 1.4), 3);
          const spread = f.spin ? Math.PI * 2 : 2.4;
          const a0 = f.a - spread / 2, a1 = a0 + spread * ease;
          ctx.save(); ctx.translate(p.x, p.y);
          ctx.beginPath(); ctx.arc(0, 0, 44, a0, a1); ctx.arc(0, 0, 22, a1, a0, true); ctx.closePath();
          ctx.globalAlpha = 1 - k * 0.6; ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.rotate(a1); this.rect(ctx, 12, -3, 30, 6, 23, 0.4); this.ink(ctx, '#e9edf5', 2.5); this.rect(ctx, 6, -6, 6, 12, 24, 0.3); this.ink(ctx, '#ffd23f', 2.5);
          ctx.restore();
          break;
        }
        case 'spark': {
          ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); const r = 10 + k * 16;
          ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, rr = i % 2 ? r * 0.35 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath();
          ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          ctx.restore();
          break;
        }
        case 'pow': {
          const pop = k < 0.15 ? k / 0.15 * 1.25 : k < 0.3 ? 1.25 - (k - 0.15) / 0.15 * 0.25 : 1;
          const sc = pop * (f.big ? 1.5 : 1);
          ctx.save(); ctx.translate(f.x, f.y - k * 10); ctx.rotate(f.rot); ctx.scale(sc, sc);
          ctx.globalAlpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
          ctx.beginPath(); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, rr = i % 2 ? 15 : 26 + hash(i + f.x) * 6; ctx.lineTo(Math.cos(a) * rr * 1.25, Math.sin(a) * rr * 0.85); } ctx.closePath();
          ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
          ctx.font = '400 13px Bungee, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(f.word, 0, 1); ctx.fillStyle = '#fff'; ctx.fillText(f.word, 0, 1);
          ctx.restore();
          break;
        }
        case 'float': {
          ctx.save(); ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
          const size = f.small ? 9 : 13;
          ctx.font = `400 ${size}px Bungee, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const y = f.y - k * 24;
          ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.strokeText(f.text, f.x, y); ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, y);
          ctx.restore();
          break;
        }
        case 'dust': {
          ctx.globalAlpha = 1 - k; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(f.x + s * 8 * (1 + k), f.y, 5 * (1 - k * 0.5), 0, 7); ctx.fillStyle = CREAM; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); } ctx.globalAlpha = 1;
          break;
        }
      }
    }
    this.fx = this.fx.filter(f => f.t < f.life);
  }

  // username tags above chat-spawned monsters and summoning circles
  drawTags(ctx, g) {
    const s = this.s, px = this.labelPx / s;
    ctx.font = `700 ${px}px "Atkinson Hyperlegible", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tag = (x, y, name, col) => {
      const w = ctx.measureText(name).width + px * 0.9, h = px * 1.45;
      ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
      ctx.fillStyle = col; ctx.fillText(name, x, y + px * 0.05);
    };
    const colorOf = (n) => this.colors?.(n) || '#fff';
    for (const e of g.ents) if (e.chat) tag(e.x, e.y - e.r - (e.elite ? 18 : 10) - px * 0.4, e.chat, colorOf(e.chat));
    for (const p of g.pending) if (p.chat) tag(p.x, p.y - 30, p.chat, colorOf(p.chat));
    for (const t of g.traps) if (t.t > 0 && t.user) tag(t.x, t.y + t.r + px, t.user, colorOf(t.user));
  }

  drawFog(ctx, g) {
    const p = g.p, c = g.curse, k = Math.min(1, (c.dur - c.t) / 0.4, c.t / 0.6);
    const grd = ctx.createRadialGradient(p.x, p.y, 40, p.x, p.y, 120);
    grd.addColorStop(0, 'rgba(29,16,41,0)'); grd.addColorStop(1, `rgba(29,16,41,${0.93 * k})`);
    ctx.fillStyle = grd; ctx.fillRect(this.camX - 50, -50, this.vw + 100, H + 100);
  }

  drawVote(ctx, g) {
    const rm = g.room;
    if (!(rm.phase === 'vote' || rm.phase === 'tutorialVote')) return;
    const tot = rm.doors[0].votes + rm.doors[1].votes;
    rm.doors.forEach((d, i) => {
      const cx = (d.c0 + 1) * T, cy = T * 1.85;
      const share = tot ? d.votes / tot : 0;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((i ? 1 : -1) * 0.03);
      this.rect(ctx, -46, -16, 92, 34, 500 + i, 1); this.ink(ctx, CREAM, 3);
      ctx.fillStyle = i ? '#4ce0d2' : '#ff5d8f'; ctx.fillRect(-43, 10, 86 * share, 5);
      ctx.font = '400 12px Bungee, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK;
      ctx.fillText((i ? '!RIGHT' : '!LEFT') + '  ' + d.votes, 0, -4);
      ctx.restore();
      ctx.font = '400 10px Bungee, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
      ctx.strokeText(DOOR_WORD[d.type], cx, cy + 28); ctx.fillStyle = '#fff'; ctx.fillText(DOOR_WORD[d.type], cx, cy + 28);
    });
    // clock
    const k = Math.max(0, rm.voteT / VOTE_TIME), cx = W / 2, cy = T * 1.9;
    ctx.beginPath(); ctx.arc(cx, cy, 17, 0, Math.PI * 2); ctx.fillStyle = CREAM; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.closePath(); ctx.fillStyle = '#ffd23f'; ctx.fill();
    ctx.font = '400 13px Bungee, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.fillText(Math.ceil(rm.voteT), cx, cy + 1);
    ctx.font = '400 10px Bungee, sans-serif'; ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.strokeText('CHAT VOTES', cx, cy + 28); ctx.fillStyle = '#ffd23f'; ctx.fillText('CHAT VOTES', cx, cy + 28);
  }

  // arrows at the screen edge for monsters off the panned view
  drawPips(ctx, g) {
    for (const e of g.ents) {
      const sx = (e.x - this.camX) * this.s;
      if (sx > -4 && sx < this.cssW + 4) continue;
      const left = sx < 0, y = Math.max(16, Math.min(this.cssH - 16, e.y * this.s)), x = left ? 8 : this.cssW - 8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (left ? 12 : -12), y - 8); ctx.lineTo(x + (left ? 12 : -12), y + 8); ctx.closePath();
      ctx.fillStyle = e.chat ? '#fff' : '#ff2d55'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    }
  }
}
