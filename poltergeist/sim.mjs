// Headless balance check: node poltergeist/sim.mjs [night] [games]
import { Game, Bot, NIGHTS, TUNE } from './game.js';
for (const kv of (process.env.TUNE || '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); TUNE[k] = +v; }
const night = +(process.argv[2] ?? 1), N = +(process.argv[3] ?? 24), react = +(process.argv[4] ?? 0.35), greed = +(process.argv[5] ?? 5), save = +(process.argv[6] ?? 1), noise = +(process.argv[7] ?? 0);
let wins = 0; const hours = [], todo = {}, out = [];
for (let s = 1; s <= N; s++) {
  const g = new Game(night, { seed: s });
  const bot = new Bot(g, { seed: s * 13, react, greed, save, noise });
  let tricks = 0;
  while (!g.result && g.t < 900) { if (bot.tick(0.05)) tricks++; g.tick(0.05); g.events.length = 0; }
  if (g.result === 'won') { wins++; hours.push(g.wonHour); }
  for (const d of g.done) todo[d] = (todo[d] || 0) + 1;
  out.push(`${g.result} ${g.hourText(g.wonHour ?? g.hour)} tricks=${tricks} spotted=${g.spotted} barked=${g.barked} best=${g.bestChain} fear=${g.people.filter(p=>p.resident).map(p => p.gone ? 'gone' : Math.round(p.fear)).join('/')}`);
}
hours.sort((a, b) => a - b);
const g0 = new Game(night);
console.log(out.slice(0, +(process.env.SHOW ?? 6)).join('\n'));
console.log(`${NIGHTS[night].title}: won ${wins}/${N}  median ${hours.length ? g0.hourText(hours[hours.length >> 1]) : '-'}  todo ${JSON.stringify(todo)}`);
