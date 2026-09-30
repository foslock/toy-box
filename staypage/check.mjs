// Headless checks of the story, with no page: plays the narrator's scenes on a fake clock and fake view and confirms that
// every ending can be reached the way its hint says, that nothing soft-locks when the disobedience is thrown at it in any
// order, how long each ending takes to find, and how long the longest line is. For writing story.js.
//
//   node staypage/check.mjs            → every ending, then a fuzz of random behaviour
//   node staypage/check.mjs --say      → and print what the narrator says along the way
import { createGame } from './engine.js';
import * as story from './story.js';
import { createStore, makeClock, dayNumber } from './store.js';
import { ENDINGS, INK } from './endings.js';
import { saverPlan } from './saver.js';

const SAY = process.argv.includes('--say');
const REAL = () => new Date(2026, 9, 1, 15, 0, 0);

function world({ stored = null, at = null, day = 0 } = {}) {
  let mem = stored ? JSON.stringify(stored) : null;
  const storage = { read: () => mem, write: s => { mem = s; }, clear: () => { mem = null; } };
  const clock = makeClock({ at, day, realNow: REAL });
  const store = createStore({ storage, clock });
  const log = { said: [], looks: [], ended: null, menu: 0, confirm: 0, reloaded: 0, saver: 0, stopped: 0, farewell: 0, dim: 0, resets: 0 };
  const view = {
    say: s => { log.said.push(s); ALL.add(s.text); if (SAY) console.log(`    ${s.who ? '[' + s.who + '] ' : ''}${s.text}`); },
    look: n => log.looks.push(n), step() {}, button() {}, lit() {}, settled() {}, finishTyping() {},
    ending: e => { log.ended = e; },
    menu: () => log.menu++, confirm: () => log.confirm++, reload: () => log.reloaded++,
    saverStart: () => log.saver++, saverStop: () => log.stopped++, farewell: () => log.farewell++, dim: () => log.dim++,
    reset: () => { log.resets++; log.ended = null; },
  };
  const g = createGame({ view, store, story });
  store.boot();
  g.boot();
  g.settle = (max = 240000) => { for (let t = 0; t < max && !(g.settled || g.mode === 'ending'); t += 100) g.tick(100); return g; };
  return { g, store, view, log };
}

const ALL = new Set();
let failed = 0, sections = 0;
const check = (name, ok, extra = '') => { if (!ok) { failed++; console.log(`  ✗ ${name} ${extra}`); } };
const took = g => Math.round(g.now() / 1000) + 's';
function run(title, fn, expect) {
  sections++;
  if (SAY) console.log(`\n── ${title}`);
  let w;
  try { w = fn(); } catch (e) { failed++; console.log(`✗ ${title}: threw ${e.stack}`); return; }
  const got = w.log.ended && w.log.ended.id;
  const ok = got === expect;
  console.log(`${ok ? '✓' : '✗'} ${title.padEnd(44)} → ${String(got).padEnd(10)} ${took(w.g)}`);
  if (!ok) failed++;
}

// ---- the obedient way ------------------------------------------------------------------------------------------------
run('terms: press every time', () => {
  const w = world(); const { g } = w;
  g.settle(); g.on('press'); g.settle();                  // step 2
  check('step 2', g.s.step === 2); g.on('press'); g.settle();
  check('step 3', g.s.step === 3);
  g.on('press', { disabled: true }); g.settle();
  g.on('poke', { id: 'terms', on: true }); g.on('press'); g.settle(); g.run(60000);
  return w;
}, 'terms');
run('terms: mashing the button in the intro', () => {
  const w = world(); const { g } = w;
  g.run(2000); g.on('press'); g.run(500); g.on('press'); g.run(500); g.on('press'); g.settle();
  check('got to step 2 after three early presses', g.s.step === 2, String(g.s.step));
  g.on('press'); g.settle(); g.on('poke', { id: 'terms', on: true }); g.on('press'); g.settle(); g.run(60000);
  return w;
}, 'terms');

// ---- the behaviours ----------------------------------------------------------------------------------------------------
run('saver: sit still', () => {
  const w = world(); const { g } = w;
  g.settle(); g.run(200000);
  check('the screen saver started', w.log.saver === 1, 'saver=' + w.log.saver);
  g.run(30000); g.on('corner'); g.run(40000);
  return w;
}, 'saver');
run('saver: wake it, then sit again', () => {
  const w = world(); const { g } = w;
  g.settle(); g.run(200000);
  g.input(); g.on('wake'); g.run(20000);
  check('woke and looks back', w.log.stopped === 1 && g.lookName === 'corp', g.lookName);
  check('back at the button', g.settled && g.scene === 'step1', g.scene);
  g.run(200000); g.run(30000); g.on('corner'); g.run(40000);
  return w;
}, 'saver');
run('stillhere: away for a minute', () => {
  const w = world(); const { g } = w;
  g.settle(); g.on('hide'); g.on('show', { away: 62 }); g.run(60000);
  return w;
}, 'stillhere');
run('stillhere: four short trips, then a long one', () => {
  const w = world(); const { g } = w;
  g.settle();
  for (const a of [3, 5, 8, 4]) { g.on('hide'); g.on('show', { away: a }); g.settle(); }
  check('the lure was explained', w.log.said.some(s => /name of the tab/.test(s.text)));
  g.on('hide'); g.on('show', { away: 41 }); g.run(60000);
  return w;
}, 'stillhere');
run('unfinished: resize ×3, then the TODO', () => {
  const w = world(); const { g } = w;
  g.settle(); g.on('resize', { w: 900, h: 700 }); g.settle(); g.on('resize', { w: 700, h: 700 }); g.settle(); g.on('resize', { w: 500, h: 700 }); g.settle();
  check('scaffold', g.lookName === 'scaffold' && g.scene === 'scaffold', g.lookName + '/' + g.scene);
  for (const id of ['h1', 'brand', 'foot', 'feat0']) { g.on('poke', { id }); g.settle(); }
  g.on('poke', { id: 'todo' }); g.run(60000);
  return w;
}, 'unfinished');
run('visitor1: resize ×3, then ×4 more, sign', () => {
  const w = world(); const { g } = w;
  g.settle();
  for (let i = 0; i < 3; i++) { g.on('resize', { w: 900 - i * 100, h: 700 }); g.settle(); }
  for (let i = 0; i < 4; i++) { g.on('resize', { w: 500 + i * 60, h: 700 }); g.settle(); }
  check('retro', g.lookName === 'retro' && g.scene === 'retroHub', g.lookName + '/' + g.scene);
  g.on('press', { name: 'Ada' }); g.run(60000);
  return w;
}, 'visitor1');
run('visitor1: Back, Back, sign', () => {
  const w = world(); const { g } = w;
  g.settle(); g.on('back', { left: 1 }); g.settle();
  check('web2, back at the button', g.lookName === 'web2' && g.scene === 'step1', g.lookName + '/' + g.scene);
  g.on('back', { left: 0 }); g.settle();
  check('retro', g.lookName === 'retro' && g.scene === 'retroHub', g.lookName + '/' + g.scene);
  g.on('back', { left: 0 }); g.settle();   // nowhere further
  g.on('press', { name: '' }); g.run(60000);
  return w;
}, 'visitor1');
run('visitor1: Back twice in quick succession', () => {
  const w = world(); const { g } = w;
  g.settle(); g.on('back', { left: 1 }); g.run(3000); g.on('back', { left: 0 }); g.settle();   // the second lands while the narrator's still on the first
  check('the second Back wasn\'t lost', g.lookName === 'retro' && g.scene === 'retroHub', g.lookName + '/' + g.scene);
  g.on('press', { name: 'Ada' }); g.run(60000);
  return w;
}, 'visitor1');
run('visitor1: signing before the narrator has finished', () => {
  const w = world(); const { g } = w;
  g.settle(); g.on('back', { left: 1 }); g.run(40000); g.on('back', { left: 0 }); g.run(4000);
  check('still introducing the old page', g.scene === 'retro', g.scene);
  g.on('press', { name: 'Eager' }); g.run(90000);
  return w;
}, 'visitor1');
run('an interrupted intro doesn\'t hold the button back', () => {
  const w = world(); const { g } = w;
  g.run(3000); g.on('back', { left: 1 }); g.settle();   // Back in the middle of the very first intro
  check('back at the button', g.scene === 'step1' && g.lookName === 'web2', g.scene + '/' + g.lookName);
  g.on('press'); g.settle();
  check('one press goes on to step 2', g.s.step === 2, String(g.s.step));
  g.on('press'); g.settle(); g.on('poke', { id: 'terms', on: true }); g.on('press'); g.run(60000);
  return w;
}, 'terms');
run('waking the screen saver from the scaffold goes back to the scaffold', () => {
  const w = world(); const { g } = w;
  g.settle(); g.on('menu', {}); g.on('menu', {}); g.settle(); g.on('menuitem', { id: 'inspect' }); g.settle();
  g.run(200000); g.input(); g.on('wake'); g.settle();
  check('scaffold scene and look', g.scene === 'scaffold' && g.lookName === 'scaffold', g.scene + '/' + g.lookName);
  g.on('poke', { id: 'todo' }); g.run(60000);
  return w;
}, 'unfinished');
run('comments: past the end ×3, post', () => {
  const w = world(); const { g } = w;
  g.settle(); g.on('overscroll'); g.settle(); g.on('overscroll'); g.settle(); g.on('overscroll'); g.settle();
  check('comments hub', g.lookName === 'comments' && g.scene === 'commentsHub', g.lookName + '/' + g.scene);
  g.on('press', { text: 'first!' }); g.run(60000);
  return w;
}, 'comments');
run('comments: posting before she has finished', () => {
  const w = world(); const { g } = w;
  g.settle(); g.on('overscroll'); g.settle(); g.on('overscroll'); g.settle(); g.on('overscroll'); g.run(9000);
  check('still in the comments intro', g.scene === 'comments', g.scene);
  g.on('press', { text: 'eager' }); g.run(90000);
  return w;
}, 'comments');
run('notfound: menu twice, Delete', () => {
  const w = world(); const { g } = w;
  g.settle(); g.on('menu', { x: 10, y: 10 }); g.settle();
  check('first time, no menu', w.log.menu === 0);
  g.on('menu', { x: 10, y: 10 }); g.settle();
  check('second time, a menu', w.log.menu === 1);
  g.on('menuitem', { id: 'fwd' }); g.on('menuitem', { id: 'save' }); g.on('menuitem', { id: 'print' }); g.settle();
  g.on('menuitem', { id: 'delete' }); check('asked to confirm', w.log.confirm === 1);
  g.on('confirm', { ok: false }); g.settle();
  g.on('menuitem', { id: 'delete' }); g.on('confirm', { ok: true }); g.run(60000);
  return w;
}, 'notfound');
run('menu: Inspect is the same as a third resize', () => {
  const w = world(); const { g } = w;
  g.settle(); g.on('menu', {}); g.on('menu', {}); g.settle(); g.on('menuitem', { id: 'inspect' }); g.settle();
  check('scaffold', g.lookName === 'scaffold', g.lookName);
  g.on('menuitem', { id: 'reload' }); g.run(30000);
  check('reload called (from the scaffold too)', w.log.reloaded === 1);
  g.mode = 'ending'; return { g, log: { ended: { id: 'menu-ok' } } };
}, 'menu-ok');
run('fineprint: highlight one by one', () => {
  const w = world(); const { g } = w;
  g.settle(); g.on('select', { text: 'the', lit: [], all: false }); g.settle();
  for (let i = 0; i < 5; i++) { g.on('select', { text: 'x', lit: [i], all: false }); g.settle(); }
  g.run(60000);
  return w;
}, 'fineprint');
run('fineprint: select all', () => {
  const w = world(); const { g } = w;
  g.settle(); g.on('select', { text: 'all of it', lit: [0, 1, 2, 3, 4], all: true }); g.run(60000);
  return w;
}, 'fineprint');
run('freetogo: try to close the tab ×3', () => {
  const w = world(); const { g } = w;
  g.settle();
  for (let i = 0; i < 3; i++) { g.on('leave'); g.on('stayed'); g.settle(); }
  g.run(60000);
  check('the page said it was free', w.log.farewell === 1);
  return w;
}, 'freetogo');
run('night: opened at 3:05', () => {
  const w = world({ at: { h: 3, m: 5 } }); w.g.run(120000); check('dimmed', w.log.dim === 1); return w;
}, 'night');
run('tomorrow: a day later', () => {
  const today = dayNumber(REAL());
  const w = world({ stored: { visits: 1, lastDay: today - 1, lastAct: 'pressed', endings: {} } }); w.g.run(90000); return w;
}, 'tomorrow');
run('tomorrow: four days, after an ending', () => {
  const today = dayNumber(REAL());
  const w = world({ stored: { visits: 3, lastDay: today - 4, lastAct: 'ended:visitor1', endings: { visitor1: 1 } } }); w.g.run(90000); return w;
}, 'tomorrow');
run('stay: all eleven others found', () => {
  const today = dayNumber(REAL()), endings = {};
  for (const e of ENDINGS) if (e.id !== 'stay') endings[e.id] = 1;
  const w = world({ stored: { visits: 12, lastDay: today, lastAct: 'ended:night', endings } }); w.g.run(200000); return w;
}, 'stay');

// ---- a return visit says the right thing ---------------------------------------------------------------------------
{
  const today = dayNumber(REAL());
  const says = stored => { const w = world({ stored: { lastDay: today, ...stored } }); w.g.settle(); return w.log.said.map(s => s.text).join(' | '); };
  const pressed = says({ visits: 1, lastAct: 'pressed', endings: {} }), left = says({ visits: 1, lastAct: 'left', endings: {} });
  const ended = says({ visits: 2, lastAct: 'ended:comments', endings: { comments: 1 } });
  check('pressed last time', /You pressed the button last time\. Why not this time\?/.test(pressed), pressed);
  check('left last time', /didn’t press anything/.test(left), left);
  check('ended last time', /“First Comment”/.test(ended), ended);
  sections++; console.log('✓ return visits greet by what you did last time');
}

// ---- restart ---------------------------------------------------------------------------------------------------------
run('restart after an ending, then another ending', () => {
  const w = world(); const { g } = w;
  g.settle(); g.on('overscroll'); g.settle(); g.on('overscroll'); g.settle(); g.on('overscroll'); g.settle(); g.on('press', { text: 'hi' }); g.run(60000);
  check('first ending', w.log.ended && w.log.ended.id === 'comments');
  g.restart(); g.settle();
  check('back to the button', g.mode === 'play' && g.scene === 'again' && g.lookName === 'corp', g.mode + '/' + g.scene + '/' + g.lookName);
  g.on('hide'); g.on('show', { away: 50 }); g.run(60000);
  return w;
}, 'stillhere');

// ---- fuzz: any disobedience in any order never gets stuck --------------------------------------------------------------
{
  let rng = 12345; const rnd = () => (rng = (rng * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const EVENTS = [
    g => g.on('press', { name: 'x', text: 'y' }), g => g.on('press', { disabled: true }),
    g => { g.on('hide'); g.on('show', { away: rnd() * 50 }); },
    g => g.on('resize', { w: 300 + rnd() * 900, h: 600, rotated: rnd() < 0.3 }),
    g => g.on('menu', { x: 5, y: 5 }), g => g.on('menuitem', { id: ['back', 'fwd', 'reload', 'save', 'print', 'inspect', 'delete'][Math.floor(rnd() * 7)] }),
    g => g.on('confirm', { ok: rnd() < 0.5 }),
    g => g.on('select', { text: 'abc', lit: rnd() < 0.5 ? [Math.floor(rnd() * 5)] : [], all: rnd() < 0.1, narr: rnd() < 0.1 }),
    g => g.on('overscroll'), g => g.on('back', { left: Math.floor(rnd() * 2) }),
    g => { g.on('leave'); g.on('stayed'); }, g => g.on('copy'), g => g.on('print'), g => g.on('offline'), g => g.on('online'),
    g => g.on('key', { k: ['source', 'find', 'save'][Math.floor(rnd() * 3)] }),
    g => g.on('poke', { id: ['brand', 'nav:about', 'nav:pricing', 'feat0', 'feat2', 'foot', 'h1', 'head', 'sub', 'todo', 'links', 'pics', 'ring', 'counter', 'pref:news', 'pref:cookies'][Math.floor(rnd() * 16)], on: rnd() < 0.5 }),
    g => g.on('poke', { id: 'terms', on: rnd() < 0.5 }), g => g.on('wake'), g => g.on('corner'), g => g.input(),
  ];
  const tally = {}; let stuck = 0;
  for (let round = 0; round < 400; round++) {
    const w = world(); const { g } = w;
    const n = 3 + Math.floor(rnd() * 25);
    for (let i = 0; i < n && g.mode === 'play'; i++) {
      g.run(Math.floor(rnd() * 6000));
      EVENTS[Math.floor(rnd() * EVENTS.length)](g);
    }
    // whatever happened, leaving it alone must get somewhere: an ending, a waiting page, or a screen saver that resolves
    g.settle(900000); if (g.scene === 'timeout' || (g.mode === 'play' && g.settled && g.run(200000) === undefined && g.scene === 'timeout')) { g.on('corner'); g.run(60000); g.settle(900000); }
    if (g.mode === 'play' && !g.settled) { stuck++; console.log(`✗ fuzz round ${round} still talking in ${g.scene}`); }
    if (w.log.ended) tally[w.log.ended.id] = (tally[w.log.ended.id] || 0) + 1;
  }
  sections++;
  console.log(`${stuck ? '✗' : '✓'} fuzz: 400 random sessions, none stuck. Endings reached: ${Object.entries(tally).map(([k, v]) => k + ' ' + v).join(', ')}`);
  if (stuck) failed++;
}

// ---- the screen saver really does meet a corner exactly when promised, and never before ------------------------------
{
  let bad = 0;
  for (const [W, H] of [[1440, 900], [1200, 900], [1024, 768], [800, 600], [390, 844], [844, 390], [360, 640], [2560, 1300], [320, 480]]) {
    const w = 150, h = 62, plan = saverPlan(W, H, w, h, story.SAVER_MS);
    const near = (p, eps) => (p.x < eps || p.x > plan.Rx - eps) && (p.y < eps || p.y > plan.Ry - eps);
    const end = plan.at(story.SAVER_MS);
    let early = null;
    for (let t = 0; t < story.SAVER_MS - 250; t += 10) if (near(plan.at(t), 3)) { early = t; break; }
    if (!near(end, 0.5) || early !== null) { bad++; console.log(`  ✗ ${W}×${H}: corner at end ${near(end, 0.5)}, too early at ${early}`); }
  }
  sections++; console.log(`${bad ? '✗' : '✓'} screen saver: a corner at ${story.SAVER_MS / 1000}s and not before, at 9 window shapes`);
  if (bad) failed++;
}

// ---- the longest lines ---------------------------------------------------------------------------------------------------
{
  const long = [...ALL].filter(t => t.length > 150).sort((a, b) => b.length - a.length);
  console.log(`  ${ALL.size} different lines said; longest ${long[0] ? long[0].length : 0} characters`);
  for (const t of long) console.log(`    ${t.length > 200 ? '✗' : '·'} (${t.length}) ${t.slice(0, 70)}…`);
  check('no line is over 200 characters (it has to fit in a phone-width caption)', !long.some(t => t.length > 200));
}

console.log(failed ? `\n${failed} problem(s).` : `\nAll ${sections} checks passed.`);
process.exit(failed ? 1 : 0);
