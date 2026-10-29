// Pop-Up: the desktop, the taskbar, the Setup Wizard and the run of microgames.
import { C, rr, inR, cx, cy, winLayout, drawWin, font, button, para, wrap, wallpaper, wordart, icon, deskLabel, progress, arrowHint, hand, fitText, MONO, FONT } from './ui.js';
import { GAMES, BOSSES, byId, drawGo } from './games.js';
import { makeGame, step, input, Hand } from './engine.js';
import * as snd from './sound.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug'), AUTO = Q.has('autoplay');
const cv = document.getElementById('cv'), c = cv.getContext('2d');

// ---------------------------------------------------------------- save
const KEY = 'popup.v1';
let save = { best: 0, seen: [], tut: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} };
const seen = id => save.seen.includes(id);

// ---------------------------------------------------------------- layout
let W = 0, H = 0, dpr = 1, wall = null, sa = { t: 0, r: 0, b: 0, l: 0 }, taskY = 0, TASK = 44, area = { x: 0, y: 0, s: 480, k: 1 };
function layout() {
  W = innerWidth; H = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const cs = getComputedStyle(document.getElementById('safe'));
  sa = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  TASK = 44 + sa.b; taskY = H - TASK;
  // the clock sits above the play square, or beside it when the screen is wide and short
  let top = 56 + sa.t, avail = taskY - top - 8;
  const tall = taskY - sa.t - 16, side = W - Math.min(W - 16, tall) >= 2 * 200 && tall < 640;
  if (side) { top = sa.t + 8; avail = tall; }
  const s = Math.max(200, Math.min(W - 16 - sa.l - sa.r, avail));
  area = { x: (W - s) / 2, y: top + Math.max(0, (avail - s) / 2), s, k: s / 480, side };
  wall = wallpaper(W, H, dpr);
}
addEventListener('resize', layout);

// ---------------------------------------------------------------- state
const S = { mode: 'menu', t: 0, start: false, dialog: null, folder: false, wiz: null, overT: 0, hold: false, booted: false };
let R = null;          // the current run (also used for practice and wizard lessons)
let hot = [], press = null, gamePtr = null, mouse = null;
const hand0 = new Hand(.3);
const addHot = (r, fn, o = {}) => hot.push({ r, fn, ...o });

function sfx(n) { snd.sfx(n); }

// ---------------------------------------------------------------- runs
const PHASE = { inter: 1.35, slam: .8, win: .6, lose: 1 };

function newRun(kind, o = {}) {
  R = { kind, round: 0, lives: kind === 'practice' ? 3 : 4, phase: 'inter', pt: 0, g: null, prev: null, notice: null,
    speed: 1, d: 0, bag: [], recent: [], pool: o.pool, streak: 0, lesson: o.lesson, paused: false, lost: -1 };
  S.mode = 'run'; S.start = false; S.folder = false; S.dialog = null;
  hand0.wait = .45; hand0.job = null;
  snd.setTempo(1);
  if (kind === 'tutorial') { R.round = 0; startGame(); }
  else { planNext(); snd.loop(true); }
}

function planNext() {
  const r = R.round + 1;
  if (R.kind === 'practice') { R.speed = Math.min(2.2, 1 + .12 * R.streak); R.d = Math.floor(R.streak / 3); R.boss = false; R.notice = null; return; }
  const cyc = Math.floor((r - 1) / 15), pos = (r - 1) % 15;
  const sp = Math.min(2, 1 + .15 * Math.floor(pos / 5) + .12 * cyc);
  R.notice = r > 1 && pos === 14 ? 'boss' : r > 1 && pos === 0 ? 'level' : r > 1 && pos % 5 === 0 ? 'speed' : null;
  R.speed = sp; R.d = cyc; R.boss = pos === 14;
}

function pickDef() {
  if (R.pool) return byId(R.pool[0]);
  if (R.boss) return BOSSES[Math.floor((R.round - 1) / 15) % BOSSES.length];
  if (!R.bag.length) {
    const ids = GAMES.map(g => g.id).filter(id => !R.recent.includes(id));
    const fresh = ids.filter(id => !seen(id)), old = ids.filter(id => seen(id));
    const sh = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    R.bag = [...sh(old), ...sh(fresh)]; // popped from the end, so new ones come first
  }
  const id = R.bag.pop();
  R.recent.push(id); if (R.recent.length > 4) R.recent.shift();
  return byId(id);
}

function startGame() {
  R.round++;
  let def, o;
  if (R.kind === 'tutorial') { const L = R.lesson; def = byId(L.game); o = { d: 0, speed: L.speed || 1, noTimer: !!L.noTimer }; }
  else { def = pickDef(); o = { d: R.d, speed: R.speed }; }
  R.def = def;
  R.g = makeGame(def, { ...o, seed: (Math.random() * 1e9) | 0, sfx, squeal: snd.squeal });
  if (!seen(def.id) && R.kind !== 'tutorial') { save.seen.push(def.id); store(); }
  R.phase = 'slam'; R.pt = 0; R.tickN = 0;
  snd.setTempo(R.g.speed);
  sfx(def.boss ? 'boss' : 'ding');
  hand0.wait = .45; hand0.job = null;
}

function endGame() {
  const g = R.g, won = g.result === 'win';
  R.prev = g.result; R.lost = -1;
  if (R.kind === 'tutorial') return;
  if (won) { R.streak++; if (g.def.boss && R.lives < 4) { R.lives++; R.prev = 'bonus'; } }
  else { R.lives--; R.lost = R.lives; }
}

function runTick(dt) {
  if (!R || R.paused) return;
  R.pt += dt;
  const sp = R.kind === 'tutorial' ? 1 : Math.min(R.speed, 1.7);
  if (R.phase === 'inter') {
    if (R.pt > PHASE.inter / sp) startGame();
  } else if (R.phase === 'slam') {
    if (R.pt > PHASE.slam / sp) { R.phase = 'play'; R.pt = 0; }
  } else if (R.phase === 'play' || R.phase === 'result') {
    const g = R.g;
    if (R.phase === 'play' && AUTO) hand0.update(g, dt);
    step(g, dt);
    if (R.phase === 'play') {
      const f = g.t / g.dur;
      if (!g.noTimer && f > .7 && !g.result) { const n = Math.floor(f * 12); if (n > R.tickN) { R.tickN = n; sfx('tick'); } }
      if (g.result) {
        R.phase = 'result'; R.pt = 0; gamePtr = null;
        sfx(g.result === 'win' ? 'win' : 'lose');
        endGame();
      }
    } else if (R.pt > (g.result === 'win' ? PHASE.win : PHASE.lose)) afterResult();
  }
}

function afterResult() {
  if (R.kind === 'tutorial') { const ok = R.g.result === 'win'; R = null; S.mode = 'wizard'; S.wiz.result = ok ? 'win' : 'lose'; return; }
  if (R.lives <= 0) {
    snd.loop(false);
    if (R.kind === 'practice') {
      const n = R.streak, id = R.pool[0];
      S.mode = 'menu'; S.folder = true; R = null;
      sfx('over');
      dialog(byId(id).name, `Practice over. You cleared it ${n} time${n === 1 ? '' : 's'} in a row, up to ${(1 + .12 * Math.max(0, n - 1)).toFixed(1)}× speed.`, 'info',
        [{ label: 'Again', def: true, fn: () => newRun('practice', { pool: [id] }) }, { label: 'Close', fn: () => {} }]);
      return;
    }
    const done = R.round - 1;
    S.newBest = done > save.best; if (S.newBest) save.best = done; store();
    S.over = { done, round: R.round, def: R.def };
    S.mode = 'over'; S.overT = 0; R = null; sfx('bsod');
    return;
  }
  planNext();
  if (R.notice === 'speed' || R.notice === 'level') sfx('speed');
  R.phase = 'inter'; R.pt = 0;
}

function pause(on) {
  if (!R) return;
  R.paused = on;
  snd.loop(on ? false : R.kind !== 'tutorial');
  if (on) dialog('Pop-Up (Not Responding)', 'Pop-Up is not responding. If you end the task, this run is over.', 'warn',
    [{ label: 'Wait', def: true, fn: () => pause(false) }, { label: 'End Task', fn: quitRun }]);
  else S.dialog = null;
}
function quitRun() { snd.loop(false); const k = R?.kind; R = null; S.dialog = null; S.mode = k === 'tutorial' ? 'wizard' : 'menu'; if (k === 'tutorial') S.wiz.result = null; if (k === 'practice') S.folder = true; }

function dialog(title, text, ic, buttons) { S.dialog = { title, text, icon: ic, buttons }; S.start = false; }

// ---------------------------------------------------------------- the Setup Wizard
const WIZ = [
  { title: 'Welcome to Pop-Up Setup', text: 'This wizard will teach you everything you need to know about your computer. It takes about a minute.\n\nEvery task is one word, like CLOSE IT! or PUNCH! Do what it says, fast.', next: 'Next >' },
  { title: 'Lesson 1: CLOSE IT!', text: 'Pop-ups lie. Only the red X up in the blue title bar really closes one. The other X\'s just make more pop-ups.\n\nNo clock this time, so take a good look.', next: 'Try it >', game: 'close', noTimer: true,
    ok: 'That one was real. You will see a lot of these.', fail: 'That X was painted on the ad, so it opened more pop-ups. Look for the red X in the blue title bar.' },
  { title: 'Lesson 2: the clock', text: 'Now with the clock. The green bar at the top fills up as your time runs out. Finish before it is full.\n\nPUNCH! means tap the monkey.', next: 'Try it >', game: 'punch', speed: .75,
    ok: 'Pow. You beat the clock.', fail: 'The bar filled up first. Tap right on the monkey; misses are free.' },
  { title: 'Lesson 3: dragging', text: 'Some tasks want a drag: press, slide, let go.\n\nBIN IT! means drag the little helper into the Recycle Bin.', next: 'Try it >', game: 'binit', speed: .75,
    ok: 'Gone. It will be back.', fail: 'Press on the helper, keep holding, and let go over the Recycle Bin.' },
  { title: 'Lesson 4: patience', text: 'Some tasks want you to do nothing at all. Always read the word before you tap!', next: 'Try it >', game: 'wait', speed: .9,
    ok: 'Perfect. You touched nothing.', fail: "You touched it! DON'T TOUCH! means hands off until the bar is full." },
  { title: 'Setup is complete', text: 'You have 4 floppy disks, down in the corner. Each failed task costs one. Lose them all and it is game over.\n\nEvery 5 tasks your computer gets faster. Every 15th task is a big one, and winning it gives a disk back.', next: 'Finish' },
];
function openWizard() { S.mode = 'wizard'; S.wiz = { page: 0, result: null }; S.start = false; S.folder = false; S.dialog = null; }
function wizNext() {
  const P = WIZ[S.wiz.page];
  if (P.game && S.wiz.result !== 'win') { newRun('tutorial', { lesson: P }); return; }
  if (S.wiz.page === WIZ.length - 1) { save.tut = true; store(); newRun('run'); return; }
  S.wiz.page++; S.wiz.result = null; sfx('click');
}
function wizBack() { if (S.wiz.page > 0) { S.wiz.page--; S.wiz.result = null; sfx('click'); } }
function wizCancel() { save.tut = true; store(); S.mode = 'menu'; S.wiz = null; }

function play() { if (!save.tut) openWizard(); else newRun('run'); }

// ---------------------------------------------------------------- drawing: shared chrome
function drawTaskbar() {
  const y = taskY, h = 44;
  let g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#3f8cf3'); g.addColorStop(.1, '#2a6ae6'); g.addColorStop(.5, '#245edb'); g.addColorStop(1, '#1941a5');
  c.fillStyle = g; c.fillRect(0, y, W, TASK);
  const go = { x: 0, y, w: 104 + sa.l, h };
  drawGo(c, { ...go, x: go.x + sa.l * 0, w: 104 }, S.start);
  addHot(go, () => { if (R && S.mode === 'run') { pause(true); return; } S.start = !S.start; sfx('click'); });
  // tray
  const inRun = R && S.mode === 'run' && R.kind !== 'tutorial';
  const showClock = W > 430 || !inRun;
  const trayW = 40 + (inRun ? 4 * 24 + 8 : 0) + (showClock ? 74 : 8);
  const tx = W - trayW - sa.r;
  g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#1aa0f5'); g.addColorStop(.5, '#0f87ea'); g.addColorStop(1, '#0b6ad0');
  rr(c, tx, y + 1, trayW + sa.r + 2, h - 1, [0, 0, 0, 0]); c.fillStyle = g; c.fill();
  c.fillStyle = '#0a4fb0'; c.fillRect(tx, y + 1, 1.5, h - 1);
  const sp = { x: tx + 6, y: y + 6, w: 32, h: 32 };
  icon(c, 'speaker', cx(sp), cy(sp), 24, { off: snd.isMuted() });
  addHot(sp, () => { snd.setMuted(!snd.isMuted()); });
  let x = tx + 42;
  if (inRun) {
    for (let i = 0; i < (R.kind === 'practice' ? 3 : 4); i++) {
      const lost = i >= R.lives;
      c.save(); if (lost) c.globalAlpha = .35;
      icon(c, 'floppy', x + 11 + i * 24, y + h / 2, 20);
      c.restore();
      if (lost) { c.strokeStyle = '#e2412b'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x + 4 + i * 24, y + 15); c.lineTo(x + 18 + i * 24, y + 29); c.moveTo(x + 18 + i * 24, y + 15); c.lineTo(x + 4 + i * 24, y + 29); c.stroke(); }
    }
    x += 4 * 24 + 8;
  }
  if (showClock) {
    const d = new Date(); let hr = d.getHours() % 12 || 12;
    font(c, 14); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(`${hr}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`, x + 32, y + h / 2 + 1);
  }
  // one task button for whatever is open
  const bx = 112, bw = Math.min(200, tx - bx - 8);
  if (bw > 80) {
    const b = { x: bx, y: y + 6, w: bw, h: 32 };
    g = c.createLinearGradient(0, b.y, 0, b.y + b.h); g.addColorStop(0, '#1e52c4'); g.addColorStop(1, '#2c6ce0');
    rr(c, b.x, b.y, b.w, b.h, 4); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.stroke();
    const label = S.mode === 'run' && R ? (R.kind === 'tutorial' ? 'Setup - Practice' : R.kind === 'practice' ? `Practice: ${R.def?.word || ''}` : (R.phase === 'inter' ? `Task ${R.round + 1}` : `Task ${R.round} - ${R.def.word}`)) : S.mode === 'wizard' ? 'Pop-Up Setup' : 'Pop-Up';
    icon(c, S.mode === 'wizard' ? 'setup' : 'popup', b.x + 18, cy(b), 20);
    font(c, 13, 'bold'); c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(fitText(c, label, b.w - 40), b.x + 34, cy(b) + 1);
  }
}

function drawStartMenu() {
  if (!S.start) return;
  addHot({ x: 0, y: 0, w: W, h: taskY }, () => { S.start = false; });
  const items = [
    ['game', 'Play Pop-Up', () => play()],
    ['folder', 'Practice', () => { S.folder = true; }],
    ['setup', 'Setup Wizard', () => openWizard()],
    ['speaker', snd.isMuted() ? 'Sound: Off' : 'Sound: On', () => snd.setMuted(!snd.isMuted())],
  ];
  const w = Math.min(290, W - 16), ih = 46, h = 60 + items.length * ih + 60, x = 0, y = taskY - h;
  c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 12; rr(c, x, y, w, h, [9, 9, 0, 0]); c.fillStyle = '#fff'; c.fill(); c.restore();
  const g = c.createLinearGradient(0, y, 0, y + 56); g.addColorStop(0, '#2f7bff'); g.addColorStop(1, '#1650d0');
  rr(c, x, y, w, 56, [9, 9, 0, 0]); c.fillStyle = g; c.fill();
  icon(c, 'popup', x + 32, y + 28, 36);
  font(c, 18, 'bold'); c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('Pop-Up', x + 60, y + 29);
  addHot({ x, y, w, h }, () => {});
  items.forEach(([ic, label, fn], i) => {
    const r = { x, y: y + 62 + i * ih, w, h: ih };
    if (mouse && inR(mouse.x, mouse.y, r)) { c.fillStyle = C.sel; c.fillRect(r.x, r.y, r.w, r.h); }
    icon(c, ic, x + 30, cy(r), 30);
    font(c, 16); c.fillStyle = mouse && inR(mouse.x, mouse.y, r) ? '#fff' : C.ink; c.fillText(label, x + 56, cy(r) + 1);
    addHot(r, () => { S.start = false; fn(); sfx('click'); });
  });
  const fy = y + h - 54;
  c.fillStyle = '#d6dff7'; c.fillRect(x, fy, w, 54);
  const off = { x: x + w - 150, y: fy + 9, w: 138, h: 36 };
  button(c, off, 'Turn Off', { bold: true, fill: '#ffd0c4' });
  addHot(off, () => { S.start = false; S.mode = 'off'; S.overT = 0; sfx('over'); });
}

function drawDialog() {
  const d = S.dialog; if (!d) return;
  hot.length = 0;
  addHot({ x: 0, y: 0, w: W, h: H }, () => {});
  c.fillStyle = 'rgba(0,0,30,.25)'; c.fillRect(0, 0, W, H);
  const w = Math.min(430, W - 16);
  font(c, 15); const lines = wrap(c, d.text, w - 96);
  const h = 34 + 24 + lines.length * 21 + 72;
  const L = winLayout((W - w) / 2, Math.max(sa.t + 8, (taskY - h) / 2), w, h, 34, 'x');
  drawWin(c, L, d.title, {});
  const b = L.body;
  icon(c, d.icon || 'info', b.x + 36, b.y + 40, 42);
  font(c, 15); c.fillStyle = C.ink; c.textAlign = 'left'; c.textBaseline = 'top';
  lines.forEach((l, i) => c.fillText(l, b.x + 72, b.y + 22 + i * 21));
  const bw = 104; let x = b.x + b.w - 12 - d.buttons.length * (bw + 8) + 8;
  d.buttons.forEach(bt => {
    const r = { x, y: b.y + b.h - 50, w: bw, h: 38 };
    button(c, r, bt.label, { def: bt.def, bold: bt.def, hot: mouse && inR(mouse.x, mouse.y, r) });
    addHot(r, () => { S.dialog = null; sfx('click'); bt.fn(); }, { def: bt.def });
    x += bw + 8;
  });
  const last = d.buttons.find(b => !b.def) || d.buttons[0];
  addHot(L.close, () => { S.dialog = null; last.fn(); });
}

// ---------------------------------------------------------------- the desktop
function deskIcons() {
  const list = [
    ['popup', 'Pop-Up.exe', play],
    ['folder', 'Practice', () => { S.folder = true; }],
    ['setup', 'Setup.exe', openWizard],
    ['bin', 'Recycle Bin', () => dialog('Recycle Bin', 'The Recycle Bin is empty. Everything you bin in Pop-Up comes straight back next time.', 'info', [{ label: 'OK', def: true, fn: () => {} }])],
  ];
  const col = deskCol(), step = Math.min(96, (taskY - sa.t - 84) / 4);
  return list.map(([ic, label, fn], i) => {
    const x = col ? 52 + sa.l : 96 + sa.l + i * 78, y = col ? sa.t + 84 + i * step : sa.t + 30;
    return { ic, label, fn, x, y, sz: col && step < 80 ? 38 : 48, r: { x: x - 36, y: y - 28, w: 72, h: Math.min(80, step) } };
  });
}
const deskCol = () => W >= 700 || (W > H && W >= 520);
function drawDesk() {
  for (const d of deskIcons()) {
    const h = mouse && inR(mouse.x, mouse.y, d.r);
    icon(c, d.ic, d.x, d.y, d.sz);
    deskLabel(c, d.label, d.x, d.y + d.sz * .55 + 4, 13, h);
    addHot(d.r, () => { sfx('click'); d.fn(); });
  }
}

function drawTitle() {
  const col = deskCol();
  const left = col ? Math.max((W - 470) / 2, 104 + sa.l) : (W - Math.min(470, W - 16)) / 2;
  const w = Math.min(470, W - left - 8 - sa.r);
  const topMin = col ? sa.t + 8 : sa.t + 108;
  const h = Math.min(342, taskY - topMin - 8);
  const y = Math.max(topMin, Math.min((taskY - h) / 2, taskY - h - 8));
  const L = winLayout(left, y, w, h, 34, 'mmx');
  drawWin(c, L, 'Pop-Up', { icon: 'popup' });
  const b = L.body;
  // a little wallpaper inside the window, for the logo to sit on
  const tag = b.h >= 250, band = Math.max(56, Math.min(130, b.h - (tag ? 178 : 110)));
  const g = c.createLinearGradient(0, b.y, 0, b.y + band); g.addColorStop(0, '#2a62c9'); g.addColorStop(1, '#a9d4f5');
  c.fillStyle = g; c.fillRect(b.x, b.y, b.w, band);
  c.fillStyle = '#4fae2f'; c.beginPath(); c.moveTo(b.x, b.y + band * .9); c.quadraticCurveTo(b.x + b.w * .5, b.y + band * .6, b.x + b.w, b.y + band * .85); c.lineTo(b.x + b.w, b.y + band); c.lineTo(b.x, b.y + band); c.fill();
  const size = Math.min(84, b.w / 4.2, band * .66);
  wordart(c, 'POP-UP!', cx(b), b.y + band * .5 + size * .32, size, 'rainbow', { phase: S.t * 2, wave: .1 });
  let ty = b.y + band + 12;
  if (tag) ty += para(c, 'Tiny tasks on an old computer. Each one is a single word. Do it before the green bar fills.', b.x + 16, ty, b.w - 32, 15, 1.35) + 8;
  font(c, 14); c.fillStyle = C.grey; c.textAlign = 'left'; c.textBaseline = 'top';
  c.fillText(fitText(c, `Best run: ${save.best} task${save.best === 1 ? '' : 's'}   ·   Found: ${save.seen.length} of ${GAMES.length + BOSSES.length}`, b.w - 32), b.x + 16, ty);
  const bw = (b.w - 32 - 16) / 3, by = b.y + b.h - 62;
  const bts = [['Play', play, true], ['Practice', () => { S.folder = true; }], ['How to Play', openWizard]];
  bts.forEach(([label, fn, def], i) => {
    const r = { x: b.x + 16 + i * (bw + 8), y: by, w: bw, h: 46 };
    button(c, r, label, { def, bold: def, size: 16, hot: mouse && inR(mouse.x, mouse.y, r) });
    addHot(r, () => { sfx('click'); fn(); }, { def });
  });
}

function drawFolder() {
  if (!S.folder) return;
  const all = [...GAMES, ...BOSSES];
  const w = Math.min(600, W - 16), hMax = taskY - sa.t - 16;
  const bodyW = w - 8 - 16;
  let cell = 92, cols, rows;
  for (; cell > 54; cell -= 2) { cols = Math.floor(bodyW / cell); rows = Math.ceil(all.length / cols); if (rows * cell + 34 + 40 + 12 <= hMax) break; }
  cols = Math.floor(bodyW / cell); rows = Math.ceil(all.length / cols);
  const h = Math.min(hMax, rows * cell + 34 + 40 + 12);
  const L = winLayout((W - w) / 2, Math.max(sa.t + 8, (taskY - h) / 2), w, h, 34, 'x');
  addHot({ x: 0, y: 0, w: W, h: taskY }, () => {});
  drawWin(c, L, 'C:\\Program Files\\Pop-Up', { icon: 'folder' });
  const b = L.body;
  c.fillStyle = '#fff'; c.fillRect(b.x, b.y + 36, b.w, b.h - 36);
  font(c, 14); c.fillStyle = C.ink; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText(fitText(c, `Tap a task to practise it. Found ${save.seen.length} of ${all.length}${save.seen.length < all.length ? '; play to find the rest' : ''}.`, b.w - 20), b.x + 10, b.y + 18);
  const ox = b.x + (b.w - cols * cell) / 2;
  all.forEach((d, i) => {
    const x = ox + (i % cols) * cell + cell / 2, y = b.y + 36 + 8 + Math.floor(i / cols) * cell + cell * .36;
    const r = { x: x - cell / 2 + 2, y: y - cell * .36, w: cell - 4, h: cell - 4 };
    const ok = seen(d.id) || DEBUG;
    const hv = ok && mouse && inR(mouse.x, mouse.y, r);
    if (hv) { c.fillStyle = '#e8eefc'; c.fillRect(r.x, r.y, r.w, r.h); }
    c.save(); if (!ok) c.globalAlpha = .3; icon(c, ok ? d.icon : 'doc', x, y, cell * .46); c.restore();
    font(c, Math.max(11, cell * .14)); c.fillStyle = ok ? C.ink : C.grey; c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillText(fitText(c, ok ? d.name : '???.exe', cell - 6), x, y + cell * .28);
    if (ok) addHot(r, () => { sfx('click'); newRun('practice', { pool: [d.id] }); });
  });
  addHot(L.close, () => { S.folder = false; sfx('close'); });
}

function drawWizard() {
  const P = WIZ[S.wiz.page];
  const w = Math.min(580, W - 16), h = Math.min(400, taskY - sa.t - 16);
  const L = winLayout((W - w) / 2, Math.max(sa.t + 8, (taskY - h) / 2), w, h, 34, 'x');
  drawWin(c, L, 'Pop-Up Setup Wizard', { icon: 'setup' });
  const b = L.body, side = w >= 470;
  const banner = side ? { x: b.x, y: b.y, w: 150, h: b.h - 62 } : { x: b.x, y: b.y, w: b.w, h: 60 };
  let g = c.createLinearGradient(banner.x, banner.y, banner.x, banner.y + banner.h);
  g.addColorStop(0, '#1d4fc4'); g.addColorStop(.6, '#4f93ef'); g.addColorStop(1, '#a9d4f5');
  c.fillStyle = g; c.fillRect(banner.x, banner.y, banner.w, banner.h);
  c.fillStyle = '#4fae2f'; c.beginPath(); c.moveTo(banner.x, banner.y + banner.h * .82); c.quadraticCurveTo(banner.x + banner.w * .6, banner.y + banner.h * .68, banner.x + banner.w, banner.y + banner.h * .78); c.lineTo(banner.x + banner.w, banner.y + banner.h); c.lineTo(banner.x, banner.y + banner.h); c.fill();
  icon(c, 'setup', side ? cx(banner) : banner.x + 40, side ? banner.y + 70 : cy(banner), side ? 74 : 44);
  if (!side) { font(c, 13, 'bold'); c.fillStyle = '#fff'; c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText(`Step ${S.wiz.page + 1} of ${WIZ.length}`, banner.x + banner.w - 12, cy(banner)); }
  else { font(c, 13, 'bold'); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(`Step ${S.wiz.page + 1} of ${WIZ.length}`, cx(banner), banner.y + 120); }
  const tx = side ? banner.x + banner.w + 18 : b.x + 16, ty = side ? b.y + 18 : banner.y + banner.h + 14, tw = b.x + b.w - 16 - tx;
  const res = S.wiz.result;
  let hh = para(c, res === 'win' ? 'Task completed successfully.' : res === 'lose' ? 'Task failed.' : P.title, tx, ty, tw, 19, 1.25, res === 'lose' ? '#b01a0a' : res === 'win' ? '#1f7a1a' : C.ink, 'bold');
  const txt = res === 'win' ? P.ok : res === 'lose' ? P.fail : P.text;
  const fs = h < 340 ? 14 : 15;
  para(c, txt, tx, ty + hh + 10, tw, fs, 1.38);
  if (res) icon(c, res === 'win' ? 'ok' : 'err', tx + tw - 22, ty + 10, 30);
  c.fillStyle = C.line; c.fillRect(b.x, b.y + b.h - 62, b.w, 1);
  const label = P.game ? (res === 'win' ? 'Next >' : res === 'lose' ? 'Try again' : P.next) : P.next;
  const bw = Math.min(110, (b.w - 40) / 3), by = b.y + b.h - 50;
  const rs = [{ x: b.x + b.w - 3 * (bw + 8) - 4, label: '< Back', fn: wizBack, dis: S.wiz.page === 0 }, { x: b.x + b.w - 2 * (bw + 8) - 4, label, fn: wizNext, def: true }, { x: b.x + b.w - (bw + 8) - 4, label: 'Cancel', fn: wizCancel }];
  rs.forEach(o => {
    const r = { x: o.x, y: by, w: bw, h: 40 };
    button(c, r, o.label, { def: o.def, bold: o.def, dis: o.dis, hot: mouse && inR(mouse.x, mouse.y, r) });
    if (!o.dis) addHot(r, () => { o.fn(); }, { def: o.def });
    if (o.def) { const pulse = (Math.sin(S.t * 5) + 1) / 2; rr(c, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 6); c.strokeStyle = `rgba(248,182,54,${.3 + pulse * .6})`; c.lineWidth = 2.5; c.stroke(); }
  });
  addHot(L.close, wizCancel);
}

// ---------------------------------------------------------------- drawing: the run
function toArea() { c.save(); c.translate(area.x, area.y); c.scale(area.k, area.k); }

function drawRun() {
  const g = R.g;
  if (R.phase === 'inter') { drawInter(); return; }
  toArea();
  c.save(); c.beginPath(); c.rect(-2, -2, 484, 484); c.clip();
  g.def.draw.call(g.def, g, c);
  for (const p of g.parts) { c.globalAlpha = 1 - p.age / p.life; c.fillStyle = p.col; c.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); }
  c.globalAlpha = 1;
  if (R.kind === 'tutorial' && R.phase === 'play' && g.def.hint && g.t > (R.lesson.noTimer ? 1.6 : .9) && !g.result) {
    const h = g.def.hint.call(g.def, g);
    if (h.at) arrowHint(c, h.at[0], h.at[1], S.t, 1.1);
    if (h.from) { const f = (S.t % 1.6) / 1.2, e = f < .15 ? 0 : Math.min(1, (f - .15) / .7); c.globalAlpha = .85; hand(c, h.from[0] + (h.to[0] - h.from[0]) * e, h.from[1] + (h.to[1] - h.from[1]) * e, f > .1 && f < .9, 1.4); c.globalAlpha = 1; }
  }
  if (AUTO && hand0) { c.globalAlpha = .9; hand(c, hand0.x, hand0.y, hand0.down, 1.1); c.globalAlpha = 1; }
  c.restore();
  if (R.phase === 'slam' || (R.phase === 'play' && R.pt < .3)) drawSlam(g);
  if (R.phase === 'result') {
    const a = Math.min(1, R.pt / .15), won = g.result === 'win';
    c.save(); c.translate(240, 240); c.scale(.5 + .5 * a + (won ? .1 * Math.sin(R.pt * 12) * (1 - a) : 0), .5 + .5 * a); c.globalAlpha = a;
    icon(c, won ? 'ok' : 'err', 0, 0, 150);
    c.restore();
  }
  c.restore();
}

function drawSlam(g) {
  const word = g.def.word;
  const sp = R.kind === 'tutorial' ? 1 : Math.min(R.speed, 1.7);
  const t = R.phase === 'slam' ? R.pt * sp : PHASE.slam + R.pt;
  if (R.phase === 'slam') { c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = 'rgba(0,0,40,.3)'; c.fillRect(0, 0, W, H); c.restore(); }
  const fade = R.phase === 'play' ? 1 - R.pt / .3 : 1;
  font(c, 100, '', 'Anton, Impact, sans-serif');
  const meas = c.measureText(word).width * 1.05 + 30;
  const size = Math.min(118, 100 * 450 / meas);
  const k = 1 + 1.6 * Math.pow(1 - Math.min(1, t / .22), 3);
  c.save(); c.globalAlpha = fade; c.translate(240, 250); c.scale(k, k); c.rotate(-.06 + Math.sin(t * 9) * .015 * (t < .5 ? 1 : 0));
  wordart(c, word, 0, size * .35, size, g.def.art, { phase: t * 3, wave: .09 });
  c.restore();
}

function drawInter() {
  toArea();
  const L = winLayout(40, 70, 400, 330, 34, '');
  drawWin(c, L, R.kind === 'practice' ? 'Practice' : 'Pop-Up', { icon: 'popup' });
  const b = L.body;
  const sp = Math.min(R.speed, 1.7), f = R.pt * sp / PHASE.inter;
  font(c, 46, 'bold'); c.fillStyle = C.ink; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(R.kind === 'practice' ? `Round ${R.round + 1}` : `Task ${R.round + 1}`, 240, b.y + 52);
  // disks
  const n = R.kind === 'practice' ? 3 : 4;
  for (let i = 0; i < n; i++) {
    const x = 240 + (i - (n - 1) / 2) * 76, y = b.y + 132;
    const lost = i >= R.lives, fresh = i === R.lost;
    c.save();
    if (fresh) { const a = Math.min(1, f * 3); c.translate(x, y); c.rotate(a * .5); c.translate(-x, -y); c.globalAlpha = 1 - a * .65; }
    else if (lost) c.globalAlpha = .3;
    icon(c, 'floppy', x, y + (fresh ? f * 40 : 0), 62, R.prev === 'bonus' && i === R.lives - 1 ? { col1: '#4be36a', col2: '#1f8a2a' } : {});
    c.restore();
    if (lost && !fresh) { c.strokeStyle = '#e2412b'; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 18, y - 18); c.lineTo(x + 18, y + 18); c.moveTo(x + 18, y - 18); c.lineTo(x - 18, y + 18); c.stroke(); }
  }
  const msg = R.prev === 'win' ? ['ok', 'Task completed successfully.'] : R.prev === 'bonus' ? ['ok', 'Big task done! You got a disk back.'] : R.prev === 'lose' ? ['err', R.kind === 'practice' ? 'Task failed.' : 'Task failed. One disk lost.'] : ['info', 'Get ready...'];
  icon(c, msg[0], b.x + 36, b.y + 204, 30);
  font(c, 17, 'bold'); c.fillStyle = C.ink; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(msg[1], b.x + 60, b.y + 205);
  progress(c, b.x + 20, b.y + b.h - 46, b.w - 40, 22, f);
  c.restore();
  // a balloon from the tray for speed and boss warnings
  if (R.notice) {
    const txt = R.notice === 'boss' ? ['Warning', 'A big task is coming. Win it to get a disk back.'] : R.notice === 'level' ? ['Harder tasks', 'Your computer is back to normal speed, but the tasks are trickier now.'] : ['Speed up!', 'Your computer is now running faster.'];
    balloon(txt[0], txt[1], R.notice === 'boss' ? 'warn' : 'info');
  }
}

function balloon(title, text, ic) {
  const w = Math.min(300, W - 16);
  font(c, 14); const lines = wrap(c, text, w - 24);
  const h = 44 + lines.length * 19 + 10;
  const x = W - w - 8 - sa.r, y = taskY - h - 18;
  c.save(); c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 8;
  rr(c, x, y, w, h, 10); c.fillStyle = '#ffffe1'; c.fill(); c.restore();
  c.strokeStyle = '#111'; c.lineWidth = 1; rr(c, x, y, w, h, 10); c.stroke();
  c.beginPath(); c.moveTo(x + w - 70, y + h); c.lineTo(x + w - 54, y + h + 14); c.lineTo(x + w - 46, y + h); c.fillStyle = '#ffffe1'; c.fill(); c.stroke();
  icon(c, ic, x + 22, y + 22, 22);
  font(c, 14, 'bold'); c.fillStyle = C.ink; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(title, x + 40, y + 23);
  font(c, 14); c.textBaseline = 'top'; lines.forEach((l, i) => c.fillText(l, x + 12, y + 40 + i * 19));
}

function drawTimer() {
  if (!R || S.mode !== 'run' || (R.phase !== 'play' && R.phase !== 'slam' && R.phase !== 'result')) return;
  const g = R.g;
  let x, y, w, h, bx, by, bw;
  font(c, 15, 'bold');
  if (area.side) {
    w = Math.min(260, area.x - 16 - sa.l); x = area.x - w - 8; y = sa.t + 64; h = 70;
    bx = x + 10; by = y + 34; bw = w - 20;
  } else {
    const x0 = 64 + sa.l; w = Math.min(560, W - x0 - 8 - sa.r); x = Math.max(x0, (W - w) / 2); y = sa.t + 8; h = 40;
    const lw = Math.min(w * .42, c.measureText(g.def.word).width + 8);
    bx = x + lw + 18; by = y + 9; bw = w - lw - 28;
  }
  rr(c, x, y, w, h, 6); c.fillStyle = C.body; c.fill(); c.strokeStyle = '#0446cf'; c.lineWidth = 2; c.stroke();
  c.fillStyle = C.ink; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText(fitText(c, g.def.word, area.side ? w - 20 : bx - x - 18), x + 10, area.side ? y + 18 : y + h / 2 + 1);
  if (g.noTimer) { font(c, 14); c.fillStyle = C.grey; c.fillText(fitText(c, 'Practice: no time limit', bw), bx, by + 11); return; }
  const f = R.phase === 'slam' ? 0 : g.result ? g.resT / g.dur : g.t / g.dur;
  const late = f > .7 && !g.result;
  const shake = late ? Math.sin(S.t * 60) * 1.5 : 0;
  progress(c, bx + shake, by, bw, 22, f, late ? { color: ['#ffd0b0', '#ff6a1a', '#c8300a'] } : undefined);
}

function drawOver() {
  c.fillStyle = '#0000aa'; c.fillRect(0, 0, W, H);
  const o = S.over, size = W < 520 ? 14 : 18;
  const w = Math.min(680, W - 32), x = (W - w) / 2;
  font(c, size, '', MONO);
  const lines = [
    `A fatal exception 0E has occurred at task ${String(o.round).padStart(4, '0')}.`,
    'All four floppy disks are gone.', '',
    `Tasks completed: ${o.done}`,
    S.newBest ? `Best run: ${save.best}   (a new best!)` : `Best run: ${save.best}`,
    `Last task: ${o.def.word}`, '',
    '*  Tap anywhere to restart your computer.',
    '*  Press any key to continue _',
  ];
  const out = [];
  lines.forEach(l => (l ? wrap(c, l, w) : ['']).forEach(s => out.push(s)));
  const lh = size * 1.5, total = out.length * lh + 60;
  let y = Math.max(sa.t + 70, (H - total) / 2);
  const hd = ' Pop-Up ';
  const hw = c.measureText(hd).width;
  c.fillStyle = '#aaaaaa'; c.fillRect(W / 2 - hw / 2, y, hw, size * 1.3);
  c.fillStyle = '#0000aa'; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(hd, W / 2, y + size * .12);
  y += 60;
  c.fillStyle = '#fff'; c.textAlign = 'left';
  out.forEach((l, i) => { if (i === out.length - 1 && Math.floor(S.t * 2) % 2) l = l.replace('_', ' '); c.fillText(l, x, y + i * lh); });
  if (S.overT > .7) addHot({ x: 0, y: 0, w: W, h: H }, toMenu);
}
function toMenu() { S.mode = 'menu'; S.dialog = null; sfx('startup'); }

function drawOff() {
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  font(c, Math.min(26, W / 18), 'bold'); c.fillStyle = '#ff9a2a'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText("It's now safe to turn off", W / 2, H / 2 - 18); c.fillText('your computer.', W / 2, H / 2 + 18);
  font(c, 14); c.fillStyle = '#666'; c.fillText('(or tap to turn it back on)', W / 2, H / 2 + 70);
  if (S.overT > .5) addHot({ x: 0, y: 0, w: W, h: H }, toMenu);
}

// ---------------------------------------------------------------- frame
function draw() {
  hot = [];
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (S.mode === 'over') { drawOver(); return; }
  if (S.mode === 'off') { drawOff(); return; }
  c.drawImage(wall, 0, 0, W, H);
  if (S.mode === 'menu') { drawDesk(); drawTitle(); drawFolder(); }
  else if (S.mode === 'wizard') { drawDesk(); drawWizard(); }
  else if (S.mode === 'run' && R) drawRun();
  drawTimer();
  drawTaskbar();
  drawStartMenu();
  drawDialog();
  cv.style.cursor = mouse && hot.some(h => h.r.w < W && inR(mouse.x, mouse.y, h.r)) ? 'pointer' : 'default';
}

let last = 0;
function frame(ts) {
  const dt = Math.min(.05, Math.max(0, (ts - last) / 1000)); last = ts;
  if (!S.hold) tick(dt);
  draw();
  requestAnimationFrame(frame);
}
function tick(dt) {
  S.t += dt; S.overT += dt;
  if (S.mode === 'run') runTick(dt);
  if (AUTO) autoTick(dt);
}

// ---------------------------------------------------------------- input
function pos(e) { return { x: e.clientX, y: e.clientY }; }
cv.addEventListener('pointerdown', e => {
  snd.unlock();
  if (!S.booted) { S.booted = true; if (S.mode === 'menu') sfx('startup'); }
  const p = pos(e); mouse = p;
  // UI first (topmost last)
  for (let i = hot.length - 1; i >= 0; i--) if (inR(p.x, p.y, hot[i].r)) { press = { h: hot[i], id: e.pointerId }; if (hot[i].now) { hot[i].fn(); press = null; } return; }
  if (S.mode === 'run' && R && R.phase === 'play' && !R.paused && gamePtr == null && !AUTO) {
    gamePtr = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch {}
    const g = R.g;
    input(g, 'down', (p.x - area.x) / area.k, (p.y - area.y) / area.k);
  }
});
cv.addEventListener('pointermove', e => {
  const p = pos(e); mouse = e.pointerType === 'mouse' ? p : mouse;
  if (gamePtr === e.pointerId && R && R.g) input(R.g, 'move', (p.x - area.x) / area.k, (p.y - area.y) / area.k);
});
function up(e) {
  const p = pos(e);
  if (gamePtr === e.pointerId) { gamePtr = null; if (R && R.g) input(R.g, 'up', (p.x - area.x) / area.k, (p.y - area.y) / area.k); }
  if (press && press.id === e.pointerId) {
    const h = press.h; press = null;
    if (inR(p.x, p.y, h.r, 6)) h.fn();
  }
  if (e.pointerType !== 'mouse') mouse = null;
}
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', e => { if (gamePtr === e.pointerId) { gamePtr = null; if (R && R.g) input(R.g, 'up', -999, -999); } press = null; });
cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') mouse = null; });
cv.addEventListener('contextmenu', e => e.preventDefault());

addEventListener('keydown', e => {
  snd.unlock();
  if (S.mode === 'over' || S.mode === 'off') { if (S.overT > .7) toMenu(); return; }
  if (e.key === 'Escape') {
    if (S.dialog) { const b = S.dialog.buttons.find(b => !b.def) || S.dialog.buttons[0]; S.dialog = null; b.fn(); }
    else if (S.start) S.start = false;
    else if (S.folder) S.folder = false;
    else if (S.mode === 'run' && R) pause(true);
    else if (S.mode === 'wizard') wizCancel();
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    const d = hot.slice().reverse().find(h => h.def);
    if (d && !(S.mode === 'run' && R && R.phase === 'play')) { e.preventDefault(); d.fn(); }
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (R && S.mode === 'run' && !R.paused && R.kind !== 'tutorial') pause(true); snd.loop(false); }
});

// ---------------------------------------------------------------- autoplay (for testing: ?autoplay)
let autoWait = 0;
function autoTick(dt) {
  if ((autoWait -= dt) > 0) return;
  if (S.dialog) { autoWait = .8; const b = S.dialog.buttons.find(b => b.def) || S.dialog.buttons[0]; S.dialog = null; b.fn(); return; }
  if (S.mode === 'menu') { autoWait = 1; play(); }
  else if (S.mode === 'wizard') { autoWait = 1; wizNext(); }
  else if (S.mode === 'over' && S.overT > 2.5) { toMenu(); autoWait = 1; }
}

// ---------------------------------------------------------------- boot
layout();
if (DEMO) {
  save = { best: 23, seen: GAMES.map(g => g.id).slice(0, 14), tut: true };
  newRun('run'); snd.loop(false);
  R.round = 6; R.lives = 3; R.speed = 1.15; R.d = 1;
  R.def = byId('close');
  R.g = makeGame(R.def, { d: 1, speed: 1.15, seed: 4242 });
  R.g.t = 1.05; R.phase = 'slam'; R.pt = .62; R.prev = 'win';
  S.hold = true;
}
if (DEBUG || AUTO) {
  window.pu = { S, get R() { return R; }, get area() { return area; }, get hot() { return hot.map(h => ({ ...h.r, def: !!h.def })); }, save, newRun, play, openWizard, byId, GAMES, BOSSES, step: dt => tick(dt),
    start(id, o = {}) { newRun('practice', { pool: [id] }); R.streak = o.streak || 0; planNext(); startGame(); },
    hold(v = true) { S.hold = v; }, ff(sec, dt = 1 / 60) { for (let t = 0; t < sec; t += dt) tick(dt); } };
}
requestAnimationFrame(ts => { last = ts; frame(ts); window.toyboxReady?.(); });
