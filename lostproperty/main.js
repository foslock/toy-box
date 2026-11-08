import { ENTRIES, FINAL, BOX, CLERKS, search, tokens } from './ledger.js';
import { Sound } from './audio.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo');
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SHOW = 5;
const TOTAL = ENTRIES.length;
const touch = matchMedia('(pointer: coarse)').matches;
const narrow = () => innerWidth <= 920;
const sound = new Sound();

// ---------- saved desk ----------
const KEY = 'lostproperty';
const S = (() => {
  let d = {}; if (!DEMO) try { d = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch {}
  return { seen: new Set(d.seen || []), pins: d.pins || [], jot: d.jot || '', tut: d.tut ?? 0, searches: d.searches || 0,
    solved: !!d.solved, sound: d.sound !== false, hist: d.hist || [], visits: (d.visits || 0) + 1 };
})();
let saveT = 0;
function save() {
  if (DEMO) return;
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ ...S, seen: [...S.seen] })); } catch {}
  }, 120);
}
sound.on = S.sound;

// ---------- the terminal ----------
const out = $('out'), q = $('q'), caret = $('caret');
let cur = { q: '', ws: [], hits: [], open: -1, mode: 'boot' };

function line(text, cls = '', i = 0) {
  return `<div class="ln pr ${cls}" style="animation-delay:${i * 40}ms">${text}</div>`;
}
const byId = id => ENTRIES[id];
const findE = (date, start = '') => ENTRIES.find(e => e.date === date && e.item.startsWith(start));

function boot() {
  cur.mode = 'boot';
  const L = [
    ['GBC 2100 TERMINAL &middot; LEDGER SYSTEM v2.1 (P. SANDHU, 1996)', 'd'],
    [`MEMORY OK. ${TOTAL} ENTRIES LOADED, 1961&ndash;2001.`, 'd'],
    ['&nbsp;'],
  ];
  if (S.solved) L.push(['FILE LP/9 IS CLOSED. THE LEDGER STAYS OPEN.', 'b']);
  else if (S.seen.size) L.push([`WELCOME BACK. YOU HAVE READ ${S.seen.size} OF ${TOTAL} ENTRIES.`, 'b']);
  else L.push(['WELCOME, NEW CLERK.', 'b']);
  L.push(['TYPE A WORD AND PRESS ENTER.']);
  if (S.hist.length && !S.solved) L.push(['&nbsp;'], [`YOUR LAST SEARCH WAS "${esc(S.hist[0].toUpperCase())}".`, 'd']);
  out.innerHTML = L.map(([t, c], i) => line(t, c, i)).join('');
  sound.print(L.length);
}

function doSearch(raw, src = 'type') {
  const text = raw.trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!tokens(text).length) { q.value = ''; moveCaret(); return; }
  const { ws, hits } = search(text);
  cur = { q: text, ws, hits, open: -1, mode: 'search' };
  S.searches++;
  S.hist = [text.toLowerCase(), ...S.hist.filter(h => h !== text.toLowerCase())].slice(0, 12);
  q.value = text.toUpperCase(); moveCaret();
  renderResults();
  renderHist();
  save();
  sound.enter();
  sound.print(Math.min(SHOW, hits.length) + 2);
  if (!hits.length) sound.none();
  if (S.tut === 0) tutTo(1);
  else if (S.tut === 2 && src === 'word') tutTo(3);
  if (touch) q.blur();
}

function renderResults() {
  const { q: text, hits } = cur;
  let h = line(`&gt; ${esc(text.toUpperCase())}`, 'b');
  if (!hits.length) h += line('NO ENTRIES MATCH. TRY ANOTHER WORD.', 'd', 1);
  else if (hits.length === 1) h += line('1 ENTRY MATCHES.', 'd', 1);
  else if (hits.length <= SHOW) h += line(`${hits.length} ENTRIES MATCH.`, 'd', 1);
  else h += line(`${hits.length} ENTRIES MATCH. SHOWING THE FIRST ${SHOW}.`, 'd', 1);
  h += '<div class="rule pr" style="animation-delay:80ms"></div>';
  hits.slice(0, SHOW).forEach((e, i) => { h += rowHTML(e, i + 2); });
  if (hits.length > SHOW) h += line(`+ ${hits.length - SHOW} MORE. ADD ANOTHER WORD TO NARROW IT DOWN.`, 'd', SHOW + 3);
  out.innerHTML = h;
  out.scrollTop = 0;
}

function rowHTML(e, i) {
  const open = cur.open === e.id;
  return `<button class="row pr${open ? ' open' : ''}" data-id="${e.id}" style="animation-delay:${i * 40}ms" aria-expanded="${open}">` +
    `<span class="no">${e.no}</span><span class="dt">${e.dateText}</span><span class="it">${esc(e.item)}</span><span class="sn">${S.seen.has(e.id) ? '*' : ''}</span></button>` +
    (open ? cardHTML(e) : '');
}

function wordsHTML(s) {
  const hit = new Set(cur.ws);
  return esc(s).replace(/[A-Za-z0-9][A-Za-z0-9']*/g, w => {
    const k = w.toLowerCase().replace(/'/g, '');
    const n = k.length > 3 && k.endsWith('s') && !k.endsWith('ss') ? k.slice(0, -1) : k;
    return `<span class="w${hit.has(n) ? ' hit' : ''}" data-w="${esc(k)}">${w}</span>`;
  });
}

function field(k, v, cls = '') {
  return `<div class="f ${cls}"><span class="k">${k}</span><span class="v">${v}</span></div>`;
}
function cardHTML(e) {
  const pinned = S.pins.includes(e.id);
  return `<div class="card">` +
    field('LEDGER No.', `${e.no} &middot; ${e.dateText}`) +
    field('ITEM', wordsHTML(e.item)) +
    field('FOUND AT', wordsHTML(e.where)) +
    field('HANDED IN', wordsHTML(e.by)) +
    field('COLLECTED', wordsHTML(e.coll)) +
    (e.note ? field('NOTE', wordsHTML(e.note), 'note') : '') +
    field('CLERK', `${wordsHTML(e.c)} &middot; ${esc(CLERKS[e.c].toUpperCase())}`) +
    `<div class="acts"><button class="btn${pinned ? ' on' : ''}" data-act="pin" data-id="${e.id}">${pinned ? 'UNPIN' : 'PIN TO PAD'}</button>` +
    `<button class="btn" data-act="close">CLOSE</button></div></div>`;
}

function openEntry(id, scroll = true) {
  cur.open = cur.open === id ? -1 : id;
  if (cur.open >= 0) {
    const fresh = !S.seen.has(id);
    S.seen.add(id); save(); sound.open();
    if (fresh) renderStatus();
  }
  rerenderRows();
  if (cur.open >= 0) {
    if (S.tut === 1) tutTo(2);
    if (scroll) {
      const row = out.querySelector(`.row[data-id="${id}"]`);
      if (row) {
        const top = row.offsetTop - out.offsetTop;
        if (top < out.scrollTop || top > out.scrollTop + out.clientHeight * .5) out.scrollTo({ top: top - 6, behavior: 'smooth' });
      }
    }
  }
}

function rerenderRows() {
  // redraw rows in place without replaying the print animation
  const list = cur.mode === 'pin' ? cur.hits : cur.hits.slice(0, SHOW);
  out.querySelectorAll('.row').forEach(r => r.nextElementSibling?.classList.contains('card') && r.nextElementSibling.remove());
  out.querySelectorAll('.row').forEach(r => {
    const e = byId(+r.dataset.id);
    const tmp = document.createElement('div');
    tmp.innerHTML = rowHTML(e, 0);
    const [nr, card] = tmp.children;
    nr.classList.remove('pr'); nr.style.animationDelay = '';
    r.replaceWith(nr);
    if (card) nr.after(card);
  });
  void list;
}

function showPinned(id) {
  const e = byId(id);
  cur = { q: '', ws: [], hits: [e], open: -1, mode: 'pin' };
  out.innerHTML = line('&gt; FROM YOUR PAD', 'b') + '<div class="rule"></div>' + rowHTML(e, 1);
  openEntry(id, false);
  sound.print(2);
  closePad();
}

out.addEventListener('click', ev => {
  const w = ev.target.closest('.w');
  if (w) { doSearch(w.dataset.w, 'word'); return; }
  const act = ev.target.closest('[data-act]');
  if (act) {
    if (act.dataset.act === 'close') { const id = cur.open; cur.open = -1; rerenderRows(); out.querySelector(`.row[data-id="${id}"]`)?.focus({ preventScroll: true }); }
    if (act.dataset.act === 'pin') togglePin(+act.dataset.id);
    return;
  }
  const row = ev.target.closest('.row');
  if (row) openEntry(+row.dataset.id);
});

// ---------- the prompt ----------
const mctx = document.createElement('canvas').getContext('2d');
function moveCaret() {
  const fs = parseFloat(getComputedStyle(q).fontSize);
  mctx.font = `${fs}px VT323`;
  const v = q.value.toUpperCase();
  const pos = Math.min(q.selectionStart ?? v.length, v.length);
  const s = v.slice(0, pos);
  const w = mctx.measureText(s).width + s.length * fs * .03;
  caret.style.left = Math.min(w - q.scrollLeft, q.clientWidth - 8) + 'px';
  caret.style.height = Math.round(fs * .82) + 'px';
  caret.style.top = Math.round(fs * .12) + 'px';
  caret.style.display = v.length ? '' : (document.activeElement === q ? '' : 'none');
}
q.addEventListener('input', () => { q.value = q.value.replace(/[^A-Za-z0-9 ']/g, ''); moveCaret(); });
['keyup', 'click', 'focus', 'blur', 'select'].forEach(t => q.addEventListener(t, moveCaret));
let hi = -1;
q.addEventListener('keydown', ev => {
  sound.start();
  if (ev.key.length === 1 || ev.key === 'Backspace') sound.key();
  if (ev.key === 'ArrowUp' && S.hist.length) { hi = Math.min(S.hist.length - 1, hi + 1); q.value = S.hist[hi].toUpperCase(); ev.preventDefault(); moveCaret(); }
  if (ev.key === 'ArrowDown') { hi = Math.max(-1, hi - 1); q.value = hi < 0 ? '' : S.hist[hi].toUpperCase(); ev.preventDefault(); moveCaret(); }
});
$('f').addEventListener('submit', ev => { ev.preventDefault(); sound.start(); hi = -1; doSearch(q.value); });

function renderHist() {
  const h = $('hist');
  if (!S.hist.length) { h.innerHTML = ''; return; }
  h.innerHTML = '<b>RECENT:</b>' + S.hist.slice(0, 8).map(s => `<button data-h="${esc(s)}">${esc(s.toUpperCase())}</button>`).join('');
}
$('hist').addEventListener('click', ev => { const b = ev.target.closest('[data-h]'); if (b) { sound.start(); doSearch(b.dataset.h); } });

function renderStatus() {
  $('stRead').textContent = S.solved ? `FILE CLOSED · READ ${S.seen.size}/${TOTAL}` : `READ ${S.seen.size}/${TOTAL} · * = READ`;
  $('stSnd').textContent = S.sound ? 'SOUND ON' : 'SOUND OFF';
}
$('stSnd').addEventListener('click', () => { S.sound = !S.sound; sound.start(); sound.set(S.sound); renderStatus(); save(); });

// ---------- the pad ----------
const pad = $('pad');
function togglePin(id) {
  const i = S.pins.indexOf(id);
  if (i >= 0) S.pins.splice(i, 1); else S.pins.unshift(id);
  save(); sound.paper(); renderPins(); rerenderRows();
  if (i < 0 && S.tut === 3) tutTo(4);
}
function renderPins() {
  const el = $('pins');
  $('padN').textContent = S.pins.length ? `(${S.pins.length})` : '';
  if (!S.pins.length) { el.innerHTML = '<div class="empty">pinned entries go here</div>'; return; }
  el.innerHTML = S.pins.map(id => {
    const e = byId(id);
    const it = e.item.length > 46 ? e.item.slice(0, 44) + '…' : e.item;
    return `<button class="pin" data-id="${id}"><small>${e.dateText.toLowerCase()} · ${esc(e.by === '-' ? CLERKS[e.c] : e.by)}</small>${esc(it)}<span class="x" data-x="${id}" aria-label="Unpin">×</span></button>`;
  }).join('');
}
$('pins').addEventListener('click', ev => {
  const x = ev.target.closest('[data-x]');
  if (x) { ev.stopPropagation(); togglePin(+x.dataset.x); return; }
  const p = ev.target.closest('.pin');
  if (p) { sound.start(); showPinned(+p.dataset.id); }
});
const jot = $('jotT');
jot.value = S.jot;
jot.addEventListener('input', () => { S.jot = jot.value.slice(0, 4000); save(); });

function openPad() { if (!narrow()) return; pad.classList.add('open'); $('scrim').classList.add('on'); sound.paper(); }
function closePad() { pad.classList.remove('open'); $('scrim').classList.remove('on'); }
$('padTab').addEventListener('click', () => { sound.start(); openPad(); });
$('padX').addEventListener('click', closePad);
$('scrim').addEventListener('click', closePad);

// Priya's note on the pad: hints
const K = {
  list: findE('1979-03-15'), bag: findE('1961-04-20'), cake: findE('1986-03-14', 'Cake'), cellar: findE('1986-03-17'),
  effects: findE('1997-02-11'), heron: findE('1987-03-14'), choc: findE('1988-03-14'),
};
const irisIds = ENTRIES.filter(e => e.date.endsWith('-03-14') && /^Mrs [A-Z][a-z]+$/.test(e.by)).map(e => e.id);
function hint() {
  const seen = e => S.seen.has(e.id);
  if (S.solved) return 'You did it. Maureen would never say so, so I will: well done.';
  if (!irisIds.some(id => S.seen.has(id))) return 'Joan had a name for somebody who came in a lot: the BIRD lady. Start there.';
  if (!seen(K.list)) return 'Joan said she was going to start a LIST. I bet she did.';
  if (!seen(K.cake) && !seen(K.heron) && !seen(K.choc)) return 'Always the 14th of March. Whose BIRTHDAY is that, I wonder?';
  if (!seen(K.bag) && !seen(K.cellar)) return 'Maureen came from ST AGNES House. Somebody else in this ledger did too, back in Mr Bewes\'s first year.';
  if (!seen(K.effects)) return 'Miss I. Penhale. Whatever happened to her? Try PENHALE, or the nursing home: SEAVIEW.';
  return 'I think you know. Fill in the WHO? card. Two names.';
}
function setPriya(text, flash = true) {
  const n = $('priya'); n.querySelector('.txt').textContent = text;
  if (flash) { n.classList.remove('wr'); void n.offsetWidth; n.classList.add('wr'); }
}
const DEFAULT_NOTE = 'Maureen left a note taped to the screen: work out the bird lady, then fill in the WHO? card. Stuck? Ask me for a hint.';
$('bHint').addEventListener('click', () => { sound.start(); sound.paper(); setPriya(hint()); });
$('bWho').addEventListener('click', () => { sound.start(); closePad(); showPanel('who'); });
$('bHelp').addEventListener('click', () => { sound.start(); closePad(); showPanel('help'); });
$('stHelp').addEventListener('click', () => { sound.start(); showPanel('help'); });

// ---------- panels ----------
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('on', p.id === id));
  $('crt').classList.toggle('off', !!id);
  if (id === 'who') { $('whoMsg').textContent = ''; if (!touch) setTimeout(() => $('a1').focus(), 30); }
  if (!id && !touch) q.focus({ preventScroll: true });
}
$('whoX').addEventListener('click', () => showPanel(null));
$('helpX').addEventListener('click', () => showPanel(null));
$('helpTut').addEventListener('click', () => { showPanel(null); tutTo(0); });
$('helpWipe').addEventListener('click', () => {
  const b = $('helpWipe');
  if (b.dataset.sure) { try { localStorage.removeItem(KEY); } catch {} location.reload(); return; }
  b.dataset.sure = '1'; b.textContent = 'SURE? PRESS AGAIN';
  setTimeout(() => { delete b.dataset.sure; b.textContent = 'WIPE MY DESK'; }, 3000);
});
['a1', 'a2'].forEach(id => $(id).addEventListener('keydown', ev => {
  sound.start(); if (ev.key.length === 1 || ev.key === 'Backspace') sound.key();
  if (ev.key === 'Enter') { ev.preventDefault(); id === 'a1' ? $('a2').focus() : fileIt(); }
}));
$('whoGo').addEventListener('click', fileIt);

const BIRDS = new Set(ENTRIES.filter(e => irisIds.includes(e.id)).map(e => e.by.slice(4).toLowerCase()));
function fileIt() {
  sound.start(); sound.enter();
  const t1 = tokens($('a1').value), t2 = tokens($('a2').value);
  const msg = $('whoMsg');
  if (!t1.length || !t2.length) { msg.textContent = 'BOTH LINES, PLEASE. THE BOROUGH IS VERY PARTICULAR.'; return; }
  const ok1 = t1.includes('penhale') || (t1.includes('iris') && !t1.includes('tully'));
  const ok2 = t2.some(w => ['maureen', 'tully', 'mary'].includes(w)) && !t2.includes('penhale') || (t2.includes('mary') && t2.includes('penhale'));
  if (ok1 && ok2) { win(); return; }
  sound.none();
  let m;
  if (!ok1 && t1.some(w => BIRDS.has(w))) m = 'LINE 1: THAT WAS ONLY HER NAME FOR THE DAY. WHAT WAS HER REAL ONE?';
  else if (!ok1 && t1.includes('bird')) m = "LINE 1: THAT'S WHAT JOAN CALLED HER. THE LEDGER WANTS A NAME.";
  else if (!ok1 && (t1.includes('maureen') || t1.includes('tully'))) m = 'LINE 1: NO. MAUREEN ONLY EVER RECEIVED THEM.';
  else if (ok1 && t2.length === 1 && t2[0] === 'm') m = 'LINE 2: M. FOR WHO?';
  else if (ok1 && !ok2) m = 'LINE 1, THE LEDGER AGREES. LINE 2, IT DOES NOT.';
  else if (!ok1 && ok2) m = 'LINE 2, THE LEDGER AGREES. LINE 1, IT DOES NOT.';
  else m = 'THE LEDGER DOES NOT AGREE. KEEP READING.';
  msg.textContent = m;
}

function win() {
  S.solved = true; save(); renderStatus(); setPriya(hint(), false);
  showPanel('end');
  const el = $('endOut');
  const now = new Date(), MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const today = `${String(now.getDate()).padStart(2, '0')} ${MON[now.getMonth()]} 2002`;
  const F = (k, v) => `<div class="card" style="border:0;padding:0;margin:0;box-shadow:none"><div class="f"><span class="k">${k}</span><span class="v">${v}</span></div></div>`;
  const kept = BOX.filter(b => b.y > 1963).length;
  const L = [
    ['FORM LP/9 FILED.', 'b'], ['THE LEDGER AGREES.', 'b'], ['', '', 600],
    ['ONE MORE ENTRY CAME IN THIS MORNING. IT WAS ADDRESSED TO YOU.', 'd', 900], ['', ''],
    [`<div class="rule"></div>`, 'raw'],
    [F('LEDGER No.', `${2002} &middot; ${today}`), 'raw'],
    [F('ITEM', esc(FINAL.item)), 'raw'], [F('FOUND AT', esc(FINAL.where)), 'raw'], [F('HANDED IN', esc(FINAL.by)), 'raw'],
    [F('COLLECTED', esc(FINAL.coll)), 'raw'], [F('NOTE', `<span style="color:#b6ffc8">${esc(FINAL.note)}</span>`), 'raw', 2600], [F('CLERK', 'MT &middot; M. TULLY'), 'raw'],
    [`<div class="rule"></div>`, 'raw', 1400],
    ['BOX M, AS IT WAS', 'b', 400],
    ...BOX.map(b => [`<div class="bx"><span>${b.y}</span><span>${esc(b.item)} &mdash; ${esc(b.as)}${b.y < 1964 ? ' (auctioned)' : ''}</span></div>`, 'raw', 160]),
    ['', '', 700],
    [`IRIS PENHALE HANDED IN ${BOX.length} PRESENTS OVER ${BOX[BOX.length - 1].y - BOX[0].y + 1} YEARS, UNDER ${new Set(BOX.map(b => b.as)).size} NAMES.`, 'b', 900],
    [`${kept} OF THEM WERE KEPT, AGAINST REGULATION 4, AND COLLECTED IN THE END.`, 'b', 900],
    ['', '', 800],
    [`YOU READ ${S.seen.size} OF ${TOTAL} ENTRIES IN ${S.searches} SEARCHES.`, 'd', 600],
    ['<div class="acts"><button class="btn" id="endBack">KEEP READING</button></div>', 'raw', 500],
  ];
  el.innerHTML = '';
  let t = 300, i = 0;
  sound.bell();
  const step = () => {
    if (i >= L.length) { $('endBack')?.addEventListener('click', () => { showPanel(null); boot(); }); return; }
    const [txt, cls, pause = 0] = L[i++];
    const d = document.createElement('div');
    if (cls === 'raw') d.innerHTML = txt; else { d.className = `ln ${cls}`; d.innerHTML = txt || '&nbsp;'; }
    const p = $('end'), follow = p.scrollHeight - p.scrollTop - p.clientHeight < 90;
    el.appendChild(d);
    if (follow) p.scrollTop = p.scrollHeight;
    sound.print(1);
    setTimeout(step, 90 + pause);
  };
  setTimeout(step, t);
}

// ---------- tutorial ----------
const TUT = [
  () => 'Hello, new clerk! This is the old ledger: forty years of lost property. Type a word and press enter. Try UMBRELLA.',
  () => `It only ever shows the first five, oldest first.${cur.ws.includes('umbrella') ? ' Mr Bewes wrote down a LOT of umbrellas.' : cur.hits.length > 5 ? ` There are ${cur.hits.length} of these.` : ''} Tap one to open it.`,
  () => 'Every word in an entry is a search. Tap one to look it up. Names and places are good ones.',
  () => `Found something odd? PIN it to your pad so you don't lose it. Ha.${narrow() ? ' (Your pad is the yellow tab, bottom right.)' : ''}`,
  () => 'Last thing. Maureen left this taped to the screen: "IF ANYONE EVER WORKS OUT THE BIRD LADY, FILL IN THE WHO? CARD." I never did. Maybe you will.',
];
// on a desk the note sits on the pad in Priya's place; on a phone it's stuck to the screen
function placeTut() {
  const el = $('tut'), on = S.tut < TUT.length;
  if (narrow()) { if (el.parentElement !== $('monitor')) $('monitor').appendChild(el); $('priya').style.display = ''; }
  else { if (el.parentElement !== pad) $('priya').before(el); $('priya').style.display = on ? 'none' : ''; }
}
function tutTo(n) {
  S.tut = n; save();
  const el = $('tut');
  document.querySelectorAll('.glow').forEach(g => g.classList.remove('glow'));
  if (n >= TUT.length) { el.classList.remove('on'); $('priya').style.display = ''; setPriya(DEFAULT_NOTE); return; }
  placeTut();
  el.querySelector('.txt').innerHTML = esc(TUT[n]()).replace(/\b(UMBRELLA|PIN|WHO\?)/g, '<b>$1</b>') + '<span class="sig"> &mdash; Priya</span>';
  el.querySelector('.step').textContent = `${n + 1} of ${TUT.length}`;
  const skip = $('tutSkip');
  skip.textContent = n === TUT.length - 1 ? 'got it' : 'skip';
  skip.classList.toggle('big', n === TUT.length - 1);
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  if (n === 0) { $('qwrap').parentElement.classList.add('glow'); if (!touch) q.focus({ preventScroll: true }); }
  if (n === 3 && narrow()) $('padTab').classList.add('glow');
  if (n === 4) $(narrow() ? 'padTab' : 'bWho').classList.add('glow');
  sound.paper();
}
$('tutSkip').addEventListener('click', () => { sound.start(); tutTo(TUT.length); });

// ---------- keys ----------
addEventListener('keydown', ev => {
  if (ev.target === q || ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') {
    if (ev.key === 'Escape') ev.target.blur();
    return;
  }
  if (ev.key === 'Escape') {
    if (document.querySelector('.panel.on') && !$('end').classList.contains('on')) showPanel(null);
    else if (pad.classList.contains('open')) closePad();
    else if (cur.open >= 0) { cur.open = -1; rerenderRows(); }
    return;
  }
  if (ev.key === '/' || (ev.key.length === 1 && /[a-z0-9]/i.test(ev.key) && !ev.metaKey && !ev.ctrlKey && !ev.altKey && !document.querySelector('.panel.on'))) {
    if (ev.key === '/') ev.preventDefault();
    else if (document.activeElement?.closest('#pad')) return;
    q.focus(); if (ev.key === '/') return;
  }
});
addEventListener('pointerdown', () => sound.start(), { once: true });
addEventListener('resize', () => { moveCaret(); placeTut(); if (!narrow()) closePad(); });
document.fonts?.ready.then(moveCaret);

// ---------- start ----------
$('nEnt').textContent = TOTAL;
$('crt').classList.remove('off');
renderStatus(); renderPins(); renderHist();
setPriya(DEFAULT_NOTE, false);

if (DEMO) {
  S.tut = TUT.length; S.searches = 9;
  S.hist = ['bird', 'starling', 'bench', 'march', 'joan', 'umbrella'];
  const ids = [findE('1962-03-14').id, K.list.id, K.bag.id, findE('1963-03-14').id];
  S.pins = ids; ids.forEach(id => S.seen.add(id));
  [5, 9, 12, 30, 44].forEach(i => S.seen.add(i));
  jot.value = 'always 14 March?\nsame bench every time.\na different bird each year - Wren, Finch, Robin...\nwho is M??';
  setPriya(DEFAULT_NOTE, false);
  renderPins(); renderHist();
  doSearch('wren');
  const st = findE('1967-03-14');
  openEntry(st.id, false);
  renderStatus();
} else {
  boot();
  if (S.tut === 1 || S.tut === 2) S.tut = 0;
  if (S.tut < TUT.length) setTimeout(() => tutTo(S.tut), 500);
  else if (!touch) q.focus({ preventScroll: true });
}
moveCaret();
window.lp = { S, ENTRIES, search, doSearch, win, hint };
