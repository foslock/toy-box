// The kingdom on screen. Everything is drawn at pixel-art size into a small canvas, then scaled up whole with no
// smoothing, so every pixel stays square: the map of tiles under its fog, the road your line has walked, the two ways
// ahead rising out of the mist, your heir, and the little lives of the tiles (smoke, fire, sparkle, a turning mill).
// It also stages the big moments: a foe stepping out onto a tile, the crowds of the procession, the crowning in the
// throne room wherever the road ended, and the fog lifting as the kingdom takes its shape round that throne.
import { landSprite, fogSprite, SPRITE, HEAD, EL } from './terrain.js';
import { structureSprite, fxOf } from './structures.js';
import { hero, foe as foeArt, peasant, bishop, crownSprite } from './figures.js';
import { D, N, gridOf, rowColOf, inside, keyOf, kingdomOf } from './world.js';
import { hash2, clamp, smooth } from './util.js';
import { Px } from './paint.js';

const ease = t => t < 0 ? 0 : t > 1 ? 1 : 1 - (1 - t) ** 3;
const lerp = (a, b, t) => a + (b - a) * t;
// World position (art pixels) of a tile's top corner, before height.
const wxOf = (gx, gy) => (gx - gy) * 24, wyOf = (gx, gy) => (gx + gy) * 12;
export const worldOf = (row, col) => { const { gx, gy } = gridOf(row, col); return { x: wxOf(gx, gy), y: wyOf(gx, gy) }; };

const HIDDEN = 0, SEEN = 1, SHOWN = 2;

export class View {
  constructor(canvas) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.buf = document.createElement('canvas'); this.b = this.buf.getContext('2d');
    this.P = 3; this.zoomStep = 0; this.dpr = 1;
    this.cam = { x: 0, y: 0 }; this.camT = { x: 0, y: 0 }; this.pan = { x: 0, y: 0 };
    this.inset = { top: 0, bottom: 0 };
    this.cells = new Map();          // key → { vis, theme, trail, alt, grave, fade, from }
    this.opts = null;                // the ways ahead: { L: {row, col, theme, hidden, t}, R: … }
    this.hover = null;
    this.hero = null;                // { row, col, x, y, look, dir, walk: {from, to, t, dur, done} }
    this.foe = null;                 // { row, col, id, t, gone }
    this.parts = [];
    this.crowd = [];
    this.cache = new Map();
    this.t = 0;
    this.world = null; this.house = null;
    this.lifted = 0;                 // 0..1 while the fog lifts off the whole kingdom
    this.shape = null;               // the kingdom as it shows when it does: every tile between the crossroads and the throne
    this.mode = 'map';
    this.shakeT = 0;
    this.resize();
  }

  /* ---------- size and camera ---------- */
  resize() {
    const dpr = Math.min(3, window.devicePixelRatio || 1), W = this.cv.clientWidth, H = this.cv.clientHeight;
    this.dpr = dpr; this.cssW = W; this.cssH = H;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    const across = W < 700 ? 4.2 : 7.5;
    this.baseP = Math.max(Math.round(2 * dpr), Math.round(this.cv.width / (48 * across)));
    this.setZoom(this.zoomStep);
  }
  setZoom(step) {
    this.zoomStep = clamp(step, -4, 4);
    const k = [.34, .5, .67, .83, 1, 1.34, 1.67, 2, 2.5][this.zoomStep + 4];
    this.P = Math.max(1, Math.round(this.baseP * k));
    this.bw = Math.ceil(this.cv.width / this.P); this.bh = Math.ceil(this.cv.height / this.P);
    this.buf.width = this.bw; this.buf.height = this.bh;
    this.b.imageSmoothingEnabled = false;
  }
  // Where on the page (CSS pixels) a point of the world is.
  toScreen(wx, wy) {
    const { ox, oy } = this.origin();
    return { x: (wx - ox) * this.P / this.dpr, y: (wy - oy) * this.P / this.dpr };
  }
  screenOfCell(row, col, lift = 0) {
    const w = worldOf(row, col), c = this.world?.at(row, col);
    return this.toScreen(w.x, w.y + 12 - (c?.h || 0) * EL - lift);
  }
  // Where a way's label hangs: a pixel above its chevron (see marker), even at the top of the chevron's bob; or, when
  // there's no room above it, a pixel below it, even at the bottom.
  aboveMarker(row, col) { return this.screenOfCell(row, col, 47); }
  belowMarker(row, col) { return this.screenOfCell(row, col, 32); }
  origin() {
    // the camera's point sits in the middle of the part of the screen that isn't covered by the panels
    const top = this.inset.top * this.dpr / this.P, bottom = this.inset.bottom * this.dpr / this.P;
    const cx = Math.round(this.cam.x + this.pan.x), cy = Math.round(this.cam.y + this.pan.y);
    const sy = top + (this.bh - top - bottom) * .55;
    let ox = cx - Math.floor(this.bw / 2), oy = cy - Math.floor(sy);
    if (this.shakeT > 0) { ox += Math.round((Math.random() - .5) * 3 * this.shakeT); oy += Math.round((Math.random() - .5) * 2 * this.shakeT); }
    return { ox, oy };
  }
  focus(row, col, instant = false) {
    const w = worldOf(row, col);
    this.camT = { x: w.x, y: w.y + 4 };
    if (instant) this.cam = { ...this.camT };
  }
  // Which tile is under a point on the page.
  cellAt(px, py) {
    const { ox, oy } = this.origin();
    const wx = px * this.dpr / this.P + ox, wy = py * this.dpr / this.P + oy;
    let best = null, bestD = Infinity;
    const u = wx / 24, v = (wy - 12) / 12;
    const gx0 = Math.round((u + v) / 2), gy0 = Math.round((v - u) / 2);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const gx = gx0 + dx, gy = gy0 + dy;
      if (gx < 0 || gy < 0 || gx >= N || gy >= N) continue;
      const c = this.world?.cells[gy * N + gx], lift = (c?.h || 0) * EL;
      const cx = wxOf(gx, gy), cy = wyOf(gx, gy) + 12 - lift;
      const d = Math.abs(wx - cx) / 24 + Math.abs(wy - cy) / 12;
      if (d < bestD) { bestD = d; best = rowColOf(gx, gy); }
    }
    return bestD <= 1.1 ? best : null;
  }

  /* ---------- what the map shows ---------- */
  setHouse(house, world) { this.house = house; this.world = world; this.cache.clear(); this.cells.clear(); }
  cell(row, col) { const k = keyOf(row, col); let c = this.cells.get(k); if (!c) { c = { vis: HIDDEN, theme: null, trail: null, alt: false, fade: 1, from: HIDDEN }; this.cells.set(k, c); } return c; }
  setVis(row, col, vis, instant) {
    if (!inside(row, col)) return;
    const c = this.cell(row, col);
    if (vis > c.vis) { c.from = c.vis; c.vis = vis; c.fade = instant ? 1 : 0; }
  }
  // Forget everything on the map (a new life starts from the crossroads with fresh eyes).
  reset() { this.cells.clear(); this.opts = null; this.hero = null; this.foe = null; this.crowd = []; this.lifted = 0; this.shape = null; this.ceremony = null; this.dist = null; }
  // Rebuild what's known of the map from a life: the road walked so far, the ways not taken, what can be seen round it.
  // The roads the last few generations walked stay faintly known, in grey, with their graves at the ends.
  sync(life, instant = false) {
    for (const c of this.cells.values()) { c.theme = null; c.trail = null; c.alt = false; }
    for (const e of (this.house?.lineage || []).slice(-3)) {
      let r = 0, c = 0;
      const steps = [...(e.path || '')];
      steps.forEach((dir, i) => {
        r++; c += dir === 'L' ? -1 : 1;
        const cell = this.cell(r, c);
        if (cell.vis < SEEN) { cell.vis = SEEN; cell.fade = 1; }
        if (!cell.trail) cell.trail = { in: dir === 'L' ? 'R' : 'L', out: steps[i + 1] || null };
      });
    }
    let row = 0, col = 0;
    const walked = [[0, 0, 'crossroads']];
    for (let i = 0; i < life.path.length; i++) {
      const dir = life.path[i], log = life.log[i];
      const alt = log?.alt;
      if (alt) { const ar = row + 1, ac = col + (dir === 'L' ? 1 : -1); const c = this.cell(ar, ac); c.theme = alt; c.alt = true; }
      row++; col += dir === 'L' ? -1 : 1;
      walked.push([row, col, log?.tile || 'road']);
    }
    walked.forEach(([r, c, theme], i) => {
      const cell = this.cell(r, c);
      cell.theme = theme; cell.alt = false;
      const inDir = i > 0 ? life.path[i - 1] : null, outDir = i < life.path.length ? life.path[i] : null;
      // coming up-left you enter by the lower-right edge
      cell.trail = { in: inDir == null ? null : inDir === 'L' ? 'R' : 'L', out: outDir };
      this.setVis(r, c, SHOWN, instant);
      // everything touching the road is half seen: the eight tiles round each one
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if ((dr + dc) % 2 === 0 && (dr || dc) && Math.abs(dc) + Math.abs(dr) <= 2) this.setVis(r + dr, c + dc, SEEN, instant);
    });
    for (const c of this.cells.values()) if (c.alt) c.vis = Math.max(c.vis, SEEN);
    this.fogDistances();
    this.setGraves();
    this.here = { row, col };
    if (!this.hero || !this.hero.walk) this.placeHero(row, col, life);
  }
  // How far each tile is from anything known: fog is thick next to the road and thins into the night further off.
  fogDistances() {
    const dist = this.dist = new Uint8Array(N * N).fill(99), q = [];
    for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
      const { row, col } = rowColOf(gx, gy), c = this.cells.get(gy * N + gx);
      if (c && c.vis >= SEEN || this.opts && Object.values(this.opts).some(o => o.row === row && o.col === col)) { dist[gy * N + gx] = 0; q.push(gx, gy); }
    }
    for (let i = 0; i < q.length; i += 2) {
      const gx = q[i], gy = q[i + 1], d = dist[gy * N + gx] + 1;
      if (d > 6) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = gx + dx, y = gy + dy;
        if (x < 0 || y < 0 || x >= N || y >= N || dist[y * N + x] <= d) continue;
        dist[y * N + x] = d; q.push(x, y);
      }
    }
  }
  // The graves of those who went before, where they fell, and the throne rooms of those who were crowned.
  setGraves() {
    this.graves = new Map((this.house?.graves || []).map(g => [keyOf(g.row, g.col), g]));
    this.thrones = new Map((this.house?.thrones || []).map(g => [keyOf(g.row, g.col), g]));
  }
  placeHero(row, col, life) {
    const w = worldOf(row, col);
    this.hero = { row, col, x: w.x, y: w.y + 12, dir: this.hero?.dir || 'R', pose: 'front', walk: null,
      look: { look: life.heir.look, colour: this.house?.names?.arms ? armsColour(this.house.names.arms) : '#2f55a8', armor: life.armor, weapon: life.weapon, toad: life.traits.includes('toad'), crowned: false } };   // the crowning puts the crown on
  }
  updateLook(life) { if (this.hero) Object.assign(this.hero.look, { armor: life.armor, weapon: life.weapon, toad: life.traits.includes('toad') }); }
  // The two ways ahead, rising out of the fog.
  showOptions(life) {
    const cur = life.cur;
    if (!cur) { this.opts = null; return; }
    const ev = life.event;
    const lock = life.locks();
    const mk = (dir, opt) => ({ dir, row: life.row + 1, col: life.col + (dir === 'L' ? -1 : 1), theme: opt.tile, hidden: cur.hidden === dir, locked: !!lock[dir], t: 0 });
    this.opts = { L: mk('L', ev.left), R: mk('R', ev.right) };
    for (const o of Object.values(this.opts)) if (!o.hidden) this.burst(o.row, o.col, 'mist');
    this.fogDistances();
  }
  clearOptions() { this.opts = null; }

  /* ---------- your heir ---------- */
  walk(dir, done, dur = .65) {
    const h = this.hero; if (!h) return done?.();
    const to = { row: h.row + 1, col: h.col + (dir === 'L' ? -1 : 1) };
    const a = worldOf(h.row, h.col), b = worldOf(to.row, to.col);
    h.dir = dir; h.pose = 'back';
    h.walk = { from: { x: a.x, y: a.y + 12, h: this.world?.at(h.row, h.col)?.h || 0 }, to: { x: b.x, y: b.y + 12, h: this.world?.at(to.row, to.col)?.h || 0 }, t: 0, dur, done, target: to };
  }
  walkTo(row, col, done, dur = .3) {
    const h = this.hero; if (!h) return done?.();
    const a = { x: h.x, y: h.y }, b = worldOf(row, col);
    h.dir = col < h.col ? 'L' : 'R'; h.pose = row < h.row ? 'front' : 'back';
    h.walk = { from: { x: a.x, y: a.y, h: this.world?.at(h.row, h.col)?.h || 0 }, to: { x: b.x, y: b.y + 12, h: this.world?.at(row, col)?.h || 0 }, t: 0, dur, done, target: { row, col } };
  }
  showFoe(id) { const h = this.hero; if (!h) return; this.foe = { id, row: h.row, col: h.col, t: 0, gone: 0, sprite: foeArt(id) }; }
  foeFalls() { if (this.foe) this.foe.gone = .001; }
  foeLeaves() { this.foe = null; }
  clash(won) {
    const h = this.hero; if (!h) return;
    this.shakeT = .6;
    for (let i = 0; i < 18; i++) this.parts.push({ x: h.x + 8, y: h.y - 10, vx: (Math.random() - .5) * 60, vy: -Math.random() * 50, life: .6, t: 0, c: i % 3 ? '#ffe28a' : '#ffffff', g: 90 });
    if (!won) this.flashT = .25;
  }
  shake(k = .5) { this.shakeT = Math.max(this.shakeT, k); }

  /* ---------- particles ---------- */
  burst(row, col, kind) {
    const w = worldOf(row, col), c = this.world?.at(row, col), y = w.y + 12 - (c?.h || 0) * EL;
    if (kind === 'mist') for (let i = 0; i < 14; i++) this.parts.push({ x: w.x + (Math.random() - .5) * 40, y: y + (Math.random() - .5) * 16, vx: (Math.random() - .5) * 14, vy: -4 - Math.random() * 6, life: 1.1, t: 0, c: '#dfe4ee', size: 3, fade: true });
    if (kind === 'gold') for (let i = 0; i < 24; i++) this.parts.push({ x: w.x, y: y - 8, vx: (Math.random() - .5) * 70, vy: -30 - Math.random() * 50, life: 1.2, t: 0, c: ['#ffe28a', '#f2c24c', '#ffffff'][i % 3], g: 80 });
    if (kind === 'dark') for (let i = 0; i < 18; i++) this.parts.push({ x: w.x + (Math.random() - .5) * 16, y: y - 6, vx: (Math.random() - .5) * 20, vy: -10 - Math.random() * 20, life: 1.4, t: 0, c: i % 2 ? '#6a3a8a' : '#2a1a3a', size: 2, fade: true });
    if (kind === 'heal') for (let i = 0; i < 12; i++) this.parts.push({ x: w.x + (Math.random() - .5) * 14, y: y - 4, vx: 0, vy: -16 - Math.random() * 10, life: 1, t: 0, c: '#8fe07a' });
  }
  confetti(n = 80) {
    const { ox, oy } = this.origin();
    for (let i = 0; i < n; i++) this.parts.push({ x: ox + Math.random() * this.bw, y: oy - 10 - Math.random() * 60, vx: (Math.random() - .5) * 20, vy: 18 + Math.random() * 30, life: 5, t: 0,
      c: ['#e03a3a', '#f2c24c', '#ffffff', '#2f55a8', '#f07aa0', '#8fe07a'][i % 6], wob: Math.random() * 6, screen: false });
  }

  /* ---------- sprites ---------- */
  sprite(key, make) { let s = this.cache.get(key); if (!s) { s = make(); this.cache.set(key, s); } return s; }
  landFor(row, col, grey, trail) {
    const c = this.world.at(row, col);
    const tk = trail ? `${trail.in}${trail.out}` : '';
    return this.sprite(`l${c.gx},${c.gy},${grey ? 1 : 0},${tk}`, () => { const p = landSprite(c, 1, trail); return (grey ? p.fogged() : p).canvas(); });
  }
  structFor(row, col, theme, grey, trail) {
    const c = this.world.at(row, col);
    const tk = trail ? `${trail.in}${trail.out}` : '';
    const arms = this.house?.names?.arms;
    return this.sprite(`s${theme},${c.biome},${c.h},${grey ? 1 : 0},${tk}`, () => {
      const p = structureSprite(theme, { biome: c.biome, h: c.h, path: trail, arms: arms && { field: tinct(arms.field), tincture: tinct(arms.tincture) } });
      return (grey ? p.fogged() : p).canvas();
    });
  }
  fogFor(row, col) { const k = Math.floor(hash2(row, col, 3) * 4); return this.sprite('f' + k, () => fogSprite(k).canvas()); }
  heroSprite(look, pose, frame, flip) {
    const key = `h${JSON.stringify(look)}${pose}${frame}${flip}`;
    return this.sprite(key, () => { const p = hero(look, pose, frame); return (flip ? p.flip() : p).canvas(); });
  }

  /* ---------- a frame ---------- */
  frame(dt) {
    this.t += dt;
    const b = this.b, t = this.t;
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt * 1.6);
    if (this.flashT > 0) this.flashT -= dt;
    // camera (on the title, drifting slowly over the kingdom)
    if (this.drift) { const a = this.drift; this.camT.x = a.x + Math.sin(t * .05) * a.rx; this.camT.y = a.y + Math.cos(t * .037) * a.ry; }
    const k = 1 - Math.exp(-dt * (this.drift ? .8 : 4));
    this.cam.x += (this.camT.x - this.cam.x) * k; this.cam.y += (this.camT.y - this.cam.y) * k;
    // walking
    const h = this.hero;
    if (h?.walk) {
      const w = h.walk; w.t += dt / w.dur;
      const e = smooth(Math.min(1, w.t));
      h.x = lerp(w.from.x, w.to.x, e); h.y = lerp(w.from.y, w.to.y, e);
      h.hop = Math.abs(Math.sin(Math.min(1, w.t) * Math.PI * 2)) * 2;
      if (w.t >= 1) { h.row = w.target.row; h.col = w.target.col; h.walk = null; h.hop = 0; h.pose = w.pose || 'front'; w.done?.(); }
    }
    for (const c of this.cells.values()) if (c.fade < 1) c.fade = Math.min(1, c.fade + dt * 1.6);
    if (this.opts) for (const o of Object.values(this.opts)) o.t = Math.min(1, o.t + dt * 1.8);
    if (this.foe) { this.foe.t = Math.min(1, this.foe.t + dt * 3); if (this.foe.gone) this.foe.gone = Math.min(1, this.foe.gone + dt * 1.5); }

    // background: a dusk sky over a sea of cloud
    b.globalAlpha = 1;
    const sky = b.createLinearGradient(0, 0, 0, this.bh);
    sky.addColorStop(0, '#1d2340'); sky.addColorStop(.55, '#3a3a5e'); sky.addColorStop(1, '#5a5474');
    b.fillStyle = sky; b.fillRect(0, 0, this.bw, this.bh);
    const { ox, oy } = this.origin();
    this.drawClouds(ox, oy, t);

    // tiles, back to front
    if (!this.world) { this.blit(); return; }
    const gxy0 = Math.floor((oy - 40) / 12) - 2, gxy1 = Math.ceil((oy + this.bh + HEAD) / 12) + 2;
    const heroSum = h ? Math.round((gridOf(h.row, h.col).gx + gridOf(h.row, h.col).gy)) : -1;
    const walkSum = h?.walk ? Math.min(gridOf(h.walk.target.row, h.walk.target.col).gx + gridOf(h.walk.target.row, h.walk.target.col).gy, heroSum) : heroSum;
    for (let s = Math.max(D, gxy0); s <= Math.min(2 * D, gxy1); s++) {
      for (let gx = Math.max(0, s - D); gx <= Math.min(D, s); gx++) {
        const gy = s - gx;
        const x0 = wxOf(gx, gy) - 24 - ox, y0 = wyOf(gx, gy) - HEAD - oy;
        if (x0 > this.bw || x0 + 48 < 0 || y0 > this.bh || y0 + SPRITE.h < 0) continue;
        this.drawCell(gx, gy, x0, y0, t);
      }
      if (h && s === walkSum) this.drawHero(ox, oy, t);
      if (this.foe && h && s === walkSum) this.drawFoe(ox, oy, t);
    }
    this.drawCrowd(ox, oy, t);
    if (h && !this.lifted && !this.drift) { this.b.globalAlpha = .3; this.drawHero(ox, oy, t, true); this.b.globalAlpha = 1; }
    // particles
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
      p.vy += (p.g || 0) * dt; p.x += (p.vx + (p.wob ? Math.sin(t * 3 + p.wob) * 8 : 0)) * dt; p.y += p.vy * dt;
      b.globalAlpha = p.fade ? 1 - p.t / p.life : p.t > p.life - .3 ? (p.life - p.t) / .3 : 1;
      b.fillStyle = p.c; const s = p.size || 1;
      b.fillRect(Math.round(p.x - ox), Math.round(p.y - oy), s, s);
    }
    b.globalAlpha = 1;
    if (this.flashT > 0) { b.fillStyle = `rgba(200,40,40,${this.flashT})`; b.fillRect(0, 0, this.bw, this.bh); }
    this.blit();
  }
  blit() {
    const g = this.g;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.buf, 0, 0, this.bw * this.P, this.bh * this.P);
  }
  drawClouds(ox, oy, t) {
    const b = this.b;
    b.globalAlpha = .22;
    for (let i = 0; i < 14; i++) {
      const cx = ((i * 197 + t * (4 + (i % 3) * 2)) % 1400) - 300 + ox * .0 - ox * .3 % 1400, cy = (i * 131) % 900 - 200 - oy * .3;
      const x = ((cx % (this.bw + 300)) + this.bw + 300) % (this.bw + 300) - 150, y = ((cy % (this.bh + 200)) + this.bh + 200) % (this.bh + 200) - 100;
      b.fillStyle = i % 2 ? '#8a8aa8' : '#9a98b4';
      b.fillRect(Math.round(x), Math.round(y), 90, 6); b.fillRect(Math.round(x) + 12, Math.round(y) - 4, 60, 4); b.fillRect(Math.round(x) + 30, Math.round(y) - 7, 30, 3);
    }
    b.globalAlpha = 1;
  }
  drawCell(gx, gy, x0, y0, t) {
    const b = this.b;
    const { row, col } = rowColOf(gx, gy);
    const key = gy * N + gx;
    const c = this.cells.get(key) || { vis: HIDDEN, fade: 1, from: HIDDEN };
    // the fog lifting: a wave from the throne outward. Inside the kingdom the land comes up in colour; outside it, what
    // was glimpsed on the road melts away, and the map settles into its shape round the throne
    let lifted = 0, gone = 0;
    if (this.lifted > 0 && this.shape) {
      const f = this.liftFrom || this.shape, d = (Math.abs(gx - f.gx) + Math.abs(gy - f.gy)) / (2 * D);
      const k = clamp((this.lifted * 1.5 - d * 1.1 - hash2(gx, gy, 1) * .12) * 3, 0, 1);
      if (this.shape.has(gx, gy)) lifted = k; else gone = k;
    }
    const opt = this.opts && Object.values(this.opts).find(o => o.row === row && o.col === col);
    let vis = c.vis;
    if (opt && !opt.hidden) vis = SHOWN;
    const draw = (v, alpha, dy = 0) => {
      if (alpha <= 0) return;
      b.globalAlpha = alpha;
      if (v === HIDDEN) {
        const d = this.dist ? this.dist[key] : 2.6;
        const k = d >= 99 ? 0 : clamp(1.15 - d * .26, 0, 1);
        if (k <= 0) return;
        b.globalAlpha = alpha * k;
        b.drawImage(this.fogFor(row, col), x0, y0);
      } else {
        const grey = v === SEEN;
        const theme = opt && !opt.hidden ? opt.theme : c.theme || (this.thrones?.has(key) ? 'throne' : null);
        const img = theme ? this.structFor(row, col, theme, grey && !opt, c.trail) : this.landFor(row, col, grey, c.trail);
        b.drawImage(img, x0, y0 + dy);
        if (grey && !opt) { b.globalAlpha = alpha * .28; b.drawImage(this.fogFor(row, col), x0, y0); }
      }
      b.globalAlpha = 1;
    };
    if (gone >= 1) return;
    if (gone > 0) { draw(vis, 1 - gone); return; }
    // during the crowning, whatever stands in front of the throne room steps back, so you can see in
    const C = this.ceremony;
    if (C && row < C.row && row >= C.row - 3 && Math.abs(col - C.col) <= 2) { draw(vis, .22); return; }
    if (lifted > 0 && vis < SHOWN) { draw(vis, 1 - lifted); draw(SHOWN, lifted); this.drawFx(row, col, this.fxCell(c, key), x0, y0, t, lifted); return; }
    if (opt && !opt.hidden) {
      // a way ahead: rises out of the fog, and glows when you point at it
      const e = ease(opt.t), rise = Math.round((1 - e) * 14 + (e >= 1 ? (Math.sin(t * 2.4 + (opt.dir === 'L' ? 0 : 1.6)) > .3 ? 1 : 0) : 0));
      draw(c.vis, 1 - e);
      draw(SHOWN, e, rise);
      if (e > .5) this.drawFx(row, col, { ...c, theme: opt.theme }, x0, y0 + rise, t, e);
      if (opt.locked) { this.outline(x0, y0 + rise, row, col, .5 * e, '#8a8494'); this.marker(x0, y0 + rise, row, col, 0, e * .8, false, true); return; }
      const hot = this.hover === opt.dir;
      this.wash(x0, y0 + rise, row, col, (hot ? .22 : .1 + .06 * Math.sin(t * 3)) * e);
      this.outline(x0, y0 + rise, row, col, (hot ? 1 : .7 + .3 * Math.sin(t * 3)) * e, hot ? '#fff2b0' : '#f2c24c');
      this.marker(x0, y0 + rise, row, col, t + (opt.dir === 'L' ? 0 : .7), e, hot);
      return;
    }
    if (opt && opt.hidden) { draw(HIDDEN, 1); this.outline(x0, y0, row, col, .3 + .2 * Math.sin(t * 3), '#b8a0ff'); return; }
    if (c.fade < 1) { draw(c.from, 1 - c.fade); draw(vis, c.fade); }
    else draw(vis, 1);
    if (vis === SHOWN) this.drawFx(row, col, this.fxCell(c, key), x0, y0, t, 1);
    const grave = this.graves?.get(key);
    if (grave && vis >= SEEN) this.drawGrave(x0, y0, row, col, vis === SEEN);
  }
  // A cell as far as its little animations go: an ancestor's throne room glows like any other.
  fxCell(c, key) { return !c.theme && this.thrones?.has(key) ? { ...c, theme: 'throne' } : c; }
  // A soft gold wash over a tile's top, and a bobbing chevron above it: a way you could go.
  wash(x0, y0, row, col, a) {
    const b = this.b, c = this.world.at(row, col), y = y0 + HEAD - (c?.h || 0) * EL;
    b.globalAlpha = clamp(a, 0, 1); b.fillStyle = '#ffe28a';
    for (let j = 0; j < 24; j++) { const hw = j < 12 ? 2 * j + 2 : 2 * (23 - j) + 2; b.fillRect(x0 + 24 - hw, y + j, hw * 2, 1); }
    b.globalAlpha = 1;
  }
  marker(x0, y0, row, col, t, a, hot, locked = false) {
    const b = this.b, c = this.world.at(row, col), bob = locked ? 0 : Math.round(Math.sin(t * 3.2) * 1.5);
    if (locked) {
      // a grey cross: a way a curse won't let you take
      const x = x0 + 24, y = y0 + HEAD - (c?.h || 0) * EL - 28;
      b.globalAlpha = clamp(a, 0, 1);
      for (let i = -3; i <= 3; i++) { b.fillStyle = '#1c1622'; b.fillRect(x + i - 1, y + i - 1, 3, 3); b.fillRect(x + i - 1, y - i - 1, 3, 3); }
      for (let i = -3; i <= 3; i++) { b.fillStyle = '#b87aff'; b.fillRect(x + i, y + i, 1, 1); b.fillRect(x + i, y - i, 1, 1); }
      b.globalAlpha = 1;
      return;
    }
    const x = x0 + 24, y = y0 + HEAD - (c?.h || 0) * EL - 30 + bob - (hot ? 2 : 0);
    b.globalAlpha = clamp(a, 0, 1);
    const rows = [[-4, 9], [-3, 7], [-2, 5], [-1, 3], [0, 1]];
    b.fillStyle = '#1c1622';
    for (const [dy, w] of rows) b.fillRect(x - (w >> 1) - 1, y + dy + 4 - 1, w + 2, 3);
    b.fillStyle = hot ? '#fff2b0' : '#f2c24c';
    for (const [dy, w] of rows) b.fillRect(x - (w >> 1), y + dy + 4, w, 1);
    b.fillStyle = '#fff8d8'; b.fillRect(x - 3, y, 2, 1);
    b.globalAlpha = 1;
  }
  // A glowing edge round a tile's top: a way you could go.
  outline(x0, y0, row, col, a, colr) {
    const b = this.b, c = this.world.at(row, col), y = y0 + HEAD - (c?.h || 0) * EL;
    b.globalAlpha = clamp(a, 0, 1); b.fillStyle = colr;
    for (let i = 0; i < 24; i += 1) {
      const dy = Math.floor(i / 2);
      b.fillRect(x0 + 23 - i, y + dy, 1, 1); b.fillRect(x0 + 24 + i, y + dy, 1, 1);
      b.fillRect(x0 + 23 - i, y + 23 - dy, 1, 1); b.fillRect(x0 + 24 + i, y + 23 - dy, 1, 1);
    }
    b.globalAlpha = clamp(a, 0, 1) * .35;
    for (let i = 0; i < 23; i += 1) {
      const dy = Math.floor(i / 2);
      b.fillRect(x0 + 22 - i, y + dy + 1, 1, 1); b.fillRect(x0 + 25 + i, y + dy + 1, 1, 1);
      b.fillRect(x0 + 22 - i, y + 22 - dy, 1, 1); b.fillRect(x0 + 25 + i, y + 22 - dy, 1, 1);
    }
    b.globalAlpha = 1;
  }
  drawGrave(x0, y0, row, col, grey) {
    const b = this.b, c = this.world.at(row, col), x = x0 + 34, y = y0 + HEAD + 14 - (c?.h || 0) * EL;
    b.fillStyle = grey ? '#8a8a92' : '#b8b4aa'; b.fillRect(x, y - 6, 4, 6); b.fillRect(x + 1, y - 7, 2, 1);
    b.fillStyle = grey ? '#6a6a72' : '#7a766e'; b.fillRect(x + 3, y - 6, 1, 6); b.fillRect(x + 1, y - 4, 2, 1); b.fillRect(x + 1.5 | 0, y - 5, 1, 3);
  }
  // The small lives of a tile.
  drawFx(row, col, c, x0, y0, t, alpha) {
    if (!c.theme) return;
    const fx = fxOf(c.theme); if (!fx.length) return;
    const b = this.b, cc = this.world.at(row, col), cx = x0 + 24, cy = y0 + HEAD + 12 - (cc?.h || 0) * EL;
    const seed = row * 31 + col * 7;
    b.globalAlpha = alpha;
    for (const f of fx) {
      const x = cx + f.x, y = cy + f.y;
      switch (f.k) {
        case 'smoke': for (let i = 0; i < 5; i++) { const k = ((t * .35 + i / 5 + seed * .13) % 1); const px = x + Math.sin(k * 5 + i) * 2 + k * 5, py = y - k * 22; b.globalAlpha = alpha * (1 - k) * .75; b.fillStyle = f.green ? '#8ae07a' : f.purple ? '#c8a8f0' : f.dark ? '#5a5458' : '#d8d8e0'; const s = 2 + Math.round(k * 3); b.fillRect(Math.round(px - s / 2), Math.round(py), s, s); } break;
        case 'fire': { const n = f.big ? 10 : f.small ? 3 : 6; for (let i = 0; i < n; i++) { const k = (t * 2.2 + i / n + seed) % 1, px = x + Math.round((hash2(i, Math.floor(t * 8), seed) - .5) * (f.big ? 10 : 5)), py = y - k * (f.big ? 16 : 8); b.globalAlpha = alpha * (1 - k); b.fillStyle = k < .3 ? '#fff2a0' : k < .6 ? '#ffb040' : '#e0501a'; b.fillRect(px, Math.round(py), 1 + (k < .4 ? 1 : 0), 2); } break; }
        case 'glow': { const pulse = .55 + .25 * Math.sin(t * 2.3 + seed); b.globalAlpha = alpha * pulse * .5; b.fillStyle = f.c; const r = f.big ? 7 : 4; for (let j = -r; j <= r; j++) { const w = Math.round(Math.sqrt(r * r - j * j)); b.fillRect(x - w, y + j, w * 2, 1); } b.globalAlpha = alpha * pulse; b.fillRect(x - 1, y - 1, 2, 2); break; }
        case 'sparks': if ((t * 3 + seed) % 1 < .3) { b.fillStyle = '#ffd26a'; for (let i = 0; i < 3; i++) b.fillRect(x + Math.round((hash2(i, Math.floor(t * 10)) - .5) * 8), y - Math.round(hash2(Math.floor(t * 10), i) * 6), 1, 1); } break;
        case 'sails': { const a0 = t * 1.2; b.fillStyle = '#e8e0d0'; for (let s = 0; s < 4; s++) { const a = a0 + s * Math.PI / 2; for (let r = 2; r < 13; r++) { const px = Math.round(x + Math.cos(a) * r), py = Math.round(y + Math.sin(a) * r * .9); b.fillRect(px, py, 1, 1); if (r > 4) { b.fillStyle = '#c8b890'; b.fillRect(Math.round(px + Math.cos(a + 1.57) * 2), Math.round(py + Math.sin(a + 1.57) * 2), 1, 1); b.fillStyle = '#e8e0d0'; } } } b.fillStyle = '#5a3a24'; b.fillRect(x - 1, y - 1, 2, 2); break; }
        case 'flag': { const wave = Math.floor(t * 4 + seed) % 3; b.fillStyle = '#5a3a24'; b.fillRect(x, y, 1, 9); b.fillStyle = f.c; b.fillRect(x + 1, y + (wave === 1 ? 1 : 0), 3, 3); b.fillRect(x + 4, y + (wave === 2 ? 1 : 0), 2, 3); b.fillRect(x + 6, y + (wave === 0 ? 1 : 0), 1, 2); break; }
        case 'eyes': if (Math.sin(t * 1.3 + seed) > -.7) { b.fillStyle = f.c; b.fillRect(x - 2, y, 1, 1); b.fillRect(x + 1, y, 1, 1); } break;
        case 'glint': if ((t * .7 + seed) % 1 < .15) { b.fillStyle = '#ffffff'; b.fillRect(x, y - 1, 1, 3); b.fillRect(x - 1, y, 3, 1); } break;
        case 'candles': for (const [dx, dy] of f.pts) { const on = hash2(dx, Math.floor(t * 6 + dy), seed) > .15; if (on) { b.fillStyle = f.red ? '#ff5a3a' : '#ffd24a'; b.fillRect(cx + dx, cy + dy - 1, 1, 1); b.globalAlpha = alpha * .3; b.fillRect(cx + dx - 1, cy + dy - 2, 3, 3); b.globalAlpha = alpha; } } break;
        case 'motes': { const n = f.many ? 8 : 4; for (let i = 0; i < n; i++) { const k = (t * .25 + i / n + seed * .07) % 1; b.globalAlpha = alpha * Math.sin(k * Math.PI); b.fillStyle = f.c; b.fillRect(Math.round(x + Math.sin(t + i * 2.1) * (f.many ? 14 : 8)), Math.round(y - k * 14), 1, 1); } break; }
        case 'wisp': { const px = x + Math.sin(t * .9 + seed) * 6, py = y + Math.sin(t * 1.7 + seed) * 3; b.globalAlpha = alpha * .35; b.fillStyle = f.c; b.fillRect(Math.round(px) - 2, Math.round(py) - 2, 5, 5); b.globalAlpha = alpha; b.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2); break; }
        case 'bubbles': for (let i = 0; i < 3; i++) { const k = (t * .9 + i / 3) % 1; b.fillStyle = '#b8ff9a'; b.globalAlpha = alpha * (1 - k); b.fillRect(x + (i - 1) * 2, Math.round(y - k * 6), 1, 1); } break;
        case 'portal': for (let i = 0; i < 16; i++) { const a = t * 2.4 + i / 16 * Math.PI * 2, r = 3 + (i % 4) * 1.2; b.fillStyle = i % 3 ? '#b87aff' : '#ffffff'; b.fillRect(Math.round(x + Math.cos(a) * r * .8), Math.round(y + Math.sin(a) * r * 1.4), 1, 1); } break;
        case 'ripple': { const k = (t * .6 + seed) % 1, r = Math.round(2 + k * 8); b.globalAlpha = alpha * (1 - k); b.fillStyle = '#b8e0ff'; b.fillRect(x - r, y, 2, 1); b.fillRect(x + r - 1, y, 2, 1); b.fillRect(x - 1, y - (r >> 1), 2, 1); b.fillRect(x - 1, y + (r >> 1), 2, 1); break; }
        case 'sparkle': if ((t * 1.1 + seed * .3) % 1 < .35) { b.fillStyle = '#ffffff'; b.fillRect(x, y - 2, 1, 5); b.fillRect(x - 2, y, 5, 1); } break;
        case 'crow': { const flap = Math.sin(t * 9 + seed) > .6 && (t + seed) % 4 < 1; b.fillStyle = '#1a1620'; b.fillRect(x, y, 3, 2); b.fillRect(x + 2, y - 1, 1, 1); if (flap) { b.fillRect(x - 2, y - 2, 2, 1); b.fillRect(x + 3, y - 2, 2, 1); } break; }
      }
      b.globalAlpha = alpha;
    }
    b.globalAlpha = 1;
  }
  // The crowning: courtiers along the walls, the bishop by the throne, the crown coming down through the air, and a
  // burst of golden light when it lands.
  drawCeremony(ox, oy, t) {
    const C = this.ceremony, b = this.b;
    if (!C) return;
    const w = worldOf(C.row, C.col), cx = w.x - ox, cy = w.y + 12 - oy;
    for (const [dx, dy, k] of [[-17, -2, 3], [-13, 2, 11], [-9, 6, 17], [16, -2, 5], [12, 2, 23], [8, 6, 31]]) {
      const spr = this.sprite(`p${k}${Math.floor(t * 4 + k) % 2}`, () => peasant(k, Math.floor(t * 4 + k) % 2).canvas());
      b.drawImage(spr, cx + dx - 4, cy + dy - 14 + (C.cheer ? -(Math.floor(t * 6 + k) % 2) : 0));
    }
    const bs = this.sprite(`bishop${C.raise ? 1 : 0}`, () => bishop(C.raise ? 1 : 0).canvas());
    b.drawImage(bs, cx + 6, cy - 22);
    if (C.crown != null && C.crown < 1) {
      const k = smooth(C.crown), hx = this.hero.x - ox, hy = this.hero.y - oy - 26;
      const x = lerp(cx + 12, hx, k), y = lerp(cy - 30, hy, k) - Math.sin(k * Math.PI) * 10;
      const cs = this.sprite('crownS', () => crownSprite().canvas());
      b.drawImage(cs, Math.round(x - 4), Math.round(y));
    }
    if (C.rays > 0) {
      const hx = this.hero.x - ox, hy = this.hero.y - oy - 14;
      b.globalAlpha = Math.min(1, C.rays) * .8;
      b.fillStyle = '#ffe28a';
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + t * .4; for (let r = 8; r < 40; r += 2) { if ((r + i) % 4 < 2) b.fillRect(Math.round(hx + Math.cos(a) * r), Math.round(hy + Math.sin(a) * r * .7), 1, 1); } }
      b.globalAlpha = 1;
    }
  }
  drawHero(ox, oy, t, ghost = false) {
    const h = this.hero, b = this.b;
    if (this.ceremony && !ghost) this.drawCeremony(ox, oy, t);
    const moving = !!h.walk;
    const frame = moving ? [1, 0, 3, 0][Math.floor(t * 8) % 4] : 0;
    const pose = moving || h.pose === 'back' ? 'back' : 'front';
    const flip = h.dir === 'L';
    const img = this.heroSprite(h.look, pose, frame, flip);
    const cc = this.world?.at(h.row, h.col), lift = moving ? lerp(h.walk.from.h, h.walk.to.h, smooth(Math.min(1, h.walk.t))) * EL : (cc?.h || 0) * EL;
    const bob = moving ? Math.round(h.hop || 0) : Math.round(Math.sin(t * 2.2) * .6 + .4) * 0;
    const x = Math.round(h.x - ox - 8), y = Math.round(h.y - oy - 22 - lift - bob + 4);
    if (ghost) { b.drawImage(img, x, y); return; }
    // shadow
    b.globalAlpha = .35; b.fillStyle = '#10101a'; b.fillRect(x + 4, y + 21, 8, 2); b.fillRect(x + 5, y + 20, 6, 1); b.globalAlpha = 1;
    b.drawImage(img, x, y);
  }
  drawFoe(ox, oy, t) {
    const f = this.foe, h = this.hero, b = this.b;
    const spr = this.sprite(`foe${f.id}`, () => f.sprite.flip().canvas());
    const a = f.gone ? 1 - f.gone : ease(f.t);
    const cc = this.world?.at(h.row, h.col), lift = (cc?.h || 0) * EL;
    const x = Math.round(h.x - ox + 10 - spr.width / 2 + 8), y = Math.round(h.y - oy - spr.height + 4 - lift - (1 - ease(f.t)) * 6 + (f.gone ? f.gone * 6 : 0));
    b.globalAlpha = .35 * a; b.fillStyle = '#10101a'; b.fillRect(x + spr.width / 2 - 6, y + spr.height - 3, 12, 2); b.globalAlpha = a;
    b.drawImage(spr, x, y);
    b.globalAlpha = 1;
  }
  // The procession: the city opens up along the way, crowds line it, and petals fall.
  setCrowd(list) { this.crowd = list; }
  drawCrowd(ox, oy, t) {
    if (!this.crowd.length) return;
    const b = this.b;
    for (const p of this.crowd) {
      const spr = this.sprite(`p${p.k}${Math.floor(t * 4 + p.k) % 2}`, () => peasant(p.k, Math.floor(t * 4 + p.k) % 2).canvas());
      b.drawImage(spr, Math.round(p.x - ox - 4), Math.round(p.y - oy - 14));
    }
  }
  reveal(row, col, vis = SHOWN) { this.setVis(row, col, vis); }
  lift(t) { this.lifted = t; }
  // The kingdom's shape round a throne ('all' for the whole map, as in the intro, or null for none). The fog lifts,
  // and falls again, in a wave from origin: by default the throne.
  setShape(throne, origin) {
    this.shape = throne === 'all' ? { gx: 0, gy: 0, has: () => true } : throne ? kingdomOf(throne) : null;
    const o = origin || (throne && throne !== 'all' ? throne : null);
    this.liftFrom = o ? gridOf(o.row, o.col) : null;
  }
  // Zoom out and centre on the whole kingdom round a throne: the crossroads at the bottom, the throne room at the top,
  // and its two sides. Returns the camera point, for drifting about it.
  frameKingdom(throne) {
    const t = gridOf(throne.row, throne.col);
    const x0 = (t.gx - D) * 24 - 24, x1 = (D - t.gy) * 24 + 24, y0 = (t.gx + t.gy) * 12 - 40, y1 = 2 * D * 12 + 36;
    for (let z = 4; z >= -4; z--) {
      this.setZoom(z);
      const top = this.inset.top * this.dpr / this.P, bottom = this.inset.bottom * this.dpr / this.P;
      if (x1 - x0 <= this.bw && y1 - y0 <= this.bh - top - bottom) break;
    }
    const top = this.inset.top * this.dpr / this.P, bottom = this.inset.bottom * this.dpr / this.P, free = this.bh - top - bottom;
    // origin() puts the camera point 55% of the way down the free space; aim so the box sits in the middle of it
    this.camT = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + free * .05 };
    return { x: this.camT.x, y: this.camT.y, rx: Math.max(0, (this.bw - (x1 - x0)) / 3), ry: Math.max(0, (free - (y1 - y0)) / 3) };
  }
}

// A tincture name → a colour, for banners.
const TINCT = { or: '#f2c24c', argent: '#e9e6dc', gules: '#b8322f', azure: '#2f55a8', vert: '#2f7d47', sable: '#27242a', purpure: '#6d3a8f', tenne: '#b0642a' };
export const tinct = k => TINCT[k] || k;
export const armsColour = a => { const f = a.field in TINCT && !['or', 'argent'].includes(a.field) ? a.field : a.second in TINCT && !['or', 'argent'].includes(a.second) ? a.second : a.tincture; return tinct(['or', 'argent'].includes(f) ? 'azure' : f); };
export { HIDDEN, SEEN, SHOWN, Px };
