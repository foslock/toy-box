// Rigged Racer: who races, what they're like, and what can be put on the road. Shared by the race (sim.js), the page
// and check.mjs.

// The drivers. speed: top speed on a straight (units a second); acc: how quickly they get back up to it; grip: how
// little the bends slow them (0 to 1); sight: how far ahead they see trouble; lat: how fast they change lanes (lanes
// a second); weight: who shoves whom.
export const RACERS = {
  duke: { name: 'Duke Dieselbottom', short: 'Duke', color: '#d23a2c', speed: 10.9, acc: 3.0, grip: .15, sight: 7, lat: 1.5, weight: 3, traits: ['reckless', 'bully'],
    blurb: 'Drives a monster truck called Mother. Never brakes, and never steers round anything smaller than a barrel.' },
  pip: { name: 'Pip', short: 'Pip', color: '#27a7b8', speed: 9.6, acc: 7.0, grip: .92, sight: 10, lat: 3.0, weight: 1, traits: ['greedy'],
    blurb: 'Nine years old, in a bathtub with an engine. Quick through the bends, and can’t resist anything shiny.' },
  granny: { name: 'Granny Gasket', short: 'Granny', color: '#9a5cc8', speed: 10.0, acc: 4.4, grip: .6, sight: 15, lat: 2.0, weight: 1.6, traits: ['cautious', 'hoarder'],
    blurb: 'Ninety-one, in an armchair with a jet engine on the back. Sees trouble coming a mile off.' },
  mutt: { name: 'Mutt', short: 'Mutt', color: '#e7a92a', speed: 10.05, acc: 5.6, grip: .62, sight: 9, lat: 2.6, weight: 1.2, traits: ['trigger'],
    blurb: 'A very good boy in a dune buggy. Uses whatever he picks up, straight away.' },
  sprocket: { name: 'Sprocket', short: 'Sprocket', color: '#3d72b8', speed: 10.1, acc: 5.0, grip: .55, sight: 12, lat: 2.3, weight: 1.8, traits: ['sweeper'],
    blurb: 'A robot on a motorbike with a sidecar full of spanners. Shoots at anything you leave in its lane.' },
  rhonda: { name: 'Rhonda Rust', short: 'Rhonda', color: '#f27a22', speed: 10.6, acc: 4.2, grip: .42, sight: 9, lat: 2.0, weight: 2, traits: ['rival:duke'],
    blurb: 'A hot rod with flames down the side and a grudge. Every rocket she gets has Duke’s name on it.' },
  spike: { name: 'Spike', short: 'Spike', color: '#4f9e3c', speed: 9.8, acc: 5.2, grip: .78, sight: 8, lat: 2.4, weight: 1.3, traits: ['prickly'],
    blurb: 'A cactus in a flowerpot kart. Doesn’t say much.' },
  count: { name: 'Count Chrome', short: 'Count', color: '#6c7380', speed: 10.4, acc: 4.0, grip: .5, sight: 11, lat: 1.9, weight: 2.2, traits: ['sweeper', 'hoarder'],
    blurb: 'A vampire in a chrome hearse, in sunglasses, because of the sun.' },
};
export const RACER_IDS = Object.keys(RACERS);

// What their ways mean, said once for the racer cards.
export const TRAITS = {
  reckless: { name: 'Reckless', text: 'Always takes an open shortcut, and only steers round barrels and rubble.' },
  bully: { name: 'Bully', text: 'Shoves lighter karts out of his lane.' },
  greedy: { name: 'Greedy', text: 'Swerves for crates, chrome skulls and boost pads.' },
  cautious: { name: 'Cautious', text: 'Sees trouble far ahead, and never takes a shortcut.' },
  hoarder: { name: 'Hoarder', text: 'Saves items for the last lap.' },
  trigger: { name: 'Trigger-happy', text: 'Uses items the moment he gets them.' },
  sweeper: { name: 'Sweeper', text: 'Fires rockets at your traps in its lane.' },
  rival: { name: 'Grudge', text: 'Saves rockets and oil for {who}.' },
  prickly: { name: 'Prickly', text: 'Spike strips don’t slow him down.' },
};
export function traitInfo(t) {
  const [k, arg] = t.split(':'), d = TRAITS[k];
  return { key: k, name: d.name, text: d.text.replace('{who}', arg ? RACERS[arg].short : '') };
}
export const has = (who, trait) => RACERS[who].traits.some(t => t === trait || t.startsWith(trait + ':'));
export const rivalOf = who => { const t = RACERS[who].traits.find(t => t.startsWith('rival:')); return t ? t.slice(6) : null; };

// What the player can put on the road, and the track's own traps they can set off. Each lap brings more.
export const PLACE = {
  oil: { short: 'Oil', name: 'Oil slick', text: 'Spins out the next two karts over it.', color: '#3a3346' },
  spikes: { short: 'Spikes', name: 'Spike strip', text: 'Gives the next kart over it a flat tyre, slow for a few seconds.', color: '#8b8f98' },
  barrel: { short: 'Barrels', name: 'Barrels', text: 'Blocks its lane. A kart that can’t steer round crashes and stops dead.', color: '#d24a2e' },
  mine: { short: 'Mine', name: 'Mine', text: 'Blows the next kart over it into the air.', color: '#5d6b3a' },
  boost: { short: 'Boost', name: 'Boost pad', text: 'Every kart over it gets a burst of speed. Stays all race.', color: '#f2a516' },
  ramp: { short: 'Ramp', name: 'Ramp', text: 'Every kart over it jumps, clearing what’s just beyond. Stays all race.', color: '#b77a3e' },
  crate: { short: 'Crate', name: 'Crate', text: 'The next kart through gets an item, chosen by its place.', color: '#a8692e' },
  skull: { short: 'Skull', name: 'Chrome skull', text: 'The next kart through goes chrome: faster, and it smashes through anything.', color: '#b8c4d0' },
};
export const TRAPS = {
  worm: { short: 'Worm', name: 'Sandworm', text: 'Arm it, and it swallows the next kart to pass. Spits it out a couple of seconds later.' },
  magnet: { short: 'Magnet', name: 'Magnet crane', text: 'Arm it, and it lifts the next kart to pass off the road for a couple of seconds.' },
  boulder: { short: 'Boulder', name: 'Boulder', text: 'Arm it, and it rolls across the road onto the next kart to pass, flattening anything beside it too.' },
  flare: { short: 'Flare', name: 'Flare stack', text: 'Arm it, and it belches fire over the road as the next kart passes, spinning out everyone under it.' },
  gate: { short: 'Gate', name: 'Shortcut gate', text: 'Open or shut the shortcut. Shut, nobody can take it.' },
};
export const PLACE_IDS = Object.keys(PLACE), TRAP_IDS = ['worm', 'magnet', 'boulder', 'flare'];

// What the karts pick up from crates: the further back, the better.
export const KART_ITEMS = {
  oil: { name: 'Oil can', text: 'Pours an oil slick behind.' },
  rocket: { name: 'Rocket', text: 'Flies straight down its lane and blows up the first thing it meets.' },
  nitro: { name: 'Nitro', text: 'A burst of speed.' },
  homing: { name: 'Homing rocket', text: 'Chases down the kart one place ahead.' },
  chrome: { name: 'Chrome', text: 'Goes chrome for a few seconds: faster, and nothing can hurt it.' },
  vulture: { name: 'Vulture', text: 'A vulture flies to whoever’s leading and drops a bomb on them.' },
};
export const CRATE_TABLE = ['oil', 'rocket', 'nitro', 'homing', 'chrome', 'vulture'];
// the item a crate gives the kart in place `rank` (1 is first) of n
export function crateItem(rank, n) { return CRATE_TABLE[n <= 1 ? 0 : Math.round((rank - 1) * (CRATE_TABLE.length - 1) / (n - 1))]; }
