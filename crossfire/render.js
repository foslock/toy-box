// Crossfire: drawing. Newsprint, black ink and one red, like a two-colour Sunday strip.
import { W, H, HEAD_Y, SHIELD_R, MOVE_RANGE, WEAPONS } from './game.js';

export const INK = '#1d1813', RED = '#d23b2a', PAPER = '#f1e8d0', PAPER2 = '#e6d9b8';
const SFX_FONT = "'Bowlby One SC', 'Arial Black', sans-serif";
const HAND = "'Shantell Sans', 'Comic Sans MS', sans-serif";
const OUCH = ['OOF!', 'YEOW!', 'MY HAT!', 'OW!', 'UNFAIR!', 'ACK!', 'MOTHER!', 'NOT AGAIN!'];

function tile(size, k, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size * k;
  const x = c.getContext('2d');
  x.scale(k, k);
  draw(x, size);
  return c;
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: W / 2, y: H / 2, s: 1 };
    this.camGoal = { x: W / 2, y: H / 2 };
    this.zoomPulse = 1;
    this.insets = { top: 60, bottom: 110 };
    this.fx = []; this.words = []; this.balloons = []; this.puffs = []; this.bits = []; this.ripples = [];
    this.shake = 0;
    this.terrainSeen = -1; this.craterSeen = 0;
    this.time = 0;
    this.pan = null;      // a manual offset the player dragged
    this.makePatterns();
    this.resize();
  }

  // ---------- setup
  makePatterns() {
    const ctx = this.ctx, K = 4;
    this.dotPats = [0.5, 0.9, 1.3, 1.75, 2.2, 2.7].map(rad => {
      const t = tile(9, K, (x, s) => {
        x.fillStyle = RED;
        for (const [cx, cy] of [[0, 0], [9, 0], [0, 9], [9, 9], [4.5, 4.5]]) { x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.fill(); }
      });
      const p = ctx.createPattern(t, 'repeat');
      p.setTransform(new DOMMatrix().scale(1 / K));
      return p;
    });
    const hatch = (gap, w, col, cross) => {
      const t = tile(gap, K, (x, s) => {
        x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'square';
        x.beginPath(); x.moveTo(-1, s + 1); x.lineTo(s + 1, -1); x.moveTo(-1, 1); x.lineTo(1, -1); x.moveTo(s - 1, s + 1); x.lineTo(s + 1, s - 1);
        if (cross) { x.moveTo(-1, -1); x.lineTo(s + 1, s + 1); x.moveTo(s - 1, -1); x.lineTo(s + 1, 1); x.moveTo(-1, s - 1); x.lineTo(1, s + 1); }
        x.stroke();
      });
      const p = ctx.createPattern(t, 'repeat');
      p.setTransform(new DOMMatrix().scale(1 / K));
      return { t, p };
    };
    this.hatch = hatch(7, 1.1, INK, false);
    this.cross = hatch(6, 1.1, INK, true);
    this.redHatch = hatch(6, 1.2, RED, false);
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.vw = innerWidth; this.vh = innerHeight;
    this.cv.width = Math.round(this.vw * dpr); this.cv.height = Math.round(this.vh * dpr);
    this.cv.style.width = this.vw + 'px'; this.cv.style.height = this.vh + 'px';
    this.fit();
    const R = Math.min(1.5, Math.max(1, this.cam.s * dpr));
    if (R !== this.R) { this.R = R; this.terrainSeen = -1; }
  }

  fit() {
    const { top, bottom } = this.insets;
    const ah = this.vh - top - bottom * .55;
    const fit = Math.min(this.vw / (W + 40), ah / (H - 60));
    this.fitAll = fit >= .5;
    this.cam.s = this.fitAll ? fit : Math.max(fit, Math.min(.58, this.vw / 780));
    this.rect = { cx: this.vw / 2, cy: top + (this.vh - top - bottom * .55) / 2 };
  }

  canPan() { return this.visW() < W - 10 || this.visH() < H - 140; }
  visW() { return this.vw / this.cam.s; }
  visH() { return (this.vh - this.insets.top) / this.cam.s; }

  toWorld(sx, sy) {
    const s = this.cam.s * this.zoomPulse;
    return { x: (sx - this.rect.cx) / s + this.cam.x, y: (sy - this.rect.cy) / s + this.cam.y };
  }
  toScreen(wx, wy) {
    const s = this.cam.s * this.zoomPulse;
    return { x: (wx - this.cam.x) * s + this.rect.cx, y: (wy - this.cam.y) * s + this.rect.cy };
  }

  clampCam(c) {
    const s = this.cam.s * this.zoomPulse;
    const halfW = this.vw / 2 / s;
    const top = (this.rect.cy) / s, bot = (this.vh - this.rect.cy) / s;
    if (halfW * 2 >= W + 80) c.x = W / 2; else c.x = Math.max(-40 + halfW, Math.min(W + 40 - halfW, c.x));
    const minY = -260 + top, maxY = H - bot + 10;
    c.y = minY > maxY ? H / 2 : Math.max(minY, Math.min(maxY, c.y));
    return c;
  }

  // ---------- the ground
  buildTerrain(game) {
    const R = this.R, cw = Math.ceil(W * R), ch = Math.ceil(H * R);
    if (!this.mask || this.mask.width !== cw) {
      for (const k of ['mask', 'tmp', 'ter']) { this[k] = document.createElement('canvas'); this[k].width = cw; this[k].height = ch; }
    }
    this.heights = game.heights;
    const m = this.mask.getContext('2d');
    m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, cw, ch);
    m.setTransform(R, 0, 0, R, 0, 0);
    m.fillStyle = INK;
    m.beginPath(); m.moveTo(0, H + 10);
    game.heights.forEach((h, i) => m.lineTo(i * 2 + 1, h));
    m.lineTo(W, game.heights.at(-1)); m.lineTo(W, H + 10); m.closePath(); m.fill();
    this.craterSeen = 0;
    this.cutCraters(game, false);
    this.compose();
    this.terrainSeen = game.terrainVersion;
  }
  cutCraters(game, compose = true) {
    const m = this.mask.getContext('2d');
    m.save(); m.globalCompositeOperation = 'destination-out';
    for (let i = this.craterSeen; i < game.craters.length; i++) {
      const c = game.craters[i];
      m.beginPath(); m.arc(c.x, c.y, c.r, 0, 7); m.fill();
    }
    m.restore();
    this.craterSeen = game.craters.length;
    if (compose) this.compose();
  }
  compose() {
    const R = this.R, cw = this.mask.width, ch = this.mask.height;
    const t = this.ter.getContext('2d'), x = this.tmp.getContext('2d');
    t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, cw, ch);
    const o = 2.6 * R;
    for (let a = 0; a < 8; a++) t.drawImage(this.mask, Math.cos(a * Math.PI / 4) * o, Math.sin(a * Math.PI / 4) * o);
    // the paper inside, hatched
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, cw, ch);
    x.drawImage(this.mask, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = PAPER2; x.fillRect(0, 0, cw, ch);
    x.globalCompositeOperation = 'source-atop';
    const hp = x.createPattern(this.hatch.t, 'repeat'); hp.setTransform(new DOMMatrix().scale(R / 4));
    x.globalAlpha = .55; x.fillStyle = hp; x.fillRect(0, 0, cw, ch); x.globalAlpha = 1;
    t.drawImage(this.tmp, 0, 0);
    // cross-hatching deeper down, below where the original surface was
    x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, cw, ch);
    x.setTransform(R, 0, 0, R, 0, 0);
    x.fillStyle = INK; x.beginPath(); x.moveTo(0, H + 10);
    this.heights.forEach((h, i) => x.lineTo(i * 2 + 1, h + 38));
    x.lineTo(W, H + 10); x.closePath(); x.fill();
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(this.mask, 0, 0);
    x.globalCompositeOperation = 'source-in';
    const cp = x.createPattern(this.cross.t, 'repeat'); cp.setTransform(new DOMMatrix().scale(R / 4));
    x.fillStyle = cp; x.fillRect(0, 0, cw, ch);
    x.globalCompositeOperation = 'source-over';
    t.globalAlpha = .5; t.drawImage(this.tmp, 0, 0); t.globalAlpha = 1;
  }

  // ---------- effects from game events
  onEvent(e, game) {
    const S = game.soldiers;
    if (e.type === 'boom') {
      const n = 11 + ((Math.random() * 4) | 0), pts = [];
      for (let i = 0; i < n * 2; i++) pts.push(i % 2 ? .5 + Math.random() * .15 : .92 + Math.random() * .35);
      const big = e.midair ? 1.4 : 1;
      this.fx.push({ kind: 'burst', x: e.x, y: e.y, r: e.r * big, t: 0, life: .75, pts, rot: Math.random() * 6 });
      this.words.push({ text: e.word, x: e.x, y: e.y - e.r * .4, t: 0, life: e.midair ? 1.8 : 1.25, rot: (Math.random() - .5) * .35, size: e.midair ? 1.25 : 1 });
      for (let i = 0; i < 5; i++) this.puffs.push({ x: e.x + (Math.random() - .5) * e.r, y: e.y + (Math.random() - .5) * e.r * .6, r: 6 + Math.random() * 10, t: -.15 - Math.random() * .2, life: 1.6, vx: (Math.random() - .5) * 20, vy: -18 - Math.random() * 20 });
      if (!e.midair) for (let i = 0; i < 9; i++) {
        const a = -Math.PI * Math.random(), v = 120 + Math.random() * 220;
        this.bits.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 1.4, s: 2 + Math.random() * 3, rot: Math.random() * 6 });
      }
      this.shake = Math.max(this.shake, e.midair ? 14 : 9);
    } else if (e.type === 'hurt') {
      const s = S[e.who];
      this.words.push({ text: '-' + e.dmg, x: s.x + 26, y: s.y - 58, t: 0, life: 1.4, rot: 0, size: .62, rise: 1, red: true });
      if (e.how !== 'fall' || e.dmg > 6) this.balloons.push({ who: e.who, text: OUCH[(Math.random() * OUCH.length) | 0], t: 0, life: 1.6 });
    } else if (e.type === 'splash' || e.type === 'plop') {
      this.ripples.push({ x: e.x, y: e.y, t: 0, life: 1.2, big: e.type === 'splash' });
      this.words.push({ text: e.type === 'splash' ? 'SPLOOSH!' : 'plip', x: e.x, y: e.y - 24, t: 0, life: 1.1, rot: (Math.random() - .5) * .3, size: e.type === 'splash' ? .8 : .45, ink: true });
    } else if (e.type === 'shieldPop') {
      const s = S[e.who];
      this.words.push({ text: 'POP!', x: s.x, y: s.y - 40, t: 0, life: 1, rot: -.2, size: .6, ink: true });
    } else if (e.type === 'die') {
      const s = S[e.who];
      if (e.how !== 'drown') this.balloons.push({ who: e.who, text: 'ARGH…', t: 0, life: 1.6 });
      s.deadT = 0;
    }
  }

  // ---------- frame
  draw(game, ui, dt, fxDt = dt) {
    this.time += dt;
    if (game.terrainVersion !== this.terrainSeen) {
      if (this.terrainSeen < 0 || !this.mask) this.buildTerrain(game);
      else { this.cutCraters(game); this.terrainSeen = game.terrainVersion; }
    }
    const ctx = this.ctx, dpr = this.dpr;
    // camera
    const k = 1 - Math.pow(.004, dt);
    const goal = this.clampCam({ x: this.camGoal.x, y: this.camGoal.y });
    this.cam.x += (goal.x - this.cam.x) * k; this.cam.y += (goal.y - this.cam.y) * k;
    this.shake = Math.max(0, this.shake - dt * 30);
    const sh = this.shake, s = this.cam.s * this.zoomPulse;
    const ox = this.rect.cx - this.cam.x * s + (Math.random() - .5) * sh, oy = this.rect.cy - this.cam.y * s + (Math.random() - .5) * sh;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, this.vw, this.vh);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    this.drawSky(ctx, game);
    ctx.drawImage(this.ter, 0, 0, W, H);
    this.drawMortars(ctx, game, ui);
    this.drawSea(ctx, game);
    for (const p of this.puffs) this.drawPuff(ctx, p, fxDt);
    for (const so of game.soldiers) this.drawSoldier(ctx, so, game, ui);
    if (ui.plan) this.drawPlan(ctx, game, ui);
    if (ui.enemyHint) this.drawEnemyHint(ctx, game, ui.enemyHint);
    for (const p of game.projectiles) this.drawProjectile(ctx, p);
    this.drawFx(ctx, fxDt);
    this.drawBalloons(ctx, game, dt);
    this.drawWords(ctx, fxDt);
    // screen space
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ui.offscreen) this.drawOffscreen(ctx, game);
    if (ui.minimap && this.canPan()) this.drawMinimap(ctx, game);
    this.drawGrain(ctx);
  }

  drawSky(ctx, game) {
    // halftone bands, getting heavier toward the horizon
    const bands = [[-600, 40, 0], [40, 170, 1], [170, 290, 2], [290, 390, 3], [390, 470, 4], [470, H, 5]];
    for (const [a, b, i] of bands) { ctx.fillStyle = this.dotPats[i]; ctx.globalAlpha = .55; ctx.fillRect(-700, a, W + 1400, b - a); }
    ctx.globalAlpha = 1;
    // sun
    const sx = 1040, sy = 150, sr = 70;
    ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.fill();
    ctx.fillStyle = this.redHatch.p; ctx.globalAlpha = .4; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + this.time * .05; ctx.moveTo(sx + Math.cos(a) * (sr + 10), sy + Math.sin(a) * (sr + 10)); ctx.lineTo(sx + Math.cos(a) * (sr + (i % 2 ? 22 : 32)), sy + Math.sin(a) * (sr + (i % 2 ? 22 : 32))); }
    ctx.stroke();
    // far hills
    ctx.beginPath(); ctx.moveTo(-700, H);
    for (let x = -700; x <= W + 700; x += 20) ctx.lineTo(x, 420 + Math.sin(x * .006 + 1) * 40 + Math.sin(x * .017) * 14);
    ctx.lineTo(W + 700, H); ctx.closePath();
    ctx.fillStyle = PAPER; ctx.fill();
    ctx.fillStyle = this.redHatch.p; ctx.globalAlpha = .5; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
    // clouds drifting with the wind
    const drift = this.time * (game.wind * .12);
    for (let i = 0; i < 5; i++) {
      let x = ((i * 397 + drift + 4000) % 2400) - 500, y = 60 + (i * 73) % 170;
      this.cloud(ctx, x, y, 1 + (i % 3) * .25);
    }
  }
  cloud(ctx, x, y, k) {
    ctx.beginPath();
    const bumps = [[0, 0, 26], [30, -12, 30], [64, -2, 24], [88, 8, 18], [-24, 8, 18]];
    for (const [bx, by, r] of bumps) { ctx.moveTo(x + (bx + r) * k, y + by * k); ctx.arc(x + bx * k, y + by * k, r * k, 0, 7); }
    ctx.fillStyle = PAPER; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = PAPER; ctx.fillRect(x - 40 * k, y + 8 * k, 140 * k, 24 * k);
    ctx.beginPath(); ctx.moveTo(x - 40 * k, y + 22 * k); ctx.lineTo(x + 104 * k, y + 22 * k); ctx.stroke();
  }

  drawSea(ctx, game) {
    const y0 = game.water, t = this.time;
    ctx.fillStyle = PAPER;
    ctx.beginPath(); ctx.moveTo(-700, H + 300);
    for (let x = -700; x <= W + 700; x += 14) ctx.lineTo(x, y0 + Math.sin(x * .05 + t * 2) * 2.5);
    ctx.lineTo(W + 700, H + 300); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.lineWidth = 1.3;
    for (let row = 1; row < 14; row++) {
      const y = y0 + row * 7 + row * row * .35;
      ctx.beginPath();
      for (let x = -700 + (row % 2) * 30; x <= W + 700; x += 60) {
        const len = 22 + (row * 13 + x) % 20;
        ctx.moveTo(x + Math.sin(t + row) * 6, y); ctx.quadraticCurveTo(x + len / 2, y - 3, x + len, y);
      }
      ctx.stroke();
    }
    for (const r of this.ripples) {
      r.t += 1 / 60;
      const k = r.t / r.life;
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, (r.big ? 34 : 16) * (0.3 + k), (r.big ? 7 : 4) * (.3 + k), 0, 0, 7); ctx.stroke();
      if (r.big && k < .5) {
        ctx.beginPath();
        for (let i = -2; i <= 2; i++) { ctx.moveTo(r.x + i * 7, r.y - 4); ctx.lineTo(r.x + i * 12, r.y - 4 - (30 - Math.abs(i) * 8) * Math.sin(k * Math.PI * 2)); }
        ctx.stroke();
      }
    }
    this.ripples = this.ripples.filter(r => r.t < r.life);
  }

  drawMortars(ctx, game, ui) {
    for (const m of game.mortars) {
      if (ui.hideMortarOf === m.team) continue;
      this.mortarMark(ctx, m.x, game.surface(m.x), 1, game.round + 1 === m.due ? 'NEXT ROUND' : 'INCOMING');
    }
  }
  mortarMark(ctx, x, y, a, label) {
    const r = WEAPONS.mortar.r, t = this.time;
    ctx.save(); ctx.globalAlpha = a;
    ctx.setLineDash([7, 6]); ctx.lineDashOffset = -t * 20;
    ctx.strokeStyle = RED; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.2, r * .45, 0, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 6; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(x - 12, y - 12); ctx.lineTo(x + 12, y + 12); ctx.moveTo(x + 12, y - 12); ctx.lineTo(x - 12, y + 12); ctx.stroke();
    ctx.lineWidth = 3.4; ctx.strokeStyle = RED; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(x, y - 140);
    ctx.setLineDash([3, 7]); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.setLineDash([]);
    if (label) this.tag(ctx, x, y - 150, label, true);
    ctx.restore();
  }

  tag(ctx, x, y, text, red) {
    ctx.font = `700 13px ${HAND}`;
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = red ? RED : PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(x - w / 2, y - 10, w, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = red ? PAPER : INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
  }

  // ---------- people
  drawSoldier(ctx, s, game, ui) {
    if (!s.alive) { if (!s.drowned) this.drawGrave(ctx, s); return; }
    const isActive = ui.activeIds?.includes(s.id);
    let aim = null;
    if (ui.aims && ui.aims[s.id] != null) aim = ui.aims[s.id];
    this.body(ctx, s.x, s.y, s.team, s.face, s.walkT, aim, s.hurtT > 0, 1, !s.grounded);
    if (s.shield) {
      ctx.save();
      ctx.beginPath(); ctx.arc(s.x, s.y - HEAD_Y, SHIELD_R, 0, 7);
      ctx.fillStyle = this.dotPats[1]; ctx.globalAlpha = .7; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(s.x - 8, s.y - HEAD_Y - 9, 8, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
      ctx.restore();
    }
    // name and health
    const top = s.y - 40;
    ctx.font = `700 12px ${HAND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const name = s.name;
    ctx.lineWidth = 3.5; ctx.strokeStyle = PAPER; ctx.strokeText(name, s.x, top - 3);
    ctx.fillStyle = INK; ctx.fillText(name, s.x, top - 3);
    const bw = 30, frac = Math.max(0, s.hp) / 80;
    ctx.fillStyle = PAPER; ctx.fillRect(s.x - bw / 2, top, bw, 6);
    ctx.fillStyle = s.team === 0 ? RED : INK; ctx.fillRect(s.x - bw / 2, top, bw * frac, 6);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(s.x - bw / 2, top, bw, 6);
    if (isActive) {
      const b = Math.sin(this.time * 6) * 3;
      ctx.beginPath(); ctx.moveTo(s.x - 8, top - 26 + b); ctx.lineTo(s.x + 8, top - 26 + b); ctx.lineTo(s.x, top - 15 + b); ctx.closePath();
      ctx.fillStyle = s.team === 0 ? RED : INK; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    }
  }

  body(ctx, x, y, team, face, walkT, aim, hurt, alpha = 1, air = false) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
    // legs
    const sw = air ? .6 : Math.sin(walkT * 14) * .5;
    ctx.beginPath();
    ctx.moveTo(-3, -7); ctx.lineTo(-3 + Math.sin(sw) * 6, 0);
    ctx.moveTo(3, -7); ctx.lineTo(3 - Math.sin(sw) * 6, 0);
    ctx.stroke();
    // boots
    ctx.fillStyle = INK;
    ctx.fillRect(-3 + Math.sin(sw) * 6 - 2 + (face > 0 ? 1 : -1), -2, 5, 3);
    ctx.fillRect(3 - Math.sin(sw) * 6 - 2 + (face > 0 ? 1 : -1), -2, 5, 3);
    // the bazooka, behind the body when aiming back
    const a = aim != null ? aim : (face > 0 ? .25 : Math.PI - .25);
    const tube = () => {
      ctx.save(); ctx.translate(0, -HEAD_Y + 2); ctx.rotate(-a);
      ctx.fillStyle = team === 0 ? RED : INK; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(-6, -3, 22, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = PAPER; ctx.fillRect(13, -3, 3, 6); ctx.strokeRect(13, -3, 3, 6);
      ctx.restore();
    };
    // body (a bean)
    ctx.beginPath(); ctx.ellipse(0, -13, 8, 9.5, 0, 0, 7);
    ctx.fillStyle = PAPER; ctx.fill(); ctx.stroke();
    // belt
    ctx.beginPath(); ctx.moveTo(-7.5, -10); ctx.lineTo(7.5, -10); ctx.lineWidth = 2.6; ctx.stroke(); ctx.lineWidth = 2.2;
    tube();
    // head
    const hy = -25;
    ctx.beginPath(); ctx.arc(face * 1, hy, 7, 0, 7); ctx.fillStyle = PAPER; ctx.fill(); ctx.stroke();
    // eyes
    ctx.fillStyle = INK;
    if (hurt) {
      ctx.lineWidth = 1.5;
      for (const ex of [-1, 3]) { const cx = face * ex + face; ctx.beginPath(); ctx.moveTo(cx - 1.5, hy - 1.5); ctx.lineTo(cx + 1.5, hy + 1.5); ctx.moveTo(cx + 1.5, hy - 1.5); ctx.lineTo(cx - 1.5, hy + 1.5); ctx.stroke(); }
    } else {
      ctx.beginPath(); ctx.arc(face * 1 + face * 1, hy, 1.3, 0, 7); ctx.arc(face * 1 + face * 4.5, hy, 1.3, 0, 7); ctx.fill();
    }
    // helmet
    ctx.beginPath(); ctx.arc(face * 1, hy - 1, 8.5, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath();
    ctx.fillStyle = team === 0 ? RED : INK; ctx.fill(); ctx.lineWidth = 2.2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(face * 1 - 10, hy - 1); ctx.lineTo(face * 1 + 10, hy - 1); ctx.stroke();
    if (team === 1) { ctx.strokeStyle = PAPER; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(face * 1, hy - 1, 5, Math.PI * 1.2, Math.PI * 1.5); ctx.stroke(); }
    ctx.restore();
  }

  drawGrave(ctx, s) {
    const k = Math.min(1, (s.deadT = (s.deadT || 0) + 1 / 60) * 3);
    ctx.save(); ctx.translate(s.x, s.y); ctx.scale(1, k);
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-8, -14); ctx.arc(0, -14, 8, Math.PI, 0); ctx.lineTo(8, 0); ctx.closePath();
    ctx.fillStyle = PAPER2; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = INK; ctx.font = `800 6px ${HAND}`; ctx.textAlign = 'center'; ctx.fillText('RIP', 0, -10);
    ctx.restore();
  }

  // ---------- planning overlay
  drawPlan(ctx, game, ui) {
    const p = ui.plan, s = game.soldiers[p.who];
    if (!s?.alive) return;
    // walking range
    const y = s.y + 6;
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.setLineDash([2, 5]);
    ctx.beginPath(); ctx.moveTo(s.x - MOVE_RANGE, y); ctx.lineTo(s.x + MOVE_RANGE, y); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath();
    for (const e of [-1, 1]) { ctx.moveTo(s.x + e * MOVE_RANGE, y - 6); ctx.lineTo(s.x + e * MOVE_RANGE, y + 6); }
    ctx.stroke();
    const g = p.ghost;
    if (Math.abs(g.x - s.x) > 1) {
      this.body(ctx, g.x, g.y, s.team, Math.sign(g.x - s.x), 0, p.weapon === 'mortar' || p.weapon === 'shield' ? null : p.angle, false, .45);
      ctx.strokeStyle = RED; ctx.lineWidth = 2.5;
      const dir = Math.sign(g.x - s.x);
      ctx.beginPath(); ctx.moveTo(s.x + dir * 12, y); ctx.lineTo(g.x - dir * 8, y);
      ctx.moveTo(g.x - dir * 8, y); ctx.lineTo(g.x - dir * 15, y - 5); ctx.moveTo(g.x - dir * 8, y); ctx.lineTo(g.x - dir * 15, y + 5); ctx.stroke();
      if (g.fell) this.tag(ctx, g.x, g.y - 58, 'WATCH IT!', true);
    }
    const hx = g.x, hy = g.y - HEAD_Y;
    if (p.weapon === 'mortar') {
      this.mortarMark(ctx, p.targetX, game.surface(p.targetX), .9, 'YOUR MORTAR');
    } else if (p.weapon === 'shield') {
      ctx.setLineDash([5, 5]); ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hx, hy, SHIELD_R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    } else {
      // the arrow you pulled
      const len = 26 + p.power * 70;
      const ex = hx + Math.cos(p.angle) * len, ey = hy - Math.sin(p.angle) * len;
      ctx.strokeStyle = RED; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx + Math.cos(p.angle) * 16, hy - Math.sin(p.angle) * 16); ctx.lineTo(ex, ey); ctx.stroke();
      const a = p.angle;
      ctx.fillStyle = RED; ctx.beginPath();
      ctx.moveTo(ex + Math.cos(a) * 10, ey - Math.sin(a) * 10);
      ctx.lineTo(ex + Math.cos(a + 2.4) * 9, ey - Math.sin(a + 2.4) * 9);
      ctx.lineTo(ex + Math.cos(a - 2.4) * 9, ey - Math.sin(a - 2.4) * 9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
      // the first part of the flight
      if (p.trace) {
        ctx.fillStyle = INK;
        p.trace.forEach((q, i) => { ctx.beginPath(); ctx.arc(q.x, q.y, 2.6 - i * .05, 0, 7); ctx.fill(); });
      }
      ctx.font = `700 13px ${HAND}`; ctx.textAlign = 'center';
      const lx = hx + Math.cos(a) * (len + 22), ly = hy - Math.sin(a) * (len + 22) + 4;
      ctx.lineWidth = 3; ctx.strokeStyle = PAPER; ctx.strokeText(Math.round(p.power * 100) + '%', lx, ly);
      ctx.fillStyle = INK; ctx.fillText(Math.round(p.power * 100) + '%', lx, ly);
    }
    // a grab ring, so you know where to drag from
    if (ui.grabRing && (p.weapon === 'shell' || p.weapon === 'grenade')) {
      const pulse = 1 + Math.sin(this.time * 4) * .08;
      ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.lineDashOffset = this.time * 10;
      ctx.beginPath(); ctx.arc(hx, hy, 30 * pulse, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // tutorial-only: show what the enemy is about to do
  drawEnemyHint(ctx, game, h) {
    if (h.ghost) {
      const s = game.soldiers[h.who];
      this.body(ctx, h.ghost.x, h.ghost.y, s.team, Math.sign(h.ghost.x - s.x) || -1, 0, null, false, .4);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]);
      const y = s.y + 6, dir = Math.sign(h.ghost.x - s.x);
      ctx.beginPath(); ctx.moveTo(s.x, y); ctx.lineTo(h.ghost.x, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(h.ghost.x, y); ctx.lineTo(h.ghost.x - dir * 8, y - 5); ctx.moveTo(h.ghost.x, y); ctx.lineTo(h.ghost.x - dir * 8, y + 5); ctx.stroke();
    }
    if (h.trace) {
      ctx.strokeStyle = RED; ctx.lineWidth = 2.5; ctx.setLineDash([8, 7]); ctx.lineDashOffset = -this.time * 30;
      ctx.beginPath(); h.trace.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke(); ctx.setLineDash([]);
      const e = h.trace.at(-1);
      if (e) { ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, 14, 0, 7); ctx.stroke(); }
    }
  }

  // ---------- things in the air
  drawProjectile(ctx, p) {
    const sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp;
    ctx.save();
    // speed lines
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    if (!p.rest) {
      ctx.beginPath();
      for (const o of [-5, 0, 5]) {
        const nx = -uy * o, ny = ux * o, l = 14 + Math.min(30, sp * .04) - Math.abs(o);
        ctx.moveTo(p.x - ux * 10 + nx, p.y - uy * 10 + ny); ctx.lineTo(p.x - ux * (10 + l) + nx, p.y - uy * (10 + l) + ny);
      }
      ctx.stroke();
    }
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(uy, ux));
    ctx.lineWidth = 2; ctx.fillStyle = INK;
    if (p.kind === 'grenade') {
      ctx.rotate(p.t * 8);
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fillStyle = p.team === 0 ? RED : INK; ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.fillRect(-2, -9, 4, 4);
      ctx.strokeStyle = PAPER; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke();
    } else if (p.kind === 'mortar' || p.kind === 'mortarUp') {
      ctx.beginPath(); ctx.ellipse(0, 0, 11, 6.5, 0, 0, 7); ctx.fillStyle = INK; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-17, -7); ctx.lineTo(-17, 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = RED; ctx.fillRect(2, -6, 3, 12);
    } else {
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(6, -5, -6, -4.5); ctx.lineTo(-6, 4.5); ctx.quadraticCurveTo(6, 5, 10, 0);
      ctx.fillStyle = PAPER; ctx.fill(); ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = p.team === 0 ? RED : INK; ctx.fillRect(-2, -4.5, 4, 9);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-6, -4.5); ctx.lineTo(-11, -7); ctx.lineTo(-11, 7); ctx.lineTo(-6, 4.5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  drawFx(ctx, dt) {
    for (const f of this.fx) {
      f.t += dt;
      const k = f.t / f.life;
      const grow = Math.min(1, f.t / .09), fade = k > .55 ? 1 - (k - .55) / .45 : 1;
      const R = f.r * (0.55 + grow * .65) * (k > .55 ? .9 + fade * .1 : 1);
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
      const star = (scale) => {
        ctx.beginPath();
        f.pts.forEach((q, i) => { const a = i / f.pts.length * 6.283; const r = R * q * scale; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); });
        ctx.closePath();
      };
      ctx.globalAlpha = Math.max(0, fade);
      star(1); ctx.fillStyle = RED; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'miter'; ctx.stroke();
      star(.55); ctx.fillStyle = PAPER; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
      if (k < .2) { star(.3); ctx.fillStyle = INK; ctx.fill(); }
      ctx.restore();
    }
    this.fx = this.fx.filter(f => f.t < f.life);
    for (const b of this.bits) {
      b.t += dt; b.vy += 500 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += dt * 9;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.fillStyle = INK; ctx.globalAlpha = Math.max(0, 1 - b.t / b.life);
      ctx.fillRect(-b.s, -b.s / 2, b.s * 2, b.s); ctx.restore();
    }
    this.bits = this.bits.filter(b => b.t < b.life);
  }

  drawPuff(ctx, p, dt) {
    p.t += dt;
    if (p.t < 0) return;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const k = p.t / p.life;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + k * 1.4), 0, 7);
    ctx.fillStyle = PAPER; ctx.fill();
    ctx.fillStyle = this.hatch.p; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.restore();
  }
  get puffsAlive() { return this.puffs.length; }

  drawBalloons(ctx, game, dt) {
    for (const b of this.balloons) {
      b.t += dt;
      const s = game.soldiers[b.who];
      const x = s.x + 18, y = s.y - 62;
      ctx.font = `800 14px ${HAND}`;
      const w = ctx.measureText(b.text).width + 16, h = 24;
      const pop = Math.min(1, b.t * 8);
      ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop);
      ctx.beginPath(); ctx.ellipse(w / 2 - 6, 0, w / 2 + 2, h / 2 + 1, 0, 0, 7);
      ctx.moveTo(-2, 8); ctx.lineTo(-14, 26); ctx.lineTo(6, 10);
      ctx.fillStyle = PAPER; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = PAPER; ctx.beginPath(); ctx.ellipse(w / 2 - 6, 0, w / 2, h / 2 - 1, 0, 0, 7); ctx.fill();
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.text, w / 2 - 6, 1);
      ctx.restore();
    }
    this.balloons = this.balloons.filter(b => b.t < b.life);
    this.puffs = this.puffs.filter(p => p.t < p.life);
  }

  drawWords(ctx, dt) {
    const s = this.cam.s * this.zoomPulse;
    for (const w of this.words) {
      w.t += dt;
      const k = w.t / w.life;
      const pop = w.t < .12 ? .4 + w.t / .12 * .8 : w.t < .22 ? 1.2 - (w.t - .12) / .1 * .2 : 1;
      const px = 40 * w.size / Math.max(.55, Math.min(1, s));   // roughly the same size on screen whatever the zoom
      ctx.save();
      ctx.translate(w.x, w.y - (w.rise ? k * 30 : 0)); ctx.rotate(w.rot); ctx.scale(pop, pop);
      ctx.globalAlpha = k > .75 ? (1 - k) / .25 : 1;
      ctx.font = `${Math.round(px)}px ${SFX_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = px * .22; ctx.strokeStyle = INK; ctx.strokeText(w.text, 0, 0);
      ctx.fillStyle = INK; ctx.fillText(w.text, px * .06, px * .08);
      ctx.fillStyle = w.ink ? PAPER : RED;
      ctx.fillText(w.text, 0, 0);
      ctx.restore();
    }
    this.words = this.words.filter(w => w.t < w.life);
  }

  drawOffscreen(ctx, game) {
    for (const s of game.soldiers) {
      if (!s.alive) continue;
      const p = this.toScreen(s.x, s.y - HEAD_Y);
      const m = 18, top = this.insets.top + 6, bot = this.vh - this.insets.bottom - 6;
      if (p.x >= 0 && p.x <= this.vw && p.y >= top && p.y <= bot) continue;
      const x = Math.max(m, Math.min(this.vw - m, p.x)), y = Math.max(top + m, Math.min(bot - m, p.y));
      const a = Math.atan2(p.y - y, p.x - x);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.closePath();
      ctx.fillStyle = s.team === 0 ? RED : INK; ctx.fill(); ctx.strokeStyle = PAPER; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
  }

  drawMinimap(ctx, game) {
    const w = Math.min(150, this.vw * .36), h = w * H / W * .7;
    const x = this.vw - w - 10, y = this.vh - this.insets.bottom - h - 10;
    this.mini = { x, y, w, h };
    ctx.fillStyle = PAPER; ctx.fillRect(x, y, w, h);
    ctx.drawImage(this.ter, 0, H * .3 * this.R, this.ter.width, this.ter.height * .7, x, y, w, h);
    const sx = w / W, sy = h / (H * .7), y0 = H * .3;
    ctx.fillStyle = INK; ctx.fillRect(x, y + (game.water - y0) * sy, w, h - (game.water - y0) * sy);
    for (const s of game.soldiers) {
      if (!s.alive) continue;
      ctx.fillStyle = s.team === 0 ? RED : INK;
      ctx.beginPath(); ctx.arc(x + s.x * sx, y + (s.y - 10 - y0) * sy, 3, 0, 7); ctx.fill();
      ctx.strokeStyle = PAPER; ctx.lineWidth = 1; ctx.stroke();
    }
    const vs = this.cam.s * this.zoomPulse;
    const l = this.cam.x - this.rect.cx / vs, r = this.cam.x + (this.vw - this.rect.cx) / vs;
    const t = this.cam.y - (this.rect.cy - this.insets.top) / vs, b = this.cam.y + (this.vh - this.rect.cy) / vs;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = RED; ctx.lineWidth = 2;
    ctx.strokeRect(x + l * sx, y + (t - y0) * sy, (r - l) * sx, (b - t) * sy);
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  }

  drawGrain(ctx) {
    if (!this.grain) {
      this.grain = tile(128, 1, (x, s) => {
        for (let i = 0; i < 380; i++) {
          x.fillStyle = Math.random() < .5 ? 'rgba(40,30,20,.10)' : 'rgba(255,250,235,.12)';
          x.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
        }
      });
      this.grainPat = this.ctx.createPattern(this.grain, 'repeat');
    }
    ctx.fillStyle = this.grainPat; ctx.fillRect(0, 0, this.vw, this.vh);
  }
}
