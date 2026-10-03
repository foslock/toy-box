// Plays the whole game headless with a few kinds of pretend player (bot.js) and reports how long each phase takes and
// the longest stretch with nothing new to buy. For tuning content.js.
//
//   node starter/check.mjs              → every bot, a line each, plus the checks
//   node starter/check.mjs -v steady    → one bot, with a timeline of what it bought and its numbers every 30 s
import * as G from './sim.js';
import { BOTS, playTo } from './bot.js';

const args = process.argv.slice(2);
const VERBOSE = args.includes('-v');
const only = args.filter(a => !a.startsWith('-'));
const mm = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const f = x => x == null ? '-' : x >= 1e5 || (x < 0.01 && x > 0) ? x.toExponential(1) : (+x.toFixed(2)).toString();

let failed = 0;
const check = (what, ok, extra = '') => { if (!ok) { failed++; console.log(`  ✗ ${what} ${extra}`); } };

for (const kind of only.length ? only : Object.keys(BOTS)) {
  const t0 = Date.now();
  const lines = [];
  let seen = 0;
  const { s, bot } = playTo(() => false, {
    kind,
    onStep(s, bot) {
      for (; seen < bot.bought.length; seen++) {
        const b = bot.bought[seen];
        if (!b.maker || /×([1-3]|\d*[16])$/.test(b.what)) lines.push(`${mm(b.t).padStart(6)}  ${'·'.repeat(b.phase + 1).padEnd(4)} ${b.maker ? '  ' : ''}${b.what}`);
      }
      if (VERBOSE && Math.floor(s.t / 30) !== Math.floor((s.t - 0.1) / 30)) {
        const r = s._r;
        lines.push(`${mm(s.t).padStart(6)}  ${'·'.repeat(s.phase + 1).padEnd(4)} [b ${f(s.b)} bps ${f(r.bps)} tap ${f(r.tapB)} g ${f(s.grams)} adm ${f(s.adm)} loaves ${f(s.loaves)} feeds ${s.feeds}` +
          (s.phase >= 1 ? ` | jars ${f(s.jars)} R ${f(r.R)} £${f(s.money)} mps ${f(r.mps)}` : '') +
          (s.phase >= 2 ? ` | hosts ${f(s.hosts)} sup ${f(r.supply)} dem ${f(r.demand)} flour ${f(r.flour)} mass ${f(s.massT)}` : '') +
          (s.phase >= 3 ? ` | ln ${f(s.lnSys)} w ${f(s.warmth)} over ${f(s.over)} g ${f(r.grow)}` : '') + ']');
      }
    },
  });
  // the longest stretch between purchases
  let worst = { gap: 0, at: 0, phase: 0 }, last = 0;
  for (const b of bot.bought.concat({ t: s.done ? s.endedAt : s.t, phase: s.phase })) {
    if (b.t - last > worst.gap) worst = { gap: b.t - last, at: last, phase: b.phase };
    last = b.t;
  }
  const at = s.phaseAt.concat(s.done ? s.endedAt : s.t);
  const legs = at.slice(1).map((t, i) => mm(t - at[i]));
  if (VERBOSE) console.log(lines.join('\n'));
  console.log(`${kind.padEnd(7)} ${s.done ? 'ended' : 'STUCK'} at ${mm(s.done ? s.endedAt : s.t)}   phases ${legs.join(' / ')}   ` +
    `longest wait ${Math.round(worst.gap)}s (phase ${worst.phase + 1} at ${mm(worst.at)})   taps ${s.clicks}   collapses ${s.collapses}   (${Date.now() - t0} ms)`);
  check(`${kind} finishes`, s.done);
  if (kind === 'eager' || kind === 'steady') check(`${kind} never waits over 2 minutes`, worst.gap < 120, `(${Math.round(worst.gap)}s)`);
  else check(`${kind} never waits over 5 minutes`, worst.gap < 300, `(${Math.round(worst.gap)}s)`);
}

// Catching up after the tab was closed gives the same result as ticking along with it open, near enough.
{
  const a = G.fresh(3), b = G.fresh(3);
  for (const s of [a, b]) { for (let i = 0; i < 40; i++) G.tap(s); G.tick(s, 0.1); G.buy(s, 'wild'); }
  for (let i = 0; i < 6000; i++) G.tick(a, 0.1);
  G.catchUp(b, 600);
  check('catch-up matches ticking', Math.abs(a.b - b.b) / a.b < 0.05, `${a.b.toFixed(0)} vs ${b.b.toFixed(0)}`);
}
// A save survives JSON, mid-game in every phase.
for (const phase of [0, 1, 2, 3]) {
  const { s } = playTo(s => s.phase === phase && s.t - s.phaseAt[phase] > 60);
  const t = JSON.parse(JSON.stringify(s));
  for (let i = 0; i < 100; i++) { G.tick(t, 0.1); G.tick(s, 0.1); }
  check(`save round-trips in phase ${phase + 1}`, Math.abs(t.b - s.b) <= 1e-9 * s.b && t.phase === s.phase);
}
// Overproofing on purpose collapses, and you can still finish afterwards.
{
  const { s } = playTo(s => s.phase === 3 && s.t - s.phaseAt[3] > 30);
  const was = s.lnSys;
  for (let i = 0; i < 600 && !s.collapses; i++) { G.setWarmth(s, 1); G.tick(s, 0.1); }
  check('too warm collapses', s.collapses === 1 && s.lnSys < was * 1.2, `collapses ${s.collapses}`);
}
console.log(failed ? `${failed} check(s) failed` : 'all checks pass');
process.exit(failed ? 1 : 0);
