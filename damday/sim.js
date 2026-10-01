// The game itself, with no page in it: the loop's clock, the player, everyone's schedules, the water, what you know
// and what you're carrying. The page (main.js) and the headless check (check.mjs) both drive this.
import { MAPS, ANCHORS, OBJECTS, PLAYER_START, findPath, doorAt, placeAt, key } from './world.js';
import { NPCS, THINGS, COSTS } from './people.js';
import { LOOP, BREAK } from './util.js';

export const PLAYER_STEP = 0.27, NPC_STEP = 0.3, FRONT_ROW0 = 5, FRONT_RATE = 0.4, WAKE = 1.5;
export const ITEMS = { sardine: 'a sardine', keys: 'Orla’s keys', fuse: 'Timothy, a brass fuse' };
const DIRS = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const dirOf = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');

export function newStore() { return { known: new Set(['ticket']), order: ['ticket'], met: {}, seen: {}, loops: 0, history: [], won: false, intro: false }; }

class Walker {
  constructor(map, x, y, dir = 'down') { Object.assign(this, { map, x, y, fx: x, fy: y, dir, p: 1, dur: 0.25 }); }
  get moving() { return this.p < 1; }
  get rx() { return this.fx + (this.x - this.fx) * this.p; }
  get ry() { return this.fy + (this.y - this.fy) * this.p; }
  begin(nx, ny, dur) { this.fx = this.x; this.fy = this.y; this.dir = dirOf(nx - this.x, ny - this.y); this.x = nx; this.y = ny; this.p = 0; this.dur = dur; }
  put(map, x, y) { this.map = map; this.x = this.fx = x; this.y = this.fy = y; this.p = 1; }
  advance(dt) { if (this.p < 1) { this.p = Math.min(1, this.p + dt / this.dur); return this.p >= 1; } return false; }
}

const doorRow = {};   // interior id -> the row of the town door that leads into it, for when the water reaches it
for (const [k, d] of MAPS.town.doors) doorRow[d.to] = +k.split(',')[1];

export class Game {
  constructor(store = newStore()) { this.store = store; this.events = []; this.view = { hw: 8, hh: 6 }; this.startLoop(); }

  /* ---------------------------------------------------------------- the loop */
  startLoop() {
    this.t = 0; this.flags = new Map(); this.items = new Set(); this.ff = 0; this.talk = null; this.over = null; this.ended = false; this.lastObs = 0; this.chime = 0;
    this.groans = 0; this.broke = false; this.nextBell = 0;
    this.player = new Walker(PLAYER_START.map, PLAYER_START.x, PLAYER_START.y, 'down'); this.player.dur = PLAYER_STEP;
    this.player.path = null; this.player.want = null; this.player.target = null; this.player.caught = false; this.wake = WAKE;
    this.npcs = NPCS.map(def => {
      const n = new Walker('town', 0, 0); n.def = def; n.id = def.id; n.dur = NPC_STEP; n.path = []; n.caught = false; n.act = 'idle'; n.goal = null;
      const a = ANCHORS[def.goal(this)]; n.put(a.map, a.x, a.y); n.dir = a.face; n.goal = def.goal(this); n.say = null;
      return n;
    });
    this.emit('loop', this.store.loops + 1);
  }
  emit(type, data) { this.events.push({ type, data }); }
  drain() { const e = this.events; this.events = []; return e; }

  /* ---------------------------------------------------------------- knowledge, flags and things carried */
  K(id) { return this.store.known.has(id); }
  learn(id) { if (!this.store.known.has(id)) { this.store.known.add(id); (this.store.order ||= []).push(id); this.emit('learn', id); } }
  F(f) { return this.flags.has(f); }
  setF(f) { if (!this.flags.has(f)) this.flags.set(f, this.t); }
  since(f) { return this.flags.has(f) ? this.t - this.flags.get(f) : -1; }
  has(i) { return this.items.has(i); }
  give(i) { this.items.add(i); this.emit('item', { id: i, got: true }); }
  take(i) { this.items.delete(i); this.emit('item', { id: i, got: false }); }

  /* ---------------------------------------------------------------- the water */
  frontRow() { return this.t < BREAK ? -1 : FRONT_ROW0 + (this.t - BREAK) / FRONT_RATE; }
  safeAt(e) { const a = MAPS[e.map]; return a.interior ? !!a.safeAll : !!a.safe[e.y * a.w + e.x]; }
  rowOf(e) { return MAPS[e.map].interior ? (doorRow[e.map] ?? 0) : e.y; }
  swept(e) { return !this.safeAt(e) && this.rowOf(e) <= this.frontRow(); }

  /* ---------------------------------------------------------------- time */
  tick(dt) {
    if (this.ended) return;
    if (this.talk) return;
    if (this.ff > 0) { const step = Math.min(this.ff, dt * 8); this.ff -= step; this.ffRun = true; this.run(step); this.ffRun = false; return; }
    this.run(dt);
  }
  run(dt) {
    while (dt > 1e-9 && !this.ended) { const h = Math.min(dt, 0.05); this.step(h); dt -= h; }
  }
  step(dt) {
    this.t += dt;
    const t = this.t;
    // minute chimes, the dam's groans, the break
    while (this.chime < 3 && t >= 60 * (this.chime + 1)) { this.chime++; this.emit('chime', this.chime); }
    if (this.groans < 1 && t >= 195) { this.groans = 1; this.emit('groan', 1); this.learn('dam_groan'); }
    if (this.groans < 2 && t >= 208) { this.groans = 2; this.emit('groan', 2); }
    if (this.groans < 3 && t >= 220) { this.groans = 3; this.emit('groan', 3); }
    if (!this.broke && t >= BREAK) { this.broke = true; this.emit('break'); this.learn('dam_break'); }
    if (this.F('siren_on') && this.since('siren_on') >= 6 && !this.F('decree')) this.learn('siren_alone');
    // once the Mayor has decreed, Gideon rings the chapel bell and keeps ringing
    if (this.F('decree') && t >= this.nextBell && t < LOOP - 1) { this.emit('bellring', 'gideon'); this.nextBell = t + 2.6; }
    if (t >= BREAK + 8 && this.safeAt(this.player) && !this.player.caught) this.learn('hill_safe');
    // the player
    this.stepPlayer(dt);
    // everyone else
    for (const n of this.npcs) this.stepNpc(n, dt);
    if (this.broke) {
      if (!this.player.caught && this.swept(this.player)) { this.player.caught = true; this.emit('caught', 'you'); }
      for (const n of this.npcs) if (!n.caught && this.swept(n)) { n.caught = true; this.emit('caught', n.id); }
    }
    this.observe();
    if (t >= LOOP) this.finish();
  }

  stepPlayer(dt) {
    const p = this.player;
    if (this.wake > 0) { this.wake -= dt; return; }
    if (p.caught) return;
    if (p.advance(dt)) this.arrive(p);
    if (p.moving || this.ffRun) return;      // while time is passing under a conversation, you stand still
    let dir = p.want || p.queued; p.queued = null;     // a quick tap that was over before this tick still counts as one step
    if (!dir && p.path) {
      // follow the tapped route, one tile at a time; stop when it's done or the way is shut
      const n = p.path[0];
      if (!n) { p.path = null; if (!p.target) return; }
      else if (n.map !== p.map) { p.path = null; }
      else { if (Math.abs(n.x - p.x) + Math.abs(n.y - p.y) !== 1) { p.path = null; return; } dir = dirOf(n.x - p.x, n.y - p.y); }
    }
    if (p.target && !dir) {
      // walking to somebody or something: speak up as soon as we're near enough
      const tg = this.resolve(p.target);
      if (!tg) { p.target = null; return; }
      if (this.dist(tg) <= (tg.kind === 'npc' ? 1.6 : 1.5)) { const tgt = p.target; p.target = null; p.path = null; this.interact(tgt); return; }
      if (!p.path || !p.path.length) { p.path = this.pathNear(tg); if (!p.path) { p.target = null; return; } p.path = p.path.length ? p.path : null; if (p.path) { const n = p.path[0]; dir = dirOf(n.x - p.x, n.y - p.y); } }
    }
    if (!dir) return;
    const [dx, dy] = DIRS[dir], nx = p.x + dx, ny = p.y + dy;
    p.dir = dir;
    if (MAPS[p.map].walk(nx, ny)) { p.begin(nx, ny, PLAYER_STEP); if (p.path && p.path[0] && p.path[0].x === nx && p.path[0].y === ny) p.path.shift(); }
    else if (p.path) { p.path = null; }
  }
  arrive(w) {
    const d = doorAt(w.map, w.x, w.y);
    if (d) { w.put(d.to, d.x, d.y); w.dir = d.dir; if (w === this.player) { this.emit('door', d); if (w.path) while (w.path.length && (w.path[0].map !== w.map || (w.path[0].x === w.x && w.path[0].y === w.y))) w.path.shift(); } }
  }
  stepNpc(n, dt) {
    if (n.caught) return;
    if (n.advance(dt)) this.arrive(n);
    const want = n.def.goal(this);
    if (want !== n.goal) { n.goal = want; const a = ANCHORS[want]; n.path = findPath(n, a) || []; n.goalWait = 0; }
    while (!n.moving && n.path.length && n.path[0].map === n.map && n.path[0].x === n.x && n.path[0].y === n.y) n.path.shift();
    if (!n.moving && n.path.length) {
      const nx = n.path[0];
      if (nx.map !== n.map) { n.path.shift(); n.put(nx.map, nx.x, nx.y); }
      else { n.path.shift(); n.begin(nx.x, nx.y, NPC_STEP); }
    }
    const a = ANCHORS[n.goal];
    n.act = n.moving || n.path.length ? 'walk' : (a.act || 'idle');
    if (!n.moving && !n.path.length && n.x === a.x && n.y === a.y && n.map === a.map) n.dir = a.face;
  }

  /* ---------------------------------------------------------------- the notebook's "who's where" grid */
  observe() {
    if (this.t - this.lastObs < 0.5) return; this.lastObs = this.t;
    const p = this.player, b = Math.min(7, Math.floor(this.t / 30));
    for (const n of this.npcs) {
      if (n.map !== p.map || n.caught) continue;
      if (Math.abs(n.x - p.x) > this.view.hw + 1 || Math.abs(n.y - p.y) > this.view.hh + 1) continue;
      (this.store.seen[n.id] ||= Array(8).fill(null))[b] = placeAt(n.map, n.x, n.y);
    }
  }

  /* ---------------------------------------------------------------- finding what to talk to */
  resolve(t) {
    if (t.kind === 'npc') { const n = this.npcs.find(x => x.id === t.id); return n && !n.caught && { kind: 'npc', id: n.id, map: n.map, x: n.x, y: n.y }; }
    const o = OBJECTS.find(x => x.id === t.id); return o && { kind: 'thing', id: o.id, map: o.map, x: o.x, y: o.y };
  }
  dist(t) { const p = this.player; return t.map === p.map ? Math.hypot(t.x - p.x, t.y - p.y) : 99; }
  nearby() {
    const p = this.player, out = [];
    if (this.wake > 0 || p.caught) return out;
    for (const n of this.npcs) if (!n.caught && n.map === p.map) { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d <= 2.4) out.push({ kind: 'npc', id: n.id, d }); }
    for (const o of OBJECTS) if (o.map === p.map && THINGS[o.id]) { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d <= 1.6) out.push({ kind: 'thing', id: o.id, d }); }
    const [fx, fy] = DIRS[p.dir];
    const pos = t => t.kind === 'npc' ? this.npcs.find(n => n.id === t.id) : OBJECTS.find(o => o.id === t.id);
    for (const c of out) { const q = pos(c); const dot = ((q.x - p.x) * fx + (q.y - p.y) * fy) / (c.d || 1); c.score = c.d - (dot > 0.3 ? 0.4 : 0) - (c.kind === 'npc' ? 0.15 : 0); }
    return out.sort((a, b) => a.score - b.score);
  }
  pathNear(tg) {
    const p = this.player; let best = null;
    const a = MAPS[tg.map];
    const cand = a.walk(tg.x, tg.y) ? [[tg.x, tg.y]] : [[0, 1], [1, 0], [-1, 0], [0, -1]].map(([dx, dy]) => [tg.x + dx, tg.y + dy]).filter(([x, y]) => a.walk(x, y));
    for (const [x, y] of cand) { const r = findPath(p, { map: tg.map, x, y }); if (r && (!best || r.length < best.length)) best = r; }
    return best;
  }

  /* ---------------------------------------------------------------- walking by command */
  setWant(dir) { this.player.want = dir; if (dir) { this.player.path = null; this.player.target = null; this.player.queued = dir; } }
  walkTo(map, x, y) { const r = findPath(this.player, { map, x, y }); this.player.target = null; this.player.path = r && r.length ? r : null; return !!r; }
  goTo(target) { this.player.path = null; this.player.target = target; }
  get walking() { return !!(this.player.path || this.player.target || this.player.moving || this.wake > 0); }

  /* ---------------------------------------------------------------- talking */
  interact(target) {
    if (this.talk || this.ended || this.wake > 0 || this.player.caught) return null;
    const near = target ? [target] : this.nearby(); if (!near.length) return null;
    const c = near[0];
    this.player.path = null; this.player.target = null; this.player.want = null; this.player.queued = null;
    if (c.kind === 'npc') {
      const n = this.npcs.find(x => x.id === c.id);
      const dx = n.x - this.player.x, dy = n.y - this.player.y; if (dx || dy) this.player.dir = dirOf(dx, dy);
      n.say = null; (this.store.met ||= {})[n.id] = true;
      this.talk = { kind: 'npc', id: n.id, name: n.def.name, cat: !!n.def.cat, cost: COSTS.open, page: 0, pages: [], ask: [], done: false };
      this.setScene(n.def.talk(this, undefined));
    } else {
      const th = OBJECTS.find(o => o.id === c.id), r = THINGS[c.id](this);
      const dx = th.x - this.player.x, dy = th.y - this.player.y; if (dx || dy) this.player.dir = dirOf(dx, dy);
      this.talk = { kind: 'thing', id: c.id, name: '', cost: COSTS.thing + (r.cost || 0), page: 0, pages: [], ask: [], done: false };
      this.setScene(r);
    }
    this.emit('talk', this.talk);
    return this.talk;
  }
  setScene(sc) { const t = this.talk; t.pages = sc?.say?.length ? sc.say : ['…']; t.ask = sc?.ask || []; t.page = 0; }
  choose(topic) {
    const t = this.talk; if (!t || t.kind !== 'npc') return;
    const n = this.npcs.find(x => x.id === t.id);
    t.cost += COSTS.topic; this.setScene(n.def.talk(this, topic));
  }
  advance() { const t = this.talk; if (!t) return false; if (t.page < t.pages.length - 1) { t.page++; return true; } return false; }
  leave() {
    const t = this.talk; if (!t) return 0;
    this.talk = null; this.ff = t.cost; this.emit('leave', t.cost); return t.cost;
  }

  /* ---------------------------------------------------------------- the end of a loop */
  abandon() { if (this.ended) return; this.abandoned = true; this.t = LOOP; this.finish(); }
  finish() {
    if (this.ended) return;
    this.ended = true;
    const all = [...this.npcs.map(n => ({ id: n.id, name: n.def.name, safe: !n.caught && this.safeAt(n), where: placeAt(n.map, n.x, n.y), act: n.act }))];
    const you = !this.player.caught && this.safeAt(this.player);
    const saved = all.filter(x => x.safe).length;
    this.over = { saved, total: all.length, you, all, win: !this.abandoned && you && saved === all.length, loop: this.store.loops + 1, abandoned: !!this.abandoned };
    this.store.loops++; if (!this.abandoned) this.store.history.push({ loop: this.store.loops, saved, total: all.length, you, lost: all.filter(x => !x.safe).map(x => x.id) }); if (this.store.history.length > 40) this.store.history.shift();
    if (this.over.win) this.store.won = true;
    this.emit('end', this.over);
  }
}
