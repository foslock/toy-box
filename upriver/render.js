// Draws a moment of a trip, live or recorded, into whatever rectangle of the
// view the caller has mapped onto the canvas.
import { pathFrom, card, setShadow, setFlip, blob, strip, cut, glow, rng, clamp } from './paper.js';
import { SPECIES } from './creatures.js';
import { WORLD_H } from './routes.js';

const WATER_Z = { wood: 0.7, marsh: 0.7, caves: 0.8, night: 0.7 };
const HELD_BY_CREATURE = new Set(['reedotter', 'gloamer', 'stiltbill']);

function starsFor(trip) {
  if (trip._stars) return trip._stars;
  const r = rng(trip.seed + 99); const out = [];
  for (let i = 0; i < 160; i++) out.push([r() * 1600, r() * 380, 0.4 + r() * 1.1, r() * 6]);
  return (trip._stars = out);
}

function drawLayer(ctx, L, S, vx, vw) {
  const ox = S * L.p; const a = vx + ox - 30, b = vx + vw + ox + 30;
  ctx.save(); ctx.translate(-ox, 0);
  const vis = [];
  for (const s of L.shapes) if (s.x1 >= a && s.x0 <= b) { if (!s.path) s.path = pathFrom(s.pts); vis.push(s); }
  if (L.sh && !L.vellum) {
    ctx.translate(L.sh * 0.55, L.sh); ctx.fillStyle = SHADOW_C;
    for (const s of vis) if (!s.ripple) ctx.fill(s.path);
    ctx.translate(-L.sh * 0.55, -L.sh);
  }
  for (const s of vis) { ctx.fillStyle = s.c; ctx.fill(s.path); }
  for (const s of vis) if (s.glow) glow(ctx, (s.x0 + s.x1) / 2, s.pts[1], s.glow, s.c.length === 7 ? hexA(s.c, 0.5) : s.c);
  ctx.restore();
}
let SHADOW_C = 'rgba(0,0,0,.3)';
const hexA = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;

function drawFruit(ctx, x, y, s, bites, spin = 0) {
  const k = s * (1 - bites * 0.75);
  if (k <= 0.05) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.rotate(spin);
  card(ctx, blob(0, -7, 8, 7.5, 0, 31, 12, 0.05), '#d9483a', 1.6);
  ctx.fillStyle = '#f08a6a'; ctx.beginPath(); ctx.ellipse(-3, -10, 2.5, 1.6, -0.5, 0, 7); ctx.fill();
  card(ctx, strip([0, -14, 1, -19], 2, 1.4), '#5a3a1c', 0);
  card(ctx, blob(4, -18, 4.5, 2.2, -0.4, 32, 8, 0.1), '#5f8a34', 0);
  ctx.restore();
}

function drawFx(ctx, e, S, dark) {
  const X = e.x - S * e.p, a = clamp(1 - e.t / e.life, 0, 1), s = e.s || 1;
  ctx.save(); ctx.globalAlpha = a;
  if (e.type === 'note') {
    ctx.translate(X, e.y); ctx.scale(s * 1.2, s * 1.2); ctx.rotate(Math.sin(e.t * 3) * 0.2);
    card(ctx, blob(0, 0, 4.4, 3.4, -0.4, 5, 10, 0.05), dark ? '#f2e8c8' : '#2a2418', 1);
    ctx.fillStyle = dark ? '#f2e8c8' : '#2a2418'; ctx.fillRect(3, -14, 1.6, 14);
    ctx.fill(cut([3, -14, 10, -10, 9, -7, 4.6, -10], 3, 0.2, 20));
  } else if (e.type === 'z') {
    ctx.translate(X, e.y); ctx.scale(s * (1 + e.t * 0.3), s * (1 + e.t * 0.3));
    card(ctx, pathFrom([-5, -5, 5, -5, 5, -3, -1.5, 3, 5, 3, 5, 5, -5, 5, -5, 3, 1.5, -3, -5, -3]), '#f4f0e0', 1);
  } else if (e.type === 'ring') {
    ctx.strokeStyle = 'rgba(250,250,235,.8)'; ctx.lineWidth = 2;
    const r = 10 + e.t * 70; ctx.beginPath(); ctx.ellipse(X, e.y, r * s, r * s * 0.55, 0, 0, 7); ctx.stroke();
  } else if (e.type === 'splash') {
    ctx.fillStyle = dark ? 'rgba(190,210,240,.8)' : 'rgba(235,248,244,.9)';
    for (let i = 0; i < 6; i++) { const ang = -Math.PI / 2 + (i - 2.5) * 0.4, v = 40 + i * 6; const tt = e.t; ctx.beginPath(); ctx.arc(X + Math.cos(ang) * v * tt * s, e.y + (Math.sin(ang) * v * tt + 90 * tt * tt) * s, 2.4 * s, 0, 7); ctx.fill(); }
  } else if (e.type === 'fish') {
    const u = clamp(e.t / 1.2, 0, 1); ctx.translate(X + u * 40 * s, e.y - Math.sin(u * Math.PI) * 40 * s); ctx.scale(s, s); ctx.rotate(-1 + u * 2);
    card(ctx, cut([-9, 0, 0, -4, 8, 0, 0, 4], 1, 0.3, 20), '#c8d4dc', 1); ctx.fill(cut([-9, 0, -14, -4, -14, 4], 2, 0.2, 20));
  } else if (e.type === 'call') {
    ctx.strokeStyle = 'rgba(255,250,230,.9)'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) { const r = 14 + e.t * 90 + i * 16; ctx.beginPath(); ctx.arc(X, e.y, r, -2.3, -0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(X, e.y, r, 0.8, 2.3); ctx.stroke(); }
  }
  ctx.restore();
}

// state: { S, t, cr, fr, bu, fx }   view: visible screen-world rect
export function drawScene(ctx, trip, state, view) {
  const R = trip.route, S = state.S;
  setShadow(R.shadow); SHADOW_C = R.shadow;
  const { x: vx, w: vw } = view;
  // sky / cave dark
  const g = ctx.createLinearGradient(0, 0, 0, R.water.y);
  g.addColorStop(0, R.sky[0]); g.addColorStop(0.55, R.sky[1]); g.addColorStop(1, R.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(vx - 2, -2, vw + 4, WORLD_H + 4);
  const VW = trip.VW;
  if (R.key === 'night') {
    for (const [x, y, r, ph] of starsFor(trip)) {
      if (x > VW) continue;
      const tw = 0.6 + 0.4 * Math.sin(state.t * 2 + ph);
      ctx.fillStyle = `rgba(255,250,230,${0.8 * tw})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
  }
  const orb = R.sun || R.moon;
  if (orb) {
    const ox = orb.x * VW;
    glow(ctx, ox, orb.y, orb.r * 3.2, R.moon ? 'rgba(245,237,210,.35)' : 'rgba(255,250,230,.6)');
    card(ctx, blob(ox, orb.y, orb.r, orb.r, 0, 3, 28, 0.015), orb.c, 0);
    if (R.moon) { ctx.fillStyle = 'rgba(200,190,160,.35)'; for (const [dx, dy, rr] of [[-10, -8, 7], [8, 6, 5], [12, -12, 3.5]]) { ctx.beginPath(); ctx.arc(ox + dx, orb.y + dy, rr, 0, 7); ctx.fill(); } }
  }
  // everything with depth, back to front
  const items = [];
  for (const L of trip.layers) items.push({ z: L.z, L });
  items.push({ z: WATER_Z[R.key], water: true });
  for (const c of state.cr) items.push({ z: c.p + 0.0005, c });
  for (const f of state.fr) if (f.state !== 'air') items.push({ z: f.p + 0.0008, f });
  for (const e of state.fx) if (e.p > 0) items.push({ z: e.p + 0.0009, e });
  items.sort((a, b) => a.z - b.z);
  const dark = !!R.dark;
  for (const it of items) {
    if (it.L) drawLayer(ctx, it.L, S, vx, vw);
    else if (it.water) {
      const wg = ctx.createLinearGradient(0, R.water.y, 0, WORLD_H);
      wg.addColorStop(0, R.water.top); wg.addColorStop(1, R.water.bot);
      ctx.fillStyle = wg; ctx.fillRect(vx - 2, R.water.y, vw + 4, WORLD_H - R.water.y + 4);
      if (orb) { // broken reflection of the sun or moon
        const ox = orb.x * VW; ctx.fillStyle = R.moon ? 'rgba(245,237,210,.45)' : 'rgba(255,250,232,.4)';
        for (let i = 0; i < 7; i++) { const y = R.water.y + 8 + i * 13, w2 = orb.r * (1.2 - i * 0.1) + Math.sin(state.t * 1.5 + i) * 5; ctx.fillRect(ox - w2 + Math.sin(state.t + i * 2) * 4, y, w2 * 2, 3); }
      }
    } else if (it.c) {
      const c = it.c; const sp = SPECIES[c.sp]; const X = c.x - S * c.p;
      if (X < vx - 220 || X > vx + vw + 220) continue;
      ctx.save(); ctx.translate(X, c.y); ctx.scale(c.p * c.face, c.p); setFlip(c.face);
      sp.draw(ctx, c);
      ctx.restore(); setFlip(1);
    } else if (it.f) {
      const f = it.f; if (f.state === 'held' && HELD_BY_CREATURE.has(f.ownerSp)) continue;
      const bob = f.state === 'float' ? Math.sin(state.t * 2 + f.id) * 1.5 : 0;
      drawFruit(ctx, f.x - S * f.p, f.y + bob, f.p, f.bites || 0);
    } else if (it.e) drawFx(ctx, it.e, S, dark);
  }
  if (trip.fg) drawLayer(ctx, trip.fg, S, vx, vw);
  // things in the air near the boat
  for (const f of state.fr) if (f.state === 'air') drawFruit(ctx, f.sx, f.sy, 1.5 - Math.min(1, f.t / 0.8) * 0.7, 0, f.t * 8);
  for (const b of state.bu) {
    const a = clamp(Math.min(b.t * 3, (b.life - b.t) * 2), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = dark ? 'rgba(200,230,255,.12)' : 'rgba(255,255,255,.16)';
    ctx.strokeStyle = dark ? 'rgba(210,240,255,.7)' : 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(b.x - b.r * 0.4, b.y - b.r * 0.4, b.r * 0.25, b.r * 0.15, -0.7, 0, 7); ctx.fill();
    ctx.restore();
  }
  for (const e of state.fx) if (e.p === 0) drawFx(ctx, e, 0, dark);
}

// a species on its own, for the field guide
export function drawSpecimen(ctx, spKey, W, H, silhouette) {
  const sp = SPECIES[spKey];
  const c = { id: 3, sp: spKey, x: 0, y: 0, p: 1, face: 1, beh: sp.beh[0].k, bt: 1.2, dur: 4, ph: 0, t: 2.3, moving: 0, k: { out: 1, face0: 1 }, tgt: null };
  if (spKey === 'ferngrazer') c.beh = null;
  const b = sp.box(c) || [-40, -80, 40, 0];
  const bw = b[2] - b[0], bh = b[3] - b[1];
  const s = Math.min(W * 0.8 / bw, H * 0.78 / bh);
  ctx.save();
  ctx.translate(W / 2 - (b[0] + bw / 2) * s, H * 0.5 - (b[1] + bh / 2) * s);
  ctx.scale(s, s);
  setShadow(silhouette ? 'rgba(0,0,0,0)' : 'rgba(40,30,20,.25)');
  sp.draw(ctx, c);
  ctx.restore();
  if (silhouette) { ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = '#3a3226'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}
