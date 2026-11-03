import { LEVELS } from './levels.js';
import { Game } from './sim.js';
import { Bot } from './bot.js';
import { bakeWorld, figure, flame, conePoly, INK, BONE, TORCH, BLOOD } from './render.js';
import { Sound } from './audio.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug');
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const lightCv = document.createElement('canvas'), lctx = lightCv.getContext('2d');
const coarse = matchMedia('(pointer: coarse)').matches;
if (coarse) document.body.classList.add('coarse');
const snd = new Sound();

// ---- saved progress
const SAVE = 'invader.v1';
let save = { won: {}, lessons: false, sound: true };
try { save = { ...save, ...JSON.parse(localStorage.getItem(SAVE) || '{}') }; } catch {}
const store = () => { try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch {} };
snd.on = save.sound;

const levels = LEVELS.map(f => f());

// ---- state
let game = null, level = null, levelIdx = 0, worldTex = null, bot = null;
let cam = { x: 0, y: 0, s: 1 }, W = 0, H = 0, dpr = 1;
let running = false, paused = false, endT = 0, shake = 0, fx = [], slashes = [], stampT = 0;
let tut = null, hold = false;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const m = Math.min(W, H);
  cam.s = m / (m < 600 ? 420 : 540);
  lightCv.width = Math.ceil(W / 4); lightCv.height = Math.ceil(H / 4);
  if (level) bake();
}
function bake() {
  let k = Math.min(2, cam.s * dpr);
  while (level.W * level.H * k * k > 8e6) k *= 0.9;
  worldTex = bakeWorld(level, k);
}
addEventListener('resize', resize);

// ---- starting an area
function start(idx, opts = {}) {
  levelIdx = idx; level = levels[idx];
  const tutorial = !!opts.tutorial;
  game = new Game(level, { seed: opts.seed ?? (Math.random() * 1e9) | 0, tutorial, susMult: tutorial ? 0.6 : 1 });
  bake();
  cam.x = game.player.x; cam.y = game.player.y;
  fx = []; slashes = []; endT = 0; shake = 0;
  running = true; paused = false;
  bot = DEMO ? new Bot(game, { react: 0.3 }) : null;
  $('aN').textContent = level.n; $('aName').textContent = level.name; $('aHost').textContent = level.host.name;
  $('actL').textContent = level.gesture.verb; $('act').setAttribute('aria-label', level.gesture.verb);
  $('stabL').textContent = 'Stab';
  $('hud').classList.remove('off');
  for (const p of ['title', 'pauseP', 'endP']) $(p).classList.remove('on');
  stamp('');
  tut = null;
  if (tutorial) startLessons(opts.from || 0);
  else hideTut();
  input.walkTo = null;
}

// ---- input
const input = { keys: new Set(), ptr: null, walkTo: null, gestureBtn: false, gestureKey: false, stab: false };
const KEYMOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
addEventListener('keydown', e => {
  snd.init();
  if (e.code === 'Escape' || e.code === 'KeyP') { if (running) togglePause(); return; }
  if (KEYMOVE[e.code]) { input.keys.add(e.code); input.walkTo = null; e.preventDefault(); }
  if (e.code === 'Space') { input.gestureKey = true; e.preventDefault(); }
  if (e.code === 'KeyF' || e.code === 'KeyE' || e.code === 'Enter') { input.stab = true; e.preventDefault(); }
});
addEventListener('keyup', e => {
  input.keys.delete(e.code);
  if (e.code === 'Space') input.gestureKey = false;
});
addEventListener('blur', () => { input.keys.clear(); input.gestureKey = false; input.gestureBtn = false; input.ptr = null; });
const toWorld = (sx, sy) => ({ x: cam.x + (sx - W / 2) / cam.s, y: cam.y + (sy - H / 2) / cam.s });
cv.addEventListener('pointerdown', e => {
  snd.init();
  if (!running || paused) return;
  cv.setPointerCapture?.(e.pointerId);
  input.ptr = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() };
  input.walkTo = toWorld(e.clientX, e.clientY);
});
cv.addEventListener('pointermove', e => {
  if (!input.ptr || input.ptr.id !== e.pointerId) return;
  input.ptr.sx = e.clientX; input.ptr.sy = e.clientY;
});
const ptrUp = e => {
  const p = input.ptr;
  if (!p || p.id !== e.pointerId) return;
  input.ptr = null;
  // a quick tap walks you there; letting go of a long hold stops you where you are
  const tap = performance.now() - p.t0 < 280 && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 14;
  if (tap) input.walkTo = toWorld(e.clientX, e.clientY);
  else input.walkTo = null;
};
cv.addEventListener('pointerup', ptrUp);
cv.addEventListener('pointercancel', ptrUp);

function bindHold(el, on, off) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); snd.init(); el.setPointerCapture?.(e.pointerId); el.classList.add('held'); on(); });
  const up = () => { el.classList.remove('held'); off?.(); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
bindHold($('act'), () => { input.gestureBtn = true; }, () => { input.gestureBtn = false; });
bindHold($('stab'), () => { input.stab = true; });

function feedInput() {
  const I = game.input, p = game.player;
  let mx = 0, my = 0;
  for (const k of input.keys) { mx += KEYMOVE[k][0]; my += KEYMOVE[k][1]; }
  if (input.ptr) input.walkTo = toWorld(input.ptr.sx, input.ptr.sy);
  if (!mx && !my && input.walkTo) {
    const dx = input.walkTo.x - p.x, dy = input.walkTo.y - p.y, d = Math.hypot(dx, dy);
    if (d < 5) { if (!input.ptr) input.walkTo = null; }
    else { const k = Math.min(1, d / 12); mx = dx / d * k; my = dy / d * k; }
  }
  I.mx = mx; I.my = my;
  I.gesture = input.gestureBtn || input.gestureKey;
  if (input.stab) { I.stab = true; input.stab = false; }
}

// ---- lessons
const LESSONS = [
  { id: 'walk', text: () => coarse
      ? '<b>This is you</b>: the soldier with the red thread round their arm. Nobody else can see it. Hold a finger where you want to walk.'
      : '<b>This is you</b>: the soldier with the red thread round their arm. Nobody else can see it. Walk with <b>WASD</b>, or click and hold where you want to go.' },
  { id: 'path', text: () => 'The dead keep to the <b>worn paths</b>, the pale tracks between the graves. Walk along one for a few steps.' },
  { id: 'bell', text: () => `Listen. When the <b>bell</b> tolls, all the dead kneel. Hold <b>Kneel</b>${coarse ? '' : ' (Space)'} with them until it stops.` },
  { id: 'host', ask: true, text: () => 'Here comes the <b>host</b>, with a torch, cutting the dead down as they go. The <b>eye</b> over their head fills when they see you act wrong: off the paths, standing alone, walking straight at them, or not kneeling.' },
  { id: 'stab', text: () => `Sir Aldous is careful. Now and then they <b>stop and glance back</b>. Stay out of their torchlight, get right behind them, and <b>Stab</b>${coarse ? '' : ' (F)'}.` },
];
function startLessons(from) {
  tut = { i: from, t: 0, done: false };
  game.bellsOn = from >= 4; game.hostOn = from >= 3;
  if (from >= 3) game.bell.t = 12;
  showLesson();
}
function showLesson() {
  const L = LESSONS[tut.i];
  tut.t = 0; tut.knelt = 0; tut.rung = false;
  $('tutN').textContent = `Lesson ${tut.i + 1} of ${LESSONS.length}`;
  $('tutP').innerHTML = L.text();
  $('tut').classList.toggle('ask', !!L.ask);
  $('tut').classList.add('in');
  if (L.id === 'path') game.player.onPathT = 0;
  if (L.id === 'bell') { game.bellsOn = true; game.ringBell(3.2); }
  if (L.id === 'host') { game.hostOn = true; game.bellsOn = false; }
  if (L.id === 'stab') { game.bellsOn = true; game.bell.state = 'wait'; game.bell.t = 16; }
}
function nextLesson() {
  tut.i++;
  if (tut.i >= LESSONS.length) { hideTut(); tut = null; return; }
  showLesson();
}
function hideTut() { $('tut').classList.remove('in'); }
function stepLessons(dt) {
  if (!tut) return;
  const L = LESSONS[tut.i], g = game, p = g.player;
  tut.t += dt;
  if (L.id === 'walk' && p.dist > 140) nextLesson();
  else if (L.id === 'path' && p.onPathT > 2.5) nextLesson();
  else if (L.id === 'bell') {
    if (g.bell.state === 'ring') { tut.rung = true; if (p.gest) tut.knelt += dt; }
    else if (tut.rung && g.bell.state === 'wait') {
      if (tut.knelt > g.L.bell.dur * 0.55) { g.bellsOn = false; nextLesson(); }
      else {
        tut.rung = false; tut.knelt = 0;
        $('tutP').innerHTML = `Not quite. Watch the dead: the moment the bell tolls, hold <b>Kneel</b>${coarse ? '' : ' (Space)'} and keep holding until they stand.`;
        g.ringBell(3.5);
      }
    }
  } else if (L.id === 'host' && tut.t > 14) nextLesson();
}
$('tutGo').addEventListener('click', () => { if (tut && LESSONS[tut.i].ask) nextLesson(); });
$('tutSkip').addEventListener('click', () => {
  save.lessons = true; store();
  hideTut(); tut = null;
  game.bellsOn = true; game.hostOn = true; game.susMult = 1;
  if (game.bell.state !== 'ring') { game.bell.state = 'wait'; game.bell.t = 10; }
});

// ---- pages
function stamp(text, cls = '') {
  const el = $('stamp');
  el.className = cls; el.textContent = text;
  if (text) { requestAnimationFrame(() => el.classList.add('in')); stampT = 2.2; }
}
function togglePause() {
  if (!running || game.outcome) return;
  paused = !paused;
  $('pauseP').classList.toggle('on', paused);
  if (paused) {
    $('pRun').textContent = `${level.n} · ${level.name}`;
    $('pHabit').textContent = habitText(level);
  }
}
function habitText(L) {
  return {
    glance: `${L.host.name} is ${L.host.epithet}: every so often they stop, and glance back over their shoulder.`,
    impatient: `${L.host.name} is ${L.host.epithet}: hates anyone standing about, and forgets things, turning back the way they came.`,
    devout: `${L.host.name} is ${L.host.epithet}: watches the choir closely while the bell rings, and turns to bless the nave behind them.`,
  }[L.habit];
}
$('pauseB').addEventListener('click', e => { e.stopPropagation(); snd.init(); togglePause(); });
$('resume').addEventListener('click', togglePause);
$('restart').addEventListener('click', () => { paused = false; start(levelIdx); });
$('toAreas').addEventListener('click', () => { paused = false; showTitle(); });
const sndLabel = () => { for (const id of ['sndT', 'sndP']) $(id).textContent = 'Sound: ' + (save.sound ? 'on' : 'off'); };
for (const id of ['sndT', 'sndP']) $(id).addEventListener('click', () => { snd.init(); save.sound = !save.sound; snd.setOn(save.sound); store(); sndLabel(); });
sndLabel();
$('lessons').addEventListener('click', () => { snd.init(); start(0, { tutorial: true }); });

const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function showTitle() {
  running = false;
  $('hud').classList.add('off');
  for (const p of ['pauseP', 'endP']) $(p).classList.remove('on');
  $('title').classList.add('on');
  if (!coarse) {
    document.querySelector('.h-walk').textContent = 'WASD or arrow keys, or click and hold where you want to go.';
    document.querySelector('.h-bell').textContent = 'When it tolls, everyone stops to kneel, bow or sing. Hold Space with them.';
    document.querySelector('.h-stab').textContent = 'From behind, press F when the button lights up.';
  }
  const ul = $('areas'); ul.innerHTML = '';
  levels.forEach((L, i) => {
    const open = i === 0 || save.won[levels[i - 1].id];
    const best = save.won[L.id];
    const li = document.createElement('li');
    if (!open) li.className = 'locked';
    li.innerHTML = `<span class="n">${L.n}</span><span><div class="nm">${L.name}</div><div class="sub">${open ? `${L.host.name}, ${L.host.epithet}.${best ? ` Best ${fmt(best)}.` : ''}` : `Slay the host of ${levels[i - 1].name.toLowerCase()} first.`}</div></span>`;
    const b = document.createElement('button');
    b.className = 'btn'; b.textContent = best ? 'Again' : 'Enter';
    b.disabled = !open;
    b.addEventListener('click', () => { snd.init(); start(i, { tutorial: i === 0 && !save.lessons }); });
    li.appendChild(b);
    ul.appendChild(li);
  });
  drawPlate();
  // keep a living area behind the sheet
  level = levels[levelIdx]; game = new Game(level, { seed: 5, susMult: 0 }); bot = null; bake();
  for (let i = 0; i < 60 * 20; i++) game.step(1 / 60);
  game.events.length = 0;
}

function showEnd() {
  const won = game.outcome === 'win', L = level;
  $('eRun').textContent = `${L.n} · ${L.name}`;
  $('eTag').textContent = won ? 'Slain' : 'Found out';
  $('eHead').textContent = won ? (game.why ? 'Slain, the hard way' : 'The host is slain') : 'Cut down';
  $('eWhy').textContent = won
    ? (game.why ? `They found you out, and you fought them anyway. ${L.host.name} won’t believe it.` : `${L.host.name} never saw you coming.`)
    : (game.why || `${L.host.name} found you out.`);
  const t = game.t;
  let best = save.won[L.id];
  if (won) { if (!best || t < best) { save.won[L.id] = t; best = t; } save.lessons = save.lessons || L.id === 'graveyard'; store(); }
  $('eStats').innerHTML = `<dt>Time</dt><dd>${fmt(t)}${won && best ? ` (best ${fmt(best)})` : ''}</dd>`
    + `<dt>${L.folk[0].toUpperCase() + L.folk.slice(1)} cut down</dt><dd>${game.host.victims}</dd>`
    + `<dt>Closest call</dt><dd>${Math.round(game.peakSus)}% of the host’s eye</dd>`;
  const row = $('eRow'); row.innerHTML = '';
  const btn = (t, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = t; b.addEventListener('click', fn); row.appendChild(b); };
  if (won && levelIdx < levels.length - 1) btn(`On to ${levels[levelIdx + 1].name.toLowerCase()}`, '', () => start(levelIdx + 1));
  if (!won) btn('Try again', '', () => start(levelIdx, tut ? { tutorial: true, from: 3 } : {}));
  btn(won ? 'Again' : 'Areas', 'ghost', () => won ? start(levelIdx) : showTitle());
  if (won) btn('Areas', 'ghost', showTitle);
  $('endP').classList.add('on');
}

// ---- the title plate: a line of the hollow with one red thread among them, and the host with a torch
function drawPlate() {
  const c = $('plate'), r = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
  c.width = Math.round(r.width * d); c.height = Math.round(r.height * d);
  const x = c.getContext('2d');
  x.setTransform(d, 0, 0, d, 0, 0);
  x.fillStyle = INK; x.fillRect(0, 0, r.width, r.height);
  x.strokeStyle = BONE; x.lineCap = 'round';
  for (let i = 0; i < 220; i++) {
    const px = Math.random() * r.width, py = Math.random() * r.height;
    x.globalAlpha = 0.08 + Math.random() * 0.12; x.lineWidth = 1 + Math.random();
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + 6 + Math.random() * 6, py + (Math.random() - 0.5) * 2); x.stroke();
  }
  x.globalAlpha = 1;
  const g = x.createRadialGradient(r.width - 60, r.height / 2, 4, r.width - 60, r.height / 2, 120);
  g.addColorStop(0, 'rgba(232,137,43,.5)'); g.addColorStop(1, 'rgba(232,137,43,0)');
  x.fillStyle = g; x.fillRect(0, 0, r.width, r.height);
  x.save(); x.scale(1.6, 1.6);
  const n = Math.floor((r.width - 110) / 40);
  for (let i = 0; i < n; i++) figure(x, { x: 22 + i * 25, y: r.height / 3.2 + (i % 2) * 6, face: 0, walk: i * 1.7, kind: i === Math.floor(n * 0.6) ? 'player' : 'npc' });
  x.restore();
  x.save(); x.scale(1.6, 1.6);
  const hx = (r.width - 60) / 1.6, hy = r.height / 3.2 + 2;
  figure(x, { x: hx, y: hy, face: Math.PI, kind: 'host', walk: 1 });
  flame(x, hx + Math.cos(Math.PI) * 12 - Math.sin(Math.PI) * -13, hy + 13, 0.4, 0.9);
  x.restore();
}

// ---- events -> sound and pictures
function handleEvents() {
  for (const e of game.events) {
    switch (e.type) {
      case 'toll': snd.toll(); break;
      case 'warn': snd.warn(); break;
      case 'windup': snd.windup(); break;
      case 'slash': snd.slash(); slashes.push({ x: game.host.x, y: game.host.y, a: game.host.face, t: 0 }); break;
      case 'kill': snd.kill(); dust(e.x, e.y, 14); shake = Math.max(shake, 3); break;
      case 'stab': snd.stab(); dust(game.host.x, game.host.y, 30); shake = 8; stamp('The host is slain', 'gold'); break;
      case 'found': snd.found(); shake = 6; stamp('Found out', 'red');
        $('actL').textContent = 'Roll'; $('stabL').textContent = 'Strike'; hideTut(); break;
      case 'roll': snd.roll(); break;
      case 'parry': snd.parry(); break;
      case 'hit': snd.hit(); dust(e.x, e.y, 12); shake = 5; break;
      case 'cut': snd.cut(); shake = 9; stamp('Cut down', 'red'); break;
      case 'tell': snd.tell(); break;
    }
  }
  game.events.length = 0;
}
function dust(x, y, n) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 20 + Math.random() * 70; fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.5 + Math.random() * 0.6, r: 1 + Math.random() * 2 }); }
}

// ---- drawing
function draw(t, dt) {
  const g = game, L = level, h = g.host, p = g.player;
  // camera: you, or the host in the demo and behind the title sheet
  let follow = DEMO || !running ? { x: h.entered ? h.x * 0.6 + p.x * 0.4 : p.x, y: h.entered ? h.y * 0.6 + p.y * 0.4 : p.y } : p;
  // keep yourself clear of the lesson slip
  if (tut && running && H > W) follow = { x: follow.x, y: follow.y - 70 / cam.s };
  cam.x += (follow.x - cam.x) * Math.min(1, dt * 4);
  cam.y += (follow.y - cam.y) * Math.min(1, dt * 4);
  const vw = W / cam.s, vh = H / cam.s;
  cam.x = vw >= L.W ? L.W / 2 : Math.max(vw / 2, Math.min(L.W - vw / 2, cam.x));
  cam.y = vh >= L.H ? L.H / 2 : Math.max(vh / 2, Math.min(L.H - vh / 2, cam.y));
  shake = Math.max(0, shake - dt * 20);
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  const ox = W / 2 - cam.x * cam.s + sx, oy = H / 2 - cam.y * cam.s + sy;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = INK; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * ox, dpr * oy);
  ctx.drawImage(worldTex, 0, 0, L.W, L.H);

  // lesson: make the paths glow
  if (tut && LESSONS[tut.i].id === 'path') {
    ctx.strokeStyle = BONE; ctx.lineCap = 'round'; ctx.lineWidth = 30;
    ctx.globalAlpha = 0.12 + Math.sin(t * 4) * 0.08;
    ctx.beginPath(); for (const s of L.segs) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); } ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // bodies, then the living
  const pose = L.gesture.pose;
  for (const n of g.npcs) if (n.state === 'dead') figure(ctx, { x: n.x, y: n.y, face: n.face, dead: 1, alpha: Math.max(0.35, 1 - n.dead / 30) });
  for (const n of g.npcs) if (n.state !== 'dead') figure(ctx, { x: n.x, y: n.y, face: n.face, walk: n.state === 'walk' && n.gest === 0 ? n.walk : 0, g: n.gest, pose });
  const pg = g.mode === 'sneak' ? (p.gest ? Math.min(1, p.gestT * 4) : 0) : 0;
  if (!(g.outcome === 'lose')) figure(ctx, { x: p.x + Math.cos(p.face) * p.lunge * 18, y: p.y + Math.sin(p.face) * p.lunge * 18, face: p.face, walk: p.walk, g: pg, pose, kind: 'player' });
  else figure(ctx, { x: p.x, y: p.y, face: p.face, dead: 1, kind: 'player' });
  if (g.hostOn) {
    if (h.state === 'dying') figure(ctx, { x: h.x, y: h.y, face: h.face, dead: 1, kind: 'host' });
    else figure(ctx, { x: h.x, y: h.y, face: h.face, walk: h.walk, kind: 'host', windup: h.state === 'windup' ? 1 : 0, swing: h.swing / 0.3 });
  }
  // a windup is shown as the arc it will cut
  if (g.hostOn && h.state === 'windup') {
    ctx.fillStyle = 'rgba(192,57,43,.22)'; ctx.strokeStyle = BLOOD; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.arc(h.x, h.y, 64, h.face - 1, h.face + 1); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  for (const s of slashes) {
    s.t += dt;
    ctx.strokeStyle = BONE; ctx.globalAlpha = Math.max(0, 1 - s.t / 0.25); ctx.lineWidth = 5 * (1 - s.t / 0.25) + 1;
    ctx.beginPath(); ctx.arc(s.x, s.y, 48, s.a - 1 + s.t * 2, s.a + 0.6 + s.t * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  slashes = slashes.filter(s => s.t < 0.25);
  for (const f of fx) {
    f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.92; f.vy *= 0.92;
    ctx.fillStyle = BONE; ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
    ctx.fillRect(f.x, f.y, f.r, f.r);
  }
  ctx.globalAlpha = 1;
  fx = fx.filter(f => f.t < f.life);

  // light: dim everything, warm it near the torch and the lanterns
  const lw = lightCv.width, lh = lightCv.height, ls = cam.s / 4;
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.globalCompositeOperation = 'source-over';
  lctx.fillStyle = `rgb(${L.ambient.join(',')})`; lctx.fillRect(0, 0, lw, lh);
  lctx.setTransform(ls, 0, 0, ls, (ox) / 4, (oy) / 4);
  lctx.globalCompositeOperation = 'lighter';
  const glow = (x, y, r, c0, a) => { const gr = lctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c0.replace('A', a)); gr.addColorStop(1, c0.replace('A', 0)); lctx.fillStyle = gr; lctx.fillRect(x - r, y - r, r * 2, r * 2); };
  const fl = 1 + Math.sin(t * 13) * 0.03 + Math.sin(t * 29) * 0.02;
  if (g.hostOn && h.state !== 'dying') {
    glow(h.x, h.y, L.host.torch * fl, 'rgba(255,170,90,A)', 0.95);
    if (h.entered && g.mode === 'sneak') {
      // the torch throws its light where they're looking
      const poly = conePoly(g, h, 24);
      lctx.beginPath(); poly.forEach((q, i) => i ? lctx.lineTo(q[0], q[1]) : lctx.moveTo(q[0], q[1])); lctx.closePath();
      lctx.fillStyle = 'rgba(120,70,30,.55)'; lctx.fill();
    }
  }
  for (const li of L.lights) glow(li.x, li.y, li.r * fl, 'rgba(240,150,70,A)', li.i);
  glow(p.x, p.y, 80, 'rgba(110,100,90,A)', 0.6);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(lightCv, 0, 0, cv.width, cv.height);
  ctx.globalCompositeOperation = 'source-over';

  // unlit marks on top: the flame, your thread, the eye
  ctx.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * ox, dpr * oy);
  // the host's sight
  if (g.hostOn && h.entered && h.state !== 'dying' && g.mode === 'sneak') {
    const poly = conePoly(g, h);
    ctx.beginPath(); poly.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath();
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = h.sus > 55 ? 'rgba(192,57,43,.22)' : 'rgba(232,137,43,.13)'; ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([3, 6]); ctx.lineWidth = 1.6; ctx.strokeStyle = h.sus > 55 ? 'rgba(192,57,43,.55)' : 'rgba(235,227,208,.32)'; ctx.stroke(); ctx.setLineDash([]);
  }

  if (g.hostOn && h.state !== 'dying') {
    const c = Math.cos(h.face), s = Math.sin(h.face), S = 1.35;
    flame(ctx, h.x + (c * 10 - s * -12) * S, h.y + (s * 10 + c * -12) * S, t, 1.1);
  }
  for (const li of L.lights) flame(ctx, li.x, li.y, t + li.x, 0.7);
  if (g.outcome !== 'lose') {
    ctx.strokeStyle = BLOOD; ctx.lineWidth = 2.2; ctx.setLineDash([5, 4]); ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(p.x, p.y, 18, t * 0.8, t * 0.8 + Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    // a little red pennant above you, so you can find yourself in a crowd
    const by = p.y - 26 + Math.sin(t * 3) * 1.5;
    ctx.fillStyle = BLOOD; ctx.beginPath(); ctx.moveTo(p.x - 5, by - 6); ctx.lineTo(p.x + 5, by - 6); ctx.lineTo(p.x, by + 1); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (g.canStab() && g.mode === 'sneak') {
    ctx.strokeStyle = TORCH; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(h.x, h.y, 22 + Math.sin(t * 10) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  if (input.walkTo && running && !input.ptr) {
    ctx.strokeStyle = BONE; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5;
    const w = input.walkTo; ctx.beginPath(); ctx.moveTo(w.x - 5, w.y - 5); ctx.lineTo(w.x + 5, w.y + 5); ctx.moveTo(w.x + 5, w.y - 5); ctx.lineTo(w.x - 5, w.y + 5); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // the eye, in screen space so it stays the same size
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (g.hostOn && h.entered && h.state !== 'dying') {
    let ex = h.x * cam.s + ox, ey = h.y * cam.s + oy - 40;
    const off = ex < 20 || ex > W - 20 || ey < 70 || ey > H - 20;
    if (off) {
      // pin it to the edge, pointing the way
      const cx = Math.max(30, Math.min(W - 30, ex)), cy = Math.max(84, Math.min(H - 110, ey));
      const a = Math.atan2(ey - cy, ex - cx);
      ctx.fillStyle = TORCH; ctx.save(); ctx.translate(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-4, -6); ctx.lineTo(-4, 6); ctx.closePath(); ctx.fill(); ctx.restore();
      ex = cx; ey = cy;
    }
    drawEye(ex, ey, h.sus, Math.atan2(p.y - h.y, p.x - h.x), h.state === 'curious', t, h.state === 'tell' || h.state === 'glance' || h.state === 'bless');
    const tags = g.mode === 'sneak' ? g.reasons : [];
    ctx.font = '700 13px "Alegreya SC", Georgia, serif'; ctx.textAlign = 'center';
    tags.forEach((r, i) => {
      const txt = r[0], w = ctx.measureText(txt).width + 12, y = ey + 26 + i * 18;
      ctx.fillStyle = BLOOD; ctx.fillRect(ex - w / 2, y - 11, w, 16);
      ctx.fillStyle = BONE; ctx.fillText(txt, ex, y + 1);
    });
  }
  // in a lesson, say what would give you away even when nobody's looking
  if (tut && g.mode === 'sneak' && (!g.hostOn || !g.seen)) {
    const px = p.x * cam.s + ox, py = p.y * cam.s + oy;
    ctx.font = 'italic 14px Alegreya, Georgia, serif'; ctx.textAlign = 'center';
    (g.wouldBe || []).slice(0, 1).forEach(r => {
      ctx.fillStyle = 'rgba(235,227,208,.85)';
      ctx.fillText(r[0].toLowerCase() + (g.hostOn ? '' : ' (nobody’s watching yet)'), px, py + 34);
    });
  }
  if (g.mode === 'duel' && g.hostOn && h.state !== 'dying') {
    // their health, three pips
    const hx = h.x * cam.s + ox, hy = h.y * cam.s + oy + 30;
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i < h.hp ? TORCH : 'rgba(235,227,208,.25)'; ctx.fillRect(hx - 20 + i * 14, hy, 10, 5); }
  }
}

function drawEye(x, y, sus, look, curious, t, wary) {
  const k = sus / 100;
  const open = 5 + k * 6 + (curious ? 3 : 0) + (wary ? 2 : 0);
  ctx.save(); ctx.translate(x, y);
  // almond, carved from a black block
  ctx.fillStyle = INK; ctx.strokeStyle = BONE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-19, 0); ctx.quadraticCurveTo(0, -open * 2.1, 19, 0); ctx.quadraticCurveTo(0, open * 2.1, -19, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.save(); ctx.clip();
  // the iris fills from the bottom with red as suspicion builds
  ctx.fillStyle = BONE; ctx.beginPath(); ctx.arc(Math.cos(look) * 5, Math.sin(look) * 2, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = sus > 55 ? BLOOD : TORCH;
  ctx.fillRect(-20, 12 - k * 24, 40, 24);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(Math.cos(look) * 5, Math.sin(look) * 2, 2.6 + k * 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // lashes when wary
  if (wary || curious) {
    ctx.strokeStyle = curious ? BLOOD : BONE; ctx.lineWidth = 2;
    for (const a of [-0.9, -0.3, 0.3, 0.9]) { ctx.beginPath(); ctx.moveTo(Math.sin(a) * 14, -open * 1.05); ctx.lineTo(Math.sin(a) * 20, -open * 1.05 - 6); ctx.stroke(); }
  }
  ctx.restore();
}

// ---- HUD bits that follow the game
let lastBell = '';
function hud() {
  const b = game.bell.state === 'ring' ? 'ring' : (game.bell.state === 'wait' && game.bellsOn && game.bell.t < 2.2 ? 'warn' : '');
  if (b !== lastBell) { $('bell').className = b; lastBell = b; }
  $('stab').classList.toggle('live', game.canStab());
}

// ---- loop
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const t = now / 1000;
  if (!game) return;
  if (!hold) tick(dt);
  draw(t, dt);
}
function tick(dt) {
  const live = running && !paused;
  if (live || !running) {
    acc += dt;
    let n = 0;
    while (acc >= 1 / 60 && n < 6) {
      if (running && !bot) feedInput();
      if (bot) bot.step(1 / 60);
      game.step(1 / 60);
      if (running) stepLessons(1 / 60);
      acc -= 1 / 60; n++;
    }
    if (n === 6) acc = 0;
  }
  if (running) {
    handleEvents();
    hud();
    if (!paused) snd.heart(dt, game.mode === 'sneak' ? game.host.sus : 0);
    stampT -= dt;
    if (stampT <= 0 && $('stamp').classList.contains('in')) $('stamp').classList.remove('in');
    if (game.outcome && !DEMO) { endT += dt; if (endT > 1.8 && !$('endP').classList.contains('on')) showEnd(); }
  } else game.events.length = 0;
}

resize();
if (DEMO) {
  start(0, { seed: 3 });
  for (let i = 0; i < 60 * 15.6; i++) { bot.step(1 / 60); game.step(1 / 60); }
  game.events.length = 0;
  cam.x = game.host.x * 0.6 + game.player.x * 0.4; cam.y = game.host.y * 0.6 + game.player.y * 0.4;
} else showTitle();
requestAnimationFrame(frame);
window.toyboxReady?.();

if (DEBUG) {
  window.inv = {
    get game() { return game; }, start, levels, snd,
    hold(v = true) { hold = v; },
    ff(sec, withBot) {
      const b = withBot ? (bot || new Bot(game)) : null;
      for (let i = 0; i < sec * 60; i++) { if (b) b.step(1 / 60); else if (running) feedInput(); game.step(1 / 60); if (running) stepLessons(1 / 60); }
      handleEvents(); hud(); draw(performance.now() / 1000, 1);
    },
    draw() { draw(performance.now() / 1000, 1); },
    get tut() { return tut; },
  };
}
