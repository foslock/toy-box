// Headless checks of every race, with no page: that doing nothing loses, that the written solution wins (using only
// what the player is given, in the number of things the par says), that a race always runs the same way, and that
// a copy of the race at a lap break (what Rewind goes back to) runs on exactly as the original does.
//
//   node rigged/check.mjs            → every race
//   node rigged/check.mjs 3 7        → just these
//   node rigged/check.mjs 3 -v       → and what happened in the solution's race
//   node rigged/check.mjs --rand 500 → and how hard each is: how many of 500 plans made at random win, and the
//                                      fewest things one of them used (for tuning levels.js)
import { buildTrack, lanesAt } from './track.js';
import { TRACKS } from './tracks.js';
import { LEVELS } from './levels.js';
import { RACERS, TRAP_IDS } from './data.js';
import { playThrough, goalState, copy, step, doStep, newRace, place, cellAt, whyNot, arm, setGate } from './sim.js';

const args = process.argv.slice(2), V = args.includes('-v');
const ri = args.indexOf('--rand'), RAND = ri >= 0 ? +args[ri + 1] || 500 : 0;
const only = args.filter((a, i) => /^\d+$/.test(a) && (ri < 0 || i !== ri + 1)).map(Number);

// Random plans: each lap, some of what's in stock goes down somewhere it's allowed, at the lap's start or at some
// moment in it; traps get armed and gates flipped now and then.
function randomPlans(T, L, N) {
  let seed = 12345, wins = 0, fewest = Infinity;
  const R = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let trial = 0; trial < N; trial++) {
    const S = newRace(T, L), plan = [], idle = .2 + R() * .6;
    let lapT = 0;
    const schedule = () => {
      for (const k of Object.keys(S.stock)) for (let i = 0; i < (S.stock[k] || 0); i++) if (R() > idle) plan.push({ at: lapT + (R() < .35 ? 0 : R() * 15), kind: k });
      for (const g of Object.keys(S.gates)) if (R() < .3) plan.push({ at: lapT + R() * 15, gate: g });
      plan.sort((a, b) => a.at - b.at);
    };
    schedule();
    while (!S.over) {
      while (plan.length && plan[0].at <= S.t + 1e-9) {
        const a = plan.shift();
        if (a.gate) { setGate(S, a.gate, S.gates[a.gate] === false); continue; }
        if (TRAP_IDS.includes(a.kind)) { const f = S.fx.find(f => f.kind === a.kind); if (f && !f.armed) arm(S, f.id, true); continue; }
        for (let tries = 0; tries < 40; tries++) {
          const p = T.paths[R() < .8 || T.paths.length === 1 ? 0 : 1 + Math.floor(R() * (T.paths.length - 1))], s = R() * p.L, ls = lanesAt(p, s);
          const cell = cellAt(T, p.id, s, ls[Math.floor(R() * ls.length)]);
          if (cell && !whyNot(S, T, a.kind, cell)) { place(S, T, a.kind, cell); break; }
        }
      }
      step(S, T);
      for (const e of S.ev) if (e.type === 'lap') { lapT = S.t; schedule(); }
      S.ev.length = 0;
    }
    if (goalState(S, L).every(Boolean)) { wins++; fewest = Math.min(fewest, S.used); }
  }
  return { wins, fewest };
}
const tracks = {};
let bad = 0;
const order = S => S.karts.slice().sort((a, b) => a.place - b.place).map(k => `${k.who} ${k.finT.toFixed(2)}`).join(', ');
for (const [i, L] of LEVELS.entries()) {
  if (only.length && !only.includes(i + 1)) continue;
  const T = tracks[L.track] ||= buildTrack(TRACKS[L.track]);
  const problems = [];
  const racing = L.racers.map(r => typeof r === 'string' ? r : r.who);
  for (const g of L.goal) for (const w of [g.who, g.ahead, g.behind]) if (w && !racing.includes(w)) problems.push(`goal names ${w}, who isn't racing`);
  for (const w of racing) if (!RACERS[w]) problems.push(`no racer called ${w}`);
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
  if (RAND) { const r = randomPlans(T, L, RAND); console.log(`      ${r.wins} of ${RAND} random plans win (${(r.wins / RAND * 100).toFixed(1)}%)${r.wins ? `, the leanest with ${r.fewest}` : ''}`); }
}
console.log(bad ? `${bad} race${bad === 1 ? '' : 's'} with problems` : 'All races check out.');
process.exit(bad ? 1 : 0);
