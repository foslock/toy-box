// Jolly Cooperator — the rules. No DOM here, so sim.mjs can run whole acts in Node.
// The stage is a strip: x runs left→right along the play, y is depth (0 = front edge of the screen, D = back).

export const D = 120;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sgn = (v) => (v < 0 ? -1 : 1);
export function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ------------------------------------------------------------------ hosts
export const HOSTS = {
  wendel: {
    key: 'wendel', name: 'Ser Wendel', epithet: 'the Careful', dye: '#2b7d71', dyeDark: '#123a34',
    hp: 130, dmg: 13, reach: 46, speed: 76, wind: 0.3, rec: 0.42, combo: 1,
    healThr: 0.62, healCare: 0.12, dodge: 0.55, rollRandom: 0.5, greed: 0.08, lootLust: 0.3, flee: 0.36, pose: 0,
    gullible: 0.95, heed: 1.15, waitHeed: 1, beckonHeed: 1, weapon: 'sword', shield: true, build: 'man',
    blurb: 'Brave in theory. Drinks his flask the moment anything frowns at him, and rolls wherever the panic points.',
  },
  gorm: {
    key: 'gorm', name: 'Gorm', epithet: 'Who Does Not Wait', dye: '#9b2b1d', dyeDark: '#45120b',
    hp: 160, dmg: 19, reach: 54, speed: 90, wind: 0.5, rec: 0.55, combo: 3,
    healThr: 0.2, healCare: 0.6, dodge: 0.1, rollRandom: 0.2, greed: 0.88, lootLust: 0.12, flee: 0, pose: 0,
    gullible: 0, heed: 0.85, waitHeed: 0.6, beckonHeed: 0.9, weapon: 'axe', build: 'brute', charges: true,
    blurb: 'Hits like a falling church. Will keep hitting while the falling church hits him back.',
  },
  plume: {
    key: 'plume', name: 'Dame Plume', epithet: 'in the Good Hat', dye: '#5d3d91', dyeDark: '#25163d',
    hp: 120, dmg: 15, reach: 52, speed: 88, wind: 0.24, rec: 0.34, combo: 2,
    healThr: 0.45, healCare: 0.45, dodge: 0.42, rollRandom: 0.25, greed: 0.35, lootLust: 0.95, flee: 0, pose: 0.75,
    gullible: 0.45, heed: 1, waitHeed: 1, beckonHeed: 0.55, weapon: 'rapier', build: 'lady',
    blurb: 'Here for the hats. Will cross a dungeon, a pit and a dragon for anything that sparkles.',
  },
};
export const HOST_ORDER = ['wendel', 'gorm', 'plume'];

// what each host says. {n} is never used for numbers; keep lines short, they sit in a paper bubble.
export const LINES = {
  wendel: {
    hello: ['A summoning sign worked! Oh, thank goodness.', 'You came! I mean — of course you came. Hello.'],
    read: ['"{m}." Well, it says so right there.', 'Someone wrote "{m}". Kind of them.'],
    readRoll: ['"{m}"? If they insist!'],
    heal: ['Just a sip. Just to be safe.', 'Flask! Flask flask flask.', 'I felt a draught. Drinking.'],
    spill: ['I spilled it!', 'Not the flask!'],
    low: ['I am not built for this.', 'Retreating! Tactically!'],
    flee: ['Back! Everyone back! Mostly me!'],
    downed: ['Tell my horse... something nice...', 'Is it dark? It is dark.'],
    revived: ['I saw a light. It was you. Thank you.', 'Up! I am up. Never again.'],
    hang: ['HELP. Ledge. HELP.', 'The floor has left me!'],
    rescued: ['I will never trust a floor again.', 'Thank you. I owe you a cheese.'],
    heed: { point: ['That one? Right!', 'On it!'], beckon: ['Coming!', 'Right behind you.'], wait: ['Holding! Shield up!', 'Waiting. Nervously.'] },
    ignore: ['Er — later?', 'Sorry, what?', 'I am very busy panicking.'],
    bow: ['Oh! A bow! *bows back*', 'How civil. *bows*'],
    spin: ['Ha! Yes! *spins too*', 'We did that!'],
    spinNo: ['Is that... a dance? Now?'],
    loot: ['Ooh, something shiny.'],
    lootGot: ['A spare flask! Marvellous.', 'Look what I found!'],
    ambush: ['It was a trap. Of course it was.'],
    kill: ['Got one! Did you see?', 'Ha! Take that, probably!'],
    saved: ['You saved me!', 'That was close. Thank you!'],
    lonely: ['Spirit? Are you coming?'],
    boss: ['That is a big one. Is it? It is.', 'I would like to go home now.'],
    bossDown: ['We did it! Did we? We DID!', 'I shall write a song. A short one.'],
    act: ['Onward. Carefully.'],
    trustUp: ['I trust you, spirit.'],
    farewell: ['"Thank you, kind spirit. I could not have gone a step further alone. Truly. I tried."'],
    lost: ['"Sorry about the floor. And the flask. And the rest. — W."'],
  },
  gorm: {
    hello: ['A ghost? Fine. Keep up.', 'You. Follow. Hit things.'],
    read: ['Words are for the slow.', 'GORM DOES NOT READ.'],
    readRoll: ['Words are for the slow.'],
    heal: ['Fine. One drink.', '*glug*'],
    spill: ['Who hit my drink?!'],
    low: ['Only a scratch. Several scratches.'],
    flee: ['GORM DOES NOT RUN.'],
    downed: ['Tell them... Gorm did not wait...', 'Huh. Floor.'],
    revived: ['Again! AGAIN!', 'Gorm lives. You may cheer.'],
    hang: ['The ground is cheating!'],
    rescued: ['Gorm meant to do that.'],
    heed: { point: ['THAT ONE. GOOD.', 'Yes!'], beckon: ['Fine. Coming.', 'What? Fine.'], wait: ['...Waiting. Hate it.', 'Gorm stands. Grr.'] },
    ignore: ['No.', 'Busy hitting.', 'GORM DOES NOT WAIT.'],
    bow: ['*nods*', 'Hm. Polite ghost.'],
    spin: ['HAH! SPIN!', 'Again! Do it again!'],
    spinNo: ['Why are you spinning.'],
    loot: ['Shiny. Mine.'],
    lootGot: ['Mine now.'],
    ambush: ['MORE TO HIT!'],
    kill: ['NEXT!', 'Too easy!', 'Crunch.'],
    saved: ['Gorm had that. But fine.'],
    lonely: ['Ghost! Hurry!'],
    boss: ['BIG ONE. GOOD.', 'Finally.'],
    bossDown: ['GORM WINS. And ghost.', 'HAH!'],
    act: ['More!'],
    trustUp: ['You are a good ghost.'],
    farewell: ['"GOOD GHOST. Come back. We hit more things." — G.'],
    lost: ['"Gorm will wait next time. Maybe." — G.'],
  },
  plume: {
    hello: ['Darling! You came! Do you like the hat?', 'A spirit escort. How chic.'],
    read: ['"{m}"? Ooh, intrigue.', 'A note! "{m}". Noted, darling.'],
    readRoll: ['"{m}"? A little twirl, then!'],
    heal: ['A little refreshment.', 'Hydration is couture.'],
    spill: ['My drink! My SLEEVE!'],
    low: ['This is ruining my look.'],
    flee: ['Not the face!'],
    downed: ['Tell them... I looked fabulous...', 'Oh, how dramatic of me.'],
    revived: ['I knew you\'d come. Hat still on? Good.', 'Darling, you\'re a treasure.'],
    hang: ['Help! The hat! Save the hat! And me!'],
    rescued: ['Not a feather out of place. Thank you.'],
    heed: { point: ['That one? With pleasure.', 'Consider it skewered.'], beckon: ['Coming, darling.', 'If I must.'], wait: ['Posing. I mean waiting.', 'Holding, darling.'] },
    ignore: ['In a moment, darling.', 'Shh, I\'m shopping.', 'Later!'],
    bow: ['A bow! Divine. *curtsies*', 'Such manners! *curtsies*'],
    spin: ['Twirl! *twirls*', 'Bravo! Encore!'],
    spinNo: ['Lovely spin. Wrong time.'],
    loot: ['Is that... is that a HAT?', 'Something sparkles!'],
    lootGot: ['A new hat! A NEW HAT!', 'Mine. Gorgeous.'],
    ambush: ['How rude! I was shopping!'],
    kill: ['Touché!', 'And THAT is how it\'s done.'],
    saved: ['My hero! My spooky hero!'],
    lonely: ['Darling? Keep up!'],
    boss: ['Ugh. It\'s not even dressed for the occasion.', 'Hold my hat.'],
    bossDown: ['Bravo! Bravo us!', 'Fabulous. Utterly.'],
    act: ['Onward, darling.'],
    trustUp: ['I adore you, spirit.'],
    farewell: ['"To my spooky darling: the hats are yours, in spirit. Kisses. — P."'],
    lost: ['"The hat survived. I did not. Worth it? Discuss. — P."'],
  },
};

// ------------------------------------------------------------------ foes
export const FOES = {
  husk:   { hp: 46, speed: 44, reach: 40, depth: 13, dmg: 12, wind: 0.6, rec: 0.55, cd: [1.4, 2.6], r: 12, poise: 0 },
  pike:   { hp: 66, speed: 34, reach: 80, depth: 11, dmg: 17, wind: 0.85, rec: 0.6, cd: [1.9, 3.0], r: 12, poise: 1 },
  archer: { hp: 32, speed: 42, reach: 0, depth: 12, dmg: 10, wind: 0.8, rec: 0.5, cd: [2.4, 3.4], r: 11, poise: 0, ranged: true },
  dummy:  { hp: 1e9, speed: 0, reach: 0, depth: 0, dmg: 0, wind: 9, rec: 0, cd: [99, 99], r: 13, poise: 9 },
  prop:   { hp: 1e9, speed: 0, reach: 52, depth: 30, dmg: 4, wind: 0.9, rec: 0.7, cd: [1.1, 1.1], r: 13, poise: 9 },
};
export const BOSSES = {
  bell:  { name: 'The Bell-Warden', title: 'who rings for the drowned', hp: 900, r: 30, speed: 30, scale: 1.85 },
  hound: { name: 'The Briar Hound', title: 'who was a good dog, once', hp: 920, r: 34, speed: 78, scale: 1.7 },
  king:  { name: 'The Cinder King', title: 'last of the paper kings', hp: 1050, r: 26, speed: 34, scale: 2.0 },
};

// ------------------------------------------------------------------ acts
const W = (at, x0, foes) => ({ at, x0, x1: x0 + 520, foes });
export const ACTS = [
  {
    name: 'The Drowned Chapel', theme: 0, len: 2900, foe: 'monk',
    pits: [{ x0: 990, x1: 1090, y0: 0, y1: 80 }],
    msgs: [{ x: 240, y: 112, text: 'Be wary of the bell' }, { x: 935, y: 112, text: 'Try rolling', eff: 'roll' }, { x: 1830, y: 112, text: 'Treasure ahead', eff: 'treasure' }],
    loot: [{ x: 1180, y: 104, kind: 'flask' }, { x: 2000, y: 22, kind: 'hat', ambush: [['husk', 'L', 0], ['husk', 'R', 0.3], ['pike', 'R', 1.6]] }],
    waves: [
      W(430, 270, [['husk', 'R', 0], ['husk', 'R', 1.4], ['husk', 'L', 3]]),
      W(1360, 1200, [['husk', 'R', 0], ['pike', 'R', 0.8], ['husk', 'L', 3.2], ['husk', 'R', 4.6]]),
    ],
    boss: { key: 'bell', x0: 2380 },
  },
  {
    name: 'The Thornwood', theme: 1, len: 3200, foe: 'thorn',
    pits: [{ x0: 700, x1: 800, y0: 48, y1: 120 }, { x0: 1660, x1: 1770, y0: 0, y1: 74 }],
    msgs: [{ x: 300, y: 112, text: 'Mind the arrows' }, { x: 1600, y: 112, text: 'Roll, then gold', eff: 'roll' }, { x: 2480, y: 112, text: 'Good dog ahead?' }],
    loot: [{ x: 1000, y: 10, kind: 'gem', ambush: [['archer', 'L', 0], ['husk', 'R', 0.4]] }, { x: 1830, y: 100, kind: 'flask' }],
    waves: [
      W(420, 250, [['husk', 'R', 0], ['archer', 'R', 0.5], ['husk', 'L', 2.2]]),
      W(1260, 1100, [['pike', 'R', 0], ['archer', 'R', 0.4], ['husk', 'L', 1.6], ['husk', 'R', 3.2], ['archer', 'L', 4.4]]),
      W(2030, 1880, [['husk', 'R', 0], ['husk', 'L', 0.6], ['pike', 'R', 2], ['archer', 'R', 2.6], ['husk', 'L', 4.2]]),
    ],
    boss: { key: 'hound', x0: 2660 },
  },
  {
    name: 'The Ash Keep', theme: 2, len: 3300, foe: 'ash',
    pits: [{ x0: 610, x1: 700, y0: 0, y1: 62 }, { x0: 1500, x1: 1600, y0: 56, y1: 120 }, { x0: 2160, x1: 2240, y0: 0, y1: 76 }],
    msgs: [{ x: 540, y: 112, text: 'Fine floor here' }, { x: 2100, y: 112, text: 'Try rolling', eff: 'roll' }, { x: 2620, y: 112, text: 'Be wary of fire' }],
    loot: [{ x: 1320, y: 106, kind: 'flask' }, { x: 2420, y: 20, kind: 'hat', ambush: [['pike', 'L', 0], ['husk', 'R', 0.3], ['archer', 'R', 1.2]] }],
    waves: [
      W(400, 240, [['husk', 'R', 0], ['husk', 'L', 0.8], ['archer', 'R', 1.8]]),
      W(1120, 960, [['pike', 'R', 0], ['pike', 'L', 1], ['husk', 'R', 2.2], ['archer', 'R', 3.2]]),
      W(1880, 1720, [['husk', 'R', 0], ['husk', 'L', 0.4], ['archer', 'R', 1.4], ['archer', 'L', 2.6], ['pike', 'R', 3.6]]),
    ],
    boss: { key: 'king', x0: 2760 },
  },
];
export const REHEARSAL = {
  name: 'Rehearsal', theme: 3, len: 900, foe: 'prop',
  pits: [], msgs: [], loot: [], waves: [], boss: null,
};

export const GESTURES = ['point', 'beckon', 'wait', 'bow', 'spin'];
export const GESTURE_INFO = {
  point: { name: 'Point', what: 'Strike that one' },
  beckon: { name: 'Beckon', what: 'Come to me' },
  wait: { name: 'Wait', what: 'Stop. Shield up.' },
  bow: { name: 'Bow', what: 'Polite. They like it.' },
  spin: { name: 'Spin', what: 'Draws every foe\'s eye' },
};

// ------------------------------------------------------------------ the game
export class Game {
  constructor(opts = {}) {
    this.seed = opts.seed ?? 1;
    this.rnd = rng(this.seed);
    this.rehearsal = !!opts.rehearsal;
    this.hostKey = opts.host || 'wendel';
    this.def = HOSTS[this.hostKey];
    this.input = { mx: 0, my: 0, atk: false, atkHeld: false, roll: false, gesture: null };
    this.events = [];
    this.fx = [];
    this.t = 0;
    this.uid = 0;
    this.stats = { kills: 0, revives: 0, rescues: 0, heeded: 0, ignored: 0, gestures: 0, acts: 0, saves: 0 };
    this.p = this.body('player', 80, 50, { r: 12, hp: 120, max: 120, st: 100, combo: 0, buf: { atk: 0, roll: 0 }, raise: 0, lastSafe: { x: 80, y: 50 }, regenT: 0, stT: 0 });
    const d = this.def;
    this.h = this.body('host', 40, 74, { r: 13, hp: d.hp, max: d.hp, flasks: 3, trust: 35, downs: 0, order: null, think: 0, hats: 0, atkCd: 0, decided: new Set(), lootSeen: new Set(), treasure: 0, lastSay: -9, sayCd: 0, bowCd: 0, spinCd: 0, waitT: 0 });
    this.lastKill = -99;
    this.slow = 0;
    this.startAct(opts.act ?? 0);
  }

  body(kind, x, y, extra) {
    return Object.assign({ id: ++this.uid, kind, x, y, face: 1, hp: 1, max: 1, state: 'idle', t: 0, iframe: 0, flash: 0, walk: 0, kb: 0, kby: 0, dead: false, drop: 0, hurtT: 0, mv: 0 }, extra);
  }
  ev(t, o = {}) { this.events.push(Object.assign({ t }, o)); }

  startAct(i) {
    this.act = i;
    const L = this.rehearsal ? REHEARSAL : ACTS[i];
    this.L = L;
    this.len = L.len;
    this.pits = L.pits.map((p) => ({ ...p, on: true }));
    this.msgs = L.msgs.map((m) => ({ ...m, read: false }));
    this.loot = L.loot.map((l, k) => ({ ...l, id: k, taken: false, glint: this.rnd() * 6 }));
    this.waves = L.waves.map((w) => ({ ...w, state: 'idle', q: [] }));
    this.bossDef = L.boss ? { ...L.boss, x1: L.boss.x0 + 520, state: 'idle' } : null;
    this.foes = [];
    this.shots = [];
    this.lock = null;
    this.boss = null;
    this.phase = 'play';
    this.endT = 0;
    this.reason = '';
    this.actT = 0;
    const p = this.p, h = this.h;
    Object.assign(p, { x: 90, y: 46, face: 1, hp: p.max, st: 100, state: 'idle', t: 0, iframe: 0, kb: 0, kby: 0, raise: 0, dead: false });
    p.lastSafe = { x: p.x, y: p.y };
    Object.assign(h, { x: 46, y: 76, face: 1, hp: h.max, flasks: Math.max(h.flasks, 3), state: 'idle', t: 0, order: null, kb: 0, kby: 0, dead: false, iframe: 0, downs: 0, atkCd: 0 });
    h.decided.clear();
    h.present = !this.rehearsal;
    if (!this.rehearsal) this.say(i === 0 ? 'hello' : 'act', 3, true);
  }

  // ---------------------------------------------------------------- helpers
  get bounds() {
    if (this.lock) return [this.lock.x0 + 8, this.lock.x1 - 8];
    return [12, this.len - 12];
  }
  inPit(x, y, m = 0) {
    for (const p of this.pits) if (p.on && x > p.x0 - m && x < p.x1 + m && y > p.y0 - m && y < p.y1 + m) return p;
    return null;
  }
  alive(e) { return e && !e.dead && e.state !== 'downed' && e.state !== 'hanging' && e.state !== 'fallen'; }
  hostUp() { const h = this.h; return h.present && this.alive(h); }
  say(key, pri = 1, force = false, sub) {
    const h = this.h;
    if (!h.present) return;
    if (!force && this.t - h.lastSay < (pri >= 2 ? 1.2 : 3.2)) return;
    let set = LINES[this.hostKey][key];
    if (sub && set && !Array.isArray(set)) set = set[sub];
    if (!set || !set.length) return;
    let line = set[Math.floor(this.rnd() * set.length)];
    if (this._m) line = line.replace('{m}', this._m);
    h.lastSay = this.t;
    this.ev('say', { text: line, key });
  }
  trust(d, why) {
    const h = this.h, before = h.trust;
    h.trust = clamp(h.trust + d, 0, 100);
    if (Math.floor(before / 20) < Math.floor(h.trust / 20) && h.trust >= 60) this.say('trustUp', 1);
    this.ev('trust', { d, why });
  }
  heedChance(name) {
    const h = this.h, d = this.def;
    if (this.rehearsal) return 1;
    let p = (0.32 + 0.6 * h.trust / 100) * d.heed;
    if (name === 'wait') p *= d.waitHeed;
    if (name === 'beckon') p *= h.state === 'loot' || h.goal === 'loot' ? d.beckonHeed : 1;
    return clamp(p, 0.08, 0.97);
  }

  // movement with optional pit avoidance (knockback and rolls don't avoid)
  move(e, dx, dy, avoid) {
    const [b0, b1] = this.bounds;
    let nx = e.x + dx, ny = clamp(e.y + dy, 0, D);
    if (e.kind === 'player' || e.kind === 'host') nx = clamp(nx, b0, b1);
    else {
      nx = clamp(nx, 6, this.len - 6);
      // once inside a locked arena a foe stays in it, so a knockback can't park it where the Shade can't follow
      const L = this.lock;
      if (L && e.x >= L.x0 + 6 && e.x <= L.x1 - 6) nx = clamp(nx, L.x0 + 6, L.x1 - 6);
    }
    // already standing in the margin (knocked or pulled there)? then only the pit itself is off limits
    const m = this.inPit(e.x, e.y, 7) ? 0.5 : 7;
    if (avoid && this.inPit(nx, ny, m)) {
      if (!this.inPit(nx, e.y, m)) ny = e.y;
      else if (!this.inPit(e.x, ny, m)) nx = e.x;
      else { nx = e.x; ny = e.y; }
    }
    e.walk += Math.abs(nx - e.x) + Math.abs(ny - e.y) * 0.6;
    e.mv = Math.hypot(nx - e.x, ny - e.y);
    e.x = nx; e.y = ny;
  }
  // a waypoint that goes round any pit between e and (tx, ty)
  route(e, tx, ty) {
    for (const p of this.pits) {
      if (!p.on) continue;
      const m = 18;
      const lo = Math.min(e.x, tx), hi = Math.max(e.x, tx);
      if (hi < p.x0 - m || lo > p.x1 + m) continue;
      // does the segment pass through the pit's depth band while inside its x span?
      const yAt = (x) => (tx === e.x ? ty : e.y + (ty - e.y) * (x - e.x) / (tx - e.x));
      const ya = yAt(clamp(p.x0 - m, lo, hi)), yb = yAt(clamp(p.x1 + m, lo, hi));
      const ymin = Math.min(ya, yb), ymax = Math.max(ya, yb);
      if (ymax < p.y0 - m || ymin > p.y1 + m) continue;
      const back = p.y1 + 20 <= D - 4 ? (p.y1 + D) / 2 + 2 : null, front = p.y0 - 20 >= 4 ? p.y0 / 2 - 2 : null;
      let dy = back == null ? front : front == null ? back : Math.abs(e.y - back) < Math.abs(e.y - front) ? back : front;
      if (dy == null) continue;
      const inX = e.x > p.x0 - m && e.x < p.x1 + m;
      const past = dy < p.y0 ? e.y <= p.y0 - m * 0.6 : e.y >= p.y1 + m * 0.6;
      if (past) return [tx > e.x ? Math.min(tx, p.x1 + m + 6) : Math.max(tx, p.x0 - m - 6), dy];
      if (inX) return [e.x + sgn(tx - e.x) * 0.1, dy];
      return [e.x < p.x0 ? Math.min(tx, p.x0 - m - 2) : Math.max(tx, p.x1 + m + 2), dy];
    }
    return [tx, ty];
  }
  walkTo(e, tx, ty, speed, dt, avoid = true) {
    if (avoid) [tx, ty] = this.route(e, tx, ty);
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy * 1.3);
    if (d < 2) { e.mv = 0; return true; }
    const s = Math.min(speed * dt, d);
    const vx = dx / d * s, vy = dy / d * s * 0.75;
    if (Math.abs(dx) > 3) e.face = sgn(dx);
    this.move(e, vx, vy, avoid);
    return false;
  }

  // does an attack zone catch body b?
  zoneHits(a, b, margin = 0) {
    if (a.kind === 'aoe') return Math.hypot(b.x - a.x, (b.y - a.y) * 1) <= a.r + b.r * 0.4 + margin;
    if (a.kind === 'multi') return a.spots.some((s) => Math.hypot(b.x - s.x, b.y - s.y) <= s.r + b.r * 0.4 + margin);
    const o = a.owner;
    const ox = a.kind === 'lunge' ? a.x : o.x, oy = a.kind === 'lunge' ? a.y : o.y;
    const dx = (b.x - ox) * a.face;
    return dx >= -b.r * 0.6 - margin && dx <= a.reach + b.r + margin && Math.abs(b.y - oy) <= a.depth + margin;
  }

  // ---------------------------------------------------------------- damage
  hurt(t, dmg, src, kbx = 0, opts = {}) {
    if (t.dead || t.drop > 0) return false;
    if (t.kind === 'host' && !this.alive(t)) return false;
    if (t.iframe > 0) { this.ev('dodge', { who: t.kind }); if (t.kind === 'player') this.p.dodged = (this.p.dodged || 0) + 1; return false; }
    if (t.kind === 'host' && t.state === 'guard') { dmg *= 0.35; kbx *= 0.4; this.ev('block', {}); }
    if (this.rehearsal && t.kind === 'host' && !opts.scripted) return false;
    t.hp -= dmg;
    t.flash = 0.14;
    t.kb += kbx;
    if (t.kind === 'host' && t.order) t.order.hurt = true;
    this.ev('hit', { who: t.kind, src, dmg, x: t.x, y: t.y, big: dmg >= 20 });
    this.fx.push({ k: 'spark', x: t.x, y: t.y, z: 36 * (t.scale || 1), t: 0, n: dmg >= 20 ? 9 : 5, seed: this.rnd() });
    if (t.kind === 'player') {
      t.regenT = 3.2;
      if (t.state === 'raise') this.h.raiseHalt = true;
      if (t.hp <= 0 && this.rehearsal) t.hp = 1;
      if (t.hp <= 0) { t.hp = 0; t.dead = true; t.state = 'dead'; this.fail('You were struck down', 'player'); return true; }
      if (dmg >= 8) { t.state = 'hurt'; t.t = 0; t.hurtT = 0.22; t.raise = 0; }
      return true;
    }
    if (t.kind === 'host') {
      if (t.state === 'drink' && t.t < 0.75) { this.say('spill', 2, true); t.state = 'hurt'; t.t = 0; t.hurtT = 0.4; }
      if (t.hp <= 0) { this.down(); return true; }
      if (t.state !== 'roll' && dmg >= 8) { t.state = 'hurt'; t.t = 0; t.hurtT = 0.32; }
      return true;
    }
    // foes
    if (t.hp <= 0) { this.kill(t, src); return true; }
    if (t.kind !== 'boss' && (opts.stagger || (t.def.poise === 0 && dmg >= 8))) {
      if (t.state === 'wind') { t.atk = null; this.ev('stagger', {}); }
      t.state = 'hurt'; t.t = 0; t.hurtT = opts.stagger ? 0.5 : 0.28;
    }
    return true;
  }
  kill(f, src) {
    f.dead = true; f.hp = 0; f.state = 'dead'; f.t = 0;
    const threatening = f.atk && f.target === this.h && f.state !== 'hurt';
    f.atk = null;
    if (f.kind === 'boss') return this.bossDown(f);
    if (f.def === FOES.dummy || f.def === FOES.prop) return;
    this.stats.kills++;
    this.lastKill = this.t;
    this.ev('kill', { src, x: f.x, y: f.y });
    if (src === 'host') { if (this.rnd() < 0.4) this.say('kill', 0); if (this.def.pose && this.rnd() < this.def.pose && this.h.state === 'idle') { this.h.state = 'pose'; this.h.t = 0; } }
    if (src === 'player' && threatening) { this.trust(4, 'saved'); this.say('saved', 1); this.stats.saves++; }
  }
  down() {
    const h = this.h;
    h.hp = 0;
    if (h.state === 'fallen') return;
    h.state = 'downed'; h.t = 0; h.order = null;
    h.bleed = this.rehearsal ? 40 : [11, 8, 6, 5][Math.min(h.downs, 3)];
    h.downs++;
    h.raise = 0;
    this.ev('downed', {});
    this.say('downed', 3, true);
  }
  fail(reason, who) {
    if (this.phase !== 'play') return;
    this.phase = 'failing'; this.endT = 0; this.reason = reason; this.failWho = who;
    this.ev('dismissed', { reason });
  }

  // ---------------------------------------------------------------- spawning
  spawn(type, x, y, opts = {}) {
    const def = FOES[type];
    const f = this.body('foe', x, y, { type, def, r: def.r, hp: def.hp, max: def.hp, cd: 0.6 + this.rnd() * 1.2, target: null, aggroT: 0, taunt: 0, think: 0, atk: null, look: opts.look || this.L.foe, drop: opts.noDrop ? 0 : 0.7, strafe: this.rnd() < 0.5 ? -1 : 1 });
    f.face = x < this.p.x ? 1 : -1;
    this.foes.push(f);
    return f;
  }
  startWave(w) {
    w.state = 'active';
    this.lock = { x0: w.x0, x1: w.x1 };
    this.pullIn();
    let tt = 0.2;
    for (const [type, side, delay] of w.foes) w.q.push({ type, side, at: this.t + delay + tt });
    this.ev('wave', {});
  }
  pullIn() {
    const [b0, b1] = this.bounds;
    for (const e of [this.p, this.h]) {
      if (e.kind === 'host' && !e.present) continue;
      const nx = clamp(e.x, b0 + 10, b1 - 10);
      if (nx !== e.x) {
        e.x = nx;
        if (this.inPit(e.x, e.y, 8)) {
          // the nearer strip of floor that is not trapdoor (a pit can reach the front or the back of the stage)
          const ys = [D - 6, 6].filter((y) => !this.inPit(e.x, y, 8)).sort((a, b) => Math.abs(a - e.y) - Math.abs(b - e.y));
          if (ys.length) e.y = ys[0];
        }
        if (e.kind === 'player') { e.lastSafe.x = e.x; e.lastSafe.y = e.y; }
        this.fx.push({ k: 'poof', x: e.x, y: e.y, t: 0 });
      }
    }
  }
  spawnSide(w, type, side) {
    const half = (w.x1 - w.x0) / 2;
    let x = side === 'L' ? w.x0 + 40 + this.rnd() * (half - 80) : w.x1 - 40 - this.rnd() * (half - 80);
    let y = 10 + this.rnd() * (D - 20);
    for (let k = 0; k < 8 && this.inPit(x, y, 16); k++) { y = 10 + this.rnd() * (D - 20); x += side === 'L' ? 12 : -12; }
    // keep away from where the host and the player are standing
    for (const e of [this.p, this.h]) if (Math.abs(e.x - x) < 50 && Math.abs(e.y - y) < 30) y = clamp(e.y + (e.y > D / 2 ? -50 : 50), 8, D - 8);
    this.spawn(type, x, y);
  }

  // ---------------------------------------------------------------- the main step
  step(dt) {
    if (this.phase === 'won' || this.phase === 'dismissed' || this.phase === 'curtain') { this.ageFx(dt); return; }
    if (this.phase === 'failing') { this.endT += dt; dt *= 0.3; if (this.endT > 1.6) { this.phase = 'dismissed'; this.ev('end', {}); } }
    if (this.phase === 'clearing') { this.endT += dt; if (this.endT > 3.4) { this.phase = 'curtain'; this.ev('curtain', {}); } }
    this.t += dt; this.actT += dt;
    this.stepPlayer(dt);
    if (this.h.present) this.stepHost(dt);
    for (const f of this.foes) this.stepFoe(f, dt);
    this.foes = this.foes.filter((f) => !(f.dead && f.t > 1.4));
    this.stepShots(dt);
    this.triggers(dt);
    this.ageFx(dt);
  }
  ageFx(dt) {
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < (f.life || 0.6));
  }

  // ---------------------------------------------------------------- player
  stepPlayer(dt) {
    const p = this.p, I = this.input;
    if (p.dead) return;
    p.t += dt;
    p.iframe = Math.max(0, p.iframe - dt);
    p.flash = Math.max(0, p.flash - dt);
    if (I.atk) p.buf.atk = 0.28;
    if (I.roll) p.buf.roll = 0.25;
    p.buf.atk = Math.max(0, p.buf.atk - dt); p.buf.roll = Math.max(0, p.buf.roll - dt);
    // stamina
    p.stT -= dt;
    if (p.stT <= 0 && p.state !== 'roll') p.st = Math.min(100, p.st + 46 * dt);
    p.regenT -= dt;
    if (p.regenT <= 0 && p.hp < p.max) p.hp = Math.min(p.max, p.hp + 4 * dt);
    // knockback
    if (Math.abs(p.kb) > 1) { this.move(p, p.kb * dt * 6, 0, false); p.kb *= Math.exp(-dt * 9); } else p.kb = 0;

    const h = this.h;
    const hostNeedsMe = h.present && (h.state === 'downed' || h.state === 'hanging') && Math.hypot(h.x - p.x, (h.y - p.y) * 1.2) < 58;
    p.canRaise = hostNeedsMe;
    const mx = I.mx, my = I.my, mag = Math.hypot(mx, my);

    if (I.gesture && (p.state === 'idle' || p.state === 'walk' || (p.state === 'atk' && p.t > 0.2))) {
      p.state = 'gesture'; p.t = 0; p.gest = I.gesture; p.gDone = false;
      this.stats.gestures++;
      this.ev('gesture', { g: I.gesture });
      if (I.gesture === 'spin') p.iframe = 0;
    }
    I.gesture = null;

    switch (p.state) {
      case 'hurt':
        if (p.t > p.hurtT) p.state = 'idle';
        break;
      case 'roll': {
        const k = p.t / 0.42;
        p.iframe = p.t > 0.03 && p.t < 0.32 ? 0.02 : 0;
        const sp = 235 * (1 - k * 0.55);
        this.move(p, p.rdx * sp * dt, p.rdy * sp * dt * 0.7, false);
        if (p.t >= 0.42) p.state = 'idle';
        break;
      }
      case 'atk': {
        const n = p.combo, wind = [0.09, 0.09, 0.15][n], dur = [0.32, 0.32, 0.5][n];
        if (!p.hitDone && p.t >= wind) { p.hitDone = true; this.playerStrike(n); }
        if (p.t < wind && mag > 0.3) p.face = sgn(mx) * (Math.abs(mx) > 0.2 ? 1 : 0) || p.face;
        if (p.t > wind && p.t < wind + 0.07) this.move(p, p.face * 60 * dt, 0, true);
        if (p.buf.atk > 0 && n < 2 && p.t > wind + 0.07 && p.st > 0) { this.beginAtk(n + 1); break; }
        if (p.buf.roll > 0 && p.t > wind + 0.05) { this.beginRoll(mx, my, mag); break; }
        if (p.t >= dur) { p.state = 'idle'; p.combo = 0; }
        break;
      }
      case 'gesture': {
        if (!p.gDone && p.t >= 0.28) { p.gDone = true; this.applyGesture(p.gest); }
        const dur = p.gest === 'spin' ? 0.75 : p.gest === 'bow' ? 0.85 : 0.6;
        if (p.t >= dur) p.state = 'idle';
        else if (p.buf.roll > 0 && p.t > 0.3) this.beginRoll(mx, my, mag);
        break;
      }
      case 'raise': {
        if (!hostNeedsMe || !I.atkHeld || mag > 0.5) { p.state = 'idle'; h.raise = 0; break; }
        if (h.raiseHalt) { h.raiseHalt = false; h.raise *= 0.5; }
        h.raise += dt / (h.state === 'hanging' ? 0.7 : 1.5);
        p.face = sgn(h.x - p.x);
        if (h.raise >= 1) this.raiseHost();
        break;
      }
      default: {
        // free
        if (p.buf.roll > 0 && p.st > 0) { this.beginRoll(mx, my, mag); break; }
        if (hostNeedsMe && I.atkHeld) { p.state = 'raise'; p.t = 0; p.buf.atk = 0; this.ev('raising', {}); break; }
        if (p.buf.atk > 0 && p.st > 0 && !hostNeedsMe) { this.beginAtk(0); break; }
        if (mag > 0.15) {
          const k = Math.min(1, mag);
          this.move(p, mx / mag * k * 128 * dt, my / mag * k * 96 * dt, true);
          if (Math.abs(mx) > 0.12) p.face = sgn(mx);
          p.state = 'walk';
        } else { p.state = 'idle'; p.mv = 0; }
      }
    }
    // falling
    if (this.inPit(p.x, p.y)) {
      this.ev('fall', { who: 'player' });
      p.hp -= 16; p.flash = 0.2; p.regenT = 4;
      this.fx.push({ k: 'drop', x: p.x, y: p.y, t: 0, who: 'player', life: 0.8 });
      p.x = p.lastSafe.x; p.y = p.lastSafe.y; p.state = 'idle'; p.iframe = 0.8; p.kb = 0;
      if (p.hp <= 0 && (this.rehearsal || this.phase !== 'play')) p.hp = 1;
      if (p.hp <= 0) { p.hp = 0; p.dead = true; this.fail('You fell through the stage', 'player'); }
    } else if (!this.inPit(p.x, p.y, 26)) { p.lastSafe.x = p.x; p.lastSafe.y = p.y; }
  }
  beginAtk(n) {
    const p = this.p;
    p.state = 'atk'; p.t = 0; p.combo = n; p.hitDone = false; p.buf.atk = 0;
    p.st -= 9; p.stT = 0.45;
    const I = this.input;
    if (Math.abs(I.mx) > 0.25) p.face = sgn(I.mx);
    // aim assist: face the nearest foe in front-ish if nothing is pressed
    else {
      let best = null, bd = 1e9;
      for (const f of this.foes) { if (f.dead || f.drop > 0) continue; const d = Math.abs(f.x - p.x) + Math.abs(f.y - p.y) * 2; if (d < bd && Math.abs(f.y - p.y) < 20 && Math.abs(f.x - p.x) < 80) { bd = d; best = f; } }
      if (best) p.face = sgn(best.x - p.x);
    }
    this.ev('swing', { who: 'player', n });
  }
  beginRoll(mx, my, mag) {
    const p = this.p;
    if (p.st <= 0) return;
    p.state = 'roll'; p.t = 0; p.buf.roll = 0; p.buf.atk = 0; p.combo = 0;
    if (mag > 0.2) { p.rdx = mx / mag; p.rdy = my / mag; } else { p.rdx = p.face; p.rdy = 0; }
    if (Math.abs(p.rdx) > 0.1) p.face = sgn(p.rdx);
    p.st -= 20; p.stT = 0.6;
    this.ev('roll', { who: 'player' });
  }
  playerStrike(n) {
    const p = this.p;
    const dmg = [11, 11, 19][n], reach = [46, 46, 54][n], kb = [10, 10, 34][n];
    const zone = { kind: 'melee', owner: p, face: p.face, reach, depth: 16 };
    this.fx.push({ k: 'slash', x: p.x, y: p.y, face: p.face, n, t: 0, who: 'player', life: 0.22 });
    let hit = false;
    for (const f of this.foes) {
      if (f.dead || f.drop > 0) continue;
      if (this.zoneHits(zone, f)) {
        hit = true;
        f.aggroT = 4.5;
        if (f.kind === 'boss') f.aggro.player += dmg;
        this.hurt(f, dmg, 'player', f.kind === 'boss' ? 0 : kb * p.face, { stagger: n === 2 && f.def.poise < 2 });
        if (f.def === FOES.dummy) this.ev('dummyHit', { id: f.id });
      }
    }
    if (hit) this.ev('connect', { n });
  }
  raiseHost() {
    const h = this.h, p = this.p;
    const wasHang = h.state === 'hanging';
    h.raise = 0;
    p.state = 'idle';
    if (wasHang) {
      h.state = 'idle'; h.t = 0;
      // pull them up on the near side
      h.x = h.hangX; h.y = h.hangY;
      this.stats.rescues++;
      this.trust(6, 'rescue');
      this.ev('rescued', {});
      this.say('rescued', 3, true);
    } else {
      h.state = 'idle'; h.t = 0; h.hp = Math.round(h.max * 0.4); h.iframe = 1.2;
      this.stats.revives++;
      this.trust(8, 'revive');
      this.ev('revived', {});
      this.say('revived', 3, true);
    }
  }

  // ---------------------------------------------------------------- gestures
  applyGesture(name) {
    const p = this.p, h = this.h;
    if (name === 'spin') {
      let n = 0;
      for (const f of this.foes) if (!f.dead && Math.hypot(f.x - p.x, f.y - p.y) < 240) { f.taunt = 4; f.aggroT = 4; if (f.kind === 'boss') f.aggro.player += 120; n++; }
      this.fx.push({ k: 'ring', x: p.x, y: p.y, t: 0, life: 0.5 });
      if (n) this.ev('taunt', { n });
    }
    if (!h.present || !this.alive(h)) return;
    if (Math.abs(h.x - p.x) > 460) { this.ev('unseen', {}); return; }
    if (name === 'bow') {
      if (['idle', 'walk', 'guard', 'pose'].includes(h.state) || h.state === 'loot') { h.state = 'bow'; h.t = 0; h.face = sgn(p.x - h.x); }
      if (h.bowCd <= this.t) { this.trust(3, 'bow'); h.bowCd = this.t + 12; }
      this.say('bow', 2, true);
      this.ev('heed', { g: name });
      return;
    }
    if (name === 'spin') {
      if (this.t - this.lastKill < 5 || (this.boss == null && this.phase === 'clearing')) {
        if (h.spinCd <= this.t) { this.trust(3, 'spin'); h.spinCd = this.t + 10; }
        if (['idle', 'walk', 'pose'].includes(h.state)) { h.state = 'cheer'; h.t = 0; }
        this.say('spin', 2, true);
      } else this.say('spinNo', 1);
      return;
    }
    const chance = this.heedChance(name);
    if (this.rnd() >= chance) {
      this.stats.ignored++;
      this.ev('ignore', { g: name });
      this.say('ignore', 2, true);
      return;
    }
    this.stats.heeded++;
    const o = { g: name, t: name === 'point' ? 7 : 5, hurt: false, at: this.t };
    if (name === 'point') {
      // nearest foe in the direction the player faces
      let best = null, bd = 1e9;
      for (const f of this.foes) {
        if (f.dead || f.drop > 0 || f.def === FOES.prop) continue;
        const dx = (f.x - p.x) * p.face;
        if (dx < -10 || dx > 340) continue;
        const d = dx + Math.abs(f.y - p.y) * 1.5;
        if (d < bd) { bd = d; best = f; }
      }
      if (best) { o.target = best; best.pointed = 1.2; } else { o.x = clamp(p.x + p.face * 130, ...this.bounds); o.y = p.y; }
    }
    if (h.state === 'loot' || h.state === 'read' || h.state === 'guard' || h.state === 'pose' || h.state === 'idle' || h.state === 'walk' || h.state === 'bow' || h.state === 'cheer') { h.state = 'idle'; h.t = 0; }
    h.readRoll = 0;
    h.goal = null;
    h.order = o;
    this.ev('heed', { g: name });
    this.say('heed', 2, true, name);
  }

  // ---------------------------------------------------------------- host
  stepHost(dt) {
    const h = this.h, d = this.def, p = this.p;
    h.t += dt;
    h.iframe = Math.max(0, h.iframe - dt);
    h.flash = Math.max(0, h.flash - dt);
    h.atkCd -= dt;
    if (Math.abs(h.kb) > 1) { this.move(h, h.kb * dt * 6, 0, false); h.kb *= Math.exp(-dt * 9); } else h.kb = 0;

    // the boss is down and the curtain is coming: nobody bleeds out or drops during the applause
    if (this.phase === 'clearing' && (h.state === 'downed' || h.state === 'hanging')) h.t -= dt;
    if (h.state === 'downed') {
      if (p.state !== 'raise') h.raise = Math.max(0, h.raise - dt * 0.5);
      if (h.t > h.bleed) { if (this.rehearsal) { h.t = 0; return; } h.state = 'fallen'; h.t = 0; this.fail(`${d.name} bled out`, 'host'); }
      return;
    }
    if (h.state === 'hanging') {
      if (p.state !== 'raise') h.raise = Math.max(0, h.raise - dt * 0.5);
      if (h.t > h.hangFor && this.rehearsal) { h.t = 0; return; }
      if (h.t > h.hangFor) { h.state = 'fallen'; h.t = 0; this.ev('fall', { who: 'host' }); this.fail(`${d.name} fell off the stage`, 'host'); }
      return;
    }
    if (h.state === 'fallen' || h.dead) return;

    // pit
    const pit = this.inPit(h.x, h.y);
    if (pit) return this.hang(pit);

    // order timers
    const o = h.order;
    if (o) {
      o.t -= dt;
      if (o.g === 'point' && o.target && o.target.dead) { if (!o.hurt) this.trust(8, 'point'); h.order = null; }
      else if (o.t <= 0) { if (!o.hurt) this.trust(o.g === 'wait' ? 6 : 5, o.g); else this.trust(-3, 'hurt'); h.order = null; }
    }

    switch (h.state) {
      case 'hurt': if (h.t > h.hurtT) h.state = 'idle'; return;
      case 'roll': {
        const k = h.t / 0.45;
        h.iframe = h.t > 0.04 && h.t < 0.32 ? 0.02 : 0;
        const sp = 215 * (1 - k * 0.5);
        this.move(h, h.rdx * sp * dt, h.rdy * sp * dt * 0.7, false);
        if (h.t >= 0.45) h.state = 'idle';
        return;
      }
      case 'atk': return this.hostAtk(dt);
      case 'drink':
        if (!h.drank && h.t >= 0.75) { h.drank = true; h.hp = Math.min(h.max, h.hp + h.max * 0.45); this.ev('drank', {}); }
        if (h.t >= 1.15) h.state = 'idle';
        return;
      case 'bow': if (h.t > 0.9) h.state = 'idle'; return;
      case 'cheer': if (h.t > 1.1) h.state = 'idle'; return;
      case 'pose': if (h.t > 1.6) h.state = 'idle'; return;
      case 'read':
        if (h.t > 1.5) {
          h.state = 'idle';
          if (h.readRoll) { const dir = h.readRoll; h.readRoll = 0; this.hostRoll(dir, 0); }
        }
        return;
      case 'loot': {
        const l = h.lootT;
        if (!l || l.taken) { h.state = 'idle'; return; }
        if (h.t > 0.8) this.takeLoot(l);
        return;
      }
    }

    // rehearsal: the host stands about, does as told, and walks where the script says
    if (this.rehearsal) {
      if (o) return this.hostOrder(dt, o, this.foes.filter((f) => !f.dead));
      if (h.script) { if (this.walkTo(h, h.script.x, h.script.y, h.script.speed, dt, false)) h.state = 'idle'; else h.state = 'walk'; return; }
      h.state = 'idle'; h.mv = 0; if (Math.abs(p.x - h.x) > 8) h.face = sgn(p.x - h.x);
      return;
    }
    // thinking
    h.think -= dt;
    const foes = this.foes.filter((f) => !f.dead && f.drop <= 0 && f.def !== FOES.dummy && f.def !== FOES.prop && Math.abs(f.x - h.x) < 380);
    const threat = this.threatTo(h, 14);
    const hpk = h.hp / h.max;

    // react to an incoming blow: decide once per attack
    if (threat && !h.decided.has(threat.id)) {
      h.decided.add(threat.id);
      if (h.state === 'guard' || o?.g === 'wait') { /* shield is up */ }
      else if (this.rnd() < d.dodge * (o ? 0.8 : 1)) { this.hostRoll(sgn(h.x - threat.owner.x), d.rollRandom); return; }
      else if (this.rnd() > d.greed) { h.backT = 0.7; h.backFrom = threat.owner; }
    }
    // heal
    const healAt = o?.g === 'wait' ? 0.25 : d.healThr;
    if (hpk < healAt && h.flasks > 0 && !(o && o.g === 'beckon')) {
      if (threat && this.rnd() < d.healCare * dt * 6) { h.backT = 0.8; h.backFrom = threat.owner; }
      else if (!threat || h.think <= 0) {
        if (!threat || this.rnd() > d.healCare) { this.hostDrink(); return; }
      }
    }
    if (h.backT > 0) {
      h.backT -= dt;
      const away = sgn(h.x - (h.backFrom?.x ?? h.x - 1));
      this.walkTo(h, h.x + away * 60, h.y + (h.y > D / 2 ? -20 : 20), d.speed * 0.9, dt, true);
      h.face = -away;
      h.state = 'walk';
      return;
    }

    if (o) return this.hostOrder(dt, o, foes);

    // wait/guard leftovers
    if (h.state === 'guard') h.state = 'idle';

    // flee (Wendel when low): runs blind
    if (d.flee && hpk < d.flee && foes.length) {
      const near = foes.reduce((a, b) => (Math.abs(b.x - h.x) < Math.abs(a.x - h.x) ? b : a));
      if (Math.abs(near.x - h.x) < 150) {
        if (this.rnd() < dt * 0.5) this.say('flee', 1);
        const away = sgn(h.x - near.x);
        h.fleeY = h.fleeY ?? (this.rnd() * D);
        if (this.rnd() < dt * 0.6) h.fleeY = this.rnd() * D;
        this.walkTo(h, h.x + away * 80, h.fleeY, d.speed * 1.05, dt, false);
        h.state = 'walk';
        return;
      }
    }

    // read messages (only when nothing is attacking)
    if (!foes.length)
    for (const m of this.msgs) {
      if (m.read || Math.abs(m.x - h.x) > 26) continue;
      m.read = true;
      this._m = m.text;
      if (this.rnd() < (d.gullible > 0 ? 0.95 : 0)) {
        h.state = 'read'; h.t = 0; h.face = 1;
        if (m.eff === 'roll' && this.rnd() < d.gullible) { h.readRoll = this.rollTowardPit(h); this.say('readRoll', 3, true); }
        else this.say('read', 2, true);
        if (m.eff === 'treasure') h.treasure = 1;
        this.ev('read', { m: m.text });
        this._m = null;
        return;
      }
      if (d.gullible === 0 && this.rnd() < 0.5) this.say('read', 1);
      this._m = null;
    }

    // loot
    if (!this.lock || this.lock.loot) {
      const l = this.loot.find((l) => !l.taken && Math.abs(l.x - h.x) < 280);
      if (l && !h.lootSeen.has(l.id)) {
        h.lootSeen.add(l.id);
        const want = Math.min(1, d.lootLust * (h.treasure ? 1.6 : 1) + (l.kind === 'flask' ? 0.35 : 0));
        if (this.rnd() < want) { h.goal = 'loot'; h.goalLoot = l; this.say('loot', 1); }
      }
      if (h.goal === 'loot' && h.goalLoot && !h.goalLoot.taken && (!foes.length || d.lootLust > 0.8)) {
        const l2 = h.goalLoot;
        if (this.walkTo(h, l2.x, l2.y, d.speed, dt, true) || Math.hypot(l2.x - h.x, l2.y - h.y) < 10) { h.state = 'loot'; h.t = 0; h.lootT = l2; h.goal = null; }
        else h.state = 'walk';
        return;
      }
    }

    if (foes.length) return this.hostFight(dt, this.pickTarget(foes));

    // advance
    const goalX = this.advanceGoal();
    const far = p.x < h.x - (d.charges ? 460 : 250);
    if (far && !this.lock) {
      if (this.rnd() < dt * 0.15) this.say('lonely', 0);
      h.state = 'idle'; h.face = -1; h.mv = 0;
      return;
    }
    if (goalX != null) {
      h.laneY = h.laneY ?? 60;
      if (this.rnd() < dt * 0.2) h.laneY = 25 + this.rnd() * 70;
      if (this.walkTo(h, goalX, h.laneY, d.speed * 0.8, dt, true)) h.state = 'idle'; else h.state = 'walk';
    } else { h.state = 'idle'; h.mv = 0; }
  }
  rollTowardPit(h) {
    let best = null;
    for (const p of this.pits) { if (!p.on) continue; const d = Math.abs((p.x0 + p.x1) / 2 - h.x); if (d < 200 && (!best || d < best.d)) best = { d, p }; }
    if (!best) return { dx: 1, dy: 0 };
    const p = best.p;
    const cx = (p.x0 + p.x1) / 2, cy = clamp(h.y, p.y0 + 6, p.y1 - 6);
    const dx = cx - h.x, dy = cy - h.y, m = Math.hypot(dx, dy) || 1;
    return { dx: dx / m, dy: dy / m };
  }
  advanceGoal() {
    if (this.lock) return null;
    for (const w of this.waves) if (w.state === 'idle') return w.at + 30;
    if (this.bossDef && this.bossDef.state === 'idle') return this.bossDef.x0 + 120;
    return null;
  }
  pickTarget(foes) {
    const h = this.h, d = this.def;
    if (this.boss && !this.boss.dead && d.charges) return this.boss;
    let best = null, bd = 1e9;
    for (const f of foes) {
      let s = Math.abs(f.x - h.x) + Math.abs(f.y - h.y) * 1.6;
      if (f.target === h) s *= 0.7;
      if (f.kind === 'boss') s *= d.charges ? 0.3 : 0.9;
      if (f === h.target) s *= 0.75; // stick with it
      if (s < bd) { bd = s; best = f; }
    }
    return best;
  }
  threatTo(e, margin) {
    let best = null;
    for (const f of this.foes) {
      if (f.dead || !f.atk || f.state !== 'wind') continue;
      const a = f.atk;
      if (a.tLeft > 0.6) continue;
      if (this.zoneHits(a, e, margin)) { if (!best || a.tLeft < best.tLeft) best = a; }
    }
    for (const s of this.shots) if (Math.abs(s.y - e.y) < 14 && (e.x - s.x) * s.vx > 0 && Math.abs(e.x - s.x) < 90) return { id: s.id, owner: { x: s.x }, tLeft: 0.2 };
    return best;
  }
  hostRoll(dir, randomness) {
    const h = this.h;
    let a;
    if (typeof dir === 'object') { h.rdx = dir.dx; h.rdy = dir.dy; }
    else if (this.rnd() < randomness) { a = this.rnd() * Math.PI * 2; h.rdx = Math.cos(a); h.rdy = Math.sin(a); }
    else { h.rdx = dir * 0.85; h.rdy = (this.rnd() - 0.5) * 1.1; const m = Math.hypot(h.rdx, h.rdy); h.rdx /= m; h.rdy /= m; }
    if (Math.abs(h.rdx) > 0.15) h.face = sgn(h.rdx);
    h.state = 'roll'; h.t = 0;
    this.ev('roll', { who: 'host' });
  }
  hostDrink() {
    const h = this.h;
    h.state = 'drink'; h.t = 0; h.drank = false; h.flasks--;
    this.say('heal', 1);
    this.ev('drink', {});
  }
  hostFight(dt, f) {
    const h = this.h, d = this.def;
    if (!f) return;
    h.target = f;
    const reach = d.reach + (f.r || 12) * 0.6;
    const side = sgn(h.x - f.x) || 1;
    const rangeX = reach * 0.78;
    const tx = f.x + side * rangeX, ty = f.y;
    const dx = Math.abs(h.x - f.x), dy = Math.abs(h.y - f.y);
    const depthOK = dy < (f.kind === 'boss' ? 26 : 11);
    // Wendel keeps distance between swings
    if (d.key === 'wendel' && h.atkCd > 0.3 && dx < reach + 20) {
      this.walkTo(h, f.x + side * (reach + 30), f.y + (h.y > f.y ? 6 : -6), d.speed * 0.8, dt, true);
      h.face = -side; h.state = 'walk';
      return;
    }
    if (dx <= reach && depthOK && h.atkCd <= 0) {
      h.face = -side;
      h.state = 'atk'; h.t = 0; h.n = 0; h.hitDone = false;
      this.ev('swing', { who: 'host' });
      return;
    }
    const avoid = !(d.charges && this.rnd() < 0.5 && dx > 90);
    if (this.walkTo(h, tx, ty, d.speed * (dx > 120 ? 1 : 0.75), dt, avoid)) { h.state = 'idle'; h.face = -side; }
    else h.state = 'walk';
    if (dx < reach + 30) h.face = -side;
  }
  hostAtk(dt) {
    const h = this.h, d = this.def;
    const wind = h.n === 0 ? d.wind : d.wind * 0.6;
    const dur = wind + 0.12 + d.rec;
    if (!h.hitDone && h.t >= wind) {
      h.hitDone = true;
      const zone = { kind: 'melee', owner: h, face: h.face, reach: d.reach, depth: 15 };
      this.fx.push({ k: 'slash', x: h.x, y: h.y, face: h.face, n: h.n, t: 0, who: 'host', life: 0.22 });
      let hit = false;
      for (const f of this.foes) {
        if (f.dead || f.drop > 0) continue;
        if (f.kind === 'boss' ? this.zoneHits({ ...zone, depth: 28, reach: d.reach + 10 }, f) : this.zoneHits(zone, f)) {
          hit = true;
          if (f.kind === 'boss') f.aggro.host += d.dmg;
          this.hurt(f, d.dmg * (h.n === 2 ? 1.3 : 1), 'host', f.kind === 'boss' ? 0 : h.face * 14, { stagger: d.key === 'gorm' && h.n === 2 });
          if (f.def === FOES.dummy) this.ev('dummyHitHost', { id: f.id });
        }
      }
      if (hit) this.ev('hostConnect', {});
      if (h.n === 0 && d.key === 'gorm') this.move(h, h.face * 8, 0, true);
    }
    if (h.t >= dur) {
      h.state = 'idle';
      h.atkCd = d.key === 'wendel' ? 1.0 + this.rnd() * 0.5 : d.key === 'gorm' ? 0.55 : 0.45;
      return;
    }
    // chain
    if (h.hitDone && h.n + 1 < d.combo && h.t >= wind + 0.12 + d.rec * 0.4) {
      const threat = this.threatTo(h, 6);
      const tgt = h.target;
      const still = tgt && !tgt.dead && Math.abs(tgt.x - h.x) < d.reach + 20;
      if (still && (!threat || this.rnd() < d.greed)) { h.n++; h.t = 0; h.hitDone = false; this.ev('swing', { who: 'host' }); }
      else if (threat && this.rnd() < d.dodge) { this.hostRoll(sgn(h.x - threat.owner.x), d.rollRandom); }
    }
  }
  hostOrder(dt, o, foes) {
    const h = this.h, d = this.def, p = this.p;
    if (o.g === 'wait') {
      h.state = 'guard'; h.mv = 0;
      const near = foes.find((f) => Math.abs(f.x - h.x) < 120);
      if (near) h.face = sgn(near.x - h.x);
      return;
    }
    if (o.g === 'beckon') {
      const tx = p.x - p.face * 34, ty = p.y + (p.y > D / 2 ? -14 : 14);
      if (this.walkTo(h, tx, ty, d.speed * 1.1, dt, true) || Math.hypot(tx - h.x, ty - h.y) < 14) { h.state = 'idle'; h.face = sgn(p.x - h.x); }
      else h.state = 'walk';
      return;
    }
    if (o.g === 'point') {
      if (o.target && !o.target.dead) return this.hostFight(dt, o.target);
      if (o.x != null) {
        if (this.walkTo(h, o.x, o.y, d.speed, dt, true)) { h.order = null; this.trust(2, 'point'); h.state = 'idle'; }
        else h.state = 'walk';
        return;
      }
      h.order = null;
    }
  }
  hang(pit) {
    const h = this.h;
    // nearest edge to cling to
    const opts = [
      { x: pit.x0 - 4, y: h.y, d: h.x - pit.x0 },
      { x: pit.x1 + 4, y: h.y, d: pit.x1 - h.x },
      { x: h.x, y: pit.y0 - 4, d: h.y - pit.y0 },
      { x: h.x, y: pit.y1 + 4, d: pit.y1 - h.y },
    ].filter((o) => o.y >= 0 && o.y <= D);
    for (const o of opts) { o.x = clamp(o.x, ...this.bounds); o.y = clamp(o.y, 2, D - 2); }
    opts.sort((a, b) => a.d - b.d);
    // an edge the arena lock clamps back over the trapdoor is no edge at all
    const e = opts.find((o) => !this.inPit(o.x, o.y, 1)) || opts[0];
    h.hangX = e.x; h.hangY = e.y;
    h.state = 'hanging'; h.t = 0; h.hangFor = this.rehearsal ? 30 : 4.5; h.order = null; h.raise = 0; h.kb = 0;
    this.ev('hang', {});
    this.say('hang', 3, true);
  }
  takeLoot(l) {
    const h = this.h;
    l.taken = true;
    h.state = 'idle';
    this.ev('loot', { kind: l.kind });
    if (l.kind === 'flask') h.flasks = Math.min(5, h.flasks + 1);
    if (l.kind === 'hat' || l.kind === 'gem') h.hats++;
    h.treasure = 0;
    if (l.ambush) {
      this.say('ambush', 3, true);
      const w = { at: l.x, x0: clamp(l.x - 260, 0, this.len - 520), foes: l.ambush, state: 'idle', q: [], ambush: true };
      w.x1 = w.x0 + 520;
      this.waves.push(w);
      this.startWave(w);
      this.ev('ambush', {});
    } else this.say('lootGot', 2, true);
  }

  // ---------------------------------------------------------------- foes
  stepFoe(f, dt) {
    f.t += dt;
    f.flash = Math.max(0, f.flash - dt);
    if (f.dead) return;
    if (f.drop > 0) { f.drop = Math.max(0, f.drop - dt); return; }
    if (f.kind === 'boss') return this.stepBoss(f, dt);
    const def = f.def;
    f.cd -= dt; f.aggroT -= dt; f.taunt -= dt; f.pointed = Math.max(0, (f.pointed || 0) - dt);
    if (Math.abs(f.kb) > 1) { this.move(f, f.kb * dt * 6, 0, false); f.kb *= Math.exp(-dt * 8); } else f.kb = 0;
    if (this.inPit(f.x, f.y)) {
      f.dead = true; f.state = 'dead'; f.t = 0; f.fell = true;
      this.fx.push({ k: 'drop', x: f.x, y: f.y, t: 0, who: 'foe', look: f.look, type: f.type, life: 0.8 });
      this.stats.kills++; this.lastKill = this.t;
      this.ev('kill', { src: 'pit', x: f.x, y: f.y });
      return;
    }
    if (def === FOES.dummy) { f.state = 'idle'; return; }

    // target
    const h = this.h, p = this.p;
    const hostOK = this.hostUp();
    if (f.think <= 0 || !f.target || (f.target === h && !hostOK)) {
      f.think = 0.35;
      if (def === FOES.prop) f.target = p;
      else if (f.taunt > 0 || f.aggroT > 0 || !hostOK) f.target = p;
      else {
        const dh = Math.abs(h.x - f.x) + Math.abs(h.y - f.y), dp = Math.abs(p.x - f.x) + Math.abs(p.y - f.y);
        f.target = dp < dh * 0.45 ? p : h;
      }
    }
    f.think -= dt;
    const t = f.target;

    switch (f.state) {
      case 'hurt': if (f.t > f.hurtT) { f.state = 'idle'; f.cd = Math.max(f.cd, 0.4); } return;
      case 'wind': {
        const a = f.atk;
        a.tLeft -= dt;
        if (def.ranged) a.y = f.y;
        if (a.tLeft <= 0) {
          f.state = 'rec'; f.t = 0;
          if (def.ranged) {
            this.shots.push({ id: ++this.uid, x: f.x + f.face * 14, y: f.y, vx: f.face * 270, dmg: def.dmg, t: 0 });
            this.ev('shoot', {});
          } else {
            this.fx.push({ k: 'slash', x: f.x, y: f.y, face: f.face, n: 1, t: 0, who: 'foe', long: def.reach > 60, life: 0.22 });
            for (const e of [p, h]) if (e.kind !== 'host' || h.present) {
              if (this.zoneHits(a, e)) this.hurt(e, def.dmg, f.type, f.face * 16);
              else if (e === p && p.state === 'roll' && this.zoneHits(a, e, 40)) { p.dodged = (p.dodged || 0) + 1; this.ev('evade', {}); }
            }
            this.ev('foeStrike', {});
          }
          f.atk = null;
        }
        return;
      }
      case 'rec': if (f.t > def.rec) { f.state = 'idle'; f.cd = def.cd[0] + this.rnd() * (def.cd[1] - def.cd[0]); } return;
    }
    if (!t) return;
    // engagement: at most two foes press each target
    const pressing = this.foes.filter((o) => o !== f && !o.dead && o.target === t && !o.def.ranged && o.engaged).length;
    const dx = t.x - f.x, ady = Math.abs(t.y - f.y);
    if (def.ranged) {
      const want = 210;
      const side = sgn(f.x - t.x) || 1;
      let tx = t.x + side * want;
      const [b0, b1] = this.lock ? [this.lock.x0 + 20, this.lock.x1 - 20] : [20, this.len - 20];
      if (tx < b0 || tx > b1) tx = t.x - side * want;
      const ok = Math.abs(Math.abs(dx) - want) < 70 && ady < 8;
      if (ok && f.cd <= 0) { f.face = sgn(dx); this.windUp(f, { kind: 'shot', owner: f, face: f.face, reach: 400, depth: 10 }); return; }
      this.walkTo(f, tx, t.y, def.speed, dt, true);
      f.face = sgn(dx) || f.face;
      f.state = f.mv > 0.1 ? 'walk' : 'idle';
      return;
    }
    f.engaged = pressing < 2 || Math.abs(dx) < 70;
    const side = sgn(f.x - t.x) || 1;
    const range = def.reach * 0.75 + (t.r || 12) * 0.5;
    let tx = t.x + side * range, ty = t.y;
    if (!f.engaged) { tx = t.x + side * (130 + (f.id % 3) * 30); ty = clamp(t.y + f.strafe * 30, 6, D - 6); }
    // keep apart from other foes
    for (const o of this.foes) {
      if (o === f || o.dead) continue;
      const ox = f.x - o.x, oy = f.y - o.y, d2 = ox * ox + oy * oy * 2;
      if (d2 < 26 * 26 && d2 > 0.01) { this.move(f, ox / Math.sqrt(d2) * 20 * dt, oy / Math.sqrt(d2) * 20 * dt, true); }
    }
    const inRange = Math.abs(dx) <= def.reach + (t.r || 12) * 0.5 && ady < def.depth * 0.8;
    if (inRange && f.cd <= 0 && f.engaged && def !== FOES.prop) {
      f.face = sgn(dx);
      this.windUp(f, { kind: 'melee', owner: f, face: f.face, reach: def.reach, depth: def.depth });
      return;
    }
    if (def === FOES.prop) {
      if (f.cd <= 0 && f.active) { f.face = sgn(dx) || -1; this.windUp(f, { kind: 'melee', owner: f, face: f.face, reach: def.reach, depth: def.depth }); return; }
      f.state = 'idle';
      return;
    }
    const arrived = this.walkTo(f, tx, ty, def.speed * (f.engaged ? 1 : 0.7), dt, true);
    if (Math.abs(dx) < 120) f.face = sgn(dx) || f.face;
    f.state = arrived ? 'idle' : 'walk';
  }
  windUp(f, a) {
    a.id = ++this.uid; a.tLeft = f.def.wind; a.dur = f.def.wind; a.dmg = f.def.dmg;
    f.atk = a; f.state = 'wind'; f.t = 0;
    this.ev('wind', { kind: f.type });
  }
  stepShots(dt) {
    const p = this.p, h = this.h;
    for (const s of this.shots) {
      s.t += dt;
      const ox = s.x;
      s.x += s.vx * dt;
      for (const e of [p, h]) {
        if (s.dead || (e === h && !this.hostUp()) || e.dead) continue;
        if (Math.abs(e.y - s.y) < 12 && (e.x - ox) * (e.x - s.x) <= 0) {
          if (e.iframe > 0) { this.ev('dodge', { who: e.kind }); continue; }
          s.dead = true;
          if (e === p && p.state === 'atk') { this.ev('parry', {}); this.fx.push({ k: 'spark', x: s.x, y: s.y, z: 34, t: 0, n: 4, seed: 0.3 }); continue; }
          this.hurt(e, s.dmg, 'arrow', sgn(s.vx) * 6);
        }
      }
      if (s.t > 2.2) s.dead = true;
    }
    this.shots = this.shots.filter((s) => !s.dead);
  }

  // ---------------------------------------------------------------- bosses
  spawnBoss() {
    const B = this.bossDef, def = BOSSES[B.key];
    const f = this.body('boss', B.x0 + 400, 60, { key: B.key, def: { ...def, poise: 9 }, hp: def.hp, max: def.hp, r: def.r, scale: def.scale, cd: 1.8, atk: null, aggro: { host: 0, player: 0 }, taunt: 0, phase2: false, adds: 0, drop: 1.1, face: -1, plan: null });
    this.foes.push(f);
    this.boss = f;
    this.ev('bossIntro', { key: B.key, name: def.name });
    this.say('boss', 3, true);
  }
  stepBoss(f, dt) {
    const p = this.p, h = this.h, def = f.def;
    f.cd -= dt; f.taunt -= dt;
    f.aggro.host *= Math.exp(-dt / 5); f.aggro.player *= Math.exp(-dt / 5);
    const hostOK = this.hostUp();
    let t = !hostOK || f.taunt > 0 || f.aggro.player > f.aggro.host * 1.6 + 30 ? p : h;
    if (f.target !== t) f.target = t;
    if (!f.phase2 && f.hp < f.max * 0.5) { f.phase2 = true; this.ev('bossPhase', {}); }
    // adds
    if (f.key === 'hound' && ((f.adds === 0 && f.hp < f.max * 0.66) || (f.adds === 1 && f.hp < f.max * 0.33)) && f.state !== 'wind') {
      f.adds++; return this.bossWind(f, { kind: 'howl', owner: f, face: f.face, reach: 0, depth: 0 }, 1.1);
    }
    if (f.key === 'king' && f.adds === 0 && f.phase2 && f.state !== 'wind') {
      f.adds++; return this.bossWind(f, { kind: 'howl', owner: f, face: f.face, reach: 0, depth: 0 }, 1.1);
    }
    switch (f.state) {
      case 'wind': {
        const a = f.atk;
        a.tLeft -= dt;
        if (a.kind === 'lunge' && a.tLeft > 0) { a.y = f.y; a.x = f.x; }
        if (a.tLeft <= 0) return this.bossStrike(f, a);
        return;
      }
      case 'lunge': {
        const a = f.atk;
        const sp = 520;
        this.move(f, a.face * sp * dt, 0, true);
        for (const e of [p, h]) if ((e !== h || hostOK) && !a.hit.has(e.kind) && Math.abs(e.y - f.y) < a.depth + 4 && Math.abs(e.x - f.x) < f.r + 6) { a.hit.add(e.kind); this.hurt(e, a.dmg, 'lunge', a.face * 30); }
        if (f.t > a.reach / sp) { f.state = 'rec'; f.t = 0; f.atk = null; }
        return;
      }
      case 'rec':
        if (f.t > (f.recT || 0.7)) { f.state = 'idle'; f.cd = (f.phase2 ? 0.7 : 1.1) + this.rnd() * (f.phase2 ? 0.6 : 0.9); if (f.plan && f.plan.length) { const n = f.plan.shift(); f.cd = 0; this.bossAttack(f, t, n); } }
        return;
    }
    // move & choose
    const dx = t.x - f.x, ady = Math.abs(t.y - f.y);
    f.face = sgn(dx) || f.face;
    if (f.cd <= 0) {
      const d = Math.abs(dx);
      let pick = null;
      if (f.key === 'bell') pick = d < 120 && ady < 40 ? (this.rnd() < 0.62 ? 'swing' : 'toll') : d < 160 && this.rnd() < 0.3 ? 'toll' : null;
      if (f.key === 'hound') pick = d < 70 && ady < 22 ? 'bite' : d < 300 && ady < 14 ? 'lunge' : d < 300 && this.rnd() < 0.02 ? 'lunge' : null;
      if (f.key === 'king') pick = d < 110 && ady < 40 ? (this.rnd() < 0.5 ? 'sweep' : f.phase2 && this.rnd() < 0.5 ? 'flare' : 'embers') : d < 260 && this.rnd() < 0.5 ? 'embers' : f.phase2 && d < 190 && ady < 40 ? 'flare' : null;
      if (pick) return this.bossAttack(f, t, pick);
    }
    // approach
    const want = f.key === 'hound' ? (Math.abs(dx) > 240 ? 200 : 50) : f.key === 'king' ? 85 : 80;
    const tx = t.x - sgn(dx) * want;
    this.walkTo(f, tx, t.y, def.speed * (f.phase2 ? 1.2 : 1), dt, true);
    f.face = sgn(dx) || f.face;
    f.state = f.mv > 0.1 ? 'walk' : 'idle';
  }
  bossWind(f, a, wind) {
    a.id = ++this.uid; a.tLeft = wind; a.dur = wind;
    f.atk = a; f.state = 'wind'; f.t = 0;
    this.ev('bossWind', { kind: a.kind, key: f.key });
  }
  bossAttack(f, t, name) {
    const ph = f.phase2;
    switch (name) {
      case 'swing': f.plan = ph && this.rnd() < 0.6 ? ['swing2'] : null; return this.bossWind(f, { kind: 'melee', name, owner: f, face: f.face, reach: 112, depth: 36, dmg: 26 }, 0.95);
      case 'swing2': f.face = sgn(t.x - f.x) || f.face; return this.bossWind(f, { kind: 'melee', name: 'swing', owner: f, face: f.face, reach: 112, depth: 36, dmg: 24 }, 0.6);
      case 'toll': return this.bossWind(f, { kind: 'aoe', name, owner: f, x: f.x, y: f.y, r: ph ? 135 : 108, dmg: 30 }, 1.35);
      case 'bite': f.plan = ['bite2']; return this.bossWind(f, { kind: 'melee', name, owner: f, face: f.face, reach: 62, depth: 22, dmg: 15 }, 0.5);
      case 'bite2': f.plan = ph ? ['lunge'] : null; f.face = sgn(t.x - f.x) || f.face; return this.bossWind(f, { kind: 'melee', name: 'bite', owner: f, face: f.face, reach: 62, depth: 22, dmg: 15 }, 0.36);
      case 'lunge': f.face = sgn(t.x - f.x) || f.face; f.y = clamp(f.y + clamp(t.y - f.y, -14, 14), 0, D); return this.bossWind(f, { kind: 'lunge', name, owner: f, x: f.x, y: f.y, face: f.face, reach: 250, depth: 18, dmg: 24 }, ph ? 0.6 : 0.75);
      case 'sweep': return this.bossWind(f, { kind: 'melee', name, owner: f, face: f.face, reach: 104, depth: 38, dmg: 24 }, 0.85);
      case 'flare': return this.bossWind(f, { kind: 'melee', name, owner: f, face: f.face, reach: 210, depth: 30, dmg: 32 }, 1.2);
      case 'embers': {
        const spots = [];
        const tg = [this.h, this.p];
        for (const e of tg) if (e === this.p || this.hostUp()) spots.push({ x: e.x + (this.rnd() - 0.5) * 20, y: e.y + (this.rnd() - 0.5) * 14, r: 36 });
        const n = ph ? 4 : 2;
        for (let i = 0; i < n; i++) spots.push({ x: clamp(t.x + (this.rnd() - 0.5) * 240, this.lock.x0 + 20, this.lock.x1 - 20), y: this.rnd() * D, r: 34 });
        return this.bossWind(f, { kind: 'multi', name, owner: f, spots, dmg: 19 }, 1.4);
      }
    }
  }
  bossStrike(f, a) {
    const p = this.p, h = this.h;
    f.t = 0;
    if (a.kind === 'lunge') { f.state = 'lunge'; a.hit = new Set(); this.ev('bossStrike', { kind: 'lunge', key: f.key }); return; }
    if (a.kind === 'howl') {
      f.state = 'rec'; f.recT = 0.6; f.atk = null;
      const type = f.key === 'hound' ? 'husk' : 'archer';
      const w = this.lock;
      for (let i = 0; i < 2; i++) this.spawn(type, i ? w.x0 + 60 : w.x1 - 60, 20 + this.rnd() * 80);
      this.ev('howl', { key: f.key });
      return;
    }
    f.state = 'rec'; f.recT = a.kind === 'aoe' ? 0.9 : a.kind === 'multi' ? 0.5 : 0.65;
    this.fx.push({ k: a.kind === 'melee' ? 'slash' : 'boom', x: a.kind === 'aoe' ? a.x : f.x, y: a.kind === 'aoe' ? a.y : f.y, face: f.face, n: 2, r: a.r, spots: a.spots, t: 0, who: 'boss', big: true, reach: a.reach, life: a.kind === 'melee' ? 0.3 : 0.5 });
    for (const e of [p, h]) {
      if (e === h && !this.hostUp()) continue;
      if (this.zoneHits(a, e)) this.hurt(e, a.dmg, f.key + ':' + a.name, (a.kind === 'aoe' ? sgn(e.x - a.x) : a.face || 1) * 26);
    }
    this.ev('bossStrike', { kind: a.kind, key: f.key, name: a.name });
    f.atk = null;
  }
  bossDown(f) {
    this.ev('bossDown', { key: f.key });
    for (const o of this.foes) if (!o.dead) { o.dead = true; o.state = 'dead'; o.t = 0; }
    this.shots.length = 0;
    this.say('bossDown', 3, true);
    if (this.hostUp()) this.trust(12, 'boss');
    this.stats.acts++;
    this.phase = 'clearing'; this.endT = 0;
    const h = this.h;
    if (this.hostUp()) { h.state = 'cheer'; h.t = 0; h.order = null; }
    this.lastKill = this.t;
  }

  // ---------------------------------------------------------------- triggers
  triggers(dt) {
    const p = this.p, h = this.h;
    // waves
    for (const w of this.waves) {
      if (w.state === 'idle' && !this.lock && ((h.present && h.x > w.at) || p.x > w.at)) this.startWave(w);
      if (w.state === 'active') {
        while (w.q.length && w.q[0].at <= this.t) { const s = w.q.shift(); this.spawnSide(w, s.type, s.side); }
        if (!w.q.length && !this.foes.some((f) => !f.dead)) { w.state = 'done'; this.lock = null; this.ev('clear', {}); }
      }
    }
    // boss gate
    const B = this.bossDef;
    if (B && B.state === 'idle' && !this.lock && ((h.present && this.alive(h) && h.x > B.x0 + 30) || p.x > B.x0 + 30)) {
      B.state = 'active';
      this.lock = { x0: B.x0, x1: B.x1, boss: true };
      this.pullIn();
      this.spawnBoss();
    }
    // the player can't wander further than the next gate before the host
    if (!this.lock && B && B.state === 'idle') p.x = Math.min(p.x, B.x0 + 20);
  }

  // used by the act transitions in main.js
  nextAct() {
    this.h.trust = Math.min(100, this.h.trust);
    this.startAct(this.act + 1);
  }
}
