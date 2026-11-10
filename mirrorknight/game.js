// Mirror Knight — the fight simulation. No DOM in here, so it runs in Node for balance sims.

export const ARENA_R = 300;
const TAU = Math.PI * 2;

export const WEAPONS = {
  sword: {
    id: 'sword', name: 'Straight Sword', accent: '#e4472b', blurb: 'Quick, honest, three-hit strings.',
    light: { kind: 'melee', wind: .15, act: .10, rec: .26, dmg: 10, reach: 62, arc: 110, step: 16, stam: 12, poise: 10 },
    heavy: { kind: 'melee', wind: .5, act: .12, rec: .42, dmg: 24, reach: 70, arc: 150, step: 26, stam: 26, poise: 30 },
    chain: 3, range: 58,
    special: { kind: 'whirl', wind: .6, act: .35, rec: .5, dmg: 18, reach: 78, arc: 360, step: 0, poise: 0 },
  },
  great: {
    id: 'great', name: 'Greatsword', accent: '#e9a23b', blurb: 'Slow. Wide. Hits like a cart.',
    light: { kind: 'melee', wind: .28, act: .14, rec: .4, dmg: 21, reach: 82, arc: 150, step: 18, stam: 20, poise: 22 },
    heavy: { kind: 'melee', wind: .85, act: .16, rec: .56, dmg: 40, reach: 92, arc: 200, step: 30, stam: 36, poise: 55 },
    chain: 2, range: 72,
    special: { kind: 'slam', wind: .95, act: .14, rec: .7, dmg: 30, reach: 92, radius: 78, step: 20, poise: 0 },
  },
  spear: {
    id: 'spear', name: 'Spear', accent: '#2fb3a5', blurb: 'Long reach, narrow point. Keep it at arm’s length.',
    light: { kind: 'melee', wind: .13, act: .10, rec: .24, dmg: 10, reach: 102, arc: 30, step: 12, stam: 10, poise: 8 },
    heavy: { kind: 'melee', wind: .42, act: .2, rec: .42, dmg: 25, reach: 108, arc: 32, step: 110, stam: 24, poise: 28 },
    chain: 3, range: 92,
    special: { kind: 'triple', wind: .55, act: .16, rec: .65, dmg: 11, reach: 104, arc: 34, step: 50, poise: 0 },
  },
  bow: {
    id: 'bow', name: 'Shortbow', accent: '#8cc63f', blurb: 'Arrows from afar. Weak when it’s close.',
    light: { kind: 'shot', wind: .22, act: .02, rec: .2, dmg: 6, speed: 640, stam: 9, poise: 6 },
    heavy: { kind: 'shot', wind: .75, act: .02, rec: .34, dmg: 20, speed: 940, pierce: true, stam: 22, poise: 25 },
    chain: 3, range: 200,
    special: { kind: 'volley', wind: .8, act: .02, rec: .6, dmg: 9, speed: 560, poise: 0 },
  },
  seal: {
    id: 'seal', name: 'Sacred Seal', accent: '#9b6cff', blurb: 'Seeking sparks, and a ring of light up close.',
    light: { kind: 'shot', wind: .3, act: .02, rec: .28, dmg: 13, speed: 380, homing: 2.4, stam: 13, poise: 8 },
    heavy: { kind: 'nova', wind: .75, act: .14, rec: .5, dmg: 30, reach: 108, arc: 360, stam: 34, poise: 40 },
    chain: 2, range: 190,
    special: { kind: 'pillars', wind: .7, act: .02, rec: .6, dmg: 22, radius: 46, poise: 0 },
  },
};
export const WEAPON_ORDER = ['sword', 'great', 'spear', 'bow', 'seal'];
// light bash for ranged weapons when the target is in your face
const BASH = { kind: 'melee', wind: .22, act: .1, rec: .32, dmg: 7, reach: 52, arc: 120, step: 10, stam: 10, poise: 14 };

export const PLAYER = { hp: 100, st: 100, flasks: 3, heal: 45, r: 15, speed: 150 };
export const KNIGHT = { hp: 350, r: 20, speed: 122, dmgMul: 1.5, poiseMax: 70 };
const DODGE = { t: .42, dist: 100, i0: .03, i1: .3, stam: 18 };

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const turnTo = (a, target, max) => { const d = angDiff(a, target); return a + Math.max(-max, Math.min(max, d)); };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function fighter(side, x, y, weapon) {
  return {
    side, x, y, r: side === 'p' ? PLAYER.r : KNIGHT.r, face: side === 'p' ? -Math.PI / 2 : Math.PI / 2,
    hp: 0, maxHp: 0, st: PLAYER.st, stWait: 0, flasks: 0, w: WEAPONS[weapon],
    state: 'idle', a: null, dodge: null, drink: null, stagT: 0, hurtT: 0, iframe: false,
    poise: 0, poiseT: 0, chain: 0, moving: 0, vx: 0, vy: 0,
  };
}

// ---------------------------------------------------------------- habits
export const HABIT_KEYS = ['dodge', 'string', 'rollAtk', 'heavy', 'drink', 'circle', 'range'];
export function emptyHabits() { return { dodge: null, string: null, rollAtk: false, heavy: false, drink: false, circle: null, range: null }; }
export function habitCount(h) { return HABIT_KEYS.filter(k => h[k]).length; }

const NUM = ['', 'once', 'twice', 'three times'];
export function habitText(k, v) {
  switch (k) {
    case 'dodge': return { left: 'you roll to your left', right: 'you roll to your right', back: 'you back away when pressed', forward: 'you roll into its blade' }[v];
    case 'string': return `you strike ${NUM[v]}, then stop`;
    case 'rollAtk': return 'you strike the moment you rise from a roll';
    case 'heavy': return 'you favour heavy blows';
    case 'drink': return 'you drink when you’re hurt';
    case 'circle': return v === 'cw' ? 'you circle it sunwise' : 'you circle it widdershins';
    case 'range': return v === 'far' ? 'you keep your distance' : 'you fight in close';
  }
  return '';
}
// what the knight does with each habit, for the weapon screen
export function habitUse(k, v) {
  switch (k) {
    case 'dodge': return `It rolls ${v === 'back' ? 'back' : v === 'forward' ? 'forward' : 'to its ' + v} too, and swings where you’ll land.`;
    case 'string': return `Its strings stop after ${v}. It strikes as yours ends.`;
    case 'rollAtk': return 'It attacks out of its rolls, and steps back from yours.';
    case 'heavy': return 'It swings heavy more, and rolls from your wind-ups.';
    case 'drink': return 'It carries two flasks, and charges when you drink.';
    case 'circle': return 'It circles the same way, and leads its lunges.';
    case 'range': return v === 'far' ? 'It closes the gap fast.' : 'It crowds you with quick cuts.';
  }
  return '';
}

export function learnHabits(old, tr, attemptT) {
  const h = { ...old };
  const learned = [], forgot = [];
  const set = (k, v) => {
    if (v && h[k] !== v) { learned.push([k, v]); if (h[k]) forgot.push([k, h[k]]); h[k] = v; }
    else if (!v && h[k]) { forgot.push([k, h[k]]); h[k] = v === false ? false : null; }
  };
  // dodge direction
  if (tr.dodges.length >= 4) {
    const c = { left: 0, right: 0, back: 0, forward: 0 };
    for (const d of tr.dodges) c[d]++;
    const sorted = Object.entries(c).sort((a, b) => b[1] - a[1]);
    const share = sorted[0][1] / tr.dodges.length, second = sorted[1][1] / tr.dodges.length;
    if (share >= .5 && share - second >= .15) set('dodge', sorted[0][0]);
    else if (share < .42) set('dodge', null);
  }
  // light string length
  if (tr.chains.length >= 3) {
    const c = [0, 0, 0, 0];
    for (const n of tr.chains) c[Math.min(3, n)]++;
    let best = 1; for (let i = 2; i <= 3; i++) if (c[i] > c[best]) best = i;
    const share = c[best] / tr.chains.length;
    if (share >= .55) set('string', best); else if (share < .45) set('string', null);
  }
  if (tr.rollN >= 4) {
    const s = tr.rollAtk / tr.rollN;
    if (s >= .45) set('rollAtk', true); else if (s < .25) set('rollAtk', false);
  }
  if (tr.attacks >= 6) {
    const s = tr.heavies / tr.attacks;
    if (s >= .34) set('heavy', true); else if (s < .15) set('heavy', false);
  }
  if (tr.drinks >= 2) set('drink', true); else if (tr.drinks === 0 && attemptT > 45) set('drink', false);
  const circ = tr.cw + tr.ccw;
  if (circ >= 700) {
    const bias = (tr.cw - tr.ccw) / circ;
    if (Math.abs(bias) >= .35) set('circle', bias > 0 ? 'cw' : 'ccw'); else if (Math.abs(bias) < .15) set('circle', null);
  }
  if (tr.distT >= 15) {
    const avg = tr.distSum / tr.distT;
    if (avg > 175) set('range', 'far'); else if (avg < 95) set('range', 'close'); else set('range', null);
  }
  return { habits: h, learned, forgot };
}

// ---------------------------------------------------------------- the game
export class Game {
  constructor(o = {}) {
    this.rand = mulberry(o.seed ?? (Math.random() * 1e9) | 0);
    this.tutorial = !!o.tutorial;
    this.habits = o.habits || emptyHabits();
    this.p = fighter('p', 0, 150, o.weapon || 'sword');
    this.p.hp = this.p.maxHp = PLAYER.hp; this.p.flasks = PLAYER.flasks;
    this.k = fighter('k', 0, -110, o.knightWeapon || 'sword');
    this.k.hp = this.k.maxHp = this.tutorial ? 9999 : KNIGHT.hp;
    this.k.flasks = this.habits.drink ? 2 : 0;
    this.k.dummy = this.tutorial;
    this.phase = 1;
    this.t = 0;
    this.shots = [];
    this.zones = [];          // delayed AoE (pillars, slam rings) for drawing + hits
    this.events = [];         // drained by the view every frame
    this.over = null;         // 'won' | 'lost'
    this.brain = { cd: 1.4, strafe: this.rand() < .5 ? 1 : -1, strafeT: 2, queue: [], reactCd: 0, afterDodge: false, backstep: 0, lastPChain: 0 };
    this.track = { dodges: [], chains: [], rollAtk: 0, rollN: 0, heavies: 0, attacks: 0, drinks: 0, cw: 0, ccw: 0, distSum: 0, distT: 0, pendingRoll: -1 };
    this.stats = { dmgDealt: 0, dmgTaken: 0, hitsLanded: 0, evades: 0, swings: 0 };
    this.input = { mx: 0, my: 0, light: 0, heavy: 0, dodge: 0, drink: 0 };
    this.tut = { lightHits: 0, heavyHits: 0, evades: 0, drank: 0, swingLive: null };
  }

  emit(type, o = {}) { this.events.push({ type, t: this.t, ...o }); }
  hs() { return this.phase === 1 ? .6 : this.phase === 2 ? .8 : 1; }

  // ------------------------------------------------------------ tick
  tick(dt) {
    if (this.over && this.overT > 3) return;
    this.t += dt;
    if (this.over) { this.overT += dt; }
    const { p, k } = this;
    if (!this.over || this.over === 'won') this.updatePlayer(dt);
    if (this.over !== 'won') { if (k.dummy) this.updateDummy(dt); else this.updateKnight(dt); }
    for (const f of [p, k]) this.updateFighter(f, dt);
    this.separate();
    this.updateShots(dt);
    this.updateZones(dt);
    this.trackHabits(dt);
    for (const key of ['light', 'heavy', 'dodge', 'drink']) if (this.input[key] > 0) this.input[key] = Math.max(0, this.input[key] - dt);
  }

  other(f) { return f === this.p ? this.k : this.p; }
  canAct(f) { return f.state === 'idle' || f.state === 'move'; }

  // ------------------------------------------------------------ player
  updatePlayer(dt) {
    const p = this.p, k = this.k, I = this.input;
    if (p.state === 'dead') return;
    const toK = Math.atan2(k.y - p.y, k.x - p.x);
    let mx = I.mx, my = I.my; const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    p.moving = ml > .15 ? 1 : 0;
    // buffered presses
    if (p.state === 'attack' && p.a) {
      const a = p.a, chainable = a.tag === 'light' && p.chain < p.w.chain && (a.ph === 'rec' || a.ph === 'act');
      if (I.light > 0 && chainable && (a.ph === 'rec' && a.t >= a.def.rec * .3)) { I.light = 0; this.startAttack(p, 'light'); return; }
      if (I.dodge > 0 && a.ph === 'rec' && a.t >= a.def.rec * .35) { I.dodge = 0; this.startDodge(p, mx, my); return; }
    }
    if (p.state === 'drink') { this.walk(p, mx, my, PLAYER.speed * .35, dt); p.face = turnTo(p.face, toK, 8 * dt); return; }
    if (!this.canAct(p)) return;
    if (I.dodge > 0 && p.st > 0) { I.dodge = 0; this.startDodge(p, mx, my); return; }
    if (I.heavy > 0 && p.st > 0) { I.heavy = 0; this.startAttack(p, 'heavy'); return; }
    if (I.light > 0 && p.st > 0) { I.light = 0; p.chain = 0; this.startAttack(p, 'light'); return; }
    if (I.drink > 0) { I.drink = 0; if (p.flasks > 0) this.startDrink(p); else this.emit('empty'); return; }
    this.walk(p, mx, my, PLAYER.speed, dt);
    p.face = turnTo(p.face, toK, 12 * dt);
    p.state = p.moving ? 'move' : 'idle';
  }

  walk(f, mx, my, speed, dt) {
    f.x += mx * speed * dt; f.y += my * speed * dt;
    f.vx = mx * speed; f.vy = my * speed;
  }

  startAttack(f, tag, def) {
    def = def || (tag === 'light' ? f.w.light : tag === 'heavy' ? f.w.heavy : tag === 'bash' ? BASH : f.w.special);
    if (f.side === 'p' && (f.w.id === 'bow' || f.w.id === 'seal') && tag === 'light') {
      const k = this.k; if (Math.hypot(k.x - f.x, k.y - f.y) < 58) { def = BASH; }
    }
    f.state = 'attack';
    f.a = { def, tag, ph: 'wind', t: 0, hit: new Set(), n: 0, stepped: 0 };
    if (tag === 'light') f.chain = (f.chain || 0) + 1; else f.chain = 0;
    if (f.side === 'p') {
      f.st -= def.stam || 10; f.stWait = .7;
      this.track.attacks++; if (tag === 'heavy') this.track.heavies++;
      if (tag === 'light') { if (f.chain === 1) this.track.chains.push(1); else this.track.chains[this.track.chains.length - 1]++; }
      if (this.track.pendingRoll >= 0 && this.t - this.track.pendingRoll < .5) { this.track.rollAtk++; }
      this.track.pendingRoll = -1;
      this.stats.swings++;
      this.onPlayerAttack(tag);
    }
    this.emit('wind', { who: f.side, tag, kind: def.kind });
  }

  startDodge(f, mx, my) {
    const o = this.other(f);
    let dx = mx, dy = my;
    if (Math.hypot(dx, dy) < .2) { dx = f.x - o.x; dy = f.y - o.y; }
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    f.state = 'dodge'; f.a = null; f.dodge = { dx, dy, t: 0 }; f.dodgeAt = this.t;
    if (f.side === 'p') {
      f.st -= DODGE.stam; f.stWait = .7;
      const ux = o.x - f.x, uy = o.y - f.y, ul = Math.hypot(ux, uy) || 1;
      const dot = (dx * ux + dy * uy) / ul, cr = (ux * dy - uy * dx) / ul;
      this.track.dodges.push(dot > .55 ? 'forward' : dot < -.55 ? 'back' : cr < 0 ? 'left' : 'right');
      this.track.rollN++;
      this.onPlayerDodge();
    }
    this.emit('dodge', { who: f.side });
  }

  startDrink(f) {
    f.state = 'drink'; f.drink = { t: 0, healed: false }; f.flasks--;
    if (f.side === 'p') { this.track.drinks++; this.onPlayerDrink(); }
    this.emit('drink', { who: f.side });
  }

  // ------------------------------------------------------------ shared fighter physics
  updateFighter(f, dt) {
    if (f.hurtT > 0) f.hurtT -= dt;
    if (f.side === 'p') {
      if (f.stWait > 0) f.stWait -= dt; else if (f.state !== 'dodge' && f.state !== 'attack') f.st = Math.min(PLAYER.st, f.st + (f.state === 'drink' ? 20 : 42) * dt);
    } else {
      f.poiseT -= dt; if (f.poiseT <= 0) f.poise = Math.max(0, f.poise - 40 * dt);
    }
    f.iframe = false;
    switch (f.state) {
      case 'dodge': {
        const d = f.dodge; d.t += dt;
        const u = d.t / DODGE.t, sp = DODGE.dist / DODGE.t * 1.6 * Math.max(0, 1 - u) ;
        f.x += d.dx * sp * dt; f.y += d.dy * sp * dt;
        f.iframe = d.t >= DODGE.i0 && d.t <= DODGE.i1;
        if (d.t >= DODGE.t) { f.state = 'idle'; f.dodge = null; this.onDodgeEnd(f); }
        break;
      }
      case 'drink': {
        const d = f.drink; d.t += dt;
        if (!d.healed && d.t >= .6) {
          d.healed = true;
          const amt = f.side === 'p' ? PLAYER.heal : f.maxHp * .1;
          f.hp = Math.min(f.maxHp, f.hp + amt); this.emit('heal', { who: f.side, x: f.x, y: f.y });
          if (f.side === 'p') this.tut.drank++;
        }
        if (d.t >= .95) { f.state = 'idle'; f.drink = null; }
        break;
      }
      case 'stagger': f.stagT -= dt; if (f.stagT <= 0) f.state = 'idle'; break;
      case 'rise': f.stagT -= dt; f.iframe = true; if (f.stagT <= 0) f.state = 'idle'; break;
      case 'attack': this.updateAttack(f, dt); break;
    }
    // arena wall
    const d = Math.hypot(f.x, f.y), lim = ARENA_R - f.r;
    if (d > lim) { f.x *= lim / d; f.y *= lim / d; }
  }

  aimTarget(f) {
    const o = this.other(f);
    if (f.side === 'p') return { x: o.x, y: o.y };
    // the knight: leads where it expects you to be
    let x = o.x, y = o.y; const H = this.habits, hs = this.hs();
    if (o.state === 'dodge' && H.dodge) {
      const ux = f.x - o.x, uy = f.y - o.y, ul = Math.hypot(ux, uy) || 1;
      const fx = ux / ul, fy = uy / ul; // player's forward (towards knight)
      const v = H.dodge === 'left' ? [fy, -fx] : H.dodge === 'right' ? [-fy, fx] : H.dodge === 'back' ? [-fx, -fy] : [fx, fy];
      const remain = Math.max(0, 1 - o.dodge.t / DODGE.t);
      x += v[0] * 70 * remain * hs; y += v[1] * 70 * remain * hs;
    } else if (H.circle && f.a && (f.a.tag === 'lunge' || f.a.def.kind === 'shot')) {
      const rx = o.x - f.x, ry = o.y - f.y, rl = Math.hypot(rx, ry) || 1, s = H.circle === 'cw' ? 1 : -1;
      x += -ry / rl * 40 * s * hs; y += rx / rl * 40 * s * hs;
    }
    return { x, y };
  }

  updateAttack(f, dt) {
    const a = f.a, def = a.def;
    a.t += dt;
    const tgt = this.aimTarget(f);
    const want = Math.atan2(tgt.y - f.y, tgt.x - f.x);
    if (a.ph === 'wind') {
      const rate = f.side === 'p' ? 10 : (a.tag === 'lunge' ? 5 : 3.6) * (this.phase === 3 ? 1.2 : 1);
      f.face = turnTo(f.face, want, rate * dt);
      const stepFrac = def.kind === 'melee' || def.kind === 'triple' ? .4 : 0;
      if (stepFrac && a.t > def.wind * (1 - stepFrac) && def.step) this.stepForward(f, def.step * .35 / (def.wind * stepFrac) * dt);
      if (a.t >= this.windOf(f, def)) { a.ph = 'act'; a.t = 0; this.onActStart(f, a); }
    } else if (a.ph === 'act') {
      if ((def.kind === 'melee' || def.kind === 'triple' || a.tag === 'lunge') && def.step) this.stepForward(f, def.step * .65 / def.act * dt);
      if (def.kind === 'whirl') f.face += TAU * 1.4 * dt;
      this.activeHits(f, a);
      if (a.t >= def.act) {
        if (def.kind === 'triple' && a.n < 2) { a.n++; a.ph = 'wind'; a.t = def.wind * .55; a.hit = new Set(); }
        else { a.ph = 'rec'; a.t = 0; }
      }
    } else {
      if (f.side === 'k' && a.t < def.rec * .3) f.face = turnTo(f.face, want, 1.2 * dt);
      if (a.t >= this.recOf(f, def)) { f.state = 'idle'; f.a = null; if (f.side === 'p') f.chain = 0; this.onAttackEnd(f, a); }
    }
  }
  windOf(f, def) {
    if (f.side === 'p') return def.wind;
    let w = Math.max(.3, def.wind * 1.15 + .06);          // the knight telegraphs a touch longer than you
    if (this.phase === 3) w *= .9;
    if (this.habits.range === 'close' && f.a?.tag === 'light') w *= .85;
    if (f.a?.tag === 'lunge') w = .55;
    return w;
  }
  recOf(f, def) {
    if (f.side === 'p') return def.rec;
    return def.rec * (this.phase === 3 ? .8 : 1) + (this.brain.queue.length ? 0 : .12);
  }

  stepForward(f, d) { f.x += Math.cos(f.face) * d; f.y += Math.sin(f.face) * d; }

  onActStart(f, a) {
    const def = a.def, o = this.other(f);
    const dmg = this.dmgOf(f, def);
    if (def.kind === 'shot') {
      const n = 1;
      for (let i = 0; i < n; i++) this.fire(f, f.face, def, dmg);
    } else if (def.kind === 'volley') {
      for (let i = -2; i <= 2; i++) this.fire(f, f.face + i * .16, def, dmg);
    } else if (def.kind === 'pillars') {
      const tgt = this.aimTarget(f);
      const vx = o.vx || 0, vy = o.vy || 0;
      for (let i = 0; i < 3; i++) {
        const lead = i * .45;
        const jx = (this.rand() - .5) * 40, jy = (this.rand() - .5) * 40;
        this.zones.push({ x: tgt.x + vx * lead + jx, y: tgt.y + vy * lead + jy, r: def.radius, t: -(.55 + i * .3), life: .25, dmg, owner: f.side, hit: false, accent: f.w.accent, kind: 'pillar' });
      }
    } else if (def.kind === 'slam') {
      const x = f.x + Math.cos(f.face) * def.reach * .8, y = f.y + Math.sin(f.face) * def.reach * .8;
      this.zones.push({ x, y, r: def.radius, t: 0, life: .2, dmg, owner: f.side, hit: false, accent: f.w.accent, kind: 'slam' });
      this.emit('slam', { x, y });
    }
    this.emit('act', { who: f.side, kind: def.kind, tag: a.tag, x: f.x, y: f.y, face: f.face, reach: def.reach, arc: def.arc });
  }

  dmgOf(f, def) {
    if (f.side === 'p') return def.dmg;
    const mul = def.homing ? .8 : def.kind === 'shot' || def.kind === 'volley' || def.kind === 'pillars' ? .95 : f.w.id === 'spear' ? 1.25 : KNIGHT.dmgMul;
    return def.dmg * mul * (this.phase === 1 ? 1 : this.phase === 2 ? 1.1 : 1.2);
  }

  fire(f, ang, def, dmg) {
    this.shots.push({ x: f.x + Math.cos(ang) * (f.r + 6), y: f.y + Math.sin(ang) * (f.r + 6), vx: Math.cos(ang) * def.speed, vy: Math.sin(ang) * def.speed,
      speed: def.speed, dmg, owner: f.side, life: 1.4, pierce: !!def.pierce, homing: (def.homing || 0) * (f.side === 'k' ? .4 : 1), poise: def.poise || 0, kind: f.w.id, accent: f.w.accent, hit: new Set(), heavy: !!def.pierce });
  }

  activeHits(f, a) {
    const def = a.def, o = this.other(f);
    if (def.kind === 'melee' || def.kind === 'whirl' || def.kind === 'nova' || def.kind === 'triple') {
      if (a.hit.has(o)) return;
      const dx = o.x - f.x, dy = o.y - f.y, d = Math.hypot(dx, dy);
      if (d > def.reach + o.r) return;
      if (def.arc < 360) {
        const off = Math.abs(angDiff(f.face, Math.atan2(dy, dx)));
        const half = def.arc / 2 * Math.PI / 180 + Math.atan2(o.r, Math.max(d, 1));
        if (off > half) return;
      }
      a.hit.add(o);
      this.hit(o, this.dmgOf(f, def), def.poise || 0, f, a.tag);
    }
  }

  hit(t, dmg, poise, from, tag) {
    if (t.state === 'dead') return;
    if (t.iframe) {
      if (t.side === 'p') { this.stats.evades++; if (from.a) from.a.evaded = true; }
      this.emit('evade', { who: t.side, x: t.x, y: t.y }); return;
    }
    if (t.side === 'k' && t.dummy) {
      this.emit('hit', { who: 'k', x: t.x, y: t.y, dmg, from: from.side, tag });
      if (tag === 'light') this.tut.lightHits++; else if (tag === 'heavy') this.tut.heavyHits++;
      t.hurtT = .15;
      return;
    }
    t.hp -= dmg; t.hurtT = .18;
    if (t.side === 'p') this.stats.dmgTaken += dmg; else { this.stats.dmgDealt += dmg; this.stats.hitsLanded++; }
    const ang = Math.atan2(t.y - from.y, t.x - from.x);
    this.emit('hit', { who: t.side, x: t.x, y: t.y, dmg, ang, from: from.side, tag, heavy: dmg >= 18 });
    if (t.hp <= 0) { t.hp = 0; this.die(t); return; }
    if (t.side === 'p') {
      if (dmg >= 6) { t.state = 'stagger'; t.stagT = .36; t.a = null; t.drink = null; t.dodge = null; t.x += Math.cos(ang) * 22; t.y += Math.sin(ang) * 22; t.chain = 0; }
    } else {
      t.poise += poise; t.poiseT = 2.5;
      if (t.state !== 'rise' && t.state !== 'stagger' && t.poise >= KNIGHT.poiseMax) {
        t.poise = 0; t.state = 'stagger'; t.stagT = 1.1; t.a = null; t.dodge = null; t.drink = null;
        this.brain.queue = []; this.emit('break', { x: t.x, y: t.y });
      }
      const frac = t.hp / t.maxHp;
      const want = frac <= 1 / 3 ? 3 : frac <= 2 / 3 ? 2 : 1;
      if (want > this.phase) {
        this.phase = want; t.state = 'rise'; t.stagT = 1.6; t.a = null; t.dodge = null; t.drink = null; t.poise = 0;
        this.brain.queue = []; this.brain.cd = .2;
        this.emit('phase', { phase: want, x: t.x, y: t.y });
        // shove the player back
        const p = this.p, dx = p.x - t.x, dy = p.y - t.y, dl = Math.hypot(dx, dy) || 1;
        if (dl < 130) { p.x += dx / dl * (130 - dl); p.y += dy / dl * (130 - dl); }
      }
    }
  }

  die(f) {
    f.state = 'dead'; f.a = null; f.dodge = null; f.drink = null;
    this.over = f.side === 'p' ? 'lost' : 'won'; this.overT = 0;
    this.emit(this.over, { x: f.x, y: f.y });
  }

  separate() {
    const { p, k } = this;
    const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy), min = p.r + k.r;
    if (d < min && d > 0.001) {
      const push = (min - d) / 2;
      p.x += dx / d * push; p.y += dy / d * push; k.x -= dx / d * push; k.y -= dy / d * push;
    }
  }

  updateShots(dt) {
    for (const s of this.shots) {
      s.life -= dt;
      const tgt = s.owner === 'p' ? this.k : this.p;
      if (s.homing) {
        const want = Math.atan2(tgt.y - s.y, tgt.x - s.x), cur = Math.atan2(s.vy, s.vx);
        const na = turnTo(cur, want, s.homing * dt);
        s.vx = Math.cos(na) * s.speed; s.vy = Math.sin(na) * s.speed;
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (Math.hypot(s.x, s.y) > ARENA_R + 10) s.life = 0;
      if (s.life > 0 && !s.hit.has(tgt) && tgt.state !== 'dead' && Math.hypot(tgt.x - s.x, tgt.y - s.y) < tgt.r + 5) {
        s.hit.add(tgt);
        const from = s.owner === 'p' ? this.p : this.k;
        const wasI = tgt.iframe;
        this.hit(tgt, s.dmg, s.poise, from, s.heavy ? 'heavy' : 'light');
        if (!s.pierce && !wasI) s.life = 0;
      }
    }
    this.shots = this.shots.filter(s => s.life > 0);
  }

  updateZones(dt) {
    for (const z of this.zones) {
      z.t += dt;
      if (z.t >= 0 && !z.hit && z.t < z.life) {
        if (z.t - dt < 0 || z.kind === 'slam') this.emit('zone', { x: z.x, y: z.y, kind: z.kind });
        const tgt = z.owner === 'p' ? this.k : this.p;
        if (Math.hypot(tgt.x - z.x, tgt.y - z.y) < z.r + tgt.r * .5) {
          z.hit = true;
          this.hit(tgt, z.dmg, 0, z.owner === 'p' ? this.p : this.k, 'special');
        }
      }
    }
    this.zones = this.zones.filter(z => z.t < z.life + .4);
  }

  trackHabits(dt) {
    const { p, k } = this, tr = this.track;
    if (this.tutorial || this.over || p.state === 'dead') return;
    const rx = p.x - k.x, ry = p.y - k.y, d = Math.hypot(rx, ry);
    if (p.state === 'idle' || p.state === 'move') { tr.distSum += d * dt; tr.distT += dt; }
    if (p.state === 'move' && d < 240) {
      const c = (rx * p.vy - ry * p.vx) / (d || 1) * dt;
      if (c > 0) tr.cw += c; else tr.ccw -= c;
    }
  }

  // ------------------------------------------------------------ the knight's mind
  onPlayerAttack(tag) {
    const k = this.k, p = this.p, B = this.brain, H = this.habits;
    if (k.dummy || this.over) return;
    const d = Math.hypot(k.x - p.x, k.y - p.y);
    // it knows how long your strings are: it answers the last swing
    if (tag === 'light' && H.string && p.chain === H.string && this.rand() < this.hs()) B.cd = Math.min(B.cd, 0.02), B.punish = true;
    if (!this.canAct(k) || B.reactCd > 0) return;
    let pr = .1 + .07 * this.phase;
    if (tag === 'heavy' && H.heavy) pr += .5 * this.hs();
    if (d < p.w.light.reach + 60 + (p.w.range > 150 ? 200 : 0) && this.rand() < pr) { this.knightDodge(); B.reactCd = 1.6; }
  }
  onPlayerDodge() {}
  onDodgeEnd(f) {
    const B = this.brain, H = this.habits;
    if (f.side === 'p') {
      this.track.pendingRoll = this.t;
      const k = this.k, d = Math.hypot(k.x - f.x, k.y - f.y);
      if (!k.dummy && H.rollAtk && d < 120 && this.canAct(k) && this.rand() < .65 * this.hs()) { this.knightDodge('back'); B.afterDodgeLunge = true; }
    } else if (f.side === 'k') {
      if (B.afterDodgeLunge) { B.afterDodgeLunge = false; B.queue = ['lunge']; B.cd = 0; }
      else if (H.rollAtk && this.rand() < .8 * this.hs()) { B.queue = ['light']; B.cd = 0; }
    }
  }
  onPlayerDrink() {
    const B = this.brain;
    if (this.habits.drink && !this.k.dummy && this.rand() < .9 * this.hs()) { B.cd = 0; B.queue = ['lunge']; }
  }
  onAttackEnd(f, a) {
    if (f.side !== 'k') return;
    if (f.dummy) {
      const p = this.p;
      if (!a.hit.has(p) || a.evaded) { if (a.evaded || this.t - (p.dodgeAt ?? -9) < 1.3) { this.tut.evades++; this.emit('tutEvade'); } }
      return;
    }
    const B = this.brain;
    if (B.queue.length) { B.cd = .0; } else {
      B.cd = (this.phase === 1 ? .95 : this.phase === 2 ? .75 : .55) + this.rand() * .55;
      if (this.habits.range === 'close') B.cd *= .8;
    }
  }

  knightDodge(dir) {
    const k = this.k, p = this.p;
    const fx = p.x - k.x, fy = p.y - k.y, fl = Math.hypot(fx, fy) || 1, ux = fx / fl, uy = fy / fl;
    dir = dir || (this.habits.dodge && this.rand() < .85 * this.hs() ? this.habits.dodge : this.rand() < .6 ? 'back' : this.rand() < .5 ? 'left' : 'right');
    const v = dir === 'left' ? [uy, -ux] : dir === 'right' ? [-uy, ux] : dir === 'forward' ? [ux, uy] : [-ux, -uy];
    // don't roll into the wall
    const nx = k.x + v[0] * 100, ny = k.y + v[1] * 100;
    if (Math.hypot(nx, ny) > ARENA_R - 30) { v[0] = -v[0] * .3 + uy; v[1] = -v[1] * .3 - ux; }
    this.startDodge(k, v[0], v[1]);
  }

  updateKnight(dt) {
    const k = this.k, p = this.p, B = this.brain, H = this.habits, hs = this.hs();
    if (k.state === 'dead') return;
    B.reactCd -= dt;
    const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy), toP = Math.atan2(dy, dx);
    if (p.state === 'dead') { if (this.canAct(k)) { k.face = turnTo(k.face, toP, 2 * dt); k.state = 'idle'; } return; }
    if (!this.canAct(k)) return;
    k.face = turnTo(k.face, toP, 6 * dt);
    const ranged = k.w.range > 150;
    // drinks, if it learned that from you
    if (k.flasks > 0 && k.hp < k.maxHp * .4 && d > 110 && this.rand() < dt * 1.2) { this.startDrink(k); return; }
    B.cd -= dt;
    // queued follow-ups go straight out
    if (B.cd <= 0 && B.queue.length) { const nx = B.queue.shift(); this.knightAct(nx, d); return; }
    // pick a plan
    const reach = ranged ? 0 : k.w.light.reach;
    if (B.cd <= 0) {
      const sp = (this.phase >= 2 ? .22 : 0) + (this.phase === 3 ? .1 : 0);
      if (!ranged) {
        if (d < reach + k.r + 14) {
          const r = this.rand();
          if (r < sp) return this.knightAct('special', d);
          const pHeavy = H.heavy ? .25 + .3 * hs : .22;
          if (r < sp + pHeavy) return this.knightAct('heavy', d);
          const n = H.string && this.rand() < hs + .2 ? H.string : 1 + Math.floor(this.rand() * k.w.chain);
          B.queue = Array(n - 1).fill('light');
          return this.knightAct('light', d);
        }
        const pl = H.range === 'far' ? .9 : .45 + .15 * this.phase;
        if (d < 250 && d > reach + 50 && this.rand() < pl * dt * 3) return this.knightAct('lunge', d);
      } else {
        if (d < 105) { return this.rand() < .5 ? this.knightAct('bash', d) : (this.knightDodge('back'), void (B.queue = ['light'])); }
        if (d < 330) {
          const r = this.rand();
          if (r < sp) return this.knightAct('special', d);
          if (r < sp + (H.heavy ? .45 : .22)) return this.knightAct('heavy', d);
          const n = H.string && this.rand() < hs + .2 ? H.string : 1 + Math.floor(this.rand() * k.w.chain);
          B.queue = Array(n - 1).fill('light');
          return this.knightAct('light', d);
        }
      }
    }
    // move: hold the preferred range, circle
    B.strafeT -= dt;
    if (H.circle) B.strafe = H.circle === 'cw' ? 1 : -1;
    else if (B.strafeT <= 0) { B.strafe = this.rand() < .5 ? 1 : -1; B.strafeT = 1.5 + this.rand() * 2.5; }
    let want = ranged ? (H.range === 'close' || p.w.range < 150 ? 140 : 200) : (H.range === 'close' ? reach * .6 : B.cd > .35 ? reach + 55 : reach * .8);
    const radial = clamp((d - want) / 40, -1, 1);
    const ux = dx / (d || 1), uy = dy / (d || 1);
    let mx = ux * radial + -uy * B.strafe * .55, my = uy * radial + ux * B.strafe * .55;
    // keep off the wall
    const wd = Math.hypot(k.x, k.y);
    if (wd > ARENA_R - 50) { mx -= k.x / wd * .8; my -= k.y / wd * .8; }
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    const sp = KNIGHT.speed * (this.phase === 3 ? 1.15 : 1) * (Math.abs(radial) > .5 ? 1 : .6);
    this.walk(k, mx, my, sp, dt);
    k.moving = ml > .1 ? 1 : 0;
    k.state = k.moving ? 'move' : 'idle';
  }

  knightAct(what, d) {
    const k = this.k, w = k.w;
    if (what === 'lunge') {
      const ranged = w.range > 150;
      if (ranged) return this.startAttack(k, 'heavy');
      const base = w.light;
      const def = { ...base, kind: 'melee', step: Math.min(200, Math.max(60, d - base.reach * .6)), wind: .55, act: .16, rec: base.rec + .15, dmg: base.dmg * 1.15 };
      return this.startAttack(k, 'lunge', def);
    }
    if (what === 'light' && w.range < 150 && d > w.light.reach + 60) { this.brain.queue = []; return this.knightAct('lunge', d); }
    if (what === 'bash') return this.startAttack(k, 'bash');
    this.startAttack(k, what);
  }

  // ------------------------------------------------------------ tutorial dummy
  updateDummy(dt) {
    const k = this.k, p = this.p;
    k.face = turnTo(k.face, Math.atan2(p.y - k.y, p.x - k.x), 3 * dt);
    if (this.dummySwing && this.canAct(k)) {
      this.swingT = (this.swingT ?? 1.2) - dt;
      if (this.swingT <= 0) {
        this.swingT = 2.3;
        this.startAttack(k, 'special', { kind: 'nova', wind: 1.0, act: .12, rec: .5, dmg: 4, reach: 74, arc: 360, poise: 0 });
        this.tut.swingLive = { hitBefore: this.stats.dmgTaken, dodged: false };
      }
    }
  }
}
