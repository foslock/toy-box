// Needle: wiring. The crate of records, the deck, the tray of jukebox strips, the liner-note lesson.
// ?demo lets the bot play for the preview shot; ?debug exposes everything as window.nd (with ?hold to step by hand).
import { Game, PITCHES, PITCH_SCORE } from './game.js';
import { RECORDS, PARTS, PART_KEYS, FIDELITY, R_LABEL } from './levels.js';
import { Renderer } from './render.js';
import { Sound, LAT } from './sound.js';
import { Bot } from './bot.js';

const qs = new URLSearchParams(location.search);
const DEMO = qs.has('demo'), DEBUG = qs.has('debug');
let hold = qs.has('hold');
const SPEED = Math.max(1, +qs.get('speed') || 1);
const $ = id => document.getElementById(id);
const cv = $('deck');
const view = new Renderer(cv);
const sound = new Sound();

// ---------- saved bits
const KEY = 'needle.v1';
let save = { best: {}, lesson: false, muted: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY)) || {}); } catch {}
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} };
sound.muted = save.muted;

// ---------- state
let game = null, bot = null, mode = 'title', armed = null, popFor = null, lesson = null, endT = 0;
const SUBS = {
  lesson: 'The lesson · 3 tracks', shuffle: 'Long-player · 6 tracks',
  stomp: 'Scratched · 7 tracks', rag: 'Warped · 8 tracks',
};

function show(id, on) { $(id).hidden = !on; }
function setMode(m) {
  mode = m;
  show('title', m === 'title');
  show('over', m === 'over');
  show('pause', m === 'pause');
  const deck = m === 'play' || m === 'pause' || m === 'over';
  show('hud', deck); show('tray', deck);
  show('mute', m === 'pause' || m === 'over');
  if (m !== 'play') { closePop(); disarm(); }
  if (m === 'title') { show('note', false); show('playBtn', false); renderCrate(); }
  sound.playing(m === 'play');
  layout();
}

// ---------- the crate
function renderCrate() {
  const el = $('sleeves');
  el.innerHTML = '';
  RECORDS.forEach((r, i) => {
    const b = document.createElement('button');
    b.className = `sleeve sl-${r.id}`;
    const best = save.best[r.id];
    const stars = [0, 1, 2].map(k => `<i class="${best && best.stars > k ? '' : 'off'}"></i>`).join('');
    const name = r.id === 'lesson' ? 'Practice<br>Single' : r.id === 'shuffle' ? 'Late Night<br>Shuffle' : r.id === 'stomp' ? 'Uptown<br>Stomp' : 'Shellac Rag';
    b.innerHTML = `<span class="rpm">${r.rpm === 33 ? '33⅓' : r.rpm} RPM</span><span class="disc"></span><span class="disc"></span>` +
      `<span class="t">${name}</span><span class="s">${SUBS[r.id]}</span>${best ? `<span class="stars">${stars}</span>` : ''}` +
      (r.id === 'lesson' && !save.lesson ? '<span class="flag">Start here</span>' : '');
    b.setAttribute('aria-label', `${r.id === 'lesson' ? 'Practice Single, the lesson' : name.replace('<br>', ' ')}${best ? `, best ${best.stars} of 3` : ''}`);
    b.onclick = () => start(i);
    if (r.id === 'lesson' && !save.lesson) b.classList.add('ring');
    el.appendChild(b);
  });
  $('muteT').textContent = save.muted ? 'Sound off' : 'Sound on';
}

// ---------- a run
function start(ri) {
  sound.init();
  game = new Game({ record: ri, tutorial: RECORDS[ri].id === 'lesson' });
  bot = null; endT = 0;
  view.fx = []; view.popups = []; view.sel = null; view.armR = null;
  sound.song = game.song;
  $('recName').textContent = game.song.title;
  buildVu();
  lesson = game.tutorial ? { i: -1 } : null;
  setMode('play');
  if (lesson) nextLesson();
  else show('note', false);
  hud(true);
}

// ---------- layout: the deck fits between the HUD and the tray
let W = 0, H = 0, sideNote = false, side = false, trayW = 0;
function layout() {
  W = window.innerWidth; H = window.innerHeight;
  side = W > H * 1.3 && H < 560;
  document.body.classList.toggle('side', side);
  const hudH = $('hud').hidden ? 58 : $('hud').offsetHeight;
  const trayH = side ? 0 : $('tray').hidden ? 84 : $('tray').offsetHeight;
  trayW = side ? $('tray').offsetWidth || 140 : 0;
  const box = { x: 4, y: hudH + 2, w: W - 8 - trayW, h: Math.max(100, H - hudH - trayH - 6) };
  if (side) { box.w = Math.min(box.w, box.h); box.x = W - trayW - box.w - 6; }
  // tall screens: the deck sits up top and the liner notes get the space under it
  const fit = Math.min(box.w, box.h);
  const below = box.h - fit > 170 && !!lesson;
  if (below) box.h = fit;
  view.resize(W, H, box);
  // where the liner notes go: beside the deck if there's room, under it on a tall phone, else over its top
  const deckW = 284 * view.k, spare = (W - deckW) / 2;
  sideNote = spare >= 250 || side;
  const n = $('note');
  n.style.top = n.style.bottom = '';
  if (side) { n.style.left = '12px'; n.style.top = (hudH + 8) + 'px'; n.style.width = Math.min(360, box.x - 24) + 'px'; n.style.transform = 'rotate(-.6deg)'; }
  else if (sideNote) { n.style.left = '16px'; n.style.top = (hudH + 16) + 'px'; n.style.width = Math.min(340, spare - 32) + 'px'; n.style.transform = 'rotate(-.6deg)'; }
  else if (below) { n.style.left = '50%'; n.style.bottom = (trayH + 10) + 'px'; n.style.width = ''; n.style.transform = ''; }
  else { n.style.left = '50%'; n.style.top = (hudH + 4) + 'px'; n.style.width = ''; n.style.transform = ''; }
  placePlay();
}
window.addEventListener('resize', layout);

function placePlay() {
  const b = $('playBtn');
  const s = view.toScreen(0, 0), r = R_LABEL * view.k;
  b.style.left = (s.x - r) + 'px'; b.style.top = (s.y - r) + 'px';
  b.style.width = b.style.height = (2 * r) + 'px';
}

// ---------- HUD
let lastHud = {};
function buildVu() {
  $('vu').innerHTML = Array.from({ length: FIDELITY }, () => '<i></i>').join('');
}
function hud(force) {
  if (!game) return;
  const g = game;
  const tr = g.state === 'track' ? `Track ${g.track + 1} of ${g.tracks}` : g.state === 'won' ? 'Side over' : g.track + 1 >= g.tracks ? '' : `Up next: track ${g.track + 2} of ${g.tracks}`;
  if (force || lastHud.tr !== tr) $('trackLbl').textContent = tr;
  if (force || lastHud.n !== g.nickels) {
    $('coins').innerHTML = `${g.nickels}<small>¢</small>`;
    if (!force && g.nickels > lastHud.n) { $('coins').classList.remove('bump'); void $('coins').offsetWidth; $('coins').classList.add('bump'); }
    for (const b of document.querySelectorAll('.strip')) {
      const c = PARTS[b.dataset.part].cost[0];
      b.querySelector('em').textContent = c + '¢';
      b.classList.toggle('poor', g.nickels < c);
    }
    if (popFor) refreshPop();
  }
  if (force || lastHud.f !== g.fidelity) {
    [...$('vu').children].forEach((el, i) => {
      el.className = i < g.fidelity ? 'on' + (i < 5 ? ' red' : i < 10 ? ' amb' : '') : '';
    });
    if (!force && g.fidelity < lastHud.f) { $('vu').classList.remove('hurt'); void $('vu').offsetWidth; $('vu').classList.add('hurt'); }
  }
  if (force || lastHud.p !== g.pitch) {
    $('pitchOut').innerHTML = `${g.pitch > 0 ? '+' : ''}${g.pitch}%<small>×${PITCH_SCORE[g.pitch]} score</small>`;
  }
  const canPlay = mode === 'play' && g.state === 'between' && g.track + 1 < g.tracks && (!lesson || lesson.canPlay);
  if (canPlay !== lastHud.play || force) {
    show('playBtn', canPlay);
    $('playTxt').innerHTML = `Play<small>track ${g.track + 2}</small>`;
  }
  lastHud = { tr, n: g.nickels, f: g.fidelity, p: g.pitch, play: canPlay };
}

function playTrack() {
  if (!game || mode !== 'play' || game.state !== 'between' || (lesson && !lesson.canPlay)) return;
  if (game.startTrack()) { sound.drop(); closePop(); disarm(); hud(); }
}
$('playBtn').addEventListener('click', playTrack);

// ---------- pitch
function nudgePitch(d) {
  if (!game) return;
  const i = PITCHES.indexOf(game.pitch), j = Math.max(0, Math.min(PITCHES.length - 1, i + d));
  if (i === j) { sound.nope(); return; }
  game.setPitch(PITCHES[j]); sound.tick(); hud();
}
$('pitchDn').onclick = () => nudgePitch(-1);
$('pitchUp').onclick = () => nudgePitch(1);

// ---------- building
function disarm() {
  armed = null; view.hi = lesson?.hi || [];
  for (const b of document.querySelectorAll('.strip')) b.classList.remove('armed');
}
function arm(part) {
  closePop();
  if (armed === part) { disarm(); return; }
  armed = part;
  for (const b of document.querySelectorAll('.strip')) b.classList.toggle('armed', b.dataset.part === part);
  view.hi = game.slots.map((s, i) => i).filter(i => !game.towerAt(i));
}
function tryPlace(slot, part) {
  if (game.towerAt(slot)) return false;
  if (game.nickels < PARTS[part].cost[0]) { sound.nope(); flashPoor(part); return false; }
  const tw = game.place(slot, part);
  if (tw) { view.popups.push({ x: tw.x, y: tw.y - 14, text: PARTS[part].name.toUpperCase(), color: PARTS[part].color, size: 10 }); }
  return !!tw;
}
function flashPoor(part) {
  const b = document.querySelector(`.strip[data-part="${part}"]`);
  b?.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 200 });
}
function slotAt(px, py, extra = 0) {
  const p = view.toWorld(px, py);
  const R = Math.max(15, 24 / view.k) + extra;
  let best = -1, bd = R;
  game.slots.forEach((s, i) => { const d = Math.hypot(s.x - p.x, s.y - p.y); if (d < bd) { bd = d; best = i; } });
  return best;
}

// ---------- popovers
function closePop() { popFor = null; show('popover', false); view.sel = null; }
function openPop(kind, slot) {
  popFor = { kind, slot };
  view.sel = kind === 'tower' ? game.towerAt(slot) : null;
  refreshPop();
  show('popover', true);
  // put it off the deck if there's room (beside it, or under it on a tall phone), so it never hides the label
  const s = game.slots[slot], p = view.toScreen(s.x, s.y), el = $('popover');
  const w = el.offsetWidth, h = el.offsetHeight, gap = 18 * view.k + 8;
  const c = view.toScreen(0, 0), half = 145 * view.k;
  const top = $('hud').offsetHeight + 4, bottom = side ? H - 4 : H - $('tray').offsetHeight - 4, right = W - trayW;
  const clampY = y => Math.max(top, Math.min(bottom - h, y));
  let x, y;
  if ((s.x < 0 || side) && c.x - half - 8 >= w + 8) { x = c.x - half - 8 - w; y = clampY(p.y - h / 2); }
  else if (s.x >= 0 && right - (c.x + half + 8) >= w + 8) { x = c.x + half + 8; y = clampY(p.y - h / 2); }
  else if (bottom - (c.y + half + 6) >= h) { x = Math.max(8, Math.min(W - w - 8, p.x - w / 2)); y = c.y + half + 6; }
  else { x = Math.max(8, Math.min(W - w - 8, p.x - w / 2)); y = clampY(p.y > c.y ? p.y - gap - h : p.y + gap); }
  el.style.left = x + 'px'; el.style.top = y + 'px';
}
function refreshPop() {
  if (!popFor) return;
  const el = $('popover'), g = game;
  if (popFor.kind === 'slot') {
    const hint = lesson?.want;
    el.innerHTML = `<h4>Socket <small>${g.slots[popFor.slot].kind === 'bridge' ? 'on the bridge' : 'on the plinth'}</small></h4><p>Which part plays here?</p><div class="pick">` +
      PART_KEYS.map(k => `<button data-part="${k}" style="--c:${PARTS[k].color}" ${g.nickels < PARTS[k].cost[0] ? 'disabled' : ''} class="${hint === k ? 'hint' : ''}"><i></i>${PARTS[k].name}<em>${PARTS[k].cost[0]}¢</em></button>`).join('') + '</div>';
    el.querySelectorAll('button').forEach(b => b.onclick = () => { const s = popFor.slot; closePop(); tryPlace(s, b.dataset.part); });
  } else {
    const tw = g.towerAt(popFor.slot);
    if (!tw) { closePop(); return; }
    view.sel = tw;
    const P = PARTS[tw.part], up = g.upCost(tw);
    const what = tw.lvl === 1 ? 'Level 2 hits harder and reaches further.' : tw.lvl === 2 ? 'Level 3 plays <b>fills</b>: more notes, so more shots.' : 'Top of the bill. It plays every fill.';
    el.innerHTML = `<h4>${P.name} <small>level ${tw.lvl} · ${tw.kills} swept</small></h4><p>${P.blurb} ${what}</p><div class="acts">` +
      `<button class="up" ${up == null || g.nickels < up ? 'disabled' : ''}>${up == null ? 'Maxed' : 'Upgrade'}<small>${up == null ? '' : up + '¢'}</small></button>` +
      `<button class="sell">Sell<small>+${g.refund(tw)}¢</small></button></div>`;
    el.querySelector('.up').onclick = () => { if (g.upgrade(tw)) { view.popups.push({ x: tw.x, y: tw.y - 14, text: 'LEVEL ' + tw.lvl, color: P.color, size: 10 }); refreshPop(); } };
    el.querySelector('.sell').onclick = () => { g.sell(tw); closePop(); };
  }
}

// a tap anywhere off the popover (and off the deck, which handles its own) closes it
document.addEventListener('pointerdown', e => {
  if (popFor && !$('popover').contains(e.target) && e.target !== cv) closePop();
}, true);

// ---------- pointer on the deck
cv.addEventListener('pointerdown', e => {
  if (mode !== 'play' || DEMO) return;
  sound.init();
  const slot = slotAt(e.clientX, e.clientY);
  if (slot < 0) {
    // the label plays the next track too
    const p = view.toWorld(e.clientX, e.clientY);
    if (Math.hypot(p.x, p.y) < R_LABEL + 4) playTrack();
    closePop(); disarm(); return;
  }
  const tw = game.towerAt(slot);
  if (tw) { disarm(); if (popFor?.slot === slot) closePop(); else openPop('tower', slot); return; }
  if (armed) { const part = armed; if (tryPlace(slot, part)) { if (game.nickels < PARTS[part].cost[0] || e.pointerType !== 'mouse') disarm(); else view.hi = game.slots.map((s, i) => i).filter(i => !game.towerAt(i)); } return; }
  if (popFor?.slot === slot) closePop(); else openPop('slot', slot);
});
cv.addEventListener('pointermove', e => {
  if (mode !== 'play' || e.pointerType !== 'mouse') return;
  const s = slotAt(e.clientX, e.clientY);
  view.hoverSlot = s;
  cv.style.cursor = s >= 0 ? 'pointer' : 'default';
});

// ---------- strips: tap to arm, or drag one onto a socket
let drag = null;
for (const b of document.querySelectorAll('.strip')) {
  b.addEventListener('pointerdown', e => {
    if (mode !== 'play') return;
    sound.init();
    drag = { part: b.dataset.part, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    b.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  b.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10) { drag.moved = true; closePop(); }
    if (drag.moved) {
      const s = slotAt(e.clientX, e.clientY, 8);
      const w = view.toWorld(e.clientX, e.clientY - (e.pointerType === 'touch' ? 40 : 0));
      view.ghost = { part: drag.part, x: w.x, y: w.y, slot: s >= 0 && !game.towerAt(s) ? s : -1 };
      if (e.pointerType === 'touch' && s < 0) { const s2 = slotAt(e.clientX, e.clientY - 40, 8); if (s2 >= 0 && !game.towerAt(s2)) view.ghost.slot = s2; }
      view.hi = game.slots.map((s, i) => i).filter(i => !game.towerAt(i));
    }
  });
  const end = e => {
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag; drag = null;
    if (d.moved) {
      const g = view.ghost; view.ghost = null; view.hi = lesson?.hi || [];
      if (g && g.slot >= 0 && e.type === 'pointerup') tryPlace(g.slot, d.part);
    } else if (e.type === 'pointerup') arm(d.part);
  };
  b.addEventListener('pointerup', end);
  b.addEventListener('pointercancel', end);
  // keyboard
  b.addEventListener('click', e => { if (e.detail === 0 && mode === 'play') arm(b.dataset.part); });
}

// ---------- keys
window.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (mode === 'play') {
    const n = '1234'.indexOf(e.key);
    if (n >= 0) { arm(PART_KEYS[n]); e.preventDefault(); return; }
    if (e.key === ' ' || e.key === 'Enter') { if (document.activeElement?.tagName !== 'BUTTON' || e.key === ' ') { playTrack(); e.preventDefault(); } return; }
    if (e.key === 'Escape') { if (armed || popFor) { disarm(); closePop(); } else pause(); return; }
    if (e.key === 'q' || e.key === '-' || e.key === '[') { nudgePitch(-1); return; }
    if (e.key === 'e' || e.key === '=' || e.key === '+' || e.key === ']') { nudgePitch(1); return; }
    if (e.key === 'u' && view.sel) { $('popover').querySelector('.up')?.click(); return; }
    if ((e.key === 'x' || e.key === 'Delete' || e.key === 'Backspace') && view.sel) { $('popover').querySelector('.sell')?.click(); return; }
  } else if (mode === 'pause' && (e.key === 'Escape' || e.key === ' ')) { e.preventDefault(); resume(); }
});

// ---------- pause / results
function pause() { if (mode === 'play') { setMode('pause'); } }
function resume() { if (mode === 'pause') { setMode('play'); if (lesson) showLesson(); } }
$('pauseBtn').onclick = pause;
$('resumeBtn').onclick = resume;
$('restartBtn').onclick = () => start(game.ri);
$('quitBtn').onclick = () => setMode('title');
$('againBtn').onclick = () => start(game.ri);
$('crateBtn').onclick = () => setMode('title');
$('nextBtn').onclick = () => start(Math.min(RECORDS.length - 1, game.ri + 1));
document.addEventListener('visibilitychange', () => { if (document.hidden && !DEBUG) pause(); });
const toggleMute = () => { save.muted = !save.muted; sound.setMuted(save.muted); store(); $('mute').textContent = save.muted ? 'OFF' : 'ON'; $('muteT').textContent = save.muted ? 'Sound off' : 'Sound on'; };
$('mute').onclick = toggleMute; $('muteT').onclick = toggleMute;
$('mute').textContent = save.muted ? 'OFF' : 'ON';

function results() {
  const g = game, won = g.state === 'won', r = g.rec;
  const stars = won ? g.stars() : 0;
  const prev = save.best[r.id];
  const newBest = won && (!prev || g.score > prev.score);
  if (won) {
    save.best[r.id] = { stars: Math.max(stars, prev?.stars || 0), score: Math.max(g.score, prev?.score || 0) };
    if (r.id === 'lesson') save.lesson = true;
    store();
  }
  $('overTitle').textContent = won ? (r.id === 'lesson' ? 'Lesson over' : 'Side A, done') : 'Skipped out';
  $('overTitle').className = won ? '' : 'red';
  $('overSub').textContent = !won ? `The dust got to the label one time too many, ${g.track + 1 >= g.tracks ? 'on the last track' : `on track ${g.track + 1} of ${g.tracks}`}.`
    : r.id === 'lesson' ? 'That\'s the lot. The long-players are dustier, the 45 is scratched, and the 78 is warped.'
    : stars === 3 ? 'Not one skip. Play it on the radio.' : stars === 2 ? 'A couple of skips, but it\'ll play.' : 'It\'s scratchy, but it got to the end.';
  $('discs').innerHTML = [0, 1, 2].map(k => `<i class="${stars > k ? '' : 'off'}"></i>`).join('');
  $('discs').hidden = !won;
  $('tally').innerHTML = `<span>Dust swept</span><b>${g.kills}</b><span>Tracks played</span><b>${won ? g.tracks : g.track} of ${g.tracks}</b>` +
    `<span>Fidelity left</span><b>${g.fidelity} / ${FIDELITY}</b>` +
    `<span class="total">Score${newBest && prev ? '<span class="newbest">Best yet</span>' : ''}</span><b>${g.score.toLocaleString()}</b>`;
  const hasNext = won && g.ri + 1 < RECORDS.length;
  $('nextBtn').hidden = !hasNext;
  $('againBtn').className = hasNext ? 'btn' : 'btn red';
  show('note', false);
  setMode('over');
}

// ---------- the lesson: liner notes that wait for you to do each thing
const LESSON = [
  { text: '<b>This is a record, and it\'s dusty.</b> Dust comes on at the pale notch on the rim and walks the groove, round and round, toward the label. Each speck that reaches the label makes the record skip, and costs <b>fidelity</b>.', btn: 'Go on' },
  { text: 'Towers go in the brass sockets. <b>Tap the glowing socket</b> and pick <b>Kick</b>. (You can also drag a strip from the tray onto a socket.)', hi: [0], want: 'kick', done: g => g.towers.some(t => t.part === 'kick') },
  { text: 'Hear that? <b>Each tower plays one part of the song</b>, and fires when its part plays. The kick thumps on the kick drum, and lobs a shell to where the dust is about to be.', btn: 'Next' },
  { text: 'Now <b>tap the label</b> in the middle to drop the needle on track 1.', play: true, done: g => g.state === 'track' },
  { text: 'The record carries the dust past your tower once a turn. Anything that slips by comes back round, a little closer to the middle.', play: true, done: g => g.state === 'between' && g.track >= 0 },
  { text: 'Popped dust and cleared tracks pay nickels. Add a <b>Hat</b>: it ticks on every eighth note, so it fires a lot, but lightly.', hi: [5], want: 'hat', done: g => g.towers.some(t => t.part === 'hat') },
  { text: 'The <b>bridge</b> over the record reaches the inner grooves, where dust is nearly home. Put a <b>Bass</b> on it: it wobbles on the bassline and slows everything near it. Have a tip from the jukebox.', hi: [7, 8], want: 'bass', tip: 75, done: g => g.towers.some(t => t.part === 'bass') },
  { text: 'Track 2 has <b>hair</b> in it: thin, and quick. Tap the label when you\'re ready.', play: true, done: g => g.state === 'track' },
  { text: 'Listen to the groove fill in as you build.', play: true, done: g => g.state === 'between' && g.track >= 1 },
  { text: '<b>Tap a tower</b> to upgrade it. Level 2 hits harder and reaches further. Level 3 plays <b>fills</b>: extra notes, so extra shots.', tip: 60, done: g => g.towers.some(t => t.lvl >= 2) },
  { text: 'Last thing: <b>pitch</b>, down in the corner. Pitching up spins the record and the song faster, so towers fire faster. Slow and steady scores more.', btn: 'Got it', pitch: true },
  { text: 'Track 3 brings <b>crumbs</b>: slow and tough. Tap the label when you\'re ready. After this, the crate\'s yours.', play: true, done: g => g.state === 'track' },
  { text: null, play: true },
];
function nextLesson() {
  lesson.i++;
  const L = LESSON[lesson.i];
  if (!L) return;
  lesson.hi = L.hi || []; lesson.want = L.want || null; lesson.canPlay = !!L.play;
  if (L.tip && game.nickels < L.tip) { const add = L.tip - game.nickels; game.nickels += add; view.popups.push({ x: 0, y: -60, text: `+${add}¢ TIP`, color: '#e8b62c', size: 13 }); }
  view.hi = lesson.hi;
  showLesson();
  hud(true);
}
function showLesson() {
  const L = LESSON[lesson.i], n = $('note');
  document.querySelectorAll('.strip').forEach(b => b.classList.toggle('hint', !!L?.want && b.dataset.part === L.want));
  $('pitch').classList.toggle('hint', !!L?.pitch);
  if (!L || !L.text) { show('note', false); return; }
  n.innerHTML = `<span class="step">Liner notes · ${lesson.i + 1} of ${LESSON.length - 1}</span>${L.text}` + (L.btn ? `<br><button id="noteBtn">${L.btn}</button>` : '');
  show('note', true);
  n.classList.remove('pop-in'); void n.offsetWidth; n.classList.add('pop-in');
  if (L.btn) $('noteBtn').onclick = () => nextLesson();
}
function lessonTick() {
  if (!lesson || mode !== 'play') return;
  const L = LESSON[lesson.i];
  if (L?.done && L.done(game)) nextLesson();
}

// ---------- events from the sim
function consume() {
  const g = game;
  for (const e of g.events) {
    switch (e.type) {
      case 'step': if (mode === 'play' || DEMO) sound.step(g.song, e.s, g.partLevels(), -e.dt + e.at + LAT); break;
      case 'fire': {
        const t = e.tower, P = PARTS[t.part];
        if (t.part === 'snare') view.fx.push({ kind: 'crack', x0: t.x, y0: t.y, x: e.x, y: e.y, t: 0, T: 0.16, j: Array.from({ length: 11 }, () => Math.random() - 0.5) });
        else if (t.part === 'hat') view.fx.push({ kind: 'tick', x0: t.x, y0: t.y, x: e.x, y: e.y, t: 0, T: 0.12 });
        else if (t.part === 'bass') view.fx.push({ kind: 'wave', x: t.x, y: t.y, r: P.range[t.lvl - 1], t: 0, T: 0.4 });
        break;
      }
      case 'boom': view.fx.push({ kind: 'boom', x: e.x, y: e.y, r: e.r, t: 0, T: 0.35 }); break;
      case 'kill':
        view.fx.push({ kind: 'puff', x: e.x, y: e.y, t: 0, T: 0.45, seed: Math.random() * 6 });
        view.popups.push({ x: e.x, y: e.y - 6, text: `+${e.pay}¢`, color: '#e8b62c', size: 8 });
        if (mode === 'play') sound.popKill(g.song, 0);
        break;
      case 'leak':
        view.fx.push({ kind: 'skip', t: 0, T: 0.6 }); view.shake = 1;
        view.popups.push({ x: 0, y: -4, text: 'SKIP!', color: '#e2553a', size: 16 });
        if (mode === 'play') { sound.leak(); navigator.vibrate?.(40); }
        break;
      case 'scratch': view.fx.push({ kind: 'blink', x: e.x, y: e.y, t: 0, T: 0.35 }); view.popups.push({ x: e.x, y: e.y - 8, text: 'scratch!', color: '#f1e6cc', size: 7 }); break;
      case 'skip': view.fx.push({ kind: 'blink', x: e.x, y: e.y, t: 0, T: 0.3 }); break;
      case 'place': if (mode === 'play') sound.place(); if (lesson) view.hi = lesson.hi; break;
      case 'upgrade': if (mode === 'play') sound.upgrade(); break;
      case 'sell': if (mode === 'play') sound.sell(); break;
      case 'track': view.trackTotal = g.queue.length; break;
      case 'cleared':
        view.popups.push({ x: 0, y: -50, text: `TRACK ${e.n + 1} CLEARED  +${e.bonus}¢`, color: '#e8b62c', size: 11 });
        if (mode === 'play') sound.cleared();
        if (g.state === 'won') { endT = 1.6; if (mode === 'play') sound.won(); }
        break;
      case 'lost': endT = 1.4; if (mode === 'play') sound.lost(); break;
    }
  }
  g.events.length = 0;
}

// ---------- the loop
let last = performance.now();
function tick(dt) {
  if (!game) return;
  if (mode === 'play' || DEMO) {
    for (let i = 0; i < SPEED; i++) {
      if (bot) { bot.update(dt); if (game.state === 'between' && (bot.wait = (bot.wait || 0) + dt) > 2) { bot.wait = 0; game.startTrack(); } }
      game.step(dt);
      consume();
    }
    lessonTick();
    if (endT > 0 && (endT -= dt) <= 0 && !DEMO) results();
    hud();
  } else if (mode === 'over') {
    game.step(dt); consume();
  }
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!hold) tick(dt);
  if (game && mode !== 'title') view.draw(game, mode === 'pause' ? 0 : dt, now / 1000);
  requestAnimationFrame(frame);
}

// ---------- boot
if (DEMO) {
  document.body.classList.add('demo');
  game = new Game({ record: 2 });
  bot = new Bot(game, { order: ['hat', 'kick', 'bass', 'snare', 'hat', 'kick', 'bass', 'hat', 'snare'] });
  sound.song = game.song;
  $('recName').textContent = game.song.title;
  buildVu();
  mode = 'play';
  show('title', false); show('hud', true); show('tray', true);
  layout();
  // run it forward to a busy moment
  for (let t = 0; t < 196; t += 1 / 60) {
    bot.update(1 / 60);
    if (game.state === 'between' && (bot.wait = (bot.wait || 0) + 1 / 60) > 1.5) { bot.wait = 0; game.startTrack(); }
    game.step(1 / 60); game.events.length = 0;
  }
  view.trackTotal = 30;
  hud(true);
} else {
  setMode('title');
}
document.fonts?.ready.then(() => { view.recKey = ''; layout(); });
layout();
requestAnimationFrame(frame);
window.toyboxReady?.();

if (DEBUG) {
  window.nd = {
    get game() { return game; }, view, sound, start, setMode, results,
    hold(on = true) { hold = on; },
    ff(sec, dt = 1 / 30) { for (let t = 0; t < sec; t += dt) { tick(dt); for (const f of view.fx) f.t += dt; for (const p of view.popups) p.t += dt; } view.draw(game, dt, performance.now() / 1000); },
    autoplay() { bot = new Bot(game); },
    planner() { const b = new Bot(game); return () => { const a = b.next(); if (a) b.n++; return a && (a.type === 'up' ? { type: 'up', slot: a.tower.slot } : a); }; },
  };
}
