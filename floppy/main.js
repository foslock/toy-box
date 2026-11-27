import { makeScreen, wrap, COLS, ROWS, PAL } from './screen.js';
import { initAudio, sfx, setMuted, isMuted } from './sound.js';
import { DISKS } from './disks.js';
import { PROGRAMS } from './games.js';

const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo'), DEBUG = Q.has('debug');
const $ = (id) => document.getElementById(id);
const canvas = $('scr');
const scr = makeScreen(canvas);
const coarse = matchMedia('(pointer: coarse)').matches;

// ---------- save ----------
const KEY = 'floppy-save';
let save = load();
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch {}
  return { v: 1, played: {}, done: {}, opened: {}, tut: 0, ended: false };
}
function persist() { if (!DEMO) try { localStorage.setItem(KEY, JSON.stringify(save)); } catch {} }

// ---------- state ----------
const st = {
  disk: null,          // disk in the drive
  mode: 'nodisk',      // nodisk | boot | shell | view | run
  sel: 0,              // shell selection
  bootT: 0,
  view: null,          // { file, lines, top }
  prog: null,          // running program
  t: 0,
  hold: false,
};
const held = new Set();

// ---------- the shoebox ----------
const diskEls = {};
function buildBox() {
  const wrapEl = $('disks'); wrapEl.innerHTML = '';
  for (const d of DISKS) {
    const b = document.createElement('button');
    b.className = 'disk'; b.style.background = d.color;
    b.setAttribute('aria-label', `Disk: ${d.label.join(' ')}`);
    b.innerHTML = `<div class="lab" style="color:${d.ink || '#1d1a16'}"><b>${d.label[0]}</b><i>${d.label[1]}</i><i>${d.label[2]}</i></div><div class="tick">✓</div>`;
    b.addEventListener('click', () => pickDisk(d));
    wrapEl.appendChild(b); diskEls[d.id] = b;
  }
  refreshBox();
}
function othersPlayed() { return DISKS.filter((d) => !d.sealed).every((d) => save.played[d.id]); }
function refreshBox() {
  for (const d of DISKS) {
    const el = diskEls[d.id];
    el.classList.toggle('played', !!save.played[d.id]);
    el.classList.toggle('inslot', st.disk === d);
    el.classList.toggle('sealed', !!d.sealed && !save.opened.foryou);
  }
}
function pickDisk(d) {
  initAudio();
  if (st.disk === d) return;
  if (save.tut > 0 && save.tut < 7 && d.id !== 'guess') { note('Start with the oldest one: the disk marked <b>1992</b>.'); wobble(d); return; }
  if (d.sealed && !othersPlayed()) {
    wobble(d);
    const left = DISKS.filter((x) => !x.sealed && !save.played[x.id]).length;
    note(`It's taped shut. Mags wrote <i>play the others first!</i> on it. (${left} to go.)`, 5);
    return;
  }
  if (d.sealed && !save.opened.foryou) { save.opened.foryou = true; persist(); }
  if (st.disk) eject(true);
  insert(d);
}
function wobble(d) { const el = diskEls[d.id]; el.classList.remove('wobble'); void el.offsetWidth; el.classList.add('wobble'); sfx.bad(); }

// ---------- drive ----------
function insert(d) {
  st.disk = d; st.mode = 'boot'; st.bootT = 0; st.sel = 0; st.prog = null; st.view = null;
  sfx.insert(); setTimeout(() => sfx.seek(1.0), 150);
  const slot = $('slot');
  slot.querySelector('.in')?.remove();
  const tab = document.createElement('div'); tab.className = 'in'; tab.style.background = d.color; tab.style.color = d.ink ? d.ink : '#f4eedc';
  tab.textContent = d.id === 'foryou' ? 'FOR THE SQUIRT' : d.label[0]; slot.appendChild(tab);
  $('dled').classList.add('on'); setTimeout(() => $('dled').classList.remove('on'), 1300);
  refreshBox(); tutEvent('insert', d.id); updatePad();
}
function eject(quiet) {
  if (!st.disk) return;
  if (st.prog?.stop) st.prog.stop();
  sfx.engineOff();
  st.disk = null; st.prog = null; st.view = null; st.mode = 'nodisk';
  if (!quiet) sfx.eject();
  $('slot').querySelector('.in')?.remove();
  refreshBox(); tutEvent('eject'); updatePad();
}
$('eject').addEventListener('click', () => { initAudio(); if (st.disk) eject(); else sfx.bad(); });

// ---------- shell / editor ----------
function files() { return st.disk ? st.disk.files : []; }
function openFile(i) {
  const f = files()[i]; if (!f) return;
  sfx.key();
  if (f.kind === 'text') {
    const lines = f.code ? f.text.split('\n').flatMap((l) => wrap(l, 37)) : wrap(f.text, 37);
    st.view = { file: f, lines, top: 0, max: Math.max(0, lines.length - 17) };
    st.mode = 'view'; tutEvent('view', f.name);
    if (st.disk.id === 'foryou' && f.name === 'LATER.TXT') save.readLater = true;
  } else {
    const make = PROGRAMS[f.prog];
    const a = api(st.disk); st.prog = make(a); a.prog = st.prog;
    st.mode = 'run';
    save.played[st.disk.id] = true; persist(); refreshBox();
    tutEvent('run', f.prog);
  }
  updatePad();
}
function closeView() { st.mode = 'shell'; st.view = null; sfx.key(); tutEvent('closeview'); updatePad(); }

function api(disk) {
  return {
    held, sfx, scr, demo: DEMO,
    exit() { if (this.prog && st.prog !== this.prog) return; if (st.prog?.stop) st.prog.stop(); sfx.engineOff(); st.prog = null; st.mode = st.disk ? 'shell' : 'nodisk'; tutEvent('exit', disk.id); updatePad(); },
    done() { if (!save.done[disk.id]) { save.done[disk.id] = true; persist(); } tutEvent('done', disk.id); },
    padChanged() { updatePad(); },
    finale() { showEnding(); },
  };
}

const SHELL_TOP = 6; // first file row
function drawShell() {
  const d = st.disk;
  scr.clear();
  scr.text(0, 0, 'A:\\>DIR', 7);
  scr.text(0, 2, ` Volume in drive A is ${d.vol}`, 7);
  scr.text(0, 3, ' Directory of A:\\', 7);
  const fs = files();
  fs.forEach((f, i) => {
    const [n, e] = f.name.split('.');
    const line = `${n.padEnd(8)} ${e.padEnd(3)} ${f.size.padStart(8)} ${f.date}`;
    const seen = f.kind === 'run' ? save.played[d.id] : save.seen?.[d.id + f.name];
    if (i === st.sel) { scr.fill(0, SHELL_TOP + i, COLS, 1, 7); scr.text(1, SHELL_TOP + i, line, 0); }
    else scr.text(1, SHELL_TOP + i, line, f.kind === 'run' ? 15 : 7);
    if (seen && i !== st.sel) scr.text(37, SHELL_TOP + i, '·', 8);
  });
  scr.text(0, SHELL_TOP + fs.length, `     ${fs.length} file(s)`, 7);
  const cur = (st.t * 2 | 0) % 2 ? '_' : ' ';
  scr.text(0, SHELL_TOP + fs.length + 2, 'A:\\>' + cur, 7);
  const f = fs[st.sel];
  const what = f.kind === 'run' ? 'RUN IT' : 'READ IT';
  scr.fill(0, ROWS - 1, COLS, 1, 1);
  scr.text(1, ROWS - 1, coarse ? `TAP A FILE  ·  ENTER: ${what}` : `\u2191\u2193 PICK  ENTER: ${what}  ESC: EJECT`, 15);
}
function drawView() {
  const v = st.view;
  scr.clear(PAL[1]);
  scr.fill(0, 0, COLS, 1, 7);
  scr.text(Math.max(0, (COLS - v.file.name.length - 4) >> 1), 0, `  ${v.file.name}  `, 0, 7);
  for (let r = 0; r < 17; r++) {
    const l = v.lines[v.top + r]; if (l == null) break;
    const code = v.file.code; let fg = 15;
    if (code && /^\s*(REM|')/.test(l)) fg = 11;
    scr.text(1, 1 + r, l, code ? (fg === 11 ? 11 : 7) : 7);
  }
  // scrollbar
  scr.fill(39, 1, 1, 17, 3);
  if (v.max > 0) scr.fill(39, 1 + Math.round((v.top / v.max) * 16), 1, 1, 7);
  scr.fill(0, ROWS - 2, COLS, 2, 7);
  const end = v.top >= v.max;
  scr.text(1, ROWS - 2, end ? '-- END --' : `LINE ${v.top + 1} OF ${v.lines.length}`, 0);
  scr.text(1, ROWS - 1, coarse ? 'SWIPE OR \u2191\u2193 TO SCROLL  ESC: BACK' : '\u2191\u2193 SCROLL  ESC: BACK', 0);
}
function drawNoDisk() {
  scr.clear();
  scr.text(0, 0, 'HALE FAMILY PC   640K OK', 7);
  scr.text(0, 2, 'C:\\>A:', 7);
  scr.text(0, 4, 'Not ready reading drive A', 7);
  scr.text(0, 5, 'Abort, Retry, Fail?' + (((st.t * 2) | 0) % 2 ? '_' : ' '), 7);
  if (((st.t * 1.2) | 0) % 2 === 0) scr.text(5, 11, 'INSERT A DISK IN DRIVE A:', 14);
  scr.text(3, 13, coarse ? '(tap one in the shoebox)' : '(click one in the shoebox)', 8);
}
function drawBoot() {
  scr.clear();
  const s = 'A:\\>DIR';
  const n = Math.min(s.length, Math.floor(st.bootT * 14));
  scr.text(0, 0, s.slice(0, n) + (n < s.length ? '_' : ''), 7);
  if (st.bootT > 0.7) scr.text(0, 2, ' Reading drive A...', 8);
}

// ---------- input ----------
const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'enter', Escape: 'esc', ' ': 'space', Backspace: 'back',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
function keyName(e) {
  if (KEYMAP[e.key]) return KEYMAP[e.key];
  if (/^[0-9]$/.test(e.key)) return e.key;
  if (/^[yYnN]$/.test(e.key)) return e.key.toLowerCase();
  return null;
}
addEventListener('keydown', (e) => {
  if (!$('title').hidden || !$('ending').hidden) {
    if (e.key === 'Enter' || e.key === ' ') { const b = document.activeElement?.tagName === 'BUTTON' ? document.activeElement : document.querySelector('.card:not([hidden]) .cap'); if (b) { e.preventDefault(); b.click(); } }
    return;
  }
  let k = keyName(e); if (!k) return;
  // in the shell and editor, w/s/a/d are just letters: only arrows move
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  e.preventDefault();
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  initAudio();
  if (e.repeat && held.has(k)) { press(k, true); return; }
  held.add(k); press(k, false);
});
addEventListener('keyup', (e) => { const k = keyName(e); if (k) { held.delete(k); st.prog?.up?.(k); } });
addEventListener('blur', () => { held.clear(); });

function press(k, repeat) {
  if (st.mode === 'nodisk') { if (k === 'enter' || k === 'space') note(coarse ? 'Tap a disk in the shoebox to put it in.' : 'Click a disk in the shoebox to put it in.', 3); return; }
  if (st.mode === 'boot') return;
  if (st.mode === 'shell') {
    const n = files().length;
    if (k === 'up') { st.sel = (st.sel + n - 1) % n; sfx.key(); }
    else if (k === 'down') { st.sel = (st.sel + 1) % n; sfx.key(); }
    else if ((k === 'enter' || k === 'space') && !repeat) openFile(st.sel);
    else if (k === 'esc' && !repeat) eject();
    return;
  }
  if (st.mode === 'view') {
    const v = st.view;
    if (k === 'up') v.top = Math.max(0, v.top - 1);
    else if (k === 'down') v.top = Math.min(v.max, v.top + 1);
    else if (k === 'left') v.top = Math.max(0, v.top - 15);
    else if (k === 'right' || k === 'space') v.top = Math.min(v.max, v.top + 15);
    else if ((k === 'esc' || k === 'enter' || k === 'back') && !repeat) closeView();
    if (v.top >= v.max) markSeen();
    return;
  }
  if (st.mode === 'run' && st.prog) {
    if (k === 'esc' && !repeat && !st.prog.ownEsc) { api(st.disk).exit(); return; }
    st.prog.key?.(k, repeat);
  }
}
function markSeen() {
  const v = st.view; if (!v) return;
  save.seen = save.seen || {}; const id = st.disk.id + v.file.name;
  if (!save.seen[id]) { save.seen[id] = true; persist(); }
}

// pointer on the screen
function toScreen(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 640, (e.clientY - r.top) / r.height * 400]; }
let ptr = null;
canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  canvas.setPointerCapture(e.pointerId);
  const [x, y] = toScreen(e);
  ptr = { id: e.pointerId, x0: x, y0: y, x, y, t0: performance.now(), moved: false, lastY: y };
  if (st.mode === 'run' && st.prog?.pointer) st.prog.pointer('down', x, y);
});
canvas.addEventListener('pointermove', (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  const [x, y] = toScreen(e); ptr.x = x; ptr.y = y;
  if (Math.hypot(x - ptr.x0, y - ptr.y0) > 14) ptr.moved = true;
  if (st.mode === 'view' && ptr.moved) {
    const dy = ptr.lastY - y; const rows = Math.trunc(dy / 20);
    if (rows) { st.view.top = Math.max(0, Math.min(st.view.max, st.view.top + rows)); ptr.lastY -= rows * 20; if (st.view.top >= st.view.max) markSeen(); }
  }
  if (st.mode === 'run' && st.prog?.pointer) st.prog.pointer('move', x, y);
});
function ptrEnd(e) {
  if (!ptr || e.pointerId !== ptr.id) return;
  const [x, y] = toScreen(e); const p = ptr; ptr = null;
  if (st.mode === 'run' && st.prog) {
    if (st.prog.pointer) st.prog.pointer('up', x, y);
    else if (st.prog.swipe && p.moved) {
      const dx = x - p.x0, dy = y - p.y0;
      st.prog.key(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    } else if (!p.moved) st.prog.tap?.(x, y);
    return;
  }
  if (p.moved) return;
  if (st.mode === 'shell') {
    const row = Math.floor(y / 20) - SHELL_TOP;
    if (row >= 0 && row < files().length) { st.sel = row; openFile(row); }
  } else if (st.mode === 'view') {
    if (y > 360) closeView();
  } else if (st.mode === 'nodisk') note(coarse ? 'Tap a disk in the shoebox to put it in.' : 'Click a disk in the shoebox to put it in.', 3);
}
canvas.addEventListener('pointerup', ptrEnd);
canvas.addEventListener('pointercancel', ptrEnd);
canvas.addEventListener('wheel', (e) => {
  if (st.mode !== 'view') return; e.preventDefault();
  st.view.top = Math.max(0, Math.min(st.view.max, st.view.top + Math.sign(e.deltaY) * 2)); if (st.view.top >= st.view.max) markSeen();
}, { passive: false });

// ---------- keypad ----------
const LABEL = { up: '\u25B2', down: '\u25BC', left: '\u25C0', right: '\u25B6', enter: 'ENTER', esc: 'ESC', space: 'SPACE', back: '\u232B', y: 'Y', n: 'N' };
const PADS = {
  none: [],
  shell: [['up', 'down', 'enter']],
  view: [['up', 'down', 'esc']],
  digits: [['1', '2', '3', '4', '5'], ['6', '7', '8', '9', '0'], ['back', 'enter', 'esc']],
  yn: [['y', 'n']],
  choices: [['1', '2', '3', 'esc']],
  arrows: [['left', 'up', 'down', 'right'], ['enter', 'esc']],
  lr: [['left', 'right', 'esc']],
  walk: [['left', 'right', 'enter', 'esc']],
  battle: [['up', 'down', 'enter']],
  any: [['enter', 'esc']],
};
const LEGEND = {
  shell: '\u2191 \u2193 pick a file · Enter open · Esc eject',
  view: '\u2191 \u2193 scroll · Esc back',
  digits: 'type a number · Enter · Esc quit',
  yn: 'Y or N',
  choices: 'press 1, 2 or 3 · Esc quit',
  arrows: 'arrow keys move · Esc quit',
  lr: '\u2190 \u2192 · Esc quit',
  walk: '\u2190 \u2192 walk · Enter look · Esc quit',
  battle: '\u2191 \u2193 pick · Enter',
  any: 'Enter · Esc quit',
  none: '',
};
let padKey = '';
function currentPad() {
  if (st.mode === 'shell') return 'shell';
  if (st.mode === 'view') return 'view';
  if (st.mode === 'run' && st.prog) return typeof st.prog.pad === 'function' ? st.prog.pad() : st.prog.pad;
  return 'none';
}
function updatePad() {
  const name = currentPad() || 'none';
  if (name === padKey) return; padKey = name;
  const pad = $('pad'); pad.innerHTML = '';
  for (const row of PADS[name] || []) {
    const r = document.createElement('div'); r.className = 'row';
    for (const k of row) {
      const b = document.createElement('button'); b.className = 'cap' + (k.length > 2 && !LABEL[k]?.match(/^.$/) ? ' wide' : '');
      b.textContent = LABEL[k] || k; b.dataset.k = k; b.tabIndex = -1;
      b.setAttribute('aria-label', k);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); initAudio(); b.classList.add('down'); held.add(k); press(k, false); sfx.key(); });
      const up = () => { b.classList.remove('down'); if (held.delete(k)) st.prog?.up?.(k); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      r.appendChild(b);
    }
    pad.appendChild(r);
  }
  $('legend').textContent = coarse ? '' : (LEGEND[name] || '');
}

// ---------- pencil note + tutorial ----------
let noteTimer = 0, tutNote = '';
function note(html, secs) {
  const p = $('notep');
  p.innerHTML = html; p.hidden = false;
  noteTimer = secs || 0;
  if (!secs) tutNote = html;
}
function clearNote() { $('notep').hidden = true; tutNote = ''; noteTimer = 0; }
const TUT = [
  null,
  () => `Start with the oldest one. ${coarse ? 'Tap' : 'Click'} the disk marked <b>1992</b> to put it in the drive.`,
  () => `That's everything on the disk. Open <b>README.TXT</b> first: ${coarse ? 'tap it on the screen' : 'click it, or use \u2191 \u2193 and Enter'}.`,
  () => `Mags's notes are half the story. Read to the bottom, then <b>ESC</b> to go back.`,
  () => `Now run <b>GUESS.EXE</b>. (The .BAS file is her code. Worth a look too.)`,
  () => `Type a guess with the ${coarse ? 'number keys' : 'number keys'}, then <b>ENTER</b>.`,
  () => `When you're done with a disk, press <b>EJECT</b> on the drive. Then try the next year.`,
];
function tutEvent(ev, arg) {
  if (DEMO) return;
  const t = save.tut;
  if (t === 1 && ev === 'insert' && arg === 'guess') advance(2);
  else if (t === 2 && ev === 'view' && arg === 'README.TXT') advance(3);
  else if (t === 3 && ev === 'closeview') advance(4);
  else if (t === 4 && ev === 'run' && arg === 'guess') advance(5);
  else if (t === 5 && (ev === 'done' || ev === 'exit')) advance(6);
  else if (t === 6 && ev === 'eject') { save.tut = 7; persist(); clearNote(); note(`Six more disks, 1993 to 2000. The last one is taped shut. Mags wrote <i>play the others first!</i>`, 7); highlight(); }
  else if (t >= 2 && t <= 6 && ev === 'eject') { save.tut = 1; persist(); showTut(); }
  else if (t === 3 && ev === 'view') {}
}
function advance(n) { save.tut = n; persist(); showTut(); }
function showTut() {
  const t = save.tut;
  if (t >= 1 && t <= 6) note(TUT[t]()); else if (t >= 7 && tutNote) clearNote();
  highlight();
}
function highlight() {
  const t = save.tut;
  for (const d of DISKS) diskEls[d.id].classList.toggle('hl', t === 1 && d.id === 'guess');
  $('eject').classList.toggle('hlbox', t === 6);
  $('glass').classList.toggle('hlbox', t >= 2 && t <= 5);
}

// ---------- title & ending ----------
function showTitle() {
  const b = $('titlebtns'); b.innerHTML = '';
  const started = save.tut > 0 || Object.keys(save.played).length;
  const add = (txt, fn) => { const x = document.createElement('button'); x.className = 'cap'; x.textContent = txt; x.addEventListener('click', () => { initAudio(); fn(); }); b.appendChild(x); };
  if (started) { add('CARRY ON', () => { $('title').hidden = true; showTut(); }); add('START OVER', () => { save = load(); localStorage.removeItem(KEY); save = load(); save.tut = 1; persist(); $('title').hidden = true; eject(true); refreshBox(); showTut(); }); }
  else add('LIFT THE LID', () => { save.tut = 1; persist(); $('title').hidden = true; showTut(); });
  $('title').hidden = false;
  setTimeout(() => b.querySelector('.cap')?.focus(), 50);
}
function showEnding() {
  save.ended = true; persist();
  const e = $('endin');
  e.innerHTML = `<h2>The shoebox</h2><p>The last disk spins down. The fan keeps going for a bit, the way it always did.</p><p>Mum's number is on the sticky note. Mags's is in your phone. It's been a while.</p><div class="btns"><button class="cap" id="call">PHONE MAGS</button><button class="cap" id="later">NOT YET</button></div>`;
  $('ending').hidden = false;
  $('call').onclick = () => {
    sfx.tune([440, 0, 440, 0, 0, 440, 0, 440], 0.1, 'sine', 0.04);
    e.innerHTML = `<h2>Ring ring.</h2><p>She picks up on the second ring.</p><p>"You found the shoebox, didn't you."</p><p>You tell her about the lap counter. She laughs so hard she has to put the phone down.</p><p style="text-align:right">THE END</p><p style="font-size:20px">Floppy. Every disk is still in the box if you want to play them again.</p><div class="btns"><button class="cap" id="close">BACK TO THE DESK</button></div>`;
    $('close').onclick = () => { $('ending').hidden = true; };
    $('close').focus();
  };
  $('later').onclick = () => { $('ending').hidden = true; note('Her number is still in your phone. The disk is still in the drive.', 6); };
  setTimeout(() => $('call').focus(), 50);
}

// ---------- mute ----------
$('mute').addEventListener('click', () => { initAudio(); setMuted(!isMuted()); $('mute').textContent = isMuted() ? 'SOUND OFF' : 'SOUND ON'; });

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  if (!st.hold) tick(dt);
  draw();
  requestAnimationFrame(frame);
}
function tick(dt) {
  st.t += dt;
  if (noteTimer > 0) { noteTimer -= dt; if (noteTimer <= 0) { if (tutNote && save.tut < 7) note(tutNote); else $('notep').hidden = true; } }
  if (st.mode === 'boot') { st.bootT += dt; if (st.bootT > 1.15) { st.mode = 'shell'; updatePad(); if (DEMO) demoRun(); } }
  if (st.mode === 'run' && st.prog) { st.prog.tick?.(dt); }
  // keep the pad in step with a program's own modes
  if (st.mode === 'run') updatePad();
}
function draw() {
  if (st.mode === 'nodisk') drawNoDisk();
  else if (st.mode === 'boot') drawBoot();
  else if (st.mode === 'shell') drawShell();
  else if (st.mode === 'view') drawView();
  else if (st.mode === 'run' && st.prog) st.prog.draw(scr);
}

// ---------- start ----------
function demoRun() {
  const i = st.disk.files.findIndex((f) => f.kind === 'run');
  st.sel = i; openFile(i);
}
document.fonts.load('20px VT323').then(() => document.fonts.ready).finally(() => {
  scr.measure();
  buildBox(); updatePad();
  if (DEMO) {
    save = { v: 1, played: { guess: 1, biscuit: 1, maze: 1, turbo: 1 }, done: {}, opened: {}, tut: 7 };
    refreshBox();
    insert(DISKS.find((d) => d.id === (Q.get('disk') || 'sunken')));
  } else if (save.tut === 0 || !Q.has('skip')) {
    if (save.tut === 0) showTitle(); else showTitle();
  }
  requestAnimationFrame(frame);
  window.toyboxReady?.();
});

if (DEBUG || DEMO) window.fl = {
  st, save: () => save, DISKS, insert: (id) => pickDisk(DISKS.find((d) => d.id === id)), open: openFile, press,
  ff(sec, step = 0.05) { for (let t = 0; t < sec; t += step) tick(step); draw(); },
  hold(v = true) { st.hold = v; },
  setSave(s) { save = s; persist(); refreshBox(); },
};
