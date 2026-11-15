import { Game, WEAPONS, BOSSES, DAY_LEN, FLARE_COST, blocked } from './game.js';
import { Renderer } from './render.js';
import { makeBot, botInput, botLevel } from './bot.js';
import { sfx, unlock, setMuted, isMuted, setMood } from './sound.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo'), DEBUG = params.has('debug'), AUTO = params.has('autoplay'), HOLD = params.has('hold');
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const ROMAN = ['I', 'II', 'III'];
const STAGES = ['Day I', 'Night I', 'Day II', 'Night II', 'the Last Night', 'dawn'];

const cv = $('#cv');
const R = new Renderer(cv);
let g = null, bot = null, mode = 'title', tut = null;
let touch = matchMedia('(pointer: coarse)').matches;

function resize() {
  const w = innerWidth, h = innerHeight;
  const dpr = Math.min(touch ? 1.75 : 2, devicePixelRatio || 1);
  document.body.classList.toggle('land', w > h && h < 520);
  R.resize(w, h, dpr);
}
function setTouch(on) { if (touch === on) return; touch = on; document.body.classList.toggle('touch', on); resize(); renderKeys(); if (tut) showTut(); }
document.body.classList.toggle('touch', touch);
addEventListener('resize', resize);
resize();

// ------------------------------------------------------------------ input
const held = { up: false, down: false, left: false, right: false };
const inp = { attackDown: false, heavyDown: false, attackPressed: false, heavyPressed: false, roll: false, flask: false, flare: false, swap: false };
let mouse = { x: 0, y: 0, on: false };
let stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const KEYS = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'roll', ShiftLeft: 'roll', ShiftRight: 'roll', KeyL: 'roll', KeyE: 'flask', KeyR: 'flask', KeyF: 'flare', KeyQ: 'swap', KeyJ: 'strike', KeyK: 'heavy',
};
addEventListener('keydown', (e) => {
  unlock();
  const k = KEYS[e.code];
  if (mode === 'title') { if (e.code === 'Enter') $('#startBtn').click(); return; }
  if (mode === 'pause') { if (e.code === 'Escape' || e.code === 'KeyP') resume(); return; }
  if (mode === 'grace') { if (e.code === 'Escape' || e.code === 'Enter') closeGrace(); return; }
  if (mode === 'end') { if (e.code === 'Enter') ($('#emberBtn').hidden ? $('#againBtn') : $('#emberBtn')).click(); return; }
  if (mode !== 'play') return;
  if (e.code === 'Escape' || e.code === 'KeyP') { pause(); return; }
  if (e.code === 'Enter' && tut && tut.step === 7) { beginDay(); return; }
  if (!k) return;
  e.preventDefault();
  if (touch && !e.repeat) setTouch(false);
  if (k in held) { held[k] = true; return; }
  if (e.repeat) return;
  if (k === 'strike') { inp.attackDown = true; inp.attackPressed = true; mouse.on = false; }
  else if (k === 'heavy') { inp.heavyDown = true; inp.heavyPressed = true; mouse.on = false; }
  else inp[k] = true;
});
addEventListener('keyup', (e) => {
  const k = KEYS[e.code];
  if (k in held) held[k] = false;
  if (k === 'strike') inp.attackDown = false;
  if (k === 'heavy') inp.heavyDown = false;
});
addEventListener('blur', () => { for (const k in held) held[k] = false; inp.attackDown = inp.heavyDown = false; stickEnd(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && !DEMO && !AUTO) pause(); });

cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (e) => {
  unlock();
  if (e.pointerType === 'touch' || e.pointerType === 'pen') {
    setTouch(true);
    if (mode === 'play' && stick.id == null) { stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY }; cv.setPointerCapture?.(e.pointerId); showStick(); }
    return;
  }
  setTouch(false);
  mouse = { x: e.clientX, y: e.clientY, on: true };
  if (mode !== 'play') return;
  if (e.button === 0) { inp.attackDown = true; inp.attackPressed = true; }
  if (e.button === 2) { inp.heavyDown = true; inp.heavyPressed = true; }
});
addEventListener('pointermove', (e) => {
  if (e.pointerId === stick.id) { stick.x = e.clientX; stick.y = e.clientY; showStick(); return; }
  if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true; }
});
addEventListener('pointerup', (e) => {
  if (e.pointerId === stick.id) stickEnd();
  if (e.pointerType === 'mouse') { if (e.button === 0) inp.attackDown = false; if (e.button === 2) inp.heavyDown = false; }
});
addEventListener('pointercancel', (e) => { if (e.pointerId === stick.id) stickEnd(); });
function stickEnd() { stick.id = null; showStick(); }
function showStick() {
  const el = $('#stick');
  el.classList.toggle('on', stick.id != null);
  $('#stickHint').hidden = stick.id != null || (g && g.t > 25 && !tut);
  if (stick.id == null) return;
  el.style.left = stick.ox + 'px'; el.style.top = stick.oy + 'px';
  let dx = stick.x - stick.ox, dy = stick.y - stick.oy; const d = Math.hypot(dx, dy), max = 46;
  if (d > max) { dx *= max / d; dy *= max / d; }
  el.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`;
}
// touch buttons
function tbtn(id, down, up) {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); unlock(); setTouch(true); el.classList.add('on'); el.setPointerCapture?.(e.pointerId); down(); });
  const off = () => { el.classList.remove('on'); up && up(); };
  el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
}
tbtn('#bStrike', () => { inp.attackDown = true; inp.attackPressed = true; }, () => { inp.attackDown = false; });
tbtn('#bRoll', () => { inp.roll = true; });
tbtn('#bFlask', () => { inp.flask = true; });
tbtn('#bFlare', () => { inp.flare = true; });

function readInput() {
  const I = g.input;
  let mx = (held.right ? 1 : 0) - (held.left ? 1 : 0), my = (held.down ? 1 : 0) - (held.up ? 1 : 0);
  if (stick.id != null) { const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy); if (d > 8) { const k = Math.min(1, d / 46); mx = dx / d * k; my = dy / d * k; } }
  I.mx = mx; I.my = my;
  if (mouse.on && !touch) { const [sx, sy] = R.toScreen(g.p.x, g.p.y); I.aim = Math.atan2(mouse.y - sy, mouse.x - sx); } else I.aim = null;
  I.attackDown = inp.attackDown; I.heavyDown = inp.heavyDown;
  I.attackPressed = inp.attackPressed; I.heavyPressed = inp.heavyPressed; I.roll = inp.roll; I.flask = inp.flask; I.flare = inp.flare;
  if (inp.swap) swapWeapon();
  inp.attackPressed = inp.heavyPressed = inp.roll = inp.flask = inp.flare = inp.swap = false;
}
function swapWeapon() {
  const p = g.p; if (p.weapons.length < 2 || p.act) return;
  p.weapon = p.weapons[(p.weapons.indexOf(p.weapon) + 1) % p.weapons.length];
  toast(`<b>${WEAPONS[p.weapon].name}</b><br>${WEAPONS[p.weapon].desc}`);
  sfx.click();
}
$('#wpn')?.addEventListener('click', () => { if (g) swapWeapon(); });

// ------------------------------------------------------------------ ui helpers
let bannerT = 0;
function banner(big, sub = '', ms = 2600, red = false) {
  const b = $('#banner'); b.querySelector('.big').textContent = big; b.querySelector('.sub').textContent = sub;
  b.classList.toggle('red', red); b.classList.add('on'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('on'), ms);
}
function toast(html) {
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html; $('#toasts').append(t);
  setTimeout(() => t.remove(), 4600);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
}
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function renderKeys() {
  const rows = touch
    ? [['Left thumb', 'drag anywhere on the left to walk'], ['Strike', 'tap to strike, hold for a heavy blow'], ['Roll', 'tumble through attacks'], ['Flask', 'heal'], ['Flare', `burn ${FLARE_COST} oil to scorch everything in your light`], ['Weapon', 'tap its name, top left, to swap']]
    : [['WASD', 'walk'], ['Mouse', 'aim'], ['Click', 'strike; hold for a heavy blow (or right-click)'], ['Space', 'roll through attacks'], ['E', 'drink a flask'], ['F', `flare: burn ${FLARE_COST} oil to scorch everything in your light`], ['Q', 'swap weapon'], ['J / K', 'strike / heavy without a mouse (aims for you)']];
  $('#keyList').innerHTML = rows.map(([a, b]) => `<dt>${touch ? `<em>${a}</em>` : `<kbd>${a}</kbd>`}</dt><dd>${b}</dd>`).join('');
}
renderKeys();
$('#muteBtn').textContent = isMuted() ? '♪̸' : '♪';
$('#muteBtn').addEventListener('click', (e) => { setMuted(!isMuted()); e.currentTarget.textContent = isMuted() ? '♪̸' : '♪'; e.currentTarget.blur(); });
$('#pauseBtn').addEventListener('click', (e) => { e.currentTarget.blur(); pause(); });

// ------------------------------------------------------------------ flow
function attract() {
  g = new Game(DEMO ? 11 : 3 + Math.floor(Math.random() * 1000));
  // drop the walker beside the nearest camp
  const C = g.map.camps.slice().sort((a, b) => Math.hypot(a.x - 900, a.y - 900) - Math.hypot(b.x - 900, b.y - 900))[0];
  const p = g.p; p.x = C.x + 110; p.y = C.y + 70; p.oil = 68; g.clock = 40;
  for (let k = 0; k < 20 && blocked(g.map, p.x, p.y, 16); k++) p.x -= 10;
  bot = makeBot({ skill: 1 });
  R.frame(g, 0, { snap: true, lead: { x: 0, y: DEMO ? 0 : -R.h * 0.26 / R.cam.z } });
}

function newGame(withTut) {
  g = new Game(params.has('seed') ? +params.get('seed') : Math.floor(Math.random() * 1e6), { tutorial: withTut });
  bot = AUTO ? makeBot({ skill: 1 }) : null;
  mode = 'play';
  $('#title').hidden = true; $('#hud').hidden = false; $('#endSheet').hidden = true;
  document.body.classList.add('playing');
  $('#toasts').innerHTML = '';
  R.frame(g, 0, { snap: true });
  if (withTut) { tut = { step: 0, t: 0 }; placeCairn(); showTut(); }
  else { tut = null; $('#coach').hidden = true; banner('Day I', `Dusk comes in ${fmt(DAY_LEN)}. The bell will tell you.`, 3200); }
  showStick();
}
function placeCairn() {
  const g0 = g.map.graces[0];
  tut.cx = g0.x; tut.cy = g0.y - 270;
  for (let k = 0; k < 20 && blocked(g.map, tut.cx, tut.cy, 30); k++) tut.cy += 10;
}
$('#startBtn').addEventListener('click', () => { unlock(); newGame(!ls.get('lantern.tut')); });
$('#tutBtn').addEventListener('click', () => { unlock(); newGame(true); });

function pause() { if (mode !== 'play') return; mode = 'pause'; $('#pauseSheet').hidden = false; stickEnd(); resetHeld(); }
function resume() { mode = 'play'; $('#pauseSheet').hidden = true; last = performance.now(); }
function resetHeld() { for (const k in held) held[k] = false; inp.attackDown = inp.heavyDown = false; for (const b of document.querySelectorAll('.tb.on')) b.classList.remove('on'); }
$('#resumeBtn').addEventListener('click', resume);
$('#quitBtn').addEventListener('click', () => { $('#pauseSheet').hidden = true; toTitle(); });
function toTitle() {
  mode = 'title'; tut = null; $('#coach').hidden = true; $('#hud').hidden = true; $('#endSheet').hidden = true; $('#graceSheet').hidden = true;
  $('#toasts').innerHTML = ''; document.body.classList.remove('playing'); $('#title').hidden = false; $('#banner').classList.remove('on');
  showBest(); attract();
}
function showBest() {
  const b = ls.get('lantern.best', { stage: -1, wins: 0 });
  $('#best').textContent = b.wins ? `The Nightlord has fallen ${b.wins === 1 ? 'once' : b.wins + ' times'}` : b.stage >= 0 ? `Furthest: ${STAGES[b.stage]}` : '';
}
function stageOf() { if (g.phase === 'won') return 5; return g.day * 2 + (g.boss || g.phase === 'night' ? 1 : 0); }
function saveBest(won) {
  const b = ls.get('lantern.best', { stage: -1, wins: 0 });
  b.stage = Math.max(b.stage, stageOf()); if (won) b.wins++;
  ls.set('lantern.best', b);
}

// grace sheet
let graceIdx = -1;
function openGrace(i, refill) {
  graceIdx = i; mode = 'grace'; resetHeld(); stickEnd();
  const gr = g.map.graces[i];
  $('#graceName').textContent = gr.name;
  $('#graceLede').textContent = refill ? 'You kneel. Your flasks are full again.' : 'You have rested here today. The flasks fill once a day at each chapel.';
  fillGrace(); $('#graceSheet').hidden = false;
}
function fillGrace() {
  const p = g.p, c = g.levelCost();
  $('#graceRunes').innerHTML = `Runes <b>${p.runes}</b> · Level <b>${p.level}</b> · next level costs <b>${c}</b>`;
  for (const b of document.querySelectorAll('.lvl button')) b.disabled = p.runes < c;
}
for (const b of document.querySelectorAll('.lvl button')) b.addEventListener('click', () => { if (g.levelUp(b.dataset.s)) { fillGrace(); } });
function closeGrace() { mode = 'play'; $('#graceSheet').hidden = true; last = performance.now(); }
$('#riseBtn').addEventListener('click', closeGrace);

// end
function showEnd() {
  mode = 'end'; resetHeld(); stickEnd();
  const won = g.phase === 'won', s = g.stats;
  saveBest(won);
  $('#endTitle').textContent = won ? 'The Nightlord is ash' : 'The lamp goes out';
  const canEmber = !won && g.boss && g.embers > 0;
  $('#endLede').textContent = won ? 'Morning comes over the moor, grey and ordinary. You blow out the lantern yourself.'
    : canEmber ? `You still carry one ember. Rekindle it and face ${g.boss.name} again, whole.`
    : g.boss ? `${g.boss.name} stands over the last of the oil.` : 'Something in the dark was patient.';
  $('#endStats').innerHTML = `Reached <b>${STAGES[stageOf()]}</b><br>Camps cleared <b>${s.camps}</b> · Shades put down <b>${s.kills}</b><br>Servants of the Night <b>${s.bosses}</b> · Level <b>${g.p.level}</b>`;
  $('#emberBtn').hidden = !canEmber;
  $('#endSheet').hidden = false;
}
$('#emberBtn').addEventListener('click', () => { g.rekindle(); mode = 'play'; $('#endSheet').hidden = true; last = performance.now(); banner(g.boss.name, 'Again.', 2200); });
$('#againBtn').addEventListener('click', () => newGame(false));
$('#homeBtn').addEventListener('click', toTitle);

// ------------------------------------------------------------------ tutorial
const TUT = [
  { step: 'I · Walk', d: () => `Walk out of the chapel to the <em>cairn</em> to the north. ${touch ? 'Put a thumb down on the left of the screen and drag.' : 'Use <kbd>WASD</kbd>.'}` },
  { step: 'II · Strike', d: () => `A <em>Shade</em>. Out in the dark it's only a shadow, and your blade passes straight through. Let it come into your light, then strike: ${touch ? 'tap <em>Strike</em>' : '<kbd>click</kbd>'}.` },
  { step: 'III · Roll', d: () => `When a Shade raises its arms, a <span style="color:var(--red)">red wedge</span> shows where it will hit. <em>Roll</em> through it as it swings: ${touch ? 'tap <em>Roll</em>' : '<kbd>Space</kbd>'}.` },
  { step: 'IV · Heavy', d: () => `Now <em>hold</em> ${touch ? 'Strike' : 'the mouse button'} to wind up a heavy blow, and let go when the ring closes. Heavy blows stagger.` },
  { step: 'V · Flare', d: () => `More of them. <em>Flare</em> your lantern: ${touch ? 'tap the sun button' : '<kbd>F</kbd>'}. It scorches everything in your light, but it costs ${FLARE_COST} oil, and oil <em>is</em> your light.` },
  { step: 'VI · Finish', d: () => 'Finish them. Watch the wisp: its cold bolts fly out of the dark.' },
  { step: 'VII · Flask', d: () => `Drink from a <em>flask</em> to heal: ${touch ? 'tap the flask' : '<kbd>E</kbd>'}. Chapels refill them, once a day each.` },
  { step: 'Dusk', d: () => 'Your oil burns down all day, and the light shrinks with it. When the bell rings at dusk, something comes out of the Night for whatever light you have left. Clear camps for runes, oil and better weapons. Spend runes at a chapel.', go: 'Begin the day' },
];
function showTut() {
  const s = TUT[tut.step], c = $('#coach');
  c.hidden = false; c.querySelector('.step').textContent = s.step; c.querySelector('p').innerHTML = s.d() + (tut.note ? `<br><i style="color:var(--dim)">${tut.note}</i>` : '');
  const go = c.querySelector('.go'); go.hidden = !s.go; if (s.go) go.textContent = s.go;
  $('#skipTut').hidden = !!s.go;
}
$('#coach .go').addEventListener('click', beginDay);
$('#skipTut').addEventListener('click', beginDay);
function tutAdvance(n) { tut.step = n; tut.t = 0; tut.note = ''; showTut(); sfx.grace();
  if (n === 1 || n === 2) g.tutSpawn('dummy');
  if (n === 4) { g.tutSpawn('hound'); g.tutSpawn('hound'); g.tutSpawn('dummy'); }
  if (n === 5) g.tutSpawn('wisp');
  if (n === 6) g.p.hp = Math.min(g.p.hp, g.p.maxHp - 40);
}
function tutTick(dt) {
  tut.t += dt;
  const p = g.p, alive = g.foes.filter(f => f.tut).length;
  if (tut.step === 0 && Math.hypot(p.x - tut.cx, p.y - tut.cy) < 46) tutAdvance(1);
  else if (tut.step === 1 && !alive) tutAdvance(2);
  else if (tut.step === 3 && !alive) g.tutSpawn('dummy');
  else if (tut.step === 5 && !alive) tutAdvance(6);
  else if (tut.step === 2 && !alive) g.tutSpawn('dummy');
  if (p.hp < 30 && tut.step < 6) p.hp = 30; // nobody dies in the lesson
}
function tutEvent(e) {
  if (!tut) return;
  if (tut.step === 2 && e.t === 'dodge') { tutAdvance(3); }
  else if (tut.step === 2 && e.t === 'hurt') { tut.note = 'Roll the moment it swings, not before.'; showTut(); }
  else if (tut.step === 1 && e.t === 'ghost') { tut.note = 'It was still in the dark. Wait for it to step into the light.'; showTut(); }
  else if (tut.step === 3 && e.t === 'hit' && e.heavy) tutAdvance(4);
  else if (tut.step === 3 && e.t === 'hit' && !e.heavy && tut.t > 2) { tut.note = 'Hold longer: the ring closes, then let go.'; showTut(); }
  else if (tut.step === 4 && e.t === 'flare') tutAdvance(5);
  else if (tut.step === 6 && e.t === 'healed') tutAdvance(7);
}
function beginDay() {
  if (!tut) return;
  ls.set('lantern.tut', 1);
  tut = null; $('#coach').hidden = true;
  g.tutorial = false;
  g.foes = []; g.shots = [];
  const p = g.p; p.hp = p.maxHp; p.flasks = p.maxFlasks; p.oil = 100; p.st = p.maxSt;
  g.clock = 0; g.populate();
  banner('Day I', `Dusk comes in ${fmt(DAY_LEN)}. The bell will tell you.`, 3200);
  sfx.weapon();
}

// ------------------------------------------------------------------ events
function onEvents() {
  for (const e of g.events) {
    tutEvent(e);
    const S = sfx[e.t];
    switch (e.t) {
      case 'swing': sfx.swing(e.heavy); break;
      case 'hit': sfx.hit(e.heavy); break;
      case 'bell': sfx.bell(e.last); banner(e.last ? 'The Last Night' : 'The bell', e.last ? 'No dawn this time until it is done.' : 'Dusk. Night falls on the moor.', 3000, true); break;
      case 'boss': sfx.boss(); setTimeout(() => g && g.boss && banner(g.boss.name, g.boss.title, 2600), 300); break;
      case 'bossdown': sfx.bossdown(); banner(e.name, 'falls back into the dark', 2600); break;
      case 'dawn': setTimeout(() => sfx.dawn(), 1200); setTimeout(() => g && g.phase === 'dawn' && banner(`Day ${ROMAN[g.day + 1]}`, g.day + 1 === 2 ? '' : 'Morning. +35 oil, your flasks are full, and the camps have filled again.', 3400), 1500); break;
      case 'grace':
        if (g.tutorial) break;
        sfx.grace();
        if (g.p.runes >= g.levelCost() && !g.boss && !bot) setTimeout(() => mode === 'play' && openGrace(e.i, e.refill), 250);
        else if (e.refill) toast(`<b>${g.map.graces[e.i].name}</b><br>Your flasks are full again.`);
        if (bot) botLevel(g, bot);
        break;
      case 'weapon': sfx.weapon(); toast(`<b>${WEAPONS[e.w].name}</b><br>${WEAPONS[e.w].desc}<br><i>${touch ? 'Tap its name, top left' : 'Press Q'} to swap back.</i>`); break;
      case 'cleared': sfx.cleared(); toast(`<b>${e.name}</b> is quiet. Its chest is open to you.`); break;
      case 'oil': sfx.oil(); break;
      case 'phase2': sfx.phase2(); break;
      case 'eclipse': sfx.eclipse(); break;
      case 'level': sfx.level(); break;
      case 'won': setTimeout(() => sfx.dawn(), 600); break;
      default: if (S && e.t !== 'died') S();
    }
    if (e.t === 'died') { sfx.died(); }
  }
}

// ------------------------------------------------------------------ hud
const H = { hp: $('#hpb .v'), hpl: $('#hpb .lag'), st: $('#stb .v'), oil: $('#oilb .v'), oilb: $('#oilb'), cost: $('#oilb .cost'), oiln: $('#oiln'), day: $('#dayl'), runes: $('#runes'), flasks: $('#flasks'), bossbar: $('#bossbar'), bossName: $('#bossName'), boss: $('#bossb .v'), bossl: $('#bossb .lag') };
let hudKey = '';
function hud() {
  const p = g.p;
  const pct = (v, m) => Math.max(0, Math.min(100, v / m * 100)) + '%';
  $('#hpb').style.width = Math.min(100, 60 + p.maxHp * 0.3) + '%';
  H.hp.style.width = pct(p.hp, p.maxHp); H.hpl.style.width = pct(p.hp, p.maxHp);
  H.st.style.width = pct(p.st, p.maxSt);
  H.oil.style.width = pct(p.oil, 100); H.cost.style.left = FLARE_COST + '%';
  H.oilb.classList.toggle('low', p.oil < 20);
  const dayTxt = g.phase === 'day' ? (g.tutorial ? `<b>Day I</b> · the sun stands still` : `<b>Day ${ROMAN[g.day]}</b> · dusk in ${fmt(DAY_LEN - g.clock)}`) : g.phase === 'dawn' ? `<b>Dawn</b>` : g.day === 2 ? '<b>The Last Night</b>' : `<b>Night ${ROMAN[g.day]}</b>`;
  const key = [dayTxt, Math.ceil(p.oil), p.runes, p.flasks, p.maxFlasks, p.weapon, p.weapons.length, p.oil >= FLARE_COST].join('|');
  if (key !== hudKey) {
    hudKey = key;
    H.day.innerHTML = dayTxt;
    H.oiln.textContent = p.oil <= 0 ? 'the lamp is dry' : `oil ${Math.ceil(p.oil)}`;
    H.runes.innerHTML = `${p.runes}<small>runes</small>`;
    H.flasks.innerHTML = Array.from({ length: p.maxFlasks }, (_, i) => `<i class="${i < p.flasks ? '' : 'used'}"></i>`).join('') + `<button id="wpn" title="Swap weapon">${WEAPONS[p.weapon].short}${p.weapons.length > 1 ? ' ⇄' : ''}</button>`;
    $('#wpn').addEventListener('click', (e) => { e.stopPropagation(); swapWeapon(); });
    $('#wpn').addEventListener('pointerdown', (e) => e.stopPropagation());
    $('#flaskN').textContent = p.flasks;
    $('#bFlask').classList.toggle('off', p.flasks <= 0);
    $('#bFlare').classList.toggle('off', p.oil < FLARE_COST);
  }
  const b = g.boss;
  H.bossbar.hidden = !b;
  if (b) { H.bossName.textContent = b.name; H.boss.style.width = pct(b.hp, b.maxHp); H.bossl.style.width = pct(b.hp, b.maxHp); }
}

// markers at the screen edge: chapels, camps, the cairn
function markers() {
  const x = R.ctx, dpr = R.dpr, w = R.w, h = R.h;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const top = 70, bot = touch ? 30 : 20;
  const mark = (wx, wy, kind) => {
    let [sx, sy] = R.toScreen(wx, wy);
    const on = sx > 20 && sx < w - 20 && sy > top && sy < h - bot;
    if (on && kind !== 'cairn') return;
    const cx = w / 2, cy = h / 2, dx = sx - cx, dy = sy - cy;
    if (!on) { const k = Math.min((w / 2 - 22) / Math.abs(dx || 1e-6), (h / 2 - (dy < 0 ? top : bot + 10)) / Math.abs(dy || 1e-6)); sx = cx + dx * k; sy = cy + dy * k; }
    x.save(); x.translate(sx, sy); x.lineWidth = 1.5;
    if (kind === 'grace') { x.strokeStyle = '#f0b85a'; x.beginPath(); x.moveTo(0, -8); x.lineTo(0, 8); x.moveTo(-5, -3); x.lineTo(5, -3); x.stroke(); }
    else if (kind === 'camp') { x.strokeStyle = 'rgba(226,73,47,.8)'; x.beginPath(); x.moveTo(-6, 5); x.lineTo(0, -7); x.lineTo(6, 5); x.closePath(); x.stroke(); }
    else if (kind === 'chest') { x.strokeStyle = '#f1e4c4'; x.strokeRect(-6, -4, 12, 8); }
    else if (kind === 'cairn') { const t = performance.now() / 1000; x.strokeStyle = '#f0b85a'; x.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4); x.beginPath(); x.arc(0, 0, on ? 22 * R.cam.z + 6 : 8, 0, Math.PI * 2); x.stroke(); if (!on) { x.beginPath(); x.arc(0, 0, 3, 0, 7); x.fillStyle = '#f0b85a'; x.fill(); } }
    if (!on) { const a = Math.atan2(dy, dx); x.rotate(a); x.globalAlpha = 0.7; x.beginPath(); x.moveTo(14, 0); x.lineTo(10, -3); x.lineTo(10, 3); x.closePath(); x.fillStyle = x.strokeStyle; x.fill(); }
    x.restore();
  };
  if (tut && tut.step === 0) mark(tut.cx, tut.cy, 'cairn');
  if (tut) return;
  for (const gr of g.map.graces) mark(gr.x, gr.y, 'grace');
  if (!g.boss) {
    const p = g.p;
    const left = g.map.camps.filter(c => !c.opened).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 2);
    for (const c of left) mark(c.x, c.y, c.cleared ? 'chest' : 'camp');
  }
}

// ------------------------------------------------------------------ loop
let last = performance.now(), acc = 0;
const DT = 1 / 60;
function frame(now) {
  requestAnimationFrame(frame);
  let fdt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
  if (HOLD) fdt = 0;
  advance(fdt);
}
function advance(fdt) {
  if (!g) return;
  const live = (mode === 'play' || mode === 'title') && !(DEMO && demoFrozen());
  if (live) {
    acc += fdt * (DEBUG && params.has('speed') ? +params.get('speed') : 1);
    let n = 0;
    while (acc >= DT && n++ < 8) {
      if (mode === 'title' || bot) { const I = botInput(g, bot, DT); if (DEMO) I.flare = false; Object.assign(g.input, I); if (mode === 'title') for (const e of g.events) if (e.t === 'grace') botLevel(g, bot); }
      else readInput();
      g.step(DT);
      if (tut) tutTick(DT);
      if (mode === 'play') { onEvents(); if (g.phase === 'dead' && g.phaseT > 1.6) { showEnd(); } else if (g.phase === 'won' && g.phaseT > 3) showEnd(); }
      if (mode === 'title' && (g.phase === 'dead' || g.phase === 'won' || g.phase === 'dusk')) { attract(); }
      R.frame(g, DT, mode === 'title' ? { lead: { x: 0, y: -R.h * 0.26 / R.cam.z } } : {});
      g.events.length = 0;
      acc -= DT;
      if (DEMO && demoFrozen()) { acc = 0; break; }
    }
    if (acc > DT) acc = 0;
  }
  R.draw(g, fdt);
  if (mode !== 'title') { hud(); markers(); }
  setMood(g.p.oil, g.phase === 'night' || g.phase === 'dusk');
}

// the preview: play a moment of a camp fight, then hold on a frame with a strike coming
let frozen = false;
function demoFrozen() {
  if (frozen) return true;
  if (g.t > 1.4 && (g.foes.some(f => f.state === 'wind' && f.lit && f.st > 0.3 && f.type !== 'wisp') || g.t > 3.2)) frozen = true;
  return frozen;
}
if (DEMO) {
  attract(); mode = 'play'; bot = makeBot({ skill: 1 });
  { const C = g.map.camps.slice().sort((a, b) => Math.hypot(a.x - 900, a.y - 900) - Math.hypot(b.x - 900, b.y - 900))[0]; g.p.x = C.x + 150; g.p.y = C.y + 40; g.p.oil = 58; g.p.st = 70; g.p.hp = 74; g.p.runes = 115;
    for (const [t, dx, dy] of [['shade', 60, -40], ['wisp', -40, 60], ['hound', 0, -90], ['shade', 90, 90]]) { const f = g.spawn(t, C.x + dx, C.y + dy, C); f.aggro = true; } }
  $('#title').hidden = true; $('#hud').hidden = false; document.body.classList.add('playing');
  for (let i = 0; i < 60 * 1.2; i++) { Object.assign(g.input, botInput(g, bot, DT)); g.input.flare = false; g.step(DT); R.frame(g, DT); g.events.length = 0; }
} else if (AUTO) { newGame(false); }
else { showBest(); attract(); }
requestAnimationFrame(frame);
window.toyboxReady?.();

if (DEBUG || AUTO) {
  window.L = {
    get g() { return g; }, get mode() { return mode; }, get tut() { return tut; }, R,
    ff(sec) { for (let i = 0; i < sec * 60; i++) advance(DT); },
    newGame, beginDay, openGrace, showEnd, inp, held,
  };
}
