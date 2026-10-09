// The mountains. Each is a set of routes laid down the fall line: a route is a channel through the snow with banks
// either side, defined by its centre and half-width at points down the slope (d metres from the top, x across).
// Routes fork and meet again, so between two side-by-side routes the banks rise into a ridge. The heightfield is the
// mountain's base slope plus, at each point, the lowest of the routes' channels there (blended, so forks are smooth).
// Then each route's zones are filled with things to pick up, and its banks lined with trees or houses.
//
// Everything here is plain data and maths (no three.js) so the same course can be played headless in Node.
import { ITEMS, PALETTES } from './items.js';

export const CELL = 2;   // heightfield spacing, metres

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// value noise for the banks
function hash2(x, y) { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}
const fbm = (x, y) => vnoise(x, y) * 0.6 + vnoise(x * 2.1 + 5.2, y * 2.1 + 1.3) * 0.28 + vnoise(x * 4.3 + 9.1, y * 4.3 + 7.7) * 0.12;

// ------------------------------------------------------------------------------------------------- what goes where
// A kit is a weighted mix of things; '$name' entries are little set pieces (see GROUPS).
const KITS = {
  picnic: { pinecone: 5, mitten: 2, cocoa: 2, beanie: 1.2, robin: 1.6, thermos: 0.8, carrot: 1.2, goggles: 0.8, boot: 0.4, sapling: 0.6, $picnic: 0.25 },
  woods_s: { pinecone: 6, robin: 1.5, squirrel: 2, rabbit: 1.6, sapling: 2.2, mitten: 0.5, carrot: 0.5, fox: 0.35, $logs: 0.12 },
  school: { cone: 2, kid: 1.4, skis: 1.2, goggles: 1, mitten: 1, beanie: 1, boot: 1, marker: 1.4, snowboard: 0.5, sled: 0.5, cocoa: 0.6, gnome: 0.3, pinecone: 1.5, $school: 0.35 },
  meadow: { snowman_s: 1.2, carrot: 2, beanie: 1.5, sled: 1, kid: 0.8, dog: 0.3, mitten: 1, gnome: 0.5, cocoa: 0.6, pinecone: 1, $family: 0.45 },
  pond: { fish: 3, skater: 1.2, cocoa: 1, lantern: 1, thermos: 1, mitten: 0.6, $icefish: 0.45, bench: 0.3 },
  piste_s: { skier: 1, kid: 0.8, skis: 1, goggles: 1, marker: 1.5, pistepole: 1.8, boot: 0.8, beanie: 0.8, snowboard: 0.5, cone: 0.6, racer: 0.3 },
  lostprop: { skis: 2, snowboard: 1.5, boot: 2, goggles: 2, beanie: 2, mitten: 2, thermos: 1, sled: 1, skier: 0.4, kid: 0.6, deckchair: 0.6, cocoa: 1 },
  hamlet: { walker: 2, dog: 0.8, bench: 1, mailbox: 1, trashcan: 0.8, sled: 0.8, snowman_s: 0.8, snowman: 0.35, lamppost: 0.8, car: 0.5, outhouse: 0.25, phonebox: 0.25, kid: 0.8, cocoa: 1, beanie: 0.8, crate: 0.5, barrel: 0.5, gnome: 0.4, mitten: 0.6 },

  trailhead: { climber: 1, walker: 1, signpost: 0.6, bench: 0.6, thermos: 1, beanie: 1, mitten: 1, pinecone: 2, rabbit: 1, robin: 1, sapling: 1, dog: 0.4, $picnic: 0.2 },
  deepwoods: { deer: 0.8, fox: 1, rabbit: 2, squirrel: 2, sapling: 2, pine_s: 0.7, boulder: 0.3, moose: 0.25, pinecone: 3, robin: 1, bear: 0.12, $herd: 0.12 },
  logging: { crate: 1.5, barrel: 1.5, sled: 1, climber: 0.6, walker: 0.6, snowmobile: 0.5, thermos: 1, boot: 1, mitten: 1, pinecone: 1.5, $logs: 0.5, logpile: 0.4, dog: 0.4 },
  lake: { fish: 3, skater: 1.6, lantern: 1, cocoa: 1, bench: 0.4, thermos: 0.8, $icefish: 0.6, sled: 0.5 },
  campsite: { tent: 0.7, campfire: 0.6, lantern: 1.5, thermos: 1, climber: 1, sled: 0.8, snowmobile: 0.4, crate: 0.6, mitten: 1, cocoa: 1, dog: 0.4, $camp: 0.25 },
  ravine: { fox: 1, deer: 0.8, boulder: 0.5, bear: 0.35, rabbit: 1.5, squirrel: 1.5, sapling: 1.2, pine_s: 0.6, moose: 0.25 },
  lumbertown: { walker: 2, dog: 0.6, car: 1, logpile: 0.6, crate: 1, barrel: 1, bench: 0.8, mailbox: 0.8, lamppost: 1, snowmobile: 0.4, sled: 0.8, kid: 0.8, outhouse: 0.3, phonebox: 0.3, snowman: 0.4, trashcan: 0.6, $logs: 0.2 },

  topstation: { skier: 2.5, boarder: 1.2, kid: 0.8, skirack: 0.4, deckchair: 0.8, snowcannon: 0.3, gondola: 0.25, skis: 1.2, snowboard: 0.8, goggles: 1, boot: 1, cocoa: 1, marker: 1 },
  piste_busy: { skier: 3, boarder: 1.5, racer: 0.8, kid: 1, marker: 1.5, pistepole: 1.2, fence: 0.6, skis: 1, snowcat: 0.12, snowmobile: 0.3, snowcannon: 0.25, $school: 0.25 },
  park: { boarder: 3, skier: 0.8, cone: 1.5, fence: 1, snowboard: 1.2, goggles: 1, beanie: 1, skirack: 0.2, snowcannon: 0.2 },
  bowl: { goat: 1, climber: 1, boulder: 0.6, deer: 0.4, rabbit: 1, fox: 0.6, skier: 0.8, boarder: 0.6, pine_s: 0.5, $herd: 0.12 },
  apres: { hottub: 0.5, deckchair: 1.5, skirack: 0.6, walker: 2, skier: 1.2, cocoa: 2, snowmobile: 0.4, bench: 0.8, picnic: 0.6, dog: 0.5, $apres: 0.3 },
  liftline: { skier: 3, boarder: 1.2, kid: 1, gondola: 0.4, fence: 1, marker: 1, skis: 1, $queue: 0.5 },
  resort_town: { walker: 2, car: 1.4, bus: 0.25, lamppost: 1, bench: 0.8, skirack: 0.4, phonebox: 0.3, snowman: 0.5, dog: 0.5, kid: 0.6, mailbox: 0.6, stall: 0.2, $parking: 0.12 },

  summit: { climber: 1.6, tent: 0.4, crystal: 0.4, goat: 0.8, boulder: 0.5, igloo: 0.2, campfire: 0.3, thermos: 1, sled: 0.6, crate: 0.6, $camp: 0.2 },
  glacier: { crystal: 1, climber: 1, boulder: 0.6, igloo: 0.3, mammoth: 0.12, goat: 0.4, fish: 0.5, crate: 0.4 },
  ridge: { goat: 1.5, climber: 1, boulder: 0.8, crate: 0.4, deer: 0.4, pine_s: 0.5, $herd: 0.2 },
  basecamp: { tent: 1.2, igloo: 0.5, campfire: 0.6, snowmobile: 0.6, crate: 1, barrel: 1, climber: 1.6, sled: 0.8, dog: 0.5, lantern: 1, $camp: 0.3 },
  yeti: { yeti: 0.6, igloo: 0.5, mammoth: 0.2, crystal: 0.8, fish: 1, boulder: 0.5, goat: 0.4, climber: 0.4 },
  chute: { boulder: 1, pine_s: 0.8, pine: 0.3, goat: 0.6, deer: 0.6, climber: 0.6, cabin: 0.06, logpile: 0.3, moose: 0.3 },
  alpine_town: { walker: 1.6, car: 1.2, bus: 0.2, lamppost: 1, bench: 0.6, snowman: 0.6, dog: 0.4, mailbox: 0.4, phonebox: 0.3, stall: 0.25, firetruck: 0.06, $parking: 0.1 },

  reindeer: { reindeer: 1.2, sleigh: 0.3, gift: 3, candycane: 2, lantern: 1, cocoa: 1, kid: 0.6, walker: 0.4, snowman: 0.3, $sleigh: 0.2 },
  toboggan: { kid: 2, sled: 2, walker: 1, gift: 1.5, lantern: 1, snowman_s: 0.8, snowman: 0.5, candycane: 1, dog: 0.4, cocoa: 1 },
  lanternwoods: { lantern: 2, reindeer: 0.8, deer: 0.5, fox: 0.8, rabbit: 1, gift: 1, pine_s: 0.6, birch: 0.3 },
  market: { stall: 0.7, walker: 3, gift: 2, candycane: 1, lamppost: 1, cocoa: 1.5, kid: 1, snowman: 0.4, sleigh: 0.15, bench: 0.6, reindeer: 0.3, $market: 0.25 },
  rink: { skater: 3, lamppost: 1, bench: 0.8, cocoa: 1.2, stall: 0.2, kid: 0.8, walker: 0.6, lantern: 1 },
  rooftop: { walker: 1.5, car: 0.8, lamppost: 1, snowman: 0.6, gift: 1, mailbox: 0.6, kid: 0.6, phonebox: 0.3, bench: 0.6 },
  holly_town: { walker: 2, car: 1.2, bus: 0.3, lamppost: 1, stall: 0.3, snowman: 0.5, sleigh: 0.1, phonebox: 0.3, firetruck: 0.06, xmastree: 0.04, $parking: 0.1, $market: 0.08 },

  bigpeak: { skier: 3, boarder: 1.5, car: 0.8, gondola: 0.6, snowcat: 0.25, snowmobile: 0.8, hottub: 0.3, skirack: 0.4, snowman: 0.6, pine_s: 0.5, $queue: 0.2, $parking: 0.1 },
  resort_mix: { skier: 2, car: 1.2, bus: 0.3, gondola: 0.6, snowcat: 0.4, chalet: 0.06, cabin: 0.08, pine: 0.4, hottub: 0.4, snowman: 0.6, pylon: 0.08, $parking: 0.12, $apres: 0.12 },
  bigforest: { pine: 1.2, pine_s: 1, pine_tall: 0.2, moose: 0.8, bear: 0.8, deer: 1, cabin: 0.1, logpile: 0.5, boulder: 0.5, birch: 0.5, $herd: 0.2 },
  bigglacier: { mammoth: 0.5, yeti: 1, crystal: 1.2, igloo: 0.8, boulder: 0.6, climber: 1, tent: 0.5, snowmobile: 0.4 },
  suburbs: { house: 0.25, car: 1.5, bus: 0.3, walker: 1.5, lamppost: 1, snowman: 0.5, shop: 0.12, firetruck: 0.1, mailbox: 0.6, phonebox: 0.3, $parking: 0.15 },
  railyard: { train: 0.18, carriage: 0.3, watertower: 0.08, logpile: 0.6, crate: 1, barrel: 1, car: 0.6, walker: 1, snowcat: 0.15, $station: 0.06 },
  city: { house: 0.3, shop: 0.2, car: 1.2, bus: 0.5, walker: 1.2, lamppost: 0.8, firetruck: 0.15, church: 0.05, clocktower: 0.04, hotel: 0.04, stall: 0.3, xmastree: 0.04, ferris: 0.02, $parking: 0.12 },
};

// Little set pieces: each places a handful of things around (x, d), facing `yaw` (0 = downhill).
const GROUPS = {
  picnic: (g, d, x) => { g.put('picnic', d, x, 0.2); for (let i = 0; i < 3; i++) g.near(['cocoa', 'thermos', 'mitten', 'carrot'][i % 4], d, x, 1.6); },
  logs: (g, d, x) => { g.put('logpile', d, x, Math.PI / 2); for (let i = 0; i < 3; i++) g.near(['crate', 'barrel', 'sled'][i], d, x, 3.5); },
  school: (g, d, x) => { g.put('skier', d, x, 0, { leader: true }); for (let i = 1; i <= 5; i++) g.put('kid', d - i * 1.7, x + (i % 2 ? 0.6 : -0.6), 0, { follow: true }); },
  family: (g, d, x) => { g.put('snowman', d, x, g.r() * 6); g.put('snowman_s', d + 0.5, x + 2.2, g.r() * 6); g.put('snowman_s', d - 0.6, x - 2.0, g.r() * 6); g.near('carrot', d, x, 2.5); g.near('beanie', d, x, 2.5); },
  icefish: (g, d, x) => { g.put('icehut', d, x, g.r() * 6); for (let i = 0; i < 3; i++) g.near('fish', d, x, 3); g.near('lantern', d, x, 2.5); },
  herd: (g, d, x) => { const t = g.pick(['deer', 'goat', 'deer', 'moose']); for (let i = 0; i < 4; i++) g.near(t, d, x, 5); },
  camp: (g, d, x) => { g.put('tent', d, x - 2, 0.4); g.put('tent', d + 3, x + 2.5, -0.5); g.put('campfire', d - 2.5, x, 0); for (let i = 0; i < 3; i++) g.near(['lantern', 'sled', 'thermos'][i], d, x, 4); },
  apres: (g, d, x) => { g.put('hottub', d, x, 0); for (let i = 0; i < 3; i++) g.put('deckchair', d - 3, x - 2.5 + i * 2.5, Math.PI); g.near('skirack', d, x, 5); for (let i = 0; i < 3; i++) g.near('cocoa', d, x, 3); },
  queue: (g, d, x) => { g.put('pylon', d + 6, x, Math.PI / 2); for (let i = 0; i < 7; i++) g.put(g.pick(['skier', 'skier', 'boarder', 'kid']), d - i * 1.6, x + 3 + (i % 2) * 0.8, 0, { still: true }); },
  parking: (g, d, x) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) if (g.r() < 0.8) g.put(g.r() < 0.12 ? 'bus' : 'car', d + i * 6, x + (j - 1.5) * 2.8, Math.PI / 2 * (i ? 1 : -1), { still: true }); },
  market: (g, d, x) => { for (let i = 0; i < 3; i++) { g.put('stall', d + i * 4.2, x - 4, Math.PI / 2); g.put('stall', d + i * 4.2, x + 4, -Math.PI / 2); } for (let i = 0; i < 5; i++) g.near(g.pick(['walker', 'walker', 'kid', 'gift']), d + 4, x, 3); },
  sleigh: (g, d, x) => { g.put('sleigh', d, x, 0); for (let i = 0; i < 4; i++) g.put('reindeer', d - 4 - i * 2.6, x + (i % 2 ? 0.9 : -0.9), 0, { still: true }); for (let i = 0; i < 4; i++) g.near('gift', d, x, 3); },
  station: (g, d, x) => { g.put('train', d, x, 0); g.put('carriage', d - 12, x, 0); g.put('carriage', d - 24, x, 0); g.put('lamppost', d - 8, x + 3, 0); g.put('watertower', d - 4, x - 9, 0.3); },
};

// ------------------------------------------------------------------------------------------------- the six mountains
// path: [d, x, half-width] points; surf: a surface, or [[d0, d1, surface]...]; zones: [d0, d1, kit, things per 100 m];
// feats: cliff [d0, d1, fraction of the fall it holds back], kicker [d, height, length], rollers / moguls
// [d0, d1, amplitude, wavelength], crevasse [d, depth, half-width]; edge: what lines the banks.
const TREES = { pine: 2, pine_s: 1.5, birch: 0.4 };
const FOREST = { pine: 2, pine_s: 2, pine_tall: 0.3, birch: 0.6 };

export const MOUNTAINS = [
  {
    id: 'bunny', name: 'Bunny Hill', grade: 'green', look: 'morning', len: 1500, start: 0.2, medals: [3.5, 5, 7], snow: 0.35,
    blurb: 'A gentle green run past the picnic spot and the ski school, down to the hamlet of Tannenbrück.',
    slope: [[0, 0.14], [80, 0.22], [300, 0.27], [540, 0.18], [700, 0.25], [820, 0.3], [1150, 0.17], [1380, 0.1], [1500, 0.05], [1620, 0.0]],
    town: { from: 1160, name: 'Tannenbrück' },
    routes: [
      { id: 'top', name: 'Picnic Point', path: [[-70, 0, 8], [60, 0, 9], [115, 0, 9]], surf: 'powder', zones: [[-12, 112, 'picnic', 85]], edge: TREES },
      { id: 'woods', name: 'Pinecone Woods', path: [[95, 0, 5], [170, -15, 5], [300, -24, 5.5], [440, -20, 5], [520, -6, 6], [565, 0, 8]], surf: 'powder', zones: [[110, 545, 'woods_s', 70]], edge: FOREST, gap: 4, look: 'woods' },
      { id: 'school', name: 'Ski School', path: [[95, 0, 7], [170, 16, 9], [320, 22, 10], [450, 17, 9], [520, 6, 8], [565, 0, 8]], surf: 'piste', zones: [[110, 545, 'school', 52]], edge: TREES, look: 'piste' },
      { id: 'meadow', name: 'Snowman Meadow', path: [[540, 0, 9], [620, 0, 14], [760, 0, 13], [825, 0, 10]], surf: 'powder', zones: [[555, 815, 'meadow', 55]], edge: TREES },
      { id: 'pond', name: 'The Pond', path: [[800, 0, 7], [860, -22, 11], [1000, -30, 14], [1110, -18, 10], [1175, 0, 10]], surf: [[800, 875, 'powder'], [875, 1085, 'lake'], [1085, 1175, 'powder']], zones: [[815, 1165, 'pond', 46]], edge: { pine: 1, birch: 1 }, look: 'ice' },
      { id: 'bumps', name: 'The Bumps', path: [[800, 0, 7], [900, 2, 7], [1050, -2, 7], [1175, 0, 10]], surf: 'piste', feats: [['moguls', 850, 1100, 0.45, 7]], zones: [[815, 1165, 'piste_s', 42]], edge: TREES, look: 'piste' },
      { id: 'kicker', name: 'Big Kicker', path: [[800, 0, 7], [870, 23, 6], [960, 28, 6], [1080, 24, 8], [1175, 0, 10]], surf: 'piste', feats: [['cliff', 880, 975, 0.8], ['kicker', 975, 1.2, 9]], zones: [[815, 970, 'piste_s', 10], [985, 1165, 'lostprop', 55]], edge: TREES, look: 'jump' },
      { id: 'hamlet', name: 'Tannenbrück', path: [[1150, 0, 10], [1220, 0, 18], [1500, 0, 22], [1680, 0, 24]], surf: 'piste', zones: [[1170, 1560, 'hamlet', 42]], edge: { chalet: 1, cabin: 1.2, pine: 0.6 }, gap: 15, out: [-2, 5], landmarks: [[1440, 'snowman', 3.2, 0]] },
    ],
  },
  {
    id: 'hemlock', name: 'Hemlock Hollow', grade: 'blue', look: 'overcast', len: 2100, start: 0.4, medals: [6, 8.5, 11], snow: 0.9,
    blurb: 'Deep woods full of wildlife, a logging road, a frozen lake you can’t steer on, and the timber town of Lumberton.',
    slope: [[0, 0.16], [100, 0.26], [400, 0.32], [620, 0.22], [700, 0.12], [1100, 0.12], [1250, 0.3], [1700, 0.26], [1850, 0.12], [2100, 0.05], [2250, 0]],
    town: { from: 1720, name: 'Lumberton' },
    routes: [
      { id: 'trail', name: 'Trailhead', path: [[-70, 0, 9], [100, 0, 11], [150, 0, 11]], surf: 'powder', zones: [[-12, 148, 'trailhead', 50]], edge: FOREST },
      { id: 'deep', name: 'Deep Woods', path: [[130, 0, 7], [220, -26, 7], [400, -34, 8], [560, -24, 8], [650, 0, 10]], surf: 'powder', zones: [[150, 640, 'deepwoods', 46]], edge: FOREST, gap: 4, look: 'woods' },
      { id: 'logroad', name: 'Logging Road', path: [[130, 0, 8], [220, 24, 9], [420, 30, 9], [560, 22, 9], [650, 0, 10]], surf: 'piste', feats: [['rollers', 250, 520, 0.8, 26]], zones: [[150, 640, 'logging', 40]], edge: { pine: 2, pine_s: 1 } },
      { id: 'lake', name: 'Frozen Lake', path: [[630, 0, 10], [700, 0, 28], [1050, 0, 32], [1150, 0, 12]], surf: [[630, 690, 'powder'], [690, 1080, 'lake'], [1080, 1150, 'powder']], zones: [[645, 1140, 'lake', 52]], edge: { pine: 1, birch: 1.5 }, look: 'ice' },
      { id: 'camp', name: 'Campsite', path: [[1130, 0, 8], [1200, -20, 8], [1400, -26, 9], [1600, -18, 9], [1710, 0, 12]], surf: 'powder', zones: [[1150, 1700, 'campsite', 36]], edge: FOREST },
      { id: 'ravine', name: 'Bear Ravine', path: [[1130, 0, 6], [1200, 18, 5], [1400, 24, 5], [1600, 16, 6], [1710, 0, 12]], surf: 'powder', feats: [['rollers', 1250, 1600, 1.1, 24]], zones: [[1150, 1700, 'ravine', 30]], edge: FOREST, gap: 4, look: 'woods' },
      { id: 'town', name: 'Lumberton', path: [[1680, 0, 12], [1760, 0, 24], [2100, 0, 28], [2280, 0, 28]], surf: 'piste', zones: [[1700, 2120, 'lumbertown', 40]], edge: { cabin: 2, chalet: 0.5, logpile: 0.6, pine: 0.6 }, gap: 15, out: [-2, 5], landmarks: [[1960, 'watertower', 1, -20], [2060, 'station', 1, 18]] },
    ],
  },
  {
    id: 'gondola', name: 'Gondola Peak', grade: 'blue', look: 'noon', len: 2700, start: 0.8, medals: [11, 15, 20], snow: 0.15,
    blurb: 'The busy resort: crowded pistes, a terrain park, the après deck, a lift line and a cliff, then Gondola Village.',
    slope: [[0, 0.16], [120, 0.28], [500, 0.33], [880, 0.2], [1300, 0.18], [1400, 0.32], [1900, 0.3], [2100, 0.14], [2700, 0.06], [2850, 0]],
    town: { from: 2120, name: 'Gondola Village' },
    routes: [
      { id: 'top', name: 'Top Station', path: [[-80, 0, 12], [120, 0, 16], [180, 0, 16]], surf: 'piste', zones: [[-14, 178, 'topstation', 46]], edge: { pylon: 0.3, pine: 1, pine_s: 0.6 }, landmarks: [[-30, 'lodge', 0.6, 22]] },
      { id: 'main', name: 'Main Piste', path: [[160, 0, 12], [260, -30, 14], [600, -36, 14], [800, -20, 12], [885, 0, 14]], surf: 'piste', zones: [[175, 875, 'piste_busy', 44]], edge: TREES, look: 'piste' },
      { id: 'park', name: 'Terrain Park', path: [[160, 0, 9], [260, 6, 9], [600, 4, 9], [800, 8, 9], [885, 0, 14]], surf: 'piste', feats: [['kicker', 330, 2.2, 14], ['kicker', 470, 2.6, 14], ['kicker', 610, 3, 16], ['kicker', 750, 2.4, 14]], zones: [[175, 875, 'park', 34]], edge: { fence: 1 }, gap: 6, out: [-1, 1], look: 'jump' },
      { id: 'bowl', name: 'Powder Bowl', path: [[160, 0, 10], [260, 34, 14], [500, 46, 18], [750, 32, 14], [885, 0, 14]], surf: 'powder', zones: [[175, 875, 'bowl', 34]], edge: { boulder: 1, pine_s: 1 }, look: 'woods' },
      { id: 'apres', name: 'Après Deck', path: [[860, 0, 14], [950, 0, 22], [1250, 0, 24], [1335, 0, 14]], surf: 'piste', zones: [[875, 1320, 'apres', 44]], edge: { chalet: 1, pine: 1 }, gap: 16, out: [-1, 6], landmarks: [[1100, 'lodge', 1, -30]] },
      { id: 'lift', name: 'Lift Line', path: [[1310, 0, 10], [1400, -24, 12], [1800, -30, 12], [2000, -20, 12], [2105, 0, 16]], surf: 'piste', zones: [[1325, 2095, 'liftline', 40]], edge: { pylon: 1 }, gap: 60, out: [-6, -6], look: 'piste' },
      { id: 'cliffs', name: 'The Cliffs', path: [[1310, 0, 9], [1400, 26, 9], [1700, 30, 10], [2000, 22, 12], [2105, 0, 16]], surf: 'piste', feats: [['cliff', 1420, 1640, 0.8], ['kicker', 1640, 2, 14]], zones: [[1325, 1630, 'piste_busy', 14], [1660, 2095, 'bowl', 42]], edge: { boulder: 1, pine: 1 }, look: 'jump' },
      { id: 'village', name: 'Gondola Village', path: [[2080, 0, 16], [2180, 0, 30], [2700, 0, 36], [2880, 0, 36]], surf: 'piste', zones: [[2110, 2690, 'resort_town', 40]], edge: { chalet: 1.5, house: 0.6, shop: 0.4, hotel: 0.12 }, gap: 18, out: [-3, 6], landmarks: [[2600, 'hotel', 1, 0]] },
    ],
  },
  {
    id: 'yeti', name: 'Yeti Pass', grade: 'black', look: 'sunset', len: 3000, start: 1.5, medals: [16, 22, 28], snow: 0.3,
    blurb: 'High alpine at sunset: a glacier with a crevasse to clear, a knife-edge ridge, base camp, and the hollow where the yetis live.',
    slope: [[0, 0.18], [150, 0.3], [600, 0.36], [1050, 0.22], [1550, 0.24], [1650, 0.38], [2300, 0.32], [2400, 0.14], [3000, 0.06], [3150, 0]],
    town: { from: 2400, name: 'St. Yodel' },
    routes: [
      { id: 'summit', name: 'The Summit', path: [[-90, 0, 12], [150, 0, 16], [205, 0, 16]], surf: 'powder', zones: [[-15, 200, 'summit', 40]], edge: { boulder: 1.5, crystal: 0.3 } },
      { id: 'glacier', name: 'The Glacier', path: [[180, 0, 12], [300, -34, 16], [700, -44, 18], [950, -30, 16], [1050, 0, 18]], surf: [[180, 290, 'powder'], [290, 980, 'lake'], [980, 1050, 'powder']], feats: [['kicker', 770, 2.5, 18], ['crevasse', 800, 7, 13]], zones: [[200, 760, 'glacier', 34], [830, 1040, 'glacier', 34]], edge: { crystal: 1, boulder: 1 }, gap: 9, look: 'ice' },
      { id: 'ridge', name: 'Knife Ridge', path: [[180, 0, 8], [300, 30, 7], [700, 36, 6], [950, 26, 8], [1050, 0, 18]], surf: 'powder', feats: [['rollers', 320, 900, 1.8, 30]], zones: [[200, 1040, 'ridge', 30]], edge: { boulder: 2 }, gap: 6 },
      { id: 'camp', name: 'Base Camp', path: [[1030, 0, 16], [1130, 0, 26], [1450, 0, 26], [1560, 0, 16]], surf: 'powder', zones: [[1045, 1550, 'basecamp', 44]], edge: { boulder: 1, pine_s: 1, pine: 1 } },
      { id: 'hollow', name: 'Yeti’s Hollow', path: [[1530, 0, 5], [1620, -30, 6], [1900, -44, 9], [2200, -34, 8], [2385, 0, 18]], surf: 'powder', zones: [[1560, 2370, 'yeti', 30]], edge: { crystal: 1, boulder: 1, pine_tall: 0.6 }, gap: 6, look: 'woods' },
      { id: 'chute', name: 'Avalanche Chute', path: [[1530, 0, 14], [1620, 20, 14], [2000, 26, 14], [2300, 18, 14], [2385, 0, 18]], surf: 'powder', feats: [['rollers', 1700, 2250, 2.4, 32]], zones: [[1560, 2370, 'chute', 34]], edge: FOREST },
      { id: 'town', name: 'St. Yodel', path: [[2360, 0, 18], [2460, 0, 34], [3000, 0, 40], [3180, 0, 40]], surf: 'piste', zones: [[2400, 2990, 'alpine_town', 40]], edge: { house: 1, chalet: 1, shop: 0.5, church: 0.08 }, gap: 18, out: [-3, 6], landmarks: [[2700, 'church', 1, -26], [2940, 'clocktower', 1, 0]] },
    ],
  },
  {
    id: 'holly', name: 'Holly Valley', grade: 'black', look: 'night', len: 3000, start: 2, medals: [14, 19, 25], snow: 0.7,
    blurb: 'Christmas Eve after dark: reindeer on the ridge, a toboggan run, the Christmas market, an ice rink and Hollyburgh.',
    slope: [[0, 0.18], [200, 0.3], [700, 0.34], [1050, 0.2], [1700, 0.18], [1800, 0.32], [2400, 0.28], [2500, 0.14], [3000, 0.06], [3150, 0]],
    town: { from: 2500, name: 'Hollyburgh' },
    routes: [
      { id: 'ridge', name: 'Reindeer Ridge', path: [[-90, 0, 14], [160, 0, 18], [225, 0, 18]], surf: 'powder', zones: [[-15, 220, 'reindeer', 44]], edge: { xmastree: 0.4, pine: 1.5, pine_s: 1 } },
      { id: 'toboggan', name: 'Toboggan Run', path: [[200, 0, 10], [300, -26, 10], [700, -32, 10], [950, -20, 10], [1050, 0, 18]], surf: 'piste', feats: [['rollers', 330, 900, 1.4, 22]], zones: [[220, 1040, 'toboggan', 42]], edge: { pine: 1.5, lamppost: 0.6 }, look: 'piste' },
      { id: 'lanterns', name: 'Lantern Woods', path: [[200, 0, 12], [300, 28, 14], [700, 36, 14], [950, 24, 14], [1050, 0, 18]], surf: 'powder', zones: [[220, 1040, 'lanternwoods', 40]], edge: FOREST, gap: 5, look: 'woods' },
      { id: 'market', name: 'Christmas Market', path: [[1030, 0, 18], [1130, 0, 30], [1650, 0, 34], [1755, 0, 18]], surf: 'piste', zones: [[1045, 1740, 'market', 40]], edge: { chalet: 1, house: 1, xmastree: 0.15 }, gap: 18, out: [-2, 5], landmarks: [[1400, 'xmastree', 1.6, 0]] },
      { id: 'rink', name: 'Ice Rink', path: [[1730, 0, 12], [1830, -28, 16], [2200, -34, 18], [2400, -20, 14], [2505, 0, 20]], surf: [[1730, 1840, 'powder'], [1840, 2380, 'lake'], [2380, 2505, 'powder']], zones: [[1750, 2490, 'rink', 42]], edge: { lamppost: 1, pine: 1 }, gap: 10, look: 'ice' },
      { id: 'rooftops', name: 'Rooftop Run', path: [[1730, 0, 10], [1830, 28, 10], [2200, 34, 10], [2400, 22, 12], [2505, 0, 20]], surf: 'piste', feats: [['kicker', 1900, 2.8, 16], ['kicker', 2060, 3.2, 16], ['kicker', 2220, 3.6, 18]], zones: [[1750, 2490, 'rooftop', 34]], edge: { house: 1.5, shop: 0.5 }, gap: 13, out: [-1, 3] },
      { id: 'town', name: 'Hollyburgh', path: [[2480, 0, 20], [2580, 0, 40], [3000, 0, 46], [3180, 0, 46]], surf: 'piste', zones: [[2500, 2990, 'holly_town', 44]], edge: { house: 1.5, shop: 0.6, church: 0.1, clocktower: 0.06 }, gap: 18, out: [-3, 6], landmarks: [[2760, 'ferris', 1, 26], [2950, 'xmastree', 2.2, 0]] },
    ],
  },
  {
    id: 'bigone', name: 'The Big One', grade: 'double', look: 'golden', len: 3800, start: 3, medals: [32, 45, 56], snow: 0.25,
    blurb: 'The whole range in one run: resort, old forest or glacier, the Big Air, then the suburbs or the railway, and the Capital.',
    slope: [[0, 0.18], [220, 0.3], [1100, 0.33], [1450, 0.22], [1500, 0.3], [1900, 0.28], [2700, 0.26], [2900, 0.14], [3800, 0.06], [3960, 0]],
    town: { from: 2900, name: 'the Capital' },
    routes: [
      { id: 'peak', name: 'The Peak', path: [[-110, 0, 18], [200, 0, 26], [260, 0, 26]], surf: 'piste', zones: [[-20, 255, 'bigpeak', 46]], edge: { pine: 1, chalet: 0.3, pylon: 0.2 }, gap: 10 },
      { id: 'resort', name: 'Resort Run', path: [[240, 0, 18], [400, -52, 24], [1100, -62, 26], [1300, -40, 24], [1455, 0, 30]], surf: 'piste', zones: [[260, 1445, 'resort_mix', 40]], edge: { chalet: 1, pine: 1, hotel: 0.05 }, gap: 16, look: 'piste' },
      { id: 'forest', name: 'Old Forest', path: [[240, 0, 16], [400, 0, 20], [1100, 4, 20], [1300, 0, 20], [1455, 0, 30]], surf: 'powder', zones: [[260, 1445, 'bigforest', 36]], edge: { pine_tall: 2, pine: 1 }, gap: 9, look: 'woods' },
      { id: 'glacier', name: 'The Glacier', path: [[240, 0, 18], [400, 54, 24], [1100, 64, 26], [1300, 42, 24], [1455, 0, 30]], surf: [[240, 390, 'powder'], [390, 1320, 'lake'], [1320, 1455, 'powder']], zones: [[260, 1445, 'bigglacier', 34]], edge: { crystal: 1, boulder: 1 }, gap: 12, look: 'ice' },
      { id: 'air', name: 'The Big Air', path: [[1430, 0, 26], [1550, 0, 30], [1800, 0, 30], [1905, 0, 30]], surf: 'piste', feats: [['cliff', 1470, 1700, 0.85], ['kicker', 1700, 4, 30]], zones: [[1450, 1690, 'resort_mix', 14], [1730, 1895, 'resort_mix', 40]], edge: { pine: 1, pylon: 0.3 }, look: 'jump' },
      { id: 'suburbs', name: 'The Suburbs', path: [[1880, 0, 30], [2000, -42, 36], [2700, -52, 40], [2905, 0, 50]], surf: 'piste', zones: [[1900, 2890, 'suburbs', 40]], edge: { house: 2, shop: 0.6 }, gap: 18, out: [-3, 5] },
      { id: 'rail', name: 'The Railway', path: [[1880, 0, 26], [2000, 46, 26], [2700, 56, 30], [2905, 0, 50]], surf: 'piste', zones: [[1900, 2890, 'railyard', 38]], edge: { watertower: 0.3, pine: 1, logpile: 0.6 }, gap: 16, landmarks: [[2300, 'station', 1, 46], [2600, 'station', 1, 52]] },
      { id: 'city', name: 'The Capital', path: [[2880, 0, 40], [3000, 0, 60], [3800, 0, 70], [3990, 0, 70]], surf: 'piste', zones: [[2900, 3720, 'city', 46]], edge: { hotel: 0.4, house: 1.5, church: 0.3, clocktower: 0.2, shop: 0.6 }, gap: 26, out: [-4, 8], landmarks: [[3790, 'castle', 1, 0], [3300, 'ferris', 1, -40], [3550, 'hotel', 1, 34]] },
    ],
  },
];

// ------------------------------------------------------------------------------------------------- building a course
function catmull(pts, d, k) {   // pts sorted by d; interpolate column k
  if (d <= pts[0][0]) return pts[0][k];
  const n = pts.length;
  if (d >= pts[n - 1][0]) return pts[n - 1][k];
  let i = 0;
  while (i < n - 2 && d > pts[i + 1][0]) i++;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
  const t = (d - p1[0]) / (p2[0] - p1[0]);
  // tangents scaled to the segment, so unevenly spaced points don't overshoot
  const m1 = (p2[k] - p0[k]) / (p2[0] - p0[0] || 1) * (p2[0] - p1[0]);
  const m2 = (p3[k] - p1[k]) / (p3[0] - p1[0] || 1) * (p2[0] - p1[0]);
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1[k] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[k] + (t3 - t2) * m2;
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

export const SURF = { powder: 0, piste: 1, ice: 2, bank: 3 };

export function buildCourse(def, seed = 1) {
  const R = rng(seed * 7919 + hashStr(def.id));
  const routes = def.routes.map((r, i) => ({ ...r, i, d0: r.path[0][0], d1: r.path[r.path.length - 1][0] }));
  const dMin = Math.min(...routes.map(r => r.d0)) - 30;
  const dMax = def.len + 260;
  let xLo = 0, xHi = 0;
  for (const r of routes) for (const p of r.path) { xLo = Math.min(xLo, p[1] - p[2]); xHi = Math.max(xHi, p[1] + p[2]); }
  const margin = 110 + Math.max(...routes.map(r => Math.max(...r.path.map(p => p[2])))) * 1.5;
  const x0 = Math.floor((xLo - margin) / CELL) * CELL, x1 = Math.ceil((xHi + margin) / CELL) * CELL;
  const d0 = Math.floor(dMin / CELL) * CELL;
  const nx = Math.round((x1 - x0) / CELL) + 1, nd = Math.round((dMax - d0) / CELL) + 1;

  // the base slope: integrate the grade down the mountain
  const base = new Float32Array(nd);
  const grade = d => {
    const s = def.slope;
    if (d <= s[0][0]) return s[0][1];
    for (let i = 1; i < s.length; i++) if (d < s[i][0]) return lerp(s[i - 1][1], s[i][1], smooth((d - s[i - 1][0]) / (s[i][0] - s[i - 1][0])));
    return s[s.length - 1][1];
  };
  let y = 0;
  for (let j = 0; j < nd; j++) { const d = d0 + j * CELL; base[j] = y; y -= grade(d) * CELL; }
  const baseAt = d => { const f = clamp((d - d0) / CELL, 0, nd - 1.001), j = Math.floor(f); return lerp(base[j], base[j + 1], f - j); };

  // per route, per row: centre, half-width, and the d-only part of its offset
  for (const r of routes) {
    r.cx = new Float32Array(nd); r.w = new Float32Array(nd); r.off = new Float32Array(nd); r.on = new Uint8Array(nd);
    r.feats = r.feats || [];
    for (const f of r.feats) if (f[0] === 'cliff') f.h = Math.min(f[3], 0.75) * (baseAt(f[1]) - baseAt(f[2]));
    for (let j = 0; j < nd; j++) {
      const d = d0 + j * CELL;
      r.cx[j] = catmull(r.path, d, 1);
      r.w[j] = Math.max(2, catmull(r.path, d, 2));
      const pen = Math.max(0, r.d0 - d, d - r.d1);   // closes the channel off past its ends
      r.on[j] = pen < 40;
      let off = pen * pen * 0.06 + pen * 0.5;
      for (const f of r.feats) {
        // a plateau that holds back part of the fall, then drops it all at once off the edge
        if (f[0] === 'cliff' && d >= f[1] && d < f[2]) off += f.h * (d - f[1]) / (f[2] - f[1]);
        else if (f[0] === 'kicker' && d >= f[1] - f[3] && d < f[1]) off += f[2] * ((d - (f[1] - f[3])) / f[3]) ** 2;
        else if (f[0] === 'rollers' && d >= f[1] && d < f[2]) off += f[3] * Math.sin((d - f[1]) / f[4] * Math.PI * 2) * smooth((d - f[1]) / 30) * smooth((f[2] - d) / 30);
        else if (f[0] === 'crevasse' && Math.abs(d - f[1]) < f[3]) off -= f[2] * (1 - ((d - f[1]) / f[3]) ** 2) ** 2;
      }
      r.off[j] = off;
    }
  }
  r_surfaces(routes);

  const h = new Float32Array(nx * nd), surf = new Uint8Array(nx * nd), owner = new Uint8Array(nx * nd);
  for (let j = 0; j < nd; j++) {
    const d = d0 + j * CELL, act = routes.filter(r => r.on[j]);
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * CELL;
      let best = 1e9, val = 1e9, who = 0, bu = 9;
      for (const r of act) {
        const w = r.w[j], dist = Math.abs(x - r.cx[j]), u = dist / w;
        const bowl = 0.05 * w + 0.15;
        let b;
        if (u <= 1) b = bowl * u * u;
        else {
          const e = dist - w, L = 3 + 0.3 * w, H = 3 + 0.6 * w;
          b = bowl + H * (1 - Math.exp(-((e / L) ** 2))) + 0.28 * e;
        }
        let v = r.off[j] + b;
        for (const f of r.feats) if (f[0] === 'moguls' && d >= f[1] && d < f[2] && u < 1.2) {
          const env = smooth((d - f[1]) / 20) * smooth((f[2] - d) / 20) * smooth((1.2 - u) / 0.4);
          v += f[3] * env * Math.sin(d / f[4] * Math.PI * 2) * Math.sin(x / (f[4] * 0.8) * Math.PI * 2 + d * 0.21);
        }
        if (v < best) { best = v; who = r.i; bu = u; }
        val = val === 1e9 ? v : smin(val, v, 3);
      }
      let hh = base[j] + val;
      // the wild snow off-piste: lumpy, rising to the valley walls
      const out = clamp((bu - 1.1) / 1.5, 0, 1);
      if (out > 0) hh += out * (fbm(x / 26, d / 26) * 4 + fbm(x / 7, d / 7) * 0.6);
      h[j * nx + i] = hh;
      owner[j * nx + i] = who;
      const r = routes[who];
      surf[j * nx + i] = bu > 1.15 ? SURF.bank : r.surfAt(d, bu);
    }
  }

  const C = { def, routes, x0, d0, nx, nd, cell: CELL, h, surf, owner, base, len: def.len, items: [], R };
  Object.assign(C, terrainFns(C));
  C.forks = findForks(routes);
  placeItems(C);
  return C;
}

function r_surfaces(routes) {
  for (const r of routes) {
    const list = typeof r.surf === 'string' ? [[-1e9, 1e9, r.surf]] : r.surf;
    r.surfAt = (d, u) => {
      let s = list[list.length - 1][2];
      for (const [a, b, t] of list) if (d >= a && d < b) { s = t; break; }
      if (s === 'lake') return u < 0.85 ? SURF.ice : SURF.powder;
      return SURF[s];
    };
    r.mainSurf = list.some(l => l[2] === 'lake' || l[2] === 'ice') ? 'ice' : list[0][2];
  }
}

function terrainFns(C) {
  const { x0, d0, nx, nd, h, surf } = C;
  const heightAt = (x, d) => {
    let fx = (x - x0) / CELL, fd = (d - d0) / CELL;
    fx = clamp(fx, 0, nx - 1.001); fd = clamp(fd, 0, nd - 1.001);
    const i = Math.floor(fx), j = Math.floor(fd), u = fx - i, v = fd - j, k = j * nx + i;
    // on the same two triangles per cell that the snow is drawn with, so the ball sits exactly on what you see
    if (u + v <= 1) return h[k] + (h[k + 1] - h[k]) * u + (h[k + nx] - h[k]) * v;
    const h11 = h[k + nx + 1];
    return h11 + (h[k + nx] - h11) * (1 - u) + (h[k + 1] - h11) * (1 - v);
  };
  const surfAt = (x, d) => {
    const i = clamp(Math.round((x - x0) / CELL), 0, nx - 1), j = clamp(Math.round((d - d0) / CELL), 0, nd - 1);
    return surf[j * nx + i];
  };
  const ownerAt = (x, d) => {
    const i = clamp(Math.round((x - x0) / CELL), 0, nx - 1), j = clamp(Math.round((d - d0) / CELL), 0, nd - 1);
    return C.owner[j * nx + i];
  };
  // a route's centre and half-width at d
  const routeAt = (r, d) => {
    const j = clamp(Math.round((d - d0) / CELL), 0, nd - 1);
    return [r.cx[j], r.w[j]];
  };
  return { heightAt, surfAt, ownerAt, routeAt };
}

function findForks(routes) {
  const forks = [];
  const starts = routes.filter(r => r.d0 > -50).sort((a, b) => a.d0 - b.d0);
  for (const r of starts) {
    const f = forks.find(f => Math.abs(f.d - r.d0) < 30);
    if (f) f.routes.push(r); else forks.push({ d: r.d0, routes: [r] });
  }
  return forks.filter(f => f.routes.length > 1).map(f => {
    f.routes.sort((a, b) => (a.cx[0] + a.path[1][1]) - (b.cx[0] + b.path[1][1]));
    f.routes.sort((a, b) => a.path[1][1] - b.path[1][1]);
    return f;
  });
}

// ------------------------------------------------------------------------------------------------- filling it
function placeItems(C) {
  const { def, routes, R } = C;
  const items = C.items;
  const buckets = new Map();   // 10 m bands of d, for spacing things out
  const expect = d => def.start * (def.medals[0] / def.start) ** clamp(d / def.len, 0, 1);
  const pick = arr => arr[Math.floor(R() * arr.length)];
  const weighted = obj => {
    let tot = 0;
    for (const k in obj) tot += obj[k];
    let x = R() * tot;
    for (const k in obj) if ((x -= obj[k]) <= 0) return k;
    return Object.keys(obj)[0];
  };
  const fits = (x, d, cr) => {
    const b0 = Math.floor((d - cr - 30) / 10), b1 = Math.floor((d + cr + 30) / 10);
    for (let b = b0; b <= b1; b++) {
      const arr = buckets.get(b);
      if (!arr) continue;
      for (const o of arr) {
        const dx = o.x - x, dd = o.d - d, m = (o.cr + cr) * 0.85;
        if (dx * dx + dd * dd < m * m) return false;
      }
    }
    return true;
  };
  const add = (key, x, d, yaw, o = {}) => {
    const it = ITEMS[key];
    if (!it) return null;
    // keep the start clear
    if (!o.force && d < 14 && Math.abs(x) < 4 + def.start * 3) return null;
    const scale = o.scale || (it.need > 4 ? 1 : 0.9 + R() * 0.22);
    const cr = it.cr * scale;
    if (!o.force && !fits(x, d, cr)) return null;
    // stand it on the lowest point under its footprint, so nothing floats over the slope
    const fw = it.w * scale * 0.4, fd = it.dp * scale * 0.4;
    let y = C.heightAt(x, d);
    if (it.need > 1) y = Math.min(y, C.heightAt(x - fw, d - fd), C.heightAt(x + fw, d - fd), C.heightAt(x - fw, d + fd), C.heightAt(x + fw, d + fd));
    else y -= 0.02 * it.h * scale;
    const obj = {
      id: items.length, key, x, d, y, yaw, scale, cr, need: it.need * scale, h: it.h * scale,
      tint: it.tint ? pick(PALETTES[it.tint]) : null, phase: R() * 100,
      move: o.still ? null : it.move || null, follow: !!o.follow,
      town: C.def.town && d >= C.def.town.from, deco: !!o.deco,
    };
    items.push(obj);
    const b = Math.floor(d / 10);
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b).push(obj);
    return obj;
  };
  const group = {
    r: R, pick,
    put: (key, d, x, yaw = 0, o) => add(key, x, d, yaw, o),
    near: (key, d, x, rad) => { for (let k = 0; k < 6; k++) { const a = R() * Math.PI * 2, m = rad * (0.4 + R() * 0.6); if (add(key, x + Math.cos(a) * m, d + Math.sin(a) * m, R() * 6.28)) return; } },
  };

  // landmarks first, so nothing else lands on them
  for (const r of routes) for (const [d, key, scale, x] of r.landmarks || []) {
    if (GROUPS[key]) GROUPS[key](group, d, x);
    else add(key, x, d, key === 'ferris' ? Math.PI / 2 : 0, { scale, force: true });
  }
  // a trail of little things straight down from the start, to get you going
  const crumbs = Object.keys(ITEMS).filter(k => ITEMS[k].need <= def.start * 0.95 && ITEMS[k].need >= def.start * 0.35 && !ITEMS[k].move);
  if (crumbs.length) {
    const step = 1.3 * Math.sqrt(def.start / 0.2);
    for (let d = 6; d < 75 * Math.sqrt(def.start / 0.2); d += step * (0.8 + R() * 0.4)) {
      // dead straight at first (the ball rolls down the middle by itself), then wandering, so you have to steer
      const x = Math.sin(d * 0.06) * (1.2 + def.start * 2) * smooth((d - 18) / 20) + (R() - 0.5) * def.start * 0.4;
      add(pick(crumbs), x, d, R() * 6.28, { force: true });
    }
  }
  // the finish line, sized to the route at the bottom
  const last = routes.reduce((a, b) => (b.d1 > a.d1 ? b : a));
  const [lcx, lw] = C.routeAt(last, def.len - 10);
  const ban = add('banner', lcx, def.len - 10, 0, { scale: (lw * 2 + 4) / 12, force: true, still: true });
  ban.pass = true;   // you roll under it if you can't take it
  C.finish = def.len - 10;
  // trail signs at each fork, a little uphill of it
  for (const f of C.forks) {
    const s = clamp(expect(f.d) / 0.9, 1, 12);
    add('signpost', 0, f.d - 4, 0, { scale: s, force: true, still: true });
  }

  for (const r of routes) {
    // what's in the channel
    for (const [za, zb, kitName, per100] of r.zones || []) {
      const kit = KITS[kitName];
      const n = Math.round((zb - za) / 100 * per100);
      for (let k = 0; k < n; k++) {
        const d = za + R() * (zb - za);
        const [cx, w] = C.routeAt(r, d);
        const key = weighted(kit);
        if (key[0] === '$') {
          const gname = key.slice(1);
          GROUPS[gname](group, d, cx + (R() * 2 - 1) * w * 0.55);
          continue;
        }
        const it = ITEMS[key];
        if (!it) continue;
        // big things keep to the sides until you're likely big enough for them
        const big = it.need > expect(d) * 1.4;
        let u = R() * 2 - 1;
        if (big) u = Math.sign(u || 1) * (0.55 + R() * 0.5);
        const x = cx + u * w;
        const yaw = it.move === 'ski' || it.move === 'drive' ? (R() - 0.5) * 0.8 : R() * Math.PI * 2;
        for (let t = 0; t < 4; t++) if (add(key, x + (t ? (R() - 0.5) * 3 : 0), d + (t ? (R() - 0.5) * 3 : 0), yaw)) break;
      }
    }
    // what lines the banks
    if (r.edge) {
      const gap = r.gap || 7, out = r.out || [1.5, 14];
      for (let d = r.d0 + 10; d < r.d1 - 6; d += gap * (0.7 + R() * 0.6)) {
        const [cx, w] = C.routeAt(r, d);
        for (const side of [-1, 1]) {
          const key = weighted(r.edge);
          const it = ITEMS[key];
          if (!it || !(r.edge[key] > 0)) continue;
          const half = Math.max(it.w, it.dp) * 0.5;
          const off = out[0] + R() * (out[1] - out[0]) + (out[1] > 6 ? 0 : half);
          const x = cx + side * (w + off);
          // only on open bank, never in some other route's channel (at a fork, say)
          const inner = x - side * half;
          if (C.surfAt(inner, d) !== SURF.bank || C.surfAt(inner, d - half) !== SURF.bank || C.surfAt(inner, d + half) !== SURF.bank) continue;
          // facing the route, for buildings and the like
          const yaw = it.need > 8 && key.indexOf('pine') < 0 && key !== 'birch' ? (side < 0 ? Math.PI / 2 : -Math.PI / 2) + (key === 'house' || key === 'shop' || key === 'chalet' ? 0 : 0) : R() * Math.PI * 2;
          add(key, x, d, yaw, { deco: true });
          // a second row of trees further up the bank
          if (key.startsWith('pine') && R() < 0.6) {
            const x2 = x + side * (4 + R() * 10), d2 = d + (R() - 0.5) * gap;
            if (C.surfAt(x2, d2) === SURF.bank) add(weighted(r.edge), x2, d2, R() * 6.28, { deco: true });
          }
        }
      }
    }
  }
  // the back wall of the summit, and forest on the valley walls: scenery mostly beyond reach
  for (let d = C.d0 + 20; d < def.len + 200; d += 9) {
    for (const side of [-1, 1]) {
      const x = side > 0 ? C.x0 + C.nx * CELL - 30 - R() * 50 : C.x0 + 30 + R() * 50;
      if (R() < 0.75) add(R() < 0.3 ? 'pine_tall' : 'pine', x, d, R() * 6.28, { deco: true });
    }
  }
  items.sort((a, b) => a.d - b.d);
  items.forEach((o, i) => { o.id = i; });
  C.townTotal = items.filter(o => o.town && !o.deco).length + items.filter(o => o.town && o.deco && o.need > 6).length;
}
