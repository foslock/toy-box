// Starts the game: loads the save (and catches up on the time away), runs the clock, and wires taps, keys and buttons
// to the sim. ?demo shows a game already under way for the preview picture (never saved); ?debug exposes window.G,
// with &speed=N, &hold (step by hand with G.step), &auto (a pretend player plays) and &phase=1..4 (start there).
import * as G from './sim.js';
import { makeView } from './view.js';
import { makeSound } from './sound.js';
import { makeBot, botStep, playTo } from './bot.js';

const q = new URLSearchParams(location.search);
const DEMO = q.has('demo'), DEBUG = q.has('debug');
const SPEED = DEBUG ? +(q.get('speed') || 1) : 1;
const KEY = 'toybox.starter.v1';
const STEP = 0.1;

// ---- saving -----------------------------------------------------------------------------------------------------------
const store = (() => {
  let ls = null, mem = null;
  if (!DEMO) try { ls = window.localStorage; ls.getItem(KEY); } catch { ls = null; }
  return {
    read() { try { const r = ls ? ls.getItem(KEY) : mem; return r ? JSON.parse(r) : null; } catch { return null; } },
    write(o) { const t = JSON.stringify(o); mem = t; try { ls && ls.setItem(KEY, t); } catch {} },
    clear() { mem = null; try { ls && ls.removeItem(KEY); } catch {} },
  };
})();

function revive(saved) {
  const base = G.fresh(saved.seed, { gen: saved.gen });
  const s = Object.assign(base, saved);
  s.n = Object.assign(G.fresh(1).n, saved.n || {});
  delete s._r;
  return s;
}

let s, saved = store.read();
const sound = makeSound();
sound.on = DEMO ? false : saved ? saved.sound !== false : true;

if (DEMO) {
  const which = q.get('demo') || 'town';
  const until = { kitchen: s => s.t > 290, town: s => s.phase === 1 && s.jars > 950, world: s => s.phase === 2 && s.n.field >= 44, beyond: s => s.phase === 3 && G.rise(s) > .6 }[which] || (() => false);
  s = playTo(until).s;
} else if (DEBUG && q.get('phase')) {
  const p = +q.get('phase') - 1;
  s = playTo(s => s.phase >= p && s.t - s.phaseAt[p] > 2).s;
} else if (saved && saved.s) {
  s = revive(saved.s);
} else s = G.fresh();

// ---- what the sim says ------------------------------------------------------------------------------------------------
let view;
let pendingPhase = false, ended = false;
const ev = {
  log(l) { view && view.log(l); },
  sound(name) { sound.play(name, s.phase); },
  fx(name, d) {
    if (name === 'feed') view.jar.feed({ disc: d.disc, base1: Math.min(.45, .45 * s.grams / G.stats(s).cap) });
    else if (name === 'phase') { pendingPhase = true; view.curtain(s, () => { view.layout(s); window.scrollTo(0, 0); pendingPhase = false; }); save(); }
    else if (name === 'end') finish();
    else if (name === 'collapse') document.getElementById('mapBox').animate([{ transform: 'translateY(0)' }, { transform: 'translateY(14px)' }, { transform: 'translateY(0)' }], { duration: 1600, easing: 'ease-out' });
  },
};
view = makeView({
  buy: id => G.buy(s, id, ev),
  make: id => G.make(s, id, ev),
});
view.layout(s);

// ---- the clock --------------------------------------------------------------------------------------------------------
let last = performance.now(), acc = 0, hold = DEBUG && q.has('hold');
const bot = DEBUG && q.has('auto') ? makeBot(q.get('auto') || 'steady', ev) : null;
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 3 && !hold && !DEMO) { comeBack(dt); dt = 0; }
  dt = Math.min(dt, .25);
  if (!hold && !ended) {
    acc += dt * SPEED;
    let n = 0;
    while (acc >= STEP && n++ < 400) { G.tick(s, STEP, ev); if (bot) botStep(bot, s, STEP); acc -= STEP; }
    if (n >= 400) acc = 0;
  }
  if (!pendingPhase) view.render(s, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Time passed with the page shut or hidden: run it on quietly, then say what happened if it was a while.
function comeBack(seconds) {
  if (ended || s.done) return;
  const quiet = { log() {}, sound() {}, fx(n) { if (n === 'end') setTimeout(finish, 50); } };
  const sum = G.catchUp(s, seconds, quiet);
  view.layout(s);
  if (seconds > 60) view.away(sum, s);
  save();
}
if (saved && saved.at && !DEMO && !(DEBUG && q.get('phase'))) {
  const gone = (Date.now() - saved.at) / 1000;
  if (gone > 5) comeBack(gone);
}
if (s.done && !DEMO) setTimeout(finish, 300);

// ---- saving -----------------------------------------------------------------------------------------------------------
function save() {
  if (DEMO) return;
  const { _r, ...rest } = s;
  store.write({ s: rest, at: Date.now(), sound: sound.on });
}
setInterval(save, 5000);
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); save(); }
  else if (hiddenAt) { const gone = (Date.now() - hiddenAt) / 1000; hiddenAt = 0; last = performance.now(); if (gone > 3 && !hold) comeBack(gone); }
});
window.addEventListener('pagehide', save);

// ---- tapping the jar --------------------------------------------------------------------------------------------------
const jarEl = document.getElementById('jar');
function tapJar(x, y) {
  sound.unlock();
  if (ended) return;
  const b = G.tap(s, ev);
  view.jar.tap();
  view.tapFx(x, y, b);
}
jarEl.addEventListener('pointerdown', e => { if (e.button) return; e.preventDefault(); tapJar(e.clientX, e.clientY); });
jarEl.addEventListener('contextmenu', e => e.preventDefault());
jarEl.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); tapJar(); } });
document.addEventListener('keydown', e => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'button' || e.target === jarEl) return;
  if (e.key === ' ' || e.key === 'b' || e.key === 'B') { e.preventDefault(); tapJar(); }
});
// iOS only lets audio start inside certain gestures, so try on each of them
for (const t of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(t, () => sound.unlock(), { capture: true });

// ---- the other controls -----------------------------------------------------------------------------------------------
const $ = id => document.getElementById(id);
$('giveBtn').addEventListener('click', () => { sound.unlock(); G.give(s, ev); });
$('warmIn').addEventListener('input', e => G.setWarmth(s, +e.target.value));
function soundIcon() {
  const btn = $('sndBtn');
  btn.querySelector('.w').toggleAttribute('hidden', !sound.on);
  btn.querySelector('.x').toggleAttribute('hidden', sound.on);
  btn.setAttribute('aria-label', sound.on ? 'Sound on' : 'Sound off');
}
soundIcon();
$('sndBtn').addEventListener('click', () => { sound.on = !sound.on; sound.unlock(); soundIcon(); save(); });
$('menuBtn').addEventListener('click', () => {
  $('menuStats').textContent = `${s.name}, generation ${s.gen}. Playing for ${Math.round(s.t / 60)} min · ${s.clicks.toLocaleString('en-GB')} taps.`;
  $('resetBtn').textContent = 'Start again';
  $('menu').hidden = false;
});
$('menuOk').addEventListener('click', () => { $('menu').hidden = true; });
$('menu').addEventListener('click', e => { if (e.target.id === 'menu') $('menu').hidden = true; });
$('resetBtn').addEventListener('click', () => {
  const b = $('resetBtn');
  if (b.textContent !== 'Really start over?') { b.textContent = 'Really start over?'; return; }
  store.clear();
  s = G.fresh();
  ended = false;
  $('menu').hidden = true;
  view.layout(s);
  save();
});
$('awayOk').addEventListener('click', () => { $('away').hidden = true; });
$('away').addEventListener('click', e => { if (e.target.id === 'away') $('away').hidden = true; });

// ---- the end ----------------------------------------------------------------------------------------------------------
function finish() {
  if (ended) return;
  ended = true;
  save();
  sound.play('end');
  view.ending(s, () => {
    sound.play('feed');
    view.endCard(s, () => {
      s = G.fresh(undefined, { gen: s.gen + 1 });
      ended = false;
      save();
      location.reload();
    });
  });
}

if (DEBUG) {
  window.G = {
    get s() { return s; }, set s(v) { s = v; view.layout(s); }, sim: G, view, ev, sound,
    step(sec) { for (let t = 0; t < sec; t += STEP) { G.tick(s, STEP, ev); if (bot) botStep(bot, s, STEP); } view.render(s, 0, true); return s; },
    hold(v = true) { hold = v; },
    to(fn, kind) { s = playTo(fn, { kind }).s; view.layout(s); return s; },
  };
}
