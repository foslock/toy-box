import { Game } from './game.js';
import { Renderer } from './render.js';
import { AUTHORS, TEMPLATES, WORDS } from './level.js';
import { sfx, unlock, setMuted, isMuted, setDepth } from './sound.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
const KEY = { save: 'tryfinger.save', msgs: 'tryfinger.msgs', stain: 'tryfinger.stain', coach: 'tryfinger.coach', best: 'tryfinger.best' };
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

const cv = $('#cv');
const R = new Renderer(cv);
let game = null;
let mode = 'title'; // title | play | pause | book | fallen | end
let touch = matchMedia('(pointer: coarse)').matches;

function resize() {
  const w = innerWidth, h = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
  const portrait = h > w * 1.1;
  document.body.classList.toggle('portrait', portrait);
  R.resize(w, h, dpr, portrait);
}
addEventListener('resize', resize);
function setTouch(on) { touch = on; document.body.classList.toggle('touch', on); }
setTouch(touch);

// ---------- input
const held = { left: false, right: false, down: false, jump: false };
const tHeld = { left: false, right: false, down: false, jump: false };
let presses = { jump: false, attack: false, roll: false, heal: false };
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump',
  KeyJ: 'attack', KeyX: 'attack', KeyK: 'roll', ShiftLeft: 'roll', ShiftRight: 'roll', KeyC: 'roll', KeyL: 'roll', KeyH: 'heal', KeyF: 'heal', KeyQ: 'heal',
};
addEventListener('keydown', (e) => {
  unlock();
  if (e.code === 'Tab') e.preventDefault();
  if (e.repeat && !KEYMAP[e.code]) return;
  if (mode === 'fallen') { if (e.code === 'Enter' && composeReady()) finishCompose(true); if (e.code === 'Escape' && composeReady()) finishCompose(false); return; }
  if (mode === 'book') { if (['Escape', 'KeyN', 'Tab'].includes(e.code)) closeBook(); return; }
  if (mode === 'pause') { if (e.code === 'Escape' || e.code === 'KeyP') resume(); return; }
  if (mode === 'title') { if (e.code === 'Enter') ($('#contBtn').hidden ? $('#newBtn') : $('#contBtn')).click(); return; }
  if (mode === 'end') { if (e.code === 'Enter') $('#againBtn').click(); return; }
  if (mode !== 'play') return;
  if (touch && !e.repeat) setTouch(false);
  if (e.code === 'Escape' || e.code === 'KeyP') { pause(); return; }
  if (e.code === 'KeyN' || e.code === 'Tab') { openBook(); return; }
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault();
  if (k in held) { if (!held[k] && k === 'jump') presses.jump = true; held[k] = true; }
  else if (!e.repeat) presses[k] = true;
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k in held) held[k] = false; });
addEventListener('blur', () => { for (const k in held) held[k] = false; for (const k in tHeld) tHeld[k] = false; });
cv.addEventListener('mousedown', (e) => { unlock(); if (mode === 'play' && e.button === 0 && !touch) presses.attack = true; }); // on phones a stray tap on the scene is not a swing
cv.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('touchstart', () => { if (!touch) setTouch(true); unlock(); }, { passive: true });

// touch pad: slide a thumb across it
const pad = $('#pad'); const padPts = new Map();
function padUpdate() {
  let l = false, r = false;
  const rc = pad.getBoundingClientRect(), mid = rc.left + rc.width / 2;
  for (const x of padPts.values()) { if (x < mid - 6) l = true; else if (x > mid + 6) r = true; }
  tHeld.left = l; tHeld.right = r;
  pad.querySelector('.l').classList.toggle('on', l); pad.querySelector('.r').classList.toggle('on', r);
}
pad.addEventListener('pointerdown', (e) => { e.preventDefault(); pad.setPointerCapture(e.pointerId); padPts.set(e.pointerId, e.clientX); padUpdate(); });
pad.addEventListener('pointermove', (e) => { if (padPts.has(e.pointerId)) { padPts.set(e.pointerId, e.clientX); padUpdate(); } });
for (const ev of ['pointerup', 'pointercancel']) pad.addEventListener(ev, (e) => { padPts.delete(e.pointerId); padUpdate(); });
function holdBtn(el, onDown, onUp) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); unlock(); el.setPointerCapture(e.pointerId); el.classList.add('on'); onDown(); });
  for (const ev of ['pointerup', 'pointercancel']) el.addEventListener(ev, () => { el.classList.remove('on'); onUp && onUp(); });
}
holdBtn($('#padDown'), () => { tHeld.down = true; }, () => { tHeld.down = false; });
holdBtn($('#tJump'), () => { presses.jump = true; tHeld.jump = true; }, () => { tHeld.jump = false; });
holdBtn($('#tAtk'), () => { presses.attack = true; });
holdBtn($('#tRoll'), () => { presses.roll = true; });
holdBtn($('#tHeal'), () => { presses.heal = true; });

function takeInput() {
  const inp = {
    left: held.left || tHeld.left, right: held.right || tHeld.right, down: held.down || tHeld.down, jumpHeld: held.jump || tHeld.jump,
    jumpPressed: presses.jump, attackPressed: presses.attack, rollPressed: presses.roll, healPressed: presses.heal,
  };
  presses = { jump: false, attack: false, roll: false, heal: false };
  return inp;
}

// ---------- the tutorial coach: one line at a time, each teaches by doing
const K = (k, t) => touch ? t : k;
let coachDone = new Set(ls.get(KEY.coach, []));
let coachT = {};
const COACH = [
  { id: 'move', when: (g) => true, done: (g) => g.player.x > g.startPos.x + 2.5,
    text: () => K('Walk with <em>A</em> and <em>D</em>, or the arrow keys.', 'Hold <em>◀ ▶</em> on the left to walk.') },
  { id: 'read', when: (g) => g.player.x > 6 && g.player.x < 14, done: (g) => g.msgs.find(m => m.id === 'a').read && coachT.read > 3,
    text: () => 'Glowing script is a <em>message</em> another player left. Stand on it to read it. It is signed.' },
  { id: 'jump', when: (g) => g.player.x > 8, done: (g) => g.player.x > 12.5 && g.player.y <= 10.05,
    text: () => K('Jump with <em>Space</em>.', 'Tap <em>Jump</em>.') },
  { id: 'fight', when: (g) => g.player.x > 14, done: (g) => g.player.x > 25.5 || !g.enemies.some(e => e.tag === 'hollow1' && e.state !== 'dead'),
    text: () => K('Strike with <em>J</em> or a click. <em>K</em> rolls you through its swing, untouchable.', '<em>Strike</em> it. <em>Roll</em> through its swing and it cannot touch you.') },
  { id: 'rest', when: (g) => g.player.x > 24, done: (g) => g.candles[0].lit,
    text: () => 'Walk into the candle to rest. It heals you, refills your flasks, and is where you rise if you fall.' },
  { id: 'heal', when: (g) => g.candles[0].lit, done: () => coachT.heal > 5,
    text: () => K('Hurt? <em>H</em> drinks a flask. Candles refill them.', 'Hurt? <em>Flask</em> drinks one. Candles refill them.') },
  { id: 'liar', when: (g) => g.msgs.find(m => m.id === 'e').read, done: () => coachT.liar > 9 || bookOpened,
    text: () => K('Messages can lie. Every writer has a habit, and your <em>Notebook</em> (<em>N</em>) remembers who said what.', 'Messages can lie. Every writer has a habit, and your <em>Notebook</em> (top right) remembers who said what.') },
  { id: 'stain', when: (g) => g.player.x > 34 && g.player.x < 40 && g.player.y < 11, done: (g) => g.ghostStains[0].seen || coachT.stain > 8,
    text: () => 'A red stain marks where someone died. Stand on it to watch how.' },
  { id: 'drop', when: (g) => g.msgs.find(m => m.id === 'c').read && g.player.y < 11, done: (g) => g.player.y > 12,
    text: () => K('Hold <em>S</em> or <em>↓</em> to drop through planks.', 'Hold <em>▼</em> to drop through planks.') },
  { id: 'wall', when: (g) => g.player.x > 104 && g.player.x < 112 && !g.walls, done: (g) => g.walls,
    text: () => 'Some walls are not what they seem. Strike them.' },
];
let coachCur = null;
function updateCoach(dt) {
  const g = game; let show = null;
  for (const c of COACH) {
    if (coachDone.has(c.id)) continue;
    if (c.id !== 'wall' && g.player.x > 66) continue;
    if (c.when(g)) { coachT[c.id] = (coachT[c.id] || 0) + dt; if (c.done(g)) { coachDone.add(c.id); ls.set(KEY.coach, [...coachDone]); continue; } show = c; break; }
  }
  const el = $('#coach');
  if (!show || DEMO || g.fight || mode !== 'play') { el.hidden = true; coachCur = null; return; }
  if (coachCur !== show.id || el.dataset.touch !== String(touch)) { el.innerHTML = show.text(); coachCur = show.id; el.dataset.touch = String(touch); }
  el.hidden = false;
}

// ---------- UI
const fmtTime = (s) => { s = Math.floor(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const authorName = (a) => AUTHORS[a]?.name || a;
function apprNow(m) {
  if (m.mine) return Math.min(99, Math.floor((Date.now() - m.born) / 45000));
  return m.appr;
}
let cardKey = '';
function updateCard() {
  const el = $('#card');
  const m = game.bossMsg || game.nearMsg;
  if (!m || mode !== 'play') { el.hidden = true; cardKey = ''; return; }
  const key = (m.id || 'boss') + m.text + (m.verdict ? 'v' : '') + apprNow(m);
  if (key !== cardKey) {
    cardKey = key;
    el.querySelector('.txt').textContent = m.text;
    let stamp = '';
    if (m.verdict && !m.mine && !m.boss) stamp = m.truth ? '<span class="stamp true">TRUE</span>' : '<span class="stamp lie">LIE</span>';
    const by = m.mine ? 'You, on an earlier attempt' : authorName(m.author);
    el.querySelector('.by').innerHTML = `— <b>${esc(by)}</b> · Appraised ${apprNow(m).toLocaleString()}${stamp}`;
    if (!game.bossMsg && !m.mine && !m.boss) { sfx.read(); }
  }
  el.classList.toggle('boss', !!game.bossMsg);
  el.hidden = false;
}
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let hpLag = 100;
function updateHud() {
  const p = game.player;
  $('#hpb .v').style.width = Math.max(0, p.hp) + '%';
  hpLag = Math.max(p.hp, hpLag - 0.5); if (p.hp > hpLag) hpLag = p.hp;
  $('#hpb .lag').style.width = Math.max(0, hpLag) + '%';
  $('#stb b').style.width = Math.max(0, p.stam) + '%';
  const fk = p.flasks + '/' + game.flasksMax;
  const fl = $('#flasks');
  if (fl.dataset.k !== fk) { fl.dataset.k = fk; fl.innerHTML = Array.from({ length: game.flasksMax }, (_, i) => `<i class="${i < p.flasks ? '' : 'used'}"></i>`).join('') + (game.whet ? '<span style="margin-left:8px">whetted blade</span>' : ''); }
  const b = $('#boss');
  const f = game.fight;
  if (f && f.state !== 'dead') { b.hidden = false; b.querySelector('span').textContent = f.name; b.querySelector('b').style.width = Math.max(0, f.hp / f.max * 100) + '%'; }
  else b.hidden = true;
}
function toast(html) {
  const t = document.createElement('div'); t.className = 'toast wash'; t.innerHTML = html;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 5100);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
}
function banner(name, sub) {
  const b = $('#banner'); b.innerHTML = esc(name) + (sub ? `<small>${esc(sub)}</small>` : '');
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

// ---------- notebook
let bookOpened = false;
function renderBook(el, showRules) {
  const by = {};
  for (const m of game.msgs) if (m.read && !m.mine) (by[m.author] ||= []).push(m);
  const order = ['ilse', 'ansel', 'pell', 'guts', 'fop', 'lefty', 'appr'];
  const authors = order.filter(a => by[a] || showRules);
  if (!authors.length) { el.innerHTML = '<p class="lead">Nothing yet. Read the glowing script on the floor.</p>'; return; }
  el.innerHTML = authors.map(a => {
    const ms = by[a] || [];
    const t = ms.filter(m => m.verdict && m.truth).length, l = ms.filter(m => m.verdict && !m.truth).length, u = ms.filter(m => !m.verdict).length;
    const tally = [t && `${t} true`, l && `${l} ${l > 1 ? 'lies' : 'lie'}`, u && `${u} unproven`].filter(Boolean).join(' · ') || 'never read';
    const items = ms.map(m => `<li><q>${esc(m.text)}</q>${m.verdict ? (m.truth ? '<span class="stamp true">TRUE</span>' : '<span class="stamp lie">LIE</span>') + `<i>${esc(m.note)}</i>` : '<span class="stamp unk">?</span>'}</li>`).join('');
    return `<div class="author"><h4>${esc(authorName(a))}<small>${tally}</small></h4>${showRules ? `<p class="rule2">${esc(AUTHORS[a].rule)}</p>` : ''}<ul>${items}</ul></div>`;
  }).join('');
}
function openBook() {
  if (mode !== 'play' && mode !== 'pause') return;
  bookOpened = true; $('#bookBtn').classList.remove('ping');
  renderBook($('#authors'), false);
  $('#pause').hidden = true; $('#book').hidden = false; $('#coach').hidden = true; mode = 'book'; sfx.ui();
}
function closeBook() { $('#book').hidden = true; mode = 'play'; last = performance.now(); }

function pause() { mode = 'pause'; $('#pause').hidden = false; $('#coach').hidden = true; $('#soundBtn').textContent = 'Sound: ' + (isMuted() ? 'off' : 'on'); }
function resume() { $('#pause').hidden = true; mode = 'play'; last = performance.now(); }
// blur, or Enter would press the still-focused button again once you're back in play
$('#pauseBtn').onclick = () => { unlock(); $('#pauseBtn').blur(); if (mode === 'play') pause(); };
$('#bookBtn').onclick = () => { unlock(); $('#bookBtn').blur(); openBook(); };
$('#resumeBtn').onclick = resume;
$('#pBookBtn').onclick = openBook;
$('#closeBook').onclick = closeBook;
$('#soundBtn').onclick = () => { setMuted(!isMuted()); $('#soundBtn').textContent = 'Sound: ' + (isMuted() ? 'off' : 'on'); };
$('#quitBtn').onclick = () => { save(); toTitle(); };

// ---------- falling, and the message you leave
let tplI = -1, wordI = -1, composeAt = 0;
const composeReady = () => performance.now() - composeAt > 600 && $('#compose').classList.contains('on');
function buildCompose() {
  $('#tpl').innerHTML = TEMPLATES.map((t, i) => `<button class="chip" data-i="${i}">${esc(t)}</button>`).join('');
  $('#words').innerHTML = WORDS.map((w, i) => `<button class="chip" data-i="${i}">${esc(w)}</button>`).join('');
  $('#tpl').onclick = (e) => { const b = e.target.closest('.chip'); if (!b) return; tplI = +b.dataset.i; sfx.ui(); paintCompose(); };
  $('#words').onclick = (e) => { const b = e.target.closest('.chip'); if (!b) return; wordI = +b.dataset.i; sfx.ui(); paintCompose(); };
}
function composeText() { if (tplI < 0) return ''; return TEMPLATES[tplI].replace('****', wordI >= 0 ? WORDS[wordI] : '****'); }
function paintCompose() {
  [...$('#tpl').children].forEach((b, i) => b.classList.toggle('on', i === tplI));
  [...$('#words').children].forEach((b, i) => b.classList.toggle('on', i === wordI));
  $('#preview').textContent = composeText() || ' ';
  const ok = tplI >= 0 && wordI >= 0;
  $('#writeBtn').disabled = !ok; $('#writeBtn').style.opacity = ok ? 1 : 0.4;
}
buildCompose();
const CAUSES = { abyss: 'Swallowed by the dark below.', spikes: 'Impaled at the bottom of a drop.', crushed: 'Crushed flat.', slain: 'Cut down.' };
function showFallen(cause) {
  mode = 'fallen'; $('#coach').hidden = true; $('#card').hidden = true;
  $('#fallen').hidden = false; $('#cause').textContent = CAUSES[cause] || '';
  $('#compose').classList.remove('on');
  tplI = -1; wordI = -1; paintCompose();
  setTimeout(() => { if (mode === 'fallen') { $('#compose').classList.add('on'); composeAt = performance.now(); } }, 1100);
}
function finishCompose(write) {
  if (write && tplI >= 0 && wordI >= 0 && game.stain) {
    const pm = { x: game.stain.x, y: game.stain.y, text: composeText(), born: Date.now() };
    const all = ls.get(KEY.msgs, []); all.push(pm); while (all.length > 16) all.shift(); ls.set(KEY.msgs, all);
    game.addPlayerMsg(pm);
  }
  $('#fallen').hidden = true; mode = 'play';
  game.respawn(); R.cam.x = game.player.x; R.cam.y = game.player.y - 2; snap = true;
  ls.set(KEY.stain, game.stain);
  save();
  last = performance.now();
}
$('#writeBtn').onclick = () => composeReady() && finishCompose(true);
$('#riseBtn').onclick = () => composeReady() && finishCompose(false);

// ---------- events → sound, ink and words
function handleEvents() {
  for (const e of game.events) {
    switch (e.type) {
      case 'swing': sfx.swing(); break;
      case 'eswing': sfx.eswing(); break;
      case 'hit': sfx.hit(e.boss); R.burst(e.x, e.y, e.boss ? 10 : 7, 'ink'); R.burst(e.x, e.y, 3, 'gold'); hitstop = e.boss ? 0.05 : 0.035; break;
      case 'kill': R.burst(e.e.x, e.e.y - 0.6, 14, 'ink'); break;
      case 'hurt': sfx.hurt(); R.burst(e.x, e.y, 9, 'blood'); R.shake = Math.max(R.shake, 0.6); hitstop = 0.06; break;
      case 'clink': sfx.clink(); R.burst(e.x, e.y, 4, 'gold'); break;
      case 'jump': sfx.jump(); R.dust(e.x, e.y, 3); break;
      case 'land': sfx.land(e.hard); R.dust(e.x, e.y, e.hard ? 8 : 4); break;
      case 'roll': sfx.roll(); R.dust(e.x, e.y, 4); break;
      case 'drink': sfx.drink(); break;
      case 'healed': sfx.healed(); R.burst(e.x, e.y - 0.8, 8, 'gold'); break;
      case 'empty': sfx.empty(); toast('No flasks left. <i>Candles refill them.</i>'); break;
      case 'dodge': sfx.dodge(); break;
      case 'died': sfx.died(); R.shake = 0.8; dieT = 1.4; dieCause = e.cause; break;
      case 'rest':
        sfx.rest();
        if (e.newOne) banner(e.c.name, 'Candle lit');
        save(); break;
      case 'readFirst': break;
      case 'verdict': {
        const m = e.m; sfx.verdict(!m.truth);
        toast(`<q>${esc(m.text)}</q> — ${esc(authorName(m.author))} <span class="stamp ${m.truth ? 'true' : 'lie'}">${m.truth ? 'TRUE' : 'LIE'}</span><br><i>${esc(m.note)}</i>`);
        if (!bookOpened) $('#bookBtn').classList.add('ping');
        cardKey = ''; save(); break;
      }
      case 'chest': sfx.chest(); R.burst(e.c.x, e.c.y - 0.5, 12, 'gold');
        toast(e.c.give === 'whet' ? 'A <q>whetstone</q>. Your blade bites deeper.' : 'A <q>flask</q>. You can carry one more.'); save(); break;
      case 'mimic': sfx.mimic(); R.shake = 0.4; break;
      case 'bite': sfx.bite(); break;
      case 'hop': break;
      case 'wall': sfx.wall(); R.burst(e.x, e.y - 1, 20, 'dust'); R.invalidate(); save(); break;
      case 'crack': sfx.crack(); break;
      case 'collapse': sfx.collapse(); R.shake = 0.5; R.invalidate(); for (let i = 0; i < 10; i++) R.dust(161 + i, 27.5, 3); save(); break;
      case 'bridge': sfx.bridge(); save(); break;
      case 'caw': sfx.caw(); break;
      case 'growl': sfx.growl(); break;
      case 'windup': sfx.windup(); break;
      case 'ambush': sfx.growl(); break;
      case 'ghost': sfx.ghost(); break;
      case 'fight': sfx.fight(); banner(e.e.name); break;
      case 'tiles': R.invalidate(); break;
      case 'wwindup': sfx.wwindup(); break;
      case 'wstrike': sfx.eswing(); break;
      case 'wland': sfx.slam(); R.dust(e.x, e.y, 12); break;
      case 'shake': R.shake = Math.max(R.shake, e.a); break;
      case 'write': sfx.write(); break;
      case 'written': sfx.read(); break;
      case 'fall': sfx.windup(); break;
      case 'slam': sfx.slam(); for (let x = e.z0; x < e.z1; x += 1.5) R.dust(x, e.y, 2); break;
      case 'sweep': sfx.sweep(); break;
      case 'bossDie': sfx.bossDie(); banner(e.e.boss === 'hand' ? 'The ink runs dry' : 'Warden silenced', e.e.boss === 'hand' ? 'Walk into the light' : ''); R.burst(e.e.x, e.e.y - 1.5, 40, 'ink'); save(); break;
      case 'win': sfx.win(); setTimeout(showEnd, 1600); break;
      case 'wrote': sfx.wrote(); break;
      case 'respawn': break;
    }
  }
  game.events.length = 0;
}

// ---------- persistence
function save() { if (!game || DEMO) return; ls.set(KEY.save, game.serialize()); }
function newGame(fromSave) {
  const s = fromSave ? ls.get(KEY.save) : null;
  if (!fromSave) ls.del(KEY.save);
  game = new Game(s, ls.get(KEY.msgs, []), ls.get(KEY.stain));
  if (!fromSave) { game.stain = null; ls.del(KEY.stain); coachDone = new Set(); ls.set(KEY.coach, []); }
  coachT = {}; bookOpened = !fromSave ? false : bookOpened;
  snap = true; hpLag = 100; dieT = 0; hitstop = 0; // a death left pending by quitting mid-fall must not follow you into the next run
}
function toTitle() {
  mode = 'title';
  for (const s of ['#pause', '#book', '#fallen', '#end']) $(s).hidden = true;
  $('#title').hidden = false; $('#hud').hidden = true; $('#tr').hidden = true; $('#touch').hidden = true; $('#coach').hidden = true; $('#boss').hidden = true;
  const s = ls.get(KEY.save);
  $('#contBtn').hidden = !(s && !s.won);
  const mine = ls.get(KEY.msgs, []).length;
  $('#eraseBtn').hidden = !mine; $('#eraseBtn').textContent = `Erase the ${mine} message${mine === 1 ? '' : 's'} you left`;
  const best = ls.get(KEY.best);
  $('#rec').textContent = best ? `Best descent: ${fmtTime(best.time)} with ${best.deaths} death${best.deaths === 1 ? '' : 's'}.` : '';
  if (!game) { game = new Game(null, ls.get(KEY.msgs, []), null); snap = true; }
}
function startPlay() {
  unlock();
  $('#title').hidden = true; $('#hud').hidden = false; $('#tr').hidden = false; $('#touch').hidden = false;
  mode = 'play'; last = performance.now();
}
$('#newBtn').onclick = () => { newGame(false); startPlay(); };
$('#contBtn').onclick = () => { newGame(true); startPlay(); };
$('#eraseBtn').onclick = () => { ls.del(KEY.msgs); game.msgs = game.msgs.filter(m => !m.mine); toTitle(); };
$('#againBtn').onclick = () => { newGame(false); $('#end').hidden = true; startPlay(); };

function showEnd() {
  mode = 'end';
  const lies = game.msgs.filter(m => !m.mine && m.read && m.verdict && !m.truth).length;
  const mine = game.msgs.filter(m => m.mine).length;
  $('#endStats').innerHTML = `Down in <b>${fmtTime(game.time)}</b> · <b>${game.deaths}</b> death${game.deaths === 1 ? '' : 's'} · <b>${lies}</b> lie${lies === 1 ? '' : 's'} caught · <b>${mine}</b> message${mine === 1 ? '' : 's'} of your own`;
  renderBook($('#endRules'), true);
  const best = ls.get(KEY.best);
  if (!best || game.time < best.time) ls.set(KEY.best, { time: game.time, deaths: game.deaths });
  save();
  $('#end').hidden = false;
}

// ---------- loop
let last = performance.now(), acc = 0, snap = true, hitstop = 0, dieT = 0, dieCause = '';
const STEP = 1 / 120;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!game) return;
  if (mode === 'play' || DEMO || mode === 'title') {
    if (hitstop > 0) { hitstop -= dt; dt *= 0.15; }
    acc += dt;
    while (acc >= STEP) {
      acc -= STEP;
      const inp = mode === 'play' ? takeInput() : {};
      game.update(STEP, inp);
      if (mode === 'title' && game.player.state === 'dead') game.respawn();
    }
    if (DEMO) { game.player.hp = 100; for (const gs of game.ghostStains) if (gs.play < 0 && gs.i === 0) gs.play = 0; }
    if (mode !== 'title' || DEMO) handleEvents(); else game.events.length = 0;
    if (mode === 'play') {
      updateCoach(dt); updateHud();
      if (dieT > 0) { dieT -= dt; if (dieT <= 0) showFallen(dieCause); }
      setDepth(Math.min(1, game.player.y / 40), !!game.fight);
    }
  }
  document.body.classList.toggle('inplay', mode === 'play');
  updateCard();
  R.draw(game, mode === 'play' || mode === 'title' || DEMO ? dt : 0, { snap });
  snap = false;
}

resize();
if (DEMO) {
  newGame(false);
  game.player.x = 38.4; game.player.y = 10; game.player.face = 1;
  game.msgs.find(m => m.id === 'e').read = true;
  game.addPlayerMsg({ x: 30.3, y: 10, text: 'Try hole', born: Date.now() - 400000 }, true);
  game.candles[0].lit = true;
  game.enemies.find(e => e.kind === 'crow')?.state;
  $('#title').hidden = true; $('#hud').hidden = false; $('#tr').hidden = false;
  mode = 'play';
  // a still player: don't take input in demo
  takeInput = () => ({});
} else {
  toTitle();
}
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && !DEMO) pause(); });
requestAnimationFrame(frame);
window.__tf = { get game() { return game; }, R, press: (k) => { presses[k] = true; }, held, get mode() { return mode; } };
