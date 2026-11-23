import { makeAtlas } from './atlas.js';
import { COUNTRIES, BIOME_NAME, pickLocation, rng, hash, nearestTown, KMW, KMH } from './world.js';
import { makeScene } from './scene.js';
import { renderPano } from './pano.js';
import { bakeMap, MapView } from './map.js';
import { sfx, unlock, isMuted, setMuted } from './sound.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo');
const DEBUG = Q.has('debug');

const atlas = makeAtlas();
const { world } = atlas;
const baked = bakeMap(atlas);

// ---------- saved things
const SAVE_KEY = 'plonk-v1';
let save = { tut: false, cards: [null, null, null, null], daily: {}, best: 0 };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) save = { ...save, ...s }; } catch {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} };

// ---------- canvases
const pano = $('pano'), pctx = pano.getContext('2d');
const comp = $('compcv'), cctx = comp.getContext('2d');
const map = new MapView($('mapcv'), atlas, baked);
const mapbox = $('mapbox');

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  pano.width = Math.round(W * DPR); pano.height = Math.round(H * DPR);
  const r = comp.getBoundingClientRect();
  comp.width = Math.round(r.width * DPR); comp.height = Math.round(r.height * DPR);
  map.size(); dirty = true;
}
addEventListener('resize', resize);

// ---------- state
const ROUNDS = 5;
let mode = 'title'; // title | play | result | final
let game = null;     // { kind, locs, i, results: [], total }
let scene = null;
const view = { yaw: 0, zoom: 1, camU: 0, targetU: 0 };
let dirty = true;
let lastPano = { f: 600, hits: [] };
let tut = null;
let dailyKey = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const scoreFor = (km) => Math.round(5000 * Math.exp(-km / 170));

function makeLocs(kind) {
  const seed = kind === 'daily' ? hash('plonk-daily', dailyKey) : (Math.random() * 1e9) | 0;
  const r = rng(seed);
  const order = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = (r() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
  order.splice((r() * 5) | 0, 0, (r() * 4) | 0);
  return order.slice(0, ROUNDS).map((c) => pickLocation(world, r, c));
}

// the lesson spot: a Calimbe road with a signpost to a nearby town
function tutorialLoc() {
  const r = rng(4242);
  for (let i = 0; i < 2000; i++) {
    const loc = pickLocation(world, r, 1);
    if (!loc) continue;
    loc.signs = true; loc.signAt = 46;
    const sc = makeScene(atlas, loc);
    if (sc.biome === 'fog' || sc.s >= 1) continue;
    const sign = sc.signs.find((s) => s.t === 'sign' && s.face === -1);
    if (!sign || sign.rows[0].km > 16 || sign.rows[0].km < 6) continue;
    const [tw] = nearestTown(world, loc.x, loc.y);
    void tw;
    return loc;
  }
  return pickLocation(world, r, 1);
}
const TUT_LOC = tutorialLoc();

function setScene(loc, yawOff = 0) {
  scene = makeScene(atlas, loc);
  view.yaw = loc.dir + yawOff; view.zoom = 1; view.camU = 0; view.targetU = 0;
  dirty = true;
}

// ---------- flow
function startGame(kind) {
  unlock();
  game = { kind, locs: kind === 'tutorial' ? [TUT_LOC] : makeLocs(kind), i: 0, results: [], total: 0 };
  closeSheet();
  startRound();
}
function startRound() {
  mode = 'play';
  const loc = game.locs[game.i];
  setScene(loc, game.kind === 'tutorial' ? 160 : (rng(loc.seed)() < 0.5 ? 0 : 180));
  map.pin = null; map.truth = null; map.extra = []; map.highlight = null; map.opened = false;
  mapbox.className = 'dock';
  map.size(); map.fit();
  $('maptitle').textContent = 'Where are you?';
  updateGuess(); updateChip();
  if (game.kind === 'tutorial') beginTutorial(); else endTutorial();
  $('hud').style.display = '';
}
function updateChip() {
  if (!game) return;
  $('chipk').textContent = game.kind === 'tutorial' ? 'Lesson' : `Round ${Math.min(game.i + 1, ROUNDS)} of ${ROUNDS}`;
  $('chipv').textContent = game.kind === 'tutorial' ? 'Practice' : fmt(game.total);
}
function updateGuess() {
  const b = $('guess');
  b.disabled = !map.pin || mode !== 'play';
  b.textContent = map.pin ? 'Guess' : 'Place a pin';
}

function doGuess() {
  if (mode !== 'play' || !map.pin) return;
  sfx.stamp();
  const loc = game.locs[game.i];
  const km = Math.hypot(map.pin[0] - loc.x, map.pin[1] - loc.y);
  const pts = game.kind === 'tutorial' ? scoreFor(km) : scoreFor(km);
  const guessCountry = world.land(map.pin[0], map.pin[1]) ? world.countryAt(map.pin[0], map.pin[1]) : -1;
  const res = { km, pts, guess: map.pin.slice(), truth: [loc.x, loc.y], country: loc.country, rightCountry: guessCountry === loc.country, biome: scene.biome };
  game.results.push(res); game.total += pts;
  mode = 'result';
  tutNote(null);
  mapbox.className = 'result';
  $('maptitle').textContent = `${COUNTRIES[loc.country].name} · ${BIOME_NAME[res.biome]}`;
  map.size();
  map.truth = res.truth;
  map.lineT = 0;
  map.frame([res.guess, res.truth], 50);
  const t0 = performance.now();
  const anim = () => { map.lineT = Math.min(1, (performance.now() - t0) / 700); map.dirty = true; if (map.lineT < 1) requestAnimationFrame(anim); else (pts > 2500 ? sfx.good : sfx.okay)(); };
  requestAnimationFrame(anim);
  updateChip();
  showResult(res);
  frameAround([res.guess, res.truth]);
}
// keep the pins clear of the card that sits over the map
function frameAround(points) {
  const r = $('sheet').getBoundingClientRect(), m = $('mapcv').getBoundingClientRect();
  const side = r.left > m.left + m.width * 0.35 && r.top < m.top + m.height * 0.5;
  const inset = side ? { r: Math.max(0, m.right - r.left + 10), b: 0 } : { r: 0, b: Math.max(0, m.bottom - r.top + 10) };
  map.frame(points, 44, inset);
}

function showResult(res) {
  const last = game.i >= game.locs.length - 1;
  const c = COUNTRIES[res.country];
  const kmTxt = res.km < 1 ? 'Right on the spot' : `${fmt(res.km)} km away`;
  const tag = res.km < 1 ? '' : res.km < 25 ? 'Spot on.' : res.km < 80 ? 'Very close.' : res.rightCountry ? `Right country.` : `It was ${c.name}.`;
  const newCard = !save.cards[res.country];
  let html = `<div class="kicker">${game.kind === 'tutorial' ? 'Your first guess' : `Round ${game.i + 1} of ${ROUNDS}`}</div>
    <div class="stats"><div><div class="big-num">${kmTxt}</div></div></div>
    <p>${tag} You were in <b>${c.name}</b>, in ${BIOME_NAME[res.biome]}.</p>
    <div class="meter"><i id="meterfill"></i></div>
    <div class="stats"><div><span class="k">Points</span><br><b>${fmt(res.pts)}</b> / 5,000</div>${game.kind !== 'tutorial' ? `<div><span class="k">Total</span><br><b>${fmt(game.total)}</b></div>` : ''}</div>`;
  if (game.kind === 'tutorial') html += `<p class="small">Points fall off with distance: within about 20 km is nearly full marks, and the wrong side of the continent is close to nothing.</p>`;
  html += `<div class="btns row"><button class="btn red" id="next">${newCard ? 'A postcard came' : last ? 'See how you did' : 'Next place'}</button></div>`;
  openSheet(html, 'result-sheet', true);
  requestAnimationFrame(() => { const m = $('meterfill'); if (m) m.style.width = `${(res.pts / 5000) * 100}%`; });
  $('next').onclick = () => {
    sfx.click();
    if (newCard) {
      const loc = game.locs[game.i];
      save.cards[res.country] = { x: loc.x, y: loc.y, dir: loc.dir, country: loc.country, seed: loc.seed, signs: loc.signs, signAt: loc.signAt };
      persist();
      showPostcard(res.country, () => nextAfterResult());
    } else nextAfterResult();
  };
  $('next').focus({ preventScroll: true });
}
function nextAfterResult() {
  if (game.kind === 'tutorial') { save.tut = true; persist(); return showTutorialEnd(); }
  if (game.i >= game.locs.length - 1) return showFinal();
  game.i++;
  closeSheet();
  startRound();
}

const NOTES = [
  'It is cold up here, and every road has a <b>solid yellow line</b> down the middle. The houses are red or mustard under <b>steep dark roofs</b> to shed the snow.',
  'Everyone drives on the <b>left</b>, and the middle of the road is a <b>dashed white line</b>. No posts by the verge, just <b>low stone walls</b>. Foggy on the west coast!',
  'Hot and dusty. The roads have <b>no middle line</b> at all, only <b>yellow edges</b>, and short <b>red and white posts</b>. Flat roofs everywhere.',
  'They drive on the <b>left</b> too, between <b>double white lines</b>. And not one telegraph pole: <b>the wires are all buried</b>. Terracotta roofs, green shutters.',
];
function postcardHTML(ci, locked) {
  const c = COUNTRIES[ci];
  if (locked) return `<div class="postcard locked"><div class="pic"><canvas width="480" height="270" data-blank="1"></canvas><div class="greet"><small>Not yet</small>${c.name}</div></div><div class="back"><div class="note">Play a round in ${c.name} to get this card.</div><div class="stamp">${c.name}</div></div></div>`;
  return `<div class="postcard"><div class="pic"><canvas width="480" height="270" data-card="${ci}"></canvas><div class="greet"><small>Greetings from</small>${c.name}</div></div>
    <div class="back"><div class="note">${NOTES[ci]}</div><div class="stamp"><span><b>${c.name}</b>post<br>${['3', '5', '2', '4'][ci]} cr</span></div></div></div>`;
}
function paintCards(root) {
  root.querySelectorAll('canvas[data-card]').forEach((cv) => {
    const ci = +cv.dataset.card, l = save.cards[ci];
    if (!l) return;
    const sc = makeScene(atlas, l);
    const g = cv.getContext('2d');
    renderPano(g, cv.width, cv.height, sc, { yaw: l.dir + 18, zoom: 1, camU: 0 });
  });
  root.querySelectorAll('canvas[data-blank]').forEach((cv) => { const g = cv.getContext('2d'); g.fillStyle = '#d9d2c0'; g.fillRect(0, 0, cv.width, cv.height); });
}
function showPostcard(ci, then) {
  sfx.page();
  openSheet(`<div class="kicker">A postcard came</div>${postcardHTML(ci)}<p class="small">Postcards give you a head start. There's more to notice: poles, posts, sign colours, number plates, the scripts.</p><div class="btns row"><button class="btn red" id="pcok">${game && game.i >= game.locs.length - 1 && game.kind !== 'tutorial' ? 'See how you did' : 'Carry on'}</button></div>`, 'result-sheet');
  paintCards($('sheet'));
  $('pcok').onclick = () => { sfx.click(); then(); };
  $('pcok').focus({ preventScroll: true });
}

function showFinal() {
  mode = 'final';
  const isDaily = game.kind === 'daily';
  let best = false;
  if (isDaily) { const prev = save.daily[dailyKey]; if (prev == null || game.total > prev) { save.daily[dailyKey] = game.total; best = prev != null; } }
  if (game.total > save.best) save.best = game.total;
  persist();
  map.extra = game.results.map((r, i) => ({ guess: r.guess, truth: r.truth, n: String(i + 1) }));
  map.pin = null; map.truth = null;
  $('maptitle').textContent = isDaily ? `Today's trip · ${dailyKey}` : 'Free roam';
  const rows = game.results.map((r, i) => `<tr><td>${i + 1}. ${COUNTRIES[r.country].name}</td><td>${fmt(r.km)} km</td><td>${fmt(r.pts)}</td></tr>`).join('');
  const verdict = game.total > 20000 ? 'A seasoned traveller.' : game.total > 13000 ? 'You know your way around.' : game.total > 7000 ? 'Getting the lie of the land.' : 'Still finding your feet. Look at the postcards!';
  openSheet(`<div class="kicker">${isDaily ? "Today's trip" : 'Free roam'}</div><h2>${fmt(game.total)} points</h2><p>${verdict}${best ? ' A new best for today.' : ''}</p>
    <table class="log">${rows}</table>
    <div class="btns row"><button class="btn red" id="again">Free roam</button><button class="btn ghost" id="totitle">Title</button></div>`, 'result-sheet', true);
  $('again').onclick = () => { sfx.click(); startGame('free'); };
  $('totitle').onclick = () => { sfx.click(); showTitle(); };
  frameAround(game.results.flatMap((r) => [r.guess, r.truth]));
}

// ---------- title and menus
const DEMO_LOC = (() => {
  const r = rng(77);
  for (let i = 0; i < 3000; i++) {
    const loc = pickLocation(world, r, 0);
    if (!loc) continue;
    const sc = makeScene(atlas, loc);
    if (sc.s >= 1 && sc.biome !== 'tundra' && sc.biome !== 'alpine') { loc.signs = true; loc.signAt = 52; return loc; }
  }
  return pickLocation(world, r, 0);
})();

function showTitle() {
  mode = 'title'; game = null; endTutorial();
  setScene(DEMO_LOC, 25);
  mapbox.className = 'dock hidden';
  $('hud').style.display = 'none';
  const done = save.daily[dailyKey];
  const n = save.cards.filter(Boolean).length;
  const first = !save.tut;
  openSheet(`<div class="kicker">A guessing game</div><h1>Plonk</h1>
    <div class="sub">Somewhere on a continent that isn't on any map.</div>
    <p>Look around, walk up the road, read the signs, then plonk a pin where you think you are. Every country has its own habits. Learn them.</p>
    <div class="btns">
      ${first ? `<button class="btn red" id="b-tut">Learn the ropes</button>` : ''}
      <button class="btn ${first ? 'ghost' : 'red'}" id="b-daily">${done != null ? `Today's trip again · best ${fmt(done)}` : "Today's trip"}</button>
      <button class="btn ghost" id="b-free">Free roam</button>
      ${first ? '' : `<button class="btn ghost" id="b-tut">Learn the ropes</button>`}
      <button class="btn ghost" id="b-cards">Postcards · ${n} of 4</button>
    </div><div class="stripe"></div>`, 'title-sheet');
  $('b-tut').onclick = () => { sfx.click(); startGame('tutorial'); };
  $('b-daily').onclick = () => { sfx.click(); startGame('daily'); };
  $('b-free').onclick = () => { sfx.click(); startGame('free'); };
  $('b-cards').onclick = () => { sfx.click(); showAlbum(showTitle); };
}
function showAlbum(back) {
  sfx.page();
  const cards = COUNTRIES.map((c, i) => postcardHTML(i, !save.cards[i])).join('');
  openSheet(`<div class="kicker">Postcards</div><h2>From the four countries</h2>
    <div class="legend">${COUNTRIES.map((c) => `<span><i style="background:${c.tint}"></i>${c.name}</span>`).join('')}</div>
    <div class="album">${cards}</div><div class="btns row"><button class="btn red" id="albumback">Back</button></div>`, 'result-sheet');
  paintCards($('sheet'));
  $('albumback').onclick = () => { sfx.click(); back(); };
}
function showMenu() {
  if (mode !== 'play') return;
  sfx.click();
  openSheet(`<div class="kicker">Paused</div><h2>Taking a breather</h2>
    <p class="small">Drag to look · tap the arrows on the road to walk · pinch or scroll to zoom · open the map to guess.</p>
    <div class="btns"><button class="btn red" id="m-res">Back to the road</button><button class="btn ghost" id="m-cards">Postcards</button><button class="btn ghost" id="m-quit">Quit to title</button></div>`, 'result-sheet');
  $('m-res').onclick = () => { sfx.click(); closeSheet(); };
  $('m-cards').onclick = () => showAlbum(showMenu);
  $('m-quit').onclick = () => { sfx.click(); showTitle(); };
}
function openSheet(html, cls, clear = false) {
  $('sheet').className = `sheet ${cls || ''}`;
  $('sheet').innerHTML = html;
  $('sheet').scrollTop = 0;
  $('veil').className = clear ? 'on clear' : 'on';
}
function closeSheet() { $('veil').className = ''; }
const sheetOpen = () => $('veil').classList.contains('on');

// ---------- tutorial
const touchy = matchMedia('(hover: none)').matches || matchMedia('(max-width: 759px)').matches;
function tutNote(step, text, buttons = []) {
  const el = $('coach');
  if (!step) { el.className = ''; return; }
  $('coachstep').textContent = step;
  $('coachtext').innerHTML = text;
  const row = $('coachrow'); row.innerHTML = '';
  for (const [label, fn, red] of buttons) { const b = document.createElement('button'); b.className = `btn ${red ? 'red' : 'ghost'}`; b.textContent = label; b.onclick = fn; row.appendChild(b); }
  el.className = 'on';
}
function beginTutorial() {
  const sign = scene.signs.find((s) => s.t === 'sign' && s.face === -1);
  const town = world.towns.find((t) => t.word === sign.rows[0].word);
  tut = { step: 0, yaw0: view.yaw, turned: 0, t0: performance.now(), sign, town, hinted: 0 };
  tutStep(0);
}
function endTutorial() { tut = null; tutNote(null); map.highlight = null; }
function tutStep(n) {
  tut.step = n; tut.t0 = performance.now();
  const S = (k) => `Lesson ${k} of 6`;
  if (n === 0) tutNote(S(1), `You've been dropped somewhere in Calimbe, the green country in the west. <b>Drag</b> to look around${touchy ? '' : ', or use <kbd>←</kbd> <kbd>→</kbd>'}. There's a signpost up the road.`, [['Skip lesson', skipTutorial]]);
  if (n === 1) tutNote(S(2), `Walk towards the sign: <b>tap the arrow</b> on the road${touchy ? '' : ', or press <kbd>W</kbd> / <kbd>↑</kbd>'}.`);
  if (n === 2) tutNote(S(3), `Signs are written in the local script. <b>${touchy ? 'Pinch' : 'Scroll'}</b> on the sign to zoom in and read it${touchy ? '' : ', or press <kbd>+</kbd>'}.`);
  if (n === 3) tutNote(S(4), `The top line names a town <b>${tut.sign.rows[0].km} km</b> up this road. Now open the map${touchy ? ': the <b>Map &amp; guess</b> button' : ': hover over it, bottom right, or press <kbd>M</kbd>'}.`);
  if (n === 4) { tutNote(S(5), `Towns are labelled in their own script. Find the word from the sign (${touchy ? 'pinch to zoom the map' : 'scroll to zoom'}) and <b>tap the map</b> near it to plonk a pin.`); tutNoteLow(true); }
  if (n === 5) { tutNote(S(6), `Good. You're ${tut.sign.rows[0].km} km short of that town, on one of its roads. Tap again to move the pin if you like, then press <b>Guess</b>.`); tutNoteLow(true); }
}
function tutNoteLow(on) { $('coach').classList.toggle('low', on && !touchy ? false : on); }
function skipTutorial() { save.tut = true; persist(); endTutorial(); startGame('daily'); }
function tutTick() {
  if (!tut || mode !== 'play') return;
  const t = (performance.now() - tut.t0) / 1000;
  if (tut.step === 0 && tut.turned > 100) tutStep(1);
  else if (tut.step === 1 && view.camU >= tut.sign.u - 30) tutStep(2);
  else if (tut.step === 2 && view.zoom >= 1.6) tutStep(3);
  else if (tut.step === 3 && mapOpen()) tutStep(4);
  else if (tut.step === 4) {
    if (map.pin) tutStep(5);
    else if (t > 14 && tut.hinted === 0) { tut.hinted = 1; map.highlight = { x: tut.town.x, y: tut.town.y, r: 140 }; map.dirty = true; tutNote('Lesson 5 of 6', `Stuck? It's somewhere inside the red ring. Compare the shapes of the letters with the sign.`); }
    else if (t > 30 && tut.hinted === 1) { tut.hinted = 2; map.highlight = { x: tut.town.x, y: tut.town.y, r: 30 }; map.dirty = true; }
  }
  if (tut.step >= 4 && !mapOpen() && touchy) { tutStep(3); }
}
const mapOpen = () => mapbox.classList.contains('open') || mapbox.classList.contains('hot') || mapbox.classList.contains('big');
function showTutorialEnd() {
  endTutorial();
  openSheet(`<div class="kicker">That's the lot</div><h2>Now you're on your own</h2>
    <p>Every country has its own habits: the lines on the road, the posts on the verge, the roofs, the telegraph poles, the script on the signs, which side they drive on. The land helps too: snow in the north, desert east of the mountains, fog on the west coast.</p>
    <p>Each new country sends you a postcard with a couple of tips. The rest is yours to notice.</p>
    <div class="btns row"><button class="btn red" id="t-go">Today's trip</button><button class="btn ghost" id="t-title">Title</button></div>`, 'result-sheet');
  $('t-go').onclick = () => { sfx.click(); startGame('daily'); };
  $('t-title').onclick = () => { sfx.click(); showTitle(); };
}

// ---------- pano input
const ptrs = new Map();
let panoMoved = false, pinch0 = null;
pano.addEventListener('pointerdown', (e) => {
  unlock();
  pano.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
  if (ptrs.size === 1) panoMoved = false;
  if (ptrs.size === 2) { panoMoved = true; pinch0 = pinchInfo(); }
  pano.classList.add('drag');
  if (mapbox.classList.contains('hot') && !mapbox.classList.contains('big')) mapbox.classList.remove('hot');
});
function pinchInfo() { const p = [...ptrs.values()]; return { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), zoom: view.zoom, cx: (p[0].x + p[1].x) / 2 }; }
pano.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  if (mode !== 'play' && mode !== 'title') { p.x = e.clientX; p.y = e.clientY; return; }
  if (ptrs.size === 1) {
    if (!panoMoved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6) panoMoved = true;
    if (panoMoved && mode === 'play') {
      const f = lastPano.f / DPR;
      const dyaw = -(e.clientX - p.x) / f * 180 / Math.PI;
      view.yaw += dyaw; if (tut) tut.turned += Math.abs(dyaw); dirty = true;
    }
  }
  p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 2 && pinch0 && mode === 'play') { const now = pinchInfo(); setZoom(pinch0.zoom * now.d / Math.max(1, pinch0.d), now.cx); }
});
const panoUp = (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch0 = null;
  if (!ptrs.size) pano.classList.remove('drag');
  if (!panoMoved && e.type === 'pointerup' && mode === 'play' && !ptrs.size) {
    // tap: walk if it's near an arrow on the road
    let best = null, bd = 1e9;
    for (const h of lastPano.hits) { const d = Math.hypot(h.x / DPR - e.clientX, h.y / DPR - e.clientY); if (d < bd) { bd = d; best = h; } }
    if (best && bd < Math.max(70, H * 0.1)) walk(best.sgn);
  }
};
pano.addEventListener('pointerup', panoUp); pano.addEventListener('pointercancel', panoUp);
pano.addEventListener('wheel', (e) => { e.preventDefault(); if (mode === 'play') setZoom(view.zoom * Math.exp(-e.deltaY * 0.0018), e.clientX); }, { passive: false });

function setZoom(z, ax = W / 2) {
  const nz = Math.max(1, Math.min(3.5, z));
  const f0 = lastPano.f / DPR, f1 = f0 * nz / view.zoom;
  // keep whatever is under the finger where it is
  view.yaw += (Math.atan((ax - W / 2) / f0) - Math.atan((ax - W / 2) / f1)) * 180 / Math.PI;
  view.zoom = nz; dirty = true;
}
function walk(sgn) {
  if (mode !== 'play') return;
  const nu = Math.max(-480, Math.min(480, view.targetU + sgn * 12));
  if (nu === view.targetU) return;
  view.targetU = nu; sfx.step();
}

// ---------- map wiring
map.onTap = (km) => {
  if (mode !== 'play') return;
  unlock();
  map.pin = km; map.dirty = true; sfx.pin(); updateGuess();
};
const fine = matchMedia('(hover: hover) and (min-width: 760px)');
mapbox.addEventListener('mouseenter', () => { if (fine.matches && mode === 'play') { mapbox.classList.add('hot'); } });
mapbox.addEventListener('mouseleave', () => { if (fine.matches && mode === 'play' && !mapbox.classList.contains('big')) { mapbox.classList.remove('hot'); } });
$('mapbig').onclick = () => { sfx.click(); mapbox.classList.toggle('big'); if (!mapbox.classList.contains('big')) mapbox.classList.remove('hot'); };
$('mapbtn').onclick = () => { unlock(); sfx.page(); openMap(); };
$('back').onclick = () => { sfx.click(); closeMap(); };
$('guess').onclick = () => doGuess();
$('mzin').onclick = () => map.zoomAt(map.w / 2, map.h / 2, 1.5);
$('mzout').onclick = () => map.zoomAt(map.w / 2, map.h / 2, 1 / 1.5);
$('zin').onclick = () => setZoom(view.zoom * 1.35);
$('zout').onclick = () => setZoom(view.zoom / 1.35);
$('menu').onclick = () => showMenu();
function openMap() {
  if (mode !== 'play') return;
  if (fine.matches) mapbox.classList.add('hot', 'big'); else mapbox.classList.add('open');
  map.size(); if (!map.pin && !map.opened) { map.fit(); map.opened = true; }
}
function closeMap() { mapbox.classList.remove('open', 'big', 'hot'); }
const muteBtn = $('mute');
const paintMute = () => { muteBtn.innerHTML = isMuted() ? '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5c1.6 2 1.6 5 0 7M18.8 6c3 3.4 3 8.6 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'; };
muteBtn.onclick = () => { unlock(); setMuted(!isMuted()); paintMute(); };
paintMute();

// ---------- keys
const held = new Set();
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (sheetOpen()) {
    if ((k === 'Enter' || k === ' ') && !e.repeat) {
      const b = document.activeElement?.closest?.('#sheet') && document.activeElement.tagName === 'BUTTON' ? document.activeElement : $('sheet').querySelector('.btn.red');
      if (b) { e.preventDefault(); b.click(); }
    }
    if (k === 'Escape' && mode === 'play') closeSheet();
    return;
  }
  if (mode !== 'play') return;
  unlock();
  if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(k)) { held.add(k.toLowerCase()); e.preventDefault(); }
  if (k === 'ArrowUp' || k === 'w' || k === 'W') { e.preventDefault(); walk(Math.cos((view.yaw - scene.dir) * Math.PI / 180) >= 0 ? 1 : -1); }
  if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); walk(Math.cos((view.yaw - scene.dir) * Math.PI / 180) >= 0 ? -1 : 1); }
  if (k === '+' || k === '=') setZoom(view.zoom * 1.35);
  if (k === '-' || k === '_') setZoom(view.zoom / 1.35);
  if ((k === 'm' || k === 'M') && !e.repeat) { if (mapOpen()) closeMap(); else { sfx.page(); openMap(); } }
  if ((k === 'Enter' || k === ' ') && !e.repeat) { e.preventDefault(); if (map.pin) doGuess(); }
  if (k === 'Escape') { if (mapOpen()) closeMap(); else showMenu(); }
});
addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
addEventListener('blur', () => held.clear());

// ---------- compass
function drawCompass() {
  const rr = comp.getBoundingClientRect();
  if (!rr.width) return;
  const cw2 = Math.round(rr.width * DPR), ch2 = Math.round(rr.height * DPR);
  if (comp.width !== cw2 || comp.height !== ch2) { comp.width = cw2; comp.height = ch2; }
  const w = comp.width, h = comp.height;
  cctx.setTransform(1, 0, 0, 1, 0, 0);
  cctx.fillStyle = '#f3ecdc'; cctx.fillRect(0, 0, w, h);
  const ppd = w / 110;
  cctx.fillStyle = '#2a2f3a'; cctx.strokeStyle = '#2a2f3a';
  cctx.textAlign = 'center'; cctx.textBaseline = 'middle';
  const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  const yaw = ((view.yaw % 360) + 360) % 360;
  for (let a = Math.floor((yaw - 60) / 15) * 15; a <= yaw + 60; a += 15) {
    const x = w / 2 + (a - yaw) * ppd;
    const aa = ((a % 360) + 360) % 360;
    if (names[aa]) {
      const major = aa % 90 === 0;
      cctx.font = `${major ? 600 : 500} ${Math.round(h * (major ? 0.5 : 0.36))}px Jost, sans-serif`;
      cctx.fillStyle = aa === 0 ? '#c8452f' : '#2a2f3a';
      cctx.fillText(names[aa], x, h * 0.52);
    } else { cctx.fillStyle = '#2a2f3a'; cctx.fillRect(x - DPR / 2, h * 0.38, DPR, h * 0.26); }
  }
  cctx.fillStyle = '#c8452f';
  cctx.beginPath(); cctx.moveTo(w / 2 - 5 * DPR, 0); cctx.lineTo(w / 2 + 5 * DPR, 0); cctx.lineTo(w / 2, 6 * DPR); cctx.fill();
}

// ---------- loop
let lastT = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.1, (now - lastT) / 1000)); lastT = now;
  if (!(DEBUG && window.plonk?.hold)) tick(dt, now);
  requestAnimationFrame(frame);
}
function tick(dt, now = performance.now()) {
  if (mode === 'title' || (mode !== 'play' && DEMO)) { view.yaw += dt * 2.2; dirty = true; }
  if (mode === 'play') {
    let turn = 0;
    if (held.has('arrowleft') || held.has('a')) turn -= 1;
    if (held.has('arrowright') || held.has('d')) turn += 1;
    if (turn) { view.yaw += turn * 75 * dt; if (tut) tut.turned += 75 * dt; dirty = true; }
    if (view.camU !== view.targetU) {
      const s = Math.sign(view.targetU - view.camU), stepM = 26 * dt;
      view.camU = Math.abs(view.targetU - view.camU) <= stepM ? view.targetU : view.camU + s * stepM;
      dirty = true;
    }
    tutTick();
  }
  if (dirty && scene) {
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    lastPano = renderPano(pctx, pano.width, pano.height, scene, view);
    drawCompass();
    dirty = false;
  }
  if (mapbox.getClientRects().length) {
    map.size();
    if (map.dirty || map.highlight) map.draw(now / 1000);
  }
}

// ---------- start
resize();
map.size(); map.fit();
if (DEMO) {
  game = { kind: 'daily', locs: [DEMO_LOC], i: 0, results: [], total: 12940 };
  mode = 'play';
  setScene(DEMO_LOC, -18);
  view.camU = view.targetU = 14;
  updateChip(); $('chipk').textContent = 'Round 4 of 5';
  mapbox.className = 'dock hot';
  map.size(); map.fit();
  map.pin = [DEMO_LOC.x + 60, DEMO_LOC.y + 40];
  updateGuess();
  setTimeout(() => { mapbox.classList.add('hot'); map.size(); map.frame([[DEMO_LOC.x - 250, DEMO_LOC.y - 150], [DEMO_LOC.x + 250, DEMO_LOC.y + 220]], 10); }, 300);
} else showTitle();
document.fonts?.ready?.then(() => { dirty = true; map.dirty = true; });
requestAnimationFrame(frame);
window.toyboxReady?.();

if (DEBUG) {
  window.plonk = {
    hold: false, atlas, map, view, get scene() { return scene; }, get game() { return game; }, get mode() { return mode; }, get tut() { return tut; },
    tick, startGame, doGuess, walk, setZoom, openMap, closeMap, TUT_LOC, save, get hits() { return lastPano.hits.map((h) => ({ x: h.x / DPR, y: h.y / DPR, sgn: h.sgn })); },
    ff(sec) { for (let t = 0; t < sec; t += 0.05) tick(0.05); },
  };
}
void KMW; void KMH;
