// Headless check: the bot runs every trial a few times and we print how it went.
//   node comebye/balance.mjs [runs] [courseId]
import { COURSES } from './courses.js';
import { Trial } from './sim.js';
import { botThink } from './bot.js';

const runs = +(process.argv[2] || 6), only = process.argv[3];
for (const c of COURSES) {
  if (only && c.id !== only) continue;
  const rows = [];
  for (let r = 0; r < runs; r++) {
    const tr = new Trial(c, 1000 + r * 17);
    const mem = {};
    let think = 0, stepLog = [];
    while (!tr.done) {
      if ((think -= 1 / 60) <= 0) { botThink(tr, mem); think = 0.2; }
      tr.tick();
      for (const e of tr.events) if (e.t === 'step') stepLog.push(`${e.step.k}@${tr.t.toFixed(0)}`);
      tr.events.length = 0;
    }
    const [s, m] = tr.score();
    rows.push({ result: tr.result, t: tr.t.toFixed(0), score: `${s}/${m}`, phases: c.phases.map(p => `${p}:${tr.scores[p].pts}`).join(' '), last: stepLog.at(-1) });
  }
  console.log(`\n${c.id}`);
  for (const r of rows) console.log(`  ${r.result.padEnd(8)} ${r.t.padStart(4)}s ${r.score.padStart(7)}  ${r.phases}   ${r.last}`);
}
