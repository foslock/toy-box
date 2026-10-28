// The fishing itself, with no drawing in it: the clock, what drifts in each puddle, the line and the reel.
// Puddle-local space: the puddle is (roughly) the unit circle, x right, y down.
import { CATCHES, BY_ID, SPOTS, HOUR_SECONDS } from './data.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(n) { let x = (n * 2654435761) >>> 0; x ^= x >>> 13; x = Math.imul(x, 1274126177) >>> 0; return (x ^ (x >>> 16)) >>> 0; }

// Weather by the hour: the first hour of every save is drizzle; after that it wanders but never sits still for long.
function weatherAt0(h) {
  let w = 0;
  for (let i = 1; i <= h; i++) { const r = hash(i + 101) % 100; if (r >= 45) w = (w + 1 + (r % 2)) % 3; }
  return w;
}
export function weatherFor(h) { return h <= 0 ? 0 : weatherAt0(h); }

export function newGame(save = {}, seed = Date.now()) {
  const g = {
    rand: rng(seed), time: 0, clock: save.clock ?? 0, spot: save.spot ?? 0, log: { ...(save.log || {}) },
    shadows: [], line: null, reel: null, events: [], spawnIn: 0, nextId: 1, tut: null, hold: false,
  };
  if (!unlocked(g, g.spot)) g.spot = 0;
  fillShadows(g, 2);
  return g;
}

export const hourOf = g => Math.floor(g.clock);
export const phaseOf = g => Math.floor((((g.clock % 8) + 8) % 8) / 2);
export const weatherOf = g => weatherFor(hourOf(g));
export const distinct = g => Object.keys(g.log).length;
export const unlocked = (g, i) => distinct(g) >= SPOTS[i].need;

export function eligible(g, spot = g.spot, phase = phaseOf(g), weather = weatherOf(g)) {
  const n = distinct(g);
  return CATCHES.filter(c => (!c.spots || c.spots.includes(spot)) && (!c.phases || c.phases.includes(phase)) &&
    (!c.weather || c.weather.includes(weather)) && (!c.gate || (n >= c.gate && !g.log[c.id])));
}

function pick(g, list) {
  let tot = 0;
  const w = list.map(c => { const v = c.rarity * (g.log[c.id] ? 1 : 1.25); tot += v; return v; });
  let r = g.rand() * tot;
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}

function randomPoint(g, rMax = 0.72) {
  const a = g.rand() * TAU, r = Math.sqrt(g.rand()) * rMax;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

function spawn(g, c, at) {
  const [x, y] = at || randomPoint(g, 0.7);
  const [tx, ty] = randomPoint(g);
  const s = { uid: g.nextId++, id: c.id, x, y, tx, ty, a: 0, state: 'wander', t: 0, rot: g.rand() * TAU, wob: g.rand() * TAU,
    speed: 0.06 + g.rand() * 0.06, notice: 0, shy: 1.5 + g.rand() * 4 };
  g.shadows.push(s);
  return s;
}

function fillShadows(g, n) {
  const list = eligible(g);
  if (!list.length) return;
  for (let i = 0; i < n && live(g).length < 3; i++) {
    // keep at most one of each thing in a puddle at a time
    const present = new Set(live(g).map(s => s.id));
    const opts = list.filter(c => !present.has(c.id));
    if (!opts.length) return;
    spawn(g, pick(g, opts));
  }
}
const live = g => g.shadows.filter(s => s.state !== 'leave' && s.state !== 'flee');

export function setSpot(g, i) {
  if (i === g.spot || !unlocked(g, i)) return false;
  g.spot = i; g.line = null; g.reel = null; g.shadows = []; g.spawnIn = 2;
  fillShadows(g, 2);
  return true;
}

export function waitHour(g) {
  if (g.reel) return;
  g.clock = Math.floor(g.clock) + 1;
  onHour(g);
}

function onHour(g) {
  const ok = new Set(eligible(g).map(c => c.id));
  for (const s of g.shadows) {
    if (ok.has(s.id) || s.state === 'leave' || s.state === 'flee') continue;
    if (g.line && g.line.target === s && g.line.state !== 'wait') continue; // it is busy with your line
    s.state = 'leave';
    if (g.line && g.line.target === s) g.line.target = null;
  }
  g.spawnIn = Math.min(g.spawnIn, 1.5);
  g.events.push({ type: 'hour' });
}

// ---------------------------------------------------------------- line
export function cast(g, x, y) {
  if (g.line || g.reel) return false;
  const r = Math.hypot(x, y);
  if (r > 0.86) { x *= 0.86 / r; y *= 0.86 / r; }
  g.line = { x, y, state: 'fly', t: 0, target: null, nibbles: 0, next: 0, twitch: 0, dip: 0 };
  g.events.push({ type: 'cast', x, y });
  return true;
}

// A tap or click while the line is out.
export function tap(g) {
  const L = g.line;
  if (!L || g.reel) return;
  if (L.state === 'bite') return hook(g);
  if (L.state === 'nibble') {
    flee(g, L.target); L.target = null; L.state = 'wait'; L.t = 0;
    g.events.push({ type: 'spook' });
    return;
  }
  if (L.state === 'wait' || L.state === 'fly') {
    if (L.target && L.target.state === 'approach') L.target.state = 'wander';
    g.line = null;
    g.events.push({ type: 'reelIn' });
  }
}

function flee(g, s) {
  if (!s) return;
  s.state = 'flee'; s.t = 0;
  const a = Math.atan2(s.y, s.x) || g.rand() * TAU;
  s.tx = Math.cos(a) * 1.4; s.ty = Math.sin(a) * 1.4;
}

function hook(g) {
  const L = g.line, s = L.target, c = BY_ID[s.id];
  s.state = 'hooked';
  g.reel = { id: s.id, s, T: 0.3, P: 0, slack: 0, t: 0, f: 0, burst: 0, burstIn: 1 + g.rand(), gustP: g.rand() * TAU, style: c.style, weight: c.weight, x0: s.x, y0: s.y };
  L.state = 'reel';
  g.events.push({ type: 'hooked', id: s.id });
}

// How hard each kind of catch pulls, 0..1, at reel time t.
function pull(g, R, dt) {
  const t = R.t;
  switch (R.style) {
    case 'burst': {
      R.burstIn -= dt;
      if (R.burstIn <= 0) { R.burst = 0.55; R.burstIn = 1.3 + g.rand() * 1.4; }
      R.burst = Math.max(0, R.burst - dt);
      return 0.28 + (R.burst > 0 ? 0.62 : 0) + 0.05 * Math.sin(t * 5);
    }
    case 'gust': { const s = Math.max(0, Math.sin(t * 0.9 + R.gustP + Math.sin(t * 0.37) * 1.5)); return 0.25 + 0.6 * s * s; }
    case 'float': return 0.2 + 0.12 * Math.sin(t * 1.7);
    case 'heavy': return 0.55 + 0.12 * Math.sin(t * 0.8);
    case 'dart': return 0.38 + 0.32 * Math.sin(t * 3.8 + Math.sin(t * 1.3));
    default: return 0.42 + 0.1 * Math.sin(t * 1.3);
  }
}

export const REEL = { up: 0.6, down: 0.9, speed: 0.26, slackAt: 0.12, slackMax: 2.4, slackFloat: 1.6, danger: 0.8 };

function tickReel(g, dt) {
  const R = g.reel, s = R.s, tut = g.tut;
  R.t += dt;
  const F = R.f = pull(g, R, dt);
  if (g.hold) {
    R.T += REEL.up * (0.3 + F) * dt;
    R.P += REEL.speed / R.weight * (0.45 + R.T) * (1 - 0.45 * F) * dt * (tut ? 1.4 : 1);
  } else {
    R.T -= REEL.down * (1.12 - F) * dt;
    R.P -= 0.05 * F * dt;
  }
  R.T = clamp(R.T, 0, tut ? 0.99 : 1.2);
  R.P = clamp(R.P, 0, 1);
  if (R.T < REEL.slackAt) R.slack += dt; else R.slack = Math.max(0, R.slack - dt * 2);
  // the hooked shadow is drawn in toward your feet (the bottom of the puddle) as you win
  const ex = 0, ey = 0.92;
  s.x = R.x0 + (ex - R.x0) * R.P + Math.sin(R.t * 7) * 0.04 * F;
  s.y = R.y0 + (ey - R.y0) * R.P + Math.cos(R.t * 5) * 0.03 * F;
  g.line.x = s.x; g.line.y = s.y;
  if (R.P >= 1) return land(g);
  if (R.T >= 1) return lose(g, 'snap');
  if (!tut && R.slack >= (R.style === 'float' ? REEL.slackFloat : REEL.slackMax)) return lose(g, 'slip');
}

function land(g) {
  const id = g.reel.id, isNew = !g.log[id];
  g.log[id] = (g.log[id] || 0) + 1;
  g.shadows = g.shadows.filter(s => s !== g.reel.s);
  g.reel = null; g.line = null; g.spawnIn = 5;
  g.events.push({ type: 'caught', id, isNew });
}

function lose(g, why) {
  const s = g.reel.s;
  flee(g, s);
  g.reel = null; g.line = null;
  g.events.push({ type: why });
}

// ---------------------------------------------------------------- the world ticking along
export function tick(g, dt, opts = {}) {
  g.time += dt;
  if (!opts.stopClock) {
    const h0 = hourOf(g);
    g.clock += dt / HOUR_SECONDS;
    if (hourOf(g) !== h0) onHour(g);
  }
  if (g.reel) tickReel(g, dt);
  tickLine(g, dt);
  tickShadows(g, dt);
  g.spawnIn -= dt;
  if (g.spawnIn <= 0) {
    g.spawnIn = 5 + g.rand() * 6;
    if (!g.tut) fillShadows(g, 1);
  }
}

function tickLine(g, dt) {
  const L = g.line;
  if (!L || L.state === 'reel') return;
  L.t += dt;
  L.twitch = Math.max(0, L.twitch - dt * 3);
  L.dip = Math.max(0, L.dip - dt * 1.5);
  if (L.state === 'fly') {
    if (L.t >= 0.42) { L.state = 'wait'; L.t = 0; g.events.push({ type: 'plop', x: L.x, y: L.y }); }
    return;
  }
  if (L.state === 'wait') {
    if (L.target && !g.shadows.includes(L.target)) L.target = null;
    if (!L.target) {
      // the nearest shadow that has noticed the bobber comes over for a look
      let best = null, bd = 9;
      for (const s of g.shadows) {
        if (s.state !== 'wander') continue;
        const d = Math.hypot(s.x - L.x, s.y - L.y);
        const reach = g.tut ? 3 : 0.55;
        if (d < reach) s.notice += dt * (g.tut ? 2 : 1.6 - d); else if (d < 1.1) s.notice += dt * 0.12;
        if (s.notice > (g.tut ? 1 : s.shy) && d < bd) { bd = d; best = s; }
      }
      if (best) { L.target = best; best.state = 'approach'; }
    }
    return;
  }
  if (L.state === 'nibble') {
    L.next -= dt;
    if (L.next <= 0) {
      if (L.nibbles > 0) { L.nibbles--; L.twitch = 1; L.next = 0.6 + g.rand() * 0.8; g.events.push({ type: 'nibble' }); }
      else { L.state = 'bite'; L.t = 0; L.dip = 1; g.events.push({ type: 'bite' }); }
    }
    return;
  }
  if (L.state === 'bite') {
    const win = g.tut ? 3 : 0.9;
    if (L.t > win) {
      flee(g, L.target); L.target = null; L.state = 'wait'; L.t = 0;
      g.events.push({ type: 'miss' });
    }
  }
}

function tickShadows(g, dt) {
  const L = g.line;
  for (const s of g.shadows) {
    s.t += dt; s.wob += dt;
    if (s.state === 'hooked') { s.a = 1; continue; }
    if (s.state === 'leave') { s.a -= dt * 0.6; }
    else if (s.state === 'flee') { s.a -= dt * 1.4; }
    else s.a = Math.min(1, s.a + dt * 0.5);
    let tx = s.tx, ty = s.ty, sp = s.speed;
    if (s.state === 'approach' && L) {
      tx = L.x; ty = L.y - 0.02; sp = 0.22;
      if (Math.hypot(s.x - tx, s.y - ty) < 0.07) {
        s.state = 'nibble';
        L.state = 'nibble'; L.nibbles = g.tut ? 1 : 1 + Math.floor(g.rand() * 3); L.next = 0.5 + g.rand() * 0.5;
      }
    } else if (s.state === 'nibble' || (L && L.target === s && L.state === 'bite')) {
      tx = L.x; ty = L.y - 0.02; sp = 0.1;
    } else if (s.state === 'flee') sp = 0.7;
    const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
    if (d > 0.001) {
      const v = Math.min(d, sp * dt * (s.state === 'wander' ? clamp(d * 3, 0.3, 1) : 1));
      s.x += dx / d * v; s.y += dy / d * v;
      const want = Math.atan2(dy, dx);
      let da = ((want - s.rot + Math.PI * 3) % TAU) - Math.PI;
      s.rot += da * Math.min(1, dt * 2);
    }
    if (s.state === 'wander' && d < 0.05) { [s.tx, s.ty] = randomPoint(g); s.speed = 0.05 + g.rand() * 0.07; }
  }
  g.shadows = g.shadows.filter(s => s.a > 0 || s.state === 'wander' || s.state === 'approach' || s.state === 'nibble' || s.state === 'hooked');
  if (L && L.target && !g.shadows.includes(L.target)) { L.target = null; if (L.state !== 'fly') L.state = 'wait'; }
}

// The tutorial puts one coat button close to the middle of the first puddle and nothing else.
export function startTutorial(g) {
  g.tut = { on: true };
  g.line = null; g.reel = null; g.shadows = [];
  const s = spawn(g, BY_ID.button, [0.15, -0.1]);
  s.a = 1; s.tx = 0.2; s.ty = -0.05; s.speed = 0.02;
  return s;
}
export function endTutorial(g) { g.tut = null; g.spawnIn = 1; fillShadows(g, 2); }

export function saveData(g) { return { clock: g.clock, spot: g.spot, log: g.log }; }
