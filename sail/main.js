// Sail: the page. The sea chart of the voyage home (chart.js), and a level: the crew's orders, the scroll they're put
// on for each leg, sailing it out step by step on the sea (scene.js) under the rules (rules.js), buoys and the harbour,
// wrecks and tries again, going back a buoy, the navigator's hints (solve.js), the crew's tips for what's new, and the
// sounds (sound.js). Progress is kept in this browser.
import { LEVELS, CHAPTERS } from './levels.js';
import { parse, initialState, sailLeg, ORDERS, ORDER_IDS, beastNext } from './rules.js';
import { navigator } from './solve.js';
import { Sea } from './scene.js';
import { ICONS, CREW, face } from './icons.js';
import { Sound } from './sound.js';
import { drawChart } from './chart.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo');
const AUTO = Q.has('auto');     // ?auto: the navigator plays, level after level
const KEY = 'sail.progress';
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- progress ---------- */
let saved = load();
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch {}
  return { v: 1, open: 0, done: [], sound: true, fast: false };
}
function save() { if (DEMO) return; try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} }

/* ---------- the orders each level's crew know ---------- */
// An order is known from the first level that gives the crew any of it; the crew aboard from the chapter they join.
const LEARNED = {};
LEVELS.forEach((d, n) => { for (const o of ORDER_IDS) if (d.crew[o] > 0 && LEARNED[o] == null) LEARNED[o] = n; });
const JOINS = { anchor: LEARNED.anchor, gunner: LEARNED.fire, hook: LEARNED.grapple };
const crewAboard = n => ['captain', 'bosun', ...Object.keys(JOINS).filter(w => n >= JOINS[w])];
const known = n => ORDER_IDS.filter(o => LEARNED[o] != null && LEARNED[o] <= n);

/* ---------- the sea ---------- */
const sea = new Sea($('c'));
window.sail = { sea, get G() { return G; } };   // for poking at from the console
const sound = new Sound();
sound.setEnabled(saved.sound !== false);
sea.sfx = name => sound.play(name);
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  try { sea.frame(dt); coach.update(dt); } catch (e) { if (!frame.failed) { frame.failed = true; console.error(e); } }
}

/* ---------- a level in play ---------- */
let G = null;   // { n, def, lv, nav, s, leg, pool, plan, hist, busy, hints }
function begin(n, fromChart = true) {
  const def = LEVELS[n], lv = parse(def);
  G = { n, def, lv, nav: navigator(lv), s: initialState(lv), leg: 0, pool: { ...lv.crew }, plan: [], hist: [], busy: false, hints: 0 };
  G.plan = new Array(lv.legs[0]).fill(null);
  saved.last = n; save();
  sea.load(lv, crewAboard(n), def.chapter);
  sea.show(G.s, 0);
  $('lvName').textContent = `${n + 1} · ${def.name}`;
  $('lvWhere').textContent = CHAPTERS[def.chapter].name;
  $('chart').hidden = true; $('chartCard').hidden = true;
  $('top').hidden = false; $('dock').hidden = false;
  layout();
  render();
  sound.sea(true);
  if (fromChart) intro();
}
// the orders still to hand: the pool less what's on the scroll
const spare = o => (G.pool[o] || 0) - G.plan.filter(p => p === o).length;
// What the crew will carry out: the whole scroll, or, once they've no orders left to give, the orders at its start
// (with no gaps) and nothing after.
function orders() {
  const n = G.plan.indexOf(null);
  if (n < 0) return G.plan.slice();
  const outOfOrders = ORDER_IDS.every(o => spare(o) <= 0);
  return outOfOrders && n > 0 && G.plan.slice(n).every(p => !p) ? G.plan.slice(0, n) : null;
}

function render() {
  if (!G) return;
  const { lv, leg, plan } = G;
  // which mark, and how far along
  const pips = $('pips'); pips.textContent = '';
  lv.marks.forEach((m, k) => { const p = document.createElement('span'); p.className = 'pip' + (k < leg ? ' done' : k === leg ? ' now' : ''); pips.append(p); });
  const last = leg === lv.marks.length - 1;
  const short = plan.includes(null) && orders();
  $('legWhat').textContent = `${last ? 'To the harbour' : `To buoy ${leg + 1}`} · ${plan.length} order${plan.length === 1 ? '' : 's'}${short ? ' · the crew have no more to give' : ''}`;
  // the scroll
  const slots = $('slots');
  slots.textContent = '';
  let anc = G.s.anc;
  plan.forEach((o, k) => {
    const li = document.createElement('li');
    li.className = 'slot' + (o ? ' filled' : ''); li.dataset.n = k + 1; li.dataset.k = k;
    if (o) {
      const label = o === 'anchor' ? (anc ? 'Weigh' : 'Drop') : null;
      if (o === 'anchor') anc ^= 1;
      li.append(card(o, { label }));
    }
    slots.append(li);
  });
  // the crew's orders
  const tray = $('tray');
  tray.textContent = '';
  for (const o of known(G.n)) {
    const n = spare(o);
    if (!(lv.crew[o] > 0)) continue;
    const c = card(o, { n });
    if (n <= 0) c.classList.add('out');
    if (G.def.fresh?.includes(o) && !G.touched) c.classList.add('new');
    tray.append(c);
  }
  fitCards();
  $('bClear').disabled = G.busy || plan.every(p => !p);
  $('bUndo').hidden = !G.hist.length;
  $('bUndo').disabled = G.busy;
  $('bHint').disabled = G.busy;
  $('goLbl').textContent = G.busy ? (saved.fast ? 'Faster ✓' : 'Faster') : 'Set sail!';
  $('bGo').disabled = G.busy ? false : !orders();
  forecast();
  requestAnimationFrame(layout);
}
function card(o, { n, label } = {}) {
  const c = document.createElement('div');
  c.className = 'card'; c.dataset.o = o;
  c.innerHTML = `${ICONS[o]}<span>${label || ORDERS[o].name}</span>` + (n != null ? `<b class="n">×${Math.max(0, n)}</b>` : '');
  c.setAttribute('role', 'button'); c.tabIndex = 0;
  c.setAttribute('aria-label', `${label || ORDERS[o].name}: ${ORDERS[o].short}${n != null ? `, ${Math.max(0, n)} left` : ''}`);
  c.title = `${ORDERS[o].name}: ${ORDERS[o].text}`;
  return c;
}
// Under the sea on a phone, the cards shrink (to 38px at the least) so the scroll and the crew each fit on one row
// if they can; small cards drop their names and keep their pictures.
function fitCards() {
  const dock = $('dock');
  if (document.body.classList.contains('side')) { dock.style.removeProperty('--card'); dock.classList.remove('tight'); return; }
  const W = dock.clientWidth || innerWidth - 20, nT = $('tray').children.length, nS = G.plan.length;
  const tray = (W - 12 - (nT - 1) * 9) / nT, scroll = (W - 36 - (nS - 1) * 7) / nS;   // less padding and gaps
  const c = Math.floor(Math.max(34, Math.min(innerWidth <= 420 ? 50 : 56, tray, scroll)));
  dock.style.setProperty('--card', c + 'px');
  dock.classList.toggle('tight', c < 46);
}
// numbered markers on the water: where each creature will be after each step of this leg's scroll
function forecast() {
  if (!G || G.busy || !G.lv.beasts.length) { sea.forecast(null); return; }
  const lv = G.lv, list = [];
  let bs = G.s.beasts.map(b => ({ ...b }));
  for (let k = 1; k <= G.plan.length; k++) {
    bs = bs.map((b, j) => beastNext(lv, j, b));
    bs.forEach((b, j) => list.push({ sq: lv.beasts[j].path[b.i], n: k, j }));
  }
  sea.forecast(list);
}

/* ---------- putting orders on the scroll ---------- */
function place(o, k) {
  if (G.busy || spare(o) <= 0) return false;
  if (k == null) k = G.plan.indexOf(null);
  if (k < 0 || k >= G.plan.length) { bump($('slots')); return false; }
  G.plan[k] = o; G.touched = true;
  sound.play('tap');
  render();
  coach.next();
  return true;
}
function unplace(k) {
  if (G.busy || !G.plan[k]) return;
  G.plan[k] = null;
  sound.play('untap');
  render();
}
function bump(el) { el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 260 }); }

// Dragging: from the crew to a square of the scroll, or from one square to another (they swap), or off the scroll to
// take it back. A tap puts an order in the first empty square, or takes one off the scroll.
let drag = null;
document.addEventListener('pointerdown', e => {
  const c = e.target.closest('.card');
  if (!c || !G || G.busy || c.closest('.sheet') || c.classList.contains('out')) return;
  e.preventDefault();
  const slot = c.closest('.slot');
  drag = { o: c.dataset.o, from: slot ? +slot.dataset.k : null, el: c, x0: e.clientX, y0: e.clientY, id: e.pointerId, moved: false };
});
document.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 7) return;
  if (!drag.moved) {
    drag.moved = true;
    const r = drag.el.getBoundingClientRect(), g = drag.el.cloneNode(true);
    g.classList.add('ghost'); g.querySelector('.n')?.remove();
    g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
    document.body.append(g);
    drag.ghost = g; drag.dx = e.clientX - r.left; drag.dy = e.clientY - r.top;
    drag.el.classList.add('lift');
    sound.play('pick');
    coach.hold();
  }
  drag.ghost.style.transform = `translate(${e.clientX - drag.dx}px, ${e.clientY - drag.dy}px) rotate(-4deg) scale(1.08)`;
  const over = slotAt(e.clientX, e.clientY);
  document.querySelectorAll('.slot.over').forEach(s => s !== over && s.classList.remove('over'));
  over?.classList.add('over');
});
const endDrag = e => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  document.querySelectorAll('.slot.over').forEach(s => s.classList.remove('over'));
  if (!d.moved) {
    if (e.type === 'pointerup') { if (d.from != null) unplace(d.from); else place(d.o); }
    return;
  }
  d.ghost.remove(); d.el.classList.remove('lift');
  const over = slotAt(e.clientX, e.clientY);
  if (over) {
    const k = +over.dataset.k;
    if (d.from != null) { const t = G.plan[k]; G.plan[k] = G.plan[d.from]; G.plan[d.from] = t; sound.play('tap'); render(); coach.next(); }
    else { if (G.plan[k]) G.plan[k] = null; place(d.o, k); }
  } else if (d.from != null) unplace(d.from);
  else render();
  coach.release();
};
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);
function slotAt(x, y) {
  let best = null, bd = 1e9;
  for (const s of document.querySelectorAll('#slots .slot')) {
    const r = s.getBoundingClientRect(), pad = 10;
    if (x < r.left - pad || x > r.right + pad || y < r.top - pad * 2 || y > r.bottom + pad * 2) continue;
    const dd = Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2);
    if (dd < bd) { bd = dd; best = s; }
  }
  return best;
}
// keys: the number of an order in the tray adds it, Backspace takes the last off, Enter sets sail
document.addEventListener('keydown', e => {
  if (!G || $('dock').hidden || !$('veil').hidden || e.metaKey || e.ctrlKey || e.altKey) return;
  const cards = [...document.querySelectorAll('#tray .card')];
  if (/^[1-9]$/.test(e.key) && cards[+e.key - 1]) { place(cards[+e.key - 1].dataset.o); e.preventDefault(); }
  else if (e.key === 'Backspace') { for (let k = G.plan.length - 1; k >= 0; k--) if (G.plan[k]) { unplace(k); break; } e.preventDefault(); }
  else if (e.key === 'Enter' && !$('bGo').disabled && document.activeElement?.tagName !== 'BUTTON') { go(); e.preventDefault(); }
  else if ((e.key === ' ' || e.key === 'Enter') && document.activeElement?.classList.contains('card')) {
    const c = document.activeElement, slot = c.closest('.slot');
    if (slot) unplace(+slot.dataset.k); else place(c.dataset.o);
    e.preventDefault();
  }
});

/* ---------- sailing ---------- */
$('bGo').onclick = () => go();
$('bClear').onclick = () => { if (!G.busy) { G.plan.fill(null); sound.play('untap'); render(); } };
$('bUndo').onclick = () => backABuoy();
$('bHint').onclick = () => hint();
async function go() {
  if (!G) return;
  if (G.busy) { saved.fast = !saved.fast; save(); sea.speed = saved.fast ? 2.2 : 1; render(); return; }
  const plan = orders();
  if (!plan) return;
  sound.unlock();
  toast(null); tip(null); coach.stop();
  const { lv } = G, leg = G.leg;
  G.busy = true; sea.speed = saved.fast ? 2.2 : 1;
  render();
  const res = sailLeg(lv, G.s, plan, lv.marks[leg]);
  const slots = () => [...document.querySelectorAll('#slots .slot')];
  for (let k = 0; k < res.steps.length; k++) {
    const st = res.steps[k], sl = slots();
    sl.forEach(s => s.classList.remove('now'));
    sl[k]?.classList.add('now');
    sound.play('order', st.order);
    await sea.play(st);
    sl[k]?.classList.remove('now');
    if (st.wreck) { sl[k]?.classList.add('bad'); break; }
    sl[k]?.classList.add('did');
    if (!st.touched) await sea.wait(.08);
  }
  if (res.reached) return reached(res);
  if (res.wreck) { await sea.wreck(res.wreck); return failed(res.wreck); }
  failed(null);
}
const WRECKS = {
  land: ['Aground!', 'She ran up on the shore.'], rock: ['Crunch!', 'She hit the rocks.'], post: ['Bonk!', 'She ran into a post.'],
  barrel: ['Crash!', 'She ran into the barrels.'], whirlpool: ['Down the plughole!', 'The whirlpool sucked her in.'], edge: ['Off the chart!', 'The crew won’t sail where the chart ends.'],
  beast: ['Ouch!', 'She bumped right into it.'], rammed: ['Whump!', 'It swam straight into her.'],
};
function failed(w) {
  const [title, why] = w ? WRECKS[w.why] || ['Wrecked!', ''] : ['Not there yet', `She didn’t reach ${G.leg === G.lv.marks.length - 1 ? 'the harbour' : `buoy ${G.leg + 1}`} by the end of the scroll.`];
  const who = w ? (w.why === 'beast' || w.why === 'rammed' ? ` ${G.lv.beasts[w.beast]?.kind === 'shark' ? 'The shark' : 'The whale'} is fine.` : '') : '';
  sound.play(w ? 'fail' : 'meh');
  toast({ kind: 'bad', title, text: why + who, buttons: [['Try again', () => retry(), true]] });
  $('live').textContent = `${title} ${why}`;
}
function retry() {
  toast(null);
  G.busy = false;
  sea.speed = 1;
  sea.show(G.s, G.leg);
  render();
}
async function reached(res) {
  const { lv } = G, leg = G.leg, final = leg === lv.marks.length - 1;
  // what was used is spent; anything left on the scroll goes back to the crew
  const before = { s: G.s, pool: { ...G.pool }, plan: G.plan.slice() };
  for (const o of G.plan.slice(0, res.used)) G.pool[o]--;
  G.hist.push(before);
  G.s = res.s;
  const left = G.plan.length - res.used;
  await sea.reached(leg, final);
  if (final) return finished();
  G.leg++;
  G.plan = new Array(lv.legs[G.leg]).fill(null);
  G.busy = false;
  sea.speed = 1;
  sea.setLeg(G.leg);
  render();
  const can = G.nav.canFinish(G.s, G.leg, G.pool);
  $('live').textContent = `Buoy ${leg + 1} rounded.`;
  if (!can) {
    sound.play('meh');
    toast({ kind: 'bad', title: 'The navigator frowns', text: 'From here, with the orders left, the harbour can’t be reached. Better go back a buoy and try another way.',
      buttons: [['Back a buoy', () => backABuoy(), true], ['Carry on', () => toast(null)]] });
  } else toast({ kind: 'good', title: `Buoy ${leg + 1}!`, text: left ? `We made it with ${left} order${left === 1 ? '' : 's'} to spare; they go back to the crew.` : 'On to the next.', timeout: 2600 });
}
function backABuoy() {
  if (!G || G.busy || !G.hist.length) return;
  const h = G.hist.pop();
  G.leg--; G.s = h.s; G.pool = h.pool; G.plan = h.plan;
  toast(null);
  sea.show(G.s, G.leg);
  render();
  sound.play('untap');
}
function restart() {
  if (!G || G.busy) return;
  toast(null);
  begin(G.n, false);
}
$('bRestart').onclick = () => restart();

async function finished() {
  const n = G.n;
  saved.done[n] = true;
  saved.open = Math.max(saved.open, Math.min(LEVELS.length - 1, n + 1));
  save();
  G.busy = false;
  const def = G.def, home = n === LEVELS.length - 1;
  await sleep(home ? 5200 : 300);
  sheet(`<p class="kicker">${CHAPTERS[def.chapter].name}</p><h2>${home ? 'Home at last!' : `Moored at ${def.harbour}`}</h2>
    <div class="stars">⚓</div>
    <p>${home ? 'The whole village is on the quay. The long way home is done.' : def.moored || 'The crew tie up and rest for the night.'}</p>
    ${G.hints ? `<p style="font-size:14px">The navigator helped ${G.hints} time${G.hints === 1 ? '' : 's'}.</p>` : ''}
    <div class="row">${home ? '' : '<button class="btn go" id="sNext" type="button">Onward</button>'}<button class="btn" id="sChart" type="button">The chart</button></div>`);
  $('sChart').onclick = () => through(() => { closeSheet(); showChart(); });
  $('sNext') && ($('sNext').onclick = () => through(() => { closeSheet(); showChart(true); }));
  sound.play('fanfare');
}

/* ---------- the navigator ---------- */
// Puts the next right order on the scroll, if the orders already there can still work; otherwise says which to take off.
function hint() {
  if (!G || G.busy) return;
  const placed = [];
  for (const o of G.plan) { if (!o) break; placed.push(o); }
  const gaps = G.plan.slice(placed.length).some(o => o);
  let rest = G.nav.finishLeg(G.s, G.leg, G.pool, placed);
  if (!rest || gaps) {
    // the orders on the scroll can't work: find how many from the front can stay
    let keep = placed.length;
    while (keep > 0 && !G.nav.finishLeg(G.s, G.leg, G.pool, placed.slice(0, keep))) keep--;
    if (!G.nav.finishLeg(G.s, G.leg, G.pool, [])) {
      toast({ kind: 'bad', title: 'The navigator frowns', text: 'There’s no way from here with the orders left. Go back a buoy, or start the voyage again.', buttons: [G.hist.length ? ['Back a buoy', () => backABuoy(), true] : ['Start again', () => restart(), true]] });
      return;
    }
    if (keep < placed.length || gaps) {
      for (let k = keep; k < G.plan.length; k++) G.plan[k] = null;
      G.hints++;
      render();
      toast({ title: 'The navigator says', text: keep ? `The first ${keep === 1 ? 'order is' : keep + ' orders are'} fine. I’ve taken the rest off.` : 'That won’t work. I’ve cleared the scroll: try again, or ask me again.', timeout: 3600 });
      return;
    }
    rest = G.nav.finishLeg(G.s, G.leg, G.pool, placed);
  }
  if (!rest.length) { toast({ title: 'The navigator says', text: 'The orders on the scroll will do it. Fill the rest with anything and set sail!', timeout: 3200 }); return; }
  const k = placed.length;
  G.plan[k] = rest[0];
  G.hints++;
  render();
  const el = document.querySelectorAll('#slots .slot')[k];
  el?.classList.add('hint');
  sound.play('hint');
  toast({ title: 'The navigator says', text: `Step ${k + 1}: ${rest[0] === 'anchor' ? 'the anchor' : ORDERS[rest[0]].name}.`, timeout: 2400 });
}

/* ---------- words on the screen ---------- */
let toastTimer = 0;
function toast(t) {
  const el = $('toast');
  clearTimeout(toastTimer);
  if (!t) { el.classList.add('away'); return; }
  el.className = 'toast' + (t.kind ? ' ' + t.kind : '');
  el.innerHTML = `<b>${t.title}</b>${t.text ? `<p>${t.text}</p>` : ''}${t.buttons ? `<div class="row">${t.buttons.map((b, i) => `<button class="btn small${b[2] ? ' go' : ''}" data-i="${i}" type="button">${b[0]}</button>`).join('')}</div>` : ''}`;
  el.querySelectorAll('button').forEach(b => b.onclick = () => t.buttons[+b.dataset.i][1]());
  placeFloat(el);
  if (t.timeout) toastTimer = setTimeout(() => el.classList.add('away'), t.timeout);
  if (t.buttons) el.querySelector('button')?.focus({ preventScroll: true });
}
// a crew member speaks: face, name and a line; a list of them is shown one after another
let tips = [], tipDone = null;
function tip(list, done) {
  const el = $('tip');
  if (!list) { el.classList.add('away'); tips = []; return; }
  tips = list.slice(); tipDone = done;
  nextTip();
}
function nextTip() {
  const el = $('tip');
  const t = tips.shift();
  if (!t) { el.classList.add('away'); const d = tipDone; tipDone = null; d?.(); return; }
  const c = CREW[t.who];
  el.innerHTML = `<div class="face">${face(t.who)}</div><div class="words"><strong class="who">${c.name}</strong>${t.text}<div class="row" style="margin-top:8px"><button class="btn small" type="button">${tips.length ? 'Next' : 'Got it'}</button></div></div>`;
  el.querySelector('button').onclick = () => { sound.play('tap'); nextTip(); };
  el.classList.remove('away');
  placeFloat(el);
  sound.play('talk');
}
// Messages go over the top of the sea; on wide screens a crew member's tip goes over the plan instead, where it
// covers nothing of the chart.
function placeFloat(el) {
  const r = sea.rect, isTip = el.classList.contains('tip');
  if (isTip && document.body.classList.contains('side')) {
    const d = $('dock').getBoundingClientRect(), s = document.querySelector('.scroll').getBoundingClientRect();
    el.style.width = el.style.maxWidth = d.width + 'px';
    el.style.left = d.left + 'px';
    el.style.top = Math.max(r.y, s.top - 16) + 'px';
    el.style.transform = 'translateY(-100%)';
    return;
  }
  el.style.width = isTip ? Math.min(460, r.w - 24) + 'px' : '';
  el.style.maxWidth = Math.min(460, r.w - 24) + 'px';
  el.style.left = (r.x + r.w / 2) + 'px';
  el.style.top = (r.y + 8) + 'px';
  el.style.transform = isTip ? 'translateX(-50%)' : '';
}
function sheet(html) {
  $('sheet').innerHTML = html;
  $('veil').hidden = false;
  $('sheet').querySelector('button')?.focus({ preventScroll: true });
}
function closeSheet() { $('veil').hidden = true; }

/* ---------- a level's start ---------- */
function intro() {
  const def = G.def, n = G.n, joins = Object.entries(JOINS).find(([, at]) => at === n)?.[0];
  const fresh = (def.fresh || []).filter(o => LEARNED[o] === n);
  const teaching = def.teach && !saved.done[n];
  const startTips = (withLog) => { if (teaching) tip([...(withLog && def.log ? [{ who: 'captain', text: def.log }] : []), ...def.teach], () => startCoach()); else startCoach(); };
  if (joins || fresh.length || n === 0) {
    const c = joins && CREW[joins];
    sheet(`<p class="kicker">${n + 1} · ${CHAPTERS[def.chapter].name}</p><h2>${def.name}</h2>
      ${def.log ? `<p>${def.log}</p>` : ''}
      ${joins ? `<div style="display:flex;align-items:center;gap:12px;justify-content:center;margin:10px 0"><div class="face" style="width:58px;height:58px;border-radius:50%;border:3px solid #2a1a10;overflow:hidden">${face(joins)}</div><p style="margin:0;text-align:left"><b style="color:#3b2412">${c.name} joins the crew!</b></p></div>` : ''}
      ${fresh.length ? `<dl>${fresh.map(o => `<dt>${card(o).outerHTML}</dt><dd><b>${ORDERS[o].name}.</b> ${ORDERS[o].text}</dd>`).join('')}</dl>` : ''}
      <div class="row"><button class="btn go" id="sGo" type="button">Set out</button></div>`);
    $('sGo').onclick = () => { closeSheet(); sound.unlock(); startTips(false); };
  } else if (teaching) startTips(true);
  else toast({ title: `${n + 1} · ${def.name}`, text: def.log || '', timeout: 3200 });
}

/* ---------- the coach's hand, for the very first scroll ---------- */
const coach = {
  el: $('hand'), g: null, t: 0, held: false,
  start(steps) { this.steps = steps; this.i = 0; this.show(); },
  show() { const s = this.steps?.[this.i]; this.g = s || null; this.t = 0; if (!s) this.el.style.opacity = 0; },
  next() { if (!this.steps) return; if (this.g?.done?.()) { this.i++; while (this.steps[this.i]?.done?.()) this.i++; this.show(); } },
  hold() { this.held = true; }, release() { this.held = false; },
  stop() { this.steps = null; this.g = null; this.el.style.opacity = 0; },
  update(dt) {
    const g = this.g, el = this.el;
    if (!g || this.held || !$('veil').hidden) { el.style.opacity = 0; return; }
    this.t += dt;
    const a = g.from(), b = g.to ? g.to() : null;
    if (!a) { el.style.opacity = 0; return; }
    let p = a, s = 1, o = 1;
    if (b) {
      const T = 2.2, k = this.t % T, m = k < .45 ? 0 : k < 1.45 ? (k - .45) : 1;
      const e = m * m * (3 - 2 * m);
      p = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
      o = k < .2 ? k / .2 : k > 1.8 ? Math.max(0, 1 - (k - 1.8) / .3) : 1;
      s = k < .45 ? 1.1 - k / .45 * .15 : .95;
    } else { const k = this.t % 1.2; s = k < .3 ? 1 : k < .45 ? .85 : 1; }
    el.style.opacity = o;
    el.style.transform = `translate(${p.x - 14}px, ${p.y - 4}px) scale(${s})`;
  },
};
const centerOf = sel => () => { const e = typeof sel === 'function' ? sel() : document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
function startCoach() {
  if (G.n !== 0 || G.leg !== 0 || saved.done[0]) return;
  const slot = k => () => document.querySelectorAll('#slots .slot')[k];
  const trayCard = o => () => document.querySelector(`#tray .card[data-o="${o}"]:not(.out)`);
  coach.start([
    { from: centerOf(trayCard('hoist')), to: centerOf(slot(0)), done: () => G.plan[0] === 'hoist' },
    { from: centerOf(trayCard('steady')), to: centerOf(slot(1)), done: () => G.plan[1] },
    { from: centerOf(trayCard('steady')), to: centerOf(slot(2)), done: () => G.plan[2] },
    { from: centerOf('#bGo'), done: () => G.busy },
  ]);
}

// A quick fade to the sea's blue and back, over the moment it takes to build a level (or draw the chart).
async function through(fn) {
  $('fade').classList.add('on');
  await sleep(320);
  fn();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  $('fade').classList.remove('on');
}

/* ---------- layout ---------- */
// Wide screens put the plan beside the sea, narrow ones under it; the sea frames the chart in what's left.
function layout() {
  const vw = innerWidth, vh = innerHeight;
  document.body.classList.toggle('side', vw >= 860 && vw / vh > 1.12);
  const side = document.body.classList.contains('side');
  const top = $('top').hidden ? 0 : $('top').getBoundingClientRect().bottom + 6;
  let rect;
  if ($('dock').hidden || !G) rect = { x: 0, y: 0, w: vw, h: vh };
  else if (side) { const d = $('dock').getBoundingClientRect(); rect = { x: 0, y: top, w: d.left - 10, h: vh - top }; }
  else { const d = $('dock').getBoundingClientRect(); rect = { x: 0, y: top, w: vw, h: Math.max(80, d.top - top - 4) }; }
  const k = JSON.stringify(rect);
  if (k !== layout.k) { layout.k = k; sea.resize(rect); }
}
addEventListener('resize', () => { layout.k = ''; layout(); });

/* ---------- the chart ---------- */
// the chart, with the boat at the last harbour reached; sailOn: sail it on to the next one first
function showChart(sailOn) {
  G && (G.busy = false);
  $('top').hidden = true; $('dock').hidden = true;
  toast(null); tip(null); coach.stop();
  $('chart').hidden = false;
  sound.sea(false);
  const to = sailOn ? saved.open : null;
  drawChart($('chartMap'), { levels: LEVELS, chapters: CHAPTERS, done: saved.done, open: saved.open, at: saved.last ?? 0, sailTo: to,
    pick: n => pickStop(n) });
  const at = sailOn ? saved.open : (saved.last ?? saved.open);
  pickStop(Math.min(at, saved.open), true);
}
function pickStop(n, quiet) {
  const def = LEVELS[n], el = $('chartCard');
  if (n > saved.open) return;
  el.hidden = false;
  el.innerHTML = `<div class="words"><small>${n + 1} · ${CHAPTERS[def.chapter].name}</small><b>${def.name}</b><span>${saved.done[n] ? 'Sailed ✓' : def.harbour ? `To ${def.harbour}` : ''}</span></div><button class="btn go" type="button">${saved.done[n] ? 'Again' : 'Set out'}</button>`;
  el.querySelector('button').onclick = () => { sound.unlock(); sound.play('tap'); through(() => begin(n)); };
  if (!quiet) sound.play('tap');
}
$('bMenu').onclick = () => { if (!G?.busy) through(() => showChart()); };
$('bHelp').onclick = () => help();
$('bSound').onclick = () => {
  saved.sound = !saved.sound; save();
  sound.setEnabled(saved.sound); sound.unlock();
  $('waves').style.display = saved.sound ? '' : 'none'; $('cross').style.display = saved.sound ? 'none' : '';
  $('bSound').setAttribute('aria-label', saved.sound ? 'Sound off' : 'Sound on');
};
function help() {
  const n = Math.max(saved.open, saved.last ?? 0);
  const orders = known(n);
  sheet(`<h2>How to sail</h2>
    <p>Get the boat home, one leg at a time. For each leg, put the crew’s orders on the scroll, one per step, then <b>Set sail!</b> Reach the buoy (or the harbour) before the scroll runs out.</p>
    <p>Each order can only be used once per voyage; the crew rest and have them all back at the next harbour. Orders not needed once a buoy is reached go back to the crew.</p>
    <dl>${orders.map(o => `<dt>${card(o).outerHTML}</dt><dd><b>${ORDERS[o].name}.</b> ${ORDERS[o].text}</dd>`).join('')}</dl>
    <p style="font-size:14px">Currents carry the boat a square a step; wind lanes blow her along only with her sail up; whirlpools swirl her round and drain into their eye. Creatures swim a square a step: the numbers on the water show where.</p>
    <div class="row"><button class="btn go" id="sOk" type="button">Aye</button></div>`);
  $('sOk').onclick = closeSheet;
}
$('veil').addEventListener('click', e => { if (e.target === $('veil') && $('sheet').querySelector('#sOk')) closeSheet(); });

/* ---------- the navigator at the helm (?auto and ?demo) ---------- */
async function autoplay(onlyOne) {
  for (;;) {
    if (!G) return;
    await sleep(600);
    tip(null); coach.stop();
    const rest = G.nav.finishLeg(G.s, G.leg, G.pool, []);
    if (!rest) { console.warn('the navigator is stuck on', G.def.name); return; }
    G.plan.fill(null);
    for (const o of rest) { place(o); await sleep(AUTO ? 260 : 180); }
    for (let k = 0; k < G.plan.length; k++) if (!G.plan[k]) { const o = ORDER_IDS.find(o => spare(o) > 0); if (o) G.plan[k] = o; }
    render();
    await sleep(350);
    const leg = G.leg, n = G.n;
    await go();
    if (!$('veil').hidden) {       // the level's done
      if (onlyOne || n >= LEVELS.length - 1) return;
      await sleep(1500); closeSheet(); begin(n + 1, false);
    } else if (G.leg === leg) { console.warn('the navigator’s plan failed on', G.def.name, G.leg); return; }
  }
}

/* ---------- start ---------- */
$('waves').style.display = saved.sound !== false ? '' : 'none'; $('cross').style.display = saved.sound !== false ? 'none' : '';
sea.speed = 1;
if (DEMO || AUTO) {
  const n = +(Q.get('level') || (DEMO ? 20 : 1)) - 1;
  begin(Math.max(0, Math.min(LEVELS.length - 1, n)), false);
  autoplay(DEMO);
} else if (Q.has('level')) begin(Math.max(0, Math.min(LEVELS.length - 1, +Q.get('level') - 1)));
else showChart();
requestAnimationFrame(frame);
window.toyboxReady?.();
