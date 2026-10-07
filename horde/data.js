// Horde: the numbers. Your monsters, the six heroes (one a night), the hero's weapons and charms, and how
// essence, experience and the night's clock run. Everything here is plain data so the balance runs can share it.

export const NIGHT_LEN = 300;          // seconds from dusk to dawn
export const MAX_LEVEL = 20;           // a hero who reaches this ascends, and nothing can touch them
export const xpNeed = lv => 5 + lv * 3;   // experience from level lv to lv + 1

export const ESSENCE = {
  start: 30, cap: 250, r0: 2, r1: 12,
  rate(t) { return this.r0 + (this.r1 - this.r0) * Math.min(1, t / NIGHT_LEN); },   // per second: the night deepens
  bounty: 0.3,                                         // essence back for every point of the hero's blood
};
export const MOB_CAP = 3000;   // the most the ground will give up at once
// the night deepens: anything raised later comes up tougher and hits harder
export const DEEP = { hp: 0.4, dmg: 0.2 };
export const deep = t => ({ hp: 1 + DEEP.hp * t / 60, dmg: 1 + DEEP.dmg * t / 60 });

// what you can raise. cost buys `n` of them; xp is what each one is worth to the hero when it dies
export const MOBS = {
  imp:    { name: 'Imps', one: 'imp', n: 20, cost: 10, hp: 4.5, spd: 30, r: 3.5, dmg: 1, mass: 1, xp: 0.09, threat: 0.4,
            blurb: 'Twenty to a summons, cheap and quick. Every one the hero kills is a gem for it.' },
  brute:  { name: 'Brute', one: 'brute', n: 1, cost: 25, hp: 150, spd: 18, r: 7, dmg: 8, mass: 10, xp: 4, threat: 3,
            blurb: 'Slow, huge, hits hard. Hard to push past.' },
  bloat:  { name: 'Bloater', one: 'bloater', n: 1, cost: 12, hp: 18, spd: 19, r: 5, dmg: 0, boom: 22, boomR: 26, mass: 2, xp: 1, threat: 4,
            blurb: 'Bursts when it touches the hero, or when it\u2019s killed. Pop it close.' },
  bat:    { name: 'Bats', one: 'bat', n: 12, cost: 12, hp: 3, spd: 52, r: 3, dmg: 1, mass: 0.5, xp: 0.1, threat: 0.3, evade: 0.55,
            blurb: 'A dozen of them, fast and erratic. They dodge thrown things more often than not.' },
  shield: { name: 'Shieldbearer', one: 'shieldbearer', n: 1, cost: 18, hp: 60, spd: 22, r: 5.5, dmg: 2, mass: 6, xp: 2, threat: 1.2,
            blurb: 'Blocks knives, fireballs and axes for whoever walks behind it.' },
  hag:    { name: 'Hag', one: 'hag', n: 1, cost: 28, hp: 40, spd: 24, r: 4.5, dmg: 0, mass: 1, xp: 3, threat: 0.5, heal: 4, healR: 34, healEvery: 0.8, keep: 58,
            blurb: 'Hangs back and mends everything around her.' },
};
export const MOB_ORDER = ['imp', 'brute', 'bloat', 'bat', 'shield', 'hag'];

/* --------------------------------------------------------------------------------------------- the hero's kit */
// each weapon: base numbers, then what every level from 2 to 5 adds. `proj` ones can be blocked by shields and dodged by bats
export const WEAPONS = {
  whip:   { name: 'Whip', base: { cd: 1.3, dmg: 12, len: 46, h: 16, kb: 70, both: 0 },
            up: [{ dmg: 5 }, { both: 1 }, { dmg: 5, len: 8, h: 3 }, { cd: -0.25, dmg: 6 }], desc: ['a lash to one side', '+5 damage', 'lashes both sides', '+5 damage, longer', 'faster, +6 damage'] },
  books:  { name: 'Psalter', base: { n: 1, rad: 30, spin: 3.4, on: 3, off: 2.6, dmg: 9, kb: 40, rehit: 0.45 },
            up: [{ n: 1 }, { rad: 6, dmg: 3 }, { n: 1 }, { on: 1.5, n: 1 }], desc: ['books that circle', '+1 book', 'wider, +3 damage', '+1 book', 'longer, +1 book'] },
  knife:  { name: 'Knives', proj: 1, base: { cd: 0.6, n: 1, dmg: 8, spd: 200, pierce: 2, kb: 20, range: 110 },
            up: [{ n: 1 }, { n: 1, dmg: 2 }, { pierce: 1 }, { n: 1, cd: -0.1 }], desc: ['thrown at the nearest', '+1 knife', '+1 knife, +2 damage', 'goes through one more', '+1 knife, faster'] },
  fire:   { name: 'Fire Wand', proj: 1, base: { cd: 1.5, n: 1, dmg: 14, spd: 110, aoe: 14, aoeDmg: 8, range: 100 },
            up: [{ n: 1 }, { dmg: 6, aoeDmg: 3 }, { n: 1 }, { aoe: 7, dmg: 8 }], desc: ['fireballs that burst', '+1 fireball', '+6 damage', '+1 fireball', 'bigger bursts, +8 damage'] },
  axe:    { name: 'Axes', proj: 1, base: { cd: 1.7, n: 1, dmg: 20, pierce: 5, kb: 30 },
            up: [{ n: 1 }, { dmg: 8 }, { n: 1, pierce: 3 }, { n: 1, dmg: 8 }], desc: ['thrown high, falling hard', '+1 axe', '+8 damage', '+1 axe, goes through more', '+1 axe, +8 damage'] },
  garlic: { name: 'Garlic', base: { r: 20, tick: 0.5, dmg: 4, kb: 35 },
            up: [{ r: 4 }, { dmg: 2 }, { r: 5 }, { dmg: 3, r: 4 }], desc: ['a stink that burns', 'wider', '+2 damage', 'wider', 'wider, +3 damage'] },
  water:  { name: 'Holy Water', base: { cd: 3.2, n: 1, r: 15, dur: 2.6, tick: 0.35, dmg: 5, range: 90 },
            up: [{ n: 1 }, { r: 4, dur: 0.8 }, { n: 1 }, { dmg: 3, r: 4 }], desc: ['flasks that burn the ground', '+1 flask', 'bigger, lasts longer', '+1 flask', 'bigger, +3 damage'] },
  bolt:   { name: 'Lightning', base: { cd: 2.2, n: 1, dmg: 16, aoe: 9, range: 100 },
            up: [{ n: 1 }, { dmg: 5 }, { n: 1, cd: -0.3 }, { n: 1, aoe: 4 }], desc: ['strikes from the sky', '+1 strike', '+6 damage', '+1 strike, faster', '+2 strikes, wider'] },
};
export const PASSIVES = {
  armor:  { name: 'Plate', max: 5, desc: '+1 armour: every hit does a little less' },
  heart:  { name: 'Hollow Heart', max: 5, desc: '+20% most health' },
  regen:  { name: 'Rosary', max: 5, desc: 'heals 0.35 a second' },
  wings:  { name: 'Wings', max: 5, desc: '+10% speed' },
  might:  { name: 'Oath', max: 5, desc: '+10% damage' },
  tome:   { name: 'Tome', max: 5, desc: 'weapons 8% quicker' },
  magnet: { name: 'Lodestone', max: 5, desc: 'gems come from further' },
  candle: { name: 'Candelabra', max: 5, desc: '+10% area, a wider light' },
  amount: { name: 'Twin Rings', max: 2, desc: '+1 of every thrown thing' },
};
export const BREAD = { name: 'Bread & Wine', desc: 'heals 30' };
export const SLOTS = 4;   // weapons, and charms, each
export const BODY = { hero: 4, cd: 0.9 };   // how hard the hero shoves through a crowd; how often each monster can bite

/* --------------------------------------------------------------------------------------------- the heroes */
// keep: how close it lets things get before it runs; greed: how much it goes after gems; prefs: its build path
export const HEROES = [
  { id: 'squire', name: 'Aldous', title: 'a squire', night: 'The Crossroads', setting: 'crossroads',
    hp: 95, spd: 40, armor: 0, regen: 0, light: 54, keep: 26, greed: 1.0, start: ['whip'],
    prefs: { whip: 5, armor: 4, heart: 3, garlic: 2, wings: 1.5, might: 1 },
    lede: 'Out on his first errand with a borrowed whip. Brave, and slow to learn.',
    tells: 'Loves his whip. Buys plate when he’s hurt.', unlock: ['imp', 'brute'] },
  { id: 'nun', name: 'Sister Ysolde', title: 'of the Lantern Order', night: 'The Churchyard', setting: 'churchyard',
    hp: 195, spd: 38, armor: 0, regen: 0.2, light: 56, keep: 30, greed: 0.9, start: [['books', 2]],
    prefs: { books: 5, water: 4, heart: 3, regen: 2.5, candle: 2, armor: 1 },
    lede: 'Reads from a psalter that won’t stay in her hands. Its pages circle her.',
    tells: 'Books first, then holy water on the ground. Keep your flag out of the puddles.', unlock: ['bloat'] },
  { id: 'huntress', name: 'Mira Vane', title: 'huntress', night: 'The Birch Wood', setting: 'birches',
    hp: 130, spd: 47, armor: 0, regen: 0, light: 52, keep: 64, greed: 1.3, start: [['knife', 2]], startP: { wings: 1 },
    prefs: { knife: 5, wings: 4, amount: 4, tome: 3, magnet: 2, axe: 2 },
    lede: 'Never stands still. Throws knives at whatever is closest.',
    tells: 'All knives, all the time, and she’s quick. Bats dodge knives.', unlock: ['bat'] },
  { id: 'magister', name: 'Magister Corvin', title: 'pyromancer', night: 'The Burnt Mill', setting: 'mill',
    hp: 200, spd: 38, armor: 0, regen: 0, light: 58, keep: 50, greed: 1.0, start: ['fire'],
    prefs: { fire: 5, axe: 4, candle: 3, might: 3, amount: 2, tome: 2 },
    lede: 'A fire wand and a bad temper. His fireballs burst on the first thing they touch.',
    tells: 'Fire, then axes. Both are thrown, and a shield stops both.', unlock: ['shield'] },
  { id: 'friar', name: 'Brother Tuck', title: 'of the abbey kitchens', night: 'The Abbey Garden', setting: 'abbey',
    hp: 220, spd: 32, armor: 1, regen: 0.6, light: 54, keep: 18, greed: 0.8, start: ['garlic'],
    prefs: { garlic: 5, regen: 4, water: 4, heart: 3, armor: 3, books: 1 },
    lede: 'Smells powerfully of garlic. Heals as he walks, and walks slowly.',
    tells: 'Garlic and holy water wear a crowd down. Keep it fed with a hag behind it.', unlock: ['hag'] },
  { id: 'saint', name: 'Saint Lucia', title: 'of the Dawn Road', night: 'The Dawn Road', setting: 'dawnroad',
    hp: 150, spd: 41, armor: 1, regen: 0.3, light: 60, keep: 34, greed: 1.0, start: ['bolt', 'whip'],
    prefs: { bolt: 5, whip: 4, books: 3, armor: 3, might: 3, candle: 2, heart: 2 },
    lede: 'Calls the lightning down. Has done this before, and knows how it ends.',
    tells: 'Lightning finds crowds. Spread out, and come from every side at once.', unlock: [] },
];

// what a night lets you raise: everything unlocked up to and including it
export const roster = night => HEROES.slice(0, night).flatMap(h => h.unlock);
export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
