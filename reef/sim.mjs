// Headless balance check: a greedy bot plays many seeded games.
//   node reef/sim.mjs [games] [noise]
import { newGame, botMove, place, choose, handSize, SPECIES, rngOf, ORDER } from './game.js';

const games = +process.argv[2] || 40, noise = +(process.argv[3] || 0);
const rows = [];
for (let i = 0; i < games; i++) {
  const g = newGame(1000 + i), brng = rngOf(77 + i);
  let bleached = 0, guard = 0;
  while (!g.over && guard++ < 400) {
    if (g.choice) { choose(g, brng() < 0.5 ? 0 : 1); continue; }
    const m = botMove(g, brng, noise);
    if (!m) break;
    const ev = place(g, m.key, m.kind);
    bleached += ev.bleached.length;
  }
  const filled = [...g.tiles.values()].filter(t => t.piece).length;
  rows.push({ score: g.score, packs: g.packN, placed: g.placed, tiles: g.tiles.size, filled, species: Object.keys(g.species).length, bleached, sp: Object.keys(g.species) });
}
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
for (const f of ['score', 'packs', 'placed', 'tiles', 'filled', 'species', 'bleached']) {
  const a = rows.map(r => r[f]);
  console.log(f.padEnd(9), 'p10', q(a, .1), 'p50', q(a, .5), 'p90', q(a, .9));
}
const cnt = {};
rows.forEach(r => r.sp.forEach(s => cnt[s] = (cnt[s] || 0) + 1));
console.log(SPECIES.map(s => `${s.id}:${cnt[s.id] || 0}`).join(' '));
