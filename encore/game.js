// Encore's rules, with no DOM: the floor, the beat, the band you carry and the
// things that dance at you. main.js draws it; sim.mjs plays it headless.

export const W = 9, H = 11, PH = 8;           // floor size; a phrase is 8 beats (two bars)
export const WIN = .17;                        // seconds either side of a beat that still count

// Each instrument fires its power on the beats its part plays.
export const INST = {
  kick:  { name: 'KICK',  power: 'HIT',   steps: [1, 1, 1, 1, 1, 1, 1, 1], col: '#f6efe4', say: 'BUMP INTO THINGS TO HIT THEM' },
  bass:  { name: 'BASS',  power: 'SHOVE', steps: [1, 0, 0, 0, 1, 0, 0, 0], col: '#ff5b3a', say: 'ON BEAT 1 OF A BAR, SHOVES EVERYTHING BESIDE YOU' },
  hats:  { name: 'HATS',  power: 'DASH',  steps: [0, 1, 0, 1, 0, 1, 0, 1], col: '#ffd23f', say: 'ON BEATS 2 AND 4, YOU MOVE TWO TILES' },
  lead:  { name: 'LEAD',  power: 'ZAP',   steps: [0, 0, 1, 0, 0, 0, 1, 0], col: '#49d3ff', say: 'ON BEAT 3, ZAPS THE FIRST THING YOU FACE' },
  choir: { name: 'CHOIR', power: 'HALO',  steps: [1, 0, 0, 0, 0, 0, 0, 0], col: '#c58bff', say: 'A HALO THAT TAKES A HIT, REGROWN EVERY TWO BARS' },
};
export const PICKS = ['bass', 'hats', 'lead', 'choir'];

export const FOE = {
  snare:   { hp: 1, steps: [0, 1, 0, 1, 0, 1, 0, 1], name: 'SNARELING', part: 'SNARE' },
  shaker:  { hp: 1, steps: [1, 1, 1, 1, 1, 1, 1, 1], name: 'SHAKER',    part: 'SHAKER' },
  tom:     { hp: 2, steps: [1, 0, 1, 0, 1, 0, 1, 0], name: 'TOM',       part: 'TOMS' },
  horn:    { hp: 2, steps: [0, 1, 0, 1, 0, 1, 0, 1], name: 'HORN',      part: 'BRASS' },
  dummy:   { hp: 1, steps: [0, 0, 0, 0, 0, 0, 0, 0], name: 'DUMMY',     part: '' },
  drummer: { hp: 5, steps: [1, 1, 1, 1, 1, 1, 1, 1], name: 'STIX',      part: 'DRUMS', boss: 1 },
  bassist: { hp: 5, steps: [1, 0, 1, 1, 1, 0, 1, 1], name: 'LOW END',   part: 'FUZZ BASS', boss: 1 },
  guitar:  { hp: 5, steps: [1, 1, 0, 1, 1, 1, 0, 1], name: 'SHRED',     part: 'GUITAR', boss: 1 },
  singer:  { hp: 5, steps: [1, 0, 1, 0, 0, 0, 1, 0], name: 'DIVA',      part: 'VOCALS', boss: 1 },
};

export const FLOORS = [
  { name: 'CLOAKROOM', bpm: 100, foes: { snare: 2, shaker: 1 }, relic: 'bass', blocks: 5 },
  { name: 'BASEMENT',  bpm: 104, foes: { snare: 3, shaker: 2, tom: 2 }, relic: 'hats', tape: 1, blocks: 6 },
  { name: 'MAIN ROOM', bpm: 108, foes: { snare: 3, shaker: 2, tom: 1, horn: 2 }, relic: 'lead', tape: 1, blocks: 6 },
  { name: 'VIP BOOTH', bpm: 112, foes: { snare: 3, shaker: 3, tom: 2, horn: 2 }, relic: 'choir', tape: 1, blocks: 7 },
  { name: 'THE STAGE', bpm: 116, boss: 1, tape: 1, blocks: 4 },
];

export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const D4 = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const sgn = v => v > 0 ? 1 : v < 0 ? -1 : 0;

function rng(s) { // mulberry32 on a number field so the whole game clones
  s.seed = (s.seed + 0x6D2B79F5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export class Game {
  constructor(o = {}) {
    this.seed = (o.seed ?? (Math.random() * 1e9)) | 0;
    this.lap = o.lap || 0;                 // each encore lap is faster and busier
    this.tutorial = !!o.tutorial;
    this.fi = 0;
    this.score = 0; this.combo = 0; this.best = 0; this.kills = 0;
    this.status = 'play';
    this.ev = [];
    this.player = { x: 4, y: 10, fx: 0, fy: -1, inst: ['kick'], halo: false, crack: false, inv: -9, gone: [] };
    this.nid = 1;
    if (this.tutorial) this.setupTutorial(); else this.setupFloor(0);
  }
  clone() { const g = Object.create(Game.prototype); Object.assign(g, structuredClone({ ...this })); g.ev = []; return g; }
  r() { return rng(this); }
  get floor() { return FLOORS[this.fi]; }
  get bpm() { return this.tutorial ? 96 : this.floor.bpm + this.lap * 12; }
  get L() { return 60 / this.bpm; }
  get mult() { return 1 + Math.min(3, Math.floor(this.combo / 8)); }
  has(i) { return this.player.inst.includes(i); }
  fires(i, k) { return this.has(i) && INST[i].steps[((k % PH) + PH) % PH]; }
  emit(type, o = {}) { this.ev.push({ type, beat: this.k, ...o }); }

  // ------------------------------------------------------------ floors
  blankFloor() {
    this.k = -1; this.next = 0;            // last resolved beat, next beat to resolve
    this.blocks = new Uint8Array(W * H);
    this.foes = []; this.items = [];
    this.stairs = { x: 4, y: 0, open: false };
    const p = this.player;
    p.x = 4; p.y = 10; p.fx = 0; p.fy = -1; p.ax = 4; p.ay = 10; p.at = -1; p.inv = -9; p.crack = false;
    if (this.has('choir')) p.halo = true;
  }
  setupFloor(fi) {
    this.fi = fi; this.blankFloor();
    const F = this.floor;
    this.makeBlocks(F.blocks);
    if (F.boss) {
      this.spawn('drummer', 4, 2); this.spawn('bassist', 1, 3); this.spawn('guitar', 7, 3); this.spawn('singer', 4, 4);
    } else {
      const want = { ...F.foes };
      if (this.lap) { want.snare = (want.snare || 0) + this.lap; want.horn = (want.horn || 0) + (this.fi >= 1 ? 1 : 0); }
      for (const [type, n] of Object.entries(want)) for (let i = 0; i < n; i++) {
        const t = this.freeTile(5); if (t) this.spawn(type, t.x, t.y);
      }
      const rt = this.freeTile(6, true);
      if (rt) this.items.push({ id: this.nid++, kind: 'relic', inst: F.relic, x: rt.x, y: rt.y });
    }
    if (F.tape) { const t = this.freeTile(3); if (t) this.items.push({ id: this.nid++, kind: 'tape', x: t.x, y: t.y }); }
    this.emit('floor', { fi });
  }
  makeBlocks(n) {
    // speaker stacks, placed in mirrored pairs so rooms look designed, never sealing anything off
    for (let tries = 0; tries < 200; tries++) {
      this.blocks.fill(0);
      let placed = 0;
      while (placed < n) {
        const x = Math.floor(this.r() * 4), y = 1 + Math.floor(this.r() * 8);
        if (y >= 9 && x >= 3) continue;
        const mx = W - 1 - x;
        this.blocks[y * W + x] = 1; this.blocks[y * W + mx] = 1;
        placed += x === mx ? 1 : 2;
      }
      for (const [x, y] of [[4, 0], [4, 1], [4, 10], [4, 9], [3, 10], [5, 10]]) this.blocks[y * W + x] = 0;
      if (this.connected()) return;
    }
    this.blocks.fill(0);
  }
  connected() {
    const seen = new Uint8Array(W * H), q = [[4, 10]]; seen[10 * W + 4] = 1; let c = 1;
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || this.blocks[ny * W + nx]) continue;
        seen[ny * W + nx] = 1; c++; q.push([nx, ny]);
      }
    }
    let free = 0; for (let i = 0; i < W * H; i++) if (!this.blocks[i]) free++;
    return c === free;
  }
  freeTile(minD, far) {
    const p = this.player, opts = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!this.walkable(x, y) || this.foeAt(x, y) || this.itemAt(x, y)) continue;
      if (x === this.stairs.x && y === this.stairs.y) continue;
      const d = Math.abs(x - p.x) + Math.abs(y - p.y);
      if (d < minD) continue;
      opts.push({ x, y, d });
    }
    if (!opts.length) return null;
    if (far) { opts.sort((a, b) => b.d - a.d); return opts[Math.floor(this.r() * Math.min(8, opts.length))]; }
    return opts[Math.floor(this.r() * opts.length)];
  }
  spawn(type, x, y) {
    const f = { id: this.nid++, type, x, y, ax: x, ay: y, at: -1, hp: FOE[type].hp, stun: -9, aim: null, hurtAt: -9 };
    if (FOE[type].boss) f.hp += this.lap * 2;
    this.foes.push(f); return f;
  }

  setupTutorial() {
    this.fi = 0; this.blankFloor();
    for (const [x, y] of [[1, 2], [7, 2], [1, 8], [7, 8]]) this.blocks[y * W + x] = 1;
    this.player.y = 9; this.player.ay = 9;
    this.stairs.open = false;
  }

  // ------------------------------------------------------------ queries
  inside(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
  walkable(x, y) { return this.inside(x, y) && !this.blocks[y * W + x]; }
  foeAt(x, y) { return this.foes.find(f => f.x === x && f.y === y && f.hp > 0); }
  itemAt(x, y) { return this.items.find(i => i.x === x && i.y === y); }
  beatTime(k) { return k * this.L; }
  phase(k = this.next) { return ((k % PH) + PH) % PH; }
  // does this foe act on beat k?
  acts(f, k) { return f.hp > 0 && FOE[f.type].steps[this.phase(k)] && f.stun < k; }

  // ------------------------------------------------------------ timing
  // Resolve every beat whose window has closed with nobody stepping.
  update(t) {
    if (this.status !== 'play') return;
    while (t > this.beatTime(this.next) + WIN && this.status === 'play') this.resolve(this.next, null);
  }
  // A move at song time t. Returns 'ok', 'miss', 'early' (count-in) or 'dup'.
  input(t, dir) {
    if (this.status !== 'play') return 'dead';
    this.update(t);
    const k = Math.round(t / this.L), off = t - this.beatTime(k);
    if (k < 0) return 'early';
    if (Math.abs(off) <= WIN && k === this.next) { this.resolve(k, dir, off); return 'ok'; }
    if (Math.abs(off) <= WIN && k < this.next) return 'dup';
    this.combo = 0;
    this.emit('miss', { off, late: off > 0 });
    return 'miss';
  }

  // ------------------------------------------------------------ the beat
  resolve(k, dir, off = 0) {
    this.k = k; this.next = k + 1;
    const p = this.player, ph = this.phase(k);
    this.emit('beat', { ph, acted: !!dir });
    if (dir) {
      this.combo++; this.best = Math.max(this.best, this.combo);
      this.emit('onbeat', { off });
      const [dx, dy] = DIRS[dir];
      p.fx = dx; p.fy = dy;
      const reach = this.fires('hats', k) ? 2 : 1;
      if (reach === 2) this.emit('dash');
      for (let s = 0; s < reach; s++) {
        const nx = p.x + dx, ny = p.y + dy;
        const f = this.foeAt(nx, ny);
        if (f) { this.hit(f, 1, 'kick', dx, dy); break; }
        if (!this.walkable(nx, ny)) { if (s === 0) this.emit('bump', { x: nx, y: ny }); break; }
        p.ax = p.x; p.ay = p.y; p.at = k; p.x = nx; p.y = ny;
        this.emit('step', { x: nx, y: ny });
        this.pickup();
        if (this.status !== 'play') return;
      }
    }
    // powers fire on their parts' beats
    if (this.fires('bass', k)) this.shove(k);
    if (this.fires('lead', k)) this.zap();
    if (this.has('choir') && INST.choir.steps[ph] && !p.halo) { p.halo = true; this.emit('halo', { on: true }); }
    if (this.status !== 'play') return;

    // the floor dances back, nearest first so lines don't block themselves
    const order = this.foes.filter(f => f.hp > 0).sort((a, b) => this.dist(a) - this.dist(b));
    for (const f of order) { if (f.hp > 0) this.act(f, k); if (this.status !== 'play') return; }
    this.foes = this.foes.filter(f => f.hp > 0 || k - f.hurtAt < 3);

    for (const it of this.items) if (it.kind === 'lost' && k >= it.until) { it.dead = true; this.player.gone.push(it.inst); this.emit('fade', { inst: it.inst }); }
    this.items = this.items.filter(i => !i.dead);
    if (this.tutorial) this.emit('tick');
  }
  dist(f) { return Math.abs(f.x - this.player.x) + Math.abs(f.y - this.player.y); }

  pickup() {
    const p = this.player, it = this.itemAt(p.x, p.y);
    if (it) {
      it.dead = true;
      if (it.kind === 'relic') {
        if (!this.has(it.inst)) p.inst.push(it.inst);
        if (it.inst === 'choir') p.halo = true;
        if (!this.tutorial) this.stairs.open = true;
        this.score += 50;
        this.emit('relic', { inst: it.inst, x: p.x, y: p.y });
      } else if (it.kind === 'lost') {
        if (!this.has(it.inst)) p.inst.push(it.inst);
        if (it.inst === 'choir') p.halo = true;
        this.emit('regain', { inst: it.inst, x: p.x, y: p.y });
      } else if (it.kind === 'tape') {
        const back = p.gone.pop();
        if (back && !this.has(back)) { p.inst.push(back); if (back === 'choir') p.halo = true; this.emit('regain', { inst: back, x: p.x, y: p.y, tape: 1 }); }
        else { this.score += 50 * this.mult; this.emit('tape', { x: p.x, y: p.y }); }
      }
      this.items = this.items.filter(i => !i.dead);
    }
    if (this.stairs.open && p.x === this.stairs.x && p.y === this.stairs.y) {
      if (this.tutorial) { this.status = 'tutdone'; this.emit('down'); return; }
      this.score += 100;
      this.status = 'down';
      this.emit('down');
    }
  }

  hit(f, dmg, src, dx = 0, dy = 0) {
    f.hp -= dmg; f.hurtAt = this.k;
    this.emit('hit', { id: f.id, x: f.x, y: f.y, src });
    if (f.hp <= 0) {
      this.kills++;
      const pts = (FOE[f.type].boss ? 200 : f.type === 'dummy' ? 0 : 10) * this.mult;
      this.score += pts;
      this.emit('kill', { id: f.id, foe: f.type, x: f.x, y: f.y, pts });
      if (!this.tutorial && this.floor.boss && FOE[f.type].boss && !this.foes.some(o => o.hp > 0 && FOE[o.type].boss)) {
        for (const o of this.foes) if (o.hp > 0) { o.hp = 0; o.hurtAt = this.k; this.emit('kill', { id: o.id, foe: o.type, x: o.x, y: o.y, pts: 0 }); }
        this.status = 'won'; this.score += 500; this.emit('won');
      }
      return;
    }
    // big things rock back when hit
    if ((f.type === 'tom' || f.type === 'drummer') && (dx || dy)) {
      const nx = f.x + dx, ny = f.y + dy;
      if (this.walkable(nx, ny) && !this.foeAt(nx, ny) && !(nx === this.player.x && ny === this.player.y)) this.moveFoe(f, nx, ny);
      f.stun = Math.max(f.stun, this.k);
    }
  }

  shove(k) {
    const p = this.player;
    this.emit('shove', { x: p.x, y: p.y });
    for (const f of this.foes) {
      if (f.hp <= 0) continue;
      const dx = f.x - p.x, dy = f.y - p.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) continue;
      const nx = f.x + sgn(dx), ny = f.y + sgn(dy);
      f.stun = k + 1; f.aim = null;
      if (this.walkable(nx, ny) && !this.foeAt(nx, ny)) this.moveFoe(f, nx, ny);
      else this.hit(f, 1, 'bass');
    }
  }
  zap() {
    const p = this.player;
    let x = p.x, y = p.y, len = 0;
    for (;;) {
      x += p.fx; y += p.fy;
      if (!this.walkable(x, y)) break;
      len++;
      const f = this.foeAt(x, y);
      if (f) { this.emit('zap', { x: p.x, y: p.y, dx: p.fx, dy: p.fy, len }); this.hit(f, 1, 'lead'); return; }
    }
    this.emit('zap', { x: p.x, y: p.y, dx: p.fx, dy: p.fy, len });
  }

  moveFoe(f, x, y) { f.ax = f.x; f.ay = f.y; f.at = this.k; f.x = x; f.y = y; }

  hurt(src) {
    const p = this.player;
    if (this.k - p.inv < 2) return;   // a beat of grace after a hit
    p.inv = this.k;
    this.combo = 0;
    if (this.tutorial) { this.emit('hurt', { src: src.id, tut: 1 }); return; }
    if (p.halo) { p.halo = false; this.emit('hurt', { src: src.id, halo: 1 }); return; }
    if (p.inst.length > 1) {
      const inst = p.inst.pop();
      // it bounces off to a nearby tile; grab it before it fades
      const opts = [];
      for (let r = 1; r <= 2 && !opts.length; r++)
        for (let y = p.y - r; y <= p.y + r; y++) for (let x = p.x - r; x <= p.x + r; x++)
          if (this.walkable(x, y) && !this.foeAt(x, y) && !this.itemAt(x, y) && !(x === p.x && y === p.y) && !(x === this.stairs.x && y === this.stairs.y)) opts.push({ x, y });
      const t = opts[Math.floor(this.r() * opts.length)];
      if (t) this.items.push({ id: this.nid++, kind: 'lost', inst, x: t.x, y: t.y, until: this.k + 9, from: { x: p.x, y: p.y } });
      else p.gone.push(inst);
      if (inst === 'choir') p.halo = false;
      this.emit('hurt', { src: src.id, lost: inst, to: t || null });
      return;
    }
    if (!p.crack) { p.crack = true; this.emit('hurt', { src: src.id, crack: 1 }); return; }
    this.status = 'dead';
    this.emit('hurt', { src: src.id, dead: 1 });
    this.emit('dead');
  }

  // ------------------------------------------------------------ foes
  stepToward(f, tx, ty, away = false) {
    const p = this.player;
    const dx = tx - f.x, dy = ty - f.y;
    const tryDirs = Math.abs(dx) >= Math.abs(dy)
      ? [[sgn(dx), 0], [0, sgn(dy) || (this.r() < .5 ? 1 : -1)]]
      : [[0, sgn(dy)], [sgn(dx) || (this.r() < .5 ? 1 : -1), 0]];
    if (away) for (const d of tryDirs) { d[0] = -d[0]; d[1] = -d[1]; }
    for (const [ddx, ddy] of tryDirs) {
      if (!ddx && !ddy) continue;
      const nx = f.x + ddx, ny = f.y + ddy;
      if (nx === p.x && ny === p.y) { if (!away) { this.attack(f, ddx, ddy); return true; } continue; }
      if (this.walkable(nx, ny) && !this.foeAt(nx, ny)) { this.moveFoe(f, nx, ny); return true; }
    }
    return false;
  }
  attack(f, dx, dy) {
    f.lunge = { dx, dy, k: this.k };
    this.emit('attack', { id: f.id, dx, dy });
    this.hurt(f);
  }
  // the lane a horn or guitar is about to blast
  lane(f) {
    if (!f.aim) return [];
    const out = []; let x = f.x, y = f.y;
    for (;;) { x += f.aim[0]; y += f.aim[1]; if (!this.walkable(x, y)) break; out.push([x, y]); }
    return out;
  }
  aimAt(f) {
    const p = this.player, dx = p.x - f.x, dy = p.y - f.y;
    f.aim = Math.abs(dx) >= Math.abs(dy) ? [sgn(dx), 0] : [0, sgn(dy)];
    if (!f.aim[0] && !f.aim[1]) f.aim = [0, 1];
  }
  blast(f) {
    const lane = this.lane(f);
    this.emit('blast', { id: f.id, x: f.x, y: f.y, dx: f.aim[0], dy: f.aim[1], len: lane.length });
    if (lane.some(([x, y]) => x === this.player.x && y === this.player.y)) this.hurt(f);
    f.aim = null;
  }
  align(f) {
    // slide sideways to line up with the player, keeping a tile of distance
    const p = this.player, dx = p.x - f.x, dy = p.y - f.y;
    if (!dx || !dy) return;
    const d = Math.abs(dx) < Math.abs(dy) ? [sgn(dx), 0] : [0, sgn(dy)];
    const nx = f.x + d[0], ny = f.y + d[1];
    if (Math.abs(p.x - nx) + Math.abs(p.y - ny) < 2) return;
    if (this.walkable(nx, ny) && !this.foeAt(nx, ny)) this.moveFoe(f, nx, ny);
  }

  act(f, k) {
    const p = this.player, ph = this.phase(k);
    if (f.stun >= k) return;
    switch (f.type) {
      case 'snare': case 'tom': case 'drummer':
        if (this.acts(f, k)) this.stepToward(f, p.x, p.y);
        break;
      case 'shaker':
        if (this.r() < .45) {
          const [dx, dy] = D4[Math.floor(this.r() * 4)], nx = f.x + dx, ny = f.y + dy;
          if (nx === p.x && ny === p.y) this.attack(f, dx, dy);
          else if (this.walkable(nx, ny) && !this.foeAt(nx, ny)) this.moveFoe(f, nx, ny);
        } else this.stepToward(f, p.x, p.y);
        break;
      case 'horn':            // lines up on 2, aims on 6, blasts its lane on 8
        if (ph === 1 || ph === 3) this.align(f);
        else if (ph === 5) { this.aimAt(f); this.emit('aim', { id: f.id }); }
        else if (ph === 7 && f.aim) this.blast(f);
        break;
      case 'guitar':          // aims on 2 and 6, shreds down the lane on 4 and 8
        if (ph === 1 || ph === 5) { this.aimAt(f); this.emit('aim', { id: f.id }); }
        else if ((ph === 3 || ph === 7) && f.aim) this.blast(f);
        else if (ph === 0 || ph === 4) this.align(f);
        break;
      case 'bassist':         // winds up on 4 and 8, charges three tiles on the next 1
        if (ph === 3 || ph === 7) { this.aimAt(f); this.emit('aim', { id: f.id, charge: 1 }); }
        else if ((ph === 0 || ph === 4) && f.aim) {
          const [dx, dy] = f.aim; f.aim = null;
          this.emit('charge', { id: f.id });
          for (let s = 0; s < 3; s++) {
            const nx = f.x + dx, ny = f.y + dy;
            if (nx === p.x && ny === p.y) { this.attack(f, dx, dy); break; }
            if (!this.walkable(nx, ny) || this.foeAt(nx, ny)) break;
            this.moveFoe(f, nx, ny);
          }
        } else if (ph === 2 || ph === 6) this.stepToward(f, p.x, p.y);
        break;
      case 'singer': {        // keeps her distance and calls up backing dancers
        if (ph === 0 && (k % 16 === 0) && this.foes.filter(o => o.hp > 0 && o.type === 'snare').length < 2) {
          for (const [dx, dy] of D4) {
            const nx = f.x + dx, ny = f.y + dy;
            if (this.walkable(nx, ny) && !this.foeAt(nx, ny) && !(nx === p.x && ny === p.y)) { const s = this.spawn('snare', nx, ny); s.stun = k; this.emit('summon', { id: s.id, x: nx, y: ny }); break; }
          }
        } else if ((ph === 2 || ph === 6) && this.dist(f) < 4) this.stepToward(f, p.x, p.y, true);
        else if (ph === 6 && this.dist(f) === 1) this.attack(f, sgn(p.x - f.x), sgn(p.y - f.y));
        break;
      }
    }
  }

  // which foes will move or strike on beat k (for the warning pips)
  threat(f, k) {
    if (f.hp <= 0 || f.stun >= k) return 0;
    const ph = this.phase(k);
    switch (f.type) {
      case 'horn': return ph === 7 && f.aim ? 2 : (ph === 5 ? 1 : 0);
      case 'guitar': return (ph === 3 || ph === 7) && f.aim ? 2 : (ph === 1 || ph === 5) ? 1 : 0;
      case 'bassist': return (ph === 0 || ph === 4) && f.aim ? 2 : (ph === 3 || ph === 7 || ph === 2 || ph === 6) ? 1 : 0;
      case 'shaker': return 1;
      case 'singer': return ph === 0 && k % 16 === 0 ? 1 : 0;
      default: return FOE[f.type].steps[ph] ? 1 : 0;
    }
  }

  // ------------------------------------------------------------ flow
  nextFloor() {
    const fi = this.fi + 1;
    this.status = 'play';
    this.setupFloor(fi);
  }
  // which parts are playing: yours, plus a part for every kind of thing on the floor
  parts() {
    const s = new Set(this.player.inst);
    if (this.status === 'dead') return new Set();
    for (const f of this.foes) if (f.hp > 0 && FOE[f.type].part) s.add(f.type);
    return s;
  }
}
