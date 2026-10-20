// Moonshot: Worms on a cluster of tiny planetoids, each with its own gravity.
// ?demo plays a CPU match for the preview shot. ?debug exposes window.ms; ?seed=N fixes the layout; ?hold stops the loop for hand-stepping.
import { Game, TEAMS, HP } from './game.js';
import { WEAPONS } from './world.js';
import { View, aimPath } from './render.js';
import { plan } from './ai.js';
import { Sound } from './sound.js';
import { buildSchool } from './tutorial.js';

const qs = new URLSearchParams(location.search);
const DEMO = qs.has('demo'), DEBUG = qs.has('debug'), HOLD = qs.has('hold');
const SEED = qs.has('seed') ? +qs.get('seed') : null;
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('moonshot.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('moonshot.' + k, JSON.stringify(v)); } catch {} },
};

const view = new View($('c'));
const snd = new Sound();
snd.on = store.get('sound', true);
let game = null, scene = 'cover', paused = false, cpu = null, school = null, stepI = 0, stepT = 0, stepDone = false;
let voidLost = 0, drag = null, walkDir = 0, walking = false, endTimer = 0, coverTimer = 0;
const keys = new Set();
const WEAPON_KEYS = ['shell', 'grenade', 'drill', 'mine', 'jet'];

// ---- layout ------------------------------------------------------------------------------------------
function insets() {
  if (scene === 'cover') return { top: 10, bottom: 10, left: 10, right: 10 };
  const top = scene === 'school' ? Math.max(118, $('coach').getBoundingClientRect().bottom + 6) : $('hud').getBoundingClientRect().bottom + 8;
  const bottom = innerHeight - $('tray').getBoundingClientRect().top + 8;
  return { top, bottom, left: 8, right: 8 };
}
function worldSize() {
  const I = insets(), aw = innerWidth - I.left - I.right, ah = innerHeight - I.top - I.bottom;
  const s = Math.min(1.25, Math.max(0.8, Math.min(aw, ah) / 560));
  return { W: Math.round(aw / s), H: Math.round(ah / s) };
}
function resize() {
  view.inset = insets();
  view.resize(innerWidth, innerHeight, Math.min(2, devicePixelRatio || 1));
}
addEventListener('resize', resize);

// ---- scenes ------------------------------------------------------------------------------------------
function show(id, on) { $(id).hidden = !on; }
function setScene(s) {
  scene = s;
  show('cover', s === 'cover');
  show('hud', s === 'play');
  show('tray', s === 'play' || s === 'school');
  show('keys', s === 'play' || s === 'school');
  show('coach', s === 'school');
  show('end', false); show('pause', false); show('back', false);
  paused = false; cpu = null; drag = null;
  $('banner').classList.remove('on'); $('toast').classList.remove('on');
}

function startCover() {
  setScene('cover');
  const seed = SEED ?? (Math.random() * 1e9) | 0;
  const { W, H } = worldSize();
  game = new Game({ mode: 'demo', W, H, seed });
  view.inset = insets();
  view.setGame(game);
  game.start();
  const r = store.get('record', { w: 0, l: 0 });
  $('record').textContent = r.w + r.l ? `Your record against the computer: ${r.w} won, ${r.l} lost` : '';
  $('startHere').hidden = !!store.get('school', false);
}

let lastMode = 'cpu';
function startMatch(mode, seed = SEED) {
  lastMode = mode;
  voidLost = 0;
  setScene('play');
  const { W, H } = worldSize();
  game = new Game({ mode, W, H, seed: seed ?? (Math.random() * 1e9) | 0 });
  resize();
  view.setGame(game);
  game.start();
}

function startSchool() {
  setScene('school');
  stepI = 0;
  $('coachText').innerHTML = 'This is <b>Cadet Bix</b>. Put your finger (or mouse) anywhere, <b>drag back</b> like a slingshot, and <b>let go</b> to fire. Knock over the cardboard alien.';
  const { W, H } = worldSize();
  school = buildSchool(W, H);
  game = school.game;
  resize();
  view.setGame(game);
  beginStep(0);
}

function beginStep(i) {
  stepI = i; stepT = 0; stepDone = false;
  const st = school.steps[i];
  st.begin();
  setCoach(i);
  document.querySelectorAll('.glow').forEach(e => e.classList.remove('glow'));
  for (const id of st.glow || []) (document.getElementById(id) || document.querySelector(`.wpn[data-w="${id}"]`))?.classList.add('glow');
}

function setCoach(i) {
  const st = school?.steps[i];
  $('coachStep').textContent = `Flight School · ${i + 1} of 6`;
  $('coachText').innerHTML = st ? st.text : '';
  const btns = $('coachBtns');
  btns.innerHTML = '';
  if (st?.final) {
    btns.innerHTML = '<button class="btn hot" id="cDone">Versus the Computer</button><button class="btn" id="cCover">Back to the cover</button>';
    $('cDone').onclick = () => { snd.click(); startMatch('cpu'); };
    $('cCover').onclick = () => { snd.click(); startCover(); };
    store.set('school', true);
  }
}

// ---- HUD -------------------------------------------------------------------------------------------------
let bannerTimer = 0, toastTimer = 0;
function banner(k, t, dur = 1.8) { $('banner').querySelector('.k').textContent = k; $('banner').querySelector('.t').textContent = t; $('banner').classList.add('on'); bannerTimer = dur; }
function toast(t, dur = 2.6) { $('toast').textContent = t; $('toast').classList.add('on'); toastTimer = dur; }

function updateHud() {
  if (!game) return;
  if (scene === 'play') {
    for (const team of [0, 1]) {
      const el = $('sq' + team), ts = game.troops.filter(t => t.team === team);
      const pips = el.querySelector('.pips');
      const sig = ts.map(t => t.dead ? 0 : 1).join('');
      if (pips.dataset.sig !== sig) { pips.dataset.sig = sig; pips.innerHTML = ts.map(t => `<i class="${t.dead ? 'gone' : ''}"></i>`).join(''); }
      const hp = ts.reduce((a, t) => a + Math.max(0, t.hp), 0);
      el.querySelector('.bar b').style.width = (hp / (ts.length * HP) * 100).toFixed(1) + '%';
      el.classList.toggle('now', game.cur?.team === team && game.phase !== 'over');
    }
  }
  const human = humanAim();
  $('tray').classList.toggle('off', !human);
  for (const b of document.querySelectorAll('.wpn')) {
    const k = b.dataset.w, n = game.cur ? game.ammoOf(k) : 0;
    b.classList.toggle('on', game.weapon === k);
    b.disabled = n <= 0 || (k === 'jet' && game.jetUsed);
    b.querySelector('.ct').textContent = n === Infinity ? '' : n;
  }
  const f = Math.max(0, game.walkLeft / game.walkMax);
  for (const id of ['walkL', 'walkR']) { $(id).querySelector('.meter b').style.width = (scene === 'school' ? 100 : f * 100) + '%'; $(id).disabled = !human || game.walkLeft <= 0; }
}

function humanAim() { return game && (scene === 'play' || scene === 'school') && !paused && game.phase === 'aim' && !game.cpuTurn && !game.cur?.air; }

// ---- input -------------------------------------------------------------------------------------------------
const cv = $('c');
cv.addEventListener('pointerdown', e => {
  snd.init();
  if (!humanAim() || drag) return;
  cv.setPointerCapture?.(e.pointerId);
  drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false };
});
cv.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  drag.x = e.clientX; drag.y = e.clientY;
  const dx = drag.x0 - drag.x, dy = drag.y0 - drag.y, L = Math.hypot(dx, dy), max = dragMax();
  if (L > 10) {
    drag.moved = true;
    game.aim.ang = Math.atan2(dy, dx);
    game.aim.pow = Math.min(1, Math.max(0.02, (L - 10) / max));
    game.cur.facing = dx >= 0 ? 1 : -1;
  }
});
const endDrag = (e, cancel) => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  const L = Math.hypot(d.x0 - d.x, d.y0 - d.y);
  if (!cancel && d.moved && L > 24 && humanAim()) fire();
};
cv.addEventListener('pointerup', e => endDrag(e, false));
cv.addEventListener('pointercancel', e => endDrag(e, true));
function dragMax() { return Math.max(110, Math.min(230, Math.min(innerWidth, innerHeight) * 0.36)); }

function fire() {
  if (!humanAim()) return;
  if (game.fire()) { snd.click(); }
}

for (const b of document.querySelectorAll('.wpn')) b.addEventListener('click', () => {
  snd.init();
  if (!humanAim() || b.disabled) return;
  game.weapon = b.dataset.w; snd.click();
  const W = WEAPONS[game.weapon];
  toast(W.name + ({ shell: ': bursts on contact', grenade: ': bounces, three-second fuse', drill: ': bores through rock', mine: ': sticks, pulls shots for three turns', jet: ': aim it and you fly' })[game.weapon], 1.8);
});
for (const [id, dir] of [['walkL', -1], ['walkR', 1]]) {
  const b = $(id);
  const on = e => { e.preventDefault(); snd.init(); walkDir = dir; b.classList.add('on'); b.setPointerCapture?.(e.pointerId); };
  const off = () => { if (walkDir === dir) walkDir = 0; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
}

addEventListener('keydown', e => {
  if (e.repeat && !['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) { e.preventDefault(); return; }
  snd.init();
  keys.add(e.code);
  if (e.code === 'Escape') { if (scene === 'play') togglePause(); else if (!$('back').hidden) show('back', false); return; }
  if (!humanAim()) return;
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); fire(); }
  const n = +e.key;
  if (n >= 1 && n <= 5) { const b = document.querySelector(`.wpn[data-w="${WEAPON_KEYS[n - 1]}"]`); if (!b.disabled) b.click(); }
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); walkDir = 0; });

function readKeys(dt) {
  walking = false;
  if (!humanAim()) return;
  let dir = walkDir;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dir = -1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) dir = 1;
  if (dir) { if (game.walk(dir, dt)) { walking = true; stepSound(dt); } }
  // aim with the keys: up raises the barrel toward overhead, down lowers it toward the ground
  let rot = 0;
  if (keys.has('ArrowUp')) rot -= 1;
  if (keys.has('ArrowDown')) rot += 1;
  if (rot) {
    const u = game.world.up(game.cur.x, game.cur.y), ua = Math.atan2(u.y, u.x);
    let rel = wrap(game.aim.ang - ua);
    const side = Math.sign(rel) || game.cur.facing || 1, d = 1.4 * dt;
    rel = rot < 0 ? (Math.abs(rel) <= d ? 0 : rel - side * d) : Math.max(-Math.PI, Math.min(Math.PI, rel + side * d));
    game.aim.ang = ua + rel;
  }
  if (keys.has('KeyW')) game.aim.pow = Math.min(1, game.aim.pow + dt * 0.6);
  if (keys.has('KeyS')) game.aim.pow = Math.max(0.02, game.aim.pow - dt * 0.6);
}
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
let stepAcc = 0;
function stepSound(dt) { stepAcc += dt; if (stepAcc > 0.22) { stepAcc = 0; snd.step(); } }

// The computer starts out a bit clumsy and sharpens up each time you beat it.
function cpuSkill() {
  if (game.mode !== 'cpu') return 1;
  const r = store.get('record', { w: 0, l: 0 });
  return Math.min(1.3, 0.6 + 0.1 * r.w);
}

// ---- the CPU's hands ---------------------------------------------------------------------------------------
function driveCpu(dt) {
  if (!game || game.phase !== 'aim' || !game.cpuTurn) { if (game?.phase !== 'aim') cpu = null; return; }
  if (!cpu || cpu.turn !== game.turnNo) cpu = { stage: 'wait', t: 0, turn: game.turnNo };
  const fast = DEMO || scene === 'cover';
  cpu.t += dt;
  switch (cpu.stage) {
    case 'wait':
      if (cpu.t > (fast ? 0.35 : 0.8)) { cpu.it = plan(game, cpuSkill()); cpu.stage = 'think'; }
      break;
    case 'think': {
      const t0 = performance.now();
      let r;
      while (performance.now() - t0 < 9) { r = cpu.it.next(); if (r.done) break; }
      if (r?.done) {
        cpu.best = r.value; game.weapon = cpu.best.kind;
        cpu.stage = cpu.best.walk ? 'walk' : 'aim'; cpu.t = 0; cpu.a0 = { ...game.aim };
      }
      break;
    }
    case 'walk': {
      const b = cpu.best, dir = Math.sign(b.walk);
      const close = Math.hypot(game.cur.x - b.from.x, game.cur.y - b.from.y) < 2.5;
      if (close || !game.walk(dir, dt) || cpu.t > 4) { cpu.stage = 'aim'; cpu.t = 0; cpu.a0 = { ...game.aim }; }
      else { walking = true; if (scene !== 'cover') stepSound(dt); }
      break;
    }
    case 'aim': {
      const b = cpu.best, k = Math.min(1, cpu.t / (fast ? 0.5 : 0.9)), e = k * k * (3 - 2 * k);
      game.aim.ang = cpu.a0.ang + wrap(b.ang - cpu.a0.ang) * e;
      game.aim.pow = cpu.a0.pow + (b.pow - cpu.a0.pow) * e;
      game.cur.facing = Math.cos(game.aim.ang) >= 0 ? 1 : -1;
      if (cpu.t > (fast ? 0.7 : 1.25)) { game.fire(b.kind, b.ang, b.pow); cpu = null; }
      break;
    }
  }
}

// ---- events from the game -----------------------------------------------------------------------------------
const VERBS = ['takes aim', 'squints at the horizon', 'has a plan', 'has half a plan', 'is feeling lucky', 'adjusts the helmet', 'licks a finger, checks the solar wind', 'hums the anthem', 'remembers basic training', 'cracks their knuckles'];
function drainFx() {
  for (const f of game.fx) {
    const quiet = scene === 'cover';
    switch (f.type) {
      case 'turn':
        if (scene === 'play') { banner(`Chapter ${game.turnNo}`, `${f.troop.name} ${VERBS[(game.turnNo * 7 + f.troop.id) % VERBS.length]}`); snd.turn(); }
        break;
      case 'fire': if (!quiet) snd.fire(f.kind); break;
      case 'boom': view.boom(f.x, f.y, f.R, f.planet); if (!quiet) snd.boom(f.R); else view.shake *= 0.3; break;
      case 'bounce': if (!quiet) snd.bounce(f.v); break;
      case 'thud': case 'land': view.puff(f.x, f.y); if (!quiet) snd.thud(f.v || 200); break;
      case 'stick': if (!quiet) { snd.stick(); if (scene === 'play') toast('Gravity mine armed. It pulls on shots for three turns.'); } break;
      case 'dmg': if (f.troop.team !== 2) view.float(f.x, f.y, '−' + f.dmg, TEAMS[f.troop.team]?.color || '#f7ead0'); break;
      case 'die':
        if (f.troop.team === 2) { view.puff(f.troop.x, f.troop.y, '#c9a46a', 14, 70); break; }
        if (f.why === 'void') voidLost++;
        if (!quiet) { toast(f.why === 'void' ? `${f.troop.name} drifts off into the void.` : `${f.troop.name} is written out of the story.`, 3); f.why === 'void' ? snd.lost() : snd.die(); }
        break;
      case 'stray': if (!quiet) { toast('That shell is in orbit now. It will be back.'); snd.stray(); } break;
      case 'burnup': view.puff(f.x, f.y, '#ff9a4a', 10, 50); if (!quiet) toast('A shell in orbit burns up.'); break;
      case 'lost': if (!quiet && scene === 'play') toast('Gone into the deep black.', 1.6); break;
      case 'landed': if (scene === 'play' && !game.cpuTurn) toast('Touchdown. Still your turn: fire away.'); break;
      case 'rescued': toast('Flight School fishes you back out. Try again.'); break;
      case 'again': if (scene === 'school') onSchoolAgain(); break;
      case 'over': endTimer = scene === 'cover' ? 2.5 : 1.8; break;
    }
  }
  game.fx.length = 0;
}

function onSchoolAgain() {
  const st = school.steps[stepI];
  if (!stepDone && st.retry && !st.done()) $('coachText').innerHTML = st.text + `<br><span class="ok" style="color:#a3321f">${st.retry}</span>`;
}

function schoolTick(dt) {
  const st = school.steps[stepI];
  stepT += dt;
  if (!stepDone && st.done()) {
    stepDone = true; stepT = 0;
    st.end?.();
    $('coachText').innerHTML = st.text + '<br><span class="ok">Nicely done.</span>';
    snd.turn();
  }
  if (stepDone && stepT > 1.4 && game.phase === 'aim') beginStep(stepI + 1);
}

function showEnd() {
  if (scene === 'cover') { startCover(); return; }
  const w = game.winner;
  let who;
  if (w < 0) who = 'Nobody is left to hold anything. The moons drift on, quietly.';
  else if (game.mode === 'cpu') who = w === 0 ? 'Tangerine Squadron holds the moons. You win!' : 'Blueberry Squadron holds the moons. The computer wins this one.';
  else who = `${TEAMS[w].name} Squadron holds the moons.`;
  $('endWho').textContent = who;
  const lost = voidLost;
  $('endStats').textContent = `${game.turnNo} chapters · ${lost ? lost + ' lost to the void' : 'nobody lost to the void'}`;
  if (game.mode === 'cpu') { const r = store.get('record', { w: 0, l: 0 }); if (w === 0) r.w++; else r.l++; store.set('record', r); }
  show('end', true);
  if (w >= 0) snd.win();
}

function togglePause() {
  paused = !paused;
  show('pause', paused);
  $('pSound').textContent = 'Sound: ' + (snd.on ? 'on' : 'off');
}

// ---- buttons -------------------------------------------------------------------------------------------------------
const click = (id, fn) => $(id).addEventListener('click', () => { snd.init(); snd.click(); fn(); });
click('bCpu', () => startMatch('cpu'));
click('bPvp', () => startMatch('pvp'));
click('bSchool', () => startSchool());
click('bBack', () => show('back', true));
click('bBackClose', () => show('back', false));
click('menuBtn', () => togglePause());
click('pResume', () => togglePause());
click('pRestart', () => startMatch(lastMode));
click('pSound', () => { snd.on = !snd.on; store.set('sound', snd.on); $('pSound').textContent = 'Sound: ' + (snd.on ? 'on' : 'off'); });
click('pCover', () => startCover());
click('eAgain', () => startMatch(lastMode));
click('eCover', () => startCover());
click('coachSkip', () => startCover());
$('back').querySelector('.scrim').addEventListener('click', () => show('back', false));

// ---- loop ------------------------------------------------------------------------------------------------------------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!HOLD) step(dt);
}
function step(dt) {
  if (!game) return;
  if (!paused) {
    readKeys(dt);
    driveCpu(dt);
    game.update(dt);
    drainFx();
    if (scene === 'school') schoolTick(dt);
    if (endTimer > 0 && (endTimer -= dt) <= 0) showEnd();
  }
  if (bannerTimer > 0 && (bannerTimer -= dt) <= 0) $('banner').classList.remove('on');
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) $('toast').classList.remove('on');
  updateHud();
  const ui = { walking };
  const showAim = game.phase === 'aim' && game.cur && !game.cur.air && scene !== 'cover' && (humanAim() || (cpu && cpu.stage === 'aim'));
  if (showAim) ui.aim = { troop: game.cur, ang: game.aim.ang, pow: game.aim.pow, kind: game.weapon, path: aimPath(game, game.weapon, game.aim.ang, game.aim.pow) };
  if (scene === 'school' && !stepDone) ui.marks = school.steps[stepI].mark();
  view.frame(dt, ui);
}

resize();
if (DEMO) {
  startMatch('demo', SEED ?? 4);
  // play a few turns off-screen so the preview has craters and bruises in it
  for (let n = 0; n < 4 && game.phase !== 'over'; n++) {
    const it = plan(game); let r; while (!(r = it.next()).done);
    game.fire(r.value.kind, r.value.ang, r.value.pow);
    for (let k = 0; k < 2000 && game.phase !== 'aim' && game.phase !== 'over'; k++) game.update(1 / 30);
  }
  game.fx.length = 0;
} else startCover();
requestAnimationFrame(frame);

if (DEBUG) window.ms = {
  get game() { return game; }, view, startMatch, startSchool, startCover, beginStep, plan, step,
  get school() { return school; }, get stepI() { return stepI; },
  ff(sec) { for (let t = 0; t < sec; t += 1 / 30) step(1 / 30); },
};
