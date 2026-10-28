// Puddle: walking the street after rain, fishing in the reflections.
import { SPOTS, PHASES, WEATHERS, CATCHES, BY_ID, MOON_GATE, hintFor, INK } from './data.js';
import { newGame, tick, cast, tap, setSpot, waitHour, phaseOf, weatherOf, hourOf, distinct, unlocked, startTutorial, endTutorial, saveData, REEL } from './game.js';
import { makeView, drawArt } from './render.js';
import { Sound } from './sound.js';

const qs = new URLSearchParams(location.search);
const DEMO = qs.has('demo'), DEBUG = qs.has('debug');
const $ = id => document.getElementById(id);

const store = {
  get(k, d) { try { const v = localStorage.getItem('puddle.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('puddle.' + k, JSON.stringify(v)); } catch { } },
};

const sound = new Sound();
sound.on = store.get('sound', true);
const cv = $('cv');
const view = makeView(cv);
let g = newGame(DEMO ? {} : store.get('save', {}));
let paused = true, hold = false, aim = null, lastT = 0, saveIn = 10, clickAcc = 0, strainAcc = 0;
const reelsSeen = { n: store.get('reels', 0) };

// ---------------------------------------------------------------- layout
function layout() {
  const W = innerWidth, H = innerHeight;
  const strip = $('strip'), hud = $('hud');
  const st = strip.hidden ? H - 70 : strip.getBoundingClientRect().top;
  const ht = hud.hidden ? 64 : hud.getBoundingClientRect().bottom;
  view.layout(W, H, st, ht);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  $('say').style.top = Math.max(ht + 8, view.V.cy - view.V.ry - 50) + 'px';
}
addEventListener('resize', () => { layout(); tut.place(); });

// ---------------------------------------------------------------- HUD
function updateHud() {
  $('whereName').textContent = SPOTS[g.spot].name;
  $('whereTime').textContent = PHASES[phaseOf(g)] + ' · ' + WEATHERS[weatherOf(g)];
  const a = ((g.clock % 8) / 8) * Math.PI * 2;
  $('hand').setAttribute('d', `M13 13 L${(13 + Math.sin(a) * 7).toFixed(1)} ${(13 - Math.cos(a) * 7).toFixed(1)}`);
  $('logCount').textContent = distinct(g) + '/' + CATCHES.length;
  $('muteBtn').classList.toggle('off', !sound.on);
  $('waves').style.display = sound.on ? '' : 'none';
  sound.setWeather(weatherOf(g));
  buildStrip();
}
let stripKey = '';
function buildStrip() {
  const key = g.spot + ':' + distinct(g);
  if (key === stripKey) return;
  const old = stripKey; stripKey = key;
  const el = $('strip'); el.innerHTML = '';
  SPOTS.forEach((s, i) => {
    const b = document.createElement('button');
    const open = unlocked(g, i);
    b.className = 'stop' + (i === g.spot ? ' here' : '') + (open ? '' : ' locked');
    b.innerHTML = `<i></i><span>${open ? s.short : s.need - distinct(g) + ' more'}</span>`;
    b.setAttribute('aria-label', open ? s.name : `${s.name}: catch ${s.need - distinct(g)} more to open`);
    if (open && old && freshSpots.has(i)) b.classList.add('fresh');
    b.onclick = () => walk(i);
    el.appendChild(b);
  });
}
const freshSpots = new Set();

let sayT = 0;
function say(text, secs = 2.2) {
  const el = $('say'); el.textContent = text; el.classList.add('on');
  clearTimeout(sayT); sayT = setTimeout(() => el.classList.remove('on'), secs * 1000);
}

// ---------------------------------------------------------------- walking and waiting
let walking = false;
function walk(i) {
  if (walking || i === g.spot || g.reel || tut.active) {
    if (!unlocked(g, i)) say(`Catch ${SPOTS[i].need - distinct(g)} more things to open this puddle.`);
    return;
  }
  if (!unlocked(g, i)) { say(`Catch ${SPOTS[i].need - distinct(g)} more things to open this puddle.`); return; }
  walking = true; sound.step(); freshSpots.delete(i);
  $('wipe').classList.add('on');
  setTimeout(() => {
    setSpot(g, i); view.reset(); updateHud(); save();
    $('wipe').classList.remove('on');
    walking = false;
    say(SPOTS[i].name, 1.4);
  }, 330);
}
function wait() {
  if (g.reel || tut.active && tut.step.id !== 'clock') return;
  waitHour(g); sound.bell(); updateHud(); tut.emit('wait');
}
$('where').onclick = () => { sound.init(); wait(); };
$('logBtn').onclick = () => { sound.init(); sound.ui(); openLog(); };
$('muteBtn').onclick = () => { sound.init(); sound.setOn(!sound.on); store.set('sound', sound.on); updateHud(); };

// ---------------------------------------------------------------- input
function press(lx, ly, inside) {
  sound.init(); sound.resume();
  if (paused || walking) return;
  if (g.reel) { hold = true; return; }
  if (g.line) {
    const st = g.line.state;
    tap(g);
    if (st === 'bite' && g.reel) hold = true;   // the same press that hooks it starts reeling
    return;
  }
  if (inside) {
    if (tut.active && !tut.step.cast) return;
    cast(g, lx, ly);
  }
}
function release() { hold = false; }

cv.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  cv.setPointerCapture?.(e.pointerId);
  const [lx, ly] = view.toLocal(e.clientX, e.clientY);
  press(lx, ly, view.inPuddle(e.clientX, e.clientY, g.spot));
});
cv.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  const inside = view.inPuddle(e.clientX, e.clientY, g.spot);
  aim = inside ? view.toLocal(e.clientX, e.clientY) : null;
  cv.classList.toggle('aim', inside && !g.line);
});
cv.addEventListener('pointerleave', () => { aim = null; });
addEventListener('pointerup', release);
addEventListener('pointercancel', release);
addEventListener('blur', release);
cv.addEventListener('contextmenu', e => e.preventDefault());

addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('logVeil').hidden) closeLog(); return; }
  if (!$('catchVeil').hidden && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); if (!e.repeat) $('catchOk').click(); return; }
  if (paused) return;
  if (e.key === ' ') {
    e.preventDefault();
    if (e.repeat) return;
    // cast where the mouse is resting, or toward the middle of the puddle
    const a = aim || nearestShadowAim();
    press(a[0], a[1], true);
  } else if (e.key === 'ArrowLeft' || e.key === 'a') stepSpot(-1);
  else if (e.key === 'ArrowRight' || e.key === 'd') stepSpot(1);
  else if (e.key === 'w') wait();
  else if (e.key === 'l') openLog();
});
addEventListener('keyup', e => { if (e.key === ' ') release(); });
function nearestShadowAim() {
  const s = g.shadows.find(s => s.state === 'wander');
  return s ? [s.x * 0.8 + 0.08, s.y * 0.8 + 0.08] : [0, 0];
}
function stepSpot(d) {
  for (let i = g.spot + d; i >= 0 && i < SPOTS.length; i += d) if (unlocked(g, i)) { walk(i); return; }
}

// ---------------------------------------------------------------- events from the game
function handle(ev) {
  switch (ev.type) {
    case 'cast': sound.whoosh(); tut.emit('cast', ev); break;
    case 'plop': sound.plop(); view.plop(ev.x, ev.y); tut.emit('plop'); break;
    case 'nibble': sound.nibble(); tut.emit('nibble'); break;
    case 'bite': sound.bite(); view.splash(g.line.x, g.line.y); navigator.vibrate?.(35); tut.emit('bite'); break;
    case 'hooked': sound.hook(); tut.emit('hooked'); if (reelsSeen.n < 3) { reelsSeen.n++; store.set('reels', reelsSeen.n); showReelHint = true; } else showReelHint = false; break;
    case 'spook': sound.spook(); if (!tut.active) say('Too soon. Wait for the float to go right under.'); tut.emit('spook'); break;
    case 'miss': if (!tut.active) say('Too slow. It got away.'); tut.emit('miss'); break;
    case 'snap': sound.snap(); navigator.vibrate?.(70); say('The line snapped. Ease off in the red.'); break;
    case 'slip': sound.slip(); say('It slipped off. Keep a little tension on.'); break;
    case 'reelIn': sound.whoosh(); break;
    case 'hour': sound.bell(); updateHud(); break;
    case 'caught': caught(ev); break;
  }
}
let showReelHint = false;

// ---------------------------------------------------------------- catch card
function caught(ev) {
  const c = BY_ID[ev.id];
  const before = new Set(SPOTS.map((_, i) => i).filter(i => SPOTS[i].need <= distinct(g) - (ev.isNew ? 1 : 0)));
  SPOTS.forEach((s, i) => { if (unlocked(g, i) && !before.has(i)) freshSpots.add(i); });
  sound.catchTune(ev.isNew, c.rarity <= 2 || c.id === 'moon');
  save();
  setTimeout(() => {
    const x = $('catchArt').getContext('2d');
    x.clearRect(0, 0, 360, 360);
    drawArt(x, c, 180, 180, 300);
    $('catchName').textContent = c.name;
    $('catchNote').textContent = c.note;
    const n = g.log[c.id];
    $('catchTag').textContent = ev.isNew ? 'New' : '×' + n;
    $('catchTag').classList.toggle('ink', !ev.isNew);
    $('catchMeta').textContent = `${SPOTS[g.spot].name.toLowerCase()} · ${PHASES[phaseOf(g)].toLowerCase()} · ${WEATHERS[weatherOf(g)].toLowerCase()}`;
    if (c.id === 'moon') {
      $('catchNote').textContent = c.note + ' The street is very dark now, and very still. Somebody upside down is looking up at an empty sky, and you have their moon. You might put it back, one day.';
    }
    $('catchOk').textContent = tut.active ? 'Into the log' : (freshSpots.size ? 'A new puddle opens…' : 'Into the log');
    // restart the rise animation
    const art = $('catchArt'); art.style.animation = 'none'; void art.offsetWidth; art.style.animation = '';
    $('catchVeil').hidden = false; paused = true; hold = false;
    $('catchOk').focus({ preventScroll: true });
  }, 350);
  updateHud();
}
$('catchOk').onclick = () => {
  sound.ui();
  $('catchVeil').hidden = true; paused = false;
  if (freshSpots.size && !tut.active) {
    const i = [...freshSpots][0];
    say(`You can walk to a new puddle now: ${SPOTS[i].name.toLowerCase()}.`, 3.2);
    stripKey = ''; buildStrip();
  }
  const total = distinct(g);
  if (total === CATCHES.length) say('Every page of the logbook is full. The rain keeps falling anyway.', 4);
  else if (total === MOON_GATE && !g.log.moon) say('On a clear night, something big is drifting under the bridge.', 4);
  tut.emit('cardClosed');
};

// ---------------------------------------------------------------- logbook
let logSel = null;
function openLog() {
  if (g.reel || tut.active) return;
  paused = true; hold = false;
  $('logTotal').textContent = `${distinct(g)} of ${CATCHES.length} found`;
  const grid = $('grid'); grid.innerHTML = '';
  CATCHES.forEach(c => {
    const b = document.createElement('button'), known = !!g.log[c.id];
    b.className = 'cell'; b.setAttribute('aria-label', known ? c.name : 'Not found yet');
    const k = document.createElement('canvas'); k.width = k.height = 100;
    const x = k.getContext('2d');
    if (known) drawArt(x, c, 50, 50, 88); else drawArt(x, c, 50, 50, 84, 'flat', 'rgba(43,68,112,0.32)');
    b.appendChild(k);
    if (known && g.log[c.id] > 1) { const e = document.createElement('em'); e.textContent = '×' + g.log[c.id]; b.appendChild(e); }
    b.onclick = () => { logSel = c.id; showDetail(); };
    grid.appendChild(b);
  });
  if (!logSel) logSel = CATCHES.find(c => g.log[c.id])?.id || CATCHES[0].id;
  showDetail();
  $('logVeil').hidden = false;
}
function showDetail() {
  const c = BY_ID[logSel], known = !!g.log[c.id];
  [...$('grid').children].forEach((b, i) => b.classList.toggle('on', CATCHES[i].id === logSel));
  const d = $('detail'); d.innerHTML = '';
  const k = document.createElement('canvas'); k.width = k.height = 160;
  const x = k.getContext('2d');
  if (known) drawArt(x, c, 80, 80, 140); else drawArt(x, c, 80, 80, 136, 'flat', 'rgba(43,68,112,0.32)');
  const t = document.createElement('div');
  const where = c.id === 'moon' ? `bridge or square · night or small hours · clearing, once ${MOON_GATE} other things are logged` : hintFor(c);
  t.innerHTML = known ? `<b>${c.name}</b><p>${c.note}</p><small>${where}</small>` : `<b>Not yet</b><p>Something turns up here:</p><small>${where}</small>`;
  d.append(k, t);
}
function closeLog() { $('logVeil').hidden = true; paused = false; }
$('logClose').onclick = () => { sound.ui(); closeLog(); };
$('logTitle').onclick = () => { $('logVeil').hidden = true; openTitle(); };

// ---------------------------------------------------------------- title
function openTitle() {
  paused = true;
  $('tutBtn').textContent = store.get('tut', 0) ? 'Show me how again' : 'Show me how';
  const x = $('titleArt').getContext('2d');
  x.clearRect(0, 0, 280, 180);
  drawArt(x, BY_ID.boat, 90, 100, 120);
  drawArt(x, BY_ID.balloon, 190, 80, 110);
  $('title').hidden = false;
}
function begin(withTut) {
  sound.init(); sound.resume(); sound.ui();
  $('title').hidden = true;
  $('hud').hidden = false; $('strip').hidden = false;
  layout(); updateHud();
  paused = false;
  if (withTut) tut.start(); else store.set('tut', 1);
}
$('goBtn').onclick = () => begin(!store.get('tut', 0));
$('tutBtn').onclick = () => begin(true);

// ---------------------------------------------------------------- tutorial
// A guided first catch: one coat button in the first puddle, then the log, the clock and the street.
const tut = {
  active: false, i: 0, step: {}, ring: null,
  steps: [
    { id: 'cast', cast: true, title: 'See that shadow?', text: 'Something fell into the reflected world. Tap just beside its shadow to cast your line.', at: 'puddleTop', ring: 'shadow' },
    { id: 'wait', title: 'Now wait.', text: 'It will come and look. A twitch is only a nibble, so leave it be.', at: 'puddleTop' },
    { id: 'bite', title: 'Now! Tap!', text: 'The float went right under. Tap to hook it.', at: 'puddleTop' },
    { id: 'reel', title: 'Hold to reel it in.', text: 'Keep holding. Let go when the bar runs into the red, then hold again.', at: 'gauge' },
    { id: 'card', title: '', text: '', at: 'none' },
    { id: 'log', title: 'The logbook', text: 'Everything you catch goes in here, with a note on where to look for the rest.', at: 'log', next: 'Next' },
    { id: 'clock', title: 'The hour and the weather', text: 'Different things fall in at different times. Tap the clock to wait an hour, or just keep fishing.', at: 'where', next: 'Next' },
    { id: 'street', title: 'The street', text: 'More puddles open as your log fills, and each one reflects something different. Off you go.', at: 'strip', next: 'Off you go' },
  ],
  start() {
    this.active = true; this.i = 0;
    if (g.spot !== 0) { setSpot(g, 0); view.reset(); }
    g.clock = Math.floor(g.clock / 8) * 8 + 0.3;          // dusk, drizzle on a fresh save
    startTutorial(g); updateHud();
    this.show();
  },
  stop(done = true) {
    this.active = false; $('coach').hidden = true; this.ring = null;
    if (g.tut) endTutorial(g);
    if (done) store.set('tut', 1);
  },
  show() {
    const st = this.step = this.steps[this.i];
    if (!st) return this.stop();
    const el = $('coach');
    if (st.at === 'none') { el.hidden = true; return; }
    el.querySelector('b').textContent = st.title;
    el.querySelector('.txt').textContent = st.text;
    const row = el.querySelector('.row'); row.innerHTML = '';
    const skip = document.createElement('button'); skip.className = 'skip'; skip.textContent = 'Skip the lesson';
    skip.onclick = () => { this.stop(); say('You can see the lesson again from the title.', 2.5); };
    row.appendChild(skip);
    if (st.next) { const b = document.createElement('button'); b.className = 'seal'; b.textContent = st.next; b.onclick = () => { sound.ui(); this.advance(); }; row.appendChild(b); }
    el.hidden = false;
    this.place();
  },
  advance() { this.i++; this.show(); },
  place() {
    if (!this.active || $('coach').hidden) return;
    const el = $('coach'), st = this.step, V = view.V, W = innerWidth;
    const cw = el.offsetWidth, ch = el.offsetHeight;
    let x = W / 2, y, dir = 'down';
    const rectOf = id => $(id).getBoundingClientRect();
    if (st.at === 'puddleTop') { y = Math.max(V.topSafe + 6, V.cy - V.ry - ch - 14); dir = 'none'; }
    else if (st.at === 'gauge') { y = Math.min(V.cy + V.ry * 1.1 + 60, innerHeight - ch - 90); dir = 'up'; }
    else if (st.at === 'log') { const r = rectOf('logBtn'); x = r.left + r.width / 2; y = r.bottom + 12; dir = 'up'; }
    else if (st.at === 'where') { const r = rectOf('where'); x = r.left + r.width / 2; y = r.bottom + 12; dir = 'up'; }
    else if (st.at === 'strip') { const r = rectOf('strip'); x = r.left + r.width / 2; y = r.top - ch - 12; dir = 'down'; }
    const left = Math.max(10, Math.min(W - cw - 10, x - cw / 2));
    el.style.left = left + 'px'; el.style.top = y + 'px';
    el.style.setProperty('--ax', Math.max(18, Math.min(cw - 18, x - left)) + 'px');
    el.className = 'sheet ' + dir;
  },
  emit(type) {
    if (!this.active) return;
    const id = this.step.id;
    if (type === 'spook') { this.retry('Too soon!', 'That was only a nibble. Wait until the float goes right under.'); return; }
    if (type === 'miss') { this.retry('Too slow.', 'It wandered off, but it will be back. Cast again beside it.'); return; }
    if (id === 'cast' && type === 'plop') this.advance();
    else if (id === 'wait' && this.i === 1 && type === 'nibble') { $('coach').querySelector('b').textContent = 'Not yet…'; }
    else if (id === 'wait' && this.i === 1 && type === 'bite') { this.i = 2; this.show(); }
    else if (id === 'bite' && type === 'hooked') this.advance();
    else if (id === 'card' && type === 'cardClosed') { endTutorial(g); this.advance(); }
    else if (id === 'clock' && type === 'wait') this.advance();
  },
  retry(title, text) {
    // put the button back near the float and go back to casting
    g.line = null; g.reel = null;
    startTutorial(g);
    this.i = 0; this.show();
    const el = $('coach'); el.querySelector('b').textContent = title; el.querySelector('.txt').textContent = text;
  },
};

// ---------------------------------------------------------------- loop
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016); lastT = now;
  requestAnimationFrame(frame);
  if (!(DEBUG && window.pd?.hold)) step(dt);
}
function step(dt) {
  if (DEMO) { g.time += dt; }
  else if (!paused) {
    g.hold = hold;
    const h0 = hourOf(g);
    tick(g, dt, { stopClock: tut.active });
    for (const ev of g.events.splice(0)) {
      if (ev.type === 'caught' && tut.active && tut.step.id === 'reel') { tut.i = 4; tut.show(); }
      handle(ev);
    }
    if (hourOf(g) !== h0) updateHud();
    // the reel's ratchet and the line's complaint
    if (g.reel && hold) {
      clickAcc += dt * (8 + g.reel.T * 10);
      if (clickAcc > 1) { clickAcc = 0; sound.click(g.reel.T); }
      if (g.reel.T > REEL.danger) { strainAcc += dt; if (strainAcc > 0.12) { strainAcc = 0; sound.strain(); } }
    }
    saveIn -= dt;
    if (saveIn <= 0) { saveIn = 10; save(); }
    sound.tick(dt);
  }
  // overlays tied to the float
  const L = g.line, bang = $('bang');
  if (L && L.state === 'bite' && !paused) {
    const [sx, sy] = view.toScreen(L.x, L.y);
    bang.style.left = sx + 'px'; bang.style.top = sy + 'px';
    if (bang.hidden) bang.hidden = false;
  } else if (!bang.hidden) bang.hidden = true;
  const rh = $('reelHint');
  if (g.reel && showReelHint && !tut.active) {
    rh.hidden = false; rh.style.top = Math.min(view.V.cy + view.V.ry * 1.1 + 52, view.V.stripTop - 16) + 'px';
  } else rh.hidden = true;
  let ring = null;
  if (tut.active && tut.step.ring === 'shadow' && !g.line) {
    const s = g.shadows[0];
    if (s) ring = [s.x, s.y, view.V.rx * 0.3];
  }
  view.frame(g, dt, { aim: aim && !paused ? aim : null, ring });
}

function save() { if (!DEMO) store.set('save', saveData(g)); }
addEventListener('visibilitychange', () => { if (document.hidden) { save(); hold = false; } });
addEventListener('pagehide', save);

// ---------------------------------------------------------------- demo (the preview screenshot)
function demo() {
  g = newGame({ log: Object.fromEntries(CATCHES.slice(0, 14).map(c => [c.id, 1])), clock: 0.5 }, 9);
  setSpot(g, 4);
  g.shadows = [];
  const put = (id, x, y, rot) => g.shadows.push({ uid: Math.random(), id, x, y, tx: x, ty: y, a: 1, state: 'wander', t: 0, rot: 0, wob: rot, speed: 0, notice: 0 });
  put('boat', -0.42, 0.18, 0.4); put('balloon', 0.38, -0.12, 2.2); put('coin', 0.12, 0.42, 1.1);
  g.line = { x: 0.28, y: 0.05, state: 'wait', t: 1, target: null, nibbles: 0, next: 0, twitch: 0, dip: 0 };
  $('hud').hidden = false; $('strip').hidden = false;
  layout(); updateHud();
  view.plop(0.28, 0.05);
  paused = true;
}

// ---------------------------------------------------------------- start
layout();
if (DEMO) demo();
else {
  updateHud();
  openTitle();
}
requestAnimationFrame(t => { lastT = t; frame(t); });
window.toyboxReady?.();

if (DEBUG) {
  window.pd = {
    get g() { return g; }, view, tut, sound, hold: false, step,
    ff(sec) { for (let t = 0; t < sec; t += 0.05) step(0.05); },
    press: (x, y) => press(x, y, true), release, setHold: v => { hold = v; },
  };
}
