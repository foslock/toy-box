// Headless balance check: the bot rides many seeds; prints how far it gets and what ends the runs.
//   node drawahead/balance.mjs [games=40] [sloppy=0] [maxSeconds=240]
import { Game, REASONS } from './game.js';
import { Bot } from './bot.js';
import { rng } from './rng.js';

const [N = 40, sloppy = 0, maxT = 240] = process.argv.slice(2).map(Number);
const out = [];
for (let i = 0; i < N; i++) {
  const g = new Game({ seed: 1000 + i });
  const bot = new Bot(g, { sloppy, rand: rng(77 + i) });
  let t = 0, spSum = 0, airMax = 0, inkMin = Infinity;
  while (t < maxT && (g.state === 'ready' || g.state === 'ride')) {
    bot.update(); g.step(1 / 60); t += 1 / 60;
    spSum += Math.hypot(g.rider.vx, g.rider.vy);
    inkMin = Math.min(inkMin, g.ink);
    g.events.length = 0;
  }
  out.push({ seed: 1000 + i, m: Math.round(g.dist), t: +t.toFixed(1), why: g.state === 'ride' ? 'alive' : g.reason, style: g.style,
    sp: Math.round(spSum / (t * 60)), ink: Math.round(inkMin), dry: g.dry, gates: `${g.gates.hit}/${g.gates.all}`, x: Math.round(g.rider.x), y: Math.round(g.rider.y) });
}
const ms = out.map(o => o.m).sort((a, b) => a - b);
const q = p => ms[Math.floor(p * (ms.length - 1))];
const why = {};
for (const o of out) why[o.why] = (why[o.why] || 0) + 1;
if (process.env.V) for (const o of out) console.log(JSON.stringify(o));
console.log(`metres p25 ${q(.25)} median ${q(.5)} p75 ${q(.75)} max ${ms[ms.length - 1]}`);
console.log('ends:', why);
console.log('mean speed', Math.round(out.reduce((a, o) => a + o.sp, 0) / N), 'dry pencil runs', out.filter(o => o.dry).length, 'gates', out.reduce((a, o) => a + +o.gates.split('/')[0], 0) + '/' + out.reduce((a, o) => a + +o.gates.split('/')[1], 0));
