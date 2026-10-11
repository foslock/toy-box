// Headless balance check: the bot plays each record; prints fidelity left and where dust got through.
//   node needle/balance.mjs [record=all] [sloppy=0] [pitch=0]
import { Game, RECORDS } from './game.js';
import { Bot } from './bot.js';

const [recArg = 'all', sloppy = 0, pitch = 0] = process.argv.slice(2);
const recs = recArg === 'all' ? RECORDS.map((r, i) => i) : [+recArg];
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (const ri of recs) {
  const g = new Game({ record: ri });
  g.setPitch(+pitch);
  const bot = new Bot(g, { sloppy: +sloppy, rand });
  const dt = 1 / 60;
  let wall = 0, between = 0;
  const log = [];
  while (g.state !== 'won' && g.state !== 'lost' && wall < 3600) {
    if (g.state === 'between') { between += dt; if (between > 3) { between = 0; g.startTrack(); } }
    bot.update(dt); g.step(dt); wall += dt;
    for (const e of g.events) {
      if (e.type === 'cleared') log.push(`T${e.n + 1}: fid ${g.fidelity} nk ${g.nickels} towers ${g.towers.map(t => t.part[0] + t.lvl).join(',')} t=${Math.round(g.t)}`);
      if (e.type === 'lost') log.push(`LOST in track ${g.track + 1} t=${Math.round(g.t)} towers ${g.towers.map(t => t.part[0] + t.lvl).join(',')}`);
    }
    g.events.length = 0;
  }
  console.log(`== ${RECORDS[ri].id}: ${g.state} fidelity ${g.fidelity} score ${g.score} kills ${g.kills} leaks ${g.leaks} time ${Math.round(wall)}s`);
  if (process.env.V) console.log(log.join('\n'));
}
