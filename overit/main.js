// Pinball Over It: a tower of ten pinball tables. Shoot through the gate to climb; drain and you fall.
import { W, H, R, STEP, makeTable, step, placeBall, nudge, flipperTip } from './engine.js';
import { TABLES, ARRIVE } from './tables.js';
import { DotPanel } from './dmd.js';
import { textWidth, wrap } from './font.js';
import { Sound } from './sound.js';
import { paintTable, drawDynamic, drawBall, drawDivider } from './art.js';
import { makeBot, botStep } from './bot.js';

const params = new URLSearchParams(location.search);
const DEMO = params.has('demo'), DEBUG = params.has('debug'), AUTO = DEBUG && params.has('autoplay');
const GAP = 90, METRES = 3;  // each table is "3 m" of tower
const LAST = TABLES.length - 1;
const KEY = 'overit.v1';

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const snd = new Sound();
const dmd = new DotPanel(128, 32);
const card = new DotPanel(100, 35);     // tutorial card over the playfield
let pane = new DotPanel(100, 112);      // menus
const side = new DotPanel(64, 96);      // desktop side cards
const side2 = new DotPanel(64, 96);

// ---- save ---------------------------------------------------------------------------------
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s.table === 'number') return s; } catch (e) { /* private mode */ }
  return null;
}
const fresh = () => ({ table: 0, best: 0, fallen: 0, falls: 0, time: 0, tut: false, sound: true, wins: 0, bestTime: 0 });
let save = load() || fresh();
function persist() { if (DEMO) return; try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }
snd.on = save.sound !== false;

// ---- game state -----------------------------------------------------------------------------
const off = i => -i * (H + GAP);
const G = {
  ti: 0, table: null, mode: 'title', trans: null, camY: 0, now: 0,
  streak: 0, streakFrom: 0, overlay: null, tut: null, idleT: 0, shake: 0,
  bot: null,
};
const looks = [];  // display copies of each table, so neighbours draw with their bumpers and flippers
function look(i) { return looks[i] || (looks[i] = makeTable(TABLES[i], 1)); }

function enterTable(i, how) {
  G.ti = i;
  G.table = makeTable(TABLES[i], (Math.random() * 1e9) | 0);
  looks[i] = G.table;
  G.camY = off(i);
  if (how === 'arrive') placeBall(G.table, ARRIVE.x, ARRIVE.y, ARRIVE.vx, 0);
  else if (how === 'fall') placeBall(G.table, G.table.gate.x, 16, 0, 320);
  else if (how === 'park') { placeBall(G.table, ARRIVE.x, ARRIVE.y, 0, 0); G.table.ball.live = false; }
  save.table = i;
  persist();
}

// ---- layout ---------------------------------------------------------------------------------
let dpr = 1, vw = 0, vh = 0, view = { x: 0, y: 0, s: 1 }, dmdRect = { x: 0, y: 0, w: 0, h: 0 }, sideRects = null;
const statics = new Map();
function layout() {
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  vw = window.innerWidth; vh = window.innerHeight;
  cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
  const safeT = 8, safeB = 8;
  const landscape = vw > vh * 0.9;
  let dw = landscape ? Math.min(560, vw * 0.5) : Math.min(560, vw - 68);
  let dh = dw / 4;
  let dx = Math.max(60, (vw - dw) / 2);
  if (dx + dw > vw - 8) { dw = vw - 8 - dx; dh = dw / 4; }
  dmdRect = { x: dx, y: safeT, w: dw, h: dh };
  const top = safeT + dh + 8;
  const s = Math.min(vw / W, (vh - top - safeB) / H);
  const tw = W * s, th = H * s;
  view = { x: (vw - tw) / 2, y: top + Math.max(0, (vh - top - safeB - th) / 2), s, w: tw, h: th };
  const room = (vw - tw) / 2 - 24;
  sideRects = room >= 150 ? (() => {
    const w = Math.min(260, room), h = w * 1.5;
    return [{ x: view.x - 16 - w, y: view.y + 20, w, h }, { x: view.x + tw + 16, y: view.y + 20, w, h }];
  })() : null;
  statics.clear();
}
function staticFor(i) {
  let c = statics.get(i);
  if (!c) { c = paintTable(look(i), i, view.s * dpr); statics.set(i, c); }
  return c;
}

// ---- input -----------------------------------------------------------------------------------
const keys = { l: false, r: false };
const pointers = new Map();
let lastInput = 'mouse';
const held = () => {
  let l = keys.l, r = keys.r;
  for (const p of pointers.values()) { if (p.side < 0) l = true; else if (p.side > 0) r = true; }
  return [l, r];
};
const inRect = (x, y, r) => r && x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;

cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  snd.unlock();
  lastInput = e.pointerType === 'touch' ? 'touch' : 'mouse';
  if (G.overlay) { overlayTap(e.clientX, e.clientY); return; }
  if (DEMO) return;
  if (inRect(e.clientX, e.clientY, dmdRect)) { openMenu(); return; }
  const s = e.button === 2 ? 1 : e.clientX < vw / 2 ? -1 : 1;
  pointers.set(e.pointerId, { side: s, x0: e.clientX, y0: e.clientY, t0: performance.now(), nudged: false });
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});
cv.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if (!p || p.nudged) return;
  if (p.y0 - e.clientY > 42 && performance.now() - p.t0 < 260) { p.nudged = true; doNudge(); }
});
const up = e => { pointers.delete(e.pointerId); };
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', up);
cv.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('blur', () => { pointers.clear(); keys.l = keys.r = false; });

const LKEYS = new Set(['KeyZ', 'ShiftLeft', 'ArrowLeft', 'KeyA', 'ControlLeft']);
const RKEYS = new Set(['Slash', 'ShiftRight', 'ArrowRight', 'KeyM', 'KeyL', 'ControlRight', 'Period']);
window.addEventListener('keydown', e => {
  snd.unlock();
  lastInput = 'key';
  if (G.overlay) { overlayKey(e); return; }
  if (DEMO) return;
  if (LKEYS.has(e.code)) { keys.l = true; e.preventDefault(); }
  else if (RKEYS.has(e.code)) { keys.r = true; e.preventDefault(); }
  else if ((e.code === 'Space' || e.code === 'ArrowUp') && !e.repeat) { doNudge(); e.preventDefault(); }
  else if (e.code === 'Escape' || e.code === 'KeyP') openMenu();
});
window.addEventListener('keyup', e => {
  if (LKEYS.has(e.code)) keys.l = false;
  if (RKEYS.has(e.code)) keys.r = false;
});

function doNudge() {
  if (G.mode !== 'play' || !G.table.ball.live) return;
  G.shake = 0.18;
  nudge(G.table, 0);
  if (G.tut) G.tut.nudged = true;
}

// ---- DMD messages --------------------------------------------------------------------------
let msg = null;
const queue = [];
function later(text, dur = 3, o = {}) { queue.push([text, dur, o]); }
function say(text, dur = 2.6, o = {}) {
  if (msg && msg.prio > (o.prio || 0) && msg.t < msg.dur) return;
  msg = { text, dur, t: 0, prio: o.prio || 0, big: o.big, flash: o.flash, ticker: o.ticker };
  snd.blip();
}
const TAUNT1 = [
  'DOWN YOU GO.', 'GRAVITY: 1  YOU: 0', 'THE FLOOR IS PATIENT.', 'IT WAS NICE UP THERE.', 'SEE YOU AGAIN SOON.',
  'HAVE YOU TRIED NOT DRAINING?', 'THAT TABLE WILL MISS YOU.', 'BACK WHERE YOU STARTED. ALMOST.', 'OOF.', 'THE BALL WANTED TO GO HOME.',
  'A STRONG STRATEGIC RETREAT.', 'ALL PART OF THE PLAN, SURELY.',
];
const TAUNTN = ['TWO TABLES. KEEP GOING, WHY NOT.', 'STILL FALLING.', 'THIS IS FINE.', 'FREE FALL ACHIEVED.', 'THE TOWER GIVETH. MOSTLY IT TAKETH.'];
const pick = a => a[(Math.random() * a.length) | 0];

function drawDmd(dt) {
  dmd.clear();
  if (msg) {
    msg.t += dt;
    if (msg.t > msg.dur) msg = null;
  }
  if (!msg && queue.length) say(...queue.shift());
  if (msg) {
    if (msg.flash && Math.floor(msg.t * 6) % 2) { /* blink off */ }
    else if (msg.big) {
      const w = textWidth(msg.text, 3);
      if (w <= 124) dmd.center(msg.text, 5, 3);
      else dmd.block(msg.text, 0, 32, 2);
    } else if (msg.ticker) {
      const w = textWidth(msg.text, 2);
      dmd.text(msg.text, 128 - ((msg.t * 70) % (w + 140)), 9, 2);
    } else dmd.block(msg.text, 0, 32, 1);
  } else if (G.mode === 'title' || DEMO) {
    const k = Math.floor(G.now / 3) % 2;
    if (k === 0) { dmd.center('PINBALL', 1, 2); dmd.center('OVER IT', 17, 2); }
    else { dmd.center('TEN TABLES', 4); dmd.center('ONE BALL', 13); dmd.center('NO CHECKPOINTS', 22); }
  } else {
    const k = Math.floor(G.now / 4) % 3;
    const ht = G.ti * METRES + (G.table && G.table.ball.live ? Math.max(0, (H - G.table.ball.y) / H) * METRES : 0);
    if (k === 0) {
      dmd.text(`TABLE ${G.ti + 1}`, 2, 2);
      const nm = TABLES[G.ti].name;
      if (textWidth(nm, 2) <= 124) dmd.center(nm, 14, 2); else dmd.center(nm, 17, 1);
    } else if (k === 1) {
      dmd.text('HEIGHT', 2, 2); dmd.text(`${ht.toFixed(1)} M`, 2, 12, 2);
      dmd.text(`BEST ${Math.max(save.best, G.ti) + 1}`, 82, 2);
    } else {
      dmd.text('FALLEN', 2, 2); dmd.text(`${save.fallen * METRES} M`, 2, 12, 2);
      dmd.text(`${save.falls} DRAINS`, 72, 2);
    }
    // the tower: ten little floors, the ball on its own floor
    for (let i = 0; i <= LAST; i++) {
      const y = 29 - i * 3;
      const x0 = 120;
      const on = i === G.ti ? (Math.floor(G.now * 4) % 2 ? 1 : 0.6) : i <= save.best ? 0.45 : 0.15;
      for (let x = 0; x < 6; x++) dmd.dot(x0 + x, y, on);
    }
  }
  if (G.table && G.table.tilted && G.mode === 'play') { dmd.clear(); if (Math.floor(G.now * 4) % 2) dmd.center('TILT', 5, 3); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  dmd.render(ctx, dmdRect.x * dpr, dmdRect.y * dpr, dmdRect.w * dpr, dmdRect.h * dpr);
}

// ---- transitions between tables ----------------------------------------------------------
function bez(p0, p1, p2, p3, n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return out;
}
function makePath(pts) {
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, lens, total: lens[lens.length - 1] };
}
function along(p, d) {
  d = Math.max(0, Math.min(p.total, d));
  let i = 1;
  while (i < p.lens.length - 1 && p.lens[i] < d) i++;
  const k = (d - p.lens[i - 1]) / ((p.lens[i] - p.lens[i - 1]) || 1);
  return [p.pts[i - 1][0] + (p.pts[i][0] - p.pts[i - 1][0]) * k, p.pts[i - 1][1] + (p.pts[i][1] - p.pts[i - 1][1]) * k];
}

function goUp() {
  snd.up();
  if (G.ti === LAST) { win(); return; }
  const gx = G.table.gate.x, o = off(G.ti), o2 = off(G.ti + 1);
  const pts = [
    ...bez([gx, o + 4], [gx, o - GAP * 0.7], [22, o - GAP * 0.3], [22, o2 + H - 20]),
    [22, o2 + ARRIVE.y],
  ];
  G.trans = { dir: 1, path: makePath(pts), t: 0, dur: 0.95, cam0: G.camY, cam1: o2, to: G.ti + 1 };
  G.mode = 'trans';
}
function goDown(x) {
  snd.down();
  save.falls++;
  if (G.ti === 0) {
    G.trans = { dir: 0, t: 0, dur: 1.1, path: null, cam0: G.camY, cam1: G.camY, to: 0 };
    G.mode = 'trans';
    return;
  }
  const lower = look(G.ti - 1);
  const gx = lower.gate.base, o = off(G.ti), o2 = off(G.ti - 1);
  const pts = bez([x, o + H + 20], [x, o + H + GAP * 0.6], [gx, o2 - GAP * 0.4], [gx, o2 + 12]);
  G.trans = { dir: -1, path: makePath(pts), t: 0, dur: 0.6, cam0: G.camY, cam1: o2, to: G.ti - 1 };
  G.mode = 'trans';
}
function finishTrans() {
  const tr = G.trans;
  G.trans = null;
  G.mode = 'play';
  if (tr.dir === 1) {
    enterTable(tr.to, 'arrive');
    const newBest = tr.to > save.best;
    if (newBest) save.best = tr.to;
    persist();
    if (G.streak > 0) G.streak = 0;
    if (G.tut && G.tut.step === 'gate') { tutStep('done'); return; }
    if (newBest) say(`NEW HEIGHT!  TABLE ${tr.to + 1}: ${TABLES[tr.to].name}.  ${TABLES[tr.to].trick}`, 5, { prio: 2 });
    else say(`TABLE ${tr.to + 1}: ${TABLES[tr.to].name}`, 2.5, { prio: 1 });
  } else if (tr.dir === -1) {
    save.fallen++;
    G.streak++;
    enterTable(tr.to, 'fall');
    if (G.streak === 1) say(pick(TAUNT1), 3, { prio: 1 });
    else if (G.streak === 2) say(pick(TAUNTN), 3, { prio: 1 });
    else say(`${G.streak} TABLES IN A ROW. ${G.streak * METRES} M OF PURE FALLING.`, 3.5, { prio: 1 });
  } else {
    // drained on the ground floor
    snd.ground();
    G.streak = 0;
    placeBall(G.table, ARRIVE.x, ARRIVE.y, ARRIVE.vx, 0);
    G.table.tilted = false; G.table.tiltMeter = 0;
    if (!G.tut) say('GROUND FLOOR. THE BALL COMES BACK.', 2.5, { prio: 1 });
  }
}

function win() {
  save.wins = (save.wins || 0) + 1;
  save.best = LAST;
  const tm = save.time;
  if (!save.bestTime || tm < save.bestTime) save.bestTime = tm;
  persist();
  snd.win();
  G.mode = 'won';
  say('YOU GOT OVER IT!', 999, { big: true, prio: 5 });
  showOverlay('won');
}

// ---- tutorial --------------------------------------------------------------------------------
// Steps on the ground floor: left, right, catch, nudge, then shoot through the gate.
function startTutorial() {
  G.tut = { step: '', t: 0, nudged: false, okL: false, okR: false };
  enterTable(0, 'park');
  G.mode = 'play';
  tutStep('left');
}
function tutStep(s) {
  const tu = G.tut;
  tu.step = s; tu.t = 0;
  if (s === 'catch') { placeBall(G.table, ARRIVE.x, ARRIVE.y, ARRIVE.vx, 0); tu.cradle = 0; }
  if (s === 'done') {
    G.tut = null;
    save.tut = true; persist();
    say('DRAIN HERE AND YOU FALL BACK DOWN A TABLE. NO LIVES. NO CHECKPOINTS.', 5, { prio: 3 });
    later(lastInput === 'touch' ? 'TAP THIS SIGN ANY TIME FOR THE MENU.' : 'ESC OR A CLICK ON THIS SIGN OPENS THE MENU.', 3.5);
    later('GOOD LUCK.', 2);
    G.tutDone = 6;
  }
}
function tutText() {
  const tu = G.tut, touch = lastInput === 'touch';
  switch (tu.step) {
    case 'left': return touch ? 'TAP THE LEFT HALF OF THE SCREEN TO FLIP' : 'PRESS Z OR LEFT SHIFT FOR THE LEFT FLIPPER';
    case 'right': return touch ? 'NOW THE RIGHT HALF FOR THE RIGHT FLIPPER' : 'NOW / OR RIGHT SHIFT FOR THE RIGHT FLIPPER';
    case 'catch': return 'HOLD A FLIPPER UP AS THE BALL ARRIVES TO CATCH IT';
    case 'nudge': return touch ? 'FLICK A FINGER UP TO NUDGE THE TABLE. TOO MANY = TILT' : 'SPACE NUDGES THE TABLE. TOO MANY = TILT';
    case 'gate': return tu.t < 6 ? 'LET GO, LET IT ROLL, THEN FLIP. AIM FOR THE GATE ^' : 'FLIP EARLY OR LATE AS IT ROLLS DOWN THE FLIPPER TO AIM';
  }
  return '';
}
function tutUpdate(dt) {
  const tu = G.tut;
  if (!tu) return;
  tu.t += dt;
  const [l, r] = held();
  const b = G.table.ball;
  if (tu.step === 'left' && l) tu.okL = true;
  if (tu.step === 'left' && tu.okL && !l) tutStep('right');
  else if (tu.step === 'right' && r) tu.okR = true;
  if (tu.step === 'right' && tu.okR && !r) tutStep('catch');
  else if (tu.step === 'catch') {
    const sp = Math.hypot(b.vx, b.vy);
    const f = G.table.flippers.find(f => f.held);
    tu.cradle = b.live && f && sp < 40 && b.y > 480 ? tu.cradle + dt : 0;
    if (tu.cradle > 0.5) { snd.open(); tutStep('nudge'); tu.nudged = false; }
  } else if (tu.step === 'nudge' && tu.nudged && tu.t > 0.3) tutStep('gate');
}

// ---- overlays (title, menu, win) ---------------------------------------------------------
function showOverlay(kind) {
  const items = [];
  let lines = [];
  if (kind === 'title') {
    lines = [['PINBALL', 2], ['OVER IT', 2], ['', 1], ['TEN PINBALL TABLES, STACKED. SHOOT THROUGH THE GATE TO CLIMB. DRAIN AND YOU FALL A TABLE.', 1], ['', 1]];
    if (save.table > 0 || save.tut) {
      if (save.table > 0) items.push({ label: `CONTINUE  ${save.table + 1}/10`, act: () => { closeOverlay(); enterTable(save.table, 'arrive'); G.mode = 'play'; say(`TABLE ${save.table + 1}: ${TABLES[save.table].name}`, 2.5); } });
      items.push({ label: save.table > 0 ? 'NEW CLIMB' : 'PLAY', act: () => { closeOverlay(); newClimb(); } });
      items.push({ label: 'HOW TO PLAY', act: () => { closeOverlay(); startTutorial(); } });
    } else items.push({ label: 'PLAY', act: () => { closeOverlay(); startTutorial(); } });
  } else if (kind === 'menu') {
    lines = [['PAUSED', 2], ['', 1], [`TABLE ${G.ti + 1} OF 10`, 1], [`BEST: TABLE ${save.best + 1}`, 1], [`FALLEN: ${save.fallen * METRES} M`, 1], [`TIME: ${fmtTime(save.time)}`, 1], ['', 1]];
    items.push({ label: 'RESUME', act: closeOverlay });
    items.push({ label: () => `SOUND: ${snd.on ? 'ON' : 'OFF'}`, act: () => { snd.on = !snd.on; save.sound = snd.on; persist(); } });
    items.push({ label: 'HOW TO PLAY', act: () => { closeOverlay(); startTutorial(); } });
    items.push({ label: () => G.overlay.confirm ? 'SURE? TAP AGAIN' : 'START OVER', act: () => { if (G.overlay.confirm) { closeOverlay(); newClimb(); } else G.overlay.confirm = true; } });
  } else if (kind === 'won') {
    lines = [['YOU GOT', 2], ['OVER IT', 2], ['', 1], ['THE TOP OF THE TOWER.', 1], [`TIME: ${fmtTime(save.time)}`, 1], [`FALLEN: ${save.fallen * METRES} M`, 1], [`DRAINS: ${save.falls}`, 1], ['', 1]];
    items.push({ label: 'CLIMB AGAIN', act: () => { closeOverlay(); msg = null; newClimb(); } });
  }
  G.overlay = { kind, lines, items, sel: 0, confirm: false, rects: [] };
}
function closeOverlay() { G.overlay = null; pointers.clear(); keys.l = keys.r = false; }
function openMenu() { if (G.mode === 'title' || G.mode === 'won' || DEMO) return; showOverlay('menu'); }
function newClimb() {
  const keep = { tut: save.tut, sound: save.sound, wins: save.wins, bestTime: save.bestTime };
  save = { ...fresh(), ...keep };
  G.streak = 0;
  if (!save.tut) { startTutorial(); return; }
  enterTable(0, 'arrive');
  G.mode = 'play';
  say('TABLE 1: LAUNCH PAD. GOOD LUCK.', 3);
}
function fmtTime(s) { const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }
function overlayTap(x, y) {
  const o = G.overlay;
  const i = o.rects.findIndex(r => inRect(x, y, r));
  if (i >= 0) { o.sel = i; snd.blip(); o.items[i].act(); }
  else if (o.kind === 'menu' && !inRect(x, y, o.box)) closeOverlay();
}
function overlayKey(e) {
  const o = G.overlay;
  if (e.code === 'ArrowDown' || RKEYS.has(e.code) || e.code === 'KeyS') { o.sel = (o.sel + 1) % o.items.length; snd.blip(); e.preventDefault(); }
  else if (e.code === 'ArrowUp' || LKEYS.has(e.code) || e.code === 'KeyW') { o.sel = (o.sel + o.items.length - 1) % o.items.length; snd.blip(); e.preventDefault(); }
  else if (e.code === 'Enter' || e.code === 'Space') { o.items[o.sel].act(); e.preventDefault(); }
  else if (e.code === 'Escape' && o.kind === 'menu') closeOverlay();
}
function drawOverlay() {
  const o = G.overlay;
  if (!o) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, vw, vh);
  const label = it => typeof it.label === 'function' ? it.label() : it.label;
  if (!o.wrapped) {
    o.wrapped = [];
    for (const [l, sc] of o.lines) {
      if (sc === 1 && l) for (const w of wrap(l, 96)) o.wrapped.push([w, 1]);
      else o.wrapped.push([l, sc]);
    }
  }
  let rows = 4;
  for (const [l, sc] of o.wrapped) rows += sc === 2 ? 17 : l ? 9 : 5;
  rows += 2 + o.items.length * 16 + 1;
  if (pane.rows !== rows) pane = new DotPanel(100, rows);
  pane.clear();
  let y = 4;
  for (const [l, sc] of o.wrapped) { if (l) pane.center(l, y, sc); y += sc === 2 ? 17 : l ? 9 : 5; }
  y += 2;
  const rowsUsed = [];
  o.items.forEach((it, i) => {
    const sel = i === o.sel;
    pane.rect(6, y, 88, 13, sel ? 1 : 0.4);
    if (sel) pane.text('>', 9, y + 3);
    pane.center(label(it), y + 3, 1, sel ? 1 : 0.75);
    rowsUsed.push([y, 13]);
    y += 16;
  });
  const w = Math.min(view.w * 0.92, 440), pitch = w / pane.cols, h = rows * pitch;
  const x = (vw - w) / 2, top = Math.max(dmdRect.y + dmdRect.h + 8, view.y + (view.h - h) * 0.42);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ff7a1a';
  ctx.fillRect((x - 3) * dpr, (top - 3) * dpr, (w + 6) * dpr, (h + 6) * dpr);
  pane.render(ctx, x * dpr, top * dpr, w * dpr, h * dpr);
  o.box = { x, y: top, w, h };
  o.rects = rowsUsed.map(([ry, rh]) => ({ x: x + 6 * pitch, y: top + (ry - 2) * pitch, w: 88 * pitch, h: (rh + 4) * pitch }));
}

// ---- side cards (desktop) -------------------------------------------------------------------
function drawSides() {
  if (!sideRects) return;
  const [a, b] = sideRects;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  side.clear();
  side.center('HOW TO', 2); side.center('PLAY', 11);
  const rows = DEMO || lastInput !== 'touch'
    ? [['LEFT', 'Z OR SHIFT'], ['RIGHT', '/ OR SHIFT'], ['NUDGE', 'SPACE'], ['MENU', 'ESC']]
    : [['LEFT', 'TAP LEFT'], ['RIGHT', 'TAP RIGHT'], ['NUDGE', 'FLICK UP'], ['MENU', 'TAP SIGN']];
  let y = 25;
  for (const [k, v] of rows) { side.center(k, y, 1, 0.55); side.center(v, y + 9, 1, 1); y += 18; }
  side.render(ctx, a.x * dpr, a.y * dpr, a.w * dpr, a.h * dpr);

  side2.clear();
  side2.center('THE', 2); side2.center('TOWER', 11);
  for (let i = 0; i <= LAST; i++) {
    const yy = 88 - i * 6.6;
    const cur = i === G.ti;
    const v = cur ? 1 : i <= save.best ? 0.55 : 0.18;
    side2.rect(14, Math.round(yy) - 4, 36, 5, v, cur);
    side2.text(String(i + 1), i + 1 >= 10 ? 1 : 6, Math.round(yy) - 5, 1, v);
    if (i === save.best && !cur) side2.text('<', 53, Math.round(yy) - 5, 1, 0.6);
  }
  side2.render(ctx, b.x * dpr, b.y * dpr, b.w * dpr, b.h * dpr);
}

// ---- main loop --------------------------------------------------------------------------------
let lastFlip = [false, false];
function update(dt) {
  G.now += dt;
  if (G.shake > 0) G.shake -= dt;
  if (G.flash > 0) G.flash -= dt;
  if (G.tutDone > 0) G.tutDone -= dt;
  if (G.mode === 'play') {
    const t = G.table;
    if (DEMO || AUTO) botStep(G.bot || (G.bot = makeBot({})), t, dt);
    else {
      const [l, r] = held();
      t.flippers[0].held = l; t.flippers[1].held = r;
    }
    for (let i = 0; i < 2; i++) {
      const h = t.flippers[i].held && !t.tilted;
      if (h !== lastFlip[i]) snd.flip(h);
      lastFlip[i] = h;
    }
    step(t);
    if (!DEMO) save.time += dt;
    for (const e of t.events.splice(0)) handle(e);
    tutUpdate(dt);
  } else if (G.mode === 'trans') {
    const tr = G.trans;
    tr.t += dt;
    const k = Math.min(1, tr.t / tr.dur);
    const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    G.camY = tr.cam0 + (tr.cam1 - tr.cam0) * ease;
    if (k >= 1) finishTrans();
  }
}
function handle(e) {
  switch (e.type) {
    case 'bumper': snd.bumper(); break;
    case 'sling': snd.sling(); break;
    case 'wall': snd.wall(e.v); break;
    case 'ghost': snd.ghost(); break;
    case 'target': snd.target(); { const left = G.table.targets.filter(t => !t.down).length; if (left) say(`${left} TO GO`, 1.2); } break;
    case 'open': snd.open(); say('THE GATE IS OPEN!', 2.5, { prio: 1 }); break;
    case 'up': goUp(); break;
    case 'down': goDown(e.x); break;
    case 'tilt': snd.tilt(); break;
    case 'nudge': snd.nudge(); if (e.warn) { snd.warn(); say('DANGER', 1.2, { big: true, flash: true, prio: 2 }); } break;
    case 'search': snd.sling(); say('BALL SEARCH', 1.2); break;
    case 'slam': snd.thunder(); G.flash = 0.18; break;
    case 'gustwarn': snd.gust(); say(e.dir > 0 ? 'GUST >>>' : '<<< GUST', 2.2, { big: true, flash: true, prio: 2 }); break;
  }
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0c0907';
  ctx.fillRect(0, 0, cv.width, cv.height);
  drawCabinet();
  const s = view.s;
  const shx = G.shake > 0 ? Math.sin(G.now * 90) * 3 * (G.shake / 0.18) : 0;
  const shy = G.shake > 0 ? -Math.abs(Math.cos(G.now * 70)) * 4 * (G.shake / 0.18) : 0;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath(); ctx.rect(view.x * dpr, view.y * dpr, view.w * dpr, view.h * dpr); ctx.clip();
  // which tables are on screen?
  const camTop = G.camY, camBot = G.camY + H;
  for (let i = 0; i <= LAST; i++) {
    const o = off(i);
    if (o + H < camTop - GAP || o > camBot + GAP) continue;
    const sy = view.y + (o - camTop) * s + shy, sx = view.x + shx;
    const tb = i === G.ti ? G.table : look(i);
    const rot = tb && tb.tiltAng ? -tb.tiltAng * 0.3 : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (rot) { ctx.translate(sx + W * s / 2, sy + H * s / 2); ctx.rotate(rot); ctx.translate(-(sx + W * s / 2), -(sy + H * s / 2)); }
    ctx.drawImage(staticFor(i), sx, sy, W * s, H * s);
    ctx.translate(sx, sy); ctx.scale(s, s);
    drawDynamic(ctx, tb, G.now, { hintGate: G.tut && G.tut.step === 'gate' });
    if (i === G.ti && G.mode !== 'trans' && G.table.ball.live) drawBall(ctx, G.table.ball.x, G.table.ball.y);
    if (i === G.ti && G.tut) drawTutorialHints(ctx);
    // divider above this table
    if (i < LAST) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(view.x + shx, view.y + (o - GAP - camTop) * s + shy); ctx.scale(s, s);
      drawDivider(ctx, GAP, look(i).gate.base, i + 1);
    }
  }
  if (G.mode === 'trans' && G.trans.path) {
    const tr = G.trans;
    const k = Math.min(1, tr.t / tr.dur);
    const [bx, by] = along(tr.path, tr.path.total * (tr.dir > 0 ? 1 - Math.pow(1 - k, 1.6) : k * k));
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (view.x + shx), dpr * (view.y - camTop * s + shy));
    drawBall(ctx, bx, by);
  }
  if (G.flash > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(230,240,255,${G.flash * 2})`;
    ctx.fillRect(view.x * dpr, view.y * dpr, view.w * dpr, view.h * dpr);
  }
  ctx.restore();
  if (G.tut && G.mode === 'play') drawTutorialCard();
  drawDmd(1 / 60);
  drawSides();
  drawOverlay();
}

function drawCabinet() {
  // side rails of the cabinet and a lockdown bar under the playfield
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const x = view.x, y = view.y, w = view.w, h = view.h;
  const g = ctx.createLinearGradient(x - 14, 0, x, 0);
  g.addColorStop(0, '#2a1a10'); g.addColorStop(1, '#5a3a22');
  ctx.fillStyle = g; ctx.fillRect(x - 14, y - 6, 14, h + 12);
  const g2 = ctx.createLinearGradient(x + w, 0, x + w + 14, 0);
  g2.addColorStop(0, '#5a3a22'); g2.addColorStop(1, '#2a1a10');
  ctx.fillStyle = g2; ctx.fillRect(x + w, y - 6, 14, h + 12);
  // a frame around the DMD
  const d = dmdRect;
  ctx.fillStyle = '#1b120b'; ctx.fillRect(d.x - 6, d.y - 5, d.w + 12, d.h + 10);
  ctx.fillStyle = '#3a2716'; ctx.fillRect(d.x - 3, d.y - 2, d.w + 6, d.h + 4);
}

function drawTutorialHints(c) {
  const tu = G.tut;
  const pulse = 0.5 + 0.5 * Math.sin(G.now * 6);
  if (tu.step === 'left' || tu.step === 'right') {
    const f = G.table.flippers[tu.step === 'left' ? 0 : 1];
    c.save();
    c.strokeStyle = `rgba(255,122,26,${0.4 + pulse * 0.6})`; c.lineWidth = 3; c.setLineDash([2, 5]); c.lineCap = 'round';
    c.beginPath(); c.arc(f.px + f.side * -30, f.py + 6, 52, 0, Math.PI * 2); c.stroke();
    c.restore();
    if (lastInput === 'touch') {
      // the half of the screen to tap
      c.save(); c.fillStyle = `rgba(255,122,26,${0.06 + pulse * 0.06})`;
      c.fillRect(tu.step === 'left' ? 0 : W / 2, 0, W / 2, H); c.restore();
    }
  }
}
function drawTutorialCard() {
  const text = tutText();
  if (!text) return;
  card.clear();
  card.block(text, 0, card.rows, 1);
  const w = Math.min(view.w * 0.86, 380), pitch = w / card.cols, h = card.rows * pitch;
  const x = view.x + (view.w - w) / 2, y = view.y + view.h * (G.tut.step === 'gate' ? 0.55 : 0.36);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ff7a1a';
  ctx.fillRect((x - 2) * dpr, (y - 2) * dpr, (w + 4) * dpr, (h + 4) * dpr);
  card.render(ctx, x * dpr, y * dpr, w * dpr, h * dpr);
}

let last = 0, acc = 0, hold = false;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - (last || ts)) / 1000);
  last = ts;
  if (!hold) {
    acc += dt;
    while (acc >= STEP) { try { update(STEP); } catch (err) { console.error(err); } acc -= STEP; }
  }
  try { render(); } catch (err) { console.error(err); }
}

// ---- boot ---------------------------------------------------------------------------------
window.addEventListener('resize', layout);
layout();
if (DEMO) {
  const ti = +(params.get('table') ?? 4);
  enterTable(ti, 'arrive');
  G.mode = 'play';
  G.bot = makeBot({ pickAim: () => 0.3 + Math.random() * 0.5 });
  // fast-forward so the ball is mid-flight in the screenshot
  for (let i = 0; i < 120 * 1.6; i++) update(STEP);
  say('', 0);
  msg = null;
} else {
  const ti = DEBUG && params.has('table') ? +params.get('table') : save.table;
  enterTable(ti, 'park');
  G.mode = 'title';
  showOverlay('title');
}
if (DEBUG) {
  window.ov = {
    G, get save() { return save; }, step: n => { for (let i = 0; i < n; i++) update(STEP); render(); }, hold: v => { hold = v; },
    goto: i => { closeOverlay(); enterTable(i, 'arrive'); G.mode = 'play'; }, keys, startTutorial, snd,
  };
}
requestAnimationFrame(frame);
window.toyboxReady?.();
