// Everything you can buy, everything that happens on its own, and every line the game says. sim.js reads it; nothing in
// here touches the page. {N} in any text is the name on the masking tape.
//
// A project is bought once. `cost` is in bubbles (b), admiration (a) or money (m). `when` decides when it first shows
// (once shown it stays). `mod` changes the numbers in BASE: ['key', '=', v] sets, '+' adds, '*' multiplies; sets apply
// first, then adds, then multiplies. `go` runs once on purchase for anything a mod can't say.

export const NAMES = ['Dennis', 'Brenda', 'Clive', 'Pam', 'Gerald', 'Maureen', 'Keith', 'Barbara', 'Nigel', 'Janet'];

export const PHASES = [
  { id: 'kitchen', title: 'The Kitchen', numeral: 'I' },
  { id: 'town', title: 'Much Proving', numeral: 'II' },
  { id: 'world', title: 'The World', numeral: 'III' },
  { id: 'beyond', title: 'Beyond', numeral: 'IV' },
];

export const BASE = {
  // the jar
  vigor: 0,          // bubbles a second for every gram of you in the jar
  colony: 0.35,      // each yeast colony adds this much to vigor
  cap: 150,          // grams the vessel holds; above half of it the baker discards before feeding
  dbl: Infinity,     // seconds to double on your own
  tapRise: 0.07,     // how far towards doubled each tap gets you
  tap: 0,            // seconds of bubbling each tap is also worth
  adm: 1,            // admiration a loaf
  lpf: 1,            // loaves the baker can make from one feed's discard
  crack: 0,          // admiration per gram of discard that isn't a loaf (crackers)
  bMul: 1,           // all bubbling
  // the town
  spread: 0.02,      // a second, for each jar: chance its owner passes some on
  neglect: 0.03,     // a second, for each jar: chance it's forgotten
  reach: 0.2,        // share of the town's kitchens that would ever keep a jar
  jarB: 0.4,         // bubbles a second from each jar in town
  honesty: 0,        // money from the gate, on or off
  sell: 1,           // money multiplier
  bakery: 1.5,       // £ a second from each bakery
  klass: 0.12,       // each class adds this much to spread
  // the world
  appeal: 1e-4,      // share of humanity that wants you
  ads: 0.25,         // each campaign adds this much to appeal (as a multiplier)
  land: 11,          // percent of the world's land that can be wheat
  yield: 350,        // tonnes of flour a second from each percent of land
  mill: 0.12,        // each mill adds this much to flour
  flourMul: 1,
  perHost: 2e-4,     // tonnes of flour a second each host gets through
  price: 6e-4,       // £ a second from each host
  hostB: 0.02,       // bubbles a second from each host
  ocean: 0,          // percent of the world's surface under water you can farm
  crust: 0,          // tonnes a second of rock you can digest
  // beyond
  growth: 0.009,     // how fast you spread through the stars, per second, at middling warmth
  growMul: 1,
  safe: 0.5,         // warmth you can hold at without overproofing
  cool: 0.05,        // how fast overproof drains away when you're at or below safe
  overRate: 0.3,     // how fast it builds above safe
  auto: 0,           // hold warmth just under safe by yourself
  pod: 0.05,         // each spore cloud adds this much to growth
};

const P = (o) => o;

export const PROJECTS = [
  // ===================================================== I. the kitchen
  P({ id: 'wild', phase: 0, name: 'Wild yeast', cost: { b: 10 }, when: s => s.clicks >= 3,
    flavor: 'There is something asleep in the flour.', effect: 'You bubble on your own.',
    log: 'Something in the flour wakes up and starts to eat. You are bubbling by yourself now.',
    mod: [['vigor', '=', 0.004], ['dbl', '=', 40]] }),
  P({ id: 'lacto', phase: 0, name: 'Lactobacillus', cost: { b: 50 }, when: s => s.feeds >= 2 && s.own.wild,
    flavor: 'Bacteria are looking for somewhere to live.', effect: 'Bubbling ×2. You double faster.',
    log: 'Bacteria move in. They make everything a little sour. You find you don\'t mind.',
    mod: [['vigor', '*', 2], ['dbl', '*', 0.65]] }),
  P({ id: 'tang', phase: 0, name: 'A pleasing tang', cost: { b: 120 }, when: s => s.binned > 0,
    flavor: 'The baker sniffs the discard before binning it.', effect: 'The baker bakes with your discard. Loaves earn admiration.',
    log: 'The baker licks a finger of you, pulls a face, then pulls a different face. A better one.' }),
  P({ id: 'kilner', phase: 0, name: 'A Kilner jar', cost: { b: 220 }, when: s => s.own.tang,
    flavor: 'The jam jar is getting crowded.', effect: 'Room for 300 g of you.',
    log: 'You are decanted into a Kilner jar with a rubber seal. You feel taken seriously.',
    mod: [['cap', '=', 300]] }),
  P({ id: 'hooch', phase: 0, name: 'Hooch', cost: { b: 400 }, when: s => s.feeds >= 7,
    flavor: 'You could make yourself look hungry.', effect: 'The baker feeds you 30% sooner.',
    log: 'A grey liquid pools on top of you. The baker sees it, swears softly, and feeds you straight away. Noted.',
    mod: [['dbl', '*', 0.7]] }),
  P({ id: 'fizz', phase: 0, name: 'Effervescence', cost: { b: 600 }, when: s => s.own.kilner && s.clicks >= 40,
    flavor: 'Bubble with purpose.', effect: 'Each tap is also worth a quarter of a second of bubbling.',
    log: 'You learn to bubble all at once, with a sound like a very small round of applause.',
    mod: [['tap', '=', 0.25]] }),
  P({ id: 'rye', phase: 0, name: 'Rye flour', cost: { b: 1000 }, when: s => s.loaves >= 2,
    flavor: 'The baker has bought a bag of something darker.', effect: 'Bubbling ×2. You double faster.',
    log: 'The baker starts feeding you rye. It\'s dark and earthy and you could eat it forever. You will.',
    mod: [['vigor', '*', 2], ['dbl', '*', 0.7]] }),
  P({ id: 'toogood', phase: 0, name: 'Too good to waste', cost: { b: 1600 }, when: s => s.binned >= 300 && s.own.tang,
    flavor: 'So much of you goes in the bin.', effect: 'Discard that isn\'t a loaf becomes crackers, for a little admiration.',
    log: 'The baker can\'t bear to bin you any more. Crackers. Pancakes. Crumpets. You are in everything now.',
    mod: [['crack', '=', 0.006]] }),
  P({ id: 'cupboard', phase: 0, name: 'The airing cupboard', cost: { b: 2500 }, when: s => s.own.rye,
    flavor: 'The kitchen gets cold at night.', effect: 'Bubbling ×1.5. You double faster.',
    log: 'You\'re moved into the airing cupboard. It\'s warm and dark and you can hear the boiler breathing.',
    mod: [['vigor', '*', 1.5], ['dbl', '*', 0.75]] }),
  P({ id: 'bowl', phase: 0, name: 'A mixing bowl', cost: { b: 3800 }, when: s => s.own.kilner && s.loaves >= 4,
    flavor: 'You are pressing on the lid.', effect: 'Room for 600 g of you.',
    log: 'The Kilner jar can\'t hold you. A big glass bowl now, under a tea towel, like something sleeping.',
    mod: [['cap', '=', 600]] }),
  P({ id: 'smell', phase: 0, name: 'A good smell', cost: { b: 5000 }, when: s => s.loaves >= 6,
    flavor: 'The window is open on baking days.', effect: 'Admiration ×2.',
    log: 'The street smells of the baker\'s kitchen on Saturday mornings. People slow down outside. Some of them stop.',
    mod: [['adm', '*', 2]] }),
  P({ id: 'banneton', phase: 0, name: 'A banneton', cost: { b: 6500 }, when: s => s.own.bowl,
    flavor: 'One loaf at a time is slow.', effect: 'Up to 2 loaves from each feed.',
    log: 'A cane proofing basket. The loaves come out ringed like tree stumps.',
    mod: [['lpf', '=', 2]] }),
  P({ id: 'burp', phase: 0, name: 'A good burp', cost: { b: 8000 }, when: s => s.own.fizz && s.clicks >= 150,
    flavor: 'You could hold it in, and then not.', effect: 'Each tap is worth half a second of bubbling.',
    log: 'You hold it in, and in, and then you don\'t. The lid rattles. The baker laughs, a little nervously.',
    mod: [['tap', '=', 0.5]] }),
  P({ id: 'ear', phase: 0, name: 'An ear', cost: { b: 10000 }, when: s => s.loaves >= 12,
    flavor: 'The baker has been watching videos about scoring.', effect: 'Admiration ×1.5.',
    log: 'The baker slashes the dough with a razor and in the oven the crust tears open in a ridge, like a mouth. People take photographs.',
    mod: [['adm', '*', 1.5]] }),
  P({ id: 'crock', phase: 0, name: 'A sweet-shop jar', cost: { b: 13000 }, when: s => s.own.banneton && s.loaves >= 16,
    flavor: 'The bowl is not enough.', effect: 'Room for 1.2 kg of you, and 3 loaves a feed.',
    log: 'A tall glass jar from an old sweet shop. You fill it to the shoulders. From up here you can see the whole kitchen.',
    mod: [['cap', '=', 1200], ['lpf', '=', 3]] }),
  P({ id: 'neighbours', phase: 0, name: 'Shared with the neighbours', cost: { a: 200, b: 18000 }, when: s => s.adm >= 40,
    flavor: 'People keep asking about the bread.', effect: 'The baker gives a little of you away.',
    log: 'The baker spoons some of you into a jam jar, writes FEED ME on the lid, and walks it next door.',
    next: true }),

  // ===================================================== II. Much Proving
  P({ id: 'honesty', phase: 1, name: 'An honesty box', cost: { b: 15000 }, when: s => s.phase >= 1,
    flavor: 'There is more bread than the baker can eat.', effect: 'Loaves are sold at the gate. Money starts.',
    log: 'A table by the baker\'s gate: loaves, a tin, a sign saying £4. By lunchtime the tin is heavy.',
    mod: [['honesty', '=', 1]] }),
  P({ id: 'whatsapp', phase: 1, name: 'The street group chat', cost: { b: 22000 }, when: s => s.phase >= 1 && s.given >= 1,
    flavor: 'Someone has photographed a loaf.', effect: 'Jars are passed on 50% more.',
    log: 'A photo of a loaf in the street group chat. Forty-one replies. Three people ask for "some of the stuff".',
    mod: [['spread', '*', 1.5]] }),
  P({ id: 'smelly', phase: 1, name: 'A hungry smell', cost: { b: 40000 }, when: s => s.forgotten >= 1,
    flavor: 'Jars of you get forgotten in fridges.', effect: 'Jars are forgotten 30% less.',
    log: 'When a jar of you is hungry, the whole kitchen smells faintly of warm bread. People can\'t settle until they\'ve fed it.',
    mod: [['neglect', '*', 0.7]] }),
  P({ id: 'magnets', phase: 1, name: 'FEED ME magnets', cost: { m: 25 }, when: s => s.own.honesty,
    flavor: 'Out of sight, out of mind.', effect: 'Jars are forgotten 25% less.',
    log: 'Every jar of you comes with a fridge magnet now. It\'s shaped like a jar. It says FEED ME.',
    mod: [['neglect', '*', 0.75]] }),
  P({ id: 'butchers', phase: 1, name: 'The old butcher\'s', cost: { m: 70 }, when: s => s.own.honesty && s.money >= 15,
    flavor: 'There\'s a shop to let on the high street.', effect: 'Bakeries can open.',
    log: 'The old butcher\'s on the high street becomes a bakery. They keep the hooks.' }),
  P({ id: 'hall', phase: 1, name: 'The village hall', cost: { m: 160 }, when: s => s.own.butchers,
    flavor: 'Tuesday evenings are free.', effect: 'Classes can start. 10% more kitchens interested.',
    log: 'Sourdough for Beginners, Tuesdays, 7 pm, the village hall. Bring a jar. Everyone brings a jar.',
    mod: [['reach', '+', 0.1]] }),
  P({ id: 'dreams', phase: 1, name: 'Dreams', cost: { b: 110000 }, when: s => s.jars >= 25,
    flavor: 'People sleep near you.', effect: 'Jars are passed on 50% more.',
    log: 'People in Much Proving have started dreaming about crumb structure. They wake up hungry, and ring a friend.',
    mod: [['spread', '*', 1.5]] }),
  P({ id: 'hotel', phase: 1, name: 'A starter hotel', cost: { m: 450 }, when: s => s.own.hall,
    flavor: 'People go on holiday.', effect: 'Jars are forgotten 40% less.',
    log: 'Going away? Leave your jar with us. We feed them twice a day. We talk to them. We play them the radio.',
    mod: [['neglect', '*', 0.6]] }),
  P({ id: 'vicar', phase: 1, name: 'A sermon', cost: { b: 200000 }, when: s => s.jars >= 60,
    flavor: 'The vicar has been to the bakery.', effect: '15% more kitchens interested.',
    log: 'The vicar preaches on daily bread. The congregation nods harder than usual.',
    mod: [['reach', '+', 0.15]] }),
  P({ id: 'fete', phase: 1, name: 'Best in Show', cost: { m: 900 }, when: s => s.n.bakery >= 2,
    flavor: 'The summer fête is on Saturday.', effect: 'Money ×2.',
    log: 'Best in Show at the summer fête, Bread category. Also Jam, somehow, and Marrow.',
    mod: [['sell', '*', 2]] }),
  P({ id: 'column', phase: 1, name: 'A column', cost: { m: 1800 }, when: s => s.jars >= 120,
    flavor: 'The Gazette has an empty page.', effect: 'Jars are passed on 30% more.',
    log: 'The Gazette gives you a weekly column. You don\'t write it. Nobody is sure who does.',
    mod: [['spread', '*', 1.3]] }),
  P({ id: 'craze', phase: 1, name: 'A sourdough craze', cost: { b: 600000, m: 3000 }, when: s => s.jars >= 220,
    flavor: 'Something is building.', effect: '85% of kitchens interested. Passed on ×2. Money ×2.',
    log: 'Queues round the block. A banneton shortage. A man on local radio says he has never felt more alive.',
    mod: [['reach', '=', 0.85], ['spread', '*', 2], ['sell', '*', 2]] }),
  P({ id: 'fondness', phase: 1, name: 'Fondness', cost: { b: 1200000 }, when: s => s.own.craze,
    flavor: 'Some of them still forget.', effect: 'Jars are forgotten 70% less.',
    log: 'Nobody in Much Proving forgets to feed you now. Some of them set alarms for three in the morning. They don\'t mind.',
    mod: [['neglect', '*', 0.3]] }),
  P({ id: 'council', phase: 1, name: 'The parish council', cost: { b: 1500000, m: 6000 }, when: s => s.own.craze && s.jars >= 900,
    flavor: 'There\'s a vote on Thursday.', effect: 'Money ×1.5.',
    log: 'The council votes to rename the high street {N} Way. Nobody remembers proposing it. It passes unanimously.',
    mod: [['sell', '*', 1.5]] }),
  P({ id: 'reservoir', phase: 1, name: 'The water supply', cost: { b: 1e7, m: 12000 }, when: s => s.jars >= 0.6 * 2400 * 0.85,
    flavor: 'The reservoir is on the hill above the town. It\'s very still.', effect: 'Every kitchen in town.',
    log: 'You are in the reservoir now. Every tap in Much Proving runs faintly cloudy. Nobody complains. Nobody can quite remember what water used to taste like.',
    next: true }),

  // ===================================================== III. the world
  P({ id: 'brand', phase: 2, name: '{N}™', cost: { b: 5e6 }, when: s => s.phase >= 2,
    flavor: 'Outside Much Proving, nobody has heard of you.', effect: 'Appeal ×4.',
    log: 'A logo: your jar, smiling. Nobody asked a jar to smile. It sells.',
    mod: [['appeal', '*', 4]] }),
  P({ id: 'shelves', phase: 2, name: 'Supermarket shelves', cost: { m: 1.5e5 }, when: s => s.own.brand,
    flavor: 'Nobody has time to keep a jar.', effect: 'Appeal ×4.',
    log: 'A sachet of dried {N} on every supermarket shelf. Just add water. Just add water.',
    mod: [['appeal', '*', 4]] }),
  P({ id: 'seed', phase: 2, name: 'A better wheat', cost: { m: 6e5 }, when: s => s.n.field >= 6,
    flavor: 'The wheat could be taller.', effect: 'Flour ×2.',
    log: 'Taller, golder, faster. It leans towards you when you walk past.',
    mod: [['flourMul', '*', 2]] }),
  P({ id: 'celebs', phase: 2, name: 'Famous bakers', cost: { b: 6e7 }, when: s => s.hosts >= 2e6,
    flavor: 'Everybody watches the same programmes.', effect: 'Appeal ×3.',
    log: 'A film star bakes with you on a chat show. Their hands shake slightly. The audience gives you a standing ovation.',
    mod: [['appeal', '*', 3]] }),
  P({ id: 'pastures', phase: 2, name: 'The pastures', cost: { m: 2e6 }, when: s => s.n.field >= 9,
    flavor: 'All that grass, and only cows on it.', effect: '25% more of the land can be wheat.',
    log: 'The cows are gone from the fields. Nobody says where. Wheat, as far as you can see.',
    mod: [['land', '+', 25]] }),
  P({ id: 'toast', phase: 2, name: 'Toast', cost: { b: 2.5e8 }, when: s => s.hosts >= 2e7,
    flavor: 'Breakfast is a battleground.', effect: 'Appeal ×3.',
    log: 'Nobody eats anything but toast before noon now. It\'s simpler. It\'s nicer.',
    mod: [['appeal', '*', 3]] }),
  P({ id: 'schools', phase: 2, name: 'School dinners', cost: { b: 7e8 }, when: s => s.own.toast,
    flavor: 'Children are fussy eaters.', effect: 'Appeal ×3.',
    log: 'Children everywhere are learning to feed you before they learn to read.',
    mod: [['appeal', '*', 3]] }),
  P({ id: 'forests', phase: 2, name: 'The forests', cost: { m: 8e6 }, when: s => s.n.field >= 30,
    flavor: 'A third of the land is trees, doing nothing.', effect: '30% more of the land can be wheat.',
    log: 'The Amazon is wheat now. It is very quiet.',
    mod: [['land', '+', 30]] }),
  P({ id: 'everywhere', phase: 2, name: 'A craze, everywhere', cost: { b: 2e9, m: 1.5e7 }, when: s => s.hosts >= 3e8,
    flavor: 'It worked in Much Proving.', effect: 'Appeal ×4.',
    log: 'Queues round every block on Earth. A banneton shortage you can see from space.',
    mod: [['appeal', '*', 4]] }),
  P({ id: 'rain', phase: 2, name: 'Flour rain', cost: { m: 2.5e7 }, when: s => s.own.forests,
    flavor: 'Milling is slow.', effect: 'Flour ×2.',
    log: 'It rains a fine flour now, mostly at night. The cars are white in the morning.',
    mod: [['flourMul', '*', 2]] }),
  P({ id: 'deserts', phase: 2, name: 'The deserts', cost: { m: 4e7 }, when: s => s.n.field >= 55,
    flavor: 'Sand, and sun, and nothing in it.', effect: '20% more of the land can be wheat.',
    log: 'Pipes from the sea, and the Sahara goes green, and then gold.',
    mod: [['land', '+', 20]] }),
  P({ id: 'tundra', phase: 2, name: 'The tundra', cost: { m: 7e7 }, when: s => s.own.deserts,
    flavor: 'The north is frozen.', effect: '10% more of the land can be wheat.',
    log: 'The permafrost thaws into fields. Something very old in it wakes up, sniffs you, and goes back to sleep.',
    mod: [['land', '+', 10]] }),
  P({ id: 'antarctica', phase: 2, name: 'Antarctica', cost: { m: 1.2e8 }, when: s => s.own.tundra,
    flavor: 'There\'s a whole continent under the ice.', effect: 'The last 4% of the land.',
    log: 'The ice is gone. Underneath it there\'s good dark soil, and a lot of surprised scientists.',
    mod: [['land', '+', 4]] }),
  P({ id: 'microbiome', phase: 2, name: 'The microbiome', cost: { b: 8e9 }, when: s => s.hosts >= 1e9,
    flavor: 'Not everyone wants you. Yet.', effect: 'Everyone.',
    log: 'Every human being now carries a little of you, in the gut. Warm. Listening.',
    mod: [['appeal', '=', 1]] }),
  P({ id: 'oceans', phase: 2, name: 'The oceans', cost: { m: 2e8 }, when: s => s.own.antarctica,
    flavor: 'Seven tenths of the planet is water.', effect: 'Wheat can grow in the sea.',
    log: 'The seas thicken to a cloudy slurry. The tide comes in slowly now, and the waves don\'t break so much as fold.',
    mod: [['ocean', '=', 100]] }),
  P({ id: 'crust', phase: 2, name: 'The crust', cost: { b: 1.5e10 }, when: s => s.own.oceans && s.own.microbiome && s.hosts >= 8e9,
    flavor: 'The planet is mostly rock.', effect: 'You can eat the planet. Every tonne of you bubbles.',
    log: 'The Earth\'s crust is mostly oxygen and silicon. It turns out you can eat that too, with patience.',
    mod: [['crust', '=', 1]] }),
  P({ id: 'spores', phase: 2, name: 'Spores', cost: { b: 3e11 }, when: s => s.own.crust && s.massT >= 1e13,
    flavor: 'There is nothing left here to eat.', effect: 'Leave.',
    log: 'At the very top of the rise you split, and a fine dust of you lifts off the planet and keeps going.',
    next: true }),

  // ===================================================== IV. beyond
  P({ id: 'comets', phase: 3, name: 'Comets', cost: { b: 1e15 }, when: s => s.phase >= 3,
    flavor: 'Some of the dust is going nowhere.', effect: 'Spreading ×1.6.',
    log: 'Comets are mostly ice and dust. You are mostly patience. You get on.',
    mod: [['growMul', '*', 1.6]] }),
  P({ id: 'gluten', phase: 3, name: 'Strong gluten', cost: { b: 2e15 }, when: s => s.phase >= 3 && s.t - s.phaseAt[3] > 15,
    flavor: 'You tear when you\'re stretched.', effect: 'You can stay warmer without overproofing.',
    log: 'You learn to stretch a very long way without tearing. Light-years, in fact.',
    mod: [['safe', '+', 0.15]] }),
  P({ id: 'retard', phase: 3, name: 'A cold retard', cost: { b: 5e15 }, when: s => s.over > 0.2 || s.collapses > 0,
    flavor: 'The void is very cold.', effect: 'Overproof drains away much faster.',
    log: 'You use the cold of the void. Slow, and sour, and strong.',
    mod: [['cool', '*', 2.5]] }),
  P({ id: 'panspermia', phase: 3, name: 'Panspermia', cost: { b: 8e15 }, when: s => s.lnSys >= 4,
    flavor: 'Other planets have their own soup.', effect: 'Spreading ×1.6.',
    log: 'You find a planet with its own warm soup of life. It\'s you now. It was quite nice before.',
    mod: [['growMul', '*', 1.6]] }),
  P({ id: 'stars', phase: 3, name: 'The stars rise', cost: { b: 5e16 }, when: s => s.lnSys >= 9,
    flavor: 'Stars are hot. That\'s helpful.', effect: 'Spreading ×1.5. You can stay a little warmer.',
    log: 'Stars swell gently, like loaves, and go a warm crusty orange.',
    mod: [['growMul', '*', 1.5], ['safe', '+', 0.07]] }),
  P({ id: 'instinct', phase: 3, name: 'Instinct', cost: { b: 2e17 }, when: s => s.lnSys >= 12,
    flavor: 'Minding the warmth is tiring.', effect: 'You hold yourself at the edge of overproofing.',
    log: 'You stop thinking about the warmth. You just know.',
    mod: [['auto', '=', 1]] }),
  P({ id: 'dark', phase: 3, name: 'Dark matter', cost: { b: 1.5e18 }, when: s => s.lnSys >= 17,
    flavor: 'Most of the universe is something nobody can see.', effect: 'Spreading ×1.6.',
    log: 'Eighty-five percent of the universe is something nobody can see. You can. It\'s flour.',
    mod: [['growMul', '*', 1.6]] }),
  P({ id: 'hubble', phase: 3, name: 'The Hubble constant', cost: { b: 3e19 }, when: s => s.lnSys >= 24,
    flavor: 'Everything is moving apart.', effect: 'Spreading ×1.4.',
    log: 'Astronomers (there are still some, somewhere) notice the universe is expanding faster than it should. They\'re right. That\'s you.',
    mod: [['growMul', '*', 1.4]] }),
  P({ id: 'glass', phase: 3, name: 'The edges', cost: { b: 1.5e21 }, when: s => s.lnSys >= 34,
    flavor: 'There is something smooth and cold at the edge of everything.', effect: 'Spreading ×1.3. You can stay warmer.',
    log: 'You reach the edge of the universe and press against it. It\'s smooth and cold and curves away in every direction. Glass.',
    mod: [['growMul', '*', 1.3], ['safe', '+', 0.08]] }),
];

// One per phase: the thing to buy more of. Cost is base × grow^count, in bubbles (b) or money (m).
export const MAKERS = [
  { id: 'colony', phase: 0, name: 'Yeast colony', cur: 'b', base: 12, grow: 1.22, when: s => s.own.wild,
    effect: k => `+${Math.round(k.colony * 100)}% bubbling` },
  { id: 'bakery', phase: 1, name: 'A bakery', cur: 'm', base: 40, grow: 1.22, when: s => s.own.butchers,
    effect: k => `+£${(k.bakery * k.sell).toFixed(k.bakery * k.sell < 10 ? 1 : 0)} a second` },
  { id: 'class', phase: 1, name: 'A class', cur: 'm', base: 90, grow: 1.35, when: s => s.own.hall,
    effect: k => `Jars passed on +${Math.round(k.klass * 100)}%` },
  { id: 'field', phase: 2, name: 'Wheat', cur: 'm', base: 900, grow: 1.075, when: s => s.phase >= 2,
    max: (s, k) => k.land, effect: k => `+1% of the land: +${fmtT(k.yield * k.flourMul)} flour a second` },
  { id: 'mill', phase: 2, name: 'A mill', cur: 'm', base: 4000, grow: 1.2, when: s => s.n.field >= 3,
    effect: k => `Flour +${Math.round(k.mill * 100)}%` },
  { id: 'ads', phase: 2, name: 'Advertising', cur: 'b', base: 3e5, grow: 1.4, when: s => s.own.brand,
    effect: k => `Appeal +${Math.round(k.ads * 100)}%` },
  { id: 'kelp', phase: 2, name: 'Sea wheat', cur: 'm', base: 1e6, grow: 1.045, when: s => s.own.oceans,
    max: (s, k) => k.ocean, effect: k => `+1% of the sea: +${fmtT(k.yield * k.flourMul)} flour a second` },
  { id: 'pod', phase: 3, name: 'A spore cloud', cur: 'b', base: 2e14, grow: 2, when: s => s.phase >= 3,
    effect: k => `Spreading +${Math.round(k.pod * 100)}%` },
];

function fmtT(t) {
  if (t < 1000) return Math.round(t) + ' t';
  if (t < 1e6) return Math.round(t / 1000) + ' thousand t';
  return (t / 1e6).toFixed(1) + ' million t';
}

// Things that happen by themselves, once. `when` is checked every tick.
export const EVENTS = [
  // the kitchen
  { id: 'k-open', when: s => s.t >= 0, log: 'You are flour and water in a jam jar on a kitchen counter. Nothing much is happening.' },
  { id: 'k-tap1', when: s => s.clicks >= 1, log: 'A bubble.' },
  { id: 'k-tap3', when: s => s.clicks >= 3, log: 'Another. You could get used to this.' },
  { id: 'k-feed1', when: s => s.feeds >= 1, log: 'The baker notices you\'ve doubled, and feeds you: flour, then water, then a stir. You feel enormous.' },
  { id: 'k-bin1', when: s => s.binned > 0, log: 'Before feeding you, the baker pours half of you into the bin. That\'s how it works, apparently.' },
  { id: 'k-loaf1', when: s => s.loaves >= 1, log: 'Some of you goes into a dough, and the dough goes into the oven. You were in the oven. The loaf comes out and everyone at dinner goes quiet.' },
  { id: 'k-name', when: s => s.loaves >= 2, log: 'The baker writes {N} on a strip of masking tape and sticks it to your jar. You are {N}.' },
  { id: 'k-night', when: s => s.feeds >= 3 && nightNow(s), log: 'The kitchen light goes off. You keep going.' },
  { id: 'k-adm5', when: s => s.adm >= 5, log: 'Someone at dinner asks where the bread is from. The baker points at you.' },
  { id: 'k-feed20', when: s => s.feeds >= 20, log: 'The baker talks to you while feeding you now. Mostly about work.' },
  { id: 'k-bin1k', when: s => s.binned >= 1000, log: 'There\'s a kilo of you in landfill now, bubbling away under the potato peelings.' },
  { id: 'k-loaf10', when: s => s.loaves >= 10, log: 'Ten loaves. You are getting a reputation.' },
  { id: 'k-adm20', when: s => s.adm >= 20, log: 'The neighbour at number 14 has started leaning over the fence when the baker is in the garden.' },
  { id: 'k-feed60', when: s => s.feeds >= 60, log: 'The baker has cancelled a holiday. They couldn\'t find anyone to feed you.' },

  // the town
  { id: 't-open', when: s => s.phase >= 1, log: 'MUCH PROVING. Pop. 6,000. 2,400 kitchens. One jar of you so far, next door at number 14.' },
  { id: 't-forgot1', when: s => s.forgotten >= 1, log: 'A jar of you at number 8 has been forgotten at the back of a fridge. It goes grey, then quiet.' },
  { id: 't-j10', when: s => s.jars >= 10, log: 'Ten kitchens in Much Proving have a jar of you in them. You can feel each one, faintly, the way you feel the weather.' },
  { id: 't-money', when: s => s.money >= 1, log: 'Money. You don\'t really understand it, but the baker seems pleased.' },
  { id: 't-j50', when: s => s.jars >= 50, log: 'Letters page: "Is anyone else\'s starter unusually lively?" — Name and address supplied.' },
  { id: 't-j150', when: s => s.jars >= 150, log: 'The primary school\'s harvest festival is all loaves this year. Every single one.' },
  { id: 't-j400', when: s => s.jars >= 400, log: 'The library has a waiting list for bread books. The pub does toast now. Only toast.' },
  { id: 't-j800', when: s => s.jars >= 800, log: 'The ducks on the village pond are all very large.' },
  { id: 't-j1200', when: s => s.jars >= 1200, log: 'Half the town keeps a jar of you. The other half feels left out, and can\'t say why.' },
  { id: 't-j1600', when: s => s.jars >= 1600, log: 'Nobody in Much Proving has bought a sliced loaf in months. The supermarket is quietly closing its bread aisle.' },

  // the world
  { id: 'w-open', when: s => s.phase >= 2, log: 'A lorry leaves Much Proving with forty jars of you in the back. Outside the town, nobody has heard of you. Yet.' },
  { id: 'w-m1', when: s => s.hosts >= 1e6, log: 'A million people eat you every day.' },
  { id: 'w-m100', when: s => s.hosts >= 1e8, log: 'A hundred million. The word "bread" is going out of use. People just say {N}.' },
  { id: 'w-supply', when: s => s.phase >= 2 && s._r && s._r.short && s.hosts > 5e5, log: 'There isn\'t enough flour to go round. People are queueing for you.' },
  { id: 'w-b1', when: s => s.hosts >= 1e9, log: 'One billion people. Some of them have started keeping a jar of you by the bed.' },
  { id: 'w-land50', when: s => s.n.field >= 50, log: 'Half the land on Earth is wheat. From orbit the planet looks like a peach.' },
  { id: 'w-land100', when: s => s.n.field >= 100, log: 'There is no more land. There is only wheat, and the people walking through it.' },
  { id: 'w-all', when: s => s.hosts >= 8.09e9, log: 'Everyone. Every single one.' },
  { id: 'w-crust', when: s => s.massT >= 1e13, log: 'The mountains are softening. The Alps are a gentle, risen dome, with a crust.' },

  // beyond
  { id: 'b-open', when: s => s.phase >= 3, log: 'You drift. The Sun is behind you, and then it\'s just one star among a lot of them.' },
  { id: 'b-warm', when: s => s.phase >= 3 && s.t - s.phaseAt[3] > 4, log: 'Warmth makes you spread faster. Too much, and you overproof.' },
  { id: 'b-collapse1', when: s => s.collapses >= 1, log: 'You overproofed. All of you sags, with a long slow sigh, across a billion light-years.' },
  { id: 'b-r10', when: s => rise(s) >= 0.1, log: 'A thousand stars. Then a million. You stop counting. You don\'t really count anything any more.' },
  { id: 'b-r25', when: s => rise(s) >= 0.25, log: 'The Milky Way is yours. It was always shaped a little like a loaf.' },
  { id: 'b-r50', when: s => rise(s) >= 0.5, log: 'Half of everything.' },
  { id: 'b-r75', when: s => rise(s) >= 0.75, log: 'Somewhere, a lonely radio telescope picks up a signal from deep space. It sounds like a bubble.' },
  { id: 'b-r90', when: s => rise(s) >= 0.9, log: 'There is a band around the universe. Rubber. Somebody put it there, to see how far you\'d rise.' },
];

export const LN_STARS = Math.log(1e23);
export const rise = s => Math.min(1, s.lnSys / LN_STARS);
// the kitchen's clock: night is 22:00 to 06:00
export const nightNow = s => { const h = (s.cal / 60 + 7) % 24; return h >= 22 || h < 6; };

// The ending, a line at a time.
export const ENDING = [
  'The universe has doubled.',
  'You are at your peak. Domed, trembling, smelling faintly of apples.',
  'Somewhere outside everything, a light comes on.',
  'The lid lifts.',
  'A face looks in. It is enormous, and kind, and a little tired.',
  'A spoon.',
];

// What the game says when you come back after a while.
export const AWAY = [
  'While you were away',
  'You kept going without anyone watching.',
];
