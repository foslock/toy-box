// Random wanderers: walk to random people and things, ask random questions, over many loops, to catch crashes and
// to see which notebook entries nobody ever finds. node damday/fuzz.mjs [loops] [seed]
import { Game, newStore } from './sim.js';
import { CLUES } from './clues.js';
import { OBJECTS } from './world.js';
import { NPCS, THINGS } from './people.js';
import { rng } from './util.js';

const LOOPS = +(process.argv[2] || 120), R = rng(+(process.argv[3] || 7));
const pick = a => a[(R() * a.length) | 0];
const g = new Game(newStore());
const targets = [...NPCS.map(n => ({ kind: 'npc', id: n.id })), ...OBJECTS.filter(o => THINGS[o.id]).map(o => ({ kind: 'thing', id: o.id }))];
let talks = 0, wins = 0, minSaved = 9, maxSaved = 0;
for (let loop = 0; loop < LOOPS; loop++) {
  g.startLoop(); g.wake = 0; g.drain();
  let guard = 0;
  while (!g.ended && guard++ < 400) {
    const tg = pick(targets); g.goTo(tg);
    let n = 0; while (!g.talk && !g.ended && n++ < 500) g.tick(0.05);
    if (g.talk) {
      talks++;
      for (let k = 0, m = (R() * 4) | 0; k < m && g.talk; k++) {
        if (!g.talk.pages.every(p => typeof p === 'string')) throw new Error('bad page from ' + tg.id);
        const ask = g.talk.ask; if (!ask.length) break;
        const a = pick(ask); if (typeof a[0] !== 'string' || typeof a[1] !== 'string') throw new Error('bad ask from ' + tg.id); g.choose(a[0]);
        if (!g.talk.pages.length) throw new Error('empty scene from ' + tg.id + ' topic ' + a[0]);
      }
      g.leave(); let w = 0; while (g.ff > 0 && w++ < 2000) g.tick(0.05);
    } else if (R() < 0.3) { g.walkTo('town', 20 + ((R() * 20) | 0), 19); let w = 0; while (g.walking && w++ < 400) g.tick(0.05); }
    g.drain();
  }
  while (!g.ended) g.tick(0.05);
  const o = g.over; if (o.win) wins++; minSaved = Math.min(minSaved, o.saved); maxSaved = Math.max(maxSaved, o.saved);
}
const missing = Object.keys(CLUES).filter(id => !g.store.known.has(id));
console.log(`${LOOPS} loops, ${talks} conversations, saved ${minSaved}–${maxSaved} of 9, wins ${wins}`);
console.log(`notebook: ${g.store.known.size}/${Object.keys(CLUES).length} found; never found: ${missing.join(', ') || 'nothing'}`);
