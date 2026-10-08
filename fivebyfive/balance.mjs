// Headless balance runs for Five by Five: stand-in players play whole nights, and this prints how far they get,
// how their boards compare with each table's target, and what they bought.
//
//   node fivebyfive/balance.mjs                 → three kinds of player, 24 nights each
//   node fivebyfive/balance.mjs --runs 60 --only sharp
//   node fivebyfive/balance.mjs --naked         → no shopping at all: what the bare game scores per ante
//   node fivebyfive/balance.mjs --rules         → what each house rule costs a bare board (the x in data.js)
import { newRun, startTable, ANTES } from './game.js';
import { BOSSES, HOUSE } from './data.js';
import { Bot, playRun } from './bot.js';
import { HANDS } from './cards.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const RUNS = +arg('runs', 24), ONLY = arg('only', null), SEED = +arg('seed', 1000), NAKED = process.argv.includes('--naked');
const players = [
  ['careless', { samples: 6, pick: 1, slop: .45, burnBar: 0 }],
  ['steady', { samples: 12, pick: 2, slop: .05 }],
  ['sharp', { samples: 20, pick: 3, slop: 0 }],
];
const med = a => { if (!a.length) return NaN; const s = [...a].sort((p, q) => p - q); return s[s.length >> 1]; };
const pct = (a, q) => { if (!a.length) return NaN; const s = [...a].sort((p, q) => p - q); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

if (process.argv.includes('--rules')) {
  // the same boards with and without each rule, played by the sharp bot
  const N = Math.max(8, RUNS), opt = players[2][1];
  const play = (seed, boss) => {
    const run = newRun(seed);
    if (boss) { run.stage = 1; run.bosses[0] = boss; startTable(run); }
    new Bot({ ...opt, rand: Math.random }).playTable(run);
    return run.table.result.total;
  };
  const seeds = Array.from({ length: N }, (_, i) => SEED + 9000 + i * 17), base = seeds.map(s => play(s, null));
  console.log(`no rule: median ${med(base)}`);
  for (const b of [...BOSSES.map(b => b.id), HOUSE.id]) {
    const rel = seeds.map((s, i) => play(s, b) / base[i]);
    console.log(`${b.padEnd(11)} median ${med(rel).toFixed(2)}, mean ${(rel.reduce((a, c) => a + c, 0) / N).toFixed(2)} of a plain table`);
  }
  process.exit(0);
}

for (const [label, opt] of players) {
  if (ONLY && label !== ONLY) continue;
  const t0 = Date.now(), reached = [], ratio = {}, byBoss = {}, hands = Array(HANDS.length).fill(0), bought = {}, markers = [];
  let wins = 0;
  for (let i = 0; i < RUNS; i++) {
    let s = SEED + i * 7919;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const bot = new Bot({ ...opt, rand });
    if (NAKED) bot.shop = () => {};
    const run = newRun(SEED + i * 104729);
    playRun(run, bot, (r, res) => {
      const k = `${r.ante}${r.stage ? 'B' : 'T'}`;
      (ratio[k] = ratio[k] || []).push(res.total / res.target);
      if (r.table.boss) (byBoss[r.table.boss] = byBoss[r.table.boss] || []).push(res.total / res.target);
      for (const l of res.lines) if (!l.void) hands[l.hand]++;
    });
    for (const r of run.regs) bought[r.id] = (bought[r.id] || 0) + 1;
    if (run.phase === 'won') wins++;
    reached.push(run.phase === 'won' ? ANTES + 1 : run.ante + run.stage * .5);
    markers.push(1 - run.markers);
  }
  const dist = {};
  for (const a of reached) dist[a] = (dist[a] || 0) + 1;
  console.log(`\n${label}: won ${wins}/${RUNS}, median ante reached ${med(reached)}  [${((Date.now() - t0) / 1000).toFixed(1)}s]`);
  console.log('  ended at: ' + Object.keys(dist).sort((a, b) => a - b).map(k => `${k > ANTES + .5 ? 'WON' : k}:${dist[k]}`).join('  '));
  console.log('  score / target by table (p25 / median / p75, n):');
  for (const k of Object.keys(ratio).sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b))) {
    const a = ratio[k];
    console.log(`    ${k.padEnd(3)} ${pct(a, .25).toFixed(2)} / ${med(a).toFixed(2)} / ${pct(a, .75).toFixed(2)}  n=${a.length}  lost ${a.filter(x => x < 1).length}`);
  }
  console.log('  house tables: ' + Object.entries(byBoss).map(([b, a]) => `${b} ${med(a).toFixed(2)} (lost ${a.filter(x => x < 1).length}/${a.length})`).join(', '));
  const tot = hands.reduce((x, y) => x + y, 0);
  console.log('  lines: ' + HANDS.map((h, i) => `${h.short} ${(100 * hands[i] / tot).toFixed(1)}%`).join(', '));
  console.log('  seated at the end: ' + Object.entries(bought).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
  console.log(`  used the marker: ${markers.filter(Boolean).length}/${RUNS}`);
}
