// Series 2: Backyard. Fifty things from out back: toys, games, the garden, and everything that crawls, hops or flies
// through it. Its packs cost $6.99, 1.4 times an Around the House pack, and its values are scaled to match: commons up to
// $1.33, uncommons up to about $13, rares anything up to a $1,680 beetle. It unlocks once a player has 50 different
// Around the House cards in their binder.
import { TYPES, fence } from './types.js';

// [id, name, type, rarity, card value in dollars, [move, power, move text], flavor text, size line]
const LIST = [
  // ---- commons ----
  ['waterballoon', 'Water Balloon', 'play', 'C', 0.07, ['Splash Zone', 10, 'Flip a coin. Heads: your opponent’s item is Soaked. Tails: you are.'], 'Filled to exactly one squeeze past bursting.', 'Ø 3 in · 5 fl oz'],
  ['bubbles', 'Bubble Wand', 'play', 'C', 0.17, ['Float Away', 10, 'Blow 6 bubbles. Each one pops just before anybody catches it.'], 'Half the bottle always ends up on your shoes.', '4 fl oz · 1 wand'],
  ['chalk', 'Sidewalk Chalk', 'play', 'C', 0.42, ['Hopscotch', 20, 'Hop over your opponent’s next attack. Land on 10.'], 'Masterpieces on the driveway, gone with the first rain.', '12 sticks · 1.5 lb'],
  ['sandcastle', 'Sand Castle', 'play', 'C', 1.33, ['Moat Defense', 20, 'Prevent 20 damage. The tide comes in at the end of your turn.'], 'Four towers, one flag and a very serious moat.', 'HT 8 in · 1 pail of sand'],
  ['baseball', 'Baseball', 'sports', 'C', 0.56, ['Fastball', 20, 'Flip a coin. Heads: strike three. Tails: the neighbor’s window.'], '108 red stitches and a grass stain for every summer.', 'Ø 2.9 in · 5 oz'],
  ['tennisball', 'Tennis Ball', 'sports', 'C', 0.04, ['Fetch', 10, 'Throw this card. A Critter brings it back, a little wetter.'], 'Fuzzy, bouncy and legally the property of the dog.', 'Ø 2.6 in · 2 oz'],
  ['shuttlecock', 'Shuttlecock', 'sports', 'C', 0.11, ['Birdie', 10, 'Your opponent’s next attack lands on the roof.'], 'Sixteen feathers, one cork and no idea where it’s going.', 'L 3.5 in · 0.2 oz'],
  ['seedpacket', 'Seed Packet', 'garden', 'C', 0.03, ['Plant', 10, 'Put this card face down. In 60 turns it becomes a Sunflower.'], 'The picture on the front is extremely optimistic.', '3 × 4.5 in · 50 seeds'],
  ['tomato', 'Garden Tomato', 'garden', 'C', 0.31, ['Ripen', 20, 'Heal 20 damage, or throw it for 20 damage. Your call.'], 'Ninety of them ripen the same week. Everyone gets tomatoes.', 'Ø 3 in · 7 oz'],
  ['treefrog', 'Tree Frog', 'critters', 'C', 0.49, ['Sticky Feet', 20, 'This item can’t be knocked off the bench.'], 'Sings all night, but only when you’re trying to sleep.', 'L 2 in · 0.25 oz'],
  ['robin', 'Robin', 'critters', 'C', 0.84, ['Early Bird', 20, 'If this is your first attack of the game, draw a Bug.'], 'First to wake, first to sing, first to the worm.', 'L 10 in · 3 oz'],
  ['ladybug', 'Ladybug', 'bugs', 'C', 0.35, ['Lucky Spots', 10, 'Flip a coin for each spot. Make a wish on every heads.'], 'Eats aphids by the hundred and looks adorable doing it.', 'L 0.3 in · 7 spots'],
  ['honeybee', 'Honeybee', 'bugs', 'C', 0.77, ['Pollinate', 20, 'Heal 20 damage from each of your Garden items.'], 'Visits a thousand flowers a day and never takes a day off.', 'L 0.6 in · 1 stinger'],
  ['snail', 'Garden Snail', 'bugs', 'C', 0.10, ['Slime Trail', 10, 'Your opponent’s item is Slowed. So is this one.'], 'Carries its house everywhere and leaves a shiny map.', 'L 1.5 in · 0.03 mph'],
  ['caterpillar', 'Caterpillar', 'bugs', 'C', 0.20, ['Munch', 10, 'Discard 1 leaf. This item grows a little.'], 'Eats, sleeps, and is about to have a very big week.', 'L 2 in · 16 legs'],
  ['rolypoly', 'Roly-Poly', 'bugs', 'C', 0.03, ['Roll Up', 10, 'Prevent 10 damage. It’s a tiny armored ball now.'], 'Not actually a bug. It’s a crustacean, and very proud of it.', 'L 0.5 in · 14 legs'],
  ['lemonade', 'Lemonade', 'patio', 'C', 0.70, ['Refresh', 20, 'Heal 20 damage. Add ice for 10 more.'], 'Made with real lemons and an alarming amount of sugar.', '12 fl oz · 1 lemon wheel'],
  ['rocketpop', 'Rocket Pop', 'patio', 'C', 0.21, ['Brain Freeze', 20, 'Your opponent’s item is Frozen. So are you, for a second.'], 'Cherry, lime and blue raspberry, running down your arm.', 'L 7 in · 3 flavors'],
  ['smore', 'S’more', 'patio', 'C', 0.28, ['Toasty', 20, 'Heal 20 damage. Then ask for some more.'], 'The marshmallow is either golden or on fire. There is no in-between.', '2.5 in square · 3 layers'],
  // ---- uncommons ----
  ['kite', 'Kite', 'play', 'U', 2.45, ['Catch the Wind', 40, 'Move this item into the sky. It comes down in the neighbor’s tree.'], 'Every kite ends up in a tree. This one is just getting started.', 'W 32 in · 300 ft of string'],
  ['waterblaster', 'Water Blaster', 'play', 'U', 3.71, ['Super Soak', 50, 'Do 10 damage to every item in play. Nobody stays dry.'], 'Holds a gallon. Empties in eleven seconds.', 'L 22 in · 1 gal tank'],
  ['wagon', 'Red Wagon', 'play', 'U', 8.68, ['Haul', 40, 'Move up to 3 of your items. Somebody has to pull.'], 'Has carried groceries, puppies, pumpkins and one very proud little brother.', 'L 34 in · 150 lb load'],
  ['glove', 'Baseball Glove', 'sports', 'U', 6.65, ['Pocket Catch', 40, 'Catch your opponent’s next attack and throw it back for 20 damage.'], 'Broken in with oil, a ball and a night under the mattress.', '11.5 in · leather'],
  ['skateboard', 'Skateboard', 'sports', 'U', 12.32, ['Kickflip', 60, 'Flip a coin. Heads: 60 more damage. Tails: 20 damage to your knees.'], 'The grip tape has eaten three pairs of sneakers.', 'L 31 in · 7 plies of maple'],
  ['rollerskates', 'Roller Skates', 'sports', 'U', 3.22, ['Couple Skate', 40, 'Move this item and one friend anywhere. Disco lights optional.'], 'Rainbow wheels, a toe stop and a song stuck in your head.', 'Size 7 · 8 wheels'],
  ['sunflower', 'Sunflower', 'garden', 'U', 1.54, ['Face the Sun', 40, 'On a sunny day, this item attacks first.'], 'Taller than Dad by August, and it watches the sun all day.', 'HT 8 ft · 1,000 seeds'],
  ['flytrap', 'Venus Flytrap', 'garden', 'U', 5.74, ['Snap', 50, 'Discard 1 Bug from your opponent’s bench. Burp.'], 'Vegetarians need not apply.', 'HT 5 in · 4 in pot'],
  ['birdhouse', 'Birdhouse', 'garden', 'U', 1.33, ['Vacancy', 30, 'Search your deck for 1 Critter and put it on your bench.'], 'Built for bluebirds. Rented by wasps.', 'HT 10 in · 1¼ in door'],
  ['squirrel', 'Squirrel', 'critters', 'U', 0.63, ['Stash', 30, 'Hide 1 card under your deck. You’ll forget where.'], 'Has outsmarted every bird feeder ever sold.', 'L 18 in · 1.2 lb'],
  ['rabbit', 'Cottontail Rabbit', 'critters', 'U', 1.82, ['Hop Away', 40, 'Retreat for free. Take a lettuce leaf with you.'], 'Freezes in plain sight and is sure nobody can see it.', 'L 16 in · 2.5 lb'],
  ['hedgehog', 'Hedgehog', 'critters', 'U', 4.06, ['Curl Up', 30, 'Prevent all damage done to this item next turn. Ouch.'], 'Five thousand spines and one tiny, sniffling nose.', 'L 8 in · 1.5 lb'],
  ['turtle', 'Box Turtle', 'critters', 'U', 10.43, ['Slow and Steady', 50, 'Do 10 more damage for every turn this item has been in play.'], 'Has lived in the same yard longer than the house has.', 'L 6 in · 80 years'],
  ['firefly', 'Firefly', 'bugs', 'U', 1.12, ['Glow', 30, 'Light up your bench. Your items can attack after dark.'], 'Caught in a jar, admired and let go before bedtime.', 'L 0.8 in · 1 lantern'],
  ['dragonfly', 'Dragonfly', 'bugs', 'U', 3.01, ['Zip', 40, 'Move this item anywhere. It was here a second ago.'], 'Four wings, eyes all the way round and a flight plan nobody can follow.', 'L 3 in · 30 mph'],
  ['stagbeetle', 'Stag Beetle', 'bugs', 'U', 12.95, ['Antler Grapple', 70, 'Flip a coin. Heads: turn your opponent’s item upside down.'], 'Those aren’t antlers. Don’t tell it.', 'L 3 in · 2 big jaws'],
  ['picnicbasket', 'Picnic Basket', 'patio', 'U', 3.36, ['Spread Out', 40, 'Draw 3 cards. The ants draw 1.'], 'Sandwiches, gingham and an optimistic weather forecast.', 'W 17 in · lunch for 4'],
  ['lawnchair', 'Lawn Chair', 'patio', 'U', 0.84, ['Kick Back', 30, 'Heal 30 damage. This item doesn’t want to get up.'], 'Folds up easily for everyone except you.', 'HT 32 in · 6 lb'],
  // ---- rares ----
  ['treehouse', 'Treehouse', 'play', 'R', 210, ['No Grown-Ups', 160, 'Pull up the rope ladder. Your opponent’s items can’t attack this one.'], 'Built over three summers. The password changes daily.', '12 ft up · 1 rope ladder'],
  ['hoop', 'Basketball Hoop', 'sports', 'R', 9.10, ['Nothing but Net', 120, 'Flip 3 coins. Do 40 damage for each heads. Swish.'], 'Home court of the greatest games nobody saw.', '10 ft rim · 44 in backboard'],
  ['scarecrow', 'Scarecrow', 'garden', 'R', 5.88, ['Stand Watch', 110, 'Critters can’t attack. The crows sit on its hat anyway.'], 'Has stood in the same spot since April and looks a little tired.', 'HT 6 ft · stuffed with straw'],
  ['pumpkin', 'Prize Pumpkin', 'garden', 'R', 560, ['Heavyweight', 200, 'This item can’t be moved. By anyone. Ever.'], 'Weighed in at 1,142 pounds and took home the blue ribbon.', 'Ø 6 ft · 1,142 lb'],
  ['raccoon', 'Raccoon', 'critters', 'R', 13.99, ['Midnight Snack', 130, 'Take 1 card from your opponent’s discard pile. Leave the lid off.'], 'Wears a mask for a reason.', 'L 32 in · 18 lb'],
  ['owl', 'Great Horned Owl', 'critters', 'R', 42, ['Who?', 150, 'Look at your opponent’s hand. Nothing stays hidden at night.'], 'Turns its head almost all the way round and never blinks first.', 'HT 22 in · 4 ft wingspan'],
  ['hummingbird', 'Hummingbird', 'critters', 'R', 17.50, ['Hover', 120, 'This item can’t be hit by attacks that aren’t Fast.'], 'Beats its wings 50 times a second and still has time for every flower.', 'L 3.5 in · 0.1 oz'],
  ['goodboy', 'Good Boy', 'critters', 'R', 22.40, ['Fetch Forever', 140, 'Put 1 card from your discard pile back in your hand. Again. Again!'], 'Who’s a good boy? He is. He has been told.', 'HT 23 in · 70 lb of love'],
  ['monarch', 'Monarch Butterfly', 'bugs', 'R', 11.20, ['Migration', 120, 'Move this item 3,000 miles. It arrives in spring.'], 'Flies to Mexico and back and has never once asked for directions.', '4 in wingspan · 0.02 oz'],
  ['lunamoth', 'Luna Moth', 'bugs', 'R', 84, ['Moonlight', 150, 'Only attacks at night. When it does, everyone stops to watch.'], 'Lives for about a week and spends all of it looking like this.', '4.5 in wingspan · 1 week'],
  ['scarab', 'Golden Scarab', 'bugs', 'R', 1680, ['Legend of the Yard', 250, 'Your opponent’s items stop to stare. They can’t attack for 2 turns.'], 'Dug up under the old oak. Might be a beetle. Might be treasure.', 'L 1.2 in · solid gleam'],
  ['lemonadestand', 'Lemonade Stand', 'patio', 'R', 3.50, ['Grand Opening', 110, 'Take 1 coin for every item in play. Business is booming.'], 'Five cents a cup, ten with ice, free for Grandma.', 'W 4 ft · 5¢ a cup'],
  ['firepit', 'Fire Pit', 'patio', 'R', 8.05, ['Campfire Stories', 130, 'Every item in play is Spooked. Somebody brings out marshmallows.'], 'Everyone sits too close, then moves when the smoke follows them.', 'Ø 3 ft · 4 logs'],
];

// The dearest rares turn up one pack in this many; every other rare shares the rest equally.
const ODDS = { owl: 50, lunamoth: 100, treehouse: 250, pumpkin: 700, scarab: 2000 };

const set = {
  id: 'backyard',
  name: 'Backyard',
  series: 'Series 2',
  code: 'YRD',
  price: 699,
  boxPrice: 5499,
  curve: { C: .35, U: .55, R: 0 },
  types: TYPES,
  typeLabel: 'Patch',
  symbol: fence,                       // a bit of picket fence in each card's footer
  // Locked until the player has this many different cards from another set in their binder.
  unlock: { set: 'house', found: 50 },
  wrappers: [
    { hero: 'treehouse', colors: ['#10381e', '#2f9e4c', '#c8f5b0'], accent: '#ffd76a' },
    { hero: 'goodboy', colors: ['#0c2d5a', '#2f8ff0', '#c3e5ff'], accent: '#ffe066' },
    { hero: 'monarch', colors: ['#4a1804', '#f0801a', '#ffe1b3'], accent: '#fff3a0', accentInk: '#1f7a3a' },
  ],
  blurb: 'Fifty things from out back: toys, games, the garden and everything that crawls, hops or flies through it.',
  items: LIST.map(([id, name, type, rarity, dollars, [move, power, text], flavor, size], i) => ({
    id, name, type, rarity, price: Math.round(dollars * 100), move: { name: move, power, text }, flavor, size, no: i + 1, odds: ODDS[id],
  })),
  models: {},
};
// Models load file by file, so one broken file only costs its own items their pictures (they get a stand-in).
const MODEL_FILES = ['toys', 'patio', 'sports', 'garden', 'birds', 'mammals', 'beetles', 'wings'];
set.ready = Promise.all(MODEL_FILES.map(f => import(`./models/${f}.js`)
  .then(m => Object.assign(set.models, m.default))
  .catch(e => console.error(`Models in ${f}.js didn't load:`, e))));
export default set;
