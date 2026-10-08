// A night at the Five by Five: the tables, the house rules, the bar, and all the arithmetic. No DOM, so the page,
// the checks and the Node balance runs all play the same game. Everything random comes from the run's own seeded
// generator, so a saved run picks up exactly where it was.
import { evaluate, outlook, freshDeck, HANDS, H, cardChips, isFace } from './cards.js';
import { REG, REGULARS, PRICE, SEATS, BOSS, BOSSES, FIRST_BOSSES, TRICKS, TRICK, FELT, FELT_OF, MIN_DECK } from './data.js';

export const ANTES = 8;
export const BURNS = 3;
// What a plain table asks for at each ante; the house's tables ask for more (×1.4, times the rule's own x).
export const TARGETS = [600, 1300, 2300, 3700, 5500, 7600, 11000, 15000];
export const BOSS_X = 1.4;

// The twelve lines: five rows, five columns and the two diagonals, in the order they're paid.
export const LINES = [
  ...[0, 1, 2, 3, 4].map(i => ({ kind: 'row', i, name: `Row ${i + 1}`, cells: [0, 1, 2, 3, 4].map(c => i * 5 + c) })),
  ...[0, 1, 2, 3, 4].map(i => ({ kind: 'col', i, name: `Column ${i + 1}`, cells: [0, 1, 2, 3, 4].map(r => r * 5 + i) })),
  { kind: 'diag', i: 0, name: 'Diagonal ↘', cells: [0, 6, 12, 18, 24] },
  { kind: 'diag', i: 1, name: 'Diagonal ↙', cells: [4, 8, 12, 16, 20] },
];
export const LINES_AT = Array.from({ length: 25 }, (_, c) => LINES.map((l, i) => l.cells.includes(c) ? i : -1).filter(i => i >= 0));

// ---- randomness (mulberry32, its state kept in the run)
export function rand(run) {
  let t = (run.rs = (run.rs + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (run, a) => a[Math.floor(rand(run) * a.length)];
function shuffle(run, a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(run) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function weighted(run, items, w) {
  const tot = items.reduce((s, x) => s + w(x), 0);
  let r = rand(run) * tot;
  for (const x of items) { r -= w(x); if (r <= 0) return x; }
  return items[items.length - 1];
}

// ---- a new night
export function newRun(seed = (Math.random() * 2 ** 31) | 0) {
  const run = {
    v: 1, seed, rs: seed | 0, ante: 1, stage: 0, money: 4, markers: 1,
    deck: freshDeck(), nextId: 52, regs: [], felt: Array(25).fill(null), kept: {}, levels: {},
    bosses: [], burned: 0, endless: false, phase: 'table', table: null, bar: null, last: null,
    stats: { won: 0, best: 0, bestHand: -1, lines: Array(HANDS.length).fill(0) },
  };
  const rest = shuffle(run, BOSSES.map(b => b.id));
  const first = rest.find(id => FIRST_BOSSES.includes(id));
  run.bosses = [first, ...rest.filter(id => id !== first).slice(0, ANTES - 2), 'house'];
  startTable(run);
  return run;
}

export const bossOf = run => run.stage === 1 ? (run.bosses[run.ante - 1] || run.endlessBoss) : null;
export function targetFor(ante, stage, boss) {
  const base = ante <= ANTES ? TARGETS[ante - 1] : TARGETS[ANTES - 1] * 1.7 ** (ante - ANTES);
  const t = base * (stage === 1 ? BOSS_X * (BOSS[boss]?.x || 1) : 1);
  const unit = t < 2000 ? 50 : t < 20000 ? 100 : t < 200000 ? 1000 : 10000;
  return Math.round(t / unit) * unit;
}
export const cardById = (run, id) => run.deck.find(c => c.id === id);
// The regulars actually playing this table (The Pickpocket sends the last one home).
export const playing = run => run.regs.filter((r, i) => !(run.table && run.table.asleep === i));
const has = (run, id) => playing(run).some(r => r.id === id);
export const rulesOf = run => run.table ? run.table.rules : [];
export const lineOpts = run => ({ four: has(run, 'lou'), wrap: has(run, 'prof') });

export function startTable(run) {
  const boss = bossOf(run), rules = boss ? (BOSS[boss].rules || [boss]) : [];
  const T = {
    boss, rules, target: targetFor(run.ante, run.stage, boss), board: Array(25).fill(null), pile: [], at: 0,
    burns: 0, used: 0, asleep: -1, keptNow: [], result: null, placed: 0,
  };
  run.table = T;
  run.felt.forEach((f, i) => { if (f === 'hole') T.board[i] = 'hole'; });
  if (rules.includes('wall')) T.board[12] = 'brick';
  if (rules.includes('pickpocket') && run.regs.length) T.asleep = run.regs.length - 1;
  // cards a keeper square held on to from the last table
  for (const [cell, id] of Object.entries(run.kept)) {
    const c = cardById(run, id);
    if (c && T.board[cell] === null && run.felt[cell] === 'keeper') { T.board[cell] = { ...c }; T.keptNow.push(+cell); }
  }
  run.kept = {};
  if (rules.includes('crowd')) {
    const empty = T.board.map((b, i) => b === null ? i : -1).filter(i => i >= 0);
    shuffle(run, empty).slice(0, 4).forEach((cell, n) => {
      T.board[cell] = { id: -1 - n, r: 2 + Math.floor(rand(run) * 13), s: Math.floor(rand(run) * 4), e: null, x: true };
    });
  }
  T.burns = rules.includes('miser') ? 0 : Math.max(0, BURNS + playing(run).reduce((s, r) => s + (REG[r.id].burns || 0), 0));
  const onTable = new Set(T.board.filter(b => b && b.id >= 0).map(b => b.id));
  const pile = run.deck.filter(c => !onTable.has(c.id));
  T.pile = shuffle(run, pile.map(c => c.id));
  run.phase = 'table';
  return T;
}

// ---- the table
export const current = run => run.table && run.table.at < run.table.pile.length ? cardById(run, run.table.pile[run.table.at]) : null;
export function coming(run) {
  const n = playing(run).reduce((s, r) => s + (REG[r.id].peek || 0), 0), T = run.table;
  return T.pile.slice(T.at + 1, T.at + 1 + n).map(id => cardById(run, id));
}
export const masked = run => rulesOf(run).includes('masquerade');
export const burnsLeft = run => run.table ? run.table.burns - run.table.used : 0;
export const emptyCells = run => run.table.board.map((b, i) => b === null ? i : -1).filter(i => i >= 0);
// Where the current card may go. Under The Drop, only the lowest empty square of each column.
export function playable(run) {
  const empty = emptyCells(run);
  if (!rulesOf(run).includes('drop')) return empty;
  const out = [];
  for (let col = 0; col < 5; col++) {
    for (let row = 4; row >= 0; row--) { const c = row * 5 + col; if (run.table.board[c] === null) { out.push(c); break; } }
  }
  return out;
}
// The square a press on `cell` means: under The Drop, the bottom of that column.
export function landing(run, cell) {
  if (!rulesOf(run).includes('drop')) return run.table.board[cell] === null ? cell : -1;
  const col = cell % 5;
  return playable(run).find(c => c % 5 === col) ?? -1;
}

export function place(run, cell) {
  const T = run.table, card = current(run);
  if (run.phase !== 'table' || !card || !playable(run).includes(cell)) return false;
  T.board[cell] = { ...card };
  T.at++; T.placed++;
  if (!playable(run).length) score(run);
  return true;
}
export function burn(run) {
  const T = run.table;
  if (run.phase !== 'table' || burnsLeft(run) <= 0 || !current(run)) return false;
  T.at++; T.used++; run.burned++;
  for (const r of playing(run)) REG[r.id].onBurn?.(r);
  return true;
}
// The Rush: time's up, and the dealer drops it somewhere.
export function dealerPlaces(run) {
  const where = playable(run);
  return where.length ? (place(run, pick(run, where)), true) : false;
}

// ---- the count
// The slots a line makes for the evaluator, and which board square each slot came from.
function slotsOf(run, li, board, regs) {
  const L = LINES[li], slots = [], cells = [];
  const moe = L.kind === 'col' && regs.some(r => r.id === 'moe');
  for (const c of L.cells) {
    const b = board[c];
    if (b === 'brick') continue;
    if (b === 'hole') slots.push({ r: 0, s: -1, w: true });
    else if (b) slots.push({ r: b.r, s: b.s, ws: b.e === 'wild', w: moe && isFace(b.r) });
    else continue;
    cells.push(c);
  }
  return { slots, cells };
}

// What a line has going for it so far, for the preview: pairs already down, flush and straight still on.
export function outlookOf(run, li, board) {
  const L = LINES[li], moe = L.kind === 'col' && has(run, 'moe'), slots = [];
  for (const c of L.cells) {
    const b = board[c];
    if (b === 'brick') continue;
    slots.push(b === null ? null : b === 'hole' ? { r: 0, s: -1, w: true } : { r: b.r, s: b.s, ws: b.e === 'wild', w: moe && isFace(b.r) });
  }
  return outlook(slots, lineOpts(run));
}
export const lineShort = L => L.kind === 'row' ? `Row ${L.i + 1}` : L.kind === 'col' ? `Col ${L.i + 1}` : L.i === 0 ? 'Diag \u2198' : 'Diag \u2199';
export const lineVoid = (run, li) => rulesOf(run).includes('tilt') && LINES[li].kind === 'row';

// One line's pay. `ctx` brings what the line can't see: earlier lines paid, empty seats, the dice. With `steps`, it
// records every addition for the tape.
export function scoreLine(run, li, board, ctx, steps) {
  const L = LINES[li], regs = ctx.regs;
  const { slots, cells } = slotsOf(run, li, board, regs);
  const opts = { four: regs.some(r => r.id === 'lou'), wrap: regs.some(r => r.id === 'prof') };
  const { h, scoring } = evaluate(slots, opts);
  const pay = regs.some(r => r.id === 'twins') && h === H.pair ? H.twopair : h;
  const lv = run.levels[HANDS[pay].id] || 0;
  let chips = HANDS[pay].chips + lv * HANDS[pay].up[0], mult = HANDS[pay].mult + lv * HANDS[pay].up[1];
  const note = (o, step) => {
    if (!o) return;
    if (o.chips) chips += o.chips;
    if (o.mult) mult += o.mult;
    if (o.x) mult *= o.x;
    if (steps) steps.push({ ...step, ...o, C: chips, M: mult });
  };
  if (steps) steps.push({ t: 'base', C: chips, M: mult, lv });
  const c = { hand: h, pay, line: L, paid: ctx.paid || 0, empty: SEATS - run.regs.length, rand: ctx.rand };
  for (const si of scoring) {
    const cell = cells[si], card = board[cell];
    if (card === 'hole') continue;   // the hole is air: it completes the hand but has no chips of its own
    const times = 1 + (regs.some(r => REG[r.id].again?.(cell)) ? 1 : 0);
    for (let n = 0; n < times; n++) {
      note({ chips: cardChips(card.r) + (card.e === 'bonus' ? 30 : 0) }, { t: 'card', cell, again: n > 0 });
      if (card.e === 'mult') note({ mult: 4 }, { t: 'card', cell, src: 'mult' });
      if (card.e === 'glass') note({ x: 1.5 }, { t: 'card', cell, src: 'glass' });
      regs.forEach((r, seat) => { const f = REG[r.id].card; if (f) note(f(c, card, r), { t: 'reg', id: r.id, seat: run.regs.indexOf(r), cell }); });
    }
  }
  for (const cell of L.cells) {
    if (run.felt[cell] === 'lucky') note({ mult: 6 }, { t: 'felt', cell, id: 'lucky' });
  }
  regs.forEach(r => {
    const f = REG[r.id].line;
    if (!f) return;
    if (r.id === 'lucky' && ctx.expect) note({ x: 4 / 3 }, { t: 'reg', id: r.id, seat: run.regs.indexOf(r) });
    else note(f(c, r), { t: 'reg', id: r.id, seat: run.regs.indexOf(r) });
  });
  for (const cell of L.cells) {
    if (run.felt[cell] === 'hot') note({ x: 2 }, { t: 'felt', cell, id: 'hot' });
  }
  const snubbed = !!ctx.snob && pay <= H.pair;   // The Snob won't pay for it
  return { li, hand: h, pay, cells, scoring: scoring.map(i => cells[i]), chips, mult, total: snubbed ? 0 : Math.floor(chips * mult), snubbed };
}

export function score(run) {
  const T = run.table, regs = playing(run), rules = T.rules;
  const lines = [];
  let paid = 0, total = 0;
  const ctx = { regs, paid: 0, rand: () => rand(run), snob: rules.includes('snob') };
  LINES.forEach((L, li) => {
    if (rules.includes('tilt') && L.kind === 'row') { lines.push({ li, void: true, total: 0, hand: -1, cells: L.cells, scoring: [], steps: [] }); return; }
    const steps = [];
    ctx.paid = paid;
    const r = scoreLine(run, li, T.board, ctx, steps);
    r.steps = steps;
    lines.push(r);
    total += r.total;
    if (r.hand >= H.pair) paid++;
  });
  T.result = { lines, total, target: T.target, won: total >= T.target };
  run.phase = 'scored';
  return T.result;
}

// ---- after the count: get paid (or don't)
export function settle(run) {
  const T = run.table, res = T.result, boss = run.stage === 1;
  const out = { won: res.won, marker: false, rows: [], broke: [], total: 0, over: false, champion: false };
  run.stats.best = Math.max(run.stats.best, res.total);
  for (const l of res.lines) if (!l.void) { run.stats.lines[l.hand]++; run.stats.bestHand = Math.max(run.stats.bestHand, l.hand); }
  // glass shatters, keeper squares hold on
  for (let cell = 0; cell < 25; cell++) {
    const b = T.board[cell];
    if (!b || typeof b !== 'object' || b.x) continue;
    if (b.e === 'glass' && rand(run) < .25) { run.deck = run.deck.filter(c => c.id !== b.id); out.broke.push(b); }
    if (run.felt[cell] === 'keeper' && !T.keptNow.includes(cell) && run.deck.some(c => c.id === b.id)) run.kept[cell] = b.id;
  }
  if (res.won) {
    run.stats.won++;
    out.rows.push([boss ? 'House table beaten' : 'Table won', boss ? 5 : 3]);
    const left = burnsLeft(run);
    if (left > 0) out.rows.push([`Matches left ×${left}`, left]);
    const interest = Math.min(5, Math.floor(run.money / 5));
    if (interest > 0) out.rows.push(['Interest', interest]);
    for (const r of playing(run)) { const p = REG[r.id].pay?.(run, res, r); if (p) out.rows.push([REG[r.id].name, p]); }
    let gold = 0;
    run.felt.forEach((f, cell) => {
      if (f === 'gold') gold += res.lines.filter(l => !l.void && l.hand >= H.pair && LINES[l.li].cells.includes(cell)).length;
    });
    if (gold) out.rows.push(['Gold square', gold]);
    out.total = out.rows.reduce((s, r) => s + r[1], 0);
    run.money += out.total;
    if (boss && run.ante === ANTES && !run.endless) { out.champion = true; run.phase = 'won'; }
    else run.phase = 'cashout';
  } else if (run.markers > 0 && !(boss && run.ante === ANTES && !run.endless)) {   // the house takes no markers at its own table
    run.markers--;
    out.marker = true;
    const lost = Math.ceil(run.money / 2);
    if (lost) out.rows.push(['The house keeps half your money', -lost]);
    run.money -= lost;
    out.total = -lost;
    run.phase = 'cashout';
  } else {
    out.over = true;
    run.phase = 'over';
  }
  run.last = out;
  return out;
}

// ---- the bar
const offerReg = (run, taken) => {
  const pool = REGULARS.filter(r => !run.regs.some(x => x.id === r.id) && !taken.includes(r.id));
  if (!pool.length) return null;
  const late = Math.min(1, (run.ante - 1) / 6);
  const r = weighted(run, pool, x => [0, 6 - 2 * late, 3 + late, 1 + 1.5 * late][x.tier]);
  return { kind: 'reg', id: r.id, price: PRICE[r.tier] };
};
const TIP_W = { high: 1, pair: 3, twopair: 4, trips: 4, straight: 3, flush: 5, full: 5, quads: 3, sflush: 1, five: 1 };
export const feltPrice = (run, id) => FELT_OF[id].price + 2 * run.felt.filter(Boolean).length;
const offerGood = (run, taken) => {
  for (let tries = 0; tries < 12; tries++) {
    const kind = weighted(run, ['tip', 'trick', 'felt'], k => ({ tip: 40, trick: 35, felt: 25 })[k]);
    let o;
    if (kind === 'tip') o = { kind, id: weighted(run, HANDS.map(h => h.id), id => TIP_W[id]), price: 3 };
    else if (kind === 'trick') {
      const t = pick(run, TRICKS.filter(t => t.id !== 'shave' || run.deck.length > MIN_DECK + 1));
      o = { kind, id: t.id, price: t.price };
    }
    else {
      const f = pick(run, FELT.filter(f => !f.most || run.felt.filter(x => x === f.id).length < f.most));
      if (!f || run.felt.every(Boolean)) continue;
      o = { kind, id: f.id, price: feltPrice(run, f.id) };
    }
    if (!taken.some(t => t.kind === o.kind && t.id === o.id)) return o;
  }
  return { kind: 'tip', id: 'pair', price: 3 };
};
function stock(run) {
  const regs = [], goods = [];
  for (let i = 0; i < 2; i++) { const o = offerReg(run, regs.map(r => r.id)); if (o) regs.push(o); }
  for (let i = 0; i < 3; i++) goods.push(offerGood(run, goods));
  return [...regs, ...goods];
}
export function openBar(run) {
  run.bar = { offers: stock(run), rerolls: 0, pending: null };
  run.phase = 'bar';
}
export const rerollCost = run => 3 + run.bar.rerolls;
export function reroll(run) {
  const cost = rerollCost(run);
  if (run.money < cost || run.bar.pending) return false;
  run.money -= cost; run.bar.rerolls++;
  run.bar.offers = stock(run);
  return true;
}
export function canBuy(run, i) {
  const o = run.bar.offers[i];
  if (!o || o.sold || run.bar.pending || run.money < o.price) return false;
  if (o.kind === 'reg' && run.regs.length >= SEATS) return false;
  if (o.kind === 'felt' && run.felt.every(Boolean)) return false;
  return true;
}
export function buy(run, i) {
  if (!canBuy(run, i)) return false;
  const o = run.bar.offers[i];
  run.money -= o.price; o.sold = true;
  if (o.kind === 'reg') run.regs.push({ id: o.id, n: 0 });
  else if (o.kind === 'tip') run.levels[o.id] = (run.levels[o.id] || 0) + 1;
  else if (o.kind === 'trick') {
    const ids = shuffle(run, run.deck.map(c => c.id)).slice(0, 7);
    run.bar.pending = { kind: 'trick', id: o.id, choices: ids, price: o.price, slot: i };
  } else run.bar.pending = { kind: 'felt', id: o.id, price: o.price, slot: i };
  return true;
}
// Put a bought trick or square back on the shelf, money returned.
export function cancelPending(run) {
  const p = run.bar.pending;
  if (!p) return;
  run.money += p.price; run.bar.offers[p.slot].sold = false; run.bar.pending = null;
}
export function applyTrick(run, ids) {
  const p = run.bar.pending;
  if (!p || p.kind !== 'trick') return false;
  const t = TRICK[p.id], picked = ids.filter(id => p.choices.includes(id)).slice(0, t.pick).map(id => cardById(run, id)).filter(Boolean);
  if (t.id === 'shave') {
    const can = Math.max(0, run.deck.length - MIN_DECK);
    const gone = new Set(picked.slice(0, can).map(c => c.id));
    run.deck = run.deck.filter(c => !gone.has(c.id));
    for (const k of Object.keys(run.kept)) if (gone.has(run.kept[k])) delete run.kept[k];
  } else if (t.id === 'copy') {
    for (const c of picked) run.deck.push({ ...c, id: run.nextId++ });
  } else if (t.dye !== undefined) {
    for (const c of picked) c.s = t.dye;
  } else {
    const mark = { wild: 'wild', chalk: 'bonus', redpen: 'mult', glass: 'glass' }[t.id];
    for (const c of picked) c.e = mark;
  }
  run.bar.pending = null;
  return true;
}
export function applyFelt(run, cell) {
  const p = run.bar.pending;
  if (!p || p.kind !== 'felt' || run.felt[cell]) return false;
  run.felt[cell] = p.id;
  if (p.id !== 'keeper') delete run.kept[cell];
  run.bar.pending = null;
  return true;
}
export const sellPrice = r => Math.max(1, Math.floor(PRICE[REG[r.id].tier] / 2));
export function sell(run, seat) {
  const r = run.regs[seat];
  if (!r || (run.phase !== 'bar' && run.phase !== 'cashout' && run.phase !== 'table') || run.bar?.pending) return false;
  if (run.phase === 'table' && run.table?.asleep >= 0) return false;   // don't shuffle seats under The Pickpocket
  run.money += sellPrice(r);
  run.regs.splice(seat, 1);
  return true;
}
export function moveSeat(run, seat, dir) {
  const j = seat + dir;
  if (j < 0 || j >= run.regs.length || (run.phase === 'table' && run.table?.asleep >= 0)) return false;
  [run.regs[seat], run.regs[j]] = [run.regs[j], run.regs[seat]];
  return true;
}
export function leaveBar(run) {
  if (run.phase !== 'bar' || run.bar.pending) return false;
  if (run.stage === 0) run.stage = 1;
  else { run.stage = 0; run.ante++; }
  if (run.ante > ANTES && run.stage === 0) run.endlessBoss = pick(run, BOSSES.map(b => b.id));   // after hours: a new rule each ante
  run.bar = null;
  startTable(run);
  return true;
}
// After beating the house: keep going, ante by ante, until a table beats you.
export function keepPlaying(run) {
  if (run.phase !== 'won') return false;
  run.endless = true;
  run.phase = 'cashout';
  return true;
}
// What the next table holds, for the bar's chalkboard.
export function nextTable(run) {
  const stage = run.stage === 0 ? 1 : 0, ante = run.stage === 0 ? run.ante : run.ante + 1;
  const boss = stage === 1 ? (ante <= ANTES ? run.bosses[ante - 1] : run.endlessBoss) || null : null;
  return { ante, stage, boss, target: targetFor(ante, stage, boss) };
}
