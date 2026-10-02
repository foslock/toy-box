// Rigged Racer: the page. The list of races to fix, a race in play (planning, the count down, racing, the pause at
// every lap with fresh stock, rewinding to a lap's start, the results), putting things on the road by dragging or
// tapping, setting off the track's traps, moving the camera, the dotted forecast of where everyone's headed, and the
// sheets: who's asking, the racers, how to play. Progress is kept in this browser.
import { LEVELS } from './levels.js';
import { TRACKS } from './tracks.js';
import { buildTrack, point, edgesAt } from './track.js';
import { newRace, step, copy, DT, cellAt, whyNot, place, unplace, arm, setGate, goalState, doStep } from './sim.js';
import { RACERS, PLACE, TRAPS, KART_ITEMS, traitInfo, CRATE_TABLE } from './data.js';
import { World } from './scene.js';
import { ICONS, CARD, face } from './icons.js';
import { Sound } from './sound.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), AUTO = Q.has('auto');
const KEY = 'rigged.progress';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ORD = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const SPEEDS = [1, 2, 4];

/* ---------- progress ---------- */
let saved = load();
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch {}
  return { v: 1, stars: {}, open: 0, sound: true, speed: 0, seen: {} };
}
function save() { if (DEMO || AUTO) return; try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} }

/* ---------- the world ---------- */
const tracks = {};
const trackOf = id => tracks[id] ||= buildTrack(TRACKS[id]);
const world = new World($('c'));
const sound = new Sound();
sound.setEnabled(saved.sound !== false);
window.rigged = {   // for poking at from the console: rigged.hold = true stops the clock, rigged.tick(secs) runs it by hand
  world, get G() { return G; }, step, copy,
  tick(secs) { const n = Math.round(secs / DT); for (let i = 0; i < n && G.mode === 'run'; i++) stepOnce(); world.sync(G.S, secs); },
  sound,
};

let G = null;   // the race in play
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  try {
    if (G && G.mode === 'run' && !window.rigged.hold) advance(dt);
    if (G) world.sync(G.S, dt);
    world.frame(dt);
    if (G) { tags(); traps(); status(); }
    const moving = G && G.mode === 'run' ? G.S.karts.reduce((a, k) => a + k.v, 0) / G.S.karts.length : 0;
    sound.engine(moving, clamp(1 - (world.cam.d - 12) / 60, 0, 1));
  } catch (e) { if (!frame.failed) { frame.failed = true; console.error(e); } }
}
function advance(dt) {
  G.acc += dt * SPEEDS[saved.speed || 0];
  let n = 0;
  while (G.acc >= DT && G.mode === 'run' && n < 20) { G.acc -= DT; n++; stepOnce(); }
  if (n >= 20) G.acc = 0;
}

// one tick of the race: the solution's timed steps first (in ?demo and ?auto), then the race, then what it says happened
function stepOnce() {
  while (G.timed?.length && G.S.t >= G.timed[0].t - 1e-9) doStep(G.S, G.T, G.timed.shift());
  step(G.S, G.T); events();
}

/* ---------- a race ---------- */
function begin(n, { intro = true } = {}) {
  const def = LEVELS[n], T = trackOf(def.track);
  if (world.T !== T) world.load(T);
  const S = newRace(T, def);
  G = { n, def, T, S, mode: 'plan', snaps: [{ lap: 1, S: copy(S) }], placed: new Set(), sel: null, acc: 0, dirty: true, lapsSeen: 1 };
  world.setRace(S);
  world.fit();
  lamps(0);
  saved.last = n; save();
  $('lvName').textContent = `${n + 1} · ${def.name}`;
  $('lvWhere').textContent = `${T.def.name} · ${def.laps} laps`;
  buildTraps();
  closeSheet(); toast(null); tip(null);
  render();
  layout();
  if (intro) introSheet();
}
function render() { tray(); goal(); board(); controls(); G.dirty = true; forecast(); }

// What the race says happened: the scene and the sounds show it, and the laps and the end are handled here.
function events() {
  const S = G.S;
  for (const e of S.ev) {
    world.event(e, S);
    sfx(e);
    if (e.type === 'lap') lapBreak(e.lap);
    else if (e.type === 'over') over();
    else if (e.type === 'finish') { board(); const k = S.karts[e.k]; $('live').textContent = `${RACERS[k.who].short} finishes ${ORD(e.place)}.`; }
    else if (e.type === 'item' || e.type === 'use') board();
    else if (e.type === 'trap') { tray(); goal(); }
  }
  S.ev.length = 0;
}
function sfx(e) {
  const M = { spin: 'spin', flat: 'flat', crash: 'crash', smash: 'crash', boom: 'boom', blast: 'boom', bomb: 'boom', pop: 'pop', boost: 'boost', jump: 'jump', item: 'item', crate: 'crate', chrome: 'chrome', clang: 'clang', shove: 'shove', spit: 'spit', drop: 'drop', finish: 'finish' };
  if (M[e.type]) sound.play(M[e.type]);
  else if (e.type === 'use') sound.play(e.item === 'rocket' || e.item === 'homing' ? 'rocket' : e.item === 'vulture' ? 'vulture' : e.item === 'nitro' ? 'boost' : e.item === 'chrome' ? 'chrome' : 'pop');
  else if (e.type === 'trap') sound.play(e.kind);
}
function lapBreak(lap) {
  G.mode = 'plan'; G.acc = 0;
  G.S.ev.length = 0;
  G.snaps.push({ lap, S: copy(G.S) });
  G.placed.clear(); G.lapsSeen = Math.max(G.lapsSeen, lap);
  const got = Object.entries(G.def.stock?.[lap - 1] || {}).filter(([, v]) => v > 0);
  banner(lap === G.def.laps ? 'Final lap!' : `Lap ${lap}`, got.length ? 'New stock: ' + got.map(([k, v]) => `${v} × ${(PLACE[k] || TRAPS[k]).name.toLowerCase()}`).join(', ') : 'Nothing new this lap', true);
  sound.play('lap');
  render();
  if (G.auto) setTimeout(() => G?.auto && autoLap(lap), 500);
}
async function over() {
  G.mode = 'done';
  render();
  await sleep(G.auto ? 300 : 1300);
  if (G?.mode === 'done') results();
}

// Race! (from the start, with the count down), carry on (after a pause), or pause.
async function go() {
  if (!G) return;
  sound.unlock();
  if (G.mode === 'run') { pauseRace(); return; }
  if (G.mode === 'done') { results(); return; }
  if (G.mode !== 'plan') return;
  setSel(null); tip(null);
  G.placed.clear();
  banner(null);
  if (G.S.t === 0) {
    G.mode = 'count'; render();
    for (let k = 3; k > 0; k--) { lamps(4 - k); banner(String(k)); sound.play('beep'); await sleep(G.auto ? 120 : 650); if (G?.mode !== 'count') return; }
    lamps(5); banner('GO!'); sound.play('beep', 1);
  }
  G.mode = 'run'; G.acc = 0;
  render();
}
function pauseRace() {
  if (G?.mode !== 'run') return;
  G.mode = 'plan'; G.placed.clear();
  sound.play('tap');
  render();
}
// Back to the start of this lap (or, if that's where it already is, the lap before), with the stock as it was.
function rewind() {
  if (!G || G.mode === 'count') return;
  let i = G.snaps.length - 1;
  const at = G.snaps[i];
  if (G.S.t <= at.S.t + 1e-6 && !G.placed.size && G.mode !== 'done' && i > 0) i--;
  restore(i);
}
function restore(i) {
  const snap = G.snaps[i];
  G.snaps = G.snaps.slice(0, i + 1);
  G.S = copy(snap.S); G.mode = 'plan'; G.placed.clear(); G.acc = 0;
  world.setRace(G.S);
  lamps(G.S.t > 0 ? 5 : 0);
  closeSheet(); toast(null); banner(null);
  sound.play('unplace');
  toast({ title: snap.lap === 1 && snap.S.t === 0 ? 'Back to the start' : `Back to the start of lap ${snap.lap}`, timeout: 1600 });
  render();
}
function lamps(n) {
  (world.lamps || []).forEach((l, k) => { const on = n >= 5 ? '#3aff6a' : k < n ? '#ff3a2a' : null; l.material.color.set(on || '#3a2222'); l.material.emissive.set(on || '#000000'); l.material.emissiveIntensity = on ? 1.2 : 0; });
}

/* ---------- putting things down ---------- */
function setSel(kind) {
  G && (G.sel = kind);
  document.querySelectorAll('#tray .card').forEach(c => c.classList.toggle('sel', c.dataset.k === kind));
  $('c').classList.toggle('placing', !!kind);
  world.showGrid(!!kind); world.showNear(G?.S, !!kind);
  if (!kind) { world.showCell(null); $('why').hidden = true; }
}
function placeAt(kind, cell, x, y) {
  if (!G || G.mode === 'done' || G.mode === 'count') return false;
  if (G.mode === 'run') pauseRace();
  const why = whyNot(G.S, G.T, kind, cell);
  if (why) { nope(why === 'none left' ? `No ${PLACE[kind].name.toLowerCase()} left` : why[0].toUpperCase() + why.slice(1), x, y); return false; }
  const o = place(G.S, G.T, kind, cell);
  G.placed.add(o.id);
  G.S.ev.length = 0;
  sound.unlock(); sound.play('place');
  if (!(G.S.stock[kind] > 0)) setSel(null);
  render();
  world.showNear(G.S, !!G.sel);
  nextTip('placed');
  return true;
}
function nope(text, x, y) {
  sound.play('nope');
  const w = $('why');
  w.textContent = text; w.hidden = false;
  if (x != null) w.style.transform = `translate(${x}px, ${y}px) translate(-50%, -130%)`;
  clearTimeout(nope.t); nope.t = setTimeout(() => { w.hidden = true; }, 1400);
}
// the road under a point on the ground: path, how far along, how far across; null off the road
function locate(x, z) {
  let best = null;
  for (const p of G.T.paths) {
    let bi = 0, bd = 1e9;
    for (let i = 0; i < p.count; i++) { const dx = p.x[i] - x, dz = p.z[i] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } }
    const q = point(p, bi * p.step, 0), along = (x - q.x) * q.tx + (z - q.z) * q.tz, across = -(x - q.x) * q.tz + (z - q.z) * q.tx;
    let s = bi * p.step + along;
    if (p.closed) s = ((s % p.L) + p.L) % p.L; else if (s < 0 || s > p.L) continue;
    const [lo, hi] = edgesAt(p, s), inside = across > lo - .15 && across < hi + .15;
    if (!inside) continue;
    const score = Math.abs(across - (lo + hi) / 2) / ((hi - lo) / 2 + .01) + (p.id ? .3 : 0);
    if (!best || score < best.score) best = { path: p.id, s, x: across, score };
  }
  return best;
}
function cellUnder(cx, cy) {
  const g = world.ground(cx, cy); if (!g) return null;
  const loc = locate(g.x, g.z); if (!loc) return null;
  return cellAt(G.T, loc.path, loc.s, loc.x);
}
function thingAt(cell) {
  if (!cell) return null;
  const p = G.T.paths[cell.path];
  return G.S.objs.find(o => o.path === cell.path && o.by === 'you' && Math.abs(((o.s - cell.s + p.L * 1.5) % p.L) - p.L / 2) < p.cellLen * .6 && Math.abs(o.x - cell.x) < .5);
}

// The canvas: drag to look around, pinch or scroll to zoom, tap a kart to follow it, tap the road to put down
// what's chosen, tap what you've just put down to pick it back up.
const cv = $('c'), ptrs = new Map();
let gesture = null;
cv.addEventListener('pointerdown', e => {
  sound.unlock();
  cv.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) gesture = { kind: 'tap', x0: e.clientX, y0: e.clientY };
  else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gesture = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; }
});
cv.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId);
  if (!p) { if (G?.sel && e.pointerType === 'mouse') hoverCell(e.clientX, e.clientY); return; }
  const px = p.x, py = p.y; p.x = e.clientX; p.y = e.clientY;
  if (!gesture) return;
  if (gesture.kind === 'tap' && Math.hypot(e.clientX - gesture.x0, e.clientY - gesture.y0) > 7) { gesture.kind = 'pan'; world.follow = -1; cv.classList.add('grabbing'); }
  if (gesture.kind === 'pan') {
    const a = world.ground(px, py), b = world.ground(e.clientX, e.clientY);
    if (a && b) world.panBy(a.x - b.x, a.z - b.z);
  } else if (gesture.kind === 'pinch' && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const g0 = world.ground(gesture.m.x, gesture.m.y), g1 = world.ground(m.x, m.y);
    if (g0 && g1) world.panBy(g0.x - g1.x, g0.z - g1.z);
    if (d > 10 && gesture.d > 10) world.zoomBy(gesture.d / d, m.x, m.y);
    gesture.d = d; gesture.m = m; world.follow = -1;
  }
});
const endPtr = e => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (gesture?.kind === 'tap' && e.type === 'pointerup' && ptrs.size === 0) tapAt(e.clientX, e.clientY);
  if (ptrs.size === 0) { gesture = null; cv.classList.remove('grabbing'); }
  else if (gesture?.kind === 'pinch') gesture = { kind: 'pan-done' };
};
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('wheel', e => { e.preventDefault(); world.follow = -1; world.zoomBy(Math.exp(e.deltaY * (e.ctrlKey ? .01 : .0016)), e.clientX, e.clientY); }, { passive: false });
cv.addEventListener('pointerleave', () => { if (G?.sel) { world.showCell(null); } });
function hoverCell(x, y) {
  const cell = cellUnder(x, y);
  world.showCell(cell, cell && !whyNot(G.S, G.T, G.sel, cell));
}
function tapAt(x, y) {
  if (!G) return;
  // a kart?
  let best = -1, bd = 26;
  G.S.karts.forEach((k, i) => {
    const m = world.karts[i]?.model; if (!m || !m.visible) return;
    const p = world.project(m.position.x, .35 + m.userData.body.position.y, m.position.z), d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = i; }
  });
  const cell = cellUnder(x, y);
  // something just put down: pick it back up
  const o = thingAt(cell);
  if (o && G.mode === 'plan') {
    if (G.placed.has(o.id)) { unplace(G.S, o.id); G.placed.delete(o.id); sound.play('unplace'); render(); world.showNear(G.S, !!G.sel); return; }
    if (!G.sel) { toast({ title: 'Locked in', text: 'Once the race moves on, what’s on the road stays there. Rewind to take it back.', timeout: 2600 }); return; }
  }
  if (G.sel && cell && best < 0) { placeAt(G.sel, cell, x, y); return; }
  if (G.sel && !cell) { setSel(null); return; }
  if (best >= 0) followKart(best);
}
// the camera follows a kart (closer in, if it's far out) until the view's dragged
function followKart(i) {
  world.follow = i;
  if (world.cam.d > 26) world.glide = { x: world.cam.x, z: world.cam.z, d: 22 };
  sound.play('tap');
  toast({ title: `Following ${RACERS[G.S.karts[i].who].short}`, text: 'Drag to look around. F shows the whole track.', timeout: 1800 });
}

// Cards: drag one onto the road, or tap it to choose it and then tap the road. A trap's card arms the trap.
let drag = null;
$('tray').addEventListener('pointerdown', e => {
  const c = e.target.closest('.card');
  if (!c || !G || c.classList.contains('out')) return;
  e.preventDefault();
  sound.unlock();
  drag = { el: c, k: c.dataset.k, trap: c.dataset.trap, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false };
  try { c.setPointerCapture(e.pointerId); } catch {}
});
document.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id || drag.trap) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
  if (!drag.moved) {
    drag.moved = true;
    if (G.mode === 'run') pauseRace();
    const r = drag.el.getBoundingClientRect(), g = drag.el.cloneNode(true);
    g.className = 'card ghost'; g.querySelector('.n')?.remove();
    g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
    document.body.append(g);
    drag.ghost = g; drag.w = r.width; drag.h = r.height;
    world.showGrid(true); world.showNear(G.S, true);
    sound.play('pick');
  }
  // the card hangs above the finger, so the square it's going in can be seen
  const gy = e.clientY - drag.h - 26;
  drag.ghost.style.transform = `translate(${e.clientX - drag.w / 2}px, ${gy}px) rotate(-5deg) scale(1.05)`;
  const over = document.elementFromPoint(e.clientX, e.clientY) === cv;
  const cell = over ? cellUnder(e.clientX, e.clientY) : null, why = cell ? whyNot(G.S, G.T, drag.k, cell) : '';
  world.showCell(cell, cell && !why);
  drag.cell = cell; drag.why = why;
  const w = $('why');
  if (cell && why) { w.textContent = why[0].toUpperCase() + why.slice(1); w.hidden = false; w.style.transform = `translate(${e.clientX}px, ${gy}px) translate(-50%, -110%)`; }
  else w.hidden = true;
});
const endDrag = e => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  $('why').hidden = true;
  if (!d.moved) {
    if (e.type !== 'pointerup') return;
    if (d.trap) { armTrap(d.k, true); return; }
    sound.play('tap');
    setSel(G.sel === d.k ? null : d.k);
    if (G.sel) nextTip('chose');
    return;
  }
  d.ghost.remove();
  world.showCell(null);
  if (d.cell && !d.why) placeAt(d.k, d.cell);
  else if (d.cell) nope(d.why[0].toUpperCase() + d.why.slice(1), e.clientX, e.clientY - 40);
  world.showGrid(!!G.sel); world.showNear(G.S, !!G.sel);
};
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

/* ---------- the track's traps ---------- */
function buildTraps() {
  const box = $('traps'); box.textContent = '';
  G.trapEls = [];
  const kinds = new Set(G.def.stock.flatMap(s => Object.keys(s)));
  for (const f of G.S.fx) {
    if (!kinds.has(f.kind)) continue;
    const el = document.createElement('div');
    el.className = 'trap'; el.style.setProperty('--c', CARD[f.kind]);
    el.innerHTML = `<button type="button" aria-label="Arm the ${TRAPS[f.kind].name.toLowerCase()}">${ICONS[f.kind]}</button><span></span>`;
    el.querySelector('button').onclick = () => { sound.unlock(); armTrap(f.id); };
    box.append(el); G.trapEls.push({ el, id: f.id, kind: f.kind });
  }
  for (const b of G.T.paths.slice(1)) {
    if (!b.gate || G.def.lockGates) continue;
    const el = document.createElement('div');
    el.className = 'trap'; el.style.setProperty('--c', CARD.gate);
    el.innerHTML = `<button type="button" aria-label="Open or shut the shortcut">${ICONS.gate}</button><span></span>`;
    el.querySelector('button').onclick = () => { sound.unlock(); toggleGate(b.gate); };
    box.append(el); G.trapEls.push({ el, id: b.gate, gate: true });
  }
}
function armTrap(idOrKind, fromCard) {
  if (!G || G.mode === 'done' || G.mode === 'count') return;
  const f = G.S.fx.find(f => f.id === idOrKind) || G.S.fx.find(f => f.kind === idOrKind);
  if (!f) return;
  if (fromCard) { const a = world.fixtureAnchor(f.id); if (a) { world.glide = { x: a.x + Math.sin(world.cam.yaw) * 2, z: a.z + Math.cos(world.cam.yaw) * 2, d: Math.min(world.cam.d, 34) }; world.follow = -1; } }
  if (f.armed) { arm(G.S, f.id, false); sound.play('disarm'); }
  else if (!(G.S.stock[f.kind] > 0)) { nope(`No ${TRAPS[f.kind].name.toLowerCase()} left this lap`); return; }
  else { arm(G.S, f.id, true); sound.play('arm'); nextTip('armed'); }
  render();
}
function toggleGate(id) {
  if (!G || G.mode === 'done') return;
  setGate(G.S, id, G.S.gates[id] === false);
  sound.play('gate');
  toast({ title: G.S.gates[id] ? 'Shortcut open' : 'Shortcut shut', timeout: 1400 });
  render();
}
function traps() {
  for (const t of G.trapEls || []) {
    const a = world.fixtureAnchor(t.id); if (!a) continue;
    const p = world.project(a.x, a.y, a.z);
    t.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
    if (t.gate) {
      const open = G.S.gates[t.id] !== false;
      t.el.classList.toggle('shut', !open);
      const s = open ? 'Open' : 'Shut'; if (t.el.lastChild.textContent !== s) t.el.lastChild.textContent = s;
    } else {
      const f = G.S.fx.find(f => f.id === t.id), n = G.S.stock[t.kind] || 0;
      t.el.classList.toggle('armed', f.armed); t.el.classList.toggle('off', !f.armed && n <= 0);
      const s = f.armed ? 'Armed' : n > 0 ? `×${n}` : 'Used'; if (t.el.lastChild.textContent !== s) t.el.lastChild.textContent = s;
    }
  }
}

/* ---------- what's on screen ---------- */
function tray() {
  const el = $('tray'); el.textContent = '';
  const all = new Set(G.def.stock.flatMap(s => Object.keys(s)));
  for (const k of [...Object.keys(PLACE), ...Object.keys(TRAPS)]) {
    if (!all.has(k)) continue;
    const n = G.S.stock[k] || 0, trap = !!TRAPS[k], f = trap && G.S.fx.find(f => f.kind === k);
    const c = document.createElement('div');
    c.className = 'card' + (trap ? ' trapc' : '') + (n <= 0 && !(f && f.armed) ? ' out' : '') + (G.sel === k ? ' sel' : '') + (f?.armed ? ' armed' : '') + (G.def.fresh?.includes(k) && !G.touched ? ' new' : '');
    c.dataset.k = k; if (trap) c.dataset.trap = '1';
    c.style.setProperty('--c', CARD[k]);
    c.innerHTML = `${ICONS[k]}<span>${f?.armed ? 'Armed' : (PLACE[k] || TRAPS[k]).short}</span><b class="n">×${n}</b>`;
    c.title = `${(PLACE[k] || TRAPS[k]).name}: ${(PLACE[k] || TRAPS[k]).text}`;
    c.setAttribute('role', 'button'); c.tabIndex = 0;
    c.setAttribute('aria-label', `${(PLACE[k] || TRAPS[k]).name}, ${n} left. ${(PLACE[k] || TRAPS[k]).text}`);
    el.append(c);
  }
  if (!el.children.length) el.innerHTML = '<p style="margin:0;align-self:center;color:#8f6a48;font-size:14px">Nothing to put down this lap.</p>';
}
function goal() {
  const el = $('goal'), st = goalState(G.S, G.def), started = G.S.t > 0;
  el.innerHTML = G.def.goal.map((g, i) => `<button class="chip ${started || G.mode === 'done' ? (st[i] ? 'yes' : 'no') : ''}" type="button" data-who="${g.who}"><span class="f">${face(g.who, RACERS[g.who].color)}</span>${esc(goalText(g))}<span class="ok"></span></button>`).join('');
  el.querySelectorAll('.chip').forEach(c => c.onclick = () => racerSheet(c.dataset.who));
}
function goalText(g, long) {
  const nm = w => RACERS[w].short;
  if (g.place) return `${nm(g.who)} ${g.place === -1 || g.place === G.S.n ? 'last' : ORD(g.place)}`;
  if (g.top) return g.top === 1 ? `${nm(g.who)} wins` : long ? `${nm(g.who)} in the top ${g.top}` : `${nm(g.who)} top ${g.top}`;
  if (g.bottom) return g.bottom === 1 ? `${nm(g.who)} last` : `${nm(g.who)} in the last ${g.bottom}`;
  if (g.ahead) return `${nm(g.who)} beats ${nm(g.ahead)}`;
  if (g.behind) return `${nm(g.who)} behind ${nm(g.behind)}`;
  return '';
}
function board() {
  const el = $('board'), S = G.S, goalWho = new Set(G.def.goal.flatMap(g => [g.who, g.ahead, g.behind].filter(Boolean)));
  const key = S.order.map(i => S.karts[i].who + (S.karts[i].item || '') + (S.karts[i].fin ? 'f' : '')).join();
  if (key === board.key && el.children.length) return;
  board.key = key;
  el.innerHTML = S.order.map((i, r) => {
    const k = S.karts[i], R = RACERS[k.who];
    return `<li class="${goalWho.has(k.who) ? 'goal-who' : ''}${k.fin ? ' done' : ''}" data-who="${k.who}" title="${esc(R.name)}"><span class="n">${r + 1}</span><span class="f">${face(k.who, R.color)}</span><span class="nm">${esc(R.short)}</span>${k.item ? `<span class="it" style="--c:${CARD[k.item]}" title="${esc(KART_ITEMS[k.item].name)}">${ICONS[k.item]}</span>` : ''}</li>`;
  }).join('');
  el.querySelectorAll('li').forEach(li => li.onclick = () => racerSheet(li.dataset.who));
}
function controls() {
  const m = G.mode;
  $('goIcon').innerHTML = m === 'run' ? ICONS.pause : m === 'done' ? ICONS.flag : ICONS.play;
  $('goLbl').textContent = m === 'run' ? 'Pause' : m === 'done' ? 'Results' : m === 'count' ? '…' : G.S.t === 0 ? 'Race!' : 'Go';
  $('bGo').disabled = m === 'count';
  $('bGo').classList.toggle('ready', m === 'plan');
  $('bRewind').disabled = m === 'count' || (G.snaps.length < 2 && G.S.t === 0 && !G.placed.size);
  $('bSpeed').textContent = SPEEDS[saved.speed || 0] + '×';
}
function status() {
  const S = G.S, lead = S.karts[S.order[0]], lap = clamp(Math.max(1, lead.lap), 1, S.laps);
  const t = `Lap ${lap}/${S.laps}`;
  if ($('lap').textContent !== t) $('lap').textContent = t;
  const what = G.mode === 'run' ? 'Racing' : G.mode === 'count' ? 'Get ready…' : G.mode === 'done' ? 'Finished' : S.t === 0 ? 'Rig the road, then race' : 'Paused · rig away';
  if ($('what').textContent !== what) $('what').textContent = what;
  $('clock').textContent = S.t.toFixed(1) + 's';
  if (G.mode === 'run' && (S.tick % 15) === 0) { board(); goal(); }
}
// the badge over each kart: its place, and what it's carrying
function tags() {
  const box = $('tags'), S = G.S;
  if (box.children.length !== S.karts.length) {
    box.textContent = '';
    const goalWho = new Set(G.def.goal.flatMap(g => [g.who, g.ahead, g.behind].filter(Boolean)));
    for (const k of S.karts) { const d = document.createElement('div'); d.className = 'tag' + (goalWho.has(k.who) ? ' goal-who' : ''); d.style.setProperty('--c', RACERS[k.who].color); d.innerHTML = '<b></b><i hidden></i>'; box.append(d); }
  }
  S.karts.forEach((k, i) => {
    const d = box.children[i], m = world.karts[i]?.model;
    if (!m || !m.visible) { d.style.display = 'none'; return; }
    const p = world.project(m.position.x, .95 + m.userData.body.position.y, m.position.z);
    d.style.display = '';
    d.style.transform = `translate(${p.x | 0}px, ${p.y | 0}px) translate(-50%, -100%)`;
    const r = String(k.fin ? k.place : k.rank);
    if (d.firstChild.textContent !== r) d.firstChild.textContent = r;
    const it = d.lastChild;
    if (it.dataset.k !== (k.item || '')) { it.dataset.k = k.item || ''; it.hidden = !k.item; if (k.item) { it.innerHTML = ICONS[k.item]; it.style.setProperty('--ic', CARD[k.item]); } }
  });
}
// the dotted lines: where everyone will be over the next four seconds if nothing else is done
function forecast() {
  if (!G || G.mode !== 'plan' || G.auto) { world.showTrails(null); return; }
  if (!G.dirty) return;
  G.dirty = false;
  const C = copy(G.S), pts = C.karts.map(() => []), N = Math.round(4 / DT);
  C.ev = [];
  for (let i = 1; i <= N && !C.over; i++) {
    step(C, G.T); C.ev.length = 0;
    if (i % 5) continue;
    C.karts.forEach((k, j) => { if (k.gone > 0 || k.fin) return; const q = point(G.T.paths[k.path], k.s, k.x); pts[j].push([q.x, q.z, 1 - i / N]); });
  }
  world.showTrails(C.karts.map((k, j) => ({ color: RACERS[k.who].color, pts: pts[j] })));
}

/* ---------- words ---------- */
let toastT = 0;
function toast(t) {
  const el = $('toast');
  clearTimeout(toastT);
  if (!t) { el.classList.add('away'); return; }
  el.className = 'toast' + (t.kind ? ' ' + t.kind : '');
  el.innerHTML = `<b>${t.title}</b>${t.text ? `<p>${t.text}</p>` : ''}${t.buttons ? `<div class="row">${t.buttons.map((b, i) => `<button class="btn small${b[2] ? ' go' : ''}" data-i="${i}" type="button">${b[0]}</button>`).join('')}</div>` : ''}`;
  el.querySelectorAll('button').forEach(b => b.onclick = () => t.buttons[+b.dataset.i][1]());
  el.style.top = (topBottom() + 6) + 'px';
  if (t.timeout) toastT = setTimeout(() => el.classList.add('away'), t.timeout);
}
let bannerT = 0;
function banner(big, small = '', stay = false) {
  const el = $('banner');
  clearTimeout(bannerT);
  if (!big) { el.className = 'banner'; return; }
  el.innerHTML = `${esc(big)}${small ? `<small>${esc(small)}</small>` : ''}`;
  el.className = 'banner'; void el.offsetWidth;
  el.className = 'banner ' + (stay ? 'stay' : 'show');
  if (stay) bannerT = setTimeout(() => { el.className = 'banner'; }, 2600);
}
// a word from whoever's asking, a few at a time
let tips = [], tipDone = null;
function tip(list, done) {
  const el = $('tip');
  if (!list) { el.classList.add('away'); tips = []; return; }
  tips = list.slice(); tipDone = done;
  showTip();
}
function showTip() {
  const el = $('tip'), t = tips.shift();
  if (!t) { el.classList.add('away'); const d = tipDone; tipDone = null; d?.(); return; }
  const who = t.who || G.def.from || 'pip';
  el.innerHTML = `<span class="f">${face(who, RACERS[who].color)}</span><div class="words"><span class="who">${esc(RACERS[who].name)}</span>${t.text}${t.wait ? '' : `<div class="row"><button class="btn small" type="button">${tips.length ? 'Next' : 'Got it'}</button></div>`}</div>`;
  el.querySelector('button')?.addEventListener('click', () => { sound.play('tap'); showTip(); });
  el.dataset.wait = t.wait || '';
  el.classList.remove('away');
  placeTip();
  sound.play('talk');
}
// near the top, under the goal: the karts start along the bottom of the screen, so it covers none of them
function placeTip() {
  const el = $('tip'), wide = document.body.classList.contains('wide');
  el.style.top = ((wide ? $('goal').getBoundingClientRect().bottom : topBottom()) + 10) + 'px';
  el.style.bottom = 'auto';
}
function nextTip(what) { const el = $('tip'); if (el.dataset.wait && el.dataset.wait === what && !el.classList.contains('away')) showTip(); }

function sheet(html) { $('sheet').innerHTML = html; $('veil').hidden = false; $('sheet').scrollTop = 0; ($('sheet').querySelector('.btn.go') || $('sheet').querySelector('button'))?.focus({ preventScroll: true }); }
function closeSheet() { $('veil').hidden = true; }
$('veil').addEventListener('pointerdown', e => { if (e.target === $('veil') && $('sheet').dataset.soft) closeSheet(); });

function lineup(list) {
  return `<div class="lineup">${list.map(w => `<button type="button" data-who="${w}"><span class="f">${face(w, RACERS[w].color)}</span><b>${esc(RACERS[w].short)}</b><span class="tr">${RACERS[w].traits.map(t => `<em>${esc(traitInfo(t).name)}</em>`).join('')}</span></button>`).join('')}</div>`;
}
function wireLineup(back) { $('sheet').querySelectorAll('.lineup button').forEach(b => b.onclick = () => racerSheet(b.dataset.who, back)); }

function introSheet() {
  const def = G.def, from = def.from || 'pip', n = G.n;
  const racers = G.S.karts.map(k => k.who);
  const fresh = (def.fresh || []).filter(k => PLACE[k] || TRAPS[k]);
  $('sheet').dataset.soft = '';
  sheet(`<p class="kicker">Race ${n + 1} · ${esc(G.T.def.name)} · ${def.laps} laps</p><h2>${esc(def.name)}</h2>
    <div class="note"><span class="f">${face(from, RACERS[from].color)}</span><p>“${esc(def.ask)}”<small>${esc(RACERS[from].name)}</small></p></div>
    <p class="kicker" style="margin-top:12px">The job</p>
    ${def.goal.map(g => `<div class="goalline"><span class="f">${face(g.who, RACERS[g.who].color)}</span>${esc(goalText(g, true))}${g.ahead || g.behind ? `<span class="f">${face(g.ahead || g.behind, RACERS[g.ahead || g.behind].color)}</span>` : ''}</div>`).join('')}
    <p class="kicker" style="margin-top:12px">On the grid</p>${lineup(racers)}
    ${fresh.length ? `<dl>${fresh.map(k => `<dt>${cardHTML(k)}</dt><dd><b>${esc((PLACE[k] || TRAPS[k]).name)}.</b> ${esc((PLACE[k] || TRAPS[k]).text)}</dd>`).join('')}</dl>` : ''}
    <div class="row"><button class="btn go" id="sGo" type="button">Rig it</button></div>`);
  wireLineup(() => introSheet());
  $('sGo').onclick = () => { sound.unlock(); sound.play('tap'); closeSheet(); teach(); };
}
function cardHTML(k) { const d = PLACE[k] || TRAPS[k], nm = d ? d.short : KART_ITEMS[k].name.split(' ').slice(-1)[0]; return `<div class="card${TRAPS[k] ? ' trapc' : ''}" style="--c:${CARD[k]}">${ICONS[k]}<span>${nm[0].toUpperCase() + nm.slice(1)}</span></div>`; }
function teach() {
  const def = G.def;
  if (def.teach && !saved.seen[G.n]) { saved.seen[G.n] = 1; save(); tip(def.teach.map(t => typeof t === 'string' ? { text: t } : t)); }
  else toast({ title: def.goal.map(g => goalText(g, true)).join(', and '), text: 'Pause any time to rig the road.', timeout: 3000 });
}

function racerSheet(who, back) {
  const R = RACERS[who], k = G?.S.karts.find(k => k.who === who);
  const bar = (label, v) => `<span>${label}</span><span class="bar"><i style="width:${Math.round(clamp(v, .05, 1) * 100)}%"></i></span>`;
  $('sheet').dataset.soft = '1';
  sheet(`<div style="width:84px;height:84px;margin:0 auto 6px;border-radius:50%;box-shadow:0 0 0 3px #2a1a10,0 4px 0 3px #2a1a10">${face(who, R.color)}</div>
    <h2>${esc(R.name)}</h2><p>${esc(R.blurb)}</p>
    <div class="stats" style="--c:${R.color}">${bar('Top speed', (R.speed - 9) / 2.2)}${bar('Pick-up', (R.acc - 2) / 5.5)}${bar('Grip in bends', R.grip)}${bar('Sees trouble', (R.sight - 5) / 11)}${bar('Swerving', (R.lat - 1.2) / 2)}</div>
    <dl>${R.traits.map(t => { const ti = traitInfo(t); return `<dt><b style="display:inline-block;padding:3px 9px;border-radius:9px;border:2.5px solid #2a1a10;background:#fff3c8">${esc(ti.name)}</b></dt><dd>${esc(ti.text)}</dd>`; }).join('')}</dl>
    ${k?.item ? `<p style="margin-top:8px">Carrying: <b>${esc(KART_ITEMS[k.item].name)}</b>. ${esc(KART_ITEMS[k.item].text)}</p>` : ''}
    <div class="row">${k && !back ? '<button class="btn" id="sFollow" type="button">Follow</button>' : ''}<button class="btn go" id="sOk" type="button">${back ? 'Back' : 'OK'}</button></div>`);
  $('sOk').onclick = () => { sound.play('tap'); if (back) back(); else closeSheet(); };
  $('sFollow') && ($('sFollow').onclick = () => { closeSheet(); followKart(k.i); });
}

function results() {
  const S = G.S, def = G.def, ok = goalState(S, def), win = ok.every(Boolean);
  const used = S.used, par = def.par ?? used, stars = win ? (used <= par ? 3 : used <= par + 2 ? 2 : 1) : 0;
  const goalWho = new Set(def.goal.flatMap(g => [g.who, g.ahead, g.behind].filter(Boolean)));
  if (win && !G.auto) {
    saved.stars[G.n] = Math.max(saved.stars[G.n] || 0, stars);
    saved.open = Math.max(saved.open, Math.min(LEVELS.length - 1, G.n + 1));
    save();
  }
  sound.play(win ? 'win' : 'lose');
  const order = S.karts.slice().sort((a, b) => a.place - b.place);
  $('sheet').dataset.soft = '';
  const laps = G.snaps.filter(s => s.lap > 1);
  const theEnd = win && G.n === LEVELS.length - 1;
  sheet(`<p class="kicker">Race ${G.n + 1} · ${esc(def.name)}</p><h2>${theEnd ? 'Every race, rigged' : win ? 'Rigged!' : 'Not quite'}</h2>
    ${theEnd ? '<p>Granny got her birthday win, and nobody ever found out who did it. Not even Duke.</p>' : ''}
    ${win ? `<div class="stars">${[0, 1, 2].map(i => `<span class="${i < stars ? '' : 'dim'}">★</span>`).join('')}</div><p>You used ${used} thing${used === 1 ? '' : 's'}${stars < 3 ? ` (it can be done with ${par})` : ''}.</p>` : `<p>${def.goal.map((g, i) => `${ok[i] ? '✓' : '✗'} ${esc(goalText(g, true))}`).join('<br>')}</p>`}
    <ol class="results">${order.map(k => `<li class="${goalWho.has(k.who) ? 'goal-who' : ''}"><span class="p">${k.place}</span><span class="f">${face(k.who, RACERS[k.who].color)}</span>${esc(RACERS[k.who].name)}<span class="tm">${k.finT.toFixed(2)}s</span></li>`).join('')}</ol>
    <div class="row">${win && G.n < LEVELS.length - 1 ? '<button class="btn go" id="sNext" type="button">Next race</button>' : ''}
      ${laps.length ? `<button class="btn${win ? '' : ' go'}" id="sLap" type="button">${ICONS.rewind} Lap ${laps[laps.length - 1].lap}</button>` : ''}
      <button class="btn${win || laps.length ? '' : ' go'}" id="sAgain" type="button">${ICONS.restart} From the start</button>
      <button class="btn" id="sAll" type="button">All races</button></div>`);
  $('sNext') && ($('sNext').onclick = () => through(() => begin(G.n + 1)));
  $('sLap') && ($('sLap').onclick = () => restore(G.snaps.length - 1));
  $('sAgain').onclick = () => restore(0);
  $('sAll').onclick = () => events_();
  $('live').textContent = win ? 'Rigged! The race went your way.' : 'Not quite. Try again.';
}

function events_() {
  $('sheet').dataset.soft = G ? '1' : '';
  const byTrack = {};
  LEVELS.forEach((l, i) => (byTrack[l.track] ||= []).push(i));
  sheet(`<h2>Rigged Racer</h2><p>Every race is fixed. You’re the one fixing them.</p>
    <div class="events">${Object.entries(byTrack).map(([t, list]) => `<h3>${esc(TRACKS[t].name)}</h3><div class="grid">${list.map(i => {
      const l = LEVELS[i], st = saved.stars[i] || 0, locked = i > saved.open;
      return `<button class="ev${locked ? ' locked' : ''}${G?.n === i ? ' now' : ''}" type="button" data-i="${i}" ${locked ? 'disabled' : ''}><span class="num">${i + 1}</span>${esc(l.name)}<span class="st">${locked ? '🔒' : '★'.repeat(st) + '☆'.repeat(3 - st)}</span></button>`;
    }).join('')}</div>`).join('')}</div>
    ${G ? '<div class="row"><button class="btn" id="sBack" type="button">Back to the race</button></div>' : ''}`);
  $('sheet').querySelectorAll('.ev:not(.locked)').forEach(b => b.onclick = () => { sound.unlock(); sound.play('tap'); through(() => begin(+b.dataset.i)); });
  $('sBack') && ($('sBack').onclick = () => closeSheet());
}
function help() {
  $('sheet').dataset.soft = '1';
  sheet(`<h2>How to rig a race</h2>
    <p>You don’t drive. The racers drive themselves; you fix the race so the right one wins (or loses).</p>
    <p style="text-align:left">• <b>Drag</b> what you’ve got onto the road (or tap it, then tap the road). Tap it again to pick it back up, until the race moves on.<br>
    • Each lap brings new stock. The race <b>pauses</b> at every lap, and you can pause it any time.<br>
    • Drivers swerve round trouble they see in time, if there’s a free lane. Nothing can go down right in front of a kart.<br>
    • The <b>dotted lines</b> show where everyone’s headed for the next few seconds.<br>
    • <b>Traps</b> on the track: arm one and it goes off on the next kart to pass.<br>
    • <b>Rewind</b> takes you back to the start of the lap, with your stock as it was.<br>
    • Drag to look around, pinch or scroll to zoom, tap a racer to follow them.</p>
    <p class="kicker" style="margin-top:12px">What the karts get from crates</p>
    <dl>${CRATE_TABLE.map((it, i) => `<dt>${cardHTML(it)}</dt><dd><b>${i === 0 ? 'Leading' : i === CRATE_TABLE.length - 1 ? 'Last' : 'Further back'}: ${esc(KART_ITEMS[it].name)}.</b> ${esc(KART_ITEMS[it].text)}</dd>`).join('')}</dl>
    <p style="font-size:13.5px;margin-top:10px">Keys: Space races or pauses, R rewinds, 1–9 choose, Esc lets go, arrows look around, + and − zoom, F frames the whole track, S changes speed.</p>
    <div class="row"><button class="btn go" id="sOk" type="button">Got it</button></div>`);
  $('sOk').onclick = () => closeSheet();
}

async function through(fn) {
  $('fade').classList.add('on');
  await sleep(300);
  fn();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  $('fade').classList.remove('on');
}

/* ---------- buttons and keys ---------- */
$('bGo').onclick = () => go();
$('bRewind').innerHTML = ICONS.rewind; $('bRewind').onclick = () => { sound.unlock(); rewind(); };
$('bSpeed').onclick = () => { saved.speed = ((saved.speed || 0) + 1) % SPEEDS.length; save(); sound.play('tap'); controls(); };
$('bHelp').innerHTML = ICONS.help; $('bHelp').onclick = () => { sound.unlock(); help(); };
$('bMenu').innerHTML = ICONS.menu; $('bMenu').onclick = () => { sound.unlock(); if (G?.mode === 'run') pauseRace(); events_(); };
$('bSound').innerHTML = ICONS.sound;
const soundIcon = () => { $('bSound').classList.toggle('muted', saved.sound === false); $('bSound').setAttribute('aria-label', saved.sound === false ? 'Sound on' : 'Sound off'); };
$('bSound').onclick = () => { saved.sound = saved.sound === false; save(); sound.setEnabled(saved.sound); sound.unlock(); soundIcon(); };
soundIcon();
document.addEventListener('keydown', e => {
  if (!G || e.metaKey || e.ctrlKey || e.altKey) return;
  if (!$('veil').hidden) { if (e.key === 'Escape' && $('sheet').dataset.soft) closeSheet(); return; }
  const k = e.key;
  if (k === ' ' || (k === 'Enter' && document.activeElement?.tagName !== 'BUTTON')) { go(); e.preventDefault(); }
  else if (k === 'r' || k === 'R') rewind();
  else if (k === 'Escape') setSel(null);
  else if (k === 'f' || k === 'F') world.fit(false);
  else if (k === 's' || k === 'S') $('bSpeed').click();
  else if (/^[1-9]$/.test(k)) { const c = document.querySelectorAll('#tray .card')[+k - 1]; if (c && !c.classList.contains('out')) { if (c.dataset.trap) armTrap(c.dataset.k, true); else setSel(G.sel === c.dataset.k ? null : c.dataset.k); } }
  else if (k === 'Backspace') { const id = [...G.placed].pop(); if (id != null) { unplace(G.S, id); G.placed.delete(id); sound.play('unplace'); render(); } e.preventDefault(); }
  else if (k === '+' || k === '=') world.zoomBy(.85);
  else if (k === '-' || k === '_') world.zoomBy(1.18);
  else {
    const d = world.cam.d * .06, mv = { ArrowLeft: [-d, 0], a: [-d, 0], ArrowRight: [d, 0], d: [d, 0], ArrowUp: [0, -d], w: [0, -d], ArrowDown: [0, d] }[k];
    if (mv) { const c = Math.cos(world.cam.yaw), s = Math.sin(world.cam.yaw); world.follow = -1; world.panBy(mv[0] * c + mv[1] * s, -mv[0] * s + mv[1] * c); e.preventDefault(); }
  }
});
addEventListener('visibilitychange', () => { if (document.hidden && G?.mode === 'run' && !G.auto) pauseRace(); });

/* ---------- layout ---------- */
function topBottom() {
  const g = $('goal').getBoundingClientRect(), b = $('board').getBoundingClientRect();
  return Math.max(g.bottom, document.body.classList.contains('wide') ? 0 : b.bottom);
}
function layout() {
  const vw = innerWidth, vh = innerHeight;
  document.body.classList.toggle('wide', vw >= 860 && vw / vh > 1.1);
  const wide = document.body.classList.contains('wide');
  const gb = $('goal').getBoundingClientRect();
  if (wide) { $('board').style.top = (gb.bottom + 12) + 'px'; }
  else { $('board').style.top = (gb.bottom + 8) + 'px'; }
  const top = topBottom() + 4, dock = $('dock').getBoundingClientRect().top - 6;
  const left = wide ? $('board').getBoundingClientRect().right + 6 : 0;
  const rect = { x: left, y: top, w: vw - left, h: Math.max(80, dock - top) };
  const key = JSON.stringify(rect);
  if (key !== layout.k) { layout.k = key; world.resize(rect); if (G && world.follow < 0 && !world.moved) world.fit(); }
}
addEventListener('resize', () => { layout.k = ''; layout(); if (!$('tip').classList.contains('away')) placeTip(); });
new ResizeObserver(() => layout()).observe($('goal'));

/* ---------- the solution at the wheel (?demo and ?auto) ---------- */
function autoLap(lap) {
  if (!G?.auto) return;
  for (const st of G.def.solution || []) if (st.t == null && (st.lap ?? 1) === lap) doStep(G.S, G.T, st);
  G.S.ev.length = 0;
  render();
  go();
}
async function autoplay(n, all) {
  begin(n, { intro: false });
  G.auto = true;
  if (DEMO) { saved.speed = 0; } else saved.speed = 2;
  autoLap(1);
  G.timed = (G.def.solution || []).filter(st => st.t != null).sort((a, b) => a.t - b.t);
  if (DEMO && Q.has('at')) {
    // straight to a moment of the solution's race (for the preview picture), then carry on, or hold still there
    while (G.mode !== 'run') await sleep(30);
    const to = +Q.get('at'), sol = G.def.solution || [];
    while (G.S.t < to - 1e-9 && !G.S.over) {
      while (G.timed.length && G.S.t >= G.timed[0].t - 1e-9) doStep(G.S, G.T, G.timed.shift());
      step(G.S, G.T);
      for (const e of G.S.ev) if (e.type === 'lap') for (const st of sol) if (st.t == null && st.lap === e.lap) doStep(G.S, G.T, st);
      G.S.ev.length = 0;
    }
    window.rigged.hold = Q.has('hold');
    world.setRace(G.S); render(); lamps(5);
    const who = Q.get('who'), i = who ? G.S.karts.findIndex(k => k.who === who) : G.S.order[0], p = world.karts[i].model.position;
    world.cam.yaw = +(Q.get('yaw') || 0); world.cam.x = p.x + +(Q.get('dx') || 0); world.cam.z = p.z + +(Q.get('dz') || 0); world.cam.d = +(Q.get('d') || 16);
    world.moved = true; world.applyCam();
    if (!Q.has('hold')) world.follow = i;
  } else if (DEMO) { await sleep(400); const goalWho = G.def.goal[0].who; world.follow = G.S.karts.findIndex(k => k.who === goalWho); world.cam.d = 20; world.applyCam(); }
  if (!all) return;
  while (G.mode !== 'done') await sleep(200);
  const ok = goalState(G.S, G.def).every(Boolean);
  console.log(`race ${n + 1} ${G.def.name}: ${ok ? 'won' : 'LOST'} with ${G.S.used} things`, G.S.karts.slice().sort((a, b) => a.place - b.place).map(k => k.who).join(' '));
  await sleep(800);
  if (n + 1 < LEVELS.length) autoplay(n + 1, all);
}

/* ---------- start ---------- */
layout();
requestAnimationFrame(frame);
if (DEMO || AUTO) autoplay(clamp(+(Q.get('level') || 1) - 1, 0, LEVELS.length - 1), AUTO);
else if (Q.has('level')) begin(clamp(+Q.get('level') - 1, 0, LEVELS.length - 1));
else if (!saved.open && !Object.keys(saved.stars).length) begin(0);   // the very first time: straight into the first race
else { begin(clamp(saved.last ?? saved.open, 0, LEVELS.length - 1), { intro: false }); events_(); }
setInterval(() => { if (G?.mode === 'plan') forecast(); }, 120);
window.toyboxReady?.();
