// Spire Keeper — cards, monsters, relics and events.
// Everything here is plain data; sim.js reads it, art.js draws it.

// ---------------------------------------------------------------- Pip's cards
// type: atk | def | pow | curse
// dmg/hits, block, vuln/weak (on enemy), poison, str, draw, energy, heal, selfDmg, exhaust
export const CARDS = {
  strike:   { name: 'Strike',      cost: 1, type: 'atk', dmg: 6, text: 'Deal 6.' },
  defend:   { name: 'Defend',      cost: 1, type: 'def', block: 5, text: 'Block 5.' },
  bonk:     { name: 'Bonk',        cost: 2, type: 'atk', dmg: 8, vuln: 2, text: 'Deal 8. Vulnerable 2.' },

  heavy:    { name: 'Heavy Swing', cost: 2, type: 'atk', dmg: 15, text: 'Deal 15.' },
  twinjab:  { name: 'Twin Jab',    cost: 1, type: 'atk', dmg: 4, hits: 2, text: 'Deal 4 twice.' },
  quickcut: { name: 'Quick Cut',   cost: 0, type: 'atk', dmg: 4, text: 'Deal 4.' },
  shieldbash:{ name: 'Shield Bash',cost: 1, type: 'atk', bash: true, text: 'Deal damage equal to your Block.' },
  reckless: { name: 'Reckless',    cost: 1, type: 'atk', dmg: 13, selfDmg: 3, text: 'Deal 13. Lose 3 HP.' },
  finisher: { name: 'Finisher',    cost: 1, type: 'atk', dmg: 7, finish: 8, text: 'Deal 7, or 15 if the foe is under half.' },
  flurry:   { name: 'Flurry',      cost: 2, type: 'atk', dmg: 3, hits: 5, text: 'Deal 3 five times.' },
  dart:     { name: 'Poison Dart', cost: 1, type: 'atk', dmg: 3, poison: 4, text: 'Deal 3. Poison 4.' },
  uppercut: { name: 'Uppercut',    cost: 2, type: 'atk', dmg: 11, weak: 1, vuln: 1, text: 'Deal 11. Weak 1, Vulnerable 1.' },
  wild:     { name: 'Wild Swing',  cost: 1, type: 'atk', wild: [2, 18], text: 'Deal 2 to 18.' },
  laststand:{ name: 'Last Stand',  cost: 1, type: 'atk', dmg: 6, desperate: 16, text: 'Deal 6, or 22 under a quarter HP.' },

  brace:    { name: 'Brace',       cost: 1, type: 'def', block: 8, text: 'Block 8.' },
  parry:    { name: 'Parry',       cost: 1, type: 'def', block: 6, draw: 1, text: 'Block 6. Draw 1.' },
  ironskin: { name: 'Iron Skin',   cost: 2, type: 'def', block: 15, text: 'Block 15.' },
  bandage:  { name: 'Bandage',     cost: 1, type: 'def', heal: 5, exhaust: true, text: 'Heal 5. Once per fight.' },
  secondwind:{ name: 'Second Wind',cost: 1, type: 'def', block: 5, draw: 2, text: 'Block 5. Draw 2.' },
  adrenaline:{ name: 'Adrenaline', cost: 0, type: 'def', energy: 1, draw: 1, exhaust: true, text: '+1 energy. Draw 1. Once per fight.' },
  cloud:    { name: 'Poison Cloud',cost: 2, type: 'def', poison: 10, text: 'Poison 10.' },
  hex:      { name: 'Hex',         cost: 1, type: 'def', weak: 2, block: 3, text: 'Weak 2. Block 3.' },
  bloodlet: { name: 'Bloodletting',cost: 0, type: 'def', selfDmg: 4, energy: 2, text: 'Lose 4 HP. +2 energy.' },

  rage:     { name: 'Rage',        cost: 1, type: 'pow', str: 2, text: '+2 Strength this fight.' },
  thorns:   { name: 'Thorns',      cost: 1, type: 'pow', thorns: 3, text: 'When hit, deal 3 back.' },
  fortify:  { name: 'Fortify',     cost: 2, type: 'pow', fortify: 4, text: 'Block 4 every turn.' },
  regrow:   { name: 'Regrow',      cost: 2, type: 'pow', regrow: 2, text: 'Heal 2 every turn.' },

  doubt:    { name: 'Doubt',       cost: 99, type: 'curse', text: 'Cursed. Can\'t be played.' },
};
export const STARTER_DECK = ['strike', 'strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'bonk'];
export const REWARD_POOL = Object.keys(CARDS).filter(k => !['strike', 'defend', 'bonk', 'doubt'].includes(k));

// The biggest number on the card: Pip's "shiny card" habit picks by this.
export function shininess(id) {
  const c = CARDS[id];
  let n = 0;
  if (c.dmg) n = Math.max(n, c.dmg * (c.hits || 1) + (c.finish || 0) + (c.desperate || 0));
  if (c.wild) n = Math.max(n, c.wild[1]);
  if (c.block) n = Math.max(n, c.block);
  if (c.poison) n = Math.max(n, c.poison);
  if (c.heal) n = Math.max(n, c.heal);
  if (c.str) n = Math.max(n, c.str * 4);
  if (c.thorns || c.fortify || c.regrow) n = Math.max(n, 6);
  if (c.energy) n = Math.max(n, 5);
  return n;
}

// ---------------------------------------------------------------- Pip's habits
// Shown to the player. The sim's hero AI follows them exactly.
export const HABITS = [
  { key: 'greedy', title: 'Greedy when healthy', text: 'Above half HP, Pip never blocks. Every card goes into hitting.' },
  { key: 'panic', title: 'Panics when low', text: 'Under a quarter HP, Pip plays every heal and block first, even with the foe nearly dead.' },
  { key: 'shiny', title: 'Shiny-card brain', text: 'After a fight Pip always takes the reward with the biggest number on it.' },
];

// ---------------------------------------------------------------- monsters
// moves: a = damage (n = hits), b = block, s = strength, heal, weak/vuln/poison on Pip, sleep
// pattern cycles; `first` (optional) is played once before it.
export const ENEMIES = {
  rat:     { name: 'Gutter Rat',   tier: 1, hp: 20, pattern: [{ a: 5 }, { a: 5 }, { s: 2 }], blurb: 'Nibbles, then gets braver.' },
  jelly:   { name: 'Wobble Jelly', tier: 1, hp: 32, pattern: [{ a: 8 }, { b: 6, a: 4 }], blurb: 'Squishy and patient.' },
  bats:    { name: 'Bat Cloud',    tier: 1, hp: 24, pattern: [{ a: 2, n: 4 }, { a: 2, n: 4 }, { weak: 2 }], blurb: 'Lots of tiny bites.' },
  bones:   { name: 'Bone Lad',     tier: 1, hp: 28, pattern: [{ a: 11 }, { b: 8 }], blurb: 'One big swing, then hides.' },
  shroom:  { name: 'Toadstool',    tier: 1, hp: 34, pattern: [{ poison: 4 }, { a: 7 }], blurb: 'Spores that keep hurting.' },
  chanter: { name: 'Hood Chanter', tier: 2, hp: 42, first: { s: 3 }, pattern: [{ a: 7 }, { a: 7 }, { s: 2 }], blurb: 'Chants itself stronger.' },
  snake:   { name: 'Cave Snake',   tier: 2, hp: 34, pattern: [{ a: 5, weak: 1 }, { a: 15 }], blurb: 'Weakens you, then lunges.' },
  moth:    { name: 'Moth Witch',   tier: 2, hp: 40, pattern: [{ vuln: 2 }, { a: 11 }, { heal: 10 }], blurb: 'Hexes, hits, then patches up.' },
  bucket:  { name: 'Iron Bucket',  tier: 2, hp: 48, pattern: [{ b: 14 }, { a: 15 }], blurb: 'A knight who is mostly armour.' },
  mimic:   { name: 'Mimic',        tier: 2, hp: 46, first: { sleep: 1 }, pattern: [{ sleep: 1 }, { a: 24 }, { a: 24 }], blurb: 'Pretends to be a chest. Wakes up angry.' },
  gargoyle:{ name: 'Gargoyle',     tier: 3, hp: 56, pattern: [{ b: 14 }, { a: 16 }, { a: 6, n: 2 }], blurb: 'Elite. Stone skin, stone fists.', elite: true },
  brute:   { name: 'Big Brute',    tier: 3, hp: 50, pattern: [{ a: 11 }, { a: 7 }, { a: 22 }], blurb: 'Elite. Winds up for a huge one.', elite: true },
  bell:    { name: 'The Bell',     tier: 4, hp: 120, pattern: [{ a: 7, n: 2 }, { b: 14, s: 2 }, { a: 20 }], blurb: 'Boss. Rings, braces, then crushes.', boss: true },
  crown:   { name: 'Hollow Crown', tier: 4, hp: 110, pattern: [{ a: 12 }, { weak: 2, vuln: 2 }, { a: 5, n: 3 }], blurb: 'Boss. A crown with nobody in it.', boss: true },
  eye:     { name: 'Big Eye',      tier: 4, hp: 115, first: { vuln: 2 }, pattern: [{ a: 15 }, { a: 4, n: 4 }, { b: 10, heal: 8 }], blurb: 'Boss. It sees everything.', boss: true },
};
export const TIERS = { 1: [], 2: [], 3: [], 4: [] };
for (const [k, e] of Object.entries(ENEMIES)) TIERS[e.tier].push(k);

export const FLOORS = 15;
export const hpScale = f => 1 + 0.05 * (f - 1);
export const dmgScale = f => 1 + 0.025 * (f - 1);

// ---------------------------------------------------------------- relics
export const RELICS = {
  kettle:   { name: 'Kettle',       text: 'Heal 6 after every fight.' },
  doorstop: { name: 'Doorstop',     text: 'Block 10 on the first turn.' },
  plum:     { name: 'Sour Plum',    text: '+1 Strength in every fight.' },
  candle:   { name: 'Candle Stub',  text: '+1 energy on the first turn.' },
  marble:   { name: 'Lucky Marble', text: 'Foes start Vulnerable 2.' },
  sock:     { name: 'Spare Sock',   text: '+12 max HP, and heal 12.' },
  hourglass:{ name: 'Hourglass',    text: 'Draw 1 extra card every turn.' },
  whistle:  { name: 'Tin Whistle',  text: 'The first attack in each fight hits double.' },
  pillow:   { name: 'Lucky Pillow', text: 'Once per fight, survive a killing blow on 1 HP.' },
  bramble:  { name: 'Bramble',      text: 'When hit, deal 3 back.' },
  glass:    { name: 'Glass Fist',   text: '+3 Strength, but -15 max HP.' },
  mirror:   { name: 'Cracked Mirror', text: '+1 energy every turn, but start each fight Vulnerable 2.' },
  inkpot:   { name: 'Ink Pot',      text: 'Poison you apply is +2.' },
  sand:     { name: 'Pocket Sand',  text: 'Foes start Weak 2.' },
  scarf:    { name: 'Cosy Scarf',   text: 'Block 4 at the start of every turn.' },
};

// ---------------------------------------------------------------- events
export const EVENTS = {
  campfire: { name: 'Campfire',     text: 'Pip rests. Heal 30% of max HP.', hype: -6 },
  shrine:   { name: 'Blood Shrine', text: 'Pip pays 12 HP for a rare card.', hype: 6 },
  well:     { name: 'Wishing Well', text: 'A coin toss: a free relic, or a 14 HP tumble.', hype: 6 },
  altar:    { name: 'Cursed Altar', text: 'A free relic, and a Doubt curse in the deck.', hype: 4 },
  barber:   { name: 'Barber',       text: 'Trims two Strikes (or a Doubt) from the deck.', hype: -2 },
};
export const RARES = ['flurry', 'heavy', 'ironskin', 'rage', 'fortify', 'regrow', 'laststand', 'uppercut'];
