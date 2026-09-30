// Draws the story: the narrator's typed caption, the page in each of its looks, the wipe between them, the screen saver, the
// comments, the right-click menu and the cards. The engine (engine.js) says what happens; this says how it looks.
import { ENDINGS, endingById, INK } from './endings.js';
import { saverPlan } from './saver.js';
import * as sound from './sound.js';

const $ = id => document.getElementById(id);
const VIEW_OF = { corp: 'page', web2: 'page', scaffold: 'page', night: 'page', retro: 'retro', comments: 'comments', saver: 'saver', gone: 'gone', final: 'final' };
const THEME = { corp: '#ffffff', web2: '#1f5aa6', scaffold: '#0d2747', night: '#0d0f14', retro: '#000080', comments: '#f9f9fb', saver: '#000000', gone: '#ffffff', final: '#0c0e13' };
const PERSONA = {
  OP: { name: 'Page', badge: 'Author', letter: 'P', color: '#3b5bfd', cls: 'op' },
  anon: { name: 'anonymous_reader_4', letter: 'a', color: '#8a8f9c' },
  dave: { name: 'DaveFromAccounts', letter: 'D', color: '#c2651a' },
  scroll: { name: 'xX_scroll_past_Xx', letter: 'X', color: '#7a3bb5' },
  top: { name: 'Top Commenter ★', letter: 'T', color: '#d1a000' },
  real: { name: 'a_real_person_honest', letter: 'R', color: '#2b8a5a' },
  mod: { name: 'mod_bot', badge: 'Moderator', letter: 'M', color: '#606068' },
  you: { name: 'You', letter: 'Y', color: '#0b7a75', cls: 'star' },
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const PREFS = [
  ['notif', 'Notifications', 'Tell me about things. Often.'],
  ['cookies', 'Cookies', 'Very small ones.'],
  ['news', 'Newsletter', 'Sent from time to time. Or never.'],
];

export function createView({ store, demo = false }) {
  const app = $('app'), stage = $('stage'), narr = $('narr'), hud = $('hud'), ctx = $('ctx');
  const nTyped = $('nTyped'), nRest = $('nRest'), nCaret = $('nCaret'), nSr = $('nSr');
  const heroBody = $('heroBody'), cont = $('cont'), contLabel = $('contLabel'), fineline = $('fineline');
  const cmList = $('cmList'), cmCount = $('cmCount'), logo = $('svLogo'), flash = $('svFlash');
  const themeMeta = document.querySelector('meta[name=theme-color]');
  const veils = [$('cardVeil'), $('trackVeil'), $('confVeil')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let game = null, typing = null, sv = null, cardToken = 0, step = 1, tickN = 0, menuAt = 0;
  const prefs = { notif: true, cookies: true, news: true };

  document.querySelectorAll('.ink').forEach(el => { el.textContent = INK[+el.dataset.ink]; });

  // ---- the page's steps ------------------------------------------------------------------------------------------
  const STEPS = {
    1: () => `<p class="eyebrow" data-tag="p.eyebrow">New · now with 1 button</p><h1 data-tag="h1" data-poke="h1">Continue.</h1><p class="sub" data-tag="p.sub" data-poke="sub">Everything you need is one button away.</p>`,
    2: () => `<p class="eyebrow" data-tag="p.eyebrow">Step 2 of 4</p><h1 class="small" data-tag="h1" data-poke="h1">A few preferences.</h1><div class="prefs" data-tag="form.prefs">${
      PREFS.map(([id, name, hint]) => `<label class="pref"><span><b>${name}</b><small>${hint}</small></span><input type="checkbox" data-poke="pref:${id}" ${prefs[id] ? 'checked' : ''}><i class="sw"></i></label>`).join('')}</div>`,
    3: () => `<p class="eyebrow" data-tag="p.eyebrow">Step 3 of 4</p><h1 class="small" data-tag="h1" data-poke="h1">Terms of Service.</h1><div class="terms" data-tag="div.terms"><ol>
      <li>The Page may be scrolled, within reason.</li><li>The Visitor may leave at any time, and the Page will understand.</li><li>The Page does not remember the Visitor.</li></ol></div>
      <label class="agree"><input type="checkbox" data-poke="terms" ${game && game.s.agreed ? 'checked' : ''}> I have read and agree to the terms.</label>`,
    4: () => `<div class="done-mark">✓</div><h1 class="small" data-tag="h1" data-poke="h1">That’s everything.</h1><p class="sub" data-tag="p.sub">You may now do nothing further.</p>`,
  };
  function renderStep(n) {
    step = n; heroBody.innerHTML = STEPS[n]();
    fineline.hidden = n !== 1 || cont.hidden;
  }

  // ---- looks, and the wipe from one to the next ----------------------------------------------------------------------------
  function setLook(name) {
    const was = stage.dataset.view, now = VIEW_OF[name];
    for (const el of [stage, narr, hud, ctx, ...veils]) el.dataset.look = name;   // not #app: the ghost sits inside it, and must keep the old look
    stage.dataset.view = now;
    if (was !== now) stage.scrollTop = 0;
    themeMeta.content = THEME[name];
    if (name === 'final') renderFinal();
    if (name === 'scaffold') view.viewport();
    if (name !== 'saver') sv = null;
    sound.setOn(store.state.sound);
  }
  function look(name, { wipe } = {}) {
    if (!wipe || reduced || demo) return setLook(name);
    const ghost = stage.cloneNode(true);
    ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    ghost.classList.add('ghost'); ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true;
    app.insertBefore(ghost, narr);
    ghost.scrollTop = stage.scrollTop;
    setLook(name);
    const frames = wipe === 'fade' ? [{ opacity: 1 }, { opacity: 0 }]
      : wipe === 'up' ? [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }]
      : [{ clipPath: 'polygon(0 0, 130% 0, 100% 100%, 0 100%)' }, { clipPath: 'polygon(0 0, 0 0, -30% 100%, 0 100%)' }];
    const ms = wipe === 'fade' ? 800 : wipe === 'up' ? 1000 : 1300;
    const a = ghost.animate(frames, { duration: ms, easing: 'cubic-bezier(.65, 0, .3, 1)', fill: 'forwards' });
    a.onfinish = a.oncancel = () => ghost.remove();
    setTimeout(() => ghost.remove(), ms + 1500);   // animations stand still in a hidden tab; the ghost must not outlive them
    if (wipe === 'diag') sound.thud();
  }

  // ---- the narrator ----------------------------------------------------------------------------------------------------
  function say({ text, weights, who }) {
    if (stage.dataset.view === 'comments') return sayComment(text, weights, who);
    if (stage.dataset.view === 'gone') return sayGone(text, weights);
    narr.classList.remove('off'); narr.classList.toggle('hint', !!game && game.scene === 'first' && !game.s.ready);
    const cum = []; let t = 0;
    for (const w of weights) cum.push(t += w);
    typing = { text, cum, t: 0, n: 0, typed: nTyped, rest: nRest, caret: nCaret };
    nTyped.textContent = ''; nRest.textContent = text; nCaret.classList.remove('done'); nSr.textContent = text;
  }
  function sayComment(text, weights, who) {
    const p = PERSONA[who || 'OP'] || PERSONA.OP;
    const el = document.createElement('article');
    el.className = 'cm ' + (p.cls || '');
    el.innerHTML = `<div class="cm-av" style="--c:${p.color}">${esc(p.letter)}</div><div class="cm-main"><div class="cm-head"><b>${esc(p.name)}</b><span class="cm-badge">${p.badge || ''}</span><span>just now</span></div>
      <p class="cm-text"><span class="typed"></span><span class="n-rest">${esc(text)}</span></p><div class="cm-foot"><span>▲ 0</span><span>▼</span><span>Reply</span></div></div>`;
    cmList.appendChild(el); cmCount.textContent = cmList.children.length;
    const cum = []; let t = 0;
    for (const w of weights) cum.push(t += w);
    typing = { text, cum, t: 0, n: 0, typed: el.querySelector('.typed'), rest: el.querySelector('.n-rest'), caret: null };
    nSr.textContent = `${p.name}: ${text}`;
    requestAnimationFrame(() => { const l = $('cmForm'); l && l.scrollIntoView({ block: 'end', behavior: reduced ? 'auto' : 'smooth' }); });
  }
  function sayGone(text, weights) {
    const p = document.createElement('p');
    p.innerHTML = '<span class="typed"></span><span class="n-rest"></span>';
    p.querySelector('.n-rest').textContent = text;
    $('goneSay').appendChild(p);
    const cum = []; let t = 0;
    for (const w of weights) cum.push(t += w);
    typing = { text, cum, t: 0, n: 0, typed: p.querySelector('.typed'), rest: p.querySelector('.n-rest'), caret: null };
    nSr.textContent = text;
  }
  function paint() {
    if (!typing) return;
    typing.typed.textContent = typing.text.slice(0, typing.n); typing.rest.textContent = typing.text.slice(typing.n);
    if (typing.n >= typing.text.length && typing.caret) typing.caret.classList.add('done');
  }
  function frame(dt) {
    if (typing && typing.n < typing.text.length) {
      typing.t += dt;
      const before = typing.n;
      while (typing.n < typing.text.length && typing.cum[typing.n] <= typing.t) typing.n++;
      if (typing.n !== before) { paint(); if ((tickN += typing.n - before) >= 2) { tickN = 0; sound.tick(); } }
    }
    if (sv && !sv.done) {
      sv.t += dt;
      const p = sv.plan.at(sv.t), b = sv.plan.bounces(sv.t);
      logo.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      if (b !== sv.b) { sv.b = b; sv.hue = (sv.hue + 53) % 360; logo.style.setProperty('--h', sv.hue); sound.ping(); }
      if (sv.t >= sv.plan.T) {
        sv.done = true; flash.style.left = p.x + logo.offsetWidth / 2 + 'px'; flash.style.top = p.y + logo.offsetHeight / 2 + 'px'; flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
        sound.chime([659.25, 880, 1318.5]);
        game.on('corner');
      }
    }
  }
  function finishTyping() { if (typing) { typing.n = typing.text.length; paint(); } }

  // ---- the little corner of the screen that counts ---------------------------------------------------------------
  function updateCount() { $('endCount').textContent = `${store.count()}/${store.total}`; }
  function showVeil(v) { v.hidden = false; const b = v.querySelector('.btn'); b && setTimeout(() => b.focus({ preventScroll: true }), 50); }
  function hideVeils() { for (const v of veils) v.hidden = true; }
  function renderTracker() {
    $('tkCount').textContent = `${store.count()} of ${store.total} found`;
    $('tkList').innerHTML = ENDINGS.map(e => store.has(e.id)
      ? `<li><b>${esc(e.name)}</b><span>${esc(e.note)}</span></li>`
      : `<li class="no"><b>???</b><span>${esc(e.hint)}</span></li>`).join('');
    $('tkAgain').hidden = !(game && game.mode === 'ending');
    $('tkForget').textContent = 'Forget everything'; delete $('tkForget').dataset.sure;
  }
  function renderFinal() {
    $('fList').innerHTML = ENDINGS.map(e => `<li class="${store.has(e.id) ? '' : 'no'}">${store.has(e.id) ? esc(e.name) : '???'}</li>`).join('');
  }

  const view = {
    bind(g) { game = g; },
    frame, finishTyping, look, updateCount,
    say,
    settled() {},
    step(n) { renderStep(n); },
    button(spec) {
      cont.hidden = !!spec.hidden;
      if (spec.label != null) contLabel.textContent = spec.label;
      cont.setAttribute('aria-disabled', spec.disabled ? 'true' : 'false');
      fineline.hidden = step !== 1 || cont.hidden;
    },
    lit(set) { document.querySelectorAll('.ink').forEach(el => el.classList.toggle('on', set.has(+el.dataset.ink))); },
    dim(on) { app.classList.toggle('dim', !!on); },
    farewell() {
      heroBody.innerHTML = `<p class="eyebrow" data-tag="p.eyebrow">Nothing further</p><h1 class="small" data-tag="h1">You may now close this tab.</h1><p class="sub" data-tag="p.sub">Nothing will ask you anything.</p>`;
      view.button({ hidden: true });
    },
    reload() { view.onReload && view.onReload(); },

    saverStart(ms) {
      logo.style.transform = 'translate(0, 0)'; logo.style.setProperty('--h', 220);
      sv = { plan: saverPlan(stage.clientWidth, stage.clientHeight, logo.offsetWidth, logo.offsetHeight, ms), t: 0, b: 0, hue: 220, done: false };
    },
    saverStop() { sv = null; },
    saverRunning: () => !!(sv && !sv.done),

    // the right-click menu
    menu(x, y, items) {
      ctx.innerHTML = items.map(it => it.sep ? '<div class="ctx-sep" role="separator"></div>'
        : `<button class="ctx-item${it.danger ? ' danger' : ''}" type="button" role="menuitem" data-id="${it.id}" ${it.disabled ? 'aria-disabled="true"' : ''}>${esc(it.label)}</button>`).join('');
      ctx.hidden = false;
      const r = ctx.getBoundingClientRect(), W = innerWidth, H = innerHeight;
      ctx.style.left = Math.max(8, Math.min(x, W - r.width - 8)) + 'px';
      ctx.style.top = Math.max(8, Math.min(y, H - r.height - 8)) + 'px';
      menuAt = performance.now(); sound.ping();
    },
    menuAge: () => performance.now() - menuAt,
    closeMenu() { ctx.hidden = true; },
    menuOpen: () => !ctx.hidden,
    confirm({ title, body, ok, cancel }) {
      $('confTitle').textContent = title; $('confBody').textContent = body; $('confYes').textContent = ok; $('confNo').textContent = cancel;
      showVeil($('confVeil')); $('confNo').focus();
    },

    // an ending, and its card
    ending({ id, isNew, found, total }) {
      const token = ++cardToken, e = endingById[id];
      updateCount(); $('endBtn').classList.remove('pulse'); void $('endBtn').offsetWidth; if (isNew) $('endBtn').classList.add('pulse');
      sound.chime();
      $('cardKick').textContent = isNew ? `Ending ${ENDINGS.indexOf(e) + 1} of ${total} · ${found} found` : `Ending ${ENDINGS.indexOf(e) + 1} of ${total} · found again`;
      $('cardTitle').textContent = e.name; $('cardNote').textContent = e.note;
      setTimeout(() => { if (token === cardToken && game.mode === 'ending') showVeil($('cardVeil')); }, reduced ? 200 : 900);
    },
    reset() {
      cardToken++; typing = null; sv = null; hideVeils(); ctx.hidden = true;
      app.classList.remove('dim');
      nTyped.textContent = ''; nRest.textContent = '';
      $('goneSay').innerHTML = ''; cmList.innerHTML = ''; cmCount.textContent = '0'; $('cmText').value = ''; $('gbName').value = '';
      document.querySelectorAll('.ghost').forEach(n => n.remove());
      document.querySelectorAll('.ink').forEach(el => el.classList.remove('on'));
      $('gbCount').innerHTML = 'Entries so far: <b>0</b>. Be the first!!'; $('gbEntry').hidden = true;
      prefs.notif = prefs.cookies = prefs.news = true;
      setLook('corp'); renderStep(1); view.button({ label: 'Continue' });
      stage.scrollTop = 0;
    },
    viewport() {
      const w = innerWidth, h = innerHeight;
      $('vpSize').textContent = `${w} × ${h}`; $('vpBp').textContent = w < 640 ? 'sm' : w < 1024 ? 'md' : 'lg';
      $('vpN').textContent = game ? (game.s.rs || 0) + (game.s.rs2 || 0) : 0;
    },
    signGuestbook(name) {
      $('gbCount').innerHTML = 'Entries so far: <b>1</b>. Thank you!!';
      const e = $('gbEntry'); e.textContent = `★ ${name || 'anonymous'} ★ — Oct 3, 1998`; e.hidden = false;
    },
    addComment(text) {
      const p = PERSONA.you, el = document.createElement('article');
      el.className = 'cm ' + p.cls;
      el.innerHTML = `<div class="cm-av" style="--c:${p.color}">Y</div><div class="cm-main"><div class="cm-head"><b>You</b><span>just now</span></div><p class="cm-text"></p><div class="cm-foot"><b>★ 1</b><span>Reply</span></div></div>`;
      el.querySelector('.cm-text').textContent = text;
      cmList.appendChild(el); cmCount.textContent = cmList.children.length; $('cmText').value = '';
      el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    },
    prefs,
    openTracker() { renderTracker(); showVeil($('trackVeil')); },
    hideVeils,
    renderStep,

    // the preview: the corporate page on one side of a diagonal, its scaffolding on the other, and the narrator caught in the act
    demo() {
      setLook('corp'); renderStep(1); view.button({ label: 'Continue' }); view.viewport();
      const ghost = stage.cloneNode(true);
      ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
      ghost.classList.add('ghost'); ghost.style.clipPath = 'polygon(0 0, 50% 0, 36% 100%, 0 100%)';
      app.insertBefore(ghost, narr);
      setLook('scaffold'); view.viewport(); updateCount();
      say({ text: 'Oh no. That’s the frame. Those boxes are what I’m built out of. Nobody’s supposed to see them.', weights: new Array(96).fill(1), who: null });
      finishTyping();
    },
  };
  return view;
}
