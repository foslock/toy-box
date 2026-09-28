// Kingdom: the state of the realm. Events for the journey that only turn up under a tyrant, on an empty throne or
// while an old ruler looks for an heir, and seed the allies each bid for the crown will need (see rules.js for every id).
export default [
  /* ====================== THE TYRANT: a cruel crown, and the people who will help you take it ====================== */
  {
    id: 'k_weighing', tier: 1, realm: 'tyrant', biome: ['farm', 'fen', 'lake'],
    title: 'The Weighing at Mossbridge',
    text: 'The tax-farmers of {ruler} have hung a grain scale on Mossbridge, and weigh every traveller who crosses: a copper a pound, by royal decree. Downstream the ford runs black and quick, and nobody seems to be watching it.',
    left: { label: 'Step onto the scale', cost: 8, tile: 'bridge', out: [
      { w: 2, text: 'The clerk writes your weight in a grey ledger and waves you over. On the far bank a farmer’s wife presses a loaf on you. "For the weighing, pet."', food: 2 },
      { w: 1, text: '"Boots are extra," says the clerk. "And the pack. And the bread in the pack." He weighs your supper, then keeps it, for the crown.', food: -1 },
    ], poor: { text: 'You can’t pay the price of yourself. They set you in the stocks till dusk, and the crows take a close interest in your supper.', food: -1, hp: -1 } },
    right: { label: 'Wade the ford by night', tile: 'ferry', out: [
      { w: 2, text: 'Halfway over, a hooded ferryman hauls you onto a raft piled with untaxed wool. "Greenhood toll," he grins. "We only take your name."', ally: 'rebels' },
      { w: 1, text: 'A man in black gloves waits on the far bank with a lantern and a ledger. "Fording without weighing. The fine is heavier than you are."', pay: 8 },
      { w: 1, text: 'The river snatches your pack, and very nearly you. You crawl out on the far bank soaked to the bone, your bread well on its way to the sea.', food: -2 },
    ] },
  },
  {
    id: 'k_hanging_day', tier: 1, realm: 'tyrant',
    title: 'Hanging Day',
    text: 'All Tollin has been herded into the square to watch a poacher hang for one of {ruler}’s deer. He is barely more than a boy. The hangman is drunk, the guards are bored, and the pickpockets are having the best day of their year.',
    left: { label: 'Bribe the hangman', cost: 10, tile: 'gallows', out: [
      { w: 2, text: 'The hangman bites your coin and ties a knot that slips. The boy drops, kicks, and is carted off "dead". By midnight he is in the greenwood, and the Greenhood know your name.', ally: 'rebels', flag: 'k_slip_knot' },
      { w: 1, text: 'The hangman pockets your coin, then does his job anyway. "A man has his pride," he tells you later, and buys you supper with it.', food: 1 },
    ], poor: { text: 'You haven’t enough to bribe a hangman. He hangs the boy, then measures your neck with his eyes, and you leave Tollin before supper.', food: -1 } },
    right: { label: 'Work the crowd', tile: 'market', out: [
      { w: 2, text: 'Three fat purses in as many minutes. A girl with ink-stained fingers falls into step beside you. "Neat hands. The Quiet Hand could use you."', gold: 8, ally: 'guild' },
      { w: 1, text: 'One purse holds no coin, only a thin grey glove that fits you perfectly. Your fingers feel cleverer the moment it is on.', relic: 'glove' },
      { w: 1, text: 'A purse-string snaps and a wool merchant roars. The crowd, glad of something else to watch, gives you a thorough kicking.', hp: -1 },
    ] },
  },
  {
    id: 'k_friendly_drunk', tier: 1, realm: 'tyrant',
    title: 'The Man Who Buys the Ale',
    text: 'In the Crook and Candle, a cheerful stranger keeps your cup full and leans in close. "Between friends, what do you make of {ruler}?" His hands are soft and clean, and his own ale has not gone down all night.',
    left: { label: 'Speak your mind', tile: 'tavern', out: [
      { w: 1, text: 'The taproom goes quiet, then roars. The landlord stands you supper and a pedlar kisses you on both cheeks. "Said what we all think."', food: 2, renown: 1 },
      { w: 2, text: 'He smiles, and taps the table twice. Two men in black gloves rise from the corner.', fight: { foe: 'soldier', name: 'the Black Gloves', power: 4, dmg: 1,
        win: { text: 'You leave them groaning in the sawdust. One of them leaves you his black-hilted dagger, though not by choice.', item: 'dagger' },
        lose: { text: 'They take your purse "for the crown’s inquiries" and throw you in the gutter to think about loyalty.', gold: -8 } } },
    ] },
    right: { label: 'Sell him a name', tile: 'prison', out: [
      { w: 2, text: 'You invent a miller called Hobb and a list of his treasons. The stranger pays in bright new silver, and orders you a pork pie.', gold: 12, food: 1 },
      { w: 1, text: 'There was a miller called Hobb. They hang him at dawn, and ever after his ghost sits on the end of your bed, dripping flour.', gold: 12, trait: 'ill_luck' },
    ] },
  },
  {
    id: 'k_knight_in_ashes', tier: 2, realm: 'tyrant', biome: ['farm', 'wood'],
    title: 'The Knight in the Ashes',
    text: 'Nothing is left of Little Sallow but chimneys and crows. A Knight of the Rose sits in the ashes, sword across his knees. "{Ruler} wanted it burned. I wouldn’t, so they did it themselves. Now they’re back to hang me." Hoofbeats.',
    left: { label: 'Stand with the knight', tile: 'bonfire', fight: { foe: 'soldier', name: 'the Crown Riders', power: 7, dmg: 1,
      win: { text: 'The riders break and scatter into the smoke. The knight kneels in the ash and swears on his blade that the Rose will not forget you.', ally: 'knights' },
      lose: { text: 'They ride you both down. The knight goes off in chains; you are left in the ashes for dead, and very nearly agree.', food: -1 } } },
    right: { label: 'Bribe the captain', cost: 15, tile: 'war_camp', out: [
      { w: 3, text: 'The captain pockets your gold and remembers urgent business elsewhere. The knight grips your hand. "The Rose pays its debts. Every one."', ally: 'knights' },
      { w: 1, text: 'The captain pockets your gold, then hangs the knight anyway. "Can’t be seen taking bribes," he explains, riding off.' },
    ], poor: { text: 'You have nothing worth a captain’s greed. He has you whipped for wasting his afternoon, and the knight hanged for wasting his morning.', hp: -1 } },
  },
  {
    id: 'k_bishop_in_the_oak', tier: 2, realm: 'tyrant', biome: ['wood'],
    title: 'The Bishop in the Oak',
    text: 'Bishop Aldwyth preached against {ruler} once too often, and now preaches from a hollow oak to three goatherds and a bee-keeper. "Carry my letters to the abbeys," she says. "Or sell me to the crown. I fetch a good price."',
    left: { label: 'Carry her letters', tile: 'abbey', out: [
      { w: 2, text: 'Abbey to abbey, the letters pass from sleeve to sleeve. The last abbot burns his, and blesses you with sooty thumbs. "The Dawn Church remembers who walked for her."', ally: 'church', renown: 1 },
      { w: 1, text: 'An old abbess reads hers twice, then lays both hands on your head. "No curse will cling to you now, child. Go carefully."', ally: 'church', trait: 'saints_ward' },
      { w: 1, text: 'At the abbey gate a Black Glove is reading everyone’s letters. He reads yours with great interest, then names his price for forgetting it.', pay: 16 },
    ] },
    right: { label: 'Sell her to the crown', tile: 'castle', out: [
      { w: 2, text: 'The reeve counts out the bounty in new-minted gold. The bishop goes quietly, blessing her guards.', gold: 25 },
      { w: 1, text: 'The bishop goes quietly, blessing her guards, the reeve and, last of all, you. It does not feel like a blessing. Nobody meets your eye after.', gold: 25, trait: 'oathbreaker' },
    ] },
  },
  {
    id: 'k_quiet_hand', tier: 2, realm: 'tyrant',
    title: 'A Word from the Quiet Hand',
    text: 'A grey-hooded woman at the well draws a thumb across her lips: the sign of the Quiet Hand. "The magistrate of Crale hangs a man most mornings, and dines at eight. A stranger could season his soup." She leaves a green phial by your hand.',
    left: { label: 'Season the magistrate’s soup', tile: 'manor', out: [
      { w: 2, text: 'The magistrate eats every spoonful and complains about the salt. By morning Crale has no magistrate, and you have friends in every shadow.', ally: 'guild', gold: 15 },
      { w: 1, text: 'The food-taster goes first, loudly. The guards come looking for the new kitchen-hand.', fight: { foe: 'soldier', name: 'the Magistrate’s Guard', power: 7, dmg: 2,
        win: { text: 'You fight your way out through the scullery with a ham under each arm.', food: 2 },
        lose: { text: 'They beat you bloody and throw you in the moat. When you crawl out, your purse has stayed behind.', gold: -10 } } },
    ] },
    right: { label: 'Sell it to a fence', tile: 'hovel', shop: 'fence', out: [
      { text: 'A one-eyed fence in the tanners’ row buys the phial without a question, and has a few things to sell you, also without questions.', gold: 10 },
    ] },
  },
  {
    id: 'k_dungeon_break', tier: 3, realm: 'tyrant',
    title: 'The Dungeon Break',
    text: 'Crale gaol is burning from the inside, and prisoners stream past you into the night. From the deepest cells call a fat merchant of the Gilded Company, promising gold, and a Greenhood captain with a broken leg, promising nothing.',
    left: { label: 'Free the merchant', tile: 'prison', out: [
      { w: 2, text: 'He is heavy, slow and unbearable, and he keeps his word. At the Gilded Company’s counting-house they fill your purse and write your name in a better ledger.', ally: 'merchants', gold: 30 },
      { w: 1, text: 'The turnkey catches you both in the drain and names his price for forgetting it. The merchant, it turns out, left his purse in his other cell.', ally: 'merchants', pay: 20 },
    ] },
    right: { label: 'Carry the captain', tile: 'forest', out: [
      { w: 2, text: 'You carry her out through the sewers on your back. In the greenwood a hundred hooded figures rise from the bracken to cheer you, and feed you till you creak.', ally: 'rebels', renown: 2, food: 2 },
      { w: 1, text: 'Her leg is worse than she said, and the hounds are better. You reach the greenwood half-dead, clutching a gaoler’s warhammer you don’t remember taking.', ally: 'rebels', hp: -1, item: 'warhammer' },
    ] },
  },
  {
    id: 'k_poachers_path', tier: 3, realm: 'tyrant', biome: ['wood'], needs: 'k_slip_knot', w: 3,
    title: 'The Poacher’s Path',
    text: 'The boy who didn’t hang at Tollin finds you at dusk, a Greenhood bow on his back and a rope-burn round his neck. "{Ruler} hunts the Hartwood tomorrow. I know every deer-path in it. Want to watch a tyrant run?"',
    left: { label: 'Ambush the royal hunt', tile: 'forest', fight: { foe: 'champion', name: 'the Master of the Hunt', power: 12, dmg: 2, elite: true,
      win: { text: 'The Master of the Hunt falls in the bracken, and {ruler} flees the wood hatless on a lathered horse. By Sunday all {kingdom} has heard, and is laughing.', renown: 3, gold: 30 },
      lose: { text: 'The hounds find you first. The boy drags you out through a badger-run, bleeding and furious. "Next time," he says.' } } },
    right: { label: 'Poach the royal park', tile: 'camp', out: [
      { w: 2, text: 'You take a royal stag by moonlight and feast in a Greenhood camp. The boy gives you his old snare. "Never once been caught. That makes one of us."', food: 3, relic: 'snare' },
      { w: 1, text: 'The deer-wardens catch you gutting a royal hind. The boy is gone like smoke, and your purse goes to the crown.', gold: -15 },
    ] },
  },

  /* ====================== THE EMPTY THRONE: warlords, hunger and hard bargains ====================== */
  {
    id: 'k_foragers', tier: 1, realm: 'chaos', biome: ['farm'],
    title: 'The Foragers',
    text: 'Riders under the Carrion Duke’s bone-white banner are stripping a farm: grain sacks, the plough-ox, the very door off its hinges. The farmer watches from the ditch, gripping a pitchfork he hasn’t the stomach to use. His children watch you.',
    left: { label: 'Take up the pitchfork', tile: 'farm', fight: { foe: 'soldier', name: 'the Duke’s Foragers', power: 3, dmg: 1,
      win: { text: 'The foragers ride off with half a cart. The farmer digs up the one thing they missed, his grandfather’s axe, and presses it into your hands.', item: 'axe' },
      lose: { text: 'They leave you in the ditch beside the farmer, and take his last sack and your bread with it. His children bring you water. It is all they have.', food: -1 } } },
    right: { label: 'Help them load the carts', tile: 'war_camp', out: [
      { w: 2, text: 'The sergeant pays you in the farmer’s own bread, and doesn’t meet your eye. Neither do you.', food: 3 },
      { w: 1, text: 'When the carts are full the sergeant looks you over. "Strong back." You dig the Duke’s latrines for three days before you can slip away.', food: 1, hp: -1 },
    ] },
  },
  {
    id: 'k_deserters', tier: 1, realm: 'chaos', biome: ['wood', 'moor'],
    title: 'Deserters’ Goose',
    text: 'Three deserters from Lady Grisel’s army crouch round a fire, badges cut from their coats, roasting a stolen goose. "Sit and eat," says the eldest, "then come with us to the Greenhood. Or run and tell her ladyship. Your choice, friend."',
    left: { label: 'Eat, and go with them', tile: 'forest', out: [
      { w: 2, text: 'The goose is burnt and glorious. Two days later you walk into a Greenhood camp with three new friends and grease on your chin.', food: 2, ally: 'rebels' },
      { w: 1, text: 'You wake at dawn to a cold fire and a heap of goose bones. Your new friends are gone, and so is your purse.', gold: -8 },
    ] },
    right: { label: 'Tell Lady Grisel', tile: 'castle', out: [
      { w: 2, text: 'Lady Grisel hears you out, sends twenty riders, and hangs all three by supper. "Useful," she says, and writes your name among the friends of the Marches.', ally: 'lords', gold: 8 },
      { w: 1, text: 'The eldest deserter guesses where you are going, and follows you into the dark with a knife.', fight: { foe: 'soldier', name: 'the Eldest Deserter', power: 3, dmg: 1,
        win: { text: 'He dies cursing you. Lady Grisel pays for his ears, and remembers who brought them.', ally: 'lords', gold: 8 },
        lose: { text: 'He leaves you bleeding in the bracken, and goes back for the rest of the goose.', food: -1 } } },
    ] },
  },
  {
    id: 'k_plague_road', tier: 1, realm: 'chaos', biome: ['farm', 'moor'],
    title: 'The Chalk-Skull Road',
    text: 'Refugees choke the road: handcarts, goats, grandmothers. The village behind them has a chalk skull on every door. A woman catches your sleeve. "My boy’s burning up. The nuns at Wendle take the sick. Carry him, for pity. I can’t any more."',
    left: { label: 'Carry the boy', tile: 'abbey', out: [
      { w: 2, text: 'He weighs no more than a sack of feathers, and talks to horses in his sleep the whole way. The nuns take him in, and feed you for your trouble.', food: 2, renown: 1 },
      { w: 1, text: 'At the abbey gate his mother presses a horseshoe into your hands. "His father’s. It kept him lucky, till the war."', relic: 'horseshoe' },
      { w: 1, text: 'The boy lives. By the time you reach the abbey, you are the one burning.', hp: -1 },
    ] },
    right: { label: 'Loot the chalked village', tile: 'village', out: [
      { w: 2, text: 'The dead don’t lock their larders. You fill your pack with cheese, ham and a few coins, and try not to breathe.', food: 3, gold: 6 },
      { w: 1, text: 'You breathe. Three days later you are shaking in a ditch, and when the fever lets you go, it keeps something back.', maxhp: -1, food: 1 },
    ] },
  },
  {
    id: 'k_carrion_feast', tier: 2, realm: 'chaos',
    title: 'The Carrion Duke’s Feast',
    text: 'The Carrion Duke feasts three Marcher lords in a roofless abbey, and has pressed you into service as cupbearer. The high table’s wine comes from its own jug, and the steward wears gloves to pour it. The lords laugh, and toast to peace.',
    left: { label: 'Spill the jug', tile: 'castle', out: [
      { w: 2, text: 'You trip, loudly. A lord’s hound laps at the puddle and dies in the rushes. The lords draw steel and ride out with you in their midst. They owe you now, and know it.', ally: 'lords', renown: 2 },
      { w: 1, text: 'The steward reads it in your face before the jug hits the floor.', fight: { foe: 'soldier', name: 'the Duke’s Household', power: 7, dmg: 1,
        win: { text: 'You cut a way out behind the lords. They won’t forget whose blade opened the door.', ally: 'lords' },
        lose: { text: 'You escape through the kitchens with a cleaver-cut and a heel of bread, and nothing else.', food: 1 } } },
    ] },
    right: { label: 'Pour, and hold your tongue', tile: 'abbey', out: [
      { w: 2, text: 'The lords die before the pudding. The Duke is generous with their purses, and you eat like a bishop off their plates.', gold: 20, food: 3 },
      { w: 1, text: 'The last lord dies looking straight at you, whispering something you cannot hear. It settles over one eye like a cold hand.', gold: 20, trait: 'veil' },
    ] },
  },
  {
    id: 'k_grey_ford', tier: 2, realm: 'chaos', biome: ['fen', 'lake', 'farm'],
    title: 'Parley at Grey Ford',
    text: 'Two starving armies glare across Grey Ford: Earl Saltmouth’s pikes on one bank, the Carrion Duke’s crossbows on the other. Both heralds have been shot. A captain hauls you out of the reeds. "You’ll carry our terms across. Or be shot as well."',
    left: { label: 'Carry the terms', tile: 'ferry', out: [
      { w: 2, text: 'Across the ford and back, soaked to the waist, eleven times. By dusk there is a truce, and both sides toast the herald they didn’t shoot. The Earl writes down your name.', ally: 'lords', renown: 2 },
      { w: 1, text: 'On the fourth crossing, somebody’s crossbow slips. The truce holds anyway. You very nearly don’t.', hp: -1, renown: 1 },
    ] },
    right: { label: 'Whisper war to both camps', tile: 'battlefield', out: [
      { w: 2, text: 'You tell each camp the other is starving and weak. They fall on each other at dawn, and by noon you and the crows are picking over the ford.', gold: 15, item: 'chain' },
      { w: 1, text: 'Both armies charge at once, with you in the middle. You spend the battle face-down in the reeds, and crawl out with nothing but a cough.', hp: -1 },
    ] },
  },
  {
    id: 'k_last_wagon', tier: 2, realm: 'chaos', biome: ['fen', 'lake'],
    title: 'The Treasury’s Last Wagon',
    text: 'The royal treasury’s last wagon lies overturned in the Coldwater reeds, its guards dead around it. One isn’t quite: an old Knight of the Rose, arrow in his thigh, sword across a sealed chest. "For the next crown," he wheezes. "Not for you."',
    left: { label: 'Bind his wound', tile: 'camp', out: [
      { w: 2, text: 'You dig the arrowhead out with a hot knife while he bites his belt. He lives, and grips your arm like a vice. "The Rose remembers."', ally: 'knights' },
      { w: 1, text: 'Looters creep out of the reeds while you are still stitching.', fight: { foe: 'bandit', name: 'the Coldwater Looters', power: 6, dmg: 1,
        win: { text: 'You hold the chest with the old knight, back to back, till the looters give up. He calls you friend, which from him is nearly a knighthood.', ally: 'knights' },
        lose: { text: 'The looters split the chest and scatter into the reeds. The old knight dies cursing them, and not, you think, you.', food: -1 } } },
    ] },
    right: { label: 'Fill your pockets', tile: 'swamp', out: [
      { w: 2, text: 'You scoop crown gold out of a split chest while the old knight curses you in three languages. He cannot stand to follow.', gold: 20 },
      { w: 1, text: 'One coin is warm, and hums faintly. By morning there are two of it.', gold: 10, relic: 'tinker_coin' },
      { w: 1, text: 'The treasury’s goblin-smiths curse every coin they strike, against thieves. Your purse grows heavier and emptier every day after.', gold: 20, trait: 'leaden_purse' },
    ] },
  },
  {
    id: 'k_crowpass_king', tier: 3, realm: 'chaos', biome: ['hills', 'snow'],
    title: 'The King of Crowpass',
    text: 'Black Gammon crowned himself King of Crowpass, and holds court on a heap of stolen saddles. Chained to his throne is a boy of nine who swears he is the old king’s grandson. "Ransom’s twenty-five," says Gammon. "Or fight me for him. People do."',
    left: { label: 'Pay the boy’s ransom', cost: 25, tile: 'pass', out: [
      { w: 2, text: 'The boy rides north on your shoulders. A week later three Knights of the Rose ride out of the mist, kneel to him, and then, more awkwardly, to you.', ally: 'knights', renown: 1 },
      { w: 1, text: 'Two nights north, the boy slips off with your blanket and your bread. "King’s grandson," says a shepherd, "and a cutpurse’s son."', food: -2 },
    ], poor: { text: 'You can’t pay. Gammon takes a finger for wasting his time, and apologises for the state of the knife.', hp: -1 } },
    right: { label: 'Fight Gammon for the boy', tile: 'bandit_camp', fight: { foe: 'brigand', name: 'Black Gammon', power: 11, dmg: 1, elite: true,
      win: { text: 'Gammon’s dented crown rolls in the dirt. The boy puts it on, and it falls over his eyes. Within the week the Knights of the Rose come to kneel to him, and to his champion.', ally: 'knights', renown: 2 },
      lose: { text: 'Gammon throws you down the pass and keeps the boy. You can hear him laughing all the way to the bottom.', food: -1 } } },
  },
  {
    id: 'k_shut_gate', tier: 3, realm: 'chaos', biome: ['hills', 'snow'],
    title: 'The Shut Gate of Gorrum Deep',
    text: 'The Deep Kin have shut their gate against the war. Below it, Earl Saltmouth’s starving army is building a ram from a gallows. A dwarf leans over the battlements. "Oi! Tallfolk! Burn that ram tonight, and the Deep Kin will call you friend."',
    left: { label: 'Burn the ram', tile: 'war_camp', out: [
      { w: 2, text: 'You slip through the camp with a pot of pitch and a stolen torch. The ram goes up like a harvest bonfire, and a rope comes down the wall for you.', ally: 'dwarves', renown: 2 },
      { w: 1, text: 'A sentry catches you with the pitch-pot in your hands.', fight: { foe: 'soldier', name: 'the Earl’s Sappers', power: 9, dmg: 1,
        win: { text: 'The ram burns anyway, with its sappers watching from the mud. A rope comes down the wall for you.', ally: 'dwarves' },
        lose: { text: 'They beat you and tie you to the ram for the dwarves to shoot at. The dwarves throw down bread instead, which is something.', food: 1 } } },
    ] },
    right: { label: 'Trade by the basket', tile: 'mine', shop: 'smith', out: [
      { text: 'The gate stays shut, but a basket comes down the wall on a chain. Coin goes up; dwarf-steel comes down. "No haggling," shouts a dwarf. "There’s a war on."' },
    ] },
  },

  /* ====================== THE OLD RULER: an heirless crown, and the favour of the one who wears it ====================== */
  {
    id: 'k_royal_progress', tier: 1, realm: 'old', biome: ['farm'],
    title: 'The Royal Progress',
    text: '{Ruler}’s progress crawls through Pennock in the rain: forty wagons, a hundred horses and a gilded litter with the curtains drawn. A litter-wheel cracks in a rut. Outriders bellow for a wheelwright. Nobody moves.',
    left: { label: 'Mend the wheel', tile: 'road', out: [
      { w: 3, text: 'You lash the spokes with your own belt. As the litter rolls on, the curtain twitches, and a thin old hand drops a silver coin in the mud for you.', gold: 6, renown: 1, flag: 'k_mended_wheel' },
      { w: 1, text: 'A guard knocks you flat for laying hands on royal property. Somebody else mends the wheel, and is thanked.', hp: -1 },
    ] },
    right: { label: 'Follow the almoner’s cart', tile: 'chapel', out: [
      { w: 2, text: 'The royal almoner throws bread and pennies from the back of a cart. You catch a loaf, a penny and a blessing, which is two more than most.', food: 2, gold: 3 },
      { w: 1, text: 'The almoner sees you split your loaf with a beggar child. He asks your name, and writes it in the Dawn Church’s great book.', ally: 'church', food: 1 },
      { w: 1, text: 'The crowd surges for the pennies, and somebody surges off with your pack.', food: -2 },
    ] },
  },
  {
    id: 'k_gibbet_falcon', tier: 1, realm: 'old', biome: ['moor', 'hills'],
    title: 'The Falcon on the Gibbet',
    text: 'For a week the heralds have cried the loss of {ruler}’s white falcon. You find her at dusk on a gibbet cage on Gallows Hill, eating something you’d rather not see. The cage’s tenant watches you. He has been dead a month.',
    left: { label: 'Climb the gibbet', tile: 'gallows', out: [
      { w: 2, text: 'The falcon steps onto your wrist as if she has been waiting. At the royal mews an old Knight of the Rose weeps into her feathers, feeds you, and swears you a favour.', ally: 'knights', renown: 1, food: 1 },
      { w: 1, text: 'The hanged man’s hand closes round your ankle. "Take me down first," it creaks.', fight: { foe: 'ghost', name: 'the Gibbet Ghost', power: 4, dmg: 1,
        win: { text: 'You wrestle the cage down and the dead man falls to dust with a sigh. The falcon hops onto your shoulder as if nothing happened.', ally: 'knights' },
        lose: { text: 'You fall off the gibbet into a bramble. The falcon flies away, and the dead man laughs till dawn.', food: -1 } } },
    ] },
    right: { label: 'Bury the hanged man', tile: 'graveyard', out: [
      { w: 1, text: 'You bury him under the hawthorn. In his pocket is a rabbit’s foot, which clearly did him no good at all. Perhaps it will do better by you.', relic: 'rabbit_foot' },
      { w: 1, text: 'As the last spadeful falls, a cold voice thanks you, and for a moment you see the road ahead the way the dead see it.', trait: 'second_sight' },
      { w: 1, text: 'When you straighten from the grave, the falcon is sitting on it, curious. She lets you carry her home to a weeping Knight of the Rose.', ally: 'knights', renown: 1 },
      { w: 1, text: 'Hard digging on a cold hill, and the falcon is gone before you finish. Nothing to show for it but blisters.', food: -1 },
    ] },
  },
  {
    id: 'k_dukes_purse', tier: 1, realm: 'old',
    title: 'Duke Rainald’s Purse',
    text: 'Duke Rainald of Harrowmere means to be named heir, and is thinning the field. His steward stops you on the road with a purse and a smile like a crack in ice. "His Grace pays travellers to go home. Fifteen gold, and forget the crown."',
    left: { label: 'Take the duke’s gold', tile: 'manor', out: [
      { w: 2, text: 'The steward counts it into your palm and makes you swear. Oaths sworn on a muddy road are only half binding. Everybody knows that.', gold: 15 },
      { w: 1, text: 'Under a top layer of gold, the purse is full of lead shot. By the time you look, the steward is a mile off and waving.', gold: 4 },
    ] },
    right: { label: 'Refuse the purse', tile: 'road', out: [
      { w: 2, text: 'Word of your refusal travels. The Marcher Lords loathe Rainald, and one of them sends a rider to shake your hand and learn your name.', ally: 'lords', renown: 1 },
      { w: 1, text: 'The steward’s men teach you manners with a cudgel, and leave you in a ditch to practise them.', hp: -1 },
    ] },
  },
  {
    id: 'k_tourney', tier: 2, realm: 'old',
    title: 'A Tourney for the Old Crown',
    text: 'Knights joust in {ruler}’s honour below {capital}, and the guest of honour dozes under a canopy. A squire grabs your arm. "My master’s drunk, and he’s up next. Wear his helm and ride for him, {sir}. Nobody will know."',
    left: { label: 'Ride in his place', tile: 'tourney', fight: { foe: 'knight', name: 'Sir Umber of the Tusk', power: 7, dmg: 2,
      win: { text: 'Sir Umber goes over his horse’s tail with a noise like a dropped kitchen. His lance is yours by right of arms, and the Knights of the Rose come to see who is under the helm.', ally: 'knights', item: 'lance' },
      lose: { text: 'You land in the dust with the whole court watching. The drunk knight’s name is mud now, but at least it isn’t yours.' } } },
    right: { label: 'Browse the tourney fair', tile: 'market', shop: 'market', out: [
      { text: 'Behind the pavilions: pie-men, a barber-surgeon, and armourers selling off the dents they hammered out of yesterday’s losers.' },
    ] },
  },
  {
    id: 'k_royal_physician', tier: 2, realm: 'old',
    title: 'The Royal Physician',
    text: 'Master Quillon, the royal physician, is brewing a cure for {ruler}. "Mandrake, pulled at midnight from under a gallows. Fifteen gold a root." He gives you a phial against the cold. It smells of bitter almonds, like his fingers.',
    left: { label: 'Fetch the mandrake', tile: 'gallows', out: [
      { w: 2, text: 'You pull it at midnight with wax in your ears. Quillon pays in full, and throws in a pouch of healing moss for your trouble.', gold: 15, relic: 'moss' },
      { w: 1, text: 'Even through the wax, the mandrake’s scream knocks you flat. Quillon pays, and does not ask how you are.', gold: 15, hp: -1 },
    ] },
    right: { label: 'Show the Tower the phial', tile: 'wizard_tower', out: [
      { w: 3, text: 'The court wizard sniffs it and goes the colour of old cheese. "Not a word. The Tower will watch Quillon now, and it owes you." He touches your eyelids; the world looks sharper.', ally: 'mages', sight: 1 },
      { w: 1, text: 'The court wizard is in the middle of something delicate, and hates to be interrupted. You leave the Tower rather smaller than you arrived, and greener.', trait: 'toad' },
    ] },
  },
  {
    id: 'k_last_hunt', tier: 3, realm: 'old', biome: ['wood'],
    title: 'The Last Royal Hunt',
    text: '{Ruler} rides out after the white hart one last time, strapped into the saddle, too frail to hold the reins. In the thicket beside you, one of Duke Rainald’s men is winding a crossbow. He is not looking at the hart.',
    left: { label: 'Tackle the crossbowman', tile: 'forest', fight: { foe: 'assassin', name: 'Rainald’s Crossbowman', power: 9, dmg: 2,
      win: { text: 'You bring him down in the bracken, bolt still in the groove. {Ruler} asks your name, and says it over twice: "{name}. {name}." A purse follows you home.', claim: 1, renown: 2, gold: 15 },
      lose: { text: 'He clubs you with the stock and runs, and his bolt goes wide. You lie in the bracken till dark. Nobody saw what you did, except him.', food: -1 } } },
    right: { label: 'Shout a warning', tile: 'castle', out: [
      { w: 2, text: 'A guard drags the old ruler from the saddle, and the bolt sings through empty air. By nightfall the court knows who shouted, and so does every alehouse.', trait: 'beloved' },
      { w: 1, text: 'The crossbowman swings round and looses at you instead.', hp: -1 },
      { w: 1, text: 'The guards see only you, shouting and pointing. It takes a night in the cells to convince them, and nobody feeds you.', food: -1 },
    ] },
  },
  {
    id: 'k_wheel_remembered', tier: 3, realm: 'old', needs: 'k_mended_wheel', w: 3,
    title: 'A Kindness Remembered',
    text: 'A herald finds you on the road: "{Ruler} remembers who mended a wheel at Pennock with a belt." In a hot little room in {capital}, the old ruler peers out of a nest of furs. "I have no heir, and a great many cousins. Kneel."',
    left: { label: 'Kneel for the sword', tile: 'castle', out: [
      { w: 3, text: 'The sword taps one shoulder, then the other, then, by accident, your ear. "Rise," says {ruler}, "and mind the furniture."', trait: 'knighted' },
      { w: 1, text: 'Halfway through, {ruler} forgets why you are kneeling, and falls asleep. A steward presses an hourglass into your hands. "The old one has no more use for time."', relic: 'hourglass' },
    ] },
    right: { label: 'Ask to be named heir', tile: 'manor', out: [
      { w: 2, text: 'The old ruler laughs until the laugh becomes a cough. "Bold. I was bold, once." A clerk is sent for, and your name goes into the will in green ink.', claim: 2, renown: 1 },
      { w: 1, text: '"Ambitious," says {ruler}, and closes both eyes. You wait an hour. They do not open again until you have gone.', renown: 1 },
    ] },
  },
];
