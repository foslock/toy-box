// The rules of the dig: how big the world is, what the ground is made of, the layers down to the core, everything
// there is to find and what it sells for, and the worm's upgrades and their prices. Shared by the simulation (sim.js),
// the world builder (world.js), the page (main.js) and the headless balance runs (balance.mjs), so a number changed
// here changes it everywhere. Distances are in cells (one cell is one pixel of ground, and a metre of depth); times
// in seconds; speeds in cells a second.

export const W = 256;                    // cells across: narrow, so the camp is never far off to the side
export const GROUND = 120;               // the row the ground starts on (the sky is above it)
export const CORE_DEPTH = 6080;          // metres from the ground down to the top of the core
export const CORE_R = 120;               // the core's radius, in cells
export const CORE_X = W / 2, CORE_Y = GROUND + CORE_DEPTH + CORE_R;
export const H = 6400;                   // rows in all, sky included
export const BAND = 64;                  // the world is built (and saved) in bands this many rows tall
export const BANDS = H / BAND;

/* ---------- what a cell can be ---------- */
export const AIR = 0, WATER = 1, LAVA = 2, GAS = 3,
  SOIL = 4, ROOT = 5, MOSS = 6, STONE = 7, CLAY = 8, SAND = 9, GRAVEL = 10, LIME = 11, GRANITE = 12, GEODE = 13,
  CRYSTAL = 14, BASALT = 15, OBSIDIAN = 16, RUIN = 17, MANTLE = 18, ALLOY = 19, CORE = 20,
  COAL = 21, COPPER = 22, SILVER = 23, GOLD = 24, PLATINUM = 25, EMBERITE = 26, CIRCUIT = 27, IRIDIUM = 28;
export const NMAT = 29;
// tier: the Vibration level the worm needs to shake through it (99: nothing can). speed: how fast the worm swims
// through it, as a share of its best. ore: dollars a cell is worth when eaten (ores go in the belly, 20 cells a
// slot). glow: how much light it gives off.
export const MATS = [];
const m = (id, name, o) => { MATS[id] = { id, name, tier: -1, speed: 1, solid: false, liquid: false, granular: false, ore: 0, glow: 0, ...o }; };
m(AIR, 'Air', {});
m(WATER, 'Water', { liquid: true });
m(LAVA, 'Lava', { liquid: true, glow: 1 });
m(GAS, 'Firedamp', {});
m(SOIL, 'Topsoil', { solid: true, tier: 0, speed: 1 });
m(ROOT, 'Roots', { solid: true, tier: 0, speed: .82 });
m(MOSS, 'Glowmoss', { solid: true, tier: 0, speed: 1, glow: .45 });
m(STONE, 'Fieldstone', { solid: true, tier: 1, speed: .84 });
m(CLAY, 'Clay', { solid: true, tier: 1, speed: .93 });
m(SAND, 'Sand', { solid: true, tier: 1, speed: 1.06, granular: true });
m(GRAVEL, 'Gravel', { solid: true, tier: 1, speed: .9, granular: true });
m(LIME, 'Limestone', { solid: true, tier: 2, speed: .87 });
m(GRANITE, 'Granite', { solid: true, tier: 3, speed: .82 });
m(GEODE, 'Geode rock', { solid: true, tier: 4, speed: .8 });
m(CRYSTAL, 'Crystal', { solid: true, tier: 5, speed: .72, glow: .6 });
m(BASALT, 'Basalt', { solid: true, tier: 5, speed: .78 });
m(OBSIDIAN, 'Obsidian', { solid: true, tier: 6, speed: .68 });
m(RUIN, 'Ruin stone', { solid: true, tier: 6, speed: .76 });
m(MANTLE, 'Mantle rock', { solid: true, tier: 7, speed: .74 });
m(ALLOY, 'Old alloy', { solid: true, tier: 99, speed: 0 });
m(CORE, 'The core', { solid: true, tier: 99, speed: 0, glow: 1 });
m(COAL, 'Coal', { solid: true, tier: 0, speed: .95, ore: .4 });
m(COPPER, 'Copper ore', { solid: true, tier: 1, speed: .9, ore: 1.3 });
m(SILVER, 'Silver ore', { solid: true, tier: 2, speed: .88, ore: 5 });
m(GOLD, 'Gold ore', { solid: true, tier: 3, speed: .86, ore: 15 });
m(PLATINUM, 'Platinum ore', { solid: true, tier: 4, speed: .84, ore: 44 });
m(EMBERITE, 'Emberite', { solid: true, tier: 5, speed: .82, ore: 120, glow: .7 });
m(CIRCUIT, 'Old circuitry', { solid: true, tier: 6, speed: .82, ore: 330, glow: .8 });
m(IRIDIUM, 'Iridium', { solid: true, tier: 7, speed: .8, ore: 900, glow: .35 });
export const isOre = mat => MATS[mat].ore > 0;
export const ORE_PER_SLOT = 20;          // ore cells to fill one slot of the belly

/* ---------- the layers, from the grass down to the core ---------- */
// top: metres below the ground where the layer starts. mat: what most of it is. tier: the Vibration it needs.
// dark: how dark it is away from the worm's glow (0 is daylight). finds: what's buried there (see ITEMS).
export const STRATA = [
  { id: 'topsoil', name: 'Topsoil', top: 0, mat: SOIL, tier: 0, dark: .05, ore: COAL,
    blurb: 'Soft dark earth full of roots, and whatever people have dropped.' },
  { id: 'clay', name: 'Clay Beds', top: 150, mat: CLAY, tier: 1, dark: .3, ore: COPPER,
    blurb: 'Red clay and sand, with fossils and amber. Sand pockets slump when you shake them.' },
  { id: 'lime', name: 'Limestone Caves', top: 620, mat: LIME, tier: 2, dark: .5, ore: SILVER,
    blurb: 'Pale stone hollowed into caverns and still lakes. Fall in and dig your way out.' },
  { id: 'granite', name: 'Granite Deep', top: 1340, mat: GRANITE, tier: 3, dark: .62, ore: GOLD,
    blurb: 'Hard pink granite, gold, and bright gems. Glowcap grottoes, rivers and firedamp.' },
  { id: 'crystal', name: 'Crystal Belt', top: 2220, mat: GEODE, tier: 4, dark: .7, ore: PLATINUM,
    blurb: 'Hollow geodes as big as churches, lined with crystal spires too hard to shake.' },
  { id: 'magma', name: 'The Furnace', top: 3180, mat: BASALT, tier: 5, dark: .74, ore: EMBERITE,
    blurb: 'Black basalt around lakes of lava. Lava burns; firedamp explodes.' },
  { id: 'ruins', name: 'The Old Ones', top: 4200, mat: RUIN, tier: 6, dark: .78, ore: CIRCUIT,
    blurb: 'Someone built down here, long ago. Walls of alloy nothing can shake, and sealed vaults.' },
  { id: 'mantle', name: 'The Mantle', top: 5200, mat: MANTLE, tier: 7, dark: .72, ore: IRIDIUM,
    blurb: 'Hot, dense, shimmering rock, the last of it before the heart of the world.' },
];
export function stratumOf(depth) {
  let k = 0;
  while (k < STRATA.length - 1 && depth >= STRATA[k + 1].top) k++;
  return k;
}

/* ---------- things to find ---------- */
// st: the layer it's found in. value: dollars at the trading post. size: how wide a Maw it needs (1 fits any
// mouth, 4 needs the widest). Slots it takes in the belly: 1, 2, 3 or 5 by size.
export const SLOTS_BY_SIZE = [0, 1, 2, 3, 5];
export const ITEMS = {};
const it = (id, st, name, value, size, blurb, o = {}) => { ITEMS[id] = { id, st, name, value, size, blurb, ...o }; };
// Topsoil
it('quartz', 0, 'Quartz pebble', 5, 1, 'Clear as ice, and nearly as common.');
it('coin', 0, 'Old coin', 9, 1, 'A king nobody remembers, worn smooth.');
it('cap', 0, 'Bottle cap', 2, 1, 'Somebody’s picnic, a long time ago.');
it('button', 0, 'Brass button', 4, 1, 'Off a soldier’s coat, maybe.');
it('marble', 0, 'Glass marble', 6, 1, 'A cat’s-eye. Someone lost this one and cried.');
it('key', 0, 'Rusty key', 7, 1, 'To a door that’s gone.');
it('arrowhead', 0, 'Flint arrowhead', 12, 1, 'Knapped by hand, still sharp.');
it('potato', 0, 'Potato', 1, 1, 'Somebody planted it. Now it’s yours.');
it('truffle', 0, 'Truffle', 18, 1, 'Pigs would kill for this.');
it('soldier', 0, 'Tin soldier', 11, 1, 'Still standing to attention.');
it('ring', 0, 'Lost ring', 38, 1, 'Gold, with an inscription too worn to read.');
it('watch', 0, 'Pocket watch', 55, 2, 'Stopped at ten past two.');
it('chest', 0, 'Buried chest', 280, 3, 'X marked the spot. Nobody came back for it.');
// Clay Beds
it('carnelian', 1, 'Carnelian', 22, 1, 'An orange stone the colour of the clay it sat in.');
it('jasper', 1, 'Jasper', 26, 1, 'Red, banded, and warm in the mouth.');
it('agate', 1, 'Agate', 34, 1, 'Rings inside rings, like a cut tree.');
it('amber', 1, 'Amber', 30, 1, 'Old sap, gone to honey-coloured glass.');
it('amberbug', 1, 'Amber with a bug', 95, 2, 'A gnat, caught mid-thought forty million years ago.');
it('shell', 1, 'Fossil shell', 20, 1, 'The sea was here once.');
it('nugget_cu', 1, 'Copper nugget', 18, 1, 'Green at the edges.');
it('pot', 1, 'Clay pot', 75, 2, 'Fired, not dug. People lived up there before the camp.');
it('figurine', 1, 'Clay figurine', 120, 2, 'A little worm. Someone knew about you.');
it('tusk', 1, 'Mammoth tusk', 560, 3, 'Curled and heavy and cold.');
// Limestone Caves
it('calcite', 2, 'Calcite', 55, 1, 'It splits light in two.');
it('amethyst', 2, 'Amethyst', 95, 1, 'Purple as a bruise, and worth a lot more.');
it('pearl', 2, 'Cave pearl', 120, 1, 'Grown one drip at a time at the bottom of a pool.');
it('nugget_ag', 2, 'Silver nugget', 130, 1, 'Tarnished black. Polishes up lovely.');
it('ammonite', 2, 'Ammonite', 175, 2, 'A coiled sea creature, older than the hills around it.');
it('trilobite', 2, 'Trilobite', 210, 2, 'It rolled up to hide. It’s been hiding a while.');
it('fishfossil', 2, 'Fossil fish', 440, 3, 'Every bone still in its place.');
it('amgeode', 2, 'Amethyst geode', 640, 3, 'Plain grey outside. Inside, a purple cathedral.');
// Granite Deep
it('garnet', 3, 'Garnet', 200, 1, 'Deep red, and harder than it looks.');
it('topaz', 3, 'Topaz', 240, 1, 'Gold-yellow, bright as a lamp.');
it('emerald', 3, 'Emerald', 420, 1, 'Green fire with a little garden inside.');
it('sapphire', 3, 'Sapphire', 440, 1, 'The blue of the sky you left behind.');
it('ruby', 3, 'Ruby', 460, 1, 'Pigeon’s-blood red. The buyer will gasp.');
it('nugget_au', 3, 'Gold nugget', 330, 1, 'Heavier than it has any right to be.');
it('glowcap', 3, 'Glowcap', 110, 1, 'A mushroom that lights the dark. Tastes of pennies.');
it('lamp', 3, 'Miner’s lamp', 260, 2, 'Someone came this far with a pick. Not farther.');
it('skull', 3, 'Raptor skull', 1900, 3, 'All teeth, even now.');
// Crystal Belt
it('opal', 4, 'Opal', 900, 1, 'Every colour at once, depending how you look.');
it('alexandrite', 4, 'Alexandrite', 1100, 1, 'Green by day, red by lamplight.');
it('starsapph', 4, 'Star sapphire', 1300, 1, 'A six-rayed star floats inside it.');
it('diamond', 4, 'Diamond', 1500, 1, 'The hardest thing there is, until you.');
it('nugget_pt', 4, 'Platinum nugget', 800, 1, 'Pale and dense and cold.');
it('shard', 4, 'Singing crystal', 720, 2, 'It hums when you come near.');
it('giantgeode', 4, 'Giant geode', 6500, 4, 'A whole room of crystal, and you can swallow it.');
// The Furnace
it('sulfur', 5, 'Sulfur crystal', 900, 1, 'Yellow, brittle, and it stinks.');
it('fireopal', 5, 'Fire opal', 2400, 1, 'Flames trapped in glass.');
it('embercrystal', 5, 'Ember crystal', 2000, 1, 'Still warm from the lava that made it.');
it('meteor', 5, 'Meteoric iron', 3200, 2, 'It fell from the sky, and kept falling.');
it('salamander', 5, 'Fire-lizard fossil', 7000, 3, 'A lizard that lived in lava. Nobody believed it.');
it('dragonegg', 5, 'Dragonstone', 9000, 3, 'Warm, and heavy. Is it… moving?');
// The Old Ones
it('keystone', 6, 'Keystone', 3000, 1, 'Carved with a sign that matches a door.');
it('powercell', 6, 'Power cell', 4200, 1, 'Still charged. It tingles.');
it('scrap', 6, 'Alloy scrap', 2600, 1, 'Lighter than foil and harder than you.');
it('glyph', 6, 'Glyph tablet', 9000, 2, 'Writing nobody alive can read.');
it('mask', 6, 'Precursor mask', 14000, 2, 'A face with too many eyes.');
it('idol', 6, 'Idol of the Old Ones', 20000, 3, 'It looks like you. Exactly like you.');
it('orb', 6, 'Star-map orb', 30000, 3, 'Stars you can’t see from here, and one that’s circled.');
// The Mantle
it('coreshard', 7, 'Core shard', 12000, 1, 'A flake off the heart of the world.');
it('heartstone', 7, 'Heartstone', 26000, 2, 'It beats. Slowly, but it beats.');
it('voidpearl', 7, 'Void pearl', 40000, 1, 'Black, and it bends the light around it.');
// What you drop when you faint, to come back for
it('cache', -1, 'Your lost haul', 0, 1, 'Everything you’d swallowed, right where you dropped it.');
// Not finds at all: hanging from cave roofs, they're shaken loose by the worm passing underneath, and fall.
it('stalactite', -2, 'Stalactite', 0, 2, 'A stone icicle. It falls when you shake the ground under it.', { hazard: 20 });
it('spike', -2, 'Crystal spike', 0, 2, 'Sharp, heavy, and it only just holds on.', { hazard: 30 });
export const ITEM_LIST = Object.values(ITEMS).filter(i => i.st >= 0);

// What's buried in each layer. form: the small gems laid out in rings, arcs and spirals. loose: finds scattered
// through the ground ([id, how common]). big: the rare big ones. cave: found lying on cave floors. lake: at the
// bottom of lakes.
export const FINDS = [
  { form: ['quartz', 'coin'], loose: [['cap', 6], ['button', 5], ['marble', 4], ['key', 4], ['potato', 5], ['arrowhead', 3], ['truffle', 3], ['soldier', 3], ['coin', 4], ['quartz', 4], ['ring', 1], ['watch', .7]],
    big: ['chest'], cave: ['marble', 'key'], lake: ['coin'] },
  { form: ['carnelian', 'jasper'], loose: [['agate', 4], ['amber', 5], ['shell', 6], ['nugget_cu', 5], ['jasper', 3], ['carnelian', 3], ['amberbug', 1.2], ['pot', 1], ['figurine', .6]],
    big: ['tusk'], cave: ['shell', 'agate'], lake: ['amber'] },
  { form: ['amethyst', 'calcite'], loose: [['calcite', 4], ['nugget_ag', 4], ['ammonite', 3], ['trilobite', 2.4], ['amethyst', 3], ['fishfossil', .5]],
    big: ['amgeode'], cave: ['calcite', 'ammonite'], lake: ['pearl'] },
  { form: ['garnet', 'topaz', 'emerald', 'sapphire', 'ruby'], loose: [['nugget_au', 4], ['garnet', 3], ['topaz', 3], ['emerald', 2], ['sapphire', 2], ['ruby', 2], ['lamp', .8]],
    big: ['skull'], cave: ['glowcap'], lake: ['sapphire'] },
  { form: ['opal', 'alexandrite', 'starsapph'], loose: [['nugget_pt', 4], ['opal', 3], ['diamond', 2], ['starsapph', 2], ['alexandrite', 2]],
    big: ['giantgeode'], cave: ['shard'], lake: ['diamond'] },
  { form: ['fireopal', 'embercrystal'], loose: [['sulfur', 4], ['embercrystal', 3], ['fireopal', 2], ['meteor', 1.2], ['salamander', .35]],
    big: ['dragonegg'], cave: ['sulfur'], lake: ['fireopal'] },
  { form: ['powercell', 'scrap'], loose: [['scrap', 4], ['powercell', 3], ['glyph', 1]],
    big: ['glyph', 'mask', 'idol', 'orb'], cave: ['scrap'], lake: ['powercell'], keys: 'keystone' },
  { form: ['coreshard'], loose: [['coreshard', 4], ['heartstone', 1.5], ['voidpearl', .6]],
    big: ['heartstone'], cave: ['coreshard'], lake: ['voidpearl'] },
];

/* ---------- the worm and its upgrades ---------- */
// Each upgrade is bought in order, level by level, at the Resonator in the camp. values[level] is what it gives at
// that level (level 0 is how the worm starts).
export const UPGRADES = [
  { id: 'vib', name: 'Vibration', blurb: 'Shake the ground harder, so you can swim down through tougher rock.',
    costs: [160, 950, 4300, 16500, 62000, 215000, 660000], values: [0, 1, 2, 3, 4, 5, 6, 7] },
  { id: 'belly', name: 'Belly', blurb: 'Room for more finds before you have to go up and sell.',
    costs: [60, 320, 1400, 5200, 18000, 60000, 170000], values: [8, 13, 20, 29, 40, 55, 74, 98] },
  { id: 'muscle', name: 'Muscle', blurb: 'Swim through the ground faster.',
    costs: [90, 450, 1800, 7000, 26000, 80000], values: [1, 1.14, 1.28, 1.42, 1.56, 1.7, 1.86] },
  { id: 'maw', name: 'Maw', blurb: 'A wider mouth: it reaches further, and swallows bigger finds.',
    costs: [150, 1600, 13000, 90000], values: [0, 1, 2, 3, 4] },
  { id: 'hide', name: 'Hide', blurb: 'Thicker skin: more health, and lava and falling rock hurt less.',
    costs: [110, 700, 3000, 12000, 45000, 150000], values: [40, 70, 110, 160, 230, 320, 440] },
];
export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
export const maxLevel = id => UPGRADE_BY_ID[id].costs.length;

export const WORM = {
  speed: 68,              // cells a second through plain topsoil, before Muscle
  accel: 6, brake: 4,     // how quickly it gets up to speed, and slows when let go: its top speed, times this, a second
  trail: 1.35,            // swims this much faster through ground it has already shaken loose
  deepBonus: .07,         // …and this much faster in rock for every Vibration level above what the rock needs
  water: .45, lava: .3,   // share of its speed in water and lava
  crawl: .55,             // share of its speed sliding along a cave floor in the open
  gravity: 420, airControl: 110, maxFall: 420,
  segs: 16, segsPerLevel: 1.6, spacing: 2.4,       // body length, growing with every upgrade bought
  girth: 3.1, girthPerLevel: .17,                  // body radius, in cells
  maw: [0, 1.6, 3.2, 4.6, 6],                      // extra reach, by Maw level
  regen: .06, regenDelay: 3,                       // share of health back a second, once it's gone this long unhurt
};
// Hide softens heat and blows: damage is multiplied by this, by Hide level.
export const TOUGH = [1, .82, .66, .52, .4, .3, .22];
export const HURT = { lava: 34, blast: 38, crystal: 14, rock: 22, zap: 46 };   // per second (lava, zap) or per hit
// The Old Ones' barriers: on for `duty` of every `period` seconds; they burn and push the worm back while on.
export const BEAM = { period: 2.6, duty: .5, push: 140 };

// The camp: where on the surface the worm sells its finds and buys upgrades. Anywhere between x0 and x1 counts,
// if its head is no more than `depth` cells below the ground.
export const CAMP = { x0: 30, x1: W - 30, depth: 30, post: 84, resonator: 176 };
export const NAME = 'Burrow';
