// Headless balance runs: node snowball/balance.mjs [mountain|all] [games] [skill]
// Plays each mountain with the autopilot and prints final size against the medals, time, and what got eaten.
import { MOUNTAINS, buildCourse } from './course.js';
import { Run } from './sim.js';
import { makeBot } from './bot.js';

const [which = 'all', games = '4', skill = '1'] = process.argv.slice(2);
const list = which === 'all' ? MOUNTAINS : MOUNTAINS.filter(m => m.id === which);
const DT = 1 / 120;
for (const m of list) {
  const rows = [];
  for (let g = 0; g < +games; g++) {
    const C = buildCourse(m, 1);
    const run = new Run(C);
    const bot = makeBot(+skill, 17 + g * 101);
    let trace = [];
    let lastLog = 0, bumps = 0, lands = 0, maxSp = 0;
    while (!run.done) {
      bot(run, DT);
      run.step(DT);
      for (const e of run.events) { if (e.t === 'bump') bumps++; if (e.t === 'land') lands++; }
      run.events.length = 0;
      maxSp = Math.max(maxSp, run.ball.speed);
      if (run.t - lastLog >= 10) { lastLog = run.t; trace.push(`${run.t.toFixed(0)}s d${run.ball.d.toFixed(0)} ${(run.ball.r * 2).toFixed(2)}m ${run.ball.speed.toFixed(1)}m/s`); }
    }
    rows.push({ snow: run.snowGain * 2, dia: run.maxR * 2, t: run.t, n: run.eatenN, town: run.townEaten / Math.max(1, C.townTotal), bumps, lands, maxSp, medal: run.medal(), trace, count: run.count });
  }
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log(`${m.id.padEnd(8)} medals ${m.medals.join('/')}  dia med ${med(rows.map(r => r.dia)).toFixed(2)} [${rows.map(r => r.dia.toFixed(1)).join(' ')}]  snow ${med(rows.map(r => r.snow)).toFixed(2)}  time ${med(rows.map(r => r.t)).toFixed(0)}s  eaten ${med(rows.map(r => r.n))}  town ${(med(rows.map(r => r.town)) * 100).toFixed(0)}%  bumps ${med(rows.map(r => r.bumps))}  maxSp ${med(rows.map(r => r.maxSp)).toFixed(0)}  medals ${rows.map(r => r.medal).join('')}`);
  if (process.env.TRACE) { console.log('   ' + rows[0].trace.join(' | ')); console.log('   ' + Object.entries(rows[0].count).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]).map(e => e[0] + ':' + e[1]).join(' ')); }
}
