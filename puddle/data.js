// Puddles, the hours, and everything that can be caught in them.
// Catch pictures are flat colour blocks (SVG path data in a 100×100 box) cut like a woodblock:
// each [colour, path] is printed, then the key block (`line`) is printed over the top.

export const PHASES = ['Dusk', 'Night', 'Small hours', 'Dawn'];
export const WEATHERS = ['Drizzle', 'Downpour', 'Clearing'];
export const HOUR_SECONDS = 45;           // real seconds per in-game hour; a day is eight hours
export const MOON_GATE = 24;              // distinct catches before the moon comes down

export const SPOTS = [
  { key: 'lamp',   name: 'Under the lamp',    short: 'Lamp',     need: 0 },
  { key: 'bakery', name: 'By the bakery',     short: 'Bakery',   need: 2 },
  { key: 'tram',   name: 'At the tram stop',  short: 'Tram',     need: 5 },
  { key: 'cherry', name: 'Under the cherry',  short: 'Cherry',   need: 9 },
  { key: 'bridge', name: 'On the bridge',     short: 'Bridge',   need: 13 },
  { key: 'square', name: 'In the square',     short: 'Square',   need: 17 },
];

export const INK = {
  ink: '#24212b', paper: '#f1e6cd', white: '#f7f1e3', red: '#c4432f', verm: '#dc6a3e', yellow: '#ecc04f',
  lamp: '#f6dc8e', indigo: '#2b4470', blue: '#5479a6', pale: '#b3c6d8', green: '#5d7f58', pink: '#eaa9a6',
  brown: '#8b5b3c', kraft: '#c9a46a', grey: '#8f8c88', gold: '#d6a33a', orange: '#e48a3a', moon: '#f0e3b2',
};

const circ = (cx, cy, r) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const star = (cx, cy, R, r, n = 5, rot = -Math.PI / 2) => {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = rot + i * Math.PI / n, rr = i % 2 ? r : R;
    d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1);
  }
  return d + 'Z';
};
const band = (cx, cy, r1, r2) => `M${cx - r1} ${cy} A${r1} ${r1} 0 0 1 ${cx + r1} ${cy} L${cx + r2} ${cy} A${r2} ${r2} 0 0 0 ${cx - r2} ${cy}Z`;

// rarity: weight when a shadow is chosen. style: how it fights on the line. weight: how long it takes to land.
// spots/phases/weather: where and when it turns up (indices into the lists above; null means any).
export const CATCHES = [
  { id: 'button', name: 'A coat button', note: 'From a coat in the reflected world. Somebody over there is cold.',
    spots: null, phases: null, weather: null, rarity: 7, style: 'steady', weight: 0.7, size: 0.55,
    art: [['brown', circ(50, 50, 32)], ['ink', circ(41, 41, 4)], ['ink', circ(59, 41, 4)], ['ink', circ(41, 59, 4)], ['ink', circ(59, 59, 4)]],
    line: [circ(50, 50, 24)] },
  { id: 'pigeon', name: 'A pigeon', note: 'Fine. Indignant, but fine.',
    spots: [0, 1, 2, 5], phases: [0, 3], weather: [0, 2], rarity: 6, style: 'burst', weight: 1.0, size: 0.9,
    art: [['grey', 'M18 62 L6 56 L10 70 Z'], ['grey', 'M18 62 C20 44 40 38 56 42 C64 30 80 30 84 40 L94 44 L84 47 C84 58 74 70 56 72 C40 74 26 70 18 62 Z'],
      ['pale', 'M34 52 C46 46 60 50 66 60 C54 64 42 62 34 52Z'], ['ink', circ(78, 39, 2.5)]],
    line: ['M50 72 L47 84 M58 72 L61 84'] },
  { id: 'lampglow', name: 'The glow of the lamp', note: 'Warm in the hand. Hums a little, like it misses the lamp.',
    spots: [0], phases: [1, 2], weather: null, rarity: 5, style: 'steady', weight: 0.9, size: 0.8, glow: true,
    art: [['lamp', circ(50, 50, 36)], ['yellow', circ(50, 50, 21)], ['white', circ(50, 50, 9)]], line: [] },
  { id: 'moth', name: 'A moth', note: 'Followed the lamp down and could not find the way back up.',
    spots: [0, 1], phases: [1, 2], weather: [0, 2], rarity: 5, style: 'dart', weight: 0.7, size: 0.65,
    art: [['kraft', 'M50 40 C36 18 12 22 15 40 C18 53 34 55 50 50 Z'], ['kraft', 'M50 40 C64 18 88 22 85 40 C82 53 66 55 50 50 Z'],
      ['kraft', 'M50 50 C40 56 28 70 37 75 C44 78 48 64 50 56Z'], ['kraft', 'M50 50 C60 56 72 70 63 75 C56 78 52 64 50 56Z'],
      ['yellow', circ(30, 38, 5)], ['yellow', circ(70, 38, 5)], ['brown', 'M47 33 L53 33 L54 66 L46 66 Z']],
    line: ['M48 34 C44 24 40 21 35 19 M52 34 C56 24 60 21 65 19'] },
  { id: 'glove', name: 'A lost glove', note: 'Still waving at whoever it was waving at.',
    spots: [2, 1], phases: null, weather: [0, 1], rarity: 5, style: 'steady', weight: 0.8, size: 0.7,
    art: [['red', 'M30 88 L30 50 C30 44 33 42 36 42 L36 22 C36 17 42 17 42 22 L42 40 L46 40 L46 16 C46 11 52 11 52 16 L52 40 L56 40 L56 20 C56 15 62 15 62 20 L62 44 L66 44 L66 31 C66 26 72 26 72 31 L72 62 C72 75 66 81 65 88 Z'],
      ['paper', 'M28 82 L67 82 L67 95 L28 95 Z']], line: ['M33 86 L33 92 M41 86 L41 92 M49 86 L49 92 M57 86 L57 92'] },
  { id: 'ticket', name: 'A tram ticket', note: 'Punched for a stop that is not on any map.',
    spots: [2], phases: null, weather: [0, 2], rarity: 6, style: 'float', weight: 0.6, size: 0.6,
    art: [['paper', 'M18 30 L82 30 L82 44 C77 44 77 56 82 56 L82 70 L18 70 L18 56 C23 56 23 44 18 44 Z'],
      ['blue', 'M18 34 L82 34 L82 41 L18 41 Z'], ['ink', circ(66, 56, 4)]], line: ['M28 50 L56 50 M28 58 L48 58'] },
  { id: 'umbrella', name: 'An umbrella', note: 'Blew inside out, then right side in, then away.',
    spots: [2, 1], phases: null, weather: [1], rarity: 6, style: 'gust', weight: 1.2, size: 1.0,
    art: [['indigo', 'M10 52 C14 26 34 14 50 14 C66 14 86 26 90 52 C84 46 76 46 70 52 C64 46 56 46 50 52 C44 46 36 46 30 52 C24 46 16 46 10 52 Z']],
    line: ['M50 14 L30 51 M50 14 L50 51 M50 14 L70 51', 'M50 52 L50 84 C50 93 39 93 39 86'] },
  { id: 'buns', name: 'A bag of buns', note: 'Still warm. Things keep well in a reflection.',
    spots: [1], phases: [3, 0], weather: null, rarity: 5, style: 'steady', weight: 1.0, size: 0.8,
    art: [['gold', 'M33 36 C31 21 50 18 50 31 C52 18 70 21 67 36 Z'], ['kraft', 'M28 34 L72 34 L76 90 L24 90 Z']], line: ['M28 34 L36 27 M72 34 L64 27 M40 50 L60 50'] },
  { id: 'hat', name: "A baker's hat", note: 'Blown off at five in the morning, mid-yawn.',
    spots: [1], phases: [3], weather: [1, 0], rarity: 4, style: 'gust', weight: 0.9, size: 0.8,
    art: [['white', 'M28 60 C14 58 12 36 28 34 C28 18 50 14 54 28 C62 16 84 22 76 40 C88 44 84 62 72 60 Z'], ['white', 'M30 60 L70 60 L70 80 L30 80 Z']],
    line: ['M40 63 L40 78 M50 63 L50 78 M60 63 L60 78'] },
  { id: 'petal', name: 'A cherry petal', note: 'One of thousands. You caught this one.',
    spots: [3], phases: null, weather: [0, 2], rarity: 7, style: 'float', weight: 0.5, size: 0.45,
    art: [['pink', 'M50 86 C30 70 26 40 40 22 L50 32 L60 22 C74 40 70 70 50 86 Z']], line: ['M50 34 L50 78'] },
  { id: 'lantern', name: 'A paper lantern', note: 'Still lit. Nobody quite knows what with.',
    spots: [3], phases: [1, 2], weather: [0, 2], rarity: 4, style: 'steady', weight: 1.0, size: 0.85, glow: true,
    art: [['verm', 'M30 30 C19 44 19 64 30 76 L70 76 C81 64 81 44 70 30 Z'], ['yellow', 'M40 36 C34 46 34 62 40 70 L60 70 C66 62 66 46 60 36Z'],
      ['ink', 'M34 22 L66 22 L66 30 L34 30 Z'], ['ink', 'M34 76 L66 76 L66 84 L34 84Z']],
    line: ['M23 46 L77 46 M21 58 L79 58 M24 68 L76 68', 'M50 84 L50 96 M50 22 L50 10'] },
  { id: 'crow', name: 'A crow', note: 'Brought you a button. Wants it back now.',
    spots: [3, 0, 5], phases: [0, 3], weather: null, rarity: 4, style: 'burst', weight: 1.1, size: 0.95,
    art: [['ink', 'M14 60 C24 42 46 36 62 40 L72 34 C80 30 88 34 90 40 L98 44 L88 47 C86 58 70 66 52 66 L34 70 L8 77 Z'], ['white', circ(80, 39, 2.5)]],
    line: ['M50 66 L46 80 M58 65 L60 80'] },
  { id: 'coin', name: 'A wishing coin', note: 'Somebody wished on it. It landed the wrong way up.',
    spots: [4, 5], phases: null, weather: null, rarity: 5, style: 'dart', weight: 0.6, size: 0.5,
    art: [['gold', circ(50, 50, 32)], ['paper', 'M43 43 L57 43 L57 57 L43 57 Z']], line: [circ(50, 50, 24)] },
  { id: 'goldfish', name: 'A goldfish', note: 'Thinks it is swimming in the sky. It is right.',
    spots: [4], phases: null, weather: [2, 0], rarity: 4, style: 'dart', weight: 0.9, size: 0.7,
    art: [['orange', 'M66 50 C80 33 95 31 93 42 C87 50 87 50 93 58 C95 69 80 67 66 50Z'], ['orange', 'M40 37 C44 26 55 28 57 37Z'],
      ['orange', 'M18 50 C28 30 60 30 70 50 C60 70 28 70 18 50 Z'], ['ink', circ(29, 46, 3)]], line: ['M52 40 C56 46 56 54 52 60'] },
  { id: 'boat', name: 'A paper boat', note: 'Folded from a bus timetable. Still afloat, upside down.',
    spots: [4, 2], phases: null, weather: [0, 1], rarity: 6, style: 'float', weight: 0.7, size: 0.75,
    art: [['white', 'M50 22 L50 58 L24 58 Z'], ['pale', 'M50 22 L76 58 L50 58Z'], ['paper', 'M12 58 L88 58 L75 75 L25 75 Z']], line: ['M50 22 L50 75'] },
  { id: 'crane', name: 'A paper crane', note: 'Unfolds a little whenever you look away.',
    spots: [4, 3], phases: null, weather: [1], rarity: 3, style: 'gust', weight: 0.8, size: 0.75,
    art: [['pale', 'M50 56 L18 20 L46 50 Z'], ['pale', 'M50 56 L84 16 L56 50Z'], ['white', 'M12 50 L50 57 L88 44 L57 68 L43 68 Z'], ['white', 'M12 50 L5 41 L17 47Z']], line: [] },
  { id: 'firefly', name: 'A firefly', note: 'Blinks in time with the lamp on the corner.',
    spots: [4, 3], phases: [1], weather: [2], rarity: 4, style: 'dart', weight: 0.6, size: 0.5, glow: true,
    art: [['lamp', circ(50, 62, 26)], ['pale', 'M44 34 C29 22 20 37 40 47 Z'], ['pale', 'M56 34 C71 22 80 37 60 47 Z'],
      ['ink', 'M44 30 L56 30 L58 56 L42 56 Z'], ['yellow', circ(50, 64, 9)], ['red', circ(50, 27, 5)]], line: [] },
  { id: 'cloud', name: 'A small cloud', note: 'Weighs nothing at all. Fought like a tuna.',
    spots: [5, 4], phases: [0, 3], weather: [2], rarity: 4, style: 'heavy', weight: 1.1, size: 1.0,
    art: [['white', 'M20 68 C8 68 8 50 22 50 C20 36 38 30 46 40 C52 26 74 28 74 44 C88 42 94 62 80 68 Z']], line: ['M30 62 C40 66 60 66 72 62'] },
  { id: 'star', name: 'A star', note: 'Small, sharp, and a little colder than expected.',
    spots: [5, 4], phases: [1, 2], weather: [2], rarity: 4, style: 'dart', weight: 0.7, size: 0.5, glow: true,
    art: [['yellow', star(50, 52, 38, 16)]], line: [] },
  { id: 'meteor', name: 'A shooting star', note: 'Very fast. Make the wish now, before it cools.',
    spots: [5], phases: [1, 2], weather: [2], rarity: 2, style: 'dart', weight: 1.3, size: 0.6, glow: true,
    art: [['lamp', 'M58 38 L10 86 L18 92 L66 46 Z'], ['yellow', star(66, 34, 20, 8)]], line: [] },
  { id: 'rainbow', name: 'The end of a rainbow', note: 'Only the end. The rest of it is still up there.',
    spots: [5, 3], phases: [3], weather: [0], rarity: 3, style: 'heavy', weight: 1.2, size: 1.0,
    art: [['red', band(50, 84, 42, 36)], ['orange', band(50, 84, 36, 30)], ['yellow', band(50, 84, 30, 24)], ['green', band(50, 84, 24, 18)], ['blue', band(50, 84, 18, 12)],
      ['white', 'M8 86 C4 76 18 72 24 78 C30 72 40 78 36 86Z']], line: [] },
  { id: 'key', name: 'A house key', note: 'Somebody upside down is locked out tonight.',
    spots: [0, 2], phases: [1, 2], weather: null, rarity: 5, style: 'steady', weight: 0.7, size: 0.6,
    art: [['gold', 'M46 36 L88 36 L88 44 L46 44 Z'], ['gold', 'M74 44 L74 55 L80 55 L80 44 Z'], ['gold', 'M84 44 L84 51 L88 51 L88 44Z'], ['gold', circ(32, 40, 16)], ['paper', circ(32, 40, 6)]], line: [] },
  { id: 'letter', name: 'A letter', note: 'Addressed to you, in mirror writing. You will read it later.',
    spots: [1, 2], phases: null, weather: [0, 2], rarity: 4, style: 'float', weight: 0.6, size: 0.65,
    art: [['paper', 'M14 28 L86 28 L86 74 L14 74 Z'], ['red', circ(50, 54, 6)]], line: ['M14 28 L50 54 L86 28'] },
  { id: 'sock', name: 'A sock', note: 'Every lost sock ends up here eventually.',
    spots: null, phases: null, weather: [1], rarity: 6, style: 'steady', weight: 0.8, size: 0.7,
    art: [['pale', 'M40 12 L64 12 L64 56 C64 64 70 66 76 70 C88 76 84 92 70 90 L44 84 C34 82 34 70 38 62 L40 56 Z'],
      ['red', 'M40 21 L64 21 L64 28 L40 28 Z'], ['red', 'M40 35 L64 35 L64 42 L40 42Z']], line: [] },
  { id: 'feather', name: 'A grey feather', note: 'The pigeon would like this back as well.',
    spots: [5, 3, 0], phases: null, weather: [0, 2], rarity: 5, style: 'float', weight: 0.5, size: 0.6,
    art: [['pale', 'M24 88 C30 60 50 24 80 12 C78 40 60 70 30 84 Z']], line: ['M18 95 C40 66 60 34 80 12', 'M36 70 L28 62 M46 56 L38 46 M56 42 L50 32'] },
  { id: 'teacup', name: 'A teacup', note: 'Still has tea in it. The tea has fallen upwards.',
    spots: [1, 3], phases: [0], weather: [2], rarity: 4, style: 'steady', weight: 0.9, size: 0.75,
    art: [['white', 'M10 80 C20 89 80 89 90 80 Z'], ['white', 'M22 40 L78 40 C78 64 66 78 50 78 C34 78 22 64 22 40 Z'], ['brown', 'M24 40 C30 34 70 34 76 40 C70 46 30 46 24 40Z']],
    line: ['M78 46 C92 46 92 64 73 64', 'M28 54 L72 54'] },
  { id: 'owl', name: 'An owl', note: 'Asked who you were. You were not sure either.',
    spots: [3], phases: [2], weather: null, rarity: 3, style: 'burst', weight: 1.2, size: 0.95,
    art: [['brown', 'M26 30 L36 40 L64 40 L74 30 L76 60 C76 80 64 90 50 90 C36 90 24 80 24 60 Z'], ['paper', circ(40, 52, 10)], ['paper', circ(60, 52, 10)],
      ['ink', circ(40, 52, 4)], ['ink', circ(60, 52, 4)], ['gold', 'M47 58 L53 58 L50 66 Z']], line: ['M40 74 L45 78 L50 74 L55 78 L60 74'] },
  { id: 'kite', name: 'A kite', note: 'Its string goes on down a good deal further than yours.',
    spots: [5, 3], phases: [0, 3], weather: [1], rarity: 3, style: 'gust', weight: 1.1, size: 0.9,
    art: [['red', 'M50 8 L78 40 L50 82 L22 40 Z'], ['yellow', 'M41 88 L49 84 L49 93 Z']], line: ['M50 8 L50 82 M22 40 L78 40', 'M50 82 C40 88 60 92 48 99'] },
  { id: 'balloon', name: 'A red balloon', note: 'Let go of at a birthday on the other side.',
    spots: [5, 0, 4], phases: [0, 3], weather: [0, 2], rarity: 4, style: 'float', weight: 0.8, size: 0.8,
    art: [['red', 'M50 14 C70 14 78 30 78 42 C78 60 62 72 50 74 C38 72 22 60 22 42 C22 30 30 14 50 14 Z'], ['red', 'M46 74 L54 74 L50 80 Z'],
      ['white', 'M35 30 C39 22 46 21 49 24 C42 26 38 31 36 36 Z']], line: ['M50 80 C45 86 56 90 50 98'] },
  { id: 'moon', name: 'The moon', note: 'It was never really up there. It was down here all along.',
    spots: [4, 5], phases: [1, 2], weather: [2], rarity: 40, style: 'heavy', weight: 1.6, size: 1.25, glow: true, gate: MOON_GATE,
    art: [['moon', circ(50, 50, 38)], ['kraft', circ(38, 40, 7)], ['kraft', circ(62, 60, 9)], ['kraft', circ(60, 34, 4)]], line: [] },
];

export const BY_ID = Object.fromEntries(CATCHES.map(c => [c.id, c]));

// A plain-words hint for where and when something turns up.
export function hintFor(c) {
  const where = c.spots ? c.spots.map(i => SPOTS[i].short.toLowerCase()).join(' or ') : 'any puddle';
  const when = c.phases ? c.phases.map(i => PHASES[i].toLowerCase()).join(' or ') : 'any hour';
  const wx = c.weather ? c.weather.map(i => WEATHERS[i].toLowerCase()).join(' or ') : 'any weather';
  return `${where} · ${when} · ${wx}`;
}
