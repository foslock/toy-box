// The whole dollhouse: one tile map, built from rectangles so it stays easy to adjust.
// Tile chars:
//   .  air          #  house frame (painted wood)   r  roof slates   R  brick   E  earth
//   I  cast iron (magnet boots stick)   =  shelf (stand on it, jump up through it)   g  iron grate (one-way)
//   ^  pins / tacks / glass (hurts)     T  trunk or crate   C  cabinet furniture   B  toy block   S  stair tread
//   D  door (solid until opened)        K  books
export const W = 96, H = 52;
export const SOLID = new Set(['#', 'r', 'R', 'E', 'I', 'J', 'T', 'C', 'B', 'S', 'D', 'K']);
export const ONEWAY = new Set(['=', 'g']);
export const IRON = new Set(['I', 'J']);

export function roofY(x) {
  const d = Math.abs(x - 36);
  return d <= 24 ? 3 + Math.round(d / 6) : 7 + Math.round((d - 24) * 7 / 12);
}

export function buildMap() {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const set = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };

  // ground: earth under everything, the garden lawn level with the ground floor
  rect(0, 48, W - 1, H - 1, 'E');
  rect(73, 36, W - 1, H - 1, 'E');

  // house frame: outer walls, the four floors
  rect(0, 14, 0, 47, '#'); rect(72, 14, 72, 47, '#');
  for (const y of [14, 25, 36, 47]) rect(0, y, 72, y, '#');
  // inner walls with their doorways
  rect(22, 15, 22, 20, '#');                 // bedroom | landing, doorway rows 21-24
  rect(48, 15, 48, 21, '#'); rect(48, 22, 48, 24, 'D'); // landing | nursery, the nursery door
  rect(22, 26, 22, 29, '#'); rect(22, 30, 22, 35, 'D'); // parlour doors
  rect(48, 26, 48, 29, '#');                 // hall | kitchen, doorway rows 30-35
  rect(72, 27, 72, 29, '.');                 // kitchen window
  rect(72, 33, 72, 35, 'D');                 // back door

  // mansard roof
  for (let x = 0; x <= 72; x++) { const y = roofY(x); for (let r = y; r <= Math.min(y + 1, 13); r++) set(x, r, 'r'); }
  rect(44, 3, 45, 6, '.');                   // a broken skylight (one way down into the attic)
  // chimney: stack on the roof, flue straight down to the kitchen stove
  rect(66, 5, 66, 21, 'R'); rect(69, 5, 69, 24, 'R');
  rect(67, 5, 68, 24, '.'); // flue
  rect(66, 26, 66, 31, 'R'); rect(69, 26, 69, 31, 'R'); rect(67, 26, 68, 33, '.');
  rect(67, 25, 68, 25, 'g');                 // grate in the nursery hearth
  rect(66, 22, 66, 24, '.');                 // nursery fireplace opening
  rect(70, 15, 71, 24, 'R');                 // chimney breast fills the nursery corner

  // ---------- ATTIC (floor surface y=14)
  rect(15, 12, 16, 13, 'T');                 // first trunk to hop
  rect(28, 13, 35, 13, '^');                 // the sewing basket: spilled pins, needs a dash
  rect(38, 8, 38, 11, 'I');                  // an old iron bedstead stored on end
  rect(39, 8, 44, 8, '=');                   // rafter shelf
  rect(50, 12, 52, 13, 'T');
  rect(56, 14, 57, 14, '.');                 // the hatch down into the nursery
  rect(60, 12, 61, 13, 'K');

  // ---------- BEDROOM x1-21 y15-24
  rect(1, 17, 4, 23, 'C');                   // wardrobe, a mouse-sized gap under it (row 24)
  rect(8, 18, 8, 24, 'I');                   // iron bedhead
  rect(9, 22, 14, 22, '=');                  // mattress
  rect(15, 23, 15, 24, 'C');                 // bed foot

  // ---------- LANDING x23-47, stairwell x32-41
  rect(32, 25, 41, 25, '.');
  for (let k = 0; k < 10; k++) set(41 - k, 26 + k, 'S');
  rect(35, 23, 36, 23, '=');                 // little shelf over the stairwell

  // ---------- NURSERY x49-65
  rect(50, 18, 53, 18, '=');                 // high toy shelf
  rect(62, 23, 65, 24, 'B');                 // a heap of sleeping blocks

  // ---------- PARLOUR x1-21
  rect(3, 33, 7, 35, 'C');                   // sofa
  rect(15, 33, 19, 34, 'C');                 // piano (mouse-sized gap under, row 35)
  rect(9, 34, 10, 34, '=');                  // footstool
  rect(11, 32, 13, 32, '=');                 // side shelf

  // ---------- HALL x23-47
  rect(25, 28, 26, 28, '=');                 // top of the grandfather clock (you walk in front of the case)
  rect(30, 34, 31, 34, '=');
  rect(27, 32, 29, 32, '=');
  rect(27, 30, 28, 30, '=');
  rect(44, 35, 57, 35, '^');                 // a spilled box of carpet tacks, all the way into the kitchen

  // ---------- KITCHEN x49-71
  rect(57, 28, 57, 31, 'I');                 // hanging iron pot rack
  rect(59, 29, 62, 30, 'C');                 // wall cupboard
  rect(60, 36, 61, 36, '.');                 // cellar trapdoor
  rect(65, 34, 70, 35, 'I');                 // the range
  rect(71, 30, 71, 35, 'J');                 // water boiler by the window (iron too)

  // ---------- CELLAR y37-46, floor surface 47
  rect(15, 37, 15, 45, 'R');                 // brick wall, a mouse hole at row 46
  rect(40, 37, 40, 41, 'R');                 // brick arch
  // mouse den: little steps for a little soldier
  rect(11, 46, 13, 46, 'T'); rect(8, 45, 10, 46, 'T'); rect(5, 44, 7, 46, 'T'); rect(1, 43, 4, 46, 'T');
  rect(10, 44, 12, 44, '=');
  rect(26, 45, 27, 46, 'T'); rect(33, 44, 35, 46, 'T'); rect(18, 45, 19, 46, 'T');
  rect(29, 42, 31, 42, '=');                 // wine rack
  rect(45, 45, 46, 46, 'T');                 // crate the boots sit on
  rect(50, 46, 53, 46, '^');                 // broken glass
  rect(62, 37, 62, 44, 'I');                 // iron pipe up to the trapdoor
  rect(66, 41, 70, 46, 'I');                 // the boiler

  // ---------- GARDEN x73-95
  rect(95, 18, 95, 35, 'R');                 // garden wall
  rect(79, 34, 82, 34, '='); rect(83, 32, 86, 32, '='); rect(79, 30, 82, 30, '=');
  rect(83, 28, 86, 28, '='); rect(80, 26, 83, 26, '=');
  return g;
}

// tile swaps that happen as the house changes
export const MODS = {
  nurseryDoor: [[48, 22, 48, 24, '.']],
  parlourDoor: [[22, 30, 22, 35, '.']],
  backDoor: [[72, 33, 72, 35, '.']],
  blocks: [[62, 23, 65, 24, '.'], [56, 16, 57, 24, 'B'], [58, 18, 59, 24, 'B'], [60, 20, 61, 24, 'B'], [62, 22, 63, 24, 'B'], [64, 24, 65, 24, 'B']],
};

// rooms: name, rect, where the lamp hangs, and whether it is indoors
export const ROOMS = [
  { id: 'attic', name: 'The Attic', x0: 1, y0: 2, x1: 71, y1: 13, lamp: [30, 8], attic: true },
  { id: 'bedroom', name: 'The Bedroom', x0: 1, y0: 15, x1: 21, y1: 24, lamp: [18, 17] },
  { id: 'landing', name: 'The Landing', x0: 23, y0: 15, x1: 47, y1: 24, lamp: [30, 17] },
  { id: 'nursery', name: 'The Nursery', x0: 49, y0: 15, x1: 71, y1: 24, lamp: [57, 17] },
  { id: 'parlour', name: 'The Parlour', x0: 1, y0: 26, x1: 21, y1: 35, lamp: [11, 28] },
  { id: 'hall', name: 'The Hall', x0: 23, y0: 26, x1: 47, y1: 35, lamp: [36, 27.5] },
  { id: 'kitchen', name: 'The Kitchen', x0: 49, y0: 26, x1: 71, y1: 35, lamp: [58, 28] },
  { id: 'den', name: 'The Mouse Hole', x0: 1, y0: 37, x1: 14, y1: 46, lamp: [8, 39] },
  { id: 'cellar', name: 'The Cellar', x0: 16, y0: 37, x1: 71, y1: 46, lamp: [44, 39] },
  { id: 'garden', name: 'The Garden', x0: 73, y0: 0, x1: 95, y1: 35, outdoor: true },
  { id: 'roof', name: 'The Roof', x0: 0, y0: 0, x1: 72, y1: 12, outdoor: true, roof: true },
];

// things in the house. x,y are tile coords of the cell the thing sits in.
export const START = { x: 11, y: 13 };
export const STANDS = [
  { id: 'attic', x: 25, y: 13 }, { id: 'bedroom', x: 18, y: 24 }, { id: 'hall', x: 42, y: 35 },
  { id: 'kitchen', x: 63, y: 35 }, { id: 'cellar', x: 36, y: 46 }, { id: 'garden', x: 74, y: 35 },
];

export const ITEMS = [
  { id: 'key', x: 22, y: 13 }, { id: 'umbrella', x: 56, y: 23, boss: 'jack' },
  { id: 'boots', x: 45, y: 44 }, { id: 'thimble', x: 84, y: 35, boss: 'cat' }, { id: 'musicbox', x: 3, y: 42 },
];
export const ABILITY = {
  key: { name: 'The Wind-up Key', verb: 'Dash', blurb: 'A brass key that fits the hole in your back. Wind it for a burst of speed, on the ground or once in the air.' },
  umbrella: { name: 'The Paper Parasol', verb: 'Float', blurb: 'A cocktail parasol, a little bent. Hold jump while falling to drift down slowly. Warm air carries it upward.' },
  boots: { name: 'The Magnet Boots', verb: 'Climb iron', blurb: 'Two horseshoe magnets tied to your boots. Walk into anything made of iron and keep walking: straight up it.' },
  thimble: { name: "The Mouse's Thimble", verb: 'Shrink', blurb: 'Wear it to shrink to the size of a mouse, and fit through the little holes they use.' },
  musicbox: { name: 'The Music Box', verb: 'Wake toys', blurb: 'Its tune wakes any toy that has wound down. Play it beside the sleeping ones.' },
};

export const MEDALS = [
  { id: 'm1', x: 20, y: 10 },   // attic, a jump away
  { id: 'm2', x: 42, y: 7 },    // attic rafter shelf
  { id: 'm3', x: 8, y: 16 },    // top of the iron bedhead
  { id: 'm4', x: 35, y: 22 },   // shelf over the stairwell
  { id: 'm5', x: 25, y: 27 },   // top of the grandfather clock
  { id: 'm6', x: 60, y: 28 },   // top of the kitchen cupboard
  { id: 'm7', x: 11, y: 43 },   // in the mouse hole
  { id: 'm8', x: 86, y: 27 },   // up the garden tree
  { id: 'm9', x: 51, y: 17 },   // nursery high shelf
  { id: 'm10', x: 36, y: 1 },   // the roof peak
  { id: 'm11', x: 17, y: 35 },  // under the piano
  { id: 'm12', x: 68, y: 3 },   // on top of the chimney pot
];
export const SPRINGS = [
  { id: 's1', x: 1, y: 24 },    // under the wardrobe
  { id: 's2', x: 68, y: 40 },   // on the boiler
];

export const TOYS = [
  { id: 'horse', name: 'the rocking horse', x: 51, y: 24, door: true },
  { id: 'train', name: 'the tin train', x: 36, y: 35, door: true },
  { id: 'drummer', name: 'the drummer boy', x: 22, y: 46, door: true },
  { id: 'bird', name: 'the clockwork bird', x: 81, y: 25, door: true },
  { id: 'blocks', name: 'the building blocks', x: 63, y: 22, door: false },
];

export const ENEMIES = [
  { k: 'moth', x: 19, y: 10 }, { k: 'bunny', x: 47, y: 13 }, { k: 'bunny', x: 58, y: 13 },
  { k: 'moth', x: 12, y: 19 }, { k: 'bunny', x: 27, y: 24 }, { k: 'moth', x: 40, y: 19 },
  { k: 'moth', x: 33, y: 29 }, { k: 'bunny', x: 29, y: 35 },
  { k: 'moth', x: 61, y: 31 },
  { k: 'spider', x: 48, y: 38 }, { k: 'spider', x: 30, y: 38 }, { k: 'mouse', x: 57, y: 46 }, { k: 'bunny', x: 24, y: 46 }, { k: 'spider', x: 63, y: 38 },
  { k: 'moth', x: 88, y: 24 }, { k: 'moth', x: 78, y: 22 },
];

// little paper tags pinned around the house. Shown when you stand by them.
export const NOTES = [
  { x: 13, y: 13, t: 'Property of the Nursery. One (1) tin soldier, wind-up, slightly bent.' },
  { x: 27, y: 13, t: 'MIND THE PINS. Somebody knocked over the sewing basket.' },
  { x: 54, y: 13, t: 'Hatch to the nursery. A long way down for a small soldier.' },
  { x: 45, y: 24, t: 'Nursery door. Locked while the Jack-in-the-box is up.' },
  { x: 24, y: 35, t: 'The parlour doors are stuck. It would take every toy in the house to push them.' },
  { x: 43, y: 35, t: 'TACKS. A parasol carries further than a jump.' },
  { x: 59, y: 35, t: 'Cellar. No ladder. The pipe is iron, though.' },
  { x: 70, y: 33, t: 'The range is always lit. Warm air goes up the chimney.' },
  { x: 16, y: 46, t: 'Mice only. (Signed, the Mice.)' },
  { x: 77, y: 35, t: 'Beware of the cat.' },
  { x: 5, y: 46, t: 'We kept it safe. It is yours now. Wake the others. Love, the Mice' },
];

export const BOSSES = {
  jack: { name: 'Jack-in-the-Box', room: 'nursery', x: 54, ax0: 49.5, ax1: 65.5 },
  cat: { name: 'The Cat Next Door', room: 'garden', x: 88, ax0: 73.5, ax1: 94.5 },
  vacuum: { name: 'The Vacuum Cleaner', room: 'parlour', x: 12, ax0: 1.5, ax1: 21.5 },
};
