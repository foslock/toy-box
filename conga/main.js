import { SPECIES, TREATS, thumb } from './animals.js';
import { Game, CAP, rng } from './game.js';
import { ROUNDS, buildRound, floorSize } from './rounds.js';
import * as Shop from './shop.js';
import { View } from './render.js';
import { Sound } from './sound.js';
import { botSteer } from './bot.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), AUTO = Q.has('autoplay'), DEBUG = Q.has('debug') || AUTO;
const SPEED = +Q.get('speed') || 1;

const ICON = {
  A: '<svg class="ic" viewBox="0 0 20 20" aria-label="attack"><path d="M10 1l2.2 5.3 5.6-1.6-3.4 4.6 4 3.9-5.7.4-.3 5.6L10 15l-4.4 3.6-.3-5.6-5.7-.4 4-3.9L.2 4.7l5.6 1.6z" fill="#ffe33a" stroke="#3255a4" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  H: '<svg class="ic" viewBox="0 0 20 20" aria-label="health"><path d="M10 17.5S2 12.6 2 7.2C2 4.6 4 2.8 6.2 2.8c1.6 0 3 .9 3.8 2.3.8-1.4 2.2-2.3 3.8-2.3C16 2.8 18 4.6 18 7.2c0 5.4-8 10.3-8 10.3z" fill="#ff48b0"/></svg>',
  H0: '<svg class="ic" viewBox="0 0 20 20"><path d="M10 17.5S2 12.6 2 7.2C2 4.6 4 2.8 6.2 2.8c1.6 0 3 .9 3.8 2.3.8-1.4 2.2-2.3 3.8-2.3C16 2.8 18 4.6 18 7.2c0 5.4-8 10.3-8 10.3z" fill="none" stroke="#3255a4" stroke-width="1.5" stroke-dasharray="2 2"/></svg>',
  coin: '<svg class="ic" viewBox="0 0 20 20" aria-label="coins"><circle cx="9.4" cy="10.6" r="7.5" fill="#ffe33a"/><circle cx="10.6" cy="9.4" r="7.5" fill="none" stroke="#ff48b0" stroke-width="1.6"/><path d="M10 5.5l1.2 2.9 3.1.2-2.4 2 .8 3-2.7-1.7-2.7 1.7.8-3-2.4-2 3.1-.2z" fill="#3255a4"/></svg>',
  on: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  off: '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};
const fmt = (s) => s.replace(/\{A\}/g, ICON.A).replace(/\{H\}/g, ICON.H);

// ---------- saved bits
const KEY = 'conga.v1';
const store = { best: 0, champ: 0, tut: false, shopTut: false, sound: true, tips: {} };
try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
const save = () => { if (DEMO || AUTO) return; try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {} };

// ---------- state
const cv = $('c');
const view = new View(cv);
const sound = new Sound();
sound.setOn(store.sound);
let rand = rng((Q.get('seed') | 0) || (Date.now() & 0xffffff));
let mode = 'title';            // title | tut | play | shop | msg
let run = null, game = null, bg = null;
let paused = false, hold = false;
let endT = -1;
let tut = null, shopTut = -1;
let sel = null;                // what's picked in the shop
let msgBack = null;            // where the who's-who card returns to

// ---------- the backdrop: a bot dancing behind the menus
function makeBg() {
  const { W, H } = floorSize(view.room().w / view.room().h);
  const brun = { leader: { atk: 2, hp: 99 }, roster: ['frog', 'bee', 'bee', 'parrot', 'flamingo', 'tortoise'].map(sp => ({ sp, lvl: 1, atk: SPECIES[sp].atk, hp: 99 })) };
  const cfg = buildRound(1, rng(7), W, H);
  cfg.foes.forEach(f => { f.lead.hp = 99; });
  cfg.tutorial = true;
  bg = new Game(cfg, brun, { seed: 11 });
  view.fit(W, H);
  for (let i = 0; i < 90; i++) { bg.you.want = botSteer(bg); bg.tick(1 / 30); }
}

// ---------- coach
let coachT = null;
function coach(head, html, { low = false, button = null, ms = 0, skip = false } = {}) {
  $('ck').textContent = head;
  $('ct').innerHTML = fmt(html);
  $('cskip').hidden = !skip;
  $('cgo').hidden = !button;
  if (button) { $('cgo').textContent = button.label; $('cgo').onclick = () => { sound.play('tap'); button.fn(); }; }
  $('coach').classList.toggle('low', low);
  $('coach').classList.toggle('pass', !button && !skip);
  $('coach').classList.remove('off');
  clearTimeout(coachT);
  if (ms) coachT = setTimeout(hideCoach, ms);
}
function hideCoach() { $('coach').classList.add('off'); clearTimeout(coachT); }
function tip(id, head, html, ms = 4500) {
  if (DEMO || AUTO || store.tips[id] || mode === 'tut') return;
  store.tips[id] = 1; save();
  coach(head, html, { ms, low: true });
}

let bannerT = null;
function banner(k, t, p, ms = 1800) {
  $('bk').textContent = k; $('bt').textContent = t; $('bt').dataset.t = t; $('bp').innerHTML = fmt(p || '');
  $('banner').classList.remove('off');
  clearTimeout(bannerT);
  bannerT = setTimeout(() => $('banner').classList.add('off'), ms);
}

// ---------- HUD
let hudKey = '';
function hud() {
  const g = mode === 'play' || mode === 'tut' ? game : null;
  const len = g?.you ? g.you.dancers.length - 1 : run ? run.roster.length : 0;
  const coins = run ? run.coins + (mode === 'play' && g ? g.coinsGot : 0) : 0;
  const k = [mode, run?.round, run?.hearts, coins, len].join();
  if (k === hudKey) return;
  hudKey = k;
  if (mode === 'tut') { $('snum').textContent = 'Lesson'; $('sname').textContent = 'First steps'; }
  else if (run) { $('snum').textContent = `Song ${Math.min(run.round + 1, ROUNDS.length)}/${ROUNDS.length}`; $('sname').textContent = ROUNDS[Math.min(run.round, ROUNDS.length - 1)].name; }
  else { $('snum').textContent = ''; $('sname').textContent = ''; }
  $('hearts').innerHTML = run && mode !== 'tut' ? [0, 1, 2].map(i => i < run.hearts ? ICON.H : ICON.H0).join('') : '';
  $('coins').innerHTML = run && mode !== 'tut' ? ICON.coin + coins : '';
  $('troupe').textContent = `line ${len}/${CAP}`;
}
function muteIcon() { $('bmute').innerHTML = store.sound ? ICON.on : ICON.off; }

// ---------- events from the floor
let lastClashSnd = 0;
function onEvent(type, e) {
  if (DEMO) { if (type === 'ko') view.burst(e.d.x, e.d.y, e.line.team, e.lead ? 30 : 16); return; }
  switch (type) {
    case 'join': if (e.line.team === 'you') sound.play('join'); break;
    case 'coin': sound.play('coin'); break;
    case 'full': sound.play('coin'); tip('full', 'Full line', `Ten dancers is as long as a line gets. Any more animals you pick up turn into 2 coins.`); break;
    case 'clash': {
      const now = performance.now();
      if (now - lastClashSnd > 70) { sound.play('clash'); lastClashSnd = now; }
      const yh = game.you?.head;
      if (yh && (e.p === yh || e.q === yh)) { view.shake = Math.max(view.shake, 0.5); sound.play('hurt'); if (yh.hp <= 3 && yh.hp > 0) tip('low', 'Careful', 'Your capybara is nearly knocked out. Keep its nose away from rivals and let them run into the rest of your line.'); }
      break;
    }
    case 'ko': sound.play('ko'); view.burst(e.d.x, e.d.y, e.line.team, e.lead ? 34 : 16); if (e.lead) view.shake = 1; break;
    case 'scatter': sound.play('scatter'); if (mode === 'play') tip('scatter', 'Line broken up', 'Their dancers are free now. Grab them before another line does.'); break;
    case 'trip': sound.play('trip'); tip('trip', 'Tripped!', 'You ran into your own line, so everyone from there back fell over. Bump into them to pick them up again.'); break;
    case 'end': endT = 1.6; break;
  }
}

// ---------- a run
function startRun() {
  run = Shop.newRun();
  openShop(true);
}

function openShop(first = false) {
  mode = 'shop';
  game = null;
  hideCoach();
  if (first && !store.shopTut) {
    run.offers = ['bee', 'tortoise', 'frog', 'humming']; run.treat = null;
    shopTut = 0;
  } else { Shop.rollShop(run, rand); shopTut = -1; }
  sel = null;
  if (!bg) makeBg();
  show('vshop');
  renderShop();
}

function show(id) {
  for (const v of ['vtitle', 'vshop', 'vmsg']) $(v).hidden = v !== id;
  document.body.classList.toggle('menu', id === 'vtitle');
  hudKey = '';
}

const SHOP_TIPS = [
  'Tap the <b>bee</b> at the stall to see what it does.',
  'Bees hit harder near the front of the line. Tap <b>Buy</b>.',
  'Now buy the <b>tortoise</b>. It protects the whole line from the very back.',
  'Order matters. Tap a dancer in your line and move it with <b>◀ ▶</b>. Spend what\'s left, then tap <b>Dance!</b>',
];

function tokHTML(sp, team, st, extra = '') {
  return `<img src="${thumb(sp, team, 50, extra.includes('lead'))}" alt="${SPECIES[sp].name}">` + (st ? `<div class="st"><i>${st[0]}</i><i>${st[1]}</i></div>` : '');
}

function renderShop() {
  const r = run, el = $('shop'), R = ROUNDS[r.round];
  let h = `<div class="top"><div><div class="kick">Intermission</div><h2 class="mis" data-t="The stall">The stall</h2></div>
    <div class="purse"><span>${[0, 1, 2].map(i => i < r.hearts ? ICON.H : ICON.H0).join('')}</span><span>${ICON.coin}${r.coins}</span></div></div>
    <div class="small" style="margin-top:2px">Next: song ${r.round + 1} of ${ROUNDS.length}, <b>${R.name}</b>: ${R.boss ? 'the carnival parade, one enormous line' : `${R.lines === 1 ? 'one rival line' : R.lines + ' rival lines'} of ${R.n + 1}`}</div>`;
  h += `<div class="lbl"><span>Your line</span><span>front → back</span></div><div class="toks">`;
  h += `<button class="tok lead ${sel === 'lead' ? 'sel' : ''}" data-k="lead">${tokHTML('capy', 'you', [r.leader.atk, r.leader.hp], 'lead')}</button>`;
  r.roster.forEach((e, i) => {
    h += `<button class="tok ${sel === 'r' + i ? 'sel' : ''} ${shopTut === 3 && i === 0 ? '' : ''}" data-k="r${i}"><span class="pos">${i + 1}</span>${e.lvl > 1 ? `<span class="lv">${'★'.repeat(e.lvl)}</span>` : ''}${tokHTML(e.sp, 'you', [e.atk, e.hp])}</button>`;
  });
  for (let i = r.roster.length; i < CAP; i++) h += `<div class="tok empty"></div>`;
  h += `</div><div class="lbl"><span>For sale</span><span>${Shop.PRICE} coins each</span></div><div class="toks">`;
  r.offers.forEach((sp, i) => {
    if (!sp) { h += `<div class="tok gone"></div>`; return; }
    const S = SPECIES[sp], m = Shop.mergeTarget(r, sp);
    const hot = (shopTut === 0 && sp === 'bee') || (shopTut === 2 && sp === 'tortoise');
    h += `<button class="tok ${m ? 'merge' : ''} ${sel === 'o' + i ? 'sel' : ''} ${hot ? 'pulse' : ''}" data-k="o${i}"><span class="price">${m ? '+1' : Shop.PRICE}</span>${tokHTML(sp, 'wild', [S.atk, S.hp])}</button>`;
  });
  if (r.treat) h += `<button class="tok ${sel === 't' ? 'sel' : ''}" data-k="t"><span class="price">${TREATS[r.treat].cost}</span><img src="${treatImg(r.treat)}" alt="${TREATS[r.treat].name}"></button>`;
  h += `</div><div id="info">${infoHTML()}</div>`;
  if (shopTut >= 0) h += `<div id="shopnote"><b>Shop lesson.</b> ${SHOP_TIPS[shopTut]}</div>`;
  h += `<div class="foot"><button class="btn alt" id="breroll" ${r.coins < Shop.REROLL ? 'disabled' : ''}>Reroll ${ICON.coin}${Shop.REROLL}</button><button class="btn ${shopTut === 3 ? 'pulse' : ''}" id="bdance">Dance!</button></div>`;
  el.innerHTML = h;
  el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => pick(b.dataset.k));
  el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => act(b.dataset.a));
  $('breroll').onclick = () => { if (Shop.reroll(run, rand)) { sound.play('buy'); sel = null; renderShop(); } };
  $('bdance').onclick = () => { sound.init(); sound.play('tap'); if (shopTut >= 0) { store.shopTut = true; save(); shopTut = -1; } startRound(); };
}

function infoHTML() {
  const r = run;
  if (!sel) return `<div class="tx small">Tap any animal to read what it does. Tap an animal in your line to move or sell it.</div>`;
  if (sel === 'lead') return `<div class="nm">Capybara <small>${r.leader.atk}${ICON.A} ${r.leader.hp}${ICON.H}</small></div><div class="tx">${SPECIES.capy.text()} It gets +1${ICON.H} for every song you win.</div>`;
  if (sel === 't') {
    const T = TREATS[r.treat];
    return `<div class="nm">${T.name}</div><div class="tx">${fmt(T.text)}</div><div class="acts"><button class="btn" data-a="treat" ${Shop.canTreat(r) ? '' : 'disabled'}>Buy ${ICON.coin}${T.cost}</button></div>`;
  }
  if (sel[0] === 'o') {
    const sp = r.offers[+sel.slice(1)], S = SPECIES[sp], m = Shop.mergeTarget(r, sp);
    return `<div class="nm">${S.name} <small>${S.atk}${ICON.A} ${S.hp}${ICON.H}</small></div><div class="tx">${fmt(S.text(1))}</div>
      ${m ? `<div class="tx small">You already have one: buying it adds +1${ICON.A} +1${ICON.H} to it and levels it up${m.lvl >= 3 ? ' (it\'s already top level)' : ''}.</div>` : r.roster.length >= CAP ? '<div class="tx small">Your line is full. Sell someone first.</div>' : ''}
      <div class="acts"><button class="btn" data-a="buy" ${Shop.canBuy(r, +sel.slice(1)) ? '' : 'disabled'}>Buy ${ICON.coin}${Shop.PRICE}</button></div>`;
  }
  const i = +sel.slice(1), e = r.roster[i], S = SPECIES[e.sp];
  return `<div class="nm">${S.name} <small>level ${e.lvl} · ${e.atk}${ICON.A} ${e.hp}${ICON.H} · place ${i + 1}</small></div><div class="tx">${fmt(S.text(e.lvl))}</div>
    <div class="acts"><button class="btn alt" data-a="fwd" ${i === 0 ? 'disabled' : ''} aria-label="Move forward">◀</button><button class="btn alt" data-a="back" ${i === r.roster.length - 1 ? 'disabled' : ''} aria-label="Move back">▶</button><button class="btn alt" data-a="sell">Sell +${e.lvl}</button></div>`;
}

const treatImgs = {};
function treatImg(t) {
  if (treatImgs[t]) return treatImgs[t];
  const c = document.createElement('canvas'), d = Math.min(2, devicePixelRatio || 1); c.width = c.height = 50 * d;
  const g = c.getContext('2d'); g.scale(d, d); g.fillStyle = '#f6efdc'; g.fillRect(0, 0, 50, 50);
  g.globalCompositeOperation = 'multiply'; g.lineCap = 'round';
  if (t === 'mango') {
    g.fillStyle = '#ffe33a'; g.beginPath(); g.ellipse(25, 28, 14, 12, -0.5, 0, 7); g.fill();
    g.fillStyle = '#ff48b0'; g.beginPath(); g.ellipse(27, 27, 13, 11, -0.5, 0, 7); g.fill();
    g.strokeStyle = '#3255a4'; g.lineWidth = 3; g.beginPath(); g.moveTo(30, 16); g.quadraticCurveTo(33, 10, 38, 9); g.stroke();
    g.fillStyle = '#3255a4'; g.beginPath(); g.ellipse(36, 13, 6, 3, -0.6, 0, 7); g.fill();
  } else {
    for (const [x, rot, col] of [[18, -0.4, '#ff48b0'], [32, 0.4, '#3255a4']]) {
      g.save(); g.translate(x, 26); g.rotate(rot);
      g.fillStyle = col; g.beginPath(); g.ellipse(0, -6, 8, 10, 0, 0, 7); g.fill();
      g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 3); g.lineTo(0, 18); g.stroke();
      g.fillStyle = '#ffe33a'; g.fillRect(-6, -9, 12, 3);
      g.restore();
    }
  }
  return (treatImgs[t] = c.toDataURL());
}

function pick(k) {
  sound.init();
  if (sel === k && k[0] === 'o' && Shop.canBuy(run, +k.slice(1))) return act('buy');
  sel = sel === k ? null : k;
  sound.play('tap');
  if (shopTut === 0 && k[0] === 'o' && run.offers[+k.slice(1)] === 'bee') shopTut = 1;
  renderShop();
}

function act(a) {
  const r = run;
  if (a === 'buy') {
    const i = +sel.slice(1), sp = r.offers[i];
    const res = Shop.buy(r, i);
    if (!res) { sound.play('no'); return; }
    sound.play('buy');
    const idx = r.roster.indexOf(res.added || res.merged);
    sel = 'r' + idx;
    if (shopTut <= 1 && sp === 'bee') shopTut = 2;
    else if (shopTut === 2 && sp === 'tortoise') shopTut = 3;
  } else if (a === 'treat') {
    if (!Shop.buyTreat(r)) { sound.play('no'); return; }
    sound.play('buy'); sel = null;
  } else if (a === 'sell') {
    Shop.sell(r, +sel.slice(1)); sound.play('coin'); sel = null;
  } else if (a === 'fwd' || a === 'back') {
    const j = Shop.move(r, +sel.slice(1), a === 'fwd' ? -1 : 1); sel = 'r' + j; sound.play('tap');
  }
  renderShop();
}

// ---------- songs
function floor() { const R = view.room(); return floorSize(R.w / R.h); }

function startRound() {
  show(null);
  view.top = 64;
  document.body.classList.remove('menu');
  const { W, H } = floor();
  view.fit(W, H);
  view.parts = [];
  const cfg = buildRound(run.round, rand, W, H);
  game = new Game(cfg, run, { seed: Math.floor(rand() * 1e9), emit: onEvent });
  mode = 'play'; paused = false; endT = -1;
  sound.init(); sound.reset();
  const R = ROUNDS[run.round];
  if (!DEMO) banner(`Song ${run.round + 1} of ${ROUNDS.length}`, R.name, R.boss ? 'Knock out the peacock to win the night' : 'Knock out the leaders in party hats');
  if (run.round === 0 && run.lost === 0) tip('goal', 'The song', 'Rivals in pink. Knock out each line\'s leader (the one in the party hat) and the whole line breaks up. Run into the free animals and coins to grab them.', 6500);
}

function finishRound() {
  const g = game, won = g.over === 'win';
  const res = Shop.settle(run, g);
  sound.play(won ? 'win' : 'lose');
  store.best = Math.max(store.best, run.round + (res === 'champion' ? 0 : 1));
  if (res === 'champion') store.champ++;
  save();
  mode = 'msg';
  const joined = g.joined.filter(e => run.roster.includes(e));
  const pay = `+${Shop.INCOME} pay${g.coinsGot ? ` and +${g.coinsGot} picked up` : ''}`;
  if (res === 'champion') {
    msg(`<div class="kick">Song 6 of 6 · Carnaval</div><h1 class="mis" data-t="Champions!">Champions!</h1>
      <p>The peacock is down and the whole parade is dancing behind your capybara. That's the night won.</p>
      <p class="small">Songs lost along the way: ${run.lost}. Lines broken up: ${run.koTotal}.</p>
      <div class="row"><button class="btn" data-go="again">Dance again</button><button class="btn alt" data-go="title">Title</button></div>`);
  } else if (res === 'out') {
    msg(`<div class="kick">Out of hearts</div><h1 class="mis" data-t="Party's over">Party's over</h1>
      <p>Your capybara made it to song ${run.round + 1}, <b>${ROUNDS[run.round].name}</b>, and broke up ${run.koTotal} line${run.koTotal === 1 ? '' : 's'} on the way.</p>
      <p class="small">Best so far: song ${store.best}${store.champ ? `, and ${store.champ} carnival win${store.champ > 1 ? 's' : ''}` : ''}.</p>
      <div class="row"><button class="btn" data-go="again">Dance again</button><button class="btn alt" data-go="title">Title</button></div>`);
  } else if (won) {
    msg(`<div class="kick">Song ${run.round} of ${ROUNDS.length} · ${ROUNDS[run.round - 1].name}</div><h2 class="mis" data-t="Encore!">Encore!</h2>
      <p>You broke up ${g.leadersOut === 1 ? 'the rival line' : `all ${g.leadersOut} rival lines`}. Your capybara gets +1${ICON.H}.</p>
      ${joined.length ? `<p class="small">New in the troupe:</p><div class="toks" style="margin-top:4px">${joined.map(e => `<div class="tok">${tokHTML(e.sp, 'you', [e.atk, e.hp])}</div>`).join('')}</div>` : ''}
      <p class="small">${ICON.coin} ${pay}. Knocked-out dancers are back on their feet for the next song.</p>
      <div class="row"><button class="btn" data-go="shop">To the stall</button></div>`);
  } else {
    msg(`<div class="kick">Song ${run.round + 1} · ${ROUNDS[run.round].name}</div><h2 class="mis" data-t="Knocked over!">Knocked over!</h2>
      <p>Your capybara went down, so that song's lost, and so is a heart: ${[0, 1, 2].map(i => i < run.hearts ? ICON.H : ICON.H0).join('')}</p>
      <p class="small">${ICON.coin} ${pay}. You'll get another go at <b>${ROUNDS[run.round].name}</b>. Try to keep the capybara's nose away from the rivals and let them run into the rest of your line.</p>
      <div class="row"><button class="btn" data-go="shop">To the stall</button></div>`);
  }
}

function msg(html) {
  $('msg').innerHTML = html;
  show('vmsg');
  $('msg').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { sound.play('tap'); go(b.dataset.go); });
}

function go(where) {
  if (where === 'shop') openShop();
  else if (where === 'again') startRun();
  else if (where === 'title') toTitle();
  else if (where === 'resume') { paused = false; show(null); mode = msgBack || 'play'; }
  else if (where === 'who') whoCard();
  else if (where === 'back') { if (msgBack === 'title') toTitle(); else { mode = msgBack; pauseCard(); } }
  else if (where === 'tut') startTut();
}

function toTitle() {
  mode = 'title'; game = null; run = null; tut = null; paused = false; view.top = 64;
  hideCoach();
  show('vtitle');
  document.body.classList.add('menu');
  if (!bg) makeBg();
  $('best').textContent = store.best ? `Best: song ${store.best} of 6${store.champ ? ` · carnival won ${store.champ}×` : ''}` : '';
  hud();
}

function pauseCard() {
  if (mode !== 'play' && mode !== 'tut') return;
  paused = true; msgBack = mode;
  msg(`<h2 class="mis" data-t="Paused">Paused</h2><p class="small">${mode === 'tut' ? 'Lesson: first steps.' : `Song ${run.round + 1}, ${ROUNDS[run.round].name}.`}</p>
    <div class="row"><button class="btn" data-go="resume">Keep dancing</button></div>
    <div class="row" style="margin-top:10px"><button class="btn alt" data-go="who">Who's who</button><button class="btn alt" data-go="title">Quit</button></div>`);
}

function whoCard() {
  const back = mode === 'title' || msgBack === 'title' ? 'title' : msgBack;
  msgBack = back;
  let h = `<div class="kick">The troupe</div><h2 class="mis" data-t="Who's who">Who's who</h2>
    <p class="small">Every animal has an attack ${ICON.A} and health ${ICON.H}. When dancers from two lines touch, each takes damage equal to the other's attack. Your capybara flashes for a second after a hit and can't be hurt again until it stops. A rival leader with nobody left behind it takes double damage. Many abilities depend on where the animal stands in the line.</p><div class="who">`;
  for (const [k, S] of Object.entries(SPECIES)) {
    if (k === 'peacock') continue;
    h += `<img src="${thumb(k, k === 'capy' ? 'you' : 'wild', 50, k === 'capy')}" alt=""><div><b>${S.name}</b> <span class="small">${S.atk}${ICON.A} ${S.hp}${ICON.H}</span>${S.tier ? ` <span class="tier">from song ${[0, 1, 2, 4][S.tier]}</span>` : ''}<br>${fmt(S.text(1))}</div>`;
  }
  h += `</div><p class="small">Buy a second copy of an animal you have and it merges: +1${ICON.A} +1${ICON.H} and a level up, up to level 3.</p>
    <div class="row"><button class="btn" data-go="back">Back</button></div>`;
  mode = 'msg';
  msg(h);
}

// ---------- the lesson
function startTut() {
  hideCoach();
  show(null);
  document.body.classList.remove('menu');
  view.top = innerWidth < 700 ? 205 : 64;
  const { W, H } = floor();
  view.fit(W, H); view.parts = [];
  run = null;
  const trun = { leader: { atk: 2, hp: 8 }, roster: [] };
  game = new Game({ W, H, foes: [], wild: [], tutorial: true }, trun, { seed: 5, emit: onEvent });
  game.trun = trun;
  mode = 'tut'; paused = false; endT = -1;
  sound.init(); sound.reset();
  tut = { i: -1, acc: 0, t: 0, lastH: game.you.h };
  nextTut();
}

const near = (g, d) => {
  const h = g.you.head, a = g.you.h;
  let x = h.x + Math.cos(a) * d, y = h.y + Math.sin(a) * d;
  if (x < 2 || x > g.W - 2 || y < 2 || y > g.H - 2) { x = g.W / 2 + (g.W / 2 - h.x) * 0.5; y = g.H / 2 + (g.H / 2 - h.y) * 0.5; }
  return [Math.max(2, Math.min(g.W - 2, x)), Math.max(2, Math.min(g.H - 2, y))];
};

const TUT = [
  { text: () => matchMedia('(pointer: coarse)').matches ? 'This is your capybara, leading a conga line of one. <em>Drag anywhere on the screen</em> to steer it. Try a few turns.' : 'This is your capybara, leading a conga line of one. <em>Point with the mouse</em> (or use the arrow keys) to steer it. Try a few turns.',
    done: (g, T) => T.acc > 5 },
  { text: () => 'A frog wants to dance. <em>Steer into it</em> and it joins the back of your line.',
    enter: (g) => { const [x, y] = near(g, 5); g.spawnWild('frog', x, y); },
    done: (g) => g.trun.roster.length >= 1 },
  { text: () => 'Nice. Grab the <em>bee</em> and the <em>tortoise</em> too. Where each one ends up in the line matters later.',
    enter: (g) => { g.spawnWild('bee', g.W * 0.25, g.H * 0.3); g.spawnWild('tortoise', g.W * 0.75, g.H * 0.65); },
    done: (g) => g.trun.roster.length >= 3 },
  { text: () => 'A rival line, in pink! When dancers from two lines touch, they clash: each takes damage equal to the other\'s attack {A}. Knock out the leader in the <em>party hat</em> to break the whole line up.',
    enter: (g) => { const L = g.addFoe({ lead: { sp: 'frog', atk: 1, hp: 4 }, dancers: [{ sp: 'humming' }], speed: 2.6, mode: 'tail' }, 2); L.mode = 'tail'; },
    done: (g) => g.foes.length === 0 && g.t > 1 },
  { text: () => 'Their dancers are free now, so they\'re up for grabs. <em>Pick one up.</em> (Rival lines will grab free animals too.)',
    done: (g, T) => !g.wild.some(w => !w.mine) || T.t > 12 },
  { text: () => 'One last thing: don\'t run into your own line. You\'ll trip, and everyone from there back falls over (you can pick them up again). That\'s the dance!', button: 'Start a night out' },
];

function nextTut() {
  tut.i++; tut.acc = 0; tut.t = 0;
  const S = TUT[tut.i];
  if (!S) return;
  S.enter?.(game);
  coach(`Lesson ${tut.i + 1} of ${TUT.length}`, S.text(), { skip: true, button: S.button ? { label: S.button, fn: endTut } : null });
}

function tutTick(dt) {
  const S = TUT[tut.i];
  if (!S || !game.you) return;
  tut.t += dt;
  tut.acc += Math.abs(((game.you.h - tut.lastH + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
  tut.lastH = game.you.h;
  if (S.done && S.done(game, tut)) nextTut();
}

function endTut() {
  store.tut = true; save();
  tut = null; hideCoach();
  startRun();
}

// ---------- input
const keys = new Set();
let stick = null, mouse = null, useMouse = false;
const KEYMAP = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] };

cv.addEventListener('pointerdown', (e) => {
  sound.init();
  if (e.pointerType === 'mouse') { mouse = { x: e.clientX, y: e.clientY }; useMouse = true; return; }
  if (stick) return;
  stick = { id: e.pointerId, ax: e.clientX, ay: e.clientY, px: e.clientX, py: e.clientY };
  useMouse = false;
  cv.setPointerCapture?.(e.pointerId);
});
cv.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') { mouse = { x: e.clientX, y: e.clientY }; useMouse = true; return; }
  if (!stick || e.pointerId !== stick.id) return;
  stick.px = e.clientX; stick.py = e.clientY;
  const dx = stick.px - stick.ax, dy = stick.py - stick.ay, d = Math.hypot(dx, dy), M = 56;
  if (d > M) { stick.ax = stick.px - dx / d * M; stick.ay = stick.py - dy / d * M; }
});
const endStick = (e) => { if (stick && e.pointerId === stick.id) stick = null; };
cv.addEventListener('pointerup', endStick);
cv.addEventListener('pointercancel', endStick);
cv.addEventListener('contextmenu', (e) => e.preventDefault());

addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) { keys.add(e.code); useMouse = false; e.preventDefault(); sound.init(); }
  if (e.code === 'KeyP' || e.code === 'Escape') { if (paused) go('resume'); else pauseCard(); }
  if (e.code === 'KeyM') toggleMute();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

function steerInput(g) {
  if (!g.you) return;
  let kx = 0, ky = 0;
  for (const k of keys) { kx += KEYMAP[k][0]; ky += KEYMAP[k][1]; }
  if (kx || ky) { g.you.want = Math.atan2(ky, kx); return; }
  if (stick) {
    const dx = stick.px - stick.ax, dy = stick.py - stick.ay;
    if (Math.hypot(dx, dy) > 9) g.you.want = Math.atan2(dy, dx);
    return;
  }
  if (useMouse && mouse) {
    const w = view.toWorld(mouse.x, mouse.y), h = g.you.head;
    if (Math.hypot(w.x - h.x, w.y - h.y) > 0.7) g.you.want = Math.atan2(w.y - h.y, w.x - h.x);
  }
}

function toggleMute() { store.sound = !store.sound; sound.setOn(store.sound); if (store.sound) sound.init(); muteIcon(); save(); }
$('bmute').onclick = () => { sound.init(); toggleMute(); };
$('bpause').onclick = () => { sound.init(); sound.play('tap'); pauseCard(); };
$('cskip').onclick = () => { sound.play('tap'); store.tut = true; save(); tut = null; hideCoach(); startRun(); };
$('bplay').onclick = () => { sound.init(); sound.play('tap'); if (store.tut) startRun(); else startTut(); };
$('blessons').onclick = () => { sound.init(); sound.play('tap'); startTut(); };
$('bwho').onclick = () => { sound.init(); sound.play('tap'); mode = 'title'; msgBack = 'title'; whoCard(); };
document.addEventListener('visibilitychange', () => { if (document.hidden && (mode === 'play' || mode === 'tut') && !paused && !DEMO && !AUTO) pauseCard(); });
addEventListener('resize', () => { view.resize(); });

$('parade').innerHTML = ['capy', 'frog', 'bee', 'parrot', 'tortoise'].map((k, i) => `<img src="${thumb(k, i ? 'wild' : 'you', 56, i === 0)}" alt="">`).join('');

// ---------- autoplay (for testing): the bot plays a whole night through the real screens
const FRONT = ['bee', 'bull', 'frog', 'armadillo'];
function autoShop() {
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < 4; i++) if (Shop.canBuy(run, i)) Shop.buy(run, i);
    if (Shop.canTreat(run) && run.coins >= 4) Shop.buyTreat(run);
    if (run.coins >= 4) Shop.reroll(run, rand);
  }
  const rank = (e) => FRONT.includes(e.sp) ? 0 : e.sp === 'tortoise' ? 2 : 1;
  run.roster.sort((a, b) => rank(a) - rank(b));
}
let autoT = 0;
function autoTick(dt) {
  autoT += dt;
  if (autoT < 0.6) return;
  autoT = 0;
  if (mode === 'title') startRun();
  else if (mode === 'shop') { autoShop(); shopTut = -1; startRound(); }
  else if (mode === 'msg') { const b = $('msg').querySelector('[data-go]'); if (b && b.dataset.go !== 'title') b.click(); }
}

// ---------- loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  try {
    const playing = (mode === 'play' || mode === 'tut') && game;
    const g = playing ? game : bg;
    if (g && !paused && !hold && dt) {
      if (playing && !AUTO) steerInput(g);
      const n = Math.ceil(dt * SPEED * 60), h = dt * SPEED / n;
      for (let i = 0; i < n; i++) {
        if (g === bg || AUTO) { if (g.you) g.you.want = botSteer(g, { sloppy: AUTO ? 1.5 : 0.5 }); }
        g.tick(h);
      }
      if (mode === 'tut' && tut) tutTick(dt * SPEED);
      if (mode === 'play' && endT >= 0 && (endT -= dt * SPEED) < 0) { endT = -1; finishRound(); }
    }
    if (AUTO) autoTick(dt * SPEED);
    view.draw(g, paused || hold ? 0 : dt * SPEED, { stick: playing && stick ? stick : null });
    const len = playing && game.you ? game.you.dancers.length - 1 : 0;
    sound.update(g ? g.beat : 0, g ? g.bpm : 104, 1 + Math.min(4, Math.floor(len / 2)), playing && !paused);
    hud();
  } catch (err) { console.error(err); }
}

// ---------- start
async function boot() {
  view.resize();
  muteIcon();
  try { await Promise.race([document.fonts.load('20px Chango'), new Promise(r => setTimeout(r, 1500))]); } catch {}
  if (DEMO) {
    document.body.classList.remove('menu');
    show(null);
    const { W, H } = floor();
    view.fit(W, H);
    run = Shop.newRun(); run.round = 2;
    run.roster = ['bee', 'frog', 'parrot', 'bull', 'flamingo', 'llama', 'armadillo', 'tortoise'].map((sp, i) => ({ sp, lvl: i ? 1 : 2, atk: SPECIES[sp].atk + (i ? 0 : 1), hp: SPECIES[sp].hp + 2, uid: i }));
    const cfg = buildRound(3, rng(4), W, H);
    cfg.foes.forEach(f => { f.lead.hp = 60; });
    run.leader.hp = 60;
    game = new Game(cfg, run, { seed: 9, emit: onEvent });
    game.tripGrace = 1e9;
    mode = 'play';
    for (let i = 0; i < 100; i++) { game.you.want = botSteer(game); game.tick(1 / 30); }
    game.coins.push({ x: W * 0.3, y: H * 0.62, t: 0 }, { x: W * 0.7, y: H * 0.35, t: 0 });
    hud();
  } else {
    toTitle();
    makeBg();
  }
  requestAnimationFrame(frame);
}
boot();

if (DEBUG) {
  window.cg = {
    get game() { return game; }, get run() { return run; }, get mode() { return mode; }, view, sound, Shop,
    set hold(v) { hold = v; }, get hold() { return hold; },
    ff(sec, bot = true) { const g = game || bg; for (let t = 0; t < sec; t += 1 / 60) { if (bot && g.you) g.you.want = botSteer(g); g.tick(1 / 60); if (mode === 'tut' && tut) tutTick(1 / 60); } view.draw(g, 0.016, {}); },
    startRun, startRound, startTut, openShop, toTitle, finishRound,
    bot: (sl = 0) => game && game.you ? botSteer(game, { sloppy: sl }) : null,
    state: () => ({ mode, paused, tut: tut ? tut.i : -1, shopTut, round: run?.round, hearts: run?.hearts, coins: run?.coins, roster: run?.roster.map(e => e.sp + e.lvl).join(' '),
      foes: game ? game.foes.map(L => L.dancers.length + ':' + L.head.hp).join(' ') : '', you: game?.you ? game.you.dancers.length + ':' + game.you.head.hp : 'down', over: game?.over || '', t: game ? +game.t.toFixed(1) : 0,
      coach: $('coach').classList.contains('off') ? '' : $('ct').textContent, msg: $('vmsg').hidden ? '' : $('msg').textContent.slice(0, 80) }),
  };
}
