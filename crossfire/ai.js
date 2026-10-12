// Crossfire: the CPU general. It plans blind, like you: it sees where everyone stands now, not what you're about to do.
import { MOVE_RANGE, HEAD_Y, BODY_R, WEAPONS, W, clamp } from './game.js';

export const CPUS = {
  cautious: { id: 'cautious', name: 'Col. Pomfrey', tag: 'cautious', blurb: 'Ducks behind hills. Hides in a bubble when hurt.',
    aim: .05, pow: .04, lead: .25, shield: .55, mortar: .12, grenade: .15, move: 'cover' },
  reckless: { id: 'reckless', name: 'Rita Ruckus', tag: 'reckless', blurb: 'Charges in and lobs grenades. Never leads a target.',
    aim: .06, pow: .045, lead: 0, shield: 0, mortar: .08, grenade: .45, move: 'advance' },
  sneaky: { id: 'sneaky', name: 'Sid the Fox', tag: 'sneaky', blurb: 'Guesses where you\'ll run. Loves a mortar.',
    aim: .05, pow: .04, lead: .7, shield: .2, mortar: .45, grenade: .2, move: 'random' },
};

function gauss(r) { return (r() + r() + r() - 1.5) * 1.15; }

export function planFor(game, team, cpu, r, opts = {}) {
  const me = game.active(team);
  if (!me) return { skip: true };
  const foes = game.alive(1 - team), friends = game.alive(team).filter(s => s !== me);
  const foeActive = game.active(1 - team);
  const ammo = game.teams[team].ammo;
  const incoming = game.mortars.filter(m => m.due === game.round);

  // ---- where to stand
  let best = null;
  const foeX = foes.reduce((a, s) => a + s.x, 0) / (foes.length || 1);
  for (let dx = -MOVE_RANGE; dx <= MOVE_RANGE; dx += 16) {
    const g = game.walkPreview(me, me.x + dx);
    let score = r() * 14;
    if (g.fell) score -= 60;
    if (g.y > game.water - 40) score -= 120;
    for (const m of incoming) if (Math.abs(m.x - g.x) < 70) score -= 90;
    for (const f of friends) if (Math.hypot(f.x - g.x, f.y - g.y) < 34) score -= 30;
    const moved = Math.abs(g.x - me.x);
    if (opts.stay) score -= moved;
    else if (cpu.move === 'cover') score += Math.min(moved, 50) * .5 + Math.abs(g.x - foeX) * .08 + (g.y - me.y) * .25;
    else if (cpu.move === 'advance') score += Math.min(moved, 50) * .2 - Math.abs(g.x - foeX) * .1;
    else score += Math.min(moved, 60) * .4;
    if (!best || score > best.score) best = { score, x: g.x, y: g.y, tx: me.x + dx };
  }
  const pos = best;

  // ---- what to use
  const plan = { moveX: pos.tx, weapon: 'shell', angle: 0, power: .6 };
  const roll = r();
  if (!opts.shellOnly && ammo.shield > 0 && me.hp < 60 && roll < cpu.shield * .6) { plan.weapon = 'shield'; return plan; }
  if (!opts.shellOnly && ammo.mortar > 0 && r() < cpu.mortar && foes.length) {
    // a mortar is best on someone who won't be the one moving next round
    const still = foes.filter(f => f !== foeActive);
    const t = (still.length ? still : foes)[(r() * (still.length || foes.length)) | 0];
    plan.weapon = 'mortar';
    plan.targetX = clamp(t.x + gauss(r) * 18, 10, W - 10);
    return plan;
  }
  const kind = !opts.shellOnly && ammo.grenade > 0 && r() < cpu.grenade ? 'grenade' : 'shell';
  plan.weapon = kind;

  // ---- who to hit, and where they'll be
  const target = pickTarget(foes, pos, r);
  let tx = target.x, ty = target.y;
  if (target === foeActive && r() < cpu.lead) {
    const g = game.walkPreview(target, target.x + (r() < .5 ? -1 : 1) * (35 + r() * 45));
    tx = g.x; ty = g.y;
  }
  const aim = solve(game, kind, pos.x, pos.y, tx, ty - HEAD_Y, friends, r);
  if (!aim) { plan.weapon = 'shell'; Object.assign(plan, fallbackAim(pos, tx)); return plan; }
  const noise = opts.perfect ? 0 : 1;
  plan.angle = aim.angle + gauss(r) * cpu.aim * noise;
  plan.power = clamp(aim.power * (1 + gauss(r) * cpu.pow * noise), .08, 1);
  plan.aimAt = { x: tx, y: ty };
  return plan;
}

function pickTarget(foes, pos, r) {
  let best = null;
  for (const f of foes) {
    const s = -Math.abs(f.x - pos.x) * .05 - f.hp * .4 + r() * 25;
    if (!best || s > best.s) best = { s, f };
  }
  return best.f;
}

function fallbackAim(pos, tx) {
  return { angle: tx > pos.x ? Math.PI / 4 : Math.PI * 3 / 4, power: .7 };
}

// Search angle × power for the shot that ends nearest the target.
export function solve(game, kind, x, y, tx, ty, friends, r) {
  const right = tx >= x;
  const cands = [];
  for (let a = 8; a <= 84; a += 3) {
    const ang = (right ? a : 180 - a) * Math.PI / 180;
    for (let p = .2; p <= 1.001; p += .025) {
      const { pts, end } = game.trace(kind, x, y, ang, p, 7, 2);
      if (!end) continue;
      let d = Math.hypot(end.x - tx, end.y - ty);
      if (kind === 'shell') for (const q of pts) d = Math.min(d, Math.hypot(q.x - tx, q.y - ty) < BODY_R + 4 ? 0 : d);
      if (end.wet) d += 30;
      const R = WEAPONS[kind].r * 1.5;
      for (const f of friends) if (Math.hypot(end.x - f.x, end.y - (f.y - HEAD_Y)) < R) d += 120;
      if (Math.hypot(end.x - x, end.y - (y - HEAD_Y)) < R) d += 200;   // don't blow yourself up
      cands.push({ angle: ang, power: p, d });
    }
  }
  if (!cands.length) return null;
  cands.sort((a, b) => a.d - b.d);
  const good = cands.filter(c => c.d <= cands[0].d + 8).slice(0, 12);
  return good[(r() * good.length) | 0];
}
