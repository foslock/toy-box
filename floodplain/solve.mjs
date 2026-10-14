// Checks the valleys: what happens if you do nothing, and the best result a full search can find.
//   node floodplain/solve.mjs          → every level
//   node floodplain/solve.mjs 3 5      → just these (1-based)
import { Game } from './game.js';
import { LEVELS } from './levels.js';

const TOOLS = ['gate', 'dig', 'rain', 'freeze'];

function options(g) {
  const out = [];
  for (const tool of TOOLS) {
    if (!(tool in g.charges)) continue;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.canUse(tool, x, y)) out.push([tool, x, y]);
  }
  return out;
}

// All distinct positions reachable this turn (by state key), with the moves that got there.
function turnStates(g) {
  const seen = new Map([[g.key(), { g, moves: [] }]]);
  let frontier = [{ g, moves: [] }];
  while (frontier.length) {
    const next = [];
    for (const s of frontier) for (const o of options(s.g)) {
      const c = s.g.clone(); c.use(...o);
      const k = c.key(); if (seen.has(k)) continue;
      const v = { g: c, moves: [...s.moves, o] }; seen.set(k, v); next.push(v);
    }
    frontier = next;
  }
  return [...seen.values()];
}

function solveFrom(g0, limitMs) {
  const t0 = Date.now(); let best = -1; const memo = new Set();
  (function rec(g) {
    if (best === g.houses0 || Date.now() - t0 > limitMs) return;
    for (const s of turnStates(g).sort((a, b) => a.g.alive().length - b.g.alive().length)) {
      const c = s.g.clone(); if (!c.over) c.endTurn();
      const h = c.housesLeft(); if (h < g.houses0) continue;
      if (c.over) { if (c.over === 'won') best = Math.max(best, h); if (best === g.houses0) return; continue; }
      const k = c.key(); if (memo.has(k)) continue; memo.add(k);
      rec(c); if (best === g.houses0) return;
    }
  })(g0);
  return best;
}

function solve(level, limitMs = 20000) {
  const t0 = Date.now();
  let best = { houses: -1, line: null }, nodes = 0, firstTurnWins = 0;
  const memo = new Map();
  function rec(g, line, depth) {
    if (Date.now() - t0 > limitMs) return;
    nodes++;
    const states = turnStates(g);
    // try the ones that kill raiders first
    states.sort((a, b) => a.g.alive().length - b.g.alive().length);
    for (const s of states) {
      const c = s.g.clone();
      if (!c.over) c.endTurn();
      const houses = c.housesLeft();
      const l = [...line, s.moves];
      if (c.over) {
        if (c.over === 'won' && houses > best.houses) best = { houses, line: l };
        if (depth === 0 && c.over === 'won' && houses === c.houses0) firstTurnWins++;
        if (best.houses === g.houses0 && depth > 0) return;
        continue;
      }
      if (houses <= best.houses) continue;
      const k = c.key();
      if (memo.has(k) && memo.get(k) >= houses) continue;
      memo.set(k, houses);
      rec(c, l, depth + 1);
      if (best.houses === g.houses0 && depth > 0) return;
    }
  }
  const g = new Game(level);
  rec(g, [], 0);
  return { ...best, nodes, ms: Date.now() - t0, timedOut: Date.now() - t0 > limitMs };
}

const JSONOUT = process.argv.includes('--json');
const pick = process.argv.slice(2).filter(a => !a.startsWith('--')).map(Number);
if (JSONOUT) {
  const out = LEVELS.map((lv, i) => (!pick.length || pick.includes(i + 1)) ? solve(lv).line : null);
  console.log(JSON.stringify(out));
  process.exit(0);
}
LEVELS.forEach((lv, i) => {
  if (pick.length && !pick.includes(i + 1)) return;
  const idle = new Game(lv); while (!idle.over) idle.endTurn();
  const first = turnStates(new Game(lv)).length;
  const r = solve(lv);
  // how tight is it: of the distinct first turns, how many still lead to a perfect valley?
  let good = 0;
  if (r.houses === new Game(lv).houses0 && first < 3000) for (const s of turnStates(new Game(lv))) {
    const c = s.g.clone(); c.endTurn();
    if (c.housesLeft() < c.houses0) continue;
    if (c.over === 'won') { good++; continue; }
    const sub = { ...lv }; // solve from here
    const rr = solveFrom(c, 3000); if (rr === c.houses0) good++;
  }
  const total = new Game(lv).houses0;
  console.log(`${String(i + 1).padStart(2)} ${lv.name.padEnd(18)} idle: ${idle.over} ${idle.housesLeft()}/${total}  best: ${r.houses}/${total}  ` +
    `turn-1 positions: ${first} (perfect from ${good})  ${r.ms}ms${r.timedOut ? ' (timed out)' : ''}`);
  if (r.line) console.log('    ' + r.line.map((t, n) => `T${n + 1}: ` + (t.length ? t.map(m => m.join(' ')).join(', ') : 'wait')).join(' | '));
});
