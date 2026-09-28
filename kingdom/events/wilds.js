// Kingdom: the wilds and magic. Forests, fens, lakes and moors; hedge-witches, proud wizards, the fey, beasts and curses.
// Events for the journey (see rules.js for every id).
export default [
  // ---------- tier 1 ----------
  {
    id: 'w_fairy_feast', tier: 1, biome: ['wood', 'moor'],
    title: 'The Midnight Feast',
    text: 'In a ring of pale toadstools, a long table is laid: honey-cakes, roast swan, wine in acorn cups. Tall folk with antlers and moth-wing cloaks make room for you on the bench. "Sit, traveller. Eat. We ask only your company."',
    left: { label: 'Eat your fill', tile: 'fairy_ring', out: [
      { w: 3, text: 'The best meal of your life. You wake at dawn in a bare field, belly full, your pack stuffed with honey-cakes that never go stale.', food: 3, flag: 'w_fey_bread' },
      { w: 1, text: 'The feast is glorious. But afterwards bread tastes of ash and meat of mud, and no amount of either will ever fill you again.', trait: 'wendigo', flag: 'w_fey_bread' },
    ] },
    right: { label: 'Dance, but touch nothing', tile: 'fairy_ring', out: [
      { w: 2, text: 'You dance till the stars wheel. A fey lady laughs, and whispers three true things about the road ahead into your ear.', sight: 2 },
      { w: 1, text: 'You dance one dance. When you stop, three days have gone by, and so has everything in your pack.', food: -3 },
    ] },
  },
  {
    id: 'w_toad_prince', tier: 1, biome: ['fen', 'lake'],
    title: 'The Toad Who Would Be Prince',
    text: 'A fat toad on a lily pad clears its throat. "I am Prince Hollis of the Seven Wells, cursed by a spiteful witch. One kiss will break the spell, and my gratitude is famously generous." It puckers, hopefully.',
    left: { label: 'Kiss the toad', tile: 'lake', out: [
      { w: 2, text: 'A flash, a pop, and a damp young prince is sitting in the pond. He pays you from a purse that smells of weed, and tells everyone he meets.', gold: 15, renown: 2 },
      { w: 1, text: 'A flash, a pop, and the world is suddenly enormous. The prince strides off on two legs, laughing. The curse had to go somewhere.', trait: 'toad' },
      { w: 1, text: 'Nothing happens. It was only a toad, and a liar. Your lips taste of pond for a week.' },
    ] },
    right: { label: 'Sell him to a witch', tile: 'witch_hut', out: [
      { w: 2, text: 'The hedge-witch pays good silver for a talking toad, and throws in a crock of stew. "Princes make the finest broth," she says.', gold: 8, food: 2 },
      { w: 1, text: 'He wriggles free in the reeds. In the chase you lose a boot and your dinner to the bog, while he croaks rude things from a safe distance.', food: -1, hp: -1 },
    ] },
  },
  {
    id: 'w_she_wolf', tier: 1, biome: ['wood', 'snow', 'moor'],
    title: 'The Starving She-Wolf',
    text: 'A grey she-wolf stands across the frozen path, every rib showing. Behind her, three cubs mewl in the bracken. She does not growl. She looks at your pack, then at you, with eyes that are almost human.',
    left: { label: 'Share your food', tile: 'forest', out: [
      { w: 3, text: 'You lay out your bread and salt pork. She eats, then touches her nose to your hand, once, like a promise. The cubs watch you go.', food: -2, flag: 'w_wolf_friend' },
      { w: 1, text: 'She eats, and licks your hand. By morning the whole wood sounds different: the jays gossip, the badgers grumble, and you understand every word.', food: -2, trait: 'beast_tongue', flag: 'w_wolf_friend' },
    ] },
    right: { label: 'Draw your blade', tile: 'forest', fight: { foe: 'wolf', name: 'the Grey She-Wolf', power: 3, dmg: 1,
      win: { text: 'She fights like a mother, to the last. Her pelt will fetch a price, and there is meat for days. You try not to listen to the cubs.', food: 2, gold: 6 },
      lose: { text: 'She opens your arm to the bone and drags your pack off to her cubs. You let her have it.', food: -1 } } },
  },
  {
    id: 'w_nine_maidens', tier: 1, biome: ['moor', 'hills'],
    title: 'The Nine Maidens',
    text: 'Nine grey stones stand on the moor. Folk say they were girls who danced on a holy day, and the tallest has an eye carved in it. At dusk you could swear they have shuffled a little closer together.',
    left: { label: 'Sleep inside the ring', tile: 'stones', out: [
      { w: 2, text: 'You dream of nine girls laughing. You wake with frost in your hair and a way of knowing what the road means to do next.', trait: 'second_sight' },
      { w: 1, text: 'You dream of nine girls weeping. You wake with one eye gone milky, and half the road turns grey whenever you look at it.', trait: 'veil' },
      { w: 1, text: 'You sleep like a stone. At dawn your supper is gone, and in its place, very neatly, lies a pebble.', food: -1 },
    ] },
    right: { label: 'Chip the carved eye', tile: 'stones', out: [
      { w: 2, text: 'A flake of blue stone comes away, still warm. Held to the firelight, it shows you omens.', sight: 2 },
      { w: 1, text: 'The chisel rings like a bell. Something grinds in the dark, and a stone that was not there before lands on your foot.', hp: -1 },
    ] },
  },
  {
    id: 'w_poacher', tier: 1, biome: ['wood', 'farm'],
    title: 'The Poacher’s Fire',
    text: 'A lean poacher in a coat of rabbit-skins shares his fire and a haunch of stolen venison. "The verderer’s men sweep this wood tonight," he says. "Help me carry the rest of the deer out, and half of it’s yours."',
    left: { label: 'Shoulder half a deer', tile: 'forest', out: [
      { w: 2, text: 'You stagger out of the wood under half a deer. The poacher claps your back and swears the Greenhood will hear your name.', food: 3, ally: 'rebels' },
      { w: 1, text: 'Lanterns in the trees. The verderer’s men catch you red-handed, and the forest court fines you on the spot.', pay: 10 },
      { w: 1, text: 'A verderer’s man steps out of the dark with a drawn bow.', fight: { foe: 'soldier', name: 'the Verderer’s Man', power: 4, dmg: 1,
        win: { text: 'He flees into the night, dropping his bow in the bracken. You keep it.', item: 'bow' },
        lose: { text: 'He clubs you down and hauls your pack off to the forest court as evidence.', food: -2 } } },
    ] },
    right: { label: 'Buy his spare snare', cost: 8, tile: 'camp', out: [
      { w: 2, text: 'He shows you how to set it, and all his wood-lore besides. "Stop starving, friend," he says. "It’s embarrassing to watch."', relic: 'snare' },
      { w: 1, text: 'You wake to a cold fire. The poacher is long gone, and so is a slice of your purse. The snare he sold you is a tangle of string.', gold: -6 },
    ], poor: { text: 'You can’t pay. He lets you share his fire anyway, and his fleas, and tells you which paths the verderer watches.', sight: 1 } },
  },
  {
    id: 'w_wisp_lights', tier: 1, biome: ['fen', 'moor'],
    title: 'Lights on Blackwater Fen',
    text: 'As dusk settles on the fen, pale blue lights rise from the reeds and bob away across the bog. One drifts back toward you, as if waiting. Somewhere out there, a bell is tolling under the water.',
    left: { label: 'Follow the lights', tile: 'swamp', out: [
      { w: 2, text: 'The lights lead you to a drowned chapel, its bell-rope trailing in a pool. Among the bones in the silt lie silver coins and an old charm.', gold: 10, relic: 'random' },
      { w: 2, text: 'The lights go out all at once. You spend the night hip-deep in black water, and the bog keeps a boot and your supper.', food: -2, hp: -1 },
    ] },
    right: { label: 'Hire a punt across', cost: 6, tile: 'ferry', out: [
      { w: 2, text: 'An eel-catcher poles you over by lantern-light, singing to keep the wisps off, and throws in a string of eels at the far side.', food: 2 },
      { w: 1, text: 'Halfway over, the wisps crowd the punt and the eel-catcher jumps ship. You pole yourself through the dark and hit every snag in the fen.', hp: -1 },
    ], poor: { text: 'You can’t pay. He points you down a rotten causeway, and you go through it to the waist. Something brushes your leg on the way out.', hp: -1 } },
  },
  {
    id: 'w_hare_witch', tier: 1, biome: ['farm', 'moor'],
    title: 'The Hare in the Lane',
    text: 'A big brown hare sits in the lane and will not run. It watches you with yellow eyes. A farmer at his gate spits. "That’s old Mother Crake, that is. Put a stone through her and I’ll give you ten gold."',
    left: { label: 'Throw the stone', tile: 'farm', fight: { foe: 'witch', name: 'Mother Crake', power: 4, dmg: 1,
      win: { text: 'The stone strikes. The hare is an old woman in a heap of shawls, then a hare again, limping off. The farmer pays, and a hare’s foot lies in the lane.', gold: 10, relic: 'rabbit_foot' },
      lose: { text: 'The stone stops in mid-air and comes straight back. Her laughter follows you for miles, and your purse feels lighter every time you check it.', gold: -8 } } },
    right: { label: 'Bid her good day', tile: 'hovel', out: [
      { w: 2, text: 'The hare dips its head and lopes off. That evening a basket waits on the path: bread, cheese, a jar of plums, and a note that says "Manners."', food: 3 },
      { w: 1, text: 'The farmer, disgusted, sets his dogs on you for a witch-lover. You lose a mouthful of breeches and your dinner.', food: -1, hp: -1 },
    ] },
  },
  {
    id: 'w_oakhollow_boar', tier: 1, biome: ['wood', 'farm'],
    title: 'The Tusker of Oakhollow',
    text: 'A boar the size of a hay-cart is rooting through the acorns on the only path through Oakhollow. Its tusks are yellow and chipped, and an old spearhead is still stuck in its shoulder.',
    left: { label: 'Take on the boar', tile: 'forest', fight: { foe: 'boar', name: 'the Oakhollow Tusker', power: 4, dmg: 1,
      win: { text: 'It goes down like a felled oak. You eat like a lord, salt the rest, and work the old spearhead free. Lashed to an ash pole, it makes a proper boar spear.', food: 3, item: 'spear' },
      lose: { text: 'It tosses you into a holly bush and trots off with an air of deep contempt.' } } },
    right: { label: 'Go round through the briars', tile: 'forest', out: [
      { w: 2, text: 'The long way round costs you an afternoon, but the briars are heavy with blackberries, and you eat till your fingers are purple.', food: 2 },
      { w: 1, text: 'In the briars you meet a charcoal-burner, black as a crow, who warns you which paths in this wood are unlucky. He seems very sure.', sight: 1 },
      { w: 1, text: 'The briars close in like a maze. You lose your way, your hat and a whole day’s food.', food: -2 },
    ] },
  },
  {
    id: 'w_hermit_oak', tier: [1, 2], biome: ['wood', 'hills'],
    title: 'The Hermit in the Hollow Oak',
    text: 'A hermit lives inside a hollow oak, his beard humming with bees. He keeps his hives in old soldiers’ helmets. "Honey for the belly," he says, "or a cure for the soul. The cure stings."',
    left: { label: 'Buy a comb of honey', cost: 5, tile: 'hermitage', out: [
      { w: 3, text: 'Dark heather honey, and a loaf of acorn bread. His bees see you to the edge of the wood like a guard of honour.', food: 3 },
      { w: 1, text: 'The honey is sweet. The bees are not. You leave swollen and swearing, but fed.', food: 2, hp: -1 },
    ], poor: { text: 'You have no coin. He gives you a thimble of honey anyway, and a lecture on thrift that lasts until dark.', food: 1 } },
    right: { label: 'Take the stinging cure', tile: 'hermitage', out: [
      { w: 2, text: 'He sets a hundred bees on your bare back. It hurts past words, and afterwards you feel scrubbed clean inside. He packs the welts with healing moss.', lift: true, relic: 'moss' },
      { w: 1, text: 'The bees swarm, think better of it, and turn on the hermit. You both run for the stream and lie in it till dusk, hungry and laughing.', food: -1, hp: -1 },
    ] },
  },
  {
    id: 'w_newt_jar', tier: [1, 2],
    title: 'The Apprentice in the Jar',
    text: 'A newt in a pickle jar is hammering on the glass with tiny fists. "I’m an apprentice! My master’s rival did this! Take me to the tower of Magister Vell and you’ll be rewarded. Or," it adds, "at least undo the lid."',
    left: { label: 'Carry him to the tower', tile: 'wizard_tower', out: [
      { w: 2, text: 'Magister Vell restores his apprentice with a snap of his fingers and, being proud, overpays wildly. "Tell the Circle who helped you," he says.', gold: 12, ally: 'mages' },
      { w: 1, text: 'The tower you find belongs to the rival. "How thoughtful," he purrs, pockets the jar, and sets his gargoyles on you. You leave without your pack.', food: -2 },
    ] },
    right: { label: 'Unscrew the lid', tile: 'swamp', out: [
      { w: 2, text: 'The newt leaps into a puddle and comes up a skinny, dripping boy. He gives you all he has: three silver spoons and a prophecy about your left boot.', gold: 8, sight: 1 },
      { w: 1, text: 'The newt bites your thumb, cackles in a very unapprenticely way, and is gone into the reeds. Your thumb turns green and throbs for days.', hp: -1 },
    ] },
  },

  // ---------- tier 2 ----------
  {
    id: 'w_black_dog', tier: 2, biome: ['moor', 'hills'],
    title: 'The Black Dog of Crowmoor',
    text: 'A black dog the size of a calf falls into step beside you on the moor road, silent, its eyes like coals in a grate. Folk say whoever it walks with is dead within the week. It is walking with you.',
    left: { label: 'Follow where it leads', tile: 'graveyard', out: [
      { w: 2, text: 'It leads you to a lonely grave and scratches at the stone. Beneath it lie a traveller’s purse and a good sword, as if left for you. The dog is gone.', gold: 15, item: 'longsword' },
      { w: 1, text: 'It leads you to a fresh grave with no name on the stone. When you look up, the dog is sitting on it, and you know whose grave it is.', trait: 'reaper', flag: 'w_marked' },
    ] },
    right: { label: 'Turn back the way you came', tile: 'road', out: [
      { w: 2, text: 'The dog does not follow. It only watches you go. The long way round costs you a cold, hungry night on the moor.', food: -1 },
      { w: 1, text: 'The dog walks beside you all night, step for step, and is gone at cockcrow. You are alive, and starving, and you see the world a little differently now.', food: -2, sight: 1 },
    ] },
  },
  {
    id: 'w_mother_mirecrop', tier: 2, biome: ['fen', 'lake'],
    title: 'Mother Mirecrop’s Kitchen',
    text: 'A hut squats in the bog on stilts of bundled reeds. Inside, Mother Mirecrop stirs a cauldron with a thighbone. "Potions, cures, a little light cursing," she croaks. "Or scrub my pots, dearie, and I’ll feed you."',
    left: { label: 'Browse her shelves', tile: 'witch_hut', shop: 'witch', out: [
      { text: 'Jars of eyes, bottled fogs, a mandrake asleep in a teacup. "Touch nothing that blinks," she says.' },
    ] },
    right: { label: 'Scrub her pots', tile: 'witch_hut', out: [
      { w: 2, text: 'Three hours scrubbing things you would rather not name. Then she feeds you a black broth that turns your insides to iron. You could digest a boot now.', trait: 'iron_stomach' },
      { w: 2, text: 'Three hours of scrubbing. She feeds you eel pie until you beg her to stop, and wraps up another for the road.', food: 3 },
      { w: 1, text: 'You crack her oldest cauldron. She doesn’t shout. She only smiles, and from that day your feet insist on doing everything twice.', trait: 'twin_step' },
    ] },
  },
  {
    id: 'w_changeling', tier: 2, biome: ['farm', 'fen', 'wood'],
    title: 'The Changeling',
    text: 'In a fen cottage, a mother rocks a cradle with a face like a walnut in it. "That’s not my Tam," she whispers. "It eats like six men and it smiles at the cat. The fair folk took mine." The thing in the cradle winks at you.',
    left: { label: 'Bargain at the fairy ring', tile: 'fairy_ring', out: [
      { w: 2, text: 'At the ring you make a fair trade in the old words. The Hidden Folk hand back a sleepy boy, take their own home, and name you a friend of the Court.', ally: 'fey', renown: 2 },
      { w: 1, text: 'The Hidden Folk take their child back and keep you dancing a month for your cheek. You come home thin, with Tam, and with a limp.', food: -3, hp: -1 },
    ] },
    right: { label: 'Threaten it with iron', tile: 'hovel', out: [
      { w: 2, text: 'At the sight of cold iron the thing in the cradle swears like a tinker and flees up the chimney. Tam is back by morning, and his mother feeds you like a hero.', food: 3, renown: 1 },
      { w: 1, text: 'It flees up the chimney. At dusk, its kin come looking for whoever frightened it.', fight: { foe: 'goblin', name: 'the Hob-Kin', power: 6, dmg: 1,
        win: { text: 'You drive them off with iron and a poker. In their haste they leave a hob’s purse behind, full of real silver for once.', gold: 15 },
        lose: { text: 'They pinch and bite and knot your hair, and run off cackling with your boots and your bread.', food: -2 } } },
    ] },
  },
  {
    id: 'w_silk_wood', tier: 2, biome: ['wood'],
    title: 'The Silk-Hung Wood',
    text: 'Webs thick as sailcloth hang between the pines, and grey bundles hang in the webs. One of them is kicking. From somewhere overhead comes a soft clicking, like someone counting coins.',
    left: { label: 'Cut the bundle down', tile: 'forest', out: [
      { w: 2, text: 'Out tumbles a pedlar, alive and sobbing with gratitude. He presses his purse on you and runs, and he will tell this story for the rest of his life.', gold: 20, renown: 1 },
      { w: 2, text: 'The web thrums. Something the size of a cart comes down the silk, still counting.', fight: { foe: 'spider', name: 'the Counting Spider', power: 8, dmg: 2,
        win: { text: 'You take its legs off one by one. In its larder hang the purses of a dozen travellers, still full.', gold: 25 },
        lose: { text: 'It fills you with sleep. You wake at the edge of the wood, wrapped like a parcel and robbed of everything soft.', food: -2 } } },
    ] },
    right: { label: 'Burn a path through', tile: 'forest', out: [
      { w: 2, text: 'The webs go up like paper lanterns, and something shrieks in the canopy. Among the ashes lies a dead knight’s mail shirt, black with soot but whole.', item: 'chain' },
      { w: 1, text: 'The webs burn, and a whole larder of cocooned grouse and hares drops out of the trees, roasted in their silk.', food: 3 },
      { w: 1, text: 'The fire takes the pines. You run all night ahead of the blaze with your eyebrows smoking, and lose your pack in the rush.', food: -2, hp: -1 },
    ] },
  },
  {
    id: 'w_wizard_volunteer', tier: 2, biome: ['hills', 'moor'],
    title: 'The Wizard Wants a Volunteer',
    text: 'Hesketh Fane’s tower leans on the stars like a drunk on a wall. The wizard waits on the step in carpet slippers. "A jackdaw has stolen my spectacles, and I need a volunteer for a new draught. Pick one. Both pay."',
    left: { label: 'Drink the draught', tile: 'wizard_tower', out: [
      { w: 2, text: 'It tastes of lightning and liquorice. For a moment you see all {kingdom} spread out like a map, and a little of the sight stays behind your eyes.', sight: 2 },
      { w: 1, text: 'It tastes of nothing. "A dud," sighs Fane, and pays you anyway, on condition you never mention it to the Circle.', gold: 15 },
      { w: 1, text: 'It tastes of pond. You float for a day and a night, bumping along the rafters, while Fane takes notes and forgets to feed you.', food: -2, hp: -1 },
    ] },
    right: { label: 'Climb after the jackdaw', tile: 'forest', out: [
      { w: 2, text: 'The jackdaws mob you all the way up the dead elm, but you come down with his spectacles. Fane, moved, writes to the Circle about you.', ally: 'mages' },
      { w: 1, text: 'In the nest, among the spoons and buttons, lies an old coin that seems to breed. You pocket it and say nothing.', relic: 'tinker_coin' },
      { w: 1, text: 'A rotten branch gives way thirty feet up. You land in the wizard’s herb bed, which he minds more than you do.', hp: -2 },
    ] },
  },
  {
    id: 'w_millers_son', tier: 2, biome: ['farm', 'wood'],
    title: 'The Miller’s Son',
    text: 'Sheep lie torn in the fields round Hobb’s Mill, and the miller’s gentle giant of a son has hair on his palms and dread in his eyes. The village is melting down spoons for silver. He grips your sleeve. "Hide me till the moon’s past."',
    left: { label: 'Hide him in the mill', tile: 'mill', out: [
      { w: 2, text: 'All night the grain loft shakes with howling. At dawn a shaking young man thanks you, and his father fills your pack with flour-cakes and your purse with pennies.', food: 3, gold: 8 },
      { w: 1, text: 'An hour before midnight, the loft door bursts outward.', fight: { foe: 'werewolf', name: 'the Miller’s Son', power: 8, dmg: 2,
        win: { text: 'You beat him down and chain him to the millstone till dawn. The miller weeps, and gives you everything in the till.', gold: 18 },
        lose: { text: 'He bites deep, then flees howling into the fields. The wound heals too fast, and itches whenever the moon is up.', trait: 'wolfblood' } } },
      { w: 1, text: 'At dawn the village finds claw-marks in the loft and you on guard beside them. The reeve fines you for harbouring a beast.', pay: 15 },
    ] },
    right: { label: 'Lead the hunt', tile: 'farm', fight: { foe: 'werewolf', name: 'the Beast of Hobb’s Mill', power: 7, dmg: 2,
      win: { text: 'The silver finds him in the moonlight. The village feasts you as a hero, though the miller will never look at you again.', gold: 10, renown: 2 },
      lose: { text: 'He goes through the hunters like wet paper. You wake in a ditch with a bite that burns like fever, and a new hunger under it.', trait: 'wolfblood' } } },
  },

  // ---------- tiers 2 and 3 ----------
  {
    id: 'w_pack_remembers', tier: [2, 3], needs: 'w_wolf_friend', w: 3,
    title: 'The Pack Remembers',
    text: 'The grey she-wolf you once fed finds you again, grown huge, her cubs now wolves at her back. She drops a torn leather glove at your feet and whines, then turns her head toward the smoke of a trappers’ camp.',
    left: { label: 'Raid the trappers', tile: 'camp', fight: { foe: 'mercenary', name: 'the Pelt-Trappers', power: 7, dmg: 2,
      win: { text: 'The wolves do the rest. You break the cage that holds her mate and help yourself to the trappers’ purse, and she lays a wolf-tooth charm in your palm.', relic: 'wolf_tooth', gold: 15 },
      lose: { text: 'The trappers have dogs and nets. You tear free through the brambles, and not every wolf gets out with you.', food: -1 } } },
    right: { label: 'Run with the pack', tile: 'forest', out: [
      { w: 2, text: 'You run with them all night under the moon and share their kill, and something of them stays in you: sharper teeth, a hunter’s patience.', food: 2, trait: 'wolfblood' },
      { w: 1, text: 'You run with them all night and learn their tongue as you go. By dawn every beast in the wood knows you for a friend.', trait: 'beast_tongue' },
    ] },
  },
  {
    id: 'w_holy_well', tier: [2, 3],
    title: 'Saint Ysolde’s Well',
    text: 'Rags of a hundred colours hang from the thorn tree over Saint Ysolde’s Well, each one a sorrow left behind. The water is cold enough to stop a heart. The old well-warden taps her cane. "Bathe, or leave a rag. Not both."',
    left: { label: 'Bathe in the well', cost: 10, tile: 'well', out: [
      { w: 2, text: 'The cold hits like a hammer. When you crawl out, gasping, whatever clung to you has let go. The warden nods. "Better."', lift: true, hp: 1 },
      { w: 1, text: 'Under the water, a hand as cold as the well closes over yours. You come up clean, and warded against whatever comes for you next.', lift: true, trait: 'saints_ward' },
      { w: 1, text: 'The cold stops your breath. You wake on the grass with the warden thumping your chest, colder and no cleaner than before.', hp: -1 },
    ], poor: { text: 'You have no coin for the warden, so she lets you drink from the overflow. It is only water, but it is very good water.', hp: 1 } },
    right: { label: 'Tie a rag on the thorn', tile: 'shrine', out: [
      { w: 2, text: 'You tie a strip of your cloak and whisper your worst sorrow into it. A robin lands on your wrist, and from that day luck seems to walk beside you.', trait: 'lucky' },
      { w: 2, text: 'You tie your rag and feel foolish. The warden shares her bread and cheese, and tells you her own sorrow, which is worse.', food: 2 },
      { w: 1, text: 'As you knot the rag, a thorn goes deep into your palm, and the hand festers for days. The saint, it seems, is choosy.', hp: -1 },
    ] },
  },
  {
    id: 'w_white_worm', tier: [2, 3], biome: ['lake', 'fen'],
    title: 'The White Worm of Eelby',
    text: 'For sixty years the fisherfolk of Eelby have fed a great white serpent a sheep every new moon. This moon there are no sheep left. The headwoman looks at you, then at her daughter, then back at you.',
    left: { label: 'Slay the White Worm', tile: 'lake', fight: { foe: 'serpent', name: 'the White Worm', power: 10, dmg: 2, elite: true,
      win: { text: 'It dies thrashing, and the lake runs milk-white for a week. Eelby empties its purses for you, and will sing of you for a hundred years.', gold: 20, renown: 2 },
      lose: { text: 'The Worm swallows you whole and, finding you disagreeable, spits you out on the far shore: raw, bald and reeking.' } } },
    right: { label: 'Row the girl away tonight', tile: 'ferry', out: [
      { w: 2, text: 'You row her across the dark lake to kin in the hills. She presses her grandmother’s silver ring on you, and Eelby will remember what you did.', gold: 12, renown: 2 },
      { w: 1, text: 'Halfway across, the water swells beneath the boat. You row like a madman and reach the shore alive, but the Worm keeps your pack.', food: -3 },
    ] },
  },
  {
    id: 'w_greenhood', tier: [2, 3], biome: ['wood'],
    title: 'Supper with the Greenhood',
    text: 'Hooded archers drop from the oaks and lead you, blindfolded, to a camp in a hollow. Their captain, a one-eyed woman called Wren Marrow, carves you a slice of some lord’s venison. "Now," she says. "What use are you?"',
    left: { label: 'Join tonight’s raid', tile: 'road', fight: { foe: 'mercenary', name: 'the Moneylender’s Guards', power: 7, dmg: 2,
      win: { text: 'The strongbox is heavy with other people’s debts. Wren burns the ledgers, gives you a fair share, and a green hood of your own.', gold: 20, ally: 'rebels' },
      lose: { text: 'The guards were waiting. You flee through the dark with an arrow in your pack and nothing else to show for the night.', food: -1 } } },
    right: { label: 'Trade at their fence', tile: 'bandit_camp', shop: 'fence', out: [
      { text: 'Wren waves you to a cart heaped with stolen goods. "Everything’s for sale," she says. "Nothing’s been missed. Yet."' },
    ] },
  },

  // ---------- tier 3 ----------
  {
    id: 'w_lady_of_the_mere', tier: 3, biome: ['lake'],
    title: 'The Lady of Hollowmere',
    text: 'Mist lies on Hollowmere like a held breath. Out in the middle a white arm rises from the water, holding a sword that makes the moon look dim. A voice like rain on reeds asks, "Who comes?"',
    left: { label: 'Wade out to her', tile: 'lake', out: [
      { w: 1, text: 'The water is at your chin when the hand gives you the sword. It is warm, and it seems to know your name. Then the arm is gone, and the mere lies still as glass.', relic: 'kingsblade' },
      { w: 2, text: '"Not you," says the voice, sadly, and the great sword sinks. But a lesser one bobs up into your hand: long, runed, and older than {kingdom}.', item: 'runeblade' },
      { w: 3, text: 'The cold takes you to the bone and the mist swallows the sword. You crawl ashore blue-lipped and shaking, with nothing but a fever.', hp: -2 },
    ] },
    right: { label: 'Leave gold at her shrine', cost: 20, tile: 'shrine', out: [
      { w: 2, text: '"Generous," says the voice, pleased. The mere brims over the shore to wash your feet, and your wounds close like a book.', hp: 2 },
      { w: 1, text: 'A silver fish leaps into your lap and says one word before it flops back into the water. The word is a name, and you will know it when you hear it.', sight: 2 },
      { w: 1, text: 'By morning the gold is gone and nothing has answered. When the mist lifts, you have wandered a whole day round the shore.', food: -2 },
    ], poor: { text: 'You have no gold to give, so you leave your last crust instead. The swans eat it. The Lady does not come back.', food: -1 } },
  },
  {
    id: 'w_fey_debt', tier: 3, needs: 'w_fey_bread', w: 3,
    title: 'The Debt of the Feast',
    text: 'A tall stranger with antlers under his hood falls into step beside you. "You ate at our table and never paid," he says pleasantly. "The Court is patient, but not forever. Serve us a night, or refuse us."',
    left: { label: 'Serve beneath the hill', tile: 'fairy_ring', out: [
      { w: 2, text: 'You pour wine at a fey wedding for one night. When you come up a season has passed, but the Fey Queen names you friend and gives you shoes that stride seven leagues.', food: -2, ally: 'fey', relic: 'boots' },
      { w: 1, text: 'You serve one night. When you come up a whole year has gone, and taken its toll: you are thin as a moth, and your bones creak like winter branches.', food: -2, trait: 'glass_bones' },
    ] },
    right: { label: 'Refuse him with iron', tile: 'road', fight: { foe: 'knight', name: 'the Antlered Knight', power: 10, dmg: 2,
      win: { text: 'Iron bites, and the knight bursts into a flurry of moths. The Court declares the debt paid in courage, and his antlers were hung with gold rings.', gold: 30, renown: 2 },
      lose: { text: 'He knocks you flat with the butt of his spear. "The debt stands," he says, and takes it out of your pack.', food: -2 } } },
  },
  {
    id: 'w_death_dice', tier: 3, needs: 'w_marked', hasTrait: 'reaper', w: 3,
    title: 'Knucklebones with Death',
    text: 'On a lonely milestone sits a tall grey figure, rattling knucklebones in a cup made from a skull. "Evening, {name}," says Death, mildly. "You and I have an appointment. Shall we settle it like gentlefolk? Best of three."',
    left: { label: 'Play him for your life', tile: 'road', out: [
      { w: 5, text: 'The bones fall your way, twice. Death sighs, scratches your name off his slate, and pays your winnings in coins from dead men’s eyes.', lift: 'reaper', gold: 30 },
      { w: 1, text: 'The bones fall his way, twice. "Good game," says Death, and holds out his hand, and you find you have already taken it.', die: 'lost at knucklebones to Death' },
    ] },
    right: { label: 'Offer him some years', tile: 'graveyard', out: [
      { text: '"Years are good coin," Death agrees, and takes a handful. You walk on grey at the temples, with a slower heart, no mark on your brow and a glimpse of his ledger.', lift: 'reaper', maxhp: -1, sight: 1 },
    ] },
  },
  {
    id: 'w_wild_hunt', tier: 3, biome: ['moor', 'hills', 'snow'],
    title: 'The Wild Hunt',
    text: 'Horns blow in the storm-clouds, and the Wild Hunt pours down the sky: antlered riders, white hounds with red ears, the Huntsman on a horse of smoke. He reins in above you. "Ride with us," he laughs, "or run."',
    left: { label: 'Ride with the Hunt', tile: 'mountain', out: [
      { w: 2, text: 'You ride all night across the roofs of the world. At dawn the Huntsman tosses you a purse of fey gold and a nod: the Court will know your face.', gold: 25, ally: 'fey' },
      { w: 1, text: 'You ride all night, and at dawn they drop you in a bog forty miles from anywhere, frostbitten and starving, their laughter fading overhead.', food: -2, hp: -1 },
    ] },
    right: { label: 'Run, and make it sport', tile: 'forest', fight: { foe: 'wolf', name: 'the Hounds of the Hunt', power: 10, dmg: 2,
      win: { text: 'You turn at bay in a thicket and fight like a cornered stag. The Huntsman whoops, calls off his hounds, and pays for good sport from his saddlebag.', gold: 25, renown: 3 },
      lose: { text: 'The hounds run you down and worry you in a ditch until the horns fade and the sky is empty again.', food: -1 } } },
  },
  {
    id: 'w_peat_king', tier: 3, biome: ['fen', 'moor'],
    title: 'The Man in the Peat',
    text: 'Peat-cutters have dug a man out of the bog: leather-skinned, perfectly kept, a torc of red gold at his throat. They say he has lain there a thousand years, and none of them will touch the gold. As you lean close, his eyelids flicker.',
    left: { label: 'Take the torc', tile: 'swamp', out: [
      { w: 3, text: 'The torc comes free with a sound like a sigh. It is heavy and old and worth a fortune, and the cutters will not meet your eye.', gold: 40 },
      { w: 1, text: 'His hand closes on your wrist, and the Bog King rises, streaming black water.', fight: { foe: 'wraith', name: 'the Bog King', power: 12, dmg: 3, elite: true,
        win: { text: 'You drive him back into the peat and stamp the turf down over his face. The torc is yours, and his rings besides.', gold: 45 },
        lose: { text: 'His grip is like a root. He drags you half under before you tear free, leaving your pack and your boots to the king.', food: -2 } } },
    ] },
    right: { label: 'Rebury him with honour', tile: 'graveyard', out: [
      { w: 2, text: 'You and the cutters raise him a proper barrow. That night a king in a red torc walks in your dreams and shows you where his people hid their grain.', food: 3, sight: 1 },
      { w: 1, text: 'You bury him deep. The cutters share their supper with you, though they mutter that you have buried a fortune.', food: 2 },
      { w: 1, text: 'As the last turf falls, a hand closes on your ankle and holds on for an hour. That leg is never quite warm again.', hp: -1 },
    ] },
  },
  {
    id: 'w_sleeping_giant', tier: 3, biome: ['hills', 'moor'], unless: 'd_snoring_hill',
    title: 'The Giant’s Shirt Pocket',
    text: 'The long green hill you are crossing rises, and falls, and snores. You are walking on a sleeping giant. From his shirt pocket, a cave in the turf, comes a drowsy honking and the glint of gold.',
    left: { label: 'Climb into his pocket', tile: 'cave', out: [
      { w: 2, text: 'A goose sits on a nest of straw and golden eggs. She lets you tuck her under your arm and carry her off, honking only a little.', relic: 'golden_goose' },
      { w: 2, text: 'The goose honks like a trumpet. The hill heaves, and a hand the size of a barn closes round you.', fight: { foe: 'giant', name: 'the Sleeping Giant', power: 12, dmg: 2,
        win: { text: 'You stab his thumb until he bellows and lets go, and you slide down his sleeve clutching his toothpick. It makes a very fine lance.', item: 'lance' },
        lose: { text: 'He flicks you off like a crumb, still asleep. You land in a bog two valleys over, bruised and very much awake.', food: -1 } } },
    ] },
    right: { label: 'Tiptoe down his arm', tile: 'road', out: [
      { w: 2, text: 'You creep down his sleeve and off his fingertips. In the shade of his hand grow mushrooms as big as loaves, and you fill your pack.', food: 3 },
      { w: 1, text: 'He mutters in his sleep, a giant’s dream of days to come, and you remember every word of it.', sight: 2 },
      { w: 1, text: 'He rolls over. The hill tips like a ship in a gale, and you roll the whole way down it with the rocks.', hp: -2 },
    ] },
  },
  {
    id: 'w_hollow_fair', tier: 3, biome: ['moor', 'wood'],
    title: 'The Hollow Fair',
    text: 'Under the full moon a fair has sprung up on the heath where there was none at sunset: striped stalls, lantern-fruit, music with too many notes. A fox in a velvet doublet bows you in. "We take any coin here. Even sorrows."',
    left: { label: 'Sell them your sorrows', tile: 'fairy_ring', out: [
      { w: 2, text: 'A stallholder with moth’s eyes buys your worst trouble by the ounce and pays in warm silver. You walk away lighter than you have been in years.', lift: true, gold: 15 },
      { w: 1, text: 'She buys a sorrow, but not the one you meant. You cannot remember your mother’s face now, only that you once could. She paid well for it.', gold: 30 },
      { w: 1, text: 'The sorrow is sold, and then a clerk presents the bill: a weighing fee, a bagging fee, and a fee for the fee. At a fey fair, you pay what you owe.', pay: 15 },
    ] },
    right: { label: 'Browse the stalls', tile: 'market', shop: 'market', out: [
      { text: 'Pears that taste of summer, bread that sings in the oven, a smith selling blades of evening light. Most of the prices, oddly, are in gold.' },
    ] },
  },
];
