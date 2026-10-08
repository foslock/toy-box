// Five by Five: the page. Lays out the table, takes your cards, counts the board on the adding machine, runs the bar,
// and keeps the night in localStorage. The rules and the arithmetic live in game.js.
// ?demo freezes a board mid-count for the preview shot, ?autoplay lets the house bot play, ?seed=N picks the deal,
// ?debug puts the game on window.ff.
import * as G from './game.js';
import { LINES, LINES_AT, ANTES } from './game.js';
import { HANDS, H, isRed, rankName, SUIT_NAME, cardName } from './cards.js';
import { REG, BOSS, TRICK, FELT_OF, SEATS, PRICE } from './data.js';
import { cardHTML, backHTML, maskHTML, portraitSVG, suitDefs, portraitDefs, goodIcon, feltHTML, pip, markText } from './art.js';
import { Bot } from './bot.js';
import { Sound } from './sound.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), AUTO = Q.has('autoplay'), DEBUG = Q.has('debug');
const $ = s => document.querySelector(s), root = document.documentElement;
const fmt = n => Math.round(n).toLocaleString('en-US');
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { if (DEMO) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const KEY = 'fivebyfive.run', STATS = 'fivebyfive.stats', NOTES = 'fivebyfive.notes';
const stats = Object.assign({ nights: 0, wins: 0, bestAnte: 0, bestTable: 0 }, store.get(STATS));
const notes = Object.assign({}, store.get(NOTES));
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

let run = null;
const ui = { target: -1, cursor: 12, scoring: false, speed: 1, busy: false, paint: false, pointer: 'mouse', rush: 0, rushLeft: 0, bot: null, coarse: matchMedia('(pointer: coarse)').matches };
const save = () => { if (run && !DEMO && !AUTO) store.set(KEY, run); };
const wait = ms => new Promise(r => setTimeout(r, reduce.matches && ms > 40 ? ms * .4 : ms / ui.speed));

document.getElementById('defs').innerHTML = suitDefs() + portraitDefs();

// ------------------------------------------------------------------ layout
// Cards are sized to the room: as big as fits with the seats above and the shoe below (or beside, on a wide screen).
function fit() {
  const W = innerWidth, H = innerHeight, wide = W >= 640 && W > H * 1.08;
  document.body.classList.toggle('wide', wide);
  document.body.classList.toggle('short', wide && H < 760);
  let cw;
  if (wide) {
    const left = Math.round(Math.min(300, Math.max(200, W * .21))), right = Math.round(Math.min(340, Math.max(236, W * .25)));
    root.style.setProperty('--left', left + 'px'); root.style.setProperty('--right', right + 'px');
    cw = Math.min((W - left - right - 104) / 5.7, (H - 60) / 7.6);
  } else cw = Math.min((W - 22) / 5.7, (H - 200) / 9.15);
  cw = Math.max(34, Math.min(128, Math.floor(cw)));
  root.style.setProperty('--cw', cw + 'px');
  const game = $('#game');
  for (let i = 0; i < 16 && !wide && !game.hidden && game.scrollHeight > game.clientHeight + 1 && cw > 34; i++) {
    cw -= 2; root.style.setProperty('--cw', cw + 'px');
  }
}
addEventListener('resize', () => { fit(); if (run && !$('#game').hidden) renderBoard(); });

// ------------------------------------------------------------------ the board
const board = $('#board'), sqs = [];
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
(function build() {
  for (let i = 0; i < 25; i++) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sq'; b.dataset.cell = i;
    b.style.left = `calc(${i % 5} * (var(--cw) + var(--g)))`;
    b.style.top = `calc(${Math.floor(i / 5)} * (var(--ch) + var(--g)))`;
    board.append(b); sqs.push(b);
  }
  const lbl = (txt, x, y, li) => {
    const e = document.createElement('span');
    e.className = 'lbl'; e.textContent = txt; e.dataset.li = li;
    e.style.left = x; e.style.top = y; e.style.width = 'var(--lm)'; e.style.height = 'var(--lm)';
    e.style.transform = 'translate(-50%, -50%)';
    board.append(e);
  };
  const edgeX = 'calc(5 * var(--cw) + 4 * var(--g) + var(--lm) / 2)', edgeY = 'calc(5 * var(--ch) + 4 * var(--g) + var(--lm) / 2)';
  for (let i = 0; i < 5; i++) {
    lbl(ROMAN[i], edgeX, `calc(${i} * (var(--ch) + var(--g)) + var(--ch) / 2)`, i);
    lbl(ROMAN[i], `calc(${i} * (var(--cw) + var(--g)) + var(--cw) / 2)`, edgeY, 5 + i);
  }
  lbl('↘', edgeX, edgeY, 10);
  lbl('↙', `calc(-1 * var(--lm) / 2 + 2px)`, edgeY, 11);
})();
const lbls = [...board.querySelectorAll('.lbl')];
const cellCenter = c => {
  const r = sqs[c].getBoundingClientRect(), b = board.getBoundingClientRect();
  return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 };
};
const tilt = id => `${(((id * 37) % 9) - 4) * .35}deg`;

function renderBoard() {
  const T = run.table, places = run.phase === 'table' && !ui.paint ? G.playable(run) : [];
  for (let i = 0; i < 25; i++) {
    const el = sqs[i], b = ui.paint ? null : T.board[i];
    const card = b && typeof b === 'object' ? b : null;
    el.classList.toggle('open', ui.paint ? !run.felt[i] : places.includes(i));
    el.classList.toggle('brick', b === 'brick');
    el.classList.toggle('has', !!card);
    el.classList.toggle('target', ui.target === i && !card);
    const key = (card ? card.id + ':' + card.e + ':' + card.s : String(b)) + '|' + (run.felt[i] || '') + (ui.target === i ? '|t' : '');
    if (el.dataset.key === key) continue;
    el.dataset.key = key;
    let html = b === 'brick' ? '' : feltHTML(run.felt[i]);
    if (card) html += cardHTML(card);
    if (!card && ui.target === i && G.current(run)) html += ghostHTML();
    if (ui.target === i) el.dataset.again = ui.pointer === 'touch' || (ui.coarse && ui.pointer !== 'mouse') ? 'tap again' : ui.pointer === 'key' ? 'enter' : 'click';
    else delete el.dataset.again;
    el.innerHTML = html;
    const ce = el.querySelector('.card:not(.ghost)');
    if (ce && card) ce.style.rotate = tilt(Math.abs(card.id) + i);
    el.setAttribute('aria-label', `${LINES[Math.floor(i / 5)].name}, ${LINES[5 + i % 5].name}: ${card ? cardName(card) : b === 'brick' ? 'bricked up' : b === 'hole' ? 'the hole' : 'empty'}${run.felt[i] ? ', ' + FELT_OF[run.felt[i]].name : ''}`);
  }
  for (const s of sqs) s.classList.toggle('drop-in', G.rulesOf(run).includes('drop') && places.includes(+s.dataset.cell) && run.phase === 'table' && !ui.paint);
}
const ghostHTML = () => {
  const c = G.current(run);
  return G.masked(run) ? maskHTML(c).replace('class="card back masked"', 'class="card back masked ghost"') : cardHTML(c, ' ghost');
};

// Light the lines through a square (or one line) on the felt.
function light(lines, dimOthers = false) {
  const on = new Set(lines.flatMap(li => LINES[li].cells));
  sqs.forEach((s, i) => { s.classList.toggle('lit', on.has(i)); s.classList.toggle('dim', dimOthers && !on.has(i)); });
  lbls.forEach(l => l.classList.toggle('on', lines.includes(+l.dataset.li)));
}

// ------------------------------------------------------------------ the rest of the table
function renderHud() {
  const T = run.table, boss = T.boss;
  $('#anteLbl').textContent = run.ante <= ANTES ? `Ante ${run.ante} of ${ANTES}` : `Ante ${run.ante}, after hours`;
  const tl = $('#tableLbl');
  tl.textContent = boss ? BOSS[boss].name : run.stage === 0 ? 'A plain table' : 'Table';
  tl.classList.toggle('rule', !!boss);
  $('#ruleText').textContent = boss ? BOSS[boss].text : 'No house rule at this one. Beat the number on the slate.';
  $('#need').textContent = fmt(T.target);
  if (!ui.scoring) { const g = $('#got'); g.textContent = run.phase === 'table' ? '—' : fmt(T.result?.total || 0); g.classList.toggle('over', !!T.result?.won); }
  $('#money').textContent = '$' + run.money;
  $('#markers').textContent = run.markers ? '1 marker' : 'no marker';
}

function renderSeats() {
  const el = $('#seats');
  el.innerHTML = '';
  for (let i = 0; i < SEATS; i++) {
    const r = run.regs[i], b = document.createElement('button');
    b.type = 'button'; b.className = 'seat' + (r ? '' : ' empty') + (r && run.table?.asleep === i ? ' asleep' : '');
    b.dataset.seat = i;
    if (r) {
      const R = REG[r.id];
      b.innerHTML = `<span class="frame">${portraitSVG(r.id)}</span><span class="who"><b>${R.name}</b><span>${R.text}</span></span>${r.id === 'mel' && r.n ? `<span class="n">+${r.n}</span>` : ''}`;
      b.setAttribute('aria-label', `${R.name}: ${R.text}`);
      b.onclick = () => !ui.scoring && seatSheet(i);
    } else {
      b.innerHTML = `<span class="frame"></span><span class="who"><b>Empty seat</b>${i === run.regs.length ? '<span>Buy a regular a drink at the bar and they sit in.</span>' : ''}</span>`;
      b.setAttribute('aria-label', 'Empty seat');
      b.tabIndex = -1;
    }
    el.append(b);
  }
}

function renderDock() {
  const T = run.table, cur = $('#cur'), c = run.phase === 'table' ? G.current(run) : null;
  cur.innerHTML = c ? (G.masked(run) ? maskHTML(c) : cardHTML(c)) : '';
  cur.classList.toggle('empty', !c);
  const peek = $('#peek'), next = run.phase === 'table' ? G.coming(run) : [];
  peek.innerHTML = next.length ? '<small>next</small>' + next.map(n => `<div class="pk">${G.masked(run) ? maskHTML(n) : cardHTML(n)}</div>`).join('') : '';
  const burn = $('#burn'), left = G.burnsLeft(run);
  burn.querySelector('.sticks').innerHTML = Array.from({ length: T.burns }, (_, i) => `<i class="${i < T.used ? 'used' : ''}"></i>`).join('') || '<i class="used"></i>';
  burn.disabled = !(run.phase === 'table' && left > 0 && c);
  burn.setAttribute('aria-label', T.burns ? `Burn this card (${left} of ${T.burns} matches left)` : 'No burning at this table');
  renderRead();
  rushRing();
}

// "Pair, ♥ draw", "3 cards", "Full House": what a line has, in a few words.
function describe(o) {
  if (!o.n) return 'empty';
  if (o.full) return HANDS[o.made].name;
  const bits = [];
  if (o.made >= H.pair) bits.push(HANDS[o.made].name);
  if (o.flush >= 0) bits.push(`${pip(o.flush, 'inl ' + (isRed(o.flush) ? 'r' : 'k'))}\u2009draw`);
  if (o.straight && bits.length < 2) bits.push('str. draw');
  return bits.join(', ') || `${o.n} card${o.n > 1 ? 's' : ''}`;
}
const worth = o => o.full ? 10 + o.made : Math.max(o.made, 0) + (o.flush >= 0 ? 1.5 : 0) + (o.straight ? .8 : 0);
function renderRead() {
  const el = $('#read'), T = run.table;
  if (run.phase !== 'table') { el.innerHTML = ''; return; }
  const cell = ui.target;
  if (cell < 0 || T.board[cell] !== null) {
    const drop = G.rulesOf(run).includes('drop');
    el.innerHTML = `<span class="hint">${drop ? 'Pick a column. The card falls to the bottom.' : ui.pointer === 'touch' || ui.coarse ? 'Tap a square to see what it makes. Tap it again to put the card down.' : 'Point at a square to see what it makes. Click to put the card down.'}</span>`;
    return;
  }
  const c = G.current(run);
  const card = G.masked(run) ? { ...c, r: 99, e: c.e } : c;
  const after = T.board.slice(); after[cell] = card;
  el.innerHTML = LINES_AT[cell].map(li => {
    const L = LINES[li];
    if (G.lineVoid(run, li)) return `<div class="ln"><i>${G.lineShort(L)}</i><em></em><span>doesn’t pay tonight</span></div>`;
    const a = G.outlookOf(run, li, T.board), b = G.outlookOf(run, li, after);
    const cls = worth(b) > worth(a) + .01 ? 'up' : worth(b) < worth(a) - .01 ? 'dn' : '';
    // what the line becomes, and what it gives up
    const lost = a.flush >= 0 && b.flush < 0 && !b.full ? ` (no more ${pip(a.flush, 'inl ' + (isRed(a.flush) ? 'r' : 'k'))})` : a.straight && !b.straight && !b.full ? ' (no straight)' : '';
    return `<div class="ln"><i>${G.lineShort(L)}</i><em class="${cls}">${cls === 'up' ? '▲' : cls === 'dn' ? '▼' : '·'}</em><span><b class="${cls}">${describe(b)}</b>${lost}</span></div>`;
  }).join('');
}

function renderAll() {
  renderHud(); renderSeats(); renderBoard(); renderDock();
  $('#count').hidden = !ui.scoring;
  for (const id of ['#shoe', '#read', '#burn']) $(id).hidden = ui.scoring;
  if (!ui.scoring) light(ui.target >= 0 && run.phase === 'table' ? LINES_AT[ui.target].filter(li => !G.lineVoid(run, li)) : []);
  $('#bSound').classList.toggle('off', Sound.mode === 0);
  $('#sndLbl').textContent = ['Sound off', 'No music', 'Sound'][Sound.mode];
}

// ------------------------------------------------------------------ putting cards down
function setTarget(cell) {
  if (run.phase !== 'table' || ui.busy) cell = -1;
  if (cell >= 0) cell = G.landing(run, cell);
  if (cell === ui.target) return;
  ui.target = cell;
  if (cell >= 0) ui.cursor = cell;
  renderBoard(); renderRead();
  light(cell >= 0 ? LINES_AT[cell].filter(li => !G.lineVoid(run, li)) : []);
}

async function put(cell, fromRect) {
  if (ui.busy || run.phase !== 'table' || ui.scoring) return;
  const land = G.landing(run, cell);
  if (land < 0) { sqs[cell]?.classList.add('shake'); setTimeout(() => sqs[cell]?.classList.remove('shake'), 400); Sound.play('buzz'); return; }
  const from = fromRect || $('#cur').getBoundingClientRect();
  const wasMasked = G.masked(run);
  if (!G.place(run, land)) return;
  afterPut(land, from, wasMasked);
}
function afterPut(land, from, wasMasked) {
  ui.target = -1;
  Sound.play('snap');
  renderBoard();
  const ce = sqs[land].querySelector('.card');
  if (ce && !reduce.matches) {
    const to = ce.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2), s = from.width / to.width;
    ce.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${s})`, offset: 0 }, { transform: 'translate(0, 0) scale(1.06)', offset: .8 }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.25, .8, .3, 1)' });
    if (wasMasked) ce.animate([{ filter: 'brightness(.2)' }, { filter: 'none' }], { duration: 420 });
  }
  dealt();
  renderHud();
  light([]);
  save();
  tutor('placed');
  if (run.phase === 'scored') setTimeout(count, 380);
}
// The next card comes off the shoe.
function dealt() {
  renderDock();
  const c = $('#cur .card');
  if (c && !reduce.matches) { Sound.play('deal'); c.animate([{ transform: 'translateX(-30%) rotate(-6deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: 'ease-out' }); }
  startRush();
}
function burn() {
  if (ui.busy || ui.scoring || run.phase !== 'table' || G.burnsLeft(run) <= 0) return;
  const c = $('#cur .card');
  const ghost = c?.cloneNode(true);
  if (ghost) {
    const r = c.getBoundingClientRect();
    Object.assign(ghost.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', inset: 'auto', zIndex: 50, pointerEvents: 'none' });
    document.body.append(ghost);
    ghost.animate([{ filter: 'none', transform: 'none', opacity: 1 }, { filter: 'sepia(1) brightness(.6)', transform: 'translateY(-6px) rotate(-4deg)', opacity: 1, offset: .4 }, { filter: 'sepia(1) brightness(.1)', transform: 'translateY(-40px) scale(.6) rotate(-14deg)', opacity: 0 }], { duration: 650, easing: 'ease-in' }).onfinish = () => ghost.remove();
  }
  Sound.play('burn');
  G.burn(run);
  ui.target = -1;
  renderBoard(); dealt(); renderSeats();
  light([]);
  save();
}

// Board input. A mouse previews on hover and places on click; a finger taps once to preview and again to place.
// Either can drag the card from the shoe.
board.addEventListener('pointerdown', e => { ui.pointer = e.pointerType; Sound.wake(); });
board.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch' || ui.drag) return;
  const s = e.target.closest('.sq');
  if (ui.paint) return;
  setTarget(s ? +s.dataset.cell : -1);
});
board.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch' && !ui.drag && !ui.paint) setTarget(-1); });
board.addEventListener('click', e => {
  const s = e.target.closest('.sq');
  if (!s) return;
  const cell = +s.dataset.cell;
  if (ui.paint) return paintAt(cell);
  if (run.phase !== 'table' || ui.scoring) return;
  const land = G.landing(run, cell);
  const keyboard = e.detail === 0;
  if (ui.pointer === 'touch' && !keyboard && ui.target !== land) { setTarget(cell); Sound.play('tap'); return; }
  put(cell);
});
// dragging the card off the shoe
$('#cur').addEventListener('pointerdown', e => {
  ui.pointer = e.pointerType; Sound.wake();
  if (run.phase !== 'table' || ui.busy || ui.scoring || !G.current(run)) return;
  const src = $('#cur .card');
  if (!src) return;
  e.preventDefault();
  const r = src.getBoundingClientRect(), d = { x0: e.clientX, y0: e.clientY, r, el: null, moved: false, id: e.pointerId };
  ui.drag = d;
  $('#cur').setPointerCapture(e.pointerId);
});
$('#cur').addEventListener('pointermove', e => {
  const d = ui.drag;
  if (!d || e.pointerId !== d.id) return;
  const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
  if (!d.moved && Math.hypot(dx, dy) < 6) return;
  if (!d.moved) {
    d.moved = true;
    d.el = $('#cur .card').cloneNode(true);
    Object.assign(d.el.style, { position: 'fixed', inset: 'auto', left: d.r.left + 'px', top: d.r.top + 'px', width: d.r.width + 'px', height: d.r.height + 'px', zIndex: 70, pointerEvents: 'none', boxShadow: '0 14px 26px rgba(0,0,0,.5)' });
    document.body.append(d.el);
    $('#cur .card').style.opacity = .25;
  }
  // hold the card a little above the finger so you can see where it's going
  const lift = e.pointerType === 'touch' ? d.r.height * .55 : 0;
  d.el.style.transform = `translate(${dx}px, ${dy - lift}px) rotate(${Math.max(-8, Math.min(8, dx / 30))}deg)`;
  const hit = document.elementFromPoint(e.clientX, e.clientY - lift)?.closest('.sq');
  setTarget(hit ? +hit.dataset.cell : -1);
});
function endDrag(e) {
  const d = ui.drag;
  if (!d || (e && e.pointerId !== d.id)) return;
  ui.drag = null;
  const src = $('#cur .card');
  if (src) src.style.opacity = '';
  if (!d.moved) return;
  const from = d.el.getBoundingClientRect();
  if (ui.target >= 0 && e?.type === 'pointerup') { d.el.remove(); put(ui.target, from); return; }
  d.el.animate([{ transform: d.el.style.transform }, { transform: 'none' }], { duration: 180, easing: 'ease-out' }).onfinish = () => d.el.remove();
  setTarget(-1);
}
$('#cur').addEventListener('pointerup', endDrag);
$('#cur').addEventListener('pointercancel', endDrag);
$('#burn').addEventListener('click', burn);

// The Rush: eight seconds a card, shown as a ring round the shoe.
function rushRing() {
  const cur = $('#cur');
  cur.querySelector('.ring')?.remove();
  if (!(run.phase === 'table' && G.rulesOf(run).includes('rush') && G.current(run))) return;
  cur.insertAdjacentHTML('beforeend', '<svg class="ring" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="2" y="2" width="96" height="96" rx="9" pathLength="100" fill="none" stroke="#ffb19c" stroke-width="3" stroke-dasharray="100" vector-effect="non-scaling-stroke"/></svg>');
}
function startRush() {
  clearInterval(ui.rush);
  if (!(run.phase === 'table' && G.rulesOf(run).includes('rush') && G.current(run)) || AUTO) return;
  ui.rushLeft = 8000;
  let last = performance.now();
  rushRing();
  ui.rush = setInterval(() => {
    const t = performance.now(), dt = t - last; last = t;
    if (!$('#sheet').hidden || ui.busy || ui.drag || document.hidden) return;
    ui.rushLeft -= dt;
    const ring = $('#cur .ring rect');
    if (ring) ring.style.strokeDashoffset = 100 - Math.max(0, ui.rushLeft / 80);
    if (ui.rushLeft < 3000 && Math.floor(ui.rushLeft / 1000) !== Math.floor((ui.rushLeft + dt) / 1000)) Sound.play('tick-clock');
    if (ui.rushLeft <= 0) {
      clearInterval(ui.rush);
      const from = $('#cur').getBoundingClientRect(), wasMasked = G.masked(run), before = run.table.board.slice();
      if (G.dealerPlaces(run)) afterPut(before.findIndex((b, i) => b === null && run.table.board[i] !== null), from, wasMasked);
    }
  }, 100);
}

// Keys: arrows to move, Enter or Space to put the card down, B to burn.
addEventListener('keydown', e => {
  Sound.wake();
  if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter') ui.pointer = 'key';
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const sheetOpen = !$('#sheet').hidden;
  if (sheetOpen) {
    if (e.key === 'Escape') { const x = $('#sheet [data-close]'); if (x) { e.preventDefault(); x.click(); } }
    return;
  }
  if (ui.scoring) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); ui.speed = 6; } return; }
  if (ui.paint) { if (e.key === 'Escape') cancelPaint(); return; }
  if (run?.phase !== 'table') return;
  const k = e.key.toLowerCase(), mv = { arrowleft: -1, arrowright: 1, arrowup: -5, arrowdown: 5, a: -1, d: 1, w: -5, s: 5 }[k];
  if (mv !== undefined && !(k === 's' && e.shiftKey)) {
    e.preventDefault();
    let c = ui.cursor;
    const col = c % 5, row = Math.floor(c / 5);
    if (mv === -1 && col > 0) c--; else if (mv === 1 && col < 4) c++; else if (mv === -5 && row > 0) c -= 5; else if (mv === 5 && row < 4) c += 5;
    ui.pointer = 'key'; ui.cursor = c;
    setTarget(c);
    ui.cursor = c;
    sqs[c].focus({ preventScroll: true });
    return;
  }
  if ((k === 'enter' || k === ' ') && ui.target >= 0 && !e.target.closest?.('#tools, #seats, #burn')) { e.preventDefault(); put(ui.target); return; }
  if (k === 'b' || k === 'backspace' || k === 'x') { e.preventDefault(); burn(); return; }
  if (k === 'h') return coaster();
  if (k === 'l') return ledger();
  if (k === '?' || k === 'r') return rules();
});

// Space on a focused square has already put the card down on keydown; don't let its keyup click the square too.
addEventListener('keyup', e => { if (e.key === ' ' && e.target.closest?.('.sq')) e.preventDefault(); });

// ------------------------------------------------------------------ the count
// the tape has room for full names on a wide screen
const handOnTape = h => (document.body.classList.contains('wide') ? HANDS[h].name : HANDS[h].short).toUpperCase();
// Every line in turn: light it, ring up its chips and mult on the meter, print it on the tape.
async function count() {
  if (ui.scoring || run.phase !== 'scored') return;
  ui.scoring = true; ui.speed = AUTO ? 8 : 1; clearInterval(ui.rush); ui.target = -1;
  const res = run.table.result, tape = $('#tape');
  tape.innerHTML = '';
  renderAll();
  const mc = $('#mc'), mm = $('#mm'), ml = $('#mlabel'), got = $('#got');
  const meter = (C, M) => { mc.textContent = fmt(C); mm.textContent = M % 1 ? M.toFixed(1) : fmt(M); };
  const bump = el => !reduce.matches && el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 200 });
  const print = (html, cls = '') => { const r = document.createElement('div'); r.className = 'row new ' + cls; r.innerHTML = html; tape.append(r); while (tape.children.length > 40) tape.firstChild.remove(); return r; };
  print(`<span>THE FIVE BY FIVE · NEED ${fmt(res.target)}</span>`);
  tutor('count');
  let total = 0, ticks = 0;
  meter(0, 0); got.textContent = '0'; got.classList.remove('over');
  for (const L of res.lines) {
    const line = LINES[L.li];
    if (ui.speed < 6) ui.speed = (AUTO ? 8 : 1) + L.li * .07;   // the machine warms up as it goes
    light([L.li], true);
    if (L.void) {
      ml.textContent = 'doesn’t pay';
      print(`<span>${G.lineShort(line).toUpperCase()} <b>ROWS DON’T PAY</b></span><b>0</b>`, 'void');
      await wait(260);
      continue;
    }
    const pill = linePill(L);
    ml.textContent = HANDS[L.pay].name + (L.pay !== L.hand ? ' (Dot & Dash)' : '');
    for (const st of L.steps) {
      if (st.t === 'base') { meter(st.C, st.M); bump(mc); bump(mm); Sound.play('tick', 0); await wait(170); continue; }
      const k = st.x ? 'x' : st.mult ? 'mul' : 'chip', txt = st.x ? `×${st.x % 1 ? st.x.toFixed(1) : st.x}` : st.mult ? `+${fmt(st.mult)}` : `+${fmt(st.chips)}`;
      if (st.t === 'card' || st.t === 'felt') {
        popCard(st.cell);
        floatAt(st.cell, txt, k);
      } else if (st.t === 'reg') {
        sayAt(st.seat, txt + (st.x ? '' : st.mult ? ' Mult' : ' Chips'), k);
        if (st.cell !== undefined) popCard(st.cell);
      }
      meter(st.C, st.M);
      bump(st.x || st.mult ? mm : mc);
      Sound.play(st.x ? 'xmult' : st.mult ? 'mult' : 'tick', ++ticks % 12);
      await wait(st.t === 'card' && !st.mult && !st.x ? 80 : 190);
    }
    if (L.snubbed) {
      ml.textContent = 'The Snob won’t pay';
      print(`<span>${G.lineShort(line).toUpperCase()} <b>${handOnTape(L.pay)}</b></span><b>0</b>`, 'void');
      Sound.play('buzz');
      pill?.remove();
      await wait(320);
      continue;
    }
    total += L.total;
    got.textContent = fmt(total);
    got.classList.toggle('over', total >= res.target);
    Sound.play('chunk');
    print(`<span>${G.lineShort(line).toUpperCase()} <b>${handOnTape(L.pay)}</b> ${fmt(L.chips)}×${L.mult % 1 ? L.mult.toFixed(1) : fmt(L.mult)}</span><b>${fmt(L.total)}</b>`);
    if (L.hand >= H.full) Sound.play('ding');
    await wait(L.hand >= H.full ? 420 : 260);
    pill?.remove();
  }
  light([]);
  const sum = document.createElement('div');
  sum.className = 'sum'; sum.innerHTML = `<span>TOTAL</span><span>${fmt(res.total)}</span>`;
  tape.append(sum);
  const won = res.won;
  const st = document.createElement('div');
  st.className = 'stamp ' + (won ? 'paid' : 'short');
  st.innerHTML = won ? `PAID<small>${fmt(res.total)} of ${fmt(res.target)}</small>` : `SHORT<small>${fmt(res.target - res.total)} under</small>`;
  $('#boardWrap').append(st);
  if (!reduce.matches) st.animate([{ transform: 'translate(-50%, -50%) rotate(-9deg) scale(2.4)', opacity: 0 }, { transform: 'translate(-50%, -50%) rotate(-9deg) scale(1)', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.5, 0, .9, .5)' });
  Sound.play('slam'); Sound.play(won ? 'ding' : 'lose');
  stats.bestTable = Math.max(stats.bestTable, res.total);
  await wait(won ? 1100 : 1500);
  st.remove();
  ui.scoring = false; ui.speed = 1;
  const out = G.settle(run);
  save();
  afterSettle(out);
}
function linePill(L) {
  const line = LINES[L.li], a = cellCenter(line.cells[0]), b = cellCenter(line.cells[4]);
  const p = document.createElement('div');
  p.className = 'linepill';
  p.innerHTML = `<b>${HANDS[L.pay].name}</b>`;
  const horizontal = line.kind === 'row';
  p.style.left = (horizontal ? (a.x + b.x) / 2 : (a.x + b.x) / 2) + 'px';
  p.style.top = (line.kind === 'col' ? b.y + (sqs[0].offsetHeight * .5) + 2 : line.kind === 'row' ? a.y - sqs[0].offsetHeight * .5 - 2 : (a.y + b.y) / 2) + 'px';
  board.append(p);
  return p;
}
function popCard(cell) {
  const c = sqs[cell]?.querySelector('.card');
  if (c && !reduce.matches) c.animate([{ transform: 'none' }, { transform: 'translateY(-8%) scale(1.12)' }, { transform: 'none' }], { duration: 200, easing: 'ease-out' });
}
function floatAt(cell, txt, k) {
  const p = cellCenter(cell), f = document.createElement('div');
  f.className = 'float ' + k; f.textContent = txt;
  f.style.left = p.x + 'px'; f.style.top = p.y + 'px';
  board.append(f);
  f.animate([{ transform: 'translate(-50%, -30%) scale(.7)', opacity: 0 }, { transform: 'translate(-50%, -90%) scale(1.1)', opacity: 1, offset: .25 }, { transform: 'translate(-50%, -160%)', opacity: 0 }], { duration: 650 / Math.min(ui.speed, 3), easing: 'ease-out' }).onfinish = () => f.remove();
}
function sayAt(seat, txt, k) {
  const s = $(`#seats .seat[data-seat="${seat}"]`);
  if (!s) return;
  s.querySelector('.say')?.remove();
  const b = document.createElement('span');
  b.className = 'say ' + k; b.textContent = txt;
  s.append(b);
  if (!reduce.matches) s.querySelector('.frame').animate([{ transform: 'none' }, { transform: 'translateY(-5px) rotate(-4deg)' }, { transform: 'none' }], { duration: 260 });
  setTimeout(() => b.remove(), 700 / Math.min(ui.speed, 3));
}
// a tap anywhere during the count hurries it along
addEventListener('pointerdown', e => { ui.pointer = e.pointerType; if (ui.scoring) ui.speed = 6; }, true);

function afterSettle(out) {
  stats.bestAnte = Math.max(stats.bestAnte, run.ante);
  if (out.champion) { stats.wins++; store.set(STATS, stats); Sound.play('win'); return wonSheet(); }
  if (out.over) { store.set(STATS, stats); return overSheet(true); }
  store.set(STATS, stats);
  receipt();
}

// ------------------------------------------------------------------ sheets
const sheet = $('#sheet');
function open(html, onOpen) {
  sheet.innerHTML = html;
  sheet.hidden = false;
  sheet.scrollTop = 0;
  const p = sheet.firstElementChild;
  if (p && !reduce.matches) p.animate([{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: 'ease-out' });
  onOpen?.(sheet);
  if (ui.pointer === 'key') (sheet.querySelector('[autofocus]') || sheet.querySelector('button'))?.focus({ preventScroll: true });
}
function close() { sheet.hidden = true; sheet.innerHTML = ''; }
sheet.addEventListener('click', e => { if (e.target === sheet) sheet.querySelector('[data-close]')?.click(); });

function titleSheet() {
  const saved = store.get(KEY), canGo = saved && saved.v === 1 && saved.phase !== 'over' && saved.phase !== 'won';
  $('#game').hidden = true;
  open(`<div class="panel">
    <div class="matchbook" aria-hidden="true">
      <div class="top">Cards · Drinks · No refunds</div>
      <div class="name">FIVE<span>BY</span>FIVE</div>
      <div><div class="grid5">${'<i></i>'.repeat(25)}</div><div class="addr">Downstairs, 55 Fifth Street<br>Open till the house says so</div></div>
      <div class="strike"></div>
    </div>
    <h1 class="sr" style="position:absolute;left:-9999px">Five by Five</h1>
    <div class="titlebtns">
      ${canGo ? `<button class="btn red" id="tCont" type="button">Back to your table <small>ante ${saved.ante}, $${saved.money}</small></button>` : ''}
      <button class="btn ${canGo ? '' : 'red'}" id="tNew" type="button">${canGo ? 'Start a new night' : 'Sit down'}</button>
      <button class="btn ghost" id="tRules" type="button">House rules</button>
    </div>
    <p class="titlenote">${stats.bestAnte ? `Best night: ante ${stats.bestAnte}. Best table: ${fmt(stats.bestTable)}. ${stats.wins ? `Beat the house ${stats.wins === 1 ? 'once' : stats.wins + ' times'}.` : 'Never beaten the house.'}` : 'Twenty-five cards. Twelve hands. One table at a time.'}</p>
  </div>`, s => {
    s.querySelector('#tCont')?.addEventListener('click', () => { Sound.wake(); resume(saved); });
    let sure = false;
    s.querySelector('#tNew').addEventListener('click', e => {
      Sound.wake();
      if (canGo && !sure) { sure = true; e.currentTarget.innerHTML = 'Sure? That night is lost. <small>tap again</small>'; return; }
      newNight();
    });
    s.querySelector('#tRules').addEventListener('click', () => rules(true));
  });
}

function rules(fromTitle = false, first = false) {
  open(`<div class="panel printed">
    <h2>House Rules</h2><div class="sub">The Five by Five · by order of the management</div>
    <ol>
      <li>You get one card at a time. Put it in any empty square. It stays there.</li>
      <li>When all twenty-five are down, every row, every column and both diagonals is a poker hand. That’s twelve hands, and they all pay.</li>
      <li>A hand pays <b style="color:var(--chip)">chips</b> × <b style="color:var(--mult)">mult</b>. The cards in it add their own chips. The coaster has the prices.</li>
      <li>Beat the number on the slate or leave the table. One time only, the house will take your marker instead.</li>
      <li>Don’t like a card? Burn it. Three matches a table.</li>
      <li>Every second table, the house changes a rule. The eighth one is the House’s own.</li>
      <li>Between tables, the bar is open. The regulars will sit in for the price of a drink.</li>
    </ol>
    <p class="foot">Rows are good for pairs. Columns are good for suits. You didn’t hear it from me. — the dealer</p>
    <div class="acts">${first ? '<button class="btn" type="button" data-close autofocus>Deal me in</button>' : `<button class="btn" type="button" data-close autofocus>${fromTitle ? 'Back' : 'Back to the table'}</button><button class="btn ghost" type="button" id="toCoaster">The coaster</button>`}</div>
  </div>`, s => {
    s.querySelector('[data-close]').addEventListener('click', () => { if (fromTitle) titleSheet(); else { close(); if (first) tutor('start'); } });
    s.querySelector('#toCoaster')?.addEventListener('click', () => coaster(fromTitle));
  });
}

function coaster(fromTitle = false) {
  const rows = HANDS.map((h, i) => {
    const lv = run?.levels[h.id] || 0, c = h.chips + lv * h.up[0], m = h.mult + lv * h.up[1];
    return `<tr class="${lv ? 'lv' : ''}"><td>${h.name}${lv > 1 ? ' ×' + lv : ''}</td><td><span class="c">${c}</span> × <span class="m">${m}</span></td></tr>`;
  }).reverse().join('');
  open(`<div class="panel coaster">
    <h2>What hands pay</h2><div class="sub">chips × mult · plus the cards’ own chips</div>
    <table>${rows}</table>
    <p class="tip">Number cards are worth their number, faces 10, Aces 11. ${run && Object.keys(run.levels).length ? '★ tipped at the bar.' : ''}</p>
    <div style="text-align:center;margin-top:8px"><button class="btn" type="button" data-close autofocus style="background:var(--ink);color:var(--paper);box-shadow:none;min-height:36px">Done</button></div>
  </div>`, s => s.querySelector('[data-close]').addEventListener('click', () => fromTitle ? titleSheet() : close()));
}

function ledger() {
  if (!run) return;
  const T = run.table, left = new Set(run.phase === 'table' ? T.pile.slice(T.at + 1) : []), inDeck = new Map();
  for (const c of run.deck) { const k = c.s * 100 + c.r; inDeck.set(k, [...(inDeck.get(k) || []), c]); }
  const ranks = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  const rows = [0, 1, 2, 3].map(s => `<tr><th>${pip(s, isRed(s) ? 'r' : 'k')}</th>${ranks.map(r => {
    const cs = inDeck.get(s * 100 + r) || [], n = cs.filter(c => left.has(c.id)).length;
    const lbl = ({ 14: 'A', 13: 'K', 12: 'Q', 11: 'J' })[r] || r;
    return `<td class="${isRed(s) ? 'red ' : ''}${!cs.length ? 'gone ' : n ? 'left ' : 'gone '}${cs.some(c => c.e) ? 'marked' : ''}"><span>${cs.length ? lbl : '·'}${cs.length > 1 ? '²' : ''}</span></td>`;
  }).join('')}</tr>`).join('');
  const bySuit = [0, 1, 2, 3].map(s => [...left].map(id => G.cardById(run, id)).filter(c => c && c.s === s).length);
  open(`<div class="panel ledger">
    <h2>The shoe</h2><p class="sub">What’s still to come this table. Crossed out: on the felt, burnt, or not in your deck.${run.deck.some(c => c.e) ? ' Ringed: marked by the bar.' : ''}</p>
    <table>${rows}</table>
    <div class="counts">${bySuit.map((n, s) => `<span>${pip(s, isRed(s) ? 'r' : 'k')} ${n}</span>`).join('')}<span>${left.size} cards</span></div>
    <div class="acts"><button class="btn" type="button" data-close autofocus>Done</button></div>
  </div>`, s => s.querySelector('[data-close]').addEventListener('click', close));
}

function seatSheet(i) {
  const r = run.regs[i];
  if (!r) return;
  const R = REG[r.id], canSell = run.phase === 'table' || run.phase === 'bar' || run.phase === 'cashout', locked = run.table?.asleep >= 0 && run.phase === 'table';
  open(`<div class="panel printed" style="width:min(380px,100%);text-align:center">
    <div style="width:110px;height:132px;margin:0 auto 12px;border-radius:6px;overflow:hidden;box-shadow:0 0 0 4px var(--paper),0 0 0 5px rgba(0,0,0,.2)">${portraitSVG(r.id)}</div>
    <h2>${R.name}</h2><div class="sub">${['', 'a regular', 'a good regular', 'a legend'][R.tier]}</div>
    <p style="font-size:17px">${R.text}${r.id === 'mel' ? ` <b>Now +${r.n || 0}.</b>` : ''}</p>
    <p class="foot">${i === run.regs.length - 1 && run.regs.length > 1 ? 'Sitting last: their × Mult comes after everyone’s +.' : 'Regulars pay out in seat order, left to right.'}</p>
    <div class="acts">
      <button class="btn ghost" type="button" id="mvL" ${i === 0 || locked ? 'disabled' : ''}>← Move</button>
      <button class="btn ghost" type="button" id="mvR" ${i === run.regs.length - 1 || locked ? 'disabled' : ''}>Move →</button>
      <button class="btn ghost" type="button" id="sell" ${!canSell || locked ? 'disabled' : ''}>Send home (+$${G.sellPrice(r)})</button>
      <button class="btn" type="button" data-close autofocus>Done</button>
    </div>
  </div>`, s => {
    const back = () => { renderAll(); backToPhase(); };
    s.querySelector('[data-close]').addEventListener('click', back);
    s.querySelector('#mvL').addEventListener('click', () => { G.moveSeat(run, i, -1); save(); renderSeats(); seatSheet(i - 1); });
    s.querySelector('#mvR').addEventListener('click', () => { G.moveSeat(run, i, 1); save(); renderSeats(); seatSheet(i + 1); });
    let sure = false;
    s.querySelector('#sell').addEventListener('click', e => {
      if (!sure) { sure = true; e.currentTarget.textContent = 'Sure? Tap again'; return; }
      G.sell(run, i); Sound.play('coin'); save(); back();
    });
  });
}

// Close whatever was on top and show what the night is waiting on: the receipt, the bar, the last word.
function backToPhase() {
  if (!$('#paintbar').hidden && !ui.paint) return close();   // still looking at the board
  if (run.phase === 'bar') barSheet();
  else if (run.phase === 'cashout') receipt();
  else if (run.phase === 'over') overSheet(true);
  else if (run.phase === 'won') wonSheet();
  else close();
}

function receipt() {
  const out = run.last, res = run.table.result, T = run.table;
  const rows = out.rows.map(([k, v]) => `<div class="r ${v < 0 ? 'neg' : ''}"><span>${k}</span><b>${v < 0 ? '−$' + -v : '$' + v}</b></div>`).join('');
  const broke = out.broke.length ? `<p class="note">The ${out.broke.map(c => cardName(c)).join(' and the ')} shattered.</p>` : '';
  open(`<div class="panel receipt">
    <div class="hd">The Five by Five<br>${T.boss ? 'House table · ' + BOSS[T.boss].name : 'Ante ' + run.ante + ' · table'}</div>
    <div class="r"><span>Needed</span><b>${fmt(res.target)}</b></div>
    <div class="r"><span>Scored</span><b>${fmt(res.total)}</b></div>
    <div class="big" style="color:${out.won ? '#2f8a52' : 'var(--red)'}">${out.won ? 'PAID' : 'SHORT'}</div>
    ${out.marker ? '<p class="note">You were short. The house takes your marker this once, and half your money with it.</p>' : ''}
    ${rows}
    <div class="r tot"><span>${out.total >= 0 ? 'Paid out' : 'Lost'}</span><b>$${Math.abs(out.total)}</b></div>
    <div class="r"><span>In your pocket</span><b>$${run.money}</b></div>
    ${broke}
    <div class="acts"><button class="btn" type="button" id="toBar" autofocus>To the bar</button><button class="btn ghost" type="button" id="look">See the board</button></div>
  </div>`, s => {
    s.querySelector('#toBar').addEventListener('click', () => { G.openBar(run); save(); barSheet(); tutor('bar'); });
    s.querySelector('#look').addEventListener('click', () => lookAtBoard(receipt));
  });
}

// Put the sheet aside to look at the finished board; a tag at the top brings it back.
function lookAtBoard(back) {
  close();
  const pb = $('#paintbar');
  pb.innerHTML = `<span>Your board: ${fmt(run.table.result.total)} of ${fmt(run.table.target)}</span><button class="btn" type="button" id="pbX">Back</button>`;
  pb.hidden = false;
  pb.querySelector('#pbX').addEventListener('click', () => { pb.hidden = true; back(); });
}

function offerHTML(o, i) {
  let pic, name, text, tier = '', label;
  if (o.kind === 'reg') { const R = REG[o.id]; pic = portraitSVG(o.id); name = R.name; text = R.text; tier = ['', 'regular', 'good regular', 'legend'][R.tier]; label = `Buy a drink $${o.price}`; }
  else if (o.kind === 'tip') { const h = HANDS.find(x => x.id === o.id), lv = run.levels[o.id] || 0; pic = goodIcon('tip'); name = `Tip sheet: ${h.name}`; text = `${h.name} pays +${h.up[0]} Chips and +${h.up[1]} Mult for the rest of the night.${lv ? ` (Tipped ${lv}× already.)` : ''}`; tier = 'tip'; label = `Buy $${o.price}`; }
  else if (o.kind === 'trick') { const t = TRICK[o.id]; pic = goodIcon('trick', o.id); name = t.name; text = t.text; tier = 'the bartender’s trick'; label = `Buy $${o.price}`; }
  else { const f = FELT_OF[o.id]; pic = goodIcon('felt', o.id); name = f.name; text = f.text + ' You pick the square.'; tier = 'felt work'; label = `Buy $${o.price}`; }
  const can = G.canBuy(run, i), why = o.sold ? 'Sold' : o.kind === 'reg' && run.regs.length >= SEATS ? 'No empty seat' : run.money < o.price ? label : label;
  return `<div class="offer ${o.sold ? 'sold' : ''}"><div class="pic ${o.kind === 'reg' ? '' : 'icon'}">${pic}</div><div><span class="tier">${tier}</span><b>${name}</b><p>${text}</p></div>
    <button class="buy" type="button" data-buy="${i}" ${can ? '' : 'disabled'}>${why}</button></div>`;
}
function barSheet() {
  const B = run.bar;
  if (B.pending?.kind === 'trick') return trickSheet();
  if (B.pending?.kind === 'felt') return startPaint();
  const nx = G.nextTable(run), lv = Object.entries(run.levels);
  const regs = B.offers.map((o, i) => [o, i]).filter(([o]) => o.kind === 'reg'), goods = B.offers.map((o, i) => [o, i]).filter(([o]) => o.kind !== 'reg');
  open(`<div class="panel bar">
    <div class="top"><div><h2>The Bar</h2><p class="sub">Drinks, tips, tricks and felt work. Spend it or keep it: every $5 you hold earns $1 after a table.</p></div><div class="cash">$${run.money}<small>in your pocket</small></div></div>
    <h3>Regulars looking for a seat</h3><div class="shelf">${regs.map(([o, i]) => offerHTML(o, i)).join('') || '<p>Everyone’s already at your table.</p>'}</div>
    <h3>Under the counter</h3><div class="shelf">${goods.map(([o, i]) => offerHTML(o, i)).join('')}</div>
    <h3>At your table (${run.regs.length} of ${SEATS} seats)</h3>
    <div class="yours">${run.regs.map((r, i) => `<div class="mine"><div class="pic">${portraitSVG(r.id)}</div><div class="ctl"><b>${REG[r.id].name}</b><div class="row">
      <button type="button" data-mv="${i}:-1" ${i === 0 ? 'disabled' : ''} aria-label="Move left">←</button><button type="button" data-mv="${i}:1" ${i === run.regs.length - 1 ? 'disabled' : ''} aria-label="Move right">→</button><button type="button" data-seat="${i}">More</button></div></div></div>`).join('') || '<p class="sub" style="opacity:.6">Nobody yet.</p>'}</div>
    ${lv.length ? `<h3>Tips you’ve bought</h3><div class="levels">${lv.map(([id, n]) => `<span>${HANDS.find(h => h.id === id).name} ×${n}</span>`).join('')}</div>` : ''}
    <div class="board-note"><b>Next: ${nx.boss ? `<span class="rule">${BOSS[nx.boss].name}</span>` : 'a plain table'}${nx.ante > ANTES ? ' (after hours)' : ''}</b><span>${nx.boss ? BOSS[nx.boss].text + ' ' : ''}Need ${fmt(nx.target)}.</span></div>
    <div class="acts"><button class="btn ghost" type="button" id="reroll" ${run.money < G.rerollCost(run) ? 'disabled' : ''}>New faces $${G.rerollCost(run)}</button><button class="btn red" type="button" id="leave">Back to the table</button></div>
  </div>`, s => {
    s.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.buy;
      if (!G.buy(run, i)) return;
      Sound.play('coin'); save(); renderAll(); barSheet();
    }));
    s.querySelectorAll('[data-mv]').forEach(b => b.addEventListener('click', () => { const [i, d] = b.dataset.mv.split(':').map(Number); G.moveSeat(run, i, d); save(); renderSeats(); barSheet(); }));
    s.querySelectorAll('[data-seat]').forEach(b => b.addEventListener('click', () => seatSheet(+b.dataset.seat)));
    s.querySelector('#reroll').addEventListener('click', () => { if (G.reroll(run)) { Sound.play('deal'); save(); renderAll(); barSheet(); } });
    s.querySelector('#leave').addEventListener('click', leaveBar);
  });
}
function leaveBar() {
  if (!G.leaveBar(run)) return;
  save(); close(); ui.target = -1;
  renderAll();
  if (run.table.boss) bossSheet(); else { dealt(); tutor('start'); }
}
function trickSheet() {
  const p = run.bar.pending, t = TRICK[p.id], picked = new Set();
  const cards = p.choices.map(id => G.cardById(run, id)).filter(Boolean);
  open(`<div class="panel trick">
    <h2>${t.name}</h2><p class="sub">${t.text} The bartender deals seven off your deck: pick ${t.pick === 1 ? 'one' : 'up to ' + ['', 'one', 'two', 'three'][t.pick]}.</p>
    <div class="hand">${cards.map(c => `<button type="button" data-id="${c.id}" aria-pressed="false" aria-label="${cardName(c)}${c.e ? ', ' + markText[c.e] : ''}">${cardHTML(c)}</button>`).join('')}</div>
    <div class="acts"><button class="btn ghost" type="button" id="nvm">Never mind (refund)</button><button class="btn" type="button" id="done" disabled>Do it</button></div>
  </div>`, s => {
    const done = s.querySelector('#done');
    s.querySelectorAll('.hand button').forEach(b => b.addEventListener('click', () => {
      const id = +b.dataset.id;
      if (picked.has(id)) picked.delete(id); else { if (picked.size >= t.pick) { if (t.pick === 1) { picked.clear(); s.querySelectorAll('.hand button').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); } else return; } picked.add(id); }
      b.classList.toggle('on', picked.has(id)); b.setAttribute('aria-pressed', String(picked.has(id)));
      done.disabled = !picked.size; Sound.play('tap');
    }));
    s.querySelector('#nvm').addEventListener('click', () => { G.cancelPending(run); save(); renderAll(); barSheet(); });
    done.addEventListener('click', () => { G.applyTrick(run, [...picked]); Sound.play('ding'); save(); renderAll(); barSheet(); });
  });
}
// Felt work: the bar steps aside so you can pick the square on the table.
function startPaint() {
  close();
  ui.paint = true;
  const f = FELT_OF[run.bar.pending.id], pb = $('#paintbar');
  pb.innerHTML = `<span>${f.name}: pick a square to paint.</span><button class="btn" type="button" id="pbX">Never mind</button>`;
  pb.hidden = false;
  pb.querySelector('#pbX').addEventListener('click', cancelPaint);
  $('#game').hidden = false; fit();
  renderAll();
}
function cancelPaint() { G.cancelPending(run); endPaint(); }
function paintAt(cell) {
  if (!G.applyFelt(run, cell)) { Sound.play('buzz'); return; }
  Sound.play('snap');
  endPaint();
}
function endPaint() { ui.paint = false; $('#paintbar').hidden = true; save(); renderAll(); barSheet(); }

function bossSheet() {
  const b = BOSS[run.table.boss], no = run.ante <= ANTES ? run.ante : '?';
  Sound.play('boss');
  open(`<div class="panel printed rulecard" style="width:min(400px,100%)">
    <div class="no">House rule no. ${no}</div><h2>${b.name}</h2><p>${b.text}</p>
    <p class="need">Need ${fmt(run.table.target)}</p>
    <div class="acts"><button class="btn" type="button" data-close autofocus>Sit down</button></div>
  </div>`, s => s.querySelector('[data-close]').addEventListener('click', () => { close(); renderAll(); dealt(); tutor('boss'); }));
}

function overSheet(quiet = false) {
  const T = run.table, best = run.stats.bestHand;
  if (!quiet) Sound.play('lose');
  open(`<div class="panel receipt">
    <div class="hd">The Five by Five<br>Closing time</div>
    <div class="big" style="color:var(--red)">THE HOUSE WINS</div>
    <div class="r"><span>Out at</span><b>Ante ${run.ante}${T.boss ? ', ' + BOSS[T.boss].name : ''}</b></div>
    <div class="r"><span>Needed / scored</span><b>${fmt(T.target)} / ${fmt(T.result.total)}</b></div>
    <div class="r"><span>Tables won</span><b>${run.stats.won}</b></div>
    <div class="r"><span>Best table</span><b>${fmt(run.stats.best)}</b></div>
    <div class="r"><span>Best hand</span><b>${best >= 0 ? HANDS[best].name : '—'}</b></div>
    <div class="r"><span>At your table</span><b>${run.regs.map(r => REG[r.id].name).join(', ') || 'nobody'}</b></div>
    <p class="note">${run.ante <= 2 ? 'Rows for pairs, columns for suits. Try it.' : run.ante <= 5 ? 'Not bad. The regulars at the bar make the difference.' : 'So close to the House’s own table.'}</p>
    <div class="acts"><button class="btn" type="button" id="again" autofocus>Another night</button><button class="btn ghost" type="button" id="look">See the board</button><button class="btn ghost" type="button" id="door">Back to the door</button></div>
  </div>`, s => {
    store.del(KEY);
    s.querySelector('#look').addEventListener('click', () => lookAtBoard(() => overSheet(true)));
    s.querySelector('#again').addEventListener('click', newNight);
    s.querySelector('#door').addEventListener('click', titleSheet);
  });
}
function wonSheet() {
  open(`<div class="panel receipt">
    <div class="hd">The Five by Five<br>The House’s own table</div>
    <div class="big" style="color:#2f8a52">YOU BEAT THE HOUSE</div>
    <div class="r"><span>Scored</span><b>${fmt(run.table.result.total)}</b></div>
    <div class="r"><span>Tables won</span><b>${run.stats.won}</b></div>
    <div class="r"><span>Best table</span><b>${fmt(run.stats.best)}</b></div>
    <div class="r"><span>Best hand</span><b>${HANDS[Math.max(0, run.stats.bestHand)].name}</b></div>
    <div class="r"><span>Your table</span><b>${run.regs.map(r => REG[r.id].name).join(', ') || 'just you'}</b></div>
    <p class="note">The management would like a word. They’ll keep dealing after hours if you’d like to see how far it goes.</p>
    <div class="acts"><button class="btn" type="button" id="more" autofocus>Keep playing after hours</button><button class="btn ghost" type="button" id="door">Call it a night</button></div>
  </div>`, s => {
    s.querySelector('#more').addEventListener('click', () => { G.keepPlaying(run); save(); receipt(); });
    s.querySelector('#door').addEventListener('click', () => { store.del(KEY); titleSheet(); });
  });
}

// ------------------------------------------------------------------ the dealer's notes, the first night only
const NOTE_TEXT = {
  start: ['Put it in any square. It stays put.', () => board],
  placed2: ['Every row, every column and both diagonals is a poker hand. Twelve hands. They all pay.', () => board],
  placed5: ['Rows are good for pairs. Columns are good for suits.', () => board],
  burn: ['Don’t want it? Burn it. Three matches a table.', () => $('#burn')],
  count: ['Now we count. Tap to hurry the machine along.', () => $('#tape')],
  bar: ['Buy a regular a drink and they sit in. They bend the arithmetic.', () => $('.bar .shelf')],
  boss: ['Every second table the house changes a rule. It’s written on the slate.', () => $('#hud')],
};
let noteFor = null;
function tutor(ev) {
  if (DEMO || AUTO) return;
  let key = ev;
  if (ev === 'placed') {
    const n = run.table.placed;
    key = n === 2 ? 'placed2' : n === 5 ? 'placed5' : n === 9 && G.burnsLeft(run) > 0 ? 'burn' : null;
    if (!key && noteFor && noteFor !== 'count') hideNote();
  }
  if (!key || notes[key]) return;
  const [text, at] = NOTE_TEXT[key];
  notes[key] = 1; store.set(NOTES, notes);
  setTimeout(() => showNote(key, text, at()), key === 'bar' ? 350 : 60);
}
function showNote(key, text, el) {
  const n = $('#note');
  if (!el) return;
  noteFor = key;
  n.innerHTML = `${text}<small>the dealer · tap to tuck it away</small>`;
  n.hidden = false;
  const r = el.getBoundingClientRect(), w = n.offsetWidth, h = n.offsetHeight;
  let x = r.left + r.width / 2 - w / 2, y = r.top - h - 10;
  if (key === 'start' || key === 'placed2' || key === 'placed5') y = r.top - h * .35;
  if (y < 8) y = r.bottom + 10;
  x = Math.max(8, Math.min(innerWidth - w - 8, x)); y = Math.max(8, Math.min(innerHeight - h - 8, y));
  n.style.left = x + 'px'; n.style.top = y + 'px';
  if (!reduce.matches) n.animate([{ opacity: 0, transform: 'rotate(-6deg) translateY(10px)' }, { opacity: 1, transform: 'rotate(-1.5deg)' }], { duration: 240, easing: 'ease-out' });
  if (key === 'bar') n.style.zIndex = 120; else n.style.zIndex = '';
}
function hideNote() { $('#note').hidden = true; noteFor = null; }
$('#note').addEventListener('click', hideNote);

// ------------------------------------------------------------------ tools
$('#bHands').addEventListener('click', () => coaster());
$('#bShoe').addEventListener('click', ledger);
$('#bRules').addEventListener('click', () => rules());
$('#bSound').addEventListener('click', () => { Sound.wake(); Sound.cycle(); renderAll(); });

// ------------------------------------------------------------------ nights
function newNight() {
  const seed = Q.has('seed') ? +Q.get('seed') : (Math.random() * 2 ** 31) | 0;
  run = G.newRun(seed);
  stats.nights++; store.set(STATS, stats);
  save();
  enter();
  if (!notes.rules) { notes.rules = 1; store.set(NOTES, notes); rules(false, true); }
  else tutor('start');
}
function resume(saved) { run = saved; enter(); }
// Sit down at whatever the saved night was doing.
function enter() {
  close();
  $('#game').hidden = false;
  ui.scoring = false; ui.paint = false; ui.target = -1;
  renderAll();
  fit();
  if (run.phase === 'table') { dealt(); if (run.table.boss && run.table.placed === 0 && run.table.used === 0 && !AUTO) bossSheet(); }
  else if (run.phase === 'scored') count();
  else if (run.phase === 'cashout') receipt();
  else if (run.phase === 'bar') barSheet();
  else if (run.phase === 'over') overSheet();
  else if (run.phase === 'won') wonSheet();
}

// ------------------------------------------------------------------ ?autoplay: the house bot plays through the page
function autoplay() {
  ui.bot = new Bot({ samples: 10, pick: 2 });
  const step = () => {
    if (!run) return setTimeout(step, 300);
    if (!sheet.hidden) {
      const b = sheet.querySelector('#toBar, #more, [data-close]');
      if (run.phase === 'bar' && !run.bar.pending) { ui.bot.shop(run); leaveBar(); }
      else if (run.phase === 'over' || (run.phase === 'won' && Q.get('autoplay') !== 'endless')) { console.log('autoplay done', run.phase, run.ante); return; }
      else b?.click();
      return setTimeout(step, 250);
    }
    if (run.phase === 'table' && !ui.busy && !ui.scoring) {
      const m = ui.bot.choose(run);
      if (m.act === 'burn') burn(); else put(m.cell);
    }
    setTimeout(step, +Q.get('pace') || 160);
  };
  step();
}

// ------------------------------------------------------------------ ?demo: a board frozen mid-count, for the preview
async function demo() {
  document.body.classList.add('demo');
  run = G.newRun(+Q.get('seed') || 20251);
  Object.assign(run, { ante: 3, stage: 0, money: 11 });
  run.regs = ['al', 'sal', 'hustler', 'widow'].map(id => ({ id, n: 0 }));
  run.felt[12] = 'hot'; run.felt[6] = 'lucky';
  run.levels = { flush: 1, full: 1 };
  G.startTable(run);
  new Bot({ samples: 24, pick: 3 }).playTable(run);
  $('#game').hidden = false; fit();
  ui.scoring = true;
  renderAll();
  const res = run.table.result, tape = $('#tape');
  const upto = res.lines.slice(3, 11).reduce((b, l, i) => l.total > res.lines[b].total ? i + 3 : b, 3);
  tape.innerHTML = `<div class="row"><span>THE FIVE BY FIVE · NEED ${fmt(res.target)}</span></div>`;
  let total = 0;
  res.lines.slice(0, upto).forEach(L => { total += L.total; tape.insertAdjacentHTML('beforeend', `<div class="row"><span>${G.lineShort(LINES[L.li]).toUpperCase()} <b>${handOnTape(L.pay)}</b> ${fmt(L.chips)}×${L.mult % 1 ? L.mult.toFixed(1) : L.mult}</span><b>${fmt(L.total)}</b></div>`); });
  const L = res.lines[upto], mid = L.steps[Math.max(1, L.steps.length - 2)];
  $('#got').textContent = fmt(total);
  $('#mc').textContent = fmt(mid.C); $('#mm').textContent = fmt(mid.M); $('#mlabel').textContent = HANDS[L.pay].name;
  light([L.li], true);
  linePill(L);
  const cardStep = L.steps.find(s => s.t === 'card');
  if (cardStep) { const p = cellCenter(cardStep.cell), f = document.createElement('div'); f.className = 'float chip'; f.textContent = '+' + (cardStep.chips || 10); f.style.left = p.x + 'px'; f.style.top = p.y - 20 + 'px'; board.append(f); }
  const regStep = L.steps.find(s => s.t === 'reg');
  if (regStep) { const s = $(`#seats .seat[data-seat="${regStep.seat}"]`); s?.insertAdjacentHTML('beforeend', `<span class="say ${regStep.x ? 'x' : 'mul'}">${regStep.x ? '×' + regStep.x : '+' + regStep.mult + ' Mult'}</span>`); }
}

if (DEBUG) window.ff = { get run() { return run; }, set run(r) { run = r; }, G, Bot, Sound, count, put, burn, enter, renderAll, barSheet };

// ------------------------------------------------------------------ boot
document.fonts?.ready.then(() => { if (!$('#game').hidden) { renderAll(); fit(); } });
if (DEMO) demo();
else if (AUTO) { run = G.newRun(Q.has('seed') ? +Q.get('seed') : 777); enter(); autoplay(); }
else titleSheet();
void [backHTML, PRICE, rankName, SUIT_NAME];
