// Floodplain: wiring. The almanac's title page and calendar, the tools, the raiders' turn played out, and
// the notes that teach each new thing the first time it appears.
// ?demo plays a few moves for the preview shot. ?debug exposes window.fp; ?level=N starts on a month;
// ?fast skips the animations.
import { Game, KINDS, TOOLS } from './game.js';
import { LEVELS } from './levels.js';
import { Renderer } from './render.js';
import { Sound } from './sound.js';

const qs = new URLSearchParams(location.search);
const DEMO = qs.has('demo'), DEBUG = qs.has('debug'), FAST = qs.has('fast');
const $ = id => document.getElementById(id);
const view = new Renderer($('c'));
const sound = new Sound();
const HOVER = matchMedia('(hover: hover) and (pointer: fine)').matches;

const KEY = 'floodplain.v1';
let save = { best: {}, seen: {}, muted: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY)) || {}); } catch {}
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} };
sound.on = !save.muted;

let lvl = 0, game = null, history = [], tool = null, busy = false, mode = 'title', flash = null, infoFor = null;

// ---------------------------------------------------------------- the notes
const k = s => `<span class="k">${s}</span>`;
const NOTES = [
  { 1: [
    { t: `This valley is yours to keep, and you are its river. The figure in red is a raider. The red line shows exactly where he will walk tonight, and the fire marks the cottage he will burn.`, at: [3, 2] },
    { t: `Raiders cannot swim. Pick up the ${k('Gate')} tool from the tray below.`, glow: 'gate', wait: 'tool:gate' },
    { t: `Now tap the sluice gate in the river bank to open it.`, at: [1, 3], wait: 'use' },
    { t: `Water runs to ground that is lower or level, never uphill. The meadow flooded and the raider drowned. The cottages stand higher, so they stayed dry.` },
    { t: `The red flag at the top: another raider arrives tomorrow. Your one move today is spent, so ${k('End the day')}.`, glow: 'end', wait: 'end' },
  ], 2: [
    { t: `He has arrived, but raiders won't wade into water, so he waits at its edge. This is the last day. Hold out to nightfall and March is kept.`, glow: 'end', wait: 'end' },
  ] },
  { 1: [
    { t: `Two gates. Water let in higher up the river is higher water, so it reaches higher ground.` },
    { t: `Open the ${k('upper')} gate and watch the cottage in the middle field.`, at: [1, 1], wait: 'use' },
    { t: `A flood ruins a cottage as surely as fire does. Take it back with ${k('Undo')}: any move can be undone until you end the day.`, glow: 'undo', wait: 'undo', when: g => g.housesLeft() < g.houses0 },
    { t: `Now try the ${k('lower')} gate, nearer the lake.`, at: [1, 5], wait: 'use', when: g => g.t[g.idx(1, 5)] !== 'O' },
    { t: HOVER ? `Low water only fills low ground. Tip: with a tool in hand, point at a tile to see where the water would go before you commit.` : `Low water only fills low ground. Try anything you like; Undo is always there until the day ends.` },
  ] },
  { 1: [
    { t: `This gate is already open, so the raider will take the long road round the flood. In three days he will reach a cottage.` },
    { t: `Shutting a gate drains the ground behind it. Drained ground is ${k('mud')} for one night, and nobody crosses mud. After that it is dry.` },
    { t: `Sometimes the trick is to let them in.` },
  ] },
  { 1: [
    { t: `Summer brings a new tool: ${k('Dig')}. Dig through a bank to let the river out, or dig open ground one step lower. Digs are counted; the number is on the tool.`, glow: 'dig' },
  ] },
  { 1: [
    { t: `From now on you have ${k('two moves')} a day. They are the marks at the top right.` },
    { t: `A ${k('Rider')}: he rides five tiles a day. Tap any raider to see what it does.`, at: [5, 0] },
  ] },
  { 1: [{ t: `Water only spreads through ground it can reach. A ridge one step too high is as good as a wall, until someone digs it.` }] },
  { 1: [
    { t: `Autumn brings ${k('Rain')}. Rain on open ground and water runs downhill from there until the raiders' turn ends. Then it drains, and leaves mud.`, glow: 'rain' },
    { t: `Rain on high ground floods everything below it. Mind the cottages on the hilltop.` },
  ] },
  { 1: [{ t: `A ${k('Torcher')} throws fire two tiles in a straight line, right over water. A moat won't stop him.`, at: [4, 0] }] },
  { 1: [{ t: `A storm month. Every tool you have, and they come from all sides.` }] },
  { 1: [
    { t: `Winter brings ${k('Freeze')}. Ice is a dam: the river below it drains away. Raiders can walk on ice.`, glow: 'freeze' },
    { t: `Use Freeze on ice to thaw it, and the water comes back.` },
  ] },
  { 1: [{ t: `The ford is frozen hard. Ice will carry a raider as well as any bridge.` }] },
  { 1: [{ t: `The last month, and every tool. Keep the village through February and the year is kept.` }] },
];
const VERSES = [
  'Open the race, and let the meadow drink.',
  'High water climbs high; low water keeps low.',
  'A shut gate is a door left on the latch.',
  'Where the spade goes, the river follows.',
  'One step of earth is a wall or a ford.',
  'In a dry month, every ditch counts.',
  'Rain falls on the hill and is paid out in the valley.',
  'A moat keeps out the walker, never the thrower.',
  'Mind the storm you call.',
  'Ice is a bridge with a trapdoor in it.',
  'What the cold holds back, the thaw lets go.',
  'Keep the village, and the year is yours.',
];

let coach = null;   // { steps, i }
function startNotes(day) {
  const set = NOTES[lvl]?.[day];
  if (!set || save.seen[lvl] === 'skip' || DEMO) { closeCoach(); return; }
  if (day === 1 && save.seen[lvl]) { closeCoach(); return; }
  coach = { steps: set, i: 0 };
  showStep();
}
function showStep() {
  if (!coach) return;
  while (coach.i < coach.steps.length && coach.steps[coach.i].when && !coach.steps[coach.i].when(game)) coach.i++;
  const s = coach.steps[coach.i];
  if (!s) { closeCoach(); return; }
  $('coach').hidden = false;
  $('coachHd').textContent = `${LEVELS[lvl].month} · a note for the keeper`;
  $('coachP').innerHTML = s.t;
  $('coachDots').innerHTML = coach.steps.map((_, j) => `<i class="${j === coach.i ? 'on' : ''}"></i>`).join('');
  $('coachNext').hidden = !!s.wait;
  $('coachNext').textContent = coach.i === coach.steps.length - 1 ? 'Begin' : 'Go on';
  $('coachWait').textContent = s.wait ? (s.wait === 'end' ? 'End the day to go on' : s.wait === 'undo' ? 'Undo to go on' : s.wait.startsWith('tool') ? 'Choose the tool to go on' : 'Tap it to go on') : '';
  view.pulse = s.at ? { x: s.at[0], y: s.at[1] } : null;
  document.querySelectorAll('.glow').forEach(b => b.classList.remove('glow'));
  if (s.glow) (s.glow === 'end' ? $('endBtn') : s.glow === 'undo' ? $('undoBtn') : document.querySelector(`[data-tool="${s.glow}"]`))?.classList.add('glow');
  layout();
}
function closeCoach() {
  if (coach && game && game.turn >= 1) { save.seen[lvl] = save.seen[lvl] || 1; store(); }
  coach = null; $('coach').hidden = true; view.pulse = null;
  document.querySelectorAll('.glow').forEach(b => b.classList.remove('glow'));
  layout();
}
function noteEvent(kind) {
  if (!coach) return;
  const s = coach.steps[coach.i];
  if (s?.wait && (s.wait === kind || (s.wait === 'use' && kind.startsWith('use')))) { coach.i++; setTimeout(showStep, kind === 'end' ? 0 : 450); }
}
$('coachNext').onclick = () => { sound.tap(); coach.i++; showStep(); };
$('coachSkip').onclick = () => { save.seen[lvl] = 'skip'; store(); coach = null; closeCoach(); };

// ---------------------------------------------------------------- layout
const SIDEWAYS = matchMedia('(max-height: 540px) and (min-aspect-ratio: 4/3)');
function layout() {
  const hud = $('hud').hidden ? 0 : $('hud').getBoundingClientRect().bottom;
  let top = hud, left = 0, right = 0, bottom;
  if (SIDEWAYS.matches) {
    // tray on the right, notes on the left, the hint line along the bottom
    right = $('tray').hidden ? 0 : innerWidth - $('tray').getBoundingClientRect().left;
    if (!$('coach').hidden) left = $('coach').getBoundingClientRect().right;
    bottom = $('say').hidden ? 0 : 36;
    top = Math.min(top, 60);
  } else {
    if (!$('coach').hidden && !$('coach').classList.contains('low')) top = Math.max(top, $('coach').getBoundingClientRect().bottom - 4);
    const trayTop = $('tray').hidden ? innerHeight : $('tray').getBoundingClientRect().top;
    bottom = innerHeight - trayTop + 44;
  }
  view.insets = { top, bottom, left, right };
  view.layout();
}
addEventListener('resize', layout);

// ---------------------------------------------------------------- levels
function unlocked(i) { return i === 0 || save.best[i - 1] >= 1 || DEBUG; }
function startLevel(i) {
  lvl = i; game = new Game(LEVELS[i]); history = []; tool = null; busy = false; infoFor = null;
  view.setGame(game);
  mode = 'play';
  $('title').hidden = true; $('done').hidden = true; $('hud').hidden = false; $('tray').hidden = DEMO; $('say').hidden = DEMO;
  const L = LEVELS[i];
  $('hMonth').textContent = `${L.month} · ${L.season[0].toUpperCase() + L.season.slice(1)}`;
  $('hName').textContent = L.name;
  for (const b of document.querySelectorAll('.tool[data-tool]')) b.hidden = !(b.dataset.tool in game.charges);
  refresh();
  layout();
  startNotes(1);
  layout();
}

function refresh() {
  if (!game) return;
  // the calendar of days and the moves left
  $('cal').innerHTML = Array.from({ length: game.turns }, (_, j) => `<i class="${j + 1 < game.turn ? 'past' : j + 1 === game.turn ? 'now' : ''}">${j + 1}</i>`).join('');
  const drop = on => `<svg viewBox="0 0 15 19"><path d="M7.5 1.5C5 6 2.5 9 2.5 12a5 5 0 0 0 10 0c0-3-2.5-6-5-10.5z" fill="${on ? '#2f6f9a' : 'none'}" stroke="#2a241c" stroke-width="1.2"/></svg>`;
  $('moves').innerHTML = Array.from({ length: game.actionsPer }, (_, j) => drop(j < game.actions)).join('');
  for (const b of document.querySelectorAll('.tool[data-tool]')) {
    const t = b.dataset.tool;
    const has = t in game.charges, left = t === 'gate' ? Infinity : game.charges[t];
    b.querySelector('.ct').textContent = has && t !== 'gate' ? left : '';
    b.disabled = busy || !has || left <= 0 || game.over;
    b.classList.toggle('on', tool === t);
  }
  $('undoBtn').disabled = busy || !history.length;
  $('endBtn').disabled = busy || !!game.over;
  view.forecast = game.over ? null : game.forecast();
  view.tool = tool;
  view.valid = tool && !busy ? listValid(tool) : null;
  $('endBtn').classList.toggle('warn', !!view.forecast?.lost);
  $('endBtn').querySelector('.nm').textContent = game.turn >= game.turns ? 'Last day' : 'End day';
  updateSay();
}
function listValid(t) {
  const out = [];
  for (let y = 0; y < game.h; y++) for (let x = 0; x < game.w; x++) if (game.canUse(t, x, y)) out.push([x, y]);
  return out;
}

function updateSay() {
  const el = $('say');
  el.className = '';
  if (flash && performance.now() < flash.until) { el.textContent = flash.text; if (flash.cls) el.classList.add(flash.cls); return; }
  if (busy) { el.textContent = 'The raiders move…'; return; }
  if (!game || game.over) { el.textContent = ''; el.hidden = true; return; }
  el.hidden = DEMO || mode !== 'play';
  const pv = view.preview;
  if (pv) {
    const drown = pv.drown.size, ruin = pv.ruin;
    const bits = [];
    if (drown) bits.push(`${drown} raider${drown > 1 ? 's' : ''} drown${drown > 1 ? '' : 's'}`);
    if (ruin) bits.push(`${ruin} cottage${ruin > 1 ? 's' : ''} washed away`);
    if (pv.fc.lost) bits.push(`${pv.fc.lost} burn${pv.fc.lost > 1 ? '' : 's'} tonight`);
    el.textContent = bits.length ? bits.join(' · ') : 'Nobody drowns. Every cottage safe tonight.';
    if (ruin || pv.fc.lost) el.classList.add('bad'); else if (drown) el.classList.add('blue');
    return;
  }
  if (tool) { el.textContent = TOOLS[tool].says; return; }
  const fc = view.forecast;
  if (fc.lost) { el.textContent = `End the day now and ${fc.lost === 1 ? 'a cottage burns' : fc.lost + ' cottages burn'}.`; el.classList.add('bad'); }
  else if (game.turn >= game.turns) el.textContent = 'The last day. Every cottage is safe tonight.';
  else if (fc.arrivals.length) el.textContent = 'Every cottage is safe tonight. More raiders come at the flags.';
  else el.textContent = 'Every cottage is safe tonight.';
}
function say(text, cls, ms = 2200) { flash = { text, cls, until: performance.now() + ms }; updateSay(); setTimeout(updateSay, ms + 20); }

// ---------------------------------------------------------------- the player's moves
function chooseTool(t) {
  if (busy || !game || game.over) return;
  if (!(t in game.charges)) return;
  if (t !== 'gate' && !(game.charges[t] > 0)) { say(`No ${TOOLS[t].name.toLowerCase()} left this month.`, 'bad'); sound.bad(); return; }
  tool = tool === t ? null : t;
  sound.tap();
  view.preview = null;
  hideInfo();
  refresh();
  if (tool) noteEvent('tool:' + tool);
}

function act(t, x, y) {
  if (busy || game.over) return;
  if (!game.canUse(t, x, y)) { say(game.whyNot(t, x, y), 'bad'); sound.bad(); return; }
  history.push(game.clone());
  const was = game.water.reduce((a, b) => a + b, 0);
  const wasGate = game.t[game.idx(x, y)];
  const wasIce = game.ice[game.idx(x, y)];
  const ev = game.use(t, x, y);
  const now = performance.now();
  view.noteEvents(ev, FAST ? now - 1e4 : now);
  const wet = ev.filter(e => e.type === 'wet').length, dry = ev.filter(e => e.type === 'dry').length;
  const [cx, cy] = view.center(x, y);
  if (t === 'gate') sound.gate(wasGate === 'G');
  if (t === 'dig') { sound.dig(); view.fx.push({ type: 'puff', x: cx, y: cy, t: now, life: 600 }); }
  if (t === 'rain') sound.rain();
  if (t === 'freeze') { if (wasIce) sound.thaw(); else sound.freeze(); view.fx.push({ type: 'frost', x: cx, y: cy, t: now, life: 600 }); }
  if (wet) setTimeout(() => sound.flood(wet), 60); else if (dry) sound.drain();
  const ruined = ev.filter(e => e.type === 'washed').length, drowned = ev.filter(e => e.type === 'drown').length;
  if (ruined) say(`The water reached a cottage. Undo takes it back.`, 'bad', 3200);
  else if (drowned) say(drowned > 1 ? `${drowned} raiders drowned.` : 'A raider drowned.', 'blue');
  if (t !== 'gate' && game.charges[t] <= 0) tool = null;
  if (game.actions <= 0) tool = null;
  view.preview = null;
  refresh();
  noteEvent('use:' + t);
  if (game.over) finish();
  void was;
}

function undo() {
  if (busy || !history.length) return;
  game = history.pop();
  view.g = game; view.disp.clear(); view.syncUnits(true); view.burning.clear();
  view.preview = null;
  sound.undo();
  refresh();
  noteEvent('undo');
}

function restart() { if (busy) return; startLevel(lvl); }

// ---------------------------------------------------------------- the raiders' turn
const wait = ms => new Promise(r => setTimeout(r, FAST ? 0 : ms));
const anims = new Set();
function walk(d, pts, hs) {
  return new Promise(res => {
    if (FAST) { const [x, y] = pts[pts.length - 1]; d.x = x; d.y = y; res(); return; }
    const a = { d, pts, hs, t0: performance.now(), ms: 230, res, n: 0 };
    anims.add(a);
  });
}
function stepAnims(now) {
  for (const a of anims) {
    const segs = a.pts.length - 1, p = Math.max(0, (now - a.t0) / a.ms), s = Math.min(segs - 1, Math.floor(p)), f = Math.min(1, p - s);
    if (s > a.n - 1 && s < segs) { a.n = s + 1; sound.step(); }
    const [x0, y0] = a.pts[s], [x1, y1] = a.pts[s + 1], e = f * f * (3 - 2 * f);
    a.d.x = x0 + (x1 - x0) * e; a.d.y = y0 + (y1 - y0) * e; a.d.hop = Math.sin(f * Math.PI);
    a.d.hOverride = a.hs[s] + (a.hs[s + 1] - a.hs[s]) * e;
    if (p >= segs) {
      const [x, y] = a.pts[segs]; a.d.x = x; a.d.y = y; a.d.hop = 0; a.d.hOverride = null; anims.delete(a); a.res();
    }
  }
}

async function endDay() {
  if (busy || !game || game.over) return;
  busy = true; tool = null; view.preview = null; view.busy = true; hideInfo();
  refresh();
  const day = game.turn;
  for (const e of game.enemySteps()) {
    const now = performance.now();
    if (e.type === 'move') {
      const d = view.disp.get(e.id);
      const pts = [e.from, ...e.path];
      await walk(d, pts, pts.map(([x, y]) => game.ht[game.idx(x, y)]));
      await wait(80);
    } else if (e.type === 'burn') {
      view.burning.set(game.idx(e.x, e.y), { t: now, kind: 'burn' });
      sound.burn();
      await wait(900);
    } else if (e.type === 'drain') {
      view.noteEvents(e.ev, now); sound.drain(); await wait(500);
    } else if (e.type === 'arrive') {
      view.syncUnits(); const d = view.disp.get(e.id); if (d) d.arrive = now;
      sound.arrive(); await wait(450);
    } else if (e.type === 'swept') {
      const [cx, cy] = view.center(e.x, e.y); view.fx.push({ type: 'splash', x: cx, y: cy, t: now }); sound.splash();
      say('A raider arrived straight into the water.', 'blue');
      await wait(500);
    }
  }
  history = [];
  busy = false; view.busy = false;
  refresh();
  noteEvent('end');
  if (game.over) { finish(); return; }
  sound.dawn();
  say(game.turn >= game.turns ? `Day ${game.turn}: the last day.` : `Day ${game.turn} of ${game.turns}.`, null, 1600);
  if (game.turn !== day) startNotes(game.turn);
}

function finish() {
  const won = game.over === 'won', saved = game.housesLeft(), total = game.houses0;
  if (won) { save.best[lvl] = Math.max(save.best[lvl] || 0, saved); store(); }
  setTimeout(() => {
    if (DEMO) return;
    won ? sound.win() : sound.lose();
    const L = LEVELS[lvl];
    const year = won && lvl === LEVELS.length - 1;
    $('dKick').textContent = year ? 'February is kept, and with it the year' : won ? `${L.month} is kept` : `${L.month} is lost`;
    $('dH').textContent = won ? (saved === total ? 'Not a Thatch Singed' : 'The Village Stands') : 'The Village Is Lost';
    const words = ['None', 'One', 'Two', 'Three', 'Four', 'Five'];
    $('dS').textContent = won ? `${words[saved]} of ${words[total].toLowerCase()} cottages saved.` : 'Every cottage is gone. The river remembers; try the month again.';
    const house = on => `<svg viewBox="0 0 44 40"><path d="M6 20h32v17H6z" fill="${on ? '#f3ead4' : '#4a3d32'}" stroke="#2a241c" stroke-width="1.4"/><path d="M2 21L9 8h26l7 13z" fill="${on ? '#c09346' : '#2a241c'}" stroke="#2a241c" stroke-width="1.4"/><path d="M14 37V27h7v10" fill="${on ? '#7a5634' : 'none'}" stroke="#2a241c" stroke-width="1.2"/>${on ? '' : '<path d="M8 36L36 10M10 10l26 26" stroke="#a3321f" stroke-width="2"/>'}</svg>`;
    $('dHomes').innerHTML = Array.from({ length: total }, (_, j) => house(j < saved)).join('');
    $('dVerse').textContent = year ? 'Twelve months, and the valley still stands. The river thanks its keeper.' : won ? VERSES[lvl] : '';
    $('dVerse').hidden = !won;
    $('dNext').hidden = !won || lvl >= LEVELS.length - 1;
    $('dAgain').textContent = won && saved < total ? 'Try for all of them' : 'Try again';
    $('dAgain').classList.toggle('solid', !won || lvl >= LEVELS.length - 1);
    $('done').hidden = false;
    mode = 'done';
  }, FAST ? 0 : 1100);
}
$('dAgain').onclick = () => { sound.tap(); restart(); };
$('dNext').onclick = () => { sound.tap(); startLevel(lvl + 1); };
$('dCal').onclick = () => { sound.tap(); showTitle(); };

// ---------------------------------------------------------------- title page and calendar
function showTitle() {
  mode = 'title';
  closeCoach();
  $('done').hidden = true; $('title').hidden = false; $('hud').hidden = true; $('tray').hidden = true; $('say').hidden = true;
  if (!game) { game = new Game(LEVELS[0]); view.setGame(game); view.forecast = game.forecast(); }
  const box = $('months'); box.innerHTML = '';
  const seasons = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
  let next = LEVELS.findIndex((_, i) => unlocked(i) && !(save.best[i] >= 1));
  LEVELS.forEach((L, i) => {
    if (i % 3 === 0) { const s = document.createElement('div'); s.className = 'season sc'; s.textContent = seasons[L.season]; box.appendChild(s); }
    const b = document.createElement('button');
    b.className = 'mo' + (i === next ? ' next' : '');
    b.disabled = !unlocked(i);
    const total = new Game(L).houses0, best = save.best[i] || 0;
    const marks = best ? Array.from({ length: total }, (_, j) => j < best ? '<b>⌂</b>' : '<s>⌂</s>').join(' ') : (i === next ? 'begin here' : '');
    b.innerHTML = `<span class="mn">${L.month}</span><span class="vn">${L.name}</span><span class="hs">${marks}</span>`;
    b.onclick = () => { sound.init(); sound.tap(); startLevel(i); };
    box.appendChild(b);
  });
  $('soundBtn').textContent = 'Sound: ' + (sound.on ? 'on' : 'off');
  layout();
}
$('soundBtn').onclick = () => { sound.init(); sound.setOn(!sound.on); save.muted = !sound.on; store(); $('soundBtn').textContent = 'Sound: ' + (sound.on ? 'on' : 'off'); };
$('resetBtn').onclick = () => { if (!confirm('Forget every month you have kept and begin the year again?')) return; save.best = {}; save.seen = {}; store(); showTitle(); };
$('menuBtn').onclick = () => { if (busy) return; sound.tap(); showTitle(); };

// ---------------------------------------------------------------- input
for (const b of document.querySelectorAll('.tool[data-tool]')) b.onclick = () => { sound.init(); chooseTool(b.dataset.tool); };
$('undoBtn').onclick = () => { sound.init(); undo(); };
$('endBtn').onclick = () => { sound.init(); endDay(); };

function showInfo(x, y) {
  const u = game.unitAt(x, y), el = $('info');
  let html = '';
  if (u) { const K = KINDS[u.k]; html = `<b>${K.name}</b><span>${K.says}</span>`; }
  else {
    const i = game.idx(x, y), t = game.t[i], h = game.ht[i];
    const names = { '.': 'Grass', ',': 'Field', T: 'Trees', '^': 'Rock', '#': 'Bank', G: 'Sluice gate, shut', O: 'Sluice gate, open', S: 'The spring', L: 'The lake', H: 'Cottage', X: 'Ruin' };
    const notes = { '#': 'Holds water back. Raiders walk along it.', G: 'Open it with the Gate tool.', O: 'Water passes. Shut it with the Gate tool.', '^': 'Nothing passes.', H: 'Keep it standing.', S: 'Where the river rises.', L: 'Where the river ends.', X: 'Lost.' };
    let name = names[t] || 'Ground';
    let note = notes[t] || 'Raiders walk here.';
    if (game.ice[i]) { name += ', frozen'; note = 'Ice: a dam, and a path. Thaw it with Freeze.'; }
    else if (game.water[i] && !'SL'.includes(t)) { name += ', flooded'; note = 'No raider will step in.'; }
    else if (game.mud[i]) { name += ', mud'; note = 'Nobody crosses mud. Dry by tomorrow.'; }
    else if (game.rain[i]) { name += ', raining'; note = 'Clears when the raiders’ turn ends.'; }
    html = `<b>${name}</b><span>Height ${h}. ${note}</span>`;
  }
  el.innerHTML = html; el.hidden = false;
  const [cx, cy] = view.center(x, y);
  const r = el.getBoundingClientRect();
  el.style.left = Math.max(8, Math.min(innerWidth - r.width - 8, cx - r.width / 2)) + 'px';
  el.style.top = Math.max(8, cy - r.height - view.S * .8) + 'px';
  infoFor = { x, y };
}
function hideInfo() { $('info').hidden = true; infoFor = null; }

function tapTile(x, y) {
  if (busy || !game || game.over || mode !== 'play') return;
  if (tool) { hideInfo(); act(tool, x, y); return; }
  const t = game.t[game.idx(x, y)];
  // with nothing in hand, a tap on a gate works it
  if ((t === 'G' || t === 'O') && 'gate' in game.charges && game.canUse('gate', x, y)) { hideInfo(); act('gate', x, y); return; }
  if (infoFor && infoFor.x === x && infoFor.y === y) { hideInfo(); return; }
  showInfo(x, y);
  sound.tap();
}

function setPreview(p) {
  if (!tool || !p || busy || !game.canUse(tool, p.x, p.y)) { if (view.preview) { view.preview = null; updateSay(); } return; }
  if (view.preview && view.preview.x === p.x && view.preview.y === p.y && view.preview.tool === tool) return;
  const g2 = game.clone(); g2.use(tool, p.x, p.y);
  const drown = new Set(game.units.filter(u => !u.dead && g2.units.find(v => v.id === u.id)?.dead).map(u => u.id));
  const ruin = game.t.filter((c, i) => c === 'H' && g2.t[i] === 'X').length;
  view.preview = { x: p.x, y: p.y, tool, g: g2, fc: g2.forecast(), drown, ruin };
  updateSay();
}

let down = null;
const cv = $('c');
cv.addEventListener('pointerdown', e => { sound.init(); down = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now() }; });
cv.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || mode !== 'play') return;
  const p = view.pick(e.clientX, e.clientY);
  view.hover = p;
  cv.style.cursor = p && tool && game?.canUse(tool, p.x, p.y) ? 'pointer' : 'default';
  setPreview(p);
});
cv.addEventListener('pointerleave', () => { view.hover = null; setPreview(null); });
cv.addEventListener('pointerup', e => {
  if (!down || down.id !== e.pointerId) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 14 || mode !== 'play') return;
  const p = view.pick(e.clientX, e.clientY);
  if (!p) { hideInfo(); if (tool && e.pointerType !== 'mouse') { tool = null; refresh(); } return; }
  tapTile(p.x, p.y);
  if (e.pointerType === 'mouse') { view.preview = null; setPreview(p); }
});
cv.addEventListener('contextmenu', e => { e.preventDefault(); if (tool) { tool = null; view.preview = null; refresh(); } });

addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (mode !== 'play') return;
  const k = e.key.toLowerCase();
  const byKey = Object.entries(TOOLS).find(([, T]) => T.key === k);
  if (byKey) { sound.init(); chooseTool(byKey[0]); e.preventDefault(); }
  else if (k === 'z' || k === 'backspace' || k === 'u') { undo(); e.preventDefault(); }
  else if (k === 'enter' || k === ' ') { if (coach && !coach.steps[coach.i]?.wait) { coach.i++; showStep(); } else endDay(); e.preventDefault(); }
  else if (k === 'escape') { tool = null; view.preview = null; hideInfo(); refresh(); }
  else if (k === 'r') restart();
});

// ---------------------------------------------------------------- frame loop
function frame(now) {
  requestAnimationFrame(frame);
  try { stepAnims(now); } catch (e) { for (const a of anims) a.res(); anims.clear(); console.error(e); }
  view.draw(now);
}

// ---------------------------------------------------------------- start
async function demo() {
  // the November storm, a few moves in: rain on the ridge, a gate open, the raiders' lines bending round
  startLevel(11);
  const moves = [['gate', 1, 2]];
  await new Promise(r => setTimeout(r, 300));
  for (const m of moves) { act(...m); await new Promise(r => setTimeout(r, 250)); }
}

if (DEBUG) window.fp = { get game() { return game; }, view, startLevel, act, endDay, undo, LEVELS, refresh, chooseTool, get busy() { return busy; } };

layout();
requestAnimationFrame(frame);
if (DEMO) demo();
else if (qs.has('level')) startLevel(Math.max(0, Math.min(LEVELS.length - 1, (+qs.get('level') || 1) - 1)));
else showTitle();
