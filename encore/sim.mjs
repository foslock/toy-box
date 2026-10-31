// Headless runs: node encore/sim.mjs [games] [slop] [miss]
// slop = chance per beat of a random move, miss = chance per beat of an off-beat input.
import { Game, FLOORS } from './game.js';
import { choose } from './bot.js';

const N = +(process.argv[2] || 40), SLOP = +(process.argv[3] || .08), MISS = +(process.argv[4] || .05);
const res = [];
for (let i = 0; i < N; i++) {
  const g = new Game({ seed: 1000 + i });
  let beats = 0, floorBeats = [], fb = 0, cause = '', lostBy = {};
  while (beats < 4000) {
    if (g.status === 'down') { floorBeats.push(fb); fb = 0; g.nextFloor(); }
    if (g.status !== 'play') break;
    if (Math.random() < MISS) { g.combo = 0; }
    const a = choose(g, { slop: SLOP });
    g.ev = [];
    g.resolve(g.next, a);
    for (const e of g.ev) if (e.type === 'hurt') {
      const src = g.foes.find(f => f.id === e.src)?.type || '?';
      lostBy[src] = (lostBy[src] || 0) + 1;
      if (e.dead) cause = src;
    }
    beats++; fb++;
  }
  floorBeats.push(fb);
  res.push({ seed: 1000 + i, status: g.status, floor: g.fi + 1, score: g.score, beats, floorBeats, cause, lostBy, inst: g.player.inst.length });
}
const won = res.filter(r => r.status === 'won').length;
const byFloor = {}; for (const r of res) if (r.status === 'dead') byFloor[r.floor] = (byFloor[r.floor] || 0) + 1;
const causes = {}; for (const r of res) if (r.cause) causes[r.cause] = (causes[r.cause] || 0) + 1;
const hurts = {}; for (const r of res) for (const [k, v] of Object.entries(r.lostBy)) hurts[k] = (hurts[k] || 0) + v;
const fbAvg = FLOORS.map((_, i) => { const a = res.map(r => r.floorBeats[i]).filter(v => v != null); return a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : '-'; });
console.log(JSON.stringify({ N, SLOP, won, deathsByFloor: byFloor, causes, hurts, avgBeatsPerFloor: fbAvg, stuck: res.filter(r => r.status === 'play').length }));
