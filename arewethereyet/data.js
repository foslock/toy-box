// Are We There Yet: the family, the tapes, the towns and the things that happen at them.

export const FAMILY = [
  { id: 'dad', name: 'Dad', age: 41, drive: 3, map: 1, fix: 'belt', likes: 'country', hates: 'newwave',
    hunger: 1.0, bladder: 0.8, bore: 0.45, tired: 0.9, speed: 1.06, blurb: 'Drives fast. Can\'t read a map. Swears he can.' },
  { id: 'mom', name: 'Mom', age: 39, drive: 2, map: 3, fix: 'tire', likes: 'softrock', hates: 'country',
    hunger: 0.9, bladder: 0.9, bore: 0.45, tired: 1.0, speed: 1.0, blurb: 'Best navigator in the family. Has changed more tires than Dad.' },
  { id: 'tina', name: 'Tina', age: 16, drive: 1, map: 2, fix: 'battery', likes: 'newwave', hates: 'silly',
    hunger: 0.9, bladder: 0.9, bore: 1.15, tired: 1.35, speed: 0.9, blurb: 'Learner\'s permit. Took shop class. Would rather be anywhere else.' },
  { id: 'kevin', name: 'Kevin', age: 10, drive: 0, map: 1, fix: 'radiator', likes: 'silly', hates: 'softrock',
    hunger: 1.6, bladder: 1.15, bore: 1.3, tired: 1, speed: 1, blurb: 'Always hungry. Gets bored, then pokes whoever\'s next to him.' },
  { id: 'jo', name: 'Jo', age: 5, drive: 0, map: 0, fix: null, likes: 'silly', hates: 'newwave',
    hunger: 0.9, bladder: 2.6, bore: 1.0, tired: 1, speed: 1, blurb: 'Needs the bathroom. Holds the flashlight for whoever\'s fixing.' },
];

// Kevin starts a fight with these two when he's bored and sitting next to them.
export const FIGHTS = [['kevin', 'tina'], ['kevin', 'jo']];

export const TAPES = {
  country: { name: 'Truck Stop Hits', sub: 'COUNTRY', color: '#c8542b', label: '#f2d9a6' },
  softrock: { name: 'Love Songs for the Open Road', sub: 'SOFT ROCK', color: '#6f8fae', label: '#f6e7da' },
  newwave: { name: 'Synth City ’85', sub: 'NEW WAVE', color: '#2c2a3a', label: '#e75d9a' },
  silly: { name: 'Sing-Along Silly Songs', sub: 'KIDS', color: '#e8b52e', label: '#fbf3dc' },
};
export const TAPE_ORDER = ['country', 'softrock', 'newwave', 'silly'];

export const FIX_NAMES = { belt: 'fan belt', tire: 'flat tire', battery: 'battery', radiator: 'radiator', hose: 'hose' };

export const REGIONS = [
  { name: 'THE CENTRAL VALLEY', ground: '#c9b46a', ground2: '#a99a52', edge: '#7f8c4a', props: ['orchard', 'pole', 'billboard', 'fruitstand'] },
  { name: 'HIGH DESERT', ground: '#d9b382', ground2: '#c79a66', edge: '#b3845a', props: ['cactus', 'pole', 'billboard', 'rock'] },
  { name: 'SAWTOOTH RANGE', ground: '#7d8a5c', ground2: '#5f6e48', edge: '#4c5a3c', props: ['pine', 'pine', 'rock', 'pole'] },
  { name: 'THE PLAINS', ground: '#cfb95d', ground2: '#b9a24b', edge: '#93964b', props: ['silo', 'pole', 'billboard', 'cornrow'] },
];
export function regionOf(col) { return col <= 2 ? 0 : col <= 5 ? 1 : col <= 8 ? 2 : 3; }

export const TOWNS = [
  'Coyote Wells', 'Dry Fork', 'Little Elbow', 'Buford Springs', 'Halfway', 'Sweetwater Crossing', 'Possum Trot', 'Big Spur',
  'Plainview', 'Red Mesa', 'Cornelius', 'Bethany Falls', 'Okeewee', 'Tumbleweed', 'New Hebron', 'Lodgepole', 'Gristmill',
  'Pinecrest', 'Saltlick', 'Two Dogs', 'Cactus Flats', 'Vernon', 'Hominy', 'Prosper', 'Cold Creek', 'Albion', 'Sulphur',
  'Fair Haven', 'Jubilee', 'Quarry Hill', 'Mercy', 'Dime Box', 'Lark', 'Wagon Mound', 'Muleshoe Bend', 'Rattle',
];

export const GAS_NAMES = ['Bud\'s Gas & Go', 'Mesa Mart', 'Sunset Fuel', 'Pump N\' Munch', 'Lucky Seven Fuel', 'Hank\'s Full Serve', 'Kwik Kwart'];
export const DINER_NAMES = ['The Spoon', 'Mom & Pop\'s', 'Rosie\'s Pie Palace', 'Wagon Wheel Cafe', 'Starlite Diner', 'The Blue Plate', 'Eat'];
export const MOTELS = [
  { name: 'Starlite Motor Inn', price: 44, mood: 22, note: 'Pool! Color TV! Ice machine!' },
  { name: 'Sleepy Bear Lodge', price: 38, mood: 18, note: 'A bear statue out front. Pancakes at 7.' },
  { name: 'Budget Inn', price: 24, mood: 9, note: 'Clean-ish. The sign says VACANCY with a dead C.' },
  { name: 'Wagon Wheel Motel', price: 28, mood: 12, note: 'Rooms shaped like covered wagons.' },
  { name: 'The Desert Rose', price: 34, mood: 16, note: 'Vibrating beds, 25¢ a go.' },
  { name: 'Pines Motor Court', price: 30, mood: 14, note: 'Cabins. A moose head in the office.' },
];

export const ATTRACTIONS = [
  { key: 'twine', name: 'The World\'s Largest Ball of Twine', price: 4, caption: 'the ball of twine (it is VERY big)' },
  { key: 'dino', name: 'Dinosaur Gardens', price: 6, caption: 'Kevin vs. brontosaurus' },
  { key: 'vortex', name: 'The Mystery Vortex', price: 5, caption: 'Jo is standing UP. we think.' },
  { key: 'cow', name: 'Big Bessie, the 40-ft Cow', price: 2, caption: 'Bessie!! Dad says moo' },
  { key: 'snake', name: 'Reptile Ranch & Gift Shop', price: 5, caption: 'Tina held the snake!!' },
  { key: 'cave', name: 'Crystal Cavern Tours', price: 8, caption: 'the cave (too dark, sorry)' },
  { key: 'prairie', name: 'Prairie Dog Town', price: 3, caption: '5000 prairie dogs. we saw 2' },
  { key: 'teapot', name: 'The Giant Teapot', price: 1, caption: 'Mom inside the teapot' },
];

// ---------------------------------------------------------------- events
// Each event: id, where it can happen (types), when(s) to gate it, text, choices.
// A choice: label, sub (cost hint), need(s) → true/false reason string, go(s, h) → outcome text.
// h is the helper API from game.js (cash, morale, clock, car, snacks, gas, polaroid, chance, person, seatOf...).

export const EVENTS = [
  {
    id: 'hitchhiker', types: ['event', 'gas'],
    text: 'A hitchhiker with a guitar and a sign that says GRANDMA\'S (?) is standing by the pumps.',
    choices: [
      { label: 'Give him a ride', sub: 'he looks harmless', go: (s, h) => h.chance(0.7)
        ? (h.morale(14), h.polaroid('guitar', 'Rusty played us 11 songs'), 'His name is Rusty. He knows every song on every tape. Everyone sings. He gets out two towns later and leaves you a pick.')
        : (h.snacks(-4), h.morale(-4), 'He eats four snacks, falls asleep on Tina, and gets out without a word.') },
      { label: 'Wave and drive on', go: (s, h) => (h.morale(-2), 'Kevin presses his face to the window until he\'s out of sight.') },
    ],
  },
  {
    id: 'lostkid', types: ['gas', 'diner', 'attraction'], when: s => h0(s, 'kevin'),
    text: 'Back in the car, you count heads. Four. Kevin is not in the car.',
    choices: [
      { label: 'Search the gift shop', sub: '+1 hour', go: (s, h) => (h.clock(1), h.morale(-3), 'He\'s in the gift shop, wearing a coonskin cap he did not pay for. Dad pays for it.') },
      { label: 'Honk the horn. Loudly.', go: (s, h) => h.chance(0.6)
        ? (h.morale(2), 'He sprints out of the restroom with his pants half up. Tina will never let this go.')
        : (h.clock(1.5), h.morale(-8), 'Nothing. Forty minutes later a trucker walks him over from the arcade.') },
    ],
  },
  {
    id: 'yardsale', types: ['event'],
    text: 'A yard sale on a farm road. A card table of cassettes, a cooler, a box of comic books.',
    choices: [
      { label: 'Buy the box of comics', sub: '$3', need: s => s.cash >= 3 || 'not enough cash', go: (s, h) => (h.cash(-3), h.bore('kevin', -1), h.bore('tina', -0.6), h.flag('comics'), 'Kevin reads them all twice. The back seat goes quiet for a whole state. (Kids get bored a little slower.)') },
      { label: 'Haggle for the cooler', sub: '$5', need: s => s.cash >= 5 || 'not enough cash', go: (s, h) => (h.cash(-5), h.snacks(6), 'It comes with six root beers still in it. "Those were for my nephew," she says, and lets you keep them.') },
      { label: 'Just look', go: (s, h) => (h.clock(0.5), 'Mom finds a lamp shaped like a duck and somehow does not buy it.') },
    ],
  },
  {
    id: 'speedtrap', types: ['event', 'gas', 'diner'], when: s => s.lastRoad === 'interstate' && driver(s) === 'dad',
    text: 'Lights in the mirror. A state trooper, hat and all. "Do you know how fast you were going, sir?"',
    choices: [
      { label: 'Pay the ticket', sub: '$35', need: s => s.cash >= 35 || 'not enough cash', go: (s, h) => (h.cash(-35), h.morale(-5), 'Dad drives exactly 55 for the next hour, muttering.') },
      { label: 'Let Mom do the talking', need: s => seatOf(s, 'mom') === 'shot' || 'Mom has to be in the front seat', go: (s, h) => h.chance(0.65)
        ? (h.morale(4), 'She asks about his kids. He has three. You leave with a warning and directions to a good diner.')
        : (h.cash(-35), h.morale(-6), '"Ma\'am, I\'m going to need you to let him answer." $35.') },
      { label: 'Jo starts crying', need: s => s.people.jo.seat !== null || 'Jo is not here', go: (s, h) => h.chance(0.5)
        ? (h.morale(2), 'Real tears. The trooper gives Jo a sticker badge and lets you go.')
        : (h.cash(-35), h.morale(-4), 'He has seen this before. $35. Jo keeps crying for a while, for real now.') },
    ],
  },
  {
    id: 'shortcut', types: ['gas', 'diner', 'event'],
    text: 'An old farmer leaning on the pump says there\'s a dirt road that cuts an hour off the next stretch. "If you don\'t mind a bump or two."',
    choices: [
      { label: 'Take the dirt road', sub: 'next leg shorter, rough', go: (s, h) => (h.flag('shortcut'), 'He draws it on a napkin. Mom traces it onto the atlas in pencil.') },
      { label: 'Stick to the map', go: (s, h) => 'He shrugs. "Suit yourself."' },
    ],
  },
  {
    id: 'storm', types: ['event', 'gas'],
    text: 'The sky to the east goes the color of a bruise. The radio says hail.',
    choices: [
      { label: 'Wait it out under the canopy', sub: '+2 hours', go: (s, h) => (h.clock(2), h.boreAll(0.3), 'Two hours of Go Fish. Tina wins every hand and nobody knows how.') },
      { label: 'Drive through it', sub: 'car takes a beating', go: (s, h) => (h.car(-14), h.morale(-4), 'Hail like gravel on the roof. Jo hides under a blanket. The hood has dimples now.') },
    ],
  },
  {
    id: 'pie', types: ['diner'],
    text: 'There\'s a sign on the counter: PIE EATING CONTEST, 2 PM. WINNER EATS FREE. It is 1:55.',
    choices: [
      { label: 'Kevin enters', need: s => s.people.kevin.seat !== null || 'Kevin is not here', go: (s, h) => h.chance(0.55)
        ? (h.morale(14), h.cash(10), h.polaroid('pie', 'KEVIN WON!!! (cherry)'), 'Kevin wins by a crust. Lunch is free and he gets a ribbon. He is sick at the next stop but it was worth it.')
        : (h.morale(4), h.hunger('kevin', -1), 'He comes second to a man named Tiny. He is very full and very proud.') },
      { label: 'Dad enters', go: (s, h) => h.chance(0.35)
        ? (h.morale(16), h.cash(10), h.polaroid('pie', 'DAD. pie champion 1986'), 'Dad wins. Nobody, including Dad, expected this.')
        : (h.morale(6), h.tired(0.3), 'Dad does not win. Dad needs to lie down. (Dad is sleepy.)') },
      { label: 'Just watch', go: (s, h) => (h.morale(3), 'A man named Tiny eats nine pies. Everyone claps.') },
    ],
  },
  {
    id: 'wheel', types: ['gas'],
    text: 'A prize wheel by the register. SPIN FOR $1! Kevin is already holding out his hand.',
    choices: [
      { label: 'Spin it', sub: '$1', need: s => s.cash >= 1 || 'not enough cash', go: (s, h) => {
        h.cash(-1); const r = h.roll();
        if (r < 0.3) return (h.snacks(6), 'Six candy bars! Kevin does a lap of the store.');
        if (r < 0.5) return (h.cash(20), 'Twenty dollars! Mom pockets it before anyone can argue.');
        if (r < 0.7) return (h.morale(6), 'A rubber snake. It is the best thing that has ever happened to Kevin.');
        return (h.morale(-1), 'TRY AGAIN. Kevin wants to try again. You do not try again.');
      } },
      { label: 'No', go: (s, h) => (h.morale(-1), 'Kevin sulks back to the car.') },
    ],
  },
  {
    id: 'hubcap', types: ['event'],
    text: 'CLANG. In the mirror, a hubcap rolls into a ditch and keeps going.',
    choices: [
      { label: 'Go back for it', sub: '+1 hour', go: (s, h) => (h.clock(1), h.car(4), 'It\'s in a cow field. The cow does not want to give it back. Eventually it does.') },
      { label: 'Leave it', go: (s, h) => (h.morale(-2), '"That was a good hubcap," says Dad, quietly, for the next 50 miles.') },
    ],
  },
  {
    id: 'cousin', types: ['event'],
    text: 'Mom realizes Cousin Ray lives two exits from here. "We could stop in. Just for lunch."',
    choices: [
      { label: 'Visit Cousin Ray', sub: '+2 hours', go: (s, h) => (h.clock(2), h.hungerAll(-1), h.morale(h.chance(0.6) ? 12 : -6), h.polaroid('ray', 'Cousin Ray’s above-ground pool'), 'Ray has a pool, a parrot and opinions about the Dodgers. You leave with a casserole and a sunburn.') },
      { label: 'Keep driving', go: (s, h) => (h.morale(-2), 'Mom says she\'ll call him. She will not call him.') },
    ],
  },
  {
    id: 'mechanic', types: ['gas'], when: s => s.car < 70,
    text: 'The mechanic wipes his hands and listens to the engine. "Hear that tick? That\'s gonna be a problem in about two hundred miles."',
    choices: [
      { label: 'Let him fix it', sub: '$40', need: s => s.cash >= 40 || 'not enough cash', go: (s, h) => (h.cash(-40), h.car(40), h.clock(1), 'An hour and a new gasket later, the tick is gone.') },
      { label: 'Turn up the radio', go: (s, h) => (h.morale(1), 'Problem solved, says Dad.') },
    ],
  },
  {
    id: 'fortune', types: ['diner', 'attraction'],
    text: 'A fortune-telling machine in the lobby: a plaster swami in a glass box. 25¢.',
    choices: [
      { label: 'Jo picks the coin slot', sub: '25¢', need: s => s.cash >= 1 || 'not enough cash', go: (s, h) => (h.cash(-1), h.morale(6), h.polaroid('fortune', '"A LONG JOURNEY LIES AHEAD" no kidding'), 'The card says: A LONG JOURNEY LIES AHEAD. Dad laughs so hard he has to sit down.') },
      { label: 'Walk past', go: (s, h) => 'The plaster eyes follow Kevin all the way to the door.' },
    ],
  },
  {
    id: 'tinaboy', types: ['diner', 'gas'], when: s => s.people.tina.seat !== null,
    text: 'Tina is talking to a boy by the arcade machine. He has a mullet and a Walkman. She wants to "stay ten more minutes".',
    choices: [
      { label: 'Ten more minutes', sub: '+1 hour', go: (s, h) => (h.clock(1), h.bore('tina', -1), h.flag('walkman'), 'It is an hour. He gives her a mixtape. (Tina stays happy on the road a while longer.)') },
      { label: 'Back in the car, now', go: (s, h) => (h.bore('tina', 0.5), h.morale(-4), 'She does not speak to anyone for 80 miles. It is somehow louder than talking.') },
    ],
  },
  {
    id: 'flatbird', types: ['event'],
    text: 'A road sign: LAST GAS 90 MILES. Below it, someone has added in paint: NO REALLY.',
    choices: [
      { label: 'Buy a gas can off a rancher', sub: '$8', need: s => s.cash >= 8 || 'not enough cash', go: (s, h) => (h.cash(-8), h.gas(0.3), 'He siphons it out of a tractor while you watch. It smells like hay.') },
      { label: 'We\'ll be fine', go: (s, h) => 'Famous last words, says Mom.' },
    ],
  },
  {
    id: 'singalong', types: ['event', 'diner'],
    text: 'At a red light that lasts forever, Jo starts singing The Song. You know the one. All the verses.',
    choices: [
      { label: 'Everybody joins in', go: (s, h) => (h.morale(s.tapeId === 'silly' ? 14 : 8), h.boreAll(-0.6), 'All five of you, windows down, at full volume. A man at the bus stop applauds.') },
      { label: 'Put a tape on instead', go: (s, h) => (h.bore('jo', 0.4), 'Jo sings over the tape. Louder.') },
    ],
  },
  {
    id: 'carsick', types: ['event', 'diner'],
    text: 'Kevin goes very quiet and very green. "I don\'t feel so good."',
    choices: [
      { label: 'Pull over NOW', sub: '+½ hour', go: (s, h) => (h.clock(0.5), h.morale(-2), 'Just in time. Mostly in time.') },
      { label: 'Roll the window down', go: (s, h) => h.chance(0.5)
        ? (h.morale(-1), 'The breeze works. Crisis averted.')
        : (h.morale(-12), h.car(-3), 'The breeze does not work. Nobody talks about the next twenty minutes.') },
    ],
  },
];

function h0(s, id) { return s.people[id].seat !== null; }
function seatOf(s, id) { return s.people[id].seat; }
function driver(s) { for (const id in s.people) if (s.people[id].seat === 'drive') return id; return null; }

export const BILLBOARDS = [
  'SEE THE MYSTERY VORTEX! 212 MI', 'PECAN LOGS • FIREWORKS • NEXT EXIT', 'MOTEL • COLOR TV • POOL', 'WORLD FAMOUS JERKY',
  'GIANT COW AHEAD!!', 'EAT', 'FREE ICE WATER', 'REPTILES! LIVE! 40 MI', 'BUD’S GAS • CLEAN RESTROOMS', 'HOME OF THE 2 LB BURGER',
  'YOU ARE NOW 1/2 WAY', 'PIE PIE PIE PIE', 'FIREWORKS • CIGARETTES • BAIT', 'GRANDMA’S MAKES IT 80!',
];
