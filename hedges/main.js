import { ROOMS } from './levels.js';
import { key, hedgeSet, judge, canStep, open, inRect, exitDir, DIRS, STEP, findLine } from './logic.js';
import * as R from './render.js';
import { Sound } from './sound.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug');
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const snd = new Sound();
const $ = (id) => document.getElementById(id);

// ---- save: which panels are planted in each room, in the order they were planted
const SAVE = 'hedges.v1';
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE));
    if (s && Array.isArray(s.solved) && s.solved.length === ROOMS.length) return s;
  } catch {}
  return { room: 0, reach: 0, solved: ROOMS.map(() => []) };
}
let save = DEMO ? { room: 0, reach: 0, solved: ROOMS.map(() => []) } : load();
const persist = () => { if (!DEMO) try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch {} };

let cur = Math.min(save.room, ROOMS.length - 1);
let room = ROOMS[cur];
let H = null;
let drawing = null;            // { pi, path, seen, tip }
let fading = [];               // released lines melting away
let flash = null;              // { bad, t0 } symbols that broke the rule
let growing = null;            // { pi, path, t0, dur } a hedge being planted
let wither = null;             // { path, t0 } a hedge the fountain lifted
let poke = null;               // { pi, t0 } a start circle nudged after a tap elsewhere
let fails = {};                // 'room:panel' → misses, for hints
let stuck = new Set();         // unsolved panels with no line left
let selected = -1;             // keyboard focus
let titleOn = !DEMO, titleT = 0;
let endOn = false, endT = 0;
let fadeIn = 0;
let gateT = 0;                 // when the gate last opened
let view = { s: 40, ox: 0, oy: 0, W: 0, H: 0, dpr: 1 };
let ground = null, hedges = null;

const now = () => performance.now();
const solvedOf = (i) => new Set(save.solved[i].map((e) => e.p));
const complete = (i) => save.solved[i].length === ROOMS[i].panels.length;
const X = (x) => view.ox + x * view.s, Y = (y) => view.oy + y * view.s;

// ---- layout
const WALL = 0.62;
function layout() {
  const W = innerWidth, Hh = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2.5);
  cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);
  const bottom = 84;
  const mw = room.w + WALL * 2 + 0.9, mh = room.h + WALL * 2 + 1.1;
  const fit = (top) => Math.min((W - 16) / mw, (Hh - top - bottom) / mh, 96);
  // the band at the top keeps the room off the Home button; a wide, short screen
  // (a phone held sideways) leaves the room well clear of the corner, so take it back
  let top = 62, s = fit(top);
  if ((W - room.w * fit(16)) / 2 - 1.5 * fit(16) > 64) { top = 16; s = fit(top); }
  view = { s, W, H: Hh, dpr, ox: Math.round((W - room.w * s) / 2), oy: Math.round(top + (Hh - top - bottom - room.h * s) / 2 + s * 0.15) };
  bake();
}

// ---- state changes
function enterRoom(i, fade = true) {
  cur = i; room = ROOMS[i]; save.room = i; persist();
  drawing = null; fading = []; flash = null; growing = null; wither = null; selected = -1;
  if (fade) fadeIn = now();
  layout();
  refresh();
  renderRooms();
}

function refresh() {
  H = hedgeSet(room, save.solved[cur].map((e) => e.path));
  const done = solvedOf(cur);
  stuck = new Set();
  const unsure = [];
  room.panels.forEach((p, i) => {
    if (done.has(i)) return;
    const line = findLine(room, p, H, 60000);
    if (line === null) stuck.add(i);
    else if (line === undefined) unsure.push(i);
  });
  showStuck();
  $('fount').classList.toggle('empty', !save.solved[cur].length);
  bake();
  renderRooms();
  // the quick look ran out on a big panel: if it's the last hope, ask the worker
  const ask = ++stuckAsk;
  if (worker) { worker.terminate(); worker = null; }
  const left = room.panels.length - done.size;
  if (unsure.length && stuck.size + unsure.length === left && typeof Worker !== 'undefined') {
    try {
      worker = new Worker(new URL('./stuck.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        if (data.id !== ask) return;
        data.dead.forEach((i) => stuck.add(i));
        showStuck();
        worker.terminate(); worker = null;
      };
      worker.onerror = () => { worker?.terminate(); worker = null; };
      worker.postMessage({ id: ask, room: cur, paths: save.solved[cur].map((e) => e.path), panels: unsure });
    } catch { worker = null; }
  }
}
let worker = null, stuckAsk = 0;

// a cracked start just means "not yet"; only when every open panel is cracked
// has the order gone wrong, and the fountain wells up
function showStuck() {
  const left = room.panels.length - solvedOf(cur).size;
  $('fount').classList.toggle('stuck', left > 0 && stuck.size === left);
}

function plant(pi, path) {
  save.solved[cur].push({ p: pi, path });
  growing = { pi, path, t0: now(), dur: 380 + path.length * 70 };
  if (complete(cur)) {
    save.reach = Math.max(save.reach, Math.min(cur + 1, ROOMS.length - 1));
    gateT = now() + growing.dur;
    setTimeout(() => snd.gate(), growing.dur);
    if (cur === ROOMS.length - 1) setTimeout(() => { endOn = true; endT = now(); }, growing.dur + 1400);
  }
  persist();
  refresh();
  snd.solve(path.length);
}

function fountain() {
  if (drawing || !save.solved[cur].length) return;
  const e = save.solved[cur].pop();
  wither = { path: e.path, t0: now() };
  growing = null;
  persist();
  refresh();
  snd.water();
}

function submit() {
  const d = drawing; drawing = null;
  const panel = room.panels[d.pi];
  const res = judge(room, panel, d.path, H);
  if (res.ok) { plant(d.pi, d.path); return; }
  const k = cur + ':' + d.pi;
  fails[k] = (fails[k] || 0) + 1;
  flash = { bad: res.bad, t0: now() };
  fading.push({ path: d.path, tip: null, t0: now(), bad: true });
  snd.fail();
}

function cancel() {
  if (!drawing) return;
  if (drawing.path.length > 1) fading.push({ path: drawing.path, tip: drawing.tip, t0: now(), bad: false });
  drawing = null;
}

// ---- following a finger along the lattice
function begin(pi) {
  const p = room.panels[pi];
  drawing = { pi, path: [p.s.slice()], seen: new Set([key(...p.s)]), tip: null };
  selected = pi;
  snd.start(); snd.begin();
}

function stepTo(nx, ny) {
  const d = drawing, path = d.path;
  if (path.length > 1) {
    const [px, py] = path[path.length - 2];
    if (px === nx && py === ny) { d.seen.delete(key(...path.pop())); snd.back(); return true; }
  }
  if (!canStep(room.panels[d.pi], H, path, d.seen, nx, ny)) return false;
  path.push([nx, ny]); d.seen.add(key(nx, ny));
  snd.step(path.length - 1);
  return true;
}

function follow(gx, gy) {
  const d = drawing;
  for (let it = 0; it < 80; it++) {
    const [hx, hy] = d.path[d.path.length - 1];
    const dx = gx - hx, dy = gy - hy;
    const axes = Math.abs(dx) >= Math.abs(dy) ? [[Math.sign(dx), 0, dx], [0, Math.sign(dy), dy]] : [[0, Math.sign(dy), dy], [Math.sign(dx), 0, dx]];
    let moved = false;
    for (const [sx, sy, amt] of axes) {
      if (Math.abs(amt) < 0.5) continue;
      if (stepTo(hx + sx, hy + sy)) { moved = true; break; }
    }
    if (!moved) break;
  }
  // the bright tip creeps toward the finger along an open way (or into the exit)
  const [hx, hy] = d.path[d.path.length - 1];
  const dx = gx - hx, dy = gy - hy;
  const p = room.panels[d.pi];
  const horiz = Math.abs(dx) >= Math.abs(dy);
  const sx = horiz ? Math.sign(dx) : 0, sy = horiz ? 0 : Math.sign(dy), amt = Math.abs(horiz ? dx : dy);
  d.tip = null;
  if (!sx && !sy) return;
  const atExit = hx === p.e[0] && hy === p.e[1];
  const [ex, ey] = DIRS[exitDir(p)];
  if (atExit && sx === ex && sy === ey) { d.tip = [hx + sx * Math.min(amt, 0.42), hy + sy * Math.min(amt, 0.42)]; return; }
  const prev = d.path.length > 1 ? d.path[d.path.length - 2] : null;
  const back = prev && prev[0] === hx + sx && prev[1] === hy + sy;
  if (back || canStep(p, H, d.path, d.seen, hx + sx, hy + sy)) d.tip = [hx + sx * Math.min(amt, 0.45) * (back ? -0 : 1), hy + sy * Math.min(amt, 0.45) * (back ? -0 : 1)];
}

const toGrid = (px, py) => [(px - view.ox) / view.s, (py - view.oy) / view.s];

function startAt(gx, gy) {
  const done = solvedOf(cur);
  let best = -1, bd = 0.55;
  room.panels.forEach((p, i) => {
    if (done.has(i)) return;
    const d = Math.hypot(gx - p.s[0], gy - p.s[1]);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

function gateRect() { // in grid units
  return [room.w / 2 - 0.7, -WALL - 0.7, room.w / 2 + 0.7, -WALL + 0.6];
}

let pid = null;
cv.addEventListener('pointerdown', (e) => {
  if (endOn) { if (now() - endT > 2500) endOn = false; return; }
  if (titleOn) return;
  snd.start();
  const [gx, gy] = toGrid(e.clientX, e.clientY);
  const pi = startAt(gx, gy);
  if (pi >= 0) {
    pid = e.pointerId;
    try { cv.setPointerCapture(pid); } catch {}
    begin(pi);
    return;
  }
  const g = gateRect();
  if (complete(cur) && gx > g[0] && gx < g[2] && gy > g[1] && gy < g[3]) { throughGate(); return; }
  // tapped a panel but not its start: show where lines begin
  const done = solvedOf(cur);
  const hit = room.panels.findIndex((p, i) => !done.has(i) && gx >= p.r[0] - 0.3 && gx <= p.r[2] + 0.3 && gy >= p.r[1] - 0.3 && gy <= p.r[3] + 0.3);
  poke = { pi: hit, t0: now() };
});
cv.addEventListener('pointermove', (e) => {
  if (!drawing || e.pointerId !== pid) { hoverCursor(e); return; }
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of evs.length ? evs : [e]) follow(...toGrid(ev.clientX, ev.clientY));
});
const up = (e) => {
  if (!drawing || e.pointerId !== pid) return;
  pid = null;
  const p = room.panels[drawing.pi];
  const [hx, hy] = drawing.path[drawing.path.length - 1];
  if (hx === p.e[0] && hy === p.e[1]) submit(); else cancel();
};
cv.addEventListener('pointerup', up);
// a cancelled touch that had already reached the exit still counts
cv.addEventListener('pointercancel', up);

function hoverCursor(e) {
  if (titleOn) return;
  const [gx, gy] = toGrid(e.clientX, e.clientY);
  const g = gateRect();
  const over = startAt(gx, gy) >= 0 || (complete(cur) && gx > g[0] && gx < g[2] && gy > g[1] && gy < g[3]);
  cv.style.cursor = over ? 'pointer' : 'default';
}

function throughGate() {
  if (cur === ROOMS.length - 1) { endOn = true; endT = now(); return; }
  enterRoom(cur + 1);
}

// ---- keyboard: Tab picks a panel, arrows draw, Enter plants, Z is the fountain
addEventListener('keydown', (e) => {
  if (titleOn) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeTitle(); } return; }
  if (endOn) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { endOn = false; } return; }
  const done = solvedOf(cur);
  const open_ = room.panels.map((_, i) => i).filter((i) => !done.has(i));
  const k = e.key;
  if (k === 'Tab') {
    e.preventDefault(); cancel();
    if (!open_.length) return;
    const at = open_.indexOf(selected);
    selected = open_[(at + (e.shiftKey ? open_.length - 1 : 1)) % open_.length];
    if (at < 0 && !e.shiftKey) selected = open_[0];
    return;
  }
  const dirs = { ArrowUp: 0, w: 0, W: 0, ArrowRight: 1, d: 1, D: 1, ArrowDown: 2, s: 2, S: 2, ArrowLeft: 3, a: 3, A: 3 };
  if (k in dirs) {
    e.preventDefault();
    if (!drawing) {
      if (!open_.includes(selected)) selected = open_[0] ?? -1;
      if (selected < 0) return;
      begin(selected);
    }
    const [hx, hy] = drawing.path[drawing.path.length - 1];
    const [dx, dy] = STEP[dirs[k]];
    stepTo(hx + dx, hy + dy);
    drawing.tip = null;
    return;
  }
  if (k === 'Enter' || k === ' ') {
    e.preventDefault();
    if (drawing) {
      const p = room.panels[drawing.pi], [hx, hy] = drawing.path[drawing.path.length - 1];
      if (hx === p.e[0] && hy === p.e[1]) submit();
    } else if (complete(cur)) throughGate();
    return;
  }
  if (k === 'Backspace') {
    e.preventDefault();
    if (drawing && drawing.path.length > 1) { const p = drawing.path[drawing.path.length - 2]; stepTo(p[0], p[1]); }
    else cancel();
    return;
  }
  if (k === 'Escape') { cancel(); return; }
  if (k === 'z' || k === 'Z' || k === 'u') { fountain(); return; }
  if (k === ']' && cur < save.reach) { enterRoom(cur + 1); return; }
  if (k === '[' && cur > 0) { enterRoom(cur - 1); return; }
});

// ---- the walk: fountain, rooms, sound
const ICONS = [
  '<path d="M7 15h16" stroke="#2c4725" stroke-width="4.5" stroke-linecap="round"/><circle cx="7" cy="15" r="4" fill="#efe8d6" stroke="#a39572" stroke-width="1.5"/>',
  '<path d="M15 8.5l5.6 3.25v6.5L15 21.5l-5.6-3.25v-6.5z" fill="#3a3a30"/>',
  '<circle cx="10.5" cy="15" r="5" fill="#f5f2ea" stroke="#bdb5a4"/><circle cx="20" cy="15" r="5" fill="#3b4147"/>',
  '<g fill="#df6a58"><ellipse cx="15" cy="9" rx="2.8" ry="5"/><ellipse cx="15" cy="9" rx="2.8" ry="5" transform="rotate(120 15 15)"/><ellipse cx="15" cy="9" rx="2.8" ry="5" transform="rotate(240 15 15)"/></g><circle cx="15" cy="15" r="2.6" fill="#f2c24f"/>',
  '<circle cx="15" cy="15" r="9" fill="#5f8f9a" stroke="#b7ab8d" stroke-width="3"/><circle cx="15" cy="15" r="3" fill="#d9eef0"/>',
];
function renderRooms() {
  const el = $('rooms');
  if (el.children.length !== ROOMS.length) {
    el.innerHTML = '';
    ROOMS.forEach((_, i) => {
      const b = document.createElement('button');
      b.className = 'disc room';
      b.setAttribute('aria-label', `Garden room ${i + 1}`);
      b.innerHTML = `<svg viewBox="0 0 30 30" aria-hidden="true">${ICONS[i % ICONS.length]}</svg><svg class="ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18.5" fill="none" stroke="#2c4725" stroke-width="2.2" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100" transform="rotate(-90 20 20)"/></svg>`;
      b.addEventListener('click', () => { if (i !== cur && i <= save.reach) { snd.start(); enterRoom(i); } });
      el.appendChild(b);
    });
  }
  [...el.children].forEach((b, i) => {
    b.classList.toggle('locked', i > save.reach);
    b.classList.toggle('here', i === cur);
    const f = save.solved[i].length / ROOMS[i].panels.length;
    b.querySelector('.ring circle').setAttribute('stroke-dasharray', `${(f * 100).toFixed(1)} 100`);
  });
}
$('fount').addEventListener('click', () => { snd.start(); fountain(); });
const sndBtn = $('snd');
sndBtn.classList.toggle('off', !snd.on);
sndBtn.addEventListener('click', () => { snd.start(); sndBtn.classList.toggle('off', !snd.toggle()); });

function closeTitle() {
  if (!titleOn) return;
  titleOn = false; titleT = now();
  $('title').classList.add('going');
  setTimeout(() => $('title').hidden = true, 700);
  snd.start();
}
$('title').addEventListener('pointerdown', (e) => { e.preventDefault(); closeTitle(); });
$('title').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeTitle(); } });
if (!titleOn) $('title').hidden = true;

// ---- baking the still parts
function bake() {
  const { W, H: Hh, dpr } = view;
  if (!W) return;
  ground = ground || document.createElement('canvas');
  hedges = hedges || document.createElement('canvas');
  for (const c of [ground, hedges]) { c.width = cv.width; c.height = cv.height; }
  const g = ground.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawGround(g, room, view, solvedOf(cur), W, Hh);
  const h = hedges.getContext('2d');
  h.setTransform(dpr, 0, 0, dpr, 0, 0);
  h.clearRect(0, 0, W, Hh);
  drawHedges(h, room, view, save.solved[cur].filter((e) => !growing || e.path !== growing.path));
}

function drawGround(g, rm, v, done, W, Hh) {
  const s = v.s, x0 = v.ox, y0 = v.oy, gw = s * 0.3;
  const px = (x) => v.ox + x * s, py = (y) => v.oy + y * s;
  g.fillStyle = g.createPattern(R.speckle('terrace', R.C.terrace, ['#b8aa86', '#d9cdb0', '#a89a77', '#e4dac2'], 0.9), 'repeat');
  g.fillRect(0, 0, W, Hh);
  // the room inside its wall: gravel, then the lawn beds
  const m = WALL * s;
  g.fillStyle = g.createPattern(R.speckle('gravel', R.C.gravel, ['#c8bb9b', '#ebe3cf', '#b9ab88', '#f3ede0'], 0.8), 'repeat');
  g.fillRect(x0 - m, y0 - m, rm.w * s + 2 * m, rm.h * s + 2 * m);
  for (let cy = 0; cy < rm.h; cy++) for (let cx = 0; cx < rm.w; cx++) {
    const lx = px(cx) + gw / 2, ly = py(cy) + gw / 2, ls = s - gw;
    g.fillStyle = (cx + cy) % 2 ? R.C.lawn : R.C.lawn2;
    g.fillRect(lx, ly, ls, ls);
    // mowing stripes
    g.fillStyle = 'rgba(255,255,230,.07)';
    for (let k = 0; k < 4; k += 2) g.fillRect(lx + (ls / 4) * k, ly, ls / 4, ls);
    // a little lip where the bed meets the gravel
    g.fillStyle = 'rgba(40,60,25,.35)';
    g.fillRect(lx, ly, ls, Math.max(1, s * 0.03)); g.fillRect(lx, ly, Math.max(1, s * 0.03), ls);
    g.fillStyle = 'rgba(255,255,240,.18)';
    g.fillRect(lx, ly + ls - Math.max(1, s * 0.025), ls, Math.max(1, s * 0.025));
  }
  // exit nubs: a short walk out of each panel
  rm.panels.forEach((p, i) => {
    if (done.has(i)) return; // a planted hedge has taken the walk out
    const [dx, dy] = DIRS[exitDir(p)];
    const ex = px(p.e[0]), ey = py(p.e[1]);
    g.save(); g.lineCap = 'round';
    g.strokeStyle = '#efe7d3'; g.lineWidth = gw * 0.92;
    g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + dx * s * 0.42, ey + dy * s * 0.42); g.stroke();
    g.strokeStyle = 'rgba(120,105,70,.5)'; g.lineWidth = Math.max(1, s * 0.02);
    g.beginPath(); g.arc(ex + dx * s * 0.42, ey + dy * s * 0.42, gw * 0.46, 0, 7); g.stroke();
    g.restore();
  });
  // stone kerbs at the corners of every unsolved panel
  rm.panels.forEach((p, i) => {
    if (done.has(i) || p.r[0] === p.r[2] || p.r[1] === p.r[3]) return;
    const [a, b, c, d] = p.r, L = s * 0.32, k = s * 0.07;
    g.save(); g.lineCap = 'square'; g.strokeStyle = 'rgba(30,40,20,.3)'; g.lineWidth = k * 1.1;
    const corners = [[a, b, 1, 1], [c, b, -1, 1], [a, d, 1, -1], [c, d, -1, -1]];
    for (let pass = 0; pass < 2; pass++) {
      g.strokeStyle = pass ? R.C.stone : 'rgba(30,40,20,.3)';
      for (const [x, y, sx, sy] of corners) {
        const ox = pass ? 0 : k * 0.4, oy = pass ? 0 : k * 0.6;
        const cx = px(x) - sx * gw * 0.62 + ox, cy = py(y) - sy * gw * 0.62 + oy;
        g.beginPath(); g.moveTo(cx + sx * L, cy); g.lineTo(cx, cy); g.lineTo(cx, cy + sy * L); g.stroke();
      }
    }
    g.restore();
  });
  // the clipped wall round the room, with a gap for the gate at the top
  const wl = -WALL + 0.12, wr = rm.w + WALL - 0.12, wt = -WALL + 0.12, wb = rm.h + WALL - 0.12;
  const gl = rm.w / 2 - 0.55, gr = rm.w / 2 + 0.55;
  const ww = s * 0.42;
  const seg = [[[gr, wt], [wr, wt], [wr, wb], [wl, wb], [wl, wt], [gl, wt]]];
  for (const sg of seg) R.hedge(g, sg.map(([x, y]) => [px(x), py(y)]), ww, 91, { old: true });
  // stone piers either side of the gate, urns on the outer corners
  for (const gx of [gl, gr]) {
    g.fillStyle = 'rgba(30,40,20,.35)'; g.fillRect(px(gx) - s * 0.16, py(wt) - s * 0.16 + s * 0.07, s * 0.34, s * 0.34);
    g.fillStyle = R.C.stone; g.fillRect(px(gx) - s * 0.18, py(wt) - s * 0.18, s * 0.36, s * 0.36);
    g.fillStyle = '#d8cdb2'; g.fillRect(px(gx) - s * 0.1, py(wt) - s * 0.1, s * 0.2, s * 0.2);
  }
  const ur = s * 0.34;
  [[wl - 0.62, wt - 0.62], [wr + 0.62, wt - 0.62], [wl - 0.62, wb + 0.62], [wr + 0.62, wb + 0.62]].forEach(([x, y], i) => {
    if (px(x) - ur > 0 && px(x) + ur < W) R.urn(g, px(x), py(y), ur, 40 + i);
  });
}

function drawHedges(h, rm, v, entries) {
  const s = v.s, w = s * 0.34;
  const px = (x) => v.ox + x * s, py = (y) => v.oy + y * s;
  (rm.fixed || []).forEach((p, i) => R.hedge(h, p.map(([x, y]) => [px(x), py(y)]), w, 200 + i, { old: true }));
  for (const e of entries) R.hedge(h, e.path.map(([x, y]) => [px(x), py(y)]), w, 300 + e.p * 17, { ball: true });
}

// ---- every frame
function frame(t) {
  requestAnimationFrame(frame);
  if (!ground) return;
  const { W, H: Hh, dpr, s } = view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(ground, 0, 0, W, Hh);
  const T = now();
  const done = solvedOf(cur);

  drawSymbols(T);
  ctx.drawImage(hedges, 0, 0, W, Hh);

  if (growing) {
    const k = Math.min(1, (T - growing.t0) / growing.dur);
    const pts = growing.path.map(([x, y]) => [X(x), Y(y)]);
    // the line is still glowing where the hedge hasn't reached yet
    drawLine(pts, null, 1 - k * 0.6, false);
    R.hedge(ctx, pts, s * 0.34, 300 + growing.pi * 17, { upto: R.polyLen(pts) * easeOut(k), ball: k > 0.05 });
    if (k >= 1) { growing = null; bake(); }
  }
  if (wither) {
    const k = Math.min(1, (T - wither.t0) / 700);
    const pts = wither.path.map(([x, y]) => [X(x), Y(y)]);
    R.hedge(ctx, pts, s * 0.34 * (1 - k * 0.5), 5, { alpha: 1 - k });
    if (k >= 1) wither = null;
  }

  // start circles of the open panels
  room.panels.forEach((p, i) => {
    if (done.has(i)) return;
    const dead = stuck.has(i);
    const pk = poke && poke.pi === i ? Math.max(0, 1 - (T - poke.t0) / 900) : 0;
    const glow = dead ? 0 : 0.45 + 0.35 * Math.sin(T / 520 + i) + pk * 1.5;
    R.plinth(ctx, X(p.s[0]), Y(p.s[1]), s, { glow, dead, lit: drawing && drawing.pi === i });
  });
  if (poke && T - poke.t0 > 900) poke = null;

  // the panel in hand: everything else dims
  const focus = drawing ? drawing.pi : selected >= 0 && !done.has(selected) ? selected : -1;
  if (focus >= 0) {
    const p = room.panels[focus], pad = s * 0.24;
    const [a, b, c, d] = [X(p.r[0]) - pad, Y(p.r[1]) - pad, X(p.r[2]) + pad, Y(p.r[3]) + pad];
    ctx.save();
    ctx.fillStyle = drawing ? 'rgba(24,34,16,.3)' : 'rgba(24,34,16,.16)';
    ctx.beginPath(); ctx.rect(0, 0, W, Hh); ctx.rect(a, b, c - a, d - b); ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(255,244,207,.55)'; ctx.lineWidth = Math.max(1.5, s * 0.03); ctx.setLineDash([s * 0.12, s * 0.1]);
    ctx.strokeRect(a, b, c - a, d - b);
    ctx.restore();
  }

  ghost(T);

  for (const f of fading) {
    const k = (T - f.t0) / (f.bad ? 1300 : 450);
    if (k >= 1) continue;
    drawLine(f.path.map(([x, y]) => [X(x), Y(y)]).concat(f.tip ? [[X(f.tip[0]), Y(f.tip[1])]] : []), null, (1 - k) * (f.bad ? 1 : 0.7), f.bad);
  }
  fading = fading.filter((f) => (T - f.t0) / (f.bad ? 1300 : 450) < 1);
  if (drawing) {
    const pts = drawing.path.map(([x, y]) => [X(x), Y(y)]);
    if (drawing.tip) pts.push([X(drawing.tip[0]), Y(drawing.tip[1])]);
    drawLine(pts, null, 1, false);
  }

  drawGate(T);

  if (fadeIn) {
    const k = (T - fadeIn) / 500;
    if (k >= 1) fadeIn = 0;
    else { ctx.fillStyle = `rgba(201,188,155,${1 - easeOut(k)})`; ctx.fillRect(0, 0, W, Hh); }
  }
  if (titleOn || T - titleT < 700) drawTitle(T);
  if (endOn) drawEnd(T);
}
const easeOut = (k) => 1 - (1 - k) ** 3;

function drawLine(pts, _, alpha, bad) {
  const s = view.s;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = bad ? 'rgba(80,30,20,.35)' : 'rgba(46,62,30,.55)';
  ctx.lineWidth = s * 0.27;
  ctx.save(); ctx.translate(s * 0.02, s * 0.05); stroke(pts); ctx.restore();
  ctx.strokeStyle = bad ? '#7d3a2c' : '#f6c94a';
  ctx.shadowColor = bad ? 'transparent' : 'rgba(255,214,110,.95)';
  ctx.shadowBlur = s * 0.3;
  ctx.lineWidth = s * 0.2;
  stroke(pts);
  ctx.shadowBlur = 0;
  if (!bad) { ctx.strokeStyle = '#fff8dc'; ctx.lineWidth = s * 0.08; stroke(pts); }
  ctx.shadowBlur = 0;
  ctx.fillStyle = bad ? '#7d3a2c' : '#f6c94a';
  ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], s * 0.19, 0, 7); ctx.fill();
  if (!bad) { ctx.fillStyle = '#fff8dc'; ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], s * 0.1, 0, 7); ctx.fill(); }
  ctx.restore();
}
function stroke(pts) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (pts.length === 1) ctx.lineTo(pts[0][0] + 0.01, pts[0][1]);
  ctx.stroke();
}

function drawSymbols(T) {
  const s = view.s;
  const fk = flash ? Math.max(0, 1 - (T - flash.t0) / 1400) : 0;
  if (flash && fk <= 0) flash = null;
  const blink = fk > 0 && Math.floor((T - flash.t0) / 180) % 2 === 0;
  const ring = (x, y, r) => {
    ctx.save(); ctx.strokeStyle = R.C.bad; ctx.lineWidth = Math.max(2, s * 0.05); ctx.globalAlpha = blink ? 1 : 0.45;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.restore();
  };
  room.dots.forEach(([x, y], i) => {
    if (H.verts.has(key(x, y))) return;
    const lit = drawing && drawing.seen.has(key(x, y));
    R.stud(ctx, X(x), Y(y), s, lit);
    if (flash && flash.bad.dots.includes(i)) ring(X(x), Y(y), s * 0.17);
  });
  room.stones.forEach(([cx, cy, c], i) => {
    R.pebble(ctx, X(cx + 0.5), Y(cy + 0.5), s, c === 1);
    if (flash && flash.bad.stones.includes(i)) ring(X(cx + 0.5), Y(cy + 0.5), s * 0.27);
  });
  room.petals.forEach(([cx, cy, n], i) => {
    R.flower(ctx, X(cx + 0.5), Y(cy + 0.5), s, n);
    if (flash && flash.bad.petals.includes(i)) ring(X(cx + 0.5), Y(cy + 0.5), s * 0.32);
  });
}

// A soft light that walks a line for you: the whole way on the first panel of the
// garden, and part of the way on any panel you've missed a few times.
function ghost(T) {
  if (drawing || growing || titleOn) return;
  const done = solvedOf(cur);
  let pi = -1, frac = 0;
  if (cur === 0 && !done.has(0)) { pi = 0; frac = 1; }
  else {
    for (const [k, n] of Object.entries(fails)) {
      const [r, p] = k.split(':').map(Number);
      if (r !== cur || done.has(p) || n < 3 || stuck.has(p)) continue;
      const f = n >= 8 ? 1 : n >= 5 ? 0.66 : 0.34;
      if (f > frac) { frac = f; pi = p; }
    }
  }
  if (pi < 0) return;
  const line = hintLine(pi);
  if (!line) return;
  const pts = line.slice(0, Math.max(2, Math.ceil(line.length * frac))).map(([x, y]) => [X(x), Y(y)]);
  const L = R.polyLen(pts), per = 700 + L * 3.2;
  const k = ((T % (per + 900)) / per);
  if (k > 1) return;
  const at = R.cut(pts, L * easeOut(k));
  ctx.save();
  ctx.globalAlpha = 0.5 * Math.min(1, (1 - k) * 4);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = R.C.glow; ctx.lineWidth = view.s * 0.1; ctx.setLineDash([view.s * 0.02, view.s * 0.16]);
  stroke(at);
  const [fx, fy] = at[at.length - 1];
  ctx.setLineDash([]);
  if (frac === 1 && cur === 0) { // a fingertip on the first one
    ctx.globalAlpha = 0.7 * Math.min(1, (1 - k) * 4);
    ctx.fillStyle = 'rgba(255,250,235,.9)';
    ctx.beginPath(); ctx.arc(fx, fy, view.s * 0.2, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(60,70,40,.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(fx, fy, view.s * 0.2, 0, 7); ctx.stroke();
  }
  ctx.restore();
}
const hintCache = new Map();
function hintLine(pi) {
  const k = cur + ':' + pi + ':' + save.solved[cur].map((e) => e.p).join(',');
  if (hintCache.has(k)) return hintCache.get(k);
  const p = room.panels[pi], sol = room.sols[pi];
  const line = sol && judge(room, p, sol, H).ok && sol.every(([x, y], i) => i === 0 ? open(p, H, x, y) : true) && validWalk(p, sol) ? sol : findLine(room, p, H, 60000);
  hintCache.set(k, line || null);
  return line;
}
function validWalk(p, line) {
  const seen = new Set([key(...line[0])]);
  for (let i = 1; i < line.length; i++) {
    if (!canStep(p, H, line.slice(0, i), seen, line[i][0], line[i][1])) return false;
    seen.add(key(...line[i]));
  }
  return true;
}

function drawGate(T) {
  const s = view.s, wt = -WALL + 0.12;
  const gl = room.w / 2 - 0.55, gr = room.w / 2 + 0.55;
  const open_ = complete(cur) && !growing;
  const k = open_ ? Math.min(1, Math.max(0, (T - gateT) / 900)) : 0;
  const y = Y(wt);
  ctx.save();
  ctx.strokeStyle = '#2a2a26'; ctx.lineWidth = Math.max(2, s * 0.05); ctx.lineCap = 'round';
  // two iron leaves on hinges at the piers, swinging outward
  for (const [hx, dir] of [[gl, 1], [gr, -1]]) {
    const a = -k * 1.25 * dir;
    const len = (gr - gl) / 2 * s - s * 0.16;
    const x0 = X(hx) + dir * s * 0.16;
    const ex = x0 + Math.cos(a) * len * dir, ey = y + Math.sin(a) * len * dir * dir;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(ex, ey); ctx.stroke();
    for (let b = 1; b <= 3; b++) {
      const bx = x0 + (ex - x0) * b / 4, by = y + (ey - y) * b / 4;
      ctx.beginPath(); ctx.arc(bx, by, s * 0.035, 0, 7); ctx.fillStyle = '#2a2a26'; ctx.fill();
    }
  }
  if (open_ && cur < ROOMS.length) {
    const pulse = 0.5 + 0.5 * Math.sin(T / 400);
    ctx.fillStyle = `rgba(255,244,207,${0.25 + 0.3 * pulse * k})`;
    ctx.beginPath(); ctx.ellipse(X(room.w / 2), y - s * 0.35, s * 0.45, s * 0.28, 0, 0, 7); ctx.fill();
    // footprints of light leading on
    ctx.fillStyle = `rgba(255,250,230,${0.8 * k})`;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(X(room.w / 2), y - s * (0.2 + i * 0.22), s * 0.05, 0, 7); ctx.fill(); }
  }
  ctx.restore();
}

// ---- the name, planted in yew
function titleLayout() {
  const word = 'HEDGES', { W, H: Hh } = view;
  const u = Math.min((W * 0.82) / (word.length * 3 - 1), (Hh * 0.22) / 4, 44);
  const x0 = (W - u * (word.length * 3 - 1)) / 2, y0 = Hh * 0.3 - u * 2;
  return { word, u, x0, y0 };
}
function drawTitle(T) {
  const { W, H: Hh } = view;
  const a = titleOn ? 1 : Math.max(0, 1 - (T - titleT) / 700);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = ctx.createPattern(R.speckle('gravel', R.C.gravel, ['#c8bb9b', '#ebe3cf', '#b9ab88', '#f3ede0'], 0.8), 'repeat');
  ctx.fillRect(0, 0, W, Hh);
  const { word, u, x0, y0 } = titleLayout();
  // a lawn bed under the letters
  ctx.fillStyle = R.C.lawn;
  ctx.fillRect(x0 - u * 1.2, y0 - u * 1.2, u * (word.length * 3 - 1) + u * 2.4, u * 6.4);
  ctx.fillStyle = 'rgba(255,255,230,.07)';
  for (let k = 0; k < word.length * 3 + 2; k += 2) ctx.fillRect(x0 - u * 1.2 + k * u, y0 - u * 1.2, u, u * 6.4);
  [...word].forEach((ch, i) => {
    const lx = x0 + i * 3 * u;
    R.LETTERS[ch].forEach((pl, j) => R.hedge(ctx, pl.map(([x, y]) => [lx + x * u, y0 + y * u]), u * 0.62, 500 + i * 10 + j));
  });
  // a start circle below, breathing
  const cx = W / 2, cy = y0 + u * 4 + Math.min(Hh * 0.2, u * 5);
  const s = Math.max(view.s, 56);
  R.plinth(ctx, cx, cy, s * 1.3, { glow: 0.6 + 0.4 * Math.sin(T / 500) });
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---- the end: the whole garden from above
function drawEnd(T) {
  const { W, H: Hh } = view;
  const a = Math.min(1, (T - endT) / 1200);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = ctx.createPattern(R.speckle('terrace', R.C.terrace, ['#b8aa86', '#d9cdb0', '#a89a77', '#e4dac2'], 0.9), 'repeat');
  ctx.fillRect(0, 0, W, Hh);
  // rooms laid out as a plan: two above, the centre in the middle, two below
  const n = ROOMS.length;
  const cols = W > Hh * 1.3 ? n : W > Hh ? 3 : 2;
  const rows = Math.ceil(n / cols);
  const top = Math.min(Hh * 0.24, 170);
  const cw = (W - 40) / cols, ch = (Hh - top - 100) / rows;
  // the name again, small, over the plan
  const u = Math.min(W * 0.6 / 17, top * 0.6 / 4, 22);
  const tx = (W - u * 17) / 2, ty = top * 0.5 - u * 2 + 10;
  [...'HEDGES'].forEach((chr, i) => R.LETTERS[chr].forEach((pl, j) => R.hedge(ctx, pl.map(([x, y]) => [tx + i * 3 * u + x * u, ty + y * u]), u * 0.62, 500 + i * 10 + j)));
  ROOMS.forEach((rm, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const span = (cols === 2 && i === n - 1 && n % 2) ? 2 : 1;
    const bw = cw * span;
    const s = Math.min((bw - 20) / (rm.w + 1.6), (ch - 20) / (rm.h + 1.6));
    const v = { s, ox: 20 + c * cw + (bw - rm.w * s) / 2, oy: top + r * ch + (ch - rm.h * s) / 2 };
    const k = Math.min(1, Math.max(0, (T - endT - i * 300) / 900));
    ctx.globalAlpha = a * k;
    drawGround(ctx, rm, v, new Set(rm.panels.map((_, j) => j)), 0, 0);
    drawHedges(ctx, rm, v, save.solved[i]);
  });
  ctx.restore();
}

// ---- start
function demo() {
  // the centre room part-way through, with a line being drawn
  const i = ROOMS.length - 1;
  for (let r = 0; r < i; r++) save.solved[r] = ROOMS[r].panels.map((_, p) => ({ p, path: ROOMS[r].sols[p] }));
  const rm = ROOMS[i];
  const upto = Math.max(1, rm.panels.length - 2);
  save.solved[i] = rm.panels.slice(0, upto).map((_, p) => ({ p, path: rm.sols[p] }));
  save.reach = i;
  enterRoom(i, false);
  const sol = rm.sols[upto];
  begin(upto);
  for (let k = 1; k < Math.ceil(sol.length * 0.6); k++) stepTo(...sol[k]);
}

addEventListener('resize', () => layout());
enterRoom(cur, false);
if (DEMO) demo();
requestAnimationFrame(frame);
window.toyboxReady?.();

if (DEBUG) {
  window.hg = {
    get state() { return { cur, save, stuck: [...stuck], drawing, fails }; },
    ROOMS, enterRoom, fountain,
    solve(pi, line) { const p = room.panels[pi]; line = line || findLine(room, p, H, 200000); if (!line) return false; begin(pi); for (let k = 1; k < line.length; k++) stepTo(...line[k]); submit(); return true; },
    draw(pi, line) { begin(pi); for (let k = 1; k < line.length; k++) stepTo(...line[k]); },
    submit, closeTitle, reset() { localStorage.removeItem(SAVE); location.reload(); },
    view: () => view,
    line(pi) { return findLine(room, room.panels[pi], H, 500000); },
    px(x, y) { return [X(x), Y(y)]; },
    get cur() { return cur; },
    gate() { return [X(room.w / 2), Y(-WALL + 0.12)]; },
  };
}
