// Kingdom: the procession, a second hand of it. Two more variants for each of its four stages (procession.js has the
// first, and says what virtue, treasury, heir and after do), so a new ruler's ride to the throne isn't their parent's.
// Nothing here can take the crown away, or kill; it only decides what kind of ruler rides in.
export default [
  /* ---------------- 1. the gates ---------------- */
  { id: 'q_penny', stage: 1,
    title: 'The Penny Toll',
    text: 'The gatekeeper of {capital} is ninety years old, and for seventy of them he has taken a penny from every soul who came through his gate. He holds out his hand to you, exactly as he would to a pig-farmer.',
    left: { label: 'Pay him his penny', tile: 'city_gate', out: [
      { w: 3, text: 'You find a penny and lay it in his palm. The crowd roars as if you had slain a dragon, and by nightfall the whole city knows its new ruler pays the toll.', virtue: ['justice', 'love'] },
      { w: 1, text: 'You have no penny. A fishwife lends you one, and has it back from the treasury within the week, at a very handsome rate of interest.', virtue: 'justice', treasury: -5 },
    ] },
    right: { label: 'Knight him on the spot', tile: 'city_gate', out: [
      { w: 2, text: 'You dub him Sir Penny with a borrowed sword. He weeps, the crowd weeps, and the heralds have to invent him a coat of arms by supper.', virtue: ['splendor', 'generosity'], heir: { renown: 1 } },
      { w: 1, text: 'Sir Penny takes his new rank very seriously, and charges every lord who comes through his gate a silver piece. The treasury has never had it so good.', virtue: 'splendor', treasury: 15 },
    ] } },
  { id: 'q_touch', stage: 1,
    title: 'The Healing Touch',
    text: 'Inside the gate a hundred sick folk are waiting, because everyone in {kingdom} knows that a ruler’s touch heals on the day of the crowning. Everyone except the royal physicians, who are looking nervous.',
    left: { label: 'Lay hands on the sick', tile: 'street', out: [
      { w: 2, text: 'You touch every one of them, all afternoon. Nobody can say for certain that anyone is healed, but a lame boy dances in the square, and that is enough for the city.', virtue: ['piety', 'love'] },
      { w: 1, text: 'You touch every one of them, and a week later you are coughing like all of them. The city loves you for it, feverishly.', virtue: ['piety', 'love'], hp: -1 },
    ] },
    right: { label: 'Send in the physicians', tile: 'abbey', out: [
      { w: 2, text: 'The royal physicians treat every one of them at the crown’s expense. It is less of a miracle, and more of a cure.', virtue: ['generosity', 'justice'], treasury: -30 },
      { w: 1, text: 'The physicians bleed everyone, which helps nobody, but at the crown’s expense, which helps a little.', virtue: 'generosity', treasury: -30 },
    ] } },

  /* ---------------- 2. the streets ---------------- */
  { id: 'q_mummers', stage: 2,
    title: 'The Mummers’ Play',
    text: 'On a cart in the market square a troupe of mummers is playing The Road to the Throne. The mummer who plays you has a false nose, a wooden sword and all the best jokes, and the crowd is helpless with laughter.',
    left: { label: 'Laugh louder than anyone', tile: 'market', out: [
      { w: 2, text: 'You laugh till you cry, then climb onto the cart and play yourself in the last scene. You are much worse at it than the mummer. The city adores you.', virtue: 'love', heir: { renown: 1 } },
      { w: 1, text: 'You laugh along. The play tours the kingdom for forty years, getting a little ruder every spring.', virtue: ['love', 'mercy'] },
    ] },
    right: { label: 'Have the cart seized', tile: 'prison', out: [
      { w: 2, text: 'The mummers spend a night in the cells, and go free at dawn with a warning. The play is never performed again, in public.', virtue: 'might' },
      { w: 1, text: 'Nothing makes a play famous like banning it. They perform it in cellars for a generation, and now it ends with your head on a pike.', virtue: 'might', after: { chaos: 10 } },
    ] } },
  { id: 'q_debts', stage: 2,
    title: 'The Crown’s Debts',
    text: 'The procession passes the counting-house of the Gilded Company, and the merchant princes are waiting on its steps with their ledgers open. The old crown borrowed from every one of them, and paid back none of it.',
    left: { label: 'Honour the crown’s debts', tile: 'market', out: [
      { w: 3, text: 'The treasury bleeds for a year. But a crown that pays its debts can borrow again, and the Gilded Company will lend to your heir without blinking.', virtue: 'justice', treasury: -50, heir: { ally: 'merchants' } },
      { w: 1, text: 'You pay every debt in full. A few of the ledgers, it turns out later, were written last week.', virtue: 'justice', treasury: -70 },
    ] },
    right: { label: 'Pay them in titles instead', tile: 'manor', out: [
      { w: 2, text: 'You make every merchant prince a baron. They are so pleased with their coronets that it takes them years to notice they were never paid.', virtue: 'cunning', treasury: 30 },
      { w: 1, text: 'Your new barons sell their titles to their clerks, who sell them on to theirs. Within ten years every alehouse-keeper in {kingdom} is a lord.', virtue: 'cunning', treasury: 30, after: { chaos: 10 } },
    ] } },

  /* ---------------- 3. those who stood against you ---------------- */
  { id: 'q_headsman', stage: 3,
    title: 'The Headsman',
    text: 'The royal headsman kneels before you with his axe across his knees, as custom requires, and asks whether the new reign has any use for him. He has served three rulers, and never once needed a second stroke.',
    left: { label: 'Keep him in his post', tile: 'prison', out: [
      { w: 2, text: 'The axe goes back on its hook in the tower. It is not taken down again for eleven years, and then only for a man the whole kingdom wanted dead.', virtue: 'justice' },
      { w: 1, text: 'The axe goes back on its hook, and everyone at court knows exactly which hook.', virtue: ['justice', 'might'], after: { tyrant: 10 } },
    ] },
    right: { label: 'Break the axe', tile: 'smithy', out: [
      { w: 2, text: 'You break it over the anvil yourself, at the second stroke. The headsman is pensioned off to keep bees, and turns out to be very good at it.', virtue: 'mercy', after: { old: 10 } },
      { w: 1, text: 'No axe, no headsman. The realm’s cutthroats hear of it with great interest.', virtue: 'mercy', after: { chaos: 10 } },
    ] } },
  { id: 'q_menagerie', stage: 3,
    title: 'The Royal Menagerie',
    text: 'Under the palace, in the old royal menagerie, a chained wyvern has sat in the dark for thirty years. Its keeper asks what the new ruler would like done with it. The wyvern watches you with one yellow eye.',
    left: { label: 'Strike off its chains', tile: 'mountain', out: [
      { w: 2, text: 'It limps into the light, spreads its wings and circles {capital} three times before it flies west. The whole city takes it for the best omen in a hundred years.', virtue: ['mercy', 'love'], after: { old: 5 } },
      { w: 1, text: 'On its way out it eats the Lord Mayor’s prize bull. The city thinks it the funniest thing that ever happened. The Lord Mayor sends the crown a bill.', virtue: 'mercy', treasury: -15 },
    ] },
    right: { label: 'Keep it for the crown', tile: 'castle', out: [
      { w: 2, text: 'The wyvern gets a bigger cage, a gilded chain and a place at the front of every royal pageant. Foreign envoys go very pale at the sight of it.', virtue: 'splendor', heir: { renown: 1 } },
      { w: 1, text: 'You have it walked past every envoy who comes to court. It is never quite clear afterwards which of you they found more frightening.', virtue: ['splendor', 'might'], after: { tyrant: 5 } },
    ] } },

  /* ---------------- 4. the throne room ---------------- */
  // (not for a house the Slighted Prince has sworn against: his kin would hardly come bearing crowns)
  { id: 'q_hawthorn', stage: 4, unlessMark: 'feud_fey',
    title: 'The Hawthorn Crown',
    text: 'As the Archbishop lifts the crown, the great doors blow open, and a tall figure in leaf and silver walks up the aisle with a circlet of living hawthorn in its hands. The Hidden Folk would like to crown you too.',
    left: { label: 'Wear the hawthorn crown', tile: 'grove', out: [
      { w: 2, text: 'The thorns do not prick. Leaves unfurl along the circlet as it settles on your brow, and the Hidden Folk bow very low. They will remember your line.', virtue: ['love', 'splendor'], heir: { ally: 'fey' } },
      { w: 1, text: 'You wear both crowns, gold over hawthorn. The Archbishop never quite forgives it, and preaches on the subject for years.', virtue: 'splendor', heir: { ally: 'fey' }, after: { chaos: 5 } },
    ] },
    right: { label: 'Refuse it, with thanks', tile: 'cathedral', out: [
      { w: 2, text: 'The tall figure inclines its head and withdraws, leaving a smell of rain. The Archbishop, much relieved, crowns you twice as solemnly.', virtue: 'piety', heir: { ally: 'church' } },
      { w: 1, text: 'The tall figure smiles, and leaves the circlet on the altar anyway. Every spring after, it flowers.', virtue: 'piety', heir: { renown: 1 } },
    ] } },
  { id: 'q_oil', stage: 4,
    title: 'The Stolen Oil',
    text: 'The holy oil for the anointing has been stolen, flask and all, and the Archbishop is weeping in the vestry. There is good oil in the palace kitchens. The saint’s own spring is three days’ ride away.',
    left: { label: 'Bless the kitchen oil', tile: 'palace', out: [
      { w: 2, text: 'The Archbishop blesses a jug of the cook’s best, and nobody in the hall can tell the difference. Your hair smells faintly of salad all day.', virtue: 'cunning' },
      { w: 1, text: 'Somebody can tell. For the rest of your reign the ballad-singers call you the ruler anointed with salad oil, fondly, mostly.', virtue: ['cunning', 'love'] },
    ] },
    right: { label: 'Wait for the holy oil', tile: 'shrine', out: [
      { w: 2, text: 'Three days later the oil comes from the saint’s spring in a crystal flask, and the anointing is the most solemn in living memory.', virtue: ['piety', 'splendor'], heir: { renown: 1 } },
      { w: 1, text: 'In three days without a crowned ruler, two barons go to war over a mill-pond. The anointing is very solemn, and a little late.', virtue: 'piety', after: { chaos: 10 } },
    ] } },
];
