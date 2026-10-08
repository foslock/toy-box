// Who drinks at the Five by Five, what the house changes, and what the bar sells. No DOM.
import { H, isFace, contains } from './cards.js';

// The regulars: buy one a drink and they sit in at your table. Each bends the arithmetic, and some bend the rules.
// Hooks (all optional):
//   card(ctx, card, me)  → { chips, mult, x } for a card as it scores in a line
//   line(ctx, me)        → { chips, mult, x } for a whole line, after its cards
//   pay(run, result, me) → dollars after a table
//   burns                → more (or fewer) burns each table
//   peek                 → how many cards past the current one you can see
//   again(cell)          → true if the card in that square scores twice
//   onBurn(me)           → after you burn a card
// ctx: { hand, pay (the hand it's paid as), line, paid (Pair-or-better lines already paid this table), empty
//        (empty seats), rand }
const suitFan = (s, who, name) => ({
  id: who, name, tier: 1, text: `+3 Mult for every ${['♠', '♥', '♦', '♣'][s]} that scores.`,
  card: (c, k) => (k.s === s || k.e === 'wild') && { mult: 3 },
});
export const REGULARS = [
  { id: 'al', name: 'Big Al', tier: 1, text: '+4 Mult on every line.', line: () => ({ mult: 4 }) },
  { id: 'rusty', name: 'Rusty', tier: 1, text: '+25 Chips on every line with a Pair or better.', line: c => c.hand >= H.pair && { chips: 25 } },
  suitFan(1, 'rosa', 'Rosa'),
  suitFan(2, 'dolores', 'Dolores'),
  suitFan(0, 'spike', 'Spike'),
  suitFan(3, 'clem', 'Clem'),
  { id: 'duchess', name: 'The Duchess', tier: 1, text: 'Jacks, Queens and Kings give +5 Mult when they score.', card: (c, k) => isFace(k.r) && { mult: 5 } },
  { id: 'ace', name: 'Ace Kowalski', tier: 1, text: 'Aces give +20 Chips and +4 Mult when they score.', card: (c, k) => k.r === 14 && { chips: 20, mult: 4 } },
  { id: 'shorty', name: 'Shorty', tier: 1, text: '2s to 6s give +15 Chips when they score.', card: (c, k) => k.r <= 6 && { chips: 15 } },
  { id: 'bouncer', name: 'The Bouncer', tier: 1, text: 'One more burn every table.', burns: 1 },
  { id: 'banker', name: 'Banker Bates', tier: 1, text: 'Pays you $4 after every table.', pay: () => 4 },
  { id: 'sal', name: 'Sal the Barber', tier: 2, text: '+12 Mult on lines with a Flush.', line: c => contains(c.hand, 'flush') && { mult: 12 } },
  { id: 'pinstripe', name: 'Pinstripe', tier: 2, text: '+12 Mult on lines with a Straight.', line: c => contains(c.hand, 'straight') && { mult: 12 } },
  { id: 'triplets', name: 'The Triplets', tier: 2, text: '+9 Mult on lines with Three of a Kind.', line: c => contains(c.hand, 'trips') && { mult: 9 } },
  { id: 'hustler', name: 'The Hustler', tier: 2, text: '×2 Mult on lines with Two Pair (full houses have two pair in them).', line: c => contains(c.hand, 'twopair') && { x: 2 } },
  { id: 'lucky', name: 'Lucky Pete', tier: 2, text: 'One line in three pays ×2 Mult. Which ones? Ask Pete.', line: c => c.rand() < 1 / 3 && { x: 2 } },
  { id: 'snake', name: 'The Snake', tier: 2, text: 'Each line gets +1 Mult for every Pair-or-better line paid before it.', line: c => c.paid > 0 && { mult: c.paid } },
  { id: 'mel', name: 'Matchstick Mel', tier: 2, text: '+1 Mult on every line for each card you burn while she sits in.', line: (c, me) => me.n > 0 && { mult: me.n }, onBurn: me => { me.n = (me.n || 0) + 1; } },
  { id: 'oldtom', name: 'Old Tom', tier: 2, text: '+5 Mult on every line for each empty seat at the table.', line: c => c.empty > 0 && { mult: 5 * c.empty } },
  { id: 'accountant', name: 'The Accountant', tier: 2, text: 'Pays $1 for every Flush, Full House or better on the board.', pay: (run, res) => res.lines.filter(l => !l.void && l.hand >= H.flush).length },
  { id: 'zora', name: 'Madame Zora', tier: 2, text: 'You can see the next two cards coming.', peek: 2 },
  { id: 'mechanic', name: 'The Mechanic', tier: 2, text: 'The card in the middle square scores twice.', again: cell => cell === 12 },
  { id: 'twins', name: 'Dot & Dash', tier: 2, text: 'Every Pair is paid as Two Pair.' },
  { id: 'widow', name: 'The Widow', tier: 3, text: 'Both diagonals pay ×3 Mult.', line: c => c.line.kind === 'diag' && { x: 3 } },
  { id: 'moe', name: 'Uncle Moe', tier: 3, text: 'Jacks, Queens and Kings are wild in columns.' },
  { id: 'prof', name: 'The Professor', tier: 3, text: 'Straights can turn the corner: Q K A 2 3 counts.' },
  { id: 'lou', name: 'Four-Finger Lou', tier: 3, text: 'Flushes and Straights need only four cards.' },
  { id: 'mayor', name: 'The Mayor', tier: 3, text: '×3 Mult on Four of a Kind or better.', line: c => c.hand >= H.quads && { x: 3 } },
  { id: 'gambler', name: 'The Gambler', tier: 3, text: '×1.5 Mult on every line, but one less burn each table.', line: () => ({ x: 1.5 }), burns: -1 },
];
export const REG = Object.fromEntries(REGULARS.map(r => [r.id, r]));
export const PRICE = [0, 4, 6, 8];
export const SEATS = 5;

// The house rules: every second table, the house changes one. x is what the rule does to the target, measured as
// what it costs a bare board (node fivebyfive/balance.mjs --rules), so every house table is about as hard.
export const BOSSES = [
  { id: 'wall', name: 'The Wall', text: 'The middle square is bricked up. Its four lines play with four cards.', x: .82 },
  { id: 'drop', name: 'The Drop', text: 'Cards fall to the bottom of whichever column you pick.', x: .78 },
  { id: 'tilt', name: 'The Tilt', text: 'Rows don’t pay tonight. Only columns and diagonals.', x: .9 },
  { id: 'masquerade', name: 'The Masquerade', text: 'You see a card’s suit, not its rank, until it’s down.', x: .65 },
  { id: 'miser', name: 'The Miser', text: 'No burning. Every card you draw goes on the table.', x: 1.1 },
  { id: 'snob', name: 'The Snob', text: 'High cards and Pairs don’t pay. Two Pair or better, please.', x: .7 },
  { id: 'pickpocket', name: 'The Pickpocket', text: 'Your last regular sits this one out.', x: .9 },
  { id: 'rush', name: 'The Rush', text: 'Eight seconds a card, or the dealer puts it down for you.', x: .95 },
  { id: 'crowd', name: 'The Crowd', text: 'Four strangers’ cards are already on the table.', x: 1.1 },
];
export const HOUSE = { id: 'house', name: 'The House', text: 'The middle is bricked up, and every card comes in masked.', rules: ['wall', 'masquerade'], x: .58 };
export const BOSS = Object.fromEntries([...BOSSES, HOUSE].map(b => [b.id, b]));
// gentle ones for the first boss
export const FIRST_BOSSES = ['wall', 'drop', 'miser', 'tilt', 'crowd'];

// Tricks: the bartender does things to your deck. Pick from seven cards dealt off it.
export const TRICKS = [
  { id: 'wild', name: 'Wild Ink', text: 'Up to two cards count as every suit.', pick: 2, price: 4 },
  { id: 'chalk', name: 'Blue Chalk', text: 'Up to two cards give +30 Chips when they score.', pick: 2, price: 3 },
  { id: 'redpen', name: 'Red Pencil', text: 'Up to two cards give +4 Mult when they score.', pick: 2, price: 3 },
  { id: 'glass', name: 'Glass Card', text: 'One card gives ×1.5 Mult when it scores. One time in four it shatters after the table.', pick: 1, price: 4 },
  { id: 'shave', name: 'The Shave', text: 'Up to two cards leave your deck for good.', pick: 2, price: 3 },
  { id: 'copy', name: 'Carbon Copy', text: 'One card gets a twin in your deck.', pick: 1, price: 4 },
  { id: 'dye0', name: 'Spade Dye', text: 'Up to three cards turn into Spades.', pick: 3, price: 3, dye: 0 },
  { id: 'dye1', name: 'Heart Dye', text: 'Up to three cards turn into Hearts.', pick: 3, price: 3, dye: 1 },
  { id: 'dye2', name: 'Diamond Dye', text: 'Up to three cards turn into Diamonds.', pick: 3, price: 3, dye: 2 },
  { id: 'dye3', name: 'Club Dye', text: 'Up to three cards turn into Clubs.', pick: 3, price: 3, dye: 3 },
];
export const TRICK = Object.fromEntries(TRICKS.map(t => [t.id, t]));
export const MIN_DECK = 34;   // The Shave stops here, so a table never runs out of cards

// Felt work: paint a square on your table for the rest of the night.
export const FELT = [
  { id: 'hot', name: 'Hot Square', text: 'Every line through it pays ×2 Mult.', price: 8 },
  { id: 'lucky', name: 'Lucky Square', text: 'Every line through it gets +6 Mult.', price: 5 },
  { id: 'gold', name: 'Gold Square', text: 'Pays $1 for every Pair-or-better line through it.', price: 4 },
  { id: 'keeper', name: 'Keeper Square', text: 'The card you put here stays on for the next table.', price: 4 },
  { id: 'hole', name: 'The Hole', text: 'No card goes here. It counts as whatever card each of its lines needs most.', price: 10, most: 2 },
];
export const FELT_OF = Object.fromEntries(FELT.map(f => [f.id, f]));
