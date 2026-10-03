// Ladder: the picture. A hazy, sun-faded side view: sky and far piles in parallax, the heap behind the route,
// the junk of the route as cached painterly sprites, the ladder face-on, and a small jointed painter.
import { KINDS, colorOf } from './junk.js';
import { LADDER, PAINTER, ladderEnds } from './physics.js';
import { rng, fade, shade, rgba, mix, hex, HAZE } from './paint.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const hash = n => { let h = Math.imul(n | 0, 374761393) ^ 0x2545F491; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const noise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; };
const fbm = x => noise(x) * 0.6 + noise(x * 2.3 + 7) * 0.28 + noise(x * 5.1 + 3) * 0.12;
const ease = k => k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;

/* --------------------------------------------------------------------------------------------- the painter */
const SKIN = [226, 182, 146], SUIT = [240, 234, 220], CAP = fade('#c4523f', 0.18), BOOT = [112, 82, 64], INK = [70, 44, 42];
const ME = { suit: SUIT, skin: SKIN, cap: CAP };
const OLD = { suit: fade('#6f8fb0', 0.25), skin: [214, 170, 136], cap: null, hair: [226, 222, 214] };
const LEG1 = 0.43, LEG2 = 0.43, ARM1 = 0.3, ARM2 = 0.3, TORSO = 0.5, NECK = 0.17, HEAD = 0.125;
function ik(ax, ay, tx, ty, l1, l2, bend) {
  let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy) || 1e-6;
  const base = Math.atan2(dy, dx);
  if (d >= l1 + l2 - 1e-4) return [ax + Math.cos(base) * l1, ay + Math.sin(base) * l1, ax + Math.cos(base) * (l1 + l2), ay + Math.sin(base) * (l1 + l2)];
  d = Math.max(d, Math.abs(l1 - l2) + 1e-4);
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), ang = base + bend * a;
  return [ax + Math.cos(ang) * l1, ay + Math.sin(ang) * l1, tx, ty];
}
const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const along = (lad, s, o = 0) => { const c = Math.cos(lad.a), n = Math.sin(lad.a); return [lad.fx + c * s - n * o, lad.fy + n * s + c * o]; };

// Joint positions for the painter in whatever they're doing. Returns { hip, neck, head, fl, fr, hl, hr, face, tilt, mood, can }.
export function pose(v) {
  const p = v.p, t = v.t, face = p.face || 1;
  let P;
  const standing = (x, y, opt = {}) => {
    const bob = Math.sin(t * 2.1) * 0.012 * (1 - (p.walk || 0)), w = p.walk || 0, ph = (p.stride || 0) / 0.55 * Math.PI;
    const sw = Math.sin(ph) * 0.2 * w, lift = Math.max(0, Math.cos(ph)) * 0.08 * w, lift2 = Math.max(0, -Math.cos(ph)) * 0.08 * w;
    const hip = [x + face * 0.02, y + LEG1 + LEG2 - 0.04 - bob - w * 0.03];
    const neck = [hip[0] + face * (0.04 + w * 0.05) + (opt.lean || 0), hip[1] + TORSO];
    return { hip, neck, fl: [x - 0.08 + face * sw, y + lift], fr: [x + 0.08 - face * sw, y + lift2], swing: sw };
  };
  switch (v.mode) {
    case 'climb': {
      const R = v.rider, side = R.side, ph = (R.s / LADDER.rung) % 2, tri = ph < 1 ? ph : 2 - ph;
      const fl = along(v.lad, R.s + 0.16 * tri, side * 0.04), fr = along(v.lad, R.s + 0.16 * (1 - tri), side * 0.04);
      const hip = along(v.lad, R.s + 0.72, side * 0.26), neck = along(v.lad, R.s + 1.2, side * 0.23);
      const hl = along(v.lad, R.s + 1.12 + 0.18 * (1 - tri), side * 0.03), hr = along(v.lad, R.s + 1.12 + 0.18 * tri, side * 0.03);
      P = { hip, neck, fl, fr, hl, hr, kneeBend: -side * Math.sign(Math.cos(v.lad.a) || 1), climbing: true };
      P.face = Math.cos(v.lad.a) >= 0 ? 1 : -1;
      break;
    }
    case 'fall': {
      const b = v.pb, sp = b.spin || 0, fl = Math.sin(t * 15) * 0.5;
      const c = [b.x, b.y];
      const off = (x, y) => { const [rx, ry] = rot(x, y, sp); return [c[0] + rx, c[1] + ry]; };
      const hip = off(0, -0.18), neck = off(0, 0.3);
      const grip = v.rope ? along(v.lad, v.rope.s) : off(0.5, 0.6);
      P = { hip, neck, fl: off(-0.35 + fl * 0.2, -0.75), fr: off(0.3 - fl * 0.2, -0.7), hl: grip, hr: off(0.5 + fl * 0.2, 0.55 - fl * 0.3), face: b.vx >= 0 ? 1 : -1, flail: true };
      P.kneeBend = 1;
      break;
    }
    case 'down': {
      const a = v.anim, lie = a.lie, k = a.t;
      const x = v.downX ?? p.x, y = p.y;
      if (k < lie) {
        // on their back, the arm still out toward the ladder, a slow breath
        const br = Math.sin(t * 1.6) * 0.01, f = face;
        const hip = [x - f * 0.25, y + 0.14], neck = [x + f * 0.25, y + 0.16 + br];
        P = { hip, neck, fl: [x - f * 1.05, y + 0.08], fr: [x - f * 0.95, y + 0.25 + Math.max(0, Math.sin(k * 3) * 0.08 * (k < 1 ? 1 : 0))], hl: [x + f * 0.55, y + 0.05], hr: [x + f * 0.3, y + 0.45], face: f, lying: true, kneeBend: -f };
        P.mood = 'dazed';
      } else {
        const u = clamp((k - lie) / 0.9, 0, 1), w = clamp((k - lie - 0.9) / 0.6, 0, 1), f = face;
        if (w <= 0) {
          // sitting up, looking back up the heap
          const tor = lerp(Math.PI / 2 * 0.95, 0.15, ease(u));
          const hip = [x - f * 0.1, y + 0.16];
          const neck = [hip[0] + Math.sin(tor) * TORSO * f, hip[1] + Math.cos(tor) * TORSO];
          P = { hip, neck, fl: [x - f * 0.0 + f * 0.6, y + 0.04], fr: [x + f * 0.75, y + 0.05], hl: [hip[0] - f * 0.15, y + 0.1], hr: [x + f * 0.2, y + 0.2 + u * 0.1], face: f, kneeBend: f, look: u };
          P.mood = 'sad'; P.patCan = u > 0.6;
        } else {
          const S = standing(x, y);
          const crouch = (1 - ease(w)) * 0.45;
          S.hip[1] -= crouch; S.neck[1] -= crouch * 0.9; S.neck[0] += face * crouch * 0.4;
          P = { ...S, hl: [S.hip[0] + face * 0.2, S.hip[1] + 0.1], hr: [S.hip[0] - face * 0.1, S.hip[1] - 0.05], face, kneeBend: face, mood: 'sad' };
        }
      }
      break;
    }
    case 'stepoff': {
      const a = v.anim, k = ease(clamp(a.t / a.T, 0, 1));
      const x = lerp(a.x0, a.x1, k), y = lerp(a.y0, a.y1, k) + Math.sin(k * Math.PI) * 0.25;
      const S = standing(x, y);
      const lad = v.lad, lean = 1 - k;
      P = { ...S, fl: [lerp(a.x0, a.x1, Math.min(1, k * 1.6)), lerp(a.y0, a.y1, Math.min(1, k * 1.6)) + Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.3], hl: along(lad, LADDER.L - 0.2), hr: [S.neck[0] + face * 0.35, S.neck[1] - 0.05 + lean * 0.3], face, kneeBend: face };
      break;
    }
    case 'haul': {
      const S = standing(p.x, p.y, { lean: -face * 0.05 });
      const k = v.anim.t / v.anim.T, hh = Math.sin(k * Math.PI * 5);
      // hands on the ladder where it passes them
      const near = nearestOnLadder(v.lad, S.neck[0], S.neck[1] - 0.2);
      P = { ...S, hl: [near[0], near[1] + hh * 0.08], hr: [near[0] - face * 0.02, near[1] - 0.18 - hh * 0.08], face, kneeBend: face };
      break;
    }
    case 'aim': {
      const S = standing(p.x, p.y);
      const nh = nearestOnLadder(v.lad, S.neck[0], S.neck[1] - 0.15, 0.4, 1.4);
      P = { ...S, hl: nh, hr: along(v.lad, 0.45), face, kneeBend: face, mood: 'focus' };
      break;
    }
    case 'win': {
      const S = standing(p.x, p.y), w = v.anim?.t || 0;
      const up = clamp((w - 1.2) / 0.5, 0, 1), given = w > 2.0;
      P = { ...S, hl: given ? [S.hip[0] + face * 0.12, S.hip[1] - 0.05] : [S.neck[0] + face * (0.2 + up * 0.25), lerp(S.hip[1] + 0.05, S.neck[1] + 0.05, up)], hr: [S.hip[0] - face * 0.05, S.hip[1] - 0.3], face, kneeBend: face,
        mood: w > 6 ? 'happy' : null, canUp: !given && up > 0.3, noCan: given, look: w > 3.4 ? Math.min(1, (w - 3.4) / 0.8) : 0 };
      break;
    }
    default: {
      const S = standing(p.x, p.y);
      let hl, hr;
      if (v.held === 'planted') { hl = nearestOnLadder(v.lad, S.neck[0], S.neck[1] - 0.1, 0.4, 1.6); hr = [S.hip[0] + face * 0.05, S.hip[1] - 0.25]; }
      else if (p.shoulder > 0.5) { hl = [S.neck[0] + face * 0.08, S.neck[1] + 0.12]; hr = [S.hip[0] - face * S.swing * 0.8, S.hip[1] - 0.3]; }
      else { hl = nearestOnLadder(v.lad, S.neck[0], S.neck[1] - 0.15, 0.6, 1.5); hr = [S.hip[0] - face * 0.03, S.hip[1] - 0.32]; }
      P = { ...S, hl, hr, face, kneeBend: face, peek: p.edge ? 1 : 0 };
      if (p.edge) { P.neck[0] += p.edge * 0.06; }
    }
  }
  P.face = P.face || face;
  if (P.kneeBend == null) P.kneeBend = P.face;
  if (!P.head) {
    const dx = P.neck[0] - P.hip[0], dy = P.neck[1] - P.hip[1], l = Math.hypot(dx, dy) || 1;
    P.head = [P.neck[0] + dx / l * NECK + P.face * 0.02, P.neck[1] + dy / l * NECK];
  }
  return P;
}
function nearestOnLadder(lad, x, y, s0 = 0, s1 = LADDER.L) {
  const c = Math.cos(lad.a), s = Math.sin(lad.a);
  const u = clamp((x - lad.fx) * c + (y - lad.fy) * s, s0, s1);
  return [lad.fx + c * u, lad.fy + s * u];
}

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
      const P = pose(v);
      const climbing = v.mode === 'climb';
      if (!climbing && v.mode !== 'fall') this.drawLadder(ctx, v.lad, v);
      if (v.mode === 'fall') { this.drawLadder(ctx, v.lad, v); }
      if (climbing) this.drawLadder(ctx, v.lad, v);
      this.drawPainter(ctx, P, v);
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
    if (Math.abs(x - this.cam.x) > this.w / this.k || Math.abs(y - this.cam.y) > this.h / this.k) return;
    const w = v && v.mode === 'win' ? v.anim.t : (v && v.won ? 99 : -1), f = 1;
    const bob = Math.sin(t * 1.3) * 0.01;
    const hip = [x, y + 0.8 + bob], neck = [x + 0.03, y + 1.3 + bob];
    let hl = [x + 0.22, y + 0.72], hr = [x - 0.18, y + 0.85], brush = -1.2, wet = false, canAt = null, look = 0.3 + 0.3 * Math.max(0, Math.sin(t * 0.37)), mood = null;
    if (w >= 2.0) { canAt = [x - 0.25, y + 0.62]; hr = [x - 0.22, y + 0.7]; }
    if (w >= 2.6 && w < 3.2) { hl = [x - 0.15, y + 0.72]; brush = -1.9; wet = true; }
    if (w >= 3.2) {
      // the brush goes up at the sky and sweeps across it
      const k = clamp((w - 3.2) / 3.0, 0, 1), sweep = Math.sin(k * Math.PI) * 0.5;
      hl = [x + 0.3 + sweep * 0.3, y + 1.85 + Math.sin(k * 9) * 0.05]; brush = 0.9 - sweep; wet = true; look = 1; mood = k > 0.9 ? 'happy' : null;
    }
    if (w > 6.5) { hl = [x + 0.25, y + 0.75]; brush = -1.2; mood = 'happy'; }
    const P = { hip, neck, fl: [x - 0.09, y], fr: [x + 0.09, y], hl, hr, face: f, kneeBend: f, brush, wet, canAt, look, mood, noCan: !canAt };
    P.head = [neck[0] + 0.02, neck[1] + 0.17];
    this.drawPainter(ctx, P, { t: t + 3, mode: 'npc', strain: 0 }, OLD);
    // the stroke across the sky, as it goes
    this.stroke = w >= 3.4 ? clamp((w - 3.4) / 2.6, 0, 1) : (v && v.won ? 1 : 0);
  }
  drawStroke(ctx) {
    // one broad, loaded brushstroke of blue across the faded sky, a little dry where it runs out
    const k = this.stroke || 0; if (k <= 0) return;
    const w = this.w, h = this.h, x0 = w * 0.05, len = w * 0.9, y0 = h * 0.22, bw = Math.min(w, h) * 0.11;
    const yAt = u => y0 - Math.sin(u * Math.PI) * h * 0.05 + u * h * 0.03, R = rng(91);
    ctx.save(); ctx.lineCap = 'round';
    const n = 26;
    for (let i = 0; i < n; i++) {
      const o = (i / (n - 1) - 0.5) * bw, dry = 0.55 + R() * 0.45, end = Math.min(k, dry + (1 - dry) * k), tone = R();
      ctx.strokeStyle = `rgba(${40 + tone * 40 | 0},${104 + tone * 50 | 0},${200 + tone * 30 | 0},${0.35 + R() * 0.4})`;
      ctx.lineWidth = bw / n * (1.6 + R() * 1.4);
      ctx.beginPath();
      for (let u = 0; u <= end; u += 0.01) { const x = x0 + u * len, y = yAt(u) + o * (1 - 0.25 * Math.sin(u * Math.PI)) + Math.sin(u * 13 + i) * 1.2; if (u === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
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
    this.drawStroke(ctx);
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
  drawPainter(ctx, P, v, pal = ME) {
    const f = P.face, t = v.t, SUIT = pal.suit, SKIN = pal.skin, CAP = pal.cap;
    const limb = (ax, ay, bx, by, cx, cy, w, col) => {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = rgba(INK, 0.85); ctx.lineWidth = w + 0.035; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.strokeStyle = rgba(col); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.stroke();
    };
    const hip = P.hip, neck = P.neck, head = P.head;
    // legs (far leg first, a touch darker)
    const legs = [[P.fr, 0.94], [P.fl, 1]];
    for (const [ft, sh] of legs) {
      const [kx, ky, ex, ey] = ik(hip[0], hip[1], ft[0], ft[1], LEG1, LEG2, P.kneeBend * (P.lying ? 1 : 1) > 0 ? 1 : -1);
      limb(hip[0], hip[1], kx, ky, ex, ey, 0.13, shade(SUIT, sh < 1 ? -0.08 : 0));
      ctx.fillStyle = rgba(BOOT); ctx.beginPath(); ctx.ellipse(ex + f * 0.04, ey + 0.03, 0.09, 0.05, 0, 0, TAU); ctx.fill();
    }
    // far arm
    const shoulder = [lerp(hip[0], neck[0], 0.9), lerp(hip[1], neck[1], 0.9)];
    const arm = (hand, sh) => {
      const [ex, ey, hx, hy] = ik(shoulder[0], shoulder[1], hand[0], hand[1], ARM1, ARM2, -P.kneeBend > 0 ? 1 : -1);
      limb(shoulder[0], shoulder[1], ex, ey, hx, hy, 0.1, shade(SUIT, sh));
      ctx.fillStyle = rgba(SKIN); ctx.beginPath(); ctx.arc(hx, hy, 0.05, 0, TAU); ctx.fill();
    };
    arm(P.hr, -0.1);
    // body: overalls with a bib and a few old paint spots
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(INK, 0.85); ctx.lineWidth = 0.33; ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(neck[0], neck[1]); ctx.stroke();
    ctx.strokeStyle = rgba(SUIT); ctx.lineWidth = 0.29; ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(neck[0], neck[1]); ctx.stroke();
    const mx = lerp(hip[0], neck[0], 0.55), my = lerp(hip[1], neck[1], 0.55);
    ctx.fillStyle = rgba(fade('#3a7ad0', 0.3), 0.8); ctx.beginPath(); ctx.arc(mx + f * 0.05, my - 0.05, 0.035, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(fade('#e05a3a', 0.3), 0.7); ctx.beginPath(); ctx.arc(mx - f * 0.06, my + 0.08, 0.025, 0, TAU); ctx.fill();
    // the paint can on the hip (or held up at the top)
    if (!P.noCan) this.drawCan(ctx, P, v);
    // head
    ctx.fillStyle = rgba(INK, 0.85); ctx.beginPath(); ctx.arc(head[0], head[1], HEAD + 0.018, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(SKIN); ctx.beginPath(); ctx.arc(head[0], head[1], HEAD, 0, TAU); ctx.fill();
    // which way the head turns: the body's up, tipped toward where they look
    const ux = (neck[0] - hip[0]), uy = (neck[1] - hip[1]), ul = Math.hypot(ux, uy) || 1;
    let upx = ux / ul, upy = uy / ul;
    if (P.look) { upx = lerp(upx, -f * 0.25, P.look * 0.6); upy = lerp(upy, 1, P.look * 0.6); }
    if (P.peek) { upx += f * 0.25; upy -= 0.35; }
    const fx = upy * f, fy = -upx * f;   // the direction the face points
    const blink = (Math.sin(t * 0.9) > 0.985) || P.mood === 'dazed' && Math.sin(t * 2) > 0.3;
    const ex = head[0] + fx * 0.075 + upx * 0.02, ey = head[1] + fy * 0.075 + upy * 0.02;
    ctx.fillStyle = 'rgb(48,34,34)';
    if (blink) { ctx.fillRect(ex - 0.018, ey - 0.004, 0.036, 0.008); }
    else { ctx.beginPath(); ctx.arc(ex, ey, 0.016, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(ex - fx * 0.05, ey - fy * 0.05, 0.014, 0, TAU); ctx.fill(); }
    // nose and mouth
    ctx.fillStyle = rgba(shade(SKIN, -0.12)); ctx.beginPath(); ctx.arc(head[0] + fx * 0.125 - upx * 0.01, head[1] + fy * 0.125 - upy * 0.01, 0.025, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(80,44,40,0.8)'; ctx.lineWidth = 0.012; ctx.beginPath();
    const mxx = head[0] + fx * 0.07 - upx * 0.06, myy = head[1] + fy * 0.07 - upy * 0.06;
    if (P.mood === 'sad' || P.mood === 'dazed') ctx.arc(mxx - upx * 0.02, myy - upy * 0.02, 0.025, Math.atan2(upy, upx) - 0.9, Math.atan2(upy, upx) + 0.9);
    else if (P.mood === 'happy') ctx.arc(mxx + upx * 0.015, myy + upy * 0.015, 0.03, Math.atan2(-upy, -upx) - 1, Math.atan2(-upy, -upx) + 1);
    else { ctx.moveTo(mxx - fx * 0.012, myy - fy * 0.012); ctx.lineTo(mxx + fx * 0.012, myy + fy * 0.012); }
    ctx.stroke();
    if (pal.hair) {
      // grey hair round the back of the head, and a beard
      const ang = Math.atan2(upy, upx);
      ctx.fillStyle = rgba(pal.hair); ctx.beginPath(); ctx.arc(head[0] - fx * 0.02, head[1] - fy * 0.02 + upy * 0.01, HEAD + 0.02, ang + 0.3, ang + Math.PI * 0.95); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(head[0] + fx * 0.05 - upx * 0.07, head[1] + fy * 0.05 - upy * 0.07, 0.075, 0, TAU); ctx.fill();
    }
    // cap: a crown over the top of the head, brim out the front
    if (CAP && !v.capOff) {
      ctx.fillStyle = rgba(CAP); ctx.strokeStyle = rgba(INK, 0.8); ctx.lineWidth = 0.018;
      const ang = Math.atan2(upy, upx);
      ctx.beginPath(); ctx.arc(head[0] + upx * 0.015, head[1] + upy * 0.015, HEAD + 0.012, ang - 1.45, ang + 1.45); ctx.closePath(); ctx.fill(); ctx.stroke();
      const bx = head[0] + upx * 0.06 + fx * 0.11, by = head[1] + upy * 0.06 + fy * 0.11;
      ctx.lineWidth = 0.04; ctx.strokeStyle = rgba(shade(CAP, -0.2)); ctx.beginPath(); ctx.moveTo(head[0] + upx * 0.07 + fx * 0.02, head[1] + upy * 0.07 + fy * 0.02); ctx.lineTo(bx + fx * 0.06, by + fy * 0.06 - upy * 0.0); ctx.stroke();
    }
    // near arm, over everything, with a brush if they're holding one
    arm(P.hl, 0);
    if (P.brush) {
      const [bx, by] = P.hl, a = P.brush;
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgb(150,106,70)'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(bx - Math.cos(a) * 0.08, by - Math.sin(a) * 0.08); ctx.lineTo(bx + Math.cos(a) * 0.22, by + Math.sin(a) * 0.22); ctx.stroke();
      ctx.strokeStyle = P.wet ? 'rgb(52,118,212)' : 'rgb(214,196,160)'; ctx.lineWidth = 0.055; ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * 0.22, by + Math.sin(a) * 0.22); ctx.lineTo(bx + Math.cos(a) * 0.33, by + Math.sin(a) * 0.33); ctx.stroke();
    }
    // a bead of sweat when the ladder strains
    if (v.strain > 0.8 && v.mode === 'climb') { const a = (t * 1.5) % 1; ctx.fillStyle = `rgba(170,210,235,${1 - a})`; ctx.beginPath(); ctx.arc(head[0] - fx * 0.13, head[1] + 0.05 - a * 0.25, 0.022, 0, TAU); ctx.fill(); }
  }
  drawCan(ctx, P, v) {
    let x, y;
    if (P.canAt) { x = P.canAt[0]; y = P.canAt[1] - 0.12; }
    else if (P.canUp) { x = P.hl[0]; y = P.hl[1] + 0.12; }
    else {
      const hx = lerp(P.hip[0], P.neck[0], 0.12) - P.face * 0.14, hy = lerp(P.hip[1], P.neck[1], 0.12);
      const sw = Math.sin(v.t * 3.1) * 0.02 + (v.mode === 'fall' ? Math.sin(v.t * 11) * 0.12 : 0);
      x = hx + sw; y = hy - 0.18;
      ctx.strokeStyle = 'rgba(90,86,84,0.9)'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(x - 0.07, y + 0.1); ctx.moveTo(hx, hy); ctx.lineTo(x + 0.07, y + 0.1); ctx.stroke();
    }
    ctx.fillStyle = rgba(INK, 0.8); ctx.fillRect(x - 0.085, y - 0.1, 0.17, 0.19);
    ctx.fillStyle = 'rgb(200,198,192)'; ctx.fillRect(x - 0.07, y - 0.085, 0.14, 0.16);
    ctx.fillStyle = rgba(fade('#2f6fd0', 0.1)); ctx.fillRect(x - 0.07, y - 0.04, 0.14, 0.07);
    ctx.fillRect(x + 0.02, y + 0.03, 0.025, 0.045);
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
