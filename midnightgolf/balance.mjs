// node balance.mjs [errDeg] [games]  — plays every hole with the bot
import { HOLES } from './holes.js';
import { Game } from './game.js';
import { distField, choose } from './bot.js';
const err = (+process.argv[2] || 0) * Math.PI / 180, games = +process.argv[3] || 1;
const pErr = +process.argv[4] || 0;
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const only = process.env.HOLE ? [+process.env.HOLE - 1] : HOLES.map((_, i) => i);
for (const hi of only) {
  const h = HOLES[hi];
  const res = [];
  for (let g = 0; g < games; g++) {
    const game = new Game(h, { t0: rnd() * 30 });
    const field = distField(game);
    let caught = 0, log = [];
    while (game.phase !== 'sunk' && game.strokes < 8) {
      let w = 0; while (Math.max(0, ...game.meters) > 15 && w < 10) { game.step(0.25); w += 0.25; }
      const c = choose(game, field, { angles: 96, care: +(process.env.CARE ?? 1) });
      const a = c.a + (rnd() * 2 - 1) * err, p = Math.min(1, c.p * (1 + (rnd() * 2 - 1) * pErr));
      const end = game.simulate(a, p);
      log.push(`${c.p.toFixed(2)}→${end}@${game.ball.x.toFixed(0)},${game.ball.y.toFixed(0)} m${game.meters.map(m=>m.toFixed(0)).join('/')}`);
      if (end === 'caught') { caught++; game.reset(); }
      if (caught > 3) break;
    }
    res.push({ s: game.strokes, caught, peak: Math.round(game.peak), log });
  }
  const avg = res.reduce((a, r) => a + r.s, 0) / res.length;
  console.log(`${hi + 1}. ${h.name} par ${h.par}: avg ${avg.toFixed(2)} caught ${res.reduce((a, r) => a + r.caught, 0)} peak ${res.map(r => r.peak).join(',')}`);
  if (games === 1) console.log('   ' + res[0].log.join('\n   '));
}
