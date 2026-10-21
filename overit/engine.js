// Pinball physics for one table at a time. Pure: no DOM, so Node sims can run it.
// Units: the table is 360 × 640, y points down the playfield (toward the flippers).

export const W = 360, H = 640, R = 8.5, GRAV = 1150;
export const STEP = 1 / 120, SUB = 8;
const MAXV = 2500;

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function arc(cx, cy, r, a0, a1, n = 10) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * i / n;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

// Builds a table from its definition. The definition's build(t) calls the helpers below.
export function makeTable(def, seed = 1) {
  const t = {
    def, time: 0, rand: rng(seed),
    segs: [], circles: [], flippers: [], rails: [], zones: [], targets: [], events: [],
    ball: { x: 0, y: 0, vx: 0, vy: 0, live: false },
    gate: { x: 180, w: 40, base: 180, amp: 0, period: 4, vx: 0, closed: false },
    top: { x0: 70, x1: 290 },
    grav: { x: 0, y: GRAV }, tiltAmp: 0, tiltRate: 0.7, tiltAng: 0,
    gust: null, gustEvery: 0, nextGust: 0, gustForce: 0,
    tilted: false, tiltMeter: 0, wallE: 0.45,
  };

  t.wall = (pts, o = {}) => {
    const rail = { pts, kind: o.kind || 'rail', color: o.color };
    t.rails.push(rail);
    for (let i = 0; i < pts.length - 1; i++) {
      t.segs.push({ ax: pts[i][0], ay: pts[i][1], bx: pts[i + 1][0], by: pts[i + 1][1], e: o.e ?? t.wallE, kind: 'wall', kick: 0 });
    }
    return rail;
  };
  t.bumper = (x, y, r = 18, kick = 640, o = {}) => {
    const c = { x, y, r, e: 0.3, kick, kind: 'bumper', lit: 0, ...o };
    t.circles.push(c);
    return c;
  };
  t.post = (x, y, r = 5, o = {}) => {
    const c = { x, y, r, e: 0.5, kick: 0, kind: 'post', lit: 0, ...o };
    t.circles.push(c);
    return c;
  };
  t.sling = (a, b, c, side) => {
    // a: top post, b: bottom-outer post, c: bottom-inner post. a–c is the kicking face.
    t.segs.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], e: 0.4, kind: 'wall', kick: 0 });
    t.segs.push({ ax: b[0], ay: b[1], bx: c[0], by: c[1], e: 0.4, kind: 'wall', kick: 0 });
    const s = { ax: a[0], ay: a[1], bx: c[0], by: c[1], e: 0.5, kind: 'sling', kick: 520, lit: 0, tri: [a, b, c], side };
    t.segs.push(s);
    t.slings = t.slings || [];
    t.slings.push(s);
    for (const p of [a, b, c]) t.post(p[0], p[1], 5, { kind: 'slingpost' });
  };
  t.flipper = (px, py, side, len = 60) => {
    const rest = side < 0 ? 0.52 : Math.PI - 0.52, up = side < 0 ? -0.5 : Math.PI + 0.5;
    const f = { px, py, side, len, r1: 11, r2: 6, rest, up, ang: rest, w: 0, held: false };
    t.flippers.push(f);
    return f;
  };
  t.zone = z => { t.zones.push(z); return z; };
  t.target = (x, y, w, h, o = {}) => {
    // drop targets: thin vertical or horizontal bars that drop when struck
    const tg = { x, y, w, h, down: false, lit: 0, ...o };
    tg.segs = [
      { ax: x, ay: y, bx: x + w, by: y, e: 0.4, kind: 'target', kick: 0, tg },
      { ax: x + w, ay: y, bx: x + w, by: y + h, e: 0.4, kind: 'target', kick: 0, tg },
      { ax: x + w, ay: y + h, bx: x, by: y + h, e: 0.4, kind: 'target', kick: 0, tg },
      { ax: x, ay: y + h, bx: x, by: y, e: 0.4, kind: 'target', kick: 0, tg },
    ];
    t.targets.push(tg);
    return tg;
  };
  t.frame = (o = {}) => frame(t, o);

  def.build(t);
  // the top wall either side of the gate, and the gate's two short lane walls, move with the gate
  t.gateSegs = [0, 1, 2, 3, 4].map(() => ({ ax: 0, ay: 0, bx: 0, by: 0, e: t.wallE, kind: 'wall', kick: 0, svx: 0, svy: 0 }));
  t.gate.base = t.gate.x;
  placeGate(t);
  return t;
}

// The standard cabinet: side walls, rounded top corners, slopes into two flippers, slingshots.
function frame(t, o) {
  const cl = o.cornerL ?? 70, cr = o.cornerR ?? 70;
  const left = [[0, 470], [0, cl]];
  if (cl > 0) left.push(...arc(cl, cl, cl, Math.PI, Math.PI * 1.5, 10).slice(1));
  else left.push([0, 0]);
  const right = [[W, 470], [W, cr]];
  if (cr > 0) right.push(...arc(W - cr, cr, cr, 0, -Math.PI / 2, 10).slice(1));
  else right.push([W, 0]);
  t.wall(left.reverse(), { kind: 'outer' });
  t.wall(right.reverse(), { kind: 'outer' });
  t.top = { x0: cl, x1: W - cr };
  t.corner = { l: cl, r: cr };
  // slopes down to the flipper pivots
  t.wall([[0, 470], [108, 549]], { kind: "outer" });
  t.wall([[W, 470], [W - 108, 549]], { kind: "outer" });
  const len = o.flipperLen ?? 60;
  t.flipper(110, 564, -1, len);
  t.flipper(W - 110, 564, 1, len);
  if (o.slings !== false) {
    t.sling([50, 404], [50, 474], [92, 500], -1);
    t.sling([W - 50, 404], [W - 50, 474], [W - 92, 500], 1);
  }
}

function placeGate(t) {
  const g = t.gate;
  if (g.shut) {
    // lightning: open for shut[0] seconds, then slammed shut for shut[1]
    const k = t.time % (g.shut[0] + g.shut[1]);
    const closed = k > g.shut[0];
    if (closed !== g.closed) { g.closed = closed; t.events.push({ type: closed ? 'slam' : 'reopen' }); }
  }
  const prev = g.x;
  g.x = g.base + (g.amp ? g.amp * Math.sin(t.time * Math.PI * 2 / g.period) : 0);
  g.vx = (g.x - prev) / (STEP / SUB);
  if (!isFinite(g.vx) || Math.abs(g.vx) > 2000) g.vx = 0;
  const l = g.x - g.w / 2, r = g.x + g.w / 2, s = t.gateSegs;
  set(s[0], t.top.x0, 0, l, 0, 0);
  set(s[1], r, 0, t.top.x1, 0, 0);
  set(s[2], l, 0, l, -46, g.vx);
  set(s[3], r, 0, r, -46, g.vx);
  set(s[4], l, 0, r, 0, g.vx);  // the shutter, only solid while the gate is closed
  s[2].off = s[3].off = true;  // drawn, but the opening captures anything that reaches it
  s[4].off = !g.closed;
}
function set(s, ax, ay, bx, by, vx) { s.ax = ax; s.ay = ay; s.bx = bx; s.by = by; s.svx = vx; }

export function flipperTip(f) {
  return [f.px + Math.cos(f.ang) * f.len, f.py + Math.sin(f.ang) * f.len];
}

export function placeBall(t, x, y, vx = 0, vy = 0) {
  Object.assign(t.ball, { x, y, vx, vy, live: true });
}

// Advances one fixed STEP. Returns events since last call via t.events.
export function step(t) {
  const h = STEP / SUB;
  // table-wide behaviours
  if (t.tiltAmp) {
    t.tiltAng = t.tiltAmp * Math.sin(t.time * t.tiltRate * Math.PI * 2 / 6);
  }
  let gx = Math.sin(t.tiltAng) * GRAV, gy = Math.cos(t.tiltAng) * GRAV;
  if (t.gustEvery) {
    if (!t.gust && t.time >= t.nextGust) {
      t.gust = { dir: t.rand() < 0.5 ? -1 : 1, start: t.time + 1.2, end: t.time + 1.2 + 1.4 };
      t.events.push({ type: 'gustwarn', dir: t.gust.dir });
    }
    if (t.gust) {
      if (t.time > t.gust.end) { t.gust = null; t.nextGust = t.time + t.gustEvery * (0.6 + t.rand() * 0.8); }
      else if (t.time > t.gust.start) gx += t.gust.dir * t.gustForce;
    }
  }
  t.grav.x = gx; t.grav.y = gy;
  for (const c of t.circles) if (c.move) { const p = c.move(t.time); c.vx = (p[0] - c.x) / STEP; c.vy = (p[1] - c.y) / STEP; c.x = p[0]; c.y = p[1]; }
  for (const c of t.circles) if (c.lit > 0) c.lit -= STEP;
  if (t.slings) for (const s of t.slings) if (s.lit > 0) s.lit -= STEP;
  for (const tg of t.targets) if (tg.lit > 0) tg.lit -= STEP;

  const b = t.ball;
  for (let i = 0; i < SUB; i++) {
    t.time += h;
    placeGate(t);
    for (const f of t.flippers) moveFlipper(f, h, t.tilted);
    if (!b.live) continue;
    b.vx += gx * h; b.vy += gy * h;
    for (const z of t.zones) {
      if (b.x > z.x && b.x < z.x + z.w && b.y > z.y && b.y < z.y + z.h) {
        if (z.drag) { const k = 1 - z.drag * h; b.vx *= k; b.vy *= k; }
        if (z.fx) b.vx += z.fx * h;
        if (z.fy) b.vy += z.fy * h;
      }
    }
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > MAXV) { b.vx *= MAXV / sp; b.vy *= MAXV / sp; }
    b.x += b.vx * h; b.y += b.vy * h;
    for (const s of t.segs) collideSeg(t, b, s);
    for (const s of t.gateSegs) if (!s.off) collideSeg(t, b, s);
    for (const tg of t.targets) if (!tg.down) for (const s of tg.segs) collideSeg(t, b, s);
    for (const c of t.circles) collideCircle(t, b, c);
    for (const f of t.flippers) collideFlipper(t, b, f);
  }
  t.tiltMeter = Math.max(0, t.tiltMeter - STEP * 0.32);
  if (!b.live) return;
  // ball search: a ball resting anywhere above the flippers gets a kick, like a real machine's coils
  if (b.y < 470 && Math.hypot(b.vx, b.vy) < 15) t.still = (t.still || 0) + STEP; else t.still = 0;
  if (t.still > 2.5) { t.still = 0; b.vx += (t.rand() - 0.5) * 400; b.vy -= 250; t.events.push({ type: 'search' }); }
  const g = t.gate;
  if (!g.closed && b.y < 13 && Math.abs(b.x - g.x) < g.w / 2 - 3) { b.live = false; t.events.push({ type: 'up' }); }
  else if (b.y > H + 30) { b.live = false; t.events.push({ type: 'down', x: b.x }); }
  else if (b.y < -80 || b.x < -40 || b.x > W + 40 || !isFinite(b.x + b.y)) {
    // escaped through a crack: put it back somewhere sensible
    placeBall(t, 30, 380, 0, 0);
    t.events.push({ type: 'lost' });
  }
}

function moveFlipper(f, h, dead) {
  const target = f.held && !dead ? f.up : f.rest;
  const d = target - f.ang;
  const goingUp = Math.abs(target - f.up) < 1e-6;
  const max = goingUp ? 24 : 15;
  let w = d / h;  // would snap in one substep
  if (w > max) w = max; else if (w < -max) w = -max;
  f.w = w;
  f.ang += w * h;
}

function collideSeg(t, b, s) {
  const dx = s.bx - s.ax, dy = s.by - s.ay;
  const L2 = dx * dx + dy * dy || 1e-9;
  let u = ((b.x - s.ax) * dx + (b.y - s.ay) * dy) / L2;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  const cx = s.ax + dx * u, cy = s.ay + dy * u;
  let nx = b.x - cx, ny = b.y - cy;
  const d2 = nx * nx + ny * ny;
  if (d2 >= R * R) return;
  const d = Math.sqrt(d2) || 1e-6;
  nx /= d; ny /= d;
  if (d2 < 1e-12) { nx = -dy; ny = dx; const l = Math.hypot(nx, ny); nx /= l; ny /= l; }
  b.x = cx + nx * R; b.y = cy + ny * R;
  let kick = 0;
  const rvn = (b.vx - (s.svx || 0)) * nx + (b.vy - (s.svy || 0)) * ny;
  if (s.kind === 'sling' && rvn < -60) {
    kick = s.kick; s.lit = 0.15;
    t.events.push({ type: 'sling', x: cx, y: cy });
  }
  const hit = resolve(b, nx, ny, s.svx || 0, s.svy || 0, s.e, kick);
  if (s.kind === 'target' && hit > 70 && !s.tg.down) {
    s.tg.down = true; s.tg.lit = 0.4;
    t.events.push({ type: 'target', x: cx, y: cy });
    if (t.targets.every(g => g.down)) { t.gate.closed = false; t.events.push({ type: 'open' }); }
  } else if (hit > 120) t.events.push({ type: 'wall', x: cx, y: cy, v: hit });
}

function collideCircle(t, b, c) {
  let nx = b.x - c.x, ny = b.y - c.y;
  const rr = R + c.r, d2 = nx * nx + ny * ny;
  if (d2 >= rr * rr) return;
  const d = Math.sqrt(d2) || 1e-6;
  nx /= d; ny /= d;
  b.x = c.x + nx * rr; b.y = c.y + ny * rr;
  const svx = c.vx || 0, svy = c.vy || 0;
  const rvn = (b.vx - svx) * nx + (b.vy - svy) * ny;
  let kick = 0;
  if (c.kind === 'bumper' && rvn < 0) {
    kick = c.kick;
    if (c.lit <= 0.05) t.events.push({ type: 'bumper', x: c.x, y: c.y, c });
    c.lit = 0.18;
  }
  const hit = resolve(b, nx, ny, svx, svy, c.e, kick);
  if (c.kind !== 'bumper' && hit > 120) t.events.push({ type: c.kind === 'ghost' ? 'ghost' : 'wall', x: c.x, y: c.y, v: hit, c });
}

function collideFlipper(t, b, f) {
  const tx = f.px + Math.cos(f.ang) * f.len, ty = f.py + Math.sin(f.ang) * f.len;
  const dx = tx - f.px, dy = ty - f.py, L2 = f.len * f.len;
  let u = ((b.x - f.px) * dx + (b.y - f.py) * dy) / L2;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  const cx = f.px + dx * u, cy = f.py + dy * u;
  const rad = f.r1 + (f.r2 - f.r1) * u;
  let nx = b.x - cx, ny = b.y - cy;
  const rr = R + rad, d2 = nx * nx + ny * ny;
  if (d2 >= rr * rr) return;
  const d = Math.sqrt(d2) || 1e-6;
  nx /= d; ny /= d;
  b.x = cx + nx * rr; b.y = cy + ny * rr;
  // the surface moves with the flipper's spin
  const px = cx + nx * rad - f.px, py = cy + ny * rad - f.py;
  const svx = -f.w * py, svy = f.w * px;
  const moving = Math.abs(f.w) > 2;
  const hit = resolve(b, nx, ny, svx, svy, moving ? 0.4 : 0.28, 0, 0.0004);
  if (moving && hit > 200 && f.w * (f.side < 0 ? -1 : 1) > 0) t.events.push({ type: 'shot', v: hit, f });
}

// Collision response against a surface moving at (sx, sy). Returns the impact speed.
function resolve(b, nx, ny, sx, sy, e, kick, fr = 0.0008) {
  const rvx = b.vx - sx, rvy = b.vy - sy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0 && !kick) return 0;
  const tx = -ny, ty = nx;
  const vt = (rvx * tx + rvy * ty) * (1 - fr);
  let out = vn < 0 ? -vn * (vn > -35 ? 0 : e) : vn;
  if (kick) out = Math.max(out, 0) + kick;
  b.vx = sx + nx * out + tx * vt;
  b.vy = sy + ny * out + ty * vt;
  return vn < 0 ? -vn : 0;
}

// A shove of the whole cabinet. Returns true if it tilted.
export function nudge(t, dir = 0) {
  if (!t.ball.live) return false;
  t.ball.vx += dir * 90 + (t.ball.x < W / 2 ? 50 : -50) * (dir ? 0 : 1);
  t.ball.vy -= 150;
  t.tiltMeter += 1;
  if (t.tiltMeter > 2.6 && !t.tilted) { t.tilted = true; t.events.push({ type: 'tilt' }); return true; }
  t.events.push({ type: 'nudge', warn: t.tiltMeter > 1.6 });
  return false;
}
