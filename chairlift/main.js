// Chairlift: the page. Input (drag up for a lift, down for a run), HUD, the evening and closing cards,
// the lessons, and ?demo (the bot builds a resort for the preview shot) / ?debug (window.cl, ?hold to step).

import { W, H, MOUNTAINS, TUTORIAL, GREEN_MAX, BLUE_MAX } from './terrain.js';
import { Game, CFG } from './game.js';
import { View, LV, LVN, shape } from './render.js';
import { Sound } from './sound.js';
import { Bot, findRun } from './bot.js';

const qs = new URLSearchParams(location.search);
const DEMO = qs.has('demo'), DEBUG = qs.has('debug'), HOLD = qs.has('hold');
const $ = id => document.getElementById(id);
const cv = $('c'), view = new View(cv), snd = new Sound();

// ------------------------------------------------------------------ saved stuff
const KEY = 'chairlift.v1';
let save = { best: {}, tut: false, sound: true };
try { save = { ...save, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} };
snd.on = save.sound;

// ------------------------------------------------------------------ state
let game = null, mIndex = 0, mode = 'title', speed = 1, bot = null;
const ui = { now: 0, sel: null, drag: null, ghost: null, steepA: 0, steepOn: false, night: 0, nightTo: 0, can: new Map(), canV: -1, arm: false, labels: false };
let tut = null;

// ------------------------------------------------------------------ layout
function layout() {
  const vw = innerWidth, vh = innerHeight;
  // wide screens: the map takes the full height and the toolbar moves to the side
  const wide = (vw - 130 - (vh - 24) / H * W) / 2 >= 215;
  document.body.classList.toggle('wide', wide);
  const top = 62, bottom = 74;
  const rect = wide ? { x: 8, y: 12, w: vw - 16 - 130, h: vh - 24 } : { x: 8, y: top + 4, w: vw - 16, h: vh - top - bottom - 10 };
  view.alignTop = !wide;
  view.resize(vw, vh, rect);
  $('legend').hidden = !((mode === 'play' || mode === 'tut') && view.ox > 225 && vh > 560) || DEMO;
}
addEventListener('resize', () => { layout(); });

// ------------------------------------------------------------------ hints
let hintT = 0;
function hint(text, bad = false, ms = 2400) {
  const h = $('hint'); h.innerHTML = text; h.classList.toggle('bad', bad); h.classList.add('on');
  clearTimeout(hintT); hintT = setTimeout(() => h.classList.remove('on'), ms);
}
const SYM = ['<span class="sym g"></span>', '<span class="sym b"></span>', '<span class="sym k"></span>'];

// ------------------------------------------------------------------ starting things
function start(i) {
  mIndex = i; mode = 'play';
  game = new Game({ mountain: MOUNTAINS[i], seed: (Math.random() * 1e9) | 0 });
  enterGame();
  hint(`${MOUNTAINS[i].name}. Drag uphill from the Base Lodge to build a lift.`, false, 4200);
}
function enterGame() {
  view.setGame(game);
  ui.sel = null; ui.drag = null; ui.ghost = null; ui.night = 0; ui.nightTo = 0; ui.canV = -1; ui.arm = false;
  ui.steepOn = false; ui.steepA = 0; $('tSteep').classList.remove('on'); $('tGon').classList.remove('arm');
  for (const id of ['title', 'evening', 'closed']) $(id).hidden = true;
  $('hud').hidden = false; $('bar').hidden = false; $('pop').hidden = true;
  $('mname').textContent = game.def.name;
  setSpeed(1);
  layout(); fitBtn();
}
function showTitle() {
  mode = 'title'; tut = null; $('coach').hidden = true;
  for (const id of ['hud', 'bar', 'evening', 'closed', 'pop', 'legend']) $(id).hidden = true;
  const box = $('mtns'); box.innerHTML = '';
  MOUNTAINS.forEach((m, i) => {
    const prev = MOUNTAINS[i - 1], open = !prev || (save.best[prev.id] || 0) >= m.unlock;
    const b = document.createElement('button'); b.className = 'mtn'; b.disabled = !open;
    b.innerHTML = `<span class="nm">${m.name}</span><span class="ds">${open ? m.sub : `Serve ${m.unlock} skiers on ${prev.name} to open`}</span>
      <span class="bs">${open ? `Best<b>${save.best[m.id] || 0}</b>` : 'Closed'}</span>`;
    b.onclick = () => { snd.init(); if (!save.tut && i === 0) startTutorial(); else start(i); };
    box.appendChild(b);
  });
  $('title').hidden = false;
  // something to look at behind the card
  game = new Game({ mountain: MOUNTAINS[0], seed: 4 });
  view.setGame(game);
}

// ------------------------------------------------------------------ toolbar
function setSpeed(s) {
  speed = s;
  $('tPause').classList.toggle('on', s === 0); $('tPlay').classList.toggle('on', s === 1); $('tFast').classList.toggle('on', s === 3);
}
$('tPause').onclick = () => setSpeed(speed === 0 ? 1 : 0);
$('tPlay').onclick = () => setSpeed(1);
$('tFast').onclick = () => setSpeed(3);
$('tSteep').onclick = () => toggleSteep();
function toggleSteep(v = !ui.steepOn) {
  ui.steepOn = v; $('tSteep').classList.toggle('on', v);
  if (v) hint(`Straight downhill: ${SYM[0]} gentle ${SYM[1]} steeper ${SYM[2]} steep · red is rock`, false, 3800);
}
$('tLift').onclick = () => hint(game && game.inv.lift > 0 ? 'Drag <b>uphill</b> from a lodge, a station or anywhere to build a chairlift' : 'No chairlifts left. You can pick one each evening, or remove one', !(game && game.inv.lift > 0), 3200);
$('tGon').onclick = () => {
  if (!game || game.inv.gondola < 1) { hint('Gondolas come from the evening pick', true); return; }
  ui.arm = !ui.arm; $('tGon').classList.toggle('arm', ui.arm);
  if (ui.arm) hint('Now tap a lift to make it a gondola: six seats, faster', false, 3200);
};
function soundIcon() { $('soundWaves').style.opacity = save.sound ? 1 : 0; $('tSound').classList.toggle('on', !save.sound); }
$('tSound').onclick = () => { save.sound = !save.sound; store(); snd.init(); snd.setOn(save.sound); soundIcon(); };
soundIcon();

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (mode !== 'play' && mode !== 'tut') return;
  if (e.code === 'Space') { e.preventDefault(); setSpeed(speed === 0 ? 1 : 0); }
  else if (e.key === '1') setSpeed(1);
  else if (e.key === '2' || e.key === '3') setSpeed(3);
  else if (e.key === 's' || e.key === 'S') toggleSteep();
  else if (e.key === 'g' || e.key === 'G') $('tGon').click();
  else if (e.key === '+' || e.key === '=') { view.zoomAt(innerWidth / 2, innerHeight / 2, 1.25); fitBtn(); }
  else if (e.key === '-' || e.key === '_') { view.zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.25); fitBtn(); }
  else if (e.key === '0') { $('tFit').click(); }
  else if (e.key.startsWith('Arrow')) { e.preventDefault(); const k = 60; view.panBy(e.key === 'ArrowLeft' ? k : e.key === 'ArrowRight' ? -k : 0, e.key === 'ArrowUp' ? k : e.key === 'ArrowDown' ? -k : 0); }
  else if (e.key === 'Escape') { ui.drag = null; select(null); ui.arm = false; $('tGon').classList.remove('arm'); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && ui.sel && ui.sel.type) { removeEdge(ui.sel); }
});

// ------------------------------------------------------------------ picking
function snapR() { return Math.max(14, 22 / view.sc); }
function pickNode(p, r = snapR(), not = null) {
  let best = null, bd = r;
  for (const n of game.nodes.values()) { if (n === not) continue; const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < bd) { bd = d; best = n; } }
  return best;
}
function pickRunPoint(p, r = snapR() * .8) {
  let best = null, bd = r;
  for (const e of game.edges.values()) if (e.type === 'run') {
    for (let i = 2; i < e.pts.length - 2; i++) { const d = Math.hypot(e.pts[i][0] - p.x, e.pts[i][1] - p.y); if (d < bd) { bd = d; best = { e, i }; } }
  }
  return best;
}
function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / L));
  return Math.hypot(a[0] + dx * t - p.x, a[1] + dy * t - p.y);
}
function pickEdge(p, r = snapR() * .8) {
  let best = null, bd = r;
  for (const e of game.edges.values()) for (let i = 0; i + 1 < e.pts.length; i++) {
    const d = segDist(p, e.pts[i], e.pts[i + 1]) - (e.type === 'lift' ? 2 : 0);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
// a node to stand on: an existing one, or a junction made by splitting a run
function nodeAt(target) {
  if (!target) return null;
  if (target.node) return game.nodes.get(target.node.id) || null;
  if (target.run) {
    // the run may have been split already: find the nearest run point again by position
    const hit = pickRunPoint({ x: target.x, y: target.y }, 2);
    if (hit) return game.splitRun(hit.e, hit.i);
    const n = pickNode({ x: target.x, y: target.y }, 2);
    if (n) return n;
  }
  return null;
}

// ------------------------------------------------------------------ input
let ptr = null, pinch = null;
const touches = new Map();
const LIFT_WHY = { short: 'Too short for a lift', long: 'That\'s further than the cable reaches', flat: 'Lifts have to climb', edge: 'Off the map' };
const RUN_WHY = { uphill: 'Runs can\'t go uphill', cliff: 'Rock! Too steep to ski', edge: 'Off the map' };

cv.addEventListener('pointerdown', e => {
  if (!game || (mode !== 'play' && mode !== 'tut' && mode !== 'closed')) return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  // two fingers: zoom and pan, and drop whatever the first finger was drawing
  if (touches.size === 2) {
    ptr = null; ui.drag = null;
    const [a, b] = [...touches.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    return;
  }
  if (pinch || ptr) return;
  if (e.button === 2 || e.button === 1 || mode === 'closed') { ptr = { id: e.pointerId, pan: true, lx: e.clientX, ly: e.clientY, sx: e.clientX, sy: e.clientY }; cv.setPointerCapture(e.pointerId); return; }
  snd.init();
  cv.setPointerCapture(e.pointerId);
  const p = view.toWorld(e.clientX, e.clientY);
  ptr = { id: e.pointerId, sx: e.clientX, sy: e.clientY, p, moved: false };
  const n = pickNode(p);
  if (n) ptr.from = { node: n, x: n.x, y: n.y };
  else { const r = pickRunPoint(p); if (r) ptr.from = { run: r.e, x: r.e.pts[r.i][0], y: r.e.pts[r.i][1] }; }
});
cv.addEventListener('pointermove', e => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && touches.size >= 2) {
    const [a, b] = [...touches.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    view.panBy(mx - pinch.mx, my - pinch.my);
    if (pinch.d > 10) view.zoomAt(mx, my, d / pinch.d);
    pinch = { d, mx, my }; fitBtn();
    return;
  }
  if (ptr && ptr.pan && e.pointerId === ptr.id) { view.panBy(e.clientX - ptr.lx, e.clientY - ptr.ly); ptr.lx = e.clientX; ptr.ly = e.clientY; return; }
  if (!ptr || e.pointerId !== ptr.id) {
    // hover cursor on desktop
    if (game && e.pointerType === 'mouse' && (mode === 'play' || mode === 'tut')) {
      const p = view.toWorld(e.clientX, e.clientY);
      cv.style.cursor = pickNode(p) || pickEdge(p) ? 'pointer' : 'crosshair';
    }
    return;
  }
  const p = view.toWorld(e.clientX, e.clientY);
  if (!ptr.moved && Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy) > 9) {
    ptr.moved = true;
    select(null);
    const T = game.T, from = ptr.from || { x: ptr.p.x, y: ptr.p.y };
    const up = T.height(p.x, p.y) > T.height(from.x, from.y) + 1;
    if (up) {
      if (game.inv.lift < 1) { hint('No chairlifts left. You get to pick one each evening', true); snd.bad(); ptr.dead = true; flash('tLift'); }
      else ui.drag = { mode: 'lift', from, a: { x: from.x, y: from.y }, b: p };
    } else {
      if (!ptr.from) { hint('Runs start at a lodge, a lift station or another run', true); snd.bad(); ptr.dead = true; }
      else ui.drag = { mode: 'run', from, pts: [[from.x, from.y]], cls: 0, steep: 0 };
    }
  }
  if (ptr.dead || !ui.drag) return;
  // a young drag can still change its mind: up the hill it's a lift, down it's a run
  const dr = ui.drag, T = game.T, hf = T.height(dr.from.x, dr.from.y), hp = T.height(p.x, p.y);
  const young = Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy) < 70;
  if (dr.mode === 'run' && young && dr.pts.length <= 3 && hp > hf + 2 && game.inv.lift > 0) ui.drag = { mode: 'lift', from: dr.from, a: { x: dr.from.x, y: dr.from.y }, b: p };
  else if (dr.mode === 'lift' && young && ptr.from && hp < hf - 2) ui.drag = { mode: 'run', from: dr.from, pts: [[dr.from.x, dr.from.y]], cls: 0, steep: 0 };
  if (ui.drag.mode === 'lift') moveLift(p); else moveRun(p, e.clientX, e.clientY);
});
const endPtr = e => {
  touches.delete(e.pointerId);
  if (pinch) { if (touches.size === 0) pinch = null; return; }
  if (!ptr || e.pointerId !== ptr.id) return;
  if (ptr.pan) {
    // a tap while looking at a closed mountain brings the card back
    if (mode === 'closed' && Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy) < 8) $('closed').hidden = false;
    ptr = null; return;
  }
  const p = view.toWorld(e.clientX, e.clientY);
  if (!ptr.moved) tap(p, e.clientX, e.clientY);
  else if (ui.drag && !ptr.dead && e.type === 'pointerup') { if (ui.drag.mode === 'lift') commitLift(); else commitRun(); }
  ui.drag = null; ptr = null;
};
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('contextmenu', e => e.preventDefault());
// wheel: a mouse wheel or a trackpad pinch zooms, a two-finger trackpad scroll pans
cv.addEventListener('wheel', e => {
  if (!game || mode === 'title') return;
  e.preventDefault();
  const mouseWheel = e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 40 && Number.isInteger(e.deltaY));
  if (e.ctrlKey || mouseWheel) view.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? .012 : .0018) * (e.deltaMode === 1 ? 30 : 1)));
  else view.panBy(-e.deltaX, -e.deltaY);
  fitBtn();
}, { passive: false });
function fitBtn() { $('tFit').hidden = view.cam.z < 1.02; }
$('tFit').onclick = () => { view.focus(W / 2, H / 2, 1); fitBtn(); };

function moveLift(p) {
  const dr = ui.drag, a = dr.a;
  let b = { x: p.x, y: p.y };
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  if (d > game.liftMax) { b = { x: a.x + (b.x - a.x) / d * game.liftMax, y: a.y + (b.y - a.y) / d * game.liftMax }; }
  const fromNode = dr.from.node;
  const sn = pickNode(p, snapR(), fromNode);
  dr.snap = null;
  if (sn && !game.liftCheck(a, sn)) { b = { x: sn.x, y: sn.y }; dr.snap = sn; }
  dr.b = b; dr.over = d > game.liftMax;
  const why = game.liftCheck(a, b);
  dr.bad = why; dr.badText = LIFT_WHY[why] || '';
  dr.climb = game.T.height(b.x, b.y) - game.T.height(a.x, a.y);
}

function moveRun(p, cx, cy) {
  const dr = ui.drag, pts = dr.pts;
  // backing up along the line rubs it out
  for (let k = Math.max(1, pts.length - 60); k < pts.length - 4; k++) {
    if (Math.hypot(pts[k][0] - p.x, pts[k][1] - p.y) < 3) { pts.length = k + 1; break; }
  }
  dr.bad = null;
  for (let guard = 0; guard < 200; guard++) {
    const last = pts[pts.length - 1], d = Math.hypot(p.x - last[0], p.y - last[1]);
    if (d < CFG.step) break;
    const nx = last[0] + (p.x - last[0]) / d * CFG.step, ny = last[1] + (p.y - last[1]) / d * CFG.step;
    const why = game.runStepOk(pts.slice(-8), [nx, ny]);
    if (why) { dr.bad = why; break; }
    pts.push([nx, ny]);
  }
  dr.badText = RUN_WHY[dr.bad] || ''; dr.fx = cx; dr.fy = cy;
  // landing on something?
  const last = pts[pts.length - 1];
  dr.snap = null;
  const startNode = dr.from.node;
  for (const q of [p, { x: last[0], y: last[1] }]) {
    const n = pickNode(q, snapR(), startNode);
    if (n && Math.hypot(n.x - last[0], n.y - last[1]) < snapR() * 1.6 && !game.endOk(last, n)) { dr.snap = n; break; }
  }
  if (!dr.snap) {
    const r = pickRunPoint({ x: last[0], y: last[1] }, snapR() * .7);
    if (r && r.e.id !== dr.from.run?.id && !game.endOk(last, { x: r.e.pts[r.i][0], y: r.e.pts[r.i][1], h: game.T.height(r.e.pts[r.i][0], r.e.pts[r.i][1]) })) dr.snapRun = r; else dr.snapRun = null;
  } else dr.snapRun = null;
  const full = dr.snap ? [...pts, [dr.snap.x, dr.snap.y]] : pts;
  if (full.length > 1) { const m = game.measureRun(full); dr.cls = m.cls; dr.steep = m.steep; }
  if (dr.snap || dr.snapRun) dr.bad = null;
}

function commitLift() {
  const dr = ui.drag;
  if (dr.bad) { hint(dr.badText, true); snd.bad(); return; }
  const a = nodeAt(dr.from) || game.addNode(dr.a.x, dr.a.y, 'stn');
  let b = dr.snap ? game.nodes.get(dr.snap.id) : null;
  if (!b) { const r = pickRunPoint(dr.b, 3); b = r ? game.splitRun(r.e, r.i) : game.addNode(dr.b.x, dr.b.y, 'stn'); }
  if (a === b) { game.prune(); return; }
  game.addLift(a, b);
  tut?.on('lift');
}

function commitRun() {
  const dr = ui.drag;
  let pts = dr.pts;
  let endNode = dr.snap ? game.nodes.get(dr.snap.id) : null;
  if (!endNode && dr.snapRun) {
    const r = dr.snapRun; const q = r.e.pts[r.i];
    pts = [...pts, [q[0], q[1]]];
    endNode = { pending: q };
  } else if (endNode) pts = [...pts, [endNode.x, endNode.y]];
  const len = game.measureRun(pts).len;
  if (len < CFG.runMin) { hint('Too short for a run. Keep dragging downhill', true); snd.bad(); return; }
  const a = nodeAt(dr.from);
  if (!a) return;
  let b;
  if (endNode && endNode.pending) { const r = pickRunPoint({ x: endNode.pending[0], y: endNode.pending[1] }, 2); b = r ? game.splitRun(r.e, r.i) : game.addNode(endNode.pending[0], endNode.pending[1], 'jct'); }
  else b = endNode || game.addNode(pts[pts.length - 1][0], pts[pts.length - 1][1], 'jct');
  if (a === b) { game.prune(); return; }
  pts[0] = [a.x, a.y]; pts[pts.length - 1] = [b.x, b.y];
  const e = game.addRun(a, b, pts);
  if (b.kind === 'jct' && game.edgesAt(b).length === 1) hint(`${LVN[e.cls]} run, ending in the open. Skiers need a way on from here`, false, 3200);
  tut?.on('run', e);
}

function tap(p, cx, cy) {
  if (ui.arm) {
    const e = pickEdge(p);
    if (e && e.type === 'lift' && !e.gondola) { game.upgradeLift(e); ui.arm = false; $('tGon').classList.remove('arm'); hint(`Lift ${e.no} is a gondola now`); tut?.on('gondola'); return; }
    ui.arm = false; $('tGon').classList.remove('arm');
  }
  const n = pickNode(p, snapR() * .8);
  if (n && n.kind === 'lodge') { select(n, cx, cy); return; }
  const e = pickEdge(p);
  select(e, cx, cy);
}

function select(x, cx, cy) {
  ui.sel = x || null;
  const pop = $('pop');
  if (!x) { pop.hidden = true; return; }
  snd.tap();
  let html = '';
  if (x.type === 'run') {
    html = `<div class="t">${SYM[x.cls]} ${x.name}</div><div class="s">${LVN[x.cls]} · ${(x.len * .005).toFixed(1)} km · steepest pitch ${Math.round(x.steep * 100)}%<br>Skied ${x.carried} times</div>
      <div class="row"><button class="btn red" data-act="rm">Remove</button></div>`;
  } else if (x.type === 'lift') {
    const climb = Math.round(game.nodes.get(x.b).h - game.nodes.get(x.a).h);
    html = `<div class="t">${x.gondola ? 'Gondola' : 'Chairlift'} ${x.no}</div><div class="s">${x.seats} seats · ${(x.len * .005).toFixed(1)} km · climbs ${climb} m<br>${x.queue.length} queuing · carried ${x.carried}</div>
      <div class="row"><button class="btn red" data-act="rm">Remove</button>${!x.gondola && game.inv.gondola > 0 ? '<button class="btn solid" data-act="gon">Make gondola</button>' : ''}</div>`;
  } else {
    const can = game.served3(x);
    const lv = [0, 1, 2].slice(0, game.levelsOn);
    html = `<div class="t">${x.name}</div><div class="s">${lv.map(l => `${SYM[l]} ${can[l] ? 'can ski here' : '<b style="color:var(--red)">stuck</b>'}`).join('<br>')}<br>${game.crowd(x)} waiting</div>`;
  }
  pop.innerHTML = html; pop.hidden = false;
  const r = pop.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(innerWidth - r.width - 8, cx - r.width / 2)) + 'px';
  pop.style.top = (cy - r.height - 22 > 60 ? cy - r.height - 22 : cy + 22) + 'px';
  pop.querySelector('[data-act=rm]')?.addEventListener('click', () => removeEdge(x));
  pop.querySelector('[data-act=gon]')?.addEventListener('click', () => { game.upgradeLift(x); select(null); hint(`Lift ${x.no} is a gondola now`); tut?.on('gondola'); });
}
function removeEdge(e) { game.remove(e); select(null); snd.removed(); tut?.on('removed', e); }
function flash(id) { const el = $(id); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }

// ------------------------------------------------------------------ evening and closing
function evening(day) {
  mode = 'evening'; ui.nightTo = 1; select(null); ui.drag = null; ptr = null;
  snd.evening();
  setTimeout(() => {
    const opts = game.offer();
    $('eveK').textContent = `Evening · ${game.def.name}`;
    $('eveH').textContent = `Day ${day} is done`;
    $('eveS').textContent = `${game.served} skiers so far. The floodlights are on; pick one thing for tomorrow.`;
    const box = $('tickets'); box.innerHTML = '';
    const info = {
      lift: ['Lift pass', 'A new chairlift', 'One more lift to put anywhere on the mountain.', '<path d="M4 8 50 2M18 6v8M38 3v8" stroke="#1c2130" stroke-width="2"/><rect x="13" y="14" width="10" height="7" fill="#1c2130"/><rect x="33" y="11" width="10" height="7" fill="#1c2130"/>'],
      gondola: ['Upgrade', 'A gondola', 'Turns a lift into six-seat cabins: about three times the riders.', '<path d="M4 6 50 2" stroke="#1c2130" stroke-width="2"/><path d="M27 4v6" stroke="#1c2130" stroke-width="2"/><rect x="17" y="10" width="20" height="16" rx="2" fill="#cf3326"/>'],
      cable: ['Engineering', 'Longer cables', `Lifts can reach ${((game.liftMax + CFG.liftStep) * .005).toFixed(2)} km, up from ${(game.liftMax * .005).toFixed(2)}.`, '<path d="M2 20h50" stroke="#1c2130" stroke-width="2"/><path d="M2 14v12M52 14v12" stroke="#1c2130" stroke-width="2"/><path d="M36 10l8 10-8 0" fill="#cf3326"/>'],
    };
    for (const o of opts) {
      const [k, t, d, svg] = info[o];
      const b = document.createElement('button'); b.className = 'ticket';
      b.innerHTML = `<span class="k">${k}</span><span class="t">${t}</span><span class="d">${d}</span><svg viewBox="0 0 54 30">${svg}</svg>`;
      b.onclick = () => {
        game.take(o); $('evening').hidden = true; mode = 'play'; ui.nightTo = 0; snd.tap();
        flash(o === 'gondola' ? 'tGon' : 'tLift');
        if (o === 'gondola') hint('Tap the gondola button, then a busy lift', false, 3200);
        if (o === 'cable') hint('Lifts reach further now', false, 2400);
      };
      box.appendChild(b);
    }
    $('evening').hidden = false;
  }, 1500);
}

function closed(node) {
  mode = 'closed'; select(null); ui.drag = null; ptr = null;
  snd.closed();
  const id = game.def.id, prev = save.best[id] || 0;
  if (game.served > prev) { save.best[id] = game.served; store(); }
  setTimeout(() => {
    $('closedK').textContent = game.def.name;
    const lift = [...game.edges.values()].find(e => e.type === 'lift' && e.a === node.id);
    $('closedS').textContent = node.kind === 'lodge' ? `The crowd at ${node.name} got out of hand.` : lift ? `The queue for ${lift.gondola ? 'Gondola' : 'Lift'} ${lift.no} got out of hand.` : `Skiers were stranded where a run ended in the open.`;
    $('stServed').textContent = game.served; $('stDays').textContent = game.day; $('stBest').textContent = Math.max(prev, game.served);
    const nb = MOUNTAINS[mIndex + 1];
    $('closed').hidden = false;
    if (nb && prev < nb.unlock && game.served >= nb.unlock) hint(`${nb.name} is open now`, false, 4000);
  }, 1300);
}
$('closedAgain').onclick = () => start(mIndex);
$('closedMenu').onclick = () => showTitle();
$('closedLook').onclick = () => { $('closed').hidden = true; hint('Drag to look around. Tap to come back', false, 2600); };
$('tutBtn').onclick = () => { snd.init(); startTutorial(); };

// ------------------------------------------------------------------ the lessons
function startTutorial() {
  mode = 'tut';
  game = new Game({ mountain: TUTORIAL, seed: 2, tutorial: true });
  const lodge = game.addLodge({ x: 260, y: 890 }, 'Nursery Lodge');
  game.inv.lift = 2;
  enterGame();
  mode = 'tut';
  const r = view.rect, zz = Math.min(r.w / (330 * view.sc0), (r.h - 150) / (330 * view.sc0));
  if (zz > 1.15) { view.focus(285, 770, Math.min(document.body.classList.contains('wide') ? 1.7 : 2.4, zz)); fitBtn(); }
  const TOP = { x: 300, y: 690 };
  const liftFrom = () => [...game.edges.values()].find(e => e.type === 'lift' && e.a === lodge.id);
  const topNode = () => { const l = liftFrom(); return l ? game.nodes.get(l.b) : null; };
  const ghostRun = cls => { const t = topNode(); if (!t) return null; const p = findRun(game, t, lodge, cls) || findRun(game, t, lodge, cls, { wiggle: .5 }); return p ? { pts: p, col: LV[cls] } : null; };
  let spawnT = 0;
  const trickle = (dt, every, mix) => { spawnT += dt; if (spawnT > every) { spawnT = 0; if (game.crowd(lodge) < 6) game.spawnSkier(lodge, Math.random() < mix ? 1 : 0); } };
  const steps = [
    { text: 'Skiers are waiting at the lodge. <b>Drag from the lodge up the hill</b> to build a chairlift. Lifts are straight, and only go up.',
      enter() { for (let i = 0; i < 3; i++) game.spawnSkier(lodge, 0); ui.ghost = { pts: [[lodge.x, lodge.y], [TOP.x, TOP.y]], col: '#cf3326' }; },
      check: () => !!liftFrom() },
    { text: 'Now a way down. <b>Drag from the top station back down to the lodge</b> to cut a run. Runs only go downhill.',
      enter() { ui.ghost = ghostRun(0); },
      check: () => game.served3(lodge)[0] },
    { text: `Green ${SYM[0]} means easy: gentle all the way. Each skier rides up, skis <b>one run of their own colour</b>, then heads to a lodge. Watch them go.`,
      enter() { ui.ghost = null; },
      tick(dt) { trickle(dt, 1.4, 0); }, check: () => game.servedBy[0] >= 3 },
    { text: `A blue ${SYM[1]} skier wants something steeper. A run takes its colour from its <b>steepest pitch</b>. Switch on <b>Steepness</b> below to see the ground, then cut a blue run down.`,
      enter() { game.levelsOn = 2; ui.canV = -1; game.spawnSkier(lodge, 1); game.spawnSkier(lodge, 1); flash('tSteep'); ui.ghost = ghostRun(1); },
      tick(dt) { trickle(dt, 3, .4); if (!ui.ghost && topNode()) ui.ghost = ghostRun(1); }, check: () => game.servedBy[1] >= 1 },
    { text: 'A coach party! When more than 10 people wait in one place, a <b style="color:var(--red)">red ring</b> fills, and if it closes, so does the mountain. Here\'s a gondola: <b>tap Gondolas below, then tap your lift</b>.',
      enter() { ui.ghost = null; toggleSteep(false); game.inv.gondola = 1; for (let i = 0; i < 16; i++) game.spawnSkier(lodge, i % 3 === 0 ? 1 : 0); flash('tGon'); },
      tick() { lodge.ring = Math.min(lodge.ring, .9); }, check: () => game.crowd(lodge) <= 3 && [...game.edges.values()].some(e => e.gondola) },
    { text: `That's the job. <b>Tap any run or lift</b> to look at it or remove it. ${matchMedia('(pointer: coarse)').matches ? 'Pinch' : 'Scroll'} to zoom. New lodges keep opening, every evening you pick a new piece, and later experts ${SYM[2]} turn up wanting black runs.`,
      enter() { }, tick(dt) { trickle(dt, 2, .4); }, button: 'Open Hollin Fell' },
  ];
  tut = { i: -1, steps, lodge, wrong: false,
    on(kind, e) {
      const st = steps[this.i];
      if (kind === 'run' && this.i === 1 && e.cls !== 0) setCoach(`That one came out <b>${LVN[e.cls].toLowerCase()}</b>: somewhere it's steeper than greens like. Try the dashed line (cutting across the slope keeps it gentle), or tap your run and remove it.`);
      if (kind === 'run' && this.i === 3 && e.cls === 0) setCoach(`Still green: gentle the whole way. Find a <b>steeper pitch</b> (Steepness shows it) or follow the dashed line.`);
      if (kind === 'lift' && this.i === 0) { }
    },
  };
  const go = i => {
    tut.i = i; const st = steps[i];
    st.enter?.();
    setCoach(st.text, st.button);
  };
  tut.go = go;
  tut.tick = dt => {
    const st = steps[tut.i]; if (!st) return;
    st.tick?.(dt);
    if (st.check && st.check()) { tut.i < steps.length - 1 && go(tut.i + 1); snd.lodge(); }
  };
  $('coach').hidden = false;
  go(0);
}
function setCoach(text, button) {
  const i = tut.i, n = tut.steps.length;
  $('coachK').textContent = `Lesson ${i + 1} of ${n}`;
  $('coachP').innerHTML = text;
  $('coachGo').hidden = !button; if (button) $('coachBtn').textContent = button;
  $('coachDots').innerHTML = tut.steps.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('');
}
function endTutorial() { save.tut = true; store(); tut = null; $('coach').hidden = true; start(0); }
$('coachBtn').onclick = endTutorial;
$('coachSkip').onclick = endTutorial;

// ------------------------------------------------------------------ the loop
const DT = 1 / 30;
let acc = 0, last = performance.now(), lastCanT = 0, warned = new Set();
function frame(now) {
  requestAnimationFrame(frame);
  const real = Math.min(.1, (now - last) / 1000); last = now;
  ui.now = now / 1000;
  if (!HOLD) advance(real);
  draw();
}
function advance(real) {
  if (!game) return;
  const running = (mode === 'play' || mode === 'tut' || mode === 'demo') && speed > 0;
  if (running) {
    acc += real * speed;
    let n = 0;
    while (acc >= DT && n++ < 12) {
      if (bot) bot.tick(DT);
      game.step(DT); tut?.tick(DT);
      handleEvents();
      acc -= DT;
      if (mode !== 'play' && mode !== 'tut' && mode !== 'demo') { acc = 0; break; }
    }
  } else if (mode === 'title' && game) {
    // the title map: nothing moving, just there
  }
  ui.night += (ui.nightTo - ui.night) * Math.min(1, real * 2.2);
  ui.steepA += ((ui.steepOn ? .75 : 0) - ui.steepA) * Math.min(1, real * 8);
}
function handleEvents() {
  for (const ev of game.events) {
    if (ev.type === 'served') {
      view.fx.push({ kind: 'ring', x: ev.node.x, y: ev.node.y, col: LV[ev.lvl], t0: ui.now, dur: .6 });
      snd.served(ev.lvl);
      const s = $('score'); s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop');
    } else if (ev.type === 'built') {
      view.fx.push({ kind: 'built', pts: ev.edge.pts, t0: ui.now, dur: .7 }); snd.built(ev.edge.type);
    } else if (ev.type === 'lodge') {
      if (mode === 'play' && game.lodges().length > 1) { hint(`New lodge: <b>${ev.node.name}</b>`, false, 2600); snd.lodge(); }
    } else if (ev.type === 'newLevel') {
      if (mode === 'play') hint(ev.lvl === 1 ? `Blue ${SYM[1]} skiers are here. They want a run with a steeper pitch` : `Experts ${SYM[2]} have arrived. They want black runs`, false, 5000);
      ui.canV = -1;
    } else if (ev.type === 'dayEnd' && mode === 'play') { evening(ev.day); }
    else if (ev.type === 'over' && mode === 'play') { closed(ev.node); }
  }
  game.events.length = 0;
  for (const n of game.nodes.values()) {
    if (n.ring > .5 && !warned.has(n.id)) { warned.add(n.id); snd.warn(); }
    if (n.ring === 0) warned.delete(n.id);
  }
}
function draw() {
  if (!game) return;
  if (game.version !== ui.canV || ui.now - lastCanT > 1) {
    ui.canV = game.version; lastCanT = ui.now; ui.can.clear();
    for (const n of game.lodges()) ui.can.set(n.id, game.served3(n));
  }
  view.draw(game, ui);
  if (mode === 'play' || mode === 'tut' || mode === 'demo' || mode === 'evening' || mode === 'closed') {
    $('dayn').textContent = mode === 'tut' ? 'Lessons' : `Day ${game.day}`;
    $('sun').firstElementChild.style.width = (mode === 'tut' ? 0 : game.dayT / CFG.dayLen * 100) + '%';
    $('served').textContent = game.served;
    $('nLift').textContent = game.inv.lift; $('nGon').textContent = game.inv.gondola;
    $('tGon').disabled = game.inv.gondola < 1 && !ui.arm;
  }
}

// ------------------------------------------------------------------ go
await document.fonts?.ready;
if (DEMO) {
  document.body.classList.add('demo');
  mode = 'demo';
  game = new Game({ mountain: MOUNTAINS[0], seed: +(qs.get('seed') || 7) });
  bot = new Bot(game);
  for (let i = 0; i < 250 * 30; i++) { bot.tick(DT); game.step(DT); for (const ev of game.events) if (ev.type === 'dayEnd') game.take(bot.pick(game.offer())); game.events.length = 0; }
  enterGame(); mode = 'demo';
  // frame the built-up part of the mountain
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (const n of game.nodes.values()) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); }
  const r = view.rect, z = Math.min(r.w / ((x1 - x0 + 120) * view.sc0), r.h / ((y1 - y0 + 120) * view.sc0), 2);
  view.focus((x0 + x1) / 2, (y0 + y1) / 2 + 10, Math.max(1, z));
  $('legend').hidden = true;
} else if (qs.has('tut')) startTutorial();
else if (qs.has('m')) start(+qs.get('m') || 0);
else showTitle();
layout();
if (DEBUG) {
  window.cl = {
    get g() { return game; }, view, ui, bot: () => bot, snd, start, startTutorial, get tut() { return tut; },
    ff(sec) { for (let i = 0; i < sec * 30; i++) { if (bot) bot.tick(DT); game.step(DT); tut?.tick(DT); handleEvents(); if (mode !== 'play' && mode !== 'tut' && mode !== 'demo') break; } draw(); },
    autobot() { bot = new Bot(game); }, draw,
  };
}
requestAnimationFrame(frame);
window.toyboxReady?.();
