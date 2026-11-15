// Lantern: an autopilot. Used by ?demo, ?autoplay and sim.mjs for balance runs.
import { WEAPONS, DAY_LEN, FLARE_COST } from './game.js';

const hyp = Math.hypot;
const WIND = { shade: 0.55, dummy: 0.75, hound: 0.45, moth: 0.35, wisp: 0.8, brute: 0.9 };

export function makeBot(opts = {}) {
  return { skill: opts.skill ?? 1, rollCd: 0, stuckT: 0, lastX: 0, lastY: 0, detour: 0, detourT: 0, think: 0, react: opts.react ?? 0.12, rnd: opts.rnd || Math.random, lvl: 0 };
}

export function botInput(g, m, dt) {
  const p = g.p;
  const I = { mx: 0, my: 0, aim: null, attackDown: false, attackPressed: false, heavyPressed: false, heavyDown: false, roll: false, flask: false, flare: false };
  if (p.hp <= 0) return I;
  m.rollCd -= dt; m.detourT -= dt;
  const rnd = m.rnd;
  const W = WEAPONS[p.weapon];
  const all = g.boss ? [...g.foes, g.boss] : g.foes;
  const busy = p.act && p.act.type !== 'charge';

  // ---- dodge
  let dodge = null;
  const consider = (ax, ay, urgency) => { if (!dodge || urgency > dodge.u) dodge = { x: ax, y: ay, u: urgency }; };
  for (const f of g.foes) {
    if (f.dying !== undefined || f.state !== 'wind') continue;
    const d = hyp(p.x - f.x, p.y - f.y), k = f.st / WIND[f.type];
    if (k < 0.55 + 0.2 * (1 - m.skill)) continue;
    if (f.type === 'shade' || f.type === 'dummy') { if (d < 85) consider(-(f.y - p.y), f.x - p.x, k); }
    else if (f.type === 'hound' || f.type === 'moth') { if (d < 170) consider(-(f.y - p.y), f.x - p.x, k); }
    else if (f.type === 'brute' && f.tx != null) { if (hyp(p.x - f.tx, p.y - f.ty) < 70 + p.r + 10) consider(p.x - f.tx, p.y - f.ty, k); }
  }
  const b = g.boss;
  if (b && b.tele && b.tele.k > 0.62) {
    const T = b.tele, d = hyp(p.x - b.x, p.y - b.y);
    if (T.kind === 'arc' && d < T.reach + 30) consider(p.x - b.x, p.y - b.y, 1);
    if (T.kind === 'circle' && hyp(p.x - T.x, p.y - T.y) < T.r + 18) consider(p.x - T.x, p.y - T.y, 1);
    if (T.kind === 'line' && d < T.len + 40) { const a = b.face; const side = Math.sin(Math.atan2(p.y - b.y, p.x - b.x) - a) >= 0 ? 1 : -1; consider(-Math.sin(a) * side, Math.cos(a) * side, T.k); }
  }
  for (const w of g.waves) {
    const d = hyp(p.x - w.x, p.y - w.y), cur = w.cur || w.r0;
    if (!w.hit && d > cur && d - cur < 36) consider(w.x - p.x, w.y - p.y, 2);
  }
  for (const s of g.shots) {
    const rx = p.x - s.x, ry = p.y - s.y, v = hyp(s.vx, s.vy), tt = (rx * s.vx + ry * s.vy) / (v * v);
    if (tt < 0 || tt > 0.3) continue;
    const cx = s.x + s.vx * tt - p.x, cy = s.y + s.vy * tt - p.y;
    if (hyp(cx, cy) < p.r + s.r + 6) consider(-s.vy, s.vx, 0.8);
  }
  if (dodge && m.rollCd <= 0 && p.st > 6 && !busy && rnd() < 0.85 * m.skill + 0.1) {
    const l = hyp(dodge.x, dodge.y) || 1;
    I.mx = dodge.x / l; I.my = dodge.y / l; I.roll = true; m.rollCd = 0.45;
    return I;
  }

  // ---- heal
  const threatNear = all.some(f => f.state === 'wind' && hyp(f.x - p.x, f.y - p.y) < 160) || (b && b.tele);
  if (p.hp < p.maxHp * 0.42 && p.flasks > 0 && !busy && !threatNear) { I.flask = true; }

  // ---- flare when crowded
  const close = g.foes.filter(f => f.lit && !f.dying && hyp(f.x - p.x, f.y - p.y) < 110).length;
  if (close >= 3 && p.oil > 30 && !busy) I.flare = true;
  if (b && b.stagger > 0 && p.oil > 55 && hyp(b.x - p.x, b.y - p.y) < 120 && rnd() < 0.02) I.flare = true;

  // ---- pick a target
  let tgt = null, td = 1e9;
  for (const f of all) {
    if (f.dying !== undefined || f.hp <= 0) continue;
    const d = hyp(f.x - p.x, f.y - p.y);
    if ((f.aggro || f === b || d < 260) && d < td) { td = d; tgt = f; }
  }
  let gx = null, gy = null, want = 0;
  if (tgt) {
    const reach = W.light.reach + tgt.r - 6;
    gx = tgt.x; gy = tgt.y;
    const winding = tgt.state === 'wind' || (tgt === b && b.tele);
    const lowSt = p.st < 18;
    want = lowSt || (winding && tgt !== b) ? reach + 55 : reach * 0.75;
    if (tgt === b && b.tele && b.tele.kind === 'glow') want = reach * 0.6;
    if (tgt.lit && td < reach && !busy && p.st > 12 && !(winding && tgt !== b && tgt.st / (WIND[tgt.type] || 1) > 0.5)) {
      I.aim = Math.atan2(tgt.y - p.y, tgt.x - p.x);
      if ((tgt.stagger > 0.2 || (tgt === b && b.state !== 'move')) && p.st > 40 && rnd() < 0.15) { I.heavyPressed = true; m.heavyHold = 0.45; }
      else I.attackPressed = true;
    }
  } else {
    // camps, chests, jars; then a grace when nothing's left
    let best = null, bd = 1e9;
    for (const c of g.map.camps) {
      if (c.opened) continue;
      const d = hyp(c.x - p.x, c.y - p.y);
      if (d < bd) { bd = d; best = c; }
    }
    for (const j of [...g.map.jars.filter(j => !j.taken), ...g.drops]) { const d = hyp(j.x - p.x, j.y - p.y) * (p.oil < 60 ? 0.5 : 1.4); if (d < bd) { bd = d; best = j; } }
    if (!best) best = g.map.graces[0];
    // go rest and level when it's cheap to
    if (p.runes >= g.levelCost() && !g.tutorial) {
      let gg = null, gd = 1e9; for (const s of g.map.graces) { const d = hyp(s.x - p.x, s.y - p.y); if (d < gd) { gd = d; gg = s; } }
      if (gd < 700) best = gg;
    }
    gx = best.x; gy = best.y; want = 0;
  }
  if (m.heavyHold > 0) { m.heavyHold -= dt; I.heavyDown = true; }

  if (gx != null) {
    const dx = gx - p.x, dy = gy - p.y, d = hyp(dx, dy);
    if (d > want + 6) { I.mx = dx / d; I.my = dy / d; }
    else if (d < want - 20) { I.mx = -dx / d; I.my = -dy / d; }
    else if (tgt) { I.mx = -dy / d * 0.5; I.my = dx / d * 0.5; }
  }
  // unstick
  const moved = hyp(p.x - m.lastX, p.y - m.lastY);
  m.lastX = p.x; m.lastY = p.y;
  if (hyp(I.mx, I.my) > 0.5 && moved < 30 * dt) m.stuckT += dt; else m.stuckT = Math.max(0, m.stuckT - dt);
  if (m.stuckT > 0.5) { m.stuckT = 0; m.detour = (rnd() < 0.5 ? 1 : -1) * (1.2 + rnd() * 0.6); m.detourT = 0.9; }
  if (m.detourT > 0) { const a = Math.atan2(I.my, I.mx) + m.detour; I.mx = Math.cos(a); I.my = Math.sin(a); }
  return I;
}

export function botLevel(g, m) {
  const order = ['vigor', 'vigor', 'strength', 'endurance'];
  while (g.p.runes >= g.levelCost()) { g.levelUp(order[m.lvl % order.length]); m.lvl++; }
}
