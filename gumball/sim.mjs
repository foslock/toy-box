// Headless balance check: a bot plays whole runs and prints how far it got.
//   node gumball/sim.mjs [runs=24] [seed=1] [--nudge]
import { Game, RENTS } from './game.js';
import { KINDS } from './symbols.js';
import { botPick, botNudge } from './bot.js';

const args = process.argv.slice(2);
const runs = +(args.find((a) => /^\d+$/.test(a)) || 24);
const seed0 = +(args.filter((a) => /^\d+$/.test(a))[1] || 1);
const NUDGE = args.includes('--nudge');
const V = args.includes('-v');

function settle(g, max = 6) {
  let t = 0;
  while (t < max) { g.tick(1 / 60); t += 1 / 60; if (g.settled) break; }
  return t;
}

const results = [];
for (let r = 0; r < runs; r++) {
  const g = new Game(seed0 + r * 7919);
  let maxSettle = 0, perCrank = [];
  while (true) {
    g.startCrank();
    maxSettle = Math.max(maxSettle, settle(g));
    if (NUDGE) for (let k = 0; k < 3; k++) { if (!botNudge(g)) break; settle(g); }
    const res = g.collect();
    perCrank.push(res.total);
    g.take(botPick(g, g.offers()));
    if (g.rentDue) {
      if (!g.payRent()) break;
      if (g.rentIdx >= RENTS.length) break;
    }
    g.next();
  }
  const kinds = {};
  for (const it of g.items) kinds[it.kind] = (kinds[it.kind] || 0) + 1;
  results.push({ rents: g.rentIdx, crank: g.crank, earned: g.earned, maxSettle: +maxSettle.toFixed(2) });
  if (V) console.log(g.rentIdx, g.crank, perCrank.join(','), JSON.stringify(kinds));
}
const hist = {};
for (const x of results) hist[x.rents] = (hist[x.rents] || 0) + 1;
console.log('rents paid histogram', hist);
console.log('median cranks', results.map((x) => x.crank).sort((a, b) => a - b)[results.length >> 1]);
console.log('max settle', Math.max(...results.map((x) => x.maxSettle)));
