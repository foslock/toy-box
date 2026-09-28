// Kingdom: the dark and the deep. Mountains and mines, barrows and battlefields, dwarves, trolls and dragons, and the
// dead who will not lie down. Events for the journey (see rules.js for every id).
export default [
  /* ---------- tier 1 ---------- */
  {
    id: 'd_beard_in_rubble', tier: 1, biome: ['hills', 'snow'],
    title: 'The Beard in the Rubble',
    text: 'A rockfall has buried the old mine road. Out of the rubble sticks a braided red beard, and out of the beard comes the worst language you have ever heard, in two tongues, one of them very old.',
    left: { label: 'Dig him out', tile: 'mine', out: [
      { w: 2, text: 'It takes till dusk and most of your bread. The dwarf, Orrin Deepdelve, pays you in raw silver. "The Deep Kin remember," he says, and it sounds like a promise and a threat at once.', food: -1, gold: 8, flag: 'd_dwarf_friend' },
      { w: 1, text: 'Orrin has no coin on him, so he gives you his second-best axe, which he says is still better than anything a human ever forged. He is right.', item: 'axe', flag: 'd_dwarf_friend' },
      { w: 1, text: 'You dig out a goblin in a stolen beard. It bites your thumb, says something rude in two tongues, and bolts with your supper.', food: -2 },
    ] },
    right: { label: 'Rob his pack', tile: 'road', out: [
      { w: 2, text: 'Dwarf-bread, hard as roof-slate, and a purse of silver. His cursing follows you a mile down the road, and somehow gets louder.', gold: 10, food: 2 },
      { w: 1, text: 'As you go, he spits a rune after you. It sizzles in the snow like fat in a pan, and your luck turns as sour as old milk.', gold: 10, trait: 'ill_luck' },
    ] },
  },
  {
    id: 'd_badgers_barrow', tier: 1, biome: ['moor', 'hills'],
    title: 'What the Badgers Dug Up',
    text: 'Badgers have tunnelled into an old barrow on the moor. At the mouth of their sett lies a finger bone still wearing a ring of red gold, heavy as a key. The wind across the mound sounds almost like breathing.',
    left: { label: 'Take the ring', tile: 'crypt', out: [
      { w: 3, text: 'It slides off the bone as if glad to go, and onto your finger as if made for it. It will not come off again. The badgers have turned up a scatter of old coins, too.', gold: 12, flag: 'd_ring' },
      { w: 1, text: 'As you touch the ring, a cold hand closes round your wrist from inside the earth.', fight: { foe: 'skeleton', name: 'the Barrow-Guard', power: 4, dmg: 1,
        win: { text: 'The arm crumbles in your grip. The ring is on your finger before you know it, and will not come off. The grave-coins in the dead man’s lap come too.', gold: 12, flag: 'd_ring' },
        lose: { text: 'You tear free without the ring and run. Behind you, the mound laughs, a sound like shovels.', food: -1 } } },
    ] },
    right: { label: 'Leave the dead a coin', cost: 5, tile: 'graveyard', out: [
      { w: 2, text: 'You tuck the bone back under the turf with a coin for company. That night, something leaves a loaf by your fire, warm from an oven cold a thousand years.', food: 2 },
      { w: 1, text: 'You bury the bone with a coin. A voice under the hill thanks you, and tells you a secret about the road ahead.', sight: 2 },
    ], poor: { text: 'You have no coin, so you leave the dead your supper. In the morning it is gone, and you have dreamed all night of the road ahead.', food: -1, sight: 1 } },
  },
  {
    id: 'd_snoring_hill', tier: 1, biome: ['hills', 'moor'], unless: 'w_sleeping_giant',
    title: 'The Hill That Snores',
    text: 'You wake at dawn to find the hill you slept on rising and falling. Somewhere below, a noise like a landslide clears its throat. The hill wears a belt, and the belt has a pouch the size of a cottage.',
    left: { label: 'Creep off, very quietly', tile: 'road', out: [
      { w: 2, text: 'You climb down a knee and away through the heather, where you find an apple from the giant’s lunch, big as a lamb and twice as sweet.', food: 3 },
      { w: 1, text: 'The hill rolls over in its sleep, and you roll with it, all the way to the bottom.', hp: -1 },
    ] },
    right: { label: 'Pick the giant’s pocket', tile: 'mountain', out: [
      { w: 2, text: 'Inside: a cheese like a millstone, a great deal of fluff, and three gold buttons, each the size of a plate.', gold: 14, food: 2 },
      { w: 1, text: 'An eye the size of a cartwheel opens and looks at you, puzzled.', fight: { foe: 'giant', name: 'the Sleepy Giant', power: 6, dmg: 2,
        win: { text: 'You jab a thumb as thick as a log. The giant sucks it, sulks, and goes back to sleep. You take the buttons.', gold: 14 },
        lose: { text: 'The giant flicks you off his belly like a crumb. You land in a bog a long way off, without your pack.', food: -2 } } },
    ] },
  },
  {
    id: 'd_resurrection_men', tier: 1,
    title: 'The Resurrection Men',
    text: 'In a moonlit churchyard, two men are digging up a fresh grave. "Keep watch for us, friend, and there’s a cut in it," says one. "The wizards pay well for the newly dead, and he won’t miss himself."',
    left: { label: 'Keep watch', tile: 'graveyard', out: [
      { w: 2, text: 'The coffin comes up heavy, and the men pay your share without a quibble. You try not to wonder what the wizards want with him.', gold: 12 },
      { w: 1, text: 'The corpse sits up in its coffin, blinks at the moon, and grabs a shovel.', fight: { foe: 'skeleton', name: 'the Unquiet Corpse', power: 4, dmg: 1,
        win: { text: 'You put him back down, firmly. The diggers have fled and left their pay behind.', gold: 10 },
        lose: { text: 'You run. The diggers run faster. The corpse climbs back in and pulls the lid shut with a sniff.' } } },
      { w: 1, text: 'The sexton’s lantern finds you. The diggers vanish into the yews, leaving you holding a shovel and a very large fine.', pay: 10 },
    ] },
    right: { label: 'Ring the chapel bell', tile: 'chapel', out: [
      { w: 2, text: 'The village comes running with torches. The sexton gives you hot soup and a bed in the vestry, and the parson prays over you whether you like it or not.', food: 2, hp: 1 },
      { w: 1, text: 'The diggers reach you before the villagers do, and tip you into the open grave. The sexton finds you there at dawn, and is very surprised.', hp: -1 },
    ] },
  },
  {
    id: 'd_frozen_pilgrim', tier: 1, biome: ['snow', 'hills'],
    title: 'The Pilgrim in the Snow',
    text: 'Halfway up the pass, a pilgrim sits frozen on a rock, frost in his eyebrows and a full pack on his back. His hands are folded round a little wooden saint. He looks, for all the world, content.',
    left: { label: 'Take his pack', tile: 'pass', out: [
      { w: 3, text: 'Bread, dried figs and a flask of plum brandy. You thank him. He does not reply.', food: 3 },
      { w: 1, text: 'Sewn into the lining are the alms he was carrying to the abbey. The little saint watches you count them.', gold: 12 },
      { w: 1, text: 'As you lift the pack, his frozen eyes open. "Thief," he whispers, and then he is only ice again. You do not sleep for two nights.', food: 2, hp: -1 },
    ] },
    right: { label: 'Carry him down', tile: 'abbey', out: [
      { w: 2, text: 'It is backbreaking. The monks at the foot of the pass know him: Brother Aldo, lost a month. They feed you like a bishop and toll the bell for him all night.', food: 2, renown: 2 },
      { w: 1, text: 'Halfway down, the cold gets into your bones and will not leave. The monks weep for him, and pray for you.', hp: -1, renown: 2 },
      { w: 1, text: 'The abbot gives you a twist of blessed salt. "The mountain has other dead," he says, "and not all of them sit so quietly."', relic: 'salt', renown: 1 },
    ] },
  },
  {
    id: 'd_silent_canary', tier: 1, biome: ['hills'],
    title: 'The Canary Has Stopped Singing',
    text: 'At the mouth of a silver mine, miners stand round a birdcage. The canary lies on its back. "Foreman’s still down there," says one, and they all look at you, because you are not a miner and they are.',
    left: { label: 'Go down after him', tile: 'mine', out: [
      { w: 2, text: 'You find the foreman asleep in a side-tunnel, drunk as a lord. The miners pay you in silver, and laugh till they cry.', gold: 12 },
      { w: 1, text: 'The bad air gets you first. You wake on the grass with a headache like an anvil, and a miner fanning you with his hat.', hp: -1 },
      { w: 1, text: 'The canary did not die of bad air. It died of goblins, who chase you squealing out of the dark and keep your pack.', food: -2 },
    ] },
    right: { label: 'Pocket some silver', tile: 'mine', out: [
      { w: 2, text: 'While every eye is on the shaft, you fill your pockets with raw silver and stroll off, whistling.', gold: 12 },
      { w: 1, text: 'A miner’s wife sees you. The miners are wonderfully quick to stop grieving, and the reeve fines you on the spot.', pay: 8 },
    ] },
  },
  {
    id: 'd_cinder_road', tier: 1, biome: ['waste'],
    title: 'The Cinder Road',
    text: 'The road runs black through a waste of ash. A merchant’s wagon lies burned to its iron hoops, and the oxen are only shapes. Something big passed this way, and not long ago: the stones are still warm.',
    left: { label: 'Search the wagon', tile: 'road', out: [
      { w: 2, text: 'Most of it is charcoal, but the strongbox held. The coins inside have melted into one lump, which a smith will take by weight.', gold: 14 },
      { w: 1, text: 'Under the wagon hides the driver, blistered and mad with thirst. He gives you his last hams to lead him out of the ash.', food: 3, renown: 1 },
      { w: 1, text: 'A wyvern comes back for the rest of its dinner.', fight: { foe: 'wyvern', name: 'a Young Wyvern', power: 5, dmg: 2,
        win: { text: 'It flaps off shrieking, lighter by a tail-spike. The strongbox is yours.', gold: 14 },
        lose: { text: 'It chases you a mile through the ash and eats your supper for pudding.', food: -1 } } },
    ] },
    right: { label: 'Follow the scorch marks', tile: 'lair', out: [
      { w: 2, text: 'The trail ends at a scorched hollow full of bones. Among them lies a lucky charm that plainly did not work for its last owner.', relic: 'random' },
      { w: 1, text: 'The trail goes on and on through ash that gets into everything, including your bread.', food: -2 },
      { w: 1, text: 'At the end of the trail lies a dead knight, his purse untouched and his sword melted to his hand.', gold: 12 },
    ] },
  },
  {
    id: 'd_troll_nursemaid', tier: 1, biome: ['hills', 'wood'],
    title: 'A Troll’s Favour',
    text: 'A troll-wife bars your path, a squalling troll-baby on her hip. "You. Mind him till I’m back from hunting. He bites. Don’t let him eat nothing he shouldn’t." She looks you up and down. "Like you."',
    left: { label: 'Mind the baby', tile: 'cave', out: [
      { w: 2, text: 'He chews your staff, your boots and your hat, then falls asleep on you like a warm sack of gravel. His mother pays you in stolen mutton.', food: 3 },
      { w: 1, text: 'He bites. Hard. His mother is terribly apologetic, in a troll way, which means a lot of shouting and a leg of lamb.', hp: -1, food: 2 },
      { w: 1, text: 'She comes back with a full sack and tips half of it into your lap: buckles, rings, teeth, and one very good gold tooth.', gold: 12 },
    ] },
    right: { label: 'Run for it', tile: 'pass', out: [
      { w: 2, text: 'Trolls are slow on the turn. You are over the pass before she has shifted the baby to her other hip, and below it a shepherd’s hut has a pot on.', food: 2 },
      { w: 1, text: 'Trolls are slow on the turn, but not that slow. She catches you by the ankle and shakes you until your purse falls out.', gold: -8 },
    ] },
  },
  {
    id: 'd_hundred_year_supper', tier: 1,
    title: 'The Hundred-Year Supper',
    text: 'The ruined keep is lit tonight. Through a broken wall you see a long table heaped with roasts, and grey guests in old wedding lace who turn as one to look at you. The host rises. "At last! We kept your seat."',
    left: { label: 'Take your seat', tile: 'castle', out: [
      { w: 2, text: 'The food is cold and tastes of dust, but it fills you. The dead are charming company. At dawn the table is bare, and so is the hall, but you are full.', food: 3 },
      { w: 1, text: 'You eat, and dance, and toast the bride. You wake among the nettles a season later, ravenous, with a purse of very old coins in your pocket.', food: -2, gold: 12 },
      { w: 1, text: 'The host asks you to stay forever. You leave by a window, and something follows you for miles, calling your name, sadly.', hp: -1 },
    ] },
    right: { label: 'Steal the silver', tile: 'ruins', out: [
      { w: 3, text: 'You sweep a candlestick and two plates into your pack and run. Behind you, a hundred old guests sigh with disappointment.', gold: 14 },
      { w: 1, text: 'The silver is cold as the grave, and by morning so are you. Your bones have gone thin as glass, and they chime when you walk.', gold: 14, trait: 'glass_bones' },
    ] },
  },
  /* ---------- tier 2 ---------- */
  {
    id: 'd_deep_door', tier: 2, biome: ['hills', 'snow'], needs: 'd_dwarf_friend', w: 3,
    title: 'The Deep Door',
    text: 'A door the height of ten men is carved into the mountain, and it swings open for you alone. Orrin Deepdelve waits inside with a lantern and a grin. "Told them what you did. The Thane wants a look at you."',
    left: { label: 'Swear the stone-oath', tile: 'mine', out: [
      { w: 2, text: 'You swear with one hand on the Hall-Stone and one in cold blue fire. The Thane names you stone-friend, three hundred dwarves bang their mugs, and the Deep Kin will stand with you.', ally: 'dwarves', renown: 2 },
      { w: 1, text: '"First," says the Thane, "the troll in our lower deeps. It ate my cousin, and my other cousin, and the good anvil."', fight: { foe: 'troll', name: 'the Deep Troll', power: 8, dmg: 2,
        win: { text: 'The troll goes down like a falling chimney. The Deep Kin roar your name through the halls, and pay you in silver bars.', ally: 'dwarves', gold: 20 },
        lose: { text: 'The dwarves drag you out by the ankles. "Promising," says the Thane, not meaning it.', food: -1 } } },
    ] },
    right: { label: 'Visit the great forges', tile: 'smithy', shop: 'smith', out: [
      { text: 'Orrin leads you down a thousand steps to where the anvils ring like bells and the forges never go out. "Friend’s prices," he says, and winks, which from a dwarf means nothing whatever.' },
    ] },
  },
  {
    id: 'd_ogre_supper', tier: 2, biome: ['hills', 'wood'],
    title: 'Supper with the Ogre',
    text: 'An ogre in a stained apron stirs a pot big enough to bathe in. "Staying for supper, {lad}?" he booms. You can’t tell if he means at the table or in the pot, and from his face, neither can he.',
    left: { label: 'Stay for supper', tile: 'hovel', out: [
      { w: 2, text: 'Turnip and mutton, and a great deal of it. The ogre sings while you eat. It is awful, but he means well, and he packs you a lunch the size of a dog.', food: 3, hp: 1 },
      { w: 1, text: 'Halfway through the soup, he looks at you, then at the pot, then back at you, and licks his lips.', fight: { foe: 'ogre', name: 'the Ogre Cook', power: 8, dmg: 2,
        win: { text: 'He sits down hard in his own soup. You finish your supper, then his, then his larder.', food: 3, gold: 10 },
        lose: { text: 'You escape up the chimney, well seasoned and missing a boot.', food: -1 } } },
    ] },
    right: { label: 'Strike first', tile: 'hovel', fight: { foe: 'ogre', name: 'the Ogre Cook', power: 7, dmg: 2,
      win: { text: 'He falls into his own pot with a splash like a dropped cow. His purse, his larder and his apron are yours.', gold: 20, food: 3 },
      lose: { text: 'He clouts you across the room with his ladle and keeps your pack "for the trouble".', food: -2 } } },
  },
  {
    id: 'd_old_blackwing', tier: 2, biome: ['snow', 'hills'],
    title: 'Old Blackwing',
    text: 'The only way over the mountains runs under the roost of Old Blackwing, a wyvern older than {kingdom}. Its shadow slides across the snow as you watch. The goatherds say it takes one traveller in three.',
    left: { label: 'Hunt the wyvern', tile: 'mountain', fight: { foe: 'wyvern', name: 'Old Blackwing', power: 10, dmg: 2, elite: true,
      win: { text: 'Old Blackwing falls out of the sky like a toppled tower. Its roost is floored with the purses of travellers who never made it over.', gold: 25, renown: 2 },
      lose: { text: 'It drops you from a great height into a snowdrift, and does not bother to come back. You dig yourself out, bruised to the bone.' } } },
    right: { label: 'Hire a goatherd guide', cost: 12, tile: 'pass', out: [
      { w: 2, text: 'The goatherd knows a cleft so narrow you have to breathe in. Two cold days, a great deal of goat’s cheese, and never once a shadow.', food: 1 },
      { w: 1, text: 'Halfway through, the goatherd sneezes. The snowfield above you shrugs, and comes down.', hp: -1 },
    ], poor: { text: 'With no coin for a guide, you take the long way round alone: four days of snow and hunger, and frost in your fingers.', food: -3, hp: -1 } },
  },
  {
    id: 'd_chained_woman', tier: 2, biome: ['wood', 'moor'],
    title: 'Before the Moon Rises',
    text: 'In a roofless chapel, a woman is chained to the altar rail. "Break my chain before moonrise and I’ll run far from men," she says. "Or take the silver knife on the altar and end it. Only, please, don’t wait."',
    left: { label: 'Break her chain', tile: 'forest', out: [
      { w: 2, text: 'She is gone into the trees before the chain stops ringing. In the morning you find a hare laid across your path, and another, and another.', food: 3 },
      { w: 1, text: 'She kisses your brow and bites your wrist, gently, like a promise. "So you’ll know me," she says, and runs. After that, your blood sings when the moon is up.', trait: 'wolfblood' },
      { w: 1, text: 'You are too slow. The moon clears the trees, and she changes with a sound like tearing sailcloth.', fight: { foe: 'werewolf', name: 'the Wolf of the Chapel', power: 8, dmg: 2,
        win: { text: 'You drive her off into the dark with the broken chain. Later, far off, a wolf howls, and you would swear it sounds grateful.', renown: 2 },
        lose: { text: 'She bites you once, and is gone. By the next full moon, you will understand.', trait: 'wolfblood' } } },
    ] },
    right: { label: 'Take the silver knife', tile: 'chapel', out: [
      { w: 2, text: 'She closes her eyes. Afterwards, the villagers who chained her pay you the bounty. None of them can look at you, and you find you cannot look at them.', gold: 20 },
      { w: 1, text: 'Your hand shakes, and the moon is quicker. She bites you once, almost kindly, and is gone into the night.', trait: 'wolfblood', hp: -1 },
    ] },
  },
  {
    id: 'd_knucklebones', tier: 2,
    title: 'A Game of Knucklebones',
    text: 'Deep in the crypt, a tall figure in a grey hood plays knucklebones by the light of one candle. A small hourglass stands at its elbow. The stool across from it is empty. It gestures: sit.',
    left: { label: 'Play for your life', tile: 'crypt', out: [
      { w: 2, text: 'You throw. You win. The hooded thing is gracious in defeat, and slides its little hourglass across the table. The sand in it runs both ways.', relic: 'hourglass' },
      { w: 1, text: 'You throw. You lose. It takes nothing. It only writes your name in a small black book, and blows out the candle.', trait: 'reaper' },
      { w: 1, text: 'A draw. It seems delighted. You play till dawn, and when you leave, the bones have taught you something about luck.', sight: 2, renown: 1 },
    ] },
    right: { label: 'Play for gold instead', cost: 15, tile: 'crypt', out: [
      { w: 1, text: 'You win. It pays you in coins no king has minted for five hundred years. They are cold as ice, but they spend.', gold: 30 },
      { w: 1, text: 'You win, and it adds a knucklebone "for luck". It rattles in your pocket whenever danger is near.', gold: 20, sight: 1 },
      { w: 1, text: 'You lose. It sweeps your gold into its sleeve with a courteous little nod.' },
    ], poor: { text: 'You have no gold to wager. It shrugs, and plays a hand for you anyway. You win. "Next time," it says, "the real stakes."', gold: 10 } },
  },
  {
    id: 'd_last_sentry', tier: 2, biome: ['moor', 'hills'],
    title: 'The Last Sentry',
    text: 'On the old battlefield, a ghost in rusted mail bars your way with a warhammer. "Halt! Give the word!" He has kept this post for three hundred years. His war is a line in a book that nobody reads.',
    left: { label: 'Tell him the war is over', tile: 'battlefield', out: [
      { w: 2, text: 'He looks out over the empty field for a long time. "Did we win?" You don’t know. He fades anyway, and his hammer drops into the grass, solid and heavy and old.', item: 'warhammer', renown: 1 },
      { w: 1, text: '"Liar," he says. "The king would have sent word." He knocks you flat with the haft of his hammer and goes back to his watch.', hp: -1 },
    ] },
    right: { label: 'Say you’re his relief', tile: 'battlefield', out: [
      { w: 2, text: 'He salutes, grips your shoulder with a hand like frost, and marches off into the mist, whistling. Where he touched you, you feel you could stand three hundred years.', trait: 'stout_heart' },
      { w: 1, text: 'He hands you the post, and the post will not let you go. You stand watch a night and a day before the oath wears thin enough to break.', food: -2 },
    ] },
  },
  {
    id: 'd_hooded_choir', tier: 2, biome: ['hills', 'moor'],
    title: 'The Hooded Choir',
    text: 'In a ruined abbey, a ring of hooded figures chants to a pit that breathes out cold. One of them sees you and beckons. "Quick, pilgrim, the word, and join us!" Nobody seems to notice you have no hood.',
    left: { label: 'Mumble and join in', tile: 'altar', out: [
      { w: 2, text: 'You hum along. Nobody checks. Afterwards there is soup, a share of the offerings, a spare hood, and a whisper of when and where the Deep Mother will wake.', food: 2, gold: 10, flag: 'd_cult' },
      { w: 1, text: 'Your mumble is not the word. They beat you with their hymn-books and throw you out into the snow.', hp: -1, food: -1 },
    ] },
    right: { label: 'Run for the priests', tile: 'chapel', out: [
      { w: 2, text: 'The priest at the next chapel listens, goes pale, and rings for the bishop’s men. The Dawn Church does not forget who warned it.', ally: 'church' },
      { w: 1, text: 'By the time the bishop’s men arrive, the abbey is empty and the pit is only a well. Their captain fines you for his wasted morning.', pay: 10 },
    ] },
  },
  {
    id: 'd_wyrm_and_knight', tier: 2, biome: ['waste', 'hills'],
    title: 'The Wyrm and the Knight',
    text: 'In a scorched valley, a dragon lies dying with a lance through its heart. Pinned under its claw, screaming, is the knight who put it there. The dragon opens one molten eye. "Drink," it rasps. "Someone should."',
    left: { label: 'Drink the dragon’s blood', tile: 'lair', out: [
      { w: 2, text: 'It burns like swallowing a sunset. When you can see again, the dragon is dead, the knight is dead, and your heart is beating like a war-drum.', trait: 'dragonblood' },
      { w: 1, text: 'It burns. It burns. You wake in the ash a day later, only yourself, and the knight long past saving.', hp: -2 },
    ] },
    right: { label: 'Free the knight', tile: 'battlefield', out: [
      { w: 2, text: 'It takes a lever, a prayer and all your strength. Ser Hollis of the Rose swears on his broken lance that the Order will know your name.', ally: 'knights', renown: 2 },
      { w: 1, text: 'As you heave, the tail lashes in one last spite. Ser Hollis drags you clear, gives you his dented mail, and swears the Order will know your name.', ally: 'knights', hp: -1, item: 'chain' },
    ] },
  },
  /* ---------- tiers 2 and 3 ---------- */
  {
    id: 'd_saints_spring', tier: [2, 3], biome: ['snow', 'hills'],
    title: 'Saint Ossery’s Spring',
    text: 'In the snowfield, a spring steams under a hood of carved stone. Saint Ossery drowned here keeping it free of ice, and the water has run warm as blood ever since. A sour-faced keeper sits beside it with a bowl.',
    left: { label: 'Pay the keeper and bathe', cost: 12, tile: 'well', out: [
      { w: 2, text: 'The heat soaks into your bones, and whatever was clinging to you lets go and drifts away like a dead leaf.', hp: 2, lift: true },
      { w: 1, text: 'The keeper mutters a prayer over you the whole time, sniffing. It works in spite of him.', hp: 1, lift: true },
    ], poor: { text: 'You have nothing for the bowl. The keeper lets you drink one cupful, and watches you go as if you had stolen it.', hp: 1 } },
    right: { label: 'Sneak a dip by night', tile: 'well', out: [
      { w: 2, text: 'The water is just as warm by moonlight, and free. Whatever was clinging to you lets go.', hp: 2, lift: true },
      { w: 1, text: 'The keeper is waiting with a lantern and a cudgel. Sacrilege, it turns out, costs extra.', pay: 15 },
    ] },
  },
  {
    id: 'd_phoenix_pyre', tier: [2, 3], biome: ['waste'],
    title: 'The Bird in the Fire',
    text: 'On a hill of ash, a great bird burns on a nest of cinnamon and bones, singing as it goes. Ash-priests kneel round it in scorched robes. "She dies every hundred years," one whispers. "Tonight she is reborn."',
    left: { label: 'Snatch a burning feather', tile: 'bonfire', out: [
      { w: 2, text: 'You reach into the fire. It hurts exactly as much as you thought it would. The feather in your fist keeps burning, and does not burn you.', relic: 'phoenix', hp: -1 },
      { w: 1, text: 'The priests see you reach, and they are not gentle. They beat you with smouldering branches and roll you down the hill of ash.', hp: -1, food: -1 },
    ] },
    right: { label: 'Kneel and watch', tile: 'bonfire', out: [
      { w: 2, text: 'At midnight the fire goes white, and a chick of gold flame climbs out of the ash and looks at you. You feel looked at down to your bones, and better for it.', hp: 2, sight: 1 },
      { w: 1, text: 'You watch all night. At dawn the priests share their bread with you, and bless you in a tongue that crackles like kindling.', food: 2, renown: 1 },
    ] },
  },
  {
    id: 'd_charnel_market', tier: [2, 3],
    title: 'The Charnel Market',
    text: 'Under the old city of the dead, grave-robbers and worse hold a market by corpse-candle. The stalls sell rings still on fingers and swords still in hands. A ghoul with a jeweller’s eyeglass is buying teeth.',
    left: { label: 'Browse the stalls', tile: 'market', shop: 'fence', out: [
      { text: 'Everything here was buried with somebody. The prices are low, the questions are few, and the previous owners are in no state to complain.' },
    ] },
    right: { label: 'Sell the ghoul a tooth', tile: 'crypt', out: [
      { w: 2, text: 'He pulls it with silver tongs, holds it up to the candle, and pays you in old gold. You will get used to the gap.', gold: 20, hp: -1 },
      { w: 1, text: 'He sniffs the tooth and pays you double. "Good blood," he says, and looks at you in a way you do not like at all.', gold: 35, hp: -1 },
      { w: 1, text: 'He pulls the wrong tooth, then the right one, and pays you for one.', gold: 20, hp: -2 },
    ] },
  },
  /* ---------- tier 3 ---------- */
  {
    id: 'd_barrow_king', tier: 3, biome: ['moor', 'hills'], needs: 'd_ring', w: 3,
    title: 'The Barrow-King Rides',
    text: 'At midnight the ring on your finger turns to ice. Hooves on the frozen road: a king in rotten gold rides out of the mist with his dead thanes behind him. "Thief," he says, almost gently. "Return what is mine."',
    left: { label: 'Give back the ring', tile: 'crypt', out: [
      { w: 3, text: 'It slides off at last. He puts it on, and for a moment he looks almost alive. "Honest, after all," he says, and his thanes part to let you by.', renown: 2, sight: 1 },
      { w: 2, text: 'He takes the ring, and the finger with it, and rides back into the mist without a word.', hp: -1 },
      { w: 1, text: 'He weighs you with empty eyes. "My line ended with better folk than you, and they died owning nothing. Take my banner. Find a king worth it."', relic: 'old_banner' },
    ] },
    right: { label: 'Run for holy ground', tile: 'chapel', out: [
      { w: 3, text: 'You reach the chapel with his breath on your neck, and he cannot cross the threshold. At dawn he fades, and the ring slides off into your palm. A goldsmith weighs it and whistles.', gold: 35, renown: 1 },
      { w: 1, text: 'He is faster.', fight: { foe: 'wraith', name: 'the Barrow-King', power: 12, dmg: 3, elite: true,
        win: { text: 'Your blow breaks his crown in two, and he and his thanes blow away like ash. The ring slips from your finger at last, and his barrow-gold is yours.', gold: 40 },
        lose: { text: 'His cold hand closes over yours. He takes the ring and rides away, and you lie in the frost until the sun finds you.' } } },
    ] },
  },
  {
    id: 'd_nest_on_peak', tier: 3, biome: ['snow', 'hills'],
    title: 'The Nest on the Peak',
    text: 'Near the summit, in a crater of black glass, lies a dragon’s nest: bones and melted crowns heaped round one great egg that pulses faintly, like a heart. The sky above is empty. For now.',
    left: { label: 'Take the egg', tile: 'lair', out: [
      { w: 4, text: 'The egg is cold, and long dead. You leave it, but not before prising a fistful of melted crowns out of the glass.', gold: 40 },
      { w: 1, text: 'It is heavy as a millstone and warm as new bread. Something inside it kicks. You have stolen a dragon’s egg, and had better be far away by dusk.', relic: 'dragon_egg' },
      { w: 1, text: 'A shadow falls across the snow, and the mountain shakes as she lands.', fight: { foe: 'dragon', name: 'the Mother of the Peak', power: 14, dmg: 3, elite: true,
        win: { text: 'Impossibly, she falls, and the whole mountain groans. The egg is yours, and the hoard beneath it. They will sing of this for a hundred years.', gold: 45, relic: 'dragon_egg' },
        lose: { text: 'She lets you go, which is somehow worse. You run down the mountain with your hair on fire and nothing in your hands.' } } },
    ] },
    right: { label: 'Hide and watch', tile: 'mountain', out: [
      { w: 2, text: 'At dusk she comes home, curls round the egg and sings to it, a sound like a forge at night. You creep down the mountain changed, and warm to the bone.', hp: 2, sight: 1 },
      { w: 1, text: 'She sees you. She looks at you for a long, long moment, then goes back to her egg. You have been spared by a dragon, and you walk down the mountain ten feet tall.', renown: 3 },
      { w: 1, text: 'You wait all day in the wind. She does not come. The cold does.', hp: -1, food: -1 },
    ] },
  },
  {
    id: 'd_deep_mother', tier: 3, needs: 'd_cult', w: 3,
    title: 'The Deep Mother Wakes',
    text: 'In your borrowed hood you come to the great summoning. Hundreds kneel round a pit in the mountain’s root. The high priest lifts a bone knife over a bound girl in a wizard’s blue robe. Far below, something vast is listening.',
    left: { label: 'Save the girl', tile: 'altar', fight: { foe: 'cultist', name: 'the High Priest', power: 10, dmg: 2,
      win: { text: 'You cut her loose and flee through the smoke with the whole choir wailing behind. She is a novice of the Circle of the Tower, and the Circle pays its debts.', ally: 'mages', renown: 3 },
      lose: { text: 'They throw you both into the pit. You climb out alone, days later and starving, and never speak of what you saw at the bottom.', food: -2 } } },
    right: { label: 'Slip away in the chanting', tile: 'cave', out: [
      { w: 2, text: 'You slip out with the offering bowl under your robe and follow a side-passage a day through the dark. Behind you, the mountain groans like a sleeper turning over.', gold: 15 },
      { w: 1, text: 'The side-passage runs straight through the cult’s treasury. Nobody is guarding it. Everybody is at the summoning.', gold: 40 },
      { w: 1, text: 'As you go, the girl’s eyes find you. You carry that look with you for the rest of your days, and your luck curdles under it.', trait: 'ill_luck' },
    ] },
  },
  {
    id: 'd_siege_of_grimholt', tier: 3, biome: ['hills', 'snow'],
    title: 'The Siege of Grimholt',
    text: 'Trolls are battering the gate of the dwarf-hold of Grimholt with a whole pine tree, while dwarves pour boiling ale on them from the walls. A dwarf on the battlements spots you. "You! Tall one! Hit the big one!"',
    left: { label: 'Charge the big one', tile: 'castle', fight: { foe: 'troll', name: 'the Troll Chieftain', power: 10, dmg: 2,
      win: { text: 'The chieftain topples onto his own ram and the trolls flee. The Thane of Grimholt takes the mithril shirt off his own back and gives it to you, with the friendship of the Deep Kin.', ally: 'dwarves', item: 'mithril' },
      lose: { text: 'The chieftain swats you into a snowdrift with the pine tree, and the siege goes on without you.', food: -1 } } },
    right: { label: 'Bribe the postern-warden', cost: 20, tile: 'smithy', shop: 'smith', out: [
      { text: 'A very old dwarf lets you in by a door the trolls have not found. Inside, the forges roar day and night, and the smiths will sell to anyone who is not a troll.' },
    ], poor: { text: '"No coin, no door," says the warden. He hands you a spear and points at the wall. You hold it all night beside the dwarves, and they feed you well.', hp: -1, food: 2 } },
  },
  {
    id: 'd_thin_place', tier: 3,
    title: 'Where the World Wears Thin',
    text: 'Between two standing stones, the air has worn through like old cloth. Through the hole you see a road in green light, and on it, walking your way, someone who looks exactly like you, only older, and very tired.',
    left: { label: 'Step through', tile: 'portal', out: [
      { w: 2, text: 'You pass your older self on the green road without a word. A mile on, you step out a week’s journey away, in boots that are not yours. They fit perfectly.', relic: 'boots' },
      { w: 1, text: 'On the other side, time runs sideways. You come back with a head full of tomorrows, and they keep on coming.', trait: 'second_sight' },
      { w: 1, text: 'You come back hungry, and a year older, and not quite sure which of you it was that came back.', food: -2, maxhp: -1 },
    ] },
    right: { label: 'Wait for your older self', tile: 'stones', out: [
      { w: 2, text: 'Your older self steps through, presses a heavy purse into your hands and whispers, "Left, at the last fork, {name}. Trust me." Then there is only you.', gold: 25, sight: 2 },
      { w: 1, text: 'Your older self steps through and draws a sword. "Sorry. Only one of us gets to be crowned."', fight: { foe: 'champion', name: 'Your Older Self', power: 10, dmg: 2,
        win: { text: 'You win, because you are younger. Your older self fades smiling, as if this was always how it went, and leaves you a gift from further down the road.', relic: 'rare', gold: 20 },
        lose: { text: 'Your older self wins, having done this before, and steps past you into the world. You are left alone in the green light for a long, cold while.', food: -1 } } },
    ] },
  },
  {
    id: 'd_glacier_sword', tier: 3, biome: ['snow'],
    title: 'The Sword in the Glacier',
    text: 'Deep in the blue ice of the glacier, a warrior stands frozen mid-stride, as if walking out of the mountain. In both hands: a greatsword whose runes still glow. The ice over the hilt is thin enough to chip.',
    left: { label: 'Chip out the sword', tile: 'mountain', out: [
      { w: 2, text: 'It comes free with a crack like a bell. The runes flare at your touch, then settle, satisfied, as if they had been waiting.', item: 'runeblade' },
      { w: 1, text: 'The sword comes free. So does its owner.', fight: { foe: 'wraith', name: 'the Ice-Bound King', power: 11, dmg: 2,
        win: { text: 'He shatters like a dropped window, and his sword is yours, humming in your hands like a hive.', item: 'runeblade' },
        lose: { text: 'He takes back his sword and walks off down the mountain. You are left with frostbite and a story no one believes.', food: -1 } } },
    ] },
    right: { label: 'Let him keep it', tile: 'pass', out: [
      { w: 2, text: 'You bow to him and walk on. Below, the glacier has spat out what it swallowed over the centuries: a pack-mule, a pot of coins, one boot with the foot still in it.', gold: 25, food: 2 },
      { w: 1, text: 'You walk on. Behind you the ice cracks, and slow footsteps follow you a mile down the mountain, then stop. By morning your hair is white at the temples.', hp: -1, sight: 1 },
    ] },
  },
  {
    id: 'd_hold_till_dawn', tier: 3,
    title: 'Hold Till Dawn',
    text: 'On a hilltop, an old priest bars the chapel door as the graveyard below begins to stir. "They come every night, and every night I hold till dawn," he says. "But I am very tired. Will you take the door?"',
    left: { label: 'Take the door', tile: 'chapel', fight: { foe: 'skeleton', name: 'the Churchyard Dead', power: 11, dmg: 2,
      win: { text: 'At dawn the dead lie down, and the old sword above the altar blazes with light. The priest lifts it down with shaking hands. "It was waiting for someone," he says.', relic: 'dawnblade' },
      lose: { text: 'The door gives. The priest drags you up the bell tower, and you hold the stair there, just, until the sun comes up.', food: -1 } } },
    right: { label: 'Ring the bell all night', tile: 'chapel', out: [
      { w: 2, text: 'The bell keeps them back till sunrise. Your arms are dead but you are not, and the priest blesses you until you are dizzy with it.', renown: 2, lift: true },
      { w: 1, text: 'At midnight the bell-rope snaps. You and the priest hold the tower stair with a candlestick and a prayer-book until dawn.', hp: -1, lift: true },
    ] },
  },
  {
    id: 'd_hall_of_statues', tier: 3, biome: ['hills', 'waste'],
    title: 'The Hall of Statues',
    text: 'The cave is full of statues: knights, thieves, a goat, a very surprised bishop. All of them face the back of the cave, where something with snakes for hair sleeps on a heap of stone treasure, snoring like a kettle.',
    left: { label: 'Behead her in her sleep', tile: 'cave', out: [
      { w: 4, text: 'One swing, eyes screwed shut. You carry the head out in a sack, and one of its eyes still has one last stony stare left in it.', relic: 'gorgon_eye' },
      { w: 1, text: 'She wakes as you swing. You flee with your eyes shut, and her hair bites you all the way to the door.', hp: -2 },
      { w: 1, text: 'She wakes as you swing. You look. You should not have looked.', die: 'turned to stone in a gorgon’s cave' },
    ] },
    right: { label: 'Rob the statues', tile: 'cave', out: [
      { w: 2, text: 'The stone knights still carry their purses, and the coins in them are only coins. The bishop was carrying the most.', gold: 35 },
      { w: 1, text: 'You prise a sword from a stone hand. Under the stone it is elf-steel, as bright as the day it was drawn.', item: 'elvenblade' },
      { w: 1, text: 'The snoring stops. You run with your eyes shut and bounce off every statue on the way out, including the bishop.', hp: -1 },
    ] },
  },
];
