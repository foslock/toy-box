// Draw Ahead: wiring. The pencil (pointer) draws on the page, the page scrolls with the sled, and the menus
// are index cards. ?demo lets the bot ride for the preview shot; ?debug exposes the game as window.da.
import { Game, REASONS, INK_MAX, M } from './game.js';
import { Renderer, C } from './render.js';
import { Bot } from './bot.js';
import { Sound } from './sound.js';
import { hashStr, todayKey } from './rng.js';

const qs = new URLSearchParams(location.search);
const DEMO = qs.has('demo'), DEBUG = qs.has('debug');
const $ = id => document.getElementById(id);
const cv = $('page');
const view = new Renderer(cv);
const sound = new Sound();

// ---- saved bits
const KEY = 'drawahead.v1';
let save = { best: 0, daily: { key: '', best: 0 }, lesson: false, muted: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY)) || {}); } catch {}
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} };
sound.muted = save.muted;

// ---- state
let game, bot = null, mode = 'title', kind = 'daily';
let timeScale = 1, slowT = 0, hold = qs.has('hold');
const LESSON_SPEED = 0.62;

const NOTES = {
  start: 'Your sled is waiting on the ledge. <b>Draw a slope</b> from the end of it, down and to the right. It sets off the moment your pencil touches!',
  keep: 'Keep drawing <b>ahead</b> of it. Steep lines speed it up, flat ones slow it down. If the line runs out, it falls.',
  lead: 'The pencil up top is your <b>lead</b>. It grows back as you travel. Long wiggles waste it.',
  blot: 'Ink blots tumble you. Draw your line <b>over or under</b> one.',
  gate: 'Ride <b>between the red flags</b> for points and extra lead.',
  rock: 'A rock! Draw a <b>ramp</b> up to it, lift your pencil to jump, then draw somewhere downhill to land on.',
  wind: 'Wind pushes you about. And mind the <b>scribble</b> at the bottom of the page: fall in and you\'re out.',
  end: 'Nearly there. Score is <b>metres + style</b>: air time, loops, close shaves and gates.',
};

function newGame(k) {
  kind = k;
  const seed = k === 'daily' ? hashStr('drawahead:' + todayKey()) : k === 'lesson' ? 11 : k === 'demo' ? 4242 : (Math.random() * 2 ** 31) | 0;
  game = new Game({ seed, tutorial: k === 'lesson' });
  view.popups = [];
  view.follow(game, 0, true);
}

function show(id, on) { $(id).hidden = !on; }
function setMode(m) {
  mode = m;
  document.body.classList.toggle('menu', m !== 'play');
  show('title', m === 'title');
  show('over', m === 'over');
  show('pause', m === 'pause');
  show('done', m === 'done');
  show('hud', m === 'play' || m === 'pause' || DEMO);
  show('mute', m !== 'play' && !DEMO);
  if (m !== 'play') { sound.silence(); }
  if (m !== 'play' && m !== 'pause') show('note', false);
}

function startRun(k) {
  sound.init(); sound.page();
  newGame(k);
  bot = null;
  pointer.id = null;
  timeScale = k === 'lesson' ? LESSON_SPEED : 1;
  setMode('play');
  if (k === 'lesson') lessonNote('start', 0);
  else show('note', false);
  updateHud(true);
}

function toTitle() {
  newGame('demo');
  bot = new Bot(game, { sloppy: 0.15 });
  timeScale = 1;
  setMode('title');
  $('dateLbl').textContent = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  $('startHere').hidden = save.lesson;
  // until the lesson's been done, it's the first and biggest button
  const daily = $('dailyBtn'), lesson = $('lessonBtn');
  daily.classList.toggle('go', save.lesson); daily.classList.toggle('quiet', !save.lesson);
  lesson.classList.toggle('go', !save.lesson);
  if (!save.lesson) lesson.after(daily); else daily.after(lesson);
  const today = save.daily.key === todayKey() ? save.daily.best : 0;
  $('bests').innerHTML = save.best ? `Today's best <b>${today.toLocaleString()}</b> &nbsp;·&nbsp; your best ever <b>${save.best.toLocaleString()}</b>` : 'Your scores will be written here.';
}

// ---- tutorial notes
function lessonNote(key, i) {
  const n = $('note');
  const total = game.course.lessons.length;
  n.innerHTML = `<span class="step">lesson ${i + 1} of ${total}</span>${NOTES[key]}`;
  n.hidden = false;
  n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
  if (i > 0) slowT = 2.2;
  if (key === 'lead') { $('lead').classList.add('gain'); setTimeout(() => $('lead').classList.remove('gain'), 900); }
}

// ---- the pencil
const pointer = { id: null, x: 0, y: 0, over: false, mouse: false, moved: 0, lastWX: 0, lastWY: 0 };
function worldOf(e) { return [view.wx(e.clientX), view.wy(e.clientY)]; }
cv.addEventListener('pointerdown', e => {
  if (mode !== 'play' || pointer.id !== null) return;
  e.preventDefault();
  sound.init();
  pointer.id = e.pointerId; pointer.x = e.clientX; pointer.y = e.clientY; pointer.mouse = e.pointerType === 'mouse';
  try { cv.setPointerCapture(e.pointerId); } catch {}
  const [x, y] = worldOf(e);
  game.beginStroke(x, y, 28 / view.cam.s);
});
cv.addEventListener('pointermove', e => {
  pointer.over = true; pointer.mouse = e.pointerType === 'mouse';
  if (e.pointerId !== pointer.id) { pointer.x = e.clientX; pointer.y = e.clientY; return; }
  const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of (list.length ? list : [e])) {
    pointer.moved += Math.hypot(ev.clientX - pointer.x, ev.clientY - pointer.y);
    pointer.x = ev.clientX; pointer.y = ev.clientY;
    if (mode === 'play') game.extendStroke(view.wx(ev.clientX), view.wy(ev.clientY));
  }
});
const up = e => {
  if (e.pointerId !== pointer.id) return;
  pointer.id = null;
  if (game) game.endStroke();
};
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', up);
cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') pointer.over = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());

// ---- buttons and keys
$('dailyBtn').onclick = () => startRun('daily');
$('lessonBtn').onclick = () => startRun('lesson');
$('blankBtn').onclick = () => startRun('blank');
$('againBtn').onclick = () => startRun(kind);
$('menuBtn').onclick = toTitle;
$('pauseBtn').onclick = () => pause(true);
$('resumeBtn').onclick = () => pause(false);
$('restartBtn').onclick = () => startRun(kind);
$('quitBtn').onclick = toTitle;
$('doneDaily').onclick = () => startRun('daily');
$('doneMenu').onclick = toTitle;
const muteBtn = $('mute');
const paintMute = () => { muteBtn.textContent = sound.muted ? '♪̸' : '♪'; muteBtn.style.opacity = sound.muted ? 0.45 : 1; };
muteBtn.onclick = () => { sound.init(); sound.setMuted(!sound.muted); save.muted = sound.muted; store(); paintMute(); };
paintMute();

function pause(on) {
  if (on && mode === 'play') { if (game) game.endStroke(); pointer.id = null; setMode('pause'); }
  else if (!on && mode === 'pause') { setMode('play'); if (kind === 'lesson' && game.state !== 'done') $('note').hidden = false; }
}
addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'escape' || k === 'p') { if (mode === 'play') pause(true); else if (mode === 'pause') pause(false); }
  else if (k === 'r' && (mode === 'over' || mode === 'pause' || mode === 'play')) startRun(kind);
  else if ((k === 'enter' || k === ' ') && mode === 'title') { e.preventDefault(); startRun(save.lesson ? 'daily' : 'lesson'); }
  else if ((k === 'enter' || k === ' ') && mode === 'over') { e.preventDefault(); startRun(kind); }
  else if (k === 'm') muteBtn.click();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && !DEBUG) pause(true); });

// ---- results
function finish() {
  const g = game;
  const score = g.score;
  let best = false, todayBest = false;
  if (kind === 'daily' || kind === 'blank') {
    if (score > save.best) { save.best = score; best = true; }
    if (kind === 'daily') {
      const key = todayKey();
      if (save.daily.key !== key) save.daily = { key, best: 0 };
      if (score > save.daily.best) { save.daily.best = score; todayBest = true; }
    }
    store();
  }
  const titles = ['Tumbled!', 'Wipe-out!', 'Oof.', 'Crumpled!', 'Off the page!'];
  $('overTitle').textContent = g.reason === 'scribble' || g.reason === 'back' ? 'Scribbled out!' : titles[(score + g.t * 7 | 0) % titles.length];
  $('overWhy').textContent = `You ${REASONS[g.reason] || 'stopped'}.`;
  const T = g.tally;
  const row = (a, b) => `<span>${a}</span><b>${b}</b>`;
  $('tally').innerHTML = [
    row('distance', `${Math.floor(g.dist).toLocaleString()} m`),
    row('air time', T.air || 0),
    row('loops &amp; flips', T.loops || 0),
    row('close shaves', T.close || 0),
    row(`gates (${g.gates.hit}/${g.gates.all})`, T.gates || 0),
    `<span class="total">score${best ? '<span class="newbest">best ever!</span>' : todayBest ? '<span class="newbest">today\'s best</span>' : ''}</span><b class="total">${score.toLocaleString()}</b>`,
  ].join('');
  $('againBtn').textContent = kind === 'lesson' ? 'Try the lesson again' : 'Ride again';
  setMode('over');
  setTimeout(() => $('againBtn').focus({ preventScroll: true }), 50);
}

// ---- HUD
let hudScore = -1, hudStyle = -1, hudInk = -1;
function updateHud(force) {
  if (!game) return;
  const d = Math.floor(game.dist);
  if (d !== hudScore || force) { hudScore = d; $('dist').innerHTML = `${d.toLocaleString()}<small>m</small>`; }
  if (game.style !== hudStyle || force) { hudStyle = game.style; $('sty').textContent = game.style ? `+${game.style.toLocaleString()} style` : ''; }
  const f = Math.round(game.ink / INK_MAX * 60) / 60;
  if (f !== hudInk || force) {
    hudInk = f;
    const L = Math.min(150, Math.max(110, innerWidth * 0.3));
    document.querySelector('#lead .body').style.width = `${6 + f * L}px`;
    $('lead').classList.toggle('low', f < 0.18);
  }
}

// ---- events from the game
function handle(ev) {
  switch (ev.type) {
    case 'go': sound.go(); break;
    case 'style':
      view.pop(ev.text, ev.x, ev.y, ev.kind === 'loops');
      if (ev.kind === 'gates') { sound.gate(); $('lead').classList.add('gain'); setTimeout(() => $('lead').classList.remove('gain'), 300); }
      else sound.style(ev.kind);
      break;
    case 'miss': sound.miss(); view.pop('missed', ev.x, ev.y); break;
    case 'land': sound.land(ev.impact); break;
    case 'dry': if (Math.random() < 0.25) sound.dry(); break;
    case 'crash': sound.crash(); if (navigator.vibrate) try { navigator.vibrate(60); } catch {} break;
    case 'over':
      if (kind === 'lesson') { lessonRetry(); break; }
      if (mode === 'play') finish();
      break;
    case 'lesson': if (mode === 'play') lessonNote(ev.key, ev.i); break;
    case 'done':
      save.lesson = true; store();
      setTimeout(() => { if (kind === 'lesson' && mode === 'play') setMode('done'); }, 900);
      sound.style('loops');
      break;
  }
}

function lessonRetry() {
  const why = REASONS[game.reason] || 'stopped';
  game.respawn();
  view.follow(game, 0, true);
  const n = $('note');
  n.innerHTML = `<span class="step">oops: you ${why}</span>Try that bit again. Put your pencil down at the <b>end of the ledge</b> and draw.`;
  n.hidden = false; n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop');
}

// a dashed guide for the first lesson (and after a tumble): from the ledge, curving down to the right
function ghost() {
  if (kind !== 'lesson' || game.state !== 'ready') return null;
  const rd = game.rider, c = game.course;
  const l = c.ledges.filter(l => l.x0 <= rd.x + 1 && l.x1 >= rd.x - 1).pop();
  if (!l) return null;
  const e = l.pts[l.pts.length - 1], pts = [];
  for (let i = 0; i <= 12; i++) { const x = e.x + i * 26; pts.push({ x, y: e.y + i * 26 * (0.45 - i * 0.022) }); }
  return pts;
}

// ---- the pencil cursor (mouse only)
function drawCursor(ctx) {
  if (!pointer.mouse || !pointer.over || mode !== 'play') return;
  const x = pointer.x, y = pointer.y, dpr = view.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.save(); ctx.translate(x, y); ctx.rotate(-2.3);
  const down = pointer.id !== null;
  ctx.translate(down ? 0 : 3, 0);
  ctx.fillStyle = '#e7c08a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, -5); ctx.lineTo(14, 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.pencil; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(5, -1.8); ctx.lineTo(5, 1.8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f6c945'; ctx.fillRect(14, -5, 34, 10);
  ctx.fillStyle = '#e6b331'; ctx.fillRect(14, -1.5, 34, 3);
  ctx.fillStyle = '#a3a19c'; ctx.fillRect(48, -5, 6, 10);
  ctx.fillStyle = '#e88e8b'; ctx.fillRect(54, -5, 7, 10);
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.strokeRect(14, -5, 47, 10);
  ctx.restore();
}

// ---- loop
let last = performance.now(), drawSpeedSm = 0, lastMoved = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const real = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!hold) tick(real);
  render(real);
}

function tick(real) {
  if (!game) return;
  let ts = timeScale;
  if (slowT > 0) { slowT -= real; ts *= 0.35 + 0.65 * Math.max(0, 1 - slowT / 2.2) ** 2; }
  if (mode === 'play' || mode === 'title' || DEMO) {
    if (bot) bot.update();
    game.step(real * ts);
    for (const ev of game.events) handle(ev);
    game.events.length = 0;
    if (mode === 'title' && (game.state === 'over' || game.t > 200)) { newGame('demo'); bot = new Bot(game, { sloppy: 0.15 }); }
  }
  view.follow(game, real);
  const moved = pointer.moved - lastMoved; lastMoved = pointer.moved;
  drawSpeedSm = moved / Math.max(real, 1e-3);
  if (mode === 'play') sound.update(pointer.id !== null && game.stroke ? drawSpeedSm + 120 : 0, game.rider, game.state === 'ride');
  if (mode === 'play' || DEMO) updateHud();
}

function render(real) {
  if (!game) return;
  view.draw(game, { dt: real, ghost: ghost() });
  drawCursor(view.ctx);
}

function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  view.resize(innerWidth, innerHeight, dpr);
  if (game) view.follow(game, 0, true);
}
addEventListener('resize', resize);
resize();

if (DEMO) {
  newGame('demo');
  bot = new Bot(game);
  setMode('play');
  document.body.classList.add('menu');
  show('mute', false);
  // ride a little way in so the shot has something on the page
  const at = +(qs.get('at') || 33.5);
  for (let i = 0; i < 60 * at; i++) { bot.update(); game.step(1 / 60); game.events.length = 0; view.follow(game, 1 / 60); }
} else toTitle();

if (DEBUG) window.da = {
  get game() { return game; }, get view() { return view; }, get mode() { return mode; },
  set hold(v) { hold = v; },
  step(sec = 1, dt = 1 / 60) { for (let t = 0; t < sec; t += dt) tick(dt); render(dt); return { x: game.rider.x | 0, state: game.state, mode }; },
  startRun, bot: () => (bot = new Bot(game)), M,
};

requestAnimationFrame(t => { last = t; frame(t); });
window.toyboxReady?.();
