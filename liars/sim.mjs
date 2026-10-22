// Headless balance check: a stand-in "you" plays each table many times.
//   node liars/sim.mjs [games=400] [seed=1]
// Bots: plain (sensible, no tells), reader (also believes visible tells), habit (takes longer when bluffing),
// and reader+habit. Prints win rate per table, so we can see the tells matter and the reads bite.
import { Game, CHARACTERS, TABLES, decide, tellShows, thinkTime, Book, rng } from './game.js';

const N = +(process.argv[2] || 400), SEED = +(process.argv[3] || 1);
const YOU = { name: 'you', skill: 0.6, bluff: 0.25, lean: 0, watches: [], sharp: 0 };

function play(tableIdx, bot, seed) {
  const t = TABLES[tableIdx];
  const rand = rng(seed * 7919 + 13);
  const g = new Game(['you', ...t.seats], { seed });
  const book = new Book();
  const thinks = [];
  let rounds = 0;
  while (g.winner() < 0 && !g.players[0].out) {
    g.roll(); rounds++;
    let seen = false;
    for (let guard = 0; guard < 200; guard++) {
      const i = g.turn;
      const median = thinks.length ? thinks.slice().sort((a, b) => a - b)[thinks.length >> 1] : 3;
      if (i === 0) {
        const a = decide(g, 0, YOU, rand, { seen: bot.reader && seen });
        if (a.call) { const r = g.call(0); finish(r); break; }
        const think = bot.habit ? (a.bluff ? 5 + rand() * 3 : 1.5 + rand() * 1.5) : 2 + rand() * 2.5;
        thinks.push(think);
        g.place(0, a.q, a.f, { think });
        seen = false;
      } else {
        const ch = CHARACTERS[g.players[i].key];
        const a = decide(g, i, ch, rand, { human: 0, book, median });
        if (a.call) { const r = g.call(i); finish(r); break; }
        const e = g.place(i, a.q, a.f, { think: thinkTime(ch, a.bluff, rand) });
        seen = tellShows(ch, e.bluff, t.soften, rand);
      }
    }
    function finish(r) {
      const median = thinks.length ? thinks.slice().sort((a, b) => a - b)[thinks.length >> 1] : 3;
      for (const h of g.history) if (h.by === 0) book.add(h, median);
      g.settle(r);
    }
  }
  return { win: g.winner() === 0, rounds };
}

const bots = { plain: {}, reader: { reader: true }, habit: { habit: true }, 'reader+habit': { reader: true, habit: true } };
for (const [ti, t] of TABLES.entries()) {
  const row = [];
  for (const [name, bot] of Object.entries(bots)) {
    let w = 0, r = 0;
    for (let k = 0; k < N; k++) { const o = play(ti, bot, SEED * 100003 + k); w += o.win; r += o.rounds; }
    row.push(`${name} ${(100 * w / N).toFixed(0)}%`);
    if (name === 'plain') row.push(`(${(r / N).toFixed(1)} rounds)`);
  }
  console.log(t.name.padEnd(14), row.join('  '));
}
