import { Game, WEAPONS, WEAPON_ORDER, learnHabits, emptyHabits, habitCount, habitText, habitUse, HABIT_KEYS } from './game.js';
import { View } from './render.js';
import { Sound } from './sound.js';
import { Bot } from './bot.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug');
const SAVE_KEY = 'mirrorknight.v1';
const DT = 1 / 60;

// ------------------------------------------------------------- save
const blank = () => ({ habits: emptyHabits(), knightWeapon: 'sword', attempts: 0, wins: 0, practiced: false, weapon: 'sword', sound: true });
let save = blank();
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.habits) save = { ...blank(), ...s, habits: { ...emptyHabits(), ...s.habits } }; } catch {}
const persist = () => { if (DEMO) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} };

// ------------------------------------------------------------- state
const view = new View($('field'));
const snd = new Sound(); snd.on = save.sound;
let g = null, mode = 'title', bot = null, paused = false, hitstop = 0, tut = null, endT = 0, endShown = false;
let pick = save.weapon || 'sword';
let touchMode = matchMedia('(pointer: coarse)').matches;
const hold = DEBUG && Q.has('hold');

function setTouch(on) { touchMode = on; document.body.classList.toggle('touch', on); layout(); }
setTouch(touchMode);

function layout() {
  const w = innerWidth, h = innerHeight;
  // phones held upright keep the thumb pad under the arena; held sideways the pad sits beside it
  const side = touchMode && w > h * 1.2;
  const top = mode === 'tutorial' ? (touchMode ? 210 : 190) : 70, bot = touchMode && !side ? 240 : 64;
  view.resize(w, h, Math.min(2, devicePixelRatio || 1), { t: mode === 'fight' || mode === 'tutorial' ? top : 0, b: mode === 'fight' || mode === 'tutorial' ? bot : 0 });
}
addEventListener('resize', layout);

function show(id) {
  for (const s of ['title', 'arms', 'learned', 'won', 'pause']) $(s).hidden = s !== id;
}

// ------------------------------------------------------------- screens
function toTitle() {
  mode = 'title'; g = idleGame(); bot = new Bot(g, { seed: 3, skill: .8 }); layout();
  show('title'); hud(false); $('tut').hidden = true; $('tutSkip').hidden = true; $('pad').classList.remove('on');
  $('tForget').hidden = !save.attempts;
  $('tRec').textContent = save.attempts ? `${save.attempts} attempt${save.attempts === 1 ? '' : 's'} · ${save.wins} victor${save.wins === 1 ? 'y' : 'ies'} · it knows ${habitCount(save.habits)} of your habits` : '';
  $('tFight').textContent = save.attempts ? 'Enter' : 'Enter';
  $('tPractice').textContent = save.practiced ? 'Practice again' : 'Practice first';
  $('tFight').classList.toggle('hot', !!save.practiced || !!save.attempts);
  $('tPractice').classList.toggle('hot', !save.practiced && !save.attempts);
  $('tPractice').classList.toggle('quiet', !!save.practiced || !!save.attempts);
  $('tPractice').classList.toggle('btn', true);
}
function idleGame() {
  const gg = new Game({ weapon: WEAPON_ORDER[(Math.random() * 5) | 0], knightWeapon: save.knightWeapon, habits: save.habits, seed: 5 });
  gg.k.hp = gg.k.maxHp = 1e9; gg.p.hp = gg.p.maxHp = 1e9; return gg;
}

const GLYPH = {
  sword: '<path d="M18 56 L50 24 L55 19 L54 25 L22 58Z" fill="#ebe5d6" stroke="#050505" stroke-width="1.5"/><path d="M14 52 L26 62 M19 57 L12 64" stroke="#ebe5d6" stroke-width="3.5" stroke-linecap="round"/><path d="M24 50 L52 22" stroke="var(--c)" stroke-width="1.6"/>',
  great: '<path d="M16 58 L52 18 L60 12 L58 21 L22 62Z" fill="#ebe5d6" stroke="#050505" stroke-width="1.5"/><path d="M10 52 L26 66 M17 59 L9 67" stroke="#ebe5d6" stroke-width="4.5" stroke-linecap="round"/><path d="M22 52 L56 16" stroke="var(--c)" stroke-width="2"/>',
  spear: '<path d="M10 66 L52 24" stroke="#ebe5d6" stroke-width="3"/><path d="M50 22 L64 10 L58 28Z" fill="var(--c)" stroke="#ebe5d6" stroke-width="1.2"/>',
  bow: '<path d="M22 12 Q62 38 22 64" fill="none" stroke="var(--c)" stroke-width="4"/><path d="M22 12 L22 64" stroke="#ebe5d6" stroke-width="1.2"/><path d="M12 38 L58 38 M52 33 L60 38 L52 43" stroke="#ebe5d6" stroke-width="2" fill="none"/>',
  seal: '<circle cx="38" cy="38" r="20" fill="none" stroke="var(--c)" stroke-width="3"/><circle cx="38" cy="38" r="12" fill="#ebe5d6"/><path d="M38 20 L38 56 M20 38 L56 38" stroke="#050505" stroke-width="2"/><circle cx="38" cy="38" r="27" fill="none" stroke="var(--c)" stroke-width="1" opacity=".5"/>',
};

function toArms() {
  mode = 'arms'; show('arms'); hud(false); $('tut').hidden = true; $('tutSkip').hidden = true; $('pad').classList.remove('on');
  if (!g || g.tutorial || g.over || !bot) { g = idleGame(); bot = new Bot(g, { seed: 9, skill: .8 }); }
  layout();
  const H = save.habits, kw = WEAPONS[save.knightWeapon];
  const known = HABIT_KEYS.filter(k => H[k]);
  $('knows').innerHTML = `<div class="head"><span>The knight carries <b style="color:${kw.accent}">${save.attempts ? 'your ' : 'a '}${kw.name.toLowerCase()}</b></span><span>${known.length ? `it knows ${known.length} habit${known.length > 1 ? 's' : ''}` : ''}</span></div>` +
    (known.length ? `<ul>${known.map(k => `<li>${cap(habitText(k, H[k]))}.<i>${habitUse(k, H[k])}</i></li>`).join('')}</ul>`
      : `<div class="none">${save.attempts ? 'Nothing it can use. You fought like a stranger.' : 'Nothing yet. It is watching. Whatever you do this time, it will learn.'}</div>`);
  $('weps').innerHTML = WEAPON_ORDER.map((id, i) => {
    const w = WEAPONS[id];
    return `<button class="wep${id === pick ? ' on' : ''}" data-w="${id}" style="--c:${w.accent}"><i class="bar"></i><span class="k">${i + 1}</span><svg viewBox="0 0 76 76">${GLYPH[id]}</svg><b>${w.name}</b><span>${w.blurb}</span></button>`;
  }).join('');
  for (const b of $('weps').children) b.onclick = () => { pickWeapon(b.dataset.w); snd.init(); snd.tick(); };
  $('aGo').focus({ preventScroll: true });
}
const cap = s => s[0].toUpperCase() + s.slice(1);
function pickWeapon(id) {
  pick = id; save.weapon = id; persist();
  for (const b of $('weps').children) b.classList.toggle('on', b.dataset.w === id);
}

function startFight() {
  snd.init();
  mode = 'fight'; show(null); hud(true); $('tut').hidden = true; $('tutSkip').hidden = true;
  g = new Game({ weapon: pick, knightWeapon: save.knightWeapon, habits: save.habits });
  bot = null; endShown = false; endT = 0; paused = false;
  $('pad').classList.add('on'); layout(); view.frame(g, 0, { snap: true });
  setBossWeapon();
  say(save.attempts === 0 ? 'It watches you.' : habitCount(save.habits) ? 'It remembers you.' : 'It does not know you.', 2.2);
}
function setBossWeapon() {
  const kw = g.k.w;
  $('bossWep').textContent = kw.name; $('boss').style.setProperty('--c', kw.accent);
  $('bLight').style.setProperty('--c', g.p.w.accent);
  $('cracks').innerHTML = '<i></i>'.repeat(habitCount(g.habits));
  $('bLight').textContent = g.p.w.id === 'bow' ? 'Shoot' : g.p.w.id === 'seal' ? 'Cast' : 'Strike';
  $('bHeavy').textContent = g.p.w.id === 'bow' ? 'Draw' : g.p.w.id === 'seal' ? 'Ring' : 'Heavy';
}

// ------------------------------------------------------------- tutorial
const TUT = [
  { head: 'Walk', text: 'Step into the chalk circle.', how: '<span class="k-only"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrow keys</span><span class="t-only">Drag your left thumb anywhere on the left half</span>', need: 1 },
  { head: 'Strike', text: 'Hit the practice mirror three times. Tap again mid-swing to chain a string. Each swing costs stamina, the thin bar.', how: '<span class="k-only"><kbd>J</kbd> or left click</span><span class="t-only">Tap <b>Strike</b></span>', need: 3 },
  { head: 'Heavy blow', text: 'Slow to start, hard to stop. Heavy blows break a knight’s guard.', how: '<span class="k-only"><kbd>K</kbd> or right click</span><span class="t-only">Tap <b>Heavy</b></span>', need: 1 },
  { head: 'Roll', text: 'Watch for the glint and the marked ground. Roll as the arm swings: mid-roll, nothing can touch you.', how: '<span class="k-only"><kbd>Space</kbd>, with a direction</span><span class="t-only">Tap <b>Roll</b> while steering</span>', need: 2 },
  { head: 'Drink', text: 'You’re hurt. Drink a flask: it heals, but you walk slowly while you do. You get three.', how: '<span class="k-only"><kbd>E</kbd></span><span class="t-only">Tap <b>Flask</b></span>', need: 1 },
];
function startTutorial() {
  snd.init();
  mode = 'tutorial'; show(null); hud(true); $('boss').hidden = true;
  g = new Game({ tutorial: true, weapon: 'sword', knightWeapon: 'sword' });
  g.k.x = 0; g.k.y = -40; g.p.x = 0; g.p.y = 130;
  bot = null; tut = { i: 0, mark: { x: -150, y: 60, r: 28 }, base: 0, doneT: 0 };
  $('pad').classList.add('on'); $('tut').hidden = false; $('tutSkip').hidden = false; $('tutActs').hidden = true;
  layout(); view.frame(g, 0, { snap: true }); setBossWeapon(); tutShow();
}
function tutShow() {
  const s = TUT[tut.i];
  if (!s) {
    $('tutStep').textContent = 'Practice · done';
    $('tutHead').textContent = 'One more thing';
    $('tutText').innerHTML = 'The Mirror Knight watches how you fight, and learns. Roll left every time and it will roll left too, and swing at where you land. Strike twice and stop, and it will strike as you stop.<br><b>Change how you fight, and it can’t keep up.</b>';
    $('tutHow').innerHTML = ''; $('tutProg').innerHTML = ''; $('tutActs').hidden = false; $('tutSkip').hidden = true;
    save.practiced = true; persist(); return;
  }
  $('tutStep').textContent = `Practice · ${tut.i + 1} of ${TUT.length}`;
  $('tutHead').textContent = s.head; $('tutText').textContent = s.text; $('tutHow').innerHTML = s.how;
  tutProg(0);
}
function tutProg(n) { const s = TUT[tut.i]; $('tutProg').innerHTML = s.need > 1 ? Array.from({ length: s.need }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('') : ''; }
function tutCount() {
  const T = g.tut;
  switch (tut.i) {
    case 0: if (Math.hypot(g.p.x - tut.mark.x, g.p.y - tut.mark.y) < tut.mark.r + 6) tut.reached = 1; return tut.reached || 0;
    case 1: return T.lightHits - tut.base;
    case 2: return T.heavyHits - tut.base;
    case 3: return T.evades - tut.base;
    case 4: return T.drank - tut.base;
  }
  return 0;
}
function tutTick(dt) {
  if (!tut || tut.i >= TUT.length) return;
  const n = tutCount(), s = TUT[tut.i];
  if (n !== tut.last) { tut.last = n; tutProg(Math.min(n, s.need)); if (n > 0 && tut.i > 0) snd.tick(); }
  if (tut.i !== 4 && g.p.hp < 60) g.p.hp = 60;
  g.p.flasks = Math.max(g.p.flasks, 1);
  if (n >= s.need) {
    tut.doneT += dt;
    if (tut.doneT > .5) {
      tut.doneT = 0; tut.i++; tut.last = -1;
      const T = g.tut; tut.base = [0, T.lightHits, T.heavyHits, T.evades, T.drank][tut.i] ?? 0;
      g.dummySwing = tut.i === 3;
      if (tut.i === 4) { g.p.hp = 42; g.p.flasks = 3; g.dummySwing = false; }
      snd.heal(); tutShow();
    }
  }
}

// ------------------------------------------------------------- HUD
const lag = { p: 1, k: 1 };
function hud(on) { $('hud').hidden = !on; $('boss').hidden = !on; }
function updateHud(dt) {
  if (!g) return;
  const p = g.p, k = g.k;
  const hp = Math.max(0, p.hp / p.maxHp), kh = Math.max(0, k.hp / k.maxHp);
  lag.p = Math.max(hp, lag.p - dt * .35); if (lag.p < hp) lag.p = hp;
  lag.k = Math.max(kh, lag.k - dt * .25); if (lag.k < kh) lag.k = kh;
  $('hpFill').style.transform = `scaleX(${hp})`; $('hpLag').style.transform = `scaleX(${lag.p})`;
  $('stFill').style.transform = `scaleX(${Math.max(0, p.st / 100)})`; $('stBar').classList.toggle('low', p.st < 20);
  $('bFill').style.transform = `scaleX(${kh})`; $('bLag').style.transform = `scaleX(${lag.k})`;
  const fl = $('flasks'); if (fl.dataset.n !== String(p.flasks)) { fl.dataset.n = p.flasks; fl.innerHTML = Array.from({ length: 3 }, (_, i) => `<i class="flask${i < p.flasks ? '' : ' gone'}"></i>`).join(''); }
}

let sayT = 0;
function say(text, dur = 2) { $('say').textContent = text; $('say').classList.add('on'); sayT = dur; }

// ------------------------------------------------------------- events → sound
function handleEvents(events) {
  for (const e of events) {
    switch (e.type) {
      case 'wind': if (e.who === 'k' && mode !== 'title' && mode !== 'arms') snd.glint(e.tag !== 'light'); break;
      case 'act': if (e.kind === 'shot' || e.kind === 'volley') snd.shot(e.who === 'k' ? g.k.w.id : g.p.w.id); else if (e.kind !== 'pillars') snd.swing(e.tag !== 'light'); break;
      case 'hit': if (e.who === 'k') snd.clank(e.heavy); else snd.thud(); hitstop = Math.max(hitstop, e.heavy ? .11 : .06); break;
      case 'evade': if (e.who === 'p') snd.evade(); break;
      case 'dodge': snd.roll(); break;
      case 'drink': snd.drink(); break;
      case 'heal': snd.heal(); break;
      case 'zone': snd.zone(); break;
      case 'break': snd.break_(); say('Its guard breaks.', 1.2); break;
      case 'phase':
        snd.phase(); hitstop = .25;
        say(e.phase === 2 ? 'The Mirror Knight remembers.' : habitCount(g.habits) ? 'It uses everything it knows.' : 'It has nothing left to copy.', 2.4);
        break;
      case 'empty': snd.empty(); say('No flasks left.', 1); break;
      case 'lost': if (mode === 'fight') { snd.died(); } break;
      case 'won': if (mode === 'fight') snd.won(); break;
    }
  }
}

// ------------------------------------------------------------- end of a fight
function endFight() {
  endShown = true;
  const result = g.over;
  save.attempts++;
  const usedWeapon = g.p.w.id, oldWeapon = save.knightWeapon;
  const L = learnHabits(save.habits, g.track, g.t);
  save.habits = L.habits; save.knightWeapon = usedWeapon;
  if (result === 'won') save.wins++;
  persist();
  banner(result === 'won' ? 'Mirror Shattered' : 'YOU DIED', result === 'won' ? 'bone' : '', result === 'won' ? '' : '');
  setTimeout(() => banner(null), result === 'won' ? 2600 : 2900);
  setTimeout(() => {
    if (result === 'won') {
      show('won');
      const n = habitCount(L.habits);
      $('wText').innerHTML = `${save.attempts} attempt${save.attempts > 1 ? 's' : ''}, ${Math.round(g.t)} seconds, ${g.p.flasks} flask${g.p.flasks === 1 ? '' : 's'} to spare.<br>` +
        (habitCount(g.habits) ? `It knew ${habitCount(g.habits)} of your habits going in, and it still broke.` : 'It knew nothing it could use against you.') +
        (n ? `<br>It has still learned: ${HABIT_KEYS.filter(k => L.habits[k]).map(k => habitText(k, L.habits[k])).join('; ')}.` : '');
      $('wAgain').focus({ preventScroll: true });
    } else {
      show('learned');
      const lines = [];
      for (const [k, v] of L.learned) lines.push(`<div>&hellip;that ${habitText(k, v)}.</div>`);
      for (const [k, v] of L.forgot) if (!L.learned.some(([k2]) => k2 === k)) lines.push(`<div class="forgot">A crack seals. It no longer expects that ${habitText(k, v)}.</div>`);
      if (!L.learned.length && !L.forgot.length) lines.push(`<div class="forgot">&hellip;nothing new. You surprised it${habitCount(L.habits) ? ', but it remembers the rest' : ''}.</div>`);
      if (usedWeapon !== oldWeapon) lines.push(`<span class="wep" style="--c:${WEAPONS[usedWeapon].accent}">It takes up your ${WEAPONS[usedWeapon].name.toLowerCase()}.</span>`);
      else lines.push(`<span class="wep" style="--c:${WEAPONS[usedWeapon].accent}">It keeps the ${WEAPONS[usedWeapon].name.toLowerCase()}.</span>`);
      $('lLines').innerHTML = lines.join('');
      const kh = Math.round(g.k.hp / g.k.maxHp * 100);
      $('lTally').textContent = `Attempt ${save.attempts} · knight at ${kh}% · ${habitCount(L.habits)} crack${habitCount(L.habits) === 1 ? '' : 's'} in its armour`;
      [...$('lLines').children].forEach((el, i) => setTimeout(() => el.classList.add('on'), 400 + i * 700));
      $('lAgain').focus({ preventScroll: true });
    }
  }, result === 'won' ? 3300 : 3600);
}
function banner(text, cls, sub) {
  if (!text) { $('banner').classList.remove('on'); return; }
  $('bannerH').textContent = text; $('bannerH').className = cls || ''; $('bannerP').textContent = sub || '';
  $('banner').classList.add('on');
}

// ------------------------------------------------------------- input
const keys = new Set();
const press = (k, dur = .28) => { if (g) g.input[k] = dur; };
addEventListener('keydown', e => {
  if (e.repeat && !['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) return;
  snd.init();
  if (touchMode && !e.repeat) setTouch(false);
  keys.add(e.code);
  if (mode === 'fight' || mode === 'tutorial') {
    if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); e.preventDefault(); return; }
    if (paused) return;
    if (e.code === 'KeyJ' || e.code === 'KeyZ') press('light');
    if (e.code === 'KeyK' || e.code === 'KeyX') press('heavy');
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyL') { press('dodge', .2); e.preventDefault(); }
    if (e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'KeyR') press('drink', .2);
    if (e.code.startsWith('Arrow')) e.preventDefault();
  } else if (mode === 'arms') {
    const i = WEAPON_ORDER.indexOf(pick);
    if (/^Digit[1-5]$/.test(e.code)) pickWeapon(WEAPON_ORDER[+e.code[5] - 1]);
    if (e.code === 'ArrowRight') pickWeapon(WEAPON_ORDER[(i + 1) % 5]);
    if (e.code === 'ArrowLeft') pickWeapon(WEAPON_ORDER[(i + 4) % 5]);
    if (e.code === 'Escape') toTitle();
  }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); if ((mode === 'fight' || mode === 'tutorial') && !paused && !g?.over) togglePause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && (mode === 'fight' || mode === 'tutorial') && !paused && !g?.over && !DEBUG) togglePause(true); });

function keyMove() {
  let x = 0, y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x--; if (keys.has('KeyD') || keys.has('ArrowRight')) x++;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y--; if (keys.has('KeyS') || keys.has('ArrowDown')) y++;
  return [x, y];
}

// mouse on the canvas
$('field').addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse') return;
  snd.init();
  if (mode !== 'fight' && mode !== 'tutorial' || paused) return;
  if (e.button === 0) press('light'); else if (e.button === 2) press('heavy');
});
addEventListener('contextmenu', e => { if (mode === 'fight' || mode === 'tutorial') e.preventDefault(); });

// touch pad
const pad = $('pad'), stickEl = $('stick');
const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const btns = [['bLight', 'light'], ['bHeavy', 'heavy'], ['bRoll', 'dodge'], ['bFlask', 'drink']].map(([id, act]) => ({ el: $(id), act }));
const held = new Map();
function hitBtn(x, y) {
  let best = null, bd = 1e9;
  for (const b of btns) {
    const r = b.el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = Math.hypot(x - cx, y - cy);
    if (d < r.width / 2 + 14 && d < bd) { bd = d; best = b; }
  }
  return best;
}
function placeStickRest() { stickEl.style.left = (Math.max(20, parseFloat(getComputedStyle(document.body).getPropertyValue('--l')) || 10) + 76) + 'px'; stickEl.style.top = (innerHeight - 110) + 'px'; }
placeStickRest(); addEventListener('resize', placeStickRest);
pad.addEventListener('pointerdown', e => {
  e.preventDefault(); snd.init();
  if (e.pointerType !== 'touch' && e.pointerType !== 'pen') { if (e.button === 0) press('light'); else if (e.button === 2) press('heavy'); return; }
  if (!touchMode) setTouch(true);
  if (paused) return;
  const b = hitBtn(e.clientX, e.clientY);
  if (b) { press(b.act, b.act === 'light' ? .3 : .22); b.el.classList.add('dn'); held.set(e.pointerId, b); return; }
  if (e.clientX < innerWidth * .55 && stick.id === null) {
    stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0;
    stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; stickEl.classList.add('live'); $('stickHint').hidden = true;
  }
  try { pad.setPointerCapture(e.pointerId); } catch {}
});
pad.addEventListener('pointermove', e => {
  if (e.pointerId !== stick.id) return;
  let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const d = Math.hypot(dx, dy), R = 46;
  if (d > R) { // drag the stick along
    stick.ox += dx / d * (d - R); stick.oy += dy / d * (d - R); dx = e.clientX - stick.ox; dy = e.clientY - stick.oy;
    stickEl.style.left = stick.ox + 'px'; stickEl.style.top = stick.oy + 'px';
  }
  stick.x = dx / R; stick.y = dy / R;
  stickEl.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`;
});
const up = e => {
  if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; stickEl.firstElementChild.style.transform = ''; stickEl.classList.remove('live'); placeStickRest(); }
  const b = held.get(e.pointerId); if (b) { b.el.classList.remove('dn'); held.delete(e.pointerId); }
};
pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
pad.addEventListener('contextmenu', e => e.preventDefault());

// buttons
$('tFight').onclick = () => { snd.init(); toArms(); };
$('tPractice').onclick = () => startTutorial();
$('tForget').onclick = () => forget();
$('wForget').onclick = () => { forget(); };
function forget() { if (!confirm('Make the knight forget everything it learned about you?')) return; const s = save.sound; save = blank(); save.sound = s; persist(); toTitle(); }
$('aBack').onclick = () => toTitle();
$('aGo').onclick = () => startFight();
$('lAgain').onclick = () => toArms();
$('wAgain').onclick = () => toArms();
$('tutDone').onclick = () => toArms();
$('tutSkip').onclick = () => { save.practiced = true; persist(); toArms(); };
$('pauseBtn').onclick = () => togglePause();
$('pResume').onclick = () => togglePause(false);
$('pQuit').onclick = () => { paused = false; if (mode === 'tutorial') toTitle(); else toArms(); };
$('pSound').onclick = () => { save.sound = snd.on = !snd.on; persist(); $('pSound').textContent = 'Sound: ' + (snd.on ? 'on' : 'off'); };
function togglePause(force) {
  if (mode !== 'fight' && mode !== 'tutorial') return;
  if (g?.over) return;
  paused = force ?? !paused;
  show(paused ? 'pause' : null);
  $('pSound').textContent = 'Sound: ' + (snd.on ? 'on' : 'off');
  $('pQuit').textContent = mode === 'tutorial' ? 'Leave practice' : 'Leave the ring';
  if (paused) { keys.clear(); for (const [, b] of held) b.el.classList.remove('dn'); held.clear(); stick.id = null; stick.x = stick.y = 0; $('pResume').focus({ preventScroll: true }); }
}
document.querySelectorAll('.screen').forEach(s => s.addEventListener('keydown', e => { if (e.code === 'Enter' && document.activeElement === document.body) { const h = s.querySelector('.btn.hot'); h?.click(); } }));

// ------------------------------------------------------------- loop
let last = performance.now(), acc = 0;
function step(dt) {
  if (!g) return;
  if (bot) bot.step(dt);
  else if (mode === 'fight' || mode === 'tutorial') {
    const [kx, ky] = keyMove();
    g.input.mx = kx + stick.x; g.input.my = ky + stick.y;
  }
  g.tick(dt);
  if (mode === 'title' || mode === 'arms') {
    // the backdrop: endless sparring, nobody dies
    if (g.p.hp < 1e8 || g.k.hp < 1e8) { g.p.hp = g.k.hp = 1e9; }
  }
  if (mode === 'tutorial') tutTick(dt);
}
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(.1, (now - last) / 1000); last = now;
  if (hold) dt = 0;
  run(dt);
}
function run(dt) {
  if (g && !paused) {
    if (hitstop > 0) { hitstop -= dt; }
    else { acc += dt; while (acc >= DT) { step(DT); acc -= DT; } }
    const ev = g.events; g.events = [];
    if (mode === 'fight' || mode === 'tutorial' || DEMO) handleEvents(ev);
    view.ingest(g, ev);
    if (mode === 'fight' && g.over && !endShown) { endT += dt; if (endT > 1.1) endFight(); }
  }
  if (g) view.frame(g, paused ? 0 : dt, { mark: mode === 'tutorial' && tut && tut.i === 0 ? tut.mark : null });
  if (mode === 'fight' || mode === 'tutorial' || DEMO) updateHud(dt);
  if (sayT > 0) { sayT -= dt; if (sayT <= 0) $('say').classList.remove('on'); }
}

// ------------------------------------------------------------- boot
if (DEMO) {
  mode = 'fight'; show(null); hud(true); setTouch(false);
  const habits = { ...emptyHabits(), dodge: 'left', string: 2, heavy: true, circle: 'cw' };
  g = new Game({ weapon: 'sword', knightWeapon: 'great', habits, seed: 21 });
  g.k.hp = g.k.maxHp * .58; g.phase = 2; g.p.hp = 64; g.p.flasks = 1;
  g.p.x = -40; g.p.y = 60; g.k.x = 30; g.k.y = -20;
  bot = new Bot(g, { seed: 4, skill: .95, bias: 'right' });
  layout(); setBossWeapon(); lag.k = .66;
  for (let i = 0; i < 60 * 1.6; i++) step(DT);
  // land the shot on a knight wind-up, so the preview shows a telegraph
  for (let i = 0; i < 60 * 8; i++) { const a = g.k.a; if (a && a.ph === 'wind' && a.tag !== 'light' && a.t > .3 && Math.hypot(g.p.x - g.k.x, g.p.y - g.k.y) < 140) break; step(DT); }
  g.events = [];
  view.frame(g, 0, { snap: true });
} else {
  toTitle();
}
if (DEBUG) {
  window.mk = {
    get g() { return g; }, get mode() { return mode; }, view, save: () => save, step, run,
    ff(sec) { for (let i = 0; i < sec * 60; i++) step(DT); run(0); },
    start: startFight, tutorial: startTutorial, arms: toArms, title: toTitle, pickWeapon,
    bot(o) { bot = g ? new Bot(g, o) : null; }, nobot() { bot = null; },
  };
}
requestAnimationFrame(frame);
window.toyboxReady?.();
