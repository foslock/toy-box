// Headless balance runs for Ladder: stand-in players climb the whole heap, and this prints how long they take and
// how they fall. The bot follows plan.js (from check.mjs --plan), so it always knows where the good footing is;
// a person won't, so read these as a floor, not an estimate.
//
//   node ladder/balance.mjs                → three kinds of player, three runs each
//   node ladder/balance.mjs --minutes 200
import { buildHeap } from './heap.js';
import { Game } from './game.js';
import { Bot } from './bot.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const MINUTES = arg('minutes', 150);
const heap = buildHeap();
const players = [
  // speed: how fast they climb (m/s); sloppy: how far off they stand and aim; think: seconds looking before each try
  ['careful', { speed: 1.0, sloppy: 0.6, think: 8 }],
  ['steady', { speed: 1.3, sloppy: 0.9, think: 8 }],
  ['hasty', { speed: 1.8, sloppy: 1.0, think: 5 }],
];
for (const [label, opt] of players) {
  const rows = [];
  for (const s0 of [5, 17, 41]) {
    let seed = s0; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const g = new Game(heap), bot = new Bot(heap, { ...opt, rand });
    const falls = [];
    for (let i = 0; i < MINUTES * 3600 && !g.won; i++) { bot.tick(g); g.tick(); for (const e of g.drain()) if (e.type === 'fallen' && e.fall.cause !== 'hop') falls.push(e.fall.lost); }
    const big = falls.filter(f => f > 15).length, worst = Math.max(0, ...falls);
    rows.push(`${g.won ? `${Math.round(g.t / 60)} min` : `not in ${MINUTES} min (best ${g.best.toFixed(0)} m)`}, ${falls.length} falls (${big} over 15 m, worst ${worst.toFixed(0)} m)`);
  }
  console.log(label.padEnd(8), rows.join('  |  '));
}
