// node popup/sim.mjs : every microgame × difficulty × speed, played by the bot hand.
// Prints win rate and mean real seconds to finish, so too-tight games stand out.
import { ALL } from './games.js';
import { makeGame, step, Hand } from './engine.js';

const only = process.argv[2];
const speeds = [1, 1.3, 1.6, 2.0], ds = [0, 1, 2, 3], N = +process.argv[3] || 30;
for (const def of ALL) {
  if (only && def.id !== only) continue;
  const row = [];
  for (const d of ds) for (const sp of speeds) {
    let wins = 0, tsum = 0, errs = 0;
    for (let s = 1; s <= N; s++) {
      try {
        const g = makeGame(def, { d, speed: sp, seed: s * 7919 + d * 31 });
        const h = new Hand(.3);
        h.wait = .45; // reading the instruction
        let k = 0;
        while (!g.result && k++ < 60 * 30) { h.update(g, 1 / 60); step(g, 1 / 60); }
        if (g.result === 'win') { wins++; tsum += g.rt; }
      } catch (e) { errs++; if (errs === 1) console.error(def.id, d, sp, e.stack.split('\n').slice(0, 3).join(' | ')); }
    }
    row.push(`${Math.round(wins / N * 100)}%${errs ? '!' : ''}/${wins ? (tsum / wins).toFixed(1) : '-'}`);
  }
  console.log(def.id.padEnd(9), row.join(' '));
}
