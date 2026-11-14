// Headless balance sim: node moonrise/sim.mjs [games] [bot]
// bots: smart (look-ahead liar), honest (tells the truth, random prey), random
import * as R from './rules.js';

export function bestPlan(g, opts = {}) {
  let best = null;
  for (const v of g.alive.filter(id => R.canTake(g, id))) {
    for (const lurk of R.lurkRooms(g, v)) {
      const rep = R.lurkReport(g, lurk);
      if (rep.awake.length) continue;
      for (const claim of R.ROOMS.map((_, i) => i)) {
        if (claim === R.night(g).room[v]) continue;
        const c = R.clone(g);
        R.hunt(c, lurk, v); R.dawn(c); R.testimony(c, claim);
        let mine = R.score(c, R.YOU);
        if (R.isCleared(c, R.YOU)) mine -= 6;
        if (claim === lurk && c.alive.includes('doctor')) mine += 7;
        if (rep.colonel && claim === lurk) mine += 3;      // the Colonel may remember
        const others = R.candidates(c, 'colonel').filter(p => p !== R.YOU).map(p => R.score(c, p));
        const top = others.length ? Math.max(...others) : 0;
        let val = mine - top;
        if (v === 'doctor') val -= 2; if (v === 'cook') val -= 1;
        if (g.sworn.some(s => s.target === v)) val += 6;
        val += (opts.noise || 0) * Math.random();
        if (!best || val < best.val) best = { v, lurk, claim, val };
      }
    }
  }
  return best;
}

function play(seed, bot) {
  const g = R.newGame(seed);
  let exiles = 0;
  while (!g.over) {
    let plan;
    if (bot === 'smart') plan = bestPlan(g, { noise: 1 });
    else if (bot === 'sloppy') {
      // avoids awake rooms, lies to an empty room the cook can't hear, no look-ahead
      const opts = [];
      for (const v of g.alive.filter(id => R.canTake(g, id))) for (const l of R.lurkRooms(g, v)) if (!R.lurkReport(g, l).awake.length) opts.push({ v, l });
      const o = opts[Math.floor(Math.random() * opts.length)] || { v: g.alive.find(id => R.canTake(g, id)), l: R.lurkRooms(g, g.alive.find(id => R.canTake(g, id)))[0] };
      const nt = R.night(g);
      const used = new Set(Object.values(nt.room));
      const cookR = g.alive.includes('cook') ? nt.room.cook : -9;
      let cl = R.claimable(g).filter(r => !used.has(r) && !R.adjacent(r, cookR) && r !== o.l && r !== R.RI.conserv);
      if (R.lurkReport(g, o.l).colonel && Math.random() < .5) cl = [o.l];
      plan = { v: o.v, lurk: o.l, claim: cl.length ? cl[Math.floor(Math.random() * cl.length)] : o.l };
    }
    else {
      const vs = g.alive.filter(id => R.canTake(g, id));
      const v = vs[Math.floor(Math.random() * vs.length)];
      const ls = R.lurkRooms(g, v);
      const lurk = ls[Math.floor(Math.random() * ls.length)];
      const cl = R.claimable(g);
      plan = { v, lurk, claim: bot === 'honest' ? lurk : cl[Math.floor(Math.random() * cl.length)] };
    }
    R.hunt(g, plan.lurk, plan.v);
    R.dawn(g);
    R.testimony(g, plan.claim);
    if (bot === 'smart' || bot === 'sloppy') {
      const others = R.candidates(g, 'colonel').filter(p => p !== R.YOU).sort((a, b) => R.score(g, b) - R.score(g, a));
      const t = others.find(p => !g.confirmations[`${g.n}:${p}`]);
      const nt = R.night(g), cheap = R.adjacent(nt.claims.you, nt.vroom) && !g.confirmations[`${g.n}:you`];
      if (t && cheap && R.score(g, R.YOU) >= R.score(g, t) - 3) R.remark(g, 'swear', t);
      else if (t) R.remark(g, 'doubt', t);
      else R.remark(g, 'quiet');
    } else R.remark(g, 'quiet');
    R.chatter(g);
    const others = R.candidates(g, 'colonel').filter(p => p !== R.YOU).sort((a, b) => R.score(g, b) - R.score(g, a));
    const unc = R.candidates(g, 'colonel').length;
    (globalThis.UNC ||= {})[g.n] ||= []; UNC[g.n].push(unc);
    const res = R.resolveVote(g, bot === 'random' ? null : others[0]);
    if (res.out && res.out !== R.YOU) exiles++;
    if (res.out === R.YOU) g.unc = unc;
    if (!g.over) R.startNight(g);
  }
  return { win: g.over.win, why: g.over.why, n: g.over.n, exiles, you: R.score(g, R.YOU), m: g.marks.you, unc: g.unc };
}

if (typeof process !== "undefined" && import.meta.url === `file://${process.argv[1]}`) {
  const N = +(process.argv[2] || 200), bot = process.argv[3] || 'smart';
  const res = [];
  for (let i = 0; i < N; i++) res.push(play(1000 + i, bot));
  const wins = res.filter(r => r.win).length;
  const byN = {}; for (const r of res.filter(r => !r.win)) byN[r.n] = (byN[r.n] || 0) + 1;
  const why = {}; for (const r of res) why[r.why] = (why[r.why] || 0) + 1;
  const ex = res.reduce((a, r) => a + r.exiles, 0) / N;
  const mk = {}; for (const r of res.filter(r => !r.win)) for (const k in r.m) mk[k] = (mk[k] || 0) + r.m[k];
  console.log(bot, `win ${(100 * wins / N).toFixed(0)}%`, 'lost on day', byN, why, 'avg innocent exiles', ex.toFixed(2));
  console.log('avg uncleared (incl you) by day', Object.fromEntries(Object.entries(UNC).map(([k, a]) => [k, +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2)])));
  const uc = {}; for (const r of res.filter(r => !r.win)) uc[r.unc] = (uc[r.unc] || 0) + 1; console.log('uncleared at loss', uc);
  console.log('losers marks', Object.fromEntries(Object.entries(mk).filter(([, v]) => v).map(([k, v]) => [k, +(v / Math.max(1, N - wins)).toFixed(2)])));
}
