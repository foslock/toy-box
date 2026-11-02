// Grip: a two-thumb climb up a sea cliff, a lighthouse and a radio mast.
import { Climb, L, FEET, SHX, SHY, UNITS_PER_M, SUMMIT_Y, XMIN, XMAX } from './sim.js';
import { Bot } from './bot.js';
import { Sound } from './audio.js';
import { LINES, pick } from './lines.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), AUTO = Q.has('autoplay'), DEBUG = Q.has('debug');
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, S = 1;

const INK = '#1E2838', PAPER = '#F1E7D2', CHALK = '#FBF7EE', RUST = '#C4452B', MUSTARD = '#E2A23B';

const climb = new Climb();
const sound = new Sound();
let bot = AUTO ? new Bot(climb) : null;
let mode = DEMO || AUTO ? 'play' : 'title';
let touchUI = matchMedia('(pointer: coarse)').matches;
let camX = 0, camY = FEET + 200;
let clock = 0;

// ---------- saving ----------
const KEY = 'grip-v1';
let save = { tut: false, said: {}, muted: false, bestTime: 0, snap: null };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
function persist() {
  if (DEMO || AUTO) return;
  const s = climb.snapshot(), o = save.snap;
  save.snap = !s.pos && o ? { ...s, a: o.a, b: o.b, stand: o.stand, px: o.px } : s;
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {}
}
if (!DEMO && !AUTO && save.snap) climb.restore(save.snap);
sound.muted = !!save.muted;

// ---------- the scenery, made once ----------
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const R = rng(1405);
const CLIFF_TOP = 1500;
const cliff = (() => {
  const left = [], right = [];
  for (let y = -60; y <= CLIFF_TOP; y += 36) {
    const t = y / CLIFF_TOP;
    left.push([-252 - R() * 26 + Math.sin(y * 0.011) * 14 + t * 10, y]);
    right.push([258 + R() * 26 + Math.sin(y * 0.009 + 2) * 16 - t * 6, y]);
  }
  const strata = [];
  let y = -40, k = 0;
  while (y < CLIFF_TOP) {
    const h = 60 + R() * 70, pts = [];
    for (let x = -320; x <= 320; x += 40) pts.push([x, y + h + Math.sin(x * 0.02 + k) * 10 + (R() - 0.5) * 8]);
    strata.push({ y, pts, tone: k % 3 });
    y += h; k++;
  }
  const cracks = [];
  for (let i = 0; i < 34; i++) {
    let x = -220 + R() * 440, cy = 40 + R() * (CLIFF_TOP - 80); const pts = [[x, cy]];
    const n = 3 + (R() * 4 | 0);
    for (let j = 0; j < n; j++) { x += (R() - 0.5) * 26; cy -= 14 + R() * 26; pts.push([x, cy]); }
    cracks.push(pts);
  }
  const tufts = []; for (let x = -1400; x < 1400; x += 9 + R() * 10) tufts.push([x, 3 + R() * 9]);
  return { left, right, strata, cracks, tufts };
})();
const farA = Array.from({ length: 14 }, (_, i) => [i / 13, 0.4 + 0.6 * Math.sin(i * 0.9) ** 2 * (i > 2 && i < 11 ? 1 : 0.3)]);
const clouds = Array.from({ length: 9 }, (_, i) => ({ x: R(), y: 0.08 + R() * 0.5, w: 0.18 + R() * 0.3, h: 14 + R() * 18, sp: 0.004 + R() * 0.008, d: 0.15 + R() * 0.3 }));
const grain = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 192; const g = c.getContext('2d');
  const im = g.createImageData(192, 192);
  for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255 | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = Math.random() < 0.5 ? 26 : 0; }
  g.putImageData(im, 0, 0); return c;
})();
let grainPat = null;

// ---------- palettes by height ----------
const SKIES = [
  { y: 0, rings: ['#FBE6B0', '#F7CB8F', '#EFAA83', '#DA8D86', '#A88395', '#7B7E9E', '#5A6B90'], sea: ['#3F8290', '#316C7A', '#25566A'], far: ['#7184A0', '#8F97AE'], sun: 1, cloud: '#F6D9BC' },
  { y: 1100, rings: ['#FFF3D2', '#F5E8C8', '#DCE4D3', '#BDD4D2', '#9AC0CB', '#7DA8C2', '#6292B8'], sea: ['#2F808E', '#256C7C', '#1E5868'], far: ['#5E8A8F', '#89ABAA'], sun: 1, cloud: '#FBF5E6' },
  { y: 2050, rings: ['#FFE08A', '#FBB75F', '#F08B4C', '#D8654A', '#A84C5A', '#6F4062', '#41375F'], sea: ['#4C5079', '#3D4168', '#2F3355'], far: ['#4D4065', '#6D4B6B'], sun: 1, cloud: '#F4A170' },
  { y: 2900, rings: ['#5F6D83', '#515E75', '#455169', '#3A455D', '#303A51', '#262F45', '#1D2438'], sea: ['#26344A', '#1F2B3F', '#182234'], far: ['#1F2839', '#2B364B'], sun: 0, cloud: '#3F4A60' },
];
function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; }
function skyAt(y) {
  let i = 0; while (i < SKIES.length - 2 && y > SKIES[i + 1].y) i++;
  const a = SKIES[i], b = SKIES[i + 1], t = Math.max(0, Math.min(1, (y - a.y) / (b.y - a.y)));
  const e = t * t * (3 - 2 * t);
  return { rings: a.rings.map((c, k) => mix(c, b.rings[k], e)), sea: a.sea.map((c, k) => mix(c, b.sea[k], e)), far: a.far.map((c, k) => mix(c, b.far[k], e)),
    sun: a.sun + (b.sun - a.sun) * e, cloud: mix(a.cloud, b.cloud, e), storm: Math.max(0, Math.min(1, (y - 2500) / 400)) };
}

// ---------- layout ----------
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  S = Math.min(W / 320, H / (W > H * 1.3 && H < 600 ? 420 : 520));
  grainPat = ctx.createPattern(grain, 'repeat');
}
addEventListener('resize', resize); resize();

// ---------- input ----------
const touches = new Map(); // pointerId -> hand
const mouseHands = [false, false], keyHands = [false, false];
let lastMouse = null, lastPressed = 0;
const playing = () => mode === 'play' && !bot;
function handDown(i) { return [...touches.values()].includes(i) || mouseHands[i] || keyHands[i]; }
function syncHand(i) { climb.input(i, handDown(i)); }
function wake() { sound.start(); }

cv.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') return;
  e.preventDefault(); wake();
  if (!playing()) return;
  if (!touchUI) { touchUI = true; tut.refresh(); }
  const i = e.clientX < W / 2 ? 0 : 1;
  if ([...touches.values()].includes(i)) return;
  touches.set(e.pointerId, i); touchPos.set(e.pointerId, [e.clientX, e.clientY]);
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  syncHand(i);
}, { passive: false });
const touchPos = new Map();
cv.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse' || !touches.has(e.pointerId)) return;
  const i = touches.get(e.pointerId), p = touchPos.get(e.pointerId);
  const dx = e.clientX - p[0], dy = e.clientY - p[1]; touchPos.set(e.pointerId, [e.clientX, e.clientY]);
  if (playing()) climb.input(i, true, dx / S, -dy / S);
});
function touchEnd(e) {
  if (!touches.has(e.pointerId)) return;
  const i = touches.get(e.pointerId); touches.delete(e.pointerId); touchPos.delete(e.pointerId);
  syncHand(i);
}
cv.addEventListener('pointerup', touchEnd); cv.addEventListener('pointercancel', touchEnd);

cv.addEventListener('mousedown', e => {
  wake();
  if (!playing() || (e.button !== 0 && e.button !== 2)) return;
  if (touchUI && !matchMedia('(pointer: coarse)').matches) { touchUI = false; tut.refresh(); }
  if (touchUI) return;
  const i = e.button === 2 ? 1 : 0; mouseHands[i] = true; lastPressed = i; syncHand(i);
  e.preventDefault();
});
addEventListener('mouseup', e => { const i = e.button === 2 ? 1 : e.button === 0 ? 0 : -1; if (i < 0 || !mouseHands[i]) return; mouseHands[i] = false; syncHand(i); });
addEventListener('mousemove', e => {
  const p = [e.clientX, e.clientY], q = lastMouse || p; lastMouse = p;
  if (!playing() || touchUI) return;
  const dx = p[0] - q[0], dy = p[1] - q[1];
  // one mouse, two hands: it moves a free hand if one is reaching, and only pulls when every held hand is holding on
  const held = [0, 1].filter(i => mouseHands[i] || keyHands[i]);
  const reaching = held.filter(i => climb.hands[i].state !== 'grip');
  const movers = reaching.length ? [reaching.includes(lastPressed) ? lastPressed : reaching[0]] : held;
  for (const i of movers) climb.input(i, true, dx / S, -dy / S);
});
cv.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { if (mode === 'play') openGuide(); else if (mode === 'guide') closeGuide(); return; }
  const i = k === 'f' || k === 'a' ? 0 : k === 'j' || k === 'l' ? 1 : -1;
  if (i < 0 || !playing()) return;
  wake(); if (touchUI) { touchUI = false; tut.refresh(); }
  keyHands[i] = true; lastPressed = i; syncHand(i);
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase(), i = k === 'f' || k === 'a' ? 0 : k === 'j' || k === 'l' ? 1 : -1;
  if (i < 0) return; keyHands[i] = false; syncHand(i);
});
// switching away (or opening the guide) leaves any hand that's holding on still holding; a reaching hand drops
function releaseAll() {
  touches.clear(); touchPos.clear(); mouseHands.fill(false); keyHands.fill(false);
  for (const h of climb.hands) climb.input(h.i, h.state === 'grip');
}
addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseAll(); persist(); } });

// ---------- the guide's voice ----------
const narr = { q: [], cur: null, t: 0, cool: 0 };
function say(text, { force = false } = {}) {
  if (!text || DEMO) return;
  if (narr.cur && !force) { if (narr.q.length < 2) narr.q.push({ text, at: clock }); return; }
  narr.cur = text; narr.t = 3.6 + text.length * 0.035;
  $('narrp').textContent = text; $('narr').classList.add('in');
}
function sayOnce(key, text) { if (save.said[key]) return false; save.said[key] = 1; say(text); return true; }
function updateNarr(dt) {
  narr.cool = Math.max(0, narr.cool - dt);
  if (!narr.cur) return;
  narr.t -= dt;
  if (narr.t <= 0) {
    $('narr').classList.remove('in'); narr.cur = null;
    // a line about something you've already left behind is no use
    while (narr.q.length && clock - narr.q[0].at > 5) narr.q.shift();
    if (narr.q.length) { const n = narr.q.shift(); setTimeout(() => say(n.text), 600); }
  }
}
let toastT = 0;
function toast(text) { $('toast').textContent = text; $('toast').classList.add('in'); toastT = 2.4; }

// ---------- tutorial ----------
const tut = {
  i: 0, on: false, doneT: 0,
  steps: [
    { hands: [0], dir: 1, hold: 0, touch: 'Your <b>left thumb</b> is your left hand. Put it down on the left half of the screen and slide it up to the chalked hold.',
      mouse: 'The <b>left mouse button</b> (or F) is your left hand. Hold it down and move the mouse up to the chalked hold.',
      done: () => grip(0, 0) },
    { hands: [1], dir: 1, hold: 1, touch: 'Keep it held: that’s your grip. Now the <b>right thumb</b>, on the right half: reach the other hold.',
      mouse: 'Keep holding: that’s your grip. Now the <b>right button</b> (or J): reach the other hold.',
      done: () => grip(1, 1) },
    { hands: [0, 1], dir: -1, touch: 'Both hands on. Slide <b>both thumbs down</b> to pull yourself up off the sand.',
      mouse: 'Both hands on. Hold <b>both buttons</b> and move the mouse <b>down</b> to pull yourself up.',
      done: () => !climb.stand && climb.P.y > FEET + 45 && climb.grips().length === 2 },
    { hands: [0], dir: 1, hold: 2, touch: '<b>Lift your left thumb</b> to let go, then put it down again and reach the next hold up.',
      mouse: '<b>Let go of the left button</b>, then press it again and reach the next hold up.',
      done: () => gripAbove(0, 150) },
    { hands: [1], dir: 1, hold: 3, touch: 'Hanging on one hand drains your grip (the ring round your head). Two hands rest it. <b>Right hand</b> next.',
      mouse: 'Hanging on one hand drains your grip (the ring round your head). Two hands rest it. <b>Right hand</b> next.',
      done: () => gripAbove(1, 200) },
    { hands: [], dir: 0, hold: 4, touch: 'Let go, reach, grab, pull. Climb onto the <b>top of the boulder</b>.',
      mouse: 'Let go, reach, grab, pull. Climb onto the <b>top of the boulder</b>.',
      done: () => climb.stand === climb.ledges[1] || climb.P.y > 330 },
  ],
  start() { this.on = true; this.i = 0; this.show(); },
  refresh() { if (this.on) this.show(); renderHow(); },
  show() {
    const s = this.steps[this.i];
    $('tutk').textContent = `Lesson ${this.i + 1} of ${this.steps.length}`;
    $('tutp').innerHTML = touchUI ? s.touch : s.mouse;
    $('tut').classList.add('in');
  },
  update() {
    if (!this.on) return;
    if (climb.P.y > 330) { this.finish(); return; }
    let moved = false;
    while (this.on && this.steps[this.i].done()) { this.i++; moved = true; if (this.i >= this.steps.length) { this.finish(); return; } }
    if (moved) { this.show(); sound.tick(); }
  },
  finish() {
    this.on = false; $('tut').classList.remove('in');
    if (!save.tut) { save.tut = true; persist(); say(LINES.tutDone[0], { force: true }); }
  },
  skip() { this.on = false; $('tut').classList.remove('in'); save.tut = true; persist(); },
  cur() { return this.on ? this.steps[this.i] : null; },
};
function grip(hand, hold) { const h = climb.hands[hand]; return h.state === 'grip' && h.hold.id === hold; }
function gripAbove(hand, y) { const h = climb.hands[hand]; return h.state === 'grip' && h.hold.y >= y; }
$('tutskip').addEventListener('click', () => tut.skip());

// ---------- events from the climb ----------
const parts = [];
let shake = 0, flash = 0, boltT = 6, bolt = null;
const stuckAt = { t: 0 };
function kindOf(h) { return h.t === 'rung' ? 'rung' : h.t === 'top' ? 'top' : h.t === 'rope' ? 'rope' : h.y > 2660 ? 'mast' : h.t; }
function puff(x, y, n = 7, col = CHALK, spd = 40) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.5 + Math.random() * 0.4, r: 1.6 + Math.random() * 2.2, col, g: -30 }); }
}
function handleEvents() {
  for (const e of climb.events) {
    switch (e.type) {
      case 'grab': {
        const k = kindOf(e.hold);
        sound.grab(k); puff(e.hold.x, e.hold.y, 6);
        if (e.first && !DEMO) {
          if (e.hold.t === 'crimp' && e.hold.y < 1500) sayOnce('crimp', LINES.crimp);
          if (e.hold.t === 'crumble') sayOnce('crumble', LINES.crumble);
          if (e.hold.t === 'rope') sayOnce('rope', LINES.rope);
          if (e.hold.t === 'rung') sayOnce('rung', LINES.rung);
          if (e.hold.big) sayOnce('lunge', LINES.lunge);
        }
        break;
      }
      case 'release': sound.release(); break;
      case 'land': {
        if (e.speed > 120) { sound.land(e.speed); puff(climb.P.x, e.ledge.y + 2, Math.min(18, 4 + e.speed / 60 | 0), e.ledge.kind === 'beach' ? '#E9D3A6' : CHALK, 30 + e.speed * 0.12); }
        if (e.speed > 500) shake = Math.min(1, e.speed / 1400);
        if (e.ledge.kind === 'grass' && climb.P.x > 0) sayOnce('top', LINES.cliffTop);
        if (e.ledge.kind === 'gallery') sayOnce('gallery', LINES.gallery);
        break;
      }
      case 'fell': {
        const m = e.dist / UNITS_PER_M;
        if (narr.cool > 0 && m < 12) break;
        const pool = e.to < 60 && m > 4 ? LINES.beach : m > 14 ? LINES.fallBig : m > 5 ? LINES.fallMid : m > 2.5 && Math.random() < 0.5 ? LINES.fallSmall : null;
        if (pool) { say(pick(pool)); narr.cool = 6; }
        break;
      }
      case 'crumble': sound.crumble(); for (let i = 0; i < 9; i++) parts.push({ x: e.hold.x + (Math.random() - 0.5) * 14, y: e.hold.y, vx: (Math.random() - 0.5) * 60, vy: Math.random() * 40, life: 0, max: 1.6, r: 2 + Math.random() * 3, col: '#A9886A', g: -700, rock: true });
        sayOnce('crumbled', LINES.crumbled); break;
      case 'slip': sound.slip(); if (!sayOnce('slip', LINES.slip)) { if (Math.random() < 0.4) say(pick(LINES.slipAgain)); } break;
      case 'rip': if (!sayOnce('rip', LINES.rip) && Math.random() < 0.3) say(pick(LINES.ripAgain)); break;
      case 'gust': sayOnce('gust', LINES.gust); break;
      case 'summit': onSummit(); break;
    }
  }
  climb.events.length = 0;
}

let lastRecord = Math.floor(climb.best / UNITS_PER_M / 10);
function watchProgress(dt) {
  const m = (climb.best - FEET) / UNITS_PER_M;
  const r = Math.floor(m / 10);
  if (r > lastRecord && !DEMO) { lastRecord = r; if (r > 0) { toast(`New high point · ${r * 10} m`); sound.tick(); } }
  if (climb.P.y > 2690 && !DEMO) sayOnce('mast', LINES.mast);
  if (climb.P.y > 1620 && climb.P.y < 1700 && !DEMO) sayOnce('lighthouse', LINES.lighthouse);
  // stuck under the lunge?
  const below = climb.grips().some(h => h.hold.y > 1140 && h.hold.y < 1200) && climb.best < 1360;
  stuckAt.t = below ? stuckAt.t + dt : Math.max(0, stuckAt.t - dt * 0.3);
  if (stuckAt.t > 6 && !DEMO) { stuckAt.t = -24; say(LINES.lungeHint, { force: true }); }
}

// ---------- pages ----------
function fmtTime(s) { s = Math.round(s); const h = s / 3600 | 0, m = (s / 60 | 0) % 60, ss = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`; }
function metres(u) { return Math.max(0, u / UNITS_PER_M); }
function renderStats(el, final = false) {
  const rows = [];
  rows.push(['High point', climb.summit ? 'The top, 80 m' : `${metres(climb.best - FEET).toFixed(1)} m of 80`]);
  rows.push(['Falls', `${climb.falls}${climb.lost > 0 ? `, ${metres(climb.lost).toFixed(0)} m in all` : ''}`]);
  rows.push(['On the route', fmtTime(climb.climbTime)]);
  if (save.bestTime) rows.push(['Best ascent', fmtTime(save.bestTime)]);
  el.innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
  if (final) el.innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
}
function renderHow() {
  const items = touchUI ? [
    ['Each thumb is a hand.', 'Left half of the screen, left hand. Right half, right.'],
    ['Hold to grip.', 'A thumb held down closes the hand. It grabs any hold it touches.'],
    ['Slide to reach,', 'while the hand is free. Once it’s holding, slide down to pull up.'],
    ['Lift to let go.', 'Two hands rest your grip. One hand drains it.'],
  ] : [
    ['Each mouse button is a hand.', 'Left button, left hand; right, right. F and J work too.'],
    ['Hold to grip.', 'A held button closes the hand. It grabs any hold it touches.'],
    ['Move to reach', 'with a free hand. When every held hand is holding on, move down to pull up.'],
    ['Let go to let go.', 'Two hands rest your grip. One hand drains it.'],
  ];
  $('howto').innerHTML = items.map(([a, b]) => `<li><b>${a}</b> ${b}</li>`).join('');
}
function drawTopo() {
  const c = $('topo'), g = c.getContext('2d'), w = c.width, h = c.height;
  g.clearRect(0, 0, w, h);
  const my = m => h - 20 - m * ((h - 46) / 80);
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = 3;
  // sea and cliff
  g.fillStyle = '#E2D4B6'; g.beginPath(); g.moveTo(20, h - 20); g.lineTo(24, my(10)); g.lineTo(34, my(22)); g.lineTo(30, my(30)); g.lineTo(270, my(30)); g.lineTo(274, my(18)); g.lineTo(280, h - 20); g.closePath(); g.fill(); g.stroke();
  g.lineWidth = 1.5; for (let i = 0; i < 7; i++) { g.beginPath(); const y = my(3 + i * 4); g.moveTo(40 + (i % 2) * 30, y); g.lineTo(250 - (i % 3) * 20, y + 4); g.stroke(); }
  // lighthouse
  g.lineWidth = 3; g.fillStyle = PAPER;
  g.beginPath(); g.moveTo(112, my(30)); g.lineTo(122, my(48.8)); g.lineTo(178, my(48.8)); g.lineTo(188, my(30)); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = RUST; for (let i = 0; i < 3; i++) { const a = my(32 + i * 6), b = my(35 + i * 6); g.beginPath(); g.moveTo(113 + i * 3, a); g.lineTo(115 + i * 3, b); g.lineTo(185 - i * 3, b); g.lineTo(187 - i * 3, a); g.closePath(); g.fill(); }
  g.fillStyle = PAPER; g.strokeRect(112, my(48.8) - 2, 76, 4); g.strokeRect(128, my(51.8), 44, my(48.8) - my(51.8)); g.beginPath(); g.arc(150, my(51.8), 22, Math.PI, 0); g.stroke();
  // mast
  g.lineWidth = 2.5; const top = my(79.3), base = my(53);
  g.beginPath(); g.moveTo(138, base); g.lineTo(144, top); g.moveTo(162, base); g.lineTo(156, top); g.stroke();
  g.lineWidth = 1.3; g.beginPath(); for (let i = 0; i < 12; i++) { const a = base + (top - base) * i / 12, b = base + (top - base) * (i + 1) / 12; const ia = 6 * i / 12, ib = 6 * (i + 1) / 12; g.moveTo(138 + ia, a); g.lineTo(162 - ib, b); g.moveTo(138 + ia, a); g.lineTo(162 - ia, a); } g.stroke();
  // the route line
  g.setLineDash([2, 7]); g.lineWidth = 3.5; g.strokeStyle = RUST;
  g.beginPath(); g.moveTo(150, h - 22); g.bezierCurveTo(120, my(12), 190, my(20), 168, my(30)); g.lineTo(150, my(34)); g.lineTo(150, my(79)); g.stroke(); g.setLineDash([]);
  // pitch numbers
  const num = (n, x, m) => { g.fillStyle = INK; g.beginPath(); g.arc(x, my(m), 13, 0, 7); g.fill(); g.fillStyle = PAPER; g.font = '600 17px Antonio'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, x, my(m) + 1); };
  num(1, 70, 14); num(2, 220, 40); num(3, 210, 66);
  // high point
  const hp = metres(climb.best - FEET);
  if (hp > 0.5) {
    const y = my(Math.min(80, hp)); g.strokeStyle = RUST; g.lineWidth = 3; g.beginPath(); g.moveTo(96, y); g.lineTo(204, y); g.stroke();
    g.fillStyle = RUST; g.font = '600 15px Antonio'; g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText('YOU', 6, y + 6);
  }
}
function openTitle() {
  mode = 'title'; releaseAll();
  const started = climb.best > FEET + 20 || climb.climbTime > 20;
  $('go').textContent = started ? `Carry on from ${metres(climb.P.y - FEET).toFixed(0)} m` : 'Start climbing';
  $('restart').hidden = !started; $('restart').textContent = 'Back to the beach'; $('restart').classList.remove('sure');
  $('foot').textContent = started ? 'Your place on the route is kept between visits.' : 'Your high point is kept between visits. Sound on is best.';
  renderStats($('stats')); renderHow(); drawTopo();
  $('title').classList.add('on');
}
function openGuide() { openTitle(); mode = 'guide'; $('go').textContent = 'Back to the climb'; }
function closeGuide() {
  $('title').classList.remove('on'); mode = 'play';
  if (!save.tut && !tut.on && climb.P.y < 300) tut.start();
}
$('go').addEventListener('click', () => { wake(); closeGuide(); });
$('restart').addEventListener('click', () => {
  const b = $('restart');
  if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'Sure? This keeps your high point'; return; }
  const best = climb.best; climb.reset(); climb.best = best; camY = FEET + 200; persist(); closeGuide();
});
$('guide').addEventListener('click', () => { wake(); if (mode === 'play') openGuide(); });
function updateSnd() { $('sndw').style.display = sound.muted ? 'none' : ''; }
$('snd').addEventListener('click', () => { wake(); sound.setMuted(!sound.muted); save.muted = sound.muted; persist(); updateSnd(); });
updateSnd();

let summitT = -1;
function onSummit() {
  sound.summit(); puff(climb.P.x, climb.P.y + 30, 30, CHALK, 120);
  if (!save.bestTime || climb.climbTime < save.bestTime) save.bestTime = climb.climbTime;
  persist(); summitT = 2.6;
}
function showSummit() {
  mode = 'summit'; releaseAll();
  renderStats($('sumstats'), true);
  $('sumlede').textContent = climb.falls === 0 ? LINES.summitClean : climb.falls > 40 ? LINES.summitHard : LINES.summit;
  $('summit').classList.add('on');
}
$('again').addEventListener('click', () => { $('summit').classList.remove('on'); climb.reset(); camY = FEET + 200; lastRecord = 0; persist(); mode = 'play'; });
$('stay').addEventListener('click', () => { $('summit').classList.remove('on'); mode = 'play'; });

// ---------- drawing ----------
function world() { ctx.setTransform(DPR * S, 0, 0, -DPR * S, DPR * (W / 2 - camX * S), DPR * (H / 2 + camY * S)); }
function screen() { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
const sx = x => W / 2 + (x - camX) * S, sy = y => H / 2 - (y - camY) * S;
const viewTop = () => camY + H / 2 / S + 40, viewBot = () => camY - H / 2 / S - 40;

function drawSky(sk) {
  screen();
  const hz = horizonY();
  const cx = W * 0.7, cy = hz - 10, R0 = Math.max(W, H) * 0.13;
  ctx.fillStyle = sk.rings[6]; ctx.fillRect(0, 0, W, H);
  for (let i = 5; i >= 0; i--) { ctx.fillStyle = sk.rings[i]; ctx.beginPath(); ctx.arc(cx, cy, R0 * (i + 1.1) + (i ? 0 : 0), 0, Math.PI * 2); ctx.fill(); }
  if (sk.sun > 0.02) { ctx.globalAlpha = sk.sun; ctx.fillStyle = '#FFF6DC'; ctx.beginPath(); ctx.arc(cx, cy, R0 * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  // clouds: flat pills
  ctx.fillStyle = sk.cloud;
  for (const c of clouds) {
    const x = ((c.x + clock * c.sp) % 1.4 - 0.2) * W, y = (c.y * hz) + camY * S * c.d * 0.05;
    const yy = ((y % (H * 1.2)) + H * 1.2) % (H * 1.2) - H * 0.1;
    const w = c.w * W, h = c.h;
    ctx.globalAlpha = 0.85 - sk.storm * 0.2; pill(x, yy, w, h); pill(x + w * 0.2, yy - h * 0.7, w * 0.5, h * 0.9); ctx.globalAlpha = 1;
  }
  // far headlands and the sea
  ctx.fillStyle = sk.far[1]; land(hz, 0.55, 46);
  ctx.fillStyle = sk.far[0]; land(hz, 0.15, 26, true);
  const seaTop = hz;
  ctx.fillStyle = sk.sea[0]; ctx.fillRect(0, seaTop, W, H - seaTop);
  ctx.fillStyle = sk.sea[1]; ctx.fillRect(0, seaTop + (H - seaTop) * 0.25, W, H);
  ctx.fillStyle = sk.sea[2]; ctx.fillRect(0, seaTop + (H - seaTop) * 0.55, W, H);
  // sun glitter
  if (sk.sun > 0.1) {
    ctx.fillStyle = sk.rings[0]; ctx.globalAlpha = 0.7 * sk.sun;
    for (let i = 0; i < 9; i++) { const yy = seaTop + 6 + i * i * 4.5, ww = (40 - i * 3) * (1 + 0.3 * Math.sin(clock * 2 + i)); ctx.fillRect(cx - ww / 2 + Math.sin(clock + i * 2) * 8, yy, ww, 2.5); }
    ctx.globalAlpha = 1;
  }
}
function horizonY() { return Math.min(H * 1.3, H * 0.6 + (camY - 200) * S * 0.07); }
function pill(x, y, w, h) { ctx.beginPath(); ctx.moveTo(x + h / 2, y); ctx.lineTo(x + w - h / 2, y); ctx.arc(x + w - h / 2, y + h / 2, h / 2, -Math.PI / 2, Math.PI / 2); ctx.lineTo(x + h / 2, y + h); ctx.arc(x + h / 2, y + h / 2, h / 2, Math.PI / 2, Math.PI * 1.5); ctx.fill(); }
function land(hz, off, hgt, right) {
  ctx.beginPath(); ctx.moveTo(right ? W : 0, hz + 1);
  for (const [t, v] of farA) { const x = right ? W - (t * W * 0.45) - W * off * 0.2 : t * W * 0.5 + W * off * 0.1 - W * 0.05; ctx.lineTo(x, hz - v * hgt); }
  ctx.lineTo(right ? W * 0.45 : W * 0.6, hz + 1); ctx.closePath(); ctx.fill();
}

const ROCK = ['#C98F6C', '#B57A5B', '#D9A27C'], ROCK_DARK = '#7A4A3B', ROCK_SHADE = '#94604A';
function drawCliff() {
  if (viewBot() > CLIFF_TOP + 40) return;
  world();
  ctx.save();
  ctx.beginPath(); ctx.moveTo(cliff.left[0][0], cliff.left[0][1]);
  for (const p of cliff.left) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(cliff.left.at(-1)[0], CLIFF_TOP); ctx.lineTo(cliff.right.at(-1)[0], CLIFF_TOP);
  for (let i = cliff.right.length - 1; i >= 0; i--) ctx.lineTo(cliff.right[i][0], cliff.right[i][1]);
  ctx.closePath();
  ctx.fillStyle = ROCK[0]; ctx.fill();
  ctx.clip();
  const top = viewTop(), bot = viewBot();
  for (const s of cliff.strata) {
    if (s.y > top || s.pts[0][1] < bot - 200) continue;
    ctx.fillStyle = ROCK[s.tone];
    ctx.beginPath(); ctx.moveTo(-330, s.y); for (const p of s.pts) ctx.lineTo(p[0], p[1]); ctx.lineTo(330, s.y - 4); ctx.closePath(); ctx.fill();
  }
  // shade the left flank, light the right
  ctx.fillStyle = ROCK_SHADE; ctx.globalAlpha = 0.55;
  ctx.beginPath(); ctx.moveTo(-340, -80); ctx.lineTo(-170, -80); ctx.lineTo(-210, 600); ctx.lineTo(-150, 1100); ctx.lineTo(-200, CLIFF_TOP + 10); ctx.lineTo(-340, CLIFF_TOP + 10); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = ROCK_DARK; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 0.6;
  for (const c of cliff.cracks) { if (c[0][1] < bot || c.at(-1)[1] > top) continue; ctx.beginPath(); ctx.moveTo(c[0][0], c[0][1]); for (const p of c) ctx.lineTo(p[0], p[1]); ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.restore();
  // outline
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5 / S * 1.2;
  ctx.beginPath(); for (const p of cliff.left) ctx.lineTo(p[0], p[1]); ctx.stroke();
  ctx.beginPath(); for (const p of cliff.right) ctx.lineTo(p[0], p[1]); ctx.stroke();
  // grass cap
  ctx.fillStyle = '#6E8F4E'; ctx.fillRect(-3000, CLIFF_TOP - 12, 6000, 14);
  ctx.fillStyle = '#86A85E'; ctx.fillRect(-3000, CLIFF_TOP - 2, 6000, 4);
  ctx.fillStyle = '#6E8F4E'; for (const [x, h] of cliff.tufts) { ctx.beginPath(); ctx.moveTo(x - 3, CLIFF_TOP); ctx.lineTo(x, CLIFF_TOP + h); ctx.lineTo(x + 3, CLIFF_TOP); ctx.fill(); }
}
function drawBeach() {
  if (viewBot() > 200) return;
  world();
  ctx.fillStyle = '#E6CD9C'; ctx.fillRect(-3000, -400, 6000, 400);
  ctx.fillStyle = '#D6B985'; ctx.fillRect(-3000, -16, 6000, 6);
}
function drawSea() {
  if (viewBot() > 120) return;
  world();
  const t = clock;
  const bands = [['#3F8290', -40], ['#316C7A', -70], ['#25566A', -110]];
  for (let k = 0; k < bands.length; k++) {
    const [c, y0] = bands[k];
    const xa = Math.floor((camX - W / 2 / S) / 30) * 30 - 60, xb = camX + W / 2 / S + 60;
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(xa, -500);
    const sw = Math.sin(t * 0.55 + k) * 8;
    for (let x = xa; x <= xb; x += 30) ctx.lineTo(x, y0 + sw + Math.sin(x * 0.03 + t * (1.2 + k * 0.3)) * 5);
    ctx.lineTo(xb, -500); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = CHALK; ctx.globalAlpha = 0.85; ctx.lineWidth = 3;
    ctx.beginPath(); for (let x = xa; x <= xb; x += 30) { const y = y0 + sw + Math.sin(x * 0.03 + t * (1.2 + k * 0.3)) * 5; if ((x / 30 + k) % 4 < 2) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
function drawLedges() {
  world();
  for (const l of climb.ledges) {
    if (l.kind === 'beach' || l.kind === 'grass' || l.kind === 'gallery' || l.kind === 'dome') continue;
    if (l.y < viewBot() || l.y > viewTop()) continue;
    if (l.kind === 'rock') {
      ctx.fillStyle = ROCK_DARK; ctx.beginPath(); ctx.moveTo(l.x0 - 6, l.y); ctx.lineTo(l.x1 + 6, l.y); ctx.lineTo(l.x1 - 8, l.y - 16); ctx.lineTo(l.x0 + 4, l.y - 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = ROCK[2]; ctx.fillRect(l.x0 - 6, l.y - 3, l.x1 - l.x0 + 12, 7);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(l.x0 - 6, l.y - 3, l.x1 - l.x0 + 12, 7);
    } else if (l.kind === 'deck') {
      ctx.fillStyle = '#4A556C'; ctx.fillRect(l.x0 - 8, l.y - 5, l.x1 - l.x0 + 16, 6);
      ctx.strokeStyle = '#9AA6BA'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let x = l.x0 - 6; x < l.x1 + 8; x += 6) { ctx.moveTo(x, l.y - 5); ctx.lineTo(x + 3, l.y + 1); } ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(l.x0 - 8, l.y - 5, l.x1 - l.x0 + 16, 6);
    }
  }
}
function drawLighthouse(sk) {
  const top = viewTop(), bot = viewBot();
  if (bot > 2700 || top < CLIFF_TOP) return;
  world();
  const y0 = CLIFF_TOP, y1 = 2440, w0 = 74, w1 = 58;
  const wAt = y => w0 + (w1 - w0) * (y - y0) / (y1 - y0);
  // tower bands
  const bandH = 156;
  for (let y = y0, k = 0; y < y1; y += bandH, k++) {
    const ya = y, yb = Math.min(y1, y + bandH);
    ctx.fillStyle = k % 2 ? RUST : PAPER;
    ctx.beginPath(); ctx.moveTo(-wAt(ya), ya); ctx.lineTo(-wAt(yb), yb); ctx.lineTo(wAt(yb), yb); ctx.lineTo(wAt(ya), ya); ctx.closePath(); ctx.fill();
  }
  // shade
  ctx.fillStyle = INK; ctx.globalAlpha = 0.16;
  ctx.beginPath(); ctx.moveTo(-w0, y0); ctx.lineTo(-w1, y1); ctx.lineTo(-w1 * 0.55, y1); ctx.lineTo(-w0 * 0.55, y0); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-w0, y0); ctx.lineTo(-w1, y1); ctx.moveTo(w0, y0); ctx.lineTo(w1, y1); ctx.stroke();
  // door and its lamp
  ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(20, y0); ctx.lineTo(20, y0 + 40); ctx.arc(32, y0 + 40, 12, Math.PI, 0, true); ctx.lineTo(44, y0); ctx.closePath(); ctx.fill();
  // windows behind the sills
  for (const h of climb.holds) if (h.y > 1700 && h.y < 2300 && h.t !== 'rung') {
    ctx.fillStyle = INK; ctx.fillRect(h.x - 11, h.y + 3, 22, 34);
    ctx.fillStyle = sk.rings[1]; ctx.globalAlpha = 0.5; ctx.fillRect(h.x - 7, h.y + 7, 6, 26); ctx.globalAlpha = 1;
  }
  // the ladder rails, broken where rungs are missing
  const rungs = climb.holds.filter(h => h.t === 'rung').map(h => h.y);
  ctx.strokeStyle = '#3B3A3F'; ctx.lineWidth = 2.5;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    for (let i = 0; i < rungs.length; i++) {
      const a = rungs[i] - 20, b = rungs[i] + 26;
      ctx.moveTo(-8 + side * 13, a); ctx.lineTo(-8 + side * 13, (i < rungs.length - 1 && rungs[i + 1] - rungs[i] < 80) ? rungs[i + 1] : b);
    }
    ctx.stroke();
  }
  // gallery
  ctx.fillStyle = INK; ctx.fillRect(-92, y1 - 8, 184, 10);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-88, 2462); ctx.lineTo(88, 2462); for (let x = -86; x <= 86; x += 14.3) { ctx.moveTo(x, y1); ctx.lineTo(x, 2462); } ctx.stroke();
  // lantern room
  const lit = Math.max(0.35, 1 - sk.sun * 0.6);
  ctx.fillStyle = mix('#F6D48A', '#FFE9A8', lit); ctx.globalAlpha = 0.95; ctx.fillRect(-40, y1 + 2, 80, 150); ctx.globalAlpha = 1;
  ctx.fillStyle = '#FFF4C8'; ctx.beginPath(); ctx.arc(0, 2515, 16, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(-40, y1 + 2, 80, 150);
  ctx.lineWidth = 2; ctx.beginPath(); for (const x of [-20, 0, 20]) { ctx.moveTo(x, y1 + 2); ctx.lineTo(x, 2592); } ctx.moveTo(-40, 2520); ctx.lineTo(40, 2520); ctx.moveTo(-40, 2576); ctx.lineTo(40, 2576); ctx.stroke();
  // dome
  ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-48, 2592); ctx.lineTo(48, 2592); ctx.lineTo(30, 2612); ctx.quadraticCurveTo(0, 2632, -30, 2612); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 2620); ctx.lineTo(0, 2668); ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(-14, 2660); ctx.lineTo(14, 2660); ctx.lineTo(18, 2664); ctx.lineTo(14, 2668); ctx.lineTo(-10, 2668); ctx.closePath(); ctx.fill();
}
function drawBeam(sk) {
  const vis = (1 - sk.sun * 0.85);
  if (vis < 0.05 || viewBot() > 3600) return;
  world();
  const a = clock * 0.7, c = Math.cos(a), len = 1400 * Math.abs(c), dir = Math.sign(c) || 1;
  ctx.fillStyle = '#FFF2C4'; ctx.globalAlpha = 0.16 * vis * (0.4 + 0.6 * Math.abs(c));
  ctx.beginPath(); ctx.moveTo(0, 2515); ctx.lineTo(dir * len, 2515 + 120 * Math.abs(c) + 30); ctx.lineTo(dir * len, 2515 - 120 * Math.abs(c) - 30); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
}
const STEEL = '#5B6780', STEEL_LIGHT = '#8E9AB0';
function drawMast() {
  const top = viewTop(), bot = viewBot();
  if (top < 2600) return;
  world();
  const nodes = climb.holds.filter(h => h.y > 2700 && h.y < SUMMIT_Y);
  // guy wires
  ctx.strokeStyle = INK; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.2;
  ctx.beginPath(); for (const y of [3100, 3500, 3900]) { ctx.moveTo(-38, y); ctx.lineTo(-700, y - 900); ctx.moveTo(38, y); ctx.lineTo(700, y - 900); } ctx.stroke(); ctx.globalAlpha = 1;
  // legs and lacing
  ctx.lineCap = 'round';
  const pass = (col, w) => {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(-38, 2620); ctx.lineTo(-38, SUMMIT_Y - 10); ctx.moveTo(38, 2620); ctx.lineTo(38, SUMMIT_Y - 10); ctx.stroke();
    ctx.lineWidth = w * 0.55; ctx.beginPath();
    for (let y = 2640; y < SUMMIT_Y - 40; y += 92) { ctx.moveTo(-38, y); ctx.lineTo(38, y); ctx.moveTo(-38, y); ctx.lineTo(38, y + 46); ctx.moveTo(38, y + 46); ctx.lineTo(-38, y + 92); }
    ctx.stroke();
  };
  pass(INK, 7); pass(STEEL, 4);
  // top cap and beacon
  ctx.fillStyle = INK; ctx.fillRect(-44, SUMMIT_Y - 16, 88, 8);
  ctx.fillStyle = STEEL_LIGHT; ctx.fillRect(-44, SUMMIT_Y - 14, 88, 3);
  // aviation lamps
  for (const y of [3180, 3580]) for (const x of [-38, 38]) {
    const on = Math.sin(clock * 3 + y) > 0;
    ctx.fillStyle = on ? '#FF5A3A' : '#6A2A22'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
    if (on) { ctx.fillStyle = '#FF5A3A'; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  }
  void nodes; void bot;
}

function drawHolds() {
  world();
  const top = viewTop(), bot = viewBot();
  const cur = tut.cur();
  for (const h of climb.holds) {
    if (h.y < bot || h.y > top) { if (h.t !== 'rope') continue; }
    if (h.t === 'rope') { drawRope(h); continue; }
    const mast = h.y > 2690, light = h.y > CLIFF_TOP && !mast;
    if (h.broken) {
      ctx.strokeStyle = INK; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.ellipse(h.x, h.y, 9, 5, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      continue;
    }
    if (h.post) {
      ctx.fillStyle = INK; ctx.fillRect(h.x - 4.5, CLIFF_TOP - 2, 9, h.y - CLIFF_TOP + 6);
      ctx.fillStyle = '#9A7650'; ctx.fillRect(h.x - 2.5, CLIFF_TOP, 5, h.y - CLIFF_TOP + 2);
    }
    const wob = h.t === 'crumble' && h.gripT > 0 ? Math.sin(clock * 60) * h.gripT * 1.4 : 0;
    const x = h.x + wob, y = h.y;
    if (h.t === 'top') {
      ctx.fillStyle = INK; ctx.fillRect(x - 6, y - 8, 12, 10);
      const pulse = 0.5 + 0.5 * Math.sin(clock * 4);
      ctx.fillStyle = '#FF5A3A'; ctx.beginPath(); ctx.arc(x, y + 6, 9, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.25 + 0.2 * pulse; ctx.beginPath(); ctx.arc(x, y + 6, 26 + pulse * 6, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y + 6, 9, 0, 7); ctx.stroke();
      continue;
    }
    if (h.t === 'rung') {
      ctx.strokeStyle = INK; ctx.lineWidth = 6.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 13, y); ctx.lineTo(x + 13, y); ctx.stroke();
      ctx.strokeStyle = '#6C6A70'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(x - 13, y); ctx.lineTo(x + 13, y); ctx.stroke();
      continue;
    }
    // shadow lip
    ctx.fillStyle = mast ? '#1A2130' : light ? 'rgba(30,40,56,.55)' : ROCK_DARK;
    if (h.t === 'crimp') {
      ctx.fillRect(x - 10, y - 5, 20, 4);
      ctx.fillStyle = mast ? STEEL_LIGHT : light ? PAPER : '#EBC29A'; ctx.fillRect(x - 10, y - 2, 20, 4);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.strokeRect(x - 10, y - 2, 20, 4);
    } else {
      const big = h.big ? 1.45 : 1;
      ctx.beginPath(); ctx.ellipse(x, y - 4 * big, 12 * big, 7 * big, 0, 0, 7); ctx.fill();
      let fill = mast ? '#C7CEDA' : light ? PAPER : '#EBC29A';
      if (h.t === 'crumble') fill = mast ? '#B5582F' : '#D9B48A';
      ctx.fillStyle = fill;
      if (mast) { ctx.beginPath(); ctx.moveTo(x - 10, y - 6); ctx.lineTo(x + 10, y - 6); ctx.lineTo(x + 7, y + 6); ctx.lineTo(x - 7, y + 6); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x - 4, y, 1.6, 0, 7); ctx.arc(x + 4, y, 1.6, 0, 7); ctx.fill(); }
      else { ctx.beginPath(); ctx.ellipse(x, y, 11 * big, 7 * big, 0, 0, 7); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke(); }
      if (h.t === 'crumble') {
        ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 6, y + 4); ctx.lineTo(x - 1, y - 1); ctx.lineTo(x + 3, y + 3); ctx.lineTo(x + 7, y - 3); ctx.stroke();
        ctx.fillStyle = INK; for (const [a, b] of [[-7, -2], [5, 3], [0, -4]]) ctx.fillRect(x + a, y + b, 1.6, 1.6);
      }
    }
    // chalk marks where hands have been
    if (h.used) { ctx.fillStyle = CHALK; ctx.globalAlpha = 0.75; ctx.fillRect(x - 6, y + (h.t === 'crimp' ? 2 : 4), 4, 2); ctx.fillRect(x + 1, y + (h.t === 'crimp' ? 2 : 5), 5, 2); ctx.globalAlpha = 1; }
  }
  // the tutorial's target
  if (cur && cur.hold != null) {
    const h = climb.holds[cur.hold];
    const p = 0.5 + 0.5 * Math.sin(clock * 5);
    ctx.strokeStyle = RUST; ctx.lineWidth = 3; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(h.x, h.y, 19 + p * 5, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
}
function drawRope(h) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(h.ax, h.ay); ctx.lineTo(h.x, h.y); ctx.stroke();
  ctx.strokeStyle = '#D8B574'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(h.ax, h.ay); ctx.lineTo(h.x, h.y); ctx.stroke();
  // twist marks
  ctx.strokeStyle = '#8E6A3A'; ctx.lineWidth = 1.2; ctx.beginPath();
  const n = 12; for (let i = 1; i < n; i++) { const t = i / n, x = h.ax + (h.x - h.ax) * t, y = h.ay + (h.y - h.ay) * t; ctx.moveTo(x - 2, y - 2); ctx.lineTo(x + 2, y + 2); } ctx.stroke();
  ctx.fillStyle = '#D8B574'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.x, h.y, 6.5, 0, 7); ctx.fill(); ctx.stroke();
  // the piton
  ctx.fillStyle = INK; ctx.fillRect(h.ax - 6, h.ay - 2, 12, 5);
}

// the climber: chalk-white, drawn with one ink outline round the whole figure
const feet = [{ x: -9, y: 0, vx: 0, vy: 0 }, { x: 9, y: 0, vx: 0, vy: 0 }];
// two-bone IK with the joint bent outward, away from the body's middle
function ikOut(a, b, len1, len2, side) {
  const p = ik(a, b, len1, len2, 1), q = ik(a, b, len1, len2, -1);
  return (p.ex - a.x) * side >= (q.ex - a.x) * side ? p : q;
}
function ik(a, b, len1, len2, bendSign) {
  const dx = b.x - a.x, dy = b.y - a.y; let d = Math.hypot(dx, dy) || 0.001;
  const maxd = len1 + len2 - 0.01; let ex = b.x, ey = b.y;
  if (d > maxd) { ex = a.x + dx / d * maxd; ey = a.y + dy / d * maxd; d = maxd; }
  const x = (len1 * len1 - len2 * len2 + d * d) / (2 * d), hgt = Math.sqrt(Math.max(0, len1 * len1 - x * x));
  const ux = dx / d, uy = dy / d;
  return { ex: a.x + ux * x - uy * hgt * bendSign, ey: a.y + uy * x + ux * hgt * bendSign, hx: ex, hy: ey };
}
function updateFeet(dt) {
  const P = climb.P;
  for (let i = 0; i < 2; i++) {
    const f = feet[i], side = i ? 1 : -1;
    let tx = P.x + side * 9, ty = P.y - FEET;
    if (climb.stand) { ty = climb.stand.y; }
    else {
      // smear on the nearest hold below, if there is one in reach
      let best = null, bd = 50;
      for (const h of climb.holds) {
        if (h.broken || h.t === 'rope') continue;
        const dx = h.x - (P.x + side * 10), dy = (P.y - 6) - h.y;
        if (dy < 14 || dy > 40 || Math.abs(dx) > 22) continue;
        const d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = h; }
      }
      if (best && climb.grips().length && !climb.airborne) { tx = best.x + side * 4; ty = best.y + 4; }
      else { tx = P.x + side * 7 - climb.V.x * 0.03; ty = P.y - FEET + 2 - Math.min(6, Math.abs(climb.V.y) * 0.01); }
    }
    const k = climb.stand ? 1 : 1 - Math.exp(-14 * dt);
    f.x += (tx - f.x) * k; f.y += (ty - f.y) * k;
  }
}
function drawClimber() {
  world();
  const P = climb.P, hs = climb.hands;
  const lean = Math.max(-6, Math.min(6, ((hs[0].x + hs[1].x) / 2 - P.x) * 0.12));
  const neck = { x: P.x + lean, y: P.y + 15 }, hip = { x: P.x - lean * 0.3, y: P.y - 6 };
  const head = { x: neck.x + lean * 0.3, y: neck.y + 11 };
  const sh = [{ x: P.x - SHX + lean * 0.8, y: P.y + SHY }, { x: P.x + SHX + lean * 0.8, y: P.y + SHY }];
  const hipP = [{ x: hip.x - 5, y: hip.y }, { x: hip.x + 5, y: hip.y }];
  const arms = hs.map((h, i) => ikOut(sh[i], { x: h.x, y: h.y }, 33, 33, i ? 1 : -1));
  const legs = feet.map((f, i) => ikOut(hipP[i], f, 21, 21, i ? 1 : -1));
  const limbs = (w) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    for (let i = 0; i < 2; i++) { const g = legs[i]; ctx.moveTo(hipP[i].x, hipP[i].y); ctx.lineTo(g.ex, g.ey); ctx.lineTo(g.hx, g.hy); }
    ctx.stroke();
    ctx.lineWidth = w + 6;
    ctx.beginPath(); ctx.moveTo(hip.x, hip.y + 2); ctx.lineTo(neck.x, neck.y - 4); ctx.stroke();
    ctx.lineWidth = w - 0.5;
    ctx.beginPath();
    for (let i = 0; i < 2; i++) { const a = arms[i]; ctx.moveTo(sh[i].x, sh[i].y); ctx.lineTo(a.ex, a.ey); ctx.lineTo(a.hx, a.hy); }
    ctx.stroke();
  };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; limbs(10.5);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(head.x, head.y, 10.2, 0, 7); ctx.fill();
  for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(arms[i].hx, arms[i].hy, 6.3, 0, 7); ctx.fill(); }
  for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(legs[i].hx + (i ? 2 : -2), legs[i].hy + 1, 6.5, 4.6, 0, 0, 7); ctx.fill(); }
  ctx.strokeStyle = CHALK; limbs(6.5);
  ctx.fillStyle = CHALK; ctx.beginPath(); ctx.arc(head.x, head.y, 7.6, 0, 7); ctx.fill();
  for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(arms[i].hx, arms[i].hy, hs[i].state === 'limp' ? 4 : 4.4, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#3A4458'; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(legs[i].hx + (i ? 2 : -2), legs[i].hy + 1, 4.4, 2.6, 0, 0, 7); ctx.fill(); }
  // beanie and chalk bag
  ctx.fillStyle = RUST; ctx.beginPath(); ctx.arc(head.x, head.y + 1, 7.8, 0.15, Math.PI - 0.15); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAPER; ctx.fillRect(head.x - 7.6, head.y + 0.4, 15.2, 2.2);
  ctx.fillStyle = RUST; ctx.beginPath(); ctx.arc(head.x, head.y + 9.4, 2.6, 0, 7); ctx.fill();
  ctx.fillStyle = MUSTARD; ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(hip.x + 2, hip.y - 3, 8, 9, 2) : ctx.rect(hip.x + 2, hip.y - 3, 8, 9); ctx.fill(); ctx.stroke();
  // grip ring
  const st = climb.stamina;
  if (st < 0.995 || climb.grips().length === 1) {
    const low = st < 0.3, r = 15;
    ctx.lineWidth = 3.6; ctx.strokeStyle = 'rgba(30,40,56,.55)'; ctx.beginPath(); ctx.arc(head.x, head.y, r, 0, 7); ctx.stroke();
    ctx.strokeStyle = low ? (Math.sin(clock * 14) > 0 ? RUST : MUSTARD) : CHALK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(head.x, head.y, r, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * st); ctx.stroke();
  }
}
function drawReach() {
  world();
  for (const h of climb.hands) {
    if (h.state !== 'reach') continue;
    const s = climb.shoulder(h);
    ctx.strokeStyle = CHALK; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.6; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.arc(s.x, s.y, L, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // holds within reach get a chalk tick
    for (const H of climb.holds) {
      if (H.broken) continue;
      const d = Math.hypot(H.x - s.x, H.y - s.y);
      if (d < L + H.r && d > 4) { ctx.strokeStyle = CHALK; ctx.globalAlpha = 0.7; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(H.x, H.y, H.r + 5, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    }
  }
}
function drawParts(dt) {
  world();
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life += dt;
    if (p.life > p.max) { parts.splice(i, 1); continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.rock) { p.vx *= 0.92; p.vy *= 0.92; }
    ctx.globalAlpha = 1 - p.life / p.max; ctx.fillStyle = p.col;
    if (p.rock) { ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.strokeRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + p.life), 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
const drops = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 }));
function drawWeather(sk, dt) {
  screen();
  const st = sk.storm;
  if (st > 0.02) {
    const slant = (climb.wind || 0) * 0.0009 - 0.25;
    ctx.strokeStyle = '#C9D3E2'; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.45 * st;
    ctx.beginPath();
    for (const d of drops) {
      d.y += dt * 1.6 * d.s; d.x += dt * slant * 1.2 * d.s; if (d.y > 1) { d.y -= 1; d.x = Math.random(); } d.x = (d.x + 1) % 1;
      const x = d.x * W, y = d.y * H; ctx.moveTo(x, y); ctx.lineTo(x + slant * 40, y + 26 * d.s);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
    // lightning
    boltT -= dt;
    if (boltT <= 0) {
      boltT = 7 + Math.random() * 9; flash = 1;
      const x0 = W * (0.1 + Math.random() * 0.8), pts = [[x0, 0]]; let x = x0, y = 0; const hz = horizonY();
      while (y < hz) { y += 18 + Math.random() * 30; x += (Math.random() - 0.5) * 50; pts.push([x, Math.min(y, hz)]); }
      bolt = { pts, t: 0.25 };
      sound.thunder(Math.random());
    }
  }
  if (bolt) {
    bolt.t -= dt;
    ctx.strokeStyle = '#FFF6DC'; ctx.lineWidth = 3; ctx.beginPath(); bolt.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    if (bolt.t <= 0) bolt = null;
  }
  if (flash > 0) { ctx.fillStyle = '#E8EEFF'; ctx.globalAlpha = flash * 0.35; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; flash = Math.max(0, flash - dt * 3); }
  // gust warning: streaks across the screen
  const gw = Math.max(climb.gustWarn || 0, climb.gust || 0);
  if (gw > 0.05) {
    const dir = climb.gustDir || -1;
    ctx.strokeStyle = CHALK; ctx.lineWidth = 2; ctx.globalAlpha = 0.35 * gw; ctx.beginPath();
    for (let i = 0; i < 9; i++) { const y = H * (0.15 + i * 0.09) + Math.sin(i * 7) * 20, x = ((clock * 900 * -dir + i * 263) % (W + 300) + W + 300) % (W + 300) - 150; ctx.moveTo(x, y); ctx.lineTo(x + dir * -120, y + 3); }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
}
function drawAltimeter() {
  screen();
  const x = W - Math.max(16, (W - Math.min(W, 1400)) / 2 + 16), y0 = H - Math.max(110, H * 0.16), y1 = Math.max(76, 70);
  const my = m => y0 + (y1 - y0) * Math.min(1, m / 80);
  ctx.strokeStyle = 'rgba(241,231,210,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
  ctx.lineWidth = 2; for (const m of [0, 30, 53, 80]) { ctx.beginPath(); ctx.moveTo(x - 6, my(m)); ctx.lineTo(x + 6, my(m)); ctx.stroke(); }
  ctx.lineWidth = 1; for (let m = 10; m < 80; m += 10) { ctx.beginPath(); ctx.moveTo(x - 3, my(m)); ctx.lineTo(x + 3, my(m)); ctx.stroke(); }
  const b = my((climb.best - FEET) / UNITS_PER_M); ctx.fillStyle = RUST; ctx.fillRect(x - 8, b - 1.5, 16, 3);
  const c = my(climb.heightM()); ctx.fillStyle = CHALK; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, c, 5.5, 0, 7); ctx.fill(); ctx.stroke();
}
function drawGhost() {
  const s = tut.cur(); if (!s || !s.hands.length || mode !== 'play') return;
  screen();
  const per = 1.6, t = (clock % per) / per;
  for (const i of s.hands) {
    if (touchUI) {
      const bx = i ? W * 0.75 : W * 0.25, by = H * 0.68;
      const dy = s.dir > 0 ? -70 : 70, k = Math.min(1, Math.max(0, (t - 0.15) / 0.6));
      const ease = k * k * (3 - 2 * k), y = by - dy / 2 + dy * ease;
      ctx.globalAlpha = (t < 0.1 ? t / 0.1 : t > 0.85 ? (1 - t) / 0.15 : 1) * 0.85;
      ctx.strokeStyle = CHALK; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(bx, by - dy / 2); ctx.lineTo(bx, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(196,69,43,.55)'; ctx.strokeStyle = CHALK; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(bx, y, 22, 26, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      const bx = W / 2 + 70 * S + 60, by = H * 0.66;
      if (s.hands.length > 1 && i === 1) continue;
      const dy = s.dir > 0 ? -50 : 50, k = Math.min(1, Math.max(0, (t - 0.15) / 0.6)), ease = k * k * (3 - 2 * k), y = by - dy / 2 + dy * ease;
      ctx.globalAlpha = (t < 0.1 ? t / 0.1 : t > 0.85 ? (1 - t) / 0.15 : 1) * 0.9;
      ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(bx, y, 17, 25, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = RUST;
      for (const j of s.hands) { ctx.beginPath(); ctx.moveTo(bx, y - 25); ctx.ellipse(bx, y, 17, 25, 0, j ? -Math.PI / 2 : Math.PI, j ? 0 : -Math.PI / 2); ctx.lineTo(bx, y); ctx.closePath(); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(bx - 17, y - 3); ctx.lineTo(bx + 17, y - 3); ctx.moveTo(bx, y - 25); ctx.lineTo(bx, y - 3); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(bx, y, 17, 25, 0, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

// ---------- the loop ----------
let last = performance.now(), acc = 0;
const STEP = 1 / 120;
let hold = DEBUG && Q.has('hold');
function tick(dt) {
  if (bot) bot.tick(dt);
  climb.step(dt); handleEvents();
}
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  try { advance(dt); draw(dt); } catch (e) { console.error(e); }
}
function advance(dt) {
  clock += dt;
  if (!hold && (mode === 'play' || mode === 'summit' || mode === 'title' && climb.airborne)) {
    acc += dt * (AUTO ? +(Q.get('speed') || 1) : 1);
    let n = 0; while (acc >= STEP && n < 40) { tick(STEP); acc -= STEP; n++; }
    if (n >= 40) acc = 0;
  }
  updateCamera(dt);
  updateFeet(dt);
  tut.update(); updateNarr(dt); watchProgress(dt);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('in'); }
  if (summitT > 0) { summitT -= dt; if (summitT <= 0 && !AUTO) showSummit(); }
  saveT -= dt; if (saveT <= 0) { saveT = 2; if (mode === 'play') persist(); }
  // HUD
  $('altm').textContent = climb.heightM().toFixed(1);
  $('altb').textContent = `best ${((climb.best - FEET) / UNITS_PER_M).toFixed(0)} m`;
  const sk = skyAt(camY);
  sound.ambience({ height: climb.P.y, wind: climb.wind, gust: climb.gust, storm: sk.storm, fallSpeed: climb.airborne ? Math.max(0, -climb.V.y) : 0, t: clock });
}
let saveT = 2;
function updateCamera(dt) {
  const P = climb.P;
  const half = W / 2 / S, lim = Math.max(0, 250 - half);
  const tx = Math.max(-lim, Math.min(lim, P.x * 0.8));
  const fast = climb.airborne && climb.V.y < -400;
  // on short screens sit the climber lower, so the next holds up stay clear of the altimeter
  const ty = Math.max(H / 2 / S - 130, P.y + 50, P.y + 260 - (H / 2 - 84) / S);
  const k = 1 - Math.exp(-(fast ? 9 : 4.5) * dt);
  camX += (tx - camX) * k; camY += (ty - camY) * k;
}
function draw(dt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const sk = skyAt(camY);
  let ox = 0, oy = 0;
  if (shake > 0) { ox = (Math.random() - 0.5) * 10 * shake; oy = (Math.random() - 0.5) * 10 * shake; shake = Math.max(0, shake - dt * 3); }
  const cx = camX, cy = camY; camX -= ox / S; camY += oy / S;
  drawSky(sk);
  drawBeam(sk);
  drawCliff();
  drawBeach();
  drawMast();
  drawLighthouse(sk);
  drawLedges();
  drawHolds();
  drawReach();
  drawClimber();
  drawParts(dt);
  drawSea();
  camX = cx; camY = cy;
  drawWeather(sk, dt);
  // paper grain over everything
  screen(); ctx.globalAlpha = 1; ctx.fillStyle = grainPat; ctx.globalCompositeOperation = 'multiply'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
  drawAltimeter();
  drawGhost();
}

// ---------- start ----------
if (DEMO) {
  const at = (x, y) => climb.holds.find(h => h.x === x && h.y === y).id;
  climb.placeOn(at(-8, 2208), at(48, 2150));
  climb.best = FEET + 44.6 * UNITS_PER_M; climb.climbTime = 611;
  for (let i = 0; i < 240; i++) climb.step(STEP);
  climb.input(1, false); for (let i = 0; i < 4; i++) climb.step(STEP);
  climb.input(1, true); for (let i = 0; i < 30; i++) { climb.input(1, true, 0.2, 1.1); climb.step(STEP); }
  climb.events.length = 0;
  camY = climb.P.y + 50; camX = climb.P.x * 0.8;
  for (let i = 0; i < 30; i++) updateFeet(0.05);
  clock = 2.3;
  hold = true;
  $('narrp').textContent = LINES.rung; $('narr').classList.add('in');
} else if (AUTO) {
  mode = 'play';
} else {
  openTitle();
}
renderHow();
if (DEBUG) window.grip = { climb, tick, step: n => { for (let i = 0; i < n; i++) tick(STEP); }, draw: () => draw(0), get bot() { return bot; }, set hold(v) { hold = v; }, camera: () => { camY = climb.P.y + 50; } };
requestAnimationFrame(frame);
window.toyboxReady?.();
