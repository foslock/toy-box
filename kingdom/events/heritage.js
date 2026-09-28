// Kingdom: heritage. What one life leaves the lives after it: curses a house is born under, boons it is blessed with,
// and business an heir must finish. Every event here makes a mark on the house (mark), needs one (needsMark) or
// ends one (unmark). See rules.js for every id, and MARKS for what each mark does.
//
// Curses: the Hag's Blight, the Drowned Promise, the Lean Years, the Goblin's Due, each with a cure.
// Boons: the Fey Godmother, the Saint's Favour, Friends of the Pack, the Dragon's Debt, the Full Granary.
// Quests: the Buried Hoard, the Broken Blade, the Unquiet Tomb, each with a way for a later heir to finish it.
export default [
  /* ====================== CURSES ON THE LINE ====================== */

  /* ---------- the Hag's Blight (curse_hag) ---------- */
  {
    id: 'h_ducking_stool', tier: 1, biome: ['farm', 'fen'], unlessMark: 'curse_hag',
    title: 'The Ducking Stool',
    text: 'All Wetherby is at the millpond to duck Gammer Hagworm for a witch. She sits strapped to the stool, spitting pondweed and naming names. The reeve needs a strong arm on the lever. "A penny a dip." Her black cat watches you from the reeds.',
    left: { label: 'Work the lever', tile: 'lake', out: [
      { w: 2, text: 'She floats, so she is a witch. On the third dip she comes up laughing, and curses you, and every child of your house to come. The reeve pays up. The cat follows you out of Wetherby.', gold: 10, mark: 'curse_hag', trait: 'ill_luck' },
      { w: 2, text: 'She sinks like a stone, so she is innocent. They fish her out, blue and spitting, and the reeve pays you anyway, and the village stands you supper.', gold: 10, food: 2 },
    ] },
    right: { label: 'Cut her loose', tile: 'lake', out: [
      { w: 2, text: 'You slash the straps. The village does not thank you.', fight: { foe: 'bandit', name: 'the Wetherby Mob', power: 4, dmg: 1,
        win: { text: 'You hold the bank with the reeve’s own boar-spear while she hobbles into the reeds, and keep the spear. That night her cat leaves a silver ring on your pack.', gold: 6, item: 'spear' },
        lose: { text: 'They duck you instead, three times, for luck. You come up with a mouthful of pondweed and without your supper.', food: -2 } } },
      { w: 1, text: 'Gammer Hagworm hops off the stool as spry as a girl, wrings out her hair, and presses a candle-stub into your hand. "For seeing what’s coming, dearie. They never do."', relic: 'candle' },
      { w: 1, text: 'She is gone into the reeds before the straps hit the water. The reeve fines you the price of a witch, and a witch, it turns out, is dear.', pay: 8 },
    ] },
  },
  {
    id: 'h_luck_on_credit', tier: [2, 3], unlessMark: 'curse_hag',
    title: 'Luck on Credit',
    text: 'A crone sells luck from a tray at the crossroads: rabbits’ feet, four-leafed clover, a horseshoe still warm from the horse. "Coin, or credit," she wheezes. "Credit costs you nothing at all. Your grandchildren pay it."',
    left: { label: 'Take the luck on credit', tile: 'witch_hut', out: [
      { w: 3, text: 'She knots a red thread round your wrist. From then on the dice love you, and somewhere down the years, in a cradle not yet made, a child of your house begins to cry.', trait: 'lucky', mark: 'curse_hag' },
      { w: 1, text: 'The thread snaps as she ties it. "No refunds," she says, writing your house into her book all the same. You have bought nothing, and your children will pay for it.', mark: 'curse_hag' },
    ] },
    right: { label: 'Pay coin for her wares', tile: 'witch_hut', shop: 'witch', out: [
      { text: 'She lifts the tray’s false bottom. Beneath: bottled fogs, a mandrake asleep in a teacup, a jar of somebody’s good fortune, only slightly used. "Coin for these, dearie. No credit."' },
    ] },
  },
  {
    id: 'h_black_cat', tier: [1, 2], needsMark: 'curse_hag', w: 3,
    title: 'The Black Cat’s Supper',
    text: 'A black cat with one white whisker sits in the road, washing. It has dogged {house} since the day the hag’s curse fell, and brought the curse’s luck with it. Today, for the first time, it speaks. "I’m owed a proper supper. Then I might go."',
    left: { label: 'Buy it a salmon', cost: 10, tile: 'market', out: [
      { w: 2, text: 'It eats the whole salmon, head, tail and all, washes its face, and strolls into the hedge without a backward look. Your luck sits lighter on you, like a pack set down.', unmark: 'curse_hag', lift: 'ill_luck' },
      { w: 1, text: 'It eats the salmon, then asks for cream, then for a cushion. At dusk it is still following you, fatter, and no luckier.' },
    ], poor: { text: 'You haven’t the price of a salmon, so it has your supper instead, with contempt. It follows you anyway.', food: -2 } },
    right: { label: 'Follow it home', tile: 'witch_hut', out: [
      { w: 2, text: 'It leads you to a ruined hut in the blackthorn. Under the doorstep lies a witch-bottle full of pins, and a scrap of your house’s colours. You smash it on the hearth. The cat yawns, and leaves.', unmark: 'curse_hag', lift: 'ill_luck', food: -1 },
      { w: 1, text: 'It leads you in circles through the blackthorn until dark, then sits in the middle of a thorn bush to watch you get out.', hp: -1, food: -1 },
      { w: 1, text: 'It leads you to a cottage where an old woman is baking. She is nobody at all, only an old woman, and she feeds you both. The cat follows you out, licking its whiskers.', food: 2 },
    ] },
  },
  {
    id: 'h_curse_egg', tier: [2, 3], needsMark: 'curse_hag', w: 3, biome: ['fen', 'lake'],
    title: 'The Curse in the Egg',
    text: 'Every hag keeps her curses somewhere safe. An eel-trapper swears he knows where the one on {house} is kept: in an egg, in a duck, in a hare, in an iron box on the harpies’ island in Rookmere. He will lend you his punt for your supper.',
    left: { label: 'Trade your supper for the punt', tile: 'ferry', out: [
      { w: 3, text: 'You pole out while the harpies are off tormenting a shepherd. Box, hare, duck, egg: you crack it on the gunwale, and a smell of burnt hair drifts off across the water. Your luck comes home.', food: -2, unmark: 'curse_hag', lift: 'ill_luck' },
      { w: 1, text: 'Box, hare, duck, egg, and the egg is empty. Somebody warned the hag. The trapper keeps your supper, and says it was a very good story all the same.', food: -2 },
    ] },
    right: { label: 'Swim out past the harpies', tile: 'lake', fight: { foe: 'harpy', name: 'the Harpies of Rookmere', power: 7, dmg: 2,
      win: { text: 'You fight them off the box with a broken oar, screaming back at them. Box, hare, duck, egg: it cracks, and your house’s curse goes up like smoke. The box holds her other treasures too.', unmark: 'curse_hag', lift: 'ill_luck', gold: 10 },
      lose: { text: 'They drive you back into the water with their claws and their opinions of your family. You crawl ashore without your pack, and without the egg.', food: -1 } } },
  },

  /* ---------- the Drowned Promise (curse_drowned) ---------- */
  {
    id: 'h_under_the_ice', tier: [1, 2], biome: ['lake', 'snow', 'fen'], unlessMark: 'curse_drowned',
    title: 'Under the Ice',
    text: 'The ice on the mere cracks like a whip, and you go through. Below, it is green and very quiet. A pale woman with eyes like drowned pennies holds your ankle, gently. "Your life," says the Lady of the Mere, without bubbles, "for your children’s strength."',
    left: { label: 'Promise her', tile: 'lake', out: [
      { w: 3, text: 'She lets go. You wake on the shore coughing up half the mere, alive and oddly warm. Every child of your house will be born a little short of breath. It seemed a fair price at the time.', mark: 'curse_drowned', hp: 1 },
      { w: 1, text: 'She lets go, and presses a pearl into your palm on the way up: the price of a promise, fairly paid. Your children will pay it back.', mark: 'curse_drowned', gold: 15 },
    ] },
    right: { label: 'Kick for the light', tile: 'lake', out: [
      { w: 2, text: 'You kick free and burst up through the hole. You lie on the ice a long time, and the cold takes something it doesn’t give back.', hp: -2 },
      { w: 1, text: 'Her kelpies come for you through the green dark, all teeth and mane.', fight: { foe: 'kelpie', name: 'the Lady’s Kelpie', power: 4, dmg: 1,
        win: { text: 'You kick the kelpie in its long horse face and haul yourself out by its mane. It bolts for the deep, and the Lady lets you go. For now.', renown: 1 },
        lose: { text: 'It drags you down, and lets you go, and laughs like a horse. You crawl out on the far shore without your pack.', food: -2 } } },
      { w: 1, text: 'You kick free, and your hand closes on something as you rise: a drowned knight’s purse, still full.', gold: 12, hp: -1 },
    ] },
  },
  {
    id: 'h_ladys_due', tier: [2, 3], needsMark: 'curse_drowned', w: 3, biome: ['lake', 'fen'],
    title: 'The Lady’s Due',
    text: 'On the shore of the mere the water goes still and green, and the Lady rises to the waist, all moonlight and cold. "Your blood promised me its strength, and I have been sipping at it ever since. I will sell the promise back. Or come down and take it, if you dare."',
    left: { label: 'Pour gold into the mere', cost: 25, tile: 'lake', out: [
      { w: 3, text: 'Coin by coin, your purse goes into the water. The last is still sinking when you feel it: breath, deep and whole, as if your chest had been laced too tight all your life.', unmark: 'curse_drowned' },
      { w: 1, text: 'The Lady counts it from below, and sighs. "Not enough. I am dear." The water goes dark, and your gold with it.' },
    ], poor: { text: 'You have not the gold. She looks at you a long while. "Then I will take a little more of this one," she says, and the cold of the mere settles in your chest.', hp: -1 } },
    right: { label: 'Dive for the promise', tile: 'lake', fight: { foe: 'kelpie', name: 'the Lady’s Black Kelpie', power: 10, dmg: 2, elite: true,
      win: { text: 'Her hall is a drowned chapel, and the promise hangs in it like a pearl on a thread. Her black kelpie fights you for it, and loses. The Lady laughs like rain on reeds, and lets you keep it.', unmark: 'curse_drowned' },
      lose: { text: 'The kelpie drives you up and out of the deep, half-drowned. You wash up a mile along the shore, and the Lady’s laughter follows you out.', food: -2 } } },
  },
  {
    id: 'h_drowned_bell', tier: [1, 2], needsMark: 'curse_drowned', w: 2, biome: ['lake', 'fen'],
    title: 'The Bell Under Sunkwater',
    text: 'When the dam broke, Sunkwater church drowned, and on still nights its bell still rings under the mere. The fisherfolk say the Lady keeps her promises in that bell, and ringing it breaks one. {house} knows which promise it would break.',
    left: { label: 'Dive for the bell', tile: 'lake', out: [
      { w: 2, text: 'You find the tower in the green gloom and haul the rope once. The note goes through you like light, and you come up with lungs that fill all the way for the first time.', unmark: 'curse_drowned', hp: -1 },
      { w: 1, text: 'Her kelpies are waiting in the belfry.', fight: { foe: 'kelpie', name: 'the Belfry Kelpies', power: 5, dmg: 1,
        win: { text: 'You beat them off with the bell-rope and ring it anyway. The note goes through you like light, and your house’s promise breaks.', unmark: 'curse_drowned' },
        lose: { text: 'They drag you up onto the reeds, half-drowned, and leave you there for the herons.', food: -1 } } },
      { w: 1, text: 'The cold and the dark beat you back. You come up empty, blue-lipped and shaking, with the bell still ringing somewhere under you.', hp: -1 },
    ] },
    right: { label: 'Offer her your own strength', tile: 'swamp', out: [
      { w: 3, text: 'You wade in and make the Lady a new promise, for yourself alone. She takes it gladly. Your bones go thin as reeds, but your children, and theirs, will breathe.', unmark: 'curse_drowned', trait: 'glass_bones' },
      { w: 1, text: 'The Lady laughs. "One promise at a time, child." She takes your offer, and keeps the old one too.', trait: 'glass_bones' },
    ] },
  },

  /* ---------- the Lean Years (curse_lean) ---------- */
  {
    id: 'h_seed_corn', tier: 1, biome: ['farm'], unlessMark: 'curse_lean',
    title: 'The Seed-Corn',
    text: 'Barrowby is at church, praying for rain, and every door is shut but the granary’s, where next spring’s seed-corn sits in fat sacks. You haven’t eaten since yesterday. Eat the seed, the old saying goes, and starve the children.',
    left: { label: 'Fill your pack', tile: 'farm', out: [
      { w: 2, text: 'An old woman watches you from the church door. "Eat our seed, and your own fields will go hungry," she calls after you. "Yours, and your children’s." The bread is very good.', food: 4, mark: 'curse_lean' },
      { w: 2, text: 'Nobody sees but a crow. You bake seed-cakes on a shovel and eat well for days.', food: 4 },
    ] },
    right: { label: 'Pray with them for rain', tile: 'chapel', out: [
      { w: 2, text: 'You pray. It does not rain. But the priest shares his pottage, and the village packs you a little from the little it has.', food: 2 },
      { w: 1, text: 'You pray, and a fat drop hits the window, then a thousand. Barrowby dances in the mud and feeds you like a rainmaker.', food: 3, renown: 2 },
      { w: 1, text: 'You pray all day on a stone floor, and the collection plate comes round twice.', gold: -4 },
    ] },
  },
  {
    id: 'h_lean_thing', tier: [2, 3], needsMark: 'curse_lean', w: 3, biome: ['farm', 'moor'],
    title: 'The Lean Thing',
    text: 'The Lean Years are not a season. They are a grey thing, all ribs and antlers, that walks the fields of {house} at dusk and eats the harvest from the root. Tonight it has followed your blood to your campfire, and it is sniffing your pack.',
    left: { label: 'Feed it everything', tile: 'camp', out: [
      { w: 3, text: 'It eats your pack, your bread and your belt, then lies down by the fire and sighs like a bellows. By dawn it is gone, and you know, somehow, that the barley at home is standing up.', food: -3, unmark: 'curse_lean' },
      { w: 1, text: 'It eats everything and is still hungry. It follows you to the next village and eats that village’s supper too, and by harvest it will be back in your house’s fields.', food: -3 },
    ] },
    right: { label: 'Drive it off with fire', tile: 'farm', fight: { foe: 'wendigo', name: 'the Lean Thing', power: 9, dmg: 2,
      win: { text: 'It goes up like a hayrick and runs shrieking over the hill. In the morning a sack of grain lies where it crouched: the first of the harvests it stole from your house.', unmark: 'curse_lean', food: 3 },
      lose: { text: 'It knocks your torch into the ditch and eats your pack in front of you, slowly, looking at you the whole time.', food: -2 } } },
  },

  /* ---------- the Goblin's Due (curse_goblin) ---------- */
  {
    id: 'h_goblin_ford', tier: [1, 2], biome: ['hills', 'wood', 'fen'], unlessMark: 'curse_goblin',
    title: 'The Goblin King Can’t Swim',
    text: 'At Culver Ford a goblin king in a crown of bent spoons sits on an iron-bound chest, glaring at the river. Goblins cannot cross running water. "Carry me over, tall one, and I’ll pay you a penny. A whole one." The chest clinks when he shifts.',
    left: { label: 'Carry him across', tile: 'ferry', out: [
      { w: 2, text: 'He rides your shoulders like a jockey, kicking. On the far bank he pays a penny, then, grudgingly, nine more, and a sack of stolen apples.', gold: 10, food: 2 },
      { w: 1, text: 'Midstream he bites your ear to make you hurry. On the far bank he pays exactly one penny, as promised, and scuttles off cackling.', gold: 1, hp: -1 },
      { w: 1, text: 'On the far bank he opens the chest and tips you a double handful. "An honest porter! Rarer than dragons." He means it as an insult.', gold: 15 },
    ] },
    right: { label: 'Drop him midstream', tile: 'ferry', out: [
      { w: 3, text: 'You shrug. The king goes in like a dropped cat and the chest lands in your arms. He bobs off downstream, shrieking: "Your purse! Your children’s purses! Half, half, forever half!"', gold: 25, mark: 'curse_goblin' },
      { w: 1, text: 'You shrug. He goes in, and out of sheer spite takes the chest with him, and it sinks like an anvil. His curse floats: "Half, half, forever half!"', mark: 'curse_goblin' },
    ] },
  },
  {
    id: 'h_goblin_bailiffs', tier: [2, 3], needsMark: 'curse_goblin', w: 3,
    title: 'The Goblin’s Bailiffs',
    text: 'A goblin in a bailiff’s chain blocks the road with a ledger longer than he is. "Debt of {house} to His Majesty under Culver Hill: one chest, with interest, compounded monthly. Pay it, and your purse is your own again. Or don’t, and it isn’t."',
    left: { label: 'Settle the debt', cost: 25, tile: 'tollgate', out: [
      { w: 3, text: 'He counts it twice, bites every coin, licks his pen, and strikes {house} from the ledger with a flourish. At once your purse feels heavier.', unmark: 'curse_goblin', lift: 'leaden_purse' },
      { w: 1, text: 'He strikes {house} from the ledger, then adds a late fee, a quill fee and a fee for adding fees. You pay those too. It is still cheaper than the curse.', unmark: 'curse_goblin', lift: 'leaden_purse', gold: -8 },
    ], poor: { text: 'You can’t pay. He takes the interest in kind instead: your bread, your bootlaces, and a lock of your hair for His Majesty’s collection.', food: -2 } },
    right: { label: 'Burn the ledger', tile: 'road', fight: { foe: 'goblin', name: 'the Goblin King’s Bailiffs', power: 8, dmg: 1,
      win: { text: 'You wrestle the ledger off him and feed it to your campfire, page by page. No ledger, no debt: goblin law is very strict about paperwork. His takings are yours.', unmark: 'curse_goblin', lift: 'leaden_purse', gold: 10 },
      lose: { text: 'They beat you with the ledger, which is heavier than it looks, and add the cost of the beating to the debt.', gold: -10 } } },
  },

  /* ====================== BOONS ON THE LINE ====================== */

  /* ---------- the Fey Godmother (boon_godmother) ---------- */
  {
    id: 'h_old_woman_stile', tier: 1, biome: ['farm', 'moor'], unlessMark: 'boon_godmother',
    title: 'The Old Woman at the Stile',
    text: 'An old woman, bent as a shepherd’s crook, is stuck at a stile with a basket of goose eggs. "Lift me over, pet, and see me home to Brackenholt?" Brackenholt is half a day back the way you came. Her eyes are very bright for someone so old.',
    left: { label: 'See her home', tile: 'village', out: [
      { w: 2, text: 'Half a day there and half back, and she talks the whole way. At her gate she straightens, taller and taller, and her rags turn to moth-silk. "I’ll keep an eye on your house, pet. All of it."', food: -2, mark: 'boon_godmother' },
      { w: 1, text: 'She is exactly what she looks like: an old woman with a long walk. She gives you three eggs and a kiss, and you lose a day.', food: 1 },
    ] },
    right: { label: 'Lift her over and go on', tile: 'road', out: [
      { w: 2, text: 'You lift her over, light as a basket of feathers, and make Dunmore by supper. The landlady’s pie is the size of a cartwheel.', food: 2 },
      { w: 1, text: 'As you go she calls something after you about the road ahead. It sounds like nonsense, until it comes true.', sight: 1 },
      { w: 1, text: '"In a hurry, are we? Then hurry." Your feet ache for three days after, as if you had walked twice as far.', food: -1 },
    ] },
  },
  {
    id: 'h_godmother_favour', tier: [2, 3], needsMark: 'boon_godmother', w: 3,
    title: 'The Godmother’s Favour',
    text: 'A tiny woman in moth-silk and three pairs of spectacles pops out of a hedge. "I’ve watched over {house} since one of you saw me home over a stile. Now I want a favour. An ogre has my goddaughter’s glass slipper, and I have a bad hip."',
    left: { label: 'Fetch the slipper', tile: 'hovel', fight: { foe: 'ogre', name: 'the Ogre of Pumpkin Hollow', power: 8, dmg: 2,
      win: { text: 'The ogre goes down like a sack of turnips. The slipper is in his larder, beside a pie you don’t ask about. Your godmother kisses both your eyes, and tells the Fey Court your name.', ally: 'fey', sight: 2 },
      lose: { text: 'The ogre wears the slipper on his little finger and swats you through a window. Your godmother helps you up, and tuts, and sighs a long fey sigh.', food: -1 } } },
    right: { label: 'Beg off, politely', tile: 'road', out: [
      { w: 2, text: '"Then I’ll watch a house with time for me," she sniffs, and goes back into the hedge. The eye on your line goes out like a lamp. You make good time without it.', unmark: 'boon_godmother', food: 1, gold: 8 },
      { w: 1, text: 'She sighs. "Always the same, your lot." But she leaves a candle on the hedge-bank for you anyway, before her eye leaves your house for good.', unmark: 'boon_godmother', relic: 'candle' },
    ] },
  },

  /* ---------- the Saint's Favour (boon_saint) ---------- */
  {
    id: 'h_ordeal_coals', tier: 2, unlessMark: 'boon_saint',
    title: 'The Ordeal of the Coals',
    text: 'In Saltney a girl is accused of stealing the chapel plate. She must walk nine paces over hot coals, and if her feet blister, she hangs. She is shaking. The priest says anyone clean of heart may walk in her place. Nobody moves.',
    left: { label: 'Walk the coals for her', tile: 'bonfire', out: [
      { w: 2, text: 'Nine paces. The coals are cool as river stones, and the crowd goes to its knees. The priest weeps. "Saint Brannoc walked with you. His hand will stay on your house."', mark: 'boon_saint', renown: 2 },
      { w: 1, text: 'Nine paces, and every one of them burns. But the girl goes free, her mother kisses your blistered feet, and the priest writes to his bishop about you.', hp: -2, renown: 1, ally: 'church' },
    ] },
    right: { label: 'Find the real thief', tile: 'chapel', out: [
      { w: 2, text: 'A magpie’s nest in the bell tower glitters with chapel plate. The girl goes free, the magpie does not, and the priest pays you out of the poor-box.', gold: 12, renown: 1 },
      { w: 1, text: 'It was the sexton, who confesses the moment you look at him, and weeps into his cassock. The girl’s mother feeds you until you can barely stand.', food: 3, renown: 1 },
      { w: 1, text: 'The real thief is the reeve’s son, and the reeve fines you for slander before you have finished saying so.', pay: 12 },
    ] },
  },
  {
    id: 'h_salt_girl', tier: [2, 3], needsMark: 'boon_saint', w: 2, biome: ['fen', 'lake'],
    title: 'The Girl Turning to Salt',
    text: 'In Saltney, where your house once walked the coals, a fishwife’s girl is turning to salt a finger at a time, under a sea-witch’s curse. The priest looks from her to you. "Saint Brannoc’s hand is on {house}. Give it to her, and it may save her. It won’t come back."',
    left: { label: 'Give her the saint’s hand', tile: 'chapel', out: [
      { w: 3, text: 'You take her salt-white hand in yours. Something warm goes out of the back of your neck and into her, and by morning she is pink to the fingertips. The priest writes to his bishop about you.', unmark: 'boon_saint', ally: 'church', renown: 2 },
      { w: 1, text: 'Something warm goes out of you and into her, and by morning she is laughing. Her mother feeds you on the best of the catch, and cannot stop crying into the chowder.', unmark: 'boon_saint', food: 3, renown: 1 },
    ] },
    right: { label: 'Keep it for your children', tile: 'road', out: [
      { w: 2, text: 'The priest nods, grey-faced. "It is yours to keep." You leave Saltney by the back lane, with your house’s blessing whole and no one there to wave you off.', food: 1 },
      { w: 1, text: 'On the shingle the sea-witch is waiting, curious to see who would not give. "Then fight me for the girl, stingy thing."', fight: { foe: 'witch', name: 'the Sea-Witch of Saltney', power: 8, dmg: 2,
        win: { text: 'You drive her into the surf and she goes out with the tide, shrieking. The girl wakes pink and whole, and it cost your house nothing at all.', renown: 2, gold: 10 },
        lose: { text: 'She knocks you into the surf and holds you under a while, for manners, and goes off laughing with the tide.', food: -1 } } },
    ] },
  },

  /* ---------- Friends of the Pack (boon_pack) ---------- */
  {
    id: 'h_wolf_bounty', tier: 1, biome: ['wood', 'snow', 'moor'], unlessMark: 'boon_pack',
    title: 'Five Silver a Head',
    text: 'It is a hard winter, and the reeve of Lowfold pays five silver a wolf’s head. A boy drags a sack past you that squirms and whimpers: four grey cubs, their mother’s head already nailed over the reeve’s gate. "Give you the lot for ten," he says.',
    left: { label: 'Buy them and let them go', cost: 10, tile: 'forest', out: [
      { w: 3, text: 'You open the sack under the pines, and four grey shapes vanish into the snow. That night the whole wood howls, and it sounds, somehow, like a promise made to your house.', mark: 'boon_pack' },
      { w: 1, text: 'As the cubs vanish, an old dog-wolf steps out of the trees, drops a hare at your feet, and looks at you a long time. Your house has friends in the wood now.', mark: 'boon_pack', food: 2 },
    ], poor: { text: 'You haven’t ten silver. You snatch the sack and run for the trees, the boy howling for the reeve. The cubs go free. So, just, do you.', mark: 'boon_pack', hp: -1 } },
    right: { label: 'Help him carry them in', tile: 'village', out: [
      { w: 2, text: 'The reeve pays the boy twenty silver, the boy pays you five, and the reeve throws in the mother’s pelt, which makes a warm grey jerkin. You try not to look at his gate.', gold: 5, item: 'jerkin' },
      { w: 1, text: 'The boy pays you your five silver. That night the pack comes down out of the hills, and it knows your smell.', gold: 5, fight: { foe: 'wolf', name: 'the Grieving Pack', power: 4, dmg: 1,
        win: { text: 'You kill two before the rest melt back into the dark. You do not sleep again that night.' },
        lose: { text: 'They take your pack, and very nearly your throat, and go back into the hills howling.', food: -2 } } },
    ] },
  },
  {
    id: 'h_wolf_moot', tier: [2, 3], needsMark: 'boon_pack', w: 3, biome: ['wood', 'snow', 'moor', 'hills'],
    title: 'The Wolf-Moot',
    text: 'Grey shapes ring you in the snow, then sit, polite as a congregation. The wolves remember a kindness your house once did their cubs, and they want someone of your blood to judge between them and the shepherds of Fellside, who poisoned the Long Meadow.',
    left: { label: 'Judge for the wolves', tile: 'forest', out: [
      { w: 2, text: 'You rule that the Long Meadow is the wolves’ in winter and the shepherds’ in summer. The pack howls its thanks, and feeds you from its kill for three days.', food: 3 },
      { w: 1, text: 'You rule for the wolves, and the shepherds of Fellside run you out of the valley with stones. The wolves meet you over the hill with half a sheep.', hp: -1, food: 2 },
    ] },
    right: { label: 'Judge for the shepherds', tile: 'village', out: [
      { w: 2, text: 'You rule for the shepherds. The old grey wolf bows his head, and the pack goes over the hill without looking back. Fellside feasts you and sings. The wolves do not.', unmark: 'boon_pack', food: 3, gold: 10 },
      { w: 1, text: 'You rule for the shepherds. The pack takes it with a courtesy that shames you, and the old wolf leaves a tooth at your feet as he goes: a keepsake, and a goodbye.', unmark: 'boon_pack', relic: 'wolf_tooth' },
    ] },
  },

  /* ---------- the Dragon's Debt (boon_dragon) ---------- */
  {
    id: 'h_egg_in_the_hay', tier: [2, 3], biome: ['hills', 'waste', 'farm'], unlessMark: 'boon_dragon',
    title: 'The Egg in the Hay-Cart',
    text: 'A carter whips his lathered horse past you, and his load spills in the ditch: hay, and under the hay, an egg the size of a millstone, warm as a banked fire. Over the hills behind him something is roaring, and getting nearer. The carter does not stop.',
    left: { label: 'Carry it back to her', tile: 'lair', out: [
      { w: 2, text: 'You roll it up the scorched hill on a hurdle, the roaring overhead. She lands, looks, curls round her egg, then plucks a scale from her breast for you. "A life for a life. Your blood has one of mine."', mark: 'boon_dragon', relic: 'dragon_scale', hp: -1 },
      { w: 1, text: 'She finds you halfway up the hill, and does not wait to hear why you have her egg.', fight: { foe: 'dragon', name: 'the Roaring Mother', power: 10, dmg: 2,
        win: { text: 'You hold her off long enough to roll the egg into her claws. She stops, and looks, and goes very quiet. "A life," she says at last. "I owe your blood a life."', mark: 'boon_dragon' },
        lose: { text: 'She swats you into the ditch, gathers up her egg, and is gone over the hill before you can explain.', food: -1 } } },
    ] },
    right: { label: 'Sell it in the next town', tile: 'market', out: [
      { w: 2, text: 'A wizard’s steward pays a fortune for it without asking where it came from, and says nothing at all about the roaring.', gold: 30 },
      { w: 1, text: 'You sell it, and that night the roaring comes to town. Half the thatch in the market burns. You leave in a hurry, with a heavy purse and a singed back.', gold: 30, hp: -1 },
    ] },
  },
  {
    id: 'h_dragon_repays', tier: 3, needsMark: 'boon_dragon', w: 3, biome: ['hills', 'waste', 'snow'],
    title: 'A Life for a Life',
    text: 'A shadow as long as a church crosses the road, and a dragon lands before you in a gale of hot wind: the mother whose egg your house once carried home, bigger than any story told her. "I owe your blood a life," she rumbles. "I would sooner pay it now."',
    left: { label: 'Drink from her vein', tile: 'lair', out: [
      { w: 3, text: 'She opens a vein on her foreleg with one claw. The blood tastes of sunsets and iron, and after it your heart beats like a war-drum. The debt is paid. Your children will carry no scale.', trait: 'dragonblood', unmark: 'boon_dragon' },
      { w: 1, text: 'The blood burns going down, and burns, and burns. When you can stand, your heart is a war-drum and the dragon is a speck in the sky. The debt is paid.', trait: 'dragonblood', hp: -1, unmark: 'boon_dragon' },
    ] },
    right: { label: 'Let the debt stand', tile: 'mountain', out: [
      { w: 2, text: '"Humans," she sighs, in a gust of smoke. "Always later." She shakes herself like a wet dog, and loose coins rain from under her scales.', gold: 25 },
      { w: 1, text: 'She bows her great head. "Then I will watch your road." For three days a shadow keeps pace with you, and nothing on the road dares come near.', hp: 2, sight: 1 },
    ] },
  },

  /* ---------- the Full Granary (boon_granary) ---------- */
  {
    id: 'h_reeves_key', tier: 1, biome: ['farm'], unlessMark: 'boon_granary',
    title: 'The Reeve’s Key',
    text: 'Coldharbour is starving, and the lord’s granary is full to the rafters. The reeve keeps the only key on his belt, and he is hiring a guard for the door tonight: ten silver and a hot supper. Thin children watch you from every doorway.',
    left: { label: 'Open the granary to them', tile: 'mill', out: [
      { w: 2, text: 'At midnight you lift the key off the snoring reeve and swing the doors wide. By dawn every oven is lit, and the Greenhood know your name. "Your house will never go hungry," Coldharbour swears.', mark: 'boon_granary', food: 1, ally: 'rebels' },
      { w: 1, text: 'You swing the doors wide, and the reeve wakes and bellows. The village empties the granary round him while his sons beat you black and blue. It was worth it, Coldharbour swears.', mark: 'boon_granary', hp: -1 },
      { w: 1, text: 'The village is fed, and the lord’s steward is furious. He takes the price of the grain out of your purse, and Coldharbour, shamefaced, swears to repay your house in bread.', mark: 'boon_granary', gold: -10 },
    ] },
    right: { label: 'Guard the door for him', tile: 'mill', out: [
      { w: 2, text: 'A long cold night on the granary step. The reeve pays you in silver and hot pie, and Coldharbour’s eyes follow you all the way out of the village.', gold: 10, food: 2 },
      { w: 1, text: 'At midnight the village comes with sticks, and you find you cannot raise a hand to them. By dawn the granary is bare, the reeve docks your pay to nothing, and a child brings you a loaf.', food: 1 },
    ] },
  },
  {
    // Calling in the oath from a starving village can leave the Lean Years on your own fields.
    id: 'h_loaf_for_loaf', tier: [2, 3], needsMark: 'boon_granary', unlessMark: 'curse_lean', w: 2, biome: ['farm'],
    title: 'A Loaf for a Loaf',
    text: 'Coldharbour has fed {house} for years, loaf for loaf, as it swore when your blood opened the lord’s granary. Now its own rains have failed. The headman meets you at the boundary stone with his hat in his hands and nothing in his cart.',
    left: { label: 'Share what you carry', tile: 'village', out: [
      { w: 2, text: 'You empty your pack onto his cart. It is not much, but it is the right way round this time, and all Coldharbour comes out to see an heir of your house do it.', food: -3, renown: 2 },
      { w: 1, text: 'You empty your pack onto his cart. His wife gives you a satchel in return, an old one with a loaf in it that is somehow always there. "Loaf for loaf," she says.', food: -3, relic: 'satchel' },
    ] },
    right: { label: 'Hold them to their oath', tile: 'farm', out: [
      { w: 2, text: 'He fills your pack with the last of their bread without a word. "Paid, then," he says, and something passes out of the air between your house and theirs.', food: 3, unmark: 'boon_granary' },
      { w: 1, text: 'They have no bread left, so they pay you in seed-corn. You eat it, because you are hungry. The old women of Coldharbour watch you do it, and say what old women say.', food: 3, unmark: 'boon_granary', mark: 'curse_lean' },
    ] },
  },

  /* ====================== UNFINISHED BUSINESS ====================== */

  /* ---------- the Buried Hoard (quest_hoard) ---------- */
  // h_buried_hoard: this life buried it, so the robbers' grandchildren (years later) can't turn up in the same life.
  {
    id: 'h_too_heavy', tier: [1, 2], biome: ['hills', 'wood'], unlessMark: 'quest_hoard',
    title: 'More Than You Can Carry',
    text: 'Behind a waterfall, in a robbers’ cave, you find their strongbox: iron-bound, spilling gold, and far too heavy to lift. Voices echo up the gorge, coming back. There is time to fill your pockets and run, or to drag it out the back way and bury it.',
    left: { label: 'Fill your pockets', tile: 'cave', out: [
      { w: 2, text: 'You stuff your pockets, your boots and your hat, and run out through the waterfall jingling like a sleigh.', gold: 15 },
      { w: 1, text: 'You fill your pockets. The robbers fill the cave mouth, and you leave the only other way: down the waterfall, which keeps half your gold and all of your bread.', gold: 8, food: -2 },
    ] },
    right: { label: 'Bury it and draw a map', tile: 'forest', out: [
      { w: 3, text: 'You bury it under a lightning-split ash and scratch a map inside your belt. Too much gold for one life. Perhaps not for your children, or theirs.', gold: 4, mark: 'quest_hoard', flag: 'h_buried_hoard' },
      { w: 1, text: 'You bury the box, map it on your belt, and keep one fat handful back for the road. The robbers never do find out who took it.', gold: 10, mark: 'quest_hoard', flag: 'h_buried_hoard' },
    ] },
  },
  {
    id: 'h_digging_brothers', tier: [1, 2], needsMark: 'quest_hoard', unless: 'h_buried_hoard', w: 3,
    title: 'The Digging Brothers',
    text: 'The map scratched in an old belt of {house} leads you to a lightning-split ash. The ground round it is pocked with years of holes, and three gap-toothed brothers are digging a fresh one. "Grandad’s gold," says the eldest. "A thief buried it. Who are you?"',
    left: { label: 'Offer to share', tile: 'forest', out: [
      { w: 2, text: 'You show them where to dig. The box comes up, and they split it fair, which surprises everyone, them most of all. Your house’s long wait is over.', gold: 20, unmark: 'quest_hoard' },
      { w: 1, text: 'They split it fair, then argue about what fair means until the sheriff’s men come to see what the shouting is. You leave with a third of what you should have had.', gold: 12, unmark: 'quest_hoard' },
    ] },
    right: { label: 'Run them off', tile: 'forest', fight: { foe: 'bandit', name: 'the Digging Brothers', power: 6, dmg: 1,
      win: { text: 'You chase them off with their own shovels and dig where the map says. Iron. Gold. More than enough. The thief, it seems, was one of yours.', gold: 35, unmark: 'quest_hoard' },
      lose: { text: 'They bury you to the neck and dig round you all night, and find nothing. At dawn they let you go. You still have the map.', food: -2 } } },
  },
  {
    id: 'h_lords_share', tier: 3, needsMark: 'quest_hoard', w: 2, biome: ['farm', 'wood'],
    title: 'The Lord’s Share',
    text: 'The lightning-split ash on your house’s map now shades Lord Harrowby’s deer park, and word of the gold under it has reached him. "Treasure found on my land is mine," he says pleasantly, "unless you can prove otherwise. We can go to law. Or to the lists."',
    left: { label: 'Go to law', cost: 20, tile: 'manor', out: [
      { w: 2, text: 'A week of clerks and a great deal of parchment. The judge rules for {house}, and the lord digs up the box himself, to save face. It is very heavy. Your house has waited long enough.', gold: 50, unmark: 'quest_hoard' },
      { w: 1, text: 'The judge turns out to be the lord’s cousin. He rules the gold the lord’s and the costs yours, payable today. An appeal, the clerk says kindly, takes a generation or two.', pay: 12 },
    ], poor: { text: 'You can’t pay a lawyer, so you plead your own case. The judge laughs so hard he has to be carried out. An appeal, the clerk says, takes a generation or two.', food: -1 } },
    right: { label: 'Demand trial by combat', tile: 'tourney', fight: { foe: 'champion', name: 'Lord Harrowby’s Champion', power: 12, dmg: 2, elite: true,
      win: { text: 'The lord’s champion lies flat on the lord’s own lawn. The lord digs up the box himself, to save face, and your ancestor’s gold spills out warm in the sun.', gold: 50, unmark: 'quest_hoard' },
      lose: { text: 'His champion knocks you flat in front of half the county. The gold stays in the ground. The map, the lord says kindly, you may keep.', food: -1 } } },
  },

  /* ---------- the Broken Blade (quest_blade) ---------- */
  {
    id: 'h_tinkers_box', tier: [1, 2], unlessMark: 'quest_blade',
    title: 'The Tinker’s Box of Old Iron',
    text: 'A tinker’s cart has lost a wheel in the ditch, and he will sell anything to pay for the mending, even the box of old iron he swears was a hero’s sword. The shards are black with age, but where your thumb touches them, they hum.',
    left: { label: 'Buy the box of shards', cost: 8, tile: 'road', out: [
      { w: 3, text: 'On your knee the shards fit together: a runed blade broken in five places, humming like a hive. No village smith could mend it. You wrap it in your cloak, to keep for one who can.', mark: 'quest_blade' },
      { w: 1, text: 'Under the shards lies a rabbit’s foot as old as the blade. Whoever broke the sword was not carrying it that day.', mark: 'quest_blade', relic: 'rabbit_foot' },
    ], poor: { text: 'You haven’t the coin, so you mend his wheel instead. He pays you with the box, grumbling that it was only junk anyway.', mark: 'quest_blade', food: -1 } },
    right: { label: 'Rummage through his cart', tile: 'road', shop: 'fence', out: [
      { text: 'Pots, pans, a saint’s finger, three left boots, and a very good sword with somebody else’s name on it. "All honest," says the tinker. "Mostly."' },
    ] },
  },
  {
    id: 'h_barrow_smith', tier: [2, 3], needsMark: 'quest_blade', w: 2, biome: ['moor', 'hills', 'farm'],
    title: 'The Smith Under the Barrow',
    text: 'Leave a broken blade and a silver penny on the capstone of Anvil Barrow at dusk, the saying goes, and it will be mended by dawn. The saying also goes: don’t watch. You have a silver penny, and the shards {house} has kept in a box for far too long.',
    left: { label: 'Leave the shards and go', tile: 'stones', out: [
      { w: 2, text: 'At dawn the penny is gone, and on the capstone lies a sword. Not the old blade: something new made out of it, light as a reed and sharp as frost.', item: 'elvenblade', unmark: 'quest_blade' },
      { w: 1, text: 'At dawn the shards are gone, and the penny has become a heap of silver. The smith under the hill keeps what he likes, and pays for it.', gold: 25, unmark: 'quest_blade' },
      { w: 1, text: 'At dawn the shards lie as you left them, beside a note in no alphabet you know. Somehow you can read it: NOT MINE TO MEND.', sight: 1 },
    ] },
    right: { label: 'Stay and watch', tile: 'crypt', fight: { foe: 'fey_knight', name: 'the Smith Under the Barrow', power: 8, dmg: 2,
      win: { text: 'He is small and furious and hits like a hammer, which he is holding. He yields at last, and mends it out of spite: a new blade, light as a reed and sharp as frost.', item: 'elvenblade', unmark: 'quest_blade' },
      lose: { text: 'You wake on the barrow at noon with the shards scattered in the heather, a ringing in your ears, and no penny.', food: -1 } } },
  },
  {
    id: 'h_rune_smith', tier: 3, needsMark: 'quest_blade', w: 3, biome: ['hills', 'snow'],
    title: 'The Last of the Rune-Smiths',
    text: 'At the mountain’s root works Hild Emberhand of the Deep Kin, last of the rune-smiths, blind from a hundred years of sparks. She runs a thumb down the shards {house} has carried so long, and goes very still. "The Kingsblade. I can mend it. It will cost you dear."',
    left: { label: 'Pay her price', cost: 30, tile: 'smithy', out: [
      { w: 1, text: 'Three days and nights of fire and song. On the fourth morning she lays it in your hands, whole, and it knows your name. It is the Kingsblade, and you are holding it.', relic: 'kingsblade', unmark: 'quest_blade' },
      { w: 3, text: 'The blade comes out of the fire whole, but quiet, as if it has forgotten what it was. It is still the finest sword you have ever held.', item: 'runeblade', unmark: 'quest_blade' },
      { w: 1, text: 'On the third night the blade screams in the quench and flies apart. Hild weeps from her blind eyes. There is nothing left to mend.', unmark: 'quest_blade' },
    ], poor: { text: 'You haven’t her price. She lets you work her bellows for a week to see the shards in the fire, and for a moment you see them as they were, and what they want.', food: -2, sight: 2 } },
    right: { label: 'Sell her the shards', tile: 'smithy', out: [
      { w: 2, text: '"A pity," she says, and pays in dwarf-gold, and throws in a mail shirt she forged in her youth. "Someone will wield the blade. I hope they deserve it." The box your house carried is very light.', gold: 25, item: 'scale', unmark: 'quest_blade' },
      { w: 1, text: 'She pays, and sends word down the mountain that the Kingsblade has come home, and who brought it. The Deep Kin do not forget a thing like that.', gold: 20, ally: 'dwarves', unmark: 'quest_blade' },
    ] },
  },

  /* ---------- the Unquiet Tomb (quest_tomb) ---------- */
  {
    id: 'h_crossroads_bones', tier: 1, unlessMark: 'quest_tomb',
    title: 'The Bones at Hangman’s Cross',
    text: 'Road-menders widening the crossroads have dug up a skeleton buried face-down, the way outlaws were buried in the old days. On one finger bone is a signet ring with the arms of {house}. Nobody in your family ever mentioned this one.',
    left: { label: 'Take the ring', tile: 'road', out: [
      { w: 3, text: 'The ring comes off easily. That night, and every night after, something grey stands at the edge of your firelight, waiting to be buried properly. Until it is, it will walk with your house.', gold: 12, mark: 'quest_tomb' },
      { w: 1, text: 'The road-menders swear the skull turned to watch you go. A goldsmith pays well for the ring. The ghost costs extra, and your house will be paying for years.', gold: 15, mark: 'quest_tomb' },
    ] },
    right: { label: 'Give the bones a grave', tile: 'graveyard', out: [
      { w: 2, text: 'The priest won’t bury an outlaw in hallowed ground, so you dig a nameless grave outside the churchyard wall. It isn’t enough. You can feel it isn’t. Something of your blood will walk until it is.', food: -1, mark: 'quest_tomb' },
      { w: 1, text: 'The priest peers at the ring, then at you, and relents. The bell tolls once, and something at the edge of hearing sighs. The road-menders stand you a drink.', food: 1, renown: 1 },
    ] },
  },
  {
    id: 'h_grey_walker', tier: [1, 2], needsMark: 'quest_tomb', w: 3,
    title: 'The Walker Ahead',
    text: 'All day a grey figure walks the road ahead of you, never nearer, never further, in a cloak of a cut your house wore three lifetimes ago. At dusk it stops at a churchyard gate, turns a face you almost know, and points inside.',
    left: { label: 'Follow it in', tile: 'graveyard', out: [
      { w: 2, text: 'Behind the chapel, ghouls are digging at a nameless grave.', fight: { foe: 'ghoul', name: 'the Churchyard Ghouls', power: 5, dmg: 1,
        win: { text: 'You drive them off with a shovel and fill in the grave. The ghost bows, and fades, and in the turned earth lies a charm it was buried with: its thanks, or its last will.', relic: 'random', unmark: 'quest_tomb' },
        lose: { text: 'The ghouls drag you down among the bones, and the ghost pulls you out by the collar, which is somehow worse. It will walk again.', food: -1 } } },
      { w: 1, text: 'It stops at a nameless grave by the wall. You carve a name on a stone, the one you think it would want, and it nods, and is gone like breath off a window.', unmark: 'quest_tomb', sight: 2 },
    ] },
    right: { label: 'Pay the priest to pray', cost: 10, tile: 'chapel', out: [
      { w: 2, text: 'The priest sprinkles, the sexton digs, and the bell tolls once. The grey figure bows to you, and fades, and the road behind you goes quiet at last.', unmark: 'quest_tomb', renown: 1, hp: 1 },
      { w: 1, text: 'The priest pockets your silver and gabbles the words. The ghost watches from the lychgate with great patience, waiting for a better heir.' },
    ], poor: { text: 'No coin for a priest. You say the words yourself, badly, in the dark. The ghost listens politely, then walks on ahead of you, as before.', food: -1 } },
  },
  {
    id: 'h_family_face', tier: [2, 3], needsMark: 'quest_tomb', w: 2, biome: ['fen', 'moor'],
    title: 'The Family Face',
    text: 'A ghost sits on the milestone in clothes three lifetimes out of fashion, and it has your face, or near enough: the same chin, the same frown, only greyer and a good deal deader. "I am your kin, from the nameless grave, and I am tired of walking. Come."',
    left: { label: 'Go with it', tile: 'graveyard', out: [
      { w: 2, text: 'You dig its bones out of the nameless grave with your bare hands and carry them to hallowed ground. It kisses your brow, and tells you three true things about the road, and where it hid its purse.', hp: -1, sight: 2, gold: 10, unmark: 'quest_tomb' },
      { w: 1, text: 'The grave has sunk into a bog that does not want to give it up. It costs you your boots, your bread and most of a night, but you carry the bones to hallowed ground at last.', food: -2, renown: 1, unmark: 'quest_tomb' },
    ] },
    right: { label: 'Ask it to walk with you', tile: 'road', out: [
      { w: 2, text: 'It walks at the edge of your eye and whispers of every danger before you reach it. It will lie down when someone of your blood lays it down, and not before.', trait: 'second_sight' },
      { w: 1, text: '"Walk? I have walked for a hundred years!" Your own face, dead, comes at you howling.', fight: { foe: 'ghost', name: 'the Family Ghost', power: 7, dmg: 2,
        win: { text: 'It breaks like mist on the wind, sobbing. It will be back, for you or your children, until someone lays it down. Where it sat lies a trinket from its grave.', relic: 'random' },
        lose: { text: 'Its howl goes through you like winter. You wake in the ditch with white in your hair and no strength in your legs.', food: -1 } } },
    ] },
  },
];
