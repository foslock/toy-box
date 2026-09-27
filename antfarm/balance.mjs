// Headless balance runs: farms driven by a stand-in player (autoplay.js), with no page, printing how each colony grows
// and how much of the farm it digs out. For tuning rules.js.
//
//   node antfarm/balance.mjs                          → balanced player, 6 seeds, 60 minutes
//   node antfarm/balance.mjs --style greedy --seeds 4 --minutes 90
//   node antfarm/balance.mjs --style all --every 10   (idle, greedy and balanced; a row every 10 minutes)
import { Farm } from './sim.js';
import { makePlayer } from './autoplay.js';
import { mulberry32 } from './world.js';
import { W, H, AIR, SURFACE } from './rules.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEEDS = +arg('seeds', 6), MINUTES = +arg('minutes', 60), EVERY = +arg('every', 10), FIRST = +arg('seed', 1);
const STYLES = arg('style', 'balanced') === 'all' ? ['idle', 'greedy', 'balanced'] : [arg('style', 'balanced')];
const DT = +arg('dt', 0.1);

function dugShare(farm) {
  let dirt = 0, air = 0;
  for (let x = 0; x < W; x++) for (let y = SURFACE + 3; y < H; y++) { const i = y * W + x; if (y < farm.surf[x]) continue; if (farm.mat[i] === AIR) air++; else dirt++; }
  return air / (air + dirt);
}
const pad = (s, n) => String(s).padStart(n);

for (const style of STYLES) {
  console.log(`\n=== ${style} player, ${SEEDS} farms, ${MINUTES} minutes ===`);
  const summary = [];
  for (let k = 0; k < SEEDS; k++) {
    const seed = FIRST + k * 7919;
    const farm = new Farm(seed);
    farm.headless = true;
    const player = makePlayer(style, mulberry32(seed + 5));
    const t0 = performance.now();
    const rows = [];
    let peak = 0, lowFood = Infinity;
    for (let s = 0; s <= MINUTES * 60; s += DT) {
      player(farm);
      farm.step(DT);
      farm.changed.length = 0; farm.events.length = 0; farm.fx.length = 0;
      peak = Math.max(peak, farm.ants.length);
      if (farm.t > 300) lowFood = Math.min(lowFood, farm.food);
      const m = Math.round(farm.t / DT) * DT;
      if (Math.abs(m % (EVERY * 60)) < DT / 2 && m > 0) {
        const r = farm.rates(), sup = farm.supply(), types = {};
        for (const a of farm.ants) types[a.type] = (types[a.type] || 0) + 1;
        rows.push(`  ${pad(Math.round(m / 60), 3)}m  ants ${pad(farm.ants.length, 3)}  food ${pad(Math.floor(farm.food), 4)}  in ${pad(r.income.toFixed(1), 5)}/m  eat ${pad(r.eating.toFixed(1), 5)}/m  supply ${pad(sup.perMin.toFixed(0), 3)}/m (${pad(sup.ants, 3)} ants)  died ${pad(farm.stats.died, 3)}  dug ${pad((dugShare(farm) * 100).toFixed(1), 5)}%  top ${pad(Math.min(...farm.surf), 3)}  rooms ${farm.rooms.map(r => r.type[0] + (r.dug ? '' : '*')).join('')}  ${Object.entries(types).map(([t, n]) => t[0] + n).join(' ')}`);
      }
    }
    const ms = performance.now() - t0;
    const reached = farm.sources.filter(s => s.reach || s.gone).length;
    console.log(`seed ${seed}: first food at ${farm.stats.firstFood === null ? 'never' : farm.stats.firstFood.toFixed(0) + 's'}, peak ${peak} ants, ${farm.stats.died} died (${farm.stats.starved} starved), born ${farm.stats.born}, sources reached ${reached}/${farm.sources.length}, lowest food after 5m ${lowFood === Infinity ? '-' : Math.floor(lowFood)}  [${(ms / MINUTES).toFixed(0)} ms per farm minute]`);
    for (const r of rows) console.log(r);
    summary.push({ seed, first: farm.stats.firstFood, final: farm.ants.length, peak, died: farm.stats.died, dug: dugShare(farm), top: Math.min(...farm.surf), ms });
  }
  const avg = f => summary.reduce((a, s) => a + f(s), 0) / summary.length;
  console.log(`-- ${style}: first food ${avg(s => s.first ?? 9999).toFixed(0)}s avg (worst ${Math.max(...summary.map(s => s.first ?? 9999)).toFixed(0)}s), final ants ${avg(s => s.final).toFixed(1)}, peak ${avg(s => s.peak).toFixed(1)}, died ${avg(s => s.died).toFixed(1)}, dug ${(avg(s => s.dug) * 100).toFixed(1)}%, highest pile row ${Math.min(...summary.map(s => s.top))}, ${avg(s => s.ms / MINUTES).toFixed(0)} ms/farm-minute`);
}
