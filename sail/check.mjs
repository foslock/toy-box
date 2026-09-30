// Headless checks of every level, with no page: that each can be won, in how many ways, which of the crew's orders it
// can't be won without, how often reaching a buoy leaves a voyage that can't be finished, and how likely a scroll of
// orders put down at random is to reach each mark (the lower, the harder). For designing levels.js.
//
//   node sail/check.mjs              → every level
//   node sail/check.mjs 4 9-13       → just these
//   node sail/check.mjs 7 --show 3   → and up to three ways through each
//   node sail/check.mjs 7 --draw     → with the first way drawn on the map, step by step
import { LEVELS } from './levels.js';
import { parse, initialState, step, ORDER_IDS, ORDERS } from './rules.js';
import { navigator } from './solve.js';

const keyOf = (s, pool, ids) => [s.x, s.y, s.dir, s.sail, s.anc, s.broken, ...s.beasts.flatMap(b => [b.i, b.d]), ...ids.map(o => pool[o] || 0)].join(',');
// sequences of m orders that can be drawn from a pool
function fills(pool, m, ids) {
  const counts = ids.map(o => pool[o] || 0);
  const memo = new Map();
  const f = (i, left) => {
    if (left === 0) return 1;
    if (i === counts.length) return 0;
    const k = i + ':' + left;
    if (memo.has(k)) return memo.get(k);
    // choose how many of order i go in, and where: multinomial built up one kind at a time
    let n = 0, c = 1;
    for (let t = 0; t <= Math.min(counts[i], left); t++) { n += c * f(i + 1, left - t); c = c * (left - t) / (t + 1); }
    memo.set(k, n);
    return n;
  };
  return f(0, m);
}

// Every way to finish one leg from a state: the distinct places (and pools) she can end up at the mark, how many of
// all the scrolls that could be written succeed, and the fewest orders it can be done in.
function legOutcomes(lv, s0, pool0, leg, ids) {
  const N = lv.legs[leg], out = new Map();
  let good = 0, fewest = Infinity;
  const rec = (s, k, pool) => {
    for (const o of ids) {
      if (!(pool[o] > 0)) continue;
      const r = step(lv, s, o, lv.marks[leg]);
      pool[o]--;
      if (!r.wreck) {
        if (r.touched) {
          good += fills(pool, N - k - 1, ids);
          fewest = Math.min(fewest, k + 1);
          const kk = keyOf(r.s, pool, ids);
          if (!out.has(kk)) out.set(kk, { s: r.s, pool: { ...pool } });
        } else if (k + 1 < N) rec(r.s, k + 1, pool);
      }
      pool[o]++;
    }
  };
  rec(s0, 0, { ...pool0 });
  return { ends: [...out.values()], good, all: fills(pool0, N, ids), fewest };
}

export function describe(lv, sol) {
  const parts = [];
  let s = initialState(lv), leg = 0, cur = [];
  for (const o of sol) {
    const r = step(lv, s, o, lv.marks[leg]);
    cur.push(o === 'anchor' ? (r.s.anc ? 'Drop' : 'Weigh') : ORDERS[o].name);
    s = r.s;
    if (r.touched) { parts.push(cur.join(' ')); cur = []; leg++; }
  }
  return parts.map((p, i) => `      ${i === lv.legs.length - 1 ? 'H' : i + 1}: ${p}`).join('\n');
}

// The map, with where she is after each step of a way through (the last step to reach a square is shown, 1-9 then
// a-z), where each creature starts (W whale, S shark...) and the marks.
export function draw(lv, sol) {
  const grid = lv.map.map(r => [...r]);
  const put = (x, y, c) => { if (y >= 0 && y < lv.H && x >= 0 && x < lv.W) grid[y][x] = c; };
  lv.marks.forEach((m, k) => put(m % lv.W, Math.floor(m / lv.W), k === lv.marks.length - 1 ? 'H' : String(k + 1)));
  let s = initialState(lv), leg = 0, t = 0;
  put(s.x, s.y, 's');
  const sym = n => n < 10 ? String(n) : String.fromCharCode(87 + n);
  for (const o of sol) {
    const r = step(lv, s, o, lv.marks[leg]);
    s = r.s; t++;
    put(s.x, s.y, t < 36 ? sym(t) : '+');
    if (r.touched) leg++;
  }
  lv.beasts.forEach(b => { const p = b.path[b.phase]; put(p % lv.W, Math.floor(p / lv.W), b.kind[0].toUpperCase()); });
  return grid.map(r => '      ' + r.join(' ')).join('\n');
}

export function solutions(lv, limit) {
  const ids = ORDER_IDS.filter(o => lv.crew[o] > 0), nav = navigator(lv), sols = [];
  const rec = (s, leg, k, pool, path) => {
    if (sols.length >= limit) return;
    for (const o of ids) {
      if (!(pool[o] > 0)) continue;
      const r = step(lv, s, o, lv.marks[leg]);
      if (r.wreck) continue;
      pool[o]--; path.push(o);
      if (r.touched) {
        if (leg === lv.legs.length - 1) sols.push(path.slice());
        else if (nav.ways(r.s, leg + 1, pool) > 0) rec(r.s, leg + 1, 0, pool, path);
      } else if (k + 1 < lv.legs[leg] && nav.ways(r.s, leg, pool, k + 1) > 0) rec(r.s, leg, k + 1, pool, path);
      pool[o]++; path.pop();
    }
  };
  rec(initialState(lv), 0, 0, { ...lv.crew }, []);
  return sols;
}

// Everything about one level. legs: for each mark, the scroll's length, the fewest orders that reach it, what share of
// all scrolls reach it (from every way of arriving at its start), and how many ways of arriving there leave the voyage
// impossible to finish.
export function analyse(def) {
  const lv = parse(def), ids = ORDER_IDS.filter(o => lv.crew[o] > 0);
  const nav = navigator(lv), s0 = initialState(lv);
  const total = nav.ways(s0, 0, lv.crew);
  const needs = total ? ids.filter(o => navigator(lv).ways(s0, 0, { ...lv.crew, [o]: 0 }) === 0) : [];
  const spare = Object.values(lv.crew).reduce((a, b) => a + b, 0) - lv.legs.reduce((a, b) => a + b, 0);
  const legs = [];
  let starts = [{ s: s0, pool: { ...lv.crew } }];
  for (let leg = 0; leg < lv.legs.length && starts.length; leg++) {
    const next = new Map();
    let good = 0, all = 0, fewest = Infinity;
    for (const st of starts) {
      const o = legOutcomes(lv, st.s, st.pool, leg, ids);
      good += o.good; all += o.all; fewest = Math.min(fewest, o.fewest);
      for (const e of o.ends) next.set(keyOf(e.s, e.pool, ids), e);
    }
    const ends = [...next.values()];
    const dead = leg < lv.legs.length - 1 ? ends.filter(e => !nav.canFinish(e.s, leg + 1, e.pool)).length : 0;
    legs.push({ n: lv.legs[leg], fewest, odds: good / Math.max(1, all), starts: starts.length, arrive: ends.length, dead });
    starts = ends;
  }
  return { lv, ids, total, needs, spare, legs };
}

export function report(def, n = '', show = 1, drawIt = false) {
  let a;
  try { a = analyse(def); } catch (e) { console.log(`${String(n).padStart(2)} ${def.name}: ${e.message}`); return false; }
  const { lv, ids, total, needs, spare, legs } = a;
  console.log(`\n${String(n).padStart(2)} ${def.name}  ${lv.W}×${lv.H}  legs ${lv.legs.join('+')}  crew ${ids.map(o => `${ORDERS[o].name}${lv.crew[o]}`).join(' ')}  (spare ${spare})`);
  const missing = (def.needs || []).filter(o => !needs.includes(o));
  if (!total) console.log('   ✗ CAN’T BE WON');
  else console.log(`   ✓ ${total} ways through · can’t be done without: ${needs.map(o => ORDERS[o].name).join(', ') || 'nothing in particular'}` +
    (missing.length ? `   ✗ MEANT TO NEED ${missing.join(', ')}` : ''));
  legs.forEach((l, i) => console.log(`   ${i === lv.legs.length - 1 ? 'H' : i + 1}: ${l.n} orders (fewest ${l.fewest === Infinity ? '–' : l.fewest}) · from ${l.starts} start${l.starts === 1 ? '' : 's'}, ` +
    `${(100 * l.odds).toPrecision(2)}% of scrolls reach it · ${l.arrive} ways to arrive${l.dead ? `, ${l.dead} of them dead ends` : ''}`));
  if (total && show) solutions(lv, show).forEach((sol, i) => { console.log(describe(lv, sol)); if (drawIt && i === 0) console.log(draw(lv, sol)); console.log(); });
  return total > 0 && !missing.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const show = args.includes('--show') ? +args[args.indexOf('--show') + 1] : 1;
  const picks = new Set();
  args.forEach((a, i) => {
    if (a.startsWith('--') || args[i - 1] === '--show') return;
    const [a0, a1] = a.split('-').map(Number);
    for (let n = a0; n <= (a1 || a0); n++) picks.add(n);
  });
  let failed = 0;
  LEVELS.forEach((def, i) => { if ((!picks.size || picks.has(i + 1)) && !report(def, i + 1, show, args.includes('--draw'))) failed++; });
  if (failed) { console.log(`\n${failed} level(s) broken`); process.exit(1); }
}
