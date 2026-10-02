// Charms: the angel's relics. Each is a few hooks the fight engine (or the run) calls at the right moments.
// rarity: starter, common, uncommon, rare, boss, shop. `rule` charms change the rules of the shared deck itself.
//
// Hooks: fightStart(b), turnStart(b), turnEnd(b), played(b, card, def), scorched(b, demon, n), demonPlays(b, demon,
// def), loseHp(b, n), demonDies(b, demon), shuffled(b), offered(b, card), fightEnd(run, b) and pickup(run).
// b is the Battle (engine.js); b.say(text) shows a charm's little flash.

export const CHARMS = {
  halo: { name: 'Halo', rarity: 'starter', glyph: 'halo', text: 'At the end of each fight, heal 6 HP.',
    fightEnd(run) { run.heal(6); } },

  /* --- common --- */
  lambWool: { name: 'Lamb\'s Wool', rarity: 'common', glyph: 'wool', text: 'Start each fight with 8 Ward.',
    async fightStart(b) { await b.gainWard(b.angel, 8, { raw: true }); } },
  thurible: { name: 'Thurible', rarity: 'common', glyph: 'censer', text: 'At the start of each fight, apply 3 Burn to ALL demons.',
    async fightStart(b) { for (const d of b.living()) await b.addStatus(d, 'burn', 3); } },
  vesperBell: { name: 'Vesper Bell', rarity: 'common', glyph: 'bell', text: 'At the start of your turn, Foresee 1.',
    async turnStart(b) { await b.foresee(1); } },
  rosary: { name: 'Rosary', rarity: 'common', glyph: 'rosary', text: 'Every 7th card you play gives you 1 Grace.', counter: true,
    async played(b) { const c = b.charmCount('rosary', 1); if (c % 7 === 0) { b.flash('rosary'); await b.gainGrace(1); } } },
  mustardSeed: { name: 'Mustard Seed', rarity: 'common', glyph: 'seed', text: 'Your first attack in each fight deals double damage.',
    fightStart(b) { b.flags.seed = true; } },
  sackcloth: { name: 'Sackcloth', rarity: 'common', glyph: 'sack', text: 'Whenever a demon hurts you, gain 3 Ward.',
    async hurtBy(b) { b.flash('sackcloth'); await b.gainWard(b.angel, 3, { raw: true }); } },
  thornCrown: { name: 'Crown of Thorns', rarity: 'common', glyph: 'thornCrown', text: 'Start each fight with 3 Thorns.',
    async fightStart(b) { await b.addStatus(b.angel, 'thorns', 3); } },
  titheBox: { name: 'Tithe Box', rarity: 'common', glyph: 'box', text: 'Whenever a demon is Scorched by a Holy card, gain 6 obols.',
    scorched(b) { b.flash('titheBox'); b.obols(6); } },
  saltCellar: { name: 'Salt Cellar', rarity: 'common', glyph: 'salt', text: 'Demons are Scorched for 3 more by Holy cards.' },
  featherQuill: { name: 'Gabriel\'s Feather', rarity: 'common', glyph: 'feather', text: 'Draw 2 more cards on your first turn of each fight.',
    fightStart(b) { b.flags.extraFirstDraw = (b.flags.extraFirstDraw ?? 0) + 2; } },
  lantern: { name: 'Virgil\'s Lantern', rarity: 'common', glyph: 'lantern', text: 'Gain 1 extra Grace on your first turn of each fight.',
    fightStart(b) { b.flags.extraFirstGrace = (b.flags.extraFirstGrace ?? 0) + 1; } },
  votive: { name: 'Votive Candle', rarity: 'common', glyph: 'candle', text: 'Burn you apply is 1 higher.' },
  arkSplinter: { name: 'Splinter of the Ark', rarity: 'common', glyph: 'splinter', text: 'Raise your Max HP by 10.',
    pickup(run) { run.maxHp += 10; run.hp += 10; } },
  oliveBranch: { name: 'Olive Branch', rarity: 'common', glyph: 'olive', text: 'Resting at a Sanctuary heals 12 more HP.' },

  /* --- uncommon --- */
  eye: { name: 'Eye of Providence', rarity: 'uncommon', glyph: 'eye', text: 'You can always see the top card of the deck.', rule: 'eye' },
  shepherd: { name: 'Shepherd\'s Crook', rarity: 'uncommon', glyph: 'crook', text: 'Whenever you Offer a card, gain 1 Grace.',
    async offered(b) { b.flash('shepherd'); await b.gainGrace(1); } },
  buddingRod: { name: 'Budding Rod', rarity: 'uncommon', glyph: 'rod', text: 'Whenever a demon dies, draw 2 cards.',
    async demonDies(b) { if (b.living().length) { b.flash('buddingRod'); await b.draw(2); } } },
  sevenLamps: { name: 'Seven Lamps', rarity: 'uncommon', glyph: 'lamps', text: 'Whenever the deck is reshuffled, gain 5 Ward.',
    async shuffled(b) { b.flash('sevenLamps'); await b.gainWard(b.angel, 5, { raw: true }); } },
  brazenSerpent: { name: 'Brazen Serpent', rarity: 'uncommon', glyph: 'serpent', text: 'Whenever a demon plays one of its own Infernal cards, it takes 4 damage.',
    async demonPlays(b, d, def) { if (def.rarity === 'infernal' && d.hp > 0) { b.flash('brazenSerpent'); await b.hurt(d, 4, null); } } },
  wormwood: { name: 'Wormwood', rarity: 'uncommon', glyph: 'wormwood', text: 'Infernal cards cost 0 for you.', rule: 'infernalFree' },
  easterLily: { name: 'White Lily', rarity: 'uncommon', glyph: 'lily', text: 'Whenever you Banish a card, heal 2 HP.',
    async banished(b) { b.flash('easterLily'); await b.healAngel(2); } },
  chorusStone: { name: 'Chorus Stone', rarity: 'uncommon', glyph: 'choir', text: 'Whenever you play a Power, gain 6 Ward and draw a card.',
    async played(b, card, d) { if (d.type === 'power') { b.flash('chorusStone'); await b.gainWard(b.angel, 6, { raw: true }); await b.draw(1); } } },
  millstone: { name: 'Millstone', rarity: 'uncommon', glyph: 'stone', text: 'Demons start each fight Shaken for 2 rounds.',
    async fightStart(b) { for (const d of b.living()) await b.addStatus(d, 'shaken', 2); } },
  holyOil: { name: 'Holy Oil', rarity: 'uncommon', glyph: 'vial', text: 'Holy cards you play deal 3 more damage.' },

  /* --- rare --- */
  phoenix: { name: 'Phoenix Feather', rarity: 'rare', glyph: 'phoenix', text: 'The first time you would die, heal to half your Max HP instead.', used: false },
  saintFinger: { name: 'Saint\'s Knucklebone', rarity: 'rare', glyph: 'bone', text: 'Demons draw two cards and must play the one that hurts you less.', rule: 'saintFinger' },
  jerichoHorn: { name: 'Horn of Jericho', rarity: 'rare', glyph: 'trumpet', text: 'At the start of your 4th turn, deal 30 damage to ALL demons.',
    async turnStart(b) { if (b.turn === 4) { b.flash('jerichoHorn'); await b.aoe(b.angel, 30, { raw: true }); } } },
  grail: { name: 'Grail', rarity: 'rare', glyph: 'chalice', text: 'At the end of your turn, if you have no Ward, gain 8 Ward.',
    async turnEnd(b) { if (b.angel.ward === 0) { b.flash('grail'); await b.gainWard(b.angel, 8, { raw: true }); } } },
  manyEyes: { name: 'Wheel of Eyes', rarity: 'rare', glyph: 'wheel', text: 'At the start of each fight, Foresee 5 and draw 1 more card each turn.',
    fightStart(b) { b.flags.drawBonus = (b.flags.drawBonus ?? 0) + 1; b.flags.openForesee = 5; } },

  /* --- only at the Ferryman's --- */
  ferryCoin: { name: 'Ferryman\'s Obol', rarity: 'shop', glyph: 'coin', text: 'Everything the Ferryman sells costs 20% less.' },
  pilgrimStaff: { name: 'Pilgrim\'s Staff', rarity: 'shop', glyph: 'rod', text: 'Whenever you meet a lost soul on the map, heal 8 HP.' },
  reliquary: { name: 'Reliquary Box', rarity: 'shop', glyph: 'box', text: 'Fights offer you 4 cards to choose from instead of 3.' },

  /* --- boss: power, at a price --- */
  forbiddenFruit: { name: 'Forbidden Fruit', rarity: 'boss', glyph: 'apple', text: '+1 Grace every turn. Each fight starts with 2 Temptations shuffled into the deck (a demon that draws one gains Might).',
    grace: 1, fightStart(b) { b.addToDeck('temptation', 2); } },
  silver: { name: 'Thirty Pieces of Silver', rarity: 'boss', glyph: 'coins', text: '+1 Grace every turn. Demons have 1 more Might.',
    grace: 1, async fightStart(b) { for (const d of b.living()) d.st.might += 1; } },
  clippedWings: { name: 'Clipped Wings', rarity: 'boss', glyph: 'clipped', text: '+1 Grace every turn. Draw 1 fewer card each turn.',
    grace: 1, fightStart(b) { b.flags.drawBonus = (b.flags.drawBonus ?? 0) - 1; } },
  ironCrown: { name: 'Iron Crown', rarity: 'boss', glyph: 'ironCrown', text: '+1 Grace every turn. You can no longer rest at Sanctuaries.',
    grace: 1 },
  eyeHeaven: { name: 'All-Seeing Eye', rarity: 'boss', glyph: 'eyeStar', text: 'You can always see the top card of the deck, and Foresee 2 at the start of each turn.', rule: 'eye',
    async turnStart(b) { await b.foresee(2); } },
  knucklebone: { name: 'Martyr\'s Knucklebone', rarity: 'boss', glyph: 'bone', text: 'Demons draw two cards and must play the one that hurts you less.', rule: 'saintFinger' },
  seventhTrumpet: { name: 'Seventh Trumpet', rarity: 'boss', glyph: 'horn', text: 'Draw 1 more card each turn. At the start of your 7th turn, deal 77 damage to ALL demons.',
    fightStart(b) { b.flags.drawBonus = (b.flags.drawBonus ?? 0) + 1; },
    async turnStart(b) { if (b.turn === 7) { b.flash('seventhTrumpet'); await b.aoe(b.angel, 77, { raw: true }); } } },
  pandora: { name: 'Pandora\'s Jar', rarity: 'boss', glyph: 'jar', text: 'When you take this, every Smite and Ward in your deck turns into a random card.',
    pickup(run) { run.pandora(); } },
};
for (const [id, c] of Object.entries(CHARMS)) c.id = id;
export const charmPool = rarity => Object.values(CHARMS).filter(c => c.rarity === rarity);
