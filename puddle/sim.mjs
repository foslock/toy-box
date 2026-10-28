// Headless checks: every puddle has something in it at every hour, and how the reel plays for a simple bot.
// node puddle/sim.mjs
import { CATCHES, SPOTS, PHASES, WEATHERS } from './data.js';
import { newGame, eligible, tick, cast, tap, REEL } from './game.js';

const g0 = newGame({ log: Object.fromEntries(CATCHES.filter(c => c.id !== 'moon').map(c => [c.id, 1])) });
const thin = [];
for (let s = 0; s < SPOTS.length; s++) for (let p = 0; p < 4; p++) for (let w = 0; w < 3; w++) {
  const n = eligible(newGame({}), s, p, w).length;
  if (n < 3) thin.push(`${SPOTS[s].short}/${PHASES[p]}/${WEATHERS[w]}: ${n}`);
}
console.log('thin combos (fresh save):', thin.length ? thin.join(', ') : 'none');
const reach = {};
for (const c of CATCHES) {
  let k = 0;
  for (let s = 0; s < 6; s++) for (let p = 0; p < 4; p++) for (let w = 0; w < 3; w++) if (eligible(g0, s, p, w).some(e => e.id === c.id) || c.id === 'moon') k++;
  reach[c.id] = k;
}
console.log('combos each catch appears in:', Object.entries(reach).map(([k, v]) => k + ':' + v).join(' '));

// reel bot: holds while tension is under a threshold, with a reaction delay
const styles = ['steady', 'burst', 'gust', 'float', 'heavy', 'dart'];
const thr = +(process.argv[2] || 0.7), react = +(process.argv[3] || 0.18);
for (const style of styles) for (const weight of [0.6, 1.0, 1.6]) {
  let ok = 0, snap = 0, slip = 0, tsum = 0; const N = 300;
  for (let i = 0; i < N; i++) {
    const g = newGame({}, i + 1);
    g.clock = 0.01;
    const s = g.shadows[0] || null;
    // put a shadow under the bobber and hook it directly
    cast(g, 0, 0); for (let k = 0; k < 10; k++) tick(g, 0.05, { stopClock: true });
    g.shadows = [{ uid: 99, id: 'button', x: 0, y: -0.02, tx: 0, ty: 0, a: 1, state: 'nibble', t: 0, rot: 0, wob: 0, speed: 0.1, notice: 2 }];
    g.line.target = g.shadows[0]; g.line.state = 'bite'; g.line.t = 0;
    tap(g);
    g.reel.style = style; g.reel.weight = weight;
    let want = false, lag = 0, t = 0;
    while (g.reel && t < 60) {
      const w = g.reel.T < thr;
      if (w !== want) { lag += 0.02; if (lag >= react) { want = w; lag = 0; } } else lag = 0;
      g.hold = want;
      tick(g, 0.02, { stopClock: true }); t += 0.02;
      const e = g.events.find(e => ['caught', 'snap', 'slip'].includes(e.type));
      if (e) { if (e.type === 'caught') { ok++; tsum += t; } else if (e.type === 'snap') snap++; else slip++; break; }
    }
    g.events.length = 0;
  }
  console.log(style.padEnd(7), 'w' + weight, `land ${(ok / N * 100).toFixed(0)}%  snap ${(snap / N * 100).toFixed(0)}%  slip ${(slip / N * 100).toFixed(0)}%  avg ${(tsum / Math.max(1, ok)).toFixed(1)}s`);
}

// whole-log bot: fishes wherever has the most unlogged things right now, waits an hour when nowhere does
if (process.argv.includes('--full')) {
  const { setSpot, waitHour, distinct, unlocked, phaseOf, weatherOf } = await import('./game.js');
  const runs = [];
  for (let seed = 1; seed <= 24; seed++) {
    const g = newGame({}, seed * 77);
    let t = 0, waits = 0, walks = 0, react = 0, lost = 0, landed = 0; const firstAt = {};
    while (distinct(g) < CATCHES.length && t < 4 * 3600) {
      if (!g.line && !g.reel) {
        let best = g.spot, bn = -1;
        for (let i = 0; i < SPOTS.length; i++) if (unlocked(g, i)) {
          const n = eligible(g, i).filter(c => !g.log[c.id]).length;
          if (n > bn || (n === bn && i === g.spot)) { bn = n; best = i; }
        }
        if (bn <= 0) { waitHour(g); waits++; t += 2; }
        else if (best !== g.spot) { setSpot(g, best); walks++; t += 3; }
        const s = g.shadows.find(s => s.state === 'wander' && !g.log[s.id]) || g.shadows.find(s => s.state === 'wander');
        if (s) cast(g, s.x + 0.12, s.y + 0.08);
      }
      if (g.line && g.line.state === 'bite') { react += 0.02; if (react > 0.35) { tap(g); react = 0; } }
      if (g.reel) g.hold = g.reel.T < (g.hold ? 0.72 : 0.45);
      tick(g, 0.02); t += 0.02;
      for (const e of g.events.splice(0)) {
        if (e.type === 'caught') { landed++; if (e.isNew) firstAt[e.id] = t; }
        if (e.type === 'snap' || e.type === 'slip' || e.type === 'miss') lost++;
      }
    }
    runs.push({ t, waits, walks, landed, lost, done: distinct(g), firstAt });
  }
  const med = a => a.sort((x, y) => x - y)[a.length >> 1];
  console.log('full log: median minutes', (med(runs.map(r => r.t)) / 60).toFixed(1), 'range', Math.min(...runs.map(r => r.t / 60)).toFixed(0), '-', Math.max(...runs.map(r => r.t / 60)).toFixed(0),
    'finished', runs.filter(r => r.done === CATCHES.length).length + '/' + runs.length, 'median catches', med(runs.map(r => r.landed)), 'lost', med(runs.map(r => r.lost)), 'waits', med(runs.map(r => r.waits)));
  const lastIds = {};
  for (const r of runs) for (const [id, at] of Object.entries(r.firstAt)) (lastIds[id] ||= []).push(at / 60);
  console.log('median minute of first catch:', Object.entries(lastIds).map(([k, v]) => [k, med(v)]).sort((a, b) => a[1] - b[1]).map(([k, v]) => k + ' ' + v.toFixed(0)).join(', '));
  for (let n of [1, 3, 6, 9, 12, 22]) console.log(`  ${n} distinct by minute`, med(runs.map(r => Object.values(r.firstAt).sort((a, b) => a - b)[n - 1] / 60)).toFixed(1));
}
