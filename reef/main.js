// Reef: the view, input, guide and glue.
import {
  newGame, place, choose, preview, canPlace, legalTiles, botMove, atRisk, warmIn, handSize, openUpstream, neighbours, rngOf,
  KINDS, ORDER, SPECIES, SPECIES_BY_ID, WARM_WARN, key as tkey, reefValue,
} from './game.js';
import { C, drawSheet, makeSprites, swatch, hexXY, hexPath, SQ3, CREATURE, creaturePlate, SPRITE_SCALE, VARIANTS } from './art.js';
import { Sound } from './sound.js';

const qs = new URLSearchParams(location.search);
const DEMO = qs.has('demo'), DEBUG = qs.has('debug');
const $ = (id) => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const sound = new Sound();

const store = {
  get(k, d) { try { const v = localStorage.getItem('reef.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { if (DEMO) return; try { localStorage.setItem('reef.' + k, JSON.stringify(v)); } catch {} },
};

let g = null;
let seen = new Set();          // kinds that have ever been in hand, so the tray doesn't shuffle
let sel = null;                // selected kind
let hover = null;              // tile key being previewed
let pv = null;                 // its preview
let hold = false;              // ?debug: stop the clock
const anims = new Map();       // tile key -> planted-at time
const floats = [];             // rising numbers
const ripples = [];
const arrivedAt = {};          // species id -> time it appeared
let floorDirty = true;

// ---------------------------------------------------------------- layout
const V = { W: 0, H: 0, dpr: 1, rot: 0, S: 30, ox: 0, oy: 0, bcx: 0, bcy: 0 };
let sheet = null, floor = null, sprites = null, spriteS = 0;

function boardBounds() {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const t of g.tiles.values()) {
    const [x, y] = hexXY(t.q, t.r);
    x0 = Math.min(x0, x - SQ3 / 2); x1 = Math.max(x1, x + SQ3 / 2);
    y0 = Math.min(y0, y - 1); y1 = Math.max(y1, y + 1);
  }
  return { x0, x1, y0, y1 };
}

function layout() {
  V.W = innerWidth; V.H = innerHeight; V.dpr = Math.min(2.5, devicePixelRatio || 1);
  cv.width = Math.round(V.W * V.dpr); cv.height = Math.round(V.H * V.dpr);
  const hudR = $('scoreTag').getBoundingClientRect(), trayR = $('tray').getBoundingClientRect();
  V.trayTop = trayR.top; V.trayLeft = trayR.left;
  let top = hudR.bottom + 8, bottom = V.H - 10, left = 12, right = V.W - 12;
  const trayAtBottom = trayR.width > V.W * 0.6 || trayR.left < V.W * 0.35;
  if (trayAtBottom) bottom = trayR.top - 6; else right = trayR.left - 8;
  if (!trayAtBottom) top = Math.max(top, 56);
  const b = boardBounds(), bw = b.x1 - b.x0, bh = b.y1 - b.y0;
  const aw = right - left, ah = bottom - top;
  const s0 = Math.min(aw / bw, ah / bh), s1 = Math.min(aw / bh, ah / bw);
  V.rot = s1 > s0 * 1.08 ? 1 : 0;
  // a window too short for the tray leaves no room at all; draw small rather than with a negative size
  V.S = Math.max(6, Math.min(V.rot ? s1 : s0, 60));
  V.ox = (left + right) / 2; V.oy = (top + bottom) / 2;
  V.bcx = (b.x0 + b.x1) / 2; V.bcy = (b.y0 + b.y1) / 2;
  sheet = drawSheet(V.W, V.H, V.dpr);
  const want = Math.round(V.S * V.dpr);
  if (!sprites || Math.abs(want - spriteS) > 2) { sprites = makeSprites(want); spriteS = want; }
  floorDirty = true;
}

// board space -> screen
function toScreen(bx, by) {
  const dx = bx - V.bcx, dy = by - V.bcy;
  return V.rot ? [V.ox - V.S * dy, V.oy + V.S * dx] : [V.ox + V.S * dx, V.oy + V.S * dy];
}
function toBoard(sx, sy) {
  const u = (sx - V.ox) / V.S, v = (sy - V.oy) / V.S;
  return V.rot ? [V.bcx + v, V.bcy - u] : [V.bcx + u, V.bcy + v];
}
function boardTransform(c) {
  const S = V.S * V.dpr, d = V.dpr;
  if (V.rot) c.setTransform(0, S, -S, 0, d * V.ox + S * V.bcy, d * V.oy - S * V.bcx);
  else c.setTransform(S, 0, 0, S, d * V.ox - S * V.bcx, d * V.oy - S * V.bcy);
}
function tileAt(sx, sy) {
  const [x, y] = toBoard(sx, sy);
  let q = (SQ3 / 3 * x - y / 3), r = (2 / 3) * y, s = -q - r;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
  return g.tiles.get(tkey(rq, rr)) || null;
}
const tileXY = (t) => hexXY(t.q, t.r);
const tileScreen = (t) => toScreen(...tileXY(t));
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };

// ---------------------------------------------------------------- the floor (redrawn only when the sea bed changes)
function drawFloor() {
  floor = floor || document.createElement('canvas');
  floor.width = cv.width; floor.height = cv.height;
  const x = floor.getContext('2d');
  x.drawImage(sheet, 0, 0);
  boardTransform(x);
  const lw = 1 / V.S;
  for (const t of g.tiles.values()) {
    const [cx, cy] = tileXY(t);
    hexPath(x, cx, cy, 0.97);
    x.fillStyle = t.rubble ? 'rgba(160,200,240,.07)' : 'rgba(200,225,250,.05)'; x.fill();
    x.strokeStyle = 'rgba(215,232,250,.16)'; x.lineWidth = lw * 1.1; x.stroke();
    if (t.rubble) {
      const r = rngOf((hash(t.key) * 1e9) | 0);
      for (let i = 0; i < 9; i++) {
        const a = r() * 6.28, d = Math.sqrt(r()) * 0.68, px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d, s = 0.04 + r() * 0.07;
        x.fillStyle = `rgba(230,240,250,${0.18 + r() * 0.22})`;
        x.beginPath();
        for (let k = 0; k < 5; k++) { const aa = k * 1.256 + r(); const rr = s * (0.6 + r() * 0.6); k ? x.lineTo(px + Math.cos(aa) * rr, py + Math.sin(aa) * rr) : x.moveTo(px + Math.cos(aa) * rr, py + Math.sin(aa) * rr); }
        x.closePath(); x.fill();
      }
    }
    if (t.dead && t.deadKind && !t.piece) {
      x.save(); x.translate(cx, cy); x.rotate(hash(t.key + 'r') * 6.28); x.globalAlpha = 0.26;
      x.drawImage(sprites.ghost[t.deadKind][(t.pid || 0) % VARIANTS], -SPRITE_SCALE / 2, -SPRITE_SCALE / 2, SPRITE_SCALE, SPRITE_SCALE);
      x.restore();
    }
  }
  x.setTransform(1, 0, 0, 1, 0, 0);
  floorDirty = false;
}

// ---------------------------------------------------------------- creatures
function anchorXY(id) {
  const s = g.species[id];
  const t = s && s.anchor && g.tiles.get(s.anchor);
  return t ? tileXY(t) : [V.bcx, V.bcy];
}
function orbit(cx, cy, R, w, ph, t, squash = 0.8) {
  const a = w * t + ph;
  const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * squash;
  const hx = -Math.sin(a) * R * w, hy = Math.cos(a) * R * squash * w;
  return [x, y, Math.atan2(hy, hx)];
}
function drawCreatures(t) {
  const b = boardBounds();
  const hw = (b.x1 - b.x0) / 2, hh = (b.y1 - b.y0) / 2;
  const order = ['nudi', 'moray', 'octopus', 'seahorse', 'clown', 'damsel', 'parrot', 'turtle', 'manta', 'shark'];
  for (const id of order) {
    if (!g.species[id]) continue;
    const age = arrivedAt[id] != null ? t - arrivedAt[id] : 99;
    const alpha = Math.min(1, age / 1.6);
    const [ax, ay] = anchorXY(id);
    const ph = hash(id) * 6.28;
    ctx.save();
    ctx.globalAlpha = alpha * (id === 'manta' || id === 'shark' ? 0.82 : 0.95);
    ctx.fillStyle = ctx.strokeStyle = C.white;
    ctx.shadowColor = 'rgba(225,240,255,.7)'; ctx.shadowBlur = 5 * V.dpr;
    const put = (x, y, ang, sc, fn, tt = t) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sc, sc); fn(ctx, tt); ctx.restore();
    };
    switch (id) {
      case 'clown':
        for (let i = 0; i < 2; i++) { const [x, y, a] = orbit(ax, ay, 0.4, 1.1, ph + i * 3.1, t, 0.75); put(x, y, a, 1.35, CREATURE.clown); }
        break;
      case 'nudi': { const [x, y, a] = orbit(ax, ay, 0.45, 0.22, ph, t, 0.9); put(x, y, a, 1.3, CREATURE.nudi); break; }
      case 'seahorse': put(ax + 0.42, ay - 0.15 + Math.sin(t * 1.3) * 0.05, 0, 1.15, CREATURE.seahorse); break;
      case 'parrot': { const [x, y, a] = orbit(ax, ay, 0.95, 0.45, ph, t); put(x, y, a, 1.25, CREATURE.parrot); break; }
      case 'damsel':
        for (let i = 0; i < 9; i++) {
          const R = 0.45 + (i % 3) * 0.17, [x, y, a] = orbit(ax, ay, R, 0.8 + (i % 2) * 0.1, ph + i * 0.7, t, 0.7);
          put(x + Math.sin(t * 2 + i) * 0.04, y, a, 1.3, CREATURE.damsel);
        }
        break;
      case 'moray': put(ax + 0.1, ay + 0.08, 0.15, 0.9, CREATURE.moray); break;
      case 'octopus': put(ax, ay - 0.05 + Math.sin(t * 0.9) * 0.03, -0.4, 1.1, CREATURE.octopus); break;
      case 'turtle': { const [x, y, a] = orbit(ax, ay, 1.6, 0.16, ph, t); put(x, y, a, 1.4, CREATURE.turtle); break; }
      case 'manta': { const [x, y, a] = orbit(V.bcx, V.bcy, hw * 0.62, 0.07, ph, t, (hh / hw) * 0.9); put(x, y, a, 1.6, CREATURE.manta); break; }
      case 'shark': { const [x, y, a] = orbit(V.bcx, V.bcy, hw * 0.92, -0.09, ph, t, (hh / hw) * 1.05); put(x, y, a, 1.25, CREATURE.shark); break; }
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- frame
function text(str, sx, sy, size, color = C.white, align = 'center') {
  ctx.font = `${size}px 'IM Fell English SC', Georgia, serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(12,34,66,.9)'; ctx.lineWidth = Math.max(3, size * 0.22);
  ctx.strokeText(str, sx, sy);
  ctx.fillStyle = color; ctx.fillText(str, sx, sy);
}
const fmt = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n);

function frame(now) {
  requestAnimationFrame(frame);
  if (hold) return;
  render(now / 1000);
}

function render(t) {
  if (!g) return;
  if (floorDirty) drawFloor();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(floor, 0, 0);
  boardTransform(ctx);
  const b = boardBounds();

  // the current: faint streaming lines, west to east
  ctx.save();
  ctx.strokeStyle = 'rgba(225,238,252,.09)'; ctx.lineWidth = 0.035; ctx.setLineDash([0.5, 1.1]);
  ctx.lineDashOffset = -t * 0.45;
  for (let y = b.y0 + 0.4, i = 0; y < b.y1; y += 0.75, i++) {
    ctx.beginPath();
    for (let x = b.x0 - 0.5; x <= b.x1 + 0.5; x += 0.25) {
      const yy = y + Math.sin(x * 0.9 + t * 0.5 + i * 1.7) * 0.09;
      x === b.x0 - 0.5 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();

  // legal spots for the selected piece
  const placing = sel && g.hand[sel] > 0 && !g.choice && !g.over;
  if (placing) {
    ctx.fillStyle = 'rgba(235,245,255,.16)';
    for (const tl of legalTiles(g, sel)) { const [x, y] = tileXY(tl); ctx.beginPath(); ctx.arc(x, y, 0.06, 0, 6.28); ctx.fill(); }
  }

  // warm water: mark the corals at risk
  const wIn = warmIn(g);
  if (wIn <= WARM_WARN && !g.over) {
    const pulse = 0.55 + 0.45 * Math.sin(t * 4);
    ctx.save(); ctx.strokeStyle = C.rust; ctx.lineWidth = 0.07; ctx.setLineDash([0.16, 0.12]); ctx.globalAlpha = pulse;
    for (const tl of atRisk(g)) { const [x, y] = tileXY(tl); ctx.beginPath(); ctx.arc(x, y, 0.82, 0, 6.28); ctx.stroke(); }
    ctx.restore();
  }

  // pieces
  for (const tl of g.tiles.values()) {
    if (!tl.piece) continue;
    const [x, y] = tileXY(tl);
    const h = hash(tl.key);
    const directional = tl.piece === 'fan' || tl.piece === 'grass';
    let ang = directional ? (h - 0.5) * 0.3 : h * 6.28;
    if (tl.piece === 'anemone' || tl.piece === 'grass' || tl.piece === 'fan') ang += Math.sin(t * 1.1 + h * 9) * 0.05;
    let sc = 1, al = 1;
    const at = anims.get(tl.key);
    if (at != null) {
      const u = Math.min(1, (t - at) / 0.4);
      sc = 1 + 0.3 * (1 - u) * (1 - u); al = Math.min(1, u * 2.5);
      if (u >= 1) anims.delete(tl.key);
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sc, sc); ctx.globalAlpha = al;
    ctx.drawImage(sprites[tl.piece][tl.pid % VARIANTS], -SPRITE_SCALE / 2, -SPRITE_SCALE / 2, SPRITE_SCALE, SPRITE_SCALE);
    ctx.restore();
  }

  drawCreatures(t);

  // ripples
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i], u = (t - r.t0) / 1.4;
    if (u >= 1) { ripples.splice(i, 1); continue; }
    if (u < 0) continue;
    ctx.strokeStyle = r.rust ? C.rust : C.white; ctx.globalAlpha = (1 - u) * 0.7; ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.arc(r.x, r.y, 0.3 + u * 1.4, 0, 6.28); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // the preview
  const labels = [];
  if (placing && hover) {
    const tl = g.tiles.get(hover);
    const [x, y] = tileXY(tl);
    const ok = canPlace(g, hover, sel);
    ctx.save();
    hexPath(ctx, x, y, 0.97);
    ctx.lineWidth = 0.06; ctx.strokeStyle = ok ? C.white : C.rust; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 5); ctx.stroke();
    ctx.restore();
    if (ok && pv) {
      if (sel === 'fan') {
        // show the open water it would see
        ctx.save(); ctx.strokeStyle = C.white; ctx.lineWidth = 0.05; ctx.setLineDash([0.1, 0.12]); ctx.globalAlpha = 0.7;
        const n = openUpstream(g, tl);
        ctx.beginPath(); ctx.moveTo(x - 0.5, y); ctx.lineTo(x - SQ3 * n, y); ctx.stroke();
        ctx.restore();
      }
      ctx.save(); ctx.translate(x, y); ctx.globalAlpha = 0.6;
      if (sel === 'fan' || sel === 'grass') ctx.rotate(0); else ctx.rotate(hash(hover) * 6.28);
      ctx.drawImage(sprites[sel][g.pid % VARIANTS], -SPRITE_SCALE / 2, -SPRITE_SCALE / 2, SPRITE_SCALE, SPRITE_SCALE);
      ctx.restore();
      for (const ch of pv.changes) { const u = g.tiles.get(ch.key); labels.push([tileScreen(u), fmt(ch.d), ch.d < 0 ? C.rust : C.white, 0.5]); }
      labels.push([toScreen(x, y), fmt(pv.delta + pv.bonus), pv.delta + pv.bonus < 0 ? C.rust : C.white, 1, pv.arrivals.map(a => SPECIES_BY_ID[a.id].name + ' ' + fmt(SPECIES_BY_ID[a.id].bonus))]);
    } else if (!ok && !tl.piece && sel === 'grass') {
      labels.push([toScreen(x, y), 'sand only', C.rust, 0.55]);
    }
  }

  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  const fs = Math.max(15, Math.min(30, V.S * 0.85));
  for (const [[sx, sy], str, col, k, extra] of labels) {
    if (k === 1) {
      const up = V.S * 1.05;
      text(str, sx, sy - up, fs * 1.15, col);
      (extra || []).forEach((e, i) => text(e, sx, sy - up + fs * (0.95 + i * 0.8), fs * 0.62, C.white));
    } else text(str, sx, sy, fs * (k === 0.55 ? 0.6 : 0.68), col);
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i], u = (t - f.t0) / 1.3;
    if (u >= 1) { floats.splice(i, 1); continue; }
    if (u < 0) continue;
    ctx.globalAlpha = Math.min(1, (1 - u) * 2.5);
    text(f.str, f.x, f.y - u * V.S * 1.4, fs * f.k, f.col);
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- HUD, tray, cards
function updateHud() {
  $('score').textContent = g.score;
  $('nextTxt').innerHTML = g.over ? 'final' : `<span class="w">next pack at </span><span class="n">of </span>${g.threshold}`;
  const span = g.threshold - g.prevThreshold;
  $('bar').firstElementChild.style.width = Math.max(0, Math.min(1, (g.score - g.prevThreshold) / span)) * 100 + '%';
  const w = warmIn(g), risk = atRisk(g).length;
  const showWarm = !g.over && w <= WARM_WARN + 2;
  $('warm').hidden = !showWarm;
  if (showWarm) {
    $('warmN').innerHTML = w <= 1 ? 'Warm water <span class="w">next</span>' : `Warm<span class="w"> water</span> in ${w}`;
    $('warmTxt').textContent = risk ? `${risk} coral${risk > 1 ? 's' : ''} unshaded` : 'every coral shaded';
  }
  $('logN').textContent = `${Object.keys(g.species).length}/${SPECIES.length}`;
  updateTray();
  // the tray grows as pieces arrive and rules wrap; keep the board clear of it
  const tr = $('tray').getBoundingClientRect();
  if (Math.abs(tr.top - V.trayTop) > 2 || Math.abs(tr.left - V.trayLeft) > 2) { layout(); tut.place(); }
}

const swatches = {};
function updateTray() {
  for (const k of ORDER) if (g.hand[k] > 0) seen.add(k);
  if (sel && !(g.hand[sel] > 0)) sel = null;
  if (!sel && !tut.active) sel = ORDER.find(k => g.hand[k] > 0 && legalTiles(g, k).length) || ORDER.find(k => g.hand[k] > 0) || null;
  const box = $('pieces');
  const kinds = ORDER.filter(k => seen.has(k));
  if (box.dataset.kinds !== kinds.join()) {
    box.innerHTML = '';
    kinds.forEach((k, i) => {
      const b = document.createElement('button');
      b.className = 'piece'; b.dataset.kind = k; b.title = `${KINDS[k].name} (${i + 1})`;
      swatches[k] = swatches[k] || swatch(k, 46, Math.min(2, devicePixelRatio || 1));
      const c = document.createElement('canvas'); c.width = swatches[k].width; c.height = swatches[k].height;
      c.getContext('2d').drawImage(swatches[k], 0, 0);
      b.append(c);
      const s = document.createElement('span'); s.textContent = KINDS[k].name.replace(' coral', ''); b.append(s);
      const n = document.createElement('b'); b.append(n);
      b.addEventListener('click', () => pick(k));
      box.append(b);
    });
    box.dataset.kinds = kinds.join();
  }
  for (const b of box.children) {
    const k = b.dataset.kind, n = g.hand[k] || 0;
    b.querySelector('b').textContent = n;
    b.classList.toggle('empty', n === 0);
    b.classList.toggle('on', k === sel);
  }
  const rule = $('rule');
  if (sel) rule.innerHTML = `<b>${KINDS[sel].name}</b><span>${KINDS[sel].rule}</span>`;
  else rule.innerHTML = handSize(g) ? '<span>Pick a piece from your hand.</span>' : '<span>Your hand is empty.</span>';
}

function pick(k) {
  if (!(g.hand[k] > 0) || g.over) return;
  sound.init(); sound.resume();
  sel = k; sound.tick();
  refreshPreview();
  updateTray();
  tut.emit('select', k);
}

function refreshPreview() {
  pv = hover && sel && g.hand[sel] > 0 && canPlace(g, hover, sel) ? preview(g, hover, sel) : null;
}

let toastTimer = 0;
function toast(html, ms = 2600) {
  const el = $('toast');
  el.innerHTML = html; el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), ms);
}

const now = () => performance.now() / 1000;

function doPlace(k) {
  if (!sel || !canPlace(g, k, sel)) return;
  sound.init(); sound.resume();
  const kind = sel;
  const ev = place(g, k, kind);
  if (!ev) return;
  const t = now();
  anims.set(k, t);
  const tl = g.tiles.get(k);
  const [sx, sy] = tileScreen(tl);
  const [bx, by] = tileXY(tl);
  ripples.push({ x: bx, y: by, t0: t });
  sound.plop(kind === 'rock' ? 1 : 0);
  floats.push({ x: sx, y: sy - V.S * 0.6, str: fmt(ev.delta), col: ev.delta < 0 ? C.rust : C.white, k: 1, t0: t + 0.05 });
  for (const ch of ev.changes) { const [cx, cy] = tileScreen(g.tiles.get(ch.key)); floats.push({ x: cx, y: cy, str: fmt(ch.d), col: ch.d < 0 ? C.rust : C.white, k: 0.6, t0: t + 0.12 }); }
  setTimeout(() => sound.points(ev.delta), 60);
  if (kind === 'rock') floorDirty = true;
  if (ev.arrivals.length) {
    ev.arrivals.forEach((id, i) => {
      arrivedAt[id] = t + 0.3 + i * 0.4;
      const [ax, ay] = anchorXY(id);
      ripples.push({ x: ax, y: ay, t0: t + 0.3 + i * 0.4 });
    });
    const names = ev.arrivals.map(id => SPECIES_BY_ID[id]);
    sound.arrive();
    toast(names.map(s => `<b>${article(s.name)} ${s.name.toLowerCase()} moved in ${fmt(s.bonus)}</b>`).join('') + (names.length === 1 ? `<span>${speciesNote(names[0].id)}</span>` : ''), 3200);
  }
  if (ev.warm) {
    floorDirty = true;
    const n = ev.bleached.length;
    for (const bl of ev.bleached) { const [x, y] = tileXY(g.tiles.get(bl.key)); ripples.push({ x, y, t0: t + 0.2, rust: true }); }
    setTimeout(() => sound.bleach(), 300);
    setTimeout(() => toast(n ? `<b>Warm water. ${n} coral${n > 1 ? 's' : ''} bleached</b><span>They've died back to rubble.</span>` : `<b>Warm water passed</b><span>Every coral was shaded. Nothing bleached.</span>`, 3200), ev.arrivals.length ? 1800 : 300);
  } else if (warmIn(g) === WARM_WARN) {
    sound.warn();
    tip('warm');
  }
  hover = null; pv = null;
  // a hovering mouse keeps its preview on the next piece
  if (lastPointer.type === 'mouse' && lastPointer.k) hover = lastPointer.k;
  updateHud();
  refreshPreview();
  save();
  tut.emit('place', { ...ev, kind });
  ev.arrivals.forEach(id => tut.emit('arrive', id));
  if (ev.newPack) setTimeout(openPacks, 900);
  else if (ev.over) setTimeout(openEnd, 1100);
  for (const kk of ORDER) if (g.hand[kk] > 0 && !seen.has(kk)) seen.add(kk);
}

const article = (n) => /^[aeiou]/i.test(n) ? 'An' : 'A';
function speciesNote(id) {
  return {
    clown: 'It lives among the anemone’s stinging arms.',
    nudi: 'It eats the sponge and borrows the anemone’s sting.',
    seahorse: 'It anchors its tail to the fan.',
    parrot: 'It crunches coral and leaves sand behind.',
    damsel: 'A whole shoal, darting in and out of the branches.',
    moray: 'It waits in the crevice with its mouth open.',
    octopus: 'It has made a den among the rocks.',
    turtle: 'It grazes the seagrass meadow.',
    manta: 'It glides over the reef on the current.',
    shark: 'The reef is healthy enough for a hunter.',
  }[id] || '';
}

function swatchIcon(k, px) {
  const c = document.createElement('canvas');
  const s = swatch(k, px, Math.min(2, devicePixelRatio || 1));
  c.width = s.width; c.height = s.height; c.getContext('2d').drawImage(s, 0, 0);
  return c;
}

function openPacks() {
  if (!g.choice) return;
  sound.pack();
  $('packTitle').textContent = g.packN === 1 ? 'The reef is growing' : `Pack ${g.packN + 1}`;
  const box = $('packs');
  box.innerHTML = '';
  g.choice.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'pack';
    const h = document.createElement('h3'); h.textContent = p.name; b.append(h);
    const ul = document.createElement('ul');
    for (const [k, n] of Object.entries(p.items)) {
      const li = document.createElement('li');
      li.append(swatchIcon(k, 26));
      const s = document.createElement('span'); s.textContent = `${n} × ${KINDS[k].name}${!seen.has(k) ? ' (new)' : ''}`; li.append(s);
      ul.append(li);
    }
    b.append(ul);
    b.addEventListener('click', () => takePack(i));
    box.append(b);
  });
  $('packCard').hidden = false;
  tut.emit('packOpen');
}

function takePack(i) {
  const newKinds = Object.keys(g.choice[i].items).filter(k => !seen.has(k));
  const ev = choose(g, i);
  $('packCard').hidden = true;
  sound.tick();
  for (const k of ORDER) if (g.hand[k] > 0) seen.add(k);
  sel = newKinds[0] || sel;
  updateHud(); refreshPreview(); save();
  tut.emit('packChosen');
  if (newKinds.includes('fan')) tip('fan');
  else if (newKinds.includes('rock') || newKinds.includes('stag')) tip('rock');
  if (ev && ev.newPack) setTimeout(openPacks, 500);
  else if (ev && ev.over) setTimeout(openEnd, 600);
}

function openEnd() {
  const best = Math.max(store.get('best', 0), g.score);
  const isBest = g.score >= best && g.score > store.get('best', 0);
  store.set('best', best);
  const sp = Object.keys(g.species).map(id => SPECIES_BY_ID[id].name);
  $('endTitle').textContent = 'The season is over';
  const left = handSize(g);
  const why = left ? `Nowhere was left to plant the ${left} piece${left > 1 ? 's' : ''} in your hand` : 'Your hand ran out';
  $('endTxt').innerHTML = `${why} before the next pack. The reef scored <b>${g.score}</b> from ${g.placed} pieces${isBest ? ', your best yet.' : `. Your best is ${best}.`}`;
  $('endSpecies').textContent = sp.length ? `Moved in (${sp.length} of ${SPECIES.length}): ${sp.join(', ')}.` : 'Nobody moved in this time.';
  $('endCard').hidden = false;
  save();
}

function openLog() {
  const list = $('logList');
  list.innerHTML = '';
  const dpr = Math.min(2, devicePixelRatio || 1);
  for (const s of SPECIES) {
    const found = !!g.species[s.id];
    const li = document.createElement('li');
    if (!found) li.className = 'no';
    li.append(creaturePlate(s.id, 54, 40, dpr, found));
    li.lastChild.style.width = '54px'; li.lastChild.style.height = '40px';
    const d = document.createElement('div');
    d.innerHTML = `<b>${found ? s.name : '? ? ?'} <span class="caption">${fmt(s.bonus)}</span></b><small>${s.hint}</small>`;
    li.append(d);
    list.append(li);
  }
  $('logSub').textContent = `${Object.keys(g.species).length} of ${SPECIES.length} have moved in. Notes on the rest, from older divers:`;
  $('logCard').hidden = false;
}

// ---------------------------------------------------------------- saving
function save() {
  if (DEMO || tut.active) return;
  store.set('game', {
    seed: g.seed, hand: g.hand, species: g.species, packN: g.packN, threshold: g.threshold, prevThreshold: g.prevThreshold,
    placed: g.placed, nextWarm: g.nextWarm, choice: g.choice, over: g.over, pid: g.pid, seen: [...seen],
    tiles: [...g.tiles.values()].map(t => [t.key, t.piece, t.rubble ? 1 : 0, t.dead ? 1 : 0, t.deadKind || null, t.pid]),
  });
}
function load() {
  const s = store.get('game', null);
  if (!s || s.over) return null;
  try {
    const gg = newGame(s.seed);
    for (const [k, piece, rubble, dead, deadKind, pid] of s.tiles) {
      const t = gg.tiles.get(k); if (!t) continue;
      Object.assign(t, { piece, rubble: !!rubble, dead: !!dead, deadKind, pid });
    }
    Object.assign(gg, { hand: s.hand, species: s.species, packN: s.packN, threshold: s.threshold, prevThreshold: s.prevThreshold, placed: s.placed, nextWarm: s.nextWarm, choice: s.choice, over: s.over, pid: s.pid });
    gg.rng = rngOf(s.seed + s.placed * 31 + s.packN);
    seen = new Set(s.seen || []);
    return gg;
  } catch { return null; }
}

function startGame(seed, withGuide = false) {
  g = newGame(seed);
  seen = new Set();
  sel = null; hover = null; pv = null;
  anims.clear(); floats.length = 0; ripples.length = 0;
  for (const k in arrivedAt) delete arrivedAt[k];
  layout();
  if (withGuide) tut.start(); else tut.stop();
  updateHud();
  save();
}

// ---------------------------------------------------------------- the guide
const touchy = matchMedia('(pointer: coarse)').matches;
const tut = {
  active: false, i: 0, steps: [],
  start() {
    this.active = true; this.i = 0;
    sel = null;
    const centre = () => {
      // a good first spot: the middle of the patch, on sand
      let best = null, bd = 1e9;
      for (const t of g.tiles.values()) { const [x, y] = tileXY(t); const d = Math.hypot(x - V.bcx, y - V.bcy) + (t.rubble ? 0.8 : 0); if (!t.piece && d < bd) { bd = d; best = t; } }
      return best;
    };
    let first = null;
    const tray = (k) => () => { const b = document.querySelector(`.piece[data-kind="${k}"]`); return b && b.getBoundingClientRect(); };
    const tileRing = (f) => () => { const t = f(); if (!t) return null; const [x, y] = tileScreen(t); const r = V.S * 1.05; return { left: x - r, top: y - r, width: r * 2, height: r * 2 }; };
    this.steps = [
      { text: 'A bare patch of sea floor. You’ll rebuild a reef here one piece at a time, and see who moves in.', next: 'Show me' },
      { text: 'Your hand of pieces is down here. Pick the <b>brain coral</b>.', ring: tray('brain'), on: { select: k => k === 'brain' } },
      { text: touchy ? 'Tap a tile on the sea floor to see what the coral would add to the reef.' : 'Point at a tile on the sea floor to see what the coral would add to the reef.', ring: tileRing(centre), on: { preview: () => true, place: () => { this.i++; return true; } } }, // planted without a preview: skip "plant it"
      { text: touchy ? 'Tap the same tile again to plant it there.' : 'Click to plant it there.', on: { place: () => true } },
      { text: 'Corals like company: each coral beside a brain coral is worth +1 more, to both of them. Plant the second brain coral <b>touching</b> the first.', ring: tileRing(() => first), enter: () => { first = [...g.tiles.values()].find(t => t.piece === 'brain'); }, on: { place: ev => ev.kind === 'brain' } },
      { text: 'Now the <b>anemone</b>. It’s worth +2 for every brain coral it touches, and something likes to live in one.', ring: tray('anemone'), on: { place: ev => ev.kind === 'anemone' } },
      { text: () => g.species.clown ? 'A clownfish moved in! Each new species is worth points. The <b>reef log</b> has notes on who else might come.' : 'Nobody moved in that time. The <b>reef log</b> has notes on who might, and what they need.', ring: () => $('logBtn').getBoundingClientRect(), next: 'Next' },
      { text: 'This bar fills toward your next <b>pack</b> of pieces. Plant the rest of your hand to fill it.', ring: () => $('scoreTag').getBoundingClientRect(), on: { packOpen: () => true } },
      { text: 'Choose a pack. Whatever you don’t plant stays in your hand.', top: true, on: { packChosen: () => true } },
      { text: 'That’s the whole of it. When your hand runs out before the bar fills, the season ends. New pieces come with a note the first time you see them.', next: 'Good luck' },
    ];
    this.show();
  },
  stop() { this.active = false; $('coach').hidden = true; $('ring').hidden = true; },
  show() {
    const st = this.steps[this.i];
    if (!st) { this.stop(); store.set('tut', 1); updateTray(); return; }
    st.enter && st.enter();
    $('coachStep').textContent = `Guide · ${this.i + 1} of ${this.steps.length}`;
    $('coachTxt').innerHTML = typeof st.text === 'function' ? st.text() : st.text;
    const btns = $('coachBtns'); btns.innerHTML = '';
    if (st.next) {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = st.next;
      b.onclick = () => { sound.init(); sound.resume(); this.advance(); };
      btns.append(b);
    }
    const skip = document.createElement('button'); skip.className = 'btn alt'; skip.textContent = 'Skip guide';
    skip.onclick = () => { this.stop(); store.set('tut', 1); updateTray(); updateHud(); };
    btns.prepend(skip);
    $('coach').hidden = false;
    this.place();
  },
  place() {
    if (!this.active) return;
    const st = this.steps[this.i];
    const co = $('coach');
    const trayR = $('tray').getBoundingClientRect();
    co.style.zIndex = st.top ? 25 : 15;
    const trayAtBottom = trayR.width > innerWidth * 0.6 || trayR.left < innerWidth * 0.35;
    if (trayAtBottom) {
      co.style.left = '50%'; co.style.right = 'auto'; co.style.top = 'auto';
      co.style.transform = 'translateX(-50%) rotate(-.5deg)';
      co.style.bottom = (st.top ? 14 : innerHeight - trayR.top + 10) + 'px';
    } else {
      co.style.transform = 'rotate(-.5deg)'; co.style.bottom = 'auto';
      co.style.left = 'auto'; co.style.right = (innerWidth - trayR.right) + 'px';
      co.style.top = Math.max(60, trayR.top - co.offsetHeight - 10) + 'px';
    }
    const ring = $('ring');
    const r = st.ring && st.ring();
    if (r) {
      const size = Math.max(r.width, r.height) + 14;
      Object.assign(ring.style, { left: r.left + r.width / 2 - size / 2 + 'px', top: r.top + r.height / 2 - size / 2 + 'px', width: size + 'px', height: size + 'px' });
      ring.hidden = false;
    } else ring.hidden = true;
  },
  advance() { this.i++; this.show(); },
  emit(name, arg) {
    if (!this.active) return;
    const st = this.steps[this.i];
    if (st && st.on && st.on[name] && st.on[name](arg)) this.advance();
    else this.place();
  },
};

const TIPS = {
  fan: () => `<b>Sea fans</b> score for open water up-current: the current flows ${V.rot ? 'down the screen, so leave tiles <em>above</em> each fan empty' : 'left to right, so leave tiles to the <em>left</em> of each fan empty'}. They also shade corals from warm water.`,
  rock: () => '<b>Rocks</b> turn the sand around them to rubble, where <b>staghorn</b> grows best (+4). Seagrass can’t grow on rubble.',
  warm: () => '<b>Warm water is coming.</b> When the count runs out, every coral without a rock or sea fan beside it bleaches and dies back to rubble. The ringed corals are at risk.',
};
function tip(id) {
  if (DEMO || tut.active) return;
  const done = store.get('tips', {});
  if (done[id]) return;
  done[id] = 1; store.set('tips', done);
  $('coachStep').textContent = 'A note';
  $('coachTxt').innerHTML = TIPS[id]();
  const btns = $('coachBtns'); btns.innerHTML = '';
  const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Got it';
  b.onclick = () => { $('coach').hidden = true; };
  btns.append(b);
  $('ring').hidden = true;
  const co = $('coach');
  co.hidden = false;
  tut.active = true; const st = tut.steps; const i = tut.i;
  tut.steps = [{}]; tut.i = 0; tut.place(); tut.steps = st; tut.i = i; tut.active = false;
}

// ---------------------------------------------------------------- input
const lastPointer = { type: 'mouse', k: null };
let down = null;
cv.addEventListener('pointermove', (e) => {
  lastPointer.type = e.pointerType;
  if (e.pointerType !== 'mouse' || !g) return;
  const t = tileAt(e.clientX, e.clientY);
  const k = t ? t.key : null;
  lastPointer.k = k;
  if (k !== hover) {
    hover = k; refreshPreview();
    if (pv) tut.emit('preview', k);
  }
  cv.classList.toggle('point', !!(t && sel && canPlace(g, k, sel)));
});
cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hover = null; pv = null; lastPointer.k = null; } });
cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, type: e.pointerType }; sound.init(); sound.resume(); });
cv.addEventListener('pointerup', (e) => {
  if (!down || !g) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 14 || g.choice || g.over) return;
  const t = tileAt(e.clientX, e.clientY);
  if (!t) { hover = null; pv = null; return; }
  if (!sel) { toast('<b>Pick a piece first</b><span>Your hand is at the bottom.</span>', 1800); return; }
  if (e.pointerType === 'mouse') {
    hover = t.key;
    if (canPlace(g, t.key, sel)) doPlace(t.key);
    return;
  }
  if (hover === t.key && canPlace(g, t.key, sel)) doPlace(t.key);
  else { hover = t.key; refreshPreview(); if (pv) tut.emit('preview', t.key); }
});

function moveCursor(dx, dy) {
  if (!g) return;
  let t = hover && g.tiles.get(hover);
  if (!t) {
    let best = null, bd = 1e9;
    for (const u of g.tiles.values()) { const [x, y] = tileXY(u); const d = Math.hypot(x - V.bcx, y - V.bcy); if (d < bd) { bd = d; best = u; } }
    t = best;
  } else {
    const [sx, sy] = tileScreen(t);
    let best = null, bv = 0.35;
    for (const n of neighbours(g, t)) {
      const [nx, ny] = tileScreen(n); const vx = nx - sx, vy = ny - sy, l = Math.hypot(vx, vy);
      const v = (vx * dx + vy * dy) / l;
      if (v > bv) { bv = v; best = n; }
    }
    if (best) t = best;
  }
  hover = t.key; lastPointer.type = 'key'; refreshPreview();
  if (pv) tut.emit('preview', hover);
}

addEventListener('keydown', (e) => {
  if (!g || e.metaKey || e.ctrlKey || e.altKey) return;
  const anyCard = !$('packCard').hidden || !$('logCard').hidden || !$('endCard').hidden || !$('titleCard').hidden;
  if (e.key === 'Escape') { $('logCard').hidden = true; return; }
  if (!$('packCard').hidden && (e.key === '1' || e.key === '2')) { takePack(+e.key - 1); return; }
  if (anyCard) return;
  const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (dirs[e.key]) { e.preventDefault(); moveCursor(...dirs[e.key]); return; }
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (hover && sel) doPlace(hover); return; }
  if (/^[1-7]$/.test(e.key)) { const k = $('pieces').children[+e.key - 1]; if (k) pick(k.dataset.kind); return; }
  if (e.key === 'l' || e.key === 'L') { openLog(); return; }
  if (e.key === 'm' || e.key === 'M') { toggleSound(); }
});

function toggleSound() {
  sound.init();
  sound.setOn(!sound.on);
  store.set('sound', sound.on);
  $('soundBtn').classList.toggle('off', !sound.on);
}

$('soundBtn').onclick = toggleSound;
$('logBtn').onclick = () => { sound.init(); openLog(); };
$('logClose').onclick = () => { $('logCard').hidden = true; };
$('logCard').addEventListener('click', (e) => { if (e.target === $('logCard')) $('logCard').hidden = true; });
$('againBtn').onclick = () => { $('endCard').hidden = true; startGame(undefined, false); };
$('lookBtn').onclick = () => { $('endCard').hidden = true; $('nextTxt').textContent = 'final · tap ? for a new reef'; };

let titleMode = 'first';
function openTitle(mode) {
  titleMode = mode;
  drawPlate();
  if (mode === 'first') { $('startBtn').textContent = 'Begin with a guide'; $('skipBtn').textContent = 'I know the way'; }
  else { $('startBtn').textContent = 'New reef with the guide'; $('skipBtn').textContent = g && !g.over ? 'Back to this reef' : 'Plant a new reef'; }
  $('titleCard').hidden = false;
}
$('helpBtn').onclick = () => openTitle('help');
$('startBtn').onclick = () => { sound.init(); sound.resume(); $('titleCard').hidden = true; startGame(undefined, true); };
$('skipBtn').onclick = () => {
  sound.init(); sound.resume();
  $('titleCard').hidden = true;
  if (titleMode === 'first' || !g || g.over) { store.set('tut', 1); startGame(undefined, false); }
};

function drawPlate() {
  const c = $('titlePlate'), dpr = Math.min(2, devicePixelRatio || 1);
  const w = 400, h = 150;
  c.width = w * dpr; c.height = h * dpr;
  const x = c.getContext('2d');
  x.drawImage(drawSheet(w, h, dpr, 9), 0, 0);
  const S = 26 * dpr, sp = makeSprites(S, 4);
  const items = [['grass', 60, 92, 0], ['brain', 118, 70, 1], ['anemone', 160, 104, 0], ['stag', 214, 62, 2], ['fan', 268, 92, 0], ['sponge', 312, 58, 1], ['rock', 350, 104, 0]];
  for (const [k, px, py, v] of items) {
    const s = sp[k][v];
    x.drawImage(s, px * dpr - s.width / 2, py * dpr - s.height / 2);
  }
  x.save(); x.translate(186 * dpr, 112 * dpr); x.scale(S * 0.9, S * 0.9); x.rotate(-0.2);
  x.fillStyle = x.strokeStyle = C.white; x.shadowColor = 'rgba(225,240,255,.7)'; x.shadowBlur = 4 * dpr;
  CREATURE.clown(x, 0); x.restore();
  x.save(); x.translate(300 * dpr, 30 * dpr); x.scale(S, S); x.rotate(0.1);
  x.fillStyle = x.strokeStyle = C.white; x.shadowColor = 'rgba(225,240,255,.7)'; x.shadowBlur = 4 * dpr;
  CREATURE.turtle(x, 0.3); x.restore();
}

addEventListener('resize', () => { if (!g) return; layout(); tut.place(); });

// ---------------------------------------------------------------- boot
sound.on = store.get('sound', true);
$('soundBtn').classList.toggle('off', !sound.on);

function demo() {
  g = newGame(+(qs.get('seed') || 24));
  const brng = rngOf(5);
  let guard = 0;
  while (g.placed < 62 && !g.over && guard++ < 300) {
    if (g.choice) { choose(g, 0); continue; }
    const m = botMove(g, brng, 1.5);
    if (!m) break;
    place(g, m.key, m.kind);
  }
  g.choice = null; g.over = false;
  layout();
  for (const k of ORDER) if (g.hand[k] > 0) seen.add(k);
  sel = ORDER.find(k => g.hand[k] > 0 && legalTiles(g, k).length) || null;
  if (sel) {
    let best = null;
    for (const t of legalTiles(g, sel)) { const p = preview(g, t.key, sel); if (!best || p.delta > best.d) best = { d: p.delta, k: t.key }; }
    hover = best && best.k; refreshPreview();
  }
  updateHud();
}

function boot() {
  if (DEMO) { demo(); }
  else {
    const seedQ = qs.get('seed');
    const loaded = seedQ ? null : load();
    if (loaded) {
      g = loaded;
      recomputeScore(); // the reef's value isn't saved, only the board
      layout(); updateHud();
      if (g.choice) setTimeout(openPacks, 300);
    } else {
      g = newGame(seedQ ? +seedQ : undefined);
      layout(); updateHud();
      if (!store.get('tut', 0)) openTitle('first');
      else { /* straight in */ }
    }
  }
  requestAnimationFrame(frame);
  window.toyboxReady?.();
  if (DEBUG) {
    window.reef = {
      get g() { return g; }, V, tut, sound,
      set hold(v) { hold = v; }, render: (t) => render(t ?? now()),
      bot(n = 1, noise = 1) {
        for (let i = 0; i < n; i++) {
          if (g.choice) { takePack(0); continue; }
          if (g.over) break;
          const m = botMove(g, Math.random, noise); if (!m) break;
          sel = m.kind; doPlace(m.key);
        }
        return { score: g.score, placed: g.placed, packN: g.packN, over: g.over };
      },
      place: (k, kind) => { sel = kind; doPlace(k); },
      tileScreen: (k) => tileScreen(g.tiles.get(k)),
      startGame,
    };
  }
}

function recomputeScore() {
  g.value = reefValue(g);
  g.bonus = Object.keys(g.species).reduce((s, id) => s + SPECIES_BY_ID[id].bonus, 0);
  g.score = g.value + g.bonus;
}

if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot, boot); else boot();
