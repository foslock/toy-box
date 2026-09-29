// Headless balance runs: whole digs played by the stand-in player (autoplay.js), with no page, printing how long it
// takes to reach each layer and the core, and how the money and trips go. For tuning rules.js.
//
//   node burrow/balance.mjs                           → 'good' player, 6 seeds, up to 60 minutes each
//   node burrow/balance.mjs --style casual --seeds 4
//   node burrow/balance.mjs --style all --every 5     (every style; a row every 5 minutes)
import { Game } from './sim.js';
import { makePlayer } from './autoplay.js';
import { rng } from './world.js';
import { STRATA, UPGRADES } from './rules.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEEDS = +arg('seeds', 6), MINUTES = +arg('minutes', 60), EVERY = +arg('every', 0), FIRST = +arg('seed', 1);
const STYLES = arg('style', 'good') === 'all' ? ['good', 'casual', 'greedy'] : [arg('style', 'good')];
const DT = 1 / 60;
const mmss = s => s == null ? '  -  ' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`.padStart(5);

for (const style of STYLES) {
  console.log(`\n=== ${style} player, ${SEEDS} worlds, up to ${MINUTES} minutes ===`);
  console.log('seed      ' + STRATA.map(s => s.id.slice(0, 5).padStart(6)).join('') + '   core  trips faint  earned     finds  ms/min');
  const sum = [];
  for (let k = 0; k < SEEDS; k++) {
    const seed = FIRST + k * 7919;
    const game = new Game(seed);
    game.headless = true;
    const play = makePlayer(style, rng(seed + 5));
    const t0 = performance.now(), rows = [];
    let next = EVERY * 60;
    while (game.t < MINUTES * 60 && !game.won) {
      play(game);
      game.step(DT);
      game.events.length = 0; game.fx.length = 0;
      if (EVERY && game.t >= next) {
        next += EVERY * 60;
        rows.push(`   ${String(Math.round(game.t / 60)).padStart(3)}m  depth ${String(game.depth()).padStart(5)}  deepest ${String(game.stats.deepest).padStart(5)}  $${String(game.money).padStart(8)}  earned ${String(game.earned).padStart(9)}  trips ${String(game.stats.trips).padStart(3)}  up ${UPGRADES.map(u => u.id[0] + game.up[u.id]).join(' ')}  belly ${game.belly.toFixed(1)}/${game.cap()}`);
      }
    }
    const ms = performance.now() - t0, s = game.stats;
    const layers = STRATA.map((_, q) => q === 0 ? 0 : s.layerAt[q] ?? null);
    console.log(`${String(seed).padEnd(8)}  ${layers.map(v => mmss(v).padStart(6)).join('')}  ${mmss(game.wonAt).padStart(6)}  ${String(s.trips).padStart(5)} ${String(s.faints).padStart(5)}  ${('$' + game.earned.toLocaleString('en-US')).padStart(11)}  ${String(s.eaten).padStart(5)}  ${(ms / (game.t / 60)).toFixed(0).padStart(6)}`);
    for (const r of rows) console.log(r);
    sum.push({ won: game.wonAt, layers, trips: s.trips, faints: s.faints, earned: game.earned, up: { ...game.up } });
  }
  const done = sum.filter(r => r.won != null).map(r => r.won);
  const avg = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  console.log(`-- ${style}: reached the core in ${done.length}/${sum.length}` + (done.length ? `, ${mmss(Math.min(...done))}–${mmss(Math.max(...done))} (avg ${mmss(avg(done))})` : '') +
    `; per layer avg ` + STRATA.map((_, q) => { const v = sum.map(r => r.layers[q]).filter(x => x != null); return v.length ? mmss(avg(v)).trim() : '-'; }).join(' / ') +
    `; trips ${avg(sum.map(r => r.trips)).toFixed(1)}, faints ${avg(sum.map(r => r.faints)).toFixed(1)}`);
}
