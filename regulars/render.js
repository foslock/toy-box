// Draws the counter from behind: the regulars up top, your stations below.
import { INK, PAPER, shape, line, box, ell, rectS, sprite, grain, flushSprites, drawPerson, drawItem, strangerLook, reseed, rng } from './art.js';
import { STOOLS, LINE, LINE_LO, LINE_HI, HUSH } from './sim.js';
import { LOOKS, ITEMS, NAMES } from './story.js';

const ERAS = [
  { from: 1952, wall: '#efe0bd', wall2: '#e4d2a8', trim: '#6fae9f', floor: '#c9453a', top: '#ece2c9', speck: '#b5a98c', chrome: '#a9bdb9', work: '#d8d0ba', tile: '#cdc4aa', awn: '#c9453a', awn2: '#f4ead4', pat: 'boomerang' },
  { from: 1960, wall: '#8ccabd', wall2: '#7cbcae', trim: '#e5725a', floor: '#2f6f73', top: '#f1e6cf', speck: '#e5725a', chrome: '#b6c6c4', work: '#dcd5c2', tile: '#c9ddd6', awn: '#e5725a', awn2: '#f6edd8', pat: 'star' },
  { from: 1968, wall: '#a9753f', wall2: '#996636', trim: '#d9a53a', floor: '#5f6b2f', top: '#e6cf95', speck: '#a57a35', chrome: '#b9b09a', work: '#d9cfae', tile: '#c9b98a', awn: '#b5612a', awn2: '#e8cf8c', pat: 'panel' },
];
export const eraOf = (y) => ERAS.filter(e => y >= e.from).pop();
const TOMATO = '#c9453a', MUSTARD = '#d9a53a', TEAL = '#3c8f88';

export class View {
  constructor(cv) { this.cv = cv; this.c = cv.getContext('2d'); this.grain = grain(); this.actors = new Map(); this.fx = []; this.fly = []; this.w = 0; this.t = 0; this.year = 1952; this.street = 0; this.allow = null; this.pulse = null; }

  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr; this.cv.width = w * dpr; this.cv.height = h * dpr;
    const top = 48; const L = {};
    if (h < 520 && w > h) { L.mode = 'side'; L.scene = { x: 0, y: top, w: Math.round(w * .5), h: h - top }; L.work = { x: L.scene.w, y: top, w: w - L.scene.w, h: h - top }; L.capH = 54; }
    else if (h > w * 1.05) { L.mode = 'tall'; const sh = Math.round(Math.min(h * .4, 420)); L.scene = { x: 0, y: top, w, h: sh }; L.work = { x: 0, y: top + sh, w, h: h - top - sh }; L.capH = 64; }
    else { L.mode = 'wide'; const sh = Math.round(h * .5); L.scene = { x: 0, y: top, w, h: sh }; const ww = Math.min(w, 1120); L.work = { x: (w - ww) / 2, y: top + sh, w: ww, h: h - top - sh }; L.capH = 58; }
    const S = L.scene;
    L.counterH = Math.round(Math.max(38, S.h * .13));
    L.counterY = S.y + S.h - L.capH - L.counterH;
    const pad = 6; const margin = Math.max(8, (S.w - Math.min(S.w - 16, 170 * STOOLS)) / 2);
    L.sw = (S.w - margin * 2) / STOOLS; L.sx = S.x + margin; L.pad = pad;
    const slipH = Math.round(Math.max(66, Math.min(100, S.h * .24)));
    L.slipH = slipH; L.slipY = S.y + 8;
    const peopleH = L.counterY - (L.slipY + slipH) + 12;
    L.ps = Math.min(L.sw / 80, peopleH / 132);
    this.L = L; this.stations(); this.backdrop = null; flushSprites();
  }

  stoolX(i) { return this.L.sx + this.L.sw * (i + .5); }

  stations() {
    const { work: W, mode } = this.L; const g = 6, x0 = W.x + g, y0 = W.y + g, ww = W.w - g * 2, hh = W.h - g * 2 - (mode === 'tall' ? 8 : 0);
    const rows = mode === 'tall' ? [[['urn', 2], ['fount', 3]], [['griddle', 3], ['toaster', 2]], [['pie', 3], ['pass', 2]]]
      : [[['urn', 2.2], ['fount', 3.2], ['pie', 2.6]], [['griddle', 4], ['toaster', 2], ['pass', 2.4]]];
    const R = {}; const rh = (hh - g * (rows.length - 1)) / rows.length;
    rows.forEach((row, r) => { const tot = row.reduce((a, b) => a + b[1], 0); let x = x0; const uw = (ww - g * (row.length - 1)) / tot;
      for (const [k, n] of row) { R[k] = { x, y: y0 + r * (rh + g), w: uw * n, h: rh }; x += uw * n + g; } });
    this.R = R;
    // sub-rects
    const u = R.urn; u.levers = [{ kind: 'coffee', x: u.x, y: u.y, w: u.w * .62, h: u.h }, { kind: 'tea', x: u.x + u.w * .62, y: u.y, w: u.w * .38, h: u.h }];
    const f = R.fount; const glassW = Math.max(62, f.w * .3); f.glassR = { x: f.x + f.w - glassW, y: f.y, w: glassW, h: f.h };
    const G = R.griddle; const binW = Math.max(52, G.w * .22); G.bins = [{ kind: 'eggs', x: G.x, y: G.y, w: binW, h: G.h / 2 }, { kind: 'burger', x: G.x, y: G.y + G.h / 2, w: binW, h: G.h / 2 }];
    G.slots = [0, 1, 2].map(i => { const w = (G.w - binW) / 3; return { x: G.x + binW + w * i, y: G.y, w, h: G.h }; });
    const T = R.toaster; T.slots = [0, 1].map(i => ({ x: T.x + T.w / 2 * i, y: T.y, w: T.w / 2, h: T.h }));
    const P = R.pie; P.apple = { x: P.x, y: P.y, w: P.w / 2, h: P.h }; P.cherry = { x: P.x + P.w / 2, y: P.y, w: P.w / 2, h: P.h };
    const A = R.pass; const sw = A.w / 4; A.slots = [0, 1, 2].map(i => ({ x: A.x + sw * i, y: A.y, w: sw, h: A.h })); A.bin = { x: A.x + sw * 3, y: A.y, w: sw, h: A.h };
  }

  // what is under a point, in game terms
  hit(x, y, S, menu) {
    const inR = (r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    const L = this.L;
    if (y >= L.scene.y && y < L.counterY + L.counterH && x >= L.scene.x && x < L.scene.x + L.scene.w) {
      const i = Math.floor((x - L.sx) / L.sw); if (i >= 0 && i < STOOLS) return { t: 'stool', i }; return null;
    }
    const R = this.R;
    if (inR(R.urn)) { if (S.urn.glass?.ready) return { t: 'item', ref: { at: 'urn' } }; const l = R.urn.levers.find(inR); return { t: 'pour', st: 'urn', kind: l.kind }; }
    if (inR(R.fount)) { if (S.fount.glass?.ready) return { t: 'item', ref: { at: 'fount' } }; const taps = this.tapRects(menu); const l = taps.find(inR); return l ? { t: 'pour', st: 'fount', kind: l.kind } : (S.fount.glass ? { t: 'pour', st: 'fount', kind: S.fount.glass.kind } : null); }
    if (inR(R.griddle)) { const b = R.griddle.bins.find(inR); if (b) return menu.includes(b.kind) ? { t: 'griddle+', kind: b.kind } : null; const i = R.griddle.slots.findIndex(inR); const g = S.griddle[i]; if (g?.state === 'done') return { t: 'item', ref: { at: 'griddle', i } }; return g ? { t: 'griddle', i } : null; }
    if (inR(R.toaster)) { const i = R.toaster.slots.findIndex(inR); const j = S.toaster[i]?.ready ? i : S.toaster.findIndex(b => b?.ready); return j >= 0 ? { t: 'item', ref: { at: 'toaster', i: j } } : { t: 'toast' }; }
    if (inR(R.pie)) { const k = inR(R.pie.apple) ? 'apple' : 'cherry'; return menu.includes(k) ? { t: 'item', ref: { at: 'pie', kind: k } } : null; }
    if (inR(R.pass)) { if (inR(R.pass.bin)) return { t: 'bin' }; const i = R.pass.slots.findIndex(inR); return S.pass[i] ? { t: 'item', ref: { at: 'pass', i } } : null; }
    return null;
  }

  tapRects(menu) { const f = this.R.fount; const list = ['milk', 'choc', 'straw', 'cola'].filter(k => menu.includes(k)); const w = (f.w - f.glassR.w) / list.length; return list.map((kind, i) => ({ kind, x: f.x + i * w, y: f.y, w, h: f.h })); }

  refCentre(ref) {
    const R = this.R; if (ref.at === 'urn') return [R.urn.x + R.urn.w * .4, R.urn.y + R.urn.h * .66];
    if (ref.at === 'fount') { const g = R.fount.glassR; return [g.x + g.w / 2, g.y + g.h * .6]; }
    const cen = (r) => [r.x + r.w / 2, r.y + r.h / 2];
    if (ref.at === 'griddle') return cen(R.griddle.slots[ref.i]); if (ref.at === 'toaster') return cen(R.toaster.slots[ref.i]);
    if (ref.at === 'pie') return cen(R.pie[ref.kind]); if (ref.at === 'pass') return cen(R.pass.slots[ref.i]); return [0, 0];
  }

  // ——— the static room ———
  buildBackdrop(year, def) {
    const { dpr, w, h, L } = this; const b = document.createElement('canvas'); b.width = w * dpr; b.height = h * dpr;
    const c = b.getContext('2d'); c.scale(dpr, dpr); reseed(year); const E = eraOf(year); const S = L.scene;
    c.fillStyle = E.work; c.fillRect(0, 0, w, h);
    // wall
    c.save(); c.beginPath(); c.rect(S.x, S.y, S.w, L.counterY - S.y + 4); c.clip();
    c.fillStyle = E.wall; c.fillRect(S.x, S.y, S.w, S.h);
    if (E.pat === 'boomerang') { const r = rng(4); for (let y = S.y + 14; y < L.counterY; y += 44) for (let x = S.x + (y % 88 ? 20 : 44); x < S.x + S.w; x += 72) { const a = r() * 6; c.save(); c.translate(x, y); c.rotate(a); line(c, [[-9, 4], [0, -5], [9, 4]], { ink: E.wall2, lw: 4, wobble: .3 }); c.restore(); } }
    if (E.pat === 'star') { for (let y = S.y + 18; y < L.counterY; y += 50) for (let x = S.x + (y % 100 ? 24 : 50); x < S.x + S.w; x += 76) for (let i = 0; i < 4; i++) { const a = i * .785; line(c, [[x - Math.cos(a) * 9, y - Math.sin(a) * 9], [x + Math.cos(a) * 9, y + Math.sin(a) * 9]], { ink: E.wall2, lw: 2.2, smooth: false, wobble: .2 }); } }
    if (E.pat === 'panel') { for (let x = S.x; x < S.x + S.w; x += 34) line(c, [[x, S.y], [x + 1, L.counterY + 4]], { ink: E.wall2, lw: 2.4, smooth: false }); }
    // the front window, with the street through it
    const wx = S.x + S.w * .06, wy = S.y + 10, ww = S.w * .7, wh = L.counterY - wy - 2;
    this.win = { x: wx, y: wy, w: ww, h: wh };
    rectS(c, wx, wy, ww, wh, { fill: def?.snow ? '#d9e1e2' : year >= 1968 ? '#f3d9a8' : '#bfe0dc', off: 0 });
    c.save(); c.beginPath(); c.rect(wx + 1, wy + 1, ww - 2, wh - 2); c.clip();
    const ground = wy + wh * .62, rr = rng(11);
    for (let x = wx - 10; x < wx + ww; ) { const bw = 40 + rr() * 50, bh = 26 + rr() * 34; shape(c, box(x, ground - bh, bw, bh + 4), { fill: ['#d3a27a', '#a9bda0', '#d8c28f', '#c98a72'][Math.floor(rr() * 4)], lw: 1, smooth: false, off: 1 });
      for (let i = 0; i < 2; i++) rectS(c, x + 8 + i * 16, ground - bh + 8, 8, 10, { fill: '#566', lw: .7, off: 0 }); x += bw + 2; }
    c.fillStyle = def?.snow ? '#f4f4f0' : '#d8cdb2'; c.fillRect(wx, ground, ww, 9); c.fillStyle = def?.snow ? '#f4f4f0' : '#8d8676'; c.fillRect(wx, ground + 9, ww, wh); if (!def?.snow) { c.fillStyle = '#ede3c8'; for (let x = wx + 8; x < wx + ww; x += 44) c.fillRect(x, ground + 26, 22, 2.5); }
    // the sapling Gus planted out front gets a little taller every year
    const age = (year - 1952) / 19, tx = wx + ww * .7, th = 14 + age * 40;
    line(c, [[tx, ground + 2], [tx + 1, ground - th]], { lw: 2 + age * 3, ink: '#5a3f2a', wobble: .4 });
    if (!def?.snow) shape(c, ell(tx, ground - th - 6 - age * 8, 9 + age * 26, 8 + age * 22, 9), { fill: '#6e9b4b', lw: 1.1 });
    else { line(c, [[tx, ground - th], [tx - 12, ground - th - 12]], { lw: 1.6, ink: '#5a3f2a' }); line(c, [[tx, ground - th + 4], [tx + 13, ground - th - 10]], { lw: 1.6, ink: '#5a3f2a' }); }
    if (year >= 1955) { /* telephone pole, more wires as the years go */ line(c, [[wx + ww * .16, ground], [wx + ww * .16, wy - 2]], { lw: 3, ink: '#4a3a2c', smooth: false }); for (let i = 0; i < Math.min(3, 1 + (year - 1955) / 6); i++) line(c, [[wx, wy + 14 + i * 6], [wx + ww, wy + 10 + i * 7]], { lw: .8 }); }
    c.restore();
    // reversed sign on the glass
    c.save(); c.translate(wx + ww / 2, wy + wh * .3); c.scale(-1, 1); c.font = `${Math.round(Math.min(ww * .11, 40))}px "Fontdiner Swanky"`; c.textAlign = 'center'; c.fillStyle = E.awn; c.globalAlpha = .9; c.fillText('The Sunny Side', 0, 0); c.restore();
    rectS(c, wx, wy, ww, wh, { lw: 3, off: 0 });
    line(c, [[wx + ww / 2, wy], [wx + ww / 2, wy + wh]], { lw: 2.4, smooth: false });
    // door
    const dx = wx + ww + S.w * .05, dw = S.x + S.w - dx - 6;
    if (dw > 26) { rectS(c, dx, wy, dw, L.counterY - wy + 6, { fill: E.trim, lw: 2, off: 1.5 }); rectS(c, dx + dw * .18, wy + 10, dw * .64, wh * .5, { fill: def?.snow ? '#e4eaea' : '#cfe7e2', lw: 1.2, off: 0 }); this.doorX = dx + dw / 2; }
    else this.doorX = S.x + S.w;
    // clock and a nail for the watch
    this.clock = { x: wx + ww * 1 + (dw > 26 ? -18 : -18), y: wy + 24 };
    c.restore();
    // counter edge
    const y = L.counterY;
    c.fillStyle = E.top; c.fillRect(S.x, y, S.w, L.counterH + 2);
    const rs = rng(8); c.fillStyle = E.speck; for (let i = 0; i < S.w * L.counterH / 90; i++) { c.fillRect(S.x + rs() * S.w, y + rs() * L.counterH, 3, 1.4); }
    c.fillStyle = E.chrome; c.fillRect(S.x, y + L.counterH - 7, S.w, 8); c.fillStyle = '#eef3f0'; c.fillRect(S.x, y + L.counterH - 6, S.w, 2);
    line(c, [[S.x, y], [S.x + S.w, y]], { lw: 1.6, smooth: false }); line(c, [[S.x, y + L.counterH + 1], [S.x + S.w, y + L.counterH + 1]], { lw: 1.6, smooth: false });
    // caption shelf
    c.fillStyle = PAPER; c.fillRect(S.x, y + L.counterH + 2, S.w, L.capH);
    line(c, [[S.x, S.y + S.h], [S.x + S.w, S.y + S.h]], { lw: 1.6, smooth: false });
    // awning band
    const aw = 22; for (let x = 0, i = 0; x < w; x += aw, i++) { c.fillStyle = i % 2 ? E.awn : E.awn2; c.fillRect(x, 0, aw, 48); c.beginPath(); c.arc(x + aw / 2, 48, aw / 2, 0, Math.PI); c.fill(); }
    line(c, [[0, 48], [w, 48]], { lw: 1.2, smooth: false, ink: 'rgba(42,36,32,.45)' });
    // slip rail
    c.fillStyle = E.chrome; c.fillRect(S.x + 4, S.y + 4, S.w - 8, 5); line(c, [[S.x + 4, S.y + 9.5], [S.x + S.w - 4, S.y + 9.5]], { lw: 1.1, smooth: false });
    this.buildWork(c, year, E);
    c.globalCompositeOperation = 'multiply'; c.fillStyle = c.createPattern(this.grain, 'repeat'); c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'source-over';
    return b;
  }

  buildWork(c, year, E) {
    const { R, L } = this; const W = L.work;
    // tile
    c.fillStyle = E.tile; const ts = 26; for (let y = W.y; y < this.h; y += ts) for (let x = W.x - (W.x % ts); x < W.x + W.w; x += ts) if (((x / ts | 0) + (y / ts | 0)) % 2) c.fillRect(x, y, ts, ts);
    const label = (r, t, ax = 0) => { c.fillStyle = INK; c.font = '600 11px Jost, sans-serif'; c.textAlign = 'left'; c.save(); c.letterSpacing = '1.2px'; c.fillText(t.toUpperCase(), r.x + 9 + ax, r.y + 15); c.restore(); };
    const card = (r, fill) => rectS(c, r.x, r.y, r.w, r.h, { fill, lw: 1.6, off: 2.2 });
    card(R.urn, '#f1e8d3'); card(R.fount, '#f1e8d3'); card(R.griddle, '#4c4640'); card(R.toaster, '#f1e8d3'); card(R.pie, '#f1e8d3'); card(R.pass, '#e9dcbf');
    // urn body in the back
    const u = R.urn; const bw = Math.min(u.w * .46, 74);
    shape(c, [[u.x + u.w * .34 - bw / 2, u.y + 8], [u.x + u.w * .34 + bw / 2, u.y + 8], [u.x + u.w * .34 + bw / 2, u.y + u.h * .38], [u.x + u.w * .34 - bw / 2, u.y + u.h * .38]], { fill: '#b7c8c4', smooth: false, lw: 1.5 });
    c.fillStyle = INK; c.font = '600 11px Jost, sans-serif'; c.textAlign = 'center'; c.fillText('COFFEE', u.x + u.w * .34, u.y + 22);
    const tx = u.x + u.w * .82; shape(c, ell(tx, u.y + u.h * .24, u.w * .13, u.w * .13, 9), { fill: '#e5a15a', lw: 1.3 }); c.fillStyle = INK; c.fillText('TEA', tx, u.y + u.h * .24 + 4);
    c.textAlign = 'left';
    line(c, [[u.x + u.w * .62, u.y + 8], [u.x + u.w * .62, u.y + u.h - 8]], { lw: 1, ink: 'rgba(42,36,32,.3)', smooth: false });
    c.fillStyle = '#f1e8d3'; c.font = '600 11px Jost, sans-serif'; c.save(); c.letterSpacing = '1.2px'; c.fillText('GRIDDLE', R.griddle.slots[0].x + 6, R.griddle.y + 15); c.restore();
    label(R.toaster, 'Toaster'); label(R.pie, 'Pie'); label(R.pass, 'The pass');
    // griddle plate
    const G = R.griddle; for (const s of G.slots) rectS(c, s.x + 3, s.y + 22, s.w - 8, s.h - 30, { fill: '#2f2a26', lw: 1, ink: '#6a625a', off: 0 });
    // shelf
    const A = R.pass; line(c, [[A.x + 6, A.y + A.h * .74], [A.x + A.w - 6, A.y + A.h * .74]], { lw: 2.2, smooth: false });
  }

  // ——— people ———
  syncActors(S) {
    const A = this.actors;
    for (const p of S.parties) {
      if (A.has(p.id)) continue;
      const list = []; const n = p.n;
      for (let k = 0; k < n; k++) {
        const who = p.who[k]; const look = who ? LOOKS[who](S.year) : strangerLook((p.seed || 1) + k * 31, S.year);
        list.push({ who, look, key: (who || 'x' + (p.seed + k * 31)) + S.year, x: this.doorX ?? this.w, tx: this.stoolX(p.seat + k), seat: p.seat + k, dir: k === 0 && n > 1 ? 1 : k > 0 ? -1 : (p.seat < 2 ? 1 : p.seat > 2 ? -1 : 1) });
      }
      A.set(p.id, { p, list, leaving: false, born: this.t, phase: Math.random() * 6 });
    }
    for (const [id, a] of A) { if (a.p.state === 'gone' && !a.leaving) { a.leaving = true; for (const m of a.list) m.tx = this.doorX ?? this.w; } }
  }

  drawActors(S, dt) {
    const { c, L } = this; const y = L.counterY + 2; const scale = L.ps * this.dpr;
    const talking = S.cap?.who;
    const list = [...this.actors.values()].flatMap(a => a.list.map(m => ({ a, m })));
    list.sort((p, q) => (p.m.look.size || 1) - (q.m.look.size || 1)).reverse();
    for (const { a, m } of list) {
      m.x += (m.tx - m.x) * Math.min(1, dt * (a.leaving ? 5 : 6));
      const moving = Math.abs(m.tx - m.x) > 3;
      if (a.leaving && !moving) { this.actors.delete(a.p.id); continue; }
      const st = a.p.state; let mood = a.p.mood || 'idle';
      if (st === 'eat' && Math.sin(this.t * 7 + a.phase) > .45 && !a.p.talks) mood = 'eat';
      if (st === 'hush') mood = 'idle'; if (a.leaving) mood = mood === 'cross' ? 'cross' : 'idle';
      const blink = !a.leaving && ((this.t + a.phase * 3) % 3.7) < .12;
      const key = `${m.key}|${mood}|${m.dir}|${blink ? 1 : 0}`;
      const sp = sprite(key, 170, 190, scale, (x) => { x.translate(85, 188); drawPerson(x, m.look, mood, m.dir, blink); });
      const speaking = talking && m.who === talking;
      const bob = moving ? Math.abs(Math.sin(this.t * 11)) * 5 : speaking ? Math.sin(this.t * 14) * 1.6 : 0;
      c.drawImage(sp, m.x - 85 * L.ps, y - 188 * L.ps - bob, sp.width / this.dpr, sp.height / this.dpr);
    }
  }

  itemSprite(kind, px) { const s = px / 48 * this.dpr; return sprite('i' + kind, 64, 64, s, (x) => { x.translate(32, 32); drawItem(x, kind); }); }
  drawIcon(kind, x, y, px, alpha = 1) { const s = this.itemSprite(kind, px); const c = this.c; if (alpha < 1) c.globalAlpha = alpha; const d = 64 / 48 * px; c.drawImage(s, x - d / 2, y - d / 2, d, d); c.globalAlpha = 1; }

  drawSlips(S) {
    const { c, L } = this; const t = this.t;
    for (const p of S.parties) {
      if (p.state === 'gone' || p.state === 'eat' || p.state === 'done') continue;
      const seatC = this.stoolX(p.seat) + (p.n - 1) * L.sw / 2;
      const a = this.actors.get(p.id); if (a && t - a.born < .35) continue;
      const w = Math.min(L.sw - 5, 118), h = L.slipH, x = seatC - w / 2, y = L.slipY;
      const hush = p.state === 'hush';
      const f = hush ? p.hushT / (p.hushFor || HUSH) : p.pat / p.pmax;
      const low = !hush && f < .3; const sway = low && !p.reg ? Math.sin(t * 18) * 1 : 0;
      c.save(); c.translate(sway, 0);
      c.fillStyle = hush ? '#fff3b8' : '#fbf6e8'; c.fillRect(x, y, w, h);
      c.strokeStyle = INK; c.lineWidth = 1.2; c.strokeRect(x, y, w, h);
      c.fillStyle = TOMATO; c.fillRect(x, y, w, 3);
      c.fillStyle = INK; c.fillRect(x + w / 2 - 4, y - 4, 8, 7);
      const barH = 6; c.fillStyle = 'rgba(42,36,32,.12)'; c.fillRect(x + 3, y + h - barH - 2, w - 6, barH);
      c.fillStyle = hush ? MUSTARD : low ? TOMATO : TEAL; c.fillRect(x + 3, y + h - barH - 2, (w - 6) * Math.max(0, f), barH);
      if (hush) {
        c.fillStyle = INK; c.textAlign = 'center';
        const txt = p.silent ? '...' : 'usual?'; let fs = Math.round(Math.min(h * .42, 34)); c.font = `${fs}px "Over the Rainbow", cursive`; const tw = c.measureText(txt).width; if (tw > w - 12) { fs = Math.floor(fs * (w - 12) / tw); c.font = `${fs}px "Over the Rainbow", cursive`; } c.fillText(txt, seatC, y + h * .56);
      } else {
        const all = [...p.got.map(k => ({ k, d: 1 })), ...p.need.map(k => ({ k, d: 0 }))];
        const cols = all.length > 2 ? 2 : Math.max(1, all.length), rows = Math.ceil(all.length / cols);
        const cell = Math.min((w - 6) / cols, (h - 14) / rows); const icon = Math.min(cell * .92, 44);
        all.forEach((it, i) => { const cx = x + w / 2 + ((i % cols) - (cols - 1) / 2) * (w - 6) / cols, cy = y + 4 + (h - 12) / 2 + (Math.floor(i / cols) - (rows - 1) / 2) * cell;
          this.drawIcon(it.k, cx, cy, icon, it.d ? .28 : 1);
          if (it.d) { c.strokeStyle = TEAL; c.lineWidth = 2.4; c.beginPath(); c.moveTo(cx - 7, cy); c.lineTo(cx - 2, cy + 5); c.lineTo(cx + 8, cy - 7); c.stroke(); } });
      }
      c.restore();
    }
  }

  drawCounter(S) {
    const { c, L } = this; const y = L.counterY + L.counterH * .42; const t = this.t; reseed(700);
    const px = Math.min(L.counterH * .9, L.sw * .55);
    for (const p of S.parties) { if (p.state === 'eat' || p.got.length) { const g = p.got.slice(0, 6); g.forEach((k, i) => { const x = this.stoolX(p.seat) + (p.n - 1) * L.sw / 2 + (i - (g.length - 1) / 2) * Math.min(px * .7, (L.sw * p.n - 8) / g.length); this.drawIcon(k, x, y, px); }); } }
    for (let i = 0; i < STOOLS; i++) {
      const s = S.stools[i]; if (s.ghostCup) this.drawIcon('coffee', this.stoolX(i), y, px);
      if (s.dirty && !s.dirty.follower) {
        const cx = this.stoolX(i) + (Math.max(1, s.dirty.n) - 1) * L.sw / 2, w = L.sw * Math.max(1, s.dirty.n) - 8;
        c.globalAlpha = .55 + .15 * Math.sin(t * 5); c.fillStyle = MUSTARD; c.fillRect(cx - w / 2, L.counterY + 2, w, L.counterH - 10); c.globalAlpha = 1;
        const n = Math.min(3, s.dirty.plates.length); for (let k = 0; k < n; k++) { const x = cx + (k - (n - 1) / 2) * px * .5 - 8; shape(c, ell(x, y + 3, px * .34, px * .13, 8), { fill: '#fbf5e6', lw: 1, wobble: 0, off: .3 }); }
        for (let k = 0; k < 3; k++) { c.fillStyle = '#b9b2a2'; c.strokeStyle = INK; c.lineWidth = .9; c.beginPath(); c.ellipse(cx + px * .42 + k * 3, y + 6 - k * 2.2, 7, 3.2, 0, 0, 7); c.fill(); c.stroke(); }
      }
    }
  }

  ring(r, col = TOMATO) { const c = this.c; const a = .55 + .45 * Math.sin(this.t * 7); c.strokeStyle = col; c.lineWidth = 3.5; c.globalAlpha = a; c.strokeRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2); c.globalAlpha = 1; }

  drawGlass(cx, baseY, h, g, drink) { // a cup seen side-on, cut away so you can watch it fill
    const c = this.c; const w = h * .62; const x = cx - w / 2, top = baseY - h;
    c.fillStyle = '#fbf8ee'; c.fillRect(x, top, w, h);
    if (g) { const col = { coffee: '#4a2c1c', tea: '#c78b35', milk: '#fdf9ee', choc: '#8a5a3a', straw: '#ef9ba0', cola: '#3a2017' }[g.kind]; const f = Math.min(1, g.fill); c.fillStyle = col; c.fillRect(x + 2, baseY - 2 - (h - 4) * f, w - 4, (h - 4) * f); if (g.spilled) { c.fillRect(x - 5, baseY - 4, w + 10, 4); c.fillRect(x + w, top, 3, h); } }
    const ly = baseY - 2 - (h - 4) * LINE, ly0 = baseY - 2 - (h - 4) * LINE_LO, ly1 = baseY - 2 - (h - 4) * LINE_HI;
    c.fillStyle = 'rgba(60,143,136,.28)'; c.fillRect(x + w + 2, ly1, 9, ly0 - ly1);
    c.strokeStyle = TOMATO; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 7, ly); c.lineTo(x + w + 11, ly); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 1.6; c.strokeRect(x, top, w, h);
    if (g?.kind === 'coffee' || g?.kind === 'tea' || drink) { c.beginPath(); c.arc(x, top + h * .5, h * .18, Math.PI * .5, Math.PI * 1.5); c.stroke(); }
    return { x, top, w, ly };
  }

  drawStations(S, menu, sel, hover) {
    const { c, R } = this; const t = this.t; reseed(101);
    const u = R.urn, f = R.fount;
    const uc = u.x + u.w * .34; const base = u.y + u.h - 10, gh = Math.min(u.h * .44, 70);
    const ug = S.urn.glass;
    const uKind = ug?.kind || 'coffee', ucx = uKind === 'tea' ? u.x + u.w * .82 : uc;
    if (S.urn.pouring) { c.fillStyle = uKind === 'tea' ? '#c78b35' : '#4a2c1c'; c.fillRect(ucx - 2.5, u.y + u.h * .38, 5, base - gh * 1 - (u.y + u.h * .38) + gh * .9); }
    this.drawSpout(uc, u.y + u.h * .38, !!S.urn.pouring && uKind === 'coffee'); this.drawSpout(u.x + u.w * .82, u.y + u.h * .36, !!S.urn.pouring && uKind === 'tea');
    if (ug) { this.drawGlass(ucx, base, gh, ug); if (ug.ready) this.tag(ucx, base - gh - 2, ug.perfect ? 'to the line' : ug.spilled ? 'spilled' : 'ok', ug.perfect ? TEAL : MUSTARD); }
    else { const c2 = c; c2.globalAlpha = .3; this.drawGlass(uc, base, gh, null); c2.globalAlpha = 1; }
    // fountain
    const taps = this.tapRects(menu); const gr = f.glassR;
    const names = { milk: 'Milk', choc: 'Choc', straw: 'Straw', cola: 'Cola' }, cols = { milk: '#f7f2e4', choc: '#8a5a3a', straw: '#ef9ba0', cola: '#3a2017' };
    for (const tp of taps) {
      const cx = tp.x + tp.w / 2; const on = S.fount.pouring === tp.kind;
      rectS(c, cx - 13, f.y + 26, 26, f.h * .42, { fill: cols[tp.kind], lw: 1.3, off: .8 });
      shape(c, box(cx - 4, f.y + 22 + f.h * .42, 8, 10), { fill: '#b7c8c4', lw: 1.1, smooth: false, off: 0 });
      const lev = on ? 10 : -10; line(c, [[cx, f.y + 26], [cx + lev * .6, f.y + 10]], { lw: 3, ink: INK, wobble: 0 }); shape(c, ell(cx + lev * .6, f.y + 9, 4.5, 4.5, 7), { fill: TOMATO, lw: 1.1, off: .4, wobble: .1 });
      c.fillStyle = INK; c.font = `600 ${tp.w < 46 ? 9.5 : 11}px Jost, sans-serif`; c.textAlign = 'center'; c.fillText(names[tp.kind], cx, f.y + f.h - 8);
    }
    const fg = S.fount.glass; const fbase = f.y + f.h - 10, fh = Math.min(f.h * .56, 86); const fcx = gr.x + gr.w / 2;
    if (S.fount.pouring) { const k = S.fount.pouring; c.fillStyle = cols[k]; c.fillRect(fcx - 2.5, f.y + 8, 5, fbase - fh * .1 - f.y - 8); }
    if (fg) { this.drawGlass(fcx, fbase, fh, fg); if (fg.ready) this.tag(fcx, fbase - fh - 2, fg.perfect ? 'to the line' : fg.spilled ? 'spilled' : 'ok', fg.perfect ? TEAL : MUSTARD); }
    else { c.globalAlpha = .3; this.drawGlass(fcx, fbase, fh, null); c.globalAlpha = 1; }
    // griddle
    const G = R.griddle;
    for (const b of G.bins) {
      const on = menu.includes(b.kind); c.globalAlpha = on ? 1 : .22;
      rectS(c, b.x + 5, b.y + 5, b.w - 9, b.h - 8, { fill: b.kind === 'eggs' ? '#e8dcc0' : '#c8795c', lw: 1.2, off: .8 });
      c.fillStyle = INK; c.font = '600 11px Jost, sans-serif'; c.textAlign = 'center'; c.fillText(b.kind === 'eggs' ? 'Eggs' : 'Patty', b.x + b.w / 2, b.y + b.h - 10);
      if (b.kind === 'eggs') for (let i = 0; i < 3; i++) { shape(c, ell(b.x + b.w / 2 - 11 + i * 11, b.y + b.h * .42, 5, 6.5, 8), { fill: '#fdf8ec', lw: 1, off: .3, wobble: .2 }); }
      else shape(c, ell(b.x + b.w / 2, b.y + b.h * .42, 14, 8, 9), { fill: '#a0523c', lw: 1, off: .3 });
      c.globalAlpha = 1;
    }
    G.slots.forEach((s, i) => { reseed(300 + i * 40); this.drawCook(S.griddle[i], s); });
    reseed(500);
    // toaster
    const T = R.toaster; const tw = Math.min(T.w * .82, 130), th = T.h * .42, tx = T.x + T.w / 2 - tw / 2, ty = T.y + T.h - th - 10;
    S.toaster.forEach((b, i) => { if (!b) return; const sx = tx + tw * (i ? .54 : .1), sw = tw * .36; const up = b.ready ? th * .5 + Math.min(1, (t * 4) % 99) : 5; rectS(c, sx, ty - up, sw, th * .7, { fill: b.ready ? '#c98a4a' : '#e6c98f', lw: 1.3, off: .6 }); });
    shape(c, [[tx, ty + th], [tx + 4, ty + 6], [tx + 12, ty], [tx + tw - 12, ty], [tx + tw - 4, ty + 6], [tx + tw, ty + th]], { fill: '#bccbc6', lw: 1.6, off: 1.2 });
    c.fillStyle = '#2a2420'; c.fillRect(tx + tw * .1, ty + 1, tw * .36, 4); c.fillRect(tx + tw * .54, ty + 1, tw * .36, 4);
    S.toaster.forEach((b, i) => { const lx = tx + (i ? tw + 3 : -3); const ly = ty + (b && !b.ready ? th * .75 : th * .2); c.fillStyle = INK; c.fillRect(lx - 2, ly, 5, 9); });
    if (S.toaster.some(b => b && !b.ready)) { c.fillStyle = '#e8785a'; c.globalAlpha = .55 + .3 * Math.sin(t * 12); c.fillRect(tx + 8, ty + 8, tw - 16, 3); c.globalAlpha = 1; }
    S.toaster.forEach((b, i) => { if (b?.ready) this.tag(T.slots[i].x + T.slots[i].w / 2, ty - th * .5, 'up', TEAL); });
    // pie
    for (const k of ['apple', 'cherry']) {
      const r = R.pie[k]; const on = menu.includes(k); const cx = r.x + r.w / 2, cy = r.y + r.h * .55, rad = Math.min(r.w * .4, r.h * .32); const pie = S.pie[k];
      c.globalAlpha = on ? 1 : .22;
      shape(c, ell(cx, cy, rad + 5, (rad + 5) * .9, 12), { fill: '#fbf5e6', lw: 1.2, off: .8, wobble: .4 });
      const n = pie.n; const fill = k === 'apple' ? '#d8a763' : '#a92a35';
      if (n > 0) { c.fillStyle = fill; c.beginPath(); c.moveTo(cx, cy); c.ellipse(cx, cy, rad, rad * .9, 0, -1.57, -1.57 + n / 6 * 6.283); c.closePath(); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
        c.strokeStyle = 'rgba(42,36,32,.45)'; c.lineWidth = 1; for (let i = 1; i < n; i++) { const a = -1.57 + i / 6 * 6.283; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * .9); c.stroke(); } }
      else { c.fillStyle = INK; c.font = '500 12px Jost, sans-serif'; c.textAlign = 'center'; c.fillText('in the oven', cx, cy + 4); }
      c.fillStyle = INK; c.font = '600 11px Jost, sans-serif'; c.textAlign = 'center'; c.fillText(k === 'apple' ? 'Apple' : 'Cherry', cx, r.y + r.h - 6);
      c.globalAlpha = 1;
    }
    // pass
    const A = R.pass; const px = Math.min(A.slots[0].w * .95, A.h * .46);
    S.pass.forEach((it, i) => { const s = A.slots[i]; if (it) { this.drawIcon(it.kind, s.x + s.w / 2, A.y + A.h * .74 - px * .34, px); if (sel?.at === 'pass' && sel.i === i) this.ring(s, TEAL); } });
    const b = A.bin; const bx = b.x + b.w / 2, by = A.y + A.h * .5;
    shape(c, [[bx - 13, by - 14], [bx + 13, by - 14], [bx + 10, by + 18], [bx - 10, by + 18]], { fill: '#8f9a93', lw: 1.3, smooth: false, off: 1 }); line(c, [[bx - 16, by - 15], [bx + 16, by - 15]], { lw: 2.4, smooth: false });
    c.fillStyle = INK; c.font = '600 10px Jost, sans-serif'; c.textAlign = 'center'; c.fillText('BIN', bx, by + 4);
    if (this.keys) { reseed(900); const kb = (x, y, ch) => { c.fillStyle = '#fbf6e8'; c.fillRect(x - 7.5, y - 7.5, 15, 15); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(x - 7.5, y - 7.5, 15, 15); c.fillStyle = INK; c.font = '600 10px Jost, sans-serif'; c.textAlign = 'center'; c.fillText(ch, x, y + 3.5); };
      kb(u.x + 12, u.y + 14, 'C'); kb(u.x + u.w - 12, u.y + 14, 'V'); for (const tp of taps) kb(tp.x + tp.w / 2 + 16, f.y + 14, { milk: 'M', choc: 'B', straw: 'N', cola: 'K' }[tp.kind]);
      kb(G.bins[0].x + 14, G.bins[0].y + 16, 'E'); if (menu.includes('burger')) kb(G.bins[1].x + 14, G.bins[1].y + 16, 'R'); kb(T.x + T.w - 14, T.y + 14, 'T'); kb(R.pie.apple.x + 16, R.pie.y + 30, 'P'); if (menu.includes('cherry')) kb(R.pie.cherry.x + R.pie.cherry.w - 14, R.pie.y + 14, 'O'); }
    if (this.pulse) { for (const r of this.pulse()) this.ring(r); }
  }

  drawSpout(x, y, on) { const c = this.c; rectS(c, x - 5, y - 4, 10, 12, { fill: '#8f9a93', lw: 1.2, off: .5 }); c.fillStyle = TOMATO; c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.roundRect(x + 2, y - (on ? 0 : 10), 16, 6, 3); c.fill(); c.stroke(); }

  drawCook(g, s) {
    if (!g) return; const c = this.c; const cx = s.x + s.w / 2 - 1, cy = s.y + 22 + (s.h - 30) / 2; const R0 = Math.min(s.w * .4, (s.h - 30) * .42);
    if (g.state === 'burnt') { shape(c, ell(cx, cy, R0, R0 * .8, 8), { fill: '#1a1411', ink: '#6a625a', lw: 1, wobble: 2 }); this.tag(cx, s.y + 24, 'scrape', '#7a7268'); return; }
    if (g.kind === 'eggs') {
      const k = g.state === 'a' ? g.t / 4.2 : 1;
      const white = g.state === 'done' ? (g.t > 4 ? '#e9d7b0' : '#fffdf3') : `rgb(${200 + 55 * k | 0},${200 + 53 * k | 0},${195 + 48 * k | 0})`;
      shape(c, [[cx - R0, cy], [cx - R0 * .6, cy - R0 * .8], [cx + R0 * .2, cy - R0 * .9], [cx + R0, cy - R0 * .2], [cx + R0 * .8, cy + R0 * .7], [cx - R0 * .3, cy + R0 * .8]], { fill: white, lw: 1.1, ink: '#6a625a', off: .4 });
      shape(c, ell(cx, cy, R0 * .36, R0 * .34, 9), { fill: g.state === 'done' ? '#f5a81f' : '#e8cf72', lw: 1, off: .2, wobble: .2 });
    } else {
      const col = g.state === 'a' ? '#c0614a' : g.state === 'flip' ? '#a0523c' : g.state === 'b' ? '#7a3e2c' : '#62301f';
      shape(c, ell(cx, cy, R0, R0 * .72, 10), { fill: col, lw: 1.2, ink: '#1c1612', off: .5 });
      if (g.state === 'b' || g.state === 'done') for (let i = -1; i <= 1; i++) line(c, [[cx - R0 * .6, cy + i * R0 * .3], [cx + R0 * .6, cy + i * R0 * .3 - 4]], { lw: 1.6, ink: '#2c1812', wobble: .3 });
    }
    if (Math.floor(this.t * 9 + cx) % 3 === 0 && g.state !== 'done') { c.strokeStyle = 'rgba(244,234,212,.55)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(cx + R0 * .7, cy - R0 * .7); c.quadraticCurveTo(cx + R0 * .95, cy - R0 * 1, cx + R0 * .7, cy - R0 * 1.25); c.stroke(); }
    const late = (g.state === 'flip' || g.state === 'done') && g.t > 3.6;
    if (g.state === 'flip') this.tag(cx, s.y + 24, 'flip', late ? TOMATO : MUSTARD); if (g.state === 'done') this.tag(cx, s.y + 24, 'done', late ? TOMATO : TEAL);
  }

  tag(cx, y, text, col) { const c = this.c; c.font = '600 12px Jost, sans-serif'; const w = c.measureText(text).width + 12; c.fillStyle = col; c.fillRect(cx - w / 2, y - 8, w, 17); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(cx - w / 2, y - 8, w, 17); c.fillStyle = col === MUSTARD ? INK : '#fffaf0'; c.textAlign = 'center'; c.fillText(text, cx, y + 5); }

  // ——— one frame ———
  frame(S, menu, ui, dt) {
    const { c, dpr, L } = this; this.t += dt;
    if (!this.backdrop || this.backYear !== S.year) { this.backdrop = this.buildBackdrop(S.year, S.def); this.backYear = S.year; }
    this.syncActors(S);
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(this.backdrop, 0, 0); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const P = L.scene; c.save(); c.beginPath(); c.rect(P.x, P.y, P.w, L.counterY + L.counterH - P.y); c.clip();
    this.drawStreet(S); this.drawWall(S);
    this.drawActors(S, dt);
    this.drawCounterRepaint(S); this.drawCounter(S); this.drawSlips(S);
    if (ui.dragTo != null) { c.strokeStyle = TEAL; c.lineWidth = 3; c.strokeRect(L.sx + ui.dragTo * L.sw + 2, L.scene.y + 12, L.sw - 4, L.counterY + L.counterH - L.scene.y - 14); }
    c.restore();
    this.drawStations(S, menu, ui.sel);
    if (ui.sel?.at === 'pie') { /* picked up from the case */ }
    if (ui.sel && ui.sel.at !== 'pass') { const [x, y] = this.refCentre(ui.sel); c.strokeStyle = TEAL; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 30, 0, 7); c.stroke(); }
    // flying plates, floaters, dragged item
    for (const f of this.fly) { f.t += dt / f.d; const k = Math.min(1, f.t); const e = k * k * (3 - 2 * k); this.drawIcon(f.kind, f.x0 + (f.x1 - f.x0) * e, f.y0 + (f.y1 - f.y0) * e - Math.sin(k * 3.14) * 30, 38); }
    this.fly = this.fly.filter(f => f.t < 1);
    for (const f of this.fx) { f.t += dt; const a = 1 - f.t / f.d; c.globalAlpha = Math.max(0, Math.min(1, a * 2)); c.textAlign = 'center'; c.font = f.font; c.lineWidth = 3.5; c.strokeStyle = '#fbf6e8'; c.lineJoin = 'round'; c.strokeText(f.text, f.x, f.y - f.t * 26); c.fillStyle = f.col; c.fillText(f.text, f.x, f.y - f.t * 26); c.globalAlpha = 1; }
    this.fx = this.fx.filter(f => f.t < f.d);
    if (ui.drag) this.drawIcon(ui.drag.kind, ui.drag.x, ui.drag.y - 16, 52);
  }

  drawCounterRepaint() { /* people sit behind the counter edge: repaint the counter band over the sprites */
    const { c, dpr, L } = this; const y = L.counterY; const sx = L.scene.x * dpr, sw = L.scene.w * dpr;
    c.drawImage(this.backdrop, sx, y * dpr, sw, (L.counterH + 2) * dpr, L.scene.x, y, L.scene.w, L.counterH + 2);
  }

  float(text, x, y, col = TEAL, big = false) { this.fx.push({ text, x, y, col, t: 0, d: big ? 1.9 : 1.2, font: big ? `25px "Fontdiner Swanky", serif` : '600 16px Jost, sans-serif' }); }
  flyItem(kind, x0, y0, x1, y1) { this.fly.push({ kind, x0, y0, x1, y1, t: 0, d: .24 }); }

  drawStreet(S) {
    const { c, win } = this; if (!win) return; const y = S.year, t = this.t;
    c.save(); c.beginPath(); c.rect(win.x + 2, win.y + 2, win.w - 4, win.h - 4); c.clip();
    if (S.def.snow) { c.fillStyle = '#fff'; for (let i = 0; i < 46; i++) { const x = win.x + ((i * 47 + t * (10 + i % 5 * 3)) % win.w), yy = win.y + ((i * 83 + t * (26 + i % 4 * 8)) % win.h); c.beginPath(); c.arc(x, yy, 1.4, 0, 7); c.fill(); } }
    else {
      const ground = win.y + win.h * .62; const per = 9; const k = ((t + 3) % per) / per; const px = win.x - 80 + k * (win.w + 160);
      if (k < .9) { const cols = ['#c9453a', '#3c8f88', '#d9a53a', '#5b6c7a']; const col = cols[Math.floor(t / per) % 4]; const w = 66, h = 15, cy = ground + 9;
        c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.moveTo(px, cy); c.lineTo(px + w, cy);
        if (y >= 1956 && y < 1963) { c.lineTo(px + w + 6, cy - h * .9); c.lineTo(px + w * .8, cy - h * .55); } else c.lineTo(px + w, cy - h * .5);
        c.lineTo(px + w * .72, cy - h * .55); c.lineTo(px + w * .6, cy - h * 1.2); c.lineTo(px + w * .32, cy - h * 1.2); c.lineTo(px + w * .2, cy - h * .55); c.lineTo(px, cy - h * .45); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = INK; c.beginPath(); c.arc(px + 14, cy, 5, 0, 7); c.arc(px + w - 14, cy, 5, 0, 7); c.fill(); }
    }
    c.restore();
  }

  drawWall(S) {
    const { c } = this; const ck = this.clock; if (!ck) return; const y = S.year;
    const frac = Math.min(1, S.t / S.def.dur), mins = 6 * 60 + frac * 9 * 60 + 4; // always four minutes fast
    const r = Math.min(20, this.L.sw * .28); const key = 'clockface' + (y >= 1962 ? 1 : 0);
    const f = sprite(key, 100, 70, this.dpr * 1, (x) => { x.translate(26, 26); shape(x, ell(0, 0, 20, 20, 14), { fill: '#fbf6e8', lw: 2, off: 1.4, wobble: .3 }); if (y >= 1962) { shape(x, ell(38, 4, 6.5, 6.5, 8), { fill: '#d9a53a', lw: 1.2, off: .6, wobble: .2 }); line(x, [[38, -2], [38, -13]], { lw: 1.1, wobble: .1 }); } });
    const s = r / 20; c.drawImage(f, ck.x - 26 * s, ck.y - 26 * s, 100 * s, 70 * s);
    const hand = (a, l, w) => { c.strokeStyle = INK; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(ck.x, ck.y); c.lineTo(ck.x + Math.sin(a) * l, ck.y - Math.cos(a) * l); c.stroke(); };
    hand(mins / 720 * 6.283, r * .55, 2.2); hand((mins % 60) / 60 * 6.283, r * .82, 1.5);
    if (S.def.moon && S.t > S.def.moon[0] - 1 && S.t < S.def.moon[1] + 2) { // the set on its bracket
      const w = this.win; const tw = Math.min(90, w.w * .3), th = tw * .72, tx = w.x + 10, ty = w.y + 8;
      rectS(c, tx, ty, tw, th, { fill: '#6a5038', lw: 1.6, off: 1.2 }); c.fillStyle = '#10130f'; c.fillRect(tx + 6, ty + 6, tw - 12, th - 12);
      c.fillStyle = '#c9ccc2'; c.fillRect(tx + 6, ty + th * .66, tw - 12, th * .34 - 6); c.fillStyle = '#f4f4ea'; const fl = Math.sin(this.t * 40) > 0 ? 1 : 0; c.fillRect(tx + tw * .5, ty + th * .34 + fl, 3, th * .32); c.fillRect(tx + tw * .5 - 3, ty + th * .4, 9, 3);
    }
  }
}
