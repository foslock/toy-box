// Headless balance runs for Scales: stand-in players play whole market days and this prints how long they last,
// what they score, how big the produce got, and what tipped them over.
//
//   node scales/balance.mjs              → three kinds of player, eight days each
//   node scales/balance.mjs --games 20 --minutes 30
import { Game, STEP } from './game.js';
import { Bot } from './bot.js';
import { PRODUCE } from './produce.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const GAMES = arg('games', 8), MINUTES = arg('minutes', 25);
const only = process.argv.includes('--good');
const players = [
  ['careless', { skill: 0.3, sloppy: 14, think: 0.3, look: 0 }],
  ['steady', { skill: 0.7, sloppy: 7, think: 0.8, look: 4 }],
  ['careful', { skill: 1, sloppy: 3, think: 1.4, look: 12, edge: 6 }],   // keeps the heaps in the middle
];
const med = a => { const s = [...a].sort((p, q) => p - q); return s[s.length >> 1]; };
for (const [label, opt] of players) {
  if (only && label === 'careless') continue;
  const rows = [], causes = {}, tiers = [];
  let t0 = Date.now();
  for (let i = 0; i < GAMES; i++) {
    let seed = 1234 + i * 977;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const g = new Game(4000 + i * 31), bot = new Bot({ ...opt, rand });
    while (g.state === 'play' && g.t < MINUTES * 60) { bot.tick(g); g.tick(); g.drain(); }
    rows.push({ t: g.t, score: g.score, drops: g.drops, tier: g.maxTier, trims: g.trim.i, L: g.L, over: g.state === 'over' });
    causes[g.over?.cause || 'time'] = (causes[g.over?.cause || 'time'] || 0) + 1;
    tiers.push(g.maxTier);
  }
  const ts = rows.map(r => r.t / 60);
  console.log(`${label.padEnd(9)} median ${med(ts).toFixed(1)} min (${Math.min(...ts).toFixed(1)}–${Math.max(...ts).toFixed(1)}), score ${med(rows.map(r => r.score))} (best ${Math.max(...rows.map(r => r.score))}), drops ${med(rows.map(r => r.drops))}, biggest ${PRODUCE[med(tiers)].name} (best ${PRODUCE[Math.max(...tiers)].name}), trims ${med(rows.map(r => r.trims))}`);
  console.log(' '.repeat(10) + 'ended by ' + Object.entries(causes).map(([k, v]) => `${k} ${v}`).join(', ') + `   [${((Date.now() - t0) / 1000).toFixed(1)}s]`);
}
