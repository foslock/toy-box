// Customs of the Dead: the booth, the desk, the stamps, the rule book, mornings and nights, and the tutorial.
import { RULES, DAYS, MEMOS, GALLO_NOTE, FAMILY, COSTS, ENDINGS, CONFESS, MISSING_LINE, LEAVE, WAGE, PENALTY } from './data.js';
import { buildDay, compare, expected, citationText, fmtDate, sealOf, rulesFor, pick, rng, DOCNAME, SEALS } from './souls.js';
import { Booth, faceCanvas, iconURL, sealCanvas, tallyCanvas, posterCanvas, C } from './art.js';
import { unlock, sfx, setMuted, isMuted } from './audio.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), AUTO = Q.has('autoplay'), DEBUG = Q.has('debug') || AUTO;
const SPEED = +Q.get('speed') || 1;
const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const R = Math.random;

// ---------------------------------------------------------------- save
const KEY = 'customs.v1';
function newGame(seed = Math.floor(R() * 1e9)) {
  return {
    day: 1, money: 15, seed,
    fam: Object.fromEntries(FAMILY.map(f => [f.id, { hunger: 0, sick: false, sickN: 0, gone: false }])),
    flags: { bribes: 0, cousins: 0, ossa: false, ossaRefused: false, truth: false, cucaArrives: 0, cucaDest: null,
      evicted: false, rentMissed: 0, candles: 0, candleLast: true, galloRead: false, letter: null, fee: 0 },
    stats: { processed: 0, correct: 0, citations: 0 },
  };
}
let S = null;
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.day) return s; } catch {} return null; }
function store() { if (DEMO || AUTO) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }

// ---------------------------------------------------------------- booth canvas
const winCv = $('#win'), booth = new Booth(winCv), faceHit = $('#faceHit');
function layout() {
  const w = $('#booth').clientWidth, vh = innerHeight;
  const side = matchMedia('(orientation: landscape) and (max-height: 560px)').matches;
  const h = side ? Math.max(110, Math.min(200, vh - 42 - 44 - 150)) : Math.max(120, Math.min(280, vh * (vh > 760 && w > 600 ? .28 : .21), w * .5));
  booth.resize(w, h);
  const dpr = Math.min(3, devicePixelRatio || 1);
  winCv.style.width = (booth.W * booth.s / dpr) + 'px';
  winCv.style.height = (booth.H * booth.s / dpr) + 'px';
  placeFace();
  drawThreads();
}
function placeFace() {
  const r = booth.faceRect();
  Object.assign(faceHit.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
}
addEventListener('resize', layout);

// ---------------------------------------------------------------- timers in game time (so ?speed and a hidden tab behave)
let gameT = 0;
const timers = [];
const later = (ms, fn) => timers.push({ at: gameT + ms, fn });

// ---------------------------------------------------------------- the day
let D = null;    // today's shift
let screen = 'title';
const hud = { day: $('#hDay'), date: $('#hDate'), time: $('#hTime'), bar: $('#hBar'), money: $('#hMoney') };
$('#hCoinIc').src = iconURL('coin', C.mustard, 3);

function startShift() {
  const cfg = DAYS[S.day];
  D = { queue: buildDay(S.day, S), i: -1, soul: null, state: 'wait', clock: cfg.time, time: cfg.time,
    wages: 0, penalties: 0, extra: 0, citations: 0, correct: 0, processed: 0, notes: [], bribeTaken: false };
  D.seal = sealOf(S.day, S.seed);
  hideScreen(); screen = 'shift';
  booth.queue = Math.min(8, D.queue.length);
  booth.shuffle = performance.now();
  updateHud();
  setSpeech('Booth 4', 'The shutter rolls up. The queue shuffles forward.');
  sfx.bell();
  later(900, nextSoul);
}

function nextSoul() {
  if (screen !== 'shift') return;
  D.i++;
  clearDesk();
  if (D.i >= D.queue.length) return endShift('done');
  const s = D.soul = D.queue[D.i];
  s.confessed = false;
  booth.queue = Math.min(8, D.queue.length - D.i - 1);
  booth.arrive(s, performance.now());
  D.state = 'arriving';
  later(950, () => {
    if (screen !== 'shift' || D.soul !== s) return;
    D.state = 'serve';
    setSpeech(s.name, s.greet, true);
    renderPapers(s);
    placeFace(); faceHit.hidden = false;
    sfx.paper();
    emit('arrive', s.story);
  });
}

function endShift(why) {
  if (screen !== 'shift') return;
  screen = 'closing';
  setInspect(false); disarm(); closeBook();
  if (D.soul && D.state !== 'leaving') { booth.leave('return', performance.now()); setSpeech(D.soul.name, 'The bell? Then I will come back tomorrow.', true); }
  faceHit.hidden = true;
  sfx.toll();
  later(why === 'time' ? 400 : 0, () => { clearDesk(); });
  later(1700, () => { setSpeech('Booth 4', 'The shutter comes down.'); showNight(); });
}

// ---------------------------------------------------------------- the desk
const papers = $('#papers'), desk = $('#desk');
function clearDesk() { papers.innerHTML = ''; desk.classList.add('empty'); clearThreads(); }
function field(ref, label, value, extra = '') {
  return `<div class="f${ref ? '' : ' nf'}"${ref ? ` data-f="${ref}"` : ''}><i>${label}</i><b>${value}</b>${extra}</div>`;
}
let grain = null;
function grainURL() {
  if (grain) return grain;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
  for (let y = 0; y < 64; y += 2) for (let x = 0; x < 64; x += 2) { c.fillStyle = `rgba(0,0,0,${R() < .22 ? 0 : .6 + R() * .4})`; c.fillRect(x, y, 2, 2); }
  return grain = `url(${cv.toDataURL()})`;
}
function renderPapers(s) {
  papers.innerHTML = ''; desk.classList.remove('empty'); desk.scrollTop = 0;
  const d = s.docs, list = [];
  const rot = () => ((R() - .5) * 2.4).toFixed(2) + 'deg';
  if (d.card) {
    const p = el('div', 'paper soulcard', `<h3>SOUL CARD<small>No. ${1000 + (s.name.length * 977 + s.born) % 9000}</small></h3>
      <div class="row"><div class="ph"></div><div class="col">${field('card.name', 'NAME', esc(d.card.name))}${field(null, 'BORN', d.card.born)}</div></div>
      ${field('card.died', 'DIED', fmtDate(d.card.died))}${field('card.cause', 'CAUSE', esc(d.card.cause))}${field(null, 'FROM', esc(d.card.town))}`);
    const ph = faceCanvas(d.card.photo, 1, '#cbbd96'); ph.className = 'photo'; ph.dataset.f = 'card.photo';
    p.querySelector('.ph').replaceWith(ph);
    list.push(p);
  }
  if (d.cert) {
    const p = el('div', 'paper cert', `<h3>DEATH CERTIFICATE</h3>${field('cert.name', 'NAME', esc(d.cert.name))}
      ${field('cert.died', 'DATE OF DEATH', fmtDate(d.cert.died))}${field('cert.cause', 'CAUSE', esc(d.cert.cause))}
      <div class="f sealf" data-f="cert.seal"><i>REGISTRAR SEAL</i><div class="sealrow"><span class="sl"></span><span class="sig">R. Calavera</span></div></div>`);
    const sc = sealCanvas(d.cert.seal, 2); sc.className = 'seal'; p.querySelector('.sl').replaceWith(sc);
    list.push(p);
  }
  if (d.deeds) {
    const p = el('div', 'paper deeds', `<h3>RECORD OF DEEDS</h3>${field('deeds.name', 'NAME', esc(d.deeds.name))}
      <div class="f nf"><i>VIRTUES</i><span class="tv"></span></div><div class="f nf"><i>VICES</i><span class="tx"></span></div>
      <div class="ex"><div data-s="+">${esc(d.deeds.virtueEx)}</div><div data-s="-">${esc(d.deeds.viceEx)}</div></div>`);
    const tv = tallyCanvas(d.deeds.virtues, 2, C.teal), tx = tallyCanvas(d.deeds.vices, 2, C.red);
    tv.className = tx.className = 'tally';
    tv.setAttribute('aria-label', d.deeds.virtues + ' virtues'); tx.setAttribute('aria-label', d.deeds.vices + ' vices');
    p.querySelector('.tv').replaceWith(tv); p.querySelector('.tx').replaceWith(tx);
    list.push(p);
  }
  if (d.summons) list.push(el('div', 'paper summons', `<h3>SUMMONS<small>OFFICE OF HOURS</small></h3>${field('summons.name', 'NAME', esc(d.summons.name))}
      ${field('summons.appt', 'APPOINTED FOR', fmtDate(d.summons.appt))}<div class="f nf"><i>BY ORDER</i><span class="sig">The Clockmaker</span></div>`));
  if (d.catform) {
    const p = el('div', 'paper catform', `<h3>CAT FORM</h3>${field('catform.owner', 'OWNER', esc(d.catform.owner))}${field(null, 'CAT', esc(d.catform.cat))}<img class="paw" alt="">`);
    p.querySelector('.paw').src = iconURL('paw', '#7b6d55', 6);
    list.push(p);
  }
  if (s.story === 'gallo') list.push(el('div', 'paper note', `<h3>A FOLDED NOTE</h3><p class="notetext">${esc(GALLO_NOTE)}</p>`));
  if (s.bribe && !D.bribeTaken) {
    const c = el('button', 'coins', `<span class="pile">${'<img alt="">'.repeat(3)}</span><span>${s.bribe} COINS</span><small>TAP TO POCKET</small>`);
    c.querySelectorAll('img').forEach(i => i.src = iconURL('coin', C.mustard, 4));
    c.onclick = () => takeBribe(c);
    list.push(c);
  }
  list.forEach((p, i) => { p.style.setProperty('--rot', rot()); p.style.setProperty('--d', (i * .07) + 's'); papers.appendChild(p); });
  document.documentElement.style.setProperty('--grain', grainURL());
}

function takeBribe(c) {
  if (D.state !== 'serve' || inspecting || !allowed('bribe')) return;
  D.bribeTaken = true; D.extra += D.soul.bribe; S.flags.bribes++;
  c.remove(); sfx.coin();
  setSpeech(D.soul.name, 'Good. We understand each other.', true);
  toast('+' + D.soul.bribe + ' coins, pocketed');
}

// ---------------------------------------------------------------- inspect
let inspecting = false, picked = null, threads = [];
const bInspect = $('#bInspect'), bRules = $('#bRules');
bInspect.querySelector('img').src = iconURL('lens', C.bone, 3);
bRules.querySelector('img').src = iconURL('book', C.bone, 3);
function setInspect(on) {
  if (on && !allowed('inspect')) return nope(bInspect);
  inspecting = on;
  document.body.classList.toggle('inspecting', on);
  bInspect.classList.toggle('on', on);
  bInspect.querySelector('img').src = iconURL('lens', on ? C.ink : C.bone, 3);
  unpick();
  if (on) { disarm(); emit('inspectOn'); }
}
bInspect.onclick = () => { unlock(); if (screen === 'shift') setInspect(!inspecting); };
function unpick() { if (picked) { picked.el.classList.remove('picked'); picked = null; } booth.pick = false; }

document.addEventListener('click', e => {
  const t = e.target.closest('[data-f]');
  if (!t || screen !== 'shift' || D.state !== 'serve') return;
  if (!inspecting) { if (!allowed('inspect')) return; setInspect(true); }
  e.stopPropagation();
  pickField(t.dataset.f, t);
}, true);

function anchorFor(ref, node) { return ref === 'rules.seal' ? bRules : node; }
function pickField(ref, node) {
  if (!allowed('pick:' + ref)) return nope(node);
  const s = D.soul;
  node = anchorFor(ref, node);
  if (ref === 'rules.seal') closeBook();
  if (!picked) {
    picked = { ref, el: node }; node.classList.add('picked'); if (ref === 'window.face') booth.pick = true;
    sfx.pick(); emit('pick', ref);
    if (ref === 'window.face' && s.cord) {
      const res = { ok: false, text: 'SILVER CORD: STILL ALIVE', issue: 'cord' };
      threads = [{ a: node, b: null, res }]; drawThreads(); unpick(); found(res);
    }
    return;
  }
  if (picked.ref === ref) { unpick(); return; }
  const res = compare(s, picked.ref, ref, D.seal);
  for (const x of document.querySelectorAll('.f.good, .f.bad, .photo.bad')) x.classList.remove('good', 'bad');
  threads = [{ a: picked.el, b: node, res }];
  if (res.ok === false) { picked.el.classList.add('bad'); node.classList.add('bad'); }
  else if (res.ok) { picked.el.classList.add('good'); node.classList.add('good'); }
  unpick(); drawThreads();
  emit('pick', ref);
  if (res.ok === false) found(res); else sfx.pick();
}
function found(res) {
  sfx.found();
  const s = D.soul;
  if (!s.confessed) { s.confessed = true; setSpeech(s.name, pick(R, CONFESS[res.issue] || CONFESS.name), true); }
  emit('discrepancy', res.issue);
}

const svg = $('#threads');
const mctx = document.createElement('canvas').getContext('2d');
const textW = t => { mctx.font = "16px 'Tiny5', monospace"; return mctx.measureText(t).width; };
function clearThreads() { threads = []; svg.innerHTML = ''; for (const x of document.querySelectorAll('.f.good, .f.bad, .photo.bad')) x.classList.remove('good', 'bad'); }
function center(n) { const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r]; }
function drawThreads() {
  svg.innerHTML = '';
  for (const t of threads) {
    if (!t.a.isConnected || (t.b && !t.b.isConnected)) continue;
    const [x1, y1, ra] = center(t.a);
    let x2, y2;
    if (t.b) [x2, y2] = center(t.b); else { x2 = x1; y2 = $('#booth').getBoundingClientRect().top + 2; }
    const col = t.res.ok === false ? C.red : t.res.ok ? C.sage : '#8d8574';
    const sag = Math.min(40, Math.hypot(x2 - x1, y2 - y1) * .15);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + sag;
    svg.insertAdjacentHTML('beforeend', `<path d="M${x1} ${y1} Q${mx} ${my + sag} ${x2} ${y2}" stroke="${col}" stroke-width="3" fill="none" stroke-dasharray="${t.res.ok === false ? '0' : '6 4'}"/>
      <rect x="${x1 - 4}" y="${y1 - 4}" width="8" height="8" fill="${col}"/>${t.b ? `<rect x="${x2 - 4}" y="${y2 - 4}" width="8" height="8" fill="${col}"/>` : ''}`);
    const label = t.res.text, w = Math.ceil(textW(label)) + 18, lx = Math.max(6, Math.min(innerWidth - w - 6, mx - w / 2)), ly = t.b ? my + sag / 2 : y1 - ra.height / 2 - 20;
    svg.insertAdjacentHTML('beforeend', `<rect x="${lx}" y="${ly - 13}" width="${w}" height="24" fill="${C.ink}" stroke="${col}" stroke-width="2"/>
      <text x="${lx + w / 2}" y="${ly + 4}" fill="${t.res.ok === false ? '#f1b4a8' : C.bone}" text-anchor="middle">${esc(label)}</text>`);
  }
}
desk.addEventListener('scroll', drawThreads, { passive: true });

// ---------------------------------------------------------------- stamps
let armed = null;
const stampBtns = [...document.querySelectorAll('.stamp')];
for (const b of stampBtns) {
  b.querySelector('img').src = iconURL(b.dataset.dest, C.bone, 3);
  b.onclick = () => { unlock(); press(b.dataset.dest); };
}
const LABEL = { orchard: 'UP THE HILL', stair: 'DOWN BELOW', return: 'SEND BACK' };
function disarm() { armed = null; for (const b of stampBtns) { b.classList.remove('armed'); b.querySelector('small').innerHTML = LABEL[b.dataset.dest] + ' &middot; ' + (stampBtns.indexOf(b) + 1); } }
function press(dest) {
  if (screen !== 'shift' || !D || D.state !== 'serve') return;
  const b = stampBtns.find(x => x.dataset.dest === dest);
  if (!allowed('stamp:' + dest)) return nope(b);
  if (armed === dest) return decide(dest);
  if (inspecting) setInspect(false);
  disarm(); armed = dest; b.classList.add('armed'); b.querySelector('small').textContent = 'TAP AGAIN TO STAMP';
  sfx.arm();
}

function decide(dest) {
  const s = D.soul;
  disarm(); setInspect(false);
  D.state = 'leaving'; faceHit.hidden = true;
  const want = expected(s, S.day);
  let right = dest === want, cited = !right, paid = right ? WAGE : 0, msg = null;
  // the story's exceptions
  if (s.story === 'cousin' && dest === 'orchard') { cited = false; paid = 0; D.extra += 10; S.flags.cousins++; msg = '10 coins, under the stamp pad'; }
  if (s.story === 'mercedes') {
    if (dest === 'orchard') { cited = false; paid = 0; D.extra += 15; S.flags.ossa = true; msg = 'An envelope from upstairs: 15 coins'; }
    else S.flags.ossaRefused = true;
  }
  if (s.story === 'cuca') S.flags.cucaDest = dest;
  D.processed++; S.stats.processed++;
  if (right) { D.correct++; S.stats.correct++; }
  D.wages += paid;
  // the stamp comes down on the soul card (or the first paper there is)
  const target = papers.querySelector('.paper.soulcard') || papers.querySelector('.paper');
  if (target) target.appendChild(el('div', 'mark ' + dest, dest.toUpperCase()));
  sfx.stamp(); booth.flash = .12;
  if (navigator.vibrate) try { navigator.vibrate(18); } catch {}
  emit('decide', dest);
  later(320, () => {
    if (cited) citation(s, dest);
    else if (msg) { sfx.coin(); toast(msg); }
    else if (paid) toast('+' + paid, 'good');
  });
  later(650, () => {
    [...papers.children].forEach((p, i) => { p.style.setProperty('--d', (i * .05) + 's'); p.classList.add('fly'); });
    clearThreads(); sfx.paper();
    const early = s.issues.includes('early') || s.cord;
    let line = dest === 'return' ? (s.missing && !s.confessed ? pick(R, MISSING_LINE) : pick(R, early ? LEAVE.early : LEAVE.return)) : pick(R, LEAVE[dest]);
    if (s.story === 'bribe' && dest === 'return') line = D.bribeTaken ? 'You took my money! Thief!' : 'Honest clerks. What is the world coming to.';
    if (s.story === 'ignacio1') line = 'Back to the living, then. I will see you again, clerk.';
    if (s.story === 'ignacio2' && dest === 'return') line = 'Back to my hospital bed. Next time, it will be for good.';
    if (s.story === 'ignacio3' && dest === 'orchard') { line = 'Listen. This one is for you.'; sfx.accordion(); }
    if (s.story === 'cuca') line = dest === 'orchard' ? 'I will save you a seat under the orange trees.' : dest === 'stair' ? 'Mi vida! Your own grandmother!' : 'Back? But I am so tired.';
    if (s.story === 'ossa' && dest === 'stair') line = 'Down. Of course. Mind the envelopes.';
    if (s.story === 'cousin' && dest === 'stair') line = 'El Gallo will hear about this.';
    setSpeech(s.name, line, true);
    booth.leave(dest, performance.now());
    D.queue.length - D.i - 1 > 0 && (booth.queue = Math.min(8, D.queue.length - D.i - 1));
  });
  later(2100, () => { if (screen === 'shift') nextSoul(); });
  emit('decided:' + (s.story || ''), dest);
}

function citation(s, dest) {
  D.citations++; S.stats.citations++;
  const fine = D.citations > 1 ? PENALTY : 0;
  D.penalties += fine;
  const slip = $('#slip');
  slip.innerHTML = `<h5><span>CITATION</span><span>${fine ? '-' + fine : 'WARNING'}</span></h5><div>${esc(citationText(s, S.day, dest))}</div>`;
  slip.classList.add('show'); sfx.print(); later(160, sfx.bad);
  clearTimeout(slip._t); slip._t = setTimeout(() => slip.classList.remove('show'), 4200 / SPEED);
}

// ---------------------------------------------------------------- the rule book
const book = $('#book');
function openBook() {
  if (!allowed('rules')) return nope(bRules);
  unlock();
  const day = S.day, ids = rulesFor(day);
  const rules = RULES.filter(r => ids.has(r.id));
  let html = `<header><h2>REGULATIONS &middot; DAY ${day}</h2><button class="close">CLOSE</button></header><ol>`;
  html += rules.map(r => `<li class="${r.day === day && day > 1 ? 'new' : ''}">${esc(r.text)}</li>`).join('') + '</ol>';
  if (ids.has('seal')) html += `<h4>TODAY'S SEAL</h4><div class="seals"><div class="f" data-f="rules.seal"><span class="todayseal"></span><b>${D.seal.toUpperCase()}</b></div></div>`;
  html += `<h4>THE STAMPS</h4><div class="legend">
    <img data-i="orchard"><div><b>ORCHARD</b>: papers in order and more virtues than vices${ids.has('mercy') ? ' (or a tie)' : ''}.</div>
    <img data-i="stair"><div><b>STAIR</b>: papers in order, but the vices win.</div>
    <img data-i="return"><div><b>RETURN</b>: anything wrong with the papers, whatever the tallies say.</div></div>
    <h4>HOW TO INSPECT</h4><p>Tap INSPECT, then tap two details that should agree: a name and a name, a date of death and a date of death, the photo and the face at the window${ids.has('summons') ? ', the date of death and the summons date' : ''}${ids.has('seal') ? ", today's seal (above) and the certificate's seal" : ''}. A red thread means they don't.</p>
    <p>To stamp, tap a stamp, then tap it again. Keys: I inspect, R rules, 1 2 3 stamps.</p>`;
  book.querySelector('.pages').innerHTML = html;
  book.querySelectorAll('.legend img').forEach(i => i.src = iconURL(i.dataset.i, { orchard: '#c27a1f', stair: C.ox, return: C.ink }[i.dataset.i], 3));
  const ts = book.querySelector('.todayseal'); if (ts) { const c = sealCanvas(D.seal, 3); ts.replaceWith(c); }
  book.querySelector('.close').onclick = closeBook;
  book.hidden = false; sfx.paper();
  emit('rulesOpen');
}
function closeBook() { if (book.hidden) return; book.hidden = true; emit('rulesClose'); }
book.addEventListener('click', e => { if (e.target === book) closeBook(); });
bRules.onclick = () => { if (screen === 'shift') { book.hidden ? openBook() : closeBook(); } };

// ---------------------------------------------------------------- speech, toasts, hud
function setSpeech(name, text, say = false) {
  $('#sName').textContent = name; const t = $('#sText'); t.textContent = text; t.className = say ? 'say' : '';
}
function toast(text, kind = '') {
  const t = el('div', kind, esc(text)); $('#toast').appendChild(t);
  setTimeout(() => t.remove(), 2300);
}
function nope(node) { if (!node) return; node.classList.remove('shake'); void node.offsetWidth; node.classList.add('shake'); coachPulse(); }
function updateHud() {
  hud.day.textContent = 'DAY ' + S.day; hud.date.textContent = fmtDate(S.day);
  hud.money.textContent = S.money + (D ? D.wages + D.extra - D.penalties : 0);
  $('#hClock').classList.toggle('free', !D || !D.time);
  if (!D || !D.time) { hud.time.textContent = 'NO CLOCK'; return; }
  const k = Math.max(0, D.clock / D.time), mins = Math.round((1 - k) * 600); // 20:00 to 06:00
  const h = (20 + Math.floor(mins / 60)) % 24, m = mins % 60;
  hud.time.textContent = String(h).padStart(2, '0') + ':' + String(Math.floor(m / 10) * 10).padStart(2, '0');
  hud.bar.style.width = (k * 100) + '%';
  hud.bar.style.background = k < .2 ? C.red : C.mari;
}
const muteBtn = $('#mute');
const paintMute = () => { muteBtn.style.color = isMuted() ? '#5a5462' : C.mari; muteBtn.style.textDecoration = isMuted() ? 'line-through' : 'none'; };
muteBtn.onclick = () => { unlock(); setMuted(!isMuted()); paintMute(); };
paintMute();

// ---------------------------------------------------------------- keys
addEventListener('keydown', e => {
  unlock();
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (screen !== 'shift') {
    if (e.key === 'Enter') { const b = document.querySelector('#screen .btn:not(.alt)'); if (b && !$('#screen').hidden) { e.preventDefault(); b.click(); } }
    return;
  }
  if (!$('#coach').hidden && e.key === 'Enter') { const n = $('#coach .next'); if (!n.hidden) { e.preventDefault(); n.click(); return; } }
  const k = e.key.toLowerCase();
  if (k === 'i' || k === ' ') { e.preventDefault(); setInspect(!inspecting); }
  else if (k === 'r') book.hidden ? openBook() : closeBook();
  else if (k === 'escape') { closeBook(); setInspect(false); disarm(); }
  else if (k === '1' || k === '2' || k === '3') press(['orchard', 'stair', 'return'][+k - 1]);
});

// ---------------------------------------------------------------- the coach (tutorial and new-rule tips)
const coachEl = $('#coach');
let coach = null; // { steps, i }
const TUTORIAL = [
  { on: 'arrive', story: 'tut1', target: '#booth', text: 'Night shift at the Gate. The newly dead queue at your window, and you decide where each soul goes.', next: true },
  { target: '#papers', text: 'Each soul hands over papers: a SOUL CARD, a DEATH CERTIFICATE and a RECORD OF DEEDS.', next: true },
  { target: '#bRules', text: 'The regulations are in your rule book. Tap RULES.', wait: 'rulesOpen', allow: ['rules'] },
  { target: '#book .close', text: 'Rule 3 is the heart of the job: count the tallies on the RECORD OF DEEDS. Close the book when you have read it.', wait: 'rulesClose', allow: ['rules'], top: true },
  { target: '.paper.deeds', text: 'Amparo has 7 virtues and 3 vices, and her papers agree. Virtues win, so: the ORCHARD.', next: true },
  { target: '[data-dest=orchard]', text: 'Tap the ORCHARD stamp to lift it, then tap it again to bring it down.', wait: 'decide', allow: ['stamp:orchard'] },
  { on: 'arrive', story: 'tut2', target: '#bInspect', text: 'Papers must agree with each other. Tap INSPECT to compare details.', wait: 'inspectOn', allow: ['inspect'] },
  { target: '[data-f="card.name"]', text: "Tap the NAME on Benito's Soul Card...", wait: 'pick', allow: ['pick:card.name'] },
  { target: '[data-f="cert.name"]', text: '...then the NAME on his Death Certificate.', wait: 'discrepancy', allow: ['pick:cert.name'] },
  { target: '[data-dest=return]', text: 'Galindo, Galinda: a discrepancy. Faulty papers mean RETURN, whatever the tallies say. Stamp RETURN (tap it twice).', wait: 'decide', allow: ['stamp:return'] },
  { on: 'arrive', story: 'tut3', target: '#papers', text: 'This one is yours. Check the papers agree, count the tallies, then stamp.', next: true },
  { on: 'decided:tut3', text: 'A wrong call prints a CITATION. The first each night is a warning; after that each one costs 5 coins of your wages. Two more souls tonight, on your own.', next: true },
];
const TIPS = {
  2: [{ on: 'arrive', target: '#faceHit', text: 'New today: the photo on the Soul Card must match the face at the window. INSPECT, then tap the photo and the face.', next: true }],
  3: [{ on: 'arrive', target: '.paper.summons', text: 'New today: a SUMMONS. If the date of death is before the summons date, the soul is early. INSPECT the two dates to check.', next: true }],
  4: [{ on: 'arrive', target: '#bRules', text: 'The Mercy Amendment: from today, a tie between virtues and vices goes to the ORCHARD.', next: true }],
  5: [{ on: 'arrive', target: '#booth', text: 'New today: a cat at the window needs a CAT FORM with the right owner. Dogs pass freely.', next: true }],
  6: [{ on: 'arrive', target: '#faceHit', text: 'New today: the living sometimes wander in while they dream. Watch above the head for a silver cord, or INSPECT the face.', next: true }],
  7: [{ on: 'arrive', target: '#bRules', text: "New today: the certificate's seal must be TODAY'S SEAL. It's in the rule book. In INSPECT you can tap it there, then the certificate's seal.", next: true }],
};
function startCoach(steps) { coach = steps ? { steps, i: 0, shown: false } : null; hideCoach(); }
function curStep() { return coach && coach.steps[coach.i]; }
function allowed(action) {
  const st = curStep();
  if (!st || !coach.shown) return true;
  if (st.next) return false;
  return !st.allow || st.allow.includes(action);
}
function emit(ev, data) {
  if (AUTO) bot.on(ev, data);
  const st = curStep();
  if (!st) return;
  if (!coach.shown) {
    const match = st.on === 'arrive' ? ev === 'arrive' && (!st.story || st.story === data) : st.on === ev;
    if (match) showStep();
    return;
  }
  if (st.wait === ev) advance();
}
function advance() {
  hideCoach();
  coach.i++;
  const st = curStep();
  if (!st) { coach = null; return; }
  if (!st.on) later(st.wait === 'pick' || st.wait === 'discrepancy' ? 50 : 250, showStep);
  else coach.shown = false;
}
function showStep() {
  const st = curStep(); if (!st) return;
  coach.shown = true;
  coachEl.querySelector('p').textContent = st.text;
  const nx = coachEl.querySelector('.next');
  nx.hidden = !st.next; nx.onclick = () => { unlock(); advance(); };
  coachEl.hidden = false;
  placeCoach();
}
function hideCoach() { coachEl.hidden = true; document.querySelectorAll('.lit').forEach(n => n.classList.remove('lit')); }
function coachPulse() { if (!coachEl.hidden) { coachEl.classList.remove('shake'); void coachEl.offsetWidth; coachEl.classList.add('shake'); } }
function placeCoach() {
  const st = curStep(); if (!st || coachEl.hidden) return;
  document.querySelectorAll('.lit').forEach(n => n.classList.remove('lit'));
  const t = st.target && document.querySelector(st.target);
  const arrow = coachEl.querySelector('.arrow');
  const cw = coachEl.offsetWidth, ch = coachEl.offsetHeight;
  if (!t) { Object.assign(coachEl.style, { left: (innerWidth - cw) / 2 + 'px', top: (innerHeight - ch) / 2 + 'px' }); arrow.hidden = true; return; }
  if (t.id !== 'booth' && t.id !== 'papers') t.classList.add('lit');
  if (t.closest('#desk')) t.scrollIntoView({ block: 'nearest' });
  const r = t.getBoundingClientRect();
  const big = r.height > innerHeight * .3;
  let top, below;
  if (big) { top = Math.min(innerHeight - ch - 12, Math.max(12, r.top + 20)); below = null; }
  else if (st.top || r.top > innerHeight * .5) { top = r.top - ch - 16; below = false; }
  else { top = r.bottom + 16; below = true; }
  // no room above (a short screen): drop below rather than cover the target
  if (below === false && top < 8 && r.bottom + 16 + ch <= innerHeight - 8) { top = r.bottom + 16; below = true; }
  top = Math.max(8, Math.min(innerHeight - ch - 8, top));
  const left = Math.max(12, Math.min(innerWidth - cw - 12, r.left + r.width / 2 - cw / 2));
  Object.assign(coachEl.style, { left: left + 'px', top: top + 'px' });
  arrow.hidden = below === null;
  const ax = Math.max(14, Math.min(cw - 28, r.left + r.width / 2 - left - 7));
  Object.assign(arrow.style, below ? { left: ax + 'px', top: '-8px', bottom: '', transform: 'rotate(225deg)' } : { left: ax + 'px', bottom: '-8px', top: '', transform: 'rotate(45deg)' });
}
addEventListener('resize', () => placeCoach());

// ---------------------------------------------------------------- screens
const scr = $('#screen');
function showScreen(html) { scr.innerHTML = `<div class="inner">${html}</div>`; scr.hidden = false; scr.scrollTop = 0; hideCoach(); }
function hideScreen() { scr.hidden = true; }
function poster(face, h = 70) {
  const w = 120, cv = posterCanvas(face, w, h, 4);
  cv.className = 'poster';
  return cv;
}
const TITLE_FACE = { hat: 4, motif: 0, ring: 0, shirt: 1, mous: false, glasses: false, flower: false };

function showTitle() {
  screen = 'title';
  const saved = load();
  showScreen(`<div id="pst"></div>
    <h1 class="ptitle">CUSTOMS<br>OF THE <em>DEAD</em></h1>
    <p class="psub">Ten nights at the Gate. Check the papers of the newly dead, and stamp each soul up to the Orchard, down the Stair, or back where it came from.</p>
    ${saved && saved.day > 1 ? `<button class="btn" id="cont">CONTINUE &middot; DAY ${saved.day}</button><button class="btn alt" id="fresh">START OVER</button>` : `<button class="btn" id="fresh">TAKE THE JOB</button>`}
    <p class="small8" style="margin-top:18px">TOUCH OR MOUSE &middot; KEYS: I INSPECT &middot; R RULES &middot; 1 2 3 STAMPS</p>`);
  $('#pst').replaceWith(poster(TITLE_FACE, 80));
  $('#fresh').onclick = () => { unlock(); S = newGame(); store(); showMorning(); };
  if ($('#cont')) $('#cont').onclick = () => { unlock(); S = saved; showMorning(); };
}

function homeLetter() {
  const f = S.flags, fam = S.fam;
  if (S.day === 1) return 'They say you start work at the Gate tonight. We will light a candle for you every night that we can. Do not worry about us. Well. Worry a little. We need the wages.';
  if (f.letter) return f.letter;
  return pick(rng(S.seed + S.day), ['Beto drew you with a moustache. You never had one, but it suits you.', 'The marigolds on your altar are holding up. Abuela talks to your photo every morning.',
    'Your wages came. The landlord smiled, which was frightening.', 'We ate well tonight and saved you a tamal on the altar.']);
}

function showMorning() {
  screen = 'morning';
  D = null; updateHud();
  const day = S.day, newRules = RULES.filter(r => r.day === day);
  const memo = MEMOS[day];
  let html = `<div id="pst"></div><h2 class="ptitle">DAY ${day}<br><em>${fmtDate(day)}</em></h2>`;
  if (S.flags.fee) html += `<div class="card"><h3 class="ink"><span>DOCKED</span><span>-${S.flags.fee}</span></h3><div class="b"><p>"Administrative fee." Supervisor Ossa has not forgotten Mercedes.</p></div></div>`;
  if (newRules.length && day > 1) html += `<div class="card"><h3><span>NEW REGULATION</span><span>&#9632;</span></h3><div class="b">${newRules.map(r => `<p>${esc(r.text)}</p>`).join('')}</div></div>`;
  if (day >= 7) html += `<div class="card"><h3 class="ink"><span>TODAY'S SEAL</span><span>${sealOf(day, S.seed).toUpperCase()}</span></h3><div class="b" id="sealb"></div></div>`;
  html += `<div class="card"><h3 class="teal"><span>MEMO</span><span>FROM UPSTAIRS</span></h3><div class="b"><p>${esc(memo)}</p><p class="sign">A. Ossa, Supervisor</p></div></div>`;
  html += `<div class="card"><h3 class="violet"><span>A LETTER</span><span>FROM HOME</span></h3><div class="b"><p>${esc(homeLetter())}</p><p class="sign">Tere</p></div></div>`;
  if (day === 10) {
    html += `<div class="card"><h3 class="ink"><span>INSPECTOR HUESOS</span><span>THE BOARD</span></h3><div class="b"><p>"A short question, clerk, before you open the window. What do you know about red marigolds, and envelopes from upstairs?"</p></div></div>
      <button class="btn" id="truth">TELL HIM EVERYTHING</button><button class="btn alt" id="silent">SAY NOTHING</button>`;
  } else html += `<button class="btn" id="go">OPEN THE WINDOW</button>`;
  showScreen(html);
  $('#pst').replaceWith(poster({ hat: (day * 3) % 7, motif: day % 5, ring: day % 5, shirt: day % 6, mous: day % 3 === 0, glasses: day % 4 === 1, flower: day >= 7 && day <= 8 }, 54));
  if ($('#sealb')) { const c = sealCanvas(sealOf(day, S.seed), 4); c.style.imageRendering = 'pixelated'; $('#sealb').appendChild(c); }
  S.money -= S.flags.fee; S.flags.fee = 0; S.flags.letter = null;
  store();
  const begin = () => { unlock(); startCoach(AUTO ? null : day === 1 ? TUTORIAL : TIPS[day]); startShift(); };
  if (day === 10) {
    $('#truth').onclick = () => { S.flags.truth = true; begin(); };
    $('#silent').onclick = () => { S.flags.truth = false; begin(); };
  } else $('#go').onclick = begin;
}

// ---------------------------------------------------------------- nights: the ledger
function showNight() {
  screen = 'night';
  const day = S.day, f = S.flags, fam = S.fam;
  const earned = D.wages + D.extra - D.penalties;
  const start = S.money;
  let avail = start + earned;
  const anySick = FAMILY.some(m => fam[m.id].sick && !fam[m.id].gone);
  const items = [];
  if (!f.evicted) items.push(['rent', 'RENT']);
  items.push(['food', 'FOOD']);
  if (day >= 4 && !f.evicted) items.push(['heat', 'HEAT']);
  if (anySick) items.push(['medicine', 'MEDICINE']);
  items.push(['candle', 'A CANDLE']);
  const on = {};
  let left = avail;
  for (const [k] of items) if (left >= COSTS[k]) { on[k] = true; left -= COSTS[k]; }
  const famLine = m => {
    const st = fam[m.id];
    if (st.gone) return ['passed on', 'gone'];
    if (st.sick) return ['sick', 'sick'];
    if (st.hunger) return ['hungry', 'hungry'];
    return ['well', 'ok'];
  };
  const render = () => {
    const spend = items.reduce((a, [k]) => a + (on[k] ? COSTS[k] : 0), 0);
    showScreen(`<h2 class="ptitle">NIGHT ${day}<br><em>THE LEDGER</em></h2>
      <div class="card"><h3 class="ink"><span>WAGES</span><span>BOOTH 4</span></h3><div class="b lines">
        <span>Savings</span><span>${start}</span>
        <span>${D.correct} correct of ${D.processed} souls &times; ${WAGE}</span><span class="pos">+${D.wages}</span>
        ${D.extra ? `<span>Coins of uncertain origin</span><span class="pos">+${D.extra}</span>` : ''}
        <span>${D.citations} citation${D.citations === 1 ? '' : 's'}${D.citations ? ' (first is a warning)' : ''}</span><span class="neg">${D.penalties ? '-' + D.penalties : '0'}</span>
        ${D.processed < D.queue.length ? `<span class="small8" style="grid-column:1/-1">${D.queue.length - D.processed} SOULS LEFT IN THE QUEUE WHEN THE BELL RANG</span>` : ''}
        <span class="tot">To spend</span><span class="tot">${avail}</span></div></div>
      <div class="card"><h3><span>SEND HOME</span><span>${avail - spend} LEFT</span></h3><div class="b"><div class="pay">
        ${items.map(([k, n]) => `<button data-k="${k}" class="${on[k] ? 'on' : ''}" ${!on[k] && avail - spend < COSTS[k] ? 'disabled' : ''}><span><i class="bx"></i>${n}</span><span>${COSTS[k]}</span></button>`).join('')}
      </div></div></div>
      <div class="card"><h3 class="violet"><span>THE FAMILY</span><span>${f.evicted ? 'AT THE COUSINS' : 'AT HOME'}</span></h3><div class="b fam">
        ${FAMILY.map(m => { const [t, c] = famLine(m); return `<div><span>${m.name}, ${m.who}</span><span class="st-${c}">${t}</span></div>`; }).join('')}
      </div></div>
      <button class="btn" id="sleep">${day === 10 ? 'CLOSE THE BOOTH FOR GOOD' : 'CLOSE THE BOOTH'}</button>`);
    scr.querySelectorAll('.pay button').forEach(b => b.onclick = () => { on[b.dataset.k] = !on[b.dataset.k]; sfx.pick(); render(); });
    $('#sleep').onclick = () => { unlock(); night(on, avail - spend); };
  };
  render();
  if (AUTO) later(800, () => $('#sleep')?.click());
}

function night(on, left) {
  const day = S.day, f = S.flags, fam = S.fam;
  S.money = left;
  let letter = null;
  if (!f.evicted) {
    if (on.rent) f.rentMissed = 0; else if (++f.rentMissed >= 2) { f.evicted = true; letter = 'The landlord put us out this morning. We are going to the cousins in Tres Cruces. Do not worry, there is room in the goat shed.'; }
    else letter = 'The landlord came by about the rent. I told him you are dead. He said that is no excuse.';
  }
  const live = FAMILY.filter(m => !fam[m.id].gone);
  for (const m of live) { const st = fam[m.id]; if (on.food) st.hunger = 0; else if (++st.hunger >= 2) st.sick = true; }
  if (!on.food && !letter) letter = 'There was no bread yesterday. Beto asks why, and I tell him you are working on it.';
  if (day >= 4 && !f.evicted && !on.heat) {
    const m = live.find(m => m.id === 'cuca') || live[0];
    if (m) { fam[m.id].sick = true; letter ||= `It was so cold last night. ${m.name} has a fever.`; }
  }
  if (on.medicine) for (const m of live) { fam[m.id].sick = false; fam[m.id].sickN = 0; }
  else for (const m of live) if (fam[m.id].sick) {
    fam[m.id].sickN++;
    if (m.id === 'cuca' && fam.cuca.sickN >= 2 && day < 10) {
      fam.cuca.gone = true; fam.cuca.sick = false; f.cucaArrives = day + 1;
      letter = 'Abuela Cuca slipped away in the night, smiling. She said to tell you she would come and find you.';
    } else letter ||= `${m.name} is still sick. The doctor wants ${COSTS.medicine} coins.`;
  }
  if (on.candle) f.candles++;
  else letter ||= 'We could not afford a candle for you last night. I am sorry. We said your name instead.';
  f.candleLast = !!on.candle;
  if (day === 9 && f.ossaRefused) f.fee = 10;
  f.letter = letter;
  S.day++;
  if (S.day > 10) return showEnding();
  store();
  showMorning();
}

// ---------------------------------------------------------------- endings
function showEnding() {
  screen = 'ending';
  const f = S.flags;
  const involved = f.cousins > 0 || f.ossa || f.bribes > 0;
  const key = f.truth ? (involved ? 'confessed' : 'promoted') : (involved ? 'ossa' : 'same');
  const E = ENDINGS[key];
  const fam = [];
  if (f.evicted) fam.push('Your family lost the house in the second week, and lives with the cousins in Tres Cruces. They are crowded, and alive.');
  else fam.push('Your family kept the house. Tere sweeps your altar every Sunday.');
  if (f.candles < 5) fam.push('Few candles were lit for you this month. Already your face is fading from the photographs.');
  else fam.push('A candle burns for you most nights. Beto has drawn you a terrible, perfect portrait.');
  if (S.fam.cuca.gone) fam.push(f.cucaDest === 'orchard' ? 'Abuela Cuca waits for you under the orange trees.' : f.cucaDest === 'stair' ? 'You sent Abuela Cuca down the Stair. She has forgiven you. Mostly.' : 'Abuela Cuca is somewhere in the queue still, telling everyone about you.');
  const acc = S.stats.processed ? Math.round(100 * S.stats.correct / S.stats.processed) : 0;
  showScreen(`<div id="pst"></div><h2 class="ptitle">THE END<br><em>${E.title}</em></h2>
    <div class="card"><h3 class="ink"><span>THE REPORT</span><span>DAY 10</span></h3><div class="b"><p>${esc(E.text)}</p></div></div>
    <div class="card"><h3 class="violet"><span>ON EARTH</span><span>THE FAMILY</span></h3><div class="b">${fam.map(t => `<p>${esc(t)}</p>`).join('')}</div></div>
    <div class="card"><div class="b stats"><div><b>${S.stats.processed}</b><span class="small8">SOULS</span></div><div><b>${acc}%</b><span class="small8">BY THE BOOK</span></div><div><b>${S.money}</b><span class="small8">COINS LEFT</span></div></div></div>
    <p class="small8">FOUR ENDINGS DEPEND ON WHAT YOU TOOK AND WHAT YOU TOLD. THE FAMILY'S FATE IS YOURS TOO.</p>
    <button class="btn" id="again">TAKE THE JOB AGAIN</button>`);
  $('#pst').replaceWith(poster({ hat: key === 'ossa' ? 3 : key === 'promoted' ? 4 : 0, motif: 0, ring: key === 'confessed' ? 3 : 0, shirt: 1, mous: false, glasses: false, flower: key === 'ossa' }, 70));
  try { localStorage.removeItem(KEY); } catch {}
  $('#again').onclick = () => { S = newGame(); store(); showMorning(); };
}

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  step(dt * 1000 * SPEED, now, dt);
  requestAnimationFrame(frame);
}
function step(ms, now = performance.now(), dt = ms / 1000) {
  gameT += ms;
  for (let i = 0; i < timers.length; i++) if (timers[i].at <= gameT) { const t = timers.splice(i--, 1)[0]; try { t.fn(); } catch (e) { console.error(e); } }
  if (screen === 'shift' && D && D.time && !(coach && coach.shown)) {
    D.clock -= ms / 1000;
    if (D.clock <= 0) { D.clock = 0; endShift('time'); }
  }
  if (screen === 'shift' || screen === 'closing') updateHud();
  booth.draw(now, dt);
}

// ---------------------------------------------------------------- bot (for ?autoplay)
const bot = {
  corrupt: Q.get('bot') === 'corrupt', sloppy: +Q.get('sloppy') || 0,
  on(ev, data) {
    if (ev === 'arrive') later(500, () => this.play());
  },
  play() {
    if (screen !== 'shift' || D.state !== 'serve') return;
    const s = D.soul;
    if (s.bribe && this.corrupt) $('.coins')?.click();
    let dest = expected(s, S.day);
    if (this.corrupt && (s.story === 'cousin' || s.story === 'mercedes')) dest = 'orchard';
    if (R() < this.sloppy) dest = pick(R, ['orchard', 'stair', 'return']);
    // show off the inspect for the first fault
    const bad = Object.keys(s.bad)[0];
    if (bad) {
      const other = { 'card.photo': 'window.face', 'summons.appt': 'card.died', 'cert.seal': null, 'catform.owner': 'card.name' }[bad] ?? bad.replace(/^\w+/, 'card');
      if (other && other !== bad) {
        setInspect(true);
        const a = document.querySelector(`[data-f="${bad}"]`), b = document.querySelector(`[data-f="${other}"]`);
        if (a && b) { pickField(bad, a); pickField(other, b); }
      }
    }
    later(500, () => { press(dest); later(200, () => press(dest)); });
  },
};
function skipCoach() { if (coach && coach.shown) { const st = curStep(); if (st.next) advance(); } }

// ---------------------------------------------------------------- start
layout();
requestAnimationFrame(frame);
window.toyboxReady?.();
if (DEBUG) window.cod = { get S() { return S; }, get D() { return D; }, step, decide, press, pickField, setInspect, openBook, closeBook, showNight, skipCoach, get screen() { return screen; }, get coach() { return coach; },
  jump(d, seed = 5) { S = newGame(seed); S.day = d; showMorning(); }, nextSoul, showMorning };

if (DEMO) {
  // A mid-shift moment on night 3: a faulty photo caught with the red thread, the RETURN stamp lifted.
  S = newGame(20261101); S.day = 3; S.money = 34;
  startShift();
  D.queue.sort((a, b) => (b.issues[0] === 'photo') - (a.issues[0] === 'photo'));
  if (D.queue[0].issues[0] !== 'photo') { const s = D.queue[0]; s.issues = ['photo']; s.docs.card.photo = { ...s.face, hat: (s.face.hat + 3) % 7 }; s.bad = { 'card.photo': 'photo' }; }
  D.clock = D.time * .62;
  step(950); step(1000);
  booth.mode = 'idle';
  setTimeout(() => {
    setInspect(true);
    pickField('card.photo', document.querySelector('[data-f="card.photo"]'));
    pickField('window.face', faceHit);
    press('return');
  }, 700);
} else if (AUTO) {
  S = newGame(+Q.get('seed') || 1);
  bot.truth = Q.get('truth') !== '0';
  const auto = setInterval(() => {
    skipCoach();
    if (screen === 'morning') { const b = $('#go') || (bot.truth ? $('#truth') : $('#silent')); b?.click(); }
    if (screen === 'shift' && !book.hidden) closeBook();
    if (screen === 'ending') clearInterval(auto);
  }, 300);
  showMorning();
} else showTitle();
