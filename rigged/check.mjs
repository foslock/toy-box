// Headless checks of every race, with no page: that doing nothing loses, that the written solution wins (using only
// what the player is given, in the number of things the par says), that a race always runs the same way, and that
// a copy of the race at a lap break (what Rewind goes back to) runs on exactly as the original does.
//
//   node rigged/check.mjs            → every race
//   node rigged/check.mjs 3 7        → just these
//   node rigged/check.mjs 3 -v       → and what happened in the solution's race
import { buildTrack } from './track.js';
import { TRACKS } from './tracks.js';
import { LEVELS } from './levels.js';
import { RACERS } from './data.js';
import { playThrough, goalState, copy, step, doStep } from './sim.js';

const args = process.argv.slice(2), V = args.includes('-v'), only = args.filter(a => /^\d+$/.test(a)).map(Number);
const tracks = {};
let bad = 0;
const order = S => S.karts.slice().sort((a, b) => a.place - b.place).map(k => `${k.who} ${k.finT.toFixed(2)}`).join(', ');
for (const [i, L] of LEVELS.entries()) {
  if (only.length && !only.includes(i + 1)) continue;
  const T = tracks[L.track] ||= buildTrack(TRACKS[L.track]);
  const problems = [];
  for (const g of L.goal) for (const w of [g.who, g.ahead, g.behind]) if (w && !L.racers.includes(w)) problems.push(`goal names ${w}, who isn't racing`);
  for (const w of L.racers) if (!RACERS[w]) problems.push(`no racer called ${w}`);
  if (L.stock.length !== L.laps) problems.push(`stock for ${L.stock.length} laps, race is ${L.laps}`);
  const base = playThrough(T, L, []);
  if (goalState(base, L).every(Boolean)) problems.push('already won with nothing done');
  const log = [];
  const sol = playThrough(T, L, L.solution, V ? { onStep: S => { for (const e of S.ev) if (!['place', 'finish', 'over'].includes(e.type)) log.push(`   ${S.t.toFixed(2)} ${e.type} ${e.k != null ? S.karts[e.k].who : ''} ${e.kind || e.item || e.lap || ''}`); } } : {});
  if (sol.fails.length) problems.push(`solution steps that couldn't be done: ${JSON.stringify(sol.fails)}`);
  if (!goalState(sol, L).every(Boolean)) problems.push('the solution doesn’t win');
  if (sol.used !== L.par) problems.push(`solution uses ${sol.used}, par is ${L.par}`);
  const again = playThrough(T, L, L.solution);
  if (order(again) !== order(sol)) problems.push('two runs of the solution came out differently');
  // rewind: copy the race at the second lap break and run both on
  let snap = null;
  const orig = playThrough(T, L, L.solution, { onLap: (S, lap) => { if (lap === 2 && !snap) snap = copy(S); } });
  if (snap) {
    // carry the copy on as the original went: the later laps' steps at their laps, the timed ones at their times
    const timed = L.solution.filter(st => st.t != null && st.t > snap.t).sort((a, b) => a.t - b.t);
    while (!snap.over) {
      while (timed.length && snap.t >= timed[0].t - 1e-9) doStep(snap, T, timed.shift());
      step(snap, T);
      for (const e of snap.ev) if (e.type === 'lap') for (const st of L.solution) if (st.t == null && st.lap === e.lap) doStep(snap, T, st);
      snap.ev.length = 0;
    }
    if (order(snap) !== order(orig)) problems.push('a copy taken at lap 2 runs on differently');
  }
  const ok = !problems.length;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${String(i + 1).padStart(2)} ${L.name.padEnd(18)} ${L.track.padEnd(8)} par ${L.par}  base: ${order(base).split(', ').map(s => s.split(' ')[0]).join(' ')}`);
  for (const p of problems) console.log('      ' + p);
  if (V) { console.log('    solution: ' + order(sol)); for (const l of log) console.log(l); }
}
console.log(bad ? `${bad} race${bad === 1 ? '' : 's'} with problems` : 'All races check out.');
process.exit(bad ? 1 : 0);
