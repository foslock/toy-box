// Liar's Table: the room, the turns, the reveal, the lesson.
import { Game, CHARACTERS, TABLES, decide, tellShows, thinkTime, line, bidText, faceWord, NUM, cap, Book, READ_TEXT } from './game.js';
import { BUSTS, die, cup, lamp, rays } from './art.js';
import { Sound } from './sound.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug');
const SPEED = +(Q.get('speed') || 1);
const $ = s => document.querySelector(s);
const rand = Math.random;

// ---- saved between visits
const KEY = 'liars-table.v1';
const save = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
save.beaten ??= 0; save.book ??= []; save.thinks ??= []; save.noticed ??= {}; save.seen ??= {}; save.sound ??= true; save.lesson ??= false;
const persist = () => { if (DEMO) return; try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} };
const book = new Book(save.book);
const median = () => {
  const t = save.thinks;
  if (t.length < 3) return 3.2;
  const s = t.slice().sort((a, b) => a - b);
  return s[s.length >> 1];
};

const sound = new Sound();
sound.on = save.sound;

// ---- flow control: everything async goes through these, so leaving a table cancels cleanly
const ABORT = Symbol('abort');
let session = 0;
let pending = null; // { resolve, reject } for whatever the flow is waiting on (your move, a coach step, next round)
const sleep = ms => { const s = session; return new Promise((res, rej) => setTimeout(() => (s === session ? res() : rej(ABORT)), ms / SPEED)); };
const waitFor = () => new Promise((resolve, reject) => { pending = { resolve: v => { pending = null; resolve(v); }, reject }; });
function abort() { session++; if (pending) { const p = pending; pending = null; p.reject(ABORT); } }

// ---- state
let G = null, table = null, lesson = false;
let seatEls = [];
let sel = { q: 1, f: 1 }, lock = null, myTurn = false, turnStart = 0, turnPaused = false;
const nameOf = i => (i === 0 ? 'You' : CHARACTERS[G.players[i].key].name);
const fullOf = i => (i === 0 ? 'You' : CHARACTERS[G.players[i].key].full);

// ---- the lamp and its light
let W = innerWidth, H = innerHeight, LX = W / 2, swingAmp = 2.2, swingTarget = 2.2;
function drawRoom() {
  W = innerWidth; H = innerHeight;
  const svg = $('#rays');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const seats = $('#seats').getBoundingClientRect();
  // on a wide screen the lamp hangs in view above the far side of the table; on a phone (or a short landscape one) it's just off the top
  const wide = W >= 700 && H >= 520;
  const lx = LX = seats.width ? seats.left + seats.width / 2 : W / 2, ly = wide ? Math.min(40, seats.top - 62) : -70;
  $('#swing').innerHTML = rays(lx, ly + 56, H * 1.15) + (wide ? lamp(lx, ly) : '');
  const top = seats.height ? seats.bottom - seats.height * 0.2 : H * 0.42;
  document.documentElement.style.setProperty('--tabletop', `${Math.round(top)}px`);
}
let lastCreak = 0;
function frame(t) {
  swingAmp += (swingTarget - swingAmp) * 0.02;
  const a = Math.sin(t / 1000 * 1.25) * swingAmp;
  $('#swing').setAttribute('transform', `rotate(${a.toFixed(3)} ${LX} ${-320})`);
  if (swingAmp > 3 && t - lastCreak > 2400 && Math.abs(a) > swingAmp * 0.97) { lastCreak = t; sound.creak(); }
  requestAnimationFrame(frame);
}

// ---- building the table
const EYE = `<svg class="eye" viewBox="0 0 24 14" aria-label="has a read on you"><path d="M1 7Q12 -3 23 7Q12 17 1 7Z" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="7" r="3.4" fill="currentColor"/></svg>`;
function buildSeats() {
  const host = $('#seats');
  host.innerHTML = '';
  seatEls = [null];
  for (let i = 1; i < G.players.length; i++) {
    const key = G.players[i].key;
    const el = document.createElement('div');
    el.className = 'seat';
    el.dataset.i = i;
    el.innerHTML = `<div class="bubble"></div><div class="bust">${BUSTS[key]()}</div>
      <div class="cuprow"><div class="dice"></div><div class="cup">${cup()}</div></div>
      <div class="plate">${EYE}<b>${CHARACTERS[key].name}</b><span class="count"></span></div>`;
    host.appendChild(el);
    seatEls.push(el);
  }
  $('.mycup').innerHTML = cup();
  renderAll();
  requestAnimationFrame(drawRoom);
}
function pipsHtml(n, max) { let s = ''; for (let k = 0; k < max; k++) s += `<i class="${k < n ? '' : 'gone'}"></i>`; return s; }
function renderSeat(i) {
  const p = G.players[i], el = seatEls[i];
  el.classList.toggle('out', p.out);
  el.classList.toggle('turn', G.turn === i && !p.out && phase === 'bidding');
  el.querySelector('.count').innerHTML = pipsHtml(p.n, maxDice);
  el.classList.toggle('reads', !lesson && reading(p.key).length > 0);
}
function renderMine() {
  const p = G.players[0];
  $('#mine .dice').innerHTML = p.dice.map(d => die(d)).join('');
  $('#mine .youcount').innerHTML = pipsHtml(p.n, maxDice);
}
function renderCard() {
  const b = G.bid, total = G.total();
  if (!b) {
    $('#cardWho').textContent = phase === 'bidding' ? `${G.turn === 0 ? 'Your' : nameOf(G.turn) + '’s'} opening bid` : 'Liar’s dice';
    $('#cardBid').innerHTML = '<b>—</b>';
    $('#cardSub').textContent = `${NUM[total]} dice on the table`;
  } else {
    $('#cardWho').textContent = b.by === 0 ? 'You bid' : `${nameOf(b.by)} bids`;
    $('#cardBid').innerHTML = `<b>${NUM[b.q]}</b>${die(b.f)}`;
    $('#cardSub').textContent = `at least ${bidText(b.q, b.f)}, of ${NUM[total]} dice`;
  }
}
function renderLog(revealed = false) {
  const h = G.history.slice(-5);
  $('#log').innerHTML = h.map(e => `<li><span class="who">${nameOf(e.by)}</span> ${bidText(e.q, e.f)}${revealed && e.bluff ? ` <span class="none">held none</span>` : ''}</li>`).join('');
}
function renderControls() {
  const c = $('#controls');
  c.classList.toggle('wait', !myTurn);
  if (!G) return;
  const mine = G.players[0].dice;
  const total = G.total();
  const fb = $('#faces').children;
  for (let f = 1; f <= 6; f++) {
    const b = fb[f - 1];
    b.setAttribute('aria-pressed', String(sel.f === f));
    const held = mine.filter(d => d === f).length;
    b.querySelector('.held').textContent = held;
    b.querySelector('.held').hidden = !held;
    b.disabled = (lock && (lock === 'liar' || lock.f !== f)) || G.minFor(f) > total;
  }
  $('#qWord').textContent = NUM[sel.q];
  const min = G.minFor(sel.f);
  $('#qMinus').disabled = !!lock || sel.q <= min;
  $('#qPlus').disabled = !!lock || sel.q >= total;
  const valid = G.isRaise(sel.q, sel.f);
  $('#bidBtn').innerHTML = `Bid ${NUM[sel.q]} ${die(sel.f)}<kbd>↵</kbd>`;
  $('#bidBtn').disabled = !valid || lock === 'liar';
  $('#liarBtn').disabled = !G.bid || (lock && lock !== 'liar');
}
function renderAll() {
  for (let i = 1; i < G.players.length; i++) renderSeat(i);
  renderMine();
  renderCard();
  renderControls();
}
let phase = 'idle', maxDice = 4;

// what the regulars currently have on you
function reading(key) {
  const ch = CHARACTERS[key];
  if (!ch.watches.length) return [];
  return book.tells(ch.watches).map(t => t.key);
}

// ---- speech
const bubbleTimers = new Map();
function say(i, text, cls = '', ms = 2600) {
  if (i === 0) return;
  const el = seatEls[i], b = el.querySelector('.bubble');
  b.className = `bubble on ${cls}`;
  b.textContent = text;
  clearTimeout(bubbleTimers.get(i));
  if (cls !== 'think') {
    el.classList.add('talk');
    setTimeout(() => el.classList.remove('talk'), Math.min(1400, 120 + text.length * 45));
  }
  if (ms) bubbleTimers.set(i, setTimeout(() => b.classList.remove('on'), ms / SPEED));
}
function hush(i) { if (i > 0) seatEls[i].querySelector('.bubble').classList.remove('on'); }

// ---- tells, and fidgets that look like tells
const TELL_MS = { sweat: 2100, tap: 1400, glance: 1100, quick: 0 };
function doTell(i, kind) {
  const el = seatEls[i];
  if (kind === 'quick') return;
  el.classList.remove(`t-${kind}`);
  void el.offsetWidth;
  el.classList.add(`t-${kind}`);
  if (kind === 'tap') for (let k = 0; k < 4; k++) setTimeout(() => sound.tap(), (k * 340 + 170) / SPEED);
  setTimeout(() => el.classList.remove(`t-${kind}`), TELL_MS[kind] / SPEED + 50);
}
const FIDGETS = { pip: 'fidget', sallow: 'lick', morrow: 'look', widow: null };
function fidget(i) {
  const f = FIDGETS[G.players[i].key];
  if (!f) return;
  const el = seatEls[i];
  el.classList.add(f);
  setTimeout(() => el.classList.remove(f), 1100 / SPEED);
}

// ---- a round
async function rollDice(rigged) {
  phase = 'rolling';
  G.roll(rigged);
  $('#verdict').hidden = true;
  $('#notice').hidden = true;
  $('#stamp').classList.remove('on');
  $('#tally').classList.remove('on');
  $('#mine').classList.add('hidden');
  $('#nextBtn').hidden = true;
  $('#controls').hidden = false;
  for (let i = 1; i < G.players.length; i++) {
    seatEls[i].querySelector('.cuprow').classList.remove('lifted');
    seatEls[i].querySelector('.dice').innerHTML = '';
  }
  renderAll();
  renderLog();
  swingTarget = 2.2;
  const cups = [...document.querySelectorAll('.seat:not(.out) .cup, .mycup')];
  cups.forEach(c => c.classList.add('shake'));
  sound.rattle(0.75);
  await sleep(800);
  cups.forEach(c => c.classList.remove('shake'));
  sound.slam();
  await sleep(320);
  $('#mine').classList.remove('hidden');
  renderMine();
  await sleep(350);
}

async function playRound(script) {
  await rollDice(script?.dice);
  phase = 'bidding';
  for (let guard = 0; guard < 120; guard++) {
    renderAll();
    const i = G.turn;
    const act = i === 0 ? await humanTurn(script) : await aiTurn(i, script);
    if (act.call) {
      const res = G.call(i);
      return reveal(res, script);
    }
  }
}

async function aiTurn(i, script) {
  const p = G.players[i], ch = CHARACTERS[p.key];
  let act = script?.ai?.shift() || decide(G, i, ch, rand, { human: 0, book, median: median() });
  if (!act.call && act.q && !G.isRaise(act.q, act.f)) act = decide(G, i, ch, rand, { human: 0, book, median: median() });
  if (!act.call) act.bluff = !p.dice.includes(act.f);
  let think = act.call ? 1.1 + rand() * 1.3 : thinkTime(ch, act.bluff, rand);
  const tell = act.tell ?? (!act.call && !lesson && tellShows(ch, act.bluff, table.soften, rand));
  if (tell) think = Math.max(think, 0.35 + TELL_MS[ch.tell] / 1000 * 0.85);
  say(i, '· · ·', 'think', 0);
  const s = session; // leaving the table mid-think must not fire these on the next table's seats
  if (tell) setTimeout(() => s === session && doTell(i, ch.tell), 320 / SPEED);
  else if (rand() < 0.3 && !lesson) setTimeout(() => s === session && fidget(i), (200 + rand() * think * 600) / SPEED);
  await sleep(think * 1000 * (lesson ? 1.25 : 1));
  if (act.call) {
    say(i, line(ch, 'call', null, null, rand), 'call', 3000);
    return { call: true };
  }
  const first = !G.bid;
  G.place(i, act.q, act.f, { think, tell });
  say(i, line(ch, first ? 'open' : 'raise', act.q, act.f, rand), '', 2400);
  sound.bid();
  $('#card').classList.remove('bump'); void $('#card').offsetWidth; $('#card').classList.add('bump');
  renderAll();
  renderLog();
  await sleep(lesson ? 700 : 950);
  return {};
}

function pickDefault() {
  const mine = G.players[0].dice;
  if (lock && lock !== 'liar') { sel = { q: lock.q, f: lock.f }; return; }
  if (!G.bid) {
    let f = 1, best = -1;
    for (let k = 1; k <= 6; k++) { const n = mine.filter(d => d === k).length; if (n >= best) { best = n; f = k; } }
    sel = { f, q: Math.max(1, best) };
  } else {
    const f = G.bid.f;
    sel = { f, q: G.minFor(f) };
    if (G.minFor(f) > G.total()) {
      for (let k = 1; k <= 6; k++) if (G.minFor(k) <= G.total()) { sel = { f: k, q: G.minFor(k) }; break; }
    }
  }
}

async function humanTurn(script) {
  if (script?.beforeYou) await script.beforeYou.shift()?.();
  pickDefault();
  myTurn = true;
  turnPaused = false;
  turnStart = performance.now();
  renderAll();
  const act = await waitFor();
  myTurn = false;
  if (act.call) {
    sound.liar();
    renderControls();
    return { call: true };
  }
  const think = turnPaused ? null : (performance.now() - turnStart) / 1000 * SPEED;
  G.place(0, act.q, act.f, { think: think ?? median() });
  if (think != null) { save.thinks.push(think); if (save.thinks.length > 40) save.thinks.shift(); }
  sound.bid();
  $('#card').classList.remove('bump'); void $('#card').offsetWidth; $('#card').classList.add('bump');
  renderAll();
  renderLog();
  await sleep(500);
  return {};
}

async function reveal(res, script) {
  phase = 'reveal';
  renderAll();
  const b = res.bid;
  $('#stamp').classList.add('on');
  swingTarget = 6.5;
  sound.liar();
  await sleep(1100);
  // the cups come up one by one
  for (let i = 1; i < G.players.length; i++) {
    if (G.players[i].out) continue;
    const row = seatEls[i].querySelector('.cuprow');
    row.querySelector('.dice').innerHTML = G.players[i].dice.map(d => die(d)).join('');
    row.classList.add('lifted');
    sound.lift();
    await sleep(420);
  }
  await sleep(450);
  // count them out loud
  const tally = $('#tally');
  tally.textContent = '0';
  tally.classList.add('on');
  let n = 0;
  const groups = [$('#mine .dice'), ...seatEls.slice(1).map(el => el.querySelector('.cuprow .dice'))];
  for (const [gi, grp] of groups.entries()) {
    if (G.players[gi].out) continue;
    for (const [k, el] of [...grp.children].entries()) {
      if (G.players[gi].dice[k] === b.f) {
        n++;
        el.classList.add('hit', 'pop');
        tally.textContent = n;
        tally.classList.remove('tick'); void tally.offsetWidth; tally.classList.add('tick');
        sound.tick(n);
        await sleep(n >= b.q - 1 ? 520 : 340);
      } else el.classList.add('miss');
    }
  }
  await sleep(500);
  // the verdict
  const bidder = b.by, caller = res.caller;
  const countText = res.count === 0 ? `Not one ${FACE_SINGLE(b.f)}.` : res.lied ? `Only ${NUM[res.count]} ${faceWord(res.count, b.f)}.` : `${cap(NUM[res.count])} ${faceWord(res.count, b.f)}.`;
  const bluffed = G.history[G.history.length - 1].bluff;
  const blame = res.lied ? (bidder === 0 ? (bluffed ? 'You were bluffing.' : 'You bid too high.') : `${nameOf(bidder)} ${bluffed ? 'was bluffing' : 'bid too high'}.`) : (bidder === 0 ? 'Your bid was good.' : `${nameOf(bidder)} told the truth.`);
  const loser = res.loser;
  $('#verdict').innerHTML = `${countText} <span class="r">${blame}</span>`;
  $('#verdict').hidden = false;
  renderLog(true);
  swingTarget = 2.2;
  await sleep(700);
  // a die is lost
  const wasOut = G.settle(res);
  for (const h of G.history) {
    if (h.by === 0) book.add(h, median());
    else {
      const k = G.players[h.by].key;
      const s = (save.seen[k] ??= { bids: 0, bluffs: 0 });
      s.bids++; s.bluffs += h.bluff ? 1 : 0;
    }
  }
  save.book = book.obs;
  if (loser === 0) {
    sound.lose();
    const winner = res.lied ? caller : bidder;
    if (winner > 0) say(winner, line(CHARACTERS[G.players[winner].key], 'win', null, null, rand), '', 2600);
    const d = $('#mine .dice').children;
    d[d.length - 1]?.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(40px) rotate(40deg)', opacity: 0 }], { duration: 600 / SPEED, fill: 'forwards' });
  } else {
    sound.gain();
    const ch = CHARACTERS[G.players[loser].key];
    say(loser, line(ch, wasOut ? 'out' : 'lose', null, null, rand), '', 3000);
    const d = seatEls[loser].querySelector('.cuprow .dice').children;
    d[d.length - 1]?.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(30px) rotate(-40deg)', opacity: 0 }], { duration: 600 / SPEED, fill: 'forwards' });
  }
  await sleep(500);
  for (let i = 1; i < G.players.length; i++) renderSeat(i);
  $('#mine .youcount').innerHTML = pipsHtml(G.players[0].n, maxDice);
  // what the room has noticed about you
  if (!lesson) {
    const fresh = [];
    for (let i = 1; i < G.players.length; i++) {
      const key = G.players[i].key;
      const known = (save.noticed[key] ??= []);
      for (const r of reading(key)) if (!known.includes(r)) { known.push(r); fresh.push([key, r]); }
    }
    if (fresh.length) {
      const [key, r] = fresh[0];
      $('#notice').innerHTML = `<b>${CHARACTERS[key].full}</b> has noticed: ${READ_TEXT[r]}.`;
      $('#notice').hidden = false;
      $('#notesBtn').classList.add('fresh');
    }
  }
  persist();
  phase = 'after';
  if (script?.afterReveal) return script.afterReveal();
  // wait for the player, unless the game is over
  if (G.players[0].out || G.winner() >= 0) { await sleep(1600); return; }
  $('#controls').hidden = true;
  $('#nextBtn').hidden = false;
  await waitFor();
  $('#nextBtn').hidden = true;
}
const FACE_SINGLE = f => ['', 'one', 'two', 'three', 'four', 'five', 'six'][f];

// ---- a whole table
async function playTable(idx) {
  abort();
  lesson = false;
  table = TABLES[idx];
  G = new Game(['you', ...table.seats]);
  G.starter = Math.floor(rand() * G.players.length);
  maxDice = 4;
  hideScreen();
  setWhere(table.name, `Table ${['I', 'II', 'III'][idx]} of III`);
  buildSeats();
  try {
    while (!G.players[0].out && G.winner() < 0) await playRound();
    phase = 'over';
    if (G.players[0].out) { sound.out(); showLost(idx); }
    else { sound.win(); save.beaten = Math.max(save.beaten, idx + 1); persist(); showWon(idx); }
  } catch (e) { if (e !== ABORT) throw e; }
}

function setWhere(name, sub) {
  $('#where b').textContent = name;
  $('#where small').textContent = sub;
}

// ---- the lesson: one scripted round against Pip
function coach(html, target, opts = {}) {
  const box = $('#coach');
  document.querySelectorAll('.ring').forEach(e => e.classList.remove('ring'));
  const t = target && $(target);
  if (t) t.classList.add('ring');
  box.innerHTML = `<p>${html}</p>${opts.wait ? '' : `<div class="go"><button id="coachGo">${opts.next || 'Next'}</button></div>`}`;
  box.hidden = false;
  box.style.top = box.style.bottom = '';
  const place = () => {
    const a = opts.anchor ? $(opts.anchor) : t;
    const r = a ? a.getBoundingClientRect() : { top: H * 0.4, bottom: H * 0.4 };
    const bh = box.offsetHeight;
    if (r.top + (r.bottom - r.top) / 2 > innerHeight * 0.5) box.style.top = `${Math.max(8, r.top - bh - 18)}px`;
    else box.style.top = `${Math.min(innerHeight - bh - 8, r.bottom + 18)}px`;
  };
  place();
  if (opts.wait) return Promise.resolve();
  const p = waitFor();
  $('#coachGo').onclick = () => { sound.init(); pending?.resolve(); };
  $('#coachGo').focus({ preventScroll: true });
  return p.finally(() => { box.hidden = true; t?.classList.remove('ring'); });
}
function uncoach() { $('#coach').hidden = true; document.querySelectorAll('.ring').forEach(e => e.classList.remove('ring')); }

async function playLesson() {
  abort();
  lesson = true;
  table = { name: 'The Lesson', seats: ['pip'], soften: 1 };
  G = new Game(['you', 'pip']);
  G.starter = 1;
  maxDice = 4;
  hideScreen();
  setWhere('The Lesson', 'One round with Pip');
  buildSeats();
  const script = {
    dice: [[2, 5, 5, 6], [1, 3, 3, 5]],
    ai: [{ q: 2, f: 5, tell: false }, { q: 3, f: 6, tell: true }],
    beforeYou: [
      async () => {
        await coach('Pip opens: <b>“two fives.”</b> A bid is a claim about <b>every</b> die on the table, his and yours together: there are at least two fives under the cups.', '#card');
        lock = { q: 3, f: 5 };
        await coach('You hold two fives yourself, so Pip’s bid is already true. Raise it. A raise is <b>more dice</b>, or <b>the same number of a higher face</b>. Bid <b>three fives</b>.', '#bidBtn', { wait: true, anchor: '#mine' });
      },
      async () => {
        await coach('Did you see that? <b>Pip broke into a sweat.</b> That’s his tell. He sweats when he bids a face he doesn’t hold.', '.seat[data-i="1"] .bust');
        lock = 'liar';
        await coach('He bid <b>three sixes</b>. You hold one six, and if Pip has none there can’t be three. <span class="r">Call him a liar.</span>', '#liarBtn', { wait: true, anchor: '#mine' });
      },
    ],
    afterReveal: async () => {
      await coach('Only one six. Pip was bluffing, so <b>Pip loses a die</b>. Had his bid been true, <b>you</b> would have lost one instead.', '#verdict');
      await coach('The last player with dice wins the table. Every regular has a tell like Pip’s, some much harder to spot. And they’re all studying yours: how long you take, how far you raise, when you switch faces. Your notes are under this page icon.', '#notesBtn', { next: 'To the Back Room' });
    },
  };
  try {
    await sleep(300);
    const first = coach('Liar’s dice. Everyone shakes four dice in a cup, slams it down, and peeks only at their own.', null, { next: 'Roll' });
    await first;
    await rollDice(script.dice);
    await coach('These four are yours. Pip can\u2019t see them, and you can\u2019t see his. You have <b>two fives</b>, a two and a six.', '#mine');
    phase = 'bidding';
    script.dice = null;
    // play the scripted round
    for (let guard = 0; guard < 6; guard++) {
      renderAll();
      const i = G.turn;
      const act = i === 0 ? await humanTurn(script) : await aiTurn(i, script);
      uncoach();
      if (act.call) { lock = null; await reveal(G.call(i), script); break; }
      if (i === 0) lock = null;
    }
    lesson = false;
    save.lesson = true;
    persist();
    showIntro(0);
  } catch (e) { if (e !== ABORT) throw e; } finally { lock = null; uncoach(); }
}

// ---- screens
function showScreen(html, solid = false) {
  const s = $('#screen');
  s.innerHTML = html;
  s.hidden = false;
  s.classList.toggle('solid', solid);
  s.scrollTop = 0;
  if (myTurn) turnPaused = true;
  s.querySelector('.btn, .tablebtn:not(:disabled), .x')?.focus({ preventScroll: true });
}
function hideScreen() { $('#screen').hidden = true; }
const mini = key => BUSTS[key]();

function showTitle() {
  abort();
  phase = 'idle';
  myTurn = false;
  setWhere('Liar’s Table', 'The Lamp & Anchor');
  const tbl = TABLES.map((t, i) => `<button class="tablebtn ${save.beaten > i ? 'done' : ''}" data-table="${i}" ${i > save.beaten ? 'disabled' : ''}>
      <span class="num">${['I', 'II', 'III'][i]}</span><span><b>${t.name}</b><small>${i > save.beaten ? 'Win the table above to sit here' : t.seats.map(k => CHARACTERS[k].full).join(', ')}</small></span>
      <span class="faces-mini">${t.seats.map(mini).join('')}</span></button>`).join('');
  showScreen(`<div class="sheet">
    <h1>Liar’s Table</h1>
    <p class="lede">Liar’s dice in the back rooms of the Lamp & Anchor. Every regular has a tell, and every regular is watching for yours.</p>
    <div class="faces-row">${['pip', 'sallow', 'morrow', 'widow'].map(mini).join('')}</div>
    <hr class="rule">
    ${save.lesson ? '' : `<div class="btns" style="margin-top:0"><button class="btn red" data-act="lesson">Learn at Pip’s table</button></div>`}
    <div class="tables">${tbl}</div>
    <p class="tiny" style="margin-top:14px">${save.lesson ? '<button class="linkish" data-act="lesson">Replay the lesson</button> · ' : ''}<button class="linkish" data-act="rules">How to play</button></p>
  </div>`);
}

function showIntro(idx) {
  abort();
  const t = TABLES[idx];
  const right = CHARACTERS[t.seats[t.seats.length - 1]];
  setWhere(t.name, `Table ${['I', 'II', 'III'][idx]} of III`);
  showScreen(`<div class="sheet">
    <h2>${t.name}</h2>
    <p class="lede">${t.note}</p>
    <div class="faces-row">${t.seats.map(mini).join('')}</div>
    <ul class="who-list">${t.seats.map(k => `<li><b>${CHARACTERS[k].full}</b>, ${CHARACTERS[k].what}.</li>`).join('')}</ul>
    <p class="muted">Four dice each. Play goes round to your left, so <b>${right.full}</b> bids just before you: theirs is the tell that matters most.</p>
    <div class="btns"><button class="btn" data-play="${idx}">Sit down</button><button class="btn ghost" data-act="title">Back</button></div>
  </div>`);
}

function showWon(idx) {
  const last = idx === TABLES.length - 1;
  if (last) {
    showScreen(`<div class="sheet">
      <h2>The house is yours</h2>
      <p class="lede">The Widow lifts her veil an inch, looks at you for a long moment, and slides her last die across the table. Nobody says anything. The lamp keeps swinging.</p>
      <div class="faces-row">${['pip', 'sallow', 'morrow', 'widow'].map(mini).join('')}</div>
      <p class="tiny">They’ll remember how you play. Come back and they’ll be watching for it.</p>
      <div class="btns"><button class="btn" data-act="title">Back to the tables</button></div></div>`);
    return;
  }
  showScreen(`<div class="sheet">
    <h2>You cleaned out ${TABLES[idx].name}</h2>
    <p class="lede">${TABLES[idx + 1].note}</p>
    <div class="btns"><button class="btn red" data-intro="${idx + 1}">On to ${TABLES[idx + 1].name}</button><button class="btn ghost" data-act="title">Back to the tables</button></div></div>`);
}

function showLost(idx) {
  const reads = [];
  for (const k of TABLES[idx].seats) for (const r of reading(k)) reads.push(`<b>${CHARACTERS[k].full}</b> knows ${READ_TEXT[r]}.`);
  const hints = [
    `Watch whoever bids just before you. When their tell shows, they don’t hold the face they just bid.`,
    `Count what you can see. Each unknown die shows any given face one time in six.`,
    `Raising a face you hold is safer than calling. Calling is safer when the bid is greedy.`,
  ];
  showScreen(`<div class="sheet">
    <h2>Out of dice</h2>
    <p class="lede">${reads.length ? reads[0] + ' Change the habit, and use it against them.' : hints[Math.floor(rand() * hints.length)]}</p>
    <div class="btns"><button class="btn red" data-play="${idx}">Try again</button><button class="btn ghost" data-act="title">Back to the tables</button></div></div>`);
}

function showRules() {
  const back = $('#screen').hidden ? null : $('#screen').innerHTML;
  showScreen(`<div class="sheet"><button class="x" data-act="close" aria-label="Close">×</button>
    <h2>How to play</h2>
    <p>Everyone rolls four dice under a cup. You only see your own.</p>
    <p>On your turn, either <b>raise</b> the bid or call the last bidder a <b>liar</b>.</p>
    <p>A bid like <b>“three fives”</b> claims there are at least three fives among <i>all</i> the dice on the table. A raise is more dice of any face, or the same number of a higher face.</p>
    <p>On a call, every cup lifts and the dice are counted. If there are fewer than bid, the bidder loses a die. If the bid holds, the caller loses one. The loser starts the next round. The last player with dice wins the table.</p>
    <h3>Tells</h3>
    <p>Each regular gives something away when they bid a face they don’t hold. Not every time, and sometimes when they’re honest. They’re watching you too.</p>
    <h3>Controls</h3>
    <p class="muted">Tap a face and use − / + for the count, then Bid. Keys: <b>← →</b> face, <b>↑ ↓</b> count, <b>Enter</b> bid, <b>L</b> liar, <b>Space</b> next round.</p>
    <div class="btns"><button class="btn" data-act="close">Back</button></div></div>`);
  $('#screen').dataset.back = back ? '1' : '';
  rulesBack = back;
}
let rulesBack = null;

function showNotes() {
  const met = Object.keys(save.seen);
  const rows = ['pip', 'sallow', 'morrow', 'widow'].filter(k => met.includes(k)).map(k => {
    const s = save.seen[k];
    const knows = (save.noticed[k] || []).filter(r => reading(k).includes(r));
    return `<div class="notes-row">${mini(k)}<p><b>${CHARACTERS[k].full}</b>: ${s.bids} bids seen at a reveal, ${s.bluffs} of them on a face they didn’t hold.
      ${knows.length ? `<br><span class="eyeline">Knows ${knows.map(r => READ_TEXT[r]).join('; and ')}.</span>` : ''}</p></div>`;
  }).join('');
  const all = book.obs.length, bl = book.obs.filter(o => !o.honest).length;
  const mine = all ? `You’ve bid ${all} times at a reveal, and ${bl} of those were on a face you didn’t hold. You usually take about ${median().toFixed(1)} seconds to bid.` : 'They haven’t seen you bid yet.';
  $('#notesBtn').classList.remove('fresh');
  showScreen(`<div class="sheet"><button class="x" data-act="close" aria-label="Close">×</button>
    <h2>Notes</h2>
    <p class="muted" style="text-align:center">What you’ve seen of them, and what they’ve picked up about you.</p>
    ${rows || '<p class="muted">Nobody yet. Play a round.</p>'}
    <h3>Your habits</h3>
    <p>${mine}</p>
    <p class="muted">The regulars learn from every bid you make that ends up under a lifted cup: how long you took, whether you jumped the count, whether you switched faces, and whether you held that face at all. Pip doesn’t notice anything. The others do.</p>
    <div class="btns"><button class="btn" data-act="close">Back to the table</button></div></div>`);
  rulesBack = null;
}

function showLeave() {
  if (phase === 'idle' || phase === 'over' || !G) return showTitle();
  showScreen(`<div class="sheet"><h2>Leave the table?</h2><p class="lede">You’ll forfeit this game.</p>
    <div class="btns"><button class="btn red" data-act="title">Leave</button><button class="btn ghost" data-act="close">Stay</button></div></div>`);
  rulesBack = null;
}

// ---- input
$('#screen').addEventListener('click', e => {
  sound.init();
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.table) { const i = +b.dataset.table; return showIntro(i); }
  if (b.dataset.play) return playTable(+b.dataset.play);
  if (b.dataset.intro) return showIntro(+b.dataset.intro);
  const a = b.dataset.act;
  if (a === 'lesson') return playLesson();
  if (a === 'title') return showTitle();
  if (a === 'rules') return showRules();
  if (a === 'close') {
    if (rulesBack) { $('#screen').innerHTML = rulesBack; rulesBack = null; return; }
    return hideScreen();
  }
});
for (let f = 1; f <= 6; f++) {
  const b = document.createElement('button');
  b.innerHTML = `${die(f)}<span class="held" hidden></span>`;
  b.setAttribute('aria-label', `${FACE_SINGLE(f)}s`);
  b.onclick = () => pickFace(f);
  $('#faces').appendChild(b);
}
function pickFace(f) {
  if (!myTurn || (lock && (lock === 'liar' || lock.f !== f)) || G.minFor(f) > G.total()) return;
  sel.f = f;
  if (sel.q < G.minFor(f)) sel.q = G.minFor(f);
  sound.tap();
  renderControls();
}
function nudge(d) {
  if (!myTurn || lock) return;
  const q = Math.max(G.minFor(sel.f), Math.min(G.total(), sel.q + d));
  if (q !== sel.q) { sel.q = q; sound.tap(); }
  renderControls();
}
$('#qMinus').onclick = () => nudge(-1);
$('#qPlus').onclick = () => nudge(1);
function doBid() {
  if (!myTurn || !G.isRaise(sel.q, sel.f) || lock === 'liar') return;
  pending?.resolve({ q: sel.q, f: sel.f });
}
function doLiar() {
  if (!myTurn || !G.bid || (lock && lock !== 'liar')) return;
  pending?.resolve({ call: true });
}
$('#bidBtn').onclick = doBid;
$('#liarBtn').onclick = doLiar;
$('#nextBtn').onclick = () => { if (phase === 'after') pending?.resolve(); };
$('#rulesBtn').onclick = () => { sound.init(); showRules(); };
$('#notesBtn').onclick = () => { sound.init(); showNotes(); };
$('#menuBtn').onclick = () => { sound.init(); showLeave(); };
const soundIcon = () => $('#soundBtn').classList.toggle('off', !sound.on);
$('#soundBtn').onclick = () => { sound.init(); sound.setOn(!sound.on); save.sound = sound.on; persist(); soundIcon(); };
soundIcon();
addEventListener('pointerdown', e => { sound.init(); if (e.pointerType === 'touch') document.body.classList.add('touch'); }, { capture: true });
addEventListener('keydown', e => {
  if (!$('#screen').hidden) { if (e.key === 'Escape') $('#screen [data-act="close"]')?.click(); return; }
  if (!$('#coach').hidden && (e.key === 'Enter' || e.key === ' ') && $('#coachGo')) { e.preventDefault(); $('#coachGo').click(); return; }
  if (e.key === ' ' && phase === 'after' && !$('#nextBtn').hidden) { e.preventDefault(); pending?.resolve(); return; }
  if (!myTurn) return;
  sound.init();
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const d = e.key === 'ArrowLeft' ? -1 : 1;
    for (let f = sel.f + d; f >= 1 && f <= 6; f += d) if (G.minFor(f) <= G.total() && !(lock && lock.f !== f)) { pickFace(f); break; }
  } else if (e.key === 'ArrowUp') { e.preventDefault(); nudge(1); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); nudge(-1); }
  else if (e.key >= '1' && e.key <= '6') pickFace(+e.key);
  else if (e.key === 'Enter') { e.preventDefault(); doBid(); }
  else if (e.key === 'l' || e.key === 'L') doLiar();
});
addEventListener('resize', () => requestAnimationFrame(drawRoom));

// ---- demo: a frozen moment at the Cellar table, for the preview
function demo() {
  table = TABLES[1];
  G = new Game(['you', ...table.seats], { seed: 11 });
  maxDice = 4;
  G.players[3].n = 3; G.players[0].n = 4;
  G.roll([[2, 4, 4, 6], [1, 3, 5, 6], [2, 2, 4, 5], [1, 4, 6]]);
  G.starter = 1; G.turn = 1;
  setWhere(table.name, 'Table II of III');
  buildSeats();
  phase = 'bidding';
  G.place(1, 2, 4, {}); G.place(2, 3, 4, {}); G.place(3, 5, 4, {});
  $('#mine').classList.remove('hidden');
  seatEls[2].classList.add('t-sweat');
  seatEls[2].querySelectorAll('.sweat, .brows').forEach(e => { e.style.animationPlayState = 'paused'; e.style.animationDelay = '-.9s'; });
  myTurn = true;
  sel = { q: 5, f: 6 };
  renderAll();
  renderLog();
  say(3, 'Five fours, I should think.', '', 0);
  hideScreen();
}

// ---- go
drawRoom();
requestAnimationFrame(frame);
if (DEMO) demo();
else {
  // an empty table behind the title
  G = new Game(['you', 'pip', 'sallow', 'morrow', 'widow'].slice(0, 1).concat(TABLES[0].seats));
  buildSeats();
  showTitle();
}
if (DEBUG) window.lt = { get G() { return G; }, save, book, sound, playTable, playLesson, showTitle, get pending() { return pending; }, get phase() { return phase; }, get myTurn() { return myTurn; }, get sel() { return sel; } };
