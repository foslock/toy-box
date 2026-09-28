// Kingdom: the bid for the crown, a second hand of it. One more variant for every stage of each realm's road to the
// throne (succession.js has the first, and says how claim, odds and the paths work), so the heir who answers the summons
// doesn't meet their parent's fight for the crown. A few come only to a house that carries a mark: the Rose it is sworn
// to, the feuds that follow its blood, the debt it owes under the hill.
export default [
  /* ====================== THE OLD KING ====================== */
  { id: 'c_old_hounds', stage: 1, realm: 'old',
    title: 'The Royal Hounds',
    text: 'By the oldest custom of {kingdom}, every claimant must walk the kennel yard while the royal wolfhounds run loose, for the hounds know true blood. {Ruler} watches from a high window, wrapped in furs.',
    left: { label: 'Walk among the hounds', tile: 'stable', odds: { base: .4, renown: .02, trait: { beast_tongue: .4, royal_blood: .2 } },
      win: { text: 'The great grey hounds circle you, sniff your hands, and lie down at your feet one by one. Up at the window, a thin hand lifts.', claim: 2 },
      lose: { text: 'The pack leader knocks you flat in the straw and stands on your chest, grinning. The court finds reasons to look elsewhere.', claim: -1 } },
    right: { label: 'Slip the kennel-master a coin', cost: 20, tile: 'tavern', out: [
      { w: 3, text: 'Your sleeves smell of liver for a week, and every hound in the yard adores you. The court calls it an omen.', claim: 2 },
      { w: 1, text: 'The kennel-master took {rival}’s coin as well. The hounds fawn on you both, and the court laughs at you both.', claim: -1 },
    ], poor: { text: 'You have nothing for the kennel-master, so he lets out the old brindle hound that bites. It does.', claim: -1, hp: -1 } } },

  // House Varrow swore blood for blood, and has found a better revenge than a knife.
  { id: 'c_old_varrow', stage: 2, realm: 'old', needsMark: 'feud_varrow', w: 2,
    title: 'Varrow Silver',
    text: 'House Varrow has come to court in black, a silver rook on every breast, and every Varrow purse is open to {rival}. They do not want the crown. They want only to watch it pass over {house}, and they will pay handsomely for the view.',
    left: { label: 'Outbid House Varrow', cost: 40, tile: 'palace', out: [
      { w: 2, text: 'The lords of the court take Varrow silver and yours, and vote with yours. Somewhere in the palace, a Varrow grinds their teeth to powder.', claim: 2 },
      { w: 1, text: 'Varrow doubles your bid by supper, and tells the whole court you tried to buy it. The court has never been so rich, or so scandalised.', claim: -2 },
    ], poor: { text: 'You can’t match a single Varrow purse, and the court soon learns which way the silver runs.', claim: -1 } },
    right: { label: 'Tell the court the old story', tile: 'palace', odds: { base: .3, renown: .03, talk: .1, ally: { church: .15, knights: .1 } },
      win: { text: 'You tell it plainly, blood and all, and end it: "That was not me." The old {monarch} nods slowly. After that, Varrow silver buys very little.', claim: 2, renown: 1 },
      lose: { text: 'The Varrows tell it better, and bloodier, and with you in it. By the week’s end the court looks at you the way you look at a dog that has bitten before.', claim: -2 } } },

  // The Hollow Pact: the things under the hill have come to see what a crown is worth to them.
  { id: 'c_old_hollow', stage: 3, realm: 'old', needsMark: 'oath_hollow', w: 2,
    title: 'What the Hill Is Owed',
    text: 'Among the physicians at {ruler}’s bedside stands a small grey someone nobody else can see, holding up a long knotted string. "{house} owes the Hollow," it says, in a voice like roots. "We have come to see what it pays with a crown in reach."',
    left: { label: 'Pay the Hollow in gold', cost: 30, tile: 'cave', out: [
      { w: 3, text: 'You follow it down into cellars that go deeper than cellars should, and pay. It ties a knot in its string. That night the old {monarch} dreams of you, and wakes asking for you by name.', claim: 2 },
      { w: 1, text: 'It takes the gold, and something else besides. For a week nobody at court can remember your name, and nor can you.', claim: -1 },
    ], poor: { text: 'Your purse is empty. The grey thing smiles with too many teeth, and all week the old {monarch} has nightmares with your face in them.', claim: -1 } },
    right: { label: 'Refuse a debt you never made', tile: 'chapel', odds: { base: .35, renown: .02, ally: { church: .2, fey: .15, mages: .1 } },
      win: { text: 'You say it aloud: you will pay no debt you did not make. The grey thing steps back into the wall. "I saw it too," whispers the old {monarch}. "You did well."', claim: 2 },
      lose: { text: 'It shrugs, and goes. Then the palace milk sours, the royal hounds howl at your door, and the court decides you are unlucky to stand near.', claim: -2 } } },

  // The Grey Contract: the Brothers always collect, and they like an audience.
  { id: 'c_old_grey', stage: 4, realm: 'old', needsMark: 'feud_brothers', w: 2,
    title: 'A Grey Hood at Court',
    text: 'On the last night before the naming, the court files past {ruler}’s bed to say farewell. Three places ahead of you, a man in a grey hood is humming a psalm. The Grey Brothers hold a contract on your blood, and they always collect.',
    left: { label: 'Strike before he can', tile: 'palace', fight: { foe: 'assassin', name: 'the Grey Brother', power: 9, dmg: 3,
      win: { text: 'You have him down on the marble before his knife is clear of his sleeve. The court sees the grey hood, the knife, and you standing over both.', claim: 2, renown: 1 },
      lose: { text: 'He is quicker. The knife finds your ribs, the guards find him, and the whole court finds you bleeding on the old {monarch}’s carpet.', claim: -1 } } },
    right: { label: 'Keep your place in the line', tile: 'palace', out: [
      { w: 2, text: 'He kneels, kisses the old {monarch}’s ring, and walks out into the night. The Brothers are patient. Tonight, it seems, was not the night.', claim: 1 },
      { w: 1, text: 'As you kneel at the bedside he turns, still humming, and there is a knife in his hand.', fight: { foe: 'assassin', name: 'the Grey Brother', power: 10, dmg: 3,
        win: { text: 'You catch his wrist an inch from your throat, in front of the dying {monarch}. The court will talk about your nerve for years.', claim: 2, renown: 1 },
        lose: { text: 'The guards drag him off you at last. You live, but the court has seen a claimant with worse enemies than its own.', claim: -2 } } },
    ] } },

  { id: 'c_old_vigil', stage: 5, realm: 'old', final: true,
    title: 'The Vigil in the Dark',
    text: '{Ruler} is dead. By old law the claimants keep vigil by the bier till dawn, and the Archbishop crowns whoever the dawn finds kneeling. At midnight every candle in the cathedral goes out at once, and something moves in the nave.',
    left: { label: 'Keep kneeling in the dark', tile: 'cathedral', odds: { base: -.1, claim: .085, ally: { church: .05 } },
      win: { text: 'Footsteps circle you, stop, and go away. When dawn comes through the high windows you are the only one still kneeling, and the Archbishop, weeping, crowns you.', crown: true },
      lose: { text: 'Something strikes you hard behind the ear. You wake in the nave at dawn, in time to hear the Archbishop crowning {rival}.' } },
    right: { label: 'Draw steel and hunt the dark', tile: 'cathedral', fight: { foe: 'assassin', name: '{rival}’s cutthroats', power: 12, dmg: 4,
      win: { text: 'You drag {rival}’s cutthroats out into the dawn by their collars. The Archbishop crowns you then and there, with blood on your sleeve.', crown: true, path: 'blade' },
      lose: { text: 'There are more of them than you thought, and the dark is on their side.', die: 'knifed in the dark at the royal vigil' } } } },

  /* ====================== THE TYRANT ====================== */
  { id: 'c_ty_pardon', stage: 1, realm: 'tyrant',
    title: 'The Royal Pardon',
    text: 'Heralds nail {ruler}’s proclamation to every chapel door: any who spoke against the crown may come to {capital}, kneel, and be forgiven, with a place at court besides. Beside you, a woman is already tearing hers down.',
    left: { label: 'Burn it in the square', path: 'rebellion', tile: 'bonfire', odds: { base: .4, renown: .03, ally: { rebels: .2 } },
      win: { text: 'You burn it on the chapel steps, and the crowd roars so loudly the herald drops his hammer. By nightfall the tale is in every tavern in the shire.', claim: 2 },
      lose: { text: 'The crowd cheers, then scatters as the riders come. You spend the night in a pigsty, alone with your principles.', claim: -1 } },
    right: { label: 'Kneel, and be forgiven', path: 'court', tile: 'palace', out: [
      { w: 2, text: 'You kneel in the throne room among forty penitents, and {ruler} looks straight through you. It costs you some pride. It buys you a room in the palace.', claim: 2, renown: -1 },
      { w: 1, text: 'The pardon comes with a fee: a year’s taxes in advance, counted out to a clerk with very clean hands.', claim: 1, gold: -15 },
      { w: 1, text: 'You kneel, and are forgiven, and are seen. The rebels call you turncoat in every tavern, and the palace has never trusted a turncoat in its life.', claim: -1 },
    ] } },

  /* ---------- by rebellion ---------- */
  { id: 'c_ty_funeral', stage: 2, realm: 'tyrant', path: 'rebellion',
    title: 'The Fiddler’s Funeral',
    text: '{Ruler}’s men hanged old Tam Fiddle for playing the wrong tune at a wedding. Half the city means to walk behind his coffin tomorrow, and so, up on the rooftops, do the tyrant’s crossbowmen.',
    left: { label: 'Sing his song at the grave', tile: 'graveyard', odds: { base: .4, renown: .03, ally: { rebels: .15, church: .1 } },
      win: { text: 'A thousand voices take up the last verse. Up on the roofs the crossbowmen, most of whom know it too, lower their bows one by one.', claim: 2, renown: 1 },
      lose: { text: 'You get through one verse before the bolts start. The crowd scatters, and some of them blame you for it.', claim: -1, hp: -1 } },
    right: { label: 'Turn the funeral into a rising', tile: 'watchtower', fight: { foe: 'soldier', name: 'the crossbowmen on the roofs', power: 9, dmg: 2,
      win: { text: 'The mourners have cudgels under their black cloaks. By dusk the river quarter is yours, and Tam Fiddle has the finest funeral {capital} has ever seen.', claim: 2, ally: 'rebels' },
      lose: { text: 'The crossbowmen were ready. The mourners go home with more to mourn.', claim: -2 } } } },

  // Sworn to the Rose: the Rose looks after its own, and would like to own a little more.
  { id: 'c_ty_rose', stage: 3, realm: 'tyrant', path: 'rebellion', needsMark: 'oath_rose', w: 2,
    title: 'The White Book',
    text: 'Two hundred Knights of the Rose ride into your camp, for {house} is sworn to the Rose, and the Rose looks after its own. The Grand Master opens the White Book on your map-table. "Swear us the crown as well," he says, "and we take the city."',
    left: { label: 'Swear the crown to the Rose', tile: 'city_gate', out: [
      { w: 2, text: 'Your name goes into the White Book twice. By nightfall the Rose has stormed the Water Gate, and the city is yours, and you, as the Grand Master reminds everyone, are theirs.', claim: 2 },
      { w: 1, text: 'Your rebels watch your name go into the White Book and wonder whose crown they are bleeding for. A good many of them go home.', claim: -2 },
    ] },
    right: { label: 'Keep the crown out of the book', tile: 'war_camp', odds: { base: .4, renown: .03, talk: .1 },
      win: { text: 'The Grand Master closes the book, and laughs. "Sworn is sworn." At dawn two hundred roses ride in your vanguard, for nothing but the oath.', claim: 2 },
      lose: { text: '"A pity," says the Grand Master, and closes the book. The Rose rides home at dawn, and your rebels watch it go.', claim: -2 } } },

  { id: 'c_ty_dead_walls', stage: 4, realm: 'tyrant', path: 'rebellion',
    title: 'The Dead on the Walls',
    text: 'The last defenders of {capital} are not alive. {Ruler}’s court sorcerer has emptied the catacombs onto the walls, and your rebels’ own grandfathers look down at them with empty eyes.',
    left: { label: 'Storm the walls of bone', tile: 'city_gate', fight: { foe: 'skeleton', name: 'the Catacomb Host', power: 10, dmg: 2,
      win: { text: 'Bone breaks like kindling. By dawn your rebels are over the walls, and the priests of {capital} are going to be very busy.', claim: 2 },
      lose: { text: 'The dead do not tire, and they do not run. By dawn a few of your rebels have joined them on the walls.', claim: -2 } } },
    right: { label: 'Hunt down the sorcerer', tile: 'wizard_tower', odds: { base: .35, ally: { mages: .25, guild: .15, church: .1 } },
      win: { text: 'You find him chanting in a bell tower. One shove, a long silence, and every skeleton on the walls falls down at once like dropped washing.', claim: 2 },
      lose: { text: 'He was expecting you. You come down the tower with white streaks in your hair and nothing to show for them.', claim: -1, hp: -1 } } },

  { id: 'c_ty_burning', stage: 5, realm: 'tyrant', path: 'rebellion', final: true,
    title: 'The Burning Palace',
    text: 'Rather than surrender, {ruler} has set the palace alight and climbed the great tower with the crown. Your rebels fill the courtyard below, watching the smoke, and watching you.',
    left: { label: 'Climb the burning stair', tile: 'palace', odds: { base: -.05, claim: .05, power: .03, vs: 8, ally: { rebels: .05 } },
      win: { text: 'Up through smoke and falling beams to the tower top, where {ruler} sits coughing on a chest of gold. You come down through the fire with the tyrant over your shoulder and the crown on your head.', crown: true },
      lose: { text: 'Halfway up, the stair gives way beneath you.', die: 'lost in the burning of the tyrant’s palace' } },
    right: { label: 'Let it burn, and wait', tile: 'war_camp', odds: { base: -.14, claim: .085, ally: { rebels: .05, dwarves: .05 } },
      win: { text: 'At dawn the tower falls in, and {ruler} crawls out of the ashes holding up the crown, blackened, to the first rebel they see. That is you.', crown: true },
      lose: { text: 'The tyrant slips out through the sewers with the crown in a sack, and your rebellion falls to quarrelling over an empty chair.' } } },

  /* ---------- from inside the court ---------- */
  { id: 'c_ty_favourite', stage: 2, realm: 'tyrant', path: 'court',
    title: 'The Favourite',
    text: 'Nobody reaches {ruler} except through Lord Quillon: twenty years old, lace to the knuckles, and the finest blade at court. He decides who is amusing, and amusing people are invited everywhere.',
    left: { label: 'Make him laugh', tile: 'garden', odds: { base: .3, talk: .2, renown: .02 },
      win: { text: 'He decides you are the most amusing thing to happen to the court in years. By the week’s end you are dining at the tyrant’s elbow.', claim: 2 },
      lose: { text: 'He decides you are tedious, and tells the whole table so over dinner, at length and in rhyme.', claim: -1, renown: -1 } },
    right: { label: 'Humble him with a blade', tile: 'tourney', fight: { foe: 'champion', name: 'Lord Quillon', power: 9, dmg: 2,
      win: { text: 'First blood to you, across his lace. {Ruler} laughs aloud for the first time in years, and sends for the one who did it.', claim: 2, renown: 1 },
      lose: { text: 'He opens your cheek with a flick of the wrist, bows to the gallery, and asks who is next. Nobody asks for you after that.', claim: -2 } } } },

  { id: 'c_ty_dreams', stage: 3, realm: 'tyrant', path: 'court',
    title: 'Bad Dreams at Court',
    text: '{Ruler} sleeps badly. Every night the hanged come back, and every morning the court astrologer is sent for to say what it means. The astrologer drinks, has debts, and is listening to you.',
    left: { label: 'Pay the astrologer’s debts', cost: 30, tile: 'wizard_tower', out: [
      { w: 2, text: 'The stars, it seems, warn against the tyrant’s oldest friends. Within the week the Lord Marshal is in the dungeon, and his friends with him, and none of them were yours.', claim: 2 },
      { w: 1, text: 'The astrologer takes your gold, then reads the stars honestly for once: "Beware the new face at court." Every eye turns to you.', claim: -1 },
    ], poor: { text: 'You have nothing for the astrologer’s debts. Next morning the stars speak darkly of a newcomer with holes in their boots.', claim: -1 } },
    right: { label: 'Haunt the royal bedchamber', tile: 'palace', odds: { base: .35, talk: .1, ally: { guild: .25, mages: .15 } },
      win: { text: 'Three nights running you stand at the foot of the tyrant’s bed in a hanged man’s shroud and a little flour. By the fourth, {ruler} trusts nobody, so nobody can stop you.', claim: 3 },
      lose: { text: 'On the third night the tyrant wakes and throws a candlestick. The guards find a ghost with a bloody nose, and your face.', claim: -2, hp: -1 } } },

  { id: 'c_ty_dowager', stage: 4, realm: 'tyrant', path: 'court',
    title: 'The Dowager',
    text: 'Only one person in {capital} frightens {ruler}: their mother, the Dowager, ninety years old and sharp as a bodkin. She keeps a cabinet of poisons, a parrot that swears, and a very low opinion of her child.',
    left: { label: 'Take tea with the Dowager', tile: 'garden', odds: { base: .35, talk: .2, renown: .02, ally: { guild: .1 } },
      win: { text: 'Three cups in, she pats your hand. "My child was always a disappointment. You will do nicely." By Friday the palace guard has new orders, in her writing.', claim: 3 },
      lose: { text: 'She hears you out, smiling, then repeats every word to her child over breakfast. You leave the palace by the privy window.', claim: -2, hp: -1 } },
    right: { label: 'Rob her poison cabinet', tile: 'palace', out: [
      { w: 1, text: 'The parrot watches you do it and, for once, says nothing. Three green drops in the right cup, and the Lord Chancellor, who would have died for the tyrant, does.', claim: 2 },
      { w: 1, text: 'The cabinet holds nothing but a note in a spidery hand: "Try the tea." She tells her child about it over breakfast, as a joke. Her child does not laugh.', claim: -1 },
      { w: 1, text: 'The parrot screams "THIEF!" in the Dowager’s own voice all the way down the stairs, and her guards come running.', fight: { foe: 'soldier', name: 'the Dowager’s guard', power: 9, dmg: 2,
        win: { text: 'You leave two guards in the fishpond and the parrot swearing. The poison is still in your pocket, and it finds a use.', claim: 1 },
        lose: { text: 'They drag you before the Dowager, who laughs until she wheezes and lets you go. Her child hears of it all the same.', claim: -2 } } },
    ] } },

  { id: 'c_ty_bath', stage: 5, realm: 'tyrant', path: 'court', final: true,
    title: 'Asses’ Milk at Midnight',
    text: 'At midnight, as always, {ruler} bathes alone in a copper tub of asses’ milk, guarded by one deaf old soldier and a sword on a hook. Tonight the soldier is yours, the door is unbarred, and the council is waiting.',
    left: { label: 'Walk in and take the sword', tile: 'palace', odds: { base: -.1, claim: .07, power: .02, vs: 8, ally: { guild: .08 } },
      win: { text: '{Ruler} is marched before the council dripping milk and wrapped in a towel. The council, who have never seen a tyrant in a towel, vote very quickly.', crown: true },
      lose: { text: 'The sword on the hook was for show. The one in the milk was not.', die: 'stabbed from a tub of asses’ milk' } },
    right: { label: 'Bar the door, and wait', tile: 'palace', odds: { base: -.14, claim: .085, ally: { guild: .05, lords: .05 } },
      win: { text: 'By dawn the milk is cold and the tyrant is hoarse. {Ruler} abdicates through the keyhole, before witnesses, and the crown comes to you on a cushion.', crown: true },
      lose: { text: 'The tyrant bellows until the whole palace wakes. By the time the guards you didn’t buy break down the door, you are on a horse, and the crown is not.' } } },

  /* ====================== THE EMPTY THRONE ====================== */
  { id: 'c_ch_bread', stage: 1, realm: 'chaos',
    title: 'Bread or Iron',
    text: '{capital} has been sacked twice in three years, and has shut its gates to all comers. From the walls the city fathers shout their terms: they will open for whoever brings bread, or whoever drives off {warlord}’s raiders.',
    left: { label: 'Drive off the raiders', path: 'arms', tile: 'battlefield', odds: { base: .35, power: .03, vs: 8, ally: { knights: .1, rebels: .1 } },
      win: { text: 'Your little band falls on the raiders at dawn and chases them into the river. The gates creak open for the first army that ever left the city alone.', claim: 2 },
      lose: { text: 'There are more raiders than you counted, and better. You leave the field limping, and the gates stay shut.', claim: -1, hp: -1 } },
    right: { label: 'Bring bread to the gates', path: 'unity', cost: 25, tile: 'city_gate', out: [
      { w: 3, text: 'Forty carts of bread and turnips roll in under your banner. By evening every bell in {capital} is ringing for you.', claim: 2 },
      { w: 1, text: 'The bread is welcome. Whoever brought it is not trusted yet: the city has been fooled by bread before.', claim: 1 },
    ], poor: { text: 'You come with two carts of turnips and a very good speech. The city takes the turnips.', claim: -1, path: 'unity' } } },

  /* ---------- by arms ---------- */
  { id: 'c_ch_griffins', stage: 2, realm: 'chaos', path: 'arms',
    title: 'The Griffin Riders',
    text: '{Warlord2} has hired the griffin riders of the Pale Crags, and every dawn they fall on your camp out of the sun. Your pickets have given up looking up. It does no good.',
    left: { label: 'Fight them from the ground', tile: 'war_camp', fight: { foe: 'griffin', name: 'the lead griffin', power: 9, dmg: 2,
      win: { text: 'A lucky spear through the lead griffin’s wing brings it down, rider and all. The rest fly home to the Crags, and your soldiers eat well.', claim: 2 },
      lose: { text: 'They come out of the sun again, and again. By the week’s end nobody in your camp sleeps, and some of them are leaving.', claim: -2 } } },
    right: { label: 'Raid their eyries', tile: 'mountain', odds: { base: .35, power: .02, vs: 8, ally: { dwarves: .2, rebels: .1 } },
      win: { text: 'While the riders are out, you climb to the eyries and carry off every egg. By noon the riders have sworn to fly for you, if only you will give them back.', claim: 2 },
      lose: { text: 'One griffin stayed home. You come down the cliff a great deal faster than you went up.', claim: -1, hp: -1 } } },

  { id: 'c_ch_abbey', stage: 3, realm: 'chaos', path: 'arms',
    title: 'The Silver Abbey',
    text: 'The abbey of Saint Brannoc sided with {warlord2}, and its gates are open to you now. Your soldiers have not been paid since spring, and every one of them is looking at the silver on the altar, then at you.',
    left: { label: 'Let them take the silver', tile: 'abbey', out: [
      { w: 2, text: 'Candlesticks, chalices, a saint’s silver hand. Your soldiers are paid, drunk and devoted, and the abbot curses you in the old tongue.', claim: 1, gold: 20 },
      { w: 1, text: 'By Sunday every pulpit in {kingdom} rings with it: the claimant who robbed a saint. The lords who were wavering stop wavering, the wrong way.', claim: -2, gold: 20 },
    ] },
    right: { label: 'Forbid the sack', tile: 'war_camp', odds: { base: .4, renown: .03, ally: { church: .15, knights: .15 } },
      win: { text: 'The soldiers grumble, and obey. The abbot blesses your banner with the saint’s own silver hand, and the tale runs ahead of you to every shrine in {kingdom}.', claim: 2, ally: 'church' },
      lose: { text: 'A third of your army slips away in the night, to a warlord less particular about saints.', claim: -2 } } },

  // The Slighted Prince (the Hawthorn Prince, in feuds.js): his Hunt has waited for your house to have something worth taking.
  { id: 'c_ch_hunt', stage: 4, realm: 'chaos', path: 'arms', needsMark: 'feud_fey', w: 2,
    title: 'The Prince’s Hunt',
    text: 'On the eve of the last battle a horn sounds under the moon, and the Hunt pours out of the hill behind your camp, the Hawthorn Prince at its head. He has not forgotten {house}. He has waited only until it had something worth taking.',
    left: { label: 'Meet the prince blade to blade', tile: 'fairy_ring', fight: { foe: 'fey_knight', name: 'the Hawthorn Prince', power: 11, dmg: 3, elite: true,
      win: { text: 'His silver blade breaks on yours. The prince laughs, bows from the saddle and rides back into his hill, and every soldier who saw it would follow you into the sea.', claim: 3 },
      lose: { text: 'He cuts you out of the saddle, takes your banner for a trophy, and rides off laughing. Your soldiers saw that too.', claim: -2 } } },
    right: { label: 'Offer him a part in the battle', tile: 'war_camp', odds: { base: .2, talk: .1, ally: { fey: .35, mages: .1 } },
      win: { text: 'No prince of the Hidden Folk can resist a better story. At dawn the Hunt rides at your side, and the enemy line, seeing what rides with you, simply runs.', claim: 3 },
      lose: { text: 'He hears you out, smiling, then takes your best horses, your best hounds and a drummer boy who is never seen again. Your army will not meet your eye.', claim: -2 } } },

  { id: 'c_ch_barrow', stage: 5, realm: 'chaos', path: 'arms', final: true,
    title: 'The First King’s Barrow',
    text: 'The last battle for {kingdom} will be fought at dawn, below the barrow of its first king. At midnight the barrow door stands open, and a cold light spills out across the grass. Your soldiers are watching to see what you will do.',
    left: { label: 'Go down into the barrow', tile: 'crypt', fight: { foe: 'wraith', name: 'the First King', power: 12, dmg: 4, elite: true,
      win: { text: 'You climb out at dawn with the first king’s crown on your head and grave-dirt on your hands. The enemy army sees it, and kneels in the wet grass.', crown: true, path: 'blade' },
      lose: { text: 'The first king does not care to share his barrow.', die: 'taken by the dead king under the barrow' } } },
    right: { label: 'Wait for dawn, and fight', tile: 'battlefield', odds: { base: -.08, claim: .085 },
      win: { text: 'You win below the barrow at dawn. When it is over the door has closed again, and the first king’s crown lies in the grass at your feet.', crown: true },
      lose: { text: 'The battle goes against you. By noon you are riding for the hills, and someone else is standing on the barrow.' } } },

  /* ---------- by uniting the lords ---------- */
  { id: 'c_ch_table', stage: 2, realm: 'chaos', path: 'unity',
    title: 'The High Table',
    text: 'Twelve lords have come to your truce-feast, bringing eleven blood feuds and one high table. Someone must sit at your right hand, and whoever it is, the other eleven will never forgive it.',
    left: { label: 'Seat the eldest at your right', tile: 'manor', out: [
      { w: 2, text: 'Old Lady Ashgrove is ninety, deaf, and related to everyone. Nobody can decently object to her, and nobody does. The truce holds.', claim: 2 },
      { w: 1, text: 'Old Lady Ashgrove falls asleep in the soup. The Lord of Hask laughs, the Lord of Brenn draws steel, and the feast ends in the moat.', claim: -1 },
    ] },
    right: { label: 'Sit below the salt yourself', tile: 'camp', odds: { base: .35, renown: .03, talk: .15 },
      win: { text: 'You take a stool among the squires. One by one the lords carry their plates down to sit near you, since none of them dares sit higher than their host.', claim: 2, renown: 1 },
      lose: { text: 'The lords take it as an insult to the high table, and the high table as an insult to them. Nobody is sure what happened, only that it was your fault.', claim: -1 } } },

  { id: 'c_ch_ghost', stage: 3, realm: 'chaos', path: 'unity',
    title: 'The Last King’s Ghost',
    text: 'In the burned palace of {capital}, the last king of {kingdom} walks at midnight in his nightshirt, with a knife in his back. He points at you, then at Lord Garrow, your richest friend, asleep by the fire with your charter on his knee.',
    left: { label: 'Accuse Lord Garrow', tile: 'palace', odds: { base: .35, renown: .03, ally: { church: .2, mages: .1 } },
      win: { text: 'Before the whole council, the old king’s dagger-sheath turns up in Garrow’s strongbox. The lords are horrified, then grateful, then yours.', claim: 3 },
      lose: { text: 'Nobody else saw any ghost. Garrow’s friends walk out of the council, and take their banners with them.', claim: -2 } },
    right: { label: 'Keep Garrow’s gold', tile: 'ruins', out: [
      { w: 2, text: 'The ghost fades with a sigh like a door closing. Garrow’s gold pays your soldiers for a season, and nobody else ever knows.', claim: 2 },
      { w: 1, text: 'The ghost does not care to be ignored. Candles gutter at every council, the wine turns to vinegar, and the lords begin to whisper that your cause is cursed.', claim: -2 },
    ] } },

  { id: 'c_ch_pretender', stage: 4, realm: 'chaos', path: 'unity',
    title: 'The Lost Prince',
    text: 'A boy of ten walks into the peace council wearing the last king’s signet ring, and says he is the last king’s son. Half the lords believe him already. The boy looks at you, and waits.',
    left: { label: 'Name him your heir', tile: 'palace', out: [
      { w: 2, text: 'A crown that comes with an heir already attached. The lords, who are very tired of war, find this wonderfully restful.', claim: 2 },
      { w: 1, text: 'A washerwoman from Flaxby pushes into the council to claim her son and box his ears. The lords laugh until they weep, then stop taking you seriously.', claim: -2 },
    ] },
    right: { label: 'Put his claim to the test', tile: 'oracle', odds: { base: .35, talk: .1, ally: { church: .15, mages: .15 } },
      win: { text: 'The ring is paste, and the boy is a pedlar’s son coached by {warlord2}. The lords are furious, though not with you.', claim: 2 },
      lose: { text: 'The priests prod him, the wizards peer into his eyes, and nobody can say one way or the other. The council breaks up uneasy.', claim: -1 } } },

  { id: 'c_ch_candles', stage: 5, realm: 'chaos', path: 'unity', final: true,
    title: 'The Candle Vote',
    text: 'By the old way of {kingdom}, the lords choose a ruler by candlelight: each sets a candle before the claimant they would crown. Your row is long. {Warlord2}’s is longer. Midnight is an hour away.',
    left: { label: 'Go among the lords', tile: 'palace', odds: { base: -.1, claim: .085, renown: .01 },
      win: { text: 'You speak to each lord by name, and ask for nothing but their candle. When midnight rings, your row runs all the way to the door.', crown: true },
      lose: { text: 'At midnight the candles are counted. You are three short, and the lords will not meet your eye as they kneel to {warlord2}.' } },
    right: { label: 'Blow out their candles', tile: 'palace', odds: { base: 0, claim: .05, talk: .05, ally: { guild: .15 } },
      win: { text: 'A draught, a sneeze, a page with a clumsy tray. At midnight {warlord2}’s row is dark, and yours is the only light in the hall.', crown: true },
      lose: { text: 'A lord sees your breath on the flames. The hall erupts, and you are thrown out into the snow with your claim in pieces.' } } },
];
