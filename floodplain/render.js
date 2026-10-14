// Floodplain: the view. The valley is drawn as a hand-coloured engraving of a diorama: a slab of ground cut
// out of the earth, seen from the south and a little above, with hatched strata on the cut faces.
import { KINDS } from './game.js';

export const PAL = {
  paper: '#efe6d0', paper2: '#e4d7b8', ink: '#2a241c', ink2: '#5a4c3a',
  grass: '#a7ad74', grass2: '#98a066', field: '#cfb565', field2: '#b99a48', bank: '#8f9a5a', rock: '#a29b8b',
  earth: ['#7d6145', '#8b6c4c', '#987a57', '#a68862', '#b2966e'],
  water: '#5d86a2', water2: '#4b7290', lake: '#456b88', foam: '#e9eef0', ice: '#d6e6ea', mud: '#6f5236',
  wall: '#f3ead4', thatch: '#c09346', roof2: '#9c7232', red: '#a3321f', flame: '#e8892c', flame2: '#f6c14a',
  wood: '#7a5634', tree: '#5e7040', tree2: '#4b5c33',
};

const K = 0.74;    // how squashed the top faces are
const HZ = 0.36;   // one step of height, as a fraction of a tile
const BASE = 1.1;  // how far the slab goes below height 0

// a cheap stable hash so stipple and tufts stay put
const hash = (a, b, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);

export class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.insets = { top: 0, bottom: 0 };
    this.S = 60; this.ox = 0; this.oy = 0;
    this.g = null;
    this.wet = null; this.wetFrom = null; this.wetT = null; this.wetTo = null;
    this.disp = new Map();   // unit id -> { x, y, hop, sink, alpha, k }
    this.fx = [];            // splashes, embers, rain
    this.burning = new Map(); // tile index -> start time
    this.hover = null; this.preview = null; this.forecast = null; this.tool = null; this.valid = null;
    this.pulse = null;       // tutorial pointer: {x, y}
    this.time = 0;
    this.showForecast = true;
    this.makePatterns();
  }

  makePatterns() {
    const mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d')); return this.ctx.createPattern(c, 'repeat'); };
    this.hatch = mk(8, 8, c => { c.strokeStyle = 'rgba(42,36,28,.32)'; c.lineWidth = 1; c.beginPath(); for (let i = -8; i <= 16; i += 4) { c.moveTo(i, 8); c.lineTo(i + 8, 0); } c.stroke(); });
    this.hatchBlue = mk(10, 10, c => { c.strokeStyle = 'rgba(40,90,140,.75)'; c.lineWidth = 2; c.beginPath(); for (let i = -10; i <= 20; i += 5) { c.moveTo(i, 10); c.lineTo(i + 10, 0); } c.stroke(); });
    this.hatchMud = mk(10, 10, c => { c.strokeStyle = 'rgba(90,60,30,.7)'; c.lineWidth = 2; c.beginPath(); for (let i = -10; i <= 20; i += 5) { c.moveTo(i, 0); c.lineTo(i + 10, 10); } c.stroke(); });
    this.grain = mk(64, 64, c => { for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(60,45,25,${.03 + Math.random() * .05})`; c.fillRect(Math.random() * 64, Math.random() * 64, 1, 1); } });
  }

  setGame(g) {
    this.g = g;
    const n = g.w * g.h;
    this.wet = new Float32Array(n); this.wetFrom = new Float32Array(n); this.wetTo = new Uint8Array(n); this.wetT = new Float64Array(n);
    for (let i = 0; i < n; i++) { this.wet[i] = this.wetTo[i] = g.water[i]; }
    this.disp.clear(); this.fx = []; this.burning.clear();
    this.syncUnits(true);
    this.layout();
  }

  // water changes: delays per tile from the flood's distance so it visibly runs downhill
  noteEvents(ev, now) {
    for (const e of ev || []) {
      if (e.type === 'wet') this.startWet(e.x, e.y, 1, now + e.d * 70);
      else if (e.type === 'dry') this.startWet(e.x, e.y, 0, now + 120);
      else if (e.type === 'drown') {
        const d = this.disp.get(e.id); if (d) { d.dieAt = now + e.d * 70 + 120; d.die = 'drown'; }
      } else if (e.type === 'washed') this.burning.set(this.g.idx(e.x, e.y), { t: now + e.d * 70 + 100, kind: 'wash' });
      else if (e.type === 'drain') this.noteEvents(e.ev, now);
    }
  }
  startWet(x, y, to, at) {
    const i = this.g.idx(x, y);
    this.wetFrom[i] = this.wet[i]; this.wetTo[i] = to; this.wetT[i] = at;
  }
  syncWater(now, instant = false) {
    const g = this.g;
    for (let i = 0; i < g.water.length; i++) {
      if (g.water[i] !== this.wetTo[i]) { this.wetFrom[i] = this.wet[i]; this.wetTo[i] = g.water[i]; this.wetT[i] = now; }
      if (instant) this.wet[i] = this.wetTo[i];
      else { const k = ease((now - this.wetT[i]) / 320); this.wet[i] = this.wetFrom[i] + (this.wetTo[i] - this.wetFrom[i]) * k; }
    }
  }
  syncUnits(instant = false) {
    for (const u of this.g.units) {
      let d = this.disp.get(u.id);
      if (!d) { d = { x: u.x, y: u.y, hop: 0, alpha: 1, k: u.k, born: this.time }; this.disp.set(u.id, d); }
      if (instant || !d.anim) { if (!d.die) { d.x = u.x; d.y = u.y; } }
      if (u.dead && !d.die && instant) d.gone = true;
    }
  }

  layout() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.cv.clientWidth, h = this.cv.clientHeight;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.dpr = dpr; this.W = w; this.H = h;
    if (!this.g) return;
    const g = this.g, maxH = Math.max(...g.ht);
    const top = this.insets.top + 14, bot = this.insets.bottom + 10, side = 14;
    const L0 = (this.insets.left || 0) + side, R0 = (this.insets.right || 0) + side;
    const availW = w - L0 - R0, availH = h - top - bot;
    const unitsH = g.h * K + (maxH + BASE) * HZ + 0.5;   // + room for things standing on the back row
    this.S = Math.max(24, Math.min(availW / g.w, availH / unitsH, 112));
    const bw = g.w * this.S, bh = unitsH * this.S;
    this.ox = Math.round(L0 + (availW - bw) / 2);
    this.oy = Math.round(top + (availH - bh) / 2 + (maxH * HZ + 0.5) * this.S);
  }

  // tile geometry
  topY(x, y, h) { return this.oy + y * this.S * K - h * this.S * HZ; }
  center(x, y, h = this.g.ht[this.g.idx(x, y)]) { return [this.ox + (x + 0.5) * this.S, this.topY(x, y, h) + this.S * K * 0.5]; }
  // which tile is under a screen point: front rows first, so a tall tile in front wins
  pick(px, py) {
    const g = this.g; if (!g) return null;
    for (let y = g.h - 1; y >= 0; y--) for (let x = 0; x < g.w; x++) {
      const h = g.ht[g.idx(x, y)], L = this.ox + x * this.S, T = this.topY(x, y, h);
      if (px >= L && px < L + this.S && py >= T && py < T + this.S * K + (h + BASE) * this.S * HZ) {
        // on the south face of this tile only counts if nothing in front covers it
        return { x, y };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- frame
  draw(now) {
    this.time = now;
    const { ctx, g } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = PAL.paper; ctx.fillRect(0, 0, this.W, this.H);
    ctx.fillStyle = this.grain; ctx.fillRect(0, 0, this.W, this.H);
    if (!g) return;
    this.syncWater(now);
    const S = this.S;

    // the slab's shadow on the page
    const by = this.topY(0, g.h, -BASE);
    ctx.fillStyle = 'rgba(60,45,25,.16)';
    ctx.beginPath(); ctx.ellipse(this.ox + g.w * S / 2 + S * .25, by + S * .12, g.w * S * .54, S * .32, 0, 0, Math.PI * 2); ctx.fill();

    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) this.block(x, y);
      for (let x = 0; x < g.w; x++) this.prop(x, y);
      this.unitsInRow(y);
    }
    this.overlays(now);
    this.drawFx(now);
  }

  block(x, y) {
    const { ctx, g, S } = this, i = g.idx(x, y), t = g.t[i], h = g.ht[i];
    const L = this.ox + x * S, T = this.topY(x, y, h), tw = S, th = S * K;
    const lw = Math.max(1, S / 60);
    // south face: strata by height, hatched
    const faceH = (h + BASE) * S * HZ;
    for (let k = -1; k < h; k++) {
      const y0 = T + th + (h - 1 - k) * S * HZ, hh = k === -1 ? S * HZ * BASE : S * HZ;
      ctx.fillStyle = t === '^' ? '#8d877a' : PAL.earth[clamp(k + 1, 0, 4)];
      ctx.fillRect(L, y0, tw + .5, hh + .5);
    }
    ctx.fillStyle = this.hatch; ctx.fillRect(L, T + th, tw + .5, faceH);
    ctx.fillStyle = 'rgba(30,20,10,.22)'; ctx.fillRect(L, T + th, tw + .5, Math.min(faceH, S * .05));
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw;
    // strata lines
    ctx.globalAlpha = .35; ctx.beginPath();
    for (let k = 0; k < h; k++) { const yy = T + th + (k + 1) * S * HZ; ctx.moveTo(L, yy); ctx.lineTo(L + tw, yy); }
    ctx.stroke(); ctx.globalAlpha = 1;
    // waterfall down the face, if this is water and the tile in front is lower water
    const wv = this.wet[i];
    if (wv > .02 && y + 1 < g.h) {
      const fi = g.idx(x, y + 1), fh = g.ht[fi];
      if (fh < h && this.wet[fi] > .02) {
        const drop = (h - fh) * S * HZ;
        ctx.globalAlpha = Math.min(wv, this.wet[fi]);
        const gr = ctx.createLinearGradient(0, T + th, 0, T + th + drop);
        gr.addColorStop(0, PAL.water); gr.addColorStop(1, '#8fb0c4');
        ctx.fillStyle = gr; ctx.fillRect(L + tw * .08, T + th - 1, tw * .84, drop + 2);
        ctx.strokeStyle = 'rgba(240,245,246,.8)'; ctx.lineWidth = lw;
        ctx.beginPath();
        for (let s = 0; s < 7; s++) {
          const xx = L + tw * (.13 + s * .12), ph = (this.time / 520 + hash(x, s)) % 1;
          const y0 = T + th + ph * drop * .7, len = drop * .3;
          ctx.moveTo(xx, y0); ctx.quadraticCurveTo(xx + S * .015, y0 + len / 2, xx, Math.min(T + th + drop, y0 + len));
        }
        ctx.stroke();
        // foam where it lands
        ctx.fillStyle = 'rgba(240,245,246,.75)';
        for (let s = 0; s < 5; s++) { ctx.beginPath(); ctx.arc(L + tw * (.15 + s * .17), T + th + drop + S * .01, S * (.025 + .015 * Math.sin(this.time / 200 + s * 2)), 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
    }
    // side edges where the neighbour is lower: an ink line
    // top face
    ctx.fillStyle = this.topColor(t, x, y);
    ctx.fillRect(L, T, tw + .5, th + .5);
    // higher ground catches more light
    if (h !== 2) { ctx.fillStyle = h > 2 ? `rgba(255,248,220,${(h - 2) * .13})` : `rgba(40,50,30,${(2 - h) * .1})`; ctx.fillRect(L, T, tw + .5, th + .5); }
    this.decal(t, x, y, L, T, tw, th);
    // shadow from a taller neighbour to the west
    if (x > 0) {
      const lh = g.ht[g.idx(x - 1, y)] - h;
      if (lh > 0) { const gr = ctx.createLinearGradient(L, 0, L + tw * .45, 0); gr.addColorStop(0, `rgba(40,30,20,${.12 + .08 * lh})`); gr.addColorStop(1, 'rgba(40,30,20,0)'); ctx.fillStyle = gr; ctx.fillRect(L, T, tw * .45, th); }
    }
    // water / ice / mud on top
    if (g.mud[i] && wv < .5) { ctx.fillStyle = PAL.mud; ctx.globalAlpha = .82; ctx.fillRect(L, T, tw, th); ctx.globalAlpha = 1; this.mudDabs(x, y, L, T, tw, th); }
    if (wv > .01) this.waterTop(i, x, y, L, T, tw, th, wv);
    if (g.ice[i]) this.iceTop(x, y, L, T, tw, th);
    // outline: ink where the ground steps down to a neighbour
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw;
    ctx.beginPath();
    const nb = (dx, dy) => g.inb(x + dx, y + dy) ? g.ht[g.idx(x + dx, y + dy)] : -9;
    if (nb(0, -1) < h) { ctx.moveTo(L, T); ctx.lineTo(L + tw, T); }
    if (nb(-1, 0) < h) { ctx.moveTo(L, T); ctx.lineTo(L, T + th + faceH); }
    if (nb(1, 0) < h) { ctx.moveTo(L + tw, T); ctx.lineTo(L + tw, T + th + faceH); }
    ctx.moveTo(L, T + th); ctx.lineTo(L + tw, T + th);
    if (y === g.h - 1 || nb(0, 1) < h) { ctx.moveTo(L, T + th + faceH); ctx.lineTo(L + tw, T + th + faceH); }
    ctx.stroke();
    // faint grid on the tops
    ctx.strokeStyle = 'rgba(42,36,28,.13)'; ctx.lineWidth = lw * .8;
    ctx.strokeRect(L + .5, T + .5, tw - 1, th - 1);
  }

  topColor(t, x, y) {
    if (t === ',') return PAL.field;
    if (t === '^') return PAL.rock;
    if (t === '#' || t === 'G' || t === 'O') return PAL.grass2;
    if (t === 'X') return '#9b9070';
    return hash(x, y) < .5 ? PAL.grass : PAL.grass2;
  }

  decal(t, x, y, L, T, tw, th) {
    const { ctx, S } = this;
    if (t === ',') {   // furrows
      ctx.strokeStyle = PAL.field2; ctx.lineWidth = Math.max(1, S / 34); ctx.beginPath();
      for (let k = 1; k < 6; k++) { const yy = T + th * k / 6; ctx.moveTo(L + 3, yy); ctx.lineTo(L + tw - 3, yy); }
      ctx.stroke();
      return;
    }
    if (t === '#' || t === 'G' || t === 'O') {   // a turf levee along the bank
      const g = this.g;
      const isB = (dx, dy) => g.inb(x + dx, y + dy) && '#GO'.includes(g.t[g.idx(x + dx, y + dy)]);
      const vert = isB(0, -1) || isB(0, 1) || !(isB(-1, 0) || isB(1, 0));
      const lw = Math.max(1, S / 60);
      ctx.save();
      ctx.beginPath(); ctx.rect(L, T, tw, th); ctx.clip();
      if (vert) {
        const a0 = isB(0, -1) ? T - 2 : T + th * .1, a1 = isB(0, 1) ? T + th + 2 : T + th * .9;
        ctx.fillStyle = '#6f7d42'; ctx.fillRect(L + tw * .14, a0, tw * .72, a1 - a0);
        ctx.fillStyle = '#9aa765'; ctx.fillRect(L + tw * .28, a0, tw * .3, a1 - a0);
        ctx.fillStyle = this.hatch; ctx.fillRect(L + tw * .62, a0, tw * .24, a1 - a0);
        ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw; ctx.beginPath();
        ctx.moveTo(L + tw * .14, a0); ctx.lineTo(L + tw * .14, a1); ctx.moveTo(L + tw * .86, a0); ctx.lineTo(L + tw * .86, a1);
        if (!isB(0, -1)) { ctx.moveTo(L + tw * .14, a0); ctx.lineTo(L + tw * .86, a0); }
        if (!isB(0, 1)) { ctx.moveTo(L + tw * .14, a1); ctx.lineTo(L + tw * .86, a1); }
        ctx.stroke();
      } else {
        const a0 = isB(-1, 0) ? L - 2 : L + tw * .1, a1 = isB(1, 0) ? L + tw + 2 : L + tw * .9;
        ctx.fillStyle = '#6f7d42'; ctx.fillRect(a0, T + th * .14, a1 - a0, th * .72);
        ctx.fillStyle = '#9aa765'; ctx.fillRect(a0, T + th * .18, a1 - a0, th * .3);
        ctx.fillStyle = this.hatch; ctx.fillRect(a0, T + th * .6, a1 - a0, th * .26);
        ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw; ctx.beginPath();
        ctx.moveTo(a0, T + th * .14); ctx.lineTo(a1, T + th * .14); ctx.moveTo(a0, T + th * .86); ctx.lineTo(a1, T + th * .86); ctx.stroke();
      }
      // tufts
      ctx.strokeStyle = 'rgba(42,36,28,.45)'; ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = hash(x, y, k), b = hash(y, x, k + 9);
        const px = vert ? L + tw * (.25 + .5 * a) : L + tw * (.1 + .8 * a), py = vert ? T + th * (.1 + .8 * b) : T + th * (.25 + .5 * b);
        ctx.moveTo(px, py); ctx.lineTo(px - S * .025, py - S * .045); ctx.moveTo(px, py); ctx.lineTo(px + S * .025, py - S * .045);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (t === '^') return;
    // grass stipple
    ctx.fillStyle = 'rgba(42,36,28,.28)';
    const n = 9;
    for (let k = 0; k < n; k++) {
      const a = hash(x, y, k), b = hash(y + 31, x, k);
      ctx.fillRect(L + tw * (.06 + .88 * a), T + th * (.08 + .84 * b), Math.max(1, S / 50), Math.max(1, S / 50));
    }
  }

  mudDabs(x, y, L, T, tw, th) {
    const { ctx, S } = this;
    ctx.fillStyle = 'rgba(30,20,10,.35)';
    for (let k = 0; k < 6; k++) {
      const a = hash(x, y, k + 40), b = hash(x, y, k + 80);
      ctx.beginPath(); ctx.ellipse(L + tw * (.12 + .76 * a), T + th * (.15 + .7 * b), S * .07, S * .03, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(240,230,210,.35)'; ctx.lineWidth = Math.max(1, S / 70); ctx.beginPath();
    for (let k = 0; k < 3; k++) { const a = hash(x, y, k + 120), b = hash(x, y, k + 160); ctx.moveTo(L + tw * (.15 + .6 * a), T + th * (.2 + .6 * b)); ctx.lineTo(L + tw * (.27 + .6 * a), T + th * (.2 + .6 * b)); }
    ctx.stroke();
  }

  waterTop(i, x, y, L, T, tw, th, wv) {
    const { ctx, g, S } = this, t = g.t[i];
    const inset = S * HZ * .12;
    ctx.globalAlpha = clamp(wv * 1.4, 0, 1);
    ctx.fillStyle = t === 'L' ? PAL.lake : PAL.water;
    // the water fills in from the middle as it arrives
    const k = clamp(wv, 0, 1);
    const cx = L + tw / 2, cy = T + th / 2;
    const w = tw * (0.35 + 0.65 * k), h = th * (0.35 + 0.65 * k);
    ctx.fillRect(cx - w / 2, cy - h / 2 + inset * k, w + .5, h - inset * k + .5);
    // engraved ripple lines drifting downstream
    if (k > .6) {
      ctx.strokeStyle = 'rgba(233,238,240,.55)'; ctx.lineWidth = Math.max(1, S / 55);
      ctx.beginPath();
      const ph = this.time / 1300;
      for (let r = 0; r < 3; r++) {
        const yy = T + th * (.25 + r * .25) + inset;
        const off = ((ph + hash(x, y, r)) % 1) * tw * .5;
        const x0 = L + tw * .08 + off * .5, len = tw * (.28 + .15 * hash(y, x, r));
        ctx.moveTo(x0, yy);
        for (let s = 1; s <= 6; s++) ctx.lineTo(x0 + len * s / 6, yy + Math.sin(s * 1.6 + ph * 6 + r) * S * .012);
      }
      ctx.stroke();
    }
    if (t === 'S') {   // the spring bubbles
      ctx.strokeStyle = PAL.foam; ctx.lineWidth = Math.max(1, S / 50);
      for (let r = 0; r < 2; r++) {
        const p = (this.time / 1600 + r * .5) % 1;
        ctx.globalAlpha = (1 - p) * .8;
        ctx.beginPath(); ctx.ellipse(cx, cy, tw * .38 * p + 2, th * .38 * p + 1, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  iceTop(x, y, L, T, tw, th) {
    const { ctx, S } = this;
    ctx.fillStyle = PAL.ice; ctx.fillRect(L + 1, T + 1, tw - 2, th - 2);
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(L + tw * .1, T + th * .12, tw * .5, th * .1);
    ctx.strokeStyle = 'rgba(70,110,135,.7)'; ctx.lineWidth = Math.max(1, S / 60); ctx.beginPath();
    const a = hash(x, y, 7), b = hash(x, y, 8);
    ctx.moveTo(L + tw * .15, T + th * (.4 + .3 * a)); ctx.lineTo(L + tw * .45, T + th * .55); ctx.lineTo(L + tw * .8, T + th * (.3 + .4 * b));
    ctx.moveTo(L + tw * .45, T + th * .55); ctx.lineTo(L + tw * .55, T + th * .9);
    ctx.stroke();
  }

  // ---------------------------------------------------------------- things standing on tiles
  prop(x, y) {
    const { g } = this, i = g.idx(x, y), t = g.t[i];
    const [cx, cy] = this.center(x, y);
    if (t === 'T') this.trees(x, y, cx, cy);
    else if (t === '^') this.boulder(x, y, cx, cy);
    else if (t === 'H') this.cottage(cx, cy, i);
    else if (t === 'X') this.ruin(cx, cy, i);
    else if (t === 'G' || t === 'O') this.gate(cx, cy, t === 'O', x, y);
  }

  trees(x, y, cx, cy) {
    const { ctx, S } = this, lw = Math.max(1, S / 55);
    const spots = [[-.2, -.02, .2], [.18, .1, .17], [.02, .22, .14]];
    for (const [dx, dy, r0] of spots) {
      const r = S * r0 * (0.9 + .2 * hash(x, y, dx * 10 | 0));
      const bx = cx + dx * S, byy = cy + dy * S * K;
      const sway = Math.sin(this.time / 1100 + x + y * 2 + dx * 5) * S * .008;
      ctx.fillStyle = PAL.wood; ctx.fillRect(bx - S * .02, byy - r * .9, S * .04, r * .9);
      ctx.fillStyle = 'rgba(40,30,20,.18)'; ctx.beginPath(); ctx.ellipse(bx + r * .3, byy, r * .9, r * .3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PAL.tree; ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(bx + sway, byy - r * 1.5, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.clip(); ctx.fillStyle = this.hatch; ctx.fillRect(bx, byy - r * 2.5, r * 1.2, r * 2); ctx.restore();
      ctx.fillStyle = 'rgba(255,250,220,.25)'; ctx.beginPath(); ctx.arc(bx + sway - r * .3, byy - r * 1.8, r * .35, 0, Math.PI * 2); ctx.fill();
    }
  }

  boulder(x, y, cx, cy) {
    const { ctx, S } = this;
    ctx.fillStyle = '#8f897b'; ctx.strokeStyle = PAL.ink; ctx.lineWidth = Math.max(1, S / 55);
    ctx.beginPath();
    const pts = 7, r = S * .32;
    for (let k = 0; k < pts; k++) {
      const a = Math.PI + (k / (pts - 1)) * Math.PI, rr = r * (0.8 + .3 * hash(x, y, k));
      ctx.lineTo(cx + Math.cos(a) * rr * 1.1, cy + S * .12 + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip(); ctx.fillStyle = this.hatch; ctx.fillRect(cx, cy - r, r * 1.2, r * 1.3); ctx.restore();
  }

  cottage(cx, cy, i, a = 1) {
    const { ctx, S } = this, lw = Math.max(1, S / 50);
    const w = S * .3, hgt = S * .26;
    const by = cy + S * .1;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(40,30,20,.2)'; ctx.beginPath(); ctx.ellipse(cx + S * .08, by, S * .4, S * .1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw;
    // wall
    ctx.fillStyle = PAL.wall; ctx.fillRect(cx - w, by - hgt, w * 2, hgt); ctx.strokeRect(cx - w, by - hgt, w * 2, hgt);
    // door and window
    ctx.fillStyle = PAL.wood; ctx.fillRect(cx - w * .7, by - hgt * .65, w * .38, hgt * .65);
    ctx.fillStyle = '#e9c45a'; ctx.fillRect(cx + w * .15, by - hgt * .7, w * .45, hgt * .32);
    ctx.strokeRect(cx + w * .15, by - hgt * .7, w * .45, hgt * .32);
    // thatched roof, receding
    ctx.fillStyle = PAL.thatch;
    ctx.beginPath(); ctx.moveTo(cx - w * 1.25, by - hgt); ctx.lineTo(cx + w * 1.25, by - hgt); ctx.lineTo(cx + w * .95, by - hgt - S * .28); ctx.lineTo(cx - w * .95, by - hgt - S * .28); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = PAL.roof2; ctx.lineWidth = lw; ctx.beginPath();
    for (let k = -6; k <= 6; k++) { ctx.moveTo(cx + k * w * .2, by - hgt); ctx.lineTo(cx + k * w * .16, by - hgt - S * .28); }
    ctx.stroke(); ctx.restore();
    // chimney with a wisp
    ctx.fillStyle = '#b5a48a'; ctx.fillRect(cx + w * .45, by - hgt - S * .36, S * .07, S * .12); ctx.strokeRect(cx + w * .45, by - hgt - S * .36, S * .07, S * .12);
    ctx.strokeStyle = 'rgba(90,80,70,.35)'; ctx.beginPath();
    const sx = cx + w * .45 + S * .035, sy = by - hgt - S * .38;
    for (let k = 0; k < 8; k++) ctx.lineTo(sx + Math.sin(this.time / 500 + k * .8) * S * .03 + k * S * .01, sy - k * S * .025);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ruin(cx, cy, i) {
    const { ctx, S } = this, lw = Math.max(1, S / 50);
    const b = this.burning.get(i);
    const by = cy + S * .1, w = S * .3;
    const washed = b?.kind === 'wash';
    // if it only just fell, show the cottage burning first
    if (b && this.time < b.t + 700) {
      const p = clamp((this.time - b.t) / 700, 0, 1);
      if (this.time < b.t) { this.cottage(cx, cy, i); return; }
      this.cottage(cx, cy, i, 1 - p);
      if (!washed) this.flames(cx, by - S * .3, S * .5 * (1 - p * .5));
    }
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw;
    ctx.fillStyle = washed ? '#8a7656' : '#4a3d32';
    ctx.beginPath(); ctx.moveTo(cx - w, by); ctx.lineTo(cx - w, by - S * .12); ctx.lineTo(cx - w * .5, by - S * .06); ctx.lineTo(cx - w * .1, by - S * .14); ctx.lineTo(cx + w * .4, by - S * .05); ctx.lineTo(cx + w, by - S * .1); ctx.lineTo(cx + w, by); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - w * .8, by - S * .05); ctx.lineTo(cx + w * .2, by - S * .25); ctx.moveTo(cx - w * .1, by - S * .02); ctx.lineTo(cx + w * .9, by - S * .2); ctx.stroke();
    if (!washed) {   // smoke
      ctx.strokeStyle = 'rgba(70,60,50,.3)'; ctx.lineWidth = lw * 2; ctx.beginPath();
      for (let k = 0; k < 10; k++) ctx.lineTo(cx + Math.sin(this.time / 700 + k * .7) * S * .05 + k * S * .015, by - S * .2 - k * S * .04);
      ctx.stroke();
    }
  }

  gate(cx, cy, open, x, y) {
    const { ctx, S } = this, lw = Math.max(1, S / 45);
    const w = S * .3, by = cy + S * .12, top = by - S * .5;
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw;
    // paddle: down when shut, raised when open
    const lift = open ? S * .26 : 0;
    ctx.fillStyle = '#8b6a43';
    ctx.fillRect(cx - w * .8, by - S * .3 - lift, w * 1.6, S * .3); ctx.strokeRect(cx - w * .8, by - S * .3 - lift, w * 1.6, S * .3);
    ctx.beginPath(); for (let k = 1; k < 4; k++) { const xx = cx - w * .8 + w * 1.6 * k / 4; ctx.moveTo(xx, by - S * .3 - lift); ctx.lineTo(xx, by - lift); } ctx.stroke();
    // posts and the beam
    ctx.fillStyle = PAL.wood;
    ctx.fillRect(cx - w - S * .05, top, S * .07, by - top); ctx.strokeRect(cx - w - S * .05, top, S * .07, by - top);
    ctx.fillRect(cx + w - S * .02, top, S * .07, by - top); ctx.strokeRect(cx + w - S * .02, top, S * .07, by - top);
    ctx.fillRect(cx - w - S * .08, top - S * .02, w * 2 + S * .16, S * .06); ctx.strokeRect(cx - w - S * .08, top - S * .02, w * 2 + S * .16, S * .06);
    // wheel
    ctx.fillStyle = '#c9b48a'; ctx.beginPath(); ctx.arc(cx, top - S * .03, S * .07, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (open) {   // water rushing through
      ctx.strokeStyle = PAL.foam; ctx.lineWidth = lw; ctx.beginPath();
      for (let k = 0; k < 3; k++) { const ph = ((this.time / 300 + k / 3) % 1); ctx.moveTo(cx - w * .7 + ph * w * 1.4, by - S * .06 - k * S * .04); ctx.lineTo(cx - w * .7 + ph * w * 1.4 + S * .08, by - S * .06 - k * S * .04); }
      ctx.stroke();
    }
  }

  flames(x, y, s) {
    const { ctx } = this, t = this.time / 90;
    ctx.fillStyle = PAL.flame;
    ctx.beginPath(); ctx.moveTo(x - s * .4, y + s * .3);
    for (let k = 0; k <= 6; k++) { const xx = x - s * .4 + s * .8 * k / 6, tall = (k % 2 ? .4 : 1) * s * (0.8 + .25 * Math.sin(t + k * 2)); ctx.lineTo(xx, y + s * .3 - tall); }
    ctx.lineTo(x + s * .4, y + s * .3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = PAL.flame2;
    ctx.beginPath(); ctx.ellipse(x, y + s * .1, s * .18, s * .28 * (1 + .15 * Math.sin(t * 1.3)), 0, 0, Math.PI * 2); ctx.fill();
  }

  // ---------------------------------------------------------------- raiders
  unitsInRow(row) {
    for (const [id, d] of this.disp) {
      if (d.gone) continue;
      if (Math.ceil(d.y - .001) !== row) continue;
      this.raider(d, id);
    }
  }
  raider(d, id) {
    const { ctx, S, g } = this;
    const fx = Math.floor(d.x), fy = Math.floor(d.y), tx = Math.min(g.w - 1, fx + 1), ty = Math.min(g.h - 1, fy + 1);
    // height under a moving raider: blend between tiles
    const hAt = (x, y) => g.ht[g.idx(clamp(Math.round(x), 0, g.w - 1), clamp(Math.round(y), 0, g.h - 1))];
    const h = d.hOverride ?? hAt(d.x, d.y);
    const cx = this.ox + (d.x + .5) * S, cy = this.topY(d.x, d.y, h) + S * K * .55 - (d.hop || 0) * S * .12;
    let sink = 0, alpha = d.alpha ?? 1;
    if (d.die === 'drown' && this.time > d.dieAt) {
      const p = clamp((this.time - d.dieAt) / 900, 0, 1);
      sink = p; alpha = 1 - p * p;
      if (p >= 1) { d.gone = true; return; }
      if (!d.splashed) { d.splashed = true; this.fx.push({ type: 'splash', x: cx, y: cy, t: this.time }); this.onSplash?.(); }
    }
    if (d.arrive) { const p = clamp((this.time - d.arrive) / 500, 0, 1); alpha *= p; }
    const preview = this.preview?.drown?.has(id);
    ctx.save();
    ctx.globalAlpha = alpha;
    // clip below the waterline when sinking
    if (sink > 0) { ctx.beginPath(); ctx.rect(cx - S, cy - S * 2, S * 2, S * 2 + S * .02); ctx.clip(); }
    const yb = cy + sink * S * .45;
    this.figure(d.k, cx, yb, S * 1.2, preview);
    ctx.restore();
  }
  figure(k, cx, yb, S, marked) {
    const { ctx } = this, lw = Math.max(1, S / 50), t = this.time;
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw;
    ctx.fillStyle = 'rgba(40,30,20,.25)'; ctx.beginPath(); ctx.ellipse(cx + S * .04, yb, S * .17, S * .05, 0, 0, Math.PI * 2); ctx.fill();
    if (k === 'horse') {
      // horse body, legs, head
      ctx.fillStyle = '#5b4330';
      ctx.beginPath(); ctx.ellipse(cx, yb - S * .2, S * .2, S * .09, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); for (const lx of [-.14, -.06, .07, .14]) { ctx.moveTo(cx + lx * S, yb - S * .14); ctx.lineTo(cx + lx * S + Math.sin(t / 120 + lx * 20) * S * .015, yb); } ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + S * .15, yb - S * .24); ctx.lineTo(cx + S * .27, yb - S * .38); ctx.lineTo(cx + S * .31, yb - S * .33); ctx.lineTo(cx + S * .2, yb - S * .2); ctx.closePath(); ctx.fill(); ctx.stroke();
      // rider
      ctx.fillStyle = PAL.red;
      ctx.beginPath(); ctx.moveTo(cx - S * .08, yb - S * .26); ctx.lineTo(cx + S * .06, yb - S * .26); ctx.lineTo(cx + S * .03, yb - S * .48); ctx.lineTo(cx - S * .05, yb - S * .48); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e2c8a0'; ctx.beginPath(); ctx.arc(cx - S * .01, yb - S * .53, S * .05, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.moveTo(cx - S * .07, yb - S * .55); ctx.lineTo(cx + S * .05, yb - S * .55); ctx.lineTo(cx - S * .01, yb - S * .64); ctx.closePath(); ctx.fill();
      // torch
      ctx.strokeStyle = PAL.wood; ctx.lineWidth = lw * 1.6; ctx.beginPath(); ctx.moveTo(cx + S * .04, yb - S * .38); ctx.lineTo(cx + S * .12, yb - S * .58); ctx.stroke();
      this.flames(cx + S * .125, yb - S * .62, S * .1);
    } else {
      const torch = k === 'torch';
      // legs
      ctx.beginPath(); ctx.moveTo(cx - S * .04, yb - S * .12); ctx.lineTo(cx - S * .05, yb); ctx.moveTo(cx + S * .04, yb - S * .12); ctx.lineTo(cx + S * .05, yb); ctx.stroke();
      // cloak
      ctx.fillStyle = torch ? '#7b2a4a' : PAL.red;
      ctx.beginPath(); ctx.moveTo(cx - S * .11, yb - S * .1); ctx.lineTo(cx + S * .11, yb - S * .1); ctx.lineTo(cx + S * .06, yb - S * .36); ctx.lineTo(cx - S * .06, yb - S * .36); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.clip(); ctx.fillStyle = this.hatch; ctx.fillRect(cx, yb - S * .4, S * .12, S * .32); ctx.restore();
      // head and hood
      ctx.fillStyle = '#e2c8a0'; ctx.beginPath(); ctx.arc(cx, yb - S * .42, S * .055, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = torch ? '#5d1f37' : '#7c2417';
      ctx.beginPath(); ctx.arc(cx, yb - S * .43, S * .065, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(cx + S * .02, yb - S * .53); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (torch) {
        // a pot of fire held high for throwing
        ctx.strokeStyle = PAL.ink; ctx.beginPath(); ctx.moveTo(cx + S * .05, yb - S * .3); ctx.lineTo(cx + S * .14, yb - S * .5); ctx.stroke();
        ctx.fillStyle = '#3c3128'; ctx.beginPath(); ctx.arc(cx + S * .15, yb - S * .53, S * .045, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        this.flames(cx + S * .15, yb - S * .6, S * .1);
      } else {
        ctx.strokeStyle = PAL.wood; ctx.lineWidth = lw * 1.6; ctx.beginPath(); ctx.moveTo(cx + S * .06, yb - S * .2); ctx.lineTo(cx + S * .13, yb - S * .48); ctx.stroke();
        this.flames(cx + S * .135, yb - S * .53, S * .1);
      }
    }
    if (marked) {   // this one would drown: a ring
      ctx.strokeStyle = '#2f6f9a'; ctx.lineWidth = lw * 2;
      ctx.beginPath(); ctx.ellipse(cx, yb - S * .02, S * .22, S * .08, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- overlays: forecast, targets, preview
  overlays(now) {
    const { ctx, g, S } = this, lw = Math.max(1.2, S / 40);
    const pv = this.preview;
    // preview of a tool: hatch the tiles that would flood or dry
    if (pv) {
      for (let i = 0; i < g.water.length; i++) {
        const nw = pv.g.water[i], ow = g.water[i];
        if (nw === ow && pv.g.ice[i] === g.ice[i] && pv.g.ht[i] === g.ht[i] && pv.g.t[i] === g.t[i]) continue;
        const x = i % g.w, y = (i / g.w) | 0, h = pv.g.ht[i];
        const L = this.ox + x * S, T = this.topY(x, y, h);
        ctx.fillStyle = nw && !ow ? this.hatchBlue : !nw && ow ? this.hatchMud : 'rgba(0,0,0,0)';
        ctx.fillRect(L + 2, T + 2, S - 4, S * K - 4);
        ctx.strokeStyle = nw && !ow ? '#2f6f9a' : PAL.ink2; ctx.lineWidth = lw * .8; ctx.setLineDash([lw * 2, lw * 2]);
        ctx.strokeRect(L + 2, T + 2, S - 4, S * K - 4); ctx.setLineDash([]);
        if (pv.g.ht[i] !== g.ht[i] || pv.g.t[i] !== g.t[i]) {   // dug: a spade mark
          ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(L + S * .35, T + S * K * .3); ctx.lineTo(L + S * .65, T + S * K * .7); ctx.moveTo(L + S * .65, T + S * K * .3); ctx.lineTo(L + S * .35, T + S * K * .7); ctx.stroke();
        }
      }
    }
    // valid targets for the chosen tool: small corner ticks
    if (this.valid && !this.busy) {
      ctx.strokeStyle = 'rgba(42,36,28,.75)'; ctx.lineWidth = lw;
      for (const [x, y] of this.valid) {
        const h = g.ht[g.idx(x, y)], L = this.ox + x * S, T = this.topY(x, y, h), c = S * .16, th = S * K, p = 3;
        ctx.beginPath();
        ctx.moveTo(L + p, T + p + c); ctx.lineTo(L + p, T + p); ctx.lineTo(L + p + c, T + p);
        ctx.moveTo(L + S - p - c, T + p); ctx.lineTo(L + S - p, T + p); ctx.lineTo(L + S - p, T + p + c);
        ctx.moveTo(L + p, T + th - p - c); ctx.lineTo(L + p, T + th - p); ctx.lineTo(L + p + c, T + th - p);
        ctx.moveTo(L + S - p - c, T + th - p); ctx.lineTo(L + S - p, T + th - p); ctx.lineTo(L + S - p, T + th - p - c);
        ctx.stroke();
      }
    }
    // hover outline
    if (this.hover && !this.busy) {
      const { x, y } = this.hover, h = (pv?.g || g).ht[g.idx(x, y)];
      ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw * 1.4;
      ctx.strokeRect(this.ox + x * S + 1, this.topY(x, y, h) + 1, S - 2, S * K - 2);
    }
    // forecast: routes, strikes and arrivals
    const fc = pv ? pv.fc : this.forecast;
    if (fc && this.showForecast && !this.busy) {
      const gg = pv ? pv.g : g;
      for (const u of gg.units) {
        if (u.dead) continue;
        const path = fc.moves[u.id]; if (!path?.length) continue;
        const pts = [[u.x, u.y], ...path].map(([x, y]) => this.center(x, y, gg.ht[gg.idx(x, y)]));
        ctx.strokeStyle = 'rgba(163,50,31,.9)'; ctx.lineWidth = lw * 1.3; ctx.setLineDash([lw * 2.5, lw * 2]);
        ctx.lineDashOffset = -now / 60;
        ctx.beginPath(); pts.forEach(([px, py], k) => k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
        // arrowhead at the end, and a little boot-print ring
        const [ax, ay] = pts[pts.length - 1], [bx, by] = pts[pts.length - 2];
        const an = Math.atan2(ay - by, ax - bx), r = S * .14;
        ctx.fillStyle = PAL.red;
        ctx.beginPath(); ctx.moveTo(ax + Math.cos(an) * r * .4, ay + Math.sin(an) * r * .4); ctx.lineTo(ax - Math.cos(an - .5) * r, ay - Math.sin(an - .5) * r); ctx.lineTo(ax - Math.cos(an + .5) * r, ay - Math.sin(an + .5) * r); ctx.closePath(); ctx.fill();
        // a faint ghost of where it will stand
        ctx.globalAlpha = .3; const [lx, ly] = path[path.length - 1];
        const [gx, gy] = this.center(lx, ly, gg.ht[gg.idx(lx, ly)]); this.figure(u.k, gx, gy + S * K * .05, S, false); ctx.globalAlpha = 1;
      }
      for (const b of fc.burns) {
        const [hx, hy] = this.center(b.x, b.y, gg.ht[gg.idx(b.x, b.y)]);
        const pulse = 1 + .08 * Math.sin(now / 160);
        ctx.strokeStyle = PAL.red; ctx.lineWidth = lw * 1.5;
        ctx.beginPath(); ctx.ellipse(hx, hy + S * .08, S * .44 * pulse, S * .2 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
        this.flames(hx, hy - S * .62, S * .24 * pulse);
        // a throw arc from a torcher
        const u = gg.units.find(v => v.id === b.id);
        if (u && u.k === 'torch') {
          const p = fc.moves[u.id]; const [sx, sy] = p?.length ? p[p.length - 1] : [u.x, u.y];
          const [ax, ay] = this.center(sx, sy, gg.ht[gg.idx(sx, sy)]);
          ctx.strokeStyle = 'rgba(163,50,31,.8)'; ctx.lineWidth = lw; ctx.setLineDash([lw * 1.5, lw * 1.5]);
          ctx.beginPath(); ctx.moveTo(ax, ay - S * .5); ctx.quadraticCurveTo((ax + hx) / 2, Math.min(ay, hy) - S * .9, hx, hy - S * .4); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      for (const a of fc.arrivals) {
        const [px, py] = this.center(a.x, a.y);
        ctx.globalAlpha = .35 + .15 * Math.sin(now / 300); this.figure(a.k, px, py + S * K * .05, S, false); ctx.globalAlpha = 1;
        // a pennant: "coming"
        ctx.strokeStyle = PAL.ink; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(px - S * .3, py + S * .05); ctx.lineTo(px - S * .3, py - S * .55); ctx.stroke();
        ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.moveTo(px - S * .3, py - S * .55); ctx.lineTo(px - S * .08, py - S * .47); ctx.lineTo(px - S * .3, py - S * .39); ctx.closePath(); ctx.fill();
      }
    }
    // preview: cottages that would be washed away
    if (pv) {
      for (let i = 0; i < g.t.length; i++) if (g.t[i] === 'H' && pv.g.t[i] === 'X') {
        const [hx, hy] = this.center(i % g.w, (i / g.w) | 0);
        ctx.strokeStyle = '#2f6f9a'; ctx.lineWidth = lw * 2.2; ctx.beginPath();
        ctx.moveTo(hx - S * .2, hy - S * .5); ctx.lineTo(hx + S * .2, hy - S * .1); ctx.moveTo(hx + S * .2, hy - S * .5); ctx.lineTo(hx - S * .2, hy - S * .1); ctx.stroke();
      }
    }
    // tutorial pointer
    if (this.pulse) {
      const [px, py] = this.center(this.pulse.x, this.pulse.y);
      const p = (now / 1100) % 1;
      ctx.strokeStyle = `rgba(163,50,31,${1 - p})`; ctx.lineWidth = lw * 1.6;
      ctx.beginPath(); ctx.ellipse(px, py, S * (.3 + .35 * p), S * K * (.3 + .35 * p), 0, 0, Math.PI * 2); ctx.stroke();
      // a printer's fist pointing down at it
      const bob = Math.sin(now / 250) * S * .05;
      this.fist(px, py - S * .75 + bob, S * .34);
    }
  }

  // ☞ the printer's manicule, turned to point down
  fist(x, y, s) {
    const { ctx } = this;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 2);
    ctx.fillStyle = PAL.paper; ctx.strokeStyle = PAL.ink; ctx.lineWidth = Math.max(1.2, s / 14);
    ctx.beginPath();
    ctx.moveTo(-s * .9, -s * .25); ctx.lineTo(-s * .3, -s * .3); ctx.lineTo(s * .8, -s * .22); ctx.quadraticCurveTo(s * .95, -s * .12, s * .8, -s * .04);
    ctx.lineTo(0, -s * .02); ctx.quadraticCurveTo(s * .15, s * .1, 0, s * .18); ctx.quadraticCurveTo(s * .12, s * .28, -s * .02, s * .34);
    ctx.quadraticCurveTo(s * .08, s * .45, -s * .1, s * .48); ctx.lineTo(-s * .5, s * .45); ctx.lineTo(-s * .9, s * .3); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.ink; ctx.fillRect(-s * 1.05, -s * .3, s * .16, s * .64);
    ctx.restore();
  }

  drawFx(now) {
    const { ctx, S } = this;
    this.fx = this.fx.filter(f => now - f.t < (f.life || 900));
    for (const f of this.fx) {
      const p = (now - f.t) / (f.life || 900);
      if (f.type === 'splash') {
        ctx.strokeStyle = `rgba(233,238,240,${1 - p})`; ctx.lineWidth = Math.max(1.2, S / 40);
        ctx.beginPath(); ctx.ellipse(f.x, f.y, S * .4 * p + 2, S * .15 * p + 1, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(233,238,240,${1 - p})`;
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ctx.fillRect(f.x + Math.cos(a) * S * .2 * p, f.y - S * .3 * Math.sin(p * Math.PI) + Math.sin(a) * S * .05, 2, 2); }
      } else if (f.type === 'puff') {
        ctx.fillStyle = `rgba(120,95,70,${.5 * (1 - p)})`;
        for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * S * .25 * p, f.y + Math.sin(a) * S * .1 * p - S * .1 * p, S * .06 * (1 - p) + 1, 0, Math.PI * 2); ctx.fill(); }
      } else if (f.type === 'frost') {
        ctx.strokeStyle = `rgba(255,255,255,${1 - p})`; ctx.lineWidth = Math.max(1, S / 45);
        ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(a) * S * .35 * p, f.y + Math.sin(a) * S * .2 * p); } ctx.stroke();
      }
    }
    // a cloud over every tile it's raining on
    const g = this.g;
    for (let i = 0; i < g.rain.length; i++) if (g.rain[i]) this.cloud(i % g.w, (i / g.w) | 0, now);
  }

  cloud(x, y, now) {
    const { ctx, S } = this;
    const [cx, cy] = this.center(x, y);
    const cy0 = cy - S * 1.0 + Math.sin(now / 700) * S * .03;
    ctx.strokeStyle = '#46708e'; ctx.lineWidth = Math.max(1, S / 50); ctx.beginPath();
    for (let k = 0; k < 7; k++) { const xx = cx - S * .25 + k * S * .08, o = ((now / 260 + k * .37) % 1) * S * .75; ctx.moveTo(xx, cy0 + S * .1 + o); ctx.lineTo(xx - S * .03, cy0 + S * .2 + o); }
    ctx.stroke();
    ctx.fillStyle = '#dcd8cc'; ctx.strokeStyle = PAL.ink;
    const puffs = [[-.17, 0, .14], [.04, -.07, .18], [.22, .01, .12]];
    ctx.beginPath(); for (const [dx, dy, r] of puffs) { ctx.moveTo(cx + dx * S + r * S, cy0 + dy * S); ctx.arc(cx + dx * S, cy0 + dy * S, r * S, 0, Math.PI * 2); } ctx.fill();
    ctx.beginPath(); ctx.arc(cx - .17 * S, cy0, .14 * S, Math.PI * .55, Math.PI * 1.55); ctx.arc(cx + .04 * S, cy0 - .07 * S, .18 * S, Math.PI * 1.1, Math.PI * 1.95); ctx.arc(cx + .22 * S, cy0 + .01 * S, .12 * S, Math.PI * 1.5, Math.PI * .45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - .3 * S, cy0 + .1 * S); ctx.lineTo(cx + .33 * S, cy0 + .1 * S); ctx.stroke();
  }
}
