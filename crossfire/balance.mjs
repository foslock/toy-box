// Headless CPU-vs-CPU matches: node balance.mjs [games] [cpuA] [cpuB]
import { Game, rng } from './game.js';
import { planFor, CPUS } from './ai.js';
const N = +process.argv[2] || 24, A = process.argv[3] || 'cautious', B = process.argv[4] || 'sneaky', SEED0 = +process.argv[5] || 1;
const out = [];
for (let i = 0; i < N; i++) {
  const seed = SEED0 + i * 977;
  const g = new Game({ seed }), r = rng(seed ^ 0xabc);
  const t0 = performance.now();
  let deaths = {};
  while (g.phase !== 'over' && g.round < 40) {
    g.setPlan(0, planFor(g, 0, CPUS[A], r));
    g.setPlan(1, planFor(g, 1, CPUS[B], r));
    g.beginResolve();
    while (g.phase === 'resolve') g.step();
    for (const e of g.events) if (e.type === 'die') deaths[e.how] = (deaths[e.how] || 0) + 1;
    g.events.length = 0;
  }
  out.push({ seed, shape: g.shape, rounds: g.round, winner: g.winner, hits: g.stats.hits, shots: g.stats.shots, midair: g.stats.midair, deaths, ms: Math.round(performance.now() - t0) });
}
for (const o of out) console.log(JSON.stringify(o));
const rounds = out.map(o => o.rounds).sort((a, b) => a - b);
const wins = [0, 1, 'draw'].map(w => out.filter(o => o.winner === w).length);
const hr = out.reduce((a, o) => [a[0] + o.hits[0] + o.hits[1], a[1] + o.shots[0] + o.shots[1]], [0, 0]);
console.log(`${A} vs ${B}: wins ${wins.join('/')}, rounds p25 ${rounds[N >> 2]} med ${rounds[N >> 1]} p75 ${rounds[(N * 3) >> 2]}, hit rate ${(hr[0] / hr[1] * 100).toFixed(0)}%, midair ${out.reduce((a, o) => a + o.midair, 0)}`);
