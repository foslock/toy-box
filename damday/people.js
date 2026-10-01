// The eight people (and the cat): where each one is at what minute, what each says, and what saying the right thing
// to them does. `talk(s, topic)` is called once per exchange; it may change the game (give, learn, set flags) and
// returns { say: [pages], ask: [[topicId, label], ...] }. Topics are only offered if the notebook knows enough.
const sched = list => s => { let a = list[0][1]; for (const [t, n] of list) if (s.t >= t) a = n; return a; };
const heard = (s, who, delay) => s.F(who + '_warned') || (s.F('decree') && s.since('decree') >= delay);
const flee = (s, who, delay = 1) => s.F(who + '_warned') || (s.F('siren_on') && s.since('siren_on') >= delay);
const Q = t => '“' + t + '”';

export const NPCS = [
  {
    id: 'mayor', name: 'Mayor Pomfrey', tag: 'Decrees everything. Her cat is the Deputy Mayor.',
    look: { skin: '#f2c9a5', hair: '#b9b3c9', coat: '#e9a1b8', pants: '#8a82c4', hat: ['top', '#8a82c4'], extra: ['sash', 'scroll'] },
    goal: s => heard(s, 'mayor', 1.5) ? 'hill_mayor' : s.t < 70 ? 'hall_mayor' : 'green_stage',
    talk(s, topic) {
      const ask = () => [['speech', 'The speech'], ['cat', 'Your cat'], ...(s.K('keys_cat') ? [['keys', 'The keys on his collar']] : []), ...(s.K('dam_crack') || s.K('dam_break') ? [['dam', 'The dam']] : []), ...(s.K('decree_power') ? [['decree', Q('Madam Mayor, I need a decree.')]] : [])];
      if (!topic) {
        if (s.F('decree')) return { say: ['Onward to Chapel Hill! With buns! So decreed!'], ask: [] };
        if (s.F('siren_on')) { s.learn('decree_power'); return { say: ['The SIREN! It lives! It has not lived since last Dam Day!', 'The people of Wickerby do nothing without my decree, and they are all looking at me. Have you a request, citizen? So decreed.'], ask: ask() }; }
        if (!s.F('met_mayor')) { s.setF('met_mayor'); s.learn('mayor_cat'); return { say: ['Citizen! You stand upon the Town Hall steps, which are, by decree, the Town Hall steps.', 'I am rehearsing the Dam Day speech. One hundred years of the dam! Do not applaud yet. So decreed.'], ask: ask() }; }
        return { say: [s.t < 70 ? 'Again, citizen. I am still rehearsing. So decreed.' : 'The stage is mine, the speech is mine, the bunting is mine. What do you want? So decreed.'], ask: ask() };
      }
      if (topic === 'speech') { s.learn('speech'); return { say: ['Eleven minutes long. They will give me four. I take the Green’s stage at 7:57 and ten seconds, and not a second before. So decreed.'], ask: ask() }; }
      if (topic === 'cat') { s.learn('mayor_cat'); s.learn('cat_fish'); return { say: ['Alderman is not a cat. He is the Deputy Mayor. He has voted 114 times, and carried every motion.', 'His one weakness is sardines, which is unforgivable in an official. So decreed.'], ask: ask() }; }
      if (topic === 'keys') return { say: ['The engineer’s keys? She dropped them in my hat at the Dam Day eve. The Deputy keeps them in trust. I will not take them from him. The law is the law, and the law is a cat.'], ask: ask() };
      if (topic === 'dam') {
        s.learn('decree_precedent'); if (s.F('siren_on')) s.learn('decree_power');
        return { say: [s.F('siren_on') ? 'Water? With the siren going? Then it is not a test, and I would decree. Ask me to, citizen.' : 'The Hollin Dam is a hundred years old and not one day late. I will not alarm the Green without a precedent. Bylaw 9: the precedent is the siren. So decreed.'], ask: ask() };
      }
      if (topic === 'decree') {
        s.learn('decree_precedent');
        if (!s.F('siren_on')) return { say: ['A decree without a precedent? Bylaw 9! The precedent for alarm is the siren.', 'The siren has not worked since last Dam Day, citizen. Bring me the siren, and I will bring you a decree.'], ask: ask() };
        s.setF('decree'); s.learn('decreed'); s.emit('decree');
        return { say: ['HEAR ME, WICKERBY! By the power vested in me by me:', 'ALL CITIZENS WILL PROCEED AT ONCE TO CHAPEL HILL. WITH BUNS. IN AN ORDERLY RUSH.', 'SO DECREED!'], ask: [] };
      }
    },
  },
  {
    id: 'cat', name: 'Alderman', tag: 'The Deputy Mayor, an orange cat with a ring of keys on his collar.', cat: true,
    look: {},
    goal: s => (s.F('siren_on') && s.since('siren_on') >= 0.5) || s.F('decree') ? 'hill_cat' : sched([[0, 'hall_cat'], [70, 'pier_cat'], [130, 'bakery_sill'], [190, 'green_cat']])(s),
    talk(s, topic) {
      const ask = [['pet', 'Scratch his ears'], ...(s.has('sardine') && !s.F('cat_traded') ? [['trade', 'Offer the sardine']] : [])];
      if (!topic) {
        s.learn('keys_cat');
        if (s.F('cat_traded')) return { say: ['Alderman licks a paw with the dignity of an official who has recently been paid.'], ask: [['pet', 'Scratch his ears']] };
        return { say: ['Alderman, Deputy Mayor of Wickerby, regards you with the contempt of an official.', 'A ring of heavy keys hangs from his ribbon. It is engraved “O.Q.”, and it jingles whenever he breathes.'], ask };
      }
      if (topic === 'pet') return { say: ['He permits it. For one moment he is simply a cat.'], ask };
      if (topic === 'trade') { s.take('sardine'); s.give('keys'); s.setF('cat_traded'); s.learn('cat_trade'); return { say: ['He sniffs once. The ring drops to the ground with a cat-sized thump.', 'You now have Orla’s keys. He doesn’t look at you again.'], ask: [['pet', 'Scratch his ears']] }; }
    },
  },
  {
    id: 'orla', name: 'Orla Quench', tag: 'Dam engineer. Nine days awake. Lantern in daylight.',
    look: { skin: '#e7b48f', hair: '#e07a4a', hairStyle: 'wild', coat: '#7fc4b0', pants: '#6a7fa6', extra: ['goggles', 'lantern'] },
    goal: s => s.F('orla_warned') ? 'hill_orla' : s.F('orla_awake') ? 'dam_orla' : 'inn_orla',
    talk(s, topic) {
      if (!s.F('orla_awake')) {
        const ask = () => [['shake', 'Shake her shoulder'], ...(s.K('dam_height') ? [['wrong', Q('The dam’s only sixty feet, isn’t it?')]] : [])];
        if (!topic) { s.learn('orla_sleep'); s.learn('dam_height'); return { say: ['She is asleep, standing up, lantern burning, goggles on her forehead.', '“…ninety-one feet,” she mutters. “Eleven thousand tons. Ninety-one. Ninety-one…”'], ask: ask() }; }
        if (topic === 'shake') return { say: ['She sways like a reed and doesn’t wake. “…ninety-one feet,” she says, kindly.'], ask: ask() };
        if (topic === 'wrong') { s.setF('orla_awake'); s.learn('orla_wrong'); return { say: ['Her eyes snap open. The lantern jumps.', 'NINETY-ONE! Ninety-one FEET! Not sixty! Whoever measured sixty should be… who are you? How long was I out? I haven’t slept in nine days!'], ask: [...(s.K('dam_break') ? [['dam', Q('The dam breaks at 7:59:45.')]] : []), ['keys', 'Your keys?']] }; }
      }
      const ask = [...(s.K('dam_break') ? [['dam', Q('The dam breaks at 7:59:45.')]] : []), ['keys', 'Your keys?']];
      if (!topic) {
        if (s.F('orla_warned')) return { say: ['Chapel Hill, east path. I’m moving, I’m moving. Eleven seconds early, my log said!'], ask: [] };
        return { say: ['Dam. I’m late. I have been late for nine days. Is it eight yet?'], ask };
      }
      if (topic === 'keys') {
        if (s.has('keys')) { s.learn('siren_locked'); return { say: ['MY KEYS! You’ve… that’s the ring. That’s the very ring. Keep it a while, though: the siren box at the Fire Station is padlocked with the smallest of them, and nobody can sound that horn without it.', 'Take care of it. And take care of the cat.'], ask }; }
        return { say: ['My keys! Gone since Dam Day eve. I put them in a hat… a hat on the Mayor… which means the cat. The cat has them, the cat has everything.', 'Don’t tell the cat I said so.'], ask };
      }
      if (topic === 'dam') {
        s.setF('orla_warned'); s.learn('orla_woke'); s.learn('orla_warned'); s.learn('orla_log');
        return { say: ['Seven fifty-nine and forty-five. My log said fifty-six. Eleven seconds! A rounding error that would have killed me.', 'You don’t guess; you know. Good. East path to the hill. Go. I’ll follow.'], ask: [] };
      }
    },
  },
  {
    id: 'barnaby', name: 'Barnaby Plum', tag: 'Fisherman. Fishes with a teapot. Talks to the river.',
    look: { skin: '#eab08a', hair: '#ececf2', coat: '#f2d15f', pants: '#6a7fa6', hat: ['sou', '#f2d15f'], extra: ['teapot', 'beard'] },
    goal: s => s.F('barnaby_warned') ? 'hill_barnaby' : 'pier_end',
    talk(s, topic) {
      const g = s.F('greeted');
      const ask = [...(g ? [] : [['greet', Q('Good morning, River.')]]), ['teapot', 'Why a teapot?'], ...(g && s.K('cat_fish') ? [['sardine', 'Might I have a sardine?']] : []), ...(g && s.K('dam_break') ? [['leaving', Q('The river is leaving, Barnaby.')]] : [])];
      if (!topic) {
        if (s.F('barnaby_warned')) return { say: ['She told me on Tuesday. “I’m going somewhere.” I thought she meant Wednesday.'], ask: [] };
        if (g) return { say: ['Hello again. She’s in a mood: look, the teapot’s pulling.'], ask };
        s.learn('river_greet');
        return { say: ['Shh. She’s thinking.', '(He sits at the end of the pier, a teapot on a string in the water, and talks only to the river. The river, you feel, should be spoken to first.)'], ask };
      }
      if (topic === 'greet') { s.setF('greeted'); return { say: ['(You say good morning to the river. The water makes one small ripple, just for you.)', 'She ANSWERED! She never answers strangers! Come, come, sit. I’m Barnaby. You’re a friend of hers now.'], ask: [['teapot', 'Why a teapot?'], ...(s.K('cat_fish') ? [['sardine', 'Might I have a sardine?']] : []), ...(s.K('dam_break') ? [['leaving', Q('The river is leaving, Barnaby.')]] : [])] }; }
      if (topic === 'teapot') { s.learn('teapot'); return { say: ['Hooks hurt. Teapots listen. And she likes the tea-smell. Never caught a fish in thirty years, mind. Just got a great deal of company.'], ask }; }
      if (topic === 'sardine') {
        if (s.has('sardine') || s.F('cat_traded')) return { say: ['One’s enough, friend. Don’t spoil the cat. Spoil the river, if you spoil anyone.'], ask };
        s.give('sardine'); return { say: ['The bucket’s for the river’s guests. Take one. Two! (He hands you a sardine in a twist of paper.)', 'It’s for a cat, I’d wager. I can tell by your face.'], ask };
      }
      if (topic === 'leaving') { s.setF('barnaby_warned'); return { say: ['She told me on Tuesday. “I’m going somewhere.” I thought she meant Wednesday.', 'Right. Teapot. Hat. Hill. (He doesn’t say goodbye to you. He says it to the river, for a long time.)'], ask: [] }; }
    },
  },
  {
    id: 'margo', name: 'Margo Crumb', tag: 'Baker. Sings opera. Names every loaf. Floury from head to toe.',
    look: { skin: '#f8e2cf', hair: '#fff', coat: '#fffaf0', pants: '#e8e0f0', hat: ['chef', '#fff'], extra: ['flour', 'notes'] },
    goal: s => (s.F('margo_warned') || (s.F('decree') && s.since('decree') >= 3)) ? 'hill_margo' : s.t < 150 ? 'bakery_margo' : 'green_snack',
    talk(s, topic) {
      const ask = [['gerald', 'Be introduced to Gerald'], ...(s.K('timothy_name') ? [['timothy', Q('May I borrow Timothy?')]] : []), ...(s.K('dam_break') ? [['dam', Q('Margo, the dam is going to break.')]] : [])];
      if (!topic) {
        if (s.F('margo_warned') || s.F('decree')) return { say: ['To the hill, to the hill! Gerald, Brenda, the Duchess, everyone in the basket!'], ask: [] };
        if (!s.F('met_margo')) { s.setF('met_margo'); return { say: ['♪ Gerald, Gerald, rise for me, rise, oh rise, my darling ♪', 'Oh! A customer! I don’t sell to strangers, dear. Everyone in my bakery has been introduced.'], ask }; }
        return { say: ['♪ Brenda, Brenda, brown and bold… ♪ oh, you again. How’s your sense of introduction?'], ask };
      }
      if (topic === 'gerald') { s.learn('gerald'); return { say: ['Gerald, this is a stranger. Stranger, this is Gerald.', '(She is looking at a loaf the size of a pillow, with a tag.) Gerald is not for sale. Gerald is warm. That’s quite different.'], ask }; }
      if (topic === 'timothy') {
        if (s.t < 130) { s.learn('timothy_when'); return { say: ['Timothy? Timothy is on duty! My first batch is in the oven, and he’s the timer. He’s a very serious little cartridge.', 'Come back when Gerald’s out, dear: 7:58:10, by the oven clock, which is right.'], ask }; }
        if (s.has('fuse') || s.F('siren_on')) return { say: ['You’ve got him already! Mind his case. He gets cold.'], ask };
        s.give('fuse'); return { say: ['Oh, Timothy! You called him by name. Nobody ever calls him by name.', '(She unscrews a brass cartridge from the oven’s egg-timer, kisses it, and hands it over.) Mind him. He’s a little bit sacred.'], ask };
      }
      if (topic === 'dam') { s.setF('margo_warned'); return { say: ['Oh dear. Oh dear oh dear. Gerald! Brenda! Little Dave! We’re going on a picnic.', '(She starts loading loaves into a basket as if putting children in a boat.)'], ask: [] }; }
    },
  },
  {
    id: 'wim', name: 'Wim Tock', tag: 'Clockmaker. Two hundred clocks, all wrong. Speaks in the wrong tense.',
    look: { skin: '#e5b99b', hair: '#a8aec4', hairStyle: 'bun', coat: '#b9a2e0', pants: '#6a7fa6', extra: ['loupe', 'watches'] },
    goal: s => s.F('wim_warned') ? 'hill_wim' : 'clock_wim',
    talk(s, topic) {
      const ask = [['clocks', 'Why do the clocks disagree?'], ['bell', 'The chapel clock'], ['orla', 'Orla Quench'], ...(!s.F('wim_trusts') ? [['ticket', 'Show her your ticket']] : []), ...(s.F('wim_trusts') && s.K('dam_break') ? [['dam', Q('The dam breaks at 7:59:45.')]] : [])];
      if (!topic) {
        s.learn('wim_tense');
        if (s.F('wim_warned')) return { say: ['I will have been leaving already. Tick. Tock. Go on, you’ll have gone.'], ask: [] };
        if (!s.F('met_wim')) { s.setF('met_wim'); return { say: ['Welcome back. You’ll have come in already. Tick.', 'Two hundred clocks, dear, and every one of them wrong. Differently. It saves arguments about when.'], ask }; }
        return { say: ['You’ll have said that before. Tick. What shall you ask me this time?'], ask };
      }
      if (topic === 'clocks') { s.learn('wim_clocks'); return { say: ['No two moments agree, so no two clocks should. Only the Grandfather is right, and only for one second a day.', 'It will have been right just now. You missed it. Tock.'], ask }; }
      if (topic === 'bell') { s.learn('bell_slow'); return { say: ['The chapel clock runs two minutes slow, on purpose. The founder asked. A town should have time to run.', 'Mine run slower still, so you may walk.'], ask }; }
      if (topic === 'orla') { s.learn('orla_wrong'); return { say: ['Orla Quench? Never mismeasure a thing in front of her. She wakes up to correct you.', 'She once corrected my grandfather’s pendulum in her sleep. By a quarter of an inch! It was a quarter of an inch short!'], ask }; }
      if (topic === 'ticket') {
        s.setF('wim_trusts'); s.learn('bargain'); s.learn('hask_diary'); s.learn('why_you');
        return { say: ['(She screws a loupe into her eye and holds your ticket up to the window.) “One morning. Not transferable.” Oh. OH.', 'Ottoline Hask’s clock. The founder wound the town clock back a morning, once, and made it promise to keep it in trust.', 'It gives that morning to whoever is waiting on the station bench the day the dam fails. And it takes everything they carry. It leaves what they know.', 'You came with an empty hand and sat down to wait. That’s all it ever wanted. Tick. Welcome back, you.'], ask: [...(s.K('dam_break') ? [['dam', Q('The dam breaks at 7:59:45.')]] : []), ['clocks', 'Why do the clocks disagree?']] };
      }
      if (topic === 'dam') { s.setF('wim_warned'); return { say: ['A clock that knows when it stops. How… rare. How you’ll have said it.', 'I’ll take the smallest one. The rest will have to be wrong without me. (She locks nothing, and leaves the sign on OPEN.)'], ask: [] }; }
    },
  },
  {
    id: 'gideon', name: 'Gideon Marsh', tag: 'Bell-ringer. Deaf as the bell. Everything in capitals.',
    look: { skin: '#efc9a8', hair: '#fafafa', coat: '#8fb8e8', pants: '#7a86b8', extra: ['trumpet', 'beard'] },
    goal: () => 'chapel_gideon',
    talk(s, topic) {
      const ask = [['bell', 'The bell'], ['hill', 'The hill'], ['diary', 'The founder’s diary'], ['ring', 'Might I ring it?']];
      if (!topic) { s.learn('gideon_loud'); if (s.F('decree') || s.F('siren_on')) return { say: ['WHAT? A SIREN? IT’S THE TEST. IS IT EIGHT ALREADY? THEN I SHALL RING. AND KEEP RINGING.'], ask }; return { say: ['WHAT? SPEAK UP, CHILD. I SAID SPEAK UP. OH, A VISITOR. I HAVEN’T HAD A VISITOR SINCE THE LAST ONE.'], ask }; }
      if (topic === 'bell') { s.learn('bell_slow'); return { say: ['THE BELL AND THE CLOCK ARE TWO MINUTES SLOW. THE FOUNDER ASKED. SAID A TOWN SHOULD HAVE TIME TO RUN.', 'I HAVE BEEN RUNNING LATE EVER SINCE. THAT’S HOW I KNOW.'], ask }; }
      if (topic === 'hill') { s.learn('hill_safe'); return { say: ['THIS HILL HAS NEVER FLOODED. NEVER. THE FOUNDER PICKED IT. SHE PICKED EVERYTHING.', 'I RING THE BELL SO PEOPLE FIND IT. THEY USUALLY DON’T. I DON’T HEAR IT EITHER, BUT I FEEL IT IN MY BEARD.'], ask }; }
      if (topic === 'diary') return { say: ['THE DIARY IS ON THE LECTERN. SHE WROTE IN A TINY HAND. I READ IT ALOUD EVERY SUNDAY. THE PEWS HAVE BECOME EXPERTS.'], ask };
      if (topic === 'ring') { s.emit('bellring'); return { say: ['ONE PULL. NO MORE. IT’S A SENSITIVE BELL.', '(You pull the rope. The whole valley hears it, and Gideon feels it in his beard.)'], ask }; }
    },
  },
  {
    id: 'pim', name: 'Pim Alcott', tag: 'Paperboy. Speaks only in headlines.',
    look: { skin: '#f0c6a0', hair: '#7a4a2a', coat: '#ffb27a', pants: '#6a7fa6', hat: ['cap', '#5b8fd0'], extra: ['bag'] },
    goal: s => heard(s, 'pim', 2) ? 'hill_pim' : sched([[0, 'platform_end'], [40, 'main_mid'], [95, 'hall_side'], [150, 'bakery_door'], [195, 'green_c']])(s),
    talk(s, topic) {
      const ask = [['news', 'What’s the news?'], ['move', 'Who can get this town moving?'], ...(s.K('dam_break') ? [['scoop', Q('Pim: the dam breaks at 7:59:45.')]] : [])];
      if (!topic) {
        s.learn('pim_news');
        if (s.F('pim_warned') || s.F('decree')) return { say: ['TOWN BOLTS FOR HILL! PAPERBOY STILL FILING!'], ask: [] };
        if (!s.F('met_pim')) { s.setF('met_pim'); return { say: ['EXTRA! EXTRA! STRANGER TALKS TO PAPERBOY! (That’s you. You’re the headline.)', 'Pim Alcott, Wickerby Gazette. Written, printed and delivered by me. Today’s edition: one copy.'], ask }; }
        return { say: ['STRANGER RETURNS! PAPERBOY “NOT SURPRISED”!'], ask };
      }
      if (topic === 'move') { s.learn('decree_power'); return { say: ['TOWN WAITS FOR MAYOR, MAYOR WAITS FOR PRECEDENT. NOBODY MOVES WITHOUT A DECREE, SAYS EVERYONE.', 'SOURCES CLOSE TO THE MAYOR: THE CAT.'], ask }; }
      if (topic === 'news') {
        if (s.t < 50) { s.learn('speech'); s.learn('siren_silent'); return { say: ['MAYOR TO TAKE GREEN’S STAGE AT 7:57:10. SIREN TEST AT EIGHT. SIREN “NOT SPEAKING TO ANYONE.”'], ask }; }
        if (s.t < 100) { s.learn('keys_cat'); s.learn('cat_fish'); return { say: ['DEPUTY MAYOR LEAVES STEPS FOR PIER. KEYS JINGLE. SARDINES “TREMBLE.”'], ask }; }
        if (s.t < 150) { s.learn('timothy_name'); s.learn('timothy_when'); return { say: ['BAKER’S FIRST BATCH OUT 7:58:10. “TIMOTHY HAS DONE HIS DUTY.” FIRE CHIEF “WANTS HIM BACK.”'], ask }; }
        if (s.t < 200) { s.learn('orla_sleep'); s.learn('orla_wrong'); return { say: ['ENGINEER SLEEPS STANDING AT INN, DAY NINE. CORRECTS GUEST BOOK IN HER SLEEP.'], ask }; }
        s.learn('dam_groan'); return { say: ['SOMETHING GROANS UPSTREAM. IT’S NOT THE BAKER. READERS ADVISED TO “LOOK NORTH.”'], ask };
      }
      if (topic === 'scoop') { s.setF('pim_warned'); return { say: ['EXCLUSIVE! EXCLUSIVE!! DAM TO BREAK AT TIME TO BE SPECIFIED! (He’s off, shouting the headline up the street, newspapers flying behind him.)'], ask: [] }; }
    },
  },
  {
    id: 'iggy', name: 'Chief Blaze', tag: 'Fire Chief. Never seen a fire. Terrified of water.',
    look: { skin: '#e8ad88', hair: '#6a4a2a', coat: '#ec7a6a', pants: '#3b4a6a', hat: ['helmet', '#e05a4a'], extra: ['moustache', 'bucket'] },
    goal: s => flee(s, 'iggy') ? 'hill_iggy' : sched([[0, 'fire_iggy'], [130, 'fire_drill'], [190, 'fire_iggy']])(s),
    talk(s, topic) {
      const ask = [['siren', 'The siren'], ['drill', 'Do you ever leave your post?'], ['water', 'Water, Chief?'], ...(s.K('dam_break') ? [['dam', Q('Chief, water. A great deal of it. Soon.')]] : [])];
      if (!topic) {
        if (s.F('siren_on')) return { say: ['THE SIREN! IT’S… WORKING! WHY’S IT WORKING? ONLY WATER MAKES IT WORK! WATER?! TO THE HILL!'], ask: [] };
        if (!s.F('met_iggy')) { s.setF('met_iggy'); return { say: ['FIRE?! …No. Phew. Hello.', 'Chief Ignatius Blaze, Wickerby Volunteer Fire Brigade, one man strong. Thirty years of service and not one fire. I keep ready. I practise shouting.'], ask }; }
        return { say: ['FIRE?! …no. Phew. Yes, it’s you again.'], ask };
      }
      if (topic === 'siren') { s.learn('siren_silent'); s.learn('timothy_name'); s.learn('siren_fuse'); return { say: ['CURSED! Dead as a doornail since last Dam Day. The box is locked and the key’s gone with the engineer.', 'And the fuse is with Margo. She took it for an egg timer. Calls it TIMOTHY. I can’t even complain: she calls it Timothy so lovingly.'], ask }; }
      if (topic === 'drill') { s.learn('iggy_guard'); return { say: ['I guard the siren box! Nobody touches it while I’m at my post. I leave it only to drill: out front, shouting, from 7:58:10 until 7:59:10. Regular as the bell.'], ask }; }
      if (topic === 'water') { s.learn('iggy_water'); return { say: ['Terrified of it! Opposite of my entire career! If water ever came I’d be up that hill like a… like Alderman.', 'Don’t tell the brigade. I am the brigade.'], ask }; }
      if (topic === 'dam') { s.setF('iggy_warned'); return { say: ['WATER?! (He’s gone before you finish the sentence, a bucket of sand banging against his knee.)'], ask: [] }; }
    },
  },
];

/* things to read and use ---------------------------------------------------------------------------------------- */
export const THINGS = {
  board_station: s => { s.learn('speech'); return { say: ['WICKERBY. DAM DAY! One hundred years of the Hollin Dam.', 'Speech on the Green. Siren test at eight o’clock sharp. Bring a bun. (Signed: The Mayor, and the Deputy Mayor, in paw.)'] }; },
  station_clock: s => { s.learn('station_stuck'); return { say: ['The station clock says 7:56. It said 7:56 when you arrived. The second hand is trembling, as if trying to remember what to do.'] }; },
  sign_bakery: s => { s.learn('gerald'); s.learn('timothy_name'); return { say: ['On the bakery window: “GERALD IS NOT FOR SALE. TIMOTHY IS NOT FOR BORROWING. WE DO NOT SELL TO STRANGERS (INTRODUCTIONS AT THE COUNTER).”'] }; },
  plaque: s => { s.learn('dam_height'); return { say: ['A brass plaque: “THE HOLLIN DAM, O. HASK, 1926. NINETY-ONE FEET. A TOWN MAY SLEEP BEHIND IT.”', 'Somebody has scratched underneath: “(not today)”.'] }; },
  crack: s => { s.learn('dam_crack'); return { say: ['A crack climbs the face of the dam, a hand’s width, weeping a thin bright thread of water. You can watch it widen.'] }; },
  sluice: s => ({ say: ['The spillway wheel is jammed solid with silt and a surprising amount of knitting. Nobody is turning it today.'] }),
  river: s => ({ say: ['The river chatters over the stones, in no particular hurry.'] }),
  sheets: s => { s.learn('hill_safe'); return { say: ['A line of washing. Someone has stitched a map of the valley on one sheet. Chapel Hill is circled and embroidered: “DRY”.'] }; },
  stage_sign: () => ({ say: ['A hand-painted sign: “DAM DAY SPEECH, ON THE GREEN. BRING A BUN. NO APPLAUSE BEFORE THE MAYOR SAYS.”'] }),
  bucket: () => ({ say: ['A bucket of sardines, glittering. They are not for you. They are, you gather, for the river’s guests.'] }),
  slate: s => { s.learn('dam_height'); s.learn('orla_wrong'); return { say: ['A slate on an easel, in Orla’s handwriting: “DAM: 91 FT. SPILLWAY JAMMED. CRACK EAST BUTTRESS. KEYS: LOST. SLEEP: LATER.”', 'Underneath, in someone else’s: “She corrects the guest book in her sleep. Leave it.”'] }; },
  guestbook: s => { s.learn('orla_sleep'); return { say: ['The guest book: “Room 4. O. Quench. Nights: nine. Please stop waking me, I have not slept.” The last three words have been corrected: it is “…I have not slept for nine days.”'] }; },
  grand: s => { s.learn('wim_clocks'); return { say: ['The Grandfather clock. Every other clock in the shop is wrong, and this one is right for exactly one second a day. You wait. It isn’t this second.'] }; },
  wallclocks: () => ({ say: ['Two hundred clocks, ticking out of step. Walking in here is like being rained on by very small, very polite drums.'] }),
  timothy: s => { s.learn('timothy_name'); return { say: ['A little brass cartridge in an egg-timer case ticks on the oven shelf. A label: “TIMOTHY. DO NOT TOUCH.” He is, you notice, exactly the size of a fuse.'] }; },
  loaf_tags: s => { s.learn('gerald'); return { say: ['Name tags: GERALD, BRENDA, LITTLE DAVE, THE DUCHESS. A card: “Gerald is not for sale. Gerald is warm.”'] }; },
  notes: () => ({ say: ['The Mayor’s speech notes: “…and so, Wickerby, one hundred years! We thank the dam, which has asked nothing of us and given us nothing but… (the last line is blank, with a doodle of a cat.)”'] }),
  portrait: s => { s.learn('mayor_cat'); return { say: ['A portrait of the Deputy Mayor, in a sash. The Mayor’s portrait hangs beneath it, smaller.'] }; },
  ledger: s => { s.learn('mayor_cat'); return { say: ['“Motions this year: 114. Carried by the Deputy: 114. Carried by the Mayor: 0 (she abstains in his favour).” Beside it, in paw: one pawprint.'] }; },
  fire_notice: s => { s.learn('siren_silent'); return { say: ['“SIREN OUT OF ORDER. FUSE MISSING. KEYS: ENGINEER. ALSO: PLEASE DO NOT SHOUT ‘FIRE’ AS A GREETING. THE BRIGADE.”'] }; },
  siren_box: s => {
    s.learn('siren_locked'); s.learn('siren_fuse');
    if (s.F('siren_on')) return { say: ['The siren is wailing. You decide not to touch the lever again.'] };
    const chief = s.npcs.find(n => n.id === 'iggy');
    if (chief.map === 'fire' && !chief.caught) { s.learn('iggy_guard'); return { say: ['Chief Blaze steps squarely in front of the box, helmet and all.', 'HANDS OFF! THE SIREN IS UNDER GUARD! I LEAVE MY POST FOR ONE THING ONLY, AND THAT’S DRILL! (He stares at you until you back away.)'], cost: 1 }; }
    if (!s.has('keys')) return { say: ['A grey steel box on the wall, padlocked. A card: “KEYS: O. QUENCH. DO NOT FEED.”', 'Behind the little glass window the fuse slot is empty. The wires climb to the roof, where the siren is waiting.'] };
    if (!s.has('fuse')) return { say: ['The padlock opens to Orla’s ring. Behind the glass the fuse slot is empty. No fuse, no siren.'] };
    s.take('fuse'); s.setF('siren_on'); s.learn('siren_sounds'); s.emit('siren');
    return { say: ['Padlock. Fuse. Lever.', 'The siren on the roof coughs, shakes the dust from its throat, and sings. Across the valley, every head turns.'], cost: 2 };
  },
  diary: s => { s.learn('hask_diary'); s.learn('bargain'); s.learn('why_you'); return { say: [
    'Ottoline Hask’s diary, page one: “The dam is done, and the water is up, and it will not hold. I have turned the town clock back one morning, and it consented. I did not ask how.”',
    'Page two: “It keeps the morning in trust. It takes back everything but what you know. It will lend the morning to whoever is waiting on the station bench the day the dam fails.”',
    'Page three: “I don’t know who you are. I know you are waiting, with nothing to gain, and I know you will listen. That is the whole qualification. Please be kind to them all.”'] }; },
  rope: s => ({ say: ['The bell rope, thick as an arm, polished to a shine by thirty years of one man’s hands.'] }),
  log: s => { s.learn('orla_log'); s.learn('dam_crack'); s.learn('hill_safe'); s.learn('dam_height'); return { say: ['Orla’s log, in pencil: “Crack in east buttress, widening an inch a minute. Spillway wheel jammed; keys lost. Failure est. 7:59:56 (±10). EVACUATE TO CHAPEL HILL if it goes. Not enough time to fix. Not enough time. Not enough.”'] }; },
  model_dam: s => ({ say: ['A model of the dam, in plaster, with a tiny crack and a tiny blue ribbon where the river should be. Someone has labelled the east buttress, and underlined it twice.'] }),
};

export const COSTS = { open: 5, topic: 4, thing: 3 };
