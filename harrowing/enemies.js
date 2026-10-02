// The demons, circle by circle. Each brings its own Infernal cards into the shared deck for the fight, and most
// have a trait that bends the rules of the deck: some shuffle it, some eat it, some read your cards upright.
//
// fields: name, hp [min, max], might (added to every hit), draws (cards it draws each round), deck (its Infernal
// cards), traits, look (how it's drawn: see puppets.js), size (1 is an imp), title (a line under the name)

export const TRAITS = {
  fallen: { name: 'Fallen', text: 'Reads cards upright: it plays the angel\'s side of whatever it draws.' },
  devil: { name: 'Father of Lies', text: 'Reads each card whichever way hurts you more.' },
  devour: { name: 'Devour', text: 'Swallows every card it plays. It coughs them back up when it loses a head.' },
  whirl: { name: 'Whirlwind', text: 'Shuffles the deck at the start of every round, before anyone draws.' },
  hoard: { name: 'Hoard', text: 'Each round it hoards one of the cards it drew (the one that would hurt you least). At four, it spends the whole hoard at once. It all falls to the discard pile when it dies.' },
  wrath: { name: 'Wrath', text: 'Gains 1 Might whenever your attacks hurt it.' },
  mimic: { name: 'Mimic', text: 'Takes the top card of the discard pile instead of drawing from the deck.' },
  lurker: { name: 'Lurker', text: 'Holds its card face down. Foresee or Redeem it to find out what it is.' },
  frozen: { name: 'Frozen', text: 'Gains Ward at the start of every round.' },
  profane: { name: 'Profane', text: 'Holy cards it draws don\'t hurt it: it eats them and draws again.' },
  regen: { name: 'Regenerate', text: 'Heals at the end of every round.' },
  explode: { name: 'Volatile', text: 'Bursts when it dies, hitting you.' },
  bond: { name: 'Bound', text: 'When its partner dies, it gains 3 Might and heals 15.' },
  summoner: { name: 'Summoner', text: 'Calls more demons every few rounds.' },
  heads: { name: 'Three Heads', text: 'Each head draws a card. A head slumps at two-thirds and one-third of its HP, and it coughs up every card it ate.' },
  thorns: { name: 'Thorns', text: 'Whenever you attack it, you take damage.' },
  glutton: { name: 'Glutton', text: 'Eats the top card of the deck at the end of every round.' },
};

export const ENEMIES = {
  /* ---------- Act I: Limbo, Lust, Gluttony ---------- */
  imp: { name: 'Imp', hp: [13, 16], might: 1, draws: 1, deck: ['ember', 'ember'], traits: [], look: 'imp', size: .8 },
  lostSoul: { name: 'Lost Soul', hp: [9, 11], might: 0, draws: 1, deck: ['wail'], traits: [], look: 'soul', size: .7 },
  shade: { name: 'Shade', hp: [30, 34], might: 2, draws: 2, deck: ['chill', 'chill'], traits: [], look: 'shade', size: 1 },
  succubus: { name: 'Succubus', hp: [34, 38], might: 2, draws: 2, deck: ['kiss', 'kiss'], traits: [], look: 'succubus', size: 1 },
  wraith: { name: 'Tempest Wraith', hp: [34, 38], might: 1, draws: 2, deck: ['gale', 'gale'], traits: [{ id: 'whirl' }], look: 'wraith', size: 1.05 },
  glutton: { name: 'Glutton', hp: [44, 48], might: 1, draws: 2, deck: ['gorge', 'gorge'], traits: [{ id: 'glutton' }], look: 'glutton', size: 1.25 },
  bloat: { name: 'Bloated Imp', hp: [17, 20], might: 1, draws: 1, deck: ['bile'], traits: [{ id: 'explode', n: 5 }], look: 'bloat', size: .85 },
  // elites
  flylord: { name: 'Lord of Flies', hp: [88, 92], might: 2, draws: 2, deck: ['buzz', 'buzz', 'ember'], traits: [{ id: 'summoner', every: 3, what: 'fly', n: 2 }], look: 'flylord', size: 1.3, elite: true },
  fly: { name: 'Carrion Fly', hp: [6, 7], might: 0, draws: 1, deck: [], traits: [], look: 'fly', size: .95, minion: true },
  paolo: { name: 'Paolo', hp: [48, 50], might: 2, draws: 1, deck: ['kiss'], traits: [{ id: 'bond' }], look: 'lover', size: 1, elite: true, title: 'One of the Lovers' },
  francesca: { name: 'Francesca', hp: [48, 50], might: 2, draws: 1, deck: ['kiss'], traits: [{ id: 'bond' }], look: 'lover2', size: 1, elite: true, title: 'One of the Lovers' },
  minos: { name: 'Minos', hp: [96, 100], might: 2, draws: 3, deck: ['chill', 'ember'], traits: [], look: 'minos', size: 1.4, elite: true, title: 'Judge of the Damned' },
  // boss
  cerberus: { name: 'Cerberus', hp: [190, 190], might: 1, draws: 3, deck: ['bite', 'bite', 'bite', 'gorge'], traits: [{ id: 'heads' }, { id: 'devour' }], look: 'cerberus', size: 2.3, boss: true, title: 'Hound of Gluttony' },

  /* ---------- Act II: Greed, Wrath, Heresy ---------- */
  coinDevil: { name: 'Coin Devil', hp: [46, 50], might: 2, draws: 2, deck: ['coin', 'coin'], traits: [], look: 'coinDevil', size: .95 },
  hoarder: { name: 'Hoarder', hp: [70, 77], might: 4, draws: 2, deck: ['gold'], traits: [{ id: 'hoard' }], look: 'hoarder', size: 1.15 },
  wrathling: { name: 'Wrathling', hp: [36, 41], might: 2, draws: 1, deck: ['rage'], traits: [{ id: 'wrath' }], look: 'wrathling', size: .9 },
  leech: { name: 'Styx Leech', hp: [60, 65], might: 3, draws: 2, deck: ['mire', 'mire'], traits: [{ id: 'regen', n: 3 }], look: 'leech', size: 1.05 },
  heretic: { name: 'Heretic', hp: [55, 60], might: 2, draws: 2, deck: ['blasphemy', 'blasphemy'], traits: [{ id: 'profane' }], look: 'heretic', size: 1 },
  cleric: { name: 'Fallen Cleric', hp: [60, 65], might: 2, draws: 2, deck: ['censure', 'censure'], traits: [{ id: 'fallen' }], look: 'cleric', size: 1.05 },
  // elites
  plutus: { name: 'Plutus', hp: [128, 134], might: 2, draws: 3, deck: ['gold', 'coin', 'coin'], traits: [{ id: 'hoard' }, { id: 'thorns', n: 2 }], look: 'plutus', size: 1.45, elite: true, title: 'Wolf of Wealth' },
  phlegyas: { name: 'Phlegyas', hp: [118, 124], might: 3, draws: 2, deck: ['rage', 'mire', 'rage'], traits: [{ id: 'wrath' }, { id: 'summoner', every: 3, what: 'wrathling', n: 1 }], look: 'phlegyas', size: 1.35, elite: true, title: 'Boatman of the Styx' },
  seraphFallen: { name: 'Fallen Seraph', hp: [126, 132], might: 2, draws: 2, deck: ['censure', 'blasphemy'], traits: [{ id: 'fallen' }], look: 'fallenSeraph', size: 1.35, elite: true, title: 'Once of the Choir' },
  // boss: the three Furies
  alecto: { name: 'Alecto', hp: [72, 72], might: 2, draws: 1, deck: ['whip', 'hellfire'], traits: [{ id: 'wrath' }], look: 'fury1', size: 1.15, boss: true, title: 'Unceasing Anger' },
  megaera: { name: 'Megaera', hp: [72, 72], might: 2, draws: 1, deck: ['whip', 'whip'], traits: [{ id: 'mimic' }], look: 'fury2', size: 1.15, boss: true, title: 'Jealous Rage' },
  tisiphone: { name: 'Tisiphone', hp: [72, 72], might: 2, draws: 1, deck: ['whip', 'hellfire'], traits: [{ id: 'thorns', n: 2 }], look: 'fury3', size: 1.15, boss: true, title: 'Avenger of Murder' },

  /* ---------- Act III: Violence, Fraud, Treachery ---------- */
  centaur: { name: 'Centaur', hp: [84, 90], might: 5, draws: 2, deck: ['volley', 'volley'], traits: [], look: 'centaur', size: 1.3 },
  harpy: { name: 'Harpy', hp: [52, 57], might: 5, draws: 1, deck: ['hook'], traits: [], look: 'harpy', size: .95 },
  malebranche: { name: 'Malebranche', hp: [62, 70], might: 4, draws: 2, deck: ['pitch', 'hook'], traits: [{ id: 'mimic' }], look: 'malebranche', size: 1 },
  flatterer: { name: 'Flatterer', hp: [78, 83], might: 6, draws: 2, deck: ['lie', 'lie'], traits: [{ id: 'lurker' }], look: 'flatterer', size: 1 },
  traitor: { name: 'Frozen Traitor', hp: [81, 88], might: 4, draws: 2, deck: ['frostbite', 'betrayal'], traits: [{ id: 'frozen', n: 8 }], look: 'traitor', size: 1.1 },
  iceWraith: { name: 'Ice Wraith', hp: [60, 65], might: 4, draws: 2, deck: ['frostbite', 'frostbite'], traits: [{ id: 'whirl' }], look: 'iceWraith', size: 1.05 },
  // elites
  minotaur: { name: 'Minotaur', hp: [176, 184], might: 4, draws: 2, deck: ['gore', 'gore', 'rage'], traits: [{ id: 'wrath' }], look: 'minotaur', size: 1.55, elite: true, title: 'Infamy of Crete' },
  geryon: { name: 'Geryon', hp: [196, 204], might: 5, draws: 3, deck: ['lie', 'whip', 'pitch'], traits: [{ id: 'lurker' }], look: 'geryon', size: 1.5, elite: true, title: 'Image of Fraud' },
  nimrod: { name: 'Nimrod', hp: [210, 220], might: 6, draws: 2, deck: ['gore', 'frostbite', 'frostbite'], traits: [{ id: 'frozen', n: 12 }], look: 'nimrod', size: 1.7, elite: true, title: 'The Giant Who Built Babel' },
  // the Devil
  devil: { name: 'The Devil', hp: [270, 270], might: 2, draws: 3, deck: ['pact', 'pact', 'hellfire', 'wingstorm'], traits: [{ id: 'devil' }], look: 'devil', size: 3.1, boss: true, title: 'Emperor of the Dolorous Realm' },
};
for (const [id, e] of Object.entries(ENEMIES)) e.id = id;

// The nine circles, three to an act. Each circle is three rows of the map.
export const CIRCLES = [
  { name: 'Limbo', sin: 'the Unbaptised', act: 0 },
  { name: 'Lust', sin: 'the Carnal', act: 0 },
  { name: 'Gluttony', sin: 'the Gluttonous', act: 0 },
  { name: 'Greed', sin: 'the Avaricious', act: 1 },
  { name: 'Wrath', sin: 'the Wrathful', act: 1 },
  { name: 'Heresy', sin: 'the Heretics', act: 1 },
  { name: 'Violence', sin: 'the Violent', act: 2 },
  { name: 'Fraud', sin: 'the Fraudulent', act: 2 },
  { name: 'Treachery', sin: 'the Traitors', act: 2 },
];
export const ACTS = [
  { name: 'The Upper Circles', boss: [['cerberus']] },
  { name: 'The City of Dis', boss: [['alecto', 'megaera', 'tisiphone']] },
  { name: 'The Pit', boss: [['devil']] },
];

// Fights per circle. "early" fights are the first two of an act; the rest come from "normal".
export const ENCOUNTERS = {
  0: { // Limbo
    early: [['imp', 'imp'], ['lostSoul', 'lostSoul', 'lostSoul'], ['shade']],
    normal: [['shade', 'lostSoul'], ['imp', 'imp', 'lostSoul']],
  },
  1: { // Lust
    normal: [['succubus'], ['wraith'], ['succubus', 'imp'], ['wraith', 'lostSoul'], ['imp', 'imp', 'imp']],
  },
  2: { // Gluttony
    normal: [['glutton'], ['bloat', 'bloat'], ['glutton', 'imp'], ['bloat', 'shade'], ['bloat', 'imp', 'imp']],
  },
  3: { // Greed
    early: [['coinDevil'], ['coinDevil', 'coinDevil']],
    normal: [['hoarder'], ['hoarder', 'coinDevil'], ['coinDevil', 'wrathling']],
  },
  4: { // Wrath
    normal: [['wrathling', 'wrathling'], ['leech'], ['leech', 'wrathling'], ['wrathling', 'wrathling', 'wrathling']],
  },
  5: { // Heresy
    normal: [['heretic'], ['cleric'], ['heretic', 'cleric'], ['cleric', 'wrathling'], ['heretic', 'coinDevil']],
  },
  6: { // Violence
    early: [['harpy', 'harpy'], ['centaur']],
    normal: [['centaur', 'harpy'], ['harpy', 'harpy', 'harpy']],
  },
  7: { // Fraud
    normal: [['malebranche', 'malebranche'], ['flatterer'], ['flatterer', 'malebranche'], ['malebranche', 'harpy']],
  },
  8: { // Treachery
    normal: [['traitor'], ['iceWraith', 'iceWraith'], ['traitor', 'iceWraith'], ['traitor', 'harpy']],
  },
};
export const ELITES = [
  [['flylord'], ['paolo', 'francesca'], ['minos']],
  [['plutus'], ['phlegyas'], ['seraphFallen']],
  [['minotaur'], ['geryon'], ['nimrod']],
];
