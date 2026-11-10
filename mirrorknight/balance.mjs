// node mirrorknight/balance.mjs [n] — bot vs knight, across several attempts so it learns.
import { Game, learnHabits, emptyHabits, habitCount, WEAPON_ORDER } from './game.js';
import { Bot } from './bot.js';

const N = +(process.argv[2] || 24);
const dt = 1 / 60;
const rows = [];
for (const weapon of WEAPON_ORDER) {
  let wins = 0, tSum = 0, kHpSum = 0, attemptsToWin = [];
  for (let i = 0; i < N; i++) {
    let habits = emptyHabits(), kw = 'sword', won = false, a;
    for (a = 1; a <= 6 && !won; a++) {
      const g = new Game({ weapon, knightWeapon: kw, habits, seed: i * 97 + a });
      const adapt = process.env.ADAPT;
      const BI = ['left', 'right', 'back', null];
      const bot = new Bot(g, { seed: i * 31 + a, bias: adapt ? BI[(i + a) % 4] : (i % 2 ? 'left' : null), string: adapt ? 1 + ((i + a) % 3) : 2 + (i % 2), heavyP: adapt ? [.1, .4][(a) % 2] : .15, circle: adapt ? (a % 2 ? 1 : -1) : 1, skill: .65 + .2 * ((i % 4) / 3) });
      while (!g.over && g.t < 400) { bot.step(dt); g.tick(dt); }
      if (a === 1) { tSum += g.t; kHpSum += g.k.hp / g.k.maxHp; if (g.over === 'won') wins++; }
      if (g.over === 'won') { won = true; attemptsToWin.push(a); }
      habits = learnHabits(habits, g.track, g.t).habits; kw = weapon;
    }
    if (!won) attemptsToWin.push(99);
  }
  attemptsToWin.sort((x, y) => x - y);
  const tot = attemptsToWin.filter(x => x < 99).length;
  rows.push({ weapon, wonBy6: (tot / N).toFixed(2), firstWin: (wins / N).toFixed(2), avgT: (tSum / N).toFixed(0), kHpLeft: (kHpSum / N).toFixed(2), medAttempts: attemptsToWin[N >> 1] });
}
console.table(rows);
