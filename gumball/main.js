import { Game, L, RENTS, PERIOD } from './game.js';
import { KINDS, RARITY_NAME } from './symbols.js';
import { View } from './render.js';
import { Sound } from './sound.js';
import { paintBall, clearSprites } from './icons.js';
import { botPick, estimate } from './bot.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug');
let HOLD = Q.has('hold');

// ---------- saved bits
const KEY = 'gumball.v1';
const store = { best: { rents: 0, earned: 0 }, tut: false, sound: true };
try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
const save = () => { if (DEMO) return; try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {} };

const view = new View($('c'));
const sound = new Sound();
sound.setOn(store.sound);

let game = null;
let mode = 'title';          // title | play | collecting | pick | rent | toss | over
let tut = null;
let timers = [];
const out = new Set();       // uids that are out of the globe (flying or in the tray)
let score = null;            // live score of the tray
let payBalls = null, payScore = null;
let shown = 0;               // money shown in the till (ticks up during payouts)
let offers = [];
let paused = false;

const after = (sec, fn) => timers.push({ t: sec, fn });

// ---------- layout: the HTML sits on the canvas's scaled column
function layout() {
  view.resize();
  const r = document.documentElement.style;
  r.setProperty('--colL', view.ox + 'px');
  r.setProperty('--colW', L.W * view.s + 'px');
  r.setProperty('--s', view.s);
  r.setProperty('--barY', view.oy + 708 * view.s + 'px');
  r.setProperty('--coachY', Math.max(62, view.oy + 64 * view.s) + 'px');
  r.setProperty('--bannerY', view.oy + 520 * view.s + 'px');
  // the bar's buttons scale a little with the column
  $('bar').style.fontSize = '';
}
addEventListener('resize', layout);

function ballCanvas(kind, css = 54, roll = 0) {
  const cv = document.createElement('canvas');
  const d = Math.min(3, (devicePixelRatio || 1) * 1.2);
  cv.width = cv.height = Math.round(css * d);
  const c = cv.getContext('2d');
  c.translate(cv.width / 2, cv.height / 2);
  paintBall(c, kind, cv.width / 2 - 2, roll);
  return cv;
}

// ---------- HUD
function hud() {
  if (!game) return;
  $('money').textContent = Math.round(shown);
  const left = game.cranksLeft;
  $('rent').textContent = 'Rent ¢' + game.rent;
  const dueNow = game.phase === 'idle' || game.phase === 'drop' || game.phase === 'settle';
  const which = game.endless ? 'extra' : `${Math.min(game.rentIdx + 1, RENTS.length)}/${RENTS.length}`;
  $('due').textContent = which + ' · ' + (left === 1 && dueNow ? 'due after this turn!' : `in ${left} turns`);
  $('slip').classList.toggle('hot', left === 1 && dueNow);
  $('count').textContent = game.items.length;
}

let barSig = '';
function bar() {
  const show = game && (mode === 'play' || mode === 'collecting') && !paused;
  $('bar').hidden = !show;
  if (!show) return;
  const ph = game.phase;
  const rolling = ph === 'drop' || ph === 'settle';
  const sig = [mode, ph, game.nudgeCost, game.money >= game.nudgeCost, game.canCollect, score && score.total].join('|');
  if (sig === barSig) return;
  barSig = sig;
  $('bl').hidden = $('br').hidden = !rolling;
  for (const id of ['bl', 'br']) { $(id).querySelector('.c').textContent = '¢' + game.nudgeCost; $(id).disabled = game.money < game.nudgeCost || mode !== 'play'; }
  const go = $('bgo');
  if (ph === 'idle' && mode === 'play') { go.innerHTML = 'Turn the crank'; go.disabled = false; }
  else if (rolling) { go.innerHTML = `Collect <small>¢${score ? score.total : 0}</small>`; go.disabled = !game.canCollect || mode !== 'play'; }
  else { go.innerHTML = 'Counting…'; go.disabled = true; }
}

// ---------- coach
function coach(head, html, { button = null, skip = true } = {}) {
  $('ck').textContent = head;
  $('ct').innerHTML = html;
  $('cskip').hidden = !skip;
  $('cgo').hidden = !button;
  if (button) { $('cgo').textContent = button.label; $('cgo').onclick = () => { sound.play('tap'); button.fn(); }; }
  $('coach').classList.remove('off');
}
const hideCoach = () => $('coach').classList.add('off');
function glow(ids) { for (const id of ['bgo', 'bl', 'br']) $(id).classList.toggle('glow', ids.includes(id)); }

let bannerT = 0;
function banner(text, sec = 1.4) { $('bt').textContent = text; $('banner').classList.remove('off'); bannerT = sec; }

// ---------- a new run
function start(withTut) {
  game = new Game((Q.get('seed') | 0) || (Date.now() & 0xffffff));
  bgGame = null;
  out.clear(); timers = []; payBalls = null; score = null;
  shown = game.money;
  view.globe.balls.length = 0; view.gmap.clear(); view.flyers = []; view.parts = []; view.floats = [];
  view.syncGlobe(game.items);
  for (let i = 0; i < 90; i++) view.globe.step(1 / 60);
  mode = 'play';
  document.body.classList.remove('menu');
  for (const id of ['title', 'over', 'pick', 'rentv', 'toss', 'jar', 'menu']) $(id).hidden = true;
  tut = withTut ? { step: '' } : null;
  if (tut) tutStep('crank'); else { hideCoach(); glow([]); }
  barSig = ''; hud(); bar();
}

function toTitle() {
  mode = 'title'; game = null; tut = null; hideCoach(); glow([]);
  document.body.classList.add('menu');
  for (const id of ['over', 'pick', 'rentv', 'toss', 'jar', 'menu']) $(id).hidden = true;
  $('title').hidden = false;
  $('bar').hidden = true;
  const b = store.best;
  $('best').textContent = b.rents || b.earned ? `Best: ${b.rents >= RENTS.length ? 'all eight rents paid' : b.rents + ' rent' + (b.rents === 1 ? '' : 's') + ' paid'}, ¢${b.earned} taken in one run.` : '';
  idleTray();
}

// a calm tray behind the title card
function idleTray() {
  const g = new Game(3, { start: ['cherry', 'bee', 'flower', 'cat', 'fish', 'gold', 'magnet', 'coin', 'clover', 'dice', 'jawbreaker', 'milk', 'rainbow', 'diamond'] });
  view.globe.balls.length = 0; view.gmap.clear();
  view.syncGlobe(g.items);
  g.startCrank(g.items.slice(0, 9));
  g.spawnT = 0.6;
  game = null;
  bgGame = g;
}
let bgGame = null;

// ---------- the crank
function crank() {
  if (!game || mode !== 'play' || game.phase !== 'idle' || paused) return;
  if (tut && tut.step !== 'crank') return;
  sound.init();
  sound.play('ratchet');
  view.turnCrank(); view.jostle(0.8);
  let forced = null;
  if (tut && tut.step === 'crank') {
    const want = ['cherry', 'cherry', 'bee', 'flower', 'coin'], pool = game.items.slice();
    forced = want.map((k) => pool.splice(pool.findIndex((it) => it.kind === k), 1)[0]);
  }
  const picks = game.startCrank(forced);
  game.spawnT = 0.5;
  picks.forEach((it, i) => {
    const p = view.globePos(it.uid);
    out.add(it.uid);
    view.fly(it.kind, [p, { x: 200, y: L.globe.y + L.globe.r - 10 }, { x: 200, y: L.body.bot }, { x: 200, y: L.tray.lid }], 0.36, 0.12 + i * 0.17);
  });
  view.syncGlobe(game.items, out);
  hideInfo();
  if (tut) tutStep('land');
}

function nudge(dir) {
  if (!game || mode !== 'play' || paused) return;
  if (tut && !['nudge', 'collect'].includes(tut.step)) return;
  sound.init();
  if (game.nudge(dir)) {
    shown = game.money;
    if (tut && tut.step === 'nudge') tutStep('collect');
  }
}

// ---------- collecting: count each gumball, send them home
function collect() {
  if (!game || mode !== 'play' || !game.canCollect || paused) return;
  if (tut && tut.step !== 'collect') return;
  if (tut) { hideCoach(); glow([]); tut.step = 'counting'; }
  hideInfo();
  mode = 'collecting';
  const res = game.collect();
  payBalls = res.balls; payScore = res;
  const order = payBalls.map((b, i) => i).sort((a, b) => payBalls[a].x - payBalls[b].x);
  let k = 0, boomed = false, munched = false;
  order.forEach((i) => {
    const b = payBalls[i], v = res.vals[i], f = res.fate[i];
    after(0.12 + k * 0.11, () => {
      if (f === 'boom') { view.burst(b.x, b.y, KINDS[b.kind].color, 22, 380); view.burst(b.x, b.y, '#ffb627', 10, 300); if (!boomed) sound.play('boom'); boomed = true; b.hidden = true; }
      else if (f === 'eaten') { view.burst(b.x, b.y, KINDS[b.kind].color, 10, 160); if (!munched) sound.play('munch'); munched = true; b.hidden = true; view.float(b.x, b.y - 10, 'gulp', '#ff8a1f'); }
      if (v > 0) { view.float(b.x, b.y - 14, '+' + v, f === 'boom' ? '#ff6b5b' : '#ffe14d'); sound.play('coin', k); }
      shown += v; $('till').classList.remove('bump'); void $('till').offsetWidth; $('till').classList.add('bump');
    });
    k++;
  });
  const tEnd = 0.12 + k * 0.11 + 0.15;
  after(tEnd, () => {
    shown = game.money;
    if (res.total > 0) { sound.play('total'); banner('+¢' + res.total, 1.1); }
    else banner('Nothing!', 1.1);
  });
  // home they go
  after(tEnd + 0.55, () => {
    let j = 0;
    payBalls.forEach((b, i) => {
      if (res.fate[i]) { out.delete(b.item.uid); return; }
      const d = j * 0.05;
      after(d, () => { b.hidden = true; });
      view.fly(b.item.kind, [{ x: b.x, y: b.y }, { x: 200, y: L.tray.lid + 10 }, { x: 200, y: L.body.bot }, { x: 200, y: L.body.top }, { x: 200, y: L.globe.y - L.globe.r + 30 }], 0.42, d, () => {
        out.delete(b.item.uid); view.syncGlobe(game.items, out);
      }, b.r, 12.5);
      j++;
    });
    after(0.45 + j * 0.05 + 0.1, () => {
      payBalls = null; payScore = null;
      if (res.grew.length) {
        sound.play('grow');
        const names = [...new Set(res.grew.map((it) => KINDS[it.kind].name))];
        banner(names.join(' & ') + (res.grew.length > 1 ? ' grew!' : ' grew!'), 1.4);
      }
      after(res.grew.length ? 0.6 : 0.05, openPick);
    });
  });
}

// ---------- picking a new gumball
function openPick() {
  mode = 'pick';
  offers = tut ? ['bee', 'cherry', 'cat'] : game.offers();
  renderPicks();
  $('pkick').textContent = `Turn ${game.crank} · into the machine`;
  const tip = $('ptip');
  if (tut) {
    tip.hidden = false;
    tip.innerHTML = 'Each turn, one new gumball joins the machine. Your Bee pays +¢2 for every flower or fruit it touches, so another <b>Bee</b> or <b>Cherry</b> fits. Skipping keeps your best gumballs coming out more often.';
  } else tip.hidden = true;
  $('pick').hidden = false;
}

function renderPicks() {
  const box = $('picks');
  box.innerHTML = '';
  offers.forEach((k, i) => {
    const K = KINDS[k];
    const have = game.items.filter((it) => it.kind === k).length;
    const b = document.createElement('button');
    b.className = 'pk';
    b.appendChild(ballCanvas(k, 54));
    b.insertAdjacentHTML('beforeend', `<span class="nm">${K.name}</span><span class="rr r${K.rarity}">${RARITY_NAME[K.rarity]}</span><span class="tx">${K.text}</span><span class="hv">${have ? 'You have ' + have : 'New!'}</span>`);
    b.onclick = () => choose(k);
    box.appendChild(b);
  });
  $('breroll').textContent = 'Reroll ¢' + game.rerollCost;
  $('breroll').disabled = game.money < game.rerollCost || !!tut;
  $('bskip').disabled = !!tut;
}

function choose(k) {
  if (mode !== 'pick') return;
  sound.init();
  sound.play(k ? 'pick' : 'tap');
  game.take(k);
  view.syncGlobe(game.items, out);
  view.jostle(0.3);
  $('pick').hidden = true;
  if (game.rentDue) after(0.25, openRent); else toIdle();
}

function reroll() {
  if (mode !== 'pick' || tut) return;
  const o = game.reroll();
  if (!o) return;
  shown = game.money;
  sound.play('tap');
  offers = o; renderPicks();
}

function toIdle() {
  game.next();
  mode = 'play';
  barSig = '';
  if (tut && tut.step === 'counting') tutStep('rent');
}

// ---------- rent day
function openRent() {
  mode = 'rent';
  sound.play('knock');
  const r = game.rent, m = game.money;
  const n = game.rentIdx + 1;
  $('rstamp').classList.remove('on', 'green');
  $('rstamp').textContent = 'PAID';
  $('ramt').textContent = '¢' + r;
  if (m >= r) {
    $('rtxt').textContent = game.endless ? `Mr. Grubb again. He's raised it. He always raises it.` : (n === RENTS.length ? `The last one, says Mr. Grubb. Pay this and the lease is yours.` : `Mr. Grubb is at the door with his little pink book. Rent ${n} of ${RENTS.length}.`);
    const next = n < RENTS.length ? `Next rent: ¢${RENTS[n]} in ${PERIOD} turns.` : '';
    $('rsub').textContent = `You have ¢${m}; that leaves ¢${m - r}. ${n < RENTS.length || game.endless ? 'One more gumball will drop every turn from now on. ' + next : ''}`;
    $('rgo').textContent = 'Pay ¢' + r;
    $('rgo').onclick = () => {
      if (mode !== 'rent') return;
      game.payRent(); shown = game.money; hud();
      sound.play('pay');
      $('rstamp').classList.add('on');
      $('rgo').disabled = true;
      mode = 'rent-paid';
      after(1.0, () => {
        $('rentv').hidden = true; $('rgo').disabled = false;
        if (game.rentIdx === RENTS.length && !game.wonShown) { game.wonShown = true; showEnd(true); }
        else openToss();
      });
    };
  } else {
    $('rtxt').textContent = `Mr. Grubb is at the door with his little pink book, and you're short.`;
    $('rsub').textContent = `You have ¢${m}. That's ¢${r - m} short.`;
    $('rgo').textContent = 'Hand over the keys';
    $('rgo').onclick = () => { if (mode !== 'rent') return; $('rentv').hidden = true; showEnd(false); };
  }
  $('rentv').hidden = false;
}

// ---------- tossing one out
let tossSel = null;
function openToss() {
  if (game.items.length <= 4) { toIdle(); return; }
  mode = 'toss';
  tossSel = null;
  const grid = $('tgrid');
  grid.innerHTML = '';
  const items = game.items.slice().sort((a, b) => a.kind.localeCompare(b.kind));
  for (const it of items) {
    const b = document.createElement('button');
    b.setAttribute('aria-label', KINDS[it.kind].name);
    b.appendChild(ballCanvas(it.kind, 40));
    b.onclick = () => { tossSel = it.uid; for (const x of grid.children) x.classList.toggle('sel', x === b); $('tgo').disabled = false; $('tgo').textContent = 'Toss the ' + KINDS[it.kind].name; sound.play('tap'); };
    grid.appendChild(b);
  }
  $('tgo').disabled = true; $('tgo').textContent = 'Toss it';
  $('toss').hidden = false;
}
function doToss(yes) {
  if (mode !== 'toss') return;
  if (yes && tossSel != null) {
    const p = view.globePos(tossSel);
    const it = game.items.find((x) => x.uid === tossSel);
    if (it) view.burst(p.x, p.y, KINDS[it.kind].color, 12, 200);
    game.toss(tossSel);
    view.syncGlobe(game.items, out);
    sound.play('toss');
  }
  $('toss').hidden = true;
  toIdle();
}

// ---------- the end
function showEnd(won) {
  mode = 'over';
  hideCoach();
  const b = store.best;
  if (game.rentIdx > b.rents || (game.rentIdx === b.rents && game.earned > b.earned)) store.best = { rents: game.rentIdx, earned: game.earned };
  if (game.earned > store.best.earned) store.best.earned = game.earned;
  save();
  const st = $('ostamp');
  st.classList.remove('on', 'green');
  if (won) {
    sound.play('win');
    $('otitle').textContent = 'LEASE RENEWED';
    st.textContent = 'PAID UP'; st.classList.add('green');
    $('otxt').textContent = `Eight rents, all on time. Mr. Grubb shakes your sticky hand and, grumbling, renews the lease. The machine is yours to keep cranking.`;
    $('omore').hidden = false;
  } else {
    sound.play('evict');
    $('otitle').textContent = 'EVICTION NOTICE';
    st.textContent = 'EVICTED';
    $('otxt').textContent = game.endless ? `You beat the lease and kept going, but the rent kept going faster.` : `Mr. Grubb takes the keys, the machine and, somehow, the counter. Rent ${game.rentIdx + 1} of ${RENTS.length} was ¢${game.rent}.`;
    $('omore').hidden = true;
  }
  $('ostats').innerHTML = `Rents paid: ${game.rentIdx}${game.rentIdx < RENTS.length ? ' of ' + RENTS.length : ''}<br>Turns: ${game.crank} · Taken in: ¢${game.earned}<br>Gumballs in the machine: ${game.items.length}`;
  $('over').hidden = false;
  after(0.35, () => st.classList.add('on'));
}

// ---------- info card for a gumball in the tray
let infoT = 0;
function showInfo(b, idx) {
  const K = KINDS[b.kind];
  const box = $('info');
  const cv = box.querySelector('canvas');
  const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 80, 80); c.translate(40, 40); paintBall(c, b.kind, 37, b.kind === 'dice' ? b.roll : 0);
  box.querySelector('b').textContent = K.name;
  let why = '';
  let val = '';
  const s = payScore || score;
  if (s && idx >= 0) {
    const notes = s.notes[idx] || [];
    why = notes.join(' · ');
    if (s.fate[idx] === 'boom') why = (why ? why + ' · ' : '') + 'will be blown up';
    if (s.fate[idx] === 'eaten') why = 'about to be eaten';
    val = '¢' + s.vals[idx];
  }
  if (K.grows && b.item) why = (why ? why + ' · ' : '') + `${b.item.age} of ${K.grows[1]} turns grown`;
  box.querySelector('.tx').textContent = K.text;
  box.querySelector('.why').textContent = why;
  box.querySelector('.v').textContent = val;
  box.hidden = false;
  view.highlight = b.id;
  infoT = 4;
}
function hideInfo() { $('info').hidden = true; view.highlight = null; infoT = 0; }

// ---------- tutorial
function tutStep(step) {
  if (!tut) return;
  tut.step = step;
  glow([]);
  switch (step) {
    case 'crank':
      coach('How it works · 1 of 5', 'This machine holds every gumball you own. <b>Turn the crank</b> to drop five of them into the tray. Tap the crank or the big red button.');
      glow(['bgo']);
      break;
    case 'land':
      hideCoach();
      tut.wait = 'settled';
      break;
    case 'tap':
      coach('How it works · 2 of 5', 'Each gumball pays the ¢ on its tag. Gold <b>+</b> badges show gumballs helping each other: Cherries touching Cherries, a Bee touching a Daisy. <b>Tap a gumball</b> to see what it does.');
      break;
    case 'nudge':
      coach('How it works · 3 of 5', 'Not touching the right things? <b>Nudge the tray</b>: swipe across it, or use the arrow buttons. The first nudge each turn costs ¢1, then ¢2, ¢3…');
      glow(['bl', 'br']);
      break;
    case 'collect':
      coach('How it works · 4 of 5', 'The numbers update as they roll. Happy with it? <b>Collect</b> your pennies. You can nudge again first if you like.');
      glow(['bgo']);
      break;
    case 'rent':
      coach('How it works · 5 of 5', 'Rent is due every five turns: watch the pink slip up top. It goes up each time, and each time you pay, one more gumball drops per turn. Pay all eight and the shop is yours.', {
        button: { label: 'Open for business', fn: endTut }, skip: false,
      });
      break;
  }
}
function endTut() { tut = null; hideCoach(); glow([]); store.tut = true; save(); barSig = ''; }

// ---------- input
const cv = $('c');
let down = null;
cv.addEventListener('pointerdown', (e) => {
  sound.init();
  down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
  if (mode === 'play' && game && game.phase === 'idle' && view.hitCrank(e.clientX, e.clientY)) { crank(); down = null; }
});
cv.addEventListener('pointerup', (e) => {
  if (!down || e.pointerId !== down.id) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  const d = down; down = null;
  if (!game) return;
  if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.2 && view.inTray(d.x, d.y)) { nudge(Math.sign(dx)); return; }
  if (Math.hypot(dx, dy) < 14) {
    const balls = payBalls || game.tray;
    const b = view.hitBall({ tray: balls.filter((x) => !x.hidden) }, e.clientX, e.clientY);
    if (b) {
      showInfo(b, balls.indexOf(b));
      sound.play('tap');
      if (tut && tut.step === 'tap') tutStep('nudge');
    } else hideInfo();
  }
});
cv.addEventListener('pointercancel', () => { down = null; });
cv.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || !game || down) return;
  const balls = payBalls || game.tray;
  const b = view.hitBall({ tray: balls.filter((x) => !x.hidden) }, e.clientX, e.clientY);
  if (b && b.id !== view.highlight) showInfo(b, balls.indexOf(b));
  cv.style.cursor = b || (game.phase === 'idle' && view.hitCrank(e.clientX, e.clientY)) ? 'pointer' : '';
});

$('bgo').onclick = () => { sound.init(); if (!game) return; if (game.phase === 'idle') crank(); else collect(); };
$('bl').onclick = () => nudge(-1);
$('br').onclick = () => nudge(1);
$('bskip').onclick = () => choose(null);
$('breroll').onclick = reroll;
$('tkeep').onclick = () => doToss(false);
$('tgo').onclick = () => doToss(true);
$('cskip').onclick = () => { sound.play('tap'); endTut(); };
$('bplay').onclick = () => { sound.init(); sound.play('tap'); start(!store.tut); };
$('btut').onclick = () => { sound.init(); sound.play('tap'); start(true); };
$('oagain').onclick = () => { sound.play('tap'); start(false); };
$('omenu').onclick = () => { sound.play('tap'); toTitle(); };
$('omore').onclick = () => { sound.play('tap'); $('over').hidden = true; openToss(); };
$('bjar').onclick = () => { sound.play('tap'); openJar(); };
$('jclose').onclick = () => { sound.play('tap'); $('jar').hidden = true; };
$('bmenu').onclick = () => { sound.play('tap'); paused = true; $('menu').hidden = false; bar(); };
$('mresume').onclick = () => { sound.play('tap'); paused = false; $('menu').hidden = true; barSig = ''; };
$('mquit').onclick = () => { sound.play('tap'); paused = false; toTitle(); };
function soundLabel() { $('bsound').textContent = $('msound').textContent = 'Sound: ' + (store.sound ? 'on' : 'off'); }
$('bsound').onclick = $('msound').onclick = () => { store.sound = !store.sound; sound.setOn(store.sound); sound.init(); sound.play('tap'); soundLabel(); save(); };
soundLabel();

function openJar() {
  if (!game) return;
  const counts = {};
  for (const it of game.items) counts[it.kind] = (counts[it.kind] || 0) + 1;
  const list = $('jlist');
  list.innerHTML = '';
  Object.keys(counts).sort((a, b) => counts[b] - counts[a]).forEach((k) => {
    const row = document.createElement('div');
    row.className = 'li';
    row.appendChild(ballCanvas(k, 38));
    row.insertAdjacentHTML('beforeend', `<div><b>${KINDS[k].name} × ${counts[k]}</b><span>${KINDS[k].text}</span></div>`);
    list.appendChild(row);
  });
  $('jkick').textContent = `${game.items.length} in the machine · ${game.dispense} drop per turn`;
  $('jar').hidden = false;
}

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key;
  if (mode === 'title' && (k === 'Enter' || k === ' ')) { e.preventDefault(); $('bplay').click(); return; }
  if (!game) return;
  if (!$('jar').hidden || !$('menu').hidden) { if (k === 'Escape') { $('jar').hidden = true; $('mresume').click(); } return; }
  if (mode === 'play') {
    if (k === ' ' || k === 'Enter') { e.preventDefault(); if (game.phase === 'idle') crank(); else collect(); }
    else if (k === 'ArrowLeft' || k === 'a') nudge(-1);
    else if (k === 'ArrowRight' || k === 'd') nudge(1);
    else if (k === 'Escape') { hideInfo(); }
  } else if (mode === 'pick') {
    if (k >= '1' && k <= '3' && offers[+k - 1]) choose(offers[+k - 1]);
    else if (k === 's' && !tut) choose(null);
    else if (k === 'r') reroll();
  } else if (mode === 'rent' && (k === 'Enter' || k === ' ')) { e.preventDefault(); $('rgo').click(); }
  else if (mode === 'toss' && k === 'Escape') doToss(false);
});

// ---------- the loop
function tick(dt) {
  for (const t of timers) t.t -= dt;
  const due = timers.filter((t) => t.t <= 0);
  timers = timers.filter((t) => t.t > 0);
  for (const t of due) t.fn();
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.add('off'); }
  if (infoT > 0 && !(down)) { infoT -= dt; if (infoT <= 0 && !DEMO) hideInfo(); }
  const g = game || bgGame;
  if (g && !paused) {
    g.tick(dt);
    for (const e of g.events) {
      if (!game) continue;
      if (e.type === 'hit') sound.clack(e.dv, !e.b);
      else if (e.type === 'spawn') { view.flap = 1; sound.play('drop'); }
      else if (e.type === 'hatch') { view.burst(e.ball.x, e.ball.y, '#fff4e0', 14, 200); view.float(e.ball.x, e.ball.y - 16, 'hatched!', '#ffe45c'); sound.play('crack'); }
      else if (e.type === 'boing') sound.play('boing', e.ball.bounces);
      else if (e.type === 'nudge') { view.shake = 1; view.shakeDir = e.dir; sound.play('nudge'); }
    }
    g.events.length = 0;
  }
  if (g && g.tray.length) score = g.score(); else score = null;
  if (tut && tut.wait === 'settled' && game && game.phase === 'settle' && (game.settled || game.settleT > 2.5)) { tut.wait = null; tutStep('tap'); }
  view.update(dt);
  if (game) { if (mode === 'play' && game.phase !== 'done') shown = game.money; hud(); }
  bar();
}

function draw() {
  const g = game || bgGame;
  const balls = payBalls || (g ? g.tray : []);
  const s = payBalls ? payScore : score;
  view.draw({ tray: balls }, s, { showScore: !!game && !!s });
}

let last = performance.now();
function frame(t) {
  const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
  last = t;
  if (!HOLD) tick(dt);
  draw();
  requestAnimationFrame(frame);
}

// ---------- boot
layout();
const titleBalls = $('tballs');
for (const k of ['cherry', 'bee', 'flower', 'cat', 'fish', 'gold', 'magnet', 'bomb', 'rainbow']) titleBalls.appendChild(ballCanvas(k, 34));

if (DEMO) {
  $('title').hidden = true;
  document.body.classList.remove('menu');
  game = new Game(11, { start: ['bee', 'flower', 'cherry', 'cherry', 'cat', 'fish', 'milk', 'magnet', 'coin', 'gold', 'rainbow', 'clover', 'dice', 'jawbreaker', 'balloon', 'flower', 'bee', 'diamond', 'cheese', 'mouse', 'hive', 'egg'], money: 87 });
  game.rentIdx = 3; game.crank = 17;
  view.syncGlobe(game.items);
  for (let i = 0; i < 120; i++) view.globe.step(1 / 60);
  const pick = ['bee', 'flower', 'cherry', 'cherry', 'cat', 'fish', 'magnet', 'coin', 'gold', 'rainbow', 'clover', 'dice', 'jawbreaker', 'balloon'].map((k) => game.items.find((it) => it.kind === k));
  game.startCrank(pick);
  for (const it of pick) out.add(it.uid);
  view.syncGlobe(game.items, out);
  game.spawnT = 0;
  for (let i = 0; i < 60 * 4; i++) game.tick(1 / 60);
  game.events.length = 0;
  mode = 'play';
  shown = game.money;
} else toTitle();

document.fonts && document.fonts.load('400 20px Shrikhand').then(() => document.fonts.load('900 20px "Big Shoulders Display"')).then(() => { clearSprites(); }).catch(() => {});
requestAnimationFrame(frame);

if (DEBUG || DEMO) {
  window.gb = {
    get game() { return game; }, get mode() { return mode; }, view, store,
    hold(v = true) { HOLD = v; },
    step(sec = 1, dt = 1 / 60) { for (let t = 0; t < sec; t += dt) tick(dt); draw(); },
    start, crank, collect, nudge, choose, toTitle, openRent, get offers() { return offers; }, get tut() { return tut; },
    autoplay(turns = 5) {
      for (let n = 0; n < turns && mode !== 'over'; n++) {
        if (mode === 'play' && game.phase === 'idle') crank();
        this.step(4);
        if (mode === 'play') collect();
        this.step(4);
        if (mode === 'pick') choose(botPick(game, offers));
        this.step(0.6);
        if (mode === 'rent') { $('rgo').click(); this.step(1.4); }
        if (mode === 'toss') doToss(false);
        if (mode === 'over') break;
      }
      return { mode, crank: game.crank, money: game.money, rent: game.rentIdx };
    },
  };
}
