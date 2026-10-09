// Everything on the mountain that can end up inside the snowball.
//   need   the snowball's diameter (m) before it can pick the thing up; anything bigger is in the way
//   tint   palette the instance colour is picked from (jackets, cars, house fronts)
//   anim   how it wobbles: idle on the slope, and how hard it flails once it's stuck to the ball
//   move   ski / walk / skate / hop / graze / drive / stomp: what it does when the snowball comes near
//   say    the noise it makes when you take it
//   lines  for the incident report, one picked at random
import { DIMS } from './dims.js';

export const PALETTES = {
  jacket: ['#e8412f', '#2f74d0', '#f2b134', '#1fa28f', '#ef6fa0', '#7a4fc0', '#f47a24', '#3aa04a', '#26c0e0', '#ffffff'],
  knit: ['#e8412f', '#2f74d0', '#f2b134', '#1fa28f', '#ef6fa0', '#7a4fc0', '#ffffff'],
  car: ['#d93a2b', '#2a66c4', '#f2c230', '#f4f4f0', '#30343c', '#1e9c8c', '#f07a24', '#8a2be2'],
  house: ['#f5c6c0', '#c7e6d4', '#fbe7a8', '#bcd8f2', '#d9c8ef', '#ffd6b0', '#f4eee0', '#e8a598'],
  gift: ['#d93a2b', '#2f9a4a', '#2f74d0', '#e8b23a', '#8a4fc0', '#ef6fa0'],
  bright: ['#e8412f', '#2f74d0', '#f2b134', '#1fa28f', '#f47a24'],
  flag: ['#e8412f', '#2f74d0', '#f2b134'],
  tent: ['#f47a24', '#e8412f', '#2f9a4a', '#f2b134', '#2f74d0'],
  roof: ['#3d6fd0', '#c73a2b', '#2f8a5a', '#7a4fc0'],
};

// anim kinds: [idle amplitude, idle speed, stuck amplitude, stuck speed]; amplitudes are fractions of the model's height
const ANIM = {
  none: [0, 0, 0.02, 6],
  person: [0.02, 3, 0.16, 15],
  kid: [0.03, 4, 0.2, 18],
  animal: [0.03, 4, 0.14, 13],
  bird: [0.05, 8, 0.2, 20],
  tree: [0.012, 1.3, 0.05, 5],
  flame: [0.18, 11, 0.25, 16],
  flag: [0.06, 6, 0.12, 12],
  floppy: [0.03, 3, 0.1, 10],
};

const I = (need, name, plural, lines, o = {}) => ({ need, name, plural: plural || name + 's', lines, ...o });

export const ITEMS = {
  pinecone: I(0.12, 'pinecone', 0, ['slightly sticky', 'pre-owned by a squirrel', 'mostly scales'], { say: 'pop' }),
  carrot: I(0.15, 'carrot', 0, ['a snowman’s nose', 'organic', 'still crunchy'], { say: 'pop' }),
  cocoa: I(0.16, 'mug of cocoa', 'mugs of cocoa', ['extra marshmallows', 'half drunk', 'still hot, somehow'], { say: 'clink' }),
  mitten: I(0.17, 'mitten', 0, ['left hand only', 'still warm', 'on a string'], { tint: 'knit', say: 'pop' }),
  robin: I(0.18, 'robin', 0, ['indignant', 'tweeting furiously', 'puffed up'], { anim: 'bird', move: 'hop', say: 'tweet' }),
  candycane: I(0.2, 'candy cane', 0, ['peppermint', 'pre-licked', 'striped'], { say: 'clink' }),
  goggles: I(0.2, 'pair of goggles', 'pairs of goggles', ['mirrored', 'fogged up', 'with a tan line'], { tint: 'bright', say: 'clink' }),
  beanie: I(0.24, 'bobble hat', 0, ['hand-knitted by a nan', 'bobble intact', 'itchy'], { tint: 'knit', say: 'pop' }),
  thermos: I(0.25, 'flask', 0, ['of soup', 'of tea, probably', 'lid missing'], { tint: 'bright', say: 'clank' }),
  fish: I(0.3, 'fish', 'fish', ['the one that got away', 'flapping', 'not impressed'], { anim: 'floppy', say: 'squelch' }),
  lantern: I(0.3, 'lantern', 0, ['still lit', 'flickering bravely'], { say: 'clink' }),
  squirrel: I(0.3, 'squirrel', 0, ['clutching its acorn', 'chattering', 'tail first'], { anim: 'animal', move: 'hop', say: 'squeak' }),
  boot: I(0.32, 'ski boot', 0, ['unbuckled', 'impossible to walk in', 'size 11'], { tint: 'bright', say: 'thunk' }),
  gift: I(0.32, 'present', 0, ['do not open until Christmas', 'socks, by the feel of it', 'rattles'], { tint: 'gift', say: 'clink' }),
  rabbit: I(0.4, 'snow hare', 0, ['ears first', 'thumping', 'in its winter coat'], { anim: 'animal', move: 'hop', say: 'squeak' }),
  sapling: I(0.5, 'baby fir', 0, ['roots and all', 'barely a twig'], { anim: 'tree', say: 'rustle' }),
  marker: I(0.5, 'piste marker', 0, ['now off-piste'], { tint: 'flag', say: 'thunk' }),
  gnome: I(0.55, 'garden gnome', 0, ['smug', 'hiding in plain sight', 'fishing rod lost'], { say: 'clink' }),
  cone: I(0.55, 'traffic cone', 0, ['on loan from the car park', 'unhelpfully placed'], { say: 'thunk' }),
  pistepole: I(0.55, 'slalom gate', 0, ['missed it', 'bent but unbroken'], { tint: 'flag', say: 'thunk' }),
  skis: I(0.6, 'pair of skis', 'pairs of skis', ['rental', 'freshly waxed', 'one bent'], { tint: 'bright', say: 'clank' }),
  snowboard: I(0.65, 'snowboard', 0, ['covered in stickers', 'goofy-footed'], { tint: 'bright', say: 'clank' }),
  sled: I(0.7, 'toboggan', 0, ['no brakes', 'wax on the runners'], { say: 'thunk' }),
  fox: I(0.9, 'fox', 'foxes', ['mid-pounce', 'what does it say?', 'bushy-tailed'], { anim: 'animal', move: 'hop', say: 'yip' }),
  crate: I(0.9, 'crate', 0, ['THIS WAY UP', 'full of fondue sets'], { say: 'crunch' }),
  deckchair: I(0.9, 'deckchair', 0, ['someone was sitting there', 'folded flat'], { tint: 'bright', say: 'thunk' }),
  barrel: I(1.0, 'barrel', 0, ['empty', 'of something warming'], { say: 'thunk' }),
  mailbox: I(1.0, 'mailbox', 'mailboxes', ['full of postcards', 'flag up'], { tint: 'car', say: 'clank' }),
  trashcan: I(1.0, 'bin', 0, ['emptied, sort of', 'lid flapping'], { say: 'clank' }),
  snowman_s: I(1.1, 'little snowman', 'little snowmen', ['already a snowball, technically', 'reunited with family', 'carrot intact'], { tint: 'knit', anim: 'floppy', say: 'pop' }),
  kid: I(1.1, 'ski-school kid', 0, ['doing pizza', 'having the best day ever', 'lost a mitten'], { tint: 'jacket', anim: 'kid', move: 'ski', say: 'kid' }),
  bench: I(1.3, 'park bench', 0, ['memorial plaque included', 'snow on the seat'], { say: 'crunch' }),
  signpost: I(1.3, 'trail sign', 0, ['now pointing everywhere', 'blue run this way'], { say: 'crunch' }),
  dog: I(1.3, 'St Bernard', 0, ['came to rescue you', 'brandy barrel included', 'good boy'], { anim: 'animal', move: 'walk', say: 'woof' }),
  goat: I(1.4, 'mountain goat', 0, ['unbothered', 'chewing something'], { anim: 'animal', move: 'graze', say: 'bleat' }),
  fence: I(1.5, 'stretch of fencing', 'stretches of fencing', ['bright orange', 'held nothing back'], { anim: 'flag', say: 'crunch' }),
  campfire: I(1.5, 'campfire', 0, ['marshmallows toasted', 'still crackling'], { anim: 'flame', say: 'whoosh' }),
  skier: I(1.8, 'skier', 0, ['still skiing', 'yelling “on your left”', 'mid-selfie', 'on their first day', 'insists they had right of way'], { tint: 'jacket', anim: 'person', move: 'ski', say: 'scream' }),
  racer: I(1.8, 'racer', 0, ['personal best', 'in a tuck', 'disqualified'], { tint: 'jacket', anim: 'person', move: 'ski', say: 'scream' }),
  boarder: I(1.8, 'snowboarder', 0, ['said “gnarly”', 'mid-trick', 'sitting down, mostly'], { tint: 'jacket', anim: 'person', move: 'ski', say: 'scream' }),
  walker: I(1.8, 'villager', 0, ['out for bread', 'walking the dog', 'just popped out'], { tint: 'jacket', anim: 'person', move: 'walk', say: 'scream' }),
  skater: I(1.8, 'skater', 0, ['mid-twirl', 'a triple axel, nearly'], { tint: 'jacket', anim: 'person', move: 'skate', say: 'scream' }),
  climber: I(1.9, 'mountaineer', 0, ['summit postponed', 'roped in', 'never saw it coming'], { tint: 'jacket', anim: 'person', move: 'walk', say: 'scream' }),
  picnic: I(1.9, 'picnic table', 0, ['crumbs everywhere'], { say: 'crunch' }),
  deer: I(2.2, 'deer', 'deer', ['caught in the headlights', 'antlers first'], { anim: 'animal', move: 'graze', say: 'bleat' }),
  reindeer: I(2.2, 'reindeer', 'reindeer', ['nose still glowing', 'off the naughty list'], { anim: 'animal', move: 'graze', say: 'jingle' }),
  lamppost: I(2.4, 'lamp post', 0, ['still lit', 'Narnia-adjacent'], { say: 'clank' }),
  outhouse: I(2.5, 'outhouse', 0, ['occupied', 'door flapping'], { say: 'crunch' }),
  phonebox: I(2.6, 'phone box', 'phone boxes', ['call ended abruptly', 'reverse charges'], { say: 'clank' }),
  snowmobile: I(2.6, 'snowmobile', 0, ['engine still running', 'keys in it'], { tint: 'bright', move: 'drive', say: 'honk' }),
  snowman: I(2.8, 'snowman', 'snowmen', ['top hat and all', 'happy to be home', 'basically family'], { tint: 'knit', anim: 'floppy', say: 'pop' }),
  tent: I(2.8, 'tent', 0, ['zip stuck', 'someone still inside'], { tint: 'tent', say: 'crunch' }),
  bear: I(3.0, 'bear', 0, ['was hibernating', 'grumpier than before'], { anim: 'animal', move: 'graze', say: 'roar' }),
  skirack: I(3.0, 'ski rack', 0, ['six pairs, unlocked'], { say: 'clank' }),
  snowcannon: I(3.0, 'snow cannon', 0, ['making more of you'], { say: 'clank' }),
  crystal: I(3.0, 'ice crystal', 0, ['priceless', 'humming faintly'], { say: 'clink' }),
  hottub: I(3.2, 'hot tub, occupied', 'hot tubs, occupied', ['party still going', 'bubbles on'], { anim: 'person', say: 'splash' }),
  boulder: I(3.2, 'boulder', 0, ['older than the mountain', 'rolling now'], { say: 'thud' }),
  igloo: I(3.6, 'igloo', 0, ['occupant evicted', 'one careful owner'], { say: 'crunch' }),
  icehut: I(3.6, 'ice-fishing hut', 0, ['fish still biting', 'heater on'], { tint: 'car', say: 'crunch' }),
  logpile: I(3.6, 'woodpile', 0, ['for the winter', 'neatly stacked'], { say: 'crunch' }),
  moose: I(3.6, 'moose', 'moose', ['very surprised', 'antlers sticking out', 'a lot of moose'], { anim: 'animal', move: 'graze', say: 'moose' }),
  pine_s: I(3.6, 'little fir', 0, ['roots and all', 'shook its snow off'], { anim: 'tree', say: 'rustle' }),
  sleigh: I(3.8, 'sleigh', 0, ['reindeer not included', 'presents delivered early'], { say: 'jingle' }),
  yeti: I(3.8, 'yeti', 'yetis', ['real after all', 'blurry photo confirmed', 'very offended'], { anim: 'person', move: 'stomp', say: 'roar' }),
  stall: I(4.0, 'market stall', 0, ['mulled wine everywhere', 'all sales final'], { tint: 'roof', say: 'crunch' }),
  gondola: I(4.2, 'gondola', 0, ['people still inside', 'came off the cable'], { tint: 'bright', say: 'clank' }),
  car: I(5.0, 'car', 0, ['alarm going off', 'parked badly', 'snow chains on'], { tint: 'car', move: 'drive', say: 'honk' }),
  birch: I(6.0, 'birch tree', 0, ['bark and all'], { anim: 'tree', say: 'rustle' }),
  mammoth: I(6.5, 'frozen mammoth', 0, ['ten thousand years in the ice', 'thawing nicely'], { anim: 'animal', say: 'trumpet' }),
  snowcat: I(8.0, 'piste basher', 0, ['grooming you now', 'night shift ended early'], { move: 'drive', say: 'honk' }),
  pine: I(8.5, 'fir tree', 0, ['snow and all', 'roots trailing'], { anim: 'tree', say: 'rustle' }),
  firetruck: I(9.0, 'fire engine', 0, ['sirens wailing', 'came to put you out'], { move: 'drive', say: 'siren' }),
  bus: I(11, 'ski bus', 0, ['next stop: inside you', 'skis on the roof'], { tint: 'bright', move: 'drive', say: 'honk' }),
  xmastree: I(11, 'town Christmas tree', 0, ['lights still on', 'star on top'], { anim: 'tree', say: 'jingle' }),
  pylon: I(11, 'lift tower', 0, ['lift closed until further notice'], { say: 'clank' }),
  cabin: I(12, 'log cabin', 0, ['smoke still rising', 'kettle on'], { say: 'crash' }),
  carriage: I(13, 'railway carriage', 0, ['passengers enjoying the view'], { say: 'crash' }),
  train: I(14, 'steam engine', 0, ['running late', 'full steam ahead'], { say: 'choo' }),
  banner: I(14, 'finish line', 0, ['crossed, technically'], { tint: 'flag', anim: 'flag', say: 'crunch' }),
  pine_tall: I(14, 'giant fir', 0, ['a hundred years old'], { anim: 'tree', say: 'rustle' }),
  shop: I(15, 'bakery', 'bakeries', ['fresh out of rolls', 'bell over the door'], { tint: 'house', say: 'crash' }),
  chalet: I(16, 'chalet', 0, ['fondue night interrupted', 'balcony and all'], { say: 'crash' }),
  house: I(16, 'town house', 0, ['lights on, nobody home', 'chimney first'], { tint: 'house', say: 'crash' }),
  watertower: I(16, 'water tower', 0, ['frozen solid'], { tint: 'flag', say: 'clank' }),
  church: I(24, 'church', 0, ['bells ringing', 'choir mid-carol'], { say: 'bell' }),
  clocktower: I(26, 'clock tower', 0, ['time flies', 'striking twelve'], { say: 'bell' }),
  lodge: I(30, 'ski lodge', 0, ['après-ski cancelled', 'fire still roaring'], { say: 'crash' }),
  ferris: I(30, 'Ferris wheel', 0, ['still turning', 'a great view, briefly'], { tint: 'flag', say: 'crash' }),
  hotel: I(36, 'grand hotel', 0, ['all two hundred rooms', 'checkout was at eleven'], { tint: 'house', anim: 'flag', say: 'crash' }),
  castle: I(52, 'castle', 0, ['the king was out', 'drawbridge up, briefly'], { tint: 'flag', anim: 'flag', say: 'crash' }),
};

for (const [key, it] of Object.entries(ITEMS)) {
  const d = DIMS[key];
  if (!d) throw new Error('no model for ' + key);
  it.key = key;
  it.w = d[0]; it.h = d[1]; it.dp = d[2]; it.lo = d[3];
  // how far out from its own centre it collides: a bit inside its footprint, so you brush past corners
  it.cr = Math.max(0.03, Math.min(d[0], d[2]) * 0.38 + Math.max(d[0], d[2]) * 0.1);
  // trees: you hit the trunk; the lower branches just brush past
  if (it.anim === 'tree' && key !== 'xmastree') it.cr = Math.max(0.05, Math.max(d[0], d[2]) * 0.18);
  // how solid it is: trees are mostly branches and air, buildings are hollow, so they add less snowball than their size
  it.mass = it.anim === 'tree' ? 0.3 : it.need >= 10 && !it.move ? 0.4 : it.move === 'drive' || it.need >= 4 ? 0.6 : 1;
  const a = ANIM[it.anim || 'none'];
  it.idle = [a[0] * d[1], a[1]];
  it.stuck = [a[2] * d[1], a[3]];
}

// sizes in words, for the size readout and the "big enough for…" calls
export function sizeWords(dia) {
  if (dia < 1) return Math.round(dia * 100) + ' cm';
  if (dia < 10) return dia.toFixed(2).replace(/0$/, '') + ' m';
  return dia.toFixed(1).replace(/\.0$/, '') + ' m';
}
