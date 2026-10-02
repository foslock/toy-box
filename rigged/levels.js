// Rigged Racer: the races to fix. Each names its track and laps, the racers on the grid (pole first), the goal, what
// the player gets at the start of each lap, who's asking and why, and a way to do it (check.mjs plays that through to
// prove the race can be fixed, and that it isn't fixed already).
//
// They get harder in order: tuned so that fewer and fewer plans made at random win (check.mjs --rand), from about
// two in three for the first to under one in a hundred for the last, and so that each turns on one idea.
//
// A racer can start holding an item ({ who, item }); lockGates leaves the shortcut's gate as it is, with no button;
// crates: [where, ...] puts out rows of crates that come back after they're taken.
// Goals: { who, place } (exactly that place; -1 is last), { who, top }, { who, bottom }, { who, ahead: other },
// { who, behind: other }.
// Solution steps: { lap, place, s, lane, path } puts something down when that lap starts (s as a fraction of the
// path, lane counted from the left); { lap, arm } arms a trap; { lap, gate, open } sets a gate; { t, ... } does it at
// that time instead.
export const LEVELS = [
  /* ---------- Dustbowl Speedway ---------- */
  {
    name: 'Grease Lightning', track: 'dust', laps: 3,
    racers: ['duke', 'mutt', 'granny', 'pip', 'rhonda'],
    goal: [{ who: 'granny', ahead: 'duke' }],
    stock: [{ oil: 1 }, { oil: 1 }, {}],
    from: 'granny', ask: 'That Dieselbottom boy has beaten me every Sunday for thirty years. Just once, dear. Just once.',
    fresh: ['oil'], par: 1, teach: [{ text: 'You don’t drive, dear. You <b>rig</b>. Drag the <b>oil slick</b> onto the road, in front of Duke.', wait: 'placed' }, { text: 'Duke’s <b>reckless</b>: he never steers round oil. Anyone else who sees it in time swerves into a free lane. The dotted lines show where everyone’s headed next.' }, { text: 'Press <b>Race!</b> It stops at every lap to give you more, and you can pause any time to put things down.' }],
    solution: [{lap: 1, place: 'oil', s: 0.91912, lane: 1}],
  },
  {
    name: 'Worm Food', track: 'dust', laps: 3,
    racers: ['rhonda', 'duke', 'mutt', 'pip', 'granny', 'sprocket'],
    goal: [{ who: 'pip', top: 3 }],
    stock: [{ worm: 1, oil: 1 }, { worm: 1 }, { worm: 1 }],
    from: 'pip', ask: 'If I get on the podium Mum says I can keep the bathtub.',
    fresh: ['worm'], par: 2, teach: [{ text: 'There’s a <b>sandworm</b> under the track! Tap its button to arm it. It eats the next kart to drive past.' }, { text: 'Pause the race just before the kart you want gets there, then arm it. You get one worm a lap.' }],
    solution: [{lap: 1, place: 'oil', s: 0.74265, lane: 1}, {lap: 2, arm: 'worm'}],
  },
  {
    name: 'Roadblock', track: 'dust', laps: 3,
    racers: ['mutt', 'rhonda', 'duke', 'sprocket', 'pip'],
    goal: [{ who: 'rhonda', behind: 'mutt' }],
    stock: [{ barrel: 3 }, { barrel: 2 }, {}],
    from: 'duke', ask: 'Rhonda’s been bumping Mother all season. I’d pay good money to see her eat the dog’s dust.',
    fresh: ['barrel'], par: 2, teach: [{ text: 'Barrels block a lane. A kart only crashes into them if it can’t swerve: the lane beside it is taken, or there isn’t one.' }, { text: 'Rhonda likes to drive right next to someone. Use that.' }],
    solution: [{lap: 1, place: 'barrel', s: 0.96324, lane: 2}, {lap: 2, place: 'barrel', s: 0.16912, lane: 2}],
  },
  {
    name: 'Boost Juice', track: 'dust', laps: 3,
    racers: ['duke', 'rhonda', 'mutt', 'sprocket', 'pip'],
    goal: [{ who: 'pip', top: 1 }],
    stock: [{ boost: 1 }, { boost: 1 }, { boost: 2 }],
    from: 'pip', ask: 'I’ve never won anything. Not even the egg and spoon.',
    fresh: ['boost'], par: 1, teach: [{ text: 'I go for <b>boost pads</b>. Always! The others only drive over one if it happens to be in their lane.' }],
    solution: [{lap: 1, place: 'boost', s: 0.09559, lane: 1}],
  },
  /* ---------- Scrapyard Gulch ---------- */
  {
    name: 'Short Cut', track: 'scrap', laps: 3,
    racers: ['granny', 'mutt', 'rhonda', 'duke', 'pip'],
    goal: [{ who: 'granny', top: 3 }],
    stock: [{ oil: 2 }, { oil: 1 }, {}],
    from: 'granny', ask: 'They all go through that dreadful tunnel. I won’t. My hip.',
    fresh: ['gate'], par: 1, teach: [{ text: 'Everyone but me takes the shortcut through the junk. Tap the <b>gate</b> to shut it. Shut, nobody can.' }, { text: 'And Duke still won’t steer round oil, dear.' }],
    solution: [{lap: 1, place: 'oil', s: 0.10119, lane: 0}, {lap: 1, gate: 'gate', open: false}],
  },
  {
    name: 'Grudge Match', track: 'scrap', laps: 3,
    lockGates: true, racers: ['duke', 'rhonda', 'mutt', 'pip', 'sprocket'],
    goal: [{ who: 'duke', place: -1 }],
    stock: [{ crate: 2 }, { crate: 1 }, { crate: 1 }],
    from: 'rhonda', ask: 'Give me something to throw at Duke. Anything. I’ll do the rest.',
    fresh: ['crate'], par: 1, teach: [{ text: 'A kart that drives through a <b>crate</b> gets something to use. Leaders get oil cans; the further back, the nastier the thing. Tap <b>?</b> for the list.' }, { text: 'Anything I get, I use on Duke: a rocket if he’s ahead of me, oil if he’s right behind. And the dog uses whatever he gets straight away.' }],
    solution: [{lap: 2, place: 'crate', path: 1, s: 0.46429, lane: 0}],
  },
  {
    name: 'Hang Time', track: 'scrap', laps: 3,
    racers: ['mutt', 'rhonda', 'duke', 'sprocket', 'pip'],
    goal: [{ who: 'sprocket', top: 1 }],
    stock: [{ magnet: 1 }, { magnet: 1 }, {}],
    from: 'sprocket', ask: 'BEEP. Victory subroutine has never run. Please test it. BEEP.',
    fresh: ['magnet'], par: 1, teach: [{ text: 'BEEP. The <b>magnet crane</b> lifts the next kart to pass right off the road for two seconds. There are two karts in front of me. BEEP.' }],
    solution: [{t: 0, arm: 'magnet'}, {t: 5.0833, gate: 'gate', open: false}, {t: 17.95, gate: 'gate', open: true}],
  },
  {
    name: 'Flat Out', track: 'scrap', laps: 3,
    racers: ['mutt', 'rhonda', 'duke', 'spike', 'sprocket', 'pip'],
    goal: [{ who: 'spike', top: 1 }],
    stock: [{ spikes: 2 }, { spikes: 1 }, {}],
    from: 'spike', ask: '…', fresh: ['spikes'], par: 1, teach: [{ text: '(Spike points at the <b>spike strips</b>. Then at his own spines. Then gives a thumbs up.)' }, { who: 'pip', text: 'He means spikes don’t bother him. And nobody can steer round anything in the one-lane shortcut!' }],
    solution: [{t: 0.4333, place: 'spikes', path: 1, s: 0.25, lane: 0}, {t: 4.25, gate: 'gate', open: false}, {t: 47.85, gate: 'gate', open: true}],
  },
  /* ---------- Rattlesnake Canyon ---------- */
  {
    name: 'Rolling Stone', track: 'canyon', laps: 4,
    racers: ['duke', 'rhonda', 'count', 'mutt', 'spike', 'pip'],
    goal: [{ who: 'duke', top: 2 }],
    stock: [{ boulder: 1 }, {}, { boulder: 1 }, { boulder: 1 }],
    from: 'duke', ask: 'Canyon’s too twisty for Mother. Get me a silver and the lemonade’s on me.',
    fresh: ['boulder'], par: 3, teach: [{ text: 'There’s a <b>boulder</b> up on that ledge. Arm it and it rolls across the road onto the next kart to pass, and flattens anyone right beside it.' }],
    solution: [{lap: 2, arm: 'boulder'}, {lap: 3, arm: 'boulder'}, {lap: 4, arm: 'boulder'}],
  },
  {
    name: 'Shiny and Chrome', track: 'canyon', laps: 4,
    racers: ['mutt', 'rhonda', 'duke', 'sprocket', 'count', 'pip'],
    goal: [{ who: 'pip', top: 1 }],
    stock: [{ skull: 1 }, { skull: 1, barrel: 2 }, {}, { skull: 1 }],
    from: 'pip', ask: 'The shiny skulls make you go SO fast. Can I win? Can I? Can I?',
    fresh: ['skull'], par: 3, teach: [{ text: 'A <b>chrome skull</b> makes the next kart through super fast, and nothing can hurt it for a few seconds. I go for them every time!' }, { text: 'A chrome kart smashes straight through barrels, too. Everybody else just crashes.' }],
    solution: [{lap: 1, place: 'skull', s: 0.39634, lane: 2}, {lap: 2, place: 'barrel', s: 0.54268, lane: 0}, {lap: 3, place: 'barrel', s: 0.5061, lane: 0}],
  },
  {
    name: 'Minefield', track: 'canyon', laps: 4,
    racers: ['mutt', 'sprocket', 'rhonda', 'granny', 'pip'],
    goal: [{ who: 'mutt', place: -1 }, { who: 'granny', top: 3 }],
    stock: [{ mine: 2 }, { mine: 1 }, { mine: 1 }, {}],
    from: 'count', ask: 'That dog chewed my cape, and the old lady mended it. The dog last. The lady on the podium. Simple.',
    fresh: ['mine'], par: 2, teach: [{ text: 'A <b>mine</b> throws the next kart over it into the air. They see mines, and swerve, if they can.' }, { text: 'On the rope bridge there is only one lane. Nowhere to swerve. Delicious.' }],
    solution: [{lap: 1, place: 'mine', s: 0.43293, lane: 1}, {lap: 2, place: 'mine', s: 0.55488, lane: 0}],
  },
  /* ---------- Refinery Row ---------- */
  {
    name: 'Clean Sweep', track: 'refinery', laps: 5,
    racers: [{ who: 'count', item: 'rocket' }, { who: 'sprocket', item: 'rocket' }, 'mutt', 'rhonda'],
    goal: [{ who: 'count', place: -1 }],
    stock: [{ barrel: 2 }, { barrel: 1, oil: 1 }, { barrel: 1 }, {}, {}],
    from: 'granny', ask: 'That Count shoots at everything you put in his way. Rude. I want him last, dear.',
    fresh: [], par: 3, teach: [{ text: 'The Count and that robot each have a <b>rocket</b>, and they shoot it at anything you leave in their lane.' }, { text: 'They only have the one each. Make them waste it.' }],
    solution: [{lap: 1, gate: 'gate', open: false}, {lap: 2, place: 'barrel', s: 0.16875, lane: 2}, {lap: 3, place: 'oil', s: 0.55625, lane: 1}, {lap: 4, place: 'barrel', s: 0.60625, lane: 2}],
  },
  {
    name: 'Flare Up', track: 'refinery', laps: 5,
    racers: ['rhonda', 'duke', 'mutt', 'sprocket', 'granny', 'spike'],
    goal: [{ who: 'granny', top: 2 }],
    stock: [{ flare: 1 }, { flare: 1, spikes: 1 }, { flare: 1, spikes: 1 }, { flare: 1 }, { flare: 1 }],
    from: 'pip', ask: 'Granny gives me toffees whenever she gets a medal. A gold or a silver. The bronze ones don’t count.',
    fresh: ['flare'], par: 4, teach: [{ text: 'That chimney’s a <b>flare stack</b>! Arm it and it breathes fire over the road as the next kart passes. Everyone under it spins out.' }, { text: 'And Granny never takes the shortcut, remember.' }],
    solution: [{lap: 1, gate: 'gate', open: false}, {lap: 2, arm: 'flare'}, {lap: 3, arm: 'flare'}, {lap: 3, place: 'spikes', s: 0.30625, lane: 0}, {lap: 4, arm: 'flare'}],
  },
  {
    name: 'The Big Fix', track: 'refinery', laps: 5,
    racers: ['duke', 'mutt', 'rhonda', 'count', 'pip', 'granny'],
    goal: [{ who: 'granny', top: 1 }, { who: 'duke', place: -1 }],
    stock: [{ oil: 1, barrel: 1, flare: 1 }, { mine: 1, flare: 1 }, { boost: 1, flare: 1 }, { skull: 1, flare: 1 }, { oil: 1, flare: 1 }],
    from: 'granny', ask: 'It’s my birthday, dear. Me first, and that Dieselbottom boy dead last. Is that so much to ask?',
    fresh: [], par: 7, teach: [{ text: 'Everything you’ve learned, dear. All of it. Go.' }],
    solution: [{lap: 1, arm: 'flare'}, {lap: 1, gate: 'gate', open: false}, {lap: 2, place: 'barrel', path: 1, s: 0.53571, lane: 0}, {lap: 2, gate: 'gate', open: true}, {lap: 3, place: 'boost', s: 0.63125, lane: 2}, {lap: 4, place: 'oil', path: 1, s: 0.75, lane: 0}, {lap: 4, arm: 'flare'}, {lap: 4, place: 'skull', s: 0.10625, lane: 1}, {lap: 5, place: 'mine', path: 1, s: 0.82143, lane: 0}],
  },
];
