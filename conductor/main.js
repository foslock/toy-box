import { PROGRAMME, ENCORE, REHEARSAL, SECTIONS } from './score.js';
import { Perf, Turns, PATTERNS, cardScale } from './engine.js';
import { Sound } from './audio.js';
import { Art, INK, VERM, CRIM, PAPER, CREAM, GOLD, GAMB, rng, paint, oval, smooth, mk } from './art.js';
import { Bot } from './bot.js';
import { review } from './notice.js';

const Q = new URLSearchParams(location.search), DEMO = Q.has('demo'), DEBUG = Q.has('debug'), AUTO = Q.has('autoplay');
const $ = (id) => document.getElementById(id);
const cv = $('cv'), g = cv.getContext('2d');
const sound = new Sound(), art = new Art();
const KEY = 'conductor-v1';
const blank = { rehearsed: false, bq: {}, seen: {}, sound: true };
let save = { ...blank };
try { save = { ...blank, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} };
sound.on = save.sound;

let W = 0, H = 0, DPR = 1, R = null, P = null, S = null, padCanvas = null; // stage, pad, score strip
let mode = 'bill'; // bill | curtain | practice | ready | play | bows | rehearse
let perf = null, piece = null, turns = null, curt = 1, curtGoal = 1, paused = false, pauseT = 0;
let trail = [], tags = [], bot = null, conduct = null, lastPtr = null, flicked = 0, feedback = { text: '', t: -9 }, shake = 0, zz = 0, tut = null, practiced = 0, flash = {}, lastCough = 0, lastLeave = 0, confetti = [], endAt = 0, stallShown = 0;
const now = () => performance.now() / 1000;

function resize() {
  W = innerWidth; H = innerHeight; DPR = Math.min(2, devicePixelRatio || 1);
  cv.width = W * DPR; cv.height = H * DPR;
  const sb = Math.max(0, parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0);
  if (W > H * 1.25 && H < 560) { // a phone on its side: stage left, score right
    const sw = Math.round(W * .54); R = { x: 0, y: 0, w: sw, h: H }; S = { x: sw, y: 0, w: W - sw, h: 50 }; P = { x: sw, y: 50, w: W - sw, h: H - 50 };
  } else {
    const sh = Math.round(H * (W > H ? .57 : .42)); R = { x: 0, y: 0, w: W, h: sh }; S = { x: 0, y: sh, w: W, h: Math.max(50, Math.round(H * .065)) }; P = { x: 0, y: sh + S.h, w: W, h: H - sh - S.h };
  }
  P.size = Math.min(P.w, P.h) * .98; P.cx = P.x + P.w / 2; P.cy = P.y + P.h * .56;
  art.layout(R, DPR); buildPad(); turns = new Turns(P.size); placeTip();
}
function buildPad() {
  const c = padCanvas = mk(W * DPR, (P.h + S.h + 2) * DPR), h = c.getContext('2d'); h.scale(DPR, DPR); const top = Math.min(P.y, S.y);
  h.fillStyle = '#efe2c3'; h.fillRect(0, 0, W, P.h + S.h + 2);
  const r = rng(99); h.globalAlpha = .1; h.fillStyle = '#6e5230'; for (let i = 0; i < 2200; i++) h.fillRect(r() * W, r() * (P.h + S.h), 1 + r() * 2, 1);
  h.globalAlpha = .13; h.strokeStyle = INK; h.lineWidth = .8; const y0 = P.y - top + 8, gap = Math.max(24, P.h / 7);
  for (let k = 0; k < 8; k++) for (let i = 0; i < 5; i++) { const y = y0 + k * gap + i * 3.4; h.beginPath(); h.moveTo(P.x + 12, y); h.lineTo(P.x + P.w - 12, y); h.stroke(); }
  h.globalAlpha = 1; h.strokeStyle = INK; h.lineWidth = 1.4; h.beginPath(); h.moveTo(S.x, 0.7); h.lineTo(S.x + S.w, .7); h.stroke();
}

// ---------- the flow ----------
function buildBill() {
  const pr = $('prog'); pr.innerHTML = '';
  const all = [...PROGRAMME, ENCORE]; let open = save.rehearsed;
  const heard = PROGRAMME.every(p => save.bq[p.id] !== undefined);
  all.forEach((p, i) => {
    const b = document.createElement('button'); b.className = 'row'; const enc = p === ENCORE;
    const unlocked = enc ? heard : open; b.disabled = !unlocked;
    const bq = save.bq[p.id]; const flowers = bq ? new Array(bq).fill(`<img alt="" src="${art.bq || ''}">`).join('') : '';
    b.innerHTML = `<span class="n${enc ? ' enc' : ''}">${p.num}</span><span><b>${p.title}</b><i>${p.sub}</i></span><span class="bq">${flowers}</span>`;
    if (!enc) b.setAttribute('aria-label', p.title);
    b.onclick = () => begin(p);
    pr.append(b);
    if (save.bq[p.id] === undefined) open = false;
  });
  const st = $('start'); st.innerHTML = '';
  const next = PROGRAMME.find(p => save.bq[p.id] === undefined);
  const btn = document.createElement('button'); btn.className = 'big';
  if (!save.rehearsed) { btn.textContent = 'Take up the baton'; btn.onclick = beginRehearsal; st.append(btn); }
  else {
    btn.textContent = next ? `On to ${next.num}. ${next.title}` : 'The bouquets are in'; btn.onclick = () => next ? begin(next) : begin(ENCORE); st.append(btn);
    const again = document.createElement('button'); again.className = 'plain'; again.textContent = 'Rehearse again'; again.onclick = beginRehearsal; st.append(document.createElement('br'), again);
  }
  $('billLine').textContent = save.rehearsed ? '(the Committee has asked that you continue)' : '(that is to say, you)';
}
function showBill() { mode = 'bill'; perf = null; bot = null; tut = null; hideTip(); $('bill').classList.remove('off'); $('notice').classList.add('off'); $('menuB').classList.add('off'); curtGoal = 1; curt = 1; buildBill(); $('bill').scrollTop = 0; }
function intoTheatre() { sound.init(); $('bill').classList.add('off'); $('notice').classList.add('off'); $('menuB').classList.remove('off'); patronsBack(); }
function patronsBack() { for (const p of art.patrons) { p.leaving = false; p.gone = 0; } }

function hooks() {
  return {
    onNote(ev, when, v, dur, s, level) { sound.note(ev, when, v, dur, Math.max(s.slop * .8, chaos())); },
    onBeat(b) { sound.setLevel(perf.level); flash.beat = now(); shakeHit(b); if (tut) tut.onBeat?.(b); judge(b); },
    onHold(f) { if (f.run) sound.cadenza(f.run, f.sec); },
    onHoldEnd() { sound.cutHeld(); },
    onOverrun() { tag('solo', 'She had not finished', true); },
    onCue(c, q) { tag(c.sec, q >= 1 ? 'Thank you!' : q > .5 ? 'Just in time' : 'At last', q < .5); flash[c.sec] = now(); },
    onCueMiss(c) { tag(c.sec, c.ting ? 'He never got his note' : 'Waiting for you!', true); if (c.ting) sound.cough(); },
    onFix(tr) { const words = { drag: 'Back in time', rush: 'Steady, Tobias', sleep: '', rogue: 'Yes, Madame' }; if (words[tr.kind]) tag(tr.sec, words[tr.kind]); flash[tr.sec] = now(); },
    onSleep() { zz = now() + 1.5; },
    onWake(sec, self) { if (!self) { sound.blat(); tag(sec, 'BLAAARP!'); } },
    onStall() { sound.cough(); stallShown = now(); },
    onResume() {},
    onFinish(r) { finished(r); },
  };
}
const chaos = () => perf ? Math.max(0, (.45 - perf.mood) * 1.2) : 0;
function shakeHit(b) { if (perf && b % perf.meter === 0) shake = perf.level; }
function judge(b) {
  if (!perf || tut || b < 2) return; const t = now(), st = perf;
  const mk = st.markAt(b), dv = st.level - mk.dyn;
  if (st.lastTq !== undefined && st.lastTq < .45) { const fast = (st.period < st.markedPeriod); feedback = { text: fast ? 'hurrying' : 'dragging', t }; }
  else if (Math.abs(dv) > .24) feedback = { text: dv > 0 ? 'too large' : 'larger', t };
}
function tag(sec, text, bad) { tags.push({ sec, text, t: now(), bad: !!bad }); if (tags.length > 5) tags.shift(); }

function begin(p) {
  intoTheatre(); piece = p; bot = null; tut = null; hideTip(); tags = []; trail = []; confetti = [];
  perf = new Perf(p, hooks()); perf.update(now()); turns.reset();
  curt = 1; curtGoal = 0; mode = 'curtain'; sound.quietClaps(); sound.tuning(2.4); endAt = now() + 2;
  practiced = 0;
  if (AUTO) bot = new Bot(perf, P, { sloppy: .08, slow: .35 });
}
function afterCurtain() {
  const m = perf.meter;
  if (!tut && !AUTO && !DEMO && m !== 2 && !save.seen['m' + m]) { mode = 'practice'; practiced = 0; const w = { 3: ['This one is in three', 'Down, out to the right, up. Round the triangle. Go round it three times to get the feel.'], 4: ['This one is in four', 'Down, across to the left, across to the right, up. Go round the cross three times.'] }[m]; tip(w[0], w[1]); return; }
  if (!tut) readyUp();
}
function readyUp() { mode = 'ready'; tip(piece.title + ', ' + piece.style, 'Your first downstroke starts them. Watch the score for cues.', { auto: 4 }); }

function finished(r) {
  mode = 'bows'; hideTip(); const t = now(); endAt = t + 3.4;
  const prev = save.bq[piece.id]; save.bq[piece.id] = Math.max(prev || 0, r.bouquets); persist();
  sound.applause(.24 + r.total * .9, 4.2);
  for (let i = 0; i < 6 * r.bouquets; i++) confetti.push({ x: R.x + R.w * (.2 + Math.random() * .6), y: R.y + R.h + 20, vx: (Math.random() - .5) * 70, vy: -300 - Math.random() * 190, r: Math.random() * 6, t });
  lastResult = r;
}
let lastResult = null;
function showNotice() {
  const r = lastResult, n = $('notice'), rev = review(piece, r, perf);
  const flow = new Array(r.bouquets).fill(`<img alt="" src="${art.bq}">`).join('');
  const nextP = piece === ENCORE ? null : PROGRAMME[PROGRAMME.indexOf(piece) + 1], allDone = PROGRAMME.every(p => save.bq[p.id] !== undefined);
  const pct = (v) => Math.round(v * 100);
  n.innerHTML = `<div class="paper grain"><div class="mast">The Wickering Courier</div><div class="date">with which is incorporated the Fish Prices Gazette. Price One Penny</div>
    <div class="head">${rev.head}</div><div class="body">${rev.body.map(p => `<p>${p}</p>`).join('')}</div>
    <div class="marks"><div><b>${pct(r.time)}</b>time</div><div><b>${pct(r.dyn)}</b>dynamics</div><div><b>${pct(r.cue)}</b>cues</div><div><b>${pct(r.fix)}</b>order</div></div>
    <div class="toss">${r.bouquets ? flow : 'No bouquets were thrown.'}</div>
    <div class="btns" id="nb"></div></div>`;
  const nb = n.querySelector('#nb'); const add = (cls, txt, fn) => { const b = document.createElement('button'); b.className = cls; b.textContent = txt; b.onclick = fn; nb.append(b); };
  if (nextP) add('big', 'Next: ' + nextP.title, () => begin(nextP));
  else if (piece !== ENCORE && allDone) add('big', 'They want an encore', () => begin(ENCORE));
  add(nextP ? 'plain' : 'big', 'Play it again', () => begin(piece));
  add('plain', 'Programme', showBill);
  n.classList.remove('off'); n.scrollTop = 0; $('menuB').classList.add('off');
}

// ---------- the rehearsal ----------
const STEPS = [
  { title: 'Miss Pettifer, first violin', text: 'Oh, it’s you. Draw down, then up, in the paper below. They play each time your hand turns.', need: 8, kind: 'turns' },
  { title: 'Try it quick, try it slow', text: 'They go where you go. Now follow the red bead: that is the speed the music wants.', need: 8, kind: 'bead' },
  { title: 'Big is loud', text: 'Make your strokes as tall as the card. It grows when the music wants more.', need: 5, kind: 'big' },
  { title: 'Small is soft', text: 'Now tiny strokes. Hardly anything. They will whisper.', need: 5, kind: 'small' },
  { title: 'Stop, and they stop', text: 'Hold still for a moment. They will wait and look at you. Then carry on when you like.', kind: 'stop' },
  { title: 'Cues', text: 'Mr Pym has one note all evening and he is ready now. Point at him: sweep up into the stage, or tap him.', kind: 'cue' },
  { title: 'Trouble', text: 'Young Tobias is rushing, and he’ll bring the rest with him. Point at him too.', kind: 'rush' },
  { title: 'Trouble, slumbering', text: 'And old Mr Gantry has dropped off. Point at the tuba to wake him.', kind: 'sleep' },
  { title: 'That is all we know', text: 'Keep the bead, watch the score, and point at whoever needs you. The doors are open.', kind: 'end' },
];
function beginRehearsal() {
  intoTheatre(); piece = REHEARSAL; bot = null; tags = []; trail = []; hideTip();
  perf = new Perf(REHEARSAL, hooks()); perf.update(now()); turns.reset();
  curt = 1; curtGoal = 0; mode = 'rehearse'; sound.quietClaps(); sound.tuning(2);
  tut = { i: -1, n: 0, t: now() + 1.5, onBeat(b) { tutBeat(b); } };
}
function tutGo(i) {
  tut.i = i; tut.n = 0; const s = STEPS[i]; tut.lv = s.kind === 'big' ? .85 : s.kind === 'small' ? .14 : undefined; tip(s.title, s.text, { skip: true });
  if (s.kind === 'cue') { perf.extra = [{ sec: 'tri', kind: 'cue', ref: { tut: true, beat: 0 } }]; }
  if (s.kind === 'rush') { perf.secs.drum.trouble = { kind: 'rush' }; perf.extra = [{ sec: 'drum', kind: 'rush', ref: { tut: true } }]; }
  if (s.kind === 'sleep') { perf.secs.tuba.asleep = true; zz = now() + 1; perf.extra = [{ sec: 'tuba', kind: 'sleep', ref: { tut: true } }]; }
  if (s.kind === 'end') { tut.t = now() + 3.6; }
}
function tutBeat() {
  const s = STEPS[tut.i]; if (!s) return;
  const lv = perf.level, on = perf.lastTq !== undefined && perf.lastTq > .25;
  if (s.kind === 'turns') tut.n++;
  if (s.kind === 'bead' && on) tut.n++;
  if (s.kind === 'big' && lv > .72) tut.n++;
  if (s.kind === 'small' && lv < .3) tut.n++;
  if (s.need && tut.n >= s.need) tutGo(tut.i + 1);
  if (s.kind === 'stop' && tut.stalled) { tut.stalled = false; tutGo(tut.i + 1); }
}
function tutFrame(t) {
  if (tut.i < 0) { if (t > tut.t) tutGo(0); return; }
  const s = STEPS[tut.i];
  if (s.kind === 'stop' && perf.stalled) tut.stalled = true;
  if (['cue', 'rush', 'sleep'].includes(s.kind) && !(perf.extra || []).length) {
    if (s.kind === 'cue') { sound.note({ sec: 'tri', k: 'ting', m: 96 }, 0, 1, 2); flash.tri = t; perf.secs.tri.lastBig = t; tag('tri', 'Ting.'); }
    if (s.kind === 'rush') tag('drum', 'Steady, Tobias');
    tutGo(tut.i + 1);
  }
  if (s.kind === 'end' && t > tut.t) leaveRehearsal();
}
function leaveRehearsal() { save.rehearsed = true; persist(); tut = null; hideTip(); begin(PROGRAMME.find(p => save.bq[p.id] === undefined) || PROGRAMME[0]); }

// ---------- tips ----------
let tipTimer = 0;
function tip(title, text, { skip, auto } = {}) {
  const e = $('tip'); e.classList.remove('off');
  e.innerHTML = `${skip ? '<button class="skip">skip</button>' : ''}<b>${title}</b>${text}`;
  if (skip) e.querySelector('.skip').onclick = (ev) => { ev.stopPropagation(); leaveRehearsal(); };
  placeTip(); clearTimeout(tipTimer); if (auto) tipTimer = setTimeout(hideTip, auto * 1000);
}
function hideTip() { $('tip').classList.add('off'); }
function placeTip() { const e = $('tip'); e.style.left = (P.x + 8) + 'px'; e.style.width = (P.w - 16) + 'px'; e.style.top = (P.y + 6) + 'px'; }

// ---------- hands ----------
function stageSec(x, y) {
  // whoever is asking for you wins; otherwise nobody
  const reqs = perf ? perf.requests() : []; if (!reqs.length) return null;
  let best = null, bd = 1e9; for (const r of reqs) { const p = art.secPos[r.sec], d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = r.sec; } }
  return best;
}
const inStage = (x, y) => x >= R.x && x < R.x + R.w && y >= R.y && y < R.y + R.h - 4;
const inPad = (x, y) => x >= P.x && x < P.x + P.w && y >= S.y && y < P.y + P.h;
function pointAt(x, y) {
  const s = stageSec(x, y); if (!s || !perf) return;
  const res = perf.point(s, now()); if (res) { flicked = now(); flash[s] = now(); }
}
function feed(x, y, t) {
  trail.push({ x, y, t }); if (trail.length > 90) trail.shift();
  if (mode === 'bill' || mode === 'bows' || mode === 'curtain' || paused) return;
  const c = turns.push(x, y, t); if (c) corner(c);
}
function corner(c) {
  if (mode === 'practice') { sound.tap(.5); flash.beat = now(); practiced++; if (practiced >= perf.meter * 3) { save.seen['m' + perf.meter] = 1; persist(); hideTip(); readyUp(); } return; }
  if (mode === 'ready' || mode === 'rehearse' || mode === 'play') {
    if (mode === 'ready') { if (c.dy < 0 || !inPad(c.x, c.y) || c.len < P.size * .1) return; mode = 'play'; hideTip(); }
    if (mode === 'rehearse' && tut && tut.i < 0) return;
    perf.ictus(now(), { ...c, size: P.size });
  }
}
cv.addEventListener('pointerdown', (e) => {
  e.preventDefault(); sound.init();
  if (inStage(e.clientX, e.clientY)) { pointAt(e.clientX, e.clientY); if (e.pointerType === 'mouse') return; }
  if (!inPad(e.clientX, e.clientY) && e.pointerType !== 'mouse' && conduct !== null) return;
  if (inPad(e.clientX, e.clientY) || conduct === null) { conduct = e.pointerId; turns.reset(); trail.length = 0; feed(e.clientX, e.clientY, e.timeStamp / 1000); }
});
cv.addEventListener('pointermove', (e) => {
  const isMouse = e.pointerType === 'mouse'; if (!isMouse && e.pointerId !== conduct) return;
  const list = e.getCoalescedEvents?.() || [e], l = list.length ? list : [e];
  for (const m of l) feed(m.clientX, m.clientY, m.timeStamp / 1000);
  if (inStage(e.clientX, e.clientY) && e.clientY < R.y + R.h - 14 && now() - flicked > .25) pointAt(e.clientX, e.clientY);
});
const up = (e) => { if (e.pointerId === conduct) conduct = null; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!$('pause').classList.contains('off')) resume(); else if (mode !== 'bill' && $('notice').classList.contains('off')) pause(); return; }
  if (e.repeat || !perf || paused) return;
  const s = SECTIONS.find(x => x.key === e.key); if (s) { if (perf.point(s.id, now())) { flash[s.id] = now(); } return; }
  if (e.code === 'Space') { e.preventDefault(); if (mode === 'ready') { mode = 'play'; hideTip(); } if (mode === 'practice') { corner({}); return; } if (mode === 'play' || mode === 'rehearse') perf.ictus(now(), {}); }
});

// ---------- pause ----------
function pause() { if (paused || !perf) return; paused = true; pauseT = now(); $('pause').classList.remove('off'); sound.ctx?.suspend?.(); }
function resume() { if (!paused) return; paused = false; const d = now() - pauseT; if (perf) { perf.lastIctus += d; perf.now += d; if (perf.hold) perf.hold.until += d; } $('pause').classList.add('off'); sound.ctx?.resume?.(); turns.reset(); }
$('menuB').onclick = pause; $('pResume').onclick = resume;
$('pRestart').onclick = () => { paused = false; $('pause').classList.add('off'); sound.ctx?.resume?.(); tut ? beginRehearsal() : begin(piece); };
$('pQuit').onclick = () => { paused = false; $('pause').classList.add('off'); sound.ctx?.resume?.(); showBill(); };
const soundLabel = () => $('pSound').textContent = 'Sound: ' + (save.sound ? 'on' : 'off');
$('pSound').onclick = () => { save.sound = !save.sound; persist(); sound.setOn(save.sound); soundLabel(); }; soundLabel();
addEventListener('visibilitychange', () => { if (document.hidden && (mode === 'play' || mode === 'rehearse') && !DEMO && !AUTO) pause(); });
addEventListener('resize', () => { resize(); });

// ---------- the picture ----------
const LABEL = { drag: 'dragging', rush: 'rushing', sleep: 'asleep', rogue: 'going rogue' };
function drawStage(t) {
  const O = art.O, sc = piece ? piece.scene : 'prom';
  g.save(); g.beginPath(); g.rect(O.x, O.y, O.w, O.h); g.clip();
  g.drawImage(art.scene(sc), O.x, O.y, O.w, O.h);
  const reqs = perf ? perf.requests() : [];
  const wants = {}; for (const r of reqs) wants[r.sec] = r;
  const hasSolo = piece && piece.pass.some(p => p.parts.solo);
  const stalled = perf && perf.stalled;
  // back row, a plank, then the front row
  for (let i = 0; i < art.figs.length; i++) {
    const f = art.figs[i]; if (f.sec === 'solo' && !hasSolo) continue;
    if (f.id === 'v1') { const y = art.figs[0].y + art.u * .1; paint(g, new Path2D(`M${O.x - 2} ${y}H${O.x + O.w + 2}V${y + art.u * .42}H${O.x - 2}Z`), { fill: '#6b4426', shade: [-9e3, .08, 7, .5], box: [O.x, y, O.x + O.w, y + art.u] }); }
    const s = perf ? perf.secs[f.sec] : null, w = wants[f.sec];
    const ctx = { alarm: stalled || (w && w.kind === 'cue'), cross: w && (w.kind === 'rush'), look: Math.sin(t + f.seed) * .6, nudge: 0 };
    if (w && w.kind === 'drag') ctx.nudge = Math.sin(t * 2) * 1.2;
    drawFig(f, s, t, ctx);
  }
  // footlights' colour falls off with how it's going
  const mood = perf ? perf.mood : .6; const dark = mode === 'bill' ? .45 : Math.max(0, .5 - mood * .62);
  if (dark > .01) { g.fillStyle = `rgba(22,10,26,${dark})`; g.fillRect(O.x, O.y, O.w, O.h); }
  const gl = g.createLinearGradient(0, O.y + O.h, 0, O.y + O.h * .4); gl.addColorStop(0, `rgba(255,190,90,${.08 + mood * .22})`); gl.addColorStop(1, 'rgba(255,190,90,0)'); g.globalCompositeOperation = 'lighter'; g.fillStyle = gl; g.fillRect(O.x, O.y, O.w, O.h); g.globalCompositeOperation = 'source-over';
  // who wants you
  for (const r of reqs) marker(r, t);
  drawTags(t);
  // sleeper's zeds
  if (perf && perf.secs.tuba.asleep) { const p = art.secPos.tuba; g.fillStyle = CREAM; g.strokeStyle = INK; g.lineWidth = 2.4; g.textAlign = 'center'; for (let i = 0; i < 3; i++) { const k = ((t * .5 + i / 3) % 1); g.globalAlpha = 1 - k; g.font = `400 ${12 + k * 12}px "Gravitas One", serif`; const x = p.x + art.u * (.22 + k * .3), y = p.y - art.u * (.5 + k * .7); g.strokeText('z', x, y); g.fillText('z', x, y); } g.globalAlpha = 1; if (t > zz) { zz = t + 3.2; sound.snore(); } }
  for (const c of confetti) { const a = t - c.t, x = c.x + c.vx * a, y = c.y + c.vy * a + 300 * a * a; g.save(); g.translate(x, Math.min(y, O.y + O.h - 8)); g.rotate(c.r + a * 3); const z = art.bqImg; if (z) g.drawImage(z, -14, -18, 28, 36); g.restore(); }
  if (curt > .002) { const y = O.y - (O.h + 10) * (1 - curt); g.drawImage(art.curtain, O.x, y, O.w, O.h + 8); }
  g.restore();
  g.drawImage(art.frame, R.x, R.y, R.w, R.h);
  // patrons
  const pgo = mode === 'bows' && lastResult && lastResult.total > .4;
  for (const p of art.patrons) {
    if (p.leaving) p.gone = Math.min(1, p.gone + .012);
    if (p.gone >= 1) continue;
    const bob = pgo ? Math.abs(Math.sin(t * 7 + p.ph)) * 3 : Math.sin(t * p.rate + p.ph) * .9;
    g.drawImage(p.img, p.x - p.w / 2, p.y - p.h * .46 - bob + p.gone * p.h, p.w, p.h);
  }
  art.drawFrontOfBoxes(g);
  // footlights
  const fy = O.y + O.h, n = Math.max(7, Math.round(O.w / 46));
  for (let i = 0; i < n; i++) {
    const x = O.x + (i + .5) * O.w / n, f = .75 + .25 * Math.sin(t * 9 + i * 2.2), a = .28 + mood * .5;
    g.globalCompositeOperation = 'lighter'; const r = 15 + 8 * mood; const gr = g.createRadialGradient(x, fy - 4, 0, x, fy - 4, r); gr.addColorStop(0, `rgba(255,190,90,${a * f})`); gr.addColorStop(1, 'rgba(255,170,70,0)'); g.fillStyle = gr; g.fillRect(x - r, fy - 4 - r, r * 2, r * 2); g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#ffdc82'; g.beginPath(); g.moveTo(x - 2.4, fy - 2); g.quadraticCurveTo(x - 1, fy - 7 - 3 * f, x, fy - 10 - 3 * f); g.quadraticCurveTo(x + 1, fy - 7 - 3 * f, x + 2.4, fy - 2); g.fill();
    g.fillStyle = '#c79f45'; g.fillRect(x - 6, fy - 2, 12, 4); g.fillStyle = INK; g.fillRect(x - 6, fy + 1, 12, 1.2);
  }
}
function drawFig(f, s, t, ctx) { art.drawFigure(g, f, s, t, ctx); }
function marker(r, t) {
  const p = art.secPos[r.sec], pulse = .5 + .5 * Math.sin(t * 7), u = art.u;
  const x = p.x, y = p.top + u * .12;
  g.save();
  g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, u * .95); gr.addColorStop(0, `rgba(255,214,120,${.2 + .14 * pulse})`); gr.addColorStop(1, 'rgba(255,214,120,0)'); g.fillStyle = gr; g.fillRect(p.x - u, p.y - u, u * 2, u * 2); g.restore();
  const label = r.kind === 'cue' ? (r.late ? 'late!' : SECTIONS.find(s => s.id === r.sec).name) : LABEL[r.kind];
  const fs = Math.max(13, Math.min(17, u * .23)); g.font = `italic 700 ${fs}px "Old Standard TT", serif`; const w = g.measureText(label).width + 12;
  const lx = Math.max(art.O.x + w / 2 + 2, Math.min(art.O.x + art.O.w - w / 2 - 2, x)), ly = Math.max(art.O.y + fs + 22, y - 2);
  art.manicule(g, lx, ly + 4 + pulse * 4, Math.max(.8, u / 62), 0, r.kind === 'cue' ? VERM : '#2c587a');
  g.fillStyle = r.kind === 'cue' ? CREAM : '#f6dfa0'; g.strokeStyle = INK; g.lineWidth = 1; g.fillRect(lx - w / 2, ly + 13, w, fs + 5); g.strokeRect(lx - w / 2, ly + 13, w, fs + 5);
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, lx, ly + 13 + (fs + 6) / 2);
}
function drawTags(t) {
  tags = tags.filter(k => t - k.t < 1.7); const fs = Math.max(14, art.u * .22);
  g.font = `italic 700 ${fs}px "Old Standard TT", serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const k of tags) { const p = art.secPos[k.sec], a = t - k.t; g.globalAlpha = Math.min(1, (1.7 - a) * 3); const w = g.measureText(k.text).width + 14, x = Math.max(art.O.x + w / 2, Math.min(art.O.x + art.O.w - w / 2, p.x)), y = p.y - a * 12; g.fillStyle = k.bad ? '#7c1f22' : CREAM; g.fillRect(x - w / 2, y - fs * .7, w, fs * 1.4); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(x - w / 2, y - fs * .7, w, fs * 1.4); g.fillStyle = k.bad ? CREAM : INK; g.fillText(k.text, x, y + 1); } g.globalAlpha = 1;
}
function drawStrip(t) {
  if (!perf) return; const c = perf.c, m = c.meter, barW = Math.max(84, Math.min(S.w / 4.6, 180)), bw = barW / m, head = S.x + Math.min(70, S.w * .14), p = Math.max(0, perf.started ? perf.pos : 0);
  const X = (b) => head + (b - p) * bw, top = S.y + 10, lh = 4, mid = top + lh * 2;
  g.save(); g.beginPath(); g.rect(S.x, S.y, S.w, S.h); g.clip();
  g.strokeStyle = 'rgba(43,29,20,.55)'; g.lineWidth = .7; g.beginPath(); for (let i = 0; i < 5; i++) { g.moveTo(S.x, top + i * lh); g.lineTo(S.x + S.w, top + i * lh); } g.stroke();
  const b0 = Math.floor(p - (head - S.x) / bw) - 2, b1 = p + (S.x + S.w - head) / bw + 1;
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  for (let b = Math.max(0, b0 - b0 % m); b < Math.min(b1, c.total + 1); b += m) { const x = X(b); g.strokeStyle = INK; g.lineWidth = b === c.total ? 2.4 : 1; g.beginPath(); g.moveTo(x, top); g.lineTo(x, top + lh * 4); g.stroke(); if (b < c.total) { g.font = 'italic 400 11px "Old Standard TT", serif'; g.fillText(b / m + 1, x + 7, top - 2); } }
  for (const e of c.events) { if (!e.mel || e.b < b0 || e.b > b1) continue; const y = Math.max(top - 5, Math.min(top + lh * 5, mid - ((e.m % 24) + (e.m % 24 < 6 ? 12 : 0) - 14) * .9)); g.beginPath(); g.ellipse(X(e.b), y, 3, 2.3, -.4, 0, 6.3); g.fill(); }
  // dynamics under the stave, where they change
  g.font = `italic 700 16px "Old Standard TT", serif`; let prev = null;
  for (let b = 0; b < c.total; b++) { const mk = c.marks[b]; if (mk.dynName !== prev) { prev = mk.dynName; if (b >= b0 && b <= b1) { g.fillStyle = CRIM; g.fillText(mk.dynName, X(b) + 12, top + lh * 4 + 16); } } }
  g.fillStyle = INK; g.font = `italic 400 12.5px "Old Standard TT", serif`;
  for (let b = m; b < c.total; b++) { const a = c.marks[b - m].bpm, d = c.marks[b].bpm; if (b % m === 0 && Math.abs(d - a) / a > .03 && !(c.marks[b - 2 * m] && c.marks[b - 2 * m].bpm > a === a > d && Math.abs(c.marks[b - 2 * m].bpm - a) / a > .02)) { if (b >= b0 && b <= b1) g.fillText(d < a ? 'slower' : 'quicker', X(b) + 44, top + lh * 4 + 15); } }
  for (const f of c.ferm) if (f.beat >= b0 && f.beat <= b1) { g.font = `400 12px "Gravitas One", serif`; g.fillStyle = VERM; g.fillText('hold', X(f.beat) + 18, top - 1); }
  for (const q of c.cues) if (q.beat >= b0 && q.beat <= b1) { g.fillStyle = q.done ? 'rgba(43,29,20,.35)' : VERM; g.font = 'italic 700 12.5px "Old Standard TT", serif'; g.textAlign = 'left'; g.fillText('☞ ' + SECTIONS.find(s => s.id === q.sec).name, X(q.beat) + 2, top + lh * 4 + 30 > S.y + S.h ? top - 1 : top + lh * 4 + 30); g.textAlign = 'center'; }
  g.strokeStyle = VERM; g.lineWidth = 1.6; g.beginPath(); g.moveTo(head, S.y + 2); g.lineTo(head, S.y + S.h - 2); g.stroke();
  g.restore();
}
function drawPad(t) {
  const top = Math.min(P.y, S.y), ph = P.h + S.h; g.drawImage(padCanvas, S.x * DPR, 0, S.w * DPR, ph * DPR, S.x, top, S.w, ph);
  drawStrip(t);
  if (!perf || mode === 'bill') return;
  const m = perf.meter, nodes = PATTERNS[m], b = perf.started ? perf.beat : -1;
  const lv = tut?.lv ?? perf.markAt(b + 1).dyn, s = cardScale(lv) * P.size; perf._s = (perf._s ?? s) + (s - (perf._s ?? s)) * .08; const z = perf._s;
  const nx = (i) => P.cx + nodes[i % m][0] * z, ny = (i) => P.cy + nodes[i % m][1] * z;
  // the card
  g.save(); g.lineCap = 'round'; g.strokeStyle = 'rgba(195,61,39,.55)'; g.lineWidth = 2; g.setLineDash([2, 6]); g.beginPath();
  for (let i = 0; i <= m; i++) { i ? g.lineTo(nx(i), ny(i)) : g.moveTo(nx(i), ny(i)); } g.stroke(); g.setLineDash([]);
  const next = (b + 1) % m, fbeat = now() - (flash.beat ?? -9);
  g.font = `400 13px "Gravitas One", serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < m; i++) { const isN = i === next, r = isN ? 14 : 11; g.fillStyle = isN ? VERM : CREAM; g.strokeStyle = INK; g.lineWidth = 1.2; g.beginPath(); g.arc(nx(i), ny(i), r, 0, 6.3); g.fill(); g.stroke(); g.fillStyle = isN ? CREAM : INK; g.fillText(i + 1, nx(i), ny(i) + .5); }
  // the ink of your hand
  const tt = now(); while (trail.length && tt - trail[0].t > .8) trail.shift();
  for (let i = 1; i < trail.length; i++) { const a = trail[i - 1], c = trail[i], k = 1 - (tt - c.t) / .8; g.strokeStyle = `rgba(43,29,20,${k * .9})`; g.lineWidth = .8 + 3.2 * k * (.4 + perf.level * .7); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(c.x, c.y); g.stroke(); }
  // the bead
  if (perf.started && !perf.finished) {
    const f = perf.beadPhase(t), e = f * f * (3 - 2 * f), i0 = (b + m) % m, x = nx(i0) + (nx(i0 + 1) - nx(i0)) * e, y = ny(i0) + (ny(i0 + 1) - ny(i0)) * e;
    g.fillStyle = perf.hold && t < perf.lastIctus + perf.hold.f.sec ? GOLD : VERM; g.strokeStyle = CREAM; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 7.5, 0, 6.3); g.fill(); g.stroke();
  }
  const words = perf.hold && t < perf.hold.until ? 'hold still' : perf.stalled ? 'they are waiting for you' : (t - feedback.t < 1.1 ? feedback.text : '');
  if (words) { g.fillStyle = CRIM; g.font = `italic 700 ${Math.min(20, P.size * .06)}px "Old Standard TT", serif`; g.fillText(words, P.cx, P.y + P.h - 16); }
  g.restore();
}
function frame() {
  requestAnimationFrame(frame);
  try {
    const t = now();
    if (paused) return;
    if (perf) {
      if (bot) { bot.step(t); const last = trail[trail.length - 1]; if (!last || last.x !== bot.x) { trail.push({ x: bot.x, y: bot.y, t }); if (trail.length > 90) trail.shift(); } if (mode === 'ready') mode = 'play'; }
      const c = turns.idle(t); if (c) corner(c);
      if (mode === 'play' || mode === 'rehearse') perf.update(t);
      if (mode === 'rehearse' && tut) tutFrame(t);
      if (mode === 'curtain' && t > endAt) afterCurtain();
      if (mode === 'play') audience(t);
      if (mode === 'bows' && t > endAt) { if (DEMO) { mode = 'done'; } else { mode = 'notice'; curtGoal = 1; showNotice(); } }
      if (mode === 'bows' && t > endAt - 1.2) curtGoal = 1;
    }
    curt += (curtGoal - curt) * .035; if (Math.abs(curt - curtGoal) < .002) curt = curtGoal;
    render(t);
  } catch (e) { console.error(e); }
}
function audience(t) {
  const m = perf.mood;
  if (m < .5 && t - lastCough > 3 + m * 10) { lastCough = t; sound.cough(); }
  if (m < .36 && t - lastLeave > 6) { lastLeave = t; const left = art.patrons.filter(p => !p.leaving); if (left.length > art.patrons.length * .3) left[Math.random() * left.length | 0].leaving = true; }
}
function render(t) {
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.fillStyle = '#1b0e0b'; g.fillRect(0, 0, W, H);
  if (!piece) piece = PROGRAMME[0];
  drawStage(t); drawPad(t);
}

// a posy, for the bills and the notices
function makeBouquet() {
  const c = mk(68, 88), h = c.getContext('2d'); h.scale(2, 2); h.translate(17, 16);
  paint(h, smooth([[-5, 10], [5, 10], [3, 26], [-3, 26]]), { fill: '#6d8b3d', line: .9 });
  const r = rng(11); for (const [x, y] of [[-8, 4], [8, 4], [0, 6], [-5, -5], [5, -5], [0, -9]]) { paint(h, oval(x, y, 6.2), { fill: r() < .5 ? VERM : '#cc6d7c', line: .9 }); paint(h, oval(x, y, 2.4), { line: .7 }); }
  paint(h, smooth([[-6, 14], [6, 14], [10, 20], [0, 17], [-10, 20]]), { fill: GOLD, line: .9 });
  art.bqImg = c; art.bq = c.toDataURL();
}

async function boot() {
  try { await Promise.race([Promise.all([document.fonts.load('20px "Gravitas One"'), document.fonts.load('italic 700 16px "Old Standard TT"'), document.fonts.load('16px "Old Standard TT"')]), new Promise(r => setTimeout(r, 1800))]); } catch {}
  makeBouquet(); resize(); buildBill();
  if (Q.has('bill')) {}
  if (DEMO) {
    const p = PROGRAMME.find(x => x.id === (Q.get('piece') || 'ode')) || PROGRAMME[5];
    $('bill').classList.add('off'); $('menuB').classList.add('off'); piece = p; perf = new Perf(p, { ...hooks(), onNote() {}, onFinish() { begin(p); } });
    mode = 'play'; curt = 0; curtGoal = 0; bot = new Bot(perf, P, { sloppy: .04, slow: .25, miss: 0 });
    // skip into the thick of it without sound
    const t0 = now() - 60; let tt = t0; while (tt < now() && perf.pos < (+Q.get('bar') || 22) * p.meter) { tt += 1 / 60; bot.step(tt); perf.update(tt); }
    const shift = now() - tt; perf.lastIctus += shift; perf.now += shift; bot.t0 += shift; bot.t1 += shift; if (perf.hold) perf.hold.until += shift; for (const q of bot.pending) q.at += shift; bot.turns.reset(); perf.mood = .86;
  } else if (AUTO) { const p = PROGRAMME.find(x => x.id === Q.get('piece')) || PROGRAMME[0]; begin(p); }
  requestAnimationFrame(frame); window.toyboxReady?.();
}
if (DEBUG || DEMO || AUTO) window.cd = { get perf() { return perf; }, get mode() { return mode; }, get art() { return art; }, get bot() { return bot; }, begin, beginRehearsal, get save() { return save; }, PROGRAMME, ENCORE, showNotice, sound, get R() { return R; }, get P() { return P; }, get tut() { return tut; }, step: (t) => {} };
boot();
