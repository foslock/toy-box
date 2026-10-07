// Headless balance runs for Horde: stand-in players play whole nights against each hero, and this prints how often
// they win, how long the kill takes, how far the hero levelled, and how much of the horde it ate.
//
//   node horde/balance.mjs                      → every night, three temperaments, 12 games each
//   node horde/balance.mjs --games 48 --night 3 --kind smart --size 240x440 --json
import { Game, STEP } from './game.js';
import { Bot } from './bot.js';
import { mulberry } from './game.js';
import * as DATA from './data.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const GAMES = +arg('games', 12), ONLY = arg('night', null), KIND = arg('kind', null), SEED0 = +arg('seed', 1);
const [W, H] = arg('size', '400x280').split('x').map(Number);
const JSONOUT = process.argv.includes('--json');
// --set 'MOBS.imp.hp=12,HEROES.0.spd=36' patches the numbers before playing, for trying a change without editing
for (const kv of (arg('set', '') || '').split(',').filter(Boolean)) {
  const [path, v] = kv.split('='), keys = path.split('.');
  let o = DATA; for (const k of keys.slice(0, -1)) o = o[k];
  o[keys.at(-1)] = isNaN(+v) ? v : +v;
}
const kinds = KIND ? [KIND] : ['naive', 'decent', 'smart'];
const nights = ONLY ? ONLY.split(',').map(Number) : [1, 2, 3, 4, 5, 6];
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

for (const night of nights) for (const kind of kinds) {
  const rows = [];
  const t0 = Date.now();
  for (let i = 0; i < GAMES; i++) {
    const seed = SEED0 * 7919 + night * 1000 + i * 37;
    const g = new Game({ night, W, H, seed }), bot = new Bot({ kind, rand: mulberry(seed ^ 0xabc) });
    let maxMobs = 0;
    while (g.state === 'play') { bot.tick(g, STEP); g.tick(); g.drain(); if (g.tick_ % 60 === 0) maxMobs = Math.max(maxMobs, g.alive()); }
    const h = g.hero;
    const row = { night, kind, seed, won: g.state === 'won', why: g.why, t: +g.t.toFixed(1), lv: h.lv, hp: Math.round(h.hp), maxhp: Math.round(h.maxhp),
      raised: g.stats.raised, contact: +g.stats.contact.toFixed(1), surges: g.stats.surges, by: Object.fromEntries(Object.entries(g.stats.by).map(([k, v]) => [k, Math.round(v)])), killed: g.stats.killed, fed: g.stats.fed, sunk: g.stats.sunk, blood: Math.round(g.stats.blood), peak: g.stats.peak,
      build: h.weapons.map(w => w.id + w.lv).concat(Object.entries(h.passives).map(([k, v]) => k + v)).join(' ') };
    rows.push(row);
    if (JSONOUT) console.log(JSON.stringify(row));
  }
  if (JSONOUT) continue;
  const won = rows.filter(r => r.won), why = {};
  for (const r of rows) why[r.why] = (why[r.why] || 0) + 1;
  const ts = won.map(r => r.t / 60);
  console.log(`night ${night} ${kind.padEnd(6)} won ${String(won.length).padStart(2)}/${rows.length}` +
    (ts.length ? `  kill at ${q(ts, .25).toFixed(1)}/${q(ts, .5).toFixed(1)}/${q(ts, .75).toFixed(1)} min` : '                          ') +
    `  lv ${q(rows.map(r => r.lv), .5)} (max ${Math.max(...rows.map(r => r.lv))})  raised ${q(rows.map(r => r.raised), .5)} killed ${q(rows.map(r => r.killed), .5)} peak ${q(rows.map(r => r.peak), .5)} touch ${q(rows.map(r => r.contact), .5)}s  fed ${q(rows.map(r => r.fed), .5)} sunk ${q(rows.map(r => r.sunk), .5)}  ` +
    Object.entries(why).map(([k, v]) => `${k} ${v}`).join(', ') + `  [${((Date.now() - t0) / 1000).toFixed(1)}s]`);
  const lost = rows.filter(r => !r.won).slice(0, 1);
  for (const r of lost) console.log(`        e.g. lost: lv ${r.lv}, hp ${r.hp}/${r.maxhp}, blood ${r.blood} ${JSON.stringify(r.by)}, ${r.build}`);
}
