// A route finder that lays out a run of a chosen colour between two points, and a simple bot that
// uses it to run a resort. The demo screenshot and the Node balance sim both use these.

import { W, H, MPU, CLIFF, GREEN_MAX, BLUE_MAX } from './terrain.js';
import { CFG } from './game.js';

const BAND = [[0.02, GREEN_MAX * .92], [GREEN_MAX * 1.08, BLUE_MAX * .94], [BLUE_MAX * 1.08, CLIFF * .8]];
const G = 8;
const MOVES = [];
for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
  if (!dx && !dy) continue;
  if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
  if ((Math.abs(dx) === 2 && dy === 0) || (Math.abs(dy) === 2 && dx === 0)) continue;
  MOVES.push([dx, dy]);
}

// A* over a coarse grid: every step goes down at a grade below the colour's limit, and somewhere the run
// has to reach the colour's own steepness. Returns points spaced CFG.step apart, or null.
export function findRun(game, from, to, cls, opts = {}) {
  const T = game.T, gw = Math.floor(W / G) + 1, gh = Math.floor(H / G) + 1;
  const gmax = BAND[cls][1];
  const lowNeed = cls === 0 ? 0 : BAND[cls][0];
  const sx = Math.round(from.x / G), sy = Math.round(from.y / G);
  const tx = to.x, ty = to.y;
  const idx = (x, y, f) => ((y * gw + x) << 1) | f;
  const gs = new Map(), came = new Map(), open = [];
  const push = (k, f) => { open.push([f, k]); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
  const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } } return top; };
  const k0 = idx(sx, sy, cls === 0 ? 1 : 0);
  gs.set(k0, 0); push(k0, Math.hypot(tx - from.x, ty - from.y));
  const hAt = (x, y) => T.height(x * G, y * G);
  let iters = 0, goal = -1;
  const wiggle = opts.wiggle || 0;
  while (open.length && iters++ < 60000) {
    const [, k] = pop();
    const f = k & 1, c = k >> 1, x = c % gw, y = (c / gw) | 0;
    const g0 = gs.get(k);
    if (f && Math.hypot(x * G - tx, y * G - ty) < 13) {
      // last hop must also go down
      const dh = hAt(x, y) - to.h, d = Math.hypot(x * G - tx, y * G - ty) * MPU;
      if (dh >= -2 && (d < 1 || dh / d < gmax)) { goal = k; break; }
    }
    const h0 = hAt(x, y);
    for (const [dx, dy] of MOVES) {
      const nx = x + dx, ny = y + dy;
      if (nx < 1 || ny < 1 || nx >= gw - 1 || ny >= gh - 1) continue;
      const len = Math.hypot(dx, dy) * G, h1 = hAt(nx, ny), gr = (h0 - h1) / (len * MPU);
      if (gr < -.005 || gr > gmax) continue;
      if (T.grade(nx * G, ny * G) > CLIFF * .9 || T.grade((x + nx) * G / 2, (y + ny) * G / 2) > CLIFF * .9) continue;
      const nf = f || gr >= lowNeed ? 1 : 0;
      const nk = idx(nx, ny, nf);
      const ng = g0 + len * (1 + wiggle * Math.sin(nx * 1.7 + ny * 2.3));
      if (ng < (gs.get(nk) ?? Infinity)) { gs.set(nk, ng); came.set(nk, k); push(nk, ng + Math.hypot(nx * G - tx, ny * G - ty)); }
    }
  }
  if (goal < 0) { if (opts.dbg) console.log("no goal", iters); return null; }
  const cells = [];
  for (let k = goal; k !== undefined; k = came.get(k)) { const c = k >> 1; cells.push([(c % gw) * G, ((c / gw) | 0) * G]); }
  cells.reverse();
  cells[0] = [from.x, from.y]; cells.push([to.x, to.y]);
  // try it smoothed a little first (looks drawn), then as found
  for (const passes of [2, 0]) {
    let pts = cells;
    for (let it = 0; it < passes; it++) pts = pts.map((p, i) => i === 0 || i === pts.length - 1 ? p : [(pts[i - 1][0] + 2 * p[0] + pts[i + 1][0]) / 4, (pts[i - 1][1] + 2 * p[1] + pts[i + 1][1]) / 4]);
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = out[out.length - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.round(d / CFG.step));
      for (let j = 1; j <= n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
    }
    let bad = game.endOk(out[out.length - 2], to);
    for (let i = 1; i < out.length - 1 && !bad; i++) bad = game.runStepOk(out.slice(Math.max(0, i - 8), i), out[i]);
    if (bad) { if (opts.dbg) console.log('step', bad); continue; }
    const m = game.measureRun(out);
    if (m.cls !== cls) { if (opts.dbg) console.log('cls', m.cls, m.steep); continue; }
    return out;
  }
  return null;
}

// where a lift from n could usefully go: the highest reachable point within reach (a few angles tried)
export function liftTarget(game, n, avoid = [], reach = 1) {
  const T = game.T, R = (game.liftMax - 2) * reach;
  let best = null, bs = -Infinity;
  for (let a = 0; a < 48; a++) {
    const ang = -Math.PI / 2 + (a / 48 - .5) * Math.PI * 1.5;
    for (const f of [1, .8, .6]) {
      const x = n.x + Math.cos(ang) * R * f, y = n.y + Math.sin(ang) * R * f;
      if (!T.inside(x, y) || x < 20 || x > W - 20 || y < 20) continue;
      if (T.grade(x, y) > .5) continue;
      let pen = 0; for (const p of avoid) pen += Math.max(0, 90 - Math.hypot(p.x - x, p.y - y)) * 4;
      const s = T.height(x, y) - n.h - pen;
      if (s > bs) { bs = s; best = { x, y }; }
    }
  }
  return bs > CFG.liftClimb + 20 ? best : null;
}

export class Bot {
  constructor(game, opts = {}) { this.g = game; this.t = 0; this.opts = opts; this.tops = new Map(); this.tried = new Set(); }

  // build a lift from lodge n and runs of every colour that will go back down to it
  serve(n) {
    const g = this.g;
    if (g.inv.lift < 1) return false;
    const avoid = [...g.nodes.values()].filter(m => m.kind !== 'lodge');
    // try shorter lifts until one has room for a green run back down (as a person would)
    let fallback = null;
    for (const reach of [1, .75, .55]) {
      const tp = liftTarget(g, n, avoid, reach);
      if (!tp) continue;
      const top = { x: tp.x, y: tp.y, h: g.T.height(tp.x, tp.y) };
      const runs = [0, 1, 2].map(cls => findRun(g, top, n, cls));
      if (runs[0]) return this.place(n, tp, runs);
      if (!fallback && runs.some(Boolean)) fallback = [tp, runs];
    }
    return fallback ? this.place(n, ...fallback) : false;
  }
  place(n, tp, runs) {
    const g = this.g, top = g.addNode(tp.x, tp.y, 'stn');
    g.addLift(n, top);
    runs.forEach(p => { if (p) { p[0] = [top.x, top.y]; g.addRun(top, n, p); } });
    this.tops.set(n.id, top);
    return true;
  }

  // a lodge that can't serve a colour: try a run of that colour from an existing top station
  patch(n) {
    const into = [...this.g.edges.values()].filter(e => e.type === 'run' && e.b === n.id).length;
    if (into >= 5) return false;
    const key = 'p' + n.id + ':' + this.g.version;
    if (this.tried.has(key)) return false;
    this.tried.add(key);
    const g = this.g, can = g.served3(n);
    for (const cls of [0, 1, 2]) {
      if (can[cls]) continue;
      for (const top of [...g.nodes.values()].filter(m => m.kind === 'stn').sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y))) {
        if (!this.reachable(n, top)) continue;
        const pts = findRun(g, top, n, cls);
        if (pts) { g.addRun(top, n, pts); return true; }
      }
    }
    return false;
  }
  // no lift to spare: a run in from a top station, and a run out to a lodge that has a lift
  hookUp(n) {
    if ([...this.g.edges.values()].filter(e => e.type === 'run' && (e.b === n.id || e.a === n.id)).length >= 4) return false;
    const key = 'h' + n.id + ':' + this.g.version;
    if (this.tried.has(key)) return false;
    this.tried.add(key);
    const g = this.g, near = (list) => list.sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y));
    let did = false;
    const tops = near([...g.nodes.values()].filter(m => m.kind === 'stn' && m.h > n.h + 20)).slice(0, 4);
    for (const cls of [0, 1, 2]) for (const top of tops) { const p = findRun(g, top, n, cls); if (p) { g.addRun(top, n, p); did = true; break; } }
    const bases = near(g.lodges().filter(m => m !== n && m.h < n.h - 10 && g.outEdges(m).some(e => e.type === 'lift'))).slice(0, 4);
    for (const b of bases) { const p = findRun(g, n, b, 0) || findRun(g, n, b, 1); if (p) { g.addRun(n, b, p); did = true; break; } }
    return did;
  }
  reachable(n, top) { for (const e of this.g.edges.values()) if (e.type === 'lift' && e.a === n.id && e.b === top.id) return true; return false; }

  tick(dt) {
    const g = this.g;
    this.t += dt;
    if (this.t < (this.opts.every || 1.5)) return;
    this.t = 0;
    // gondolas go on the busiest lift
    if (g.inv.gondola > 0) {
      const lifts = [...g.edges.values()].filter(e => e.type === 'lift' && !e.gondola).sort((a, b) => b.queue.length - a.queue.length);
      if (lifts[0] && lifts[0].queue.length > 3) g.upgradeLift(lifts[0]);
    }
    for (const n of g.lodges()) {
      const has = g.outEdges(n).some(e => e.type === 'lift');
      if (!has && !g.served3(n).some(v => v)) { if (this.serve(n) || this.hookUp(n)) return; continue; }
      if (g.served3(n).some(v => !v) && g.levelsOn > 1) { if (this.patch(n)) return; }
      // a second lift for a crowded lodge
      if (g.crowd(n) > CFG.crowdCap * .6 && g.inv.lift > 0) { if (this.serve(n)) return; }
    }
  }
  // the day-end choice
  pick(options) { return options.includes('lift') && this.g.inv.lift < 1 ? 'lift' : options.includes('gondola') ? 'gondola' : options[0]; }
}
