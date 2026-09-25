// Paints the ship once, at one canvas pixel per ship pixel: hull plating, engines, the pipes and ducts in every
// ceiling, floor slabs, bulkheads and door frames, lift tubes and ladders through the decks, hull markings, and
// every room (which also hands back its crew stations, animated widgets, lights and windows).
import { mk, ctx2d, shade, bayer, hash, drawText, textWidth, rng, mixHex } from './util.js';
import { TYPES } from './rooms.js';
import { DH, CEIL, SLAB, HP, deckTop, floorY } from './ship.js';

const R_ = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const PX = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };

export function paintShip(ship) {
  const { width: W, height: H } = ship;
  const bg = mk(W, H), fg = mk(W, H), g = ctx2d(bg), f = ctx2d(fg);
  const R = rng((ship.seed ^ 0x9e3779b9) >>> 0);
  const out = { bg, fg, stations: [], widgets: [], lights: [], windows: [], doors: [], ext: [] };
  paintHull(ship, g, R, out);
  paintDecks(ship, g, R);
  for (const r of ship.rooms) buildRoom(ship, r, g, f, R, out);
  paintBulkheads(ship, g, out);
  paintShafts(ship, g);
  paintMarkings(ship, g, R, out);
  return out;
}

/* ---------- hull ---------- */
function paintHull(ship, g, R, out) {
  const { rows, width: W } = ship;
  let y0 = Infinity, y1 = -Infinity;
  rows.forEach((r, y) => { if (r) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); } });
  // engine bells first, so the housing overlaps their roots
  for (const e of ship.engines) {
    const bx = e.x - 10;
    for (let i = 0; i <= e.len; i++) {
      const x = bx - i, half = Math.round(e.h / 2 * (.72 + .28 * i / e.len));
      for (let y = e.y - half; y <= e.y + half; y++) {
        const edge = y === e.y - half || y === e.y + half || i === e.len;
        const t = (y - (e.y - half)) / (2 * half);
        let c = edge ? '#0b0d13' : t < .3 ? '#7a8498' : t < .7 ? '#555e70' : '#3a404e';
        if (!edge && i % 7 === 3) c = shade(c, -.25);
        PX(g, x, y, c);
      }
    }
    const mx = bx - e.len;
    R_(g, mx + 1, e.y - Math.round(e.h / 2) + 2, 2, e.h - 3, '#101218');
    out.ext.push({ kind: 'engine', x: mx, y: e.y, h: e.h });
  }
  const top = '#6b7690', mid = '#4b5468', bot = '#2e3442';
  for (let y = y0; y <= y1; y++) {
    const r = rows[y]; if (!r) continue;
    const up = rows[y - 1], dn = rows[y + 1];
    for (let x = r[0]; x <= r[1]; x++) {
      const edge = x === r[0] || x === r[1] || !up || !dn || x < up[0] || x > up[1] || x < dn[0] || x > dn[1];
      if (edge) { PX(g, x, y, '#0b0d13'); continue; }
      const topEdge = !rows[y - 2] || x < rows[y - 2][0] || x > rows[y - 2][1];
      const t = (y - y0) / (y1 - y0), band = Math.floor((y - y0) / 9), cell = Math.floor((x + band * 13) / 31);
      let c = t < .5 ? mixHex(top, mid, t * 2) : mixHex(mid, bot, (t - .5) * 2);
      const v = hash(cell, band);
      if (v > .8) c = shade(c, .07); else if (v < .15) c = shade(c, -.08);
      if (bayer(x, y) < .25 && (x + y) % 3 === 0) c = shade(c, -.05);
      if ((y - y0) % 9 === 0 || (x + band * 13) % 31 === 0) c = shade(c, -.22);
      if (topEdge) c = '#9aa6c0';
      PX(g, x, y, c);
    }
  }
  // greebles where the hull is thick: vents, hatches and little lights, away from the decks
  const inside = (x, y) => ship.decks.some((D, d) => D && x >= D.L - 3 && x <= D.R + 3 && y >= deckTop(d) - 3 && y < deckTop(d) + DH + 3);
  const hull = (x, y) => rows[y] && x > rows[y][0] + 1 && x < rows[y][1] - 1 && rows[y - 1] && rows[y + 1];
  for (let i = 0; i < 700; i++) {
    const x = R.int(0, W - 1), y = R.int(y0, y1), w = R.int(4, 10), h = R.int(2, 5);
    let ok = true;
    for (let yy = y - 1; yy <= y + h && ok; yy++) for (let xx = x - 1; xx <= x + w && ok; xx++) if (!hull(xx, yy) || inside(xx, yy)) ok = false;
    if (!ok) continue;
    const kind = R.int(0, 3);
    if (kind === 0) { R_(g, x, y, w, h, '#20242e'); for (let xx = x + 1; xx < x + w - 1; xx += 2) R_(g, xx, y + 1, 1, h - 2, '#3a4150'); }
    else if (kind === 1) { R_(g, x, y, w, h, shade('#4b5468', .12)); R_(g, x, y + h - 1, w, 1, '#262b36'); }
    else if (kind === 2) { PX(g, x, y, '#ffd28a'); PX(g, x + 1, y, '#ffd28a'); out.ext.push({ kind: 'porthole', x, y }); }
    else { R_(g, x, y, w, 1, '#262b36'); R_(g, x, y + h, w, 1, '#8a96b0'); }
  }
  // portholes along the top and bottom of the main hull
  for (const y of [ship.mainTop + 3, ship.mainBot - 5]) {
    const r = rows[y]; if (!r) continue;
    for (let x = r[0] + 14; x < r[1] - 10; x += R.int(10, 18)) if (hull(x, y) && hull(x + 1, y) && !inside(x, y)) { R_(g, x, y, 2, 2, '#ffd9a0'); PX(g, x, y, '#fff2d0'); out.ext.push({ kind: 'porthole', x: x + 1, y: y + 1 }); }
  }
  // masts and a radar dish on the tower, running lights at the tips
  const tTop = deckTop(0) - HP, tx = ship.decks[0].L, tw = ship.decks[0].R - tx;
  for (const [mx, h] of [[tx + Math.round(tw * .3), 14], [tx + Math.round(tw * .62), 9]]) {
    R_(g, mx, tTop - h, 1, h, '#8a94a6'); PX(g, mx - 1, tTop - h + 3, '#8a94a6'); PX(g, mx + 1, tTop - h + 3, '#8a94a6');
    out.ext.push({ kind: 'mastlight', x: mx, y: tTop - h - 1 });
  }
  out.ext.push({ kind: 'radar', x: tx + Math.round(tw * .82), y: tTop - 1 });
  let tip = null;
  rows.forEach((r, y) => { if (r && (!tip || r[1] > tip.x)) tip = { x: r[1], y }; });
  if (ship.style !== 'wedge') out.ext.push({ kind: 'deflector', x: tip.x - 4, y: tip.y });
  out.ext.push({ kind: 'runlight', x: tip.x + 1, y: tip.y, c: '#ff4a4a' });
  out.ext.push({ kind: 'runlight', x: rows[ship.mainTop][0] - 1, y: ship.mainTop, c: '#5aff7a' });
  out.ext.push({ kind: 'runlight', x: rows[ship.mainBot - 1][0] - 1, y: ship.mainBot - 1, c: '#5aff7a' });
}

/* ---------- decks: ceilings full of pipes, and floor slabs ---------- */
const PIPES = [['#3d7ea6', '#5fb4d9'], ['#8a3a5a', '#c45a82'], ['#3a8a6a', '#57c49a'], ['#8a6a2a', '#d8a84a'], ['#5a6070', '#8a94a6']];
function paintDecks(ship, g, R) {
  ship.decks.forEach((D, d) => {
    if (!D) return;
    const y0 = deckTop(d), y1 = floorY(d), L = D.L - 1, Rr = D.R + 1;
    R_(g, L, y0, Rr - L, CEIL, '#141820'); R_(g, L, y0, Rr - L, 1, '#0d1016'); R_(g, L, y0 + CEIL - 1, Rr - L, 1, '#0e1117');
    const [a, b] = PIPES[(d + ship.seed) % PIPES.length], [c, e] = PIPES[(d * 3 + 1 + ship.seed) % PIPES.length];
    R_(g, L, y0 + 1, Rr - L, 1, b); R_(g, L, y0 + 2, Rr - L, 1, a);
    R_(g, L, y0 + 4, Rr - L, 1, e);
    for (let x = L + R.int(4, 20); x < Rr - 2; x += R.int(18, 34)) {
      R_(g, x, y0 + 1, 2, 2, '#a8b0c0'); PX(g, x, y0, '#5a6272');
      if (R.chance(.3)) { R_(g, x + 6, y0 + 3, 4, 2, '#2a2f3a'); PX(g, x + 7, y0 + 3, '#ff5a3a'); }
    }
    // the slab: floor surface (rooms repaint their own), structure and rivets
    R_(g, L, y1, Rr - L, 1, '#4a5060'); R_(g, L, y1 + 1, Rr - L, 1, '#2e333e'); R_(g, L, y1 + 2, Rr - L, 2, '#181b22');
    for (let x = L + 3; x < Rr; x += 8) PX(g, x, y1 + 2, '#3a404c');
  });
  for (const s of ship.solid) { R_(g, s.x0, deckTop(s.d), s.x1 - s.x0, DH, '#2a2f3a'); for (let y = deckTop(s.d) + 3; y < deckTop(s.d) + DH - 2; y += 4) R_(g, s.x0 + 1, y, s.x1 - s.x0 - 2, 1, '#3a404c'); }
}

/* ---------- rooms ---------- */
function buildRoom(ship, r, g, f, R, out) {
  r.stations = []; r.widgets = []; r.lights = []; r.windows = [];
  const k = {
    r, R, g, f, x0: r.x0 + 1, x1: r.x1 - 1, top: deckTop(r.d0) + CEIL, fl: floorY(r.d1), lights: r.lights, windows: r.windows,
    st(o) { const s = { room: r, y: floorY(r.d1), watches: [], ...o, id: out.stations.length }; out.stations.push(s); r.stations.push(s); return s; },
    wd(o) { const w = { room: r, ...o }; out.widgets.push(w); r.widgets.push(w); return w; },
  };
  k.st = k.st.bind(k); k.wd = k.wd.bind(k);
  TYPES[r.type].build(k);
  // extra ladders through this room's floor or ceiling
  for (const l of r.ladders) {
    const x = Math.floor(l.x) - 2;
    if (l.dBot === r.d1) {            // the ladder comes down through the ceiling to our floor
      for (const px of [x, x + 5]) R_(g, px, k.top - CEIL, 1, k.fl - k.top + CEIL, '#8a94a6');
      for (let y = k.top - CEIL + 1; y < k.fl; y += 3) R_(g, x + 1, y, 4, 1, '#5a6272');
    } else {                          // a hatch in our floor with a railing round it
      R_(g, x, k.fl, 6, 2, '#0d1016');
      for (const px of [x - 1, x + 6]) R_(g, px, k.fl - 6, 1, 6, '#c8a040');
      R_(g, x - 1, k.fl - 6, 8, 1, '#e8c060');
    }
  }
  for (const L of r.lights) out.lights.push(L);
  for (const w of r.windows) out.windows.push(w);
}

/* ---------- bulkheads between rooms, with a doorway where the floors meet ---------- */
function paintBulkheads(ship, g, out) {
  const { rooms, decks } = ship;
  for (const r of rooms) {
    const top = deckTop(r.d0) + CEIL, fl = floorY(r.d1);
    for (const side of [0, 1]) {
      const x = side ? r.x1 : r.x0;            // the wall is the 2 pixels at x-1 and x
      const atHull = side ? r.x1 >= decks[r.d1].R : r.x0 <= decks[r.d1].L;
      R_(g, x - 1, top, 2, fl - top, atHull ? '#1a1d25' : '#2a2f3a');
      R_(g, side ? x : x - 1, top, 1, fl - top, atHull ? '#262a34' : '#454c5c');
      if (atHull || side) continue;
      // a neighbour on the same floor to our left: a doorway
      const nb = rooms.find(o => o !== r && o.x1 === r.x0 && o.d1 === r.d1);
      if (!nb) continue;
      R_(g, x - 1, fl - 15, 2, 15, '#0d1016'); R_(g, x - 2, fl - 16, 4, 1, '#6a7284');
      out.doors.push({ x, d: r.d1, y: fl, open: 0 });
    }
    // tall rooms: their inner floors meet the bulkheads as ledges
    for (const y of r.midFloors) { R_(g, r.x0 - 1, y, 2, SLAB, '#181b22'); }
  }
}

/* ---------- lift tubes and junction ladders through the slabs ---------- */
function paintShafts(ship, g) {
  for (const s of ship.shafts) {
    const x = s.x + 11;
    for (let i = 0; i + 1 < s.stops.length; i++) {
      const a = s.stops[i].d, y0 = floorY(a), y1 = deckTop(a + 1) + CEIL;
      R_(g, x, y0, 14, y1 - y0, '#11151d'); R_(g, x, y0, 1, y1 - y0, '#3b414d'); R_(g, x + 13, y0, 1, y1 - y0, '#3b414d');
      R_(g, x + 1, y0, 1, y1 - y0, '#8a94a6'); R_(g, x + 12, y0, 1, y1 - y0, '#5a6272'); R_(g, x + 2, y0, 10, y1 - y0, '#0f1622');
      R_(g, x - 1, y0, 16, 1, '#5a6272'); R_(g, x - 1, y1 - 1, 16, 1, '#5a6272');
    }
    // winding gear on top, a buffer pit below
    const topY = deckTop(s.stops[0].d), botY = floorY(s.stops.at(-1).d);
    R_(g, x - 1, topY, 16, CEIL, '#2a2f3a'); R_(g, x + 3, topY + 1, 8, 3, '#5a6272'); PX(g, x + 7, topY + 2, '#ffd24a');
    R_(g, x, botY, 14, SLAB, '#20242e'); R_(g, x + 2, botY + 1, 10, 1, '#d8b030');
  }
  for (const l of ship.ladders) {
    if (l.extra) {
      const x = Math.floor(l.x) - 2, y0 = floorY(l.dTop), y1 = deckTop(l.dBot) + CEIL;
      for (const px of [x, x + 5]) R_(g, px, y0, 1, y1 - y0, '#8a94a6');
      for (let y = y0 + 1; y < y1; y += 3) R_(g, x + 1, y, 4, 1, '#5a6272');
      continue;
    }
    const x = Math.floor(l.x) - 2, y0 = floorY(l.dTop), y1 = deckTop(l.dBot) + CEIL;
    R_(g, x - 1, y0, 8, y1 - y0, '#0d1016');
    for (const px of [x, x + 5]) R_(g, px, y0, 1, y1 - y0, '#8a94a6');
    for (let y = y0 + 1; y < y1; y += 3) R_(g, x + 1, y, 4, 1, '#5a6272');
  }
}

/* ---------- name and registry on the hull ---------- */
function paintMarkings(ship, g, R, out) {
  const y = ship.mainBot - HP + 2, r = ship.rows[y];
  const text = ship.reg + '  ' + ship.name.toUpperCase();
  const w = textWidth(text), x = Math.round(r[0] + (r[1] - r[0]) * .5 - w / 2);
  drawText(g, text, x, y, '#b8c2d8');
  // an accent stripe along the top of the main hull
  const sy = ship.mainTop + 1, sr = ship.rows[sy];
  for (let xx = sr[0] + 30; xx < sr[1] - 40; xx++) if (!ship.decks.some((D, d) => D && xx >= D.L - 2 && xx <= D.R + 2 && sy >= deckTop(d) - 2 && sy < deckTop(d) + DH)) PX(g, xx, sy, '#c8453a');
}
