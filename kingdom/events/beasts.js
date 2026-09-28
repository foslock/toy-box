// Kingdom: beasts of the wild places. Griffins, kelpies, basilisks, harpies, a manticore with a toothache, a golem that
// obeys its word, and the hunters, trappers and showmen who live off them. Events for the journey (see rules.js for
// every id).
//
// Chains: b_chick / b_egg (the Fallen Griffin Chick → Wings Over the Crag, or the Shadow at Noon), b_bridle (the Black
// Horse at the Ford → the Man With Weed in His Hair), b_cockatrice (the Cockerel’s Egg → the Stone Garden at
// Stillwater), b_golem (the Clay Man of Cinder Quarry → Who Holds the Word).
export default [
  /* ---------- tier 1 ---------- */
  {
    id: 'b_griffin_chick', tier: 1, biome: ['hills', 'snow'],
    title: 'The Fallen Griffin Chick',
    text: 'A griffin chick flaps in the scree below a crag, all beak and bald pink wings, shrieking. Its nest is a ledge above, and in it sits an egg the size of a helm, flecked with real gold. Far off, over the peaks, something screams back.',
    left: { label: 'Carry the chick home', tile: 'mountain', out: [
      { w: 2, text: 'It pecks you all the way up the crag, then falls asleep in the nest the moment you tuck it in. The mother’s larder is a ledge of hares. She will not miss one.', food: 2, flag: 'b_chick' },
      { w: 1, text: 'You tuck it in beside the egg. Among the bones on the ledge lies a shepherd’s purse, brought home with the mother’s last dinner.', gold: 10, flag: 'b_chick' },
      { w: 1, text: 'A gale of wings: the mother lands beside you, beak open. She sees her chick, and looks at you a long moment. You go down the crag so fast you skin both knees.', hp: -1, flag: 'b_chick' },
    ] },
    right: { label: 'Take the egg', tile: 'mountain', out: [
      { w: 2, text: 'You wrap the egg in your cloak and are down the crag before the chick stops screaming. A showman in the next village pays in gold and asks no questions.', gold: 14, flag: 'b_egg' },
      { w: 1, text: 'Halfway down, the sky goes dark with wings.', fight: { foe: 'griffin', name: 'the Mother Griffin', power: 6, dmg: 1,
        win: { text: 'At last she wheels away, screaming. The egg sells for a small fortune in the next village, and she will know your smell anywhere.', gold: 14, flag: 'b_egg' },
        lose: { text: 'She tears the egg from your arms, and a strip of your scalp with it. She has your scent now, egg or no egg.', flag: 'b_egg' } } },
    ] },
  },
  {
    id: 'b_kelpie_ford', tier: 1, biome: ['lake', 'fen'],
    title: 'The Black Horse at the Ford',
    text: 'The ford at Rushwater is in spate, brown and roaring. On the bank waits a black horse with a bridle of green silver, saddled and riderless, water running from its mane though no rain has fallen all day. It kneels, as if to invite you up.',
    left: { label: 'Ride it across', tile: 'ferry', out: [
      { w: 2, text: 'It carries you over smooth as a barge and sets you down gently. Turning back to the water, it noses a drowned pedlar’s purse out of the reeds for you, as if in apology.', gold: 8 },
      { w: 2, text: 'Midstream it turns for the deep pool, and your hands will not come away from its neck. Kelpie-hide holds like pitch.', fight: { foe: 'kelpie', name: 'the Rushwater Kelpie', power: 5, dmg: 1,
        win: { text: 'You saw through its mane with your knife, and it shrieks like a woman and is gone. You wade ashore with a hank of green hair, which a fiddler buys for strings.', gold: 8 },
        lose: { text: 'It rolls you along the riverbed like a pebble before it tires of you. You crawl out a mile downstream with a pack full of river.', food: -2 } } },
    ] },
    right: { label: 'Steal its silver bridle', tile: 'lake', out: [
      { w: 3, text: 'You slip the bridle over its ears before it can bolt, and at once it stands meek as a carthorse. It carries you over, sulking, and waits on the far bank. The bridle hums in your fist.', flag: 'b_bridle' },
      { w: 1, text: 'As your fingers close on the bridle, the horse turns its head right round, like an owl, and bites. By the time you stop bleeding it is gone, and so is your lunch.', hp: -1, food: -1 },
    ] },
  },
  {
    id: 'b_cockerel_egg', tier: 1, biome: ['farm'],
    title: 'The Cockerel’s Egg',
    text: 'Goody Brack’s old cockerel has laid an egg on the dung-heap, and a toad sits on it, puffed and glaring. All Nettlecombe knows what hatches from that: a basilisk. Nobody will go near. An apothecary on a mule has stopped to watch, very interested.',
    left: { label: 'Smash the egg', tile: 'farm', out: [
      { w: 2, text: 'You crack it with a spade, eyes screwed shut. Something inside hisses once and goes still. Goody Brack weeps, kisses you, and loads you with bread and a whole cheese.', food: 3 },
      { w: 1, text: 'The toad will not budge, so you smash toad and egg together. The village gives you a hot supper and a very wide berth.', food: 2 },
      { w: 1, text: 'The toad leaps at your face as the spade comes down. A fleck of yolk gets in your eye, and ever after that eye sees the world grey and still, like stone.', trait: 'veil' },
    ] },
    right: { label: 'Sell it to the apothecary', tile: 'road', out: [
      { w: 3, text: 'He lifts it with silver tongs and packs it in black wool. "For study," he says, and pays in bright new gold. Asked his name, he gives you only the name of a town: Stillwater.', gold: 12, flag: 'b_cockatrice' },
      { w: 1, text: 'The egg cracks in his tongs. A wet grey chick with a rooster’s comb and a serpent’s tail blinks at you, and one of your fingers goes cold and grey. He pays you anyway.', gold: 12, hp: -1, flag: 'b_cockatrice' },
    ] },
  },
  {
    id: 'b_menagerie', tier: 1, biome: ['farm', 'moor'],
    title: 'Tuttle’s Wonders of the Wild',
    text: 'Five painted wagons in a field. A moulting bear, a "basilisk" that is plainly a lizard with a comb glued on, and, in a birdcage, a harpy telling the crowd exactly what she thinks of them. Master Tuttle takes the pennies and cracks his whip.',
    left: { label: 'Browse his curiosities', tile: 'market', shop: 'fence', out: [
      { text: 'Tuttle unlocks his cabinet: a mermaid that is a monkey sewn to a fish, a griffin feather that is a painted goose quill, and one or two things that are perfectly real, and priced to match.' },
    ] },
    right: { label: 'Muck out the cages for supper', tile: 'camp', out: [
      { w: 2, text: 'A long day shovelling bear. Tuttle feeds you the way he feeds his beasts, which is to say a great deal and all at once, and pays you a few coppers besides.', food: 2, gold: 4 },
      { w: 1, text: 'The harpy tells your fortune while you scrub her perch, in exchange for your crusts. It is filthy, and it is entirely accurate.', sight: 2 },
      { w: 1, text: 'You lean in close to the lizard with the glued-on comb. It opens its eyes. It is not a lizard. Your hand goes grey and numb to the wrist, and Tuttle hurries a sack over the cage.', hp: -1 },
    ] },
  },
  {
    id: 'b_fox_snare', tier: 1, biome: ['wood', 'farm'],
    title: 'The Fox in the Snare',
    text: 'A red fox hangs by one hind leg from a snare, and speaks as you pass, in a voice like a sly old aunt. "Cut me down, dear, and I’ll show you where the trapper hides his purse. Or wait for him, and see what he pays for a fox that talks."',
    left: { label: 'Cut the fox down', tile: 'forest', out: [
      { w: 2, text: 'The fox limps to a hollow stump and noses out the trapper’s purse, then trots off with the air of someone who has done you a great favour. Perhaps it has.', gold: 10 },
      { w: 1, text: 'The fox licks its leg and drops a rabbit’s foot at your boots. "Lucky for you," it says. "Not for the rabbit." Then it is gone into the ferns.', relic: 'rabbit_foot' },
      { w: 1, text: 'The purse is where she said it was. So is the trapper, sitting on it with a cudgel. The fox is gone before the first blow lands.', hp: -1 },
    ] },
    right: { label: 'Wait for the trapper', tile: 'camp', out: [
      { w: 2, text: 'The trapper is a gentle giant who talks to his snares by name. He feeds you rabbit stew for your watch, and hangs a wolf-tooth charm round your neck. "Wolves took my brother. Luck to you."', relic: 'wolf_tooth' },
      { w: 1, text: 'He sells the fox to a passing lord for a fortune, and gives you a fair cut. From the back of the lord’s cart, the fox smiles at you with all its teeth.', gold: 12 },
      { w: 1, text: 'He skins the fox where it hangs. It curses you while he works, in its sly old aunt’s voice, and from that day your purse leaks like a sieve.', food: 2, trait: 'leaden_purse' },
    ] },
  },
  {
    id: 'b_bee_tree', tier: 1, biome: ['wood', 'hills'],
    title: 'The Bear in the Bee-Tree',
    text: 'A brown bear has got its head stuck in a hollow oak full of wild honey, and stands there moaning, stung and furious, its great rump across the path. The bees are winning. The honey smells of heather and summer.',
    left: { label: 'Help the bear out', tile: 'forest', out: [
      { w: 2, text: 'You lever the split trunk apart with your staff. The bear backs out, sneezes bees, and gives you a long, thoughtful look before it lumbers off. It leaves you the honey.', food: 3 },
      { w: 1, text: 'You free it, and it is grateful for one whole heartbeat. Then it remembers the bees, and blames you, and chases you into the river.', hp: -1 },
      { w: 1, text: 'The bear backs out, sits down beside you, and shares. You eat honey off the comb together until dusk. It is the strangest supper of your life, and the best.', food: 2, hp: 1 },
    ] },
    right: { label: 'Steal the honey while it’s stuck', tile: 'forest', out: [
      { w: 2, text: 'You scoop combs from the far side of the trunk while the bear roars into the hollow. You leave stung from brow to ankle, with honey enough for a week.', food: 3, hp: -1 },
      { w: 1, text: 'You are halfway through the second comb when the bear tears free, wearing half the oak like a collar.', fight: { foe: 'bear', name: 'the Honey-Mad Bear', power: 5, dmg: 1,
        win: { text: 'It crashes off into the trees at last, still wearing the oak. The honey is yours, and the wood has a new story about you.' },
        lose: { text: 'It sits on you, briefly, which is enough. Then it eats your honey and your supper in front of you, slowly.', food: -2 } } },
      { w: 1, text: 'At the heart of the hive is a lump of old wax as big as your head. A chandler in the next village pays good silver for it.', gold: 10 },
    ] },
  },
  {
    id: 'b_salt_lick', tier: 1, biome: ['hills', 'moor'],
    title: 'The Peace of the Salt-Lick',
    text: 'In a hollow among the rocks lies a great white salt-lick, and round it, in perfect peace, drink a stag, a boar, a she-bear and two wolves. No beast hunts at the lick: it is the oldest law of the wild. The stag is very fat, and very close.',
    left: { label: 'Break the truce', tile: 'forest', out: [
      { w: 2, text: 'One throw, and the stag is down. The other beasts turn and look at you, all together, and melt away. You eat well for days, but the wild does not forget.', food: 3, trait: 'ill_luck' },
      { w: 1, text: 'The stag falls, and nothing else happens, which is somehow worse. You eat alone that night, and the whole wood holds its breath around you.', food: 3 },
      { w: 1, text: 'Your throw goes wide. The she-bear knocks you flat and stands over you, breathing, then walks away. The law holds, even for you.', hp: -1 },
    ] },
    right: { label: 'Kneel and lick the salt', tile: 'grove', out: [
      { w: 2, text: 'You kneel among the beasts and lick the salt. The wolf beside you sighs. By dusk you understand, a little, what the jays are saying, and it is mostly rude.', trait: 'beast_tongue' },
      { w: 1, text: 'The beasts ignore you. You fill your pouch with salt and trade it at the next farm for a hot supper and a bed in the byre.', food: 2 },
      { w: 1, text: 'You lick salt all afternoon at a stag’s elbow. By evening your thirst drives you miles off your road to the nearest well.', food: -1 },
    ] },
  },
  {
    id: 'b_voice_in_snow', tier: 1, biome: ['snow', 'wood'],
    title: 'A Voice in the Pines',
    text: 'Snow is falling in the pinewood, and somewhere in the trees a voice is calling your name: a voice you know, that you have not heard since you were small. It keeps pace as you walk. The footprints beside the path all point the wrong way.',
    left: { label: 'Answer the voice', tile: 'forest', out: [
      { w: 2, text: 'You follow it to a woodcutter’s widow calling for her lost goat, which by some strange chance shares your name. You find the goat. She feeds you soup, laughing.', food: 2, renown: 1 },
      { w: 1, text: 'The voice falls silent as you answer, as if embarrassed. Where it was, in the snow, lies a dead hunter’s bundle: jerky, flint and a good yew bow.', item: 'bow' },
      { w: 1, text: 'Something tall and antlered and very thin steps out between the pines, wearing the voice like a coat. You run until your lungs are knives and your pack is gone.', food: -2, hp: -1 },
    ] },
    right: { label: 'Walk on, and don’t look back', tile: 'road', out: [
      { w: 2, text: 'You walk on, eyes front, humming. The voice follows you to the edge of the wood, then begs, then weeps, then stops. You do not look back. You are very cold.', food: -1 },
      { w: 1, text: 'At dawn you reach a shepherd’s bothy. He says nobody who answers comes out of that wood, and gives you his oatcakes for having the sense not to.', food: 2 },
      { w: 1, text: 'You look back. You can’t help it. There is nothing there at all, which is worse. From then on you know, a little, what waits down every road.', sight: 2 },
    ] },
  },
  {
    id: 'b_ant_gold', tier: 1, biome: ['waste'],
    title: 'The Ant-Gold of the Waste',
    text: 'On the Red Waste, giant ants dig for gold. At dawn their spoil-heaps glitter, and prospectors creep out with sacks to scoop them before the heat wakes the diggers. The ants are the size of hounds. A claim-warden sells digging tokens from a tent.',
    left: { label: 'Buy a token and dig', cost: 8, tile: 'mine', out: [
      { w: 2, text: 'You fill a sack with glittering spoil while the warden watches the ant-holes, horn at his lips. You are out of the diggings with a good weight of gold dust.', gold: 16 },
      { w: 1, text: 'Among the dust you find a coin stamped with an ant, older than {kingdom}. Every morning there seems to be a little more of it.', relic: 'tinker_coin' },
      { w: 1, text: 'The horn blows early. You drop the sack and run, an ant as big as a hound snapping at your heels, and leave your pack behind for it to chew.', food: -2 },
    ], poor: { text: 'No coin for a token. The warden lets you carry water for the diggers instead, and pays you in dust shaken out of his own boot.', gold: 4 } },
    right: { label: 'Dig before the warden wakes', tile: 'cave', out: [
      { w: 2, text: 'You fill your hat with gold dust before the sun is up, and are over the ridge before the warden has his boots on.', gold: 14 },
      { w: 1, text: 'The warden was awake all along. He fines you for claim-jumping, with three large diggers at his back to help you understand.', pay: 12 },
      { w: 1, text: 'No warden, no horn. You are elbow-deep in gold when the heap moves under you. You get away, just, with a bitten leg and nothing else.', hp: -1 },
    ] },
  },

  /* ---------- tier 2 ---------- */
  {
    id: 'b_bridle_back', tier: 2, biome: ['lake', 'fen'], needs: 'b_bridle', w: 3,
    title: 'The Man With Weed in His Hair',
    text: 'At the inn a pale young man sits dripping by the fire, with river-weed in his hair, though it has not rained in a week. He will not eat or drink. "You have my bridle," he says softly. "Give it back, and the river will owe you. Keep it, and I must take it."',
    left: { label: 'Give back his bridle', tile: 'lake', out: [
      { w: 2, text: 'He takes it in shaking hands and walks out into the dark. In the morning the mere has laid a drowned knight’s mail shirt on the bank for you, rinsed clean.', item: 'chain' },
      { w: 1, text: 'He bows over the bridle like a courtier. "The Hidden Folk of the water will hear of this," he says, and they do: that night the reeds whisper your name kindly.', ally: 'fey' },
      { w: 1, text: 'He snatches it, laughs with far too many teeth, and is a black horse, and gone through the wall. The innkeeper charges you for the wall.', gold: -10 },
    ] },
    right: { label: 'Keep the bridle', tile: 'stable', out: [
      { w: 2, text: 'You hold it up, and he must obey: a black horse stands saddled at the door. He carries you through the night, hating every mile, and at dawn you sell him to a horse-coper.', gold: 20 },
      { w: 1, text: 'He waits until you sleep. You wake with a great wet weight on your chest and the taste of the deep pool in your mouth.', fight: { foe: 'kelpie', name: 'the Bridled Kelpie', power: 7, dmg: 2,
        win: { text: 'You drive him out into the dawn with the bridle’s iron bit. He flees to the water, and the silver bridle is yours to sell, heavy and cold.', gold: 18 },
        lose: { text: 'He takes his bridle from your cold fingers and leaves you coughing up pondwater on the inn floor, with the landlord’s bill.', gold: -10 } } },
      { w: 1, text: 'You keep the bridle. That night the river rises to the inn door and takes your boots, your bread and most of your temper.', food: -2 },
    ] },
  },
  {
    id: 'b_golem_word', tier: 2, biome: ['hills', 'waste'],
    title: 'The Clay Man of Cinder Quarry',
    text: 'In a flooded quarry a clay giant stands waist-deep, still as a pillar, where its maker left it forty years ago. A scrap of vellum pokes from under its tongue: the word that moves it. Whoever holds the word, the quarrymen say, holds the golem.',
    left: { label: 'Take its word', tile: 'mine', out: [
      { w: 3, text: 'You tug the vellum free. The golem’s eyes glow like kilns, and it wades ashore and waits for you. Told to dig, it turns up forty years of lost wages in an afternoon.', gold: 15, flag: 'b_golem' },
      { w: 1, text: 'Its eyes light, and it does the last thing it was told, forty years ago: guard the quarry.', fight: { foe: 'golem', name: 'the Quarry Golem', power: 8, dmg: 2,
        win: { text: 'You get a hand into its mouth and keep the word. It stops mid-blow, and kneels in the water, and waits for orders. The quarrymen pay you to march it off.', gold: 10, flag: 'b_golem' },
        lose: { text: 'It throws you out of the quarry like a spadeful of spoil. When you look back it has gone still again, the word back on its tongue.', food: -1 } } },
    ] },
    right: { label: 'Rub out the word', tile: 'ruins', out: [
      { w: 2, text: 'You smear the letters with a wet thumb. The golem sighs like a cooling kiln and slumps into a hill of good red clay. The village potters feed you for a week for it.', food: 3 },
      { w: 1, text: 'As the letters smear, the golem speaks once, in its dead maker’s voice, and tells you where she hid her savings.', gold: 12 },
      { w: 1, text: 'It slumps, and the whole quarry face comes down with it. You dig yourself out bruised and grey with clay.', hp: -1 },
    ] },
  },
  {
    id: 'b_weasel_monger', tier: 2, biome: ['waste'],
    title: 'The Weasel-Monger',
    text: 'Where the road enters the Stonewaste, a man sits on a milestone with a cage of weasels. "Basilisk country! One look and you’re a garden ornament. Only a weasel can kill one. Ten gold a weasel." Down the road stands a very lifelike stone shepherd.',
    left: { label: 'Buy a weasel', cost: 10, tile: 'road', out: [
      { w: 2, text: 'In the rocks your weasel stiffens, then streaks off. A screech, a thrashing, a silence. It trots back licking its chops, and behind it lies a dead basilisk with garnets in its crest.', gold: 22 },
      { w: 1, text: 'The weasel escapes in the first mile, taking your cheese with it. You cross the waste with your eyes half shut and meet nothing but a great many lizards.', food: -1 },
      { w: 1, text: 'You never meet a basilisk. The weasel rides on your shoulder all the way, and every night it brings you a rabbit.', food: 3 },
    ], poor: { text: 'No coin, no weasel. You cross the waste with your eyes screwed shut and walk straight into the stone shepherd, who is very hard.', hp: -1 } },
    right: { label: 'Cross without one', tile: 'ruins', out: [
      { w: 2, text: 'You cross by night, when basilisks sleep. At dawn you pass a stone knight whose purse is still soft leather, and heavy, and not his any more.', gold: 15 },
      { w: 1, text: 'Something scrapes in the rocks. You catch its eye in a puddle, only just, and it catches yours.', fight: { foe: 'basilisk', name: 'the Stonewaste Basilisk', power: 8, dmg: 2,
        win: { text: 'You fight it with your eyes shut, by the rasp of its scales, and take its crested head. The weasel-monger buys it, sourly, for twice the price of a weasel.', gold: 20 },
        lose: { text: 'Its glance brushes your arm, which goes grey and cold to the elbow. You drag it out of the waste like a stone, and it is days before it wakes.', food: -1 } } },
      { w: 1, text: 'The stone shepherd is plaster. So is every other "victim". Round the back, the weasel-monger’s wife is painting a new one. She pays you to forget it.', gold: 10 },
    ] },
  },
  {
    id: 'b_harpy_seer', tier: 2, biome: ['moor', 'hills'],
    title: 'The Blind Seer’s Supper',
    text: 'A blind seer lives alone in a roofless tower, and every evening when he sits down to eat, the harpies come: three of them, shrieking, snatching, fouling what they cannot carry off. He is very thin. "Drive them off," he says, "and I’ll tell you what I see."',
    left: { label: 'Drive off the harpies', tile: 'ruins', fight: { foe: 'harpy', name: 'the Three Harpies', power: 7, dmg: 1,
      win: { text: 'You lay about with a fire-iron till the air is all feathers and swearing. The seer eats his first hot supper in a year, then gives you his crystal. "Never saw a thing in it," he says.', relic: 'crystal_ball' },
      lose: { text: 'They take his supper, then yours, then a good deal of your hair. The seer, who has seen all this before, says nothing at all.', food: -2 } } },
    right: { label: 'Bribe them with a side of mutton', cost: 12, tile: 'ruins', out: [
      { w: 2, text: 'The harpies fall on the mutton and, fed, are almost civil. The eldest spits a stolen ring into your palm, and the seer, eating in peace at last, tells you your road.', gold: 10, sight: 2 },
      { w: 1, text: 'They eat the mutton, then the seer’s supper, then look at you with interest. You spend the night on the tower stair with a broom.', hp: -1 },
    ], poor: { text: 'You have no coin for mutton, so you offer them your own supper. They eat it in three gulps, then look you over for pudding.', food: -2 } },
  },
  {
    id: 'b_manticore_tooth', tier: 2, biome: ['waste', 'hills'],
    title: 'The Manticore’s Toothache',
    text: 'In the shade of a red rock lies a manticore, lion-bodied and scorpion-tailed, its man’s face swollen out of shape. "A tooth," it moans, in a courtier’s voice. "Third row, at the back. Pull it, and I shall owe you. Refuse, and I may eat you anyway."',
    left: { label: 'Pull the tooth', tile: 'lair', out: [
      { w: 2, text: 'You brace a boot on its chin and heave. Out comes the tooth with a sound like a cork, big as a dagger. The manticore weeps with relief and coughs up the rings of three knights it ate.', gold: 20 },
      { w: 1, text: 'Out it comes. The manticore, overcome, draws you a map of the waste in the sand with one claw: every well, and every ambush, and the ones it laid itself.', sight: 2 },
      { w: 1, text: 'The tooth snaps. The manticore screams, and its tail lashes over like a thrown spear before it can stop itself. It apologises handsomely while you bleed.', hp: -2 },
    ] },
    right: { label: 'Strike while it suffers', tile: 'lair', fight: { foe: 'manticore', name: 'the Toothsore Manticore', power: 9, dmg: 2, elite: true,
      win: { text: 'Even aching, it fights like a siege. When it falls at last, its lair yields the purses of every traveller it ever ate, and one thing among them that is not broken.', gold: 20 },
      lose: { text: 'It pins you by the sleeve with a tail-spine and sulks over you till dusk, then lets you go. "Rude," it says. "And after I asked so nicely."', food: -1 } } },
  },
  {
    id: 'b_wendigo_cabin', tier: 2, biome: ['snow', 'wood'],
    title: 'The Trapper’s Stew',
    text: 'Snowbound, you find a trapper’s cabin with a fire lit. The trapper is gaunt and grey, too tall for his own doorway, and glad of company. His partner went out to check the lines a month ago, he says. The stew smells wonderful. He hasn’t touched his.',
    left: { label: 'Eat the stew', tile: 'hovel', out: [
      { w: 2, text: 'It is only venison, and good. He weeps all night about his partner, and at dawn gives you the man’s boiled-leather coat. "He won’t be needing it," he says, and weeps again.', food: 2, item: 'leather' },
      { w: 1, text: 'It is the best stew you have ever eaten. You eat three bowls, then a fourth. Later, watching him sleep, you catch yourself wondering about a fifth.', food: 3, trait: 'wendigo' },
      { w: 1, text: 'At the bottom of your bowl lies a man’s ring. The trapper watches you find it. Then he stands, and goes on standing, up into the rafters.', fight: { foe: 'wendigo', name: 'the Thing in the Trapper', power: 8, dmg: 2,
        win: { text: 'You drive it out into the storm with a burning log, and it goes shrieking off through the pines. The cabin is yours till the thaw, and so is the larder, which you do not look at closely.', food: 2 },
        lose: { text: 'It drags you out into the snow, and somewhere in the storm you lose it, or it loses you. You never know which.', food: -2 } } },
    ] },
    right: { label: 'Sleep in the woodshed', tile: 'camp', out: [
      { w: 2, text: 'You bar the woodshed door and sleep with your staff in your fist. All night something circles the shed, sniffing. At dawn the cabin stands open and empty, its larder full.', food: 3 },
      { w: 1, text: 'A bitter night among the logs. You wake stiff as a plank, and when you peer into the cabin, the trapper is gone, and so is the fire.', food: -1, hp: -1 },
      { w: 1, text: 'At first light you find his partner behind the shed, half-buried and gnawed. You leave fast, but not before taking the dead man’s purse. He won’t need it either.', gold: 12 },
    ] },
  },
  {
    id: 'b_adder_crown', tier: 2, biome: ['moor', 'fen'],
    title: 'The Adder King’s Crown',
    text: 'On a warm stone above the heath lies an adder longer than a man, and on its head sits a tiny crown of gold. The old folk say that if you spread a white cloth before the adder king, he will lay his crown on it while he bathes in the dew.',
    left: { label: 'Spread a cloth for the crown', tile: 'stones', out: [
      { w: 2, text: 'He lays the crown on your shirt and slides off into the dew. You snatch it up and run. A goldsmith weighs it, whistles, and pays you more than you have ever held.', gold: 25 },
      { w: 1, text: 'You snatch the crown, and every adder on the heath hisses at once. You run a mile through the heather with the grass boiling behind you, and do not get away unbitten.', gold: 25, hp: -2 },
      { w: 1, text: 'He will not lay his crown on a stranger’s cloth, only on a clean one. He looks at your shirt for a long moment and slides away, offended.' },
    ] },
    right: { label: 'Leave him a saucer of milk', tile: 'farm', out: [
      { w: 2, text: 'You beg a saucer of milk from a farm and set it on his stone. The adder king drinks, then dips his little crown to you. Fortune seems to walk a step behind you after that.', trait: 'lucky' },
      { w: 1, text: 'The farmwife gives you the milk and a whole supper besides. Anyone kind to the adder king is kind to her cows, she says, and will not say why.', food: 2 },
      { w: 1, text: 'You set down the milk. A hedgehog drinks it. The adder king watches, unimpressed, and you have wasted a morning.', food: -1 },
    ] },
  },
  {
    id: 'b_rat_king', tier: 2, biome: ['farm'],
    title: 'The Rat King of Hobley Mill',
    text: 'In the loft of Hobley Mill, a dozen rats sit knotted together by their tails, and speak as one, in a dozen voices. They know every secret ever whispered in the village. The miller holds out a torch and a jug of lamp-oil. His hands are shaking.',
    left: { label: 'Burn the rat king', tile: 'mill', out: [
      { w: 2, text: 'It screams in a dozen voices as it burns, and names you in all of them. The miller pays you well and will not meet your eye. Nor, you find, will the village cats.', gold: 12, renown: 1 },
      { w: 1, text: 'In the ashes lies its hoard: buttons, rings, and a stub of church candle that smokes whenever trouble is near. The miller lets you keep the candle.', gold: 6, relic: 'candle' },
      { w: 1, text: 'The loft goes up like tinder. You save the miller and the millstone, but not the flour, and the reeve fines you as the fire-raiser.', pay: 10 },
    ] },
    right: { label: 'Ask it a question', tile: 'mill', out: [
      { w: 2, text: '"Where does the miller hide his coin?" A dozen voices tell you: the flour-bin, under the false bottom. You help yourself while he fetches more oil.', gold: 15 },
      { w: 1, text: 'You ask about your road. It tells you, in a dozen voices, and every word is true. The price is your supper, which it eats in a dozen small bites.', food: -2, trait: 'second_sight' },
      { w: 1, text: 'It answers by telling the one secret you hoped nobody knew, out loud, in a dozen voices, while the miller listens. You leave Hobley at a run.', food: -1 },
    ] },
  },
  {
    id: 'b_swan_chain', tier: 2, biome: ['lake'],
    title: 'The Swan With a Golden Chain',
    text: 'A swan swims alone on the mere with a fine gold chain round its neck, and a man in a lord’s livery is wading after it with a net. The swan looks at you. It has a girl’s eyes, grey and frightened, and a girl’s voice. "Please," it says.',
    left: { label: 'Unclasp her chain', tile: 'lake', out: [
      { w: 2, text: 'The clasp gives, and a girl stands waist-deep in the mere, furious and shivering. She is a wizard’s daughter, turned by a jealous rival. Her father is very grateful, and very proud.', gold: 8, ally: 'mages' },
      { w: 1, text: 'The clasp gives, and the girl flies off still a swan, circling you three times. The chain is yours, and it is real gold.', gold: 15 },
      { w: 1, text: 'The girl splashes ashore and runs without a word. The lord’s man does not run. Every swan on the mere belongs to the lord, he says, and so did that one.', pay: 15 },
    ] },
    right: { label: 'Help net the swan', tile: 'manor', out: [
      { w: 2, text: 'The lord’s man nets her and tips you a few silver pennies. As they carry her off she stops struggling and looks at you, and does not look away.', gold: 6 },
      { w: 1, text: 'The lord pays well for the return of his swan, and better for your silence. He keeps her in a golden cage, and you try not to think about it.', gold: 18 },
      { w: 1, text: 'As the net comes down she beats you about the head with both wings. A swan can break a man’s arm, the lord’s man tells you afterwards, helpfully.', hp: -1 },
    ] },
  },

  /* ---------- tiers 2 and 3 ---------- */
  {
    id: 'b_unicorn', tier: [2, 3], biome: ['wood'],
    title: 'The Maiden and the Unicorn',
    text: 'In a glade, huntsmen with nets crouch in the bracken round a girl in white, who sits under an oak with her eyes shut, trembling. The bait. Their captain grins at you. "Unicorn horn fetches ten times its weight in gold. Keep still, and you get a share."',
    left: { label: 'Warn the unicorn', tile: 'grove', out: [
      { w: 2, text: 'You shout. A white shape at the edge of the glade wheels away, then stops, and comes back to you. It touches its horn to your brow, and every hurt and hex on you burns off like mist.', lift: true, hp: 2 },
      { w: 1, text: 'The unicorn is gone, and the girl in white runs with it, laughing. At the next abbey she tells the bishops what you did. The huntsmen tell you what they think, with cudgels.', ally: 'church', hp: -1 },
      { w: 1, text: 'The huntsmen are not pleased. They take your purse to pay for the unicorn they did not catch, and a tooth for the insult.', gold: -12, hp: -1 },
    ] },
    right: { label: 'Keep still for a share', tile: 'forest', out: [
      { w: 2, text: 'It comes, and lays its head in the girl’s lap, and the nets fall. It does not struggle. Your share is a sliver of horn on a cord, which the captain swears will turn any curse.', relic: 'aegis' },
      { w: 1, text: 'It kills three huntsmen before it dies. Your share of the horn sells for a fortune, but every night you dream of it, and wake more tired than you lay down.', gold: 25, hp: -1 },
      { w: 1, text: 'At the last moment the girl opens her eyes and screams a warning. The unicorn is gone. The captain looks at her, then at you, and decides it was your fault.', hp: -1 },
    ] },
  },
  {
    id: 'b_griffin_mother', tier: [2, 3], biome: ['hills', 'snow', 'moor'], needs: 'b_egg', w: 3,
    title: 'The Shadow at Noon',
    text: 'For three days a shadow has crossed your road at noon, round and round. Today it lands on the road ahead: the griffin whose egg you took, wings wide as a barn roof, beak like a ploughshare. She has come for her egg, or for whoever sold it.',
    left: { label: 'Stand and fight her', tile: 'mountain', fight: { foe: 'griffin', name: 'the Robbed Griffin', power: 8, dmg: 2,
      win: { text: 'She breaks off at last and climbs away into the clouds, screaming, and does not come back. On the road lies the gold ring she wore round one claw.', gold: 15 },
      lose: { text: 'She pins you under one claw and sniffs you all over for her egg. Finding only you, she flings you into a thornbush in disgust.', food: -1 } } },
    right: { label: 'Lead her to the showman', tile: 'village', out: [
      { w: 2, text: 'You lead her to the showman who bought her egg. She takes it back, and his roof, and a good deal of him. You slip away in the uproar with his cashbox.', gold: 18 },
      { w: 1, text: 'The showman sold the egg to a lord in {capital} a month ago. She takes that badly, and takes it out on you, from a great height.', hp: -2 },
      { w: 1, text: 'The egg has hatched in his barn. She gathers up her chick and forgets you entirely. The ruined showman drinks your health, bitterly, and stands you supper.', food: 2 },
    ] },
  },

  /* ---------- tier 3 ---------- */
  {
    id: 'b_griffin_friend', tier: 3, biome: ['hills', 'snow'], needs: 'b_chick', w: 3,
    title: 'Wings Over the Crag',
    text: 'A shadow falls across you, and you reach for your blade. But the griffin that lands on the rock above is young, and it chirrups, and cocks its head. It is the chick you carried home, grown vast, and it has not forgotten the smell of you.',
    left: { label: 'Climb onto its back', tile: 'mountain', out: [
      { w: 2, text: 'It carries you over three ranges in an afternoon, the whole kingdom spread below you like a map. You see where every road goes, and you remember it.', sight: 2, renown: 2 },
      { w: 1, text: 'It flies you to its mother’s old hoard on a crag no one can climb: knights’ harness, cups, a dead king’s purse. You take what you can carry, and a hauberk that fits.', gold: 20, item: 'scale' },
      { w: 1, text: 'It loops the loop for sheer joy, and you are not tied on. It catches you in its claws somewhere over a lake, just, and drops you in the shallows.', hp: -1 },
    ] },
    right: { label: 'Let it hunt for you', tile: 'forest', out: [
      { w: 2, text: 'It drops a whole stag at your feet, then another, then looks enormously proud of itself. You eat like a lord and smoke the rest for the road.', food: 4 },
      { w: 1, text: 'It brings you a stag and then, very pleased with itself, a live shepherd. You carry him home with apologies, and his wife feeds you both.', food: 2, renown: 1 },
      { w: 1, text: 'Before it flies, it leaves a feather as long as your arm at your feet. The next lord you meet offers you a purse for it, and you take it.', gold: 25 },
    ] },
  },
  {
    id: 'b_stone_garden', tier: 3, needs: 'b_cockatrice', w: 3,
    title: 'The Stone Garden at Stillwater',
    text: 'The apothecary’s garden at Stillwater is full of statues: a carter and his horse, a tinker in mid-sneeze, a small dog, the apothecary himself with his silver tongs. At the heart of it something with a rooster’s comb and a serpent’s tail is basking. It has grown.',
    left: { label: 'Fight it by its reflection', tile: 'ruins', fight: { foe: 'basilisk', name: 'the Stillwater Basilisk', power: 10, dmg: 2,
      win: { text: 'You fight with your eyes on your polished blade and never once look up. When it dies, the apothecary’s cabinet is yours to rifle: jars, salves, and one phial that still glows.', relic: 'rare' },
      lose: { text: 'Its glance catches you sidelong, and one arm goes to stone to the shoulder. It comes back to you slowly, over a week of hunger and pain.', food: -2 } } },
    right: { label: 'Buy a cockerel to crow at it', cost: 15, tile: 'farm', out: [
      { w: 2, text: 'At sunrise you drop the cockerel over the garden wall. It crows. The basilisk shrieks and thrashes and is still. In the apothecary’s house you find his strongbox and his salves.', gold: 30, hp: 1 },
      { w: 1, text: 'The cockerel crows and the basilisk dies. By noon the statues are waking, stiff and weeping, and the apothecary swears the Circle of the Tower will hear your name.', ally: 'mages', renown: 2 },
      { w: 1, text: 'The cockerel will not crow: wrong time of year, the farmer says later. The basilisk looks up at the squawking, and you look back before you can stop yourself.', hp: -2 },
    ], poor: { text: 'You cannot afford a cockerel, so you borrow one without asking. It crows at midnight, the farmer comes running, and the basilisk wakes. You get out of Stillwater, just.', hp: -1 } },
  },
  {
    id: 'b_golem_master', tier: 3, needs: 'b_golem', w: 3,
    title: 'Who Holds the Word',
    text: 'For days the golem has walked behind you, a hill of red clay that stops when you stop. Tonight a dwarf in a smith’s apron is waiting at your fire: its maker’s granddaughter. "That word is Deep Kin work," she says, "and he’s been lonely long enough."',
    left: { label: 'Give her the word', tile: 'smithy', out: [
      { w: 2, text: 'She takes the vellum like a letter from home. The golem kneels to her, and she gives you her grandmother’s hammer, and the friendship of the Deep Kin with it.', ally: 'dwarves', item: 'warhammer' },
      { w: 1, text: 'She speaks the word backwards, and the golem sighs into a heap of clay. She weeps over it all night, and in the morning she is gone, and has forgotten to thank you.' },
    ] },
    right: { label: 'Keep it, and set it digging', tile: 'mine', out: [
      { w: 3, text: 'You order it into the hill. It digs all night without a sound and comes up at dawn with a dwarf-lord’s grave-goods in its arms. The granddaughter spits, and goes.', gold: 30 },
      { w: 1, text: 'She gets to its tongue before you do. The golem lifts you by the collar, carries you a mile, drops you in a bog, and plods back to its new mistress.', hp: -1, food: -2 },
      { w: 1, text: 'It digs, and goes on digging, and the hillside comes down on the village below. You pay for every roof, and for the cow.', pay: 25 },
    ] },
  },
  {
    id: 'b_hydra', tier: 3, biome: ['fen', 'lake'],
    title: 'The Hydra of Sallow Fen',
    text: 'The eel-men of Sallow Fen have lost nine boats and a bishop to the hydra this summer. It lies in the black water with seven heads up, dozing, and two more growing. The headman holds out a torch and a pot of pitch. "Cut a head, burn the stump. Or it grows two."',
    left: { label: 'Take its heads', tile: 'swamp', fight: { foe: 'hydra', name: 'the Hydra of Sallow Fen', power: 12, dmg: 2, elite: true,
      win: { text: 'Head by head, stump by stump, until the fen stinks of pitch and the black water is still. The Marcher lord who holds the fen pays the bounty himself, and remembers your name.', gold: 25, ally: 'lords' },
      lose: { text: 'You cut one head and forget the pitch. Two come back, then four. The eel-men drag you out of the water by your hair, and you leave them to their fen.', food: -1 } } },
    right: { label: 'Fire the reedbeds', tile: 'bonfire', out: [
      { w: 2, text: 'At dusk you and the eel-men fire the reeds all round its pool. The hydra thrashes in a ring of flame until it sinks. The fen-folk carry you shoulder-high and name their babies after you.', trait: 'beloved' },
      { w: 1, text: 'When the smoke clears, the hydra has fled down the deep channel, and the fen gives up a century of drowned boats. The eel-men share the salvage with you.', gold: 20 },
      { w: 1, text: 'The fire takes, and then the wind turns. The eel-men’s village burns with the reeds, and the hydra swims off, sulking, through the smoke.', hp: -1, food: -2 },
    ] },
  },
  {
    id: 'b_labyrinth', tier: 3, biome: ['hills', 'waste'],
    title: 'The Labyrinth of Cold Harrow',
    text: 'Under the ruined palace of Cold Harrow runs a labyrinth, and in it, they say, lives the old lord’s son: born with a bull’s head, walled in for shame forty years ago. A girl at the gate sells balls of red thread. Heroes go in. None come out.',
    left: { label: 'Go in with her thread', cost: 15, tile: 'ruins', out: [
      { w: 2, text: 'The thread leads you to a room full of the heroes who came before, and their gear, still bright. You strip a dead man’s plate harness and follow the red thread home.', item: 'plate' },
      { w: 1, text: 'At the heart of the maze you meet him: huge, horned, and weeping at the sight of a face.', fight: { foe: 'minotaur', name: 'the Lord of Cold Harrow', power: 10, dmg: 2,
        win: { text: 'He falls, and with his last breath thanks you, in a man’s voice. The village rings its bells all night. Under his straw lie forty years of heroes’ purses.', gold: 30 },
        lose: { text: 'He throws you against the walls until you stop getting up, then carries you, gently, back to the gate, and goes back into the dark.', food: -1 } } },
    ], poor: { text: 'You cannot pay for thread, so you chalk the walls as you go. Somebody in the dark rubs the marks out behind you. You find the gate on the third day, starving.', food: -3 } },
    right: { label: 'Talk to him through the wall', tile: 'ruins', out: [
      { w: 2, text: 'You talk through a crack in the stone till dawn. He has not heard a kind voice in forty years. At sunrise he pushes a gold cup through the crack: all he has to give.', gold: 25 },
      { w: 1, text: 'He begs you to open the gate, and you do. He walks into the sunlight blinking, and the village flees. He gives you his mother’s ring, and the ballad-makers the rest.', gold: 10, renown: 2 },
      { w: 1, text: 'You talk all night and cannot find your way out in the morning: left, left, left, for days. Ever after, your feet refuse to take the same turn three times running.', food: -1, trait: 'weathervane' },
    ] },
  },
  {
    id: 'b_bear_king', tier: 3, biome: ['wood', 'snow'],
    title: 'The Bear Who Wore a Crown',
    text: 'In the oldest part of the wood sits a bear as big as a byre, grey with age, and grown into its skull is a rusted iron crown. Charcoal-burners leave it honey and bow as they pass. It was a king once, they say, and it still remembers how.',
    left: { label: 'Take the crown from it', tile: 'forest', fight: { foe: 'bear', name: 'the Crowned Bear', power: 10, dmg: 2,
      win: { text: 'At last it bows its great grey head and lets you lift the crown away, iron and old gold. When you raise it, the charcoal-burners kneel to you without meaning to.', claim: 1, renown: 2 },
      lose: { text: 'It swats you into a bramble brake without getting up, and goes back to its honey. The charcoal-burners pull you out, shaking their heads.', food: -1 } } },
    right: { label: 'Bring it honey and bow', tile: 'grove', out: [
      { w: 2, text: 'You bow low. The bear-king considers you a long while, then lays one great paw on your head, like a blessing. You walk out of the wood with your heart beating slow and strong.', trait: 'stout_heart' },
      { w: 1, text: 'The charcoal-burners, pleased with your manners, share their fire and their stew, and show you a path through the wood that no one else knows.', food: 2, sight: 1 },
      { w: 1, text: 'It eats your honey, then your bread, then falls asleep on your foot. You are there till dawn.', food: -2 },
    ] },
  },
  {
    id: 'b_monster_hunter', tier: 3, biome: ['snow', 'moor'],
    title: 'Dame Hesper’s Last Hunt',
    text: 'Dame Hesper Gall, monster-hunter, has one arm, one eye, and a wagon hung with the heads of things you have only heard of in songs. Tonight she goes after the wendigo of the Long Moor, and she needs a second spear. Or, for the right price, a buyer.',
    left: { label: 'Carry her second spear', tile: 'forest', fight: { foe: 'wendigo', name: 'the Wendigo of the Long Moor', power: 9, dmg: 2,
      win: { text: 'Her spear goes in first and yours second, and the thing comes down among the pines like a felled tree. Hesper cuts you a fair share of the bounty, and tells the tale everywhere.', gold: 30, renown: 2 },
      lose: { text: 'The wendigo takes Hesper’s other arm and runs. You carry her back to her wagon, and she swears the whole way, which is a good sign.', food: -2 } } },
    right: { label: 'Buy from her wagon', tile: 'camp', shop: 'smith', out: [
      { text: 'Hesper sells blades she has tested on things with too many heads, and mail a manticore could not bite through. "All of it used," she says. "Once."' },
    ] },
  },
];
