// Headless balance runs: node chatdungeon/balance.mjs [games=24] [skill=0.85] [seed0=1]
import { Game, FLOORS } from './game.js';
import { Chat } from './chat.js';
import { botInput } from './bot.js';
import { mulberry } from './game.js';

const N = +(process.argv[2] || 24), SKILL = +(process.argv[3] || 0.85), S0 = +(process.argv[4] || 1);
const rows = [];
for (let i = 0; i < N; i++) {
  const seed = S0 + i;
  const g = new Game({ seed });
  const chat = new Chat(g, { seed });
  const mem = { rand: mulberry(seed * 7 + 3) };
  const dt = 1 / 60;
  let t = 0, killer = null, spent = { bat: 0, goblin: 0, slime: 0, skeleton: 0, trap: 0, curse: 0, bless: 0 }, roomT = [], lastRoom = 0, hurtBy = {};
  chat.onMsg = (m) => { if (m.res?.ok && m.cmd) { const k = m.cmd === 'spawn' ? m.text.split(' ')[1] : m.cmd; if (spent[k] != null) spent[k]++; } };
  while (!g.over && t < 60 * 30) {
    const inp = botInput(g, mem, SKILL);
    g.tick(dt, inp);
    chat.tick(dt);
    for (const e of g.ev) {
      chat.event(e);
      if (e.t === 'hurt') { const k = e.user ? 'chat' : 'dungeon'; hurtBy[k] = (hurtBy[k] || 0) + 1; }
      if (e.t === 'die') killer = e.user || 'dungeon';
      if (e.t === 'room') { roomT.push(+(t - lastRoom).toFixed(0)); lastRoom = t; }
    }
    g.ev.length = 0;
    t += dt;
  }
  rows.push({ seed, over: g.over || 'timeout', floor: g.floor, room: g.roomIdx, type: g.room.type, mins: +(t / 60).toFixed(1), killer, hurtBy, spent, relics: Object.keys(g.p.relics).join(','), max: g.p.max, roomMed: roomT.sort((a, b) => a - b)[roomT.length >> 1] });
}
for (const r of rows) console.log(JSON.stringify(r));
const won = rows.filter(r => r.over === 'won').length;
const floors = {}; for (const r of rows) floors[r.floor] = (floors[r.floor] || 0) + 1;
console.log(`won ${won}/${N}  floors reached ${JSON.stringify(floors)}  median mins ${rows.map(r => r.mins).sort((a, b) => a - b)[N >> 1]}`);
