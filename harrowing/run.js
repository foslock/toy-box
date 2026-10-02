// One descent: three acts, nine circles, a map per act, the deck, HP, obols and charms. Everything random comes from
// the run's own seeded generators (one per purpose), so a saved run carries on exactly as it would have.
import { Rng, hashString } from './rng.js';
import { CARDS, def, makeCard, pool, setUid } from './cards.js';
import { CHARMS, charmPool } from './charms.js';
import { ENCOUNTERS, ELITES, ACTS, CIRCLES } from './enemies.js';

export const ROWS = 9, COLS = 7;
export const STARTER = ['smite', 'smite', 'smite', 'smite', 'ward', 'ward', 'ward', 'ward', 'holyWater', 'offering'];
export const NODE = {
  fight: { name: 'Demons', verb: 'Fight' },
  elite: { name: 'Elite', verb: 'Fight a powerful demon' },
  rest: { name: 'Sanctuary', verb: 'Rest or Bless a card' },
  shop: { name: 'Ferryman', verb: 'Buy and sell with Charon' },
  event: { name: 'Lost Soul', verb: 'Something strange' },
  treasure: { name: 'Reliquary', verb: 'A charm' },
  boss: { name: 'Boss', verb: 'The master of this pit' },
};

export class Run {
  constructor(seed = (Math.random() * 2 ** 32) >>> 0) {
    this.v = 1;
    this.seed = seed >>> 0;
    this.hp = this.maxHp = 72;
    this.obols = 99;
    this.deck = STARTER.map(id => makeCard(id));
    this.charms = ['halo'];
    this.act = 0;
    this.pos = null;           // { row, col } on this act's map, or { row: ROWS } for the boss
    this.visited = [];         // [[row, col], …] this act
    this.floor = 0;
    this.rngs = {};
    this.lastFights = [];
    this.fightsThisAct = 0;
    this.removeCost = 75;
    this.rarePity = 0;
    this.seenEvents = [];
    this.stats = { fights: 0, elites: 0, bosses: 0, scorched: 0, offered: 0, dmgTaken: 0, started: Date.now() };
    this.phoenixUsed = false;
    this.map = this.makeMap();
  }
  rng(name) {
    const r = new Rng(hashString(name + ':' + this.seed));
    if (this.rngs[name] != null) r.state = this.rngs[name];
    const save = () => { this.rngs[name] = r.state; };
    // every draw from it is remembered
    const wrap = f => (...a) => { const v = f.apply(r, a); save(); return v; };
    for (const k of ['next', 'int', 'range', 'chance', 'pick', 'shuffle', 'weighted', 'sample']) r[k] = wrap(r[k]);
    return r;
  }
  get circle() { return Math.min(8, this.act * 3 + Math.floor(Math.min(this.pos?.row ?? 0, ROWS - 1) / 3)); }
  get circleInfo() { return CIRCLES[this.circle]; }

  /* ---------- the map: a funnel of nine rows, narrowing toward the pit ---------- */
  makeMap() {
    const r = this.rng('map' + this.act);
    const edges = new Set(), used = new Set();
    const key = (row, c, c2) => `${row}:${c}>${c2}`;
    let firstStart = -1;
    for (let p = 0; p < 6; p++) {
      let c = r.int(COLS);
      if (p === 1) while (c === firstStart) c = r.int(COLS);
      if (p === 0) firstStart = c;
      used.add(`0:${c}`);
      for (let row = 0; row < ROWS - 1; row++) {
        // the funnel narrows: lower rows pull paths toward the middle
        let options = [c - 1, c, c + 1].filter(x => x >= 0 && x < COLS);
        const lo = Math.floor(row * .25), hi = COLS - 1 - Math.floor(row * .25);
        const inside = options.filter(x => x >= lo && x <= hi);
        if (inside.length) options = inside;
        // no crossing paths
        options = options.filter(n => !(n === c + 1 && edges.has(key(row, c + 1, c))) && !(n === c - 1 && edges.has(key(row, c - 1, c))));
        const n = options.length ? r.pick(options) : c;
        edges.add(key(row, c, n));
        used.add(`${row + 1}:${n}`);
        c = n;
      }
    }
    const nodes = {};
    for (const u of used) { const [row, col] = u.split(':').map(Number); nodes[u] = { row, col, type: null, next: [] }; }
    for (const e of edges) { const [row, rest] = e.split(':'); const [a, b] = rest.split('>').map(Number); const n = nodes[`${row}:${a}`]; if (!n.next.includes(b)) n.next.push(b); }
    for (const n of Object.values(nodes)) n.next.sort((a, b) => a - b);
    // what's at each spot
    const parents = n => Object.values(nodes).filter(p => p.row === n.row - 1 && p.next.includes(n.col));
    const order = Object.values(nodes).sort((a, b) => a.row - b.row || a.col - b.col);
    for (const n of order) {
      if (n.row === 0) { n.type = 'fight'; continue; }
      if (n.row === 4) { n.type = 'treasure'; continue; }
      if (n.row === ROWS - 1) { n.type = 'rest'; continue; }
      const ps = parents(n);
      const siblings = ps.flatMap(p => p.next.map(c => nodes[`${n.row}:${c}`])).filter(s => s && s !== n && s.type);
      for (let tries = 0; tries < 12; tries++) {
        const w = [['fight', 46], ['event', 22]];
        if (n.row >= 3) w.push(['elite', 13]);
        if (n.row >= 3 && n.row !== ROWS - 2) w.push(['rest', 11]);
        if (n.row >= 2) w.push(['shop', 7]);
        const t = r.weighted(w);
        const special = ['elite', 'rest', 'shop'].includes(t);
        if (special && ps.some(p => p.type === t)) continue;
        if (tries < 8 && siblings.some(s => s.type === t) && t !== 'fight') continue;
        n.type = t; break;
      }
      n.type ??= 'fight';
    }
    return { nodes, act: this.act };
  }
  node(row, col) { return this.map.nodes[`${row}:${col}`]; }
  // where you can go next
  choices() {
    if (!this.pos) return Object.values(this.map.nodes).filter(n => n.row === 0);
    if (this.pos.row >= ROWS) return [];
    if (this.pos.row === ROWS - 1) return [{ row: ROWS, col: 3, type: 'boss', next: [] }];
    const n = this.node(this.pos.row, this.pos.col);
    return n.next.map(c => this.node(this.pos.row + 1, c));
  }
  moveTo(n) { this.pos = { row: n.row, col: n.col }; this.visited.push([n.row, n.col]); this.floor++; }
  nextAct() {
    this.act++;
    this.pos = null; this.visited = []; this.fightsThisAct = 0; this.lastFights = [];
    this.map = this.makeMap();
  }

  /* ---------- what you fight ---------- */
  encounter(type) {
    const r = this.rng('fights');
    if (type === 'boss') return { kind: 'boss', enemies: ACTS[this.act].boss[0] };
    if (type === 'elite') {
      const options = ELITES[this.act].filter(e => !this.lastFights.includes(e.join()));
      const e = r.pick(options.length ? options : ELITES[this.act]);
      this.lastFights.push(e.join());
      return { kind: 'elite', enemies: e };
    }
    const enc = ENCOUNTERS[this.circle];
    const list = this.fightsThisAct < 2 && enc.early ? enc.early : enc.normal;
    let options = list.filter(e => !this.lastFights.slice(-3).includes(e.join()));
    if (!options.length) options = list;
    const e = r.pick(options);
    this.lastFights.push(e.join());
    this.fightsThisAct++;
    return { kind: 'fight', enemies: e };
  }

  /* ---------- rewards ---------- */
  rollRarity(kind, r) {
    if (kind === 'boss') return 'rare';
    const x = r.next() * 100;
    const rare = (kind === 'elite' ? 10 : 4) + this.rarePity;
    const unc = kind === 'elite' ? 40 : 36;
    if (x < rare) { this.rarePity = 0; return 'rare'; }
    this.rarePity = Math.min(30, this.rarePity + 1);
    return x < rare + unc ? 'uncommon' : 'common';
  }
  cardChoices(kind = 'fight', n = 3) {
    const r = this.rng('cards');
    const out = [];
    for (let i = 0; i < n; i++) {
      const rarity = this.rollRarity(kind, r);
      const options = pool(rarity).filter(c => !out.some(o => o.id === c.id));
      const c = r.pick(options);
      const up = this.act > 0 && r.chance(this.act === 1 ? .12 : .25) && c.plus;
      out.push(makeCard(c.id, up));
    }
    return out;
  }
  obolReward(kind) {
    const r = this.rng('obols');
    return kind === 'boss' ? 90 + r.int(15) : kind === 'elite' ? 28 + r.int(10) + this.act * 5 : 12 + r.int(9) + this.act * 4;
  }
  charmRarity(r) { const x = r.next(); return x < .5 ? 'common' : x < .83 ? 'uncommon' : 'rare'; }
  randomCharm(rarity) {
    const r = this.rng('charms');
    rarity ??= this.charmRarity(r);
    let options = charmPool(rarity).filter(c => !this.charms.includes(c.id));
    if (!options.length) options = ['common', 'uncommon', 'rare'].flatMap(x => charmPool(x)).filter(c => !this.charms.includes(c.id));
    return options.length ? r.pick(options).id : null;
  }
  bossCharms() {
    const r = this.rng('boss');
    return r.sample(charmPool('boss').filter(c => !this.charms.includes(c.id)), 3).map(c => c.id);
  }
  rewards(kind) {
    const out = { obols: this.obolReward(kind), cards: this.cardChoices(kind, this.charms.includes('reliquary') ? 4 : 3), charm: null };
    if (kind === 'elite') out.charm = this.randomCharm();
    if (kind === 'boss' && this.act < 2) out.bossCharms = this.bossCharms();
    return out;
  }

  /* ---------- shop ---------- */
  shopStock() {
    const r = this.rng('shop');
    const disc = this.charms.includes('ferryCoin') ? .8 : 1;
    const price = (rarity) => Math.round(({ common: 50, uncommon: 76, rare: 150 }[rarity]) * (.9 + r.next() * .2) * disc);
    const cards = [];
    const types = ['attack', 'attack', 'skill', 'skill', 'power'];
    for (const t of types) {
      const rarity = t === 'power' ? (r.chance(.25) ? 'rare' : 'uncommon') : this.rollRarity('fight', r);
      let options = pool(rarity).filter(c => c.type === t && !cards.some(o => o.card.id === c.id));
      if (!options.length) options = pool(rarity).filter(c => !cards.some(o => o.card.id === c.id));
      const c = r.pick(options);
      cards.push({ card: makeCard(c.id), price: price(rarity) });
    }
    const sale = r.int(cards.length); cards[sale].price = Math.round(cards[sale].price / 2); cards[sale].sale = true;
    const charms = [];
    for (let i = 0; i < 3; i++) {
      const rarity = i === 2 ? 'shop' : this.charmRarity(r);
      let options = charmPool(rarity).filter(c => !this.charms.includes(c.id) && !charms.some(o => o.id === c.id));
      if (!options.length) options = ['common', 'uncommon', 'rare'].flatMap(x => charmPool(x)).filter(c => !this.charms.includes(c.id) && !charms.some(o => o.id === c.id));
      if (!options.length) continue;
      const c = r.pick(options);
      charms.push({ id: c.id, price: Math.round(({ common: 150, uncommon: 210, rare: 270, shop: 180 }[c.rarity] ?? 200) * (.95 + r.next() * .1) * disc) });
    }
    return { cards, charms, remove: Math.round(this.removeCost * disc), removed: false };
  }

  /* ---------- the deck ---------- */
  addCard(card) { this.deck.push(card); }
  removeCard(card) { const i = this.deck.indexOf(card); if (i >= 0) this.deck.splice(i, 1); }
  bless(card) { const i = this.deck.indexOf(card); if (i >= 0 && CARDS[card.id].plus && !card.plus) { card.plus = true; return true; } return false; }
  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
  addCharm(id) {
    if (!id || this.charms.includes(id)) return;
    this.charms.push(id);
    CHARMS[id].pickup?.(this);
  }
  pandora() {
    const r = this.rng('pandora');
    this.deck = this.deck.map(c => (c.id === 'smite' || c.id === 'ward') ? makeCard(r.pick([...pool('common'), ...pool('uncommon')]).id) : c);
  }
  transform(card) {
    const r = this.rng('transform');
    const d = CARDS[card.id];
    const rarity = ['common', 'uncommon', 'rare'].includes(d.rarity) ? d.rarity : 'common';
    const options = pool(rarity).filter(c => c.id !== card.id);
    const n = makeCard(r.pick(options).id);
    this.deck[this.deck.indexOf(card)] = n;
    return n;
  }
  restHeal() { return Math.round(this.maxHp * .3) + (this.charms.includes('oliveBranch') ? 12 : 0); }
  canRest() { return !this.charms.includes('ironCrown'); }

  /* ---------- saving ---------- */
  toJSON() {
    const o = { ...this };
    o.deck = this.deck.map(c => ({ uid: c.uid, id: c.id, plus: c.plus }));
    return o;
  }
  static from(o) {
    const r = Object.create(Run.prototype);
    Object.assign(r, o);
    let maxUid = 0;
    r.deck = o.deck.filter(c => CARDS[c.id]).map(c => { maxUid = Math.max(maxUid, c.uid); return { uid: c.uid, id: c.id, plus: !!c.plus }; });
    setUid(maxUid + 1);
    r.charms = (o.charms ?? []).filter(id => CHARMS[id]);
    return r;
  }
}

/* ---------- the blessing before the descent: pick one of three ---------- */
export const BLESSINGS = {
  maxhp: { text: 'Raise your Max HP by 10.', apply(run) { run.maxHp += 10; run.hp += 10; } },
  obols: { text: 'Take 120 obols for the ferryman.', apply(run) { run.obols += 120; } },
  charm: { text: 'Take a random charm.', apply(run) { run.addCharm(run.randomCharm('common')); } },
  rare: { text: 'Choose a rare card.', pick: 'rare' },
  remove: { text: 'Remove a card from your deck.', pick: 'remove' },
  bless2: { text: 'Bless two random cards.', apply(run) { const r = run.rng('blessing'); for (const c of r.sample(run.deck.filter(c => CARDS[c.id].plus && !c.plus), 2)) run.bless(c); } },
  transform: { text: 'Transform a card into another.', pick: 'transform' },
  curseRare: { text: 'Take a rare charm, but carry Regret (a curse).', apply(run) { run.addCharm(run.randomCharm('rare')); run.addCard(makeCard('regret')); } },
  hpCharm: { text: 'Lose 8 Max HP, take an uncommon charm.', apply(run) { run.maxHp -= 8; run.hp = Math.min(run.hp, run.maxHp); run.addCharm(run.randomCharm('uncommon')); } },
};
export function blessingChoices(run) {
  const r = run.rng('blessing');
  const safe = r.sample(['maxhp', 'obols', 'charm', 'bless2'], 2);
  const bold = r.pick(['rare', 'remove', 'transform', 'curseRare', 'hpCharm']);
  return [...safe, bold];
}
