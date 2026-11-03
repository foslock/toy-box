import { segDist } from './levels.js';

// A stand-in player for the demo screen and for tuning: walks the paths to get behind the host,
// joins in with the bell, freezes when the host looks round, and strikes when it can.
const key = (x, y) => Math.round(x) + ',' + Math.round(y);

export function buildGraph(segs) {
  // split every segment at every crossing so the paths join up
  const cuts = segs.map(s => [[s[0], s[1], 0], [s[2], s[3], 1]]);
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const a = segs[i], b = segs[j];
    const d1x = a[2] - a[0], d1y = a[3] - a[1], d2x = b[2] - b[0], d2y = b[3] - b[1];
    const den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-6) continue;
    const t = ((b[0] - a[0]) * d2y - (b[1] - a[1]) * d2x) / den;
    const u = ((b[0] - a[0]) * d1y - (b[1] - a[1]) * d1x) / den;
    if (t < -0.01 || t > 1.01 || u < -0.01 || u > 1.01) continue;
    const x = a[0] + d1x * t, y = a[1] + d1y * t;
    cuts[i].push([x, y, t]); cuts[j].push([x, y, u]);
  }
  const nodes = new Map();
  const node = (x, y) => { const k = key(x, y); if (!nodes.has(k)) nodes.set(k, { x: Math.round(x), y: Math.round(y), k, nb: [] }); return nodes.get(k); };
  for (const c of cuts) {
    c.sort((p, q) => p[2] - q[2]);
    for (let i = 0; i + 1 < c.length; i++) {
      const a = node(c[i][0], c[i][1]), b = node(c[i + 1][0], c[i + 1][1]);
      if (a === b) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      a.nb.push([b, d]); b.nb.push([a, d]);
    }
  }
  return [...nodes.values()];
}

function nearest(nodes, x, y) {
  let best = null, bd = 1e9;
  for (const n of nodes) { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } }
  return best;
}

// distance-to-goal from every node, and the next hop toward it
function flood(nodes, goal) {
  const dist = new Map([[goal, 0]]), next = new Map(), open = [goal];
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (dist.get(open[i]) < dist.get(open[bi])) bi = i;
    const n = open.splice(bi, 1)[0];
    for (const [m, d] of n.nb) {
      const nd = dist.get(n) + d;
      if (nd < (dist.get(m) ?? 1e9)) { dist.set(m, nd); next.set(m, n); open.push(m); }
    }
  }
  return { dist, next };
}

export class Bot {
  constructor(game, opts = {}) {
    this.g = game;
    this.nodes = buildGraph(game.L.segs);
    this.think = 0;
    this.plan = [];
    this.react = opts.react ?? 0.35;   // seconds before it notices the bell or a glance
    this.careless = opts.careless ?? 0;
    this.naive = !!opts.naive;
    this.seenTell = 0;
    this.ringT = 0;
  }
  step(dt) {
    const g = this.g, p = g.player, h = g.host, I = g.input, R = g.R;
    I.mx = 0; I.my = 0;
    if (g.mode === 'duel') {
      const dx = h.x - p.x, dy = h.y - p.y, d = Math.hypot(dx, dy);
      if (h.state === 'windup' && this.wu !== h) { this.wu = h; this.rollAt = 0.04 + R() * 0.4; }
      if (h.state !== 'windup') this.wu = null;
      I.gesture = h.state === 'windup' && h.timer < this.rollAt && d < 80;
      if (h.state === 'recover' && d < 44) I.stab = true;
      else if (h.state === 'recover') { I.mx = dx / d; I.my = dy / d; }
      else if (d < 90) { I.mx = -dy / d; I.my = dx / d; }
      return;
    }
    if (g.mode !== 'sneak') return;
    const ring = g.bell.state === 'ring';
    this.ringT = ring ? this.ringT + dt : 0;
    if (ring) { I.gesture = this.ringT > this.react; return; }
    I.gesture = false;
    if (!g.hostOn || !h.entered) { this.wander(dt); return; }
    if (g.canStab()) { I.stab = true; return; }
    // the host is looking round: freeze, or keep walking if we're on a path and not heading at them
    const wary = h.state === 'tell' || h.state === 'glance' || h.state === 'curious' || h.state === 'look' || h.state === 'watch';
    this.seenTell = wary ? this.seenTell + dt : 0;
    const goal = { x: h.x - Math.cos(h.face) * 26, y: h.y - Math.sin(h.face) * 26 };
    const dGoal = Math.hypot(goal.x - p.x, goal.y - p.y);
    this.think -= dt;
    if (this.think <= 0) {
      this.think = 0.4;
      const b = nearest(this.nodes, goal.x, goal.y);
      const { dist, next } = flood(this.nodes, b);
      // join the network at a nearby node, whichever is shortest to go on from
      // (both ends of the nearest stretch of path count as nearby)
      let near = 1e9, edge = null, ed = 1e9;
      for (const n of this.nodes) {
        near = Math.min(near, Math.hypot(n.x - p.x, n.y - p.y));
        for (const [m] of n.nb) { const d = segDist(p.x, p.y, n.x, n.y, m.x, m.y); if (d < ed) { ed = d; edge = [n, m]; } }
      }
      let best = null, bd = 1e9;
      for (const n of this.nodes) {
        const e = Math.hypot(n.x - p.x, n.y - p.y);
        if (ed < 30 ? !edge.includes(n) : e > near * 1.5 + 40) continue;
        const d = e + (dist.get(n) ?? 1e9);
        if (d < bd) { bd = d; best = n; }
      }
      this.plan = [];
      if (bd >= 1e9) best = null;
      for (let n = best; n && this.plan.length < 40; n = next.get(n)) this.plan.push(n);
    }
    let tx, ty;
    if (dGoal < 70 || this.naive) { tx = goal.x; ty = goal.y; }
    else if (this.plan.length) { tx = this.plan[0].x; ty = this.plan[0].y; if (Math.hypot(tx - p.x, ty - p.y) < 10) { this.plan.shift(); if (this.plan.length) { tx = this.plan[0].x; ty = this.plan[0].y; } } }
    else { tx = goal.x; ty = goal.y; }
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
    const atHost = Math.abs(Math.atan2(h.y - p.y, h.x - p.x) - Math.atan2(dy, dx)) < 0.5;
    if (wary && this.seenTell > this.react && g.sees(p.x, p.y) && (atHost || dGoal < 70) && R() > this.careless) return;
    I.mx = dx / d; I.my = dy / d;
  }
  wander() {}
}
