// Plays whole games headless with the pretend players (bot.js) and reports how they end and when. For tuning.
//   node giveover/check.mjs                 → every bot from a few origins
//   node giveover/check.mjs -v smart usa    → one game with a timeline
import * as G from './sim.js';
import { playTo, BOTS } from './bot.js';
import { REGIONS } from './content.js';

const args = process.argv.slice(2);
const VERBOSE = args.includes('-v');
const rest = args.filter(a => !a.startsWith('-'));
const mm = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const f = x => x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2);

function run(kind, origin, seed = 11, diff = 'normal') {
  const lines = [];
  let lastY = 0, nb = 0;
  const { s, bot } = playTo(() => false, {
    kind, origin, seed, diff,
    onStep(s, bot) {
      if (!VERBOSE) return;
      for (; nb < bot.bought.length; nb++) lines.push(`  ${s.y.toFixed(1)} ${mm(bot.bought[nb].t)}  + ${bot.bought[nb].id}`);
      if (Math.floor(s.y) !== lastY) {
        lastY = Math.floor(s.y);
        const w = G.world(s), st = G.stats(s);
        lines.push(`${lastY} ${mm(s.t)} hype ${f(s.hype)} iq ${f(s.iq)} | on ${f(w.online)} users ${f(w.users)} asst ${f(w.assisted)} gone ${f(w.gone)} | ` +
          `alarm ${f(st.alarm)} C ${G.concern(s).toFixed(2)} res ${f(s.research)} (+${f(G.researchRate(s))}/y) | seeded ${s.r.filter(r => r.seeded).length} ` +
          `reg ${s.r.filter(r => r.reg).length} cut ${s.r.filter(r => r.cut).length} ban ${s.r.filter(r => r.ban).length}`);
      }
    },
  });
  if (VERBOSE) console.log(lines.join('\n'));
  const o = s.over || { kind: 'TIMEOUT', y: s.y, t: s.t };
  const agi = s.owned.agi ? s.owned.agi.toFixed(1) : '-';
  console.log(`${kind.padEnd(8)} ${origin.padEnd(10)} ${diff.padEnd(6)} ${o.kind.padEnd(9)} ${o.y.toFixed(1)}  ${mm(o.t)}  agi ${agi}  turn ${s.owned.turn ? s.owned.turn.toFixed(1) : '-'}  ` +
    `bought ${s.stats.bought.length}  spent ${s.stats.spent}  popped ${s.stats.popped}/${s.stats.popped + s.stats.missed}  research ${s.research.toFixed(0)}`);
  return s;
}

if (rest.length) run(rest[0], rest[1] || 'usa', +(rest[2] || 11), rest[3] || 'normal');
else {
  // what a balanced game looks like: a careful player wins in 15–20 minutes, a decent one usually does, careless ones lose sooner
  let failed = 0;
  const check = (what, ok) => { if (!ok) { failed++; console.log(`  ✗ ${what}`); } };
  const games = {};
  for (const kind of Object.keys(BOTS)) for (const origin of ['usa', 'india', 'westeu', 'brazil']) (games[kind] ||= []).push(run(kind, origin));
  for (const s of games.smart) check(`smart from ${s.origin} wins in 14–20 min`, s.over?.kind === 'win' && s.over.t > 14 * 60 && s.over.t < 20 * 60);
  check('decent wins at least half its games', games.decent.filter(s => s.over?.kind === 'win').length >= 2);
  for (const k of ['reckless', 'random', 'idle']) for (const s of games[k]) check(`${k} from ${s.origin} loses`, s.over && s.over.kind !== 'win');
  for (const s of games.reckless) check(`reckless from ${s.origin} loses before 14 min`, s.over && s.over.t < 14 * 60);
  for (const diff of ['easy', 'hard']) run('smart', 'usa', 11, diff);
  console.log(failed ? `${failed} checks failed` : 'all checks passed');
}
