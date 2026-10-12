// Crossfire: wiring. Front page, planning, the pass screen, playing out the round, and the four-panel lesson.
// ?demo lets two CPUs fight for the preview shot; ?debug exposes window.cf (with ?hold to step by hand).
import { Game, W, H, DT, HEAD_Y, MOVE_RANGE, WEAPONS, WEAPON_KEYS, rng, clamp } from './game.js';
import { planFor, CPUS } from './ai.js';
import { Renderer, INK, RED, PAPER } from './render.js';
import { Sound } from './sound.js';

const qs = new URLSearchParams(location.search);
const DEMO = qs.has('demo'), DEBUG = qs.has('debug');
let hold = qs.has('hold');
const SPEED = Math.max(1, +qs.get('speed') || 1);
const $ = id => document.getElementById(id);
const view = new Renderer($('field'));
const sound = new Sound();

const KEY = 'crossfire.v1';
let save = { lesson: false, muted: false, record: {} };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY)) || {}); } catch {}
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} };
sound.muted = save.muted;

// ---------- match state
let M = null;          // { game, kind: 'cpu'|'hot'|'lesson'|'demo', cpu, human: [bool,bool], r }
let mode = 'front';    // front | plan | pass | resolve | over | pause
let planTeam = 0, ui = null, endT = 0, slowT = 0, pausedFrom = null, lastPan = 0;
const memory = {};     // last aim per soldier, so each turn starts where you left off

const pages = ['front', 'pass', 'over', 'pause', 'lessonDone'];
function showPage(id) { for (const p of pages) $(p).hidden = p !== id; }
function setMode(m) {
  mode = m;
  const field = m === 'plan' || m === 'resolve' || m === 'pause' || m === 'over';
  $('hud').hidden = !field && m !== 'pass';
  $('tray').hidden = !field || M?.kind === 'demo';
  $('tray').classList.toggle('watch', m !== 'plan');
  if (m === 'front' || m === 'pass' || m === 'over' || m === 'pause') showPage(m); else showPage(null);
  if (m === 'front') { $('caption').hidden = true; renderFront(); }
  layout();
}

// ---------- layout
function layout() {
  const hud = $('hud').hidden ? 0 : $('hud').getBoundingClientRect().height;
  const tray = $('tray').hidden ? 0 : $('tray').getBoundingClientRect().height;
  view.insets = { top: hud, bottom: tray };
  view.resize();
}
addEventListener('resize', () => { layout(); if (ui) refreshPlan(); });

// ---------- front page
function renderFront() {
  const d = new Date();
  $('dateL').textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · Late edition';
  $('startHere').hidden = save.lesson;
  $('lessonBtn').classList.toggle('ring', !save.lesson);
  const list = $('cpuList');
  list.innerHTML = '';
  for (const c of Object.values(CPUS)) {
    const b = document.createElement('button');
    b.className = 'btn';
    const rec = save.record[c.id];
    b.innerHTML = `<b>${c.name}</b><small>${c.blurb}${rec ? ` · You ${rec.w}–${rec.l}` : ''}</small>`;
    b.onclick = () => startMatch('cpu', c.id);
    list.appendChild(b);
  }
  $('soundBtn').textContent = 'Sound: ' + (save.muted ? 'off' : 'on');
  drawArt();
}

function drawArt() {
  const cv = $('art'), ctx = cv.getContext('2d');
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = 820, h = 250;
  cv.width = w * dpr; cv.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, w, h);
  // sky dots
  ctx.fillStyle = view.dotPats[2]; ctx.globalAlpha = .5; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
  // two hills
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 10) ctx.lineTo(x, 190 - Math.cos(x / w * Math.PI * 2) * 34 + Math.sin(x * .03) * 4);
  ctx.lineTo(w, h); ctx.closePath();
  ctx.fillStyle = '#e6d9b8'; ctx.fill(); ctx.fillStyle = view.hatch.p; ctx.globalAlpha = .5; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.save(); ctx.scale(1.6, 1.6);
  view.body(ctx, 90 / 1.6, 160 / 1.6, 0, 1, 0, .75, false);
  view.body(ctx, 730 / 1.6, 160 / 1.6, 1, -1, 0, Math.PI - .75, false);
  ctx.restore();
  // two shells meeting
  const mid = { x: 410, y: 70 };
  const n = 22, pts = [];
  for (let i = 0; i < n; i++) pts.push(i % 2 ? .5 : .95 + (i % 4 ? .2 : 0));
  ctx.save(); ctx.translate(mid.x, mid.y);
  ctx.beginPath(); pts.forEach((q, i) => { const a = i / n * 6.283; ctx.lineTo(Math.cos(a) * 58 * q, Math.sin(a) * 46 * q); }); ctx.closePath();
  ctx.fillStyle = RED; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); pts.forEach((q, i) => { const a = i / n * 6.283; ctx.lineTo(Math.cos(a) * 30 * q, Math.sin(a) * 24 * q); }); ctx.closePath();
  ctx.fillStyle = PAPER; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  ctx.setLineDash([6, 8]); ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.moveTo(120, 128); ctx.quadraticCurveTo(250, 20, 360, 66); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(700, 128); ctx.quadraticCurveTo(570, 20, 460, 66); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = "44px 'Bowlby One SC', sans-serif"; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  ctx.save(); ctx.translate(410, 168); ctx.rotate(-.06);
  ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.strokeText('KA-BLAM!', 0, 0);
  ctx.fillStyle = INK; ctx.fillText('KA-BLAM!', 3, 3); ctx.fillStyle = RED; ctx.fillText('KA-BLAM!', 0, 0);
  ctx.restore();
}

// ---------- starting things
function startMatch(kind, cpuId = 'sneaky') {
  sound.init();
  const seed = DEMO ? 7 : (Math.random() * 1e9) | 0;
  const names = kind === 'hot' ? [['Red Pickles', 'Red Dunk', 'Red Mabel'], ['Ink Mugsy', 'Ink Fitch', 'Ink Biscuit']] : undefined;
  M = { kind, cpu: CPUS[cpuId], cpuId, game: new Game({ seed, names }), r: rng(seed ^ 0x51ed), human: [kind !== 'demo', kind === 'hot'] };
  resetView();
  beginRound();
}
function resetView() {
  view.fx = []; view.words = []; view.balloons = []; view.puffs = []; view.bits = []; view.ripples = [];
  view.terrainSeen = -1; view.zoomPulse = 1;
  for (const k in memory) delete memory[k];
  endT = 0; slowT = 0;
  const g = M.game;
  const s = g.active(0);
  view.camGoal = { x: s.x, y: s.y - 120 };
  view.cam.x = view.camGoal.x; view.cam.y = view.camGoal.y;
}

function beginRound() {
  const g = M.game;
  ui = null;
  if (M.kind === 'lesson') lesson.roundStart();
  // computer generals plan now, blind to whatever you're about to do
  for (const t of [0, 1]) if (!M.human[t] && !(M.kind === 'lesson' && t === 1)) g.setPlan(t, planFor(g, t, M.cpu, M.r));
  if (M.kind === 'demo' && g.round === 1) demoOpening(g);
  updateHud();
  const first = M.human.indexOf(true);
  if (first < 0) { setMode('resolve'); g.beginResolve(); return; }
  if (M.kind === 'hot') { planTeam = 0; showPass(0); return; }
  startPlanning(first);
}

function startPlanning(team) {
  planTeam = team;
  const g = M.game, s = g.active(team);
  const mem = memory[s.id] || {};
  const foes = g.alive(1 - team);
  const near = foes.reduce((a, f) => (!a || Math.abs(f.x - s.x) < Math.abs(a.x - s.x) ? f : a), null);
  const dir = near && near.x < s.x ? -1 : 1;
  const allowed = M.kind === 'lesson' ? lesson.allowed() : WEAPON_KEYS;
  let weapon = mem.weapon && g.teams[team].ammo[mem.weapon] > 0 && allowed.includes(mem.weapon) && mem.weapon !== 'shield' ? mem.weapon : allowed.find(w => g.teams[team].ammo[w] > 0);
  ui = {
    team, who: s.id, moveX: s.x, weapon,
    angle: mem.angle ?? (dir > 0 ? 0.85 : Math.PI - 0.85), power: mem.power ?? .62,
    targetX: near ? near.x : W / 2, touched: false, allowed,
  };
  refreshPlan();
  setMode('plan');
  frameOn(s, near);
  syncTray();
  if (M.kind !== 'lesson') caption(roundCaption());
}

// Frame your soldier and the nearest enemy; if they don't both fit, keep yours on screen and lean toward them.
function frameOn(s, near) {
  if (view.fitAll) { view.camGoal = { x: W / 2, y: H / 2 }; return; }
  const half = Math.max(0, view.visW() / 2 - 160 / view.cam.s);   // room to pull back behind your soldier
  let x = near ? (s.x + near.x) / 2 : s.x;
  x = clamp(x, s.x - half, s.x + half);
  view.camGoal = { x, y: near ? (s.y + near.y) / 2 - 90 : s.y - 110 };
}

function refreshPlan() {
  if (!ui) return;
  const g = M.game, s = g.soldiers[ui.who];
  ui.ghost = g.walkPreview(s, ui.moveX);
  if (ui.weapon === 'shell' || ui.weapon === 'grenade') {
    const tr = g.trace(ui.weapon, ui.ghost.x, ui.ghost.y, ui.angle, ui.power, ui.weapon === 'grenade' ? .55 : .5, 3);
    ui.trace = tr.pts;
  } else ui.trace = null;
  hint();
}

function lockIn() {
  if (mode !== 'plan' || !ui) return;
  const g = M.game;
  sound.stamp();
  memory[ui.who] = { angle: ui.angle, power: ui.power, weapon: ui.weapon };
  g.setPlan(ui.team, { moveX: ui.moveX, weapon: ui.weapon, angle: ui.angle, power: ui.power, targetX: ui.targetX });
  if (M.kind === 'lesson') lesson.locked(ui);
  ui = null;
  if (M.kind === 'hot' && planTeam === 0) { showPass(1); return; }
  if (M.kind === 'hot') { showPass(2); return; }
  goResolve();
}
function goResolve() {
  ui = null;
  setMode('resolve');
  $('hint').textContent = '';
  if (M.kind !== 'lesson') caption(null);
  M.game.beginResolve();
}

// ---------- pass-and-play
function showPass(step) {
  const g = M.game;
  $('passRound').textContent = 'Round ' + g.round;
  if (step === 0) {
    $('passHead').textContent = 'Red, your turn';
    $('passEyes').textContent = 'Ink general: look away while Red makes a plan.';
    $('passBtnText').textContent = "I'm the Red general";
  } else if (step === 1) {
    $('passHead').textContent = 'Pass the phone to Ink';
    $('passEyes').textContent = 'Red general: look away. No peeking at the plans.';
    $('passBtnText').textContent = "I'm the Ink general";
  } else {
    $('passHead').textContent = 'Both plans are in';
    $('passEyes').textContent = 'Put the phone where you can both see it.';
    $('passBtnText').textContent = 'Watch it play out';
  }
  $('passGo').onclick = () => { sound.init(); sound.tick(); step === 2 ? goResolve() : startPlanning(step); };
  setMode('pass');
}

// ---------- captions and hints
function caption(html) {
  const c = $('caption');
  if (!html) { c.hidden = true; return; }
  c.innerHTML = html; c.hidden = false;
}
const windWord = w => { const a = Math.abs(w); return a < 5 ? 'Calm' : a < 35 ? 'Breezy' : a < 75 ? 'Stiff' : 'Gale'; };
function roundCaption() {
  const g = M.game, me = g.soldiers[ui.who], them = g.active(1 - ui.team);
  const theirs = M.kind === 'hot' ? (ui.team ? 'Red' : 'Ink') : M.cpu.name;
  const tide = g.round >= 10 ? ' <em>The tide is coming in.</em>' : '';
  const lead = g.round === 1 && M.kind === 'cpu'
    ? `<span class="k">Round 1 · ${M.cpu.name}</span><b>${me.name}</b> is up. Across the way, ${them.name} is planning too.`
    : `<span class="k">Round ${g.round}${M.kind === 'hot' ? ' · ' + (ui.team ? 'Ink' : 'Red') + ' plans' : ''}</span><b>${me.name}</b> is up. ${theirs}'s <b>${them.name}</b> moves at the same time.`;
  return lead + tide;
}
function hint() {
  if (!ui) return;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const h = {
    shell: coarse ? 'Drag back from your soldier to aim · tap the ground to walk' : 'Drag back from your soldier to aim · click the ground to walk · ← → ↑ ↓ to fine-tune',
    grenade: coarse ? 'Drag back to throw · it bounces, then goes off' : 'Drag back to throw · it bounces, then goes off · ← → ↑ ↓ to fine-tune',
    mortar: coarse ? 'Tap where it should land next round · use walk to move' : 'Click where it should land next round · ← → nudge the X · A D to walk',
    shield: 'A bubble that stops one blast. You won\'t fire this round.',
  }[ui.weapon];
  $('hint').textContent = h;
}

function updateHud() {
  const g = M.game;
  $('roundTag').textContent = 'Round ' + g.round;
  $('windWord').textContent = windWord(g.wind);
  const k = Math.min(1, Math.abs(g.wind) / 110);
  $('windArrow').setAttribute('transform', Math.abs(g.wind) < 5 ? 'translate(22 11) scale(.15 1) translate(-22 -11)' : `translate(22 11) scale(${(g.wind > 0 ? 1 : -1) * (.5 + k * .5)} 1) translate(-22 -11)`);
  for (const [team, id] of [[0, 'redTally'], [1, 'inkTally']]) {
    const list = g.soldiers.filter(s => s.team === team);
    $(id).innerHTML = (team ? 'INK ' : 'RED ') + list.map(s => `<i class="${s.alive ? 'on' : 'off'}"></i>`).join('');
  }
  $('wind').setAttribute('aria-label', 'Wind ' + windWord(g.wind));
}

function syncTray() {
  const g = M.game, team = ui ? ui.team : 0, ammo = g.teams[team].ammo;
  for (const b of document.querySelectorAll('.wpn')) {
    const w = b.dataset.w;
    b.classList.toggle('on', ui?.weapon === w);
    const left = ammo[w];
    b.querySelector('small').textContent = left === Infinity ? '∞' : left;
    b.disabled = !(left > 0) || (ui && !ui.allowed.includes(w));
  }
}

// ---------- input
for (const b of document.querySelectorAll('.wpn')) b.onclick = () => pickWeapon(b.dataset.w);
function pickWeapon(w) {
  if (mode !== 'plan' || !ui) return;
  const g = M.game;
  if (!(g.teams[ui.team].ammo[w] > 0) || !ui.allowed.includes(w)) return;
  ui.weapon = w; sound.tick();
  refreshPlan(); syncTray();
  if (M.kind === 'lesson') lesson.changed(ui, 'weapon');
}
$('lock').onclick = lockIn;

let walkTimer = null;
function walkHold(dir, btn) {
  const go = () => { if (mode === 'plan' && ui) { const s = M.game.soldiers[ui.who]; ui.moveX = clamp(ui.moveX + dir * 2.5, s.x - MOVE_RANGE, s.x + MOVE_RANGE); refreshPlan(); if (M.kind === 'lesson') lesson.changed(ui, 'move'); } };
  const stop = () => { clearInterval(walkTimer); walkTimer = null; btn.classList.remove('held'); };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); go(); btn.classList.add('held'); clearInterval(walkTimer); walkTimer = setInterval(go, 30); btn.setPointerCapture?.(e.pointerId); });
  btn.addEventListener('pointerup', stop); btn.addEventListener('pointercancel', stop); btn.addEventListener('lostpointercapture', stop);
}
walkHold(-1, $('walkL')); walkHold(1, $('walkR'));

const cv = $('field');
let drag = null;
const dragMax = () => clamp(Math.min(innerWidth, innerHeight) * .32, 110, 190);
cv.addEventListener('pointerdown', e => {
  sound.init();
  if (mode !== 'plan' && mode !== 'resolve') return;
  cv.setPointerCapture?.(e.pointerId);
  const sx = e.clientX, sy = e.clientY;
  // the minimap jumps the camera
  const mm = view.mini;
  if (mm && view.canPan() && sx >= mm.x && sx <= mm.x + mm.w && sy >= mm.y && sy <= mm.y + mm.h) {
    const wx = (sx - mm.x) / mm.w * W, wy = H * .3 + (sy - mm.y) / mm.h * H * .7;
    view.camGoal = { x: wx, y: wy }; lastPan = performance.now();
    drag = { kind: 'mini' }; return;
  }
  if (mode === 'plan' && ui && (ui.weapon === 'shell' || ui.weapon === 'grenade')) {
    const head = view.toScreen(ui.ghost.x, ui.ghost.y - HEAD_Y);
    const reach = Math.max(54, 34 * view.cam.s + 26);
    if (Math.hypot(sx - head.x, sy - head.y) < reach) { drag = { kind: 'aim', id: e.pointerId }; aimTo(sx, sy); return; }
  }
  drag = { kind: 'maybe', x0: sx, y0: sy, lx: sx, ly: sy, t0: performance.now(), id: e.pointerId };
});
cv.addEventListener('pointermove', e => {
  if (!drag || (drag.id != null && drag.id !== e.pointerId)) return;
  const sx = e.clientX, sy = e.clientY;
  if (drag.kind === 'aim') { aimTo(sx, sy); return; }
  if (drag.kind === 'mini') return;
  if (drag.kind === 'maybe' && Math.hypot(sx - drag.x0, sy - drag.y0) > 9) drag.kind = view.canPan() ? 'pan' : 'none';
  if (drag.kind === 'pan') {
    const s = view.cam.s * view.zoomPulse;
    view.camGoal.x -= (sx - drag.lx) / s; view.camGoal.y -= (sy - drag.ly) / s;
    view.clampCam(view.camGoal);
    view.cam.x = view.camGoal.x; view.cam.y = view.camGoal.y;
    lastPan = performance.now();
  }
  drag.lx = sx; drag.ly = sy;
});
const endDrag = e => {
  if (!drag) return;
  if (drag.kind === 'maybe' && mode === 'plan' && ui) tapAt(e.clientX, e.clientY);
  if (drag.kind === 'aim' && M.kind === 'lesson') lesson.changed(ui, 'aim');
  drag = null;
};
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', () => { drag = null; });

function aimTo(sx, sy) {
  if (!ui) return;
  const head = view.toScreen(ui.ghost.x, ui.ghost.y - HEAD_Y);
  const dx = sx - head.x, dy = sy - head.y, len = Math.hypot(dx, dy);
  if (len < 14) return;
  ui.angle = Math.atan2(dy, -dx);
  ui.power = clamp((len - 14) / dragMax(), .08, 1);
  ui.touched = true;
  refreshPlan();
}
function tapAt(sx, sy) {
  const g = M.game, s = g.soldiers[ui.who], w = view.toWorld(sx, sy);
  if (ui.weapon === 'mortar') {
    ui.targetX = clamp(w.x, 10, W - 10); sound.tick(); refreshPlan();
    if (M.kind === 'lesson') lesson.changed(ui, 'target');
    return;
  }
  if (Math.abs(w.x - s.x) <= MOVE_RANGE + 40 && w.y > s.y - 160) {
    ui.moveX = clamp(w.x, s.x - MOVE_RANGE, s.x + MOVE_RANGE);
    sound.tick(); refreshPlan();
    if (M.kind === 'lesson') lesson.changed(ui, 'move');
  }
}

addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (mode === 'pause') resume(); else if (mode === 'plan' || mode === 'resolve') pause(); return; }
  if (mode !== 'plan' || !ui) return;
  const g = M.game, s = g.soldiers[ui.who];
  const fine = e.shiftKey ? .25 : 1;
  let changed = null;
  if (e.key >= '1' && e.key <= '4') { pickWeapon(WEAPON_KEYS[+e.key - 1]); e.preventDefault(); return; }
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lockIn(); return; }
  if (e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D') {
    ui.moveX = clamp(ui.moveX + (e.key.toLowerCase() === 'a' ? -4 : 4), s.x - MOVE_RANGE, s.x + MOVE_RANGE); changed = 'move';
  } else if (ui.weapon === 'mortar' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    ui.targetX = clamp(ui.targetX + (e.key === 'ArrowLeft' ? -8 : 8) * fine, 10, W - 10); changed = 'target';
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    // left/right swing the barrel toward that side
    const toward = e.key === 'ArrowLeft' ? Math.PI : 0;
    const d = Math.atan2(Math.sin(toward - ui.angle), Math.cos(toward - ui.angle));
    ui.angle += Math.sign(d) * .02 * fine; changed = 'aim';
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    ui.power = clamp(ui.power + (e.key === 'ArrowUp' ? .01 : -.01) * fine, .08, 1); changed = 'aim';
  }
  if (changed) {
    e.preventDefault(); ui.touched = true; refreshPlan();
    if (changed !== 'aim' || true) { const p = view.toScreen(ui.ghost.x, ui.ghost.y); if (p.x < 40 || p.x > innerWidth - 40) view.camGoal.x = ui.ghost.x; }
    if (M.kind === 'lesson') lesson.changed(ui, changed);
  }
});

// ---------- pause and pages
$('pauseBtn').onclick = pause;
function pause() { if (mode !== 'plan' && mode !== 'resolve') return; pausedFrom = mode; $('pauseRound').textContent = 'Round ' + M.game.round; syncSound(); setMode('pause'); }
function resume() { setMode(pausedFrom || 'plan'); if (pausedFrom === 'plan') syncTray(); }
$('resumeBtn').onclick = resume;
$('quitBtn').onclick = () => { M = null; ui = null; setMode('front'); };
const toggleSound = () => { save.muted = !save.muted; sound.muted = save.muted; store(); syncSound(); if (!save.muted) { sound.init(); sound.tick(); } };
function syncSound() { $('soundBtn').textContent = $('soundBtn2').querySelector('b').textContent = 'Sound: ' + (save.muted ? 'off' : 'on'); }
$('soundBtn').onclick = toggleSound; $('soundBtn2').onclick = toggleSound;
$('lessonBtn').onclick = () => startLesson();
$('hotBtn').onclick = () => startMatch('hot');
$('againBtn').onclick = () => M.kind === 'lesson' ? startLesson() : startMatch(M.kind, M.cpuId);
$('frontBtn').onclick = () => { M = null; setMode('front'); };
$('graduateFight').onclick = () => { $('lessonDone').hidden = true; startMatch('cpu', 'sneaky'); };
$('graduateFront').onclick = () => { $('lessonDone').hidden = true; M = null; setMode('front'); };

// ---------- the end of a match
function showOver() {
  const g = M.game, w = g.winner;
  let stamp = 'EXTRA!', head, quote;
  const cpu = M.cpu?.name;
  if (M.kind === 'hot') {
    head = w === 'draw' ? 'Both armies lost at sea' : w === 0 ? 'Red holds the hill!' : 'Ink takes the hill!';
    quote = w === 'draw' ? '“Nobody won. The seagulls are delighted.”' : `“${w === 0 ? 'Ink' : 'Red'} demands a rematch,” say sources close to the phone.`;
  } else {
    if (w === 0) { head = `Red routs ${cpu}!`; quote = winQuote(M.cpuId); }
    else if (w === 1) { head = `${cpu} takes the hill`; stamp = 'DEFEAT'; quote = loseQuote(M.cpuId); }
    else { head = 'Both armies lost at sea'; quote = '“A draw,” the harbour master confirms. “Again.”'; }
    const rec = save.record[M.cpuId] || { w: 0, l: 0 };
    if (w === 0) rec.w++; else if (w === 1) rec.l++;
    save.record[M.cpuId] = rec; store();
  }
  $('overStamp').textContent = stamp;
  $('overHead').textContent = head;
  $('overQuote').textContent = quote;
  $('overRound').textContent = `After ${g.round} round${g.round > 1 ? 's' : ''}`;
  const t = M.kind === 'hot' ? null : 0;
  const shots = t == null ? g.stats.shots[0] + g.stats.shots[1] : g.stats.shots[0];
  const hits = t == null ? g.stats.hits[0] + g.stats.hits[1] : g.stats.hits[0];
  $('overStats').innerHTML = [[g.round, 'Rounds'], [shots, t == null ? 'Shots fired' : 'Your shots'], [hits, t == null ? 'Hits' : 'Your hits'], [g.stats.midair, 'Mid-air']]
    .map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('');
  $('againSmall').textContent = M.kind === 'hot' ? 'Red vs Ink, new ground' : `${cpu} again, new ground`;
  setMode('over');
}
const winQuote = id => ({ cautious: '“I was being careful,” Col. Pomfrey told reporters from inside a bubble.', reckless: '“Rematch. Now. RIGHT NOW,” said Rita Ruckus.', sneaky: '“I knew you\'d go left,” said Sid the Fox. You went right.' })[id];
const loseQuote = id => ({ cautious: '“Slow and steady,” said Col. Pomfrey, adjusting his helmet.', reckless: '“HA!” said Rita Ruckus, to everyone, for an hour.', sneaky: '“You always run the same way,” Sid the Fox observed.' })[id];

// ---------- the lesson: four panels against Pvt. Mugsy
const lesson = {
  i: 0, sub: 0, dir: 1,
  steps: ['aim', 'dodge', 'lead', 'mortar'],
  allowed() { return this.steps[this.i] === 'mortar' ? (this.sub === 0 ? ['mortar'] : ['shell']) : ['shell']; },
  roundStart() {
    const g = M.game, me = g.soldiers[0], him = g.soldiers[1];
    for (const s of g.soldiers) { s.hp = 80; }
    g.wind = this.steps[this.i] === 'lead' ? 14 : 0;
    g.teams[0].ammo.mortar = 2;
    const step = this.steps[this.i];
    let plan = { weapon: 'wait', moveX: him.x };
    view.lessonHint = null;
    if (step === 'dodge') {
      const p = planFor(g, 1, LESSON_CPU, M.r, { perfect: true, shellOnly: true, stay: true });
      plan = { ...p, moveX: him.x };
      const tr = g.trace('shell', him.x, him.y, p.angle, p.power, 6, 1);
      view.lessonHint = { who: 1, trace: tr.pts };
    } else if (step === 'lead') {
      // he paces back and forth, and the lesson shows you where he's headed
      if (him.x > this.home + 40) this.dir = -1; else if (him.x < this.home - 40) this.dir = 1;
      const tx = him.x + this.dir * 70;
      plan = { weapon: 'wait', moveX: tx };
      view.lessonHint = { who: 1, ghost: g.walkPreview(him, tx) };
    }
    g.setPlan(1, plan);
    this.hurtMe = false; this.hurtHim = false; this.mortarLanded = false;
  },
  text() {
    const step = this.steps[this.i], n = `<span class="k">Lesson ${this.i + 1} of 4 · ${['Aim', 'Dodge', 'Lead', 'Mortar'][this.i]}</span>`;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const tap = coarse ? 'Tap' : 'Click';
    if (step === 'aim') {
      if (this.sub === 0) return n + `This is <b>Pvt. Pickles</b>. <em>Drag back from him</em> to aim, like a slingshot. The further you pull, the harder he fires.`;
      if (this.sub === 1) return n + `The dots show how the shot starts out. Over the hill is <b>Pvt. Mugsy</b>, standing still. When it looks right, press <em>LOCK IN!</em>`;
      if (this.sub === 2) return n + `Missed! Nudge your aim and lock in again. Pulling further back sends it further.`;
    }
    if (step === 'dodge') {
      if (this.sub === 0) return n + `Here's the twist: you <b>both</b> move and fire at the same moment. The red dashes are Mugsy's shot. It's aimed where you're standing now. <em>${tap} the ground</em> to walk out of the way, then lock in.`;
      if (this.sub === 1) return n + `Ouch. He hit the spot you stood on. Walk further this time: ${tap.toLowerCase()} the ground a little way off, then lock in.`;
    }
    if (step === 'lead') {
      if (this.sub === 0) return n + `Now Mugsy dodges too. You won't usually know where he's going, but for now the grey ghost shows it. <em>Aim where he'll be</em>, not where he is.`;
      if (this.sub === 1) return n + `Missed. Remember: he moves while your shell is in the air. Aim at the ghost.`;
    }
    if (step === 'mortar') {
      if (this.sub === 0) return n + `This round you've got the <em>MORTAR</em>. ${tap} right on Mugsy to put the X there. It lands <b>next round</b>, and everyone can see the X coming. Use it to chase people out of a good spot.`;
      if (this.sub === 1) return n + `It's in the air. Mugsy's having a nap, so lock in a shot and watch it come down.`;
    }
    return n;
  },
  show() { caption(this.text()); },
  changed(u, what) {
    const step = this.steps[this.i];
    if (step === 'aim' && this.sub === 0 && what === 'aim') { this.sub = 1; this.show(); }
    if (step === 'mortar' && this.sub === 0 && what === 'weapon' && u.weapon === 'mortar') this.show();
  },
  locked() {},
  resolved(events) {
    const step = this.steps[this.i];
    for (const e of events) {
      if (e.type === 'hurt' && e.who === 0) this.hurtMe = true;
      if (e.type === 'hurt' && e.who === 1) this.hurtHim = true;
    }
    let pass = false;
    if (step === 'aim') { if (this.hurtHim) pass = true; else this.sub = 2; }
    else if (step === 'dodge') { if (!this.hurtMe) pass = true; else this.sub = 1; }
    else if (step === 'lead') { if (this.hurtHim) pass = true; else this.sub = 1; }
    else if (step === 'mortar') {
      if (this.sub === 0) { this.sub = M.game.mortars.length ? 1 : 0; }
      else if (!M.game.mortars.length) pass = true;
    }
    return pass;
  },
  next() {
    this.i++; this.sub = 0;
    if (this.i >= this.steps.length) {
      save.lesson = true; store();
      M.game.phase = 'over';
      view.lessonHint = null;
      caption(null);
      setMode('over'); showPage('lessonDone');
      sound.bugle(true);
      return false;
    }
    // put everyone back on their marks for the next panel
    const g = M.game;
    for (const s of g.soldiers) { s.alive = true; s.drowned = false; s.hp = 80; s.vx = s.vy = 0; s.x = s.id ? this.home : 330; s.y = g.surface(s.x); s.grounded = true; s.shield = false; }
    return true;
  },
};
const LESSON_CPU = { aim: 0, pow: 0, lead: 0, shield: 0, mortar: 0, grenade: 0, move: 'cover' };

function startLesson() {
  sound.init();
  const seed = 4242;
  const layout = [[330], [1000]];
  M = { kind: 'lesson', cpu: LESSON_CPU, game: new Game({ seed, shape: 'valley', teamSize: 1, layout, names: [['Pvt. Pickles'], ['Pvt. Mugsy']] }), r: rng(99), human: [true, false] };
  M.game.immortal = true;
  lesson.i = 0; lesson.sub = 0; lesson.dir = 1; lesson.home = 1000;
  resetView();
  beginRound();
  lesson.show();
}

// For the preview: the first round opens with two shells meeting in the air.
function demoOpening(g) {
  const a = g.active(0), b = g.active(1);
  const pa = planFor(g, 0, M.cpu, M.r, { shellOnly: true, stay: true, perfect: true });
  pa.moveX = a.x;
  const ta = g.trace('shell', a.x, a.y, pa.angle, pa.power, 5, 1).pts;
  let best = null;
  for (let deg = 100; deg <= 170; deg += 1) for (let p = .3; p <= 1; p += .01) {
    const tb = g.trace('shell', b.x, b.y, deg * Math.PI / 180, p, 5, 1).pts;
    for (let i = 50; i < Math.min(ta.length, tb.length); i++) {
      const d = Math.hypot(ta[i].x - tb[i].x, ta[i].y - tb[i].y);
      if (d < 8 && (!best || Math.abs(i - 118) < Math.abs(best.i - 118))) best = { angle: deg * Math.PI / 180, power: p, i };
    }
  }
  g.setPlan(0, pa);
  if (best) g.setPlan(1, { moveX: b.x, weapon: 'shell', angle: best.angle, power: best.power });
}

// ---------- the loop
let last = performance.now(), acc = 0, roundEvents = [];
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (M) {
    const g = M.game;
    let fxScale = 1;
    if (mode === 'resolve' && !hold) {
      let scale = SPEED;
      if (slowT > 0) { slowT -= dt; scale *= .3; fxScale = .45; }
      acc += dt * scale;
      let n = 0;
      while (acc >= DT && n++ < 40 * SPEED) { acc -= DT; g.step(); drain(g); if (g.phase !== 'resolve') break; }
      if (g.phase === 'plan') roundOver();
      else if (g.phase === 'over' && !endT) { endT = 1.4; }
    }
    if (endT > 0 && mode === 'resolve') { endT -= dt; if (endT <= 0) { if (M.kind === 'demo') startMatch('demo'); else if (M.kind !== 'lesson') showOver(); } }
    view.zoomPulse += ((slowT > 0 ? 1.25 : 1) - view.zoomPulse) * Math.min(1, dt * 5);
    if (mode === 'resolve') followAction(g);
    const showEnemy = M.kind === 'lesson' && mode === 'plan';
    view.draw(g, {
      plan: mode === 'plan' && ui ? { ...ui, who: ui.who } : null,
      grabRing: mode === 'plan' && ui && !ui.touched,
      activeIds: mode === 'plan' ? [g.active(0)?.id, g.active(1)?.id] : [],
      aims: aimsFor(g),
      enemyHint: showEnemy ? view.lessonHint : null,
      offscreen: true, minimap: mode === 'plan' || mode === 'resolve',
      hideMortarOf: null,
    }, dt, dt * fxScale);
  }
  requestAnimationFrame(frame);
}
function aimsFor(g) {
  const a = {};
  if (mode === 'plan' && ui && (ui.weapon === 'shell' || ui.weapon === 'grenade')) a[ui.who] = ui.angle;
  if (mode === 'resolve') for (const p of g.plans) if (p && p.shooter != null && p.angle != null && (p.weapon === 'shell' || p.weapon === 'grenade')) a[p.shooter] = p.angle;
  return a;
}
function drain(g) {
  for (const e of g.events) {
    view.onEvent(e, g);
    roundEvents.push(e);
    if (e.type === 'fire') { sound.fire(e.weapon); if (e.weapon !== 'mortar') sound.whistle(1.3); }
    else if (e.type === 'boom') { sound.boom(e.midair); if (e.midair) slowT = .9; }
    else if (e.type === 'hurt') sound.ouch();
    else if (e.type === 'splash') sound.splash();
    else if (e.type === 'plop') sound.plop();
    else if (e.type === 'bounce') sound.bounce();
    else if (e.type === 'shieldUp') sound.shield();
    else if (e.type === 'shieldPop') sound.pop();
    else if (e.type === 'incoming') sound.incoming();
    else if (e.type === 'die' || e.type === 'tide') updateHud();
    else if (e.type === 'over' && M.kind !== 'demo' && M.kind !== 'lesson') sound.bugle(M.kind === 'hot' || e.winner === 0);
  }
  g.events.length = 0;
}
function roundOver() {
  const g = M.game;
  const evs = roundEvents; roundEvents = [];
  if (M.kind === 'lesson') {
    const pass = lesson.resolved(evs);
    if (pass) { sound.bugle(true); if (!lesson.next()) return; }
  }
  beginRound();
  if (M.kind === 'lesson') lesson.show();
}
function followAction(g) {
  if (performance.now() - lastPan < 1500) return;
  const live = g.projectiles.filter(p => !p.ghost && p.y > -400);
  if (live.length) {
    let x = 0, y = 0;
    for (const p of live) { x += p.x; y += p.y; }
    view.camGoal = { x: x / live.length, y: y / live.length };
  } else if (view.fx.length) {
    const f = view.fx.at(-1); view.camGoal = { x: f.x, y: f.y };
  } else if (g.stage === 'walk') {
    const a = g.active(0), b = g.active(1);
    const s = M.human[1] ? null : a;
    if (s) view.camGoal = { x: s.x, y: s.y - 100 };
  }
}

// ---------- go
if (DEMO) {
  M = null;
  startMatch('demo');
  setMode('resolve');
} else setMode('front');
syncSound();
requestAnimationFrame(t => { last = t; frame(t); });
window.toyboxReady?.();
if (DEBUG) {
  window.cf = {
    get M() { return M; }, get ui() { return ui; }, get mode() { return mode; }, view, lesson, sound,
    hold(v = true) { hold = v; },
    step(n = 1) { for (let i = 0; i < n && M.game.phase === 'resolve'; i++) { M.game.step(); drain(M.game); } if (M.game.phase === 'plan') roundOver(); },
    // play out the current resolve instantly
    ff() { let i = 0; while (M.game.phase === 'resolve' && i++ < 6000) { M.game.step(); drain(M.game); } if (M.game.phase === 'plan') roundOver(); else if (M.game.phase === 'over') endT = .01; },
    setAim(angle, power) { ui.angle = angle; ui.power = power; ui.touched = true; refreshPlan(); },
    lockIn, startMatch, startLesson, pickWeapon,
  };
}
