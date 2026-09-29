// Drawing the dig. Everything goes into one small buffer, a world cell to a pixel, which is then scaled up by a
// whole number so every pixel stays crisp: the ground (each band's colours worked out once and redone only when it
// changes), the finds, the flying dirt, the worm, then the light (dark down deep, with the worm's own glow, lava,
// crystals and the like lighting their surroundings, in dithered steps), then sparkles and words on top. It only
// ever reads the game.
import { W, H, GROUND, BAND, BANDS, STRATA, ITEMS, CAMP, OUTPOST, CORE_X, CORE_Y, CORE_R,
  AIR, WATER, LAVA, GAS, SOIL, MOSS, CORE } from './rules.js';
import { SOLID, TIER, LIQ, DIST } from './sim.js';
import { RAMPS, BACKWALL, GLOW, SKINS, SPRITES, POST, RESONATOR, HUT, TENT, FOLK, CACTUS, FONT, SKY, MESA, TRAIL_TINT, px, rgb, mixHex } from './art.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
const hsh = (x, y, s = 0) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1440670441) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const R8 = c => c & 255, G8 = c => (c >>> 8) & 255, B8 = c => (c >>> 16) & 255;
const pack = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
const TAG_SKY = 0, TAG_WATER = 254, TAG_LAVA = 253, TAG_GAS = 252;
const LG = 4;                      // light is worked out on a grid of 4×4 cells

// Colour ramps as pixels, and the same ramps as the worm leaves them (darker, warmer).
const RAMP_PX = [], TRAIL_PX = [];
for (let m = 0; m < RAMPS.length; m++) {
  if (!RAMPS[m]) continue;
  RAMP_PX[m] = RAMPS[m].map(h => px(h));
  TRAIL_PX[m] = RAMPS[m].map(h => px(mixHex(h, TRAIL_TINT, .3)));
}
const BACK_PX = BACKWALL.map(r => r.map(h => px(h)));
const GRASS = ['#3e6a26', '#4f8230', '#65983a', '#86b04a'].map(h => px(h));
const DRYGRASS = ['#8a7a3a', '#a8964a'].map(h => px(h));
const HATCH_DARK = .58;
const TILE = ['#0c1718', '#16292a', '#112021'].map(h => px(h));      // the Old Ones' rooms: grout, and two tiles

export class View {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.buf = document.createElement('canvas');
    this.bctx = this.buf.getContext('2d');
    this.cache = new Array(BANDS);
    this.fx = []; this.floats = []; this.rings = []; this.words = new Map();
    this.cam = { x: 0, y: 0, ready: false };
    this.shakeT = 0; this.shakeA = 0;
    this.t = 0;
    this.dayT = 0;
    this.folk = Array.from({ length: 6 }, (_, k) => ({ x: 40 + k * 32 + hsh(k, 1) * 20, dir: k % 2 ? 1 : -1, look: k, cheer: 0, walk: hsh(k, 2) * 10 }));
    this.postFolk = [];
    this.resize();
  }
  resize() {
    const dpr = Math.min(3, window.devicePixelRatio || 1), cw = Math.max(1, Math.round(innerWidth * dpr)), ch = Math.max(1, Math.round(innerHeight * dpr));
    this.dpr = dpr;
    this.cv.width = cw; this.cv.height = ch;
    const S = Math.max(1, Math.min(Math.floor(cw / (W + 6)), Math.round(ch / 290)));
    this.S = S;
    this.bw = Math.ceil(cw / S); this.bh = Math.ceil(ch / S) + 1;
    this.buf.width = this.bw; this.buf.height = this.bh;
    this.img = this.bctx.createImageData(this.bw, this.bh);
    this.px = new Uint32Array(this.img.data.buffer);
    this.skyMask = new Uint8Array(this.bw * this.bh);     // pixels of open sky, which the light leaves alone
    this.LW = Math.ceil(W / LG) + 2; this.LH = Math.ceil(this.bh / LG) + 4;
    this.light = new Float32Array(this.LW * this.LH * 3); this.tmp = new Float32Array(this.LW * this.LH * 3);
    this.ctx.imageSmoothingEnabled = false;
  }
  // Where a point on the page is in the world, in cells.
  toWorld(cssX, cssY) {
    const k = this.dpr / this.S;
    return { x: this.cam.x + cssX * k, y: this.cam.y + cssY * k };
  }
  toScreen(x, y) {
    const k = this.S / this.dpr;
    return { x: (x - this.cam.x) * k, y: (y - this.cam.y) * k };
  }
  shake(a, t = .35) { if (this.reduced) return; if (a > this.shakeA * (this.shakeT / .35)) { this.shakeA = a; this.shakeT = t; } }

  /* ---------- the camera ---------- */
  // Eases after the worm. It looks ahead the way the worm's heading, up or down (further the faster), and that
  // look-ahead eases in and out as well, as does the change from the camp's framing (the worm in the middle) to
  // the one down deep (a little higher, to see more below): so a sudden change of speed, bursting out of the
  // ground, stopping dead against rock, a leap, doesn't jolt the view. It only hurries as the worm nears the top or
  // bottom of the screen.
  follow(game, dt, snap = false) {
    const w = game.worm, bh = this.bh - 1, bw = this.bw, c = this.cam;
    const lead = clamp(w.vy * .45, -bh * .22, bh * .26);
    c.lead = snap || !c.ready ? lead : c.lead + (lead - c.lead) * (1 - Math.exp(-dt * 2.2));
    const deep = clamp((w.y - GROUND - 20) / 70, 0, 1);
    let ty = w.y - bh * (.5 - .08 * deep * deep * (3 - 2 * deep)) + c.lead;
    if (game.won && Math.abs(w.y - CORE_Y) < 400) ty = CORE_Y - CORE_R - bh * .55;
    ty = clamp(ty, 0, H - bh);
    const tx = bw >= W ? -(bw - W) / 2 : clamp(w.x - bw / 2, 0, W - bw);
    if (snap || !c.ready) { c.x = tx; c.y = ty; c.ready = true; return; }
    const f = (w.y - c.y) / bh, edge = Math.max(0, .15 - f, f - .8) / .15;
    const k = 1 - Math.exp(-dt * 5.5 * (1 + 3 * edge * edge));
    c.y += (ty - c.y) * k;
    c.x += (tx - c.x) * Math.min(1, k * 1.5);
  }

  /* ---------- a band's colours ---------- */
  bandColours(game, b) {
    let c = this.cache[b];
    if (!c) c = this.cache[b] = { ver: -1, vib: -1, col: new Uint32Array(W * BAND), emit: new Float32Array((W / LG) * (BAND / LG) * 3) };
    const vib = game.up.vib;
    if (c.ver === game.ver[b] && c.vib === vib) return c;
    c.ver = game.ver[b]; c.vib = vib;
    const { mat, flags, shade, plan } = game, surf = plan.surf, bnd = plan.bnd, col = c.col, y0 = b * BAND;
    for (let yy = 0; yy < BAND; yy++) {
      const y = y0 + yy;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, m = mat[i], sh = shade[i], lvl = sh & 63, acc = sh >> 6;
        let out;
        if (m === AIR || m === GAS || m === WATER || m === LAVA) {
          if (m === AIR && y < surf[x]) { col[yy * W + x] = TAG_SKY; continue; }
          let k = 0;
          for (let q = STRATA.length - 1; q >= 1; q--) if (y >= bnd[q][x]) { k = q; break; }
          const back = BACK_PX[k];
          let v = back[clamp(Math.floor(lvl / 64 * back.length * 3 + bay(x, y) - .5), 0, back.length - 1)];
          if (acc === 3 && m === AIR) {
            // the Old Ones' rooms: tiles on the back wall
            v = x % 8 === 0 || y % 8 === 0 ? TILE[0] : ((x >> 3) + (y >> 3)) % 5 === 0 ? TILE[1] : TILE[2];
          }
          if (m === WATER) {
            const R = RAMP_PX[WATER], top = y > 0 && (mat[i - W] === AIR || mat[i - W] === GAS);
            out = top ? R[4] : R[lvl < 20 ? 1 : bay(x, y) < .5 ? 2 : 1];
            col[yy * W + x] = (out & 0xffffff) | (TAG_WATER << 24);
            continue;
          }
          if (m === LAVA) { col[yy * W + x] = (RAMP_PX[LAVA][2] & 0xffffff) | (TAG_LAVA << 24); continue; }
          if (m === GAS) { v = pack(clamp(R8(v) + 14, 0, 255), clamp(G8(v) + 22, 0, 255), B8(v)); col[yy * W + x] = (v & 0xffffff) | (TAG_GAS << 24); continue; }
          col[yy * W + x] = v;
          continue;
        }
        // solid ground
        const dist = (flags[i] & DIST) !== 0, R = dist ? TRAIL_PX[m] : RAMP_PX[m], n = R.length;
        let idx = Math.floor(lvl / 64 * n + bay(x, y) - .5);
        if (acc === 1) idx -= 2; else if (acc === 2) idx += 2; else if (acc === 3) idx += 1;
        const up = y > 0 ? mat[i - W] : AIR, down = y < H - 1 ? mat[i + W] : m;
        const openUp = up === AIR || up === GAS || LIQ[up], openDown = down === AIR || down === GAS;
        if (openUp) idx += 1;
        if (openDown) idx -= 1;
        if (dist) { const h = hsh(x, y, 7); idx += h < .34 ? -1 : h > .8 ? 1 : 0; }
        idx = clamp(idx, 0, n - 1);
        out = R[idx];
        if (m === SOIL && y <= surf[x] + 3) {
          // grass on top of the ground (not on fresh dirt the worm has thrown up)
          if (up === AIR && !dist) out = GRASS[clamp(2 + (hsh(x, 1) < .5 ? 1 : 0), 0, 3)];
          else if (up === AIR) out = DRYGRASS[hsh(x, y, 2) < .5 ? 0 : 1];
          else if (y > 1 && mat[i - 2 * W] === AIR && !dist && hsh(x, y, 3) < .6) out = GRASS[0];
        }
        if (TIER[m] > vib && TIER[m] < 90 && (x + y) % 5 === 0) out = pack(R8(out) * HATCH_DARK | 0, G8(out) * HATCH_DARK | 0, B8(out) * HATCH_DARK | 0);
        col[yy * W + x] = out;
      }
    }
    // what it glows with, a 4×4 block at a time
    const E = c.emit, EW = W / LG;
    E.fill(0);
    for (let yy = 0; yy < BAND; yy++) for (let x = 0; x < W; x++) {
      const g = GLOW[mat[(y0 + yy) * W + x]];
      if (!g) continue;
      const e = ((yy >> 2) * EW + (x >> 2)) * 3;
      E[e] += g[0] / 16; E[e + 1] += g[1] / 16; E[e + 2] += g[2] / 16;
    }
    return c;
  }

  /* ---------- a frame ---------- */
  draw(game, dt) {
    this.t += dt;
    this.dayT += dt;
    const { bw, bh, S } = this, P = this.px;
    this.follow(game, dt);
    if (this.shakeT > 0) this.shakeT -= dt;
    const sh = this.shakeT > 0 ? this.shakeA * (this.shakeT / .35) : 0;
    const ox = Math.round((Math.random() - .5) * sh), oy = Math.round((Math.random() - .5) * sh);
    const camX = Math.floor(this.cam.x) + ox, camY = Math.floor(this.cam.y) + oy;
    this.cx = camX; this.cy = camY;
    game.ensureRows(Math.max(0, camY - 8), Math.min(H - 1, camY + bh + 8));

    this.updateFx(game, dt);

    /* the ground, the sky and the cut edges */
    const sky = this.skyRows(game, camY);
    const b0 = Math.max(0, Math.floor(camY / BAND)), b1 = Math.min(BANDS - 1, Math.floor((camY + bh) / BAND));
    for (let b = b0; b <= b1; b++) if (game.built[b]) this.bandColours(game, b);
    const t = this.t, surf = game.plan.surf, M = this.skyMask;
    M.fill(0);
    for (let by = 0; by < bh; by++) {
      const y = camY + by, row = by * bw;
      const skyC = sky[by];
      if (y < 0 || y >= H) { for (let bx = 0; bx < bw; bx++) { P[row + bx] = y < 0 ? this.skyPixel(camX + bx, y, skyC) : 0xff000000; M[row + bx] = y < 0 ? 1 : 0; } continue; }
      const c = this.cache[y >> 6], cr = (y & 63) * W;
      const E = this.edgeRow(game, y);
      for (let bx = 0; bx < bw; bx++) {
        const x = camX + bx;
        if (x < 0 || x >= W) {
          const top = x < 0 ? surf[0] : surf[W - 1];
          if (y < top) { P[row + bx] = this.skyPixel(x, y, skyC); M[row + bx] = 1; continue; }
          const inner = x < 0 ? -x : x - W + 1;
          P[row + bx] = inner === 1 ? E.rim : (x < 0 && inner <= E.tick) ? E.tickC : ((x + y) & 7) === 0 ? E.hatch : E.back;
          continue;
        }
        if (!c || !game.built[y >> 6]) { P[row + bx] = 0xff000000; continue; }
        let v = c.col[cr + x];
        const tag = v >>> 24;
        if (tag === 255) { P[row + bx] = v; continue; }
        if (tag === TAG_SKY) { P[row + bx] = this.skyPixel(x, y, skyC); M[row + bx] = 1; continue; }
        if (tag === TAG_WATER) {
          const w2 = Math.sin(x * .45 + y * .2 + t * 2.2) + Math.sin(x * .13 - t * 1.3);
          if (w2 > 1.55) v = RAMP_PX[WATER][4];
          P[row + bx] = (v | 0xff000000) >>> 0; continue;
        }
        if (tag === TAG_LAVA) {
          const f = Math.sin(x * .3 + t * 1.6 + Math.sin(y * .4 + t)) + Math.sin(y * .5 - t * 2.1 + x * .1) * .7;
          const R = RAMP_PX[LAVA];
          P[row + bx] = R[clamp(Math.floor(2.2 + f * 1.1 + bay(x, y)), 0, R.length - 1)]; continue;
        }
        if (tag === TAG_GAS) { const f = Math.sin(x * .2 + y * .3 + t * .8) > .6; P[row + bx] = f ? (pack(R8(v) + 10, G8(v) + 16, B8(v)) >>> 0) : (v | 0xff000000) >>> 0; continue; }
        P[row + bx] = (v | 0xff000000) >>> 0;
      }
    }
    this.drawSurface(game, camX, camY, dt);
    this.drawOutposts(game, camX, camY, dt);
    this.drawHum(game, camX, camY, dt);
    this.drawObjects(game, camX, camY);
    this.drawParts(game, camX, camY);
    this.drawWorm(game, camX, camY);
    this.drawLight(game, camX, camY);
    this.drawGlints(game, camX, camY);
    this.drawBeams(game, camX, camY);
    this.drawFx(camX, camY);
    this.drawTarget(camX, camY);
    this.bctx.putImageData(this.img, 0, 0);
    const fy = Math.round((this.cam.y - Math.floor(this.cam.y)) * S);
    this.ctx.drawImage(this.buf, 0, -fy, bw * S, bh * S);
    this.drawFloats(camX, camY, dt, fy);
  }

  /* ---------- the sky ---------- */
  // 8 minutes a day, starting mid-morning
  dayPhase() { return ((this.dayT / 480) + .3) % 1; }
  skyRows(game, camY) {
    const n = this.bh, out = this.skyBuf && this.skyBuf.length === n ? this.skyBuf : (this.skyBuf = new Uint32Array(n));
    const ph = this.dayPhase();
    // 0 midnight, .25 dawn, .5 noon, .75 dusk
    const day = clamp(Math.sin((ph - .25) * Math.PI * 2) * 1.6 + .25, 0, 1), dusk = clamp(1 - Math.abs(Math.sin((ph - .25) * Math.PI * 2)) * 3, 0, 1);
    this.daylight = day;
    if (camY > GROUND) return out;                 // (no sky in view)
    for (let by = 0; by < n; by++) {
      const y = camY + by, u = clamp(y / GROUND, 0, 1);
      const pick = arr => { const f = u * (arr.length - 1), k = Math.min(arr.length - 2, Math.floor(f)); return mixHex(arr[k], arr[k + 1], f - k); };
      let c = mixHex(pick(SKY.night), pick(SKY.day), day);
      if (dusk > 0) c = mixHex(c, pick(SKY.dusk), dusk * .75);
      out[by] = px(c);
    }
    return out;
  }
  skyPixel(x, y, skyC) {
    // far mesas on the skyline, and a few clouds
    const t = this.t;
    const mh = GROUND - 12 - 16 * Math.max(0, Math.sin(x * .03 + 1.3)) ** 2 - 9 * Math.max(0, Math.sin(x * .071 + 4)) ** 3;
    if (y > mh) {
      const k = y - mh < 2 ? 0 : y - mh < 6 ? 1 : 2;
      const d = this.daylight ?? 1;
      const c = rgb(MESA[k]);
      return pack(c[0] * (.35 + .65 * d) | 0, c[1] * (.35 + .65 * d) | 0, c[2] * (.4 + .6 * d) | 0);
    }
    const cxw = ((x + t * 2.2) % 400 + 400) % 400;
    for (let k = 0; k < 3; k++) {
      const cx = (k * 150 + 40) % 400, cy = 24 + k * 17;
      const dx = cxw - cx, dy = y - cy;
      if (Math.abs(dy) < 5 && Math.abs(dx) < 22) {
        const e = (dx / 20) ** 2 + (dy / (dy < 0 ? 5 : 3)) ** 2 - .25 * Math.sin(dx * .9 + k);
        if (e < 1) { const d = this.daylight ?? 1; const v = dy > 1 ? 200 : 240; return pack(v * (.3 + .7 * d) | 0, v * (.3 + .7 * d) | 0, (v + 10) * (.4 + .6 * d) | 0); }
      }
    }
    if ((this.daylight ?? 1) < .5 && hsh(x, y, 42) < .004) return pack(230, 230, 255);
    return skyC;
  }
  // Beyond the world's sides: the cut face of the ground, dark and hatched, with a depth ruler (a tick every 50 m).
  edgeRow(game, y) {
    const d = y - GROUND;
    let k = 0;
    for (let q = STRATA.length - 1; q >= 1; q--) if (d >= STRATA[q].top) { k = q; break; }
    const back = BACK_PX[k][1];
    return { back, rim: pack(clamp(R8(back) + 44, 0, 255), clamp(G8(back) + 38, 0, 255), clamp(B8(back) + 34, 0, 255)),
      hatch: pack(R8(back) * .7 | 0, G8(back) * .7 | 0, B8(back) * .7 | 0),
      tick: d > 0 && d % 50 === 0 ? (d % 250 === 0 ? 7 : 4) : 0, tickC: pack(120, 112, 98) };
  }

  /* ---------- the camp on top ---------- */
  drawSurface(game, camX, camY, dt) {
    if (camY > GROUND + 10) return;
    const surf = game.plan.surf, t = this.t;
    const at = (sp, x, bottom) => this.blit(sp, Math.round(x - sp.w / 2) - camX, bottom - sp.h - camY, 1);
    at(CACTUS, 16, surf[16] + 1);
    at(CACTUS, 236, surf[236] + 1);
    at(HUT, 40, surf[40] + 1);
    at(TENT, 128, surf[128] + 1);
    at(HUT, 214, surf[214] + 1);
    at(POST, CAMP.post, surf[CAMP.post] + 1);
    at(RESONATOR, CAMP.resonator, surf[CAMP.resonator] + 1);
    // the people of the camp
    for (const f of this.folk) {
      f.walk += dt;
      if (f.cheer > 0) f.cheer -= dt;
      else { f.x += f.dir * 7 * dt; if (f.x < 30 || f.x > W - 30 || hsh(Math.floor(f.walk / 3), f.look) < .005) f.dir *= -1; }
      const frames = FOLK[f.look % FOLK.length], sp = f.cheer > 0 ? frames[2] : frames[Math.floor(f.walk * 4) % 2];
      const xi = clamp(Math.round(f.x), 0, W - 1), hop = f.cheer > 0 && Math.floor(f.cheer * 6) % 2 ? 1 : 0;
      this.blit(sp, xi - 1 - camX, surf[xi] - sp.h - hop - camY, 1);
    }
  }
  cheer() { for (const f of this.folk.concat(...this.postFolk)) f.cheer = 2 + Math.random(); }
  // A Resonator hums after an upgrade: rings spreading out from it (the camp's, or an outpost's: humAt).
  drawHum(game, camX, camY, dt) {
    if (!(this.hum > 0)) return;
    this.hum -= dt;
    const at = this.humAt || { x: CAMP.resonator, y: game.plan.surf[CAMP.resonator] };
    const rx = at.x - camX, ry = at.y - 26 - camY;
    for (let a = 0; a < 20; a++) { const r = 8 + (1 - this.hum) * 30, an = a / 20 * Math.PI * 2; this.put(Math.round(rx + Math.cos(an) * r), Math.round(ry + Math.sin(an) * r * .6), px('#fff4c0')); }
  }

  /* ---------- the outposts ---------- */
  // Each hall, shored up with timber, with a trading post and a Resonator like the camp's: shut up, greyed and dark
  // but for a glimmer, with a sign up, until it's bought; after, its lanterns lit and a couple of folk minding it.
  lanterns(o) { const x0 = Math.round(o.x0 + 12), x1 = Math.round(o.x1 - 12); return [x0 + 10, Math.round(o.x - 6), Math.round(o.x + 8), x1 - 10]; }
  drawOutposts(game, camX, camY, dt) {
    const WOOD = px('#6a4526'), WOOD_D = px('#43291a'), WOOD_L = px('#8a6036');
    game.posts.forEach((o, n) => {
      if (o.y1 + 4 < camY || o.y0 - 44 > camY + this.bh) return;
      const k = o.bought ? 1 : .5, dim = c => k === 1 ? c : pack(R8(c) * k | 0, G8(c) * k | 0, B8(c) * k | 0);
      const fy = o.y1 - camY, bx0 = Math.round(o.x0 + 12), bx1 = Math.round(o.x1 - 12), by = Math.round(o.y0 + 10) - camY;
      // the shoring: two posts, and a beam across under the roof
      for (const bx of [bx0, bx1]) for (let y = by; y < fy; y++) { this.put(bx - camX, y, dim(WOOD_L)); this.put(bx + 1 - camX, y, dim(WOOD)); this.put(bx + 2 - camX, y, dim(WOOD_D)); }
      for (let x = bx0 - 2; x <= bx1 + 4; x++) { this.put(x - camX, by - 1, dim(WOOD_L)); this.put(x - camX, by, dim(WOOD)); this.put(x - camX, by + 1, dim(WOOD_D)); }
      // lanterns hanging from it
      for (const lx of this.lanterns(o)) {
        const x = lx - camX, lit = o.bought, flick = lit ? .85 + .15 * Math.sin(this.t * 7 + lx) : 0;
        this.put(x, by + 2, dim(WOOD_D));
        const glass = lit ? pack(255, 200 + 40 * flick | 0, 110 * flick | 0) : px('#4a4238');
        for (const [dx, dy] of [[0, 3], [-1, 4], [0, 4], [1, 4], [0, 5]]) this.put(x + dx, by + dy, dy === 4 && dx === 0 ? glass : lit ? px('#8a5a20') : px('#2e2822'));
      }
      this.blit(POST, Math.round(o.x + OUTPOST.post - POST.w / 2) - camX, fy - POST.h, k);
      this.blit(RESONATOR, Math.round(o.x + OUTPOST.resonator - RESONATOR.w / 2) - camX, fy - RESONATOR.h, k);
      if (!o.bought) {
        // FOR SALE: a board on a stick, with a coin sign on it
        const sx = Math.round(o.x) - camX, sy = fy - 12;
        for (let y = sy + 6; y < fy; y++) this.put(sx, y, WOOD_D);
        for (let y = sy - 1; y < sy + 7; y++) for (let x = sx - 4; x <= sx + 4; x++) this.put(x, y, y === sy - 1 || y === sy + 6 || x === sx - 4 || x === sx + 4 ? WOOD_D : WOOD);
        for (const [gx, gy] of FONT['$']) this.put(sx - 1 + gx, sy + gy, px('#e0b040'));
      } else {
        // the folk who mind it
        const folk = this.postFolk[n] ||= [0, 1].map(j => ({ x: o.x + (j ? 18 : -30), dir: j ? -1 : 1, look: 2 + j * 2 + n, cheer: 0, walk: j * 3 }));
        for (const f of folk) {
          f.walk += dt;
          if (f.cheer > 0) f.cheer -= dt;
          else { f.x += f.dir * 6 * dt; if (f.x < o.x0 + 16 || f.x > o.x1 - 16 || hsh(Math.floor(f.walk / 3), f.look) < .004) f.dir *= -1; }
          const frames = FOLK[f.look % FOLK.length], sp = f.cheer > 0 ? frames[2] : frames[Math.floor(f.walk * 4) % 2];
          this.blit(sp, Math.round(f.x) - 1 - camX, fy - sp.h - (f.cheer > 0 && Math.floor(f.cheer * 6) % 2 ? 1 : 0), 1);
        }
      }
    });
  }
  // Their light: lanterns once bought; before, a faint glimmer, to show something's there.
  outpostLight(game, camY, gy0) {
    for (const o of game.posts) {
      if (o.y1 + 40 < camY || o.y0 - 40 > camY + this.bh) continue;
      const by = Math.round(o.y0 + 10);
      if (o.bought) {
        for (const lx of this.lanterns(o)) this.lamp(lx, by + 4, gy0, 1.3, [1, .78, .42]);
        this.lamp(o.x + OUTPOST.resonator, o.y1 - 22, gy0, .6, [.75, .62, 1]);
      } else this.lamp(o.x, o.y1 - 8, gy0, .35, [.55, .7, 1]);
    }
  }

  /* ---------- finds ---------- */
  drawObjects(game, camX, camY) {
    const b0 = Math.max(0, Math.floor(camY / BAND) - 1), b1 = Math.min(BANDS - 1, Math.floor((camY + this.bh) / BAND) + 1);
    for (let b = b0; b <= b1; b++) for (const o of game.objBand[b]) {
      if (o.gone || o.fresh) continue;
      const sp = SPRITES[o.kind];
      if (!sp) continue;
      let x = Math.round(o.x - sp.w / 2) - camX, y = Math.round(o.y - sp.h / 2) - camY;
      if (x > this.bw || y > this.bh || x + sp.w < 0 || y + sp.h < 0) continue;
      // too big to swallow yet: it shows, but greyed
      const I = ITEMS[o.kind];
      const locked = I && I.size > game.up.maw + 1;
      if (o.kind === 'cache') y += Math.round(Math.sin(this.t * 3) * 1);
      if (o.fall > 0) x += Math.round(Math.sin(this.t * 60) * 1.2);
      this.blit(sp, x, y, locked && !o.hazard ? .55 : 1);
    }
  }
  blit(sp, x0, y0, k = 1) {
    const { bw, bh } = this, P = this.px;
    for (let y = 0; y < sp.h; y++) {
      const by = y0 + y;
      if (by < 0 || by >= bh) continue;
      for (let x = 0; x < sp.w; x++) {
        const bx = x0 + x;
        if (bx < 0 || bx >= bw) continue;
        const v = sp.data[y * sp.w + x];
        if (!(v >>> 24)) continue;
        P[by * bw + bx] = k === 1 ? v : pack(R8(v) * k | 0, G8(v) * k | 0, B8(v) * k | 0);
        this.skyMask[by * bw + bx] = 0;
      }
    }
  }
  put(x, y, c) { if (x >= 0 && y >= 0 && x < this.bw && y < this.bh) { this.px[y * this.bw + x] = c; this.skyMask[y * this.bw + x] = 0; } }
  add(x, y, r, g, b) {
    if (x < 0 || y < 0 || x >= this.bw || y >= this.bh) return;
    const i = y * this.bw + x, v = this.px[i];
    this.px[i] = pack(Math.min(255, R8(v) + r), Math.min(255, G8(v) + g), Math.min(255, B8(v) + b));
  }

  /* ---------- flying dirt ---------- */
  drawParts(game, camX, camY) {
    for (const p of game.parts) {
      const R = RAMP_PX[p.m];
      if (!R) continue;
      this.put(Math.floor(p.x) - camX, Math.floor(p.y) - camY, R[clamp(Math.floor((p.s & 63) / 64 * R.length), 0, R.length - 1)]);
    }
  }

  /* ---------- the worm ---------- */
  drawWorm(game, camX, camY) {
    const n = game.segN, X = game.segX, Y = game.segY, Rr = game.segR, w = game.worm;
    const skin = SKINS[Math.min(SKINS.length - 1, game.up.hide)];
    const ramp = this.skinPx && this.skinFor === skin ? this.skinPx : (this.skinFor = skin, this.skinPx = { r: skin.ramp.map(h => px(h)), band: px(skin.band), mouth: px(skin.mouth), gum: px(skin.gum), tooth: px(skin.tooth), seam: skin.seam ? px(skin.seam) : 0 });
    const P = this.px, bw = this.bw, bh = this.bh, RC = ramp.r, dark = RC[0];
    // a slow swell running down the body as it swims (and the faintest breathing when it's still)
    const t = this.t, amp = .035 + Math.min(.08, w.speed / 1500);
    // outline first, all the way along, then the body over it, tail to head
    for (let pass = 0; pass < 2; pass++) {
      for (let s = n - 1; s >= 0; s--) {
        const bulge = s > 0 ? 1 + amp * Math.sin(s * .8 - t * 7) : 1;
        const cx = X[s] - camX, cy = Y[s] - camY, r = Rr[s] * bulge + (pass === 0 ? 1 : 0);
        if (cx + r < 0 || cy + r < 0 || cx - r > bw || cy - r > bh) continue;
        // the body's axis here, and which side is up (lit)
        const a = s > 0 ? s - 1 : 0, b = s < n - 1 ? s + 1 : s;
        let tx = X[a] - X[b], ty = Y[a] - Y[b];
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        let nx = -ty, ny = tx;
        if (ny > 0) { nx = -nx; ny = -ny; }
        const band = s % 2 === 1 && s > 1 && s < n - 2;
        const r2 = r * r;
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
          if (y < 0 || y >= bh) continue;
          for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
            if (x < 0 || x >= bw) continue;
            const dx = x + .5 - cx, dy = y + .5 - cy, d2 = dx * dx + dy * dy;
            if (d2 > r2) continue;
            const i = y * bw + x;
            this.skyMask[i] = 2;
            if (pass === 0) { P[i] = dark; continue; }
            const u = (dx * nx + dy * ny) / r, v = (dx * tx + dy * ty) / r;
            let k = Math.floor((u + 1) * .5 * (RC.length - 1) + .35 + bay(x, y) * .5);
            if (d2 > (r - .9) * (r - .9) && u < .2) k -= 1;
            let c = RC[clamp(k, 1, RC.length - 1)];
            if (band && Math.abs(v) < .26 && u < .75) c = ramp.seam && Math.abs(v) < .1 && u > -.5 && u < .5 ? ramp.seam : k >= 4 ? RC[2] : ramp.band;
            P[i] = c;
          }
        }
      }
    }
    // the maw, at the front of the head
    const hx = X[0] - camX, hy = Y[0] - camY, hr = Rr[0];
    let dx = X[0] - X[Math.min(2, n - 1)], dy = Y[0] - Y[Math.min(2, n - 1)];
    const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const open = clamp(.25 + w.chomp * .75 + (w.mode === 'dig' ? Math.min(.35, w.speed / 300) : 0), 0, 1);
    const mx = hx + dx * hr * .55, my = hy + dy * hr * .55, ra = hr * .72, rb = hr * (.2 + .42 * open);
    for (let y = Math.floor(my - ra - 1); y <= Math.ceil(my + ra + 1); y++) for (let x = Math.floor(mx - ra - 1); x <= Math.ceil(mx + ra + 1); x++) {
      if (x < 0 || y < 0 || x >= bw || y >= bh) continue;
      const qx = x + .5 - mx, qy = y + .5 - my;
      const along = qx * dx + qy * dy, across = -qx * dy + qy * dx;
      const e = (along / rb) ** 2 + (across / ra) ** 2;
      if (e > 1.35) continue;
      if (Math.hypot(x + .5 - hx, y + .5 - hy) > hr + .5) continue;
      if (e > 1) { P[y * bw + x] = (Math.floor(Math.atan2(across, along) * 3.2 + 10) % 2) ? ramp.tooth : ramp.gum; continue; }
      P[y * bw + x] = e < .45 ? ramp.mouth : ramp.gum;
    }
  }

  /* ---------- light ---------- */
  drawLight(game, camX, camY) {
    const { LW, LH, bw, bh } = this, L = this.light, T = this.tmp, EW = W / LG;
    const gy0 = Math.floor(camY / LG) - 2;            // light grid row 0 is world row gy0*LG
    const surfY = GROUND;
    L.fill(0);
    // what glows
    for (let gy = 0; gy < LH; gy++) {
      const wy = (gy0 + gy) * LG;
      if (wy < 0 || wy >= H) continue;
      const c = this.cache[wy >> 6];
      if (!c) continue;
      const er = ((wy & 63) >> 2) * EW * 3;
      for (let gx = 0; gx < EW; gx++) {
        const o = (gy * LW + gx + 1) * 3, e = er + gx * 3;
        L[o] = c.emit[e] * 3.5; L[o + 1] = c.emit[e + 1] * 3.5; L[o + 2] = c.emit[e + 2] * 3.5;
      }
    }
    // finds that glow
    const b0 = Math.max(0, Math.floor(camY / BAND) - 1), b1 = Math.min(BANDS - 1, Math.floor((camY + bh) / BAND) + 1);
    for (let b = b0; b <= b1; b++) for (const o of game.objBand[b]) {
      if (o.gone || o.fresh) continue;
      const sp = SPRITES[o.kind];
      if (!sp || !sp.glow) continue;
      this.lamp(o.x, o.y, gy0, sp.glow * 3, sp.glowCol || [1, 1, 1]);
    }
    for (const f of this.fx) if (f.light) this.lamp(f.x, f.y, gy0, f.light * 2 * (f.life / f.max), f.lc);
    this.outpostLight(game, camY, gy0);
    for (const b of game.plan.beams) if (b.y0 > camY - 20 && b.y0 < camY + bh + 20 && game.beamOn(b)) {
      for (let k = 0; k <= 1; k += .25) this.lamp(b.x0 + (b.x1 - b.x0) * k, b.y0 + (b.y1 - b.y0) * k, gy0, .9, [.3, 1, .95]);
    }
    // spread it about
    for (let pass = 0; pass < 3; pass++) {
      for (let gy = 0; gy < LH; gy++) for (let gx = 0; gx < LW; gx++) {
        const o = (gy * LW + gx) * 3;
        for (let ch = 0; ch < 3; ch++) {
          const l = gx > 0 ? L[o - 3 + ch] : L[o + ch], r = gx < LW - 1 ? L[o + 3 + ch] : L[o + ch];
          T[o + ch] = L[o + ch] * .5 + (l + r) * .25;
        }
      }
      for (let gy = 0; gy < LH; gy++) for (let gx = 0; gx < LW; gx++) {
        const o = (gy * LW + gx) * 3, oU = gy > 0 ? o - LW * 3 : o, oD = gy < LH - 1 ? o + LW * 3 : o;
        for (let ch = 0; ch < 3; ch++) L[o + ch] = T[o + ch] * .5 + (T[oU + ch] + T[oD + ch]) * .25;
      }
    }
    // the worm's own glow, and daylight fading with depth
    const w = game.worm, lr = 30 + 7 * game.up.vib, day = .55 + .45 * (this.daylight ?? 1);
    for (let gy = 0; gy < LH; gy++) {
      const wy = (gy0 + gy) * LG + LG / 2, d = wy - surfY;
      let dark = 0;
      if (d > 0) {
        let k = 0;
        for (let q = STRATA.length - 1; q >= 1; q--) if (d >= STRATA[q].top) { k = q; break; }
        const S0 = STRATA[k], into = d - S0.top, prev = k > 0 ? STRATA[k - 1].dark : 0;
        dark = k === 0 ? S0.dark * clamp(d / 40, 0, 1) + clamp((d - 20) / 110, 0, 1) * .12 : prev + (S0.dark - prev) * clamp(into / 60, 0, 1);
      }
      const amb = (1 - dark) * (d < 0 ? day : 1 - (1 - day) * clamp(1 - d / 40, 0, 1));
      for (let gx = 0; gx < LW; gx++) {
        const o = (gy * LW + gx) * 3, wx = (gx - 1) * LG + LG / 2;
        const dd = Math.hypot(wx - w.x, wy - w.y), wl = dd < lr ? Math.min(1, (1 - dd / lr) ** 1.2 * 1.3) * (1 - amb * .8) : 0;
        L[o] = Math.min(1.25, amb * .96 + L[o] + wl);
        L[o + 1] = Math.min(1.25, amb * .97 + L[o + 1] + wl * .93);
        L[o + 2] = Math.min(1.25, amb + L[o + 2] + wl * .8);
      }
    }
    // light the picture, a pixel at a time, stepping between grid points by dithering rather than blending
    const P = this.px;
    for (let by = 0; by < bh; by++) {
      const y = camY + by;
      if (y < 0) continue;
      const gyf = (y - gy0 * LG) / LG - .5, gyi = Math.floor(gyf), ty = gyf - gyi;
      const row = by * bw;
      for (let bx = 0; bx < bw; bx++) {
        const x = camX + bx;
        const mk = this.skyMask[row + bx];
        if (x < 0 || x >= W || mk === 1) continue;
        const gxf = x / LG + 1 - .5, gxi = Math.floor(gxf), tx = gxf - gxi;
        const th = bay(x, y), th2 = BAYER[(((y + 2) & 3) << 2) | ((x + 1) & 3)];
        const gx = clamp(gxi + (tx > th ? 1 : 0), 0, LW - 1), gy = clamp(gyi + (ty > th2 ? 1 : 0), 0, LH - 1);
        const o = (gy * LW + gx) * 3;
        let lr_ = L[o], lg = L[o + 1], lb = L[o + 2];
        if (mk === 2) { lr_ = clamp(lr_, .6, 1); lg = clamp(lg, .6, 1); lb = clamp(lb, .6, 1); }   // the worm: shaded, never blown out
        if (lr_ > .985 && lr_ < 1.015 && lg > .985 && lg < 1.015 && lb > .985 && lb < 1.015) continue;
        // a few steps of light, not a smooth ramp
        const q = v => Math.floor(v * 10 + .5) / 10;
        const v = P[row + bx];
        P[row + bx] = pack(Math.min(255, R8(v) * q(lr_)) | 0, Math.min(255, G8(v) * q(lg)) | 0, Math.min(255, B8(v) * q(lb)) | 0);
      }
    }
  }
  lamp(x, y, gy0, k, col) {
    const gx = Math.floor(x / LG) + 1, gy = Math.floor(y / LG) - gy0;
    if (gx < 0 || gy < 0 || gx >= this.LW || gy >= this.LH) return;
    const o = (gy * this.LW + gx) * 3;
    this.light[o] += col[0] * k; this.light[o + 1] += col[1] * k; this.light[o + 2] += col[2] * k;
  }

  /* ---------- sparkles ---------- */
  // Every find glints now and then, so there's something to see even in the dark.
  drawGlints(game, camX, camY) {
    const t = this.t, b0 = Math.max(0, Math.floor(camY / BAND)), b1 = Math.min(BANDS - 1, Math.floor((camY + this.bh) / BAND));
    for (let b = b0; b <= b1; b++) for (const o of game.objBand[b]) {
      if (o.gone || o.fresh) continue;
      const per = 2.6 + (o.id % 7) * .3, ph = (t + o.id * .37) % per;
      if (ph > .32) continue;
      const k = 1 - Math.abs(ph - .16) / .16, x = Math.round(o.x) - camX + ((o.id * 3) % 3) - 1, y = Math.round(o.y) - camY - 1;
      const c = Math.round(120 + 135 * k);
      this.add(x, y, c, c, c);
      if (k > .5) { this.add(x - 1, y, 90, 90, 90); this.add(x + 1, y, 90, 90, 90); this.add(x, y - 1, 90, 90, 90); this.add(x, y + 1, 90, 90, 90); }
    }
    // the vibration: faint rings rolling out from the head while it digs
    for (const r of this.rings) {
      const k = 1 - r.t / r.max, R = r.r0 + (r.r1 - r.r0) * (r.t / r.max);
      const n = Math.ceil(R * 5);
      for (let a = 0; a < n; a++) {
        if ((a + (r.seed | 0)) % 3) continue;
        const an = a / n * Math.PI * 2, x = Math.round(r.x + Math.cos(an) * R) - camX, y = Math.round(r.y + Math.sin(an) * R) - camY;
        const c = Math.round(40 * k);
        this.add(x, y, c, c * .8 | 0, c * .6 | 0);
      }
    }
  }

  /* ---------- the Old Ones' barriers ---------- */
  drawBeams(game, camX, camY) {
    const t = this.t;
    for (const b of game.plan.beams) {
      if (b.y0 < camY - 10 || b.y0 > camY + this.bh + 10) continue;
      const on = game.beamOn(b), n = Math.max(Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(b.x0 + (b.x1 - b.x0) * k / n) - camX, y = Math.round(b.y0 + (b.y1 - b.y0) * k / n) - camY;
        if (on) {
          const f = .7 + .3 * Math.sin(k * 1.7 + t * 40);
          this.add(x, y, 60 * f | 0, 255 * f | 0, 220 * f | 0);
          if (hsh(k, Math.floor(t * 20), 5) < .2) { this.add(x + (b.y0 === b.y1 ? 0 : 1), y + (b.y0 === b.y1 ? 1 : 0), 30, 140, 120); this.add(x - (b.y0 === b.y1 ? 0 : 1), y - (b.y0 === b.y1 ? 1 : 0), 30, 140, 120); }
        } else if (k % 3 === 0) this.add(x, y, 10, 40, 36);
      }
      // the emitters at each end
      for (const [ex, ey] of [[b.x0, b.y0], [b.x1, b.y1]]) { this.put(Math.round(ex) - camX, Math.round(ey) - camY, on ? px('#b0fff0') : px('#3a5a58')); }
    }
  }
  // Where the worm is headed, while steering: a small ring that pulses.
  drawTarget(camX, camY) {
    const p = this.target;
    if (!p) return;
    const r = 3 + Math.sin(this.t * 8) * .6, x0 = p.x - camX, y0 = p.y - camY;
    for (let a = 0; a < 12; a++) { if (a % 3 === 2) continue; const an = a / 12 * Math.PI * 2 + this.t; this.add(Math.round(x0 + Math.cos(an) * r), Math.round(y0 + Math.sin(an) * r), 90, 80, 60); }
  }

  /* ---------- little effects ---------- */
  spawn(kind, x, y, o = {}) {
    if (this.fx.length > 900) return;
    this.fx.push({ kind, x, y, vx: o.vx ?? 0, vy: o.vy ?? 0, life: o.life ?? .6, max: o.life ?? .6, col: o.col ?? px('#ffffff'), g: o.g ?? 0, drag: o.drag ?? 0, light: o.light ?? 0, lc: o.lc ?? [1, .8, .5] });
  }
  ring(x, y, r0, r1, life = .6) { if (this.rings.length < 12) this.rings.push({ x, y, r0, r1, t: 0, max: life, seed: Math.random() * 3 }); }
  updateFx(game, dt) {
    const keep = [];
    for (const f of this.fx) {
      f.life -= dt;
      if (f.life <= 0) continue;
      f.vy += f.g * dt; f.vx *= 1 - f.drag * dt; f.vy *= 1 - f.drag * dt;
      f.x += f.vx * dt; f.y += f.vy * dt;
      keep.push(f);
    }
    this.fx = keep;
    this.rings = this.rings.filter(r => (r.t += dt) < r.max);
    // effects the game asked for
    for (const e of game.fx) {
      if (e.type === 'steam') for (let k = 0; k < 3; k++) this.spawn('steam', e.x + Math.random(), e.y, { vy: -12 - Math.random() * 10, vx: (Math.random() - .5) * 8, life: 1.2, col: px('#d8dce0') });
      if (e.type === 'fire') this.spawn('fire', e.x + .5, e.y + .5, { vx: (Math.random() - .5) * 40, vy: -20 - Math.random() * 40, life: .5 + Math.random() * .4, col: px(Math.random() < .5 ? '#ffb040' : '#ff5a1a'), light: .6, lc: [1, .5, .15] });
    }
    game.fx.length = 0;
  }
  drawFx(camX, camY) {
    for (const f of this.fx) {
      const x = Math.round(f.x) - camX, y = Math.round(f.y) - camY;
      if (f.kind === 'glint' || f.kind === 'spark' || f.kind === 'fire' || f.kind === 'ember' || f.kind === 'coin') {
        const k = Math.min(1, f.life / f.max * 1.5);
        this.add(x, y, R8(f.col) * k | 0, G8(f.col) * k | 0, B8(f.col) * k | 0);
        if (f.kind === 'coin') this.put(x, y, f.col);
      } else if (f.life / f.max > .25 || (x + y) & 1) this.put(x, y, f.col);
    }
  }
  // Words and numbers floating up from where something happened. Each pops up (half as big again for a moment, and
  // bright, easing back), rises a little and fades away; repop gives one new words and pops it again, and it lasts
  // from then. The same words again close by (TOO HARD, grinding at rock) pop that one again, rather than another.
  float(x, y, text, col = '#ffffff', life = 1.3, big = false) {
    text = String(text).toUpperCase();
    const same = text && this.floats.find(f => f.text === text && f.worth === undefined && f.t < f.life - .05 && Math.abs(f.x - x) < 12 && Math.abs(f.y - f.rise - y) < 12);
    if (same) { this.repop(same, text); return same; }
    if (this.floats.length > 24) this.floats.shift();
    const f = { x, y, text, col: px(col), t: 0, age: 0, pop: 0, rise: 0, life, big };
    this.floats.push(f);
    return f;
  }
  repop(f, text, col) {
    f.text = String(text).toUpperCase();
    if (col) f.col = px(col);
    f.t = 0; f.pop = 0;
  }
  // They're drawn on the screen itself, over the world (so the pop can grow smoothly): each one's words and outline
  // drawn once to a little canvas, to scale up by the world's pixel size (or just the letters in white, for the flash).
  wordsSprite(text, col, flash = false) {
    const key = (flash ? 'flash' : col) + '|' + text;
    let cv = this.words.get(key);
    if (cv) return cv;
    const bw = text.length * 4 + 1, bh = 7, m = new Uint8Array(bw * bh);
    let cx = 1;
    for (const ch of text) { for (const [gx, gy] of FONT[ch] || FONT['?']) m[(gy + 1) * bw + cx + gx] = 2; cx += 4; }
    for (let i = 0; i < m.length; i++) if (m[i] === 2) for (const d of [-1, 1, -bw, bw]) if (!m[i + d]) m[i + d] = 1;
    cv = document.createElement('canvas'); cv.width = bw; cv.height = bh;
    const g = cv.getContext('2d'), img = g.createImageData(bw, bh), P = new Uint32Array(img.data.buffer);
    const ink = flash ? px('#ffffff') : col, rim = px('#140c0a');
    for (let i = 0; i < m.length; i++) if (m[i] === 2) P[i] = ink; else if (m[i] === 1 && !flash) P[i] = rim;
    g.putImageData(img, 0, 0);
    if (this.words.size > 300) this.words.clear();
    this.words.set(key, cv);
    return cv;
  }
  drawFloats(camX, camY, dt, fy) {
    const ctx = this.ctx, S = this.S, keep = [];
    for (const f of this.floats) {
      f.t += dt; f.age += dt; f.pop += dt;
      if (f.t > f.life) continue;
      keep.push(f);
      f.rise = Math.min(1, f.age / .5) * 10 + Math.min(f.age, 1.5) * 3;
      // fading away over the last part of its life (smoothly: lots of them at once stay calm)
      let a = Math.max(0, Math.min(1, (f.life - f.t) / Math.min(.6, f.life * .5)));
      a = a * a * (3 - 2 * a);
      // popping, from the middle of the words
      const p = Math.max(0, 1 - f.pop / .25), k = this.reduced ? 1 : 1 + .5 * p * p;
      const spr = this.wordsSprite(f.text, f.col), w = Math.round(spr.width * S * k), h = Math.round(spr.height * S * k);
      const x = Math.round((f.x - camX) * S - w / 2), y = Math.round((f.y - 10 - f.rise + 2.5 - camY) * S - fy - h / 2);
      ctx.globalAlpha = a;
      ctx.drawImage(spr, x, y, w, h);
      if (p > 0) { ctx.globalAlpha = a * .7 * p; ctx.drawImage(this.wordsSprite(f.text, 0, true), x, y, w, h); }
    }
    ctx.globalAlpha = 1;
    this.floats = keep;
  }
}
