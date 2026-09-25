/* Glowmoss Hollow · the world: nine places on a 3×3 grid, revealed one passage at a time.
   Owns the camera, the reveal dissolve, input, captions and the frame loop. */
'use strict';
(() => {
const GROUND = '#06050b';
// the order places are found in: a spiral out of the hollow, east then round anticlockwise
const PLACES = [
  { id: 'hollow',  name: 'Glowmoss Hollow', col: 1, row: 1, seed: 90210, accent: '#7fe6d6', quiet: 'The hollow is quiet', hint: 'Light glints through a crack in the east wall' },
  { id: 'wood',    name: 'Fernlight Wood',  col: 2, row: 1, seed: 4471,  accent: '#c8ff58', quiet: 'The wood is hushed', hint: 'Moonlight leaks through a gap in the canopy' },
  { id: 'peaks',   name: 'Duskcrag Peaks',  col: 2, row: 0, seed: 7219,  accent: '#ffb08a', quiet: 'Wind combs the peaks', hint: 'An old rope bridge lies half-buried in the snow' },
  { id: 'barrens', name: 'Aurora Barrens',  col: 1, row: 0, seed: 3303,  accent: '#8affc8', quiet: 'Snow settles on the barrens', hint: 'Something warm glows inside the ice wall' },
  { id: 'grove',   name: 'Petalfall Grove', col: 0, row: 0, seed: 6158,  accent: '#ffa6d0', quiet: 'Petals drift over the grove', hint: 'Water trickles through a crack beneath the pond' },
  { id: 'dunes',   name: 'Moonsand Dunes',  col: 0, row: 1, seed: 2742,  accent: '#ffd08a', quiet: 'The dunes are cooling', hint: 'Sand is whispering down a hollow in the dune' },
  { id: 'deep',    name: 'Cinder Deep',     col: 0, row: 2, seed: 9087,  accent: '#ff8a4a', quiet: 'The deep hisses softly', hint: 'Cool blue light seeps through a seam in the basalt' },
  { id: 'reef',    name: 'Lantern Reef',    col: 1, row: 2, seed: 5521,  accent: '#6fe8ff', quiet: 'The reef sways', hint: 'Light glows around a boulder in the eastern rocks' },
  { id: 'bayou',   name: 'Wisp Bayou',      col: 2, row: 2, seed: 8830,  accent: '#b8ff9a', quiet: 'The bayou hums' }
];
const TOTAL = PLACES.length;

const stage = document.getElementById('stage'), cv = document.getElementById('world'), g = cv.getContext('2d');
const placeEl = document.getElementById('place'), countEl = document.getElementById('count'), capEl = document.getElementById('cap'), outBtn = document.getElementById('out'), bar = document.getElementById('bar');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let T = 6, found = 1, dpr = 1;

/* ---------- places ---------- */
function create(i) {
  const P = PLACES[i]; if (P.S) return P.S;
  const E = makeEnv(P.seed);
  E.place = P;
  const S = SCENES[P.id](E);
  Object.assign(S, { E, P, idx: i, col: P.col, row: P.row, rv: 1, revT: 0, mask: null });
  S.dir = makeDirector(S);
  E.say = (text, byHand) => onSay(S, text, byHand);
  for (let k = 0; k < 360; k++) { const t = T - 6 + k / 60; S.ambient(1 / 60, t); E.step(1 / 60); }
  return (P.S = S);
}
const live = () => PLACES.slice(0, found).map(P => P.S);
const sceneAt = (wx, wy) => { const c = Math.floor(wx / W), r = Math.floor(wy / H); for (let i = 0; i < found; i++) if (PLACES[i].col === c && PLACES[i].row === r) return PLACES[i].S; return null; };
const frontier = () => found < TOTAL ? PLACES[found - 1].S : null;

// the dissolve that reveals a new place, spreading out from where the passage comes in
const MC = 4, MW = W / MC, MH = H / MC;
function makeMask(S) {
  const c = mk(MW, MH), x = c.getContext('2d'), img = x.createImageData(MW, MH), th = new Float32Array(MW * MH);
  const e = S.entry || { x: W / 2, y: H / 2 };
  let max = 0;
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) max = Math.max(max, Math.hypot(i * MC + 2 - e.x, j * MC + 2 - e.y));
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) th[j * MW + i] = Math.hypot(i * MC + 2 - e.x, j * MC + 2 - e.y) / max + bay(i, j) * .2 + hash(i, j) * .06;
  return { c, x, img, th, acc: rgb(S.P.accent), bg: rgb(GROUND) };
}
function drawMask(S) {
  const m = S.mask || (S.mask = makeMask(S)), D = m.img.data, v = S.rv * 1.3;
  for (let i = 0; i < m.th.length; i++) {
    const d = v - m.th[i], k = i * 4;
    if (d < 0) { D[k] = m.bg[0]; D[k + 1] = m.bg[1]; D[k + 2] = m.bg[2]; D[k + 3] = 255; }
    else if (d < .06) { D[k] = m.acc[0]; D[k + 1] = m.acc[1]; D[k + 2] = m.acc[2]; D[k + 3] = 200 * (1 - d / .06); }
    else D[k + 3] = 0;
  }
  m.x.putImageData(m.img, 0, 0);
  g.imageSmoothingEnabled = false; g.drawImage(m.c, 0, 0, W, H);
}
function reveal() {
  const from = frontier(); if (!from) return;
  const S = create(found);
  from.openExit(); from.E.hot = 0;
  S.rv = 0; S.revT = reduced ? 0 : -.45; found++;
  setView('all');
  say(`The way opens into ${S.P.name}`, true, S);
  hintAt = T + 18;
  updateBar();
  // paint the next place ahead of time, once this reveal has settled
  if (found < TOTAL) setTimeout(() => create(found), 2400);
}

/* ---------- camera ---------- */
const cam = { x: W * 1.5, y: H * 1.5, z: 1, tw: null };
let view = { mode: 'all', S: null };
function bbox() {
  let c0 = 9, c1 = -1, r0 = 9, r1 = -1;
  for (let i = 0; i < found; i++) { const P = PLACES[i]; c0 = Math.min(c0, P.col); c1 = Math.max(c1, P.col); r0 = Math.min(r0, P.row); r1 = Math.max(r1, P.row); }
  return { x0: c0 * W, y0: r0 * H, x1: (c1 + 1) * W, y1: (r1 + 1) * H };
}
// fit a world rectangle into the canvas; snap to whole device pixels per place pixel when that costs little
function fit(x0, y0, x1, y1, pad) {
  const cw = cv.width, ch = cv.height, bw = x1 - x0, bh = y1 - y0;
  const f = (pl, pt) => { let z = Math.min((cw - pl - pad) / bw, (ch - pt - pad) / bh); const n = Math.floor(z); if (n >= 1 && n / z > .84) z = n; return z; };
  let z = f(pad, pad), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  // keep clear of the Home button in the top-left corner
  const left = cw / 2 - bw / 2 * z, top = ch / 2 - bh / 2 * z, hb = 58 * dpr;
  if (left < hb && top < hb) { z = f(pad, hb + pad); cy -= hb / 2 / z; }
  return { x: cx, y: cy, z };
}
const overview = () => { const b = bbox(); return fit(b.x0, b.y0, b.x1, b.y1, 18 * dpr); };
const tileView = S => fit(S.col * W, S.row * H, S.col * W + W, S.row * H + H, 6 * dpr);
function goal() { return view.mode === 'tile' ? tileView(view.S) : overview(); }
function setView(mode, S, instant) {
  view = { mode, S: S || null };
  const to = goal();
  if (instant || reduced) { cam.x = to.x; cam.y = to.y; cam.z = to.z; cam.tw = null; }
  else tween(to, mode === 'all' && found > 1 ? 1.5 : 1);
  updateBar();
}
// zoom tweens keep one world point fixed on screen, so a place grows out of where it sits
function tween(to, dur) { cam.tw = { a: { x: cam.x, y: cam.y, z: cam.z }, b: to, t: 0, dur }; }
function stepCam(dt) {
  const w = cam.tw; if (!w) return;
  w.t += dt; const u = Math.min(1, w.t / w.dur), e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  const { a, b } = w, z = Math.exp(lerp(Math.log(a.z), Math.log(b.z), e));
  if (Math.abs(a.z - b.z) / b.z > .02) {
    const fx = (a.x * a.z - b.x * b.z) / (a.z - b.z), fy = (a.y * a.z - b.y * b.z) / (a.z - b.z);
    // blend toward a straight pan when the fixed point sits far outside the view
    cam.x = fx - (fx - a.x) * a.z / z; cam.y = fy - (fy - a.y) * a.z / z;
    const lx = lerp(a.x, b.x, e), ly = lerp(a.y, b.y, e), far = clamp((Math.hypot(fx - a.x, fy - a.y) * a.z / Math.max(cv.width, cv.height) - 1.5) / 2, 0, 1);
    cam.x = lerp(cam.x, lx, far); cam.y = lerp(cam.y, ly, far);
  } else { cam.x = lerp(a.x, b.x, e); cam.y = lerp(a.y, b.y, e); }
  cam.z = z;
  if (u >= 1) { cam.x = b.x; cam.y = b.y; cam.z = b.z; cam.tw = null; }
}
function clampCam() {
  const b = bbox(), hw = cv.width / 2 / cam.z, hh = cv.height / 2 / cam.z;
  cam.x = b.x1 - b.x0 > hw * 2 ? clamp(cam.x, b.x0 + hw, b.x1 - hw) : (b.x0 + b.x1) / 2;
  cam.y = b.y1 - b.y0 > hh * 2 ? clamp(cam.y, b.y0 + hh, b.y1 - hh) : (b.y0 + b.y1) / 2;
}
function focused() {
  if (view.mode === 'tile') return view.S;
  if (found === 1) return PLACES[0].S;
  if (view.mode === 'free') { const S = sceneAt(cam.x, cam.y); if (S && cam.z >= tileView(S).z * .8) return S; }
  return null;
}
const toWorld = (sx, sy) => ({ x: cam.x + (sx * dpr - cv.width / 2) / cam.z, y: cam.y + (sy * dpr - cv.height / 2) / cam.z });

/* ---------- captions + bar ---------- */
let capBy = null, capAt = -99, hintAt = T + 6, beaconAt = T + 2.5, hovered = null;
function setCap(text, on) { if (capEl.textContent !== text) capEl.textContent = text; capEl.classList.toggle('on', !!on); capEl.classList.remove('hint'); }
function say(text, on, S) { setCap(text, on); capBy = S || null; capAt = T; }
function onSay(S, text, byHand) {
  if (text === null) { if (capBy === S) capEl.classList.remove('on'); return; }
  const F = focused();
  if (F && F !== S) return;
  if (!F && !byHand && (T - capAt < 3.5 || capEl.classList.contains('on') && capBy !== S)) return;
  say(text, true, S);
}
function showHint() {
  const S = frontier(); if (!S || !S.P.hint || capEl.classList.contains('on')) return;
  const F = focused(); if (F && F !== S) return;
  setCap(S.P.hint, false); capEl.classList.add('hint'); capBy = null; capAt = T;
}
function updateBar() {
  const F = view.mode === 'tile' ? view.S : focused();
  const name = F ? F.P.name : hovered ? hovered.P.name : 'Glowmoss Hollow';
  if (placeEl.textContent !== name) placeEl.textContent = name;
  countEl.textContent = found > 1 ? `${found} of ${TOTAL} places` : '';
  outBtn.hidden = found < 2 || view.mode === 'all';
  const b = bbox(), w = view.mode === 'tile' ? W * tileView(view.S).z : (b.x1 - b.x0) * overview().z;
  bar.style.maxWidth = Math.max(300, Math.round(w / dpr)) + 'px';
}
function enterPlace(S) {
  setView('tile', S);
  if (capBy !== S) say(S.P.quiet, false, S);
}

/* ---------- input ---------- */
const pts = new Map();
let drag = null, pinch = null, settleT = 0;
function hitExit(S, x, y) {
  const F = frontier(); if (S !== F || !S.exit) return false;
  const r = Math.max(S.exit.r, 16 * dpr / cam.z);
  return Math.hypot(x - S.exit.x, y - S.exit.y) <= r;
}
function probe(sx, sy) {
  const w = toWorld(sx, sy), S = sceneAt(w.x, w.y);
  if (!S || S.rv < 1) return { S: null };
  const x = w.x - S.col * W, y = w.y - S.row * H;
  if (hitExit(S, x, y)) return { S, exit: true };
  const F = focused();
  if (F === S) return { S, focus: true, c: critterAt(S, x, y, Math.max(3, 10 * dpr / cam.z)) };
  return { S };
}
function click(sx, sy) {
  const h = probe(sx, sy);
  if (h.exit) return reveal();
  if (!h.S) { if (found > 1 && view.mode !== 'all') setView('all'); return; }
  if (h.focus) { if (h.c) h.S.dir.fire(h.c, true); else h.S.dir.poke(); return; }
  enterPlace(h.S);
}
function hover(sx, sy) {
  const h = probe(sx, sy);
  for (const S of live()) S.hotTo = 0;
  if (h.exit) h.S.hotTo = 1;
  cv.style.cursor = h.exit || h.c ? 'pointer' : h.focus ? 'pointer' : h.S ? 'zoom-in' : found > 1 && view.mode !== 'all' ? 'zoom-out' : 'default';
  const nh = !h.focus && h.S ? h.S : null;
  if (nh !== hovered) { hovered = nh; updateBar(); }
}
function zoomAt(sx, sy, f) {
  const ov = overview(), S = sceneAt(cam.x, cam.y) || PLACES[0].S, max = tileView(S).z * 5;
  const z = clamp(cam.z * f, ov.z * .9, max); if (z === cam.z) return;
  const w = toWorld(sx, sy);
  cam.z = z; cam.x = w.x - (sx * dpr - cv.width / 2) / z; cam.y = w.y - (sy * dpr - cv.height / 2) / z;
  cam.tw = null; view = { mode: 'free', S: null }; clampCam(); settleT = .28; updateBar();
}
function settle() {
  const ov = overview();
  if (cam.z < ov.z * 1.12) { setView('all'); return; }
  const S = sceneAt(cam.x, cam.y); if (!S) return;
  const tv = tileView(S);
  if (Math.abs(Math.log(cam.z / tv.z)) < .12) enterPlace(S);
}
const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
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
    zoomAt(m.x, m.y, d / pinch.d); cam.x -= (m.x - pinch.m.x) * dpr / cam.z; cam.y -= (m.y - pinch.m.y) * dpr / cam.z; clampCam();
    pinch = { d, m }; return;
  }
  if (!drag) return;
  if (!drag.moved && Math.hypot(q.x - drag.x, q.y - drag.y) > 6) drag.moved = true;
  if (drag.moved && cam.z > overview().z * 1.05) {
    cam.x -= (q.x - prev.x) * dpr / cam.z; cam.y -= (q.y - prev.y) * dpr / cam.z; cam.tw = null;
    if (view.mode !== 'free') { view = { mode: 'free', S: null }; }
    clampCam(); settleT = .35; cv.style.cursor = 'grabbing';
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
cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !pts.size) { for (const S of live()) S.hotTo = 0; if (hovered) { hovered = null; updateBar(); } } });
cv.addEventListener('wheel', e => {
  e.preventDefault(); const q = pos(e);
  const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  zoomAt(q.x, q.y, Math.exp(-d * (e.ctrlKey ? .012 : .0025)));
}, { passive: false });
outBtn.addEventListener('click', () => { setView('all'); cv.focus({ preventScroll: true }); });
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const F = focused(), k = e.key;
  if (k === 'Escape' || k === '-' || k === '_') { if (found > 1) setView('all'); }
  else if (k === '+' || k === '=') { if (!F) enterPlace(sceneAt(cam.x, cam.y) || PLACES[0].S); }
  else if (k === 'n' || k === 'N') reveal();
  else if ((k === ' ' || k === 'Enter') && document.activeElement === cv) { e.preventDefault(); if (F) F.dir.poke(); else enterPlace(sceneAt(cam.x, cam.y) || PLACES[0].S); }
  else if (k.startsWith('Arrow')) {
    const from = F || sceneAt(cam.x, cam.y) || PLACES[0].S, dc = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0, dr = k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0;
    const to = sceneAt((from.col + dc + .5) * W, (from.row + dr + .5) * H); if (to) { e.preventDefault(); enterPlace(to); }
  }
});

/* ---------- size ---------- */
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  const w = Math.max(1, Math.round(stage.clientWidth * dpr)), h = Math.max(1, Math.round(stage.clientHeight * dpr));
  if (cv.width === w && cv.height === h) return;
  cv.width = w; cv.height = h;
  if (view.mode === 'free') clampCam(); else { const to = goal(); cam.x = to.x; cam.y = to.y; cam.z = to.z; cam.tw = null; }
  updateBar();
}
new ResizeObserver(resize).observe(stage);

/* ---------- render ---------- */
function render() {
  const cw = cv.width, ch = cv.height, z = cam.z;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.fillStyle = GROUND; g.fillRect(0, 0, cw, ch);
  const ox = Math.round(cw / 2 - cam.x * z), oy = Math.round(ch / 2 - cam.y * z);
  for (const S of live()) {
    const x = ox + S.col * W * z, y = oy + S.row * H * z;
    if (x > cw || y > ch || x + W * z < 0 || y + H * z < 0) continue;
    if (S.rv <= 0) continue;
    S.E.lights.length = 0; S.E.wlights.length = 0;
    S.draw(T);
    g.setTransform(z, 0, 0, z, Math.round(x), Math.round(y));
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip();
    composite(g, S, T, z);
    if (S.rv < 1) drawMask(S);
    g.restore();
  }
}

/* ---------- loop ---------- */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  step(Math.min(.05, Math.max(0, (now - last) / 1000))); last = now;
}
function step(dt) {
  T += dt;
  stepCam(dt);
  if (settleT > 0 && !pts.size) { settleT -= dt; if (settleT <= 0) settle(); }
  for (const S of live()) {
    S.E.hot += ((S.hotTo || 0) - S.E.hot) * Math.min(1, dt * 8);
    if (S.rv < 1) { S.revT += dt; S.rv = clamp(S.revT / 1.8, 0, 1); }
    S.update(dt, T); S.E.step(dt); S.dir.update(dt);
  }
  if (T > hintAt && T - capAt > 3 && !capEl.classList.contains('on')) { showHint(); hintAt = T + 20; }
  // a soft pulse from the passage that hasn't been opened yet
  const F = frontier();
  if (F && F.exit && T > beaconAt) { beaconAt = T + 3.2; F.E.ring(F.exit.x, F.exit.y, 20, F.P.accent, 1.8); }
  render();
}

/* ---------- start ---------- */
create(0);
const q = new URLSearchParams(location.search);
if (q.has('all') || q.has('at') || q.has('found')) {
  const n = q.has('found') ? clamp(parseInt(q.get('found'), 10) || 1, 1, TOTAL) : TOTAL;
  for (let i = 1; i < n; i++) { create(i); PLACES[i - 1].S.openExit(); }
  found = n;
}
resize();
const at = PLACES.findIndex(P => P.id === q.get('at'));
if (at >= 0 && at < found) setView('tile', PLACES[at].S, true); else setView('all', null, true);
if (found < TOTAL) setTimeout(() => create(found), 900);
updateBar();
if (q.has('debug')) window.GM = { cam, PLACES, reveal, setView, enterPlace, create, step, get T() { return T; } };
requestAnimationFrame(frame);
})();
