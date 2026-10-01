// Ten of Me: the page. Floors, the run loop, keys and touch buttons, the cards between runs, saving.
// The rules are in sim.js; the picture is render.js; the floors are levels.js.
import { Game, IN, DT, HZ, RUN_SECS, MAX_RUNS } from './sim.js';
import { LEVELS } from './levels.js';
import { View, drawTimeline, TINTS } from './render.js';
import { Sound } from './sound.js';
import { Bot } from './bot.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), AUTO = Q.has('autoplay') || DEMO;
const KEY = 'tenofme.v1';
const TOUCH = matchMedia('(pointer: coarse)').matches || Q.has('touch');
if (TOUCH) document.body.classList.add('touch');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* ------------------------------------------------------------------------------------------------------- saving */
const save = { at: 0, open: 1, best: {}, sound: true, seenHow: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* a bad save starts fresh */ }
function store() { if (DEMO || AUTO) return; try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* storage off */ } }

const snd = new Sound(); snd.on = save.sound !== false;
const view = new View($('c'));
let fi = 0, g = null, mode = 'intro', acc = 0, fast = false, rw = 0, rwDur = 0.8, afterRewind = null, endT = 0, bot = null;

/* ------------------------------------------------------------------------------------------------------- floors */
function loadFloor(i, { card = true } = {}) {
  fi = Math.max(0, Math.min(LEVELS.length - 1, i));
  g = new Game(LEVELS[fi]); view.setLevel(g.L); layout();
  $('fname').textContent = LEVELS[fi].name; $('fno').textContent = `Floor ${fi + 1} of ${LEVELS.length}`;
  hideBar(); mode = 'play'; acc = 0;
  if (card && !AUTO) introCard(); else closeCard();
  if (!DEMO) { save.at = fi; store(); }
}

/* ------------------------------------------------------------------------------------------------------- layout */
let rect = { x: 0, y: 0, w: 1, h: 1 }, msgAt = 0;
function layout() {
  const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 3);
  document.body.classList.toggle('tall', h > w * 1.1);
  const top = $('top').getBoundingClientRect().bottom + 4;
  let bottom = $('bottom').getBoundingClientRect().top - 6;
  if (!TOUCH) bottom -= 26;
  const side = 12, tall = h > w * 1.1;
  rect = { x: side, y: top, w: w - side * 2, h: Math.max(60, bottom - top), zoom: tall ? 2.4 : 1 };
  if (g) {
    view.layout(w, h, dpr, rect);
    // spare height goes mostly below the floor, where the bar at the end of a run can sit without covering anyone
    const spare = rect.h - g.L.H * 16 * view.S; if (spare > 0) view.oy = rect.y + spare * 0.3;
  }
  const lh = g ? g.L.H * 16 * view.S : 0, ly = view.oy;
  if (g) view.follow(g.you.x, true);
  // the 'move to start' word sits in the gap above the floor, or below it, never over it
  const mh = 34, below = bottom - (ly + lh);
  msgAt = ly - top > mh + 4 ? ly - mh - 2 : below > mh + 4 ? ly + lh + 4 : -1;
  if (msgAt >= 0) $('msg').style.top = msgAt + 'px';
  const room = bottom - (ly + lh), barH = $('bar').offsetHeight || 118;
  $('bar').style.top = (room > barH + 10 ? ly + lh + Math.min(18, (room - barH) / 2) : ly > top + barH + 10 ? ly - barH - 8 : Math.max(top, ly + lh - barH - 6)) + 'px';
  $('hint').style.bottom = (innerHeight - bottom - 2) + 'px';
  const turn = TOUCH && h > w * 1.1; $('turn').hidden = !turn; if (turn) $('turn').style.top = (ly + lh + 14) + 'px';
}
addEventListener('resize', layout);
visualViewport?.addEventListener('resize', layout);

/* ------------------------------------------------------------------------------------------------------- input */
const held = { L: 0, R: 0, U: 0, D: 0, A: 0 }; let tap = 0;
const KEYS = { ArrowLeft: 'L', a: 'L', A: 'L', ArrowRight: 'R', d: 'R', D: 'R', ArrowUp: 'U', w: 'U', W: 'U', ArrowDown: 'D', s: 'D', S: 'D', ' ': 'A', e: 'A', E: 'A', z: 'A', Z: 'A', j: 'A', J: 'A' };
function bits() { let b = tap; for (const k in held) if (held[k]) b |= IN[k]; return b; }
const busy = () => !$('card').hidden || mode === 'confirm';
addEventListener('keydown', e => {
  snd.init(); if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = KEYS[e.key];
  if (!$('card').hidden) { if (e.key === 'Enter' || (e.key === ' ' && !e.repeat)) { e.preventDefault(); $('cbox').querySelector('.go')?.click(); } else if (e.key === 'Escape') { if (mode !== 'intro') closeCard(); } return; }
  if (k) { e.preventDefault(); if (!held[k]) tap |= IN[k]; held[k] = 1; return; }
  if (e.key === 'Enter') { e.preventDefault(); if (e.repeat) return; if (!$('bar').hidden) $('bar').querySelector('.go')?.click(); else if (mode === 'play') doStop(); return; }
  if (e.key === 'r' || e.key === 'R') { if (!e.repeat) doRedo(); return; }
  if (e.key === 'f' || e.key === 'F' || e.key === 'Shift') { fast = true; return; }
  if (e.key === 'm' || e.key === 'M') { toggleSound(); return; }
  if (e.key === 'Escape') { if (mode === 'confirm') cancelConfirm(); else menuCard(); return; }
});
addEventListener('keyup', e => { const k = KEYS[e.key]; if (k) held[k] = 0; if (e.key === 'f' || e.key === 'F' || e.key === 'Shift') fast = false; });
addEventListener('blur', () => { for (const k in held) held[k] = 0; fast = false; });
for (const b of document.querySelectorAll('.pad button')) {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); held[k] = 1; tap |= IN[k]; b.classList.add('on'); snd.init(); try { b.setPointerCapture(e.pointerId); } catch { /* fine without */ } });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { held[k] = 0; b.classList.remove('on'); });
  b.addEventListener('contextmenu', e => e.preventDefault());
}
const fb = $('bfast');
fb.addEventListener('pointerdown', e => { e.preventDefault(); fast = true; fb.classList.add('on'); snd.init(); try { fb.setPointerCapture(e.pointerId); } catch { /* fine without */ } });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) fb.addEventListener(ev, () => { fast = false; fb.classList.remove('on'); });
$('bstop').addEventListener('click', () => { snd.init(); doStop(); });
$('bredo').addEventListener('click', () => { snd.init(); doRedo(); });
$('bmenu').addEventListener('click', () => { snd.init(); menuCard(); });
document.addEventListener('contextmenu', e => e.preventDefault());

// tap a run on the timeline to go back to it
let hoverLane = -1, tlGeom = null;
const tl = $('tl');
tl.addEventListener('pointermove', e => { if (!tlGeom) return; const r = tl.getBoundingClientRect(); hoverLane = tlGeom.laneAt(e.clientY - r.top); });
tl.addEventListener('pointerleave', () => { hoverLane = -1; });
tl.addEventListener('click', e => {
  if (!tlGeom || AUTO || busy() || mode === 'rewind') return; const r = tl.getBoundingClientRect(); const n = tlGeom.laneAt(e.clientY - r.top);
  if (n >= 0 && n < g.run) confirmBack(n);
});

/* ------------------------------------------------------------------------------------------------------- run control */
function doStop() { if (mode !== 'play' || busy() || !g.started || g.ended || AUTO) return; g.stop(); for (const ev of g.drain()) handle(ev); acc = 0; onEnd(); }
function doRedo() {
  if (busy() || mode === 'rewind' || AUTO) return;
  if (mode === 'play' && !g.started) return;
  hideBar(); rewind(() => g.redo(), 0.55);
}
function doNext() { if (!g.canNext()) return; hideBar(); g.pendingShown = g.pending; rewind(() => { g.pendingShown = null; g.next(); }, 0.85); }
function rewind(then, dur) { mode = 'rewind'; rw = 0; rwDur = dur; afterRewind = then; snd.rewind(); for (const k in held) if (k !== 'L' && k !== 'R') held[k] = 0; }
function confirmBack(n) {
  const was = mode; mode = 'confirm';
  showBar(`Back to run ${n + 1}?`, `${g.run > n + 1 ? `Runs ${n + 1}–${g.run} come` : `Run ${n + 1} comes`} off the tape, and you play run ${n + 1} again.`, [
    ['Go back', 'go', () => { hideBar(); mode = was === 'confirm' ? 'play' : was; rewind(() => g.eraseFrom(n), 0.7); }],
    ['Cancel', '', () => cancelConfirm(was)],
  ]);
  confirmBack.was = was;
}
function cancelConfirm(was = confirmBack.was) { hideBar(); mode = was || 'play'; if (g.ended && mode === 'play') onEnd(true); }

/* ------------------------------------------------------------------------------------------------------- the bar and cards */
function showBar(h, p, buttons, cls = '') {
  const b = $('bar'); b.className = cls; b.hidden = false;
  b.innerHTML = `<h3>${h}</h3><p>${p}</p><div class="row">${buttons.map((x, i) => `<button class="btn ${x[1]}" data-i="${i}">${x[0]}</button>`).join('')}</div>`;
  b.querySelectorAll('button').forEach(el => el.addEventListener('click', () => { snd.init(); buttons[+el.dataset.i][2](); }));
  layout();
}
function hideBar() { $('bar').hidden = true; }
const who = c => !c || c.live ? 'You' : `Copy ${c.n + 1}`;
function onEnd(again = false) {
  const e = g.ended, n = g.run + 1;
  if (!again) endT = 0;
  if (e.type === 'win' || AUTO) return;   // the win card follows a moment later
  if (e.type === 'alarm') {
    const what = e.what === 'laser' ? `${who(e.by)} crossed a laser` : `The camera saw ${e.by.live ? 'you' : 'copy ' + (e.by.n + 1)}`;
    return showBar('Alarm!', `${what}. An alarm can’t go on the tape, so run ${n} plays again.`, [[`Redo run ${n} <kbd>R</kbd>`, 'go', doRedo]], 'alarm');
  }
  if (!g.canNext()) return showBar(`That was run ${MAX_RUNS}`, 'No runs left. Play the last one again, tap an earlier run on the timeline to go back to it, or start the floor over.', [[`Redo run ${n}`, 'go', doRedo], ['Start over', 'warn', () => { hideBar(); rewind(() => g.restart(), 0.9); }]]);
  const p = e.type === 'caught' ? `The guard took you. Copy ${n} will walk into his arms again, unless something changes.`
    : e.type === 'stop' ? `Copy ${n} will wait on that spot for the rest of every run after this.`
      : `Copy ${n} will do all of that again, alongside you.`;
  const h = e.type === 'caught' ? 'Caught' : e.type === 'stop' ? `Run ${n} stops here` : 'Out of time';
  showBar(h, p, [[`Run ${n + 1} <kbd>Enter</kbd>`, 'go', doNext], [`Redo run ${n} <kbd>R</kbd>`, '', doRedo]]);
}
function card(html) { $('cbox').innerHTML = html; $('card').hidden = false; for (const k in held) held[k] = 0; fast = false; }
function closeCard() { $('card').hidden = true; if (mode === 'intro' || mode === 'menu') mode = 'play'; }
function on(sel, fn) { $('cbox').querySelector(sel)?.addEventListener('click', () => { snd.init(); fn(); }); }
const HOW = `<ul class="how">
  <li>You get <b>ten runs</b> of <b>thirty seconds</b>. Every run you have played replays beside you, exactly: a faded copy of you in its own colour, with its run number over its head.</li>
  <li>Plates hold their door open while any of you stands on one. Lasers and cameras sound the alarm if they catch any of you. Guards chase the first of you they see.</li>
  <li>If you change things so a copy can’t do what it did (its door is shut, its key is gone), it flickers and freezes where it stands. That can be useful too.</li>
  <li>Any one of you walking out of the loading dock with the jewel wins the floor.</li>
  <li>${TOUCH ? '◀ ▶ walk, ▲ ▼ climb, the hand grabs and puts down. Stop ends a run where you stand; hold ⏩ to hurry.' : 'Arrows or WASD walk and climb, Space grabs and puts down, Enter stops the run where you stand, R plays a run again, hold F to hurry.'} Tap a run on the timeline to go back to it.</li></ul>`;
function introCard() {
  mode = 'intro'; const L = LEVELS[fi], best = save.best[L.name];
  card(`<div class="no">${fi === 0 && !save.seenHow ? 'Ten of Me · ' : ''}Floor ${fi + 1} of ${LEVELS.length}</div><h2>${esc(L.name)}</h2>${fi === 0 && !save.seenHow ? HOW : ''}<p>${esc(L.lesson)}</p>
    <div class="par">Can be done in ${L.par} run${L.par > 1 ? 's' : ''}${best ? ` · your best ${best}` : ''}</div>
    <div class="row"><button class="btn go" id="cgo">Start <kbd>Enter</kbd></button><button class="btn" id="cfl">Floors</button></div>`);
  on('#cgo', () => { save.seenHow = true; store(); closeCard(); });
  on('#cfl', menuCard);
}
function menuCard() {
  if (mode === 'rewind' || AUTO) return;
  const back = mode === 'intro' ? 'intro' : 'play'; mode = 'menu';
  const fl = LEVELS.map((L, i) => { const b = save.best[L.name]; return `<button data-f="${i}" class="${i === fi ? 'cur' : ''}" ${i < save.open ? '' : 'disabled'}><b>${i + 1}. ${esc(L.name)}</b><span>${b ? `<span class="ok">✓</span> ${b} run${b > 1 ? 's' : ''} · par ${L.par}` : i < save.open ? `par ${L.par}` : 'locked'}</span></button>`; }).join('');
  card(`<div class="no">Ten of Me</div><h2>Floors</h2><div class="floors">${fl}</div>${HOW}
    <div class="row"><button class="btn go" id="cback">Back <kbd>Esc</kbd></button><button class="btn" id="cre">Start this floor over</button><button class="btn" id="csnd">Sound: ${snd.on ? 'on' : 'off'}</button></div>`);
  $('cbox').querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { snd.init(); loadFloor(+b.dataset.f); }));
  on('#cback', () => { if (back === 'intro') introCard(); else closeCard(); });
  on('#cre', () => { closeCard(); hideBar(); rewind(() => g.restart(), 0.9); });
  on('#csnd', () => { toggleSound(); menuCard(); });
}
function winCard() {
  const L = LEVELS[fi], n = g.run + 1, prev = save.best[L.name];
  if (!DEMO && !AUTO) { if (!prev || n < prev) save.best[L.name] = n; save.open = Math.max(save.open, Math.min(LEVELS.length, fi + 2)); store(); }
  const last = fi === LEVELS.length - 1, by = g.ended.by;
  const tapes = Array.from({ length: MAX_RUNS }, (_, i) => `<i style="background:${TINTS[i]}" class="${i < n ? '' : 'off'}"></i>`).join('');
  card(`<div class="no">Floor ${fi + 1} · ${esc(L.name)}</div><h2>${last ? 'The whole museum' : 'Out the dock'}</h2>
    <div class="tapes">${tapes}</div>
    <p>${by.live ? 'You' : 'Copy ' + (by.n + 1)} walked the jewel out on run ${n} of ${MAX_RUNS}${n <= L.par ? ', as few as it can be done in.' : `. It can be done in ${L.par}.`}${prev && n < prev ? ' A new best.' : ''}</p>
    ${last ? '<p>Every floor, every jewel. Ten of you, and not one of you seen leaving.</p>' : ''}
    <div class="row">${last ? '' : '<button class="btn go" id="cnext">Next floor <kbd>Enter</kbd></button>'}<button class="btn ${last ? 'go' : ''}" id="cagain">Play it again</button><button class="btn" id="cfl">Floors</button></div>`);
  on('#cnext', () => loadFloor(fi + 1));
  on('#cagain', () => { closeCard(); mode = 'play'; g.restart(); hideBar(); });
  on('#cfl', menuCard);
  mode = 'won';
}
function toggleSound() { snd.setOn(!snd.on); save.sound = snd.on; store(); }

/* ------------------------------------------------------------------------------------------------------- events */
function handle(ev) {
  view.onEvent(ev);
  switch (ev.type) {
    case 'start': snd.start(); break;
    case 'plate': snd.plate(ev.data.on); break;
    case 'door': snd.door(ev.data.open); break;
    case 'pick': snd.pick(ev.data.it.id === 'jewel'); break;
    case 'drop': snd.drop(); break;
    case 'unlock': snd.unlock(); break;
    case 'spot': snd.spot(); break;
    case 'caught': snd.caught(); break;
    case 'freeze': snd.freeze(); break;
    case 'end': if (ev.data.type === 'alarm') snd.alarm(); if (ev.data.type === 'win') snd.win(); break;
  }
}

/* ------------------------------------------------------------------------------------------------------- the clock on the wall */
let last = performance.now(), stepDist = 0, lastX = 0;
function frame(ms) { const dt = Math.min(0.1, (ms - last) / 1000); last = ms; if (!window.__hold) advance(dt, ms / 1000); requestAnimationFrame(frame); }
function advance(dt, now) {
  if (mode === 'play' && !busy() && !g.ended) {
    acc += dt * (fast ? 3.5 : 1);
    let n = 0;
    while (acc >= DT && n++ < 30) {
      acc -= DT;
      let inp = bits();
      if (bot) { g.start(); inp = bot.input(g); if (bot.stop) { bot.stop = false; g.stop(); } }
      g.step(inp); tap = 0;
      for (const ev of g.drain()) handle(ev);
      if (g.ended) { acc = 0; onEnd(); break; }
    }
    const me = g.you; stepDist += Math.abs(me.x - lastX); lastX = me.x; if (stepDist > 9) { stepDist = 0; if (me.ground && !g.ended) snd.step(); }
  } else if (mode === 'rewind') {
    rw += dt / rwDur;
    if (rw >= 1) { mode = 'play'; acc = 0; afterRewind?.(); afterRewind = null; for (const ev of g.drain()) handle(ev); autoNextRun(); }
  }
  if (g.ended && mode === 'play') {
    const was = endT; endT += dt;
    if (g.ended.type === 'win' && was < 1.4 && endT >= 1.4) { if (AUTO) autoAgain(); else winCard(); }
    if (AUTO && g.ended && g.ended.type !== 'win' && was < 0.7 && endT >= 0.7) { hideBar(); g.canNext() ? doNext() : (g.restart(), autoNextRun()); }
  }
  view.follow(mode === 'rewind' ? g.L.start.x : g.you.x);
  view.draw(g, now, { dt, rewind: mode === 'rewind' ? rw : null });
  tlGeom = drawTimeline(tl, g, Math.min(devicePixelRatio || 1, 3), now, hoverLane);
  hud();
  snd.update(g, mode === 'play' && g.started && !g.ended && !busy());
}
let lastHud = '';
function hud() {
  const left = Math.max(0, RUN_SECS - g.t), s = Math.floor(left), d = Math.floor((left - s) * 10);
  const txt = `${s}|${d}|${g.run}|${mode}|${g.started}|${!!g.ended}`;
  if (txt === lastHud) return; lastHud = txt;
  $('secs').innerHTML = `${s}<small>.${d}</small>`; $('secs').classList.toggle('low', left < 5.5 && g.started && !g.ended);
  $('runno').style.color = TINTS[g.run];
  $('bstop').disabled = !(mode === 'play' && g.started && !g.ended);
  $('bstop').style.opacity = $('bstop').disabled ? .4 : 1;
  const m = $('msg'), waiting = mode === 'play' && !g.started && !g.ended && $('card').hidden && !AUTO;
  m.hidden = !waiting || msgAt < 0;
  $('runno').textContent = waiting && msgAt < 0 ? `Run ${g.run + 1} · move to start` : `Run ${g.run + 1} of ${MAX_RUNS}`;
  if (waiting) m.innerHTML = g.run ? `<b>Run ${g.run + 1}</b> · ${g.run} cop${g.run > 1 ? 'ies' : 'y'} waiting · move to start` : `<b>Run 1</b> · move to start the clock`;
}
setTimeout(() => { $('hint').style.opacity = 0; }, 16000);

/* ------------------------------------------------------------------------------------------------------- autoplay and the preview */
function autoNextRun() { if (AUTO) bot = new Bot(LEVELS[fi].solution[g.run] || []); }
function autoAgain() { if (DEMO) { demoSetup(); return; } if (fi < LEVELS.length - 1 && !Q.has('level')) loadFloor(fi + 1, { card: false }); else g.restart(); autoNextRun(); endT = 0; }
// the preview: a floor with its earlier runs already on the tape, the last run under way
function demoSetup() {
  const sol = LEVELS[fi].solution;
  g.restart();
  for (let r = 0; r < sol.length - 1; r++) { const b = new Bot(sol[r]); g.start(); while (!g.ended) { const i = b.input(g); if (b.stop) { g.stop(); break; } g.step(i); } g.next(); }
  bot = new Bot(sol.at(-1)); g.start();
  const to = +(Q.get('t') ?? (Q.has('level') ? 0 : 17.2)) * HZ; while (g.tick < to && !g.ended) { const i = bot.input(g); if (bot.stop) { bot.stop = false; g.stop(); break; } g.step(i); }
  g.drain(); hideBar(); mode = 'play'; endT = 0;
}

/* ------------------------------------------------------------------------------------------------------- start */
const start = Q.has('level') ? +Q.get('level') - 1 : DEMO ? LEVELS.length - 1 : Math.min(save.at || 0, save.open - 1);
if (DEMO) { loadFloor(Q.has('level') ? start : Math.min(start, LEVELS.length - 1), { card: false }); demoSetup(); $('hint').hidden = true; }
else if (AUTO) { loadFloor(start, { card: false }); autoNextRun(); }
else loadFloor(start);
requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => { last = performance.now(); for (const k in held) held[k] = 0; fast = false; });
document.fonts?.ready.then(() => { view.bake = null; lastHud = ''; layout(); });

// for poking at from the console, and for testing while the page is hidden
window.__tm = { get g() { return g; }, view, snd, advance, loadFloor, frames(n, dtMs = 1000 / 60) { for (let i = 0; i < n; i++) advance(dtMs / 1000, performance.now() / 1000); }, press(k, on = 1) { held[k] = on; if (on) tap |= IN[k]; } };
