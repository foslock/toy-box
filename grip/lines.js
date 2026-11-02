// The guide: a dry, calm voice that has seen a lot of people fall off this route.

export const LINES = {
  tutDone: ['That’s the whole technique. Falling costs you nothing but height. The route goes up from here.'],
  crimp: 'A crimp. Small edges tire the fingers quickly, so don’t hang about on one.',
  crumble: 'This band is rotten. The pale holds crumble if you rest your weight on them for long.',
  crumbled: 'It crumbled. They grow back, in a manner of speaking, but not while you’re next to them.',
  lunge: 'You caught the lunge. Most people don’t, the first time. Or the eighth.',
  lungeHint: 'Nothing in reach: this is the lunge. Put both hands on the top hold, hang low, then pull down hard with both thumbs and let go at the top. Thumbs straight back down, and grab.',
  rope: 'The fisherman’s rope. Swing it by sliding your thumb side to side. Let go at the top of a swing.',
  rung: 'The keeper’s ladder. Some of the rungs went for firewood in the winter of 1963.',
  cliffTop: 'The cliff top. Have a sit down. The lighthouse is next; it was decommissioned in 1974 and has since been climbed by nobody sensible.',
  lighthouse: 'Iron and whitewash. The sills are small, the rungs are good, and the gaps are where you’d expect them least.',
  gallery: 'The gallery. Lean on the railing and get your breath back.',
  mast: 'The Admiralty bolted a radio mast to the dome in 1952. Nobody asked the lighthouse. Mind the wind.',
  gust: 'Gusts come in off the sea, and you’ll hear them first. Two hands on, and wait them out.',
  slip: 'Your grip gave out. Hanging on one hand drains it. Two hands, or a ledge, give it back.',
  slipAgain: ['Your fingers have opened, apparently without consulting you.', 'The ring ran out. It does that.', 'Gripped out. Shake out on two hands next time.'],
  rip: 'You caught it. Briefly. At that speed nobody holds on.',
  ripAgain: ['Too fast to hold. The hold remains where it was.', 'A brave grab. Physics declined.'],
  fallSmall: [
    'A short fall. The rock was unmoved.',
    'Down a little. The guide recommends up.',
    'That counts as a fall. Barely.',
    'You have returned to a previous height.',
    'Gravity, as described on page one.',
  ],
  fallMid: [
    'That was most of a pitch.',
    'Some climbers find it helps to hold on.',
    'You covered that section faster on the way down.',
    'A quick descent. Not recommended, but very popular.',
    'The rock will be here when you come back up.',
    'There is a ledge below every mistake. Usually.',
    'You may now repeat the last few minutes, with feeling.',
  ],
  fallBig: [
    'That was a lot of the route.',
    'The last keeper once fell that far. He took up bowls.',
    'From here the view is of everything you’ve already done.',
    'Take a moment. The route isn’t going anywhere. Neither, now, are you.',
    'Nobody saw. Except the gulls. The gulls saw.',
    'A long way down. Everything you learned on the way up is still yours.',
  ],
  beach: [
    'Back on the beach. The tide has been very patient.',
    'Sand. A soft place to reconsider.',
    'The beach again. The boulder remembers you.',
    'All the way down. The first holds are just where you left them.',
  ],
  summit: 'The top of the mast, eighty metres up. There is nothing above you now but weather.',
  summitClean: 'The top of the mast, without a single fall. The guide has nothing dry to say about that.',
  summitHard: 'The top of the mast. It took a while, and a great deal of falling. That is the usual way.',
};

let lastPick = '';
export function pick(list) {
  let s; do { s = list[Math.random() * list.length | 0]; } while (list.length > 1 && s === lastPick);
  lastPick = s; return s;
}
