// Prints a level turn by turn: node floodplain/trace.mjs 3 "gate 1 2" "" "gate 1 2"   (one arg per turn)
import { Game } from './game.js';
import { LEVELS } from './levels.js';
const [n, ...turns] = process.argv.slice(2);
const g = new Game(LEVELS[n - 1]);
function show() {
  for (let y = 0; y < g.h; y++) {
    let s = '';
    for (let x = 0; x < g.w; x++) {
      const i = g.idx(x, y), u = g.unitAt(x, y);
      let c = g.t[i];
      if (g.water[i]) c = c === 'H' ? 'h' : c === 'X' ? 'x' : '~';
      if (g.ice[i]) c = '=';
      if (g.mud[i]) c = 'm';
      s += (u ? {foot:'F',horse:'R',torch:'C'}[u.k] : c) + g.ht[i] + ' ';
    }
    console.log('   ' + s);
  }
}
console.log('start'); show();
for (let t = 0; !g.over; t++) {
  for (const m of (turns[t] || '').split(',').map(s => s.trim()).filter(Boolean)) { const [tool, x, y] = m.split(' '); console.log(' use', tool, x, y, g.use(tool, +x, +y) ? 'ok' : 'REFUSED'); }
  const f = g.forecast();
  console.log(` turn ${g.turn} forecast:`, JSON.stringify(f.moves), 'burns', JSON.stringify(f.burns));
  g.endTurn(); show();
}
console.log(g.over, g.housesLeft(), '/', g.houses0);
