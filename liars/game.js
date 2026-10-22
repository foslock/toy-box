// Liar's Table: the rules of liar's dice, the four regulars, and how they think.
// Pure logic, no DOM, so sim.mjs can play thousands of tables in Node.
//
// Rules used here (no wild ones, to keep it easy to learn):
//  - everyone rolls their dice under a cup; you only see your own
//  - a bid says "there are at least Q dice showing F on the whole table"
//  - each turn, raise (more dice, or the same number of a higher face) or call the last bidder a liar
//  - on a call, every cup lifts: if there are fewer than Q, the bidder loses a die, otherwise the caller does
//  - whoever lost a die starts the next round; the last player with dice wins the table

export const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
export const FACE_ONE = ['', 'one', 'two', 'three', 'four', 'five', 'six'];
export const FACE_MANY = ['', 'ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
export const faceWord = (q, f) => (q === 1 ? FACE_ONE[f] : FACE_MANY[f]);
export const bidText = (q, f) => `${NUM[q] ?? q} ${faceWord(q, f)}`;
export const cap = s => s[0].toUpperCase() + s.slice(1);

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- the regulars
// bluff: how often they'll bid a face they hold none of when it's close to their best honest bid
// lean: + makes them slower to call, - quicker
// skill: how much they believe other players' bids tell them about those players' cups
// watches: which of your habits they study (see Reads below), and how sharply
// tell: what gives them away when they bid a face they don't have. hit = chance it shows when bluffing,
//       false = chance it shows anyway when they're honest. Tables can soften these.
export const CHARACTERS = {
  pip: {
    name: 'Pip', full: 'Pip', what: 'a nervous clown', tell: 'sweat',
    bluff: 0.6, lean: 0.02, skill: 0.1, think: [1.1, 2.2], watches: [], sharp: 0,
    hit: 0.9, false: 0.08,
    open: ['Um. {b}?', '{B}. I think. {B}.', '{B}! …Yes.'],
    raise: ['{B}. Probably.', 'Uh — {b}.', '{B}?', '{B}! Ha. Ha.'],
    call: ['L-liar!', 'Nope! Liar!', 'I don\'t— liar!'],
    lose: ['Oh no.', 'Not again.', '*honk*'], win: ['Ha! Ha ha!', 'Sorry! Sorry.'], out: ['I\'ll just… go, then.'],
  },
  sallow: {
    name: 'Sallow', full: 'Mr. Sallow', what: 'a lizard in a waistcoat', tell: 'tap',
    bluff: 0.5, lean: -0.01, skill: 0.55, think: [1.6, 2.8], watches: ['speed'], sharp: 0.85,
    hit: 0.8, false: 0.12,
    open: ['{B}, to begin.', 'Shall we say {b}.', '{B}.'],
    raise: ['{B}, I should think.', '{B}.', 'Mm. {B}.', 'Oh, {b}, surely.'],
    call: ['I don\'t believe you, dear.', 'Liar.', 'Lift your cup.'],
    lose: ['Tch.', 'How tiresome.'], win: ['Pity.', 'Mm-hm.'], out: ['Well. I\'ve a train to catch.'],
  },
  morrow: {
    name: 'Morrow', full: 'Captain Morrow', what: 'an old sea captain', tell: 'glance',
    bluff: 0.45, lean: 0.03, skill: 0.7, think: [1.8, 3.2], watches: ['jump', 'switch'], sharp: 0.9,
    hit: 0.75, false: 0.12,
    open: ['{B}, and the sea\'s calm.', '{B}.', 'Let\'s say {b}.'],
    raise: ['{B}.', 'Hrm. {B}.', '{B}, and steady.', 'Make it {b}.'],
    call: ['Belay that. Liar.', 'You\'re fishing. Liar.', 'Liar, by thunder.'],
    lose: ['Hrm.', 'A squall.'], win: ['Steady as she goes.', 'Ha!'], out: ['I\'ll be on deck.'],
  },
  widow: {
    name: 'Widow', full: 'The Widow', what: 'she never says whose', tell: 'quick',
    bluff: 0.5, lean: -0.03, skill: 0.85, think: [2.6, 4.2], watches: ['speed', 'jump', 'switch', 'overall'], sharp: 1,
    hit: 0.7, false: 0.12,
    open: ['{B}.', '{B}.', 'Mm. {B}.'],
    raise: ['{B}.', '{B}.', '{B}, then.'],
    call: ['No.', 'Liar.', 'I think not.'],
    lose: ['…', 'Hm.'], win: ['…', 'Thank you.'], out: ['Goodnight.'],
  },
};

export const TABLES = [
  { key: 'backroom', name: 'The Back Room', note: 'A card table behind the bar. Pip and Mr. Sallow are already rolling.',
    seats: ['sallow', 'pip'], soften: 1 },
  { key: 'cellar', name: 'The Cellar', note: 'Under the floorboards, the Captain plays for keeps.',
    seats: ['morrow', 'pip', 'sallow'], soften: 0.92 },
  { key: 'lamproom', name: 'The Lamp Room', note: 'The top of the house. Someone in black is waiting.',
    seats: ['morrow', 'sallow', 'widow'], soften: 0.85 },
];

export const DICE = 4;

// ---- probability that at least k of n unknown dice show a face (k may be fractional: interpolated)
const binCache = new Map();
function atLeastInt(n, k) {
  if (k <= 0) return 1;
  if (k > n) return 0;
  const key = n * 64 + k;
  let v = binCache.get(key);
  if (v !== undefined) return v;
  const p = 1 / 6;
  let s = 0, c = 1;
  for (let i = 0; i <= n; i++) {
    if (i > 0) c = (c * (n - i + 1)) / i;
    if (i >= k) s += c * p ** i * (1 - p) ** (n - i);
  }
  binCache.set(key, s);
  return s;
}
export function atLeast(n, k) {
  const lo = Math.floor(k), t = k - lo;
  return t === 0 ? atLeastInt(n, lo) : atLeastInt(n, lo) * (1 - t) + atLeastInt(n, lo + 1) * t;
}

// ---- the table
export class Game {
  constructor(seats, { dice = DICE, seed = (Math.random() * 2 ** 32) >>> 0 } = {}) {
    this.rand = rng(seed);
    this.players = seats.map(key => ({ key, n: dice, dice: [], out: false }));
    this.starter = 0;
    this.round = 0;
    this.bid = null;
    this.history = [];
    this.turn = 0;
  }
  get alive() { return this.players.filter(p => !p.out); }
  total() { return this.players.reduce((s, p) => s + (p.out ? 0 : p.n), 0); }
  next(i) {
    for (let k = 1; k <= this.players.length; k++) {
      const j = (i + k) % this.players.length;
      if (!this.players[j].out) return j;
    }
    return i;
  }
  roll(rigged) {
    this.round++;
    for (const [i, p] of this.players.entries()) {
      p.dice = p.out ? [] : rigged?.[i] ? rigged[i].slice(0, p.n) : Array.from({ length: p.n }, () => 1 + Math.floor(this.rand() * 6));
      p.dice.sort((a, b) => a - b);
    }
    this.bid = null;
    this.history = [];
    this.turn = this.players[this.starter].out ? this.next(this.starter) : this.starter;
  }
  isRaise(q, f) {
    if (q < 1 || f < 1 || f > 6 || q > this.total()) return false;
    const b = this.bid;
    return !b || q > b.q || (q === b.q && f > b.f);
  }
  // smallest legal bid on face f
  minFor(f) {
    const b = this.bid;
    if (!b) return 1;
    return f > b.f ? b.q : b.q + 1;
  }
  count(f) { return this.players.reduce((s, p) => s + p.dice.filter(d => d === f).length, 0); }
  place(i, q, f, meta = {}) {
    const p = this.players[i];
    const held = p.dice.filter(d => d === f).length;
    const prev = this.bid;
    const entry = { by: i, q, f, held, bluff: held === 0, prevQ: prev?.q ?? 0, prevF: prev?.f ?? 0, ...meta };
    this.bid = { q, f, by: i };
    this.history.push(entry);
    this.turn = this.next(i);
    return entry;
  }
  call(i) {
    const b = this.bid;
    const count = this.count(b.f);
    const lied = count < b.q;
    const loser = lied ? b.by : i;
    return { caller: i, bid: { ...b }, count, lied, loser };
  }
  settle(res) {
    const p = this.players[res.loser];
    p.n--;
    if (p.n <= 0) { p.out = true; p.n = 0; }
    this.starter = p.out ? this.next(res.loser) : res.loser;
    return p.out;
  }
  winner() { const a = this.alive; return a.length === 1 ? this.players.indexOf(a[0]) : -1; }
}

// ---- what the room knows about you
// After every reveal, each of your bids that round goes into the book: how long you took,
// whether you jumped the count, whether you switched faces, and whether you held that face at all.
export function bidFeatures(entry, medianThink) {
  const t = entry.think ?? 3;
  const m = medianThink || 3.2;
  return {
    speed: t > Math.max(4.2, m * 1.5) ? 'slow' : t < Math.min(2.2, m * 0.7) ? 'fast' : 'mid',
    jump: entry.prevQ ? (entry.q - entry.prevQ >= 2 ? 'yes' : 'no') : 'open',
    switch: entry.prevF ? (entry.f !== entry.prevF ? 'yes' : 'no') : 'open',
  };
}

export const READ_TEXT = {
  'speed:slow': 'you take your time when you\'re bluffing',
  'speed:fast': 'you answer quickly when you\'re bluffing',
  'jump:yes': 'you jump the count when you\'re bluffing',
  'jump:no': 'you only creep up by one when you\'re bluffing',
  'switch:yes': 'you change faces when you\'re bluffing',
  'switch:no': 'you stick to the last face when you\'re bluffing',
  'overall:liar': 'you bluff a lot',
  'overall:honest': 'you hardly ever bluff',
};

export class Book {
  constructor(obs = []) { this.obs = obs.slice(-48); }
  add(entry, medianThink) {
    this.obs.push({ ...bidFeatures(entry, medianThink), honest: !entry.bluff });
    if (this.obs.length > 48) this.obs.shift();
  }
  rate(filter) {
    let n = 0, h = 0;
    for (const o of this.obs) if (!filter || filter(o)) { n++; h += o.honest; }
    return { n, r: (h + 1) / (n + 2) };
  }
  // the habits that currently give you away: [{key, gap}]
  tells(feats = ['speed', 'jump', 'switch', 'overall']) {
    const all = this.rate();
    const out = [];
    for (const f of feats) {
      if (f === 'overall') {
        if (all.n >= 8 && all.r < 0.5) out.push({ key: 'overall:liar', gap: 0.6 - all.r });
        else if (all.n >= 8 && all.r > 0.9) out.push({ key: 'overall:honest', gap: all.r - 0.75 });
        continue;
      }
      const vals = f === 'speed' ? ['slow', 'fast'] : ['yes', 'no'];
      for (const v of vals) {
        const b = this.rate(o => o[f] === v);
        const rest = this.rate(o => o[f] !== v && o[f] !== 'open');
        if (b.n >= 3 && rest.n >= 3 && rest.r - b.r >= 0.3) out.push({ key: `${f}:${v}`, gap: rest.r - b.r });
      }
    }
    return out;
  }
}

// ---- thinking at the table
// view: what this player can see. reads: the Book on the human (or null). humanIdx: who the human is.
// `none`: a player we're sure holds none of this face (their tell gave them away)
export function estimate(game, me, q, f, ch, none = -1) {
  const p = game.players[me];
  const own = p.dice.filter(d => d === f).length;
  const unknown = game.total() - p.n - (none >= 0 && none !== me ? game.players[none].n : 0);
  // other players who bid this face this round probably hold some of it
  const backers = new Set();
  for (const h of game.history) if (h.by !== me && h.by !== none && h.f === f) backers.add(h.by);
  const bonus = Math.min(unknown / 2, backers.size * ch.skill * 0.75);
  return atLeast(unknown, q - own - bonus);
}

// how sure they are that you hold none of the face you just bid, from what they've learned of your habits
export function pNone(book, ch, entry, medianThink) {
  if (!book || !ch.watches.length) return 0;
  const all = book.rate();
  if (all.n < 3) return 0;
  const feats = bidFeatures(entry, medianThink);
  let honest = all.r;
  for (const w of ch.watches) {
    if (w === 'overall') continue;
    const v = feats[w];
    if (v === 'open' || v === 'mid') continue;
    const b = book.rate(o => o[w] === v);
    if (b.n >= 3) honest += b.r - all.r;
  }
  honest = Math.min(1, Math.max(0, honest));
  // a sharp reader trusts the pattern; a dull one assumes you're like everyone else (honest ~80%)
  const k = ch.watches.includes('overall') ? ch.sharp : ch.sharp * 0.85;
  return 1 - (k * honest + (1 - k) * 0.8);
}

// Choose an action: { call: true } or { q, f }. `opts.human` and `opts.book` let them use their reads on you,
// `opts.seen` lets a bot use the last bidder's visible tell.
export function decide(game, me, ch, rand, opts = {}) {
  const p = game.players[me];
  const total = game.total();
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of p.dice) counts[d]++;
  const noise = () => (rand() - 0.5) * 0.08;

  // opening bid: our best face, about as many as we hold plus a modest share of the rest
  if (!game.bid) {
    let f = 1, best = -1;
    for (let k = 1; k <= 6; k++) { const v = counts[k] + rand() * 0.9 + k * 0.01; if (v > best) { best = v; f = k; } }
    let bluff = false;
    if (rand() < ch.bluff * 0.5) {
      const none = [1, 2, 3, 4, 5, 6].filter(k => counts[k] === 0);
      if (none.length) { f = none[Math.floor(rand() * none.length)]; bluff = true; }
    }
    const unknown = total - p.n;
    let q = Math.max(1, counts[f] + Math.floor(unknown / 6 * (0.35 + rand() * 0.5)));
    while (q > 1 && estimate(game, me, q, f, ch) < 0.55) q--;
    return { q, f, bluff };
  }

  const b = game.bid;
  let pTrue = estimate(game, me, b.q, b.f, ch, opts.seen ? b.by : -1);
  if (opts.human === b.by && opts.book) {
    const pn = pNone(opts.book, ch, game.history[game.history.length - 1], opts.median);
    if (pn > 0.2) pTrue = (1 - pn) * pTrue + pn * estimate(game, me, b.q, b.f, ch, b.by);
  }
  pTrue = Math.min(1, Math.max(0, pTrue + noise()));

  // the best honest raise and the best bluff
  let best = null, bluffBest = null;
  for (let f = 1; f <= 6; f++) {
    const q0 = game.minFor(f);
    for (let q = q0; q <= Math.min(total, q0 + 1); q++) {
      const pr = estimate(game, me, q, f, ch) + (counts[f] ? 0.02 : 0) + noise() - (q - q0) * 0.04;
      const c = { q, f, p: pr };
      if (!best || pr > best.p) best = c;
      if (!counts[f] && (!bluffBest || pr > bluffBest.p)) bluffBest = c;
    }
  }
  if (!best) return { call: true };
  // calling loses if the bid is true; raising loses if our raise is false and someone calls it
  const callRisk = pTrue + ch.lean;
  const raiseRisk = (1 - best.p) * 0.85;
  if (callRisk < raiseRisk) return { call: true, pTrue };
  if (bluffBest && bluffBest.p > Math.max(0.2, best.p - 0.5) && rand() < ch.bluff)
    return { q: bluffBest.q, f: bluffBest.f, bluff: true };
  return { q: best.q, f: best.f, bluff: !counts[best.f] };
}

// does their tell show on this bid?
export function tellShows(ch, bluff, soften, rand) {
  return rand() < (bluff ? ch.hit * soften : ch.false);
}

export function thinkTime(ch, bluff, rand) {
  if (ch.tell === 'quick' && bluff) return 0.5 + rand() * 0.6;
  const [a, z] = ch.think;
  return a + rand() * (z - a);
}

export function line(ch, kind, q, f, rand) {
  const list = ch[kind];
  const s = list[Math.floor(rand() * list.length)];
  if (q == null) return s;
  return s.replace(/\{b\}/g, bidText(q, f)).replace(/\{B\}/g, cap(bidText(q, f)));
}
