import { clamp, lerp, grain, rng } from './paper.js';
import { ROUTES, WORLD_H } from './routes.js';
import { SPECIES, SPECIES_LIST, behInfo } from './creatures.js';
import { makeWorld, step, snapshot, frameStats, boxOf, throwFruit, whistle, blowBubbles, SNAP_HZ, FILM, CLIP_MAX, SPEED } from './world.js';
import { drawScene, drawSpecimen } from './render.js';
import { analyseClip, autoCut, episodeScore, stars, clipWindow, quality } from './score.js';
import { writeEpisode, behPhrase } from './narrate.js';
import { initAudio, sfx, setMotor, setAmbience, startMusic, stopMusic, setProjector, speak, hush, canSpeak, setMuted, isMuted } from './audio.js';

const $ = (s) => document.querySelector(s);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug');
const cv = $('#cv'), ctx = cv.getContext('2d');
const stage = $('#stage'), app = $('#app');

// ------------------------------------------------------------------ save
const KEY = 'upriver.v1';
const save = Object.assign({ unlocked: 0, guide: {}, best: {}, tut: false, voice: true, muted: false, eps: 0 }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })());
const store = () => { if (DEMO) return; try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };
setMuted(save.muted);

// ------------------------------------------------------------------ layout
let W = 0, H = 0, DPR = 1, K = 1, OX = 0, OY = 0, VW = 800, portrait = false;
function layout() {
  const r = app.getBoundingClientRect();
  portrait = r.width / r.height < 0.8;
  app.classList.toggle('portrait', portrait);
  app.classList.toggle('squat', !portrait && r.height < 520);
  const sr = stage.getBoundingClientRect();
  W = sr.width; H = sr.height; DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  if (portrait) { K = Math.min(H / WORLD_H, W / 420); OY = H - WORLD_H * K; }
  else { K = H / WORLD_H; OY = 0; }
  OX = 0; VW = W / K;
  if (G.w) { G.w.VW = VW; clampFrame(); }
}
window.addEventListener('resize', () => { layout(); });
if (window.ResizeObserver) new ResizeObserver(() => layout()).observe(stage);

// ------------------------------------------------------------------ game state
const G = {
  mode: 'title', w: null, ri: 0, seed: 1, paused: false,
  zoom: 0.35, fc: [400, 300], film: FILM, clips: [], clip: null, take: 0,
  rec: { btn: false, mouse: false, key: false }, recLock: false,
  est: null, close: null, tut: null, newGuide: [], keys: new Set(), lastTouch: false,
  bg: null, // title-screen world
};
G.lastTouch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
app.classList.toggle('mouse', !G.lastTouch);
window.addEventListener('pointerdown', (e) => {
  const t = e.pointerType !== 'mouse';
  if (t !== G.lastTouch) { G.lastTouch = t; app.classList.toggle('mouse', !t); const ct = $('#coachtxt'); if (G.tut && ct) ct.innerHTML = TUT[G.tut.i].t(); }
}, true);
const frameW = () => lerp(Math.min(380, VW * 0.94), Math.min(80, VW * 0.25), G.zoom);
function clampFrame() {
  const w = G.w; if (!w) return;
  const fw = frameW(), fh = fw * 9 / 16;
  G.fc[0] = clamp(G.fc[0], fw / 2, VW - fw / 2); G.fc[1] = clamp(G.fc[1], fh / 2, WORLD_H - fh / 2);
  w.frame.w = fw; w.frame.h = fh; w.frame.x = G.fc[0] - fw / 2; w.frame.y = G.fc[1] - fh / 2;
}
const wide = () => { const fw = Math.min(VW, WORLD_H * 16 / 9); const fh = fw * 9 / 16; return { x: (VW - fw) / 2, y: clamp(WORLD_H * 0.62 - fh / 2, 0, WORLD_H - fh), w: fw, h: fh }; };

// ------------------------------------------------------------------ sheets
const sheets = $('#sheets');
function sheet(id, html, opts = {}) {
  sheets.innerHTML = `<div class="sheet${opts.clear ? ' clear' : ''}" id="${id}"><div class="board">${html}</div></div>`;
  const el = sheets.firstChild;
  el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', (e) => { sfx('tap'); ACT[b.dataset.go](b, e); }));
  const first = el.querySelector('[data-primary]') || el.querySelector('button');
  if (first && !G.lastTouch) setTimeout(() => first.focus({ preventScroll: true }), 30);
  return el;
}
const closeSheet = () => { sheets.innerHTML = ''; };
const starStr = (n, of = 3) => '★'.repeat(n) + '☆'.repeat(Math.max(0, of - n));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ACT = {
  start() { begin(G.nextRi ?? Math.min(save.unlocked, 3)); },
  reels() { showReels(); },
  reel(b) { begin(+b.dataset.r); },
  guide() { showGuide(G.mode === 'trip' ? 'pause' : G.mode === 'results' ? 'results' : 'title'); },
  back(b) { const to = b.dataset.to; if (to === 'pause') showPause(); else if (to === 'results') showResults(); else showTitle(); },
  sound(b) { save.muted = !save.muted; setMuted(save.muted); store(); b.textContent = save.muted ? 'Sound: off' : 'Sound: on'; },
  voice(b) { save.voice = !save.voice; store(); b.textContent = save.voice ? 'Narrator voice: on' : 'Narrator voice: off'; },
  resume() { closeSheet(); G.paused = false; },
  wrapEarly() { closeSheet(); G.paused = false; endTrip(); },
  quit() { closeSheet(); leaveTrip(); showTitle(); },
  tab(b) { showGuide(b.dataset.back, +b.dataset.r); },
  screenIt() { startScreening(); },
  again() { begin(G.ri); },
  next() { begin(Math.min(3, G.ri + 1)); },
  title() { showTitle(); },
  restart() { if (!G.confirmReset) { G.confirmReset = true; const b = $('#resetbtn'); if (b) b.textContent = 'Really forget everything?'; return; } localStorage.removeItem(KEY); location.reload(); },
};

// ------------------------------------------------------------------ title
function showTitle() {
  G.mode = 'title'; G.paused = false; G.confirmReset = false;
  $('#top').hidden = true; $('#controls').hidden = true; $('#coach').hidden = true; $('#screen').hidden = true;
  stopMusic(); setProjector(false); hush();
  const ri = Math.min(save.unlocked, 3);
  if (!G.bg || G.bg.ri !== ri) { G.bg = makeWorld(ri, 5, VW); G.bg.S = 400; }
  setAmbience(ROUTES[ri].key);
  const started = save.eps > 0 || save.tut;
  G.nextRi = ri;
  const total = SPECIES_LIST.reduce((a, s) => a + s.beh.length, 0);
  const have = Object.values(save.guide).reduce((a, g) => a + Object.keys(g).length, 0);
  sheet('title', `
    <div class="kick">A natural history in four reels</div>
    <h1>Upriver</h1>
    <div class="sub">You hold the camera. Somebody else will write the words.</div>
    <p>A little boat drifts down a strange river. Film what lives there, coax out its habits with fruit, a whistle and bubbles, and your best five takes become tonight's documentary.</p>
    <div class="btns"><button class="btn red" data-go="start" data-primary>${started ? `Roll reel ${ri + 1}: ${esc(ROUTES[ri].name)}` : 'Roll film'}</button>
    ${save.unlocked > 0 ? '<button class="btn" data-go="reels">All reels</button>' : ''}
    <button class="btn" data-go="guide">Field guide${have ? ` (${have}/${total})` : ''}</button></div>
    <div class="toggles"><button data-go="sound">${save.muted ? 'Sound: off' : 'Sound: on'}</button>${canSpeak() ? `<button data-go="voice">${save.voice ? 'Narrator voice: on' : 'Narrator voice: off'}</button>` : ''}</div>
    <div class="credit">Best with sound. ${G.lastTouch ? 'Drag to aim, hold the red button to film.' : 'Mouse to aim, hold the button to film, 1 2 3 for the kit.'}</div>
    ${started ? '<div class="toggles"><button id="resetbtn" data-go="restart">Start over</button></div>' : ''}
  `);
}
function showReels() {
  const cans = ROUTES.map((R, i) => {
    const locked = i > save.unlocked;
    const best = save.best[R.key];
    const col = ['#3f6a4b', '#c49a45', '#4a3670', '#24365e'][i];
    return `<button class="can" data-go="reel" data-r="${i}" ${locked ? 'disabled' : ''}>
      <span class="disc" style="background:${col}">${i + 1}</span>
      <span><b>${esc(R.name)}</b><small>${esc(R.time)}</small>${locked ? `<small>Finish reel ${i} first</small>` : best ? `<span class="st">${starStr(best.stars, 5)}</span>` : '<small>Not yet filmed</small>'}</span></button>`;
  }).join('');
  sheet('reels', `<div class="kick">The film cans</div><h2>Which reel?</h2><div class="grid">${cans}</div><div class="btns"><button class="btn" data-go="title">Back</button></div>`);
}
function showGuide(back = 'title', tabR) {
  const r = tabR ?? Math.min(save.unlocked, 3);
  const tabs = ROUTES.map((R, i) => `<button class="${i === r ? 'on' : ''}" data-go="tab" data-r="${i}" data-back="${back}">${i + 1}. ${esc(R.name)}</button>`).join('');
  const sps = SPECIES_LIST.filter((s) => s.route === r);
  const total = SPECIES_LIST.reduce((a, s) => a + s.beh.length, 0);
  const have = Object.values(save.guide).reduce((a, g) => a + Object.keys(g).length, 0);
  const cards = sps.map((sp) => {
    const g = save.guide[sp.key] || {}; const known = Object.keys(g).length > 0;
    const lis = sp.beh.map((b) => g[b.k] ? `<li><span class="s">${starStr(g[b.k])}</span><span>${esc(b.name)}</span></li>` : `<li class="no"><span class="s">☆☆☆</span><span>${known ? esc(b.name) + '. ' : ''}${esc(b.hint)}</span></li>`).join('');
    return `<div class="spc"><canvas width="320" height="200" data-sp="${sp.key}" data-sil="${known ? 0 : 1}"></canvas><h3>${known ? esc(sp.name) : 'Not yet filmed'}</h3><i>${known ? esc(sp.latin) : '&nbsp;'}</i>${known ? `<div>${esc(sp.blurb)}</div>` : ''}<ul>${lis}</ul></div>`;
  }).join('');
  const el = sheet('guide', `<span class="count">${have} / ${total} filmed</span><div class="kick">Field guide</div><h2>Creatures of the river</h2><div class="tabs">${tabs}</div><div class="spp">${cards}</div><div class="btns"><button class="btn" data-go="back" data-to="${back}" data-primary>Back</button></div>`);
  el.querySelectorAll('canvas[data-sp]').forEach((c) => { const x = c.getContext('2d'); drawSpecimen(x, c.dataset.sp, c.width, c.height, c.dataset.sil === '1'); });
  if (window.matchMedia('(max-width:620px)').matches) el.querySelector('.spp').style.gridTemplateColumns = '1fr';
}
function showPause() {
  G.paused = true; releaseRec();
  sheet('pause', `<div class="kick">Paused</div><h2>${esc(ROUTES[G.ri].name)}</h2><p>${G.clips.length} take${G.clips.length === 1 ? '' : 's'} so far, ${Math.ceil(G.film)} seconds of film left.</p>
  <div class="btns"><button class="btn red" data-go="resume" data-primary>Carry on</button><button class="btn" data-go="guide">Field guide</button>${G.tut ? '' : '<button class="btn" data-go="wrapEarly">Wrap up now</button>'}<button class="btn" data-go="quit">Back to the title</button></div>
  <div class="toggles"><button data-go="sound">${save.muted ? 'Sound: off' : 'Sound: on'}</button></div>`);
}

// ------------------------------------------------------------------ a trip
function begin(ri) {
  initAudio(); closeSheet();
  G.ri = ri; G.seed = DEMO ? 7 : (Date.now() % 100000) + 1; G.mode = 'trip'; G.paused = false;
  G.w = makeWorld(ri, G.seed, VW); G.w.sound = worldSound;
  G.film = FILM; G.clips = []; G.clip = null; G.take = 0; G.newGuide = []; G.zoom = 0.35;
  G.fc = [VW / 2, 300]; clampFrame();
  G.est = { snaps: [], acc: 0 }; G.close = null; G.endT = null;
  $('#top').hidden = false; $('#controls').hidden = false; $('#screen').hidden = true;
  $('#reelno').textContent = `Reel ${ri + 1} · ${ROUTES[ri].time}`; $('#reeltitle').textContent = ROUTES[ri].name;
  setAmbience(ROUTES[ri].key); stopMusic();
  G.tut = null;
  if (ri === 0 && !save.tut && !DEMO) startTutorial();
  else toast(`<b>Reel ${ri + 1}: ${esc(ROUTES[ri].name)}</b><br>${G.lastTouch ? 'Drag to aim, hold REC to film.' : 'Aim with the mouse, hold to film.'}`, 3200);
  layout();
}
function leaveTrip() { releaseRec(); setMotor(false); G.w = null; G.clip = null; }

function worldSound(name, c) {
  if (!G.w) return;
  if (c) {
    const X = c.x - G.w.S * c.p; if (X < -100 || X > VW + 100) return;
    sfx(name, X / VW * 2 - 1);
  } else sfx(name, 0);
}

// ------------------------------------------------------------------ recording
function wantRec() { return (G.rec.btn || G.rec.mouse || G.rec.key) && !G.recLock && (G.film > 0.05 || G.tut); }
function releaseRec() { G.rec.btn = G.rec.mouse = G.rec.key = false; G.recLock = false; if (G.clip) endClip(); $('#rec').classList.remove('on'); }
function startClip() {
  G.take++; G.clip = { n: G.take, start: G.w.t, snaps: [], acc: 1 / SNAP_HZ, ri: G.ri };
  sfx('rec'); setMotor(true); $('#rec').classList.add('on');
}
function endClip() {
  const c = G.clip; G.clip = null; setMotor(false); sfx('stop'); $('#rec').classList.remove('on');
  if (!c) return;
  if (c.snaps.length < 6) { if (!G.tut) G.film = Math.min(FILM, G.film + c.snaps.length / SNAP_HZ); G.take--; toast('Too short to use. Hold the button down.', 1800); return; }
  analyseClip(c);
  G.clips.push(c);
  // field guide
  for (const s of c.seen) {
    if (s.tier < 1) continue;
    const g = save.guide[s.sp] || (save.guide[s.sp] = {});
    if (!g[s.beh]) G.newGuide.push(s.sp + ':' + s.beh);
    if (!g[s.beh] || g[s.beh] < s.tier) g[s.beh] = s.tier;
  }
  store();
  if (G.tut) tutOnClip(c);
  const g = c.subject;
  if (g) {
    const tip = g.tier >= 3 ? 'Lovely.' : g.tier === 0 ? 'Hold on it a little longer.' : g.defect === 'far' ? 'Too far away: zoom in.' : g.defect === 'cut' ? 'Partly out of frame.' : g.defect === 'shaky' ? 'Hold the camera steadier.' : g.tier === 2 ? 'Nicely done.' : 'Get closer, and centre it.';
    toast(`Take ${c.n} · <b>${esc(SPECIES[g.sp].name)}</b>, ${esc(behPhrase(g.sp, g.beh))} <span class="st">${starStr(g.tier)}</span><br>${tip}`, 2600);
  } else toast(`Take ${c.n} · <b>Some lovely scenery</b><br>Nothing doing anything in the frame.`, 2400);
}

// ------------------------------------------------------------------ tutorial
const TUT = [
  { h: 'Aim the camera', t: () => G.lastTouch ? 'Drag anywhere on the picture to swing the frame. Put the little round bird in the tree inside it.' : 'Move the mouse (or the arrow keys) to aim the frame. Put the little round bird in the tree inside it.' },
  { h: 'Get closer', t: () => G.lastTouch ? 'Pinch, or press +, to zoom in until the bird fills a good part of the frame.' : 'Scroll the wheel, or press + and −, to zoom in until the bird fills a good part of the frame.' },
  { h: 'Roll film', t: () => G.lastTouch ? 'Hold the red REC button to film. Keep the bird framed for two seconds, then let go.' : 'Hold the mouse button (or Space) to film. Keep the bird framed for two seconds, then let go.' },
  { h: 'Whistle', t: () => `Creatures do more than sit there. Whistle${G.lastTouch ? '' : ' (2)'} with the bird in the frame: this one always answers. Film it singing if you like.` },
  { h: 'Fruit', t: () => `Now frame the tortoise on the bank and throw fruit${G.lastTouch ? '' : ' (1)'}. It lands in the middle of the frame.` },
  { h: 'Bubbles', t: () => `Bubbles${G.lastTouch ? '' : ' (3)'} do odd things to some creatures. Puff some anywhere.` },
  { h: 'That is the whole kit', t: () => `The reel holds ${FILM} seconds of film for the trip. The boat drifts on its own; your best five takes become the episode. The best shots are close, centred, steady, and catch something <i>happening</i>.`, done: 1 },
];
function startTutorial() { G.tut = { i: 0, filmed: false, bubbled: false }; G.w.moored = true; showCoach(); }
function showCoach() {
  const el = $('#coach'); const s = TUT[G.tut.i];
  el.hidden = false;
  el.innerHTML = `<span class="step">${G.tut.i + 1} / ${TUT.length}</span><h3>${s.h}</h3><div id="coachtxt">${s.t()}</div><div class="row">${s.done ? '<span></span><button class="go" id="castoff">Cast off</button>' : '<button class="skip" id="tskip">Skip the lesson</button><span></span>'}</div>`;
  const c = $('#castoff'); if (c) c.addEventListener('click', () => { sfx('tap'); endTutorial(); });
  const k = $('#tskip'); if (k) k.addEventListener('click', () => { sfx('tap'); endTutorial(); });
  const tools = { 3: 't-whistle', 4: 't-fruit', 5: 't-bubbles' };
  document.querySelectorAll('.tool').forEach((b) => b.classList.toggle('call', b.id === tools[G.tut.i]));
  $('#rec').style.animation = G.tut.i === 2 ? 'call 1.1s ease-in-out infinite' : '';
}
function tutAdvance() { G.tut.i++; sfx('page'); showCoach(); }
function endTutorial() {
  G.tut = null; save.tut = true; store();
  $('#coach').hidden = true; document.querySelectorAll('.tool').forEach((b) => b.classList.remove('call')); $('#rec').style.animation = '';
  G.w.moored = false; G.film = FILM;
  toast(`<b>Cast off!</b><br>The current will carry us downstream.`, 2600);
}
function tutOnClip(c) {
  const id = G.w.creatures.find((x) => x.k.tut && x.sp === 'puffwick').id;
  const n = c.snaps.filter((s) => s.sc.some((q) => q.id === id && q.vis >= 0.7)).length;
  if (n >= SNAP_HZ * 1.6) G.tut.filmed = true;
}
function tutTick() {
  const t = G.tut; if (!t) return;
  const w = G.w;
  const puff = w.creatures.find((x) => x.k.tut && x.sp === 'puffwick'), moss = w.creatures.find((x) => x.k.tut && x.sp === 'mossback');
  const st = frameStats(w.frame, boxOf(w, puff));
  const ok = [
    () => st && st.vis >= 0.85,
    () => st && st.vis >= 0.8 && st.size >= 0.05,
    () => t.filmed,
    () => puff.beh === 'singing' || puff.beh === 'chorus',
    () => moss.act === 'fruit',
    () => t.bubbled,
    () => false,
  ][t.i];
  if (ok()) { t.hold = (t.hold || 0) + 1; if (t.hold > (t.i === 3 ? 50 : 8)) { t.hold = 0; tutAdvance(); } } else if (t.i !== 3) t.hold = 0;
}

// ------------------------------------------------------------------ kit
function useTool(k) {
  if (G.mode !== 'trip' || G.paused || !G.w) return;
  initAudio();
  const ok = k === 'fruit' ? throwFruit(G.w) : k === 'whistle' ? whistle(G.w) : blowBubbles(G.w);
  if (ok && k === 'bubbles' && G.tut) G.tut.bubbled = true;
}
for (const [id, k] of [['t-fruit', 'fruit'], ['t-whistle', 'whistle'], ['t-bubbles', 'bubbles']]) {
  const b = $('#' + id);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); G.lastTouch = e.pointerType !== 'mouse'; useTool(k); });
  b.addEventListener('click', (e) => { if (e.detail === 0) useTool(k); });
}
const zoomBy = (d) => { G.zoom = clamp(G.zoom + d, 0, 1); clampFrame(); };
let zrep = null;
for (const [id, d] of [['zin', 0.1], ['zout', -0.1]]) {
  const b = $('#' + id);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); zoomBy(d); clearInterval(zrep); zrep = setInterval(() => zoomBy(d * 0.4), 110); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => clearInterval(zrep));
  b.addEventListener('click', (e) => { if (e.detail === 0) zoomBy(d); });
}
const recBtn = $('#rec');
recBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); initAudio(); G.lastTouch = e.pointerType !== 'mouse'; try { recBtn.setPointerCapture(e.pointerId); } catch (er) {} G.rec.btn = true; });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) recBtn.addEventListener(ev, () => { G.rec.btn = false; });
recBtn.addEventListener('contextmenu', (e) => e.preventDefault());
$('#pause').addEventListener('click', () => { sfx('tap'); if (G.mode === 'trip') showPause(); });

// ------------------------------------------------------------------ pointer on the picture
const ptrs = new Map(); let pinch0 = null, tap0 = null;
const toWorld = (e) => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left - OX) / K, (e.clientY - r.top - OY) / K]; };
stage.addEventListener('pointerdown', (e) => {
  if (e.target !== cv) return;
  initAudio();
  G.lastTouch = e.pointerType !== 'mouse'; app.classList.toggle('mouse', !G.lastTouch);
  if (G.mode !== 'trip' || G.paused) return;
  if (e.pointerType === 'mouse') { if (e.button === 0) { G.rec.mouse = true; const [x, y] = toWorld(e); G.fc = [x, y]; clampFrame(); } return; }
  try { stage.setPointerCapture(e.pointerId); } catch (er) {}
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) tap0 = { t: performance.now(), x: e.clientX, y: e.clientY, moved: 0 };
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), z: G.zoom }; tap0 = null; }
});
stage.addEventListener('pointermove', (e) => {
  if (G.mode !== 'trip' || G.paused) return;
  if (e.pointerType === 'mouse') { if (e.target !== cv) return; const [x, y] = toWorld(e); G.fc = [x, y]; clampFrame(); return; }
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size >= 2 && pinch0) {
    const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
    G.zoom = clamp(pinch0.z + Math.log(d / pinch0.d) * 1.3, 0, 1); clampFrame(); return;
  }
  if (tap0) tap0.moved += Math.abs(dx) + Math.abs(dy);
  G.fc[0] += dx / K * 1.25; G.fc[1] += dy / K * 1.25; clampFrame();
});
const ptrUp = (e) => {
  if (e.pointerType === 'mouse') { G.rec.mouse = false; return; }
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch0 = null;
  if (tap0 && ptrs.size === 0 && performance.now() - tap0.t < 260 && tap0.moved < 12 && G.mode === 'trip') { const [x, y] = toWorld(e); G.fc = [x, y]; clampFrame(); }
  if (ptrs.size === 0) tap0 = null;
};
stage.addEventListener('pointerup', ptrUp); stage.addEventListener('pointercancel', ptrUp);
window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') G.rec.mouse = false; });
stage.addEventListener('wheel', (e) => { if (G.mode !== 'trip') return; e.preventDefault(); zoomBy(-Math.sign(e.deltaY) * 0.06); }, { passive: false });
stage.addEventListener('contextmenu', (e) => e.preventDefault());

// ------------------------------------------------------------------ keys
const MOVE = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] };
window.addEventListener('keydown', (e) => {
  if (e.defaultPrevented) return;
  initAudio(); G.lastTouch = false; app.classList.add('mouse');
  const onSheet = !!sheets.firstChild;
  if (G.mode === 'screen') {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') { e.preventDefault(); skipSeg(); }
    else if (e.code === 'Escape') { e.preventDefault(); endScreening(); }
    return;
  }
  if (onSheet) {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      const a = document.activeElement; if (a && a.tagName === 'BUTTON' && sheets.contains(a)) a.click(); else (sheets.querySelector('[data-primary]') || sheets.querySelector('button'))?.click();
    } else if (e.code === 'Escape' && G.mode === 'trip' && G.paused) ACT.resume();
    return;
  }
  if (G.mode !== 'trip') return;
  if (e.code === 'Escape' || e.code === 'KeyP') { showPause(); return; }
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) G.rec.key = true; return; }
  if (e.code === 'Enter' && G.tut && TUT[G.tut.i].done) { e.preventDefault(); endTutorial(); return; }
  if (e.repeat) { if (MOVE[e.code]) e.preventDefault(); return; }
  if (e.code === 'Digit1' || e.code === 'Numpad1' || e.code === 'KeyF') useTool('fruit');
  else if (e.code === 'Digit2' || e.code === 'Numpad2' || e.code === 'KeyG') useTool('whistle');
  else if (e.code === 'Digit3' || e.code === 'Numpad3' || e.code === 'KeyB') useTool('bubbles');
  else if (e.code === 'Equal' || e.code === 'NumpadAdd' || e.code === 'KeyE') zoomBy(0.1);
  else if (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.code === 'KeyQ') zoomBy(-0.1);
  if (MOVE[e.code]) { e.preventDefault(); G.keys.add(e.code); }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') { G.rec.key = false; if (G.mode === 'trip') e.preventDefault(); }
  G.keys.delete(e.code);
});
window.addEventListener('blur', () => { G.keys.clear(); if (G.mode === 'trip') releaseRec(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'trip' && !G.paused && !DEMO) showPause(); if (document.hidden) hush(); });

// ------------------------------------------------------------------ toast
let toastT = null;
function toast(html, ms = 2200) {
  const el = $('#toast'); el.innerHTML = html; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms);
}

// ------------------------------------------------------------------ trip tick
function tripTick(dt) {
  const w = G.w;
  if (G.keys.size) {
    let dx = 0, dy = 0; for (const k of G.keys) { const m = MOVE[k]; if (m) { dx += m[0]; dy += m[1]; } }
    G.fc[0] += dx * 300 * dt; G.fc[1] += dy * 300 * dt; clampFrame();
  }
  step(w, dt);
  // the wide shots the narrator talks over at the start and end
  if (!w.moored && G.est && G.est.snaps.length < SNAP_HZ * 7) { G.est.acc += dt; if (G.est.acc >= 1 / SNAP_HZ) { G.est.acc -= 1 / SNAP_HZ; G.est.snaps.push(snapshot(w, wide())); } }
  if (w.S > w.trip.length - 7 * w.speed) { if (!G.close) G.close = { snaps: [], acc: 0 }; G.close.acc += dt; if (G.close.acc >= 1 / SNAP_HZ) { G.close.acc -= 1 / SNAP_HZ; G.close.snaps.push(snapshot(w, wide())); } }
  // recording
  const want = wantRec();
  if (!G.rec.btn && !G.rec.mouse && !G.rec.key) G.recLock = false;
  if (want && !G.clip) startClip();
  if (!want && G.clip) endClip();
  if (G.clip) {
    G.clip.acc += dt;
    while (G.clip.acc >= 1 / SNAP_HZ) { G.clip.acc -= 1 / SNAP_HZ; G.clip.snaps.push(snapshot(w)); }
    if (!G.tut) G.film = Math.max(0, G.film - dt);
    if (G.clip.snaps.length >= CLIP_MAX * SNAP_HZ) { endClip(); G.recLock = true; }
    else if (G.film <= 0 && !G.tut) { endClip(); w.speed = SPEED * 3; toast('<b>That is the last of the film.</b><br>Sit back and enjoy the view.', 3000); }
  }
  if (G.tut) tutTick();
  if (w.ended && G.endT == null) G.endT = 1.2;
  if (G.endT != null) { G.endT -= dt; if (G.endT <= 0) { G.endT = null; endTrip(); } }
  hud();
}
function hud() {
  const w = G.w;
  const fb = $('#filmbar'); fb.style.width = (G.film / FILM * 100) + '%';
  $('#filmtxt').textContent = G.tut ? 'free' : Math.ceil(G.film) + 's';
  $('#film').classList.toggle('low', G.film < 15 && !G.tut);
  recBtn.classList.toggle('empty', G.film <= 0 && !G.tut);
  for (const [id, k, d] of [['t-fruit', 'fruit', 1.2], ['t-whistle', 'whistle', 2.4], ['t-bubbles', 'bubbles', 3.5]]) $('#' + id + ' .cd').style.height = (w.cool[k] / d * 100) + '%';
}

// ------------------------------------------------------------------ drawing
let grainPat = null;
function drawGrain(x, y, w, h, a = 0.5) {
  const gc = grain(); if (!gc) return;
  if (!grainPat) grainPat = ctx.createPattern(gc, 'repeat');
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = a; ctx.fillStyle = grainPat; ctx.fillRect(x, y, w, h); ctx.restore();
}
function liveState(w) { return { S: w.S, t: w.t, cr: w.creatures, fr: w.fruits, bu: w.bubbles, fx: w.fx }; }
function drawWorld(w) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#1a140e'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(OX, OY); ctx.scale(K, K);
  ctx.beginPath(); ctx.rect(0, 0, VW, WORLD_H); ctx.clip();
  drawScene(ctx, w.trip, liveState(w), { x: 0, w: VW });
  ctx.restore();
  drawGrain(0, OY, W, WORLD_H * K, 0.55);
  // a box-like vignette, as if the river were a diorama
  const g = ctx.createRadialGradient(W / 2, OY + WORLD_H * K * 0.45, Math.min(W, H) * 0.3, W / 2, OY + WORLD_H * K * 0.45, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,10,0,.38)');
  ctx.fillStyle = g; ctx.fillRect(0, OY, W, WORLD_H * K);
}
function drawGunwale() {
  // the bow of the boat along the bottom edge
  const y = OY + WORLD_H * K;
  ctx.fillStyle = '#5a3c22'; ctx.beginPath(); ctx.moveTo(0, y - 10 * K); ctx.quadraticCurveTo(W / 2, y - 26 * K, W, y - 10 * K); ctx.lineTo(W, y); ctx.lineTo(0, y); ctx.fill();
  ctx.fillStyle = '#7a5532'; ctx.beginPath(); ctx.moveTo(0, y - 10 * K); ctx.quadraticCurveTo(W / 2, y - 26 * K, W, y - 10 * K); ctx.lineTo(W, y - 5 * K); ctx.quadraticCurveTo(W / 2, y - 20 * K, 0, y - 5 * K); ctx.fill();
}
function drawFinder(w) {
  const F = w.frame; const x = OX + F.x * K, y = OY + F.y * K, fw = F.w * K, fh = F.h * K;
  const rec = !!G.clip;
  ctx.save();
  ctx.fillStyle = 'rgba(14,12,18,.22)';
  ctx.beginPath(); ctx.rect(0, OY, W, WORLD_H * K); ctx.rect(x + fw, y, -fw, fh); ctx.fill('evenodd');
  const c = rec ? '#ff5a3c' : '#fbf6ea';
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 5; const L = Math.min(fw, fh) * 0.2;
  const corners = () => { ctx.beginPath(); for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + fw, y, -1, 1], [x, y + fh, 1, -1], [x + fw, y + fh, -1, -1]]) { ctx.moveTo(cx, cy + sy * L); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * L, cy); } ctx.stroke(); };
  corners(); ctx.strokeStyle = c; ctx.lineWidth = 2.5; corners();
  ctx.lineWidth = 1.2; ctx.strokeStyle = rec ? 'rgba(255,90,60,.5)' : 'rgba(251,246,234,.35)'; ctx.strokeRect(x, y, fw, fh);
  ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + fw / 2 - 7, y + fh / 2); ctx.lineTo(x + fw / 2 + 7, y + fh / 2); ctx.moveTo(x + fw / 2, y + fh / 2 - 7); ctx.lineTo(x + fw / 2, y + fh / 2 + 7); ctx.stroke();
  const fs = clamp(fh * 0.11, 10, 15);
  ctx.font = `700 ${fs}px "Courier Prime", monospace`; ctx.textBaseline = 'top';
  if (rec) {
    const on = Math.floor(performance.now() / 400) % 2 === 0;
    if (on) { ctx.fillStyle = '#ff3b22'; ctx.beginPath(); ctx.arc(x + 12, y + 8 + fs / 2, fs * 0.36, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 3;
    const secs = G.clip.snaps.length / SNAP_HZ;
    ctx.fillText(`REC 0:${String(Math.floor(secs)).padStart(2, '0')}:${String(Math.floor((secs % 1) * 24)).padStart(2, '0')}`, x + 22, y + 8);
  }
  // what's in shot, and how well
  let best = null;
  for (const cr of w.creatures) {
    const st = frameStats(F, boxOf(w, cr)); if (!st || st.vis < 0.75) continue;
    const q = st.size * (0.5 + st.cen);
    if (!best || q > best.q) best = { q, st, cr };
  }
  if (best && fh > 46) {
    const sp = SPECIES[best.cr.sp]; const known = save.guide[best.cr.sp];
    const b = best.cr.beh && behInfo(best.cr.sp, best.cr.beh);
    const name = known ? sp.name : '???';
    const label = b ? `${name} · ${behPhrase(best.cr.sp, best.cr.beh)}` : name;
    const st = best.st; const qual = quality({ ...st, sp: best.cr.sp, beh: best.cr.beh });
    const pips = qual >= 0.62 ? 3 : qual >= 0.34 ? 2 : 1;
    ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 3; ctx.fillStyle = '#fff'; ctx.textBaseline = 'bottom';
    const fs2 = clamp(fh * 0.1, 10, 14); ctx.font = `700 ${fs2}px "Courier Prime", monospace`;
    let txt = label; while (ctx.measureText(txt).width > fw - 60 && txt.length > 4) txt = txt.slice(0, -2);
    if (txt !== label) txt = txt.trimEnd() + '…';
    ctx.fillText(txt, x + 8, y + fh - 6);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i < pips ? (b ? '#ffcf52' : '#fbf6ea') : 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(x + fw - 12 - (2 - i) * 11, y + fh - 6 - fs2 / 2, 3.6, 0, 7); ctx.fill(); }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ the end of a trip: the cutting room
function endTrip() {
  if (G.mode !== 'trip') return;
  releaseRec(); setMotor(false);
  G.mode = 'cut'; $('#controls').hidden = true; $('#top').hidden = true; $('#toast').classList.remove('show'); $('#coach').hidden = true; G.tut = null;
  G.cut = autoCut(G.clips);
  showCutting();
}
function showCutting() {
  const clips = [...G.clips].sort((a, b) => a.start - b.start);
  const sel = new Set(G.cut);
  const take = (c) => {
    const g = c.subject; const lab = g ? `<b>${esc(SPECIES[g.sp].name)}</b>${esc(behPhrase(g.sp, g.beh))} <span class="pts">${starStr(g.tier)}</span>` : '<b>Scenery</b>nothing much';
    return `<button class="take${sel.has(c) ? ' sel' : ''}" data-n="${c.n}"><canvas width="320" height="180"></canvas><div class="lab">Take ${c.n} · ${(c.snaps.length / SNAP_HZ).toFixed(1)}s<br>${lab}</div></button>`;
  };
  const el = sheet('cutting', `<div class="kick">The cutting room</div><h2>${esc(ROUTES[G.ri].name)}</h2>
    ${clips.length ? `<p class="note">The editor has picked the takes marked IN. Tap a take to put it in or leave it out (five at most), then screen the episode.</p><div class="takes">${clips.map(take).join('')}</div>`
      : '<p>Not a single frame of film. The narrator will do what he can with the view.</p>'}
    <div class="btns"><button class="btn red" data-go="screenIt" data-primary>Screen the episode</button></div>`);
  el.querySelectorAll('.take').forEach((b) => {
    const c = G.clips.find((x) => x.n === +b.dataset.n);
    const cvs = b.querySelector('canvas'); const x = cvs.getContext('2d');
    const i = c.subject ? c.subject.bestI : Math.floor(c.snaps.length / 2);
    drawShot(x, c.snaps[i], 0, 0, cvs.width, cvs.height);
    b.addEventListener('click', () => {
      sfx('tap');
      const k = G.cut.indexOf(c);
      if (k >= 0) G.cut.splice(k, 1); else if (G.cut.length < 5) G.cut.push(c); else { toast('Five takes at most. Take one out first.', 1800); return; }
      G.cut.sort((a, b2) => a.start - b2.start);
      b.classList.toggle('sel', G.cut.includes(c));
    });
  });
}
// draw one recorded moment through its frame into a rectangle
function drawShot(x, sn, rx, ry, rw, rh, push = 1) {
  const F = sn.F; const m = rw / F.w * push;
  x.save(); x.beginPath(); x.rect(rx, ry, rw, rh); x.clip();
  x.translate(rx + rw / 2 - (F.x + F.w / 2) * m, ry + rh / 2 - (F.y + F.h / 2) * m); x.scale(m, m);
  drawScene(x, G.w.trip, { S: sn.S, t: sn.t, cr: sn.cr, fr: sn.fr, bu: sn.bu, fx: sn.fx }, { x: F.x, w: F.w });
  x.restore();
}

// ------------------------------------------------------------------ the screening
let SC = null;
function startScreening() {
  closeSheet();
  if (save.voice) speak(' ', null, true);
  const ri = G.ri;
  if (!G.cut) G.cut = autoCut(G.clips);
  const cut = G.cut;
  const sc = episodeScore(cut); const st = stars(sc.total);
  G.result = { sc, st, cut, script: writeEpisode(ri, cut, st, G.seed) };
  const est = G.est && G.est.snaps.length ? { snaps: G.est.snaps } : (cut[0] || null);
  const close = G.close && G.close.snaps.length ? { snaps: G.close.snaps } : (cut[cut.length - 1] || est);
  const segs = [{ type: 'title', dur: 3.6 }];
  if (est) segs.push({ type: 'clip', clip: est, lines: [G.result.script.open], wide: true });
  else segs.push({ type: 'card', lines: [G.result.script.open] });
  cut.forEach((c, i) => segs.push({ type: 'clip', clip: c, lines: G.result.script.lines[i] }));
  if (close) segs.push({ type: 'clip', clip: close, lines: [G.result.script.close], wide: true });
  else segs.push({ type: 'card', lines: [G.result.script.close] });
  segs.push({ type: 'credits', dur: 4.5 });
  SC = { segs, i: -1, t: 0 };
  G.mode = 'screen';
  $('#top').hidden = true; $('#screen').hidden = false; $('#subs').textContent = '';
  $('#voice').hidden = !canSpeak(); $('#voice').textContent = save.voice ? 'Voice: on' : 'Voice: off';
  setAmbience(null); startMusic(ri, 0.3); setProjector(true);
  nextSeg();
}
$('#skip').addEventListener('click', () => { sfx('tap'); skipSeg(); });
$('#voice').addEventListener('click', () => { save.voice = !save.voice; store(); $('#voice').textContent = save.voice ? 'Voice: on' : 'Voice: off'; if (!save.voice) hush(); });
function skipSeg() { if (!SC) return; hush(); nextSeg(); }
function nextSeg() {
  SC.i++; SC.t = 0;
  if (SC.i >= SC.segs.length) { endScreening(); return; }
  const s = SC.segs[SC.i];
  s.li = -1; s.lineDone = true; s.lineT = 0;
  if (s.clip) { s.win = s.wide ? [0, s.clip.snaps.length - 1] : clipWindow(s.clip); }
  $('#subs').textContent = '';
}
function sayLine(s) {
  s.li++; s.lineT = 0; s.lineDone = false;
  const text = s.lines[s.li]; $('#subs').textContent = text;
  s.lineMin = Math.max(2.6, text.length * 0.058);
  if (save.voice && canSpeak()) { s.spoken = true; speak(text, () => { s.lineDone = true; }); s.lineMax = text.length * 0.085 + 2.5; }
  else { s.spoken = false; s.lineMax = s.lineMin; }
}
function screenTick(dt) {
  const s = SC.segs[SC.i]; if (!s) return;
  SC.t += dt;
  if (s.type === 'title' || s.type === 'credits') { if (SC.t > s.dur) nextSeg(); return; }
  if (s.lines && s.li < s.lines.length) {
    if (s.li < 0 && SC.t > 0.5) sayLine(s);
    else if (s.li >= 0) {
      s.lineT += dt;
      const fin = s.spoken ? (s.lineDone && s.lineT > 1.2) || s.lineT > s.lineMax : s.lineT > s.lineMax;
      if (fin) { if (s.li < s.lines.length - 1) sayLine(s); else { s.li = s.lines.length; s.after = 0; } }
    }
  }
  const clipLen = s.clip ? (s.win[1] - s.win[0] + 1) / SNAP_HZ : 0;
  if (s.li >= (s.lines ? s.lines.length : 0)) { s.after = (s.after || 0) + dt; if (s.after > 0.7 && SC.t >= Math.min(clipLen, 6.5)) nextSeg(); }
}
function endScreening() {
  if (!SC) return;
  SC = null; hush(); setProjector(false);
  $('#screen').hidden = true;
  // tally
  const R = ROUTES[G.ri]; const res = G.result;
  const prev = save.best[R.key];
  if (!prev || res.sc.total > prev.score) save.best[R.key] = { score: res.sc.total, stars: res.st };
  save.unlocked = Math.max(save.unlocked, Math.min(3, G.ri + 1)); save.eps++;
  store();
  G.mode = 'results';
  startMusic(G.ri, 0.28);
  showResults();
}
function showResults() {
  const res = G.result; const R = ROUTES[G.ri];
  const rows = res.cut.map((c) => { const g = c.subject; return `<tr><td>Take ${c.n}: ${g ? esc(SPECIES[g.sp].name) + ', ' + esc(behPhrase(g.sp, g.beh)) + ' <span style="color:var(--mustard)">' + starStr(g.tier) + '</span>' : 'scenery'}</td><td>${c.score}</td></tr>`; }).join('');
  const nw = [...new Set(G.newGuide)].map((k) => { const [sp, b] = k.split(':'); return `${SPECIES[sp].name}: ${behInfo(sp, b).name.toLowerCase()}`; });
  const last = G.ri >= 3;
  sheet('results', `<div class="kick">Episode ${G.ri + 1}: ${esc(R.name)}</div>
    <div class="big">${starStr(res.st, 5)}</div>
    <div class="quote">“${esc(res.script.review)}”</div><div class="by">The Wireless &amp; Television Times</div>
    <table>${rows || '<tr><td>No takes made the cut</td><td>0</td></tr>'}${res.sc.variety ? `<tr><td>A good mix of creatures</td><td>${res.sc.variety}</td></tr>` : ''}<tr><td><b>Total</b></td><td><b>${res.sc.total}</b></td></tr></table>
    ${nw.length ? `<div class="new">New in the field guide: ${nw.map(esc).join('; ')}.</div>` : ''}
    <div class="btns">${!last ? `<button class="btn red" data-go="next" data-primary>Reel ${G.ri + 2}: ${esc(ROUTES[G.ri + 1].name)}</button>` : ''}<button class="btn${last ? ' red' : ''}" data-go="again" ${last ? 'data-primary' : ''}>Film this reel again</button><button class="btn" data-go="guide">Field guide</button><button class="btn" data-go="title">Title</button></div>`);
}

function drawScreen() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#0d0a07'; ctx.fillRect(0, 0, W, H);
  const s = SC && SC.segs[SC.i]; if (!s) return;
  const subsH = Math.max(110, H * 0.2);
  let tw = Math.min(W - 24, (H - subsH - 40) * 16 / 9); let th = tw * 9 / 16;
  const tx = (W - tw) / 2, ty = Math.max(14, (H - subsH - th) / 2 + 4);
  $('#subs').style.top = (ty + th + 16) + 'px';
  const weave = Math.floor(performance.now() / 83);
  const r = rng(weave); const jx = (r() - 0.5) * 1.2, jy = (r() - 0.5) * 1.2;
  ctx.save(); ctx.translate(jx, jy);
  if (s.type === 'clip') {
    const n = Math.min(s.win[1], s.win[0] + Math.floor(SC.t * SNAP_HZ));
    const over = Math.max(0, SC.t - (s.win[1] - s.win[0] + 1) / SNAP_HZ);
    drawShot(ctx, s.clip.snaps[n], tx, ty, tw, th, 1 + Math.min(0.08, over * 0.012));
  } else {
    ctx.fillStyle = '#1d2a26'; ctx.fillRect(tx, ty, tw, th);
    ctx.fillStyle = '#efe3c4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const R = ROUTES[G.ri];
    const a = clamp(Math.min(SC.t * 1.5, ((s.dur || 4) - SC.t) * 1.5), 0, 1); ctx.globalAlpha = s.type === 'card' ? 1 : a;
    if (s.type === 'title') {
      ctx.font = `${Math.round(th * 0.2)}px "Young Serif", Georgia, serif`; ctx.fillText('Upriver', tx + tw / 2, ty + th * 0.42);
      ctx.font = `${Math.round(th * 0.065)}px "Young Serif", Georgia, serif`; ctx.fillText(`Episode ${G.ri + 1}: ${R.name}`, tx + tw / 2, ty + th * 0.62);
    } else if (s.type === 'credits') {
      ctx.font = `${Math.round(th * 0.06)}px "Young Serif", Georgia, serif`;
      ['Filmed on the river by', 'YOU', '', `With the creatures of ${R.name.replace(/^The /, 'the ')}`, 'No animals were hurried.'].forEach((l, i) => ctx.fillText(l, tx + tw / 2, ty + th * (0.26 + i * 0.12)));
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
  // the film look: grain, flicker, vignette, the odd scratch
  drawGrain(tx, ty, tw, th, 0.6);
  ctx.fillStyle = `rgba(255,236,200,${r() * 0.05})`; ctx.fillRect(tx, ty, tw, th);
  const vg = ctx.createRadialGradient(tx + tw / 2, ty + th / 2, th * 0.4, tx + tw / 2, ty + th / 2, tw * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); ctx.fillStyle = vg; ctx.fillRect(tx, ty, tw, th);
  if (r() < 0.3) { ctx.strokeStyle = 'rgba(255,250,235,.25)'; ctx.lineWidth = 1; const sx = tx + r() * tw; ctx.beginPath(); ctx.moveTo(sx, ty); ctx.lineTo(sx + (r() - 0.5) * 6, ty + th); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = '#2a2118'; ctx.lineWidth = 6; ctx.strokeRect(tx - 3, ty - 3, tw + 6, th + 6);
}

function drawTitleBg(dt) {
  const w = G.bg; if (!w) return;
  w.VW = VW; step(w, dt);
  if (w.ended) { G.bg = makeWorld(w.ri, 5 + (G.bgN = (G.bgN || 0) + 1), VW); }
  drawWorld(w); drawGunwale();
}

// ------------------------------------------------------------------ loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
  if (DEBUG && window.up && window.up.hold) return;
  tickAll(dt);
}
function tickAll(dt) {
  if (G.mode === 'trip' && G.w) {
    if (!G.paused) tripTick(dt);
    if (G.w) { drawWorld(G.w); drawGunwale(); drawFinder(G.w); }
  } else if (G.mode === 'screen') { screenTick(dt); if (G.mode === 'screen') drawScreen(); }
  else if (G.mode === 'title' || !G.w) drawTitleBg(dt);
  else if (G.w) { drawWorld(G.w); drawGunwale(); }
}

layout();
if (DEMO) {
  // the preview: the chorus tree mid-song, rolling
  G.lastTouch = false; app.classList.add('mouse');
  begin(0); $('#toast').classList.remove('show');
  const w = G.w; w.S = 1010; w.moored = true;
  for (let i = 0; i < 60; i++) step(w, 0.05);
  const birds = w.creatures.filter((c) => c.sp === 'puffwick' && c.tree === undefined && Math.abs(c.x - w.S * c.p - VW / 2) < 200);
  const tree = w.creatures.filter((c) => c.sp === 'puffwick' && Math.abs((c.x - w.S * c.p) - VW / 2) < 220);
  const cx = tree.reduce((a, c) => a + c.x - w.S * c.p, 0) / Math.max(1, tree.length);
  G.zoom = 0.45; G.fc = [cx + 8, 296]; clampFrame();
  whistle(w);
  for (let i = 0; i < 26; i++) step(w, 0.05);
  G.clip = { n: 1, start: w.t, snaps: new Array(41).fill(null).map(() => snapshot(w)), acc: 0 };
  G.film = 61; save.guide.puffwick = { preening: 2 };
  G.paused = true; hud(); $('#rec').classList.add('on');
  const tick = tripTick; window.__demo = { tick };
} else showTitle();
requestAnimationFrame(frame);
window.toyboxReady?.();

if (DEBUG) {
  window.up = {
    G, save, hold: false, step, snapshot, SPECIES,
    ff(sec, dt = 0.05) { for (let t = 0; t < sec; t += dt) tickAll(dt); },
    draw() { tickAll(0); },
    aim(x, y, z) { if (z != null) G.zoom = z; G.fc = [x, y]; clampFrame(); },
    begin, endTrip, startScreening, endScreening, skipSeg, useTool, showGuide, showTitle,
  };
}
