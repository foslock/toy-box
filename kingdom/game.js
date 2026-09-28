// A life: one heir's road from the crossroads, a choice at a time, to the throne or the grave. Pure rules with its own
// seeded dice, so the page (main.js) and the headless balance runs (balance.mjs) play exactly the same game. The page
// asks it for the event in front of you, tells it which way you went, and animates what comes back.
//
// A life has three parts: the journey (12 choices), the bid for the crown (5, from the summons), and, if the crown is
// won, the procession through the royal city (4), where nothing can kill you any more and the choices decide what kind
// of ruler you are. The tile the procession's last choice leads to becomes the throne room.
import { JOURNEY, CROWN_ROW, ROWS, tierOf, START, ITEMS, RELICS, RELIC_TIERS, isCurse, FOES, REALMS, REAPER_STEPS, MAX_SIGHT, itemPrice, LOOT, legacyGold, legacyFood, legacyHp, legacyRenown, legacyClaim } from './rules.js';
import { JOURNEY_EVENTS, SUCCESSION_EVENTS, PROCESSION_EVENTS, EVENT_BY_ID } from './events/index.js';
import { rng } from './util.js';
import { optionWorth, outcomeWorth, winChance, priceFor, oddsFor } from './worth.js';
import { title } from './names.js';

const roll = r => r.int(1, 6);
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const SAVED = ['seed', 'gen', 'heir', 'realm', 'names', 'legacy', 'row', 'col', 'step', 'phase', 'hp', 'maxHp', 'food', 'gold', 'weapon', 'armor',
  'renown', 'claim', 'claimBonus', 'sight', 'relics', 'traits', 'allies', 'flags', 'used', 'path', 'pair', 'reaper', 'egg', 'ward', 'sp', 'log',
  'fate', 'stats', 'cur', 'shop', 'snap', 'startClaim', 'earned', 'virtues', 'treasury', 'gifts', 'afterRealm'];

export class Life {
  // o: { seed, gen, heir, realm: { type, ruler, rival, warlords }, names: { kingdom, capital, house }, legacy: { id: level },
  //      biomeAt(row, col) }
  constructor(o = {}, saved = null) {
    this.biomeAt = o.biomeAt || (() => null);
    if (saved) {
      for (const k of SAVED) if (k in saved) this[k] = saved[k];
      this.rand = rng(1); this.rand.state(saved.rs);
      // lives saved before the procession existed
      this.earned ??= false; this.virtues ??= {}; this.treasury ??= 0; this.gifts ??= { allies: [], renown: 0, gold: 0 }; this.afterRealm ??= {};
      return;
    }
    this.rand = rng(o.seed || 1);
    this.seed = o.seed; this.gen = o.gen || 1; this.heir = o.heir; this.realm = o.realm; this.names = o.names || {}; this.legacy = o.legacy || {};
    const L = k => this.legacy[k] || 0;
    this.row = 0; this.col = 0; this.step = 0; this.phase = 'journey';
    this.maxHp = START.hp + legacyHp[L('hardy')]; this.hp = this.maxHp;
    this.food = START.food + legacyFood[L('larder')];
    this.gold = START.gold + legacyGold[L('coffers')];
    this.weapon = L('blade') ? 'heirloom' + L('blade') : START.weapon; this.armor = START.armor;
    this.renown = legacyRenown[L('name')]; this.claim = 0; this.claimBonus = legacyClaim[L('name')];
    this.sight = L('seer');
    this.relics = []; this.traits = []; this.allies = []; this.flags = []; this.used = []; this.path = []; this.log = [];
    this.pair = null; this.reaper = null; this.egg = null; this.ward = L('ward') > 0; this.sp = null;
    this.fate = null; this.cur = null; this.shop = null; this.snap = null;
    this.stats = { fights: 0, won: 0, relics: 0, goldFound: 0, dragon: false, cursed: 0 };
    this.earned = false; this.virtues = {}; this.treasury = 0; this.gifts = { allies: [], renown: 0, gold: 0 }; this.afterRealm = {};
    // what a crowned parent left: allies, renown, gold
    const g = o.gifts;
    if (g) { for (const a of g.allies || []) if (!this.allies.includes(a)) this.allies.push(a); this.renown += g.renown || 0; this.gold += g.gold || 0; }
    if (this.heir?.royal) this.addTrait('royal_blood', []);
    if (L('hoard')) { const id = this.rand.pick(RELIC_TIERS.common); this.relics.push({ id, used: false }); this.gainRelic(id, []); }
  }

  toJSON() { const o = {}; for (const k of SAVED) o[k] = this[k]; o.rs = this.rand.state(); return o; }

  /* ---------- what you're like ---------- */
  has(id) { return this.relics.some(r => r.id === id && !r.used); }
  owns(id) { return this.relics.some(r => r.id === id); }
  trait(id) { return this.traits.includes(id); }
  get warded() { return this.trait('saints_ward') || this.has('aegis'); }
  get cursed() { return this.traits.some(isCurse); }
  get dead() { return !!this.fate; }
  get power() {
    let p = START.power + ITEMS[this.weapon].power + ITEMS[this.armor].power;
    if (this.has('wolf_tooth')) p += 1;
    if (this.has('dawnblade')) p += 3;
    if (this.has('kingsblade')) p += 4;
    if (this.owns('dragon_egg') && this.egg === 0) p += 4;
    if (this.trait('dragonblood')) p += 2;
    if (this.trait('knighted')) p += 1;
    if (this.trait('wolfblood')) p += 3;
    if (this.trait('toad')) p -= 3;
    return Math.max(0, p);
  }
  // The shape worth.js and the odds want.
  state() {
    return { hp: this.hp, maxHp: this.maxHp, food: this.food, gold: this.gold, power: this.power, weapon: ITEMS[this.weapon].power,
      armor: ITEMS[this.armor].power, renown: this.renown, claim: this.claim, cursed: this.cursed, warded: this.warded || this.ward,
      traits: new Set(this.traits), relics: new Set(this.relics.filter(r => !r.used).map(r => r.id)), allies: new Set(this.allies),
      realm: this.realm.type, oath: this.trait('oathbreaker') };
  }
  // Words that stand in for names in the text.
  fill(s) {
    if (!s) return s;
    const R = this.realm, sex = this.heir?.sex;
    const ruler = R.ruler?.full || 'the warlords';
    return s.replace(/\{(\w+)\}/g, (m, k) => ({
      kingdom: this.names.kingdom, capital: this.names.capital, house: 'House ' + this.names.house, name: this.heir?.name,
      ruler, Ruler: cap(ruler), rival: R.rival, Rival: R.rival, monarch: R.ruler?.sex === 'f' ? 'queen' : 'king',
      warlord: R.warlords?.[0], Warlord: cap(R.warlords?.[0]), warlord2: R.warlords?.[1], Warlord2: cap(R.warlords?.[1]),
      sir: title(sex, 'sir'), lad: title(sex, 'lad'), king: title(sex, 'ruler'), child: title(sex, 'child'),
    })[k] ?? m);
  }

  /* ---------- the choice in front of you ---------- */
  get event() { return this.cur ? EVENT_BY_ID[this.cur.id] : null; }
  option(dir) { const e = this.event; return e ? (dir === 'L' ? e.left : e.right) : null; }
  // The next stage of the bid for the crown (1-5), or of the procession (1-4).
  stage() { return this.row - (this.phase === 'procession' ? CROWN_ROW : JOURNEY) + 1; }

  // Draws the next event, unless one is already waiting.
  present() {
    if (this.fate || this.cur) return this.cur;
    const r = this.rand;
    let pool;
    if (this.phase === 'journey') {
      const tier = tierOf(this.row + 1), realm = this.realm.type;
      const bl = this.biomeAt(this.row + 1, this.col - 1), br = this.biomeAt(this.row + 1, this.col + 1);
      const ok = e => !this.used.includes(e.id) && (!e.realm || e.realm === realm) && (!e.needs || this.flags.includes(e.needs)) && (!e.unless || !this.flags.includes(e.unless) && !this.used.includes(e.unless))
        && (!e.hasTrait || this.trait(e.hasTrait));
      pool = JOURNEY_EVENTS.filter(e => ok(e) && [].concat(e.tier).includes(tier));
      if (!pool.length) pool = JOURNEY_EVENTS.filter(ok);
      pool = pool.map(e => [e, (e.w ?? 1) * ((e.biome || []).some(b => b === bl || b === br) ? 2.2 : 1) * (e.needs ? 1.5 : 1) * (e.realm ? 1.4 : 1)]);
    } else {
      const stage = this.stage(), realm = this.realm.type;
      const list = this.phase === 'procession' ? PROCESSION_EVENTS : SUCCESSION_EVENTS;
      pool = list.filter(e => e.stage === stage && (!e.realm || e.realm === realm) && !this.used.includes(e.id) && (!e.path || e.path === this.sp)
        && (!e.needs || this.flags.includes(e.needs)) && (!e.unless || !this.flags.includes(e.unless))).map(e => [e, e.w ?? 1]);
    }
    if (!pool.length) throw new Error(`no event for row ${this.row + 1} (${this.phase}, ${this.realm.type}, ${this.sp})`);
    const e = r.weighted(pool);
    this.used.push(e.id);
    this.cur = { id: e.id, hidden: this.trait('veil') ? (r.chance(.5) ? 'L' : 'R') : null, omens: null };
    return this.cur;
  }

  // A curse that won't let you go one way. { L: reason or null, R: reason or null }
  locks() {
    const out = { L: null, R: null };
    if (this.trait('twin_step') && this.pair) out[this.pair === 'L' ? 'R' : 'L'] = 'The Twin-Step Hex pulls you the same way again.';
    const n = this.path.length;
    if (this.trait('weathervane') && n >= 2 && this.path[n - 1] === this.path[n - 2]) out[this.path[n - 1]] = 'The Weathervane Curse turns you about.';
    if (out.L && out.R) out.L = out.R = null;
    return out;
  }

  // Foresight: spend a charge to learn how each way bodes.
  omen(dir) {
    const opt = this.option(dir);
    const v = optionWorth(opt, this.state());
    return v > 6 ? 'good' : v < -6 ? 'ill' : 'mixed';
  }
  foresee() {
    if (!this.cur || this.cur.omens || this.sight <= 0) return null;
    this.sight--;
    this.cur.omens = { L: this.omen('L'), R: this.omen('R') };
    return this.cur.omens;
  }

  /* ---------- making a choice ---------- */
  choose(dir) {
    if (this.fate) throw new Error('this life is over');
    if (!this.cur) this.present();
    const lock = this.locks();
    if (lock[dir]) throw new Error(lock[dir]);
    const ev = this.event, opt = this.option(dir), other = this.option(dir === 'L' ? 'R' : 'L');
    this.snap = JSON.stringify({ ...this.toJSON(), snap: null });
    this.move(dir);
    const res = { dir, row: this.row, col: this.col, eventId: ev.id, title: this.fill(ev.title), label: this.fill(opt.label), tile: opt.tile,
      alt: other.tile, text: '', fx: [], upkeep: [], fight: null, shop: null, poor: false };
    if (this.phase === 'procession' && this.row >= ROWS) { res.tile = 'throne'; res.from = opt.tile; }
    const fx = res.fx;
    let paid = true;
    if (opt.cost) {
      const price = priceFor(opt.cost, this.state());
      if (this.gold < price) { paid = false; res.poor = true; this.apply(opt.poor || { text: 'You haven’t the coin, and go on your way with nothing.' }, res); }
      else { this.gold -= price; fx.push({ k: 'cost', v: -price }); }
    }
    if (paid) {
      if (opt.path) this.sp = opt.path;
      if (opt.fight) this.fight(opt.fight, res);
      else if (opt.odds) {
        const p = oddsFor(opt.odds, this.state());
        const won = this.rand() < p;
        res.check = { p, won };
        this.apply(won ? opt.win : opt.lose, res);
      } else this.apply(this.pick(opt.out), res);
      if (opt.shop && !this.fate) { res.shop = opt.shop; this.shop = { kind: opt.shop, wares: this.wares(opt.shop) }; }
    }
    this.after(res);
    this.record(res, ev);
    return res;
  }

  // Seven-League Boots: stride past this choice without facing it.
  stride(dir) {
    const boots = this.relics.find(r => r.id === 'boots' && !r.used);
    if (!boots || this.locks()[dir] || this.phase !== 'journey') return null;
    boots.used = true;
    this.snap = null;
    const ev = this.event, other = this.option(dir === 'L' ? 'R' : 'L');
    this.move(dir);
    const res = { dir, row: this.row, col: this.col, eventId: ev.id, title: this.fill(ev.title), label: 'Stride past', tile: 'road', alt: other.tile, text: 'Seven leagues at a step: whatever waited here, you are past it before it can look up.', fx: [], upkeep: [], strode: true };
    this.after(res);
    this.record(res, ev);
    return res;
  }

  // Hourglass of Ages: put everything back the way it was before the last choice.
  canRewind() {
    if (!this.snap || this.fate?.kind === 'crowned') return false;
    return JSON.parse(this.snap).relics.some(r => r.id === 'hourglass' && !r.used);
  }
  rewind() {
    if (!this.canRewind()) return false;
    const was = JSON.parse(this.snap);
    for (const k of SAVED) if (k in was) this[k] = was[k];
    this.rand.state(was.rs + 7919);            // the same choice, but the dice fall differently
    const h = this.relics.find(r => r.id === 'hourglass'); if (h) h.used = true;
    this.snap = null;
    return true;
  }

  move(dir) {
    this.row++; this.col += dir === 'L' ? -1 : 1; this.step++;
    this.path.push(dir);
    if (this.trait('twin_step')) this.pair = this.pair ? null : dir;
    this.cur = null; this.shop = null;
  }

  // Chance picks an outcome; luck (or the lack of it) sometimes has a second go.
  pick(outs) {
    const r = this.rand;
    const one = () => r.weighted(outs.map(o => [o, o.w ?? 1]));
    let o = one();
    const luck = (this.trait('lucky') || this.has('fox_ring') ? 1 : 0) - (this.trait('ill_luck') ? 1 : 0);
    if (luck && outs.length > 1) {
      const s = this.state(), avg = outs.reduce((a, x) => a + outcomeWorth(x, s) * (x.w ?? 1), 0) / outs.reduce((a, x) => a + (x.w ?? 1), 0);
      const v = outcomeWorth(o, s);
      if ((luck > 0 && v < avg || luck < 0 && v > avg) && r.chance(.45)) {
        const o2 = one(), v2 = outcomeWorth(o2, s);
        if (luck > 0 ? v2 > v : v2 < v) o = o2;
      }
    }
    return o;
  }

  /* ---------- fights ---------- */
  fight(f, res) {
    const r = this.rand, realm = REALMS[this.realm.type] || {};
    const kind = FOES[f.foe]?.kind;
    const foeP = f.power + (realm.foePower || 0);
    const bonus = (this.has('horseshoe') ? 1 : 0) + (kind === 'undead' && this.has('salt') ? 4 : 0);
    const you = this.power + (kind === 'undead' && this.has('salt') ? 4 : 0);
    const F = res.fight = { foe: f.foe, name: this.fill(f.name), power: foeP, you, bonus: this.has('horseshoe') ? 1 : 0, rolls: [], won: false, auto: null, elite: !!f.elite };
    this.stats.fights++;
    if (kind === 'beast' && this.trait('beast_tongue')) {
      F.won = true; F.auto = 'beast';
      res.text = (res.text ? res.text + ' ' : '') + `You speak to ${F.name} in its own tongue, and it lets you pass.`;
      return;
    }
    else {
      const gorgon = this.relics.find(x => x.id === 'gorgon_eye' && !x.used);
      if (gorgon && winChance(this.power + bonus - foeP) < .5) { gorgon.used = true; F.won = true; F.auto = 'gorgon'; }
      else {
        const go = () => { const a = [roll(r), roll(r)], b = [roll(r), roll(r)]; const t = { you: a, foe: b, youTotal: this.power + bonus + a[0] + a[1], foeTotal: foeP + b[0] + b[1] }; F.rolls.push(t); return t.youTotal >= t.foeTotal; };
        F.won = go();
        const foot = this.relics.find(x => x.id === 'rabbit_foot' && !x.used);
        if (!F.won && foot) { foot.used = true; F.reroll = true; F.won = go(); }
      }
    }
    if (F.won) {
      this.stats.won++;
      if (f.foe === 'dragon') this.stats.dragon = true;
      this.apply(f.win, res);
      const fx = res.fx;
      const ren = (foeP >= 6 ? 1 : 0) + (f.elite ? 2 : 0);
      if (ren) this.gainRenown(ren, fx);
      if (this.has('snare')) { this.food += 1; fx.push({ k: 'food', v: 1, why: 'snare' }); }
      if (this.has('glove')) { this.gold += 6; fx.push({ k: 'gold', v: 6, why: 'glove' }); }
      if (this.has('chalice') && this.hp < this.maxHp) { this.hp++; fx.push({ k: 'hp', v: 1, why: 'chalice' }); }
      if (f.elite) this.giveRelic('rare', fx);
      else if (foeP >= 4 && r.chance(.22)) this.giveRelic('random', fx);
      this.loot(f, foeP, kind, fx);
    } else {
      let dmg = Math.max(0, (f.dmg ?? 1) + (realm.hurt || 0) - (this.has('dragon_scale') ? 1 : 0));
      F.dmg = dmg;
      if (dmg) { this.hp -= dmg; res.fx.push({ k: 'hp', v: -dmg }); }
      if (this.hp <= 0) this.cause = { kind: 'killed', cause: `slain by ${F.name}` };
      this.apply(f.lose, res);
    }
  }

  // Spoils: a beast is dinner; people and monsters carry coin, and now and then a weapon or armour worth taking.
  loot(f, foeP, kind, fx) {
    const r = this.rand;
    if (kind === 'beast' && f.foe !== 'spider') { this.food += LOOT.beastFood; fx.push({ k: 'food', v: LOOT.beastFood, why: 'spoils' }); }
    const g = Math.round(foeP * (LOOT.goldPerPower[kind] || 0) * (.6 + r() * .8));
    if (g > 0) { this.gold += g; this.stats.goldFound += g; fx.push({ k: 'gold', v: g, why: 'spoils' }); }
    if ((kind === 'human' || kind === 'monster') && r.chance(LOOT.itemChance)) {
      const slot = r.chance(.55) ? 'weapon' : 'armor';
      const cap = tierOf(Math.max(1, this.row)) + 2 + (f.elite ? 1 : 0);
      const want = Math.min(cap, ITEMS[this[slot]].power + 1);
      const pool = Object.values(ITEMS).filter(i => i.slot === slot && !i.heirloom && i.power === want && i.id !== 'staff' && i.id !== 'rags');
      if (pool.length) this.gainItem(r.pick(pool).id, fx);
    }
  }

  /* ---------- what happens to you ---------- */
  apply(o, res) {
    if (!o) return;
    const fx = res.fx, realm = REALMS[this.realm.type] || {};
    if (o.text) res.text = res.text ? res.text + ' ' + this.fill(o.text) : this.fill(o.text);
    if (o.gold > 0) {
      let g = o.gold;
      if (this.trait('leaden_purse')) g = Math.ceil(g / 2);
      if (this.trait('midas')) g *= 2;
      this.gold += g; this.stats.goldFound += g; fx.push({ k: 'gold', v: g });
    }
    if (o.gold < 0) { const g = Math.min(this.gold, Math.ceil(-o.gold * (realm.lossMul || 1))); if (g) { this.gold -= g; fx.push({ k: 'gold', v: -g }); } }
    if (o.pay) {
      let p = Math.round(o.pay * (realm.payMul || 1));
      if (this.trait('silver_tongue')) p = Math.round(p * .75);
      if (this.trait('toad')) p *= 2;
      if (this.gold >= p) { this.gold -= p; fx.push({ k: 'pay', v: -p }); }
      else { fx.push({ k: 'pay', v: -p, short: true }); this.gold = 0; this.cause = { kind: 'broke', cause: 'thrown into a debtors’ gaol' }; }
    }
    if (o.food > 0) {
      if (this.trait('midas')) { const g = o.food * 3; this.gold += g; fx.push({ k: 'gold', v: g, why: 'midas' }); }
      else { const f = Math.max(0, o.food - (o.food >= 3 ? realm.foodCut || 0 : 0)); if (f) { this.food += f; fx.push({ k: 'food', v: f }); } }
    }
    if (o.food < 0) { const f = Math.min(this.food, -o.food); if (f) { this.food -= f; fx.push({ k: 'food', v: -f }); } }
    if (o.hp > 0) { const h = Math.min(o.hp, this.maxHp - this.hp); if (h > 0) { this.hp += h; fx.push({ k: 'hp', v: h }); } }
    if (o.hp < 0) {
      const h = -o.hp + (realm.hurt || 0);
      this.hp -= h; fx.push({ k: 'hp', v: -h });
      if (this.hp <= 0 && !this.cause) this.cause = { kind: 'killed', cause: `died of wounds at ${this.fill(this.event?.title || 'the roadside')}` };
    }
    if (o.maxhp) { this.maxHp = Math.max(1, this.maxHp + o.maxhp); this.hp = Math.min(this.maxHp, this.hp + Math.max(0, o.maxhp)); fx.push({ k: 'maxhp', v: o.maxhp }); }
    if (o.renown) { if (o.renown > 0) this.gainRenown(o.renown, fx); else { const d = Math.min(this.renown, -o.renown); this.renown -= d; if (d) fx.push({ k: 'renown', v: -d }); } }
    if (o.claim) { if (this.phase === 'succession') this.claim += o.claim; else this.claimBonus += o.claim; fx.push({ k: 'claim', v: o.claim }); }
    if (o.sight) { const s = Math.min(MAX_SIGHT - this.sight, o.sight); if (s > 0) { this.sight += s; fx.push({ k: 'sight', v: s }); } }
    if (o.item) this.gainItem(o.item, fx);
    if (o.relic) this.giveRelic(o.relic, fx);
    if (o.trait) this.addTrait(o.trait, fx);
    if (o.lift) this.lift(o.lift, fx);
    if (o.ally) {
      if (this.trait('oathbreaker')) fx.push({ k: 'ally', id: o.ally, refused: true });
      else if (!this.allies.includes(o.ally)) { this.allies.push(o.ally); fx.push({ k: 'ally', id: o.ally }); }
    }
    if (o.flag && !this.flags.includes(o.flag)) this.flags.push(o.flag);
    if (o.unflag) this.flags = this.flags.filter(f => f !== o.unflag);
    if (o.path) this.sp = o.path;
    for (const v of [].concat(o.virtue ?? [])) { this.virtues[v] = (this.virtues[v] || 0) + 1; fx.push({ k: 'virtue', id: v }); }
    if (o.treasury) { this.treasury += o.treasury; fx.push({ k: 'treasury', v: o.treasury }); }
    if (o.heir) {
      const h = o.heir;
      if (h.ally && !this.gifts.allies.includes(h.ally)) { this.gifts.allies.push(h.ally); fx.push({ k: 'heir', ally: h.ally }); }
      if (h.renown) { this.gifts.renown += h.renown; fx.push({ k: 'heir', renown: h.renown }); }
      if (h.gold) { this.gifts.gold += h.gold; fx.push({ k: 'heir', gold: h.gold }); }
    }
    if (o.after) for (const [k, w] of Object.entries(o.after)) this.afterRealm[k] = (this.afterRealm[k] || 0) + w;
    if (o.fight) { res.intro = res.text; res.text = ''; this.fight(o.fight, res); }
    if (o.crown) res.earned = true;
    if (o.die) this.cause = { kind: 'killed', cause: o.die, forced: true };
    if (this.phase === 'procession' && this.hp < 1) { this.hp = 1; this.cause = null; }
  }
  gainRenown(n, fx) { if (this.trait('beloved')) n++; this.renown += n; fx.push({ k: 'renown', v: n }); }
  gainItem(id, fx) {
    const it = ITEMS[id], cur = ITEMS[this[it.slot]];
    if (it.power > cur.power) { this[it.slot] = id; fx.push({ k: 'item', id, from: cur.id }); }
    else { const g = Math.max(1, Math.round(itemPrice(it.power) / 3)); this.gold += g; fx.push({ k: 'item', id, sold: g }); }
  }
  giveRelic(which, fx) {
    let id = which;
    if (which === 'random' || which === 'rare') {
      const tiers = which === 'rare' ? ['rare', 'common'] : ['common', 'rare'];
      id = null;
      for (const t of tiers) { const pool = RELIC_TIERS[t].filter(x => !this.owns(x)); if (pool.length) { id = this.rand.pick(pool); break; } }
      if (!id) { this.gold += 20; fx.push({ k: 'gold', v: 20 }); return; }
    }
    if (this.owns(id)) { this.gold += 15; fx.push({ k: 'relic', id, dup: 15 }); return; }
    this.relics.push({ id, used: false });
    this.stats.relics++;
    fx.push({ k: 'relic', id });
    this.gainRelic(id, fx);
  }
  gainRelic(id, fx) {
    if (id === 'pilgrim_badge') this.gainRenown(3, fx);
    if (id === 'candle') { this.sight = Math.min(MAX_SIGHT, this.sight + 2); fx.push({ k: 'sight', v: 2 }); }
    if (id === 'grail') { this.maxHp += 2; this.hp = this.maxHp; fx.push({ k: 'maxhp', v: 2 }); }
    if (id === 'old_banner') this.gainRenown(2, fx);
    if (id === 'dragon_egg') this.egg = 4;
  }
  addTrait(id, fx) {
    if (this.trait(id)) return;
    if (isCurse(id)) {
      if (this.warded) { fx.push({ k: 'ward', id, by: this.trait('saints_ward') ? 'saints_ward' : 'aegis' }); return; }
      if (this.ward) { this.ward = false; fx.push({ k: 'ward', id, by: 'ward' }); return; }
      this.stats.cursed++;
    }
    this.traits.push(id);
    fx.push({ k: 'trait', id });
    if (id === 'glass_bones') { this.maxHp = Math.max(1, this.maxHp - 2); this.hp = Math.min(this.hp, this.maxHp); }
    if (id === 'stout_heart') { this.maxHp += 2; this.hp += 2; }
    if (id === 'dragonblood') { this.maxHp += 1; this.hp += 1; }
    if (id === 'second_sight') this.sight = Math.min(MAX_SIGHT, this.sight + 2);
    if (id === 'beloved') this.renown += 2;
    if (id === 'knighted') this.renown += 2;
    if (id === 'reaper') this.reaper = REAPER_STEPS;
    if (id === 'oathbreaker') this.renown = Math.max(0, this.renown - 3);
    if (id === 'twin_step') this.pair = null;
  }
  lift(which, fx) {
    const curses = this.traits.filter(isCurse);
    const id = which === true ? curses[curses.length - 1] : curses.includes(which) ? which : null;
    if (!id) return;
    this.traits = this.traits.filter(t => t !== id);
    if (id === 'glass_bones') this.maxHp += 2;
    if (id === 'reaper') this.reaper = null;
    if (id === 'twin_step') this.pair = null;
    fx.push({ k: 'lift', id });
  }

  // After every step: eat, the slow magic of relics and curses, then whether you're still alive.
  after(res) {
    const up = res.upkeep;
    if (!this.cause && this.phase === 'journey') {
      const skip = this.trait('iron_stomach') && this.step % 2 === 0;
      if (!skip) {
        const need = this.trait('wendigo') ? 2 : 1;
        if (this.food >= need) { this.food -= need; up.push({ k: 'eat', v: -need }); }
        else { this.food = 0; this.hp -= 1; up.push({ k: 'starve', v: -1 }); if (this.hp <= 0) this.cause = { kind: 'starved', cause: 'starved on the road' }; }
      }
    }
    if (!this.cause && this.phase !== 'procession') {
      const s = this.step;
      if (this.has('satchel') && s % 3 === 0) { this.food++; up.push({ k: 'food', v: 1, why: 'satchel' }); }
      if (this.has('moss') && s % 4 === 0 && this.hp < this.maxHp) { this.hp++; up.push({ k: 'hp', v: 1, why: 'moss' }); }
      if (this.has('tinker_coin')) { this.gold += 2; up.push({ k: 'gold', v: 2, why: 'tinker_coin' }); }
      if (this.has('golden_goose')) { this.gold += 4; up.push({ k: 'gold', v: 4, why: 'golden_goose' }); }
      if (this.has('crystal_ball') && s % 3 === 0 && this.sight < MAX_SIGHT) { this.sight++; up.push({ k: 'sight', v: 1, why: 'crystal_ball' }); }
      if (this.trait('second_sight') && s % 4 === 0 && this.sight < MAX_SIGHT) { this.sight++; up.push({ k: 'sight', v: 1, why: 'second_sight' }); }
      if (this.trait('wolfblood') && s % 4 === 0) { this.hp--; up.push({ k: 'hp', v: -1, why: 'wolfblood' }); if (this.hp <= 0) this.cause = { kind: 'killed', cause: 'torn apart by the wolf in the blood' }; }
      if (this.egg > 0 && this.owns('dragon_egg')) { this.egg--; if (this.egg === 0) up.push({ k: 'hatch' }); }
      if (this.reaper != null && this.trait('reaper')) { this.reaper--; if (this.reaper <= 0) { this.cause = { kind: 'reaper', cause: 'taken by the Reaper, as foretold' }; up.push({ k: 'reaper' }); } }
    }
    // Dying: the phoenix may have something to say about it (though not to the Reaper, or to your creditors).
    if (this.hp <= 0 && !this.cause) this.cause = { kind: 'killed', cause: 'died of wounds' };
    const mortal = this.cause && (this.cause.kind === 'killed' || this.cause.kind === 'starved');
    if (mortal && (this.hp <= 0 || this.cause.forced)) {
      const ph = this.relics.find(r => r.id === 'phoenix' && !r.used);
      if (ph) { ph.used = true; this.hp = Math.max(this.hp, Math.min(3, this.maxHp)); this.cause = null; res.revived = true; }
    }
    if (mortal && this.cause && this.hp > 0 && !this.cause.forced) this.cause = null;   // a death that didn't take
    if (this.cause) { this.end(this.cause, res); return; }
    // In line for the throne.
    if (this.phase === 'journey' && this.row >= JOURNEY) {
      this.phase = 'succession';
      this.claim = this.startClaim = this.claimAtSummons();
      res.summons = true;
      return;
    }
    if (this.phase === 'succession') {
      if (res.earned) {
        // the crown is yours: the anointing burns away every curse, and the procession to the throne begins
        this.earned = true; this.phase = 'procession';
        for (const t of this.traits.filter(isCurse)) this.lift(t, res.fx);
        return;
      }
      if (this.claim <= 0) { this.end({ kind: 'lost', cause: 'lost the crown' }, res); res.lost = true; return; }
      if (this.row >= CROWN_ROW) { this.end({ kind: 'lost', cause: 'lost the crown' }, res); res.lost = true; }
      return;
    }
    if (this.phase === 'procession' && this.row >= ROWS) this.end({ kind: 'crowned', cause: 'crowned' }, res);
  }
  claimAtSummons() {
    let c = 1 + Math.min(4, Math.floor(this.renown / 3)) + this.claimBonus;
    if (this.trait('knighted')) c += 1;
    if (this.trait('royal_blood')) c += 1;
    if (this.has('kingsblade')) c += 2;
    if (this.has('old_banner')) c += 3;
    if (this.trait('oathbreaker')) c -= 2;
    return Math.max(1, c);
  }
  end(cause, res) {
    this.fate = { ...cause, row: this.row, col: this.col, age: (this.heir?.age || 17) + this.step, where: res.title };
    this.cur = null; this.shop = null; this.cause = null;
    res.death = cause.kind === 'crowned' ? null : this.fate;
    if (cause.kind === 'crowned') res.crowned = true;
  }
  record(res, ev) {
    this.log.push({ row: this.row, dir: res.dir, id: ev.id, title: res.title, label: res.label, tile: res.tile, alt: res.alt, text: res.text, intro: res.intro,
      fx: res.fx.filter(f => ['relic', 'trait', 'ally', 'item', 'lift', 'ward', 'virtue', 'heir'].includes(f.k) || Math.abs(f.v || 0) >= 1).map(f => ({ ...f })),
      fight: res.fight ? { name: res.fight.name, won: res.fight.won } : null });
  }

  /* ---------- shops ---------- */
  wares(kind) {
    const r = this.rand, tier = tierOf(Math.max(1, this.row)), s = this.state();
    const out = [];
    const price = n => priceFor(n, s);
    const item = (lo, hi, slot) => {
      const pool = Object.values(ITEMS).filter(i => !i.heirloom && i.power >= lo && i.power <= hi && (!slot || i.slot === slot) && i.id !== 'staff' && i.id !== 'rags');
      const it = r.pick(pool);
      return it && { kind: 'item', id: it.id, name: it.name, price: price(itemPrice(it.power)) };
    };
    const lo = tier + 1, hi = tier + 3;
    if (kind === 'market') {
      out.push({ kind: 'food', v: 3, name: 'Three loaves and a cheese', price: price(7) });
      out.push({ kind: 'food', v: 6, name: 'A sack of provisions', price: price(13) });
      out.push({ kind: 'heal', v: 2, name: 'A barber-surgeon', price: price(10) });
      out.push(item(lo - 1, hi - 1, 'weapon'), item(lo - 1, hi - 1, 'armor'));
    } else if (kind === 'smith') {
      out.push(item(lo, hi, 'weapon'), item(lo, hi, 'weapon'), item(lo, hi, 'armor'), item(lo, hi, 'armor'));
    } else if (kind === 'temple') {
      out.push({ kind: 'heal', v: 2, name: 'Prayers and poultices', price: price(8) });
      out.push({ kind: 'heal', v: 9, name: 'A saint’s healing', price: price(20) });
      out.push({ kind: 'lift', name: 'Absolution: lift a curse', price: price(25) });
      if (!this.owns('candle')) out.push({ kind: 'relic', id: 'candle', name: RELICS.candle.name, price: price(24) });
      if (!this.owns('pilgrim_badge')) out.push({ kind: 'relic', id: 'pilgrim_badge', name: RELICS.pilgrim_badge.name, price: price(20) });
    } else if (kind === 'witch') {
      out.push({ kind: 'heal', v: 3, name: 'A green draught', price: price(12) });
      out.push({ kind: 'lift', name: 'Unhexing (usually works)', price: price(16), risky: true });
      out.push({ kind: 'sight', v: 2, name: 'Eyebright tea (+2 foresight)', price: price(14) });
      const rare = RELIC_TIERS.rare.filter(x => !this.owns(x));
      if (rare.length) { const id = r.pick(rare); out.push({ kind: 'relic', id, name: RELICS[id].name, price: price(58) }); }
    } else if (kind === 'fence') {
      const com = RELIC_TIERS.common.filter(x => !this.owns(x)), rare = RELIC_TIERS.rare.filter(x => !this.owns(x));
      if (com.length) { const id = r.pick(com); out.push({ kind: 'relic', id, name: RELICS[id].name, price: price(26) }); }
      if (rare.length) { const id = r.pick(rare); out.push({ kind: 'relic', id, name: RELICS[id].name, price: price(48) }); }
      const a = item(lo, hi + 1), b = item(lo, hi + 1);
      for (const w of [a, b]) if (w) { w.price = Math.round(w.price * .65); out.push(w); }
    }
    return out.filter(Boolean).map((w, i) => ({ ...w, i, sold: false }));
  }
  buy(i) {
    const w = this.shop?.wares[i];
    if (!w || w.sold || this.gold < w.price) return null;
    this.gold -= w.price; w.sold = true;
    const fx = [{ k: 'cost', v: -w.price }], res = { fx, text: '' };
    if (w.kind === 'food') { this.food += w.v; fx.push({ k: 'food', v: w.v }); }
    if (w.kind === 'heal') { const h = Math.min(w.v, this.maxHp - this.hp); this.hp += h; if (h) fx.push({ k: 'hp', v: h }); }
    if (w.kind === 'sight') { this.sight = Math.min(MAX_SIGHT, this.sight + w.v); fx.push({ k: 'sight', v: w.v }); }
    if (w.kind === 'item') this.gainItem(w.id, fx);
    if (w.kind === 'relic') this.giveRelic(w.id, fx);
    if (w.kind === 'lift') {
      if (w.risky && this.rand.chance(.25)) { const c = this.rand.pick(['ill_luck', 'weathervane', 'leaden_purse'].filter(t => !this.trait(t))); if (c) { res.text = 'The witch mutters. Something lifts, and something else settles on you.'; this.lift(true, fx); this.addTrait(c, fx); } }
      else this.lift(true, fx);
    }
    return res;
  }
  leave() { this.shop = null; }
}
