// The beach: a falling-sand grid with a forced tide.
// y grows downward. Cells are bytes; everything here runs headless in Node too.

export const W = 160, H = 100;
export const E = 0, SAND = 1, WET = 2, PACK = 3, WATER = 4, ROCK = 5, WOOD = 6, PEB = 7;
export const SOLID = [false, true, true, true, false, true, true, true];
const FALLS = [false, true, true, false, false, false, false, true];
const SOFT = [true, false, false, false, true, false, false, false]; // things a grain can fall into

export const CASTLE_X = 80;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ground line of a fresh beach
export function groundAt(x) {
  if (x < 30) return 55 + Math.round(2.5 * Math.sin(x * 0.33) + 1.5 * Math.sin(x * 0.9 + 1) + (30 - x) * 0.08);
  if (x < 98) return 59 + Math.round((x - 30) * 0.03);
  return Math.round(61 + (x - 98) * 0.42);
}

export class Beach {
  constructor(seed = 1) {
    this.r = rng(seed);
    const n = W * H;
    this.t = new Uint8Array(n);      // type
    this.m = new Uint8Array(n);      // moisture (pack) / timer (wet)
    this.v = new Uint8Array(n);      // per-grain colour variation
    this.f = new Int8Array(n);       // water flow direction
    this.mv = new Uint8Array(n);     // moved-this-step stamp
    this.conn = new Uint8Array(n);   // sea-connected stamp
    this.q = new Int32Array(n);
    this.step = 0;
    this.time = 0;
    this.sea = 76;          // still-water line (y)
    this.swell = 1.5;       // amplitude of the surges
    this.period = 6;        // seconds between surges
    this.erode = 1;         // erosion multiplier
    this.packCount = 0;
    this.lost = 0;          // packed grains lost to the sea
    this.events = [];       // {k, x, y} for sounds and puffs
    this.gen();
  }

  i(x, y) { return y * W + x; }
  get(x, y) { return x < 0 || x >= W || y < 0 || y >= H ? ROCK : this.t[y * W + x]; }
  set(x, y, k, m = 0) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = y * W + x;
    this.t[i] = k; this.m[i] = m; this.v[i] = (this.r() * 256) | 0; this.f[i] = 0;
  }

  gen() {
    for (let x = 0; x < W; x++) {
      const g = groundAt(x);
      const bed = 92 + Math.round(1.5 * Math.sin(x * 0.21) + this.r());
      for (let y = 0; y < H; y++) {
        let k = E;
        if (y >= bed) k = ROCK;
        else if (y >= g) k = SAND;
        else if (y > this.sea && x > 100) k = WATER;
        if (k === SAND && y > g + 4 && this.r() < 0.012) k = PEB;
        this.set(x, y, k, k === WET ? 255 : 0);
      }
    }
    this.castle(CASTLE_X);
  }

  // the starting castle: a keep and two walls
  castle(cx) {
    const g = groundAt(cx);
    const rect = (x0, x1, top, crenel) => {
      for (let x = x0; x <= x1; x++) {
        const cap = crenel && ((x - x0) % 4 >= 2) ? 2 : 0;
        for (let y = top + cap; y < g + 2; y++) this.set(x, y, PACK);
      }
    };
    rect(cx - 15, cx - 6, g - 8, true);
    rect(cx + 6, cx + 15, g - 8, true);
    rect(cx - 5, cx + 5, g - 16, false);
    // keep battlements
    for (let x = cx - 6; x <= cx + 6; x++) if ((x - cx + 6) % 3 === 0) for (let y = g - 19; y < g - 16; y++) this.set(x, y, PACK);
  }

  topAt(x, from = 0) {
    if (x < 0 || x >= W) return H;
    for (let y = Math.max(0, from); y < H; y++) if (SOLID[this.t[y * W + x]]) return y;
    return H;
  }
  waterTop(x, from = 0) {
    for (let y = Math.max(0, from); y < H; y++) { const k = this.t[y * W + x]; if (k === WATER) return y; if (SOLID[k]) return H; }
    return H;
  }

  // sea surface (y) at column x right now
  surface(x) {
    const t = this.time, c = 34, P = this.period;
    let u = (t - (W - x) / c) % P; if (u < 0) u += P;
    const rise = 0.45, fall = 2.2;
    let pulse = u < rise ? u / rise : Math.max(0, 1 - (u - rise) / fall);
    pulse = pulse * pulse * (3 - 2 * pulse);
    const ripple = 0.5 * Math.sin(t * 2.1 + x * 0.35);
    return this.sea - this.swell * pulse - ripple;
  }

  backwash(x) {
    const P = this.period;
    let u = (this.time - (W - x) / 34) % P; if (u < 0) u += P;
    return u > 0.6 && u < 2.6;
  }

  tick(dt = 1 / 60) {
    this.time += dt;
    this.step = (this.step + 1) & 255 || 1;
    this.tide();
    this.cells();
  }

  tide() {
    const { t, conn, q, r } = this, st = this.step;
    // the open sea along the right edge
    for (let x = W - 2; x < W; x++) {
      const s = Math.round(this.surface(x));
      for (let y = 0; y < H; y++) {
        const i = y * W + x, k = t[i];
        if (y >= s && k === E) { t[i] = WATER; this.f[i] = -1; }
        else if (y < s && k === WATER) t[i] = E;
      }
    }
    // flood fill: which water touches the open sea
    let n = 0;
    for (let y = 0; y < H; y++) { const i = y * W + W - 1; if (t[i] === WATER) { conn[i] = st; q[n++] = i; } }
    for (let h = 0; h < n; h++) {
      const i = q[h], x = i % W;
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W];
      for (const j of nb) if (j >= 0 && j < t.length && t[j] === WATER && conn[j] !== st) { conn[j] = st; q[n++] = j; }
    }
    this.seaCells = n;
    // the surge runs up the beach one ring per step; the backwash drains it
    for (let h = 0; h < n; h++) {
      const i = q[h], x = i % W, y = (i / W) | 0;
      const s = this.surface(x);
      if (y < s - 0.5 && (y === 0 || t[i - W] === E)) {
        if (r() < (this.backwash(x) ? 0.35 : 0.12)) { t[i] = E; continue; }
      }
      for (const d of [-1, 1]) {
        const nx = x + d; if (nx < 0 || nx >= W) continue;
        const j = i + d;
        if (t[j] === E && y > this.surface(nx)) { t[j] = WATER; this.f[j] = d; this.mv[j] = st; this.v[j] = (r() * 256) | 0; }
      }
      if (y > 0 && t[i - W] === E && y - 1 > s) { t[i - W] = WATER; this.f[i - W] = 0; this.mv[i - W] = st; }
    }
  }

  cells() {
    const { t, m, mv, f, r } = this, st = this.step, er = this.erode;
    const ltr = st & 1;
    let pack = 0;
    for (let y = H - 1; y >= 0; y--) {
      for (let k = 0; k < W; k++) {
        const x = ltr ? k : W - 1 - k;
        const i = y * W + x;
        if (mv[i] === st) continue;
        const c = t[i];
        if (c === E || c === ROCK || c === WOOD) continue;
        if (c === PACK) {
          pack++;
          let wn = 0, wetn = 0;
          if (x > 0) { const a = t[i - 1]; if (a === WATER) wn++; else if (a === WET) wetn++; }
          if (x < W - 1) { const a = t[i + 1]; if (a === WATER) wn++; else if (a === WET) wetn++; }
          if (y > 0) { const a = t[i - W]; if (a === WATER) wn++; }
          const b = y < H - 1 ? t[i + W] : ROCK;
          if (b === WATER) wn++; else if (b === WET) wetn++;
          if (wn) {
            const sea = this.conn[i - 1] === st || this.conn[i + 1] === st || (y > 0 && this.conn[i - W] === st);
            m[i] = Math.min(255, m[i] + wn * (sea ? 3 : 1) * er);
          } else if (wetn && r() < 0.06 * er) m[i] = Math.min(255, m[i] + 1);
          else if (m[i] && r() < 0.03) m[i]--;
          if (m[i] > 150 && r() < 0.035 * er) { t[i] = WET; m[i] = 255; this.lost++; pack--; continue; }
          if (b === E || b === WATER) {
            const L = x > 0 && t[i - 1] === PACK, R = x < W - 1 && t[i + 1] === PACK;
            const p = L && R ? 0.0012 : L || R ? 0.006 : 0.05;
            if (r() < p) { t[i] = m[i] > 60 ? WET : SAND; pack--; continue; }
          }
          continue;
        }
        if (c === WATER) { this.water(x, y, i); continue; }
        // falling grains: SAND, WET, PEB
        if (y < H - 1) {
          const b = t[i + W];
          if (SOFT[b] && (b === E || r() < 0.55)) { this.swap(i, i + W); continue; }
          if (!SOFT[b] || b === WATER) {
            const d = r() < 0.5 ? -1 : 1;
            let moved = false;
            for (const dd of [d, -d]) {
              const nx = x + dd; if (nx < 0 || nx >= W) continue;
              const j = i + W + dd;
              if (SOFT[t[j]] && SOFT[t[i + dd]] && (t[j] === E || r() < 0.4)) { this.swap(i, j); moved = true; break; }
            }
            if (moved) continue;
          }
        }
        if (c === PEB) continue;
        // wetting, drying and the sea carrying grains away
        let wn = 0, seaSide = 0;
        if (x > 0 && t[i - 1] === WATER) { wn++; if (this.conn[i - 1] === st) seaSide = -1; }
        if (x < W - 1 && t[i + 1] === WATER) { wn++; if (this.conn[i + 1] === st) seaSide = 1; }
        if (y > 0 && t[i - W] === WATER) { wn++; if (!seaSide && this.conn[i - W] === st) seaSide = 2; }
        if (c === SAND) {
          if (wn) { t[i] = WET; m[i] = 255; }
          continue;
        }
        // WET
        if (wn) m[i] = 255;
        else if (r() < 0.25) { if (m[i] > 0) m[i]--; else { t[i] = SAND; continue; } }
        if (seaSide) {
          // grains washed by sea water get dragged seaward on the backwash, a little landward on the surge
          const bw = this.backwash(x);
          const dir = bw ? 1 : -1;
          const nx = x + dir;
          const top = y > 0 && t[i - W] === WATER;
          if (nx >= 0 && nx < W && t[i + dir] === WATER && r() < (bw ? 0.16 : 0.03) * (top ? 1 : 0.4) * er) this.swap(i, i + dir);
        }
      }
    }
    this.packCount = pack;
  }

  water(x, y, i) {
    const { t, f, r } = this;
    if (y < H - 1) {
      const b = t[i + W];
      if (b === E) { this.swap(i, i + W); return; }
      if (b === SAND && r() < 0.004) { t[i] = E; t[i + W] = WET; this.m[i + W] = 255; return; }
      if (b === WET && this.conn[i] !== this.step && r() < 0.0012) { t[i] = E; return; }
      const d = r() < 0.5 ? -1 : 1;
      for (const dd of [d, -d]) {
        const nx = x + dd; if (nx < 0 || nx >= W) continue;
        if (t[i + W + dd] === E && t[i + dd] === E) { this.swap(i, i + W + dd); return; }
      }
    }
    let d = f[i] || (r() < 0.5 ? -1 : 1);
    for (let a = 0; a < 2; a++) {
      let j = i, steps = 0;
      for (let s = 1; s <= 3; s++) {
        const nx = x + d * s; if (nx < 0 || nx >= W) break;
        if (t[i + d * s] !== E) break;
        j = i + d * s; steps = s;
        if (y < H - 1 && t[j + W] === E) break;
      }
      if (steps) { this.swap(i, j); f[j] = d; return; }
      d = -d;
    }
    f[i] = 0;
  }

  swap(i, j) {
    const { t, m, v, f, mv } = this;
    let a = t[i]; t[i] = t[j]; t[j] = a;
    a = m[i]; m[i] = m[j]; m[j] = a;
    a = v[i]; v[i] = v[j]; v[j] = a;
    a = f[i]; f[i] = f[j]; f[j] = a;
    mv[i] = mv[j] = this.step;
  }

  // ---- tools

  // remove loose or packed sand in a disc; returns grains taken
  dig(cx, cy, rad, max = 1e9) {
    let n = 0;
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      if (n >= max) return n;
      if (x < 0 || x >= W || y < 0 || y >= H || (x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
      const k = this.t[y * W + x];
      if (k === SAND || k === WET || k === PACK) { this.t[y * W + x] = E; n++; }
    }
    return n;
  }
  // pack sand into a disc; returns grains of pail used
  pack(cx, cy, rad, pail) {
    let used = 0;
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H || (x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
      const i = y * W + x, k = this.t[i];
      if (k === SAND || k === WET) { this.t[i] = PACK; this.m[i] = k === WET ? 70 : 0; }
      else if ((k === E || k === WATER) && used < pail) { this.set(x, y, PACK); used++; }
    }
    return used;
  }
  pebbles(cx, cy, rad, stock) {
    let used = 0;
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      if (used >= stock) return used;
      if (x < 0 || x >= W || y < 0 || y >= H || (x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
      const k = this.t[y * W + x];
      if (k === E || k === WATER) { this.set(x, y, PEB); used++; }
    }
    return used;
  }
  // a bucket-moulded tower: base centred at (cx, by)
  tower(cx, by) {
    const h = 13;
    for (let r = 0; r < h; r++) {
      const half = r < 2 ? 4 : 4 + (r > h - 4 ? 1 : 0);
      const y = by - h + r + 1;
      for (let x = cx - half; x <= cx + half; x++) {
        if (r < 2 && (x - cx + 4) % 3 === 1) continue;
        const k = this.get(x, y);
        if (k === E || k === WATER || k === SAND || k === WET) this.set(x, y, PACK);
      }
    }
    // fill under it so it doesn't hang
    for (let x = cx - 5; x <= cx + 5; x++) for (let y = by + 1; y < by + 6; y++) { const k = this.get(x, y); if (k === E || k === WATER) this.set(x, y, PACK); }
  }
  post(cx, by) {
    for (let y = by - 9; y <= by + 4; y++) for (let x = cx; x <= cx + 1; x++) if (this.get(x, y) !== ROCK) this.set(x, y, WOOD);
  }

  // knock grains loose (something heavy hit the castle)
  crater(cx, cy, rad) {
    let n = 0;
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H || (x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
      const i = y * W + x;
      if (this.t[i] === PACK && this.r() < 0.7) { this.t[i] = SAND; n++; }
    }
    return n;
  }

  count(k) { let n = 0; for (let i = 0; i < this.t.length; i++) if (this.t[i] === k) n++; return n; }
  depthAt(x, y) { let d = 0; while (y - d >= 0 && this.get(x, y - d) === WATER) d++; return d; }
}
