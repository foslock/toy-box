// A stand-in player for the balance runs, ?autoplay and the ?demo board. It weighs each square by playing out the
// lines through it many times over with cards still in the shoe, filling each empty square the way a player would:
// the best of `pick` cards for that line. Then it picks the square that adds the most.
import { LINES, LINES_AT, playing, playable, current, masked, burnsLeft, scoreLine, rulesOf } from './game.js';
import { REG, SEATS } from './data.js';
import { isFace } from './cards.js';
import * as G from './game.js';

const ri = (rnd, n) => Math.floor(rnd() * n);

// How well a card fits a line: matching a rank, keeping a suit going, sitting near the others.
function fit(line, c) {
  let f = 0, suit = -1, same = true;
  for (const x of line) {
    if (!x || typeof x !== 'object') continue;
    if (x.r === c.r) f += 3;
    if (suit < 0) suit = x.s; else if (x.s !== suit) same = false;
    if (Math.abs(x.r - c.r) <= 2 && x.r !== c.r) f += .5;
  }
  if (suit >= 0 && same && c.s === suit) f += 2.2;
  return f;
}

export class Bot {
  // samples: playouts per line; pick: how choosy the imagined fills are; slop: chance of a careless square
  constructor({ samples = 16, pick = 2, slop = 0, burnBar = .35, rand = Math.random } = {}) {
    Object.assign(this, { samples, pick, slop, burnBar, rand });
  }

  // Expected pay of each line under `board`, by playouts from `pool`.
  lineValue(run, li, board, pool, regs, rng) {
    const L = LINES[li], empties = L.cells.filter(c => board[c] === null);
    if (rulesOf(run).includes('tilt') && L.kind === 'row') return 0;
    const ctx = { regs, paid: 5, expect: true, rand: () => .5, snob: rulesOf(run).includes('snob') };
    if (!empties.length) return scoreLine(run, li, board, ctx).total;
    let sum = 0;
    const tmp = board.slice();
    for (let s = 0; s < this.samples; s++) {
      const used = new Set();
      for (const cell of empties) {
        let best = null, bf = -1;
        for (let k = 0; k < this.pick; k++) {
          let c, tries = 0;
          do { c = pool[ri(rng, pool.length)]; } while (used.has(c.id) && ++tries < 8);
          const f = fit(L.cells.map(x => tmp[x]), c) + rng() * .01;
          if (f > bf) { bf = f; best = c; }
        }
        used.add(best.id);
        tmp[cell] = best;
      }
      sum += scoreLine(run, li, tmp, ctx).total;
      for (const cell of empties) tmp[cell] = null;
    }
    return sum / this.samples;
  }

  // How much each playable square adds with `card` on it.
  weigh(run, card, pool, rng) {
    const T = run.table, regs = playing(run), out = [];
    const before = new Map();
    for (const cell of playable(run)) {
      let gain = 0;
      const board = T.board.slice();
      board[cell] = card;
      for (const li of LINES_AT[cell]) {
        if (!before.has(li)) before.set(li, this.lineValue(run, li, T.board, pool, regs, rng));
        gain += this.lineValue(run, li, board, pool, regs, rng) - before.get(li);
      }
      out.push({ cell, gain });
    }
    return out.sort((a, b) => b.gain - a.gain);
  }

  // Seeded per decision so the same board gets the same answer.
  rngFor(run) {
    let s = (run.rs ^ (run.table.at * 7919)) | 0;
    return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  choose(run) {
    const T = run.table, card = current(run), rng = this.rngFor(run);
    const pool = T.pile.slice(T.at + 1).map(id => G.cardById(run, id));
    let options;
    if (masked(run)) {
      // only the suit is showing: average over the cards it could be
      const could = [card, ...pool.filter(c => c.s === card.s)];
      const tally = new Map();
      const keep = this.samples, n = 6;
      this.samples = Math.max(4, Math.round(keep / 2));
      for (let i = 0; i < n; i++) {
        const guess = could[ri(rng, could.length)];
        for (const o of this.weigh(run, guess, pool.filter(c => c !== guess), rng)) tally.set(o.cell, (tally.get(o.cell) || 0) + o.gain / n);
      }
      this.samples = keep;
      options = [...tally.entries()].map(([cell, gain]) => ({ cell, gain })).sort((a, b) => b.gain - a.gain);
    } else options = this.weigh(run, card, pool, rng);
    if (this.slop && this.rand() < this.slop) return { act: 'place', cell: options[ri(this.rand, options.length)].cell };
    // burn a card that fits nowhere well, compared with what the shoe usually deals
    if (burnsLeft(run) > 0 && !masked(run) && pool.length > 2) {
      const keep = this.samples;
      this.samples = Math.max(4, keep >> 2);
      const typical = [];
      for (let i = 0; i < 5; i++) {
        const c = pool[ri(rng, pool.length)];
        typical.push(this.weigh(run, c, pool.filter(x => x !== c), rng)[0].gain);
      }
      this.samples = keep;
      typical.sort((a, b) => a - b);
      const bar = typical[Math.floor(this.burnBar * typical.length)];
      if (options[0].gain < bar) return { act: 'burn' };
    }
    return { act: 'place', cell: options[0].cell };
  }

  playTable(run) {
    let guard = 0;
    while (run.phase === 'table' && guard++ < 200) {
      const m = this.choose(run);
      if (m.act === 'burn') G.burn(run); else G.place(run, m.cell);
    }
  }

  // ---- at the bar
  shop(run) {
    const score = id => VALUE[id] ?? 4;
    for (let guard = 0; guard < 20; guard++) {
      const offers = run.bar.offers.map((o, i) => ({ o, i })).filter(({ o }) => !o.sold);
      const reserve = run.ante >= 3 ? 0 : 0;
      const cands = [];
      for (const { o, i } of offers) {
        if (run.money - o.price < reserve) continue;
        if (o.kind === 'reg') {
          let v = score(o.id) - o.price * .3;
          if (o.id === 'oldtom' && run.regs.length > 2) v -= 4;
          if (run.regs.length >= SEATS) {
            const worst = run.regs.map((r, s) => ({ s, v: score(r.id) })).sort((a, b) => a.v - b.v)[0];
            if (score(o.id) > worst.v + 2) cands.push({ i, v: v - 1, swap: worst.s });
            continue;
          }
          cands.push({ i, v });
        } else if (o.kind === 'tip') cands.push({ i, v: ({ flush: 3.2, full: 3.2, twopair: 2.8, trips: 2.8, pair: 2.4, straight: 2 })[o.id] || 1 });
        else if (o.kind === 'felt') cands.push({ i, v: ({ hot: 6, hole: 6, lucky: 4, gold: 2.5, keeper: 0 })[o.id] - o.price * .25 });
        else cands.push({ i, v: ({ wild: 2.5, chalk: 2, redpen: 2.6, glass: 2.2 })[o.id] || 0 });
      }
      cands.sort((a, b) => b.v - a.v);
      const best = cands[0];
      if (!best || best.v < 1.2) {
        if (run.money >= 14 + G.rerollCost(run) && run.bar.rerolls < 2) { G.reroll(run); continue; }
        break;
      }
      if (best.swap !== undefined) G.sell(run, best.swap);
      if (!G.buy(run, best.i)) break;
      const p = run.bar.pending;
      if (p?.kind === 'felt') {
        const order = [12, 6, 8, 16, 18, 0, 4, 20, 24, 2, 10, 14, 22, 7, 11, 13, 17, 1, 3, 5, 9, 15, 19, 21, 23];
        const cell = p.id === 'gold' ? [0, 4, 20, 24, ...order].find(c => !run.felt[c]) : order.find(c => !run.felt[c]);
        G.applyFelt(run, cell);
      } else if (p?.kind === 'trick') {
        const cards = p.choices.map(id => G.cardById(run, id)).sort((a, b) => b.r - a.r);
        G.applyTrick(run, cards.map(c => c.id));
      }
    }
    // put the multipliers last, where they multiply the most, unless The Pickpocket is next and takes the last seat
    run.regs.sort((a, b) => (REG[a.id].text.includes('×') ? 1 : 0) - (REG[b.id].text.includes('×') ? 1 : 0));
    if (G.nextTable(run).boss === 'pickpocket' && run.regs.length > 1) {
      const worst = run.regs.reduce((w, r, i) => score(r.id) < score(run.regs[w].id) ? i : w, 0);
      run.regs.push(run.regs.splice(worst, 1)[0]);
    }
  }
}

// rough worth of each regular to this bot
const VALUE = {
  gambler: 9, hustler: 8, lou: 8, widow: 6, snake: 7, mayor: 5, sal: 6, moe: 6, twins: 6, triplets: 6, lucky: 6,
  mel: 6, zora: 4, al: 5, rusty: 4, oldtom: 5, pinstripe: 4, prof: 3, rosa: 4, dolores: 4, spike: 4, clem: 4,
  duchess: 4, ace: 3, shorty: 3, bouncer: 4, banker: 3, accountant: 3, mechanic: 3,
};

// A whole night, for the balance runs. Returns how far it got.
export function playRun(run, bot, onTable) {
  let guard = 0;
  while (guard++ < 400) {
    if (run.phase === 'table') bot.playTable(run);
    if (run.phase === 'scored') { const res = run.table.result; const out = G.settle(run); onTable?.(run, res, out); }
    if (run.phase === 'cashout') G.openBar(run);
    if (run.phase === 'bar') { bot.shop(run); G.leaveBar(run); }
    if (run.phase === 'over' || run.phase === 'won') break;
  }
  return run;
}
