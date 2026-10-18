// Headless check: run each level's reference bridge (and a few naive ones) and report.
// node spaghetti/check.mjs [levelIndex] [--naive]
import { LEVELS } from './levels.js';
import { Sim, designCost, MAT } from './physics.js';

const only = process.argv[2] && !process.argv[2].startsWith('-') ? +process.argv[2] : null;

export function run(level, members, maxT = 40) {
  const sim = new Sim(level, members);
  const peak = {};
  let t = 0;
  while (!sim.result && t < maxT) {
    sim.step(1 / 60); t += 1 / 60;
    for (const c of sim.cs) {
      if (!c.mat || c.debris || c.broken) continue;
      const s = sim.stress(c);
      const k = c.mat.key + (c.f > 0 ? '+' : '-');
      peak[k] = Math.max(peak[k] || 0, s);
    }
  }
  return { result: sim.result || 'timeout', why: sim.failWhy, t: +t.toFixed(1), breaks: sim.breaks, first: sim.firstBreak, peak };
}

const naive = {
  // decks with nothing under them
  deckOnly: lv => {
    const ys = lv.anchors[0][1], x0 = lv.anchors[0][0], x1 = lv.anchors[1][0];
    const r = []; let x = x0;
    while (x < x1) { const nx = Math.min(x1, x + 3); r.push({ a: [x, ys], b: [nx, lv.anchors[1][1]], mat: 'lasagne' }); x = nx; }
    return r;
  },
};

LEVELS.forEach((lv, i) => {
  if (only !== null && i !== only) return;
  const res = run(lv, lv.ref);
  const pk = Object.entries(res.peak).map(([k, v]) => k + ' ' + v.toFixed(2)).join('  ');
  console.log(`${i + 1}. ${lv.name.padEnd(18)} ref: ${res.result.padEnd(5)} ${res.why} t=${res.t} breaks=${res.breaks} cost=${designCost(lv.ref).toFixed(1)}/${lv.budget}  ${pk}${res.first ? '  first=' + JSON.stringify(res.first) : ''}`);
  if (process.argv.includes('--naive')) {
    for (const [nm, f] of Object.entries(naive)) {
      const d = f(lv); const r = run(lv, d);
      console.log(`     ${nm}: ${r.result} ${r.why} breaks=${r.breaks} cost=${designCost(d).toFixed(1)}`);
    }
  }
});
