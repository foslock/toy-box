// Ladder: the picture. A hazy, sun-faded side view: sky and far piles in parallax, the heap behind the route,
// the junk of the route as cached painterly sprites, the ladder face-on, and a small jointed painter.
import { KINDS, colorOf } from './junk.js';
import { LADDER, PAINTER, ladderEnds } from './physics.js';
import { rng, fade, shade, rgba, mix, hex, HAZE } from './paint.js';
import { pose, npcPose, drawPainter, ME, OLD } from './painter.js';
export { pose };

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hash = n => { let h = Math.imul(n | 0, 374761393) ^ 0x2545F491; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const noise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; };
const fbm = x => noise(x) * 0.6 + noise(x * 2.3 + 7) * 0.28 + noise(x * 5.1 + 3) * 0.12;
const ease = k => k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;

/* --------------------------------------------------------------------------------------------- the view */
export class View {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0 }; this.k = 50; this.w = 1; this.h = 1; this.dpr = 1;
    this.sprites = new Map(); this.backTiles = new Map(); this.fx = []; this.sky = 0; this.motes = [];
    for (let i = 0; i < 40; i++) this.motes.push({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7, ph: Math.random() * TAU });
  }
  setHeap(heap) { this.heap = heap; this.sprites.clear(); this.backTiles.clear(); this.chunks = makeChunks(heap); this.mid = makeMid(heap); }
  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = Math.min(dpr, 2.5);
    this.c.width = Math.round(w * this.dpr); this.c.height = Math.round(h * this.dpr);
    const k = clamp(Math.sqrt(w * h) / 14.5, 28, 72);
    if (Math.abs(k - this.k) > 0.5) { this.k = k; this.sprites.clear(); this.backTiles.clear(); }
  }
  toWorld(sx, sy) { return [this.cam.x + (sx - this.w / 2) / this.k, this.cam.y - (sy - this.h / 2) / this.k]; }
  toScreen(x, y) { return [(x - this.cam.x) * this.k + this.w / 2, this.h / 2 - (y - this.cam.y) * this.k]; }

  /* the camera eases toward a point, leading upward a little, and looking along the ladder while aiming */
  follow(x, y, dt, snap) {
    const tx = x, ty = y + this.h / this.k * 0.12;
    const k = snap ? 1 : 1 - Math.exp(-dt * 3.2);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
  }

  puff(x, y, n = 6, size = 0.3, col = [214, 196, 166]) {
    for (let i = 0; i < n; i++) this.fx.push({ kind: 'puff', x: x + (Math.random() - 0.5) * size, y: y + Math.random() * size * 0.4, vx: (Math.random() - 0.5) * 1.2, vy: Math.random() * 0.8, r: size * (0.3 + Math.random() * 0.5), life: 0, T: 0.7 + Math.random() * 0.6, col });
  }
  note(kind, x, y, o = {}) { this.fx.push({ kind, x, y, life: 0, T: o.T || 1.2, ...o }); }

  draw(v, dt, opt = {}) {
    const ctx = this.ctx, k = this.k;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawSky(ctx, v);
    this.drawFar(ctx);
    // world space
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2); ctx.scale(k, -k); ctx.translate(-this.cam.x, -this.cam.y);
    this.winT = v && v.mode === 'win' ? v.anim.t : -1;
    this.drawStroke(ctx);
    this.drawGround(ctx);
    this.drawBack(ctx);
    const vw = this.w / k / 2 + 2, vh = this.h / k / 2 + 2;
    const x0 = this.cam.x - vw, x1 = this.cam.x + vw, y0 = this.cam.y - vh, y1 = this.cam.y + vh;
    let made = 0;
    for (const ob of this.heap.objs) {
      if (ob.box[2] < x0 || ob.box[0] > x1 || ob.box[3] < y0 || ob.box[1] > y1) {
        // paint a couple of nearby ones ahead of time, so a fast fall doesn't stutter
        if (made < 2 && !this.sprites.has(ob) && ob.box[2] > x0 - vw && ob.box[0] < x1 + vw && ob.box[3] > y0 - vh * 1.5 && ob.box[1] < y1 + vh) { this.sprites.set(ob, this.makeSprite(ob)); made++; }
        continue;
      }
      this.drawObj(ctx, ob);
    }
    if (opt.extra) opt.extra(ctx);
    if (this.heap.summit) this.drawNpc(ctx, v);
    if (v) {
      this.drawLadder(ctx, v.lad, v);
      this.drawMe(ctx, v);
      if (v.mode === 'aim' && v.aim) this.drawAim(ctx, v);
    }
    this.drawFx(ctx, dt);
    ctx.restore();
    this.drawMotes(ctx, dt);
  }

  /* ---------------------------------------------------------------------------------------- sky and distance */
  // the old painter at the top: waits, takes the can, and paints the sky its blue again
  drawNpc(ctx, v) {
    const S = this.heap.summit, x = S.npc, y = S.y0 + 0.2, t = v ? v.t : 0;
    if (Math.abs(x - this.cam.x) > this.w / this.k + 2 || Math.abs(y - this.cam.y) > this.h / this.k + 2) return;
    const w = v && v.mode === 'win' ? v.anim.t : (v && v.won ? 99 : -1);
    drawPainter(ctx, npcPose(x, y, t, w), OLD);
  }
  // His brushstroke: it comes off the brush and sweeps up across the faded sky, a broad loaded stroke of blue;
  // then the whole sky turns that blue and the stroke melts into it. In the world, so it sits behind the heap.
  drawStroke(ctx) {
    const S = this.heap.summit; if (!S || this.winT < 3.4) return;
    const k = clamp((this.winT - 3.4) / 2.4, 0, 1), fadeOut = 1 - clamp((this.sky - 0.25) / 0.6, 0, 1);
    if (fadeOut <= 0) return;
    const x0 = S.npc + 0.7, y0 = S.y0 + 2.3, R = rng(91), n = 22, bw = 1.3;
    const pt = u => [x0 + u * 15, y0 + Math.sin(u * Math.PI * 0.85) * 4.2 + u * 1.2];
    ctx.save(); ctx.lineCap = 'round'; ctx.globalAlpha = fadeOut;
    for (let i = 0; i < n; i++) {
      const o = (i / (n - 1) - 0.5) * bw, dry = 0.55 + R() * 0.45, end = Math.min(k, dry + (1 - dry) * k), tone = R();
      ctx.strokeStyle = `rgba(${40 + tone * 40 | 0},${104 + tone * 50 | 0},${200 + tone * 30 | 0},${0.35 + R() * 0.4})`;
      ctx.lineWidth = bw / n * (1.6 + R() * 1.4);
      ctx.beginPath();
      for (let u = 0; u <= end + 1e-6; u += 0.01) {
        const [x, y] = pt(u), taper = Math.min(1, u * 8) * (1 - 0.3 * u);
        const yy = y + o * taper + Math.sin(u * 23 + i) * 0.03;
        if (u === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  drawSky(ctx, v) {
    const w = this.w, h = this.h, alt = clamp(this.cam.y / 80, 0, 1), blue = this.sky;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    const top = mix(mix([176, 197, 205], [196, 205, 206], alt * 0.3), [86, 150, 214], blue);
    const mid = mix([231, 219, 196], [150, 196, 226], blue * 0.8);
    g.addColorStop(0, rgba(top)); g.addColorStop(0.55, rgba(mid)); g.addColorStop(1, rgba(mix([242, 222, 192], [214, 222, 220], blue * 0.5)));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // the sun, high on the right, and its glare
    const sx = w * 0.8, sy = h * 0.16 + alt * h * 0.05, R = Math.min(w, h) * 0.07;
    const gl = ctx.createRadialGradient(sx, sy, R * 0.6, sx, sy, Math.max(w, h) * 0.75);
    gl.addColorStop(0, 'rgba(255,246,222,0.75)'); gl.addColorStop(0.18, 'rgba(255,236,200,0.28)'); gl.addColorStop(1, 'rgba(255,230,190,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,251,238,0.95)'; ctx.beginPath(); ctx.arc(sx, sy, R, 0, TAU); ctx.fill();
  }
  // far piles and mesas in parallax: they sit on the horizon and slide by slowly
  drawFar(ctx) {
    // far piles and mesas sit on the horizon; the higher you climb, the further below you they sink
    const w = this.w, h = this.h, k = this.k, horizon = h * 0.6;
    const layers = [
      { p: 0.035, amp: 3.2, f: 0.012, col: [205, 190, 196], flat: true },
      { p: 0.08, amp: 3.6, f: 0.035, col: [207, 188, 170] },
      { p: 0.18, amp: 4.4, f: 0.06, col: [192, 168, 146] },
    ];
    for (const L of layers) {
      const base = horizon + Math.max(0, this.cam.y) * k * L.p;
      if (base - L.amp * k * 0.6 > h + 10) continue;
      ctx.fillStyle = rgba(mix(L.col, mix([242, 222, 192], [170, 205, 225], this.sky * 0.5), 0.15));
      ctx.beginPath(); ctx.moveTo(0, h + 2);
      for (let sx = 0; sx <= w + 8; sx += 8) {
        const wx = (sx - w / 2) / (k * 0.6) + this.cam.x * L.p * 3;
        let hh = fbm(wx * L.f) * 0.5 + 0.5;
        if (L.flat) hh = Math.min(0.75, hh * 1.3) + (noise(wx * 0.3) > 0.6 ? 0.05 : 0);
        else hh += Math.max(0, noise(wx * L.f * 9 + 4)) * 0.18;
        ctx.lineTo(sx, base - hh * L.amp * k * 0.6);
      }
      ctx.lineTo(w, h + 2); ctx.closePath(); ctx.fill();
    }
  }
  drawGround(ctx) {
    const y = 0, x0 = this.cam.x - this.w / this.k, x1 = this.cam.x + this.w / this.k;
    if (this.cam.y - this.h / this.k > 1) return;
    const g = ctx.createLinearGradient(0, 0, 0, -6);
    g.addColorStop(0, '#d9c29d'); g.addColorStop(0.4, '#cdb38b'); g.addColorStop(1, '#bfa47c');
    ctx.fillStyle = g; ctx.fillRect(x0, -8, x1 - x0, 8);
    ctx.fillStyle = 'rgba(160,128,96,0.25)';
    for (let x = Math.floor(x0); x < x1; x += 1) { const r = hash(x * 13); if (r > 0.55) ctx.fillRect(x + r, -0.1 - r * 0.3, 0.6 + r, 0.05); }
  }

  /* ---------------------------------------------------------------------------------------- the heap behind */
  drawBack(ctx) {
    const T = 16, S = 18;   // tiles of T metres, S px per metre
    const vw = this.w / this.k / 2 + 1, vh = this.h / this.k / 2 + 1;
    for (let tx = Math.floor((this.cam.x - vw) / T); tx <= Math.floor((this.cam.x + vw) / T); tx++)
      for (let ty = Math.max(0, Math.floor((this.cam.y - vh) / T)); ty <= Math.floor((this.cam.y + vh) / T); ty++) {
        const key = tx + ',' + ty;
        let tile = this.backTiles.get(key);
        if (tile === undefined) { tile = this.makeBackTile(tx, ty, T, S); this.backTiles.set(key, tile); }
        if (!tile) continue;
        ctx.save(); ctx.translate(tx * T, (ty + 1) * T); ctx.scale(1 / S, -1 / S); ctx.drawImage(tile, 0, 0); ctx.restore();
      }
  }
  makeBackTile(tx, ty, T, S) {
    const heap = this.heap, x0 = tx * T, y0 = ty * T;
    const inTile = o => o.box[2] > x0 - 0.5 && o.box[0] < x0 + T + 0.5 && o.box[3] > y0 - 0.5 && o.box[1] < y0 + T + 0.5;
    const chunks = this.chunks.filter(inTile), obs = heap.back.filter(inTile);
    if (!chunks.length && !obs.length && !this.mid.some(inTile)) return null;
    const c = document.createElement('canvas'); c.width = T * S; c.height = T * S;
    const g = c.getContext('2d');
    g.setTransform(S, 0, 0, -S, -x0 * S, (y0 + T) * S);
    // the heap: loose chunks of junk wedged under each ledge, on a broad pile at the bottom, with sky between
    for (const ch of chunks) {
      // a dark core so there are no holes, then the junk itself makes the ragged outline
      g.beginPath(); g.moveTo(ch.core[0][0], ch.core[0][1]); for (const [x, y] of ch.core) g.lineTo(x, y); g.closePath();
      g.fillStyle = '#9a8371'; g.fill();
      for (const ob of ch.items) {
        if (!inTile(ob)) continue;
        g.save(); g.translate(ob.x, ob.y); g.rotate((ob.r || 0) * Math.PI / 180); g.scale(ob.f || 1, 1);
        ob.col = mix(colorOf(ob), [150, 128, 112], 0.28 + ob.deep * 0.4);
        KINDS[ob.k].draw(g, ob, rng(ob.seed));
        g.restore();
      }
    }
    // haze over it all: the back of the heap sits in the dust
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(226,208,186,0.62)'; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
    // nearer junk wedged under the ledges, in less haze, so the shelves look held up
    const mid = this.mid.filter(inTile);
    if (mid.length || obs.length) {
      const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
      const h = t.getContext('2d'); h.setTransform(S, 0, 0, -S, -x0 * S, (y0 + T) * S);
      for (const ob of [...mid, ...obs]) {
        h.save(); h.translate(ob.x, ob.y); h.rotate((ob.r || 0) * Math.PI / 180); h.scale(ob.f || 1, 1);
        ob.col = mix(colorOf(ob), [150, 128, 112], 0.22);
        KINDS[ob.k].draw(h, ob, rng(ob.seed));
        h.restore();
      }
      h.setTransform(1, 0, 0, 1, 0, 0); h.globalCompositeOperation = 'source-atop'; h.fillStyle = 'rgba(214,192,170,0.36)'; h.fillRect(0, 0, t.width, t.height);
      g.drawImage(t, 0, 0);
    }
    return c;
  }

  /* ---------------------------------------------------------------------------------------- the route's junk */
  drawObj(ctx, ob) {
    let sp = this.sprites.get(ob);
    if (!sp) { sp = this.makeSprite(ob); this.sprites.set(ob, sp); }
    ctx.save(); ctx.translate(sp.x, sp.y); ctx.scale(1 / sp.s, -1 / sp.s); ctx.drawImage(sp.c, 0, 0); ctx.restore();
  }
  makeSprite(ob) {
    const K = KINDS[ob.k], pad = K.pad || 0.25, [bx0, by0, bx1, by1] = ob.box, s = Math.min(this.k * this.dpr, 150);
    const w = Math.ceil((bx1 - bx0 + pad * 2) * s), h = Math.ceil((by1 - by0 + pad * 2) * s);
    const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h);
    const g = c.getContext('2d');
    const top = by1 + pad;
    g.setTransform(s, 0, 0, -s, -(bx0 - pad) * s, top * s);
    // a soft shadow under each piece, where it sits on what's below
    g.save(); g.translate(ob.x, ob.y); g.rotate((ob.r || 0) * Math.PI / 180); g.scale(ob.f || 1, 1);
    ob.col = colorOf(ob);
    KINDS[ob.k].draw(g, ob, rng(ob.seed));
    g.restore();
    // a soft shadow down and to the left (the sun is high on the right) lifts the route off the heap behind it
    const out = document.createElement('canvas'); out.width = c.width; out.height = c.height;
    const o = out.getContext('2d'), sh = document.createElement('canvas'); sh.width = c.width; sh.height = c.height;
    const sg = sh.getContext('2d'); sg.drawImage(c, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = 'rgba(70,44,36,0.32)'; sg.fillRect(0, 0, sh.width, sh.height);
    o.drawImage(sh, -0.07 * s, 0.1 * s); o.drawImage(sh, -0.04 * s, 0.05 * s); o.drawImage(c, 0, 0);
    return { c: out, x: bx0 - pad, y: top, s };
  }

  /* ---------------------------------------------------------------------------------------- the ladder */
  drawLadder(ctx, lad, v) {
    const L = LADDER.L, c = Math.cos(lad.a), s = Math.sin(lad.a), half = 0.085;
    ctx.save(); ctx.translate(lad.fx, lad.fy); ctx.rotate(lad.a);
    const wood = [205, 170, 118], dark = [120, 84, 54];
    // shadow side
    ctx.lineCap = 'round';
    for (let i = 1; i <= 14; i++) { const x = i * LADDER.rung - 0.05; ctx.strokeStyle = rgba(dark); ctx.lineWidth = 0.055; ctx.beginPath(); ctx.moveTo(x, -half); ctx.lineTo(x, half); ctx.stroke(); ctx.strokeStyle = rgba(wood); ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(x, -half); ctx.lineTo(x, half); ctx.stroke(); }
    for (const o of [-half, half]) {
      ctx.fillStyle = rgba(dark); ctx.fillRect(-0.02, o - 0.035, L + 0.04, 0.07);
      ctx.fillStyle = rgba(o > 0 ? shade(wood, 0.12) : wood); ctx.fillRect(0, o - 0.022, L, 0.044);
    }
    // a drip of paint and the rubber feet
    ctx.fillStyle = rgba(fade('#3a7ad0', 0.25)); ctx.fillRect(2.35, half - 0.03, 0.12, 0.05); ctx.fillRect(2.4, half - 0.08, 0.03, 0.06);
    ctx.fillStyle = 'rgb(60,52,50)'; ctx.fillRect(-0.04, -half - 0.04, 0.08, 0.08); ctx.fillRect(-0.04, half - 0.04, 0.08, 0.08);
    ctx.restore();
  }
  drawAim(ctx, v) {
    const a = v.aim; if (!a) return;
    const L = LADDER.L, c = Math.cos(a.a), s = Math.sin(a.a);
    if (a.ok) {
      const x = a.fx + c * L * a.t, y = a.fy + s * L * a.t, pulse = 0.5 + 0.5 * Math.sin(v.t * 8);
      ctx.strokeStyle = `rgba(255,252,240,${0.6 + pulse * 0.3})`; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(x, y, 0.18 + pulse * 0.05, 0, TAU); ctx.stroke();
    } else {
      ctx.setLineDash([0.12, 0.12]); ctx.strokeStyle = 'rgba(255,240,220,0.55)'; ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.arc(a.fx, a.fy, L, a.a - 0.25, a.a + 0.25); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  /* ---------------------------------------------------------------------------------------- the painter */
  drawMe(ctx, v) {
    const P = pose(v);
    drawPainter(ctx, P, ME);
    // a bead of sweat when the ladder strains under them
    if (v.strain > 0.8 && v.mode === 'climb') { const a = (v.t * 1.5) % 1, h = P.head; ctx.fillStyle = `rgba(170,210,235,${1 - a})`; ctx.beginPath(); ctx.arc(h[0] - (P.hf || P.he)[0] * 0.12, h[1] + 0.05 - a * 0.25, 0.02, 0, Math.PI * 2); ctx.fill(); }
  }

  /* ---------------------------------------------------------------------------------------- effects */
  drawFx(ctx, dt) {
    const keep = [];
    for (const e of this.fx) {
      e.life += dt; if (e.life > e.T) continue; keep.push(e);
      const k = e.life / e.T;
      if (e.kind === 'puff') {
        e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= 0.96; e.vy *= 0.96;
        ctx.fillStyle = rgba(e.col, 0.45 * (1 - k)); ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.6 + k), 0, TAU); ctx.fill();
      } else if (e.kind === 'sigh') {
        ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; ctx.lineWidth = 0.025;
        ctx.beginPath(); ctx.arc(e.x + k * 0.3 * e.f, e.y + k * 0.3, 0.06 + k * 0.08, 0, TAU); ctx.stroke();
      } else if (e.kind === 'best') {
        ctx.save(); ctx.translate(e.x, e.y + k * 0.6); ctx.scale(1, -1);
        ctx.font = '600 3.2px Oswald, sans-serif'; ctx.scale(0.1, 0.1); ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255,250,236,${1 - k})`; ctx.fillText(e.text, 0, 0); ctx.restore();
      } else if (e.kind === 'creak') {
        ctx.strokeStyle = `rgba(255,248,230,${0.8 * (1 - k)})`; ctx.lineWidth = 0.03;
        for (let i = 0; i < 3; i++) { const a = e.a + (i - 1) * 0.6; ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * (0.15 + k * 0.1), e.y + Math.sin(a) * (0.15 + k * 0.1)); ctx.lineTo(e.x + Math.cos(a) * (0.28 + k * 0.15), e.y + Math.sin(a) * (0.28 + k * 0.15)); ctx.stroke(); }
      }
    }
    this.fx = keep;
  }
  drawMotes(ctx, dt) {
    const w = this.w, h = this.h;
    for (const m of this.motes) {
      m.ph += dt * 0.4; m.x += dt * 0.004 * m.z; m.y -= dt * 0.002 * m.z; if (m.x > 1) m.x -= 1; if (m.y < 0) m.y += 1;
      const x = ((m.x - this.cam.x * 0.004 * m.z) % 1 + 1) % 1 * w, y = ((m.y + this.cam.y * 0.006 * m.z) % 1 + 1) % 1 * h;
      ctx.fillStyle = `rgba(255,248,226,${0.25 + 0.2 * Math.sin(m.ph)})`; ctx.beginPath(); ctx.arc(x, y, 0.8 + m.z * 1.4, 0, TAU); ctx.fill();
    }
  }
}

const PILE = ['car', 'crushed', 'crushed', 'fridge', 'washer', 'stove', 'crate', 'tires', 'drum', 'barrel', 'mattress', 'sofa', 'wardrobe', 'tv', 'cabinet', 'door', 'tire', 'piano', 'boat', 'booth', 'clock', 'cart', 'vending', 'armchair', 'beam', 'plank', 'container'];
// A few pieces under each ledge of the route, as if they hold it up. Scenery only.
function makeMid(heap) {
  const R = rng(777), out = [];
  for (const L of heap.ledges || []) {
    if (L.top < 1) continue;
    const n = 2 + Math.round((L.x1 - L.x0) / 1.6);
    for (let i = 0; i < n; i++) {
      const k = PILE[(R() * PILE.length) | 0];
      if (k === 'container' || k === 'boat') continue;
      const ob = { k, x: L.x0 + 0.3 + R() * (L.x1 - L.x0 - 0.6), y: L.top - 1.4 - R() * 2.2, r: (R() - 0.5) * 50, f: R() < 0.5 ? -1 : 1, c: (R() * 9) | 0, seed: 5000 + out.length * 7, l: 1.5 + R() * 2, w: k === 'crushed' ? 1.8 + R() : undefined, h: k === 'crushed' ? 0.8 : undefined, n: k === 'tires' ? 2 : undefined };
      ob.box = boxOf(ob); out.push(ob);
    }
  }
  return out;
}
function boxOf(ob) {
  const pts = KINDS[ob.k].parts(ob).flatMap(p => p.pts), r = (ob.r || 0) * Math.PI / 180, ca = Math.cos(r), sa = Math.sin(r);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const [px, py] of pts) { const X = px * (ob.f || 1), wx = ob.x + X * ca - py * sa, wy = ob.y + X * sa + py * ca; bx0 = Math.min(bx0, wx); bx1 = Math.max(bx1, wx); by0 = Math.min(by0, wy); by1 = Math.max(by1, wy); }
  return [bx0 - 0.4, by0 - 0.4, bx1 + 0.4, by1 + 0.4];
}
// The heap behind the route: a broad pile at the foot, and a chunk of junk hanging under each ledge, tapering
// down a few metres, so the route reads as the face of a teetering stack with sky showing through it. Scenery only.
function makeChunks(heap) {
  const R = rng(4242), out = [];
  const chunk = pts => {
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const [x, y] of pts) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
    const ch = { pts, box: [bx0, by0, bx1, by1], items: [] };
    for (let x = bx0 - 0.6; x < bx1 + 0.6; x += 1.25) for (let y = by0 - 0.6; y < by1 + 0.3; y += 1.1 + R() * 0.5) {
      const px = x + (R() - 0.5) * 0.9, py = y + (R() - 0.5) * 0.4;
      if (!inside(pts, px, py)) continue;
      const k = PILE[(R() * PILE.length) | 0];
      if ((k === 'container' || k === 'boat') && R() < 0.8) continue;
      const r = R() < 0.25 ? (R() < 0.5 ? 90 : 180) : (R() - 0.5) * 70;
      const ob = { k, x: px, y: py, r, f: R() < 0.5 ? -1 : 1, c: (R() * 9) | 0, seed: out.length * 1000 + ch.items.length * 13 + 7, deep: Math.min(1, (by1 - py) / 5), l: 1.5 + R() * 2.5, w: k === 'crushed' ? 2.2 + R() * 1.4 : k === 'container' ? 4 + R() * 2 : undefined, h: k === 'crushed' ? 0.8 + R() * 0.4 : undefined, n: k === 'tires' ? 2 + ((R() * 3) | 0) : undefined };
      ob.box = boxOf(ob); ch.items.push(ob);
    }
    ch.items.sort((a, b) => b.deep - a.deep);
    // the core: the outline pulled in toward its middle
    const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
    ch.core = pts.map(([x, y]) => [x + (cx - x) * 0.18, y + (cy - y) * 0.12]);
    ch.box = [bx0 - 1.5, by0 - 1.5, bx1 + 1.5, by1 + 1.5];
    out.push(ch);
    return ch;
  };
  // a leg: tall narrow junk stacked from y down to y1, slightly crooked
  const LEGS = [['drum', 0.88], ['tires', 0.81], ['fridge', 1.8], ['cabinet', 1.32], ['clock', 2.1], ['washer', 0.86], ['booth', 2.4]];
  const leg = (x, y, y1) => {
    const items = [];
    for (let yy = y1, guard = 0; yy < y - 0.3 && guard < 8; guard++) {
      const [k, h] = LEGS[(R() * LEGS.length) | 0];
      const ob = { k, x: x + (R() - 0.5) * 0.25, y: yy, r: (R() - 0.5) * 9, f: R() < 0.5 ? -1 : 1, c: (R() * 9) | 0, seed: 90000 + out.length * 31 + items.length, deep: 0.3, n: 3 };
      ob.box = boxOf(ob); items.push(ob); yy += h - 0.05;
    }
    if (!items.length) return;
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const o of items) { bx0 = Math.min(bx0, o.box[0]); by0 = Math.min(by0, o.box[1]); bx1 = Math.max(bx1, o.box[2]); by1 = Math.max(by1, o.box[3]); }
    out.push({ items, core: [[x, y1], [x, y1]], box: [bx0, by0, bx1, by1] });
  };
  // the foot of the heap: an outline over everything low down, sides about 50°
  const low = heap.objs.filter(o => o.box[3] < 13 && o.box[1] < 9);
  const foot = [[-24, 0]];
  for (let x = -24; x <= 22; x += 0.7) {
    let t = 0;
    for (const o of low) { const d = Math.max(0, o.box[0] - x, x - o.box[2]); t = Math.max(t, o.box[3] - 0.6 - d * 1.2); }
    foot.push([x, Math.max(0, t + noise(x * 0.8) * 0.5)]);
  }
  foot.push([22, 0]);
  chunk(foot);
  // a hanging chunk under each ledge
  for (const L of heap.ledges || []) {
    if (L.top < 9) continue;
    const top = L.top - 0.25, depth = 3.2 + R() * 2.4, w = L.x1 - L.x0, pts = [];
    const n = Math.max(3, Math.round(w / 0.8));
    for (let i = 0; i <= n; i++) pts.push([L.x0 - 0.7 + (w + 1.4) * i / n, top + (R() - 0.5) * 0.2]);
    const b0 = L.x0 + 0.3 + R() * 0.4, b1 = L.x1 - 0.3 - R() * 0.4;
    pts.push([L.x1 + 0.3, top - depth * 0.45], [b1, top - depth * (0.8 + R() * 0.2)]);
    for (let i = 1; i < 4; i++) pts.push([b1 + (b0 - b1) * i / 4, top - depth + (R() - 0.3) * 0.9]);
    pts.push([b0, top - depth * (0.8 + R() * 0.2)], [L.x0 - 0.3, top - depth * 0.45]);
    chunk(pts);
    // propped on whatever is below: a crooked stack of drums and fridges down to the next chunk or the heap
    const under = (heap.ledges || []).filter(M => M !== L && M.top < L.top - 3 && M.x1 > b0 && M.x0 < b1).reduce((a, M) => Math.max(a, M.top - 0.3), L.top < 16 ? 2 : -1);
    if (under > 0 && L.top - depth - under < 9) { const lx = b0 + (b1 - b0) * (0.3 + R() * 0.4); leg(lx, top - depth + 0.3, under); }
  }
  return out;
}
function inside(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
