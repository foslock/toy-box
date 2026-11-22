// Panto Horse: the page. Programme, input, HUD, lesson coach, tannoy, results.
import { EVENTS, Course } from './course.js';
import { Run, LESSON } from './game.js';
import { Walker } from './walker.js';
import { Bot } from './bot.js';
import { View } from './render.js';
import { Sound } from './sound.js';
import { Tannoy } from './talk.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug');
const $ = (id) => document.getElementById(id);
const view = new View($('cv'));
const sound = new Sound();
const tannoy = new Tannoy();
const SAVE_KEY = 'pantohorse.v1';

let save = load();
let mode = 'prog';      // prog | run | pause | results | best
let run = null;
let idle = null;        // the horse ambling about behind the programme
let best = null;        // replaying the best wipeout from the results card
let clock = 0;          // real seconds
let joy = 0;
let lastFrame = performance.now();
let hold = false;       // ?debug: stop the loop ticking

function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && typeof s === 'object') return { paddock: !!s.paddock, open: !!s.open, best: s.best || {}, muted: !!s.muted }; } catch {}
  return { paddock: false, open: false, best: {}, muted: false };
}
function store() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} }

// ---------- touch or keys?
let touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
function setTouch(on) { touch = on; document.body.classList.toggle('touch', on); }
setTouch(touch);
addEventListener('touchstart', () => { if (!touch) setTouch(true); }, { passive: true, capture: true });
addEventListener('keydown', (e) => { if (touch && !e.repeat && (KEY_BACK.has(e.code) || KEY_FRONT.has(e.code))) setTouch(false); }, { capture: true });

const keyName = (half) => (touch ? (half === 'back' ? 'your left thumb' : 'your right thumb') : half === 'back' ? 'A' : 'L');
function fill(text) {
  return text.replace(/\{(back|front)\}/g, (_, h) => (touch ? `the <b>${h === 'back' ? 'left' : 'right'}</b> side` : `<kbd>${h === 'back' ? 'A' : 'L'}</kbd>`));
}

// ---------- sizes
function resize() { view.resize(innerWidth, innerHeight); }
addEventListener('resize', resize);
resize();

// ---------- the programme
const PLACE = { 1: ['First', 'red', '1st'], 2: ['Second', 'blue', '2nd'], 3: ['Third', 'mustard', '3rd'], 4: ['Highly Commended', 'green', 'H.C.'], 0: ['Passed', 'green', 'OK'] };
const COL = { red: '#c8432b', blue: '#3e6d8f', mustard: '#e0a82e', green: '#4c7a3d', none: '#e7d9bc' };
function rosette(place, big) {
  const [, c, label] = PLACE[place] || ['', 'none', ''];
  const col = COL[c] || COL.none;
  let ruff = '';
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, b = ((i + 0.5) / 18) * Math.PI * 2;
    ruff += `${i ? 'L' : 'M'}${40 + Math.cos(a) * 34},${36 + Math.sin(a) * 34} Q${40 + Math.cos(b) * 41},${36 + Math.sin(b) * 41} ${40 + Math.cos(((i + 1) / 18) * Math.PI * 2) * 34},${36 + Math.sin(((i + 1) / 18) * Math.PI * 2) * 34} `;
  }
  return `<path d="M27 58 L16 102 L26 95 L33 103 L40 62 Z M53 58 L64 102 L54 95 L47 103 L40 62 Z" fill="${col}" stroke="#221d1a" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="${ruff}Z" fill="${col}" stroke="#221d1a" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="40" cy="36" r="22" fill="#fbf4e2" stroke="#221d1a" stroke-width="2.5"/>
    <circle cx="40" cy="36" r="17" fill="none" stroke="${col}" stroke-width="2" stroke-dasharray="3 3"/>
    <text x="40" y="${label.length > 3 ? 40 : 42}" text-anchor="middle" font-family="Holtwood One SC, serif" font-size="${label.length > 3 ? 10 : 15}" fill="#221d1a">${label}</text>`;
}

function unlocked(ev) { return ev.id === 'paddock' || save.paddock || save.open; }
function buildProgramme() {
  const ul = $('classes');
  ul.innerHTML = '';
  EVENTS.forEach((ev, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    const rec = save.best[ev.id];
    const place = rec ? rec.place : null;
    b.innerHTML = `<span class="cnum">CLASS<br>${i + 1}</span><span><span class="cname">${ev.title}</span><span class="cblurb">${!unlocked(ev) ? 'Opens once you’ve passed the paddock.' : bestLine(ev, rec) || ev.blurb}</span></span><svg class="rosette ${place == null ? 'none' : ''}" viewBox="0 0 80 104">${rosette(place == null ? -1 : place)}</svg>`;
    b.disabled = !unlocked(ev);
    b.addEventListener('click', () => start(ev.id));
    li.appendChild(b); ul.appendChild(li);
  });
  $('controlsNote').innerHTML = touch
    ? 'Left thumb works the <b>back end</b>, right thumb the <b>front end</b>. Tap to step; hold and let go to hop.'
    : '<kbd>A</kbd> works the <b>back end</b>, <kbd>L</kbd> the <b>front end</b>. Tap to step; hold and let go to hop.';
  $('unlockAll').hidden = save.paddock || save.open;
}
function bestLine(ev, rec) {
  if (!rec) return '';
  if (ev.kind === 'tutorial') return 'Passed. Come back any time for a refresher.';
  if (ev.kind === 'parade') return `Best: in step ${Math.round(rec.share * 100)}% of the way.`;
  if (ev.kind === 'race') return `Best: ${PLACE[rec.place][0].toLowerCase()} place, ${fmt(rec.t)}.`;
  return `Best round: ${fmt(rec.t)}.`;
}
function fmt(t) { t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; }

function showProgramme() {
  mode = 'prog';
  run = null; best = null;
  sound.band(false);
  for (const id of ['hud', 'coach', 'results', 'pause', 'replayTag', 'tBack', 'tFront', 'how']) $(id).hidden = true;
  $('prog').hidden = false;
  buildProgramme();
  makeIdle();
}
function makeIdle() {
  const c = new Course({ length: 1e6, flags: [0], obstacles: [] });
  const w = new Walker(c, 0);
  idle = { c, w, bot: new Bot(w, { rate: 1.7, skill: 1, hops: false, seed: 3 }), t: 0 };
  view.follow(w.x(), 0, true);
}

// ---------- starting a class
function start(id, opts = {}) {
  const def = EVENTS.find((e) => e.id === id);
  sound.init(); sound.resume();
  run = new Run(def, { autoplay: opts.autoplay, quick: opts.quick, seed: Math.floor(Math.random() * 1e6) });
  mode = 'run'; best = null;
  idle = null;
  for (const n of ['back', 'front']) down[n] = 0;
  $('prog').hidden = true; $('results').hidden = true; $('pause').hidden = true; $('how').hidden = true;
  $('hud').hidden = false; $('tBack').hidden = false; $('tFront').hidden = false;
  $('evTag').textContent = def.title;
  $('coach').hidden = def.kind !== 'tutorial';
  if (def.kind === 'tutorial') setCoach(0);
  view.follow(run.focusX(), 0, true);
  tannoy.until = 0;
  if (!DEMO) banner(def.kind === 'tutorial' ? 'The Paddock' : 'Under starter’s orders', def.kind === 'tutorial' ? 'Nobody’s watching. Probably.' : def.blurb);
  sound.band(false);
}

function setCoach(i) {
  const st = LESSON[i];
  if (!st) return;
  $('coach').querySelector('.step').textContent = `Lesson ${i + 1} of ${LESSON.length}`;
  $('coachText').innerHTML = fill(st.say);
  $('coachHint').hidden = true;
  const c = $('coach'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
}

function banner(text, small) {
  const b = $('banner');
  b.innerHTML = text + (small ? `<small>${small}</small>` : '');
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

// ---------- input
const KEY_BACK = new Set(['KeyA', 'KeyS', 'KeyZ', 'KeyX', 'KeyQ', 'KeyW', 'ArrowLeft', 'ShiftLeft']);
const KEY_FRONT = new Set(['KeyL', 'KeyK', 'KeyJ', 'KeyM', 'KeyO', 'KeyI', 'Semicolon', 'ArrowRight', 'ShiftRight', 'Enter']);
const down = { back: 0, front: 0 };
function halfDown(name) {
  sound.init(); sound.resume();
  if (mode === 'best') { endBest(); return; }
  if (mode !== 'run' || !run) return;
  if (run.state === 'replay') { run.skipReplay(); return; }
  down[name]++;
  if (down[name] === 1) run.press(name);
}
function halfUp(name) {
  if (down[name] <= 0) return;
  down[name] = Math.max(0, down[name] - 1);
  if (down[name] === 0 && run) run.release(name);
}
function releaseAll() { for (const n of ['back', 'front']) { down[n] = 1; halfUp(n); } pointers.clear(); }

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === 'Escape') { e.preventDefault(); if (mode === 'run') pause(); else if (mode === 'pause') resume(); else if (!$('how').hidden) closeHow(); return; }
  // keys on a sheet: Enter/Space press the focused (or first) button
  if (mode === 'results' || mode === 'pause' || !$('how').hidden || mode === 'prog') {
    if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
      const sheet = !$('how').hidden ? $('how') : mode === 'results' ? $('results') : mode === 'pause' ? $('pause') : null;
      if (sheet) { e.preventDefault(); const f = document.activeElement; (sheet.contains(f) && f.tagName === 'BUTTON' ? f : sheet.querySelector('.btn')).click(); }
    }
    return;
  }
  const name = KEY_BACK.has(e.code) ? 'back' : KEY_FRONT.has(e.code) ? 'front' : null;
  if (mode === 'best') { if (!e.repeat) endBest(); return; }
  if (!name) { if (mode === 'run' && run && run.state === 'replay' && !e.repeat) run.skipReplay(); return; }
  e.preventDefault();
  if (e.repeat) return;
  if (keysDown.has(e.code)) return;
  keysDown.add(e.code);
  halfDown(name);
});
const keysDown = new Set();
addEventListener('keyup', (e) => {
  if (!keysDown.has(e.code)) return;
  keysDown.delete(e.code);
  const name = KEY_BACK.has(e.code) ? 'back' : KEY_FRONT.has(e.code) ? 'front' : null;
  if (name) halfUp(name);
});
const pointers = new Map();
const pad = $('pad');
pad.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' && !touch) setTouch(true);
  e.preventDefault();
  const name = e.clientX < innerWidth / 2 ? 'back' : 'front';
  pointers.set(e.pointerId, name);
  try { pad.setPointerCapture(e.pointerId); } catch {}
  halfDown(name);
});
const up = (e) => { const n = pointers.get(e.pointerId); if (!n) return; pointers.delete(e.pointerId); halfUp(n); };
pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up); pad.addEventListener('lostpointercapture', up);
pad.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('blur', () => { keysDown.clear(); releaseAll(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { keysDown.clear(); releaseAll(); if (mode === 'run' && !DEMO) pause(); } });

// ---------- buttons
$('muteBtn').addEventListener('click', () => { save.muted = !save.muted; store(); applyMute(); $('muteBtn').blur(); });
function applyMute() { sound.setMuted(save.muted); $('muteWave').style.display = save.muted ? 'none' : ''; $('muteBtn').setAttribute('aria-label', save.muted ? 'Sound on' : 'Sound off'); }
applyMute();
$('pauseBtn').addEventListener('click', () => { pause(); });
$('resumeBtn').addEventListener('click', resume);
$('restartBtn').addEventListener('click', () => start(run.def.id));
$('pauseProgBtn').addEventListener('click', showProgramme);
$('pauseHowBtn').addEventListener('click', () => openHow());
$('howBtn').addEventListener('click', () => openHow());
$('howOk').addEventListener('click', closeHow);
$('unlockAll').addEventListener('click', () => { save.open = true; store(); buildProgramme(); });
$('againBtn').addEventListener('click', () => start(run.def.id));
$('progBtn').addEventListener('click', showProgramme);
$('nextBtn').addEventListener('click', () => { const i = EVENTS.indexOf(run.def); start(EVENTS[Math.min(EVENTS.length - 1, i + 1)].id); });
$('bestBtn').addEventListener('click', playBest);

function openHow() { $('how').hidden = false; $('howOk').focus({ preventScroll: true }); }
function closeHow() { $('how').hidden = true; }
function pause() {
  if (mode !== 'run') return;
  releaseAll(); keysDown.clear();
  mode = 'pause'; $('pause').hidden = false; $('resumeBtn').focus({ preventScroll: true });
  sound.band(false);
}
function resume() { if (mode !== 'pause') return; mode = 'run'; $('pause').hidden = true; $('how').hidden = true; lastFrame = performance.now(); }

// ---------- what the run says, heard and shown
let lastStretchTalk = -9, frontHopAt = null, tripsSince = 0;
function react(e) {
  const now = clock, r = run;
  switch (e.type) {
    case 'go':
      sound.pistol();
      tannoy.line(r.kind === 'parade' ? 'goParade' : r.kind === 'dressage' ? 'goDressage' : r.kind === 'race' ? 'goRace' : 'go', now, { pri: 2 });
      if (r.kind !== 'tutorial') banner('GO!');
      if (r.kind === 'parade') sound.band(true);
      break;
    case 'land': sound.clop(e.half, e.water); break;
    case 'hop': sound.hop(); if (e.half === 'front') { frontHopAt = now; tripsSince = 0; } break;
    case 'landHop':
      sound.thump(e.hard || 0); if (e.water) sound.splash();
      if (e.half === 'back' && frontHopAt != null && now - frontHopAt < 3 && tripsSince === 0) { tannoy.line('clear', now); joy = Math.min(1, joy + 0.5); }
      if (e.half === 'front' && r.kind === 'tutorial' && r.lesson && LESSON[r.lesson.i].id === 'hopF') tannoy.line('hopOnly', now);
      break;
    case 'trip': sound.trip(); tripsSince++; tannoy.line(e.half === 'back' ? 'tripBack' : 'trip', now); break;
    case 'stumble': sound.burst && sound.burst(900, 2, 0.12, 0.06); tannoy.line('stumble', now, { pri: 0 }); break;
    case 'slip': sound.trip(); break;
    case 'bump': sound.bump(); tannoy.line('bump', now); break;
    case 'splash': sound.splash(); tannoy.line('splash', now, { pri: 2 }); joy = Math.min(1, joy + 0.4); break;
    case 'flag': sound.flag(); if (r.kind !== 'tutorial') tannoy.line('flag', now, { pri: 0 }); break;
    case 'hup': sound.hupCall(e.st === 'hup'); break;
    case 'wipe':
      sound.crowd('ooh'); if (e.torn) sound.rip(); sound.oof();
      joy = 1;
      tannoy.line(e.torn ? 'tear' : e.why === 'rear' ? 'wipeRear' : 'wipeNose', now, { pri: 3, hold: 3 });
      if (r.lesson) { $('coachHint').hidden = false; $('coachHint').textContent = 'Not to worry: you start again from the last flag you passed.'; }
      break;
    case 'replay': tannoy.line('replay', now, { pri: 3 }); break;
    case 'respawn': tannoy.line('respawn', now, { pri: 2 }); break;
    case 'tuba': sound.parp(); sound.crowd('laugh'); tannoy.line('tuba', now, { pri: 2 }); break;
    case 'halt': sound.bell(); sound.crowd('cheer'); tannoy.line('halt', now, { pri: 2 }); joy = 0.7; break;
    case 'missed': tannoy.line('missed', now, { pri: 2 }); sound.crowd('laugh'); break;
    case 'rivalDown': tannoy.line('rivalDown', now, { pri: 1, vars: e }); sound.crowd('ooh'); break;
    case 'rivalHome': tannoy.line('rivalHome', now, { pri: 1, vars: e }); break;
    case 'lesson': setCoach(e.i); sound.flag(); break;
    case 'finish':
      sound.crowd('cheer'); sound.band(false);
      if (r.kind !== 'tutorial') tannoy.line('finish', now, { pri: 3, hold: 4 });
      joy = 1;
      setTimeout(() => { if (run === r && mode === 'run') showResults(); else if (run === r) r.pendingResults = true; }, 1700);
      break;
  }
}

function watchStretch() {
  const w = run.walker;
  if (run.state === 'go' && w.sStretch > 0.2 && clock - lastStretchTalk > 5) { lastStretchTalk = clock; tannoy.line('stretch', clock); }
  if (run.band && run.band.status === 'far' && run.t > run.band.wait + 4 && clock - (run.farTalk || 0) > 7) { run.farTalk = clock; tannoy.line('far', clock, { pri: 0 }); }
}

// contextual nudges under the lesson card
function lessonHint() {
  const r = run, L = r.lesson, w = r.walker, hint = $('coachHint');
  if (!L || r.state !== 'go') return;
  const id = LESSON[L.i] && LESSON[L.i].id;
  let h = null;
  if (id === 'walk' || id === 'together' || id === 'hopF' || id === 'hopB' || id === 'bale') {
    if (w.sStretch > 0.16) h = 'Too far apart! Hurry the back end along.';
    else if (w.stretch < -0.08) h = 'Bunching up: let the front end go first.';
  }
  if (id === 'hopF') { const o = r.course.nextObstacle(w.front.x); if (o && o.x0 - w.front.x < 1.6 && o.x0 > w.front.x && !w.front.air) h = w.front.crouch > 0.5 ? 'Now let go!' : 'Hold the front end down… then let go.'; }
  if ((id === 'hopB' || id === 'bale') && r.hup && !r.hup.gone) h = r.hup.st === 'hup' ? 'HUP! Let go of the back end!' : 'Ready… hold the back end down.';
  if (h) { hint.hidden = false; hint.textContent = h; }
  else if (!hint.textContent.startsWith('Not to worry') || clock - (L.hintAt || 0) > 4) { hint.hidden = true; hint.textContent = ''; }
  if (h) L.hintAt = clock;
}

// ---------- results
function showResults() {
  const r = run, res = r.result, def = r.def;
  mode = 'results';
  releaseAll();
  $('results').hidden = false;
  $('tBack').hidden = true; $('tFront').hidden = true; $('coach').hidden = true;
  const i = EVENTS.indexOf(def);
  $('resKicker').textContent = `Class ${i + 1} · ${def.title}`;
  const place = res.place;
  $('resRosette').innerHTML = rosette(place, true);
  $('resTitle').textContent = def.kind === 'tutorial' ? 'Passed out of the paddock' : place === 4 ? 'Highly Commended' : `${PLACE[place][0]} Place`;
  const stats = [];
  let note = '';
  if (def.kind === 'tutorial') {
    note = 'You can walk, hop and keep the seams together. The ring awaits.';
    save.paddock = true;
  } else if (def.kind === 'parade') {
    stats.push(`In step behind the band: <b>${Math.round(res.share * 100)}%</b>`);
    if (res.bumps) stats.push(`Tuba incidents: <b>${res.bumps}</b>`);
    note = place === 1 ? 'The band have asked you back next year.' : `Stay within a horse’s length of the tuba for ${Math.round(def.medals.gold * 100)}% of the way for the red rosette.`;
  } else if (def.kind === 'race') {
    const field = [{ name: 'You', t: res.raw }].concat(res.field.map((f) => ({ name: f.name, t: f.t }))).sort((a, b) => (a.t ?? 1e9) - (b.t ?? 1e9));
    field.forEach((f, k) => stats.push(`${k + 1}. ${f.name === 'You' ? '<b>You</b>' : f.name} ${f.t != null ? '· ' + fmt(f.t) : '· still going'}`));
    note = place === 1 ? 'Winner of the Grand Panto Derby! The cup is slightly dented.' : 'Beat all three for the red rosette.';
  } else {
    stats.push(`Time: <b>${fmt(res.raw)}</b>${res.penalty ? ` + ${res.penalty} s penalties = <b>${fmt(res.t)}</b>` : ''}`);
    const m = def.medals;
    note = place === 1 ? 'A clear red. The judges are delighted.' : `Red rosette under ${fmt(m.gold)}, blue under ${fmt(m.silver)}, yellow under ${fmt(m.bronze)}.`;
  }
  stats.push(`Wipeouts: <b>${res.wipeouts}</b>${res.patches ? ` · Patches sewn on: <b>${res.patches}</b>` : ''}`);
  $('resStats').innerHTML = stats.map((s) => `<li>${s}</li>`).join('');
  $('resNote').textContent = note;
  // keep the best
  if (def.kind !== 'tutorial') {
    const old = save.best[def.id];
    const better = !old || place < old.place || (place === old.place && (def.kind === 'parade' ? res.share > old.share : res.t < old.t));
    if (better) save.best[def.id] = { place, t: res.t, share: res.share };
  } else save.best.paddock = { place: 0, t: res.t };
  store();
  $('nextBtn').hidden = i >= EVENTS.length - 1;
  $('nextBtn').textContent = def.kind === 'tutorial' ? 'Into the ring' : 'Next class';
  $('bestBtn').hidden = !r.best;
  $(def.kind === 'tutorial' ? 'nextBtn' : 'againBtn').focus({ preventScroll: true });
}

function playBest() {
  if (!run || !run.best) return;
  const fr = run.best.frames;
  if (!fr.length) return;
  mode = 'best';
  best = { frames: fr, t: fr[0].t, end: fr[fr.length - 1].t };
  $('results').hidden = true; $('replayTag').hidden = false;
  tannoy.line('replay', clock, { pri: 3 });
}
function endBest() { best = null; $('replayTag').hidden = true; mode = 'results'; $('results').hidden = false; }

// ---------- HUD
const seamEls = [...$('seam').children];
function hud() {
  const r = run;
  $('clock').textContent = fmt(r.t + r.penalty);
  const w = r.walker;
  const gone = Math.round(w.tear * seamEls.length);
  seamEls.forEach((el, i) => el.classList.toggle('gone', i >= seamEls.length - gone));
  $('seam').classList.toggle('warn', w.sStretch > 0.14 && r.state === 'go');
  let st = null;
  if (r.band) st = `In step <b>${r.band.total > 0 ? Math.round((r.band.inStep / r.band.total) * 100) : 100}%</b>${r.band.status === 'far' ? ' · keep up!' : r.band.status === 'close' ? ' · mind the tuba!' : ''}`;
  else if (r.marks) st = r.marks.map((m) => (m.state === 'done' ? `<b>${m.letter}✓</b>` : m.state === 'missed' ? `<s>${m.letter}</s>` : m.letter)).join(' · ');
  else if (r.rivals) {
    const me = r.state === 'done' ? -1 : r.focusX();
    const ahead = r.rivals.filter((v) => v.done != null || (v.down > 0 ? v.heap.x : v.w.x()) > me).length;
    st = r.state === 'done' ? `Finished <b>${['1st', '2nd', '3rd', '4th'][r.result.place - 1]}</b>` : `Running <b>${['1st', '2nd', '3rd', '4th'][ahead]}</b> of 4`;
  } else if (r.kind === 'time') { const k = r.course.flags.indexOf(r.flag); st = k < r.course.flags.length - 1 ? `Next: flag <b>${k + 1}</b> of ${r.course.flags.length - 1}` : 'Next: <b>the finish</b>'; }
  const s = $('status');
  s.hidden = !st; if (st && s.innerHTML !== st) s.innerHTML = st;
  // thumb pads
  for (const [name, el] of [['back', $('tBack')], ['front', $('tFront')]]) {
    const h = w[name];
    el.classList.toggle('down', down[name] > 0 || (r.autoplay && h.down));
    const ring = el.querySelector('.charge');
    const c = Math.min(1, h.crouch);
    ring.style.strokeDasharray = `${c * 402} 999`;
    const hupOn = name === 'back' && r.hup && !r.hup.gone && r.simT - r.hup.t < 0.7 && r.state === 'go';
    el.classList.toggle('hup', !!hupOn && r.hup.st === 'hup');
    el.classList.toggle('ready', !!hupOn && r.hup.st === 'ready');
  }
  $('replayTag').hidden = !(r.state === 'replay' || mode === 'best');
  const say = tannoy.current(clock);
  $('tannoy').classList.toggle('on', !!say);
  if (say && $('tannoyText').textContent !== say) $('tannoyText').textContent = say;
}

// ---------- the loop
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.05, (now - lastFrame) / 1000));
  lastFrame = now;
  if (!hold) step(dt);
  draw();
}
function step(dt) {
  clock += dt;
  joy = Math.max(0, joy - dt * 0.35);
  view.crowdJoy = 0.25 + joy;
  if (mode === 'prog' && idle) {
    idle.t += dt;
    idle.bot.tick(idle.w.t);
    idle.w.update(Math.min(dt, 1 / 30));
    idle.w.events.length = 0;
    view.follow(idle.w.x(), dt);
    return;
  }
  if (mode === 'best' && best) {
    best.t += dt * 0.55;
    const p = bestPose();
    if (p) view.follow((p.F.x + p.B.x) / 2, dt);
    if (best.t >= best.end) endBest();
    return;
  }
  if (!run) return;
  if (mode === 'run' || mode === 'results') {
    run.update(dt);
    for (const e of run.out) react(e);
    run.out.length = 0;
    if (mode === 'run') { watchStretch(); lessonHint(); if (run.pendingResults && run.state === 'done') { run.pendingResults = false; showResults(); } }
    view.follow(run.focusX(), dt);
  }
}
function bestPose() {
  if (!best) return null;
  let i = 0; const fr = best.frames;
  while (i < fr.length - 1 && fr[i + 1].t <= best.t) i++;
  return fr[i] && fr[i].pose;
}
function draw() {
  if (mode === 'prog' && idle) { view.draw(null, { pose: idle.w.pose(), t: clock }); return; }
  if (mode === 'best') { view.draw(run, { pose: bestPose(), t: clock }); hud(); return; }
  if (run) { view.draw(run, { t: clock }); hud(); }
}

// ---------- go
if (DEMO) {
  $('prog').hidden = true;
  start('steeple', { autoplay: true, quick: true });
  // fast-forward to the front end sailing over the first bale
  for (let i = 0; i < 6000 && !(run.walker.front.air && run.walker.front.x > 14.62); i++) { run.update(1 / 120); for (const e of run.out) if (e.type === 'go') {} run.out.length = 0; }
  view.follow(run.focusX(), 0, true);
  tannoy.line('clear', clock, { hold: 60 });
  tannoy.say = 'The front end’s over! Now the back end, who can’t see a thing…';
  hold = true;
} else showProgramme();
if (DEBUG) {
  window.ph = {
    get run() { return run; }, get mode() { return mode; }, view, sound, tannoy, start, showProgramme, showResults, pause, resume,
    press: halfDown, release: halfUp,
    hold(v) { hold = v; },
    ff(sec) { for (let t = 0; t < sec; t += 1 / 60) step(1 / 60); draw(); return run && { state: run.state, t: run.t, x: run.walker.x() }; },
  };
  if (Q.has('hold')) hold = true;
}
requestAnimationFrame((t) => { lastFrame = t; frame(t); });
window.toyboxReady?.();
