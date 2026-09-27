// The rules of the farm: its size, what the dirt is made of, the ants you can buy, the upgrades and the prices.
// Shared by the simulation (sim.js), the page (main.js) and the headless balance runs (balance.mjs), so a number
// changed here changes it everywhere. Times are in seconds of farm time; speeds in cells a second.

export const W = 192, H = 128;           // cells across and down: one cell is one pixel of dirt
export const DEPTH = 8;                  // cells from the front glass to the back (only for drawing: the sim is flat)
export const SURFACE = Math.round(H / 3);    // the dirt starts a third of the way down, so it's two-thirds full

// What a cell can be. Food is never a cell: it sits in pockets (sources) and rides in ants' jaws.
export const AIR = 0, TOPSOIL = 1, LOAM = 2, SAND = 3, CLAY = 4, GRAVEL = 5, SPOIL = 6, ROCK = 7, THING = 8, ROOT = 9;
// hard: seconds a plain worker spends digging one cell of it. Anything without one can't be dug.
export const MATS = [
  { name: 'Air' },
  { name: 'Topsoil', hard: 0.8 },
  { name: 'Loam', hard: 1 },
  { name: 'Sand', hard: 0.6 },
  { name: 'Clay', hard: 1.6 },
  { name: 'Gravel', hard: 1.3 },
  { name: 'Loose dirt', hard: 0.45 },    // dug-out dirt the ants have piled up on top
  { name: 'Rock' },
  { name: 'Something buried' },
  { name: 'Root' },
];
export const diggable = m => m >= TOPSOIL && m <= SPOIL;

// The ants you can buy. speed: cells a second; dig: how fast they dig (a worker is 1); carry: crumbs per trip;
// spoil: cells of dug dirt they hold before hauling it up; smell: how far off (cells) they notice buried food;
// hunger: seconds a full ant lasts before it's empty. Each ant eats one crumb when it gets hungry.
export const ANTS = {
  worker: { name: 'Worker', cost: 10, speed: 5, dig: 1, carry: 1, spoil: 3, smell: 22, hunger: 180,
    blurb: 'Fetches food. Helps dig when there’s nothing to fetch.' },
  digger: { name: 'Digger', cost: 25, speed: 4.8, dig: 3.2, carry: 1, spoil: 8, smell: 20, hunger: 160,
    blurb: 'Big jaws: digs tunnels and rooms three times as fast.' },
  scout: { name: 'Scout', cost: 25, speed: 7, dig: 1.3, carry: 1, spoil: 3, smell: 50, hunger: 180,
    blurb: 'Quick and keen-nosed. Wanders off and sniffs out buried food.' },
  nurse: { name: 'Nurse', cost: 20, speed: 4.4, dig: 0.8, carry: 1, spoil: 2, smell: 16, hunger: 190, needs: 'queen',
    blurb: 'Looks after the queen’s eggs, so they hatch twice as fast.' },
  officer: { name: 'Officer', cost: 60, speed: 5, dig: 1, carry: 2, spoil: 4, smell: 24, hunger: 170,
    blurb: 'Ants near her work a quarter faster, and she takes your orders to dig.' },
  queen: { name: 'Queen', cost: 150, speed: 2.4, dig: 0.6, carry: 0, spoil: 0, smell: 10, hunger: 110, max: 1,
    blurb: 'Lays eggs that hatch into workers, whenever there’s food to spare.' },
};
export const ANT_ORDER = ['worker', 'digger', 'scout', 'nurse', 'officer', 'queen'];

export const HUNGRY = 0.35;              // below this much energy an ant stops what it's doing to eat
export const STARVE = 75;                // seconds an ant can go on empty before it dies
export const START_FOOD = 6;             // crumbs the first ant brings with it
export const OFFICER = { r: 16, boost: 1.25 };
// The queen lays when the pantry has more than `reserve` + `perAnt` for every ant, and only while the colony is
// smaller than the never-ending food can feed; each egg takes `cost` crumbs. An egg becomes a larva, then a pupa,
// then a worker (seconds per stage; nurses halve them).
export const BROOD = { cost: 4, every: 40, reserve: 20, perAnt: 1.5, max: 8, stages: [30, 45, 30] };

// Colony-wide upgrades, three levels each.
export const UPGRADES = [
  { id: 'jaws', name: 'Strong jaws', blurb: 'Every ant digs 40% faster.', costs: [30, 90, 240] },
  { id: 'loads', name: 'Big loads', blurb: 'One more crumb per trip, and twice the dirt.', costs: [40, 120, 300] },
  { id: 'legs', name: 'Long legs', blurb: 'Every ant walks 15% faster.', costs: [30, 90, 220] },
  { id: 'thrift', name: 'Small appetites', blurb: 'Ants get hungry 15% slower.', costs: [50, 140, 320] },
  { id: 'nose', name: 'Keen antennae', blurb: 'Ants smell buried food 50% further off.', costs: [25, 70, 160] },
  { id: 'ranch', name: 'Aphid ranching', blurb: 'Aphids make honeydew 30% faster.', costs: [60, 160, 380] },
];
export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
export const MAX_LEVEL = 3;

// Food. Pockets run out; the sugar drip and aphids never do, but only make one crumb every `period` seconds and hold
// at most `cap`, so they can feed only so many ants.
export const SOURCES = {
  drip: { name: 'Sugar drip', infinite: true, period: 8, cap: 5, look: 'drop' },
  aphids: { name: 'Aphids', infinite: true, period: 12, cap: 6, look: 'honeydew' },
  seeds: { name: 'Seed cache', amount: [36, 56], look: 'seed' },
  beetle: { name: 'Dead beetle', amount: [40, 60], look: 'meat' },
  berry: { name: 'Fallen berry', amount: [26, 40], look: 'berry' },
  sugar: { name: 'Sugar lump', amount: [30, 46], look: 'sugar' },
  crumbs: { name: 'Crumbs', amount: [8, 8], look: 'crumb' },
};

// Things to put in the farm besides ants.
export const ITEMS = {
  aphids: { name: 'Aphid herd', cost: 60, blurb: 'A root with aphids on it. They make honeydew forever, a drop every 12 seconds.' },
  feed: { name: 'Crumbs', cost: 0, cooldown: 120, amount: 8, blurb: 'Drop a few crumbs in through the lid. Free, every couple of minutes.' },
};

export const MAX_ANTS = 160;
// Each aphid herd you buy costs 30% more than the last.
export const aphidCost = bought => Math.round(ITEMS.aphids.cost * 1.3 ** bought / 5) * 5;
