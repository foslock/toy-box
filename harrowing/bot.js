// A simple player for the balance sim and the demo: it plays greedily from a rough sense of what each card is worth
// right now (how much damage is coming, who's holding what), feeds curses and Holy cards to the demons, and makes
// sensible choices on the map. It isn't clever, so a person who thinks about the deck should do better.
import { CARDS, def, cardCost, threatOf } from './cards.js';
import { ROWS } from './run.js';
import { CHARMS } from './charms.js';

export const SCORE = {
  smite: 1, ward: 1, holyWater: 3, offering: 2,
  searingLight: 6, flamingSword: 5, thunderclap: 5, twinBlades: 4, lance: 4, wingBuffet: 5, stigmata: 6, firstLight: 6,
  shieldFaith: 5, hymn: 5, glimpse: 4, consecrate: 6, saltCircle: 5, disarm: 6, manna: 6, vigil: 5, feather: 4, trumpetCall: 4, censer: 6, divineOrder: 3,
  rebuke: 8, redemption: 7, exchange: 6, archSpear: 7, kindle: 4, trumpetBlast: 6, guardianWings: 7, sacrifice: 5, revelation: 5, hosanna: 7,
  haloFlame: 7, sanctusBell: 5, armorLight: 6, burningBush: 5, martyrsFlame: 6, purify: 6, heavenlyHost: 6, ascension: 4, weighing: 6,
  angelus: 9, wrathHeaven: 8, pillarFire: 8, prophecy: 4, sanctuary: 6, martyrdom: 6, lastJudgment: 8, seraphForm: 7, resurrection: 6, exodus: 7,
  tongues: 8, greatSword: 6, covenant: 4, choir: 6,
};
const isBadForMe = c => { const d = def(c); return d.unplayable || d.type === 'curse' || d.type === 'status'; };
// how bad it is for a demon to get this card (reversed): negative is good for you
const demonValue = (c, might = 1) => { const d = def(c); return threatOf(d.down, might); };

export class Bot {
  constructor(o = {}) { this.skill = o.skill ?? 1; this.delay = o.delay ?? 0; this.sleep = o.sleep ?? (() => Promise.resolve()); }

  /* ---------- fights ---------- */
  incoming(b) {
    let dmg = 0;
    for (const d of b.living()) for (const h of d.held) { const f = b.forecast(d, h); dmg += f.dmg * f.hits + f.burn * .5; if (f.hidden) dmg += 8; }
    dmg += b.angel.st.burn;
    return dmg;
  }
  async turn(b) {
    for (let guard = 0; guard < 40 && !b.result; guard++) {
      const best = this.bestPlay(b);
      if (!best || best.score <= 0) break;
      await this.sleep();
      await b.play(best.card, best.target);
    }
  }
  bestPlay(b) {
    const a = b.angel, demons = b.living();
    const incoming = Math.max(0, this.incoming(b) - a.ward);
    let best = null;
    for (const card of b.hand) {
      if (!b.canPlay(card)) continue;
      const d = def(card), cost = Math.max(0, cardCost(card, b)), costW = cost < 0 ? b.grace : cost;
      const targets = b.needsTarget(card) ? demons : [null];
      for (const t of targets) {
        let s = this.value(b, card, d, t, incoming);
        s = s / (1 + costW * .9) + (costW === 0 ? .4 : 0);
        if (!best || s > best.score) best = { card, target: t, score: s };
      }
    }
    return best;
  }
  value(b, card, d, t, incoming) {
    const a = b.angel;
    let s = 0;
    const threatOfDemon = x => x.held.reduce((sum, h) => { const f = b.forecast(x, h); return sum + f.dmg * f.hits + (f.hidden ? 8 : 0) + f.might * 3; }, 0);
    for (const e of d.up) {
      switch (e.k) {
        case 'dmg': case 'perHeld': {
          if (!t) break;
          const per = b.dmgFrom(a, t, e.k === 'perHeld' ? e.n * b.living().reduce((s2, x) => s2 + x.held.length, 0) : e.n, card);
          const total = per * (e.x || 1);
          const eff = Math.max(0, total - t.ward);
          s += Math.min(eff, t.hp) * .9;
          if (eff >= t.hp) s += 6 + threatOfDemon(t) * 1.2;
          break;
        }
        case 'aoe': case 'xAoe': for (const x of b.living()) { const n = e.k === 'xAoe' ? b.grace : (e.x || 1); const eff = Math.max(0, b.dmgFrom(a, x, e.n, card) * n - x.ward); s += Math.min(eff, x.hp) * .9; if (eff >= x.hp) s += 6 + threatOfDemon(x); } break;
        case 'rand': s += e.n * e.x * .75; break;
        case 'ward': s += Math.min(b.wardFrom(a, e.n), incoming) * 1.05 + (b.powers.sanctuary ? e.n * .5 : 0); break;
        case 'nextWard': s += e.n * .5; break;
        case 'heal': s += Math.min(e.n, a.maxHp - a.hp) * .7; break;
        case 'lose': s -= e.n * (a.hp < 20 ? 2 : .8); break;
        case 'burn': if (t) s += Math.min(e.n * 2, t.hp) * .7; break;
        case 'burnAll': s += b.living().reduce((s2, x) => s2 + Math.min(e.n * 2, x.hp) * .6, 0); break;
        case 'expose': if (t) s += 3 * e.n; break;
        case 'exposeAll': s += 2 * e.n * b.living().length; break;
        case 'shake': if (t) s += 2 * e.n; break;
        case 'might': s += 5 * e.n * Math.max(.3, 1 - b.turn * .08); break;
        case 'faith': s += 4 * e.n * Math.max(.3, 1 - b.turn * .08); break;
        case 'thorns': s += 2.5 * e.n * Math.max(.3, 1 - b.turn * .08); break;
        case 'draw': s += 2.2 * e.n; break;
        case 'grace': s += 3 * e.n; break;
        case 'foresee': s += 1.5; break;
        case 'offer': { const fodder = b.hand.filter(c => c !== card); s += fodder.length ? Math.max(0, 4 - Math.min(...fodder.map(c => demonValue(c)))) * .8 : -1; break; }
        case 'recall': s += 1; break;
        case 'purge': s += b.hand.some(c => c !== card && isBadForMe(c)) ? 5 : -2; break;
        case 'disarm': if (t && (!e.if || t.held.some(h => b.isAttackHeld(t, h)))) s += threatOfDemon(t) * .95 - 1; break;
        case 'disarmAll': s += b.living().reduce((s2, x) => s2 + threatOfDemon(x), 0) * .9; break;
        case 'rebuke': if (t) { s += threatOfDemon(t) * 1.6 + t.held.reduce((s2, h) => s2 + b.forecast(t, h).scorch * -.6, 0) - 1; } break;
        case 'rebukeAll': s += b.living().reduce((s2, x) => s2 + threatOfDemon(x) * 1.6, 0); break;
        case 'redeem': if (t) s += threatOfDemon(t) * .9 + (t.held.length ? 2 : -5); break;
        case 'swap': if (t) { const give = b.hand.filter(c => c !== card); s += give.length ? threatOfDemon(t) - Math.min(...give.map(c => demonValue(c, t.st.might))) : -3; } break;
        case 'kindle': if (t) s += t.st.burn * 1.5; break;
        case 'power': s += (b.turn <= 2 ? 9 : 5); break;
        case 'obols': s += 2; break;
        case 'feedDevil': s -= 4; break;
        default: break;
      }
    }
    if (d.type === 'power') s += 2;
    return s;
  }
  // choices in the middle of a card
  async choose(req, b) {
    await this.sleep();
    if (req.kind === 'foresee') {
      // throw away what would hurt you in a demon's hand; keep Holy cards and curses on top for them
      return req.cards.filter(c => demonValue(c) >= 6 && !isBadForMe(c));
    }
    if (req.kind === 'hand') {
      const cards = req.cards;
      if (req.verb === 'offer' || req.verb === 'swap') {
        // give away what's worst for a demon to have
        return [cards.slice().sort((x, y) => demonValue(x) - demonValue(y) + (isBadForMe(x) ? -3 : 0) - (isBadForMe(y) ? -3 : 0))[0]];
      }
      if (req.verb === 'banish') return [cards.slice().sort((x, y) => (isBadForMe(y) ? 10 : -(SCORE[y.id] ?? 3)) - (isBadForMe(x) ? 10 : -(SCORE[x.id] ?? 3)))[0]];
      return [cards[0]];
    }
    if (req.kind === 'discard') {
      return [req.cards.slice().sort((x, y) => demonValue(x) - demonValue(y))[0]];
    }
    return [];
  }

  /* ---------- the map and the run ---------- */
  pickNode(run, choices) {
    const hpf = run.hp / run.maxHp;
    const score = n => {
      switch (n.type) {
        case 'rest': return hpf < .5 ? 10 : 3;
        case 'elite': return hpf > .75 && run.deck.length > 11 ? 6 : hpf > .6 ? 2 : -5;
        case 'shop': return run.obols >= 150 ? 6 : 1;
        case 'treasure': return 9;
        case 'event': return 4;
        case 'fight': return hpf > .4 ? 5 : 2;
        default: return 5;
      }
    };
    return choices.slice().sort((a, b) => score(b) - score(a) + (Math.random() - .5) * .5)[0];
  }
  pickCard(run, cards) {
    const deckSize = run.deck.length;
    const best = cards.slice().sort((a, b) => (SCORE[b.id] ?? 3) + (b.plus ? 1 : 0) - (SCORE[a.id] ?? 3) - (a.plus ? 1 : 0))[0];
    const sc = (SCORE[best.id] ?? 3) + (best.plus ? 1 : 0);
    return sc >= (deckSize > 22 ? 7 : deckSize > 16 ? 6 : 4) ? best : null;
  }
  restChoice(run) { return run.canRest() && run.hp / run.maxHp < .6 ? 'rest' : 'bless'; }
  blessTarget(run) {
    const options = run.deck.filter(c => CARDS[c.id].plus && !c.plus);
    return options.sort((a, b) => (SCORE[b.id] ?? 2) - (SCORE[a.id] ?? 2))[0];
  }
  removeTarget(run) {
    const curse = run.deck.find(c => ['curse'].includes(CARDS[c.id].type));
    return curse ?? run.deck.find(c => c.id === 'smite') ?? run.deck.find(c => c.id === 'ward') ?? run.deck[0];
  }
  shop(run, stock) {
    const buys = [];
    if (!stock.removed && run.obols >= stock.remove && (run.deck.some(c => CARDS[c.id].type === 'curse') || run.deck.filter(c => c.id === 'smite').length > 2)) {
      run.obols -= stock.remove; run.removeCard(this.removeTarget(run)); run.removeCost += 25; stock.removed = true; buys.push('remove');
    }
    for (const ch of stock.charms.slice().sort((a, b) => a.price - b.price)) if (run.obols >= ch.price + 20) { run.obols -= ch.price; run.addCharm(ch.id); buys.push(ch.id); stock.charms.splice(stock.charms.indexOf(ch), 1); }
    for (const it of stock.cards.slice().sort((a, b) => (SCORE[b.card.id] ?? 3) - (SCORE[a.card.id] ?? 3))) {
      if ((SCORE[it.card.id] ?? 3) >= 6 && run.obols >= it.price) { run.obols -= it.price; run.addCard(it.card); buys.push(it.card.id); stock.cards.splice(stock.cards.indexOf(it), 1); }
    }
    return buys;
  }
  eventChoice(run, choices) {
    const ok = choices.filter(c => !c.disabled);
    // prefer things without curses or fights unless healthy
    const scored = ok.map(c => {
      let s = 1;
      if (/curse|Guilt|Doubt|Regret|Burden|Avarice/i.test(c.detail)) s -= 2;
      if (/Lose \d+ HP/.test(c.detail) && run.hp / run.maxHp < .5) s -= 3;
      if (/fight/i.test(c.detail)) s += run.hp / run.maxHp > .8 ? 1 : -4;
      if (/charm|rare|Bless|Remove/i.test(c.detail)) s += 2;
      if (/Heal/.test(c.detail)) s += run.hp / run.maxHp < .6 ? 3 : 0;
      return { c, s };
    });
    return scored.sort((a, b) => b.s - a.s)[0].c;
  }
  bossCharm(run, ids) { return ids.slice().sort((a, b) => (CHARMS[b].grace ?? 0) - (CHARMS[a].grace ?? 0))[0]; }
}
