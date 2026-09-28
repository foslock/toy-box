// How good a choice is likely to turn out, as one number. Foresight uses it to tell a good omen from an ill one, the
// stand-in player (autoplay.js) uses it to choose, and the content checker (events/check.mjs) uses it to keep the two
// sides of every choice close enough that neither is obviously right. Worth is roughly "gold's worth": a loaf is about
// 5, a point of health about 12, dying is -150.
import { ITEMS, RELICS, TRAITS, FOES, REALMS, DICE } from './rules.js';

// Chance of winning a fight: your power + 2d6 against theirs + 2d6, ties to you. delta = your power − theirs.
const DIFF = (() => {           // distribution of (your dice − their dice)
  const n = 6 ** (DICE * 2), counts = {};
  const faces = [];
  for (let i = 0; i < n; i++) { let s = 0, k = i; for (let d = 0; d < DICE * 2; d++) { s += (k % 6 + 1) * (d < DICE ? 1 : -1); k = Math.floor(k / 6); } counts[s] = (counts[s] || 0) + 1; }
  for (const [s, c] of Object.entries(counts)) faces.push([+s, c / n]);
  return faces;
})();
export function winChance(delta) {
  let p = 0;
  for (const [d, q] of DIFF) if (d + delta >= 0) p += q;
  return p;
}

const TRAIT_WORTH = { reaper: -45, toad: -30, wendigo: -30, twin_step: -22, glass_bones: -20, ill_luck: -20, veil: -18, oathbreaker: -18,
  leaden_purse: -15, weathervane: -10, wolfblood: 8, midas: -4, knighted: 30, royal_blood: 30, dragonblood: 30, stout_heart: 28 };

// s: what the character is like right now: { hp, maxHp, food, gold, power, weapon, armor (powers of what's carried),
// cursed, warded (curses can't land), traits (Set), relics (Set), realm, oath }
export function outcomeWorth(o, s) {
  if (!o) return 0;
  let v = 0;
  const realm = REALMS[s.realm] || {};
  if (o.die) return -150;
  if (o.gold > 0) v += o.gold * .5 * (s.traits?.has('leaden_purse') ? .5 : 1) * (s.traits?.has('midas') ? 2 : 1);
  if (o.gold < 0) v -= Math.min(-o.gold * (realm.lossMul || 1), s.gold) * .5;
  if (o.pay) { const p = Math.round(o.pay * (realm.payMul || 1)); v += s.gold >= p ? -p * .6 : -150; }
  // A loaf is worth more the hungrier you are.
  const loaf = s.food <= 0 ? 13 : s.food <= 1 ? 10 : s.food <= 2 ? 8 : s.food <= 4 ? 6 : 4;
  if (o.food > 0) v += s.traits?.has('midas') ? o.food * 1.5 : Math.max(0, o.food - (o.food >= 3 ? realm.foodCut || 0 : 0)) * loaf;
  if (o.food < 0) { const left = s.food + o.food; v -= left >= 0 ? -o.food * loaf : s.food * loaf + -left * 12; }
  if (o.hp > 0) v += Math.min(o.hp, s.maxHp - s.hp) * (s.hp <= 2 ? 14 : 10);
  if (o.hp < 0) { const h = -o.hp + (realm.hurt || 0); v += s.hp - h <= 0 ? -150 : -h * (s.hp <= 2 ? 16 : 12); }
  if (o.maxhp) v += o.maxhp * 14;
  if (o.renown) v += o.renown * 3;
  if (o.claim) v += o.claim * 12;
  if (o.sight) v += o.sight * 6;
  if (o.item) { const it = ITEMS[o.item]; if (it) v += Math.max(0, it.power - (s[it.slot] ?? 0)) * 10; }
  if (o.relic) {
    const r = o.relic === 'random' ? 'common' : o.relic === 'rare' ? 'rare' : RELICS[o.relic]?.tier;
    v += r === 'legend' ? 45 : r === 'rare' ? 30 : 18;
  }
  if (o.trait) {
    const t = TRAITS[o.trait];
    if (t) v += t.kind === 'curse' && s.warded ? 0 : TRAIT_WORTH[o.trait] ?? (t.kind === 'blessing' ? 25 : t.kind === 'curse' ? -25 : 5);
  }
  if (o.lift) v += s.cursed ? 25 : 2;
  if (o.ally) v += s.oath ? 0 : 12;
  if (o.fight) v += fightWorth(o.fight, s);
  if (o.crown) v += 200;
  if (o.treasury) v += o.treasury * .15;
  if (o.heir) v += (o.heir.ally ? 5 : 0) + (o.heir.renown || 0) * 2 + (o.heir.gold || 0) * .25;
  return v;
}

export function fightWorth(f, s) {
  const realm = REALMS[s.realm] || {};
  const kind = FOES[f.foe]?.kind;
  if (kind === 'beast' && s.traits?.has('beast_tongue')) return outcomeWorth(f.win, s) + 4;
  const bonus = (s.relics?.has('horseshoe') ? 1 : 0) + (kind === 'undead' && s.relics?.has('salt') ? 4 : 0);
  const p = winChance(s.power + bonus - f.power - (realm.foePower || 0));
  const dmg = Math.max(0, (f.dmg ?? 1) + (realm.hurt || 0) - (s.relics?.has('dragon_scale') ? 1 : 0));
  const hurt = s.hp - dmg <= 0 ? -150 : -dmg * (s.hp <= 2 ? 16 : 12);
  const spoils = kind === 'beast' ? 10 : kind === 'undead' ? 3 : f.power * 1.2 * .5 + 4;
  return p * (outcomeWorth(f.win, s) + 6 + spoils + (f.elite ? 30 : 0)) + (1 - p) * (outcomeWorth(f.lose, s) + hurt);
}

// An option as a whole: its price, then its fight or the average of what might happen.
export function optionWorth(opt, s) {
  if (!opt) return 0;
  let v = 0;
  if (opt.cost) {
    const cost = priceFor(opt.cost, s);
    if (s.gold < cost) return outcomeWorth(opt.poor, s) - 2;
    v -= cost * .5;
    s = { ...s, gold: s.gold - cost };
  }
  if (opt.odds) { const p = oddsFor(opt.odds, s); return v + p * outcomeWorth(opt.win, s) + (1 - p) * outcomeWorth(opt.lose, s); }
  if (opt.fight) return v + fightWorth(opt.fight, s);
  if (opt.shop) v += 10 + Math.min(s.gold, 40) * .2;
  const outs = opt.out || [];
  const tot = outs.reduce((a, o) => a + (o.w ?? 1), 0) || 1;
  for (const o of outs) v += (o.w ?? 1) / tot * outcomeWorth(o, s);
  return v;
}

// A price after the Merchant's Seal, a silver tongue, or being a toad.
export function priceFor(n, s) {
  let k = 1;
  if (s.relics?.has('merchant_seal')) k *= .75;
  if (s.traits?.has('silver_tongue')) k *= .75;
  if (s.traits?.has('toad')) k *= 2;
  return Math.max(1, Math.round(n * k));
}

// The chance a bid for the crown comes off (succession choices use odds instead of dice).
// odds: { base, renown, claim, power, gold, ally: {id: bonus}, relic: {id: bonus}, trait: {id: bonus}, talk }
export function oddsFor(odds, s) {
  let p = odds.base ?? .5;
  if (odds.renown) p += odds.renown * Math.min(s.renown ?? 0, 12);
  if (odds.claim) p += odds.claim * (s.claim ?? 0);
  if (odds.power) p += odds.power * ((s.power ?? 0) - (odds.vs ?? 8));
  for (const [id, b] of Object.entries(odds.ally || {})) if (s.allies?.has(id)) p += b;
  for (const [id, b] of Object.entries(odds.relic || {})) if (s.relics?.has(id)) p += b;
  for (const [id, b] of Object.entries(odds.trait || {})) if (s.traits?.has(id)) p += b;
  if (odds.talk && s.traits?.has('silver_tongue')) p += odds.talk;
  return Math.max(.05, Math.min(.95, p));
}

// A typical character at each stage of the road, for weighing content with no real character to hand.
export const TYPICAL = {
  1: { hp: 4, maxHp: 5, food: 4, gold: 15, power: 4, weapon: 1, armor: 0, renown: 1, realm: 'old' },
  2: { hp: 4, maxHp: 5, food: 3, gold: 25, power: 7, weapon: 3, armor: 1, renown: 3, realm: 'old' },
  3: { hp: 3, maxHp: 5, food: 3, gold: 35, power: 9, weapon: 4, armor: 2, renown: 5, realm: 'old' },
};
