// The trip simulation: the boat's drift, the creatures, fruit, bubbles and
// little effects. No DOM, so the headless sim runs it too.
import { rng, clamp, lerp } from './paper.js';
import { SPECIES } from './creatures.js';
import { buildTrip, WORLD_H } from './routes.js';

export const SNAP_HZ = 12;
export const FILM = 90;          // seconds of film per trip
export const CLIP_MAX = 10;      // longest single take
export const SPEED = 30;         // drift, world units per second

export function makeWorld(ri, seed, VW) {
  const trip = buildTrip(ri, seed, VW);
  trip.VW = VW;
  const r = rng(seed * 7 + 3);
  const w = {
    trip, route: trip.route, ri, VW, S: 0, t: 0, speed: SPEED, moored: false, ended: false,
    creatures: [], fruits: [], bubbles: [], fx: [], r, sound: () => {}, nextId: 1,
    frame: { x: VW / 2 - 90, y: 200, w: 180, h: 101 },
    cool: { fruit: 0, whistle: 0, bubbles: 0 },
    pendingBubbles: [],
  };
  for (const s of trip.spawns) {
    const c = {
      id: s.id, sp: s.sp, x: s.x, y: s.y, p: s.p, home: s.x, homeY: s.y,
      face: r() < 0.5 ? -1 : 1, beh: null, bt: 0, dur: 0, ph: 0, t: r() * 20, next: r() * 3,
      k: {}, act: null, tgt: null, moving: 0, cd: 0,
    };
    if (s.sp === 'ferngrazer') { c.k.face0 = s.dx ? 1 : -1; c.face = c.k.face0; c.k.out = 0; }
    if (s.sp === 'puffwick' && s.dx) c.face = s.dx > 0 ? 1 : -1;
    if (s.tut) { c.k.tut = 1; c.face = s.sp === 'mossback' ? -1 : 1; }
    w.creatures.push(c);
  }
  return w;
}

export const sx = (w, c) => c.x - w.S * c.p;
export function boxOf(w, c, S = w.S) {
  const b = SPECIES[c.sp].box(c); if (!b) return null;
  const p = c.p; let [x0, y0, x1, y1] = b;
  if (c.face < 0) [x0, x1] = [-x1, -x0];
  const X = c.x - S * p;
  return [X + x0 * p, c.y + y0 * p, X + x1 * p, c.y + y1 * p];
}
function isActive(w, c) { const X = sx(w, c); return X > -500 && X < w.VW + 500; }
function groundY(w, c) {
  if (c.sp === 'moonmoth') return w.route.water.y + 2;
  return c.homeY;
}

// how well a creature sits in the frame
export function frameStats(F, b) {
  if (!b) return null;
  const bw = b[2] - b[0], bh = b[3] - b[1], ba = bw * bh;
  const ix = Math.max(0, Math.min(b[2], F.x + F.w) - Math.max(b[0], F.x));
  const iy = Math.max(0, Math.min(b[3], F.y + F.h) - Math.max(b[1], F.y));
  const vis = ba > 0 ? (ix * iy) / ba : 0;
  if (vis <= 0) return null;
  const size = Math.min(ba, ix * iy) / (F.w * F.h);
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  const d = Math.hypot(cx - (F.x + F.w / 2), cy - (F.y + F.h / 2)) / Math.hypot(F.w / 2, F.h / 2);
  return { vis, size, cen: clamp(1 - d, 0, 1), cx, cy };
}

export function step(w, dt) {
  if (w.ended) return;
  w.t += dt;
  if (!w.moored) {
    w.S += w.speed * dt;
    if (w.S >= w.trip.length) { w.S = w.trip.length; w.ended = true; }
  }
  for (const k in w.cool) w.cool[k] = Math.max(0, w.cool[k] - dt);
  for (const c of w.creatures) {
    if (!isActive(w, c)) continue;
    c.t += dt; c.bt += dt; c.cd = Math.max(0, c.cd - dt);
    SPECIES[c.sp].think(c, w, dt);
  }
  // fruit
  for (const f of w.fruits) {
    f.t += dt;
    if (f.state === 'air') {
      const u = clamp(f.t / f.dur, 0, 1);
      f.sx = lerp(f.sx0, f.tx, u); f.sy = lerp(f.sy0, f.ty, u) - Math.sin(u * Math.PI) * f.arc;
      if (u >= 1) landFruit(w, f);
    } else if (f.state === 'float') {
      f.x += Math.sin(w.t * 0.7 + f.id) * dt * 3;
      if (f.t > 9) f.state = 'gone';
    } else if (f.state === 'ground' && f.t > 30) f.state = 'gone';
  }
  w.fruits = w.fruits.filter((f) => f.state !== 'gone' && (f.state === 'air' || f.x - w.S * f.p > -300));
  // bubbles: a puff is a few released over a second, drifting where the frame was aimed
  for (const pb of w.pendingBubbles) {
    pb.t -= dt;
    if (pb.t <= 0) {
      w.bubbles.push({ id: w.nextId++, x: w.VW / 2 + (w.r() - 0.5) * 30, y: WORLD_H + 10, tx: pb.tx + (w.r() - 0.5) * 70, ty: pb.ty + (w.r() - 0.5) * 50, t: 0, life: 7.5 + w.r() * 2, r: 7 + w.r() * 7, ph: w.r() * 6 });
      pb.done = true;
    }
  }
  w.pendingBubbles = w.pendingBubbles.filter((p) => !p.done);
  for (const b of w.bubbles) {
    b.t += dt;
    if (b.t < 1.1) { const u = b.t / 1.1, e = 1 - (1 - u) * (1 - u); b.x = lerp(b.x, b.tx, e * 0.25); b.y = lerp(b.y, b.ty, e * 0.25); }
    else { b.x += Math.sin(w.t * 1.3 + b.ph) * dt * 8 - dt * 6; b.y -= dt * (5 + b.r * 0.4); }
    if (b.t > 0.8) for (const c of w.creatures) {
      const sp = SPECIES[c.sp]; if (!sp.bubble || c.cd > 0 || !isActive(w, c)) continue;
      const bx = boxOf(w, c); if (!bx) continue;
      const cx = (bx[0] + bx[2]) / 2, cy = (bx[1] + bx[3]) / 2, rad = 50 + Math.max(bx[2] - bx[0], bx[3] - bx[1]) * 0.45;
      if (Math.hypot(b.x - cx, b.y - cy) < rad) { sp.bubble(c, w, { lx: b.x + w.S * c.p, y: b.y }); c.cd = 1; }
    }
  }
  w.bubbles = w.bubbles.filter((b) => b.t < b.life);
  for (const e of w.fx) {
    e.t += dt;
    if (e.type === 'note') { e.y -= dt * 22; e.x += Math.sin(e.t * 4) * dt * 10; }
    else if (e.type === 'z') { e.y -= dt * 14; e.x += dt * 6; }
  }
  w.fx = w.fx.filter((e) => e.t < e.life);
}

function landFruit(w, f) {
  const tx = f.tx, ty = f.ty;
  // hushbats snatch anything tossed near the roost
  for (const c of w.creatures) {
    if (c.sp !== 'hushbat' || !isActive(w, c)) continue;
    const X = sx(w, c);
    if (Math.abs(X - tx) < 150 && ty < c.homeY + 190) {
      if (SPECIES.hushbat.catchFruit(c, w, f, tx + w.S * c.p, ty)) {
        f.state = 'hover'; f.p = c.p; f.x = tx + w.S * c.p; f.y = ty; f.t = 0; w.sound('whoosh'); return;
      }
    }
  }
  let best = null, bd = Infinity;
  for (const c of w.creatures) {
    const sp = SPECIES[c.sp]; if (!sp.fruit || !isActive(w, c)) continue;
    if (c.sp === 'ferngrazer' && (c.k.out || 0) < 0.3 && c.beh !== 'peeking') { /* hidden, but a fruit by the ferns still tempts it */ }
    const X = sx(w, c), gy = groundY(w, c);
    const dx = Math.abs(X - tx), dy = Math.abs(gy - ty);
    if (dx > 170 || dy > 210) continue;
    const d = dx + dy * 0.5;
    if (d < bd) { bd = d; best = c; }
  }
  if (best) {
    const p = best.p; f.p = p; f.x = tx + w.S * p; f.y = groundY(w, best); f.state = 'ground'; f.t = 0;
    w.sound('thud');
    for (const c of w.creatures) {
      const sp = SPECIES[c.sp]; if (!sp.fruit || c.p !== p || !isActive(w, c)) continue;
      if (Math.abs(c.x - f.x) < 230) sp.fruit(c, f, w);
    }
    return;
  }
  f.p = 1; f.x = tx + w.S; f.y = clamp(Math.max(ty, w.route.water.y + 24), 0, WORLD_H - 14); f.state = 'float'; f.t = 0;
  w.fx.push({ type: 'splash', x: f.x, y: f.y, p: 1, t: 0, life: 1, s: 1 });
  w.sound('plop');
}

export function frameCenter(w) { return [w.frame.x + w.frame.w / 2, w.frame.y + w.frame.h / 2]; }

export function throwFruit(w) {
  if (w.cool.fruit > 0) return false;
  const [tx, ty] = frameCenter(w);
  w.fruits.push({ id: w.nextId++, state: 'air', t: 0, dur: 0.8, sx0: w.VW / 2, sy0: WORLD_H + 30, tx, ty, sx: w.VW / 2, sy: WORLD_H + 30, arc: 120, x: 0, y: 0, p: 1, bites: 0, owner: null });
  w.cool.fruit = 1.2; w.sound('throw');
  return true;
}
export function inFrame(w, min = 0.6) {
  return w.creatures.filter((c) => { if (!isActive(w, c)) return false; const s = frameStats(w.frame, boxOf(w, c)); return s && s.vis >= min; });
}
export function whistle(w) {
  if (w.cool.whistle > 0) return false;
  w.cool.whistle = 2.4; w.sound('whistle');
  const [fx, fy] = frameCenter(w);
  const ev = { x: fx, y: fy, inFrame: inFrame(w) };
  w.fx.push({ type: 'call', x: fx, y: fy, p: 0, t: 0, life: 1.2, s: 1 });
  for (const c of w.creatures) {
    const sp = SPECIES[c.sp]; if (!sp.whistle || !isActive(w, c)) continue;
    const b = boxOf(w, c) || [sx(w, c) - 10, c.y - 30, sx(w, c) + 10, c.y];
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    if (Math.hypot(cx - fx, (cy - fy) * 0.8) < 300) sp.whistle(c, w, ev);
  }
  return true;
}
export function blowBubbles(w) {
  if (w.cool.bubbles > 0) return false;
  w.cool.bubbles = 3.5; w.sound('bubbles');
  const [tx, ty] = frameCenter(w);
  for (let i = 0; i < 7; i++) w.pendingBubbles.push({ t: i * 0.14, tx, ty });
  return true;
}

// a recorded frame: just enough to redraw the shot, plus how each creature sat in it
export function snapshot(w, frame) {
  const F = { ...(frame || w.frame) };
  const cr = [], sc = [];
  for (const c of w.creatures) {
    const X = sx(w, c); if (X < -260 || X > w.VW + 260) continue;
    cr.push({ id: c.id, sp: c.sp, x: c.x, y: c.y, p: c.p, face: c.face, beh: c.beh, bt: c.bt, dur: c.dur, ph: c.ph, t: c.t, moving: c.moving, k: { ...c.k }, tgt: c.tgt ? { bites: c.tgt.bites } : null });
    const st = frameStats(F, boxOf(w, c));
    if (st) sc.push({ id: c.id, sp: c.sp, beh: c.beh, ...st });
  }
  return {
    S: w.S, t: w.t, F, cr, sc,
    fr: w.fruits.map((f) => ({ ownerSp: f.ownerSp, state: f.state, sx: f.sx, sy: f.sy, x: f.x, y: f.y, p: f.p, bites: f.bites, t: f.t, id: f.id })),
    bu: w.bubbles.map((b) => ({ x: b.x, y: b.y, r: b.r, t: b.t, life: b.life })),
    fx: w.fx.filter((e) => e.type !== 'call').map((e) => ({ ...e })),
  };
}
