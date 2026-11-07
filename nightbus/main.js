import { W, H, ANOMS, ANOM, drawView, routeDist, routeSpeed, warmTextures } from './scene.js';
import { Sound } from './audio.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug');
const $ = id => document.getElementById(id);
const cv = $('cv'), cx = cv.getContext('2d', { willReadFrequently: true });
const sound = new Sound();

const RIDE = 28;              // seconds from stop to stop
const GOAL = 8;               // stops in a row to get home
const STOPS = ['Depot Lane', 'Mill Street', 'The Crescent', 'St Agnes Church', 'Brickfields', 'Canal Bridge', 'Hollins Parade', 'Albion Road', 'Larkhill Road'];
const VIEWS = ['Window', 'Ahead', 'Behind'];

// ---------- saved progress ----------
const store = (() => {
  let d = {}; try { d = JSON.parse(localStorage.getItem('nightbus') || '{}') || {}; } catch {}
  d.log ||= []; d.homes ||= 0; d.best ||= 0;
  return { d, save() { if (DEMO) return; try { localStorage.setItem('nightbus', JSON.stringify(d)); } catch {} } };
})();
if (store.d.sound === false) sound.on = false;

// ---------- the dither: everything is drawn in greys, then crushed to the bus's inks ----------
const RAMP = [[11, 19, 16], [28, 58, 46], [78, 122, 90], [180, 198, 138], [239, 230, 180]];
const REDS = [[11, 19, 16], [92, 23, 18], [216, 64, 44], [255, 150, 120]];
const AMBS = [[11, 19, 16], [110, 62, 12], [255, 180, 58]];
const pack = ([r, g, b]) => (255 << 24) | (b << 16) | (g << 8) | r;
const PR = RAMP.map(pack), PRED = REDS.map(pack), PAMB = AMBS.map(pack);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
function dither(w, h) {
  const img = cx.getImageData(0, 0, w, h), d = img.data, out = new Uint32Array(d.buffer);
  for (let y = 0; y < h; y++) {
    const row = (y & 3) * 4;
    for (let x = 0; x < w; x++) {
      const i = y * w + x, j = i * 4, r = d[j], g = d[j + 1], b = d[j + 2], th = BAYER[row + (x & 3)];
      if (r > 34 && r > b * 2.2 + 18) {
        if (g < r * .42) { out[i] = PRED[Math.min(3, (r / 255 * 2.2 + g / 255 * 2 + th) | 0)]; continue; }
        if (g < r * .85) { out[i] = PAMB[Math.min(2, (r / 255 * 2 + th) | 0)]; continue; }
      }
      const L = (r * 77 + g * 151 + b * 28) >> 8;
      out[i] = PR[Math.min(4, (L / 255 * 4 + th) | 0)];
    }
  }
  cx.putImageData(img, 0, 0);
}

// ---------- state ----------
const G = {
  mode: 'title',            // title | ride | card | show | win
  kind: 'real',             // tut1 | tut2 | real
  view: 1, t: 0, sec: 0, phase: 'wait', phaseT: 0, doze: 0, dozeA: 0,
  anom: null, rang: false, progress: 0, used: new Set(), normals: 0, rides: 0,
  zoom: 1, zx: W / 2, zy: H / 2, zT: 1, zxT: W / 2, zyT: H / 2, flash: 0,
  tut: 0, looked: new Set([1]), zoomedIn: false, hint: 0, paused: false, hold: false,
  runStart: 0, spotted: 0,
};
window.nb = { G, ANOMS, store };

const active = id => {
  if (G.anom !== id) return false;
  const a = ANOM[id]; return !a.at || G.t >= a.at || G.mode === 'show';
};
const stopName = () => STOPS[Math.min(STOPS.length - 1, (G.kind === 'real' ? G.progress : 0) + 1)];

function pickAnom() {
  const p = G.progress;
  const normalChance = G.normals >= 2 ? 0 : (G.rides === 0 ? .25 : .42);
  if (Math.random() < normalChance) { G.normals++; return null; }
  G.normals = 0;
  let pool = ANOMS.filter(a => !G.used.has(a.id));
  if (pool.length < 4) { G.used.clear(); pool = ANOMS.slice(); }
  const wt = a => a.d === 1 ? (p < 4 ? 3 : 1.5) : a.d === 2 ? 2.2 : (p < 2 ? .3 : 2);
  let sum = pool.reduce((s, a) => s + wt(a), 0), r = Math.random() * sum;
  for (const a of pool) { r -= wt(a); if (r <= 0) { G.used.add(a.id); return a.id; } }
  return pool[0].id;
}

// ---------- layout ----------
const L = { vx: 0, vy: 0, vw: 400, vh: 300, lw: 400, lh: 300, side: false, cardBelow: false };
function layout() {
  const w = innerWidth, h = innerHeight;
  const sat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
  const top = 56 + sat, bottom = 10;
  const tabs = $('tabs'), acts = $('acts');
  // side layout when the screen is wide and short (phones held sideways, laptops)
  let vh = h - top - bottom, vw = vh * 4 / 3;
  const side = !DEMO && w > h * 1.15 && (h - top - 150) * 4 / 3 < w - 300;
  if (side) {
    if (vw > w - 290) { vw = w - 290; vh = vw * 3 / 4; }
    L.vx = Math.round((w - vw) / 2); L.vy = Math.round(top + (h - top - bottom - vh) / 2);
    tabs.className = 'col'; acts.className = 'col';
    const colW = Math.min(130, L.vx - 22);
    Object.assign(tabs.style, { left: (L.vx - colW - 12) + 'px', width: colW + 'px', top: (L.vy + vh / 2 - 85) + 'px', bottom: '', right: '' });
    Object.assign(acts.style, { left: (L.vx + vw + 12) + 'px', width: colW + 'px', top: (L.vy + vh / 2 - 85) + 'px', bottom: '', right: '' });
  } else {
    const ctrlH = DEMO ? 0 : 150;
    vh = Math.min(vh - ctrlH, (w - 12) * 3 / 4); vw = vh * 4 / 3;
    L.vx = Math.round((w - vw) / 2); L.vy = top;
    tabs.className = ''; acts.className = '';
    const bw = Math.min(w - 20, 520);
    Object.assign(tabs.style, { left: ((w - bw) / 2) + 'px', width: bw + 'px', top: (L.vy + vh + 12) + 'px', bottom: '', right: '' });
    Object.assign(acts.style, { left: ((w - bw) / 2) + 'px', width: bw + 'px', top: '', bottom: `max(12px, env(safe-area-inset-bottom))`, right: '' });
  }
  L.vw = vw; L.vh = vh; L.side = side;
  const k = Math.max(1, Math.round(vw / 470));
  L.lw = Math.round(vw / k); L.lh = Math.round(vh / k);
  cv.width = L.lw; cv.height = L.lh;
  Object.assign(cv.style, { left: L.vx + 'px', top: L.vy + 'px', width: vw + 'px', height: vh + 'px' });
  placeCard();
  if (DEMO) { $('tabs').classList.add('off'); $('acts').classList.add('off'); }
}
function placeCard() {
  const c = $('card'), w = innerWidth, h = innerHeight;
  const below = !L.side && (h - (L.vy + L.vh) - 52 - 110) > 120;
  L.cardBelow = below;
  const cw = Math.min(L.side ? L.vw - 24 : w - 20, 520);
  c.style.width = cw + 'px'; c.style.left = ((w - cw) / 2) + 'px';
  if (below) { c.style.top = (L.vy + L.vh + 62) + 'px'; c.style.bottom = ''; c.style.maxHeight = (h - (L.vy + L.vh + 62) - 110) + 'px'; }
  else { c.style.top = ''; c.style.bottom = (innerHeight - (L.vy + L.vh) + 10) + 'px'; c.style.maxHeight = (L.vh - 20) + 'px'; }
  c.style.overflowY = 'auto';
}
addEventListener('resize', layout);

// ---------- cards ----------
let cardFns = [];
function card(head, body, buttons = [], opts = {}) {
  const c = $('card');
  c.classList.remove('off'); c.classList.toggle('mini', !buttons.length);
  c.querySelector('.hd').textContent = head; c.querySelector('.hd').classList.toggle('red', !!opts.red);
  c.querySelector('.bd').innerHTML = body;
  const bt = c.querySelector('.bt'); bt.innerHTML = ''; cardFns = [];
  buttons.forEach((b, i) => { const e = document.createElement('button'); e.className = 'btn' + (b.alt ? ' alt' : ''); e.textContent = b.label;
    e.addEventListener('click', ev => { ev.stopPropagation(); sound.init(); b.fn(); }); bt.appendChild(e); cardFns.push(b); });
  c.dataset.blocking = buttons.length ? '1' : '';
  placeCard();
}
const hideCard = () => { $('card').classList.add('off'); $('card').dataset.blocking = ''; cardFns = []; };
const blocking = () => $('card').dataset.blocking === '1';

// ---------- the ride ----------
function startRide(kind) {
  G.kind = kind; G.t = 0; G.rang = false; G.here = null; G.doze = 0; G.phaseT = 0; G.hint = 0; G.mode = 'ride';
  G.anom = kind === 'tut1' ? null : kind === 'tut2' ? 'driverGone' : pickAnom();
  if (kind === 'real') G.rides++;
  setView(1, true); unzoom(true);
  hideCard();
  G.phase = kind === 'tut1' ? 'wait' : 'depart';
  if (kind === 'tut1') { G.tut = 0; G.looked = new Set([1]); G.zoomedIn = false; tutStep(); }
  if (kind === 'tut2') card('SAME BUS', '<p>Same bus. Same seat. The same stretch of road. Look again.</p>');
  if (G.phase === 'depart') sound.hiss(.7);
  updateHud();
}
function depart() { G.phase = 'depart'; G.phaseT = 0; sound.hiss(.7); }

function tutStep() {
  const s = G.tut;
  if (s === 0) card('THE 23:52', '<p>The last bus home. You sit here every night, and every night it’s the same: the same people, the same adverts, the same shops in the rain.</p><p>The bus is waiting at the depot. <em>Learn how it looks.</em></p>', [{ label: 'Look around', fn: () => { G.tut = 1; tutStep(); } }]);
  else if (s === 1) {
    const ck = v => `<span class="chk${G.looked.has(v) ? ' on' : ''}">${VIEWS[v]}</span>`;
    card('LOOK AROUND', `<p>Swipe left or right to turn your head, or tap the tabs (arrow keys work too). Look out of your window, then behind you.</p><p>${ck(0)}${ck(2)}</p>`);
  } else if (s === 2) card('LOOK CLOSER', `<p>Some things are small. <span class="k">Double-tap</span> the view to lean in, and drag to look about. Double-tap again to sit back. (Scroll wheel on a computer, or pinch.)</p><p><span class="chk${G.zoomedIn ? ' on' : ''}">Lean in</span><span class="chk">Sit back</span></p>`);
  else if (s === 3) { card('DOORS CLOSING', '<p>Off we go. Nothing is wrong on this ride: this is how the bus should look.</p><p>Waiting gets dull, so when you’re sure nothing has changed, <em>Doze</em> skips you to the next stop.</p>'); depart(); }
}
function tutCheck() {
  if (G.kind !== 'tut1' || G.mode !== 'ride') return;
  if (G.tut === 1) { if (G.looked.has(0) && G.looked.has(2)) { G.tut = 2; tutStep(); } else tutStep(); }
  else if (G.tut === 2 && G.zoomedIn && G.zT < 1.05) { G.tut = 3; tutStep(); }
  else if (G.tut === 2) tutStep();
}

function ring() {
  sound.init();
  if (G.mode !== 'ride' || G.rang || G.doze || G.t > .965 || blocking()) return;
  if (G.phase === 'wait') return;
  if (G.kind === 'tut1') { sound.ding(); flashBell(); card('NOT THIS TIME', '<p>Nothing has changed yet. This ride is the bus as it should be. Learn it, and save the bell for when something’s different.</p>'); return; }
  G.rang = true; sound.ding(); updateHud();
  if (G.kind === 'tut2') card('BELL RUNG', '<p>The bus will stop and you’ll get off. Once you’ve rung, there’s no taking it back. <em>Doze</em> if you don’t want to wait.</p>');
}
function flashBell() { const b = $('bell'); b.classList.add('lit'); setTimeout(() => updateHud(), 500); }
function doze() {
  sound.init();
  if (G.mode !== 'ride' || G.phase !== 'ride' || G.doze || blocking()) return;
  G.doze = 1; updateHud();
}

function resolve() {
  G.mode = 'card'; G.doze = 0; G.here = stopName();
  const had = !!G.anom, ok = had === G.rang, a = had ? ANOM[G.anom] : null;
  if (G.kind === 'tut1') {
    card(stopName().toUpperCase(), '<p>Nothing had changed, so you stayed on. That’s half the job.</p><p>The other half: the next bus is the same bus. Ride it again.</p>', [{ label: 'Next ride', fn: () => startRide('tut2') }]);
    sound.sting(false); return;
  }
  if (G.kind === 'tut2') {
    if (G.rang) {
      store.d.tut = 1; store.save(); logAnom(G.anom); sound.sting(false);
      card('GOOD CALL', `<p>${a.text} You got off, and the next bus came along. It’s the same bus.</p><p>From here on it counts. <em>Ring if anything has changed. Stay on if nothing has.</em> Eight stops right in a row and you’re home; one wrong and you’re back at the depot.</p><p class="k">About ${ANOMS.length} things can go wrong, in all three directions.</p>`,
        [{ label: 'Start the journey', fn: () => newRun() }]);
    } else {
      sound.sting(true);
      card('YOU STAYED ON', `<p>But something was wrong: ${lc(a.text)}</p><p>Ride that one again. When anything is different, ring the bell.</p>`, [{ label: 'Show me', alt: true, fn: () => showMe(() => startRide('tut2')) }, { label: 'Try again', fn: () => startRide('tut2') }], { red: true });
    }
    return;
  }
  if (ok) {
    G.progress++; sound.sting(false);
    if (had) { logAnom(G.anom); G.spotted++; }
    store.d.best = Math.max(store.d.best, G.progress); store.save();
    if (G.progress >= GOAL) return win();
    const next = STOPS[G.progress + 1];
    card(had ? 'GOOD CALL' : 'NOTHING HAD CHANGED',
      had ? `<p>${a.text} You got off at ${STOPS[G.progress]}. The next bus pulls in. It’s the same bus.</p>` : `<p>You stayed on through ${STOPS[G.progress]}. Next stop, ${next}.</p>`,
      [{ label: 'Next ride', fn: () => startRide('real') }]);
  } else {
    sound.sting(true);
    const lost = G.progress; G.progress = 0; G.used.clear(); G.normals = 0;
    const back = lost ? `<p>${lost} stop${lost > 1 ? 's' : ''} wasted. The driver turns the bus round for the depot.</p>` : '<p>Back to the depot.</p>';
    if (had) card('YOU STAYED ON', `<p>Something was wrong: ${lc(a.text)}</p>${back}`, [{ label: 'Show me', alt: true, fn: () => showMe(() => startRide('real')) }, { label: 'Back to the depot', fn: () => startRide('real') }], { red: true });
    else card('NOTHING WAS WRONG', `<p>You got off for nothing. The stop was cold and empty, and the bus that came was the one from the depot.</p>${back}`, [{ label: 'Back to the depot', fn: () => startRide('real') }], { red: true });
  }
  updateHud();
}
const lc = s => s[0].toLowerCase() + s.slice(1);
function logAnom(id) { if (!store.d.log.includes(id)) { store.d.log.push(id); store.save(); } }
function showMe(then) {
  const a = ANOM[G.anom]; if (!a) return then();
  G.mode = 'show'; setView(a.view, true);
  const [fx, fy, fz] = a.focus; G.zT = fz; G.zxT = fx; G.zyT = fy;
  card('LOOK', `<p>${a.text}</p>`, [{ label: 'Carry on', fn: then }]);
  // when the card sits over the view, keep the thing itself in the top part of the picture
  if (!L.cardBelow) G.zyT = fy + .24 * H / fz;
  clampZoom();
}
function newRun() { G.progress = 0; G.used.clear(); G.normals = 0; G.rides = 0; G.spotted = 0; G.runStart = performance.now(); startRide('real'); }
function win() {
  G.mode = 'win'; store.d.homes++; store.save();
  setView(0, true); unzoom(true);
  const mins = Math.max(1, Math.round((performance.now() - G.runStart) / 60000));
  card('LARKHILL ROAD', `<p>Your stop. The doors fold open and the rain is just rain. You step down, and the bus pulls away with its sign already changed to <em>NOT IN SERVICE</em>.</p><p>You’re home. ${G.spotted} wrong thing${G.spotted === 1 ? '' : 's'} spotted on the way, about ${mins} minute${mins > 1 ? 's' : ''} on the bus.</p><p class="k">Logbook: ${store.d.log.length} of ${ANOMS.length}.</p>`,
    [{ label: 'Title', alt: true, fn: () => toTitle() }, { label: 'Ride again', fn: () => newRun() }]);
  updateHud();
}

// ---------- views and zoom ----------
function setView(v, instant) {
  v = Math.max(0, Math.min(2, v));
  if (v === G.view && !instant) return;
  if (v !== G.view) { G.flash = instant ? 0 : 1; sound.tick(); }
  G.view = v; G.looked.add(v);
  if (!instant) unzoom(true);
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', +b.dataset.v === v));
  tutCheck();
}
function unzoom(now) { G.zT = 1; G.zxT = W / 2; G.zyT = H / 2; if (now) { G.zoom = 1; G.zx = W / 2; G.zy = H / 2; } }
function clampZoom(alsoNow) {
  G.zT = Math.max(1, Math.min(3.2, G.zT));
  const hx = W / 2 / G.zT, hy = H / 2 / G.zT;
  G.zxT = Math.max(hx, Math.min(W - hx, G.zxT)); G.zyT = Math.max(hy, Math.min(H - hy, G.zyT));
  if (alsoNow === 'snap') { G.zoom = G.zT; G.zx = G.zxT; G.zy = G.zyT; }
}
// screen (css px, relative to view) -> world
const toWorld = (sx, sy) => { const s = L.vw / W * G.zoom; return [G.zx + (sx - L.vw / 2) / s, G.zy + (sy - L.vh / 2) / s]; };
function zoomAt(sx, sy, nz) {
  const [wx, wy] = toWorld(sx, sy);
  G.zT = Math.max(1, Math.min(3.2, nz));
  const s = L.vw / W * G.zT;
  G.zxT = wx - (sx - L.vw / 2) / s; G.zyT = wy - (sy - L.vh / 2) / s; clampZoom();
  if (G.zT > 1.6) { G.zoomedIn = true; }
  tutCheck();
}

// ---------- input on the view ----------
const ptrs = new Map(); let gest = null, lastTap = { t: 0, x: 0, y: 0 };
const rel = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
cv.addEventListener('pointerdown', e => {
  sound.init(); cv.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, rel(e));
  if (ptrs.size === 1) { const [x, y] = rel(e); gest = { x0: x, y0: y, x, y, t0: performance.now(), zx: G.zxT, zy: G.zyT, moved: 0, pinch: false }; }
  else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gest = { pinch: true, d0: Math.hypot(a[0] - b[0], a[1] - b[1]), z0: G.zT, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; }
});
cv.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId) || !gest) return;
  ptrs.set(e.pointerId, rel(e));
  if (gest.pinch && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    zoomAt(gest.mx, gest.my, gest.z0 * d / Math.max(20, gest.d0)); G.zoom = G.zT; G.zx = G.zxT; G.zy = G.zyT; return;
  }
  const [x, y] = rel(e); gest.x = x; gest.y = y; gest.moved = Math.max(gest.moved, Math.hypot(x - gest.x0, y - gest.y0));
  if (G.zT > 1.02) { const s = L.vw / W * G.zT; G.zxT = gest.zx - (x - gest.x0) / s; G.zyT = gest.zy - (y - gest.y0) / s; clampZoom(); G.zx = G.zxT; G.zy = G.zyT; }
});
const endPtr = e => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (!gest) return;
  if (gest.pinch) { if (!ptrs.size) gest = null; return; }
  const dx = gest.x - gest.x0, dy = gest.y - gest.y0, dt = performance.now() - gest.t0;
  if (G.zT <= 1.02 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2 && G.mode !== 'show') setView(G.view + (dx > 0 ? -1 : 1));
  else if (gest.moved < 12 && dt < 350) {
    const now = performance.now();
    if (now - lastTap.t < 340 && Math.hypot(gest.x - lastTap.x, gest.y - lastTap.y) < 40) {
      if (G.zT > 1.2) { unzoom(); tutCheck(); } else zoomAt(gest.x, gest.y, 2.6);
      lastTap.t = 0;
    } else lastTap = { t: now, x: gest.x, y: gest.y };
  }
  gest = null;
};
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = rel(e); zoomAt(x, y, G.zT * Math.exp(-e.deltaY * .0022)); if (G.zT < 1.03) { unzoom(); tutCheck(); } }, { passive: false });
cv.addEventListener('dblclick', e => e.preventDefault());

document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => { sound.init(); if (G.mode !== 'show') setView(+b.dataset.v); }));
$('bell').addEventListener('click', ring);
$('doze').addEventListener('click', doze);
$('menuB').addEventListener('click', () => { sound.init(); if (G.mode === 'title') return; pause(true); });

addEventListener('keydown', e => {
  if (e.repeat && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const k = e.key;
  if (!$('pause').classList.contains('off')) { if (k === 'Escape') pause(false); return; }
  if (G.mode === 'title') { if (k === 'Enter' || k === ' ') { e.preventDefault(); $('tMenu').querySelector('button')?.click(); } return; }
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') { if (G.mode !== 'show') setView(G.view - 1); }
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') { if (G.mode !== 'show') setView(G.view + 1); }
  else if (k === 'ArrowUp' || k === 'w' || k === 'W') { if (G.mode !== 'show') setView(1); }
  else if (k === 'ArrowDown' || k === 's' || k === 'S') { if (G.mode !== 'show') setView(2); }
  else if (k === ' ' || k === 'b' || k === 'B') { e.preventDefault(); if (blocking()) cardFns[cardFns.length - 1]?.fn(); else ring(); }
  else if (k === 'Enter') { if (blocking()) cardFns[cardFns.length - 1]?.fn(); }
  else if (k === 'z' || k === 'Z') doze();
  else if (k === '+' || k === '=') zoomAt(L.vw / 2, L.vh / 2, G.zT * 1.5);
  else if (k === '-' || k === '_') { zoomAt(L.vw / 2, L.vh / 2, G.zT / 1.5); if (G.zT < 1.03) { unzoom(); tutCheck(); } }
  else if (k === 'Escape') { if (G.zT > 1.02) { unzoom(); tutCheck(); } else pause(true); }
  else if (k === 'm' || k === 'M') toggleSound();
  sound.init();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && (G.mode === 'ride') && !DEMO && !DEBUG) pause(true); });

// ---------- menus ----------
function menuBtn(parent, label, small, fn, alt) {
  const b = document.createElement('button'); b.className = 'btn' + (alt ? ' alt' : '');
  b.innerHTML = `<span>${label}</span>${small ? `<small>${small}</small>` : ''}`; b.addEventListener('click', () => { sound.init(); fn(); }); parent.appendChild(b); return b;
}
function toggleSound() { sound.set(!sound.on); store.d.sound = sound.on; store.save(); if (G.mode === 'title') buildTitle(); else if (!$('pause').classList.contains('off')) buildPause(); }
function buildTitle() {
  const m = $('tMenu'); m.innerHTML = '';
  const done = !!store.d.tut;
  menuBtn(m, done ? 'Board the bus' : 'Board the bus', done ? '8 stops to home' : 'starts with a practice ride', () => { $('title').classList.add('off'); done ? newRun() : startRide('tut1'); });
  if (done) menuBtn(m, 'Practice ride', 'the walkthrough again', () => { $('title').classList.add('off'); startRide('tut1'); }, true);
  menuBtn(m, 'Logbook', `${store.d.log.length} of ${ANOMS.length}`, () => { const l = $('tLog'); l.classList.toggle('off'); buildLog(); }, true);
  menuBtn(m, 'Sound', sound.on ? 'on' : 'off', toggleSound, true);
  const s = []; if (store.d.best) s.push(`Furthest: ${store.d.best} of ${GOAL} stops`); if (store.d.homes) s.push(`Home ${store.d.homes} time${store.d.homes > 1 ? 's' : ''}`);
  $('tStats').textContent = s.join(' · ');
}
function buildLog() {
  const l = $('tLog'); l.innerHTML = '';
  for (const v of [1, 0, 2]) for (const a of ANOMS.filter(a => a.view === v)) {
    const li = document.createElement('li'); const seen = store.d.log.includes(a.id);
    li.className = seen ? '' : 'no'; li.innerHTML = `<b>${VIEWS[a.view].toUpperCase()}</b>${seen ? a.text : '- - - - - - - -'}`; l.appendChild(li);
  }
}
function toTitle() { G.mode = 'title'; G.progress = 0; G.paused = false; hideCard(); $('pause').classList.add('off'); $('title').classList.remove('off'); $('tLog').classList.add('off'); buildTitle(); setView(1, true); unzoom(true); G.t = .42; G.anom = null; G.rang = false; G.kind = 'real'; G.phase = 'ride'; updateHud(); }
function buildPause() {
  const m = $('pMenu'); m.innerHTML = '';
  menuBtn(m, 'Carry on', '', () => pause(false));
  menuBtn(m, 'Sound', sound.on ? 'on' : 'off', toggleSound, true);
  if (G.mode === 'ride' && !blocking()) menuBtn(m, 'How it works', '', () => { pause(false); card('HOW IT WORKS', `<p>Every ride should look exactly like the practice ride. <em>Ring the bell</em> (STOP, or Space) if anything has changed, in any direction, and you’ll get off at the next stop. If nothing has changed, stay on, or <em>Doze</em> (Z) to skip ahead.</p><p>Eight right in a row and you’re home. One wrong and it’s back to the depot. Some things only change partway through a ride.</p>`, [{ label: 'Got it', fn: () => { hideCard(); G.mode = 'ride'; } }]); G.mode = 'card'; });
  menuBtn(m, 'Get off and go home', 'back to the title', () => toTitle(), true);
}
function pause(on) {
  if (on) { G.paused = true; buildPause(); $('pause').classList.remove('off'); }
  else { G.paused = false; $('pause').classList.add('off'); }
}

// ---------- HUD ----------
function updateHud() {
  const pips = $('pips');
  if (pips.childElementCount !== GOAL) { pips.innerHTML = ''; for (let i = 0; i < GOAL; i++) { const e = document.createElement('i'); if (i === GOAL - 1) e.className = 'home'; pips.appendChild(e); } }
  [...pips.children].forEach((e, i) => e.classList.toggle('on', G.kind === 'real' && i < G.progress));
  pips.style.visibility = G.kind === 'real' || G.mode === 'title' ? '' : 'hidden';
  const bt = $('bText'), board = $('board');
  let txt;
  if (G.mode === 'title') txt = 'LARKHILL ROAD';
  else if (G.mode === 'win') txt = 'NOT IN SERVICE';
  else if (G.here && (G.mode === 'card' || G.mode === 'show')) txt = G.here.toUpperCase();
  else txt = G.rang ? 'BUS STOPPING' : stopName().toUpperCase();
  bt.textContent = txt; board.classList.toggle('red', G.rang && G.mode === 'ride');
  const bell = $('bell'); bell.classList.toggle('lit', G.rang);
  bell.disabled = !(G.mode === 'ride' && G.phase !== 'wait');
  $('doze').disabled = !(G.mode === 'ride' && G.phase === 'ride' && !G.doze);
}

// ---------- loop ----------
let last = performance.now(), hudT = 0;
function tick(dt) {
  G.sec += dt;
  if (G.mode === 'ride' && !G.paused) {
    if (G.phase === 'depart') { G.phaseT += dt; if (G.phaseT > 1.1) { G.phase = 'ride'; updateHud(); } }
    else if (G.phase === 'ride') {
      const rate = G.doze ? 7 : 1;
      G.t = Math.min(1, G.t + dt * rate / RIDE);
      if (G.kind === 'tut2' && !G.rang && G.t > .3 && G.hint === 0) { G.hint = 1; card('SOMETHING’S WRONG', '<p>Something up front isn’t how it was. When anything has changed, <em>ring the bell</em>: the red STOP button, or Space.</p>'); }
      if (G.t >= 1) { G.phase = 'arrive'; G.phaseT = 0; sound.hiss(1); G.doze = 0; updateHud(); }
    } else if (G.phase === 'arrive') { G.phaseT += dt; if (G.phaseT > 1.6) resolve(); }
  }
  if (G.mode === 'title') G.t = (G.t + dt / RIDE) % 1 || .01;
  G.dozeA += ((G.doze ? 1 : 0) - G.dozeA) * Math.min(1, dt * 5);
  const k = 1 - Math.exp(-dt * 12);
  G.zoom += (G.zT - G.zoom) * k; G.zx += (G.zxT - G.zx) * k; G.zy += (G.zyT - G.zy) * k;
  G.flash = Math.max(0, G.flash - dt * 5);
  cv.classList.toggle('zoomed', G.zT > 1.02);
}
function render() {
  const S = routeDist(G.t), v = G.mode === 'ride' && G.phase === 'ride' ? routeSpeed(G.t) : (G.mode === 'title' ? routeSpeed(G.t) : 0);
  const doors = G.mode === 'ride' && G.phase === 'arrive' ? Math.min(1, G.phaseT * 3) : (G.mode === 'ride' && G.phase === 'depart' ? Math.max(0, 1 - G.phaseT * 2) : (G.phase === 'wait' ? 1 : 0));
  const st = { t: G.t, S, v, sec: G.sec, stop: stopName(), rang: G.rang, doors, a: active };
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.fillStyle = '#000'; cx.fillRect(0, 0, L.lw, L.lh);
  const s = L.lw / W * G.zoom;
  cx.setTransform(s, 0, 0, s, L.lw / 2 - G.zx * s, L.lh / 2 - G.zy * s);
  drawView(cx, G.view, st);
  cx.setTransform(1, 0, 0, 1, 0, 0);
  const dark = Math.max(G.flash * .85, G.dozeA * .92, G.mode === 'title' ? .25 : 0);
  if (dark > .01) { cx.fillStyle = `rgba(0,0,0,${dark})`; cx.fillRect(0, 0, L.lw, L.lh); }
  dither(L.lw, L.lh);
  sound.update(v, G.paused || G.mode === 'title' || G.dozeA > .5, active('lightsFlicker') && G.view === 1 && (G.sec % 3.4 < .5) ? 1 : 0, G.mode !== 'title');
}
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (!G.hold) tick(dt);
  render();
  requestAnimationFrame(frame);
}

// debug: nb.ff(seconds) fast-forwards; nb.anom('id', view) forces an anomaly
Object.assign(window.nb, {
  ff(sec) { G.hold = true; for (let i = 0; i < sec * 20; i++) tick(.05); render(); },
  run() { G.hold = false; },
  anom(id, view = ANOM[id]?.view ?? 1, t = .6) { $('title').classList.add('off'); hideCard(); G.mode = 'ride'; G.kind = 'real'; G.phase = 'ride'; G.anom = id; G.t = t; setView(view, true); unzoom(true); G.hold = true; render(); },
  ring, doze, setView, startRide, newRun, render, layout, toTitle,
});

async function boot() {
  try { await Promise.race([Promise.all([document.fonts.load('24px Tiny5'), document.fonts.load('13px Silkscreen')]), new Promise(r => setTimeout(r, 2500))]); } catch {}
  warmTextures();
  layout();
  if (DEMO) {
    $('title').classList.add('off'); G.mode = 'ride'; G.kind = 'real'; G.phase = 'ride'; G.t = .38; G.progress = 3; G.anom = null; G.sec = 3;
    updateHud();
  } else { toTitle(); }
  if (DEBUG && Q.get('anom')) nb.anom(Q.get('anom'), Q.has('view') ? +Q.get('view') : undefined);
  updateHud();
  requestAnimationFrame(t => { last = t; frame(t); });
}
boot();
