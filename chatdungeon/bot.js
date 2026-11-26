// A bot that plays: used by ?demo, ?autoplay and the Node balance sims.
import { T, COLS, ROWS, W } from './game.js';

const hyp = Math.hypot;

function field(g, tx, ty) {
  const c0 = Math.floor(tx / T), r0 = Math.floor(ty / T);
  const D = new Int16Array(COLS * ROWS).fill(-1);
  const q = [];
  if (c0 >= 0 && r0 >= 0 && c0 < COLS && r0 < ROWS) { D[r0 * COLS + c0] = 0; q.push(r0 * COLS + c0); }
  for (let i = 0; i < q.length; i++) {
    const k = q[i], c = k % COLS, r = (k / COLS) | 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
      const kk = rr * COLS + cc;
      if (D[kk] >= 0 || (g.solidAt(cc, rr) && !(rr === r0 && cc === c0))) continue;
      D[kk] = D[k] + 1; q.push(kk);
    }
  }
  return D;
}

function steer(g, tx, ty) {
  const p = g.p;
  if (g.los(p.x, p.y, tx, ty)) { const d = hyp(tx - p.x, ty - p.y) || 1; return [(tx - p.x) / d, (ty - p.y) / d]; }
  const D = field(g, tx, ty);
  const c = Math.floor(p.x / T), r = Math.floor(p.y / T);
  let best = null, bd = 1e9;
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const v = D[(r + dr) * COLS + c + dc];
    if (v >= 0 && v < bd) { bd = v; best = [c + dc, r + dr]; }
  }
  if (!best) { const d = hyp(tx - p.x, ty - p.y) || 1; return [(tx - p.x) / d, (ty - p.y) / d]; }
  const x = (best[0] + 0.5) * T, y = (best[1] + 0.5) * T, d = hyp(x - p.x, y - p.y) || 1;
  return [(x - p.x) / d, (y - p.y) / d];
}

// skill: 1 = sharp, lower = slower to react and sloppier
export function botInput(g, mem = {}, skill = 1) {
  const rand = mem.rand || Math.random;
  // a sloppier player reacts late: hold the last decision for a few frames
  if (skill < 1) {
    mem.hold = (mem.hold || 0) - 1;
    if (mem.hold > 0 && mem.last) { const l = mem.last; return { ...l, dash: false, attack: l.attack && rand() < 0.6 }; }
    mem.hold = 1 + Math.round((1 - skill) * 22 * (0.5 + rand()));
    mem.last = think(g, mem, skill, rand);
    return mem.last;
  }
  return think(g, mem, skill, rand);
}

function think(g, mem, skill, rand) {
  const p = g.p, rm = g.room;
  let mx = 0, my = 0, attack = false, dash = false;
  mem.react = (mem.react || 0) - 1 / 60;
  const foes = g.ents.filter(e => e.kind !== 'dummy');
  let tgt = null, td = 1e9;
  for (const e of foes) { const d = hyp(e.x - p.x, e.y - p.y) - e.r; if (d < td) { td = d; tgt = e; } }
  const sees = rand() < skill;
  if (tgt) {
    const boss = tgt.kind === 'boss';
    const want = boss ? 30 : 28;
    if (td > want) [mx, my] = steer(g, tgt.x, tgt.y);
    else { const a = Math.atan2(tgt.y - p.y, tgt.x - p.x) + Math.PI / 2; mx = Math.cos(a) * 0.4; my = Math.sin(a) * 0.4; }
    if (td < 40) attack = true;
    if (boss && sees) {
      if (tgt.st === 'slamWind' && td < 140) { const a = Math.atan2(p.y - tgt.y, p.x - tgt.x); mx = Math.cos(a); my = Math.sin(a); attack = false; if (tgt.st2 < 0.3 && td < 100) dash = true; }
      if (tgt.st === 'chargeWind' || tgt.st === 'charge') { mx = -tgt.ay; my = tgt.ax; const s = (p.x - tgt.x) * -tgt.ay + (p.y - tgt.y) * tgt.ax; if (s < 0) { mx = -mx; my = -my; } attack = false; if (tgt.st === 'charge' && td < 70) dash = true; }
      if (tgt.st === 'dizzy') { [mx, my] = steer(g, tgt.x, tgt.y); attack = td < 40; }
      if (tgt.st === 'walk' && td < 60 && rand() < 0.5) { const a = Math.atan2(p.y - tgt.y, p.x - tgt.x); mx = Math.cos(a); my = Math.sin(a); }
    }
  } else {
    let goal = null;
    const pk = g.pickups[0];
    if (pk) goal = [pk.x, pk.y];
    else if (rm.chest && !rm.chest.open) goal = [rm.chest.x, rm.chest.y];
    else if (rm.shrine && !rm.shrine.used && p.hp < p.max) goal = [rm.shrine.x, rm.shrine.y];
    else if (rm.phase === 'open' || rm.phase === 'vote') {
      const i = rm.phase === 'open' ? (rm.next === 'fork' ? rm.choice : 0) : -1;
      if (i >= 0 && g.doorOpen(i)) goal = [(rm.doors[i].c0 + 1) * T, -10];
      else goal = [W / 2, T * 2.6];
    }
    if (goal) {
      const d = hyp(goal[0] - p.x, goal[1] - p.y);
      if (d > 6) [mx, my] = steer(g, goal[0], Math.max(goal[1], T * 0.5));
      if (goal[1] < 0 && p.y < T * 1.6) { mx = (goal[0] - p.x) / 30; my = -1; }
    }
  }
  if (sees) {
    // goblin lunges: sidestep
    for (const e of foes) {
      const d = hyp(e.x - p.x, e.y - p.y);
      if (e.kind === 'goblin' && (e.st === 'wind' && e.st2 < 0.25 || e.st === 'lunge') && d < 90) {
        mx = -e.ay; my = e.ax; if ((p.x - e.x) * -e.ay + (p.y - e.y) * e.ax < 0) { mx = -mx; my = -my; }
        if (d < 55 && skill > 0.6) dash = true;
      }
    }
    // traps arming under me
    for (const t of g.traps) {
      if (t.t > 0 && t.t < 0.9 && hyp(t.x - p.x, t.y - p.y) < t.r + p.r + 6) { const a = Math.atan2(p.y - t.y, p.x - t.x); mx = Math.cos(a); my = Math.sin(a); attack = false; if (t.t < 0.25) dash = true; }
    }
    // incoming shots: swat or sidestep
    for (const s of g.shots) {
      const dx = p.x - s.x, dy = p.y - s.y, d = hyp(dx, dy);
      if (d > 90) continue;
      const toward = (dx * s.vx + dy * s.vy) / (d * hyp(s.vx, s.vy) + 1e-6);
      if (toward > 0.85) {
        if (skill > 0.8 && d < 55 && p.swingCd <= 0) { attack = true; mem.aim = { x: s.x, y: s.y }; }
        else { mx = -s.vy; my = s.vx; const n = hyp(mx, my) || 1; mx /= n; my /= n; }
      }
    }
  }
  const aim = mem.aim; mem.aim = null;
  if (skill < 1 && rand() > skill) { attack = attack && rand() < 0.7; dash = false; }
  return { mx, my, attack, dash, aim: aim || null };
}
