// What the page notices about what you do with the browser itself, turned into events for the narrator: switching tabs,
// resizing or turning the phone, sitting still, right-clicking or pressing and holding, highlighting, scrolling past the end,
// Back, trying to close the tab. The engine decides what each one means; this only reports it.
import * as sound from './sound.js';

const $ = id => document.getElementById(id);
// what a long press on a phone is a long press *of*: text and controls select or act; only a blank patch of page opens the menu
const TEXTY = 'p, h1, h2, h3, h4, label, li, a, button, input, textarea, address, .n-text, .cm-text, .ink, .todo';
const SAD = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%235b6478'/%3E%3Ccircle cx='11' cy='13' r='2' fill='%23fff'/%3E%3Ccircle cx='21' cy='13' r='2' fill='%23fff'/%3E%3Cpath d='M9 23q7-6 14 0' stroke='%23fff' stroke-width='2.4' fill='none' stroke-linecap='round'/%3E%3C/svg%3E";

export function attach({ g, view, demo = false }) {
  const stage = $('stage'), ctx = $('ctx'), cont = $('cont'), fav = $('fav');
  const coarse = matchMedia('(pointer: coarse)').matches;
  let hist = 0, lastPush = 0, homing = false, noPrompt = false, interacted = false, lastField = 0, pType = 'mouse';
  const isField = el => !!(el && el.closest && el.closest('input, textarea, select, [contenteditable]'));
  const veilOpen = () => [...document.querySelectorAll('.veil')].some(v => !v.hidden);

  // ---- any input at all: idle starts over, and the screen saver wakes ------------------------------------------------
  let svx = null, svy = null;
  function input(e) {
    g.input();
    if (g.lookName === 'saver' && view.saverRunning()) {
      if (e && e.type === 'pointermove') {
        if (svx === null) { svx = e.clientX; svy = e.clientY; return; }
        if (Math.hypot(e.clientX - svx, e.clientY - svy) < 14) return;
      }
      svx = null; g.on('wake');
    }
  }
  // Two steps of Back the page can catch; the third leaves, as it should. The browser only honours a pushed entry that came
  // with a gesture of its own (the rest it skips), so one is pushed per gesture: a mouse press, a finger lifting, a key.
  // `pushed` only ever goes up, so Back can't be caught more than twice, however much you tap in between.
  let pushed = 0;
  function pushEntry(e) {
    if (pushed >= 2 || demo || !e.isTrusted || Date.now() - lastPush < 400) return;
    try { history.pushState({ sp: pushed + 1 }, ''); pushed++; hist++; lastPush = Date.now(); } catch {}
  }
  function firstGesture() { if (!interacted) { interacted = true; sound.unlock(); } }
  for (const t of ['pointerdown', 'keydown', 'touchstart']) addEventListener(t, e => { firstGesture(); input(e); }, { capture: true, passive: true });
  addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') pushEntry(e); }, true);
  addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') pushEntry(e); }, true);
  addEventListener('keydown', e => { if (e.key !== 'Escape') pushEntry(e); }, true);
  for (const t of ['pointermove', 'wheel']) addEventListener(t, input, { capture: true, passive: true });
  for (const t of ['click', 'touchend', 'keyup']) addEventListener(t, () => sound.unlock(), { capture: true, passive: true });   // iOS only lets audio start from a finished tap
  stage.addEventListener('scroll', () => g.input(), { passive: true });

  // ---- Back ---------------------------------------------------------------------------------------------------------
  addEventListener('popstate', () => {
    if (!hist) return;
    hist--;
    if (g.mode !== 'play') { const n = hist + 1; hist = 0; history.go(-n); return; }   // the story is over: Back goes where Back goes
    g.on('back', { left: hist });
  });
  view.goBack = () => { if (hist > 0) history.back(); else g.on('back', { left: 0 }); };

  // ---- the size of the window, or which way up the phone is ---------------------------------------------------------------
  let base = { w: innerWidth, h: innerHeight }, rt = 0;
  addEventListener('resize', () => { view.viewport(); clearTimeout(rt); rt = setTimeout(settleResize, 380); });
  addEventListener('focusin', e => { if (isField(e.target)) lastField = Date.now(); });
  addEventListener('focusout', e => { if (isField(e.target)) lastField = Date.now(); });
  function settleResize() {
    const w = innerWidth, h = innerHeight;
    if (isField(document.activeElement) || Date.now() - lastField < 900) { base = { w, h }; return; }   // the on-screen keyboard
    const dw = Math.abs(w - base.w), dh = Math.abs(h - base.h);
    if (dw < 40 && dh < (coarse ? 150 : 60)) return;   // an address bar sliding away is not a new shape
    const rotated = (w > h) !== (base.w > base.h);
    base = { w, h };
    g.input(); g.on('resize', { w, h, rotated });
  }

  // ---- another tab: a message in the tab's name while you're gone, and a longer one the longer you are -----------------
  let hiddenAt = 0, lure = 0;
  const TITLE = document.title, FAV = fav.href;
  function lureTick() {
    const s = Math.round((Date.now() - hiddenAt) / 1000);
    document.title = s < 3 ? 'Please stay on this page' : s < 10 ? 'Still here' : s < 35 ? `Still here (${s}s)` : 'Still here. I’ll wait.';
    if (s >= 3) fav.href = SAD;
  }
  const back = () => { clearInterval(lure); document.title = TITLE; fav.href = FAV; if (hiddenAt) { const away = (Date.now() - hiddenAt) / 1000; hiddenAt = 0; g.input(); g.on('show', { away }); } };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now(); g.on('hide');
      if (g.mode === 'play') { clearInterval(lure); lure = setInterval(lureTick, 1000); lureTick(); }
    } else back();
  });
  // Left by a link and come back with Back (the browser kept the page): that's another way of being away
  addEventListener('pagehide', () => { if (!hiddenAt) hiddenAt = Date.now(); });
  addEventListener('pageshow', e => { if (e.persisted) back(); });

  // ---- right-click, and pressing and holding ------------------------------------------------------------------------
  addEventListener('contextmenu', e => {
    if (isField(e.target) || g.mode !== 'play' || pType === 'touch' || veilOpen()) return;   // fields keep their own menu; the story's over when it's over
    e.preventDefault(); g.input(); g.on('menu', { x: e.clientX, y: e.clientY });
  });
  let hold = 0, holdXY = null;
  const cancelHold = () => { clearTimeout(hold); hold = 0; };
  addEventListener('pointerdown', e => {
    pType = e.pointerType; cancelHold();
    if (e.pointerType !== 'touch' || g.mode !== 'play' || veilOpen() || (e.target.closest && (e.target.closest(TEXTY) || isField(e.target) || e.target.closest('#ctx, #narr, #hud')))) return;
    holdXY = { x: e.clientX, y: e.clientY };
    hold = setTimeout(() => { hold = 0; g.input(); g.on('menu', holdXY); }, 620);
  }, true);
  addEventListener('pointerup', cancelHold, true); addEventListener('pointercancel', cancelHold, true);
  addEventListener('pointermove', e => { if (hold && holdXY && Math.hypot(e.clientX - holdXY.x, e.clientY - holdXY.y) > 12) cancelHold(); }, true);
  stage.addEventListener('scroll', cancelHold, { passive: true });
  document.addEventListener('pointerdown', e => { if (view.menuOpen() && !ctx.contains(e.target)) view.closeMenu(); }, true);
  ctx.addEventListener('click', e => {
    const b = e.target.closest('.ctx-item'); if (!b || view.menuAge() < 450) return;   // the lift of the finger that opened it is not a choice
    view.closeMenu();
    if (b.dataset.id === 'back') view.goBack(); else g.on('menuitem', { id: b.dataset.id });
  });

  // ---- highlighting -----------------------------------------------------------------------------------------------------
  let selT = 0, lastSel = '';
  const inks = () => stage.querySelectorAll('.ink');
  const norm = t => t.replace(/\s+/g, ' ').trim();
  // An ink is caught if the selection touches it, or takes in all the visible words around it (a selection that stops
  // short of text you can't see is still a selection of that sentence)
  const caught = (sel, el, text) => {
    if (sel.containsNode(el, true)) return true;
    const vis = norm(el.parentElement.textContent.replace(el.textContent, ''));
    return vis.length > 8 && text.includes(vis);
  };
  document.addEventListener('selectionchange', () => {
    const sel = getSelection(), live = !!sel && !sel.isCollapsed, text = live ? norm(sel.toString()) : '';
    inks().forEach(el => el.classList.toggle('peek', live && caught(sel, el, text)));   // the ink shows while you're over it
    clearTimeout(selT); selT = setTimeout(readSelection, 550);
  });
  function readSelection() {
    const sel = getSelection();
    if (!sel || sel.isCollapsed) { lastSel = ''; return; }
    const text = norm(sel.toString());
    if (text.length < 2 || text === lastSel) return;
    lastSel = text;
    const a = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    const lit = []; inks().forEach(el => { if (caught(sel, el, text)) lit.push(+el.dataset.ink); });
    g.input();
    g.on('select', { text, lit, touch: pType === 'touch', all: text.length > 0.6 * stage.innerText.length, narr: !!(a && a.closest && a.closest('#narr')) });
  }
  document.addEventListener('copy', () => { const s = getSelection(); if (s && !s.isCollapsed) g.on('copy'); });

  // ---- scrolling past the end of the page --------------------------------------------------------------------------------
  let bottomSince = 0, lastOver = 0, tY = 0, tBottom = false;
  const atBottom = () => stage.scrollTop + stage.clientHeight >= stage.scrollHeight - 2;
  const waited = ms => bottomSince && performance.now() - bottomSince > ms;
  const past = () => { const t = performance.now(); if (t - lastOver < 1100) return; lastOver = t; g.input(); g.on('overscroll'); };
  stage.addEventListener('scroll', () => { if (atBottom()) { if (!bottomSince) bottomSince = performance.now(); } else bottomSince = 0; }, { passive: true });
  // A flick that carries you to the footer keeps sending wheel events as it slows; only a push that began at the end counts
  let lastWheel = 0, wheelAtEnd = false;
  stage.addEventListener('wheel', e => {
    const t = performance.now();
    if (t - lastWheel > 220) wheelAtEnd = atBottom();
    lastWheel = t;
    if (e.deltaY > 0 && wheelAtEnd && atBottom()) past();
  }, { passive: true });
  stage.addEventListener('touchstart', e => { tY = e.touches[0].clientY; tBottom = atBottom() && waited(350); }, { passive: true });
  stage.addEventListener('touchmove', e => { if (tBottom && atBottom() && tY - e.touches[0].clientY > 36) { tBottom = false; past(); } }, { passive: true });

  // ---- keys: looking under the hood, finding, saving; Enter for the button; the end of the page ---------------------------
  addEventListener('keydown', e => {
    const k = e.key, mod = e.ctrlKey || e.metaKey, t = e.target;
    if (k === 'Escape') { view.closeMenu(); return; }
    if (k === 'F12' || (mod && e.shiftKey && /^[ijc]$/i.test(k)) || (mod && e.altKey && /^[ij]$/i.test(k)) || (mod && /^u$/i.test(k))) g.on('key', { k: 'source' });
    else if (mod && /^f$/i.test(k)) g.on('key', { k: 'find' });
    else if (mod && /^s$/i.test(k)) g.on('key', { k: 'save' });
    else if (k === 'Enter' && !mod && !isField(t) && !(t.closest && t.closest('button, a, [role=button]')) && !cont.hidden && !veilOpen() && stage.dataset.view === 'page') { e.preventDefault(); cont.click(); }
    else if (!mod && !isField(t) && ['End', 'PageDown', 'ArrowDown', ' '].includes(k) && atBottom() && waited(350)) past();
  });
  $('stage').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('todo')) { e.preventDefault(); e.target.click(); } });

  // ---- the buttons and the things you can poke --------------------------------------------------------------------------
  cont.addEventListener('click', () => {
    g.input(); sound.thud();
    const off = cont.getAttribute('aria-disabled') === 'true';
    if (off) { cont.classList.remove('nudge'); void cont.offsetWidth; cont.classList.add('nudge'); }
    g.on('press', { disabled: off });
  });
  $('signBtn').addEventListener('click', () => { g.input(); sound.thud(); const name = $('gbName').value.trim().slice(0, 24); if (g.scene === 'retroHub' || g.scene === 'retro') view.signGuestbook(name); g.on('press', { name }); });
  $('gbName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('signBtn').click(); } });
  $('postBtn').addEventListener('click', () => {
    const text = $('cmText').value.trim();
    if (!text) { $('cmText').focus(); return; }
    g.input(); sound.thud(); view.addComment(text); g.on('press', { text });
  });
  document.querySelectorAll('[data-chip]').forEach(b => b.addEventListener('click', () => { $('cmText').value = b.dataset.chip; $('cmText').focus(); }));
  stage.addEventListener('click', e => {
    const t = e.target.closest('[data-poke]');
    if (!t || t.matches('input') || t.closest('label') || e.target.closest('button')) return;
    g.input(); g.on('poke', { id: t.dataset.poke });
  });
  stage.addEventListener('change', e => {
    const t = e.target; if (!t.matches || !t.matches('input[data-poke]')) return;
    const id = t.dataset.poke; if (id.startsWith('pref:')) view.prefs[id.slice(5)] = t.checked;
    g.input(); g.on('poke', { id, on: t.checked });
  });

  // ---- small things, and leaving -------------------------------------------------------------------------------------------
  addEventListener('beforeprint', () => g.on('print'));
  addEventListener('offline', () => g.on('offline')); addEventListener('online', () => g.on('online'));
  addEventListener('click', e => { if (e.target.closest && e.target.closest('.toybox-home')) { homing = true; setTimeout(() => { homing = false; }, 1500); } }, true);
  const armed = () => g.mode === 'play' && !g.flags.free && !homing && !noPrompt && g.s.interacted && !coarse && !demo
    && (!navigator.userActivation || navigator.userActivation.hasBeenActive);   // the browser only asks if you've really touched the page
  addEventListener('beforeunload', e => {
    if (!armed()) return;
    e.preventDefault(); e.returnValue = '';   // the browser asks; if the page is still here afterwards, you stayed
    g.on('leave'); setTimeout(() => g.on('stayed'), 600);
  });

  return { noPrompt() { noPrompt = true; } };
}
