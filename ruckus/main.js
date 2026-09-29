// Ruckus: the page. Everything you type becomes a slot in a line of text; each slot gets a scene (a big, loud, flat
// routine for that character) which plays over the top of the page and ends with the letter landing in its place.
// This file owns the typing (keys, phone keyboard), the text and how it is laid out, which scenes are running and which
// wait their turn, the colour that floods the page behind, and keeping the frame rate up.
import {
  glyphOf, glyph, bind, K, E, S, C, TAU, sat, clamp, mixHex, spring, hash
} from './kit.js';
import { Anim, LOUD } from './anim.js';
import { sceneFor, LIGHT } from './scenes.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(pointer: coarse)').matches;
const SPEED = clamp(Number(Q.get('speed')) || 1, 0.25, 8);        // ?speed=3 plays everything faster

const cv = $('c'), ctx = cv.getContext('2d', { alpha: false });
const ui = $('ui'), keys = $('keys'), hint = $('hint'), live = $('live');

/* ---------- the size of the show ---------- */
let W = 800, H = 600, DPR = 1, RS = 1, quality = 1, unit = 300;
function measure() {
  const vv = window.visualViewport;
  W = Math.max(240, Math.round(vv ? vv.width : innerWidth)); H = Math.max(240, Math.round(vv ? vv.height : innerHeight));
  DPR = Math.min(devicePixelRatio || 1, 3);
  const left = vv ? vv.offsetLeft : 0, top = vv ? vv.offsetTop : 0;
  for (const el of [cv, ui]) { el.style.width = W + 'px'; el.style.height = H + 'px'; el.style.transform = `translate(${left}px, ${top}px)`; }
  scale();
  unit = Math.min(H * 0.5, W * 0.62);
  arrange(true);
}
function scale() {                                                  // fewer pixels when the frame rate suffers
  RS = Math.max(1, Math.min(DPR, 2 * (0.55 + 0.45 * quality)));
  const pw = Math.round(W * RS), ph = Math.round(H * RS);
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; sprites.clear(); }
}
const fxLevel = () => REDUCED ? 0.5 : 0.35 + 0.65 * quality;      // how much confetti to throw

/* ---------- the text ----------
   A slot is one typed character (or space, or line break). A letter is a placeholder until its scene ends and it lands. */
const GAP = 13, SPACE = 44, MAXCH = 260;
const slots = [], queue = [], active = [], fxs = [], layers = [];
let clock = 0, caret = { x: W / 2, y: H * 0.66, h: 90 }, bgCol = '#2f5cff';

function arrange(snap) {
  const marginX = Math.max(14, W * 0.05), avail = W - marginX * 2, maxH = H * 0.4;
  let size = clamp(Math.min(H * 0.16, W * 0.115), 30, 118), lines;
  const adv = (s, sz) => s.kind === 'space' ? SPACE * sz / 100 : s.kind === 'char' ? (s.g.w * s.sc + GAP) * sz / 100 : 0;
  const wrap = sz => {
    const out = [{ items: [], w: 0 }], cur = () => out[out.length - 1], gap = GAP * sz / 100;
    let i = 0;
    while (i < slots.length) {
      const s = slots[i];
      if (s.kind === 'nl') { cur().items.push(s); out.push({ items: [], w: 0 }); i++; continue; }
      if (s.kind === 'space') { cur().items.push(s); if (cur().w > 0) cur().w += adv(s, sz); i++; continue; }
      let j = i, ww = 0;
      while (j < slots.length && slots[j].kind === 'char') { ww += adv(slots[j], sz); j++; }
      if (cur().w > 0 && cur().w + ww - gap > avail) out.push({ items: [], w: 0 });
      for (let k = i; k < j; k++) {                                // a word longer than the line breaks where it must
        const w = adv(slots[k], sz);
        if (cur().w > 0 && cur().w + w - gap > avail) out.push({ items: [], w: 0 });
        cur().items.push(slots[k]); cur().w += w;
      }
      i = j;
    }
    return out;
  };
  for (let tries = 0; tries < 14; tries++) {
    lines = wrap(size);
    if (lines.length * size * 1.3 <= maxH || size <= 30) break;
    size *= 0.9;
  }
  const maxLines = Math.max(1, Math.floor(maxH / (size * 1.3)));
  if (lines.length > maxLines) {                                    // too much for the screen: the oldest lines scroll away
    let n = 0;
    for (let li = 0; li < lines.length - maxLines; li++) n += lines[li].items.length;
    for (const s of slots.splice(0, n)) drop(s);
    lines = wrap(size);
  }
  const gap = GAP * size / 100, lineH = size * 1.3, top = H * 0.665 - lines.length * lineH / 2;
  lines.forEach((ln, li) => {
    let trail = 0;                                                  // trailing spaces don't count toward centring
    for (let k = ln.items.length - 1; k >= 0 && ln.items[k].kind === 'space'; k--) trail += adv(ln.items[k], size);
    const y = top + li * lineH + lineH / 2;
    let x = (W - Math.max(0, ln.w - trail - gap)) / 2, end = x;
    for (const s of ln.items) {
      const w = adv(s, size);
      if (s.kind === 'char') { s.tx = x + s.g.w * s.sc * size / 200; s.ty = y; s.th = size * s.sc; end = x + w - gap; }
      x += w;
      if (snap || s.x === undefined) { s.x = s.tx; s.y = s.ty; s.h = s.th; }
    }
    if (li === lines.length - 1) caret = { x: end, y, h: size };
  });
  live.textContent = slots.map(s => s.kind === 'nl' ? '\n' : s.ch).join('');
}
function drop(s) {                                                  // a slot leaves the text without being backspaced
  const qi = queue.indexOf(s);
  if (qi >= 0) queue.splice(qi, 1);
  if (s.anim) s.anim.leave(true);
  if (s.kind === 'char' && s.state === 'set') puff(s);
}

/* ---------- typing ---------- */
let lastStart = -9, placeN = 0, seedN = 1, lastRepeat = false;
const PLACES = [[0, 0], [-0.17, -0.05], [0.17, 0.05], [-0.09, 0.1], [0.11, -0.1], [0.02, 0.04]];

function typeChar(ch, repeat) {
  if (slots.length >= MAXCH) drop(slots.shift());
  const kind = ch === '\n' ? 'nl' : ch === ' ' ? 'space' : 'char';
  const up = kind === 'char' && ch !== ch.toLowerCase() && ch === ch.toUpperCase();
  const s = { ch, kind, g: kind === 'char' ? glyphOf(ch) : null, sc: up ? 1.1 : 1, X: up ? LOUD : 1, state: 'set', anim: null, popAt: -9, def: null, col: K.white };
  if (kind === 'char') { s.state = 'wait'; s.def = sceneFor(ch); s.col = s.def.textColor || s.def.color; }
  slots.push(s);
  arrange();
  if (kind === 'char') {
    if (repeat) land(s);                                            // a held key gets the pop, not the whole show
    else queue.push(s);
  } else if (LIGHT[kind] && active.filter(a => a.def.light).length < 2) launch(s, LIGHT[kind]);
  hint.classList.add('gone');                                       // the instructions fade as soon as someone is typing
}
function backspace() {
  const s = slots.pop();
  if (!s) return;
  drop(s);
  arrange();
}
function clearAll() {
  for (const s of slots.splice(0)) drop(s);
  arrange();
}
function land(s) { s.state = 'set'; s.popAt = clock; fxs.push({ kind: 'land', x: s.tx, y: s.ty, h: s.th, col: s.col, t0: clock }); }
function puff(s) { fxs.push({ kind: 'poof', x: s.x, y: s.y, h: s.h, col: s.col, t0: clock, g: s.g }); }

/* ---------- the colour behind: each scene floods the page with its own, and its backdrop rides on that ----------
   A layer is a scene's wipe (three rings of colour spreading out from where it starts) and, while it plays, its backdrop.
   Layers are drawn oldest first, so a newer scene's wipe paints over the older backdrops as it spreads. */
function addLayer(col, x, y, big, anim) {
  const reach = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) * 1.06;
  layers.push({ col, x, y, t0: clock, reach, dur: big ? 0.65 : 0.5, a: mixHex(col, '#ffffff', 0.4), b: mixHex(col, '#150a35', 0.28), anim });
}
// Flat shapes drifting, tone on tone, over the plain colour: there is always something moving when nothing is playing.
const IDLE = Array.from({ length: 15 }, (_, i) => ({ kind: i % 4, x: hash(i, 1), y: hash(i, 2), r: 0.035 + 0.075 * hash(i, 3), sp: 0.4 + 0.6 * hash(i, 4), ph: hash(i, 5) * TAU, dir: hash(i, 6) < 0.5 ? -1 : 1, lite: i % 3 === 0 }));
let idleFor = '', idleDark = '', idleLite = '';
function drawIdle() {
  if (idleFor !== bgCol) { idleFor = bgCol; idleDark = mixHex(bgCol, '#150a35', 0.13); idleLite = mixHex(bgCol, '#ffffff', 0.1); }
  const m = Math.min(W, H), t = REDUCED ? 0 : clock;
  for (const d of IDLE) {
    const x = (d.x + 0.05 * S(t * 0.13 * d.sp + d.ph)) * W, y = (d.y + 0.04 * C(t * 0.11 * d.sp + d.ph * 1.7)) * H, r = d.r * m * (1 + 0.06 * S(t * 0.6 * d.sp + d.ph)), a = t * 0.12 * d.dir * d.sp + d.ph;
    ctx.fillStyle = ctx.strokeStyle = d.lite ? idleLite : idleDark;
    ctx.beginPath();
    if (d.kind === 0) ctx.arc(x, y, r, 0, TAU);
    else if (d.kind === 1) { ctx.lineWidth = r * 0.28; ctx.arc(x, y, r * 0.86, 0, TAU); ctx.stroke(); continue; }
    else if (d.kind === 2) for (let k = 0; k < 3; k++) { const an = a + k * TAU / 3; k ? ctx.lineTo(x + C(an) * r * 1.15, y + S(an) * r * 1.15) : ctx.moveTo(x + C(an) * r * 1.15, y + S(an) * r * 1.15); }
    else for (let k = 0; k < 4; k++) { const an = a + k * TAU / 4 + TAU / 8; k ? ctx.lineTo(x + C(an) * r * 1.2, y + S(an) * r * 1.2) : ctx.moveTo(x + C(an) * r * 1.2, y + S(an) * r * 1.2); }
    ctx.closePath(); ctx.fill();
  }
}
function drawBg() {
  ctx.fillStyle = bgCol; ctx.fillRect(-30, -30, W + 60, H + 60);
  drawIdle();
  let cover = -1;                                                   // the newest wipe that has swallowed the whole screen hides everything older
  for (let i = layers.length - 1; i >= 0; i--) if (clock - layers[i].t0 > layers[i].dur + 0.2) { cover = i; break; }
  if (cover >= 0) {
    bgCol = layers[cover].col; document.body.style.background = bgCol;
    layers.splice(0, layers[cover].anim && !layers[cover].anim.done ? cover : cover + 1);
  }
  for (const L of layers) {
    const age = clock - L.t0;
    for (let l = 0; l < 3; l++) {
      const p = sat((age - l * 0.07) / L.dur);
      if (p <= 0) continue;
      ctx.fillStyle = l === 0 ? L.a : l === 1 ? L.b : L.col;
      ctx.beginPath(); ctx.arc(L.x, L.y, L.reach * E.out(p), 0, TAU); ctx.fill();
    }
    if (L.anim && !L.anim.done) guarded(L.anim, drawBack);
  }
}

/* ---------- a scene that breaks is dropped, not the toy ---------- */
function guarded(a, fn) {
  ctx.save();
  try { fn(a); } catch (err) {
    a.done = a.noLand = true; console.error(`scene ${a.ch}:`, err);
    for (let i = 0; i < 12; i++) ctx.restore();                     // unwind whatever the scene left saved (extra restores do nothing), then keep the pair below balanced
    ctx.save();
  }
  ctx.restore();
}
const drawBack = a => a.drawBack(ctx), drawFront = a => a.draw(ctx);

/* ---------- starting scenes and keeping them from piling up ---------- */
const MAX_ACTIVE = TOUCH ? 2 : 3, MAX_QUEUE = 12, MIN_SHOW = 0.7, MIN_GAP = 0.09;
let speedNow = 1, shake = 0;
function pickPlace() {                                              // the spot farthest from the scenes already playing
  let best = 0, bestD = -1;
  for (let i = 0; i < PLACES.length; i++) {
    const ix = (placeN + i) % PLACES.length, p = PLACES[ix];
    let d = 9;
    for (const a of active) if (!a.def.light) d = Math.min(d, Math.hypot(p[0] - a.px, p[1] - a.py));
    if (d > bestD + 0.001) { bestD = d; best = ix; }
  }
  placeN = best + 1;
  return PLACES[best];
}
function launch(s, def) {
  const place = def.light ? [0, 0] : pickPlace(), load = active.filter(a => !a.def.light).length;
  const a = new Anim(def, {
    ch: s.ch, X: def.light ? 1 : s.X, w: W * 0.94, h: H * 0.9, u: unit * (1 - 0.06 * load), cx: W * (0.5 + place[0]), cy: H * (0.46 + place[1]), seed: seedN++ * 7919 + (s.ch.codePointAt(0) || 0),
    fx: fxLevel(), flip: def.flip || 1, slot: s,
  });
  a.px = place[0]; a.py = place[1];
  s.anim = a; if (s.kind === 'char') s.state = 'play';
  active.push(a);
  if (!def.light) addLayer(def.bg, a.cx, a.cy, a.big, a);
  lastStart = clock;
}
function schedule(dt) {
  let heavy = 0;
  for (const a of active) if (!a.def.light) heavy++;
  while (queue.length > MAX_QUEUE) land(queue.shift());          // a flood: the oldest just settle into place
  while (queue.length && heavy < MAX_ACTIVE && clock - lastStart > MIN_GAP) { const s = queue.shift(); launch(s, s.def); heavy++; }
  if (queue.length && heavy >= MAX_ACTIVE) {                     // make room: the oldest scene that has had its moment leaves
    const old = active.find(a => !a.def.light && !a.leaving && a.t > MIN_SHOW);
    if (old) old.leave(false);
  }
  const target = clamp(1 + 0.15 * Math.max(0, heavy + queue.length - 2), 1, 2);
  speedNow += (target - speedNow) * (1 - Math.exp(-4 * dt));
  for (let i = 0; i < active.length; i++) {
    const a = active[i];
    a.step(dt * speedNow);
    if (a.done) {
      active.splice(i--, 1);
      const s = a.slot;
      if (s.anim === a) s.anim = null;
      if (s.kind === 'char' && !a.noLand && slots.includes(s)) { land(s); if (a.big && !REDUCED) shake = 7; }
    }
  }
}

/* ---------- drawing the text and the little effects ----------
   A settled letter is drawn once to a small bitmap and stamped from then on: stroking a few hundred outlined letters every
   frame is a lot to ask of a phone. Bitmaps are made a few per frame (a letter without one yet is simply drawn), at the
   size the text is settling to, and thrown away when the pixel density or the text size changes. */
const sprites = new Map();
let spritesMade = 0;
function sprite(s) {
  const q = Math.max(16, Math.round(s.th / 6) * 6), key = s.ch + s.col + q;
  let sp = sprites.get(key);
  if (sp || spritesMade >= 12) return sp;
  if (sprites.size > 400) sprites.clear();
  const k = q / 100, pad = 16 * k, gw = s.g.w * k, cv2 = document.createElement('canvas');
  cv2.width = Math.ceil((gw + 2 * pad) * RS); cv2.height = Math.ceil((q + 2 * pad) * RS);
  const c2 = cv2.getContext('2d');
  c2.scale(RS, RS); c2.translate(pad + gw / 2, pad + q / 2);
  bind(c2); glyph(s.g, k, { color: s.col }); bind(ctx);
  sp = { cv: cv2, w: cv2.width / RS, h: cv2.height / RS, ox: pad + gw / 2, oy: pad + q / 2, q };
  sprites.set(key, sp); spritesMade++;
  return sp;
}
let dtReal = 1 / 60;
function drawText() {
  spritesMade = 0;
  const k = 1 - Math.exp(-14 * dtReal);
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (s.kind !== 'char') continue;
    s.x += (s.tx - s.x) * k; s.y += (s.ty - s.y) * k; s.h += (s.th - s.h) * k;
    if (s.state !== 'set') {                                       // a placeholder: a small hopping dot where the letter will land
      const bob = Math.abs(S(clock * 6 + i)) * s.h * 0.07, y = s.y + s.h * 0.34 - bob;
      ctx.fillStyle = K.ink; ctx.beginPath(); ctx.arc(s.x, y, s.h * 0.085, 0, TAU); ctx.fill();
      ctx.fillStyle = K.white; ctx.beginPath(); ctx.arc(s.x, y, s.h * 0.058, 0, TAU); ctx.fill();
      continue;
    }
    const age = clock - s.popAt, pk = 1 - spring(age, 2.4, 6.5), bob = REDUCED ? 0 : S(clock * 2.3 + i * 0.55) * s.h * 0.018, sp = sprite(s);
    ctx.save(); ctx.translate(Math.round(s.x * RS) / RS, Math.round((s.y + bob) * RS) / RS); ctx.scale(1 + 0.24 * pk, 1 - 0.3 * pk);
    if (sp) { const f = s.h / sp.q; ctx.drawImage(sp.cv, -Math.round(sp.ox * f * RS) / RS, -Math.round(sp.oy * f * RS) / RS, sp.w * f, sp.h * f); }
    else glyph(s.g, s.h / 100, { color: s.col });
    ctx.restore();
  }
  if ((clock * 1.7) % 1 < 0.62 || active.length || queue.length) {  // the caret, where the next letter goes
    const w = Math.max(5, caret.h * 0.07), h = caret.h * 0.9, x = caret.x + GAP * caret.h / 100 * 0.5 + w * 1.4;
    ctx.fillStyle = K.ink; roundRect(x - w / 2 - 3, caret.y - h / 2 - 3, w + 6, h + 6, w); ctx.fill();
    ctx.fillStyle = K.white; roundRect(x - w / 2, caret.y - h / 2, w, h, w / 2); ctx.fill();
  }
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function drawFx() {
  for (let i = fxs.length - 1; i >= 0; i--) {
    const f = fxs[i], p = (clock - f.t0) / 0.5;
    if (p >= 1) { fxs.splice(i, 1); continue; }
    if (f.kind === 'land') {                                        // a ring of dots flicked off a letter as it lands
      ctx.fillStyle = f.col;
      for (let n = 0; n < 7; n++) {
        const a = n / 7 * TAU + 0.4, r = f.h * (0.45 + 0.7 * E.out(p)), rd = f.h * 0.07 * (1 - p);
        if (rd > 0.6) { ctx.beginPath(); ctx.arc(f.x + C(a) * r, f.y + S(a) * r, rd, 0, TAU); ctx.fill(); }
      }
    } else {                                                        // a letter taken away: it spins off and shrinks, with a puff
      const sc = Math.max(0.02, 1 - E.inBack(p) * 0.98);
      ctx.save(); ctx.translate(f.x, f.y - f.h * 0.25 * E.out(p)); ctx.rotate(p * 2.2); ctx.scale(sc, sc);
      glyph(f.g, f.h / 100, { color: f.col }); ctx.restore();
      ctx.fillStyle = K.white;
      for (let n = 0; n < 6; n++) {
        const a = n / 6 * TAU, r = f.h * 0.9 * E.out(p), rd = f.h * 0.09 * (1 - p);
        if (rd > 0.6) { ctx.beginPath(); ctx.arc(f.x + C(a) * r, f.y + S(a) * r, rd, 0, TAU); ctx.fill(); }
      }
    }
  }
}

/* ---------- the frame ---------- */
let last = 0, ema = 1 / 60, slowFor = 0, fastFor = 0, jsMs = 0, fps = null;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.25, (now - last) / 1000 || 1 / 60); last = now;
  dtReal = Math.min(0.05, raw);
  const t0 = performance.now();
  clock += dtReal * SPEED;
  ema += (raw - ema) * 0.08;                                        // if frames run long for a while, draw fewer pixels and less confetti
  if (ema > 0.026) { slowFor += raw; fastFor = 0; } else if (ema < 0.0195) { fastFor += raw; slowFor = 0; } else slowFor = fastFor = 0;
  if (slowFor > 0.7 && quality > 0.3) { quality = Math.max(0.3, quality - 0.2); slowFor = 0; scale(); }
  else if (fastFor > 6 && quality < 1) { quality = Math.min(1, quality + 0.1); fastFor = 0; scale(); }

  schedule(dtReal * SPEED);
  shake = shake > 0.3 ? shake * Math.exp(-9 * dtReal) : 0;
  ctx.setTransform(RS, 0, 0, RS, 0, 0);
  if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  bind(ctx);
  drawBg();
  drawText();
  for (const a of active) guarded(a, drawFront);
  drawFx();
  jsMs += (performance.now() - t0 - jsMs) * 0.1;
  if (fps) fps.textContent = `${Math.round(1 / ema)} fps · ${jsMs.toFixed(1)} ms js · q${quality.toFixed(1)} · ${active.length} playing, ${queue.length} waiting`;
}

/* ---------- keys ----------
   Characters arrive one of two ways. A hidden text field takes focus (always on a computer, after a tap on a phone, where it
   brings up the keyboard) and is watched through input events, which is what phone keyboards, dead keys, the emoji picker
   and IMEs all speak. The field always holds one invisible marker character, so that Backspace has something to delete. If
   it isn't focused, keydown is used directly. */
const MARK = '\u200b';
let mirror = '';                                                     // text in the field beyond the marker (only non-empty while a keyboard is composing a word)
const focusKeys = () => { if (document.activeElement !== keys) { keys.focus({ preventScroll: true }); keys.setSelectionRange(keys.value.length, keys.value.length); } };
addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') e.preventDefault();      // no selecting the marker
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if ((e.key === 'Enter' || e.key === ' ') && e.target !== keys && e.target.closest && e.target.closest('a, button')) return;   // the Home link keeps its own Enter and Space
  if (e.key === 'Enter') { e.preventDefault(); typeChar('\n'); return; }
  if (e.key === 'Escape') { clearAll(); return; }
  lastRepeat = e.repeat;
  if (e.target === keys) { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') e.preventDefault(); return; }     // the field reports through input events
  if (e.key === 'Backspace') { e.preventDefault(); backspace(); return; }
  if (e.isComposing || e.key === 'Dead') return;
  if ([...e.key].length === 1) { e.preventDefault(); typeChar(e.key, e.repeat); focusKeys(); }
});
keys.value = MARK;
keys.addEventListener('input', e => {
  const v = keys.value, hasMark = v.includes(MARK), typed = v.split(MARK).join('');
  if (!hasMark && !typed && !mirror) backspace();                     // the marker itself was deleted: that's a Backspace
  else if (typed.startsWith(mirror)) { for (const ch of typed.slice(mirror.length)) typeChar(ch, lastRepeat); }
  else if (mirror.startsWith(typed)) { for (let i = mirror.length - typed.length; i > 0; i--) backspace(); }
  else {                                                            // a word replaced by another (autocorrect): undo back to what they share
    let p = 0;
    while (p < typed.length && p < mirror.length && typed[p] === mirror[p]) p++;
    for (let i = mirror.length - p; i > 0; i--) backspace();
    for (const ch of typed.slice(p)) typeChar(ch);
  }
  if (e.isComposing) mirror = typed; else { keys.value = MARK; mirror = ''; }
});
addEventListener('paste', e => { const t = (e.clipboardData && e.clipboardData.getData('text')) || ''; for (const ch of [...t].slice(0, 80)) typeChar(ch === '\r' ? '\n' : ch); e.preventDefault(); });
cv.addEventListener('pointerdown', focusKeys);
cv.addEventListener('pointerup', focusKeys);                        // iOS raises the keyboard only from the end of a tap
cv.addEventListener('click', focusKeys);
addEventListener('focus', () => { if (!TOUCH) focusKeys(); });

/* ---------- start ---------- */
if (Q.has('fps')) {                                               // ?fps: frame rate and scene counts in a corner (and the state on window.__ruckus, for testing)
  window.__ruckus = { slots, active, queue, layers }; fps = document.createElement('div'); fps.style.cssText = 'position:fixed;right:8px;top:8px;font:12px monospace;color:#fff;background:#0008;padding:3px 6px;z-index:9;pointer-events:none'; document.body.appendChild(fps); }
if (!TOUCH) focusKeys();
if (TOUCH) { $('hintMain').textContent = 'Tap, then type'; $('hintSub').textContent = 'Shift makes it louder · return for a new line'; }
addEventListener('resize', measure);
if (window.visualViewport) { visualViewport.addEventListener('resize', measure); visualViewport.addEventListener('scroll', measure); }
measure();
if (Q.has('film')) import('./film.js').then(m => m.start({ cv, ctx, W, H, RS, params: Q }));
else {
  const text = Q.get('text');
  if (text) {                                                       // ?text=Hello|World types it out for you (| is a new line)
    const chars = [...text], pace = (Number(Q.get('pace')) || 0.33) * 1000 / SPEED;
    let i = 0;
    const next = () => { if (i < chars.length) { const ch = chars[i++]; typeChar(ch === '|' ? '\n' : ch); setTimeout(next, pace); } };
    setTimeout(next, 400 / SPEED);
    hint.classList.add('gone');
  }
  requestAnimationFrame(frame);
}
