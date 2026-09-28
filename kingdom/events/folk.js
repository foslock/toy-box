// Kingdom: roads and folk. Villages, fairs, tolls, taverns, abbeys and manors; knights errant, beggars, gamblers,
// sheriffs and the ordinary greed and kindness of the realm. Events for the journey (see rules.js for every id).
//
// Chains: f_squire (the Unhorsed Knight → Pellam at the Lists), f_apprentice (the Runaway Apprentice → the Sign of the
// Wren), f_poacher (a Hanging at Gallowfield → the Greenhood Remembers).
export default [
  /* ---------- tier 1: steps 1-4 ---------- */
  {
    id: 'f_shell_game', tier: 1,
    title: 'Three Shells and a Pea',
    text: 'At the market cross a man in a velvet hat shuffles three walnut shells on a barrel. "Find the pea, double your silver!" The farmer beside you has just won twice running. Neither of them has any eyebrows.',
    left: { label: 'Try your luck', cost: 5, tile: 'market', out: [
      { w: 2, text: 'You follow the pea with your whole soul. It is under none of the shells. It is, you suspect, in his other hat.' },
      { w: 2, text: 'He lets you win the way you let a fish nibble, then again. You are off with a fat purse before he can reel you in.', gold: 12 },
      { w: 1, text: 'You win so often that a thin man in grey stops to watch. He tucks a fingerless glove into your belt. "Quick hands. Keep them busy."', relic: 'glove' },
    ], poor: { text: 'With nothing to stake, you play for your supper instead. You lose it, and the farmer eats it in front of you, slowly.', food: -1 } },
    right: { label: 'Expose the cheat', tile: 'market', fight: { foe: 'bandit', name: 'the Eyebrowless Brothers', power: 3, dmg: 1,
      win: { text: 'You kick the barrel over. Peas everywhere, and not one under a shell. The crowd takes back its silver and gives you a share.', gold: 10 },
      lose: { text: 'Both brothers sit on you while a third brother (there is always a third) goes through your pack.', gold: -4, food: -1 } } },
  },
  {
    id: 'f_unhorsed_knight', tier: 1,
    title: 'The Unhorsed Knight',
    text: 'A knight in dented armour sits on a milestone beside a dead horse, composing it a lament. "Sir Pellam of the Pale Tower," he sighs, "bound for the lists at Ashby Green on foot, like a pedlar. I lack a squire, {sir}."',
    left: { label: 'Carry his lance', tile: 'road', out: [
      { w: 3, text: 'Three days of polishing his greaves and hearing his poems. He shares his oatcakes and swears you will squire for him at Ashby Green.', food: 2, flag: 'f_squire' },
      { w: 1, text: 'His creditors catch up at the ford: two bailiffs and a very large dog. Pellam escapes through the reeds. You and your supper do not.', food: -2 },
    ] },
    right: { label: 'Buy his spare spear', cost: 8, tile: 'road', out: [
      { w: 3, text: 'He sells it with tears in his eyes and a speech about its ancestry. It is, in fairness, a very good spear.', item: 'spear' },
      { w: 1, text: 'The spearhead flies off at the first swing. Pellam, mortified, gives you the dead horse’s shoe by way of apology.', relic: 'horseshoe' },
    ], poor: { text: 'You have no coin, so he knights your walking staff instead, at length. By the time he is done, the crows have had your lunch.', food: -1 } },
  },
  {
    id: 'f_mop_fair', tier: 1, biome: ['farm'],
    title: 'The Mop Fair at Mossford',
    text: 'Hiring day at Mossford: shepherds wear a tuft of wool, dairymaids carry a pail, and the gingerbread man wears his whole stock as a necklace. Farmers pinch arms and look at teeth. Somebody pinches yours.',
    left: { label: 'Browse the stalls', tile: 'market', shop: 'market', out: [
      { text: 'Striped awnings, hot chestnuts, a dancing bear who plainly wishes it were elsewhere. The stallholders smell your purse at forty paces.' },
    ] },
    right: { label: 'Hire on for the harvest', tile: 'farm', out: [
      { w: 3, text: 'A week of reaping for Goody Tansy, who feeds her hands like prize hogs. You leave aching, fed and paid.', food: 3, gold: 6 },
      { w: 1, text: 'A sickle slips at the last sheaf. The harvest supper is the best you have ever eaten, which helps a little.', hp: -1, food: 2 },
    ] },
  },
  {
    id: 'f_toll_for_all', tier: 1,
    title: 'A Toll for Every Sort',
    text: 'A tollgate squats across the road, its board painted with prices: MERCHANTS 10. PILGRIMS 2. BEGGARS 1. LEPERS FREE. The keeper, a man with a ledger and a squint, looks you up and down. "And what are you?"',
    left: { label: 'Swear you are a pilgrim', tile: 'tollgate', out: [
      { w: 3, text: 'He takes your two coppers and gives you a pilgrim’s blessing and a heel of bread. You feel almost holy.', gold: -2, food: 1 },
      { w: 1, text: '"Recite the Pilgrim’s Creed, then." You hum hopefully. He fines you for a false oath, and writes your name down very neatly.', pay: 10 },
      { w: 1, text: 'Real pilgrims come singing up the road and sweep you through the gate with them for nothing. They teach you three hymns and one flea.', renown: 1 },
    ] },
    right: { label: 'Pay the merchant’s rate', cost: 10, tile: 'tollgate', out: [
      { w: 2, text: 'He lifts the bar with a bow and adds your name to a list headed THE GILDED COMPANY: FRIENDS OF. You don’t recall joining.', ally: 'merchants' },
      { w: 2, text: 'The merchant’s rate includes a merchant’s breakfast: ham, eggs and small beer in the gatehouse, served by the keeper’s mother.', food: 2 },
    ], poor: { text: '"No coin? Then you’re a beggar," says the keeper, and charges you a beggar’s penny. You haven’t that either, so he takes your bread.', food: -1 } },
  },
  {
    id: 'f_beggar_at_well', tier: 1,
    title: 'The Beggar at the Well',
    text: 'A beggar sits on the lip of the village well in rags so old the patches have patches. He asks for bread. His hands are soft as a bishop’s, and pale bands on his fingers show where rings used to be.',
    left: { label: 'Share your bread', tile: 'well', out: [
      { w: 2, text: 'He eats like a wolf, then presses a crust back into your hand. It is warm. That night there is another in your pack, and the next night too.', food: -1, relic: 'satchel' },
      { w: 1, text: 'He eats, belches, and falls asleep on the well-lid. That is the whole story.', food: -2 },
      { w: 1, text: '"You’ll do," he says, licking his fingers. He is the Beggar-King of {capital}, and every gutter in {kingdom} is his court.', food: -1, ally: 'guild' },
    ] },
    right: { label: 'Shake him for his rings', tile: 'village', out: [
      { w: 2, text: 'Sewn in his hem: a ring of gold, a ring of brass, a ring of plaited hair. You take them all. He watches you go and says nothing.', gold: 10 },
      { w: 1, text: 'He whistles. Beggars unfold from every doorway, and every beggar has a knife.', fight: { foe: 'bandit', name: 'the Beggar-King’s Court', power: 4, dmg: 1,
        win: { text: 'You back out of the village swinging, your purse still on your belt and somebody else’s in your boot.', gold: 10 },
        lose: { text: 'They take your boots, your bread and your dignity, then politely give back the dignity.', food: -2 } } },
      { w: 1, text: 'He laughs. "Keep them, and what comes with them." The ring of hair was somebody’s, and whoever it was is not resting easy.', gold: 10, trait: 'ill_luck' },
    ] },
  },
  {
    id: 'f_bolted_groom', tier: 1,
    title: 'The Bolted Groom',
    text: 'Bells, garlands and a whole pig on the spit, but no groom: he went over the orchard wall an hour ago. The bride’s father seizes your sleeve. "The pig’s cooked and the chaplain’s paid. You’ll stand in, won’t you?"',
    left: { label: 'Stand in for the groom', tile: 'chapel', out: [
      { w: 2, text: 'You say the vows and the whole village roars. You eat like a lord and dance until the fiddler’s strings give out.', food: 3 },
      { w: 1, text: 'You say the vows so sweetly that the bride weeps, the chaplain weeps and the pig very nearly weeps. By dawn every child in the parish knows your name.', trait: 'beloved' },
      { w: 1, text: 'Halfway through the vows the groom climbs back over the wall with his four brothers. You leave by way of the duckpond, and through it.', hp: -1 },
      { w: 1, text: 'Married, then. Your new in-laws are delighted with you, and every one of them needs a small loan.', gold: -8 },
    ] },
    right: { label: 'Go and find the groom', tile: 'orchard', out: [
      { w: 2, text: 'You find him up an apple tree, weeping about freedom, and talk him down. The bride’s father gives you a cheese the size of a cartwheel.', food: 3, renown: 1 },
      { w: 1, text: 'He is in the hayloft, and not alone. The miller’s daughter pays you handsomely never to have seen anything.', gold: 8 },
      { w: 1, text: 'He is hiding among the beehives. So, it turns out, are the bees.', hp: -1 },
    ] },
  },
  {
    id: 'f_runaway_apprentice', tier: 1,
    title: 'The Runaway Apprentice',
    text: 'A girl with singed eyebrows and a scorched apron rolls out of a hay cart at your feet. "Master Grudge beats us with the tongs," she whispers. Hooves behind: a red-faced smith is bellowing about a reward.',
    left: { label: 'Hide her in the woods', tile: 'forest', out: [
      { w: 3, text: 'Grudge thunders past. The girl says her name is Wren, and swears on her little hammer that one day she will forge you something fine.', flag: 'f_apprentice' },
      { w: 1, text: 'Grudge’s journeymen beat the bushes with cudgels. They drag Wren home and leave you a lump on the head. She looks back at you once.', hp: -1 },
    ] },
    right: { label: 'Claim the reward', tile: 'smithy', out: [
      { w: 3, text: 'Grudge pays you twelve gold and hauls her off by the ear. The coins are still warm from his forge.', gold: 12 },
      { w: 1, text: 'Grudge pays you in nails. "A reward’s a reward." By nightfall Wren has escaped again, and taken your purse with her.', gold: -6 },
    ] },
  },
  {
    id: 'f_stand_and_deliver', tier: [1, 2], biome: ['moor', 'wood', 'hills'],
    title: 'Stand and Deliver',
    text: 'A masked rider on a grey mare blocks the road, a slim sword resting on one shoulder. "Your purse or a dance," she says. "I warn you, the purse is quicker. But the dance is more fun."',
    left: { label: 'Dance with the highwayman', tile: 'road', out: [
      { w: 2, text: 'She dances like a flame and lifts your purse on the turn. Then she tosses it back, heavier. "For the music."', gold: 8 },
      { w: 1, text: 'She dances like a flame. When she has gone, your purse is lighter and your pack is full of somebody else’s sausages.', gold: -6, food: 2 },
      { w: 1, text: 'You tread on her foot. Twice. She is not amused.', fight: { foe: 'bandit', name: 'the Grey Rider', power: 4, dmg: 1,
        win: { text: 'You win the duel. She laughs, bows from the saddle and gallops off, leaving her own purse in the heather.', gold: 10 },
        lose: { text: 'She pricks you once for each toe and takes the purse after all.', gold: -8 } } },
    ] },
    right: { label: 'Draw on her', tile: 'road', fight: { foe: 'bandit', name: 'the Grey Rider', power: 5, dmg: 1,
      win: { text: 'Steel on steel, then a laugh. She tosses you her purse. "First to beat me since the gallows." By spring you are in three ballads.', gold: 12, renown: 2 },
      lose: { text: 'She disarms you with a flick, takes your purse, and leaves you a kiss on the cheek and a lump on the head.', gold: -8 } } },
  },
  {
    id: 'f_last_sheaf', tier: 1, biome: ['farm'],
    title: 'The Last Sheaf',
    text: 'The reapers of Barleyhithe will not cut the last sheaf of the harvest. The corn-mother hides in it, they say, and whoever cuts her down must carry her home. They offer you a loaf and a laugh to do it.',
    left: { label: 'Cut the last sheaf', tile: 'farm', out: [
      { w: 2, text: 'The sheaf sighs as it falls. They crown you with poppies and barley and feed you until you cannot see your own feet.', food: 3 },
      { w: 1, text: 'They plait the sheaf into a corn-doll and make you dance with it. Afterwards you feel as strong as the ox that pulled the last wain home.', trait: 'stout_heart' },
      { w: 1, text: 'The sheaf screams. Everyone stops laughing. Something small and furious runs up your sleeve and does not come out again.', trait: 'ill_luck' },
    ] },
    right: { label: 'Throw sickles with them', tile: 'bonfire', out: [
      { w: 3, text: 'Twenty sickles fly at once. Nobody knows whose cut it, so nobody is to blame. Then the bonfire, the ale and the dancing.', food: 2 },
      { w: 1, text: 'Your sickle goes wide and nicks the reeve’s ear. He takes the price of it out of your purse, loudly and at length.', gold: -6 },
    ] },
  },

  /* ---------- tier 2: steps 5-8 ---------- */
  {
    id: 'f_pellam_lists', tier: 2, needs: 'f_squire', w: 3,
    title: 'Pellam at the Lists',
    text: 'Ashby Green is all pavilions and pennants. Sir Pellam finds you at once, green to the ears. "My squire! I have eaten a bad eel and cannot ride. Take my shield and my name. Nobody looks under a helm."',
    left: { label: 'Ride as Sir Pellam', tile: 'tourney', fight: { foe: 'knight', name: 'Sir Ormund the Unbeaten', power: 7, dmg: 2,
      win: { text: 'Ormund goes over his horse’s tail. You lift your visor, the crowd gasps, and the Marshal of the Rose knights you on the spot for the sheer cheek of it.', trait: 'knighted', ally: 'knights' },
      lose: { text: 'You go over your horse’s tail. Pellam, much recovered, calls it the most moving fall he has ever seen.', gold: -5 } } },
    right: { label: 'Squire for him instead', tile: 'stable', out: [
      { w: 2, text: 'Pellam rides green and wins by pure accident. In his joy he gives you his second-best lance, and weeps.', item: 'lance' },
      { w: 2, text: 'Pellam is unhorsed in the first pass. You carry him off the field on your back, and the crowd cheers the squire louder than the knight.', renown: 2 },
      { w: 1, text: 'Pellam is unhorsed, and his creditors are in the stands. They take his armour, and look to his squire for the balance.', pay: 12 },
    ] },
  },
  {
    id: 'f_gallowfield', tier: 2, biome: ['moor', 'hills', 'farm'],
    title: 'A Hanging at Gallowfield',
    text: 'A crowd, a cart, a noose. The sheriff reads the charge: one poacher, one deer, the lord’s own wood. The poacher is a boy of fifteen. His mother stands in the front row, very quiet. The hangman is tying the knot badly.',
    left: { label: 'Cut him down', tile: 'gallows', out: [
      { w: 7, text: 'One slash, one leap, and the boy is off into the crowd, which closes behind him like water. Somewhere in the wood, someone takes note.', renown: 2, flag: 'f_poacher' },
      { w: 4, text: 'The sheriff’s men are quicker than the crowd.', fight: { foe: 'soldier', name: 'the Sheriff’s Men', power: 6, dmg: 2,
        win: { text: 'You hold them off long enough. The boy runs for the greenwood, and the greenwood will remember.', renown: 1, flag: 'f_poacher' },
        lose: { text: 'They beat you senseless and throw you out of the parish. You never learn what became of the boy.', gold: -8 } } },
      { w: 1, text: 'The sheriff is a practical man. There is a noose, and there is a neck, and now the neck is yours.', die: 'hanged at Gallowfield in a poacher’s place' },
    ] },
    right: { label: 'Pay for the deer', cost: 15, tile: 'gallows', out: [
      { w: 2, text: 'The sheriff weighs your purse against the boy and finds the purse heavier. The boy runs for the wood without a word of thanks.', renown: 1, flag: 'f_poacher' },
      { w: 1, text: 'The sheriff pockets your gold and hangs the boy anyway. "The deer’s paid for," he says. "The trespass isn’t."' },
    ], poor: { text: 'You turn out your pockets: not the price of a deer. The boy drops. His mother looks at you as if you were the hangman, and you cannot eat for a day.', food: -1 } },
  },
  {
    id: 'f_saint_wendreda', tier: 2,
    title: 'The Bell of Saint Wendreda',
    text: 'The abbey of Saint Wendreda rings its bell for every traveller who knocks, and bills them later. Beyond the hospice lies a cloister so cold your breath hangs in it, where a novice is scrubbing blood from the flagstones.',
    left: { label: 'Knock at the hospice', tile: 'abbey', shop: 'temple', out: [
      { text: 'Brother Hobb checks your tongue, your pulse and your purse, in that order, then unlocks the healing cupboard.' },
    ] },
    right: { label: 'Ask about the blood', tile: 'crypt', out: [
      { w: 2, text: 'It is the abbess’s own: she kneels on thorns for the sins of passing pilgrims. Touched that you asked, she writes you a letter to the bishops.', ally: 'church' },
      { w: 1, text: 'It is a pig’s. The sisters are making black pudding, and they give you three, and a long lecture on curiosity.', food: 3 },
      { w: 1, text: 'The blood is fresh. Something in the crypt has been feeding on the novices, and they hand you a candle and a push.', fight: { foe: 'wraith', name: 'the Crypt-Thing', power: 7, dmg: 2,
        win: { text: 'You drive it back into its tomb and the abbess seals it with wax and prayer. The abbey rings its bell for you, and sends no bill.', ally: 'church', renown: 2 },
        lose: { text: 'It sups on you a while before the sisters drag you out by the ankles. They nurse you, a little guiltily.', hp: 1 } } },
    ] },
  },
  {
    id: 'f_pardoner', tier: 2,
    title: 'The Pardoner’s Tray',
    text: 'Under a yew by the road a pardoner has spread his tray: saints’ knucklebones, a phial of Saint Aldwyn’s tears, a feather from the dove that carried the first Dawn. "Fifteen gold a relic, and every one of them true."',
    left: { label: 'Buy a knucklebone', cost: 15, tile: 'shrine', out: [
      { w: 2, text: 'You choose the ugliest bone. It hums against your chest, and in the next churchyard the dead lie very still as you pass.', relic: 'salt' },
      { w: 2, text: 'It is a pig’s knuckle, and not even a holy pig. By the time you find the butcher’s mark, the pardoner is two villages away.' },
      { w: 1, text: 'The bone is warm in your hand. Some weight you have carried since the last crossroads slides off you like a wet cloak.', lift: true, relic: 'pilgrim_badge' },
    ], poor: { text: 'Penniless, you kiss a bone for free. He swears it cures poverty. Your lips go numb for three days, and so does your stomach.', food: -1 } },
    right: { label: 'Denounce the fraud', tile: 'village', out: [
      { w: 2, text: 'You name the butcher. The crowd takes back its pennies and the pardoner flees, leaving his tray, which boils up into a fine pork stew.', gold: 6, food: 2 },
      { w: 1, text: 'The crowd likes its saints. They run you out of the village with rotten apples, and one stone.', hp: -1 },
      { w: 1, text: 'The pardoner takes you aside and pays you, generously, to hush. "Every trade has its saints," he says, "and its martyrs."', gold: 12 },
    ] },
  },
  {
    id: 'f_singing_smith', tier: 2, biome: ['hills'],
    title: 'The Singing Smith',
    text: 'The smith of Anvilford is a woman seven feet tall who sings to her iron in a voice like a bronze bell. Her blades are fine, and dear. A sign on her door reads: BEAT MAUD AT ARM-WRESTLING, TAKE ANYTHING ON THE WALL.',
    left: { label: 'Look over her wares', tile: 'smithy', shop: 'smith', out: [
      { text: 'She stops singing long enough to name her prices, which rhyme. The swords on her rack hum along as you pass.' },
    ] },
    right: { label: 'Arm-wrestle Big Maud', tile: 'smithy', fight: { foe: 'champion', name: 'Big Maud', power: 7, dmg: 1,
      win: { text: 'Her knuckles hit the anvil with a clang they hear two villages away. Maud roars laughing and takes down her best hammer. "Earned, {lad}."', item: 'warhammer' },
      lose: { text: 'Your knuckles hit the anvil, and your elbow makes a noise like a snapped twig. Maud sings you a lullaby by way of apology.' } } },
  },
  {
    id: 'f_chalk_crosses', tier: 2, biome: ['fen', 'farm', 'lake'],
    title: 'The Chalk Crosses',
    text: 'Every door in Nethercombe bears a chalk cross, and the chapel bell tolls with nobody pulling the rope. The road runs straight through the village; going round means a day in the fen. At one high window, a child waves.',
    left: { label: 'Go through the village', tile: 'village', out: [
      { w: 2, text: 'You hurry through with your sleeve over your mouth. A dying baker begs you to take her last loaves rather than leave them to the rats.', food: 3 },
      { w: 1, text: 'The child’s family is gone. You stay a week, nursing and burying, and never sicken. Downriver, they are already singing about you.', food: -1, trait: 'beloved' },
      { w: 1, text: 'The fever finds you on the far side of the village. It takes a week and something more, and you leave thinner in every way.', maxhp: -1, hp: -1 },
    ] },
    right: { label: 'Go round by the fen', tile: 'swamp', out: [
      { w: 2, text: 'A long day’s wading. The fen takes one boot, most of your bread and all of your good temper.', food: -2 },
      { w: 1, text: 'In the reeds you meet a herb-wife who also went round. She trades you a pouch of healing moss for news of the road.', relic: 'moss' },
      { w: 1, text: 'A punt, a lantern, a ferryman who asks no fare. He poles you through the fen by night, tells you one thing about your road, and is gone.', sight: 1 },
    ] },
  },
  {
    id: 'f_never_loses', tier: [2, 3],
    title: 'The Gambler Who Never Loses',
    text: 'In the corner of the Drowned Man sits a gentleman in grey who has not lost a throw in forty years, the landlord says, nor aged a day. He pushes the dice across to you. "Stake your gold, friend. Or stake your luck."',
    left: { label: 'Stake your gold', cost: 15, tile: 'tavern', out: [
      { w: 2, text: 'He loses. He stares at the dice as if they had bitten him, then pays you in old coin stamped with a dead king’s face.', gold: 30 },
      { w: 2, text: 'He wins. Of course he wins. He buys you supper out of your own stake, which is almost kind.', food: 2 },
      { w: 1, text: 'You win, then win again. "Double or nothing?" You nod before you can stop yourself, and lose, and he names the debt with a gentle smile.', pay: 10 },
    ], poor: { text: 'No coin? He shrugs and plays you for a lock of your hair. He wins it, and you feel the cold of its going for a day.', hp: -1 } },
    right: { label: 'Stake your luck', tile: 'tavern', out: [
      { w: 2, text: 'Double six. He laughs for the first time in forty years and slides a ring off his finger. "Take it. It never liked me."', relic: 'fox_ring' },
      { w: 2, text: 'Snake eyes. He reaches across and takes something you cannot see. Every coin you touch afterwards feels lighter.', trait: 'leaden_purse' },
      { w: 1, text: 'The dice land on their corners, both of them, and stay there. The landlord throws you both out for witchcraft.' },
    ] },
  },
  {
    id: 'f_mocking_minstrel', tier: 2,
    title: 'The Mocking Minstrel',
    text: 'A minstrel in the market square is singing a very rude song about a traveller who looks exactly like you: the same boots, the same nose, the same unfortunate business with a goose. The crowd is weeping with laughter.',
    left: { label: 'Sing a ruder one back', tile: 'market', out: [
      { w: 1, text: 'You rhyme "minstrel" with something unrepeatable. The crowd roars. The minstrel bows, beaten, and teaches you the trick of it over ale.', trait: 'silver_tongue' },
      { w: 2, text: 'You cannot sing. The crowd pelts you with cabbages, which you gather up afterwards. Supper is supper.', food: 2 },
      { w: 1, text: 'Your verse is so cruel the minstrel bursts into tears, then the crowd does, then you do. They see you out of town with sticks.', hp: -1 },
    ] },
    right: { label: 'Laugh along with them', tile: 'tavern', out: [
      { w: 2, text: 'You laugh loudest of all. Delighted, the minstrel adds a verse in which the goose loses, and passes his hat round for you.', gold: 6, renown: 1 },
      { w: 1, text: 'By the next town the song has three new verses, and children honk at you in the street. Fame is fame.', renown: 2 },
      { w: 1, text: 'While you laugh, his partner picks your purse. Minstrels travel in pairs, like magpies.', gold: -8 },
    ] },
  },
  {
    id: 'f_barons_table', tier: 2,
    title: 'The Baron’s Table',
    text: 'Baron Mortlake keeps open table: any traveller may eat in his hall who will taste his wine first, or fight his champion after. His last three tasters sit at the end of the bench, very pale and very still. The venison smells wonderful.',
    left: { label: 'Taste the baron’s wine', tile: 'manor', out: [
      { w: 3, text: 'It is only wine, and excellent. The baron claps your back: there is a place at his table for you any time, and a place beneath his banner.', food: 3, ally: 'lords' },
      { w: 1, text: 'The wine is good. The cup is not: its rim tastes of bitter almonds. You lie in the rushes a day and a night, sweating like a cheese.', hp: -2 },
    ] },
    right: { label: 'Fight his champion', tile: 'castle', fight: { foe: 'champion', name: 'the Baron’s Champion', power: 7, dmg: 2,
      win: { text: 'The champion yields with your boot on his chest. The baron roars his approval and gives you the champion’s mail, still warm.', item: 'chain' },
      lose: { text: 'You are carried out and fed in the kitchen with the dogs, who prove better company than the baron.', food: 2 } } },
  },
  {
    id: 'f_crooked_rushlight', tier: [2, 3],
    title: 'The Crooked Rushlight',
    text: 'Behind the ale-casks of the Crooked Rushlight is a door, and behind the door a room full of other people’s things: swords, chalices, a bishop’s crook, a harp still warm from someone’s hands. A one-eyed woman sets the prices.',
    left: { label: 'Browse the back room', tile: 'tavern', shop: 'fence', out: [
      { text: 'She shows you the goods by the light of a stolen altar-candle, and swears on each piece that it isn’t stolen.' },
    ] },
    right: { label: 'Tip off the sheriff', tile: 'prison', out: [
      { w: 2, text: 'The sheriff raids the Rushlight at midnight and pays you a tenth of the haul, grudgingly, in coin that was probably part of it.', gold: 20 },
      { w: 1, text: 'The one-eyed woman is the sheriff’s sister. You spend a night in his gaol, and in the morning you are fined for slander.', pay: 15 },
      { w: 1, text: 'The raid finds an empty room. That night a quiet man sits beside you in the dark and explains, gently, what informers are paid.', gold: -12, hp: -1 },
    ] },
  },

  /* ---------- tier 3: steps 9-12 ---------- */
  {
    id: 'f_wrens_forge', tier: 3, needs: 'f_apprentice', w: 3,
    title: 'The Sign of the Wren',
    text: 'Over a new forge hangs a sign: a wren holding a hammer. The smith inside has singed eyebrows and a master’s apron, and she drops her tongs at the sight of you. "{name}! I swore I’d forge you something. Sit. It’ll take all night."',
    left: { label: 'Ask for a blade', tile: 'smithy', out: [
      { w: 3, text: 'At dawn she lays it across your knees: a greatsword with a wren at the hilt and runes down the blade, sharp enough to split a raindrop.', item: 'runeblade' },
      { w: 1, text: 'Old Grudge comes in the night to smash his runaway’s anvil. You throw him out into the rain, but the blade is spoilt, so she gives you her own hammer.', item: 'warhammer', hp: -1 },
    ] },
    right: { label: 'Ask for armour', tile: 'smithy', out: [
      { w: 3, text: 'She hammers you a hauberk of little scales like a wren’s breast, each one stamped with her mark. It fits like a promise kept.', item: 'scale' },
      { w: 1, text: 'She is out of iron, so she gives you what she has: bread, beer and a night by her fire, talking over old times. It turns out you have some.', food: 3, hp: 1 },
    ] },
  },
  {
    id: 'f_greenhood', tier: 3, needs: 'f_poacher', w: 3, biome: ['wood'],
    title: 'The Greenhood Remembers',
    text: 'Two arrows thud into the tree beside your head, very precisely. A lanky youth drops from a branch: the poacher from Gallowfield, taller now, in a moss-green hood. "You’re wanted by the sheriff," he grins. "And by us."',
    left: { label: 'Go to the outlaws’ camp', tile: 'camp', out: [
      { w: 3, text: 'They feast you on the lord’s venison and swear you in by firelight. When your hour comes, they promise, the greenwood will rise with you.', food: 3, ally: 'rebels' },
      { w: 1, text: 'The sheriff’s riders fall on the camp that same night.', fight: { foe: 'soldier', name: 'the Sheriff’s Riders', power: 10, dmg: 2,
        win: { text: 'The riders break and flee. The outlaws swear you in with the blood still on your hands.', ally: 'rebels' },
        lose: { text: 'You lose the outlaws in the dark and spend the night in a badger sett, with a badger who resents it.', food: -2 } } },
    ] },
    right: { label: 'Take his gift and go', tile: 'forest', out: [
      { w: 2, text: 'He fills your pack with venison and a purse of the lord’s silver, and walks you safely to the edge of the wood.', gold: 20, food: 2 },
      { w: 1, text: 'His mother sends a clean shirt, a kiss for your cheek and a honey-cake that mends you like a week of sleep.', hp: 2 },
      { w: 1, text: 'The sheriff’s men are waiting at the edge of the wood. They take the venison, the silver, and a fine for good measure.', gold: -15 },
    ] },
  },
  {
    id: 'f_dry_well', tier: 3, biome: ['hills', 'moor', 'snow', 'waste'],
    title: 'The Hermit of the Dry Well',
    text: 'At the end of the old pilgrims’ road a hermit keeps a well that has been dry for three hundred years. Pilgrims still come to drop coins and pray for water. The hermit watches you with eyes the colour of rain. "Thirsty?"',
    left: { label: 'Climb down the well', tile: 'well', out: [
      { w: 3, text: 'Sixty feet down, the well is carpeted with three hundred years of pilgrims’ coins. You climb out richer and very cold.', gold: 25 },
      { w: 2, text: 'The rope frays. You land hard among the coins and climb out on bleeding fingers, a few pennies the richer.', hp: -2, gold: 8 },
      { w: 1, text: 'In the dust at the bottom stands a plain wooden cup. When you lift it the well fills from below and bears you up, laughing, into the light.', relic: 'grail' },
    ] },
    right: { label: 'Keep vigil with him', tile: 'hermitage', out: [
      { w: 2, text: 'He shares his water, drawn from somewhere he will not show you. It is cold, tastes of stone, and stops your bones aching.', hp: 2 },
      { w: 1, text: 'You watch the stars wheel all night. At dawn he tells you which roads not to take, and why.', hp: 1, sight: 2 },
      { w: 1, text: 'He talks all night about the Grail and the fools who seek it, and eats your bread while he does it. His blessing is sincere, at least.', food: -2 },
    ] },
  },
  {
    id: 'f_black_hal', tier: 3, biome: ['moor', 'hills', 'waste'],
    title: 'The Highwayman King',
    text: 'Black Hal’s gibbet on the Crow Road hangs empty, which is bad news: he has climbed out of it again. His riders hold the road now, and Hal holds court in a roofless tollhouse, taking what he calls half of every purse.',
    left: { label: 'Pay Hal’s half', tile: 'tollgate', out: [
      { w: 3, text: 'A rider with a velvet bag takes a fat handful of your coin, counts it twice, and waves you on with a flourish.', gold: -18 },
      { w: 1, text: 'Hal takes his half, then raises a cup to you. "Nobody pays me cheerfully any more." He sends you off with a haunch of mutton and a song.', gold: -18, food: 3, renown: 1 },
    ] },
    right: { label: 'Call out Black Hal', tile: 'ruins', fight: { foe: 'brigand', name: 'Black Hal', power: 12, dmg: 2, elite: true,
      win: { text: 'Hal goes down laughing, which is worse than cursing. Under the tollhouse floor lie forty years of other people’s purses.', gold: 40, renown: 2 },
      lose: { text: 'Hal beats you, empties your purse, and hangs you in his own gibbet for an hour, "for the education".', gold: -20 } } },
  },
  {
    id: 'f_sin_eater', tier: 3,
    title: 'The Sin-Eater',
    text: 'In Hollins they lay a loaf and a cup of ale on a dead man’s chest and pay a stranger to eat them, sins and all. Old Tobiah was a hard man; his widow offers a whole purse. His face in the coffin is not at peace.',
    left: { label: 'Eat the dead man’s sins', tile: 'graveyard', out: [
      { w: 2, text: 'The bread is stale, the ale is flat, and afterwards Tobiah’s face goes smooth as a child’s. His widow pays you, weeping, and blesses you.', gold: 25 },
      { w: 1, text: 'Halfway through the loaf you taste it: an oath sworn on a sword and sold for silver. It is yours now. The widow pays without meeting your eye.', gold: 25, trait: 'oathbreaker' },
      { w: 1, text: 'Tobiah sits up in his coffin and wants his sins back.', fight: { foe: 'ghost', name: 'Old Tobiah', power: 10, dmg: 2,
        win: { text: 'You wrestle the old man back to his rest, sins and all. The widow pays double, out of sheer relief.', gold: 40 },
        lose: { text: 'Tobiah chases you out of Hollins in his shroud, and the whole village chases you further.', food: -1 } } },
    ] },
    right: { label: 'Dig his grave instead', tile: 'chapel', out: [
      { w: 2, text: 'Hard ground and a harder widow: she pays a sexton’s wage and feeds you in the kitchen, grudgingly but well.', gold: 8, food: 2 },
      { w: 1, text: 'Six feet down your spade strikes an older coffin. In it lies a knight nobody remembers, and a slender sword that has never rusted.', item: 'elvenblade' },
      { w: 1, text: 'The ground is iron and so is the widow. You dig all day for a bowl of thin broth and a blister the size of a coin.', hp: -1 },
    ] },
  },
  {
    id: 'f_poor_likeness', tier: 3,
    title: 'A Poor Likeness',
    text: 'Your face is on a poster nailed to the mill door at Crowmarket, above the words HIGHWAY ROBBERY. It is not a good likeness, but it is not a bad one either, and the sheriff is standing beside it with six deputies. "That’s the one."',
    left: { label: 'Go quietly', tile: 'prison', out: [
      { w: 2, text: 'Three nights in a cell with a poet. The magistrate sees the mistake at once, and fines you anyway, for the cost of the poster.', pay: 15 },
      { w: 1, text: 'The magistrate squints at you, then at the poster, then at you. He lets you go with an apology and a letter of good character.', renown: 2 },
      { w: 1, text: 'In the next cell is the real highwayman, who is charming, and who breaks out that night, and takes you with him, and shares.', gold: 20 },
    ] },
    right: { label: 'Fight the deputies', tile: 'mill', fight: { foe: 'soldier', name: 'the Sheriff’s Deputies', power: 10, dmg: 2,
      win: { text: 'Six deputies in the millpond and the sheriff up the mill-sail. You leave on his horse, with his saddlebags.', gold: 20 },
      lose: { text: 'They drag you in by the heels. The magistrate looks at your bruises, then at your purse, and keeps the purse.', gold: -15 } } },
  },
  {
    id: 'f_gilded_caravan', tier: 3,
    title: 'The Gilded Caravan',
    text: 'Forty mules, twenty guards and a litter hung with cloth of gold: a merchant princess of the Gilded Company is crossing {kingdom}. Her factor looks you over. He will pay a guard’s wage, or sell you a share in the venture.',
    left: { label: 'Buy a share', cost: 25, tile: 'market', out: [
      { w: 2, text: 'The pepper sells for thrice its weight in silver. The factor counts out your share with a face like a lemon.', gold: 45 },
      { w: 2, text: 'The venture fails: bandits, rain, and a mule that ate the saffron. The factor offers his condolences, and nothing else.' },
      { w: 1, text: 'The venture thrives, and the princess takes a liking to you. You get your share, her seal, and a seat at the Company’s table.', gold: 15, relic: 'merchant_seal', ally: 'merchants' },
    ], poor: { text: '"No coin, no share," says the factor, and sets you to shovelling mule dung for a day, for no pay and no supper.', food: -1 } },
    right: { label: 'Guard the caravan', tile: 'road', out: [
      { w: 2, text: 'Ten days of dust and mule-song, and nothing attacks. You are paid in coin and dried figs.', gold: 15, food: 2 },
      { w: 1, text: 'Brigands hit the caravan at the ford.', fight: { foe: 'bandit', name: 'the Ford Brigands', power: 10, dmg: 2,
        win: { text: 'You hold the ford. The princess herself leans out of her litter and tosses you a purse without looking.', gold: 30 },
        lose: { text: 'The brigands scatter the mules, and you with them. The factor docks your wage for the saffron.', gold: -10 } } },
    ] },
  },
  {
    id: 'f_fairground_giant', tier: 3, biome: ['hills', 'farm'],
    title: 'The Fairground Giant',
    text: 'At Wickmoot Fair a showman charges a penny to see THE LAST GIANT OF THE HILLS: a boy twelve feet tall, chained in a cage and weeping quietly. Anyone who lasts three rounds with him wins fifty gold. The showman whips him to make him roar.',
    left: { label: 'Step into the ring', tile: 'tourney', fight: { foe: 'giant', name: 'the Weeping Giant', power: 11, dmg: 2,
      win: { text: 'You last three rounds. You suspect he let you. The showman pays up with a face like curdled milk, and the crowd carries you round the fair.', gold: 50, renown: 2 },
      lose: { text: 'He catches you like a doll and sets you down very gently. The showman charges you for the entertainment.', gold: -10 } } },
    right: { label: 'Free him by night', tile: 'mountain', out: [
      { w: 2, text: 'You pick the lock at moonrise. He carries you home to the hills on his shoulder, singing, and his mother bakes you a loaf as big as a door.', food: 4, renown: 2 },
      { w: 1, text: 'The showman’s bully-boys wake as the lock clicks. The giant sits on two of them. The third lays you out with a cudgel.', hp: -1, renown: 2 },
      { w: 1, text: 'He is free. In his joy he hugs you, and something inside you cracks, and you find you do not mind at all.', hp: -1, renown: 3 },
    ] },
  },
];
