import { SCENES } from './scenes.js';
import { bust, INK } from './people.js';
import { WORDS, INTRO, CHAPTERS, EPILOGUE, NUDGE } from './story.js';
import { sfx, wake, music, setOn } from './sound.js';

const $ = (id) => document.getElementById(id), Q = new URLSearchParams(location.search), KEY = 'stilllife-v1';
const fresh = () => ({ ch: 0, seen: {}, got: {}, names: [], known: [], pages: {}, done: [], tut: 0, hints: {}, mute: false, started: false });
let S = fresh();
try { if (!Q.has('demo')) S = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* a fresh start will do */ }
const save = () => { if (Q.has('demo')) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode */ } };
let C, SC, page = 0, sel = -1, kind = 'name', msg = '', cardId = null, cardAt = 0, lastFocus = null;
const KINDS = [['name', 'Names'], ['thing', 'Things'], ['deed', 'Deeds'], ['fact', 'Facts']];
const seen = () => (S.seen[C.id] ??= []), got = () => (S.got[C.id] ??= []);
const answers = (p) => [...(p.faces || []), ...[...(p.text || '').matchAll(/\{(\w+)\}/g)].map((m) => m[1])];
const pst = (i) => ((S.pages[C.id] ??= {})[i] ??= { fill: answers(C.pages[i]).map(() => null), ok: false });
const has = (w) => WORDS[w][0] === 'name' ? S.names.includes(w) : got().includes(w);
const wordsIn = (s) => [...new Set([...[s.head, s.text, ...(s.docs || []).map((d) => d.b)].join(' ').matchAll(/\[\[(\w+)/g)].map((m) => m[1]))];
const bustSvg = (who, when) => `<svg viewBox="-75 -478 150 165" aria-hidden="true">${bust(who, when)}</svg>`;

// ---------- camera ----------
const cam = { x: 0, y: 0, k: 1 }; let baked = 0, bakeT = 0;
const stage = $('stage'), pic = $('pic');
const fit = () => { const w = stage.clientWidth, h = stage.clientHeight; return { w, h, cover: Math.max(w / SC.w, h / SC.h), contain: Math.min(w / SC.w, h / SC.h) }; };
function clampCam() {
  const f = fit(); cam.k = Math.min(Math.max(cam.k, f.contain), Math.max(1.7, f.cover));
  const hw = f.w / 2 / cam.k, hh = f.h / 2 / cam.k;
  cam.x = hw * 2 >= SC.w ? SC.w / 2 : Math.min(Math.max(cam.x, hw), SC.w - hw);
  cam.y = hh * 2 >= SC.h ? SC.h / 2 : Math.min(Math.max(cam.y, hh), SC.h - hh);
}
function bake() { const v = pic.firstElementChild; if (!v || Math.abs(baked - cam.k) < 1e-4) return; baked = cam.k; v.setAttribute('width', SC.w * baked); v.setAttribute('height', SC.h * baked); pic.style.width = SC.w * baked + 'px'; pic.style.height = SC.h * baked + 'px'; place(); }
function place() {
  if (!SC || !stage.clientWidth) return;
  clampCam(); const f = fit(), ox = f.w / 2 - cam.x * cam.k, oy = f.h / 2 - cam.y * cam.k;
  pic.style.transform = `translate(${ox}px,${oy}px) scale(${cam.k / baked})`;
  for (const m of $('marks').children) m.style.transform = `translate(${ox + m._x * cam.k}px,${oy + m._y * cam.k}px)`;
  $('marks').style.setProperty('--ms', Math.min(1, Math.max(.5, cam.k * 1.7)).toFixed(2));
  const hw = f.w / 2 / cam.k; $('el').hidden = cam.x - hw < 8; $('er').hidden = cam.x + hw > SC.w - 8;
  clearTimeout(bakeT); bakeT = setTimeout(bake, 180);
}
function resetCam(zoom) { const f = fit(); cam.k = f.cover * (zoom || 1); const st = SC.start || [0, .5]; cam.x = SC.w * (f.w / cam.k < SC.w * .8 ? st[0] : .5); cam.y = SC.h * .5; clampCam(); baked = 0; bake(); place(); }
let glideT = 0;
function glide(x, y, k = cam.k) { const a = { ...cam }, t0 = performance.now(); cancelAnimationFrame(glideT); const step = (t) => { const u = Math.min(1, Math.max(0, (t - t0) / 420)), e = 1 - (1 - u) ** 3; cam.x = a.x + (x - a.x) * e; cam.y = a.y + (y - a.y) * e; cam.k = a.k + (k - a.k) * e; place(); if (u < 1) glideT = requestAnimationFrame(step); }; glideT = requestAnimationFrame(step); }
const toWorld = (px, py) => { const r = stage.getBoundingClientRect(); return [cam.x + (px - r.left - r.width / 2) / cam.k, cam.y + (py - r.top - r.height / 2) / cam.k]; };
function zoomAt(px, py, k) { const [x, y] = toWorld(px, py), o = cam.k; cam.k = k; clampCam(); cam.x = x - (x - cam.x) * o / cam.k; cam.y = y - (y - cam.y) * o / cam.k; place(); }
let lastSize = [0, 0];
new ResizeObserver(() => { if (!SC || !stage.clientWidth) return; const w = stage.clientWidth, h = stage.clientHeight; if (w === lastSize[0] && h === lastSize[1]) return; const first = !lastSize[0]; lastSize = [w, h]; const f = fit(); if (first) resetCam(); else { cam.k = Math.max(f.cover, Math.min(cam.k, f.cover * 1.6)); place(); } }).observe(stage);

stage.addEventListener('scroll', () => { stage.scrollLeft = stage.scrollTop = 0; });

// ---------- pointer ----------
const pts = new Map(); let moved = 0, pinch = null;
stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#card, .edge, #coach button')) return;
  cancelAnimationFrame(glideT); stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 1) moved = 0;
  if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: cam.k }; moved = 99; }
});
stage.addEventListener('pointermove', (e) => {
  const p = pts.get(e.pointerId);
  if (!p) { if (e.pointerType === 'mouse' && SC && !e.target.closest('#card')) stage.style.cursor = hit(e.clientX, e.clientY) ? 'pointer' : ''; return; }
  const dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]); moved += Math.hypot(dx, dy);
  if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; cam.x -= dx / cam.k / 2; cam.y -= dy / cam.k / 2; zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, pinch.k * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d); } else if (moved > 7) { stage.classList.add('drag'); cam.x -= dx / cam.k; cam.y -= dy / cam.k; place(); }
});
const up = (e) => { if (!pts.delete(e.pointerId)) return; if (pts.size < 2) pinch = null; if (pts.size) return; stage.classList.remove('drag'); if (e.type === 'pointerup' && moved <= 7) { const s = hit(e.clientX, e.clientY); if (s) openSpot(s.id); } };
stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
stage.addEventListener('wheel', (e) => { if (e.target.closest('#card')) return; e.preventDefault(); if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) zoomAt(e.clientX, e.clientY, cam.k * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0016))); else { cam.x += e.deltaX / cam.k; place(); } }, { passive: false });
function hit(px, py) {
  const [x, y] = toWorld(px, py), rad = 24 / cam.k; let best = null, bd = 1e9;
  for (const s of SC.spots) { const d = Math.hypot(s.m[0] - x, s.m[1] - y); if (d < rad && d < bd) { bd = d; best = s; } }
  if (best) return best;
  let ba = 1e12; for (const s of SC.spots) { const [a, b, w, h] = s.b; if (x >= a && x <= a + w && y >= b && y <= b + h && w * h < ba) { ba = w * h; best = s; } }
  return best;
}
$('el').onclick = () => glide(cam.x - fit().w / cam.k * .6, cam.y); $('er').onclick = () => glide(cam.x + fit().w / cam.k * .6, cam.y);

// ---------- photograph ----------
function marks() {
  const box = $('marks'); box.innerHTML = '';
  for (const s of SC.spots) {
    const b = document.createElement('button'), sp = C.spots[s.id], left = wordsIn(sp).some((w) => !has(w));
    b.className = 'mk ' + (!seen().includes(s.id) ? '' : left ? 'part' : 'done'); b._x = s.m[0]; b._y = s.m[1]; b.dataset.id = s.id; b.innerHTML = '<i></i>'; b.setAttribute('aria-label', sp.head);
    b.onclick = () => openSpot(s.id); b.onfocus = () => glide(s.m[0], s.m[1]); box.append(b);
  }
  coachMark(); place();
}
function setChapter(i, flash = true) {
  S.ch = i; C = CHAPTERS[i]; SC = SCENES[C.id]; page = Math.max(0, C.pages.findIndex((_, j) => !pst(j).ok)); if (C.pages.every((_, j) => pst(j).ok)) page = 0; sel = -1; kind = 'name'; msg = ''; cardId = null; $('card').hidden = true;
  $('app').hidden = false; $('title').hidden = true; $('over').hidden = true; $('app').classList.remove('rep'); $('report').classList.remove('open');
  $('tt').textContent = `${C.num}. ${C.title}`; $('tw').textContent = C.when;
  pic.innerHTML = `<svg viewBox="0 0 ${SC.w} ${SC.h}" xmlns="http://www.w3.org/2000/svg">${SC.draw()}</svg>`;
  lastSize = [stage.clientWidth, stage.clientHeight]; resetCam(); marks(); report(); coach(); save();
  if (flash) { sfx.shutter(); $('flash').animate([{ opacity: 1 }, { opacity: .9, offset: .15 }, { opacity: 0 }], { duration: 900, easing: 'ease-out' }); }
}
const rich = (t) => t.replace(/&/g, '&amp;').replace(/\[\[(\w+)(?:\|([^\]]*))?\]\]/g, (_, w, l) => `<button class="k ${has(w) ? 'got' : ''}" data-w="${w}">${l || WORDS[w][1]}</button>`);
function openSpot(id) {
  const s = SC.spots.find((q) => q.id === id), d = C.spots[id]; if (!s || cardId) return;
  if ($('report').classList.contains('open') && !wide()) toggleReport(false);
  cardId = id; cardAt = performance.now(); lastFocus = document.activeElement; wake(); sfx.open();
  const c = $('card'), named = s.who && S.known.includes(s.who);
  c.innerHTML = `<div class="in"><button class="ico x" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg></button>
    <div class="hd">${s.who ? bustSvg(s.who, SC.when) : ''}<h3>${s.who ? `<small>${named ? WORDS[s.who][1] : 'Name not yet known'}</small>` : ''}${d.head}</h3></div>
    <div class="sc"><p>${rich(d.text)}</p>${(d.docs || []).map((q) => `<div class="doc ${q.k}"><span>${q.t}</span><div class="${q.ink || ''}">${rich(q.b)}</div></div>`).join('')}</div></div>`;
  c.hidden = false; c.querySelector('.x').onclick = closeCard; c.onclick = (e) => { if (e.target === c) closeCard(); };
  if (!seen().includes(id)) seen().push(id);
  c.querySelectorAll('.k').forEach((b) => { b.onclick = () => take(b.dataset.w); });
  if (S.tut === 0 && S.ch === 0) tut(1);
  c.querySelector('.x').focus({ preventScroll: true }); marks(); report(); coach(); save();
}
function closeCard() {
  if (!cardId) return; cardId = null; $('card').hidden = true; sfx.close(); marks(); coach();
  if (S.ch === 0 && S.tut === 2 && seen().length >= 2) tut(3);
  if (S.ch === 0 && S.tut === 3 && seen().length >= 5) tut(4);
  const back = lastFocus?.dataset.id ? document.querySelector(`.mk[data-id="${lastFocus.dataset.id}"]`) : lastFocus;
  if (back?.isConnected) back.focus({ preventScroll: true });
}
function take(w) {
  if (has(w)) { toast('Already in the notebook'); return; }
  if (WORDS[w][0] === 'name') S.names.push(w); else got().push(w);
  sfx.word(); document.querySelectorAll(`.k[data-w="${w}"]`).forEach((b) => b.classList.add('got', 'pop')); toast(`Kept: ${WORDS[w][1]}`); report(); save();
  if (S.ch === 0 && S.tut === 1) tut(2);
}
let toastT; function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 1300); }

// ---------- report ----------
function blank(i, w, st, small) {
  const a = answers(C.pages[page])[i], k = WORDS[a][0], v = st.fill[i];
  return `<button class="bl ${k} ${sel === i && !st.ok ? 'sel' : ''}" data-i="${i}" ${st.ok ? 'disabled' : ''}>${v ? WORDS[v][1] : `<span class="e">${{ name: small ? 'who?' : 'who', thing: 'what', deed: 'did what', fact: 'which' }[k]}</span>`}</button>`;
}
// the report is redrawn whole, so remember which of its buttons the keyboard was on
function focusKey() { const b = document.activeElement?.closest('#report button'); if (!b) return ''; const k = ['w', 'i', 'p', 'k'].find((q) => b.dataset[q] != null); return k ? `#${b.parentElement.closest('[id]').id} [data-${k}="${b.dataset[k]}"]` : `#${b.id}`; }
function report() {
  const fk = focusKey();
  const p = C.pages[page], st = pst(page), nOk = C.pages.filter((_, i) => pst(i).ok).length, all = nOk === C.pages.length;
  $('tabs').innerHTML = C.pages.map((q, i) => `<button class="${i === page ? 'on' : ''} ${pst(i).ok ? 'ok' : ''}" data-p="${i}" aria-label="Page ${i + 1}: ${q.title}">${['One', 'Two', 'Three', 'Four'][i]}${pst(i).ok ? ' ✓' : ''}</button>`).join('');
  let i = 0, h = `<h3>${p.title}</h3>`;
  if (p.faces) h += `<div class="faces n${p.faces.length}">${p.faces.map((f) => `<div class="face">${bustSvg(f, SC.when)}${blank(i++, f, st, true)}</div>`).join('')}</div>`;
  if (p.text) h += `<p class="txt">${p.text.replace(/ (\{\w+\})([.,:;])/g, ' <span style="white-space:nowrap">$1$2</span>').replace(/\{(\w+)\}/g, (_, w) => blank(i++, w, st))}</p>`;
  if (msg) h += `<p id="msg" class="${st.ok ? 'good' : ''}">${msg}</p>`;
  const hn = S.hints[C.id + page] || 0;
  if (hn && !st.ok) h += `<p id="msg" style="border-color:var(--gold)"><b class="lab">${NUDGE[hn - 1]}:</b> ${p.hints[hn - 1]}</p>`;
  h += '<div class="row">';
  if (st.ok) { const nx = C.pages.findIndex((_, j) => !pst(j).ok); h += all ? `<button class="btn red" id="fin">${S.ch < 3 ? 'Close the photograph' : 'Hand it in'}</button>` : `<button class="btn" id="nxp" data-p="${nx}">Next page</button>`; }
  else h += `${hn < 3 ? `<button class="lnk" id="hint">${hn ? 'A clearer hint' : 'A hint, please'}</button>` : ''}${st.fill.some(Boolean) ? '<button class="lnk" id="clr">Rub it all out</button>' : ''}`;
  h += '</div>'; if (st.ok) h += '<div class="stamp">CONFIRMED</div>';
  const top = $('page').scrollTop; $('page').innerHTML = h; $('page').classList.toggle('ok', st.ok); $('page').scrollTop = top; $('page').querySelector('.bl.sel')?.scrollIntoView({ block: 'nearest' });
  $('tray').hidden = st.ok;
  $('kinds').innerHTML = KINDS.map(([k, l]) => `<button class="${k} ${k === kind ? 'on' : ''}" data-k="${k}">${l}</button>`).join('');
  if ($('words').dataset.k !== kind) { $('words').dataset.k = kind; $('words').scrollTop = 0; }
  const list = (kind === 'name' ? S.names : got().filter((w) => WORDS[w][0] === kind));
  $('words').innerHTML = list.length ? list.map((w) => `<button class="wd ${kind} ${st.fill.includes(w) ? 'used' : ''}" data-w="${w}">${WORDS[w][1]}</button>`).join('') : `<p>None yet. Look around the photograph and tap the underlined words.</p>`;
  const open = $('report').classList.contains('open');
  if (fk) (document.querySelector(fk + ':not(:disabled)') || document.querySelector('#page .btn') || document.querySelector('#words .wd'))?.focus({ preventScroll: true });
  $('bRep').textContent = open ? 'Back to the photograph' : `The report (${nOk} of ${C.pages.length})`;
}
function select(i) { const st = pst(page); if (st.ok) return; sel = i; kind = WORDS[answers(C.pages[page])[i]][0]; msg = ''; if (st.fill[i]) { st.fill[i] = null; sfx.close(); } if (S.ch === 0 && S.tut <= 5) tut(6); report(); save(); }
function put(w, i = -1) {
  const st = pst(page), a = answers(C.pages[page]), k = WORDS[w][0]; if (st.ok) return;
  if (i < 0) i = sel >= 0 && WORDS[a[sel]][0] === k && !st.fill[sel] ? sel : a.findIndex((x, j) => WORDS[x][0] === k && !st.fill[j]);
  if (i < 0) { toast('No empty blank takes that word'); return; }
  if (WORDS[a[i]][0] !== k) { toast('That blank wants a different sort of word'); return; }
  st.fill[i] = w; sfx.place(); msg = ''; sel = a.findIndex((x, j) => j > i && !st.fill[j]); if (sel < 0) sel = a.findIndex((x, j) => !st.fill[j]);
  if (sel >= 0) kind = WORDS[a[sel]][0];
  const full = st.fill.every(Boolean); if (full) judge();
  report(); if (full) $('msg')?.scrollIntoView({ block: 'nearest' }); save();
}
function judge() {
  const p = C.pages[page], st = pst(page), a = answers(p), want = [...a];
  for (const set of p.sets || []) if (set.every((i) => set.some((j) => a[j] === st.fill[i])) && new Set(set.map((i) => st.fill[i])).size === set.length) set.forEach((i) => { want[i] = st.fill[i]; });
  const bad = want.filter((w, i) => st.fill[i] !== w).length;
  if (bad) { sfx.wrong(); msg = bad <= 2 ? 'Nearly. One or two blanks are wrong.' : 'Not as I remember it. More than two blanks are wrong.'; return; }
  st.ok = true; sel = -1; sfx.stamp(); (p.faces || []).forEach((f) => { if (!S.known.includes(f)) S.known.push(f); if (!S.names.includes(f)) S.names.push(f); });
  msg = C.pages.every((_, i) => pst(i).ok) ? 'Every page confirmed.' : 'Every word of that is true.';
  if (S.ch === 0 && S.tut < 8) tut(7); $('page').scrollTop = 0;
}
$('tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) goPage(+b.dataset.p); };
function goPage(i) { page = i; sel = -1; msg = ''; const a = answers(C.pages[i]), st = pst(i), f = a.findIndex((_, j) => !st.fill[j]); if (f >= 0 && !st.ok) { sel = f; kind = WORDS[a[f]][0]; } $('page').scrollTop = 0; report(); }
$('page').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.classList.contains('bl')) select(+b.dataset.i);
  else if (b.id === 'nxp') goPage(+b.dataset.p);
  else if (b.id === 'fin') finish();
  else if (b.id === 'hint') { const k = C.id + page; S.hints[k] = Math.min(3, (S.hints[k] || 0) + 1); report(); save(); $('page').scrollTop = 1e4; }
  else if (b.id === 'clr') { pst(page).fill.fill(null); msg = ''; sel = 0; kind = WORDS[answers(C.pages[page])[0]][0]; report(); save(); }
};
$('kinds').onclick = (e) => { const b = e.target.closest('button'); if (b) { kind = b.dataset.k; if (S.tut === 5 && S.ch === 0) tut(6); report(); } };
// words: tap to place, or drag onto a blank
let drag = null;
// the click a browser makes after the tap that opened a card must not act on the card
$('card').addEventListener('click', (e) => { if (e.isTrusted && performance.now() - cardAt < 250) { e.stopPropagation(); e.preventDefault(); } }, true);
$('words').addEventListener('pointerdown', (e) => { const b = e.target.closest('.wd'); if (!b) return; if (drag) { clearTimeout(drag.t); drag.g?.remove(); } drag = { w: b.dataset.w, b, x: e.clientX, y: e.clientY, id: e.pointerId, on: false, ok: e.pointerType === 'mouse' }; if (!drag.ok) drag.t = setTimeout(() => { if (drag) { drag.ok = true; startGhost(drag.x, drag.y); } }, 260); });
function startGhost(x, y) { drag.on = true; const g = drag.b.cloneNode(true); g.classList.add('ghost'); document.body.append(g); drag.g = g; g.style.left = x + 'px'; g.style.top = y + 'px'; }
addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return; const d = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
  if (d > 8) drag.mv = true;
  if (!drag.on) { if (d > 8) { if (drag.ok) startGhost(e.clientX, e.clientY); else { clearTimeout(drag.t); drag = null; } } if (!drag || !drag.on) return; }
  drag.g.style.left = e.clientX + 'px'; drag.g.style.top = e.clientY + 'px';
  const o = document.elementFromPoint(e.clientX, e.clientY)?.closest('.bl'); document.querySelectorAll('.bl.over').forEach((q) => q !== o && q.classList.remove('over')); o?.classList.add('over');
});
$('words').addEventListener('touchmove', (e) => { if (drag?.on) e.preventDefault(); }, { passive: false });
$('words').addEventListener('contextmenu', (e) => e.preventDefault());
let justDragged = 0;
const drop = (e) => { if (!drag || e.pointerId !== drag.id) return; clearTimeout(drag.t); const d = drag; drag = null; d.g?.remove(); if (!d.on) return; justDragged = performance.now(); if (e.type === 'pointercancel') return; if (!d.mv) { put(d.w); return; } const o = document.elementFromPoint(e.clientX, e.clientY)?.closest('.bl:not(:disabled)'); if (o) put(d.w, +o.dataset.i); };
addEventListener('pointerup', drop); addEventListener('pointercancel', drop);
$('words').onclick = (e) => { const b = e.target.closest('.wd'); if (b && performance.now() - justDragged > 120) { wake(); put(b.dataset.w); } };
function toggleReport(v) { const o = v ?? !$('report').classList.contains('open'); if (o && cardId) closeCard(); $('report').classList.toggle('open', o); $('app').classList.toggle('rep', o); if (o && S.ch === 0 && (S.tut === 4 || S.tut === 3)) tut(5); if (o && sel < 0) goPage(page); else report(); coach(); sfx.open(); }
$('bRep').onclick = () => { wake(); toggleReport(); };
const wide = () => getComputedStyle($('bar')).display === 'none';

// ---------- lesson ----------
const TUT = [
  () => 'Start with the woman waving. Tap her, or the gold diamond on her.',
  () => 'Underlined words go in your notebook. Tap one to keep it.',
  () => 'Good. Keep any others you like, then close the card and look at somebody else.',
  () => 'Drag to look along the jetty, or pinch (or scroll) to come closer. A gold centre means there are still words to keep.',
  () => wide() ? 'The report is on the right. Tap the first “who?” under a face.' : 'When you know a face or two, open the report below.',
  () => 'Tap a “who?” under one of the faces.',
  () => 'Now tap a name to write it in. A full page checks itself. Guesses cost nothing, but it only says how close you are.',
  () => 'Confirmed! Page two says what happened. Dashed words you haven’t kept may still be out there.',
];
function tut(n) { if (n <= S.tut) return; S.tut = n; save(); coach(); coachMark(); if (n === 7) setTimeout(() => { if (S.tut === 7) { S.tut = 8; save(); coach(); } }, 14000); }
function coach() {
  const c = $('coach'); if (S.ch !== 0 || S.tut > 7 || Q.has('demo') || S.done.includes('landing')) { c.hidden = true; return; }
  c.hidden = false; c.innerHTML = `${TUT[S.tut]()}${S.tut === 0 ? '<button>I know how this works</button>' : ''}`;
  const b = c.querySelector('button'); if (b) b.onclick = () => { S.tut = 8; save(); coach(); coachMark(); };
  c.style.zIndex = cardId ? 22 : 6; $('card').style.paddingBottom = cardId && S.tut < 3 ? c.offsetHeight + 34 + 'px' : ''; if (cardId && S.tut >= 3) c.style.zIndex = 6; $('bRep').classList.toggle('call', S.tut === 4);
}
function coachMark() { document.querySelectorAll('.mk').forEach((m) => m.classList.toggle('call', S.ch === 0 && S.tut === 0 && m.dataset.id === 'dolly')); if (S.tut > 4) $('bRep').classList.remove('call'); }

// ---------- sheets ----------
function sheet(html, wire) { const o = $('over'); o.innerHTML = `<div class="sheet">${html}</div>`; o.hidden = false; o.scrollTop = 0; wire?.(o); o.querySelector('.btn')?.focus({ preventScroll: true }); }
function chapterCard(i) { const c = CHAPTERS[i]; sheet(`<h2><small>Photograph ${c.num}</small>${c.title}</h2><p>${c.when}.</p><p>${c.intro}</p><button class="btn red">Look at it</button>`, (o) => { o.querySelector('.btn').onclick = () => { wake(); music(true); setChapter(i); }; }); }
function finish() {
  if (!S.done.includes(C.id)) S.done.push(C.id); save();
  const n = S.ch + 1;
  sheet(`<h2><small>Photograph ${C.num}, confirmed</small>${C.title}</h2><p>${C.outro}</p><button class="btn red">${n < 4 ? 'The next photograph' : 'Afterwards'}</button>`, (o) => { o.querySelector('.btn').onclick = () => n < 4 ? chapterCard(n) : ending(); });
}
function ending() { sheet(`<h2><small>Afterwards</small>What became of them</h2><div class="ends">${EPILOGUE.map(([w, t]) => `<div>${bustSvg(w, 'morn')}<span>${t}</span></div>`).join('')}</div><p>And I sold the third photograph to every newspaper on the lake.<br>Frances Lund, Hotel Aurelie</p><button class="btn red">Back to the album</button>`, (o) => { o.querySelector('.btn').onclick = album; }); }
let thumbs = [];
function album() {
  const inGame = !$('app').hidden;
  sheet(`<h2>The album</h2><div class="album">${CHAPTERS.map((c, i) => { const sc = SCENES[c.id], un = i === 0 || S.done.includes(CHAPTERS[i - 1].id); return `<button data-i="${i}" ${un ? '' : 'disabled'}><svg viewBox="${(sc.w - 1800) / 2} 0 1800 1000" preserveAspectRatio="xMidYMid slice">${un ? (thumbs[i] ??= sc.draw()) : `<path d="M700 300h400v400h-400z" fill="none" stroke="${INK}" stroke-width="20"/><text x="900" y="570" font-size="200" text-anchor="middle" font-family="Federo">${c.num}</text>`}</svg>${c.num}. ${c.title}<small>${S.done.includes(c.id) ? 'Confirmed' : un ? 'On the desk' : 'Not developed yet'}</small></button>`; }).join('')}</div>
    <div class="row"><button class="btn" id="bk">${inGame ? 'Back to the photograph' : 'Back'}</button>${S.done.length === 4 ? '<button class="btn plain" id="af">Afterwards</button>' : ''}<button class="lnk" id="rs">Start over</button></div>`, (o) => {
    o.querySelectorAll('.album button').forEach((b) => { b.onclick = () => { const i = +b.dataset.i; if (inGame && i === S.ch) { o.hidden = true; place(); return; } music(true); if (S.seen[CHAPTERS[i].id]) setChapter(i); else chapterCard(i); }; });
    o.querySelector('#bk').onclick = () => { o.hidden = true; if (!inGame) title(); };
    const a = o.querySelector('#af'); if (a) a.onclick = ending;
    const r = o.querySelector('#rs'); r.onclick = () => { if (!r.dataset.sure) { r.dataset.sure = 1; r.textContent = 'Tap again to burn the album'; return; } const m = S.mute; S = { ...fresh(), mute: m }; save(); o.hidden = true; $('app').hidden = true; title(); };
  });
}
$('bAlbum').onclick = () => { if (cardId) closeCard(); album(); };
function title() {
  const t = $('title'), on = S.started, sc = SCENES.ballroom; music(false);
  t.hidden = false; t.innerHTML = `<svg viewBox="880 120 1000 880" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${sc.draw()}</svg><div class="box"><h1>Still Life</h1><p>Four photographs of a wedding in 1926, and everyone in them is up to something.</p><div class="row"><button class="btn red" id="go">${on ? 'Carry on' : 'Open the album'}</button>${on ? '<button class="btn plain" id="al">Album</button>' : ''}</div></div>`;
  $('go').onclick = () => { wake(); if (on) { music(true); const n = CHAPTERS[S.ch]; if (S.done.includes(n.id) && S.ch < 3 && !S.done.includes(CHAPTERS[S.ch + 1].id)) chapterCard(S.ch + 1); else setChapter(S.ch); } else { S.started = true; save(); sheet(`<h2>${INTRO[0]}</h2><p>${INTRO[1]}</p><p>${INTRO[2]}</p><button class="btn red">Begin</button>`, (o) => { o.querySelector('.btn').onclick = () => chapterCard(0); }); } };
  if (on) $('al').onclick = () => { wake(); album(); };
}
const muteIcon = () => { $('bMute').querySelector('svg').innerHTML = `<path d="M4 9v6h4l5 5V4L8 9z"/>${S.mute ? '<path d="M17 9l5 6M22 9l-5 6"/>' : '<path d="M17 8q3 4 0 8M20 5q5 7 0 14"/>'}`; $('bMute').setAttribute('aria-label', S.mute ? 'Sound off' : 'Sound on'); };
$('bMute').onclick = () => { S.mute = !S.mute; wake(); setOn(!S.mute); muteIcon(); save(); }; setOn(!S.mute); muteIcon();

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape') { if (!$('over').hidden) { const b = $('bk'); if (b) b.click(); } else if (cardId) closeCard(); else if ($('report').classList.contains('open')) toggleReport(false); return; }
  if ($('app').hidden || !$('over').hidden || cardId) return;
  const step = fit().w / cam.k * .3;
  if (e.key === 'ArrowLeft') glide(cam.x - step, cam.y); else if (e.key === 'ArrowRight') glide(cam.x + step, cam.y); else if (e.key === 'ArrowUp') glide(cam.x, cam.y - 120); else if (e.key === 'ArrowDown') glide(cam.x, cam.y + 120);
  else if (e.key === '+' || e.key === '=') glide(cam.x, cam.y, cam.k * 1.25); else if (e.key === '-') glide(cam.x, cam.y, cam.k / 1.25);
  else if (e.key.toLowerCase() === 'm') $('bMute').click(); else if (e.key.toLowerCase() === 'r' && !wide()) toggleReport(); else return;
  e.preventDefault();
});

if (S.tut === 7) S.tut = 8;
if (Q.has('demo')) {
  S.done = ['landing', 'lobby']; S.tut = 9; S.names = ['honoria', 'teddy', 'hugo', 'pym', 'emil', 'iris', 'augustus', 'odette', 'krause', 'julian', 'dolly']; S.got.ballroom = ['fuse', 'lakestars', 'pulled', 'insurance', 'snatch', 'pearls', 'cake'];
  S.known = [...S.names]; S.seen.ballroom = ['emil', 'fuse', 'plan', 'teddy', 'odette'];
  S.pages.ballroom = { 0: { fill: ['honoria', 'teddy', 'honoria', 'augustus'], ok: true }, 2: { fill: ['emil', 'pulled', 'fuse', null, null, null, null, null, null], ok: false } };
  SCENES.ballroom.start = [.5, .5]; document.fonts.ready.then(() => { setChapter(2, false); goPage(2); });
} else title();
if (Q.has('debug')) window.sl = { get S() { return S; }, set S(v) { S = v; }, CHAPTERS, SCENES, WORDS, setChapter, openSpot, closeCard, take, put, goPage, select, answers, wordsIn, cam, place, finish, ending, album, get C() { return C; }, get page() { return page; } };
document.fonts.load("20px 'La Belle Aurore'"); document.fonts.load("17px 'Cutive Mono'"); window.toyboxReady?.();
