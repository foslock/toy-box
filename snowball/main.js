// Snowball: you are a snowball, and the only way is down. Pick up anything smaller than you on the way to the town at
// the bottom, and take as much of the town with you as your size allows.
//
// URL flags: ?demo (the preview shot), ?autoplay, ?debug, ?mountain=<id>, ?speed=<n>, ?hold, ?all (every lift open),
// ?fresh (ignore the saved game)
import { MOUNTAINS, buildCourse } from './course.js';
import { Run } from './sim.js';
import { ITEMS, QUIPS, sizeWords } from './items.js';
import { View } from './render.js';
import { Sound } from './sound.js';
import { makeBot } from './bot.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug'), AUTO = Q.has('autoplay') || DEMO;
const SPEED = Math.max(1, Math.min(16, +Q.get('speed') || 1));
const TOUCH = matchMedia('(pointer: coarse)').matches;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const GRADE = { green: 'Easiest', blue: 'More difficult', black: 'Most difficult', double: 'Experts only' };
document.body.classList.toggle('touch', TOUCH);

// ------------------------------------------------------------------------------------------------- saved game
const KEY = 'snowball.v1';
let save = { best: {}, found: {}, tut: false, steer: 'drag', sound: 'all' };
try { if (!Q.has('fresh')) Object.assign(save, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} };
const unlocked = i => i === 0 || Q.has('all') || DEMO || (save.best[MOUNTAINS[i - 1].id]?.medal || 0) >= 1;

// ------------------------------------------------------------------------------------------------- set up
const view = new View($('c'), { mobile: TOUCH });
const sound = new Sound();
sound.sfxOn = save.sound !== 'off'; sound.musicOn = save.sound === 'all';
addEventListener('resize', () => view.resize());

let mode = 'title';         // title, map, play, finale, report
let mi = 0, C = null, run = null, bot = null;
let hold = Q.has('hold'), paused = false;
let timeScale = 1, slowT = 0, freezeT = 0;
let tut = null;             // the radio lessons, on the first run of Bunny Hill
let fin = null;             // the finale
let pushT = 0, pushing = false;

await view.load('models.glb?v=3');

function loadMountain(i) {
  mi = i;
  C = buildCourse(MOUNTAINS[i], 1);
  view.setCourse(C);
  run = new Run(C);
  view.ball.reset(run.ball.r);
  view.camState.dist = 2;
  return run;
}

// ------------------------------------------------------------------------------------------------- the title
function showTitle() {
  mode = 'title';
  loadMountain(0);
  $('title').hidden = false; $('map').hidden = true; $('hud').hidden = true; $('report').hidden = true;
  radio(null);
}
const pushEl = $('push');
const beginPush = e => { e?.preventDefault?.(); sound.start(); if (mode !== 'title' || pushing) return; pushing = true; pushT = 0; };
const endPush = () => {
  if (!pushing) return;
  pushing = false;
  const power = clamp(pushT / 0.9, 0, 1);
  if (power < 0.12) { $('pushhow').textContent = 'Hold a little longer'; return; }
  // off it goes: give the ball a shove, and either roll straight into Bunny Hill (first time) or go to the map
  run.ball.vd = 2 + power * 5;
  sound.click();
  if (!save.tut && !DEMO) { save.tut = true; store(); startRun(0, { keep: true, tutorial: true }); }
  else { mode = 'leaving'; setTimeout(() => wipe(() => showMap()), 700); }
};
pushEl.addEventListener('pointerdown', e => { pushEl.setPointerCapture(e.pointerId); beginPush(e); });
pushEl.addEventListener('pointerup', endPush);
pushEl.addEventListener('pointercancel', () => { pushing = false; });
$('pushhow').textContent = TOUCH ? 'Hold, then let go' : 'Hold the button (or Space), then let go';

// ------------------------------------------------------------------------------------------------- the trail map
let sel = 0;
function showMap() {
  mode = 'map';
  sound.music?.stop();
  $('title').hidden = true; $('map').hidden = false; $('hud').hidden = true; $('report').hidden = true; $('pause').hidden = true;
  radio(null);
  drawRange();
  const last = MOUNTAINS.findIndex((m, i) => unlocked(i) && !(save.best[m.id]?.medal >= 1));
  pick(last >= 0 ? last : sel, false);
}

// The range as a painted trail map: each peak drawn with its real routes running down it.
function drawRange() {
  const range = $('range'), box = range.getBoundingClientRect(), n = MOUNTAINS.length;
  const H = 760, s = Math.max(0.2, box.height / H);
  const wide = box.width >= 760;
  const peakPx = wide ? box.width / n : Math.min(box.width * 0.66, 320);
  const P = peakPx / s, W = P * n + (wide ? 0 : P * 0.4);
  const ink = '#14234a';
  let seed = 11;
  const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let svg = `<svg width="${Math.round(W * s)}" height="${Math.round(box.height)}" viewBox="0 0 ${W.toFixed(0)} ${H}" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Mountains">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb6ea"/><stop offset=".75" stop-color="#e3f0fb"/></linearGradient>
    <linearGradient id="rock" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c9dcf1"/><stop offset=".5" stop-color="#a9c3e4"/><stop offset=".5" stop-color="#7f9ccb"/><stop offset="1" stop-color="#6d8bbd"/></linearGradient>
    <pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="9" height="9" fill="none"/><rect width="1.6" height="9" fill="rgba(20,35,74,.12)"/></pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  // a far range, pale, and a few clouds
  let far = `M0 ${H}`;
  for (let x = 0; x <= W + 60; x += 60) far += ` L${x} ${H * (0.5 + 0.12 * Math.sin(x * 0.011) + 0.06 * Math.sin(x * 0.037))}`;
  svg += `<path d="${far} L${W + 60} ${H} Z" fill="#c4daf2"/>`;
  for (let k = 0; k < W / 400; k++) { const cx = 120 + k * 400 + R() * 120, cy = 60 + R() * 120; svg += `<g fill="#fff" opacity=".85"><ellipse cx="${cx}" cy="${cy}" rx="70" ry="18"/><ellipse cx="${cx + 30}" cy="${cy - 12}" rx="40" ry="20"/><ellipse cx="${cx - 34}" cy="${cy - 6}" rx="28" ry="14"/></g>`; }
  MOUNTAINS.forEach((m, i) => {
    const cx = P * (i + 0.5) + (wide ? 0 : P * 0.2), lock = !unlocked(i);
    const top = H * [0.3, 0.3, 0.24, 0.24, 0.2, 0.16][i] + (wide ? 30 : 0), base = H + 4, half = P * 0.78;
    // the ridge: up one side and down the other, with shoulders
    const ridge = [[cx - half, base]];
    const K = 16;
    for (let k = 1; k < K; k++) {
      const t = k / K, x = cx - half + t * half * 2, u = Math.abs(t - 0.5) * 2;
      const y = top + (base - top) * Math.pow(u, 1.25) + (k !== K / 2 ? (R() - 0.35) * 26 * u : 0);
      ridge.push([x, y]);
    }
    ridge.push([cx + half, base]);
    const body = 'M' + ridge.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + 'Z';
    // the snow cap: the ridge above the snowline, with a scalloped hem
    const snowY = top + (base - top) * 0.36;
    const capPts = ridge.filter(p => p[1] < snowY);
    const lx = capPts[0][0], rx = capPts[capPts.length - 1][0];
    let cap = `M${lx} ${snowY} ` + capPts.map(p => `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ` L${rx} ${snowY}`;
    const sc = 6;
    for (let k = sc; k > 0; k--) { const x0 = lx + (rx - lx) * (k / sc), x1 = lx + (rx - lx) * ((k - 1) / sc); cap += ` Q${((x0 + x1) / 2).toFixed(1)} ${(snowY + 22 + (k % 2) * 16).toFixed(1)} ${x1.toFixed(1)} ${snowY}`; }
    cap += 'Z';
    svg += `<g class="peak${lock ? ' locked' : ''}" data-i="${i}" tabindex="0" role="button" aria-label="${m.name}, ${GRADE[m.grade]}${lock ? ', closed' : ''}">
      <path d="${body}" fill="url(#rock)" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
      <path d="${body}" fill="url(#hatch)"/>
      <path d="${cap}" fill="#fff" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`;
    // the routes, laid on the face: d down the mountain, x across
    const xs = Math.max(...m.routes.flatMap(r => r.path.map(p => Math.abs(p[1])))) || 30;
    const sx = (half * 0.42) / xs, ty = top + 36, sy = (base - 70 - ty) / m.len;
    const col = lock ? '#8a93a6' : { green: '#2f9a4a', blue: '#2766c9', black: '#16181d', double: '#16181d' }[m.grade];
    const sm = t => t * t * (3 - 2 * t);
    for (const r of m.routes) {
      const pts = [];
      const d0 = Math.max(r.path[0][0], 0), d1 = Math.min(r.path[r.path.length - 1][0], m.len);
      for (let d = d0; d <= d1 + 0.1; d += (d1 - d0) / 24) {
        let x = r.path[r.path.length - 1][1];
        for (let k = 1; k < r.path.length; k++) if (d <= r.path[k][0]) { const a = r.path[k - 1], b = r.path[k]; x = a[1] + (b[1] - a[1]) * sm((d - a[0]) / (b[0] - a[0])); break; }
        pts.push(`${(cx + x * sx).toFixed(1)},${(ty + d * sy).toFixed(1)}`);
      }
      if (pts.length < 2) continue;
      const ice = typeof r.surf !== 'string' && r.surf.some(z => z[2] === 'lake');
      svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="${pts.join(' ')}" fill="none" stroke="${ice && !lock ? '#5fb4e8' : col}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" ${ice ? 'stroke-dasharray="9 7"' : ''}/>`;
      for (const f of r.feats || []) if (f[0] === 'cliff' || f[0] === 'kicker' && f[2] > 2.5) {
        const fd = f[0] === 'cliff' ? f[2] : f[1];
        let x = 0; for (let k = 1; k < r.path.length; k++) if (fd <= r.path[k][0]) { const a = r.path[k - 1], b = r.path[k]; x = a[1] + (b[1] - a[1]) * sm((fd - a[0]) / (b[0] - a[0])); break; }
        svg += `<path d="M${cx + x * sx - 9} ${ty + fd * sy + 5} l9 -9 l9 9" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
    }
    // the town at the foot
    for (let k = 0; k < 7; k++) {
      const hx = cx - 70 + k * 21, hy = base - 30 - (k % 3) * 5, hh = 16 + (k % 2) * 7;
      svg += `<path d="M${hx} ${hy} l10 -11 l10 11 v${hh} h-20z" fill="${['#f5c6c0', '#fbe7a8', '#c7e6d4', '#bcd8f2', '#d9c8ef'][k % 5]}" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M${hx - 1} ${hy + 1} l11 -12 l11 12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`;
    }
    // its sign: a board with the grade symbol and name, and medals won
    const bw = Math.max(150, m.name.length * 13 + 52), by = top - 78 + (wide && i % 2 ? 40 : 0), bx = cx - bw / 2;
    const sym = m.grade === 'green' ? `<circle cx="${bx + 22}" cy="${by + 24}" r="10" fill="#2f9a4a"/>` : m.grade === 'blue' ? `<rect x="${bx + 12}" y="${by + 14}" width="20" height="20" fill="#2766c9"/>`
      : m.grade === 'black' ? `<rect x="${bx + 14}" y="${by + 16}" width="16" height="16" fill="#16181d" transform="rotate(45 ${bx + 22} ${by + 24})"/>`
      : `<rect x="${bx + 9}" y="${by + 18}" width="12" height="12" fill="#16181d" transform="rotate(45 ${bx + 15} ${by + 24})"/><rect x="${bx + 23}" y="${by + 18}" width="12" height="12" fill="#16181d" transform="rotate(45 ${bx + 29} ${by + 24})"/>`;
    const best = save.best[m.id];
    svg += `<g class="lbl"><line x1="${cx}" y1="${by + 48}" x2="${cx}" y2="${top + 6}" stroke="#3a2414" stroke-width="5"/>
      <rect class="board" x="${bx}" y="${by}" width="${bw}" height="48" rx="6" fill="${lock ? '#9a8a7a' : '#8a5a33'}" stroke="#3a2414" stroke-width="3"/>
      <rect x="${bx + 5}" y="${by + 6}" width="34" height="36" rx="4" fill="#fff"/>${sym}
      <text x="${bx + 46}" y="${by + 32}" font-family="Big Shoulders Display" font-weight="900" font-size="23" letter-spacing="1" fill="#fff3dc">${m.name.toUpperCase()}</text>
      ${best ? `<g transform="translate(${bx + bw - 10} ${by - 2})">${[0, 1, 2].map(k => `<circle cx="${-k * 19}" cy="0" r="9" fill="${best.medal > 2 - k ? ['#f2c230', '#aab6c4', '#c9813c'][k] : '#fff'}" stroke="${ink}" stroke-width="2.5"/>`).join('')}</g>` : ''}
      ${lock ? `<g transform="translate(${cx} ${top + (base - top) * 0.55}) rotate(-8)"><rect x="-60" y="-19" width="120" height="38" rx="4" fill="#e0402c" stroke="${ink}" stroke-width="3"/><text x="0" y="8" text-anchor="middle" font-family="Big Shoulders Display" font-weight="900" font-size="22" letter-spacing="3" fill="#fff">CLOSED</text></g>` : ''}
    </g></g>`;
  });
  svg += '</svg>';
  range.innerHTML = svg;
  range.querySelectorAll('.peak').forEach(g => {
    g.addEventListener('click', () => { if (!dragged) pick(+g.dataset.i); });
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(+g.dataset.i); } });
  });
}
addEventListener('resize', () => { if (mode === 'map') { drawRange(); document.querySelectorAll('.peak').forEach(g => g.classList.toggle('sel', +g.dataset.i === sel)); } });
// drag the map sideways with a mouse too
let dragged = false;
{
  const range = $('range');
  let down = null;
  range.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = { x: e.clientX, s: range.scrollLeft }; dragged = false; });
  addEventListener('pointermove', e => { if (!down) return; if (Math.abs(e.clientX - down.x) > 5) dragged = true; range.scrollLeft = down.s - (e.clientX - down.x); });
  addEventListener('pointerup', () => { down = null; setTimeout(() => { dragged = false; }, 0); });
}

function pick(i, user = true) {
  sel = i;
  if (user) { sound.start(); sound.click(); }
  const m = MOUNTAINS[i], lock = !unlocked(i);
  document.querySelectorAll('.peak').forEach(g => g.classList.toggle('sel', +g.dataset.i === i));
  const tk = $('ticket');
  tk.classList.add('off');
  setTimeout(() => {
    $('tname').innerHTML = `<i class="grade ${m.grade}" title="${GRADE[m.grade]}"></i>${m.name}`;
    $('tblurb').textContent = lock ? `Closed until you take bronze on ${MOUNTAINS[i - 1].name}.` : m.blurb;
    const best = save.best[m.id];
    $('tmedals').innerHTML = ['b', 's', 'g'].map((c, k) => `<div class="medal ${c}${best && best.medal > k ? ' got' : ''}"><b>${sizeWords(m.medals[k])}</b><span>${['Bronze', 'Silver', 'Gold'][k]}</span></div>`).join('');
    $('tbest').textContent = best ? sizeWords(best.dia) : '—';
    $('ttown').textContent = best ? Math.round(best.town * 100) + '%' : '—';
    $('tgo').textContent = lock ? 'Lift closed' : `Ride the lift · start at ${sizeWords(m.start)}`;
    tk.classList.toggle('locked', lock);
    tk.classList.remove('off');
  }, 120);
  // bring it into view on a narrow screen
  const g = document.querySelector(`.peak[data-i="${i}"]`), range = $('range');
  if (g && range.scrollWidth > range.clientWidth) {
    const b = g.getBoundingClientRect(), rb = range.getBoundingClientRect();
    range.scrollBy({ left: b.left + b.width / 2 - (rb.left + rb.width / 2), behavior: 'smooth' });
  }
}
$('tgo').onclick = () => {
  if (!unlocked(sel)) { sound.boing(2); $('ticket').animate([{ transform: 'translateX(-50%) rotate(-1.2deg)' }, { transform: 'translateX(-46%) rotate(1deg)' }, { transform: 'translateX(-54%) rotate(-2deg)' }, { transform: 'translateX(-50%) rotate(-1.2deg)' }], { duration: 300 }); return; }
  // punch the ticket
  const tk = $('ticket'), p = document.createElement('div');
  p.className = 'punch'; p.style.left = (tk.clientWidth - 70) + 'px'; p.style.top = '40px';
  tk.appendChild(p); sound.stamp();
  setTimeout(() => { p.remove(); wipe(() => startRun(sel, { tutorial: sel === 0 && !save.tutDone })); }, 380);
};

function wipe(fn) {
  const w = $('wipe');
  w.classList.remove('on'); void w.offsetWidth; w.classList.add('on');
  setTimeout(fn, 480);
}

// ------------------------------------------------------------------------------------------------- a run
function startRun(i, o = {}) {
  if (!o.keep) loadMountain(i);
  mode = 'play'; paused = false; fin = null; timeScale = 1; slowT = 0;
  $('title').hidden = true; $('map').hidden = true; $('hud').hidden = false; $('report').hidden = true; $('pause').hidden = true;
  const m = MOUNTAINS[i];
  $('hudName').innerHTML = `<i class="grade ${m.grade}"></i>${m.name}`;
  $('hudRoute').textContent = C.routes[0].name;
  setupRuler();
  drawMini();
  nextUp();
  bot = AUTO ? makeBot(DEMO ? 0.9 : 0.8, 7) : null;
  tut = o.tutorial && !AUTO ? { step: -1, t: 0, left: 0, right: 0, brake: 0, bumped: false } : null;
  said = new Set();
  lastDia = 0;
  if (tut) nextLesson();
  if (sound.ctx) sound.music.start(i * 7 + 3, [60, 62, 57, 59, 61, 60][i]);
  view.fx.trail.clear();
}

// the size readout: a ruler from the start size to past gold, log scaled, with the medals marked
let rulerLo = 0, rulerHi = 1;
function setupRuler() {
  const m = MOUNTAINS[mi];
  rulerLo = Math.log(m.start * 0.9); rulerHi = Math.log(m.medals[2] * 1.25);
  const ticks = $('ruler').querySelectorAll('.tick');
  m.medals.forEach((v, k) => { ticks[k].style.left = rulerPos(v) * 100 + '%'; });
}
const rulerPos = d => clamp((Math.log(d) - rulerLo) / (rulerHi - rulerLo), 0, 1);

// the run so far on a strip down the right-hand side: every route, and you
const mini = $('mini'), mg = mini.getContext('2d');
let miniBg = null;
function drawMini() {
  const W = mini.width, H = mini.height, m = MOUNTAINS[mi];
  miniBg = document.createElement('canvas'); miniBg.width = W; miniBg.height = H;
  const g = miniBg.getContext('2d');
  const xs = Math.max(...m.routes.flatMap(r => r.path.map(p => Math.abs(p[1]) + p[2] * 0.4)));
  const kx = (W * 0.36) / xs, ky = (H - 24) / m.len;
  mini.map = (x, d) => [W / 2 + x * kx, 12 + d * ky];
  for (const pass of [0, 1]) for (const r of C.routes) {
    g.beginPath();
    for (let d = Math.max(0, r.d0); d <= Math.min(m.len, r.d1); d += 10) { const [cx] = C.routeAt(r, d); const [px, py] = mini.map(cx, d); d === Math.max(0, r.d0) ? g.moveTo(px, py) : g.lineTo(px, py); }
    g.strokeStyle = pass ? (r.mainSurf === 'ice' ? '#7cc4ef' : r.surf === 'piste' ? '#ffffff' : '#e8eef6') : '#14234a';
    g.lineWidth = pass ? 4 : 8; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
  }
  // the town and the finish
  const [fx, fy] = mini.map(0, C.def.town.from);
  g.fillStyle = '#e0402c'; g.fillRect(4, fy, W - 8, 3);
  g.fillStyle = '#14234a'; g.font = '800 15px "Big Shoulders Display"'; g.textAlign = 'center'; g.fillText('TOWN', W / 2, Math.min(H - 4, fy + 18));
}
function drawMiniFrame() {
  if (!miniBg) return;
  const W = mini.width, H = mini.height;
  mg.clearRect(0, 0, W, H); mg.drawImage(miniBg, 0, 0);
  const b = run.ball, [x, y] = mini.map(b.x, clamp(b.d, 0, MOUNTAINS[mi].len));
  mg.beginPath(); mg.arc(x, y, 7 + Math.min(6, b.r), 0, Math.PI * 2);
  mg.fillStyle = '#fff'; mg.fill(); mg.lineWidth = 3; mg.strokeStyle = '#e0402c'; mg.stroke();
}

// ------------------------------------------------------------------------------------------------- input
const keys = new Set();
const ptr = { id: null, x0: 0, y0: 0, x: 0, y: 0 };
let kbSteer = 0, tilt = 0;
const stick = $('stick');
addEventListener('keydown', e => {
  if (e.repeat && (e.code === 'Space' || e.code === 'Enter')) return;
  keys.add(e.code);
  sound.start();
  if (mode === 'title' && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown' || e.code === 'KeyS')) { e.preventDefault(); beginPush(); }
  if (mode === 'play' && (e.code === 'Escape' || e.code === 'KeyP')) togglePause();
  if (/Arrow|Space/.test(e.code)) e.preventDefault();
});
addEventListener('keyup', e => {
  keys.delete(e.code);
  if (mode === 'title' && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown' || e.code === 'KeyS')) endPush();
});
addEventListener('blur', () => { keys.clear(); ptr.id = null; stick.classList.remove('on'); if (mode === 'play' && !AUTO) togglePause(true); });
// iPhones only let sound start from a touch ending or a click; if it comes alive mid-run, start the band too
for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, () => {
  const had = !!sound.ctx;
  sound.start();
  if (!had && sound.ctx && mode === 'play' && !sound.music.on) sound.music.start(mi * 7 + 3, [60, 62, 57, 59, 61, 60][mi]);
}, { passive: true });
const canvas = $('c');
canvas.addEventListener('pointerdown', e => {
  sound.start();
  if (mode !== 'play' || paused) return;
  canvas.setPointerCapture(e.pointerId);
  Object.assign(ptr, { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY });
  stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px';
  stick.classList.add('on'); stick.firstElementChild.style.transform = '';
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== ptr.id) return;
  ptr.x = e.clientX; ptr.y = e.clientY;
  const R = stickR(), dx = clamp(ptr.x - ptr.x0, -R, R), dy = clamp(ptr.y - ptr.y0, -R, R);
  stick.firstElementChild.style.transform = `translate(${dx * 0.45}px, ${dy * 0.45}px)`;
});
const endPtr = e => { if (e.pointerId === ptr.id) { ptr.id = null; stick.classList.remove('on'); } };
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
const stickR = () => Math.min(innerWidth, innerHeight) * 0.15;
addEventListener('deviceorientation', e => {
  if (e.gamma == null) return;
  // landscape phones tilt about the other axis
  const ang = (screen.orientation?.angle ?? window.orientation ?? 0);
  const g = ang === 90 ? e.beta : ang === -90 || ang === 270 ? -e.beta : e.gamma;
  tilt = clamp(g / 22, -1, 1);
});
async function enableTilt() {
  try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return false; } } catch { return false; }
  return true;
}

function readInput(dt) {
  const inp = run.input;
  const L = keys.has('ArrowLeft') || keys.has('KeyA'), Rr = keys.has('ArrowRight') || keys.has('KeyD');
  const target = (Rr ? 1 : 0) - (L ? 1 : 0);
  kbSteer += clamp(target - kbSteer, -dt * 5, dt * 5);
  if (!target && Math.abs(kbSteer) < 0.05) kbSteer = 0;
  let st = kbSteer, brake = keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0, tuck = keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0;
  if (ptr.id !== null) {
    const R = stickR();
    st += clamp((ptr.x - ptr.x0) / R, -1, 1);
    const dy = (ptr.y - ptr.y0) / R;
    if (dy > 0.45) brake = 1; else if (dy < -0.45) tuck = 1;
  }
  if (save.steer === 'tilt') st += tilt;
  inp.steer = clamp(st, -1, 1); inp.brake = brake; inp.tuck = tuck;
  if (tut) { if (inp.steer < -0.3) tut.left += dt; if (inp.steer > 0.3) tut.right += dt; if (brake) tut.brake += dt; }
}

// ------------------------------------------------------------------------------------------------- the radio
const LESSONS = [
  { say: () => 'Patrol to... snowball? There’s a snowball loose on Bunny Hill. Is that you? It’s you.', done: t => t.t > 4.2 },
  { say: () => TOUCH ? 'Steer by dragging left and right, anywhere on the screen. Go on, try both ways.' : 'Steer with <kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>D</kbd>. Try both ways.', done: t => t.left > 0.3 && t.right > 0.3 },
  { say: () => 'Roll over the pinecones and mittens. Anything smaller than you sticks.', done: () => run.eatenN >= 6 },
  { say: () => 'Big things bounce you off and knock stuff loose. Grow first, then come back for them.', done: t => t.bumped || t.t > 7 },
  { say: () => TOUCH ? 'Drag down to dig in: slower, but you pack on more snow. Drag up to tuck and go faster.' : 'Hold <kbd>↓</kbd> to dig in: slower, but you pack on snow. <kbd>↑</kbd> tucks for speed.', done: t => t.brake > 0.6 || t.t > 9 },
  { say: () => 'The bigger you get, the faster you roll, and the wider you turn. Watch the ruler: that’s bronze, silver, gold.', done: t => t.t > 7 },
  { say: () => 'Down at the bottom is Tannenbrück. Whatever’s smaller than you when you get there comes too. Over and out.', done: t => t.t > 7 },
];
function nextLesson() {
  tut.step++; tut.t = 0;
  if (tut.step >= LESSONS.length) { tut = null; save.tutDone = true; store(); setTimeout(() => radio(null), 300); return; }
  radio(LESSONS[tut.step].say(), LESSONS.length, tut.step);
}
let radioT = 0;
function radio(html, steps = 0, at = 0, hold = 0) {
  const r = $('radio');
  if (!html) { r.classList.add('off'); return; }
  $('radiotext').innerHTML = html;
  $('radiosteps').innerHTML = steps ? Array.from({ length: steps }, (_, k) => `<i class="${k < at ? 'done' : ''}"></i>`).join('') : '';
  r.classList.remove('off');
  sound.radio();
  radioT = hold;
}
// the patrol's remarks, once a run each
let said = new Set();
function remark(key, text) {
  if (tut || said.has(key) || DEMO) return;
  said.add(key);
  radio(text, 0, 0, 3.6);
}

// ------------------------------------------------------------------------------------------------- announcements
const HINTS = {
  picnic: 'Picnic leftovers', woods_s: 'Lots of little things', school: 'Kids, kit and cones', meadow: 'Snowmen', pond: 'Ice: no steering', piste_s: 'Skiers', lostprop: 'Jump, then lost property',
  trailhead: 'Hikers', deepwoods: 'Wildlife, in deep powder', logging: 'Logs and lumber', lake: 'Ice: no steering', campsite: 'Tents and campfires', ravine: 'Bumpy, with bears',
  topstation: 'Crowds', piste_busy: 'Skiers, lots of them', park: 'Kickers and boarders', bowl: 'Deep powder, goats', apres: 'Hot tubs', liftline: 'The queue', resort_town: 'Town',
  summit: 'Climbers', glacier: 'Ice, crevasse, a mammoth', ridge: 'Narrow and bumpy', basecamp: 'Tents and igloos', yeti: 'Here be yetis', chute: 'Fast and bumpy', alpine_town: 'Town',
  reindeer: 'Reindeer', toboggan: 'Sledging kids', lanternwoods: 'Lanterns and reindeer', market: 'Market stalls', rink: 'Ice: no steering', rooftop: 'Jumps between the houses', holly_town: 'Town',
  bigpeak: 'Everything', resort_mix: 'Chalets and cars', bigforest: 'Giant trees, moose, bears', bigglacier: 'Ice, yetis, mammoths', suburbs: 'Houses', railyard: 'Trains', city: 'The Capital',
};
const routeHint = r => {
  const z = (r.zones || []).map(z => z[2]);
  const k = z.find(k => HINTS[k]);
  const jump = (r.feats || []).some(f => f[0] === 'cliff' || f[0] === 'kicker');
  return [HINTS[k], jump && !/jump|Jump/i.test(HINTS[k] || '') ? 'jumps' : null].filter(Boolean).join(' · ');
};
let signT = 0;
function sign(html, dur = 2.6) {
  const s = $('sign');
  s.innerHTML = html;
  s.classList.remove('on'); void s.offsetWidth; s.classList.add('on');
  signT = dur;
}
function forkSign(f) {
  const n = f.routes.length;
  const html = f.routes.map((r, k) => {
    const side = n === 1 ? '' : k === 0 ? 'l' : k === n - 1 ? 'r' : '';
    return `<div class="board ${side}"><div class="n">${r.name}</div><div class="h">${routeHint(r)}</div></div>`;
  }).join('');
  sign(html, 4.2);
  sound.click();
}
function banner(small, big) {
  const b = $('banner');
  b.querySelector('small').textContent = small; b.querySelector('b').textContent = big;
  b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
}
function flash(a = 0.6) { $('flash').animate([{ opacity: a }, { opacity: 0 }], { duration: 260, easing: 'ease-out' }); }

// what you just picked up, popping off the ball: big things get a label each, small ones a running tally
const pops = $('pops');
let tally = null, slot = 0;
function popAnim(el, x, y, dx, long) {
  el.animate([
    { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(.4)`, opacity: 0 },
    { transform: `translate(${x + dx * 0.3}px, ${y - 24}px) translate(-50%, -50%) scale(1.15)`, opacity: 1, offset: 0.15 },
    { transform: `translate(${x + dx}px, ${y - 70}px) translate(-50%, -50%) scale(1)`, opacity: 1, offset: 0.7 },
    { transform: `translate(${x + dx}px, ${y - 96}px) translate(-50%, -50%) scale(.9)`, opacity: 0 },
  ], { duration: long ? 1700 : 1150, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => el.remove();
}
function pop(it, e) {
  if (pops.childElementCount > 7) pops.firstElementChild.remove();
  const info = ITEMS[it.key], b = run.ball;
  const p = view.project(b.x, b.y + b.r * 1.15, b.d);
  if (!p.on) return;
  if (e.frac < 0.55) {
    // the tally: "+7 little things", the last one named
    const now = performance.now();
    if (!tally || now - tally.t > 900 || !tally.el.isConnected) {
      const el = document.createElement('div');
      el.className = 'pop';
      pops.appendChild(el);
      tally = { el, n: 0, t: now };
      popAnim(el, p.x, p.y, (Math.random() - 0.5) * 40, false);
    }
    tally.n++; tally.t = now;
    tally.el.innerHTML = tally.n > 1 ? `<b>+${tally.n} things</b><i>${info.name}</i>` : `<b>+${info.name}</b>`;
    tally.el.getAnimations().forEach(a => { if (a.currentTime > 500) a.currentTime = 500; });
    return;
  }
  const el = document.createElement('div');
  el.className = 'pop ' + (e.frac > 0.8 ? 'huge' : 'big');
  el.innerHTML = `<b>+${info.name}</b><i>${info.lines[Math.floor(Math.random() * info.lines.length)]}</i>`;
  pops.appendChild(el);
  slot = (slot + 1) % 3;
  popAnim(el, p.x + (slot - 1) * 70, p.y - slot * 30, (slot - 1) * 30, true);
}

// ------------------------------------------------------------------------------------------------- events from the run
let wallT = 0;
function events(t) {
  const fx = view.fx, b = run.ball;
  for (const e of run.events) {
    switch (e.t) {
      case 'eat': {
        const it = e.it, info = ITEMS[it.key];
        view.ball.attach(it, e.dir, t);
        // a puff of snow where it went in, sized to it
        const pr = Math.min(run.ball.r * 0.5, Math.max(0.1, it.h * 0.25));
        for (let k = 0; k < 2 + Math.min(6, e.frac * 7); k++) fx.puffs.spawn(it.x + (Math.random() - 0.5) * pr, it.y + it.h * 0.3, -it.d + (Math.random() - 0.5) * pr, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, pr * (0.5 + Math.random() * 0.5), 0.6, 0.8, 2, 1);
        sound.pickup(e.frac, e.combo);
        if (info.say && (e.frac > 0.25 || Math.random() < 0.5)) sound.say(info.say, 1);
        pop(it, e);
        found[it.key] = (found[it.key] || 0) + 1;
        if (e.frac > 0.45) { view.shake(0.25 + e.frac * 0.4); view.ball.kick(1.5 + e.frac * 3); view.punch(-6 - e.frac * 8); }
        if (e.frac > 0.7) { freezeT = 0.07; flash(0.35); }
        const d = $('dia'); d.classList.add('grow'); setTimeout(() => d.classList.remove('grow'), 120);
        if (it.key === 'moose') remark('moose', 'Did you just eat a moose?');
        else if (it.key === 'yeti') remark('yeti', 'So they ARE real. Were. Were real.');
        else if (/skier|racer|boarder/.test(it.key)) remark('skier', 'Skier down! Skier... in?');
        else if (/chalet|house|cabin|shop/.test(it.key)) remark('house', 'Please stop eating the buildings. ...Fine. Fine.');
        else if (it.key === 'mammoth') remark('mammoth', 'That mammoth was ten thousand years old. It was a protected mammoth.');
        else if (it.key === 'dog') remark('dog', 'That was our rescue dog.');
        break;
      }
      case 'bump': {
        const it = e.it, im = e.impact;
        view.shake(clamp(im / 14, 0.15, 1));
        view.ball.kick(-im * 0.35);
        sound.boing(im);
        it.shake = 1;
        const pr = b.r;
        for (let k = 0; k < 6 + im; k++) fx.puffs.spawn(b.x + (it.x - b.x) * 0.5, b.y, -(b.d + (it.d - b.d) * 0.5), (Math.random() - 0.5) * 5, 1 + Math.random() * 3, (Math.random() - 0.5) * 5, pr * (0.4 + Math.random() * 0.5), 0.8, 0.8, 2, 2);
        for (let k = 0; k < Math.min(10, 2 + im); k++) fx.clumps.spawn(b.x, b.y + b.r * 0.3, -b.d, (Math.random() - 0.5) * 7, 3 + Math.random() * 4, (Math.random() - 0.5) * 7, b.r * (0.08 + Math.random() * 0.12));
        if (e.tree) {   // a tree's whole load of snow comes down on you
          for (let k = 0; k < 26; k++) fx.puffs.spawn(it.x + (Math.random() - 0.5) * it.cr * 3, it.y + it.h * (0.4 + Math.random() * 0.6), -it.d + (Math.random() - 0.5) * it.cr * 3, (Math.random() - 0.5) * 2, -1 - Math.random() * 2, (Math.random() - 0.5) * 2, 0.3 + it.h * 0.08, 1.4, 0.6, 1.2, 4);
          sound.say('rustle');
        }
        if (tut) tut.bumped = true;
        break;
      }
      case 'land': {
        const im = e.impact;
        if (im > 2) {
          view.shake(clamp(im / 16, 0.1, 0.9));
          view.ball.kick(im * 0.35);
          sound.land(im);
          const n = Math.min(26, 6 + im * 1.5);
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2, s = 2 + im * 0.4;
            fx.puffs.spawn(b.x + Math.cos(a) * b.r * 0.8, b.y - b.r * 0.8, -b.d + Math.sin(a) * b.r * 0.8, Math.cos(a) * s, 1 + Math.random() * 2, Math.sin(a) * s, b.r * (0.35 + Math.random() * 0.3), 1.0, 1.2, 2.4, 2);
          }
          for (let k = 0; k < Math.min(14, im); k++) fx.clumps.spawn(b.x, b.y - b.r * 0.5, -b.d, (Math.random() - 0.5) * 8, 3 + Math.random() * 5, (Math.random() - 0.5) * 8, b.r * (0.06 + Math.random() * 0.1));
        }
        if (e.air > 1.2) remark('air', 'Was that a jump? Snowballs don’t jump. Who taught you that?');
        break;
      }
      case 'air': sound.air(); break;
      case 'shed': {
        for (const it of e.items) { view.ball.dropItem(it); found[it.key] = Math.max(0, (found[it.key] || 1) - 1); }
        sound.shed();
        remark('shed', 'You’re shedding kit all over my piste.');
        break;
      }
      case 'panic': {
        const it = e.it, info = ITEMS[it.key];
        if (info.say && Math.hypot(it.x - b.x, it.d - b.d) < 20 + b.r * 6 && Math.random() < 0.5) sound.say(info.say, 0.6);
        break;
      }
      case 'unlock': {
        const info = ITEMS[e.key];
        if (t - lastBanner > 5 || info.need > 1.6 * MOUNTAINS[mi].start * 4) { banner('Big enough for', info.plural); sound.fanfare(1); lastBanner = t; }
        else sound.say('jingle', 0.5);
        nextUp();
        if (/chalet|house|cabin/.test(e.key)) remark('unlockhouse', 'Patrol to all units: it can eat houses now.');
        break;
      }
      case 'fork': forkSign(e.fork); if (!said.has('forktalk')) { said.add('forktalk'); if (!tut && !DEMO && mi < 2) radio('Trail splits up ahead. Lean left or right to pick one.', 0, 0, 3); } break;
      case 'route': $('hudRoute').textContent = e.route.name; if (!C.forks.some(f => f.routes.includes(e.route))) sign(`<div class="board"><div class="n">${e.route.name}</div><div class="h">${routeHint(e.route)}</div></div>`, 2.4); if (e.route.mainSurf === 'ice' && !said.has('ice')) remark('ice', 'Ice! You can’t steer on ice. Nobody can. Brace.'); break;
      case 'rescue': radio(['Patrol here. We’ve dug you out. Try not to do that again.', 'Got you. Back on the piste, and mind the trees this time.', 'Rescue complete. That’s going in the report.'][Math.floor(Math.random() * 3)], 0, 0, 3.4); flash(0.5); sound.say('whoosh'); view.fx.trail.lift(); break;
      case 'nudge': fx.puffs.spawn(b.x, b.y - b.r * 0.7, -b.d, 0, 2, 0, b.r * 0.6, 0.8, 1, 2, 1); break;
      case 'finish': startFinale(); break;
      case 'end': if (fin) fin.stopped = true; break;
    }
  }
  run.events.length = 0;
}
let found = {}, lastBanner = -9;
// under the ruler: the next kind of thing you'll be big enough for
function nextUp() {
  const n = run.unlocks[0];
  $('next').innerHTML = n ? `Next: <b>${ITEMS[n[0]].plural}</b> at ${sizeWords(n[1])}` : 'You can take <b>anything</b>';
}

// snow kicked up as it rolls: more when fast, sideways when turning; a groove left behind
function spray(dt) {
  const fx = view.fx, b = run.ball;
  if (b.ground) {
    const n = b.n, ice = b.surf === 2;
    const gx = b.x - n.nx * b.r * 0.9, gd = b.d - n.nd * b.r * 0.9;
    fx.trail.add(gx, run.C.heightAt(gx, gd) + 0.012 + b.r * 0.025, -gd, n.nx, n.ny, -n.nd, b.hx, -b.hd, b.r * 0.62, ice ? 0.35 : 1);
    const sp = b.speed, rate = (ice ? 6 : 26) * Math.min(1, sp / 8) * (1 + Math.abs(run.input.steer) * 1.4 + run.input.brake * 2);
    const k = Math.floor(rate * dt + Math.random());
    for (let i = 0; i < k; i++) {
      const side = (Math.random() - 0.5) * 2;
      const st = run.input.steer;
      const ox = b.hd * side * b.r * 0.6, oz = b.hx * side * b.r * 0.6;
      const vx = -b.vx * 0.15 - st * b.hd * sp * 0.25 + (Math.random() - 0.5) * 2 + ox * 2, vy = 1.5 + Math.random() * 2.5 + sp * 0.08, vz = -(-b.vd * 0.15 + st * b.hx * sp * 0.25) + (Math.random() - 0.5) * 2;
      fx.puffs.spawn(b.x - n.nx * b.r * 0.8 + ox, b.y - b.r * 0.75, -(b.d - n.nd * b.r * 0.8) - oz, vx, vy, vz, b.r * (0.18 + Math.random() * 0.3) + 0.03, 0.5 + Math.random() * 0.5, 1.6, 2.2, 6);
    }
  } else fx.trail.lift();
}

// wind-blown snow skimming along the ground ahead, in long low wisps
function spindrift(dt) {
  const b = run.ball, fx = view.fx, snow = C.def.snow;
  const k = Math.floor((3 + snow * 10) * dt + Math.random());
  for (let i = 0; i < k; i++) {
    const ahead = 4 + Math.random() * (14 + b.r * 10), side = (Math.random() - 0.5) * (12 + b.r * 10);
    const x = b.x + b.hx * ahead + b.hd * side, d = b.d + b.hd * ahead - b.hx * side;
    const y = C.heightAt(x, d) + 0.05 + Math.random() * 0.2 * (1 + b.r * 0.3);
    const w = 2 + snow * 4;
    fx.puffs.spawn(x, y, -d, w * (0.8 + Math.random() * 0.4), 0.15, -w * 0.3, 0.12 + b.r * 0.08 + Math.random() * 0.15, 1.5 + Math.random(), 0.6, 0.2, 0);
  }
}

// ------------------------------------------------------------------------------------------------- the finale
// Over the line: the camera swings round, and once the ball stops, everything in town smaller than it comes too.
function startFinale() {
  if (fin) return;
  mode = 'finale';
  fin = { t: 0, stopped: false, vac: null, n: 0, done: false, diaAtFinish: run.ball.r * 2 };
  if (tut) { tut = null; save.tutDone = true; store(); }
  slowT = 1.4;
  sound.fanfare(run.medal());
  banner('Finish', sizeWords(run.ball.r * 2));
  radio(null);
}
function finaleTick(dt, t) {
  fin.t += dt;
  const b = run.ball;
  if (!fin.vac && (fin.stopped || fin.t > 9)) {
    // gather the town: everything small enough, nearest first, flying in one after another
    const dia = fin.diaAtFinish;
    const list = [...run.statics, ...run.movers].filter(it => !it.eaten && it.town && (!it.deco || it.need > 6) && it.need <= dia);
    list.sort((a, c) => Math.hypot(a.x - b.x, a.d - b.d) - Math.hypot(c.x - b.x, c.d - b.d));
    const cap = Math.min(list.length, 160);
    fin.vac = list.slice(0, cap);
    fin.extra = list.length - cap;
    fin.vac.forEach((it, k) => {
      it.eaten = true;
      const dist = Math.hypot(it.x - b.x, it.d - b.d);
      const rel = [it.x - b.x, it.y + it.h * 0.4 - b.y, it.d - b.d], L = Math.hypot(...rel) || 1;
      view.ball.attach(it, rel.map(v => v / L), t + 0.3 + k * Math.min(0.05, 3 / cap), 0.5 + Math.min(1.4, dist / 120), false);
      found[it.key] = (found[it.key] || 0) + 1;
    });
    run.townEaten += list.length;
    fin.vacT = 0; fin.vacEnd = 0.3 + cap * Math.min(0.05, 3 / cap) + 1.9;
    if (list.length) { banner('Taking the town', `${list.length} things`); sound.say('crash'); }
  }
  if (fin.vac) {
    fin.vacT += dt;
    // a rumble of pops as they land
    const landed = Math.floor(clamp((fin.vacT - 0.8) / (fin.vacEnd - 1.6), 0, 1) * fin.vac.length);
    while (fin.n < landed) {
      const it = fin.vac[fin.n++];
      if (fin.n % 3 === 0) sound.pickup(0.3, 1 + (fin.n / 3) % 12);
      if (fin.n % 9 === 0) view.shake(0.3);
      if (fin.n % 7 === 0 && ITEMS[it.key].say) sound.say(ITEMS[it.key].say, 0.5);
    }
    if (fin.vacT > fin.vacEnd + 0.6 && !fin.done) { fin.done = true; showReport(); }
  }
}

// ------------------------------------------------------------------------------------------------- the report
let reportNo = 0;
function showReport() {
  mode = 'report';
  sound.music?.stop();
  const m = MOUNTAINS[mi], dia = fin.diaAtFinish, medal = run.medal();
  // how much of the town came too, weighted by size: the houses count for more than the bins
  let tw = 0, te = 0;
  for (const it of C.items) if (it.town && (!it.deco || it.need > 6)) { const w = it.need; tw += w; if (it.eaten) te += w; }
  const town = te / Math.max(1e-6, tw);
  const prev = save.best[m.id];
  const isBest = !prev || dia > prev.dia;
  save.best[m.id] = { dia: Math.max(dia, prev?.dia || 0), town: Math.max(town, prev?.town || 0), medal: Math.max(medal, prev?.medal || 0) };
  for (const k in found) save.found[k] = (save.found[k] || 0) + found[k];
  found = {};
  store();
  $('hud').hidden = true;
  $('report').hidden = false;
  reportNo = (reportNo + 1) % 10000;
  $('rno').textContent = 'No. ' + String(1000 + Math.floor(Math.random() * 8999));
  $('rwhere').textContent = `Ski Patrol · ${m.name} · ${GRADE[m.grade]}`;
  const counts = Object.entries(run.count).filter(e => e[1] > 0);
  counts.sort((a, b) => b[1] * ITEMS[b[0]].need - a[1] * ITEMS[a[0]].need);
  const routes = run.routesTaken.map(r => r.name);
  const mins = Math.floor(run.t / 60), secs = Math.round(run.t % 60);
  const lines = [];
  lines.push(['Suspect', `Snowball. Last seen ${sizeWords(dia)} across, still rolling.`]);
  lines.push(['Route', routes.join(' → ') || C.routes[0].name]);
  lines.push(['Time', `${mins}:${String(secs).padStart(2, '0')} from top to bottom, ${Math.round(run.topSpeed * 3.6)} km/h at its fastest`]);
  lines.push(['Missing', `${run.eatenN + (fin.vac ? fin.vac.length + fin.extra : 0)} things, including:`]);
  const list = counts.slice(0, 9).map(([k, n]) => { const it = ITEMS[k]; return `${n} × ${n === 1 ? it.name : it.plural} <em>(${it.lines[Math.floor(Math.random() * it.lines.length)]})</em>`; });
  if (counts.length > 9) list.push(`…and ${counts.slice(9).reduce((a, e) => a + e[1], 0)} other things`);
  const body = $('rbody');
  body.innerHTML = lines.map(([a, b]) => `<div class="field"><span>${a}</span><span data-t="${b.replace(/"/g, '&quot;')}"></span></div>`).join('')
    + `<ul class="list">${list.map(l => `<li data-t="${l.replace(/"/g, '&quot;')}"></li>`).join('')}</ul>`
    + `<div class="field"><span>${C.def.town.name}</span><span class="townbar"><span class="bar"><i id="rtown"></i></span><b class="type">${Math.round(town * 100)}% taken</b></span></div>`;
  // type it out, line by line
  const els = [...body.querySelectorAll('[data-t]')];
  let k = 0;
  const stamp = $('rstamp');
  stamp.className = 'stamp'; $('rnew').className = 'newbest';
  const typeNext = () => {
    if (mode !== 'report') return;
    if (k >= els.length) {
      $('rtown').style.width = Math.round(town * 100) + '%';
      setTimeout(() => {
        const c = ['n', 'b', 's', 'g'][medal];
        stamp.innerHTML = medal ? `${['', 'Bronze', 'Silver', 'Gold'][medal]}<small>${sizeWords(dia)} · approved</small>` : `Undersized<small>needs ${sizeWords(m.medals[0])}</small>`;
        stamp.className = 'stamp on ' + c;
        sound.stamp(); flash(0.25);
        document.querySelector('.form').animate([{ transform: 'rotate(.6deg) translate(0,0)' }, { transform: 'rotate(.6deg) translate(4px,6px)' }, { transform: 'rotate(.6deg) translate(0,0)' }], { duration: 180 });
        if (isBest && prev) setTimeout(() => $('rnew').classList.add('on'), 400);
      }, 450);
      return;
    }
    const el = els[k++];
    el.innerHTML = el.dataset.t;
    el.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 260, easing: 'steps(14)' });
    sound.type();
    setTimeout(typeNext, 170);
  };
  setTimeout(typeNext, 500);
  const next = mi + 1 < MOUNTAINS.length && unlocked(mi + 1);
  $('rnext').hidden = !next;
  $('rnext').textContent = next ? `Next: ${MOUNTAINS[mi + 1].name}` : '';
}
$('ragain').onclick = () => wipe(() => startRun(mi));
$('rnext').onclick = () => wipe(() => startRun(mi + 1));
$('rmap').onclick = () => wipe(() => { sel = mi; showMap(); });
// tap the report to finish typing it at once
$('form').addEventListener('click', e => { if (e.target.closest('button')) return; document.querySelectorAll('#rbody [data-t]').forEach(el => { el.innerHTML = el.dataset.t; }); });

// ------------------------------------------------------------------------------------------------- pause and settings
function togglePause(force) {
  if (mode !== 'play' && mode !== 'finale') return;
  paused = force ?? !paused;
  $('pause').hidden = !paused;
  ptr.id = null; keys.clear(); stick.classList.remove('on');
  syncSegs();
}
$('bpause').onclick = () => togglePause(true);
$('presume').onclick = () => togglePause(false);
$('prestart').onclick = () => { togglePause(false); wipe(() => startRun(mi, { tutorial: false })); };
$('pmap').onclick = () => { paused = false; $('pause').hidden = true; wipe(() => showMap()); };
function syncSegs() {
  for (const b of $('psteer').children) b.setAttribute('aria-pressed', String(b.dataset.v === save.steer));
  for (const b of $('psound').children) b.setAttribute('aria-pressed', String(b.dataset.v === save.sound));
  for (const id of ['tsound', 'msound']) {
    const el = $(id);
    el.innerHTML = save.sound === 'off' ? '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#14234a"/><path d="M16 9l5 6M21 9l-5 6" stroke="#14234a" stroke-width="2.5" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#14234a"/><path d="M16 8.5c1.6 1.8 1.6 5.2 0 7M18.5 6c3 3.2 3 8.8 0 12" fill="none" stroke="#14234a" stroke-width="2.2" stroke-linecap="round"/></svg>';
    el.setAttribute('aria-label', save.sound === 'off' ? 'Sound off' : 'Sound on');
  }
}
$('psteer').onclick = async e => {
  const v = e.target.closest('button')?.dataset.v;
  if (!v) return;
  if (v === 'tilt' && !(await enableTilt())) return;
  save.steer = v; store(); syncSegs();
};
$('psound').onclick = e => { const v = e.target.closest('button')?.dataset.v; if (!v) return; setSound(v); };
function setSound(v) {
  save.sound = v; store(); sound.start(); sound.setMode(v !== 'off', v === 'all'); syncSegs();
  if (v === 'all' && (mode === 'play') && sound.ctx && !sound.music.on) sound.music.start(mi * 7 + 3);
}
for (const id of ['tsound', 'msound']) $(id).onclick = () => setSound(save.sound === 'off' ? 'all' : 'off');
syncSegs();

// ------------------------------------------------------------------------------------------------- Lost & Found
const SIZE_LO = Math.log(0.1), SIZE_HI = Math.log(60);
const sliderDia = v => Math.exp(SIZE_LO + (SIZE_HI - SIZE_LO) * v / 1000);
let thumbs = null;
function makeThumbs() {
  if (thumbs) return thumbs;
  thumbs = {};
  for (const k of Object.keys(ITEMS)) thumbs[k] = view.thumb(k, TOUCH ? 128 : 160);
  return thumbs;
}
function showGuide() {
  sound.click();
  const T = makeThumbs();
  const keys = Object.keys(ITEMS).sort((a, b) => ITEMS[a].need - ITEMS[b].need);
  const seen = keys.filter(k => save.found[k] > 0).length;
  $('gcount').textContent = `${seen} of ${keys.length} things found · ${Object.values(save.found).reduce((a, b) => a + b, 0)} picked up in all`;
  const grid = $('ggrid');
  grid.innerHTML = '';
  for (const k of keys) {
    const it = ITEMS[k], n = save.found[k] || 0;
    const el = document.createElement('div');
    el.className = 'thing' + (n ? '' : ' unseen');
    el.dataset.need = it.need;
    el.innerHTML = `<b>${n ? it.name : '???'}</b><span>needs ${sizeWords(it.need)}</span>${n ? `<span class="n">${n}</span>` : ''}`;
    const c = T[k].cloneNode(); c.getContext('2d').drawImage(T[k], 0, 0);
    const pic = document.createElement('div'); pic.className = 'pic'; pic.appendChild(c);
    el.prepend(pic);
    el.title = n ? `${it.name}: ${it.lines.join(', ')}` : 'Not found yet';
    el.tabIndex = 0;
    el.onclick = () => detail(k);
    el.onkeydown = e => { if (e.key === 'Enter') detail(k); };
    grid.appendChild(el);
  }
  $('guide').hidden = false;
  guideSlide();
}
// one thing up close, on a turntable you can spin by dragging
function detail(k) {
  sound.click();
  const it = ITEMS[k], n = save.found[k] || 0;
  const wrap = document.createElement('div');
  wrap.className = 'detail';
  wrap.innerHTML = `<div class="card"><canvas width="440" height="440"></canvas><div class="hint">${n ? 'Drag to turn it round' : 'Not found yet'}</div>
    <h2>${n ? it.name : '???'}</h2>
    <div class="stat"><span>Needs <b>${sizeWords(it.need)}</b></span><span>Picked up <b>${n}</b></span></div>
    ${n ? `<ul>${it.lines.map(l => `<li>“${l}”</li>`).join('')}</ul>` : '<ul><li>Somewhere on the mountain. Get big enough, then go and find it.</li></ul>'}
    <button class="btn">Put it back</button></div>`;
  document.body.appendChild(wrap);
  const cv = wrap.querySelector('canvas'), g = cv.getContext('2d');
  const frames = Array.from({ length: 24 }, (_, i) => view.thumb(k, 220, i / 24 * Math.PI * 2));
  let a = 0, v = 0.6, drag = null;
  const draw = () => {
    const f = frames[((Math.round(a / (Math.PI * 2) * 24) % 24) + 24) % 24];
    g.clearRect(0, 0, 440, 440);
    if (!n) g.filter = 'brightness(0) opacity(.3)';
    g.drawImage(f, 0, 0, 440, 440);
    g.filter = 'none';
  };
  let last = performance.now();
  const spin = now => {
    if (!wrap.isConnected) return;
    requestAnimationFrame(spin);
    const dt = (now - last) / 1000; last = now;
    if (!drag) { a += v * dt; v += (0.6 - v) * dt; }
    draw();
  };
  requestAnimationFrame(spin);
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, a }; });
  cv.addEventListener('pointermove', e => { if (!drag) return; const na = drag.a + (e.clientX - drag.x) * 0.02; v = (na - a) * 30; a = na; });
  cv.addEventListener('pointerup', () => { drag = null; });
  const close = () => { wrap.remove(); sound.click(); };
  wrap.querySelector('button').onclick = close;
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
}
function guideSlide() {
  const dia = sliderDia(+$('grange').value);
  $('gsize').textContent = sizeWords(dia);
  let can = [], next = null;
  for (const el of $('ggrid').children) {
    const ok = +el.dataset.need <= dia;
    el.classList.toggle('too', !ok); el.classList.toggle('can', ok);
  }
  const keys = Object.keys(ITEMS).sort((a, b) => ITEMS[a].need - ITEMS[b].need);
  can = keys.filter(k => ITEMS[k].need <= dia);
  next = keys.find(k => ITEMS[k].need > dia);
  const top = can.slice(-3).reverse().map(k => ITEMS[k].plural);
  $('geats').textContent = (can.length ? `${can.length} kinds of thing, up to ${top.join(', ')}.` : 'Nothing yet. Not even a pinecone.') + (next ? ` Next: ${ITEMS[next].plural} at ${sizeWords(ITEMS[next].need)}.` : ' Everything. Even the castle.');
}
$('grange').addEventListener('input', guideSlide);
$('bguide').onclick = showGuide;
$('gclose').onclick = () => { $('guide').hidden = true; sound.click(); };

// ------------------------------------------------------------------------------------------------- Ski School
function showSchool() {
  sound.click();
  const L = $('lessons');
  L.innerHTML = `
    <div class="lesson"><h3><i>1</i>Steer, and eat what’s smaller</h3><p>${TOUCH ? 'Drag left and right anywhere on the screen.' : '<kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>D</kbd>, or drag with the mouse.'} Try it here: roll over the dots smaller than you, dodge the big ones.</p><canvas id="mini1" width="600" height="240"></canvas></div>
    <div class="lesson"><h3><i>2</i>Bigger is faster</h3><p>A bigger snowball rolls faster and turns wider, so plan your line early. ${TOUCH ? 'Drag down' : 'Hold <kbd>↓</kbd>'} to dig in and slow down; ${TOUCH ? 'drag up' : '<kbd>↑</kbd>'} to tuck.</p><canvas id="mini2" width="600" height="240"></canvas></div>
    <div class="lesson"><h3><i>3</i>Know your snow</h3><p>Tap each one.</p><div class="seg" id="snowkinds" style="margin-top:8px"><button data-k="0" aria-pressed="true">Powder</button><button data-k="1">Piste</button><button data-k="2">Ice</button></div><p id="snowsay" style="margin-top:8px"></p></div>
    <div class="lesson"><h3><i>4</i>Mind the big stuff</h3><p>Hit something too big and you bounce off it, and the last few things you picked up can fly off. Trees drop their snow on you, which helps a bit.</p></div>
    <div class="lesson"><h3><i>5</i>Pick a trail</h3><p>Every mountain splits into routes and meets up again: woods full of little things, busy pistes, jumps, ice. The signs at each fork say what’s down there.</p></div>
    <div class="lesson"><h3><i>6</i>Take the town</h3><p>Each run ends in a town. Cross the line and everything in town that’s smaller than you comes too. Bronze opens the next lift.</p><button class="btn small go" id="replaytut" style="margin-top:10px">Ride Bunny Hill with the radio on</button></div>`;
  $('school').hidden = false;
  const kinds = ['Powder: soft and slow, but it packs on the most snow.', 'Piste: groomed and fast. Packs on a little snow.', 'Ice: very fast, and you can’t steer at all. Pick your line before you’re on it.'];
  const say = k => { $('snowsay').textContent = kinds[k]; for (const b of $('snowkinds').children) b.setAttribute('aria-pressed', String(+b.dataset.k === k)); };
  say(0);
  $('snowkinds').onclick = e => { const b = e.target.closest('button'); if (b) { say(+b.dataset.k); sound.click(); } };
  $('replaytut').onclick = () => { $('school').hidden = true; wipe(() => startRun(0, { tutorial: true })); };
  schoolGame($('mini1'), false);
  schoolGame($('mini2'), true);
}
// a tiny top-down slope: steer the ball, eat the dots smaller than it, bounce off the rest
function schoolGame(cv, speedy) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  let x = W / 2, r = 13, vx = 0, scroll = 0, ptrX = null;
  const dots = [];
  const spawn = y => dots.push({ x: 20 + Math.random() * (W - 40), y, r: 4 + Math.random() * (speedy ? 30 : 22) });
  for (let y = 0; y < H * 2; y += 22) spawn(-y);
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrX = e.offsetX * (W / cv.clientWidth); });
  cv.addEventListener('pointermove', e => { if (ptrX !== null) ptrX = e.offsetX * (W / cv.clientWidth); });
  cv.addEventListener('pointerup', () => { ptrX = null; });
  let last = performance.now();
  const loop = now => {
    if ($('school').hidden || !cv.isConnected) return;
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const k = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    const want = ptrX !== null ? clamp((ptrX - x) / 40, -1, 1) : k;
    const turn = speedy ? 900 / (1 + r * 0.08) : 900;
    vx += want * turn * dt; vx *= 1 - dt * 3;
    x = clamp(x + vx * dt, r, W - r);
    const spd = speedy ? 60 + r * 5 : 70;
    scroll += spd * dt;
    g.fillStyle = '#eef5fc'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(39,102,201,.15)'; g.lineWidth = 2;
    for (let yy = (scroll % 30) - 30; yy < H; yy += 30) { g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy + 10); g.stroke(); }
    for (const d of dots) {
      d.y += spd * dt;
      const dx = d.x - x, dy = d.y - H * 0.7;
      if (Math.hypot(dx, dy) < r + d.r) {
        if (d.r < r) { r = Math.cbrt(r ** 3 + d.r ** 3 * 0.5); d.y = 9999; sound.pickup(d.r / r, 1); }
        else if (!d.hit) { d.hit = true; vx = -Math.sign(dx || 1) * 260; sound.boing(3); r = Math.max(13, r * 0.92); }
      }
      g.beginPath(); g.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      g.fillStyle = d.r < r ? '#2f9a4a' : '#e0402c'; g.fill();
    }
    for (let i = dots.length - 1; i >= 0; i--) if (dots[i].y > H + 40) { dots.splice(i, 1); spawn(-40 - Math.random() * 40); }
    if (r > 80) r = 13;
    g.beginPath(); g.arc(x, H * 0.7, r, 0, Math.PI * 2);
    g.fillStyle = '#fff'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#14234a'; g.stroke();
    g.fillStyle = '#14234a'; g.font = '800 22px "Big Shoulders Display"'; g.fillText(`${Math.round(r * 4)} cm`, 12, 28);
  };
  requestAnimationFrame(loop);
}
$('bschool').onclick = showSchool;
$('sclose').onclick = () => { $('school').hidden = true; sound.click(); };

// ------------------------------------------------------------------------------------------------- the loop
let last = performance.now(), first = true, lastDia = 0, acc = 0;
const DT = 1 / 120;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000;
  if (raw < 0.25 && !document.hidden && !DEMO) view.adapt(raw);
  tick(Math.min(0.1, raw), now / 1000);
  last = now;
}
function tick(dt, t) {
  if (!run) return;
  const playing = (mode === 'play' || mode === 'finale') && !paused && !hold;
  if (mode === 'title' && pushing) { pushT += dt; $('pushfill').style.width = clamp(pushT / 0.9, 0, 1) * 100 + '%'; view.ball.kick(Math.sin(t * 40) * 0.3); }
  if (mode === 'leaving' || (mode === 'title' && run.ball.vd > 2)) { for (let i = 0; i < 4; i++) run.step(dt / 4); run.events.length = 0; }
  if (playing) {
    if (bot) bot(run, dt); else readInput(dt);
    if (mode === 'finale') { run.input.steer *= 0.9; run.input.brake = fin.t > 2 ? 1 : 0; }
    // slow motion on big air, and over the line
    const b = run.ball;
    if (mode === 'play' && !b.ground && b.air > 0.35 && b.vy < 0 && b.y - run.C.heightAt(b.x, b.d) > b.r * 3 + 5 && slowT <= 0) slowT = 1.1;
    if (slowT > 0) slowT -= dt;
    timeScale = lerp(timeScale, slowT > 0 ? 0.4 : 1, 1 - Math.exp(-dt * 8));
    if (freezeT > 0) freezeT -= dt;
    else {
      acc += dt * timeScale * SPEED;
      let n = 0;
      while (acc >= DT && n < 40) { run.step(DT); acc -= DT; n++; }
      run.topSpeed = Math.max(run.topSpeed || 0, run.ball.speed);
    }
    events(t);
    spray(dt * timeScale);
    spindrift(dt * timeScale);
    if (tut) { tut.t += dt; if (LESSONS[tut.step]?.done(tut)) nextLesson(); }
    if (mode === 'finale') finaleTick(dt, t);
    hud(dt);
    if (!DEMO) bubbles(dt);
    if (sound.ctx) sound.music.set(Math.min(5, Math.floor(Math.log2(run.ball.r * 2 / MOUNTAINS[mi].start) * 1.4)), run.ball.speed);
  }
  if (radioT > 0 && (radioT -= dt) <= 0 && !tut) radio(null);
  if (signT > 0 && (signT -= dt) <= 0) $('sign').classList.remove('on');
  sound.roll(dt, { speed: run.ball.speed, r: run.ball.r, ground: run.ball.ground, surf: run.ball.surf, playing });
  const camMode = mode === 'title' && run.ball.vd < 2 ? 'orbit' : mode === 'finale' && fin && fin.t > 0.8 ? 'finale' : mode === 'report' ? 'finale' : 'play';
  // the trail map and its pages cover the screen: no need to draw the mountain behind them
  if (mode === 'map' && !first) return;
  const frozen = paused && (mode === 'play' || mode === 'finale');
  view.frame(playing ? dt * timeScale : frozen ? 0 : dt, t, run, camMode, frozen ? 0 : dt);
  if (first) { first = false; window.toyboxReady?.(); }
}
// now and then something stuck in the ball has something to say
let bubbleT = 4, bubbleOn = 0;
function bubbles(dt) {
  const el = $('bubble');
  if (bubbleOn > 0) {
    bubbleOn -= dt;
    const b = run.ball, p = view.project(b.x, b.y + b.r * 1.25, b.d);
    const right = el.classList.contains('r');
    el.style.transform = `translate(${p.x + (right ? -el.offsetWidth - 10 : 10) + b.r * 2}px, ${p.y - el.offsetHeight - 14}px)`;
    if (bubbleOn <= 0) el.hidden = true;
    return;
  }
  if ((bubbleT -= dt) > 0) return;
  bubbleT = 3.5 + Math.random() * 4.5;
  const talkers = view.ball.recs.filter(r => r.out > 0 && QUIPS[r.key] && performance.now() / 1000 - r.t0 > 0.6);
  if (!talkers.length || mode !== 'play') return;
  const r = talkers[Math.floor(Math.random() * talkers.length)], q = QUIPS[r.key];
  el.textContent = q[Math.floor(Math.random() * q.length)];
  el.classList.toggle('r', Math.random() < 0.5);
  el.hidden = false; bubbleOn = 1.9;
  el.animate([{ opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1.05, offset: 0.12 }, { opacity: 1, scale: 1, offset: 0.2 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 1900 });
  const say = ITEMS[r.key].say;
  if (say) sound.say(say, 0.35);
}
function hud() {
  const b = run.ball, dia = b.r * 2;
  if (Math.abs(dia - lastDia) > lastDia * 0.004) {
    lastDia = dia;
    const w = sizeWords(dia).split(' ');
    $('dia').innerHTML = `${w[0]}<small>${w[1]}</small>`;
    const p = rulerPos(dia) * 100;
    $('ryou').style.left = p + '%'; $('rfill').style.width = p + '%';
  }
  $('speedo').firstElementChild.textContent = Math.round(b.speed * 3.6);
  drawMiniFrame();
}

// ------------------------------------------------------------------------------------------------- go
if (DEMO) {
  // the preview: halfway down Gondola Peak, already big and lumpy with skiers, on a busy piste
  const i = 2;
  loadMountain(i);
  startRun(i, { keep: true });
  const b = run.ball;
  b.d = 470; b.x = -33; b.r = 1.25; b.vd = 12; b.vx = -0.4; b.hx = -0.03; b.hd = 1;
  run.unlocks = run.unlocks.filter(u => u[1] > b.r * 2);
  run.routeSeen.add('main'); run.routeSeen.add('top');
  $('hudRoute').textContent = 'Main Piste';
  b.y = run.support(b.x, b.d, b.r).y;
  const kinds = ['skier', 'skier', 'boarder', 'kid', 'skis', 'snowboard', 'fence', 'marker', 'skier', 'deckchair', 'goggles', 'cone', 'pistepole', 'racer', 'boarder', 'kid', 'skier', 'snowman_s', 'gondola'];
  for (let k = 0; k < 34; k++) {
    const key = kinds[k % kinds.length], info = ITEMS[key];
    const a = Math.random() * Math.PI * 2, z = Math.random() * 2 - 1, s = Math.sqrt(1 - z * z);
    const fake = { key, h: info.h, scale: key === 'gondola' ? 0.6 : 1, need: info.need, tint: info.tint ? ['#e8412f', '#2f74d0', '#f2b134', '#1fa28f', '#ef6fa0', '#7a4fc0'][k % 6] : null, x: 0, y: 0, d: 0, yaw: 0 };
    view.ball.r = b.r * (0.75 + k / 34 * 0.25);
    view.ball.attach(fake, [Math.cos(a) * s, z, Math.sin(a) * s], -10);
  }
  view.ball.setRadius(b.r);
  for (let k = 0; k < 150; k++) { bot(run, 1 / 60); run.step(1 / 60); }
  run.events.length = 0;
  view.camState.pos.set(b.x - 2, b.y + 6, -(b.d - 12));
  $('hud').hidden = false;
} else if (Q.get('mountain')) {
  const i = Math.max(0, MOUNTAINS.findIndex(m => m.id === Q.get('mountain')));
  startRun(i);
} else showTitle();
requestAnimationFrame(frame);

if (DEBUG || AUTO || Q.has('hold')) {
  window.game = {
    get run() { return run; }, view, sound, MOUNTAINS,
    hold(v = true) { hold = v; },
    // step the game by hand (for a hidden browser pane): ms of game time, rendered at the end
    ff(ms, render = true) { const was = hold; hold = false; const n = Math.ceil(ms / 50); for (let i = 0; i < n; i++) tick(0.05, performance.now() / 1000 + i * 0.05); hold = was; if (render) view.frame(0.016, performance.now() / 1000, run, mode === 'finale' || mode === 'report' ? 'finale' : 'play'); },
    start(i, o) { startRun(i, o); }, map: showMap, title: showTitle, guide: showGuide, school: showSchool,
    get mode() { return mode; }, get fin() { return fin; }, get paused() { return paused; },
    get save() { return save; }, setSave(o) { save = Object.assign({ best: {}, found: {}, steer: 'drag', sound: 'all' }, o); store(); },
  };
}
