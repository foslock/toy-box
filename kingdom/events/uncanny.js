// Kingdom: the uncanny. The Hidden Folk and their bargains, witches, wizards and alchemists, the restless dead, cursed
// things, dreams, saints and prophecies that come true the wrong way. Events for the journey (see rules.js for every id).
//
// Chains: u_shadowless (the Man Who Buys Shadows → the Shadow Comes Home), u_blow_owed (the Midsummer Guest → the Green
// Chapel), u_fey_sight (a Knock After Midnight → Which Eye?), u_foretold (the Anchoress’s Window → the Barley Crown),
// u_invited (the Black Carriage → Supper at Castle Morrow).
export default [
  /* ---------- tier 1 ---------- */
  {
    id: 'u_shadow_buyer', tier: 1, biome: ['farm', 'moor'],
    title: 'The Man Who Buys Shadows',
    text: 'A gentleman in a dust-grey coat is measuring shadows on the road with a folding rule. His pockets bulge with them, folded like linen. He looks at yours and sighs with pleasure. "A fine long one. Fifteen gold, and you won’t miss it till evening."',
    left: { label: 'Sell him your shadow', tile: 'road', out: [
      { w: 3, text: 'He snips it off at the heels with silver scissors and folds it away, still twitching. The gold is cold as well-water. Your feet look oddly bare on the road now.', gold: 15, flag: 'u_shadowless' },
      { w: 1, text: 'He snips it free, pays, and adds some advice for nothing: "Keep out of mirrors." Without a shadow, you find, you can see a little further into the dark.', gold: 15, sight: 1, flag: 'u_shadowless' },
    ] },
    right: { label: 'Buy a shadow from him', cost: 8, tile: 'road', out: [
      { w: 2, text: 'He unfolds the lean grey shadow of a hunting hound and stitches it to your heels. It growls at things you cannot see yet, and you learn to listen.', sight: 2 },
      { w: 1, text: 'He sells you a tinker’s shadow, still whistling. Wherever it falls, a copper turns up in the dust, and one of them is lucky.', relic: 'tinker_coin' },
      { w: 1, text: 'He sells you a thief’s shadow. By morning it has slipped its stitches and gone, with a fistful of your coins and one of your boots.', gold: -5 },
    ], poor: { text: 'You have no coin, so he snips a corner off your shadow "as a sample" and walks off whistling. You feel the draught of it all day, like a missed step.', hp: -1 } },
  },
  {
    id: 'u_green_guest', tier: 1, biome: ['wood', 'hills'],
    title: 'The Midsummer Guest',
    text: 'On Midsummer Night a knight rides into the inn, ducking the beams: leaf-green mail, silver hair, a woodman’s axe. "A game," he says. "Strike off my head tonight, and in a season I strike off yours." The whole taproom turns to look at you.',
    left: { label: 'Take up his axe', tile: 'tavern', out: [
      { w: 3, text: 'One stroke. The body picks its head up by the hair. "The Green Chapel, {name}, when the leaves turn," says the head. You never told it your name. The inn stands you supper.', renown: 2, food: 2, flag: 'u_blow_owed' },
      { w: 1, text: 'One stroke. The body gathers up its head, and the head winks. "Nerve. I like nerve. Until the Green Chapel, then." Where it rolled lies a purse of pale fey gold.', gold: 12, renown: 1, flag: 'u_blow_owed' },
    ] },
    right: { label: 'Stare into your ale', tile: 'tavern', out: [
      { w: 2, text: 'Nobody takes up the game. The knight laughs at the whole taproom and rides out through the wall. The landlord, shaken, stands everyone supper.', food: 2 },
      { w: 1, text: 'As he goes, he leans from the saddle and looks at you a long while. "Wise," he says, and drops a silver acorn by your cup. Held to your ear, it whispers.', sight: 2 },
      { w: 1, text: 'He rides out through the wall. The landlord bills everyone in the taproom for it, and his cousin the reeve sees that you pay.', gold: -6 },
    ] },
  },
  {
    id: 'u_midnight_knock', tier: 1, biome: ['wood', 'moor'],
    title: 'A Knock After Midnight',
    text: 'Past midnight a tall man in green shakes you awake. His eyes are the colour of pond-ice, and his boots leave no print in the frost. "My wife’s time has come, and there is no one else," he begs. "Come quickly. I pay in gold."',
    left: { label: 'Go with him', tile: 'fairy_ring', out: [
      { w: 3, text: 'Under a hill that was not there at sunset you deliver a fey child, and anoint its eyes as the father bids. A smear gets in your own. His gold is leaves by dawn, but your eye is changed.', trait: 'second_sight', flag: 'u_fey_sight' },
      { w: 1, text: 'The birth is long and hard, and it is dawn before the fey child cries. Your hands shake for a day. The father pays in gold that stays gold, and the mother sends honey-cakes.', gold: 12, hp: -1, food: 2 },
    ] },
    right: { label: 'Send him to the village', tile: 'village', out: [
      { w: 2, text: 'Old Goody Blewitt, the midwife, goes with him grumbling. At dawn she comes back humming, with a purse of gold that stays gold, and shares it with you for the fetching.', gold: 10 },
      { w: 1, text: 'Goody Blewitt goes with him and does not come back. The village blames the stranger who sent her, and you leave without breakfast, under a hail of turnips.', food: -1 },
      { w: 1, text: 'He will not wait, and runs off alone into the dark. At dawn he is back, grey with tiredness and smiling, and leaves a loaf of fey bread on your blanket. It lasts a week.', food: 3 },
    ] },
  },
  {
    id: 'u_anchoress', tier: 1, biome: ['farm', 'fen'],
    title: 'The Anchoress’s Window',
    text: 'Mother Idony was walled into the side of Saint Ancel’s church forty years ago, and speaks to travellers through a slit in the stones. A thin hand comes out, palm up. "Bread for a prophecy," she says. "Or bread for nothing. I am not proud."',
    left: { label: 'Bread for a prophecy', tile: 'chapel', out: [
      { w: 3, text: 'She eats slowly. "You will be crowned," she says, "with the people cheering, before the leaves are down." Then she shuts her little shutter, and will not say another word.', food: -1, sight: 1, flag: 'u_foretold' },
      { w: 1, text: '"You will go into the dark and come out with more than you took," she says. Not much of a prophecy, but she also names the roads to avoid this year, and why.', food: -1, sight: 2 },
    ] },
    right: { label: 'Bread for nothing', tile: 'chapel', out: [
      { w: 2, text: 'She eats half, blesses the rest in a voice like an old hinge, and passes it back through the slit. The ache in your bones goes quiet, as if someone had shut a door on it.', hp: 1 },
      { w: 1, text: 'Out comes her hand again, holding a twist of salt blessed forty years in the dark. "For when the dead get up," she says. "They will."', food: -1, relic: 'salt' },
      { w: 1, text: 'She eats, thanks you, and falls quiet. At dusk the sexton finds she has gone to her rest, smiling. The parish feeds you for being her last kindness.', food: 3, renown: 1 },
    ] },
  },
  {
    id: 'u_pie_shop', tier: 1, biome: ['farm', 'lake'],
    title: 'Old Crumb’s Pies',
    text: 'The pies at Old Crumb’s shop are the best in three parishes, and the cheapest, and nobody asks what is in them. Crumb is grey as a mushroom and thin as a rake. The churchyard behind his shop is, you notice, very freshly dug.',
    left: { label: 'Buy a dozen pies', cost: 5, tile: 'village', out: [
      { w: 3, text: 'Dark, peppery pies with a crust like a church roof. You eat three on the doorstep and decide not to wonder about anything.', food: 3 },
      { w: 1, text: 'In the fourth pie you bite on a wedding ring. You stop eating. You keep the ring, and are sick behind the lychgate.', gold: 8 },
    ], poor: { text: 'You have no coin. Crumb gives you a pie anyway, "for later", and watches you go with his head on one side, like a thrush watching a worm.', food: 1 } },
    right: { label: 'Follow him at midnight', tile: 'graveyard', out: [
      { w: 2, text: 'At midnight Crumb goes over the churchyard wall with a spade and a pie-dish. He sniffs the air, turns, and smiles. His teeth are very long.', fight: { foe: 'ghoul', name: 'Old Crumb', power: 5, dmg: 1,
        win: { text: 'Crumb goes down among the headstones with a hiss like a kettle. The parish pays a reward, and in his cellar, among the pie-dishes, lies a woodcutter’s axe.', gold: 8, item: 'axe' },
        lose: { text: 'He bites like a dog and chases you out of the parish. You leave behind your hat, your supper and a little of your ear.', food: -1 } } },
      { w: 1, text: 'At midnight Crumb kneels at his wife’s grave and tells her all about the day’s baking. You feel like a thief. In the morning he gives you a pie, and you do not ask.', food: 2 },
    ] },
  },
  {
    id: 'u_skull_sill', tier: 1, biome: ['moor', 'hills'],
    title: 'The Skull on the Sill',
    text: 'A brown old skull sits on the kitchen sill at Scarrow Farm. The new farmer wants rid of it, but it has been buried nine times, and nine times it screamed the house down until it was dug up again. He offers you eight gold to take it away.',
    left: { label: 'Take the skull away', tile: 'graveyard', out: [
      { w: 2, text: 'You bury it in the churchyard at dusk. It screams till midnight, then sighs and says, quite clearly, "Oh, very well." The farmer pays you, and adds a ham.', gold: 8, food: 2 },
      { w: 1, text: 'At the lychgate a headless man in a smock is waiting. He wants his head back, and he wants a word with whoever has been carrying it about.', fight: { foe: 'ghost', name: 'the Headless Farmer', power: 4, dmg: 1,
        win: { text: 'You wrestle him into his grave and his skull in after him, and this time both stay put. The farmer pays you twice over.', gold: 15 },
        lose: { text: 'He snatches his head back, boxes your ears with it, and carries it home to the windowsill. The farmer does not pay.', food: -1 } } },
      { w: 1, text: 'It screams the whole way down the road, and every dog in the parish follows you. The farmer’s wife pays you double, just for the silence.', gold: 15 },
    ] },
    right: { label: 'Ask it what it wants', tile: 'farm', out: [
      { w: 2, text: 'It only wants a view. You turn it to face the barley, and it creaks its thanks and tells you, in a voice like a door, which roads are unlucky this year.', sight: 2 },
      { w: 1, text: 'It farmed here three hundred years ago, and it hates the new roof. It tells you where it hid its savings under the hearthstone, if you’ll split them.', gold: 12 },
      { w: 1, text: 'It does not answer. The farmer finds you whispering to a skull and sets the dogs on you, which the skull seems to enjoy.', hp: -1 },
    ] },
  },
  {
    id: 'u_weather_knots', tier: 1, biome: ['farm', 'hills'],
    title: 'Three Knots of Wind',
    text: 'A weather-witch sits on the mill steps selling winds, each tied up in a knot of red cord. The miller’s sails hang dead; he cannot afford one. "One knot for a breeze," she says. "Two for a gale. And never, ever three."',
    left: { label: 'Buy a cord of knots', cost: 8, tile: 'mill', out: [
      { w: 2, text: 'You untie one knot for the miller. The sails wake with a groan and turn all afternoon, and he pays you in flour and warm loaves.', food: 3 },
      { w: 1, text: 'You untie two, to be sure. The gale takes the miller’s roof, the miller’s hat and very nearly the miller. He pays you nothing, loudly.', hp: -1 },
      { w: 1, text: 'You keep the cord for later. On a still, stifling day three villages on, you loose a knot, and the breeze brings you news of the road ahead.', sight: 2 },
    ], poor: { text: 'You have no coin, so she sells you a knot of breath for a kiss on her whiskery cheek. It turns out to be a sneeze, and a cold that lasts a week.', hp: -1 } },
    right: { label: 'Snatch it, untie all three', tile: 'farm', out: [
      { w: 2, text: 'The storm comes out of the knot like a bull out of a gate. It flattens her stall and a mile of wheat, then rains down fish, silver pennies and one surprised goose.', gold: 10, food: 2 },
      { w: 1, text: 'The storm picks you up by the collar and sets you down in the next parish, in a pond, without your boots or your breakfast.', hp: -1, food: -1 },
      { w: 1, text: 'She catches your wrist before the third knot. "Never three," she says, and ties a knot in your road instead. You can never again go the same way three times running.', trait: 'weathervane' },
    ] },
  },
  {
    id: 'u_other_sky', tier: 1, biome: ['waste', 'moor'],
    title: 'The Well With Another Sky',
    text: 'At the bottom of an old dry well, instead of water, there is sky: a green evening sky with two moons in it. Someone down there is looking up at you. A bucket rises on the rope with a note in it, in a careful hand: TRADE?',
    left: { label: 'Send down your bread', tile: 'well', out: [
      { w: 2, text: 'The bucket comes back with blue bread that tastes of pepper and summer, enough for days, and a coin with a hole in it and a face you do not know.', food: 2, gold: 6 },
      { w: 1, text: 'The bucket comes back with a stub of candle that burns without melting, and a note: THANK YOU, in a hand very like your own.', food: -1, relic: 'candle' },
      { w: 1, text: 'The bucket comes back empty, with a note: MORE. You stop there, a loaf the poorer, and something a long way down laughs at you.', food: -1 },
    ] },
    right: { label: 'Climb down the rope', tile: 'portal', out: [
      { w: 2, text: 'Somewhere the rope turns over and you are climbing up, into a green country where boots are a wonder. They buy yours with glass coins that smiths at home pay silver for.', gold: 15 },
      { w: 1, text: 'Halfway, the rope turns over, and so does your stomach. You climb out of the same well a day later, hungry, with two moons still in your eyes. You see further for it.', food: -1, sight: 2 },
      { w: 1, text: 'Halfway, you meet something coming up: wings, claws, and a woman’s face gone hungry.', fight: { foe: 'harpy', name: 'the Thing From Below', power: 5, dmg: 1,
        win: { text: 'It tumbles back down into its own sky, shrieking, and leaves a scatter of strange gold coins and grey feathers on the well-rim.', gold: 10 },
        lose: { text: 'It rakes your arms, snatches your bread and dives back into the green sky with it. The note that comes up afterwards says SORRY.', food: -2 } } },
    ] },
  },
  {
    id: 'u_dream_pedlar', tier: 1, biome: ['wood', 'fen'],
    title: 'The Dream-Pedlar',
    text: 'A pedlar’s cart is hung with stoppered bottles, and in each a dream swirls like smoke: flying, feasting, your mother’s kitchen, the place where the old gold lies buried. "One dram, one night," he says. "Money back if you wake up."',
    left: { label: 'Browse his bottles', tile: 'camp', shop: 'witch', out: [
      { text: 'He shares his stew while you browse, and uncorks a few for you to sniff: rain on a roof, a first kiss, a nightmare for your enemies. On the bottom shelf he keeps the useful bottles.', food: 1 },
    ] },
    right: { label: 'Buy the dream of gold', cost: 6, tile: 'grove', out: [
      { w: 2, text: 'You dream of an oak split by lightning and a crock among its roots. A mile down the road next morning, there is the oak. There is the crock.', gold: 15 },
      { w: 1, text: 'You dream of the gold all night, and of something coiled round it wearing your face. You wake shouting, and your supper has gone the way of the pedlar.', food: -1 },
      { w: 1, text: 'You dream of the gold, and of the road to it, and of every turning on the way. The gold is a dream. The turnings are not.', sight: 2 },
    ], poor: { text: 'You have no coin, so he lets you sniff the cork of a nightmare for free. You do not sleep for two nights, and neither does anyone camped near you.', hp: -1 } },
  },

  /* ---------- tier 2 ---------- */
  {
    id: 'u_black_carriage', tier: 2, biome: ['moor', 'wood', 'hills'],
    title: 'The Black Carriage',
    text: 'A black carriage stands in the road, its coachman slumped dead on the box with his throat torn. Behind the velvet blind a lady asks, very politely, if you can drive. "My house is ten miles on, and I cannot bear the sun. It is nearly dawn."',
    left: { label: 'Drive her home', tile: 'castle', out: [
      { w: 3, text: 'You whip the horses through the last of the dark and reach her gate as the sky greys. A white hand passes a purse through the blind. "Do dine with me one evening. I insist."', gold: 15, flag: 'u_invited' },
      { w: 1, text: 'At a ford the blind lifts, and she is at your neck before you can turn. She takes only a little, apologises beautifully, and pays you double at her gate.', hp: -1, gold: 20, flag: 'u_invited' },
    ] },
    right: { label: 'Tear open the blind', tile: 'road', out: [
      { w: 2, text: 'Grey dawn floods the carriage. Something shrieks like a gull, and then there is only a heap of black lace and dust, and a jewel-box that is very much yours now.', gold: 15 },
      { w: 1, text: 'The blind is faster than you. She pours out of the carriage like smoke, and the sun is still a minute off.', fight: { foe: 'vampire', name: 'the Lady in the Carriage', power: 8, dmg: 2,
        win: { text: 'You hold her off until the sun clears the hill. She burns like paper, the horses are very glad, and her jewel-box is yours.', gold: 20 },
        lose: { text: 'She drinks her fill and leaves you pale in the road. The carriage is gone with the dawn, and so, for a while, is your appetite.', food: -1 } } },
    ] },
  },
  {
    id: 'u_banshee', tier: 2, biome: ['lake', 'moor'],
    title: 'The Keening at Owlcote',
    text: 'All night a woman in grey has sat on the wall of Owlcote Manor, combing her long white hair and keening. The household knows what that means. The old steward grips your arm. "Drive her off, for pity’s sake. The young master is only nine."',
    left: { label: 'Drive her off', tile: 'manor', fight: { foe: 'banshee', name: 'the Grey Woman', power: 7, dmg: 1,
      win: { text: 'Your iron stings her like a wasp. She shrieks, drops her bone comb and is gone. The steward weeps with relief, and takes the old lord’s sword down from over the hearth for you.', gold: 8, item: 'longsword' },
      lose: { text: 'Her scream goes through you like frost through a pane. You wake in the rose-bed at noon, deaf in one ear, and the keening goes on.', food: -1 } } },
    right: { label: 'Ask whom she keens for', tile: 'manor', out: [
      { w: 2, text: 'She turns her grey face to you. "Not the boy. The steward." The old man dies at dawn in his chair, having left you his savings in a will he wrote at midnight.', gold: 12 },
      { w: 1, text: '"For you," she says, "but not yet." She tells you how you will die. It is a long way off, and rather funny, and you walk on lighter than you have in years.', hp: 1, sight: 1 },
      { w: 1, text: '"For myself," she says. She was the lady here three hundred years ago, and nobody keened for her. You sit with her till dawn, and when she fades, the whole house sleeps sound, and so do you.', renown: 2, hp: 1 },
    ] },
  },
  {
    id: 'u_stolen_saint', tier: 2, biome: ['fen', 'farm'],
    title: 'The Stolen Saint',
    text: 'The monks of Candlemere stole the bones of Saint Bryony from the monks of Dunstowe, who stole them first. Now Dunstowe’s prior wants her back, and will pay. Saint Bryony, in her little gilt box on Candlemere’s altar, has so far expressed no opinion.',
    left: { label: 'Steal her back', tile: 'abbey', out: [
      { w: 2, text: 'You lift her from the altar during matins. The box is light as a loaf and hums as you pass the gate. Dunstowe’s prior pays you, weeps, and writes to his bishop about you.', gold: 18, ally: 'church' },
      { w: 1, text: 'The box grows heavier with every step, until at the gate you cannot lift it at all. Saint Bryony likes Candlemere. The monks find you sitting on her, and the abbot names a fine.', pay: 15 },
      { w: 1, text: 'Halfway to Dunstowe the box speaks. "Put me down by the ford. I was born there." You build her a cairn, and whatever has been dogging you washes away downstream.', lift: true, hp: 2 },
    ] },
    right: { label: 'Take pay from both abbeys', tile: 'chapel', out: [
      { w: 2, text: 'Both abbeys pay you to guard her from the other. You sleep two nights in her chapel with a purse from each prior, and think yourself a genius.', gold: 20 },
      { w: 1, text: 'The two priors compare notes. You leave both abbeys at a run, pelted with psalters.', hp: -1 },
      { w: 1, text: 'Saint Bryony, it seems, disapproves. The next ford you cross rises to your chin out of a clear sky, and carries your pack off downstream.', food: -2 },
    ] },
  },
  {
    id: 'u_hand_of_glory', tier: 2,
    title: 'The Hand of Glory',
    text: 'In a dripping alley a thief shows you a hanged man’s hand, pickled and dried, with a wick in every finger. "Light it at a rich man’s door and nobody in the house will wake till it’s snuffed. Hold it for me tonight, and take a share."',
    left: { label: 'Hold the hand for him', tile: 'manor', out: [
      { w: 2, text: 'Five blue flames. The whole house of Squire Ammet sleeps like the dead while you fill sacks. The thief splits fair, and whispers your name to the Quiet Hand.', gold: 20, ally: 'guild' },
      { w: 1, text: 'One finger will not light: someone in the house is awake. It is the squire’s mastiff, and it has waited all its life for this.', fight: { foe: 'wolf', name: 'the Squire’s Mastiff', power: 6, dmg: 1,
        win: { text: 'You and the mastiff come to an understanding over a cold leg of ham. You leave with the silver, and the ham.', gold: 15, food: 2 },
        lose: { text: 'The mastiff takes a piece of your leg, the thief takes everything else, and the dawn takes its time.', food: -1 } } },
      { w: 1, text: 'The house sleeps, and so, somehow, do you. You wake at noon with the squire standing over you, and the magistrate standing over him.', pay: 15 },
    ] },
    right: { label: 'See what else he sells', tile: 'tavern', shop: 'fence', out: [
      { text: 'He opens his coat. It is lined with other people’s things: rings, a bishop’s spoon, a sword with somebody else’s name on it. "All honestly stolen," he says.' },
    ] },
  },
  {
    id: 'u_sleeping_village', tier: 2, biome: ['farm', 'fen'],
    title: 'The Village That Sleeps',
    text: 'In Nodding Barrow everyone is asleep: the smith at his anvil, the goose-girl in the lane, the cat mid-pounce. They have slept since midsummer, says the one girl awake, since the woman with the spindle came to lodge at the mill.',
    left: { label: 'Go to the mill', tile: 'mill', fight: { foe: 'witch', name: 'the Spinning Woman', power: 7, dmg: 2,
      win: { text: 'You snap her spindle across your knee. All over Nodding Barrow folk wake up yawning and feed you till your belt creaks, and the smith beats you out a mace for your trouble.', food: 3, item: 'mace' },
      lose: { text: 'She hums, and your eyes close. You wake on the mill floor a week later, starving, and she has spun your hair into her wool.', food: -2 } } },
    right: { label: 'Rob the sleepers', tile: 'village', out: [
      { w: 2, text: 'Nobody stops you. You fill your pack with ham and your purse with the smith’s savings. The girl watches from a doorway and says nothing, and you will remember her face.', gold: 15, food: 2 },
      { w: 1, text: 'You sit down in the inn to eat a sleeper’s supper, and the lullaby finds you too. You wake in autumn with your hair to your waist and your pack eaten by mice.', food: -3 },
      { w: 1, text: 'On the reeve’s strongbox lies a note in a spidery hand: "Take it. They were never kind to me." You take it, and do not look back at the mill.', gold: 20 },
    ] },
  },
  {
    id: 'u_lovesick_knight', tier: 2, biome: ['farm', 'lake'],
    title: 'The Lovesick Knight',
    text: 'A knight of the Hidden Folk, all leaf and silver, sits sighing on a stile. He loves the dairymaid at Clovercombe, and has left a dead stag, a live swan and a small thunderstorm on her doorstep. She will not come out. "What do mortals want?"',
    left: { label: 'Teach him to woo', tile: 'orchard', out: [
      { w: 2, text: 'You teach him flowers, poems and knocking. By dusk she is laughing at his poems, which are dreadful. He weeps tears of real silver into your palm and names you a friend of the Fey Court.', ally: 'fey', gold: 10 },
      { w: 1, text: 'She comes out, looks him up and down, and says she is marrying the blacksmith. The knight’s grief breaks as a thunderstorm, and it follows you, personally, for three days.', food: -2 },
      { w: 1, text: 'She loves him. They are gone under the hill before supper, and her father blames you, loudly, with a flail.', hp: -1 },
    ] },
    right: { label: 'Court her yourself', tile: 'farm', out: [
      { w: 2, text: 'You knock, with a fistful of cowslips, like a person. She is so relieved she feeds you supper, and her mother packs you enough cheese for a week.', food: 3 },
      { w: 1, text: 'The knight watches from the stile, and his face goes very still. "Iron or silver?" he asks, and draws a sword like a moonbeam.', fight: { foe: 'fey_knight', name: 'the Lovesick Knight', power: 8, dmg: 2,
        win: { text: 'You beat him fair in the farmyard with the whole dairy watching. He bows, weeps, and pays the forfeit in fey gold, and the dairymaid kisses you for the show.', gold: 15, renown: 2 },
        lose: { text: 'He hangs you from the barn door by your belt and rides off singing. The dairymaid cuts you down, eventually.' } } },
      { w: 1, text: 'She laughs you off the doorstep. The knight laughs from his stile. Even the swan laughs.' },
    ] },
  },
  {
    id: 'u_counting_golem', tier: 2, biome: ['hills', 'waste'],
    title: 'The Counting Golem',
    text: 'The alchemist Ambrose Quell’s clay servant has locked itself in his cellar with all his gold, and will not open. "It learned to count," Quell wails. "Then it learned to want." Through the grate it is counting, in a voice like a millstone.',
    left: { label: 'Break down the door', tile: 'wizard_tower', fight: { foe: 'golem', name: 'the Counting Golem', power: 9, dmg: 2,
      win: { text: 'It crumbles into good red clay and bad temper. Quell weeps over his gold and counts you out a share of it, twice, to be sure.', gold: 25 },
      lose: { text: 'It picks you up, turns you over like a coin, and posts you out through the grate, a little at a time.' } } },
    right: { label: 'Teach it to spend', tile: 'market', out: [
      { w: 2, text: 'You talk to it through the grate about markets, and pies, and the joy of new boots. At last it opens the door and strolls off to see the world, dropping coins at every step.', gold: 15 },
      { w: 1, text: 'It listens, and learns, and sets up as a moneylender. Its first customer is you, and it takes interest on the conversation out of your purse.', gold: -10 },
      { w: 1, text: 'It opens the door, hands you a gold bar with great ceremony, and walks into the river to think. Some things should not be made to want.', gold: 20 },
    ] },
  },
  {
    id: 'u_glimmerdale', tier: 2, biome: ['hills', 'lake'],
    title: 'The Wizards of Glimmerdale',
    text: 'For forty years Magister Orme and Magistra Vey have feuded across Glimmerdale from their two towers. It rains frogs on Tuesdays and the sheep are blue. This morning each of them stops you with a sealed parcel for the other. "Don’t open it."',
    left: { label: 'Deliver them unopened', tile: 'wizard_tower', out: [
      { w: 2, text: 'Orme opens his and goes pale. Vey opens hers and sits down on her step. Neither will say what was inside, but by morning the sheep are white, and both towers send you gifts.', ally: 'mages', gold: 10 },
      { w: 1, text: 'Both parcels go off at once, one at each door. The towers are delighted with each other. You are blue for a week, and bald for a month.', hp: -1 },
      { w: 1, text: 'Each parcel holds a love letter written forty years ago and never sent. The wizards meet in the middle of the dale, and the whole valley throws the wedding feast.', food: 3, renown: 1 },
    ] },
    right: { label: 'Open the parcels', tile: 'road', out: [
      { w: 2, text: 'Orme’s holds spectacles that show tomorrow. Vey’s holds a note that says only "Sorry." You keep the spectacles and deliver the note, and a week later the sheep go white.', sight: 2 },
      { w: 1, text: 'Both parcels hold the same curse, and it has waited forty years to get out. From that day, whatever you do, you do twice.', trait: 'twin_step' },
      { w: 1, text: 'Vey’s holds a cake that tastes of her kitchen forty years ago. You eat it in the road, and cry a little, and feel much better. Orme will have to wonder.', hp: 1 },
    ] },
  },
  {
    id: 'u_poppet', tier: 2, biome: ['wood', 'fen'],
    title: 'A Poppet in Your Likeness',
    text: 'In a hollow tree you find a little wax figure in a scrap of your own cloak, with a hair of yours pressed into its head and a thorn through its knee. Your knee, you realise, has ached since the last village.',
    left: { label: 'Draw out the thorn', tile: 'forest', out: [
      { w: 2, text: 'The thorn comes out, and the ache with it. You wrap the poppet in moss and keep it warm in your shirt, just in case, and sleep better than you have in weeks.', hp: 1, lift: true },
      { w: 1, text: 'The thorn comes out, and so does a bead of real blood, from the wax. Your knee gives way, and something in the hollow tree laughs.', hp: -1 },
    ] },
    right: { label: 'Take it to the wise-woman', cost: 10, tile: 'witch_hut', out: [
      { w: 2, text: 'Old Nan unpicks the charm with a bone needle, muttering. The ache goes, and she tells you who made it: a girl two villages back, whose apples you praised and did not buy.', lift: true, hp: 1 },
      { w: 1, text: 'Nan unpicks it, and keeps your hair "for safety", and smiles a small smile. You leave feeling you have swapped one poppet for another.' },
      { w: 1, text: 'Nan takes one look and goes white. "That’s my granddaughter’s work." She makes you soup by way of apology, and slips a charm into your pack.', food: 2, relic: 'random' },
    ], poor: { text: 'You haven’t her fee, so Nan tells you to sleep with your boots on the wrong feet. It helps, a little.', hp: 1 } },
  },

  /* ---------- tiers 2 and 3 ---------- */
  {
    id: 'u_which_eye', tier: [2, 3], needs: 'u_fey_sight', w: 3,
    title: 'Which Eye?',
    text: 'At a market you see the man in green whose child you delivered. He is filching apples from a stall, and no one sees him but you. Before you can stop yourself, you call out a greeting. He goes very still. "Which eye do you see me with?"',
    left: { label: 'Tell him the truth', tile: 'market', out: [
      { w: 2, text: '"This one," you say. He looks at you a long while, then laughs. "Honest. My wife said you would be." He lets you keep the eye, and the Fey Court hears of it.', ally: 'fey' },
      { w: 2, text: '"This one," you say. He leans close and blows into it, gently, like a man snuffing a candle. That eye sees only grey after, and half the road goes grey with it.', trait: 'veil' },
    ] },
    right: { label: 'Point to the wrong eye', tile: 'market', out: [
      { w: 2, text: 'He puts a cold thumb to the wrong eye, murmurs something, and strolls off satisfied. You watch him all the way down the street, and he never knows.', sight: 2 },
      { w: 1, text: 'He is not fooled. "The other one, then," he says kindly, and touches it, and the world half-darkens.', trait: 'veil' },
      { w: 1, text: '"Liar," he says, delighted. "A good one, too." And he pays you for the midwifery at last, in gold that stays gold.', gold: 20 },
    ] },
  },

  /* ---------- tier 3 ---------- */
  {
    id: 'u_green_chapel', tier: 3, needs: 'u_blow_owed', w: 3,
    title: 'The Green Chapel',
    text: 'The leaves have turned. In a hollow of the wood stands a chapel of living hawthorn, and the green knight waits inside, whetting his axe on the altar step, his head back on his shoulders. "You came," he says, pleased. "Kneel."',
    left: { label: 'Kneel and bare your neck', tile: 'chapel', out: [
      { w: 3, text: 'The axe comes down and stops a hair from your neck. He laughs, delighted. "Truer than most," he says, and by sundown every hill of the Hidden Folk has heard your name.', ally: 'fey', renown: 3 },
      { w: 2, text: 'The axe nicks your neck, once, for the one time you flinched: a thin red line you will carry all your life. He names you a friend of the Court. "Most run," he says.', ally: 'fey', renown: 2 },
      { w: 1, text: 'The axe bites, not deep, but deep enough. "For the step back you took," he says, and leaves you bleeding in the thorns, a little wiser.', hp: -1, renown: 1 },
    ] },
    right: { label: 'Argue the terms', tile: 'chapel', out: [
      { w: 2, text: '"A season, you said, and it has been a season and nine days." He counts on his fingers, scowls, then roars with laughter. The Hidden Folk are bound by their words, and he pays for his.', gold: 30 },
      { w: 2, text: 'He listens gravely to your argument, agrees with every word of it, and swings anyway.', fight: { foe: 'fey_knight', name: 'the Green Knight', power: 10, dmg: 2,
        win: { text: 'Steel rings on the axe-haft until he falls back laughing, bleeding sap. "Enough! Keep your head, clever one." He tosses you his purse.', gold: 25 },
        lose: { text: 'He knocks you flat among the thorns and takes his blow with the flat of the axe, which is merciful, and humiliating.' } } },
      { w: 1, text: 'He hears you out, then shrugs. "Then keep your head, and I keep your word." Something goes out of your voice, and nobody quite believes you after.', trait: 'oathbreaker' },
    ] },
  },
  {
    id: 'u_shadow_home', tier: 3, needs: 'u_shadowless', w: 3,
    title: 'The Shadow Comes Home',
    text: 'At sunset a shadow comes up the road with nobody casting it. It is yours: you know the slouch. It has done well without you, and wears a sword-belt now. It stops a pace off and holds out a hand. It wants its turn with the body.',
    left: { label: 'Take it back by force', tile: 'road', fight: { foe: 'wraith', name: 'Your Own Shadow', power: 9, dmg: 2,
      win: { text: 'You pin it to the road by the heel and it goes back on like a wet shirt. It brings what it gathered while it was gone: a heavy purse, and a slim bright sword.', gold: 15, item: 'elvenblade' },
      lose: { text: 'It knocks you flat, takes your purse, and walks off into the dusk to go on living a life you will never hear about.', gold: -15 } } },
    right: { label: 'Lend it your body', tile: 'road', out: [
      { w: 4, text: 'You wake at dawn in a ditch forty miles on, with a full belly, a full purse and somebody else’s ring. Your shadow is back at your heels, looking pleased with itself.', gold: 30, food: 2 },
      { w: 2, text: 'You wake at the gate of a manor where they call you by a name you have never heard, and weep over you, and feed you like a lost child come home. You do not correct them.', food: 3, renown: 1 },
      { w: 2, text: 'You wake on a cart bound for the gaol. Your shadow had a busy night, and the sheriff wants paying for it.', pay: 20 },
      { w: 1, text: 'It enjoys the body so much that it keeps it. Something with your face walks on up the road, whistling, and nobody ever knows the difference.', die: 'lost to their own shadow' },
    ] },
  },
  {
    id: 'u_barley_crown', tier: 3, needs: 'u_foretold', w: 3,
    title: 'The Barley Crown',
    text: 'Every harvest Bramble Dole crowns a stranger with barley, and this year it is you: poppies in the crown, a throne on the hay-cart, the people cheering. The anchoress was right. But the old women are weeping, and someone is whetting a sickle.',
    left: { label: 'Reign until dawn', tile: 'bonfire', out: [
      { w: 2, text: 'You feast, you dance, you pardon a goose. At dawn they roll you down Dole Hill in a cider barrel, which is all the Barley Crown is for. You come out sticky, dizzy and beloved of the parish.', trait: 'beloved' },
      { w: 1, text: 'At dawn the old women lead you to the millpond, where the crowned one is drowned "a little, for the corn". They haul you out blue and cheering, and you cough up pondweed for a week.', hp: -2, renown: 2 },
      { w: 1, text: 'At dawn, the sickle. It is for the barley, not for you, but you do not wait to find out. You run for it still crowned, and the crown turns out to be woven round a band of old gold.', gold: 30 },
    ] },
    right: { label: 'Slip away at midnight', tile: 'road', out: [
      { w: 2, text: 'You slip off the cart at midnight with your shirt full of harvest bread. Behind you the drums go on, and on, and then stop all at once.', food: 3 },
      { w: 1, text: 'They notice. You spend the night in a ditch while the whole Dole hunts for its crowned one with lanterns and sickles, singing. You are not sure which part was worse.', food: -1, hp: -1 },
      { w: 1, text: 'On the road you meet a pedlar who wants very much to wear a crown, and pays you fifteen gold for yours. At dawn, from the next hill, you hear the drums stop. You do not look back.', gold: 15 },
    ] },
  },
  {
    id: 'u_castle_morrow', tier: 3, needs: 'u_invited', w: 3,
    title: 'Supper at Castle Morrow',
    text: 'The invitation comes by bat. At Castle Morrow the candles are lit, the venison is rare, and your hostess glows in black lace. Her own cup is crystal, and full, and not of wine. "My coachman has left my service," she says. "Would you take his place?"',
    left: { label: 'Enter her service', tile: 'castle', out: [
      { w: 2, text: 'You drive for her all winter by night, and dine on her venison by day. When you leave she gives you her crystal cup. "Drink from it after a fight," she says. "You’ll see."', relic: 'chalice', food: 2 },
      { w: 1, text: 'You serve a season, and she drinks from you only twice, very politely. You leave rich, and pale, and a little in love.', gold: 35, maxhp: -1 },
      { w: 1, text: 'You serve a week before you notice that the other servants have no reflections either. You leave by the window with a pocketful of her silver spoons, and no wages.', gold: 10 },
    ] },
    right: { label: 'Draw steel at the table', tile: 'castle', fight: { foe: 'vampire', name: 'Lady Morrow', power: 11, dmg: 2, elite: true,
      win: { text: 'Your blade finds her heart among the lace. She sighs, almost grateful, and is dust. You finish the venison, then empty her strongroom, which is four hundred years deep.', gold: 40, food: 2 },
      lose: { text: 'She catches your wrist like a closing door. "Such bad manners," she says, and drinks until the candles swim, then has you thrown in the moat.', food: -1 } } },
  },
  {
    id: 'u_bone_tithe', tier: 3, biome: ['hills', 'snow'],
    title: 'The Bone Tithe',
    text: 'Every soul in Hushwater Vale gives Lord Vesper a finger-bone a year, and no wolf, war or plague has touched the vale in three hundred years. His tithe-taker waits at the pass with a little silver saw, and looks at your hands. "Newcomers too."',
    left: { label: 'Give up a finger', tile: 'pass', out: [
      { w: 3, text: 'It is quick, and he is gentle, and he wraps the stump in clean linen. The vale feeds you like one of its own, and you sleep safe, knowing nothing will come for you here.', maxhp: -1, food: 3 },
      { w: 1, text: 'Lord Vesper himself comes down to see the new bone, and turns it over in fingers of bare ivory. "This one may wear a crown," he says, and gives you a gift, "so that we are even".', maxhp: -1, relic: 'rare' },
    ] },
    right: { label: 'Storm Lord Vesper’s tower', tile: 'wizard_tower', fight: { foe: 'lich', name: 'Lord Vesper', power: 12, dmg: 2, elite: true,
      win: { text: 'The lich comes apart like a dropped harp. Under three hundred years of finger-bones lies the gold the vale paid before it paid in bones. Tonight, for the first time in memory, the wolves come close.', gold: 40 },
      lose: { text: 'Vesper does not rise from his chair. He takes his tithe twice over, and has what is left of you set down outside the pass.' } } },
  },
  {
    id: 'u_fisher_lord', tier: 3, biome: ['waste'],
    title: 'The Fisher Lord',
    text: 'Deep in the waste stands a castle ringed with green lawns, the only green for fifty miles. Its lord fishes from a litter by the moat, with a wound that will not close. At supper a maiden carries a veiled cup through the hall. No one speaks of it.',
    left: { label: 'Hold your tongue', tile: 'castle', out: [
      { w: 3, text: 'You eat, and keep a courteous silence, and sleep on swan’s-down. At dawn the castle is gone. You wake on bare rock with the feast still in your belly and an ache you cannot name.', food: 2 },
      { w: 1, text: 'The lord thanks you for your courtesy and gives you a mail shirt from his armoury. All your life you will wonder what you ought to have asked.', item: 'scale' },
    ] },
    right: { label: 'Ask what ails him', tile: 'castle', out: [
      { w: 1, text: '"Forty years," he says, "and nobody asked." His wound closes, the waste greens overnight, and the maiden puts the cup in your hands. It tastes of every good morning of your life.', relic: 'grail' },
      { w: 3, text: '"Nothing you can mend," he says gently, but he is glad you asked. He blesses you with a hand like cold iron, and whatever you carried in with you, you do not carry out.', hp: 1, lift: true },
      { w: 3, text: 'The hall goes silent: asking was not courteous. You are shown the gate, and the gate is shown the waste, and in the morning there is nothing but rock and wind.', food: -2 },
    ] },
  },
  {
    id: 'u_bridge_of_dread', tier: 3, biome: ['fen', 'moor'],
    title: 'The Bridge of Dread',
    text: 'Where the fen meets the fog there is a bridge no wider than a thread, and the dead cross it at dusk. A woman waits at the near end with a pair of good shoes. "My boy went over barefoot," she says. "The stones are sharp. Would you take him these?"',
    left: { label: 'Carry the shoes over', tile: 'bridge', out: [
      { w: 2, text: 'The bridge is sharp as a knife and cold as a well. On the far side a barefoot boy sits crying on a stone. He puts on the shoes and runs off into the light, and you walk back feeling watched over.', trait: 'saints_ward' },
      { w: 1, text: 'Halfway over, the dead crowd round you asking for shoes, for bread, for news of home. By the far end your pack is empty, and your heart is strangely full.', food: -3, renown: 2 },
      { w: 1, text: 'The far side does not want to give you back. You come home a day later, starving and grey at the temples, with the dead’s way of seeing things.', food: -2, sight: 2 },
    ] },
    right: { label: 'Call to him from here', tile: 'swamp', out: [
      { w: 2, text: 'You shout his name into the fog until your voice cracks. At last a small voice answers, and she laughs and weeps at once, and gives you everything in her basket.', food: 3 },
      { w: 1, text: 'Something that is not her son answers, and comes back over the bridge wearing the fog.', fight: { foe: 'wraith', name: 'the Thing on the Bridge', power: 10, dmg: 2,
        win: { text: 'You drive it back into the fog. The woman gives you the shoes, since her boy will not need them now. They are elf-made, and fit as if the road itself had measured you.', relic: 'boots' },
        lose: { text: 'It takes a breath out of you that you never quite get back. When you wake, the woman is gone, and so are the shoes.', food: -1 } } },
    ] },
  },
  {
    id: 'u_witch_deathbed', tier: 3, biome: ['snow', 'wood'],
    title: 'The Witch Who Cannot Die',
    text: 'Old Mother Sloe has been dying for a month, and cannot: a witch can’t go until someone takes her craft. The cottage creaks with it, and her daughters won’t go near. She holds out a hand like a bundle of twigs. "Take it, lovey, and let me go."',
    left: { label: 'Take her hand', tile: 'witch_hut', out: [
      { w: 2, text: 'Her hand is cold, then hot, then still. She dies smiling. You walk out knowing things you did not: which way the weather will turn, and the road, and the people on it.', trait: 'second_sight' },
      { w: 1, text: 'She grips, and will not let go until the candle gutters, and when she goes she takes something of yours with her. You walk out older, and cold to the marrow.', hp: -2 },
      { w: 1, text: 'She dies easy. Under her pillow is her purse, and in her will, in a spidery hand, is your name, which she never asked.', gold: 25, sight: 1 },
    ] },
    right: { label: 'Lift a tile from her roof', tile: 'witch_hut', out: [
      { w: 2, text: 'You lift a tile from the ridge, the old way. Her soul goes out like a bird. Her daughters, weeping with relief, give you the pick of her larder and her purse.', gold: 15, food: 3 },
      { w: 1, text: 'You lift the tile, and something goes out of the roof that is not a bird. It rides you round the moor all night like a pony, and leaves you in a gorse bush at dawn.', food: -2, hp: -1 },
    ] },
  },
];
