import { Game, Bot, NIGHTS, OBJECTS, ACTS, ROOMS, floorY, COMBO_WIN, ECTO_MAX } from './game.js';
import { Painter, portrait } from './art.js';
import { Sound } from './sound.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug') || Q.has('hold'), HOLD = Q.has('hold');
const SPEED = +(Q.get('speed') || 1);
const $ = (id) => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const painter = new Painter();
const sound = new Sound();
const KEY = 'poltergeist.v1';
const save = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
save.won ??= {}; save.todo ??= {};
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} };
sound.setOn(save.sound !== false);

let g = null, bot = null;
let mode = 'title';          // title | intro | play | pause | end
let nightIx = 1;
let time = 0;
let hover = null, ring = null, kbSel = null;
let floaters = [];
let lit = [0, 0, 0, 0, 0, 0];
let tut = null;
let V = { s: 1, ox: 0, oy: 0, dpr: 1, w: 0, h: 0, top: 0 };

// ---------------------------------------------------------------- layout
const WORLD = { x0: -34, y0: -150, x1: 918, y1: 884 };
function layout() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth, h = window.innerHeight;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const playing = mode !== 'title';
  const side = w / h > 1.22 && w >= 640;
  document.body.classList.toggle('side', side);
  const hudB = playing ? $('hud').getBoundingClientRect().bottom : 0;
  let ax = 6, ay = playing ? Math.max(54, hudB + 2) : 8, aw = w - 12, ah = h - ay - 8;
  if (playing) {
    if (side) aw = w - 200;
    else ah = h - ay - (($('family').offsetHeight || 66) + 12);
  }
  const cw = WORLD.x1 - WORLD.x0, ch = WORLD.y1 - WORLD.y0;
  AV = { ax, ay, aw, ah, s0: Math.min(aw / cw, ah / ch), dpr, w: cv.width, h: cv.height };
  if (!playing) cam.z = 1;
  applyCam();
}
// the camera: zoom 1 shows the whole house; zoomed in, you can pan about
let AV = null;
const cam = { z: 1, cx: (WORLD.x0 + WORLD.x1) / 2, cy: (WORLD.y0 + WORLD.y1) / 2 };
function applyCam() {
  const { ax, ay, aw, ah, s0, dpr, w, h } = AV;
  cam.z = Math.max(1, Math.min(3.2, cam.z));
  const s = s0 * cam.z;
  let ox = ax + aw / 2 - cam.cx * s, oy = ay + ah / 2 - cam.cy * s;
  const fit = (o, a0, alen, w0, w1) => (w1 - w0) * s <= alen ? a0 + (alen - (w1 - w0) * s) / 2 - w0 * s : Math.min(a0 - w0 * s, Math.max(a0 + alen - w1 * s, o));
  ox = fit(ox, ax, aw, WORLD.x0, WORLD.x1); oy = fit(oy, ay, ah, WORLD.y0, WORLD.y1);
  cam.cx = (ax + aw / 2 - ox) / s; cam.cy = (ay + ah / 2 - oy) / s;
  V = { s, ox, oy, dpr, w, h, top: ay };
}
// zoom about a screen point, keeping the world under it still
function zoomAt(sx, sy, z) {
  const [wx, wy] = toWorld(sx, sy);
  cam.z = Math.max(1, Math.min(3.2, z));
  const s = AV.s0 * cam.z;
  cam.cx = wx + (AV.ax + AV.aw / 2 - sx) / s; cam.cy = wy + (AV.ay + AV.ah / 2 - sy) / s;
  applyCam();
}
window.addEventListener('resize', layout);

const toScreen = (wx, wy) => [V.ox + wx * V.s, V.oy + wy * V.s];
const toWorld = (sx, sy) => [(sx - V.ox) / V.s, (sy - V.oy) / V.s];
const objY = (o) => floorY(o.f) - o.hy + 10;

// ---------------------------------------------------------------- drawing
function render() {
  painter.begin({ k: V.s * V.dpr, ox: V.ox * V.dpr, oy: V.oy * V.dpr, w: V.w, h: V.h });
  // rooms are lit while someone awake is in them (and flicker with a haunted lamp)
  for (let r = 0; r < 6; r++) {
    let want = g.people.some((p) => !p.gone && !p.asleep && p.role !== 'dog' && g.room(p) === r) ? 1 : 0;
    const lamp = g.objects.find((o) => o.room === r && o.kind === 'lamp' && o.anim > 0);
    if (lamp) want = Math.sin(time * 37) > 0.1 ? want : 0;
    lit[r] += (want - lit[r]) * (lamp ? 1 : 0.08);
  }
  painter.house(g, time, lit);
  painter.objects(g, time);
  for (const p of g.people) painter.gaze(g, p, time);
  for (const p of g.people) painter.person(g, p, time);
  painter.ghost(g, time);
  if (mode === 'play' || mode === 'pause' || DEMO) painter.marks(g, time, hover, ring);
  painter.overlays(g, V, toScreen, time);
  drawFloaters();
  painter.end(ctx);
}

function drawFloaters() {
  const { b, p } = painter;
  floaters = floaters.filter((f) => (f.t = time - f.t0) < f.life);
  for (const f of floaters) {
    const [sx, sy] = toScreen(f.x, f.y);
    const k = f.t / f.life, rise = k * 34, a = k > 0.7 ? (1 - k) / 0.3 : 1;
    const font = `${f.big ? 24 : 18}px Caprasimo, Georgia, serif`;
    // a paper outline knocked out of every ink, then the words in pink (or blue for a shrug)
    painter.knock((c) => { c.globalAlpha = a; c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 6; c.lineJoin = 'round'; c.strokeText(f.text, sx, sy - rise); c.fillText(f.text, sx, sy - rise); });
    const L = f.blue ? b : p;
    L.globalAlpha = a; L.font = font; L.textAlign = 'center'; L.textBaseline = 'middle';
    L.fillStyle = f.blue ? painter.B.color : painter.P.color; L.fillText(f.text, sx, sy - rise);
    L.globalAlpha = 1; L.textAlign = 'left';
  }
}
function floater(x, y, text, opts = {}) { floaters.push({ x, y, text, t: 0, t0: time, life: opts.life ?? 1.3, big: opts.big, blue: opts.blue }); }

// ---------------------------------------------------------------- input
function pick(sx, sy, touch) {
  const [wx, wy] = toWorld(sx, sy);
  const rad = Math.max(touch ? 70 : 56, (touch ? 30 : 20) / V.s);
  let best = null, bd = 1e9;
  for (const o of g.objects) {
    const dx = (o.x - wx), dy = (objY(o) - wy) * 0.8;
    const d = Math.hypot(dx, dy);
    if (d < rad && d < bd) { bd = d; best = o; }
  }
  return best;
}
// one finger taps (or drags, when zoomed in); two fingers pinch; the wheel zooms too
const ptrs = new Map();
let drag = null, pinch = null;
cv.addEventListener('pointerdown', (e) => {
  sound.init();
  if (mode !== 'play') return;
  cv.setPointerCapture?.(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, cx: cam.cx, cy: cam.cy, moved: false, touch: e.pointerType !== 'mouse' };
  else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: cam.z }; drag = null;
  }
});
cv.addEventListener('pointermove', (e) => {
  if (mode !== 'play') return;
  const pt = ptrs.get(e.pointerId);
  if (pt) { pt.x = e.clientX; pt.y = e.clientY; }
  if (pinch && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()];
    zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0);
    return;
  }
  if (drag && drag.id === e.pointerId) {
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (Math.hypot(dx, dy) > (drag.touch ? 12 : 6)) drag.moved = true;
    if (drag.moved && cam.z > 1.01) { cam.cx = drag.cx - dx / V.s; cam.cy = drag.cy - dy / V.s; applyCam(); }
    return;
  }
  if (e.pointerType === 'mouse') { hover = pick(e.clientX, e.clientY, false); kbSel = null; cv.classList.toggle('point', !!hover); }
});
const lift = (e) => {
  const was = ptrs.has(e.pointerId);
  ptrs.delete(e.pointerId);
  if (!was) return;
  if (drag && drag.id === e.pointerId && !drag.moved && e.type === 'pointerup' && mode === 'play') {
    const o = pick(e.clientX, e.clientY, drag.touch);
    if (o) doHaunt(o);
  }
  if (ptrs.size < 2) pinch = null;
  if (ptrs.size === 0) drag = null;
};
cv.addEventListener('pointerup', lift);
cv.addEventListener('pointercancel', lift);
cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hover = null; });
cv.addEventListener('wheel', (e) => { if (mode !== 'play') return; e.preventDefault(); zoomAt(e.clientX, e.clientY, cam.z * Math.exp(-e.deltaY * 0.0016)); }, { passive: false });
window.addEventListener('keydown', (e) => {
  sound.init();
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (mode === 'play') pauseGame(); else if (mode === 'pause') resume(); return; }
  if (e.key === 'm' || e.key === 'M') { toggleSound(); return; }
  if (e.key === '0' || e.key === 'z' || e.key === 'Z') { cam.z = 1; applyCam(); return; }
  if (mode !== 'play') return;
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  if (arrows[e.key]) {
    e.preventDefault();
    const [dx, df] = arrows[e.key];
    const cur = kbSel || hover || g.objects[0];
    let best = null, bd = 1e9;
    for (const o of g.objects) {
      if (o === cur) continue;
      if (df) { if (o.f !== cur.f + df) continue; const d = Math.abs(o.x - cur.x); if (d < bd) { bd = d; best = o; } }
      else { if (o.f !== cur.f || Math.sign(o.x - cur.x) !== dx) continue; const d = Math.abs(o.x - cur.x); if (d < bd) { bd = d; best = o; } }
    }
    kbSel = best || cur; hover = kbSel;
  } else if ((e.key === 'Enter' || e.key === ' ') && (kbSel || hover)) { e.preventDefault(); doHaunt(kbSel || hover); }
});

function doHaunt(o) {
  const res = g.haunt(o);
  if (tut) tutOnHaunt(o, res);
}

// ---------------------------------------------------------------- events from the game
const PITCH = { hobb: 0.8, ruth: 1.35, gordon: 0.85, dee: 1.4, ron: 0.7, kit: 1.15, ada: 1.3, femi: 0.9, bea: 2, dog: 1 };
function handleEvents() {
  for (const e of g.events) {
    switch (e.type) {
      case 'haunt': {
        sound.trick(e.o.kind);
        if (e.chain >= 2) { sound.combo(e.chain); combo(e.chain, e.mult); }
        let yelped = false;
        for (const h of e.hits) {
          if (h.gain < 0.5) continue;
          floater(h.p.x + 46, painter.eyeY(h.p) - 8, '+' + Math.round(h.gain), { big: h.gain > 15 });
          if (h.near && !yelped && h.gain > 4) { setTimeout(() => sound.yelp(PITCH[h.p.look] || 1, h.gain > 14), 120); yelped = true; }
        }
        if (!e.hits.length) floater(e.o.x, objY(e.o) - 40, 'nobody heard', { blue: true, life: 1.1 });
        break;
      }
      case 'spotted': sound.spotted(); floater(e.o.x, objY(e.o) - 40, 'seen!', { blue: true }); break;
      case 'cooling': sound.denied(); floater(e.o.x, objY(e.o) - 40, 'still settling', { blue: true, life: 0.9 }); break;
      case 'tired': sound.denied(); floater(e.o.x, objY(e.o) - 40, 'out of ectoplasm', { blue: true, life: 1 }); flashEcto(); break;
      case 'bark': sound.bark(); break;
      case 'giggle': sound.giggle(); break;
      case 'flee': sound.yelp(PITCH[e.p.look] || 1, true); if (e.p.resident) banner(`${e.p.name} is off!`); break;
      case 'door': sound.door(); break;
      case 'won': setTimeout(() => endNight(true), 900); break;
      case 'lost': setTimeout(() => endNight(false), 600); break;
    }
  }
  g.events.length = 0;
}
let comboT = 0;
function combo(n, mult) { const el = $('combo'); el.textContent = `Combo ×${mult}`; el.classList.add('on'); comboT = COMBO_WIN; }
function banner(text) { const el = $('banner'); el.innerHTML = ''; const b = document.createElement('b'); b.textContent = text; el.appendChild(b); }
function flashEcto() { const el = $('ecto'); el.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 240 }); }

// ---------------------------------------------------------------- HUD
let famEls = [];
function buildFamily() {
  const box = $('family'); box.innerHTML = ''; famEls = [];
  box.classList.toggle('many', g.people.length > 3);
  for (const p of g.people) {
    const d = document.createElement('div'); d.className = 'fam card';
    d.innerHTML = `<canvas></canvas><b></b><div class="bar${p.resident ? '' : ' na'}"><i></i></div><small></small>`;
    d.querySelector('b').textContent = p.name;
    box.appendChild(d);
    famEls.push({ d, bar: d.querySelector('.bar i'), st: d.querySelector('small'), cv: d.querySelector('canvas'), mood: -1 });
  }
  requestAnimationFrame(() => { layout(); for (let i = 0; i < famEls.length; i++) drawPortrait(i); });
}
function drawPortrait(i) { const p = g.people[i], el = famEls[i]; el.mood = p.mood; portrait(el.cv, p.look, p.role, p.mood); }
function status(p) {
  if (p.gone) return p.resident ? 'gone for good' : 'gone';
  if (p.leaving) return 'leaving!';
  if (p.role === 'dog') return p.asleep ? 'asleep in his basket' : 'can see you';
  if (p.role === 'toddler') return p.asleep ? 'asleep' : 'giggling at you';
  if (p.awakeT > 0) return 'wide awake';
  if (p.asleep) return p.heavy ? 'snoring' : 'asleep';
  if (p.state === 'search') return 'searching with a torch';
  if (p.state === 'look' || p.state === 'startle') return 'looking around';
  if (p.state === 'company') return 'looking for company';
  if (p.path) return 'on the move';
  if (p.atAct && ACTS[p.act]) return ACTS[p.act].label;
  return 'pottering';
}
let hudT = 0;
function updateHud(dt) {
  hudT -= dt;
  comboT -= dt; if (comboT <= 0) $('combo').classList.remove('on');
  // ectoplasm wisps
  const wisps = $('ecto').children;
  for (let i = 0; i < ECTO_MAX; i++) {
    const f = Math.max(0, Math.min(1, g.ecto - i));
    wisps[i].classList.toggle('full', f >= 1);
    wisps[i].style.setProperty('--f', (f >= 1 ? 100 : f * 100) + '%');
  }
  if (hudT > 0) return;
  hudT = 0.12;
  $('clock').textContent = g.clockOn ? g.hourText() : 'Mr Hobb';
  g.people.forEach((p, i) => {
    const el = famEls[i]; if (!el) return;
    el.bar.style.width = Math.min(100, p.shown) + '%';
    el.st.textContent = status(p);
    el.d.classList.toggle('gone', p.gone || p.leaving);
    if (el.mood !== p.mood) drawPortrait(i);
  });
  // the hover label
  const tip = $('tip');
  const o = hover;
  if (o && mode === 'play') {
    const w = g.watchers(o);
    const [sx, sy] = toScreen(o.x, objY(o) - 50);
    tip.hidden = false;
    tip.style.left = Math.max(80, Math.min(innerWidth - 80, sx)) + 'px'; tip.style.top = Math.max(70, sy) + 'px';
    const why = w.length ? `<em>${w[0].role === 'dog' ? `${w[0].name} can see you` : `${w.map((p) => p.name).join(' & ')} ${w.length > 1 ? 'are' : 'is'} watching`}</em>`
      : o.cool > 0 ? '<em>still settling…</em>' : g.ecto < 1 ? '<em>out of ectoplasm</em>' : '<em class="ok">nobody’s looking</em>';
    tip.innerHTML = `${o.verb}${why}`;
  } else tip.hidden = true;
}

// ---------------------------------------------------------------- nights
const NUM = ['Practice', 'Night one', 'Night two', 'Night three'];
function stars(n) {
  const id = NIGHTS[n].id;
  return (save.won[id] ? 1 : 0) + (save.todo[id] || []).length;
}
function starHtml(have, max) { let s = ''; for (let i = 0; i < max; i++) s += i < have ? '★' : '<s>★</s>'; return s; }
function buildTitle() {
  const box = $('nights'); box.innerHTML = '';
  NIGHTS.forEach((n, i) => {
    const locked = i > 1 && !save.won[NIGHTS[i - 1].id];
    const b = document.createElement('button');
    b.className = 'night' + (n.tutorial ? ' tut' : '') + (locked ? ' locked' : '');
    const max = n.tutorial ? 1 : 1 + n.todo.length;
    const have = n.tutorial ? (save.won[n.id] ? 1 : 0) : stars(i);
    b.innerHTML = `<b>${n.tutorial ? 'Learn the ropes' : n.title}</b><span class="stars">${starHtml(have, max)}</span><small>${n.tutorial ? 'Mr Hobb, a practice haunting' : locked ? 'Empty the house the night before' : `${NUM[i]} · ${n.members.length} in the house`}</small>`;
    if (!locked) b.onclick = () => { sound.init(); openIntro(i); };
    else b.disabled = true;
    box.appendChild(b);
  });
}
function todoHtml(night, done) {
  if (!night.todo.length) return '';
  return `<li class="h" style="list-style:none">To do</li>` + night.todo.map((t) => `<li class="${done.has(t.id) ? 'done' : ''}">${t.text}</li>`).join('');
}
const ROLE_RULE = {
  sceptic: 'A <b>sceptic</b> laughs off single tricks. Only a combo gets through.',
  torch: 'A <b>torch</b> lights up the whole room when he goes to look.',
  toddler: 'Near the <b>toddler</b>, nobody takes it seriously.',
  dog: 'The <b>dog</b> can see ghosts. Anything you haunt in his room is spotted.',
};
function openIntro(i) {
  nightIx = i;
  const n = NIGHTS[i];
  if (n.tutorial) { startNight(i); return; }
  mode = 'intro';
  $('title').hidden = true; $('intro').hidden = false;
  $('introKicker').textContent = `${NUM[i]} · moved in today`;
  $('introTitle').textContent = n.title;
  const mem = $('introMembers'); mem.innerHTML = '';
  for (const m of n.members) {
    const d = document.createElement('div'); d.className = 'member';
    d.innerHTML = `<canvas></canvas><div><b></b><span></span></div>`;
    d.querySelector('b').textContent = m.name; d.querySelector('span').textContent = m.quirk;
    mem.appendChild(d);
    requestAnimationFrame(() => portrait(d.querySelector('canvas'), m.look, m.role, 0));
  }
  $('introTodo').innerHTML = todoHtml(n, new Set(save.todo[n.id] || []));
  const rules = [n.members.some((m) => !['adult', 'sceptic', 'torch'].includes(m.role))
    ? 'Scare the grown-ups out before 6 am. The little ones leave with them.' : 'Scare everyone out before 6 am.'];
  const roles = new Set(n.members.map((m) => m.role));
  for (const r of ['sceptic', 'torch', 'toddler', 'dog']) if (roles.has(r)) rules.push(ROLE_RULE[r]);
  if (n.members.some((m) => m.heavy)) rules.push('A <b>heavy sleeper</b> only stirs for loud things.');
  if (i === 1) rules.push('Sleepers can’t watch anything, and waking someone gives them a proper fright.');
  $('introRules').innerHTML = rules.map((r) => `<li>${r}</li>`).join('');
  $('introGo').focus();
}
$('introBack').onclick = () => toTitle();
$('introGo').onclick = () => startNight(nightIx);

function startNight(i) {
  nightIx = i;
  const n = NIGHTS[i];
  g = new Game(i, { seed: (Math.random() * 1e9) | 0, tutCap: n.tutorial ? 85 : 0 });
  floaters = []; hover = null; kbSel = null; ring = null;
  lit = [0, 0, 0, 0, 0, 0];
  mode = 'play'; cam.z = 1;
  for (const id of ['title', 'intro', 'end', 'pause']) $(id).hidden = true;
  $('hud').hidden = false; $('family').hidden = false;
  $('nightName').textContent = n.tutorial ? 'Practice' : NUM[i];
  buildFamily();
  layout();
  tut = n.tutorial ? { step: 0, t: 0 } : null;
  $('coach').hidden = !tut;
  if (tut) tutShow();
}

function endNight(won) {
  if (mode === 'end' || !g) return;
  mode = 'end'; ring = null; hover = null; $('tip').hidden = true;
  const n = NIGHTS[nightIx];
  const prev = new Set(save.todo[n.id] || []);
  for (const d of g.done) if (n.todo.some((t) => t.id === d)) prev.add(d);
  save.todo[n.id] = [...prev];
  if (won) save.won[n.id] = true;
  persist();
  $('coach').hidden = true;
  $('end').hidden = false;
  won ? sound.win() : sound.lose();
  const last = NIGHTS[nightIx + 1];
  if (n.tutorial) {
    $('endKicker').textContent = 'Practice over';
    $('endTitle').textContent = 'Mr Hobb has left.';
    $('endStamp').textContent = 'Vacant';
    $('endText').textContent = 'That’s the job. A family called the Pims are moving in tomorrow night, and they’re staying unless you make them go.';
    $('endTodo').innerHTML = '';
    $('endNext').textContent = 'Night one'; $('endNext').hidden = false;
  } else if (won) {
    $('endKicker').textContent = `${NUM[nightIx]} · ${g.hourText(g.wonHour)}`;
    $('endTitle').textContent = `The ${n.title.replace('The ', '')} have gone.`;
    $('endStamp').textContent = 'Vacant';
    const hrs = g.wonHour < 24 ? 'before midnight' : `by ${g.hourText(g.wonHour)}`;
    $('endText').textContent = last ? `Out of the door ${hrs}. Somebody else is bound to move in tomorrow.` : `Out of the door ${hrs}. The house is yours again, and it’s very quiet. You’ve emptied every family. Go back for the to-do lists, if you like.`;
    $('endNext').hidden = !last; $('endNext').textContent = 'Next night';
  } else {
    $('endKicker').textContent = `${NUM[nightIx]} · 6:00 am`;
    $('endTitle').textContent = `Dawn. The ${n.title.replace('The ', '')} are staying.`;
    $('endStamp').textContent = 'Occupied';
    const left = g.people.filter((p) => p.resident && !p.gone && !p.leaving).map((p) => p.name);
    $('endText').textContent = `${left.join(' and ')} slept through the rest of it. They’re talking about painting the hall magnolia. Try again tonight?`;
    $('endNext').hidden = true;
  }
  if (!n.tutorial) $('endTodo').innerHTML = todoHtml(n, g.done);
  $('endTodo').hidden = !!n.tutorial;
  $('endRetry').hidden = !!n.tutorial;
  (won && !$('endNext').hidden ? $('endNext') : $('endRetry')).focus();
}
$('endMenu').onclick = () => toTitle();
$('endRetry').onclick = () => openIntro(nightIx);
$('endNext').onclick = () => openIntro(nightIx + 1);

function pauseGame() {
  if (mode !== 'play') return;
  mode = 'pause';
  $('pause').hidden = false;
  $('pauseTitle').textContent = NIGHTS[nightIx].title;
  $('pauseTodo').innerHTML = todoHtml(NIGHTS[nightIx], g.done);
  $('pauseTodo').hidden = !NIGHTS[nightIx].todo.length;
  $('pauseGo').focus();
}
function resume() { if (mode !== 'pause') return; mode = 'play'; $('pause').hidden = true; }
$('pauseBtn').onclick = pauseGame;
$('listBtn').onclick = pauseGame;
$('pauseGo').onclick = resume;
$('pauseQuit').onclick = () => { $('pause').hidden = true; toTitle(); };
function toggleSound() { sound.init(); sound.setOn(!sound.on); save.sound = sound.on; persist(); $('soundBtn').classList.toggle('off', !sound.on); $('soundWave').style.display = sound.on ? '' : 'none'; }
$('soundBtn').onclick = toggleSound;
$('soundBtn').classList.toggle('off', !sound.on); $('soundWave').style.display = sound.on ? '' : 'none';
document.addEventListener('visibilitychange', () => { if (document.hidden && !DEMO && !DEBUG) pauseGame(); });

function toTitle() {
  mode = 'title'; tut = null;
  for (const id of ['intro', 'end', 'pause', 'coach']) $(id).hidden = true;
  $('hud').hidden = true; $('family').hidden = true; $('tip').hidden = true;
  $('title').hidden = false;
  g = new Game(1, { seed: 3 }); g.clockOn = false;
  buildTitle();
  layout();
}

// ---------------------------------------------------------------- the practice night
const TUT = [
  { text: 'This house is yours. <b>Mr Hobb</b> moved in today, and he’s having his supper.', next: true },
  { text: 'He’s facing the window, so the <b>kettle</b> is behind him. <b>Tap the kettle.</b>', ring: 'kettle' },
  { text: 'He jumped, and his meter filled a little. Now he’s gone to stare at it: see the <b>eye</b>? Haunt anything someone’s looking at and it’s just a loose hinge. Wait for him to sit back down.' },
  { text: 'Tricks in the same room, one straight after another, stack into a <b>combo</b>. Tap the <b>cupboard</b>. He’ll spin round to look, which puts the <b>teacups</b> behind him. Then tap those, quickly.', ring: 'cupboard' },
  { text: 'Lovely. Each trick wears off a bit every time he sees it, so mix them up. And each one costs a drop of <b>ectoplasm</b> (top left), which comes back slowly.', next: true },
  { text: 'Now finish the job: fill his meter and he’ll leave. He’s wandering the house. Loud things (kettle, clock, radio, record player, shutters) carry into the rooms next door, above and below.' + (matchMedia('(pointer: coarse)').matches ? ' Pinch to zoom in.' : ' Scroll to zoom in.') },
];
const WANDER = ['bath', 'rummage', 'read', 'records', 'cook', 'dress', 'sofa', 'desk'];
function tutShow() {
  const s = TUT[tut.step];
  $('coachText').innerHTML = s.text;
  $('coachStep').textContent = `${tut.step + 1} of ${TUT.length}`;
  $('coachBtn').hidden = !s.next;
  ring = s.ring ? g.objects.find((o) => o.id === s.ring) : null;
  tut.t = 0;
}
function tutGo(n) { tut.step = n; tutShow(); }
$('coachBtn').onclick = () => { if (tut && TUT[tut.step].next) tutGo(tut.step + 1); };
function tutOnHaunt(o, res) {
  if (!res.ok) return;
  const st = tut.step;
  if (res.spotted) {
    $('coachText').innerHTML = TUT[st].text + '<br><b>He saw that one.</b> Wait until there’s no eye over it.';
    return;
  }
  if (st === 1 && o.id === 'kettle') tutGo(2);
  else if (st === 3 && o.id === 'cupboard') { ring = g.objects.find((q) => q.id === 'cups'); }
  else if (st === 3 && res.chain >= 2) tutGo(4);
}
function tutTick(dt) {
  const h = g.people[0];
  tut.t += dt;
  if (tut.step < 5) { g.ecto = ECTO_MAX; if (h.state === 'idle') h.glance = 99; }
  if (tut.step === 2 && h.state === 'idle' && h.atAct && tut.t > 1.5) tutGo(3);
  if (tut.step === 3 && ring && ring.id === 'cups' && g.t - g.lastTrick > COMBO_WIN) {
    ring = g.objects.find((q) => q.id === 'cupboard');
    $('coachText').innerHTML = TUT[3].text + '<br><b>Too slow</b>, the combo’s gone. Let him settle, and try again.';
  }
  if (tut.step === 5) {
    g.tutCap = 0;
    tut.wander = (tut.wander ?? 0) - dt;
    if (tut.wander <= 0 && !h.leaving) {
      tut.wander = 16;
      tut.w = ((tut.w ?? -1) + 1) % WANDER.length;
      h.sched = [[0, WANDER[tut.w]]]; h.glance = 3;
    }
  }
  if (tut.step === 4 && tut.t > 0.1) { /* waits for Next */ }
}

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000) * SPEED; last = now;
  time += dt;
  try {
    if (!HOLD) step(dt);
    render();
  } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
function step(dt) {
  if (mode === 'play' || mode === 'title' || mode === 'intro' || mode === 'end') {
    let left = dt;
    while (left > 1e-6) {
      const h = Math.min(0.05, left); left -= h;
      if (mode === 'play' && tut) tutTick(h);
      if (bot) bot.tick(h);
      g.tick(h);
      if (mode === 'title' || mode === 'intro') g.events.length = 0;
    }
  }
  if (mode === 'play' || mode === 'end') handleEvents();
  if (mode === 'play' || mode === 'pause') updateHud(dt);
  if (sound.ctx && sound.on) sound.tickMusic(g && g.people.some((p) => p.mood === 2) ? 0.6 : 0);
}

// ---------------------------------------------------------------- start
toTitle();
if (DEMO) {
  // the Hales at about a quarter to eleven, mid-haunting
  startNight(2);
  bot = new Bot(g, { seed: 4 });
  for (let i = 0; i < 1180; i++) { bot.tick(0.05); g.tick(0.05); g.events.length = 0; }
  bot.react = 0.9;
} else if (Q.has('night')) {
  const n = +Q.get('night');
  if (NIGHTS[n]) startNight(n);
}
if (DEBUG) {
  window.pg = {
    get g() { return g; }, get mode() { return mode; }, get tut() { return tut; }, render, step, start: startNight, openIntro, toTitle,
    ff(sec, withBot = false) { const b = withBot ? new Bot(g, { seed: 9 }) : null; for (let t = 0; t < sec; t += 0.05) { if (b) b.tick(0.05); if (tut) tutTick(0.05); g.tick(0.05); handleEvents(); } updateHud(1); },
    haunt(id) { const o = g.objects.find((q) => q.id === id); doHaunt(o); handleEvents(); updateHud(1); return o; },
    at(id) { const o = g.objects.find((q) => q.id === id); return toScreen(o.x, objY(o)); },
    person(i) { const p = g.people[i]; return { x: p.x, f: p.f, state: p.state, act: p.act, fear: p.fear, face: p.face, atAct: p.atAct, gone: p.gone }; },
    cam,
    autoplay(on = true) { bot = on ? new Bot(g, { seed: 9 }) : null; },
  };
}
requestAnimationFrame(frame);
window.toyboxReady?.();
