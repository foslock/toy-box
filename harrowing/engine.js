// The fight. One shared deck between the angel and every demon in the fight.
//
// A round: demons draw (each holds its card face up over its head, upside down, as its intent) → your turn: draw 5,
// spend Grace on cards → demons play what they hold, reversed → the next round.
//
// The engine knows nothing about drawing: it awaits view.ev(type, data) for every change, so the page can animate it,
// and io.turn(b) / io.choose(req) when the angel has to decide something. Headless (the balance sim) both resolve at
// once. The engine never touches the DOM.
import { CARDS, def, makeCard, cardCost, threatOf } from './cards.js';
import { ENEMIES } from './enemies.js';
import { CHARMS } from './charms.js';
import { Rng } from './rng.js';

export class FightOver extends Error { constructor(win) { super(win ? 'won' : 'lost'); this.win = win; } }
const NOOP = { async ev() {} };
const HAND_MAX = 10;
const freshStatus = () => ({ might: 0, faith: 0, burn: 0, exposed: 0, shaken: 0, thorns: 0 });

let DUID = 1;
export class Battle {
  // o: { run, enemies: [ids], seed, view, io, kind ('fight' | 'elite' | 'boss') }
  constructor(o) {
    this.run = o.run;
    this.rng = new Rng(o.seed ?? 1);
    this.view = o.view ?? NOOP;
    this.io = o.io;
    this.kind = o.kind ?? 'fight';
    this.charms = (this.run.charms ?? []).map(id => CHARMS[id]).filter(Boolean);
    this.angel = { side: 'angel', id: 'angel', name: 'You', hp: this.run.hp, maxHp: this.run.maxHp, ward: 0, st: freshStatus(), alive: true };
    this.demons = [];
    this.deck = []; this.discard = []; this.hand = []; this.banished = []; this.inPlay = []; this.powerCards = [];
    this.powers = {};
    this.next = { ward: 0, grace: 0, draw: 0 };
    this.grace = 0; this.turn = 0; this.round = 0;
    this.flags = {}; this.counts = {};
    this.result = null; this.busy = false;
    this.log = [];
    this.stats = { dmgTaken: 0, dmgDealt: 0, scorched: 0, offered: 0, cardsPlayed: 0 };
    for (const id of o.enemies) this.addDemon(id);
  }

  /* ---------- small helpers ---------- */
  ev(type, data = {}) { return this.view.ev(type, data, this); }
  living() { return this.demons.filter(d => d.alive); }
  charmRule(rule) { return this.charms.some(c => c.rule === rule); }
  hasCharm(id) { return this.charms.some(c => c.id === id); }
  charmCount(id, inc = 0) { return (this.counts[id] = (this.counts[id] ?? 0) + inc); }
  flash(id) { this.ev('flash', { charm: id }); }
  say(text, who) { return this.ev('say', { text, who }); }
  obols(n) { this.run.obols = Math.max(0, (this.run.obols ?? 0) + n); this.ev('obols', { n }); }
  get graceMax() { return 3 + this.charms.reduce((s, c) => s + (c.grace ?? 0), 0); }
  trait(d, id) { return d.traits.find(t => t.id === id); }
  addDemon(id, at) {
    const e = ENEMIES[id];
    const hp = e.hp[0] + this.rng.int(e.hp[1] - e.hp[0] + 1);
    const d = { side: 'demon', uid: DUID++, id, def: e, name: e.name, hp, maxHp: hp, ward: 0, st: freshStatus(), alive: true,
      held: [], hoard: [], belly: [], traits: e.traits.map(t => ({ ...t })), rounds: 0 };
    d.st.might = e.might ?? 0;
    const th = this.trait(d, 'thorns'); if (th) d.st.thorns = th.n;
    if (at == null) this.demons.push(d); else this.demons.splice(at, 0, d);
    return d;
  }
  async charmHook(name, ...args) {
    for (const c of this.charms) if (c[name]) { await c[name](this, ...args); if (this.result) return; }
  }
  // the number of cards a demon draws this round
  drawsFor(d) {
    if (this.trait(d, 'heads')) return d.hp > d.maxHp * 2 / 3 ? 3 : d.hp > d.maxHp / 3 ? 2 : 1;
    return d.def.draws ?? 1;
  }
  // how a demon reads a card: 'down' (reversed, the usual), 'up' (fallen), or the Devil's pick
  orientFor(d, card) {
    if (this.trait(d, 'fallen')) return 'up';
    if (this.trait(d, 'devil')) {
      const x = def(card);
      return this.threat(d, x.up, 'up') > this.threat(d, x.down, 'down') ? 'up' : 'down';
    }
    return 'down';
  }
  threat(d, effects, orient) {
    let t = threatOf(effects, d.st.might);
    if (orient === 'up') t -= effects.filter(e => ['draw', 'grace', 'foresee', 'offer'].includes(e.k)).length * 0;   // angel-only effects simply fizzle
    return t;
  }
  heldThreat(d, h) { const x = def(h.card); return this.threat(d, h.orient === 'up' ? x.up : x.down, h.orient); }

  /* ---------- damage maths (also used to print the right numbers on cards) ---------- */
  dmgFrom(src, tgt, n, card) {
    let v = n + (src?.st?.might ?? 0);
    if (src === this.angel && card && def(card).holy && this.hasCharm('holyOil')) v += 3;
    if (src?.st?.shaken > 0) v = Math.floor(v * .75);
    if (tgt?.st?.exposed > 0) v = Math.floor(v * 1.5);
    return Math.max(0, v);
  }
  wardFrom(who, n) { return Math.max(0, n + (who?.st?.faith ?? 0)); }

  /* ---------- the fight ---------- */
  async start() {
    try {
      // the deck: your cards plus every demon's Infernal cards
      for (const c of this.run.deck) { delete c.freeThisTurn; delete c.seen; delete c.costMod; this.deck.push(c); }
      for (const d of this.demons) for (const id of d.def.deck) this.deck.push(this.temp(id));
      this.rng.shuffle(this.deck);
      // Innate cards go into your first hand: put them where you, not the demons, will draw them
      await this.ev('setup');
      await this.charmHook('fightStart');
      if (this.flags.openForesee) await this.foresee(this.flags.openForesee);
      for (;;) await this.playRound();
    } catch (e) {
      if (!(e instanceof FightOver)) throw e;
      this.result = e.win ? 'win' : 'lose';
    }
    this.run.hp = Math.max(0, this.angel.hp);
    await this.ev('end', { win: this.result === 'win' });
    return this.result;
  }
  temp(id) { const c = makeCard(id); c.temp = true; return c; }

  async playRound() {
    this.round++;
    if (this.round > 60) throw new FightOver(false);   // a stalemate can't go on forever
    await this.ev('round', { round: this.round });
    // round-start traits: whirlwinds shuffle the deck, the frozen grow ice
    for (const d of this.living()) {
      if (this.trait(d, 'whirl') && this.deck.length > 1) { await this.say('Whirlwind!', d); await this.shuffleDeck(d); }
      const fz = this.trait(d, 'frozen'); if (fz) await this.gainWard(d, fz.n, { raw: true });
    }
    // demons draw, in order
    await this.ev('phase', { who: 'demonsDraw' });
    for (const d of this.living()) await this.demonDraw(d, this.drawsFor(d));
    // your turn
    await this.angelTurn();
    // demons act, in order
    await this.ev('phase', { who: 'demons' });
    for (const d of this.demons.slice()) if (d.alive) await this.demonAct(d);
    // the end of the round
    for (const d of this.living()) {
      if (this.trait(d, 'glutton') && this.deck.length + this.discard.length) { await this.say('Gorges itself', d); await this.eatTop(d); }
      const s = this.trait(d, 'summoner');
      if (s && d.rounds % s.every === 0 && this.living().length < 5) for (let i = 0; i < s.n && this.living().length < 5; i++) await this.summon(d, s.what);
    }
    for (const c of [this.angel, ...this.living()]) {
      for (const k of ['exposed', 'shaken']) if (c.st[k] > 0) { c.st[k]--; await this.ev('status', { target: c, key: k, value: c.st[k] }); }
    }
  }

  async angelTurn() {
    this.turn++;
    const a = this.angel;
    await this.ev('phase', { who: 'angel', turn: this.turn });
    if (!this.powers.sanctuary && a.ward > 0) { a.ward = 0; await this.ev('ward', { target: a, value: 0, fade: true }); }
    await this.tickBurn(a);
    this.grace = this.graceMax + this.next.grace + (this.turn === 1 ? this.flags.extraFirstGrace ?? 0 : 0);
    await this.ev('grace', { value: this.grace });
    if (this.next.ward) { await this.gainWard(a, this.next.ward, { raw: true }); }
    const extraDraw = this.next.draw;
    this.next = { ward: 0, grace: 0, draw: 0 };
    if (this.powers.seraph) await this.addStatus(a, 'might', this.powers.seraph);
    if (this.powers.haloFlame) for (const d of this.living()) await this.addStatus(d, 'burn', this.powers.haloFlame + (this.hasCharm('votive') ? 1 : 0));
    if (this.powers.prophecy) await this.foresee(this.powers.prophecy);
    await this.charmHook('turnStart');
    if (this.result) return;
    let n = 5 + (this.flags.drawBonus ?? 0) + extraDraw + (this.turn === 1 ? this.flags.extraFirstDraw ?? 0 : 0);
    if (this.turn === 1) {
      // Innate cards come first
      const innate = this.deck.filter(c => def(c).innate);
      for (const c of innate) { this.deck.splice(this.deck.indexOf(c), 1); this.deck.push(c); }
    }
    await this.draw(n);
    // you play
    await this.io.turn(this);
    if (this.result) throw new FightOver(this.result === 'win');
    await this.endTurn();
  }

  async endTurn() {
    await this.charmHook('turnEnd');
    // curses and statuses that bite if they're still in your hand
    for (const c of this.hand.slice()) {
      const d = def(c);
      if (d.endInHand) { await this.ev('pulse', { card: c }); await this.runEffects(d.endInHand, this.angel, null, { mode: 'angel', card: c }); }
    }
    const keep = [];
    for (const c of this.hand.slice()) {
      const d = def(c);
      delete c.freeThisTurn;
      if (d.retain || c.retainOnce) { delete c.retainOnce; keep.push(c); continue; }
      this.hand.splice(this.hand.indexOf(c), 1);
      if (d.fleeting) { this.banished.push(c); await this.ev('banish', { card: c, from: 'hand' }); await this.charmHook('banished', c); }
      else { this.discard.push(c); await this.ev('discard', { card: c, from: 'hand' }); }
    }
    await this.ev('handEnd');
  }

  /* ---------- drawing ---------- */
  async refill(who) {
    if (this.deck.length || !this.discard.length) return this.deck.length > 0;
    this.deck = this.rng.shuffle(this.discard.splice(0));
    for (const c of this.deck) delete c.seen;
    await this.ev('reshuffle', { n: this.deck.length, who });
    await this.charmHook('shuffled');
    return true;
  }
  async draw(n) {
    for (let i = 0; i < n; i++) {
      if (this.hand.length >= HAND_MAX) break;
      if (!(await this.refill('angel'))) break;
      const c = this.deck.pop();
      delete c.seen;
      this.hand.push(c);
      await this.ev('draw', { card: c });
    }
  }
  async pullFor(d) {
    // Mimics take the top of the discard pile instead
    if (this.trait(d, 'mimic') && this.discard.length) return { card: this.discard.pop(), from: 'discard' };
    if (!(await this.refill(d))) return null;
    return { card: this.deck.pop(), from: 'deck' };
  }
  async demonDraw(d, n) {
    const finger = this.charmRule('saintFinger');
    const hoard = this.trait(d, 'hoard');
    for (let i = 0; i < n; i++) {
      let p = await this.pullFor(d);
      if (!p) break;
      // the Profane eat holy cards and draw again
      let tries = 0;
      while (p && this.trait(d, 'profane') && def(p.card).holy && tries++ < 3) {
        await this.ev('demonDraw', { demon: d, card: p.card, orient: 'down', from: p.from, peek: true });
        this.banished.push(p.card); await this.ev('eat', { demon: d, card: p.card, from: 'peek' });
        await this.say('Profaned!', d);
        p = await this.pullFor(d);
      }
      if (!p) break;
      const c = p.card; delete c.seen;
      const h = { card: c, orient: this.orientFor(d, c), hidden: !!this.trait(d, 'lurker') };
      d.held.push(h);
      await this.ev('demonDraw', { demon: d, card: c, orient: h.orient, hidden: h.hidden, from: p.from });
      if (finger) {
        // a second card: the demon must keep whichever hurts you less
        const q = await this.pullFor(d);
        if (q) {
          const h2 = { card: q.card, orient: this.orientFor(d, q.card), hidden: h.hidden };
          d.held.push(h2);
          await this.ev('demonDraw', { demon: d, card: q.card, orient: h2.orient, hidden: h2.hidden, from: q.from });
          const worse = this.heldThreat(d, h2) > this.heldThreat(d, h) ? h2 : h;
          d.held.splice(d.held.indexOf(worse), 1);
          this.discard.push(worse.card);
          this.flash(this.hasCharm('saintFinger') ? 'saintFinger' : 'knucklebone');
          await this.ev('discard', { card: worse.card, from: 'held', demon: d });
        }
      }
    }
    if (hoard && d.held.length > 1) {
      // it hoards the card that would hurt you least
      const h = d.held.slice().sort((x, y) => this.heldThreat(d, x) - this.heldThreat(d, y))[0];
      d.held.splice(d.held.indexOf(h), 1);
      d.hoard.push(h.card);
      await this.ev('hoard', { demon: d, card: h.card });
    }
  }

  /* ---------- the angel plays a card ---------- */
  canPlay(card) {
    const d = def(card);
    if (this.result || !this.hand.includes(card)) return false;
    if (d.unplayable) return false;
    const cost = cardCost(card, this);
    return cost < 0 ? true : cost <= this.grace;
  }
  needsTarget(card) { return def(card).target === 'enemy'; }
  // held: which of the target demon's cards to aim at (Disarm, Redeem, Swap, Rebuke); the worst one if not given
  async play(card, target, held) {
    if (this.busy || !this.canPlay(card)) return false;
    this.aim = held ?? null;
    const d = def(card);
    if (this.needsTarget(card) && (!target || !target.alive)) target = this.living()[0];
    if (!this.needsTarget(card)) target = null;
    this.busy = true;
    try {
      const cost = cardCost(card, this);
      const x = cost < 0 ? this.grace : 0;
      this.grace -= cost < 0 ? this.grace : cost;
      this.hand.splice(this.hand.indexOf(card), 1);
      this.inPlay.push(card);
      delete card.freeThisTurn;
      this.stats.cardsPlayed++;
      await this.ev('grace', { value: this.grace });
      await this.ev('play', { card, target });
      const firstAttack = d.type === 'attack' && this.flags.seed;
      if (firstAttack) { this.flags.seed = false; this.flags.double = true; this.flash('mustardSeed'); }
      await this.runEffects(d.up, this.angel, target, { mode: 'angel', card, x });
      this.flags.double = false;
      this.inPlay.splice(this.inPlay.indexOf(card), 1);
      if (d.type === 'power') { this.powerCards.push(card); await this.ev('power', { card }); }
      else if (d.banish) { this.banished.push(card); await this.ev('banish', { card, from: 'play' }); await this.charmHook('banished', card); }
      else { this.discard.push(card); await this.ev('discard', { card, from: 'play' }); }
      if (this.powers.choir) await this.gainWard(this.angel, this.powers.choir, { raw: true });
      await this.charmHook('played', card, d);
      if (this.living().length === 0) throw new FightOver(true);
    } catch (e) {
      if (!(e instanceof FightOver)) throw e;
      this.result = e.win ? 'win' : 'lose';
    } finally {
      this.busy = false; this.aim = null;
    }
    await this.ev('settled');
    return true;
  }

  /* ---------- demons play what they hold ---------- */
  async demonAct(d) {
    d.rounds++;
    if (d.ward > 0) { d.ward = 0; await this.ev('ward', { target: d, value: 0, fade: true }); }
    await this.tickBurn(d);
    if (!d.alive) return;
    for (const h of d.held.slice()) {
      if (!d.alive) break;
      d.held.splice(d.held.indexOf(h), 1);
      await this.demonPlay(d, h, 'demon');
    }
    // a hoard that grows too big comes down all at once
    if (d.alive && this.trait(d, 'hoard') && d.hoard.length >= 4) {
      await this.say('The hoard spills over!', d);
      while (d.hoard.length && d.alive) { const c = d.hoard.shift(); await this.demonPlay(d, { card: c, orient: this.orientFor(d, c) }, 'demon', 'hoard'); }
    }
    const rg = this.trait(d, 'regen');
    if (rg && d.alive) await this.healDemon(d, rg.n);
    if (this.trait(d, 'devil') && !d.broke && d.hp <= d.maxHp / 2 && d.alive) {
      d.broke = true;
      await this.ev('devilBreaks', { demon: d });
      await this.say('The ice cracks!', d);
      d.st.might += 2; await this.ev('status', { target: d, key: 'might', value: d.st.might });
      this.addToDeck('frost', 3); await this.ev('addCards', { id: 'frost', n: 3, demon: d });
    }
  }
  // mode 'demon': the usual; 'rebuke': against itself
  async demonPlay(d, h, mode, from = 'held') {
    const c = h.card, x = def(c);
    const effects = h.orient === 'up' ? x.up : x.down;
    await this.ev('demonPlay', { demon: d, card: c, orient: h.orient, mode, from });
    this.inPlay.push(c);
    const holy = h.orient === 'down' && x.holy;
    await this.runEffects(effects, d, mode === 'rebuke' ? d : this.angel, { mode: mode === 'rebuke' ? 'rebuke' : h.orient === 'up' ? 'fallen' : 'demon', card: c, holy, orient: h.orient });
    this.inPlay.splice(this.inPlay.indexOf(c), 1);
    await this.charmHook('demonPlays', d, x);
    if (holy && this.powers.covenant) { this.next.grace += 1; this.next.draw += 1; this.ev('say', { text: 'Covenant', who: this.angel }); }
    if (this.trait(d, 'devour') && d.alive) { d.belly.push(c); await this.ev('eat', { demon: d, card: c, from: 'play', belly: true }); }
    else { this.discard.push(c); await this.ev('discard', { card: c, from: 'play', demon: d }); }
    await this.checkBelly(d);
  }
  // Cerberus coughs up what it ate whenever it loses a head, or when the deck runs too thin to go on
  async checkBelly(d) {
    if (!d.belly?.length) return;
    const heads = this.drawsFor(d);
    const thin = this.deck.length + this.discard.length + this.hand.length < 6;
    if (d.alive && heads >= (d.headsSeen ?? 3) && !thin) return;
    d.headsSeen = heads;
    if (d.alive) await this.say(thin ? 'Retches!' : 'A head slumps!', d);
    for (const c of d.belly.splice(0)) { this.discard.push(c); await this.ev('discard', { card: c, from: 'belly', demon: d }); }
  }

  /* ---------- effects ---------- */
  // ctx.mode: 'angel' (upright, by you), 'demon' (reversed, at you), 'fallen' (upright, at you), 'rebuke' (at itself)
  async runEffects(effects, actor, target, ctx) {
    for (const e of effects) {
      if (this.result) return;
      if (ctx.mode === 'angel') await this.angelEffect(e, target, ctx);
      else await this.demonEffect(e, actor, target, ctx);
      if (this.living().length === 0 && this.demons.length) throw new FightOver(true);
    }
  }
  async angelEffect(e, target, ctx) {
    const a = this.angel, n = e.n, card = ctx.card;
    const tgt = target?.alive ? target : null;
    switch (e.k) {
      case 'dmg': for (let i = 0; i < (e.x || 1) && tgt?.alive; i++) await this.attack(a, tgt, n, card); break;
      case 'aoe': for (let i = 0; i < (e.x || 1); i++) await this.aoe(a, n, { card }); break;
      case 'rand': for (let i = 0; i < e.x; i++) { const l = this.living(); if (!l.length) break; await this.attack(a, this.rng.pick(l), n, card); } break;
      case 'xAoe': for (let i = 0; i < ctx.x; i++) await this.aoe(a, n, { card }); break;
      case 'perHeld': { const k = this.living().reduce((s, d) => s + d.held.length, 0); if (tgt && k) await this.attack(a, tgt, n * k, card); else if (tgt) await this.say('No cards held', tgt); break; }
      case 'ward': await this.gainWard(a, n); break;
      case 'heal': await this.healAngel(n); break;
      case 'lose': await this.loseHp(a, n); break;
      case 'burn': if (tgt) await this.addStatus(tgt, 'burn', n + (this.hasCharm('votive') ? 1 : 0)); break;
      case 'burnAll': for (const d of this.living()) await this.addStatus(d, 'burn', n + (this.hasCharm('votive') ? 1 : 0)); break;
      case 'expose': if (e.self) await this.addStatus(a, 'exposed', n); else if (tgt) await this.addStatus(tgt, 'exposed', n); break;
      case 'exposeAll': for (const d of this.living()) await this.addStatus(d, 'exposed', n); break;
      case 'shake': if (e.self) await this.addStatus(a, 'shaken', n); else if (tgt) await this.addStatus(tgt, 'shaken', n); break;
      case 'might': await this.addStatus(a, 'might', n); break;
      case 'faith': await this.addStatus(a, 'faith', n); break;
      case 'thorns': await this.addStatus(a, 'thorns', n); break;
      case 'draw': await this.draw(n); break;
      case 'grace': await this.gainGrace(n); break;
      case 'nextWard': this.next.ward += this.wardFrom(a, n); await this.ev('next', { ward: this.next.ward }); break;
      case 'foresee': await this.foresee(n); break;
      case 'offer': await this.offer(n); break;
      case 'recall': await this.recall(n); break;
      case 'purge': await this.purge(n); break;
      case 'disarm': if (tgt) {
        if (e.if === 'holdsAttack') { const h = tgt.held.filter(h => this.isAttackHeld(tgt, h)).sort((x, y) => this.heldThreat(tgt, y) - this.heldThreat(tgt, x))[0]; if (h) await this.disarm(tgt, h); }
        else await this.disarm(tgt, this.pickHeld(tgt));
      } break;
      case 'disarmAll': for (const d of this.living()) for (const h of d.held.slice()) await this.disarm(d, h); break;
      case 'rebuke': if (tgt) await this.rebuke(tgt, this.pickHeld(tgt)); break;
      case 'rebukeAll': for (const d of this.living()) for (const h of d.held.slice()) if (d.alive) await this.rebuke(d, h); break;
      case 'redeem': if (tgt) await this.redeem(tgt); break;
      case 'swap': if (tgt) await this.swap(tgt); break;
      case 'kindle': if (tgt && tgt.st.burn) await this.addStatus(tgt, 'burn', tgt.st.burn); break;
      case 'power': this.powers[e.id] = (this.powers[e.id] ?? 0) + n; await this.ev('powers', { id: e.id }); break;
      case 'obols': this.obols(n); break;
      case 'shuffleDeck': await this.shuffleDeck(a); break;
      case 'feedDevil': for (const d of this.living()) if (this.trait(d, 'devil')) await this.addStatus(d, 'might', n); break;
      case 'addCard': this.addToDeck(e.id, n); await this.ev('addCards', { id: e.id, n }); break;
      case 'nothing': break;
    }
  }
  // A demon playing a card. In 'rebuke' mode everything hostile lands on the demon itself and its blessings fizzle.
  async demonEffect(e, d, target, ctx) {
    const a = this.angel, n = e.n, rebuke = ctx.mode === 'rebuke';
    const foe = rebuke ? d : a;
    if (!d.alive && !rebuke) return;
    switch (e.k) {
      case 'dmg': case 'aoe': case 'rand': for (let i = 0; i < (e.x || 1); i++) { if (!foe.alive || !d.alive) break; await this.attack(d, foe, n, ctx.card); } break;
      case 'xAoe': for (let i = 0; i < 2; i++) await this.attack(d, foe, n, ctx.card); break;
      case 'perHeld': await this.attack(d, foe, n, ctx.card); break;
      case 'ward': if (!rebuke) await this.gainWard(d, n); break;
      case 'heal': if (!rebuke) await this.healDemon(d, n); break;
      case 'lose': {
        // Scorched by a Holy card
        let v = n + (this.hasCharm('saltCellar') && ctx.holy ? 3 : 0);
        await this.loseHp(d, v, { scorch: true });
        if (ctx.holy) {
          this.stats.scorched++;
          await this.charmHook('scorched', d, v);
          if (this.powers.bell) { await this.ev('say', { text: 'Sanctus!', who: this.angel }); await this.aoe(a, this.powers.bell, { raw: true }); }
        }
        break;
      }
      case 'burn': case 'burnAll': await this.addStatus(e.self ? d : foe, 'burn', n); break;
      case 'expose': case 'exposeAll': await this.addStatus(e.self ? d : foe, 'exposed', n); break;
      case 'shake': await this.addStatus(e.self ? d : foe, 'shaken', n); break;
      case 'kindle': if (foe.st.burn) await this.addStatus(foe, 'burn', foe.st.burn); break;
      case 'might': if (!rebuke) await this.addStatus(d, 'might', n); break;
      case 'faith': if (!rebuke) await this.addStatus(d, 'faith', n); break;
      case 'thorns': if (!rebuke) await this.addStatus(d, 'thorns', n); break;
      case 'feedDevil': if (!rebuke && this.trait(d, 'devil')) await this.addStatus(d, 'might', n); break;
      case 'obols': if (!rebuke && ctx.mode === 'demon') { const take = Math.min(n, this.run.obols ?? 0); if (take) { this.obols(-take); await this.say(`-${take} obols`, a); } } break;
      case 'addCard': if (!rebuke) { this.addToDeck(e.id, n); await this.ev('addCards', { id: e.id, n, demon: d }); } break;
      case 'eatTop': if (!rebuke) await this.eatTop(d); break;
      case 'shuffleDeck': if (!rebuke) await this.shuffleDeck(d); break;
      case 'summon': if (!rebuke) await this.summon(d, e.id); break;
      default: break;   // the angel's own verbs (draw, Grace, Foresee…) mean nothing to a demon
    }
  }
  isAttackHeld(d, h) { const x = def(h.card); return threatOf(h.orient === 'up' ? x.up : x.down, 0) > 0 && (h.orient === 'up' ? x.up : x.down).some(e => ['dmg', 'aoe', 'rand', 'perHeld', 'xAoe'].includes(e.k)); }

  /* ---------- hurting and helping ---------- */
  async attack(src, tgt, n, card) {
    if (!tgt.alive) return;
    let v = this.dmgFrom(src, tgt, n, card);
    if (src === this.angel && this.flags.double) v *= 2;
    await this.hurt(tgt, v, src, { attack: true, card });
  }
  async aoe(src, n, o = {}) {
    const targets = this.living();
    await this.ev('aoe', { src, targets, card: o.card });
    for (const d of targets) {
      if (!d.alive) continue;
      let v = o.raw ? n : this.dmgFrom(src, d, n, o.card);
      if (!o.raw && src === this.angel && this.flags.double) v *= 2;
      await this.hurt(d, v, src, { attack: !o.raw, card: o.card, aoe: true });
    }
  }
  // damage that Ward can block
  async hurt(tgt, v, src, o = {}) {
    if (!tgt.alive) return;
    const blocked = Math.min(tgt.ward, v), dealt = v - blocked;
    tgt.ward -= blocked;
    tgt.hp -= dealt;
    if (tgt === this.angel) this.stats.dmgTaken += dealt; else this.stats.dmgDealt += dealt;
    await this.ev('damage', { target: tgt, amount: dealt, blocked, src, attack: !!o.attack, aoe: !!o.aoe, card: o.card });
    if (dealt > 0 && tgt === this.angel) await this.angelLost(dealt, src);
    if (dealt > 0 && tgt.side === 'demon' && o.attack && src === this.angel && this.trait(tgt, 'wrath') && tgt.hp > 0) await this.addStatus(tgt, 'might', 1);
    if (o.attack && src && src !== tgt && src.alive && tgt.st.thorns > 0) { await this.ev('thorns', { from: tgt, to: src }); await this.hurt(src, tgt.st.thorns, null, {}); }
    await this.checkDeath(tgt, src);
    if (tgt.alive && tgt.belly?.length) await this.checkBelly(tgt);
  }
  // HP lost straight through Ward: Burn, sacrifices, Scorching
  async loseHp(tgt, v, o = {}) {
    if (!tgt.alive || v <= 0) return;
    tgt.hp -= v;
    if (tgt === this.angel) this.stats.dmgTaken += v;
    await this.ev('damage', { target: tgt, amount: v, blocked: 0, lose: true, scorch: !!o.scorch, burn: !!o.burn });
    if (tgt === this.angel) await this.angelLost(v, null);
    await this.checkDeath(tgt);
  }
  async angelLost(v, src) {
    if (src && src.side === 'demon') await this.charmHook('hurtBy', src);
    if (this.powers.martyrdom && this.living().length) { await this.ev('say', { text: 'Martyrdom', who: this.angel }); await this.aoe(this.angel, v, { raw: true }); }
  }
  async tickBurn(c) {
    if (c.st.burn > 0 && c.alive) {
      const v = c.st.burn;
      await this.loseHp(c, v, { burn: true });
      c.st.burn = Math.max(0, c.st.burn - 1);
      if (c.alive) await this.ev('status', { target: c, key: 'burn', value: c.st.burn });
    }
  }
  async gainWard(c, n, o = {}) {
    const v = o.raw ? n : this.wardFrom(c, n);
    if (v <= 0 || !c.alive) return;
    c.ward += v;
    await this.ev('ward', { target: c, value: c.ward, gained: v });
  }
  async healAngel(n) { const a = this.angel, v = Math.min(n, a.maxHp - a.hp); if (v <= 0) return; a.hp += v; await this.ev('heal', { target: a, amount: v }); }
  async healDemon(d, n) { const v = Math.min(n, d.maxHp - d.hp); if (v <= 0 || !d.alive) return; d.hp += v; await this.ev('heal', { target: d, amount: v }); }
  async addStatus(c, key, n) {
    if (!c.alive || !n) return;
    c.st[key] = Math.max(0, (c.st[key] ?? 0) + n);
    await this.ev('status', { target: c, key, value: c.st[key], delta: n });
  }
  async gainGrace(n) { this.grace += n; await this.ev('grace', { value: this.grace, gained: n }); }

  async checkDeath(c, src) {
    if (c.hp > 0 || !c.alive) return;
    if (c === this.angel) {
      const ph = this.charms.find(x => x.id === 'phoenix');
      if (ph && !this.run.phoenixUsed) {
        this.run.phoenixUsed = true;
        c.hp = Math.ceil(c.maxHp / 2);
        this.flash('phoenix');
        await this.ev('heal', { target: c, amount: c.hp, phoenix: true });
        return;
      }
      c.alive = false;
      await this.ev('death', { target: c });
      throw new FightOver(false);
    }
    c.alive = false; c.hp = 0;
    await this.ev('death', { target: c });
    // whatever it held or hoarded falls to the discard pile
    for (const h of c.held.splice(0)) { this.discard.push(h.card); await this.ev('discard', { card: h.card, from: 'held', demon: c, dropped: true }); }
    for (const card of c.hoard.splice(0)) { this.discard.push(card); await this.ev('discard', { card, from: 'hoard', demon: c, dropped: true }); }
    for (const card of c.belly.splice(0)) { this.discard.push(card); await this.ev('discard', { card, from: 'belly', demon: c, dropped: true }); }
    const ex = this.trait(c, 'explode');
    if (ex) { await this.say('Bursts!', c); await this.hurt(this.angel, ex.n, null, {}); }
    for (const d of this.living()) if (this.trait(d, 'bond') && this.trait(c, 'bond')) { await this.say('Grief!', d); await this.addStatus(d, 'might', 3); await this.healDemon(d, 15); }
    // a summoner's minions scatter when it dies
    if (this.trait(c, 'summoner')) for (const d of this.living()) if (d.def.minion) { d.hp = 0; await this.checkDeath(d); }
    await this.charmHook('demonDies', c);
    if (this.living().length === 0) throw new FightOver(true);
  }

  /* ---------- the shared deck ---------- */
  addToDeck(id, n) {
    for (let i = 0; i < n; i++) {
      const c = this.temp(id);
      this.deck.splice(this.rng.int(this.deck.length + 1), 0, c);
    }
  }
  async shuffleDeck(who) {
    this.rng.shuffle(this.deck);
    for (const c of this.deck) delete c.seen;
    await this.ev('shuffleDeck', { who });
  }
  async eatTop(d) {
    if (!(await this.refill(d))) return;
    const c = this.deck.pop();
    this.banished.push(c);
    await this.ev('eat', { demon: d, card: c, from: 'deck' });
  }
  // the top n cards: you may discard any; the rest stay on top, face up to you
  async foresee(n) {
    if (!this.deck.length) await this.refill('angel');
    const top = this.deck.slice(-n).reverse();   // top first
    if (!top.length) return;
    for (const c of top) c.seen = true;
    await this.ev('foresee', { cards: top });
    const drop = await this.io.choose({ kind: 'foresee', cards: top, min: 0, max: top.length, prompt: `Foresee ${n}: tap cards to discard them. The rest stay on top, in this order.` }, this) ?? [];
    for (const c of drop) {
      const i = this.deck.indexOf(c); if (i < 0) continue;
      this.deck.splice(i, 1); delete c.seen;
      this.discard.push(c);
      await this.ev('discard', { card: c, from: 'deck' });
    }
    await this.ev('foreseeDone', { kept: top.filter(c => !drop.includes(c)) });
  }
  async offer(n) {
    for (let i = 0; i < n; i++) {
      if (!this.hand.length) return;
      const [c] = await this.io.choose({ kind: 'hand', cards: this.hand.slice(), min: 1, max: 1, verb: 'offer', prompt: 'Offer a card: it goes on top of the deck, and the next demon to draw takes it.' }, this) ?? [];
      if (!c || !this.hand.includes(c)) return;
      this.hand.splice(this.hand.indexOf(c), 1);
      delete c.freeThisTurn;
      c.seen = true;
      this.deck.push(c);
      this.stats.offered++;
      await this.ev('offer', { card: c });
      await this.charmHook('offered', c);
    }
  }
  async recall(n) {
    for (let i = 0; i < n; i++) {
      if (!this.discard.length) return;
      const [c] = await this.io.choose({ kind: 'discard', cards: this.discard.slice().reverse(), min: 1, max: 1, verb: 'recall', prompt: 'Choose a card from the discard pile to put on top of the deck.' }, this) ?? [];
      if (!c || !this.discard.includes(c)) return;
      this.discard.splice(this.discard.indexOf(c), 1);
      c.seen = true;
      this.deck.push(c);
      await this.ev('recall', { card: c });
    }
  }
  async purge(n) {
    for (let i = 0; i < n; i++) {
      if (!this.hand.length) return;
      const [c] = await this.io.choose({ kind: 'hand', cards: this.hand.slice(), min: 1, max: 1, verb: 'banish', prompt: 'Banish a card from your hand for the rest of the fight.' }, this) ?? [];
      if (!c || !this.hand.includes(c)) return;
      this.hand.splice(this.hand.indexOf(c), 1);
      this.banished.push(c);
      await this.ev('banish', { card: c, from: 'hand' });
      await this.charmHook('banished', c);
    }
  }
  // the card a demon holds that you're aiming at: the one you picked, or the one that would hurt you most
  pickHeld(d) {
    if (this.aim && d.held.includes(this.aim)) return this.aim;
    return d.held.slice().sort((x, y) => this.heldThreat(d, y) - this.heldThreat(d, x))[0] ?? null;
  }
  async disarm(d, h) {
    if (!h || !d.held.includes(h)) { await this.say('Empty-handed', d); return; }
    d.held.splice(d.held.indexOf(h), 1);
    this.discard.push(h.card);
    await this.ev('disarm', { demon: d, card: h.card });
  }
  async rebuke(d, h) {
    if (!h || !d.held.includes(h)) { await this.say('Empty-handed', d); return; }
    await this.say('Rebuked!', d);
    d.held.splice(d.held.indexOf(h), 1);
    if (h.hidden) h.hidden = false;
    await this.demonPlay(d, h, 'rebuke');
  }
  async redeem(d) {
    const h = this.pickHeld(d);
    if (!h) { await this.say('Empty-handed', d); return; }
    d.held.splice(d.held.indexOf(h), 1);
    if (this.hand.length >= HAND_MAX) { this.discard.push(h.card); await this.ev('discard', { card: h.card, from: 'held', demon: d }); return; }
    h.card.freeThisTurn = true;
    this.hand.push(h.card);
    await this.ev('redeem', { demon: d, card: h.card });
  }
  async swap(d) {
    const h = this.pickHeld(d);
    if (!h) { await this.say('Empty-handed', d); return; }
    if (!this.hand.length) return this.redeem(d);
    const [c] = await this.io.choose({ kind: 'hand', cards: this.hand.slice(), min: 1, max: 1, verb: 'swap', prompt: `Choose a card to give the ${d.name} in exchange.`, demon: d }, this) ?? [];
    if (!c || !this.hand.includes(c)) return;
    const i = d.held.indexOf(h);
    if (i < 0) return;
    this.hand.splice(this.hand.indexOf(c), 1);
    delete c.freeThisTurn;
    const given = { card: c, orient: this.orientFor(d, c), hidden: h.hidden };
    d.held[i] = given;
    this.hand.push(h.card);
    await this.ev('swap', { demon: d, given: c, taken: h.card, orient: given.orient });
  }
  async summon(by, id) {
    const at = Math.max(0, this.demons.indexOf(by));
    const d = this.addDemon(id);
    await this.ev('summon', { demon: d, by });
    // a newcomer draws its card at once, so it has an intent
    await this.demonDraw(d, this.drawsFor(d));
    return d;
  }

  /* ---------- what a demon's card will do, for the intent badges ---------- */
  forecast(d, h) {
    const x = def(h.card), effects = h.orient === 'up' ? x.up : x.down, a = this.angel;
    const f = { dmg: 0, hits: 0, ward: 0, scorch: 0, heal: 0, burn: 0, might: 0, debuff: [], other: [] };
    if (h.hidden) { f.hidden = true; return f; }
    for (const e of effects) {
      switch (e.k) {
        case 'dmg': case 'aoe': case 'rand': f.dmg = this.dmgFrom(d, a, e.n); f.hits += e.x || 1; break;
        case 'perHeld': f.dmg = this.dmgFrom(d, a, e.n); f.hits += 1; break;
        case 'xAoe': f.dmg = this.dmgFrom(d, a, e.n); f.hits += 2; break;
        case 'ward': f.ward += e.n + d.st.faith; break;
        case 'lose': f.scorch += e.n + (this.hasCharm('saltCellar') && h.orient === 'down' && x.holy ? 3 : 0); break;
        case 'heal': f.heal += e.n; break;
        case 'burn': case 'burnAll': if (e.self) f.other.push('burns itself'); else f.burn += e.n; break;
        case 'expose': case 'exposeAll': f.debuff.push(e.self ? 'self-exposed' : 'exposed'); break;
        case 'shake': f.debuff.push(e.self ? 'self-shaken' : 'shaken'); break;
        case 'might': case 'feedDevil': f.might += e.n; break;
        case 'faith': case 'thorns': f.other.push(e.k); break;
        case 'addCard': f.other.push('adds cards'); break;
        case 'obols': f.other.push('steals'); break;
        case 'shuffleDeck': f.other.push('shuffles'); break;
        case 'kindle': f.burn += a.st.burn; break;
        default: break;
      }
    }
    return f;
  }
  // the damage numbers printed on a card, as whoever holds it would deal them
  modsFor(holder, target) {
    return {
      dmg: n => this.dmgFrom(holder, target ?? (holder === this.angel ? null : this.angel), n),
      ward: n => this.wardFrom(holder, n),
    };
  }
}
