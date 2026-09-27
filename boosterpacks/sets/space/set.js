// Series 3: Outer Space. Fifty things from up there: rockets and shuttles, satellites and stations, the gear astronauts
// wear, the planets, the stars and the rocks in between. Its packs cost $8.99, 1.8 times an Around the House pack, and
// its values are scaled to match: commons up to $1.41, uncommons up to about $17, rares anything up to a $2,700 black
// hole. It unlocks once a player has found three quarters of Backyard: 38 different Backyard cards in their binder.
import { TYPES, planet, circuit, wrapperArt } from './types.js';

// [id, name, type, rarity, card value in dollars, [move, power, move text], flavor text, size line]
const LIST = [
  // ---- commons ----
  ['redbutton', 'Big Red Button', 'launch', 'C', 0.18, ['Launch', 10, 'Press it. Somewhere, something takes off.'], 'The label says DO NOT PRESS. Everyone presses.', 'W 4 in · 1 button'],
  ['waterrocket', 'Water Rocket', 'launch', 'C', 0.45, ['Pressurize', 20, 'Pump it 20 times. Everyone within 10 feet is Soaked.'], 'A soda bottle, three fins and more ambition than water.', '2 L bottle · 60 psi'],
  ['modelrocket', 'Model Rocket', 'launch', 'C', 1.22, ['Parachute Recovery', 20, 'Flip a coin. Heads: it floats back to you. Tails: it lands in a tree.'], 'Goes up in two seconds. Takes the rest of the afternoon to find.', 'HT 20 in · 1 motor'],
  ['dish', 'Satellite Dish', 'orbit', 'C', 0.09, ['Channel Surf', 10, 'Look at the top card of your deck. Nothing good is on.'], 'Catches 500 channels from space. The remote is still missing.', 'Ø 30 in · 500 channels'],
  ['cubesat', 'CubeSat', 'orbit', 'C', 0.32, ['Hitchhike', 10, 'This item rides along with your next Launch item for free.'], 'Built by students and launched on somebody else’s rocket.', '4 in cube · 3 lb'],
  ['satellite', 'Weather Satellite', 'orbit', 'C', 0.77, ['Forecast', 20, 'Look at the top 3 cards of your opponent’s deck. Rain is likely.'], 'Sees every storm coming. Still gets blamed for them.', 'L 15 ft · 2 solar wings'],
  ['spacepen', 'Space Pen', 'crew', 'C', 0.22, ['Write Upside Down', 10, 'Draw 1 card. It works from any direction.'], 'Writes upside down, underwater and in zero gravity. Mostly used for crosswords.', 'L 3.75 in · pressurized ink'],
  ['icecream', 'Astronaut Ice Cream', 'crew', 'C', 0.39, ['Freeze-Dried', 10, 'Heal 10 damage. It crunches.'], 'Neapolitan, crunchy and hardly ever eaten in space. Kids love it anyway.', '1 oz · 3 flavors'],
  ['patch', 'Mission Patch', 'crew', 'C', 0.58, ['Crew Spirit', 20, 'Each of your Crew items gets 10 more power this turn.'], 'Every crew designs its own. Every crew argues about the colors.', 'Ø 4 in · embroidered'],
  ['moonboot', 'Moon Boot', 'crew', 'C', 1.41, ['One Small Step', 20, 'Leave a footprint on this card. It stays there forever.'], 'There’s no wind on the Moon, so its footprints will still be there in a million years.', 'Size 11 · silicone sole'],
  ['pluto', 'Pluto', 'worlds', 'C', 0.05, ['Still Counts', 10, 'If your opponent says this isn’t a planet, do 40 damage.'], 'Small, far away and has a big heart on its face. Still a planet to us.', 'Ø 1,477 mi · 5 moons'],
  ['phobos', 'Phobos', 'worlds', 'C', 0.26, ['Tumble', 10, 'Flip a coin. Heads: this item dodges. Tails: it’s still a potato.'], 'Mars’s little moon, shaped like a potato and slowly falling in.', 'L 17 mi · 7 hr 39 min orbit'],
  ['neptune', 'Neptune', 'worlds', 'C', 0.90, ['Supersonic Winds', 20, 'Blow 1 item back into your opponent’s hand.'], 'Deep blue, freezing cold and home to the fastest winds anywhere.', 'Ø 30,599 mi · 165-year orbit'],
  ['glowstars', 'Glow-in-the-Dark Stars', 'stars', 'C', 0.08, ['Night Light', 10, 'Your items can attack in the dark. For about ten minutes.'], 'The closest stars to your bed. They glow for ten minutes, then you’re on your own.', '24 stickers · 1 ceiling'],
  ['shootingstar', 'Shooting Star', 'stars', 'C', 0.51, ['Make a Wish', 20, 'Name a card. If it’s the top card of your deck, put it in your hand.'], 'Just a grain of dust burning up. Make the wish anyway.', 'Grain of dust · 50 mi up'],
  ['stargazer', 'Backyard Telescope', 'stars', 'C', 1.09, ['Stargaze', 20, 'Look at the top 2 cards of your deck. Put them back in any order.'], 'Point it at the Moon first. Everyone gasps, every time.', 'L 3 ft · 50× zoom'],
  ['asteroid', 'Asteroid', 'rocks', 'C', 0.13, ['Near Miss', 10, 'Flip a coin. Heads: it misses. Tails: it misses, but closer.'], 'A leftover lump from when the planets were being made.', 'L 1,600 ft · 4.6 billion yr'],
  ['stardust', 'Stardust', 'rocks', 'C', 0.04, ['Sparkle', 10, 'The next card you play this turn glitters.'], 'Everything you’re made of was once inside a star. This is some of the leftovers.', '1 vial · older than the Sun'],
  ['spacejunk', 'Space Junk', 'rocks', 'C', 0.10, ['Orbital Debris', 10, 'Put this card on your opponent’s bench. It’s their problem now.'], 'A spare glove floated off in 1965. It wasn’t the last thing to get away.', 'L 10 in · 17,500 mph'],
  // ---- uncommons ----
  ['retrorocket', 'Retro Rocket', 'launch', 'U', 3.09, ['Blast Off', 40, 'Move this item to the Moon. Bring a sandwich.'], 'Three fins, one porthole and a paint job straight out of 1955.', 'HT 12 in · pressed tin'],
  ['capsule', 'Return Capsule', 'launch', 'U', 9.90, ['Splashdown', 50, 'Prevent all damage done to this item this turn. It lands in the ocean.'], 'Came home at 25,000 mph wearing its heat shield like a hat.', 'Ø 13 ft · 3 seats'],
  ['lander', 'Lunar Lander', 'launch', 'U', 17.11, ['The Eagle Has Landed', 60, 'Put this item on the Moon. It can’t be moved until it takes off.'], 'Wrapped in gold foil and thinner than it looks. You could dent it with a pencil.', 'HT 23 ft · 4 legs'],
  ['sputnik', 'Sputnik', 'orbit', 'U', 1.80, ['Beep', 30, 'Your opponent can’t play Orbit items next turn. They’re too busy listening.'], 'A shiny ball with four whiskers that went beep and changed everything.', 'Ø 23 in · 4 antennas'],
  ['probe', 'Deep Space Probe', 'orbit', 'U', 5.66, ['Grand Tour', 50, 'Look at every card in your opponent’s deck. Then shuffle it.'], 'Left home in 1977, and it’s still sending postcards.', 'Dish Ø 12 ft · 15 billion mi out'],
  ['solarsail', 'Solar Sail', 'orbit', 'U', 2.70, ['Catch the Light', 40, 'This item moves first next turn. Sunlight is pushing.'], 'A mirror thinner than a hair, sailing on sunshine.', 'W 30 ft · thinner than a hair'],
  ['helmet', 'Space Helmet', 'crew', 'U', 7.85, ['Gold Visor', 40, 'Prevent all damage from Stars items this turn.'], 'The visor is coated in real gold, to keep the Sun out of your eyes.', 'Ø 13 in · gold visor'],
  ['jetpack', 'Jetpack', 'crew', 'U', 14.40, ['Untethered', 60, 'Move this item anywhere. No rope, no problem.'], 'Twenty-four little jets and a very steady hand.', 'HT 4 ft · 24 thrusters'],
  ['robonaut', 'Robot Astronaut', 'crew', 'U', 3.99, ['Double Shift', 40, 'Your Crew items can’t be damaged while this item is in play.'], 'Works outside all day, never needs air and never laughs at your jokes.', 'HT 3 ft 4 in · 330 lb'],
  ['moonbuggy', 'Moon Buggy', 'crew', 'U', 6.56, ['Joyride', 50, 'Move this item and 2 friends. Top speed: 11 mph.'], 'Folded up like a lawn chair for the trip, then drove across the Moon.', 'L 10 ft · 4 wire wheels'],
  ['moon', 'The Moon', 'worlds', 'U', 1.03, ['High Tide', 30, 'Move every item in play one space. The oceans follow.'], 'Always shows us the same face. We never get tired of it.', 'Ø 2,159 mi · 239,000 mi away'],
  ['mars', 'Mars', 'worlds', 'U', 2.32, ['Dust Storm', 40, 'Every item in play is Dusty. Nobody can see.'], 'Red with rust, and home to the tallest volcano we know of.', 'Ø 4,212 mi · 2 moons'],
  ['jupiter', 'Jupiter', 'worlds', 'U', 11.06, ['Great Red Spot', 60, 'Do 20 more damage for every turn this storm has lasted.'], 'Could hold a thousand Earths, and it has had the same storm for 350 years.', 'Ø 86,881 mi · 90+ moons'],
  ['orrery', 'Orrery', 'worlds', 'U', 12.60, ['Clockwork Planets', 50, 'Put the top 5 cards of your deck back in any order.'], 'Turn the crank and every planet goes round, right on schedule.', 'Ø 20 in · solid brass'],
  ['pulsar', 'Pulsar', 'stars', 'U', 4.76, ['Lighthouse', 50, 'Flip 3 coins. Do 20 damage for each heads.'], 'A dead star the size of a city, spinning 700 times a second and flashing like a lighthouse.', 'Ø 12 mi · 700 spins a second'],
  ['constellation', 'Big Dipper', 'stars', 'U', 1.29, ['Connect the Dots', 30, 'Draw a card for each of your Stars items in play.'], 'Seven bright stars that have pointed travelers north for thousands of years.', '7 stars · 80 to 124 light-years'],
  ['meteorite', 'Iron Meteorite', 'rocks', 'U', 8.87, ['Fireball', 60, 'Do 30 damage to 2 of your opponent’s items. It came in hot.'], 'Fell out of the sky as a fireball. Now it holds papers down on a desk.', 'L 8 in · 22 lb of iron'],
  ['moonrock', 'Moon Rock', 'rocks', 'U', 0.84, ['Lunar Sample', 30, 'This item can’t be traded. It’s on loan from the Moon.'], 'Brought home in a bag, kept in a vault, and looks a lot like a rock.', '4 oz · 3.9 billion yr old'],
  ['comet', 'Comet', 'rocks', 'U', 3.60, ['Tail Wind', 40, 'Draw 2 cards. They were trailing behind.'], 'A dirty snowball that grows a tail a million miles long when it nears the Sun.', 'Core 6 mi · tail 1 million mi'],
  // ---- rares ----
  ['shuttle', 'Space Shuttle', 'launch', 'R', 270, ['Reusable', 160, 'After this attack, shuffle this card into your deck. It flies again.'], 'Launched like a rocket, landed like a glider and flew 135 missions.', 'L 122 ft · 78 ft wingspan'],
  ['moonrocket', 'Moon Rocket', 'launch', 'R', 14.40, ['Three Stages', 150, 'Discard up to 3 cards. Do 50 damage for each one.'], 'Taller than a 30-story building, and louder than anything you’ve ever heard.', 'HT 363 ft · 3 stages'],
  ['telescope', 'Space Telescope', 'orbit', 'R', 54, ['Deep Field', 150, 'Look through your deck and put any card on top. You can see forever from up here.'], 'Stared at a dark, empty patch of sky and found ten thousand galaxies in it.', 'L 43 ft · 8 ft mirror'],
  ['station', 'Space Station', 'orbit', 'R', 720, ['Always On', 200, 'This item can’t be discarded. Someone is always home.'], 'Laps the Earth every 90 minutes. The crew sees 16 sunrises a day.', 'W 357 ft · 16 sunrises a day'],
  ['saucer', 'Flying Saucer', 'orbit', 'R', 19.81, ['Abduct', 140, 'Take 1 item from your opponent’s bench. It comes back later with a story.'], 'Seen over the cornfield by one farmer, two cows and nobody else.', 'Ø 30 ft · origin unknown'],
  ['spacesuit', 'Space Suit', 'crew', 'R', 108, ['Spacewalk', 160, 'This item can’t be damaged by Rocks or Stars items. Step outside.'], 'Fourteen layers, its own air supply and a little pad inside the helmet for scratching your nose.', 'HT 6 ft · 14 layers'],
  ['earth', 'Earth', 'worlds', 'R', 25.21, ['Home Sweet Home', 150, 'Heal all damage from all your items. There’s no place like it.'], 'The only planet with pizza, puppies and people. So far.', 'Ø 7,918 mi · 1 moon'],
  ['saturn', 'Saturn', 'worlds', 'R', 18.01, ['Ring Toss', 140, 'Flip 3 coins. Do 40 damage for each heads.'], 'Its rings are a billion chunks of ice, and it would float in a big enough bathtub.', 'Ø 72,367 mi · 7 rings'],
  ['rover', 'Mars Rover', 'worlds', 'R', 6.30, ['Sample Drill', 130, 'Look at the bottom card of your deck. Put it in your hand.'], 'Took seven months to get to Mars, and it has been driving around ever since.', 'L 10 ft · 6 wheels'],
  ['sun', 'The Sun', 'stars', 'R', 10.80, ['Solar Flare', 140, 'Do 20 damage to every item in play. Wear sunscreen.'], 'Our star: big enough to hold a million Earths, and eight minutes away at the speed of light.', 'Ø 865,000 mi · 8 light-min'],
  ['blackhole', 'Black Hole', 'stars', 'R', 2700, ['Event Horizon', 250, 'Put your opponent’s item on the bottom of their deck. Nothing gets out.'], 'So heavy that not even light can leave. Please keep your hands inside the card.', 'Mass of 4 million Suns'],
  ['galaxy', 'Spiral Galaxy', 'stars', 'R', 9.00, ['Pinwheel', 140, 'Each player shuffles their hand into their deck and draws 4.'], 'Two hundred billion stars, all turning around a very heavy middle.', '100,000 light-years · 200 billion stars'],
  // ---- mythic rares and legends: numbered past the end of the set, like secret rares ----
  ['greatcomet', 'Great Comet', 'rocks', 'M', 48, ['Blazing Tail', 230, 'Do 40 damage to every item in play. Comes back in 76 years.'], 'A dirty snowball with a tail a hundred million miles long. Make a wish.', 'Ø 6 mi · 100M-mi tail'],
  ['goldenrecord', 'Golden Record', 'launch', 'M', 60, ['Greetings', 220, 'Play every sound of Earth at once. Any item that understands it may join your side.'], 'Sounds of Earth, sent to whoever finds it first. The needle is included.', 'Ø 12 in · gold-plated'],
  ['nebula', 'Nebula', 'stars', 'M', 78, ['Star Nursery', 240, 'Put 3 new items into play. They’ll shine in a million years.'], 'A cloud of glowing gas where stars are born, light-years tall and softer than it looks.', '5 light-years · stars forming'],
  ['wormhole', 'Wormhole', 'worlds', 'L', 3200, ['Shortcut', 320, 'Swap this item with any card in either deck. It arrives before it left.'], 'A tunnel through space and time. The other end opens next Tuesday.', 'Ø 1 mi · both ends'],
  ['supernova', 'Supernova', 'stars', 'L', 4000, ['Final Blaze', 350, 'Do 999 damage to everything. Briefly outshines the whole galaxy.'], 'A star going out with the biggest bang since the first one. Visible in daylight, for a while.', 'Ø 10B mi and growing'],
];

// The dearest rares turn up one pack in this many; every other rare shares the rest equally.
const ODDS = { telescope: 50, spacesuit: 100, shuttle: 250, station: 700, blackhole: 2000 };

const set = {
  id: 'space',
  name: 'Outer Space',
  short: 'Space',
  series: 'Series 3',
  code: 'SPC',
  price: 899,
  boxPrice: 6999,
  curve: { C: .35, U: .55, R: 0, M: 0, L: 0 },
  types: TYPES,
  typeLabel: 'Sector',
  symbol: planet,                      // a ringed planet in each card's footer
  panel: circuit,                      // faint circuitry printed on each card's panel
  wrapperArt,                          // a starfield, orbit rings and a glowing grid behind the pack's hero
  // Locked until the player has three quarters of Backyard: 38 of its 50 cards.
  unlock: { set: 'backyard', found: 38 },
  wrappers: [
    { hero: 'shuttle', colors: ['#030824', '#1b3d9e', '#8fd4ff'], accent: '#6ff3ff', accentInk: '#1f63e0' },
    { hero: 'spacesuit', colors: ['#170800', '#a84c0c', '#ffd9a8'], accent: '#ffe066', accentInk: '#d8431c' },
    { hero: 'saturn', colors: ['#0c0524', '#5327b0', '#e2d0ff'], accent: '#ff9cf0', accentInk: '#7a2ad8' },
  ],
  blurb: 'Fifty things from up there: rockets, space suits, space stations, planets, stars and the rocks in between.',
  items: LIST.map(([id, name, type, rarity, dollars, [move, power, text], flavor, size], i) => ({
    id, name, type, rarity, price: Math.round(dollars * 100), move: { name: move, power, text }, flavor, size, no: i + 1, odds: ODDS[id],
  })),
  models: {},
};
// Models load file by file, so one broken file only costs its own items their pictures (they get a stand-in).
const MODEL_FILES = ['rockets', 'craft', 'orbit', 'observatory', 'crew', 'suits', 'worlds', 'stars', 'rocks', 'wonders'];
set.ready = Promise.all(MODEL_FILES.map(f => import(`./models/${f}.js`)
  .then(m => Object.assign(set.models, m.default))
  .catch(e => console.error(`Models in ${f}.js didn't load:`, e))));
export default set;
