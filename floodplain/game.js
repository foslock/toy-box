// Floodplain: the rules. A small valley on a grid, a river you can redirect, and raiders who march on the
// village. Pure logic, no DOM, so the Node solver (solve.mjs) runs the same rules as the page.
//
// Water rule: water spreads from every source (the spring, the lake, a rain cloud) to any neighbour that
// is lower or level, never higher. Banks, shut gates, rock and ice stop it. Ground that water leaves turns
// to mud for one raider turn. Water that reaches a raider drowns it; water that reaches a cottage ruins it.

export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export const KINDS = {
  foot: { name: 'Footman', speed: 3, range: 1, says: 'Walks 3. Burns a cottage it ends beside.' },
  horse: { name: 'Rider', speed: 5, range: 1, says: 'Rides 5. Burns a cottage it ends beside.' },
  torch: { name: 'Torcher', speed: 2, range: 2, says: 'Walks 2. Throws fire 2 tiles in a straight line, over water.' },
};

export const TOOLS = {
  gate: { name: 'Gate', key: '1', says: 'Open or shut a sluice gate in the bank.' },
  dig: { name: 'Dig', key: '2', says: 'Cut through a bank, or dig ground one step lower.' },
  rain: { name: 'Rain', key: '3', says: 'Rain on a tile. Water runs downhill from it until the next turn ends.' },
  freeze: { name: 'Freeze', key: '4', says: 'Freeze water to ice (a dam, and a path), or thaw it again.' },
};

// Terrain: . grass  , field  T trees  ^ rock  # bank  G shut gate  O open gate  S spring  L lake  H cottage
// (= in a map is grass under ice: a frozen stretch of river)
const WALK_BLOCK = new Set(['^', 'H', 'X']);          // X = a ruined cottage
const WATER_BLOCK = new Set(['^', '#', 'G']);

export class Game {
  constructor(level) {
    this.level = level;
    const rows = level.map.map(r => r.trim().split(/\s+/));
    this.h = rows.length; this.w = rows[0].length;
    const n = this.w * this.h;
    this.t = new Array(n); this.ht = new Int8Array(n);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const tok = rows[y][x];
      this.t[y * this.w + x] = tok[0] === '=' ? '.' : tok[0]; this.ht[y * this.w + x] = +tok[1] || 0;
    }
    this.water = new Uint8Array(n); this.ice = new Uint8Array(n); this.mud = new Uint8Array(n); this.rain = new Uint8Array(n);
    rows.forEach((r, y) => r.forEach((tok, x) => { if (tok[0] === '=') this.ice[y * this.w + x] = 1; }));
    this.units = []; this.nextId = 1;
    for (const [k, x, y] of level.raiders || []) this.units.push({ id: this.nextId++, k, x, y, dead: 0 });
    this.waves = (level.waves || []).map(([turn, k, x, y]) => ({ turn, k, x, y }));
    this.turn = 1; this.turns = level.turns; this.actionsPer = level.actions ?? 2; this.actions = this.actionsPer;
    this.charges = { ...level.tools };
    this.houses0 = this.t.filter(c => c === 'H').length;
    this.over = null;   // 'won' | 'lost'
    this.settle(true);
  }

  idx(x, y) { return y * this.w + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  housesLeft() { let c = 0; for (const t of this.t) if (t === 'H') c++; return c; }
  alive() { return this.units.filter(u => !u.dead); }
  unitAt(x, y) { return this.units.find(u => !u.dead && u.x === x && u.y === y); }

  clone() {
    const g = Object.create(Game.prototype);
    Object.assign(g, this);
    g.t = this.t.slice(); g.ht = this.ht.slice(); g.water = this.water.slice(); g.ice = this.ice.slice();
    g.mud = this.mud.slice(); g.rain = this.rain.slice();
    g.units = this.units.map(u => ({ ...u })); g.charges = { ...this.charges };
    return g;
  }
  key() {
    return this.t.join('') + this.ht.join('') + this.water.join('') + this.ice.join('') + this.mud.join('') + this.rain.join('') +
      this.units.map(u => u.dead ? 'd' : u.x + ',' + u.y).join(';') + JSON.stringify(this.charges) + this.actions + ':' + this.turn;
  }

  // ---------- water
  waterPass(i) { return !WATER_BLOCK.has(this.t[i]) && !this.ice[i]; }
  computeWater() {
    const W = new Uint8Array(this.w * this.h), dist = new Int16Array(this.w * this.h).fill(-1), q = [];
    for (let i = 0; i < W.length; i++) {
      if ((this.t[i] === 'S' || this.t[i] === 'L' || this.rain[i]) && this.waterPass(i)) { W[i] = 1; dist[i] = 0; q.push(i); }
    }
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi], cx = c % this.w, cy = (c / this.w) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy; if (!this.inb(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        if (W[ni] || !this.waterPass(ni) || this.ht[ni] > this.ht[c]) continue;
        W[ni] = 1; dist[ni] = dist[c] + 1; q.push(ni);
      }
    }
    return { W, dist };
  }
  // Recompute the water and apply what it did. Returns events for the view.
  settle(first = false) {
    const { W, dist } = this.computeWater(), ev = [];
    for (let i = 0; i < W.length; i++) {
      const x = i % this.w, y = (i / this.w) | 0;
      if (W[i] && !this.water[i] && !first) {
        ev.push({ type: 'wet', x, y, d: dist[i] });
        if (this.t[i] === 'H') { this.t[i] = 'X'; ev.push({ type: 'washed', x, y, d: dist[i] }); }
        const u = this.unitAt(x, y);
        if (u) { u.dead = 1; ev.push({ type: 'drown', id: u.id, k: u.k, x, y, d: dist[i] }); }
      } else if (!W[i] && this.water[i]) {
        this.mud[i] = 1; ev.push({ type: 'dry', x, y });
      }
    }
    this.water = W;
    return ev;
  }

  // ---------- the player's tools
  // Returns null if the tool can't be used there, else a short reason-free ok.
  canUse(tool, x, y) {
    if (this.over || this.actions <= 0 || !this.inb(x, y)) return false;
    if (tool !== 'gate' && !(this.charges[tool] > 0)) return false;
    if (!(tool in this.charges)) return false;
    const i = this.idx(x, y), t = this.t[i];
    if (tool === 'gate') return t === 'G' || t === 'O';
    if (tool === 'dig') return t === '#' || ((t === '.' || t === ',' || t === 'T') && this.ht[i] > 0);
    if (tool === 'rain') return !this.rain[i] && !this.water[i] && !this.ice[i] && !'^#GHX'.includes(t) && !this.unitAt(x, y);
    if (tool === 'freeze') return this.ice[i] ? true : (this.water[i] && t !== 'S');
    return false;
  }
  whyNot(tool, x, y) {
    if (this.over) return '';
    if (this.actions <= 0) return 'No moves left this turn. End the turn.';
    if (tool !== 'gate' && !(this.charges[tool] > 0)) return `No ${TOOLS[tool].name.toLowerCase()} left in this valley.`;
    const i = this.idx(x, y), t = this.t[i];
    if (tool === 'gate') return 'Gates are the posts set in the banks.';
    if (tool === 'dig') return t === 'H' || t === 'X' ? 'Not the cottages.' : this.ht[i] === 0 ? 'That ground is as low as it goes.' : 'Dig banks or open ground.';
    if (tool === 'rain') return this.water[i] ? 'That is wet already.' : this.unitAt(x, y) ? 'Rain on open ground, not on a raider.' : 'Rain needs open ground.';
    if (tool === 'freeze') return 'Freeze needs water (or ice to thaw). Not the spring.';
    return '';
  }
  use(tool, x, y) {
    if (!this.canUse(tool, x, y)) return null;
    const i = this.idx(x, y);
    if (tool === 'gate') this.t[i] = this.t[i] === 'G' ? 'O' : 'G';
    else if (tool === 'dig') { if (this.t[i] === '#') this.t[i] = '.'; else this.ht[i]--; }
    else if (tool === 'rain') this.rain[i] = 1;
    else if (tool === 'freeze') this.ice[i] = this.ice[i] ? 0 : 1;
    if (tool !== 'gate') this.charges[tool]--;
    this.actions--;
    const ev = this.settle();
    this.checkClear();
    return ev;
  }
  checkClear() {
    if (!this.over && this.housesLeft() > 0 && !this.alive().length && !this.waves.some(w => w.turn > this.turn && w.turn <= this.turns)) this.over = 'won';
  }

  // ---------- raiders
  walkable(i, self) {
    if (WALK_BLOCK.has(this.t[i]) || this.water[i] || this.mud[i]) return false;
    const x = i % this.w, y = (i / this.w) | 0, u = this.unitAt(x, y);
    return !u || u === self;
  }
  // Which cottage (index) can this raider kind hit from (x, y)? -1 if none.
  strikeFrom(k, x, y) {
    const r = KINDS[k].range;
    for (const [dx, dy] of DIRS) for (let d = 1; d <= r; d++) {
      const nx = x + dx * d, ny = y + dy * d; if (!this.inb(nx, ny)) break;
      if (this.t[this.idx(nx, ny)] === 'H') return this.idx(nx, ny);
    }
    return -1;
  }
  // Breadth-first to the nearest place it can strike from; if none is reachable, the reachable tile closest
  // (as the crow walks) to a cottage. Returns the full path (without the start).
  plan(u) {
    const n = this.w * this.h, prev = new Int32Array(n).fill(-2), q = [this.idx(u.x, u.y)];
    prev[q[0]] = -1;
    let goal = -1;
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi], cx = c % this.w, cy = (c / this.w) | 0;
      if (this.strikeFrom(u.k, cx, cy) >= 0) { goal = c; break; }
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy; if (!this.inb(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        if (prev[ni] !== -2 || !this.walkable(ni, u)) continue;
        prev[ni] = c; q.push(ni);
      }
    }
    if (goal < 0) {
      const homes = []; for (let i = 0; i < n; i++) if (this.t[i] === 'H') homes.push(i);
      if (!homes.length) return [];
      let best = Infinity;
      for (const c of q) {
        const cx = c % this.w, cy = (c / this.w) | 0;
        let d = Infinity; for (const hI of homes) d = Math.min(d, Math.abs(hI % this.w - cx) + Math.abs(((hI / this.w) | 0) - cy));
        if (d < best) { best = d; goal = c; }
      }
    }
    const path = [];
    for (let c = goal; c >= 0 && prev[c] !== -1; c = prev[c]) path.unshift(c);
    return path;
  }

  // The raiders' turn, one step at a time so the view can play it out. Each yield is an event.
  *enemySteps() {
    for (const u of this.units) {
      if (u.dead) continue;
      const path = this.plan(u).slice(0, KINDS[u.k].speed);
      if (path.length) {
        const from = [u.x, u.y];
        const last = path[path.length - 1]; u.x = last % this.w; u.y = (last / this.w) | 0;
        yield { type: 'move', id: u.id, from, path: path.map(i => [i % this.w, (i / this.w) | 0]) };
      }
      const hI = this.strikeFrom(u.k, u.x, u.y);
      if (hI >= 0) { this.t[hI] = 'X'; yield { type: 'burn', id: u.id, x: hI % this.w, y: (hI / this.w) | 0 }; }
    }
    // mud dries, rain stops (and what it fed drains to fresh mud)
    for (let i = 0; i < this.mud.length; i++) this.mud[i] = 0;
    let rained = false;
    for (let i = 0; i < this.rain.length; i++) if (this.rain[i]) { this.rain[i] = 0; rained = true; }
    if (rained) { const ev = this.settle(); if (ev.length) yield { type: 'drain', ev }; }
    // the next band arrives at the valley's edge
    for (const wv of this.waves) {
      if (wv.turn !== this.turn + 1 || wv.turn > this.turns) continue;
      const i = this.idx(wv.x, wv.y);
      if (this.water[i]) { yield { type: 'swept', k: wv.k, x: wv.x, y: wv.y }; continue; }
      let at = null;
      if (this.walkable(i)) at = [wv.x, wv.y];
      else for (const [dx, dy] of DIRS) { const nx = wv.x + dx, ny = wv.y + dy; if (this.inb(nx, ny) && this.walkable(this.idx(nx, ny))) { at = [nx, ny]; break; } }
      if (!at) continue;
      const u = { id: this.nextId++, k: wv.k, x: at[0], y: at[1], dead: 0 };
      this.units.push(u);
      yield { type: 'arrive', id: u.id, k: u.k, x: u.x, y: u.y };
    }
    const houses = this.housesLeft();
    if (!houses) this.over = 'lost';
    else if (this.turn >= this.turns) this.over = 'won';
    else { this.turn++; this.actions = this.actionsPer; this.checkClear(); }
    yield { type: 'end' };
  }
  endTurn() { const ev = []; for (const e of this.enemySteps()) ev.push(e); return ev; }

  // What will happen if the turn ends now: each raider's route and strike, cottages lost, arrivals.
  forecast() {
    const g = this.clone(), moves = {}, burns = [], arrivals = [];
    const startHouses = this.housesLeft();
    for (const e of g.enemySteps()) {
      if (e.type === 'move') moves[e.id] = e.path;
      else if (e.type === 'burn') burns.push({ id: e.id, x: e.x, y: e.y });
    }
    for (const wv of this.waves) if (wv.turn === this.turn + 1 && wv.turn <= this.turns) arrivals.push(wv);
    return { moves, burns, arrivals, lost: startHouses - g.housesLeft() };
  }
}
