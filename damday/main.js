// Dam Day: the page. Input (keys, tap-to-walk, a pad and an A button), the talking box, the notebook, the cards
// between loops, sound and saving. The game itself is sim.js; the picture is render.js.
import { Game, newStore, ITEMS } from './sim.js';
import { View } from './render.js';
import { Sound } from './sound.js';
import { MAPS, OBJECTS, T } from './world.js';
import { NPCS, THINGS } from './people.js';
import { CLUES, THREADS, NUDGES } from './clues.js';
import { LOOP, BREAK, clockText, clamp } from './util.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo');
const KEY = 'damday.v1';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(pointer: coarse)').matches;
if (TOUCH) document.body.classList.add('touch');

/* ----------------------------------------------------------------------------------------------------- saving */
function load() {
  const st = newStore();
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!d) return st;
    for (const id of d.known || []) if (CLUES[id]) st.known.add(id);
    st.order = (d.order || []).filter(id => st.known.has(id)); for (const id of st.known) if (!st.order.includes(id)) st.order.push(id);
    Object.assign(st, { seen: d.seen || {}, met: d.met || {}, loops: d.loops | 0, history: d.history || [], won: !!d.won, intro: !!d.intro });
    snd.on = d.sound !== false;
  } catch { /* a bad or blocked save just starts fresh */ }
  return st;
}
function save() {
  if (DEMO) return;
  const s = g.store;
  try { localStorage.setItem(KEY, JSON.stringify({ known: [...s.known], order: s.order, seen: s.seen, met: s.met, loops: s.loops, history: s.history, won: s.won, intro: s.intro, sound: snd.on })); } catch { /* storage full or off */ }
}

const snd = new Sound();
const store = load();
const g = new Game(store);
const view = new View($('c'));
let fresh = new Set();   // clues learned since the notebook was last opened

if (DEMO) {
  for (const id of Object.keys(CLUES)) if (!['dam_break', 'decreed', 'siren_sounds', 'cat_trade', 'orla_warned', 'why_you'].includes(id)) store.known.add(id);
  store.known.add('dam_break'); store.loops = 4; store.intro = true; store.met = Object.fromEntries(NPCS.map(n => [n.id, true]));
  g.run(63); g.wake = 0; g.player.put('town', 26, 18); g.player.dir = 'right'; g.drain(); view.hidePrompt = true;
}

/* ----------------------------------------------------------------------------------------------------- layout */
function resize() { view.resize(innerWidth, innerHeight, Math.min(devicePixelRatio || 1, 3)); const t = view.tilesAcross(); g.view = { hw: t.hw, hh: t.hh }; }
addEventListener('resize', resize); resize();

/* ----------------------------------------------------------------------------------------------------- the corner */
const faceCtx = $('face').getContext('2d');
function drawFace(t) {
  const c = faceCtx; c.clearRect(0, 0, 22, 22); c.fillStyle = '#8c735f'; c.beginPath(); c.arc(11, 11, 11, 0, 7); c.fill(); c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(11, 11, 9.4, 0, 7); c.fill();
  c.fillStyle = '#b9a8ea'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.fillRect(Math.round(11 + Math.cos(a) * 8) - 0, Math.round(11 + Math.sin(a) * 8) - 0, 1, 1); }
  const secs = 7 * 3600 + 56 * 60 + t, m = (secs / 60) % 60, h = (secs / 3600) % 12, a = v => v * Math.PI * 2 - Math.PI / 2;
  const hand = (v, len, col) => { c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.moveTo(11, 11); c.lineTo(11 + Math.cos(a(v)) * len, 11 + Math.sin(a(v)) * len); c.stroke(); };
  hand(h / 12, 4.5, '#5a4a6e'); hand(m / 60, 7, '#5a4a6e'); hand(((secs) % 60) / 60, 8, '#e0606a');
}
// The clock's digits are drawn from a chunky 5x7 bitmap font of their own, big and square, so they read at a glance
const GLYPH = { '0': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'], '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'], '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'], '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01110'], ':': ['0', '0', '1', '0', '1', '0', '0'] };
const digitsEl = $('digits'), digitsCtx = digitsEl.getContext('2d');
function drawDigits(text, alarm) {
  const c = digitsCtx; c.clearRect(0, 0, 33, 7); c.fillStyle = alarm ? '#d84a58' : '#4a3d62'; let x = 0;
  for (const ch of text) { const g = GLYPH[ch]; if (!g) continue; for (let y = 0; y < 7; y++) for (let i = 0; i < g[y].length; i++) if (g[y][i] === '1') c.fillRect(x + i, y, 1, 1); x += g[0].length + 1; }
  digitsEl.setAttribute('aria-label', text);
}
let lastDigits = '';
function hud() {
  const alarm = g.t >= 195 && !g.ended, s = clockText(g.t) + (alarm ? '!' : ''); if (s !== lastDigits) { lastDigits = s; drawDigits(clockText(g.t), alarm); drawFace(g.t); }
  $('level').firstElementChild.style.width = clamp(g.t / BREAK * 100, 0, 100) + '%';
  $('plaque').classList.toggle('alarm', alarm);
  $('loopn').textContent = 'Loop ' + (g.store.loops + (g.ended ? 0 : 1));
  const ready = !g.talk && !g.ended && g.nearby().length > 0; $('abtn').classList.toggle('ready', ready);
}
function bag() {
  $('bag').innerHTML = [...g.items].map(i => `<span class="chip"><i style="background:${i === 'keys' ? '#d9c06a' : i === 'fuse' ? '#e8a05a' : '#9ac4e0'}"></i>${esc(ITEMS[i])}</span>`).join('');
}
function toast(html) { const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = html; $('toasts').appendChild(el); setTimeout(() => el.remove(), 4300); while ($('toasts').children.length > 3) $('toasts').firstChild.remove(); }

/* ----------------------------------------------------------------------------------------------------- talking */
const talkEl = $('talk'), saidEl = $('said'), asksEl = $('asks'), moreEl = $('more');
let typed = '', shown = 0, typingDone = true, typeAcc = 0;
const fmt = s => esc(s).replace(/\([^)]*\)?/g, m => '<em>' + m + '</em>');
function openTalk(tk) {
  document.body.classList.add('talking'); g.setWant(null); held.length = 0; talkEl.hidden = false; $('twho').textContent = tk.name || '';
  showPage();
}
function showPage() {
  const tk = g.talk; if (!tk) return; typed = tk.pages[tk.page]; shown = REDUCED ? typed.length : 0; typingDone = REDUCED; typeAcc = 0; asksEl.innerHTML = ''; paintTyped();
  $('tcost').textContent = tk.kind === 'npc' ? 'Talking takes time: about ' + tk.cost + ' seconds so far.' : '';
}
function paintTyped() {
  saidEl.innerHTML = fmt(typed.slice(0, shown)); const tk = g.talk; if (!tk) return;
  const last = tk.page >= tk.pages.length - 1, done = shown >= typed.length; typingDone = done;
  moreEl.hidden = !(done && !last);
  if (done && last && !asksEl.children.length) {
    const asks = tk.ask || [];
    asksEl.innerHTML = asks.map((a, i) => `<button class="btn say" data-i="${i}"><span>${esc(a[1])}</span><small>+${4} s</small></button>`).join('') + `<button class="btn bye" data-bye="1">${asks.length ? 'Goodbye' : 'OK'}</button>`;
  }
}
function typeTick(dt) { if (!g.talk || typingDone) return; typeAcc += dt * 70; const n = Math.floor(typeAcc); if (n) { typeAcc -= n; shown = Math.min(typed.length, shown + n); if (shown % 3 === 0) snd.blip(shown); paintTyped(); } }
function talkNext() {
  const tk = g.talk; if (!tk) return;
  if (!typingDone) { shown = typed.length; paintTyped(); return; }
  if (tk.page < tk.pages.length - 1) { g.advance(); showPage(); return; }
  if (!(tk.ask || []).length) closeTalk();
}
function closeTalk() { const cost = g.leave(); talkEl.hidden = true; document.body.classList.remove('talking'); if (cost >= 2) toast(`<b>⏳</b> That took about ${cost} seconds.`); bag(); save(); }
asksEl.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; snd.init();
  if (b.dataset.bye) return closeTalk();
  const a = g.talk.ask[+b.dataset.i]; if (a) { g.choose(a[0]); showPage(); bag(); }
});
talkEl.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; snd.init(); talkNext(); });

/* ----------------------------------------------------------------------------------------------------- the notebook */
let tab = 'rumors';
const SHORT = { 'the Pier': 'Pier', 'the Mill': 'Mill', 'the Bridge': 'Bridge', 'the Station': 'Station', 'Town Hall steps': 'Hall', 'the Green': 'Green', 'Chapel Hill': 'Hill', 'the Dam': 'Dam', 'Main Street': 'Main St', 'Low Lane': 'Lane', 'the Inn yard': 'Inn yd', 'the Bakery door': 'Bakery', 'the Fire Station door': 'Fire stn', 'the valley': 'valley', 'the Drowsy Heron': 'Inn', "Orla's workshop": 'Mill', 'the Chapel': 'Chapel', 'the Fire Station': 'Fire stn', 'Town Hall': 'Hall', 'Crumb & Crumble': 'Bakery', 'Tock & Daughters, Clocks': 'Clocks' };
function renderNotebook() {
  const k = id => g.store.known.has(id), P = $('pages');
  document.querySelectorAll('#tabs .tab').forEach(t => t.classList.toggle('on', t.dataset.t === tab));
  if (tab === 'rumors') {
    const total = Object.keys(CLUES).length, have = g.store.known.size;
    let h = `<p class="count">${have} of ${total} things written down. They fill in as you notice them.</p>`;
    const nudge = g.store.loops >= 1 ? NUDGES.find(([f]) => f(k)) : null; if (nudge) h += `<div class="nudge"><b>Think:</b> ${esc(nudge[1])}</div>`;
    for (const th of THREADS) {
      const ids = Object.keys(CLUES).filter(id => CLUES[id].th === th.id && k(id)); if (!ids.length) continue;
      const solved = th.solved && k(th.solved), lead = !solved && [...(g.store.order || [])].reverse().find(id => CLUES[id]?.th === th.id && CLUES[id].lead);
      h += `<section class="thread${solved ? ' solved' : ''}"><h3><span>${esc(th.title)}</span><em>${solved ? 'answered' : th.solved ? 'still unknown' : 'notes'}</em></h3><div class="bl">${esc(th.blurb)}</div><ul>${ids.map(id => `<li class="${fresh.has(id) ? 'new' : ''}">${esc(CLUES[id].t)}</li>`).join('')}</ul>${lead ? `<div class="lead">→ ${esc(CLUES[lead].lead)}</div>` : ''}</section>`;
    }
    P.innerHTML = h;
  } else if (tab === 'people') {
    const met = NPCS.filter(n => g.store.met[n.id] || g.store.seen[n.id]);
    const cols = ['56:00', '56:30', '57:00', '57:30', '58:00', '58:30', '59:00', '59:30'];
    let h = `<p class="count">You’ve met ${met.length} of ${NPCS.length}. Each grid fills in when you see someone: where they were, at which half-minute (7:5x). Days repeat, so schedules repeat, unless something changes them.</p>`;
    for (const n of met) {
      const row = g.store.seen[n.id] || Array(8).fill(null);
      h += `<section class="person"><h3>${esc(n.name)}</h3><p>${esc(n.tag)}</p><div class="grid"><table><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr><tr>${row.map(c => `<td class="${c ? (/Hill|Chapel/.test(c) ? 'hill' : 'has') : ''}">${c ? esc(SHORT[c] || c) : '·'}</td>`).join('')}</tr></table></div></section>`;
    }
    if (met.length < NPCS.length) h += `<p class="count">…and ${NPCS.length - met.length} more you haven’t spoken to yet.</p>`;
    P.innerHTML = h;
  } else {
    const hist = [...g.store.history].reverse();
    let h = `<p class="count">Each time the water comes, the bench is waiting.</p>`;
    h += hist.length ? hist.map(x => `<div class="logrow ${x.saved === x.total && x.you ? 'win' : ''}"><b>Loop ${x.loop}</b><span>${x.saved} of ${x.total} on the hill${x.you ? '' : ' (you didn’t make it)'}${x.lost.length ? '. Missing: ' + x.lost.map(id => esc(NPCS.find(n => n.id === id)?.name.split(' ').slice(-1)[0] || id)).join(', ') : '. Everyone.'}</span></div>`).join('') : '<p class="count">Nothing yet. The first loop is still going.</p>';
    h += `<div class="foot"><button class="btn" id="rewind">Wake on the bench now</button><button class="btn quiet" id="forget">Forget everything</button></div>`;
    P.innerHTML = h;
    $('rewind').onclick = () => { closeNotebook(); g.abandon(); };
    let sure = false; $('forget').onclick = e => { if (!sure) { sure = true; e.target.textContent = 'Really forget everything?'; return; } try { localStorage.removeItem(KEY); } catch { } location.reload(); };
  }
}
function openNotebook() { if (g.talk || cardOpen) return; g.setWant(null); held.length = 0; $('nb').hidden = false; renderNotebook(); $('bnote').querySelector('.dot').hidden = true; fresh = new Set(fresh); setTimeout(() => { fresh = new Set(); }, 0); }
function closeNotebook() { $('nb').hidden = true; }
$('bnote').onclick = () => { snd.init(); $('nb').hidden ? openNotebook() : closeNotebook(); };
$('nbx').onclick = closeNotebook;
document.querySelectorAll('#tabs .tab').forEach(t => t.onclick = () => { tab = t.dataset.t; renderNotebook(); $('pages').scrollTop = 0; });
$('nb').addEventListener('pointerdown', e => { if (e.target === $('nb')) closeNotebook(); });
$('bsnd').onclick = () => { snd.init(); snd.setOn(!snd.on); $('wave').style.display = snd.on ? '' : 'none'; save(); };
$('wave').style.display = snd.on ? '' : 'none';

/* ----------------------------------------------------------------------------------------------------- cards */
let cardOpen = false, endTimer = 0, cardShown = false, fadingIn = 0;
function showCard(html, after) { cardOpen = true; $('cbox').innerHTML = html; $('card').hidden = false; $('cbox').scrollTop = 0; cardAfter = after; }
let cardAfter = null;
$('card').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; snd.init(); const a = b.dataset.a; $('card').hidden = true; cardOpen = false; cardAfter && cardAfter(a); });
function introCard() {
  showCard(`<h2>Wickerby, 7:56 AM</h2><p class="sub">Dam Day</p>
    <p>You get off the morning train with no bag and nowhere to be, and sit down on the station bench to wait for nothing in particular. The sun is out. The washing is out. Somebody is rehearsing a speech.</p>
    <p>The ticket in your pocket says <i>one morning</i>. You have a notebook. It seems to be filling itself in.</p>
    <p style="color:var(--ink2);font-size:15px">${TOUCH ? 'Use the pad to walk, or tap somewhere to walk there. Tap <b>A</b> (or tap a person) to talk.' : 'Arrows or WASD to walk, or click somewhere to walk there. Space talks. N opens the notebook.'} The clock runs while you walk and talk.</p>
    <div class="row"><button class="btn go" data-a="go">Sit and wait</button></div>`, () => { g.store.intro = true; save(); });
}
function endCard(o) {
  if (o.abandoned) { showCard(`<h2>7:56 AM. The bench.</h2><p class="sub">You sat up early</p><p>You close your eyes on purpose, and the morning lets you go. Nothing you carried came with you. The notebook did.</p><div class="row"><button class="btn go" data-a="go">Wake on the bench</button></div>`, wake); return; }
  const names = o.all.map(x => `<span class="${x.safe ? 'ok' : 'no'}">${esc(x.name.split(' ').slice(-1)[0])}</span>`).join('') + `<span class="${o.you ? 'ok' : 'no'}">You</span>`;
  if (o.win) {
    showCard(`<h2>8:00 AM. Nobody is in its way.</h2><p class="sub">Wickerby, Dam Day</p>
      <div class="who">${names}</div>
      <p>The water takes the low town and finds it empty. Up on Chapel Hill, nine people, a cat, a great many buns and one very small clock watch it go by. Gideon rings the bell and feels it in his beard.</p>
      <p>The bell strikes eight. And then, for the first time in a hundred years, the town clock lets the minute go: 8:01.</p>
      <div class="ticket">WICKERBY · ONE MORNING<br>PASSENGER: <b>(you)</b><br><small>used, with thanks</small></div>
      <p style="color:var(--ink2);font-size:15px">Orla is asleep again, standing up, lantern lit. Wim is still wrong about the time. Barnaby is thanking the river.</p>
      <div class="row"><button class="btn mint" data-a="again">Walk the morning again</button><button class="btn quiet" data-a="forget">Forget it all, start over</button></div>`, a => a === 'forget' ? (g.store.known = new Set(['ticket']), g.store.order = ['ticket'], g.store.met = {}, g.store.seen = {}, g.store.history = [], g.store.loops = 0, g.store.won = false, save(), wake()) : wake());
    return;
  }
  const first = g.store.loops <= 1;
  const lines = [`<h2>8:00 AM. The water comes.</h2><p class="sub">${o.saved} of ${o.total} reached the hill${o.you ? '' : '. You didn’t'}</p><div class="who">${names}</div>`];
  if (first) lines.push(`<p>Everything goes white, and then the station. 7:56. The bench is warm and the clock says 7:56. Nothing you carried came with you. <b>The notebook did.</b></p>`);
  else lines.push(`<p>${o.saved >= o.total - 2 ? 'So close.' : 'The bench again.'} Nothing you carried came with you. The notebook did.</p>`);
  const lost = o.all.filter(x => !x.safe); if (lost.length && !first) lines.push(`<p style="color:var(--ink2);font-size:15px">${lost.slice(0, 5).map(x => esc(x.name.split(' ').slice(-1)[0]) + ' (' + esc(x.where.replace(/^the /, '')) + ')').join(', ')}${lost.length > 5 ? '…' : ''} didn’t make it.</p>`);
  lines.push(`<div class="row"><button class="btn go" data-a="go">Wake on the bench</button></div>`);
  showCard(lines.join(''), wake);
}
function wake() { talkEl.hidden = true; document.body.classList.remove('talking'); g.startLoop(); view.birds = view.makeBirds(); view.fx.length = 0; fadingIn = 1; cardShown = false; endTimer = 0; bag(); save(); }

/* ----------------------------------------------------------------------------------------------------- input */
const held = [];
const DIRK = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
const modal = () => g.talk || cardOpen || !$('nb').hidden;
function applyHeld() { g.setWant(modal() ? null : held[held.length - 1] || null); }
addEventListener('keydown', e => {
  snd.init(); if (e.metaKey || e.ctrlKey || e.altKey) return;
  const d = DIRK[e.key];
  if (d) { e.preventDefault(); if (!held.includes(d)) held.push(d); applyHeld(); return; }
  if (e.key === 'n' || e.key === 'N' || e.key === 'Tab' || e.key === 'b') { e.preventDefault(); if (!cardOpen && !g.talk) $('nb').hidden ? openNotebook() : closeNotebook(); return; }
  if (e.key === 'm' || e.key === 'M') { $('bsnd').click(); return; }
  if (e.key === 'Escape') { if (!$('nb').hidden) closeNotebook(); else if (g.talk) closeTalk(); return; }
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E' || e.key === 'z' || e.key === 'Z') {
    e.preventDefault(); if (e.repeat) return;
    if (cardOpen) { $('cbox').querySelector('button')?.click(); return; }
    if (!$('nb').hidden) return;
    if (g.talk) { talkNext(); return; }
    if (!g.ended) g.interact();
    return;
  }
  if (g.talk && /^[1-9]$/.test(e.key)) { const b = asksEl.querySelectorAll('.say')[+e.key - 1]; if (b) b.click(); }
});
addEventListener('keyup', e => { const d = DIRK[e.key]; if (d) { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); applyHeld(); } });
addEventListener('blur', () => { held.length = 0; applyHeld(); });

// the pad
const pad = $('pad'), nub = pad.querySelector('.nub'); let padOn = false;
function padMove(e) {
  const r = pad.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  nub.style.transform = `translate(${clamp(dx, -42, 42)}px,${clamp(dy, -42, 42)}px)`;
  if (modal()) return g.setWant(null);
  g.setWant(Math.hypot(dx, dy) < 16 ? null : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
}
pad.addEventListener('pointerdown', e => { snd.init(); padOn = true; pad.setPointerCapture(e.pointerId); padMove(e); e.preventDefault(); });
pad.addEventListener('pointermove', e => { if (padOn) padMove(e); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(ev, () => { padOn = false; nub.style.transform = ''; g.setWant(null); });
$('abtn').addEventListener('pointerdown', e => { e.preventDefault(); snd.init(); $('abtn').classList.add('on'); if (g.talk) talkNext(); else if (!g.ended) g.interact(); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('abtn').addEventListener(ev, () => $('abtn').classList.remove('on'));

// tap or click the world: walk there; tap a person or a thing: walk up and talk
const cv = $('c');
cv.addEventListener('pointerdown', e => {
  snd.init(); if (modal() || g.ended || g.wake > 0 || e.target !== cv) return;
  const r = cv.getBoundingClientRect(), S = view.S, k = cv.width / r.width;
  const wx = view.cam.x + (e.clientX - r.left) * k / S, wy = view.cam.y + (e.clientY - r.top) * k / S, p = g.player, area = MAPS[p.map];
  const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
  let best = null, bd = 1.1;
  for (const n of g.npcs) if (n.map === p.map && !n.caught) { const d = Math.hypot((n.rx + .5) * T - wx, (n.ry + .5) * T - wy) / T; if (d < bd) { bd = d; best = { kind: 'npc', id: n.id }; } }
  for (const o of OBJECTS) if (o.map === p.map && THINGS[o.id]) { const d = Math.hypot((o.x + .5) * T - wx, (o.y + .5) * T - wy) / T; if (d < Math.min(bd, 1.0) - 0.05) { bd = d; best = { kind: 'thing', id: o.id }; } }
  if (best) { g.goTo(best); return; }
  let dest = null; for (let rad = 0; rad <= 2 && !dest; rad++) for (let dy = -rad; dy <= rad && !dest; dy++) for (let dx = -rad; dx <= rad; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === rad && area.walk(tx + dx, ty + dy)) { dest = [tx + dx, ty + dy]; break; }
  if (dest && g.walkTo(p.map, dest[0], dest[1])) view.fx.push({ k: 'mark', map: p.map, x: dest[0], y: dest[1], t: 0 });
});
cv.addEventListener('contextmenu', e => e.preventDefault());

/* ----------------------------------------------------------------------------------------------------- events */
function handle(ev) {
  view.onEvent(ev, g);
  switch (ev.type) {
    case 'learn': { fresh.add(ev.data); $('bnote').querySelector('.dot').hidden = false; snd.learn(); toast(`<b>✎</b>${esc(CLUES[ev.data].t.length > 110 ? CLUES[ev.data].t.slice(0, 107) + '…' : CLUES[ev.data].t)}`); save(); break; }
    case 'item': bag(); snd.item(); break;
    case 'chime': snd.chime(ev.data); break;
    case 'bellring': snd.bell(ev.data === 'gideon' ? .14 : .28, 262); break;
    case 'groan': snd.groan(ev.data); break;
    case 'break': snd.burst(); snd.flood(); break;
    case 'siren': snd.siren(); break;
    case 'decree': snd.decree(); break;
    case 'door': snd.door(); break;
    case 'talk': if (g.talk === ev.data) openTalk(ev.data); break;
    case 'loop': $('loopn').textContent = 'Loop ' + ev.data; bag(); break;
    case 'end': endTimer = 0; cardShown = false; if (ev.data.win) snd.win(); else snd.rewind(); break;
  }
}

/* ----------------------------------------------------------------------------------------------------- the clock on the wall */
let last = performance.now(), lastCell = '';
function frame(nowMs) {
  const dt = Math.min(0.1, (nowMs - last) / 1000); last = nowMs; advance(dt, nowMs / 1000); requestAnimationFrame(frame);
}
function advance(dt, now) {
  if (!modal() && !g.ended) g.tick(dt);
  else if (g.ended) endSequence(dt);
  for (const ev of g.drain()) handle(ev);
  const p = g.player, cell = p.map + p.x + ',' + p.y; if (cell !== lastCell) { lastCell = cell; if (!g.ended && g.t > 0.5) snd.step(); }
  typeTick(dt);
  if (fadingIn > 0) { fadingIn = Math.max(0, fadingIn - dt / 1.1); view.fade = fadingIn; }
  snd.ambient(g.t, g.t < 190 && !g.ended);
  view.draw(g, now, dt); hud();
  if (!DEMO && !g.store.intro && !cardOpen && g.t < 1 && !g.ended) introCard();
}
function endSequence(dt) {
  endTimer += dt; view.fade = clamp((endTimer - 0.2) / 1.6, 0, 1);
  if (endTimer > 2.2 && !cardShown) { cardShown = true; save(); endCard(g.over); }
}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => { last = performance.now(); });
$('hints').style.opacity = 1; setTimeout(() => { $('hints').style.opacity = 0; }, 14000);
if (DEMO) { $('hints').style.display = 'none'; }
bag(); lastDigits = ''; hud();

// for poking at it from the console, and for tests when the page isn't visible
window.__dd = { g, view, snd, advance, frames(n, dtMs = 50) { for (let i = 0; i < n; i++) advance(dtMs / 1000, performance.now() / 1000); }, wake, introCard };
window.toyboxReady?.();
