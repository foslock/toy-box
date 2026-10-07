// Scales: the page. Input (drag or hover to slide the scale, release or click to tip it out, keys), the loop, the tags
// and cards, hints for a first game, saving the best score, and the ?demo, ?autoplay and ?debug modes.
import { Game, STEP, TUNE } from './game.js';
import { PRODUCE, TOP, an } from './produce.js';
import { View } from './render.js';
import { Sound } from './sound.js';
import { Bot } from './bot.js';
import { produceSprites } from './paint.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug'), AUTO = Q.has('autoplay');
const SPEED = +Q.get('speed') || 1;
const KEY = 'scales.v1';
const TOUCH = matchMedia('(pointer: coarse)').matches || Q.has('touch');
document.body.classList.toggle('touch', TOUCH);
document.body.classList.toggle('demo', DEMO);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = n => Math.round(n).toLocaleString('en-US');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* ------------------------------------------------------------------------------------------------- state */
const store = { best: 0, sound: true, hints: {}, plays: 0, biggest: 0 };
try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* a bad save starts fresh */ }
const persist = !DEMO && !AUTO;
function save() { if (!persist) return; try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage full or off */ } }

let g = new Game(+Q.get('seed') || (Date.now() & 0xffffff));
const view = new View($('c'));
const snd = new Sound(); snd.on = store.sound !== false;
const botOpts = () => ({ skill: 1, sloppy: 2, think: DEMO ? 0.5 : 0.9, look: 8, edge: 6, ...(Q.has('botseed') ? { rand: rngFrom(+Q.get('botseed')) } : {}) });
let bot = DEMO || AUTO ? new Bot(botOpts()) : null;
let mode = DEMO || AUTO ? 'play' : 'title';      // title | play | paused | over
let hold = Q.has('hold');                         // ?debug&hold: the loop draws but doesn't step; step with scales.ff()
let slow = 1, overAt = 0;
window.scales = { get g() { return g; }, view, snd, store, ff, TUNE };

/* ------------------------------------------------------------------------------------------------- layout */
function layout() {
  view.resize(innerWidth, innerHeight, devicePixelRatio || 1);
  const top = view.awn + 10;
  $('tagS').style.top = $('tagN').style.top = `${top}px`;
  $('btns').style.top = `${Math.max(6, (view.awn - 40) / 2 - 2)}px`;
  $('btns').style.right = `max(12px, env(safe-area-inset-right))`;
  drawNext();
}
addEventListener('resize', layout); visualViewport?.addEventListener('resize', layout);
layout();
// the woodtype face is baked into the sprites (the rosette, the plank's stencil), so paint again once it has loaded
document.fonts?.load('40px Ultra').then(() => document.fonts.ready).then(layout).catch(() => {});

/* ------------------------------------------------------------------------------------------------- input */
const cv = $('c');
let ptr = null, queued = 0;
const playing = () => mode === 'play' && g.state === 'play' && !bot;
function worldX(e) { return view.toWorld(e.clientX, e.clientY); }
cv.addEventListener('pointerdown', e => {
  snd.init();
  if (!playing()) return;
  const [x, y] = worldX(e);
  // a tap on the crow sends it off
  const C = g.crow;
  if ((C.st === 'perch' || C.st === 'in') && Math.hypot(x - C.x, y - (C.y - 21)) < (TOUCH ? 46 : 34)) { g.shoo(); return; }
  try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ }
  ptr = { id: e.pointerId, type: e.pointerType };
  g.aim(x);
  e.preventDefault();
});
cv.addEventListener('pointermove', e => {
  if (!playing()) return;
  if (ptr && e.pointerId === ptr.id) g.aim(worldX(e)[0]);
  else if (!ptr && e.pointerType === 'mouse') g.aim(worldX(e)[0]);
});
function release(e) {
  if (!ptr || e.pointerId !== ptr.id) return;
  ptr = null;
  if (!playing()) return;
  if (!g.drop()) queued = 0.35;   // a tap just before the pan is loaded still counts
}
cv.addEventListener('pointerup', release);
cv.addEventListener('pointercancel', () => { ptr = null; });
cv.addEventListener('contextmenu', e => e.preventDefault());

const held = {};
addEventListener('keydown', e => {
  snd.init();
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === 'm') { toggleSound(); return; }
  if (mode === 'title' || mode === 'over') { if (k === 'Enter' || k === ' ') { e.preventDefault(); start(); } return; }
  if (mode === 'paused') { if (k === 'Escape' || k === 'p' || k === 'Enter' || k === ' ') { e.preventDefault(); resume(); } return; }
  if (k === 'Escape' || k === 'p') { pause(); return; }
  if (bot) return;
  if (held[k]) { if (['ArrowLeft', 'ArrowRight', ' ', 'ArrowDown'].includes(k)) e.preventDefault(); return; }
  held[k] = true;
  if (k === 'ArrowLeft' || k === 'a') { e.preventDefault(); g.push(-1); }
  else if (k === 'ArrowRight' || k === 'd') { e.preventDefault(); g.push(1); }
  else if (k === ' ' || k === 'Enter' || k === 'ArrowDown' || k === 's') { e.preventDefault(); if (!g.drop()) queued = 0.35; }
});
addEventListener('keyup', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  held[k] = false;
  if ((k === 'ArrowLeft' || k === 'a') && g.pan.kv < 0) g.push(held.ArrowRight || held.d ? 1 : 0);
  if ((k === 'ArrowRight' || k === 'd') && g.pan.kv > 0) g.push(held.ArrowLeft || held.a ? -1 : 0);
});
addEventListener('blur', () => { for (const k in held) held[k] = false; g.push(0); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && !DEMO && !AUTO) pause(); });

$('bsound').addEventListener('click', () => { snd.init(); toggleSound(); });
$('bmenu').addEventListener('click', () => { snd.init(); mode === 'paused' ? resume() : pause(); });
function toggleSound() { store.sound = !snd.on; snd.setOn(store.sound); $('bsound').classList.toggle('off', !store.sound); save(); }
$('bsound').classList.toggle('off', store.sound === false);

/* ------------------------------------------------------------------------------------------------- the loop */
let last = performance.now(), acc = 0, firstFrame = true;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (mode === 'play' && !hold) {
    if (g.state === 'over') slow = Math.min(1, slow + dt * 0.6);
    acc += dt * SPEED * slow;
    let n = 0;
    while (acc >= STEP && n < 12 * SPEED) { step(); acc -= STEP; n++; }
    if (n >= 12 * SPEED) acc = 0;
  }
  view.frame(g, mode === 'paused' ? 0 : dt * slow, { guide: !bot || DEMO });
  snd.update(dt, { swing: g.world.plank.om, strain: Math.abs(g.world.plank.th) / g.world.plank.max, wind: g.wind.st === 'gust' ? g.wind.f : g.wind.st === 'warn' ? 0.15 : 0, saw: g.trim.st === 'warn' && mode === 'play' });
  if (g.state === 'over' && mode === 'play' && performance.now() - overAt > 1900 && !DEMO) showOver();
  if (DEMO && g.state === 'over' && performance.now() - overAt > 2500) newGame();
  requestAnimationFrame(frame);
  if (firstFrame) { firstFrame = false; window.toyboxReady?.(); }
}
function step() {
  if (bot) bot.tick(g);
  if (queued > 0) { queued -= STEP; if (g.drop()) queued = 0; }
  g.tick();
  for (const e of g.drain()) react(e);
}
// step the game by hand (debug), ms of game time
function ff(ms) { for (let i = 0; i < ms / 1000 / STEP; i++) step(); }

/* ------------------------------------------------------------------------------------------------- what happens */
let lastHit = 0;
function react(e) {
  switch (e.type) {
    case 'drop': snd.drop(); break;
    case 'ready': snd.ready(e.tier); drawNext(); break;
    case 'hit': {
      snd.knock(e.kind, e.v, e.tier);
      if (e.v > 380 && e.tier >= 3) view.shake = Math.max(view.shake, Math.min(6, e.v / 120) * (e.tier / 6));
      if (e.kind === 1 && e.v > 300) view.dust(e.x, e.y, 4);
      break;
    }
    case 'bump': snd.bump(e.v); view.shake = Math.max(view.shake, 5 + e.v * 4); view.dust(e.side * g.L / 2 * Math.cos(g.world.plank.max), 74, 12); if (!DEMO) hint('ground', null); break;
    case 'merge': {
      snd.merge(e.tier, e.chain);
      view.pop(e.tier, e.x, e.y);
      view.float(e.x, e.y - PRODUCE[e.tier].r - 8, `+${e.pts}`, 15 + e.tier * 1.6);
      if (e.chain > 1) view.float(e.x, e.y - PRODUCE[e.tier].r - 30, `chain ×${e.chain}`, 11, '#f8df92', 1.3);
      bumpScore();
      if (TOUCH) navigator.vibrate?.(e.tier >= 6 ? 18 : 8);
      if (e.first && e.tier >= 5 && !DEMO) toast(cap(an(PRODUCE[e.tier].name)) + '!', e.tier === TOP ? 'Prize-winning. Now make another.' : 'First one this market day.');
      if (!DEMO && store.merged !== true) { store.merged = true; hint('merge', null); }
      if (e.tier > store.biggest && persist) { store.biggest = e.tier; save(); }
      break;
    }
    case 'ribbon': snd.ribbon(); view.pop(TOP, e.x, e.y, 2); view.float(e.x, e.y - 90, `BLUE RIBBON +${e.pts}`, 22, '#9cc4f0', 2); toast('Blue ribbon!', 'Two prize pumpkins. The judges are speechless.'); bumpScore(); break;
    case 'gustWarn': snd.gust(); document.body.classList.add('windy'); if (!DEMO) { toast(e.dir > 0 ? 'Gust →' : '← Gust', 'Small things blow about.'); hint('gust', null); } break;
    case 'gust': break;
    case 'crowIn': snd.flap(); snd.caw(2); if (!DEMO) hint('crow', null); break;
    case 'crowLand': snd.flap(); break;
    case 'crowLeave': snd.flap(); break;
    case 'caw': snd.caw(e.n, e.loud); break;
    case 'peck': snd.peck(); break;
    case 'trimWarn': snd.warn(); if (!DEMO) { toast('Sawing!', 'The plank is getting shorter.'); hint('trim', null); } break;
    case 'trim': snd.trim(); view.shake = 4; view.dust(-e.L / 2, 60, 10); view.dust(e.L / 2, 60, 10); break;
    case 'clatter': snd.clatter(e.v); break;
    case 'heapWarn': snd.warn(); if (!DEMO) { toast('Too tall!', 'The heap is touching the scale.'); hint('heap', null); } break;
    case 'sold': snd.sold(); view.sell({ x: e.x, y: e.y, tier: e.tier, r: PRODUCE[e.tier].r, rT: PRODUCE[e.tier].r, a: e.a, sq: 0, born: 0, age: 1 }); view.float(e.x, e.y - 30, `sold +${e.pts}`, 12, '#f8df92'); bumpScore(); break;
    case 'fell': {
      snd.fell();
      if (!e.heap) { snd.knock(2, 500, e.tier); view.shake = 8; view.pop(e.tier, e.body.x, 70, 1); }
      overAt = performance.now(); slow = 0.3;
      document.body.classList.remove('windy');
      break;
    }
  }
  if (e.type === 'gust' || e.type === 'gustWarn') return;
  if (g.wind.st === 'calm') document.body.classList.remove('windy');
}

/* ------------------------------------------------------------------------------------------------- the tags */
let shown = -1;
function bumpScore() {
  const s = $('score');
  s.textContent = fmt(g.score);
  s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump');
}
function syncTags() {
  if (shown !== g.score) { $('score').textContent = fmt(g.score); shown = g.score; }
  $('best').textContent = fmt(store.best);
  document.querySelector('#tagS .best').style.visibility = store.best > 0 ? '' : 'hidden';
}
setInterval(syncTags, 250);
function drawNext() {
  const c = $('nextc'), x = c.getContext('2d'), tier = g.pan.next;
  const dpr = Math.min(2.5, devicePixelRatio || 1), size = Math.round(48 * dpr);
  if (c.width !== size) { c.width = c.height = size; }
  x.clearRect(0, 0, size, size);
  if (tier == null || tier < 0) return;
  const R = size * 0.2 + tier * size * 0.05, sp = produceSprites(PRODUCE[tier].key, R, dpr);
  x.drawImage(sp.body, size / 2 - sp.o, size / 2 - sp.o + R * 0.12); x.drawImage(sp.shade, size / 2 - sp.o, size / 2 - sp.o + R * 0.12);
}

/* ------------------------------------------------------------------------------------------------- hints, toasts */
const HINTS = {
  aim: () => TOUCH ? 'Drag to slide the scale along. Let go to tip it out.' : 'Move the mouse to slide the scale, click to tip it out. Or <kbd>←</kbd> <kbd>→</kbd> and <kbd>Space</kbd>.',
  merge: () => 'Two the same make the next size up. Bigger is heavier.',
  lean: () => 'It\'s leaning. Watch the needle on the bale, and drop on the high side to level it.',
  ground: () => 'An end is on the ground. Round things roll that way.',
  gust: () => 'A gust! Small things roll in the wind. Wait it out or wedge them in.',
  crow: () => TOUCH ? 'A crow weighs as much as a turnip. Tap it to shoo it off, or let it be.' : 'A crow weighs as much as a turnip. Click it to shoo it off, or let it be.',
  trim: () => 'The stallholder is sawing the ends off. Anything past the pencil marks gets sold.',
  heap: () => 'If the heap stays up against the scale for three seconds, the market closes. Merge it down.',
};
let hintT = 0;
function hint(id, text, force) {
  if (DEMO || AUTO) return;
  if (!force && store.hints[id]) return;
  store.hints[id] = true; save();
  const el = $('hint'); el.innerHTML = text || HINTS[id]?.() || ''; el.classList.add('on');
  clearTimeout(hintT); hintT = setTimeout(() => el.classList.remove('on'), id === 'aim' ? 7000 : 5200);
}
function toast(big, small) {
  const el = $('toast'); el.innerHTML = `${esc(big)}${small ? `<small>${esc(small)}</small>` : ''}`;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}
// a nudge when the plank first leans hard
setInterval(() => { if (mode === 'play' && g.state === 'play' && Math.abs(g.world.plank.th) > g.world.plank.max * 0.45) hint('lean', null); }, 500);

/* ------------------------------------------------------------------------------------------------- cards */
function ladderHTML(upTo = TOP) {
  return `<div class="ladder" aria-label="crab apple, damson, golden apple, turnip, acorn squash, savoy cabbage, crown prince, turk's turban, pumpkin, prize pumpkin">${PRODUCE.map((p, i) => `<canvas data-tier="${i}" style="opacity:${i <= upTo ? 1 : 0.28}"></canvas>`).join('')}</div>`;
}
function paintLadder(root) {
  const dpr = Math.min(2.5, devicePixelRatio || 1), box = root.querySelector('.ladder');
  if (!box) return;
  // radii grow along the row; the whole row fits the card
  const room = Math.min(box.parentElement.clientWidth - 8, 430), rel = PRODUCE.map((_, t) => 0.42 + t * 0.07), base = room / (2.25 * rel.reduce((a, b) => a + b, 0));
  box.querySelectorAll('canvas').forEach(c => {
    const t = +c.dataset.tier, R = base * rel[t], sp = produceSprites(PRODUCE[t].key, R * dpr, dpr), wd = R * 2.25, ht = R * 2.7;
    c.width = Math.round(wd * dpr); c.height = Math.round(ht * dpr); c.style.width = `${wd}px`; c.style.height = `${ht}px`;
    const x = c.getContext('2d'), ox = wd * dpr / 2 - sp.o, oy = ht * dpr - R * 1.08 * dpr - sp.o;
    x.drawImage(sp.body, ox, oy); x.drawImage(sp.shade, ox, oy);
    c.title = PRODUCE[t].name;
  });
}
function card(html) { $('cbox').innerHTML = html; $('card').hidden = false; paintLadder($('cbox')); $('hint').classList.remove('on'); $('toast').classList.remove('on'); }
function closeCard() { $('card').hidden = true; }

function showTitle() {
  mode = 'title';
  card(`<p class="eyebrow">Harvest market · produce tent</p>
    <div class="tt">Scales</div>
    <p class="lede">Every piece of produce lands on one long plank, balanced on a hay bale.</p>
    ${ladderHTML()}
    <ul class="how">
      <li><span class="touchonly">Drag to slide the scale along, and let go to tip it out.</span><span class="keys">Move the mouse to slide the scale and click to tip it out, or <kbd>←</kbd> <kbd>→</kbd> and <kbd>Space</kbd>.</span></li>
      <li>Two the same make the next size up, from crab apple to prize pumpkin.</li>
      <li>Bigger is heavier, and further out tips it more. If anything touches the ground, the market's over.</li>
    </ul>
    <div class="row"><button class="btn go" id="cgo">Open the stall</button></div>
    ${store.best ? `<p class="small">Best so far: <b>${fmt(store.best)}</b></p>` : ''}`);
  $('cgo').onclick = () => { snd.init(); snd.click(); start(); };
}
function start() {
  snd.init();
  if (mode === 'over' || g.state === 'over' || g.drops > 0) newGame();
  closeCard(); mode = 'play'; slow = 1; acc = 0;
  snd.setMusic(true);
  setTimeout(() => hint('aim', null), 600);
}
function newGame() {
  g = new Game(Date.now() & 0xffffff);
  if (bot) bot = new Bot(botOpts());
  view.parts.length = 0; view.texts.length = 0; view.sold.length = 0;
  shown = -1; slow = 1; drawNext(); syncTags();
  if (DEMO) prewarm();
  if (mode === 'play') snd.setMusic(true);
}
function pause() {
  if (mode !== 'play') return;
  mode = 'paused'; snd.setMusic(false);
  card(`<div class="tt sm">Paused</div>
    ${ladderHTML(g.maxTier)}
    <p class="small" style="margin-top:4px">Biggest so far: ${esc(PRODUCE[g.maxTier].name)}</p>
    <ul class="how">
      <li><span class="touchonly">Drag to slide the scale, let go to tip it out. Tap the crow to shoo it.</span><span class="keys">Move the mouse to slide the scale, click to tip it out, or <kbd>←</kbd> <kbd>→</kbd> and <kbd>Space</kbd>. Click the crow to shoo it.</span></li>
      <li>The needle on the bale leans the way things will roll. Keep heaps in the middle; the ends are for small things.</li>
      <li>Wait out gusts. A heap left touching the scale for three seconds closes the market.</li>
    </ul>
    <div class="row"><button class="btn go" id="cres">Carry on</button><button class="btn" id="crst">Start over</button></div>
    <p class="small keys"><kbd>Esc</kbd> carries on · <kbd>M</kbd> sound</p>`);
  $('cres').onclick = () => { snd.click(); resume(); };
  $('crst').onclick = () => { snd.click(); g.state = 'over'; mode = 'over'; start(); };
}
function resume() { closeCard(); mode = 'play'; last = performance.now(); snd.setMusic(true); }
const CAUSE = {
  wind: (n, side) => `A gust took ${n} off the ${side} end.`,
  crow: (n, side) => `The crow tipped ${n} off the ${side} end.`,
  trim: (n, side) => `${cap(n)} went off the freshly sawn ${side} end.`,
  balance: (n, side) => `${cap(n)} rolled off the ${side} end.`,
  heap: () => 'The heap grew right up to the scale.',
};
const TIPS = {
  balance: [
    'Keep the heaps near the middle. The ends are for small things.',
    'A crab apple at the very end turns the plank as much as a turnip a quarter of the way out.',
    'Small things roll; squash sit tight. A squash makes a good doorstop.',
    'Watch the needle on the bale: it leans the way things will roll.',
    'Merging makes things lighter: two damsons weigh more than one golden apple.',
    'Something that lands on a shoulder rolls off it. Aim for the tops, or the gaps.',
  ],
  wind: ['A gust pushes small things hardest. Hold off until it passes, or keep them wedged between squash.'],
  crow: ['The crow weighs about as much as a turnip. Shooing it takes that weight away all at once, so be ready.'],
  trim: ['When the saw comes out, anything past the pencil marks is sold, and that weight goes too. Even things up first.'],
  heap: ['A heap is only as tall as what you haven\'t merged. Drop twins onto twins.'],
};
let tipN = 0;
function showOver() {
  mode = 'over';
  const o = g.over, n = 'the ' + PRODUCE[o.tier].name, side = o.side < 0 ? 'left' : 'right';
  const isBest = g.score > store.best;
  if (persist) { store.plays++; if (isBest) store.best = g.score; save(); }
  card(`<p class="eyebrow">Market's closed</p>
    <div class="big">${fmt(g.score)}</div>
    ${isBest && g.score > 0 ? '<div class="newbest">Best yet</div>' : `<p class="small" style="margin:0 0 8px">Best: ${fmt(store.best)}</p>`}
    <p class="lede">${esc(CAUSE[o.cause](n, side))}</p>
    ${ladderHTML(g.maxTier)}
    <div class="stats"><span>biggest <b>${esc(PRODUCE[g.maxTier].name)}</b></span><span><b>${g.drops}</b> dropped</span><span><b>${g.merges}</b> merged</span><span><b>${clock(g.t)}</b></span></div>
    <p class="small" style="font-style:italic">${esc((TIPS[o.cause] || TIPS.balance)[o.cause === 'balance' ? tipN++ % TIPS.balance.length : 0])}</p>
    <div class="row"><button class="btn go" id="cagain">Again</button></div>
    <p class="small keys"><kbd>Space</kbd> to go again</p>`);
  $('cagain').onclick = () => { snd.click(); start(); };
  syncTags();
}

/* ------------------------------------------------------------------------------------------------- demo */
// fill the plank before the first frame, so the preview shows a market in full swing, then call the crow in
function prewarm() {
  const b = new Bot({ skill: 1, sloppy: 1, think: 0.3, look: 6, edge: 6, rand: rngFrom(g.seed) });
  for (let i = 0; i < 60 * 90 && g.state === 'play' && (g.drops < 26 || g.wind.st !== 'calm'); i++) { b.tick(g); g.tick(); g.drain(); }
  if (g.state !== 'play') { g = new Game((g.seed * 7 + 13) & 0xffffff); return prewarm(); }
  g.summonCrow();
  shown = -1; syncTags(); drawNext();
}
function rngFrom(seed) { let s = seed || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
window.scales.step = step;

/* ------------------------------------------------------------------------------------------------- go */
if (DEMO) { g = new Game(+Q.get('seed') || 20261006); prewarm(); }
syncTags();
if (mode === 'title') showTitle();
else if (AUTO) { mode = 'play'; }
requestAnimationFrame(frame);
