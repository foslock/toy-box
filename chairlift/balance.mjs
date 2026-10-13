// Headless balance sim: the bot runs each mountain; prints when (and why) the mountain closed.
//   node chairlift/balance.mjs [games=8] [mountain index or all]
import { Game, CFG } from './game.js';
import { MOUNTAINS } from './terrain.js';
import { Bot } from './bot.js';

const N = +(process.argv[2] || 8), which = process.argv[3] ?? 'all';
const ms = which === 'all' ? MOUNTAINS : [MOUNTAINS[+which]];
for (const m of ms) {
  const res = [];
  for (let k = 0; k < N; k++) {
    const g = new Game({ mountain: m, seed: 100 + k }), bot = new Bot(g);
    const dt = 1 / 20; let trace = [];
    while (!g.over && g.t < 1800) {
      bot.tick(dt); g.step(dt);
      for (const ev of g.events) if (ev.type === 'dayEnd') g.take(bot.pick(g.offer()));
      g.events.length = 0;
      if (Math.abs(g.t % 60) < dt) trace.push(`${Math.round(g.t)}s:${g.served}/${g.lodges().length}L/${[...g.edges.values()].filter(e => e.type === 'lift').length}l/${g.skiers.length}`);
    }
    const why = g.over ? `${g.over.node.kind} ${g.over.node.name || ''} lifts=${g.outEdges(g.over.node).filter(e=>e.type==='lift').length} can=${g.served3(g.over.node).map(v=>v?1:0).join('')}` : 'survived';
    res.push({ t: g.t, served: g.served, day: g.day, why });
    if (process.env.V) console.log(trace.join(' '));
  }
  res.sort((a, b) => a.t - b.t);
  console.log(m.id, 'median', Math.round(res[res.length >> 1].t), 's day', res[res.length >> 1].day, 'served', res.map(r => r.served).join(','));
  for (const r of res) console.log('   ', Math.round(r.t), r.served, r.why);
}
