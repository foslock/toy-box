// Twenty-Seven Rooms: the page. Input, animation, tutorial, cards, saving.
import { VAULTS } from './vaults.js';
import * as M from './game.js';
import { solveFrom } from './solver.js';
import { View } from './render.js';
import { Sound } from './sound.js';
import { laid, inscription, C } from './mosaic.js';

const { RS, MID, DX, DY, DOOR_TILE } = M;
const qs = new URLSearchParams(location.search);
const DEMO = qs.has('demo'), DEBUG = qs.has('debug');
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('cube27.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('cube27.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

const view = new View($('cv'));
const sound = new Sound();
sound.on = store.get('sound', true);
let G = null;
let hold = false;
const STEP = 0.125;                 // seconds per tile
const TURN_T = 1.15;
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ---------------------------------------------------------------- game setup
function newGame(vi) {
  const vault = VAULTS[vi];
  const st = M.newState(vault);
  const g = {
    vi, vault, st, beetles: [], fx: [], anim: null, shake: 0, undo: [], steps: 0, said: new Set(),
    p: { room: st.entry, c: MID, r: MID, fx: MID, fy: MID, face: 2, moving: false, mt: 0, from: [MID, MID], path: [], exitDir: -1, hurt: 0, swing: 0, entry: [MID, MID], bumpT: 0, strike: null },
    onDial: false, onLadder: 0, hintRoom: -1, hintT: 0, won: false,
  };
  enterRoom(g, st.entry, [MID, MID]);
  return g;
}

function enterRoom(g, id, tile) {
  const p = g.p;
  p.room = id; p.c = tile[0]; p.r = tile[1]; p.fx = p.c; p.fy = p.r; p.moving = false; p.path = []; p.exitDir = -1; p.entry = tile.slice();
  spawnBeetles(g);
  updateFlags(g);
}

function spawnBeetles(g) {
  const st = g.st, id = g.p.room, room = st.rooms[id];
  g.beetles = [];
  const special = new Set([MID * RS + MID]);
  for (const f of [M.DIAL, M.KEY]) { const [c, r] = M.featTile(st, id, f); special.add(r * RS + c); }
  const free = [];
  for (let r = 1; r < RS - 1; r++) for (let c = 1; c < RS - 1; c++) {
    if (!M.walkable(st, id, c, r) || special.has(r * RS + c)) continue;
    if (Math.abs(c - g.p.c) + Math.abs(r - g.p.r) < 4) continue;
    free.push([c, r]);
  }
  for (let i = 0; i < room.beetles && free.length; i++) {
    const [c, r] = free.splice((Math.random() * free.length) | 0, 1)[0];
    g.beetles.push({ c, r, fx: c, fy: r, from: [c, r], mt: 1, face: 2, timer: 0.6 + Math.random(), seed: Math.random() * 10 });
  }
}

function updateFlags(g) {
  const st = g.st, p = g.p, room = st.rooms[p.room];
  const [dc, dr] = M.featTile(st, p.room, M.DIAL);
  g.onDial = !!room.dial && p.c === dc && p.r === dr && !p.moving;
  g.onLadder = (p.c === MID && p.r === MID && !p.moving) ? (room.up ? 1 : room.down ? -1 : 0) : 0;
}

// ---------------------------------------------------------------- moves
function tryStep(g, dir) {
  const st = g.st, p = g.p;
  p.face = dir;
  const nc = p.c + DX[dir], nr = p.r + DY[dir];
  if (nc < 0 || nr < 0 || nc >= RS || nr >= RS) {
    const s = M.sideOfDoorTile(p.c, p.r);
    if (s !== dir) return false;
    const dw = M.doorway(st, p.room, s);
    if (dw.kind === 'open') { goThrough(g, dw.to, s); return true; }
    if (dw.kind === 'lockedFar') { tryUnlock(g, dw.to); return false; }
    bump(g, dw.kind === 'wall' ? 'wall' : 'edge');
    return false;
  }
  if (!M.walkable(st, p.room, nc, nr)) {
    if (M.walkable(st, p.room, nc, nr, true)) tryUnlock(g, p.room);
    else p.bumpT = 0.12;
    return false;
  }
  p.from = [p.c, p.r]; p.c = nc; p.r = nr; p.moving = true; p.mt = 0;
  g.steps++;
  sound.step();
  updateFlags(g);
  return true;
}

function bump(g, why) {
  g.p.bumpT = 0.4; g.p.path = []; g.p.exitDir = -1;
  sound.bump(); g.shake = Math.max(g.shake, 0.15);
  if (why === 'wall') say(g, 'wall', 'A blank wall: the room beyond has no door on this side.');
  else say(g, 'edge', 'Only rock out there: this side faces the outside of the cube.');
  tut.ev('bump-' + why);
}

function tryUnlock(g, id) {
  const st = g.st;
  g.p.bumpT = 0.4; g.p.path = [];
  if (st.keys > 0) {
    st.keys--; st.unlocked |= 1 << id;
    sound.unlock(); g.shake = 0.3;
    toast('Unlocked. The key stays in the lock.');
    puff(g, ...M.featTile(st, id, DOOR_TILE[st.rooms[id].lock]), C.gold[1], 10);
    save(); hud();
  } else {
    sound.bump();
    toast('Locked. There’s a key somewhere in the vault; any key fits any lock.');
  }
}

function goThrough(g, to, s) {
  sound.door();
  enterRoom(g, to, DOOR_TILE[(s + 2) & 3]);
  g.anim = { type: 'slide', t: 0, dur: 0.3, dx: DX[s], dy: DY[s] };
  tut.ev('enter');
  save();
}

function arrive(g) {
  const st = g.st, p = g.p, id = p.room, room = st.rooms[id];
  updateFlags(g);
  if (room.key && !(st.keysTaken >> id & 1)) {
    const [kc, kr] = M.featTile(st, id, M.KEY);
    if (p.c === kc && p.r === kr) {
      st.keysTaken |= 1 << id; st.keys++;
      sound.key(); puff(g, kc, kr, C.gold[1], 8);
      toast('A key. Any key fits any lock.');
      tut.ev('key'); hud(); save();
    }
  }
  if (room.treasure && !st.treasure && p.c === MID && p.r === MID) {
    st.treasure = true;
    sound.gold(); g.shake = 0.4; puff(g, MID, MID, C.goldHi, 18);
    toast('The gold tessera! Now carry it out: back to the sunlit room, on the top floor.', 4.5);
    tut.ev('treasure'); hud(); save();
  }
  if (g.onDial) { tut.ev('on-dial'); say(g, 'dial', null); }
  if (g.onLadder) tut.ev('on-ladder');
}

function use(g) {
  if (g.anim || g.won) return;
  if (g.onLadder) return climb(g, g.onLadder);
  strike(g);
}

function climb(g, dir) {
  const st = g.st, p = g.p;
  if (p.moving || g.anim) return;
  const L = M.ladder(st, p.room, dir);
  if (L.kind === 'open') {
    sound.climb();
    g.anim = { type: 'climb', t: 0, dur: 0.55, mid: () => { enterRoom(g, L.to, [MID, MID]); tut.ev(dir > 0 ? 'ascend' : 'descend'); save(); } };
    return;
  }
  if (L.kind === 'sky') {
    if (!st.treasure) { sound.bump(); toast('Daylight above. But not without the gold tessera from the centre room.'); return; }
    sound.climb();
    g.anim = { type: 'climb', t: 0, dur: 0.8, mid: () => win(g) };
    return;
  }
  sound.bump(); g.shake = 0.15;
  const room = st.rooms[p.room];
  if (L.kind === 'edge') toast(dir < 0 ? 'Bedrock below: this is the bottom floor.' : room.entry ? 'The shaft is choked with stone: the sunlit room only reaches the sky from the top floor.' : 'Solid rock above: this is the top floor.', 3.5);
  else toast(dir < 0 ? 'Sealed. The room below has no ladder coming up to meet this trapdoor.' : 'Sealed. The room above has no trapdoor to meet this ladder.', 3.5);
  tut.ev('sealed');
}

function strike(g) {
  const p = g.p;
  if (p.swing > 0) return;
  p.swing = 0.18; sound.swish();
  const tc = p.c + DX[p.face], tr = p.r + DY[p.face];
  for (const b of g.beetles) {
    const bc = Math.round(b.fx), br = Math.round(b.fy);
    if ((bc === tc && br === tr) || (b.c === tc && b.r === tr)) {
      b.dead = true; sound.crunch(); puff(g, b.fx, b.fy, '#2e3a52', 10);
    }
  }
  g.beetles = g.beetles.filter(b => !b.dead);
}

function doTurn(g, dir) {
  if (!g.onDial || g.anim || g.won || g.p.moving) return;
  const st = g.st, p = g.p;
  g.undo.push({ arr: M.cloneArr(st), room: p.room, c: p.c, r: p.r, face: p.face });
  if (g.undo.length > 200) g.undo.shift();
  const L = M.layerOf(st, p.room);
  const from = {}, oriFrom = {};
  for (const cell of M.layerCells(L.axis, L.k)) { const id = st.at[cell]; from[id] = cell; oriFrom[id] = st.ori[id]; }
  const zOld = M.ppos(st.pos[p.room])[2];
  const ids = M.turn(st, L.axis, L.k, dir);
  if (L.axis === 'H') {
    const rot = (c, r) => dir > 0 ? [RS - 1 - r, c] : [r, RS - 1 - c];
    [p.c, p.r] = rot(p.c, p.r); p.fx = p.c; p.fy = p.r; p.entry = rot(...p.entry);
    p.face = (p.face + (dir > 0 ? 1 : 3)) & 3;
    for (const b of g.beetles) { [b.c, b.r] = rot(b.c, b.r); b.fx = b.c; b.fy = b.r; b.mt = 1; b.face = (b.face + (dir > 0 ? 1 : 3)) & 3; }
  }
  const zNew = M.ppos(st.pos[p.room])[2];
  st.turns++;
  p.path = [];
  sound.grind(TURN_T); g.shake = 0.35;
  g.hintRoom = -1;
  g.anim = { type: 'turn', t: 0, dur: TURN_T, axis: L.axis, k: L.k, dir, ids, from, oriFrom, dirScreen: zOld === zNew ? 0.4 : (zOld - zNew),
    done: () => { g.shake = 0.25; updateFlags(g); tut.ev('turn'); if (zOld !== zNew) toast(zNew > zOld ? 'Your room rolled up a floor.' : 'Your room rolled down a floor.'); } };
  hud(); save();
}

function undo(g) {
  if (g.anim || g.won || !g.undo.length) { if (g && !g.undo.length) toast('Nothing to undo yet: undo takes back turns.'); return; }
  const u = g.undo.pop(), st = g.st, p = g.p;
  M.restoreArr(st, u.arr);
  enterRoom(g, u.room, [u.c, u.r]);
  p.face = u.face;
  sound.undo(); g.shake = 0.2;
  g.anim = { type: 'climb', t: 0.25, dur: 0.5 };
  tut.ev('undo'); hud(); save();
}

function win(g) {
  g.won = true;
  sound.win();
  const best = store.get('best', {});
  const prev = best[g.vault.id];
  if (prev == null || g.st.turns < prev) best[g.vault.id] = g.st.turns;
  store.set('best', best);
  store.set('cur', null);
  tut.ev('win');
  const next = VAULTS[g.vi + 1];
  const par = g.vault.par;
  const verdict = g.st.turns <= par ? (g.st.turns < par ? 'Fewer turns than par. The builders would be put out.' : 'In par: not a stone turned that didn’t need turning.') : `Par is ${par}. There’s a shorter way, if you want it.`;
  showCard(`<h2>Out into daylight</h2><p>You climbed out of <b>${g.vault.name}</b> with the gold tessera in <b>${g.st.turns}</b> turn${g.st.turns === 1 ? '' : 's'}.</p><p>${verdict}</p>${next ? '' : '<p>That was the last vault. Every gold tessera is out of the ground.</p>'}`,
    [next ? ['Next vault', () => start(g.vi + 1), 'gold'] : ['All vaults', () => openTitle(), 'gold'], ['Play again', () => start(g.vi), 'alt'], ...(next ? [['All vaults', () => openTitle(), 'alt']] : [])]);
}

// ---------------------------------------------------------------- effects
function puff(g, c, r, col, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 0.8 + Math.random() * 1.6;
    g.fx.push({ x: c, y: r, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, g: 1.2, age: 0, life: 0.5 + Math.random() * 0.4, size: 0.12 + Math.random() * 0.08, col });
  }
}

// ---------------------------------------------------------------- tick
function tick(g, dt) {
  const p = g.p;
  g.shake = Math.max(0, g.shake - dt * 1.6);
  p.hurt = Math.max(0, p.hurt - dt); p.swing = Math.max(0, p.swing - dt); p.bumpT = Math.max(0, p.bumpT - dt);
  if (g.hintT > 0) { g.hintT -= dt; if (g.hintT <= 0) g.hintRoom = -1; }
  for (const f of g.fx) f.age += dt;
  g.fx = g.fx.filter(f => f.age < f.life);
  const A = g.anim;
  if (A) {
    A.t += dt; A.raw = Math.min(1, A.t / A.dur); A.ease = ease(A.raw);
    if (A.type === 'turn' && Math.random() < dt * 30) dust(g);
    if (A.mid && A.raw >= 0.5 && !A.midDone) { A.midDone = true; A.mid(); }
    if (A.raw >= 1) { g.anim = null; A.done && A.done(); }
    return;
  }
  if (g.won) return;
  // player
  if (p.moving) {
    p.mt += dt / STEP;
    if (p.mt >= 1) { p.moving = false; p.fx = p.c; p.fy = p.r; arrive(g); }
    else { p.fx = p.from[0] + (p.c - p.from[0]) * p.mt; p.fy = p.from[1] + (p.r - p.from[1]) * p.mt; }
  }
  if (!p.moving && !g.anim && p.bumpT <= 0) {
    // a tap moves one tile; holding repeats after a short beat
    let dir = -1;
    if (tapDir >= 0) { dir = tapDir; tapDir = -1; }
    else if (held.length && performance.now() - held[held.length - 1].t > 190) dir = held[held.length - 1].d;
    if (dir >= 0) { p.path = []; p.exitDir = -1; p.strike = null; tryStep(g, dir); }
    else if (p.path.length) {
      const [nc, nr] = p.path[0];
      const d = [0, 1, 2, 3].find(s => p.c + DX[s] === nc && p.r + DY[s] === nr);
      if (d == null || !tryStep(g, d)) { p.path = []; } else p.path.shift();
    } else if (p.exitDir >= 0) { const d = p.exitDir; p.exitDir = -1; tryStep(g, d); }
    else if (p.strike) {
      const b = p.strike; p.strike = null;
      if (g.beetles.includes(b)) {
        const d = [0, 1, 2, 3].find(s => p.c + DX[s] === b.c && p.r + DY[s] === b.r);
        if (d != null) { p.face = d; strike(g); }
      }
    }
  }
  // beetles
  for (const b of g.beetles) {
    if (b.mt < 1) { b.mt = Math.min(1, b.mt + dt / 0.32); b.fx = b.from[0] + (b.c - b.from[0]) * b.mt; b.fy = b.from[1] + (b.r - b.from[1]) * b.mt; continue; }
    b.timer -= dt;
    if (b.timer > 0) continue;
    b.timer = 0.35 + Math.random() * 0.6;
    const dirs = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    const near = Math.abs(b.c - p.c) + Math.abs(b.r - p.r) < 5;
    if (near && Math.random() < 0.45) dirs.sort((a, c) => (Math.abs(b.c + DX[a] - p.c) + Math.abs(b.r + DY[a] - p.r)) - (Math.abs(b.c + DX[c] - p.c) + Math.abs(b.r + DY[c] - p.r)));
    for (const d of dirs) {
      const nc = b.c + DX[d], nr = b.r + DY[d];
      if (nc < 1 || nr < 1 || nc > RS - 2 || nr > RS - 2) continue;
      if (!M.walkable(g.st, p.room, nc, nr) || (nc === MID && nr === MID)) continue;
      if (g.beetles.some(o => o !== b && o.c === nc && o.r === nr)) continue;
      b.from = [b.c, b.r]; b.c = nc; b.r = nr; b.mt = 0; b.face = d;
      break;
    }
  }
  // nips
  if (p.hurt <= 0) {
    for (const b of g.beetles) {
      if (Math.abs(b.fx - p.fx) < 0.6 && Math.abs(b.fy - p.fy) < 0.6) { nip(g); break; }
    }
  }
}

function nip(g) {
  const p = g.p;
  sound.nip(); g.shake = 0.5;
  puff(g, p.fx, p.fy, C.red, 8);
  p.c = p.entry[0]; p.r = p.entry[1]; p.fx = p.c; p.fy = p.r; p.moving = false; p.path = []; p.exitDir = -1;
  p.hurt = 1.3;
  updateFlags(g);
  say(g, 'nip', 'Nipped! You scurry back to where you came in. Swat beetles: face one and press Space, or tap it.');
}

function dust(g) {
  const c = Math.random() * RS, r = Math.random() * RS;
  g.fx.push({ x: c, y: -1, vx: 0, vy: 0, g: 3 + Math.random() * 3, age: 0, life: 0.9, size: 0.08 + Math.random() * 0.06, col: C.lime[(Math.random() * 4) | 0] });
}

// ---------------------------------------------------------------- input
const held = [];   // {d, t}: arrow keys down, newest last
let tapDir = -1;   // a press not yet walked (buffered while a step finishes)
const KEYDIR = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  sound.init(); sound.resume();
  const cardUp = !$('card').hidden || !$('title').hidden;
  if (cardUp) {
    if (e.code === 'Escape' && !$('card').hidden && G && cardClosable) { closeCard(); e.preventDefault(); }
    // Enter / Space press the focused button (or the card's first) exactly once
    if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') && !e.repeat) {
      e.preventDefault();
      const box = !$('card').hidden ? $('card') : $('title');
      const a = document.activeElement;
      const b = (a && a.tagName === 'BUTTON' && box.contains(a)) ? a : box.querySelector('#cardBtns .btn, .vault:not(:disabled)');
      b && b.click();
    }
    return;
  }
  if (!G) return;
  const d = KEYDIR[e.code];
  if (d != null) { e.preventDefault(); if (!e.repeat && !held.some(h => h.d === d)) { held.push({ d, t: performance.now() }); tapDir = d; } return; }
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); use(G); }
  else if (e.code === 'KeyQ') doTurn(G, -1);
  else if (e.code === 'KeyE') doTurn(G, 1);
  else if (e.code === 'KeyZ' || e.code === 'Backspace' || e.code === 'KeyU') { e.preventDefault(); undo(G); }
  else if (e.code === 'KeyH') hint();
  else if (e.code === 'KeyM') toggleSound();
  else if (e.code === 'Escape') openTitle();
});
addEventListener('keyup', (e) => { const d = KEYDIR[e.code]; if (d != null) { const i = held.findIndex(h => h.d === d); if (i >= 0) held.splice(i, 1); } });
addEventListener('blur', () => { held.length = 0; });

$('cv').addEventListener('pointerdown', (e) => {
  sound.init(); sound.resume();
  if (!G || G.won) return;
  e.preventDefault();
  const R = view.room;
  if (e.clientX < R.x || e.clientY < R.y || e.clientX > R.x + R.size || e.clientY > R.y + R.size) return;
  tapRoom(G, ...view.tileAt(e.clientX, e.clientY));
});

function tapRoom(g, c, r) {
  if (g.anim) return;
  const st = g.st, p = g.p, id = p.room;
  // outside the room: a doorway beyond the wall
  if (c < 0 || r < 0 || c >= RS || r >= RS) {
    let s = -1;
    if (r < 0 && Math.abs(c - MID) <= 1) s = 0; else if (c >= RS && Math.abs(r - MID) <= 1) s = 1; else if (r >= RS && Math.abs(c - MID) <= 1) s = 2; else if (c < 0 && Math.abs(r - MID) <= 1) s = 3;
    if (s < 0) return;
    c = DOOR_TILE[s][0]; r = DOOR_TILE[s][1];
  }
  // a beetle: walk next to it and swat
  const b = g.beetles.find(b => b.c === c && b.r === r) || g.beetles.find(b => Math.round(b.fx) === c && Math.round(b.fy) === r);
  if (b) {
    const adj = Math.abs(b.c - p.c) + Math.abs(b.r - p.r) === 1;
    if (adj && !p.moving) { p.face = [0, 1, 2, 3].find(s => p.c + DX[s] === b.c && p.r + DY[s] === b.r); strike(g); return; }
    let best = null;
    for (let s = 0; s < 4; s++) {
      const tc = b.c + DX[s], tr = b.r + DY[s];
      if (!M.walkable(st, id, tc, tr)) continue;
      const path = M.pathTo(st, id, [p.c, p.r], [tc, tr]);
      if (path && (!best || path.length < best.length)) best = path;
    }
    if (best) { p.path = best; p.exitDir = -1; p.strike = b; }
    return;
  }
  // your own tile: climb if it's a ladder
  if (c === p.c && r === p.r && !p.moving) {
    if (g.onLadder) climb(g, g.onLadder);
    else { const s = M.sideOfDoorTile(c, r); if (s >= 0) tryStep(g, s); }
    return;
  }
  const s = M.sideOfDoorTile(c, r);
  const path = M.pathTo(st, id, [p.c, p.r], [c, r]);
  if (!path) { return; }
  p.path = path; p.strike = null;
  p.exitDir = s >= 0 && st.rooms[id].doors[M.localSide(st, id, s)] ? s : -1;
  // a locked door tile can't be stood on: stop beside it and try the lock
  const last = path[path.length - 1];
  if (!M.walkable(st, id, last[0], last[1])) { path.pop(); p.exitDir = -1; p.unlockAfter = true; }
  if (!path.length && p.unlockAfter) { p.unlockAfter = false; tryUnlock(g, id); }
}

// ---------------------------------------------------------------- buttons
$('turnL').onclick = () => G && doTurn(G, -1);
$('turnR').onclick = () => G && doTurn(G, 1);
$('undoBtn').onclick = () => G && undo(G);
$('climbBtn').onclick = () => G && G.onLadder && climb(G, G.onLadder);
$('hintBtn').onclick = () => hint();
$('soundBtn').onclick = () => toggleSound();
$('menuBtn').onclick = () => openTitle();
for (const id of ['turnL', 'turnR', 'undoBtn', 'climbBtn', 'hintBtn', 'soundBtn', 'menuBtn']) $(id).addEventListener('pointerdown', () => { sound.init(); sound.resume(); });
// a click on a button shouldn't leave it focused for Space to press again
document.addEventListener('click', (e) => { const b = e.target.closest('#hud button, #bar button'); if (b) b.blur(); });

function toggleSound() {
  sound.init(); sound.setOn(!sound.on); store.set('sound', sound.on);
  $('soundBtn').classList.toggle('off', !sound.on); $('waves').style.display = sound.on ? '' : 'none';
}

let hinting = false;
function hint() {
  if (!G || G.anim || G.won || hinting) return;
  hinting = true;
  toast('Studying the floor plan…', 6);
  // let the toast paint before the search (the deep vault takes a moment)
  setTimeout(() => { hinting = false; giveHint(); }, 60);
}
function giveHint() {
  if (!G || G.anim || G.won) return;
  const st = G.st;
  const r = solveFrom(st, G.p.room, 400000);
  if (!r.ok) { toast('This arrangement is a long way round. Undo a few turns and look at the map again.'); return; }
  const m = r.route[0];
  if (!m) {
    toast(st.treasure ? 'No more turns needed. Walk back to the sunlit room and climb out.' : 'No turns needed from here: everything you need is within walking distance.', 4);
    return;
  }
  if (m.unlock != null) { toast('Use a key: walk into the locked grate (gold bars on the map).', 4); return; }
  G.hintRoom = m.dial; G.hintT = 8;
  const name = m.axis === 'H' ? 'spins its floor' : m.axis === 'X' ? 'rolls its north–south slice' : 'rolls its east–west slice';
  toast(`${m.dial === G.p.room ? 'This room’s' : 'The flashing room’s'} turnstone ${name}. Turn it ${m.dir > 0 ? '↻' : '↺'}. ${r.turns} turn${r.turns === 1 ? '' : 's'} to go.`, 5);
}

// ---------------------------------------------------------------- HUD
const keySvg = '<i><svg viewBox="0 0 14 18"><circle cx="7" cy="5" r="3.6" fill="#d6a62a" stroke="#2b211c" stroke-width="1.6"/><rect x="5.9" y="8" width="2.4" height="9" fill="#d6a62a" stroke="#2b211c" stroke-width="1.2"/><rect x="8" y="12" width="3" height="2" fill="#2b211c"/></svg></i>';
const gemSvg = '<i style="width:18px"><svg viewBox="0 0 18 18"><path d="M9 1 17 9 9 17 1 9z" fill="#f3d77a" stroke="#2b211c" stroke-width="1.6"/><path d="M9 5 13 9 9 13" fill="none" stroke="#c8961f" stroke-width="1.4"/></svg></i>';
function hud() {
  if (!G) return;
  const v = G.vault;
  $('vname').innerHTML = `<span>${v.numeral}</span><em class="long" style="font-style:normal">${v.name}</em>`;
  // Alegreya's old-style zero reads as a letter o, so say "no turns" instead
  const n = G.st.turns;
  $('turns').innerHTML = n === 0 ? `<b>No</b> turns yet <small>· par ${v.par}</small>` : `<b>${n}</b> turn${n === 1 ? '' : 's'} <small>· par ${v.par}</small>`;
  $('carry').innerHTML = keySvg.repeat(G.st.keys) + (G.st.treasure ? gemSvg : '');
}
let lastBar = '';
function bar() {
  if (!G) return;
  const busy = !!G.anim || G.won;
  const L = G.onLadder;
  const key = `${G.onDial}|${L}|${busy}|${G.undo.length > 0}|${tut.hotKey()}`;
  if (key === lastBar) return; lastBar = key;
  $('turnL').disabled = $('turnR').disabled = !G.onDial || busy;
  $('climbBtn').disabled = !L || busy;
  $('climbIc').textContent = L < 0 ? '▼' : '▲';
  $('climbTx').textContent = L < 0 ? 'Climb down' : 'Climb';
  const room = G.st.rooms[G.p.room];
  const t = room.dial;
  $('turnL').title = t === 'H' ? 'Spin this floor anticlockwise (Q)' : 'Roll this slice one way (Q)';
  $('turnR').title = t === 'H' ? 'Spin this floor clockwise (E)' : 'Roll this slice the other way (E)';
  const hot = tut.hotKey();
  for (const id of ['turnL', 'turnR', 'climbBtn', 'undoBtn']) $(id).classList.toggle('hot', hot === id || (hot === 'turn' && (id === 'turnL' || id === 'turnR')));
}

let toastTimer = 0;
function toast(msg, secs = 2.8) {
  const t = $('toast'); t.innerHTML = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), secs * 1000);
}
function say(g, key, msg) { if (g.said.has(key)) return; g.said.add(key); if (msg) toast(msg, 4); }

// ---------------------------------------------------------------- tutorial (Vault I)
const tut = {
  on: false, i: 0, steps: [],
  start() {
    this.on = true; this.i = 0;
    this.f = {};
    const low = (g) => M.ppos(g.st.pos[g.p.room])[2] < 2 || this.f.descend;
    const turned = () => this.f.turn;
    this.steps = [
      { t: 'Walk with the arrow keys or <kbd>WASD</kbd>, or tap a floor tile to walk there.', touch: 'Tap a floor tile to walk there.',
        done: (g, f) => g.steps >= 4 || f.enter || turned() },
      { t: 'Doorways only join when the room beyond has a door facing back. Try the <b>east</b> doorway: you can see a wall through it.',
        done: (g, f) => f['bump-wall'] || f['bump-edge'] || f.enter || turned() },
      { t: 'Below is the map: all 27 rooms, floor by floor. You’re the blinking room. Pale bridges are doorways that join. <b>▲</b> is a ladder up, <b>▼</b> a trapdoor down; they turn gold when they meet.', next: true,
        done: (g) => low(g) },
      { t: 'The room to the <b>south</b> has a trapdoor (▼). Stand on it and press <kbd>Space</kbd>, or tap it again.', touch: 'The room to the <b>south</b> has a trapdoor (▼). Stand on it and tap it again, or press <b>Climb</b>.',
        done: (g, f) => f.sealed || turned() || low(g), hot: 'climbBtn' },
      { t: 'Sealed: no ladder comes up beneath it. The floors have to line up. Go back north and stand on the blue <b>turnstone</b>.',
        done: (g, f) => f['on-dial'] || g.onDial || turned() || low(g) },
      { t: 'A turnstone spins this whole floor: nine rooms, you included. Press <kbd>E</kbd> or <b>↻</b> to turn clockwise, and watch the map.', touch: 'A turnstone spins this whole floor: nine rooms, you included. Tap <b>↻</b> to turn it clockwise, and watch the map.',
        done: (g) => turned() || low(g), hot: 'turn' },
      { t: 'Did the trapdoor room land on top of a ladder? Its ▼ on the map turns gold. If not, <b>Undo</b> (<kbd>Z</kbd>) or turn again. Then climb down.', touch: 'Did the trapdoor room land on top of a ladder? Its ▼ on the map turns gold. If not, tap <b>Undo</b> or turn again. Then climb down.',
        done: (g) => low(g), hot: 'undoBtn' },
      { t: 'The middle floor. The gold tessera is in the centre room, behind a locked grate. A key lies nearby. <b>Beetles</b> nip: face one and press <kbd>Space</kbd>, or tap it.', touch: 'The middle floor. The gold tessera is in the centre room, behind a locked grate. A key lies nearby. <b>Beetles</b> nip: tap one to swat it.',
        done: (g) => g.st.keys > 0 || g.st.unlocked || g.st.treasure },
      { t: 'You have a key. Walk into the grate on the centre room’s door to open it, and take the gold.', done: (g) => g.st.treasure },
      { t: 'Now carry it out: back up the ladder to the sunlit room, and climb into the daylight. Its shaft only reaches the sky from the top floor.', done: (g, f) => f.win },
    ];
    this.render();
  },
  stop() { this.on = false; $('coach').hidden = true; layout(); },
  hotKey() { return this.on && this.steps[this.i] ? this.steps[this.i].hot || '' : ''; },
  ev(e) {
    if (!this.on || !G) return;
    if (e) this.f[e] = true;
    let moved = false;
    for (;;) {
      const s = this.steps[this.i];
      if (!s) break;
      if (s.done && s.done(G, this.f)) { this.i++; moved = true; continue; }
      break;
    }
    if (this.i >= this.steps.length) { store.set('tut', 1); this.stop(); return; }
    if (moved) this.render();
  },
  next() { this.i++; this.ev(null); this.render(); },
  // events that count: anything the steps look at
  render() {
    const s = this.steps[this.i]; if (!s) return;
    const touch = matchMedia('(pointer: coarse)').matches;
    const text = touch && s.touch ? s.touch : s.t;
    $('coach').innerHTML = `<div class="step"><span>Lesson ${this.i + 1} of ${this.steps.length}</span><a id="skipTut">skip lesson</a></div><div>${text}</div>` + (s.next ? '<div class="row"><button class="btn" id="tutNext">Got it</button></div>' : '');
    $('coach').hidden = false;
    $('skipTut').onclick = () => { store.set('tut', 1); this.stop(); };
    if (s.next) $('tutNext').onclick = () => this.next();
    lastBar = '';
    layout();
  },
};

// ---------------------------------------------------------------- cards
let cardClosable = false;
function showCard(html, btns, closable = false) {
  $('cardBody').innerHTML = html;
  const box = $('cardBtns'); box.innerHTML = '';
  for (const [label, fn, kind] of btns) {
    const b = document.createElement('button'); b.className = 'btn' + (kind ? ' ' + kind : ''); b.textContent = label;
    b.onclick = (e) => { e.preventDefault(); closeCard(); fn(); };
    box.appendChild(b);
  }
  cardClosable = closable;
  $('card').hidden = false;
  setTimeout(() => box.firstChild && box.firstChild.focus(), 30);
}
function closeCard() { $('card').hidden = true; }

const INTRO = {
  ii: '<h2>Two turnstones</h2><p>One on the top floor and one at the very bottom. A spin never changes the doors <i>within</i> a floor, only which ladders and trapdoors line up with the floors above and below.</p><p>Watch the ▲ and ▼ on the map.</p>',
  iii: '<h2>New: the mill wheel</h2><p>A turnstone marked <b>↕</b> doesn’t spin its floor. It <b>rolls</b> its north–south slice of the cube, like a mill wheel: nine rooms go round, top to front to bottom. Rooms stay level, but change floors, and doors meet new neighbours.</p><p>The map shows the slice it will roll when you stand on it.</p>',
  iv: '<h2>New: the cross wheel</h2><p>A turnstone marked <b>↔</b> rolls its <b>east–west</b> slice. Three kinds of turnstone now, and where each one sits decides which layer it moves.</p>',
  v: '<h2>The deep vault</h2><p>Four turnstones, two keys, two locks. Any key fits any lock, so spend them wisely. <kbd>H</kbd> or <b>?</b> gives a hint if you need one.</p>',
};

function start(vi, resume) {
  tapDir = -1; held.length = 0;
  G = newGame(vi);
  if (resume) {
    M.restoreArr(G.st, resume.arr);
    enterRoom(G, resume.room, [resume.c, resume.r]);
    G.undo = resume.undo || [];
  }
  $('title').hidden = true;
  closeCard();
  tut.on = false; $('coach').hidden = true;
  if (G.vault.id === 'i' && !resume) tut.start();
  layout(); hud(); lastBar = ''; bar();
  if (!resume && INTRO[G.vault.id]) showCard(INTRO[G.vault.id], [['Down we go', () => {}, 'gold']], true);
  save();
}

function save() {
  if (!G || DEMO || G.won) return;
  const p = G.p;
  const undoLite = G.undo.slice(-30).map(u => ({ ...u, arr: { ...u.arr, at: [...u.arr.at], pos: [...u.arr.pos], ori: [...u.arr.ori] } }));
  const a = M.cloneArr(G.st);
  store.set('cur', { v: G.vault.id, arr: { ...a, at: [...a.at], pos: [...a.pos], ori: [...a.ori] }, room: p.room, c: p.c, r: p.r, undo: undoLite });
}
function loadCur() {
  const c = store.get('cur', null);
  if (!c) return null;
  const vi = VAULTS.findIndex(v => v.id === c.v);
  if (vi < 0) return null;
  const fix = (a) => ({ ...a, at: Int8Array.from(a.at), pos: Int8Array.from(a.pos), ori: Int8Array.from(a.ori) });
  return { vi, arr: fix(c.arr), room: c.room, c: c.c, r: c.r, undo: (c.undo || []).map(u => ({ ...u, arr: fix(u.arr) })) };
}

function drawTitleArt() {
  const cv = $('titleArt'), w = cv.clientWidth || 440;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const bmA = inscription('TWENTY-SEVEN', 1, C.terra[0]);
  const bmB = inscription('ROOMS', 2, C.lapis[0]);
  const cols = Math.max(bmA.w, bmB.w) + 8;
  const s = w / cols;
  const rows = bmA.h + bmB.h + 8;
  cv.width = Math.round(w * dpr); cv.height = Math.round(rows * s * dpr);
  cv.style.height = rows * s + 'px';
  const x = cv.getContext('2d');
  // a lime bed of stones with an ink border and a running ochre band
  const bed = { w: cols, h: rows, px: [] };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const e = Math.min(i, j, cols - 1 - i, rows - 1 - j);
    bed.px.push(e === 0 ? C.ink : e === 1 ? ((((i + j) / 2) | 0) % 2 ? C.ochre[0] : C.terra[2]) : C.lime[(i * 7 + j * 3) % 4]);
  }
  x.drawImage(laid(bed, s * dpr, 9), 0, 0);
  x.drawImage(laid(bmA, s * dpr, 3), Math.round((cols - bmA.w) / 2) * s * dpr, 3 * s * dpr);
  x.drawImage(laid(bmB, s * dpr, 4), Math.round((cols - bmB.w) / 2) * s * dpr, (5 + bmA.h) * s * dpr);
}

function openTitle() {
  if (G && G.anim) return;
  const best = store.get('best', {});
  const cur = loadCur();
  const box = $('vaults'); box.innerHTML = '';
  VAULTS.forEach((v, i) => {
    const open = i === 0 || best[VAULTS[i - 1].id] != null || DEBUG;
    const b = document.createElement('button'); b.className = 'vault'; b.disabled = !open;
    const resumeHere = cur && cur.vi === i;
    const sub = i === 0 ? 'The lesson: one turnstone' : v.id === 'ii' ? 'Two turnstones' : v.id === 'iii' ? 'The mill wheel' : v.id === 'iv' ? 'The cross wheel' : 'Four turnstones, two keys';
    b.innerHTML = `<span class="num">${v.numeral}</span><span><b>${v.name}</b><small>${resumeHere ? 'Carry on where you left off' : open ? sub : 'Climb out of the vault before'}</small></span><span class="best">${best[v.id] != null ? `best ${best[v.id]}<br><small>par ${v.par}</small>` : `par ${v.par}`}</span>`;
    b.onclick = () => { sound.init(); sound.resume(); start(i, resumeHere ? cur : null); };
    box.appendChild(b);
  });
  $('title').hidden = false;
  closeCard();
  requestAnimationFrame(drawTitleArt);
  setTimeout(() => { const f = box.querySelector('.vault:not(:disabled) .num') && [...box.children].filter(b => !b.disabled).pop(); f && f.focus(); }, 30);
}

// ---------------------------------------------------------------- layout
function layout() {
  const W = innerWidth, H = innerHeight;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const top = (parseFloat(getComputedStyle($('hud')).height) || 52) + 4;
  const coach = $('coach');
  const coachOn = !coach.hidden;
  const portrait = W / H < 1.05;
  view.resize(W, H, dpr, portrait);
  const barEl = $('bar');
  const barH = 66;
  let room, map;
  if (portrait) {
    let coachH = 0;
    if (coachOn) { coach.style.width = Math.min(W - 20, 520) + 'px'; coach.style.left = (W - Math.min(W - 20, 520)) / 2 + 'px'; coach.style.top = top + 'px'; coach.style.bottom = 'auto'; coachH = coach.offsetHeight + 6; }
    const u = Math.min((W - 40) / 9.6, 48);
    const mapH = u * 3 + 30;
    const avail = H - top - coachH - barH - mapH - 14;
    const size = Math.max(160, Math.min(W - 4, avail));
    const spare = Math.max(0, avail - size);
    room = { x: (W - size) / 2, y: top + coachH + spare * 0.4, size };
    const mapW = u * 9 + 2 * u * 0.6;
    map = { x: (W - mapW) / 2, y: room.y + size + 6, u, gap: u * 0.6, vertical: false };
    barEl.style.left = '0'; barEl.style.right = '0'; barEl.style.top = 'auto';
    barEl.style.bottom = `max(8px, env(safe-area-inset-bottom))`;
  } else {
    // keep the room's walls clear of the top bar: only its empty outer ring may sit under it
    const size = Math.min(H - 8, W * 0.6, (H - top) * 1.1);
    room = { x: Math.max(0, (W * 0.6 - size) / 2), y: Math.max((H - size) / 2, H - size - 4), size };
    const cx0 = room.x + size + 12, cw = W - cx0 - 12;
    let coachH = 0;
    if (coachOn) { coach.style.width = cw + 'px'; coach.style.left = cx0 + 'px'; coach.style.top = top + 'px'; coach.style.bottom = 'auto'; coachH = coach.offsetHeight + 8; }
    const availH = H - top - coachH - barH - 20;
    const uh = Math.min((cw - 10) / 10.4, (availH - 26) / 3, 56);
    const uv = Math.min((cw - 30) / 3, (availH - 10) / 10.4, 56);
    let mapW, mapH;
    if (uv > uh * 1.15) {
      map = { u: uv, gap: uv * 0.7, vertical: true };
      mapW = uv * 3; mapH = uv * 9 + 2 * map.gap;
      map.x = cx0 + (cw - mapW) / 2 + 10;
    } else {
      map = { u: uh, gap: uh * 0.7, vertical: false };
      mapW = uh * 9 + 2 * map.gap; mapH = uh * 3 + 24;
      map.x = cx0 + (cw - mapW) / 2;
    }
    map.y = top + coachH + Math.max(6, (availH - mapH) / 2);
    barEl.style.left = cx0 + 'px'; barEl.style.right = 'auto'; barEl.style.width = cw + 'px';
    barEl.style.top = 'auto'; barEl.style.bottom = `max(10px, env(safe-area-inset-bottom))`;
  }
  view.setRects(room, map);
  // toast floats over the room's lower wall, clear of the doorway peeks above
  $('toast').style.top = 'auto';
  $('toast').style.bottom = Math.max(barH + 8, H - (room.y + room.size) + view.tile * 0.6) + 'px';
}
addEventListener('resize', () => layout());

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  if (G && !hold) { tick(G, dt); if (tut.on) tut.ev(null); }
  if (G) { view.draw(G, now / 1000); bar(); }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- demo / boot
function demo() {
  // Vault III after its first roll, spinning the top floor from the room with the flat turnstone
  const vi = VAULTS.findIndex(v => v.id === 'iii');
  G = newGame(vi);
  const st = G.st;
  const route = solveFrom(st, G.p.room).route.filter(m => m.dial != null);
  const first = route[0], L = M.layerOf(st, first.dial);
  M.turn(st, L.axis, L.k, first.dir); st.turns++;
  const m = route[1];
  enterRoom(G, m.dial, M.featTile(st, m.dial, M.DIAL));
  G.beetles = [{ c: 6, r: 6, fx: 6, fy: 6, from: [6, 6], mt: 1, face: 3, timer: 99, seed: 1 }];
  layout(); hud();
  doTurn(G, m.dir);
  const k = 0.36;
  G.anim.t = G.anim.dur * k; G.anim.raw = k; G.anim.ease = ease(k);
  G.shake = 0; G.fx = [];
  for (let i = 0; i < 14; i++) dust(G), G.fx[i].age = Math.random() * 0.6;
  hold = true;
  $('toast').hidden = true;
}

function boot() {
  layout();
  if (!sound.on) { $('soundBtn').classList.add('off'); $('waves').style.display = 'none'; }
  if (DEMO) demo();
  else {
    const cur = loadCur();
    if (cur && store.get('tut', 0)) { start(cur.vi, cur); }
    else if (!store.get('tut', 0)) start(0);
    else openTitle();
    if (!G) { G = newGame(0); layout(); hud(); }
  }
  requestAnimationFrame((t) => { last = t; frame(t); });
  window.toyboxReady?.();
  if (DEBUG) {
    window.cube = {
      get G() { return G; }, M, view, tut, sound, VAULTS, solveFrom,
      set hold(v) { hold = v; },
      ff(sec, dt = 1 / 60) { for (let t = 0; t < sec; t += dt) tick(G, dt); view.draw(G, performance.now() / 1000); bar(); },
      start, tapRoom: (c, r) => tapRoom(G, c, r), turn: (d) => doTurn(G, d), use: () => use(G), undo: () => undo(G), hint, openTitle,
      stepDir: (d) => tryStep(G, d), tick: (dt) => tick(G, dt),
    };
  }
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot, boot); else boot();
