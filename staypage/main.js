// Please Stay on This Page: wires the story (engine.js + story.js) to the page (view.js), the browser's goings-on (sense.js)
// and the little bit of localStorage that remembers you. ?at=3:00 and ?day=1 bend the clock; ?fresh forgets nothing and
// remembers nothing; ?demo is the preview screenshot.
import { createGame } from './engine.js';
import * as story from './story.js';
import { createStore, makeClock, makeStorage } from './store.js';
import { createView } from './view.js';
import { attach } from './sense.js';
import * as sound from './sound.js';

const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const demo = q.has('demo');
const at = (m => m && { h: Math.min(23, +m[1]), m: Math.min(59, +(m[2] || 0)) })(/^(\d{1,2})(?::(\d{2}))?$/.exec(q.get('at') || ''));
const clock = makeClock({ at, day: parseInt(q.get('day')) || 0 });
const memory = seed => { let mem = seed ? JSON.stringify(seed) : null; return { read: () => mem, write: s => { mem = s; }, clear: () => { mem = null; } }; };
const storage = demo ? memory({ visits: 3, sound: false, endings: { terms: 1, saver: 1, stillhere: 1 } }) : q.has('fresh') ? memory(null) : makeStorage(window);

const store = createStore({ storage, clock });
const view = createView({ store, demo });
const g = createGame({ view, store, story });
view.bind(g);
view.updateCount();
const sense = attach({ g, view, demo });
view.onReload = () => { sense.noPrompt(); setTimeout(() => location.reload(), 900); };
window.staypage = { g, store, view };   // for poking at from the console

// ---- the corner buttons, the cards, the narrator's caption ------------------------------------------------------------
const again = () => { view.hideVeils(); g.restart(); };
$('endBtn').addEventListener('click', () => view.openTracker());
$('tkClose').addEventListener('click', view.hideVeils);
$('tkAgain').addEventListener('click', again);
$('cardAgain').addEventListener('click', again);
$('cardList').addEventListener('click', () => { view.hideVeils(); view.openTracker(); });
$('tkForget').addEventListener('click', e => {
  if (e.target.dataset.sure) { sense.noPrompt(); store.forget(); location.reload(); return; }
  e.target.dataset.sure = 1; e.target.textContent = 'Really? Click again';
});
for (const v of document.querySelectorAll('.veil')) v.addEventListener('pointerdown', e => { if (e.target === v && v.id !== 'confVeil') v.hidden = true; });
addEventListener('keydown', e => { if (e.key === 'Escape') { document.querySelectorAll('.veil').forEach(v => { if (!v.hidden) { v.hidden = true; if (v.id === 'confVeil') g.on('confirm', { ok: false }); } }); } });
$('confYes').addEventListener('click', () => { $('confVeil').hidden = true; g.on('confirm', { ok: true }); });
$('confNo').addEventListener('click', () => { $('confVeil').hidden = true; g.on('confirm', { ok: false }); });
const snd = $('sndBtn'), paintSound = () => { snd.setAttribute('aria-pressed', store.state.sound); $('sndWave').style.opacity = store.state.sound ? 1 : 0; };
snd.addEventListener('click', () => { store.setSound(!store.state.sound); sound.setOn(store.state.sound); sound.unlock(); if (store.state.sound) sound.ping(); paintSound(); });
sound.setOn(store.state.sound); paintSound();
const narr = $('narr');
const skip = () => { if (getSelection().toString().length) return; g.skip(); };
narr.addEventListener('click', skip);
for (const id of ['gone', 'cmList']) $(id).addEventListener('click', skip);   // the 404 and the comments say things too
narr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skip(); } });
new ResizeObserver(() => document.documentElement.style.setProperty('--narr-h', narr.offsetHeight + 'px')).observe(narr);

// ---- go -----------------------------------------------------------------------------------------------------------------
if (demo) view.demo();
else {
  store.boot();
  g.boot();
  let last = performance.now();
  const loop = now => { const dt = Math.min(100, now - last); last = now; g.tick(dt); view.frame(dt); requestAnimationFrame(loop); };
  requestAnimationFrame(t => { last = t; loop(t); });
}
