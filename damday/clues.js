// What the notebook can come to know. A clue is a line in a thread (a rumour you're chasing); `lead` says where it
// points next, shown under the line until the thread is solved. Clues are the only thing that survives a loop.

export const THREADS = [
  { id: 'why', title: 'Why me?', solved: 'why_you', blurb: 'You got off the 7:56 and sat down to wait. Nothing else about you is special.' },
  { id: 'dam', title: 'What is wrong with the dam?', solved: 'dam_break', blurb: 'The Hollin Dam, ninety-one feet of it, upstream of everything.' },
  { id: 'siren', title: 'Why doesn’t the siren work?', solved: 'siren_sounds', blurb: 'Fire Station. Dead since last Dam Day.' },
  { id: 'keys', title: 'The engineer’s keys are with the mayor’s cat', solved: 'cat_trade', blurb: 'Orla Quench’s key ring, on Alderman’s collar.' },
  { id: 'mayor', title: 'Nobody in Wickerby moves without a decree', solved: 'decreed', blurb: 'The town waits for the Mayor, and the Mayor waits for a precedent.' },
  { id: 'orla', title: 'Orla hasn’t slept in nine days', solved: 'orla_warned', blurb: 'The engineer who knows the dam best, asleep on her feet.' },
  { id: 'clocks', title: 'Why do all the clocks disagree?', solved: null, blurb: 'Wickerby has two hundred clocks and no two agree.' },
  { id: 'folk', title: 'Everybody has a thing', solved: null, blurb: 'Small facts about the people here. They add up.' },
];

export const CLUES = {
  // why me
  ticket: { th: 'why', t: 'Your ticket: “WICKERBY, ONE MORNING, NOT TRANSFERABLE”, stamped 7:56. The passenger line is blank.', lead: 'Somebody here may know what a ticket like that means.' },
  hask_diary: { th: 'why', t: 'Ottoline Hask built the dam. Her diary: the night the test flood came, she wound the town clock back one morning, and the clock agreed.', lead: 'The diary is in the chapel. The clockmaker might know more.' },
  bargain: { th: 'why', t: 'The clock keeps that morning in trust for whoever is waiting on the station bench the day the dam fails. It takes back everything you carry. It leaves what you know.', lead: null },
  why_you: { th: 'why', t: 'You weren’t chosen for being special. You were the one waiting, with no stake and an empty hand, and you listened. That was the whole qualification.', lead: null },
  // dam
  dam_height: { th: 'dam', t: 'The Hollin Dam is ninety-one feet tall. The plaque says so, and Orla says it in her sleep.', lead: null },
  dam_crack: { th: 'dam', t: 'A crack climbs the east side of the dam face and weeps. It is wider every minute.', lead: 'Orla keeps a log of it at the mill.' },
  orla_log: { th: 'dam', t: 'Orla’s log: the crack widens an inch a minute, the spillway wheel is jammed. “If it goes: Chapel Hill. Estimate 7:59:56.”', lead: null },
  dam_groan: { th: 'dam', t: 'The dam groans three times, each longer than the last, from about 7:59:15.', lead: null },
  dam_break: { th: 'dam', t: 'At 7:59:45 the dam gives way. The water takes the low town in fifteen seconds. Nothing in the valley can stop that. Only where people are standing can change.', lead: 'High ground: Chapel Hill.' },
  hill_safe: { th: 'dam', t: 'Chapel Hill stays dry. The founder chose it. Everything above the cliff is safe.', lead: null },
  // siren
  siren_silent: { th: 'siren', t: 'The siren hasn’t sounded since last Dam Day. Chief Blaze says it is cursed.', lead: 'Look at the siren box in the Fire Station.' },
  siren_locked: { th: 'siren', t: 'The siren’s control box is padlocked. A card on it reads: KEYS: O. QUENCH.', lead: 'Where are the engineer’s keys?' },
  siren_fuse: { th: 'siren', t: 'Behind the glass, the box’s fuse slot is empty. No fuse, no siren.', lead: 'Someone borrowed a fuse.' },
  timothy_name: { th: 'siren', t: 'Margo the baker borrowed the siren’s fuse as an oven timer. She calls it Timothy.', lead: 'Ask Margo for Timothy by name.' },
  timothy_when: { th: 'siren', t: 'Timothy can’t be spared until Margo’s first batch is out, at 7:58:10.', lead: null },
  iggy_guard: { th: 'siren', t: 'Chief Blaze guards the siren box and lets nobody near it, except while he drills out front, from 7:58:10 to 7:59:10.', lead: 'Watch where he goes.' },
  siren_sounds: { th: 'siren', t: 'With the keys and Timothy the box works: one lever, and the whole valley hears the siren.', lead: null },
  siren_alone: { th: 'siren', t: 'The siren alone moves nobody. They look up, then look at the Mayor.', lead: 'Who gets Wickerby moving?' },
  // keys
  keys_cat: { th: 'keys', t: 'Orla’s key ring hangs from the Mayor’s cat’s collar. Alderman sits on the Town Hall steps until about 7:57:10.', lead: 'What does a cat want?' },
  cat_fish: { th: 'keys', t: 'Alderman can be bought with a sardine, to the Mayor’s horror.', lead: 'The fisherman keeps sardines.' },
  river_greet: { th: 'keys', t: 'Barnaby the fisherman won’t speak to anyone who hasn’t greeted the river first. He keeps a bucket of sardines.', lead: null },
  cat_trade: { th: 'keys', t: 'A sardine for the key ring. Alderman made the trade without a word.', lead: null },
  // mayor
  speech: { th: 'mayor', t: 'The Mayor takes the Green’s stage at about 7:57:10 to give her Dam Day speech. Until then she rehearses on the Town Hall steps.', lead: null },
  decree_power: { th: 'mayor', t: 'Only a decree from the Mayor makes Wickerby move.', lead: 'She’ll want a reason.' },
  decree_precedent: { th: 'mayor', t: 'Bylaw 9: a decree needs a precedent, and the only precedent is the siren. Siren first, then ask her to decree.', lead: null },
  decreed: { th: 'mayor', t: 'Decreed from the Green: “Everyone to Chapel Hill, with buns.” Pim, Margo, Alderman and the Chief all go.', lead: null },
  // orla
  orla_sleep: { th: 'orla', t: 'Orla the engineer sleeps standing up at the Inn, lantern still lit. Nothing wakes her. She mutters measurements.', lead: null },
  orla_wrong: { th: 'orla', t: 'Orla wakes at once if anyone gets a measurement wrong. (Wim says she once corrected a pendulum in her sleep.)', lead: 'She mutters the right one in her sleep.' },
  orla_woke: { th: 'orla', t: 'Awake, Orla believes nothing until you tell her exactly when the dam goes.', lead: null },
  orla_warned: { th: 'orla', t: 'Told the exact second, Orla takes the east path to the hill.', lead: null },
  // clocks
  wim_clocks: { th: 'clocks', t: 'Wim Tock’s two hundred clocks are each wrong in their own way. Her Grandfather clock is right for exactly one second a day.', lead: null },
  bell_slow: { th: 'clocks', t: 'The chapel clock runs two minutes slow, on purpose: the founder wanted the town to have time to run.', lead: null },
  station_stuck: { th: 'clocks', t: 'The station clock says 7:56. It said 7:56 when you arrived and it says 7:56 now.', lead: null },
  // folk
  gerald: { th: 'folk', t: 'Margo names every loaf and won’t sell to strangers. Gerald is not for sale (he’s warm, and his tag says so).', lead: null },
  teapot: { th: 'folk', t: 'Barnaby fishes with a teapot on a string. Hooks hurt; teapots listen.', lead: null },
  iggy_water: { th: 'folk', t: 'Chief Blaze has never seen a fire and is terrified of water, the opposite of everything he trained for.', lead: null },
  pim_news: { th: 'folk', t: 'Pim Alcott speaks only in headlines, and has been right about everything so far.', lead: null },
  wim_tense: { th: 'folk', t: 'Wim speaks in the wrong tense on purpose. “It saves arguments about when.”', lead: null },
  gideon_loud: { th: 'folk', t: 'Gideon is deaf as the bell he rings. You have to shout. He enjoys it.', lead: null },
  mayor_cat: { th: 'folk', t: 'Alderman is the Deputy Mayor. He has voted 114 times and carried every motion.', lead: null },
};

// What you can tell about the day from the notebook alone: a gentle nudge for the stuck, never an answer.
export const NUDGES = [
  [k => !k('dam_break'), 'You haven’t seen how the loop ends. Stay in town and look at the dam’s side of the valley.'],
  [k => k('dam_break') && !k('siren_sounds') && !k('decreed'), 'The water can’t be stopped, so people have to be moved. Who could move a town? Why doesn’t the siren work?'],
  [k => k('decree_precedent') && !k('siren_sounds'), 'The Mayor needs the siren first. The siren needs keys and a fuse.'],
  [k => k('siren_sounds') && !k('decreed'), 'The siren has sounded, but only the Mayor can say the words. She is on the Green.'],
  [k => k('decreed'), 'Some people can’t hear a siren or a decree: the shop, the pier, the sleeper. Reach them yourself, in time.'],
];
