// The rules of the realm: how long a life's road is, what you start with, the arms and armour you can carry, relics,
// blessings and curses, allies, the powers a bloodline can buy, the foes you can meet and the three states the kingdom
// can be in. Shared by a life (game.js), the page (main.js) and the headless balance runs (balance.mjs), so a number
// changed here changes it everywhere.

export const JOURNEY = 12;                  // choices before you're in line for the throne
export const SUCCESSION = 5;                // choices in the fight for the crown
export const PROCESSION = 4;                // choices on the way to the throne, once the crown is yours
export const CROWN_ROW = JOURNEY + SUCCESSION;          // where the crown is won or lost
export const ROWS = CROWN_ROW + PROCESSION;             // rows of choices above the crossroads: the last is the throne
export const tierOf = row => row <= 4 ? 1 : row <= 8 ? 2 : 3;   // the row you're stepping onto → how hard the road is

export const START = { hp: 5, food: 6, gold: 12, power: 3, weapon: 'staff', armor: 'rags' };
export const MAX_SIGHT = 9;

/* ---------- arms and armour: power adds to your side of every fight ---------- */
export const WEAPONS = {
  staff:      { name: 'Walking Staff', power: 1 },
  dagger:     { name: 'Rusty Dagger', power: 2 },
  heirloom1:  { name: 'Heirloom Sword', power: 2, heirloom: true },
  axe:        { name: 'Woodcutter’s Axe', power: 3 },
  spear:      { name: 'Boar Spear', power: 3 },
  bow:        { name: 'Hunting Bow', power: 3 },
  heirloom2:  { name: 'Heirloom Sword', power: 3, heirloom: true },
  mace:       { name: 'Flanged Mace', power: 4 },
  longsword:  { name: 'Longsword', power: 4 },
  heirloom3:  { name: 'Heirloom Sword', power: 4, heirloom: true },
  warhammer:  { name: 'Warhammer', power: 5 },
  lance:      { name: 'Knight’s Lance', power: 5 },
  elvenblade: { name: 'Elven Blade', power: 6 },
  runeblade:  { name: 'Runed Greatsword', power: 7 },
  dragonbone: { name: 'Dragonbone Sword', power: 8 },
};
export const ARMOR = {
  rags:     { name: 'Travelling Clothes', power: 0 },
  jerkin:   { name: 'Padded Jerkin', power: 1 },
  leather:  { name: 'Boiled Leather', power: 2 },
  chain:    { name: 'Chain Mail', power: 3 },
  scale:    { name: 'Scale Hauberk', power: 4 },
  plate:    { name: 'Plate Harness', power: 5 },
  mithril:  { name: 'Mithril Shirt', power: 6 },
};
export const ITEMS = {};
for (const [id, w] of Object.entries(WEAPONS)) ITEMS[id] = { ...w, id, slot: 'weapon' };
for (const [id, a] of Object.entries(ARMOR)) ITEMS[id] = { ...a, id, slot: 'armor' };
// What a smith or a market asks for a piece, by its power.
export const itemPrice = power => [0, 5, 9, 16, 26, 38, 54, 72, 95][power] ?? 120;

/* ---------- relics: magic things that last the rest of this life, and no longer ---------- */
// tier: common ones turn up often; rare ones come from hard fights and good luck; legend ones from a handful of places.
export const RELICS = {
  horseshoe:     { name: 'Lucky Horseshoe', tier: 'common', blurb: '+1 to your dice in every fight.' },
  wolf_tooth:    { name: 'Wolf-Tooth Charm', tier: 'common', blurb: '+1 power.' },
  satchel:       { name: 'Bottomless Satchel', tier: 'common', blurb: 'A loaf turns up in it every third step.' },
  merchant_seal: { name: 'Merchant’s Seal', tier: 'common', blurb: 'Everything you buy costs a quarter less.' },
  moss:          { name: 'Pouch of Healing Moss', tier: 'common', blurb: 'Heal 1 every fourth step.' },
  pilgrim_badge: { name: 'Pilgrim’s Badge', tier: 'common', blurb: '+3 renown when you find it.' },
  salt:          { name: 'Blessed Salt', tier: 'common', blurb: '+4 power against the dead.' },
  snare:         { name: 'Hunter’s Snare', tier: 'common', blurb: '+1 food after every fight you win.' },
  glove:         { name: 'Cutpurse’s Glove', tier: 'common', blurb: '+6 gold after every fight you win.' },
  candle:        { name: 'Candle of Omens', tier: 'common', blurb: '+2 foresight when you find it.' },
  rabbit_foot:   { name: 'Rabbit’s Foot', tier: 'common', blurb: 'Once: when you lose a fight, roll again.', once: true },
  tinker_coin:   { name: 'Tinker’s Lucky Coin', tier: 'common', blurb: '+2 gold every step.' },
  phoenix:       { name: 'Phoenix Feather', tier: 'rare', blurb: 'The first time you would die, you rise again with 3 health.', once: true },
  dragon_scale:  { name: 'Dragon Scale', tier: 'rare', blurb: 'Lost fights hurt you 1 less.' },
  chalice:       { name: 'Vampire’s Chalice', tier: 'rare', blurb: 'Heal 1 after every fight you win.' },
  crystal_ball:  { name: 'Crystal Ball', tier: 'rare', blurb: '+1 foresight every third step.' },
  fox_ring:      { name: 'Ring of the Fox', tier: 'rare', blurb: 'When chance decides, it often decides in your favour.' },
  dawnblade:     { name: 'Sword of Dawn', tier: 'rare', blurb: '+3 power.' },
  aegis:         { name: 'Aegis Amulet', tier: 'rare', blurb: 'Curses can’t touch you.' },
  golden_goose:  { name: 'Golden Goose', tier: 'rare', blurb: '+4 gold every step.' },
  gorgon_eye:    { name: 'Gorgon’s Eye', tier: 'rare', blurb: 'Once: turn a foe to stone and win without a roll.', once: true },
  hourglass:     { name: 'Hourglass of Ages', tier: 'rare', blurb: 'Once: turn back time and make your last choice again.', once: true },
  boots:         { name: 'Seven-League Boots', tier: 'rare', blurb: 'Once: stride past a choice without facing it.', once: true },
  grail:         { name: 'The Grail', tier: 'legend', blurb: 'Heals you fully and adds 2 to your health when you find it.' },
  kingsblade:    { name: 'The Kingsblade', tier: 'legend', blurb: '+4 power, and +2 claim to the throne.' },
  dragon_egg:    { name: 'Dragon Egg', tier: 'legend', blurb: 'Hatches after four steps into a dragonling: +4 power.' },
  old_banner:    { name: 'Banner of the Old Kings', tier: 'legend', blurb: '+3 claim to the throne, and +2 renown when you find it.' },
};
export const RELIC_TIERS = { common: [], rare: [], legend: [] };
for (const [id, r] of Object.entries(RELICS)) RELIC_TIERS[r.tier].push(id);

/* ---------- blessings and curses: they last your whole life, unless something lifts them ---------- */
export const TRAITS = {
  second_sight:  { name: 'Second Sight', kind: 'blessing', blurb: '+2 foresight now, and 1 more every fourth step.' },
  dragonblood:   { name: 'Dragon’s Blood', kind: 'blessing', blurb: '+2 power and +1 health.' },
  silver_tongue: { name: 'Silver Tongue', kind: 'blessing', blurb: 'Prices, tolls and bribes cost a quarter less; talking your way through goes better.' },
  beloved:       { name: 'Beloved of the People', kind: 'blessing', blurb: '+2 renown now, and 1 extra whenever you earn renown.' },
  iron_stomach:  { name: 'Iron Stomach', kind: 'blessing', blurb: 'You only need to eat every other step.' },
  lucky:         { name: 'Born Lucky', kind: 'blessing', blurb: 'When chance decides, it often decides in your favour.' },
  beast_tongue:  { name: 'Beast-Tongue', kind: 'blessing', blurb: 'Beasts won’t fight you. They let you pass.' },
  knighted:      { name: 'Knighted', kind: 'blessing', blurb: '+1 power, +2 renown, and +1 claim to the throne.' },
  saints_ward:   { name: 'Saint’s Ward', kind: 'blessing', blurb: 'Curses can’t touch you.' },
  stout_heart:   { name: 'Stout Heart', kind: 'blessing', blurb: '+2 health.' },
  royal_blood:   { name: 'Royal Blood', kind: 'blessing', blurb: 'Child of a crowned head: +1 claim to the throne.' },
  wolfblood:     { name: 'Wolf-Blood', kind: 'mixed', blurb: '+3 power, but the moon costs you 1 health every fourth step.' },
  midas:         { name: 'Midas Touch', kind: 'mixed', blurb: 'Gold you find is doubled, but food you touch turns to gold (3 a loaf).' },
  twin_step:     { name: 'Twin-Step Hex', kind: 'curse', blurb: 'Every turn you take, you must take twice: after you choose a way, your next step goes the same way.' },
  weathervane:   { name: 'Weathervane Curse', kind: 'curse', blurb: 'You can never go the same way three times running.' },
  wendigo:       { name: 'Wendigo’s Hunger', kind: 'curse', blurb: 'You eat two loaves every step.' },
  leaden_purse:  { name: 'Goblin-Cursed Purse', kind: 'curse', blurb: 'Gold you find is halved.' },
  veil:          { name: 'The Veil', kind: 'curse', blurb: 'One of your two paths is always hidden from you.' },
  glass_bones:   { name: 'Glass Bones', kind: 'curse', blurb: '−2 health.' },
  ill_luck:      { name: 'Black Cat’s Curse', kind: 'curse', blurb: 'When chance decides, it often decides against you.' },
  reaper:        { name: 'Marked by the Reaper', kind: 'curse', blurb: 'Death comes for you in five steps, unless the mark is lifted.' },
  oathbreaker:   { name: 'Oathbreaker', kind: 'curse', blurb: '−3 renown, no one new will stand with you, and −2 claim to the throne.' },
  toad:          { name: 'Toad-Cursed', kind: 'curse', blurb: 'You are a toad. −3 power, and everything costs double.' },
};
export const isCurse = id => TRAITS[id]?.kind === 'curse';
export const REAPER_STEPS = 5;

/* ---------- allies: who will stand with you when you reach for the crown ---------- */
export const ALLIES = {
  rebels:    { name: 'The Greenhood', blurb: 'Outlaws of the wood, and the smallfolk who feed them.' },
  guild:     { name: 'The Quiet Hand', blurb: 'The thieves’ guild: locks, poisons, and ears in every hall.' },
  knights:   { name: 'Knights of the Rose', blurb: 'An old order of knights sworn to a rightful crown.' },
  church:    { name: 'The Dawn Church', blurb: 'The bishops who anoint kings, and the pilgrims who follow them.' },
  merchants: { name: 'The Gilded Company', blurb: 'Merchant princes. Everyone has a price, and they know it.' },
  mages:     { name: 'The Circle of the Tower', blurb: 'The kingdom’s wizards, old and strange and proud.' },
  fey:       { name: 'The Fey Court', blurb: 'The Hidden Folk of hill and fen. They never forget a debt.' },
  dwarves:   { name: 'The Deep Kin', blurb: 'Dwarves of the mountain halls: miners, smiths, sappers.' },
  lords:     { name: 'The Marcher Lords', blurb: 'The border barons, with their own banners and their own men.' },
};

/* ---------- the bloodline: powers bought with what each life leaves its heir, kept for every generation after ---------- */
export const LEGACY = [
  { id: 'blade', name: 'Heirloom Blade', blurb: ['Start with the family sword (power 2, not 1).'], costs: [240] },
  { id: 'hardy', name: 'Hardy Stock', blurb: ['+1 health.'], costs: [400] },
  { id: 'larder', name: 'Full Larder', blurb: ['Start with 1 more food.'], costs: [140] },
  { id: 'coffers', name: 'Family Coffers', blurb: ['Start with 5 more gold.', 'Start with 10 more gold.'], costs: [100, 260] },
  { id: 'seer', name: 'Seer’s Blood', blurb: ['Start every life with 1 foresight.'], costs: [180] },
  { id: 'name', name: 'A Noble Name', blurb: ['+1 claim to the throne.'], costs: [480] },
  { id: 'hoard', name: 'The Family Relic', blurb: ['Start every life with a common relic.'], costs: [520] },
  { id: 'ward', name: 'Blessed Line', blurb: ['The first curse of each life is warded off.'], costs: [280] },
];
export const LEGACY_BY_ID = Object.fromEntries(LEGACY.map(l => [l.id, l]));
export const legacyGold = [0, 5, 10], legacyFood = [0, 1], legacyHp = [0, 1], legacyRenown = [0, 0], legacyClaim = [0, 1];

// What an heir inherits: half the purse (the rest goes on the funeral, the debts and the relatives), plus something
// for how far the road went.
export const PURSE_SHARE = .5;
export const DEEDS_PER_STEP = 3;
export const ROYAL_TREASURY = 250;

/* ---------- foes ---------- */
// kind matters to a few things: Blessed Salt against the dead, Beast-Tongue against beasts.
export const FOES = {
  bandit:   { kind: 'human', name: 'Bandit' },
  brigand:  { kind: 'human', name: 'Brigand Chief' },
  soldier:  { kind: 'human', name: 'Soldier' },
  knight:   { kind: 'human', name: 'Knight' },
  mercenary:{ kind: 'human', name: 'Sellsword' },
  cultist:  { kind: 'human', name: 'Cultist' },
  witch:    { kind: 'human', name: 'Witch' },
  assassin: { kind: 'human', name: 'Assassin' },
  champion: { kind: 'human', name: 'Champion' },
  tyrant:   { kind: 'human', name: 'Tyrant' },
  wolf:     { kind: 'beast', name: 'Wolf' },
  bear:     { kind: 'beast', name: 'Bear' },
  boar:     { kind: 'beast', name: 'Boar' },
  spider:   { kind: 'beast', name: 'Giant Spider' },
  serpent:  { kind: 'beast', name: 'Serpent' },
  goblin:   { kind: 'monster', name: 'Goblin' },
  troll:    { kind: 'monster', name: 'Troll' },
  ogre:     { kind: 'monster', name: 'Ogre' },
  giant:    { kind: 'monster', name: 'Giant' },
  werewolf: { kind: 'monster', name: 'Werewolf' },
  wyvern:   { kind: 'monster', name: 'Wyvern' },
  dragon:   { kind: 'monster', name: 'Dragon' },
  skeleton: { kind: 'undead', name: 'Skeleton' },
  ghost:    { kind: 'undead', name: 'Ghost' },
  wraith:   { kind: 'undead', name: 'Wraith' },
};
// Two dice each, added to power; ties go to you.
export const DICE = 2;
// What a beaten foe leaves: beasts are dinner, people and monsters carry coin, and sometimes a weapon or armour better
// than yours (never more than a little better, and never beyond what the stage of the road would have).
export const LOOT = { beastFood: 2, goldPerPower: { human: 1.5, monster: 1.2, undead: 0, beast: 0 }, itemChance: .28 };

/* ---------- the three states the kingdom can be in ---------- */
export const REALMS = {
  old: { name: 'The Old King', short: 'An heirless crown',
    blurb: 'The {ruler} is old and has no heir. The crown will pass to whoever proves worthiest.' },
  tyrant: { name: 'The Tyrant', short: 'A cruel crown',
    blurb: '{Ruler} holds the throne and bleeds the realm white. To wear the crown, you will have to take it.',
    payMul: 1.25 },
  chaos: { name: 'The Empty Throne', short: 'No crown at all',
    blurb: 'The throne is empty and the lords are at war. Every road is harder, every loss cuts deeper.',
    hurt: 1, lossMul: 1.5, foodCut: 1, foePower: 1 },   // foodCut: taken off any big haul of food (3 or more)
};

/* ---------- the kind of ruler you turn out to be ---------- */
// The choices on the way to the throne each show one or two of these. The one shown most names your reign.
export const VIRTUES = {
  mercy:      { name: 'Mercy', epithet: 'the Merciful' },
  justice:    { name: 'Justice', epithet: 'the Just' },
  might:      { name: 'Might', epithet: 'the Iron' },
  generosity: { name: 'Generosity', epithet: 'the Generous' },
  piety:      { name: 'Piety', epithet: 'the Pious' },
  splendor:   { name: 'Splendour', epithet: 'the Magnificent' },
  cunning:    { name: 'Cunning', epithet: 'the Shrewd' },
  love:       { name: 'The people’s love', epithet: 'the Beloved' },
};
// What comes after a reign, before the procession has had its say: a usurper, or the lords at war.
export const AFTER_REIGN = { tyrant: 55, chaos: 45, old: 0 };

/* ---------- map tiles an option can be drawn as ---------- */
export const TILES = [
  'crossroads', 'road', 'village', 'tavern', 'market', 'smithy', 'farm', 'mill', 'manor', 'chapel', 'abbey', 'tollgate',
  'camp', 'bandit_camp', 'war_camp', 'watchtower', 'castle', 'ruins', 'bridge', 'troll_bridge', 'ferry', 'well', 'shrine',
  'stones', 'graveyard', 'crypt', 'gallows', 'mine', 'cave', 'lair', 'witch_hut', 'wizard_tower', 'fairy_ring', 'grove',
  'forest', 'swamp', 'lake', 'mountain', 'pass', 'battlefield', 'tourney', 'hermitage', 'oracle', 'portal', 'orchard',
  'stable', 'prison', 'altar', 'hovel', 'bonfire', 'palace', 'cathedral', 'city_gate', 'garden', 'street', 'throne',
];
export const BIOMES = ['farm', 'wood', 'fen', 'hills', 'moor', 'lake', 'waste', 'snow', 'crown', 'city'];
