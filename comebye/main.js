// Come Bye: the page. Input, the HUD, Tam's lesson, the programme and the judge's card,
// plus ?demo (the preview shot), ?autoplay, ?debug, ?trial=<id>, ?speed=<n> and ?hold.

import { COURSES, NOTES } from './courses.js';
import { Trial, PHASE_NAME } from './sim.js';
import { View, drawSheep, drawDog } from './render.js';
import { Sound } from './sound.js';
import { botThink } from './bot.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug'), AUTO = Q.has('autoplay') || DEMO;
const SPEED = +(Q.get('speed') || 1);
document.body.classList.toggle('demo', DEMO);
const $ = id => document.getElementById(id);
const TOUCH = matchMedia('(pointer: coarse)').matches;

// ------------------------------------------------------------------------------------- saving
const KEY = 'comebye.v1';
let save = { best: {}, done: {}, seen: {}, sound: true };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* private mode: play without saving */ }
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ } };

const view = new View($('c'));
const sound = new Sound();
sound.on = save.sound !== false;
let tr = null, course = null, paused = true, hold = Q.has('hold');
const botMem = {};
let botT = 0;

// ------------------------------------------------------------------------------------- input
const ptr = { id: null, x: 0, y: 0, down: false };
const keys = new Set();
const cv = $('c');
cv.addEventListener('pointerdown', e => {
  sound.start();
  if (ptr.id != null || !tr || paused) return;
  ptr.id = e.pointerId; ptr.down = true; ptr.x = e.clientX; ptr.y = e.clientY;
  ptr.world = view.toWorld(e.clientX, e.clientY);
  cv.setPointerCapture?.(e.pointerId);
  lesson.ev('down');
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== ptr.id) return;
  ptr.x = e.clientX; ptr.y = e.clientY; ptr.world = view.toWorld(e.clientX, e.clientY);
});
const up = e => { if (e.pointerId !== ptr.id) return; ptr.id = null; ptr.down = false; lesson.ev('up'); };
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', up);
cv.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => {
  if (e.key === 'Escape' || e.key === 'p') { if (tr && !tr.done && $('menu').hidden && $('card').hidden) togglePause(); return; }
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' ', 'shift'].includes(k)) {
    if (!$('menu').hidden || !$('card').hidden || !$('pause').hidden) return;
    e.preventDefault(); sound.start(); keys.add(k); lesson.ev('key');
  }
});
addEventListener('keyup', e => { keys.delete(e.key.toLowerCase()); if (!keys.size) lesson.ev('up'); });
addEventListener('blur', () => { keys.clear(); ptr.id = null; ptr.down = false; });

function steer() {
  if (AUTO) {
    if ((botT -= 1 / 60) <= 0) { botThink(tr, botMem); botT = 0.2; }
    return;
  }
  const d = tr.dog;
  let kx = 0, ky = 0;
  if (keys.has('arrowleft') || keys.has('a')) kx--;
  if (keys.has('arrowright') || keys.has('d')) kx++;
  if (keys.has('arrowup') || keys.has('w')) ky--;
  if (keys.has('arrowdown') || keys.has('s')) ky++;
  if (kx || ky) {
    const L = Math.hypot(kx, ky), slow = keys.has('shift');
    tr.setTarget(d.x + kx / L * 5, d.y + ky / L * 5, slow ? 2.6 : 10.5);
  } else if (ptr.down && ptr.world && !keys.has(' ')) {
    tr.setTarget(ptr.world[0], ptr.world[1]);
  } else tr.clearTarget();
}

// ------------------------------------------------------------------------------------- HUD bits
const CALLS = { bye: ['Come bye!', 'clockwise'], away: ['Away to me!', 'anticlockwise'], lie: ['Lie down.', ''], walk: ['Walk up…', 'steady'], go: ['Go on, Fly!', ''], done: ["That'll do.", ''] };
let callT = 0, lastWhistle = 0;
function call(c) {
  const [a, b] = CALLS[c] || [];
  if (!a) return;
  $('call').innerHTML = `${a}${b ? `<small>${b}</small>` : ''}`;
  $('call').classList.add('on'); callT = 1.1;
  // a handler doesn't whistle every half-second: skip the sound if the last one was very recent
  const now = performance.now();
  if (c === 'lie' || c === 'done' || now - lastWhistle > 900) { sound.whistle(c); lastWhistle = now; }
}
function toast(a, b = '') {
  const t = $('toast');
  t.querySelector('.a').textContent = a; t.querySelector('.b').textContent = b;
  t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
}
function stepText(st) {
  if (!st) return '';
  const P = PHASE_NAME[st.phase];
  if (st.k === 'lift') return `<b>${P}</b> — send Fly round behind the sheep`;
  if (st.k === 'gate') return `<b>${P}</b> — ${st.label}`;
  if (st.k === 'post') return `<b>${P}</b> — on down to the post`;
  if (st.k === 'ring') return `<b>${P}</b> — all of them into the ring`;
  if (st.k === 'shed') return `<b>${P}</b> — split off the marked ${tr.c.marked > 1 ? 'ewes' : 'ewe'}`;
  if (st.k === 'pen') return `<b>${P}</b> — into the pen, gently`;
  return '';
}
function hud() {
  const [s] = tr.score();
  $('ptsN').textContent = s;
  const t = Math.max(0, Math.ceil(tr.timeLeft));
  $('clock').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  $('clock').classList.toggle('low', t <= 30);
}

// the little course plan in the corner
const map = $('map'), mg = map.getContext('2d');
function sizeMap() {
  const c = tr.c, small = innerWidth < 500, w = small ? 64 : 92, h = Math.round(w * c.h / c.w), dpr = Math.min(2, devicePixelRatio || 1);
  map.width = w * dpr; map.height = h * dpr; map.style.width = w + 'px'; map.style.height = h + 'px';
  map.dataset.w = w; map.dataset.h = h; map.dataset.dpr = dpr;
}
function drawMap() {
  const c = tr.c, w = +map.dataset.w, h = +map.dataset.h, dpr = +map.dataset.dpr, k = w / c.w;
  const g = mg;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#f4ecd8'; g.fillRect(0, 0, w, h);
  g.scale(k, k);
  g.strokeStyle = 'rgba(35, 36, 29, .5)'; g.lineWidth = 0.6 / k;
  if (c.stream) { g.strokeStyle = 'rgba(60, 100, 110, .6)'; g.lineWidth = 2.2; g.beginPath(); c.stream.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); }
  for (const [x, y, r] of c.heather || []) { g.fillStyle = 'rgba(120, 80, 110, .25)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  const st = tr.stepNow;
  for (const gt of tr.gateList) {
    const px = -gt.d[1], py = gt.d[0], hw = gt.w / 2 + 2;
    g.strokeStyle = st && st.k === 'gate' && st.gate === gt ? '#a8321f' : '#23241d'; g.lineWidth = 1.6;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(gt.c[0] + px * (gt.w / 2) * s, gt.c[1] + py * (gt.w / 2) * s); g.lineTo(gt.c[0] + px * hw * s, gt.c[1] + py * hw * s); g.stroke(); }
  }
  if (c.ring) { g.strokeStyle = 'rgba(35, 36, 29, .6)'; g.lineWidth = 0.8; g.setLineDash([2, 2]); g.beginPath(); g.arc(c.ring.c[0], c.ring.c[1], c.ring.r, 0, 7); g.stroke(); g.setLineDash([]); }
  if (c.pen) { g.strokeStyle = '#23241d'; g.lineWidth = 1.2; g.strokeRect(c.pen.x0, c.pen.y0, c.pen.x1 - c.pen.x0, c.pen.y1 - c.pen.y0); }
  g.fillStyle = '#23241d'; g.beginPath(); g.arc(c.post[0], c.post[1], 1.4, 0, 7); g.fill();
  // in the mist you don't know where they are
  if (!c.fog) { g.fillStyle = '#a8321f'; for (const s of tr.sheep) { g.beginPath(); g.arc(s.x, s.y, 1.5, 0, 7); g.fill(); } }
  g.fillStyle = '#23241d'; g.beginPath(); g.arc(tr.dog.x, tr.dog.y, 1.6, 0, 7); g.fill();
  g.fillStyle = '#f4ecd8'; g.beginPath(); g.arc(tr.dog.x, tr.dog.y, 0.7, 0, 7); g.fill();
  // what's on screen
  const [a, b] = view.toWorld(0, 0), [cc, dd] = view.toWorld(view.W, view.H);
  g.strokeStyle = 'rgba(35, 36, 29, .55)'; g.lineWidth = 0.8 / k * 1.2;
  g.strokeRect(Math.max(0, a), Math.max(0, b), Math.min(c.w, cc) - Math.max(0, a), Math.min(c.h, dd) - Math.max(0, b));
}

// ------------------------------------------------------------------------------------- Tam's notes
const note = {
  show(text, { step = '', ok = false, sticky = false } = {}) {
    $('noteP').innerHTML = text; $('noteStep').textContent = step;
    $('noteOk').hidden = !ok; $('noteX').hidden = sticky;
    $('note').classList.remove('off');
    this.on = true; this.t = sticky || ok ? 1e9 : 13;
    requestAnimationFrame(() => { view.inset.bottom = $('note').offsetHeight + 24; });
  },
  hide() { $('note').classList.add('off'); this.on = false; view.inset.bottom = 30; },
  tick(dt) { if (this.on && (this.t -= dt) <= 0) this.hide(); },
};
$('noteX').onclick = () => note.hide();
$('noteBtn').onclick = () => { note.hide(); lesson.ev('ok'); };

// The lesson: Tam talks you through one short run, one thing at a time, and waits until you've done it.
const press = TOUCH ? 'Press and hold' : 'Click and hold';
const LESSON = [
  { say: `This is Fly. ${press} anywhere on the grass and she runs to that spot. Try it now.${TOUCH ? '' : ' (Arrow keys or WASD work too.)'}`, until: (t, m) => Math.hypot(t.dog.x - m.x0, t.dog.y - m.y0) > 5 || t.stepNow?.k !== 'lift' },
  { say: `Now ${TOUCH ? 'lift your finger' : 'let go'}. She drops and lies still, and a dog lying down hardly bothers a sheep.`, until: (t, m) => (m.ups > 0 && t.dog.lying) || t.stepNow?.k !== 'lift' },
  { say: `The ewes are up at the top. ${press} on the far side of them. Fly takes the long way round so she won't scatter them. That's the <i>outrun</i>.`, until: (t) => (t.dog.y < t.cy - 2 && Math.hypot(t.dog.x - t.cx, t.dog.y - t.cy) < 16) || t.stepNow?.k !== 'lift', mark: t => [t.cx, t.cy - t.spread - 6] },
  { say: `Good. Now walk her on towards the sheep, slowly. Sheep move away from the dog, so they'll come down the field. Keep your finger just ahead of her.`, until: t => t.stepNow?.k !== 'lift' },
  { say: `Bring them through the fetch gates, the red flags. Keep Fly behind them, on the far side from where you want them to go. If one wanders, swing round it rather than through.`, until: t => t.stepNow?.k !== 'gate' },
  { say: `Through! Now down to me at the post. Steady. Rushing them costs you points.`, until: t => t.stepNow?.k !== 'post' },
  { say: `Last, the pen by the post. Line them up with the gap, then walk on gently. Too close and they'll break round it. Let go any time to stop her.`, until: t => t.done },
];
const lesson = {
  on: false, i: 0, m: {},
  start() { this.on = true; this.i = 0; this.m = { x0: tr.dog.x, y0: tr.dog.y, ups: 0 }; this.say(); },
  say() { const s = LESSON[this.i]; note.show(s.say, { step: `${this.i + 1} of ${LESSON.length}`, sticky: true }); },
  ev(e) { if (!this.on) return; if (e === 'up') this.m.ups++; },
  tick() {
    if (!this.on) return;
    const s = LESSON[this.i];
    if (s.until(tr, this.m)) {
      this.i++;
      if (this.i >= LESSON.length || tr.done) { this.on = false; note.hide(); return; }
      if (this.i === 1) this.m.ups = 0;
      this.say();
    }
  },
  mark() { return this.on && LESSON[this.i].mark ? LESSON[this.i].mark(tr) : null; },
};

// ------------------------------------------------------------------------------------- running a trial
function begin(c) {
  course = c;
  tr = new Trial(c, DEMO ? c.seed : (c.seed + Math.floor(Math.random() * 1e5)));
  view.setTrial(tr);
  view.resize();
  sizeMap();
  $('hudL').hidden = $('hudR').hidden = map.hidden = false;
  $('hudT').textContent = `${c.name} · ${c.place}`;
  $('hudS').innerHTML = stepText(tr.stepNow);
  for (const id of ['menu', 'card', 'pause']) $(id).hidden = true;
  note.hide();
  paused = false;
  seenThisRun = new Set();
  Object.keys(botMem).forEach(k => delete botMem[k]);
  if (c.tutorial && !AUTO) lesson.start(); else lesson.on = false;
  if (!c.tutorial && !AUTO) noteFor('outrun');
  hud();
}
let seenThisRun = new Set();
function noteFor(phase) {
  if (AUTO) return;
  const key = course.notes?.[phase];
  if (!key || seenThisRun.has(key)) return;
  seenThisRun.add(key);
  setTimeout(() => { if (tr && !tr.done) note.show(NOTES[key], { step: course.name }); }, 600);
}

function events() {
  const W = view.W;
  for (const e of tr.events) {
    if (e.t === 'cmd') { if (!AUTO || DEBUG) call(e.c); }
    else if (e.t === 'bleat') {
      const [px, py] = view.toScreen(e.s.x, e.s.y);
      const off = Math.hypot(px - W / 2, py - view.H / 2) / Math.max(W, view.H);
      const vol = Math.max(0, 0.9 - off * 0.8) * (0.4 + e.s.stress * 0.6);
      sound.bleat(e.s.pitch, (px / W) * 2 - 1, vol);
      if (tr.c.fog) view.ripple(e.s.x, e.s.y);
    } else if (e.t === 'step') {
      $('hudS').innerHTML = stepText(e.step);
      if (e.i > 0 && e.step.phase !== tr.steps[e.i - 1].phase) noteFor(e.step.phase);
    } else if (e.t === 'gatedone') {
      sound.tock();
      if (e.giveUp) toast('Judge waves you on', 'the gates are scored as missed');
      else if (!e.missed) { toast('All through', 'clean'); sound.applause(0.3); }
      else toast(`${e.missed} missed`, e.through ? `${e.through} through` : 'none through');
    } else if (e.t === 'phase') {
      if (e.phase !== 'pen') toast(`${PHASE_NAME[e.phase]}: ${e.pts}`, `out of ${e.max}`);
    } else if (e.t === 'shed') { toast('Shed!', 'that’ll do'); sound.applause(0.4); }
    else if (e.t === 'penned') { call('done'); sound.applause(1); }
    else if (e.t === 'end') { setTimeout(() => showCard(), e.result === 'complete' ? 2600 : 1200); if (e.result === 'time') { toast('Time!', 'the judge calls it'); } }
  }
  tr.events.length = 0;
}

// ------------------------------------------------------------------------------------- the loop
let last = performance.now(), first = true;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!tr) return;
  if (!paused && !hold) {
    steer();
    for (let i = 0; i < SPEED; i++) tr.update(dt);
    lesson.tick();
    events();
    hud();
  }
  note.tick(dt);
  if (callT > 0 && (callT -= dt) <= 0) $('call').classList.remove('on');
  const target = tr.dog.tx != null && !AUTO ? [tr.dog.tx, tr.dog.ty] : lesson.mark();
  view.draw(paused ? 0 : dt, now / 1000, { target });
  drawMap();
  ambience(dt);
  if (first) { first = false; window.toyboxReady?.(); }
}
function ambience(dt) {
  if (!sound.ctx) return;
  const c = tr.c;
  let beck = 0;
  if (c.stream) {
    let best = 1e9;
    for (const [x, y] of c.stream.pts) best = Math.min(best, Math.hypot(x - view.cam.x, y - view.cam.y));
    beck = Math.max(0, 1 - best / 30);
  }
  const wind = c.wind ? 0.5 + Math.hypot(...tr.windNow) : c.fog ? 0.05 : 0.15;
  sound.ambience(paused ? 0 : dt, { wind, beck, birds: c.fog ? 0.3 : c.wind ? 0.5 : 1 });
}

// ------------------------------------------------------------------------------------- sheets
function togglePause(force) {
  paused = force ?? !paused;
  $('pause').hidden = !paused;
  ptr.id = null; ptr.down = false; keys.clear();
}
$('bpause').onclick = () => togglePause(true);
$('presume').onclick = () => togglePause(false);
$('prestart').onclick = () => begin(course);
$('pretire').onclick = () => { $('pause').hidden = true; paused = false; tr.retire('retired'); };
$('pmenu').onclick = () => showMenu();

function soundLabel() { for (const id of ['bsound', 'psound']) $(id).textContent = `Sound: ${sound.on ? 'on' : 'off'}`; }
for (const id of ['bsound', 'psound']) $(id).onclick = () => { sound.start(); sound.setOn(!sound.on); save.sound = sound.on; store(); soundLabel(); };
soundLabel();

function unlocked(i) { return i === 0 || Q.has('all') || !!save.done[COURSES[i - 1].id]; }
function showMenu() {
  paused = true;
  for (const id of ['card', 'pause']) $(id).hidden = true;
  note.hide();
  const ul = $('classes'); ul.innerHTML = '';
  COURSES.forEach((c, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button'); b.className = 'cls';
    const max = c.phases.reduce((a, p) => a + ({ outrun: 10, fetch: 20, drive: 30, shed: 10, pen: 10 })[p], 0);
    const best = save.best[c.id];
    const open = unlocked(i);
    b.disabled = !open;
    const n = c.flock.map(f => `${f.n} ${f.kind === 'ewe' ? 'ewes' : f.kind === 'lamb' ? 'lambs' : 'tup'}`).join(', ');
    b.innerHTML = `<span class="n">${i + 1}</span><span class="nm">${c.name}<br><small>${c.place} · ${n} · ${c.time / 60} min</small></span>
      <span class="bs">${best != null ? `best<b>${best}/${max}</b>` : open ? 'not yet run' : 'closed'}</span>
      <span class="ds">${open ? c.note : `Opens when you finish class ${i}.`}</span>`;
    b.onclick = () => { sound.start(); begin(c); };
    li.appendChild(b); ul.appendChild(li);
  });
  $('howto').innerHTML = TOUCH
    ? '<b>How to handle.</b> Press and hold where Fly should run, and drag to steer her. Lift your finger and she lies down. The sheep keep away from her: put her on the far side of them from where they should go.'
    : '<b>How to handle.</b> Click and hold where Fly should run, and drag to steer her; let go and she lies down. Or use the arrow keys (Shift to creep, Space to drop her). Put her on the far side of the sheep from where they should go. Esc pauses.';
  const tot = Object.values(save.best).reduce((a, b) => a + b, 0);
  $('totalBest').textContent = tot ? `Season points: ${tot}` : '';
  $('menu').hidden = false;
  drawVignette();
}

function showCard() {
  paused = true;
  note.hide(); lesson.on = false;
  const c = tr.c, [s, m] = tr.score();
  const complete = tr.result === 'complete';
  let rows = '';
  for (const p of c.phases) {
    const sc = tr.scores[p];
    const why = sc.lost.map(l => `−${l.pts} ${l.why}`).join('<br>');
    const pts = sc.pts == null ? 0 : sc.pts;
    const note2 = sc.pts == null || (!complete && pts === 0 && !sc.lost.length) ? '<small>not run</small>' : why ? `<small>${why}</small>` : '';
    rows += `<tr><td>${PHASE_NAME[p]}${note2}</td><td class="num max">${sc.max}</td><td class="num">${pts}</td></tr>`;
  }
  const prev = save.best[c.id];
  if (complete) {
    save.done[c.id] = true;
    if (prev == null || s > prev) save.best[c.id] = s;
  } else if (prev == null && s > 0) save.best[c.id] = s;
  store();
  const idx = COURSES.indexOf(c), next = COURSES[idx + 1];
  const stamp = complete ? (s >= m * 0.85 ? 'Highly commended' : 'Completed') : tr.result === 'time' ? 'Time' : 'Retired';
  const verdict = complete ? (s >= m * 0.9 ? 'A lovely run. The crowd along the wall clapped that one.' : s >= m * 0.7 ? 'A tidy run, with a few points dropped on the way.' : 'Round and penned. Steadier lines next time.') : 'You have to pen them to finish. Have another go.';
  $('cardPage').innerHTML = `
    <div class="mast"><div class="over">Judge's card</div></div>
    <h2>${c.name}</h2><div class="cl">${c.place} · handler: yourself · dog: Fly</div>
    <table><tr><th>Phase</th><th>Max</th><th>Pts</th></tr>${rows}
    <tr class="tot"><td>Total</td><td class="num max">${m}</td><td class="num">${s}</td></tr></table>
    <div class="stampw"><span class="stamp">${stamp}</span></div>
    <div class="best">${verdict}${prev != null ? ` Your best here: ${Math.max(prev, complete ? s : prev)}.` : ''}</div>
    <div class="btns">
      ${complete && next ? `<button class="btn red" id="cnext">Class ${idx + 2}: ${next.name}</button>` : ''}
      <button class="btn${complete && next ? '' : ' red'}" id="cagain">Run it again</button>
      <button class="btn" id="cmenu">The programme</button>
    </div>`;
  $('card').hidden = false;
  if ($('cnext')) $('cnext').onclick = () => begin(next);
  $('cagain').onclick = () => begin(c);
  $('cmenu').onclick = () => showMenu();
}

// a sheep and the dog on a scrap of grass, at the top of the programme
function drawVignette() {
  const cv = $('vign'), g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#7d944e'; g.beginPath(); g.ellipse(220, 96, 200, 74, 0, 0, 7); g.fill();
  for (let i = 0; i < 500; i++) {
    const a = Math.random() * 7, d = Math.sqrt(Math.random());
    g.strokeStyle = ['#6e8a45', '#8c9c55', '#5d7a3c', '#a4b06a'][i % 4]; g.globalAlpha = 0.5; g.lineWidth = 2;
    const x = 220 + Math.cos(a) * d * 190, y = 96 + Math.sin(a) * d * 66;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y - 4); g.stroke();
  }
  g.globalAlpha = 1;
  g.save(); g.scale(30, 30);
  const sh = (x, y, h, kind = 'ewe', marked = false) => ({ x, y, h, r: kind === 'lamb' ? 0.34 : 0.5, kind, marked, stress: 0, speed: 0, step: 0, seed: x * 0.13 + y * 0.07, stand: 0 });
  for (const s of [sh(6.2, 2.6, 2.9), sh(7.5, 3.6, 3.2), sh(5.3, 3.7, 2.6, 'lamb'), sh(8.3, 2.5, 3.4, 'ewe', true), sh(6.8, 4.6, 3.0)]) {
    g.fillStyle = 'rgba(30, 40, 20, .3)'; g.beginPath(); g.ellipse(s.x + 0.4, s.y + 0.3, 0.62 * s.r / 0.5, 0.45 * s.r / 0.5, s.h, 0, 7); g.fill();
    drawSheep(g, s, 0, 1.15);
  }
  const dog = { x: 11.6, y: 3.6, h: Math.PI + 0.1, speed: 0, run: 0, lying: true };
  g.fillStyle = 'rgba(30, 40, 20, .3)'; g.beginPath(); g.ellipse(dog.x + 0.3, dog.y + 0.25, 0.5, 0.25, dog.h, 0, 7); g.fill();
  drawDog(g, dog, 0, 1.5);
  g.restore();
}

// ------------------------------------------------------------------------------------- start
addEventListener('resize', () => { if (tr) { view.resize(); sizeMap(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && tr && !tr.done && !paused && !AUTO) togglePause(true); });

const pick = COURSES.find(c => c.id === Q.get('trial'));
if (DEMO) {
  // the preview: Beck Field, the flock coming down to the ford with Fly working behind them
  begin(COURSES.find(c => c.id === 'beck'));
  for (let i = 0; i < 60 * 16; i++) { if (i % 12 === 0) botThink(tr, botMem); tr.tick(); }
  tr.events.length = 0;
  $('hudS').innerHTML = stepText(tr.stepNow);
  view.snap = true;
  hud();
} else if (pick) begin(pick);
else {
  // something to look at behind the programme
  begin(COURSES[save.done.lesson ? 1 : 0]);
  showMenu();
}
requestAnimationFrame(frame);

if (DEBUG) {
  window.game = {
    get tr() { return tr; }, view, sound, botThink, COURSES, begin,
    hold(v = true) { hold = v; },
    step(n = 60) { for (let i = 0; i < n; i++) { steer(); tr.tick(); } events(); hud(); view.draw(n / 60, performance.now() / 1000, {}); drawMap(); },
  };
}
