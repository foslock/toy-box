// Headless checks: node tenofme/check.mjs [floor number]
//   - every floor parses, and its solution wins in exactly `par` runs, with how much of the last run is left over
//   - the solution without its earlier runs (just the last script, alone) does not win, so the floor needs its copies
//   - random players for a while on every floor, to catch crashes and stuck states
import { Game, RUN_TICKS, HZ, IN, MAX_RUNS } from './sim.js';
import { LEVELS } from './levels.js';
import { playRun, playSolution } from './bot.js';

let bad = 0; const fail = m => { bad++; console.log('  FAIL', m); };
const only = +process.argv[2] || 0;
const sec = t => (t / HZ).toFixed(2) + 's';

LEVELS.forEach((def, n) => {
  if (only && only !== n + 1) return;
  let g; try { g = new Game(def); } catch (e) { fail(`${n + 1} ${def.name}: ${e.message}`); return; }
  const log = [];
  const { end } = playSolution(g, def.solution, { onRun: (r, e, gg) => log.push(`run ${r + 1}: ${e.type} at ${sec(e.tick)}` + (e.by && !e.by.live ? ` (copy ${e.by.n + 1})` : '') + frozenNote(gg)) });
  console.log(`${n + 1}. ${def.name}  (par ${def.par})`);
  for (const l of log) console.log('   ' + l);
  if (end?.type !== 'win') fail(`${def.name}: solution did not win (${end?.type})`);
  else if (def.solution.length !== def.par) fail(`${def.name}: solution takes ${def.solution.length} runs, par is ${def.par}`);
  else console.log(`   won with ${sec(RUN_TICKS - end.tick)} to spare`);
  if (def.par > 1) {
    const solo = new Game(def); const e = playRun(solo, def.solution.at(-1));
    if (e.type === 'win') fail(`${def.name}: the last run wins on its own`);
    else console.log(`   last run alone: ${e.type} at ${sec(e.tick)}`);
  }
  for (const [label, runs] of def.also || []) {
    const h = new Game(def); const r = playSolution(h, runs);
    if (r.end?.type !== 'win') fail(`${def.name}: '${label}' should win (${r.end?.type})`); else console.log(`   ${label}: win in ${runs.length} runs`);
  }
  for (const [label, runs] of def.mustFail || []) {
    const h = new Game(def); const r = playSolution(h, runs);
    if (r.end?.type === 'win') fail(`${def.name}: '${label}' should not win`); else console.log(`   ${label}: ${r.end?.type}`);
  }
});

function frozenNote(g) { const f = g.copies.filter(c => !c.live && c.state === 'frozen').map(c => c.n + 1); const k = g.copies.filter(c => !c.live && c.state === 'caught').map(c => c.n + 1); return (f.length ? ` frozen:${f}` : '') + (k.length ? ` caught:${k}` : ''); }

// an earlier copy that reaches for a key you already took freezes where it stands
{
  const def = LEVELS.find(l => l.name === 'The Key'), g = new Game(def);
  playRun(g, [['idle', 3], ['go', 10], ['up'], ['go', 3], ['act'], ['go', 10], ['down'], ['go', 18], ['stop']]); g.next();
  playRun(g, [['go', 10], ['up'], ['go', 3], ['act'], ['go', 8], ['idle', 6], ['stop']]);
  const c = g.copies[0];
  if (c.state !== 'frozen' || c.why !== 'key') fail(`freeze: copy 1 should have frozen reaching for the key (${c.state} ${c.why})`);
  else console.log(`\nfreeze: copy 1 froze at ${sec(c.at)} reaching for a key that was already gone`);
  const d = def && g.L.doors[0]; if (d.unlocked) fail('freeze: the frozen copy still unlocked the door');
}

// random hands
let seed = 7; const R = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
LEVELS.forEach((def, n) => {
  if (only && only !== n + 1) return;
  const g = new Game(def);
  try {
    for (let run = 0; run < 40; run++) {
      g.start(); let held = 0;
      while (!g.ended) {
        if (R() < 0.04) held = [IN.L, IN.R, IN.U, IN.D, IN.L | IN.U, IN.R | IN.D, 0][(R() * 7) | 0];
        if (R() < 0.01) held |= IN.A; else if (R() < 0.05) held &= ~IN.A;
        if (R() < 0.0006) { g.stop(); break; }
        g.step(held);
        for (const c of g.copies) if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || c.y > g.L.H * 16) throw new Error('copy left the world ' + c.x + ',' + c.y);
      }
      g.drain();
      if (g.ended.type === 'win' || !g.canNext() || R() < 0.2) g.restart(); else if (g.ended.type === 'alarm') g.redo(); else g.next();
    }
  } catch (e) { fail(`${def.name}: random play crashed: ${e.stack}`); }
});
console.log(bad ? `\n${bad} problems` : '\nall floors ok');
