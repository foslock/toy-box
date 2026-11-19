import { Game, HOSTS, HOST_ORDER, ACTS, BOSSES, GESTURES, GESTURE_INFO, LINES, D } from './game.js';
import { Renderer, gesturePose } from './render.js';
import { makeBot, botInput } from './bot.js';
import { sfx, unlock, setMuted, isMuted, setMood } from './sound.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo'), DEBUG = params.has('debug'), AUTO = params.has('autoplay'), HOLD = params.has('hold');
const SPEED = +(params.get('speed') || 1);
const ROMAN = ['I', 'II', 'III'];
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const words = (n) => (n < 20 ? WORDS[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? '-' + WORDS[n % 10] : '') : 'a great many');
const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${words(n)} times`);

const SAVE_KEY = 'jolly.v1';
const save = (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; } })();
save.wins ||= {}; save.reached ??= 0; save.next ||= 'wendel';
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} };

const cv = $('#cv');
const R = new Renderer(cv);
let g = null, mode = 'title', tut = null, bot = null, pick = { host: save.next, act: 0 };
let touch = matchMedia('(pointer: coarse)').matches;
const ui = { mark: null, orderIcons: null };

function resize() {
  const w = innerWidth, h = innerHeight;
  document.body.classList.toggle('land', w > h && h < 520);
  document.body.classList.toggle('tall', h > w);
  R.padBottom = touch || DEMO ? 0 : 84;
  R.resize(w, h, Math.min(2, devicePixelRatio || 1));
  document.documentElement.style.setProperty('--stageB', Math.round(R.sy(0) + 14 * R.s) + 'px');
}
function setTouch(on) { if (touch === on) return; touch = on; document.body.classList.toggle('touch', on); resize(); showControls(); renderKeys(); if (tut) showTut(); }
document.body.classList.toggle('touch', touch);
addEventListener('resize', resize);
resize();

// ------------------------------------------------------------------ gesture icons (the Shade, drawn in each pose)
const POSE_T = { point: 0.45, beckon: 0.08, wait: 0.45, bow: 0.42, spin: 0.12 };
const icons = {};
function makeIcons() {
  for (const k of GESTURES) icons[k] = R.portrait('player', { w: 64, h: 64, scale: 0.86, base: 3, dx: k === 'bow' ? -6 : -4, weapon: false, pose: (P) => gesturePose(P, k, POSE_T[k]) });
  ui.orderIcons = icons;
  const tg = $('#tGest canvas'); const c = tg.getContext('2d'); c.drawImage(icons.beckon, 0, 0, 80, 80);
}
makeIcons();

// ------------------------------------------------------------------ input
const held = { up: false, down: false, left: false, right: false };
const inp = { atk: false, atkHeld: false, roll: false, gesture: null };
let stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
let wheel = { open: false, id: null, x: 0, y: 0, hot: null, moved: false };
const KEYS = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  KeyJ: 'atk', KeyZ: 'atk', Space: 'roll', KeyK: 'roll', ShiftLeft: 'roll', ShiftRight: 'roll', KeyX: 'roll',
  Digit1: 'g0', Digit2: 'g1', Digit3: 'g2', Digit4: 'g3', Digit5: 'g4', Numpad1: 'g0', Numpad2: 'g1', Numpad3: 'g2', Numpad4: 'g3', Numpad5: 'g4' };
addEventListener('keydown', (e) => {
  unlock();
  if (mode === 'title') { if (e.code === 'Enter') { e.preventDefault(); $('#startBtn').click(); } return; }
  if (mode === 'card') { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); $('#cardGo').click(); } return; }
  if (mode === 'pause') { if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); resume(); } else if (e.code === 'Enter') { e.preventDefault(); resume(); } return; }
  if (mode === 'end') { if (e.code === 'Enter') { e.preventDefault(); $('#againBtn').click(); } return; }
  if (mode !== 'play') return;
  if (e.code === 'Escape' || e.code === 'KeyP') { pause(); return; }
  if (e.code === 'Enter' && tut && TUT[tut.i].go) { e.preventDefault(); $('#coachGo').click(); return; }
  const k = KEYS[e.code];
  if (!k) return;
  e.preventDefault();
  if (touch && !e.repeat) setTouch(false);
  if (k in held) { held[k] = true; return; }
  if (e.repeat) return;
  if (k === 'atk') { inp.atk = true; inp.atkHeld = true; }
  else if (k === 'roll') inp.roll = true;
  else if (k[0] === 'g') doGesture(GESTURES[+k[1]]);
});
addEventListener('keyup', (e) => {
  const k = KEYS[e.code]; if (!k) return;
  if (k in held) held[k] = false;
  if (k === 'atk') inp.atkHeld = false;
});
addEventListener('blur', resetHeld);
function resetHeld() { for (const k in held) held[k] = false; inp.atkHeld = false; stick.id = null; showStick(); closeWheel(); for (const b of document.querySelectorAll('.tb')) b.classList.remove('on'); }
function doGesture(name) {
  if (mode !== 'play' || !name) return;
  inp.gesture = name;
  const b = document.querySelector(`#gbar [data-g="${name}"]`); if (b) { b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }
}

// mouse: left = strike (hold to raise), right = roll
cv.addEventListener('pointerdown', (e) => {
  unlock();
  if (e.pointerType === 'touch' || e.pointerType === 'pen') {
    setTouch(true);
    if (mode === 'play' && stick.id == null && e.clientX < innerWidth * 0.62) { stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY }; cv.setPointerCapture?.(e.pointerId); showStick(); }
    return;
  }
  setTouch(false);
  if (mode !== 'play') return;
  if (e.button === 0) { inp.atk = true; inp.atkHeld = true; }
  if (e.button === 2) inp.roll = true;
});
cv.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse' && e.button === 0) inp.atkHeld = false; });
cv.addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) { stick.x = e.clientX; stick.y = e.clientY; showStick(); } });
const endStick = (e) => { if (e.pointerId === stick.id) { stick.id = null; showStick(); } };
cv.addEventListener('pointerup', endStick); cv.addEventListener('pointercancel', endStick);
function showStick() {
  const el = $('#stick');
  el.classList.toggle('on', stick.id != null);
  $('#stickHint').hidden = stick.id != null || !g || g.t > 20 && !tut;
  if (stick.id == null) return;
  el.style.left = stick.ox + 'px'; el.style.top = stick.oy + 'px';
  let dx = stick.x - stick.ox, dy = stick.y - stick.oy; const d = Math.hypot(dx, dy), max = 46;
  if (d > max) { dx *= max / d; dy *= max / d; }
  el.firstElementChild.style.transform = `translate(${dx}px,${dy}px)`;
}
// touch buttons
function tbtn(id, down, up) {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); setTouch(e.pointerType !== 'mouse' ? true : touch); el.classList.add('on'); el.setPointerCapture?.(e.pointerId); down(e); });
  const end = (e) => { el.classList.remove('on'); up?.(e); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}
tbtn('#tStrike', () => { inp.atk = true; inp.atkHeld = true; }, () => { inp.atkHeld = false; });
tbtn('#tRoll', () => { inp.roll = true; });
// gesture wheel: press Gesture, slide onto a petal, let go. A tap leaves it open for a second tap.
const WHEEL_ANG = { spin: 150, point: 185, beckon: 220, wait: 255, bow: 290 };
function buildWheel() {
  const w = $('#wheel'); w.innerHTML = '';
  for (const k of GESTURES) {
    const b = document.createElement('div'); b.className = 'pet'; b.dataset.g = k;
    const c = document.createElement('canvas'); c.width = c.height = 96; c.getContext('2d').drawImage(icons[k], 0, 0, 96, 96);
    const s = document.createElement('span'); s.textContent = GESTURE_INFO[k].name;
    b.append(c, s); w.append(b);
  }
}
buildWheel();
function openWheel(cx, cy) {
  const w = $('#wheel'); wheel.open = true; wheel.hot = null; wheel.moved = false;
  // centre it so every petal fits on screen
  const R0 = Math.min(118, innerWidth * 0.3);
  // keep every petal on screen
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const k of GESTURES) { const a = WHEEL_ANG[k] * Math.PI / 180; minX = Math.min(minX, Math.cos(a) * R0); maxX = Math.max(maxX, Math.cos(a) * R0); minY = Math.min(minY, Math.sin(a) * R0); maxY = Math.max(maxY, Math.sin(a) * R0); }
  cx = Math.min(innerWidth - 44 - maxX, Math.max(44 - minX, cx)); cy = Math.min(innerHeight - 48 - maxY, Math.max(48 - minY, cy));
  wheel.x = cx; wheel.y = cy; wheel.r = R0;
  w.style.setProperty('--wx', cx + 'px'); w.style.setProperty('--wy', cy + 'px');
  for (const p of w.children) { const a = WHEEL_ANG[p.dataset.g] * Math.PI / 180; p.style.left = cx + Math.cos(a) * R0 + 'px'; p.style.top = cy + Math.sin(a) * R0 + 'px'; p.classList.remove('hot'); }
  w.hidden = false;
}
function closeWheel() { wheel.open = false; wheel.id = null; $('#wheel').hidden = true; }
function wheelHot(x, y) {
  const dx = x - wheel.x, dy = y - wheel.y, d = Math.hypot(dx, dy);
  let hot = null;
  if (d > 34) { let best = 1e9; const a = Math.atan2(dy, dx) * 180 / Math.PI; for (const k of GESTURES) { let da = Math.abs(((a - WHEEL_ANG[k]) % 360 + 540) % 360 - 180); if (da < best) { best = da; hot = k; } } if (best > 40) hot = null; }
  wheel.hot = hot;
  for (const p of $('#wheel').children) p.classList.toggle('hot', p.dataset.g === hot);
}
$('#tGest').addEventListener('pointerdown', (e) => {
  e.preventDefault(); unlock();
  if (mode !== 'play') return;
  if (wheel.open) { closeWheel(); return; }
  const r = $('#tGest').getBoundingClientRect();
  openWheel(r.left + r.width / 2, r.top + r.height / 2);
  wheel.id = e.pointerId; wheel.sx = e.clientX; wheel.sy = e.clientY;
  $('#wheel').setPointerCapture?.(e.pointerId);
});
$('#wheel').addEventListener('pointermove', (e) => { if (!wheel.open) return; if (e.pointerId === wheel.id && Math.hypot(e.clientX - wheel.sx, e.clientY - wheel.sy) > 14) wheel.moved = true; wheelHot(e.clientX, e.clientY); });
$('#wheel').addEventListener('pointerup', (e) => {
  if (!wheel.open) return;
  if (e.pointerId === wheel.id) {
    wheel.id = null;
    if (wheel.moved) { const h = wheel.hot; closeWheel(); if (h) doGesture(h); }
    return; // a tap: leave it open
  }
  wheelHot(e.clientX, e.clientY);
  const h = wheel.hot; closeWheel(); if (h) doGesture(h);
});
$('#wheel').addEventListener('pointerdown', (e) => { if (e.pointerId !== wheel.id) wheelHot(e.clientX, e.clientY); });
// the desktop gesture bar
function buildGbar() {
  const bar = $('#gbar'); bar.innerHTML = '';
  GESTURES.forEach((k, i) => {
    const b = document.createElement('button'); b.dataset.g = k; b.title = GESTURE_INFO[k].what;
    const c = document.createElement('canvas'); c.width = c.height = 92; c.getContext('2d').drawImage(icons[k], 0, 0, 92, 92);
    const s = document.createElement('span'); s.textContent = GESTURE_INFO[k].name;
    const kb = document.createElement('kbd'); kb.textContent = i + 1;
    b.append(c, s, kb);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); doGesture(k); });
    bar.append(b);
  });
}
buildGbar();
function showControls() {
  const inPlay = mode === 'play' || mode === 'pause';
  $('#touchUI').hidden = !touch || !inPlay || DEMO;
  $('#gbar').hidden = touch || !inPlay || DEMO;
  if (!touch) closeWheel();
}
function readInput() {
  let mx = (held.right ? 1 : 0) - (held.left ? 1 : 0), my = (held.up ? 1 : 0) - (held.down ? 1 : 0);
  if (stick.id != null) { const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy); if (d > 8) { const k = Math.min(1, d / 46); mx = dx / d * k; my = -dy / d * k; } }
  return { mx, my, atk: inp.atk, atkHeld: inp.atkHeld, roll: inp.roll, gesture: inp.gesture };
}

// ------------------------------------------------------------------ keys help
function renderKeys() {
  const rows = touch
    ? [['Left thumb', 'walk (drag anywhere on the left)'], ['Strike', 'attack · hold beside a fallen host to raise them'], ['Roll', 'dodge through blows'], ['Gesture', 'hold, slide to a gesture, let go']]
    : [['WASD', 'walk (arrows work too)'], ['J or click', 'strike · hold to raise a fallen host'], ['Space or right-click', 'roll through blows'], ['1 2 3 4 5', 'point · beckon · wait · bow · spin'], ['Esc', 'intermission']];
  const html = rows.map(([a, b]) => `<dt>${touch ? `<em>${a}</em>` : a.split(' ').map((x) => (x === 'or' ? 'or' : `<kbd>${x}</kbd>`)).join(' ')}</dt><dd>${b}</dd>`).join('');
  $('#keyList').innerHTML = html; $('#keyList2').innerHTML = html;
}
renderKeys();

// ------------------------------------------------------------------ title
function buildTitle() {
  const cast = $('#cast'); cast.innerHTML = '';
  for (const k of HOST_ORDER) {
    const d = HOSTS[k];
    const b = document.createElement('button'); b.className = 'host' + (k === pick.host ? ' sel' : ''); b.dataset.k = k;
    const c = R.portrait('host', { def: d, w: 96, h: 96, scale: 1.05, base: 6, pose: (P) => { P.fs = 0.9; P.fe = 0.9; P.w = 2.6; if (k === 'plume') { P.bs = -0.6; P.be = 2.3; } if (k === 'gorm') { P.fs = 0.4; P.w = 2.9; } } });
    const w = save.wins[k] || 0;
    b.append(c);
    b.insertAdjacentHTML('beforeend', `<b>${d.name}</b><i>${d.epithet}</i><span class="won">${w ? `seen through ${times(w)}` : ''}</span>`);
    b.addEventListener('click', () => { pick.host = k; buildTitle(); });
    cast.append(b);
  }
  $('#hostBlurb').textContent = HOSTS[pick.host].blurb;
  const ap = $('#actPick');
  ap.hidden = save.reached < 1;
  if (save.reached >= 1) {
    pick.act = Math.min(pick.act, save.reached);
    ap.innerHTML = 'Begin at ' + [0, 1, 2].filter((i) => i <= save.reached).map((i) => `<button data-a="${i}" class="${i === pick.act ? 'sel' : ''}">Act ${ROMAN[i]}</button>`).join('');
    for (const b of ap.querySelectorAll('button')) b.addEventListener('click', () => { pick.act = +b.dataset.a; buildTitle(); });
  }
  $('#rehBtn').textContent = save.rehearsed ? 'Rehearse again' : 'Skip the rehearsal';
}
$('#startBtn').addEventListener('click', () => { unlock(); if (!save.rehearsed) startRehearsal(); else startRun(pick.host, pick.act); });
$('#rehBtn').addEventListener('click', () => { unlock(); if (!save.rehearsed) { save.rehearsed = true; persist(); startRun(pick.host, pick.act); } else startRehearsal(); });

function hideSheets() { for (const id of ['#title', '#card', '#pause', '#end']) $(id).hidden = true; }
function startRun(host, act) {
  hideSheets();
  tut = null; $('#coach').hidden = true; ui.mark = null;
  g = new Game({ seed: (Math.random() * 1e9) | 0, host, act });
  pick.host = host; pick.act = act;
  mode = 'play';
  R.curtain = 1; curtainTo = 0;
  R.bubble = null;
  bot = AUTO ? makeBot({}) : null;
  setMood('calm');
  hudReset();
  showControls();
  cardFor(null);
}
function backToTitle() {
  mode = 'title'; hideSheets(); clearNotices(); g = null; R.curtain = 0; curtainTo = 0; tut = null; $('#coach').hidden = true;
  $('#hud').hidden = true; showControls();
  buildTitle(); $('#title').hidden = false;
  setMood('hush');
}

// ------------------------------------------------------------------ rehearsal (the interactive tutorial)
const k = (desk, tch) => (touch ? tch : desk);
const TUT = [
  { name: 'Rehearsal · I · Walk', text: () => `You are a <em>Shade</em>, a puppet cut out of the lamp's own light. Walk to the chalk cross. ${k('<kbd>WASD</kbd> or the arrow keys.', 'Put a thumb down on the left of the screen and drag.')}`,
    setup() { ui.mark = { x: 250, y: 64 }; }, done: () => Math.hypot(g.p.x - 250, (g.p.y - 64) * 1.2) < 20 },
  { name: 'II · Strike', text: () => `A straw dummy. Hit it three times: ${k('<kbd>J</kbd> or click', 'tap <em>Strike</em>')}. Keep pressing to chain a combo.`,
    setup() { ui.mark = null; tut.dummy = g.spawn('dummy', 330, 64, { noDrop: true }); tut.n = 0; }, on: (e) => { if (e.t === 'dummyHit') tut.n++; }, done: () => tut.n >= 3 },
  { name: 'III · Roll', text: () => `A prop soldier. When it raises its sword, the floor reddens where the blow will land. <em>Roll</em> just as it swings: ${k('<kbd>Space</kbd> or right-click', 'tap <em>Roll</em>')}. While you tumble, nothing can touch you.`,
    setup() { tut.dummy.dead = true; tut.dummy.t = 9; g.p.dodged = 0; const f = g.spawn('prop', g.p.x + 52, g.p.y, { noDrop: false, look: 'prop' }); f.active = true; f.face = -1; tut.prop = f; },
    done: () => g.p.dodged >= 1, after() { tut.prop.dead = true; tut.prop.t = 0; } },
  { name: 'IV · Beckon', text: () => `Here is your <em>host</em>, the one who summoned you, dyed ${hostColour()}. They can't hear a word you say. <em>Beckon</em> them over: ${k('press <kbd>2</kbd> or click <em>Beckon</em> below', 'hold <em>Gesture</em>, slide to <em>Beckon</em>, let go')}.`,
    setup() { const h = g.h; h.present = true; h.x = Math.max(20, g.p.x - 230); h.y = 80; h.state = 'idle'; h.face = 1; g.say('hello', 3, true); },
    done: () => g.h.order?.g === 'beckon' && Math.hypot(g.h.x - g.p.x, g.h.y - g.p.y) < 60 },
  { name: 'V · Wait', text: () => tut.hung ? `Too late! They're hanging on by their fingertips. Stand beside them and <em>hold</em> ${k('<kbd>J</kbd>', '<em>Strike</em>')} to pull them up.` : `Oh dear. A glint beyond the trapdoor, and your host has seen it. Tell them to <em>Wait</em> before they walk straight in: ${k('<kbd>3</kbd>', '<em>Gesture</em> → <em>Wait</em>')}.`,
    setup() {
      const h = g.h, x0 = Math.min(760, Math.max(h.x, g.p.x) + 110);
      tut.pit = { x0, x1: x0 + 60, y0: 0, y1: D, on: true }; g.pits.push(tut.pit);
      g.loot.push({ x: x0 + 110, y: h.y, kind: 'gem', id: 77, taken: false, glint: 0 });
      h.order = null; h.script = { x: x0 + 110, y: h.y, speed: 26 };
      g.say('loot', 3, true);
    },
    on: (e) => { if (e.t === 'hang') { tut.hung = true; showTut(); } },
    done: () => (g.h.order?.g === 'wait' || (tut.hung && g.h.state !== 'hanging')),
    after() { tut.pit.on = false; g.loot.length = 0; g.h.script = null; if (g.h.state === 'hanging') { g.h.state = 'idle'; } } },
  { name: 'VI · Point', text: () => `Another dummy. Face it and <em>Point</em>: ${k('<kbd>1</kbd>', '<em>Gesture</em> → <em>Point</em>')}. Your host goes after whatever you point at.`,
    setup() { tut.dummy = g.spawn('dummy', Math.min(860, g.p.x + 120), 60, { noDrop: false }); },
    on: (e) => { if (e.t === 'dummyHitHost') tut.pointed = true; }, done: () => tut.pointed, after() { tut.dummy.dead = true; tut.dummy.t = 0; g.h.order = null; } },
  { name: 'VII · Raise', text: () => `A sandbag! (Theatre.) Your host is down, and they'll bleed out when the ring runs dry. Stand beside them and <em>hold</em> ${k('<kbd>J</kbd> or the mouse', '<em>Strike</em>')} to raise them.`,
    setup() { g.hurt(g.h, 999, 'sandbag', 0, { scripted: true }); g.fx.push({ k: 'drop', x: g.h.x, y: g.h.y + 10, t: 0, life: 0.4 }); R.shake = 6; sfx.boom(); },
    done: () => g.stats.revives >= 1 },
  { name: 'VIII · Bow', text: () => `The gold bar beside their name is <em>rapport</em>. Raise it and they listen more often: advice that works, saving them, a polite <em>Bow</em>. Bow now: ${k('<kbd>4</kbd>', '<em>Gesture</em> → <em>Bow</em>')}. (<em>Spin</em> is a show-off: every foe nearby turns on you. Handy when your host is in trouble.)`,
    on: (e) => { if (e.t === 'gesture' && e.g === 'bow') tut.bowed = true; }, done: () => tut.bowed },
  { name: 'That\'s the job', text: () => `Three acts, a boss at the end of each. Your host will roll into holes, drink at the worst moment and chase shiny things. Keep them standing. If either of you falls for good, you're sent home.`, go: true },
];
function hostColour() { return { wendel: 'green', gorm: 'red', plume: 'violet' }[g.hostKey]; }
function startRehearsal() {
  hideSheets();
  g = new Game({ seed: 7, host: pick.host, rehearsal: true });
  mode = 'play'; R.curtain = 1; curtainTo = 0; R.bubble = null;
  tut = { i: -1 };
  bot = null;
  setMood('hush');
  hudReset();
  showControls();
  nextTut();
}
function nextTut() {
  if (tut.i >= 0) TUT[tut.i].after?.();
  tut.i++;
  tut.hung = false;
  const s = TUT[tut.i];
  s.setup?.();
  showTut();
  if (tut.i > 0) { sfx.clear(); const c = $('#coach'); c.classList.remove('done'); void c.offsetWidth; c.classList.add('done'); }
}
function showTut() {
  if (!tut) return;
  const s = TUT[tut.i];
  $('#coach').hidden = false;
  $('#coach .step').textContent = s.name;
  $('#coach .txt').innerHTML = s.text();
  $('#coachGo').hidden = !s.go;
  $('#skipTut').textContent = s.go ? '' : 'Skip rehearsal';
  $('#skipTut').hidden = !!s.go;
  $('#hud').hidden = tut.i < 3;
  $('#hostPlate').style.visibility = g.h.present ? '' : 'hidden';
}
function tutTick(evs) {
  const s = TUT[tut.i];
  for (const e of evs) s.on?.(e);
  if (s.done?.()) nextTut();
}
function endRehearsal() {
  save.rehearsed = true; persist();
  startRun(pick.host, pick.act);
}
$('#skipTut').addEventListener('click', endRehearsal);
$('#coachGo').addEventListener('click', endRehearsal);

// ------------------------------------------------------------------ HUD
let hudCache = {};
function hudReset() {
  hudCache = {};
  $('#hud').hidden = false;
  const d = g.def;
  document.documentElement.style.setProperty('--dye', d.dye);
  $('#hName').textContent = d.name; $('#hEpi').textContent = d.epithet;
  $('#bossBar').hidden = true;
  $('#hostPlate').style.visibility = g.h.present ? '' : 'hidden';
}
function setBar(el, k) { const v = el.querySelector('.v'), l = el.querySelector('.lag'); const w = (Math.max(0, Math.min(1, k)) * 100).toFixed(1) + '%'; v.style.width = `calc(${w} - 2px)`; if (l) l.style.width = `calc(${w} - 2px)`; }
function hud() {
  if (!g) return;
  const h = g.h, p = g.p, c = hudCache;
  const hk = Math.round(h.hp / h.max * 200);
  if (c.hk !== hk) { c.hk = hk; setBar($('#hHp'), h.hp / h.max); }
  const pk = Math.round(p.hp / p.max * 200);
  if (c.pk !== pk) { c.pk = pk; setBar($('#pHp'), p.hp / p.max); }
  const sk = Math.round(Math.max(0, p.st));
  if (c.sk !== sk) { c.sk = sk; setBar($('#pSt'), p.st / 100); }
  const tk = Math.round(h.trust);
  if (c.tk !== tk) { if (c.tk != null && tk > c.tk) { const t = $('#hTrust'); t.classList.remove('up'); void t.offsetWidth; t.classList.add('up'); } c.tk = tk; setBar($('#hTrust'), h.trust / 100); }
  const fk = h.flasks + '|' + Math.max(3, h.flasks);
  if (c.fk !== fk) { c.fk = fk; $('#flasks').innerHTML = Array.from({ length: Math.max(3, h.flasks) }, (_, i) => `<i class="${i < h.flasks ? '' : 'used'}"></i>`).join(''); }
  const ak = g.rehearsal ? 'r' : g.act;
  if (c.ak !== ak) { c.ak = ak; $('#actLbl').innerHTML = g.rehearsal ? 'Rehearsal<small>the house lights are up</small>' : `Act ${ROMAN[g.act]}<small>${ACTS[g.act].name}</small>`; }
  const b = g.boss;
  const show = !!(b && !b.dead && b.drop <= 0.6);
  if (c.boss !== show) { c.boss = show; $('#bossBar').hidden = !show; if (show) $('#bossName').textContent = b.def.name; }
  if (show) { const bk = Math.round(b.hp / b.max * 300); if (c.bk !== bk) { c.bk = bk; setBar($('#bossBar .bar'), b.hp / b.max); } }
  // boss bar placement: below the plates
  const top = document.body.classList.contains('land') ? 64 : innerWidth <= 640 ? 128 : 76;
  if (c.bt !== top) { c.bt = top; $('#bossBar').style.top = `calc(var(--top) + ${top}px)`; }
  if (touch && !c.hintGone && g.t > 20 && !tut) { c.hintGone = true; $('#stickHint').hidden = true; }
  // strike button turns into Raise
  const raise = !!p.canRaise;
  if (c.raise !== raise) { c.raise = raise; const s = $('#tStrike'); s.classList.toggle('raise', raise); s.innerHTML = raise ? 'Raise<small>hold</small>' : 'Strike'; }
}

// ------------------------------------------------------------------ toasts, banner
const tipsSeen = new Set();
function tip(key, html, ms = 5200) {
  if (tipsSeen.has(key) || DEMO) return;
  tipsSeen.add(key);
  toast(html, ms);
}
function toast(html, ms = 4200) {
  const el = document.createElement('div'); el.className = 'toast leather'; el.innerHTML = html;
  const box = $('#toasts');
  const keep = document.body.classList.contains('land') ? 0 : 1;
  while (box.children.length > keep) box.firstChild.remove();
  box.append(el);
  setTimeout(() => el.remove(), ms);
}
let bannerT = null;
function banner(big, small) {
  const b = $('#banner');
  b.innerHTML = `<div class="big">${big}</div>${small ? `<div class="small">${small}</div>` : ''}`;
  b.hidden = false; b.classList.remove('fade'); void b.offsetWidth; b.classList.add('fade');
  clearTimeout(bannerT); bannerT = setTimeout(() => { b.hidden = true; }, 3000);
}

// ------------------------------------------------------------------ events
function handle(e) {
  const P = g.p;
  switch (e.t) {
    case 'say': {
      const life = 2.2 + e.text.length * 0.045;
      R.bubble = { text: e.text, t: life, life };
      sfx.babble(Math.min(7, 2 + Math.round(e.text.length / 9)), g.hostKey === 'gorm' ? 0.65 : g.hostKey === 'plume' ? 1.35 : 1);
      break;
    }
    case 'swing': sfx.swing(e.who === 'host' && g.hostKey === 'gorm'); break;
    case 'connect': sfx.hit(e.n === 2); if (e.n === 2) R.shake = Math.max(R.shake, 2.5); break;
    case 'hostConnect': sfx.clack(); break;
    case 'hit':
      if (e.who === 'player') { sfx.hurt(); R.shake = Math.max(R.shake, e.big ? 7 : 4); R.flash = Math.max(R.flash, e.big ? 0.9 : 0.5); }
      else if (e.who === 'host') { sfx.hit(e.big); }
      break;
    case 'roll': if (e.who === 'player') sfx.roll(); break;
    case 'dodge': if (e.who === 'player') sfx.dodge(); break;
    case 'block': sfx.block(); break;
    case 'parry': sfx.block(); break;
    case 'kill': sfx.kill(); break;
    case 'gesture': sfx.gesture(); break;
    case 'heed': sfx.heed(); break;
    case 'ignore': sfx.ignore(); tip('ignore', `<b>Ignored.</b> Your host doesn't always listen. The higher the <em>rapport</em>, the more often they do.`); break;
    case 'unseen': toast(`Your host is too far away to see you.`, 2600); break;
    case 'taunt': tip('taunt', `<b>Spin!</b> Every foe nearby now wants <em>you</em>.`, 3600); break;
    case 'downed':
      sfx.downed();
      if (!g.rehearsal) tip('downed', `<b>Your host is down!</b> Get beside them and <em>hold</em> ${k('<kbd>J</kbd>', '<em>Raise</em>')} before the ring runs out.`, 6000);
      break;
    case 'hang': sfx.fall(); if (!g.rehearsal) tip('hang', `<b>They're hanging off the edge!</b> Stand beside them and <em>hold</em> ${k('<kbd>J</kbd>', '<em>Raise</em>')} to pull them up.`, 6000); break;
    case 'revived': case 'rescued': sfx.raise(); break;
    case 'drink': sfx.drink(); if (!g.rehearsal) tip('drink', `Your host stops to drink a <em>flask</em> and can't move while they do. Cover them.`, 4200); break;
    case 'loot': sfx.loot(); break;
    case 'ambush': banner('An ambush!', 'it was never a hat'); tip('ambush', `Shiny things are often bait. <em>Beckon</em> your host away before they reach for one.`, 5200); break;
    case 'read': tip('read', `Your host reads every note on the floor, and does what it says. <em>Wait</em> stops them.`, 5000); break;
    case 'wave': sfx.wave(); setMood('fight'); break;
    case 'clear': sfx.clear(); setMood('calm'); break;
    case 'wind': break;
    case 'bossIntro': {
      const B = BOSSES[e.key];
      setMood('boss');
      banner(B.name, B.title);
      sfx.bell();
      tip('boss', `Watch the <em>red</em> on the floor. <em>Wait</em> puts your host's shield up; <em>Beckon</em> pulls them out of it.`, 6500);
      break;
    }
    case 'bossWind': sfx.bossWind(e.kind); break;
    case 'bossStrike': if (e.kind !== 'lunge') { sfx.boom(); R.shake = Math.max(R.shake, e.kind === 'aoe' || e.kind === 'multi' ? 9 : 5); } else sfx.swing(true); if (e.key === 'bell' && e.name === 'toll') sfx.bell(); break;
    case 'howl': sfx.howl(); break;
    case 'shoot': sfx.shoot(); break;
    case 'bossPhase': R.shake = 6; sfx.bell(); break;
    case 'bossDown': setMood('hush'); sfx.applause(3); banner('Exit, pursued by applause', `end of Act ${ROMAN[g.act]}`); save.reached = Math.max(save.reached, Math.min(2, g.act + 1)); persist(); break;
    case 'curtain': closeCurtain(); break;
    case 'dismissed': sfx.dismiss(); setMood('hush'); break;
    case 'end': showEnd(false); break;
  }
}

// ------------------------------------------------------------------ curtains & cards
let curtainTo = 0;
function clearNotices() { $('#banner').hidden = true; $('#toasts').innerHTML = ''; }
function closeCurtain() {
  mode = 'card'; curtainTo = 1; sfx.curtain(); resetHeld(); showControls();
  setTimeout(clearNotices, 700);
  setTimeout(() => { if (g.act >= ACTS.length - 1) showEnd(true); else cardFor(g.act + 1); }, 1100);
}
function cardFor(act) {
  if (act == null) { // the opening of a run: a quick title over the curtain
    banner(`Act ${ROMAN[g.act]}`, ACTS[g.act].name);
    setTimeout(() => sfx.curtain(), 100);
    return;
  }
  const d = g.def;
  $('#cardKick').textContent = `End of Act ${ROMAN[act - 1]}. ${d.name} survives, somehow.`;
  $('#cardTitle').textContent = `Act ${ROMAN[act]}`;
  $('#cardSub').textContent = ACTS[act].name;
  const lines = [];
  lines.push(`Rapport: <em>${g.h.trust >= 80 ? 'devoted' : g.h.trust >= 60 ? 'warm' : g.h.trust >= 40 ? 'cordial' : 'wary'}</em>. Flasks refilled, wounds bound.`);
  if (act === 1) lines.push('Archers in the wood. Stand between them and your host and the arrows hit you instead.');
  if (act === 2) lines.push('The keep is the last act. The king does not fight fair.');
  $('#cardNotes').innerHTML = lines.join('<br>');
  $('#card').hidden = false;
  $('#cardGo').focus({ preventScroll: true });
}
$('#cardGo').addEventListener('click', () => {
  $('#card').hidden = true;
  g.nextAct();
  R.bubble = null;
  mode = 'play'; curtainTo = 0; sfx.curtain(); setMood('calm');
  hudReset(); showControls();
  banner(`Act ${ROMAN[g.act]}`, ACTS[g.act].name);
});
function showEnd(won) {
  mode = 'end'; resetHeld(); showControls(); clearNotices();
  const d = g.def, L = g.stats;
  if (won) {
    save.wins[g.hostKey] = (save.wins[g.hostKey] || 0) + 1;
    save.next = HOST_ORDER[(HOST_ORDER.indexOf(g.hostKey) + 1) % 3];
    $('#endKick').textContent = 'The house lights come up';
    $('#endTitle').textContent = 'Curtain Call';
    $('#endReason').innerHTML = `${d.name} ${d.epithet} saw it through all three acts, and so did you.`;
    $('#endNote').textContent = pickLine('farewell');
    $('#againBtn').textContent = 'Play it again';
    sfx.applause(4);
  } else {
    $('#endKick').textContent = `Act ${ROMAN[g.act]}${g.boss ? `, against ${g.boss.def.name}` : ''}`;
    $('#endTitle').textContent = 'Sent Home';
    $('#endReason').textContent = g.reason + '.';
    $('#endNote').textContent = pickLine('lost');
    $('#againBtn').textContent = `Try Act ${ROMAN[g.act]} again`;
  }
  const bits = [];
  bits.push(L.revives ? `You raised your host <b>${times(L.revives)}</b>${L.rescues ? ` and pulled them out of a hole <b>${times(L.rescues)}</b>` : ''}.` : L.rescues ? `You pulled your host out of a hole <b>${times(L.rescues)}</b>.` : `Your host never once needed raising.`);
  bits.push(`They heeded <b>${words(L.heeded)}</b> of <b>${words(L.heeded + L.ignored)}</b> requests. Foes felled: <b>${words(L.kills)}</b>.`);
  $('#endTally').innerHTML = bits.join('<br>');
  persist();
  $('#end').hidden = false;
  $('#againBtn').focus({ preventScroll: true });
}
function pickLine(key) { const a = LINES[g.hostKey][key] || ['']; return a[Math.floor(Math.random() * a.length)]; }
$('#againBtn').addEventListener('click', () => { const won = g.phase === 'curtain' && g.act >= ACTS.length - 1; startRun(g.hostKey, won ? 0 : g.act); });
$('#otherBtn').addEventListener('click', () => { pick.host = HOST_ORDER[(HOST_ORDER.indexOf(g.hostKey) + 1) % 3]; pick.act = 0; backToTitle(); });

// ------------------------------------------------------------------ pause
function pause() { if (mode !== 'play') return; mode = 'pause'; resetHeld(); $('#pauseSub').textContent = g.rehearsal ? 'Rehearsal' : `Act ${ROMAN[g.act]} · ${ACTS[g.act].name}`; $('#pause').hidden = false; $('#resumeBtn').focus({ preventScroll: true }); }
function resume() { $('#pause').hidden = true; mode = 'play'; }
$('#pauseBtn').addEventListener('click', () => { unlock(); pause(); });
$('#resumeBtn').addEventListener('click', resume);
$('#quitBtn').addEventListener('click', backToTitle);
function muteIcon() { $('#muteBtn').textContent = isMuted() ? '♪̸' : '♪'; }
$('#muteBtn').addEventListener('click', () => { unlock(); setMuted(!isMuted()); muteIcon(); });
muteIcon();
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && !DEMO && !AUTO) pause(); });

// ------------------------------------------------------------------ loop
const STEP = 1 / 60;
let last = performance.now(), acc = 0, demoFreeze = false;
function tick(dt) {
  const I = bot ? botInput(g, bot, dt) : readInput();
  Object.assign(g.input, I);
  inp.atk = false; inp.roll = false; inp.gesture = null;
  g.step(dt);
  const evs = g.events.splice(0);
  for (const e of evs) handle(e);
  if (tut && mode === 'play') tutTick(evs);
}
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
  if (HOLD) dt = 0;
  if (g && mode === 'play' && !demoFreeze) {
    acc += dt * SPEED * (wheel.open ? 0.3 : 1);
    let n = 0;
    while (acc >= STEP && n < 12 * SPEED) { try { tick(STEP); } catch (err) { console.error(err); } acc -= STEP; n++; }
    if (acc > STEP) acc = 0;
  }
  // curtains ease
  R.curtain += (curtainTo - R.curtain) * Math.min(1, dt * 3.2);
  if (g) { try { R.frame(g, dt * (wheel.open ? 0.3 : 1), ui); hud(); } catch (err) { console.error(err); } }
  else drawIdle(dt);
}
function drawIdle(dt) {
  // the title: an empty stage with the house lights up
  if (!idleGame) idleGame = new Game({ seed: 3, host: 'wendel', rehearsal: true });
  idleGame.p.x = 280 + Math.sin(performance.now() / 2600) * 30; idleGame.p.state = 'idle';
  idleGame.h.present = false;
  R.frame(idleGame, dt, { snap: true });
}
let idleGame = null;

// ------------------------------------------------------------------ boot
if (DEMO) {
  // a staged moment: the Bell-Warden winds up a toll over Ser Wendel, who is about to make it worse
  $('#title').hidden = true;
  g = new Game({ seed: 11, host: 'wendel', act: 0 });
  const B = g.bossDef;
  g.p.x = B.x0 + 190; g.p.y = 42; g.h.x = B.x0 + 250; g.h.y = 78;
  for (const w of g.waves) w.state = 'done';
  bot = makeBot({ skill: 1, rnd: (() => { let s = 5; return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296); })() });
  mode = 'play';
  hudReset(); showControls();
  for (let i = 0; i < 60 * 14; i++) {
    tick(STEP);
    const b = g.boss;
    if (b && b.state === 'wind' && b.atk && b.atk.tLeft < b.atk.dur * 0.45 && g.t > 4 && ['idle', 'walk', 'guard', 'atk'].includes(g.h.state) && g.p.state !== 'roll' && b.flash <= 0 && g.h.flash <= 0 && Math.abs(b.x - g.h.x) < 160) break;
  }
  g.h.hp = g.h.max * 0.58;
  R.bubble = { text: 'That is a big one. Is it? It is.', t: 99, life: 100 };
  demoFreeze = true;
  $('#banner').hidden = true; $('#toasts').innerHTML = '';
  for (const f of g.foes) f.flash = 0;
  g.p.flash = 0; g.h.flash = 0;
  R.camX = (g.p.x + g.h.x + g.boss.x) / 3 - R.viewW / 2;
  ui.snapOnce = true;
} else {
  buildTitle();
  setMood('hush');
  if (params.has('host') || params.has('act')) { pick.host = params.get('host') || pick.host; pick.act = +(params.get('act') || 0); save.rehearsed = true; startRun(pick.host, pick.act); }
  else if (params.has('rehearsal')) startRehearsal();
}
requestAnimationFrame((t) => { last = t; frame(t); window.toyboxReady?.(); });

if (DEBUG || AUTO) {
  window.jc = {
    get g() { return g; }, R, get mode() { return mode; }, get tut() { return tut; }, get stick() { return stick; }, get inp() { return inp; },
    step(n = 1) { for (let i = 0; i < n; i++) tick(STEP); R.frame(g, STEP, ui); hud(); },
    ff(sec) { for (let i = 0; i < sec * 60 && mode === 'play'; i++) tick(STEP); R.frame(g, STEP, ui); hud(); return { phase: g.phase, act: g.act, t: g.t }; },
    bot(on = true) { bot = on ? makeBot({}) : null; },
    start: startRun, rehearse: startRehearsal, nextTut: () => nextTut(), card: () => $('#cardGo').click(),
  };
}
