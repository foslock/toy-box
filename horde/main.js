// Horde: the page. Fitting the field to the screen in whole pixels, input (tap or hold the dark rim to raise a
// monster there, tap the field to plant the flag, tap the hero or HUNT to send everyone in), the loop, the top bar
// and tray, the cards between nights, hints for a first night, saving, and the ?demo, ?autoplay and ?debug modes.
import { Game, STEP, edgePoint, mulberry } from './game.js';
import { NIGHT_LEN, MAX_LEVEL, xpNeed, ESSENCE, MOBS, MOB_ORDER, WEAPONS, PASSIVES, BREAD, HEROES, ROMAN } from './data.js';
import { View } from './render.js';
import { toCanvas, paint } from './art.js';
import { Sound } from './sound.js';
import { Bot } from './bot.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug'), AUTO = Q.has('autoplay');
const SPEED = +Q.get('speed') || 1;
const KEY = 'horde.v1';
const TOUCH = matchMedia('(pointer: coarse)').matches || Q.has('touch');
document.body.classList.toggle('touch', TOUCH);
document.body.classList.toggle('demo', DEMO);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const TAP = TOUCH ? 'Tap' : 'Click', tap = TAP.toLowerCase();
window.__errs = []; addEventListener('error', e => window.__errs.push(e.message));

/* ------------------------------------------------------------------------------------------------- state */
const store = { best: 1, won: {}, sound: true, hints: {}, plays: 0 };
try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* a bad save starts fresh */ }
const persist = !DEMO && !AUTO;
function save() { if (!persist) return; try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage full or off */ } }

let view;
try { view = new View($('c')); }
catch (e) {
  $('err').hidden = false;
  $('err').innerHTML = `<div><div class="goth" style="font-size:48px;color:var(--blood)">Horde</div><p>This needs WebGL 2, which this browser didn't offer.<br>Try a recent Chrome, Safari or Firefox.</p></div>`;
  throw e;
}
const S = view.S;
const snd = new Sound(); snd.on = store.sound !== false;
let g = null, bot = null, mode = 'title', night = Math.min(6, +Q.get('night') || store.best || 1), sel = 'imp', hold = Q.has('hold');
let overT = 0, lastRally = null;
const ui = { aim: null, bandGlow: 0 };
window.horde = { get g() { return g; }, view, snd, store, ff, step, setHold: v => { hold = v; },
  play: () => startPlay(),
  // ?debug: horde.give('whip:5,garlic:3') hands the hero a kit
  give(spec) { g.hero.weapons = []; for (const part of spec.split(',')) { const [id, lv] = part.split(':'); if (WEAPONS[id]) g.hero.weapons.push({ id, lv: +lv || 1 }); else { g.hero.passives[id] = +lv || 1; if (!g.hero.plist.includes(id)) g.hero.plist.push(id); } } g.recompute(); },
  spawnRing(n = 200, type = 'imp', r = 70) { const h = g.hero; for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, d = r + Math.random() * 40; g.addMob(type, Math.max(3, Math.min(Wl - 3, h.x + Math.cos(a) * d)), Math.max(3, Math.min(Hl - 3, h.y + Math.sin(a) * d * 0.8)), 0); } },
  where: () => { const r = cv.getBoundingClientRect(); return JSON.stringify({ x: r.left + g.hero.x / Wl * r.width, y: r.top + g.hero.y / Hl * r.height }); },
  info: () => JSON.stringify({ t: Math.round(g.t), state: g.state, mobs: g.alive(), hp: Math.round(g.hero.hp), lv: g.hero.lv, ess: Math.round(g.ess), inst: view.lastCount, fps: Math.round(fps), simMs: +perf.sim.toFixed(2), drawMs: +perf.draw.toFixed(2), build: g.hero.weapons.map(w => w.id + w.lv).join(' ') }) };

/* ------------------------------------------------------------------------------------------------- fitting the field */
// the field is drawn at its own small size and scaled up by a whole number of device pixels, so every pixel is square
const AREA = 112000;
let Wl = 400, Hl = 270, scale = 3, dpr = 1, bandPx = 16;
function layout() {
  dpr = Math.min(3, devicePixelRatio || 1);
  // the field fits between the top bar and the tray, whatever the notch and home bar take
  const hudH = $('hud').offsetHeight || 58, trayH = $('tray').offsetHeight || 86;
  const cw = innerWidth, ch = Math.max(120, innerHeight - hudH - trayH);
  const dw = cw * dpr, dh = ch * dpr;
  scale = Math.max(1, Math.round(Math.sqrt(dw * dh / AREA)));
  const W = Math.floor(dw / scale), H = Math.floor(dh / scale);
  const cv = $('c');
  cv.style.width = `${W * scale / dpr}px`; cv.style.height = `${H * scale / dpr}px`;
  cv.style.left = `${Math.floor((cw - W * scale / dpr) / 2)}px`;
  cv.style.top = `${hudH + Math.floor((ch - H * scale / dpr) / 2)}px`;
  bandPx = Math.max(13, Math.round(34 * dpr / scale));
  view.band = bandPx;
  if (W !== Wl || H !== Hl || !view.field) {
    Wl = W; Hl = H;
    view.resize(W, H);
    if (g) { g.resize(W, H); view.setField(g.H0.setting, g.seed); }
  }
}
let rz = 0;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 60); });
visualViewport?.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 60); });

/* ------------------------------------------------------------------------------------------------- a night */
function newNight(n, opt = {}) {
  night = n;
  const seed = opt.seed ?? (+Q.get('seed') || ((Date.now() ^ (n * 7919)) & 0xffffff));
  layout();
  g = new Game({ night: n, W: Wl, H: Hl, seed });
  view.setField(g.H0.setting, seed);
  view.parts.n = 0; view.nums = []; view.fx = [];
  bot = opt.bot ? new Bot({ kind: opt.bot, rand: mulberry(seed ^ 0x5eed) }) : null;
  overT = 0; lastRally = null; picks.length = 0; $('pick').hidden = true;
  if (!g.roster.includes(sel)) sel = g.roster[0];
  buildHud(); buildTray();
}
function startPlay() {
  mode = 'play'; closeCard();
  snd.init(); snd.music(true, night);
  toast(`Night ${ROMAN[night]}`, `${g.H0.name} at ${g.H0.night.replace(/^The /, 'the ')}`);
  store.plays++; save();
  hintClock = 0;
}

/* ------------------------------------------------------------------------------------------------- the top bar */
let kitSig = '', lastHp = -1;
function buildHud() {
  const H0 = g.H0;
  $('hname').textContent = H0.name;
  $('hnight').textContent = `Night ${ROMAN[night]} · ${H0.night}`;
  const f = toCanvas(S.img['hero_' + H0.id], 2); f.id = 'face'; f.className = 'px'; f.style.width = `${f.width}px`; f.style.height = `${f.height}px`;
  $('face').replaceWith(f);
  $('asc').textContent = `ascends at ${MAX_LEVEL}`;
  kitSig = ''; lastHp = -1;
  drawMoon(0);
}
function drawMoon(p) {
  // the moon wanes toward dawn; in the last stretch, a sliver of sun
  const c = $('moon'), x = c.getContext('2d');
  x.clearRect(0, 0, 12, 12);
  const sun = p > 0.86;
  x.fillStyle = sun ? '#f2c14e' : '#eadfc4';
  for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) {
    const d = Math.hypot(i - 5.5, j - 5.5);
    if (d > 5.2) continue;
    if (!sun && Math.hypot(i - 5.5 - (2 + p * 6), j - 4.5) < 4.6) continue;
    if (sun && j > 6) continue;
    x.fillRect(i, j, 1, 1);
  }
  if (sun) { x.fillStyle = '#b07a24'; x.fillRect(0, 7, 12, 1); }
}
function itemCanvas(id, s = 2) { return toCanvas(S.icon[id] || S.icon.bread, s); }
function itemName(id) { return WEAPONS[id]?.name || PASSIVES[id]?.name || BREAD.name; }
function renderKit() {
  const h = g.hero, sig = h.weapons.map(w => w.id + w.lv).join() + '|' + h.plist.map(k => k + h.passives[k]).join();
  if (sig === kitSig) return;
  const prev = kitSig; kitSig = sig;
  const el = $('kit'); el.innerHTML = '';
  const cell = (id, lv, max) => {
    const d = document.createElement('div'); d.className = 'slot';
    if (id) {
      d.title = `${itemName(id)} ${lv}`;
      const c = itemCanvas(id); c.className = 'px'; d.appendChild(c);
      const u = document.createElement('u'); for (let i = 0; i < max; i++) { const s = document.createElement('s'); if (i < lv) s.className = 'on'; u.appendChild(s); } d.appendChild(u);
      if (prev && !prev.includes(id + lv)) d.classList.add('new');
    }
    el.appendChild(d);
  };
  for (let i = 0; i < 4; i++) { const w = h.weapons[i]; cell(w?.id, w?.lv, 5); }
  for (let i = 0; i < 4; i++) { const k = h.plist[i]; cell(k, h.passives[k], PASSIVES[k]?.max || 5); }
}
let hudLast = {};
function setText(id, v) { if (hudLast[id] !== v) { hudLast[id] = v; $(id).textContent = v; } }
function setW(id, p) { const v = `calc(${(Math.max(0, Math.min(1, p)) * 100).toFixed(1)}% - 4px)`; if (hudLast[id] !== v) { hudLast[id] = v; $(id).style.width = v; } }
function updateHud() {
  const h = g.hero;
  const hp = Math.max(0, h.hp);
  setW('hpf', hp / h.maxhp);
  if (Math.abs(hp - lastHp) > 0.5) { setW('hpg', hp / h.maxhp); if (hp < lastHp - 0.5) { $('hp').classList.remove('hit'); void $('hp').offsetWidth; $('hp').classList.add('hit'); } lastHp = hp; }
  setText('hpn', `${Math.ceil(hp)} / ${Math.round(h.maxhp)}`);
  setW('xpf', h.lv >= MAX_LEVEL ? 1 : h.xp / xpNeed(h.lv));
  setText('lv', String(h.lv));
  const left = Math.max(0, NIGHT_LEN - g.t);
  setText('tleft', clock(Math.ceil(left)));
  const late = left < 40;
  if (hudLast.late !== late) { hudLast.late = late; $('clock').classList.toggle('late', late); }
  const mp = Math.floor((g.t / NIGHT_LEN) * 24) / 24;
  if (hudLast.moon !== mp) { hudLast.moon = mp; drawMoon(mp); }
  setText('essn', String(Math.floor(g.ess)));
  setW('essf', g.ess / ESSENCE.cap);
  for (const c of cardsEl) { const poor = g.ess < MOBS[c.dataset.k].cost; if (c._poor !== poor) { c._poor = poor; c.classList.toggle('poor', poor); } }
  const hunting = g.flag.hunt;
  if (hudLast.hunt !== hunting) { hudLast.hunt = hunting; $('hunt').classList.toggle('on', hunting); }
  renderKit();
}

/* ------------------------------------------------------------------------------------------------- the tray */
let cardsEl = [];
function buildTray() {
  const el = $('cards'); el.innerHTML = ''; cardsEl = [];
  const have = new Set(g.roster);
  MOB_ORDER.forEach((k, i) => {
    const M = MOBS[k], b = document.createElement('button');
    b.className = 'mc'; b.dataset.k = k;
    const locked = !have.has(k);
    const nightOf = HEROES.findIndex(h => h.unlock.includes(k)) + 1;
    b.title = locked ? `Unlocks on night ${ROMAN[nightOf]}` : `${M.name}: ${M.blurb} (${i + 1})`;
    b.setAttribute('aria-label', locked ? `${M.name}, locked` : `${M.name}, ${M.cost} essence`);
    const c = toCanvas(S.img[k], 2); c.className = 'px'; b.appendChild(c);
    b.insertAdjacentHTML('beforeend', `<span class="cost">${locked ? ROMAN[nightOf] : M.cost}</span>${M.n > 1 && !locked ? `<span class="n">×${M.n}</span>` : ''}<span class="k">${i + 1}</span>`);
    if (locked) { b.classList.add('locked'); b.disabled = true; }
    else { b.addEventListener('click', () => select(k)); cardsEl.push(b); }
    if (!locked && HEROES[night - 1].unlock.includes(k) && night > 1) b.classList.add('newly');
    el.appendChild(b);
  });
  select(sel);
  const hc = $('huntc'), x = hc.getContext('2d'); x.clearRect(0, 0, 12, 14);
  const sk = toCanvas(paint(['.www.', 'wwwww', 'wrwrw', '.wWw.', '.w.w.'], { w: '#f0e6d0', W: '#b8ac90', r: '#ff3b2f' }), 1);
  x.drawImage(sk, 2, 3);
}
function select(k) {
  if (!g || !g.roster.includes(k)) return;
  sel = k;
  for (const c of $('cards').children) c.classList.toggle('sel', c.dataset.k === k);
  snd.ui('select');
}

/* ------------------------------------------------------------------------------------------------- input */
const cv = $('c');
const ptrs = new Map();
const playing = () => mode === 'play' && g.state === 'play' && !bot;
function logical(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * Wl, (e.clientY - r.top) / r.height * Hl]; }
const rimDist = (x, y) => Math.min(x, Wl - x, y, Hl - y);
function trySpawn(x, y, quiet) {
  const e = edgePoint(Wl, Hl, x, y), why = g.blocked(sel, e.x, e.y);
  if (why) {
    if (!quiet) {
      if (why === 'essence') { $('ess').animate([{ transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }], { duration: 160, easing: 'steps(3)' }); snd.ui('no'); }
      if (why === 'light') { hint('light', `Not in the hero’s light: raise them from the dark.`, 2.5, true); snd.ui('no'); }
      if (why === 'full') { hint('full', `The ground can give up no more. Spend the ones you have.`, 2.5, true); snd.ui('no'); }
    }
    return false;
  }
  g.spawn(sel, x, y);
  done('spawn');
  return true;
}
cv.addEventListener('pointerdown', e => {
  snd.init();
  if (!playing()) return;
  e.preventDefault();
  try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ }
  const [x, y] = logical(e);
  if (rimDist(x, y) < bandPx) { ptrs.set(e.pointerId, { kind: 'spawn', x, y, next: 0.24 }); trySpawn(x, y); }
  else { ptrs.set(e.pointerId, { kind: 'flag', x, y }); plant(x, y); }
});
cv.addEventListener('pointermove', e => {
  if (!playing()) { ui.aim = null; return; }
  const [x, y] = logical(e), p = ptrs.get(e.pointerId);
  if (p) { p.x = x; p.y = y; if (p.kind === 'flag' && Math.hypot(x - g.hero.x, y - g.hero.y) > 22) plant(x, y, true); }
  if (e.pointerType === 'mouse') aimAt(x, y);
});
function release(e) {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  ptrs.delete(e.pointerId);
  if (p.kind === 'flag' && playing()) plant(p.x, p.y);
}
cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);
cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') ui.aim = null; });
cv.addEventListener('contextmenu', e => e.preventDefault());
function plant(x, y, drag) {
  const wasHunt = g.flag.hunt;
  g.setFlag(x, y);
  if (!g.flag.hunt) { lastRally = { x: g.flag.x, y: g.flag.y }; if (!drag) done('flag'); }
  else if (!wasHunt || !drag) done('hunt');
  if (!drag) snd.ui(g.flag.hunt ? 'hunt' : 'flag');
}
function aimAt(x, y) {
  if (rimDist(x, y) < bandPx) {
    const e = edgePoint(Wl, Hl, x, y), why = g.blocked(sel, e.x, e.y);
    ui.aim = { kind: 'spawn', x: e.x, y: e.y, side: e.side, ok: !why || why === 'essence', type: sel };
  } else ui.aim = { kind: 'flag', x, y };
}
$('hunt').addEventListener('click', () => { snd.init(); if (!playing()) return; g.hunt(); done('hunt'); snd.ui('hunt'); });
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (k === 'Escape' || k === 'p' || k === 'P') { if (mode === 'play') pause(); else if (mode === 'paused') resume(); e.preventDefault(); return; }
  if (k === 'm' || k === 'M') { toggleSound(); return; }
  if (mode === 'play' && /^[1-6]$/.test(k)) { const t = MOB_ORDER[+k - 1]; if (g.roster.includes(t)) select(t); return; }
  if (mode === 'play' && (k === ' ' || k === 'h' || k === 'H')) {
    e.preventDefault();
    if (!playing()) return;
    if (g.flag.hunt && lastRally) { g.setFlag(lastRally.x, lastRally.y); snd.ui('flag'); }
    else { g.hunt(); done('hunt'); snd.ui('hunt'); }
    return;
  }
  if ((k === 'Enter' || k === ' ') && !$('card').hidden) { const b = $('cbox').querySelector('.btn.go'); if (b) { e.preventDefault(); b.click(); } }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && !bot) pause(); });

/* ------------------------------------------------------------------------------------------------- the hero's picks */
const picks = [];
let pickT = 0;
function showPick(ev) {
  if (DEMO || !ev.opts?.length) return;
  picks.push(ev);
  if (picks.length === 1) nextPick();
}
function nextPick() {
  const ev = picks[0]; if (!ev) { $('pick').hidden = true; return; }
  pickT = 0;
  $('pickwho').textContent = `${g.H0.name} · level ${ev.lv}`;
  const row = $('pickrow'); row.innerHTML = '';
  for (const o of ev.opts) {
    const d = document.createElement('div'); d.className = 'pc';
    const c = itemCanvas(o.id, 3); c.className = 'px'; d.appendChild(c);
    d.insertAdjacentHTML('beforeend', `${esc(itemName(o.id))}<span class="lv">${o.kind === 'b' ? 'heal' : o.lv === 1 ? 'new' : 'level ' + o.lv}</span>`);
    d._o = o; row.appendChild(d);
  }
  $('pick').hidden = false;
}
function tickPick(dt) {
  if (!picks.length) return;
  pickT += dt;
  if (pickT > 0.55 && !picks[0].shown) {
    picks[0].shown = true;
    for (const d of $('pickrow').children) { const ch = d._o.id === picks[0].pick.id; d.classList.add(ch ? 'chosen' : 'not'); }
    snd.ui('pick');
  }
  if (pickT > (picks.length > 1 ? 1.4 : 2.4)) { picks.shift(); nextPick(); }
}

/* ------------------------------------------------------------------------------------------------- hints, for a first night */
let hintClock = 0, hintNow = null, hintT = 0;
const HINTS = [
  { id: 'spawn', when: () => true, text: () => `<b>${TAP}</b> the dark rim of the field to raise imps there. Hold to keep raising.` },
  { id: 'flag', when: () => g.alive() >= 12 && hintClock > 6, text: () => `<b>${TAP}</b> anywhere in the field to plant your flag. The horde gathers there.` },
  { id: 'hunt', when: () => !g.flag.hunt && g.alive() >= 20, text: () => `When there are enough, <b>${tap} the hero</b> (or HUNT): from the flag, they charge in at a run.` },
  { id: 'gems', when: () => g.gems.length >= 4 && hintClock > 20, text: () => `It walks over to collect its gems. <b>Keep it busy</b>: a gem left 18 seconds sinks into the earth.` },
  { id: 'brute', when: () => g.ess >= 32 && g.roster.includes('brute') && hintClock > 30, text: () => `<b>Brutes</b> are slow, but they hold the hero in place. They feed it less, too.` },
];
function hint(id, html, secs = 6, force = false) {
  if (DEMO || AUTO) return;
  if (!force && store.hints[id]) return;
  hintNow = id; hintT = secs;
  $('hint').innerHTML = html; $('hint').classList.add('on');
}
function done(id) { if (!store.hints[id]) { store.hints[id] = true; save(); } if (hintNow === id) { hintT = Math.min(hintT, 0.6); } }
function tickHints(dt) {
  hintClock += dt;
  if (hintNow) { hintT -= dt; if (hintT <= 0) { $('hint').classList.remove('on'); hintNow = null; } return; }
  if (night > 2 || DEMO || AUTO || bot) return;
  for (const H of HINTS) if (!store.hints[H.id] && H.when()) { hint(H.id, H.text(), H.id === 'spawn' ? 99 : 9); if (H.id === 'gems' || H.id === 'brute') store.hints[H.id] = true; return; }
}
function toast(big, small) {
  const t = $('toast'); t.innerHTML = `<div class="big goth">${esc(big)}</div>${small ? `<small>${esc(small)}</small>` : ''}`;
  t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
}

/* ------------------------------------------------------------------------------------------------- cards */
function card(html) { $('cbox').innerHTML = html; $('card').hidden = false; $('cbox').scrollTop = 0; $('hint').classList.remove('on'); hintNow = null; $('pick').hidden = true; picks.length = 0; }
function closeCard() { $('card').hidden = true; }
function nightButtons() {
  return `<div class="nights">${HEROES.map((h, i) => `<button class="nb${store.won[i + 1] ? ' won' : ''}${i + 1 === night ? ' cur' : ''}" data-n="${i + 1}" ${i + 1 > store.best ? 'disabled' : ''} title="${i + 1 > store.best ? 'Not yet' : esc(h.name + ', ' + h.night)}">${ROMAN[i + 1]}</button>`).join('')}</div>`;
}
function wireNights() { for (const b of $('cbox').querySelectorAll('.nb')) b.addEventListener('click', () => { night = +b.dataset.n; snd.init(); brief(night); }); }
function title() {
  mode = 'title';
  newNight(Math.min(store.best, 6), { bot: 'smart' });
  g.ff(25, gg => bot.tick(gg, STEP));
  snd.music(false);
  card(`
    <p class="eye">a game a night · the toy box</p>
    <div class="logo goth">Horde</div>
    <p class="lede">A hero stands in a field at night with a lantern and a growing arsenal. You are everything out in the dark. Kill the hero before dawn, or before it levels up so far that nothing can touch it.</p>
    <ul class="how">
      <li><b>${TAP} the dark rim</b> to raise monsters there, out of the hero’s light. Essence trickles in all night.</li>
      <li><b>${TAP} the field</b> to plant your flag: the horde gathers there, out of sight. <b>${TAP} the hero</b> or <b>Hunt</b> and they charge in at a run.</li>
      <li>Every monster it kills drops a gem. It levels up by walking over to them, and picks its own upgrades. Keep it busy and the gems sink.</li>
      <li>A new hero each night, with a new build to learn, and a new kind of monster for you.</li>
    </ul>
    <p class="small keys"><kbd>1</kbd>–<kbd>6</kbd> choose a monster · <kbd>Space</kbd> hunt / back to the flag · <kbd>Esc</kbd> pause · <kbd>M</kbd> sound</p>
    ${nightButtons()}
    <div class="row"><button class="btn go" id="bgo">${store.plays ? 'Night ' + ROMAN[Math.min(store.best, 6)] : 'Begin'}</button></div>`);
  wireNights();
  $('bgo').addEventListener('click', () => { snd.init(); brief(Math.min(store.best, 6)); });
}
function brief(n) {
  newNight(n);
  mode = 'brief';
  const H0 = g.H0, f = toCanvas(S.img['hero_' + H0.id], 5);
  const fresh = H0.unlock.filter(k => n > 1);
  const start = H0.start.map(w => Array.isArray(w) ? `${WEAPONS[w[0]].name} (level ${w[1]})` : WEAPONS[w].name).join(' and ');
  card(`
    <p class="eye">Night ${ROMAN[n]} · ${esc(H0.night)}</p>
    <div class="tt goth">${esc(H0.name)}</div>
    <p class="eye" style="letter-spacing:.1em">${esc(H0.title)}</p>
    <div class="file"><div id="ff"></div><div class="tx">
      <p>${esc(H0.lede)}</p>
      <p><span class="k">carries</span>${esc(start)} · ${H0.hp} health${H0.armor ? ` · ${H0.armor} armour` : ''}</p>
      <p><span class="k">what you’ll learn</span>${esc(H0.tells)}</p>
    </div></div>
    ${fresh.map(k => `<div class="new"><span id="nf_${k}"></span><div><b>New in your horde</b>${esc(MOBS[k].name)}: ${esc(MOBS[k].blurb)}</div></div>`).join('')}
    <div class="row"><button class="btn" id="bback">Back</button><button class="btn go" id="bgo">Begin the night</button></div>`);
  f.className = 'px'; $('ff').replaceWith(f);
  for (const k of fresh) { const c = toCanvas(S.img[k], 3); c.className = 'px'; $('nf_' + k).replaceWith(c); }
  $('bgo').addEventListener('click', () => { snd.init(); startPlay(); });
  $('bback').addEventListener('click', title);
}
function pause() {
  if (mode !== 'play') return;
  mode = 'paused'; snd.music(false);
  card(`<div class="tt goth">Paused</div><p class="lede">Night ${ROMAN[night]}: ${esc(g.H0.name)}, ${clock(NIGHT_LEN - g.t)} before dawn.</p>
    <div class="row"><button class="btn" id="bquit">Leave</button><button class="btn" id="bre">Start over</button><button class="btn go" id="bgo">Carry on</button></div>`);
  $('bgo').addEventListener('click', resume);
  $('bre').addEventListener('click', () => brief(night));
  $('bquit').addEventListener('click', title);
}
function resume() { if (mode !== 'paused') return; mode = 'play'; closeCard(); snd.music(true, night); }
function endCard() {
  const won = g.state === 'won', H0 = g.H0, st = g.stats, h = g.hero;
  if (won) { store.won[night] = true; store.best = Math.max(store.best, Math.min(6, night + 1)); save(); }
  const last = night === 6;
  const head = won ? (last ? 'The Dawn Road is dark' : 'The lantern is out') : g.why === 'dawn' ? 'Dawn' : 'Ascended';
  const sub = won ? `${H0.name} fell at ${clock(g.t)} into the night.` : g.why === 'dawn' ? `The sun comes up, and ${H0.name} walks home.` : `${H0.name} reached level ${MAX_LEVEL}. Nothing out here can touch them now.`;
  let tip = '';
  if (!won) {
    const ate = st.fed, sunk = st.sunk;
    if (g.why === 'ascend') tip = `It ate <b>${Math.round(ate)}</b> experience off your dead. Imps are cheap, but every one is a gem; brutes and bloaters feed it far less for the essence.`;
    else if (st.blood < h.maxhp * 0.6) tip = `You drew <b>${Math.round(st.blood)}</b> blood all night. Mass them at the flag first, then send everything in at once, from more than one side.`;
    else tip = `Close: <b>${Math.round(st.blood)}</b> blood drawn. ${H0.tells}`;
    if (sunk > 30 && g.why !== 'ascend') tip += ` (And <b>${Math.round(sunk)}</b> of its experience sank into the ground.)`;
  }
  card(`
    <p class="eye">Night ${ROMAN[night]} · ${esc(H0.night)}</p>
    <div class="tt goth ${won ? 'violet' : g.why === 'dawn' ? 'gold' : 'gold'}">${esc(head)}</div>
    <p class="lede">${esc(sub)}${won && !last ? ` Night ${ROMAN[night + 1]} is open.` : ''}${won && last ? ' All six nights are yours.' : ''}</p>
    <div class="stats">
      <div><b>${st.raised}</b>raised</div><div><b>${st.killed}</b>fell to it</div><div><b>${st.peak}</b>at once</div>
      <div><b>${Math.round(st.blood)}</b>blood drawn</div><div><b>${h.lv}</b>its level</div><div><b>${Math.round(st.sunk)}</b>xp sunk</div>
    </div>
    <div class="build" id="build"></div>
    ${tip ? `<p class="tip">${tip}</p>` : ''}
    <div class="row"><button class="btn" id="btitle">Nights</button>${won && !last ? `<button class="btn" id="bagain">Again</button><button class="btn go" id="bnext">Night ${ROMAN[night + 1]}</button>` : `<button class="btn go" id="bagain">${won ? 'Again' : 'Try again'}</button>`}</div>`);
  const b = $('build');
  for (const w of h.weapons) { const c = itemCanvas(w.id, 2); c.className = 'px'; c.title = `${itemName(w.id)} ${w.lv}`; b.appendChild(c); }
  for (const k of h.plist) { const c = itemCanvas(k, 2); c.className = 'px'; c.title = `${itemName(k)} ${h.passives[k]}`; b.appendChild(c); }
  $('btitle').addEventListener('click', title);
  $('bagain').addEventListener('click', () => brief(night));
  $('bnext')?.addEventListener('click', () => brief(night + 1));
}

/* ------------------------------------------------------------------------------------------------- sound button */
function toggleSound() {
  snd.init(); store.sound = !snd.on; snd.setOn(store.sound); save();
  $('bsound').classList.toggle('off', !snd.on);
}
$('bsound').classList.toggle('off', !snd.on);
$('bsound').addEventListener('click', toggleSound);
$('bmenu').addEventListener('click', () => { snd.init(); if (mode === 'play') pause(); else if (mode === 'paused') resume(); });

/* ------------------------------------------------------------------------------------------------- the loop */
let last = performance.now(), acc = 0, fpsT = 0, fpsN = 0, fps = 60;
const perf = { sim: 0, draw: 0 };
function step(n = 1) { for (let i = 0; i < n; i++) { bot?.tick(g, STEP); g.tick(); } handle(g.drain()); }
function ff(sec) { step(Math.round(sec / STEP)); }
function handle(evs) {
  if (!evs.length) return;
  view.events(evs, g); snd.events(evs, g, mode === 'play' || mode === 'over');
  for (const e of evs) {
    if (e.k === 'level' && mode === 'play') showPick(e);
    if ((e.k === 'win' || e.k === 'lose') && mode === 'play') {
      mode = 'over'; overT = 0; snd.music(false);
      if (e.k === 'win') toast(night === 6 ? 'The Dawn Road' : 'Slain', `${g.H0.name} falls`);
      else toast(e.why === 'dawn' ? 'Dawn' : 'Ascended', e.why === 'dawn' ? 'The night is over' : `${g.H0.name} cannot be touched`);
    }
  }
}
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  fpsT += dt; fpsN++; if (fpsT > 1) { fps = fpsN / fpsT; fpsT = 0; fpsN = 0; }
  const live = mode === 'play' || mode === 'over' || mode === 'title';
  if (live && !hold) {
    acc += dt * SPEED * (mode === 'over' ? 0.6 : 1);
    let n = 0;
    const t0 = performance.now();
    while (acc >= STEP && n < 8 * SPEED) {
      if (mode === 'play' && !bot) for (const p of ptrs.values()) if (p.kind === 'spawn') { p.next -= STEP; if (p.next <= 0) { p.next = 0.22; trySpawn(p.x, p.y, true); } }
      bot?.tick(g, STEP); g.tick(); acc -= STEP; n++;
    }
    if (n >= 8 * SPEED) acc = 0;
    handle(g.drain());
    perf.sim = perf.sim * 0.9 + (performance.now() - t0) / Math.max(1, n) * 0.1;
  }
  if (mode === 'over') { overT += dt; if (overT > 3 && $('card').hidden) { if (AUTO) autoNext(); else endCard(); } }
  if (mode === 'play') { tickPick(dt); tickHints(dt); }
  ui.bandGlow = (ui.aim?.kind === 'spawn' || [...ptrs.values()].some(p => p.kind === 'spawn')) && playing() ? 1 : 0;
  if (!playing()) ui.aim = null;
  const t1 = performance.now();
  view.frame(g, hold ? 0 : dt, ui);
  perf.draw = perf.draw * 0.9 + (performance.now() - t1) * 0.1;
  if (g) updateHud();
  const sh = view.shake;
  cv.style.transform = sh > 0.3 ? `translate(${Math.round((Math.random() - 0.5) * sh) * scale / dpr}px, ${Math.round((Math.random() - 0.5) * sh) * scale / dpr}px)` : '';
  snd.update(g, dt, mode);
  if (DEBUG && Math.floor(now / 500) !== Math.floor((now - dt * 1000) / 500)) document.title = `${fps.toFixed(0)}fps ${g.alive()} mobs ${view.lastCount} inst`;
  requestAnimationFrame(frame);
}
// for the preview: the horde in a ring out in the dark around the lantern, sprung a moment after the page opens
function stageDemo() {
  const R = mulberry(+(Q.get('stage') || 77)), h = g.hero;
  for (const m of g.mobs) m.dead = true;
  g.sweep(); g.gems.length = 0;
  h.x = Wl * 0.5; h.y = Hl * 0.52;
  const mix = ['imp', 'imp', 'imp', 'imp', 'imp', 'imp', 'imp', 'bat', 'bat', 'bat', 'brute', 'shield', 'bloat', 'hag'];
  for (let i = 0; i < +(Q.get('horde') || 700); i++) {
    const a = R() * Math.PI * 2, d = h.see + 4 + Math.pow(R(), 1.6) * 170;
    const x = h.x + Math.cos(a) * d * 1.2, y = h.y + Math.sin(a) * d * 0.8;
    if (x < 3 || y < 3 || x > Wl - 3 || y > Hl - 3) continue;
    let t = mix[(R() * mix.length) | 0];
    if (!g.roster.includes(t) || (t !== 'imp' && t !== 'bat' && R() < 0.5)) t = 'imp';
    g.addMob(t, x, y, 0).face = Math.cos(a) > 0 ? -1 : 1;
  }
  for (let i = 0; i < 6; i++) { const a = R() * Math.PI * 2; g.dropGem(h.x + Math.cos(a) * 30, h.y + Math.sin(a) * 22, 1 + R() * 6); }
  for (let i = 0; i < 30; i++) { g.buildGrid(); g.separate(); }
  g.setFlag(h.x + 90, h.y);
  const b = bot; bot = null;
  setTimeout(() => { bot = b; b.phase = 'charge'; b.phaseT = -6; b.charged = 1e9; g.hunt(); }, +(Q.get('spring') || 1600));
}
function autoNext() {
  const nn = g.state === 'won' ? Math.min(6, night + 1) : night;
  newNight(nn, { bot: Q.get('bot') || 'smart' }); mode = 'play'; closeCard();
}

/* ------------------------------------------------------------------------------------------------- go */
layout();
if (DEMO) {
  const n = +Q.get('night') || 6;
  newNight(n, { bot: 'smart', seed: +Q.get('seed') || 61 });
  g.ff(+Q.get('at') || 70, gg => bot.tick(gg, STEP));
  if (!Q.has('nostage')) setTimeout(stageDemo, +(Q.get('stageAt') || 1900));
  mode = 'play';
} else if (AUTO) {
  newNight(night, { bot: Q.get('bot') || 'smart' });
  mode = 'play';
} else if (Q.has('night')) {
  brief(night);
} else title();
requestAnimationFrame(t => { last = t; frame(t); });
document.fonts?.ready.then(() => { hudLast = {}; }).catch(() => {});
