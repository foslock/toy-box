import { GLYPHS, GLYPH_IDS, PAGES, symbolSheet } from './glyphs.js';
import { World, newState, PLACES, SIGNS, PEOPLE } from './world.js';
import { drawPlace, backdrop, itemIcon, portrait, picture, VIEW } from './art.js';
import * as snd from './sound.js';

const $ = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => [...el.querySelectorAll(q)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY = 'sungood-v1';
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');

$('#sym').innerHTML = symbolSheet();

let world = new World(load() || newState());
let S = world.s;
let Q = [];            // beats still to show
let cur = null;        // the beat on show
let anchors = {};
let fresh = new Set(); // glyphs seen for the first time on the current line
let convo = null;      // who or what was tapped to start the lines on show
let noteN = S.notes.length;

function load() {
  if (DEMO) return null;
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch {}
  return null;
}
function save() { if (DEMO) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }

// ---------- glyph tiles ----------
const short = (g) => g === 'q' ? '?' : g === 'I' ? 'I, me' : GLYPHS[g].word.split(',')[0];
function label(g) { return S.locked[g] ? short(g) : (S.guess[g] || ''); }
function tile(g, cls = '', tag = 'button') {
  const lk = S.locked[g];
  return `<${tag} class="gt ${lk ? 'lk' : ''} ${cls}" data-g="${g}" ${tag === 'button' ? 'type="button"' : ''} aria-label="${lk ? esc(GLYPHS[g].word) : S.guess[g] ? 'my guess: ' + esc(S.guess[g]) : 'an unknown mark'}"><svg><use href="#g-${g}"/></svg><i>${esc(label(g))}</i></${tag}>`;
}

// ---------- scene ----------
const svg = $('#scene');
function drawScene() {
  const d = drawPlace(S.place, S);
  anchors = d.anchors;
  $('#bg').innerHTML = backdrop(S.place, S.f.gateOpen ? 1 : 0);
  $('#world').innerHTML = d.svg;
  $('#bubbles').innerHTML = '';
  for (const el of $$('#world [data-hit]')) {
    el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button');
    const id = el.dataset.hit;
    el.setAttribute('aria-label', PEOPLE[id] ? 'Talk to ' + PEOPLE[id].name : id.startsWith('x-') ? 'Signpost' : id === 'well' ? 'The well' : 'A sign');
  }
  if (cur) decorate(cur);
}
function drawHud() {
  const p = PLACES[S.place];
  $('#place').innerHTML = p.name.split(' ').map((g) => tile(g)).join('') + `<b>${esc(p.title)}</b>`;
  const inv = $('#inv'); const had = new Set($$('span', inv).map((e) => e.dataset.i));
  const shown = { ...S.inv };
  for (const b of Q) if (b.t === 'act') { if (b.to === 'you') shown[b.item]--; if (b.from === 'you') shown[b.item]++; }
  inv.innerHTML = Object.entries(shown).filter(([, n]) => n > 0).map(([k]) => `<span data-i="${k}" title="${k === 'sun' ? 'a little sun pendant' : k === 'water' ? 'a jug of water' : k === 'coin' ? 'a coin' : 'a loaf of bread'}">${itemIcon(k)}</span>`).join('');
  for (const e of $$('span', inv)) if (!had.has(e.dataset.i)) e.classList.add('pop');
  $('#bJournal .dot').hidden = !world.readyPages().length;
  $('#bMute').innerHTML = snd.isMuted()
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l4 6M21 9l-4 6"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
}

// speech bubble over the speaker, arm up, the thing they mean glowing
function decorate(b) {
  $$('#world .talk').forEach((e) => e.classList.remove('talk', 'alt'));
  $$('#world .lit').forEach((e) => e.classList.remove('lit'));
  $('#bubbles').innerHTML = '';
  if (!b) return;
  if ((b.t === 'say' || b.t === 'ask') && b.who !== 'you') {
    const n = $(`#world [data-hit="${b.who}"]`);
    if (n) { n.classList.add('talk'); if (b.pt) n.classList.add('alt'); }
    const a = anchors[b.who];
    if (a) {
      const gs = 22, w = b.w.length * gs + 14, h = gs + 12;
      let x = Math.max(VIEW.x + 4, Math.min(VIEW.x + VIEW.w - w - 4, a[0] - w / 2)), y = Math.max(VIEW.y + 2, a[1] - h - 8);
      let s = `<g class="bubble"><path d="M${x} ${y}h${w}v${h}h${-w / 2 + 6}l-6 8l-4 -8h${-w / 2 + 4}z" fill="#f6eee0" stroke="#3b2a21" stroke-width="1.6" stroke-linejoin="round" transform="translate(0,0)"/>`;
      b.w.forEach((g, i) => { s += `<use href="#g-${g}" x="${x + 7 + i * gs}" y="${y + 6}" width="${gs}" height="${gs}" style="color:#3b2a21"/>`; });
      $('#bubbles').innerHTML = s + '</g>';
    }
  }
  if (b.pt) { const p = $(`#world [data-pt="${b.pt}"]`); if (p) p.classList.add('lit'); }
}

// an item hops from one person to another
function flyItem(from, to, item) {
  const ME = [VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h - 10];
  const A = from === 'you' ? ME : anchors[from], B = to === 'you' ? ME : anchors[to];
  if (!A || !B) return;
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  g.innerHTML = itemIcon(item).replace('<svg ', '<svg x="-18" y="-18" width="36" height="36" ');
  g.setAttribute('transform', `translate(${A[0]},${A[1] + 30})`);
  g.style.transition = 'transform .7s cubic-bezier(.3,.7,.4,1)';
  $('#bubbles').appendChild(g);
  requestAnimationFrame(() => requestAnimationFrame(() => g.setAttribute('transform', `translate(${B[0]},${B[1] + 30})`)));
  setTimeout(() => g.remove(), 1100);
}

// ---------- the speech panel ----------
const panel = $('#panel');
function idleHint() {
  if (S.ended) return 'The gate is open. I can leave whenever I like, or stay a while and fill in my sketchbook.';
  return S.place === 'harbour' && !S.f.counted ? 'Tap someone to listen. Tap a sign to read it.' : 'Tap someone to listen, a sign to read it, a signpost to walk on.';
}
function showBeat(b) {
  cur = b;
  const who = $('#who'), line = $('#line');
  $('#bReply').hidden = b.t !== 'ask';
  $('#bGo').hidden = !(b.t === 'sign' && b.exit);
  $('#bNext').hidden = !Q.length;
  if (b.t === 'say' || b.t === 'ask' || b.t === 'sign') {
    who.innerHTML = portrait(b.t === 'sign' ? 'sign' : b.who);
    line.innerHTML = (b.t === 'sign' ? `<div class="src">${b.exit ? 'Signpost' : 'A sign'}</div>` : b.who === 'you' ? '<div class="src">I say</div>' : '')
      + b.w.map((g) => tile(g, fresh.has(g) ? 'new' : '')).join('');
    if (b.t === 'sign' && b.exit) $('#bGo').textContent = PLACES[b.exit].visited || S.visited[b.exit] ? 'Go to ' + PLACES[b.exit].title.replace(/^The /, 'the ') : 'Walk this way';
  } else if (b.t === 'act') {
    who.innerHTML = portrait(b.from === 'well' ? 'well' : b.from);
    line.innerHTML = `<div class="act"><span>${portrait(b.from === 'well' ? 'well' : b.from)}</span><span class="arr">→</span>${itemIcon(b.item)}<span class="arr">→</span><span>${portrait(b.to)}</span></div>`;
    $$('.act > span > svg', line).forEach((e) => { e.style.width = '40px'; e.style.height = '40px'; });
  } else if (b.t === 'note' || b.t === 'idle') {
    who.innerHTML = portrait('you');
    line.innerHTML = `<div class="hint">${b.t === 'note' ? esc(b.text) : esc(idleHint())}</div>`;
  }
  decorate(b);
}
function idle() { dropQ(); convo = null; showBeat({ t: 'idle' }); }
function noteToast() { if (S.notes.length > noteN) toast('New note: ' + S.notes[0]); noteN = S.notes.length; }
// walking away mid-conversation: the lines still count as heard, and whatever they set in motion still happens
function dropQ(quiet) {
  const rest = Q; Q = [];
  if (!rest.length) return;
  let redraw = false, end = false;
  for (const b of rest) {
    if ((b.t === 'say' || b.t === 'ask') && b.who !== 'you') world.see(b.w, b.who);
    else if (b.t === 'fx') { redraw = true; if (b.fx === 'end') end = true; }
  }
  save();
  if (quiet) return;
  if (redraw) drawScene();
  drawHud();
  if (end) setTimeout(showEnd, 300);
  noteToast();
}
addEventListener('pagehide', () => dropQ(true));

function advance() {
  while (Q.length) {
    const b = Q.shift();
    if (b.t === 'fx') { runFx(b.fx); if (b.fx === 'end') return; continue; }
    fresh = new Set();
    if (b.t === 'say' || b.t === 'ask') {
      if (b.who !== 'you') for (const g of world.see(b.w, b.who)) fresh.add(g);
      snd.speak(b.who, b.w);
    }
    if (b.t === 'act') {
      flyItem(b.from, b.to, b.item);
      snd.sfx(b.item === 'coin' ? 'coin' : b.item === 'water' ? 'water' : 'tap');
    }
    showBeat(b);
    drawHud();
    if (!Q.some((q) => q.t !== 'fx')) noteToast();
    tutEvent(b.t === 'ask' ? 'ask:' + b.who : b.t === 'say' ? 'say:' + b.who : b.t);
    save();
    return;
  }
}
function runFx(name) {
  if (name === 'scene' || name === 'basin' || name === 'gate') drawScene();
  if (name === 'basin') snd.sfx('water');
  if (name === 'gate') snd.sfx('gate');
  if (name === 'end') { save(); setTimeout(showEnd, 300); }
}
function play(beats) { Q = beats.slice(); if (!Q.length) return; advance(); }

// tapping a person, sign, signpost or the well
function activate(id) {
  snd.audioOn();
  // tapping whoever is mid-sentence again is "go on", not "start over"
  if (Q.length && id === convo) { advance(); return; }
  dropQ(); convo = id;
  if (id.startsWith('x-')) {
    const ex = PLACES[S.place].exits.find((e) => e.id === id);
    if (!ex) return;
    const w = ex.sign.split(' ');
    fresh = new Set(world.see(w, 'sign'));
    showBeat({ t: 'sign', w, exit: ex.to, src: id });
    snd.sfx('tap'); drawHud(); save();
    return;
  }
  if (SIGNS[id]) {
    const w = SIGNS[id].split(' ');
    fresh = new Set(world.see(w, 'sign'));
    showBeat({ t: 'sign', w, src: id });
    snd.sfx('tap'); drawHud(); save();
    tutEvent('sign');
    return;
  }
  play(world.talk(id));
  drawHud(); save();
}

function go(place) {
  snd.sfx('step');
  const wEl = $('#world');
  wEl.classList.add('fade');
  setTimeout(() => {
    S.place = place; S.visited[place] = true;
    cur = null; idle(); drawScene(); drawHud(); save();
    wEl.classList.remove('fade');
    snd.setPlace(place);
    tutEvent('go');
  }, 260);
}

svg.addEventListener('click', (e) => {
  const h = e.target.closest('[data-hit]');
  if (h) activate(h.dataset.hit);
});
panel.addEventListener('click', (e) => {
  const t = e.target.closest('.gt');
  if (t) { openCard(t.dataset.g); return; }
  if (e.target.closest('#bReply')) { openComposer(); return; }
  if (e.target.closest('#bGo')) { if (cur && cur.exit) go(cur.exit); return; }
  if (Q.length) advance();
});
$('#place').addEventListener('click', (e) => { const t = e.target.closest('.gt'); if (t) openCard(t.dataset.g); });

// ---------- glyph card ----------
let cardG = null;
function openCard(g) {
  snd.audioOn(); snd.sfx('page');
  cardG = g;
  $('#toast').classList.remove('on');
  const lk = S.locked[g];
  $('#card .big').classList.toggle('lk', !!lk);
  $('#card .big use').setAttribute('href', '#g-' + g);
  $('#cardBody').innerHTML = (S.tut === 1 || S.tut === 2 ? `<div class="tnote">I can <b>write a guess</b> for what it means, or leave it blank for now. Below is every place I've seen it.</div>` : '')
    + (lk ? `<label>Settled in my sketchbook</label><div class="settled">${esc(GLYPHS[g].word)}</div>`
      : `<label for="guess">I think it means…</label><input id="guess" maxlength="18" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="a guess" value="${esc(S.guess[g] || '')}">`);
  const list = (S.seen[g] || []).slice(-8).reverse();
  $('#ctxs').innerHTML = list.length ? list.map((i) => {
    const c = S.ctx[i];
    const who = c.src === 'sign' ? 'sign' : c.src;
    return `<div class="cx"><span class="pp">${portrait(who)}</span>${c.w.map((x) => tile(x, 'sm' + (x === g ? ' hl' : ''))).join('')}</div>`;
  }).join('') : '<p class="small">Nowhere yet.</p>';
  $('#card').hidden = false;
  if (S.tut <= 1) { S.tut = 2; tutRender(); }
  const inp = $('#guess');
  if (inp) inp.addEventListener('input', () => { const v = inp.value.trim(); if (v) S.guess[g] = v; else delete S.guess[g]; save(); });
  if (inp && matchMedia('(pointer: fine)').matches) setTimeout(() => inp.focus(), 30);
}
function closeCard() {
  if ($('#card').hidden) return;
  $('#card').hidden = true;
  if (cur) showBeat(cur);
  drawHud(); fitStage();
  if (!$('#journal').hidden) renderJournal();
  if (!$('#composer').hidden) renderComposer();
  if (S.tut === 2) { S.tut = 3; save(); }
  tutRender();
}
$('#ctxs').addEventListener('click', (e) => { const t = e.target.closest('.gt'); if (t && t.dataset.g !== cardG) openCard(t.dataset.g); });
$('#card').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'guess') { e.preventDefault(); closeCard(); } });

// ---------- composer ----------
let sentence = [], askBeat = null;
function openComposer() {
  if (!cur || cur.t !== 'ask') return;
  snd.audioOn(); snd.sfx('page');
  askBeat = cur; sentence = [];
  $('#toast').classList.remove('on');
  if (S.tut <= 4) S.tut = 5;
  $('#composer').hidden = false;
  renderComposer(); tutRender();
}
function renderComposer() {
  $('#cq').innerHTML = `<span class="pp">${portrait(askBeat.who)}</span>${askBeat.w.map((g) => tile(g, 'sm', 'span')).join('')}`
    + (S.tut === 5 ? `<div class="tnote" style="flex-basis:100%">Tap marks to build an answer, then <b>Say it</b>. What was the child doing with those baskets?</div>` : '');
  $('#say').innerHTML = sentence.map((g, i) => tile(g, '').replace('<button ', `<button data-i="${i}" `)).join('');
  const have = GLYPH_IDS.filter((g) => S.seen[g]);
  $('#palette').innerHTML = have.map((g) => tile(g)).join('');
  $('#bSay').disabled = !sentence.length;
  $('#bBack').disabled = !sentence.length;
}
$('#palette').addEventListener('click', (e) => { const t = e.target.closest('.gt'); if (!t || sentence.length >= 6) return; sentence.push(t.dataset.g); snd.sfx('tap'); renderComposer(); });
$('#say').addEventListener('click', (e) => { const t = e.target.closest('.gt'); if (!t) return; sentence.splice(+t.dataset.i, 1); renderComposer(); });
$('#bBack').addEventListener('click', () => { sentence.pop(); renderComposer(); });
$('#bSay').addEventListener('click', sayIt);
function sayIt() {
  if (!sentence.length) return;
  const w = sentence.slice();
  $('#composer').hidden = true;
  const reply = world.answer(askBeat.ask, w);
  if (S.tut <= 5) S.tut = 6;
  play([{ t: 'say', who: 'you', w }, ...reply]);
  drawHud(); save(); tutRender();
}

// ---------- sketchbook ----------
let jTab = 'pages', jPage = null, placed = {}, sel = null, wrongs = {};
function openJournal(tab) {
  snd.audioOn(); snd.sfx('page');
  if (tab) jTab = tab;
  $('#toast').classList.remove('on');
  const ready = world.readyPages();
  if (ready.length && (!jPage || S.solved[jPage])) jPage = ready[0].id;
  if (!jPage) jPage = PAGES[0].id;
  $('#journal').hidden = false;
  renderJournal();
  if (S.tut === 7 || (S.tut < 7 && S.tut >= 6 && ready.length)) { S.tut = 8; renderJournal(); }
  tutRender();
}
function closeJournal() {
  if ($('#journal').hidden) return;
  $('#journal').hidden = true; sel = null;
  if (S.tut === 8) { S.tut = 9; save(); }
  if (cur) showBeat(cur);
  drawHud(); fitStage(); tutRender();
}
function renderJournal() {
  $$('#journal .tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === jTab));
  const body = $('#jbody');
  if (jTab === 'glyphs') {
    const n = Object.keys(S.locked).length, seen = Object.keys(S.seen).length;
    body.innerHTML = `<p class="small" style="margin-top:0">${seen} of 28 marks seen · ${n} settled. Tap one to see where I've met it.</p><div class="allg">`
      + GLYPH_IDS.map((g) => S.seen[g] ? tile(g) : '<div class="blank"></div>').join('') + '</div>';
    return;
  }
  if (jTab === 'notes') { body.innerHTML = `<div class="notes">${S.notes.map((t) => `<p>${esc(t)}</p>`).join('')}</div>`; return; }
  const p = PAGES.find((q) => q.id === jPage);
  let h = '<div class="pages">' + PAGES.map((q) => {
    const st = S.solved[q.id] ? 'done' : world.pageReady(q) ? 'ready' : '';
    return `<button class="pg ${st}" data-page="${q.id}" aria-current="${q.id === jPage}">${st === 'ready' ? '<span class="sd"></span>' : ''}${esc(q.title)}${st === 'done' ? ' ✓' : ''}</button>`;
  }).join('') + '</div>';
  if (S.tut === 8 && world.pageReady(p) && !S.solved[p.id]) h += `<div class="tnote"><b>Drag each mark onto its drawing</b>, or tap a mark and then a drawing. When all four are right, they're settled for good.</div>`;
  if (S.solved[p.id]) {
    h += '<div class="drawings">' + p.glyphs.map((g) => `<div class="dw">${picture(g)}<div class="slot">${tile(g, '', 'span')}</div></div>`).join('') + '<div class="stamp">Settled</div></div>';
  } else if (!world.pageReady(p)) {
    const n = p.glyphs.filter((g) => S.seen[g]).length;
    h += `<div class="lockedpg">I've only seen ${n} of the 4 marks for this page. I'll sketch it once I've met them all.<div class="row" style="justify-content:center;margin-top:10px">${p.glyphs.map((g) => S.seen[g] ? tile(g, '', 'span') : '<span class="slot"></span>').join('')}</div></div>`;
  } else {
    const pl = placed[p.id] || (placed[p.id] = {});
    const inSlots = new Set(Object.values(pl));
    const order = [p.glyphs[2], p.glyphs[0], p.glyphs[3], p.glyphs[1]];
    h += '<div class="drawings">' + p.glyphs.map((g) => `<div class="dw">${picture(g)}<div class="slot ${sel ? 'target' : ''}" data-slot="${g}">${pl[g] ? tile(pl[g], '', 'span') : ''}</div></div>`).join('') + '</div>';
    h += '<div class="tray" data-tray>' + order.filter((g) => !inSlots.has(g)).map((g) => tile(g, sel === g ? 'sel' : '', 'span')).join('') + '</div>';
    h += `<div class="verdict" id="verdict"></div>`;
  }
  body.innerHTML = h;
}
function place(pid, slot, g) {
  const pl = placed[pid];
  for (const k of Object.keys(pl)) if (pl[k] === g) delete pl[k];
  pl[slot] = g;
  sel = null;
  snd.sfx('tap');
  renderJournal();
  const p = PAGES.find((q) => q.id === pid);
  if (p.glyphs.every((x) => pl[x])) {
    const right = world.checkPage(pid, pl);
    if (right === 4) {
      snd.sfx('stamp');
      toast('Settled: ' + p.glyphs.map(short).join(', '));
      save(); renderJournal(); drawHud();
      if (cur) showBeat(cur);
      if (S.tut === 8) { S.tut = 9; save(); }
      tutRender();
    } else {
      wrongs[pid] = (wrongs[pid] || 0) + 1;
      snd.sfx('wrong');
      const v = $('#verdict');
      v.textContent = wrongs[pid] >= 3 ? `Not yet. ${['None', 'One', 'Two', 'Three'][right]} of these ${right === 1 ? 'is' : 'are'} right.` : 'Not yet. Something here is wrong.';
      $('.drawings').classList.add('shake');
    }
  }
}
function unplace(pid, slot) { delete placed[pid][slot]; snd.sfx('tap'); renderJournal(); }

// drag or tap-tap between tray and slots
let drag = null;
$('#jbody').addEventListener('pointerdown', (e) => {
  const t = e.target.closest('.gt');
  const pg = jTab === 'pages' && PAGES.find((q) => q.id === jPage);
  if (!t || !pg || S.solved[pg.id] || !world.pageReady(pg)) return;
  const fromSlot = t.closest('.slot');
  drag = { g: t.dataset.g, fromSlot: fromSlot && fromSlot.dataset.slot, x: e.clientX, y: e.clientY, el: null, src: t, id: e.pointerId };
  e.preventDefault();
});
addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.el && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 7) {
    drag.el = drag.src.cloneNode(true); drag.el.classList.add('drag'); document.body.appendChild(drag.el);
    drag.src.style.opacity = '.3';
  }
  if (drag.el) {
    drag.el.style.left = e.clientX - 30 + 'px'; drag.el.style.top = e.clientY - 34 + 'px';
    $$('.slot.over').forEach((s) => s.classList.remove('over'));
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const sl = under && under.closest('.slot[data-slot]'); if (sl) sl.classList.add('over');
  }
});
addEventListener('pointerup', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  if (d.el) {
    d.el.remove(); d.src.style.opacity = '';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const sl = under && under.closest('.slot[data-slot]');
    if (sl) place(jPage, sl.dataset.slot, d.g);
    else if (d.fromSlot) unplace(jPage, d.fromSlot);
    else renderJournal();
    return;
  }
  // a tap
  if (d.fromSlot) { if (sel && sel !== d.g) place(jPage, d.fromSlot, sel); else unplace(jPage, d.fromSlot); return; }
  sel = sel === d.g ? null : d.g; snd.sfx('tap'); renderJournal();
});
addEventListener('pointercancel', () => { if (drag) { if (drag.el) drag.el.remove(); drag.src.style.opacity = ''; drag = null; } });
$('#jbody').addEventListener('click', (e) => {
  const pgb = e.target.closest('[data-page]');
  if (pgb) { jPage = pgb.dataset.page; sel = null; snd.sfx('page'); renderJournal(); return; }
  if (jTab === 'glyphs') { const t = e.target.closest('.gt'); if (t) openCard(t.dataset.g); return; }
  const sl = e.target.closest('.slot[data-slot]');
  if (sl && sel && !sl.querySelector('.gt')) place(jPage, sl.dataset.slot, sel);
});
$$('#journal .tab').forEach((t) => t.addEventListener('click', () => { jTab = t.dataset.tab; sel = null; snd.sfx('page'); renderJournal(); }));

// ---------- title, ending, menu ----------
function showTitle() {
  const started = Object.keys(S.seen).length > 0;
  $('#bStart').textContent = started ? 'Carry on' : 'Step ashore';
  $('#bNew').hidden = !started; $('#bNew').textContent = 'Start over'; newArmed = 0;
  $('#title').hidden = false;
  setTimeout(() => $('#bStart').focus(), 50);
}
$('#bStart').addEventListener('click', () => { snd.audioOn(); snd.setPlace(S.place); $('#title').hidden = true; tutRender(); if (S.ended && !S.endSeen) showEnd(); });
let newArmed = 0;
$('#bNew').addEventListener('click', (e) => {
  if (Date.now() - newArmed > 3000) { newArmed = Date.now(); e.target.textContent = 'Tap again to wipe my notebook'; return; }
  restart(); $('#title').hidden = true; snd.audioOn(); tutRender(); });
function showEnd() {
  S.endSeen = true; save();
  const n = Object.keys(S.locked).length, seen = Object.keys(S.seen).length;
  const mins = Math.max(1, Math.round((Date.now() - S.t0) / 60000));
  $('#endline').innerHTML = tile('sun', '', 'span') + tile('good', '', 'span');
  $('#stats').innerHTML = `Marks met: <b>${seen}</b> of 28<br>Settled in the sketchbook: <b>${n}</b><br>Time in town: <b>${mins}</b> min`;
  $('#end').hidden = false;
  setTimeout(() => $('#bWander').focus(), 50);
}
$('#bWander').addEventListener('click', () => { $('#end').hidden = true; idle(); });
$('#bAgain').addEventListener('click', () => { $('#end').hidden = true; restart(); showTitle(); });
let restartArmed = 0;
$('#bRestart').addEventListener('click', (e) => {
  if (Date.now() - restartArmed > 3000) { restartArmed = Date.now(); e.target.textContent = 'Tap again to wipe my notebook'; return; }
  $('#menu').hidden = true; e.target.textContent = 'Start the journey over'; restart(); showTitle();
});
$('#bSkipTut').addEventListener('click', () => { S.tut = 99; save(); $('#menu').hidden = true; tutRender(); });
function restart() {
  Q = []; convo = null;
  world = new World(newState()); S = world.s; placed = {}; wrongs = {}; jPage = null; sel = null; noteN = S.notes.length;
  cur = null; save(); drawScene(); drawHud(); idle(); tutRender();
}
$('#bJournal').addEventListener('click', () => openJournal());
$('#bMute').addEventListener('click', () => { snd.audioOn(); snd.setMuted(!snd.isMuted()); drawHud(); });
$('#bMenu').addEventListener('click', () => { $('#menu').hidden = false; $('#bRestart').textContent = 'Start the journey over'; });
for (const v of $$('.veil')) v.addEventListener('click', (e) => {
  if (e.target === v || e.target.closest('[data-close]')) {
    if (v.id === 'card') closeCard(); else if (v.id === 'journal') closeJournal(); else if (v.id === 'title' || v.id === 'end') return; else v.hidden = true;
    tutRender();
  }
});

let toastT = 0;
function toast(t) {
  const el = $('#toast');
  if ($$('.veil').some((v) => !v.hidden)) { el.style.top = '12px'; el.style.bottom = 'auto'; } else fitStage(); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 4200); }

// ---------- keys ----------
addEventListener('keydown', (e) => {
  const open = (id) => !$('#' + id).hidden;
  if (e.defaultPrevented) return; // Enter in the guess box already closed the card
  if (e.target.tagName === 'INPUT' && e.key !== 'Escape' && e.key !== 'Enter') return;
  if (open('title')) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (document.activeElement.closest('#title button') || $('#bStart')).click(); } return; }
  if (open('end')) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (document.activeElement.closest('#end button') || $('#bWander')).click(); } return; }
  if (open('card')) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closeCard(); } return; }
  if (open('composer')) {
    if (e.key === 'Escape') { $('#composer').hidden = true; tutRender(); }
    else if (e.key === 'Enter') { e.preventDefault(); const f = document.activeElement.closest('#composer .gt'); if (f) f.click(); else sayIt(); }
    else if (e.key === 'Backspace') { e.preventDefault(); sentence.pop(); renderComposer(); }
    return;
  }
  if (open('journal')) {
    if (e.key === 'Escape' || e.key === 'j' || e.key === 'J') { e.preventDefault(); closeJournal(); }
    else if (e.key === 'Enter' || e.key === ' ') { const f = document.activeElement; if (f && f.closest('#journal button')) { e.preventDefault(); f.click(); } }
    return;
  }
  if (open('menu')) { if (e.key === 'Escape') $('#menu').hidden = true; return; }
  const k = e.key;
  if (k === 'j' || k === 'J') return openJournal();
  if (k === 'm' || k === 'M') { snd.audioOn(); snd.setMuted(!snd.isMuted()); drawHud(); return; }
  if (k === 'r' || k === 'R') return openComposer();
  if (k === 'Enter' || k === ' ') {
    const f = document.activeElement;
    if (f && f.dataset && f.dataset.hit) {
      // a clicked person keeps focus, so Space must still mean "next line", "reply" or "walk on"
      e.preventDefault();
      const id = f.dataset.hit;
      if (!Q.length && id === convo && cur && cur.t === 'ask') openComposer();
      else if (cur && cur.exit && cur.src === id) go(cur.exit);
      else activate(id);
      return;
    }
    if (f && f.closest('button') && f !== document.body) { e.preventDefault(); f.click(); return; }
    e.preventDefault();
    if (Q.length) advance(); else if (cur && cur.t === 'ask') openComposer(); else if (cur && cur.exit) go(cur.exit);
  }
  if (k === 'Escape') idle();
});

// ---------- tutorial ----------
const TUT = {
  0: { t: 'Someone at the fish stall is waving at me. <b>Tap the fisher</b> to listen.', at: () => npcEl('fisher') },
  1: { t: 'They talk in marks I can\'t read. <b>Tap a mark</b> to note it down.', at: () => $('#line .gt') },
  3: { t: 'The little one by the baskets is busy with something. <b>Tap the child.</b>', at: () => npcEl('child') },
  4: { t: 'The child is asking me something. Keep tapping until they wait for me, then <b>tap Reply.</b>', at: () => (!$('#bReply').hidden ? $('#bReply') : !$('#bNext').hidden ? $('#bNext') : npcEl('child')) },
  7: { t: 'A page in my sketchbook is ready to fill in. <b>Open the sketchbook.</b>', at: () => $('#bJournal') },
  9: { t: 'Settled marks show their meaning wherever I see them. Now: the upper gate. <b>Signposts</b> lead on into town.', at: () => $('#world .exit'), btn: 'Got it' },
};
function npcEl(id) { const e = $(`#world [data-hit="${id}"]`); return e && $('g', e); }
function tutEvent(ev) {
  const t = S.tut;
  if (t === 0 && ev === 'say:fisher') S.tut = 1;
  else if (t === 3 && ev === 'ask:child') S.tut = 4;
  else if (t <= 3 && ev === 'ask:child') S.tut = 4;
  if (S.tut === 6 && world.readyPages().length) S.tut = 7;
  if (S.tut === 9 && ev === 'go' && S.place !== 'harbour') S.tut = 99;
  save(); tutRender();
}
function tutRender() {
  if (S.tut === 6 && world.readyPages().length) S.tut = 7;
  const c = $('#coach'), r = $('#ring');
  const step = TUT[S.tut];
  const blocked = !$('#title').hidden || !$('#end').hidden || $$('.veil').some((v) => !v.hidden) || DEMO;
  if (!step || blocked) { c.hidden = true; r.hidden = true; return; }
  c.innerHTML = step.t + (step.btn ? `<div><button class="btn teal cbtn" id="bTut">${step.btn}</button></div>` : '');
  c.hidden = false;
  if (step.btn) $('#bTut').onclick = () => { S.tut = 99; save(); tutRender(); };
  placeCoach();
}
function placeCoach() {
  const c = $('#coach'), r = $('#ring');
  if (c.hidden) return;
  const step = TUT[S.tut]; if (!step) return;
  const el = step.at && step.at();
  if (!el) { r.hidden = true; if (!step.btn) c.style.visibility = 'hidden'; c.style.top = '64px'; return; }
  c.style.visibility = '';
  const b = el.getBoundingClientRect();
  if (!b.width && !b.height) { r.hidden = true; return; }
  const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
  r.hidden = false; r.style.left = cx + 'px'; r.style.top = cy + 'px';
  const sz = Math.max(54, Math.min(120, Math.max(b.width, b.height) + 18)); r.style.width = r.style.height = sz + 'px'; r.style.margin = `${-sz / 2}px 0 0 ${-sz / 2}px`;
  const ch = c.offsetHeight;
  const landscapeShort = innerWidth > innerHeight && innerHeight <= 540;
  if (landscapeShort) { c.style.left = (innerWidth - Math.min(340, innerWidth * 0.42)) / 2 + 'px'; }
  else c.style.left = '50%';
  const top = 62;
  if (cy - sz / 2 > top + ch + 12) c.style.top = top + 'px';
  else c.style.top = Math.min(innerHeight - ch - 10, cy + sz / 2 + 12) + 'px';
}

// ---------- layout & loop ----------
function fitStage() {
  const landscapeShort = innerWidth > innerHeight && innerHeight <= 540;
  const ph = panel.offsetHeight + 16;
  $('#stage').style.bottom = landscapeShort ? '0px' : ph + 'px';
  $('#toast').style.top = 'auto';
  $('#toast').style.bottom = (landscapeShort ? 12 : ph + 8) + 'px';
  // tall phones: crop the empty margins so the town is bigger
  svg.setAttribute('viewBox', innerWidth < innerHeight * 0.8 ? '78 30 564 500' : '40 14 640 530');
}
new ResizeObserver(() => { fitStage(); placeCoach(); }).observe(panel);
addEventListener('resize', () => { fitStage(); placeCoach(); });

let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now;
  snd.music(dt);
  placeCoach();
  requestAnimationFrame(frame);
}

// ---------- demo for the card picture ----------
if (DEMO) {
  const d = world;
  for (const [w, src] of [['sun good', 'fisher'], ['fish many', 'fisher'], ['fish one', 'child'], ['fish two', 'child'], ['bread house', 'sign'], ['fish three', 'child']]) d.see(w.split(' '), src);
  S.solved.goods = false; S.locked.fish = true; S.locked.sun = true;
  S.guess.good = 'hello?'; S.guess.many = 'lots'; S.guess.one = 'one'; S.guess.two = 'two'; S.guess.three = 'three';
  S.inv.coin = 0; S.f.countSeen = true; S.tut = 99;
}

drawScene(); drawHud();
if (DEMO) { cur = null; Q = []; showBeat({ t: 'say', who: 'child', w: ['fish', 'three'], pt: 'b3' }); }
else idle();
fitStage();
if (!DEMO) showTitle();
tutRender();
requestAnimationFrame(frame);
window.toyboxReady?.();

// for playtesting from the console
window.sg = { get S() { return S; }, world: () => world, activate, advance, go, openComposer, sayIt, openJournal, closeJournal, openCard, closeCard, place, setSentence: (w) => { sentence = w.slice(); renderComposer(); }, get Q() { return Q; }, get cur() { return cur; } };
