// The CPU: tries a few spots it could walk to, fires hundreds of imaginary shots from each, keeps the best,
// then fumbles it a little so it plays believably rather than perfectly.
import { simulate, WEAPONS, TROOP_R } from './world.js';
import { overlap, WALK } from './game.js';

export function scoreBoom(game, kind, r, shooter, from) {
  if (r.ev !== 'boom') return r.ev === 'stray' ? -6 : -3;
  const W = WEAPONS[kind], reach = W.R * 1.7;
  let s = 0, near = Infinity;
  for (const t of game.troops) {
    if (t.dead) continue;
    const tx = t === shooter ? from.x : t.x, ty = t === shooter ? from.y : t.y;
    const d = Math.max(0, Math.hypot(tx - r.x, ty - r.y) - TROOP_R);
    if (t.team !== shooter.team && t.team !== 2) near = Math.min(near, d);
    if (d > reach) continue;
    const f = 1 - d / reach, dmg = W.dmg * (0.25 + 0.75 * f);
    if (t.team === shooter.team) s -= 1.6 * dmg + (dmg >= t.hp ? 40 : 0);
    else s += dmg + (dmg >= t.hp ? 25 : 0) + f * 6;
  }
  if (s === 0) s = -Math.min(near, 400) / 100;     // a near miss beats a wild one
  return s;
}

function* search(game, shooter, from, kinds, angs, pows, out) {
  const w = game.world;
  let n = 0;
  for (const kind of kinds) for (const ang of angs) for (const pow of pows) {
    const v = game.launchVel(kind, ang, pow);
    const mx = from.x + Math.cos(ang) * (TROOP_R + 4), my = from.y + Math.sin(ang) * (TROOP_R + 4);
    const saved = [shooter.x, shooter.y]; shooter.x = from.x; shooter.y = from.y;
    const r = simulate(w, kind, mx, my, v.vx, v.vy, shooter, game.troops, kind === 'grenade' ? 3.05 : 6);
    shooter.x = saved[0]; shooter.y = saved[1];
    const sc = scoreBoom(game, kind, r, shooter, from);
    if (sc > out.score) Object.assign(out, { score: sc, kind, ang, pow, from, hit: r });
    if (++n % 40 === 0) yield;
  }
}

// A generator: step it until done (yields every few dozen simulations so the page stays smooth).
export function* plan(game, skill = 1) {
  const t = game.cur, w = game.world;
  const kinds = ['shell', 'grenade'];
  if (game.ammoOf('drill') > 0) kinds.push('drill');
  // where could we walk to?
  const spots = [{ x: t.x, y: t.y, walk: 0 }];
  for (const dir of [-1, 1]) {
    const ghost = { x: t.x, y: t.y };
    let went = 0;
    for (let s = 0; s < WALK; s += 4) {
      if (!ghostWalk(w, ghost, dir * 4)) break;
      went += 4;
      if (went === 40 || went === WALK) spots.push({ x: ghost.x, y: ghost.y, walk: dir * went });
    }
  }
  const coarseA = [], coarseP = [0.25, 0.37, 0.5, 0.62, 0.74, 0.87, 1];
  for (let i = 0; i < 40; i++) coarseA.push(i / 40 * Math.PI * 2);
  const best = { score: -Infinity };
  for (const sp of spots) {
    const b = { score: -Infinity };
    yield* search(game, t, sp, kinds, coarseA, coarseP, b);
    b.score -= Math.abs(sp.walk) * 0.02;          // mild preference for staying put
    if (b.score > best.score) Object.assign(best, b, { walk: sp.walk });
  }
  // refine around the winner
  const fa = [], fp = [];
  for (let i = -5; i <= 5; i++) fa.push(best.ang + i * 0.016);
  for (let i = -4; i <= 4; i++) fp.push(Math.min(1, Math.max(0.05, best.pow + i * 0.02)));
  const fine = { score: -Infinity };
  yield* search(game, t, best.from, [best.kind], fa, fp, fine);
  if (fine.score > best.score) Object.assign(best, fine);
  // the fumble
  const gauss = () => (game.rand() + game.rand() + game.rand() - 1.5) * 1.4;
  best.ang += gauss() * 0.04 / skill;
  best.pow = Math.min(1, Math.max(0.05, best.pow * (1 + gauss() * 0.035 / skill)));
  return best;
}

function ghostWalk(w, g, s) {
  const u = w.up(g.x, g.y), tx = -u.y, ty = u.x;
  let x = g.x + tx * s, y = g.y + ty * s, c = 0;
  while (overlap(w, x, y) && c < 5) { x += u.x * 0.5; y += u.y * 0.5; c += 0.5; }
  if (overlap(w, x, y)) return false;
  const u2 = w.up(x, y);
  let k = 0;
  for (; k < 10; k++) { const sx = x - u2.x * 0.5, sy = y - u2.y * 0.5; if (overlap(w, sx, sy)) break; x = sx; y = sy; }
  if (k === 10) return false;                       // walked off a ledge: don't plan around that
  g.x = x; g.y = y;
  return true;
}
