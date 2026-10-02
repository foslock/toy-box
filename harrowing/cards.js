// Every card in the game. A card is printed like a tarot card: the angel's reading upright at the top, the demon's
// reading upside down at the bottom. Whoever draws it plays their own half: the angel the upright one ("up"), a demon
// the reversed one ("down"). Fallen angels read cards upright, and the Devil reads whichever way hurts you more.
//
// Effects are small objects ({ k: 'dmg', n: 6 }); the engine runs them and the text on the card is written from them,
// so the numbers printed always match what happens. A card can override its text with `text` / `rtext`.

const E = (k, n, more) => ({ k, n, ...more });
export const D = (n, x = 1) => E('dmg', n, { x });          // damage to the target (a demon playing it: to you)
export const A = (n, x = 1) => E('aoe', n, { x });          // damage to ALL demons
export const R = (n, x) => E('rand', n, { x });             // damage to a random demon, x times
export const W = n => E('ward', n);
export const H = n => E('heal', n);
export const L = n => E('lose', n);                         // lose HP: the angel's sacrifices, a demon's scorching
const S = (k, n, more) => E(k, n, more);

// Keywords explained in tooltips and the glossary.
export const KEYWORDS = {
  Ward: 'Blocks damage. Fades at the start of the holder\'s next turn.',
  Grace: 'Spent to play cards. You get 3 at the start of each turn.',
  Might: 'Adds to every hit of damage dealt.',
  Faith: 'Adds to every Ward gained from cards.',
  Burn: 'Takes damage equal to its Burn at the start of each turn, then Burn goes down by 1.',
  Exposed: 'Takes 50% more damage from attacks. Goes down by 1 each round.',
  Shaken: 'Deals 25% less damage with attacks. Goes down by 1 each round.',
  Thorns: 'Whenever attacked, the attacker takes this much damage.',
  Holy: 'A demon that draws this card is Scorched by it: its reversed side hurts the demon.',
  Scorched: 'A demon that plays a Holy card takes the damage itself.',
  Offer: 'Put a card from your hand on top of the shared deck. The next demon to draw takes it.',
  Foresee: 'Look at the top cards of the shared deck. Discard any of them; the rest stay on top, face up to you.',
  Disarm: 'The demon drops the card it is holding into the discard pile. It does nothing this round.',
  Rebuke: 'The demon plays the card it holds against itself, right now.',
  Redeem: 'Take the card a demon is holding into your hand, turned upright.',
  Swap: 'Trade a card in your hand for the card a demon is holding.',
  Banish: 'Gone for the rest of this fight. Played Banish cards can\'t be drawn by demons either.',
  Retain: 'Stays in your hand at the end of your turn, out of the demons\' reach.',
  Fleeting: 'If it is still in your hand at the end of your turn, it is Banished.',
  Unplayable: 'Can\'t be played. Offer it to a demon instead.',
  Infernal: 'A demon\'s own card, shuffled into the deck for this fight only. You can play its upright side.',
  Curse: 'A burden that stays in your deck. Useless to you, but often worse for a demon that draws it.',
  Power: 'Stays in play for the rest of the fight once played, so no demon can draw it again.',
};

/* ---------- the cards ---------- */
// fields: name, rname (the reversed name), cost (-1 = X), type (attack, skill, power, curse, status), rarity
// (starter, common, uncommon, rare, special), glyph (the art), up, down (effect lists), target ('enemy' when the angel
// must pick a demon), flags: retain, banish, fleeting, innate, unplayable; plus: what changes when the card is Blessed.
export const CARDS = {
  /* --- starters --- */
  smite: { name: 'Smite', rname: 'Spite', cost: 1, type: 'attack', rarity: 'starter', glyph: 'sword', target: 'enemy',
    up: [D(6)], down: [D(5)], plus: { up: [D(9)] } },
  ward: { name: 'Ward', rname: 'Cower', cost: 1, type: 'skill', rarity: 'starter', glyph: 'shield',
    up: [W(5)], down: [W(5)], plus: { up: [W(8)] } },
  holyWater: { name: 'Holy Water', rname: 'Scald', cost: 1, type: 'attack', rarity: 'starter', glyph: 'vial', target: 'enemy',
    up: [D(5), S('burn', 2)], down: [L(7)], plus: { up: [D(6), S('burn', 4)], down: [L(9)] } },
  offering: { name: 'Offering', rname: 'Empty Hands', cost: 0, type: 'skill', rarity: 'starter', glyph: 'bowl',
    up: [S('offer', 1), S('draw', 1)], down: [S('nothing')], plus: { up: [S('offer', 1), S('draw', 2)] } },

  /* --- common attacks --- */
  searingLight: { name: 'Searing Light', rname: 'Smoulder', cost: 1, type: 'attack', rarity: 'common', glyph: 'sun', target: 'enemy',
    up: [D(4), S('burn', 4)], down: [L(5)], plus: { up: [D(5), S('burn', 6)], down: [L(7)] } },
  flamingSword: { name: 'Flaming Sword', rname: 'Brand', cost: 2, type: 'attack', rarity: 'common', glyph: 'flameSword', target: 'enemy',
    up: [D(15)], down: [D(12)], plus: { up: [D(20)] } },
  thunderclap: { name: 'Thunderclap', rname: 'Rumble', cost: 1, type: 'attack', rarity: 'common', glyph: 'bolt',
    up: [A(4), S('exposeAll', 1)], down: [D(4), S('expose', 1)], plus: { up: [A(7), S('exposeAll', 1)] } },
  twinBlades: { name: 'Twin Blades', rname: 'Twin Fangs', cost: 1, type: 'attack', rarity: 'common', glyph: 'twin', target: 'enemy',
    up: [D(4, 2)], down: [D(3, 2)], plus: { up: [D(6, 2)] } },
  lance: { name: 'Lance of Light', rname: 'Shadow Lance', cost: 1, type: 'attack', rarity: 'common', glyph: 'lance', target: 'enemy',
    up: [D(9)], down: [D(8)], plus: { up: [D(12)] } },
  wingBuffet: { name: 'Wing Buffet', rname: 'Wing Beat', cost: 1, type: 'attack', rarity: 'common', glyph: 'wings', target: 'enemy',
    up: [D(5), W(5)], down: [D(4), W(4)], plus: { up: [D(7), W(7)] } },
  stigmata: { name: 'Stigmata', rname: 'Bleed', cost: 0, type: 'attack', rarity: 'common', glyph: 'heart', target: 'enemy',
    up: [L(2), D(10)], down: [L(6)], plus: { up: [L(2), D(14)] } },
  firstLight: { name: 'First Light', rname: 'Last Light', cost: 1, type: 'attack', rarity: 'common', glyph: 'dawn', target: 'enemy',
    up: [D(6), S('draw', 1)], down: [L(6)], plus: { up: [D(9), S('draw', 1)] } },

  /* --- common skills --- */
  shieldFaith: { name: 'Shield of Faith', rname: 'Iron Hide', cost: 2, type: 'skill', rarity: 'common', glyph: 'bigShield',
    up: [W(13)], down: [W(12)], plus: { up: [W(17)] } },
  hymn: { name: 'Hymn', rname: 'Dirge', cost: 1, type: 'skill', rarity: 'common', glyph: 'lyre',
    up: [W(6), S('draw', 1)], down: [W(5)], plus: { up: [W(9), S('draw', 1)] } },
  glimpse: { name: 'Glimpse', rname: 'Blink', cost: 0, type: 'skill', rarity: 'common', glyph: 'eye',
    up: [S('foresee', 3), S('draw', 1)], down: [S('nothing')], plus: { up: [S('foresee', 5), S('draw', 1)] } },
  consecrate: { name: 'Consecrate', rname: 'Defile', cost: 1, type: 'skill', rarity: 'common', glyph: 'chalice',
    up: [W(7), S('offer', 1)], down: [L(6)], plus: { up: [W(10), S('offer', 1)] } },
  saltCircle: { name: 'Salt Circle', rname: 'Salted', cost: 1, type: 'skill', rarity: 'common', glyph: 'salt',
    up: [W(6)], down: [L(8)], plus: { up: [W(9)], down: [L(10)] } },
  disarm: { name: 'Disarm', rname: 'Fumble', cost: 1, type: 'skill', rarity: 'common', glyph: 'brokenBlade', target: 'enemy',
    up: [S('disarm')], down: [W(6)], plus: { up: [S('disarm'), S('draw', 1)] } },
  manna: { name: 'Manna', rname: 'Crumbs', cost: 0, type: 'skill', rarity: 'common', glyph: 'bread', banish: true,
    up: [S('draw', 2)], down: [H(4)], plus: { up: [S('draw', 3)] } },
  vigil: { name: 'Vigil', rname: 'Lurk', cost: 1, type: 'skill', rarity: 'common', glyph: 'candle', retain: true,
    up: [W(8)], down: [W(8)], plus: { up: [W(11)] } },
  feather: { name: 'Falling Feather', rname: 'Molt', cost: 0, type: 'skill', rarity: 'common', glyph: 'feather',
    up: [W(3), S('draw', 1)], down: [W(3)], plus: { up: [W(5), S('draw', 1)] } },
  trumpetCall: { name: 'Trumpet Call', rname: 'Howl', cost: 1, type: 'skill', rarity: 'common', glyph: 'trumpet', target: 'enemy',
    up: [S('expose', 2), S('draw', 1)], down: [S('expose', 1)], plus: { up: [S('expose', 3), S('draw', 1)] } },
  censer: { name: 'Censer', rname: 'Fume', cost: 1, type: 'skill', rarity: 'common', glyph: 'censer',
    up: [S('burnAll', 3)], down: [L(6)], plus: { up: [S('burnAll', 5)] } },
  divineOrder: { name: 'Divine Order', rname: 'Disorder', cost: 1, type: 'skill', rarity: 'common', glyph: 'scroll',
    up: [S('recall', 1), S('draw', 1)], down: [S('shuffleDeck')], plus: { cost: 0 } },

  /* --- uncommons --- */
  rebuke: { name: 'Rebuke', rname: 'Backlash', cost: 1, type: 'skill', rarity: 'uncommon', glyph: 'mirror', target: 'enemy',
    up: [S('rebuke')], down: [S('nothing')], plus: { cost: 0 } },
  redemption: { name: 'Redemption', rname: 'Abduction', cost: 1, type: 'skill', rarity: 'uncommon', glyph: 'openHand', target: 'enemy',
    up: [S('redeem')], down: [H(6)], plus: { up: [S('redeem'), S('draw', 1)] } },
  exchange: { name: 'Exchange', rname: 'Swindle', cost: 0, type: 'skill', rarity: 'uncommon', glyph: 'swap', target: 'enemy',
    up: [S('swap')], down: [W(4)], plus: { up: [S('swap'), S('draw', 1)] } },
  archSpear: { name: 'Archangel\'s Spear', rname: 'Pitchfork', cost: 1, type: 'attack', rarity: 'uncommon', glyph: 'spear', target: 'enemy',
    up: [D(8), S('disarm', 0, { if: 'holdsAttack' })], down: [D(7)], plus: { up: [D(11), S('disarm', 0, { if: 'holdsAttack' })] },
    text: 'Deal {0} damage. If the demon holds an attack, *Disarm* it.' },
  kindle: { name: 'Kindle', rname: 'Snuff', cost: 1, type: 'skill', rarity: 'uncommon', glyph: 'flame', target: 'enemy',
    up: [S('kindle')], down: [S('burn', 3)], plus: { cost: 0 } },
  trumpetBlast: { name: 'Trumpet Blast', rname: 'Horn Blast', cost: 2, type: 'attack', rarity: 'uncommon', glyph: 'horn',
    up: [A(9), S('exposeAll', 1)], down: [D(9), S('expose', 1)], plus: { up: [A(12), S('exposeAll', 1)] } },
  guardianWings: { name: 'Guardian Wings', rname: 'Bat Wings', cost: 2, type: 'skill', rarity: 'uncommon', glyph: 'bigWings',
    up: [W(10), S('nextWard', 10)], down: [W(10)], plus: { up: [W(13), S('nextWard', 13)] } },
  sacrifice: { name: 'Sacrifice', rname: 'Bloodletting', cost: 0, type: 'skill', rarity: 'uncommon', glyph: 'dagger',
    up: [L(4), S('grace', 2)], down: [L(8)], plus: { up: [L(3), S('grace', 2), S('draw', 1)] } },
  revelation: { name: 'Revelation', rname: 'Concealment', cost: 1, type: 'skill', rarity: 'uncommon', glyph: 'star',
    up: [S('foresee', 4), S('draw', 2)], down: [S('nothing')], plus: { up: [S('foresee', 6), S('draw', 2)] } },
  hosanna: { name: 'Hosanna', rname: 'Bluster', cost: 1, type: 'power', rarity: 'uncommon', glyph: 'crown',
    up: [S('might', 2)], down: [S('might', 2)], plus: { up: [S('might', 3)] } },
  haloFlame: { name: 'Halo of Flame', rname: 'Crown of Fire', cost: 1, type: 'power', rarity: 'uncommon', glyph: 'halo',
    up: [S('power', 2, { id: 'haloFlame' })], down: [S('burn', 4)], plus: { up: [S('power', 3, { id: 'haloFlame' })] } },
  sanctusBell: { name: 'Sanctus Bell', rname: 'Death Knell', cost: 1, type: 'power', rarity: 'uncommon', glyph: 'bell',
    up: [S('power', 5, { id: 'bell' })], down: [S('might', 2)], plus: { up: [S('power', 8, { id: 'bell' })] } },
  armorLight: { name: 'Armor of Light', rname: 'Carapace', cost: 1, type: 'power', rarity: 'uncommon', glyph: 'breastplate',
    up: [S('faith', 2)], down: [S('faith', 2)], plus: { up: [S('faith', 3)] } },
  burningBush: { name: 'Burning Bush', rname: 'Thornbush', cost: 1, type: 'power', rarity: 'uncommon', glyph: 'bush',
    up: [S('thorns', 3)], down: [S('thorns', 3)], plus: { up: [S('thorns', 5)] } },
  martyrsFlame: { name: 'Martyr\'s Flame', rname: 'Pyre', cost: 1, type: 'attack', rarity: 'uncommon', glyph: 'pyre',
    up: [L(3), A(8)], down: [L(8)], plus: { up: [L(3), A(11)] } },
  purify: { name: 'Purify', rname: 'Taint', cost: 1, type: 'skill', rarity: 'uncommon', glyph: 'purge',
    up: [S('purge', 1), W(6)], down: [W(6)], plus: { up: [S('purge', 1), W(6), S('draw', 1)] } },
  heavenlyHost: { name: 'Heavenly Host', rname: 'Legion', cost: 2, type: 'attack', rarity: 'uncommon', glyph: 'host',
    up: [R(3, 5)], down: [D(3, 3)], plus: { up: [R(3, 7)] } },
  ascension: { name: 'Ascension', rname: 'Descent', cost: 1, type: 'skill', rarity: 'uncommon', glyph: 'stair',
    up: [S('draw', 3), S('offer', 1)], down: [S('nothing')], plus: { cost: 0 } },
  weighing: { name: 'Weighing of Souls', rname: 'Tipped Scales', cost: 1, type: 'attack', rarity: 'uncommon', glyph: 'balance', target: 'enemy',
    up: [S('perHeld', 5)], down: [D(6)], plus: { up: [S('perHeld', 7)] } },

  /* --- rares --- */
  angelus: { name: 'Angelus', rname: 'Damnation', cost: 2, type: 'attack', rarity: 'rare', glyph: 'holyBlade', target: 'enemy',
    up: [D(16)], down: [L(16)], plus: { up: [D(22)], down: [L(22)] } },
  wrathHeaven: { name: 'Wrath of Heaven', rname: 'Wrath of Hell', cost: -1, type: 'attack', rarity: 'rare', glyph: 'storm',
    up: [S('xAoe', 7)], down: [D(7, 2)], plus: { up: [S('xAoe', 9)] } },
  pillarFire: { name: 'Pillar of Fire', rname: 'Hellmouth', cost: 2, type: 'attack', rarity: 'rare', glyph: 'pillar',
    up: [A(10), S('burnAll', 4)], down: [D(10), S('burn', 4)], plus: { up: [A(13), S('burnAll', 5)] } },
  prophecy: { name: 'Prophecy', rname: 'Omen', cost: 1, type: 'power', rarity: 'rare', glyph: 'eyeStar',
    up: [S('power', 2, { id: 'prophecy' })], down: [S('nothing')], plus: { cost: 0, up: [S('power', 3, { id: 'prophecy' })] } },
  sanctuary: { name: 'Sanctuary', rname: 'Fortress', cost: 2, type: 'power', rarity: 'rare', glyph: 'temple',
    up: [S('power', 1, { id: 'sanctuary' })], down: [W(15)], plus: { cost: 1 } },
  martyrdom: { name: 'Martyrdom', rname: 'Feast', cost: 1, type: 'power', rarity: 'rare', glyph: 'heartRays',
    up: [S('power', 1, { id: 'martyrdom' })], down: [H(12)], plus: { cost: 0 } },
  lastJudgment: { name: 'Last Judgment', rname: 'Mistrial', cost: 2, type: 'skill', rarity: 'rare', glyph: 'gate', banish: true,
    up: [S('rebukeAll')], down: [S('nothing')], plus: { cost: 1 } },
  seraphForm: { name: 'Seraph Form', rname: 'Demon Form', cost: 3, type: 'power', rarity: 'rare', glyph: 'sixWings',
    up: [S('power', 2, { id: 'seraph' })], down: [S('might', 3)], plus: { cost: 2 } },
  resurrection: { name: 'Resurrection', rname: 'Undeath', cost: 2, type: 'skill', rarity: 'rare', glyph: 'lily', banish: true,
    up: [H(15)], down: [H(20)], plus: { up: [H(22)] } },
  exodus: { name: 'Exodus', rname: 'Exile', cost: 2, type: 'skill', rarity: 'rare', glyph: 'waves', banish: true,
    up: [S('disarmAll'), W(10)], down: [W(10)], plus: { cost: 1 } },
  tongues: { name: 'Tongues of Fire', rname: 'Forked Tongues', cost: 2, type: 'attack', rarity: 'rare', glyph: 'tongues',
    up: [A(4, 3)], down: [L(12)], plus: { up: [A(6, 3)] } },
  greatSword: { name: 'Sword of the Archangel', rname: 'Sword of the Fallen', cost: 3, type: 'attack', rarity: 'rare', glyph: 'greatSword', target: 'enemy',
    up: [D(30)], down: [D(22)], plus: { up: [D(40)] } },
  covenant: { name: 'Covenant', rname: 'Pact', cost: 1, type: 'power', rarity: 'rare', glyph: 'rainbow',
    up: [S('power', 1, { id: 'covenant' })], down: [S('might', 2)], plus: { cost: 0 } },
  choir: { name: 'Heavenly Choir', rname: 'Cacophony', cost: 2, type: 'power', rarity: 'rare', glyph: 'choir',
    up: [S('power', 1, { id: 'choir' })], down: [S('might', 1), W(8)], plus: { up: [S('power', 2, { id: 'choir' })] } },

  /* --- statuses: made during a fight, gone after it --- */
  ash: { name: 'Ash', rname: 'Ash', cost: 0, type: 'status', rarity: 'special', glyph: 'ash', unplayable: true, fleeting: true,
    up: [], down: [S('nothing')] },
  brimstone: { name: 'Brimstone', rname: 'Brimstone', cost: 0, type: 'status', rarity: 'special', glyph: 'brimstone', unplayable: true,
    up: [], down: [D(4)], endInHand: [L(3)], text: '*Unplayable*. At the end of your turn, if this is in your hand, lose {e0} HP.' },
  frost: { name: 'Frost', rname: 'Frostbite', cost: 0, type: 'status', rarity: 'special', glyph: 'frost', unplayable: true, fleeting: true,
    up: [], down: [D(6)] },
  temptation: { name: 'Temptation', rname: 'Indulgence', cost: 0, type: 'status', rarity: 'special', glyph: 'apple', unplayable: true,
    up: [], down: [S('might', 1)] },

  /* --- curses: stay in your deck. Dead weight in your hand, but they trouble demons too --- */
  regret: { name: 'Regret', rname: 'Hesitation', cost: 0, type: 'curse', rarity: 'curse', glyph: 'tear', unplayable: true,
    up: [], down: [S('nothing')] },
  doubt: { name: 'Doubt', rname: 'Misgiving', cost: 0, type: 'curse', rarity: 'curse', glyph: 'question', unplayable: true,
    up: [], down: [S('shake', 2, { self: true })], endInHand: [S('shake', 1, { self: true })],
    text: '*Unplayable*. At the end of your turn, if this is in your hand, you are *Shaken* {e0}.' },
  guilt: { name: 'Guilt', rname: 'Remorse', cost: 0, type: 'curse', rarity: 'curse', glyph: 'chain', unplayable: true,
    up: [], down: [L(5)] },
  burden: { name: 'Burden', rname: 'Millstone', cost: 0, type: 'curse', rarity: 'curse', glyph: 'stone', unplayable: true, retain: true,
    up: [], down: [S('nothing')] },
  avarice: { name: 'Avarice', rname: 'Hoarding', cost: 0, type: 'curse', rarity: 'curse', glyph: 'coin', unplayable: true,
    up: [], down: [W(5)] },

  /* --- infernal: each demon brings its own cards into the deck for the fight. Playable by you, upright --- */
  ember: { name: 'Ember', rname: 'Fire Spit', cost: 0, type: 'attack', rarity: 'infernal', glyph: 'ember', target: 'enemy', banish: true,
    up: [D(3)], down: [D(5), S('burn', 2)] },
  wail: { name: 'Wail', rname: 'Keening', cost: 0, type: 'skill', rarity: 'infernal', glyph: 'wail', banish: true,
    up: [S('draw', 1)], down: [D(3), S('shake', 1)] },
  chill: { name: 'Grave Chill', rname: 'Cold Touch', cost: 1, type: 'skill', rarity: 'infernal', glyph: 'shade', banish: true,
    up: [W(6)], down: [D(6), S('shake', 1)] },
  kiss: { name: 'Kiss', rname: 'Drain', cost: 1, type: 'skill', rarity: 'infernal', glyph: 'lips', banish: true,
    up: [H(4)], down: [D(6), H(6)] },
  gale: { name: 'Gale', rname: 'Tempest', cost: 0, type: 'skill', rarity: 'infernal', glyph: 'gale', banish: true,
    up: [S('shuffleDeck'), S('draw', 1)], down: [D(4, 2)] },
  gorge: { name: 'Gorge', rname: 'Gluttony', cost: 0, type: 'skill', rarity: 'infernal', glyph: 'maw', unplayable: true, fleeting: true,
    up: [], down: [H(5), S('might', 1)] },
  bile: { name: 'Bile', rname: 'Vomit', cost: 1, type: 'attack', rarity: 'infernal', glyph: 'bile', banish: true,
    up: [A(7), L(3)], down: [D(8)] },
  buzz: { name: 'Buzz', rname: 'Swarm', cost: 0, type: 'skill', rarity: 'infernal', glyph: 'fly', banish: true,
    up: [S('draw', 1)], down: [D(2, 3)] },
  coin: { name: 'Gilded Coin', rname: 'Cutpurse', cost: 0, type: 'skill', rarity: 'infernal', glyph: 'coin', banish: true,
    up: [S('obols', 8)], down: [D(5), S('obols', 6)] },
  rage: { name: 'Rage', rname: 'Fury', cost: 1, type: 'skill', rarity: 'infernal', glyph: 'rage', banish: true,
    up: [S('might', 2), L(4)], down: [S('might', 2), D(4)] },
  mire: { name: 'Mire', rname: 'Leech', cost: 1, type: 'skill', rarity: 'infernal', glyph: 'mire', banish: true,
    up: [W(4)], down: [D(5), H(5)] },
  blasphemy: { name: 'Blasphemy', rname: 'Heresy', cost: 0, type: 'skill', rarity: 'infernal', glyph: 'brokenHalo', unplayable: true,
    up: [], down: [D(9), S('burn', 2)] },
  censure: { name: 'Fallen Prayer', rname: 'Black Mass', cost: 1, type: 'attack', rarity: 'infernal', glyph: 'blackCandle', target: 'enemy', banish: true,
    up: [D(10)], down: [W(8)] },
  hook: { name: 'Grappling Hook', rname: 'Gaff', cost: 1, type: 'attack', rarity: 'infernal', glyph: 'hook', target: 'enemy', banish: true,
    up: [D(6), S('draw', 1)], down: [D(7), S('expose', 1)] },
  pitch: { name: 'Boiling Pitch', rname: 'Tar', cost: 0, type: 'status', rarity: 'infernal', glyph: 'pitch', unplayable: true, fleeting: true,
    up: [], down: [D(5), S('shake', 1)] },
  volley: { name: 'Volley', rname: 'Arrow Storm', cost: 1, type: 'attack', rarity: 'infernal', glyph: 'arrows', banish: true,
    up: [R(3, 3)], down: [D(3, 3)] },
  gore: { name: 'Gore', rname: 'Stampede', cost: 0, type: 'skill', rarity: 'infernal', glyph: 'horns', unplayable: true,
    up: [], down: [D(13)] },
  lie: { name: 'Sweet Lie', rname: 'Flattery', cost: 0, type: 'skill', rarity: 'infernal', glyph: 'mask', banish: true,
    up: [S('foresee', 2)], down: [D(6), S('expose', 1)] },
  frostbite: { name: 'Frostbite', rname: 'Rime', cost: 0, type: 'status', rarity: 'infernal', glyph: 'frost', unplayable: true, fleeting: true,
    up: [], down: [D(8)] },
  betrayal: { name: 'Betrayal', rname: 'Treachery', cost: 0, type: 'skill', rarity: 'infernal', glyph: 'dagger', banish: true,
    up: [L(4), S('grace', 2)], down: [D(10)] },
  bite: { name: 'Bite', rname: 'Maul', cost: 0, type: 'skill', rarity: 'infernal', glyph: 'fangs', unplayable: true,
    up: [], down: [D(7)] },
  gold: { name: 'Pile of Gold', rname: 'Avalanche of Gold', cost: 1, type: 'skill', rarity: 'infernal', glyph: 'gold', banish: true,
    up: [S('obols', 15)], down: [D(6), W(6)] },
  whip: { name: 'Serpent Whip', rname: 'Scourge', cost: 1, type: 'attack', rarity: 'infernal', glyph: 'serpent', target: 'enemy', banish: true,
    up: [D(7), S('shake', 1)], down: [D(6, 2)] },
  hellfire: { name: 'Hellfire', rname: 'Hellfire', cost: 1, type: 'attack', rarity: 'infernal', glyph: 'hellfire', banish: true,
    up: [A(10), L(3)], down: [D(8), S('burn', 3)] },
  pact: { name: 'Pact', rname: 'Collection', cost: 0, type: 'skill', rarity: 'infernal', glyph: 'contract', banish: true,
    up: [S('grace', 2), S('draw', 2), S('feedDevil', 2)], down: [D(12)],
    text: 'Gain {0} *Grace*. Draw {1}. The Devil gains {2} *Might*.' },
  wingstorm: { name: 'Wingstorm', rname: 'Wingstorm', cost: 0, type: 'status', rarity: 'infernal', glyph: 'bigWings', unplayable: true, fleeting: true,
    up: [], down: [D(5), S('addCard', 1, { id: 'frost' })] },
};

for (const [id, c] of Object.entries(CARDS)) c.id = id;

export const RARITIES = ['common', 'uncommon', 'rare'];
export const pool = rarity => Object.values(CARDS).filter(c => c.rarity === rarity);
export const isPlayerCard = c => ['starter', 'common', 'uncommon', 'rare'].includes(c.rarity);

/* ---------- card instances ---------- */
let UID = 1;
export function makeCard(id, plus = false) { if (!CARDS[id]) throw new Error('No card ' + id); return { uid: UID++, id, plus: !!plus }; }
export const setUid = n => { UID = Math.max(UID, n); };

// The card's printed data, with its Blessing applied.
const DEF_CACHE = new Map();
export function def(card) {
  const key = card.id + (card.plus ? '+' : '');
  let d = DEF_CACHE.get(key);
  if (d) return d;
  const base = CARDS[card.id];
  d = { ...base, ...(card.plus ? base.plus : null), plus: !!card.plus, base };
  d.title = base.name + (card.plus ? '+' : '');
  d.rtitle = base.rname + (card.plus ? '+' : '');
  d.holy = isHoly(d);
  d.canBless = !!base.plus && !card.plus;
  DEF_CACHE.set(key, d);
  return d;
}
// Holy: a demon that plays this card's reversed side hurts itself.
export function isHoly(d) { return (d.down || []).some(e => e.k === 'lose'); }
export const cardCost = (card, b) => {
  const d = def(card);
  if (d.cost < 0) return -1;
  let c = d.cost + (card.costMod ?? 0);
  if (card.freeThisTurn) c = 0;
  if (b?.charmRule?.('infernalFree') && d.rarity === 'infernal') c = 0;
  return Math.max(0, c);
};

/* ---------- text ---------- */
// Card text is a small markup: [n] for a number (with + or - after it when it's been raised or lowered by Might,
// Shaken, Exposed or Faith), *Word* for a keyword. The card painter and the tooltips both read it.
const num = (shown, base) => `[${shown}${shown > base ? '+' : shown < base ? '-' : ''}]`;
const times = x => x === 2 ? 'twice' : `[${x}] times`;
const plural = (n, w) => n === 1 ? `a ${w}` : `[${n}] ${w}s`;

// mods: { dmg(n) → shown, ward(n) → shown, x (the X of X-cost cards) }
export function effectText(effects, voice, mods = {}) {
  const dm = mods.dmg ?? (n => n), wd = mods.ward ?? (n => n);
  const out = [];
  for (const e of effects) {
    const n = e.n, demon = voice === 'demon';
    switch (e.k) {
      case 'dmg': {
        const s = num(dm(n), n);
        out.push(demon ? (e.x > 1 ? `Hits you for ${s}, ${times(e.x)}.` : `Hits you for ${s}.`)
          : (e.x > 1 ? `Deal ${s} damage ${times(e.x)}.` : `Deal ${s} damage.`));
        break;
      }
      case 'aoe': { const s = num(dm(n), n); out.push(demon ? `Hits you for ${s}${e.x > 1 ? ', ' + times(e.x) : ''}.` : `Deal ${s} damage to ALL demons${e.x > 1 ? ' ' + times(e.x) : ''}.`); break; }
      case 'rand': out.push(demon ? `Hits you for ${num(dm(n), n)}, ${times(e.x)}.` : `Deal ${num(dm(n), n)} damage to a random demon ${times(e.x)}.`); break;
      case 'xAoe': out.push(`Deal ${num(dm(n), n)} damage to ALL demons X times.`); break;
      case 'perHeld': out.push(demon ? `Hits you for ${num(dm(n), n)}.` : `Deal ${num(dm(n), n)} damage for each card the demons hold.`); break;
      case 'ward': out.push(demon ? `Gains ${num(wd(n), n)} *Ward*.` : `Gain ${num(wd(n), n)} *Ward*.`); break;
      case 'heal': out.push(demon ? `Heals [${n}].` : `Heal [${n}] HP.`); break;
      case 'lose': out.push(demon ? `*Scorched* for [${n}].` : `Lose [${n}] HP.`); break;
      case 'burn': out.push(demon ? `Gives you [${n}] *Burn*.` : `Apply [${n}] *Burn*.`); break;
      case 'burnAll': out.push(demon ? `Gives you [${n}] *Burn*.` : `Apply [${n}] *Burn* to ALL demons.`); break;
      case 'expose': out.push(e.self ? (demon ? `Becomes *Exposed* [${n}].` : `You are *Exposed* [${n}].`) : demon ? `You are *Exposed* [${n}].` : `Apply [${n}] *Exposed*.`); break;
      case 'exposeAll': out.push(demon ? `You are *Exposed* [${n}].` : `Apply [${n}] *Exposed* to ALL demons.`); break;
      case 'shake': out.push(e.self ? (demon ? `Becomes *Shaken* [${n}].` : `You are *Shaken* [${n}].`) : demon ? `You are *Shaken* [${n}].` : `Apply [${n}] *Shaken*.`); break;
      case 'might': out.push(demon ? `Gains [${n}] *Might*.` : `Gain [${n}] *Might*.`); break;
      case 'faith': out.push(demon ? `Gains [${n}] *Faith*.` : `Gain [${n}] *Faith*.`); break;
      case 'thorns': out.push(demon ? `Gains [${n}] *Thorns*.` : `Gain [${n}] *Thorns*.`); break;
      case 'draw': out.push(`Draw ${n === 1 ? 'a card' : `[${n}] cards`}.`); break;
      case 'grace': out.push(`Gain [${n}] *Grace*.`); break;
      case 'nextWard': out.push(`Next turn, gain ${num(wd(n), n)} *Ward*.`); break;
      case 'foresee': out.push(`*Foresee* [${n}].`); break;
      case 'offer': out.push(n === 1 ? `*Offer* a card.` : `*Offer* [${n}] cards.`); break;
      case 'recall': out.push(`Put a card from the discard pile on top of the deck.`); break;
      case 'disarm': if (!e.if) out.push(`*Disarm* the demon.`); break;
      case 'disarmAll': out.push(`*Disarm* ALL demons.`); break;
      case 'rebuke': out.push(`*Rebuke*: the demon plays its card against itself.`); break;
      case 'rebukeAll': out.push(`ALL demons play their cards against themselves.`); break;
      case 'redeem': out.push(`*Redeem* the demon's card. It costs 0 this turn.`); break;
      case 'swap': out.push(`*Swap* a card in your hand for the demon's card.`); break;
      case 'purge': out.push(`*Banish* a card from your hand.`); break;
      case 'kindle': out.push(`Double the demon's *Burn*.`); break;
      case 'obols': out.push(demon ? `Steals [${n}] obols.` : `Gain [${n}] obols.`); break;
      case 'shuffleDeck': out.push(demon ? `Shuffles the deck.` : `Shuffle the deck.`); break;
      case 'addCard': out.push(`Shuffles ${plural(n, CARDS[e.id].name)} into the deck.`); break;
      case 'eatTop': out.push(`Eats the top card of the deck.`); break;
      case 'feedDevil': out.push(`The Devil gains [${n}] *Might*.`); break;
      case 'nothing': out.push(demon ? `Nothing happens.` : ``); break;
      case 'power': out.push(POWER_TEXT[e.id](n)); break;
      default: out.push(`(${e.k})`);
    }
  }
  return out.filter(Boolean).join(' ');
}
export const POWER_TEXT = {
  haloFlame: n => `At the start of your turn, apply [${n}] *Burn* to ALL demons.`,
  bell: n => `Whenever a demon is *Scorched*, deal [${n}] damage to ALL demons.`,
  prophecy: n => `At the start of your turn, *Foresee* [${n}].`,
  sanctuary: () => `Your *Ward* no longer fades.`,
  martyrdom: () => `Whenever you lose HP, deal that much damage to ALL demons.`,
  seraph: n => `At the start of your turn, gain [${n}] *Might*.`,
  covenant: () => `Whenever a demon plays a *Holy* card, gain 1 *Grace* and draw a card next turn.`,
  choir: n => `Whenever you play a card, gain [${n}] *Ward*.`,
};

// The upright text: flags first (like Retain), then effects, then Banish.
export function uprightText(card, mods) {
  const d = def(card);
  const parts = [];
  if (d.innate) parts.push('*Innate*.');
  if (d.retain) parts.push('*Retain*.');
  if (d.unplayable && !d.text) parts.push('*Unplayable*.');
  if (d.text) parts.push(fill(d.text, d.up, d.endInHand, mods));
  else parts.push(effectText(d.up, 'angel', mods));
  if (d.fleeting) parts.push('*Fleeting*.');
  if (d.banish) parts.push('*Banish*.');
  return parts.filter(Boolean).join(' ');
}
export function reversedText(card, mods) {
  const d = def(card);
  if (d.rtext) return d.rtext;
  return effectText(d.down, 'demon', mods);
}
// {0} is the n of the first effect (as a number token), {e0} the first end-of-turn effect's n.
function fill(t, up, end, mods) {
  const dm = mods?.dmg ?? (n => n);
  return t.replace(/\{(e?)(\d)\}/g, (_, e, i) => {
    const eff = (e ? end : up)[+i]; if (!eff) return '';
    return eff.k === 'dmg' ? num(dm(eff.n), eff.n) : `[${eff.n}]`;
  });
}

// How much a list of effects would hurt the angel if a demon played it (for the Devil's choice, intents and the bot).
export function threatOf(effects, might = 0) {
  let t = 0;
  for (const e of effects) {
    if (['dmg', 'aoe', 'rand', 'perHeld'].includes(e.k)) t += Math.max(0, e.n + might) * (e.x || 1);
    else if (e.k === 'xAoe') t += Math.max(0, e.n + might) * 2;
    else if (e.k === 'burn' || e.k === 'burnAll') t += e.n * 1.5;
    else if (e.k === 'expose' && !e.self) t += 3 * e.n;
    else if (e.k === 'shake' && !e.self) t += 2 * e.n;
    else if (e.k === 'might') t += 4 * e.n;
    else if (e.k === 'feedDevil') t += 4 * e.n;
    else if (e.k === 'lose') t -= e.n;
    else if (e.k === 'heal') t += e.n * .5;
    else if (e.k === 'ward') t += e.n * .3;
    else if (e.k === 'addCard') t += 3 * e.n;
    else if (e.k === 'obols') t += 1;
  }
  return t;
}
