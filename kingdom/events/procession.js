// Kingdom: the procession. Once the crown is won, four more choices carry you through the royal city to the throne:
// how you enter it, what you do in its streets, how you deal with those who stood against you, and how you are crowned.
// None of them can cost you the crown now. What they decide is the kind of ruler you are (virtue: the one you show most
// names your reign), what you leave your heir (heir: allies, renown, gold; treasury: the royal purse), and what becomes
// of the realm after you (after: weights for a usurper, the lords at war, or a peaceful old age).
// The tile the last choice leads to becomes the throne room.
export default [
  /* ---------------- 1. the gates ---------------- */
  { id: 'p_gates', stage: 1,
    title: 'The Gates of {capital}',
    text: 'The great gates of {capital} stand open for you, and the whole city is up on the walls. A white charger waits in cloth of gold. Beside it waits a crowd of ordinary folk, hoping you will walk.',
    left: { label: 'Ride in on the charger', tile: 'city_gate', out: [
      { w: 3, text: 'Trumpets, silk, and a horse that knows exactly how splendid it is. The city roars as you pass under the arch.', virtue: 'splendor', renown: 2 },
      { w: 1, text: 'The charger shies at a thrown rose and nearly has you off. The roar has a laugh in it, but a fond one.', virtue: 'splendor' },
    ] },
    right: { label: 'Walk in with the people', tile: 'street', out: [
      { w: 3, text: 'Hands reach to touch your sleeve. A baker presses a warm loaf on you, and a child rides your shoulders as far as the first square.', virtue: 'love', heir: { renown: 1 } },
      { w: 1, text: 'It takes three hours to walk one mile. Nobody minds, least of all you.', virtue: 'love' },
    ] } },
  { id: 'p_keys', stage: 1,
    title: 'The Keys of the City',
    text: 'At the gatehouse, the Lord Mayor of {capital} kneels with the city keys on a velvet cushion. Under them, rolled tight, lies the guilds’ petition: their old charters, their old rights, their old taxes.',
    left: { label: 'Take the keys and the petition', tile: 'market', out: [
      { w: 2, text: 'You promise to read it, and you do, that night, every word. The guilds will not forget it.', virtue: 'justice', heir: { ally: 'merchants' } },
      { w: 1, text: 'The petition runs to forty pages and asks for a great deal. You grant half, and please everyone a little.', virtue: 'justice', treasury: -20 },
    ] },
    right: { label: 'Take the keys; burn the petition', tile: 'bonfire', out: [
      { w: 2, text: 'The parchment curls up in the brazier. "The city’s rights," you say, "are what its ruler says they are." The treasury will be fuller for it.', virtue: 'might', treasury: 60 },
      { w: 1, text: 'The Lord Mayor does not blink. The guilds pay every tax you ask, and never lend your line a penny again.', virtue: 'might', treasury: 40, after: { chaos: 10 } },
    ] } },
  { id: 'p_banners', stage: 1, realm: 'tyrant', w: 2,
    title: 'The Tyrant’s Banners',
    text: 'Black banners with {ruler}’s sigil still hang from every tower in {capital}. The crowd looks from the banners to you, and waits to see what kind of ruler has come.',
    left: { label: 'Tear them down and burn them', tile: 'bonfire', out: [
      { w: 3, text: 'The bonfire burns all afternoon, and people dance round it who have not danced in twenty years.', virtue: ['might', 'love'] },
      { w: 1, text: 'The fire jumps to a tannery. You pay for the damage out of the royal purse, and nobody minds the smell.', virtue: 'might', treasury: -30 },
    ] },
    right: { label: 'Fold them away for history', tile: 'palace', out: [
      { w: 2, text: '"Let our children see what we lived under," you say. The chroniclers weep, and so does a woman whose husband those banners hanged.', virtue: 'justice' },
      { w: 1, text: 'Some take it for softness. In the tyrant’s old strongholds, men begin to whisper.', virtue: 'justice', after: { tyrant: 15 } },
    ] } },
  { id: 'p_hostages', stage: 1, realm: 'chaos', w: 2,
    title: 'The Warlords’ Children',
    text: 'In the gatehouse tower sit the children of every warlord who fought over {kingdom}, hostages for their parents’ good behaviour. The eldest is fourteen, and watches you like a wolf.',
    left: { label: 'Send them home to their families', tile: 'road', out: [
      { w: 2, text: 'The children ride home with gifts. Their astonished parents send back oaths of loyalty, and mean them.', virtue: 'mercy', after: { old: 15 } },
      { w: 1, text: 'The eldest rides home and raises his father’s banner again within the year.', virtue: 'mercy', after: { chaos: 20 } },
    ] },
    right: { label: 'Raise them as wards of the crown', tile: 'palace', out: [
      { w: 2, text: 'They grow up at your court, and grow up yours. A generation on, the warlords’ heirs are your heir’s friends.', virtue: 'cunning', heir: { ally: 'lords' } },
      { w: 1, text: 'Hostages make for obedient parents and bitter children.', virtue: 'cunning', after: { tyrant: 10 } },
    ] } },
  { id: 'p_bells', stage: 1, realm: 'old', w: 2,
    title: 'The Funeral Bells',
    text: '{Ruler} is to be buried on the very morning you are to be crowned. The funeral bells and the coronation bells are the same bells, and the ringers want to know which to ring first.',
    left: { label: 'Walk behind the coffin', tile: 'cathedral', out: [
      { w: 3, text: 'You walk bareheaded behind the old {monarch}, in the rain. The court sees it, and so does the whole city.', virtue: ['piety', 'love'] },
      { w: 1, text: 'The service is very long. You are crowned at dusk, by candlelight, which the painters love.', virtue: 'piety', renown: 1 },
    ] },
    right: { label: 'Ring for the crowning first', tile: 'street', out: [
      { w: 2, text: '"The realm cannot wait on the dead." It is true, everyone knows it, and some of them will never forgive it.', virtue: 'might', treasury: 30 },
      { w: 1, text: 'The old {monarch}’s friends slip out of the city before the bells stop ringing.', virtue: 'might', after: { chaos: 15 } },
    ] } },

  /* ---------------- 2. the streets ---------------- */
  { id: 'p_condemned', stage: 2,
    title: 'The Condemned',
    text: 'In the great square a gallows waits with a line of prisoners before it: thieves, poachers, a forger, a man who struck a lord. By old custom, a new ruler may pardon anyone on the day of the crowning.',
    left: { label: 'Pardon them all', tile: 'gallows', out: [
      { w: 2, text: 'The ropes are cut to a roar you will remember on your deathbed.', virtue: ['mercy', 'love'] },
      { w: 1, text: 'Among the pardoned is a man who had earned his rope twice over. Within the month, he has earned it again.', virtue: 'mercy', after: { chaos: 10 } },
    ] },
    right: { label: 'Let the law take its course', tile: 'prison', out: [
      { w: 2, text: 'You pardon the poachers and let the rest hang. It is not popular. It is, the judges say, just.', virtue: 'justice' },
      { w: 1, text: 'The crowd goes quiet as the first trap drops. Quiet crowds remember.', virtue: 'justice', after: { tyrant: 10 } },
    ] } },
  { id: 'p_silver', stage: 2,
    title: 'Silver for the Crowd',
    text: 'The streets are packed from wall to wall, every face turned up to you. The royal almoner rides at your side with a chest of new silver, stamped with a face that is not quite yours yet.',
    left: { label: 'Scatter silver as you ride', cost: 25, tile: 'street', out: [
      { text: 'Silver rains down on the crowd and the crowd roars back. The street singers will be at it for years.', virtue: ['generosity', 'love'], heir: { renown: 1 } },
    ], poor: { text: 'Your own purse is empty, so you throw what you have: buttons, a ribbon, a boot-lace. They cheer anyway, bless them.', virtue: 'love' } },
    right: { label: 'Promise bread instead', tile: 'market', out: [
      { w: 2, text: '"Bread in every parish before the frost," you proclaim. It is cheaper than silver, and better remembered, so long as you keep your word.', virtue: 'cunning', treasury: -20 },
      { w: 1, text: 'The promise is cheered, then forgotten, then remembered at the worst possible moment.', virtue: 'cunning', after: { chaos: 10 } },
    ] } },
  { id: 'p_widow', stage: 2,
    title: 'The Widow in the Road',
    text: 'A widow throws herself before your horse. Her son was hanged by the old order for a theft he never did, and she holds his boots in her arms. The procession stops. Everyone is watching you.',
    left: { label: 'Climb down and hear her', tile: 'street', out: [
      { w: 3, text: 'You kneel in the road beside her. Before the procession moves on, her son is declared innocent by royal decree.', virtue: ['justice', 'love'] },
      { w: 1, text: 'She is a player, paid to slow you down, and while you kneel someone steals the royal standard. The crowd finds it very funny.', virtue: 'justice', renown: -1 },
    ] },
    right: { label: 'Send her a purse and ride on', tile: 'street', out: [
      { w: 2, text: 'The almoner gives her a purse of gold. She takes it, and spits on the cobbles where your horse has passed.', virtue: 'generosity', treasury: -15 },
      { w: 1, text: 'She takes the purse and buries her son properly. Years later her grandson becomes your heir’s most loyal captain.', virtue: 'generosity', heir: { ally: 'rebels' } },
    ] } },
  { id: 'p_crossbow', stage: 2,
    title: 'A Crossbow in the Crowd',
    text: 'On a balcony above the street, something glints: a crossbow, and a face you almost know. Your guards haven’t seen it. You have perhaps a heartbeat.',
    left: { label: 'Throw yourself from the saddle', tile: 'street', out: [
      { w: 2, text: 'The bolt hums through the place your chest just was. You roll to your feet in the muck as the guards drag the archer down. The city will talk of your nerve for years.', virtue: 'might', renown: 2 },
      { w: 1, text: 'The bolt misses. The cobbles don’t. You are crowned with a bandaged head.', virtue: 'might', hp: -1 },
    ] },
    right: { label: 'Keep smiling and ride on', tile: 'street', out: [
      { w: 2, text: 'The bolt strikes your breastplate and skitters away. You do not so much as look up. Nobody in the kingdom ever forgets it.', virtue: 'splendor', renown: 3 },
      { w: 1, text: 'A guard throws himself in front of the bolt. You make his widow a baroness.', virtue: ['splendor', 'generosity'], treasury: -20 },
    ] } },
  { id: 'p_feast', stage: 2,
    title: 'Two Feasts',
    text: 'The royal kitchens can manage one great feast tonight, not two. The lords expect to dine in the great hall. The city expects to dine in the squares.',
    left: { label: 'Feast the city in the squares', tile: 'bonfire', out: [
      { w: 3, text: 'Oxen roast in every square in {capital}. The lords eat cold pie and sulk, and the people sing your name till dawn.', virtue: ['generosity', 'love'], treasury: -40 },
      { w: 1, text: 'The feast is glorious. The riot after it, somewhat less so.', virtue: 'generosity', treasury: -50 },
    ] },
    right: { label: 'Feast the lords in the hall', tile: 'palace', out: [
      { w: 2, text: 'Swans, peacocks, and a pie with live blackbirds in it. The lords go home drunk and loyal.', virtue: 'splendor', heir: { ally: 'lords' } },
      { w: 1, text: 'The lords feast, the city hears of it, and the city is not pleased.', virtue: 'splendor', after: { chaos: 10 } },
    ] } },

  /* ---------------- 3. those who stood against you ---------------- */
  { id: 'p_fallen_tyrant', stage: 3, realm: 'tyrant', w: 2,
    title: 'The Fallen Tyrant',
    text: '{Ruler} kneels in chains on the palace steps, where so many were hanged at their word. The crowd is shouting for the rope. {Ruler} is looking only at you.',
    left: { label: 'Hang them from the palace gate', tile: 'gallows', out: [
      { w: 2, text: 'It is quick, and it is what the city wanted. No one will ever follow that banner again.', virtue: ['justice', 'might'], after: { old: 10 } },
      { w: 1, text: 'The tyrant dies well, which nobody expected, and a few songs are written about it that you would rather had not been.', virtue: 'might', after: { chaos: 5 } },
    ] },
    right: { label: 'Exile them across the sea', tile: 'ferry', out: [
      { w: 2, text: 'A fishing boat, a fair wind and a promise never to return. The crowd is angry, then thoughtful, then oddly proud of you.', virtue: 'mercy' },
      { w: 1, text: 'The tyrant sails away. Their grandchildren sail back.', virtue: 'mercy', after: { tyrant: 25 } },
    ] } },
  { id: 'p_last_warlord', stage: 3, realm: 'chaos', w: 2,
    title: 'The Last Warlord Kneels',
    text: '{Warlord}, the last of them, kneels at the foot of the palace stair with a sword laid across both palms. Their army is camped outside the walls, waiting to hear which way this goes.',
    left: { label: 'Take their oath and their army', tile: 'war_camp', out: [
      { w: 2, text: 'The army of your last enemy becomes the army of the crown. It is enormous, and for now it is yours.', virtue: ['mercy', 'cunning'], heir: { ally: 'knights' } },
      { w: 1, text: 'An oath sworn at swordpoint is kept at swordpoint.', virtue: 'mercy', after: { tyrant: 20 } },
    ] },
    right: { label: 'Take their lands and their head', tile: 'gallows', out: [
      { w: 2, text: 'Their lands go to your friends and their head goes over the gate. Nobody raises a banner against you again.', virtue: 'might', treasury: 50 },
      { w: 1, text: 'Their army melts into the hills and becomes the bandits of the next forty years.', virtue: 'might', after: { chaos: 20 } },
    ] } },
  { id: 'p_rival_kneels', stage: 3, realm: 'old', w: 2,
    title: 'The Rival Kneels',
    text: '{Rival} kneels with the other lords of {kingdom}, a little more slowly than the rest. Their eyes, when they rise again, are carefully empty.',
    left: { label: 'Make them your Chancellor', tile: 'palace', out: [
      { w: 2, text: 'Keep your enemies closer. The rival makes an excellent Chancellor, which is its own kind of worry.', virtue: ['cunning', 'mercy'], treasury: 40 },
      { w: 1, text: 'The rival serves you faithfully all your days, and plots only against your heir.', virtue: 'cunning', after: { tyrant: 25 } },
    ] },
    right: { label: 'Send them to guard the border', tile: 'watchtower', out: [
      { w: 2, text: 'An honour, and a very long way away. The rival goes with good grace, and stays gone.', virtue: 'justice', after: { old: 10 } },
      { w: 1, text: 'Out on the border they make friends with every discontented baron in the Marches.', virtue: 'justice', after: { chaos: 15 } },
    ] } },
  { id: 'p_oath', stage: 3,
    title: 'The Oath at the Cathedral Door',
    text: 'At the cathedral door the Archbishop holds out two things for you to swear upon: the bones of Saint Aldwyn in a silver casket, and the plain sword that won you this day.',
    left: { label: 'Swear on the saint’s bones', tile: 'cathedral', out: [
      { w: 3, text: 'The casket is cold under your hand. The Church takes you to its heart, and will take your heir too.', virtue: 'piety', heir: { ally: 'church' } },
      { w: 1, text: 'The casket turns out to hold the bones of a sheep. The Archbishop is mortified; the people are delighted.', virtue: 'piety', renown: 1 },
    ] },
    right: { label: 'Swear on your sword', tile: 'tourney', out: [
      { w: 3, text: 'Steel under your palm. Every knight in the cathedral grips their own hilt without meaning to.', virtue: 'might', heir: { ally: 'knights' } },
      { w: 1, text: 'The Archbishop purses their lips. The Church will remember that you preferred iron.', virtue: 'might', after: { chaos: 5 } },
    ] } },
  { id: 'p_treasury', stage: 3,
    title: 'The Royal Treasury',
    text: 'The Lord Treasurer opens the great ledger with trembling hands. There is money, but not for everything: the realm is poor, and taxed to the bone.',
    left: { label: 'Halve the taxes', tile: 'market', out: [
      { w: 3, text: 'The proclamation is read in every market square. The treasury is thin, and the realm has never loved a ruler more.', virtue: ['generosity', 'love'], treasury: -70, after: { old: 10 } },
      { w: 1, text: 'The realm rejoices. The garrisons, unpaid by spring, rejoice rather less.', virtue: 'generosity', treasury: -70, after: { chaos: 10 } },
    ] },
    right: { label: 'Fill the war chest', tile: 'castle', out: [
      { w: 3, text: 'The taxes stay, the chest fills, and the realm grumbles under a crown that could pay any army in the world.', virtue: 'might', treasury: 90 },
      { w: 1, text: 'A full treasury is a fine thing to leave an heir. So, apparently, is a hungry peasantry.', virtue: 'might', treasury: 90, after: { tyrant: 10 } },
    ] } },

  /* ---------------- 4. the throne room ---------------- */
  { id: 'p_crowning', stage: 4,
    title: 'The Crowning',
    text: 'The throne room of {capital} is packed to the rafters. The Archbishop lifts the crown of {kingdom} in both hands. It is heavier than it looks, they say, and you are about to find out.',
    left: { label: 'Kneel, and be crowned', tile: 'cathedral', out: [
      { text: 'You kneel. The crown comes down, cold and then warm, and the whole hall kneels with you.', virtue: 'piety' },
    ] },
    right: { label: 'Take the crown in your own hands', tile: 'palace', out: [
      { text: 'You take it from the Archbishop’s hands and set it on your own head. Nobody breathes. Then the hall erupts.', virtue: ['might', 'splendor'] },
    ] } },
  { id: 'p_royal_name', stage: 4,
    title: 'The Royal Name',
    text: 'The heralds need to know what to cry. Rulers of {kingdom} have often taken the name of a great forebear when they were crowned. You could. Or you could be simply yourself.',
    left: { label: 'Rule under your own name', tile: 'palace', out: [
      { text: '"Long live {king} {name}!" It sounds right. It sounds like you.', virtue: 'love' },
    ] },
    right: { label: 'Take the name of the first king', tile: 'cathedral', out: [
      { text: 'The heralds cry the old name, and old men in the crowd weep to hear it again.', virtue: 'splendor', heir: { renown: 2 } },
    ] } },
  { id: 'p_first_decree', stage: 4,
    title: 'The First Decree',
    text: 'By custom, a new ruler’s first decree is read aloud before the crown is set. The clerk waits beside the throne with an inked pen and a clean sheet of vellum.',
    left: { label: 'Free every serf in the realm', tile: 'palace', out: [
      { w: 2, text: 'The clerk’s hand shakes as he writes. The lords are aghast. Outside, the bells begin to ring on their own.', virtue: ['justice', 'love'], after: { chaos: 10 } },
      { w: 1, text: 'The decree changes everything, and nothing, and then, over forty years, everything.', virtue: 'justice' },
    ] },
    right: { label: 'Raise a standing army', tile: 'castle', out: [
      { w: 2, text: 'Ten thousand under the royal banner, paid from the crown’s own purse. No lord will defy the crown again. Not openly.', virtue: 'might', treasury: -40, heir: { ally: 'knights' } },
      { w: 1, text: 'An army needs a war. Yours will have to find one.', virtue: 'might', after: { tyrant: 10 } },
    ] } },
];
