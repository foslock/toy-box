import { Game, WAVES, BUILD_LEN, PAIL_MAX, PRICES, PEB_BAG } from './game.js';
import { W, H, CASTLE_X, SOLID } from './sim.js';
import { Painter, spriteCanvas, skyColors, SPRITES } from './art.js';
import { Sound } from './sound.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug') || Q.has('hold'), HOLD = Q.has('hold');
const SPEED = +(Q.get('speed') || 1);
const $ = (id) => document.getElementById(id);
const cv = $('world'), ctx = cv.getContext('2d');
const painter = new Painter();
const sound = new Sound();
const store = {
  get(k, d) { try { const v = localStorage.getItem('hightide.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('hightide.' + k, JSON.stringify(v)); } catch {} },
};

let g = null;
let mode = 'title';          // title | tut | play | end
let tool = 'dig';
let time = 0;
let V = { s: 1, ox: 0, oy: 0, x0: 0, vw: W, dpr: 1, w: 0, h: 0 };
let hover = null;            // pointer in world cells
let stroke = null;           // build stroke in progress
let ptrId = null;
let tut = null;

// ---------------------------------------------------------------- layout
function layout() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth, h = window.innerHeight;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const portrait = w / h < 1.15;
  let s, vw, x0, ox, oy;
  if (!portrait) {
    vw = W; x0 = 0;
    s = Math.min(w / W, h / (H - 14));
    ox = (w - W * s) / 2; oy = h - H * s;
  } else {
    vw = Math.min(W, Math.max(92, 96 * (w / h) / 0.46));
    s = w / vw;
    x0 = Math.max(0, Math.min(W - vw, 86 - vw / 2));
    ox = 0;
    const barH = 150;
    // the beach's surface sits just above the tool bar; the rest above is sky
    oy = Math.min(h - H * s + 6 * s, Math.max(60 - 30 * s, h - barH - 30 - 60 * s));
  }
  V = { s, vw, x0, ox, oy, dpr, w, h };
}
window.addEventListener('resize', layout);
layout();

const toWorld = (cx, cy) => [V.x0 + (cx - V.ox) / V.s, (cy - V.oy) / V.s];
const toScreen = (wx, wy) => [V.ox + (wx - V.x0) * V.s, V.oy + wy * V.s];

// ---------------------------------------------------------------- drawing
function drawWorld() {
  const b = g.beach;
  painter.begin(g.tod, time);
  painter.cells(b, time);
  // the flag on the keep
  const f = g.flag;
  painter.sprite('flag', Math.floor(time * 3) % 2, f.x + 2, Math.round(f.y));
  for (const e of g.ents) drawEnt(e);
  for (const p of g.parts) painter.dot(p.x, p.y, p.k === 4 ? [214, 248, 250] : [232, 201, 140]);
  // build cursor
  if (g.phase === 'build' && hover && (mode === 'play' || mode === 'tut')) {
    const [hx, hy] = hover;
    const ink = [31, 42, 68];
    if (tool === 'tower') ghostTower(hx, hy);
    else if (tool === 'post') { for (let y = -9; y <= 4; y++) { painter.dot(hx, hy + y, (y & 1) ? ink : [255, 244, 220]); painter.dot(hx + 1, hy + y, (y & 1) ? [255, 244, 220] : ink); } }
    else painter.ring(hx, hy, tool === 'peb' ? 2.2 : 2.6, ink);
  }
  return painter.end();
}
function ghostTower(cx, by) {
  cx = Math.round(cx); by = Math.round(by);
  for (let r = 0; r < 13; r++) {
    const half = r > 9 ? 5 : 4, y = by - 13 + r + 1;
    for (const x of [cx - half, cx + half]) painter.dot(x, y, (r & 1) ? [31, 42, 68] : [255, 244, 220]);
  }
  for (let x = cx - 4; x <= cx + 4; x++) painter.dot(x, by - 12, (x & 1) ? [31, 42, 68] : [255, 244, 220]);
}

function drawEnt(e) {
  const fl = e.dir < 0;
  const wob = e.st === 'grab' ? Math.round(Math.sin(time * 30) * 0.6) : 0;
  const x = e.x + wob, y = e.y;
  const al = Math.min(1, (e.t0 = (e.t0 ?? 0) + 1 / 60) / 0.5);
  const walkF = Math.floor(e.anim * (e.kind === 'dog' ? 12 : 7)) % 2;
  switch (e.kind) {
    case 'pickup': painter.sprite('shell', 0, x, y); if ((time * 2 + e.x) % 3 < 0.25) painter.dot(x + 1, y - 3, [255, 255, 255]); break;
    case 'crab': painter.sprite('crab', e.st === 'work' ? (e.act > 0.35 ? 2 : 0) : e.st === 'grab' || e.st === 'air' ? 2 : walkF, x, y, fl, al); break;
    case 'gull': {
      const flying = e.st === 'fly' || e.st === 'flee' || e.st === 'air' || e.st === 'grab';
      if (flying) painter.sprite('gullFly', Math.floor(e.anim * 8) % 2, x, y, fl);
      else painter.sprite('gullStand', e.act > 0.4 ? 1 : 0, x, y, fl);
      break;
    }
    case 'dog': painter.sprite('dog', e.st === 'work' ? Math.floor(e.anim * 16) % 2 : walkF, x, y, fl, al); break;
    case 'kid': painter.sprite(e.bucket ? 'kidFull' : 'kid', e.st === 'work' ? 0 : walkF, x, y, fl, al); break;
    case 'man': {
      painter.sprite('man', e.st === 'walk' || e.st === 'leave' ? walkF : 0, x, y, fl, al);
      // the metal detector, swept over the sand
      const sw = e.st === 'work' && e.t < 1.6 ? Math.sin(time * 9) * 1.5 : 0;
      const hx = x + e.dir * 3, hy = y - 7, tx = x + e.dir * (6 + sw), ty = y;
      for (let k = 0; k <= 6; k++) painter.dot(hx + (tx - hx) * k / 6, hy + (ty - hy) * k / 6, [125, 135, 150]);
      painter.dot(tx - 1, ty, [60, 66, 80]); painter.dot(tx + 1, ty, [60, 66, 80]); painter.dot(tx, ty, [60, 66, 80]);
      if (e.st === 'work' && e.t < 1.6 && (time * 5) % 1 < 0.5) painter.dot(tx, ty - 3, [255, 80, 60]);
      break;
    }
  }
}

function render() {
  const out = drawWorld();
  const { dpr, s, ox, oy, x0, vw } = V;
  const cw = cv.width, ch = cv.height;
  ctx.imageSmoothingEnabled = false;
  const X = ox * dpr, Y = oy * dpr, WW = vw * s * dpr, HH = H * s * dpr;
  // edges: stretch the outermost pixels so the beach runs off the screen
  if (Y > 0) { ctx.fillStyle = skyColors(g.tod)[0]; ctx.fillRect(0, 0, cw, Y + 1); }
  if (X > 0) {
    ctx.drawImage(out, x0, 0, 1, H, 0, Y, X + 1, HH);
    ctx.drawImage(out, x0 + vw - 1, 0, 1, H, X + WW - 1, Y, cw - X - WW + 1, HH);
  }
  ctx.drawImage(out, x0, 0, vw, H, X, Y, WW, HH);
  // below the world: keep repeating the bedrock
  for (let y = Y + HH, k = 0; y < ch && k < 40; y += 6 * s * dpr, k++) ctx.drawImage(out, x0, H - 6, vw, 6, X, y - 1, WW, 6 * s * dpr + 1);
  if (X > 0 && Y + HH < ch) { ctx.drawImage(out, x0, H - 1, 1, 1, 0, Y + HH - 1, X + 1, ch); ctx.drawImage(out, x0 + vw - 1, H - 1, 1, 1, X + WW - 1, Y + HH - 1, cw, ch); }

  // pops: pixel words that float up
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const fs = Math.round(Math.max(16, Math.min(24, s * 3)) * dpr);
  ctx.font = `${fs}px Tiny5, monospace`;
  ctx.lineJoin = 'round';
  for (const p of g.pops) {
    const [sx, sy] = toScreen(p.x, p.y - p.t * 6);
    const a = p.t < 1 ? 1 : 1 - (p.t - 1) / 0.4;
    ctx.globalAlpha = Math.max(0, a);
    ctx.lineWidth = 4 * dpr; ctx.strokeStyle = '#1f2a44'; ctx.strokeText(p.text, sx * dpr, sy * dpr);
    ctx.fillStyle = p.color; ctx.fillText(p.text, sx * dpr, sy * dpr);
  }
  ctx.globalAlpha = 1;
  if (tut) drawHint();
}

// ---------------------------------------------------------------- the pointing hand (tutorial)
const handCv = spriteCanvas('hand', 0, 1);
function drawHint() {
  const h = tut.hint && tut.hint();
  if (!h) return;
  const { dpr, s } = V;
  const sz = Math.max(3, Math.round(s * 0.9)) * dpr;
  const u = (time % h.period) / h.period;
  const [wx, wy, down] = h.at(u);
  const [sx, sy] = toScreen(wx, wy);
  ctx.globalAlpha = Math.min(1, u * 8, (1 - u) * 8);
  if (down) { ctx.fillStyle = 'rgba(255,244,220,.55)'; ctx.fillRect(sx * dpr - sz * 2, sy * dpr - sz * 2, sz * 4, sz * 4); }
  ctx.drawImage(handCv, sx * dpr - sz * 2, sy * dpr - sz * 0.5, sz * 8, sz * 9);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- input
cv.addEventListener('pointerdown', (ev) => {
  sound.init();
  if (ptrId !== null || !g || mode === 'title' || mode === 'end') return;
  ptrId = ev.pointerId;
  try { cv.setPointerCapture(ev.pointerId); } catch {}
  const [wx, wy] = toWorld(ev.clientX, ev.clientY);
  hover = [wx, wy];
  if (g.phase === 'build') {
    stroke = { x: wx, y: wy, moved: 0, sx: ev.clientX, sy: ev.clientY };
    if (tool === 'dig' || tool === 'pack' || tool === 'peb') paint(wx, wy);
  } else if (g.phase === 'wave') {
    g.grab(wx, wy, Math.max(3, 30 / V.s));
  }
  ev.preventDefault();
});
cv.addEventListener('pointermove', (ev) => {
  const [wx, wy] = toWorld(ev.clientX, ev.clientY);
  if (ev.pointerType === 'mouse' || ev.pointerId === ptrId) hover = [wx, wy];
  if (ev.pointerId !== ptrId || !g) return;
  if (g.held || g.ptr) g.move(wx, wy);
  if (stroke) {
    stroke.moved = Math.max(stroke.moved, Math.hypot(ev.clientX - stroke.sx, ev.clientY - stroke.sy));
    if (tool === 'dig' || tool === 'pack' || tool === 'peb') {
      // fill in between samples so a fast swipe still paints a line
      const d = Math.hypot(wx - stroke.x, wy - stroke.y), n = Math.ceil(d / 1.2);
      for (let k = 1; k <= n; k++) paint(stroke.x + (wx - stroke.x) * k / n, stroke.y + (wy - stroke.y) * k / n);
      stroke.x = wx; stroke.y = wy;
    }
  }
});
function endPtr(ev) {
  if (ev.pointerId !== ptrId) return;
  ptrId = null;
  if (ev.pointerType !== 'mouse') hover = null;
  if (!g) return;
  if (g.held || g.ptr) g.release();
  if (stroke && g.phase === 'build') {
    const [wx, wy] = toWorld(ev.clientX, ev.clientY);
    if (tool === 'tower') { if (g.towerAt(wx, wy)) tutNote('tower'); else nope('tower'); }
    if (tool === 'post') { if (g.postAt(wx, wy)) tutNote('post'); else nope('post'); }
  }
  stroke = null;
}
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse' && ptrId === null) hover = null; });
cv.addEventListener('contextmenu', (e) => e.preventDefault());

let packedTotal = 0, lastScrape = 0;
function paint(wx, wy) {
  if (tool === 'dig') {
    const n = g.dig(wx, wy);
    if (n && time - lastScrape > 0.07) { sound.play('scrape'); lastScrape = time; }
    if (!n && g.pail >= PAIL_MAX) nope('pail');
  } else if (tool === 'pack') {
    const n = g.packAt(wx, wy);
    packedTotal += n;
    if (n && time - lastScrape > 0.08) { sound.play('pat'); lastScrape = time; }
    if (!n && g.pail <= 0) nope('empty');
  } else if (tool === 'peb') {
    const n = g.pebAt(wx, wy);
    if (n < 0) nope('peb');
    else if (n && time - lastScrape > 0.08) { sound.play('pat'); lastScrape = time; }
  }
}
let nopeAt = 0;
function nope(why) {
  if (time - nopeAt < 1.2) return;
  nopeAt = time;
  const msg = { pail: 'pail full: pack!', empty: 'pail empty: dig!', tower: `need ${PRICES.tower} shells`, post: `need ${PRICES.post} shells`, peb: `need ${PRICES.peb} shells` }[why];
  const [x, y] = hover || [80, 50];
  g.pop(x, y - 5, msg, '#ffd0c8');
  sound.play('tick');
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  sound.init();
  const k = e.key.toLowerCase();
  if (k === 'escape') { if (!$('pause').hidden) resume(); else if (mode === 'play' || mode === 'tut') openPause(); }
  if (k === 'm') toggleSound();
  if (!g || $('pause').hidden === false) return;
  if ('12345'.includes(k) && k.length === 1) setTool(['dig', 'pack', 'tower', 'post', 'peb'][+k - 1]);
  if ((k === 'enter' || k === ' ') && mode === 'play' && g.phase === 'build') { e.preventDefault(); goWave(); }
});

// ---------------------------------------------------------------- UI
document.querySelectorAll('[data-icon]').forEach((el) => el.replaceWith(spriteCanvas(el.dataset.icon, 0, el.dataset.icon === 'post' ? 3 : 3)));
document.querySelectorAll('[data-price]').forEach((el) => { el.append(spriteCanvas('shell', 0, 2), document.createTextNode(PRICES[el.dataset.price])); });
$('shellIcon').append(spriteCanvas('shell', 0, 4));
$('castleIcon').append(spriteCanvas('mould', 0, 3));
for (const k of ['crab', 'gullStand', 'kid', 'dog']) $('titleCast').append(spriteCanvas(k, 0, 5, k === 'crab' ? false : true));

const RULES = [
  ['crab', 'Crabs pinch grains loose. Fling them into the sea.'],
  ['gullStand', 'Gulls peck the tops of towers. Any quick flick shoos one.'],
  ['kid', 'Kids fill buckets with your castle. Set them down gently, or their mum sees. They won’t wade a moat.'],
  ['dog', 'Dogs dig like mad. Fling one twice and it gets bored.'],
  ['man', 'The detectorist digs holes anywhere. He’s heavy: drag him off the edge.'],
  ['spade', 'Between waves, DIG fills your pail and PACK builds with it.'],
  ['mould', 'Water soaks packed sand until it slumps. Shells buy towers, driftwood posts and pebbles, which never soak.'],
  ['flag', 'Keep the flag on your keep out of the water until sunset. The castle still standing is your score.'],
];
for (const [k, t] of RULES) {
  const li = document.createElement('li');
  li.append(spriteCanvas(k, 0, k === 'man' ? 2 : 3));
  const sp = document.createElement('span'); sp.textContent = t; li.append(sp);
  $('rules').append(li);
}

function setTool(t) {
  tool = t;
  document.querySelectorAll('.tool').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  tutNote('tool');
}
document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => { sound.init(); setTool(b.dataset.tool); }));
function toggleSound() { sound.setOn(!sound.on); store.set('sound', sound.on); $('soundBtn').classList.toggle('off', !sound.on); }
sound.on = store.get('sound', true);
$('soundBtn').classList.toggle('off', !sound.on);
$('soundBtn').addEventListener('click', () => { sound.init(); toggleSound(); });
$('helpBtn').addEventListener('click', () => { sound.init(); openPause(); });
$('resumeBtn').addEventListener('click', resume);
$('quitBtn').addEventListener('click', () => { $('pause').hidden = true; newDay(false); });
$('replayTutBtn').addEventListener('click', () => { $('pause').hidden = true; newDay(true); });
$('goBtn').addEventListener('click', () => { sound.init(); goWave(); });
$('playBtn').addEventListener('click', () => { sound.init(); newDay(!store.get('tutDone', false)); });
$('tutBtn').addEventListener('click', () => { sound.init(); newDay(true); });
$('againBtn').addEventListener('click', () => { sound.init(); newDay(false); });
$('coachSkip').addEventListener('click', () => endTutorial());
$('coachNext').addEventListener('click', () => { sound.init(); tut?.next?.(); });

function openPause() { if (!g) return; g.paused = true; $('pause').hidden = false; }
function resume() { $('pause').hidden = true; if (g) g.paused = false; }

let ui = {};
function setText(id, v) { if (ui[id] !== v) { ui[id] = v; $(id).textContent = v; } }
function updateUI() {
  if (!g) return;
  const w = Math.min(g.wave, WAVES.length - 1);
  setText('clockTime', g.phase === 'build' ? 'Build' : WAVES[w].time);
  setText('clockWave', g.phase === 'build' ? `Next: ${WAVES[w].time}` : `Wave ${g.wave + 1} of ${WAVES.length}`);
  setText('shellN', String(g.shells));
  setText('castleN', String(g.castle));
  $('castleChip').classList.toggle('low', g.castle < 120);
  const building = g.phase === 'build' && (mode === 'play' || (mode === 'tut' && tut?.build));
  $('bar').hidden = !(mode === 'play' || mode === 'tut') || (!building && mode === 'tut');
  $('tools').hidden = !building;
  $('goRow').hidden = !(building && mode === 'play');
  $('waveNote').hidden = !(mode === 'play' && g.phase === 'wave');
  if (building && mode === 'play') setText('goT', String(Math.max(0, Math.ceil(BUILD_LEN - g.t))));
  setText('pailNote', `${g.pail}/${PAIL_MAX}`);
  $('pailMeter').firstChild.style.width = (g.pail / PAIL_MAX * 100) + '%';
  setText('digNote', g.pail >= PAIL_MAX ? 'full' : 'free');
  for (const b of document.querySelectorAll('.tool[data-tool]')) {
    const p = PRICES[b.dataset.tool];
    b.classList.toggle('broke', p != null && g.shells < p && !(b.dataset.tool === 'peb' && g.pebStock > 0));
  }
  const pebPrice = document.querySelector('[data-price="peb"]');
  if (pebPrice) {
    const want = g.pebStock > 0 ? `${g.pebStock} left` : null;
    if (want && pebPrice.dataset.mode !== want) { pebPrice.dataset.mode = want; pebPrice.textContent = want; }
    else if (!want && pebPrice.dataset.mode) { pebPrice.dataset.mode = ''; pebPrice.textContent = ''; pebPrice.append(spriteCanvas('shell', 0, 2), document.createTextNode(PRICES.peb)); }
  }
}

let bannerTimer = 0;
function banner(big, small) {
  const el = $('banner');
  el.hidden = true; void el.offsetWidth;
  $('bannerBig').textContent = big; $('bannerSmall').textContent = small;
  el.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

const NAMES = { crab: ['a crab', 'crabs'], gull: ['a gull', 'gulls'], kid: ['a kid', 'kids'], dog: ['a dog', 'dogs'], man: ['a man with a metal detector', 'detectorists'] };
function whoComes(w) {
  const parts = Object.entries(WAVES[w].spawn).map(([k, n]) => n === 1 ? NAMES[k][0] : `${n} ${NAMES[k][1]}`);
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts.at(-1) : parts[0];
}

// ---------------------------------------------------------------- a day at the beach
function makeGame(seed) {
  const game = new Game(seed);
  game.on(onEvent);
  return game;
}
function newDay(withTutorial) {
  resume();
  $('end').hidden = true; $('title').hidden = true;
  g = makeGame((Math.random() * 1e9) | 0);
  packedTotal = 0;
  $('hud').hidden = false;
  setTool('dig');
  if (withTutorial) startTutorial();
  else { mode = 'play'; tut = null; $('coach').hidden = true; banner('Morning', 'Build first. The tide is out.'); }
}
function goWave() {
  if (!g || g.phase !== 'build' || mode !== 'play') return;
  g.startWave();
}

function onEvent(type, d) {
  if (tut?.on) tut.on(type, d);
  if (mode !== 'play') return;
  if (type === 'wave') {
    const last = d.wave === WAVES.length - 1;
    banner(last ? 'Sunset' : WAVES[d.wave].time, last ? 'High tide. Hold on!' : `Here come ${whoComes(d.wave)}`);
    sound.play('bell');
  } else if (type === 'build') {
    banner('Build!', `${WAVES[d.wave].time} is next. The tide is coming in.`);
  } else if (type === 'end') {
    setTimeout(() => showEnd(d), d.why === 'flag' ? 1800 : 2600);
    if (d.why === 'sunset') { banner('Sunset', 'The tide turns.'); sound.play('fanfare'); }
    else banner('Flag down!', 'The keep went in the drink.');
  }
}

function showEnd(d) {
  if (mode !== 'play') return;
  mode = 'end';
  const snap = $('snap'), sx = snap.getContext('2d');
  sx.imageSmoothingEnabled = false;
  sx.drawImage(painter.cv, 34, 30, 96, 60, 0, 0, 96, 60);
  const score = d.score;
  const best = store.get('best', 0);
  if (d.why === 'sunset') {
    $('endTitle').textContent = 'Wish you were here';
    $('endScore').textContent = score;
    $('endLine').textContent = score > 0 ? `grains of castle still standing at sunset, with the flag flying.` : 'grains left. The flag stood, on a hump of wet sand.';
    if (score > best) store.set('best', score);
    $('endBest').textContent = score > best ? 'New best day!' : `Best day: ${best}`;
  } else {
    const at = WAVES[Math.min(g.wave, WAVES.length - 1)].time;
    $('endTitle').textContent = 'Washed out';
    $('endScore').textContent = '0';
    $('endLine').textContent = `The flag went into the water at ${at === 'NOON' ? 'noon' : at}. Only a day that ends with the flag up counts.`;
    $('endBest').textContent = best ? `Best day: ${best}` : 'No full day yet';
  }
  $('end').hidden = false;
  $('hud').hidden = true; $('bar').hidden = true;
}

// ---------------------------------------------------------------- tutorial
function coach(step, html, face = 'pail', btn = null) {
  $('coach').hidden = false;
  $('coachStep').textContent = step;
  $('coachText').innerHTML = html;
  const f = $('coachFace'); f.textContent = ''; f.append(spriteCanvas(face, 0, face === 'man' ? 3 : 4, face !== 'crab'));
  $('coachNext').hidden = !btn; if (btn) $('coachNext').textContent = btn;
}
function tutNote(what) { tut?.note?.(what); }

function startTutorial() {
  mode = 'tut';
  g.phase = 'wave'; g.noWaves = true; g.beach.swell = 1.4;
  const T = tut = { i: -1 };
  const steps = [
    () => {
      coach('1 of 7', 'A crab is coming for your castle. <b>Grab it and fling it into the sea.</b>', 'crab');
      const c = g.spawn('crab', { x: Math.min(W - 26, V.x0 + V.vw - 8) });
      T.hint = () => c.gone || c.st === 'grab' || c.st === 'air' ? null : { period: 1.6, at: (u) => u < 0.25 ? [c.x, c.y - 2, false] : [c.x + (u - 0.25) * 60, c.y - 2 - Math.sin((u - 0.25) / 0.75 * Math.PI) * 14, true] };
      T.on = (t, d) => {
        if (t === 'removed' && d.e === c) next();
        if (t === 'release' && d.e === c) setTimeout(() => { if (!c.gone && T.i === 0) coach('1 of 7', 'Further! Throw it <b>right into the water</b>, or off the edge of the screen.', 'crab'); }, 900);
      };
    },
    () => {
      coach('2 of 7', 'Nice. Kids want your castle for their buckets. Kids aren’t crabs: <b>pick him up, carry him away and let go gently.</b>', 'kid');
      const spawnKid = () => {
        const k = g.spawn('kid', { x: Math.max(4, V.x0 + 4) });
        T.hint = () => k.gone || k.st !== 'walk' ? null : { period: 2.4, at: (u) => u < 0.2 ? [k.x, k.y - 4, false] : u < 0.8 ? [k.x - (u - 0.2) * 20, k.y - 8, true] : [k.x - 12, k.y - 4 + (u - 0.8) * 10, true] };
        return k;
      };
      spawnKid();
      T.on = (t, d) => {
        if (t !== 'kid') return;
        if (d.gentle) { next(); return; }
        coach('2 of 7', 'Oof, his mum saw that. <b>Gently:</b> lift him, move him, and let go while your finger is <b>still</b>.', 'kid');
        setTimeout(() => { if (T.i === 1) spawnKid(); }, 1500);
      };
    },
    () => {
      coach('3 of 7', 'Gulls peck the tops of towers. <b>Any quick flick shoos one.</b>', 'gullStand');
      const gl = g.spawn('gull', { x: W + 5 });
      T.hint = () => gl.gone || gl.st !== 'peck' ? null : { period: 1.2, at: (u) => [gl.x + u * 20, gl.y - 3 - u * 12, u > 0.15] };
      T.on = (t, d) => { if (t === 'removed' && d.e === gl) next(); };
    },
    () => {
      coach('4 of 7', 'Every visitor you see off pays in shells. Shells wash up too: <b>tap the shells</b> on the sand.', 'shell');
      const shells = [];
      for (let k = 0; k < 2; k++) { g.washUpShell(); shells.push(g.ents.at(-1)); }
      for (const s of shells) { s.life = 1e9; }
      let got = 0;
      T.hint = () => { const s = shells.find((s) => !s.gone); return s ? { period: 1, at: (u) => [s.x, s.y - 1, u > 0.4 && u < 0.7] } : null; };
      T.on = (t) => { if (t === 'pickup' && ++got >= shells.length) next(); };
    },
    () => {
      g.phase = 'build'; T.build = true; g.t = 0;
      setTool('dig');
      coach('5 of 7', 'Between waves, you build. With <b>DIG</b>, scrub the sand to fill your pail. A moat on the land side stops kids.', 'spade');
      T.hint = () => g.pail >= 50 ? null : { period: 1.6, at: (u) => [50 + Math.sin(u * Math.PI * 2) * 6, 59, true] };
      T.tick = () => { if (g.pail >= 50) next(); };
    },
    () => {
      setTool('pack');
      packedTotal = 0;
      coach('6 of 7', 'Now <b>PACK</b>: paint packed sand from your pail. Build a wall on the sea side of your castle.', 'pail');
      T.hint = () => packedTotal >= 40 ? null : { period: 1.6, at: (u) => [101 + Math.sin(u * Math.PI * 2) * 2, 58 - u * 7, true] };
      T.tick = () => { if (packedTotal >= 40) next(); };
    },
    () => {
      T.hint = null; T.tick = null;
      coach('7 of 7', 'The tide comes in further every wave, and water <b>soaks packed sand until it slumps</b>. Keep the <b>flag</b> out of the water until sunset. The castle left standing is your score.', 'flag', 'Start the day');
      T.next = endTutorial;
    },
  ];
  function next() {
    T.on = null; T.tick = null; T.hint = null;
    T.i++;
    if (T.i > 0) sound.play('shell');
    if (T.i >= steps.length) return endTutorial();
    steps[T.i]();
  }
  T.note = () => {};
  next();
}
function endTutorial() {
  store.set('tutDone', true);
  $('coach').hidden = true;
  tut = null;
  if (!g) return;
  for (const e of g.ents) if (e.kind !== 'pickup') g.leave(e);
  g.noWaves = false;
  g.phase = 'build'; g.t = 0; g.wave = 0;
  g.shells = Math.max(g.shells, 6);
  mode = 'play';
  banner('Morning', 'Build first. The tide is out.');
}

// ---------------------------------------------------------------- title + loop
function showTitle() {
  mode = 'title';
  g = makeGame(11);
  g.noWaves = true;
  $('title').hidden = false;
  const best = store.get('best', 0);
  $('titleBest').textContent = best ? `Best day: ${best} grains` : '';
  $('playBtn').textContent = store.get('tutDone', false) ? 'Play' : 'Play (with tutorial)';
}

let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  time += dt;
  if (g && !HOLD) {
    acc += dt * SPEED;
    let n = 0;
    while (acc >= 1 / 60 && n < 8 * SPEED) { step(); acc -= 1 / 60; n++; }
    if (n >= 8 * SPEED) acc = 0;
  }
  if (g) { render(); updateUI(); }
}
function step() {
  g.tick(1 / 60);
  if (mode === 'play' && g.phase === 'build' && g.t >= BUILD_LEN) g.startWave();
  tut?.tick?.();
  for (const s of g.sounds) sound.play(s.name, s.v);
  g.sounds.length = 0;
  if (sound.ctx) {
    const b = g.beach, x = Math.max(60, Math.min(W - 2, shoreX()));
    sound.surf(Math.max(0, Math.min(1, (b.sea - b.surface(x)) / 5)) * 0.7 + Math.min(0.3, b.swell / 20));
  }
}
let shoreCache = 130, shoreT = 0;
function shoreX() {
  if (time - shoreT < 0.5) return shoreCache;
  shoreT = time;
  const b = g.beach;
  for (let x = 40; x < W; x++) { const y = b.waterTop(x); if (y < H && b.conn[y * W + x] === b.step) { shoreCache = x; break; } }
  return shoreCache;
}

// ---------------------------------------------------------------- demo: mid-afternoon, under siege
function demo() {
  mode = 'play';
  g = makeGame(5);
  const b = g.beach;
  b.tower(58, b.topAt(58) - 1);
  b.tower(103, b.topAt(103) - 1);
  for (let y = 50; y < 62; y++) for (let x = 108; x < 112; x++) if (b.get(x, y) !== 5) b.set(x, y, 3);
  b.post(114, b.topAt(114));
  for (let x = 40; x < 50; x++) for (let y = 58; y < 61; y++) b.set(x, y, 0);
  g.shells = 23;
  g.wave = 4;
  g.startWave();
  for (let i = 0; i < 60 * 19; i++) g.tick();
  g.ents = g.ents.filter((e) => e.kind === 'pickup');
  const k = g.spawn('kid', { x: 48 }); k.bucket = 4; k.st = 'work';
  const c = g.spawn('crab', { x: 118 }); c.st = 'air'; c.x = 124; c.y = 40; c.vx = 30; c.vy = -10; c.thrown = true;
  const c2 = g.spawn('crab', { x: 99 });
  const gl = g.spawn('gull', { x: 70 }); gl.st = 'peck'; gl.x = 70; gl.y = g.beach.topAt(70) - 1; gl.pecks = 0; gl.dir = 1;
  const gf = g.spawn('gull', { x: 30 }); gf.y = 12; gf.dir = 1;
  const d = g.spawn('dog', { x: 22 });
  g.pop(124, 34, '+1');
  $('hud').hidden = false;
  for (let i = 0; i < 10; i++) g.tick();
}

if (DEMO) demo();
else showTitle();
if (DEBUG) window.ht = { get g() { return g; }, step: (n = 1) => { for (let i = 0; i < n; i++) step(); }, ff: (sec) => { for (let i = 0; i < sec * 60; i++) step(); }, V: () => V, setTool, newDay, endTutorial, render };
requestAnimationFrame(frame);
