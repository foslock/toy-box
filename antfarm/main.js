// Ant Farm: the page. Owns the farm (sim.js) and its drawing (render.js), and everything you touch: the tray of ants,
// upgrades and extras, tapping to put things in, picking an ant to follow, the menu, saving, and the walkthrough.
import { Farm } from './sim.js';
import { View, wx, wy } from './render.js';
import { W, DEPTH, AIR, THING, MATS, ANTS, ANT_ORDER, UPGRADES, MAX_LEVEL, ITEMS, SOURCES, HUNGRY } from './rules.js';
import { THING_BY_ID } from './art.js';
import { makePlayer } from './autoplay.js';
import { mulberry32 } from './world.js';
import { iconHTML } from './icons.js';
import { Coach } from './coach.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo');
const KEY = 'antfarm.save';
const TOUCH = matchMedia('(pointer: coarse)').matches;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const fmtTime = s => s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m`;
const randomSeed = () => 1 + Math.floor(Math.random() * 99998);
const seedOf = text => { const t = String(text).trim(); if (/^\d{1,9}$/.test(t)) return +t; let h = 2166136261; for (const ch of t) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) % 99999 + 1; };

const ROOM_NAME = { pantry: 'Pantry', nursery: 'Nursery', midden: 'Midden', rest: 'Resting room' };
const DOING = { eat: 'Going for a bite', gather: 'Fetching food', deliver: 'Taking food home', haul: 'Carrying dirt up top', dig: 'Digging', gallery: 'Digging a new gallery',
  explore: 'Exploring for food', rest: 'Resting', tend: 'Looking after the brood', patrol: 'Keeping everyone busy', corpse: 'Carrying off the dead', queen: 'Ruling, resting', '': 'Having a think' };

/* ---------- saving ---------- */
let tut = { done: false, step: 'place' };
let labelsOn = true;
function loadSave() { try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function save() {
  if (DEMO || !farm) return;
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, farm: farm.toJSON(), ui: { tut, speed: speed || 1, labels: labelsOn } })); } catch { /* storage full or blocked: it just won't keep */ }
}

/* ---------- the farm and the view ---------- */
let farm, speed = 1, lastSpeed = 1;
const saved = DEMO ? null : loadSave();
if (saved?.farm) { try { farm = new Farm(0, saved.farm); } catch (e) { console.warn('Could not load the saved farm:', e); farm = null; } }
if (saved?.ui) { tut = { ...tut, ...saved.ui.tut }; labelsOn = saved.ui.labels !== false; speed = lastSpeed = [1, 3, 8].includes(saved.ui.speed) ? saved.ui.speed : 1; }
if (!farm) farm = new Farm(DEMO ? 1 : randomSeed());
if (DEMO) {
  // A farm that's been going for a while: the stand-in player runs it for forty minutes before the first frame.
  const player = makePlayer('balanced', mulberry32(9));
  farm.headless = true;
  for (let t = 0; t < 40 * 60; t += .1) { player(farm); farm.step(.1); }
  farm.headless = false; farm.events.length = 0;
  tut.done = true;
}

const view = new View($('c'));
view.setFarm(farm);

/* ---------- the tray ---------- */
let tab = 'ants', tool = null, sel = null, follow = false;
const cards = $('cards');
function setTab(t) {
  tab = t;
  for (const b of document.querySelectorAll('.tabs [data-tab]')) b.setAttribute('aria-selected', b.dataset.tab === t);
  buildCards();
}
for (const b of document.querySelectorAll('.tabs [data-tab]')) b.onclick = () => setTab(b.dataset.tab);
function card(id, icon, name, blurb, onClick) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'cardb'; b.dataset.id = id;
  b.append(iconHTML(icon, 3));
  const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = name;
  const cost = document.createElement('span'); cost.className = 'cost';
  b.append(nm, cost);
  b.onclick = onClick;
  b.onpointerenter = () => { $('trayNote').textContent = blurb; };
  b.onpointerleave = () => { $('trayNote').textContent = ''; };
  b.setAttribute('aria-label', `${name}. ${blurb}`);
  cards.append(b);
  return b;
}
function buildCards() {
  cards.textContent = '';
  if (tab === 'ants') for (const t of ANT_ORDER) card('ant:' + t, t, ANTS[t].name, ANTS[t].blurb, () => pickTool({ kind: 'ant', type: t }));
  if (tab === 'upgrades') for (const u of UPGRADES) {
    const b = card('up:' + u.id, u.id, u.name, u.blurb, () => buyUpgrade(u.id));
    const pips = document.createElement('span'); pips.className = 'pips';
    for (let k = 0; k < MAX_LEVEL; k++) pips.append(document.createElement('i'));
    b.append(pips);
  }
  if (tab === 'extras') {
    card('item:aphids', 'aphids', 'Aphids', ITEMS.aphids.blurb, () => pickTool({ kind: 'item', id: 'aphids' }));
    card('item:feed', 'feed', 'Crumbs', ITEMS.feed.blurb, () => pickTool({ kind: 'item', id: 'feed' }));
    card('order', 'order', 'Dig here', 'An officer’s order: diggers tunnel to wherever you tap.', () => pickTool({ kind: 'order' }));
  }
  updateCards();
}
function updateCards() {
  for (const b of cards.children) {
    const id = b.dataset.id, cost = b.querySelector('.cost');
    let text = '', poor = false, locked = false, pressed = false;
    if (id.startsWith('ant:')) {
      const t = id.slice(4), can = farm.canBuy(t), d = ANTS[t];
      const first = !farm.colony;
      if (first && t === 'worker') { text = 'Free'; cost.classList.add('free'); } else { text = d.cost + ' food'; cost.classList.remove('free'); }
      if (first && t !== 'worker') locked = true;
      if (d.needs && !farm.count(d.needs)) { locked = true; text = 'Needs ' + ANTS[d.needs].name.toLowerCase(); }
      if (d.max && farm.count(t) >= d.max) { locked = true; text = 'Have one'; }
      poor = !can.ok && !locked;
      pressed = tool?.kind === 'ant' && tool.type === t;
      let n = b.querySelector('.count');
      const have = farm.count(t);
      if (have && !d.max) { if (!n) { n = document.createElement('span'); n.className = 'count'; b.append(n); } n.textContent = have; } else if (n) n.remove();
    } else if (id.startsWith('up:')) {
      const u = UPGRADES.find(q => q.id === id.slice(3)), l = farm.lvl(u.id);
      text = l >= MAX_LEVEL ? 'All done' : u.costs[l] + ' food';
      poor = l < MAX_LEVEL && farm.food < u.costs[l];
      locked = l >= MAX_LEVEL || !farm.colony;
      b.querySelectorAll('.pips i').forEach((p, k) => p.classList.toggle('on', k < l));
    } else if (id === 'item:aphids') {
      text = farm.itemCost('aphids') + ' food'; poor = farm.food < farm.itemCost('aphids'); locked = !farm.colony;
      pressed = tool?.id === 'aphids';
    } else if (id === 'item:feed') {
      const wait = Math.ceil(farm.feedAt - farm.t);
      text = wait > 0 ? `In ${fmtTime(wait)}` : 'Free'; cost.classList.toggle('free', wait <= 0);
      locked = !farm.colony || wait > 0; pressed = tool?.id === 'feed';
    } else if (id === 'order') {
      locked = !farm.count('officer'); text = locked ? 'Needs officer' : 'Order';
      pressed = tool?.kind === 'order';
    }
    if (cost.textContent !== text) cost.textContent = text;
    b.classList.toggle('poor', poor); b.classList.toggle('locked', locked);
    b.setAttribute('aria-pressed', pressed);
  }
}
function pickTool(t) {
  if (tool && JSON.stringify(tool) === JSON.stringify(t)) { setTool(null); return; }
  let can;
  if (t.kind === 'ant') can = farm.canBuy(t.type);
  else if (t.kind === 'item') can = farm.canPlaceItem(t.id);
  else can = farm.count('officer') ? { ok: true } : { ok: false, why: 'Orders need an officer. Buy one on the Ants tab.' };
  if (!can.ok) { toast(can.why, 'bad'); return; }
  setTool(t);
}
function setTool(t) {
  tool = t;
  view.showGhost(null);
  $('c').classList.toggle('aim', !!t);
  updateCards();
  refreshHint();
}
function buyUpgrade(id) {
  const r = farm.buyUpgrade(id);
  if (!r.ok) { toast(r.why, 'bad'); return; }
  const u = UPGRADES.find(q => q.id === id);
  toast(`${u.name} ${['I', 'II', 'III'][farm.lvl(id) - 1]}: ${u.blurb}`, 'good');
  flash('foodChip');
  updateCards(); save();
}

/* ---------- messages ---------- */
function toast(html, kind = '') {
  if (DEMO) return;
  const box = $('toasts');
  if ([...box.children].some(t => t.dataset.text === html && !t.classList.contains('out'))) return;
  const el = document.createElement('div');
  el.className = 'toast panelish ' + kind; el.innerHTML = html; el.dataset.text = html;
  box.append(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, 3400);
}
function flash(id) { const el = $(id); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
let hintHTML = '';
function setHint(html) {
  const el = $('hint');
  if (html === hintHTML) return;
  hintHTML = html;
  el.innerHTML = html;
  el.classList.toggle('off', !html);
  el.classList.toggle('coach', html.includes('coach-tag'));
}

/* ---------- the walkthrough ---------- */
const coach = new Coach($('coachHand'), $('coachTap'));
const STEPS = ['place', 'dig', 'carry', 'save', 'buy', 'turn', 'drip'];
const LINES = {
  place: () => `${TOUCH ? 'Tap' : 'Click'} the dirt, or the top of it, to put in your first ant. It’s free.`,
  dig: () => 'Your ant dug itself a little nest. It can smell food nearby, and it’s digging its way there.',
  carry: () => 'Food! Your ant will carry it home to the nest, where the colony keeps its pantry.',
  save: () => 'Food in the pantry is what your ants eat, and what you spend. At <b>10</b> you can buy a second worker.',
  buy: () => tool?.type === 'worker' ? `Now ${TOUCH ? 'tap' : 'click'} the farm to put the worker in. Near the nest is best.` : `Tap <b>Worker</b> in the tray below.`,
  turn: () => `${TOUCH ? 'Drag with one finger' : 'Drag'} to turn the farm and see it from the side. ${TOUCH ? 'Pinch' : 'Scroll'} to zoom in on the ants.`,
  drip: () => 'The sugar drip and the aphids never run out, but they only make so much. Keep more ants than they can feed and the hungriest starve.',
};
let tutT = 0, tutYaw = 0;
function tutLine() {
  if (tut.done || DEMO) return '';
  return `<span class="coach-tag">Tutorial</span>${LINES[tut.step]()}<button class="coach-skip" type="button">Skip tutorial</button>`;
}
function advance(step) {
  if (tut.done || tut.step !== step) return;
  const k = STEPS.indexOf(step);
  if (k < 0 || k === STEPS.length - 1) { endTutorial(true); return; }
  tut.step = STEPS[k + 1]; tutT = 0;
  if (tut.step === 'turn') tutYaw = view.controls.getAzimuthalAngle();
  if (tut.step === 'buy' && tab !== 'ants') setTab('ants');
  save(); refreshHint();
}
function endTutorial(finished) {
  if (tut.done) return;
  tut.done = true; coach.stop(); save(); refreshHint();
  if (finished) setTimeout(() => toast('You’re all set. Diggers, scouts, a queen and upgrades are in the tray. Keep your ants fed!', 'good'), 400);
}
$('hint').addEventListener('click', e => { if (e.target.closest('.coach-skip:not(.hint-done)')) endTutorial(false); });
const center = el => { const r = el.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; };
function cellOnScreen(x, y) { const z = view.camera.position.z >= 0 ? DEPTH / 2 : -DEPTH / 2; return view.project(wx(x), wy(y), z); }
function tutGesture() {
  if (tut.done || DEMO) return null;
  switch (tut.step) {
    case 'place': return { kind: 'tap', at: () => cellOnScreen(W / 2 - 18, farm.surf[W / 2 - 18] + 12) };
    case 'dig': { const s = farm.sources.find(q => q.known && !q.reach && !q.gone && !q.surface); return s ? { kind: 'tap', at: () => cellOnScreen(s.x, s.y) } : null; }
    case 'save': return { kind: 'tap', at: () => center($('foodChip')) };
    case 'buy': return tool?.type === 'worker'
      ? { kind: 'tap', at: () => { const r = farm.homeRooms()[0]; return r ? cellOnScreen(Math.round(r.cx), Math.round(r.cy)) : null; } }
      : { kind: 'tap', at: () => center(cards.querySelector('[data-id="ant:worker"]')) };
    case 'turn': return { kind: 'swipe', from: () => ({ x: innerWidth * .38, y: innerHeight * .45 }), to: () => ({ x: innerWidth * .62, y: innerHeight * .45 }) };
    case 'drip': return { kind: 'tap', at: () => cellOnScreen(farm.dripX, farm.surf[farm.dripX] - 2) };
  }
  return null;
}
let lastGestureKey = '';
function refreshHint() {
  let html = tutLine();
  if (!html && tool) {
    const what = tool.kind === 'ant' ? `a${/^[aeiou]/i.test(ANTS[tool.type].name) ? 'n' : ''} ${ANTS[tool.type].name.toLowerCase()}` : tool.kind === 'order' ? 'your order' : tool.id === 'aphids' ? 'the aphids' : 'the crumbs';
    const where = tool.kind === 'item' ? (tool.id === 'feed' ? 'above the dirt to drop' : 'the dirt to put in') : tool.kind === 'order' ? 'the dirt to send the diggers there with' : 'the dirt, or the top of it, to put in';
    const blurb = tool.kind === 'ant' ? ANTS[tool.type].blurb : tool.kind === 'item' ? ITEMS[tool.id].blurb : 'Diggers will tunnel to wherever you tap.';
    html = `${innerWidth <= 720 ? `<b>${esc(blurb)}</b> ` : ''}${TOUCH ? 'Tap' : 'Click'} ${where} ${what}. <button class="coach-skip hint-done" type="button">Done</button>`;
  }
  setHint(html);
  const key = tut.done ? '' : tut.step + (tool?.type || '');
  if (key !== lastGestureKey) { lastGestureKey = key; coach.show(tutGesture()); }
}
$('hint').addEventListener('click', e => { if (e.target.closest('.hint-done')) setTool(null); });
function tutTick(dt) {
  if (tut.done || DEMO) return;
  tutT += dt;
  if (tut.step === 'save' && farm.food >= 10) advance('save');
  if (tut.step === 'turn' && (Math.abs(view.controls.getAzimuthalAngle() - tutYaw) > .35 || tutT > 25)) advance('turn');
  if (tut.step === 'drip' && tutT > 14) advance('drip');
  if (tut.step === 'dig' && !farm.sources.some(q => q.known && !q.reach && !q.gone && !q.surface) && tutT > 3) advance('dig');
}

/* ---------- farm news ---------- */
function onEvent(e) {
  switch (e.type) {
    case 'placed': if (e.first) advance('place'); else if (farm.ants.length >= 2) advance('buy'); break;
    case 'found': if (farm.stats.firstFood !== null || e.src.kind !== 'drip') toast(`${esc(e.ant?.name || 'An ant')} smelled a${/^[aeiou]/i.test(SOURCES[e.src.kind].name) ? 'n' : ''} <b>${SOURCES[e.src.kind].name.toLowerCase()}</b>!`, 'good'); break;
    case 'reached': toast(`The tunnel reached the <b>${SOURCES[e.src.kind].name.toLowerCase()}</b>.`); if (tut.step === 'dig') advance('dig'); break;
    case 'firstFood': advance('dig'); advance('carry'); flash('foodChip'); break;
    case 'emptied': if (e.src.kind !== 'crumbs') toast(`The ${SOURCES[e.src.kind].name.toLowerCase()} is all gone.`); break;
    case 'died': toast(`${esc(e.ant.name)} the ${ANTS[e.ant.type].name.toLowerCase()} starved.`, 'bad'); if (sel?.ant === e.ant) select(null); break;
    case 'hatched': toast(`A new worker hatched: <b>${esc(e.ant.name)}</b>.`, 'good'); break;
    case 'room': if (!e.room.nest) toast(e.room.type === 'nursery' ? 'The nursery is ready for the queen.' : e.room.type === 'midden' ? 'The ants dug a midden for their dead.' : `A new ${ROOM_NAME[e.room.type].toLowerCase()} is dug.`); break;
    case 'aphids': toast(farm.count('digger') ? 'Aphids are in. Your diggers will tunnel to them.' : 'Aphids are in. Your ants will dig to them when they can: a digger would get there sooner.', 'good'); break;
  }
}

/* ---------- pointing and tapping ---------- */
// No zooming the page on phones (a pinch on the farm zooms the farm). iOS Safari ignores user-scalable=no in the
// viewport tag, so its own pinch gestures are cancelled here too.
for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, e => e.preventDefault(), { passive: false });
const canvas = $('c');
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, button: e.button }; canvas.classList.add('grabbing'); follow = false; });
addEventListener('pointerup', e => {
  canvas.classList.remove('grabbing');
  if (!down || e.pointerId !== down.id) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 600, btn = down.button;
  down = null;
  if (e.target !== canvas || moved > 7 || !quick) return;
  if (btn === 2) { if (tool) setTool(null); return; }
  tap(e.clientX, e.clientY);
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('dblclick', () => { if (!tool) goHome(); });
function tap(x, y) {
  if (!tool && !farm.colony) tool = { kind: 'ant', type: 'worker' };      // the first ant is always a worker, on the house
  if (tool) { place(x, y); return; }
  const ant = view.pickAnt(x, y, TOUCH ? 26 : 18);
  if (ant) { select({ kind: 'ant', ant }); return; }
  const cell = view.pickCell(x, y);
  if (!cell?.inside) { select(null); return; }
  const src = sourceAt(cell.x, cell.y);
  if (src) { select({ kind: 'source', src }); return; }
  const r = farm.roomOf[cell.y * W + cell.x];
  const room = r && farm.rooms.find(q => q.id === r && farm.mat[cell.y * W + cell.x] === AIR);
  select(room ? { kind: 'room', room } : null);
}
function sourceAt(x, y) {
  let best = null, bd = 16;
  for (const s of farm.sources) {
    if (s.gone || (!s.known && !DEMO)) continue;
    const d = (s.x - x) ** 2 + ((s.surface ? farm.surf[s.x] - 1 : s.y) - y) ** 2;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
function place(x, y) {
  const cell = view.pickCell(x, y);
  if (!cell?.inside) return;
  let r;
  if (tool.kind === 'ant') r = farm.placeAnt(tool.type, cell.x, cell.y);
  else if (tool.kind === 'item') r = farm.placeItem(tool.id, cell.x, cell.y);
  else r = farm.order(cell.x, cell.y);
  if (!r.ok) { toast(r.why, 'bad'); return; }
  flash('foodChip');
  if (tool.kind === 'ant') {
    const d = ANTS[tool.type];
    if (r.ant && farm.ants.length > 1) toast(`${esc(r.ant.name)} the ${d.name.toLowerCase()} is in.`);
    if (!farm.canBuy(tool.type).ok) setTool(null);
  } else if (tool.kind === 'item') {
    if (tool.id === 'feed') toast('Crumbs, dropped in through the lid.');
    setTool(null);
  } else { toast('Orders given: the diggers will tunnel there.'); setTool(null); }
  updateCards(); save();
}
// What's under the pointer, as a line for the tooltip.
function describe(x, y) {
  const ant = view.pickAnt(x, y);
  if (ant) return `${esc(ant.name)} · ${ANTS[ant.type].name}`;
  const cell = view.pickCell(x, y);
  if (!cell?.inside) return '';
  const src = sourceAt(cell.x, cell.y);
  if (src) return sourceLine(src);
  const i = cell.y * W + cell.x, m = farm.mat[i];
  if (m === AIR) {
    const r = farm.roomOf[i] && farm.rooms.find(q => q.id === farm.roomOf[i]);
    return r ? ROOM_NAME[r.type] : cell.y < farm.surf[cell.x] ? '' : 'Tunnel';
  }
  if (m === THING) { const t = farm.lost.find(l => cell.x >= l.x && cell.x < l.x + l.w && cell.y >= l.y && cell.y < l.y + l.h); return t ? cap(THING_BY_ID[t.id].name) : 'A twig'; }
  return MATS[m].name;
}
const cap = s => s[0].toUpperCase() + s.slice(1);
function sourceLine(s) {
  const d = SOURCES[s.kind];
  return s.infinite ? `${d.name} · ${Math.floor(s.stock)} of ${s.cap} ready` : `${d.name} · ${Math.ceil(s.stock)} left`;
}
canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  if (down) { $('tip').hidden = true; return; }
  hover = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerleave', () => { hover = null; $('tip').hidden = true; view.showGhost(null); });
let hover = null;
function hoverTick() {
  const tip = $('tip');
  if (!hover || down) { tip.hidden = true; if (!tool) view.showGhost(null); return; }
  if (tool) {
    const cell = view.pickCell(hover.x, hover.y);
    if (cell?.inside) {
      const feed = tool.kind === 'item' && tool.id === 'feed';
      const land = feed ? { ok: true } : farm.landing(cell.x, cell.y);
      // crumbs land on top of the dirt, wherever along it you point
      view.showGhost(feed ? { x: cell.x, y: farm.surf[Math.max(0, Math.min(W - 1, cell.x))] - 2 } : cell, land.ok, tool.kind === 'item' && tool.id === 'aphids' ? 9 : 7);
    } else view.showGhost(null);
    tip.hidden = true;
    return;
  }
  const text = describe(hover.x, hover.y);
  canvas.classList.toggle('point', !!view.pickAnt(hover.x, hover.y));
  tip.hidden = !text;
  if (text) { tip.innerHTML = text; tip.style.left = hover.x + 'px'; tip.style.top = hover.y + 'px'; }
}

/* ---------- the info card ---------- */
function select(s) {
  sel = s; follow = false;
  $('info').hidden = !s;
  if (s) updateInfo(true);
}
$('infoX').onclick = () => select(null);
function updateInfo(fresh = false) {
  if (!sel) return;
  const pic = $('infoPic'), bar = $('infoBar'), fill = $('infoFill'), row = $('infoRow');
  if (sel.kind === 'ant') {
    const a = sel.ant;
    if (!farm.ants.includes(a)) { select(null); return; }
    if (fresh) { pic.replaceChildren(iconHTML(a.type, 3)); }
    $('infoName').textContent = a.name;
    $('infoRole').textContent = ANTS[a.type].name + (a.aura && a.type !== 'officer' ? ' · hurried along by an officer' : '');
    let now = DOING[a.job] ?? 'Busy';
    if (a.act === 'pack') now = 'Packing dirt into the walls';
    else if (a.act === 'wait' && a.job === 'gather') now = 'Waiting for food to come';
    else if (a.act === 'eat') now = 'Eating';
    else if (a.energy <= 0) now = 'Starving! ' + now;
    $('infoNow').textContent = now;
    bar.hidden = false;
    fill.style.width = Math.round(a.energy * 100) + '%';
    bar.className = 'bar' + (a.energy <= 0 ? ' empty' : a.energy < HUNGRY ? ' low' : '');
    const carry = a.carry?.kind === 'food' ? `carrying ${a.carry.n > 1 ? a.carry.n + ' crumbs' : 'a crumb'}` : a.carry?.kind === 'corpse' ? 'carrying a dead ant' : a.spoil ? 'carrying dirt' : '';
    $('infoMore').textContent = [`Fed ${Math.round(a.energy * 100)}%`, `${fmtTime(a.age)} old`, carry].filter(Boolean).join(' · ');
    if (fresh) {
      row.textContent = '';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.id = 'followBtn';
      b.onclick = () => { follow = !follow; updateInfo(); };
      row.append(b);
    }
    const fb = $('followBtn'); if (fb) { fb.textContent = follow ? 'Stop following' : 'Follow'; fb.classList.toggle('gold', follow); }
  } else if (sel.kind === 'source') {
    const s = sel.src, d = SOURCES[s.kind];
    if (s.gone) { select(null); return; }
    if (fresh) { pic.replaceChildren(iconHTML(s.kind === 'aphids' ? 'aphids' : s.kind === 'drip' ? 'drip' : 'food', 3)); row.textContent = ''; }
    $('infoName').textContent = d.name;
    $('infoRole').textContent = s.infinite ? 'Never runs out' : `${Math.ceil(s.stock)} of ${s.total} left`;
    const rate = s.infinite ? s.period / (s.kind === 'aphids' ? 1 + .3 * farm.lvl('ranch') : 1) : 0;
    $('infoNow').textContent = s.infinite ? `${Math.floor(s.stock)} of ${s.cap} ready to carry` : s.reach ? 'The ants are carrying it home' : s.known ? 'The ants know it’s here and are digging to it' : 'The ants haven’t found it yet';
    bar.hidden = !s.infinite;
    if (s.infinite) { fill.style.width = Math.round(s.stock / s.cap * 100) + '%'; bar.className = 'bar'; }
    $('infoMore').textContent = s.infinite ? `Makes a crumb every ${rate.toFixed(1).replace(/\.0$/, '')}s: enough for about ${Math.floor(60 / rate / farm.supply().perAnt)} ants` + (s.reach ? '' : ' · no tunnel to it yet') : '';
  } else if (sel.kind === 'room') {
    const r = sel.room;
    if (fresh) { pic.replaceChildren(iconHTML(r.type === 'nursery' ? 'queen' : r.type === 'pantry' ? 'food' : 'ant', 3)); row.textContent = ''; }
    $('infoName').textContent = ROOM_NAME[r.type] + (r.nest ? ' (the first nest)' : '');
    $('infoRole').textContent = r.dug ? 'Dug' : 'Being dug';
    bar.hidden = true;
    $('infoNow').textContent = r.type === 'pantry' ? `The colony's food: ${Math.floor(farm.food)} in all` : r.type === 'nursery' ? (farm.brood.length ? `${plural(farm.brood.length, 'egg, larva or pupa', 'eggs, larvae and pupae')}` : 'No brood right now') : r.type === 'midden' ? 'Where the dead are laid' : 'Where idle ants rest';
    $('infoMore').textContent = r.type === 'pantry' ? 'Rooms grow as food piles up.' : r.type === 'nursery' ? (farm.count('queen') ? 'The queen lives here.' : '') : '';
  }
}

/* ---------- labels over rooms and food ---------- */
const tags = new Map();
function updateLabels() {
  const box = $('labels'), want = new Set(), placed = [];
  if (labelsOn) {
    const zf = view.camera.position.z >= 0 ? DEPTH / 2 : -DEPTH / 2;
    const tagAt = (key, text, x, y, cls) => {
      const p = view.project(x, y, zf);
      if (!p) return;
      // skip a label that would sit on top of one already placed (rough size: 6px a letter)
      const w = text.length * (innerWidth < 720 ? 5.5 : 7) + 12, h = 16;
      if (placed.some(q => Math.abs(q.x - p.x) < (q.w + w) / 2 && Math.abs(q.y - p.y) < h)) return;
      placed.push({ x: p.x, y: p.y, w });
      want.add(key);
      let el = tags.get(key);
      if (!el) { el = document.createElement('div'); el.className = 'tag'; box.append(el); tags.set(key, el); }
      el.className = 'tag ' + cls;
      if (el.textContent !== text) el.textContent = text;
      el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    };
    const tutTarget = !tut.done && tut.step === 'dig' ? farm.sources.find(q => q.known && !q.reach && !q.gone && !q.surface) : null;
    for (const s of [...farm.sources].sort((p, q) => (q === tutTarget) - (p === tutTarget))) {
      if (s.gone || (!s.known && !DEMO)) continue;
      const y = s.surface ? farm.surf[s.x] - 3 : s.y - 3.5;
      tagAt('s' + s.id, s.infinite ? `${SOURCES[s.kind].name} ${Math.floor(s.stock)}/${s.cap}` : `${SOURCES[s.kind].name} ${Math.ceil(s.stock)}`, wx(s.x), wy(y), 'food' + (s === tutTarget ? ' hint-target' : ''));
    }
    // rooms: just the first pantry and the nursery, which is where the colony's life is
    const pantry = farm.homeRooms()[0], nursery = farm.room('nursery');
    if (pantry) tagAt('r' + pantry.id, `Pantry ${Math.floor(farm.food)}`, wx(pantry.cx), wy(pantry.cy - pantry.ry - .5), 'room');
    if (nursery?.dug) tagAt('r' + nursery.id, 'Nursery', wx(nursery.cx), wy(nursery.cy - nursery.ry - .5), 'room');
  }
  for (const [k, el] of tags) if (!want.has(k)) { el.remove(); tags.delete(k); }
}

/* ---------- the top bar and the menu ---------- */
$('foodIco').append(iconHTML('food', 3));
$('antIco').append(iconHTML('ant', 2));
function updateHud() {
  $('food').textContent = Math.floor(farm.food);
  const r = farm.rates(), net = r.income - r.used;
  const tr = $('trend');
  tr.textContent = farm.colony && farm.t > 20 ? `${net >= 0 ? '+' : '−'}${Math.abs(net).toFixed(1)}/min` : '';
  tr.className = net > .05 ? 'up' : net < -.05 ? 'down' : '';
  $('ants').textContent = farm.ants.length;
  const starving = farm.ants.filter(a => a.energy <= 0).length, hungry = farm.ants.filter(a => a.energy < HUNGRY).length;
  const hg = $('hungry');
  hg.textContent = starving ? `${starving} starving` : hungry > 2 ? `${hungry} hungry` : '';
  hg.className = starving ? 'down' : '';
  $('sub').textContent = `Farm #${farm.seed}` + (farm.colony ? ` · ${fmtTime(farm.t - farm.colony.founded)}` : '');
  for (const b of document.querySelectorAll('.speed button')) b.setAttribute('aria-pressed', +b.dataset.speed === speed);
  updateCards();
  if ($('panel').classList.contains('open')) updatePanel();
}
let casteKey = '';
function updatePanel() {
  const castes = $('castes'), key = ANT_ORDER.map(t => farm.count(t)).join();
  if (key !== casteKey) {
    casteKey = key;
    castes.textContent = '';
    for (const t of ANT_ORDER) {
      const n = farm.count(t), d = document.createElement('div');
      d.append(iconHTML(t, 2), document.createTextNode(`${n} ${ANTS[t].name.toLowerCase()}${n === 1 ? '' : 's'}`));
      castes.append(d);
    }
  }
  const r = farm.rates(), sup = farm.supply();
  $('foodStats').innerHTML = `<dt>In the pantry</dt><dd>${Math.floor(farm.food)}</dd><dt>Brought home</dt><dd>${r.income.toFixed(1)} a minute</dd><dt>Eaten</dt><dd>${r.eating.toFixed(1)} a minute</dd><dt>Never-ending food makes</dt><dd>${sup.perMin.toFixed(1)} a minute</dd>`;
  $('supplyNote').textContent = farm.colony ? `That keeps about ${sup.ants} ants fed for good. You have ${farm.ants.length}.` + (farm.ants.length > sup.ants + 2 ? ' Some will go hungry once the food pockets run out.' : '') : '';
  $('queenSetting').hidden = !farm.count('queen');
  $('laySwitch').setAttribute('aria-checked', farm.layOn);
  const st = farm.stats;
  $('lifeStats').innerHTML = `<dt>Food gathered</dt><dd>${st.gathered}</dd><dt>Cells dug</dt><dd>${st.dug}</dd><dt>Ants hatched</dt><dd>${st.born}</dd><dt>Ants bought</dt><dd>${st.bought + (farm.colony ? 1 : 0)}</dd><dt>Ants lost</dt><dd>${st.died}</dd><dt>Farm time</dt><dd>${fmtTime(farm.colony ? farm.t - farm.colony.founded : 0)}</dd>`;
  $('farmNote').textContent = `You're on farm #${farm.seed}. Starting it over puts back the same dirt, with no ants.`;
  $('labelSwitch').setAttribute('aria-checked', labelsOn);
}
function openPanel(open) {
  $('panel').classList.toggle('open', open);
  $('menuBtn').setAttribute('aria-expanded', open);
  if (open) updatePanel();
}
$('menuBtn').onclick = () => openPanel(!$('panel').classList.contains('open'));
$('closePanel').onclick = () => openPanel(false);
$('laySwitch').onclick = () => { farm.layOn = !farm.layOn; updatePanel(); save(); };
$('labelSwitch').onclick = () => { labelsOn = !labelsOn; updatePanel(); save(); };
$('replayTut').onclick = () => { tut = { done: false, step: farm.colony ? (farm.ants.length > 1 ? 'turn' : 'save') : 'place' }; tutT = 0; tutYaw = view.controls.getAzimuthalAngle(); lastGestureKey = '?'; openPanel(false); refreshHint(); save(); };
$('randSeed').onclick = () => { $('seedIn').value = randomSeed(); };
function confirmBox(title, text, yes, onYes) {
  $('confirmTitle').textContent = title; $('confirmText').textContent = text; $('confirmYes').textContent = yes;
  $('confirm').hidden = false;
  $('confirmYes').onclick = () => { $('confirm').hidden = true; onYes(); };
  $('confirmNo').onclick = () => { $('confirm').hidden = true; };
}
function startFarm(seed) {
  farm = new Farm(seed);
  view.setFarm(farm);
  select(null); setTool({ kind: 'ant', type: 'worker' });
  if (!tut.done) { tut.step = 'place'; tutT = 0; }
  lastGestureKey = '?';
  goHome(true);
  save(); updateHud(); refreshHint();
}
$('resetBtn').onclick = () => confirmBox('Start this farm over?', `Farm #${farm.seed} goes back to fresh dirt, and every ant and crumb goes with it.`, 'Start over', () => { openPanel(false); startFarm(farm.seed); toast(`Farm #${farm.seed}, fresh.`); });
$('newFarm').onclick = () => {
  const text = $('seedIn').value.trim(), seed = text ? seedOf(text) : randomSeed();
  confirmBox(`Start farm #${seed}?`, 'Your farm now, with all its ants, will be gone.', 'New farm', () => { openPanel(false); startFarm(seed); toast(`Welcome to farm #${seed}.`); });
};
for (const b of document.querySelectorAll('.speed button')) b.onclick = () => setSpeed(+b.dataset.speed);
function setSpeed(s) { if (s) lastSpeed = s; speed = s; updateHud(); save(); }
addEventListener('keydown', e => {
  if (e.target.closest('input, textarea')) return;
  if (e.key === 'Escape') { if (tool) setTool(null); else if (!$('confirm').hidden) $('confirm').hidden = true; else if ($('panel').classList.contains('open')) openPanel(false); else select(null); }
  else if (e.key === ' ') { e.preventDefault(); setSpeed(speed ? 0 : lastSpeed); }
  else if (e.key === '1') setSpeed(1); else if (e.key === '2') setSpeed(3); else if (e.key === '3') setSpeed(8);
  else if (e.key === 'h' || e.key === 'H') goHome();
});
$('homeBtn').onclick = () => goHome();

/* ---------- the camera ---------- */
let fly = null;
function goHome(instant = false) {
  const v = view.home(DEMO ? .5 : .16, DEMO ? .14 : .05);
  if (DEMO) {           // the demo (and the home page's picture of it) looks in close on the busy part of the colony
    const r = farm.homeRooms()[0], aim = v.target.clone().set(r ? wx(r.cx) * .4 : 0, r ? wy(r.cy) - 16 : 0, 0);
    v.pos.sub(v.target).multiplyScalar(.74).add(aim); v.target = aim;
  }
  follow = false;
  if (instant) { view.setView(v); fly = null; return; }
  fly = { t: 0, from: { target: view.controls.target.clone(), pos: view.camera.position.clone() }, to: v };
}
function flyTick(dt) {
  if (!fly) return;
  fly.t = Math.min(1, fly.t + dt / .7);
  const k = fly.t * fly.t * (3 - 2 * fly.t);
  view.controls.target.lerpVectors(fly.from.target, fly.to.target, k);
  view.camera.position.lerpVectors(fly.from.pos, fly.to.pos, k);
  if (fly.t >= 1) fly = null;
}
function followTick(dt) {
  if (!follow || sel?.kind !== 'ant') return;
  const st = view.antState.get(sel.ant.id);
  if (!st?.pos) return;
  const t = view.controls.target, k = 1 - Math.exp(-dt * 4);
  const dx = (st.pos[0] - t.x) * k, dy = (st.pos[1] - t.y) * k;
  t.x += dx; t.y += dy; view.camera.position.x += dx; view.camera.position.y += dy;
}
function layout() {
  const tray = $('tray').getBoundingClientRect();
  view.inset = { top: innerWidth <= 560 ? 104 : 64, bottom: innerHeight - tray.top + 8 + (innerHeight > 560 ? 52 : 0), side: 12 };
  view.resize();
}
addEventListener('resize', () => { layout(); });

/* ---------- saving as you go ---------- */
setInterval(save, 8000);
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
addEventListener('pagehide', save);

/* ---------- go ---------- */
if (!farm.colony) tool = { kind: 'ant', type: 'worker' };
buildCards();
layout();
goHome(true);
updateHud();
refreshHint();
if (!DEMO && farm.colony && saved) setTimeout(() => toast(`Welcome back to farm #${farm.seed}. ${plural(farm.ants.length, 'ant')}, ${Math.floor(farm.food)} food.`), 600);

let last = performance.now(), hudT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.1, (now - last) / 1000);
  last = now;
  if (speed && document.visibilityState === 'visible') {
    let t = dt * speed;
    while (t > 1e-6) { const s = Math.min(.1, t); farm.step(s); t -= s; }
  }
  for (const e of farm.events.splice(0)) onEvent(e);
  flyTick(dt); followTick(dt);
  view.frame(dt, sel?.kind === 'ant' ? sel.ant : null);
  hoverTick();
  updateLabels();
  tutTick(dt);
  coach.update(dt, !!down);
  hudT += dt;
  if (hudT > .2) { hudT = 0; updateHud(); updateInfo(); refreshHint(); }
}
requestAnimationFrame(frame);
window.toyboxReady?.();
// for poking at from the console
window.antfarm = { get farm() { return farm; }, view };
