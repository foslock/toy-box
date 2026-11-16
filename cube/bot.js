// A playtest bot for ?debug: follows the solver's route through the real game,
// walking room to room, swatting beetles, picking up keys on the way.
//   const b = await import('./bot.js'); b.run(cube, 600)
import * as M from './game.js';

const { RS, MID, DX, DY, DOOR_TILE } = M;

// rooms reachable from `from`, with how to step between them
export function roomRoute(st, from, to) {
  const prev = new Map([[from, null]]), q = [from];
  while (q.length) {
    const a = q.shift();
    if (a === to) break;
    for (let s = 0; s < 4; s++) { const d = M.doorway(st, a, s); if (d.kind === 'open' && !prev.has(d.to)) { prev.set(d.to, { a, s }); q.push(d.to); } }
    for (const dir of [1, -1]) { const l = M.ladder(st, a, dir); if (l.kind === 'open' && !prev.has(l.to)) { prev.set(l.to, { a, dir }); q.push(l.to); } }
  }
  if (!prev.has(to)) return null;
  const out = [];
  for (let b = to; prev.get(b); b = prev.get(b).a) out.push(prev.get(b));
  return out.reverse();
}

export function makeBot(cube) {
  const plan = { goal: null, log: [] };
  // one decision each time the game is idle
  function act() {
    const G = cube.G, st = G.st, p = G.p;
    if (G.anim || p.moving || p.path.length || p.exitDir >= 0 || G.won || p.bumpT > 0) return;
    // swat an adjacent beetle
    for (const b of G.beetles) {
      const d = [0, 1, 2, 3].find(s => p.c + DX[s] === b.c && p.r + DY[s] === b.r);
      if (d != null) { p.face = d; cube.use(); return; }
    }
    const comp = M.reach(st, p.room);
    // free things first: keys, the gold
    let target = null;
    for (const id of [...comp].sort((a, b) => a - b)) { const r = st.rooms[id]; if (!target && r.key && !(st.keysTaken >> id & 1)) target = { room: id, tile: M.featTile(st, id, M.KEY) }; }
    const tId = st.rooms.find(r => r.treasure).id;
    if (!target && !st.treasure && comp.has(tId)) target = { room: tId, tile: [MID, MID] };
    if (!target) {
      if (st.treasure && comp.has(st.entry) && M.ladder(st, st.entry, 1).kind === 'sky') target = { room: st.entry, tile: [MID, MID], climb: 1 };
      else {
        // commit to one plan until the vault changes: ties between equal routes would flip-flop
        const sig = `${st.turns}|${st.unlocked}|${st.keys}|${st.keysTaken}|${st.treasure}`;
        if (plan.sig !== sig) {
          const r = cube.solveFrom(st, p.room, 400000);
          if (!r.ok) { plan.log.push('no route'); plan.stuck = true; return; }
          plan.sig = sig; plan.move = r.route[0];
        }
        const m = plan.move;
        if (m.unlock != null) {
          const rm = st.rooms[m.unlock];
          const ws = M.worldSide(st, m.unlock, rm.lock);
          if (comp.has(m.unlock)) target = { room: m.unlock, tile: DOOR_TILE[ws], unlock: true };
          else { const [x, y, z] = M.ppos(st.pos[m.unlock]); const nb = st.at[M.pidx(x + DX[ws], y + DY[ws], z)]; target = { room: nb, tile: DOOR_TILE[(ws + 2) & 3], unlockOut: (ws + 2) & 3 }; }
        } else target = { room: m.dial, tile: M.featTile(st, m.dial, M.DIAL), turn: m.dir };
      }
    }
    if (p.room !== target.room) {
      const route = roomRoute(st, p.room, target.room);
      if (!route) { plan.log.push('cannot reach room'); plan.stuck = true; return; }
      const hop = route[0];
      if (hop.s != null) { cube.tapRoom(...DOOR_TILE[hop.s]); return; }
      if (p.c === MID && p.r === MID) { cube.use(); return; }
      cube.tapRoom(MID, MID); return;
    }
    const [tc, tr] = target.tile;
    if (target.unlock) { cube.tapRoom(tc, tr); return; }
    if (p.c !== tc || p.r !== tr) { cube.tapRoom(tc, tr); return; }
    if (target.unlockOut != null) { cube.stepDir(target.unlockOut); return; }
    if (target.turn) { cube.turn(target.turn); plan.log.push('turn'); return; }
    if (target.climb) { cube.use(); return; }
  }
  return { act, plan };
}

// play until won or out of time; returns a summary
export function run(cube, seconds = 600, dt = 1 / 30) {
  const bot = makeBot(cube);
  let t = 0, nips = 0;
  const G0 = cube.G;
  for (; t < seconds && !cube.G.won && !bot.plan.stuck; t += dt) {
    const hurtBefore = cube.G.p.hurt;
    bot.act();
    cube.ff(dt, dt);
    if (cube.G.p.hurt > hurtBefore + 0.5) nips++;
  }
  return { won: cube.G.won, t: Math.round(t), turns: cube.G.st.turns, par: G0.vault.par, nips, stuck: !!bot.plan.stuck, log: bot.plan.log.slice(-3) };
}
