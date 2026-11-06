// Everything that is words: the six regulars, what they look like each year, what they order, and what you overhear.
// Line format: 'who|text'. No who means narration.

export const ITEMS = {
  coffee: { name: 'coffee', cents: 5, st: 'urn' },
  tea: { name: 'tea', cents: 5, st: 'urn' },
  milk: { name: 'milk', cents: 10, st: 'fount' },
  choc: { name: 'chocolate milk', cents: 15, st: 'fount' },
  straw: { name: 'strawberry milk', cents: 15, st: 'fount' },
  cola: { name: 'cola', cents: 10, st: 'fount' },
  toast: { name: 'toast', cents: 10, st: 'toaster' },
  eggs: { name: 'eggs', cents: 35, st: 'griddle' },
  burger: { name: 'burger', cents: 30, st: 'griddle' },
  apple: { name: 'apple pie', cents: 15, st: 'pie' },
  cherry: { name: 'cherry pie', cents: 15, st: 'pie' },
};

export const priceOf = (kind, year) => {
  const c = ITEMS[kind].cents * (1 + (year - 1952) * 0.055);
  return Math.max(5, Math.round(c / 5) * 5);
};

export const NAMES = { gus: 'Gus', dot: 'Dot', danny: 'Danny', ray: 'Ray', frank: 'Frank', helen: 'Helen', tommy: 'Tommy', vera: 'Miss Lund', sy: 'Sy', june: 'June', bea: 'Bea' };

// who appears on the card index, in order
export const CARDS = [
  { id: 'gus', label: 'Gus Pell', sub: 'Retired off the railroad' },
  { id: 'dot', label: 'Dot Novak', sub: 'Lives over the hardware store' },
  { id: 'ray', label: 'Ray & Danny Tully', sub: 'From the plant' },
  { id: 'frank', label: 'Frank & Helen Ames', sub: 'Newlyweds' },
  { id: 'vera', label: 'Miss Lund', sub: 'Teaches third grade' },
  { id: 'sy', label: 'Sy Adler', sub: 'Pens. Just passing through' },
];

const SKIN = { a: '#eec39b', b: '#e4ad84', c: '#c98f62', d: '#a86f48', e: '#7d4f33' };
const look = (arr) => (year) => { let cur = {}; for (const l of arr) if (year >= l.y) cur = { ...cur, ...l }; return cur; };

export const LOOKS = {
  gus: look([
    { y: 1952, skin: SKIN.b, head: 'long', hair: 'fringe', hairCol: '#e8e2d4', top: '#5c6a70', kind: 'vest', size: .94, stache: '#e8e2d4', nose: 'long', lines: 2 },
    { y: 1958, size: .9, top: '#6e7a7c', lines: 3 },
  ]),
  dot: look([
    { y: 1952, skin: SKIN.a, head: 'round', hair: 'pigtails', hairCol: '#c8552b', top: '#3f7f9c', kind: 'dress', size: .62, freckles: 1, nose: 'button' },
    { y: 1956, hair: 'pony', size: .8, top: '#d9a53a', kind: 'sweater', head: 'egg' },
    { y: 1960, size: .92, top: '#2f8f83', glasses: 1 },
    { y: 1964, hair: 'bob', top: '#f3ecdc', kind: 'nurse', size: .95 },
    { y: 1970, hair: 'bob', top: '#b5533a', kind: 'dress', lines: 1 },
  ]),
  danny: look([
    { y: 1952, skin: SKIN.c, head: 'round', hair: 'crew', hairCol: '#2c2622', top: '#c9453a', kind: 'stripe', size: .6, nose: 'button', ears: 1 },
    { y: 1957, hair: 'pomp', size: .82, head: 'egg', top: '#3e6b8c', kind: 'shirt', nose: 'plain' },
    { y: 1961, size: .97, top: '#e8e0cf', kind: 'tee' },
    { y: 1965, hair: 'crew', top: '#5f6b45', kind: 'shirt' },
    { y: 1969, hair: 'shag', top: '#5f6b45', kind: 'jacket', sad: 1, stubble: 1 },
    { y: 1970, kind: 'apron', top: '#efe7d6', stubble: 0 },
  ]),
  ray: look([
    { y: 1952, skin: SKIN.c, head: 'box', hair: 'side', hairCol: '#2c2622', top: '#47606e', kind: 'work', size: 1.08, hat: 'cap', hatCol: '#37474f', nose: 'hook', ears: 1 },
    { y: 1961, hat: null, top: '#7c6a55', kind: 'shirt', lines: 1 },
    { y: 1963, hat: 'driver', hatCol: '#2f4a5f', top: '#2f4a5f', kind: 'suit' },
    { y: 1968, hairCol: '#8d8d88', lines: 2 },
  ]),
  frank: look([
    { y: 1952, skin: SKIN.a, head: 'round', hair: 'side', hairCol: '#b08a4d', top: '#7b5a3e', kind: 'suit', bow: '#b5392f', size: .96, glasses: 1, nose: 'button' },
    { y: 1966, hair: 'fringe', hairCol: '#a88e62', lines: 1, top: '#6d6e55' },
    { y: 1970, hairCol: '#cdc7b6', lines: 2 },
  ]),
  helen: look([
    { y: 1952, skin: SKIN.a, head: 'egg', hair: 'curly', hairCol: '#8f3f27', top: '#d8645a', kind: 'dress', size: .9, lip: '#b5392f', nose: 'plain' },
    { y: 1961, hair: 'beehive', top: '#3c9c97' },
    { y: 1968, hair: 'long', top: '#c98a2e', lines: 1 },
  ]),
  tommy: look([
    { y: 1957, skin: SKIN.a, head: 'round', hair: 'tuft', hairCol: '#b08a4d', top: '#e8dfc6', kind: 'tee', size: .42, nose: 'button' },
    { y: 1961, hair: 'crew', top: '#d9a53a', kind: 'stripe', size: .6 },
    { y: 1968, hair: 'shag', top: '#6a8f3f', kind: 'tee', size: .85, head: 'egg', nose: 'plain' },
  ]),
  vera: look([
    { y: 1952, skin: SKIN.b, head: 'long', hair: 'bun', hairCol: '#3a2a22', top: '#7f7a8c', kind: 'cardigan', size: .95, glasses: 1, nose: 'long' },
    { y: 1963, hairCol: '#7c716a', lines: 1 },
    { y: 1967, hairCol: '#a8a29a', top: '#e3d7c0', flower: 1 },
    { y: 1968, flower: 0, top: '#7f7a8c' },
  ]),
  sy: look([
    { y: 1953, skin: SKIN.b, head: 'pear', hair: 'side', hairCol: '#2c2622', top: '#8c6d3f', kind: 'suit', bow: null, tie: '#3c7f76', size: .92, hat: 'fedora', hatCol: '#5b4a3a', stache: '#2c2622', stacheThin: 1, nose: 'hook' },
    { y: 1964, hairCol: '#8a8680', stache: '#8a8680', lines: 1 },
    { y: 1967, hat: null, tie: '#b5392f', top: '#3e4a52' },
    { y: 1968, top: '#8c6d3f', tie: '#3c7f76' },
  ]),
  june: look([
    { y: 1970, skin: SKIN.a, head: 'round', hair: 'pigtails', hairCol: '#c8552b', top: '#e2b53d', kind: 'dress', size: .55, freckles: 1, nose: 'button' },
  ]),
};

// Each year: the wall calendar, what's new, the strangers, the regulars.
// `at` is seconds into the shift. `seat` is the stool they always take.
// hush: they don't say what they want for a few seconds; put the right thing down first and you remembered.
const Y = (year, cal, o) => ({ year, cal, ...o });
const G = 2, DOTSEAT = 0;

export const YEARS = [
  Y(1952, 'Tue, Oct 7', {
    dur: 46, n: 5, mix: ['coffee', 'coffee', 'toast', 'eggs', 'apple', 'tea'], sizes: [2, 2, 1],
    menu: ['coffee', 'tea', 'milk', 'choc', 'straw', 'toast', 'eggs', 'apple'],
    note: 'Gone to Florida and not coming back. The place is yours. Everything you need to know is on these notes. — Bea',
    tutorial: true, parties: [],
  }),
  Y(1953, 'Wed, Apr 8', {
    dur: 90, n: 6, mix: ['coffee', 'coffee', 'toast', 'eggs', 'apple', 'cherry', 'tea', 'choc'], sizes: [1, 2, 2],
    fresh: ['cherry'],
    note: 'Regulars won’t tell you what they want. They’ll sit and wait to see if you know. Put it down before they have to say it.',
    parties: [
      { who: ['gus'], seat: G, at: 3, order: ['coffee', 'eggs', 'toast'], hush: 1,
        say: ['gus|Clock’s still four minutes fast.'],
        eat: ['gus|Forty-one years on the Lehigh and I never once pulled in late. Your clock would’ve got me fired.'] },
      { who: ['ray', 'danny'], at: 20, order: ['coffee', 'eggs', 'toast', 'straw'],
        say: ['ray|Coffee, eggs, toast. Strawberry milk for the boy, he’ll tell you it’s for his sister.', 'danny|It’s for my sister.', 'ray|He doesn’t have a sister.'],
        eat: ['ray|Second shift at the plant starts at two. Keeps a man in eggs.'] },
      { who: ['vera'], seat: 4, at: 42, order: ['tea', 'toast'],
        say: ['vera|Tea, please. Dry toast. I have thirty-one spelling tests to get through.'],
        eat: ['|She corrects something on the menu with a red pencil.'] },
      { who: ['sy'], seat: 0, at: 58, order: ['tea', 'toast'],
        say: ['sy|Sy Adler, Adler Fine Pens. Just passing through. What’s good here?', '|He looks down the counter a while.', 'sy|I’ll have what the lady’s having.'],
        eat: ['sy|Terrible tea. See you next year.'] },
      { who: ['frank', 'helen'], at: 70, order: ['apple', 'cherry'],
        say: ['helen|One apple, one cherry. The cherry’s new! We’re reckless people.'],
        eat: ['frank|She’s found a house on Birch Street. I’ve seen the price.', 'helen|We can eat less pie.', 'frank|You hear that, Sunny? Next year we eat less pie.'] },
    ],
  }),
  Y(1954, 'Fri, Jun 11', {
    dur: 95, n: 7, mix: ['coffee', 'coffee', 'toast', 'eggs', 'burger', 'burger', 'apple', 'cherry', 'choc'], sizes: [1, 2, 2],
    fresh: ['burger'],
    note: 'Burgers get turned over ONCE. Tap when it’s ready to flip, tap again when it’s done. Nobody ever thanked a cook for a hockey puck.',
    parties: [
      { who: ['gus', 'dot'], seat: G, at: 3, order: ['coffee', 'eggs', 'toast', 'choc'], hush: 1,
        say: ['dot|Mr. Pell is buying me a chocolate milk because I can name every stop to Scranton.', 'gus|She missed Tobyhanna.', 'dot|I did not!'],
        eat: ['gus|Doctor’s been at me about the eggs. Told him I’d think it over. Going on about a year, I’d say.'] },
      { who: ['frank', 'helen'], at: 24, order: ['apple'], hush: 1, wrong: 'frank|Just the one, Sunny. Two forks.',
        say: ['helen|We got it. Birch Street.', 'frank|One slice, two forks. That’s the mortgage talking.'],
        eat: ['helen|Bigger half’s yours.', 'frank|There’s no bigger half. I measured.'] },
      { who: ['ray', 'danny'], at: 44, order: ['coffee', 'burger', 'straw'],
        say: ['ray|I’ll try this burger of yours. Boy’ll have his... sister’s drink.'],
        eat: ['danny|Dot says when you’re twelve you’re not allowed strawberry anymore.', 'ray|Who says?', 'danny|Dot.'] },
      { who: ['vera'], seat: 4, at: 60, order: ['tea', 'toast'], hush: 1, say: [], eat: ['vera|Thank you. You’ve spelled “delicious” wrong on the board.'] },
      { who: ['sy'], seat: 1, at: 74, order: ['tea', 'toast'], hush: 1,
        say: ['sy|Still passing through.'],
        eat: ['|He sits one stool closer than he did last year. He seems to think nobody noticed.'] },
    ],
  }),
  Y(1955, 'Mon, Sep 12', {
    dur: 100, n: 8, mix: ['coffee', 'coffee', 'toast', 'eggs', 'burger', 'apple', 'cherry', 'choc', 'straw'], sizes: [1, 2, 2, 3],
    note: 'When it’s busy, keep your eye on the slips. The paper runs out at the same speed they do.',
    parties: [
      { who: ['gus'], seat: G, at: 3, order: ['coffee', 'eggs', 'toast'], hush: 1,
        say: [],
        eat: ['gus|This is my last plate of eggs, Sunny. Doctor won.', 'gus|Toast and coffee from here on. Write it down. I don’t care to say it twice.'] },
      { who: ['dot', 'danny'], at: 26, order: ['choc', 'straw'], hush: 1,
        say: ['dot|Last chocolate milk of my life. I’m twelve. Next year: cola.'],
        eat: ['danny|You can’t just stop liking things.', 'dot|Watch me.'] },
      { who: ['ray'], at: 46, order: ['coffee', 'burger'], hush: 1,
        say: [], eat: ['ray|They made me foreman on line four. Same plant, nicer hat.'] },
      { who: ['sy'], seat: 2, at: 60, order: ['tea', 'toast'], hush: 1,
        say: [], eat: ['sy|Sold four hundred gross in Allentown. Doesn’t she ever look up?'] },
      { who: ['vera'], seat: 4, at: 62, order: ['tea', 'toast'], hush: 1,
        say: [], eat: ['vera|That man’s pen skips. I borrowed it for a moment. Quite by accident.'] },
    ],
  }),
  Y(1956, 'Thu, Feb 9', {
    dur: 105, n: 9, mix: ['coffee', 'coffee', 'cola', 'cola', 'toast', 'eggs', 'burger', 'burger', 'apple', 'cherry'], sizes: [1, 2, 2, 3],
    fresh: ['cola'],
    note: 'New tap on the fountain. Kids will drink anything if it’s cold and comes in a tall glass.',
    parties: [
      { who: ['gus'], seat: G, at: 3, order: ['coffee', 'toast'], hush: 1, wrong: 'gus|Told you. Toast and coffee.',
        say: [], eat: ['gus|Toast. Forty-one years on the railroad for this.'] },
      { who: ['dot', 'danny'], at: 24, order: ['cola', 'straw'], hush: 1, wrong: 'dot|A COLA, Sunny. I told you last year.',
        say: ['dot|Cola, please. I’m thirteen now.'],
        eat: ['danny|Mine’s for my sister.', 'dot|Danny. You don’t have a sister.', '|He drinks it anyway. He will drink it until the day someone takes it away.'] },
      { who: ['frank', 'helen'], at: 48, order: ['apple', 'cherry'],
        say: ['helen|Two slices today. I’m eating for two.', 'frank|She’s eating for two.', 'helen|He’s telling everybody.'],
        eat: ['frank|We’ll need a high chair next year. Do you have a high chair?', '|You do not have a high chair.'] },
      { who: ['vera'], seat: 4, at: 66, order: ['tea', 'toast'], hush: 1, until: 'sy', say: [], eat: [] },
      { who: ['sy'], seat: 3, at: 68, order: ['tea', 'toast'], hush: 1,
        say: ['sy|Passing through.'],
        eat: ['vera|Good morning, Mr. Adler.', '|He drops his hat.'] },
    ],
  }),
  Y(1957, 'Sat, Aug 17', {
    dur: 110, n: 12, mix: ['coffee', 'cola', 'cola', 'toast', 'burger', 'burger', 'apple', 'cherry', 'choc'], sizes: [1, 2, 2, 3], burst: [38, 62, 7],
    note: 'Tour buses. They all want it now, they all want it different, and they tip like they’re going home tomorrow. Which they are.',
    parties: [
      { who: ['gus'], seat: G, at: 3, order: ['coffee', 'toast'], hush: 1, say: [],
        eat: ['gus|Bus from Ohio out front. Here they come. Stand up straight.'] },
      { who: ['frank', 'helen', 'tommy'], at: 16, order: ['apple', 'cherry', 'milk'],
        say: ['helen|This is Tommy.', 'frank|You got a high chair!', '|It’s a milk crate and a phone book. It’ll do.'],
        eat: ['helen|He likes you. He likes everyone. It’s a real concern.'] },
      { who: ['ray', 'danny'], at: 74, order: ['coffee', 'burger', 'straw', 'burger'], hush: 1, say: [],
        eat: ['ray|He eats like me now.', 'danny|Same drink, though.', 'ray|Your mother’ll be glad to hear it.'] },
      { who: ['sy'], seat: 3, at: 86, order: ['tea', 'toast'], hush: 1, say: [],
        eat: ['|Miss Lund doesn’t teach Saturdays. He looks at the fourth stool for a long time. Then he leaves her a pen.'] },
    ],
  }),
  Y(1958, 'Wed, May 14', {
    dur: 105, n: 11, mix: ['coffee', 'cola', 'toast', 'eggs', 'burger', 'burger', 'apple', 'cherry', 'straw'], sizes: [1, 2, 2, 3],
    note: 'A cook with five hands is a cook who burned something. Do the griddle first. Coffee can wait. Eggs can’t.',
    parties: [
      { who: ['gus'], seat: G, at: 3, order: ['coffee', 'toast'], hush: 1, say: [],
        eat: ['gus|Your clock. Still four minutes fast. I come in every morning to see if it’s been fixed.', 'gus|I hope you never do.'] },
      { who: ['vera'], seat: 4, at: 20, order: ['tea', 'toast'], hush: 1, until: 'sy',
        say: [], eat: ['vera|Someone left a pen here last summer. It doesn’t skip.'] },
      { who: ['sy'], seat: 3, at: 22, order: ['tea', 'toast'], hush: 1,
        say: ['|He sits beside her. Five years it took. It is the only stool left to move to.'],
        eat: ['sy|Lovely weather we’re having, Miss Lund.', 'vera|It’s raining, Mr. Adler.', 'sy|Yes.'] },
      { who: ['dot', 'danny'], at: 50, order: ['cola', 'straw', 'burger'], hush: 1, say: [],
        eat: ['dot|He asked me to the Grange dance. In front of his whole shop class.', 'danny|I panicked.', 'dot|I said yes, Danny.'] },
      { who: ['ray'], at: 76, order: ['coffee', 'burger'], hush: 1, say: [],
        eat: ['ray|They’re putting in new machines down at the plant. Everyone says that’s good. Everyone who doesn’t work there.'] },
    ],
  }),
  Y(1959, 'Mon, Jan 26', {
    dur: 80, n: 0, mix: ['coffee'], sizes: [1], snow: 1,
    note: 'Blizzard. Stay open. Somebody always comes, and when they do they’ve got nowhere else to be.',
    parties: [
      { who: ['gus'], seat: G, at: 4, order: ['coffee', 'toast'], hush: 1,
        say: ['|Nobody out but Gus. He walked. It took an hour.'],
        eat: ['gus|Worst one was ’88. I was six. Trains stopped for nine days.'] },
      { who: ['dot', 'danny'], seat: 0, at: 18, order: ['cola', 'straw'], hush: 1,
        say: [],
        eat: ['dot|College boards are next year. Mr. Kessler says I should start drinking coffee. Black, he says, like a serious person.', 'danny|You hate coffee.', 'dot|That’s what makes it serious.'] },
      { who: ['ray'], seat: 0, at: 36, order: ['coffee', 'eggs'],
        say: ['ray|Plant’s shut for the snow. Might as well have the eggs.'],
        eat: ['ray|Everybody here? Look at that. Whole town’s five people.'] },
      { who: ['vera'], seat: 4, at: 52, order: ['tea', 'toast'], hush: 1, say: [],
        eat: ['vera|School’s closed. I don’t know why I came. I suppose I wanted the walk.', '|She looks out the window in the direction of the highway. There is no highway today.'] },
    ],
  }),
  Y(1960, 'Tue, Sep 6', {
    dur: 110, n: 12, mix: ['coffee', 'cola', 'cola', 'toast', 'eggs', 'burger', 'burger', 'cherry', 'apple', 'straw'], sizes: [1, 2, 2, 3],
    note: 'Paint the place once in a while. Same stools. People don’t like it when you move the stools.', reno: 1,
    parties: [
      { who: ['gus'], seat: G, at: 3, order: ['coffee'], until: 'dot',
        say: ['gus|New paint. Just the coffee today, Sunny.'],
        eat: ['gus|Toast takes an awful lot of chewing, it turns out.'] },
      { who: ['dot'], seat: 1, at: 22, order: ['coffee'], hush: 1, wrong: 'dot|Coffee. Black. Like a serious person.',
        say: ['|She has a pencil behind each ear.'],
        eat: ['|She drinks all of it and makes a face like a cat in a bath.', 'dot|Three hours. If I get in, I’m gone next fall. State nursing school.', 'gus|You’ll be fine. It’s only Scranton and back.'] },
      { who: ['ray', 'danny'], at: 48, order: ['coffee', 'burger', 'burger', 'straw'], hush: 1, say: [],
        eat: ['ray|Word is the plant might not make the year after next.', 'danny|Dad.', 'ray|I said might.'] },
      { who: ['frank', 'helen', 'tommy'], at: 70, order: ['apple', 'cherry', 'milk'], hush: 1, say: [],
        eat: ['tommy|Can I sit on the spinny one?', 'frank|They’re all the spinny one, son.'] },
      { who: ['vera'], seat: 4, at: 84, order: ['tea', 'toast'], hush: 1, until: 'sy', say: [], eat: [] },
      { who: ['sy'], seat: 3, at: 86, order: ['tea', 'toast'], hush: 1, say: [],
        eat: ['sy|Your blackboard. Do you use chalk or the other kind?', 'vera|Mr. Adler, is that a question?', 'sy|I don’t know what it is.'] },
    ],
  }),
  Y(1961, 'Fri, Mar 3', {
    dur: 95, n: 4, mix: ['coffee', 'coffee', 'toast'], sizes: [1], quiet: 1,
    note: 'Some days nobody comes. Wipe the counter anyway.',
    parties: [
      { who: ['gus'], seat: G, at: 4, order: ['coffee'], hush: 1,
        say: ['|The plant closed Friday last. The lot across the way is empty.'],
        eat: ['gus|Your clock’s right, you know. Everyone else is four minutes behind.', 'gus|Dot’s off in the fall. You look after that one, if she lets you.', 'gus|See you tomorrow, Sunny.'] },
      { who: ['ray'], at: 30, order: ['coffee'], choice: { key: 'ray1', text: 'Ray counts out his dime in pennies, then counts them again.' },
        say: ['ray|Just the coffee.', '|He sits a long time in front of a cup that is empty.'],
        eat: ['ray|Twenty-two years. They gave us a letter. It wasn’t even a long letter.'] },
      { who: ['dot', 'danny'], at: 60, order: ['coffee', 'straw'], hush: 1,
        say: [],
        eat: ['dot|I got in.', 'danny|I know you did.', 'dot|You’re not going to say anything else?', 'danny|I’m drinking.'] },
    ],
  }),
  Y(1962, 'Thu, Oct 11', {
    dur: 100, n: 9, mix: ['coffee', 'cola', 'toast', 'eggs', 'burger', 'apple', 'cherry'], sizes: [1, 2, 2], ghost: 1,
    note: null,
    parties: [
      { who: ['ray'], seat: 0, at: 8, order: ['coffee'], choice: { key: 'ray2', text: 'Ray’s got the unemployment letter folded in his shirt. He looks at his dime.' },
        say: ['|Gus didn’t come in yesterday. His daughter telephoned.', '|The third stool stays empty. People seem to know without being told.'],
        eat: ['ray|Good man, Gus. Bus company’s hiring. I’m going Monday.'] },
      { who: ['vera'], seat: 4, at: 30, order: ['tea', 'toast'], hush: 1, say: [],
        eat: ['vera|He corrected my timetable once. In front of my class. He was right.'] },
      { who: ['danny'], seat: 1, at: 54, order: ['straw'], hush: 1,
        say: ['danny|Dot wrote. She says she won’t make it back for the service.'],
        eat: ['danny|You’d think someone would tell that clock.'] },
      { who: ['sy'], seat: 3, at: 78, order: ['tea', 'toast'], hush: 1, say: [],
        eat: ['|A small parcel comes in the mail from Gus’s daughter. A railroad watch, still running. Four minutes behind your clock.', '|You hang it on the nail beside it.'] },
    ],
  }),
  Y(1963, 'Wed, May 8', {
    dur: 110, n: 12, mix: ['coffee', 'cola', 'toast', 'eggs', 'burger', 'burger', 'cherry', 'apple', 'tea'], sizes: [1, 2, 2, 3],
    note: null,
    parties: [
      { who: ['ray'], seat: 0, at: 4, order: ['coffee', 'eggs', 'toast'], hush: 1, wrong: 'ray|Eggs again, Sunny! They pay me on Fridays now.',
        say: ['|Ray has a uniform. It has his name on it. He lets you look.'],
        eat: ['ray|Route nine. Nineteen stops. I don’t mind it. Nobody ever laid off a bus.'] },
      { who: ['vera'], seat: 4, at: 26, order: ['tea', 'toast'], hush: 1, until: 'sy', say: [], eat: [] },
      { who: ['sy'], seat: 3, at: 28, order: ['tea', 'toast'], hush: 1, say: [],
        eat: ['sy|Ten years I’ve been passing through here. I should tell you something, Vera.', 'sy|This town isn’t on my route. It’s ninety miles out of my way.', 'vera|I know. I looked at a map in 1955.', 'sy|You never said.', 'vera|You never asked.'] },
      { who: ['frank', 'helen', 'tommy'], at: 58, order: ['apple', 'cherry', 'cola'],
        say: ['tommy|I want a cola.', 'helen|He wants a cola. He’s six.', 'frank|He’s six and a half.', 'helen|Don’t you start, Frank.'],
        eat: ['|They do not share a fork today. You don’t ask.'] },
      { who: ['danny'], seat: 1, at: 84, order: ['burger', 'straw'], hush: 1, say: [],
        eat: ['danny|Got on at Hallet’s Garage. Dot’s home at Christmas. She’s bringing some doctor.', 'danny|Nice guy, she says.'] },
    ],
  }),
  Y(1964, 'Tue, Jul 14', {
    dur: 112, n: 13, mix: ['coffee', 'cola', 'cola', 'eggs', 'burger', 'burger', 'cherry', 'apple', 'straw', 'choc'], sizes: [1, 2, 2, 3],
    note: null,
    parties: [
      { who: ['dot'], seat: G - 1, at: 6, order: ['coffee', 'toast'],
        say: ['dot|Coffee and toast, Sunny. I’m a real nurse now. I can have it any way I want.', '|She looks at the third stool. She takes the one beside it.'],
        eat: ['dot|You still haven’t fixed that clock.', 'dot|Good.'] },
      { who: ['ray'], seat: 0, at: 28, order: ['coffee', 'eggs', 'toast'], hush: 1, say: [],
        eat: ['ray|There’s a fella on my route says the Navy got shot at somewhere. Danny’s twenty.'] },
      { who: ['frank'], seat: 0, at: 50, order: ['apple'], say: ['frank|Just the one today. Helen’s at her sister’s.'], eat: ['frank|For a while.'] },
      { who: ['helen', 'tommy'], seat: 3, at: 76, order: ['cherry', 'cola'],
        say: ['helen|Was he in? Don’t tell me.'],
        eat: ['helen|Was he eating apple?', '|You nod.', 'helen|Hm.'] },
      { who: ['sy'], seat: 3, at: 94, order: ['tea', 'toast'], hush: 1, say: [],
        eat: ['sy|Miss Lund is on a teachers’ trip to Philadelphia. I happen to have business in Philadelphia.'] },
    ],
  }),
  Y(1965, 'Thu, Nov 18', {
    dur: 112, n: 13, mix: ['coffee', 'cola', 'toast', 'eggs', 'burger', 'burger', 'cherry', 'apple'], sizes: [1, 2, 2, 3],
    note: null,
    parties: [
      { who: ['ray'], seat: 0, at: 4, order: ['coffee', 'eggs', 'toast'], hush: 1, say: [],
        eat: ['ray|He got the letter. Report Monday, Fort Dix. I told him come in and eat.'] },
      { who: ['danny', 'dot'], seat: 1, at: 34, order: ['burger', 'eggs', 'toast', 'cola', 'cherry', 'straw'],
        say: ['danny|One of everything, Sunny. Army says three meals. They don’t say of what.', 'danny|And a strawberry milk. Out loud. No sister.'],
        eat: ['dot|You’ll write?', 'danny|I can’t spell. Ask Miss Lund.', 'dot|Danny.', 'danny|I’ll write.', '|He leaves money on the counter. You push it back. He leaves it anyway.'] },
      { who: ['frank', 'helen', 'tommy'], at: 66, order: ['apple', 'cherry', 'cola'],
        say: ['frank|She’s back. Don’t say anything.', 'helen|I can hear you, Frank.'],
        eat: ['tommy|Is Danny going to a war?', 'helen|Finish your pie.'] },
      { who: ['vera'], seat: 4, at: 88, order: ['tea', 'toast'], hush: 1, say: [],
        eat: ['vera|I taught that boy to spell “necessary.” He’s the only one who ever got it.'] },
    ],
  }),
  Y(1966, 'Wed, Apr 20', {
    dur: 115, n: 14, mix: ['coffee', 'coffee', 'cola', 'toast', 'eggs', 'burger', 'burger', 'cherry', 'apple', 'tea'], sizes: [1, 2, 2, 3],
    note: null,
    parties: [
      { who: ['ray'], seat: 0, at: 4, order: ['coffee', 'eggs', 'toast'], hush: 1, say: [],
        eat: ['|Ray reads you the letter. He has read it to everyone on route nine.', 'ray|“Tell Sunny the coffee here is worse. Didn’t think that could be done.”', 'ray|That’s him. That’s my boy.'] },
      { who: ['dot'], seat: 1, at: 40, order: ['coffee'], hush: 1, say: [],
        eat: ['dot|It’s a girl. June. Seven pounds. Paul counted her fingers twice, and he’s the doctor.', 'dot|Danny doesn’t know yet. I’m writing it now. I keep starting over.'] },
      { who: ['frank', 'helen'], at: 68, order: ['apple', 'cherry'], hush: 1, say: [],
        eat: ['frank|Twelve years on Birch Street, the mortgage is half gone.', 'helen|So are you.', '|She pats his bald spot. So that’s all right, then.'] },
      { who: ['vera'], seat: 4, at: 90, order: ['tea', 'toast'], hush: 1, until: 'sy', say: [], eat: [] },
      { who: ['sy'], seat: 3, at: 92, order: ['tea', 'toast'], hush: 1, say: [],
        eat: ['sy|Vera, I have something in my sample case, and it’s not a pen.', '|She takes the small box. She looks it over for errors.', 'vera|Yes.', 'vera|But not in June. Everyone marries in June.'] },
    ],
  }),
  Y(1967, 'Sat, Oct 14', {
    dur: 120, n: 17, mix: ['tea', 'tea', 'toast', 'toast', 'apple', 'cherry', 'coffee'], sizes: [2, 2, 2, 3], wedding: 1,
    note: 'If they ever ask to hold the wedding at the counter, say yes. Then panic.',
    parties: [
      { who: ['vera'], seat: 4, at: 2, order: ['tea', 'toast'], hush: 1, until: 'sy', say: ['|Miss Lund is to be married at eleven. In a diner. She corrected the invitation herself.'], eat: [] },
      { who: ['sy'], seat: 3, at: 3, order: ['tea', 'toast'], hush: 1,
        say: ['sy|Fifteen years I’ve been drinking this. I hate tea, Sunny. I have always hated tea.'],
        eat: ['vera|I know, dear.', '|The third grade classes of 1953 through 1967 have all been invited. They all want what she’s having.'] },
      { who: ['ray', 'dot'], seat: 1, at: 70, order: ['coffee', 'coffee', 'apple'], hush: 1, say: [],
        eat: ['ray|Danny’s letters come slower now. Shorter.', 'dot|He’s fine, Ray. He’s just tired.', '|She has written to him every week. He hasn’t asked about the baby.'] },
      { who: ['frank', 'helen', 'tommy'], at: 96, order: ['apple', 'cherry', 'cola'], hush: 1, say: [],
        eat: ['helen|Fifteen years to sit next to her. Frank asked me at a bus stop in a week.', 'frank|It was raining. I was panicking.'] },
    ],
  }),
  Y(1968, 'Mon, Aug 5', {
    dur: 115, n: 14, mix: ['coffee', 'cola', 'toast', 'eggs', 'burger', 'burger', 'cherry', 'apple', 'tea'], sizes: [1, 2, 2, 3], reno: 2,
    note: null,
    parties: [
      { who: ['ray'], seat: 0, at: 4, order: ['coffee'], choice: null, until: 'dot',
        say: ['|New paneling, new menu boards. The same stools. You kept that much of Bea’s advice.', 'ray|Just coffee.', '|He has the eggs money in his hand. He doesn’t seem to know it.'],
        eat: ['ray|Nine weeks, no letter.'] },
      { who: ['vera', 'sy'], seat: 3, at: 34, order: ['tea', 'toast', 'coffee', 'toast'], hush: 1, wrong: 'sy|Coffee for me, Sunny! Mrs. Adler has released me.',
        say: [], eat: ['sy|I retired the sample case. She says I still talk like I’m selling something.', 'vera|He sold me a pen in 1953.'] },
      { who: ['dot'], seat: 1, at: 58, order: ['coffee'], hush: 1,
        say: ['|Dot comes in with the door still swinging. She goes straight to Ray, on the end stool.'],
        eat: ['dot|He’s alive. He’s in the Army hospital at Camp Zama. I called in every favor I own.', 'dot|Both legs, Ray. Both hands. They won’t say what else.', '|Ray puts his head down on the counter. Nobody in the place says one word.'] },
      { who: ['frank', 'helen', 'tommy'], at: 88, order: ['apple', 'cherry', 'cola'], hush: 1, say: [],
        eat: ['tommy|I’m gonna let my hair grow.', 'frank|You’re gonna let your what?'] },
    ],
  }),
  Y(1969, 'Sun, Jul 20', {
    dur: 120, n: 12, mix: ['coffee', 'cola', 'burger', 'burger', 'cherry', 'apple', 'toast'], sizes: [1, 2, 2, 3], moon: [62, 82],
    note: null, parties: [
      { who: ['ray'], seat: 0, at: 5, order: ['coffee', 'eggs', 'toast'], hush: 1, until: 'danny', say: [],
        eat: ['ray|He came home in March. He won’t come out of the house.', 'ray|I told him you were asking.'] },
      { who: ['vera', 'sy'], seat: 1, at: 28, order: ['tea', 'toast', 'coffee', 'toast'], hush: 1, say: [],
        eat: ['vera|I told my third grade they’d remember today for the rest of their lives.', 'sy|It’s July, Vera. You haven’t got a third grade.', 'vera|I told them in June.'] },
      { who: ['danny'], seat: 4, at: 52, order: ['straw'], silent: 1, fallback: 'coffee', hushFor: 34,
        say: ['|Danny Tully comes in and takes the stool at the very end, with his back to the wall.', '|He doesn’t look at the menu. He doesn’t look at anybody. He doesn’t say a word.'],
        usual: ['|You put it down in front of him. Pink, in the tall glass.', '|He looks at it for a long time.', 'danny|It’s for my sister.', '|Then Danny Tully laughs, and puts his hand over his eyes, and his shoulders go on shaking a while.', '|Everybody in the diner is looking at the moon. Nobody sees but you.'],
        missed: ['ray|Coffee’s fine, Sunny. Coffee’s fine.', '|He holds the cup and doesn’t drink it. Up on the television, a man is walking on the moon.'],
        eat: [] },
      { who: ['frank', 'helen'], at: 96, order: ['apple', 'cherry'], hush: 1, say: [],
        eat: ['frank|We watched it on your set, and I’ll tell you what I said to Helen. I said, that thing’s got less air than the Birch Street mortgage.', 'helen|He’s been saving that.'] },
    ],
  }),
  Y(1970, 'Wed, Jun 3', {
    dur: 118, n: 15, mix: ['coffee', 'cola', 'toast', 'eggs', 'burger', 'burger', 'burger', 'cherry', 'apple', 'choc'], sizes: [1, 2, 2, 3], helper: 1,
    note: null, parties: [
      { who: ['ray'], seat: 0, at: 4, order: ['coffee', 'eggs', 'toast'], hush: 1,
        say: ['|Danny asked for work. Nights at first, then mornings. He doesn’t talk much, but the griddle doesn’t need him to.', '|He flips the burgers now. You still have to catch them.'],
        eat: ['ray|Look at him back there. Hands like his old man.'] },
      { who: ['dot', 'june'], seat: 1, at: 34, order: ['coffee', 'choc'],
        say: ['dot|Coffee. And this is June, and she’ll have a chocolate milk, because I said so.', 'june|Can I sit on that one?'],
        eat: ['|She means the third stool. Dot looks at you. You look at Dot.', 'dot|Go on, June. Tell Sunny every stop to Scranton.', 'june|What’s Scranton?', '|Dot has to go and look out the window for a minute.'] },
      { who: ['frank', 'helen'], at: 66, order: ['apple'], hush: 1, wrong: 'helen|One slice, Sunny. Two forks. Doctor’s orders, it’s his sugar.',
        say: ['frank|Sugar’s up. We’re going back to one slice.'],
        eat: ['helen|Bigger half’s yours.', 'frank|There’s no bigger half, Helen.', 'helen|I know, dear. I measured too.'] },
      { who: ['vera', 'sy'], seat: 3, at: 92, order: ['tea', 'toast', 'coffee', 'toast'], hush: 1, say: [],
        eat: ['vera|You’ve been standing on that bad knee for eighteen years. Have you considered sitting down?', 'sy|She means it kindly.', 'vera|I mean it grammatically.'] },
    ],
  }),
  Y(1971, 'Sat, Sep 25', {
    dur: 140, n: 6, mix: ['coffee', 'coffee', 'toast'], sizes: [1, 2], finale: 1, helper: 1,
    note: null, parties: [
      { who: ['dot', 'june'], seat: 0, at: 3, order: ['choc', 'choc'], hush: 1,
        wrong: 'dot|Oh, come on, Sunny. What did I have when you met me?',
        say: ['|Danny’s buying you out. Papers are signed. Today is your last day behind this counter.', '|Word got round. They’re all coming in. And not one of them is going to tell you what they want.'],
        eat: ['dot|Nineteen years ago I told you I’d never get tired of this.', 'dot|I was nine. It was the truest thing I ever said.'] },
      { who: ['ray'], seat: 3, at: 26, order: ['coffee', 'eggs', 'toast'], hush: 1,
        say: [], eat: [], rayEnd: 1 },
      { who: ['frank', 'helen'], at: 56, order: ['apple', 'apple'], hush: 1,
        wrong: 'helen|Two slices! Like the first day. His sugar can file a complaint.',
        say: [], eat: ['frank|The first time. Two apple. There wasn’t any cherry yet.', 'helen|We were reckless people.'] },
      { who: ['vera', 'sy'], seat: 3, at: 80, order: ['tea', 'toast', 'tea', 'toast'], hush: 1,
        wrong: 'vera|Tea, I’m afraid. Both. He’s agreed to suffer one more time.',
        say: [], eat: ['sy|Terrible tea. See you next year.'] },
    ],
  }),
];

export const yearDef = (y) => YEARS.find(d => d.year === y);

// A little talk from people you'll never see again. Keeps the counter from being all plot.
export const STRANGER_LINES = {
  1952: ['Is it true this town has a stoplight?', 'Hot enough for you?', 'I like Ike. Do you like Ike?'],
  1955: ['My boy wants a coonskin cap. Every boy wants a coonskin cap.', 'You got the ball game on?'],
  1957: ['It has FINS, Harold. What does a car need fins for?', 'Sputnik went right over my garage.'],
  1960: ['Two televisions! Who needs two?', 'Have you tried the new supermarket? It’s the size of Delaware.'],
  1964: ['My daughter screamed at the television for an hour. Four boys with haircuts.', 'They say you can get a phone in your car now.'],
  1967: ['Coffee’s gone up again, I see.', 'I told him, nobody’s going to pay fifty cents for a burger.'],
  1970: ['You got anything with sprouts?', 'My son says money isn’t real. I said, then pay for your own lunch.'],
};

export const rayEndLines = (flags) => flags.comped
  ? ['ray|March of ’61 on. I kept count.', '|He puts a stack of dimes on the counter, and a bus token on top.', 'ray|That’s the coffee you never rang up. The token’s interest.', '|There is no use arguing with Ray Tully. There never was.']
  : ['ray|Nineteen years, I never once skipped a check. Not even in ’61. I want that on the record.', '|You tell him it’s on the record. He nods. He looks ten years younger.'];

export const ENDING = (flags) => [
  '|Three o’clock. You turn the sign around. Nobody leaves.',
  'danny|Sit down, Sunny.',
  '|Nineteen years, and you have never once sat on one of these stools.',
  'danny|Third one’s open.',
  ...(flags.gusCup ? ['dot|I heard about the cup you poured. The year he died. I never thanked you.'] : []),
  ...(flags.dannyMilk ? ['danny|You remembered. I never said. I want you to know I never forgot you remembered.'] : []),
  'dot|What’ll it be?',
  '|Nobody has ever asked you that.',
  'danny|You know how it works. Hold it till the line.',
];

export const NOTES = {
  coffee: 'Hold the lever till the coffee hits the line, then let go. Don’t get fancy.',
  serve: 'Tap the cup and it goes to whoever’s waiting. You can drag it there too.',
  toast: 'Tap the toaster. It pops when it pops. Tap the toast.',
  eggs: 'Tap the eggs to crack one on the griddle. Sunny side up, like the sign. When the yolk goes bright, tap it. Leave it and it burns.',
  clear: 'He’s gone. Tap his place to clear it and take the money. Nobody sits at a dirty place.',
  fount: 'Kids. Same trick as the coffee, three taps. Mind which one.',
  pie: 'Tap a pie. It cuts itself. That’s the only easy thing in this building.',
  usual: 'Gus is back and he won’t say what he wants. They never do, once they’re regulars. You know what he has. Pour it and DRAG it to him before he has to ask.',
  rush: 'That’s the job. Doors are open. Twenty years from now you can sit down. — Bea',
};
