import { Game, T, W, H, POOL_MAX, COST, RELICS, CURSES, ROOM_NAMES, FLOORS, ROOMS } from './game.js';
import { Chat, CAST, connectTwitch } from './chat.js';
import { View, DOOR_WORD } from './render.js';
import { Sound } from './sound.js';
import { botInput } from './bot.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), AUTO = Q.has('autoplay'), DEBUG = Q.has('debug') || AUTO || DEMO;
const SPEED = +Q.get('speed') || 1;

// ---------------------------------------------------------------- saved stuff
const KEY = 'chatdungeon.v1';
const store = { best: 0, wins: 0, runs: 0, tut: false, sound: true, channel: '', keepSim: false };
try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
const save = () => { if (DEMO || AUTO) return; try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {} };

// ---------------------------------------------------------------- state
const view = new View($('c'));
const iconView = new View(document.createElement('canvas'));
view.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sound = new Sound(); sound.on = store.sound;
let game = null, chat = null, mode = 'title', paused = false, hold = false;
let twitch = null, twitchLive = false;
const colors = new Map(CAST.map(c => [c.name, c.color]));
const PALETTE = ['#ff5d8f', '#ffb84d', '#7ee05a', '#b59cff', '#4ce0d2', '#ff8a3d', '#6fb8ff', '#ffd23f', '#ff4fe0', '#9be35a', '#ff7a7a', '#7af0ff'];
const colorFor = (name, c) => { if (c) { colors.set(name, c); return c; } if (!colors.has(name)) { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0; colors.set(name, PALETTE[Math.abs(h) % PALETTE.length]); } return colors.get(name); };
view.colors = (n) => colors.get(n) || '#fff';

const isTouch = () => document.body.classList.contains('touch');
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
addEventListener('touchstart', () => { if (!isTouch()) { document.body.classList.add('touch'); fit(); setHow(); } }, { passive: true });

// ---------------------------------------------------------------- layout
const PORTRAIT = '(max-aspect-ratio: 1/1), (max-width: 700px) and (max-aspect-ratio: 4/3)';
function fit() {
  const st = $('stage');
  const portrait = matchMedia(PORTRAIT).matches;
  let w, h;
  if (portrait) {
    w = st.clientWidth - 12 - 8;
    const pad = isTouch() ? $('controls').offsetHeight || 168 : 0;
    h = Math.min(innerHeight * (isTouch() ? 0.44 : 0.56), w * 0.92, innerHeight - $('hud').offsetHeight - pad - 200);
  }
  else { w = st.clientWidth - 24 - 8; h = st.clientHeight - 20 - 8; }
  view.fit(Math.max(200, w), Math.max(120, h));
}
addEventListener('resize', fit);
addEventListener('orientationchange', () => setTimeout(fit, 200));

// ---------------------------------------------------------------- input
const keys = new Set();
const inp = { attackBuf: 0, dashBuf: 0, mouseDown: false, mouseAim: null, aHeld: false, joy: null };
const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
const ATTACK = ['Space', 'KeyJ', 'KeyZ'], DASH = ['ShiftLeft', 'ShiftRight', 'KeyK', 'KeyX'];
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') { if (e.code === 'Enter') $('bConnect').click(); return; }
  sound.init();
  if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); if (mode === 'play' || mode === 'tut') togglePause(); return; }
  if (e.code === 'KeyM') { toggleSound(); return; }
  if (sheetUp()) {
    if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); const f = document.activeElement; if (f && f.tagName === 'BUTTON' && f.closest('.veil:not([hidden])')) f.click(); else document.querySelector('.veil:not([hidden]) .btn.go')?.click(); }
    return;
  }
  if (MOVE[e.code] || ATTACK.includes(e.code) || DASH.includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (ATTACK.includes(e.code)) { inp.attackBuf = 0.16; inp.mouseAim = null; }
  if (DASH.includes(e.code)) inp.dashBuf = 0.16;
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); inp.mouseDown = false; inp.aHeld = false; endJoy(); });
const cv = $('c');
cv.addEventListener('pointerdown', (e) => {
  sound.init();
  if (!game || paused) return;
  const r = cv.getBoundingClientRect();
  const aim = view.toWorld(e.clientX - r.left - 4, e.clientY - r.top - 4);
  if (e.button === 2) { inp.dashBuf = 0.16; return; }
  inp.mouseDown = e.pointerType === 'mouse'; inp.mouseAim = aim; inp.attackBuf = 0.16;
});
cv.addEventListener('pointermove', (e) => { if (!inp.mouseDown) return; const r = cv.getBoundingClientRect(); inp.mouseAim = view.toWorld(e.clientX - r.left - 4, e.clientY - r.top - 4); });
addEventListener('pointerup', () => { inp.mouseDown = false; });
cv.addEventListener('contextmenu', (e) => e.preventDefault());

// touch stick: put a thumb down anywhere in the left zone
const joy = $('joy');
joy.addEventListener('pointerdown', (e) => {
  sound.init(); e.preventDefault();
  if (inp.joy) return;
  joy.setPointerCapture(e.pointerId);
  const r = joy.getBoundingClientRect();
  inp.joy = { id: e.pointerId, x0: e.clientX - r.left, y0: e.clientY - r.top, x: 0, y: 0 };
  $('joyBase').hidden = $('joyKnob').hidden = false; $('joyHint').hidden = true;
  moveJoy(e);
});
joy.addEventListener('pointermove', (e) => { if (inp.joy && e.pointerId === inp.joy.id) moveJoy(e); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) joy.addEventListener(ev, (e) => { if (inp.joy && e.pointerId === inp.joy.id) endJoy(); });
function moveJoy(e) {
  const r = joy.getBoundingClientRect(), j = inp.joy, R = 46;
  let dx = e.clientX - r.left - j.x0, dy = e.clientY - r.top - j.y0;
  const d = Math.hypot(dx, dy);
  if (d > R) { // drag the base along so a thumb that wanders keeps steering
    j.x0 += dx * (1 - R / d); j.y0 += dy * (1 - R / d); dx = e.clientX - r.left - j.x0; dy = e.clientY - r.top - j.y0;
  }
  j.x = dx / R; j.y = dy / R;
  const b = $('joyBase').style, k = $('joyKnob').style;
  b.left = j.x0 + 'px'; b.top = j.y0 + 'px'; k.left = (j.x0 + dx) + 'px'; k.top = (j.y0 + dy) + 'px';
}
function endJoy() { inp.joy = null; $('joyBase').hidden = $('joyKnob').hidden = true; }
const tbA = $('tbA'), tbB = $('tbB');
tbA.addEventListener('pointerdown', (e) => { e.preventDefault(); sound.init(); tbA.setPointerCapture(e.pointerId); inp.aHeld = true; inp.attackBuf = 0.16; inp.mouseAim = null; tbA.classList.add('down'); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) tbA.addEventListener(ev, () => { inp.aHeld = false; tbA.classList.remove('down'); });
tbB.addEventListener('pointerdown', (e) => { e.preventDefault(); sound.init(); inp.dashBuf = 0.16; tbB.classList.add('down'); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) tbB.addEventListener(ev, () => tbB.classList.remove('down'));

function readInput(dt) {
  let mx = 0, my = 0;
  for (const k of keys) if (MOVE[k]) { mx += MOVE[k][0]; my += MOVE[k][1]; }
  if (inp.joy) { const m = Math.hypot(inp.joy.x, inp.joy.y); if (m > 0.18) { mx += inp.joy.x; my += inp.joy.y; } }
  const held = ATTACK.some(k => keys.has(k)) || inp.mouseDown || inp.aHeld;
  const out = { mx, my, attack: held || inp.attackBuf > 0, dash: inp.dashBuf > 0, aim: inp.mouseAim };
  inp.attackBuf -= dt; inp.dashBuf -= dt;
  return out;
}

// ---------------------------------------------------------------- HUD
const HEART = (fill, stroke = '#1d1029') => `<svg viewBox="0 0 26 24"><path d="M13 21.5C4 15 2 11 2 7.6 2 4.5 4.5 2.5 7.3 2.5c2.3 0 4 1.3 5.7 3.4 1.7-2.1 3.4-3.4 5.7-3.4C21.5 2.5 24 4.5 24 7.6c0 3.4-2 7.4-11 13.9z" fill="${fill}" stroke="${stroke}" stroke-width="2.6" stroke-linejoin="round"/></svg>`;
let hudKey = '';
function hud() {
  const g = game; if (!g) return;
  const p = g.p;
  const key = [p.hp, p.max, p.shield, g.floor, g.roomIdx, g.room.type, Object.keys(p.relics).join(), g.curse?.kind, g.curse ? Math.ceil(g.curse.t) : 0, mode].join('|');
  if (key !== hudKey) {
    hudKey = key;
    let h = '';
    for (let i = 0; i < p.max; i++) h += HEART(i < p.hp ? '#ff4f6d' : '#4a3560');
    if (p.shield) h += HEART('#6fb8ff');
    $('hearts').innerHTML = h;
    const rt = g.room.type;
    $('whereA').textContent = rt === 'tutorial' ? 'Pre-stream' : rt === 'boss' ? 'The Ban Ogre' : `Floor ${g.floor}`;
    $('whereB').textContent = rt === 'tutorial' ? 'the green room' : rt === 'boss' ? 'floor 5, the last room' : g.floor >= FLOORS ? 'the shrine before the boss' : `room ${g.roomIdx + 1} of ${ROOMS} · ${ROOM_NAMES[rt].toLowerCase()}`;
    const rel = $('relics'); rel.innerHTML = '';
    for (const k of Object.keys(p.relics)) {
      const c = document.createElement('canvas'); c.width = c.height = 56; c.title = RELICS[k].name + ': ' + RELICS[k].text;
      const x = c.getContext('2d'); x.scale(2, 2); iconView.relicIcon(x, k, 14, 14, 8); rel.appendChild(c);
    }
    const ct = $('curseTag');
    ct.hidden = !g.curse;
    if (g.curse) ct.textContent = `${CURSES[g.curse.kind].name} ${Math.ceil(g.curse.t)}s`;
    $('skipTut').hidden = mode !== 'tut';
  }
  $('jarFill').style.width = (g.pool / POOL_MAX * 100) + '%';
  $('jarN').textContent = `${Math.floor(g.pool)} / ${POOL_MAX}`;
}

// ---------------------------------------------------------------- chat feed
const feed = $('feed');
const WHY = { jar: 'jar empty', crowded: 'room is full', cooldown: 'too soon', busy: 'too many traps', full: 'already full', already: 'already cursed', closed: 'not now' };
function esc(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function renderMsg(m) {
  const d = document.createElement('div');
  if (m.kind === 'sys') { d.className = 'm sys ' + (m.tone || ''); d.textContent = m.text; }
  else {
    d.className = 'm';
    const col = colorFor(m.user, m.color);
    let body = esc(m.text);
    if (m.cmd) {
      const ok = m.res?.ok;
      const cmdText = esc(m.text.match(/^\S+(\s+\w+)?/)[0]);
      const rest = esc(m.text.slice(m.text.match(/^\S+(\s+\w+)?/)[0].length));
      body = `<span class="cmd${ok ? '' : ' no'}">${cmdText}</span>${rest}`;
      if (ok && m.res.vote == null) { const c = costOf(m); if (c) body += `<span class="cost">−${c}</span>`; }
      if (!ok && WHY[m.res?.why]) body += `<span class="why">${WHY[m.res.why]}</span>`;
    }
    d.innerHTML = `<b style="color:${col}">${esc(m.user)}</b> ${body}`;
    if (m.cmd && m.res?.ok && m.res.vote == null) sound.play('chat');
  }
  feed.appendChild(d);
  while (feed.children.length > 60) feed.firstChild.remove();
}
function costOf(m) {
  const v = m.cmd; const a = (m.text.split(/\s+/)[1] || '').toLowerCase().replace(/s$/, '');
  if (v === 'spawn') return COST[a === 'skelly' ? 'skeleton' : a] || 0;
  return COST[v] || 0;
}

// ---------------------------------------------------------------- banners, coach
let banTimer = 0;
function banner(t, s = '', ms = 1600) {
  $('banT').textContent = t; $('banS').textContent = s; $('banS').hidden = !s;
  $('banner').classList.remove('off'); clearTimeout(banTimer);
  banTimer = setTimeout(() => $('banner').classList.add('off'), ms);
}
function coach(k, html, low = false) {
  $('coachK').textContent = k; $('coachT').innerHTML = html;
  $('coach').classList.toggle('off', !html); $('coach').classList.toggle('low', low);
}
const kb = (s) => `<kbd>${s}</kbd>`;

// ---------------------------------------------------------------- runs
function newChat(g) {
  if (!chat) {
    chat = new Chat(g, { sim: true, seed: (Math.random() * 1e9) | 0 });
    chat.onMsg = renderMsg;
  } else chat.setGame(g);
  chat.sim = !twitchLive || $('keepSim').checked;
  chat.scripted = false;
}
function startRun({ tutorial = false, floor = 1, seed, quiet = false } = {}) {
  sound.init();
  game = new Game({ seed: seed ?? (Math.random() * 1e9) | 0, tutorial, floor });
  newChat(game);
  view.event({ t: 'room' }, game);
  mode = tutorial ? 'tut' : 'play';
  paused = false;
  hideSheets();
  hudKey = '';
  coach('', '');
  if (tutorial) startTutorial();
  else {
    store.runs++; save();
    if (!quiet) chat.sys(twitchLive ? `LIVE · reading #${twitch.channel}` : 'STREAM STARTING', 'info');
    banner('Floor 1', 'Monster room');
  }
  fit();
}

function onEvent(e) {
  const g = game;
  view.event(e, g);
  chat?.event(e);
  switch (e.t) {
    case 'swing': sound.play('swing'); break;
    case 'hit': sound.play('hit'); break;
    case 'kill': sound.play(e.kind === 'boss' ? 'slam' : 'kill'); break;
    case 'hurt': sound.play('hurt'); if (e.user) chat.sys(`${e.user} got you`, 'bad'); break;
    case 'block': sound.play('block'); break;
    case 'dash': sound.play('dash'); inp.dashBuf = 0; break;
    case 'summon': sound.play('summon'); break;
    case 'appear': sound.play('appear'); break;
    case 'spike': sound.play('spike'); break;
    case 'curse': sound.play('curse'); chat.sys(`${e.user} cursed you: ${CURSES[e.kind].text}!`, 'bad'); break;
    case 'fizzle': sound.play('block'); chat.sys(`${e.user}'s curse fizzled on your hat`, 'good'); break;
    case 'bless': sound.play('bless'); chat.sys(`${e.user} ${e.kind === 'heal' ? 'healed you a heart' : 'gave you a shield'}`, 'good'); break;
    case 'relic': sound.play('relic'); banner(RELICS[e.relic].name, RELICS[e.relic].text, 2600); break;
    case 'heart': sound.play('heart'); break;
    case 'chest': sound.play('chest'); break;
    case 'shrine': sound.play('bless'); break;
    case 'slam': sound.play('slam'); break;
    case 'thud': sound.play('thud'); break;
    case 'roar': sound.play('roar'); chat.sys('The Ban Ogre calls for backup', 'bad'); break;
    case 'shoot': sound.play('shoot'); break;
    case 'wind': if (e.boss) sound.play('wind'); break;
    case 'vote': sound.play('vote'); break;
    case 'voteOpen': sound.play('voted'); chat.sys(`VOTE: !left ${DOOR_WORD[e.doors[0]]} or !right ${DOOR_WORD[e.doors[1]]}`); break;
    case 'voted': {
      sound.play('unlock');
      const d = g.room.doors;
      chat.sys(e.none ? `Nobody voted. Coin flip: ${DOOR_WORD[e.type]}` : e.tie ? `Tie! Coin flip: ${DOOR_WORD[e.type]}` : `Chat picked ${DOOR_WORD[e.type]} (${Math.max(d[0].votes, d[1].votes)}–${Math.min(d[0].votes, d[1].votes)})`);
      break;
    }
    case 'unlock': sound.play('unlock'); break;
    case 'clear': if (mode === 'play') chat.sys('Room clear', 'good'); break;
    case 'floor': chat.sys(`FLOOR ${e.floor}`, 'info'); break;
    case 'room': {
      if (mode !== 'play') break;
      if (e.type === 'boss') banner('The Ban Ogre', 'Chat can still spawn things. Of course they can.', 2400);
      else if (e.idx === 0 && e.floor > 1) banner(e.floor >= FLOORS ? 'Floor 5' : `Floor ${e.floor}`, ROOM_NAMES[e.type], 1600);
      else banner(ROOM_NAMES[e.type], `Floor ${e.floor} · room ${e.idx + 1}`, 1300);
      break;
    }
    case 'die': sound.play('die'); chat.sys(e.user ? `${e.user} ended the stream` : 'The dungeon got you', 'bad'); break;
    case 'win': sound.play('win'); chat.sys('DUNGEON CLEARED', 'good'); break;
    case 'tutorialDone': finishTutorial(); break;
  }
  if (e.t === 'trap') sound.play('trap');
}

// ---------------------------------------------------------------- tutorial
let tut = null;
function setHow() {
  $('howKeys').innerHTML = isTouch()
    ? 'Drag on the left side to walk. Tap <b>swing</b> (hold it to keep swinging; it aims at the nearest monster) and <b>dash</b> to zip past danger. While you dash, nothing can hurt you.'
    : `Move with ${kb('WASD')} or the arrow keys. Swing with ${kb('Space')}, ${kb('J')} or a click (a click aims at the cursor). Dash with ${kb('Shift')} or ${kb('K')}; nothing can hurt you mid-dash. ${kb('Esc')} pauses, ${kb('M')} mutes.`;
}
const T_MOVE = () => isTouch() ? 'Put your thumb down on the left side and drag to walk to the star.' : `Walk to the star with ${kb('WASD')} or the arrow keys.`;
const T_SWING = () => isTouch() ? 'Tap the pink <b>swing</b> button to whack the dummy. Three hits.' : `Whack the dummy three times: ${kb('Space')}, ${kb('J')}, or click it.`;
const T_DASH = () => isTouch() ? 'Spikes! Run at them and tap <b>dash</b> to zip across. Nothing can hurt you mid-dash.' : `Spikes! Run at them and ${kb('Shift')} or ${kb('K')} to dash across. Nothing can hurt you mid-dash.`;
function startTutorial() {
  const g = game;
  tut = { step: 'move', t: 0, marker: { x: T * 3.5, y: T * 4.5 } };
  chat.scripted = true;
  coach('step 1 of 6 · walk', T_MOVE());
  chat.sys('PRE-STREAM: the green room', 'info');
  chat.queue('mod_mabel', 'hi!! stream starts in a sec. warm up first', 0.6);
}
function tutTick(dt) {
  const g = game, p = g.p, s = tut; if (!s) return;
  s.t += dt;
  const next = (step) => { s.step = step; s.t = 0; };
  switch (s.step) {
    case 'move':
      if (Math.hypot(p.x - s.marker.x, p.y - s.marker.y) < 28) {
        s.marker = null; sound.play('unlock');
        g.spawnNow('dummy', W / 2 + 90, T * 5.2, null);
        coach('step 2 of 6 · swing', T_SWING());
        next('swing');
      }
      break;
    case 'swing':
      if (g.dummyHits >= 3) {
        g.ents = []; sound.play('unlock');
        g.spikes = [{ x0: T, x1: W - T, y0: T * 3, y1: T * 4 }];
        if (p.y < T * 4.4) { p.y = T * 5.5; }
        s.marker = { x: W / 2, y: T * 1.9 };
        coach('step 3 of 6 · dash', T_DASH());
        next('dash');
      }
      break;
    case 'dash':
      if (p.y < T * 2.7) {
        g.spikes = []; s.marker = null; sound.play('unlock');
        coach('step 4 of 6 · chat', 'This stream has a chat, and <b>chat is the dungeon master</b>. They spend from the <b>mischief jar</b> in the chat panel. It fills up as you play.');
        $('jar').classList.add('flash'); setTimeout(() => $('jar').classList.remove('flash'), 1600);
        g.poolOn = true; g.pool = 4;
        chat.queue('mod_mabel', 'ok chat, show them how it works', 0.8);
        chat.queue('goblinenjoyer', 'ooh can i', 2.2);
        next('chat');
      }
      break;
    case 'chat':
      g.pool = Math.min(POOL_MAX, g.pool + dt * 6);
      if (s.t > 3.3 && !s.spawned) {
        s.spawned = true; g.chatOn = true;
        chat.message('goblinenjoyer', colors.get('goblinenjoyer'), '!spawn goblin');
        coach('step 4 of 6 · chat', '<b>goblinenjoyer</b> spent 3 mischief on a goblin. It wears their name. When it crouches, it\'s about to lunge: step aside or dash, then whack it.');
      }
      if (s.spawned && s.t > 4.5 && !g.ents.length && !g.pending.length) {
        chat.queue('goblinenjoyer', 'noooo gerald', 0.2); chat.queue('pog_cannon', 'POG', 0.6);
        coach('step 5 of 6 · help and harm', 'Some chatters are kind: <b>!bless</b> heals you. Some are not: <b>!trap</b> puts spikes under you (step out of the red circle) and <b>!curse</b> does something rude.');
        next('mix');
      }
      break;
    case 'mix':
      if (s.t > 1.2 && !s.a) { s.a = true; chat.message('auntie_bev', colors.get('auntie_bev'), '!bless'); chat.queue('auntie_bev', 'there you go dear', 0.8); }
      if (s.t > 3.4 && !s.b) { s.b = true; chat.message('trapdad', colors.get('trapdad'), '!trap'); chat.queue('trapdad', 'watch your step kiddo', 0.4); }
      if (s.t > 6.2 && !s.c) {
        s.c = true; g.pool = Math.max(g.pool, COST.curse);
        g.forceCurse = 'fog';
        chat.message('cursegoblin_', colors.get('cursegoblin_'), '!curse');
        chat.queue('cursegoblin_', 'hehehe', 0.6);
      }
      if (s.c && s.t > 11.5) {
        g.curse = null; g.chatOn = false;
        g.room.phase = 'tutorialVote'; g.room.voteT = 7; g.room.votes.clear();
        coach('step 6 of 6 · vote', 'After every room, <b>chat votes</b> on which door opens next. You don\'t get a say. The signs show what\'s behind each one.', true);
        chat.sys('VOTE: !left MONSTERS or !right TREASURE');
        sound.play('voted');
        const order = [['goblinenjoyer', '!left'], ['auntie_bev', '!right'], ['pog_cannon', '!left'], ['cursegoblin_', '!left'], ['batfacts', '!right'], ['backseat_barry', '!right'], ['slimetime99', '!left'], ['lurk_lord', '!right'], ['bonezone', '!left']];
        order.forEach(([u, t], i) => chat.queue(u, t, 0.5 + i * 0.6));
        next('vote');
      }
      break;
    case 'vote':
      if (g.room.phase === 'open' && !s.opened) { s.opened = true; coach('last bit', 'Chat picked. Walk through the open door and <b>go live</b>.', true); }
      break;
  }
}
function finishTutorial() {
  store.tut = true; save();
  tut = null; coach('', '');
  chat.sys("YOU'RE LIVE", 'good');
  startRun({ quiet: true });
  chat.queue('mod_mabel', 'we are live!! welcome everyone', 0.6);
}

// ---------------------------------------------------------------- sheets
const sheetUp = () => !$('title').hidden || !$('pause').hidden || !$('end').hidden;
function hideSheets() { $('title').hidden = $('pause').hidden = $('end').hidden = true; }
function showTitle() {
  mode = 'title'; paused = false; hideSheets(); coach('', '');
  $('title').hidden = false;
  $('best').textContent = store.wins ? `Dungeon cleared ${store.wins} time${store.wins > 1 ? 's' : ''}. Best: floor 5.` : store.best ? `Best so far: floor ${store.best}.` : '';
  $('firstNote').hidden = !!store.tut;
  $('bTut').hidden = !store.tut;
  setTimeout(() => $('bGo').focus({ preventScroll: true }), 50);
}
function togglePause() {
  if (!game || game.over) return;
  paused = !paused;
  $('pause').hidden = !paused;
  game.paused = paused;
  $('pauseWhere').textContent = mode === 'tut' ? 'In the tutorial.' : `Floor ${game.floor}, room ${game.roomIdx + 1}. Chat's commands bounce while you're away.`;
  $('bRestart').textContent = mode === 'tut' ? 'Restart tutorial' : 'Restart run';
  if (paused) setTimeout(() => $('bResume').focus({ preventScroll: true }), 30);
}
function showEnd() {
  const g = game, won = g.over === 'won';
  mode = 'end';
  store.best = Math.max(store.best, g.floor); if (won) store.wins++; save();
  $('endT').textContent = won ? 'Dungeon cleared!' : 'Stream over';
  $('endS').textContent = won ? 'The Ban Ogre is down. Chat is (mostly) proud of you.' : `You fell on floor ${g.floor}${g.room.type === 'boss' ? ', fighting the Ban Ogre' : ''}.`;
  const secs = Math.round(g.time), mm = Math.floor(secs / 60), ss = String(secs % 60).padStart(2, '0');
  $('endStats').innerHTML = `<span>Floor reached</span><b>${g.floor}</b><span>Rooms cleared</span><b>${g.stats.rooms}</b><span>Monsters beaten</span><b>${g.stats.kills}</b><span>Hearts lost</span><b>${g.stats.hits}</b><span>Stream time</span><b>${mm}:${ss}</b>`;
  const U = Object.entries(g.stats.users);
  const top = (f) => U.filter(([, u]) => f(u) > 0).sort((a, b) => f(b[1]) - f(a[1]))[0];
  const aw = [];
  const add = (k, f, d) => { const t = top(f); if (t && !aw.some(a => a.n === t[0])) aw.push({ k, n: t[0], d: d(t[1]) }); };
  add('Chat MVP: hurt you the most', u => u.dmg, u => `${u.dmg} heart${u.dmg > 1 ? 's' : ''}, ${u.spawns} monster${u.spawns === 1 ? '' : 's'}, ${u.traps} trap${u.traps === 1 ? '' : 's'}`);
  add('Guardian angel', u => u.heals, u => `${u.heals} blessing${u.heals > 1 ? 's' : ''}`);
  add('Most cursed mouth', u => u.curses, u => `${u.curses} curse${u.curses > 1 ? 's' : ''}`);
  add('Monster parent', u => u.spawns, u => `spawned ${u.spawns}, you beat ${u.slain}`);
  add('Never misses a vote', u => u.votes, u => `${u.votes} vote${u.votes > 1 ? 's' : ''}`);
  $('awards').innerHTML = aw.slice(0, 3).map(a => `<div class="award"><div class="k">${a.k}</div><div class="n" style="color:${colorFor(a.n) === '#e8e2cf' ? '#1d1029' : '#1d1029'}">${esc(a.n)}</div><div class="d">${a.d}</div></div>`).join('');
  $('end').hidden = false;
  setTimeout(() => $('bAgain').focus({ preventScroll: true }), 50);
}

$('bGo').onclick = () => { sound.play('click'); store.tut ? startRun() : startRun({ tutorial: true }); };
$('bTut').onclick = () => { sound.play('click'); startRun({ tutorial: true }); };
$('bResume').onclick = () => togglePause();
$('bRestart').onclick = () => { const t = mode === 'tut'; hideSheets(); startRun({ tutorial: t }); };
$('bQuit').onclick = () => { game = null; chat?.setGame(null); showTitle(); };
$('bAgain').onclick = () => startRun();
$('bTitle').onclick = () => { game = null; chat?.setGame(null); showTitle(); };
$('skipTut').onclick = () => { store.tut = true; save(); tut = null; startRun(); };
$('bPause').onclick = () => { if (mode === 'play' || mode === 'tut') togglePause(); };
$('bSound').onclick = () => toggleSound();
function toggleSound() { store.sound = !store.sound; save(); sound.init(); sound.setOn(store.sound); $('sndWave').style.display = store.sound ? '' : 'none'; }
$('sndWave').style.display = store.sound ? '' : 'none';

// twitch
$('bReal').onclick = () => { $('twitch').hidden = !$('twitch').hidden; if (!$('twitch').hidden) $('chan').focus(); };
$('chan').value = store.channel || '';
$('keepSim').checked = !!store.keepSim;
$('keepSim').onchange = () => { store.keepSim = $('keepSim').checked; save(); if (chat) chat.sim = !twitchLive || store.keepSim; };
$('bConnect').onclick = () => {
  if (twitch) { twitch.close(); twitch = null; twitchLive = false; $('bConnect').textContent = 'Connect'; $('tStatus').textContent = 'Disconnected.'; $('src').textContent = 'simulated chat'; if (chat) chat.sim = true; return; }
  const ch = $('chan').value.trim();
  if (!ch) { $('tStatus').textContent = 'Type a channel name first.'; return; }
  store.channel = ch; save();
  twitch = connectTwitch(ch, onTwitch, (st, msg) => {
    $('tStatus').textContent = msg;
    twitchLive = st === 'live';
    $('src').textContent = twitchLive ? '#' + twitch?.channel : 'simulated chat';
    if (chat) chat.sim = !twitchLive || $('keepSim').checked;
  });
  if (twitch) $('bConnect').textContent = 'Disconnect';
};
function onTwitch({ user, color, text }) {
  colorFor(user, color && color.length === 7 ? brighten(color) : null);
  if (!chat) { chat = new Chat(null, { sim: false }); chat.onMsg = renderMsg; }
  if (!game || paused || mode === 'title' || mode === 'end') { chat.push({ kind: 'msg', user, color: colors.get(user), text }); return; }
  chat.message(user, colors.get(user), text);
}
// dark name colours vanish on the dark panel: lift them
function brighten(hex) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  if (l < 120) { const k = 120 / Math.max(1, l); r = Math.min(255, r * k + 40); g = Math.min(255, g * k + 40); b = Math.min(255, b * k + 40); }
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- loop
let last = performance.now(), botMem = { }, endT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  if (hold) return;
  step(dt * SPEED);
}
function step(dt) {
  const g = game;
  if (g && !paused) {
    const n = Math.max(1, Math.ceil(dt / (1 / 60)));
    for (let i = 0; i < n; i++) {
      const h = dt / n;
      const input = (DEMO || AUTO) ? botInput(g, botMem, 1) : readInput(h);
      if (g.forceCurse && g.curse) { g.curse.kind = g.forceCurse; g.curse.t = g.curse.dur = 4.5; g.forceCurse = null; }
      g.tick(h, input);
      chat.tick(h);
      for (const e of g.ev) onEvent(e);
      g.ev.length = 0;
      if (game !== g) return;
      if (mode === 'tut') tutTick(h);
    }
    if (g.over && mode === 'play') { endT += dt; if (endT > (g.over === 'won' ? 2.6 : 1.8)) { endT = 0; if (!DEMO) showEnd(); else if (AUTO) {} } } else endT = 0;
  } else if (chat && !game) chat.tick(dt);
  if (g) {
    view.frame(g, paused ? 0 : dt, { marker: tut?.marker });
    hud();
    const boss = g.room.type === 'boss';
    sound.tickMusic(mode === 'play' && !g.over && !paused ? (boss ? 1 : 0.6) : 0);
  }
}

// ---------------------------------------------------------------- boot
setHow();
fit();
if (DEMO) {
  document.body.classList.add('demo');
  game = new Game({ seed: 77, floor: 2 });
  newChat(game);
  view.event({ t: 'room' }, game);
  mode = 'play';
  game.pool = 18; game.room.age = 2;
  const lines = [['lurk_lord', 'hi'], ['trapdad', 'hi hungry, im trapdad'], ['batfacts', 'bat fact: a group of bats is called a colony'], ['goblinenjoyer', 'goblin rights'], ['auntie_bev', 'remember to drink water'], ['bonezone', 'spooky'],['mod_mabel', 'welcome in everyone!!'], ['batfacts', 'bat fact: most bats are not blind'], ['auntie_bev', 'hello everyone! is this the dungeon'], ['pog_cannon', 'LETS GOOO'],
    ['backseat_barry', 'you should dash more'], ['cursegoblin_', 'curse him. curse him again'], ['slimetime99', 'splorch'], ['goblinenjoyer', '!spawn goblin'], ['bonezone', '!spawn skeleton'], ['batfacts', '!spawn bat'], ['pog_cannon', 'POG']];
  for (const [u, t] of lines) chat.message(u, colors.get(u), t);
  game.room.waveWait = 0.1;
  hudKey = '';
} else if (AUTO) {
  startRun({ floor: +Q.get('floor') || 1, seed: +Q.get('seed') || undefined });
} else showTitle();
fit();
requestAnimationFrame((t) => { last = t; frame(t); });
document.fonts?.ready.then(() => { hudKey = ''; });

if (DEBUG) window.cd = { get game() { return game; }, get chat() { return chat; }, view, step, start: startRun, set hold(v) { hold = v; }, get mode() { return mode; }, get tut() { return tut; }, inp, keys, store };
