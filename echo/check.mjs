// Headless play-through: node echo/check.mjs [section]
//   - the guide (route.js) walks, swims and pushes from the first section (or the one named) to the wood outside
//   - reports time per section, the least breath left on each swim, rocks pushed, and anything that went wrong
//   - then checks a few ways things should NOT work: you can't step over the gap, a rock can't climb the step
import { Sim, DT, HZ } from './sim.js';
import { Bot } from './route.js';
import { SECTIONS, CLIFF_X } from './world.js';

let bad = 0; const fail = m => { bad++; console.log('  FAIL', m); };
const from = process.argv[2] !== undefined ? +process.argv[2] : 0;

{
  const sim = new Sim(from), bot = new Bot(sim, from);
  let secT = 0, minBreath = 1, sec = from, drowned = 0;
  const t0 = performance.now();
  for (let n = 0; n < HZ * 60 * 30 && !bot.done; n++) {
    const inp = bot.input(DT);
    sim.step(inp);
    secT += DT;
    minBreath = Math.min(minBreath, sim.p.breath);
    for (const e of sim.drain()) {
      if (e.type === 'cp') {
        console.log(`${String(sec).padStart(2)}. ${SECTIONS[sec].name.padEnd(15)} ${secT.toFixed(1).padStart(5)}s` + (minBreath < 1 ? `   least breath ${(minBreath * 100).toFixed(0)}%` : ''));
        if (e.cp !== sec + 1) fail(`skipped from section ${sec} to ${e.cp}`);
        sec = e.cp; secT = 0; minBreath = 1;
      }
      if (e.type === 'drown') { drowned++; fail(`drowned in ${SECTIONS[sim.cp].name} at (${sim.p.x.toFixed(1)}, ${sim.p.y.toFixed(1)}, ${sim.p.z.toFixed(1)})`); bot.done = true; }
      if (e.type === 'thud') console.log(`    a rock dropped ${e.speed.toFixed(1)} m/s: ${e.rock.def.id} at (${e.rock.x.toFixed(2)}, ${e.rock.y.toFixed(2)}, ${e.rock.z.toFixed(2)})`);
    }
    if (!Number.isFinite(sim.p.x + sim.p.y + sim.p.z)) { fail('position went bad'); break; }
  }
  for (const l of bot.log) fail(l);
  if (sim.p.x < CLIFF_X + 5) fail(`didn't get out: ended at (${sim.p.x.toFixed(1)}, ${sim.p.y.toFixed(1)}, ${sim.p.z.toFixed(1)}) in ${SECTIONS[sim.cp].name}`);
  else console.log(`${String(sec).padStart(2)}. ${SECTIONS[sec].name.padEnd(15)} ${secT.toFixed(1).padStart(5)}s   and out into the wood`);
  console.log(`   (${((performance.now() - t0) / 1000).toFixed(1)}s to simulate)`);
}

// You can't just walk over the gap without the rock.
{
  const sim = new Sim(8);
  const p = sim.p; p.x = 148.5; p.z = -172; p.y = -10.8; p.yaw = Math.atan2(-1, 0);
  for (let n = 0; n < HZ * 6; n++) sim.step({ fx: 0, fz: -1, yaw: p.yaw, pitch: 0 });
  if (p.x > 153) fail(`walked across the gap without the rock (${p.x.toFixed(2)})`);
  else console.log(`\ngap without the rock: stopped at x ${p.x.toFixed(2)}, y ${p.y.toFixed(2)}${p.stuckT > 1 ? ', stuck in the pit' : ''}`);
}
// A rock pushed toward the long swim stops at the step up.
{
  const sim = new Sim(6);
  const r = sim.rocks.find(r => r.def.id === 'door');
  r.x = 86.5; r.z = -168; r.y = -10.3;
  const p = sim.p; p.x = 85.2; p.z = -168; p.y = -10.8;
  for (let n = 0; n < HZ * 6; n++) sim.step({ fx: 0, fz: -1, yaw: Math.atan2(-1, 0), pitch: 0 });
  if (r.x > 88.4) fail(`a rock got pushed up the step into the long swim (${r.x.toFixed(2)})`);
  else console.log(`rock at the step: stopped at x ${r.x.toFixed(2)}`);
}
console.log(bad ? `\n${bad} problems` : '\nall ok');
