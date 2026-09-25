/* Glowmoss Hollow · shared engine.
   Math, noise and sprite helpers, plus makeEnv(): one 320×240 pixel canvas per place with its own lights,
   particles and light rings, and composite(), which paints a finished place onto the world canvas. */
'use strict';
const W = 320, H = 240;
const SCENES = {};
// how the places connect: each one's way in (the edge it shares with the place before it, and where along that edge)
const WAYS = { wood: ['left', 111], peaks: ['bottom', 206], barrens: ['right', 140], grove: ['right', 170], dunes: ['top', 96], deep: ['top', 230], reef: ['left', 150], bayou: ['left', 200] };
// the rope bridge between Duskcrag Peaks and Aurora Barrens hangs across their shared edge; x is in world pixels
const BRIDGE = { x0: 2 * W - 34, x1: 2 * W + 40, y: WAYS.barrens[1], sag: 8 };
const bridgeY = xw => BRIDGE.y + BRIDGE.sag * (1 - ((xw - (BRIDGE.x0 + BRIDGE.x1) / 2) / ((BRIDGE.x1 - BRIDGE.x0) / 2)) ** 2);
// a smooth heightline through [x, y] points
function profile(pts) {
  const Y = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    let i = 0; while (i < pts.length - 2 && pts[i + 1][0] <= x) i++;
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    Y[x] = x1 === x0 ? y1 : lerp(y0, y1, smooth(clamp((x - x0) / (x1 - x0), 0, 1)));
  }
  return Y;
}

/* ---------- math + noise ---------- */
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const R = Math.random, rr = (a, b) => a + R() * (b - a), pick = a => a[R() * a.length | 0];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;
const hop = k => Math.sin(Math.PI * clamp(k, 0, 1));
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), u = smooth(x - xi), v = smooth(y - yi);
  return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v);
}
function fbm(x, y) { let s = 0, a = .5, f = 1; for (let i = 0; i < 4; i++) { s += a * vn(x * f, y * f); f *= 2; a *= .5; } return s / .9375; }
function seeded(s) {
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const HEX = {};
const rgb = h => HEX[h] || (HEX[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); t = clamp(t, 0, 1); return `rgb(${A[0] + (B[0] - A[0]) * t | 0},${A[1] + (B[1] - A[1]) * t | 0},${A[2] + (B[2] - A[2]) * t | 0})`; };
const BAY = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const bay = (x, y) => BAY[(y & 3) * 4 + (x & 3)] / 16;
// pick a color from a dark→light ramp with ordered dithering between steps
const band = (pal, v, x, y) => pal[clamp(Math.floor(v * pal.length + bay(x, y) - .5), 0, pal.length - 1)];

/* ---------- sprites + paths ---------- */
function spr(rows, pal) {
  const h = rows.length, w = rows[0].length, c = mk(w, h), x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = rows[j][i]; if (k !== '.' && pal[k]) { x.fillStyle = pal[k]; x.fillRect(i, j, 1, 1); } }
  return c;
}
// a sprite plus variants: fn edits a copy of the rows (array of char arrays)
function sprv(rows, pal, fn) { const r = rows.map(s => s.split('')); if (fn) fn(r); return spr(r.map(a => a.join('')), pal); }
const cr = (a, b, c, d, t) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
function pathAt(P, u) {
  const n = P.length - 1, f = clamp(u, 0, 1) * n, i = Math.min(n - 1, Math.floor(f)), t = f - i, Q = k => P[clamp(k, 0, n)];
  return { x: cr(Q(i - 1).x, Q(i).x, Q(i + 1).x, Q(i + 2).x, t), y: cr(Q(i - 1).y, Q(i).y, Q(i + 1).y, Q(i + 2).y, t) };
}

/* ---------- static painting ---------- */
// fn(x, y) → '#rrggbb' (or falsy for transparent); returns a W×H canvas
function paint(fn, into) {
  const c = into || mk(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), D = img.data;
  for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) {
    const h = fn(i, y); if (!h) continue;
    const k = (y * W + i) * 4, v = rgb(h); D[k] = v[0]; D[k + 1] = v[1]; D[k + 2] = v[2]; D[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); return c;
}
// solid mask + queries over it
function terrain(fn) {
  const m = new Uint8Array(W * H);
  const T = { m,
    fill(f) { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = f(x, y) ? 1 : 0; },
    at: (x, y) => { x = Math.round(x); y = Math.round(y); return x >= 0 && x < W && y >= 0 && y < H && m[y * W + x] === 1; },
    ground(x, y0 = 0) { x = clamp(Math.round(x), 0, W - 1); for (let y = Math.max(0, y0 | 0); y < H; y++) if (m[y * W + x]) return y; return H; },
    open: (x, y) => x < 0 || x >= W || y < 0 || y >= H || !m[y * W + x]
  };
  if (fn) T.fill(fn);
  return T;
}
const starAt = (x, y, dens = .9975) => { const h = hash(x * 1.31 + 7, y * .77 + 3); return h > dens ? (h > 1 - (1 - dens) * .3 ? 2 : 1) : 0; };

/* ---------- light ---------- */
const GT = {};
function glowTex(c) {
  if (GT[c]) return GT[c];
  const t = mk(128, 128), x = t.getContext('2d'), [r, gg, b] = rgb(c), s = a => `rgba(${r},${gg},${b},${a})`;
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, s(1)); gr.addColorStop(.1, s(.75)); gr.addColorStop(.3, s(.3)); gr.addColorStop(.6, s(.08)); gr.addColorStop(1, s(0));
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return (GT[c] = t);
}

/* ---------- one place: its own pixel canvas, lights, particles ---------- */
function makeEnv(seed) {
  const px = mk(W, H), p = px.getContext('2d');
  p.imageSmoothingEnabled = false;
  const srnd = seeded(seed);
  const E = { px, p, srnd, sr: (a, b) => a + srnd() * (b - a), lights: [], wlights: [], parts: [], rings: [], hot: 0,
    isSolid: () => false, isWet: () => false, drip: null, say: () => {} };
  E.light = (x, y, r, c, a) => { if (a > .01) E.lights.push({ x, y, r, c, a }); };
  E.wlight = (x, y, r, c, a) => { if (a > .01) E.wlights.push({ x, y, r, c, a }); };
  E.ring = (x, y, max, c, life) => E.rings.push({ x, y, max, c, life, t: 0 });
  E.spawn = o => { const q = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, ay: 0, drag: 0, life: 1, t: 0, col: '#ffffff', glow: 0, ga: .4, wob: 0, ph: R() * TAU, a: 1, kind: 0, fin: .2, fout: .5 }, o); E.parts.push(q); return q; };
  E.splash = (x, y, n, col = '#a8e8ff', gc = '#6fd0ff') => { for (let i = 0; i < n; i++) E.spawn({ x: x + rr(-1, 1), y, vx: rr(-30, 30), vy: rr(-75, -30), ay: 260, life: rr(.5, .9), col, glow: 2, gc, ga: .35, kind: 2, fin: .01, fout: .15 }); };
  E.sparkle = (x, y, n, col, gc) => { for (let i = 0; i < n; i++) { const a = rr(0, TAU), s = rr(8, 26); E.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 3, life: rr(.4, .9), col, gc, glow: 3, ga: .5, fin: .01, fout: .4 }); } };
  // bits of rock/earth/ice that tumble and vanish where they land
  E.rubble = (x, y, n, cols, spread = 4) => { for (let i = 0; i < n; i++) E.spawn({ x: x + rr(-spread, spread), y: y + rr(-spread, spread), vx: rr(-40, 40), vy: rr(-60, -10), ay: 280, life: rr(.8, 1.6), col: pick(cols), kind: 2, fin: .01, fout: .2 }); };
  E.step = dt => {
    const P = E.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i]; q.t += dt; if (q.t >= q.life) { P.splice(i, 1); continue; }
      q.vy += q.ay * dt; if (q.drag) { const k = Math.exp(-q.drag * dt); q.vx *= k; q.vy *= k; }
      q.x += (q.vx + (q.wob ? Math.sin(q.t * 1.7 + q.ph) * q.wob : 0)) * dt; q.y += q.vy * dt;
      if (q.kind === 1) { if (E.drip && E.drip(q)) P.splice(i, 1); }
      else if (q.kind === 2) { if (q.vy > 0 && (E.isWet(q.x, q.y) || E.isSolid(q.x, q.y))) P.splice(i, 1); }
      else if (q.kind === 3) { if (E.isSolid(q.x, q.y)) P.splice(i, 1); }
    }
    for (let i = E.rings.length - 1; i >= 0; i--) { const r = E.rings[i]; r.t += dt; if (r.t > r.life) E.rings.splice(i, 1); }
  };
  E.drawParts = () => {
    for (const q of E.parts) {
      const f = Math.min(1, q.t / q.fin, (q.life - q.t) / q.fout) * q.a; if (f <= 0) continue;
      p.globalAlpha = f; p.fillStyle = q.col; p.fillRect(Math.round(q.x), Math.round(q.y), q.w || 1, q.h || 1);
      if (q.glow) E.light(q.x + .5, q.y + .5, q.glow, q.gc || q.col, q.ga * f);
    }
    p.globalAlpha = 1;
  };
  E.dot = (x, y, c) => { p.fillStyle = c; p.fillRect(Math.round(x), Math.round(y), 1, 1); };
  E.rect = (x, y, w, h, c) => { p.fillStyle = c; p.fillRect(Math.round(x), Math.round(y), w, h); };
  E.blit = (s, x, y, flip) => {
    x = Math.round(x); y = Math.round(y);
    if (flip) { p.save(); p.translate(x + s.width, y); p.scale(-1, 1); p.drawImage(s, 0, 0); p.restore(); } else p.drawImage(s, x, y);
  };
  // draw a sprite rotated about its own centre (angles snap to 1/8 turns so pixels stay chunky)
  E.spin = (s, cx, cy, ang, flip) => {
    p.save(); p.translate(Math.round(cx), Math.round(cy)); if (flip) p.scale(-1, 1);
    p.rotate(Math.round(ang / (Math.PI / 4)) * (Math.PI / 4)); p.drawImage(s, -Math.floor(s.width / 2), -Math.floor(s.height / 2)); p.restore();
  };
  E.line = (x0, y0, x1, y1, c) => {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    p.fillStyle = c;
    for (;;) { p.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  };
  // a soft beam of light, drawn at display resolution (call from a scene's under())
  E.beam = (g, x0, y0, x1, y1, w0, w1, col, a) => {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, [r, gg, b] = rgb(col);
    const poly = (u0, u1, al) => {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, `rgba(${r},${gg},${b},${al * 1.6})`); gr.addColorStop(.55, `rgba(${r},${gg},${b},${al * .7})`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      g.fillStyle = gr; g.beginPath();
      g.moveTo(x0 + nx * u0, y0 + ny * u0); g.lineTo(x1 + nx * u1, y1 + ny * u1); g.lineTo(x1 - nx * u1, y1 - ny * u1); g.lineTo(x0 - nx * u0, y0 - ny * u0); g.closePath(); g.fill();
    };
    g.globalAlpha = 1; poly(w0 * 1.8, w1 * 1.5, a * .45); poly(w0, w1, a);
  };
  return E;
}

// small timers every critter uses: blink(o,'blink',2,6,.14) fires a flag for dur seconds every a–b seconds
function tick(o, k, a, b, dur, dt) {
  const T = k + 'T'; if (o[T] === undefined) o[T] = rr(a, b);
  o[T] -= dt; if (o[T] <= 0) { o[k] = dur; o[T] = rr(a, b); }
  o[k] = Math.max(0, (o[k] || 0) - dt); return o[k] > 0;
}

/* ---------- painting a place onto the world canvas ---------- */
// g is already transformed so one unit = one pixel of this place; k = device pixels per place pixel
const VIG = (() => {
  const c = mk(640, 480), v = c.getContext('2d');
  const gr = v.createRadialGradient(320, 250, 150, 320, 250, 430);
  gr.addColorStop(0, 'rgba(3,2,8,0)'); gr.addColorStop(1, 'rgba(3,2,8,.78)'); v.fillStyle = gr; v.fillRect(0, 0, 640, 480);
  const lg = v.createLinearGradient(0, 0, 0, 480);
  lg.addColorStop(0, 'rgba(2,1,6,.35)'); lg.addColorStop(.3, 'rgba(2,1,6,0)'); v.fillStyle = lg; v.fillRect(0, 0, 640, 480);
  return c;
})();
function vignette(edge = .6, top = .2, col = '3,2,8') {
  const c = mk(640, 480), v = c.getContext('2d');
  const gr = v.createRadialGradient(320, 250, 170, 320, 250, 440);
  gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(1, `rgba(${col},${edge})`); v.fillStyle = gr; v.fillRect(0, 0, 640, 480);
  if (top) { const lg = v.createLinearGradient(0, 0, 0, 480); lg.addColorStop(0, `rgba(${col},${top})`); lg.addColorStop(.3, `rgba(${col},0)`); v.fillStyle = lg; v.fillRect(0, 0, 640, 480); }
  return c;
}
function drawLight(g, L, y, m) {
  const r = L.r * 2; g.globalAlpha = Math.min(1, L.a * m); g.drawImage(glowTex(L.c), L.x - r, y - r, r * 2, r * 2);
}
function composite(g, S, t, k) {
  const E = S.E;
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.imageSmoothingEnabled = k < 1;
  g.drawImage(E.px, 0, 0);
  g.imageSmoothingEnabled = true; g.globalCompositeOperation = 'lighter';
  if (S.under) S.under(g, t);
  for (const L of E.lights) drawLight(g, L, L.y, 1);
  if (S.post) S.post(g, t);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.drawImage(S.vig || VIG, 0, 0, W, H);
  // rings go on top of the vignette so a ping at the edge of a place still reads
  g.globalCompositeOperation = 'lighter';
  for (const r of E.rings) {
    const q = r.t / r.life; g.strokeStyle = r.c; g.beginPath(); g.arc(r.x, r.y, Math.max(.05, q * r.max), 0, TAU);
    g.globalAlpha = (1 - q) * .5; g.lineWidth = 1; g.stroke(); g.globalAlpha = (1 - q) * .15; g.lineWidth = 4; g.stroke();
  }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
}

/* ---------- director: wakes one creature at a time, 5–8 s apart ---------- */
function makeDirector(S) {
  const d = { queue: [], last: null, wait: rr(1.5, 5), was: false };
  const busy = () => S.critters.some(c => c.busy);
  d.fire = (c, byHand) => { if (c.busy) return false; c.trigger(); d.last = c; S.E.say(c.caption, byHand); if (byHand) d.wait = Math.max(d.wait, 4); return true; };
  d.next = byHand => {
    for (let n = 0; n < 2; n++) {
      if (!d.queue.length) { d.queue = shuffle(S.critters.slice()); if (d.queue[0] === d.last) d.queue.push(d.queue.shift()); }
      while (d.queue.length) { const c = d.queue.shift(); if (!c.busy) return d.fire(c, byHand); }
    }
    return false;
  };
  d.update = dt => {
    if (busy()) { d.was = true; return; }
    if (d.was) { d.was = false; d.wait = rr(5, 8); S.E.say(null); }
    d.wait -= dt; if (d.wait <= 0) d.next(false);
  };
  d.poke = () => busy() ? false : d.next(true);
  return d;
}
// is (x, y) on this creature? boxes are [x, y, w, h] in place pixels
function critterAt(S, x, y, pad) {
  let best = null, bd = 1e9;
  for (const c of S.critters) {
    if (!c.box) continue; const b = c.box(); if (!b) continue;
    const dx = Math.max(b[0] - x, 0, x - (b[0] + b[2])), dy = Math.max(b[1] - y, 0, y - (b[1] + b[3])), d = Math.hypot(dx, dy);
    if (d <= pad && d < bd) { bd = d; best = c; }
  }
  return best;
}
