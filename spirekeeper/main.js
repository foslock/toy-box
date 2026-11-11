// Spire Keeper — you build the tower; Pip climbs it live; chat wants drama.
import { CARDS, ENEMIES, RELICS, EVENTS, HABITS, FLOORS } from './data.js';
import * as S from './sim.js';
import { INK, Pen, drawSlate, frameURL, grainMaskURL, icon, sprite, CREATURE_SCALE } from './art.js';
import { Sound } from './sound.js';
import { Chat } from './chat.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), AUTO = Q.has('auto');
const SAVE_KEY = 'spirekeeper.v1';

// ---------------------------------------------------------------- save
let save = { tut: false, best: 0, legends: 0, runs: 0, sound: true, speed: 1 };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) save = { ...save, ...s }; } catch {}
const persist = () => { if (DEMO || AUTO) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} };

// ---------------------------------------------------------------- chalk CSS
const root = document.documentElement.style;
root.setProperty('--frame', `url(${frameURL(INK.white, 3)})`);
root.setProperty('--frameY', `url(${frameURL(INK.yellow, 5)})`);
root.setProperty('--frameP', `url(${frameURL(INK.pink, 7)})`);
root.setProperty('--frameB', `url(${frameURL(INK.blue, 9)})`);
root.setProperty('--frameR', `url(${frameURL(INK.red, 11)})`);
root.setProperty('--frameD', `url(${frameURL('#7d8a82', 13, 120, 10, 2.4)})`);
root.setProperty('--grain', `url(${grainMaskURL()})`);

const touch = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch', touch);

const snd = new Sound(); snd.on = save.sound;
const chat = new Chat($('chat'));

// ---------------------------------------------------------------- canvas
const cv = $('board'), cx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, bg = null, bgKey = '';
let stageR = { x: 0, y: 0, w: 100, h: 100 };
function resize() {
  W = innerWidth; H = innerHeight; DPR = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  bgKey = '';
}
addEventListener('resize', resize);
resize();

function rectOf(el) { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }

function buildBg() {
  const key = [W, H, DPR, stageR.x | 0, stageR.y | 0, stageR.w | 0, stageR.h | 0, mode === 'title'].join(',');
  if (key === bgKey) return;
  bgKey = key;
  bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
  const x = bg.getContext('2d'); x.scale(DPR, DPR);
  drawSlate(x, W, H, 4);
  if (mode !== 'title' && !$('app').hidden) {
    const r = stageR, gy = groundY();
    const p = new Pen(x, 21, { color: 'rgba(242,239,230,.55)', w: 3, wob: 1.4 });
    p.line(r.x + 6, gy, r.x + r.w - 6, gy + 2);
    // a few flagstones under the line
    p.set('rgba(242,239,230,.16)', 2);
    for (let i = 0; i < 7; i++) { const xx = r.x + r.w * (0.06 + i * 0.15); p.line(xx, gy + 6, xx - 10, gy + 26); }
    // stone tower walls at either side of the stage
    p.set('rgba(242,239,230,.13)', 2.2);
    const bw = Math.min(46, r.w * 0.07), bh = 22;
    for (const side of [0, 1]) {
      const x0 = side ? r.x + r.w - bw : r.x;
      for (let yy = r.y + 4, row = 0; yy < gy - bh; yy += bh, row++) {
        p.rect(x0 + (row % 2 ? -bw * 0.4 : 0) * (side ? -1 : 1), yy, bw, bh - 3);
      }
    }
  }
}
const groundY = () => stageR.y + stageR.h * (stageR.h < 240 ? 0.64 : 0.79);

// ---------------------------------------------------------------- state
let mode = 'title';     // title | choose | fight | result | end
let run = null, rooms = [], sel = -1, forecasts = [];
let F = null;            // the fight being played back
let D = null;            // what the stage shows: { hero, foe, intent, foeKey }
let speed = save.speed || 1;
let paused = false, holdFight = false;
let hypeShown = 55, viewersShown = 140, hypeFloat = [];
let ghostKey = null;     // room previewed on the right of the stage
let roomDoodle = null;   // non-fight room drawing
let resultHype = [];
const vis = { hero: mkVis(), foe: mkVis() };
function mkVis() { return { lunge: 0, shake: 0, flash: 0, dead: 0, block: 0, enter: 1 }; }
let fx = [], callout = null, shakeAmt = 0, face = { mood: 'calm', t: 0 };
let tut = null;          // tutorial controller
let tutAllow = null;     // in the tutorial, which room key can be picked

// ---------------------------------------------------------------- helpers
const fmt = n => n >= 10000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : n.toLocaleString('en-US');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function cardEl(id, extra = '') {
  const c = CARDS[id];
  const d = el('div', `card box d dust ${c.type} ${extra}`);
  d.dataset.id = id;
  d.innerHTML = `<span class="cost">${c.cost > 9 ? '×' : c.cost}</span><span class="cn">${esc(c.name)}</span><span class="ct">${esc(c.text)}</span>`;
  const [ic, col, num] = cardBadge(c);
  const bdg = el('span', 'badge'); bdg.append(iconEl(ic, col)); if (num) bdg.append(el('b', '', num)); bdg.style.color = col;
  d.append(bdg);
  return d;
}
function cardBadge(c) {
  if (c.type === 'curse') return ['debuff', INK.lilac, ''];
  if (c.type === 'atk') return ['atk', INK.orange, c.wild ? `${c.wild[0]}-${c.wild[1]}` : c.bash ? '?' : c.hits ? `${c.dmg}×${c.hits}` : `${c.dmg}`];
  if (c.str) return ['str', INK.yellow, `+${c.str}`];
  if (c.thorns) return ['thorns', INK.yellow, `${c.thorns}`];
  if (c.fortify) return ['fortify', INK.yellow, `${c.fortify}`];
  if (c.regrow) return ['regrow', INK.yellow, `${c.regrow}`];
  if (c.heal) return ['heal', INK.green, `${c.heal}`];
  if (c.poison) return ['poison', INK.green, `${c.poison}`];
  if (c.energy) return ['energy', INK.yellow, `+${c.energy}`];
  if (c.weak) return ['weak', INK.lilac, `${c.weak}`];
  return ['def', INK.blue, `${c.block}`];
}
function iconEl(kind, color) {
  const c = icon(kind, color, 22, Math.min(2, DPR + 0.5));
  const img = document.createElement('canvas'); img.width = c.width; img.height = c.height;
  img.getContext('2d').drawImage(c, 0, 0);
  return img;
}
function moveParts(m) {
  // [ [iconKind, color, label] ]
  const out = [];
  if (m.sleep) out.push(['sleep', INK.lilac, '']);
  if (m.a) out.push(['atk', INK.red, m.n ? `${m.a}×${m.n}` : `${m.a}`]);
  if (m.b) out.push(['def', INK.blue, `${m.b}`]);
  if (m.s) out.push(['str', INK.orange, `+${m.s}`]);
  if (m.heal) out.push(['heal', INK.green, `${m.heal}`]);
  if (m.weak) out.push(['weak', INK.lilac, `${m.weak}`]);
  if (m.vuln) out.push(['vuln', INK.lilac, `${m.vuln}`]);
  if (m.poison) out.push(['poison', INK.green, `${m.poison}`]);
  return out;
}
function moveText(m) {
  const t = [];
  if (m.sleep) t.push('naps');
  if (m.a) t.push(m.n ? `hits ${m.a} × ${m.n}` : `hits ${m.a}`);
  if (m.b) t.push(`blocks ${m.b}`);
  if (m.s) t.push(`+${m.s} strength`);
  if (m.heal) t.push(`heals ${m.heal}`);
  if (m.weak) t.push(`Weak ${m.weak}`);
  if (m.vuln) t.push(`Vulnerable ${m.vuln}`);
  if (m.poison) t.push(`Poison ${m.poison}`);
  return t.join(', ');
}

// ---------------------------------------------------------------- top bar
function syncTop() {
  if (!run) return;
  $('floorN').textContent = Math.min(run.floor, FLOORS);
  $('sndBtn').textContent = snd.on ? 'Mute' : 'Unmute';
}
$('sndBtn').onclick = () => { snd.on = !snd.on; save.sound = snd.on; persist(); snd.wake(); syncTop(); };
$('pipBtn').onclick = () => openSheet();
$('sClose').onclick = () => closeSheet();
$('sheet').addEventListener('click', e => { if (e.target === $('sheet')) closeSheet(); });

function habitHTML() { return HABITS.map(h => `<p><b>${h.title}.</b> ${h.text}</p>`).join(''); }
$('habitList').innerHTML = HABITS.map(h => `<p><b>${h.title}.</b> ${h.text.replace(/^Above half HP, Pip never blocks\. Every card goes into hitting\./, 'Above half HP she never blocks.').replace(/^Under a quarter HP, Pip plays every heal and block first, even with the foe nearly dead\./, 'Under a quarter HP she turtles up.').replace(/^After a fight Pip always takes the reward with the biggest number on it\./, 'Always takes the reward with the biggest number.')}</p>`).join('');

function openSheet() {
  if (!run) return;
  paused = true;
  $('sHabits').innerHTML = habitHTML();
  $('sRelics').innerHTML = run.hero.relics.length ? run.hero.relics.map(k => `<p class="relic"><b>${RELICS[k].name}.</b> ${RELICS[k].text}</p>`).join('') : '<p style="color:var(--dim)">None yet. Treasure rooms hold relics.</p>';
  const counts = {};
  for (const id of run.hero.deck) counts[id] = (counts[id] || 0) + 1;
  const deck = $('sDeck'); deck.textContent = '';
  for (const [id, n] of Object.entries(counts)) { const c = cardEl(id); if (n > 1) c.append(el('span', 'n', `×${n}`)); deck.append(c); }
  $('sCount').textContent = `(${run.hero.deck.length})`;
  $('sheet').hidden = false;
  $('sClose').focus({ preventScroll: true });
}
function closeSheet() { $('sheet').hidden = true; paused = false; }

// ---------------------------------------------------------------- flow
function show(id) { for (const s of ['title', 'end']) $(s).hidden = s !== id; $('app').hidden = id === 'title'; }

function toTitle() {
  mode = 'title'; run = null; show('title'); bgKey = '';
  $('tTut').hidden = !save.tut;
  $('tGo').textContent = save.tut ? 'Go live' : 'Go live (with a quick tutorial)';
  $('tRec').textContent = save.runs ? `${save.runs} stream${save.runs > 1 ? 's' : ''} so far · best peak ${fmt(save.best)} viewers${save.legends ? ` · ${save.legends} legendary` : ''}` : '';
}
$('tGo').onclick = () => { snd.wake(); startRun(!save.tut); };
$('tTut').onclick = () => { snd.wake(); startRun(true); };
$('eAgain').onclick = () => { snd.wake(); startRun(false); };
$('eTitleBtn').onclick = () => toTitle();

function startRun(withTutorial) {
  run = S.newRun();
  paused = false; holdFight = false;
  hypeShown = run.hype; viewersShown = run.viewers; hypeFloat = [];
  D = { hero: { ...run.hero, block: 0 }, foe: null, intent: null };
  chat.clear(); chat.system('Pip went live: "tower run, day 1. keeper be nice"');
  chat.say('idle', 3, {}, 2);
  vis.hero = mkVis(); vis.foe = mkVis();
  show('app'); mode = 'choose';
  if (withTutorial) startTutorial(); else tut = null;
  enterFloor();
}

function enterFloor() {
  mode = 'choose'; sel = -1; ghostKey = null; roomDoodle = null; F = null;
  D.foe = null; D.intent = null; D.hero = { ...D.hero, hp: run.hero.hp, maxHp: run.hero.maxHp, block: 0, str: 0, vuln: 0, weak: 0, poison: 0, thorns: 0, fortify: 0, regrow: 0 };
  vis.hero = mkVis();
  const step = tut && !tut.dead ? tut.floorStep(run.floor) : 0;
  rooms = S.offerRooms(run, step);
  forecasts = rooms.map((r, i) => r.kind === 'monster' ? S.forecast(run.hero, S.makeEnemy(r.key, run.floor), 36, run.seed + run.floor * 7 + i) : null);
  if (run.floor === FLOORS) { chat.system('The top floor. Choose the boss.'); chat.say('pickBoss', 3, { m: 'boss' }); }
  syncTop();
  renderRooms();
  signal('floor' + run.floor);
  if (AUTO) setTimeout(autoPick, 300 / speed);
}

function renderRooms() {
  const dock = $('dock'); dock.textContent = '';
  const row = el('div', 'dockrow'); row.id = 'rooms';
  rooms.forEach((r, i) => {
    const b = el('button', 'room box dust' + (r.kind === 'monster' ? (ENEMIES[r.key].boss ? ' r' : ENEMIES[r.key].elite ? ' p' : '') : r.kind === 'treasure' ? ' y' : ' b'));
    b.dataset.i = i;
    if (tutAllow && r.key !== tutAllow) b.classList.add('off');
    const kind = r.kind === 'monster' ? (ENEMIES[r.key].boss ? 'Boss' : ENEMIES[r.key].elite ? 'Elite' : 'Monster') : r.kind === 'treasure' ? 'Treasure' : 'Event';
    b.innerHTML = `<span class="kind"><span>${kind}</span><span class="k">${i + 1}</span></span>`;
    const c = document.createElement('canvas');
    b.append(c);
    const sk = r.kind === 'monster' ? r.key : r.kind === 'treasure' ? 'chest' : r.key;
    requestAnimationFrame(() => drawThumb(c, sk));
    if (r.kind === 'monster') {
      const en = S.makeEnemy(r.key, run.floor), f = forecasts[i];
      b.append(el('span', 'nm', esc(en.name)));
      const hp = el('span', 'hp', `HP ${en.maxHp}`);
      b.append(hp);
      const mv = el('span', 'moves');
      const seq = [...(en.first ? [en.first] : []), ...en.pattern];
      seq.forEach((m, k) => {
        if (k) mv.append(el('span', 'then', '›'));
        for (const [ic, col, lab] of moveParts(m)) { const s = el('span'); s.append(iconEl(ic, col)); if (lab) s.append(lab); mv.append(s); }
      });
      b.append(mv);
      const death = Math.round(f.death * 100);
      const range = f.hi - f.lo >= 3 ? ` <span style="color:var(--dim)">(${Math.max(0, f.lo)}–${f.hi})</span>` : '';
      const fc = el('span', 'fc', f.mid > 0 ? `Pip loses <b>~${f.mid}</b>${range}` + (death > 0 ? ` <span class="skull">${death}% death</span>` : '') : 'Pip barely notices it');
      b.append(fc);
    } else if (r.kind === 'treasure') {
      b.append(el('span', 'nm', esc(RELICS[r.key].name)));
      b.append(el('span', 'txt', esc(RELICS[r.key].text)));
    } else {
      b.append(el('span', 'nm', esc(EVENTS[r.key].name)));
      b.append(el('span', 'txt', esc(EVENTS[r.key].text)));
    }
    b.onclick = () => pick(i);
    row.append(b);
  });
  dock.append(row);
  const info = el('div'); info.id = 'pickInfo';
  info.innerHTML = `<span class="say">${touch ? 'Tap a room to look closer.' : 'Pick a room for this floor. <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>'}</span>`;
  dock.append(info);
}

function drawThumb(c, key) {
  const r = c.getBoundingClientRect();
  const w = Math.max(40, r.width), h = Math.max(30, r.height);
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = w * dpr; c.height = h * dpr;
  const x = c.getContext('2d');
  const s = sprite(key, 2)[0];
  const sz = Math.min(h * 1.1, w);
  x.drawImage(s, (w - sz) / 2 * dpr, (h - sz) / 2 * dpr + 2, sz * dpr, sz * dpr);
}

function pick(i) {
  if (mode !== 'choose' || paused) return;
  const r = rooms[i];
  if (tutAllow && r.key !== tutAllow) return;
  snd.chalk();
  if (sel === i && !touch) return go();
  sel = i;
  document.querySelectorAll('.room').forEach((b, k) => b.classList.toggle('sel', k === i));
  ghostKey = r.kind === 'monster' ? r.key : r.kind === 'treasure' ? 'chest' : r.key;
  const info = $('pickInfo'); info.textContent = '';
  let say = '';
  if (r.kind === 'monster') {
    const en = S.makeEnemy(r.key, run.floor), f = forecasts[i];
    const seq = [...(en.first ? [en.first] : []), ...en.pattern];
    say = `<b style="color:var(--chalk)">${esc(en.name)}.</b> ${esc(ENEMIES[r.key].blurb)} ${en.first ? 'Opens: ' + moveText(en.first) + '. Then ' : 'It '}${en.pattern.map(moveText).join(', then ')}, and repeats.`;
    if (f.death > 0) say += ` <span style="color:var(--red)">About ${Math.round(f.death * 100)}% of the time, Pip dies here.</span>`;
    void seq;
  } else if (r.kind === 'treasure') say = `<b style="color:var(--chalk)">${esc(RELICS[r.key].name)}.</b> ${esc(RELICS[r.key].text)} Chat likes loot, a little.`;
  else say = `<b style="color:var(--chalk)">${esc(EVENTS[r.key].name)}.</b> ${esc(EVENTS[r.key].text)}`;
  const sp = el('span', 'say', say);
  const btn = el('button', 'btn go box y dust', r.kind === 'monster' ? 'Send it in' : 'Open the door');
  btn.id = 'go';
  btn.onclick = go;
  info.append(sp, btn);
  signal('picked');
}

function go() {
  if (mode !== 'choose' || sel < 0 || paused) return;
  const r = rooms[sel];
  if (tutAllow && r.key !== tutAllow) return;
  tutAllow = null;
  snd.scribble();
  addHype(-S.HYPE.roomDecay);
  resultHype = [{ amt: -S.HYPE.roomDecay, why: 'new floor' }];
  if (r.kind === 'monster') {
    const boss = ENEMIES[r.key].boss;
    chat.say(boss ? 'pickBoss' : 'pickMonster', boss ? 4 : 2, { m: ENEMIES[r.key].name });
    startFight(r.key);
  } else {
    chat.say(r.kind === 'treasure' ? 'pickTreasure' : r.key === 'campfire' ? 'pickCamp' : 'pickEvent', 2);
    const out = S.resolveRoom(run, r);
    addHype(out.hype);
    resultHype.push({ amt: out.hype, why: r.kind === 'treasure' ? 'loot' : r.key === 'campfire' ? 'nap time' : 'spooky' });
    if (out.hurt) { D.hero.hp = run.hero.hp; vis.hero.shake = 1; snd.hurt(false); fxNum(heroX(), groundY() - spriteSize() * 0.9, `-${out.hurt}`, INK.red); }
    if (out.heal) { snd.heal(); fxNum(heroX(), groundY() - spriteSize() * 0.9, `+${out.heal}`, INK.green); }
    if (out.relic) snd.win();
    D.hero.hp = run.hero.hp; D.hero.maxHp = run.hero.maxHp;
    roomDoodle = ghostKey;
    showResult({ title: r.kind === 'treasure' ? 'Treasure!' : EVENTS[r.key].name, lines: out.lines, card: out.card });
  }
  signal('go');
}

// ---------------------------------------------------------------- fights
const DUR = { start: 0.7, intent: 0.3, turn: 0.45, draw: 0.4, play: 0.62, hurt: 0.4, block: 0.3, status: 0.35, heal: 0.4, endturn: 0.3, act: 0.55, tick: 0.35, sleep: 0.5, shuffle: 0.25, dead: 1.3, pillow: 1.2, flee: 0.9, end: 0.5 };

function startFight(key) {
  const enemy = S.makeEnemy(key, run.floor);
  const res = S.fight(run.hero, enemy, run.R.int(1e9));
  F = { res, enemy, i: 0, timer: 0.6, hpStart: run.hero.hp, hype: 0, greedyHits: 0 };
  mode = 'fight'; ghostKey = null;
  D.foe = { hp: enemy.hp, maxHp: enemy.maxHp, block: 0, str: 0, vuln: 0, weak: 0, poison: 0 }; D.foeKey = key; D.intent = null;
  vis.foe = mkVis(); vis.foe.enter = 0;
  renderFightDock();
  if (enemy.boss) snd.bell();
  // the foe's first move is on show straight away
  while (F.i < res.events.length && ['start', 'intent'].includes(res.events[F.i].t)) applyEvent(res.events[F.i++], true);
  signal('fightStart');
}

function renderFightDock() {
  const dock = $('dock'); dock.textContent = '';
  const hand = el('div', 'hand'); hand.id = 'hand';
  const bar = el('div'); bar.id = 'fightBar';
  bar.innerHTML = `<span class="dust">Turn <b id="turnN">1</b></span><span class="energy dust" id="energy"></span>`;
  const sp = el('button', 'btn small dust', ''); sp.id = 'speedBtn'; sp.onclick = cycleSpeed;
  const sk = el('button', 'btn small dust', `Skip fight${touch ? '' : ' <kbd>S</kbd>'}`); sk.id = 'skipBtn'; sk.onclick = skipFight;
  bar.append(sp, sk);
  dock.append(hand, bar);
  syncSpeed();
}
function cycleSpeed() { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; save.speed = speed; persist(); syncSpeed(); }
function syncSpeed() { const b = $('speedBtn'); if (b) b.innerHTML = `Speed ${speed}×${touch ? '' : ' <kbd>F</kbd>'}`; }

function stepFight(dt) {
  if (!F || paused || holdFight) return;
  F.timer -= dt * speed;
  let guard = 0;
  while (F && F.timer <= 0 && guard++ < 50) {
    if (F.i >= F.res.events.length) { finishFight(); return; }
    const e = F.res.events[F.i++];
    applyEvent(e, true);
    F.timer += (DUR[e.t] ?? 0.3) * (e.t === 'hurt' && e.who === 'hero' && e.amt >= 10 ? 1.5 : 1);
  }
}

function skipFight() {
  if (!F || holdFight) return;
  snd.chalk();
  while (F.i < F.res.events.length) applyEvent(F.res.events[F.i++], false);
  finishFight();
}

function heroX() { return stageR.x + stageR.w * 0.27; }
function foeX() { return stageR.x + stageR.w * 0.73; }
function spriteSize() { return Math.min(stageR.h * (stageR.h < 240 ? 0.5 : 0.6), stageR.w * 0.3, 250); }

function applyEvent(e, live) {
  const s = e.s;
  D.hero = { ...D.hero, ...s.hero }; D.foe = { ...D.foe, ...s.foe }; D.intent = s.intent;
  const dh = S.hypeForEvent(e, run.hero.maxHp);
  if (dh) { addHype(dh, live); F.hype += dh; }
  const hx = heroX(), fxx = foeX(), sz = spriteSize(), gy = groundY();
  const topH = gy - sz * 0.95, topF = gy - sz * 0.95 * (CREATURE_SCALE[D.foeKey] || 1);
  if (live) syncHand(e);
  if ($('turnN') && s.turn) $('turnN').textContent = s.turn;
  if ($('energy')) $('energy').textContent = s.turn ? `Energy ${'●'.repeat(Math.max(0, s.hero.energy))}${'○'.repeat(Math.max(0, 3 - s.hero.energy))}` : '';
  if (!live) {
    if (e.t === 'dead') { (e.who === 'hero' ? vis.hero : vis.foe).dead = 1; }
    return;
  }
  switch (e.t) {
    case 'start': chat.system(`Pip vs ${F.enemy.name}`); break;
    case 'play': {
      const c = CARDS[e.card];
      callout = { text: c.name, sub: c.text, color: c.type === 'atk' ? INK.orange : c.type === 'def' ? INK.blue : INK.yellow, life: 0.9 };
      snd.chalk();
      if (c.type === 'atk') vis.hero.lunge = 1;
      if (shininessBig(e.card) && Math.random() < 0.3) chat.say('hypeUp', 1);
      break;
    }
    case 'hurt': {
      const big = e.amt >= 10;
      if (e.who === 'foe') {
        vis.foe.shake = 1; vis.foe.flash = 1;
        if (e.amt > 0) { fxNum(fxx, gy - sz * 0.6, `-${e.amt}`, INK.white, big ? 1.3 : 1); fxSlash(fxx, gy - sz * 0.45); snd.hit(big); }
        if (e.blocked) fxNum(fxx + sz * 0.25, topF + sz * 0.45, `${e.blocked} blocked`, INK.blue, 0.6);
      } else {
        vis.hero.shake = 1; vis.hero.flash = 1;
        if (e.amt > 0) {
          fxNum(hx, gy - sz * 0.6, `-${e.amt}`, INK.red, big ? 1.4 : 1); fxSlash(hx, gy - sz * 0.45);
          snd.hurt(big); shakeAmt = Math.max(shakeAmt, big ? 10 : 4);
          mood(big ? 'ouch' : 'wince', big ? 1.2 : 0.6);
          const frac = s.hero.hp / s.hero.maxHp;
          if (big) {
            const greedy = (s.hero.hp + e.amt) / s.hero.maxHp > 0.5 && e.src === 'foe' && e.blocked === 0;
            if (greedy && F.greedyHits++ < 1) chat.say('greedyHit', 2);
            else chat.say('bigHit', 2 + (big && e.amt > 18 ? 2 : 0));
          }
          if (frac < 0.25 && s.hero.hp > 0) chat.say('lowHp', 1, { hp: s.hero.hp });
          if (e.src === 'poison' && Math.random() < 0.5) chat.say('poison', 1);
        }
        if (e.blocked) fxNum(hx - sz * 0.25, topH + sz * 0.45, `${e.blocked} blocked`, INK.blue, 0.6);
      }
      break;
    }
    case 'block': {
      const v = e.who === 'hero' ? vis.hero : vis.foe; v.block = 1;
      fxNum(e.who === 'hero' ? hx - sz * 0.3 : fxx + sz * 0.3, gy - sz * 0.5, `+${e.amt}`, INK.blue, 0.8);
      snd.clank();
      break;
    }
    case 'status': {
      const good = (e.who === 'hero') === ['str', 'thorns', 'fortify', 'regrow'].includes(e.k);
      fxNum(e.who === 'hero' ? hx : fxx, (e.who === 'hero' ? topH : topF) + 6, `${statusName(e.k)} ${e.k === 'str' ? '+' : ''}${e.amt}`, good ? INK.yellow : INK.lilac, 0.7);
      good ? snd.buff() : snd.debuff();
      if (e.who === 'foe' && e.k === 'str' && Math.random() < 0.6) chat.say('str', 1);
      break;
    }
    case 'heal': {
      fxNum(e.who === 'hero' ? hx : fxx, (e.who === 'hero' ? topH : topF) + 10, `+${e.amt}`, INK.green, 0.9);
      if (e.amt) snd.heal();
      if (e.who === 'hero' && e.amt >= 4 && Math.random() < 0.4) chat.say('heal', 1);
      break;
    }
    case 'act': if (e.move.a) vis.foe.lunge = 1; break;
    case 'sleep': fxNum(fxx, topF, 'z z z', INK.lilac, 0.9); break;
    case 'pillow': fxNum(hx, topH - 10, 'Lucky Pillow!', INK.yellow, 1.1); chat.say('pillow', 3); snd.cheer(0.8); mood('yay', 1.6); break;
    case 'dead':
      if (e.who === 'foe') { vis.foe.dead = 0.001; fxDust(fxx, gy - sz * 0.4, 40); snd.win(); }
      else { vis.hero.dead = 0.001; fxDust(hx, gy - sz * 0.4, 30); snd.die(); snd.groan(); chat.say('death', 7, {}, 1.8); mood('dead', 99); }
      break;
    case 'flee': fxNum(fxx, topF, 'flees!', INK.dim, 1); vis.foe.dead = 0.001; chat.say('dragged', 2); break;
    case 'shuffle': if (Math.random() < 0.15) chat.say('shuffle', 1); break;
  }
}
const shininessBig = id => { const c = CARDS[id]; return (c.dmg || 0) * (c.hits || 1) >= 15; };
const statusName = k => ({ str: 'Strength', weak: 'Weak', vuln: 'Vulnerable', poison: 'Poison', thorns: 'Thorns', fortify: 'Fortify', regrow: 'Regrow' }[k] || k);

// the DOM hand follows the snapshots
function syncHand(e) {
  const hand = $('hand'); if (!hand) return;
  const live = [...hand.children].filter(c => !c.classList.contains('gone') && !c.classList.contains('disc'));
  if (e.t === 'play') {
    const c = live.find(c => c.dataset.id === e.card);
    if (c) { c.classList.add('gone'); setTimeout(() => c.remove(), 380); live.splice(live.indexOf(c), 1); }
  }
  if (e.t === 'endturn' || e.t === 'end' || e.t === 'dead') {
    for (const c of live) { c.classList.add('disc'); setTimeout(() => c.remove(), 380); }
    return;
  }
  const want = {}; for (const id of e.s.hand) want[id] = (want[id] || 0) + 1;
  const have = {};
  for (const c of live) {
    const id = c.dataset.id;
    have[id] = (have[id] || 0) + 1;
    if (have[id] > (want[id] || 0)) { c.remove(); have[id]--; }
  }
  for (const [id, n] of Object.entries(want)) for (let k = have[id] || 0; k < n; k++) hand.append(cardEl(id));
}

function finishFight() {
  const res = F.res, en = F.enemy;
  const hpStart = F.hpStart;
  run.hero.hp = res.hp;
  D.hero.hp = res.hp;
  resultHype.push({ amt: Math.round(F.hype), why: F.hype >= 0 ? 'danger' : 'slow fight' });
  const settle = S.hypeSettle(res, hpStart, run.hero.maxHp, en);
  for (const s of settle) { addHype(s.amt); resultHype.push(s); }
  const lines = [];
  F = null;
  if (!res.won) {
    run.history.push({ floor: run.floor, key: en.key, died: true });
    mode = 'result';
    setTimeout(() => endRun('died', en), 1600);
    return;
  }
  const lost = hpStart - res.hp;
  if (settle.some(s => s.why === 'CLUTCH')) {
    run.clutches++; chat.say('clutch', 8, {}, 2); snd.cheer(1); mood('yay', 2.5);
  } else if ((hpStart - res.minHp) / run.hero.maxHp > 0.25) { chat.say('winHard', 3); snd.cheer(0.5); mood('yay', 1.4); }
  else if (settle.some(s => s.why === 'snooze')) { chat.say('snooze', 4, {}, 1.5); mood('sleepy', 1.5); }
  else chat.say('win', 2);
  if (!run.best || res.minHp < run.best.hp) run.best = { hp: res.minHp, floor: run.floor, name: en.name };
  run.history.push({ floor: run.floor, key: en.key, lost, low: res.minHp });
  lines.push(lost > 0 ? `Pip lost ${lost} HP${res.minHp < res.hp ? ` and dipped to ${res.minHp}` : ''}. ${res.hp}/${run.hero.maxHp} left.`
    : res.dmgTaken > 0 ? `Pip healed back everything she lost. ${res.hp}/${run.hero.maxHp} HP.` : `Pip didn't take a scratch. ${res.hp}/${run.hero.maxHp} HP.`);
  if (res.pillow) lines.push('The Lucky Pillow saved her!');
  // not after the boss: the stream ends on the HP she won with, or the Kettle would undo a Legendary finish
  if (run.hero.relics.includes('kettle') && run.floor < FLOORS) { const b = run.hero.hp; run.hero.hp = Math.min(run.hero.maxHp, run.hero.hp + 6); if (run.hero.hp > b) lines.push(`The Kettle healed ${run.hero.hp - b}.`); D.hero.hp = run.hero.hp; }
  let reward = null;
  if (run.floor < FLOORS) {
    reward = S.cardReward(run);
    if (Math.random() < 0.5) setTimeout(() => chat.say('shiny', 1, { c: CARDS[reward.picked].name }), 900);
  }
  showResult({ title: en.boss ? `Pip beat ${en.name.startsWith('The ') ? 'the ' + en.name.slice(4) : en.name}!` : `Pip beat the ${en.name}`, lines, reward, boss: en.boss, enemy: en });
}

// ---------------------------------------------------------------- results
function showResult({ title, lines, reward, card, boss, enemy }) {
  mode = 'result';
  const dock = $('dock'); dock.textContent = '';
  const box = el('div'); box.id = 'result';
  box.append(el('h2', 'dust', esc(title)));
  const ls = el('div', 'lines dust'); for (const l of lines) ls.append(el('p', '', esc(l))); box.append(ls);
  const hy = el('div', 'hype dust');
  for (const h of resultHype) if (h.amt) hy.append(el('span', h.amt > 0 ? 'up' : 'down', `${h.amt > 0 ? '+' : ''}${h.amt} ${esc(h.why)}`));
  hy.prepend(el('span', '', 'Hype:'));
  box.append(hy);
  if (reward) {
    const rw = el('div', 'reward');
    for (const id of reward.offered) rw.append(cardEl(id, id === reward.picked ? 'pick' : ''));
    box.append(rw);
    box.append(el('p', 'dust', `Pip grabbed <b style="color:var(--yellow)">${esc(CARDS[reward.picked].name)}</b>. Biggest number, obviously.`));
  } else if (card) {
    const rw = el('div', 'reward'); rw.append(cardEl(card, 'pick')); box.append(rw);
  }
  viewersAfter();
  const last = run.floor >= FLOORS;
  const bored = run.hype <= 0;
  const btn = el('button', 'btn go box y dust', last ? 'End the stream' : bored ? 'Uh oh' : `Floor ${run.floor + 1}${touch ? '' : ' <kbd>Enter</kbd>'}`);
  btn.id = 'next';
  btn.onclick = () => {
    if (mode !== 'result') return;
    snd.chalk();
    if (last) return endRun(run.hero.hp <= run.hero.maxHp * 0.1 ? 'legend' : 'top', enemy);
    if (bored) return endRun('bored');
    run.floor++;
    enterFloor();
  };
  box.append(btn);
  dock.append(box);
  if (bored) chat.say('bored', 4);
  else if (run.hype < 22) chat.say('bored', 2);
  signal('result');
  if (AUTO) setTimeout(() => btn.click(), 400 / speed);
}

function viewersAfter() { S.viewersAfter(run); }

function addHype(d, quiet) {
  const before = run.hype;
  run.hype = clamp(run.hype + d, 0, S.HYPE.max);
  const real = run.hype - before;
  if (Math.abs(real) >= 1 && !quiet) hypeFloat.push({ text: `${real > 0 ? '+' : ''}${Math.round(real)}`, color: real > 0 ? INK.yellow : INK.red, life: 1.4 });
}

// ---------------------------------------------------------------- the end
function endRun(outcome, enemy) {
  if (mode === 'end') return;
  mode = 'end';
  closeSheet();
  const f = Math.min(run.floor, FLOORS);
  const peak = run.peak;
  save.runs++; save.best = Math.max(save.best, peak); if (outcome === 'legend') save.legends++;
  persist();
  const T = {
    died: ['Pip died on stream', `${enemy ? (enemy.name.startsWith('The ') ? enemy.name : 'The ' + enemy.name) : 'The tower'} got her on floor ${f}. Chat saw everything.`],
    bored: ['Chat left', `Hype hit zero on floor ${f}. Everyone went to watch someone else.`],
    top: ['Pip made it!', `She beat ${enemy?.name || 'the boss'} with ${run.hero.hp} HP to spare. A solid stream. Finish on 10% or less for a Legendary broadcast.`],
    legend: ['Legendary broadcast', `Pip beat ${enemy?.name || 'the boss'} on ${run.hero.hp} HP. The clip is everywhere.`],
  }[outcome];
  $('eTitle').textContent = T[0];
  $('eTitle').style.color = outcome === 'legend' ? 'var(--yellow)' : outcome === 'top' ? 'var(--green)' : 'var(--red)';
  $('eWhy').textContent = T[1];
  $('eFloor').textContent = f; $('ePeak').textContent = fmt(peak); $('eClutch').textContent = run.clutches;
  $('eMoment').textContent = run.best && run.best.hp < run.hero.maxHp * 0.4 ? `Best moment: floor ${run.best.floor}, the ${run.best.name} had Pip down to ${run.best.hp} HP.` : '';
  if (outcome === 'top' || outcome === 'legend') { chat.say('topRest', 5); snd.cheer(1); }
  setTimeout(() => { $('end').hidden = false; $('eAgain').focus({ preventScroll: true }); }, outcome === 'died' ? 300 : 900);
}

// ---------------------------------------------------------------- effects
function fxNum(x, y, text, color, size = 1) {
  // two labels landing on the same spot in the same beat ("Weak 2" on "Vulnerable 2") stack instead of overprinting
  for (const f of fx) if (f.k === 'num' && f.max - f.life < 0.3 && Math.abs(f.x - x) < 70 && Math.abs(f.y - y) < 14) y -= Math.max(18, 24 * size);
  fx.push({ k: 'num', x: x + (Math.random() - 0.5) * 16, y, text, color, size, life: 1.1, max: 1.1, seed: (Math.random() * 999) | 0 });
}
function fxSlash(x, y) { fx.push({ k: 'slash', x, y, life: 0.35, max: 0.35, seed: (Math.random() * 999) | 0 }); }
function fxDust(x, y, n) { for (let i = 0; i < n; i++) fx.push({ k: 'dust', x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 60, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 60, life: 0.8 + Math.random() * 0.8, max: 1.6 }); }
function mood(m, t) { face.mood = m; face.t = t; }

// ---------------------------------------------------------------- drawing
let last = performance.now(), T = 0;
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05); last = Math.max(last, now);
  try { tick(dt); draw(dt); } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
function tick(dt) {
  T += dt;
  if (mode === 'fight') stepFight(dt);
  chat.tick(dt, run ? 0.25 + run.hype / 160 : 0.2);
  for (const v of [vis.hero, vis.foe]) {
    v.lunge = Math.max(0, v.lunge - dt * 3.2); v.shake = Math.max(0, v.shake - dt * 3); v.flash = Math.max(0, v.flash - dt * 4); v.block = Math.max(0, v.block - dt * 2.5);
    if (v.dead > 0 && v.dead < 1) v.dead = Math.min(1, v.dead + dt * 0.9);
    v.enter = Math.min(1, v.enter + dt * 2.2);
  }
  face.t -= dt; if (face.t <= 0 && face.mood !== 'dead') face.mood = 'calm';
  shakeAmt = Math.max(0, shakeAmt - dt * 30);
  if (callout) { callout.life -= dt * speed * 0.9; if (callout.life <= 0) callout = null; }
  for (const f of fx) { f.life -= dt; if (f.k === 'dust') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 60 * dt; } }
  fx = fx.filter(f => f.life > 0);
  for (const h of hypeFloat) h.life -= dt;
  hypeFloat = hypeFloat.filter(h => h.life > 0);
  if (run) {
    hypeShown += (run.hype - hypeShown) * Math.min(1, dt * 4);
    viewersShown += (run.viewers - viewersShown) * Math.min(1, dt * 2);
    $('viewers').textContent = fmt(Math.round(viewersShown));
  }
}

function draw() {
  if (!$('app').hidden) stageR = rectOf($('stage'));
  buildBg();
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.drawImage(bg, 0, 0);
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const boil = Math.floor(T * 7) % 3;
  if (mode === 'title') { drawTitle(boil); return; }
  if ($('app').hidden) return;
  cx.save();
  if (shakeAmt > 0) cx.translate((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt);
  drawStage(boil);
  cx.restore();
  drawHype(boil);
  drawCam(boil);
  if (tut && tut.ring) drawRing(tut.ring(), boil);
}

function drawSprite(key, x, gy, size, v, boil, flip = false) {
  const frames = sprite(key, DPR > 1 ? 2 : 1.5);
  const img = frames[boil];
  const sc = CREATURE_SCALE[key] || 1;
  const s = size * sc;
  let ox = 0, oy = 0, rot = 0, alpha = 1;
  const dir = key === 'hero' ? 1 : -1;
  if (v) {
    ox += Math.sin(Math.PI * v.lunge) * s * 0.18 * dir;
    if (v.shake) ox += Math.sin(T * 70) * 6 * v.shake;
    if (v.dead > 0) {
      if (key === 'hero') { rot = -v.dead * 1.4; oy = v.dead * s * 0.05; }
      else { alpha = 1 - v.dead; oy = v.dead * s * 0.12; }
    }
    if (v.enter < 1) { alpha *= v.enter; ox += (1 - v.enter) * s * 0.3 * -dir; }
  }
  const bob = Math.sin(T * 2.2 + (key === 'hero' ? 0 : 1.5)) * s * 0.008;
  cx.save();
  cx.globalAlpha = alpha;
  cx.translate(x + ox, gy + oy + bob);
  if (rot) cx.rotate(rot);
  if (flip) cx.scale(-1, 1);
  cx.drawImage(img, -s / 2, -s * 0.95, s, s);
  if (v && v.flash > 0) { cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = v.flash * 0.6 * alpha; cx.drawImage(img, -s / 2, -s * 0.95, s, s); }
  cx.restore();
}

function drawStage(boil) {
  const gy = groundY(), sz = spriteSize(), hx = heroX(), fx2 = foeX();
  const p = new Pen(cx, 300 + boil, { wob: 0.8 });
  // Pip
  drawSprite('hero', hx, gy, sz, vis.hero, boil);
  drawBars(p, hx, gy, sz, D.hero, true);
  // the other side
  if ((mode === 'fight' || (mode === 'result' && D.foeKey && !roomDoodle)) && D.foe) {
    drawSprite(D.foeKey, fx2, gy, sz, vis.foe, boil);
    if (vis.foe.dead < 1) {
      drawBars(p, fx2, gy, sz, D.foe, false);
      // tall foes on a short stage: keep the intent on the board, not up under the hype bar
      if (mode === 'fight' && D.intent && vis.foe.dead === 0) drawIntent(p, fx2, Math.max(stageR.y + 20, gy - sz * 0.95 * (CREATURE_SCALE[D.foeKey] || 1) - 14), D.intent, D.hero);
    }
  } else if (roomDoodle) {
    drawSprite(roomDoodle, fx2, gy, sz * 0.9, null, boil);
  } else if (mode === 'choose') {
    cx.globalAlpha = ghostKey ? 0.45 : 0.8;
    drawSprite(ghostKey || 'door', fx2, gy, sz * (ghostKey ? 1 : 0.9), null, boil);
    cx.globalAlpha = 1;
  }
  // callout: the card Pip just played
  if (callout && mode === 'fight') {
    const a = Math.min(1, callout.life * 4);
    const y = stageR.y + Math.max(26, stageR.h * 0.1);
    cx.globalAlpha = a;
    const big = Math.min(38, stageR.w * 0.07);
    p.text(callout.text, stageR.x + stageR.w / 2, y, big, { color: callout.color, font: 'Cabin Sketch' });
    if (stageR.h > 200) p.text(callout.sub, stageR.x + stageR.w / 2, y + big * 0.85, Math.max(14, big * 0.45), { color: INK.dim, weight: 400 });
    cx.globalAlpha = 1;
  }
  // floaters
  for (const f of fx) {
    const a = Math.min(1, f.life / f.max * 2.5);
    if (f.k === 'num') {
      const age = f.max - f.life;
      const pop = 1 + Math.max(0, 0.35 - age) * 1.5;
      cx.globalAlpha = a;
      new Pen(cx, f.seed).text(f.text, f.x, f.y - age * 34, Math.round(26 * f.size * pop * Math.min(1, sz / 160 + 0.3)), { color: f.color, font: 'Cabin Sketch' });
      cx.globalAlpha = 1;
    } else if (f.k === 'slash') {
      const q = new Pen(cx, f.seed, { color: INK.white, w: 3.5, wob: 0.6 });
      cx.globalAlpha = a;
      const L = sz * 0.35;
      for (let i = -1; i <= 1; i++) q.line(f.x - L + i * 10, f.y - L * 0.6 + i * 12, f.x + L + i * 10, f.y + L * 0.6 + i * 12);
      cx.globalAlpha = 1;
    } else if (f.k === 'dust') {
      cx.globalAlpha = a * 0.7; cx.fillStyle = INK.white; cx.fillRect(f.x, f.y, 2.2, 2.2); cx.globalAlpha = 1;
    }
  }
}

function drawBars(p, x, gy, sz, f, isHero) {
  if (!f) return;
  const w = Math.min(sz * 0.95, 170), h = Math.max(12, Math.min(18, sz * 0.09));
  const x0 = x - w / 2, y0 = gy + Math.max(10, sz * 0.07);
  const frac = clamp(f.hp / f.maxHp, 0, 1);
  const col = isHero ? (frac < 0.25 ? INK.red : frac < 0.5 ? INK.orange : INK.green) : INK.red;
  if (frac > 0) p.hatch([[x0, y0], [x0 + w * frac, y0], [x0 + w * frac, y0 + h], [x0, y0 + h]], { color: col, gap: 3.5, alpha: 0.85, w: 2.2 });
  p.set(INK.white, 2.4).rect(x0, y0, w, h);
  const ts = Math.max(13, Math.min(18, h * 1.1));
  p.text(`${f.hp}/${f.maxHp}`, x, y0 + h + ts * 0.75, ts, { color: INK.white });
  // block shield on the bar's left end
  if (f.block > 0) {
    const bx = x0 - 6, by = y0 + h / 2, r = 13 + (isHero ? vis.hero.block : vis.foe.block) * 4;
    cx.drawImage(icon('def', INK.blue, 30, 2), bx - r, by - r, r * 2, r * 2);
    p.text(String(f.block), bx, by + 1, 13, { color: INK.white });
  }
  // statuses under the numbers
  const st = [];
  if (f.str) st.push(['str', f.str > 0 ? INK.orange : INK.lilac, f.str]);
  if (f.weak) st.push(['weak', INK.lilac, f.weak]);
  if (f.vuln) st.push(['vuln', INK.lilac, f.vuln]);
  if (f.poison) st.push(['poison', INK.green, f.poison]);
  if (f.thorns) st.push(['thorns', INK.yellow, f.thorns]);
  if (f.fortify) st.push(['fortify', INK.blue, f.fortify]);
  if (f.regrow) st.push(['regrow', INK.green, f.regrow]);
  const sy = y0 + h + ts * 1.65;
  let sx = x - st.length * 17 + 8;
  for (const [k, c, n] of st) {
    cx.drawImage(icon(k, c, 20, 2), sx - 9, sy - 9, 18, 18);
    p.text(String(n), sx + 13, sy + 2, 13, { color: c });
    sx += 34;
  }
}

function drawIntent(p, x, y, m, hero) {
  const parts = moveParts(m);
  const bob = Math.sin(T * 3) * 2;
  const n = parts.length;
  let sx = x - (n - 1) * 26;
  for (const [k, c, lab] of parts) {
    let label = lab;
    if (k === 'atk' && D.foe) { // show the real number after strength/weak/vulnerable
      const per = S.intentDamage({ a: m.a }, D.foe, hero);
      label = m.n ? `${per}×${m.n}` : `${per}`;
    }
    cx.drawImage(icon(k, c, 30, 2), sx - 15, y - 16 + bob, 26, 26);
    if (label) p.text(label, sx + 20, y - 3 + bob, 20, { color: c, font: 'Cabin Sketch' });
    sx += 52;
  }
}

function drawHype(boil) {
  const r = rectOf($('hypeBar'));
  if (!r.w) return;
  const p = new Pen(cx, 500 + boil, { wob: 0.7 });
  const frac = clamp(hypeShown / S.HYPE.max, 0, 1);
  const col = frac < 0.2 ? INK.red : frac > 0.8 ? INK.pink : INK.yellow;
  if (frac > 0.005) p.hatch([[r.x, r.y], [r.x + r.w * frac, r.y], [r.x + r.w * frac, r.y + r.h], [r.x, r.y + r.h]], { color: col, gap: 3.4, alpha: 0.9, w: 2.4, angle: -1.1 });
  p.set(INK.white, 2.4).rect(r.x, r.y, r.w, r.h);
  if (frac < 0.2 && Math.floor(T * 2) % 2) p.text('chat is leaving', r.x + r.w * 0.6, r.y + r.h / 2 + 1, Math.min(16, r.h * 0.8), { color: INK.red, weight: 700 });
  if (frac > 0.8) p.text('on fire', r.x + r.w * 0.45, r.y + r.h / 2 + 1, Math.min(16, r.h * 0.8), { color: '#1d2420', weight: 700 });
  hypeFloat.forEach((h, i) => {
    cx.globalAlpha = Math.min(1, h.life * 2);
    p.text(h.text, r.x + r.w * frac, r.y + r.h + 12 + (1.4 - h.life) * 10 + i * 4, 18, { color: h.color, font: 'Cabin Sketch' });
    cx.globalAlpha = 1;
  });
}

function drawCam(boil) {
  const c = $('camCv');
  const r = c.getBoundingClientRect();
  if (!r.width) return;
  const w = Math.round(r.width * DPR), h = Math.round(r.height * DPR);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const x = c.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h);
  const LH = 120, LW = LH * r.width / r.height;
  x.scale(h / LH, h / LH);
  x.fillStyle = 'rgba(10,14,12,.35)'; x.fillRect(4, 4, LW - 8, LH - 8);
  const p = new Pen(x, 700 + boil, { wob: 0.9 });
  p.set('#7d8a82', 2.2).rect(5, 5, LW - 10, LH - 10);
  // Pip's face
  const cxF = LW / 2, cyF = 70, R = 34;
  const m = face.mood;
  const hp = D ? D.hero.hp / D.hero.maxHp : 1;
  const jitter = m === 'ouch' ? Math.sin(T * 50) * 2 : 0;
  p.set(INK.white, 2.8).circle(cxF + jitter, cyF, R);
  p.set(INK.pink, 2.6).curve([[cxF, cyF - R], [cxF - 6, cyF - R - 18], [cxF + 10, cyF - R - 26], [cxF + 22, cyF - R - 16]]);
  p.set(INK.blue, 2.4).line(cxF - R + 3, cyF - 12, cxF + R - 3, cyF - 13);
  const ex = 13, ey = cyF - 2;
  p.set(INK.white, 2.4);
  if (m === 'dead') { for (const s of [-1, 1]) { p.line(cxF + s * ex - 5, ey - 5, cxF + s * ex + 5, ey + 5); p.line(cxF + s * ex + 5, ey - 5, cxF + s * ex - 5, ey + 5); } }
  else if (m === 'yay') { for (const s of [-1, 1]) p.path([[cxF + s * ex - 6, ey + 2], [cxF + s * ex, ey - 5], [cxF + s * ex + 6, ey + 2]]); }
  else if (m === 'sleepy') { for (const s of [-1, 1]) p.line(cxF + s * ex - 6, ey + 1, cxF + s * ex + 6, ey + 1); }
  else if (m === 'ouch' || m === 'wince') { p.path([[cxF - ex - 6, ey - 4], [cxF - ex + 4, ey], [cxF - ex - 6, ey + 4]]); p.path([[cxF + ex + 6, ey - 4], [cxF + ex - 4, ey], [cxF + ex + 6, ey + 4]]); }
  else { const big = hp < 0.3 ? 4.5 : 3; p.dot(cxF - ex + jitter, ey, big); p.dot(cxF + ex + jitter, ey, big); }
  const my = cyF + 16;
  if (m === 'yay') p.curve([[cxF - 14, my - 3], [cxF, my + 9], [cxF + 14, my - 3]]);
  else if (m === 'dead' || m === 'ouch') p.ellipse(cxF, my + 2, 7, 9);
  else if (m === 'sleepy') { p.line(cxF - 7, my + 2, cxF + 7, my + 2); p.text('z', cxF + R + 6, cyF - R + 6, 16, { color: INK.lilac }); }
  else if (hp < 0.3) p.path([[cxF - 12, my + 4], [cxF - 6, my], [cxF, my + 4], [cxF + 6, my], [cxF + 12, my + 4]]);
  else if (hp < 0.55) p.line(cxF - 10, my + 2, cxF + 10, my + 1);
  else p.curve([[cxF - 11, my], [cxF, my + 5], [cxF + 11, my]]);
  if (hp < 0.35 && m !== 'dead') p.set(INK.blue, 2).curve([[cxF + R - 4, cyF - 18], [cxF + R - 8, cyF - 8], [cxF + R - 2, cyF - 6], [cxF + R - 4, cyF - 18]]);
  if (m === 'dead') { p.set(INK.blue, 2).line(cxF - ex, ey + 8, cxF - ex - 2, ey + 22); p.line(cxF + ex, ey + 8, cxF + ex + 2, ey + 22); }
  // mic
  p.set(INK.dim, 2.4).line(cxF + R + 2, cyF + 30, cxF + 18, my + 2); p.circle(cxF + 16, my + 3, 4);
  // overlay text
  x.fillStyle = INK.red; x.beginPath(); x.arc(16, 17, 4.5, 0, 6.29); x.globalAlpha = Math.floor(T * 1.4) % 2 ? 0.4 : 1; x.fill(); x.globalAlpha = 1;
  p.text('LIVE', 24, 18, 14, { color: INK.red, align: 'left' });
  p.text('pip_plays', 12, LH - 15, 14, { color: INK.dim, align: 'left', weight: 400 });
  if (run) p.text(`${D.hero.hp} HP`, LW - 12, LH - 15, 15, { color: hp < 0.25 ? INK.red : INK.white, align: 'right' });
}

function drawRing(r, boil) {
  if (!r) return;
  const p = new Pen(cx, 900 + boil, { color: INK.yellow, w: 3, wob: 1.6 });
  cx.globalAlpha = 0.85 + Math.sin(T * 5) * 0.15;
  p.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2 + 14, r.h / 2 + 12);
  cx.globalAlpha = 1;
}

function drawTitle(boil) {
  const sp = document.querySelector('#title .spacer');
  const r = rectOf(sp);
  const gy = r.y + r.h * 0.96, sz = Math.min(r.h * 0.75, 170, W * 0.9 / 5 * 1.45);   // narrow phones: don't pile the cast on top of each other
  const keys = ['bats', 'mimic', 'hero', 'brute', 'eye'];
  const span = Math.min(W * 0.9, sz * 5.4);
  keys.forEach((k, i) => {
    const x = W / 2 + (i - 2) * span / 5;
    cx.globalAlpha = k === 'hero' ? 1 : 0.55;
    drawSprite(k, x, gy, k === 'hero' ? sz * 0.9 : sz * 0.8, null, (boil + i) % 3, false);
  });
  cx.globalAlpha = 1;
  const p = new Pen(cx, 40 + boil, { color: 'rgba(242,239,230,.5)', w: 2.6 });
  p.line(W / 2 - span / 2, gy + 4, W / 2 + span / 2, gy + 6);
}

// ---------------------------------------------------------------- keyboard
addEventListener('keydown', e => {
  if (e.repeat && e.key !== 'f') return;
  const k = e.key.toLowerCase();
  if (k === 'm') { $('sndBtn').click(); return; }
  if (!$('sheet').hidden) { if (k === 'escape' || k === 'enter' || k === ' ') { e.preventDefault(); closeSheet(); } return; }
  if (!$('coach').hidden && !$('coachNext').hidden && (k === 'enter' || k === ' ')) { e.preventDefault(); $('coachNext').click(); return; }
  if (!$('blocker').hidden) return;   // the coach is talking: no picking rooms or opening the deck behind it
  if (mode === 'title' && (k === 'enter' || k === ' ') && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); $('tGo').click(); return; }
  if (mode === 'choose') {
    if (['1', '2', '3'].includes(k)) { const b = document.querySelector(`.room[data-i="${+k - 1}"]`); if (b && !b.classList.contains('off')) pick(+k - 1); }
    if ((k === 'enter' || k === ' ') && sel >= 0 && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); go(); }
  }
  if (mode === 'fight') { if (k === 'f') cycleSpeed(); if (k === 's') skipFight(); }
  if (mode === 'result' && (k === 'enter' || k === ' ') && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); $('next')?.click(); }
  if (k === 'd' && run && mode !== 'end') openSheet();
});

// ---------------------------------------------------------------- tutorial
const waiters = {};
function signal(name) { const w = waiters[name]; if (w) { delete waiters[name]; w.forEach(f => f()); } }
const sig = name => new Promise(res => (waiters[name] = waiters[name] || []).push(res));

function startTutorial() {
  tut = { dead: false, ring: null, floorStep: f => (f === 1 ? 1 : f === 2 ? 2 : 0) };
  const T0 = tut;
  const alive = () => { if (T0.dead || tut !== T0) throw new Error('skip'); };
  const target = sel => () => { const e = document.querySelector(sel); if (!e) return null; const r = rectOf(e); return r.w ? r : null; };
  const coach = (text, ringFn, { button = 'Next', hint = '', side = '' } = {}) => new Promise(res => {
    alive();
    T0.ring = ringFn; T0.side = side;
    const c = $('coach');
    $('coachText').innerHTML = text;
    $('coachHint').textContent = hint;
    $('coachNext').hidden = !button; $('coachNext').textContent = button || '';
    $('blocker').hidden = !button;
    c.hidden = false;
    placeCoach();
    $('coachNext').onclick = () => { snd.chalk(); c.hidden = true; $('blocker').hidden = true; T0.ring = null; res(); };
    T0.resolveWait = () => { c.hidden = true; T0.ring = null; res(); };
    if (button) $('coachNext').focus({ preventScroll: true });
  });
  T0.place = () => {};
  (async () => {
    try {
      await sig('floor1'); alive();
      await coach('Pip is climbing your tower, live on stream. You are the <b>Keeper</b>: you decide what waits behind every door.', () => { const sz = spriteSize(); return { x: heroX() - sz * 0.35, y: groundY() - sz, w: sz * 0.7, h: sz * 1.2 }; }, { side: 'right' });
      await coach('This is the <b>hype</b>. When Pip is in real danger it climbs. Easy fights and naps drain it. If it runs out, chat leaves and the stream is over.', target('#hypeBox'));
      tutAllow = 'rat'; renderRooms();
      const w1 = coach('Each floor you play one of three rooms. Under each monster is a guess at what it will cost Pip. Start gentle: pick the <b>Gutter Rat</b>.', target('.room[data-i="0"]'), { button: '', hint: touch ? 'Tap the rat' : 'Click the rat' });
      await sig('picked'); T0.resolveWait(); await w1; alive();
      const w2 = coach('Read it over, then send it in.', target('#go'), { button: '', hint: '', side: 'top' });
      await sig('fightStart'); T0.resolveWait(); await w2; alive();
      holdFight = true;
      await coach('Above the rat is its next move: a bite for 5. Pip plays her own cards. You just watch, and plan the next floor.', () => { const sz = spriteSize(); return { x: foeX() - 50, y: groundY() - sz * 0.95 - 36, w: 100, h: 40 }; }, { button: 'Watch', side: 'above' });
      holdFight = false;
      await sig('result'); alive();
      const bored = run.hype < S.HYPE.start - 4;
      await coach(bored ? 'Pip barely got scratched, so chat got bored and the hype dropped. You want close calls, not walkovers.' : 'Not bad. Hype rises when Pip gets hurt and drops on walkovers. You want close calls, not walkovers.', target('#hypeBox'));
      $('next').focus({ preventScroll: true });
      await sig('floor2'); alive();
      tutAllow = 'bones'; renderRooms();
      const habitsVisible = $('habits').offsetParent !== null;
      await coach('Pip has <b>habits</b> you can use. Above half HP she never blocks. Every card goes into hitting.', habitsVisible ? target('#habits') : target('#pipBtn'));
      const w3 = coach('The <b>Bone Lad</b> swings for 11, and greedy Pip won\'t put a shield up. Send it in.', target('.room[data-i="0"]'), { button: '', hint: touch ? 'Tap the Bone Lad' : 'Click the Bone Lad' });
      await sig('picked'); T0.resolveWait(); await w3; alive();
      const w4 = coach('Send it in.', target('#go'), { button: '', side: 'top' });
      await sig('fightStart'); T0.resolveWait(); await w4; alive();
      await sig('result'); alive();
      await coach('Real hits, real hype. But Pip\'s HP doesn\'t come back by itself. <b>Campfires</b> heal her and <b>treasure</b> makes her stronger. If she dies, the stream dies.', () => { const sz = spriteSize(); return { x: heroX() - sz * 0.5, y: groundY(), w: sz, h: sz * 0.3 }; });
      await coach('Floor 15 is a boss you choose. Get Pip to the top. Arrive on almost no HP for a <b>Legendary broadcast</b>. Over to you, Keeper.', target('#floorBox'), { button: 'Let\'s go' });
      endTutorial();
    } catch (e) { if (e.message !== 'skip') console.error(e); }
  })();
}
function endTutorial() {
  if (!tut) return;
  tut.dead = true; tut.ring = null; tut = null; tutAllow = null; holdFight = false;
  $('coach').hidden = true; $('blocker').hidden = true;
  save.tut = true; persist();
  if (mode === 'choose') renderRooms();
}
$('coachSkip').onclick = () => { endTutorial(); };

function placeCoach() {
  const c = $('coach');
  if (c.hidden) return;
  if (!$('app').hidden) stageR = rectOf($('stage'));   // the first coach can open before a frame has measured the stage
  const r = tut && tut.ring ? tut.ring() : null;
  const cw = c.offsetWidth, ch = c.offsetHeight;
  let x = W / 2 - cw / 2, y = H * 0.3;
  if (r && tut.side === 'above' && r.y - ch - 24 > 8) {
    y = r.y - ch - 24; x = clamp(r.x + r.w / 2 - cw / 2, 8, W - cw - 8);
  } else if (r && tut.side === 'above') {
    // no room above (a phone held sideways): sit over the empty hand, not on the monster being pointed at
    y = H - ch - 8; x = clamp(stageR.x + stageR.w / 2 - cw / 2, 8, W - cw - 8);
  } else if (r && tut.side === 'top') {
    // pointing at the Send button: stay up on the stage so the room's write-up can be read
    y = stageR.y + 6; x = clamp(stageR.x + stageR.w / 2 - cw / 2, 8, W - cw - 8);
  } else if (r && tut.side === 'right' && r.x + r.w + 30 + cw < W) {
    x = r.x + r.w + 30; y = clamp(r.y + r.h / 2 - ch / 2, 8, H - ch - 8);
  } else if (r) {
    const below = r.y + r.h + 24, above = r.y - ch - 24;
    if (below + ch < H - 8) y = below; else if (above > 8) y = above; else y = clamp(r.y + r.h / 2 - ch / 2, 8, H - ch - 8);
    x = clamp(r.x + r.w / 2 - cw / 2, 8, W - cw - 8);
    // don't sit on top of the thing we point at
    if (y < r.y + r.h && y + ch > r.y) { x = r.x + r.w + 24 + cw < W ? r.x + r.w + 24 : Math.max(8, r.x - cw - 24); }
  }
  c.style.left = x + 'px'; c.style.top = clamp(y, 8, H - ch - 8) + 'px';
}
setInterval(placeCoach, 250);
addEventListener('resize', () => setTimeout(placeCoach, 50));

// ---------------------------------------------------------------- auto keeper (testing) and demo
function autoPick() {
  if (mode !== 'choose') return;
  const h = run.hero, frac = h.hp / h.maxHp;
  let best = 0, bv = -1e9;
  rooms.forEach((r, i) => {
    let v;
    if (r.kind === 'monster') { const f = forecasts[i]; const dip = f.mid / h.maxHp; v = dip * 100 - f.death * 260 + (run.hype < 25 ? dip * 80 : 0); if (run.floor === FLOORS) v = -f.death * 100; }
    else if (r.key === 'campfire') v = frac < 0.45 ? 40 : frac < 0.65 ? 12 : -10;
    else if (r.kind === 'treasure') v = run.hype > 40 ? 18 : 2;
    else v = run.hype > 45 ? 8 : 0;
    if (tutAllow && r.key !== tutAllow) v = -1e9;
    if (v > bv) { bv = v; best = i; }
  });
  pick(best); setTimeout(go, 200 / speed);
}

function demo() {
  run = S.newRun(4242);
  run.floor = 9; run.hype = 81; run.viewers = 2140; run.peak = 2140; hypeShown = 81; viewersShown = 2140;
  run.hero = { hp: 38, maxHp: 70, deck: ['strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'bonk', 'heavy', 'reckless', 'flurry', 'brace', 'rage', 'wild'], relics: ['kettle', 'plum'] };
  D = { hero: { ...run.hero, block: 0 }, foe: null, intent: null };
  show('app'); mode = 'choose';
  const msgs = [['hi chat', 0], ['W stream', 0], ['clip it', 0], ['she\'s on 9', 0], ['CLUTCH', 0], ['WE\'RE SO BACK', 0], ['GG', 0], ['she never blocks lol', 0], ['pipHype pipHype pipHype', 0], ['keeper is evil lol', 0], ['oh this will hurt', 0], ['the brute??', 0], ['hands sweating', 0], ['send it', 0]];
  for (const [m] of msgs) chat.post({ text: m });
  rooms = [{ kind: 'monster', key: 'brute' }];
  syncTop();
  speed = 1;
  startFight('brute');
  // jump into turn 2, to the moment one of Pip's cards lands, and hold there for the screenshot
  let lastPlay = 'strike', hit = null;
  while (F.i < F.res.events.length) {
    const e = F.res.events[F.i++];
    applyEvent(e, true);
    if (e.t === 'play') lastPlay = e.card;
    if (e.t === 'hurt' && e.who === 'foe' && e.s.turn >= 2 && e.s.hand.length >= 2) { hit = e; break; }
  }
  holdFight = true;
  const c = CARDS[lastPlay];
  callout = { text: c.name, sub: c.text, color: INK.orange, life: 1e9 };
  setTimeout(() => { // once the stage has been measured
    fx = [];
    fxNum(foeX(), groundY() - spriteSize() * 0.58, `-${hit ? hit.amt : 6}`, INK.white, 1.3);
    fxSlash(foeX(), groundY() - spriteSize() * 0.45);
    for (const f of fx) f.life = f.max = 1e9;
  }, 120);
}

// ---------------------------------------------------------------- go
window.sk = { get run() { return run; }, get mode() { return mode; }, get F() { return F; }, S, pick, go, skipFight, endRun, signal, setSpeed: v => { speed = v; } };

(async () => {
  try { await Promise.race([Promise.all([document.fonts.load('700 20px Kalam'), document.fonts.load('700 20px "Cabin Sketch"')]), new Promise(r => setTimeout(r, 2500))]); } catch {}
  if (Q.has('speed')) speed = +Q.get('speed') || 1;
  if (DEMO) demo();
  else if (AUTO) { save.tut = true; startRun(false); }
  else toTitle();
  requestAnimationFrame(frame);
})();
