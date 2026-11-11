// node spirekeeper/balance.mjs [runs]
// Plays whole runs with a few keeper strategies and prints how streams end.
import { newRun, offerRooms, makeEnemy, fight, forecast, hypeForEvent, hypeSettle, resolveRoom, cardReward, viewersAfter, HYPE } from './sim.js';
import { FLOORS } from './data.js';

const N = +process.argv[2] || 200;

function playRun(strategy, seed) {
  const run = newRun(seed);
  const trace = [];
  while (!run.over) {
    const rooms = offerRooms(run);
    const room = strategy(run, rooms);
    run.hype = Math.max(0, run.hype - HYPE.roomDecay);   // the page never lets hype go under 0
    if (room.kind === 'monster') {
      const en = makeEnemy(room.key, run.floor);
      const start = run.hero.hp;
      const res = fight(run.hero, en, run.R.int(1e9));
      for (const e of res.events) run.hype = Math.min(HYPE.max, run.hype + hypeForEvent(e, run.hero.maxHp));
      const settle = hypeSettle(res, start, run.hero.maxHp, en);
      for (const s of settle) run.hype = Math.max(0, Math.min(HYPE.max, run.hype + s.amt));
      run.hero.hp = res.hp;
      if (!res.won) { run.over = true; run.outcome = 'died'; }
      else {
        if (settle.some(s => s.why === 'CLUTCH')) run.clutches++;
        if (run.hero.relics.includes('kettle') && run.floor < FLOORS) run.hero.hp = Math.min(run.hero.maxHp, run.hero.hp + 6);
        if (run.floor < FLOORS) cardReward(run);
      }
      trace.push(`${run.floor}:${room.key}(${start}->${res.hp}) h${Math.round(run.hype)}`);
    } else {
      const r = resolveRoom(run, room);
      run.hype = Math.max(0, Math.min(HYPE.max, run.hype + r.hype));
      trace.push(`${run.floor}:${room.key} h${Math.round(run.hype)}`);
    }
    viewersAfter(run);
    if (!run.over && run.hype <= 0) { run.over = true; run.outcome = 'bored'; }
    if (!run.over && run.floor === FLOORS) { run.over = true; run.outcome = run.hero.hp <= run.hero.maxHp * 0.1 ? 'legend' : 'top'; }
    run.floor++;
  }
  return { run, trace };
}

const strategies = {
  random: (run, rooms) => run.R.pick(rooms),
  firstMonster: (run, rooms) => rooms.find(r => r.kind === 'monster') || rooms[0],
  safest: (run, rooms) => {
    if (run.hero.hp < run.hero.maxHp * 0.5) { const c = rooms.find(r => r.key === 'campfire'); if (c) return c; }
    let best = rooms[0], bv = 1e9;
    for (const r of rooms) {
      if (r.kind !== 'monster') { if (5 < bv) { bv = 5; best = r; } continue; }
      const f = forecast(run.hero, makeEnemy(r.key, run.floor), 16, run.floor);
      if (f.mid < bv) { bv = f.mid; best = r; }
    }
    return best;
  },
  // a thoughtful keeper: wants a real dip but a low death chance, rests when low
  smart: (run, rooms) => {
    const h = run.hero;
    const frac = h.hp / h.maxHp;
    let best = null, bv = -1e9;
    for (const r of rooms) {
      let v;
      if (r.kind === 'monster') {
        const f = forecast(h, makeEnemy(r.key, run.floor), 24, run.floor * 3 + 1);
        const dip = f.mid / h.maxHp;
        v = dip * 100 - f.death * 260 + (run.hype < 25 ? dip * 80 : 0);
        if (run.floor === FLOORS) v = -f.death * 100 - (h.hp - f.mid) * 0.1;
      } else if (r.key === 'campfire') v = frac < 0.45 ? 40 : frac < 0.65 ? 12 : -10;
      else if (r.kind === 'treasure') v = run.hype > 40 ? 18 : 2;
      else v = run.hype > 45 ? 8 : 0;
      if (v > bv) { bv = v; best = r; }
    }
    return best;
  },
};

for (const [name, s] of Object.entries(strategies)) {
  const tally = { died: 0, bored: 0, top: 0, legend: 0 };
  let floors = 0, viewers = 0, clutch = 0;
  const deathFloors = {};
  const sample = [];
  for (let i = 0; i < N; i++) {
    const { run, trace } = playRun(s, 1000 + i);
    tally[run.outcome]++;
    floors += run.floor - 1; viewers += run.viewers; clutch += run.clutches;
    if (run.outcome !== 'top' && run.outcome !== 'legend') deathFloors[run.floor - 1] = (deathFloors[run.floor - 1] || 0) + 1;
    if (i < 2) sample.push(run.outcome + ' | ' + trace.join(' '));
  }
  console.log(`\n== ${name}: ` + Object.entries(tally).map(([k, v]) => `${k} ${(v / N * 100).toFixed(0)}%`).join('  ') + `  avgFloor ${(floors / N).toFixed(1)}  viewers ${(viewers / N).toFixed(0)}  clutches ${(clutch / N).toFixed(2)}`);
  console.log('   ended on floor:', JSON.stringify(deathFloors));
  for (const t of sample) console.log('   ' + t);
}
