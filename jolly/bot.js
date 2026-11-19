// A player bot: guards the host, rolls out of telegraphs, raises them when they fall, and gestures when it's obvious.
// Used by ?autoplay, ?demo and sim.mjs.
import { D } from './game.js';

export function makeBot(o = {}) {
  return { skill: o.skill ?? 0.85, gestures: o.gestures ?? true, idle: !!o.idle, rnd: o.rnd || Math.random, gcd: 0, react: 0, rollCd: 0, tgt: null, lastAtk: 0, holdRaise: false, stats: { gest: {} } };
}

export function botInput(g, m, dt) {
  const I = { mx: 0, my: 0, atk: false, atkHeld: false, roll: false, gesture: null };
  const p = g.p, h = g.h;
  if (p.dead) return I;
  m.gcd -= dt; m.rollCd -= dt; m.react -= dt;
  const hostUp = g.hostUp();
  const gest = (name) => { if (m.gcd > 0 || !m.gestures) return false; I.gesture = name; m.gcd = 1.6; m.stats.gest[name] = (m.stats.gest[name] || 0) + 1; return true; };
  const goto = (x, y, tol = 4) => { [x, y] = g.route(p, x, y); const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy); if (d > tol) { I.mx = dx / Math.max(d, 1); I.my = dy / Math.max(d, 1); } return d <= tol; };

  if (m.idle) { // follows the host about, never fights or helps
    if (h.present) { const tx = h.x - 120, ty = h.y > D / 2 ? 10 : D - 10; if (Math.abs(tx - p.x) > 30) goto(tx, ty, 6); }
    return I;
  }
  // 1. raise the host
  if (h.present && (h.state === 'downed' || h.state === 'hanging')) {
    const d = Math.hypot(h.x - p.x, (h.y - p.y) * 1.2);
    // get out of the way of an attack first
    const th = threat(g, p, 10);
    if (th && m.rollCd <= 0 && m.rnd() < m.skill) return rollAway(g, m, I, th);
    if (d < 44) { I.atkHeld = true; return I; }
    goto(h.x + (p.x < h.x ? -20 : 20), h.y);
    return I;
  }
  // 2. dodge
  const th = threat(g, p, 6);
  if (th && m.rollCd <= 0 && th.tLeft < 0.22 + (1 - m.skill) * 0.1) {
    if (m.rnd() < m.skill) return rollAway(g, m, I, th);
    m.rollCd = 0.4;
  }

  // 3. gestures
  if (m.gestures && hostUp && m.gcd <= 0 && m.react <= 0) {
    const o = h.order;
    if (h.state === 'read' && h.readRoll && !o) { if (gest('wait')) return I; }
    if ((h.goal === 'loot' && h.goalLoot?.ambush) && !o) { if (gest('beckon')) return I; }
    if (g.boss && !g.boss.dead && g.boss.atk && g.boss.state === 'wind' && g.zoneHits(g.boss.atk, h, 10) && h.state !== 'roll' && (!o || o.g !== 'wait') && g.boss.atk.tLeft > 0.35) {
      if (g.boss.atk.kind === 'melee' || g.boss.atk.kind === 'lunge') { if (gest('wait')) return I; }
      else if (gest('beckon')) return I;
    }
    if (h.hp < h.max * 0.4 && g.foes.some((f) => !f.dead && f.target === h && Math.abs(f.x - p.x) < 200) && m.rnd() < 0.05) { if (gest('spin')) return I; }
    if (g.t - g.lastKill < 3 && h.bowCd <= g.t && m.rnd() < 0.01) { if (gest('bow')) return I; }
    if (g.phase === 'clearing' && h.spinCd <= g.t) { if (gest('spin')) return I; }
    // a pit nearby and the host is fleeing towards it
    if (h.state === 'walk' && h.hp < h.max * 0.36 && g.def.flee && g.inPit(h.x + Math.sign(h.x - p.x) * 40, h.y, 10)) { if (gest('beckon')) return I; }
  }

  // 4. fight: protect the host first
  const foes = g.foes.filter((f) => !f.dead && f.drop <= 0 && f.def.speed !== 0);
  if (foes.length) {
    let best = null, bs = 1e9;
    for (const f of foes) {
      let s = Math.abs(f.x - p.x) + Math.abs(f.y - p.y) * 2;
      if (f.target === h && hostUp) s *= 0.55;
      if (f.state === 'wind' && f.target === h) s *= 0.5;
      if (f.def.ranged) s *= 0.8;
      if (f === m.tgt) s *= 0.7;
      if (s < bs) { bs = s; best = f; }
    }
    m.tgt = best;
    const f = best;
    const side = Math.sign(p.x - f.x) || 1;
    const big = f.kind === 'boss';
    // stay out of the front of a boss
    const tx = f.x + side * (big ? f.r + 26 : 34), ty = f.y;
    const inRange = Math.abs(p.x - f.x) < (big ? f.r + 44 : 46) && Math.abs(p.y - f.y) < (big ? 22 : 11);
    if (inRange && p.st > 12) {
      I.mx = Math.sign(f.x - p.x) * 0.3;
      if (m.rnd() < 0.5 + m.skill * 0.4) I.atk = true;
    } else goto(tx, ty, 3);
    return I;
  }
  // 5. follow the host
  if (h.present) {
    const tx = h.x - 40, ty = Math.max(8, Math.min(D - 8, h.y + 18));
    if (Math.abs(tx - p.x) > 30 || Math.abs(ty - p.y) > 20) goto(tx, ty, 6);
  } else goto(p.x + 60, 60);
  return I;
}

function threat(g, e, margin) {
  let best = null;
  for (const f of g.foes) {
    if (f.dead || !f.atk || f.state !== 'wind') continue;
    if (g.zoneHits(f.atk, e, margin) && (!best || f.atk.tLeft < best.tLeft)) best = f.atk;
  }
  for (const s of g.shots) if (Math.abs(s.y - e.y) < 13 && (e.x - s.x) * s.vx > 0 && Math.abs(e.x - s.x) < 70) return { owner: { x: s.x, y: s.y }, tLeft: 0.1, kind: 'shot' };
  return best;
}
function rollAway(g, m, I, a) {
  const p = g.p;
  m.rollCd = 0.6;
  I.roll = true;
  // aoe: roll straight out; melee: roll along depth if room, else behind
  const o = a.owner || a;
  if (a.kind === 'aoe') { const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy) || 1; I.mx = dx / d; I.my = dy / d; }
  else if (a.kind === 'multi') { const s = a.spots.find((s) => Math.hypot(p.x - s.x, p.y - s.y) < s.r + 10) || a.spots[0]; const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1; I.mx = dx / d; I.my = dy / d; }
  else { I.my = p.y > D / 2 ? -1 : 1; I.mx = Math.sign(p.x - (o.x ?? p.x)) * 0.4; }
  // never roll into a pit
  if (g.inPit(p.x + I.mx * 90, p.y + I.my * 60, 8)) { I.mx = -I.mx; I.my = -I.my; }
  return I;
}
