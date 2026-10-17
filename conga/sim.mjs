// Headless balance check: bot plays whole runs with a simple shopping habit.
//   node conga/sim.mjs [runs] [seed] [W H]
import { Game, rng } from './game.js';
import { buildRound, ROUNDS } from './rounds.js';
import { newRun, rollShop, buy, buyTreat, canBuy, canTreat, settle } from './shop.js';
import { botSteer } from './bot.js';

const N = +process.argv[2] || 24, S0 = +process.argv[3] || 1;
const W = +process.argv[4] || 15, H = +process.argv[5] || 25;
const FRONT = ['bee', 'bull', 'frog', 'armadillo'], BACK = ['tortoise'];

function shopHabit(run, rand) {
  rollShop(run, rand);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < 4; i++) if (canBuy(run, i) && run.coins >= 3) buy(run, i);
    if (canTreat(run) && run.coins >= 4) buyTreat(run);
    if (run.coins >= 4) { run.coins--; rollShop(run, rand); }
  }
  const rank = (e) => FRONT.includes(e.sp) ? 0 : BACK.includes(e.sp) ? 2 : 1;
  run.roster.sort((a, b) => rank(a) - rank(b));
}

const stats = ROUNDS.map(() => ({ tries: 0, wins: 0, time: 0, len: 0, trips: 0, how: {} }));
let champs = 0, reached = [];
for (let n = 0; n < N; n++) {
  const rand = rng(S0 * 1000 + n);
  const run = newRun();
  let res = 'next';
  while (res === 'next') {
    shopHabit(run, rand);
    const r = run.round;
    const g = new Game(buildRound(r, rand, W, H), run, { seed: Math.floor(rand() * 1e9) });
    let t = 0;
    while (!g.over && t < 240) { if (g.you) g.you.want = botSteer(g, { sloppy: 1.5 }); g.tick(1 / 30); t += 1 / 30; }
    if (!g.over) g.end('lose');
    const st = stats[r];
    st.tries++; st.time += t; st.len += run.roster.length; st.trips += g.trips;
    if (g.over === 'win') st.wins++; else st.how[t >= 240 ? 'timeout' : 'ko'] = (st.how[t >= 240 ? 'timeout' : 'ko'] || 0) + 1;
    res = settle(run, g);
  }
  if (res === 'champion') champs++;
  reached.push(run.round);
}
console.log(`${N} runs on ${W}×${H}: ${champs} champions; reached`, reached.join(' '));
stats.forEach((s, i) => s.tries && console.log(`${ROUNDS[i].name.padEnd(9)} tries ${String(s.tries).padStart(3)}  win ${(100 * s.wins / s.tries).toFixed(0).padStart(3)}%  avg ${(s.time / s.tries).toFixed(0)}s  troupe ${(s.len / s.tries).toFixed(1)}  trips ${(s.trips / s.tries).toFixed(1)}`, JSON.stringify(s.how)));
