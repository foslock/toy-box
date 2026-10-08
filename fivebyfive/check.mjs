// Checks for Five by Five's arithmetic: the hand evaluator against a brute-force one (wilds, four fingers, turning
// the corner), the outlook used by the preview, and every regular, house rule and felt square scoring without errors.
//
//   node fivebyfive/check.mjs
import { evaluate, outlook, HANDS, H } from './cards.js';

let fails = 0, n = 0;
const ok = (cond, msg) => { n++; if (!cond) { fails++; if (fails < 25) console.log('FAIL', msg); } };

// ---- an independent, slow evaluator for real cards only
function combos(a, k) {
  if (k === 0) return [[]];
  if (a.length < k) return [];
  const [x, ...rest] = a;
  return [...combos(rest, k - 1).map(c => [x, ...c]), ...combos(rest, k)];
}
function isRun(cs, wrap) {
  const p = cs.map(c => c.r - 2);
  if (new Set(p).size !== p.length) return false;
  const n = p.length;
  if (wrap) {
    for (let a = 0; a < 13; a++) if (p.every(x => ((x - a + 13) % 13) < n)) return true;
    return false;
  }
  const lo = q => { const s = [...q].sort((a, b) => a - b); return s[n - 1] - s[0] === n - 1; };
  return lo(p) || (p.includes(12) && lo(p.map(x => x === 12 ? -1 : x)));
}
function slow(cards, four, wrap) {
  const L = cards.length, need = four ? 4 : 5;
  const subs = L >= need ? combos(cards, need) : [];
  const cnt = {};
  for (const c of cards) cnt[c.r] = (cnt[c.r] || 0) + 1;
  const g = Object.values(cnt).sort((a, b) => b - a);
  const flush = cs => cs.every(c => c.s === cs[0].s);
  if (L === 5 && g[0] === 5) return H.five;
  if (subs.some(cs => isRun(cs, wrap) && flush(cs))) return H.sflush;
  if (g[0] >= 4) return H.quads;
  if (L === 5 && g[0] === 3 && g[1] === 2) return H.full;
  if (subs.some(flush)) return H.flush;
  if (subs.some(cs => isRun(cs, wrap))) return H.straight;
  if (g[0] >= 3) return H.trips;
  if (g[0] >= 2 && g[1] >= 2) return H.twopair;
  if (g[0] >= 2) return H.pair;
  return H.high;
}
// every way the wild cards could be dealt
function brute(slots, four, wrap) {
  let best = -1;
  const go = (i, acc) => {
    if (i === slots.length) { best = Math.max(best, slow(acc, four, wrap)); return; }
    const c = slots[i];
    if (c.w) { for (let r = 2; r <= 14; r++) for (let s = 0; s < 4; s++) go(i + 1, [...acc, { r, s }]); }
    else if (c.ws) { for (let s = 0; s < 4; s++) go(i + 1, [...acc, { r: c.r, s }]); }
    else go(i + 1, [...acc, c]);
  };
  go(0, []);
  return best;
}

let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ri = n => Math.floor(rand() * n);
for (let t = 0; t < 6000; t++) {
  const L = rand() < .2 ? 4 : 5, four = rand() < .3, wrap = rand() < .3;
  let w = 0, ws = 0;
  // bias toward the interesting hands: draw ranks from a narrow band and suits from two
  const band = 2 + ri(9), narrow = rand() < .6, twoSuits = rand() < .5;
  const slots = Array.from({ length: L }, () => {
    const c = { r: narrow ? Math.min(14, band + ri(5)) : 2 + ri(13), s: twoSuits ? ri(2) : ri(4) };
    if (w < 2 && rand() < .08) { w++; return { r: 0, s: -1, w: true }; }
    if (ws < 2 && rand() < .08) { ws++; c.ws = true; }
    return c;
  });
  const got = evaluate(slots, { four, wrap }), want = brute(slots, four, wrap);
  ok(got.h === want, `${JSON.stringify(slots)} four=${four} wrap=${wrap}: got ${HANDS[got.h].name}, want ${HANDS[want].name}`);
  ok(got.scoring.every(i => i >= 0 && i < L) && new Set(got.scoring).size === got.scoring.length, 'scoring indices ' + JSON.stringify(got));
}

// ---- hands written out by hand
const C = s => s.split(' ').map(t => {
  if (t === '*') return { r: 0, s: -1, w: true };
  const ws = t.endsWith('~'), x = ws ? t.slice(0, -1) : t;
  return { r: '23456789TJQKA'.indexOf(x[0]) + 2, s: 'shdc'.indexOf(x[1]), ws };
});
const is = (cards, hand, opts, scoring) => {
  const got = evaluate(C(cards), opts);
  ok(got.h === H[hand], `${cards} → ${HANDS[got.h].name}, want ${hand}`);
  if (scoring) ok(JSON.stringify(got.scoring) === JSON.stringify(scoring), `${cards} scoring ${got.scoring} want ${scoring}`);
};
is('Ah Kh Qh Jh Th', 'sflush');
is('Ah 2d 3c 4s 5h', 'straight');
is('Qh Kd Ac 2s 3h', 'high');
is('Qh Kd Ac 2s 3h', 'straight', { wrap: true });
is('Kh Ad 2c 3s 4h', 'straight', { wrap: true });
is('9h 9d 9c 4s 4h', 'full');
is('9h 9d 4c 4s Kh', 'twopair', {}, [0, 1, 2, 3]);
is('9h 9d 4c 5s Kh', 'pair', {}, [0, 1]);
is('2h 7d 4c 5s Kh', 'high', {}, [4]);
is('2h 7h 4h 5h Kd', 'flush', { four: true }, [0, 1, 2, 3]);
is('2h 3d 4c 5s Kd', 'straight', { four: true }, [0, 1, 2, 3]);
is('2h 3h 4h 5h Kd', 'sflush', { four: true });
is('2h 3h 4h 5h', 'sflush', { four: true });
is('2h 3h 4h 5h', 'high');
is('2h 2d 2c 2s', 'quads');
is('Ks Kd Kc * 7h', 'quads', {}, [0, 1, 2, 3]);
is('Ks Kd 7c * 7h', 'full');
is('Ks Kd Kc * Kh', 'five');
is('2h 5h 9h Kh Ac~', 'flush');
is('* * 3h 4h 5h', 'sflush');
is('Ah 9d 4c 5s *', 'pair', {}, [0, 4]);

// ---- the outlook for lines still filling up
const O = (cards, opts) => outlook(cards.split(' ').map(t => t === '_' ? null : C(t)[0]), opts);
const o1 = O('9h 9d _ _ _');
ok(o1.made === H.pair && o1.flush === -1 && !o1.full, 'pair, no flush ' + JSON.stringify(o1));
const o2 = O('2h 7h _ Kh _');
ok(o2.made === H.high && o2.flush === 1 && !o2.straight, 'heart draw ' + JSON.stringify(o2));
const o3 = O('5c 6d _ 8h _');
ok(o3.straight, 'straight draw ' + JSON.stringify(o3));
const o4 = O('5c 6d _ Kh _');
ok(!o4.straight, 'no straight ' + JSON.stringify(o4));
const o5 = O('2h 7h 3s Kh _', { four: true });
ok(o5.flush === 1, 'four-finger heart draw ' + JSON.stringify(o5));
const o6 = O('2h 7h 3s Kh 9h');
ok(o6.full && o6.made === H.high, 'full line ' + JSON.stringify(o6));

// ---- the run: every regular, house rule, trick and square plays a table without trouble
const G = await import('./game.js');
const { Bot } = await import('./bot.js');
const { REGULARS, BOSSES, TRICKS, FELT } = await import('./data.js');
const fine = (run, what) => {
  const res = run.table.result;
  ok(res && Number.isFinite(res.total) && res.total >= 0 && res.lines.length === 12, `${what}: table scored ${res && res.total}`);
  ok(res.lines.every(l => l.void || l.steps.length >= 1), `${what}: every line has steps`);
};
const quick = () => new Bot({ samples: 3, pick: 1 });
for (const R of REGULARS) {
  const run = G.newRun(300 + R.id.length);
  run.regs = [{ id: R.id, n: 0 }, { id: 'al', n: 0 }];
  G.startTable(run);
  quick().playTable(run);
  fine(run, R.id);
  const out = G.settle(run);
  ok(Number.isFinite(out.total), `${R.id}: payout`);
}
for (const B of [...BOSSES, { id: 'house' }]) {
  const run = G.newRun(400);
  run.stage = 1; run.bosses[0] = B.id; run.regs = [{ id: 'zora', n: 0 }, { id: 'al', n: 0 }];
  G.startTable(run);
  quick().playTable(run);
  fine(run, B.id);
  if (B.id === 'tilt') ok(run.table.result.lines.filter(l => l.void).length === 5, 'tilt voids the rows');
  if (B.id === 'snob') ok(run.table.result.lines.every(l => l.pay > H.pair || l.total === 0), 'the snob pays nothing for pairs');
  if (B.id === 'wall' || B.id === 'house') ok(run.table.board[12] === 'brick', 'the wall bricks the middle');
  if (B.id === 'crowd') ok(run.table.board.filter(b => b && b.x).length === 4, 'four strangers');
  if (B.id === 'miser') ok(run.table.burns === 0, 'no burns for the miser');
}
for (const F of FELT) {
  const run = G.newRun(500);
  run.felt[12] = F.id; run.felt[6] = F.id === 'hole' ? 'hole' : null;
  G.startTable(run);
  quick().playTable(run);
  fine(run, F.id);
  if (F.id === 'hole') ok(run.table.board[12] === 'hole' && run.table.placed === 23, 'two holes, 23 cards');
  if (F.id === 'keeper') {
    const kept = run.table.board[12].id;
    G.settle(run); run.phase = 'bar'; run.bar = { offers: [], rerolls: 0, pending: null }; G.leaveBar(run);
    ok(run.table.board[12] && run.table.board[12].id === kept, 'the keeper square keeps its card');
    quick().playTable(run);
    G.settle(run); run.phase = 'bar'; run.bar = { offers: [], rerolls: 0, pending: null }; G.leaveBar(run);
    ok(run.table.board[12] === null, '...for one table only');
  }
}
for (const T of TRICKS) {
  const run = G.newRun(600);
  run.phase = 'cashout'; run.money = 50; G.openBar(run);
  run.bar.offers[2] = { kind: 'trick', id: T.id, price: T.price };
  const n = run.deck.length;
  ok(G.buy(run, 2) && run.bar.pending?.kind === 'trick', `${T.id}: bought`);
  const ids = run.bar.pending.choices.slice(0, 3);
  ok(G.applyTrick(run, ids), `${T.id}: applied`);
  if (T.id === 'shave') ok(run.deck.length === n - 2, 'shave takes two');
  if (T.id === 'copy') ok(run.deck.length === n + 1 && new Set(run.deck.map(c => c.id)).size === run.deck.length, 'copy adds one with a new id');
  if (T.dye !== undefined) ok(ids.every(id => G.cardById(run, id).s === T.dye), 'dye');
  G.leaveBar(run); quick().playTable(run); fine(run, 'after ' + T.id);
}
// exact arithmetic: the Widow triples the diagonals, and nothing else
{
  const run = G.newRun(700);
  quick().playTable(run);
  const board = run.table.board, ctx = r => ({ regs: r.regs, paid: 0, rand: () => .9 });
  const a = G.scoreLine(run, 10, board, ctx(run)), b = G.scoreLine(run, 0, board, ctx(run));
  run.regs = [{ id: 'widow', n: 0 }];
  const a2 = G.scoreLine(run, 10, board, ctx(run)), b2 = G.scoreLine(run, 0, board, ctx(run));
  ok(a2.total === Math.floor(a.chips * a.mult * 3) && b2.total === b.total, `widow ×3 diagonal ${a.total}→${a2.total}, row ${b.total}→${b2.total}`);
  run.regs = [{ id: 'twins', n: 0 }];
  const pairs = G.LINES.map((_, li) => G.scoreLine(run, li, board, ctx(run))).filter(l => l.hand === H.pair);
  ok(pairs.every(l => l.pay === H.twopair), 'dot & dash pay pairs as two pair');
}
// the marker: once only, never at the House's own table
{
  const run = G.newRun(800);
  quick().playTable(run);
  run.table.result.won = false; run.money = 9;
  let out = G.settle(run);
  ok(out.marker && run.phase === 'cashout' && run.money === 4 && run.markers === 0, 'the marker saves you once, for half your money');
  run.phase = 'scored'; out = G.settle(run);
  ok(out.over && run.phase === 'over', 'no second marker');
  const r2 = G.newRun(801);
  r2.ante = 8; r2.stage = 1; G.startTable(r2); quick().playTable(r2);
  r2.table.result.won = false; out = G.settle(r2);
  ok(out.over, 'the House takes no markers');
}

console.log(fails ? `${fails} of ${n} checks failed` : `all ${n} checks pass`);
process.exit(fails ? 1 : 0);
