import { Game } from './game.js';
import { Art, drawItem } from './art.js';
import * as L from './level.js';
import { sfx, unlock, setMuted, isMuted, update as soundUpdate } from './sound.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo'), DEBUG = params.has('debug');
const KEY = { save: 'dollhouse.save', coach: 'dollhouse.coach', best: 'dollhouse.best' };
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

const cv = $('#cv'), ctx = cv.getContext('2d');
const art = new Art();
let game = null;
let mode = 'title'; // title | play | pause | card | house | ending
let touch = matchMedia('(pointer: coarse)').matches;
let vw = innerWidth, vh = innerHeight, dpr = Math.min(2, devicePixelRatio || 1), portrait = false;
const cam = { x: 36, y: 25, s: 30, ov: 1 };

function closeScale() { return Math.max(22, Math.min(64, Math.min(vw, vh) / 13.5)); }
function houseScale() { return Math.min(vw / (L.W + 1), (vh - 40) / (L.H - 2)); }
let bakeTimer = 0;
function resize() {
  vw = innerWidth; vh = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
  portrait = vh > vw * 1.1;
  document.body.classList.toggle('portrait', portrait);
  cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
  const want = Math.max(24, Math.min(48, Math.ceil(closeScale() * dpr)));
  if (game && !art.bake) art.build(game, want);
  else if (game && want > art.B + 6) { clearTimeout(bakeTimer); bakeTimer = setTimeout(() => art.build(game, want), 250); }
}
addEventListener('resize', resize);
function setTouch(on) { touch = on; document.body.classList.toggle('touch', on); coachCur = null; }

// ---------- input
const held = { left: false, right: false, jump: false };
const tHeld = { left: false, right: false, jump: false };
let presses = {};
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump',
  KeyJ: 'jab', KeyX: 'jab', ShiftLeft: 'dash', ShiftRight: 'dash', KeyK: 'dash', KeyC: 'dash', KeyL: 'dash',
  ArrowDown: 'shrink', KeyS: 'shrink', KeyQ: 'shrink', KeyE: 'use', KeyF: 'use', Enter: 'use',
};
let cardShownAt = 0;
addEventListener('keydown', (e) => {
  unlock();
  if (e.code === 'Tab') e.preventDefault();
  if (e.target && e.target.tagName === 'INPUT') return;
  if (mode === 'title') { if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) { e.preventDefault(); ($('#contBtn').hidden ? $('#newBtn') : $('#contBtn')).click(); } return; }
  if (mode === 'card') { if (['Enter', 'Space', 'Escape', 'KeyE', 'KeyJ', 'KeyX'].includes(e.code) && !e.repeat && performance.now() - cardShownAt > 600) { e.preventDefault(); closeCard(); } return; }
  if (mode === 'pause') { if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) resume(); else if (e.code === 'Enter' && !e.repeat) { e.preventDefault(); resume(); } return; }
  if (mode === 'ending') { if (e.code === 'Enter' && !e.repeat) { e.preventDefault(); $('#keepBtn').click(); } return; }
  if (mode === 'house') { if (['Tab', 'KeyM', 'Escape', 'Enter', 'Space', 'KeyH'].includes(e.code) && !e.repeat) { e.preventDefault(); closeHouse(); } return; }
  if (mode !== 'play') return;
  if (touch && !e.repeat && KEYMAP[e.code]) setTouch(false);
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) { pause(); return; }
  if ((e.code === 'Tab' || e.code === 'KeyH') && !e.repeat) { openHouse(); return; }
  if (e.code === 'KeyM' && !e.repeat) { toggleMute(); return; }
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault();
  if (k in held) { if (!held[k] && k === 'jump') presses.jump = true; held[k] = true; }
  else if (!e.repeat) presses[k] = true;
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k in held) held[k] = false; });
addEventListener('blur', () => { for (const k in held) held[k] = false; for (const k in tHeld) tHeld[k] = false; padPts.clear(); padUpdate(); });
cv.addEventListener('mousedown', (e) => { unlock(); if (mode === 'play' && e.button === 0 && !touch) presses.jab = true; if (mode === 'house') closeHouse(); });
cv.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('touchstart', () => { if (!touch) setTouch(true); unlock(); }, { passive: true });

// pinch on the canvas: out to see the whole house, in to go back
const pinch = new Map(); let pinch0 = 0;
cv.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) pinch.set(t.identifier, [t.clientX, t.clientY]); if (pinch.size === 2) pinch0 = pinchD(); if (mode === 'house' && e.touches.length === 1) houseTap = performance.now(); }, { passive: true });
cv.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) if (pinch.has(t.identifier)) pinch.set(t.identifier, [t.clientX, t.clientY]);
  if (pinch.size === 2 && pinch0) { const d = pinchD(); if (mode === 'play' && d < pinch0 * 0.7) { openHouse(); pinch0 = 0; } else if (mode === 'house' && d > pinch0 * 1.35) { closeHouse(); pinch0 = 0; } }
}, { passive: true });
let houseTap = 0;
cv.addEventListener('touchend', (e) => { for (const t of e.changedTouches) pinch.delete(t.identifier); if (pinch.size < 2) pinch0 = 0; if (mode === 'house' && performance.now() - houseTap < 300 && e.touches.length === 0) closeHouse(); }, { passive: true });
function pinchD() { const [a, b] = [...pinch.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); }

// touch pad: slide a thumb across it
const pad = $('#pad'); const padPts = new Map();
function padUpdate() {
  let l = false, r = false;
  const rc = pad.getBoundingClientRect(), mid = rc.left + rc.width / 2;
  for (const x of padPts.values()) { if (x < mid - 6) l = true; else if (x > mid + 6) r = true; }
  tHeld.left = l; tHeld.right = r;
  pad.querySelector('.l').classList.toggle('on', l); pad.querySelector('.r').classList.toggle('on', r);
}
pad.addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); pad.setPointerCapture(e.pointerId); padPts.set(e.pointerId, e.clientX); padUpdate(); });
pad.addEventListener('pointermove', (e) => { if (padPts.has(e.pointerId)) { padPts.set(e.pointerId, e.clientX); padUpdate(); } });
for (const ev of ['pointerup', 'pointercancel']) pad.addEventListener(ev, (e) => { padPts.delete(e.pointerId); padUpdate(); });
function holdBtn(el, onDown, onUp) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); el.setPointerCapture(e.pointerId); el.classList.add('on'); onDown(); });
  for (const ev of ['pointerup', 'pointercancel']) el.addEventListener(ev, () => { el.classList.remove('on'); onUp && onUp(); });
  el.addEventListener('click', (e) => e.preventDefault());
}
holdBtn($('#tJump'), () => { presses.jump = true; tHeld.jump = true; }, () => { tHeld.jump = false; });
holdBtn($('#tJab'), () => { presses.jab = true; });
holdBtn($('#tDash'), () => { presses.dash = true; });
holdBtn($('#tShrink'), () => { presses.shrink = true; });
holdBtn($('#tUse'), () => { presses.use = true; });

function takeInput() {
  const inp = {
    left: held.left || tHeld.left, right: held.right || tHeld.right, jumpHeld: held.jump || tHeld.jump,
    jumpPressed: !!presses.jump, jab: !!presses.jab, dash: !!presses.dash, shrink: !!presses.shrink, use: !!presses.use,
  };
  presses = {};
  return inp;
}

// ---------- the coach: one line at a time, each one taught by doing it
const K = (k, t) => touch ? t : k;
let coachDone = new Set(ls.get(KEY.coach, []));
const coachT = {};
const COACH = [
  { id: 'move', when: (g) => true, done: (g) => g.p.x > L.START.x + 2.5 || g.p.y > 15,
    text: () => K('Walk with <em>A</em> and <em>D</em>, or the arrow keys.', 'Hold <em>◀ ▶</em> on the left to walk.') },
  { id: 'jump', when: (g) => g.p.x > 13.4 && g.p.y < 15, done: (g) => g.p.x > 17.2 || g.p.y > 15,
    text: () => K('Jump with <em>Space</em>. Hold it longer to jump higher.', 'Tap <em>Jump</em>. Hold it longer to jump higher.') },
  { id: 'jab', when: (g) => g.p.x > 16.5 && g.p.y < 15 && g.enemies[0] && !g.enemies[0].dead, done: (g) => !g.enemies[0] || g.enemies[0].dead || g.p.x > 24 || g.p.y > 15,
    text: () => K('A moth. Jab it with <em>J</em> or <em>X</em>, or click.', 'A moth. Tap <em>Jab</em> to poke it with your sabre.') },
  { id: 'medal', when: (g) => g.p.x > 18 && g.p.y < 15 && !g.medals.has('m1'), done: (g) => g.medals.has('m1') || g.p.x > 24.5 || g.p.y > 15,
    text: () => 'Tin medals are hidden all over the house. Jump for that one.' },
  { id: 'dash', when: (g) => g.has.has('key') && g.p.y < 15, done: (g) => g.p.x > 36 || g.p.y > 15,
    text: () => K('Run, jump, then <em>Shift</em> (or <em>K</em>) to dash over the pins.', 'Run, jump, then tap <em>Dash</em> to fly over the pins.') },
  { id: 'stand', when: (g) => g.near.stand && !g.flags.jack && g.bench === g.near.stand.id, done: () => coachT.stand > 5,
    text: () => 'A winding stand. It winds you back up, and if you ever run down you start again from the last one.' },
  { id: 'hatch', when: (g) => g.p.x > 44 && g.p.y < 15 && !g.flags.jack, done: (g) => g.p.y > 15,
    text: () => 'The hatch to the nursery is at the end of the attic. Drop through.' },
  { id: 'jack', when: (g) => g.boss && g.boss.kind === 'jack', done: (g) => !g.boss || g.boss.hp < g.boss.max,
    text: () => K('When his head lunges out and sticks, jump up and <em>jab</em> it.', 'When his head lunges out and sticks, jump and <em>Jab</em> it.') },
  { id: 'float', when: (g) => g.has.has('umbrella'), done: (g) => (g.tutor.float || 0) > 0 && !g.p.umb,
    text: () => K('Hold <em>Space</em> as you fall to float on the parasol.', 'Keep holding <em>Jump</em> as you fall to float on the parasol.') },
  { id: 'tacks', when: (g) => g.has.has('umbrella') && g.room && g.room.id === 'hall' && g.p.x > 38 && !g.visited.has('kitchen'), done: (g) => g.visited.has('kitchen'),
    text: () => K('Jump, <em>dash</em>, and keep holding <em>Space</em>: the parasol carries you over the tacks.', 'Jump, <em>Dash</em>, and keep holding <em>Jump</em>: the parasol carries you over the tacks.') },
  { id: 'house', when: (g) => g.visited.size >= 4, done: () => houseOpened,
    text: () => K('Press <em>Tab</em> to pull back and see the whole house.', 'Pinch out, or tap <em>House</em>, to see the whole house.') },
  { id: 'climb', when: (g) => g.has.has('boots'), done: (g) => (g.tutor.climb || 0) > 1,
    text: () => 'Jump at something iron and keep holding toward it: the boots walk you straight up. The pipe by the trapdoor is iron.' },
  { id: 'window', when: (g) => g.has.has('boots') && g.room && g.room.id === 'kitchen' && !g.visited.has('garden'), done: (g) => g.visited.has('garden'),
    text: () => 'The boiler under the kitchen window is iron too.' },
  { id: 'draft', when: (g) => g.has.has('umbrella') && g.room && g.room.id === 'kitchen' && g.p.x > 63 && g.p.y > 32, done: (g) => (g.tutor.draft || 0) > 1,
    text: () => K('Stand on the range and float: warm air carries the parasol up the chimney.', 'Stand on the range and hold <em>Jump</em>: warm air carries the parasol up the chimney.') },
  { id: 'shrink', when: (g) => g.has.has('thimble'), done: (g) => (g.tutor.shrink || 0) > 0,
    text: () => K('Press <em>S</em> or <em>↓</em> to shrink. Press it again to grow back. Mouse holes are low and dark.', 'Tap <em>Shrink</em> to become mouse-sized, and again to grow. Mouse holes are low and dark.') },
  { id: 'wake', when: (g) => g.has.has('musicbox') && g.awake.size === 0, done: (g) => g.awake.size > 0,
    text: () => K('Stand beside a sleeping toy and press <em>E</em> to play the music box.', 'Stand beside a sleeping toy and tap <em>♪</em>.') },
];
let coachCur = null;
setTouch(touch);
function updateCoach(dt) {
  const g = game; let show = null;
  for (const c of COACH) {
    if (coachDone.has(c.id)) continue;
    if (c.when(g)) { coachT[c.id] = (coachT[c.id] || 0) + dt; if (c.done(g)) { coachDone.add(c.id); ls.set(KEY.coach, [...coachDone]); continue; } show = c; break; }
  }
  const el = $('#coach');
  if (!show || DEMO || mode !== 'play' || g.near.note) { el.hidden = true; coachCur = null; return; }
  if (coachCur !== show.id || el.dataset.touch !== String(touch)) { el.innerHTML = show.text(); coachCur = show.id; el.dataset.touch = String(touch); }
  el.hidden = false;
}
function refreshCoach() { coachCur = null; }

// ---------- HUD and messages
const COG = (on) => `<span class="cog${on ? '' : ' empty'}"><svg viewBox="-12 -12 24 24"><path d="${cogPath()}" fill="${on ? '#c9a24c' : '#7a6a4a'}" stroke="#6a4f1e" stroke-width="1"/><circle r="3" fill="#efe3c2"/></svg></span>`;
let cogD = null;
function cogPath() { if (cogD) return cogD; let d = ''; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 7.5 : 10; d += (i ? 'L' : 'M') + (Math.cos(a) * r).toFixed(2) + ' ' + (Math.sin(a) * r).toFixed(2); } return (cogD = d + 'Z'); }
let hudKey = '', toastKey = '';
function updateHud() {
  const p = game.p, mx = game.maxHp();
  const k = `${p.hp}/${mx}/${game.medals.size}`;
  if (k !== hudKey) {
    hudKey = k;
    $('#hpTag').innerHTML = Array.from({ length: mx }, (_, i) => COG(i < p.hp)).join('');
    $('#medalN').textContent = game.medals.size ? `${game.medals.size} of ${L.MEDALS.length}` : `none of ${L.MEDALS.length}`;
  }
  const b = $('#boss'), boss = game.boss;
  if (boss && boss.state !== 'intro' && boss.hp > 0) { b.hidden = false; b.querySelector('span').textContent = L.BOSSES[boss.kind].name; b.querySelector('b').style.width = (boss.hp / boss.max * 100) + '%'; }
  else b.hidden = true;
  const n = game.near.note, ne = $('#note');
  if (n && mode === 'play' && !boss) { if (ne.dataset.t !== n.t) { ne.textContent = n.t; ne.dataset.t = n.t; sfx.page(); } ne.hidden = false; } else { ne.hidden = true; ne.dataset.t = ''; }
  // toasts sit under whatever else is at the top: a note tag or the boss bar
  const tk = (ne.hidden ? '' : ne.dataset.t) + '|' + b.hidden + '|' + vw;
  if (tk !== toastKey) { toastKey = tk; const over = !ne.hidden ? ne : !b.hidden ? b : null; $('#toast').style.top = over ? (over.offsetTop + over.offsetHeight + 10) + 'px' : ''; }
  $('#tDash').hidden = !game.has.has('key');
  $('#tShrink').hidden = !game.has.has('thimble');
  $('#tShrink').textContent = game.p.small ? 'Grow' : 'Shrink';
  $('#tUse').hidden = !(game.has.has('musicbox') && game.near.toy);
}
let toastT = 0;
function toast(html, sec = 2.6) { const t = $('#toast'); t.innerHTML = html; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), sec * 1000); }
function banner(name, sub) {
  const b = $('#banner'); b.innerHTML = esc(name) + (sub ? `<small>${esc(sub)}</small>` : '');
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- events from the game
const ROOMSUB = { attic: 'where the old toys go', bedroom: 'mind the iron bedstead', landing: 'up and down the stairs', nursery: 'the Jack-in-the-box lives here', parlour: 'for best',
  hall: 'the grandfather clock keeps time', kitchen: 'the range is always lit', den: 'the mice live here', cellar: 'coal, pipes, the boiler', garden: 'the cat next door', roof: 'mind the slates' };
const HOW = {
  key: () => K('Press <kbd>Shift</kbd> or <kbd>K</kbd> to dash. Once in the air, too.', 'Tap <b>Dash</b>. Once more in the air.'),
  umbrella: () => K('Hold <kbd>Space</kbd> while falling.', 'Keep holding <b>Jump</b> while falling.'),
  boots: () => 'Jump at iron and hold toward it to climb. Jump to kick off.',
  thimble: () => K('Press <kbd>S</kbd> or <kbd>↓</kbd> to shrink, again to grow.', 'Tap <b>Shrink</b>, and again to grow.'),
  musicbox: () => K('Stand by a sleeping toy and press <kbd>E</kbd>.', 'Stand by a sleeping toy and tap <b>♪</b>.'),
};
function handleEvents() {
  for (const e of game.ev) {
    switch (e.t) {
      case 'jump': sfx.jump(); break;
      case 'land': if (e.v > 4) sfx.land(e.v); break;
      case 'jab': sfx.jab(); break;
      case 'hit': sfx.hit(); break;
      case 'pop': sfx.pop(); break;
      case 'clang': sfx.clang(); break;
      case 'dash': sfx.dash(); break;
      case 'umbrella': sfx.umbrella(); break;
      case 'clank': sfx.clank(); break;
      case 'kick': sfx.kick(); break;
      case 'shrink': sfx.shrink(); break;
      case 'grow': sfx.grow(); break;
      case 'noroom': sfx.noroom(); toast('No room to grow here.', 1.4); break;
      case 'hurt': sfx.hurt(); break;
      case 'ouch': break;
      case 'die': sfx.die(); toast('Your spring has run down…', 2.2); break;
      case 'respawn': if (e.dead) toast('Wound back up at the last stand.', 2.2); save(); break;
      case 'medal': sfx.medal(); toast(`A tin medal. <b>${game.medals.size} of ${L.MEDALS.length}</b>`); save(); break;
      case 'spring': sfx.spring(); toast('A spare spring: one more turn of the key.'); save(); break;
      case 'rest': sfx.rest(); toast('Wound up.', 1.6); save(); break;
      case 'room': if (e.first) { sfx.room(); const r = L.ROOMS.find(q => q.id === e.id); banner(r.name, ROOMSUB[e.id]); save(); } break;
      case 'ability': sfx.ability(); showCard(e.id); save(); break;
      case 'wake': sfx.wake(); { const t = L.TOYS.find(q => q.id === e.id); toast(t.id === 'blocks' ? 'The blocks shuffle themselves into stairs.' : `${cap(t.name)} wakes and sets off for the parlour.`); } save(); break;
      case 'atdoor': { const n = game.doorToys.length; if (n < 4) toast(`${n} of 4 toys waiting at the parlour doors.`); } save(); break;
      case 'door': sfx.door(); if (e.id === 'parlourDoor') toast('The toys push the parlour doors open.', 3); if (e.id === 'backDoor') toast('You slide the bolt. The back door swings open.'); if (e.id === 'nurseryDoor') toast('The nursery door creaks open.'); save(); break;
      case 'flag': break;
      case 'boss': banner(e.name); break;
      case 'boing': sfx.boing(); break;
      case 'whoosh': sfx.whoosh(); break;
      case 'thud': sfx.thud(); break;
      case 'bosshit': sfx.bosshit(); break;
      case 'bossdie': sfx.bossdie(); break;
      case 'bossdown': save(); break;
      case 'mew': sfx.mew(); break;
      case 'hiss': sfx.hiss(); break;
      case 'yowl': sfx.yowl(); break;
      case 'swish': sfx.swish(); break;
      case 'roar': sfx.roar(); break;
      case 'crash': sfx.crash(); break;
      case 'spit': sfx.spit(); break;
      case 'ending': save(); endingSoon(); break;
    }
  }
  game.ev.length = 0;
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ---------- cards and screens
let cardId = null;
function showCard(id) {
  const a = L.ABILITY[id]; cardId = id;
  $('#cardVerb').textContent = a.verb; $('#cardName').textContent = a.name; $('#cardBlurb').textContent = a.blurb; $('#cardHow').innerHTML = HOW[id]();
  const c = $('#cardArt'), x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
  x.setTransform(110, 0, 0, 110, c.width / 2, c.height / 2 + 6); drawItem(x, id, 0.4);
  mode = 'card'; cardShownAt = performance.now(); $('#card').hidden = false; clearHeld();
  setTimeout(() => $('#cardOk').focus({ preventScroll: true }), 50);
}
function closeCard() { $('#card').hidden = true; mode = 'play'; document.activeElement?.blur?.(); clearHeld(); refreshCoach(); }
$('#cardOk').addEventListener('click', () => { if (performance.now() - cardShownAt > 300) closeCard(); });
function clearHeld() { for (const k in held) held[k] = false; presses = {}; }
let houseOpened = false;
function openHouse() { if (mode !== 'play') return; mode = 'house'; houseOpened = true; $('#houseBtn').classList.remove('ping'); $('#houseHint').hidden = false;
  $('#houseHint').textContent = touch ? 'Tap or pinch in to go back' : 'Tab or click to go back'; clearHeld(); sfx.page(); }
function closeHouse() { if (mode !== 'house') return; mode = 'play'; $('#houseHint').hidden = true; clearHeld(); }
function pause() { if (mode !== 'play') return; mode = 'pause'; $('#pause').hidden = false; clearHeld();
  $('#pauseInfo').textContent = `${game.medals.size} of ${L.MEDALS.length} medals · ${game.springs.size} of ${L.SPRINGS.length} spare springs · ${game.awake.size} of ${L.TOYS.length} toys awake`; }
function resume() { $('#pause').hidden = true; mode = 'play'; document.activeElement?.blur?.(); clearHeld(); }
$('#resumeBtn').addEventListener('click', resume);
$('#pauseBtn').addEventListener('click', () => { pause(); document.activeElement?.blur?.(); });
$('#pHouseBtn').addEventListener('click', () => { resume(); openHouse(); });
$('#houseBtn').addEventListener('click', (e) => { e.currentTarget.blur(); if (mode === 'house') closeHouse(); else openHouse(); });
$('#quitBtn').addEventListener('click', () => { save(); $('#pause').hidden = true; toTitle(); });
function toggleMute() { setMuted(!isMuted()); muteLabel(); }
function muteLabel() { $('#muteBtn').innerHTML = isMuted() ? '<span class="w">Muted</span><span class="i">Off</span>' : '<span class="w">Sound</span><span class="i">♪</span>'; }
$('#muteBtn').addEventListener('click', (e) => { unlock(); toggleMute(); e.currentTarget.blur(); });
muteLabel();

// the ending waits for play: a pause, the house view or a card in the way holds it back, and a save that never saw it shows it on Carry on
function endingSoon() {
  setTimeout(function go() {
    if (!game || !game.flags.vacuum || game.flags.ended || mode === 'title') return;
    if (mode === 'play') showEnding(); else setTimeout(go, 400);
  }, 1500);
}
function showEnding() {
  mode = 'ending'; $('#ending').hidden = false; clearHeld(); game.flags.ended = true; save();
  const mins = Math.max(1, Math.round(game.time / 60));
  $('#stats').innerHTML = `Wound down and up again in <b>${mins} minute${mins === 1 ? '' : 's'}</b><br>Medals: <b>${game.medals.size} of ${L.MEDALS.length}</b> &middot; Spare springs: <b>${game.springs.size} of ${L.SPRINGS.length}</b><br>Ran down <b>${game.deaths === 0 ? 'never' : game.deaths === 1 ? 'once' : game.deaths + ' times'}</b>`;
  const best = ls.get(KEY.best, null);
  if (!best || game.medals.size > best.medals || (game.medals.size === best.medals && game.time < best.time)) ls.set(KEY.best, { medals: game.medals.size, time: game.time });
  sfx.ending();
  setTimeout(() => $('#keepBtn').focus({ preventScroll: true }), 50);
}
$('#keepBtn').addEventListener('click', () => { $('#ending').hidden = true; mode = 'play'; document.activeElement?.blur?.(); clearHeld(); toast(game.medals.size < L.MEDALS.length ? 'There are still medals hidden about the house.' : 'Every medal found. A perfect soldier.'); });
$('#endTitleBtn').addEventListener('click', () => { $('#ending').hidden = true; toTitle(); });

function save() { if (!game || DEMO || mode === 'title') return; ls.set(KEY.save, game.save()); }
addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); if (mode === 'play') pause(); } });

let resetArmed = 0;
function toTitle() {
  mode = 'title';
  for (const id of ['hud', 'tr', 'coach', 'note', 'boss']) $('#' + id).hidden = true;
  document.body.classList.remove('inplay');
  const s = ls.get(KEY.save);
  $('#contBtn').hidden = !s; $('#resetBtn').hidden = !s; $('#newBtn').hidden = !!s;
  $('#resetBtn').textContent = 'Start over'; resetArmed = 0;
  const best = ls.get(KEY.best);
  $('#best').textContent = best ? `Best so far: every toy awake with ${best.medals} of ${L.MEDALS.length} medals.` : '';
  $('#title').hidden = false;
  game = new Game(s || undefined);
  if (!s) game.visited = new Set(L.ROOMS.map(r => r.id)); // the title shows the house lit up
  if (!art.bake) resize();
  setTimeout(() => ($('#contBtn').hidden ? $('#newBtn') : $('#contBtn')).focus({ preventScroll: true }), 50);
}
function start(fresh) {
  if (fresh) { ls.del(KEY.save); coachDone = new Set(); ls.del(KEY.coach); }
  const s = fresh ? null : ls.get(KEY.save);
  game = new Game(s || undefined);
  $('#title').hidden = true; mode = 'play';
  for (const id of ['hud', 'tr']) $('#' + id).hidden = false;
  document.body.classList.add('inplay');
  document.activeElement?.blur?.(); clearHeld();
  cam.ov = 1; snapCam(); hudKey = '';
  const r = game.roomAt(game.p.x, game.p.y - 0.7);
  if (r) { game.room = r; if (!game.visited.has(r.id)) { game.visited.add(r.id); } banner(r.name, ROOMSUB[r.id]); }
  unlock();
  if (game.flags.vacuum && !game.flags.ended) endingSoon();
}
$('#newBtn').addEventListener('click', () => start(true));
$('#contBtn').addEventListener('click', () => start(false));
$('#resetBtn').addEventListener('click', (e) => {
  if (!resetArmed) { resetArmed = 1; e.currentTarget.textContent = 'Really start over? Tap again'; return; }
  start(true);
});

// ---------- camera
const BOSSCAM = { jack: { x: 57.5, y: 20.5, w: 18 }, cat: { x: 84.5, y: 28, w: 24 }, vacuum: { x: 11.5, y: 31, w: 22 } };
function camTarget() {
  const p = game.p; let s = closeScale();
  const bc = game.boss && BOSSCAM[game.boss.kind];
  if (bc) {
    s = Math.max(s * 0.62, Math.min(s, vw / bc.w));
    const w = vw / s, h = vh / s;
    let tx = Math.abs(bc.x - p.x) < w / 2 - 2 ? bc.x : p.x + Math.sign(bc.x - p.x) * (w / 2 - 2);
    let ty = Math.min(bc.y, p.y - 2), lowest = bc.y + (touch && portrait ? 4 : 1.5);
    ty = Math.min(Math.max(ty, p.y - h / 2 + 2), lowest);
    return { x: Math.max(w / 2, Math.min(L.W - w / 2, tx)), y: ty, s };
  }
  const w = vw / s, h = vh / s;
  let tx = p.x + p.face * 1.2, ty = p.y - p.h / 2 - (touch && portrait ? -h * 0.1 : h * 0.09);
  tx = Math.max(w / 2, Math.min(L.W - w / 2, tx));
  const bottom = touch && portrait ? L.H + 4 : 50;
  ty = Math.max(h / 2 - 1, Math.min(bottom - h / 2, ty));
  if (w > L.W) tx = L.W / 2;
  return { x: tx, y: ty, s };
}
function houseTarget() { return { x: L.W / 2, y: L.H / 2 - 1 + (vh < 500 ? 0 : 0), s: houseScale() }; }
function snapCam() { const t = camTarget(); cam.x = cam.nx = t.x; cam.y = cam.ny = t.y; cam.s = cam.ns = t.s; cam.ov = 0; }
function updateCam(dt) {
  const near = camTarget(), far = houseTarget();
  const wantOv = (mode === 'house' || mode === 'title') ? 1 : 0;
  cam.ov += (wantOv - cam.ov) * Math.min(1, dt * 5);
  if (Math.abs(cam.ov - wantOv) < 0.002) cam.ov = wantOv;
  const k = Math.min(1, dt * 7);
  cam.nx = (cam.nx ?? near.x) + (near.x - (cam.nx ?? near.x)) * k;
  cam.ny = (cam.ny ?? near.y) + (near.y - (cam.ny ?? near.y)) * Math.min(1, dt * 5);
  if (Math.hypot(cam.nx - near.x, cam.ny - near.y) > 30) { cam.nx = near.x; cam.ny = near.y; }
  cam.ns = (cam.ns ?? near.s) + (near.s - (cam.ns ?? near.s)) * Math.min(1, dt * 3);
  near.s = cam.ns;
  const e = cam.ov * cam.ov * (3 - 2 * cam.ov);
  // interpolate in log scale so the zoom feels even
  cam.s = Math.exp(Math.log(near.s) * (1 - e) + Math.log(far.s) * e);
  cam.x = cam.nx + (far.x - cam.nx) * e; cam.y = cam.ny + (far.y - cam.ny) * e;
}

// ---------- the loop
let last = 0, hold = false;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - (last || now)) / 1000)); last = now;
  if (!game) return;
  if (!hold) step(dt);
  draw(now / 1000);
}
function step(dt) {
  if (mode === 'play') {
    const n = Math.ceil(dt / (1 / 60) - 0.01) || 1;
    const inp = takeInput();
    for (let i = 0; i < n; i++) { game.tick(dt / n, i === 0 ? inp : Object.assign({}, inp, { jumpPressed: false, jab: false, dash: false, shrink: false, use: false })); }
    handleEvents();
    updateCoach(dt);
    if (game.visited.size >= 4 && !houseOpened && !coachDone.has('house')) $('#houseBtn').classList.add('ping');
  } else {
    $('#coach').hidden = true; coachCur = null;
  }
  if (mode === 'title' && DEMO) {
    game.tick(dt, demoInput(dt)); game.ev.length = 0;
  }
  document.body.classList.toggle('playing', mode === 'play');
  if (game && (mode === 'play' || mode === 'house' || mode === 'pause' || mode === 'card' || mode === 'ending')) updateHud();
  updateCam(dt);
  soundUpdate(dt, { boss: !!(game && game.boss && mode === 'play') });
}
function draw(t) {
  const W = vw, H = vh;
  const x0 = cam.x - W / cam.s / 2, y0 = cam.y - H / cam.s / 2;
  art.frame(ctx, game, { s: cam.s, x0, y0, vw: W, vh: H, dpr }, t, { overview: cam.ov > 0.5 });
  if (cam.ov > 0.02) drawHouseLabels(x0, y0);
  // vignette
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.35, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.75);
  g.addColorStop(0, 'rgba(10,8,20,0)'); g.addColorStop(1, 'rgba(10,8,20,.45)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
}
function drawHouseLabels(x0, y0) {
  if (mode === 'title') return;
  const a = Math.min(1, (cam.ov - 0.3) / 0.5); if (a <= 0) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = a;
  ctx.font = `${Math.max(12, Math.min(18, cam.s * 0.9))}px 'IM Fell English SC', Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const r of L.ROOMS) {
    if (r.id === 'roof') continue;
    const cx = ((r.x0 + r.x1 + 1) / 2 - x0) * cam.s, cy = ((r.id === 'attic' ? 11.2 : r.id === 'garden' ? 17 : r.y0 + 1.3) - y0) * cam.s;
    const seen = game.visited.has(r.id);
    const txt = seen ? r.name.replace('The ', '') : '?';
    const w = ctx.measureText(txt).width + 14;
    ctx.fillStyle = seen ? 'rgba(239,227,194,.9)' : 'rgba(60,55,70,.85)'; ctx.fillRect(cx - w / 2, cy - 11, w, 22);
    ctx.fillStyle = seen ? '#2a1b14' : '#cfc6b0'; ctx.fillText(txt, cx, cy + 1);
  }
  // you are here
  const px = (game.p.x - x0) * cam.s, py = (game.p.y - game.p.h / 2 - y0) * cam.s, pr = 9 + Math.sin(performance.now() / 180) * 3;
  ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
}

// ---------- ?demo: the card picture. A fight in the nursery, the house lit.
let demoT = 0;
function demoInput(dt) {
  demoT += dt;
  return { left: false, right: demoT > 0.2 && demoT < 0.5, jumpHeld: demoT > 0.6, jumpPressed: demoT > 0.6 && demoT < 0.62, jab: false, dash: false, shrink: false, use: false };
}
function setupDemo() {
  game = new Game({ has: ['key', 'umbrella', 'boots'], medals: ['m1', 'm4'], visited: L.ROOMS.map(r => r.id), bench: 'bedroom', flags: { } });
  game.p.x = 51.5; game.p.y = 25; game.p.face = 1;
  game.room = game.roomAt(51.5, 24);
  game.checkBossStart();
  // skip the intro: Jack is mid-lunge
  if (game.boss) { game.boss.state = 'aim'; game.boss.t = 0.5; }
  game.ev.length = 0;
  mode = 'title';
  $('#title').hidden = true;
  resize();
  cam.ov = 0;
  const s = Math.min(vw, vh) / 17;
  cam.s = s;
  const fixed = { x: 52, y: 22.5, s };
  // hold the camera on the nursery and landing
  camTarget = () => fixed; // eslint-disable-line no-func-assign
  cam.nx = fixed.x; cam.ny = fixed.y;
  hudKey = ''; updateHud();
}

// ---------- boot
resize();
if (DEMO) setupDemo(); else toTitle();
resize();
requestAnimationFrame(frame);
window.toyboxReady?.();

if (DEBUG) {
  window.dh = {
    get game() { return game; }, get mode() { return mode; }, cam, art,
    hold(v = true) { hold = v; },
    ff(sec, inp = {}) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) game.tick(1 / 60, Object.assign({ left: false, right: false, jumpHeld: false, jumpPressed: false, jab: false, dash: false, shrink: false, use: false }, inp)); handleEvents(); updateHud(); updateCam(sec); },
    step(dt = 1 / 60) { step(dt); draw(performance.now() / 1000); },
    give(...ids) { ids.forEach(i => game.has.add(i)); },
    tp(x, y) { game.p.x = x; game.p.y = y; game.p.vx = game.p.vy = 0; snapCam(); },
    start, showCard, openHouse, closeHouse,
  };
}
