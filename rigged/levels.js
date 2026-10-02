// Rigged Racer: the races to fix. Each names its track and laps, the racers on the grid (pole first), the goal, what
// the player gets at the start of each lap, who's asking and why, and a way to do it (check.mjs plays that through to
// prove the race can be fixed, and that it isn't fixed already).
//
// Goals: { who, place } (exactly that place; -1 is last), { who, top }, { who, ahead: other }, { who, behind: other }.
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
    solution: [{lap: 2, place: 'oil', s: 0.88971, lane: 2}],
  },
  {
    name: 'Roadblock', track: 'dust', laps: 3,
    racers: ['mutt', 'rhonda', 'duke', 'sprocket', 'pip'],
    goal: [{ who: 'rhonda', behind: 'duke' }],
    stock: [{ barrel: 2 }, { barrel: 1 }, {}],
    from: 'duke', ask: 'Rhonda’s been bumping Mother all season. I just want to beat her once. Don’t tell her it was me.',
    fresh: ['barrel'], par: 1, teach: [{ text: 'Barrels block a lane. A kart only crashes into them if it can’t swerve: the lane beside it is taken, or there isn’t one.' }, { text: 'Rhonda likes to drive right next to someone. Use that.' }],
    solution: [{lap: 3, place: 'barrel', s: 0.80147, lane: 2}],
  },
  {
    name: 'Worm Food', track: 'dust', laps: 3,
    racers: ['rhonda', 'duke', 'mutt', 'pip', 'granny', 'sprocket'],
    goal: [{ who: 'pip', top: 3 }],
    stock: [{ worm: 1, oil: 1 }, { worm: 1 }, { worm: 1 }],
    from: 'pip', ask: 'If I get on the podium Mum says I can keep the bathtub.',
    fresh: ['worm'], par: 2, teach: [{ text: 'There’s a <b>sandworm</b> under the track! Tap its button to arm it. It eats the next kart to drive past.' }, { text: 'Pause the race just before the kart you want gets there, then arm it. You get one worm a lap.' }],
    solution: [{lap: 1, place: 'oil', s: 0.05147, lane: 1}, {lap: 2, arm: 'worm'}],
  },
  {
    name: 'Boost Juice', track: 'dust', laps: 3,
    racers: ['duke', 'rhonda', 'mutt', 'sprocket', 'pip'],
    goal: [{ who: 'pip', top: 1 }],
    stock: [{ boost: 2 }, { boost: 2 }, { boost: 1 }],
    from: 'pip', ask: 'I’ve never won anything. Not even the egg and spoon.',
    fresh: ['boost'], par: 2, teach: [{ text: 'I go for <b>boost pads</b>. Always! The others only drive over one if it happens to be in their lane.' }],
    solution: [{lap: 1, place: 'boost', s: 0.71324, lane: 1}, {lap: 2, place: 'boost', s: 0.06618, lane: 2}],
  },
  /* ---------- Scrapyard Gulch ---------- */
  {
    name: 'Short Cut', track: 'scrap', laps: 3,
    racers: ['granny', 'mutt', 'rhonda', 'duke', 'pip'],
    goal: [{ who: 'granny', top: 3 }],
    stock: [{ oil: 1 }, { oil: 1 }, {}],
    from: 'granny', ask: 'They all go through that dreadful tunnel. I won’t. My hip.',
    fresh: ['gate'], par: 1, teach: [{ text: 'Everyone but me takes the shortcut through the junk. Tap the <b>gate</b> to shut it. Shut, nobody can.' }, { text: 'And Duke still won’t steer round oil, dear.' }],
    solution: [{lap: 1, place: 'oil', s: 0.22024, lane: 0}, {lap: 1, gate: 'gate', open: false}],
  },
  {
    name: 'Grudge Match', track: 'scrap', laps: 3,
    racers: ['duke', 'mutt', 'pip', 'rhonda', 'sprocket'],
    goal: [{ who: 'duke', place: -1 }],
    stock: [{ crate: 2 }, { crate: 1 }, { crate: 1 }],
    from: 'rhonda', ask: 'Give me something to throw at Duke. Anything. I’ll do the rest.',
    fresh: ['crate'], par: 1, teach: [{ text: 'A kart that drives through a <b>crate</b> gets something to use. The further back it is, the nastier the thing. Tap <b>?</b> to see the list.' }, { text: 'Anything I get, I use on Duke. Get me a crate when he’s ahead of me.' }],
    solution: [{lap: 1, place: 'crate', s: 0.83929, lane: 2}],
  },
  {
    name: 'Hang Time', track: 'scrap', laps: 3,
    racers: ['mutt', 'rhonda', 'duke', 'sprocket', 'pip'],
    goal: [{ who: 'mutt', place: -1 }],
    stock: [{ magnet: 1 }, { magnet: 1 }, { magnet: 1 }],
    from: 'sprocket', ask: 'BEEP. The dog keeps using my wheels as a lamp post. Request: dog in last place. BEEP.',
    fresh: ['magnet'], par: 1, teach: [{ text: 'BEEP. The <b>magnet crane</b> lifts the next kart to pass right off the road for two seconds. BEEP.' }],
    solution: [{lap: 2, arm: 'magnet'}, {lap: 2, gate: 'gate', open: false}],
  },
  {
    name: 'Flat Out', track: 'scrap', laps: 3,
    racers: ['mutt', 'rhonda', 'duke', 'spike', 'sprocket', 'pip'],
    goal: [{ who: 'spike', top: 1 }],
    stock: [{ spikes: 2 }, { spikes: 1 }, { spikes: 1 }],
    from: 'spike', ask: '…', fresh: ['spikes'], par: 1, teach: [{ text: '(Spike points at the <b>spike strips</b>. Then at his own spines. Then gives a thumbs up.)' }, { who: 'pip', text: 'He means spikes don’t bother him. And nobody can steer round anything in the one-lane shortcut!' }],
    solution: [{lap: 1, place: 'spikes', path: 1, s: 0.25, lane: 0}, {lap: 2, gate: 'gate', open: false}],
  },
  /* ---------- Rattlesnake Canyon ---------- */
  {
    name: 'Minefield', track: 'canyon', laps: 4,
    racers: ['mutt', 'sprocket', 'rhonda', 'granny', 'pip'],
    goal: [{ who: 'mutt', place: -1 }],
    stock: [{ mine: 1 }, { mine: 1 }, { mine: 1 }, {}],
    from: 'count', ask: 'That dog chewed my cape. I would like him to come last. Last, and sad.',
    fresh: ['mine'], par: 2, teach: [{ text: 'A <b>mine</b> throws the next kart over it into the air. They see mines, and swerve, if they can.' }, { text: 'On the rope bridge there is only one lane. Nowhere to swerve. Delicious.' }],
    solution: [{lap: 1, place: 'mine', s: 0.5061, lane: 0}, {lap: 4, place: 'mine', s: 0.56707, lane: 1}],
  },
  {
    name: 'Rolling Stone', track: 'canyon', laps: 4,
    racers: ['duke', 'rhonda', 'count', 'mutt', 'spike', 'pip'],
    goal: [{ who: 'duke', top: 3 }],
    stock: [{ boulder: 1 }, { boulder: 1 }, { boulder: 1 }, { boulder: 1 }],
    from: 'duke', ask: 'Canyon’s too twisty for Mother. Get me on the podium and the lemonade’s on me.',
    fresh: ['boulder'], par: 2, teach: [{ text: 'There’s a <b>boulder</b> up on that ledge. Arm it and it rolls across the road onto the next kart to pass, and flattens anyone right beside it.' }],
    solution: [{t: 24.6667, arm: 'boulder'}, {t: 52.7333, arm: 'boulder'}],
  },
  {
    name: 'Shiny and Chrome', track: 'canyon', laps: 4,
    racers: ['mutt', 'rhonda', 'duke', 'sprocket', 'count', 'pip'],
    goal: [{ who: 'pip', top: 2 }],
    stock: [{ skull: 1 }, { skull: 1 }, { skull: 1 }, { skull: 1 }],
    from: 'pip', ask: 'The shiny skulls make you go SO fast. Can I have one? Can I have two?',
    fresh: ['skull'], par: 1, teach: [{ text: 'A <b>chrome skull</b> makes the next kart through super fast, and nothing can hurt it for a few seconds! I go for them every time.' }],
    solution: [{t: 51.5833, place: 'skull', s: 0.57927, lane: 2}],
  },
  /* ---------- Refinery Row ---------- */
  {
    name: 'Clean Sweep', track: 'refinery', laps: 5,
    racers: ['count', 'sprocket', 'mutt', 'granny', 'rhonda'],
    goal: [{ who: 'count', place: -1 }],
    stock: [{ barrel: 2 }, { barrel: 1, oil: 1 }, { barrel: 1 }, { oil: 1 }, {}],
    from: 'granny', ask: 'That Count shoots at everything in his way. Rude. Teach him some manners.',
    fresh: [], par: 3, teach: [{ text: 'The Count and that robot <b>shoot</b> at anything you leave in their lane, if they’ve got a rocket. The Count keeps his for the last lap.' }, { text: 'The refinery puts out its own row of crates, too. Mind what they hand out.' }],
    solution: [{lap: 3, gate: 'gate', open: false}, {lap: 4, place: 'barrel', s: 0.95625, lane: 1}, {lap: 4, place: 'oil', s: 0.70625, lane: 1}, {lap: 4, gate: 'gate', open: true}, {lap: 5, place: 'oil', s: 0.55625, lane: 1}],
  },
  {
    name: 'Flare Up', track: 'refinery', laps: 5,
    racers: ['rhonda', 'duke', 'mutt', 'sprocket', 'granny', 'spike'],
    goal: [{ who: 'granny', top: 3 }],
    stock: [{ flare: 1 }, { flare: 1, spikes: 1 }, { flare: 1 }, { flare: 1, spikes: 1 }, { flare: 1 }],
    from: 'pip', ask: 'Granny gives me toffees whenever she wins anything. Anything at all.',
    fresh: ['flare'], par: 3, teach: [{ text: 'That chimney’s a <b>flare stack</b>! Arm it and it breathes fire over the road as the next kart passes. Everyone under it spins out.' }],
    solution: [{lap: 1, gate: 'gate', open: false}, {lap: 2, arm: 'flare'}, {lap: 2, gate: 'gate', open: true}, {lap: 3, arm: 'flare'}, {lap: 4, arm: 'flare'}],
  },
  {
    name: 'The Big Fix', track: 'refinery', laps: 5,
    racers: ['duke', 'mutt', 'rhonda', 'sprocket', 'count', 'pip', 'granny', 'spike'],
    goal: [{ who: 'granny', top: 1 }, { who: 'duke', place: -1 }],
    stock: [{ oil: 1, barrel: 1, flare: 1 }, { mine: 1, flare: 1 }, { boost: 1, flare: 1 }, { skull: 1, flare: 1 }, { oil: 1, flare: 1 }],
    from: 'granny', ask: 'It’s my birthday, dear. Me first, and that Dieselbottom boy dead last. Is that so much to ask?',
    fresh: [], par: 7, teach: [{ text: 'Everything you’ve learned, dear. All of it. Go.' }],
    solution: [{lap: 1, place: 'barrel', s: 0.85625, lane: 0}, {lap: 1, arm: 'flare'}, {lap: 2, arm: 'flare'}, {lap: 2, gate: 'gate', open: false}, {lap: 3, place: 'boost', s: 0.38125, lane: 1}, {lap: 3, gate: 'gate', open: true}, {lap: 4, place: 'mine', s: 0.93125, lane: 2}, {lap: 4, gate: 'gate', open: false}, {lap: 5, place: 'oil', path: 1, s: 0.89286, lane: 0}, {lap: 5, place: 'oil', s: 0.81875, lane: 1}],
  },
];
