import { View } from './render.js';
import { Shift, STOOLS, HUSH } from './sim.js';
import { YEARS, yearDef, NOTES, NAMES, ITEMS, CARDS, ENDING, LOOKS, priceOf } from './story.js';
import { drawItem, drawPerson } from './art.js';
import { Bot } from './bot.js';
import { Sound } from './audio.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug'), AUTO = Q.has('autoplay');
const KEY = 'regulars.v1';
const $ = (id) => document.getElementById(id);
const cv = $('cv'), view = new View(cv), snd = new Sound();
const coarse = matchMedia('(pointer: coarse)').matches;

const money = (c) => '$' + (c / 100).toFixed(2);
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} };
const fresh = () => ({ year: 1952, flags: {}, totals: { takings: 0, served: 0, walked: 0, usuals: 0, usualChances: 0, cups: 0, perfect: 0, pours: 0 }, cards: {}, easy: save?.easy ?? false, sound: save?.sound ?? true });
let save = null; save = load() || fresh();
snd.on = save.sound !== false;

let S = null, bot = null, mode = 'title', tut = null, ending = null, paused = false;
const ui = { sel: null, drag: null, dragTo: null };
const pours = new Map();

const menuFor = (y) => { const m = [...YEARS[0].menu]; for (const d of YEARS) if (d.year <= y) for (const k of d.fresh || []) m.push(k); return m; };
let menu = menuFor(1952);

// ——— layout ———
function layout() {
  const w = innerWidth, h = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
  view.resize(w, h, dpr); const L = view.L;
  const cap = $('cap'); cap.style.left = L.scene.x + 'px'; cap.style.top = (L.counterY + L.counterH + 2) + 'px'; cap.style.width = L.scene.w + 'px'; cap.style.height = L.capH + 'px';
  const note = $('note'); const nw = Math.min(L.scene.w - 20, 460); note.style.width = nw + 'px'; note.style.left = (L.scene.x + (L.scene.w - nw) / 2) + 'px'; note.style.bottom = (h - (L.counterY + L.counterH)) + 'px';
}
addEventListener('resize', layout);

// ——— captions ———
let shownCap = null;
function syncCaption() {
  const c = S?.cap; if (c === shownCap) return; shownCap = c; const el = $('cap');
  if (!c) { el.innerHTML = ''; return; }
  const name = c.who === 'stranger' ? 'Customer' : NAMES[c.who];
  el.className = c.who ? 'new' : 'nar new'; el.innerHTML = '';
  if (c.who) { const b = document.createElement('b'); b.textContent = name; el.append(b); }
  const s = document.createElement('span'); s.textContent = c.text; el.style.fontSize = ''; el.append(s);
  for (const px of [15, 14, 13]) { if (s.offsetHeight <= el.clientHeight) break; el.style.fontSize = px + 'px'; } // a long line on a small shelf
}

// ——— starting a day ———
function startShift(year, { tutorial = false } = {}) {
  dropChoice();
  const def = yearDef(year); menu = menuFor(year);
  S = new Shift(def, { easy: save.easy, flags: save.flags, seed: (Number(Q.get('seed')) || 0) + year * 7 + 1 });
  view.year = year; view.actors.clear(); view.backdrop = null; ui.sel = null; ui.drag = null; ui.dragTo = null; pours.clear();
  $('yr').innerHTML = `${year} <small>${def.cal}</small>`; $('hud').classList.remove('off'); $('till').textContent = money(0);
  snd.setYear(year, def); snd.startMusic(); mode = 'shift'; paused = false; bot = null; shownCap = undefined; syncCaption();
  if (AUTO || DEMO) bot = new Bot(S, { delay: Number(Q.get('delay')) || .42 });
  if (tutorial && !AUTO) beginTutorial(); else if (def.tutorial) { /* autoplay skips the notes */ }
}

// ——— the interactive first morning ———
const NOTEFOR = { urn: () => [view.R.urn.levers[0]], toaster: () => [view.R.toaster], griddle: () => [view.R.griddle.bins[0], ...view.R.griddle.slots], fount: () => [view.R.fount], pie: () => [view.R.pie.apple], stool: (i) => [{ x: view.L.sx + i * view.L.sw, y: view.L.scene.y + 12, w: view.L.sw, h: view.L.counterY + view.L.counterH - view.L.scene.y - 12 }] };
let noteTimer = 0;
function showNote(text, skip = true, low = false, up = false) { clearTimeout(noteTimer); const n = $('note'); n.classList.toggle('low', low && view.L.mode === 'tall'); n.classList.toggle('up', up && view.L.mode !== 'tall'); n.innerHTML = (skip ? '<button class="skip" id="skipT">Skip the notes</button>' : '') + ''; n.append(document.createTextNode(text)); n.classList.toggle('noskip', !skip); n.classList.add('in'); if (skip) $('skipT').onclick = endTutorial; }
const hideNote = () => $('note').classList.remove('in');
const arrive = (p) => { S.sit({ kind: 'reg', ...p }, p.seat, p.who.length); };

function beginTutorial() {
  S.noClock = true; S.noPatience = true;
  tut = { step: 0, pulse: null };
  arrive({ who: ['gus'], seat: 2, order: ['coffee', 'toast', 'eggs'], say: ['gus|So you’re Bea’s. The sign says Sunny Side, so you’re Sunny. Coffee, toast, eggs.'], eat: ['gus|Your clock’s four minutes fast, Sunny. Bea never would fix it.'] });
  tutStep('coffee');
}
function tutStep(name) {
  tut.name = name; const t = tut;
  const set = (note, pulse, allow) => { showNote(note, true, name !== 'pie', name === 'clear'); view.pulse = pulse; t.allow = allow; };
  if (name === 'coffee') set(NOTES.coffee, NOTEFOR.urn, h => h.st === 'urn' && h.kind === 'coffee');
  if (name === 'serve') set(NOTES.serve, () => [view.R.urn], h => h.t === 'item' || h.t === 'stool');
  if (name === 'toast') set(NOTES.toast, NOTEFOR.toaster, h => h.t === 'toast' || h.ref?.at === 'toaster' || h.t === 'stool');
  if (name === 'eggs') set(NOTES.eggs, NOTEFOR.griddle, h => h.kind === 'eggs' || h.t === 'griddle' || h.ref?.at === 'griddle' || h.t === 'stool');
  if (name === 'wait') { hideNote(); view.pulse = null; t.allow = h => false; }
  if (name === 'clear') set(NOTES.clear, () => NOTEFOR.stool(2), h => h.t === 'stool');
  if (name === 'fount') { arrive({ who: ['dot', 'danny'], seat: 0, order: ['choc', 'straw'], say: ['dot|Chocolate milk. He wants strawberry, but it’s for his sister.', 'danny|It’s for my sister.'], eat: ['dot|I’m Dot. I’m nine. I will never get tired of this.'] }); set(NOTES.fount, NOTEFOR.fount, h => h.st === 'fount' || (h.t === 'item' && h.ref?.at === 'fount') || h.t === 'stool'); }
  if (name === 'pie') { arrive({ who: ['frank', 'helen'], seat: 3, order: ['apple', 'apple'], say: ['helen|Two slices of apple, please. We’re just married.', 'frank|She tells everybody.'], eat: ['frank|Is it always this quiet?'] }); set(NOTES.pie, NOTEFOR.pie, h => h.ref?.at === 'pie' || h.t === 'stool'); }
  if (name === 'tidy') { set('Clear those places when they go. Then see who’s back.', null, h => h.t === 'stool'); }
  if (name === 'usual') { arrive({ who: ['gus'], seat: 2, order: ['coffee'], hush: 1, hushFor: 9999, say: [], eat: ['gus|Well. You can be taught.'] }); set(NOTES.usual, () => [view.R.urn], h => h.st === 'urn' && h.kind === 'coffee' || h.t === 'item' || h.t === 'stool'); }
  if (name === 'rush') { endTutorial(true); }
}
function tutTick() {
  const t = tut; if (!t) return; const n = t.name; const p = S.parties;
  const delivered = (k) => t.got?.includes(k);
  if (n === 'coffee' && S.urn.glass?.ready) tutStep('serve');
  else if (n === 'coffee' && !S.urn.glass && S.stats.served) tutStep('toast');
  else if (n === 'serve' && S.stats.served >= 1) tutStep('toast');
  else if (n === 'toast' && S.stats.served >= 2) tutStep('eggs');
  else if (n === 'eggs' && S.stats.served >= 3) tutStep('wait');
  else if (n === 'wait' && S.stools[2].dirty) tutStep('clear');
  else if (n === 'clear' && !S.stools[2].dirty) tutStep('fount');
  else if (n === 'fount' && S.stats.served >= 5) tutStep('pie');
  else if (n === 'pie' && S.stats.served >= 7) tutStep('tidy');
  else if (n === 'tidy' && !S.parties.length && !S.stools.some(s => s.dirty) && !S.cap && !S.captions.length) tutStep('usual');
  else if (n === 'usual' && S.stats.served >= 8) { tutStep('rush'); }
}
function endTutorial(natural) {
  if (!tut) return; tut = null; view.pulse = null;
  S.noClock = false; S.noPatience = false;
  if (natural !== true) { for (const p of [...S.parties]) { S.walkOut(p); S.stats.walked--; } for (let i = 0; i < STOOLS; i++) S.stools[i].dirty = null; S.captions.length = 0; S.cap = null; }
  showNote(NOTES.rush, false); noteTimer = setTimeout(hideNote, 5200);
}

// ——— input ———
function act(hit, e) {
  const lastCup = mode === 'ending' && ending?.phase === 1;
  if (!S || paused || (mode !== 'shift' && !lastCup)) return;
  snd.init();
  if (!hit) { ui.sel = null; return; }
  if (tut && tut.allow && !tut.allow(hit) && hit.t !== 'bin' && hit.ref?.at !== 'pass') return; // a stray plate can always be moved or binned
  if (lastCup && !(hit.st === 'urn' && hit.kind === 'coffee')) return;
  if (hit.t === 'pour') { if (S.pourStart(hit.st, hit.kind)) { pours.set(e.pointerId, hit.st); snd.pour(true); } return; }
  if (hit.t === 'griddle+') { if (S.griddleAdd(hit.kind) === false) snd.fx('nope'); return; }
  if (hit.t === 'griddle') { S.griddleTap(hit.i); return; }
  if (hit.t === 'toast') { if (S.toast() === false) snd.fx('nope'); return; }
  if (hit.t === 'item') { const it = S.peek(hit.ref); if (!it) return; ui.drag = { ref: hit.ref, kind: it.kind, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moved: false, id: e.pointerId }; return; }
  if (hit.t === 'stool') {
    if (ui.sel) { const r = S.serveTo(ui.sel, hit.i); if (r !== 'none') { ui.sel = null; return; } }
    const s = S.stools[hit.i]; if (s.dirty) S.clear(hit.i); return;
  }
  if (hit.t === 'bin') { if (ui.sel) { S.bin(ui.sel); ui.sel = null; } return; }
}

function tapItem(ref) {
  const it = S.peek(ref); if (!it) return;
  const sameSel = ui.sel && JSON.stringify(ui.sel) === JSON.stringify(ref);
  if (sameSel) { ui.sel = null; return; }
  if (S.target(it.kind)) { S.autoServe(ref); ui.sel = null; return; }
  // nobody's asking for it. If a regular is sitting quiet, or it's already on the pass, pick it up. Otherwise it goes on the pass.
  const quiet = S.parties.some(p => p.state === 'hush') || S.stools.some(s => s.ghost && !s.ghostCup);
  if (quiet || ref.at === 'pass') { ui.sel = ref; return; }
  if (ref.at === 'pie') { ui.sel = ref; return; }
  const r = S.autoServe(ref); if (r === 'full') snd.fx('nope');
}

cv.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!S) return; act(view.hit(e.clientX, e.clientY, S, menu), e); });
addEventListener('pointermove', (e) => {
  const d = ui.drag; if (!d || e.pointerId !== d.id) return;
  d.x = e.clientX; d.y = e.clientY; if (Math.hypot(d.x - d.x0, d.y - d.y0) > 10) d.moved = true;
  const h = view.hit(d.x, d.y, S, menu); ui.dragTo = d.moved && h?.t === 'stool' ? h.i : null;
});
function up(e) {
  const st = pours.get(e.pointerId); if (st) { pours.delete(e.pointerId); if (S) S.pourStop(st); if (!pours.size) snd.pour(false); }
  const d = ui.drag; if (!d || e.pointerId !== d.id) return; ui.drag = null; ui.dragTo = null;
  if (!S) return;
  if (!d.moved) return tapItem(d.ref);
  const h = view.hit(e.clientX, e.clientY, S, menu);
  if (h?.t === 'stool') S.serveTo(d.ref, h.i);
  else if (h?.t === 'bin') S.bin(d.ref);
}
addEventListener('pointerup', up); addEventListener('pointercancel', up);
$('cap').style.pointerEvents = 'none';

// keyboard: hold a letter to pour, Space does the next obvious thing, 1–5 for the stools
const KEYS = { c: ['urn', 'coffee'], v: ['urn', 'tea'], m: ['fount', 'milk'], b: ['fount', 'choc'], n: ['fount', 'straw'], k: ['fount', 'cola'] };
addEventListener('keydown', (e) => {
  const sheet = $('sheet').classList.contains('on');
  if (e.key === 'Escape' && (mode === 'shift')) { sheet ? closePause() : openPause(); return; }
  if (sheet || $('choice').classList.contains('on')) { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { const f = document.activeElement; if (f?.tagName === 'BUTTON') return; const b = document.querySelector('.sheet.on .btn.main, #choice.on .btn.main'); if (b) { e.preventDefault(); b.click(); } } return; }
  if (mode === 'ending' && ending?.phase === 1 && !e.repeat && e.key.toLowerCase() === 'c' && S.pourStart('urn', 'coffee')) { snd.init(); pours.set('kc', 'urn'); snd.pour(true); return; }
  if (e.repeat || !S || paused || mode !== 'shift') return; snd.init();
  const k = e.key.toLowerCase();
  if (tut && !['c', ' ', 't', 'e', 'b', 'n', 'p', '1', '2', '3', '4', '5'].includes(k)) return;
  if (KEYS[k]) { const [st, kind] = KEYS[k]; if (kind === 'cola' && !menu.includes('cola')) return; if (S.pourStart(st, kind)) { pours.set('k' + k, st); snd.pour(true); } return; }
  if (k === 't') { S.toast(); return; } if (k === 'e') { S.griddleAdd('eggs'); return; } if (k === 'r' && menu.includes('burger')) { S.griddleAdd('burger'); return; }
  if (k === 'p' || k === 'o') { const kind = k === 'p' ? 'apple' : 'cherry'; if (menu.includes(kind)) tapItem({ at: 'pie', kind }); return; }
  if (k === ' ') { e.preventDefault(); if (S.cap && !S.nextReady()) { S.skipCaption(); return; } const n = S.nextReady(); const idle = n && !('griddle' in n) && !S.target(S.peek(n).kind); if (!n || idle) { const i = S.stools.findIndex(s => s.dirty); if (i >= 0) { S.clear(i); return; } if (!n) return; } if ('griddle' in n) S.griddleTap(n.griddle); else tapItem(n); return; }
  if (k >= '1' && k <= '5') { const i = +k - 1; const n = S.nextReady(); if (ui.sel) { if (S.serveTo(ui.sel, i) !== 'none') ui.sel = null; } else if (S.stools[i].dirty) S.clear(i); else if (n && !('griddle' in n)) S.serveTo(n, i); }
});
addEventListener('keyup', (e) => { const id = 'k' + e.key.toLowerCase(); const st = pours.get(id); if (st) { pours.delete(id); if (S) S.pourStop(st); if (!pours.size) snd.pour(false); } });
$('menuB').onclick = () => openPause();

// ——— what the frame does with game events ———
function drain() {
  const L = view.L;
  for (const e of S.ev) {
    const sx = e.seat != null ? view.stoolX(e.seat) : 0, cy = L.counterY - 10;
    switch (e.type) {
      case 'sit': snd.fx('door', { reg: e.reg }); break;
      case 'serve': { if (e.from) { const [x, y] = view.refCentre(e.from); view.flyItem(e.kind, x, y, sx + ((e.party?.n || 1) - 1) * L.sw / 2, L.counterY + L.counterH * .4); } snd.fx('plate');
        if (e.party?.reg && mode === 'shift') save.cards[e.party.who[0]] = e.party.order; break; }
      case 'usual': if (!e.party.usual) { view.float('The usual!', sx + (e.party.n - 1) * L.sw / 2, cy - 30, '#c9453a', true); snd.fx('usual'); } break; // Danny's glass gets no fanfare
      case 'nope': view.float('not that', sx, cy - 8, '#6f6456'); snd.fx('nope'); break;
      case 'clear': if (e.amt) { view.float('+' + money(e.amt), sx + (e.n - 1) * L.sw / 2, cy, '#3c8f88'); } snd.fx(e.reg ? 'till' : 'coin'); $('till').textContent = money(S.stats.takings); break;
      case 'walk': view.float('walked out', sx, cy - 20, '#c9453a'); snd.fx('walk'); ui.sel = null; break;
      case 'leave': if (e.party.choice && !AUTO && !DEMO) ask(e.party.choice, e.seat); break;
      case 'perfect': snd.fx('perfect'); break;
      case 'spill': snd.fx('spill'); snd.pour(false); for (const [k, v] of pours) if (v === e.st) pours.delete(k); break;
      case 'pourstop': if (!pours.size) snd.pour(false); break;
      case 'ding': case 'pop': case 'flip': case 'burn': case 'sizzle': case 'scrape': case 'lever': snd.fx(e.type); break;
      case 'pour': break;
    }
  }
  S.ev.length = 0;
}

function dropChoice() { $('choice').classList.remove('on'); }
function ask(choice, seat) {
  if (paused) return; S.hold = true; $('choiceT').textContent = choice.text; $('choice').classList.add('on');
  const done = (house) => { $('choice').classList.remove('on'); S.hold = false; if (house) { const d = S.stools[seat].dirty; if (d) d.onHouse = true; save.flags.comped = (save.flags.comped || 0) + 1; } S.say(house ? '|You wave it off. He looks at the counter a while, and nods once.' : '|He pushes the coins across, one at a time.'); };
  $('chTake').onclick = () => done(false); $('chHouse').onclick = () => done(true);
}

// ——— frame ———
let last = 0; const SPEED = Number(Q.get('speed')) || 1;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
  try { step(dt * SPEED, dt); } catch (e) { console.error(e); if (DEBUG) window.__crash = e; }
}
function step(dt, real) {
  if (!S || !view.L) return;
  if (!paused && !DEBUG_HOLD) { for (let i = 0, n = Math.ceil(dt / .05); i < n; i++) { const d = dt / n; S.tick(d); if (bot && !S.hold) bot.tick(d); } }
  tutTick(); drain(); syncCaption(); if (ui.sel && !S.peek(ui.sel)) ui.sel = null;
  view.frame(S, menu, ui, real ?? dt);
  if (mode === 'shift' && S.done) endShift();
  if (mode === 'title') { S.captions.length = 0; S.cap = null; S.ev.length = 0; if (S.done) backstage(); }
  if (mode === 'ending') tickEnding();
}
let DEBUG_HOLD = false;

// ——— sheets ———
const sheet = (html, opts = {}) => { $('sheetP').innerHTML = html; $('sheet').classList.add('on'); $('sheet').scrollTop = 0; if (!coarse) { const b = $('sheetP').querySelector('.btn.main'); b?.focus({ preventScroll: true }); } };
const hideSheet = () => $('sheet').classList.remove('on');
const wire = (id, fn) => { const b = $(id); if (b) b.onclick = () => { snd.init(); fn(); }; };

// the counter keeps going behind the title
function backstage() {
  S = new Shift(yearDef(1958), { seed: 40 + Math.floor(Math.random() * 99) }); bot = new Bot(S, { delay: 1 }); menu = menuFor(1958);
  view.actors.clear(); view.backdrop = null; for (let i = 0; i < 300; i++) { S.tick(.05); bot.tick(.05); } S.ev.length = 0; S.captions.length = 0; S.cap = null;
}
function title() {
  mode = 'title'; paused = false; $('hud').classList.add('off'); hideNote(); backstage();
  if (save.ending && !DEMO && !AUTO) { // left during the last scene: it's still three o'clock
    sheet(`<h1>Regulars</h1><p class="sub">The Sunny Side, 1971</p><div class="btns"><button class="btn main" id="go">Three o’clock</button></div>`);
    wire('go', () => { hideSheet(); S = null; beginEnding(); }); return;
  }
  const has = save.year > 1952 && save.year <= 1971;
  const finished = save.year > 1971;
  sheet(`<h1>Regulars</h1><p class="sub">The Sunny Side, 1952 to 1971</p>
    <p class="lede">You get one day of every year, behind the same counter, with the same six regulars. Keep up with the rush. Remember what they have. Their orders will tell you how they’re doing.</p>
    <div class="btns">${has ? `<button class="btn main" id="go">Open up in ${save.year}</button><button class="btn quiet" id="restart">Start again from 1952</button>` : `<button class="btn main" id="restart">${finished ? 'Open up again' : 'Open up'}</button>`}
    <button class="btn quiet" id="easyB">Easy shifts: ${save.easy ? 'on' : 'off'}</button></div>`);
  wire('go', () => dayCard(save.year));
  let sure = !has;
  wire('restart', () => { if (!sure) { sure = true; $('restart').textContent = `Lose ${save.year}? Tap again to start over`; return; } const k = { easy: save.easy, sound: save.sound }; save = { ...fresh(), ...k }; persist(); dayCard(1952); });
  wire('easyB', () => { save.easy = !save.easy; persist(); title(); });
}

function itemCanvas(kind) { const c = document.createElement('canvas'); c.width = c.height = 80; const x = c.getContext('2d'); x.scale(1.66, 1.66); x.translate(24, 24); drawItem(x, kind); return c; }

function dayCard(year) {
  const def = yearDef(year); mode = 'card'; S = null; hideNote(); $('hud').classList.add('off'); menu = menuFor(year);
  const showShift = () => { hideSheet(); startShift(year, { tutorial: !!def.tutorial }); };
  if (AUTO) return showShift();
  const newK = def.fresh || [];
  sheet(`<h2>${year}</h2><div style="color:var(--mute)">${def.cal}</div>
    ${def.note ? `<div class="bea">${def.note}</div>` : '<div style="height:12px"></div>'}
    ${newK.map(k => `<div class="newi" data-k="${k}">New on the menu: ${ITEMS[k].name}, ${priceOf(k, year)}¢</div>`).join('')}
    <div class="btns"><button class="btn main" id="go">Flip the sign</button></div>`);
  document.querySelectorAll('.newi').forEach(n => n.prepend(itemCanvas(n.dataset.k)));
  wire('go', showShift);
}

function endShift() {
  mode = 'ledger'; snd.stopMusic();
  const st = S.stats, year = S.year, T = save.totals;
  for (const k of ['takings', 'served', 'walked', 'usuals', 'usualChances', 'cups', 'perfect', 'pours']) T[k] = (T[k] || 0) + st[k];
  save.year = year + 1; if (year === 1971) save.ending = true; persist();
  if (year === 1971) return beginEnding();
  if (AUTO) { window.__log = window.__log || []; window.__log.push({ year, ...st }); return dayCard(year + 1); }
  const lines = S.overheard.filter(l => l.who !== 'stranger').map(l => l.who ? `<p><b>${NAMES[l.who]}:</b> ${l.text}</p>` : `<p><i>${l.text}</i></p>`).join('');
  sheet(`<h2>${year}</h2>
    <table class="led"><tr><td>Takings</td><td>${money(st.takings)}</td></tr><tr><td>Plates and cups served</td><td>${st.served}</td></tr><tr><td>Walked out</td><td>${st.walked}</td></tr>
    ${st.usualChances ? `<tr><td>Usuals remembered</td><td>${st.usuals} of ${st.usualChances}</td></tr>` : ''}<tr class="t"><td>Poured to the line</td><td>${st.perfect} of ${st.pours}</td></tr></table>
    ${lines ? `<div class="lab">Overheard</div><div class="over">${lines}</div>` : ''}
    <div class="btns"><button class="btn main" id="go">${year + 1}</button></div>`);
  wire('go', () => dayCard(year + 1));
}

function openPause() {
  if (mode !== 'shift' || paused) return; paused = true; for (const st of pours.values()) S.pourStop(st); pours.clear(); snd.pour(false);
  const rows = CARDS.map(c => { const o = save.cards[c.id]; return `<div class="row"><b>${c.label}</b><span>${o ? [...new Set(o)].map(k => ITEMS[k].name).join(', ') : c.sub}</span></div>`; }).join('');
  sheet(`<h2 style="font-size:34px">Back in a minute</h2>
    <div class="lab">The card file: what they had last</div><div class="file">${rows}</div>
    <div class="lab">The counter</div>
    <div class="row"><span>${coarse ? 'Hold a tap to pour. Tap to send. Drag to choose who.' : 'Mouse: hold to pour, click to send, drag to choose who.<br>Keys: hold C coffee, V tea, M milk, B chocolate, N strawberry, K cola. T toast, E eggs, R burger, P/O pie. Space does the next job. 1–5 are the stools.'}</span></div>
    <div class="row"><span>Sound</span><button class="sw" id="sw1" aria-pressed="${snd.on}">${snd.on ? 'On' : 'Off'}</button></div>
    <div class="row"><span>Easy shifts (slower walkouts)</span><button class="sw" id="sw2" aria-pressed="${save.easy}">${save.easy ? 'On' : 'Off'}</button></div>
    <div class="btns"><button class="btn main" id="back">Back to work</button><button class="btn quiet" id="redo">Start ${S.year} over</button><button class="btn quiet" id="out">Leave for the title</button></div>`);
  wire('back', closePause);
  wire('sw1', () => { snd.setOn(!snd.on); save.sound = snd.on; persist(); paused = false; openPause(); });
  wire('sw2', () => { save.easy = !save.easy; S.easy = save.easy; persist(); paused = false; openPause(); });
  wire('redo', () => { const y = S.year; tut = null; view.pulse = null; dropChoice(); hideSheet(); dayCard(y); });
  wire('out', () => { tut = null; view.pulse = null; dropChoice(); snd.stopMusic(); S = null; title(); });
}
function closePause() { hideSheet(); paused = false; }

// ——— last day ———
function beginEnding() {
  const def = { ...yearDef(1971), parties: [], n: 0, dur: 1e9 };
  S = new Shift(def, { flags: save.flags, seed: 3 }); menu = menuFor(1971); S.noClock = true; S.noPatience = true; view.actors.clear();
  mode = 'ending'; snd.setYear(1971, { quiet: 1 }); snd.startMusic();
  const place = (who, seat) => { const n = who.length; S.sit({ kind: 'reg', who, order: ['coffee'], say: [] }, seat, n); const p = S.parties[S.parties.length - 1]; p.state = 'eat'; p.eatT = 1e9; p.mood = 'happy'; };
  place(['dot', 'june'], 0); place(['ray'], 3); place(['vera'], 4);
  S.ev.length = 0;
  for (const l of ENDING(save.flags)) S.say(l);
  ending = { phase: 0 };
}
function tickEnding() {
  const e = ending; if (!e) return;
  if (e.phase === 0 && !S.cap && !S.captions.length) { e.phase = 1; endPour(); }
  if (e.phase === 1 && S.urn.glass?.ready) { e.phase = 2; view.pulse = null; hideNote(); S.urn.glass = null; S.stools[2].ghostCup = true; snd.fx('plate');
    S.say('|It’s terrible coffee. It has always been terrible coffee.'); S.say('|You sit there a while. Over the counter, the clock says three-oh-nine. Gus’s watch says three-oh-five.'); S.say('danny|You want me to fix that?'); S.say('|You tell him to leave it.'); }
  if (e.phase === 2 && !S.cap && !S.captions.length) { e.phase = 3; lastPage(); }
}
function endPour() { view.pulse = () => [view.R.urn]; showNote('Hold it till the line. One more.', false); }

function lastPage() {
  const T = save.totals; snd.stopMusic(2); ending = null; mode = 'done'; save.ending = false; persist();
  const pct = T.usualChances ? Math.round(T.usuals / T.usualChances * 100) : 0;
  sheet(`<div class="bea" style="transform:rotate(.5deg);margin-top:4px">Danny —<br>Hold it till the line. Don’t get fancy.<br>Regulars won’t tell you what they want. You’ll know.<br>Paint the place if you must. Don’t move the stools.<br>Leave the clock alone.<div class="sign">— Sunny</div></div>
    <table class="led"><tr><td>Years</td><td>20</td></tr><tr><td>Cups of coffee</td><td>${T.cups}</td></tr><tr><td>Plates and cups served</td><td>${T.served}</td></tr><tr><td>Usuals remembered</td><td>${T.usuals} of ${T.usualChances} (${pct}%)</td></tr><tr class="t"><td>Takings</td><td>${money(T.takings)}</td></tr></table>
    <div class="btns"><button class="btn main" id="again">The End</button></div>`);
  wire('again', () => { hideSheet(); title(); });
}

// ——— boot ———
view.keys = !coarse;
layout();
const fontsReady = Promise.race([Promise.all(['16px Jost', '30px "Over the Rainbow"', '30px "Fontdiner Swanky"'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 2500))]);
requestAnimationFrame(frame);
fontsReady.then(() => {
  view.backdrop = null;
  if (DEMO) {
    const y = Number(Q.get('y')) || 1958; startShift(y); bot.delay = 1.1; $('note').classList.remove('in');
    for (let i = 0; i < 780; i++) { S.tick(.05); bot.tick(.05); } S.ev.length = 0; S.captions.length = 0; S.cap = null;
    S.say('sy|Lovely weather we’re having, Miss Lund.');
  } else if (AUTO) { const y = Number(Q.get('y')) || 1952; save = fresh(); dayCard(y); }
  else if (Q.get('y')) { dayCard(Number(Q.get('y'))); }
  else if (Q.has('end')) { save.year = 1972; beginEnding(); }
  else title();
  window.toyboxReady?.();
});
addEventListener('visibilitychange', () => { if (document.hidden && mode === 'shift' && !paused && !AUTO && !DEMO) openPause(); });

if (DEBUG || AUTO) window.rg = { get S() { return S; }, view, ui, get mode() { return mode; }, hold(v) { DEBUG_HOLD = v; }, ff(sec) { for (let i = 0; i < sec * 20; i++) { S.tick(.05); bot?.tick(.05); if (S.done) break; } drain(); }, step, save: () => save, Bot, setBot(o) { bot = new Bot(S, o); } };
