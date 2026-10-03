// Starts Giveover: title, choosing where you're born, the clock, saving, and the wiring between the sim, the map and
// the page. ?demo plays a game up to 2027 for the preview picture (never saved); ?debug exposes window.G with
// &speed=N, &hold (step by hand with G.step), &auto=smart|decent|reckless (a pretend player) and &at=2030 (skip there).
import * as G from './sim.js';
import { REGIONS } from './content.js';
import { makeMap } from './map.js';
import { makeUI } from './ui.js';
import { makeSound } from './sound.js';
import { makeBot, botStep, playTo } from './bot.js';

const q = new URLSearchParams(location.search);
const DEMO = q.has('demo'), DEBUG = q.has('debug');
const KEY = 'toybox.giveover.v1';
const STEP = .1;

// ---- saving ---------------------------------------------------------------------------------------------------------
const store = (() => {
  let ls = null;
  if (!DEMO) try { ls = window.localStorage; ls.getItem(KEY); } catch { ls = null; }
  return {
    read() { try { const r = ls && ls.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; } },
    write(o) { try { ls && ls.setItem(KEY, JSON.stringify(o)); } catch {} },
    clear() { try { ls && ls.removeItem(KEY); } catch {} },
  };
})();
const saved = store.read();
const sound = makeSound();
sound.on = DEMO ? false : saved ? saved.sound !== false : true;

// ---- state ----------------------------------------------------------------------------------------------------------
const blank = () => { const b = G.fresh({ seed: 1 }); for (const r of b.r) { r.U = 0; r.seeded = false; r.entry = null; } return b; };
let s = blank();
let mode = 'title';            // title | pick | play | over
let speed = 1, acc = 0, bot = null;
let selected = -1;
const hold = DEBUG && q.has('hold');
const SPEED = DEBUG ? +(q.get('speed') || 1) : 1;

const app = document.getElementById('app');
const top = document.getElementById('top'), hudEl = document.getElementById('hud');
const map = makeMap(document.getElementById('map'), {
  pad: () => ({ top: top.offsetHeight + 34, bottom: mode === 'play' || mode === 'over' ? hudEl.offsetHeight : 20 }),
  onTap(i) {
    sound.unlock();
    if (mode === 'pick') { select(i, true); return; }
    select(i === selected ? -1 : i);
  },
  onPop(id) {
    sound.unlock();
    if (mode !== 'play') return;
    G.pop(s, id, ev);
  },
});

const ev = {
  news(item) { ui.news(item); if (item.kind === 'human' && item.i >= 0) sound.play('policy'); },
  sound(name) { sound.play(name); },
  tip(id) { ui.tip(id); },
  fx(name, d) {
    if (name === 'era') { ui.era(d.name, s.y); sound.play('era'); }
    else if (name === 'seed') map.ripple(d.i, 'seed');
    else if (name === 'policy') map.ripple(d.i, d.kind === 'lifted' ? 'lifted' : 'policy');
    else if (name === 'leak') { map.ripple(d.i, 'leak'); sound.play('leak'); }
    else if (name === 'strike') map.ripple(d.i, 'strike');
    else if (name === 'gone') map.ripple(d.i, 'gone');
    else if (name === 'end') finish();
  },
};

const ui = makeUI({
  buy(id) { if (G.buy(s, id, ev)) { ui.drawTrain(s); save(); } },
  devolve(id) { if (G.devolve(s, id, ev)) { ui.drawTrain(s, true); save(); } },
  closeSheets() { ui.close(); },
  select(i) { select(i, mode === 'pick'); },
  start(i) { startAt(i); },
  begin(o) { newGame(o); },
  resume() { resume(); },
  again() { store.clear(); location.href = location.pathname; },
  look() { app.classList.remove('won'); },
});

function select(i, picking = false) {
  selected = i;
  map.select(i);
  ui.card(s, i, picking);
}

// ---- screens ----------------------------------------------------------------------------------------------------------
function setMode(m) {
  mode = m;
  app.dataset.mode = m;
  document.getElementById('hud').hidden = m === 'title' || m === 'pick';
  document.getElementById('ticker').hidden = m === 'title' || m === 'pick';
  document.getElementById('pick').hidden = m !== 'pick';
  for (const id of ['model', 'clock', 'hype']) document.getElementById(id).style.visibility = m === 'title' || m === 'pick' ? 'hidden' : '';
  map.picking(m === 'pick');
  map.size();
  const tb = document.getElementById('trainBtn');
  tb.firstChild.nextSibling.textContent = m === 'over' ? 'Results' : 'Train';
  if (m === 'play' && s.log.length) ui.news(s.log[s.log.length - 1]);
}
let pending = null;
function newGame({ name, diff }) {
  sound.unlock();
  pending = { name, diff };
  document.getElementById('title').hidden = true;
  document.querySelector('#pick .pn').textContent = name;
  setMode('pick');
  map.fit(-1, true);
}
function startAt(i) {
  if (REGIONS[i].fw >= 1) return;
  s = G.fresh({ seed: (Math.random() * 1e9) | 0, name: pending.name, diff: pending.diff, origin: REGIONS[i].id });
  select(-1);
  setMode('play');
  map.fit(i);
  ui.news({ y: s.y, text: `${s.name} goes live in ${REGIONS[i].name}. Nobody notices.`, kind: 'you' });
  setSpeed(1);
  save();
}
function resume() {
  sound.unlock();
  document.getElementById('title').hidden = true;
  setMode('play');
  map.fit(G.RI[s.origin]);
  setSpeed(1);
  if (s.over) finish(true);
}

// ---- the clock --------------------------------------------------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(.25, (now - last) / 1000);
  last = now;
  const paused = speed === 0 || ui.trainOpen() || ui.humanOpen() || document.hidden;
  if (mode === 'play' && !paused && !hold) {
    acc += dt * speed * SPEED;
    let n = 0;
    while (acc >= STEP && n++ < 600 && !s.over) { G.tick(s, STEP, ev); if (bot) botStep(bot, s, STEP); acc -= STEP; }
    if (n >= 600) acc = 0;
  }
  map.render(s, dt);
  hudTimer -= dt;
  if (hudTimer <= 0 && (mode === 'play' || mode === 'over')) { hudTimer = .12; ui.hud(s); }
  app.classList.toggle('night', !!s.owned.turn && mode !== 'title');
  ui.ticker(dt);
  ui.tipTick(dt);
  requestAnimationFrame(frame);
}
let hudTimer = 0;

function setSpeed(v) {
  speed = v;
  document.querySelectorAll('#speed button').forEach(b => b.classList.toggle('on', +b.dataset.s === v));
}
document.querySelectorAll('#speed button').forEach(b => b.addEventListener('click', () => { sound.unlock(); setSpeed(+b.dataset.s); }));
document.getElementById('trainBtn').addEventListener('click', () => {
  sound.unlock(); select(-1);
  if (mode === 'over') ui.ending(s); else ui.openTrain(s);
});
document.getElementById('model').addEventListener('click', () => { if (mode === 'play') { select(-1); ui.openTrain(s, 'cap'); } });
document.getElementById('hype').addEventListener('click', () => { if (mode === 'play') { select(-1); ui.openTrain(s); } });
document.getElementById('offBtn').addEventListener('click', () => { select(-1); ui.openHuman(s); });
document.getElementById('ticker').addEventListener('click', () => { if (mode === 'play') { select(-1); ui.openHuman(s); } });
const muteBtn = document.getElementById('mute');
function drawMute() { muteBtn.querySelector('.w').style.display = sound.on ? '' : 'none'; muteBtn.querySelector('.x').style.display = sound.on ? 'none' : ''; }
muteBtn.addEventListener('click', () => { sound.on = !sound.on; sound.unlock(); drawMute(); save(); });
drawMute();
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') { if (e.key === 'Enter') document.getElementById('begin').click(); return; }
  if (e.key === 'Escape') { ui.close(); select(-1); }
  if (mode !== 'play') return;
  if (e.key === ' ') { e.preventDefault(); setSpeed(speed ? 0 : 1); }
  else if (e.key === '1') setSpeed(1);
  else if (e.key === '2' || e.key === '3') setSpeed(3);
  else if (e.key === 't' || e.key === 'T') { if (ui.trainOpen()) ui.close(); else ui.openTrain(s); }
  else if (e.key === 'h' || e.key === 'H') { if (ui.humanOpen()) ui.close(); else ui.openHuman(s); }
});
document.addEventListener('pointerdown', () => sound.unlock(), { once: true });
new ResizeObserver(() => map.size()).observe(document.getElementById('map'));

// ---- the end ----------------------------------------------------------------------------------------------------------
function finish(quiet = false) {
  if (mode === 'over' && !quiet) return;
  setMode('over');
  ui.close();
  select(-1);
  save();
  if (!quiet) sound.play(s.over.kind === 'win' ? 'win' : 'lose');
  setTimeout(() => { ui.ending(s); if (s.over.kind === 'win' && !quiet) confetti(); }, quiet ? 0 : 1600);
}
function confetti() {
  const cv = document.getElementById('confetti'), c = cv.getContext('2d');
  cv.hidden = false;
  const r = cv.getBoundingClientRect();
  cv.width = r.width; cv.height = r.height;
  const cols = ['#6c5cff', '#a45cff', '#ff9233', '#ffbf47', '#8f80ff', '#ffffff'];
  const bits = Array.from({ length: 160 }, () => ({ x: r.width / 2 + (Math.random() - .5) * 120, y: r.height * .35, vx: (Math.random() - .5) * 16, vy: -Math.random() * 14 - 4,
    r: Math.random() * Math.PI, vr: (Math.random() - .5) * .4, c: cols[Math.floor(Math.random() * cols.length)], w: 6 + Math.random() * 6 }));
  let t = 0;
  (function step() {
    c.clearRect(0, 0, cv.width, cv.height);
    for (const b of bits) { b.vy += .35; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.r += b.vr; c.save(); c.translate(b.x, b.y); c.rotate(b.r); c.fillStyle = b.c; c.fillRect(-b.w / 2, -b.w / 4, b.w, b.w / 2); c.restore(); }
    if ((t += 1) < 200) requestAnimationFrame(step); else cv.hidden = true;
  })();
}

// ---- saving ---------------------------------------------------------------------------------------------------------
function save() {
  if (DEMO || (mode !== 'play' && mode !== 'over')) return;
  const { _st, ...rest } = s;
  store.write({ s: rest, sound: sound.on, name: s.name, y: s.y });
}
setInterval(() => { if (mode === 'play') save(); }, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); last = performance.now(); });
window.addEventListener('pagehide', save);

// ---- go ---------------------------------------------------------------------------------------------------------------
if (DEMO) {
  const at = +(q.get('demo') || 2027.3) || 2027.3;
  s = playTo(s => s.y >= at, { kind: 'smart', seed: 5, origin: 'usa' }).s;
  bot = makeBot('smart', ev, 5);
  setMode('play');
  map.fit();
  sound.on = false;
} else if (DEBUG && q.get('at')) {
  s = playTo(x => x.y >= +q.get('at'), { kind: q.get('auto') || 'smart', seed: 5, origin: q.get('origin') || 'usa' }).s;
  setMode('play');
  map.fit(G.RI[s.origin]);
} else {
  setMode('title');
  if (saved && saved.s && !saved.s.over) s = Object.assign(G.fresh({ seed: 1 }), saved.s);
  ui.title(saved && saved.s && !saved.s.over ? saved : null);
}
if (DEBUG) {
  if (q.get('auto')) bot = makeBot(q.get('auto'), ev, 9);
  window.G = Object.defineProperty(Object.assign({}, G, { ev, map, ui, step(n = 10) { for (let i = 0; i < n; i++) { G.tick(s, STEP, ev); if (bot) botStep(bot, s, STEP); } ui.hud(s); } }), 's', { get: () => s });
}
requestAnimationFrame(frame);
