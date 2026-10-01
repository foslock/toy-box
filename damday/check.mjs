// Headless checks: node damday/check.mjs
//   - every place someone stands is reachable, every clue sits in a thread, every topic's clue exists
//   - an expert plays the one perfect loop (sardine, keys, Timothy, the siren, the decree, the three who can't hear)
//     and we print when it finishes, so we can see how much of the 225 seconds is left over
//   - a few cheaper plans, to be sure nothing short of the whole chain saves everyone
import { Game, newStore } from './sim.js';
import { CLUES, THREADS } from './clues.js';
import { MAPS, ANCHORS, OBJECTS, findPath, PLAYER_START } from './world.js';
import { NPCS, THINGS } from './people.js';
import { BREAK, stamp } from './util.js';

let bad = 0; const fail = m => { bad++; console.log('FAIL', m); };
for (const [n, a] of Object.entries(ANCHORS)) { if (!MAPS[a.map].walk(a.x, a.y)) fail('anchor not walkable ' + n); else if (!findPath(PLAYER_START, a)) fail('anchor unreachable ' + n); }
for (const o of OBJECTS) { if (!THINGS[o.id]) fail('object with no text ' + o.id); const a = MAPS[o.map]; const ok = [[0,0],[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => a.walk(o.x + dx, o.y + dy) && findPath(PLAYER_START, { map: o.map, x: o.x + dx, y: o.y + dy })); if (!ok) fail('object unreachable ' + o.id); }
for (const id of Object.keys(THINGS)) if (!OBJECTS.some(o => o.id === id)) fail('text with no object ' + id);
const threadIds = new Set(THREADS.map(t => t.id));
for (const [id, c] of Object.entries(CLUES)) if (!threadIds.has(c.th)) fail('clue in no thread ' + id);
for (const t of THREADS) if (t.solved && !CLUES[t.solved]) fail('thread solved by unknown clue ' + t.id);
const src = ['people.js'].map(f => import('node:fs').then(fs => fs.readFileSync(new URL(f, import.meta.url), 'utf8')));
const text = (await Promise.all(src)).join('\n');
for (const m of text.matchAll(/(?:learn|K)\('([a-z_0-9]+)'\)/g)) if (!CLUES[m[1]]) fail('unknown clue ' + m[1]);

const allKnown = () => { const st = newStore(); for (const id of Object.keys(CLUES)) st.known.add(id); return st; };
function run(label, plan, opts = {}) {
  const g = new Game(opts.fresh ? newStore() : allKnown());
  const log = [];
  const tick = (s) => { for (let i = 0; i < s / 0.05; i++) { g.tick(0.05); if (g.ended) break; } };
  const wait = () => { let n = 0; while (g.ff > 0 && n++ < 2000) g.tick(0.05); };
  const goTo = (target) => { g.goTo(target); let n = 0; while (!g.talk && !g.ended && n++ < 6000) g.tick(0.05); if (!g.talk) throw new Error(label + ': never reached ' + target.id + ' at ' + stamp(g.t)); };
  const say = (target, ...topics) => { goTo(target); const start = g.t; for (const t of topics) { if (!g.talk.ask.some(a => a[0] === t)) throw new Error(`${label}: ${target.id} offers no '${t}' at ${stamp(g.t)} (has ${g.talk.ask.map(a => a[0])})`); g.choose(t); } g.leave(); wait(); log.push(`${stamp(g.t)} ${target.id}: ${topics.join(', ') || 'hello'}`); };
  const npc = id => ({ kind: 'npc', id }), thing = id => ({ kind: 'thing', id });
  try { plan({ g, say, goTo, npc, thing, tick, wait, log }); } catch (e) { log.push('STOPPED: ' + e.message); }
  while (!g.ended) g.tick(0.05);
  const o = g.over;
  console.log(`\n${label}: ${o.saved}/${o.total} on the hill, you ${o.you ? 'safe' : 'swept'}${o.win ? '  ** WIN **' : ''}`);
  if (opts.log !== false) console.log(log.join('\n'));
  if (opts.lost) console.log('  lost:', o.all.filter(x => !x.safe).map(x => x.id + '@' + x.where).join(', '));
  return { g, o, log };
}
const toHill = ({ g, wait }) => { g.walkTo('town', 44, 17); let n = 0; while (g.walking && n++ < 4000) g.tick(0.05); };

// the expert's loop
const best = run('perfect loop', ({ g, say, npc, thing, wait, log }) => {
  say(npc('barnaby'), 'greet', 'sardine', 'leaving');
  say(npc('cat'), 'trade');
  say(npc('orla'), 'wrong', 'dam');
  say(npc('wim'), 'ticket', 'dam');
  while (g.t < 130) g.tick(0.05);
  say(npc('margo'), 'timothy');
  g.goTo(thing('siren_box')); let n = 0; while (!g.talk && n++ < 4000) g.tick(0.05); g.leave(); wait(); log.push(stamp(g.t) + ' siren sounded: ' + g.F('siren_on'));
  say(npc('mayor'), 'decree');
  toHill({ g }); log.push(stamp(g.t) + ' on the hill');
}, { lost: true });
const endAt = best.log.find(l => l.includes('on the hill'));
console.log('finished at', endAt?.split(' ')[0], '(the dam goes at', stamp(BREAK) + ')');

// how much sloppiness the loop forgives: the same plan with a pause of s seconds before every stop (a wrong turn, a slow thumb)
for (const s of [0, 5, 9, 12, 15, 18]) {
  const r = run('sloppy +' + s + 's per stop', ({ g, say, npc, thing, wait, tick, log }) => {
    const lag = () => { for (let i = 0; i < s / 0.05; i++) g.tick(0.05); };
    lag(); say(npc('barnaby'), 'greet', 'sardine', 'leaving'); lag(); say(npc('cat'), 'trade'); lag(); say(npc('orla'), 'wrong', 'dam'); lag(); say(npc('wim'), 'ticket', 'dam');
    while (g.t < 130) g.tick(0.05); lag(); say(npc('margo'), 'timothy'); lag();
    g.goTo(thing('siren_box')); let n = 0; while (!g.talk && n++ < 4000) g.tick(0.05); g.leave(); wait(); lag(); say(npc('mayor'), 'decree'); toHill({ g });
  }, { log: false });
}

// plans that should fall short
run('does nothing', () => { }, { log: false, lost: true });
run('siren but no decree', ({ g, say, npc, thing, wait }) => { say(npc('barnaby'), 'greet', 'sardine'); say(npc('cat'), 'trade'); say(npc('margo'), 'timothy'); g.goTo(thing('siren_box')); let n = 0; while (!g.talk && n++ < 4000) g.tick(0.05); g.leave(); wait(); toHill({ g }); }, { log: false, lost: true });
run('everyone but the sleepers', ({ g, say, npc, thing, wait }) => { say(npc('barnaby'), 'greet', 'sardine', 'leaving'); say(npc('cat'), 'trade'); say(npc('margo'), 'timothy'); g.goTo(thing('siren_box')); let n = 0; while (!g.talk && n++ < 4000) g.tick(0.05); g.leave(); wait(); say(npc('mayor'), 'decree'); toHill({ g }); }, { log: false, lost: true });
// rules that should hold
{
  const g = new Game(allKnown()); g.wake = 0; g.give('keys'); g.give('fuse'); g.run(60);
  g.player.put('fire', 8, 2); g.interact({ kind: 'thing', id: 'siren_box' });
  if (g.F('siren_on')) fail('the Chief let you at the siren box while he was at his post'); g.leave();
  g.run(80);   // t = 140 plus: he has gone out to drill
  g.player.put('fire', 8, 2); g.talk = null; g.ff = 0; g.interact({ kind: 'thing', id: 'siren_box' });
  if (!g.F('siren_on')) fail('the siren box did not work once the Chief was out drilling with keys and fuse in hand'); g.leave();
  const h = new Game(allKnown()); h.wake = 0; h.run(100); h.player.put('town', 35, 25); h.interact({ kind: 'npc', id: 'mayor' }); h.choose('decree'); if (h.F('decree')) fail('the Mayor decreed without a siren'); h.leave();
  const o = new Game(allKnown()); o.wake = 0; o.run(10); o.player.put('inn', 5, 4); o.interact({ kind: 'npc', id: 'orla' }); if (o.talk.ask.some(a => a[0] === 'dam')) fail('a sleeping Orla offered the warning'); o.choose('shake'); if (o.F('orla_awake')) fail('shaking woke Orla'); o.choose('wrong'); if (!o.F('orla_awake')) fail('the wrong number did not wake Orla');
  const f = new Game(newStore()); f.wake = 0; f.run(10); f.player.put('inn', 5, 4); f.interact({ kind: 'npc', id: 'orla' }); if (!f.talk.ask.some(a => a[0] === 'wrong')) fail('a first visit to Orla did not teach the dam’s height');
}
console.log(bad ? `\n${bad} problems` : '\nstructure ok');
