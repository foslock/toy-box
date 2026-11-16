// Drawing the vault: the room you're in, big, and a map of all three floors.
import { C, FLOOR_COL, hash, shade, stone, laid, SPR_BM, mirror, dialBitmap, ladderBitmap, bitmap } from './mosaic.js';
import { RS, MID, DIAL, KEY, DOOR_TILE, DX, DY, ppos, pidx, rotTile, unrotTile, doorway, ladder, layerOf, layerCells, isLocked } from './game.js';

const SUB = 6;            // stones per tile edge, floors and walls
const FINE = 12;          // stones per tile edge, figures

// ---------------------------------------------------------------- a room, in its own frame
function roomColour(room, i, j) {
  const n = RS * SUB;
  const tc = (i / SUB) | 0, tr = (j / SUB) | 0;
  const si = i % SUB, sj = j % SUB;
  const home = FLOOR_COL[room.home[2]];
  const t = room.grid[tr * RS + tc];
  const h = hash(room.id * 97 + 3, i, j);
  const lime = C.lime[(h * 4) | 0];
  // walls: a band of the home floor's stone, inked where it meets the floor
  const edge = Math.min(i, j, n - 1 - i, n - 1 - j);
  const isWallTile = t === 1;
  if (isWallTile) {
    if (edge === 0) return C.ink;
    // ink line where wall meets floor (or a doorway)
    const near = (di, dj) => { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= n || b >= n) return false; const q = room.grid[((b / SUB) | 0) * RS + ((a / SUB) | 0)]; return q !== 1; };
    if (near(1, 0) || near(-1, 0) || near(0, 1) || near(0, -1)) return C.ink;
    if (edge === 1 || edge === 4) return shade(home[0], -0.25);
    // a run of stepped squares along the band
    const along = (edge === i || edge === n - 1 - i) ? j : i;
    if (edge === 2 || edge === 3) return (((along / 3) | 0) % 2 === 0) ? pickH(home, h) : shade(home[1], 0.35);
    return pickH(home, h);
  }
  if (t === 2) { // pillar, seen from above: rings
    const cx = tc * SUB + SUB / 2 - 0.5, cy = tr * SUB + SUB / 2 - 0.5;
    const d = Math.hypot(i - cx, j - cy);
    if (d > 3.1) return lime;
    if (d > 2.4) return C.ink;
    if (d > 1.4) return shade(home[0], 0.2);
    return C.white;
  }
  if (t === 3) { // pool
    const wv = (Math.sin((i + j * 0.6) * 0.9) > 0.55) ? shade(C.water[0], 0.35) : C.water[(h * 3) | 0];
    // ink lip next to floor
    const lip = (di, dj) => { const a = i + di, b = j + dj; const q = room.grid[((b / SUB) | 0) * RS + ((a / SUB) | 0)]; return q !== 3; };
    if (lip(1, 0) || lip(-1, 0) || lip(0, 1) || lip(0, -1)) return C.ink2;
    return wv;
  }
  // floor
  const cx = n / 2 - 0.5, cy = n / 2 - 0.5;
  const d = Math.hypot(i - cx, j - cy);
  // doorway thresholds keep the ink line on their sides
  for (let s = 0; s < 4; s++) if (room.doors[s]) {
    const [dc, dr] = DOOR_TILE[s];
    if (tc === dc && tr === dr) {
      const across = (s === 0 || s === 2) ? si : sj;
      if (across === 0 || across === SUB - 1) return C.ink;
      return (((s === 0 || s === 2) ? sj : si) % 2) ? C.limeDim : lime;
    }
  }
  // a border band one stone wide, two stones in from the wall
  const fe = edge - SUB;
  if (fe === 2) return shade(home[0], 0.12);
  if (fe === 3 && ((i + j) % 4 === 0)) return shade(home[2], 0.3);
  // the centre: a rosette, or the sun of the entrance, or a pedestal
  if (room.treasure) {
    if (Math.max(Math.abs(i - cx), Math.abs(j - cy)) < 5) return Math.max(Math.abs(i - cx), Math.abs(j - cy)) > 4 ? C.ink : (((i + j) & 1) ? C.white : '#efe9dc');
    if (d < 12 && d > 10.6) return C.gold[(h * 3) | 0];
  } else if (room.entry) {
    const a = Math.atan2(j - cy, i - cx);
    if (d > 4.5 && d < 13 && Math.cos(a * 8) > 0.55) return d > 10 ? C.gold[0] : C.gold[(h * 3) | 0];
    if (d > 4.5 && d < 5.6) return C.ink;
  } else if (room.up || room.down) {
    if (d > 4.4 && d < 5.6) return C.ink;
    if (d >= 5.6 && d < 7) return shade(home[0], 0.15);
  } else {
    if (d < 6.5) { const a = Math.atan2(j - cy, i - cx); return (Math.cos(a * 6) * 2 + d * 0.5 > 2.4) ? shade(home[1], 0.25) : (d < 2 ? home[0] : lime); }
  }
  // turnstone footing
  if (room.dial) {
    const dx = i - (DIAL[0] * SUB + SUB / 2 - 0.5), dy = j - (DIAL[1] * SUB + SUB / 2 - 0.5);
    const dd = Math.hypot(dx, dy);
    if (dd > 3.2 && dd < 4.3) return C.lapis[1];
  }
  return lime;
}
const pickH = (arr, h) => arr[(h * arr.length) | 0];

export function roomCanvas(room, tile) {
  const n = RS * SUB, s = tile / SUB;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(RS * tile); cv.height = cv.width;
  const x = cv.getContext('2d');
  x.fillStyle = C.mortar; x.fillRect(0, 0, cv.width, cv.height);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const col = roomColour(room, i, j);
    const k = (hash(room.id, i * 3, j * 5) - 0.5) * 0.12;
    stone(x, i * s, j * s, s, s, col[0] === '#' ? shade(col, k) : col, room.id * 10007 + j * 211 + i, 0.18, 0.14);
  }
  return cv;
}

// what you see through a doorway, as a strip one tile deep and three wide, drawn "north"
function peekCanvas(kind, home, tile) {
  const w = 3 * SUB, h = SUB, s = tile / SUB;
  const cv = document.createElement('canvas'); cv.width = Math.ceil(3 * tile); cv.height = Math.ceil(tile);
  const x = cv.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let col;
    const hh = hash(91, i, j);
    if (kind === 'open') {
      if (i < SUB - 1 || i > 2 * SUB) col = j === 0 ? C.void : pickH(home, hh);
      else if (i === SUB - 1 || i === 2 * SUB) col = C.ink;
      else col = C.lime[(hh * 4) | 0];
      if (j < 2 && i >= SUB && i < 2 * SUB) col = shade(C.lime[0], -0.15 * (2 - j)); // fades away
    } else if (kind === 'wall' || kind === 'lockedFar') {
      col = j === h - 1 ? C.ink : j === 0 ? C.void : pickH(home, hh);
      if (kind === 'lockedFar' && i >= SUB && i < 2 * SUB && j > 0) col = (i % 2) ? C.gold[(hh * 3) | 0] : C.ink;
    } else { // edge of the cube: earth
      col = hh < 0.12 ? '#4a403a' : (hh < 0.5 ? C.void : C.void2);
    }
    stone(x, i * s, j * s, s, s, col, 5000 + j * 61 + i * 7 + (kind.length * 13), 0.2, 0.15);
  }
  return cv;
}

// ---------------------------------------------------------------- the view
export class View {
  constructor(cv) {
    this.cv = cv; this.x = cv.getContext('2d');
    this.cache = new Map(); this.dpr = 1;
    this.fx = [];  // floating stones (dust, puffs)
  }
  resize(w, h, dpr, portrait) {
    this.w = w; this.h = h; this.dpr = dpr; this.portrait = portrait;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.cache.clear();
  }
  // rect for the room (css px) and for the map
  setRects(room, map) {
    this.room = room; this.map = map;
    this.tile = room.size / (RS + 2);
    this.cache.clear();
  }
  get(key, make) { let v = this.cache.get(key); if (!v) { v = make(); this.cache.set(key, v); } return v; }

  bg() {
    return this.get('bg', () => {
      const s = 22 * this.dpr, W = this.cv.width, H = this.cv.height;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const x = cv.getContext('2d');
      x.fillStyle = C.mortarDark; x.fillRect(0, 0, W, H);
      for (let j = 0; j * s < H + s; j++) for (let i = 0; i * s < W + s; i++) {
        const h = hash(3, i, j);
        const col = h < 0.05 ? '#3d3430' : h < 0.55 ? C.void : C.void2;
        stone(x, i * s, j * s, s, s, col, i * 977 + j * 31, 0.22, 0.1);
      }
      return cv;
    });
  }

  roomImg(room) { const T = this.tile * this.dpr; return this.get(`room${room.id}:${room.grid.join('').length}:${T}`, () => roomCanvas(room, T)); }
  sprite(name, flip) {
    const T = this.tile * this.dpr;
    return this.get(`spr:${name}:${flip ? 1 : 0}:${T}`, () => { const bm = flip ? mirror(SPR_BM[name]) : SPR_BM[name]; return laid(bm, T / FINE, name.length * 31 + (flip ? 7 : 0), { jit: 0.12, gap: 0.1 }); });
  }
  dialImg(type) { const T = this.tile * this.dpr; return this.get(`dial:${type}:${T}`, () => laid(dialBitmap(type), T * 1.2 / 18, 77, { jit: 0.1, gap: 0.1 })); }
  ladderImg(dir) { const T = this.tile * this.dpr; return this.get(`lad:${dir}:${T}`, () => laid(ladderBitmap(dir), T / 12, 55 + dir, { jit: 0.1, gap: 0.1 })); }
  peek(kind, home, z) { const T = this.tile * this.dpr; return this.get(`peek:${kind}:${z}:${T}`, () => peekCanvas(kind, home, T)); }

  // ---- convert css px ↔ world tile of the current room
  tileAt(px, py) {
    const r = this.room, T = this.tile;
    const c = Math.floor((px - r.x) / T) - 1, rr = Math.floor((py - r.y) / T) - 1;
    return [c, rr];
  }
  tileCentre(c, r) { const R = this.room, T = this.tile; return [R.x + (c + 1.5) * T, R.y + (r + 1.5) * T]; }

  // ---------------------------------------------------------------- frame
  draw(G, t) {
    const x = this.x, d = this.dpr;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.drawImage(this.bg(), 0, 0);
    x.setTransform(d, 0, 0, d, 0, 0);
    this.drawRoom(G, t);
    this.drawMap(G, t);
  }

  drawRoom(G, t) {
    const x = this.x, st = G.st, R = this.room, T = this.tile;
    const id = G.p.room, room = st.rooms[id];
    const cx = R.x + R.size / 2, cy = R.y + R.size / 2;
    // shake
    let sx = 0, sy = 0;
    if (G.shake > 0) { sx = (Math.random() - 0.5) * G.shake * 6; sy = (Math.random() - 0.5) * G.shake * 6; }
    const A = G.anim;
    let rot = st.ori[id] * Math.PI / 2, lift = 0, slide = [0, 0], fade = 1;
    if (A && A.type === 'turn') {
      const e = A.ease;
      if (A.axis === 'H' && A.ids.includes(id)) rot = (A.oriFrom[id] + A.dir * e) * Math.PI / 2;
      else if (A.ids.includes(id)) lift = Math.sin(Math.PI * A.raw) * T * 0.5 * (A.dirScreen || 1);
    }
    if (A && A.type === 'slide') { const k = 1 - A.ease; slide = [A.dx * k * R.size, A.dy * k * R.size]; }
    if (A && A.type === 'climb') fade = A.raw < 0.5 ? 1 - A.raw * 2 : (A.raw - 0.5) * 2;
    x.save();
    x.translate(cx + sx + slide[0], cy + sy + lift + slide[1]);
    // doorway peeks (world frame), hidden while this room spins
    const spinning = A && A.type === 'turn' && A.ids.includes(id);
    if (!spinning) {
      for (let s = 0; s < 4; s++) {
        const dw = doorway(st, id, s);
        if (dw.kind === 'none' || dw.kind === 'locked') continue;
        const nb = dw.to != null ? st.rooms[dw.to] : null;
        const img = this.peek(dw.kind, nb ? FLOOR_COL[nb.home[2]] : null, nb ? nb.home[2] : 9);
        x.save(); x.rotate(s * Math.PI / 2);
        x.drawImage(img, -1.5 * T, -RS / 2 * T - T, 3 * T, T);
        x.restore();
      }
    }
    x.rotate(rot);
    x.globalAlpha = fade;
    x.drawImage(this.roomImg(room), -RS / 2 * T, -RS / 2 * T, RS * T, RS * T);
    // features in the room's own frame
    const at = (c, r) => [(c - RS / 2 + 0.5) * T, (r - RS / 2 + 0.5) * T];
    if (room.up || room.down) {
      const dir = room.up ? 1 : -1, L = ladder(st, id, dir);
      const [px, py] = at(MID, MID);
      const lit = L.kind === 'open' || L.kind === 'sky';
      if (lit) { x.fillStyle = L.kind === 'sky' ? 'rgba(255,226,140,.5)' : 'rgba(246,240,226,.35)'; x.beginPath(); x.arc(px, py, T * (0.75 + 0.06 * Math.sin(t * 4)), 0, 7); x.fill(); }
      x.save(); x.translate(px, py); x.rotate(-rot);
      x.drawImage(this.ladderImg(dir), -T / 2, -T / 2, T, T);
      if (!lit) { // sealed: a cross of dark stones
        x.strokeStyle = 'rgba(31,26,23,.85)'; x.lineWidth = T * 0.12; x.lineCap = 'round';
        x.beginPath(); x.moveTo(-T * 0.32, -T * 0.32); x.lineTo(T * 0.32, T * 0.32); x.moveTo(T * 0.32, -T * 0.32); x.lineTo(-T * 0.32, T * 0.32); x.stroke();
      }
      x.restore();
    }
    if (room.dial) {
      const [px, py] = at(...DIAL);
      x.save(); x.translate(px, py);
      if (spinning && A.axis === 'H') x.rotate(A.dir * A.ease * Math.PI * 2);
      if (room.dial !== 'H') x.rotate(-rot); // roll dials point along the world axis they roll
      x.drawImage(this.dialImg(room.dial), -T * 0.6, -T * 0.6, T * 1.2, T * 1.2);
      x.restore();
    }
    if (room.key && !(st.keysTaken >> id & 1)) {
      const [px, py] = at(...KEY);
      x.save(); x.translate(px, py + Math.sin(t * 3) * T * 0.06); x.rotate(-rot);
      x.drawImage(this.sprite('key'), -T / 2, -T / 2, T, T); x.restore();
    }
    if (room.treasure && !st.treasure) {
      const [px, py] = at(MID, MID);
      x.fillStyle = `rgba(243,215,122,${0.35 + 0.15 * Math.sin(t * 3)})`; x.beginPath(); x.arc(px, py, T * 0.8, 0, 7); x.fill();
      x.save(); x.translate(px, py - T * 0.1 + Math.sin(t * 2.4) * T * 0.07); x.rotate(-rot);
      x.drawImage(this.sprite('gem'), -T * 0.55, -T * 0.55, T * 1.1, T * 1.1); x.restore();
    }
    if (room.lock >= 0 && !(st.unlocked >> id & 1)) {
      const [px, py] = at(...DOOR_TILE[room.lock]);
      x.save(); x.translate(px, py); x.rotate(room.lock * Math.PI / 2);
      for (let k = -2; k <= 2; k++) { x.fillStyle = C.ink; x.fillRect(k * T * 0.18 - T * 0.06, -T * 0.5, T * 0.12, T); x.fillStyle = C.gold[(k + 2) % 3]; x.fillRect(k * T * 0.18 - T * 0.04, -T * 0.46, T * 0.08, T * 0.92); }
      x.fillStyle = C.gold[1]; x.fillRect(-T * 0.5, -T * 0.12, T, T * 0.22); x.fillStyle = C.ink; x.fillRect(-T * 0.08, -T * 0.06, T * 0.16, T * 0.14);
      x.restore();
    }
    x.restore();
    x.globalAlpha = 1;

    // creatures in the world frame (upright), carried round while the room spins
    x.save();
    x.translate(cx + sx + slide[0], cy + sy + lift + slide[1]);
    x.globalAlpha = fade;
    const spinA = spinning && A.axis === 'H' ? (A.dir * A.ease - A.dir) * Math.PI / 2 : 0;
    const place = (wc, wr) => {
      let px = (wc - RS / 2 + 0.5) * T, py = (wr - RS / 2 + 0.5) * T;
      if (spinA) { const c = Math.cos(spinA), s = Math.sin(spinA); [px, py] = [px * c - py * s, px * s + py * c]; }
      return [px, py];
    };
    for (const b of G.beetles) {
      const [px, py] = place(b.fx, b.fy);
      const name = (Math.floor(t * 6 + b.seed) % 2) ? 'beetle' : 'beetle2';
      x.save(); x.translate(px, py); x.rotate(b.face * Math.PI / 2);
      x.drawImage(this.sprite(name), -T / 2, -T / 2, T, T); x.restore();
    }
    const p = G.p;
    {
      const [px, py] = place(p.fx, p.fy);
      const walk = p.moving ? (Math.floor(t * 8) % 2) : 0;
      let name = p.face === 2 ? 'down' : p.face === 0 ? 'up' : 'side';
      if (walk) name += '2';
      const flip = p.face === 3;
      const blink = p.hurt > 0 && Math.floor(t * 16) % 2;
      if (!blink) {
        x.fillStyle = 'rgba(31,26,23,.25)'; x.beginPath(); x.ellipse(px, py + T * 0.42, T * 0.32, T * 0.1, 0, 0, 7); x.fill();
        x.drawImage(this.sprite(name, flip), px - T / 2, py - T * 0.62, T, T);
      }
      if (p.swing > 0) {
        const f = p.face, k = 1 - p.swing / 0.18;
        x.strokeStyle = C.white; x.lineWidth = T * 0.1; x.lineCap = 'round';
        const a0 = f * Math.PI / 2 - Math.PI / 2 - 0.9 + k * 1.8;
        x.beginPath(); x.arc(px, py - T * 0.1, T * 0.75, a0 - 0.5, a0); x.stroke();
      }
      if (G.st.treasure && !G.won) { // the gold tessera held overhead
        x.drawImage(this.sprite('gem'), px - T * 0.35, py - T * 1.25, T * 0.7, T * 0.7);
      }
    }
    for (const f of G.fx) {
      const [px, py] = place(f.x, f.y);
      x.globalAlpha = Math.max(0, 1 - f.age / f.life) * fade;
      x.fillStyle = f.col; const s = T * f.size;
      x.fillRect(px - s / 2 + f.vx * f.age * T, py - s / 2 + f.vy * f.age * T + f.age * f.age * T * f.g, s, s);
    }
    x.globalAlpha = 1;
    x.restore();
  }

  // ---------------------------------------------------------------- the map: three floors laid out flat
  // plate origin for a (possibly fractional) floor z
  plateXY(z) {
    const M = this.map;
    const zz = 2 - z;  // the top floor first
    return M.vertical ? [M.x, M.y + zz * (M.u * 3 + M.gap)] : [M.x + zz * (M.u * 3 + M.gap), M.y];
  }
  cellXY(x, y, z) { const [ox, oy] = this.plateXY(z); const u = this.map.u; return [ox + x * u + u / 2, oy + y * u + u / 2]; }
  mapCell(room, ori) {
    const u = this.map.u * this.dpr;
    return this.get(`mc:${room.id}:${ori}:${u}`, () => {
      const n = 7, home = FLOOR_COL[room.home[2]];
      const bm = { w: n, h: n, px: [] };
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const e = Math.min(i, j, n - 1 - i, n - 1 - j);
        let col = e === 0 ? home[(i + j) % 3] : C.lime[(i * 3 + j) % 4];
        // doors are gaps in the coloured rim (in the room's own frame, rotated below)
        const mid = 3;
        if (e === 0) {
          if (room.doors[0] && j === 0 && i === mid) col = C.lime[0];
          if (room.doors[2] && j === n - 1 && i === mid) col = C.lime[0];
          if (room.doors[3] && i === 0 && j === mid) col = C.lime[0];
          if (room.doors[1] && i === n - 1 && j === mid) col = C.lime[0];
        }
        bm.px.push(col);
      }
      const img = laid(bm, u * 0.86 / n, room.id + 400, { jit: 0.14, gap: 0.12 });
      // rotate to the room's orientation
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const x = cv.getContext('2d'); x.translate(cv.width / 2, cv.height / 2); x.rotate(ori * Math.PI / 2); x.drawImage(img, -img.width / 2, -img.height / 2);
      return cv;
    });
  }

  drawMap(G, t) {
    const x = this.x, st = G.st, M = this.map, u = M.u;
    // plate beds and labels
    const names = ['Bottom', 'Middle', 'Top'];
    for (let z = 2; z >= 0; z--) {
      const [ox, oy] = this.plateXY(z);
      x.fillStyle = 'rgba(15,12,10,.55)';
      x.fillRect(ox - 4, oy - 4, u * 3 + 8, u * 3 + 8);
      x.fillStyle = 'rgba(235,224,199,.8)';
      x.font = `${Math.max(12, Math.round(u * 0.3))}px 'Alegreya SC', Georgia, serif`;
      x.textAlign = 'center'; x.textBaseline = 'top';
      if (M.vertical) { x.save(); x.translate(ox - 10, oy + u * 1.5); x.rotate(-Math.PI / 2); x.textBaseline = 'bottom'; x.fillText(names[z], 0, 0); x.restore(); }
      else x.fillText(names[z], ox + u * 1.5, oy + u * 3 + 7);
      if (G.p && st.pos[G.p.room] != null && ppos(st.pos[G.p.room])[2] === z && !(G.anim && G.anim.type === 'turn')) {
        x.strokeStyle = 'rgba(246,240,226,.5)'; x.lineWidth = 1; x.strokeRect(ox - 4.5, oy - 4.5, u * 3 + 9, u * 3 + 9);
      }
    }
    const A = G.anim && G.anim.type === 'turn' ? G.anim : null;
    // where each room is drawn this frame
    const posOf = (id) => {
      let [px, py, pz] = ppos(st.pos[id]);
      let rot = st.ori[id];
      if (A && A.ids.includes(id)) {
        const [fx, fy, fz] = ppos(A.from[id]);
        const th = A.dir * A.ease * Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
        if (A.axis === 'H') { const dx = fx - 1, dy = fy - 1; px = 1 + dx * c - dy * s; py = 1 + dx * s + dy * c; pz = fz; rot = A.oriFrom[id] + A.dir * A.ease; }
        else if (A.axis === 'X') { const dy = fy - 1, dz = fz - 1; py = 1 + dy * c + dz * s; pz = 1 - dy * s + dz * c; px = fx; }
        else { const dx = fx - 1, dz = fz - 1; px = 1 + dx * c + dz * s; pz = 1 - dx * s + dz * c; py = fy; }
      }
      return { px, py, pz, rot };
    };
    // the layer a turnstone underfoot would turn
    let preview = null;
    if (!A && G.onDial) { const L = layerOf(st, G.p.room); preview = new Set(layerCells(L.axis, L.k)); }
    // links first (under the cells), only when still
    if (!A) {
      for (let p = 0; p < 27; p++) {
        const id = st.at[p], [cx0, cy0, cz0] = ppos(p);
        for (const s of [1, 2]) {
          const dw = doorway(st, id, s);
          if (dw.kind !== 'open' && dw.kind !== 'lockedFar') continue;
          const [ax, ay] = this.cellXY(cx0, cy0, cz0);
          const bx = ax + DX[s] * u, by = ay + DY[s] * u;
          x.strokeStyle = dw.kind === 'open' ? C.lime[0] : C.gold[0]; x.lineWidth = u * 0.16;
          x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke();
        }
        // and doors going the other way that are locked on this side
        for (const s of [1, 2]) { const dw = doorway(st, id, s); if (dw.kind === 'locked') { /* drawn as a bar in the cell */ } }
      }
    }
    const ids = [...Array(27).keys()].map(id => ({ id, ...posOf(id) }));
    ids.sort((a, b) => (A && A.ids.includes(a.id) ? 1 : 0) - (A && A.ids.includes(b.id) ? 1 : 0));
    for (const r of ids) {
      const room = st.rooms[r.id];
      const [ox, oy] = this.plateXY(r.pz);
      const mx = ox + r.px * u + u / 2, my = oy + r.py * u + u / 2;
      const img = this.mapCell(room, 0);
      x.save(); x.translate(mx, my); x.rotate(r.rot * Math.PI / 2);
      x.drawImage(img, -u * 0.43, -u * 0.43, u * 0.86, u * 0.86);
      // lock bar
      if (room.lock >= 0 && !(st.unlocked >> r.id & 1)) {
        x.save(); x.rotate(room.lock * Math.PI / 2); x.fillStyle = C.gold[1]; x.fillRect(-u * 0.16, -u * 0.47, u * 0.32, u * 0.1); x.restore();
      }
      x.restore();
      // icons, upright
      const ic = u * 0.2;
      if (room.up || room.down) {
        const dir = room.up ? 1 : -1, L = ladder(st, r.id, dir);
        const lit = !A && (L.kind === 'open' || L.kind === 'sky');
        x.fillStyle = lit ? C.gold[1] : C.ink2; x.strokeStyle = C.ink; x.lineWidth = 1;
        x.beginPath();
        if (dir > 0) { x.moveTo(mx, my - ic); x.lineTo(mx + ic, my + ic * 0.7); x.lineTo(mx - ic, my + ic * 0.7); }
        else { x.moveTo(mx, my + ic); x.lineTo(mx + ic, my - ic * 0.7); x.lineTo(mx - ic, my - ic * 0.7); }
        x.closePath(); x.fill(); if (lit) x.stroke();
        if (room.entry) { x.strokeStyle = L.kind === 'sky' && !A ? C.gold[1] : 'rgba(214,166,42,.5)'; x.lineWidth = 1.5; x.beginPath(); x.arc(mx, my, ic * 1.6, 0, 7); x.stroke(); }
      }
      if (room.dial) {
        const dx = mx - u * 0.2, dy = my - u * 0.2;
        x.fillStyle = C.lapis[2]; x.beginPath(); x.arc(dx, dy, ic * 0.7, 0, 7); x.fill();
        x.fillStyle = C.white; x.font = `bold ${Math.round(ic * 1.05)}px Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(room.dial === 'H' ? '↻' : room.dial === 'X' ? '↕' : '↔', dx, dy + 0.5);
      }
      if (room.key && !(st.keysTaken >> r.id & 1)) { x.fillStyle = C.gold[1]; x.beginPath(); x.arc(mx + u * 0.2, my - u * 0.2, ic * 0.45, 0, 7); x.fill(); x.fillRect(mx + u * 0.2 - 1, my - u * 0.2, 2, ic); }
      if (room.treasure && !st.treasure) {
        x.fillStyle = C.goldHi; x.strokeStyle = C.ink; x.lineWidth = 1;
        x.beginPath(); x.moveTo(mx, my - ic); x.lineTo(mx + ic, my); x.lineTo(mx, my + ic); x.lineTo(mx - ic, my); x.closePath(); x.fill(); x.stroke();
      }
      if (preview && preview.has(st.pos[r.id])) {
        x.strokeStyle = C.lapis[2]; x.lineWidth = 2.5; x.setLineDash([4, 3]); x.lineDashOffset = -t * 12;
        x.strokeRect(mx - u * 0.48, my - u * 0.48, u * 0.96, u * 0.96); x.setLineDash([]);
      }
      if (r.id === G.hintRoom) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 7);
        x.strokeStyle = `rgba(226,184,62,${0.4 + 0.6 * pulse})`; x.lineWidth = 3.5;
        x.strokeRect(mx - u * 0.53, my - u * 0.53, u * 1.06, u * 1.06);
      }
      if (r.id === G.p.room) {
        const pulse = 0.6 + 0.4 * Math.sin(t * 5);
        x.strokeStyle = `rgba(246,240,226,${pulse})`; x.lineWidth = 2.5;
        x.strokeRect(mx - u * 0.47, my - u * 0.47, u * 0.94, u * 0.94);
        // you: a lapis stone
        const [lc, lr] = [G.p.fx, G.p.fy];
        let ddx = (lc - 4) / 9 * u * 0.8, ddy = (lr - 4) / 9 * u * 0.8;
        if (A && A.axis === 'H' && A.ids.includes(r.id)) { const th = (A.dir * A.ease - A.dir) * Math.PI / 2, c = Math.cos(th), s = Math.sin(th); [ddx, ddy] = [ddx * c - ddy * s, ddx * s + ddy * c]; }
        x.fillStyle = C.ink; x.fillRect(mx + ddx - 3.5, my + ddy - 3.5, 7, 7);
        x.fillStyle = C.lapis[2]; x.fillRect(mx + ddx - 2.5, my + ddy - 2.5, 5, 5);
      }
    }
  }
}
