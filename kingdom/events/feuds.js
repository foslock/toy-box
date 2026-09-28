// Kingdom: feuds and oaths, the marks one life leaves on a whole house. House Varrow's blood-feud, the grudge of the wyrm
// of Carrow Fell, the Hawthorn Prince and his Hunt, the Grey Brothers' contract, the oath to the Knights of the Rose and
// the Hollow Pact with the things under the hill. For each: the choices that make it, the heirs who meet it after, and
// the ways it can end. Events for the journey (see rules.js forevery id).
export default [
  // ---------- the Varrow Feud: House Varrow swore blood for blood ----------
  {
    id: 'v_varrow_hound', tier: 1, biome: ['farm', 'moor'], unlessMark: 'feud_varrow',
    title: 'The Varrow Greyhound',
    text: 'A greyhound in a silver collar has a goose-girl pinned against a wall, and her geese are feathers on the wind. A huntsman in Varrow black sits his horse and laughs. "Lord Varrow’s favourite. Lay a hand on her and see what it costs."',
    left: { label: 'Kill the greyhound', tile: 'farm', fight: { foe: 'wolf', name: 'the Varrow Greyhound', power: 3, dmg: 1,
      win: { text: 'The hound dies in the mud. You take its silver collar, and the goose-girl’s mother feeds you. The huntsman stares. "Blood for blood. Varrow will have it from your children, if not from you."', gold: 8, food: 2, mark: 'feud_varrow' },
      lose: { text: 'The greyhound opens your calf and trots back to its master, who tosses the goose-girl a penny for her geese and you nothing at all.' } } },
    right: { label: 'Pull the girl clear', tile: 'village', out: [
      { w: 2, text: 'You haul her over the wall and take the bite meant for her. Her family has little, but they share it: black bread, goose fat and a great deal of weeping.', hp: -1, food: 2, renown: 1 },
      { w: 1, text: 'You get her over the wall, and the huntsman whistles the hound off, bored. Her grandmother reads your palm by way of thanks: a long road, she says, with teeth in it.', sight: 1 },
      { w: 1, text: 'You get her clear. The huntsman flicks you a silver penny. "For knowing your place," he says. The goose-girl will not look at you.', gold: 5 },
    ] },
  },
  {
    id: 'v_varrow_mill', tier: [2, 3], biome: ['farm'], unlessMark: 'feud_varrow',
    title: 'A Torch for the Varrow Mill',
    text: 'Baron Tellmarch’s men are drinking hard on the near bank of the Mardle. On the far bank, dark and quiet, turns the mill of House Varrow. "Twenty-five gold and my friendship," says the baron, holding out a torch, "to whoever sets it burning."',
    left: { label: 'Take the baron’s torch', tile: 'mill', out: [
      { w: 3, text: 'The mill goes up like a haystack, and Tellmarch pays with a purse and a bear-hug. But a Varrow miller saw your face in the firelight, and Varrow will hunt your blood for it down all the years.', gold: 25, ally: 'lords', mark: 'feud_varrow' },
      { w: 1, text: 'The torch gutters in the drizzle, the mill only smokes, and Tellmarch pays you half, for the smoke. Nobody on the far bank saw a thing. This time.', gold: 12 },
    ] },
    right: { label: 'Warn the Varrow miller', tile: 'mill', out: [
      { w: 2, text: 'You wade across and hammer on the mill door. The miller, a Varrow cousin with flour in his beard, gives you a loaf and an old flour-sack that never seems to empty.', food: 1, relic: 'satchel' },
      { w: 1, text: 'Varrow crossbows greet Tellmarch’s torches, and nothing burns. But the baron’s men catch you wading back, and teach you whose side you were meant to be on.', hp: -1, food: 1 },
    ] },
  },
  {
    id: 'v_varrow_ferry', tier: [1, 2], biome: ['fen', 'lake'], needsMark: 'feud_varrow', w: 3,
    title: 'The Ferryman’s Wrist',
    text: 'Halfway across the black river, the ferryman ships his pole and pushes up his sleeve. Burned into his wrist is the rook of House Varrow. "Nothing personal, {sir}," he says, drawing a knife. "Varrow pays well for {house}, is all."',
    left: { label: 'Wrestle him for the knife', tile: 'ferry', fight: { foe: 'assassin', name: 'the Varrow Ferryman', power: 5, dmg: 1,
      win: { text: 'He goes into the river with his knife and does not come up. In his coat you find Varrow silver, paid in advance, and a list of houses. Yours is underlined twice.', gold: 12 },
      lose: { text: 'He cuts you before you can tip the raft. You wash up on a mudbank a mile downstream, bleeding, and the river keeps your pack.', food: -2 } } },
    right: { label: 'Go over the side', tile: 'lake', out: [
      { w: 2, text: 'The river is cold enough to stop a heart, but not yours. You wash up by an eel-trap, and the eel-wife who owns it dries you by her fire and feeds you eel pie.', food: 2 },
      { w: 1, text: 'You swim for it, and the current takes your pack. Behind you, the ferryman calls a cheerful promise to see your children across one day.', food: -2 },
      { w: 1, text: 'You go over, and so does he, and it turns out he can’t swim. You drag him ashore by the collar. "I’ll tell them I missed," he gasps, and gives you his fare-box.', gold: 8, renown: 1 },
    ] },
  },
  {
    id: 'v_varrow_weregild', tier: 2, biome: ['moor', 'hills'], needsMark: 'feud_varrow', w: 3,
    title: 'The Weregild Stone',
    text: 'At the Weregild Stone, where the old law ends feuds, a Varrow herald waits under a white flag. "Blood or silver, {house}," he says. "Pay the weregild and it is done." Behind him three Varrow knights sit their horses, hoping you choose blood.',
    left: { label: 'Pay the weregild', cost: 25, tile: 'stones', out: [
      { text: 'The herald counts it out on the Stone, coin by coin, then snaps a Varrow arrow across his knee. It is over, by the old law. Your children will never know how close it came.', unmark: 'feud_varrow' },
    ], poor: { text: 'You turn out your purse. It isn’t enough. "Then it’s blood," says the herald, not unkindly, and the knights come down the hill.', fight: { foe: 'knight', name: 'the Varrow Knights', power: 8, dmg: 2,
      win: { text: 'You unhorse the first, and the other two carry him home across his saddle. The feud stands, but Varrow has learned something about your blood.', food: 2 },
      lose: { text: 'They leave you on the Weregild Stone, beaten, as a message to your kin.', food: -1 } } } },
    right: { label: 'Spit on the Stone', tile: 'battlefield', fight: { foe: 'knight', name: 'the Varrow Knights', power: 8, dmg: 2,
      win: { text: 'You unhorse the first and the other two think better of it. Their saddlebags feed you for days, and one of them was wearing a very good mail shirt.', food: 2, item: 'chain' },
      lose: { text: 'They beat you bloody on the Weregild Stone and leave you there as a message to {house}. The herald takes your purse for his trouble.', gold: -10 } } },
  },
  {
    id: 'v_varrow_rook_hall', tier: 3, needsMark: 'feud_varrow', w: 3,
    title: 'The Black Rook’s Hall',
    text: 'The head of House Varrow has sent for someone of your blood: a white-haired woman in a chair too big for her, under the banner of the black rook. "I am too old to go on hating," she says. "We end it today, one way or the other."',
    left: { label: 'Offer a marriage', tile: 'manor', out: [
      { w: 3, text: 'She laughs until she coughs, then agrees. Her youngest grandchild is plain, kind and terrified of you. The banns are read at dawn, and at the feast Varrow and {house} drink from one cup.', ally: 'lords', unmark: 'feud_varrow' },
      { w: 1, text: 'The betrothal wine tastes of bitter almonds. Not every Varrow wanted peace. You live, just, and so does the feud.', hp: -2 },
    ] },
    right: { label: 'Demand trial by combat', tile: 'castle', fight: { foe: 'knight', name: 'the Varrow Champion', power: 10, dmg: 2,
      win: { text: 'Your blade finds the gap in his harness. The old lady watches him fall, then has the black rook taken down from her wall. "Blood for blood. It is paid." His plate is yours by right.', item: 'plate', unmark: 'feud_varrow' },
      lose: { text: 'He beats you to your knees before the whole hall. "Not today, then," she says, and has you thrown out with your dignity in a sack.', food: -1 } } },
  },

  // ---------- the Wyrm's Grudge: the wyrm of Carrow Fell hunts your blood by its smell ----------
  {
    id: 'v_wyrmling_well', tier: 1, biome: ['hills', 'moor'], unlessMark: 'feud_wyrm',
    title: 'The Wyrmling in the Well',
    text: 'Carrowdale has something trapped down its dry well: a wyrmling no bigger than a goat, all elbows and smoke, hissing at the stones. "Its mother’s the wyrm on Carrow Fell," says the reeve. "Kill it while it’s small. There’s silver in it."',
    left: { label: 'Kill the wyrmling', tile: 'well', fight: { foe: 'wyvern', name: 'the Wyrmling', power: 4, dmg: 1,
      win: { text: 'It dies spitting sparks, and Carrowdale pays in silver and sausages. Then, far up on Carrow Fell, something vast screams. "She’ll know your blood by the smell now," says the reeve. "And your children’s."', gold: 10, food: 3, mark: 'feud_wyrm' },
      lose: { text: 'It comes up the well like a cat up a curtain, singes off your eyebrows, and flaps away toward the Fell. The reeve blames you for his thatch.' } } },
    right: { label: 'Free it by night', tile: 'village', out: [
      { w: 2, text: 'At midnight you lower a ladder. The wyrmling climbs out, sniffs your hand, and is gone toward the Fell. At dawn three old gold coins lie on the well’s lip, still warm.', gold: 10 },
      { w: 1, text: 'The reeve catches you at it and puts you in the stocks till noon. The children pelt you with turnips, which at least makes lunch.', food: 2, renown: -1 },
      { w: 1, text: 'It climbs out, bites your thumb for your trouble, and is gone.', hp: -1 },
    ] },
  },
  {
    id: 'v_wyrm_ballista', tier: [2, 3], biome: ['hills', 'moor', 'waste'], unlessMark: 'feud_wyrm',
    title: 'The Ballista in the Hay-Wain',
    text: 'The Marcher barons mean to kill the wyrm of Carrow Fell with a ballista hidden under a hay-wain. They need bait: someone to run across the open fell, smeared in sheep’s blood. "Thirty gold," says the fattest baron, "if you live."',
    left: { label: 'Be the bait', tile: 'mountain', out: [
      { w: 3, text: 'You run like never before. The bolt takes the wyrm through the wing, and she flaps off lopsided, screaming. The barons pay up. She has your smell by heart now, and wyrms live a very long time.', gold: 30, renown: 2, mark: 'feud_wyrm' },
      { w: 1, text: 'The wyrm is faster than the barons’ aim. Her breath takes the heather, the hay-wain and your eyebrows, and the barons pay you half, for effort.', gold: 15, hp: -2 },
    ] },
    right: { label: 'Crank the windlass', tile: 'war_camp', out: [
      { w: 2, text: 'The bolt flies wide. The wyrm burns the wain, the pavilions and one baron’s moustache, and never once looks your way. You help yourself to their abandoned supper.', food: 2 },
      { w: 1, text: 'The windlass slips and takes the skin off your knuckles. The barons pay you a day’s wage and a lecture on carpentry.', gold: 10, hp: -1 },
    ] },
  },
  {
    id: 'v_wyrm_drakes', tier: 1, biome: ['hills', 'moor', 'waste'], needsMark: 'feud_wyrm', w: 3,
    title: 'The Drakes Come Sniffing',
    text: 'Two lean grey drakes circle low over the road, necks stretched, tasting the air. The wyrm of Carrow Fell has sent her brood to find the blood of {house}, and they have found it. A farmer’s midden steams in the ditch beside you.',
    left: { label: 'Stand and fight', tile: 'road', fight: { foe: 'wyvern', name: 'the Wyrm’s Drakes', power: 5, dmg: 1,
      win: { text: 'You bring one down with a lucky swing, and the other flees crying for the Fell. Drake is stringy eating, but there is a great deal of it.', food: 3 },
      lose: { text: 'They knock you flat and fly home with your scent, your hat and most of your supper.', food: -2 } } },
    right: { label: 'Roll in the midden', tile: 'farm', out: [
      { w: 3, text: 'You roll in the farmer’s midden until you smell like one. The drakes circle, sneeze, and give up. No inn will have you for three days, but you are alive.', food: -1 },
      { w: 1, text: 'The drakes are not fooled. They pluck you out of the dung like a worm from a lawn, and drop you in a pond.', hp: -1 },
      { w: 1, text: 'Deep in the midden your hand closes on a purse that somebody buried in a hurry and never came back for.', gold: 12 },
    ] },
  },
  {
    id: 'v_wyrm_dunmallow', tier: 2, biome: ['hills', 'farm'], needsMark: 'feud_wyrm', w: 3,
    title: 'The Wyrm Comes to Dunmallow',
    text: 'The wyrm of Carrow Fell lands on the hill above Dunmallow, and her voice rolls down like a rockslide. "One of you smells of {house}. Send them up, or I burn it all." Every face in Dunmallow turns toward you.',
    left: { label: 'Walk up the hill', tile: 'mountain', out: [
      { w: 3, text: 'She lowers a head the size of a cart and sniffs you all over. "Blood for blood," she says, pricks your arm with one claw, and drinks. "Enough. It is paid." She is gone before you stop shaking.', maxhp: -1, unmark: 'feud_wyrm' },
      { w: 1, text: 'She sniffs you, laughs smoke, and breathes. You live, somehow, and Dunmallow is spared and will sing your name forever. But the grudge is not paid, only put off.', hp: -2, trait: 'beloved' },
    ] },
    right: { label: 'Slip away in the dark', tile: 'road', out: [
      { w: 2, text: 'You slip out through the orchards while they argue, filling your pockets with windfalls. Behind you, fire comes down on Dunmallow. The wyrm still hunts you, and now so does Dunmallow.', food: 2, renown: -2 },
      { w: 1, text: 'The villagers are quicker. They tie you to the stone on the hilltop and run. You work loose by moonlight, while the wyrm is busy with their barns.', hp: -1, food: -1 },
    ] },
  },
  {
    id: 'v_carrow_fell', tier: 3, biome: ['hills', 'snow', 'waste'], needsMark: 'feud_wyrm', w: 3,
    title: 'The Top of Carrow Fell',
    text: 'You climb Carrow Fell at last, through old bones and melted armour, to the wyrm’s own door. She is awake, coiled on her hoard, and her eyes open like furnace doors. "{house}," she says. "Come to die, or come to pay?"',
    left: { label: 'Fight her on her hoard', tile: 'lair', fight: { foe: 'dragon', name: 'the Wyrm of Carrow Fell', power: 12, dmg: 2, elite: true,
      win: { text: 'It takes all day. At dusk she lies still across her hoard, and the grudge goes out of the world with her last smoke. Carrowdale will ring its bells for a week, and you can buy them the bells.', gold: 40, unmark: 'feud_wyrm' },
      lose: { text: 'You run down Carrow Fell on fire, and she lets you go. "Come again," she calls after you. "Bring your children."', gold: -10 } } },
    right: { label: 'Pay her a hoard-price', cost: 35, tile: 'lair', out: [
      { w: 3, text: 'You pour your gold onto her hoard. She noses through it, sniffs every coin, and sighs a little smoke. "A fair price for a grudge. Go, {house}, and do not come back."', unmark: 'feud_wyrm' },
      { w: 1, text: 'She counts your gold twice. "A fair price." As you go, a loose scale slides off her flank and clatters at your feet. Wyrms, it seems, tip.', unmark: 'feud_wyrm', relic: 'dragon_scale' },
    ], poor: { text: 'You haven’t enough. She laughs, and the laugh is mostly fire. You leave Carrow Fell smoking, and the grudge is exactly where it was.', hp: -2 } },
  },

  // ---------- the Slighted Prince: the Hawthorn Prince of the Hidden Folk, and his Hunt ----------
  {
    id: 'v_swan_cloak', tier: 1, biome: ['lake', 'fen'], unlessMark: 'feud_fey',
    title: 'The Swan-Feather Cloak',
    text: 'By a reedy mere at dawn, a cloak of white swan feathers lies folded on a rock. Out in the water a pale young man with hawthorn in his hair is bathing and singing. Without his cloak, the old tales say, one of the Hidden Folk cannot fly home.',
    left: { label: 'Hold the cloak to ransom', tile: 'lake', out: [
      { w: 3, text: 'He begs, and hates himself for it, and pays in fey gold and a lucky shoe. Then he is a swan. "You shamed a prince," he calls down. "My Hunt will ride for your children’s children."', gold: 15, relic: 'horseshoe', mark: 'feud_fey' },
      { w: 1, text: 'He pays in fey gold and flies off a swan, cursing your blood to the ninth generation. By noon the gold is beech leaves. The curse is not.', mark: 'feud_fey' },
    ] },
    right: { label: 'Turn your back politely', tile: 'road', out: [
      { w: 2, text: 'You study the clouds until the splashing stops. When you turn, the cloak is gone, and on the rock lies a loaf of honey-bread, still warm, wrapped in a dock leaf.', food: 2 },
      { w: 1, text: 'He comes ashore wrapped in feathers and looks at you a long moment. "Manners," he says, surprised. "I shall tell the Court." Then he is a swan, and gone.', ally: 'fey' },
      { w: 1, text: 'While your back is turned, a magpie makes off with your supper, and the prince laughs at you all the way across the mere.', food: -1 },
    ] },
  },
  {
    id: 'v_midsummer_race', tier: 3, biome: ['moor', 'hills'], unlessMark: 'feud_fey',
    title: 'The Midsummer Race',
    text: 'Each Midsummer Eve the Hawthorn Prince races any mortal across the moor for a crown of gold. No mortal has ever won. A horse-coper presses a cold iron nail into your palm. "Fey horses shy from iron," he whispers. "Put it in your boot."',
    left: { label: 'Race with iron in your boot', tile: 'fairy_ring', out: [
      { w: 3, text: 'At the last stone his horse smells iron, shies, and throws the prince into a gorse bush before his whole Court. The crown is yours. So is his hatred, for you and all your blood, forever.', gold: 40, renown: 3, mark: 'feud_fey' },
      { w: 1, text: 'The Court smells the iron on you before the start. They chase you off the moor with hawthorn switches, laughing, and keep your supper for their trouble.', food: -2 },
    ] },
    right: { label: 'Race him fairly', tile: 'road', out: [
      { w: 1, text: 'Neck and neck all the way, and you win by a nose. The prince laughs like a boy and crowns you himself. "Fairly won! The Court will remember your name kindly."', gold: 30, ally: 'fey' },
      { w: 2, text: 'You lose by a furlong, as everyone does. The forfeit is all the food in your pack, and a lock of your hair to plait into the prince’s bridle.', food: -2 },
      { w: 1, text: 'You lose, but so gallantly that the Court applauds, and the prince tosses you a ring from his own finger.', relic: 'fox_ring' },
    ] },
  },
  {
    id: 'v_elf_shot', tier: 1, biome: ['wood', 'moor'], needsMark: 'feud_fey', w: 3,
    title: 'Elf-Shot',
    text: 'A flint arrowhead no bigger than a fingernail thuds into the milestone beside your ear. On the ridge, a rider in leaf and silver lowers a tiny bow. "The Hawthorn Prince remembers {house}," she calls, and nocks another. "Run, if you like."',
    left: { label: 'Turn your coat inside out', tile: 'forest', out: [
      { w: 2, text: 'An old charm, and a true one. The rider looks straight through you, puzzled, and rides off grumbling. In your turned coat you find a pocket you never had, with fey bread in it.', food: 2 },
      { w: 1, text: 'She laughs so hard at your coat that she falls off her horse, and rides away still hiccuping. By nightfall the whole Court has heard about your coat.', renown: -1 },
      { w: 1, text: 'The charm half works. Her next arrow takes you in the eye. It doesn’t blind it; it only leaves a shadow over half the world.', trait: 'veil' },
    ] },
    right: { label: 'Charge the ridge', tile: 'forest', fight: { foe: 'fey_knight', name: 'the Prince’s Huntress', power: 5, dmg: 1,
      win: { text: 'She is quick, but you are angry. You drag her from the saddle and she comes apart in a flurry of leaves, leaving a coil of silver snare-wire in the bracken.', relic: 'snare' },
      lose: { text: 'Elf-shot in the shoulder. It doesn’t bleed; it aches like midwinter. She rides off whistling. The ache will go. The Hunt won’t.', food: -1 } } },
  },
  {
    id: 'v_prince_silence', tier: [2, 3], biome: ['wood', 'moor', 'hills'], needsMark: 'feud_fey', w: 3,
    title: 'Not a Word Till Dawn',
    text: 'A herald of the Hidden Folk bows, his sleeves all moth-wing. "The Hawthorn Prince offers {house} a trial. Sit one night in his hall and speak not one word, whatever you see, and the slight is forgiven. Speak, and it is doubled."',
    left: { label: 'Sit silent in his hall', tile: 'fairy_ring', out: [
      { w: 3, text: 'They show you wonders, then horrors, then a very long joke about a goose. You say nothing. At dawn the prince bows, stiffly. "Forgiven," he says, "and forgotten, which is harder."', food: -1, unmark: 'feud_fey' },
      { w: 2, text: 'They show you your own face, old and dying, and you cry out before you can stop. The hall roars. As a forfeit the prince bids you dance, and your feet have not quite stopped since.', trait: 'twin_step' },
    ] },
    right: { label: 'Send the herald packing', tile: 'road', out: [
      { w: 2, text: 'You send him off with a flea in his ear. That night the Hunt rides over your camp and tramples your supper into the mud, laughing all the way.', food: -2 },
      { w: 1, text: 'You refuse. The herald bows, and before he goes he tells you three true things about the road ahead, out of pure spite. All three are unwelcome.', sight: 2 },
    ] },
  },
  {
    id: 'v_hawthorn_prince', tier: 3, biome: ['moor', 'hills'], needsMark: 'feud_fey', w: 3,
    title: 'Under the Lone Hawthorn',
    text: 'At the lone hawthorn on the hilltop the Hunt is waiting, silent for once: riders in leaf and silver, and at their head the Hawthorn Prince, crowned in thorns. "{house}," he says, as if the word tasted of iron. "It is time we ended this."',
    left: { label: 'Cross swords with him', tile: 'stones', fight: { foe: 'fey_knight', name: 'the Hawthorn Prince', power: 12, dmg: 2, elite: true,
      win: { text: 'Your blade cuts his thorn crown in two. He looks at the halves for a long time. "Honour is served," he says, and the Hunt turns away from {house} forever.', gold: 25, unmark: 'feud_fey' },
      lose: { text: 'He fights like moonlight on water, everywhere at once. He leaves you in the heather with a thorn in your heart that aches whenever a horn blows.', food: -1 } } },
    right: { label: 'Kneel and ask pardon', tile: 'fairy_ring', out: [
      { w: 2, text: 'You kneel in the wet heather and ask pardon for your blood. He considers you, then takes his price: a year of your life, sipped from a thorn-prick. "Forgiven."', maxhp: -1, unmark: 'feud_fey' },
      { w: 1, text: 'You kneel. He laughs. "A pretty apology. Mine is prettier." The Hunt rides over you, and on, and the feud rides with it.', hp: -2 },
      { w: 1, text: 'You kneel, and he is quiet a long while. Then he lifts you up and kisses your brow, cold as frost. "Enough. Your children may hear horns without fear."', trait: 'second_sight', unmark: 'feud_fey' },
    ] },
  },

  // ---------- the Grey Contract: the Grey Brothers always collect ----------
  {
    id: 'v_wrong_face', tier: 1, unlessMark: 'feud_brothers',
    title: 'The Wrong Face',
    text: 'A friar in grey falls into step beside you, humming. "Sorry about this," he says pleasantly, and a knife slides out of his sleeve. Then he glances at a scrap of paper, and back at you, and frowns. The face on the paper wears an eyepatch.',
    left: { label: 'Strike first', tile: 'road', fight: { foe: 'assassin', name: 'the Grey Friar', power: 4, dmg: 1,
      win: { text: 'He dies surprised. On his wrist is a grey thread: kill a Grey Brother, and the Brothers write your blood in their ledger. They always collect, from your children if not from you.', gold: 12, mark: 'feud_brothers' },
      lose: { text: 'His knife is quicker. Then he looks at the paper again. "Oh, bother," he says, binds your arm, and leaves you his supper by way of apology.', food: 2 } } },
    right: { label: 'Point to both your eyes', tile: 'tavern', out: [
      { w: 2, text: '"Hm. So you have." He tucks the knife away, mortified, and at the next inn buys you supper by way of amends, and asks whether you know a one-eyed man.', food: 3 },
      { w: 1, text: 'He squints at your eyes, then at the paper. "Could be a disguise," he decides, and lunges. You get away with a slit coat and a long, hard run.', hp: -1, food: -1 },
      { w: 1, text: 'He apologises handsomely and pays you for your trouble in advance. "In case we meet again," he says, "professionally."', gold: 8 },
    ] },
  },
  {
    id: 'v_poor_box', tier: [2, 3], unlessMark: 'feud_brothers',
    title: 'The Box Nobody Robs',
    text: 'The Grey Brothers’ chapel stands open, as it always does, and their poor-box sits by the door, stuffed so full of gold the lid won’t close. There is no lock. Nobody robs the Grey Brothers. That is rather the point.',
    left: { label: 'Rob the poor-box', tile: 'chapel', out: [
      { w: 3, text: 'You fill your pockets, and a dead merchant’s seal ring besides. Nobody stops you; nobody needs to. By nightfall {house} is in a grey ledger, and the Brothers always collect, from you or your children.', gold: 30, relic: 'merchant_seal', mark: 'feud_brothers' },
      { w: 1, text: 'The gold is gilded lead. The Brothers are not fools. They write {house} in their ledger anyway, for the thought, and they always collect.', mark: 'feud_brothers' },
    ] },
    right: { label: 'Leave a coin and pray', cost: 12, tile: 'chapel', out: [
      { w: 2, text: 'You pray a long while beside a silent friar. When you rise, he presses a wrapped loaf into your hands. "Alms," he says, "go both ways."', food: 2 },
      { w: 1, text: 'A friar you hadn’t noticed murmurs a blessing from the shadows. For days afterwards, trouble takes one look at you and crosses the road.', trait: 'lucky' },
    ], poor: { text: 'You haven’t a coin to give. A friar gives you one instead, out of the box, and watches you all the way to the door. It feels like being measured.', gold: 2 } },
  },
  {
    id: 'v_grey_thread', tier: 1, biome: ['farm'], needsMark: 'feud_brothers', w: 3,
    title: 'The Grey Thread',
    text: 'You wake in a hayloft with a grey thread tied round your little finger, knotted three times: the Grey Brothers’ way of saying your blood has been counted. Below, someone is humming a psalm very softly, and sharpening something.',
    left: { label: 'Drop on the hummer', tile: 'stable', fight: { foe: 'assassin', name: 'the Humming Brother', power: 5, dmg: 1,
      win: { text: 'You land on him hard. He is a skinny novice in a grey hood, and he bolts, leaving his whetstone, his knife and his breakfast.', item: 'dagger', food: 2 },
      lose: { text: 'He isn’t where the humming was. You feel the knife before you see it, and then he is gone, still humming, with your purse.', gold: -6 } } },
    right: { label: 'Out the loft door', tile: 'farm', out: [
      { w: 2, text: 'You drop into a water-butt and run for it in your stockings. A mile on, the humming stops, and you realise you left your boots and your bread behind.', food: -2 },
      { w: 1, text: 'You drop straight onto the farmer, who takes you for a hay-thief. By the time you have explained, the humming is gone, and he feels bad enough to feed you.', food: 2 },
      { w: 1, text: 'You get clean away and snap the thread on a thorn. For days you eat nothing you didn’t pick yourself, and trust nobody who hums.', food: -1, sight: 1 },
    ] },
  },
  {
    id: 'v_grey_ledger', tier: 2, needsMark: 'feud_brothers', w: 3,
    title: 'The Ledger of Names',
    text: 'In a chapel with no windows, an abbot in grey turns the pages of a ledger bound in grey cord. "{house}," he reads, running a finger along the line. "A contract, fully paid. Of course, it could be struck through, for the price of the ink."',
    left: { label: 'Pay for the ink', cost: 25, tile: 'abbey', out: [
      { text: 'He counts your coin, dips his pen, and strikes your house through with one neat line. "The Brothers thank you for your custom," he says, and blots it.', unmark: 'feud_brothers' },
    ], poor: { text: 'You can’t pay. The abbot closes the ledger gently. "Then it stands. Mind the stairs; they are very steep." They are, and somebody helps you down them.', hp: -1 } },
    right: { label: 'Snatch the ledger', tile: 'crypt', out: [
      { w: 2, text: 'You grab it and run, prise off its gold clasps, and burn the rest in a ditch. That night, they say, a new copy lay on the abbot’s lectern, in the same neat hand.', gold: 18 },
      { w: 1, text: 'The ledger is chained to the lectern. The abbot watches you tug at it a while, then rings a little bell, and you leave by the steep stairs, fast, and not all of it on your feet.', hp: -1 },
    ] },
  },
  {
    id: 'v_last_brother', tier: 3, needsMark: 'feud_brothers', w: 3,
    title: 'The One They Send Last',
    text: 'An old man in grey sits on the milestone as if he has waited there all his life. "I am the one the Brothers send last," he says, unrolling two knives. "Kill me, and your contract dies with me. Or take up a knife for us, and we call it square."',
    left: { label: 'Fight the old man', tile: 'road', fight: { foe: 'assassin', name: 'the Last Brother', power: 11, dmg: 2,
      win: { text: 'He is quick, and then he is not. "Square," he whispers, and dies smiling. In his sleeve is the Brothers’ own seal, which closes a contract forever.', gold: 20, unmark: 'feud_brothers' },
      lose: { text: 'He cuts you exactly as deep as he means to. "Not today," he says, wiping the knife. "The Brothers finish what they start, but never in a hurry."', food: -1 } } },
    right: { label: 'Take up a knife', tile: 'abbey', out: [
      { w: 2, text: 'You do one killing for the Grey Brothers: a man who deserved it, they swear. They pay you his fee and strike your house from their ledger. The grey never quite washes out of your hands.', gold: 20, trait: 'ill_luck', unmark: 'feud_brothers' },
      { w: 1, text: 'The Brothers keep their word and strike your house from their ledger. The man you killed for them was a Varrow, though, and House Varrow has sworn blood on yours for it.', gold: 20, unmark: 'feud_brothers', mark: 'feud_varrow' },
    ] },
  },

  // ---------- Sworn to the Rose: the Knights of the Rose stand by their sworn, and call on them ----------
  {
    id: 'v_rose_fire', tier: [1, 2], unlessMark: 'oath_rose',
    title: 'The Commandery Burns',
    text: 'The Knights of the Rose are fighting a fire in their commandery with buckets and bad language. Through the smoke you see two things nobody has saved yet: the White Book, where the Rose writes the houses sworn to it, and the order’s silver chest.',
    left: { label: 'Carry out the White Book', tile: 'bonfire', out: [
      { w: 3, text: 'You stagger out with the book smoking in your arms. The Master writes {house} in it there on the grass: sworn to the Rose, you and all your blood. "We stand by our sworn," she says, "and we call on them."', hp: -1, ally: 'knights', mark: 'oath_rose' },
      { w: 1, text: 'You bring out the book, and a spear from the armoury on your way. The Master writes {house} in it in soot and blood: sworn to the Rose, you and every child of your blood.', item: 'spear', ally: 'knights', mark: 'oath_rose' },
    ] },
    right: { label: 'Drag out the silver chest', tile: 'abbey', out: [
      { w: 2, text: 'You haul the chest out through the smoke. The grateful Master pays you a knight’s fee from it and sends you to the kitchens, and does not count what is left, which is just as well.', gold: 15, food: 2 },
      { w: 1, text: 'The chest is too heavy. You get it as far as the door before the lintel comes down, and crawl out singed, with only what you could stuff down your shirt.', gold: 10, hp: -1 },
    ] },
  },
  {
    id: 'v_rose_muster', tier: 1, biome: ['farm'], needsMark: 'oath_rose', w: 3,
    title: 'A Letter Sealed with a Rose',
    text: 'A rider in white overtakes you, reins in, and hands down a letter sealed with a red rose, and a small purse. "{house} is sworn," she says. "The Rose musters at Briar Cross. Here is silver for your kit. We will look for you there."',
    left: { label: 'Answer the muster', tile: 'war_camp', shop: 'smith', out: [
      { text: 'Briar Cross is all white tents and hammering. Three days’ march on muster-bread has left you hollow, but the Rose’s armourers open their racks to the sworn.', gold: 8, food: -2 },
    ] },
    right: { label: 'Keep the silver, skip it', tile: 'tavern', out: [
      { w: 2, text: 'You drink the Rose’s silver in a snug little inn, until a knight in white walks in, strikes {house} out of the White Book in front of everyone, and walks out again.', gold: 12, unmark: 'oath_rose', trait: 'oathbreaker' },
      { w: 1, text: 'You spend the Rose’s silver on a good dinner, and nobody comes. Perhaps the Rose has bigger troubles this year than one missing house.', gold: 12, food: 2 },
    ] },
  },
  {
    id: 'v_rose_scutage', tier: 2, biome: ['hills', 'snow'], needsMark: 'oath_rose', w: 3,
    title: 'Shield-Money',
    text: 'Two Knights of the Rose block the road, one young, one grey. "{house} owes the Rose a lance this year," says the grey one. "A griffin on Gorsey Tor has taken three of our horses. Ride against it with us, or pay the shield-money and go."',
    left: { label: 'Ride against the griffin', tile: 'mountain', fight: { foe: 'griffin', name: 'the Griffin of Gorsey Tor', power: 8, dmg: 2,
      win: { text: 'You bring it down in a storm of golden feathers. The grey knight looks at you a long moment, then draws her sword and taps you on each shoulder. "Arise. The Rose can use you."', trait: 'knighted' },
      lose: { text: 'The griffin carries you up and drops you in a gorse bush. The knights find you, and are very kind about it, which is worse.', food: -1 } } },
    right: { label: 'Pay the shield-money', cost: 15, tile: 'road', out: [
      { w: 2, text: 'The grey knight counts it, blesses you, and shares the bread in her saddlebag. Your oath is kept, and your purse is lighter than your conscience.', food: 2 },
      { w: 1, text: 'The young knight is so pleased with your coin that he gives you his rabbit’s foot. "It never did me much good," he admits.', relic: 'rabbit_foot' },
    ], poor: { text: 'You can’t pay. The grey knight sighs and puts you on a spare horse, and you spend a wet day beating the gorse for a griffin that never comes.', food: -2 } },
  },
  {
    id: 'v_rose_charge', tier: 3, biome: ['farm', 'moor'], needsMark: 'oath_rose', w: 3,
    title: 'The Front Rank',
    text: 'The Grand Master of the Rose rides down the line to find you. "At dawn we charge the Black Earl’s pikes, and {house} rides in the front rank. Do this, and your blood’s oath is fulfilled." Across the valley the pikes glitter like frost.',
    left: { label: 'Ride in the front rank', tile: 'battlefield', out: [
      { w: 3, text: 'The charge breaks the pikes like kindling. That night the Grand Master strikes {house} from the White Book with honour: your oath is fulfilled, and your blood rides free.', gold: 20, renown: 3, unmark: 'oath_rose' },
      { w: 1, text: 'The charge breaks the Earl. After, the Grand Master gives your house the Rose’s oldest treasure, a banner that flew over the first kings. "Your blood kept faith," she says. "Now go and be kings."', relic: 'old_banner', unmark: 'oath_rose' },
      { w: 2, text: 'The pikes hold, and the charge breaks around you.', fight: { foe: 'mercenary', name: 'the Black Earl’s Pikes', power: 11, dmg: 2,
        win: { text: 'You hack a hole in the line and the Rose pours through it. The Grand Master declares your blood’s oath fulfilled, in front of everyone.', renown: 2, unmark: 'oath_rose' },
        lose: { text: 'You go down under the hooves. The Rose carries you off the field and tends you well. Your oath still stands, and so, just, do you.', food: -1 } } },
    ] },
    right: { label: 'Slip away before dawn', tile: 'road', out: [
      { w: 2, text: 'By sunrise you are three valleys away on a borrowed warhorse, which you sell. Word of {house}’s broken oath travels faster than you do.', gold: 30, unmark: 'oath_rose', trait: 'oathbreaker' },
      { w: 1, text: 'A sentry catches you at the horse-lines, and, being very young, begins to weep. You go back. At dawn you ride in the last rank, and live, and nobody speaks of it.', renown: -1 },
    ] },
  },

  // ---------- the Hollow Pact: gold from the things under the hill, and a debt that never quite ends ----------
  {
    id: 'v_green_door', tier: [1, 2], biome: ['hills', 'moor'], unlessMark: 'oath_hollow',
    title: 'The Green Door in the Hill',
    text: 'A round green door sits in the hillside where yesterday there was turf. Its brass knocker is a hand, and when you knock, it grips yours. A voice under the hill says, "Gold for you, and for your children. We ask only that you owe us."',
    left: { label: 'Shake the brass hand', tile: 'cave', out: [
      { w: 3, text: 'The hand is warm, and squeezes back. A purse drops at your feet, heavy with old coin. Every child of your blood will find one like it the morning they set out, and every one of them will owe.', gold: 15, mark: 'oath_hollow' },
      { w: 1, text: 'The hand squeezes, and does not let go until it has taken one of your back teeth, very neatly, as a deposit. Then the purse drops, and the door is only turf again.', gold: 15, hp: -1, mark: 'oath_hollow' },
    ] },
    right: { label: 'Ask to see their wares', tile: 'cave', shop: 'fence', out: [
      { text: 'The door opens a crack. Long grey fingers push out trays: rings, knives, a christening cup, a baby’s rattle. All of it belonged to someone once. "Cheap," says the voice. "We have plenty."' },
    ] },
  },
  {
    id: 'v_hollow_knock', tier: [1, 2], needsMark: 'oath_hollow', w: 3,
    title: 'A Hand Through the Shutter',
    text: 'Three knocks at midnight. Through the shutter comes a long grey hand, holding a grey string tied in a thousand knots. "The Hollow Pact," says a voice like wind in a chimney. "{house} owes. Tonight we will take... let us see."',
    left: { label: 'Let them take their due', tile: 'hovel', out: [
      { w: 2, text: 'The grey fingers pick through your pack and take your supper, every crumb, and a sigh you were saving. "Paid," says the voice, and the shutter closes.', food: -2 },
      { w: 1, text: 'The fingers run along the knots. "Coin, tonight. Ten, by this one." They take it from your purse, count it twice, and untie one knot, very carefully.', pay: 10 },
      { w: 1, text: 'They take your dreams for the night and leave theirs instead: tunnels, roots, and roads seen from underneath. You wake knowing things you shouldn’t.', sight: 2 },
    ] },
    right: { label: 'Take a knife to the hand', tile: 'hovel', fight: { foe: 'ghoul', name: 'the Hollow’s Collector', power: 4, dmg: 1,
      win: { text: 'You pin the grey hand to the sill. It squeals, and bargains, and pays you to let go: a fistful of old coin, and a whisper about the road ahead.', gold: 8, sight: 1 },
      lose: { text: 'The hand takes what it came for, and a little extra for the insult: your supper, your boots and the warmth out of your blanket.', food: -2 } } },
  },
  {
    id: 'v_hollow_shoe', tier: [2, 3], biome: ['farm'], needsMark: 'oath_hollow', w: 3,
    title: 'The Bride’s Left Shoe',
    text: 'A child’s voice speaks out of a rabbit hole. "{house} owes the Hollow a favour. There is a wedding in Brindlecote tonight. Bring us the bride’s left shoe, and the debt grows lighter." Fiddle music drifts up from the village.',
    left: { label: 'Steal the bride’s shoe', tile: 'village', out: [
      { w: 2, text: 'You filch it during the jig and drop it down the hole. Up comes gold that smells of earth, and one coin that keeps finding its way back to your purse. The bride limps for a year.', gold: 10, relic: 'tinker_coin' },
      { w: 1, text: 'The bride’s brothers catch you under the bench with her shoe in your hand. The reeve fines you for the insult, and the brothers add their own fine, with boots.', pay: 15, hp: -1 },
    ] },
    right: { label: 'Warn the bride', tile: 'chapel', out: [
      { w: 1, text: 'The bride’s grandmother knows the old ways. She sews an iron needle into both shoes, and feeds you wedding cake till you can’t stand. The Hollow go hungry tonight.', food: 3, renown: 1 },
      { w: 2, text: 'The Hollow take their favour from you instead. By morning your boots are gone, and your purse is full of earth and a single, polite pebble.', gold: -15 },
    ] },
  },
  {
    id: 'v_hollow_reckoning', tier: 3, biome: ['hills', 'moor'], needsMark: 'oath_hollow', w: 3,
    title: 'The Reckoning Under the Hill',
    text: 'The hill opens like a mouth. Below, in a hall of roots, the Hollow keep their accounts in knotted string, and the eldest, a grey thing with a lantern for a heart, holds up {house}’s string. It is very long. "Settle it," it says, "or keep owing."',
    left: { label: 'Pay back every coin', cost: 30, tile: 'cave', out: [
      { w: 3, text: 'It counts your coin into a root-cellar, snips your house’s string and feeds it to the lantern. Back to you come every tooth and dream and year your blood ever paid them. You feel new.', hp: 2, unmark: 'oath_hollow' },
      { w: 1, text: 'It counts every coin, then smiles. "And interest." The interest is a year of your life, drawn out slowly, like a thread from a hem. Then the string is cut.', maxhp: -1, unmark: 'oath_hollow' },
    ], poor: { text: 'You haven’t enough. The lantern-heart dims. "Then keep owing," it says, "and pay a little on account." It takes your supper, and the warmth out of your hands.', food: -2, hp: -1 } },
    right: { label: 'Cut the string with iron', tile: 'cave', fight: { foe: 'wraith', name: 'the Lantern-Heart', power: 11, dmg: 2,
      win: { text: 'Iron parts the string, and every lantern goes out at once. You grope your way up with a shirt of silver rings snatched in the dark, and the hill is only a hill. Your house owes no one.', item: 'mithril', unmark: 'oath_hollow' },
      lose: { text: 'The roots hold you while the Hollow take their interest out of your pack. You wake on the bare hillside at noon, owing more than ever.', food: -2 } } },
  },
];
