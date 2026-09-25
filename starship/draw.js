// Draws everything that moves, at one pixel per ship pixel, on top of the painted ship: the animated
// widgets in each room, lift cars, doors, fighters, engine flames, the crew doing whatever they're doing,
// and little particles (sparks, steam, zzz, music notes, laser bolts, speech bubbles). Also collects the
// lights for the glow pass.
import { crewSprite, CAT, DROID } from './sprites.js';
import { floorY, deckTop, CEIL } from './ship.js';
import { TAU, clamp, hash, shade } from './util.js';

const R_ = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const PX = (g, x, y, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
const rnd = Math.random;

/* ---------- visual particles ---------- */
export const vfx = [];
let clock = 0;
const spawn = o => { vfx.push(Object.assign({ vx: 0, vy: 0, ay: 0, t: 0, life: 1, c: '#fff', glow: 0 }, o)); };
export function stepVfx(dt) {
  for (let i = vfx.length - 1; i >= 0; i--) {
    const p = vfx[i]; p.t += dt;
    if (p.t >= p.life) { vfx.splice(i, 1); if (p.done) p.done(p); continue; }
    p.vy += p.ay * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
  if (vfx.length > 1500) vfx.splice(0, vfx.length - 1500);
}
const sparks = (x, y, n, c = '#ffd86a') => { for (let i = 0; i < n; i++) spawn({ x, y, vx: (rnd() - .5) * 50, vy: -rnd() * 40, ay: 120, life: .3 + rnd() * .4, c: rnd() < .5 ? c : '#fff7d0', glow: 4 }); };
const steam = (x, y) => spawn({ x: x + (rnd() - .5) * 2, y, vx: (rnd() - .5) * 3, vy: -6 - rnd() * 4, life: 1.2 + rnd(), c: '#dfe6ee', fade: true, grow: true });
const GLYPH = { z: ['##.', '.#.', '.##'], n: ['.##', '.#.', '##.'], h: ['#.#', '###', '.#.'], q: ['##.', '.#.', '.#.'], x: ['#.#', '.#.', '#.#'], d: ['...', '...', '#.#'], s: ['.#.', '###', '.#.'] };
const glyph = (x, y, k, c, life = 1.6, vy = -5) => spawn({ x, y, vx: (rnd() - .5) * 2, vy, life, c, glyph: k, fade: true });
const bubble = (x, y, k) => spawn({ x, y, life: 1.6, c: '#ffffff', bubble: k, vy: -1 });
const bolt = (x0, y, x1, c, onHit) => spawn({ x: x0, y, vx: 260, life: Math.max(.02, (x1 - x0) / 260), c, bolt: true, glow: 6, done: onHit });

/* ---------- screens ---------- */
function screen(g, w, t, L) {
  const { x, y, h, col } = w, W = w.w, tick = Math.floor(t * 4 + (w.x * 7 % 13));
  R_(g, x, y, W, h, '#081018');
  const dim = shade(col, -.45);
  switch (w.style) {
    case 'nav': for (let i = 0; i < W; i++) if ((i + tick) % 4 === 0) PX(g, x + i, y + (i % h), col); PX(g, x + (tick % W), y, '#ffffff'); break;
    case 'radar': case 'aim': { for (let i = 0; i < W; i++) PX(g, x + i, y + Math.floor(h / 2), dim); const bx = x + (tick * 3 % W), by = y + (tick % h); PX(g, bx, by, col); if (w.style === 'aim') { PX(g, x + (W >> 1), y + (h >> 1), col); PX(g, x + (W >> 1) - 1, y + (h >> 1), col); PX(g, x + (W >> 1) + 1, y + (h >> 1), col); } break; }
    case 'graph': for (let i = 0; i < W; i++) PX(g, x + i, y + h - 1 - Math.floor((Math.sin((i + t * 6) * .9) * .5 + .5) * (h - 1) + .5), col); break;
    case 'wave': for (let i = 0; i < W; i++) PX(g, x + i, y + Math.round((h - 1) / 2 + Math.sin(i * 1.3 + t * 9) * (h - 1) / 2), col); break;
    case 'text': for (let j = 0; j < h; j++) for (let i = 0; i < W; i++) if (hash(i + tick * 3, j + (tick >> 2)) > .55) PX(g, x + i, y + j, j === h - 1 && tick % 2 ? dim : col); break;
    case 'map': { for (let i = 0; i < 12; i++) PX(g, x + (hash(i, 3) * W | 0), y + (hash(i, 7) * h | 0), dim); const mx = x + ((t * 3) % W | 0); PX(g, mx, y + (h >> 1), col); PX(g, mx - 1, y + (h >> 1), dim); break; }
    case 'tv': { const k = Math.floor(t / 1.3); for (let j = 0; j < h; j++) for (let i = 0; i < W; i++) PX(g, x + i, y + j, ['#ff7ab8', '#7ab8ff', '#ffd27a', '#7affb0', '#c07aff'][Math.floor(hash(i >> 2, j >> 1 + k) * 5 + k) % 5]); break; }
    case 'game': { for (let i = 0; i < 4; i++) PX(g, x + ((hash(i, 1) * W + t * (2 + i)) % W | 0), y + (hash(i, 2) * h | 0), '#e8e8e8'); PX(g, x + (W >> 1), y + h - 1, col); break; }
    case 'cam': { for (let j = 0; j < h; j++) for (let i = 0; i < W; i++) PX(g, x + i, y + j, hash(i + tick, j) > .8 ? dim : '#0c1a10'); const fx = x + ((t * 1.5 + w.x) % W | 0); PX(g, fx, y + h - 2, col); PX(g, fx, y + h - 1, col); break; }
    case 'dna': for (let i = 0; i < W; i++) { const a = Math.sin(i * .9 + t * 3); PX(g, x + i, y + Math.round((a * .5 + .5) * (h - 1)), col); PX(g, x + i, y + Math.round((-a * .5 + .5) * (h - 1)), '#ff7ab8'); } break;
  }
  L.push({ x: x + W / 2, y: y + h / 2, r: Math.max(4, W * .7), c: col, a: .22 });
}

/* ---------- widgets ---------- */
function widget(g, w, t, sim, L) {
  const r = w.room;
  switch (w.kind) {
    case 'screen': return screen(g, w, t, L);
    case 'blink': { const on = (Math.floor(t * 1.7 + w.x * .37) % 3) !== 0; if (on) { PX(g, w.x, w.y, w.c); L.push({ x: w.x + .5, y: w.y + .5, r: 3, c: w.c, a: .25 }); } else PX(g, w.x, w.y, shade(w.c, -.6)); return; }
    case 'liftlamp': { const lift = sim.liftOf(r.shaft || null), here = lift && Math.abs(lift.y - floorY(r.d1)) < 1; const c = here && lift.state === 'doors' ? '#5aff7a' : lift && lift.state === 'move' && lift.target === r.d1 ? '#ffc84a' : '#3a2a2a'; R_(g, w.x, w.y, 3, 1, c); if (c !== '#3a2a2a') L.push({ x: w.x + 1.5, y: w.y, r: 4, c, a: .35 }); return; }
    case 'core': {
      const { x, y, h } = w, W = w.w, k = sim.warp.k;
      for (let j = 0; j < h; j++) {
        const v = .55 + .45 * Math.sin((j * .35) + t * (5 + k * 10)) ;
        for (let i = 0; i < W; i++) {
          const e = Math.abs(i - (W - 1) / 2) / (W / 2), b = v * (1 - e * .8);
          PX(g, x + i, y + j, b > .8 ? '#e8ffff' : b > .55 ? '#7ae8ff' : b > .3 ? '#2a9ad8' : '#12406a');
        }
      }
      L.push({ x: x + W / 2, y: y + h * .5, r: 40 + k * 30, c: '#5ac8ff', a: .3 + k * .3 });
      return;
    }
    case 'conduit': { for (let i = 0; i < w.w; i++) { const p = ((i * w.dir * -1 + t * 30) % 12 + 12) % 12; PX(g, w.x + i, w.y, p < 2 ? '#ff9ad8' : p < 4 ? '#c45a9a' : '#5a2a4a'); PX(g, w.x + i, w.y + 1, p < 2 ? '#ffd0f0' : '#6a3a5a'); } return; }
    case 'baydoor': {
      const bay = r.bay, o = bay.open || 0, half = w.w / 2, slide = Math.round(half * o);
      g.fillStyle = '#3a3a34';
      if (half - slide > 0) { g.fillRect(w.x, w.y, half - slide, 12); g.fillRect(w.x + half + slide, w.y, half - slide, 12); }
      for (let i = 0; i < w.w; i++) { const inL = i < half - slide, inR = i >= half + slide; if (inL || inR) PX(g, w.x + i, w.y, ((i >> 1) & 1) ? '#d8b030' : '#2a2a2a'); }
      if (o > 0) L.push({ x: w.x + half, y: w.y + 4, r: 10, c: '#ff5a3a', a: .25 * o });
      return;
    }
    case 'fighter': return;             // drawn with the exterior, since they fly out
    case 'crane': {
      const span = w.x1 - w.x0, u = (Math.sin(t * .23 + w.x0) * .5 + .5), cx = Math.round(w.x0 + span * u), drop = Math.round((Math.sin(t * .6) * .5 + .5) * 12);
      R_(g, cx - 3, w.y, 7, 3, '#d8a830'); R_(g, cx, w.y + 3, 1, drop, '#2a2a2a'); R_(g, cx - 1, w.y + 3 + drop, 3, 1, '#8a94a6');
      if (Math.sin(t * .6) > 0) R_(g, cx - 3, w.y + 4 + drop, 7, 5, '#6a7a4a');
      return;
    }
    case 'loader': {
      const span = w.x1 - w.x0, u = Math.sin(t * .19 + w.x0) * .5 + .5, x = Math.round(w.x0 + span * u), dir = Math.cos(t * .19 + w.x0) > 0 ? 1 : -1;
      R_(g, x - 4, w.fl - 6, 8, 5, '#d8a830'); R_(g, x - 3, w.fl - 9, 4, 3, '#3a4a5a'); PX(g, x - 2, w.fl - 8, '#7ae0ff');
      R_(g, x + 4 * dir - (dir < 0 ? 1 : 0), w.fl - 9, 1, 8, '#5a6272'); R_(g, x - 3, w.fl - 1, 2, 1, '#1a1a1a'); R_(g, x + 2, w.fl - 1, 2, 1, '#1a1a1a');
      if (Math.floor(t * .19 / Math.PI + .5) % 2) R_(g, x + (dir > 0 ? 5 : -10), w.fl - 7, 6, 5, '#8a6a3a');
      PX(g, x - 1, w.fl - 10, Math.floor(t * 3) % 2 ? '#ff9a3a' : '#5a3a1a');
      return;
    }
    case 'grow': { R_(g, w.x, w.y, w.w, 1, '#e8a0ff'); L.push({ x: w.x + w.w / 2, y: w.y + 2, r: 10, c: '#d080ff', a: .2 }); return; }
    case 'fish': {
      for (let i = 0; i < 3; i++) { const fx = w.x + (Math.sin(t * (.5 + i * .2) + i * 2) * .5 + .5) * (w.w - 2), fy = w.y + 1 + i * 2, d = Math.cos(t * (.5 + i * .2) + i * 2) > 0 ? 1 : -1; PX(g, fx, fy, ['#ff9a3a', '#ffe45a', '#ff5a8a'][i]); PX(g, fx - d, fy, ['#c86a1a', '#c8a82a', '#c83a6a'][i]); }
      if (rnd() < .02) bubble(w.x + rnd() * w.w, w.y + w.h, null);
      L.push({ x: w.x + w.w / 2, y: w.y + w.h / 2, r: 8, c: '#5ab8ff', a: .2 });
      return;
    }
    case 'holo': {
      const cx = w.x, cy = w.y - 6, a = t * .8;
      if (w.style === 'stars') for (let i = 0; i < 16; i++) { const ang = hash(i, 1) * TAU + a * (hash(i, 2) * .6 + .2), rad = 2 + hash(i, 3) * 7, h = (hash(i, 4) - .5) * 8; PX(g, cx + Math.cos(ang) * rad, cy + h + Math.sin(ang) * rad * .3, hash(i, 5) > .8 ? '#ffe8a0' : '#9ad8ff'); }
      else for (let i = -5; i <= 5; i++) { const x = cx + i * Math.cos(a), y = cy + Math.sin(i * .6) * 1.2; PX(g, x, y, '#7ad8ff'); if (Math.abs(i) < 3) PX(g, x, y - 1, '#7ad8ff'); }
      g.globalAlpha = .25; R_(g, cx - 1, w.y - 1, 3, 1, '#9ad8ff'); g.globalAlpha = 1;
      L.push({ x: cx, y: cy, r: 12, c: '#7ad8ff', a: .3 });
      return;
    }
    case 'steam': if (rnd() < w.rate * .05) steam(w.x, w.y); return;
    case 'oven': { R_(g, w.x, w.y, w.w, w.h, Math.floor(t * 3) % 2 ? '#ff8a2a' : '#e86a1a'); L.push({ x: w.x + w.w / 2, y: w.y + 1, r: 8, c: '#ff8a3a', a: .3 }); return; }
    case 'glow': L.push({ x: w.x + w.w / 2, y: w.y + w.h / 2, r: w.w * .6, c: w.c, a: .22 }); return;
    case 'neon': { const on = !(Math.floor(t * 7) % 23 === 0); g.fillStyle = on ? '#ff5ab8' : '#5a2a4a'; neonText(g, w.text, w.x, w.y); if (on) L.push({ x: w.x + 8, y: w.y + 2, r: 12, c: '#ff5ab8', a: .35 }); return; }
    case 'jukebox': { for (let i = 0; i < 7; i++) PX(g, w.x + i, w.y + ((i + Math.floor(t * 4)) % 3), ['#ff5a5a', '#ffd24a', '#5aff8a', '#5ac8ff', '#c05aff'][(i + Math.floor(t * 2)) % 5]); L.push({ x: w.x + 3, y: w.y + 3, r: 8, c: '#ff7ad8', a: .25 }); if (rnd() < .01) glyph(w.x + 3, w.y - 2, 'n', '#ffd24a'); return; }
    case 'pool': { const busy = r.stations.some(s => s.act === 'pool' && s.occ), dx = busy ? Math.sin(t * 1.1) * 4 : 0; PX(g, w.x + 8 + dx, w.y, '#ffffff'); PX(g, w.x + 11 - dx * .5, w.y, '#e83a3a'); PX(g, w.x + 13, w.y, '#ffd24a'); PX(g, w.x + 14, w.y, '#3a5ae8'); return; }
    case 'candle': { PX(g, w.x, w.y - 1, rnd() < .5 ? '#ffd24a' : '#ffae3a'); PX(g, w.x, w.y, '#e8e0c8'); L.push({ x: w.x + .5, y: w.y - 1, r: 6, c: '#ffb04a', a: .3 + rnd() * .1 }); return; }
    case 'tread': { const s = r.stations.find(s => s.tread && Math.abs(s.x - (w.x + 6)) < 4), on = s && s.occ; for (let i = 0; i < w.w; i++) PX(g, w.x + i, w.y, ((i + (on ? Math.floor(t * 20) : 0)) % 3) ? '#3a3e48' : '#6a7080'); return; }
    case 'bag': {
      const s = r.stations.find(s => s.bag), c = s && s.occ, hit = c ? Math.max(0, Math.sin(c.actT * 6)) : 0, sw = Math.round(hit * 2);
      R_(g, w.x - 2 + sw, w.y, 5, 11, '#8a2a2a'); R_(g, w.x - 2 + sw, w.y, 5, 1, '#c84a3a'); R_(g, w.x - 2 + sw, w.y + 10, 5, 1, '#5a1a1a'); R_(g, w.x, w.y - 1, 1, 1, '#8a94a6');
      return;
    }
    case 'target': { const hot = t - (w.ref.hit || -9) < .25; R_(g, w.x, w.y, 3, 7, hot ? '#fff0a0' : '#e8e2d0'); PX(g, w.x + 1, w.y + 2, '#c83a2a'); PX(g, w.x + 1, w.y + 3, '#c83a2a'); if (hot) L.push({ x: w.x + 1, y: w.y + 3, r: 5, c: '#ffd24a', a: .5 }); return; }
    case 'field': { for (let j = 0; j < w.h; j++) if ((j + Math.floor(t * 12)) % 3 !== 0) PX(g, w.x, w.y + j, j % 2 ? '#5ae0ff' : '#b8f4ff'); L.push({ x: w.x, y: w.y + w.h / 2, r: 10, c: '#5ae0ff', a: .18 }); return; }
    case 'heart': {
      const s = r.stations.find(s => s.medbed === w.bed), on = s && s.occ, speed = on ? 14 : 0;
      for (let i = 0; i < w.w; i++) { const p = ((i + t * speed) % 10 + 10) % 10; const yy = on && p < 1 ? 0 : on && p < 2 ? w.h - 1 : Math.floor(w.h / 2); PX(g, w.x + i, w.y + yy, on ? '#5aff7a' : '#2a5a3a'); }
      if (on) L.push({ x: w.x + w.w / 2, y: w.y + 2, r: 6, c: '#5aff7a', a: .2 });
      return;
    }
    case 'bubbles': if (rnd() < .03) spawn({ x: w.x + rnd() * 2, y: w.y, vy: -4, life: .8, c: w.c }); return;
    case 'specimen': {
      const bx = w.x + w.w / 2 + Math.sin(t * .7) * 2, by = w.y + w.h / 2 + Math.sin(t * 1.1) * 2;
      R_(g, bx - 2, by - 1, 4, 3, '#b8ffa0'); PX(g, bx - 3, by + 1, '#8ae07a'); PX(g, bx + 2, by + 1, '#8ae07a'); PX(g, bx, by, Math.floor(t * .7) % 5 ? '#2a2a2a' : '#b8ffa0');
      if (rnd() < .05) spawn({ x: w.x + rnd() * w.w, y: w.y + w.h, vy: -6, life: w.h / 6, c: '#9affc8' });
      L.push({ x: w.x + w.w / 2, y: w.y + w.h / 2, r: 10, c: '#5aff9a', a: .25 });
      return;
    }
    case 'radar': {
      const a = t * 2, ex = w.x + Math.cos(a) * w.r, ey = w.y + Math.sin(a) * w.r;
      for (let i = 0; i <= w.r; i++) PX(g, w.x + Math.cos(a) * i, w.y + Math.sin(a) * i, '#5aff7a');
      for (let i = 0; i < 3; i++) { const ba = hash(i, 9) * TAU, br = hash(i, 8) * w.r; if (((a - ba) % TAU + TAU) % TAU < 1.5) PX(g, w.x + Math.cos(ba) * br, w.y + Math.sin(ba) * br, '#caffca'); }
      L.push({ x: w.x, y: w.y, r: 8, c: '#5aff7a', a: .2 });
      return;
    }
    case 'lathe': { const busy = r.stations.some(s => s.occ && Math.abs(s.x - w.x) < 8); for (let i = 0; i < w.w; i++) PX(g, w.x + i, w.y + ((i + (busy ? Math.floor(t * 30) : 0)) % 2), '#aeb6c4'); return; }
    case 'fan': {
      const a = t * 9;
      for (let b = 0; b < 3; b++) { const ang = Math.round((a + b * TAU / 3) / (TAU / 8)) * (TAU / 8); for (let i = 1; i <= w.r; i++) PX(g, w.x + Math.cos(ang) * i, w.y + Math.sin(ang) * i, '#8a94a6'); }
      PX(g, w.x, w.y, '#cfd6e0');
      return;
    }
    case 'tank': { const lvl = Math.round(w.h * (.55 + .1 * Math.sin(t * .2 + w.phase))); for (let i = 0; i < w.w; i++) { const s = Math.round(Math.sin(i * .8 + t * 3) * .7); R_(g, w.x + i, w.y + w.h - lvl + s, 1, lvl - s, i % 5 ? '#2a7ab8' : '#3a8ac8'); PX(g, w.x + i, w.y + w.h - lvl + s, '#8ad8ff'); } if (rnd() < .04) spawn({ x: w.x + rnd() * w.w, y: w.y + w.h - 1, vy: -5, life: 1.2, c: '#bfe8ff' }); return; }
    case 'piston': { const p = Math.round((Math.sin(t * 4) * .5 + .5) * 4); R_(g, w.x - 1, w.y - 6 - p, 3, 6 + p, '#aeb6c4'); R_(g, w.x - 2, w.y - 7 - p, 5, 1, '#5a6272'); return; }
    case 'coil': { if (rnd() < .15) { let x = w.x, y = w.y; for (let i = 0; i < 5; i++) { x += Math.round((rnd() - .5) * 3); y -= 1; PX(g, x, y, '#caf0ff'); } } PX(g, w.x, w.y, '#9ad8ff'); L.push({ x: w.x, y: w.y - 2, r: 7, c: '#9ad8ff', a: .25 + rnd() * .15 }); return; }
    case 'leds': { const k = Math.floor(t * 3); for (let j = 0; j < w.h; j += 2) for (let i = 0; i < w.w; i += 2) { const v = hash(i + k * 3 + w.x, j); if (v > .45) PX(g, w.x + i, w.y + j, v > .85 ? '#ffd24a' : '#5aff9a'); } L.push({ x: w.x + 2, y: w.y + w.h / 2, r: 6, c: '#5aff9a', a: .12 }); return; }
    case 'pillar': { for (let j = 0; j < w.h; j++) { const p = ((j - t * 25) % 16 + 16) % 16; R_(g, w.x, w.y + j, w.w, 1, p < 3 ? '#9af0ff' : p < 6 ? '#3a9ac8' : '#123a5a'); } L.push({ x: w.x + w.w / 2, y: w.y + w.h / 2, r: 18, c: '#5ac8ff', a: .25 }); return; }
    case 'orb': {
      const pulse = .7 + .3 * Math.sin(t * 2.3);
      for (let j = -w.r; j <= w.r; j++) for (let i = -w.r; i <= w.r; i++) { const d = Math.hypot(i, j) / w.r; if (d <= 1) PX(g, w.x + i, w.y + j, d < .35 * pulse ? '#ffffff' : d < .7 ? '#7ae8ff' : '#2a8ad8'); }
      for (let k = 0; k < 2; k++) for (let i = 0; i < 20; i++) { const a = i / 20 * TAU + t * (k ? 1.4 : -1.1); PX(g, w.x + Math.cos(a) * (w.r + 3), w.y + Math.sin(a) * (w.r + 3) * (k ? .3 : .6), '#b8f4ff'); }
      L.push({ x: w.x, y: w.y, r: 26, c: '#5ae0ff', a: .35 * pulse });
      return;
    }
    case 'pads': for (const p of w.ref) if (p.beam > 0) {
      for (let i = 0; i < 10; i++) PX(g, p.x + (rnd() - .5) * 8, w.top + 2 + rnd() * (p.y - w.top - 2), rnd() < .5 ? '#ffffff' : '#9af0ff');
      L.push({ x: p.x, y: (p.y + w.top) / 2, r: 16, c: '#9af0ff', a: .5 * p.beam });
    } return;
    case 'drum': { const s = r.stations.find(s => s.machine && Math.abs(s.x - w.x) < 2), on = s && s.occ; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + (on ? t * 8 : 0); PX(g, w.x + Math.cos(a) * w.r, w.y + Math.sin(a) * w.r, on ? ['#e05a5a', '#5a9ae0', '#e8e8e8', '#5ac07a'][i % 4] : '#5a6474'); } PX(g, w.x, w.y, '#2a3440'); return; }
    case 'shower': { const s = r.stations.find(s => s.shower && Math.abs(s.x - w.x) < 2); if (s && s.occ) { for (let i = 0; i < 4; i++) PX(g, w.x - 2 + rnd() * 5, w.y + rnd() * w.h, '#bfe8ff'); if (rnd() < .08) steam(w.x, w.y + w.h - 4); } return; }
  }
}
function neonText(g, s, x, y) {
  const F = { O: ['###', '#.#', '#.#', '#.#', '###'], P: ['###', '#.#', '###', '#..', '#..'], E: ['###', '#..', '##.', '#..', '###'], N: ['#.#', '###', '###', '#.#', '#.#'] };
  for (const ch of s) { const f = F[ch]; if (f) f.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') g.fillRect(x + i, y + j, 1, 1); })); x += 4; }
}

/* ---------- the crew: a pose for every activity ---------- */
const WALK_ST = ['walk0', 'walk1', 'walk2', 'walk1'], WALK_ARM = ['back', 'sides', 'fwd', 'sides'];
function pose(c, t, view) {
  const ph = c.ph || 0;
  switch (c.mode) {
    case 'walk': case 'walkq': { const f = Math.floor(c.walkT / 2.4) % 4; return c.carry ? [WALK_ST[f], 'hold', 'box'] : [WALK_ST[f], WALK_ARM[f], 'none']; }
    case 'ladder': { const f = Math.floor(c.walkT / 2) % 2; return [f ? 'climb1' : 'climb0', f ? 'climbB' : 'climbA', 'none']; }
    case 'liftwait': case 'lift': return ['front', 'none', 'none'];
    case 'wait': case 'idle': return (Math.floor(t / 3 + ph) % 3) ? ['front', 'none', 'none'] : ['stand', 'sides', 'none'];
    case 'pause': return ['stand', 'hold', 'pad'];
    case 'queue': return ['stand', Math.floor(t + ph) % 4 ? 'sides' : 'reach', Math.floor(t + ph) % 4 ? 'none' : 'tray'];
    case 'beamout': case 'beamin': return ['front', 'none', 'none'];
  }
  const a = c.task && (c.task.kind === 'repair' || c.task.kind === 'inspect') ? 'repair' : c.st ? c.st.act : 'stand', T = c.actT || 0;
  const cyc = (p, n) => Math.floor(T / p + ph) % n;
  switch (a) {
    case 'console': case 'gunner': case 'micro': return cyc(6, 5) === 0 ? ['sit', 'lap', 'none'] : ['sit', cyc(.18, 2) ? 'type0' : 'type1', 'none'];
    case 'standConsole': return cyc(7, 5) === 0 ? ['stand', 'sides', 'none'] : ['stand', cyc(.2, 2) ? 'type0' : 'type1', 'none'];
    case 'captain': return cyc(5, 4) === 0 ? ['sit', 'point', 'none'] : ['sit', 'lap', 'none'];
    case 'desk': return cyc(8, 3) === 0 ? ['sit', 'hold', 'pad'] : ['sit', cyc(.3, 2) ? 'type0' : 'type1', 'none'];
    case 'sleep': case 'patient': return ['lie', 'none', 'none'];
    case 'eat': return cyc(1.6, 4) === 0 ? ['sit', 'mouth', 'none'] : ['sit', 'type1', 'none'];
    case 'serve': return cyc(2.5, 3) === 0 ? ['stand', 'reach', 'tray'] : ['stand', 'type0', 'none'];
    case 'cook': return ['stand', cyc(.3, 2) ? 'type0' : 'type1', 'spoon'];
    case 'chop': return ['stand', cyc(.15, 2) ? 'type0' : 'type1', 'none'];
    case 'run': return ['run' + cyc(.12, 3), cyc(.12, 2) ? 'fwd' : 'back', 'none'];
    case 'lift': return cyc(1.2, 2) ? ['stand', 'up', 'bar'] : ['stand', 'chest', 'barlow'];
    case 'punch': return cyc(.28, 2) ? ['stand', 'reach', 'none'] : ['stand', 'guard', 'none'];
    case 'pullup': return ['hang', 'hang', 'none'];
    case 'stretch': { const k = cyc(3, 3); return k === 0 ? ['stand', 'up', 'none'] : k === 1 ? ['floor', 'lap', 'none'] : ['kneel', 'fwd', 'none']; }
    case 'shoot': return [c.st && c.st.kneel ? 'kneel' : 'stand', 'reach', 'gun'];
    case 'armorer': return ['stand', 'low', 'rifle'];
    case 'scan': return ['stand', 'reach', 'scanner'];
    case 'clipboard': return cyc(4, 3) === 0 ? ['front', 'none', 'none'] : ['stand', 'hold', 'clip'];
    case 'lab': return ['stand', cyc(1.5, 2) ? 'fwd' : 'type0', 'beaker'];
    case 'water': return ['stand', 'fwd', 'can'];
    case 'read': return ['sit', 'hold', 'book'];
    case 'couch': case 'sit': case 'sitback': return ['sit', 'lap', 'none'];
    case 'look': return ['back', 'none', 'none'];
    case 'pool': return cyc(5, 4) === 0 ? ['stand', 'low', 'cue'] : ['stand', 'sides', 'none'];
    case 'arcade': return ['stand', cyc(.12, 2) ? 'type0' : 'type1', 'none'];
    case 'guitar': return ['sit', cyc(.25, 2) ? 'lap' : 'type1', 'guitar'];
    case 'drink': return cyc(4, 5) === 0 ? ['sit', 'mouth', 'mug'] : ['sit', 'type1', 'mugdown'];
    case 'bartend': return ['stand', cyc(.4, 2) ? 'chest' : 'hold', 'glass'];
    case 'meditate': return ['floor', 'lap', 'none'];
    case 'meeting': return cyc(3, 4) === 0 ? ['sit', 'point', 'none'] : ['sit', 'lap', 'none'];
    case 'laundry': return ['stand', 'low', 'none'];
    case 'fold': return ['stand', cyc(.6, 2) ? 'type0' : 'type1', 'none'];
    case 'shower': return ['back', 'none', 'none'];
    case 'sink': return ['stand', cyc(.2, 2) ? 'mouth' : 'guard', 'none'];
    case 'weld': case 'repair': return cyc(3, 3) === 0 ? ['stand', 'hold', 'wrench'] : ['kneel', 'low', 'torch'];
    case 'mechanic': return cyc(4, 2) ? ['kneel', 'low', 'wrench'] : ['stand', 'reach', 'wrench'];
    default: return ['stand', 'sides', 'none'];
  }
}
// side effects of what they're doing: sparks, zzz, notes, laser bolts
function effects(c, t, dt) {
  const a = c.task && (c.task.kind === 'repair' || c.task.kind === 'inspect') ? 'repair' : c.st ? c.st.act : null;
  if (c.mode !== 'act' || !a) return;
  const T = c.actT, was = T - dt, every = (p, o = 0) => Math.floor((T + o) / p) !== Math.floor((was + o) / p);
  const hx = c.x + c.dir * 4, hy = c.y - 8;
  switch (a) {
    case 'sleep': if (every(3.2, c.ph)) glyph(c.x + c.dir * -3, c.y - 6, 'z', '#cfe0ff', 2.2, -3); break;
    case 'weld': case 'repair': if (Math.floor(T / 3 + c.ph) % 3 && rnd() < .5) sparks(c.x + c.dir * 5, c.y - 3, 1); break;
    case 'mechanic': if (rnd() < .1) sparks(c.x + c.dir * 5, c.y - 4, 1); break;
    case 'guitar': if (every(1.1, c.ph)) glyph(c.x + c.dir * 2, c.y - 12, 'n', '#ffe07a', 1.8, -6); break;
    case 'run': if (every(2.5)) spawn({ x: c.x - c.dir * 2, y: c.y - 11, vx: -c.dir * 6, vy: -2, ay: 30, life: .5, c: '#9ad8ff' }); break;
    case 'water': if (rnd() < .3) spawn({ x: c.x + c.dir * 6, y: c.y - 8, vx: c.dir * 3, vy: 5, ay: 40, life: .4, c: '#8ad8ff' }); break;
    case 'meeting': case 'drink': case 'couch': case 'sit': if (every(9, c.ph * 3)) bubble(c.x, c.y - 16, ['h', 'q', 's', 'd', 'x'][Math.floor(rnd() * 5)]); break;
    case 'captain': if (every(11, c.ph)) bubble(c.x + c.dir * 2, c.y - 16, 's'); break;
    case 'shoot': {
      const s = c.st; if (!s || !s.target) break;
      if (every(1.9, c.ph)) {
        const tx = s.target.x - 2, ty = c.y - (s.kneel ? 6 : 8);
        spawn({ x: c.x + 6, y: ty, life: .08, c: '#fff0a0', glow: 5 });
        bolt(c.x + 6, ty, tx, '#ff5a3a', () => { s.target.hit = clock; sparks(tx, ty, 3, '#ff8a5a'); });
      }
      break;
    }
  }
}

/* ---------- small sprites ---------- */
function fighter(g, x, y, col, flying, L) {
  // a small starfighter, side on, nose to the right; (x, y) is the middle of its belly
  const pal = { b: col, l: shade(col, .2), d: shade(col, -.35), c: '#5ab0e0', C: '#bfe8ff', r: '#c8453a', e: '#2a2e38', g: '#3a3f4a' };
  const rows = ['..........lll............', '.......llllllll..........', '....bbbbbbbbbbbcCc.......', 'eebbbbbbbbrrrrbbbccb.....', 'eebbbbbbbbbbbbbbbbbbbbbb.', '..ddddddddddddddddddddd..', '....g.........g..........', '...ggg.......ggg.........'];
  const X = Math.round(x) - 12, Y = Math.round(y) - (flying ? 6 : 8);
  rows.forEach((row, j) => { if (flying && j > 5) return; [...row].forEach((k, i) => { if (k !== '.') PX(g, X + i, Y + j, pal[k]); }); });
  if (flying) { for (let i = 1; i <= 3 + (rnd() * 3 | 0); i++) { PX(g, X - i, Y + 3, i < 2 ? '#ffffff' : '#7ad8ff'); PX(g, X - i, Y + 4, i < 3 ? '#9af0ff' : '#3a8ad8'); } L.push({ x: X - 2, y: Y + 4, r: 8, c: '#7ad8ff', a: .6 }); }
  else PX(g, X + 16, Y + 2, Math.floor(performance.now() / 700) % 2 ? '#ff5a3a' : '#5a2a1a');
}
function pxList(g, list, x, y, flip) { for (const [dx, dy, c] of list) PX(g, x + (flip ? -dx : dx), y + dy, c); }

/* ---------- the whole frame ---------- */
export function drawWorld(g, rect, ship, painted, sim, t, dt, L) {
  const { x0, y0, x1, y1 } = rect, W = x1 - x0, H = y1 - y0;
  clock = t;
  const inView = (x, y, m = 20) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m;
  g.clearRect(x0, y0, W, H);
  g.drawImage(painted.bg, x0, y0, W, H, x0, y0, W, H);
  // room widgets and static lights
  for (const r of ship.rooms) {
    if (r.x1 < x0 || r.x0 > x1 || floorY(r.d1) + 4 < y0 || deckTop(r.d0) > y1) continue;
    const flick = r.broken ? (Math.floor(t * 9) % 4 ? 1 : .2) : 1;
    for (const w of r.widgets) widget(g, w, t, sim, L);
    for (const l of r.lights) L.push(flick === 1 && !r.dim ? l : { ...l, a: l.a * flick * (r.dim ? .3 : 1) });
    if (r.broken) { if (rnd() < .12) sparks(r.panel.x, floorY(r.d1) - 10, 2, '#ffae4a'); if (r.badge && Math.floor(t * 3) % 2) { R_(g, r.badge.x + 7, r.badge.y - 1, 2, 2, '#ff3a2a'); } }
  }
  // lift cars and their riders
  for (const lf of sim.lifts) {
    const cx = Math.round(lf.x) - 5, cy = Math.round(lf.y) - 15;
    if (!inView(cx, cy, 30)) continue;
    R_(g, cx, cy, 10, 15, '#2a3240'); R_(g, cx + 1, cy + 1, 8, 1, '#dfe9ff');
    for (const c of lf.riders) drawAgent(g, c, t, sim);   // the cat and the droid ride the lifts too
    R_(g, cx - 1, cy - 1, 12, 1, '#8a94a6'); R_(g, cx - 1, cy + 15, 12, 1, '#5a6272');
    const o = lf.state === 'doors' ? 1 : 0;
    if (!o) { g.globalAlpha = .35; R_(g, cx, cy + 2, 10, 13, '#9ad8ff'); g.globalAlpha = 1; }
    R_(g, cx - 1, cy, 1, 15, '#5a6272'); R_(g, cx + 10, cy, 1, 15, '#5a6272');
    L.push({ x: cx + 5, y: cy + 3, r: 6, c: '#dfe9ff', a: .25 });
  }
  // exterior: engine flames, running lights, the radar and deflector
  const k = sim.warp.k;
  for (const e of painted.ext) {
    if (!inView(e.x, e.y, 80)) continue;
    switch (e.kind) {
      case 'engine': {
        const len = 12 + 5 * Math.sin(t * 13 + e.y) + rnd() * 3 + k * 60, hh = e.h / 2 - 2;
        for (let i = 0; i < len; i++) {
          const f = i / len, w = Math.max(0, hh * (1 - f * .9));
          for (let j = -w; j <= w; j++) {
            const q = Math.abs(j) / (w + .01) + f * .8 + (rnd() - .5) * .2;
            if (q > 1.25) continue;
            PX(g, e.x - i, e.y + j, q < .35 ? '#ffffff' : q < .6 ? '#a8f0ff' : q < .85 ? '#4aa8ff' : '#6a4ad8');
          }
        }
        L.push({ x: e.x - 6, y: e.y, r: 26 + k * 40, c: '#6ac8ff', a: .5 + k * .3 });
        break;
      }
      case 'porthole': L.push({ x: e.x, y: e.y, r: 4, c: '#ffd9a0', a: .25 }); break;
      case 'mastlight': if (Math.floor(t * 1.2 + e.x) % 2) { PX(g, e.x, e.y, '#ff4a3a'); L.push({ x: e.x + .5, y: e.y + .5, r: 6, c: '#ff4a3a', a: .6 }); } break;
      case 'runlight': if ((t * 1.1 + e.y * .01) % 1.3 < .15) { PX(g, e.x, e.y, e.c); L.push({ x: e.x, y: e.y, r: 10, c: e.c, a: .8 }); } break;
      case 'radar': { const a = t * 1.5, dx = Math.round(Math.cos(a) * 4); R_(g, e.x - 1, e.y - 2, 3, 2, '#5a6272'); for (let i = -4; i <= 4; i++) if (Math.abs(i) <= Math.abs(dx) || i === 0) PX(g, e.x + Math.sign(dx || 1) * Math.abs(i) * Math.sign(i), e.y - 3 - (Math.abs(i) === 4 ? 1 : 0), '#aeb6c4'); break; }
      case 'deflector': { const p = .6 + .4 * Math.sin(t * 2); for (let j = -3; j <= 3; j++) PX(g, e.x - Math.abs(j) * .5, e.y + j, p > .8 ? '#caf6ff' : '#5ac8ff'); L.push({ x: e.x, y: e.y, r: 18, c: '#5ac8ff', a: .35 + p * .25 }); break; }
    }
  }
  for (const f of sim.fighters) if (f.state !== 'away' && f.state !== 'boarding' || f.state === 'boarding') {
    if (f.state === 'away') continue;
    if (inView(f.x, f.y, 30)) fighter(g, f.x, f.y, f.col, ['fly', 'return', 'drop', 'rise'].includes(f.state), L);
  }
  // The crew. Only people using a piece of front furniture (asleep in a bunk, serving behind a counter, in the
  // shower) go behind the front layer; everyone else, walking past included, is drawn in front of it.
  const behind = c => c.mode === 'act' && c.st && c.st.behind;
  const crew = sim.crew.filter(c => c.mode !== 'flying' && c.mode !== 'lift' && inView(c.x, c.y, 20));
  for (const c of crew) if (behind(c)) { drawAgent(g, c, t, sim); effects(c, t, dt); }
  g.drawImage(painted.fg, x0, y0, W, H, x0, y0, W, H);
  for (const c of crew) if (!behind(c)) { drawAgent(g, c, t, sim); effects(c, t, dt); }
  if (sim.prisoner && inView(sim.prisoner.x, sim.prisoner.y)) drawAgent(g, sim.prisoner, t, sim);
  for (const a of sim.agents) if (a.mode !== 'lift' && inView(a.x, a.y)) drawCritter(g, a, t);
  // doors
  for (const D of sim.doors) {
    if (!inView(D.x, D.y)) continue;
    const h = Math.round(15 * (1 - D.open));
    if (h > 0) { R_(g, D.x - 1, D.y - 15, 2, h, '#c8903a'); R_(g, D.x - 1, D.y - 15, 1, h, '#e8b058'); if (h > 3) PX(g, D.x, D.y - 15 + (h >> 1), '#5a3a1a'); }
  }
  // sleeping quarters go dark
  for (const r of ship.rooms) {
    const beds = r.stations.filter(s => s.bed);
    if (!beds.length) { r.dim = false; continue; }
    const asleep = beds.filter(s => s.occ && s.occ.mode === 'act').length, awake = sim.crew.some(c => c.mode !== 'act' ? false : c.st && c.st.room === r && !c.st.bed);
    const dark = asleep > 0 && !awake && !sim.crew.some(c => c.d === r.d1 && c.x > r.x0 && c.x < r.x1 && (c.mode === 'walk' || c.mode === 'wait'));
    r.dimK = clamp((r.dimK || 0) + (dark ? dt * .8 : -dt * 2), 0, 1); r.dim = r.dimK > .5;
    if (r.dimK > 0 && !(r.x1 < x0 || r.x0 > x1 || floorY(r.d1) < y0 || deckTop(r.d0) > y1)) {
      g.globalAlpha = r.dimK * .62; R_(g, r.x0 + 1, deckTop(r.d0) + CEIL, r.x1 - r.x0 - 2, floorY(r.d1) - deckTop(r.d0) - CEIL, '#05060f'); g.globalAlpha = 1;
      if (r.dimK > .5) L.push({ x: r.x0 + 6, y: floorY(r.d1) - 3, r: 5, c: '#5a7aff', a: .25 });
    }
  }
  // particles
  for (const p of vfx) {
    if (!inView(p.x, p.y)) continue;
    const f = 1 - p.t / p.life;
    g.globalAlpha = p.fade ? Math.min(1, f * 1.5) : 1;
    if (p.glyph) { g.fillStyle = p.c; GLYPH[p.glyph].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') g.fillRect(Math.round(p.x) + i - 1, Math.round(p.y) + j - 1, 1, 1); })); }
    else if (p.bubble !== undefined) {
      if (p.bubble === null) { PX(g, p.x, p.y, '#cfefff'); }
      else { const bx = Math.round(p.x) - 3, by = Math.round(p.y) - 3; R_(g, bx, by, 7, 5, '#f4f1e8'); PX(g, bx + 2, by + 5, '#f4f1e8'); g.fillStyle = '#2a2a34'; GLYPH[p.bubble].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') g.fillRect(bx + 2 + i, by + 1 + j, 1, 1); })); }
    }
    else if (p.bolt) { R_(g, p.x - 3, p.y, 4, 1, p.c); PX(g, p.x, p.y, '#fff0e0'); }
    else if (p.grow) { const s = 1 + Math.floor(p.t * 1.5); g.globalAlpha *= .6; R_(g, p.x - (s >> 1), p.y - (s >> 1), s, s, p.c); }
    else PX(g, p.x, p.y, p.c);
    g.globalAlpha = 1;
    if (p.glow) L.push({ x: p.x, y: p.y, r: p.glow, c: p.c, a: .5 * f });
  }
}

// The sprite a crew member is showing right now, and where its top-left corner goes.
function agentSprite(c, t) {
  if (c.dept === 'prisoner') {
    const f = Math.floor((c.walkT || 0) / 2.4) % 4, st = c.mode === 'sleep' ? 'lie' : c.mode === 'sitb' ? 'sit' : WALK_ST[f];
    const s = crewSprite(c.look, st, st === 'lie' ? 'none' : c.mode === 'sitb' ? 'lap' : WALK_ARM[f], 'none', c.dir < 0, '#8a8a7a');
    return { s, st, x: Math.round(c.x) - s.ox, y: Math.round(c.y) - s.oy };
  }
  const [st, arms, prop] = pose(c, t);
  const s = crewSprite(c.look, st, arms, prop, c.dir < 0, st === 'lie' ? (c.st && c.st.blanket) : undefined);
  let y = Math.round(c.y) - s.oy;
  if (st === 'hang') y -= Math.round((Math.sin((c.actT || 0) * 2.2) * .5 + .5) * 3);
  return { s, st, x: Math.round(c.x) - s.ox, y };
}
// The cat and the droid are little pixel lists rather than composed sprites.
function critterPixels(a, t) {
  if (a.kind === 'cat') {
    const C = a.sprites || (a.sprites = CAT(a.col[0], a.col[1]));
    const px = a.mode === 'walk' ? (Math.floor(t * 8) % 2 ? C.walk0 : C.walk1) : a.mode === 'rest' && a.pose === 'sleep' ? C.sleep : C.sit;
    return { px, x: Math.round(a.x), y: Math.round(a.y) };
  }
  return { px: DROID.body, x: Math.round(a.x), y: Math.round(a.y) - (a.mode === 'walk' ? Math.floor(t * 6) % 2 : 0) };
}

export function drawAgent(g, c, t, sim) {
  if (!c.look) return drawCritter(g, c, t);
  const { s, x, y } = agentSprite(c, t);
  if (c.dept === 'prisoner') { g.drawImage(s.c, x, y); return; }
  if (c.mode === 'beamout' || c.mode === 'beamin') {
    const k = c.mode === 'beamout' ? 1 - c.bt / 1.2 : c.bt / 1.2;
    g.globalAlpha = clamp(k, 0, 1); g.drawImage(s.c, x, y); g.globalAlpha = 1;
    for (let i = 0; i < 4; i++) PX(g, c.x + (rnd() - .5) * 8, c.y - rnd() * 14, '#caf6ff');
    return;
  }
  g.drawImage(s.c, x, y);
  if (c.mode === 'act' && c.st && c.st.tray && c.st.act === 'eat') { R_(g, c.x + c.dir * 4 - (c.dir < 0 ? 2 : 0), c.y - 7, 3, 1, '#aeb6c4'); PX(g, c.x + c.dir * 5, c.y - 8, '#e0a040'); }
}
function drawCritter(g, a, t) {
  const { px, x, y } = critterPixels(a, t);
  pxList(g, px, x, y, a.dir < 0);
  if (a.kind === 'cat') { if (a.pose === 'sleep' && a.mode === 'rest' && Math.floor(t / 3.5) !== Math.floor((t - 1 / 60) / 3.5)) glyph(a.x, a.y - 5, 'z', '#cfe0ff', 2, -3); }
  else if (a.mode === 'rest' && Math.floor(t * 4) % 2) spawn({ x: a.x + (rnd() - .5) * 4, y: a.y - 1, vy: -3, life: .6, c: '#bfe8ff' });
}

/* ---------- marks: hover frame, repair bars, the selected person — all on the ship's own pixel grid ---------- */
// The box a crew member (or the cat, or the droid) is drawn in: [x0, y0, x1, y1), whole pixels.
export function agentBox(c, t) {
  if (!c.look) {
    const { px, x, y } = critterPixels(c, t), flip = c.dir < 0;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [dx, dy] of px) { const X = x + (flip ? -dx : dx); x0 = Math.min(x0, X); x1 = Math.max(x1, X + 1); y0 = Math.min(y0, y + dy); y1 = Math.max(y1, y + dy + 1); }
    return { x0, y0, x1, y1 };
  }
  const { s, x, y } = agentSprite(c, t);
  return { x0: x, y0: y, x1: x + s.c.width, y1: y + s.c.height };
}
const OUT = '#0a0c12', GREEN = '#6ad26a', GREEN_HI = '#b8ffb0';
// FTL-style corner brackets round someone, and a little health bar over their head.
export function drawSelection(g, c, t) {
  if (c.mode === 'flying') return;
  const b = agentBox(c, t), x0 = b.x0 - 1, y0 = b.y0 - 1, x1 = b.x1, y1 = b.y1;
  const L = Math.max(2, Math.min(3, Math.floor((x1 - x0) / 3)));
  g.fillStyle = GREEN;
  for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    g.fillRect(sx > 0 ? x : x - L + 1, y, L, 1);
    g.fillRect(x, sy > 0 ? y : y - L + 1, 1, L);
  }
  const w = x1 - x0 - 1, by = y0 - 4;
  R_(g, x0, by, w + 2, 3, OUT); R_(g, x0 + 1, by + 1, w, 1, GREEN); PX(g, x0 + 1, by + 1, GREEN_HI);
}
// A one-pixel frame round a room.
export function drawRoomFrame(g, r, col) {
  const x0 = r.x0 - 1, x1 = r.x1, y0 = deckTop(r.d0) + CEIL - 1, y1 = floorY(r.d1) + 1;
  g.fillStyle = col;
  g.fillRect(x0, y0, x1 - x0 + 1, 1); g.fillRect(x0, y1, x1 - x0 + 1, 1);
  g.fillRect(x0, y0, 1, y1 - y0 + 1); g.fillRect(x1, y0, 1, y1 - y0 + 1);
}
// The bar that fills while an engineer fixes a broken system, red to green.
export function drawRepairBar(g, r) {
  const w = 16, x = Math.round(r.panel.x) - 8, y = floorY(r.d1) - 24, done = Math.round(w * r.broken.p);
  R_(g, x - 1, y - 1, w + 2, 5, OUT); R_(g, x, y, w, 3, '#c83a2a'); R_(g, x, y, w, 1, '#ff6a4a');
  if (done > 0) { R_(g, x, y, done, 3, GREEN); R_(g, x, y, done, 1, GREEN_HI); }
}
