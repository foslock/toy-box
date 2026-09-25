// All Hands: a cutaway of a starship and the crew who keep it going, watch after watch.
// Owns the camera (the whole ship, one room, or following one person), input, the space outside, the
// glow pass, and the panels: systems, FTL drive, crew roster and the crew card.
import { makeShip, deckTop, floorY } from './ship.js';
import { paintShip } from './paint.js';
import { makeSim, WATCHES, short, title } from './sim.js';
import { drawWorld, stepVfx, vfx, drawSelection, drawRoomFrame, drawRepairBar } from './draw.js';
import { glowTex, mk, ctx2d, clamp, lerp, rng, hash } from './util.js';
import { crewSprite, DEPT, clearSpriteCache, CAT, DROID } from './sprites.js';
import { ICON_COL, iconPixels } from './rooms.js';

const $ = id => document.getElementById(id);
const cv = $('c'), g = cv.getContext('2d');
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let dpr = 1, T = 0, speed = clamp(+params.get('speed') || 1, .25, 60);
let ship, painted, sim, dyn, dg, seed;

/* ---------- building a ship ---------- */
function parseTime(s) { const m = /^(\d{1,2})(?::?(\d{2}))?$/.exec(s || ''); return m ? (+m[1] % 24) * 60 + (+(m[2] || 0)) : null; }
function build(s, keepView) {
  seed = s >>> 0;
  vfx.length = 0; clearSpriteCache();
  ship = makeShip(seed); painted = paintShip(ship);
  const start = parseTime(params.get('time')) ?? (6 * 60 + ((seed % 1000) / 1000) * 16 * 60);
  sim = makeSim(ship, painted, seed, 1440 + start);
  for (let i = 0; i < 90; i++) sim.update(1 / 30);
  dyn = mk(ship.width, ship.height); dg = ctx2d(dyn);
  selected = null; following = false; hovered = null;
  $('shipName').textContent = `${ship.reg.split('-')[0] === 'BC' ? 'ISS' : ship.reg.split('-')[0] === 'FF' ? 'ISV' : 'RSV'} ${ship.name}`;
  $('shipClass').textContent = `${ship.cls}-class ${ship.role} · ${ship.reg}`;
  buildSystems(); buildRoster();
  const u = new URL(location.href); u.searchParams.set('ship', seed); history.replaceState(null, '', u);
  if (!keepView) setView('all', null, true);
  updateCard(); updateBar();
}

/* ---------- camera ---------- */
const cam = { x: 0, y: 0, z: 1, tw: null };
let view = { mode: 'all', room: null }, selected = null, following = false, hovered = null, hoverCrew = null, interacted = false;
const INSET = { top: 70, bottom: 100, side: 16 };
function shipBox() {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  ship.rows.forEach((r, y) => { if (r) { x0 = Math.min(x0, r[0]); x1 = Math.max(x1, r[1]); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } });
  for (const e of ship.engines) x0 = Math.min(x0, e.x - 10 - e.len - 24);
  return { x0: x0 - 6, y0: y0 - 18, x1: x1 + 10, y1: y1 + 8 };
}
function fit(x0, y0, x1, y1, pad, snap) {
  const cw = cv.width, ch = cv.height, top = (INSET.top + pad) * dpr, bot = (INSET.bottom + pad) * dpr, side = (INSET.side + pad) * dpr;
  let z = Math.min((cw - side * 2) / (x1 - x0), (ch - top - bot) / (y1 - y0));
  if (snap) { const n = Math.floor(z); if (n >= 2 && n / z > .82) z = n; }
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 - (top - bot) / 2 / z, z };
}
const overview = () => { const b = shipBox(); return fit(b.x0, b.y0, b.x1, b.y1, 6, false); };
function roomView(r) {
  let x0 = r.x0 - 3, x1 = r.x1 + 3;
  const minW = 132; if (x1 - x0 < minW) { const c = (x0 + x1) / 2; x0 = c - minW / 2; x1 = c + minW / 2; }
  return fit(x0, deckTop(r.d0) + 1, x1, floorY(r.d1) + 5, 18, true);
}
function goal() {
  if (view.mode === 'room') return roomView(view.room);
  if (view.mode === 'follow' && selected) { const r = roomOfCrew(selected), v = r ? roomView(r) : { z: cam.z }; return { x: selected.x, y: selected.y - 12, z: v.z }; }
  return overview();
}
function setView(mode, room, instant) {
  view = { mode, room: room || null };
  if (mode !== 'follow') following = false;
  const to = goal();
  if (instant || reduced) { cam.x = to.x; cam.y = to.y; cam.z = to.z; cam.tw = null; }
  else cam.tw = { a: { ...cam }, b: to, t: 0, dur: mode === 'all' ? 1.1 : .9 };
  updateBar();
}
function stepCam(dt) {
  if (view.mode === 'follow' && selected && !cam.tw) {
    const to = goal(), k = 1 - Math.exp(-dt * 4);
    cam.x = lerp(cam.x, to.x, k); cam.y = lerp(cam.y, to.y, k); cam.z = Math.exp(lerp(Math.log(cam.z), Math.log(to.z), k * .5));
    return;
  }
  const w = cam.tw; if (!w) return;
  w.t += dt;
  const u = Math.min(1, w.t / w.dur), e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  if (view.mode === 'follow' && selected) w.b = goal();
  const { a, b } = w, z = Math.exp(lerp(Math.log(a.z), Math.log(b.z), e));
  if (Math.abs(a.z - b.z) / b.z > .02) {
    // keep one point fixed on screen so a room grows out of where it sits
    const fx = (a.x * a.z - b.x * b.z) / (a.z - b.z), fy = (a.y * a.z - b.y * b.z) / (a.z - b.z);
    cam.x = fx - (fx - a.x) * a.z / z; cam.y = fy - (fy - a.y) * a.z / z;
    const far = clamp((Math.hypot(fx - a.x, fy - a.y) * a.z / Math.max(cv.width, cv.height) - 1.2) / 2, 0, 1);
    cam.x = lerp(cam.x, lerp(a.x, b.x, e), far); cam.y = lerp(cam.y, lerp(a.y, b.y, e), far);
  } else { cam.x = lerp(a.x, b.x, e); cam.y = lerp(a.y, b.y, e); }
  cam.z = z;
  if (u >= 1) { cam.x = b.x; cam.y = b.y; cam.z = b.z; cam.tw = null; }
}
const toWorld = (sx, sy) => ({ x: cam.x + (sx * dpr - cv.width / 2) / cam.z, y: cam.y + (sy * dpr - cv.height / 2) / cam.z });
const roomAtWorld = (x, y) => {
  for (const r of ship.rooms) if (x >= r.x0 && x < r.x1 && y >= deckTop(r.d0) && y < floorY(r.d1) + 4) return r.type === 'junction' ? r : r;
  return null;
};
const roomOfCrew = c => c.mode === 'flying' ? ship.hangar : ship.roomAt(c.d, c.x) || null;

/* ---------- picking crew under the pointer ---------- */
function crewAt(x, y) {
  let best = null, bd = 1e9;
  const pad = Math.max(1.5, 6 / cam.z * dpr);
  const all = [...sim.crew.filter(c => c.mode !== 'flying'), ...sim.agents, ...(sim.prisoner ? [sim.prisoner] : [])];
  for (const c of all) {
    const lying = c.mode === 'act' && c.st && (c.st.act === 'sleep' || c.st.act === 'patient') || c.mode === 'sleep';
    const bx = lying ? c.x - 6 : c.x - 4, by = lying ? c.y - 5 : c.y - (c.kind ? 6 : 14), bw = lying ? 12 : 8, bh = lying ? 5 : c.kind ? 6 : 14;
    const dx = Math.max(bx - x, 0, x - (bx + bw)), dy = Math.max(by - y, 0, y - (by + bh)), d = Math.hypot(dx, dy);
    if (d <= pad && d < bd) { bd = d; best = c; }
  }
  return best;
}

/* ---------- input ---------- */
const pts = new Map();
let drag = null, pinch = null;
const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
function click(sx, sy) {
  interacted = true;
  const w = toWorld(sx, sy), r = roomAtWorld(w.x, w.y);
  const zoomed = cam.z >= overview().z * 2.2;
  if (zoomed) {
    const c = crewAt(w.x, w.y);
    if (c) { select(c); return; }
  }
  if (view.mode === 'room' || view.mode === 'follow') {
    const cur = view.mode === 'room' ? view.room : roomOfCrew(selected);
    if (!r || r !== cur) { if (view.mode === 'follow' && r && r.type !== 'junction') return enterRoom(r); return setView('all'); }
    if (selected) { selected = null; updateCard(); }
    return;
  }
  if (r) enterRoom(r.type === 'junction' ? r : r);
  else if (view.mode !== 'all') setView('all');
}
function enterRoom(r) { following = false; setView('room', r); }
function select(c) { selected = c; updateCard(); if (following) setView('follow'); }
function hover(sx, sy) {
  const w = toWorld(sx, sy), r = roomAtWorld(w.x, w.y), zoomed = cam.z >= overview().z * 2.2;
  hoverCrew = zoomed ? crewAt(w.x, w.y) : null;
  const nh = r || null;
  if (nh !== hovered) { hovered = nh; updateBar(); } else if (hoverCrew) updateBar();
  cv.style.cursor = hoverCrew ? 'pointer' : r && (view.mode === 'all' || view.mode === 'free' || (view.mode === 'room' && r !== view.room)) ? (view.mode === 'room' ? 'zoom-out' : 'zoom-in') : view.mode !== 'all' && !r ? 'zoom-out' : 'default';
}
function zoomAt(sx, sy, f) {
  const ov = overview(), z = clamp(cam.z * f, ov.z * .8, ov.z * 30);
  if (z === cam.z) return;
  const w = toWorld(sx, sy);
  cam.z = z; cam.x = w.x - (sx * dpr - cv.width / 2) / z; cam.y = w.y - (sy * dpr - cv.height / 2) / z;
  cam.tw = null; view = { mode: 'free', room: null }; following = false; updateBar();
}
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, pos(e));
  if (pts.size === 1) drag = { ...pos(e), moved: false };
  else if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; drag = null; }
});
cv.addEventListener('pointermove', e => {
  const q = pos(e);
  if (!pts.has(e.pointerId)) { if (e.pointerType === 'mouse') hover(q.x, q.y); return; }
  const prev = pts.get(e.pointerId); pts.set(e.pointerId, q);
  if (pinch && pts.size === 2) {
    const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    zoomAt(m.x, m.y, d / pinch.d); cam.x -= (m.x - pinch.m.x) * dpr / cam.z; cam.y -= (m.y - pinch.m.y) * dpr / cam.z; pinch = { d, m }; return;
  }
  if (!drag) return;
  if (!drag.moved && Math.hypot(q.x - drag.x, q.y - drag.y) > 6) drag.moved = true;
  if (drag.moved && cam.z > overview().z * 1.05) {
    cam.x -= (q.x - prev.x) * dpr / cam.z; cam.y -= (q.y - prev.y) * dpr / cam.z; cam.tw = null;
    if (view.mode !== 'free') { view = { mode: 'free', room: null }; following = false; updateBar(); }
    cv.style.cursor = 'grabbing';
  }
});
const lift = e => {
  if (!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if (pinch) { if (pts.size < 2) pinch = null; drag = null; return; }
  if (drag && !drag.moved && e.type === 'pointerup') { const q = pos(e); click(q.x, q.y); if (e.pointerType === 'mouse') hover(q.x, q.y); }
  drag = null;
};
cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift);
cv.addEventListener('pointerleave', () => { if (hovered || hoverCrew) { hovered = null; hoverCrew = null; updateBar(); } });
cv.addEventListener('wheel', e => { e.preventDefault(); const q = pos(e), d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; zoomAt(q.x, q.y, Math.exp(-d * (e.ctrlKey ? .012 : .0022))); }, { passive: false });
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('input, textarea'))) return;
  const k = e.key;
  interacted = true;
  if (k === 'Escape') { if (selected && view.mode === 'follow') { following = false; setView('room', roomOfCrew(selected)); } else if (view.mode !== 'all') setView('all'); else if (selected) { selected = null; updateCard(); } closeRoster(); return; }
  if (k.startsWith('Arrow')) {
    e.preventDefault();
    const from = view.mode === 'room' ? view.room : view.mode === 'follow' && selected ? roomOfCrew(selected) : hovered && hovered.type !== 'junction' ? hovered : null;
    if (!from) return enterRoom(ship.bridge);
    const dir = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[k];
    const nav = from.nav || navFrom(from), to = nav && nav[dir];
    if (to) enterRoom(to);
    return;
  }
  if (k === 'f' || k === 'F') { if (selected) toggleFollow(); return; }
  if (k === '+' || k === '=') { if (view.mode === 'all') enterRoom(hovered && hovered.type !== 'junction' ? hovered : ship.bridge); return; }
  if (k === '-' || k === '_') { setView('all'); return; }
});
// junctions don't have their own neighbours: use the rooms either side
function navFrom(j) { const l = ship.rooms.find(r => r.nav && r.x1 === j.x0 && r.d1 === j.d1), rr = ship.rooms.find(r => r.nav && r.x0 === j.x1 && r.d1 === j.d1); return { left: l, right: rr, up: null, down: null }; }
function toggleFollow() { following = !following; if (following) setView('follow'); else setView('room', roomOfCrew(selected)); updateCard(); }

/* ---------- space ---------- */
const STARS = (() => { const R = rng(99), o = []; for (let l = 0; l < 3; l++) for (let i = 0; i < [220, 110, 45][l]; i++) o.push({ x: R(), y: R(), l, c: R.pick(['#ffffff', '#cfe0ff', '#ffe8c8', '#a8c8ff']), b: R.range(.4, 1) }); return o; })();
let planet = null;
function makePlanet() {
  const R = rng(seed ^ 0x77), s = 64, c = mk(s, s), x = c.getContext('2d'), img = x.createImageData(s, s), D = img.data;
  const pal = R.pick([['#2a3a6a', '#3a6aa8', '#8ac8e8', '#e8f4ff'], ['#4a2a1a', '#8a4a2a', '#d88a4a', '#f8d8a8'], ['#2a4a2a', '#3a7a4a', '#7ab86a', '#d8e8a8'], ['#3a1a4a', '#6a3a8a', '#b87ad8', '#f0d8ff']]);
  const band = R.chance(.5);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const dx = (i - s / 2 + .5) / (s / 2), dy = (j - s / 2 + .5) / (s / 2), d = dx * dx + dy * dy;
    if (d > 1) continue;
    const light = clamp(.55 - dx * .55 - dy * .35 + Math.sqrt(1 - d) * .45, 0, 1);
    const tex = band ? Math.sin(dy * 9 + Math.sin(dx * 3) * .8) * .12 : (hash(i >> 2, j >> 2) - .5) * .2;
    const v = clamp(light + tex, 0, .999), q = Math.floor(v * 4 + ((i + j * 2) % 4) / 8 - .06);
    const col = pal[clamp(q, 0, 3)], k = (j * s + i) * 4;
    D[k] = parseInt(col.slice(1, 3), 16); D[k + 1] = parseInt(col.slice(3, 5), 16); D[k + 2] = parseInt(col.slice(5, 7), 16); D[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return { c, x: R.range(.15, .85), y: R.range(.2, .7), size: R.range(.22, .38) };
}
function drawSpace(dt) {
  const cw = cv.width, ch = cv.height;
  const gr = g.createLinearGradient(0, 0, 0, ch); gr.addColorStop(0, '#04050d'); gr.addColorStop(1, '#0a0c1d');
  g.fillStyle = gr; g.fillRect(0, 0, cw, ch);
  const k = sim.warp.k, drift = T * (2 + k * 400);
  if (!planet) planet = makePlanet();
  if (k < .5) {
    const ps = Math.round(Math.min(cw, ch) * planet.size / 64) || 1, px = ((planet.x - T * .0006) % 1.4 + 1.4) % 1.4 - .2;
    g.imageSmoothingEnabled = false; g.globalAlpha = 1 - k * 2;
    g.drawImage(planet.c, Math.round(px * cw - cam.x * cam.z * .01), Math.round(planet.y * ch - 32 * ps - cam.y * cam.z * .01), 64 * ps, 64 * ps);
    g.globalAlpha = 1;
  }
  const px = Math.max(1, Math.round(dpr));
  for (const s of STARS) {
    const sp = [.004, .012, .03][s.l], par = [.02, .05, .1][s.l];
    let x = ((s.x - (T * sp) - drift * sp * .02 - cam.x * cam.z * par / cw) % 1 + 1) % 1, y = ((s.y - cam.y * cam.z * par / ch) % 1 + 1) % 1;
    g.fillStyle = s.c; g.globalAlpha = s.b * (s.l === 0 ? .6 : 1);
    const size = s.l === 2 ? px * 2 : px;
    if (k > .15) { const len = (s.l + 1) * 60 * k * dpr; g.fillRect(x * cw, y * ch, len, size); }
    else g.fillRect(Math.round(x * cw), Math.round(y * ch), size, size);
  }
  g.globalAlpha = 1;
}

/* ---------- render ---------- */
const lights = [], drawErrors = new Set();
function render(dt) {
  const cw = cv.width, ch = cv.height, z = cam.z;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  drawSpace(dt);
  const x0 = clamp(Math.floor(cam.x - cw / 2 / z) - 2, 0, ship.width), x1 = clamp(Math.ceil(cam.x + cw / 2 / z) + 2, 0, ship.width);
  const y0 = clamp(Math.floor(cam.y - ch / 2 / z) - 2, 0, ship.height), y1 = clamp(Math.ceil(cam.y + ch / 2 / z) + 2, 0, ship.height);
  lights.length = 0;
  // the painted ship goes down first, so if anything drawn on top of it fails the ship still shows
  if (x1 > x0 && y1 > y0) {
    try { drawWorld(dg, { x0, y0, x1, y1 }, ship, painted, sim, T, dt, lights); drawMarks(); }
    catch (e) { if (!drawErrors.has(e.message)) { drawErrors.add(e.message); console.error(e); } }
  }
  const ox = Math.round(cw / 2 - cam.x * z), oy = Math.round(ch / 2 - cam.y * z);
  g.setTransform(z, 0, 0, z, ox, oy);
  g.imageSmoothingEnabled = z < 1;
  if (x1 > x0 && y1 > y0) g.drawImage(dyn, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  g.imageSmoothingEnabled = true;
  g.globalCompositeOperation = 'lighter';
  for (const L of lights) { const r = L.r * 2; g.globalAlpha = Math.min(1, L.a); g.drawImage(glowTex(L.c), L.x - r, L.y - r, r * 2, r * 2); }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  // focus: dim everything outside the room we're looking at
  const focus = view.mode === 'room' ? view.room : view.mode === 'follow' && selected ? roomOfCrew(selected) : null;
  if (focus) {
    const fx0 = focus.x0 - 1, fy0 = deckTop(focus.d0) + 5, fx1 = focus.x1 + 1, fy1 = floorY(focus.d1) + 2;
    g.fillStyle = 'rgba(3,4,10,.58)'; g.beginPath(); g.rect(x0 - 50, y0 - 50, x1 - x0 + 100, y1 - y0 + 100); g.rect(fx0, fy0, fx1 - fx0, fy1 - fy0); g.fill('evenodd');
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}
// Marks drawn straight onto the ship's pixels, so they scale up as chunky as everything else: a frame round
// the room under the pointer, repair bars over broken systems, and brackets and a health bar on whoever's picked.
function drawMarks() {
  if (hovered && (view.mode === 'all' || view.mode === 'free') && !pts.size) drawRoomFrame(dg, hovered, '#ffd24a');
  for (const r of ship.rooms) if (r.broken && r.panel) drawRepairBar(dg, r);
  if (selected) drawSelection(dg, selected, T);
}

/* ---------- panels ---------- */
function iconCanvas(name, scale = 3) {
  const P = iconPixels(name), c = document.createElement('canvas'); c.width = 5 * scale; c.height = 5 * scale;
  const x = c.getContext('2d'); x.fillStyle = ICON_COL[name];
  P.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') x.fillRect(i * scale, j * scale, scale, scale); }));
  return c;
}
let systems = [];
function buildSystems() {
  const el = $('systems'); el.innerHTML = '';
  const seen = new Set();
  systems = ship.rooms.filter(r => r.badge && !['bunk', 'fork', 'leaf', 'door'].includes(r.badge.icon)).filter(r => { const k = r.badge.icon; if (seen.has(k)) return false; seen.add(k); return true; });
  const order = ['helm', 'engine', 'shield', 'o2', 'med', 'eye', 'target', 'tele', 'chip', 'drone', 'bolt', 'drop'];
  systems.sort((a, b) => order.indexOf(a.badge.icon) - order.indexOf(b.badge.icon));
  for (const r of systems) {
    const b = document.createElement('button'); b.className = 'sys'; b.type = 'button'; b.title = r.name; b.setAttribute('aria-label', r.name);
    const bars = document.createElement('span'); bars.className = 'bars';
    const n = Math.max(1, r.stations.filter(s => s.dept).length);
    for (let i = 0; i < n; i++) bars.append(document.createElement('i'));
    b.append(bars, iconCanvas(r.badge.icon));
    b.onclick = () => { enterRoom(r); cv.focus({ preventScroll: true }); };
    el.append(b); r.sysEl = b;
  }
}
function updateSystems() {
  for (const r of systems) {
    const bars = r.sysEl.querySelectorAll('.bars i'), manned = r.stations.filter(s => s.dept && s.occ && s.occ.duty === s).length;
    bars.forEach((el, i) => el.className = i < manned ? 'on' : '');
    r.sysEl.classList.toggle('broken', !!r.broken);
  }
  const ch = sim.charge(), w = sim.warp.phase;
  $('ftlFill').style.width = (ch * 100).toFixed(1) + '%';
  $('ftl').classList.toggle('ready', ch >= .999 && w === 'cruise');
  $('jump').disabled = w !== 'cruise';
  $('jump').textContent = w === 'cruise' ? (ch > .6 ? 'Jump' : 'Charging') : w === 'spool' ? 'Spooling' : w === 'jump' ? 'In FTL' : 'Arriving';
}
$('jump').onclick = () => sim.jumpNow();

// crew roster
function portrait(c, scale = 3) {
  const s = crewSprite(c.look, 'front', 'none', 'none', false), cvs = document.createElement('canvas');
  cvs.width = 11 * scale; cvs.height = 10 * scale;
  const x = cvs.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(s.c, 0, 0, s.c.width, 10, (11 - s.c.width) / 2 * scale, 0, s.c.width * scale, 10 * scale);
  return cvs;
}
// the cat and the droid, drawn from their pixel lists
function critterPortrait(a) {
  const cvs = document.createElement('canvas'); cvs.width = 44; cvs.height = 40;
  const x = cvs.getContext('2d'), px = a.kind === 'cat' ? CAT(a.col[0], a.col[1]).sit : DROID.body;
  for (const [dx, dy, c] of px) { x.fillStyle = c; x.fillRect(22 + dx * 4 - 2, 34 + dy * 4, 4, 4); }
  return cvs;
}
let rosterItems = [];
function buildRoster() {
  const list = $('rosterList'); list.innerHTML = '';
  rosterItems = [];
  const order = ['command', 'security', 'engineering', 'science', 'medical', 'operations', 'flight', 'culinary'];
  const all = sim.crew.slice().sort((a, b) => order.indexOf(a.dept) - order.indexOf(b.dept) || a.watch - b.watch || a.name.localeCompare(b.name));
  let dept = null;
  for (const c of all) {
    if (c.dept !== dept) { dept = c.dept; const h = document.createElement('h3'); h.textContent = DEPT[dept].name; h.style.setProperty('--d', DEPT[dept].top); list.append(h); }
    const b = document.createElement('button'); b.type = 'button'; b.className = 'crew';
    const txt = document.createElement('span'); txt.className = 'txt';
    const nm = document.createElement('b'); nm.textContent = title(c);
    const st = document.createElement('small');
    txt.append(nm, st); b.append(portrait(c, 2), txt);
    b.onclick = () => { select(c); following = true; setView('follow'); updateCard(); };
    list.append(b); rosterItems.push({ c, st, b });
  }
  $('crewCount').textContent = sim.crew.length;
}
function statusOf(c) {
  const b = sim.block(c);
  if (c.mode === 'flying') return 'on patrol';
  if (c.st && c.st.act === 'sleep' && c.mode === 'act') return 'asleep';
  return (b === 'work' ? 'on duty · ' : '') + c.doing;
}
function updateRoster() { if ($('roster').hidden) return; for (const it of rosterItems) { it.st.textContent = statusOf(it.c); it.b.classList.toggle('sel', it.c === selected); } }
$('rosterBtn').onclick = () => { const r = $('roster'); r.hidden = !r.hidden; $('rosterBtn').setAttribute('aria-expanded', String(!r.hidden)); updateRoster(); };
function closeRoster() { $('roster').hidden = true; $('rosterBtn').setAttribute('aria-expanded', 'false'); }
$('rosterClose').onclick = closeRoster;

// crew card
const hhmm = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.floor(m % 60)).padStart(2, '0'); };
function nextLine(c) {
  if (c.dept === 'prisoner') return `Held for ${c.crime}.`;
  if (c.kind === 'cat') return 'The ship’s cat. Goes where it likes.';
  if (c.kind === 'droid') return 'Cleaning droid. Never off duty.';
  const b = sim.block(c), end = sim.blockEnd(c);
  return b === 'work' ? `On duty until ${hhmm(end)}` : b === 'off' ? `Off duty · turns in at ${hhmm(end)}` : b === 'sleep' ? `Asleep · up at ${hhmm(end)}` : `On duty at ${hhmm(end)}`;
}
function updateCard() {
  const card = $('card');
  document.body.classList.toggle('carded', !!selected);
  if (!selected) { card.hidden = true; return; }
  const c = selected;
  card.hidden = false;
  const pic = $('cardPic'); pic.innerHTML = '';
  if (c.look) pic.append(portrait(c, 4));
  else pic.append(critterPortrait(c));
  $('cardName').textContent = c.look ? title(c) : c.name;
  $('cardRole').textContent = c.kind ? (c.kind === 'cat' ? 'Ship’s cat' : 'Maintenance droid') : c.dept === 'prisoner' ? 'In the brig' : `${DEPT[c.dept].name} · ${WATCHES[c.watch]} watch`;
  $('cardRole').style.setProperty('--d', c.look ? c.look.top : '#9aa4b4');
  refreshCard();
  $('follow').textContent = following ? 'Stop following' : 'Follow';
  $('follow').setAttribute('aria-pressed', String(following));
}
function refreshCard() {
  if (!selected) return;
  const c = selected, r = roomOfCrew(c);
  $('cardNow').textContent = (c.mode === 'flying' ? 'Flying a patrol' : cap(c.doing || '')) + (r && c.mode !== 'flying' ? ` · ${r.name}, deck ${r.d1 + 1}` : '');
  $('cardNext').textContent = nextLine(c);
}
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
$('follow').onclick = () => { toggleFollow(); };
$('cardClose').onclick = () => { selected = null; following = false; if (view.mode === 'follow') setView('all'); updateCard(); };

// the bar at the bottom: whatever you're pointing at, or the ship
const ACT_WORD = { console: 'at the controls', standConsole: 'at the controls', gunner: 'on the guns', captain: 'in command', desk: 'at a desk', sleep: 'asleep', patient: 'being treated',
  eat: 'eating', serve: 'serving', cook: 'cooking', chop: 'cooking', run: 'running', lift: 'lifting', punch: 'boxing', pullup: 'on the bar', stretch: 'stretching', shoot: 'shooting',
  armorer: 'on the bench', scan: 'treating patients', clipboard: 'checking things', lab: 'experimenting', micro: 'at the microscope', water: 'gardening', read: 'reading', couch: 'watching a holovid',
  sit: 'sitting', sitback: 'stargazing', look: 'stargazing', pool: 'playing pool', arcade: 'playing arcade games', guitar: 'playing guitar', drink: 'drinking', bartend: 'tending bar', meditate: 'meditating',
  meeting: 'in a briefing', laundry: 'doing laundry', fold: 'folding laundry', shower: 'showering', sink: 'washing up', weld: 'welding', repair: 'repairing', mechanic: 'fixing fighters', stand: 'standing about' };
function roomSummary(r) {
  const here = sim.crew.filter(c => c.mode !== 'flying' && c.d >= r.d0 && c.d <= r.d1 && c.x >= r.x0 && c.x < r.x1);
  const acts = {};
  for (const c of here) {
    const a = c.task && (c.task.kind === 'repair' || c.task.kind === 'inspect') ? 'repair' : c.st && c.st.act;
    const k = c.mode === 'act' ? ACT_WORD[a] || 'busy' : c.mode === 'queue' || c.mode === 'walkq' ? 'queueing' : c.mode === 'liftwait' ? 'waiting for the lift' : 'passing through';
    acts[k] = (acts[k] || 0) + 1;
  }
  const parts = Object.entries(acts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${n} ${k}`);
  return `${r.name} · deck ${r.d1 + 1}` + (here.length ? ` — ${parts.join(', ')}` : ' — empty');
}
function updateBar() {
  if (!sim) return;
  const el = $('bar');
  let text;
  if (hoverCrew) text = (hoverCrew.look ? title(hoverCrew) : hoverCrew.name) + ' — ' + (hoverCrew.mode === 'flying' ? 'flying a patrol' : hoverCrew.doing);
  else if (hovered && hovered.type !== 'junction') text = roomSummary(hovered);
  else if (view.mode === 'room') text = roomSummary(view.room);
  else if (view.mode === 'follow' && selected) text = `Following ${selected.look ? short(selected) : selected.name}`;
  else if (!interacted) text = innerWidth < 640 ? 'Tap a room to look inside' : 'Click a room to look inside \u00b7 click anyone to follow them \u00b7 arrow keys hop rooms';
  else {
    const asleep = sim.crew.filter(c => c.mode === 'act' && c.st && c.st.act === 'sleep').length, duty = sim.crew.filter(c => sim.block(c) === 'work').length;
    text = `${sim.crew.length} crew aboard · ${duty} on duty · ${asleep} asleep`;
  }
  if (el.textContent !== text) el.textContent = text;
}
let noticeAt = 0, noticeN = 0;
function updateClock() {
  const tod = sim.tod(), w = Math.floor(((tod - 360 + 1440) % 1440) / 480);
  $('clock').textContent = hhmm(tod);
  $('watch').textContent = `${WATCHES[w]} watch · day ${Math.floor(sim.t / 1440)}`;
  if (sim.notices.length !== noticeN) { noticeN = sim.notices.length; const n = sim.notices.at(-1); if (n) { $('notice').textContent = n.text; $('notice').classList.add('on'); noticeAt = T; } }
  if (T - noticeAt > 6) $('notice').classList.remove('on');
}
const SPEEDS = [1, 4, 16];
function speedLabel() { $('speed').textContent = speed + '×'; $('speed').setAttribute('aria-label', `Time runs at ${speed} times`); }
$('speed').onclick = () => { const i = SPEEDS.indexOf(speed); speed = SPEEDS[(i + 1) % SPEEDS.length] || 1; speedLabel(); };
$('newShip').onclick = () => { build((Math.random() * 1e9) >>> 0); planet = null; };

/* ---------- size & loop ---------- */
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  const w = Math.max(1, Math.round(innerWidth * dpr)), h = Math.max(1, Math.round(innerHeight * dpr));
  if (cv.width === w && cv.height === h) return;
  cv.width = w; cv.height = h;
  INSET.top = innerWidth < 640 ? 96 : 70; INSET.bottom = innerWidth < 640 ? 130 : innerWidth < 1100 ? 150 : 100;
  if (ship && view.mode !== 'free') { const to = goal(); cam.x = to.x; cam.y = to.y; cam.z = to.z; cam.tw = null; }
}
addEventListener('resize', resize);
let last = performance.now(), uiT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  tick(now);
}
function tick(now) {
  const real = clamp((now - last) / 1000, 0, .05); last = Math.max(last, now);
  const dt = real * speed;
  T += real;
  // big speeds step the simulation in small pieces
  const n = Math.ceil(dt / (1 / 20));
  for (let i = 0; i < n; i++) sim.update(dt / n);
  stepVfx(real);
  stepCam(real);
  render(real);
  uiT -= real;
  if (uiT <= 0) { uiT = .25; updateClock(); updateSystems(); updateBar(); refreshCard(); updateRoster(); }
}

/* ---------- start ---------- */
resize();
speedLabel();
build(+params.get('ship') || ((Math.random() * 1e9) >>> 0));
const start = params.get('room');
if (start) { const r = ship.rooms.find(r => r.type === start); if (r) setView('room', r, true); }
if (params.has('debug')) window.AH = { get ship() { return ship; }, get sim() { return sim; }, cam, setView, enterRoom, select, get view() { return view; }, step: s => { for (let i = 0; i < s * 20; i++) sim.update(.05); }, bench: n => { const t0 = performance.now(); for (let i = 0; i < n; i++) render(1 / 60); return (performance.now() - t0) / n; }, frames: n => { for (let i = 0; i < n; i++) tick(last + 1000 / 60); }, get selected() { return selected; } };
requestAnimationFrame(frame);
