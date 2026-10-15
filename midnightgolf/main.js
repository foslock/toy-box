import { HOLES, FLOORS } from './holes.js';
import { Game, MAX_STROKES } from './game.js';
import { View } from './render.js';
import { Sound } from './sound.js';
import { distField, choose } from './bot.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), AUTO = Q.has('autoplay'), DEBUG = Q.has('debug') || AUTO;
const SPEED = +Q.get('speed') || 1;
const MOON = '<svg class="moon" viewBox="0 0 24 24"><path d="M15.5 3.2A9 9 0 1 0 20.8 15 7.2 7.2 0 0 1 15.5 3.2z" fill="#e8b84a"/></svg>';
const MOON_OFF = '<svg class="moon" viewBox="0 0 24 24"><path d="M15.5 3.2A9 9 0 1 0 20.8 15 7.2 7.2 0 0 1 15.5 3.2z" fill="none" stroke="#9a9cb4" stroke-width="1.6" stroke-dasharray="2 2.5"/></svg>';

// ---------- saved progress
const KEY = 'midnightgolf.v1';
let store = { reached: 1, best: null, bestMoons: 0, seen: {}, sound: true };
try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
const save = () => { if (DEMO || AUTO) return; try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {} };

// ---------- state
const cv = $('c');
const view = new View(cv);
const sound = new Sound();
sound.setOn(store.sound);
let hi = 0, game = null, field = null;
let round = { from: 0, card: [] };
let mode = 'title';      // title | play | over (a card is up)
let paused = false, hold = false;
const ui = { aim: null, ghost: false, focus: -1 };
let drag = null, keyAim = null;
let tut = null;          // the first hole's lesson, step by step
let overT = 0;           // time since the ball dropped / someone woke
let lastPhase = 'aim';
let lastNoiseT = 0;

function onNoise(x, y, L, kind) {
  view.ripple(x, y, L, kind);
  if (kind !== 'roll') sound.play(kind, L);
  lastNoiseT = performance.now();
}

// ---------- holes
function loadHole(i, { banner = true, tips = true } = {}) {
  hi = i;
  game = new Game(HOLES[i], { onNoise, t0: Math.random() * 20 });
  field = null;
  view.ripples = []; view.words = []; view.trail = []; view.sparks = [];
  view.lightsOn = 0; view.dawn = 0;
  view.fit(HOLES[i]);
  ui.aim = null; ui.focus = -1; ui.ghost = false; drag = null; keyAim = null;
  overT = 0; lastPhase = 'aim';
  mode = 'play';
  hud();
  document.body.classList.toggle('titled', !tips);
  if (banner && !DEMO) showBanner();
  if (tips) startTips(); else hideCoach();
}

function hud() {
  const h = HOLES[hi];
  $('hole').querySelector('b').textContent = hi + 1;
  $('hname').textContent = h.name;
  const n = game ? game.strokes : 0;
  $('hsub').innerHTML = `Par ${h.par} · ${n === 1 ? '1 putt' : n + ' putts'}`;
}

let bannerT = null;
function showBanner() {
  const h = HOLES[hi];
  $('bk').textContent = `Hole ${hi + 1} of ${HOLES.length}`;
  $('bt').textContent = h.name;
  $('bp').textContent = `Par ${h.par}`;
  $('banner').classList.remove('off');
  clearTimeout(bannerT);
  bannerT = setTimeout(() => $('banner').classList.add('off'), 1700);
}

// ---------- the coach
const TIPS = [
  null,
  { t: 'Kitchen tiles are fast, and they <em>rattle</em> under a rolling ball. Biscuit sleeps lightly. Soft putts are quiet putts.', f: 0 },
  { t: "The rug is silent but slow. Bumping the sofa is soft; the coffee table isn't. Grandpa's a bit deaf. Mind the cat.", f: 0 },
  { t: 'Thread the <em>cat flap</em>. It clacks on the way through. Uncle Ray is on the camp bed.', f: 0 },
  { t: 'Two pale boards in the carpet <em>creak</em>. The floor sags towards the stairs, and a ball down the stairs wakes the house… nearly.', f: -1 },
  { t: 'The shower tray slopes to the plughole. Rosie is just next door, and babies hear everything.', f: 0 },
  { t: "Rosie's own room now. Every sound in here lands right by the cot. Take it slowly; let her settle between putts.", f: 0 },
  { t: 'Lego. Every brick you roll over <em>crunches</em>. The train keeps going round.', f: -1 },
  { t: "Last one: Dad's slipper, right beside the bed.", f: 1 },
];
let coachTimer = null;
function coach(html, key = 'a note', focus = -1) {
  $('coachT').innerHTML = html;
  $('coachK').textContent = key;
  $('coach').classList.remove('off');
  ui.focus = focus;
  clearTimeout(coachTimer);
}
function hideCoach() { $('coach').classList.add('off'); ui.focus = -1; }
$('coachX').onclick = () => { hideCoach(); if (tut) { ui.ghost = false; } };

function startTips() {
  hideCoach();
  tut = null;
  if (DEMO || AUTO) return;
  if (hi === 0 && !store.seen.tut) {
    tut = { step: 'drag' };
    ui.ghost = true;
    setTimeout(() => { if (tut && tut.step === 'drag' && hi === 0) coach('Drag back from the ball and let go to putt, like a catapult. You can start the drag anywhere on the screen.', 'how to putt'); }, 900);
    return;
  }
  const tip = TIPS[hi];
  if (tip && !store.seen['h' + hi]) {
    setTimeout(() => { if (mode === 'play' && game.strokes === 0) coach(tip.t, `hole ${hi + 1}`, tip.f); }, 1300);
    store.seen['h' + hi] = 1; save();
  }
}

// lesson steps on the first hole
function tutAfterShot() {
  if (!tut) return;
  if (tut.step === 'drag') {
    tut.step = 'noise';
    ui.ghost = false;
    hideCoach();
  } else if (tut.step === 'wedge-shown' || tut.step === 'noise-shown') {
    tut = null; hideCoach();
    store.seen.tut = 1; save();
  }
}
function tutAtRest() {
  if (!tut) return;
  if (tut.step === 'noise') {
    tut.step = 'noise-shown';
    coach("Every putt and bump sends out a ripple of noise. Mum's ring, by her door, fills as she hears it. Fill it and she's up, and the hole starts again.", 'noise', 0);
  }
}
// the second lesson lands the moment they start aiming, when the wedge is on screen
function tutAiming() {
  if (!tut || tut.step !== 'noise-shown') return;
  tut.step = 'wedge-shown';
  coach("See the pale wedge on Mum's ring? That's what this putt alone would add. Rings drain again when it's quiet.", 'aiming', 0);
}

// ---------- input: drag back anywhere, let go to putt
function pullMax() { return Math.max(110, Math.min(220, Math.min(innerWidth, innerHeight) * 0.34)); }
function canAim() { return mode === 'play' && !paused && game && game.phase === 'aim' && !DEMO && !AUTO; }

cv.addEventListener('pointerdown', (e) => {
  sound.init();
  if (!canAim() || drag) return;
  cv.setPointerCapture(e.pointerId);
  drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
  keyAim = null;
  if (tut && tut.step === 'drag') ui.ghost = false;
  tutAiming();
  $('banner').classList.add('off');
});
cv.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = drag.x0 - e.clientX, dy = drag.y0 - e.clientY, d = Math.hypot(dx, dy);
  if (d < 14) { ui.aim = null; return; }
  const [wx, wy] = view.wv(dx, dy);
  ui.aim = { ang: Math.atan2(wy, wx), p: Math.min(1, (d - 10) / pullMax()) };
});
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  drag = null;
  if (ui.aim && canAim() && e.type === 'pointerup') putt(ui.aim.ang, ui.aim.p);
  ui.aim = null;
};
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);

function putt(ang, p) {
  if (!game.shoot(ang, Math.max(0.03, p))) return;
  ui.aim = null; keyAim = null;
  hud();
  tutAfterShot();
  if (!tut && !$('coach').classList.contains('off') && hi > 0) setTimeout(hideCoach, 600);
}

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (drag) { drag = null; ui.aim = null; return; } if (!$('help').hidden) { closeHelp(); return; } if (mode === 'play') toggleMenu(); return; }
  if (!canAim()) {
    if ((e.key === 'Enter' || e.key === ' ') && !$('result').hidden) { e.preventDefault(); $('resGo').click(); }
    return;
  }
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter', 'a', 'd', 'w', 's'].includes(k)) e.preventDefault();
  sound.init();
  if (!keyAim) {
    const c = HOLES[hi].cup;
    keyAim = { ang: Math.atan2(c.y - game.ball.y, c.x - game.ball.x), p: 0.35 };
  }
  const fine = e.shiftKey ? 0.25 : 1;
  // left/right turn the aim as seen on screen
  const turn = (view.rot ? 1 : 1) * 0.035 * fine;
  if (k === 'ArrowLeft' || k === 'a') keyAim.ang -= turn;
  else if (k === 'ArrowRight' || k === 'd') keyAim.ang += turn;
  else if (k === 'ArrowUp' || k === 'w') keyAim.p = Math.min(1, keyAim.p + 0.04 * fine);
  else if (k === 'ArrowDown' || k === 's') keyAim.p = Math.max(0.03, keyAim.p - 0.04 * fine);
  else if (k === ' ' || k === 'Enter') { putt(keyAim.ang, keyAim.p); return; }
  else if (k === 'r' || k === 'R') { retryHole(); return; }
  else return;
  ui.aim = { ...keyAim };
  if (tut && tut.step === 'drag') ui.ghost = false;
  tutAiming();
});

// ---------- buttons and cards
const show = (id) => { $(id).hidden = false; };
const hide = (id) => { $(id).hidden = true; };
function toggleMenu() {
  if (!$('menu').hidden) { hide('menu'); paused = false; return; }
  paused = true; show('menu');
}
$('bMenu').onclick = () => { sound.init(); toggleMenu(); };
$('bResume').onclick = () => { hide('menu'); paused = false; };
$('bRestart').onclick = () => { hide('menu'); paused = false; retryHole(); };
$('bQuit').onclick = () => { hide('menu'); paused = false; toTitle(); };
$('bRetry').onclick = () => { sound.init(); retryHole(); };
$('bHelp').onclick = () => { sound.init(); paused = true; show('help'); };
function closeHelp() { hide('help'); paused = !$('menu').hidden; }
$('bHelpOk').onclick = closeHelp;
function soundLabel() { const t = 'Sound: ' + (store.sound ? 'on' : 'off'); $('bSound').textContent = t; $('bSound2').textContent = t; }
const flipSound = () => { store.sound = !store.sound; sound.setOn(store.sound); soundLabel(); save(); sound.init(); };
$('bSound').onclick = flipSound; $('bSound2').onclick = flipSound;
soundLabel();

function retryHole() {
  if (mode !== 'play') return;
  loadHole(hi, { banner: false });
}

function toTitle() {
  mode = 'title';
  ['result', 'final', 'pick', 'menu', 'help'].forEach(hide);
  hideCoach();
  loadHole(store.reached > 1 ? Math.min(HOLES.length - 1, store.reached - 1) : 0, { banner: false, tips: false });
  mode = 'title';
  const b = store.best;
  $('best').innerHTML = b ? `Best full round: ${b.total} (${fmtPar(b.total - totalPar())}) · ${MOON.repeat(Math.min(9, b.moons))}` : '';
  $('bPlay').textContent = store.reached > 1 && store.reached <= HOLES.length && store.resume ? `Carry on from hole ${store.reached}` : 'Tee off';
  show('title');
}
const totalPar = () => HOLES.reduce((a, h) => a + h.par, 0);
const fmtPar = (d) => (d === 0 ? 'level par' : d > 0 ? `+${d}` : `${d}`);

$('bPlay').onclick = () => {
  sound.init();
  hide('title');
  const from = store.resume && store.reached > 1 ? store.reached - 1 : 0;
  round = { from, card: from > 0 && store.card ? store.card.slice(0, from) : [] };
  if (from === 0) round.card = [];
  loadHole(from);
};
$('bPick').onclick = () => {
  const box = $('holes');
  box.innerHTML = '';
  HOLES.forEach((h, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<b>${i + 1}</b>${h.name}`;
    b.disabled = i + 1 > store.reached;
    b.onclick = () => { sound.init(); hide('pick'); hide('title'); round = { from: i, card: [] }; loadHole(i); };
    box.appendChild(b);
  });
  hide('title'); show('pick');
};
$('bPickBack').onclick = () => { hide('pick'); show('title'); };

const NAMES = { '-3': 'Shooting star!', '-2': 'Barn owl!', '-1': 'Night owl', 0: 'Par', 1: 'Bogey', 2: 'Double bogey' };
function scoreName(s, par) {
  if (s === 1) return 'Hole in one!';
  return NAMES[s - par] || (s - par > 0 ? `${s - par} over` : 'Wow');
}

function finishHole(picked) {
  mode = 'over';
  const h = HOLES[hi];
  const moon = !picked && game.peak < 50;
  const prev = round.card[hi - round.from] || { caught: 0 };
  round.card[hi - round.from] = { hole: hi, strokes: picked ? MAX_STROKES : game.strokes, moon, caught: prev.caught || 0, picked };
  store.reached = Math.max(store.reached, Math.min(HOLES.length, hi + 2));
  store.resume = hi + 1 < HOLES.length && round.from === 0;
  if (round.from === 0) store.card = round.card.map((c) => ({ ...c }));
  save();
  $('resStamp').innerHTML = moon ? `<svg class="stamp" viewBox="0 0 24 24"><path d="M15.5 3.2A9 9 0 1 0 20.8 15 7.2 7.2 0 0 1 15.5 3.2z" fill="#e8b84a" stroke="#1f2650" stroke-width=".8"/></svg>` : '';
  $('resH').textContent = picked ? 'Picked up.' : scoreName(game.strokes, h.par);
  $('resS').textContent = picked ? `${MAX_STROKES} putts` : `${game.strokes} ${game.strokes === 1 ? 'putt' : 'putts'} · par ${h.par}`;
  let p;
  if (picked) p = "That's enough putting for one room. It goes down as " + MAX_STROKES + '.';
  else if (moon) p = game.peak < 15 ? 'Not a peep. Nobody stirred. That earns a moon.' : "Quiet enough: nobody's ring passed halfway. That earns a moon.";
  else p = game.peak > 85 ? 'Somebody very nearly woke up. No moon this time.' : 'Somebody stirred past halfway, so no moon.';
  if (tut && hi === 0) { p += ' (Moons are for quiet holes.)'; }
  $('resP').textContent = p;
  $('resGo').textContent = hi + 1 < HOLES.length ? 'Next hole' : 'Scorecard';
  $('resRow2').hidden = false;
  $('resAgain').textContent = 'Play it again';
  $('resAgain').onclick = () => { hide('result'); round.card[hi - round.from] = undefined; loadHole(hi, { banner: false }); };
  $('resGo').onclick = () => {
    hide('result');
    if (hi === 0 && tut) { tut = null; store.seen.tut = 1; save(); }
    if (hi + 1 < HOLES.length) loadHole(hi + 1);
    else showFinal();
  };
  show('result');
}

const WAKE = {
  Mum: '“Is someone there? …It’s two in the morning. Bed.”',
  Dad: '“Wuzzat? Burglars? …Oh. It’s you. BED.”',
  Biscuit: 'WOOF. WOOF. WOOF. (Biscuit would like to play too.)',
  Grandpa: '“Eh? Who’s that? Is it the war?” He turns the big light on.',
  'Uncle Ray': '“Five more minutes… hang on. Why is there a golf ball?”',
  Tom: '“Mu-um! Someone’s playing golf on the landing!”',
  'Auntie Bev': '“I KNEW I heard something.” She stands guard on the landing till dawn.',
  'Baby Rosie': 'Waaaaaah. That’s everyone up now.',
  Rosie: 'Waaaaaah. That’s everyone up now.',
  Ellie: '“Can I have a go?” Now nobody is going back to sleep.',
  Max: '“Is it morning? IS IT MORNING?”',
};
function caught() {
  mode = 'over';
  const s = HOLES[hi].sleepers[game.woke];
  const c = round.card[hi - round.from] || { caught: 0 };
  c.caught = (c.caught || 0) + 1;
  round.card[hi - round.from] = c;
  $('resStamp').innerHTML = '';
  $('resH').textContent = s.kind === 'dog' ? `${s.name} is up!` : `${s.name}'s awake!`;
  $('resS').textContent = '';
  $('resP').innerHTML = (WAKE[s.name] || '“Who’s there?”') + '<br><span class="small">Lights out, wait a while, and try the hole again.</span>';
  $('resGo').textContent = 'Try again';
  $('resGo').onclick = () => { hide('result'); loadHole(hi, { banner: false }); };
  $('resRow2').hidden = true;
  show('result');
}

function showFinal() {
  mode = 'over';
  view.dawnTarget = 1;
  const rows = round.card.map((c, k) => c && { ...c, i: round.from + k }).filter(Boolean);
  const total = rows.reduce((a, c) => a + c.strokes, 0), par = rows.reduce((a, c) => a + HOLES[c.i].par, 0);
  const moons = rows.filter((c) => c.moon).length, wakes = rows.reduce((a, c) => a + (c.caught || 0), 0);
  const full = round.from === 0 && rows.length === HOLES.length;
  let html = '<tr><th>hole</th><th>par</th><th>putts</th><th></th></tr>';
  for (const c of rows) {
    const d = c.strokes - HOLES[c.i].par;
    html += `<tr><td>${c.i + 1}. ${HOLES[c.i].name}</td><td>${HOLES[c.i].par}</td><td class="${d < 0 ? 'under' : d > 0 ? 'over' : ''}">${c.strokes}</td><td>${c.moon ? MOON : MOON_OFF}</td></tr>`;
  }
  html += `<tr class="tot"><td>Total</td><td>${par}</td><td>${total}</td><td>${moons}</td></tr>`;
  $('finT').innerHTML = html;
  let msg = `${total} putts, ${fmtPar(total - par)}. ${moons} ${moons === 1 ? 'moon' : 'moons'}.`;
  msg += wakes === 0 ? ' Nobody woke up all night.' : ` You woke someone ${wakes === 1 ? 'once' : wakes + ' times'}.`;
  if (full) {
    const b = store.best;
    if (!b || total < b.total || (total === b.total && moons > b.moons)) { store.best = { total, moons }; msg += ' A new best round!'; }
    store.resume = false; save();
  }
  $('finP').textContent = msg;
  $('finH').textContent = 'Morning.';
  sound.chime(4);
  setTimeout(() => show('final'), 1400);
}
$('finGo').onclick = () => { hide('final'); store.resume = false; save(); toTitle(); };

// ---------- the bot (demo and autoplay)
let bot = { t: 0, plan: null };
function botTick(dt) {
  if (mode !== 'play' || game.phase !== 'aim') { bot.t = 0; bot.plan = null; return; }
  bot.t += dt;
  if (!bot.plan && bot.t > 0.4) {
    if (!DEMO && Math.max(0, ...game.meters) > 18 && bot.t < 8) return;   // wait for quiet
    field = field || distField(game);
    const c = choose(game, field, { angles: DEMO ? 72 : 96, care: 1 });
    const err = AUTO ? (+Q.get('err') || 0) : 0;
    bot.plan = { a: c.a + (Math.random() * 2 - 1) * err * Math.PI / 180, p: c.p, t0: bot.t };
  }
  if (bot.plan) {
    const k = Math.min(1, (bot.t - bot.plan.t0) / 1.1);
    ui.aim = { ang: bot.plan.a, p: bot.plan.p * (0.25 + 0.75 * k) };
    if (k >= 1 && bot.t - bot.plan.t0 > 1.4) { const p = bot.plan; bot.plan = null; bot.t = 0; ui.aim = null; game.shoot(p.a, p.p); hud(); }
  }
}

// ---------- the loop
let last = performance.now();
let ghostT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    if (!hold) tick(dt * (DEMO ? 1 : SPEED));
    view.frame(game, ui, dt, now / 1000);
  } catch (err) { console.error(err); }
}

function tick(dt) {
  if (!game) return;
  if (!paused) {
    if (DEMO || AUTO) botTick(dt);
    game.step(dt);
  }
  const b = game.ball;
  const sp = Math.hypot(b.vx, b.vy);
  sound.roll(game.phase === 'roll' ? sp : 0, FLOORS[game.floorAt(b.x, b.y)].roll * 40 + 0.05);
  sound.ambient(true);
  // phase changes
  if (lastPhase === 'roll' && game.phase === 'aim') {
    hud();
    tutAtRest();
    if (game.strokes >= MAX_STROKES && mode === 'play') { setTimeout(() => game.phase === 'aim' && mode === 'play' && finishHole(true), 500); }
  }
  if (game.phase === 'sunk' && lastPhase !== 'sunk') { view.sink(game); sound.chime(3); overT = 0; hud(); }
  if (game.phase === 'caught' && lastPhase !== 'caught') { sound.wake(); overT = 0; ui.aim = null; drag = null; }
  if (game.phase === 'sunk') {
    overT += dt;
    if (overT > 1.1 && mode === 'play') {
      if (DEMO) { loadHole(hi, { banner: false }); demoPrime(); }
      else finishHole(false);
    }
  }
  if (game.phase === 'caught') {
    overT += dt;
    view.lightsOn = Math.min(1, overT * 3);
    if (overT > 1.6 && mode === 'play') { if (DEMO) loadHole(hi, { banner: false }); else caught(); }
  }
  // keep the note out of the ball's way
  const by = view.sy(b.x, b.y);
  $('coach').classList.toggle('top', by > innerHeight * 0.55);
  if (view.dawnTarget) view.dawn = Math.min(1, view.dawn + dt * 0.5);
  lastPhase = game.phase;
  if (AUTO) autoClick();
}

let autoWait = 0;
function autoClick() {
  if ($('result').hidden && $('final').hidden) { autoWait = 0; return; }
  autoWait++;
  if (autoWait < 30) return;
  autoWait = 0;
  if (!$('result').hidden) $('resGo').click();
  else if (!$('final').hidden) { window.mgDone = true; }
}

addEventListener('resize', () => { if (game) view.fit(HOLES[hi]); });
document.addEventListener('visibilitychange', () => { last = performance.now(); });

function demoPrime() {
  // start the preview mid-hole: one quiet putt already played, the house a little restless
  game.meters = game.meters.map((m, i) => (i === 0 ? 46 : 20));
  game.quiet = game.quiet.map(() => 0);
}

// ---------- start
if (DEMO) {
  document.body.classList.add('demo');
  loadHole(Q.has('hole') ? +Q.get('hole') - 1 : 2, { banner: false });
  demoPrime();
  bot.t = -0.9;
} else if (AUTO) {
  round = { from: 0, card: [] };
  loadHole(Q.has('hole') ? +Q.get('hole') - 1 : 0, { banner: false });
} else if (Q.has('hole')) {
  const i = Math.max(0, Math.min(HOLES.length - 1, +Q.get('hole') - 1));
  round = { from: i, card: [] };
  loadHole(i);
} else {
  toTitle();
}
requestAnimationFrame(frame);

if (DEBUG) {
  window.mg = {
    get game() { return game; }, view, ui, HOLES,
    hold(v = true) { hold = v; },
    step(sec, dt = 1 / 60) { for (let t = 0; t < sec; t += dt) tick(dt); view.frame(game, ui, dt, performance.now() / 1000); },
    load: (i) => loadHole(i),
    putt,
    // the bot's pick, with some human wobble, and the screen drag that makes it
    plan(errDeg = 0, pErr = 0) {
      field = field || distField(game);
      const c = choose(game, field, { angles: 96 });
      return { a: c.a + (Math.random() * 2 - 1) * errDeg * Math.PI / 180, p: Math.min(1, c.p * (1 + (Math.random() * 2 - 1) * pErr)) };
    },
    dragFor(a, p, x0 = innerWidth / 2, y0 = innerHeight * 0.6) {
      const wx = Math.cos(a), wy = Math.sin(a);
      const [dx, dy] = view.rot ? [-wy, wx] : [wx, wy];
      const k = p * pullMax() + 10;
      return { x0, y0, x1: x0 - dx * k, y1: y0 - dy * k };
    },
    state: () => ({ hole: hi + 1, mode, phase: game.phase, strokes: game.strokes, meters: game.meters.map(Math.round), card: round.card }),
  };
}
