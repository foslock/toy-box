// Kingdom: the page. Owns the house (dynasty.js) and the life being lived (game.js), the map (render.js), and
// everything you read and touch: the story panel with its two ways, fights and shops, the stats along the top, the
// title, a new player's intro and first-choice walkthrough, each new heir's card, a fate, the summons and the
// crowning, the Tome and the Bloodline. Saves to this browser after every step.
import { View, armsColour, tinct, worldOf as spotOf } from './render.js';
import { newHouse, beginLife, resumeLife, endLife, worldOf, legacyLevel, legacyCost, buyLegacy, inheritanceOf } from './dynasty.js';
import { TUTORIAL_EVENT } from './events/index.js';
import { RELICS, TRAITS, ALLIES, ITEMS, FOES, LEGACY, REALMS, JOURNEY, CROWN_ROW, PROCESSION, VIRTUES, isCurse, DEEDS_PER_STEP, ROYAL_TREASURY } from './rules.js';
import { icon } from './icons.js';
import { hero as heroArt, foe as foeArt } from './figures.js';
import { Sound } from './sound.js';
import { Coach } from './coach.js';
import { makePlayer, playLife } from './autoplay.js';
import { D, gridOf } from './world.js';
import { title as titleOf } from './names.js';
import { winChance, priceFor } from './worth.js';
import { rng, clamp } from './util.js';
import { Px } from './paint.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo');
const KEY = 'kingdom.save';
const TOUCH = matchMedia('(pointer: coarse)').matches;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const sleep = ms => new Promise(r => setTimeout(r, REDUCED ? Math.min(ms, 120) : ms));
const roman = n => { const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };
const REGION = { farm: 'The Farmlands', wood: 'The Greenwood', fen: 'The Fens', hills: 'The Highlands', moor: 'The Barrow Moors', lake: 'The Lakelands', waste: 'The Scorched Waste', snow: 'The Frostmarch', crown: 'The Crownlands', city: 'The Royal City' };
const VIRTUE_ICON = { mercy: 'saints_ward', justice: 'merchants', might: 'power', generosity: 'gold', piety: 'church', splendor: 'claim', cunning: 'guild', love: 'hp' };
const SHOP_NAME = { market: 'The Market', smith: 'The Smithy', temple: 'The Temple', witch: 'The Witch’s Shelves', fence: 'The Fence' };
const FATE_WORD = { killed: 'Slain', starved: 'Starved', broke: 'Ruined', reaper: 'Taken', lost: 'Uncrowned', crowned: 'Crowned' };

/* ---------- saving ---------- */
let house, life, ui = { tut: {}, sound: true, music: true };
function load() { try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function save() {
  if (DEMO) return;
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, house, life: life && !life.fate ? life.toJSON() : null, ui })); } catch { /* storage full or blocked: it just won't keep */ }
}

/* ---------- the map ---------- */
const view = new View($('c'));
const sound = new Sound();
const coach = new Coach($('coachHand'), $('coachTap'));
let world;
function setHouse(h) { house = h; world = worldOf(h); view.setHouse(h, world); }

/* ---------- the stats along the top ---------- */
const STAT_TIPS = {
  hp: ['Health', 'At nothing, this life ends.'], food: ['Food', 'You eat a loaf every step. With none, you starve a little each step.'],
  gold: ['Gold', 'Buys arms, food and favours. A debt you can’t pay ends in the debtors’ gaol.'], power: ['Power', 'Your side of every fight, before the dice: 1, plus your arms and armour.'],
  renown: ['Renown', 'How widely your name is known. It counts when you reach for the crown.'], sight: ['Foresight', 'Spend one to see how each way bodes.'],
  claim: ['Claim to the throne', 'Your standing in the fight for the crown. If it falls to nothing, the crown is lost.'],
};
let shown = {};
function stat(id, value, extra = '', cls = '') {
  const el = document.createElement(id === 'sight' ? 'button' : 'div');
  el.className = 'chip leather' + (cls ? ' ' + cls : ''); el.dataset.stat = id;
  if (id === 'sight') { el.type = 'button'; el.onclick = () => foresee(); }
  el.append(icon(id === 'hp' ? 'hp' : id, 1.5));
  const b = document.createElement('b'); b.textContent = value; el.append(b);
  if (extra) { const s = document.createElement('small'); s.textContent = extra; el.append(s); }
  const [n, d] = STAT_TIPS[id]; tipOn(el, n, d);
  el.setAttribute('aria-label', `${n}: ${value}${extra}`);
  return el;
}
function renderHUD(anim = true) {
  const hud = $('hud');
  if (!life || life.fate && life.fate.kind !== 'crowned') { hud.hidden = true; return; }
  hud.hidden = false;
  const st = $('stats'); st.textContent = '';
  const now = { hp: life.hp, food: life.food, gold: life.gold, power: life.power, renown: life.renown, sight: life.sight, claim: life.claim };
  st.append(stat('hp', `${life.hp}`, `/${life.maxHp}`, life.hp <= 2 ? 'low' : ''));
  st.append(stat('food', life.food, '', life.food <= 1 && life.phase === 'journey' ? 'low' : ''));
  st.append(stat('gold', life.gold));
  st.append(stat('power', life.power));
  st.append(stat('renown', life.renown));
  if (life.phase === 'succession') st.append(stat('claim', life.claim, '', 'claim' + (life.claim <= 1 ? ' low' : '')));
  const sight = stat('sight', life.sight);
  sight.disabled = !(life.sight > 0 && life.cur && !life.cur.omens && mode === 'event');
  st.append(sight);
  if (anim) for (const [k, v] of Object.entries(now)) {
    const was = shown[k];
    if (was != null && v !== was) {
      const el = st.querySelector(`[data-stat="${k}"]`);
      if (el) { el.classList.add(v > was ? 'bump' : 'hurt'); const d = document.createElement('span'); d.className = 'delta ' + (v > was ? 'up' : 'down'); d.textContent = (v > was ? '+' : '') + (v - was); el.append(d); }
    }
  }
  shown = now;
  // the bag: relics, blessings and curses, allies
  const bag = $('bag'); bag.textContent = '';
  const add = (id, cls, name, kind, blurb, used) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = cls + (used ? ' used' : ''); b.append(icon(id, 1.6));
    b.setAttribute('aria-label', `${name}: ${blurb}`); tipOn(b, name, (used ? '(Spent) ' : '') + blurb, kind);
    if (newBits.has(id)) b.classList.add('new');
    bag.append(b);
  };
  add(life.weapon, 'gear', ITEMS[life.weapon].name, 'Weapon', `+${ITEMS[life.weapon].power} power.`);
  if (life.armor !== 'rags') add(life.armor, 'gear', ITEMS[life.armor].name, 'Armour', `+${ITEMS[life.armor].power} power.`);
  for (const r of life.relics) add(r.id, 'relic', RELICS[r.id].name, `Relic · ${RELICS[r.id].tier}`, RELICS[r.id].blurb + (r.id === 'dragon_egg' && life.egg > 0 ? ` (${life.egg} steps to go.)` : ''), r.used);
  for (const t of life.traits) add(t, TRAITS[t].kind, TRAITS[t].name, TRAITS[t].kind === 'curse' ? 'Curse' : TRAITS[t].kind === 'mixed' ? 'Blessing and curse' : 'Blessing', TRAITS[t].blurb + (t === 'reaper' && life.reaper ? ` (${life.reaper} steps left.)` : ''));
  for (const a of life.allies) add(a, 'ally', ALLIES[a].name, 'Ally', ALLIES[a].blurb);
  newBits.clear();
  requestAnimationFrame(measure);
}
const newBits = new Set();
// Tooltips for the stats and the bag, on hover or a tap.
let tipFor = null;
function tipOn(el, name, blurb, kind = '') {
  const show = () => { const t = $('tip'); t.innerHTML = `<b>${esc(name)}</b>${kind ? `<i>${esc(kind)}</i>` : ''}${esc(blurb)}`; t.hidden = false; const r = el.getBoundingClientRect(); const w = t.offsetWidth; t.style.left = clamp(r.left + r.width / 2 - w / 2, 8, innerWidth - w - 8) + 'px'; t.style.top = (r.bottom + 8) + 'px'; tipFor = el; };
  el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') show(); });
  el.addEventListener('pointerleave', () => { $('tip').hidden = true; });
  el.addEventListener('click', () => { if (el.dataset.stat === 'sight' && !el.disabled) return; if (tipFor === el && !$('tip').hidden) { $('tip').hidden = true; } else show(); });
}
addEventListener('pointerdown', e => { if (tipFor && !tipFor.contains(e.target)) $('tip').hidden = true; }, true);

/* ---------- the story panel ---------- */
let mode = 'title';
const panel = $('panel');
function setPanel(html) { panel.innerHTML = html; panel.classList.remove('away'); panel.scrollTop = 0; requestAnimationFrame(measure); }
function hidePanel() { panel.classList.add('away'); requestAnimationFrame(measure); }
function measure() {
  // offsetHeight, not the box on screen: the panel may still be sliding in
  const bottom = panel.classList.contains('away') ? 0 : panel.offsetHeight + parseFloat(getComputedStyle(panel).bottom) + 8;
  const hud = $('hud').hidden ? 60 : $('hud').getBoundingClientRect().bottom + 6;
  view.inset = { top: hud, bottom };
  document.documentElement.style.setProperty('--panel-h', bottom + 'px');
}
addEventListener('resize', () => { view.resize(); measure(); });

function kicker() {
  const R = REALMS[life.realm.type];
  const where = REGION[world.at(life.row, life.col)?.biome] || '';
  const step = life.phase === 'journey' ? `Step ${life.row + 1} of ${JOURNEY}` : life.phase === 'succession' ? `The crown · ${life.row - JOURNEY + 1} of 5` : `The procession · ${life.row - CROWN_ROW + 1} of ${PROCESSION}`;
  return `<p class="kicker"><span>${step}</span><span class="realm">${esc(R.name)}</span><span>${esc(where)}</span></p>`;
}
function optionDetail(dir) {
  const opt = life.option(dir), cur = life.cur, s = life.state(), bits = [];
  if (cur.hidden === dir) return '<small>Lost in the mist</small>';
  const lock = life.locks()[dir];
  if (lock) bits.push(`<span>${esc(lock)}</span>`);
  if (opt.cost) { const p = priceFor(opt.cost, s); bits.push(`<span class="cost${life.gold < p ? ' poor' : ''}">${p} gold</span>`); }
  if (opt.fight) {
    const f = opt.fight, realm = REALMS[life.realm.type];
    bits.push(`<span class="fight">⚔ ${esc(life.fill(f.name))} · ${f.power + (realm.foePower || 0)}</span>`);
  }
  if (opt.shop) bits.push(`<span>${esc(SHOP_NAME[opt.shop])}</span>`);
  if (opt.odds) {
    const o = opt.odds, lean = [];
    if (o.claim) lean.push('claim'); if (o.renown) lean.push('renown'); if (o.power) lean.push('power');
    for (const a of Object.keys(o.ally || {})) lean.push(life.allies.includes(a) ? `<b>${esc(ALLIES[a].name)}</b>` : `<span style="opacity:.55">${esc(ALLIES[a].name)}</span>`);
    for (const r of Object.keys(o.relic || {})) if (life.owns(r)) lean.push(`<b>${esc(RELICS[r].name)}</b>`);
    for (const t of Object.keys(o.trait || {})) if (life.trait(t)) lean.push(`<b>${esc(TRAITS[t].name)}</b>`);
    if (o.talk && life.trait('silver_tongue')) lean.push('<b>your silver tongue</b>');
    if (lean.length) bits.push(`<span>Leans on ${lean.join(', ')}</span>`);
  }
  if (cur.omens) { const o = cur.omens[dir]; bits.push(`<span class="omen ${o}">${o === 'good' ? 'Fair omen' : o === 'ill' ? 'Ill omen' : 'Clouded'}</span>`); }
  return bits.length ? `<small>${bits.join('')}</small>` : '';
}
function renderEvent() {
  mode = 'event';
  life.present();
  const ev = life.event, cur = life.cur, lock = life.locks();
  const side = dir => {
    const opt = dir === 'L' ? ev.left : ev.right, hidden = cur.hidden === dir;
    return `<button type="button" class="choice ${dir}${lock[dir] ? ' locked' : ''}${hidden ? ' hidden' : ''}" data-dir="${dir}" ${lock[dir] ? 'disabled aria-disabled="true"' : ''}>
      <b>${hidden ? 'A path lost in the mist' : esc(life.fill(opt.label))}</b>${optionDetail(dir)}</button>`;
  };
  const tools = [];
  if (life.sight > 0 && !cur.omens) tools.push(`<button type="button" class="btn" data-act="foresee">Foresee (${life.sight} left)</button>`);
  if (life.phase === 'journey' && life.relics.some(r => r.id === 'boots' && !r.used)) tools.push(`<button type="button" class="btn" data-act="stride">Seven-League Boots</button>`);
  setPanel(`${kicker()}<h2>${esc(life.fill(ev.title))}</h2><p class="text">${esc(life.fill(ev.text))}</p>
    <div class="choices">${side('L')}${side('R')}</div><div class="tools">${tools.join('')}</div>`);
  for (const b of panel.querySelectorAll('.choice')) {
    b.onclick = () => choose(b.dataset.dir);
    b.onpointerenter = () => { view.hover = b.dataset.dir; };
    b.onpointerleave = () => { view.hover = null; };
    b.onfocus = () => { view.hover = b.dataset.dir; };
  }
  panel.querySelector('[data-act="foresee"]')?.addEventListener('click', foresee);
  panel.querySelector('[data-act="stride"]')?.addEventListener('click', stride);
  view.showOptions(life);
  view.focus(life.row + .5, life.col);
  view.pan = { x: 0, y: 0 };
  sound.rise();
  renderHUD(false);
  coachFor('event');
}
function foresee() {
  if (mode !== 'event' || !life.foresee()) return;
  sound.relic();
  save();
  renderEvent();
  view.showOptions(life); for (const o of Object.values(view.opts)) o.t = 1;
}

/* ---------- choosing ---------- */
let busy = false;
async function choose(dir) {
  if (mode !== 'event' || busy) return;
  if (life.locks()[dir]) { toast(life.locks()[dir]); return; }
  busy = true; mode = 'busy';
  sound.pick();
  if (guideAt >= 0) { $('guide').hidden = true; coach.stop(); }
  for (const b of panel.querySelectorAll('.choice')) { b.disabled = true; b.classList.add(b.dataset.dir === dir ? 'picked' : 'faded'); }
  panel.querySelector('.tools')?.remove();
  if (coach.g) coach.stop();
  const before = snapshot();
  const res = life.choose(dir);
  // keep just the way taken lit while your heir walks there
  if (view.opts) { const keep = view.opts[dir]; keep.t = 1; keep.hidden = false; keep.theme = res.tile; view.opts = { [dir]: keep }; }
  view.hover = null;
  sound.step();
  await new Promise(r => view.walk(dir, r));
  view.clearOptions();
  view.sync(life);
  view.updateLook(life);
  view.focus(life.row, life.col);
  if (life.phase === 'procession' || res.crowned) crowdAround(life.row, life.col);
  if (res.crowned) { view.burst(life.row, life.col, 'gold'); view.burst(life.row, life.col, 'gold'); sound.relic(); }
  busy = false;
  save();
  if (res.fight) return battle(res, before);
  outcome(res, before);
}
function stride() {
  if (mode !== 'event') return;
  const free = life.locks().L ? 'R' : 'L';
  const s = view.hover || free;
  const res = life.stride(life.locks()[s] ? free : s);
  if (!res) return;
  mode = 'busy';
  sound.whoosh(0, .8);
  view.walk(res.dir, () => { view.clearOptions(); view.sync(life); view.focus(life.row, life.col); save(); outcome(res, snapshot()); }, .35);
}
const snapshot = () => ({ hp: life.hp, food: life.food, gold: life.gold });

// What happened, in words and little chips.
function fxChips(raw) {
  const out = [], list = [];
  for (const f of raw) {
    const same = ['gold', 'food', 'hp', 'renown', 'claim', 'sight'].includes(f.k) && list.find(g => g.k === f.k && g.why === f.why && Math.sign(g.v) === Math.sign(f.v));
    if (same) same.v += f.v; else list.push({ ...f });
  }
  for (const f of list) {
    const n = f.v > 0 ? `+${f.v}` : `${f.v}`;
    switch (f.k) {
      case 'gold': out.push([`${n} gold${f.why ? ' (' + (f.why === 'spoils' ? 'spoils' : RELICS[f.why]?.name || TRAITS[f.why]?.name || '') + ')' : ''}`, f.v > 0 ? 'up' : 'down', 'gold']); break;
      case 'cost': out.push([`${f.v} gold`, 'down', 'gold']); break;
      case 'pay': out.push([f.short ? `owed ${-f.v} gold, and couldn’t pay` : `paid ${-f.v} gold`, 'down', 'gold']); break;
      case 'food': out.push([`${n} food${f.why ? ' (' + (f.why === 'spoils' ? 'spoils' : RELICS[f.why]?.name || '') + ')' : ''}`, f.v > 0 ? 'up' : 'down', 'food']); break;
      case 'eat': out.push([`ate ${-f.v}`, 'small', 'food']); break;
      case 'starve': out.push(['starving: −1 health', 'down', 'hp']); break;
      case 'hp': out.push([`${n} health${f.why ? ' (' + (RELICS[f.why]?.name || TRAITS[f.why]?.name || '') + ')' : ''}`, f.v > 0 ? 'up' : 'down', 'hp']); break;
      case 'maxhp': out.push([`${n} max health`, f.v > 0 ? 'up' : 'down', 'hp']); break;
      case 'renown': out.push([`${n} renown`, f.v > 0 ? 'up' : 'down', 'renown']); break;
      case 'claim': out.push([`${n} claim`, f.v > 0 ? 'up' : 'down', 'claim']); break;
      case 'sight': out.push([`${n} foresight${f.why ? ' (' + (RELICS[f.why]?.name || TRAITS[f.why]?.name || '') + ')' : ''}`, 'up', 'sight']); break;
      case 'item': out.push(f.sold ? [`${ITEMS[f.id].name}: sold for ${f.sold} gold`, 'small', f.id] : [`${ITEMS[f.id].name} (power ${ITEMS[f.id].power})`, 'gold', f.id]); break;
      case 'relic': out.push(f.dup ? [`${RELICS[f.id].name} again: sold for ${f.dup}`, 'small', f.id] : [`Relic: ${RELICS[f.id].name}`, 'gold', f.id]); break;
      case 'trait': out.push([`${isCurse(f.id) ? 'Curse' : 'Blessing'}: ${TRAITS[f.id].name}`, isCurse(f.id) ? 'magic' : 'gold', f.id]); break;
      case 'ward': out.push([`${TRAITS[f.id].name} warded off`, 'up', f.by === 'ward' ? 'saints_ward' : f.by]); break;
      case 'lift': out.push([`${TRAITS[f.id].name} lifted`, 'up', f.id]); break;
      case 'ally': out.push(f.refused ? [`${ALLIES[f.id].name} won’t trust an oathbreaker`, 'down', f.id] : [`Ally: ${ALLIES[f.id].name}`, 'gold', f.id]); break;
      case 'hatch': out.push(['The dragon egg hatches!', 'gold', 'dragon_egg']); break;
      case 'virtue': out.push([VIRTUES[f.id].name, 'gold', VIRTUE_ICON[f.id]]); break;
      case 'treasury': out.push([`${n} gold in the treasury`, f.v > 0 ? 'up' : 'down', 'gold']); break;
      case 'heir': out.push([f.ally ? `For your heir: ${ALLIES[f.ally].name}` : f.renown ? `For your heir: +${f.renown} renown` : `For your heir: +${f.gold} gold`, 'gold', f.ally || (f.renown ? 'renown' : 'gold')]); break;
      case 'reaper': out.push(['The Reaper comes', 'down', 'reaper']); break;
    }
  }
  return out.map(([t, c, ic]) => `<span class="${c}" data-icon="${ic}">${esc(t)}</span>`).join('');
}
function hydrateIcons(root) { for (const s of root.querySelectorAll('[data-icon]')) s.prepend(icon(s.dataset.icon, 1)); }
function playFx(res) {
  const all = [...res.fx, ...(res.upkeep || [])];
  let hurt = false, gold = false, relic = false, curse = false, bless = false, heal = false, food = false;
  for (const f of all) {
    if (f.k === 'hp' && f.v < 0 || f.k === 'starve') hurt = true;
    if (f.k === 'hp' && f.v > 0) heal = true;
    if (f.k === 'gold' && f.v > 0) gold = true;
    if (f.k === 'food' && f.v > 0) food = true;
    if (f.k === 'relic' && !f.dup) { relic = true; newBits.add(f.id); }
    if (f.k === 'trait') { if (isCurse(f.id)) curse = true; else bless = true; newBits.add(f.id); }
    if (f.k === 'ally' && !f.refused) { newBits.add(f.id); bless = true; }
    if (f.k === 'item' && !f.sold) { newBits.add(f.id); relic = true; }
  }
  if (hurt) { sound.hurt(); view.shake(.4); }
  if (heal) { sound.heal(); view.burst(life.row, life.col, 'heal'); }
  if (gold) sound.coin(4);
  if (food) sound.food();
  if (relic) { setTimeout(() => sound.relic(), 150); view.burst(life.row, life.col, 'gold'); }
  if (bless) setTimeout(() => sound.bless(), 250);
  if (curse) { setTimeout(() => sound.curse(), 200); view.burst(life.row, life.col, 'dark'); }
}
function outcome(res) {
  mode = 'outcome';
  playFx(res);
  const intro = res.intro ? `<span class="intro">${esc(res.intro)}</span> ` : '';
  const title = res.poor ? `${esc(res.title)}` : esc(res.title);
  const next = res.death ? 'What became of them' : res.summons ? 'A herald comes' : res.crowned ? 'To the throne' : res.shop ? `Go into ${SHOP_NAME[res.shop].replace(/^The /, 'the ')}` : 'Onward';
  setPanel(`${kickerDone()}<h2>${title}</h2><p class="outcome">${intro}${esc(res.text)}</p><div class="fx">${fxChips([...res.fx, ...res.upkeep])}</div>
    <div class="row">${res.revived ? '<span class="hint">The Phoenix Feather burns to ash, and you rise.</span>' : ''}${life.canRewind() ? '<button type="button" class="btn" data-act="rewind">Turn back time</button>' : ''}<button type="button" class="btn go" data-act="next">${next} →</button></div>`);
  hydrateIcons(panel);
  if (res.revived) { sound.relic(); view.burst(life.row, life.col, 'gold'); }
  panel.querySelector('[data-act="next"]').onclick = () => { if (guideAt >= 0) guideEnd(); afterOutcome(res); };
  panel.querySelector('[data-act="rewind"]')?.addEventListener('click', rewind);
  renderHUD();
  if (guideAt >= 0 && guideAt < GUIDE.length - 1) { guideAt = GUIDE.length - 1; setTimeout(guideShow, 350); }
  else coachFor('outcome', res);
  panel.querySelector('[data-act="next"]').focus({ preventScroll: true });
}
const kickerDone = () => {
  const R = REALMS[life.realm.type], where = REGION[world.at(life.row, life.col)?.biome] || '';
  const step = life.row <= JOURNEY ? `Step ${life.row} of ${JOURNEY}` : life.row <= CROWN_ROW ? `The crown · ${life.row - JOURNEY} of 5` : `The procession · ${life.row - CROWN_ROW} of ${PROCESSION}`;
  return `<p class="kicker"><span>${step}</span><span class="realm">${esc(R.name)}</span><span>${esc(where)}</span></p>`;
};
function rewind() {
  if (!life.rewind()) return;
  sound.whoosh(0, 1.2); sound.relic();
  view.sync(life, true);
  const h = life; view.placeHero(h.row, h.col, h);
  view.focus(life.row, life.col);
  toast('The sands run backwards. You stand where you stood.');
  save();
  renderEvent();
}
function afterOutcome(res) {
  if (res.shop && life.shop) return shop();
  if (res.death) return fate();
  if (res.crowned) return coronation();
  if (res.earned) return earnedCard();
  if (res.summons) return summons();
  renderEvent();
}

/* ---------- fights ---------- */
function dieHTML(n, foe) {
  const on = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[n] || [];
  return `<span class="die${foe ? ' foe' : ''}">${[...Array(9)].map((_, i) => `<i class="${on.includes(i) ? 'on' : ''}"></i>`).join('')}</span>`;
}
function figCanvas(px, h) { const c = px.canvas(); c.className = 'fig'; c.style.height = h + 'px'; c.style.width = (px.w / px.h * h) + 'px'; return c; }
function battle(res) {
  mode = 'battle';
  const F = res.fight;
  view.showFoe(F.foe);
  const auto = F.auto;
  const odds = F.rolls.length || auto ? winChance(F.you + F.bonus - F.power) : 0;
  const oddsWord = odds >= .85 ? 'The odds are good.' : odds >= .6 ? 'The odds favour you.' : odds >= .4 ? 'It could go either way.' : odds >= .2 ? 'The odds are against you.' : 'The odds are grim.';
  setPanel(`${kickerDone()}<h2>${esc(res.title)}</h2>${res.intro ? `<p class="outcome"><span class="intro">${esc(res.intro)}</span></p>` : ''}
    <div class="bout"><div class="side" id="youSide"><span class="who">You</span><span class="nm">${esc(life.heir.name)}</span><span class="pow">⚔ ${F.you}${F.bonus ? ` +${F.bonus}` : ''}</span></div>
      <div class="vs">vs</div>
      <div class="side" id="foeSide"><span class="who">${esc(FOES[F.foe]?.name || 'Foe')}</span><span class="nm">${esc(cap(F.name))}</span><span class="pow">⚔ ${F.power}</span></div></div>
    <div class="bout" id="diceRow"><div class="side"><div class="dice" id="youDice">${dieHTML(1)}${dieHTML(1)}<span class="total"></span></div></div><div></div><div class="side"><div class="dice" id="foeDice">${dieHTML(1, true)}${dieHTML(1, true)}<span class="total"></span></div></div></div>
    <p class="odds">${auto === 'beast' ? 'The beast knows your voice.' : auto === 'gorgon' ? 'The Gorgon’s Eye stirs in your hand.' : oddsWord} Two dice each, added to power; ties go to you.</p>
    <div class="row"><button type="button" class="btn go" data-act="fight">${auto === 'beast' ? 'Speak to it' : auto === 'gorgon' ? 'Raise the Eye' : 'Fight!'}</button></div>`);
  $('youSide').prepend(figCanvas(heroArt({ ...view.hero.look }, 'front'), 84));
  $('foeSide').prepend(figCanvas(foeArt(F.foe).flip(), 84));
  if (auto) $('diceRow').remove();
  panel.querySelector('[data-act="fight"]').onclick = () => fightRoll(res);
  panel.querySelector('[data-act="fight"]').focus({ preventScroll: true });
  sound.clash();
  coachFor('fight');
}
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
async function fightRoll(res) {
  if (mode !== 'battle') return;
  mode = 'busy';
  if (coach.g) coach.stop();
  const F = res.fight;
  panel.querySelector('.row').innerHTML = '';
  if (F.auto) { await sleep(300); sound[F.auto === 'gorgon' ? 'curse' : 'heal'](); }
  for (let i = 0; i < F.rolls.length; i++) {
    const r = F.rolls[i];
    for (const d of panel.querySelectorAll('.die')) d.classList.add('roll');
    sound.dice(.8);
    const spin = setInterval(() => { for (const box of [$('youDice'), $('foeDice')]) box.querySelectorAll('.die').forEach(d => { d.outerHTML = dieHTML(1 + Math.floor(Math.random() * 6), box.id === 'foeDice'); }); for (const d of panel.querySelectorAll('.die')) d.classList.add('roll'); }, 90);
    await sleep(850);
    clearInterval(spin);
    $('youDice').innerHTML = dieHTML(r.you[0]) + dieHTML(r.you[1]) + `<span class="total">${r.youTotal}</span>`;
    $('foeDice').innerHTML = dieHTML(r.foe[0], true) + dieHTML(r.foe[1], true) + `<span class="total">${r.foeTotal}</span>`;
    await sleep(500);
    if (i < F.rolls.length - 1) { toast('The Rabbit’s Foot twitches. Roll again!'); sound.relic(); await sleep(900); }
  }
  view.clash(F.won); sound.clash();
  await sleep(250);
  if (F.won) { view.foeFalls(); sound.win(); } else { sound.lose(); view.shake(.8); }
  const verdict = document.createElement('p');
  verdict.className = 'verdict ' + (F.won ? 'won' : 'lost'); verdict.textContent = F.won ? (F.auto === 'beast' ? 'It lets you pass' : 'Victory!') : 'Defeat';
  panel.querySelector('.odds').replaceWith(verdict);
  await sleep(700);
  view.foeLeaves();
  outcome(res);
}

/* ---------- shops ---------- */
function shop() {
  mode = 'shop';
  const S = life.shop;
  const ware = w => {
    const can = !w.sold && life.gold >= w.price;
    const ic = w.kind === 'item' ? w.id : w.kind === 'relic' ? w.id : w.kind === 'food' ? 'food' : w.kind === 'heal' ? 'hp' : w.kind === 'sight' ? 'sight' : w.kind === 'lift' ? 'saints_ward' : 'gold';
    const what = w.kind === 'item' ? `${ITEMS[w.id].slot === 'weapon' ? 'Weapon' : 'Armour'}, power ${ITEMS[w.id].power}${ITEMS[w.id].power <= ITEMS[life[ITEMS[w.id].slot]].power ? ' (no better)' : ''}` : w.kind === 'relic' ? RELICS[w.id].blurb : w.kind === 'food' ? `+${w.v} food` : w.kind === 'heal' ? `heal ${w.v > 5 ? 'fully' : w.v}` : w.kind === 'lift' ? (life.cursed ? 'lift your latest curse' : 'you have no curse') : '';
    return `<button type="button" class="ware${w.sold ? ' sold' : ''}" data-i="${w.i}" ${can ? '' : 'disabled'} data-icon="${ic}"><b>${esc(w.name)}</b><small>${w.price} gold · ${esc(what)}</small></button>`;
  };
  setPanel(`${kickerDone()}<h2>${SHOP_NAME[S.kind]}</h2><div class="wares">${S.wares.map(ware).join('')}</div>
    <div class="row"><span class="hint">You have ${life.gold} gold.</span><button type="button" class="btn go" data-act="leave">Leave →</button></div>`);
  for (const b of panel.querySelectorAll('.ware')) { b.prepend(icon(b.dataset.icon, 2)); b.onclick = () => { const r = life.buy(+b.dataset.i); if (r) { sound.spend(); playFx(r); if (r.text) toast(r.text); view.updateLook(life); save(); renderHUD(); shop(); } }; }
  panel.querySelector('[data-act="leave"]').onclick = () => { life.leave(); save(); renderEvent(); };
  renderHUD();
}

/* ---------- the big moments ---------- */
function card(html, cls = '') {
  const box = $('card'), body = $('cardBody');
  if (!$('coach').hidden && !coachSticky) { $('coach').hidden = true; coach.stop(); }
  coachSticky = false;
  body.className = 'card parch ' + cls; body.innerHTML = html;
  box.hidden = false; box.scrollTop = 0;
  return body;
}
function closeCard() { $('card').hidden = true; }
function portrait(o, h = 96, pose = 'front') { const c = heroArt(o, pose).canvas(); c.style.height = h + 'px'; c.style.width = (16 / 24 * h) + 'px'; return c; }
const lookOf = (heir, extra = {}) => ({ look: heir.look, colour: armsColour(house.names.arms), armor: 'rags', weapon: 'staff', ...extra });

function summons() {
  mode = 'card';
  hidePanel();
  sound.summons();
  const R = life.realm, type = R.type;
  const words = type === 'old' ? `${cap(life.fill('{ruler}'))} has no heir, and word of you has reached the palace. Heralds ride out with your name on their lips.`
    : type === 'tyrant' ? `The whispers have found you: the ${life.fill('{ruler}').includes('Queen') ? 'Queen' : 'King'}’s enemies would put you on the throne. First, ${life.fill('{ruler}')} must fall.`
    : `The lords of ${house.names.kingdom} tire of war. Some of them have begun to speak your name.`;
  const b = card(`<p class="kicker" style="justify-content:center">Step ${JOURNEY} · ${esc(REALMS[type].name)}</p><h2>In Line for the Throne</h2><p>${esc(words)}</p>
    <h3>Your claim</h3><div class="statline" style="font-size:18px"><span data-icon="claim">${life.claim}</span></div>
    <p class="sub">Your claim rises and falls with the five choices ahead. If it falls to nothing, the crown is lost. Renown, allies and gold will count now.</p>
    <div class="row"><button type="button" class="btn go" data-act="go">To ${esc(house.names.capital)} →</button></div>`);
  hydrateIcons(b);
  b.querySelector('[data-act="go"]').onclick = () => { closeCard(); renderEvent(); };
  renderHUD();
}

function fate() {
  mode = 'card';
  const f = life.fate;
  sound.toll();
  hidePanel();
  $('hud').hidden = true;
  const inh = inheritanceOf(life);
  const entry = endLife(house, life);
  const heir = house.heir;
  life = null;
  save();
  view.foeLeaves(); view.clearOptions(); view.hero = null; view.setGraves();
  view.burst(entry.fate.row, entry.fate.col, 'dark');
  const b = card(`<p class="kicker" style="justify-content:center">Generation ${roman(entry.gen)} of House ${esc(house.names.house)}</p>
    <div class="stone"><small>Here lies</small><b>${esc(entry.name)} ${esc(entry.epithet)}</b><small>${esc(capFirst(entry.fate.cause))}, aged ${entry.fate.age}</small></div>
    <div class="statline"><span>${entry.steps} steps from the crossroads</span><span>${entry.relics.length} relic${entry.relics.length === 1 ? '' : 's'}</span><span>${entry.won} fight${entry.won === 1 ? '' : 's'} won</span></div>
    <h3>What they leave</h3>
    <p><b>${inh} gold</b> for the family: ${entry.fate.kind === 'broke' ? 'the creditors took the purse, but' : `half of the ${entry.gold} in the purse, and`} ${DEEDS_PER_STEP * entry.steps} for the road walked.</p>
    <p class="sub">${esc(capFirst(titleOf(heir.sex, 'child')))} ${esc(heir.name)} takes up the road.</p>
    <div class="row"><button type="button" class="btn" data-act="tome">Read the Tome</button><button type="button" class="btn go" data-act="next">The Bloodline →</button></div>`);
  b.querySelector('[data-act="tome"]').onclick = () => showTome(house.lineage.length - 1);
  b.querySelector('[data-act="next"]').onclick = () => bloodline(true);
  coachFor('fate');
}
const capFirst = s => s ? s[0].toUpperCase() + s.slice(1) : s;

// The crown is won. The procession through the royal city comes next: four more choices, made like all the others,
// but now about the kind of ruler you'll be.
function earnedCard() {
  mode = 'card';
  hidePanel();
  sound.summons();
  view.confetti(60);
  const b = card(`<p class="kicker" style="justify-content:center">The crown · ${esc(REALMS[life.realm.type].name)}</p><h2>The Crown Is Yours</h2>
    <p>${esc(house.names.capital)} opens its gates to you. Four choices lie between you and the throne: how you enter the city, what you do in its streets, how you deal with those who stood against you, and how you are crowned.</p>
    <p class="sub">Nothing can take the crown from you now. What you choose decides what kind of ruler you are, and what you leave to those who come after. Wherever the last of them leads you, that is where your throne room will be.</p>
    <div class="row"><button type="button" class="btn go" data-act="go">Enter ${esc(house.names.capital)} →</button></div>`);
  b.querySelector('[data-act="go"]').onclick = () => { closeCard(); renderEvent(); };
  renderHUD();
}
// Crowds line the procession's way, and cheer.
function crowdAround(row, col) {
  const g = gridOf(row, col), list = view.crowd.slice(-40);
  for (const side of [-1, 1]) for (let i = 0; i < 2; i++) list.push({ x: (g.gx - g.gy) * 24 + side * (13 + i * 7 + Math.random() * 4), y: (g.gx + g.gy) * 12 + 10 + i * 3 + Math.random() * 3, k: Math.floor(Math.random() * 60) });
  view.setCrowd(list);
  view.confetti(18);
  sound.cheer(1.4);
}

// The crowning. The tile the last choice led to is the throne room: up its carpet between the courtiers, the crown
// comes down, and then the fog lifts and the kingdom settles into its shape round that throne, every tile between it
// and the crossroads.
async function coronation() {
  mode = 'crown';
  view.clearOptions(); view.foeLeaves();
  hidePanel();
  $('hud').hidden = true;
  const L = life, name = L.heir.name, royal = titleOf(L.heir.sex, 'ruler');
  const throne = { row: L.fate.row, col: L.fate.col };
  const say = (html, ms) => { const c = $('crown'); c.hidden = false; c.innerHTML = `<div>${html}</div>`; return sleep(ms); };
  view.zoomBefore = view.zoomStep;
  view.setCrowd([]);
  view.ceremony = { row: throne.row, col: throne.col, cheer: false, raise: false, crown: null, rays: 0 };
  view.focus(throne.row, throne.col);
  for (let z = view.zoomStep; z <= 3; z++) { view.setZoom(z); await sleep(110); }
  // up the carpet, from the doors at the bottom corner of the tile to the foot of the throne
  const spot = spotOf(throne.row, throne.col);
  view.hero.x = spot.x; view.hero.y = spot.y + 23; view.hero.dir = 'R';
  await new Promise(r => { view.hero.walk = { from: { x: spot.x, y: spot.y + 23, h: 0 }, to: { x: spot.x, y: spot.y + 12, h: 0 }, t: 0, dur: 1.4, done: r, target: throne }; });
  view.hero.pose = 'back';
  view.ceremony.raise = true;
  sound.fanfare();
  await sleep(1500);
  view.ceremony.crown = 0;
  await new Promise(r => { const t0 = performance.now(); const tick = () => { const k = (performance.now() - t0) / 1300; view.ceremony.crown = Math.min(1, k); if (k < 1) requestAnimationFrame(tick); else r(); }; tick(); });
  view.hero.look = { ...view.hero.look, crowned: true };
  view.hero.pose = 'front';
  view.ceremony.raise = false; view.ceremony.cheer = true; view.ceremony.rays = 1;
  view.burst(throne.row, throne.col, 'gold'); view.burst(throne.row, throne.col, 'gold');
  view.confetti(160);
  await say(`<div class="crown-words">Long live ${royal} ${esc(name)}</div><div class="crown-sub">${esc(house.names.kingdom)} has a ${royal.toLowerCase()} of House ${esc(house.names.house)}</div>`, 4400);
  view.ceremony.rays = 0;
  // the fog lifts, and the kingdom takes its shape round the throne
  $('crown').hidden = true;
  const z1 = view.zoomStep;
  view.setShape(throne);
  const box = view.frameKingdom(throne), zEnd = view.zoomStep;
  view.setZoom(z1);
  for (let z = z1; z >= zEnd; z--) { view.setZoom(z); await sleep(120); }
  view.camT = { x: box.x, y: box.y };
  sound.whoosh(0, 3);
  const t0 = performance.now();
  await new Promise(r => { const tick = () => { const k = (performance.now() - t0) / 3400; view.lift(Math.min(1, k)); if (k < 1) requestAnimationFrame(tick); else r(); }; tick(); });
  $('crown').classList.add('low');
  await say(`<div class="crown-sub big">${esc(name)} rules the whole kingdom of ${esc(house.names.kingdom)}.</div>`, 2800);
  $('crown').classList.remove('low');
  $('crown').hidden = true;
  // then the chronicle
  const inh = inheritanceOf(L);
  const entry = endLife(house, L);
  life = null;
  save();
  const heir = house.heir, R = house.realm;
  const v = Object.entries(entry.virtues || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => VIRTUES[k].name.toLowerCase());
  const gifts = entry.gifts ? [...entry.gifts.allies.map(a => ALLIES[a].name), entry.gifts.renown ? `${entry.gifts.renown} renown` : '', entry.gifts.gold ? `${entry.gifts.gold} gold` : ''].filter(Boolean) : [];
  const after = R.type === 'tyrant' ? `${esc(R.ruler.full)} seized the throne, and ${esc(titleOf(heir.sex, 'royal'))} ${esc(heir.name)} was smuggled away to the crossroads, to grow up and take it back.`
    : R.type === 'chaos' ? `the lords fell to fighting over the crown, and ${esc(titleOf(heir.sex, 'royal'))} ${esc(heir.name)} was hidden at the crossroads until it was safe.`
    : `the crown passed quietly to ${esc(R.ruler.full)}, an old cousin with no heir, and ${esc(titleOf(heir.sex, 'royal'))} ${esc(heir.name)} grew up at the crossroads, and may yet be named.`;
  const treasury = Math.max(60, ROYAL_TREASURY + (L.treasury || 0));
  const b = card(`<p class="kicker" style="justify-content:center">Generation ${roman(entry.gen)} of House ${esc(house.names.house)}</p><h2>${royal} ${esc(entry.name)} ${esc(entry.epithet)}</h2>
    <div class="portrait"></div>
    <p>Crowned aged ${entry.fate.age}, and reigned ${entry.reign} years over ${esc(house.names.kingdom)}${v.length ? `, remembered for ${v.join(' and ')}` : ''}.</p>
    <h3>The royal treasury</h3><p><b>${inh} gold</b> for the family: half the purse, something for the road, and ${treasury} from the treasury.</p>
    ${gifts.length ? `<h3>For the heir</h3><p>${esc(gifts.join(', '))}.</p>` : ''}
    <p class="sub">When the reign ended, ${after}</p>
    <div class="row"><button type="button" class="btn" data-act="tome">Read the Tome</button><button type="button" class="btn go" data-act="next">The Bloodline →</button></div>`);
  b.querySelector('.portrait').append(portrait(lookOf(entry, { crowned: true, armor: entry.armor, weapon: entry.weapon }), 110));
  b.querySelector('[data-act="tome"]').onclick = () => showTome(house.lineage.length - 1);
  b.querySelector('[data-act="next"]').onclick = () => { view.ceremony = null; bloodline(true); };
}


/* ---------- the house between lives ---------- */
function bloodline(then) {
  mode = 'card';
  const row = L => {
    const lvl = legacyLevel(house, L.id), cost = legacyCost(house, L.id), max = L.costs.length;
    const next = lvl < max ? L.blurb[lvl] : L.blurb[max - 1];
    return `<div class="power"><div><b>${esc(L.name)}</b><div class="pips">${[...Array(max)].map((_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div>
      <p>${lvl ? `Now: ${esc(L.blurb[lvl - 1])}` : esc(next)}${lvl && lvl < max ? `<br>Next: ${esc(next)}` : ''}</p>
      ${cost == null ? '<span class="btn" style="opacity:.5">All of it</span>' : `<button type="button" class="btn${house.vault >= cost ? ' gold' : ''}" data-id="${L.id}" ${house.vault >= cost ? '' : 'disabled'}>${cost} gold</button>`}</div>`;
  };
  const b = card(`<h2>The Bloodline</h2><p class="sub">What each life leaves goes into the family vault. Powers bought here pass to every heir after.</p>
    <div class="vault" data-icon="gold">${house.vault} gold in the vault</div>
    <div class="powers">${LEGACY.map(row).join('')}</div>
    <div class="row">${then ? '<button type="button" class="btn go" data-act="next">The next heir →</button>' : '<button type="button" class="btn" data-act="close">Close</button>'}</div>`, 'blood');
  hydrateIcons(b);
  for (const btn of b.querySelectorAll('[data-id]')) btn.onclick = () => { if (buyLegacy(house, btn.dataset.id)) { sound.relic(); save(); bloodline(then); } };
  b.querySelector('[data-act="next"]')?.addEventListener('click', heirCard);
  b.querySelector('[data-act="close"]')?.addEventListener('click', () => { closeCard(); resumeMode(); });
}
function heirCard() {
  mode = 'card';
  const heir = house.heir, R = house.realm, prev = house.lineage[house.lineage.length - 1];
  const probe = beginLife(house);
  const ruler = R.ruler?.full;
  const realmWords = R.type === 'old' ? (R.story === 'peace' ? `The crown passed to ${ruler}, an old cousin of your line with no heir of their own. It will go to whoever proves worthiest.` : `${ruler} is old, and has no heir. The crown will go to whoever proves worthiest.`)
    : R.type === 'tyrant' ? (R.story === 'still' ? `${ruler} still holds the throne, crueller than ever.` : R.story === 'usurped' ? `${ruler} seized the throne from your family.` : `${ruler} holds the throne and bleeds the realm white.`) + ' To wear the crown, you will have to take it.'
    : (R.story === 'civil war' ? `Since ${prev?.name || 'your parent'} died, the lords have fought over the crown, and the throne stands empty.` : 'The throne is empty and the lords are at war.') + ' Every road is harder, every loss cuts deeper.';
  const parent = prev ? `${capFirst(titleOf(heir.sex, 'child'))} of ${prev.name} ${prev.epithet}` : `Of House ${house.names.house}, of ${house.names.kingdom}`;
  const b = card(`<p class="kicker" style="justify-content:center">Generation ${roman(house.gen)}</p><div class="portrait"></div>
    <h2>${esc(heir.name)}</h2><p class="sub">${esc(parent)}, aged ${heir.age}${heir.royal ? ', of royal blood' : ''}</p>
    <h3>${esc(REALMS[R.type].name)}</h3><p>${esc(realmWords)}</p>
    <div class="statline"><span data-icon="hp">${probe.maxHp}</span><span data-icon="food">${probe.food}</span><span data-icon="gold">${probe.gold}</span><span data-icon="power">${probe.power}</span>${probe.renown ? `<span data-icon="renown">${probe.renown}</span>` : ''}${probe.sight ? `<span data-icon="sight">${probe.sight}</span>` : ''}${probe.relics.map(r => `<span data-icon="${r.id}">${esc(RELICS[r.id].name)}</span>`).join('')}${probe.allies.map(a => `<span data-icon="${a}">${esc(ALLIES[a].name)}</span>`).join('')}</div>
    <div class="row">${house.lineage.length ? '<button type="button" class="btn" data-act="blood">The Bloodline</button>' : ''}<button type="button" class="btn go" data-act="go">Set out from the crossroads →</button></div>`);
  b.querySelector('.portrait').append(portrait(lookOf(heir, { weapon: probe.weapon })));
  hydrateIcons(b);
  b.querySelector('[data-act="blood"]')?.addEventListener('click', () => bloodline(true));
  b.querySelector('[data-act="go"]').onclick = setOut;
}
function setOut(o = {}) {
  closeCard();
  life = o.life || beginLife(house);
  view.reset();
  $('coach').hidden = true; coach.stop();
  if (view.zoomBefore != null) { view.setZoom(view.zoomBefore); view.zoomBefore = null; }
  view.sync(life, true);
  view.focus(0, 0, true);
  shown = {};
  sound.pick();
  save();
  $('sub').textContent = `${life.heir.name} of House ${house.names.house} · Generation ${roman(life.gen)}`;
  if (o.tutorial) { life.cur = { id: TUTORIAL_EVENT, hidden: null, omens: null }; life.used.push(TUTORIAL_EVENT); }
  renderEvent();
  if (o.tutorial) guideStart();
}
function resumeMode() { if (life && !life.fate) { if (life.shop) shop(); else renderEvent(); } else if (!life) heirCard(); }

/* ---------- the tome ---------- */
function armsCanvas(arms, s = 3) {
  const p = new Px(20, 24), f = tinct(arms.field), sec = tinct(arms.second), t = tinct(arms.tincture);
  const inShield = (x, y) => y < 14 ? x >= 1 && x <= 18 : Math.abs(x + .5 - 10) <= 9 - (y - 14) * .9;
  for (let y = 1; y < 23; y++) for (let x = 1; x < 19; x++) {
    if (!inShield(x, y)) continue;
    let c = f;
    const d = arms.division;
    if (d === 'pale' && x >= 10) c = sec; if (d === 'fess' && y >= 11) c = sec; if (d === 'bend' && x - y > -2 && x - y < 4) c = sec;
    if (d === 'quarterly' && (x >= 10) !== (y >= 11)) c = sec; if (d === 'chevron' && y - 8 > Math.abs(x - 9.5) * .9 && y - 12 < Math.abs(x - 9.5) * .9) c = sec;
    if (d === 'chief' && y < 7) c = sec; if (d === 'saltire' && (Math.abs(x - y + 2) < 2 || Math.abs(x + y - 22) < 2)) c = sec; if (d === 'bordure' && (x < 3 || x > 16 || y < 3 || !inShield(x - 2, y + 2) || !inShield(x + 2, y + 2))) c = sec;
    p.put(x, y, c);
  }
  // the charge: a simple emblem in the middle
  const cx = 10, cy = 11, ch = arms.charge;
  const shapes = {
    lion: () => { p.rect(6, 9, 8, 5, t); p.rect(12, 6, 3, 4, t); p.rect(6, 14, 2, 3, t); p.rect(11, 14, 2, 3, t); p.put(5, 8, t); p.put(4, 7, t); },
    eagle: () => { p.rect(9, 7, 3, 9, t); p.rect(4, 8, 5, 3, t); p.rect(12, 8, 5, 3, t); p.rect(9, 5, 2, 2, t); p.rect(8, 16, 5, 2, t); },
    stag: () => { p.rect(7, 10, 7, 4, t); p.rect(12, 7, 2, 3, t); p.put(11, 5, t); p.put(14, 5, t); p.put(10, 4, t); p.put(15, 4, t); p.rect(7, 14, 1, 3, t); p.rect(13, 14, 1, 3, t); },
    tower: () => { p.rect(7, 7, 6, 10, t); p.rect(6, 5, 2, 2, t); p.rect(9, 5, 2, 2, t); p.rect(12, 5, 2, 2, t); },
    rose: () => { p.disc(cx, cy, 4, t); p.disc(cx, cy, 1.5, f === t ? sec : f); },
    star: () => { p.poly([[10, 4], [12, 10], [17, 10], [13, 13], [15, 18], [10, 15], [5, 18], [7, 13], [3, 10], [8, 10]], t); },
    moon: () => { p.disc(cx, cy, 5, t); p.disc(cx + 2, cy - 1, 4, f); },
    key: () => { p.disc(10, 7, 2.5, t); p.rect(9, 9, 2, 8, t); p.rect(11, 14, 3, 1, t); p.rect(11, 16, 2, 1, t); },
    sword: () => { p.rect(9, 3, 2, 12, t); p.rect(6, 15, 8, 1, t); p.rect(9, 16, 2, 3, t); },
    boar: () => { p.rect(5, 10, 10, 5, t); p.rect(14, 11, 3, 3, t); p.rect(6, 15, 2, 2, t); p.rect(12, 15, 2, 2, t); p.rect(6, 9, 6, 1, t); },
    fish: () => { p.ellipse(10, 11, 5, 2.5, t); p.poly([[4, 8], [6, 11], [4, 14]], t); },
    wolf: () => { p.rect(7, 8, 6, 6, t); p.put(7, 7, t); p.put(12, 7, t); p.rect(12, 11, 4, 2, t); },
    tree: () => { p.disc(cx, 9, 5, t); p.rect(9, 12, 2, 6, t); },
    bell: () => { p.poly([[10, 5], [14, 15], [6, 15]], t); p.rect(9, 15, 2, 2, t); },
    wren: () => { p.ellipse(10, 12, 4, 3, t); p.rect(13, 9, 3, 3, t); p.put(16, 10, t); p.line(6, 11, 4, 8, t); },
    crown: () => { p.rect(5, 10, 10, 5, t); p.poly([[5, 10], [5, 6], [8, 9]], t); p.poly([[15, 10], [15, 6], [12, 9]], t); p.poly([[8, 10], [10, 5], [12, 10]], t); },
  };
  (shapes[ch] || shapes.star)();
  p.outline('#1c1622');
  const c = p.canvas(); c.className = 'arms'; c.style.width = 20 * s + 'px'; c.style.height = 24 * s + 'px';
  return c;
}
let tomeSel = 0, coachSticky = false;
function showTome(sel) {
  const box = $('tomeBox'), t = $('tome');
  const L = house.lineage;
  tomeSel = sel ?? L.length - 1;
  box.hidden = false;
  sound.page();
  const list = L.length ? L.map((e, i) => `<li class="${e.crowned ? 'crowned' : ''}"><button type="button" data-i="${i}" aria-current="${i === tomeSel}"><span class="pic" data-gen="${i}"></span>
      <span><b>${esc(e.name)} ${esc(e.epithet)}</b><small>${e.crowned ? `${titleOf(e.sex, 'ruler')} of ${esc(house.names.kingdom)}, ${e.reign} years` : `${esc(FATE_WORD[e.fate.kind])}, aged ${e.fate.age}`}</small></span><span class="mark">${roman(e.gen)}</span></button></li>`).join('')
    : '<p class="sub">No one has set out yet. The first page is waiting.</p>';
  const heirLine = house.heir ? `<p class="sub" style="margin-top:14px">Next: ${esc(house.heir.name)}, ${house.lineage.length ? `${titleOf(house.heir.sex, 'child')} of ${esc(L[L.length - 1].name)}` : 'the first of the line'}.</p>` : '';
  t.dataset.show = t.dataset.show || 'story';
  t.innerHTML = `<button type="button" class="btn icon dark x" data-act="close" aria-label="Close">×</button>
    <div class="tome-tabs"><button type="button" class="btn" data-tab="list">The line</button><button type="button" class="btn" data-tab="story">The chronicle</button></div>
    <div class="page list">
      <h2>House ${esc(house.names.house)}</h2><p class="sub">of ${esc(house.names.kingdom)} · ${L.length} generation${L.length === 1 ? '' : 's'}${house.crowns ? ` · ${house.crowns} crowned` : ''}</p>
      <div class="armsbox"></div><ol class="lineage">${list}</ol>${heirLine}</div>
    <div class="page story">${L.length ? chronicle(L[tomeSel]) : '<h2>The Tome</h2><p class="sub">Here the lives of your line will be written, one by one.</p>'}</div>`;
  t.querySelector('.armsbox').append(armsCanvas(house.names.arms, 3));
  for (const s of t.querySelectorAll('.pic')) { const e = L[+s.dataset.gen]; const c = heroArt(lookOf(e, { crowned: e.crowned, armor: e.armor, weapon: e.weapon }), 'front').canvas(); s.replaceWith(c); }
  for (const b of t.querySelectorAll('[data-i]')) b.onclick = () => { t.dataset.show = 'story'; showTome(+b.dataset.i); };
  for (const b of t.querySelectorAll('[data-tab]')) { b.setAttribute('aria-pressed', t.dataset.show === b.dataset.tab); b.onclick = () => { t.dataset.show = b.dataset.tab; for (const x of t.querySelectorAll('[data-tab]')) x.setAttribute('aria-pressed', x === b); }; }
  t.querySelector('[data-act="close"]').onclick = () => { box.hidden = true; };
  hydrateIcons(t);
}
function chronicle(e) {
  const R = e.realm, royal = titleOf(e.sex, 'ruler');
  const realm = R.type === 'old' ? `in the last years of ${R.ruler}` : R.type === 'tyrant' ? `under ${R.ruler}` : 'while the throne stood empty and the lords made war';
  const lines = e.log.map(l => {
    const fx = (l.fx || []).map(f => f.k === 'virtue' ? `showed ${VIRTUES[f.id]?.name.toLowerCase()}` : f.k === 'relic' ? `found ${RELICS[f.id]?.name}` : f.k === 'trait' ? (isCurse(f.id) ? `cursed with ${TRAITS[f.id]?.name}` : `blessed with ${TRAITS[f.id]?.name}`) : f.k === 'ally' ? `won the ${ALLIES[f.id]?.name.replace(/^The /, '')} as allies` : f.k === 'item' && !f.sold ? `took up a ${ITEMS[f.id]?.name}` : f.k === 'lift' ? `was freed of ${TRAITS[f.id]?.name}` : '').filter(Boolean);
    const fight = l.fight ? (l.fight.won ? ` Beat ${l.fight.name}.` : ` Lost to ${l.fight.name}.`) : '';
    return `<li><b>${esc(l.title)}</b>: ${esc(l.label.replace(/^"|"$/g, ''))}.${esc(fight)}${fx.length ? `<span class="fxs">${esc(capFirst(fx.join('; ')))}</span>` : ''}</li>`;
  });
  const end = e.crowned ? `<li class="crown"><b>Crowned ${royal} of ${esc(house.names.kingdom)}</b> in the throne room where the road ended, aged ${e.fate.age}, and reigned ${e.reign} years.</li>`
    : `<li class="end"><b>${esc(capFirst(e.fate.cause))}</b>, aged ${e.fate.age}.</li>`;
  return `<h2>${esc(e.name)} ${esc(e.epithet)}</h2><p class="sub">Generation ${roman(e.gen)}${e.royal ? ' · of royal blood' : ''}</p>
    <p>Set out from the crossroads aged ${e.age}, ${esc(realm)}.</p>
    <ol class="chron">${lines.join('')}${end}</ol>
    <h3>What they carried</h3><p>${esc(ITEMS[e.weapon]?.name || '')}${e.armor !== 'rags' ? `, ${esc(ITEMS[e.armor]?.name)}` : ''}${e.relics.length ? `; ${e.relics.map(r => esc(RELICS[r].name)).join(', ')}` : ''}.</p>
    <p>Left the family ${e.inheritance} gold.</p>`;
}

/* ---------- the title ---------- */
function titleScreen() {
  mode = 'title';
  $('title').hidden = false;
  document.querySelector('.name').hidden = true;
  $('hud').hidden = true;
  hidePanel();
  const btns = [];
  const fresh = introDue() && !life && !house.lineage.length;
  if (fresh) btns.push('<button type="button" class="btn go" data-act="story">Begin the story</button>', '<button type="button" class="btn ghost" data-act="nostory">Skip the intro</button>');
  else if (life && !life.fate) btns.push(`<button type="button" class="btn go" data-act="continue">Continue ${esc(life.heir.name)}’s road</button>`);
  else btns.push(`<button type="button" class="btn go" data-act="begin">${house.lineage.length ? 'The next heir' : 'Begin'}</button>`);
  if (house.lineage.length) btns.push('<button type="button" class="btn" data-act="tome">The Tome</button>');
  $('titleButtons').innerHTML = btns.join('');
  $('titleHouse').textContent = house.lineage.length ? `House ${house.names.house} of ${house.names.kingdom} · ${house.lineage.length} generation${house.lineage.length === 1 ? '' : 's'}${house.crowns ? ` · ${house.crowns} crowned` : ''}` : `House ${house.names.house} of ${house.names.kingdom}`;
  $('titleButtons').querySelector('[data-act="continue"]')?.addEventListener('click', () => { start(); $('sub').textContent = `${life.heir.name} of House ${house.names.house} · Generation ${roman(life.gen)}`; resumeMode(); });
  $('titleButtons').querySelector('[data-act="begin"]')?.addEventListener('click', () => { start(); heirCard(); });
  $('titleButtons').querySelector('[data-act="tome"]')?.addEventListener('click', () => showTome());
  $('titleButtons').querySelector('[data-act="story"]')?.addEventListener('click', () => playIntro({ first: true }));
  $('titleButtons').querySelector('[data-act="nostory"]')?.addEventListener('click', () => { ui.introSeen = true; start(); setOut({ tutorial: true }); });
  // the camera looks at the castle, far off at the top of the fog, or, for a house that has worn the crown, over the
  // whole kingdom
  view.reset();
  view.inset = { top: 0, bottom: 0 };
  const last = house.thrones?.[house.thrones.length - 1];
  if (last) { view.setGraves(); view.setShape(last); view.lift(1); view.drift = view.frameKingdom(last); view.cam = { ...view.camT }; }
  else { view.setZoom(0); view.focus(D - 4, 0, true); }
}
function start() {
  $('title').hidden = true; document.querySelector('.name').hidden = false;
  view.drift = false; view.lift(0); view.setShape(null); view.setZoom(0); $('menuBtn').hidden = false; $('zoomBox').hidden = false;
  sound.ensure(); sound.music(ui.music && ui.sound);
  if (life) { view.sync(life, true); view.focus(life.row, life.col, true); }
}

/* ---------- the intro ---------- */
// A new player's first look at the game: a storybook opening over the map. The whole kingdom lies bare, its palace
// along the top edge, while a few lines tell whose kingdom it is and why its crown is going begging. The camera drifts
// down over it all as the fog rolls back in behind, until only the crossroads is left, and the first heir walks onto
// it. Then the title, and their first choice with the walkthrough. It waits for a first tap (a page can't make a sound
// before one): the title's Begin the story. Skip leaves at any point, and so does Escape. ?intro offers it anyway,
// ?nointro never.
let hadSave = false;
const introDue = () => !DEMO && !Q.has('nointro') && (Q.has('intro') || !hadSave && !ui.introSeen);
let introOn = false;
async function playIntro(o = {}) {
  if (introOn) return;
  introOn = true; mode = 'intro';
  const box = $('intro'), cap = $('introCaption'), veil = $('introVeil'), slam = $('introTitle');
  let skipped = false, wake = () => {};
  const skip = () => { skipped = true; wake(); };
  $('introSkip').onclick = skip;
  const onKey = e => { if (e.key === 'Escape') skip(); };
  addEventListener('keydown', onKey);
  const wait = ms => skipped ? Promise.resolve() : new Promise(r => { const t = setTimeout(r, REDUCED ? Math.min(ms, 1200) : ms); wake = () => { clearTimeout(t); r(); }; });
  const say = async (html, ms, cls = '') => {
    if (skipped) return;
    cap.className = 'caption' + (cls ? ' ' + cls : ''); cap.innerHTML = html;
    void cap.offsetWidth; cap.classList.add('on');
    await wait(ms); cap.classList.remove('on'); await wait(420);
  };
  // runs fn(0..1) over ms, on its own; ends at 1 at once if the intro is skipped
  const tween = (ms, fn) => new Promise(r => { const t0 = performance.now(); const tick = () => { const k = skipped ? 1 : Math.min(1, (performance.now() - t0) / ms); fn(k); if (k < 1) requestAnimationFrame(tick); else r(); }; tick(); });
  const easeIO = k => k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;

  // the stage: everything else out of the way, the whole kingdom lit, and the dark in front of it
  $('title').hidden = true; document.querySelector('.name').hidden = true; $('hud').hidden = true; $('menuBtn').hidden = true; $('zoomBox').hidden = true;
  hidePanel(); closeCard(); $('tomeBox').hidden = true; $('coach').hidden = true; coach.stop(); guideEnd(true);
  veil.classList.add('dark'); slam.hidden = true; cap.className = 'caption';
  box.hidden = false; void box.offsetWidth; box.classList.add('on');
  view.reset(); view.setGraves(); view.drift = false; view.inset = { top: 0, bottom: 0 }; view.setZoom(0);
  view.setShape('all', { row: 0, col: 0 }); view.lift(1);
  const top = spotOf(D - 1, 0), bottom = spotOf(0, 0);
  view.camT = { x: top.x, y: top.y }; view.cam = { ...view.camT };
  sound.ensure(); sound.music(false);
  const theme = sound.introTheme();

  const K = esc(house.names.kingdom), C = esc(house.names.capital), R = house.realm, Ruler = esc(capFirst(R.ruler?.full || ''));
  const heir = o.first ? house.heir : (life?.heir || house.heir);
  const lines = R.type === 'old' ? [`${Ruler} is dying, and has no heir.`, 'The crown will go to whoever proves worthiest.']
    : R.type === 'tyrant' ? [`${Ruler} sits on its throne, and the whole realm bleeds for it.`, 'Someone will have to take the crown away.']
    : ['Its throne stands empty, and its lords are at war.', 'The crown will go to whoever can hold it.'];
  await say(`This is the kingdom of <b>${K}</b>.`, 2600, 'big');
  veil.classList.remove('dark');
  await say(lines[0], 3300);
  // the long drift down the kingdom, from the palace to the crossroads
  const glide = tween(13500, k => { const e = easeIO(k); view.camT = { x: top.x + (bottom.x - top.x) * e, y: top.y + (bottom.y - top.y) * e }; });
  await say(lines[1], 3300);
  await say(`From every corner of it, the bold and the desperate are setting out for <b>${C}</b>.`, 3900);
  // the fog comes back in behind, and follows the camera down
  const fog = tween(4200, k => view.lift(1 - k));
  await say('Most of them will never get there.', 2800);
  await glide; await fog;
  await say('Every road to the throne begins at a crossroads.', 3000);
  // the heir walks onto it
  const L = o.first ? beginLife(house) : life;
  if (!skipped && L) {
    view.sync(L, false);
    const w = spotOf(0, 0);
    view.hero.x = w.x; view.hero.y = w.y + 24; view.hero.pose = 'back';
    view.walkTo(0, 0, () => { if (view.hero) view.hero.pose = 'front'; }, 1.4);
    sound.step();
    const gold = L.gold, weapon = ITEMS[L.weapon].name.toLowerCase();
    await say(`This is <b>${esc(heir.name)}</b> of House ${esc(house.names.house)}: ${heir.age} years old, with a ${esc(weapon)}, ${gold} gold, and nothing to lose.`, 4200);
  }
  // the title
  if (!skipped) {
    slam.hidden = false; sound.titleChord(); view.confetti(30);
    await wait(3000);
  }
  // and out, to the first choice
  theme.stop(1.2);
  removeEventListener('keydown', onKey);
  cap.classList.remove('on'); slam.hidden = true;
  box.classList.remove('on'); veil.classList.remove('dark');
  setTimeout(() => { if (!introOn) box.hidden = true; }, 900);
  introOn = false;
  ui.introSeen = true;
  view.lift(0); view.setShape(null);
  start();
  if (o.first) setOut({ tutorial: true, life: L });
  else { view.reset(); if (life && !life.fate) { view.sync(life, true); view.focus(life.row, life.col, true); resumeMode(); } else titleScreen(); }
}

/* ---------- the walkthrough of a first choice ---------- */
// Five notes, each with everything dimmed around the thing it talks about: the story, the two ways on the map, what
// you carry, the choice itself (it waits for you to make it), and what came of it. Skip the walkthrough ends it.
const GUIDE = [
  { at: () => rectOf('#panel .kicker', '#panel h2', '#panel .text'), above: '#panel', say: 'Every step of your road starts with something in it. Here is what stands at the crossroads.' },
  { at: () => optionsRect(), say: 'There are always two ways on. They rise out of the fog ahead of you: the left card leads up and to the left, the right card up and to the right.' },
  { at: () => rectOf('#stats'), say: 'This is what you carry: health, food, gold, power, renown and foresight. Lose all your health and your story ends. Go hungry and you lose health; owe a debt you can’t pay and it ends in the debtors’ gaol.' },
  { at: () => rectOf('#panel .choices'), above: '#panel', say: 'Nothing tells you which way is better. Choose one: tap its card, or its tile on the map.', wait: true },
  { at: () => rectOf('#panel .fx'), above: '#panel', say: 'Here is what happened, and what it brought you. Every step also eats a loaf, so keep an eye on your food.', last: true },
];
let guideAt = -1;
function rectOf(...sels) {
  let r = null;
  for (const sel of sels) { const el = document.querySelector(sel); if (!el || !el.offsetParent) continue; const b = el.getBoundingClientRect(); r = r ? { l: Math.min(r.l, b.left), t: Math.min(r.t, b.top), r: Math.max(r.r, b.right), b: Math.max(r.b, b.bottom) } : { l: b.left, t: b.top, r: b.right, b: b.bottom }; }
  return r;
}
function optionsRect() {
  if (!view.opts) return null;
  const k = view.P / view.dpr;
  let r = rectOf('.tag.left', '.tag.right');
  for (const o of Object.values(view.opts)) {
    const p = view.screenOfCell(o.row, o.col);
    const b = { l: p.x - 26 * k, r: p.x + 26 * k, t: p.y - 44 * k, b: p.y + 14 * k };
    r = r ? { l: Math.min(r.l, b.l), t: Math.min(r.t, b.t), r: Math.max(r.r, b.r), b: Math.max(r.b, b.b) } : b;
  }
  return r;
}
function guideStart() { guideAt = 0; $('coach').hidden = true; guideShow(); }
function guideShow() {
  const g = GUIDE[guideAt];
  if (!g) return guideEnd();
  $('guide').hidden = false;
  $('guideBubble').innerHTML = `<p class="k">First steps · ${guideAt + 1} of ${GUIDE.length}</p><p class="say">${esc(g.say)}</p>
    <div class="row"><button type="button" class="link" data-act="skip">Skip the walkthrough</button>${g.wait ? '' : `<button type="button" class="btn go" data-act="next">${g.last ? 'Got it' : 'Next →'}</button>`}</div>`;
  $('guideBubble').querySelector('[data-act="skip"]').onclick = () => guideEnd();
  $('guideBubble').querySelector('[data-act="next"]')?.addEventListener('click', () => { sound.pick(); guideAt++; guideShow(); });
  $('guideHole').classList.toggle('go', !!g.wait);
  if (g.wait) coach.show({ kind: 'tap', at: () => { const el = document.querySelector('.choice.L'); if (!el || !el.offsetParent) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width * .5, y: b.top + b.height * .55 }; } });
  else coach.stop();
  guideUpdate();
  $('guideBubble').querySelector('[data-act="next"]')?.focus({ preventScroll: true });
}
// Keep the spotlight on its target (the map moves, the panel slides) and the note beside it.
function guideUpdate() {
  if (guideAt < 0 || $('guide').hidden) return;
  const r = GUIDE[guideAt]?.at();
  const hole = $('guideHole'), bub = $('guideBubble');
  if (!r) { hole.style.opacity = 0; return; }
  hole.style.opacity = 1;
  const pad = 8, l = r.l - pad, t = r.t - pad, w = r.r - r.l + pad * 2, h = r.b - r.t + pad * 2;
  Object.assign(hole.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px' });
  const bw = bub.offsetWidth, bh = bub.offsetHeight;
  // above the panel, when the note is about something in it (so it covers the map, not the words); else above or
  // below the spotlight, wherever there's room
  const over = GUIDE[guideAt].above && document.querySelector(GUIDE[guideAt].above)?.getBoundingClientRect();
  let y = over && over.top - bh - 12 >= 8 ? over.top - bh - 12 : t - bh - 14 >= 8 ? t - bh - 14 : t + h + 14;
  if (y + bh > innerHeight - 8) y = Math.max(8, innerHeight - bh - 8);
  const x = clamp(l + w / 2 - bw / 2, 8, innerWidth - bw - 8);
  bub.style.left = x + 'px'; bub.style.top = y + 'px';
}
function guideEnd(quiet) {
  if (guideAt < 0 && quiet) return;
  guideAt = -1;
  $('guide').hidden = true; coach.stop();
  ui.tut.choose = true; ui.tut.food = true;
  if (!quiet) save();
}

/* ---------- labels over the ways ahead, and over graves ---------- */
const tags = {};
function updateLabels() {
  const want = {};
  if (mode === 'event' && life?.cur && view.opts) {
    const cur = life.cur, ev = life.event;
    for (const dir of ['L', 'R']) {
      const o = view.opts[dir]; if (!o) continue;
      const hidden = cur.hidden === dir;
      want[dir] = { text: hidden ? '???' : life.fill((dir === 'L' ? ev.left : ev.right).label), row: o.row, col: o.col, cls: (view.hover === dir ? ' hot' : '') + (o.locked ? ' locked' : '') + (cur.omens ? ` omen-${cur.omens[dir]}` : '') };
    }
  }
  if (hoverGrave) want.g = { text: hoverGrave.name, row: hoverGrave.row, col: hoverGrave.col, cls: ' grave' };
  for (const k of Object.keys(tags)) if (!want[k]) { tags[k].remove(); delete tags[k]; }
  for (const [k, w] of Object.entries(want)) {
    let el = tags[k];
    if (!el) { el = tags[k] = document.createElement('div'); $('labels').append(el); }
    el.className = 'tag' + w.cls + (k === 'L' ? ' left' : k === 'R' ? ' right' : ''); if (el.textContent !== w.text) el.textContent = w.text;
    const p = view.screenOfCell(w.row, w.col, 30), wd = el.offsetWidth;
    let x = p.x + (k === 'L' ? 14 : k === 'R' ? -14 : 0);
    // keep it on the screen: a label that grows left can't start before the edge, nor one that grows right end past it
    if (k === 'L') x = clamp(x, wd + 6, innerWidth - 6); else if (k === 'R') x = clamp(x, 6, innerWidth - wd - 6); else x = clamp(x, wd / 2 + 6, innerWidth - wd / 2 - 6);
    el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(p.y) + 'px';
  }
}

/* ---------- touching the map ---------- */
let hoverGrave = null;
const cv = $('c');
const pointers = new Map();
let drag = null, pinch = null;
cv.addEventListener('pointerdown', e => {
  if (introOn) return;
  cv.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, moved: false, pan: { ...view.pan } };
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.zoomStep }; drag = null; }
});
cv.addEventListener('pointermove', e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const z = pinch.z + Math.round(Math.log2(d / pinch.d) * 2.2); if (z !== view.zoomStep) view.setZoom(z); return; }
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
    if (drag.moved) { cv.classList.add('grabbing'); const k = view.dpr / view.P; view.pan = { x: drag.pan.x - dx * k, y: drag.pan.y - dy * k }; }
    return;
  }
  // hovering: point at a way ahead, or at a grave
  const c = view.cellAt(e.clientX, e.clientY);
  let over = null;
  if (c && mode === 'event' && view.opts) for (const o of Object.values(view.opts)) if (o.row === c.row && o.col === c.col && !life.locks()[o.dir]) over = o.dir;
  view.hover = over ?? (panel.querySelector('.choice:hover')?.dataset.dir || null);
  cv.classList.toggle('point', !!over);
  const g = c && house?.graves.find(g => g.row === c.row && g.col === c.col && (view.cells.get(gridKey(c.row, c.col))?.vis || 0) >= 1);
  hoverGrave = g || null;
});
const gridKey = (row, col) => { const { gx, gy } = gridOf(row, col); return gy * (D + 1) + gx; };
const up = e => {
  pointers.delete(e.pointerId);
  cv.classList.remove('grabbing');
  if (pointers.size < 2) pinch = null;
  if (drag && !drag.moved && e.type === 'pointerup') {
    const c = view.cellAt(e.clientX, e.clientY);
    if (c && mode === 'event' && view.opts) for (const o of Object.values(view.opts)) if (o.row === c.row && o.col === c.col) { choose(o.dir); break; }
    if (c && !TOUCH) { const g = house?.graves.find(g => g.row === c.row && g.col === c.col); if (g) toast(`Here lies ${g.name}.`); }
    if (c && TOUCH) { const g = house?.graves.find(g => g.row === c.row && g.col === c.col); hoverGrave = g || null; }
  }
  drag = null;
};
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { e.preventDefault(); if (!introOn) view.setZoom(view.zoomStep + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, e => e.preventDefault(), { passive: false });
$('zoomIn').onclick = () => view.setZoom(view.zoomStep + 1);
$('zoomOut').onclick = () => view.setZoom(view.zoomStep - 1);

addEventListener('keydown', e => {
  if (e.target.closest?.('input, textarea') || introOn) return;
  if (e.key === 'Escape') { if (!$('tomeBox').hidden) { $('tomeBox').hidden = true; return; } if ($('menu').classList.contains('open')) { menu(false); return; } }
  if (mode === 'event') {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { choose('L'); e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { choose('R'); e.preventDefault(); }
    if (e.key === 'f' || e.key === 'F') foresee();
  }
  if (e.key === 't' || e.key === 'T') { if ($('tomeBox').hidden) showTome(); else $('tomeBox').hidden = true; }
});

/* ---------- the menu ---------- */
function menu(open) { $('menu').classList.toggle('open', open); $('menuBtn').setAttribute('aria-expanded', open); if (open) $('houseNote').textContent = `House ${house.names.house} of ${house.names.kingdom}: ${house.lineage.length} generation${house.lineage.length === 1 ? '' : 's'}, ${house.crowns} crowned, ${house.vault} gold in the vault.`; }
$('menuBtn').onclick = () => menu(!$('menu').classList.contains('open'));
$('menuClose').onclick = () => menu(false);
$('menuTome').onclick = () => { menu(false); showTome(); };
$('menuBlood').onclick = () => { menu(false); bloodline(!life); };
const sw = $('soundSwitch'), mw = $('musicSwitch');
sw.setAttribute('aria-checked', ui.sound); mw.setAttribute('aria-checked', ui.music);
sw.onclick = () => { ui.sound = !ui.sound; sw.setAttribute('aria-checked', ui.sound); sound.set(ui.sound); sound.music(ui.sound && ui.music); save(); };
mw.onclick = () => { ui.music = !ui.music; mw.setAttribute('aria-checked', ui.music); sound.music(ui.sound && ui.music); save(); };
$('replayTut').onclick = () => { ui.tut = {}; save(); menu(false); toast('The tips will show again as you go.'); if (mode === 'event') coachFor('event'); };
$('replayIntro').onclick = () => { menu(false); sound.ensure(); playIntro(); };
$('newHouse').onclick = () => {
  if (!confirm('Start a new house? The Tome, the vault and every bloodline power of this one will be lost.')) return;
  setHouse(newHouse()); life = null; save(); menu(false); closeCard(); $('tomeBox').hidden = true; titleScreen();
};

function toast(text) {
  const t = document.createElement('div'); t.className = 'toast leather'; t.textContent = text; $('toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 2600);
}

/* ---------- the walkthrough ---------- */
function coachSay(html, target) {
  const c = $('coach'); c.hidden = false;
  c.innerHTML = `<span class="tagc">Tip</span>${html}<button type="button">Got it</button>`;
  c.querySelector('button').onclick = () => { c.hidden = true; coach.stop(); };
  if (target) coach.show({ kind: 'tap', at: () => { const el = typeof target === 'function' ? target() : document.querySelector(target); if (!el || el.offsetParent === null) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width * .5, y: r.top + r.height * .55 }; } });
  else coach.stop();
}
function coachFor(when, res) {
  if (DEMO || guideAt >= 0) return;
  const T = ui.tut, done = k => { T[k] = true; save(); };
  $('coach').hidden = true;
  if (when === 'event' && !T.choose) { done('choose'); return coachSay('Two ways lie ahead. Choose one: tap its card, or the glowing tile it leads to.', '.choice.L'); }
  if (when === 'event' && life.sight > 0 && !life.cur.omens && !T.sight) { done('sight'); return coachSay('You have foresight. Spend it to see how each way bodes.', '[data-act="foresee"]'); }
  if (when === 'outcome' && !T.food && life.phase === 'journey') { done('food'); return coachSay('Every step eats a loaf. With none left, you starve a little each step.', '[data-stat="food"]'); }
  if (when === 'outcome' && res && res.fx.some(f => f.k === 'relic' && !f.dup) && !T.relic) { done('relic'); return coachSay('A relic! It lasts this life only. Tap it to read what it does.', '#bag .relic'); }
  if (when === 'fight' && !T.fight) { done('fight'); return coachSay('A fight: your power and two dice, against theirs. Ties go to you.', '[data-act="fight"]'); }
  if (when === 'fate' && !T.fate) { done('fate'); coachSticky = true; return coachSay('Your child takes up the road. What you leave buys Bloodline powers, kept by every heir after.'); }
}

/* ---------- starting up ---------- */
function boot() {
  const saved = DEMO ? null : load();
  hadSave = !!saved;
  if (saved?.ui) ui = { ...ui, ...saved.ui };
  if (saved?.house) { try { setHouse(saved.house); } catch (e) { console.warn('Could not load the house:', e); } }
  if (!house) setHouse(newHouse());
  if (saved?.life && !DEMO) { try { life = resumeLife(house, saved.life); } catch (e) { console.warn('Could not load the life:', e); life = null; } }
  sw.setAttribute('aria-checked', ui.sound); mw.setAttribute('aria-checked', ui.music);
  sound.enabled = ui.sound;
  if (DEMO) return demo();
  titleScreen();
}
// ?demo: a house a few generations in, partway along the road, with a choice in front of it (the home page's picture).
function demo() {
  const h = newHouse(4242);
  setHouse(h);
  h.legacy = { blade: 1, larder: 1, coffers: 1 };
  const player = makePlayer(.6, rng(3));
  for (let g = 0; g < 3; g++) { const L = beginLife(h); playLife(L, player); endLife(h, L); }
  life = beginLife(h);
  for (let i = 0; i < 6 && !life.fate; i++) { const d = player.choose(life); if (d === 'stride') life.stride('L'); else life.choose(d); if (life.shop) player.shop(life); }
  if (life.fate) { life = beginLife(h); for (let i = 0; i < 4; i++) { life.choose(player.choose(life)); if (life.shop) player.shop(life); } }
  ui.tut = { choose: 1, food: 1, fight: 1, relic: 1, sight: 1, fate: 1 };
  start();
  view.sync(life, true);
  view.focus(life.row + .5, life.col, true);
  $('sub').textContent = `${life.heir.name} of House ${house.names.house} · Generation ${roman(life.gen)}`;
  renderEvent();
  for (const o of Object.values(view.opts || {})) o.t = 1;
  view.parts.length = 0;
}

// For poking at from the console: kingdom.fast(8) plays eight steps with the stand-in player, kingdom.crown() skips to
// the coronation.
window.kingdom = {
  view, get life() { return life; }, get house() { return house; },
  fast(n = 6, skill = .7) {
    if (!life) return;
    const P = makePlayer(skill, rng(Date.now() & 0xffff));
    for (let i = 0; i < n && !life.fate; i++) { const d = P.choose(life); const res = d === 'stride' ? life.stride('L') : life.choose(d); if (life.shop) P.shop(life); if (res?.death || res?.summons) break; }
    view.hero = null; view.sync(life, true); view.focus(life.row, life.col, true); save(); renderHUD(false);
    if (life.fate) { if (life.fate.kind === 'crowned') coronation(); else fate(); } else if (life.phase === 'procession' && life.row === CROWN_ROW) earnedCard(); else renderEvent();
  },
  // play on with a charmed life until the crown is won, and stop at the gates of the city
  win(skill = .8) {
    if (!life) return;
    const P = makePlayer(skill, rng(Date.now() & 0xffff));
    for (let i = 0; i < 30 && !life.fate && life.phase !== 'procession'; i++) {
      life.hp = life.maxHp = Math.max(life.maxHp, 20); life.food = Math.max(life.food, 10); life.gold = Math.max(life.gold, 80); if (life.phase === 'succession') life.claim = 30;
      const d = P.choose(life); d === 'stride' ? life.stride('L') : life.choose(d); if (life.shop) P.shop(life);
    }
    view.hero = null; view.sync(life, true); view.focus(life.row, life.col, true); save(); renderHUD(false);
    if (life.phase === 'procession') earnedCard(); else if (life.fate) fate(); else renderEvent();
  },
  // put a particular event in front of you: kingdom.force('f_mop_fair')
  force(id) { if (!life) return; life.cur = { id, hidden: null, omens: null }; renderEvent(); },
  give(k, id) { if (!life) return; const fx = []; if (k === 'relic') life.giveRelic(id, fx); if (k === 'trait') life.addTrait(id, fx); if (k === 'ally') life.allies.push(id); if (k === 'sight') life.sight += id; renderHUD(); renderEvent(); },
};
let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  view.frame(dt);
  updateLabels();
  coach.update(dt, mode === 'busy');
  guideUpdate();
  sound.tick(dt);
  requestAnimationFrame(loop);
}
boot();
measure();
requestAnimationFrame(loop);
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
