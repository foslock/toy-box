// Ladder: the page. Input (tap, drag, keys, wheel), the loop and camera, the HUD and cards, saving,
// and the recorder that keeps the day's worst fall for the replay.
import { buildHeap } from './heap.js';
import { Game, TICK } from './game.js';
import { View } from './render.js';
import { Sound } from './sound.js';
import { caption, closer } from './commentary.js';
import { LADDER } from './physics.js';
import { Bot } from './bot.js';
import { PLAN } from './plan.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug'), AUTO = Q.has('autoplay');
const KEY = 'ladder.v1';
const TOUCH = matchMedia('(pointer: coarse)').matches || Q.has('touch');
document.body.classList.toggle('touch', TOUCH);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const m1 = h => (Math.round(h * 10) / 10).toFixed(1);
const clock = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`; };

/* ------------------------------------------------------------------------------------------------- state */
const heap = buildHeap();
const g = new Game(heap);
const view = new View($('c')); view.setHeap(heap);
const snd = new Sound();
const store = { game: null, sound: true, seen: {}, hints: {}, last: null, session: null, started: false };
try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* a bad save starts fresh */ }
const persist = !DEMO && !AUTO && !Q.has('fresh');
function save() { if (!persist) return; store.game = g.save(); try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage full or off */ } }
snd.on = store.sound !== false;
// last visit's day becomes "last time"; today starts fresh
if (store.session && store.session.worst) store.last = store.session;
store.session = { start: Date.now(), falls: 0, worst: null, startBest: 0 };
if (persist && store.game) g.load(store.game);
store.session.startBest = g.best;
window.ladder = { g, view, heap, snd, store };

/* ------------------------------------------------------------------------------------------------- layout */
function layout() { view.resize(innerWidth, innerHeight, devicePixelRatio || 1); }
addEventListener('resize', layout); visualViewport?.addEventListener('resize', layout);
layout();
{ const [x, y] = g.focus(); view.follow(x, y, 0, true); }

/* ------------------------------------------------------------------------------------------------- input */
const cv = $('c');
let ptr = null;
const busy = () => !$('card').hidden || replay;
const world = (x, y) => view.toWorld(x, y);
cv.addEventListener('pointerdown', e => {
  snd.init();
  if (busy() || ptr || bot) return;
  try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ }
  ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t0: performance.now(), kind: 'pending' };
  if (g.mode === 'climb') ptr.kind = 'climb';
  else if (g.mode !== 'stand' && g.mode !== 'aim') ptr.kind = 'none';
  e.preventDefault();
});
cv.addEventListener('pointermove', e => {
  if (!ptr || e.pointerId !== ptr.id) return;
  ptr.x = e.clientX; ptr.y = e.clientY;
  if (ptr.kind === 'pending' && Math.hypot(ptr.x - ptr.x0, ptr.y - ptr.y0) > 9) decide();
  if (ptr.kind === 'aim') g.aimAt(...world(ptr.x, ptr.y));
  if (ptr.kind === 'climb') climbDrag();
});
function decide() {
  if (g.mode === 'climb') { ptr.kind = 'climb'; return; }
  if (g.mode === 'stand' && g.held === 'planted') {
    // along the ladder, upward: climb it; any other way: pick it up and lean it somewhere else
    const dx = ptr.x - ptr.x0, dy = ptr.y - ptr.y0, l = Math.hypot(dx, dy), c = Math.cos(g.lad.a), s = Math.sin(g.lad.a);
    if ((dx * c - dy * s) / l > 0.5) { ptr.kind = 'climb'; ptr.lx = ptr.x0; ptr.ly = ptr.y0; climbDrag(); return; }
  }
  if (g.aimStart()) { ptr.kind = 'aim'; hint('aim'); } else ptr.kind = 'none';
}
function climbDrag() {
  const dx = ptr.x - ptr.lx, dy = ptr.y - ptr.ly; ptr.lx = ptr.x; ptr.ly = ptr.y;
  const c = Math.cos(g.lad.a), s = Math.sin(g.lad.a);
  g.climbBy((dx * c - dy * s) / view.k * 0.9);
}
function endPointer(e) {
  if (!ptr || e.pointerId !== ptr.id) return;
  const p = ptr; ptr = null;
  if (p.kind === 'pending' && performance.now() - p.t0 < 450) { const [x] = world(p.x, p.y); g.tap(x); }
  else if (p.kind === 'aim') aimDone(g.aimEnd());
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', e => { if (ptr && ptr.kind === 'aim') g.aimCancel(); ptr = null; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => {
  e.preventDefault(); snd.init(); if (busy() || bot) return;
  const d = Math.sign(-e.deltaY) * LADDER.rung;
  if (g.mode === 'climb' || (g.mode === 'stand' && g.held === 'planted' && d > 0)) g.climbBy(d);
}, { passive: false });
function aimDone(r) {
  if (r === 'planted') {
    const q = g.planted, deg = q.a * 180 / Math.PI, lean = Math.abs(90 - deg), mu = q.foot?.mat?.mu ?? 0.7;
    if (q.foot && mu < 0.3) hint('slippery', `${cap(q.foot.obj?.name || 'That')} is slippery underfoot. Lean it steeper, climb slowly.`);
    else if (q.P && q.P.mat.mu < 0.2 && lean > 18) hint('glossy', `${cap(q.P.obj?.name || 'That')} is glossy. The top may slide.`);
    else if (lean > 32) hint('shallow', 'A shallow lean. The foot may slide out as you climb.');
    else if (lean < 6) hint('steep', 'Very steep. Climb slowly or it may tip back.');
    else hint('climb');
  } else if (r === 'nothing') hint('nothing', 'Nothing to lean it on there.', true);
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// keys
const held = {};
addEventListener('keydown', e => {
  snd.init();
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (!$('card').hidden) { if (e.key === 'Escape') closeCard(); return; }
  if (replay) { if (e.key === 'Escape' || e.key === 'Enter') endReplay(); return; }
  if (bot) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (held[k]) { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault(); return; }
  held[k] = true;
  if (k === 'ArrowLeft' || k === 'a') { e.preventDefault(); if (g.mode === 'aim') turning = 1; else g.setWalk(-1); }
  else if (k === 'ArrowRight' || k === 'd') { e.preventDefault(); if (g.mode === 'aim') turning = -1; else g.setWalk(1); }
  else if (k === 'ArrowUp' || k === 'w') { e.preventDefault(); if (g.mode === 'aim') aimDone(g.aimEnd()); else g.setClimb(1); }
  else if (k === 'ArrowDown' || k === 's') { e.preventDefault(); if (g.mode === 'aim') g.aimCancel(); else g.setClimb(-1); }
  else if (k === ' ' || k === 'Enter') { e.preventDefault(); if (g.mode === 'aim') aimDone(g.aimEnd()); else if (g.aimStart()) { g.aimTurn(-g.p.face * 0.3); hint('keys-aim', '← → to tilt the ladder, Space to set it down', true); } }
  else if (k === 'Escape') { if (g.mode === 'aim') g.aimCancel(); else menu(); }
  else if (k === 'm') toggleSound();
});
let turning = 0;
addEventListener('keyup', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; held[k] = false;
  if (k === 'ArrowLeft' || k === 'a' || k === 'ArrowRight' || k === 'd') { turning = 0; g.setWalk(held.ArrowLeft || held.a ? -1 : held.ArrowRight || held.d ? 1 : 0); }
  if (k === 'ArrowUp' || k === 'w' || k === 'ArrowDown' || k === 's') g.setClimb(held.ArrowUp || held.w ? 1 : held.ArrowDown || held.s ? -1 : 0);
});
addEventListener('blur', () => { for (const k in held) held[k] = false; g.setWalk(0); g.setClimb(0); turning = 0; });

/* ------------------------------------------------------------------------------------------------- hints */
const HINTS = {
  start: TOUCH ? 'Tap to walk. Drag toward something to lean the ladder on it.' : 'Click to walk. Drag toward something to lean the ladder on it.',
  aim: 'Let go to set it down where it touches.',
  climb: TOUCH ? 'Drag up to climb. Slowly does it.' : 'Drag up (or hold ↑) to climb. Slowly does it.',
  top: 'Keep going at the top to step off and pull the ladder up.',
};
let hintT = 0, hintKey = '';
function hint(key, text, force) {
  if (bot || DEMO) return;
  const seen = store.hints[key] || 0;
  if (!force && seen >= (key in HINTS ? 2 : 3)) return;
  if (hintKey === key && hintT > 0) return;
  store.hints[key] = seen + 1;
  hintKey = key; hintT = 5;
  const el = $('hint'); el.textContent = text || HINTS[key]; el.classList.add('on');
}
function hintTick(dt) { if (hintT > 0) { hintT -= dt; if (hintT <= 0) $('hint').classList.remove('on'); } }

/* ------------------------------------------------------------------------------------------------- the loop */
let last = performance.now(), acc = 0, bot = null, nextSave = 0, sighAt = -1, secShown = -1;
const ff = n => { for (let i = 0; i < n; i++) step(); };
function step() {
  if (turning && g.mode === 'aim') g.aimTurn(turning * 0.9 * TICK);
  if (bot) bot.tick(g);
  g.tick();
  for (const e of g.drain()) handle(e);
  rec();
  if (sighAt > 0 && g.t >= sighAt) { sighAt = -1; snd.sigh(); const P = g.p; view.note('sigh', P.x + P.face * 0.3, P.y + 1.1, { f: P.face, T: 1.4 }); }
  if (g.mode === 'climb' && g.rider.s > LADDER.L - 1.3) hint('top');
}
function handle(e) {
  switch (e.type) {
    case 'rung': snd.rung(e.s, e.fast); if (e.fast && g.strain > 0.6) view.note('creak', ...g.feet(), { a: g.lad.a + Math.PI / 2, T: 0.5 }); break;
    case 'step': snd.step(e.P?.mat?.snd); break;
    case 'plant': snd.plant(); view.puff(g.lad.fx, g.lad.fy, 4, 0.25); break;
    case 'lift': snd.lift(); break;
    case 'raise': snd.lift(); break;
    case 'impact': snd.knock(e.P?.mat?.snd, e.v); if (e.v > 3) view.puff(e.x, e.y, 3 + Math.min(6, e.v | 0), 0.3); break;
    case 'fall': snd.creakOnce(); break;
    case 'land': snd.knock('dirt', 5); snd.oof(); view.puff(g.p.x, g.p.y, 10, 0.6); if (e.lost > 1.2) sighAt = g.t + g.anim.lie + 0.35; if (e.lost > 3 && !bot) try { navigator.vibrate?.(Math.min(120, 30 + e.lost * 3)); } catch { /* no vibration */ } break;
    case 'fallen': onFallen(e.fall); break;
    case 'stepoff': snd.step(e.P?.mat?.snd); break;
    case 'haul': snd.haul(); break;
    case 'best': if (store.session.startBest > 3 && g.best > store.session.startBest + 0.5 && !bot) { snd.chime(); view.note('best', g.p.x, g.p.y + 2.1, { text: `best ${m1(g.best)} m`, T: 2 }); } break;
    case 'rest': if (persist) save(); break;
    case 'nope': snd.lift(); break;
    case 'edge': hint('edge', TOUCH ? 'A drop. Tap past the edge again to hop down.' : 'A drop. Click past the edge again to hop down.'); break;
    case 'bonk': snd.knock('wood', 2); break;
    case 'cling': hint('cling', 'Caught on the ladder. Climb along it.', true); break;
    case 'dismount': snd.step('dirt'); break;
    case 'win': onWin(); break;
    case 'handoff': snd.plant(); break;
    case 'paint': snd.haul(); break;
  }
}
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (replay) replayFrame(dt);
  else {
    if ($('card').hidden || DEMO) { acc += dt * (DEBUG && window.ladder.speed || 1); let n = 0; while (acc >= TICK && n++ < 12) { acc -= TICK; if (!window.ladder.hold) step(); } if (acc > TICK) acc = 0; }
    if (ptr && ptr.kind === 'pending' && g.mode === 'stand' && g.held === 'carry' && performance.now() - ptr.t0 > 230) decide();
    const [fx, fy] = g.focus();
    let cx = fx, cy = fy;
    if (g.mode === 'aim') { const c = Math.cos(g.lad.a), s = Math.sin(g.lad.a); cx += c * LADDER.L * 0.3; cy += s * LADDER.L * 0.2; }
    view.follow(cx, cy, dt);
    view.sky += ((g.won && (g.mode !== 'win' || g.anim.t > 5.6) ? 1 : 0) - view.sky) * Math.min(1, dt * 0.5);
    view.draw(viewOf(g), dt);
    hud(dt);
    snd.update(g.height(), g.mode === 'climb' ? g.strain : 0, g.mode === 'climb' ? Math.min(2, g.slide) : 0);
    if (now > nextSave && persist) { nextSave = now + 3000; save(); }
  }
  hintTick(dt);
  requestAnimationFrame(frame);
}
function viewOf(G) { return { mode: G.mode, t: G.t, p: G.p, lad: G.lad, held: G.held, rider: G.rider, pb: G.pb, rope: G.rope, anim: G.anim, strain: G.strain, won: G.won, aim: G.mode === 'aim' ? G.aimPose : null }; }

/* ------------------------------------------------------------------------------------------------- HUD */
function hud(dt) {
  const h = Math.max(0, g.height());
  $('alt').textContent = m1(h);
  $('best').textContent = m1(g.best);
  const top = heap.top;
  $('mnow').style.bottom = (Math.min(1, h / top) * 100) + '%';
  $('mbest').style.bottom = (Math.min(1, g.best / top) * 100) + '%';
  // which stretch of the heap you're on
  let si = 0; for (let i = 0; i < heap.sections.length; i++) if (h >= heap.sections[i].y - 0.5) si = i;
  if (si !== secShown) {
    if (secShown >= 0 && !store.seen['sec' + si] && g.mode === 'stand') { store.seen['sec' + si] = 1; toast(heap.sections[si].name); }
    if (g.mode === 'stand' || secShown < 0) { secShown = si; $('secname').textContent = heap.sections[si].name; }
  }
}
function toast(text) { const el = $('toast'); el.textContent = text; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); snd.chime(); }

/* ------------------------------------------------------------------------------------------------- recording falls */
const REC_HZ = 30, buf = [];
let recAt = 0, pend = null;
const r3 = v => Math.round(v * 1000) / 1000;
function snap() {
  const o = { t: r3(g.t), mode: g.mode, held: g.held, strain: r3(g.strain),
    p: { x: r3(g.p.x), y: r3(g.p.y), face: g.p.face, edge: g.p.edge, walk: r3(g.p.walk), shoulder: r3(g.p.shoulder), stride: r3(g.p.stride) },
    lad: { fx: r3(g.lad.fx), fy: r3(g.lad.fy), a: r3(g.lad.a) } };
  if (g.rider) o.rider = { s: r3(g.rider.s), side: g.rider.side };
  if (g.pb) o.pb = { x: r3(g.pb.x), y: r3(g.pb.y), vx: r3(g.pb.vx), vy: r3(g.pb.vy), spin: r3(g.pb.spin) };
  if (g.rope) o.rope = { s: r3(g.rope.s) };
  if (g.anim) o.anim = { t: r3(g.anim.t), T: r3(g.anim.T), lie: g.anim.lie && r3(g.anim.lie), x0: g.anim.x0, y0: g.anim.y0, x1: g.anim.x1, y1: g.anim.y1 };
  return o;
}
function rec() {
  if (g.t - recAt >= 1 / REC_HZ - 1e-6) { recAt = g.t; buf.push(snap()); if (buf.length > REC_HZ * 40) buf.shift(); }
  if (pend && g.t >= pend.until) {
    const f = pend.fall, frames = buf.filter(s => s.t >= f.t0 - 2.2 && s.t <= g.t + 0.01);
    const S = store.session;
    if (!S.worst || f.lost > S.worst.info.lost) {
      S.worst = { info: { lost: f.lost, cause: f.cause, bounces: f.bounces, foot: f.foot?.name, top: f.top?.name, land: f.land?.name, air: f.air || 0, t0: f.t0, t1: f.t1, when: Date.now() }, frames };
      save();
    }
    pend = null;
  }
}
function onFallen(f) {
  store.session.falls++;
  f.air = Math.max(0, (f.t1 ?? g.t) - f.t0);
  pend = { fall: f, until: g.t + (g.anim?.T || 3) + 0.8 };
}

/* ------------------------------------------------------------------------------------------------- the replay */
let replay = null;
function playReplay(w, title) {
  if (!w || !w.frames?.length) return;
  closeCard();
  const c = caption(w.info, Math.floor(w.info.when / 1000) || 7);
  replay = { w, t: w.frames[0].t, i: 0, end: w.frames.at(-1).t, hold: 0 };
  $('rp').hidden = false; document.body.classList.add('replaying');
  $('rptitle').textContent = title || 'Replay';
  $('rphead').textContent = c.head; $('rpline').textContent = c.line;
  $('rpsub').textContent = title === 'Last time' ? 'From your last visit' : closer({ falls: store.session.falls });
  snd.scratch();
  const f0 = w.frames[0]; const pv = frameView(f0); const [x, y] = focusOf(pv); view.follow(x, y, 0, true);
}
function replayFrame(dt) {
  const R = replay, info = R.w.info, fr = R.w.frames;
  const slow = R.t > info.t0 - 0.2 && R.t < (info.t1 ?? info.t0 + 3) + 0.3;
  if (R.t < R.end) R.t += dt * (slow ? 0.5 : 1); else { R.hold += dt; if (R.hold > 2.5) { R.t = fr[0].t; R.hold = 0; } }
  while (R.i < fr.length - 2 && fr[R.i + 1].t <= R.t) R.i++;
  if (R.t < fr[R.i].t) R.i = 0;
  const a = fr[R.i], b = fr[Math.min(fr.length - 1, R.i + 1)], k = b.t > a.t ? Math.max(0, Math.min(1, (R.t - a.t) / (b.t - a.t))) : 0;
  const v = frameView(lerpFrame(a, b, k));
  const [x, y] = focusOf(v);
  view.follow(x, y, dt);
  view.draw(v, dt);
  $('rpslow').classList.toggle('on', slow);
}
function frameView(f) { return { ...f, aim: null, strain: f.strain || 0 }; }
function focusOf(v) {
  if (v.mode === 'climb' && v.rider) { const c = Math.cos(v.lad.a), s = Math.sin(v.lad.a); return [v.lad.fx + c * v.rider.s, v.lad.fy + s * v.rider.s + 0.9]; }
  if (v.mode === 'fall' && v.pb) return [v.pb.x, v.pb.y + 0.6];
  return [v.p.x, v.p.y + 0.9];
}
function lerpFrame(a, b, k) {
  if (a.mode !== b.mode || !k) return a;
  const L = (x, y) => typeof x === 'number' && typeof y === 'number' ? x + (y - x) * k : x;
  const sub = (o, q) => { if (!o || !q) return o; const out = {}; for (const key in o) out[key] = L(o[key], q[key]); return out; };
  return { ...a, t: L(a.t, b.t), p: sub(a.p, b.p), lad: sub(a.lad, b.lad), rider: sub(a.rider, b.rider), pb: sub(a.pb, b.pb), rope: sub(a.rope, b.rope), anim: sub(a.anim, b.anim) };
}
function endReplay() {
  replay = null; $('rp').hidden = true; document.body.classList.remove('replaying');
  const [x, y] = g.focus(); view.follow(x, y, 0, true);
  if (endReplay.then) { const f = endReplay.then; endReplay.then = null; f(); }
}
$('rpagain').addEventListener('click', () => { if (replay) { replay.t = replay.w.frames[0].t; replay.i = 0; replay.hold = 0; snd.scratch(); } });
$('rpdone').addEventListener('click', () => endReplay());

/* ------------------------------------------------------------------------------------------------- cards */
function card(html) { $('cbox').innerHTML = html; $('card').hidden = false; ptr = null; g.setWalk(0); g.setClimb(0); if (g.mode === 'aim') g.aimCancel(); }
function closeCard() { $('card').hidden = true; last = performance.now(); }
function how() {
  return `<ul class="how">
    <li><b>${TOUCH ? 'Tap' : 'Click'}</b> to walk.</li>
    <li><b>Drag</b> toward something and the ladder leans on whatever it touches first. Let go to set it down.</li>
    <li><b>Drag up</b> to climb${TOUCH ? '' : ' (or hold ↑, or scroll)'}. Keep going at the top to step off and haul the ladder up after you.</li>
    <li>Slippery underfoot needs a steeper lean. Too steep and it tips back. Climb fast and it rocks.</li>
  </ul>`;
}
function titleCard() {
  const fresh = !store.started;
  const last = store.last?.worst;
  card(`<div class="tt">Ladder</div>
    <p class="lede">${fresh ? 'There is a heap of junk in the desert, and someone at the top is waiting on a can of paint. You have the paint, and a ladder.' : `You're ${m1(Math.max(0, g.height()))} m up the heap. Your best is ${m1(g.best)} m.`}</p>
    ${fresh ? how() : ''}
    <div class="row"><button class="btn go" id="bgo">${fresh ? 'Start climbing' : 'Carry on'}</button>
    ${last ? `<button class="btn" id="blast">Last time's worst fall</button>` : ''}</div>
    ${!fresh ? `<p class="small">${clock(g.played)} on the heap · ${g.falls} falls</p>` : ''}`);
  $('bgo').onclick = () => { snd.init(); store.started = true; closeCard(); save(); if (fresh) hint('start'); };
  if (last) $('blast').onclick = () => { snd.init(); playReplay(store.last.worst, 'Last time'); endReplay.then = titleCard; };
}
function menu() {
  const S = store.session;
  card(`<div class="tt sm">Ladder</div>
    <p class="stats"><span><b>${m1(Math.max(0, g.height()))} m</b> now</span><span><b>${m1(g.best)} m</b> best</span><span><b>${S.falls}</b> falls today</span><span><b>${clock(g.played)}</b> on the heap</span></p>
    ${how()}
    <div class="row">
      <button class="btn go" id="bres">Back to it</button>
      <button class="btn" id="bday">Call it a day</button>
      <button class="btn" id="bsnd">Sound: ${snd.on ? 'on' : 'off'}</button>
      <button class="btn warn" id="bover">Start over</button>
    </div>`);
  $('bres').onclick = closeCard;
  $('bday').onclick = callItADay;
  $('bsnd').onclick = () => { toggleSound(); $('bsnd').textContent = `Sound: ${snd.on ? 'on' : 'off'}`; };
  $('bover').onclick = () => {
    card(`<div class="tt sm">Start over?</div><p class="lede">Back to the van, with the paint. Your best height is kept.</p>
      <div class="row"><button class="btn warn" id="byes">Start over</button><button class="btn go" id="bno">Keep climbing</button></div>`);
    $('byes').onclick = () => { const best = g.best, played = g.played, falls = g.falls; g.reset(); buf.length = 0; pend = null; g.best = best; g.played = played; g.falls = falls; save(); closeCard(); const [x, y] = g.focus(); view.follow(x, y, 0, true); };
    $('bno').onclick = closeCard;
  };
}
function callItADay() {
  const S = store.session;
  save();
  if (S.worst) { playReplay(S.worst, "Today's worst fall"); endReplay.then = dayCard; }
  else dayCard();
}
function dayCard() {
  const S = store.session;
  card(`<div class="tt sm">That's the day</div>
    <p class="lede">${S.falls ? `${S.falls} fall${S.falls > 1 ? 's' : ''} today.` : 'No falls today.'} You're ${m1(Math.max(0, g.height()))} m up, and your best is ${m1(g.best)} m.<br>The heap will be here tomorrow, and so will you, right where you left off.</p>
    <div class="row"><button class="btn go" id="bon">Keep going anyway</button>${S.worst ? '<button class="btn" id="brep">Watch it again</button>' : ''}</div>`);
  $('bon').onclick = () => { store.last = { ...S }; store.session = { start: Date.now(), falls: 0, worst: null, startBest: g.best }; save(); closeCard(); };
  if (S.worst) $('brep').onclick = () => { playReplay(S.worst, "Today's worst fall"); endReplay.then = dayCard; };
}
function onWin() {
  snd.win(); save();
  setTimeout(() => {
    const S = store.session;
    card(`<div class="tt">The top</div>
      <p class="lede">The paint is delivered, and the sky gets its blue back.</p>
      <p class="stats"><span><b>${clock(g.played)}</b> on the heap</span><span><b>${g.falls}</b> falls in all</span></p>
      <div class="row">${S.worst ? `<button class="btn go" id="bw">Today's worst fall</button>` : ''}<button class="btn" id="bstay">Stay a while</button><button class="btn warn" id="bagain">Climb it again</button></div>`);
    if (S.worst) $('bw').onclick = () => { playReplay(S.worst, "Today's worst fall"); endReplay.then = onWin; };
    $('bstay').onclick = closeCard;
    $('bagain').onclick = () => { const best = g.best; g.reset(); buf.length = 0; pend = null; view.sky = 0; g.best = best; save(); closeCard(); const [x, y] = g.focus(); view.follow(x, y, 0, true); };
  }, 8200);
}
function toggleSound() { snd.setOn(!snd.on); store.sound = snd.on; $('bsound').classList.toggle('off', !snd.on); save(); }
$('bmenu').addEventListener('click', () => { snd.init(); menu(); });
$('bsound').addEventListener('click', () => { snd.init(); toggleSound(); });
$('bsound').classList.toggle('off', !snd.on);
$('card').addEventListener('click', e => { if (e.target === $('card') && store.started) closeCard(); });
addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);

/* ------------------------------------------------------------------------------------------------- start */
if (DEMO) {
  // the preview: partway up a ladder somewhere on the heap (?at=height, ?s=metres up the ladder, ?cx/?cy nudge the camera)
  const at = +(Q.get('at') ?? 30), L = PLAN.reduce((a, b) => Math.abs(b.spots[0][1] - at) < Math.abs(a.spots[0][1] - at) ? b : a);
  const sp = L.spots.reduce((a, b) => Math.abs(b[0] - L.x) < Math.abs(a[0] - L.x) ? b : a);
  g.p.x = L.x; g.p.y = sp[1]; g.p.face = Math.cos(L.aim * Math.PI / 180) >= 0 ? 1 : -1; g.carryPose(true);
  g.aimStart(); g.aimA = L.aim * Math.PI / 180; g.aimPose = g.place(g.aimA); g.aimEnd();
  g.mount(); const s = +(Q.get('s') ?? 1.7); g.rider.s = s; g.sTarget = s;
  g.t = 3; g.best = g.height(); document.body.classList.add('demo'); store.started = true;
  for (let i = 0; i < 20; i++) step();
  const [x, y] = g.focus(); view.follow(x + +(Q.get('cx') || 0), y + +(Q.get('cy') || 0), 0, true);
  window.ladder.hold = !Q.has('live');
} else if (AUTO) {
  bot = new Bot(heap); store.started = true; window.ladder.bot = bot;
} else if (!DEBUG) titleCard();
else store.started = true;
Object.assign(window.ladder, { ff, step, playReplay, save, viewOf });
requestAnimationFrame(frame);
window.toyboxReady?.();
