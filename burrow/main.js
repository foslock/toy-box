// Burrow: the page. Owns the game (sim.js) and its drawing (render.js), and everything you touch or read: steering
// by holding the mouse or a finger (or the keys), the numbers along the top, the depth gauge, the Resonator's
// upgrades while you're at the camp, the words that pop up, the hints, the menu and its finds, saving to this
// browser, the title with its seed, and the end.
import { Game } from './sim.js';
import { View } from './render.js';
import { Sound } from './sound.js';
import { makePlayer } from './autoplay.js';
import { seedOf, randomSeedText, layerAt, rng } from './world.js';
import { W, GROUND, STRATA, ITEMS, ITEM_LIST, UPGRADES, UPGRADE_BY_ID, MATS, CAMP, CORE_DEPTH } from './rules.js';
import { SPRITES, sprite, px } from './art.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo');
const KEY = 'burrow.save';
const TOUCH = matchMedia('(pointer: coarse)').matches;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const metres = n => Math.round(n).toLocaleString('en-US') + ' m';
const clock = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/* ---------- the game, the view, the sound ---------- */
let game, seedText, playing = false, ended = false, ui = { tut: {}, sound: true };
const view = new View($('c'));
view.reduced = REDUCED;
const sound = new Sound();
let player = null;                                   // the stand-in player, in ?demo
let timeScale = 1;                                   // (the demo's slow motion)

function loadSave() { try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function save() {
  if (DEMO || !game || !playing) return;
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, seedText, game: game.toJSON(), ui })); } catch { /* full or blocked: it just won't keep */ }
}
function newGame(text, saved = null) {
  seedText = String(text || randomSeedText()).trim().slice(0, 40) || randomSeedText();
  game = new Game(seedOf(seedText), saved);
  view.cache = new Array(view.cache.length);
  view.cam.ready = false;
  view.fx = []; view.floats = [];
  setSpots = new Map();
  $('sub').textContent = 'Dig to the heart of the world';
  shownMoney = game.money;
  ended = game.won;
  buildCards();
  refreshMenu();
}

/* ---------- steering ---------- */
// Touch and hold (or hold the mouse button) where the worm should go; with more than one finger down, the last one
// pressed steers, and lifting it hands over to another still down. Or the keys: WASD or the arrows, eight ways.
const canvas = $('c');
let hold = null;
const holds = new Map();                              // every pointer held down on the world, oldest first
const keys = new Map();                               // steering keys held down: the key (where it is) → which way
canvas.addEventListener('pointerdown', e => {
  if (e.button > 0 || !playing) return;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* (it's steering all the same) */ }
  hold = { x: e.clientX, y: e.clientY, id: e.pointerId };
  holds.delete(e.pointerId); holds.set(e.pointerId, hold);
  canvas.classList.add('steering');
  sound.unlock();
  e.preventDefault();
});
canvas.addEventListener('pointermove', e => { const h = holds.get(e.pointerId); if (h) { h.x = e.clientX; h.y = e.clientY; } });
const let_go = e => {
  if (e) holds.delete(e.pointerId); else holds.clear();
  hold = [...holds.values()].pop() || null;
  if (!hold) canvas.classList.remove('steering');
};
canvas.addEventListener('pointerup', let_go);
canvas.addEventListener('pointercancel', let_go);
canvas.addEventListener('lostpointercapture', let_go);
canvas.addEventListener('contextmenu', e => e.preventDefault());
// Safari zooms the page on a pinch whatever the viewport says
for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, e => e.preventDefault());
// WASD by the letter or by where the keys are (so ZQSD on a French keyboard), and the arrows
const STEER_KEYS = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1],
  KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] };
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
  const way = STEER_KEYS[e.key.toLowerCase()] || STEER_KEYS[e.code], digging = playing && !$('panel').classList.contains('open');
  if (way && digging) { keys.set(e.code || e.key, way); sound.unlock(); e.preventDefault(); }
  // 1–5 buy the Resonator's upgrades, while it's showing
  const u = /^[1-9]$/.test(e.key) && !e.repeat && digging && !$('tray').hidden ? UPGRADES[+e.key - 1] : null;
  if (u) { buy(u.id); const c = $('cards').querySelector(`[data-id="${u.id}"]`); c?.classList.add('pressed'); setTimeout(() => c?.classList.remove('pressed'), 140); }
  // Enter or Space on the title digs (or carries on)
  if ((e.key === 'Enter' || e.key === ' ') && !playing && !$('title').hidden && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); ($('continueBtn').hidden ? $('startBtn') : $('continueBtn')).click(); }
  if (e.key === 'Escape') togglePanel();
  if (e.key === 'm' || e.key === 'M') setSound(!ui.sound);
});
addEventListener('keyup', e => {
  keys.delete(e.code || e.key);
  if (e.key === 'Meta') keys.clear();                  // (a Mac sends no key-ups while ⌘ is down)
});
addEventListener('blur', () => { keys.clear(); let_go(); });
function steer() {
  if (player) return;
  const w = game.worm;
  if (hold) { game.steer = view.toWorld(hold.x, hold.y); return; }
  let dx = 0, dy = 0;
  for (const v of keys.values()) { dx += v[0]; dy += v[1]; }
  game.steer = dx || dy ? { x: w.x + dx * 60, y: w.y + dy * 60 } : null;
}

// How to steer, in the words for this device: a phone or tablet, or a mouse and keys.
if (TOUCH) {
  canvas.setAttribute('aria-label', 'The dig. Tap and hold where the worm should go.');
  $('howto').textContent = 'Tap and hold where the worm should go. About half an hour to the core.';
  $('howSteer').textContent = 'Tap and hold where you want the worm to go: it swims toward your finger through the ground, leaving a trail of shaken earth.';
}

/* ---------- the loop ---------- */
let last = performance.now(), saveAt = 0, hudAt = 0, allBuilt = false;
function frame(now) {
  const dt = Math.min(.05, Math.max(0, (now - last) / 1000)) * timeScale;
  last = now;
  if (playing && !$('panel').classList.contains('open') && $('end').hidden) {
    if (player) player(game);
    else steer();
    let rest = dt;
    while (rest > 1e-5) { const d = Math.min(1 / 60, rest); game.step(d); rest -= d; }
    events();
    juice(dt);
    if (now > saveAt) { save(); saveAt = now + 10000; }
  }
  view.target = playing && (hold || keys.size) && game.steer ? game.steer : null;
  view.draw(game, dt);
  sound.update(game, dt, playing);
  coachStep(dt);
  if (now > hudAt) { hud(); hudAt = now + 90; }
  animateMoney(dt);
  if (!allBuilt) allBuilt = game.buildSome(playing ? 3 : 6);
  requestAnimationFrame(frame);
}
addEventListener('resize', () => { view.resize(); drawGauge(true); layoutTray(); });
// Down the side of the world when there's room beside it, otherwise along the bottom (with the hints lifted above).
function layoutTray() {
  const tray = $('tray'), margin = (innerWidth - W * view.S / view.dpr) / 2;
  const side = margin >= 200;
  tray.classList.toggle('side', side);
  const width = Math.min(250, margin - 22);
  tray.style.setProperty('--side', width + 'px');
  tray.style.left = side ? Math.max(8, (margin - width) / 2) + 'px' : '';
  $('bottom').style.bottom = !side && !tray.hidden ? `calc(${tray.offsetHeight + 16}px + env(safe-area-inset-bottom))` : '';
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); keys.clear(); let_go(); } last = performance.now(); });
addEventListener('pagehide', save);

/* ---------- what happened ---------- */
const SIZE_WORD = ['', 'small', 'medium-sized', 'large', 'huge'];
const toastAt = {};
function once(key, gap) { const t = performance.now(); if (toastAt[key] && t - toastAt[key] < gap) return false; toastAt[key] = t; return true; }
function events() {
  const w = game.worm;
  for (const e of game.events) {
    switch (e.type) {
      case 'eat': {
        const I = ITEMS[e.kind];
        valuePopup(e, I.value);
        burst(e.x, e.y, SPRITES[e.kind], 10);
        sound.eat(e.combo, I.st);
        if (e.first) toast(`<canvas class="ico" data-kind="${e.kind}"></canvas><span>New find: <b>${esc(I.name)}</b><small>${esc(I.blurb)}</small></span>`, 'find', 4200);
        done('eat');
        break;
      }
      case 'set':
        if (e.bonus) {
          // just above the formation's popup
          const f = view.floats.find(f => f.sid === e.sid), at = f ? { x: f.x, y: f.y - f.rise - 7 } : { x: e.x, y: e.y - 8 };
          view.float(at.x, at.y, shapeWord(e.shape) + ' +$' + e.bonus.toLocaleString('en-US'), '#ffe070', 2, true);
          // a toast only the first time each shape's done in this world (after that, just the bonus over it)
          const shapes = game.stats.shapes ||= {};
          if (!shapes[e.shape]) { shapes[e.shape] = 1; toast(`<span><b>${shapeWord(e.shape, true)} complete!</b><small>Every one of them: a quarter more for the lot, +${money(e.bonus)}.</small></span>`, 'good', 3000); }
        }
        sound.set();
        for (let k = 0; k < 24; k++) view.spawn('glint', e.x, e.y, { vx: Math.cos(k / 24 * 6.28) * 60, vy: Math.sin(k / 24 * 6.28) * 60, life: .7, drag: 3, col: px('#ffe890') });
        break;
      case 'ore':
        sound.ore(e.m);
        if (Math.random() < .5) view.spawn('glint', w.x + (Math.random() - .5) * 6, w.y + (Math.random() - .5) * 6, { vy: -20, life: .4, col: px(MATS[e.m] ? oreColour(e.m) : '#ffffff') });
        break;
      case 'full':
        view.float(e.x, e.y, 'FULL!', '#ffb040', 1.4);
        sound.full();
        bump('bellyChip');
        if (once('full', 12000)) hint('full');
        break;
      case 'toobig':
        view.float(e.x, e.y, 'TOO BIG', '#ff9a7a', 1.3);
        if (once('toobig' + e.kind, 20000)) toast(`<canvas class="ico" data-kind="${e.kind}"></canvas><span>Too big to swallow<small>The ${esc(ITEMS[e.kind].name.toLowerCase())} needs Maw ${ROMAN[e.need]}.</small></span>`, 'bad', 3000);
        break;
      case 'hard': {
        for (let k = 0; k < 8; k++) view.spawn('spark', e.x, e.y, { vx: (Math.random() - .5) * 120, vy: (Math.random() - .5) * 120 - 20, g: 200, life: .35, col: px('#fff0a0') });
        sound.hard();
        if (e.need < 90) {
          view.float(e.x, e.y, 'TOO HARD', '#ff9a7a', 1.1);
          if (once('hard' + e.m, 15000)) toast(`<span>${esc(MATS[e.m].name)} is too hard to shake<small>It needs Vibration ${ROMAN[e.need]}. Buy it at the Resonator in the camp.</small></span>`, 'bad', 3200);
        } else if (e.m !== 20 && once('alloy', 20000)) toast(`<span>${esc(MATS[e.m].name)}<small>Nothing can shake it. Find a way around.</small></span>`, 'bad', 3000);
        hint('hard');
        break;
      }
      case 'breach':
        sound.breach(e.v);
        if (e.v > 90) view.shake(1.5, .2);
        if (w.y > GROUND + 40 && !MATS[e.into]?.liquid) hint('cave');
        break;
      case 'plunge': sound.plunge(e.v); dust(e.x, e.y, 8); break;
      case 'splash':
        sound.splash(e.v);
        for (let k = 0; k < 10; k++) view.spawn('drop', e.x, e.y, { vx: (Math.random() - .5) * 70, vy: -30 - Math.random() * 60, g: 300, life: .6, col: px(e.m === 2 ? '#ff8a2a' : '#8ac0ff') });
        hint(e.m === 2 ? 'lava' : 'water');
        break;
      case 'land': sound.land(e.v); dust(e.x, e.y + 3, 14); view.shake(Math.min(3, e.v / 120), .25); break;
      case 'lunge': sound.lunge(); break;
      case 'thud': sound.thud(e.v); break;
      case 'camp': view.cheer(); sound.camp(); break;
      case 'sell': {
        const n = e.list.reduce((a, b) => a + (b.kind ? b.n : 0), 0), ore = e.list.filter(b => b.ore !== undefined);
        const px0 = CAMP.post, py0 = game.plan.surf[CAMP.post] - 14;
        for (let k = 0; k < Math.min(30, 6 + e.total / 50); k++) view.spawn('coin', w.x + (Math.random() - .5) * 6, w.y - 4, { vx: (px0 - w.x) * (.8 + Math.random() * .6) + (Math.random() - .5) * 30, vy: -120 - Math.random() * 60 + (py0 - w.y) * .9, g: 260, life: 1.1 + Math.random() * .3, col: px(Math.random() < .5 ? '#ffd24a' : '#fff4a0') });
        view.float(CAMP.post, py0 - 6, '+' + money(e.total), '#ffe070', 2.4, true);
        sound.sell(e.total);
        const parts = [];
        if (n) parts.push(`${n} ${n === 1 ? 'find' : 'finds'}`);
        for (const o of ore) parts.push(`${o.n} ${MATS[o.ore].name.toLowerCase()}`);
        toast(`<canvas class="ico" data-kind="coin"></canvas><span>Sold for <b>${money(e.total)}</b><small>${esc(parts.join(', '))}</small></span>`, 'good', 3200);
        delta('moneyChip', '+' + money(e.total));
        done('full');
        if (!ui.tut.sell) setTimeout(() => hint('sell'), 1200);
        save();
        break;
      }
      case 'upgrade': {
        const u = UPGRADE_BY_ID[e.id];
        view.hum = 1;
        sound.upgrade(e.level);
        view.float(CAMP.resonator, game.plan.surf[CAMP.resonator] - 36, `${u.name.toUpperCase()} ${ROMAN[e.level]}`, '#d8c4ff', 2, true);
        const card = $('cards').querySelector(`[data-id="${e.id}"]`);
        if (card) { card.classList.remove('bought'); void card.offsetWidth; card.classList.add('bought'); }
        if (e.id === 'vib') toast(`<span><b>Vibration ${ROMAN[e.level]}</b><small>You can shake through ${esc(STRATA[e.level].name)} now, down to ${metres(e.level < STRATA.length - 1 ? STRATA[e.level + 1].top : CORE_DEPTH)}.</small></span>`, 'good', 3600);
        done('sell');
        drawGauge(true);
        save();
        break;
      }
      case 'hurt':
        if (e.n > 1 || e.cause !== 'lava') { const f = $('flash'); f.classList.add('on'); clearTimeout(f.tm); f.tm = setTimeout(() => f.classList.remove('on'), 120); }
        sound.hurt(e.cause);
        if (e.cause === 'lava' && once('lavaToast', 15000)) toast(`<span>Lava burns!<small>Get out fast. More Hide and it burns less.</small></span>`, 'bad', 2800);
        break;
      case 'faint':
        sound.faint();
        view.cam.ready = false;
        toast(e.voluntary ? `<span>Home again<small>${e.cache ? 'Your haul is waiting where you left it: look for the glowing sack on the gauge.' : 'Nothing was in your belly.'}</small></span>`
          : `<span><b>You fainted!</b><small>${e.cache ? 'Your haul is waiting where you dropped it: the glowing sack, marked on the gauge.' : 'You wake at the camp.'}</small></span>`, 'bad', 4500);
        drawGauge(true);
        break;
      case 'cache': sound.set(); toast(`<span>${e.all ? 'Got your haul back!' : 'Got some of your haul back'}<small>${e.all ? '' : 'Your belly filled up: the rest is still there.'}</small></span>`, 'good', 2600); drawGauge(true); break;
      case 'blast':
        sound.blast(e.r);
        view.shake(Math.min(7, e.r / 2.4), .6);
        for (let k = 0; k < 40; k++) { const a = Math.random() * 6.28, v = 40 + Math.random() * 120; view.spawn('fire', e.x, e.y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, drag: 2.5, life: .5 + Math.random() * .5, col: px(Math.random() < .5 ? '#ffd060' : '#ff6a1a'), light: .5, lc: [1, .5, .15] }); }
        if (once('gas', 20000)) toast(`<span><b>Firedamp!</b><small>Pockets of gas explode when you shake into them, or when lava gets to them.</small></span>`, 'bad', 3200);
        break;
      case 'vault':
        sound.vault();
        view.shake(3, .5);
        toast(`<span><b>A vault opens</b><small>Every keystone found: something of the Old Ones' is inside.</small></span>`, 'good', 4000);
        for (let k = 0; k < 40; k++) view.spawn('glint', e.x + (Math.random() - .5) * 20, e.y - 10, { vx: (Math.random() - .5) * 40, vy: -Math.random() * 60, life: 1.2, drag: 1.5, col: px('#80ffe8') });
        break;
      case 'layer':
        sound.layer(e.k);
        toast(`<span>${esc(STRATA[e.k].name)}<small>${esc(STRATA[e.k].blurb)}</small></span>`, '', 5200);
        break;
      case 'creak': sound.creak(); for (let k = 0; k < 4; k++) view.spawn('dust', e.x + (Math.random() - .5) * 6, e.y - 4, { vy: 20 + Math.random() * 20, g: 80, life: .6, col: px('#8a8272') }); break;
      case 'shatter': {
        sound.shatter(e.kind);
        const sp = e.kind === 'spike';
        for (let k = 0; k < 16; k++) view.spawn(sp ? 'glint' : 'dust', e.x, e.y + 3, { vx: (Math.random() - .5) * 110, vy: -30 - Math.random() * 70, g: 300, life: .6 + Math.random() * .3, col: px(sp ? (k % 2 ? '#b890ff' : '#f0e4ff') : (k % 2 ? '#d8cdb0' : '#9a8e70')) });
        view.shake(1.5, .2);
        if (once('fall' + e.kind, 30000) && Math.hypot(e.x - w.x, e.y - w.y) < 40) toast(`<span>${e.kind === 'spike' ? 'Crystal spikes' : 'Stalactites'} fall<small>Your shaking works them loose. Keep moving under them.</small></span>`, 'bad', 3000);
        break;
      }
      case 'zap':
        sound.zap();
        view.shake(1, .15);
        if (once('zap', 20000)) toast(`<span>A barrier of the Old Ones<small>It burns and throws you back while it's lit. Wait for it to drop.</small></span>`, 'bad', 3200);
        break;
      case 'win': win(); break;
    }
  }
  game.events.length = 0;
}
// What a find was worth, floating up from it. A find from a formation adds to that formation's popup, which sits
// over the middle of the whole formation; any other find adds to a popup still showing near it. Either way the
// popup pops again with the total so far, and lasts from then. Otherwise the find gets a popup of its own.
const NEAR = 22;
let setSpots = new Map();                              // formation → where its popup sits (over the middle of it)
function setSpot(sid) {
  let at = setSpots.get(sid);
  if (!at) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity;
    for (const o of game.objs) if (o.set === sid) { x0 = Math.min(x0, o.x); x1 = Math.max(x1, o.x); y0 = Math.min(y0, o.y - o.r); }
    setSpots.set(sid, at = { x: (x0 + x1) / 2, y: y0 });
  }
  return at;
}
function valuePopup(e, value) {
  const live = view.floats.filter(f => f.worth !== undefined && f.t < f.life - .05);
  let f = null;
  if (e.sid >= 0) f = live.find(g => g.sid === e.sid) || null;
  else { let best = NEAR; for (const g of live) { const d = Math.hypot(g.x - e.x, g.y - g.rise - e.y); if (d < best) { best = d; f = g; } } }
  const words = g => '+$' + g.worth.toLocaleString('en-US') + (g.prog ? ` ${g.prog[0]}/${g.prog[1]}` : '');
  if (f) {
    f.worth += value;
    if (e.sid >= 0) f.prog = e.set;
    view.repop(f, words(f), valueColour(f.worth));
    return;
  }
  const at = e.sid >= 0 ? setSpot(e.sid) : e;
  f = view.float(at.x, at.y, '', valueColour(value));
  Object.assign(f, { worth: value, sid: e.sid, prog: e.sid >= 0 ? e.set : null });
  f.text = words(f).toUpperCase();
}
function valueColour(v) { return v >= 10000 ? '#ff9aff' : v >= 1000 ? '#8ae8ff' : v >= 200 ? '#ffe070' : v >= 40 ? '#d8f0a0' : '#f4ecdc'; }
function oreColour(m) { return ({ 21: '#aaaaaa', 22: '#ff9a50', 23: '#e8f0ff', 24: '#ffe060', 25: '#d8f4ff', 26: '#ff7a30', 27: '#60ffd8', 28: '#ff90ff' })[m] || '#ffffff'; }
function shapeWord(s, cap) { const w = ({ ring: 'ring', arc: 'arc', spiral: 'spiral', wave: 'wave', zigzag: 'zigzag', eight: 'figure eight', heart: 'heart', star: 'star', loops: 'loops', line: 'line', scurve: 's-curve', double: 'double arc' })[s] || 'set'; return cap ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase(); }
function burst(x, y, sp, n) {
  const cols = [];
  if (sp) for (let k = 0; k < sp.data.length; k += 3) if (sp.data[k] >>> 24) cols.push(sp.data[k]);
  for (let k = 0; k < n; k++) { const a = Math.random() * 6.28, v = 20 + Math.random() * 50; view.spawn('glint', x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, drag: 3, life: .45 + Math.random() * .3, col: cols.length ? cols[k % cols.length] : px('#ffffff') }); }
}
function dust(x, y, n) {
  const m = game.cell(x, y + 4), R = MATS[m];
  for (let k = 0; k < n; k++) view.spawn('dust', x + (Math.random() - .5) * 8, y, { vx: (Math.random() - .5) * 60, vy: -10 - Math.random() * 30, g: 60, drag: 2, life: .6 + Math.random() * .4, col: px(R?.solid ? '#8a6a4a' : '#9a8a7a') });
}

// The little things: rings rolling out from the head as it shakes the ground, crumbs flying off it, bubbles in
// water, and embers rising off lava wherever it's in view.
let ringT = 0, dustT = 0;
function juice(dt) {
  const w = game.worm, mv = w.speed > 20;
  if (w.mode === 'dig' && mv && (ringT -= dt) <= 0) { ringT = .5 - Math.min(.25, w.speed / 800); view.ring(w.x, w.y, game.headR(), game.headR() + 7 + game.up.vib * 2.5, .5); }
  if (w.mode === 'dig' && mv && (dustT -= dt) <= 0) {
    dustT = .05;
    const a = w.a + Math.PI + (Math.random() - .5) * 1.4, r = game.headR();
    view.spawn('dust', w.x + Math.cos(w.a) * r * .6, w.y + Math.sin(w.a) * r * .6, { vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, drag: 4, life: .35, col: px(Math.random() < .5 ? '#6a5040' : '#4a3628') });
  }
  if ((w.mode === 'water' || w.mode === 'lava') && Math.random() < dt * 10) view.spawn('bubble', w.x + (Math.random() - .5) * 6, w.y, { vy: -18 - Math.random() * 14, vx: (Math.random() - .5) * 8, life: 1, col: px(w.mode === 'lava' ? '#ffd080' : '#b8dcff') });
  // embers off lava in view
  const cy = view.cy, bh = view.bh;
  for (let k = 0; k < 24; k++) {
    const x = Math.floor(Math.random() * W), y = Math.floor(cy + Math.random() * bh);
    if (y < 1 || y >= game.mat.length / W) continue;
    if (game.mat[y * W + x] === 2 && game.mat[(y - 1) * W + x] === 0 && Math.random() < .12) view.spawn('ember', x + .5, y - .5, { vy: -12 - Math.random() * 20, vx: (Math.random() - .5) * 10, life: 1 + Math.random(), col: px(Math.random() < .5 ? '#ffb040' : '#ff6a1a'), light: .25, lc: [1, .45, .12] });
  }
}

/* ---------- toasts, bumps and hints ---------- */
function toast(html, cls = '', ms = 3000) {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast panelish ' + cls;
  el.innerHTML = html;
  for (const c of el.querySelectorAll('canvas[data-kind]')) paintIcon(c, SPRITES[c.dataset.kind], 3);
  box.prepend(el);
  while (box.children.length > (innerHeight < 520 ? 2 : 3)) box.lastChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, ms);
}
function bump(id) { const el = $(id); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function delta(id, text) { const el = $(id), d = document.createElement('span'); d.className = 'delta'; d.textContent = text; el.append(d); setTimeout(() => d.remove(), 1700); }
function paintIcon(c, sp, scale = 3) {
  if (!sp) return;
  c.width = sp.w; c.height = sp.h;
  c.style.width = sp.w * scale + 'px'; c.style.height = sp.h * scale + 'px';
  const g = c.getContext('2d'), img = g.createImageData(sp.w, sp.h);
  new Uint32Array(img.data.buffer).set(sp.data);
  g.putImageData(img, 0, 0);
}
paintIcon($('coinIco'), SPRITES.coin, 3);

// Hints, one at a time, each shown until it's done (or for a while) and then never again.
const HINTS = {
  steer: () => TOUCH ? 'Tap and hold where you want the worm to go.' : 'Hold the mouse button where you want the worm to go, or steer with WASD or the arrow keys.',
  eat: () => 'Swallow what glitters: gems, coins, odd old things, veins of ore.',
  full: () => 'Your belly’s full. Swim back up to the camp to sell it all.',
  sell: () => 'Spend it at the Resonator. Vibration lets you shake through harder rock, and so go deeper.',
  hard: () => 'Cross-hatched rock is too hard to shake yet. More Vibration gets you through.',
  cave: () => 'You broke into a cave. Steer into a wall or the floor to dig back in, or at the ceiling to leap.',
  water: () => 'Water’s slow going. Dig out through the bed or the banks.',
  lava: () => 'Lava! It burns. Get out through the rock, fast.',
};
let hintKey = null, hintT = 0;
function hint(key) {
  if (DEMO || ui.tut[key] || hintKey === key) return;
  if (hintKey && hintT < 3) return;                 // let the one showing be read first
  hintKey = key; hintT = 0;
  const el = $('hint');
  el.innerHTML = `<span class="tag">Tip</span>${esc(HINTS[key]())}`;
  el.classList.remove('off');
  if (key !== 'steer' && key !== 'eat') ui.tut[key] = true;
}
function done(key) {
  ui.tut[key] = true;
  if (hintKey === key) { hintKey = null; $('hint').classList.add('off'); }
}
let steerHeld = 0;
function coachStep(dt) {
  hintT += dt;
  if (hintKey && hintKey !== 'steer' && hintKey !== 'eat' && hintT > 9) { hintKey = null; $('hint').classList.add('off'); }
  if (!playing || DEMO) { coach(null); return; }
  if (!ui.tut.steer) {
    if (!hintKey) hint('steer');
    if (hold || keys.size) steerHeld += dt;
    if (steerHeld > 1.6) { done('steer'); coach(null); if (!ui.tut.eat) setTimeout(() => hint('eat'), 600); }
    else coach(game.worm);
  } else coach(null);
  if (hintKey === 'eat' && hintT > 10) done('eat');
}
// The walkthrough's hand, pressing and holding a little below and to the side of the worm.
let coachT = 0;
function coach(w) {
  const el = $('coachHand');
  if (!w || hold) { el.style.opacity = 0; coachT = 0; return; }
  coachT += 1 / 60;
  const p = view.toScreen(w.x + 26, w.y + 34), k = coachT % 2.2, press = k > .5 && k < 1.8;
  el.style.opacity = k < .25 ? k / .25 : k > 1.95 ? Math.max(0, 1 - (k - 1.95) / .25) : 1;
  el.style.transform = `translate(${p.x - 22}px, ${p.y - 3}px) scale(${press ? .86 : 1})`;
}

/* ---------- the numbers along the top ---------- */
let shownMoney = 0;
function animateMoney(dt) {
  if (!game) return;
  if (Math.abs(shownMoney - game.money) < 1) shownMoney = game.money;
  else shownMoney += (game.money - shownMoney) * Math.min(1, dt * 6);
  $('money').textContent = money(shownMoney);
}
function hud() {
  if (!game) return;
  const cap = game.cap(), b = game.belly, full = b >= cap - .04;
  $('bellyBar').style.width = Math.min(100, b / cap * 100) + '%';
  $('bellyTxt').textContent = `${Math.floor(b + 1e-6)}/${cap}`;
  $('bellyTxt').style.minWidth = cap < 10 ? '1.75em' : '2.8em';     // (as wide as it can get at this size of belly)
  $('bellyChip').classList.toggle('full', full && playing);
  $('hpBar').style.width = Math.max(0, game.hp / game.hpMax() * 100) + '%';
  $('hideChip').classList.toggle('low', game.hp < game.hpMax() * .3);
  $('depth').textContent = metres(game.depth());
  const w = game.worm, xi = Math.max(0, Math.min(W - 1, Math.floor(w.x)));
  const k = w.y > game.plan.surf[xi] ? layerAt(game.plan, xi, Math.floor(w.y)) : -1;
  $('sub').textContent = playing ? (game.atCamp ? 'At the camp' : k >= 0 ? STRATA[k].name : 'In the open air') + ' · ' + seedText : 'Dig to the heart of the world';
  const tray = $('tray'), show = playing && game.atCamp && $('end').hidden;
  if (tray.hidden === show) { tray.hidden = !show; layoutTray(); }
  if (show) updateCards();
  drawGauge();
}

/* ---------- the depth gauge ---------- */
const gauge = $('gauge');
let gaugeKey = '';
function drawGauge(force) {
  if (!game) return;
  const dpr = Math.min(3, devicePixelRatio || 1), h = Math.round(gauge.clientHeight * dpr) || 200, wv = Math.round(gauge.clientWidth * dpr) || 16;
  const w = game.worm, D = CORE_DEPTH + 30, yOf = d => Math.round(Math.max(0, Math.min(1, d / D)) * (h - 1));
  const key = [h, wv, Math.round(yOf(game.depth())), Math.round(yOf(game.stats.deepest)), game.up.vib, game.objs.length, game.won].join();
  if (!force && key === gaugeKey) return;
  gaugeKey = key;
  if (gauge.width !== wv || gauge.height !== h) { gauge.width = wv; gauge.height = h; }
  const g = gauge.getContext('2d');
  g.imageSmoothingEnabled = false;
  const COLS = ['#5c3d26', '#8a3b22', '#a69c83', '#7f6162', '#433556', '#272731', '#2c4749', '#773420'];
  for (let k = 0; k < STRATA.length; k++) {
    const y0 = yOf(STRATA[k].top), y1 = k < STRATA.length - 1 ? yOf(STRATA[k + 1].top) : h;
    g.fillStyle = COLS[k]; g.fillRect(0, y0, wv, y1 - y0);
  }
  g.fillStyle = '#ffd058'; g.beginPath(); g.arc(wv / 2, h + wv * .3, wv * .9, 0, Math.PI * 2); g.fill();
  // too deep for now: darkened below the rock you can't shake
  const lim = game.up.vib < STRATA.length - 1 ? STRATA[game.up.vib + 1].top : null;
  if (lim !== null) {
    const y = yOf(lim);
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, y, wv, h - y);
    g.fillStyle = '#ff7a64'; g.fillRect(0, y, wv, Math.max(1, dpr));
  }
  // the deepest yet
  g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, yOf(game.stats.deepest), wv, Math.max(1, dpr));
  // a lost haul
  for (const o of game.objs) if (o.kind === 'cache' && !o.gone) { g.fillStyle = '#ffb040'; g.fillRect(0, yOf(o.y - GROUND) - dpr, wv, 3 * dpr); }
  // you
  const y = yOf(game.depth());
  g.fillStyle = '#fff'; g.fillRect(0, y - dpr * 2, wv, dpr * 4);
  g.fillStyle = '#e8a080'; g.fillRect(dpr * 2, y - dpr, wv - dpr * 4, dpr * 2);
  gauge.title = `${metres(game.depth())} down, of ${metres(CORE_DEPTH)} to the core.` + (lim !== null ? ` With Vibration ${ROMAN[game.up.vib]} you can dig down to about ${metres(lim)}.` : '');
}

/* ---------- the Resonator's upgrades ---------- */
const ICONS = {
  vib: sprite(['..ooooo..', '.o.....o.', 'o..ooo..o', 'o.o...o.o', 'o.o.v.o.o', 'o.o...o.o', 'o..ooo..o', '.o.....o.', '..ooooo..'], { o: '#b89aff', v: '#ffffff' }),
  belly: sprite(['...tt....', '...ot....', '..obbo...', '.obllbo..', 'oblllbbo.', 'obllbbdo.', 'obbbbddo.', '.obbddo..', '..oooo...'], { o: '#2a1a0a', b: '#b8844a', l: '#e0b070', d: '#7a5028', t: '#ffd24a' }),
  muscle: sprite(['....oo...', '...oyo...', '..oyyo...', '.oyyyoooo', 'oyyyyyyyo', 'ooooyyyo.', '...oyyo..', '...oyo...', '...oo....'], { o: '#3a1a04', y: '#ffb040' }),
  maw: sprite(['..ooooo..', '.otototo.', 'ot.....to', 'o.......o', 'ot..r..to', 'o.......o', 'ot.....to', '.otototo.', '..ooooo..'], { o: '#8a2230', t: '#f4ead4', r: '#ff6a6a' }),
  hide: sprite(['.ooooooo.', 'oslslslso', 'olslslslo', 'oslslslso', 'olslslslo', '.oslslso.', '..olslo..', '...oso...', '....o....'], { o: '#1a1418', s: '#8a7a6a', l: '#c0b0a0' }),
};
function nextText(u, l) {
  const v = u.values;
  if (l >= u.costs.length) return 'All done';
  switch (u.id) {
    case 'vib': return `Dig through ${STRATA[l + 1].name}`;
    case 'belly': return `Hold ${v[l + 1]} (now ${v[l]})`;
    case 'muscle': return `${Math.round(v[l + 1] * 100)}% speed (now ${Math.round(v[l] * 100)}%)`;
    case 'maw': return l + 1 <= 3 ? `Swallow ${SIZE_WORD[l + 2]} finds` : 'Reach further';
    case 'hide': return `${v[l + 1]} health, burns less`;
  }
  return '';
}
function buildCards() {
  const box = $('cards');
  box.textContent = '';
  box.classList.toggle('keyed', !TOUCH);
  for (const u of UPGRADES) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'card'; b.dataset.id = u.id;
    const ic = document.createElement('canvas'); ic.className = 'ico'; paintIcon(ic, ICONS[u.id], 3);
    b.innerHTML = `<span class="nm">${esc(u.name)}</span><span class="pips">${u.costs.map(() => '<i></i>').join('')}</span><span class="next"></span><span class="cost"></span>`;
    b.prepend(ic);
    if (!TOUCH) b.insertAdjacentHTML('beforeend', `<kbd class="hot" aria-hidden="true">${UPGRADES.indexOf(u) + 1}</kbd>`);   // (its key)
    b.title = u.blurb;
    b.onclick = () => buy(u.id);
    b.onpointerenter = () => { $('trayNote').textContent = u.blurb; };
    b.onpointerleave = () => { $('trayNote').textContent = 'Spend what you sold. Leave camp to dig again.'; };
    box.append(b);
  }
  updateCards();
}
function updateCards() {
  if (!game) return;
  for (const b of $('cards').children) {
    const u = UPGRADE_BY_ID[b.dataset.id], l = game.up[u.id], cost = game.cost(u.id);
    b.querySelectorAll('.pips i').forEach((p, k) => p.classList.toggle('on', k < l));
    b.querySelector('.next').textContent = nextText(u, l);
    b.querySelector('.cost').textContent = cost === null ? '—' : money(cost);
    b.classList.toggle('maxed', cost === null);
    b.classList.toggle('can', cost !== null && game.money >= cost);
    b.classList.toggle('poor', cost !== null && game.money < cost);
    b.classList.toggle('key', u.id === 'vib' && cost !== null);
    b.disabled = cost === null;
    b.setAttribute('aria-label', `${u.name}, level ${l} of ${u.costs.length}. ${nextText(u, l)}. ${cost === null ? '' : 'Costs ' + money(cost) + '.'}`);
  }
}
function buy(id) {
  sound.unlock();
  const r = game.buy(id);
  if (!r.ok) {
    if (r.why === 'money') { sound.no(); const c = $('cards').querySelector(`[data-id="${id}"]`); c?.animate?.([{ transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }], { duration: 200 }); }
    return;
  }
  events();
  updateCards();
}

/* ---------- the menu ---------- */
function togglePanel(open) {
  const p = $('panel'), o = open ?? !p.classList.contains('open');
  p.classList.toggle('open', o);
  $('menuBtn').setAttribute('aria-expanded', o);
  if (o) refreshMenu();
  else if (p.contains(document.activeElement)) canvas.focus({ preventScroll: true });
}
$('menuBtn').onclick = () => { sound.unlock(); togglePanel(); };
$('closePanel').onclick = () => togglePanel(false);
function refreshMenu() {
  if (!game) return;
  const s = game.stats, kinds = ITEM_LIST.length, found = ITEM_LIST.filter(i => game.found[i.id]).length;
  $('stats').innerHTML = [
    ['Seed', esc(seedText)], ['Time digging', clock(game.t)], ['Deepest', metres(s.deepest)], ['Trips to camp', s.trips],
    ['Finds swallowed', s.eaten.toLocaleString('en-US')], ['Shapes completed', s.sets], ['Earned', money(game.earned)], ['Fainted', s.faints],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('findCount').textContent = `${found} of ${kinds}`;
  const box = $('finds');
  box.textContent = '';
  for (const I of ITEM_LIST) {
    const d = document.createElement('div'), n = game.found[I.id] || 0;
    d.className = n ? '' : 'none';
    d.title = n ? `${I.name}: ${I.blurb} ($${I.value.toLocaleString('en-US')})` : `Something from ${STRATA[I.st].name}`;
    const c = document.createElement('canvas'); c.className = 'ico'; paintIcon(c, SPRITES[I.id], I.size >= 3 ? 1.5 : 3);
    d.append(c);
    if (n > 1) { const sm = document.createElement('small'); sm.textContent = n; d.append(sm); }
    box.append(d);
  }
  if (!$('seedInput').value) $('seedInput').value = randomSeedText();
  $('soundSw').setAttribute('aria-checked', ui.sound);
  $('homeBtn').disabled = !playing || game.atCamp;
}
$('homeBtn').onclick = () => {
  if (!playing || game.atCamp) return;
  const b = $('homeBtn');
  if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = game.belly > 0 ? 'Sure? Your haul stays here' : 'Sure?'; setTimeout(() => { b.dataset.sure = ''; b.textContent = 'Wriggle home'; }, 3000); return; }
  b.dataset.sure = ''; b.textContent = 'Wriggle home';
  game.wriggleHome(); events(); togglePanel(false);
};
$('diceBtn').onclick = () => { $('seedInput').value = randomSeedText(); };
$('seedInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('newBtn').click(); });
$('newBtn').onclick = () => {
  const b = $('newBtn');
  if (playing && !ended && game.t > 30 && b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? This dig will be lost'; setTimeout(() => { b.dataset.sure = ''; b.textContent = 'Dig this world'; }, 3500); return; }
  b.dataset.sure = ''; b.textContent = 'Dig this world';
  startNew($('seedInput').value);
  togglePanel(false);
};
function setSound(on) { ui.sound = on; sound.setEnabled(on); $('soundSw').setAttribute('aria-checked', on); save(); }
$('soundSw').onclick = () => setSound(!ui.sound);
$('tutBtn').onclick = () => { ui.tut = {}; steerHeld = 0; hintKey = null; togglePanel(false); };

/* ---------- the start and the end ---------- */
function startNew(text) {
  newGame(text);
  playing = true; ended = false;
  $('end').hidden = true;
  view.follow(game, 0, true);
  save();
}
function begin() {
  const t = $('title');
  t.classList.add('out');
  setTimeout(() => { t.hidden = true; t.classList.remove('out'); }, 600);
  playing = true;
  canvas.focus({ preventScroll: true });
}
function win() {
  ended = true;
  sound.win();
  view.shake(5, 1.2);
  const f = $('fade');
  f.classList.add('on');
  save();
  setTimeout(() => {
    f.classList.remove('on');
    const s = game.stats, found = ITEM_LIST.filter(i => game.found[i.id]).length;
    $('endStats').innerHTML = [
      ['Time', clock(game.wonAt ?? game.t)], ['Earned', money(game.earned)], ['Trips to camp', s.trips], ['Finds swallowed', s.eaten.toLocaleString('en-US')],
      ['Kinds of find', `${found} of ${ITEM_LIST.length}`], ['Shapes completed', s.sets], ['Vaults opened', s.vaults], ['Fainted', s.faints], ['Seed', esc(seedText)],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('end').hidden = false;
  }, 2000);
}
$('againBtn').onclick = () => { $('end').hidden = true; startNew(randomSeedText()); };
$('keepBtn').onclick = () => { $('end').hidden = true; };

// The title: a new world to dig (from ?seed=, or two random words), or the one you were digging.
const saved = DEMO ? null : loadSave();
if (saved?.ui) ui = { ...ui, ...saved.ui, tut: { ...(saved.ui.tut || {}) } };
sound.setEnabled(ui.sound);
const urlSeed = Q.get('seed');
if (DEMO) {
  newGame(Q.get('seed') || 'amber-hollow-42');
  setupDemo();
  playing = true;
  $('title').hidden = true;
} else {
  // a saved dig can always be carried on; a ?seed= link fills in the seed for a new one
  let resumed = false;
  if (saved?.game) {
    try { newGame(saved.seedText, saved.game); resumed = true; } catch (e) { console.warn('Could not load the saved dig:', e); }
  }
  if (!resumed) newGame(urlSeed || randomSeedText());
  $('titleSeed').value = urlSeed || (resumed ? randomSeedText() : seedText);
  $('continueBtn').hidden = !resumed;
  if (resumed) { $('startBtn').textContent = 'New world'; $('continueBtn').classList.add('gold'); $('startBtn').classList.remove('gold'); }
  $('startBtn').onclick = () => {
    sound.unlock();
    const text = $('titleSeed').value.trim() || randomSeedText();
    if (resumed || text !== seedText) newGame(text);
    begin();
    save();
  };
  $('continueBtn').onclick = () => { sound.unlock(); begin(); };
  $('titleDice').onclick = () => { $('titleSeed').value = randomSeedText(); };
  $('titleSeed').addEventListener('keydown', e => { if (e.key === 'Enter') $('startBtn').click(); });
}
view.follow(game, 0, true);

// ?demo: a dig that's well under way, for the preview: after half a minute of digging, the worm leaps out of the ground
// beside the trading post, and time all but stops at the top of the leap. ?demo&at=metres drops it that deep instead
// (with Vibration to match) and lets the stand-in player carry on.
function setupDemo() {
  ui.tut = Object.fromEntries(Object.keys(HINTS).map(k => [k, true]));
  const at = +Q.get('at');
  if (at) {
    const k = STRATA.findLastIndex(s => s.top <= at);
    Object.assign(game.up, { vib: Math.max(k, 3), belly: 3, muscle: 3, maw: 2, hide: 3 });
    game.money = 12840; game.hp = game.hpMax();
    const w = game.worm;
    w.x = W / 2 - 30; w.y = GROUND + at;
    game.ensureBands(Math.floor(w.y / 64) - 3, Math.floor(w.y / 64) + 4);
    game.resetPath(w.x, w.y, -.3, -1);
    player = makePlayer('good', rng(7));
    for (let s = 0; s < 60 * 20; s++) { player(game); game.step(1 / 60); }
    game.events.length = 0; game.fx.length = 0;
    return;
  }
  Object.assign(game.up, { vib: 2, belly: 2, muscle: 2, maw: 1, hide: 1 });
  game.hp = game.hpMax();
  const bot = makePlayer('good', rng(3));
  for (let s = 0; s < 60 * 30; s++) { bot(game); game.step(1 / 60); }
  game.events.length = 0; game.fx.length = 0; game.parts.length = 0;
  Object.assign(game, { hold: {}, ore: {}, belly: 0, holdValue: 0, money: 2360 });
  game.hp = game.hpMax();
  // line up a leap: rising fast from under the ground, left of the trading post
  const w = game.worm, x0 = 58, y0 = game.plan.surf[x0] + 30;
  w.x = x0; w.y = y0; w.a = -1.2; w.vx = Math.cos(w.a) * 120; w.vy = Math.sin(w.a) * 120; w.mode = 'dig';
  game.resetPath(w.x, w.y, -.45, 1);
  for (let k = 0; k < 160; k++) game.shake(w.x - .45 * k * .5, w.y + k * .5, true);
  for (const o of game.objs) if (Math.abs(o.x - x0 - 8) < 22 && o.y > y0 - 70 && o.y < y0 + 12) o.gone = true;   // (a clear way up)
  const t0 = game.t;
  let apex = false;
  player = g => {
    const t = g.t - t0, ww = g.worm;
    if (t < 1.5) g.steer = { x: ww.x + 18, y: ww.y - 60 };
    else g.steer = null;
    if (!apex && ww.mode === 'air' && ww.vy > -25) { apex = true; timeScale = .025; setTimeout(() => { timeScale = 1; player = makePlayer('good', rng(5)); }, 9000); }
  };
}

// for poking at from the console
Object.defineProperty(window, 'burrow', { get: () => ({ game, view, sound }) });
requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); window.toyboxReady?.(); });
