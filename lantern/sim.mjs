// node lantern/sim.mjs [games] [skill] — runs the bot through whole runs and reports how far it gets.
import { Game } from './game.js';
import { makeBot, botInput, botLevel } from './bot.js';

const N = +(process.argv[2] || 12), skill = +(process.argv[3] || 0.8), base = +(process.argv[4] || 1);
const dt = 1 / 60;
const rows = []; const SRC = {};
for (let s = 0; s < N; s++) {
  const seed = base + s;
  const g = new Game(seed);
  let r = seed * 99991 >>> 0; const rnd = () => ((r = (r * 1103515245 + 12345) >>> 0) / 4294967296);
  const m = makeBot({ skill, rnd });
  const log = { seed, reached: 'day1', t: 0, hurt: {}, oilAtDusk: [], hpAtDusk: [], camps: 0, embers: 0, bossT: [], flasks: [] };
  let bossStart = 0, steps = 0;
  while (g.phase !== 'won' && steps < 60 * 60 * 25) {
    if (g.phase === 'dead') {
      if (g.boss && g.embers > 0) { log.embers++; g.rekindle(); bossStart = g.t; continue; }
      break;
    }
    Object.assign(g.input, botInput(g, m, dt));
    g.step(dt); steps++;
    for (const e of g.events) {
      if (e.t === 'grace') botLevel(g, m);
      if (e.t === 'bell') { log.oilAtDusk.push(Math.round(g.p.oil)); log.hpAtDusk.push(Math.round(g.p.hp)); }
      if (e.t === 'boss') { bossStart = g.t; log.reached = ['night1', 'night2', 'lastnight'][g.day]; }
      if (e.t === 'bossdown') log.bossT.push(Math.round(g.t - bossStart));
      if (e.t === 'hurt') { const k = g.boss ? 'boss' + g.day : 'day' + g.day; log.hurt[k] = (log.hurt[k] || 0) + e.n; SRC[e.src] = (SRC[e.src] || 0) + e.n; }
    }
    g.events.length = 0;
    for (const v of [g.p.hp, g.p.x, g.p.y, g.p.oil]) if (!Number.isFinite(v)) { console.log('NaN!', seed, g.t); process.exit(1); }
  }
  if (g.phase === 'won') log.reached = 'WON';
  log.t = Math.round(g.t); log.camps = g.stats.camps; log.kills = g.stats.kills; log.level = g.p.level; log.weapon = g.p.weapon;
  log.bossHpLeft = g.boss ? Math.round(g.boss.hp / g.boss.maxHp * 100) + '%' : '';
  rows.push(log);
  console.log(JSON.stringify(log));
}
const c = {}; for (const r of rows) c[r.reached] = (c[r.reached] || 0) + 1;
console.log('reached', c); console.log('hurt by', Object.entries(SRC).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', '));
